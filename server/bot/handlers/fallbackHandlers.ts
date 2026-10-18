/**
 * @file fallbackHandlers.ts
 * @description Manejador de respuesta por defecto cuando el enrutador no detecta coincidencias
 * en el catálogo ni en las intenciones del usuario.
 *
 * [MENSAJES CORTOS Y CLAROS]
 * El cliente no lee párrafos largos ni listas extensas: cada aviso pide UNA sola cosa con
 * ejemplos en una línea. Primera vez: se pide el nombre de la pieza. Segunda vez: se entrega
 * la conversación a una persona del mostrador. A partir de la tercera vez el bot se queda
 * callado y avisa al panel (no insiste, no sabrosea la conversación).
 */

/**
 * Frases estables presentes en los avisos de fallback.
 * [RED DE SEGURIDAD DEL BOT] Se usan para reconocer cuándo una respuesta es un aviso de
 * "no entendí" y así manejar el contador de fallos consecutivos sin depender de textos largos.
 */
export const FALLBACK_SIGNATURES = [
  'nombre de la pieza',
  'una persona te atiende'
];

/** Variaciones naturales del primer aviso para no repetir siempre el mismo texto. */
const FIRST_FALLBACK_OPENERS = [
  '¡Con gusto te ayudo',
  '¡Estoy aquí para ayudarte',
  '¡Vamos a encontrarla'
];

/**
 * Primer intento: respuesta breve que pide UNA sola cosa (el nombre de la pieza).
 */
export function handleDefaultFallback(pushName: string, settings?: Record<string, string>): string {
  const opener = FIRST_FALLBACK_OPENERS[Math.floor(Math.random() * FIRST_FALLBACK_OPENERS.length)];
  let msg = `${opener}, *${pushName}*! 🔧\n\n`;
  msg += `Dime el *nombre de la pieza* con tus palabras. Ej: *pastillas*, *tripas*, *bujía*, *kit de arrastre*.`;
  return msg;
}

/**
 * Segundo intento: el cliente volvió a no ser entendido. Sin menús gigantes: se prioriza
 * la atención humana y se deja el menú resumido en una sola línea.
 */
export function handleSecondFallback(pushName: string, settings?: Record<string, string>): string {
  let msg = `Listo, *${pushName}*: te paso con una persona del mostrador 👨‍🔧\n\n`;
  msg += `Escribe *VENDEDOR* y una persona te atiende al momento.\n`;
  msg += `O toca una opción: 1️⃣ Insumos · 2️⃣ Repuestos · 3️⃣ Accesorios · 4️⃣ Aceites · 5️⃣ Cashea · 6️⃣ Asesor`;
  return msg;
}

/**
 * [RED DE SEGURIDAD DEL BOT] Detecta si un texto es uno de los avisos de "no entendí".
 * Un texto vacío o ausente también cuenta como fallback (respuesta de silencio).
 */
export function esRespuestaFallback(texto: string): boolean {
  if (!texto) return true;
  const normalizado = texto.toLowerCase();
  return FALLBACK_SIGNATURES.some((sig) => normalizado.includes(sig));
}

export default {
  handleDefaultFallback,
  handleSecondFallback,
  esRespuestaFallback
};
