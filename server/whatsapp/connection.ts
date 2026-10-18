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
import { cleanExpiredReservations, dataDir } from '../database';
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
import { registerHistoryHandler, registerMessageHandler, flushPendingStartupMessages, bindBotReady, resetIngestState } from './ingest';

/** Ruta del sistema de archivos donde se almacenan las llaves de sesión criptográficas.
 *  [AISLAMIENTO] Usa `dataDir` para respetar CRASTUR_DATA_DIR (pruebas/entornos aislados). */
const authFolder = path.join(dataDir || path.join(__dirname, '..', '..', 'data'), 'auth_info_baileys');

let reconnectTimer: any = null;
let followUpInterval: any = null;
let connectingTimeout: any = null;
let botReady = { value: false };
let botReadyTimer: any = null;

// [CONTROL DE RECONEXIÓN] Contador de intentos consecutivos de reconexión y bandera
// de pausa. [ESTABILIDAD] Con una sesión vinculada la reconexión nunca se pausa: el
// contador solo alimenta el backoff progresivo (5s → 60s). La pausa se reserva para el
// caso sin sesión, donde hace falta que el usuario escanee el QR una vez.
let reconnectAttempts = 0;
let reconnectPaused = false;
let manualStartRequested = false;
// [ESTABILIDAD] Evita abrir dos sockets a la vez cuando se solapan /start, reconexión y un
// intento en curso (churn de sockets y ventanas de reconexión).
let isStartingSocket = false;

/**
 * [NUEVO QR LIMPIO] Reactiva manualmente la reconexión tras una pausa.
 * Se invoca cuando el usuario pulsa "Generar QR" / "Resetear" en el panel.
 */
export function resumeWhatsAppReconnection(): void {
  reconnectPaused = false;
  reconnectAttempts = 0;
  manualStartRequested = true;
}

/**
 * Habilita una ventana de gracia tras una solicitud manual: durante los próximos
 * intentos no se pausa por "sin credenciales", dando tiempo a Baileys a emitir el QR.
 */
let manualGraceUntil = 0;
const MANUAL_GRACE_MS = 60000;
function manualGraceActive(): boolean {
  return Date.now() < manualGraceUntil;
}

/** Indica si la conexión automática quedó pausada por intentos fallidos. */
export function isWhatsAppReconnectionPaused(): boolean {
  return reconnectPaused;
}

/**
 * [ESTABILIDAD DE CONEXIÓN] True si la sesión está realmente VINCULADA (registrada).
 *
 * Baileys escribe `creds.json` incluso antes de escanear el QR, por lo que la sola
 * existencia del archivo no distingue una sesión válida de una vinculación a medias.
 * Se lee la bandera `registered` para saber si hay una sesión real que deba recuperarse
 * sola (sin pedir QR de nuevo) cuando la conexión se cae o no responde.
 */
function hasRegisteredSession(): boolean {
  try {
    const credsPath = path.join(authFolder, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    const raw = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    return !!(raw && raw.registered);
  } catch {
    return false;
  }
}

/** Calcula el retardo de reconexión con backoff progresivo (5s → 60s) y jitter humano. */
function nextReconnectDelay(attempts: number): number {
  const baseDelay = 5000;
  const delay = Math.min(baseDelay * Math.pow(2, Math.max(0, attempts - 1)), 60000);
  return delay + Math.floor(Math.random() * 1500);
}

/** Programa un reintento de conexión (ignora la llamada si ya hay uno pendiente). */
function scheduleReconnect(reason: string): void {
  if (reconnectTimer) return;
  reconnectAttempts++;
  const delay = nextReconnectDelay(reconnectAttempts);
  console.log(`[WhatsApp] ${reason} Reintentando en ${Math.round(delay / 1000)}s (intento ${reconnectAttempts})...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startWhatsApp();
  }, delay);
}

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

  // [SIN SESIÓN] Si la conexión automática quedó pausada y no hay una sesión vinculada,
  // NO reintentar en bucle: se deja el estado en desconectado y se espera a que el usuario
  // pulse "Generar QR" en el panel. Salvo que haya una solicitud manual (Generar QR /
  // Reset), en cuyo caso SÍ se intenta.
  if (reconnectPaused && !hasRegisteredSession() && !manualStartRequested && !manualGraceActive()) {
    console.log('[WhatsApp] Reconexión automática pausada (sin sesión vinculada). Escanea el QR desde el panel para conectar.');
    return;
  }
  // La solicitud manual habilita una ventana de gracia para generar el QR.
  if (manualStartRequested) {
    manualGraceUntil = Date.now() + MANUAL_GRACE_MS;
  }
  manualStartRequested = false;

  if (connectionStatus === 'connecting') {
    if (isStartingSocket) {
      console.log('[WhatsApp] Ya hay un intento de conexión en curso; se omite el nuevo intento.');
      return;
    }
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

      // [ESTABILIDAD DE CONEXIÓN] Con una sesión vinculada (o en ventana manual para QR),
      // la conexión se recupera sola: no hace falta que el usuario toque nada ni re-escanee.
      if (!reconnectPaused && (hasRegisteredSession() || manualGraceActive())) {
        scheduleReconnect('La conexión no respondió.');
      }
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

    isStartingSocket = true;
    const newSock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      // [ANTI-BANEO META 2025] Perfil de navegador estable.
      // NOTA: el perfil `windows('Desktop')` provoca que WhatsApp cierre el
      // handshake con código 428 ("Connection Terminated") en algunas redes/regiones,
      // impidiendo generar el QR. Se usa un perfil `ubuntu('Chrome')`, verificado
      // como estable para emitir el QR de vinculación.
      browser: Browsers.ubuntu('Chrome')
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
        isStartingSocket = false;
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

        // [ESTABILIDAD DE CONEXIÓN] Con una sesión vinculada (registered) la reconexión es
        // ILIMITADA: una caída de internet, un reinicio del servidor o un 428/408 pasajero se
        // recuperan solos con backoff progresivo, sin pedir QR ni exigir que el usuario toque nada.
        const isRetryableClose = statusCode === 408 || statusCode === 428;
        if (isRetryableClose) {
          console.log(`[WhatsApp] Cierre recuperable (código ${statusCode}).`);
        } else if (statusCode !== undefined) {
          // Otros códigos (p. ej. 440 connectionReplaced) reinician el contador
          reconnectAttempts = 0;
        }

        // [PAUSA SOLO SIN SESIÓN] Sin una sesión vinculada no se reintenta en bucle: se espera
        // a que el usuario genere el QR desde el panel. Durante la ventana de gracia manual sí
        // se reintenta (Baileys necesita varios intentos para emitir el QR de vinculación).
        if (!hasRegisteredSession() && !manualGraceActive()) {
          reconnectPaused = true;
          console.log('[WhatsApp] ⏸️ Sin sesión vinculada. Reconexión pausada hasta que se genere un nuevo QR.');
          return;
        }

        if (shouldReconnect) {
          scheduleReconnect('Conexión cerrada.');
        }
      } else if (connection === 'open') {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        isStartingSocket = false;
        reconnectAttempts = 0;
        reconnectPaused = false;
        setConnectionStatus('connected');
        setCurrentQR(null);
        const jid = newSock.user?.id || '';
        const phone = jid.split(':')[0] || jid.split('@')[0];
        setCurrentUser({ jid, phone, name: newSock.user?.name || 'Crastur WhatsApp' });
        console.log(`[WhatsApp] ¡Conexión exitosa a WhatsApp! Sesión activa: ${phone}`);
        notifyStatusChange();

        // [ANTI-BANEO / RITMO HUMANO] Marcarse como disponible al conectar, como una persona
        // que abre WhatsApp Web al llegar al mostrador. No bloquea nada si falla.
        try { await newSock.sendPresenceUpdate('available'); } catch { }

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
    isStartingSocket = false;
    console.error('[WhatsApp] Error al inicializar socket (sin internet o conexión inestable):', initErr?.message || initErr);
    setConnectionStatus('disconnected');
    notifyStatusChange();
    // [BACKOFF] Usar el programador con backoff progresivo en lugar de un reintento fijo de 8s.
    if (!reconnectTimer) scheduleReconnect('Error de inicialización.');
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

  // [INTEGRIDAD / LIMPIEZA DE RECURSOS] Detener timers y soltar el socket tras el logout.
  // Antes quedaban vivos el intervalo de follow-ups y el temporizador de "bot listo",
  // dejando el estado inconsistente y consumiendo recursos.
  isStartingSocket = false;
  resetIngestState();
  try { if (followUpInterval) { clearInterval(followUpInterval); followUpInterval = null; } } catch {}
  try { if (botReadyTimer) { clearTimeout(botReadyTimer); botReadyTimer = null; } } catch {}
  try { if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } } catch {}
  try { if (connectingTimeout) { clearTimeout(connectingTimeout); connectingTimeout = null; } } catch {}
  botReady.value = false;
  try { if (sock) { sock.ev?.removeAllListeners?.(); setSock(null); } } catch {}

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
  // [REACTIVACIÓN MANUAL] Limpia la pausa para permitir un nuevo intento con QR fresco
  reconnectPaused = false;
  reconnectAttempts = 0;
  isStartingSocket = false;
  resetIngestState();
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
    // [INTEGRIDAD] Replicar la limpieza de logout: sin esto el intervalo de 60s y el
    // temporizador de "bot listo" seguían vivos tras detener el socket.
    if (followUpInterval) {
      clearInterval(followUpInterval);
      followUpInterval = null;
    }
    if (botReadyTimer) {
      clearTimeout(botReadyTimer);
      botReadyTimer = null;
    }
    isStartingSocket = false;
    botReady.value = false;
    resetIngestState();
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
