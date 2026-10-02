/**
 * @file connection.ts
 * @description Ciclo de vida del socket de WhatsApp: inicio/conexión, reconexión con backoff,
 * generación de QR, tareas programadas (apartados/follow-ups) y cierre de sesión.
 * Extraído de whatsappService.ts conservando el comportamiento original.
 */

import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';
import { checkPendingFollowUps, check22hReservationReminders } from '../bot';
import { cleanExpiredReservations } from '../database';
import { loadBaileys, getWASocket, getDisconnectReason, getUseMultiFileAuthState, getFetchLatestBaileysVersion, getBrowsers } from './baileysLoader';
import {
  sock,
  setSock,
  connectionStatus,
  setConnectionStatus,
  currentQR,
  setCurrentQR,
  currentUser,
  setCurrentUser,
  notifyStatusChange
} from './socketState';
import { enqueueOutboundMessage } from './outboundQueue';
import { registerHistoryHandler, registerMessageHandler, flushPendingStartupMessages, bindBotReady } from './ingest';

/** Ruta del sistema de archivos donde se almacenan las llaves de sesión criptográficas */
const authFolder = path.join(__dirname, '..', '..', 'data', 'auth_info_baileys');

let qrTimeoutCount = 0;
let reconnectTimer: any = null;
let followUpInterval: any = null;
let connectingTimeout: any = null;
let botReady = { value: false };
let botReadyTimer: any = null;

// Enlazar el estado botReady con el módulo de ingestión
bindBotReady(botReady);

/**
 * Inicializa y gestiona la conexión con los servidores de WhatsApp mediante Baileys v7.
 */
export async function startWhatsApp(): Promise<void> {
  await loadBaileys();

  if (connectionStatus === 'connected') {
    console.log('[WhatsApp] Ya está conectado.');
    return;
  }

  if (connectionStatus === 'connecting') {
    console.log('[WhatsApp] Ya hay un intento de conexión en curso. Esperando o forzando renovación...');
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  setConnectionStatus('connecting');
  setCurrentQR(null);
  notifyStatusChange();

  // Temporizador de guardia: si pasan 20s en 'connecting' sin respuesta, volver a 'disconnected'
  if (connectingTimeout) clearTimeout(connectingTimeout);
  connectingTimeout = setTimeout(() => {
    if (connectionStatus === 'connecting') {
      console.log('[WhatsApp] Tiempo de espera de conexión agotado. Restableciendo estado a desconectado.');
      setConnectionStatus('disconnected');
      notifyStatusChange();
    }
  }, 20000);

  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  try {
    const useMultiFileAuthState = getUseMultiFileAuthState();
    const fetchLatestBaileysVersion = getFetchLatestBaileysVersion();
    const Browsers = getBrowsers();
    const makeWASocket = getWASocket();
    const DisconnectReason = getDisconnectReason();

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end();
      } catch (e) { }
    }

    const newSock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      // [ANTI-BANEO META 2025] Generador de perfiles dinámico para evitar fingerprints obsoletos
      browser: Browsers.windows('Desktop')
    });
    setSock(newSock);

    newSock.ev.on('creds.update', saveCreds);

    newSock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        try {
          setCurrentQR(await QRCode.toDataURL(qr, { margin: 2, scale: 7 }));
          setConnectionStatus('qr_ready');
          console.log('[WhatsApp] Código QR generado, listo para escanear en la app');
          notifyStatusChange();
        } catch (qrErr: any) {
          console.error('[WhatsApp] Error generando código QR:', qrErr);
        }
      }

      if (connection === 'close') {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        const shouldReconnect = !isLoggedOut;

        console.log(`[WhatsApp] Conexión cerrada (status: ${statusCode}). Reconectar: ${shouldReconnect}`);

        if (isLoggedOut) {
          console.log('[WhatsApp] Sesión desvinculada (401). Limpiando credenciales obsoletas para permitir nuevo QR...');
          try {
            if (fs.existsSync(authFolder)) {
              fs.rmSync(authFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
            }
          } catch (rmErr: any) {
            console.error('[WhatsApp] Error limpiando credenciales desvinculadas:', rmErr);
          }
        }

        setConnectionStatus('disconnected');
        setCurrentQR(null);
        setCurrentUser(null);
        botReady.value = false;
        if (botReadyTimer) { clearTimeout(botReadyTimer); botReadyTimer = null; }
        notifyStatusChange();

        if (followUpInterval) {
          clearInterval(followUpInterval);
          followUpInterval = null;
        }

        // Freno ante timeout de QR repetido (error 408) para no saturar CPU
        if (statusCode === 408) {
          qrTimeoutCount++;
          console.log(`[WhatsApp] Tiempo de espera de escaneo QR agotado (${qrTimeoutCount}/3).`);
          if (qrTimeoutCount >= 3) {
            console.log('[WhatsApp] ⏸️ Reconexión de QR pausada tras 3 intentos para ahorrar recursos. Genera un nuevo código desde la app.');
            return;
          }
        } else if (statusCode !== undefined) {
          qrTimeoutCount = 0;
        }

        if (shouldReconnect) {
          const delay = statusCode === 408 ? 8000 : 4000;
          reconnectTimer = setTimeout(() => {
            startWhatsApp();
          }, delay);
        }
      } else if (connection === 'open') {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        qrTimeoutCount = 0;
        setConnectionStatus('connected');
        setCurrentQR(null);
        const jid = newSock.user?.id || '';
        const phone = jid.split(':')[0] || jid.split('@')[0];
        setCurrentUser({ jid, phone, name: newSock.user?.name || 'Crastur WhatsApp' });
        console.log(`[WhatsApp] ¡Conexión exitosa a WhatsApp! Sesión activa: ${phone}`);
        notifyStatusChange();

        // Ventana de estabilización: 20s para sincronización inicial sin activar auto-respuestas
        botReady.value = false;
        if (botReadyTimer) clearTimeout(botReadyTimer);
        botReadyTimer = setTimeout(async () => {
          botReady.value = true;
          console.log('[WhatsApp] ✅ Bot listo y activo. Respondiendo mensajes nuevos.');
          await flushPendingStartupMessages();
        }, 20000);

        // Tarea programada cada 60s: limpieza de apartados vencidos y chequeo de seguimientos
        if (!followUpInterval) {
          followUpInterval = setInterval(() => {
            try {
              cleanExpiredReservations();
            } catch (err: any) {
              console.error('[Apartados] Error al limpiar vencidos:', err?.message || err);
            }

            if (connectionStatus === 'connected' && sock) {
              if (typeof check22hReservationReminders === 'function') {
                check22hReservationReminders((targetJid: string, messageText: string) => {
                  enqueueOutboundMessage(targetJid, messageText);
                });
              }
              checkPendingFollowUps((targetJid: string, messageText: string) => {
                enqueueOutboundMessage(targetJid, messageText);
              });
            }
          }, 60 * 1000);
        }
      }
    });

    // Ingesta de historial y mensajes en vivo (delegada a ingest.ts)
    registerHistoryHandler();
    registerMessageHandler();

  } catch (initErr: any) {
    console.error('[WhatsApp] Error al inicializar socket (sin internet o conexión inestable):', initErr?.message || initErr);
    setConnectionStatus('disconnected');
    notifyStatusChange();
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startWhatsApp();
      }, 8000);
    }
  }
}

/**
 * Cierra la sesión activa de WhatsApp y purga las credenciales del sistema de archivos.
 */
export async function logoutWhatsApp(): Promise<void> {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (e: any) {
    console.log('[WhatsApp] Error al cerrar sesión:', e?.message || e);
  }

  try {
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  } catch (rmErr: any) {
    console.error('[WhatsApp] Error borrando credenciales:', rmErr);
  }

  setConnectionStatus('disconnected');
  setCurrentQR(null);
  setCurrentUser(null);
  notifyStatusChange();
  console.log('[WhatsApp] Sesión cerrada y credenciales eliminadas.');
}

/**
 * Ejecuta un reseteo forzoso del socket, eliminando credenciales corruptas y forzando
 * un nuevo código QR limpio para escanear.
 */
export async function resetWhatsApp(): Promise<{ success: boolean; message: string }> {
  console.log('[WhatsApp] 🔄 Ejecutando reseteo forzoso de WhatsApp...');
  qrTimeoutCount = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (connectingTimeout) clearTimeout(connectingTimeout);

  try {
    if (sock) {
      sock.ev.removeAllListeners();
      sock.end();
      setSock(null);
    }
  } catch (e: any) { }

  // Pausa breve para liberación de descriptores de archivo en el SO
  await new Promise(r => setTimeout(r, 400));

  try {
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      console.log('[WhatsApp] Carpeta de credenciales auth_info_baileys eliminada.');
    }
  } catch (rmErr: any) {
    console.error('[WhatsApp] Error limpiando credenciales en reseteo:', rmErr);
  }

  setConnectionStatus('disconnected');
  setCurrentQR(null);
  setCurrentUser(null);
  notifyStatusChange();

  await startWhatsApp();
  return { success: true, message: 'WhatsApp reseteado con éxito, generando nuevo QR...' };
}

/**
 * Detiene la conexión del socket y limpia todos los temporizadores asociados.
 */
export function stopWhatsApp(): void {
  try {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (connectingTimeout) {
      clearTimeout(connectingTimeout);
      connectingTimeout = null;
    }
    if (sock) {
      sock.ev.removeAllListeners();
      sock.end();
      setSock(null);
    }
  } catch (e: any) {}
  setConnectionStatus('disconnected');
  setCurrentQR(null);
  setCurrentUser(null);
  notifyStatusChange();
}
