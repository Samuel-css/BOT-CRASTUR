/**
 * @file outboundQueue.ts
 * @description Cola estocástica saliente anti-baneo (Políticas Meta 2025).
 * Despacha recordatorios y avisos programados con retardos humanizados, simulando
 * presencia de escritura y respetando pausas/opt-out antes de cada envío.
 */

import { db } from '../database';
import { sock, connectionStatus } from './socketState';
import { sendTextMessage } from './sending';

interface OutboundQueueItem {
  jid: string;
  text: string;
}

const outboundQueue: OutboundQueueItem[] = [];
let isProcessingOutboundQueue = false;

/**
 * Encola un mensaje saliente para ser despachado con retardos aleatorios humanizados.
 */
export function enqueueOutboundMessage(targetJid: string, messageText: string): void {
  outboundQueue.push({ jid: targetJid, text: messageText });
  processOutboundQueue();
}

/**
 * Procesa secuencialmente los mensajes en la cola saliente aplicando pausas estocásticas
 * y emulando la presencia humana ("composing" y "paused") para evitar detección por Meta.
 */
export async function processOutboundQueue(): Promise<void> {
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
