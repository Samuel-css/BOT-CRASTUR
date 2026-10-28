/**
 * @file takeover.ts
 * @description Punto único de "Human Takeover": cuando un asesor humano responde en un chat,
 * el bot debe callarse de inmediato, cancelar cualquier respuesta que estuviera preparando y
 * avisar al panel.
 *
 * [POR QUÉ EXISTE ESTE MÓDULO]
 * Antes, cada camino (mensaje desde el teléfono, envío desde el panel, historial sincronizado)
 * repetía su propia lógica y algunos olvidaban pausar. Aquí se centraliza para que TODOS los
 * caminos hagan exactamente lo mismo.
 *
 * [SIN DEPENDENCIAS CIRCULARES]
 * `ingest.ts` registra aquí su función de cancelación; `sending.ts` puede pedir la cancelación
 * sin importar `ingest.ts`.
 */

import {
  db,
  isBotPaused,
  isBotGloballyPaused,
  registerAdvisorActivity
} from '../database';
import { resolveChatJids } from '../db/aliases';
import { notifyChatState, notifyLiveMessage } from './socketState';

export type TakeoverOrigin = 'telefono' | 'panel' | 'historial';

/** Funciones registradas para cancelar respuestas pendientes de un chat. */
const cancelHandlers: Array<(jid: string) => void> = [];

/** Registra una función que cancela timers/colas de respuesta del bot para un JID. */
export function onCancelPendingBotResponses(handler: (jid: string) => void): void {
  if (typeof handler === 'function') cancelHandlers.push(handler);
}

/**
 * Cancela cualquier respuesta del bot que esté esperando salir en un chat.
 * Se aplica a todas las identidades conocidas del contacto (número real y LID).
 */
export function cancelPendingBotResponsesFor(jid: string): void {
  const targets = resolveChatJids(jid);
  for (const target of targets) {
    for (const handler of cancelHandlers) {
      try { handler(target); } catch { /* nunca interrumpir por un timer */ }
    }
  }
}

/**
 * [ÚLTIMA MILLA] Indica si el bot puede enviar una respuesta automática AHORA MISMO.
 * Se debe volver a consultar justo antes de cada envío: entre que el bot "piensa" y
 * "escribe" pueden pasar varios segundos y el asesor puede contestar en ese lapso.
 */
export function canBotSend(jid: string): boolean {
  if (isBotGloballyPaused()) return false;
  return !isBotPaused(jid);
}

/** Texto del aviso interno que queda visible en el Live Inbox. */
function buildTakeoverNotice(origin: TakeoverOrigin): string {
  if (origin === 'historial') {
    return '✋ Se detectó que un asesor ya había respondido esta conversación. El bot queda pausado para no interrumpir la atención humana.';
  }
  if (origin === 'panel') {
    return '✋ El asesor respondió desde el panel. El bot queda pausado en este chat para no interrumpir la conversación.';
  }
  return '✋ El bot se pausó automáticamente porque un asesor respondió en esta conversación. Se reactivará si el cliente vuelve a escribir más tarde.';
}

/**
 * Registra que un humano atendió el chat.
 *
 * @param jid        Chat donde intervino el asesor
 * @param at         Momento real del mensaje del asesor (para historial se usa su timestamp)
 * @param origin     Camino por el que se detectó la intervención
 * @returns `true` si el bot quedó pausado por esta intervención
 */
export function registerHumanTakeover(jid: string, at?: number, origin: TakeoverOrigin = 'telefono'): boolean {
  if (!jid) return false;

  const alreadyPaused = isBotPaused(jid);
  const paused = registerAdvisorActivity(jid, at);

  if (!paused) {
    // La pausa automática está desactivada en Ajustes: se respeta la configuración,
    // pero igual queda registrada la hora del asesor para la reactivación/follow-ups.
    return false;
  }

  // Cancelar respuestas que estaban en camino (debounce, cola de arranque, catch-up).
  cancelPendingBotResponsesFor(jid);

  const now = Date.now();
  const activityAt = Number(at) > 0 ? Number(at) : now;

  if (!alreadyPaused) {
    const aviso = buildTakeoverNotice(origin);
    let avisoId: any = null;
    try {
      const res = db.prepare(`
        INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
        VALUES (?, 'sistema', ?, ?)
      `).run(jid, aviso, now);
      avisoId = res?.lastInsertRowid;
    } catch {}

    notifyLiveMessage({
      id: avisoId,
      jid,
      pushName: 'Sistema',
      remitente: 'sistema',
      contenido: aviso,
      timestamp: now
    });
  }

  // Se emite en cada respuesta del asesor para refrescar la hora en la cabecera del chat.
  // El aviso emergente (toast) solo se muestra en la primera transición.
  notifyChatState({
    jid,
    pausado: true,
    por: 'asesor',
    auto: true,
    origen: origin,
    at: activityAt,
    notify: !alreadyPaused
  });

  return true;
}

export default {
  onCancelPendingBotResponses,
  cancelPendingBotResponsesFor,
  canBotSend,
  registerHumanTakeover
};
