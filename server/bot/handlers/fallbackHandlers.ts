/**
 * @file fallbackHandlers.ts
 * @description Manejador de respuesta por defecto cuando el enrutador no detecta coincidencias
 * en el catálogo ni en las intenciones del usuario.
 */

/**
 * Genera una respuesta amigable de contingencia ofreciendo ejemplos de búsqueda de repuestos
 * e invitando a la atención asistida con un vendedor humano.
 * 
 * @param pushName - Nombre del remitente
 * @param settings - Configuración general de la tienda
 * @returns Mensaje de fallback interactivo
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

export default {
  handleDefaultFallback
};
