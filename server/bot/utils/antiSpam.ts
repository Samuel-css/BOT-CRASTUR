/**
 * @file antiSpam.ts
 * @description Sistema de control de tasa de mensajes (Rate Limiting) estocástico de doble ventana.
 * 
 * [ANTI-BANEO META 2025]
 * Protege la cuenta de WhatsApp Business contra suspensiones automatizadas de Meta provocadas por:
 * 1. Ráfagas rápidas de flood: Máximo 5 mensajes en una ventana de 10 segundos.
 * 2. Sobrecarga por minuto: Máximo 8 mensajes en una ventana de 60 segundos.
 * 
 * Si un remitente supera cualquiera de los dos límites, el bot se silencia temporalmente
 * sin generar respuestas automáticas para no alimentar bucles infinitos de mensajería.
 */

/**
 * Estructura de seguimiento de frecuencia por cada JID de WhatsApp.
 */
interface SpamCounter {
  /** Contador acumulado de mensajes en la ventana extendida */
  count: number;
  /** Marca de tiempo (epoch ms) en que expira la ventana extendida */
  resetAt: number;
  /** Contador acumulado de mensajes en la ventana corta de ráfaga */
  burstCount: number;
  /** Marca de tiempo (epoch ms) en que expira la ventana corta */
  burstResetAt: number;
}

/** Mapa en memoria de contadores anti-spam indexados por JID */
const spamCounters: Map<string, SpamCounter> = new Map();

/**
 * Determina si el remitente ha superado los umbrales de seguridad de mensajería de Meta.
 * 
 * @param jid - JID único del usuario en WhatsApp (ej. '584121234567@s.whatsapp.net')
 * @returns `true` si el remitente está enviando spam y debe ser silenciado; `false` si es una tasa aceptable.
 */
export function isSpamming(jid: string): boolean {
  const now = Date.now();

  // Constantes de calibración alineadas con Meta Messaging Policies 2025
  const LONG_LIMIT  = 8;              // Máximo de mensajes por minuto
  const LONG_WINDOW = 60 * 1000;      // Duración de la ventana extendida: 60 segundos
  const BURST_LIMIT  = 5;             // Máximo de mensajes en ráfaga
  const BURST_WINDOW = 10 * 1000;     // Duración de la ventana corta: 10 segundos

  if (!spamCounters.has(jid)) {
    spamCounters.set(jid, {
      count: 1,
      resetAt: now + LONG_WINDOW,
      burstCount: 1,
      burstResetAt: now + BURST_WINDOW
    });
    return false;
  }

  const counter = spamCounters.get(jid)!;

  // Actualizar ventana extendida si ya transcurrieron 60 segundos
  if (now > counter.resetAt) {
    counter.count = 1;
    counter.resetAt = now + LONG_WINDOW;
  } else {
    counter.count++;
  }

  // Actualizar ventana corta si ya transcurrieron 10 segundos
  if (now > counter.burstResetAt) {
    counter.burstCount = 1;
    counter.burstResetAt = now + BURST_WINDOW;
  } else {
    counter.burstCount++;
  }

  // Disparar protección si se excede la ventana extendida o la ráfaga corta
  return counter.count > LONG_LIMIT || counter.burstCount > BURST_LIMIT;
}

/**
 * Restablece los contadores de spam en memoria.
 * 
 * @param jid - JID del remitente a reiniciar (si es null, limpia todos los registros).
 */
export function resetSpam(jid: string | null = null): void {
  if (jid) {
    spamCounters.delete(jid);
  } else {
    spamCounters.clear();
  }
}

export default {
  isSpamming,
  resetSpam
};
