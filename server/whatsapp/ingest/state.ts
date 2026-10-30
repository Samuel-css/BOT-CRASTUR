/**
 * @file state.ts
 * @description Estado en memoria compartido por la ingestión de WhatsApp: buffers de
 * debounce, cola de arranque, bloqueo de concurrencia por chat y recuperación nocturna.
 *
 * Se centraliza aquí para que `deliver.ts`, `history.ts` y `live.ts` compartan las mismas
 * estructuras sin duplicarlas ni crear dependencias circulares.
 */

import { onCancelPendingBotResponses } from '../takeover';

/** Antigüedad máxima (10 min) para responder una consulta acumulada mientras la PC estaba apagada. */
export const CATCHUP_MAX_AGE_MS = 10 * 60 * 1000;

export interface StartupMessage {
  jid: string;
  combinedText: string;
  pushName: string;
  hasMediaOnly: boolean;
  firstMedia: any;
}

export const ingestState = {
  /** Timers de debounce por JID (ráfaga de mensajes). */
  debounceTimers: new Map<string, any>(),
  /** Colas de fragmentos pendientes por JID. */
  debounceQueues: new Map<string, any[]>(),
  /** Evita respuestas duplicadas simultáneas al mismo chat. */
  processingJids: new Set<string>(),
  /** Consultas recibidas mientras la PC estaba apagada (catch-up nocturno). */
  overnightCatchupMap: new Map<string, any>(),
  overnightCatchupTimer: null as any,
  /** Consultas recibidas durante la ventana de estabilización (20 s). */
  startupMessages: [] as StartupMessage[],
  /** Referencia inyectada desde connection.ts. */
  botReady: { value: false } as { value: boolean }
};

/**
 * Cancela cualquier respuesta pendiente del bot para un chat: debounce, cola de arranque
 * y recuperación nocturna. Se invoca cuando un asesor toma la conversación.
 */
export function cancelPendingBotResponses(jid: string): void {
  const timer = ingestState.debounceTimers.get(jid);
  if (timer) {
    clearTimeout(timer);
    ingestState.debounceTimers.delete(jid);
  }
  ingestState.debounceQueues.delete(jid);
  ingestState.overnightCatchupMap.delete(jid);

  for (let i = ingestState.startupMessages.length - 1; i >= 0; i--) {
    if (ingestState.startupMessages[i].jid === jid) {
      ingestState.startupMessages.splice(i, 1);
    }
  }
}

// [HUMAN TAKEOVER] Permite a sending.ts/rutas cancelar respuestas sin importar ingest.ts.
onCancelPendingBotResponses(cancelPendingBotResponses);

/**
 * Limpia todo el estado en memoria al cerrar sesión o reiniciar WhatsApp: evita timers
 * disparando respuestas con el socket cerrado y consultas de la sesión anterior.
 */
export function resetIngestState(): void {
  for (const timer of ingestState.debounceTimers.values()) {
    try { clearTimeout(timer); } catch {}
  }
  ingestState.debounceTimers.clear();
  ingestState.debounceQueues.clear();
  ingestState.processingJids.clear();
  ingestState.overnightCatchupMap.clear();
  if (ingestState.overnightCatchupTimer) {
    try { clearTimeout(ingestState.overnightCatchupTimer); } catch {}
    ingestState.overnightCatchupTimer = null;
  }
  ingestState.startupMessages.length = 0;
}

/** Enlaza la bandera de "bot listo" que controla connection.ts. */
export function bindBotReady(ref: { value: boolean }): void {
  ingestState.botReady = ref;
}
