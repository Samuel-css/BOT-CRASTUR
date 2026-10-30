/**
 * @file history.ts
 * @description Ingestión del historial multi-dispositivo y detección de respuestas del
 * asesor enviadas desde el teléfono mientras la PC estaba desconectada.
 */

import { db, registerChatAliases } from '../../database';
import { sock, notifyLiveMessage } from '../socketState';
import { extractMessageInfo } from '../messageParsing';
import { registerHumanTakeover } from '../takeover';

/**
 * [ALIAS LID/NÚMERO] Registra las identidades alternas que WhatsApp entrega en la clave del
 * mensaje. Así la pausa por asesor aplica aunque el cliente llegue con otro identificador.
 */
export function collectAndRegisterAliases(msg: any): void {
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
export function wasStoredAsBotMessage(jid: string, text: string, msgTime: number): boolean {
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
export function isRecentAdvisorMessage(jid: string, msgTime: number): boolean {
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
