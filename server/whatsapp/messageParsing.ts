/**
 * @file messageParsing.ts
 * @description Utilidades PURAS para desempaquetar y extraer información de mensajes de Baileys.
 * Sin estado ni dependencias del socket: 100% testeable de forma aislada.
 */

/**
 * Desempaqueta capas anidadas de mensajes en el protocolo de Baileys
 * (mensajes efímeros, visualización única, mensajes editados, interactivos, etc.).
 *
 * @param msgContent - Objeto crudo del mensaje de Baileys
 * @returns El contenido del mensaje en su capa más interna
 */
export function unwrapMessage(msgContent: any): any {
  if (!msgContent) return null;
  let current = msgContent;
  let depth = 0;
  while (depth < 8) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
    } else if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
    } else if (current.editedMessage?.message?.protocolMessage?.editedMessage) {
      current = current.editedMessage.message.protocolMessage.editedMessage;
    } else if (current.interactiveMessage?.body) {
      current = current.interactiveMessage;
    } else {
      break;
    }
    depth++;
  }
  return current;
}

/**
 * Extrae texto normalizado, metadatos y tipo multimedia de cualquier mensaje de WhatsApp.
 * Soporta botones interactivos modernos (Native Flow), listas y respuestas rápidas.
 *
 * @param msg - Mensaje completo de Baileys
 * @returns Objeto con texto extraído, banderas de medios y contenido interno
 */
export function extractMessageInfo(msg: any): { text: string; isMedia: boolean; mediaType: string | null; content: any } | null {
  if (!msg || !msg.message) return null;

  const content = unwrapMessage(msg.message);
  if (!content) return null;

  let isMedia = false;
  let mediaType: string | null = null;

  if (content.audioMessage) {
    isMedia = true;
    mediaType = 'audio';
  } else if (content.imageMessage) {
    isMedia = true;
    mediaType = 'image';
  } else if (content.stickerMessage) {
    isMedia = true;
    mediaType = 'sticker';
  } else if (content.videoMessage) {
    isMedia = true;
    mediaType = 'video';
  } else if (content.documentMessage) {
    isMedia = true;
    mediaType = 'document';
  }

  // Extracción de respuestas en botones interactivos de WhatsApp
  let interactiveText = '';
  if (content.interactiveResponseMessage) {
    const ir = content.interactiveResponseMessage;
    if (ir.body?.text) interactiveText = ir.body.text;
    if (ir.nativeFlowResponseMessage?.paramsJson) {
      try {
        const parsed = JSON.parse(ir.nativeFlowResponseMessage.paramsJson);
        interactiveText = parsed.id || parsed.title || parsed.display_text || interactiveText;
      } catch (_) {}
    }
  }

  const text = (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    interactiveText ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.buttonsResponseMessage?.selectedButtonId ||
    content.listResponseMessage?.singleSelectReply?.selectedRowId ||
    content.listResponseMessage?.title ||
    content.templateButtonReplyMessage?.selectedId ||
    content.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  ).trim();

  return { text, isMedia, mediaType, content };
}
