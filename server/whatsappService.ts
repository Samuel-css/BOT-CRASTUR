/**
 * @file whatsappService.ts
 * @description Servicio central de conectividad y gestión del socket de WhatsApp mediante Baileys v7.
 * Controla el ciclo de vida del socket, autenticación multi-archivo, colas estocásticas salientes
 * anti-baneo (Políticas Meta 2025), debouncing de mensajes en ráfaga y sincronización con el Live Inbox.
 * 
 * [BAILEYS v7 ESM]
 * En Node 24 y Baileys v7, la biblioteca es un módulo ESM puro. Se carga dinámicamente mediante
 * import() para garantizar compatibilidad con el entorno de ejecución sin romper tsx/TypeScript.
 * 
 * [ANTI-BANEO META 2025]
 * - Límite de ventana de soporte a 24 horas para mensajes no solicitados.
 * - Despacho estocástico de recordatorios con retardos humanos (3.5s - 6.5s) y presencia 'composing'.
 * - Fingerprinting moderno mediante perfiles dinámicos de Baileys (evita agentes obsoletos).
 */

import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';
import { processIncomingMessage, checkPendingFollowUps, check22hReservationReminders } from './bot';
import { db, recordMetric, cleanExpiredReservations, isBotGloballyPaused, isBotPaused } from './database';
import { standardizeBotMessage } from './bot/utils/textUtils';
import { isWithinBusinessHours } from './bot/services/businessRules';
import type { WhatsAppConnectionStatus, OutboundQueueItem, WhatsAppStatusPayload } from './types/whatsapp';

// ============================================================================
// CARGA DINÁMICA DE BAILEYS v7 (ESM)
// ============================================================================
let makeWASocket: any = null;
let DisconnectReason: any = null;
let useMultiFileAuthState: any = null;
let fetchLatestBaileysVersion: any = null;
let Browsers: any = null;
let baileysLoaded = false;

/**
 * Carga perezosa (lazy-load) de los módulos ESM de Baileys v7.
 * Evita fallos de resolución CJS/ESM al iniciar el proceso Node.js.
 */
async function loadBaileys(): Promise<void> {
  if (baileysLoaded) return;
  const baileys = await import('@whiskeysockets/baileys');
  makeWASocket = baileys.default ?? (baileys as any).makeWASocket;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  Browsers = baileys.Browsers;
  baileysLoaded = true;
}

/** Ruta del sistema de archivos donde se almacenan las llaves de sesión criptográficas */
const authFolder = path.join(__dirname, '..', 'data', 'auth_info_baileys');

// ============================================================================
// ESTADO GLOBAL DEL SOCKET Y SUSCRIPTORES
// ============================================================================
let sock: any = null;
let connectionStatus: WhatsAppConnectionStatus = 'disconnected';
let currentQR: string | null = null;
let currentUser: any = null;
let statusChangeCallbacks: Array<(status: WhatsAppStatusPayload) => void> = [];
let liveMessageCallbacks: Array<(msg: any) => void> = [];
let followUpInterval: any = null;
let qrTimeoutCount = 0;
let reconnectTimer: any = null;
let botReady = false;
let botReadyTimer: any = null;

// ============================================================================
// COLA ESTOCÁSTICA SALIENTE (ANTI-BANEO META 2025)
// ============================================================================
const outboundQueue: OutboundQueueItem[] = [];
let isProcessingOutboundQueue = false;

/**
 * Encola un mensaje saliente para ser despachado con retardos aleatorios humanizados.
 * Utilizado principalmente por tareas programadas (seguimientos de compra y vencimiento de apartados).
 * 
 * @param targetJid - JID destinatario
 * @param messageText - Contenido del mensaje a despachar
 */
function enqueueOutboundMessage(targetJid: string, messageText: string): void {
  outboundQueue.push({ jid: targetJid, text: messageText });
  processOutboundQueue();
}

/**
 * Procesa secuencialmente los mensajes en la cola saliente aplicando pausas estocásticas
 * y emulando la presencia humana ("composing" y "paused") para evitar detección por Meta.
 */
async function processOutboundQueue(): Promise<void> {
  if (isProcessingOutboundQueue) return;
  isProcessingOutboundQueue = true;

  while (outboundQueue.length > 0) {
    const item = outboundQueue.shift();
    if (!item || !item.jid || !item.text) continue;

    try {
      // Validar si el cliente solicitó no ser molestado o si la conversación fue pausada por un asesor
      const session = db.prepare('SELECT no_molestar, bot_pausado FROM chat_sessions WHERE jid = ?').get(item.jid);
      if (session && (session.no_molestar === 1 || session.bot_pausado === 1)) {
        console.log(`[WhatsApp Queue] ⏸️ Mensaje a ${item.jid} omitido (marcado como no_molestar o pausado)`);
        continue;
      }

      if (connectionStatus === 'connected' && sock) {
        // [ANTI-BANEO] Simular presencia de escritura previa al envío
        try {
          await sock.sendPresenceUpdate('composing', item.jid);
        } catch (e: any) {}

        const typingDelay = 1500 + Math.floor(Math.random() * 1200);
        await new Promise(r => setTimeout(r, typingDelay));

        await sendTextMessage(item.jid, item.text);

        try {
          await sock.sendPresenceUpdate('paused', item.jid);
        } catch (e: any) {}
      }
    } catch (sendErr: any) {
      console.warn(`[WhatsApp Queue] Error enviando recordatorio a ${item.jid}:`, sendErr?.message || sendErr);
    }

    // [ANTI-BANEO] Retardo aleatorio de 3.5s a 6.5s entre mensajes encolados consecutivos
    const humanDelay = 3500 + Math.floor(Math.random() * 3000);
    await new Promise(r => setTimeout(r, humanDelay));
  }

  isProcessingOutboundQueue = false;
}

// ============================================================================
// BUFFERS Y CONTROL DE DUPLICADOS
// ============================================================================

/** Temporizadores por JID para colapsar mensajes enviados en ráfagas rápidas */
const messageDebounceTimers = new Map<string, any>();
/** Cola temporal de mensajes por JID acumulados durante la ventana de debouncing */
const messageDebounceQueues = new Map<string, any[]>();

/** Temporizador para consolidar mensajes recibidos mientras el servidor estuvo apagado */
let overnightCatchupTimer: any = null;
/** Registro de clientes que escribieron durante la noche o fuera de línea */
const overnightCatchupMap = new Map<string, any>();

/** Registro de identificadores de mensajes enviados por el bot para evitar bucles de eco */
const knownSentMessageIds = new Set<string>();

/**
 * Registra un ID de mensaje saliente con un TTL de 60 segundos para ignorar ecos en `messages.upsert`.
 * 
 * @param msgId - ID devuelto por el socket de Baileys
 */
function trackSentMessageId(msgId: string): void {
  if (!msgId) return;
  knownSentMessageIds.add(msgId);
  setTimeout(() => knownSentMessageIds.delete(msgId), 60000);
}

/**
 * Desempaqueta capas anidadas de mensajes en el protocolo de Baileys
 * (mensajes efímeros, visualización única, mensajes editados, interactivos, etc.).
 * 
 * @param msgContent - Objeto crudo del mensaje de Baileys
 * @returns El contenido del mensaje en su capa más interna
 */
function unwrapMessage(msgContent: any): any {
  if (!msgContent) return null;
  let current = msgContent;
  let depth = 0;
  while (depth < 8) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
    } else if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
    } else if (current.editedMessage?.message?.protocolMessage?.editedMessage) {
      current = current.editedMessage.message.protocolMessage.editedMessage;
    } else if (current.interactiveMessage?.body) {
      current = current.interactiveMessage;
    } else {
      break;
    }
    depth++;
  }
  return current;
}

/**
 * Extrae texto normalizado, metadatos y tipo multimedia de cualquier mensaje de WhatsApp.
 * Soporta botones interactivos modernos (Native Flow), listas y respuestas rápidas.
 * 
 * @param msg - Mensaje completo de Baileys
 * @returns Objeto con texto extraído, banderas de medios y contenido interno
 */
function extractMessageInfo(msg: any): { text: string; isMedia: boolean; mediaType: string | null; content: any } | null {
  if (!msg || !msg.message) return null;

  const content = unwrapMessage(msg.message);
  if (!content) return null;

  let isMedia = false;
  let mediaType: string | null = null;

  if (content.audioMessage) {
    isMedia = true;
    mediaType = 'audio';
  } else if (content.imageMessage) {
    isMedia = true;
    mediaType = 'image';
  } else if (content.stickerMessage) {
    isMedia = true;
    mediaType = 'sticker';
  } else if (content.videoMessage) {
    isMedia = true;
    mediaType = 'video';
  } else if (content.documentMessage) {
    isMedia = true;
    mediaType = 'document';
  }

  // Extracción de respuestas en botones interactivos de WhatsApp
  let interactiveText = '';
  if (content.interactiveResponseMessage) {
    const ir = content.interactiveResponseMessage;
    if (ir.body?.text) interactiveText = ir.body.text;
    if (ir.nativeFlowResponseMessage?.paramsJson) {
      try {
        const parsed = JSON.parse(ir.nativeFlowResponseMessage.paramsJson);
        interactiveText = parsed.id || parsed.title || parsed.display_text || interactiveText;
      } catch (_) {}
    }
  }

  const text = (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    interactiveText ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.buttonsResponseMessage?.selectedButtonId ||
    content.listResponseMessage?.singleSelectReply?.selectedRowId ||
    content.listResponseMessage?.title ||
    content.templateButtonReplyMessage?.selectedId ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  ).trim();

  return { text, isMedia, mediaType, content };
}

/**
 * Suscribe un callback a las actualizaciones de estado del socket de WhatsApp.
 */
function subscribeStatusChange(cb: (status: WhatsAppStatusPayload) => void): void {
  statusChangeCallbacks.push(cb);
  cb({
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  });
}

/**
 * Suscribe un callback a los mensajes en tiempo real para el Live Inbox.
 */
function subscribeLiveMessages(cb: (msg: any) => void): void {
  liveMessageCallbacks.push(cb);
}

/**
 * Emite el estado actual de la conexión a todos los observadores registrados.
 */
function notifyStatusChange(): void {
  const payload: WhatsAppStatusPayload = {
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  };
  statusChangeCallbacks.forEach(cb => {
    try { cb(payload); } catch (e) { console.error('Error in status callback:', e); }
  });
}

/**
 * Emite un evento de mensaje entrante/saliente a todos los observadores del Live Inbox.
 */
function notifyLiveMessage(msg: any): void {
  liveMessageCallbacks.forEach(cb => {
    try { cb(msg); } catch (e) { console.error('Error in message callback:', e); }
  });
}

let connectingTimeout: any = null;

// ============================================================================
// CICLO DE VIDA PRINCIPAL DEL SOCKET (startWhatsApp)
// ============================================================================

/**
 * Inicializa y gestiona la conexión con los servidores de WhatsApp mediante Baileys v7.
 * Maneja persistencia de credenciales multi-archivo, generación de QR en base64,
 * reconexión con backoff inteligente y suscripción a eventos de mensajería.
 */
async function startWhatsApp(): Promise<void> {
  // Carga perezosa de Baileys v7 ESM
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
  connectionStatus = 'connecting';
  currentQR = null;
  notifyStatusChange();

  // Temporizador de guardia: si pasan 20s en 'connecting' sin respuesta, volver a 'disconnected'
  if (connectingTimeout) clearTimeout(connectingTimeout);
  connectingTimeout = setTimeout(() => {
    if (connectionStatus === 'connecting') {
      console.log('[WhatsApp] Tiempo de espera de conexión agotado. Restableciendo estado a desconectado.');
      connectionStatus = 'disconnected';
      notifyStatusChange();
    }
  }, 20000);

  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end();
      } catch (e) { }
    }

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      // [ANTI-BANEO META 2025] Usar generador de perfiles dinámico para evitar fingerprints obsoletos
      browser: Browsers.windows('Desktop')
    });

    // Guardar credenciales de sesión en disco cada vez que se actualizan los tokens criptográficos
    sock.ev.on('creds.update', saveCreds);

    // Gestor de eventos de transición de conexión (QR, éxito, desconexión)
    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      // Código QR generado: convertir a Data URL en base64 para renderizar en el dashboard
      if (qr) {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        try {
          currentQR = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
          connectionStatus = 'qr_ready';
          console.log('[WhatsApp] Código QR generado, listo para escanear en la app');
          notifyStatusChange();
        } catch (qrErr: any) {
          console.error('[WhatsApp] Error generando código QR:', qrErr);
        }
      }

      // Conexión cerrada: determinar causa y evaluar reconexión
      if (connection === 'close') {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        const shouldReconnect = !isLoggedOut;

        console.log(`[WhatsApp] Conexión cerrada (status: ${statusCode}). Reconectar: ${shouldReconnect}`);

        // Si la sesión fue desvinculada (401), limpiar credenciales huérfanas en disco
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

        connectionStatus = 'disconnected';
        currentQR = null;
        currentUser = null;
        botReady = false;
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
        // Conexión exitosa y autenticada
        if (connectingTimeout) clearTimeout(connectingTimeout);
        qrTimeoutCount = 0;
        connectionStatus = 'connected';
        currentQR = null;
        const jid = sock.user?.id || '';
        const phone = jid.split(':')[0] || jid.split('@')[0];
        currentUser = {
          jid,
          phone,
          name: sock.user?.name || 'Crastur WhatsApp'
        };
        console.log(`[WhatsApp] ¡Conexión exitosa a WhatsApp! Sesión activa: ${phone}`);
        notifyStatusChange();

        // Ventana de estabilización: 20s para permitir sincronización inicial sin activar auto-respuestas
        botReady = false;
        if (botReadyTimer) clearTimeout(botReadyTimer);
        botReadyTimer = setTimeout(() => {
          botReady = true;
          console.log('[WhatsApp] ✅ Bot listo y activo. Respondiendo mensajes nuevos.');
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

    // Ingesta de historial durante la sincronización multi-dispositivo inicial
    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }: any) => {
      if (!messages || !Array.isArray(messages)) return;
      console.log(`[WhatsApp Sync] 📥 Sincronización histórica recibida: ${messages.length} mensajes.`);

      let ingestedCount = 0;
      for (const msg of messages) {
        const jid = msg.key?.remoteJid || '';
        if (!jid) continue;

        // Omitir grupos, canales, transmisiones y listas
        if (
          jid.endsWith('@g.us') ||
          jid.endsWith('@newsletter') ||
          jid.includes('@newsletter') ||
          jid.includes('broadcast') ||
          jid === 'status@broadcast'
        ) {
          continue;
        }

        // Solo procesar chats individuales directos
        if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) {
          continue;
        }

        const info = extractMessageInfo(msg);
        if (!info || (!info.text && !info.isMedia)) continue;

        const contentText = info.text || `[${info.mediaType || 'Multimedia'}]`;
        const msgTime = Number(msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000;
        const pushName = msg.pushName || 'Cliente';
        const isFromMe = !!msg.key.fromMe;
        const senderType = isFromMe ? 'asesor' : 'cliente';

        // Deduplicación en base de datos
        const existing = db.prepare(`
          SELECT id FROM chat_messages
          WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 10000
          LIMIT 1
        `).get(jid, contentText, msgTime);

        if (!existing) {
          try {
            db.prepare(`
              INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
              VALUES (?, ?, ?, ?)
            `).run(jid, senderType, contentText, msgTime);

            const session = db.prepare('SELECT jid, ultimo_mensaje_at FROM chat_sessions WHERE jid = ?').get(jid);
            if (!session) {
              db.prepare(`
                INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
                VALUES (?, ?, 'start', ?, 0, 0, 1)
              `).run(jid, pushName, msgTime);
            } else {
              db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = MAX(ultimo_mensaje_at, ?), push_name = COALESCE(?, push_name) WHERE jid = ?')
                .run(msgTime, pushName, jid);
            }
            ingestedCount++;
          } catch (e: any) { }
        }
      }

      if (ingestedCount > 0) {
        console.log(`[WhatsApp Sync] ✅ ${ingestedCount} mensajes históricos/nocturnos preservados en Live Inbox.`);
        notifyLiveMessage({ action: 'history_sync', count: ingestedCount });
      }
    });

    // ============================================================================
    // GESTIÓN DE MENSAJES ENTRANTES EN TIEMPO REAL
    // ============================================================================
    sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
      // Ignorar eventos 'append' (mensajes históricos sincronizados en segundo plano)
      if (type !== 'notify') return;
      if (!messages || !Array.isArray(messages)) return;

      for (const msg of messages) {
        const jid = msg.key?.remoteJid || '';
        if (!jid) continue;

        // Filtro estricto contra grupos, canales de WhatsApp y estados broadcast
        if (
          jid.endsWith('@g.us') ||
          jid.endsWith('@newsletter') ||
          jid.includes('@newsletter') ||
          jid.includes('broadcast') ||
          jid === 'status@broadcast'
        ) {
          continue;
        }

        // Admitir únicamente conversaciones 1-a-1 (@s.whatsapp.net o @lid)
        if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) {
          continue;
        }

        const botPhone = currentUser?.phone || (sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '');
        const senderPhone = jid.split(':')[0].split('@')[0];
        const isSelfChat = botPhone && senderPhone && (botPhone === senderPhone);

        // Mensaje enviado por el propio operador desde el móvil o WhatsApp Web
        if (msg.key.fromMe && !isSelfChat) {
          const msgId = msg.key?.id;
          if (msgId && knownSentMessageIds.has(msgId)) {
            knownSentMessageIds.delete(msgId);
            continue;
          }

          const info = extractMessageInfo(msg);
          if (info && (info.text || info.isMedia)) {
            const rawContent = info.text || `[${info.mediaType || 'Multimedia'}]`;
            const msgTime = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();
            const recent = db.prepare(`
              SELECT id FROM chat_messages 
              WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 6000
              LIMIT 1
            `).get(jid, rawContent, msgTime);

            if (!recent) {
              try {
                db.prepare(`
                  INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                  VALUES (?, 'asesor', ?, ?)
                `).run(jid, rawContent, msgTime);

                const session = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
                if (!session) {
                  db.prepare(`
                    INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
                    VALUES (?, 'Cliente', 'start', ?, 0, 0, 1)
                  `).run(jid, msgTime);
                } else {
                  db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = MAX(ultimo_mensaje_at, ?) WHERE jid = ?')
                    .run(msgTime, jid);
                }

                notifyLiveMessage({
                  jid,
                  pushName: 'Asesor Humano',
                  remitente: 'asesor',
                  contenido: rawContent,
                  timestamp: msgTime
                });
              } catch (e) { }
            }
          }
          continue;
        }

        // Mensaje entrante del cliente
        const messageTimestamp = msg.messageTimestamp;
        if (messageTimestamp) {
          const ageSec = Math.floor(Date.now() / 1000) - Number(messageTimestamp);

          // [ANTI-BANEO META 2025] Ventana de 24 horas: no responder mensajes con antigüedad mayor a 1 día
          if (ageSec > 24 * 3600) {
            continue;
          }

          // Mensaje acumulado mientras el servidor estuvo apagado (> 3 minutos de antigüedad)
          if (ageSec > 180) {
            const info = extractMessageInfo(msg);
            if (info && (info.text || info.isMedia)) {
              const pushName = msg.pushName || 'cliente';
              const msgTime = Number(messageTimestamp) * 1000;
              const contentText = info.text || `[${info.mediaType || 'Multimedia'}]`;

              // Registro en base de datos para lectura en Live Inbox
              const existing = db.prepare(`
                SELECT id FROM chat_messages
                WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 6000
                LIMIT 1
              `).get(jid, contentText, msgTime);

              if (!existing) {
                try {
                  db.prepare(`
                    INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                    VALUES (?, 'cliente', ?, ?)
                  `).run(jid, contentText, msgTime);

                  const exists = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
                  if (!exists) {
                    db.prepare(`
                      INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
                      VALUES (?, ?, 'start', ?, 0, 0, 1)
                    `).run(jid, pushName, msgTime);
                  } else {
                    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = MAX(ultimo_mensaje_at, ?), push_name = COALESCE(?, push_name) WHERE jid = ?')
                      .run(msgTime, pushName, jid);
                  }

                  notifyLiveMessage({
                    jid,
                    pushName,
                    remitente: 'cliente',
                    contenido: contentText,
                    timestamp: msgTime
                  });
                } catch (e) { }
              }

              if (info.text && info.text.trim().length > 1) {
                overnightCatchupMap.set(jid, { text: info.text.trim(), pushName });
              }

              // Saludo matutino condicional si la tienda se encuentra dentro de horario comercial
              if (overnightCatchupTimer) clearTimeout(overnightCatchupTimer);
              overnightCatchupTimer = setTimeout(async () => {
                if (overnightCatchupMap.size === 0) return;
                const entries = Array.from(overnightCatchupMap.entries());
                overnightCatchupMap.clear();

                if (!isWithinBusinessHours()) {
                  console.log('[WhatsApp] Mensajes nocturnos registrados en Live Inbox. La tienda física está fuera de horario.');
                  return;
                }

                console.log(`[WhatsApp] ☀️ Atendiendo ${entries.length} consultas acumuladas mientras la PC estuvo apagada...`);
                for (const [targetJid, clientData] of entries) {
                  // Verificar estado de pausa antes de responder automáticamente
                  if (isBotGloballyPaused()) {
                    console.log(`[WhatsApp] Mensaje nocturno de ${targetJid} omitido: bot pausado globalmente.`);
                    continue;
                  }
                  if (isBotPaused(targetJid)) {
                    console.log(`[WhatsApp] Mensaje nocturno de ${targetJid} omitido: chat pausado manualmente.`);
                    continue;
                  }

                  try {
                    const res: any = await processIncomingMessage(targetJid, clientData.text, clientData.pushName);
                    if (res) {
                      const rawReply = typeof res === 'object' && res.text ? res.text : String(res);
                      const morningReply = `¡Buenos días, *${clientData.pushName}*! 👋 Recibimos tu consulta mientras nuestra tienda física estaba cerrada. Ya estamos abiertos hoy de 8:00 AM a 8:00 PM con entrega inmediata en San Agustín Norte:\n\n${rawReply}`;

                      await sendTextMessage(targetJid, morningReply);
                      await new Promise(r => setTimeout(r, 2000));
                    }
                  } catch (mErr: any) {
                    console.error(`[WhatsApp] Error respondiendo mensaje matutino a ${targetJid}:`, mErr?.message || mErr);
                  }
                }
              }, 8000);
            }
            continue;
          }
        }

        // Extracción de contenido del mensaje entrante en tiempo real
        const info = extractMessageInfo(msg);
        if (!info) continue;

        const { text, isMedia, mediaType } = info;
        if (!text && !isMedia) continue;

        const pushName = msg.pushName || 'cliente';
        console.log(`[WhatsApp] 📥 Mensaje recibido de "${pushName}" (${jid}): "${text || `[${mediaType}]`}"`);

        // Notificar mensaje entrante a la interfaz en vivo
        notifyLiveMessage({
          jid,
          pushName,
          remitente: 'cliente',
          contenido: text || `[Mensaje ${mediaType}]`,
          timestamp: Date.now()
        });

        // ====================================================================
        // DEBOUNCING DE MENSAJES EN RÁFAGA (ANTI-FLOOD)
        // Agrupa múltiples mensajes cortos enviados sucesivamente en 1.2 segundos
        // ====================================================================
        if (!messageDebounceQueues.has(jid)) {
          messageDebounceQueues.set(jid, []);
        }

        messageDebounceQueues.get(jid)!.push({
          text,
          isMedia,
          mediaType,
          pushName
        });

        if (messageDebounceTimers.has(jid)) {
          clearTimeout(messageDebounceTimers.get(jid));
        }

        messageDebounceTimers.set(jid, setTimeout(async () => {
          const queue = messageDebounceQueues.get(jid) || [];
          messageDebounceQueues.delete(jid);
          messageDebounceTimers.delete(jid);

          if (queue.length === 0) return;

          // Consolidar todos los fragmentos recibidos en una sola cadena de consulta
          const combinedText = queue.map((q: any) => q.text).filter(Boolean).join(' ');
          const hasMediaOnly = !combinedText && queue.some((q: any) => q.isMedia);
          const firstMedia = queue.find((q: any) => q.isMedia);
          const activePushName = queue[queue.length - 1]?.pushName || pushName || 'amigo/a';

          console.log(`[WhatsApp Bot] ⚙️ Procesando consulta de ${activePushName} (${jid}): "${combinedText || '[Multimedia]'}"`);

          // Si el bot se encuentra aún en la ventana inicial de sincronización (20s), registrar sin responder
          if (!botReady) {
            console.log(`[WhatsApp Bot] ⏳ Bot en fase de inicio, mensaje de ${activePushName} registrado en inbox pero sin respuesta automática todavía.`);
            return;
          }

          try {
            const mediaParam = hasMediaOnly ? { isMedia: true, type: firstMedia.mediaType } : null;
            const response: any = await processIncomingMessage(jid, combinedText, activePushName, mediaParam);

            if (response) {
              console.log(`[WhatsApp Bot] 🤖 Simulando presencia de escritura para ${jid}...`);
              // [ANTI-BANEO] Simular presencia de escritura para emular operador humano
              try {
                if (sock && connectionStatus === 'connected') {
                  await sock.sendPresenceUpdate('composing', jid);
                }
              } catch (pErr: any) { }

              // Retardo de digitación natural proporcional (entre 1.2s y 2.2s)
              const typingDelay = Math.min(2200, 1200 + Math.floor(Math.random() * 800));
              await new Promise(res => setTimeout(res, typingDelay));

              console.log(`[WhatsApp Bot] 🤖 Despachando respuesta a ${jid}...`);

              if (typeof response === 'object' && response !== null && response.document) {
                await sendDocumentMessage(jid, response.document, response.fileName, response.caption, response.mimetype);
              } else if (typeof response === 'object' && response !== null && response.text) {
                await sendProductMessage(jid, response.text, response.image);
              } else if (typeof response === 'string') {
                await sendTextMessage(jid, response);
              }

              const responseText = typeof response === 'object' && response !== null
                ? (response.text || response.caption || '')
                : (response ? String(response) : '');

              // [MERCADO VENEZUELA] Si la respuesta refiere a la ubicación de la tienda física, despachar pin interactivo
              if (responseText && responseText.includes('Liberalba') && responseText.includes('Google Maps')) {
                try {
                  if (sock && connectionStatus === 'connected') {
                    await sock.sendMessage(jid, {
                      location: {
                        degreesLatitude: 10.5015,
                        degreesLongitude: -66.9015,
                        name: 'Crastur - Insumos Cauchera y Repuestos Moto',
                        address: 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas'
                      }
                    });
                    console.log(`[WhatsApp Bot] 📍 Pin de ubicación interactivo enviado a ${jid}`);
                  }
                } catch (locErr: any) {
                  console.warn('[WhatsApp Bot] No se pudo enviar pin interactivo:', locErr?.message || locErr);
                }
              }

              // Si el cliente solicita explícitamente guardar el contacto, enviar tarjeta vCard oficial
              const normInput = (combinedText || '').toLowerCase().trim();
              const explicitContactRequest =
                normInput === 'guardar contacto' ||
                normInput === 'guardar tu contacto' ||
                normInput === 'guardar su contacto' ||
                normInput === 'guardar numero' ||
                normInput === 'guardar tu numero' ||
                normInput.includes('como te guardo') ||
                normInput.includes('como los guardo') ||
                normInput.includes('como agrego el contacto') ||
                normInput.includes('dame tu contacto') ||
                normInput.includes('enviame tu contacto') ||
                normInput.includes('mandame el contacto') ||
                normInput.includes('quiero guardarte') ||
                normInput.includes('como guardo crastur');
              if (explicitContactRequest) {
                try {
                  if (sock && connectionStatus === 'connected') {
                    const botPhone = currentUser?.phone || (sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '584120000000');
                    const vcard = 'BEGIN:VCARD\n'
                      + 'VERSION:3.0\n'
                      + 'FN:Crastur - Repuestos e Insumos\n'
                      + 'ORG:Crastur Caracas;\n'
                      + `TEL;type=CELL;type=VOICE;waid=${botPhone}:+${botPhone}\n`
                      + 'NOTE:Tienda Física en San Agustín Norte - Insumos de Cauchera y Repuestos Moto\n'
                      + 'URL:https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA\n'
                      + 'END:VCARD';

                    await sock.sendMessage(jid, {
                      contacts: {
                        displayName: 'Crastur - Repuestos e Insumos',
                        contacts: [{ vcard }]
                      }
                    });
                    console.log(`[WhatsApp Bot] 📇 Tarjeta de contacto oficial enviada a ${jid}`);
                  }
                } catch (cardErr: any) {
                  console.warn('[WhatsApp Bot] No se pudo enviar tarjeta de contacto:', cardErr?.message || cardErr);
                }
              }

              try {
                if (sock && connectionStatus === 'connected') {
                  await sock.sendPresenceUpdate('paused', jid);
                }
              } catch (pErr: any) { }

              console.log(`[WhatsApp Bot] ✅ Respuesta enviada exitosamente a ${jid}`);
            } else {
              console.log(`[WhatsApp Bot] ℹ️ Sin respuesta automática para ${jid} (chat pausado manualmente)`);
            }
          } catch (engineErr: any) {
            console.error('[WhatsApp Bot] ❌ Error procesando o enviando respuesta:', engineErr);
          }
        }, 1200));
      }
    });

  } catch (initErr: any) {
    console.error('[WhatsApp] Error al inicializar socket (sin internet o conexión inestable):', initErr?.message || initErr);
    connectionStatus = 'disconnected';
    notifyStatusChange();
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startWhatsApp();
      }, 8000);
    }
  }
}

// ============================================================================
// FUNCIONES DE DESPACHO DE MENSAJES Y MEDIOS
// ============================================================================

/**
 * Envía un mensaje con imagen de producto (Base64 o URL remota) y pie de foto.
 * Si falla el envío de la imagen o no se especifica, recurre a mensaje de texto normal.
 * 
 * @param jid - JID destinatario
 * @param text - Texto descriptivo del producto
 * @param imageUrl - URL HTTP/S o Base64 Data URL de la imagen
 */
async function sendProductMessage(jid: string, text: string, imageUrl?: string): Promise<void> {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const cleanText = standardizeBotMessage(text);
  let sent = false;
  let sentMsg: any = null;

  if (imageUrl && typeof imageUrl === 'string') {
    try {
      if (imageUrl.startsWith('data:image/')) {
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        sentMsg = await sock.sendMessage(jid, { image: imageBuffer, caption: cleanText });
        sent = true;
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        sentMsg = await sock.sendMessage(jid, { image: { url: imageUrl }, caption: cleanText });
        sent = true;
      }
    } catch (imgErr: any) {
      console.warn('[WhatsApp] No se pudo enviar la imagen adjunta, enviando texto plano:', imgErr?.message || imgErr);
    }
  }

  if (!sent) {
    sentMsg = await sock.sendMessage(jid, { text: cleanText });
  }

  if (sentMsg?.key?.id) {
    trackSentMessageId(sentMsg.key.id);
  }

  // Registrar en base de datos como mensaje saliente del BOT
  const now = Date.now();
  let insertId = null;
  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'bot', ?, ?)
    `).run(jid, cleanText, now);
    insertId = res?.lastInsertRowid;

    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(now, jid);
  } catch (e: any) { }

  notifyLiveMessage({
    id: insertId,
    jid,
    pushName: 'Crastur Bot',
    remitente: 'bot',
    contenido: cleanText,
    timestamp: now
  });
}

/**
 * Envía un documento (p. ej. catálogo PDF) adjunto por WhatsApp.
 * 
 * @param jid - JID destinatario
 * @param documentPathOrBuffer - Ruta absoluta al archivo o Buffer binario
 * @param fileName - Nombre que se mostrará al cliente
 * @param caption - Pie de foto opcional
 * @param mimetype - Tipo MIME del archivo (por defecto 'application/pdf')
 */
async function sendDocumentMessage(
  jid: string,
  documentPathOrBuffer: string | Buffer | any,
  fileName: string = 'Catalogo_Crastur.pdf',
  caption: string = '',
  mimetype: string = 'application/pdf'
): Promise<any> {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const cleanCaption = caption ? standardizeBotMessage(caption) : '';
  let docBuffer: Buffer;

  if (Buffer.isBuffer(documentPathOrBuffer)) {
    docBuffer = documentPathOrBuffer;
  } else if (typeof documentPathOrBuffer === 'string') {
    if (fs.existsSync(documentPathOrBuffer)) {
      docBuffer = fs.readFileSync(documentPathOrBuffer);
    } else {
      throw new Error(`Archivo de documento no encontrado: ${documentPathOrBuffer}`);
    }
  } else {
    throw new Error('Formato de documento inválido');
  }

  const messagePayload: any = {
    document: docBuffer,
    mimetype: mimetype || 'application/pdf',
    fileName: fileName || 'Catalogo_Crastur.pdf'
  };

  if (cleanCaption) {
    messagePayload.caption = cleanCaption;
  }

  const sentMsg = await sock.sendMessage(jid, messagePayload);

  if (sentMsg?.key?.id) {
    trackSentMessageId(sentMsg.key.id);
  }

  const now = Date.now();
  let insertId = null;
  const loggedText = cleanCaption ? `[Documento PDF: ${fileName}] ${cleanCaption}` : `[Documento PDF: ${fileName}]`;

  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'bot', ?, ?)
    `).run(jid, loggedText, now);
    insertId = res?.lastInsertRowid;

    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(now, jid);
  } catch (e: any) { }

  notifyLiveMessage({
    id: insertId,
    jid,
    pushName: 'Crastur Bot',
    remitente: 'bot',
    contenido: loggedText,
    timestamp: now
  });

  return sentMsg;
}

/**
 * Envía un mensaje de texto automático generado por el bot.
 * 
 * @param jid - JID destinatario
 * @param text - Texto a enviar
 */
async function sendTextMessage(jid: string, text: string): Promise<void> {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const cleanText = standardizeBotMessage(text);
  const sentMsg = await sock.sendMessage(jid, { text: cleanText });

  if (sentMsg?.key?.id) {
    trackSentMessageId(sentMsg.key.id);
  }

  const now = Date.now();
  let insertId = null;
  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'bot', ?, ?)
    `).run(jid, cleanText, now);
    insertId = res?.lastInsertRowid;

    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(now, jid);
  } catch (e: any) { }

  notifyLiveMessage({
    id: insertId,
    jid,
    pushName: 'Crastur Bot',
    remitente: 'bot',
    contenido: cleanText,
    timestamp: now
  });
}

/**
 * Envía un mensaje redactado manualmente por un asesor humano desde el Live Inbox.
 * 
 * @param jid - JID destinatario
 * @param text - Texto manual del asesor
 */
async function sendManualMessage(jid: string, text: string): Promise<{ success: boolean; id: any; timestamp: number }> {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const sentMsg = await sock.sendMessage(jid, { text });

  if (sentMsg?.key?.id) {
    trackSentMessageId(sentMsg.key.id);
  }

  const now = Date.now();
  let insertId = null;
  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'asesor', ?, ?)
    `).run(jid, text, now);
    insertId = res?.lastInsertRowid;

    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(now, jid);
  } catch (e: any) { }

  notifyLiveMessage({
    id: insertId,
    jid,
    pushName: 'Asesor Humano',
    remitente: 'asesor',
    contenido: text,
    timestamp: now
  });

  return { success: true, id: insertId, timestamp: now };
}

/**
 * Cierra la sesión activa de WhatsApp y purga las credenciales del sistema de archivos.
 */
async function logoutWhatsApp(): Promise<void> {
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

  connectionStatus = 'disconnected';
  currentQR = null;
  currentUser = null;
  notifyStatusChange();
  console.log('[WhatsApp] Sesión cerrada y credenciales eliminadas.');
}

/**
 * Ejecuta un reseteo forzoso del socket, eliminando credenciales corruptas y forzando
 * un nuevo código QR limpio para escanear.
 */
async function resetWhatsApp(): Promise<{ success: boolean; message: string }> {
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
      sock = null;
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

  connectionStatus = 'disconnected';
  currentQR = null;
  currentUser = null;
  notifyStatusChange();

  await startWhatsApp();
  return { success: true, message: 'WhatsApp reseteado con éxito, generando nuevo QR...' };
}

/**
 * Obtiene el estado consolidado de la conexión actual.
 */
function getStatus(): WhatsAppStatusPayload {
  return {
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  };
}

/**
 * Detiene la conexión del socket y limpia todos los temporizadores asociados.
 */
function stopWhatsApp(): void {
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
      sock = null;
    }
  } catch (e: any) {}
  connectionStatus = 'disconnected';
  currentQR = null;
  currentUser = null;
  notifyStatusChange();
}

export {
  startWhatsApp,
  stopWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  getStatus,
  sendTextMessage,
  sendProductMessage,
  sendDocumentMessage,
  sendManualMessage,
  subscribeStatusChange,
  subscribeLiveMessages
};

export default {
  startWhatsApp,
  stopWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  getStatus,
  sendTextMessage,
  sendProductMessage,
  sendDocumentMessage,
  sendManualMessage,
  subscribeStatusChange,
  subscribeLiveMessages
};
