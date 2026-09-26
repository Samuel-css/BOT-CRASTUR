const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { processIncomingMessage, checkPendingFollowUps, check22hReservationReminders } = require('./botEngine');
const { db, recordMetric, cleanExpiredReservations } = require('./database');
const { standardizeBotMessage } = require('./bot/utils/textUtils');

const authFolder = path.join(__dirname, '..', 'data', 'auth_info_baileys');

let sock = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let currentQR = null;
let currentUser = null;
let statusChangeCallbacks = [];
let liveMessageCallbacks = [];
let followUpInterval = null;
let qrTimeoutCount = 0;
let reconnectTimer = null;

// Buffer de Debounce Anti-Spam para ráfagas de mensajes rápidos
const messageDebounceTimers = new Map();
const messageDebounceQueues = new Map();

// Buffer para mensajes acumulados mientras la PC estuvo apagada (anoche / cortes de luz)
let overnightCatchupTimer = null;
const overnightCatchupMap = new Map();

// Registro de IDs de mensajes enviados por el sistema para evitar duplicados y ecos de fromMe
const knownSentMessageIds = new Set();
function trackSentMessageId(msgId) {
  if (!msgId) return;
  knownSentMessageIds.add(msgId);
  setTimeout(() => knownSentMessageIds.delete(msgId), 60000);
}

/**
 * Desempaqueta capas anidadas de Baileys (ephemeralMessage, viewOnce, etc.)
 */
function unwrapMessage(msgContent) {
  if (!msgContent) return null;
  let current = msgContent;
  let depth = 0;
  while (depth < 6) {
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
    } else {
      break;
    }
    depth++;
  }
  return current;
}

/**
 * Extrae de forma exhaustiva el texto y tipo multimedia de un mensaje de Baileys
 */
function extractMessageInfo(msg) {
  if (!msg || !msg.message) return null;

  const content = unwrapMessage(msg.message);
  if (!content) return null;

  let isMedia = false;
  let mediaType = null;

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

  const text = (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
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

function subscribeStatusChange(cb) {
  statusChangeCallbacks.push(cb);
  cb({
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  });
}

function subscribeLiveMessages(cb) {
  liveMessageCallbacks.push(cb);
}

function notifyStatusChange() {
  const payload = {
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  };
  statusChangeCallbacks.forEach(cb => {
    try { cb(payload); } catch (e) { console.error('Error in status callback:', e); }
  });
}

function notifyLiveMessage(msg) {
  liveMessageCallbacks.forEach(cb => {
    try { cb(msg); } catch (e) { console.error('Error in message callback:', e); }
  });
}

let connectingTimeout = null;

async function startWhatsApp() {
  if (connectionStatus === 'connected') {
    console.log('[WhatsApp] Ya está conectado.');
    return;
  }

  // Si ya estaba en connecting pero pasaron más de 15s sin respuesta, permitir reintentar
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
      browser: ['Crastur Bot', 'Chrome', '120.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        try {
          currentQR = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
          connectionStatus = 'qr_ready';
          console.log('[WhatsApp] Código QR generado, listo para escanear en la app');
          notifyStatusChange();
        } catch (qrErr) {
          console.error('[WhatsApp] Error generando código QR:', qrErr);
        }
      }

      if (connection === 'close') {
        if (connectingTimeout) clearTimeout(connectingTimeout);
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        const shouldReconnect = !isLoggedOut;

        console.log(`[WhatsApp] Conexión cerrada (status: ${statusCode}). Reconectar: ${shouldReconnect}`);

        // Si fue 401 (desvinculado/logged out), limpiar credenciales corruptas para permitir generar un nuevo QR limpio
        if (isLoggedOut) {
          console.log('[WhatsApp] Sesión desvinculada (401). Limpiando credenciales obsoletas para permitir nuevo QR...');
          try {
            if (fs.existsSync(authFolder)) {
              fs.rmSync(authFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
            }
          } catch (rmErr) {
            console.error('[WhatsApp] Error limpiando credenciales desvinculadas:', rmErr);
          }
        }

        connectionStatus = 'disconnected';
        currentQR = null;
        currentUser = null;
        notifyStatusChange();

        if (followUpInterval) {
          clearInterval(followUpInterval);
          followUpInterval = null;
        }

        // Freno inteligente al bucle de escaneo QR (error 408)
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

        // Iniciar chequeo de insistencia periódica y limpieza de apartados vencidos (cada 1 minuto)
        if (!followUpInterval) {
          followUpInterval = setInterval(() => {
            // Limpieza estricta de apartados que superaron las 24 horas
            try {
              cleanExpiredReservations();
            } catch (err) {
              console.error('[Apartados] Error al limpiar vencidos:', err.message);
            }

            if (connectionStatus === 'connected' && sock) {
              if (typeof check22hReservationReminders === 'function') {
                check22hReservationReminders(async (targetJid, messageText) => {
                  await sendTextMessage(targetJid, messageText);
                });
              }

              checkPendingFollowUps(async (targetJid, messageText) => {
                await sendTextMessage(targetJid, messageText);
              });
            }
          }, 60 * 1000);
        }
      }
    });

    // Ingestar historial reciente al conectar (sincronización de WhatsApp multi-dispositivo)
    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
      if (!messages || !Array.isArray(messages)) return;
      console.log(`[WhatsApp Sync] 📥 Sincronización histórica recibida: ${messages.length} mensajes.`);

      let ingestedCount = 0;
      for (const msg of messages) {
        const jid = msg.key?.remoteJid || '';
        if (!jid) continue;

        if (
          jid.endsWith('@g.us') ||
          jid.endsWith('@newsletter') ||
          jid.includes('@newsletter') ||
          jid.includes('broadcast') ||
          jid === 'status@broadcast'
        ) {
          continue;
        }

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

        // Comprobar si ya existe para no duplicar
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
          } catch (e) { }
        }
      }

      if (ingestedCount > 0) {
        console.log(`[WhatsApp Sync] ✅ ${ingestedCount} mensajes históricos/nocturnos preservados en Live Inbox.`);
        notifyLiveMessage({ action: 'history_sync', count: ingestedCount });
      }
    });

    // Escuchar mensajes entrantes
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      if (!messages || !Array.isArray(messages)) return;

      for (const msg of messages) {
        const jid = msg.key?.remoteJid || '';
        if (!jid) continue;

        // ================= PROTECCIÓN TOTAL CONTRA GRUPOS Y CANALES =================
        // Se ignoran estrictamente grupos (@g.us), canales (@newsletter), estados (status@broadcast) y listas de difusión
        if (
          jid.endsWith('@g.us') ||
          jid.endsWith('@newsletter') ||
          jid.includes('@newsletter') ||
          jid.includes('broadcast') ||
          jid === 'status@broadcast'
        ) {
          continue;
        }

        // Solo permitir chats individuales (@s.whatsapp.net o los nuevos @lid de WhatsApp multi-dispositivo)
        if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) {
          continue;
        }

        // Detectar si el usuario se escribió a sí mismo para probar el bot
        const botPhone = currentUser?.phone || (sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '');
        const senderPhone = jid.split(':')[0].split('@')[0];
        const isSelfChat = botPhone && senderPhone && (botPhone === senderPhone);

        // PRIMERO: Si el mensaje fue enviado por el propio asesor desde el celular o web
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

        // Si el mensaje es entrante del cliente y llegó mientras la PC estuvo apagada (sincronización)
        const messageTimestamp = msg.messageTimestamp;
        if (messageTimestamp) {
          const ageSec = Math.floor(Date.now() / 1000) - Number(messageTimestamp);

          // Si tiene más de 48 horas, ignorar para no desempolvar chats muy viejos
          if (ageSec > 48 * 3600) {
            continue;
          }

          // Si tiene más de 3 minutos (llegó mientras la computadora estuvo apagada)
          if (ageSec > 180) {
            const info = extractMessageInfo(msg);
            if (info && (info.text || info.isMedia)) {
              const pushName = msg.pushName || 'cliente';
              const msgTime = Number(messageTimestamp) * 1000;
              const contentText = info.text || `[${info.mediaType || 'Multimedia'}]`;

              // Deduplicación para no guardar dos veces
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

              // Programar respuesta matutina si la tienda abre
              if (overnightCatchupTimer) clearTimeout(overnightCatchupTimer);
              overnightCatchupTimer = setTimeout(async () => {
                if (overnightCatchupMap.size === 0) return;
                const entries = Array.from(overnightCatchupMap.entries());
                overnightCatchupMap.clear();

                const { isWithinBusinessHours } = require('./bot/services/businessRules');
                if (!isWithinBusinessHours()) {
                  console.log('[WhatsApp] Mensajes nocturnos registrados en Live Inbox. La tienda física está fuera de horario.');
                  return;
                }

                console.log(`[WhatsApp] ☀️ Atendiendo ${entries.length} consultas acumuladas mientras la PC estuvo apagada...`);
                for (const [targetJid, clientData] of entries) {
                  try {
                    const res = processIncomingMessage(targetJid, clientData.text, clientData.pushName);
                    if (res) {
                      const rawReply = typeof res === 'object' && res.text ? res.text : String(res);
                      const morningReply = `¡Buenos días, *${clientData.pushName}*! 👋 Recibimos tu consulta mientras nuestra tienda física estaba cerrada. Ya estamos abiertos hoy de 8:00 AM a 8:00 PM con entrega inmediata en San Agustín Norte:\n\n${rawReply}`;

                      await sendTextMessage(targetJid, morningReply);
                      await new Promise(r => setTimeout(r, 2000));
                    }
                  } catch (mErr) {
                    console.error(`[WhatsApp] Error respondiendo mensaje matutino a ${targetJid}:`, mErr.message);
                  }
                }
              }, 8000);
            }
            continue;
          }
        }

        // Extraer contenido real del mensaje desempacando capas (ephemeral, viewOnce, etc.)
        const info = extractMessageInfo(msg);
        if (!info) continue;

        const { text, isMedia, mediaType } = info;
        if (!text && !isMedia) continue;

        const pushName = msg.pushName || 'cliente';
        console.log(`[WhatsApp] 📥 Mensaje recibido de "${pushName}" (${jid}): "${text || `[${mediaType}]`}"`);

        // Notificar mensaje a la UI en vivo
        notifyLiveMessage({
          jid,
          pushName,
          remitente: 'cliente',
          contenido: text || `[Mensaje ${mediaType}]`,
          timestamp: Date.now()
        });

        // ================= ANTI-SPAM DEBOUNCE =================
        // Si el cliente envía varios mensajes en ráfaga rápida (1.2s), los agrupamos
        if (!messageDebounceQueues.has(jid)) {
          messageDebounceQueues.set(jid, []);
        }

        messageDebounceQueues.get(jid).push({
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

          // Combinar todos los textos recibidos en la ráfaga
          const combinedText = queue.map(q => q.text).filter(Boolean).join(' ');
          const hasMediaOnly = !combinedText && queue.some(q => q.isMedia);
          const firstMedia = queue.find(q => q.isMedia);
          const activePushName = queue[queue.length - 1]?.pushName || pushName || 'amigo/a';

          console.log(`[WhatsApp Bot] ⚙️ Procesando consulta de ${activePushName} (${jid}): "${combinedText || '[Multimedia]'}"`);

          try {
            const mediaParam = hasMediaOnly ? { isMedia: true, type: firstMedia.mediaType } : null;
            const response = await processIncomingMessage(jid, combinedText, activePushName, mediaParam);

            if (response) {
              console.log(`[WhatsApp Bot] 🤖 Simulando presencia de escritura para ${jid}...`);
              // Presencia "Escribiendo..." para emular comportamiento humano anti-baneo
              try {
                if (sock && connectionStatus === 'connected') {
                  await sock.sendPresenceUpdate('composing', jid);
                }
              } catch (pErr) { }

              // Retardo natural humanizado (entre 1.2s y 2.2s según longitud)
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

              // 1. Si es respuesta de ubicación física, enviar además el Pin de mapa interactivo de WhatsApp
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
                } catch (locErr) {
                  console.warn('[WhatsApp Bot] No se pudo enviar pin interactivo:', locErr.message);
                }
              }

              // 2. Si el cliente pide guardar contacto o el número oficial, enviar la tarjeta vCard lista para guardar
              const normInput = (combinedText || '').toLowerCase();
              if (normInput.includes('contacto') || normInput.includes('guardar') || normInput.includes('numero') || normInput.includes('telefono')) {
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
                } catch (cardErr) {
                  console.warn('[WhatsApp Bot] No se pudo enviar tarjeta de contacto:', cardErr.message);
                }
              }

              try {
                if (sock && connectionStatus === 'connected') {
                  await sock.sendPresenceUpdate('paused', jid);
                }
              } catch (pErr) { }

              console.log(`[WhatsApp Bot] ✅ Respuesta enviada exitosamente a ${jid}`);
            } else {
              console.log(`[WhatsApp Bot] ℹ️ Sin respuesta automática para ${jid} (chat pausado manualmente)`);
            }
          } catch (engineErr) {
            console.error('[WhatsApp Bot] ❌ Error procesando o enviando respuesta:', engineErr);
          }
        }, 1200));
      }
    });

  } catch (initErr) {
    console.error('[WhatsApp] Error al inicializar socket (sin internet o conexión inestable):', initErr.message || initErr);
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

/**
 * Envía mensaje con foto de producto (URL o Base64) y descripción como pie de foto.
 * Si no tiene imagen o falla el envío de la foto, envía texto normal.
 */
async function sendProductMessage(jid, text, imageUrl) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const cleanText = standardizeBotMessage(text);
  let sent = false;
  let sentMsg = null;

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
    } catch (imgErr) {
      console.warn('[WhatsApp] No se pudo enviar la imagen adjunta, enviando texto plano:', imgErr.message);
    }
  }

  if (!sent) {
    sentMsg = await sock.sendMessage(jid, { text: cleanText });
  }

  if (sentMsg?.key?.id) {
    trackSentMessageId(sentMsg.key.id);
  }

  // Guardar en base de datos como mensaje del BOT
  const now = Date.now();
  let insertId = null;
  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'bot', ?, ?)
    `).run(jid, cleanText, now);
    insertId = res?.lastInsertRowid;

    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(now, jid);
  } catch (e) { }

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
 * Envía documento (PDF) por WhatsApp con nombre de archivo y pie de foto opcional.
 */
async function sendDocumentMessage(jid, documentPathOrBuffer, fileName = 'Catalogo_Crastur.pdf', caption = '', mimetype = 'application/pdf') {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const cleanCaption = caption ? standardizeBotMessage(caption) : '';
  let docBuffer;

  if (Buffer.isBuffer(documentPathOrBuffer)) {
    docBuffer = documentPathOrBuffer;
  } else if (typeof documentPathOrBuffer === 'string') {
    const fs = require('fs');
    if (fs.existsSync(documentPathOrBuffer)) {
      docBuffer = fs.readFileSync(documentPathOrBuffer);
    } else {
      throw new Error(`Archivo de documento no encontrado: ${documentPathOrBuffer}`);
    }
  } else {
    throw new Error('Formato de documento inválido');
  }

  const messagePayload = {
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
  } catch (e) { }

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

async function sendTextMessage(jid, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const cleanText = standardizeBotMessage(text);
  const sentMsg = await sock.sendMessage(jid, { text: cleanText });

  if (sentMsg?.key?.id) {
    trackSentMessageId(sentMsg.key.id);
  }

  // Guardar en base de datos como mensaje del BOT
  const now = Date.now();
  let insertId = null;
  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'bot', ?, ?)
    `).run(jid, cleanText, now);
    insertId = res?.lastInsertRowid;

    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(now, jid);
  } catch (e) { }

  notifyLiveMessage({
    id: insertId,
    jid,
    pushName: 'Crastur Bot',
    remitente: 'bot',
    contenido: cleanText,
    timestamp: now
  });
}

async function sendManualMessage(jid, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  const sentMsg = await sock.sendMessage(jid, { text });

  if (sentMsg?.key?.id) {
    trackSentMessageId(sentMsg.key.id);
  }

  // Guardar en base de datos como mensaje de asesor humano
  const now = Date.now();
  let insertId = null;
  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'asesor', ?, ?)
    `).run(jid, text, now);
    insertId = res?.lastInsertRowid;

    db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(now, jid);
  } catch (e) { }

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

async function logoutWhatsApp() {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (e) {
    console.log('[WhatsApp] Error al cerrar sesión:', e.message);
  }

  try {
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  } catch (rmErr) {
    console.error('[WhatsApp] Error borrando credenciales:', rmErr);
  }

  connectionStatus = 'disconnected';
  currentQR = null;
  currentUser = null;
  notifyStatusChange();
  console.log('[WhatsApp] Sesión cerrada y credenciales eliminadas.');
}

/**
 * Reseteo forzoso de WhatsApp: elimina credenciales zombies, cierra sockets y fuerza nuevo QR limpio
 */
async function resetWhatsApp() {
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
  } catch (e) { }

  // En Windows: pequeña pausa para que el sistema operativo libere los descriptores de archivo
  await new Promise(r => setTimeout(r, 400));

  try {
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      console.log('[WhatsApp] Carpeta de credenciales auth_info_baileys eliminada.');
    }
  } catch (rmErr) {
    console.error('[WhatsApp] Error limpiando credenciales en reseteo:', rmErr);
  }

  connectionStatus = 'disconnected';
  currentQR = null;
  currentUser = null;
  notifyStatusChange();

  // Iniciar socket limpio de inmediato para generar QR fresco
  await startWhatsApp();
  return { success: true, message: 'WhatsApp reseteado con éxito, generando nuevo QR...' };
}

function getStatus() {
  return {
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  };
}

function stopWhatsApp() {
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
  } catch (e) {}
  connectionStatus = 'disconnected';
  currentQR = null;
  currentUser = null;
  notifyStatusChange();
}

module.exports = {
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

