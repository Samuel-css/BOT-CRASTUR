/**
 * Mensaje cuando no hay coincidencia
 */
function handleDefaultFallback(pushName, settings) {
  let msg = `¡Hola, *${pushName}*! 😊\n\n`;
  msg += `No logré ubicar el producto con esa descripción, pero con gusto te ayudo:\n\n`;
  msg += `👉 Puedes escribir el nombre del producto (por ejemplo: *"parches"*, *"pega"*, *"valvulas"*, *"kit de arrastre"*, *"pastillas"*, *"bujia"*, *"tripa"*, *"refrigerante"*, *"bombillo"*).\n`;
  msg += `👉 Si buscas un repuesto de moto, indícanos el modelo de tu moto (ej: *Bera SBR*, *Empire Horse*, *Owen*, etc.).\n`;
  msg += `👉 Si prefieres que una persona te atienda directamente, escribe *VENDEDOR*.\n`;
  msg += `👉 O escribe *MENU* para ver todas las opciones disponibles.`;
  return msg;
}

module.exports = {
  handleDefaultFallback
};
