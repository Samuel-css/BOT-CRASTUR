/**
 * @file antiSpam.ts
 * @description Sistema de control de tasa de mensajes (Rate Limiting) estocástico de doble ventana.
 * 
 * [ANTI-BANEO META 2025]
 * Protege la cuenta de WhatsApp Business contra suspensiones automatizadas de Meta provocadas
 * por bots o usuarios que inundan el chat con mensajes automatizados.
 *
 * Calibración de umbrales:
 * 1. Ráfaga: 12 mensajes en 10 segundos (holgadamente por encima de una conversación humana).
 * 2. Ventana extendida: 25 mensajes en 60 segundos.
 *
 * IMPORTANTE: los umbrales deben ser suficientemente altos para NO silenciar a un cliente
 * real que escribe varios mensajes seguidos explicando lo que necesita (caso normal en
 * WhatsApp). El anti-spam protege contra FLOOD, no contra uso legítimo. Solo los mensajes
 * posteriores a superar el límite se silencian; la ventana se recupera automáticamente.
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

/** Marca de tiempo del último barrido de limpieza de contadores inactivos */
let lastCleanupAt = 0;
/** Ventana máxima en la que un contador se considera "activo" (5 minutos) */
const COUNTER_IDLE_MS = 5 * 60 * 1000;

/**
 * [ANTI-FUGA DE MEMORIA] Elimina periódicamente los contadores de JIDs que ya no
 * presentan actividad reciente, evitando que el mapa crezca indefinidamente.
 */
function cleanupStaleCounters(now: number): void {
  if (now - lastCleanupAt < COUNTER_IDLE_MS) return;
  lastCleanupAt = now;
  for (const [jid, counter] of spamCounters.entries()) {
    const newestWindow = Math.max(counter.resetAt, counter.burstResetAt);
    if (now > newestWindow) {
      spamCounters.delete(jid);
    }
  }
}

/**
 * Determina si el remitente ha superado los umbrales de seguridad de mensajería de Meta.
 * 
 * @param jid - JID único del usuario en WhatsApp (ej. '584121234567@s.whatsapp.net')
 * @returns `true` si el remitente está enviando spam y debe ser silenciado; `false` si es una tasa aceptable.
 */
export function isSpamming(jid: string): boolean {
  const now = Date.now();

  // Limpieza oportunista de contadores inactivos para evitar fuga de memoria
  cleanupStaleCounters(now);

  // Constantes de calibración: protegen contra FLOOD sin silenciar conversaciones humanas.
  // [AJUSTE] Umbrales anteriores (8/min y 5/10s) silenciaban a clientes reales que
  // escribían varias líneas seguidas, dejando de responderles. Se elevan a valores
  // que solo alcanza un flood automatizado real.
  //
  // COMPORTAMIENTO: esta función se invoca con CADA mensaje entrante. La ráfaga (12/10s)
  // solo se dispara con mensajes escritos en cuestión de segundos. Cuando un cliente
  // escribe más despacio (como en una conversación normal), la ventana corta se reinicia
  // sola y nunca se activa. La ventana extendida (30/min) es una segunda red de seguridad.
  const LONG_LIMIT  = 30;             // Máximo de mensajes por minuto
  const LONG_WINDOW = 60 * 1000;      // Duración de la ventana extendida: 60 segundos
  const BURST_LIMIT  = 12;            // Máximo de mensajes en ráfaga
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
  const excedeLimite = counter.count > LONG_LIMIT || counter.burstCount > BURST_LIMIT;

  // [AMORTIGUACIÓN] Al cruzar el umbral se reinician AMBAS ventanas: el silencio dura
  // una sola ráfaga de mensajes y el cliente no queda bloqueado el resto de la ventana.
  if (excedeLimite) {
    counter.count = 0;
    counter.resetAt = now + LONG_WINDOW;
    counter.burstCount = 0;
    counter.burstResetAt = now + BURST_WINDOW;
  }

  return excedeLimite;
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
