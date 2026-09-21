/**
 * Manejador de respuestas de audio / fotos / stickers
 */
function handleMediaResponse(pushName, mediaType) {
  const tipoLabel = mediaType === 'audio' ? 'tu nota de voz' : 'tu foto/archivo';
  let msg = `¡Hola, *${pushName}*! 👋\n\n`;
  msg += `He recibido ${tipoLabel}. En nuestro canal automatizado de WhatsApp no puedo escuchar audios ni abrir fotos directamente 😊.\n\n`;
  msg += `📌 *Para ayudarte de inmediato:*\n`;
  msg += `👉 Escribe en texto el repuesto o accesorio que buscas (ejemplo: *"pastillas Aveo"*, *"aceite 20w50"*, *"batería"*, *"amortiguador"*).\n`;
  msg += `👉 O escribe *VENDEDOR* para que uno de nuestros asesores técnicos revise tu nota o imagen y te cotice.\n\n`;
  msg += `¡Estamos a tu total orden! 🚗✨`;
  return msg;
}

module.exports = {
  handleMediaResponse
};
