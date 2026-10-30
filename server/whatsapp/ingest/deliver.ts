/**
 * @file deliver.ts
 * @description Despacho de la respuesta del bot: verificación de última milla (human
 * takeover), anti-duplicado, presencia de escritura y envío de texto/imagen/documento.
 * Incluye la cola de arranque.
 */

import { db, getSettings, isBotGloballyPaused, isBotPaused } from '../../database';
import { processIncomingMessage } from '../../bot';
import { sock, connectionStatus, currentUser } from '../socketState';
import { sendTextMessage, sendProductMessage, sendDocumentMessage, trackSentMessageId } from '../sending';
import { standardizeBotMessage } from '../../bot/utils/textUtils';
import { canBotSend } from '../takeover';
import { ingestState } from './state';

/** True si el handoff de este chat sigue pendiente (aún no lo atendió un humano). */
function isHandoffPending(jid: string): boolean {
  try {
    const row = db.prepare('SELECT handoff_estado FROM chat_sessions WHERE jid = ?').get(jid) as any;
    return row?.handoff_estado === 'pendiente';
  } catch {
    return false;
  }
}

export async function deliverBotResponse(
  jid: string,
  combinedText: string,
  pushName: string,
  hasMediaOnly: boolean,
  firstMedia: any
): Promise<void> {
  // [CONCURRENCIA] Si ya se está respondiendo a este chat, se omite la segunda cadena para
  // no enviar la misma respuesta dos veces (carrera entre debounce, cola y catch-up).
  if (ingestState.processingJids.has(jid)) {
    console.log(`[WhatsApp Bot] ⏳ Ya hay una respuesta en curso para ${jid}; se omite el duplicado concurrente.`);
    return;
  }
  ingestState.processingJids.add(jid);
  try {
    const mediaParam = hasMediaOnly ? { isMedia: true, type: firstMedia?.mediaType } : null;
    const response: any = await processIncomingMessage(jid, combinedText, pushName, mediaParam);
    // [HANDOFF] La promesa de asesor pausa el chat, pero debe salir igual para que el
    // cliente sepa el plazo. Solo esta respuesta usa el bypass.
    const bypassPause = !!(response && typeof response === 'object' && response.bypassPause === true);
    const allowPausedSend = () => bypassPause && isHandoffPending(jid);

    // [HUMAN TAKEOVER AUTOMÁTICO] Verificación de última milla: si un asesor escribió (o el
    // panel pausó el chat) mientras el bot procesaba el mensaje, la respuesta se descarta.
    if (response && !allowPausedSend() && !canBotSend(jid)) {
      console.log(`[WhatsApp Bot] ⏸️ Respuesta a ${jid} descartada: el chat fue tomado por un asesor humano.`);
      return;
    }

    if (response) {
      console.log(`[WhatsApp Bot] 🤖 Simulando presencia de escritura para ${jid}...`);

      const textoRespuesta: string = typeof response === 'object' && response !== null
        ? (response.text || response.caption || '')
        : (response ? String(response) : '');

      // [ANTI-DUPLICADO] Si la respuesta es idéntica a la última que ya envió el bot hace menos
      // de 90 segundos, se omite: evita el molesto "doble mensaje seguido" cuando el cliente
      // repite la misma pregunta en ráfaga.
      let esDuplicadoReciente = false;
      try {
        const ultimoBot = db.prepare(`
          SELECT contenido, timestamp FROM chat_messages
          WHERE jid = ? AND remitente = 'bot'
          ORDER BY id DESC LIMIT 1
        `).get(jid);
        // [FIX] En BD se guarda el texto ya estandarizado; comparar contra el crudo no coincidía
        // y el mecanismo anti-duplicado no frenaba nada.
        const textoNormalizado = standardizeBotMessage(textoRespuesta);
        esDuplicadoReciente = !!(
          ultimoBot &&
          textoRespuesta &&
          (ultimoBot.contenido === textoRespuesta || ultimoBot.contenido === textoNormalizado) &&
          Date.now() - Number(ultimoBot.timestamp) < 90000
        );
      } catch {}

      if (esDuplicadoReciente) {
        console.log(`[WhatsApp Bot] 🔁 Respuesta idéntica reciente para ${jid}: se omite el envío duplicado.`);
        return;
      }

      try {
        if (sock && connectionStatus === 'connected') {
          await sock.sendPresenceUpdate('composing', jid);
        }
      } catch (pErr: any) { }

      // [ANTI-BANEO / RITMO HUMANO] El tiempo de "escribiendo..." crece con el largo del texto
      // (como una persona real tecleando) pero con tope de 4.2s para no frenar la atención.
      const typingDelay = Math.min(4200, 900 + textoRespuesta.length * 22) + Math.floor(Math.random() * 400);
      await new Promise(res => setTimeout(res, typingDelay));

      // [HUMAN TAKEOVER / ÚLTIMA MILLA] Volver a comprobar DESPUÉS del retardo de escritura.
      // Antes la pausa se revisaba solo antes de esos ~4,6 s; si el asesor contestaba en ese
      // lapso, el bot enviaba su respuesta igual por encima de la persona.
      if (!allowPausedSend() && !canBotSend(jid)) {
        console.log(`[WhatsApp Bot] ⏸️ Envío a ${jid} cancelado tras el retardo: un asesor tomó el chat.`);
        try {
          if (sock && connectionStatus === 'connected') {
            await sock.sendPresenceUpdate('paused', jid);
          }
        } catch { /* la presencia es opcional */ }
        return;
      }

      console.log(`[WhatsApp Bot] 🤖 Despachando respuesta a ${jid}...`);

      if (typeof response === 'object' && response !== null && response.document) {
        await sendDocumentMessageProxy(jid, response.document, response.fileName, response.caption, response.mimetype);
      } else if (typeof response === 'object' && response !== null && response.text) {
        await sendProductMessageProxy(jid, response.text, response.image);
      } else if (typeof response === 'string') {
        await sendTextMessage(jid, response);
      }

      // [MERCADO VENEZUELA] Pin interactivo si la respuesta refiere a la ubicación de la tienda
      if (textoRespuesta && textoRespuesta.includes('Liberalba') && textoRespuesta.includes('Google Maps') && canBotSend(jid)) {
        try {
          if (sock && connectionStatus === 'connected') {
            // [ANTI-BANEO] Pequeña pausa para no enviar 3 mensajes seguidos sin respiro.
            await new Promise(res => setTimeout(res, 700 + Math.floor(Math.random() * 500)));
            const locMsg = await sock.sendMessage(jid, {
              location: {
                degreesLatitude: 10.5015,
                degreesLongitude: -66.9015,
                name: 'Crastur - Insumos Cauchera y Repuestos Moto',
                address: 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas'
              }
            });
            if (locMsg?.key?.id) trackSentMessageId(locMsg.key.id);
            console.log(`[WhatsApp Bot] 📍 Pin de ubicación interactivo enviado a ${jid}`);
          }
        } catch (locErr: any) {
          console.warn('[WhatsApp Bot] No se pudo enviar pin interactivo:', locErr?.message || locErr);
        }
      }

      // Tarjeta vCard oficial si el cliente pide explícitamente guardar el contacto
      const normInput = (combinedText || '').toLowerCase().trim();
      const explicitContactRequest =
        normInput === 'guardar contacto' ||
        normInput === 'guardar tu contacto' ||
        normInput === 'guardar su contacto' ||
        normInput === 'guardar numero' ||
        normInput === 'guardar tu numero' ||
        normInput.includes('como te guardo') ||
        normInput.includes('como los guardo') ||
        normInput.includes('como agrego el contacto') ||
        normInput.includes('dame tu contacto') ||
        normInput.includes('enviame tu contacto') ||
        normInput.includes('mandame el contacto') ||
        normInput.includes('quiero guardarte') ||
        normInput.includes('como guardo crastur');
      if (explicitContactRequest && canBotSend(jid)) {
        try {
          if (sock && connectionStatus === 'connected') {
            const botPhone = currentUser?.phone || (sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '584120000000');
            const vcard = 'BEGIN:VCARD\n'
              + 'VERSION:3.0\n'
              + 'FN:Crastur - Repuestos e Insumos\n'
              + 'ORG:Crastur Caracas;\n'
              + `TEL;type=CELL;type=VOICE;waid=${botPhone}:+${botPhone}\n`
              + 'NOTE:Tienda Física en San Agustín Norte - Insumos de Cauchera y Repuestos Moto\n'
              + 'URL:https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA\n'
              + 'END:VCARD';

            const cardMsg = await sock.sendMessage(jid, {
              contacts: { displayName: 'Crastur - Repuestos e Insumos', contacts: [{ vcard }] }
            });
            if (cardMsg?.key?.id) trackSentMessageId(cardMsg.key.id);
            console.log(`[WhatsApp Bot] 📇 Tarjeta de contacto oficial enviada a ${jid}`);
          }
        } catch (cardErr: any) {
          console.warn('[WhatsApp Bot] No se pudo enviar tarjeta de contacto:', cardErr?.message || cardErr);
        }
      }

      try {
        if (sock && connectionStatus === 'connected') {
          await sock.sendPresenceUpdate('paused', jid);
        }
      } catch (pErr: any) { }

      console.log(`[WhatsApp Bot] ✅ Respuesta enviada exitosamente a ${jid}`);
    } else {
      console.log(`[WhatsApp Bot] ℹ️ Sin respuesta automática para ${jid} (chat pausado manualmente)`);
    }
  } catch (engineErr: any) {
    console.error('[WhatsApp Bot] ❌ Error procesando o enviando respuesta:', engineErr);
  } finally {
    ingestState.processingJids.delete(jid);
  }
}

// Indirecciones para evitar dependencias circulares con sending.ts en tiempo de carga
async function sendProductMessageProxy(jid: string, text: string, image?: string) {
  return sendProductMessage(jid, text, image);
}
async function sendDocumentMessageProxy(jid: string, doc: any, fileName?: string, caption?: string, mimetype?: string) {
  return sendDocumentMessage(jid, doc, fileName, caption, mimetype);
}

/**
 * [ROBUSTEZ DE ARRANQUE] Responde las consultas recibidas durante la ventana de estabilización.
 */
export async function flushPendingStartupMessages(): Promise<void> {
  if (ingestState.startupMessages.length === 0) return;
  const batch = ingestState.startupMessages.splice(0, ingestState.startupMessages.length);
  console.log(`[WhatsApp Bot] ☀️ Procesando ${batch.length} consulta(s) acumuladas durante el arranque...`);

  for (const item of batch) {
    try {
      if (isBotGloballyPaused() || isBotPaused(item.jid)) {
        console.log(`[WhatsApp Bot] Consulta de arranque de ${item.jid} omitida (bot pausado).`);
        continue;
      }
      await deliverBotResponse(item.jid, item.combinedText, item.pushName, item.hasMediaOnly, item.firstMedia);
      await new Promise(r => setTimeout(r, 1800));
    } catch (e: any) {
      console.error(`[WhatsApp Bot] Error respondiendo consulta de arranque a ${item.jid}:`, e?.message || e);
    }
  }
}
