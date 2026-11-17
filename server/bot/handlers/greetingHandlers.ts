/**
 * @file greetingHandlers.ts
 * @description Manejadores de respuestas de bienvenida, cortesía y confirmaciones/negaciones cotidianas.
 *
 * [TONO HUMANO Y TRANSPARENTE]
 * La bienvenida aclara que es un asistente virtual y ofrece pasar con una persona.
 * El resto de respuestas mantiene la regla de copy: respuesta primero, máximo 5 líneas,
 * una sola acción y sin repetir el menú completo en cada saludo.
 */

import { buildWelcome, buildShortGreeting, firstName } from '../copy/messages';

/**
 * Genera el mensaje de bienvenida y menú inicial guiado.
 *
 * @param pushName - Nombre público del perfil del cliente
 * @param settings - Configuración general de la tienda
 * @param tasa - Tasa BCV oficial del día (se mantiene por compatibilidad de firma)
 * @returns Mensaje de bienvenida con menú de opciones
 */
export function handleGreetingResponse(
  pushName: string,
  settings: Record<string, string>,
  tasa: number
): string {
  const isClosed = settings && String(settings.fuera_horario_activo) === '1';
  return buildWelcome({ pushName, settings, isClosed, tasa });
}

/**
 * [SALUDAR UNA SOLA VEZ] Respuesta breve cuando el cliente ya vio el menú y vuelve a saludar.
 * Evita repetir el menú completo en cada saludo.
 */
export function handleShortGreeting(pushName: string): string {
  return buildShortGreeting(pushName);
}

/**
 * Responde a expresiones de cortesía, agradecimiento o despedida.
 *
 * @param pushName - Nombre del remitente
 * @param settings - Configuración general de la tienda
 * @returns Mensaje cordial y breve
 */
export function handleCourtesyResponse(pushName: string, settings: Record<string, string>): string {
  return `¡A tu orden, ${firstName(pushName)}! 😊 Si necesitas otra cosa para tu moto o tu cauchera, aquí estoy.`;
}

/**
 * Responde a expresiones afirmativas breves fuera de flujo ("sí", "ok", "dale").
 *
 * @param pushName - Nombre del remitente
 * @returns Orientación para continuar la consulta
 */
export function handleAffirmativeResponse(pushName: string): string {
  return `¡Perfecto, ${firstName(pushName)}! 👍 Dime qué repuesto buscas (ej: pastillas, bujía) y te doy precio al instante.`;
}

/**
 * Responde a expresiones negativas breves ("no", "ya no", "nada").
 *
 * @returns Mensaje de cierre educado
 */
export function handleNegativeResponse(): string {
  return '¡Entendido! 👍 Cuando necesites algo para tu moto o tu cauchera, aquí estamos.';
}

export default {
  handleGreetingResponse,
  handleShortGreeting,
  handleCourtesyResponse,
  handleAffirmativeResponse,
  handleNegativeResponse
};
