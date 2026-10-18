/**
 * @file outboundQueue.ts
 * @description Cola estocástica saliente anti-baneo (Políticas Meta 2025).
 * Despacha recordatorios y avisos programados con retardos humanizados, simulando
 * presencia de escritura y respetando pausas/opt-out antes de cada envío.
 *
 * [PERSISTENCIA] La cola se guarda en disco (`data/outbound_queue.json`) para que un
 * reinicio del sistema (apagón, actualización, corte) NO pierda los mensajes que estaban
 * pendientes de salir. Al arrancar se vuelve a cargar automáticamente.
 */

import path from 'path';
import fs from 'fs';
import { db, dataDir } from '../database';
import { sock, connectionStatus } from './socketState';
import { sendTextMessage } from './sending';

interface OutboundQueueItem {
  jid: string;
  text: string;
}

/** Archivo donde se respalda la cola de salida. */
const QUEUE_FILE = path.join(dataDir || path.join(__dirname, '..', '..', 'data'), 'outbound_queue.json');

/** Cola en memoria (se inicializa desde disco si existe). */
const outboundQueue: OutboundQueueItem[] = [];
let isProcessingOutboundQueue = false;
let retryTimer: any = null;

/**
 * Guarda la cola en disco de forma atómica (archivo .tmp + rename).
 * Es deliberadamente silenciosa: un fallo de disco nunca debe romper el envío.
 */
function persistQueue(): void {
  try {
    const tmp = QUEUE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(outboundQueue), 'utf8');
    try {
      fs.renameSync(tmp, QUEUE_FILE);
    } catch {
      // Windows/NTFS puede bloquear el rename por antivirus: copia directa como respaldo.
      fs.copyFileSync(tmp, QUEUE_FILE);
      try { fs.unlinkSync(tmp); } catch {}
    }
  } catch (e: any) {
    console.warn('[WhatsApp Queue] No se pudo guardar la cola en disco:', e?.message || e);
  }
}

/** Carga la cola pendiente desde disco al iniciar el proceso. */
function loadQueue(): void {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.jid && item.text) outboundQueue.push({ jid: String(item.jid), text: String(item.text) });
      }
      if (outboundQueue.length > 0) {
        console.log(`[WhatsApp Queue] 🔄 ${outboundQueue.length} mensaje(s) pendientes recuperados de la sesión anterior.`);
      }
    }
  } catch (e: any) {
    console.warn('[WhatsApp Queue] No se pudo leer la cola pendiente:', e?.message || e);
  }
}

// Cargar al iniciar el módulo.
loadQueue();

/**
 * Encola un mensaje saliente para ser despachado con retardos aleatorios humanizados.
 */
export function enqueueOutboundMessage(targetJid: string, messageText: string): void {
  if (!targetJid || !messageText) return;
  outboundQueue.push({ jid: targetJid, text: messageText });
  persistQueue();
  processOutboundQueue();
}

/** Número de mensajes pendientes por salir (para diagnóstico/monitorización). */
export function getOutboundQueueSize(): number {
  return outboundQueue.length;
}

/**
 * Procesa secuencialmente los mensajes en la cola saliente aplicando pausas estocásticas
 * y emulando la presencia humana ("composing" y "paused") para evitar detección por Meta.
 */
export async function processOutboundQueue(): Promise<void> {
  if (isProcessingOutboundQueue) return;
  isProcessingOutboundQueue = true;

  try {
    while (outboundQueue.length > 0) {
      const item = outboundQueue.shift();
      if (!item || !item.jid || !item.text) continue;

      // Validar si el cliente solicitó no ser molestado o si la conversación fue pausada por un asesor
      const session = db.prepare('SELECT no_molestar, bot_pausado FROM chat_sessions WHERE jid = ?').get(item.jid);
      if (session && (session.no_molestar === 1 || session.bot_pausado === 1)) {
        console.log(`[WhatsApp Queue] ⏸️ Mensaje a ${item.jid} omitido (marcado como no_molestar o pausado)`);
        persistQueue();
        continue;
      }

      // [INTEGRIDAD] Si no hay conexión, el mensaje NO se descarta: vuelve al frente de la cola
      // para reintentarse cuando el socket se restablezca. Antes se perdían recordatorios y
      // avisos de apartado silenciosamente durante cortes de conexión.
      if (connectionStatus !== 'connected' || !sock) {
        outboundQueue.unshift(item);
        persistQueue();
        break;
      }

      try {
        // [ANTI-BANEO] Simular presencia de escritura previa al envío
        try {
          await sock.sendPresenceUpdate('composing', item.jid);
        } catch (e: any) {}

        // [ANTI-BANEO / RITMO HUMANO] El tiempo de "escribiendo..." crece con el largo del
        // texto (como una persona tecleando), con tope de 4.2s para no frenar la atención.
        const typingDelay = Math.min(4200, 900 + item.text.length * 22) + Math.floor(Math.random() * 400);
        await new Promise(r => setTimeout(r, typingDelay));

        await sendTextMessage(item.jid, item.text);

        try {
          await sock.sendPresenceUpdate('paused', item.jid);
        } catch (e: any) {}
      } catch (sendErr: any) {
        console.warn(`[WhatsApp Queue] Error enviando recordatorio a ${item.jid}:`, sendErr?.message || sendErr);
      }

      persistQueue();

      // [ANTI-BANEO] Retardo aleatorio de 3.5s a 6.5s entre mensajes encolados consecutivos
      const humanDelay = 3500 + Math.floor(Math.random() * 3000);
      await new Promise(r => setTimeout(r, humanDelay));
    }
  } finally {
    // [INTEGRIDAD] Garantiza que el flag SIEMPRE se libere, incluso si un error inesperado
    // ocurre fuera del try por ítem. Antes la cola podía quedar bloqueada para siempre.
    isProcessingOutboundQueue = false;
  }

  // Si quedaron mensajes pendientes (por falta de conexión), reprogramar el intento.
  // Se usa un único temporizador para no apilar reintentos.
  if (outboundQueue.length > 0 && connectionStatus !== 'connected') {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      processOutboundQueue();
    }, 15000);
    if (retryTimer.unref) retryTimer.unref();
  }
}

export default {
  enqueueOutboundMessage,
  processOutboundQueue,
  getOutboundQueueSize
};
