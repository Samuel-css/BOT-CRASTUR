/**
 * @file live.ts
 * @description Mensajes en vivo: detección de respuestas del asesor, anti-eco del bot,
 * debounce anti-flood, reactivación automática y recuperación de consultas nocturnas.
 */

import {
  db,
  getSettings,
  isBotGloballyPaused,
  isBotPaused,
  shouldReactivateBotForClient
} from '../../database';
import { isWithinBusinessHours } from '../../bot/services/businessRules';
import {
  sock,
  connectionStatus,
  currentUser,
  notifyLiveMessage,
  notifyChatState
} from '../socketState';
import { extractMessageInfo } from '../messageParsing';
import { wasSentByBot, consumeSentMessageId } from '../sending';
import { registerHumanTakeover } from '../takeover';
import { collectAndRegisterAliases, wasStoredAsBotMessage, isRecentAdvisorMessage } from './history';
import { deliverBotResponse } from './deliver';
import { ingestState, CATCHUP_MAX_AGE_MS } from './state';

/**
 * Registra el listener de mensajes entrantes/salientes en tiempo real.
 */
export function registerMessageHandler(): void {
  sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
    // [HUMAN TAKEOVER] Los eventos 'append' (historial sincronizado tras reconectar) ya no se
    // descartan por completo: los mensajes del ASESOR que llegan por esa vía también deben
    // pausar el bot. Los mensajes de clientes por 'append' se ignoran para no responder historial.
    const isLiveEvent = type === 'notify';
    if (!messages || !Array.isArray(messages)) return;

    for (const msg of messages) {
      const jid = msg.key?.remoteJid || '';
      if (!jid) continue;

      // Filtro estricto contra grupos, canales y estados broadcast
      if (jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.includes('@newsletter') || jid.includes('broadcast') || jid === 'status@broadcast') continue;
      if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) continue;

      // [ALIAS LID/NÚMERO] Agrupa las identidades del mismo contacto para que la pausa aplique.
      collectAndRegisterAliases(msg);

      const botPhone = currentUser?.phone || (sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '');
      const senderPhone = jid.split(':')[0].split('@')[0];
      const isSelfChat = botPhone && senderPhone && (botPhone === senderPhone);

      // Mensaje enviado por el propio operador desde el móvil o WhatsApp Web
      if (msg.key.fromMe && !isSelfChat) {
        const msgId = msg.key?.id;
        if (msgId && wasSentByBot(msgId)) {
          consumeSentMessageId(msgId);
          continue;
        }

        const info = extractMessageInfo(msg);
        const msgTime = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();

        // [NO CONFUNDIR AL BOT CON EL ASESOR] En reconexiones, WhatsApp reenvía mensajes
        // que el propio bot ya envió. Se detectan por el registro 'bot' y no pausan nada.
        const isBotCopy = !!(info && wasStoredAsBotMessage(jid, info.text, msgTime));

        if (info && (info.text || info.isMedia)) {
          const rawContent = info.text || `[${info.mediaType || 'Multimedia'}]`;
          const senderType = isBotCopy ? 'bot' : 'asesor';

          const recent = db.prepare(`
            SELECT id FROM chat_messages
            WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 6000
            LIMIT 1
          `).get(jid, rawContent, msgTime);

          if (!recent) {
            try {
              db.prepare(`
                INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                VALUES (?, ?, ?, ?)
              `).run(jid, senderType, rawContent, msgTime);

              const session = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
              if (!session) {
                db.prepare(`
                  INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
                  VALUES (?, 'Cliente', 'start', ?, 0, 0, 1)
                `).run(jid, msgTime);
              } else {
                db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = MAX(ultimo_mensaje_at, ?) WHERE jid = ?')
                  .run(msgTime, jid);
              }

              if (!isBotCopy) {
                notifyLiveMessage({ jid, pushName: 'Asesor Humano', remitente: 'asesor', contenido: rawContent, timestamp: msgTime });
              }
            } catch (e) { }
          }
        }

        // [HUMAN TAKEOVER AUTOMÁTICO] Cualquier señal enviada por una persona —texto, audio,
        // imagen, sticker o incluso una reacción— confirma que el asesor está atendiendo:
        // el bot se silencia, se cancelan respuestas pendientes y el panel recibe el aviso.
        if (!isBotCopy) {
          const paused = registerHumanTakeover(jid, msgTime, 'telefono');
          if (paused) {
            console.log(`[WhatsApp Bot] ✋ Asesor respondió en ${jid}: bot pausado automáticamente.`);
          }
        }
        continue;
      }

      // [SOLO EN VIVO] Los mensajes de clientes que llegan como historial/append NO se
      // responden automáticamente (evita contestar conversaciones viejas al reconectar).
      if (!isLiveEvent) continue;

      // Mensaje entrante del cliente
      const messageTimestamp = msg.messageTimestamp;
      if (messageTimestamp) {
        const ageSec = Math.floor(Date.now() / 1000) - Number(messageTimestamp);

        // [ANTI-BANEO META 2025] No responder mensajes con antigüedad mayor a 1 día.
        // [LIVE INBOX] Aun sin responder, se registran para que un asesor los vea.
        if (ageSec > 24 * 3600) {
          try {
            const oldInfo = extractMessageInfo(msg);
            if (oldInfo && (oldInfo.text || oldInfo.isMedia)) {
              const oldTime = Number(messageTimestamp) * 1000;
              const oldText = oldInfo.text || `[${oldInfo.mediaType || 'Multimedia'}]`;
              const exists = db.prepare(`
                SELECT id FROM chat_messages
                WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 6000
                LIMIT 1
              `).get(jid, oldText, oldTime);
              if (!exists) {
                db.prepare(`
                  INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                  VALUES (?, 'cliente', ?, ?)
                `).run(jid, oldText, oldTime);
                const s = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
                if (!s) {
                  db.prepare(`
                    INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
                    VALUES (?, ?, 'start', ?, 0, 0, 1)
                  `).run(jid, msg.pushName || 'cliente', oldTime);
                }
              }
            }
          } catch {}
          continue;
        }

        // Mensaje acumulado mientras el servidor estuvo apagado (> 3 minutos de antigüedad)
        if (ageSec > 180) {
          const info = extractMessageInfo(msg);
          if (info && (info.text || info.isMedia)) {
            const pushName = msg.pushName || 'cliente';
            const msgTime = Number(messageTimestamp) * 1000;
            const contentText = info.text || `[${info.mediaType || 'Multimedia'}]`;

            const existing = db.prepare(`
              SELECT id FROM chat_messages
              WHERE jid = ? AND contenido = ? AND ABS(timestamp - ?) < 6000
              LIMIT 1
            `).get(jid, contentText, msgTime);

            if (!existing) {
              try {
                db.prepare(`
                  INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
                  VALUES (?, 'cliente', ?, ?)
                `).run(jid, contentText, msgTime);

                const exists = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
                if (!exists) {
                  db.prepare(`
                    INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
                    VALUES (?, ?, 'start', ?, 0, 0, 1)
                  `).run(jid, pushName, msgTime);
                } else {
                  db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = MAX(ultimo_mensaje_at, ?), push_name = COALESCE(?, push_name) WHERE jid = ?')
                    .run(msgTime, pushName, jid);
                }

                notifyLiveMessage({ jid, pushName, remitente: 'cliente', contenido: contentText, timestamp: msgTime });
              } catch (e) { }
            }

            if (info.text && info.text.trim().length > 1) {
              ingestState.overnightCatchupMap.set(jid, { text: info.text.trim(), pushName, msgTime });
            }

            if (ingestState.overnightCatchupTimer) clearTimeout(ingestState.overnightCatchupTimer);
            ingestState.overnightCatchupTimer = setTimeout(async () => {
              if (ingestState.overnightCatchupMap.size === 0) return;
              const entries = Array.from(ingestState.overnightCatchupMap.entries());
              ingestState.overnightCatchupMap.clear();

              if (!isWithinBusinessHours()) {
                console.log('[WhatsApp] Mensajes acumulados registrados en Live Inbox. La tienda física está fuera de horario.');
                return;
              }

              const ahora = Date.now();
              console.log(`[WhatsApp] ☀️ Evaluando ${entries.length} consulta(s) acumulada(s) mientras la PC estuvo apagada...`);
              for (const [targetJid, clientData] of entries) {
                try {
                  // [SIN MENSAJES A DESTIEMPO] Un mensaje viejo ya no se responde solo: llegó
                  // mientras la PC estaba apagada y el cliente (o un asesor) ya siguió adelante.
                  // Solo se atiende si sigue fresco; si no, queda registrado en el Live Inbox.
                  if (ahora - clientData.msgTime > CATCHUP_MAX_AGE_MS) {
                    console.log(`[WhatsApp] Mensaje acumulado de ${targetJid} quedó viejo (${Math.round((ahora - clientData.msgTime) / 60000)} min). Solo se registra en el Live Inbox.`);
                    continue;
                  }

                  if (isBotGloballyPaused() || isBotPaused(targetJid)) {
                    console.log(`[WhatsApp] Mensaje acumulado de ${targetJid} omitido: chat pausado.`);
                    continue;
                  }

                  // [HUMAN TAKEOVER] Si un asesor ya respondió después de ese mensaje, el bot no
                  // interviene: la conversación ya está siendo atendida por una persona.
                  const sesion = db.prepare('SELECT asesor_ultimo_at FROM chat_sessions WHERE jid = ?').get(targetJid);
                  if (sesion?.asesor_ultimo_at && Number(sesion.asesor_ultimo_at) >= clientData.msgTime) {
                    console.log(`[WhatsApp] Mensaje acumulado de ${targetJid} omitido: un asesor ya respondió esa consulta.`);
                    continue;
                  }

                  // Respuesta normal del bot (sin prefijos raros ni saludos a destiempo)
                  await deliverBotResponse(targetJid, clientData.text, clientData.pushName, false, null);
                  await new Promise(r => setTimeout(r, 2000));
                } catch (mErr: any) {
                  console.error(`[WhatsApp] Error respondiendo mensaje acumulado a ${targetJid}:`, mErr?.message || mErr);
                }
              }
            }, 8000);
            if (ingestState.overnightCatchupTimer && ingestState.overnightCatchupTimer.unref) ingestState.overnightCatchupTimer.unref();
          }
          continue;
        }
      }

      // Extracción de contenido del mensaje entrante en tiempo real
      const info = extractMessageInfo(msg);
      if (!info) continue;

      const { text, isMedia, mediaType } = info;
      if (!text && !isMedia) continue;

      const pushName = msg.pushName || 'cliente';
      console.log(`[WhatsApp] 📥 Mensaje recibido de "${pushName}" (${jid}): "${text || `[${mediaType}]`}"`);

      notifyLiveMessage({ jid, pushName, remitente: 'cliente', contenido: text || `[Mensaje ${mediaType}]`, timestamp: Date.now() });

      // [ANTI-BANEO / RITMO HUMANO] Marcar el mensaje como leído (doble check azul) igual que
      // lo haría una persona del mostrador. No añade retardo al flujo y hace ver la cuenta activa.
      try {
        if (sock && connectionStatus === 'connected' && msg.key) {
          await sock.readMessages([msg.key]);
        }
      } catch (readErr: any) { /* el marcado de leído nunca debe interrumpir la atención */ }

      // DEBOUNCING de mensajes en ráfaga (anti-flood): agrupa fragmentos en 1.2s
      if (!ingestState.debounceQueues.has(jid)) {
        ingestState.debounceQueues.set(jid, []);
      }

      ingestState.debounceQueues.get(jid)!.push({ text, isMedia, mediaType, pushName });

      if (ingestState.debounceTimers.has(jid)) {
        clearTimeout(ingestState.debounceTimers.get(jid));
      }

      ingestState.debounceTimers.set(jid, setTimeout(async () => {
        const queue = ingestState.debounceQueues.get(jid) || [];
        ingestState.debounceQueues.delete(jid);
        ingestState.debounceTimers.delete(jid);

        if (queue.length === 0) return;

        const combinedText = queue.map((q: any) => q.text).filter(Boolean).join(' ');
        const hasMediaOnly = !combinedText && queue.some((q: any) => q.isMedia);
        const firstMedia = queue.find((q: any) => q.isMedia);
        const activePushName = queue[queue.length - 1]?.pushName || pushName || 'amigo/a';

        console.log(`[WhatsApp Bot] ⚙️ Procesando consulta de ${activePushName} (${jid}): "${combinedText || '[Multimedia]'}"`);

        // [REACTIVACIÓN AUTOMÁTICA] Si el bot quedó silenciado por un asesor y el cliente
        // vuelve a escribir después del tiempo configurado sin respuesta humana, el bot retoma
        // la conversación como si un vendedor le pasara el chat de nuevo.
        let fueReactivadoPorAsesor = false;
        try {
          const previo = db.prepare('SELECT bot_pausado, bot_pausado_por FROM chat_sessions WHERE jid = ?').get(jid);
          fueReactivadoPorAsesor = !!previo && parseInt(previo.bot_pausado) === 1 && previo.bot_pausado_por === 'asesor';
        } catch {}

        if (shouldReactivateBotForClient(jid) && fueReactivadoPorAsesor) {
          const minutosReactivacion = parseInt(getSettings().reactivar_bot_minutos || '180', 10) || 180;
          const horasTexto = minutosReactivacion >= 60
            ? `${Math.round(minutosReactivacion / 60)} hora(s)`
            : `${minutosReactivacion} minutos`;
          console.log(`[WhatsApp Bot] ♻️ Bot reactivado automáticamente en ${jid} (asesor inactivo).`);
          try {
            db.prepare(`
              INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
              VALUES (?, 'sistema', ?, ?)
            `).run(jid, `♻️ El bot retomó la conversación automáticamente: el asesor no responde hace más de ${horasTexto}.`, Date.now());
          } catch {}
          notifyChatState({ jid, pausado: false, por: null, auto: true, origen: 'auto' });
        }

        // [ROBUSTEZ] No perder mensajes durante la ventana de estabilización: encolar
        if (!ingestState.botReady.value) {
          ingestState.startupMessages.push({ jid, combinedText, pushName: activePushName, hasMediaOnly, firstMedia });
          console.log(`[WhatsApp Bot] ⏳ Bot en fase de inicio. Consulta de ${activePushName} en cola (${ingestState.startupMessages.length}). Se responderá al quedar listo.`);
          return;
        }

        await deliverBotResponse(jid, combinedText, activePushName, hasMediaOnly, firstMedia);
      }, 1200));
    }
  });
}
