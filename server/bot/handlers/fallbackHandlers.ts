/**
 * @file fallbackHandlers.ts
 * @description Manejador de respuesta por defecto cuando el enrutador no detecta coincidencias
 * en el catálogo ni en las intenciones del usuario.
 *
 * [RED DE SEGURIDAD DEL BOT] Implementa un doble intento: la primera vez que no entiende,
 * ofrece ejemplos; si vuelve a no entender (2º seguido), ofrece el menú completo y deriva de
 * inmediato a un asesor humano. NUNCA deja al cliente sin una salida.
 */

/**
 * Primer intento: respuesta amigable de contingencia con ejemplos de búsqueda.
 */
export function handleDefaultFallback(pushName: string, settings?: Record<string, string>): string {
  let msg = `¡Hola, *${pushName}*! 😊\n\n`;
  msg += `No logré ubicar el producto con esa descripción, pero con gusto te ayudo:\n\n`;
  msg += `👉 Puedes escribir el nombre del producto (por ejemplo: *"parches"*, *"pega"*, *"valvulas"*, *"kit de arrastre"*, *"pastillas"*, *"bujia"*, *"tripa"*, *"refrigerante"*, *"bombillo"*).\n`;
  msg += `👉 Si buscas un repuesto de moto, indícanos el modelo de tu moto (ej: *Bera SBR*, *Empire Horse*, *Owen*, etc.).\n`;
  msg += `👉 Si prefieres que una persona te atienda directamente, escribe *VENDEDOR*.\n`;
  msg += `👉 O escribe *MENU* para ver todas las opciones disponibles.`;
  return msg;
}

/**
 * Segundo intento: el cliente volvió a no ser entendido. Ofrecemos el menú completo
 * y priorizamos la atención humana para no frustrarlo.
 */
export function handleSecondFallback(pushName: string, settings?: Record<string, string>): string {
  const horario = settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM';
  let msg = `¡Gracias por tu paciencia, *${pushName}*! 🙏🏍️\n\n`;
  msg += `Para no hacerte perder tiempo, te dejo las opciones más rápidas:\n\n`;
  msg += `1️⃣ *Insumos Cauchera* 🛞 _(parches, pegas, válvulas, plomos, tripas)_\n`;
  msg += `2️⃣ *Repuestos Moto* 🏍️ _(kits de arrastre, pastillas, bujías, bandas)_\n`;
  msg += `3️⃣ *Accesorios Moto* 🪖 _(puños, retrovisores, luces LED, cascos)_\n`;
  msg += `4️⃣ *Otros Productos* 📦 _(aceites, refrigerantes, aditivos)_\n`;
  msg += `5️⃣ *Pagar con Cashea* 💛 _(en tienda física)\n`;
  msg += `6️⃣ *Hablar con un Asesor* 👨‍🔧\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Responde con el *número* de tu opción, escribe el *producto* que buscas, o escribe *VENDEDOR* para que una persona te atienda de inmediato.\n`;
  msg += `🕒 *Horario:* ${horario}`;
  return msg;
}

export default {
  handleDefaultFallback,
  handleSecondFallback
};
