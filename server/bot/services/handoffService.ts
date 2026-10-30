/**
 * @file handoffService.ts
 * @description Cesión explícita de un chat a un asesor humano con SLA configurable.
 *
 * Flujo:
 *  1. El cliente pide un asesor → se registra el handoff, el bot se pausa SOLO en ese
 *     chat y se deja un aviso visible en el Live Inbox con los datos del cliente.
 *  2. Si un humano responde por la misma línea, el handoff se marca como atendido.
 *  3. Si vence el plazo sin respuesta, se avisa una sola vez al cliente, el bot retoma
 *     la conversación y el panel recibe una alerta roja.
 *
 * Todo se guarda en `chat_sessions`, así que sobrevive reinicios y cortes de energía.
 * No usa temporizadores en memoria: `checkHandoffSla` se ejecuta desde el intervalo
 * de 60 segundos de la conexión.
 */

import { db, getSettings, recordMetric, isBotGloballyPaused } from '../../database';
import { resolveChatJids } from '../../db/aliases';
import { notifyLiveMessage, notifyChatState } from '../../whatsapp/socketState';
import { isWithinBusinessHours } from './businessRules';

export interface HandoffRegistration {
  created: boolean;
  message: string;
  venceAt?: number;
  fueraHorario?: boolean;
}

/** Minutos de SLA configurados (60 por defecto; 0 = desactivado). */
export function getHandoffSlaMinutes(settings: Record<string, string> = getSettings()): number {
  const raw = parseInt(String(settings.handoff_sla_minutos ?? '60'), 10);
  if (!Number.isFinite(raw) || raw < 0) return 60;
  return raw;
}

/** Formatea una hora en el huso de Caracas: "03:40 p.m." */
function formatCaracasTime(timestamp: number): string {
  try {
    return new Date(timestamp)
      .toLocaleTimeString('es-VE', {
        timeZone: 'America/Caracas',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      .replace(/\s?([ap])\.?\s?m\.?/i, ' $1.m.')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return new Date(timestamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  }
}

/** Texto humano del plazo: "1 hora" o "30 minutos". */
function minutesLabel(minutes: number): string {
  if (minutes === 60) return '1 hora';
  return `${minutes} minutos`;
}

/** Teléfono visible del cliente (contacto capturado o JID). */
function formatClientPhone(jid: string, session: any): string {
  const contacto = String(session?.telefono_contacto || '').trim();
  if (contacto && contacto !== 'Cuenta de WhatsApp') return contacto;
  if (String(jid).endsWith('@lid')) return 'Cuenta de WhatsApp';
  const digits = String(jid).split('@')[0].split(':')[0];
  if (/^58\d{10}$/.test(digits)) {
    return `+58 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}

function buildClientMessage(pushName: string, minutes: number, venceAt: number): string {
  return (
    `¡Listo, *${pushName}*! 🙌 Ya avisé al equipo de ventas.\n\n` +
    `Un *asesor* te escribirá por este mismo chat en un máximo de *${minutesLabel(minutes)}*.\n` +
    `⏰ Hora límite: *${formatCaracasTime(venceAt)}*\n\n` +
    `Si prefieres no esperar, escribe *MENU* y te atiendo al instante.`
  );
}

function buildOutsideHoursMessage(pushName: string, settings: Record<string, string>): string {
  const horario = (settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM').replace(/\s*\|\s*/g, ' · ');
  return (
    `¡Gracias por escribirnos, *${pushName}*! 🙌 Nuestro equipo de ventas está fuera de horario en este momento.\n\n` +
    `Un asesor te escribirá al abrir: *${horario}*.\n\n` +
    `Mientras tanto, puedo ayudarte con precios y disponibilidad. Dime qué repuesto buscas o escribe *MENU*.`
  );
}

function buildSellerNotice(
  jid: string,
  pushName: string,
  session: any,
  limiteTexto: string,
  solicitadoAt: number
): string {
  const producto = String(session?.ultimo_producto_nombre || '').trim() || 'Consulta general';
  return (
    `🔔 *Solicitud de asesor*\n` +
    `👤 Cliente: *${pushName}*\n` +
    `📱 Contacto: ${formatClientPhone(jid, session)}\n` +
    `🛞 Interés: ${producto}\n` +
    `⏰ Solicitado: ${formatCaracasTime(solicitadoAt)} · Límite: *${limiteTexto}*\n\n` +
    `✍️ Responde por este mismo chat para cumplir el SLA.`
  );
}

function buildOutsideHoursNotice(jid: string, pushName: string, session: any, at: number): string {
  const producto = String(session?.ultimo_producto_nombre || '').trim() || 'Consulta general';
  return (
    `🌙 *Solicitud de asesor fuera de horario*\n` +
    `👤 Cliente: *${pushName}*\n` +
    `📱 Contacto: ${formatClientPhone(jid, session)}\n` +
    `🛞 Interés: ${producto}\n` +
    `⏰ Solicitado: ${formatCaracasTime(at)}\n\n` +
    `El bot sigue atendiendo. Responde al abrir para retomar la conversación.`
  );
}

function buildExpiryMessage(pushName: string): string {
  return (
    `Hola, *${pushName}*. Pasó el tiempo de espera y un asesor aún no se ha conectado.\n\n` +
    `Para no dejarte esperando, retomo la conversación 🙌\n\n` +
    `Dime qué repuesto buscas o escribe *MENU* para ver las opciones.`
  );
}

/**
 * Registra una solicitud de asesor. Si la tienda está cerrada, solo deja el aviso
 * al panel y el bot sigue atendiendo (no tiene sentido silenciarlo toda la noche).
 */
export function registerHandoff(params: {
  jid: string;
  pushName: string;
  session: any;
  settings: Record<string, string>;
  text?: string;
}): HandoffRegistration {
  const { jid, pushName, session, settings } = params;
  const now = Date.now();
  const minutes = getHandoffSlaMinutes(settings);

  if (minutes <= 0) {
    return { created: false, message: '' };
  }

  // Si ya hay una solicitud vigente no se reinicia el plazo (evita extenderlo para siempre).
  if (session?.handoff_estado === 'pendiente' && Number(session?.handoff_vence_at) > now) {
    return {
      created: false,
      message:
        `Ya tienes una solicitud de asesor activa, *${pushName}*. ` +
        `Un asesor te escribirá antes de las *${formatCaracasTime(Number(session.handoff_vence_at))}*.\n\n` +
        `Si prefieres no esperar, escribe *MENU* y te atiendo al instante.`
    };
  }

  const dentroDeHorario = isWithinBusinessHours(settings);

  if (!dentroDeHorario) {
    const notice = buildOutsideHoursNotice(jid, pushName, session, now);
    let avisoId: any = null;
    try {
      const res = db.prepare(`
        INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
        VALUES (?, 'sistema', ?, ?)
      `).run(jid, notice, now);
      avisoId = res?.lastInsertRowid;
    } catch {}
    try {
      db.prepare(`
        UPDATE chat_sessions
        SET handoff_solicitado_at = ?, handoff_vence_at = NULL, handoff_estado = 'fuera_horario',
            handoff_aviso_enviado = 1, handoff_atendido_at = NULL, handoff_origen = 'vendedor',
            seguimiento_enviado = 1
        WHERE jid = ?
      `).run(now, jid);
    } catch {}

    notifyLiveMessage({
      id: avisoId,
      jid,
      pushName: 'Sistema',
      remitente: 'sistema',
      contenido: notice,
      timestamp: now
    });
    notifyChatState({
      jid,
      pausado: false,
      por: null,
      auto: true,
      origen: 'handoff_fuera_horario',
      handoff: false,
      handoffEstado: 'fuera_horario',
      cliente: pushName,
      notify: true
    });
    recordMetric('handoff_fuera_horario', pushName, jid);

    return {
      created: false,
      fueraHorario: true,
      message: buildOutsideHoursMessage(pushName, settings)
    };
  }

  const venceAt = now + minutes * 60 * 1000;
  const limiteTexto = `${minutesLabel(minutes)} (${formatCaracasTime(venceAt)})`;
  const notice = buildSellerNotice(jid, pushName, session, limiteTexto, now);

  let avisoId: any = null;
  try {
    const res = db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'sistema', ?, ?)
    `).run(jid, notice, now);
    avisoId = res?.lastInsertRowid;
  } catch {}

  try {
    db.prepare(`
      UPDATE chat_sessions
      SET handoff_solicitado_at = ?,
          handoff_vence_at = ?,
          handoff_estado = 'pendiente',
          handoff_aviso_enviado = 0,
          handoff_atendido_at = NULL,
          handoff_origen = 'vendedor',
          bot_pausado = 1,
          bot_pausado_por = 'handoff',
          bot_pausado_at = ?,
          seguimiento_enviado = 1,
          fallos_consecutivos = 0
      WHERE jid = ?
    `).run(now, venceAt, now, jid);
  } catch {}

  // Mantener sincronizada la sesión en memoria de este mismo mensaje.
  if (session) {
    session.handoff_solicitado_at = now;
    session.handoff_vence_at = venceAt;
    session.handoff_estado = 'pendiente';
    session.handoff_aviso_enviado = 0;
    session.handoff_atendido_at = null;
    session.handoff_origen = 'vendedor';
    session.bot_pausado = 1;
    session.bot_pausado_por = 'handoff';
    session.bot_pausado_at = now;
    session.seguimiento_enviado = 1;
  }

  notifyLiveMessage({
    id: avisoId,
    jid,
    pushName: 'Sistema',
    remitente: 'sistema',
    contenido: notice,
    timestamp: now
  });
  notifyChatState({
    jid,
    pausado: true,
    por: 'handoff',
    auto: true,
    origen: 'handoff',
    handoff: true,
    handoffEstado: 'pendiente',
    handoffSolicitadoAt: now,
    handoffVenceAt: venceAt,
    handoffVenceTexto: formatCaracasTime(venceAt),
    cliente: pushName,
    notify: true
  });
  recordMetric('handoff_solicitado', `${pushName} · ${session?.ultimo_producto_nombre || 'Consulta general'}`, jid);
  console.log(`[Handoff] 🕒 ${pushName} (${jid}) pidió asesor. Vence a las ${formatCaracasTime(venceAt)}`);
  return {
    created: true,
    venceAt,
    message: buildClientMessage(pushName, minutes, venceAt)
  };
}

/** Marca como atendido el handoff de todas las identidades del contacto. */
export function markHandoffAttended(jid: string, at: number = Date.now(), origen: string = 'asesor'): number {
  let actualizados = 0;
  for (const target of resolveChatJids(jid)) {
    let rows: any[] = [];
    try {
      rows = db.prepare(`
        SELECT jid, handoff_solicitado_at, handoff_estado
        FROM chat_sessions
        WHERE jid = ? AND handoff_estado IN ('pendiente', 'fuera_horario', 'vencido')
      `).all(target) as any[];
    } catch {
      rows = [];
    }

    for (const row of rows) {
      const solicitado = Number(row.handoff_solicitado_at) || 0;
      if (solicitado && at < solicitado) continue;
      try {
        db.prepare(`
          UPDATE chat_sessions
          SET handoff_estado = 'atendido',
              handoff_atendido_at = ?,
              handoff_aviso_enviado = 1
          WHERE jid = ? AND handoff_estado IN ('pendiente', 'fuera_horario', 'vencido')
        `).run(at, target);
        actualizados++;
        const minutos = solicitado ? Math.max(0, Math.round((at - solicitado) / 60000)) : 0;
        const fueTarde = row.handoff_estado === 'vencido';
        recordMetric(fueTarde ? 'handoff_atendido_tarde' : 'handoff_atendido', `${origen} · ${minutos} min`, target);
        // El aviso de estado del chat lo emite el llamador (takeover o ruta /chat/pause)
        // con el `por` correcto; aquí solo se actualiza la base de datos.
        console.log(`[Handoff] ✅ Atendido por ${origen} en ${minutos} min${fueTarde ? ' (tarde)' : ''} (${target}).`);
      } catch {}
    }
  }
  return actualizados;
}

/**
 * Cancela el handoff (por ejemplo si el cliente escribe MENU). Si el bot estaba
 * pausado por el handoff, se reanuda; una pausa manual nunca se toca.
 */
export function cancelHandoff(jid: string, reason: string = 'cliente'): boolean {
  let cancelados = 0;
  for (const target of resolveChatJids(jid)) {
    try {
      const row = db.prepare(`
        SELECT handoff_estado, bot_pausado, bot_pausado_por
        FROM chat_sessions WHERE jid = ?
      `).get(target) as any;
      if (!row || !['pendiente', 'fuera_horario'].includes(String(row.handoff_estado || ''))) continue;

      db.prepare(`
        UPDATE chat_sessions
        SET handoff_estado = 'cancelado',
            handoff_aviso_enviado = 1,
            handoff_atendido_at = NULL
        WHERE jid = ?
      `).run(target);

      if (parseInt(row.bot_pausado) === 1 && row.bot_pausado_por === 'handoff') {
        db.prepare(`
          UPDATE chat_sessions
          SET bot_pausado = 0, bot_pausado_por = NULL, bot_pausado_at = NULL
          WHERE jid = ?
        `).run(target);
      }

      cancelados++;
      recordMetric('handoff_cancelado', reason, target);
      notifyChatState({
        jid: target,
        pausado: false,
        por: null,
        auto: true,
        origen: 'handoff_cancelado',
        handoff: false,
        handoffEstado: 'cancelado',
        notify: false
      });
    } catch {}
  }
  return cancelados > 0;
}

/**
 * Revisa los handoffs vencidos. Se ejecuta cada 60 segundos desde connection.ts.
 * @param sendClientMessage Callback para encolar el mensaje al cliente (outbound queue).
 */
export async function checkHandoffSla(
  sendClientMessage: (jid: string, text: string) => Promise<void> | void
): Promise<void> {
  const now = Date.now();
  let pendientes: any[] = [];
  try {
    pendientes = db.prepare(`
      SELECT * FROM chat_sessions
      WHERE handoff_estado = 'pendiente'
        AND handoff_vence_at IS NOT NULL
        AND handoff_vence_at <= ?
    `).all(now) as any[];
  } catch {
    return;
  }

  for (const session of pendientes) {
    const jid = session.jid;
    const solicitado = Number(session.handoff_solicitado_at) || 0;

    // Si un humano respondió, el SLA se cumple aunque el chequeo llegue tarde.
    if (solicitado && Number(session.asesor_ultimo_at) >= solicitado) {
      markHandoffAttended(jid, Number(session.asesor_ultimo_at), 'asesor');
      continue;
    }

    try {
      db.prepare(`
        UPDATE chat_sessions
        SET handoff_estado = 'vencido', handoff_aviso_enviado = 1
        WHERE jid = ? AND handoff_estado = 'pendiente'
      `).run(jid);
    } catch {}

    const pushName = String(session.push_name || 'amigo/a').trim() || 'amigo/a';
    const pausaManual = session.bot_pausado_por === 'manual';
    const globalPause = isBotGloballyPaused();
    const sinMensajes = parseInt(session.no_molestar || 0) === 1;

    // Reanudar el bot solo si la pausa era del handoff.
    if (!pausaManual) {
      try {
        db.prepare(`
          UPDATE chat_sessions
          SET bot_pausado = 0, bot_pausado_por = NULL, bot_pausado_at = NULL
          WHERE jid = ? AND bot_pausado_por = 'handoff'
        `).run(jid);
      } catch {}
    }

    const aviso = `🔴 *SLA vencido:* ${pushName} esperó el plazo sin respuesta de un asesor. El bot retomó la conversación.`;
    let avisoId: any = null;
    try {
      const res = db.prepare(`
        INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
        VALUES (?, 'sistema', ?, ?)
      `).run(jid, aviso, now);
      avisoId = res?.lastInsertRowid;
    } catch {}

    notifyLiveMessage({
      id: avisoId,
      jid,
      pushName: 'Sistema',
      remitente: 'sistema',
      contenido: aviso,
      timestamp: now
    });

    if (!pausaManual && !globalPause && !sinMensajes) {
      try {
        await sendClientMessage(jid, buildExpiryMessage(pushName));
      } catch (err: any) {
        console.warn(`[Handoff] No se pudo enviar el aviso de vencimiento a ${jid}:`, err?.message || err);
      }
    }

    notifyChatState({
      jid,
      pausado: pausaManual,
      por: pausaManual ? 'manual' : null,
      auto: true,
      origen: 'handoff_vencido',
      handoff: false,
      handoffEstado: 'vencido',
      handoffVencido: true,
      cliente: pushName,
      notify: true
    });
    recordMetric('handoff_vencido', `${pushName} · ${Math.round((now - solicitado) / 60000)} min`, jid);
    console.log(`[Handoff] 🔴 SLA vencido para ${pushName} (${jid}).`);
  }
}

/** Datos del handoff para diagnóstico/pruebas. */
export function getHandoffInfo(jid: string): any {
  try {
    return db.prepare(`
      SELECT jid, handoff_solicitado_at, handoff_vence_at, handoff_estado,
             handoff_aviso_enviado, handoff_atendido_at, handoff_origen,
             bot_pausado, bot_pausado_por, asesor_ultimo_at
      FROM chat_sessions WHERE jid = ?
    `).get(jid);
  } catch {
    return null;
  }
}

export default {
  getHandoffSlaMinutes,
  registerHandoff,
  markHandoffAttended,
  cancelHandoff,
  checkHandoffSla,
  getHandoffInfo
};
