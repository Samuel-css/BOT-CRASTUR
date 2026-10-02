/**
 * @file sending.ts
 * @description Funciones de despacho de mensajes y medios por WhatsApp (texto, imagen, documento,
 * mensaje manual del asesor). Registra cada envío en la base de datos y notifica al Live Inbox.
 */

import fs from 'fs';
import { db } from '../database';
import { standardizeBotMessage } from '../bot/utils/textUtils';
import { sock, connectionStatus, notifyLiveMessage } from './socketState';

/** Registro de identificadores de mensajes enviados por el bot para evitar bucles de eco. */
const knownSentMessageIds = new Set<string>();

/**
 * Registra un ID de mensaje saliente con un TTL de 60 segundos para ignorar ecos en `messages.upsert`.
 */
export function trackSentMessageId(msgId: string): void {
  if (!msgId) return;
  knownSentMessageIds.add(msgId);
  setTimeout(() => knownSentMessageIds.delete(msgId), 60000);
}

/** Verifica si un ID de mensaje fue enviado por el propio bot (anti-eco). */
export function wasSentByBot(msgId: string): boolean {
  return knownSentMessageIds.has(msgId);
}

/** Consume (elimina) un ID de mensaje saliente registrado. */
export function consumeSentMessageId(msgId: string): void {
  knownSentMessageIds.delete(msgId);
}

/**
 * Envía un mensaje con imagen de producto (Base64 o URL remota) y pie de foto.
 * Si falla el envío de la imagen o no se especifica, recurre a mensaje de texto normal.
 */
export async function sendProductMessage(jid: string, text: string, imageUrl?: string): Promise<void> {
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

  notifyLiveMessage({ id: insertId, jid, pushName: 'Crastur Bot', remitente: 'bot', contenido: cleanText, timestamp: now });
}

/**
 * Envía un documento (p. ej. catálogo PDF) adjunto por WhatsApp.
 */
export async function sendDocumentMessage(
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

  notifyLiveMessage({ id: insertId, jid, pushName: 'Crastur Bot', remitente: 'bot', contenido: loggedText, timestamp: now });

  return sentMsg;
}

/**
 * Envía un mensaje de texto automático generado por el bot.
 */
export async function sendTextMessage(jid: string, text: string): Promise<void> {
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

  notifyLiveMessage({ id: insertId, jid, pushName: 'Crastur Bot', remitente: 'bot', contenido: cleanText, timestamp: now });
}

/**
 * Envía un mensaje redactado manualmente por un asesor humano desde el Live Inbox.
 */
export async function sendManualMessage(jid: string, text: string): Promise<{ success: boolean; id: any; timestamp: number }> {
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

  notifyLiveMessage({ id: insertId, jid, pushName: 'Asesor Humano', remitente: 'asesor', contenido: text, timestamp: now });

  return { success: true, id: insertId, timestamp: now };
}
