/**
 * @file ingest.ts
 * @description Ingestión de eventos entrantes de Baileys: historial multi-dispositivo y
 * mensajes en vivo con debouncing anti-flood, catch-up nocturno y cola de arranque.
 * Adapta la lógica histórica de whatsappService.ts sin cambiar su comportamiento.
 */

import { db, getSettings, isBotGloballyPaused, isBotPaused, shouldReactivateBotForClient, registerChatAliases } from '../database';
import { processIncomingMessage } from '../bot';
import { isWithinBusinessHours } from '../bot/services/businessRules';
import {
  sock,
  connectionStatus,
  currentUser,
  notifyLiveMessage,
  notifyChatState
} from './socketState';
import { extractMessageInfo } from './messageParsing';
import { sendTextMessage, wasSentByBot, consumeSentMessageId, trackSentMessageId } from './sending';
import { standardizeBotMessage } from '../bot/utils/textUtils';
import {
  canBotSend,
  onCancelPendingBotResponses,
  registerHumanTakeover
} from './takeover';

// ─── Buffers y control de duplicados ────────────────────────────────────────
const messageDebounceTimers = new Map<string, any>();
const messageDebounceQueues = new Map<string, any[]>();

// [CONCURRENCIA] Evita que dos cadenas asíncronas envíen la misma respuesta al mismo
// chat a la vez (debounce en vivo + cola de arranque + catch-up + reactivación).
const processingJids = new Set<string>();

let overnightCatchupTimer: any = null;
const overnightCatchupMap = new Map<string, any>();

/**
 * [LOGOUT/RECONEXIÓN] Limpia todo el estado en memoria de la ingestión (timers, colas y
 * mensajes de arranque). Se invoca al cerrar sesión o reiniciar WhatsApp para que no queden
 * timers disparando respuestas con el socket ya cerrado ni consultas de la sesión anterior.
 */
export function resetIngestState(): void {
  for (const timer of messageDebounceTimers.values()) {
    try { clearTimeout(timer); } catch {}
  }
  messageDebounceTimers.clear();
  messageDebounceQueues.clear();
  processingJids.clear();
  overnightCatchupMap.clear();
  if (overnightCatchupTimer) {
    try { clearTimeout(overnightCatchupTimer); } catch {}
    overnightCatchupTimer = null;
  }
  pendingStartupMessages.length = 0;
}

/**
 * [SIN MENSAJES A DESTIEMPO] Antigüedad máxima (10 minutos) para responder una consulta que
 * llegó mientras la PC estaba apagada/desconectada. Pasado ese tiempo el mensaje solo queda
 * registrado en el Live Inbox para que un asesor lo atienda a mano.
 */
const CATCHUP_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * [HUMAN TAKEOVER AUTOMÁTICO] Cancela cualquier respuesta del bot que esté pendiente para un
 * chat: debounce en curso, cola de arranque y recuperación nocturna. Se invoca cuando un asesor
 * humano interviene para que el bot NUNCA responda por encima de la persona.
 */
function cancelPendingBotResponses(jid: string): void {
  const timer = messageDebounceTimers.get(jid);
  if (timer) {
    clearTimeout(timer);
    messageDebounceTimers.delete(jid);
  }
  messageDebounceQueues.delete(jid);
  overnightCatchupMap.delete(jid);

  for (let i = pendingStartupMessages.length - 1; i >= 0; i--) {
    if (pendingStartupMessages[i].jid === jid) {
      pendingStartupMessages.splice(i, 1);
    }
  }
}

// [HUMAN TAKEOVER] `sending.ts` y las rutas del panel pueden cancelar respuestas pendientes
// sin importar este módulo (evita dependencias circulares).
onCancelPendingBotResponses(cancelPendingBotResponses);

/**
 * [ALIAS LID/NÚMERO] Registra las identidades alternas que WhatsApp entrega en la clave del
 * mensaje. Así la pausa por asesor aplica aunque el cliente llegue con otro identificador.
 */
function collectAndRegisterAliases(msg: any): void {
  try {
    const key = msg?.key || {};
    const candidates = [key.remoteJid, key.remoteJidAlt, key.participantAlt, key.senderPn]
      .filter((j: any) => typeof j === 'string' && (j.endsWith('@s.whatsapp.net') || j.endsWith('@lid')));
    if (candidates.length > 1) registerChatAliases(candidates);
  } catch { /* el alias nunca debe romper la ingestión */ }
}

/**
 * [NO CONFUNDIR AL BOT CON EL ASESOR] Detecta si un mensaje `fromMe` corresponde a una
 * respuesta que el propio bot ya guardó como 'bot'. Se usa al sincronizar historial o al
 * reconectar, donde el registro anti-eco en memoria ya expiró.
 */
function wasStoredAsBotMessage(jid: string, text: string, msgTime: number): boolean {
  const content = String(text || '').trim();
  if (!content) return false;
  try {
    const row = db.prepare(`
      SELECT remitente FROM chat_messages
      WHERE jid = ? AND ABS(timestamp - ?) < 120000
        AND (
          contenido = ?
          OR (contenido LIKE '[Documento PDF:%' AND contenido LIKE ?)
        )
      ORDER BY ABS(timestamp - ?) ASC LIMIT 1
    `).get(jid, msgTime, content, `%${content}%`, msgTime);
    return !!row && row.remitente === 'bot';
  } catch {
    return false;
  }
}

/**
 * [HISTORIAL] Solo se toma como "asesor atendiendo" un mensaje enviado por una persona que
 * sea reciente (últimas 24 h) y posterior al último mensaje del cliente. Así un historial
 * viejo no pausa conversaciones nuevas.
 */
function isRecentAdvisorMessage(jid: string, msgTime: number): boolean {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (!Number.isFinite(msgTime) || Date.now() - msgTime > ONE_DAY) return false;
  try {
    const lastClient = db.prepare(`
      SELECT MAX(timestamp) as ts FROM chat_messages
      WHERE jid = ? AND remitente = 'cliente'
    `).get(jid);
    const clientTs = Number(lastClient?.ts) || 0;
    if (clientTs && msgTime < clientTs) return false;
    return true;
  } catch {
    return true;
  }
}

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
  // [CONCURRENCIA] Si ya se está respondiendo a este chat, se omite la segunda cadena para
  // no enviar la misma respuesta dos veces (carrera entre debounce, cola y catch-up).
  if (processingJids.has(jid)) {
    console.log(`[WhatsApp Bot] ⏳ Ya hay una respuesta en curso para ${jid}; se omite el duplicado concurrente.`);
    return;
  }
  processingJids.add(jid);
  try {
    const mediaParam = hasMediaOnly ? { isMedia: true, type: firstMedia?.mediaType } : null;
    const response: any = await processIncomingMessage(jid, combinedText, pushName, mediaParam);

    // [HUMAN TAKEOVER AUTOMÁTICO] Verificación de última milla: si un asesor escribió (o el
    // panel pausó el chat) mientras el bot procesaba el mensaje, la respuesta se descarta.
    if (response && !canBotSend(jid)) {
      console.log(`[WhatsApp Bot] ⏸️ Respuesta a ${jid} descartada: el chat fue tomado por un asesor humano.`);
      return;
    }

    if (response) {
      console.log(`[WhatsApp Bot] 🤖 Simulando presencia de escritura para ${jid}...`);

      const textoRespuesta: string = typeof response === 'object' && response !== null
        ? (response.text || response.caption || '')
        : (response ? String(response) : '');

      // [ANTI-DUPLICADO] Si la respuesta es idéntica a la última que ya envió el bot hace menos
      // de 90 segundos, se omite: evita el molesto "doble mensaje seguido" cuando el cliente
      // repite la misma pregunta en ráfaga.
      let esDuplicadoReciente = false;
      try {
        const ultimoBot = db.prepare(`
          SELECT contenido, timestamp FROM chat_messages
          WHERE jid = ? AND remitente = 'bot'
          ORDER BY id DESC LIMIT 1
        `).get(jid);
        // [FIX] En BD se guarda el texto ya estandarizado; comparar contra el crudo no coincidía
        // y el mecanismo anti-duplicado no frenaba nada.
        const textoNormalizado = standardizeBotMessage(textoRespuesta);
        esDuplicadoReciente = !!(
          ultimoBot &&
          textoRespuesta &&
          (ultimoBot.contenido === textoRespuesta || ultimoBot.contenido === textoNormalizado) &&
          Date.now() - Number(ultimoBot.timestamp) < 90000
        );
      } catch {}

      if (esDuplicadoReciente) {
        console.log(`[WhatsApp Bot] 🔁 Respuesta idéntica reciente para ${jid}: se omite el envío duplicado.`);
        return;
      }

      try {
        if (sock && connectionStatus === 'connected') {
          await sock.sendPresenceUpdate('composing', jid);
        }
      } catch (pErr: any) { }

      // [ANTI-BANEO / RITMO HUMANO] El tiempo de "escribiendo..." crece con el largo del texto
      // (como una persona real tecleando) pero con tope de 4.2s para no frenar la atención.
      const typingDelay = Math.min(4200, 900 + textoRespuesta.length * 22) + Math.floor(Math.random() * 400);
      await new Promise(res => setTimeout(res, typingDelay));

      // [HUMAN TAKEOVER / ÚLTIMA MILLA] Volver a comprobar DESPUÉS del retardo de escritura.
      // Antes la pausa se revisaba solo antes de esos ~4,6 s; si el asesor contestaba en ese
      // lapso, el bot enviaba su respuesta igual por encima de la persona.
      if (!canBotSend(jid)) {
        console.log(`[WhatsApp Bot] ⏸️ Envío a ${jid} cancelado tras el retardo: un asesor tomó el chat.`);
        try {
          if (sock && connectionStatus === 'connected') {
            await sock.sendPresenceUpdate('paused', jid);
          }
        } catch { /* la presencia es opcional */ }
        return;
      }

      console.log(`[WhatsApp Bot] 🤖 Despachando respuesta a ${jid}...`);

      if (typeof response === 'object' && response !== null && response.document) {
        await sendDocumentMessageProxy(jid, response.document, response.fileName, response.caption, response.mimetype);
      } else if (typeof response === 'object' && response !== null && response.text) {
        await sendProductMessageProxy(jid, response.text, response.image);
      } else if (typeof response === 'string') {
        await sendTextMessage(jid, response);
      }

      // [MERCADO VENEZUELA] Pin interactivo si la respuesta refiere a la ubicación de la tienda
      if (textoRespuesta && textoRespuesta.includes('Liberalba') && textoRespuesta.includes('Google Maps') && canBotSend(jid)) {
        try {
          if (sock && connectionStatus === 'connected') {
            // [ANTI-BANEO] Pequeña pausa para no enviar 3 mensajes seguidos sin respiro.
            await new Promise(res => setTimeout(res, 700 + Math.floor(Math.random() * 500)));
            const locMsg = await sock.sendMessage(jid, {
              location: {
                degreesLatitude: 10.5015,
                degreesLongitude: -66.9015,
                name: 'Crastur - Insumos Cauchera y Repuestos Moto',
                address: 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas'
              }
            });
            if (locMsg?.key?.id) trackSentMessageId(locMsg.key.id);
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
      if (explicitContactRequest && canBotSend(jid)) {
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

            const cardMsg = await sock.sendMessage(jid, {
              contacts: { displayName: 'Crastur - Repuestos e Insumos', contacts: [{ vcard }] }
            });
            if (cardMsg?.key?.id) trackSentMessageId(cardMsg.key.id);
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
  } finally {
    processingJids.delete(jid);
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

    // [ORDEN CRONOLÓGICO] El historial puede llegar desordenado. Se procesa del más viejo al
    // más nuevo para que la comparación "asesor después del último mensaje del cliente" sea fiable.
    const orderedMessages = [...messages].sort((a: any, b: any) => {
      const ta = Number(a?.messageTimestamp || 0);
      const tb = Number(b?.messageTimestamp || 0);
      return ta - tb;
    });

    let ingestedCount = 0;
    for (const msg of orderedMessages) {
      const jid = msg.key?.remoteJid || '';
      if (!jid) continue;
      if (jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.includes('@newsletter') || jid.includes('broadcast') || jid === 'status@broadcast') continue;
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) continue;

      collectAndRegisterAliases(msg);

      const info = extractMessageInfo(msg);
      if (!info || (!info.text && !info.isMedia)) continue;

      const contentText = info.text || `[${info.mediaType || 'Multimedia'}]`;
      const msgTime = Number(msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000;
      const pushName = msg.pushName || 'Cliente';
      const isFromMe = !!msg.key.fromMe;
      // [NO CONFUNDIR BOT CON ASESOR] Al reconectar, el historial incluye los mensajes
      // que el propio bot envió antes. Se marcan como 'bot' y NO pausan la conversación.
      const isBotCopy = isFromMe && wasStoredAsBotMessage(jid, contentText, msgTime);
      const senderType = isFromMe ? (isBotCopy ? 'bot' : 'asesor') : 'cliente';

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

      // [HUMAN TAKEOVER EN HISTORIAL] Si el asesor respondió desde el teléfono mientras
      // la PC estaba desconectada, este es el único momento en que nos enteramos.
      // Solo se considera si el mensaje es reciente y posterior al último del cliente.
      if (isFromMe && !isBotCopy && isRecentAdvisorMessage(jid, msgTime)) {
        registerHumanTakeover(jid, msgTime, 'historial');
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
    // [HUMAN TAKEOVER] Los eventos 'append' (historial sincronizado tras reconectar) ya no se
    // descartan por completo: los mensajes del ASESOR que llegan por esa vía también deben
    // pausar el bot. Los mensajes de clientes por 'append' se ignoran para no responder historial.
    const isLiveEvent = type === 'notify';
    if (!messages || !Array.isArray(messages)) return;

    for (const msg of messages) {
      const jid = msg.key?.remoteJid || '';
      if (!jid) continue;

      // Filtro estricto contra grupos, canales y estados broadcast
      if (jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.includes('@newsletter') || jid.includes('broadcast') || jid === 'status@broadcast') continue;
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) continue;

      // [ALIAS LID/NÚMERO] Agrupa las identidades del mismo contacto para que la pausa aplique.
      collectAndRegisterAliases(msg);

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
        const msgTime = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();

        // [NO CONFUNDIR AL BOT CON EL ASESOR] En reconexiones, WhatsApp reenvía mensajes
        // que el propio bot ya envió. Se detectan por el registro 'bot' y no pausan nada.
        const isBotCopy = !!(info && wasStoredAsBotMessage(jid, info.text, msgTime));

        if (info && (info.text || info.isMedia)) {
          const rawContent = info.text || `[${info.mediaType || 'Multimedia'}]`;
          const senderType = isBotCopy ? 'bot' : 'asesor';

          const recent = db.prepare(`
            SELECT id FROM chat_messages
            WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 6000
            LIMIT 1
          `).get(jid, rawContent, msgTime);

          if (!recent) {
            try {
              db.prepare(`
                INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                VALUES (?, ?, ?, ?)
              `).run(jid, senderType, rawContent, msgTime);

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

              if (!isBotCopy) {
                notifyLiveMessage({ jid, pushName: 'Asesor Humano', remitente: 'asesor', contenido: rawContent, timestamp: msgTime });
              }
            } catch (e) { }
          }
        }

        // [HUMAN TAKEOVER AUTOMÁTICO] Cualquier señal enviada por una persona —texto, audio,
        // imagen, sticker o incluso una reacción— confirma que el asesor está atendiendo:
        // el bot se silencia, se cancelan respuestas pendientes y el panel recibe el aviso.
        if (!isBotCopy) {
          const paused = registerHumanTakeover(jid, msgTime, 'telefono');
          if (paused) {
            console.log(`[WhatsApp Bot] ✋ Asesor respondió en ${jid}: bot pausado automáticamente.`);
          }
        }
        continue;
      }

      // [SOLO EN VIVO] Los mensajes de clientes que llegan como historial/append NO se
      // responden automáticamente (evita contestar conversaciones viejas al reconectar).
      if (!isLiveEvent) continue;

      // Mensaje entrante del cliente
      const messageTimestamp = msg.messageTimestamp;
      if (messageTimestamp) {
        const ageSec = Math.floor(Date.now() / 1000) - Number(messageTimestamp);

        // [ANTI-BANEO META 2025] No responder mensajes con antigüedad mayor a 1 día.
        // [LIVE INBOX] Aun sin responder, se registran para que un asesor los vea.
        if (ageSec > 24 * 3600) {
          try {
            const oldInfo = extractMessageInfo(msg);
            if (oldInfo && (oldInfo.text || oldInfo.isMedia)) {
              const oldTime = Number(messageTimestamp) * 1000;
              const oldText = oldInfo.text || `[${oldInfo.mediaType || 'Multimedia'}]`;
              const exists = db.prepare(`
                SELECT id FROM chat_messages
                WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 6000
                LIMIT 1
              `).get(jid, oldText, oldTime);
              if (!exists) {
                db.prepare(`
                  INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                  VALUES (?, 'cliente', ?, ?)
                `).run(jid, oldText, oldTime);
                const s = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
                if (!s) {
                  db.prepare(`
                    INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
                    VALUES (?, ?, 'start', ?, 0, 0, 1)
                  `).run(jid, msg.pushName || 'cliente', oldTime);
                }
              }
            }
          } catch {}
          continue;
        }

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
              overnightCatchupMap.set(jid, { text: info.text.trim(), pushName, msgTime });
            }

            if (overnightCatchupTimer) clearTimeout(overnightCatchupTimer);
            overnightCatchupTimer = setTimeout(async () => {
              if (overnightCatchupMap.size === 0) return;
              const entries = Array.from(overnightCatchupMap.entries());
              overnightCatchupMap.clear();

              if (!isWithinBusinessHours()) {
                console.log('[WhatsApp] Mensajes acumulados registrados en Live Inbox. La tienda física está fuera de horario.');
                return;
              }

              const ahora = Date.now();
              console.log(`[WhatsApp] ☀️ Evaluando ${entries.length} consulta(s) acumulada(s) mientras la PC estuvo apagada...`);
              for (const [targetJid, clientData] of entries) {
                try {
                  // [SIN MENSAJES A DESTIEMPO] Un mensaje viejo ya no se responde solo: llegó
                  // mientras la PC estaba apagada y el cliente (o un asesor) ya siguió adelante.
                  // Solo se atiende si sigue fresco; si no, queda registrado en el Live Inbox.
                  if (ahora - clientData.msgTime > CATCHUP_MAX_AGE_MS) {
                    console.log(`[WhatsApp] Mensaje acumulado de ${targetJid} quedó viejo (${Math.round((ahora - clientData.msgTime) / 60000)} min). Solo se registra en el Live Inbox.`);
                    continue;
                  }

                  if (isBotGloballyPaused() || isBotPaused(targetJid)) {
                    console.log(`[WhatsApp] Mensaje acumulado de ${targetJid} omitido: chat pausado.`);
                    continue;
                  }

                  // [HUMAN TAKEOVER] Si un asesor ya respondió después de ese mensaje, el bot no
                  // interviene: la conversación ya está siendo atendida por una persona.
                  const sesion = db.prepare('SELECT asesor_ultimo_at FROM chat_sessions WHERE jid = ?').get(targetJid);
                  if (sesion?.asesor_ultimo_at && Number(sesion.asesor_ultimo_at) >= clientData.msgTime) {
                    console.log(`[WhatsApp] Mensaje acumulado de ${targetJid} omitido: un asesor ya respondió esa consulta.`);
                    continue;
                  }

                  // Respuesta normal del bot (sin prefijos raros ni saludos a destiempo)
                  await deliverBotResponse(targetJid, clientData.text, clientData.pushName, false, null);
                  await new Promise(r => setTimeout(r, 2000));
                } catch (mErr: any) {
                  console.error(`[WhatsApp] Error respondiendo mensaje acumulado a ${targetJid}:`, mErr?.message || mErr);
                }
              }
            }, 8000);
            if (overnightCatchupTimer && overnightCatchupTimer.unref) overnightCatchupTimer.unref();
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

      // [ANTI-BANEO / RITMO HUMANO] Marcar el mensaje como leído (doble check azul) igual que
      // lo haría una persona del mostrador. No añade retardo al flujo y hace ver la cuenta activa.
      try {
        if (sock && connectionStatus === 'connected' && msg.key) {
          await sock.readMessages([msg.key]);
        }
      } catch (readErr: any) { /* el marcado de leído nunca debe interrumpir la atención */ }

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

        // [REACTIVACIÓN AUTOMÁTICA] Si el bot quedó silenciado por un asesor y el cliente
        // vuelve a escribir después del tiempo configurado sin respuesta humana, el bot retoma
        // la conversación como si un vendedor le pasara el chat de nuevo.
        let fueReactivadoPorAsesor = false;
        try {
          const previo = db.prepare('SELECT bot_pausado, bot_pausado_por FROM chat_sessions WHERE jid = ?').get(jid);
          fueReactivadoPorAsesor = !!previo && parseInt(previo.bot_pausado) === 1 && previo.bot_pausado_por === 'asesor';
        } catch {}

        if (shouldReactivateBotForClient(jid) && fueReactivadoPorAsesor) {
          const minutosReactivacion = parseInt(getSettings().reactivar_bot_minutos || '180', 10) || 180;
          const horasTexto = minutosReactivacion >= 60
            ? `${Math.round(minutosReactivacion / 60)} hora(s)`
            : `${minutosReactivacion} minutos`;
          console.log(`[WhatsApp Bot] ♻️ Bot reactivado automáticamente en ${jid} (asesor inactivo).`);
          try {
            db.prepare(`
              INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
              VALUES (?, 'sistema', ?, ?)
            `).run(jid, `♻️ El bot retomó la conversación automáticamente: el asesor no responde hace más de ${horasTexto}.`, Date.now());
          } catch {}
          notifyChatState({ jid, pausado: false, por: null, auto: true, origen: 'auto' });
        }

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
