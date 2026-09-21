const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { processIncomingMessage, checkPendingFollowUps } = require('./botEngine');
const { db, recordMetric, cleanExpiredReservations } = require('./database');

const authFolder = path.join(__dirname, '..', 'data', 'auth_info_baileys');

let sock = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let currentQR = null;
let currentUser = null;
let statusChangeCallbacks = [];
let liveMessageCallbacks = [];
let followUpInterval = null;

// Buffer de Debounce Anti-Spam para ráfagas de mensajes rápidos
const messageDebounceTimers = new Map();
const messageDebounceQueues = new Map();

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
      } catch (e) {}
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
              fs.rmSync(authFolder, { recursive: true, force: true });
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

        if (shouldReconnect) {
          setTimeout(() => {
            startWhatsApp();
          }, 4000);
        }
      } else if (connection === 'open') {
        if (connectingTimeout) clearTimeout(connectingTimeout);
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
              checkPendingFollowUps(async (targetJid, messageText) => {
                await sendTextMessage(targetJid, messageText);
              });
            }
          }, 60 * 1000);
        }
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

        // Si el mensaje es muy antiguo (sincronización inicial de historial mayor a 5 minutos), ignorarlo
        const messageTimestamp = msg.messageTimestamp;
        if (messageTimestamp) {
          const ageSec = Math.floor(Date.now() / 1000) - Number(messageTimestamp);
          if (ageSec > 300) {
            continue;
          }
        }

        // Detectar si el usuario se escribió a sí mismo para probar el bot
        const botPhone = currentUser?.phone || (sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '');
        const senderPhone = jid.split(':')[0].split('@')[0];
        const isSelfChat = botPhone && senderPhone && (botPhone === senderPhone);

        // Si el mensaje fue enviado por la cuenta pero NO en auto-chat, es el asesor humano atendiendo a un cliente
        if (msg.key.fromMe && !isSelfChat) {
          const info = extractMessageInfo(msg);
          if (info && (info.text || info.isMedia)) {
            try {
              db.prepare(`
                INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                VALUES (?, 'asesor', ?, ?)
              `).run(jid, info.text || `[${info.mediaType || 'Multimedia'}]`, Date.now());
            } catch (e) {}
          }
          continue;
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
            const response = processIncomingMessage(jid, combinedText, activePushName, mediaParam);

            if (response) {
              await new Promise(res => setTimeout(res, 500));
              console.log(`[WhatsApp Bot] 🤖 Enviando respuesta a ${jid}...`);

              if (typeof response === 'object' && response !== null && response.text) {
                await sendProductMessage(jid, response.text, response.image);
              } else if (typeof response === 'string') {
                await sendTextMessage(jid, response);
              }
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
    console.error('[WhatsApp] Error al inicializar socket:', initErr);
    connectionStatus = 'disconnected';
    notifyStatusChange();
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

  let sent = false;

  if (imageUrl && typeof imageUrl === 'string') {
    try {
      if (imageUrl.startsWith('data:image/')) {
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        await sock.sendMessage(jid, { image: imageBuffer, caption: text });
        sent = true;
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        await sock.sendMessage(jid, { image: { url: imageUrl }, caption: text });
        sent = true;
      }
    } catch (imgErr) {
      console.warn('[WhatsApp] No se pudo enviar la imagen adjunta, enviando texto plano:', imgErr.message);
    }
  }

  if (!sent) {
    await sock.sendMessage(jid, { text });
  }

  notifyLiveMessage({
    jid,
    pushName: 'Crastur Bot',
    remitente: 'bot',
    contenido: text,
    timestamp: Date.now()
  });
}

async function sendTextMessage(jid, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  await sock.sendMessage(jid, { text });

  notifyLiveMessage({
    jid,
    pushName: 'Crastur Bot',
    remitente: 'bot',
    contenido: text,
    timestamp: Date.now()
  });
}

async function sendManualMessage(jid, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp no está conectado');
  }

  await sock.sendMessage(jid, { text });

  // Guardar en base de datos como mensaje de asesor humano
  db.prepare(`
    INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
    VALUES (?, 'asesor', ?, ?)
  `).run(jid, text, Date.now());

  notifyLiveMessage({
    jid,
    pushName: 'Asesor Humano',
    remitente: 'asesor',
    contenido: text,
    timestamp: Date.now()
  });

  return { success: true };
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
      fs.rmSync(authFolder, { recursive: true, force: true });
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
  if (connectingTimeout) clearTimeout(connectingTimeout);

  try {
    if (sock) {
      sock.ev.removeAllListeners();
      sock.end();
      sock = null;
    }
  } catch (e) {}

  try {
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
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

module.exports = {
  startWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  getStatus,
  sendTextMessage,
  sendProductMessage,
  sendManualMessage,
  subscribeStatusChange,
  subscribeLiveMessages
};
