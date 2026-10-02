/**
 * @file mediaHandlers.ts
 * @description Manejador de respuestas ante mensajes no textuales (audios, fotos, stickers, videos).
 * Informa amablemente las limitaciones del bot automatizado y ofrece alternativas de texto o asesor humano.
 */

/**
 * Genera la respuesta ante la recepción de un archivo multimedia.
 * 
 * @param mediaTypeOrPushName - Tipo de medio ('audio', 'image', 'video', etc.) o nombre del usuario
 * @param pushNameOrMediaType - Nombre del usuario o tipo de medio alternativo
 * @returns Mensaje orientador para continuar la consulta en texto o transferir al asesor
 */
export function handleMediaResponse(mediaTypeOrPushName?: string, pushNameOrMediaType?: string): string {
  let mediaType = 'multimedia';
  let pushName = 'amigo/a';

  if (mediaTypeOrPushName === 'audio' || mediaTypeOrPushName === 'voice' || mediaTypeOrPushName === 'image' || mediaTypeOrPushName === 'video' || mediaTypeOrPushName === 'sticker') {
    mediaType = mediaTypeOrPushName;
    pushName = pushNameOrMediaType || 'amigo/a';
  } else {
    pushName = mediaTypeOrPushName || 'amigo/a';
    mediaType = pushNameOrMediaType || 'multimedia';
  }

  const tipoLabel = (mediaType === 'audio' || mediaType === 'voice') ? 'tu nota de voz' : 'tu foto/archivo';
  let msg = `¡Hola, *${pushName}*! 👋\n\n`;
  msg += `He recibido ${tipoLabel}. En nuestro canal automatizado de WhatsApp no puedo escuchar audios ni abrir fotos directamente 😊.\n\n`;
  msg += `📌 *Para ayudarte de inmediato:*\n`;
  msg += `👉 Escribe en texto el repuesto o accesorio que buscas (ejemplo: *"pastillas de freno Bera"*, *"aceite 20w50"*, *"bujía"*, *"parches"*, *"kit de arrastre"*).\n`;
  msg += `👉 O escribe *VENDEDOR* para que uno de nuestros asesores técnicos revise tu nota o imagen y te cotice.\n\n`;
  msg += `¡Estamos a tu total orden! 🛞🏍️✨`;
  return msg;
}

export default {
  handleMediaResponse
};
