/**
 * @file greetingHandlers.ts
 * @description Manejadores de respuestas de bienvenida, cortesía y confirmaciones/negaciones cotidianas.
 * 
 * [MERCADO VENEZUELA]
 * Incluye tasa oficial BCV del día, opciones canónicas de atención (1 a 6) y horario de tienda física.
 */

import { formatRate } from '../utils/formatters';

/**
 * Genera el mensaje de bienvenida y menú inicial guiado.
 * 
 * @param pushName - Nombre público del perfil del cliente
 * @param settings - Configuración general de la tienda
 * @param tasa - Tasa BCV oficial del día
 * @returns Mensaje de bienvenida con menú de opciones
 */
export function handleGreetingResponse(
  pushName: string,
  settings: Record<string, string>,
  tasa: number
): string {
  const tasaFormatted = formatRate(tasa);
  let msg = `¡Hola, *${pushName}*! 👋\n\n`;

  if (settings && String(settings.fuera_horario_activo) === '1') {
    const customNotice = settings.mensaje_fuera_horario;
    if (customNotice) {
      msg += `⏰ ${customNotice}\n\n`;
    } else {
      msg += `⏰ *Tienda cerrada* en este momento (Horario: ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'}).\n`;
      msg += `¡Nuestro asistente virtual está activo 24/7! 💬\n\n`;
    }
  } else {
    msg += `${settings?.mensaje_bienvenida || 'Te damos la bienvenida a *Crastur* 🛞🏍️📦\nTu tienda de insumos para caucheras, repuestos de moto y otros productos en Caracas con Cashea.'}\n\n`;
  }

  // [MENSAJES CORTOS] Menú en 2 líneas: el cliente no lee descripciones largas.
  msg += `🇻🇪 *Tasa BCV:* Bs. ${tasaFormatted} / USD\n\n`;
  msg += `1️⃣ Insumos Cauchera 🛞 · 2️⃣ Repuestos Moto 🏍️ · 3️⃣ Accesorios Moto 🪖\n`;
  msg += `4️⃣ Aceites y Otros 📦 · 5️⃣ Cashea 💛 · 6️⃣ Asesor 👨‍🔧\n\n`;
  msg += `✍️ Escribe el *producto* que buscas (o responde 1 a 6).`;

  return msg;
}

/**
 * [SALUDAR UNA SOLA VEZ] Respuesta breve cuando el cliente ya vio el menú y vuelve a saludar.
 * Evita repetir el menú completo en cada saludo (el bot no debe "sabrosear" la conversación).
 */
export function handleShortGreeting(pushName: string): string {
  return `¡Hola de nuevo, *${pushName}*! 👋 En *Crastur* seguimos listos: dime el *producto* que buscas y te doy precio al instante.`;
}

/**
 * Responde a expresiones de cortesía, agradecimiento o despedida.
 * 
 * @param pushName - Nombre del remitente
 * @param settings - Configuración general de la tienda
 * @returns Mensaje cordial con ubicación y horario
 */
export function handleCourtesyResponse(pushName: string, settings: Record<string, string>): string {
  return `¡A tu orden, *${pushName}*! 😊 En *Crastur* seguimos a la orden para cualquier repuesto de moto o insumo de cauchera 🛞🏍️`;
}

/**
 * Responde a expresiones afirmativas breves fuera de flujo ("sí", "ok", "dale").
 * 
 * @param pushName - Nombre del remitente
 * @returns Orientación para continuar la consulta
 */
export function handleAffirmativeResponse(pushName: string): string {
  let msg = `¡Perfecto, *${pushName}*! 👍\n`;
  msg += `Dime qué repuesto buscas (ej: *pastillas*, *bujía*) y te doy precio al instante.\n`;
  msg += `Escribe *MENU* para ver las opciones o *VENDEDOR* para hablar con una persona.`;
  return msg;
}

/**
 * Responde a expresiones negativas breves ("no", "ya no", "nada").
 * 
 * @returns Mensaje de cierre educado
 */
export function handleNegativeResponse(): string {
  return `¡Entendido! 👍 Cuando necesites algo para tu moto o tu cauchera, aquí estamos en *Crastur* para servirte 🛞🏍️`;
}

export default {
  handleGreetingResponse,
  handleShortGreeting,
  handleCourtesyResponse,
  handleAffirmativeResponse,
  handleNegativeResponse
};
