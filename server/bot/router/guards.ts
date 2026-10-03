/**
 * @file guards.ts
 * @description Guardas de seguridad e integridad del router conversacional (Secciones 0 a 3).
 * Evalúa silenciamiento global, pausa por asesor, anti-spam, entradas confusas y multimedia.
 *
 * Devuelve una respuesta (string) si debe cortarse el flujo, el sentinela SILENCE para
 * silenciar sin responder, o null para dejar continuar el enrutamiento.
 */

import { db, isBotGloballyPaused, isBotPaused } from '../../database';
import { isSpamming } from '../utils/antiSpam';
import { handleMediaResponse } from '../handlers/mediaHandlers';
import type { BotMediaInfo } from '../../types/bot';

/** Sentinela que indica "no responder nada" (distinto de "no aplica esta guarda"). */
export const SILENCE = '__CRASTUR_SILENCE__';

/**
 * Ejecuta las guardas de silenciamiento y validación previas al enrutamiento.
 *
 * @returns string (respuesta), SILENCE (silenciar) o null (continuar enrutamiento)
 */
export function runGuards(
  jid: string,
  text: string,
  pushName: string,
  mediaInfo: BotMediaInfo | null,
  session: any
): string | null {
  // [SECCIÓN 0] Control Global de Silenciado
  if (isBotGloballyPaused()) {
    console.log('[Bot] Silenciado globalmente por el panel administrativo. Mensaje guardado en Live Inbox.');
    return SILENCE;
  }

  // [SECCIÓN 1] Pausa Manual por Asesor Humano en esta Conversación
  if (isBotPaused(jid)) {
    console.log(`[Bot] Chat ${jid} pausado manualmente por un asesor humano. Sin auto-respuesta.`);
    return SILENCE;
  }

  // [SECCIÓN 2] [ANTI-BANEO META 2025] Límite de Frecuencia Anti-Spam
  if (isSpamming(jid)) {
    console.log(`[Bot Anti-Spam] ⚠️ Usuario ${jid} superó los límites de frecuencia de Meta. Mensaje silenciado.`);
    return SILENCE;
  }

  // Validaciones de Mensajes Vacíos o de Confusión Extrema
  if (/^[\?¿\s\.]+$/.test(text)) {
    return `¡Hola! 👋 Veo tus signos de interrogación y entiendo que puede estar confundido/a. Le atiendo con toda la *paciencia* del mundo 🙌\n\nSoy el *asistente virtual* de la tienda física de *Crastur* en Caracas. Con gusto le ayudo a encontrar su repuesto:\n\n👉 Escriba el nombre de la pieza o el modelo de la moto, con sus propias palabras (ej: *"bujía"*, *"aceite"*, *"pastillas"*).\n👉 Si prefiere hablar con una *persona real*, escriba *ASESOR* o *HUMANO* y le comunicamos con el mostrador.\n👉 Escriba *MENU* para ver todas las opciones.`;
  }

  if (!text && (!mediaInfo || !mediaInfo.isMedia)) {
    return SILENCE;
  }

  // [SECCIÓN 3] Mensajes Multimedia (Audios, Notas de Voz, Imágenes, Stickers)
  if (mediaInfo && mediaInfo.isMedia) {
    // Si el usuario está en medio de un apartado y envía comprobante o nota de voz
    if (session.step && session.step.startsWith('apartado_')) {
      const stepNames: Record<string, string> = {
        'apartado_pidiendo_nombre': 'tu *Nombre y Apellido*',
        'apartado_pidiendo_cedula': 'tu número de *Cédula de Identidad*',
        'apartado_pidiendo_telefono': 'tu *Número de Teléfono* de contacto'
      };
      const expectedField = stepNames[session.step] || 'el dato solicitado';
      return `¡Recibido! 📎 Recuerda que para completar tu apartado y emitir tu ticket oficial por 24 horas, necesitamos que nos indiques en texto ${expectedField}.\n\n_(Escribe *cancelar* si deseas salir)_`;
    }
    // [INTEGRIDAD] Si el usuario está eligiendo categoría de catálogo PDF y envía multimedia,
    // se resetea el step para que el flujo no quede colgado en 'catalogo_esperando_opcion'.
    if (session.step === 'catalogo_esperando_opcion') {
      try { db.prepare("UPDATE chat_sessions SET step = 'start' WHERE jid = ?").run(jid); } catch (_) {}
      session.step = 'start';
    }
    return handleMediaResponse(mediaInfo.type, pushName);
  }

  return null;
}
