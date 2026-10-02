/**
 * @file ingest.ts
 * @description Ingestión de eventos entrantes de Baileys: historial multi-dispositivo y
 * mensajes en vivo con debouncing anti-flood, catch-up nocturno y cola de arranque.
 * Adapta la lógica histórica de whatsappService.ts sin cambiar su comportamiento.
 */

import { db, isBotGloballyPaused, isBotPaused } from '../database';
import { processIncomingMessage } from '../bot';
import { isWithinBusinessHours } from '../bot/services/businessRules';
import {
  sock,
  connectionStatus,
  currentUser,
  notifyLiveMessage
} from './socketState';
import { extractMessageInfo } from './messageParsing';
import { sendTextMessage, wasSentByBot, consumeSentMessageId } from './sending';

// ─── Buffers y control de duplicados ────────────────────────────────────────
const messageDebounceTimers = new Map<string, any>();
const messageDebounceQueues = new Map<string, any[]>();

let overnightCatchupTimer: any = null;
const overnightCatchupMap = new Map<string, any>();

/** Consultas recibidas durante la ventana de estabilización (20s) pendientes de responder. */
const pendingStartupMessages: Array<{
  jid: string;
  combinedText: string;
  pushName: string;
  hasMediaOnly: boolean;
  firstMedia: any;
}> = [];

/** Referencia mutable al estado botReady (inyectada desde connection.ts). */
let botReadyRef = { value: false };
export function bindBotReady(ref: { value: boolean }): void { botReadyRef = ref; }

/**
 * [ROBUSTEZ] Genera y despacha la respuesta del bot a una consulta ya consolidada.
 */
async function deliverBotResponse(
  jid: string,
  combinedText: string,
  pushName: string,
  hasMediaOnly: boolean,
  firstMedia: any
): Promise<void> {
  try {
    const mediaParam = hasMediaOnly ? { isMedia: true, type: firstMedia?.mediaType } : null;
    const response: any = await processIncomingMessage(jid, combinedText, pushName, mediaParam);

    if (response) {
      console.log(`[WhatsApp Bot] 🤖 Simulando presencia de escritura para ${jid}...`);
      try {
        if (sock && connectionStatus === 'connected') {
          await sock.sendPresenceUpdate('composing', jid);
        }
      } catch (pErr: any) { }

      const typingDelay = Math.min(2200, 1200 + Math.floor(Math.random() * 800));
      await new Promise(res => setTimeout(res, typingDelay));

      console.log(`[WhatsApp Bot] 🤖 Despachando respuesta a ${jid}...`);

      if (typeof response === 'object' && response !== null && response.document) {
        await sendDocumentMessageProxy(jid, response.document, response.fileName, response.caption, response.mimetype);
      } else if (typeof response === 'object' && response !== null && response.text) {
        await sendProductMessageProxy(jid, response.text, response.image);
      } else if (typeof response === 'string') {
        await sendTextMessage(jid, response);
      }

      const responseText = typeof response === 'object' && response !== null
        ? (response.text || response.caption || '')
        : (response ? String(response) : '');

      // [MERCADO VENEZUELA] Pin interactivo si la respuesta refiere a la ubicación de la tienda
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

      // Tarjeta vCard oficial si el cliente pide explícitamente guardar el contacto
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
              contacts: { displayName: 'Crastur - Repuestos e Insumos', contacts: [{ vcard }] }
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
}

// Indirecciones para evitar dependencias circulares con sending.ts en tiempo de carga
import { sendProductMessage, sendDocumentMessage } from './sending';
async function sendProductMessageProxy(jid: string, text: string, image?: string) {
  return sendProductMessage(jid, text, image);
}
async function sendDocumentMessageProxy(jid: string, doc: any, fileName?: string, caption?: string, mimetype?: string) {
  return sendDocumentMessage(jid, doc, fileName, caption, mimetype);
}

/**
 * [ROBUSTEZ DE ARRANQUE] Responde las consultas recibidas durante la ventana de estabilización.
 */
export async function flushPendingStartupMessages(): Promise<void> {
  if (pendingStartupMessages.length === 0) return;
  const batch = pendingStartupMessages.splice(0, pendingStartupMessages.length);
  console.log(`[WhatsApp Bot] ☀️ Procesando ${batch.length} consulta(s) acumuladas durante el arranque...`);

  for (const item of batch) {
    try {
      if (isBotGloballyPaused() || isBotPaused(item.jid)) {
        console.log(`[WhatsApp Bot] Consulta de arranque de ${item.jid} omitida (bot pausado).`);
        continue;
      }
      await deliverBotResponse(item.jid, item.combinedText, item.pushName, item.hasMediaOnly, item.firstMedia);
      await new Promise(r => setTimeout(r, 1800));
    } catch (e: any) {
      console.error(`[WhatsApp Bot] Error respondiendo consulta de arranque a ${item.jid}:`, e?.message || e);
    }
  }
}

/**
 * Registra un listener de sincronización histórica multi-dispositivo.
 */
export function registerHistoryHandler(): void {
  sock.ev.on('messaging-history.set', async ({ messages }: any) => {
    if (!messages || !Array.isArray(messages)) return;
    console.log(`[WhatsApp Sync] 📥 Sincronización histórica recibida: ${messages.length} mensajes.`);

    let ingestedCount = 0;
    for (const msg of messages) {
      const jid = msg.key?.remoteJid || '';
      if (!jid) continue;
      if (jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.includes('@newsletter') || jid.includes('broadcast') || jid === 'status@broadcast') continue;
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) continue;

      const info = extractMessageInfo(msg);
      if (!info || (!info.text && !info.isMedia)) continue;

      const contentText = info.text || `[${info.mediaType || 'Multimedia'}]`;
      const msgTime = Number(msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000;
      const pushName = msg.pushName || 'Cliente';
      const isFromMe = !!msg.key.fromMe;
      const senderType = isFromMe ? 'asesor' : 'cliente';

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
}

/**
 * Registra el listener de mensajes entrantes/salientes en tiempo real.
 */
export function registerMessageHandler(): void {
  sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
    // Ignorar eventos 'append' (mensajes históricos sincronizados en segundo plano)
    if (type !== 'notify') return;
    if (!messages || !Array.isArray(messages)) return;

    for (const msg of messages) {
      const jid = msg.key?.remoteJid || '';
      if (!jid) continue;

      // Filtro estricto contra grupos, canales y estados broadcast
      if (jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.includes('@newsletter') || jid.includes('broadcast') || jid === 'status@broadcast') continue;
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) continue;

      const botPhone = currentUser?.phone || (sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '');
      const senderPhone = jid.split(':')[0].split('@')[0];
      const isSelfChat = botPhone && senderPhone && (botPhone === senderPhone);

      // Mensaje enviado por el propio operador desde el móvil o WhatsApp Web
      if (msg.key.fromMe && !isSelfChat) {
        const msgId = msg.key?.id;
        if (msgId && wasSentByBot(msgId)) {
          consumeSentMessageId(msgId);
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

              notifyLiveMessage({ jid, pushName: 'Asesor Humano', remitente: 'asesor', contenido: rawContent, timestamp: msgTime });
            } catch (e) { }
          }
        }
        continue;
      }

      // Mensaje entrante del cliente
      const messageTimestamp = msg.messageTimestamp;
      if (messageTimestamp) {
        const ageSec = Math.floor(Date.now() / 1000) - Number(messageTimestamp);

        // [ANTI-BANEO META 2025] No responder mensajes con antigüedad mayor a 1 día
        if (ageSec > 24 * 3600) continue;

        // Mensaje acumulado mientras el servidor estuvo apagado (> 3 minutos de antigüedad)
        if (ageSec > 180) {
          const info = extractMessageInfo(msg);
          if (info && (info.text || info.isMedia)) {
            const pushName = msg.pushName || 'cliente';
            const msgTime = Number(messageTimestamp) * 1000;
            const contentText = info.text || `[${info.mediaType || 'Multimedia'}]`;

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

                notifyLiveMessage({ jid, pushName, remitente: 'cliente', contenido: contentText, timestamp: msgTime });
              } catch (e) { }
            }

            if (info.text && info.text.trim().length > 1) {
              overnightCatchupMap.set(jid, { text: info.text.trim(), pushName });
            }

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

      notifyLiveMessage({ jid, pushName, remitente: 'cliente', contenido: text || `[Mensaje ${mediaType}]`, timestamp: Date.now() });

      // DEBOUNCING de mensajes en ráfaga (anti-flood): agrupa fragmentos en 1.2s
      if (!messageDebounceQueues.has(jid)) {
        messageDebounceQueues.set(jid, []);
      }

      messageDebounceQueues.get(jid)!.push({ text, isMedia, mediaType, pushName });

      if (messageDebounceTimers.has(jid)) {
        clearTimeout(messageDebounceTimers.get(jid));
      }

      messageDebounceTimers.set(jid, setTimeout(async () => {
        const queue = messageDebounceQueues.get(jid) || [];
        messageDebounceQueues.delete(jid);
        messageDebounceTimers.delete(jid);

        if (queue.length === 0) return;

        const combinedText = queue.map((q: any) => q.text).filter(Boolean).join(' ');
        const hasMediaOnly = !combinedText && queue.some((q: any) => q.isMedia);
        const firstMedia = queue.find((q: any) => q.isMedia);
        const activePushName = queue[queue.length - 1]?.pushName || pushName || 'amigo/a';

        console.log(`[WhatsApp Bot] ⚙️ Procesando consulta de ${activePushName} (${jid}): "${combinedText || '[Multimedia]'}"`);

        // [ROBUSTEZ] No perder mensajes durante la ventana de estabilización: encolar
        if (!botReadyRef.value) {
          pendingStartupMessages.push({ jid, combinedText, pushName: activePushName, hasMediaOnly, firstMedia });
          console.log(`[WhatsApp Bot] ⏳ Bot en fase de inicio. Consulta de ${activePushName} en cola (${pendingStartupMessages.length}). Se responderá al quedar listo.`);
          return;
        }

        await deliverBotResponse(jid, combinedText, activePushName, hasMediaOnly, firstMedia);
      }, 1200));
    }
  });
}
