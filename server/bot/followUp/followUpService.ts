/**
 * @file followUpService.ts
 * @description Servicio de seguimiento comercial y recordatorios proactivos automatizados.
 * 
 * [ANTI-BANEO META 2025]
 * Meta penaliza severamente a los números comerciales que envían mensajes proactivos fuera de horario
 * o a usuarios que han solicitado no ser contactados. Este servicio implementa:
 * 1. Validación estricta de horario comercial de tienda física antes de cualquier despacho.
 * 2. Verificación de exclusión voluntaria (`no_molestar = 1` u opt-out).
 * 3. Supresión de seguimientos comerciales si el cliente ya tiene un apartado en curso o reserva activa.
 * 4. Recordatorio preventivo de rescate a las 22 horas para apartados a punto de vencer.
 */

import {
  db,
  getSettings,
  recordMetric,
  getReservationsNeeding22hReminder,
  markReservation22hReminderSent
} from '../../database';
import { isWithinBusinessHours } from '../services/businessRules';
import { normalizeText } from '../utils/textUtils';

/**
 * Evalúa las sesiones de chat inactivas que consultaron un repuesto sin concretar apartado
 * y despacha un recordatorio educado de asistencia comercial.
 *
 * [RECORDATORIOS CON RESPETO]
 * Reglas estrictas para no resultar cansón (aprobadas por el negocio):
 *  1. MÁXIMO 1 recordatorio por conversación (contador `recordatorio_total`).
 *  2. Mínimo 1 hora de silencio del cliente (aunque la configuración pida menos).
 *  3. NUNCA si un asesor humano ya respondió después del último mensaje del cliente.
 *  4. NUNCA si la última palabra del cliente fue una cortesía/cierre ("gracias", "ok", "no"...).
 *  5. NUNCA si el bot quedó en silencio por no entender (3 fallos seguidos).
 *
 * @param sendWhatsAppMessageCallback - Función delegada para encolar el mensaje en el servicio de WhatsApp
 */
async function checkPendingFollowUps(
  sendWhatsAppMessageCallback: (targetJid: string, messageText: string) => Promise<void> | void
): Promise<void> {
  if (typeof sendWhatsAppMessageCallback !== 'function') return;

  const settings = getSettings();
  if (settings.insistencia_activa !== '1') return;

  // [ANTI-BANEO META 2025] Posponer seguimientos si la tienda física está fuera de horario
  if (!isWithinBusinessHours(settings)) {
    console.log('[Seguimiento] Fuera de horario comercial — seguimientos pospuestos hasta apertura.');
    return;
  }

  // [ANTI-BANEO / VENTANA 24H] WhatsApp solo permite iniciar conversación dentro de las 24h
  // siguientes al último mensaje del cliente. Un seguimiento posterior viola la política y
  // arriesga bloqueo, así que se limita la ventana inferior (hace 60 min) y la superior (24h).
  const DAY_MS = 24 * 60 * 60 * 1000;

  // [ANTI-BANEO / CUOTA DIARIA] Tope de mensajes proactivos por día para no enviar ráfagas
  // a muchos clientes el mismo día (patrón que Meta penaliza).
  const cuotaDiaria = (() => {
    const cfg = parseInt(String(settings.proactivos_max_dia ?? '30'), 10);
    return Number.isFinite(cfg) && cfg >= 0 ? cfg : 30;
  })();
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const enviadosHoy = db.prepare(
    "SELECT COUNT(*) as c FROM bot_metrics WHERE evento = 'seguimiento_enviado' AND timestamp >= ?"
  ).get(inicioDia.getTime())?.c || 0;
  if (enviadosHoy >= cuotaDiaria) {
    console.log(`[Seguimiento] Cuota diaria de proactivos alcanzada (${enviadosHoy}/${cuotaDiaria}). Se posponen hasta mañana.`);
    return;
  }

  // [MÍNIMO 1 HORA] Aunque en configuración quede un valor menor, el recordatorio espera al menos 60 minutos.
  const minutosConfigurados = parseInt(settings.insistencia_minutos || '60', 10);
  const minutos = Math.max(60, isNaN(minutosConfigurados) ? 60 : minutosConfigurados);
  const delayMs = minutos * 60 * 1000;
  const now = Date.now();
  const threshold = now - delayMs;
  const threshold24h = now - DAY_MS;

  const pendingSessions = db.prepare(`
    SELECT * FROM chat_sessions
    WHERE ultimo_producto_nombre IS NOT NULL
      AND ultimo_producto_nombre != ''
      AND seguimiento_enviado = 0
      AND bot_pausado = 0
      AND no_molestar = 0
      AND COALESCE(recordatorio_total, 0) < 1
      AND COALESCE(fallos_consecutivos, 0) < 3
      AND ultimo_mensaje_at <= ?
      AND ultimo_mensaje_at >= ?
  `).all(threshold, threshold24h);

  for (const session of pendingSessions) {
    // No interrumpir si el usuario se encuentra en medio de un flujo de apartado
    if (session.step && session.step.startsWith('apartado_')) {
      continue;
    }

    // Si el usuario ya tiene una reserva activa no vencida, marcar como atendido y omitir
    const activeRes = db.prepare(`
      SELECT id FROM reservations
      WHERE jid = ? AND estado = 'activo' AND expira_en > ?
      LIMIT 1
    `).get(session.jid, now);

    if (activeRes) {
      db.prepare(`
        UPDATE chat_sessions
        SET seguimiento_enviado = 1
        WHERE jid = ?
      `).run(session.jid);
      continue;
    }

    // [NUNCA SI UN ASESOR ATENDIÓ] Si un asesor respondió después del último mensaje del
    // cliente, el recordatorio automático sobra: la conversación está en manos humanas.
    const ultimoCliente = db.prepare(`
      SELECT contenido, timestamp FROM chat_messages
      WHERE jid = ? AND remitente = 'cliente'
      ORDER BY timestamp DESC, id DESC LIMIT 1
    `).get(session.jid);

    if (ultimoCliente && session.asesor_ultimo_at && Number(session.asesor_ultimo_at) >= Number(ultimoCliente.timestamp)) {
      console.log(`[Seguimiento] Recordatorio a ${session.jid} omitido: un asesor ya respondió esa consulta.`);
      db.prepare('UPDATE chat_sessions SET seguimiento_enviado = 1 WHERE jid = ?').run(session.jid);
      continue;
    }

    // [NO SER CANSÓN] Si la última palabra del cliente fue un cierre o cortesía, no se recuerda nada.
    // Se usan coincidencias exactas/cortas para no confundir una duda real ("no sé cuál me sirve")
    // con un cierre ("no, gracias").
    const normUltimo = normalizeText(ultimoCliente?.contenido || '');
    const cierresExactos = new Set([
      'gracias', 'muchas gracias', 'mil gracias', 'ok', 'okey', 'ok gracias', 'listo', 'listo gracias',
      'dale', 'dale gracias', 'perfecto', 'perfecto gracias', 'buenas', 'ya', 'no', 'nada', 'nada gracias',
      'chao', 'adios', 'nos vemos', 'hasta luego', 'excelente', 'de acuerdo', 'conforme', 'todo bien', 'todo fino'
    ]);
    const esCierreOCortesia =
      cierresExactos.has(normUltimo) ||
      /^(gracias|ok|listo|dale|perfecto|chao|adios|hasta luego|nos vemos|ya lo|ya la|ya compre|ya tengo|todo bien|todo fino)\b/.test(normUltimo);

    if (esCierreOCortesia) {
      console.log(`[Seguimiento] Recordatorio a ${session.jid} omitido: el cliente cerró la conversación ("${normUltimo.slice(0, 40)}").`);
      db.prepare('UPDATE chat_sessions SET seguimiento_enviado = 1 WHERE jid = ?').run(session.jid);
      continue;
    }

    const pushName = (session.push_name && session.push_name.trim()) ? session.push_name.trim() : 'amigo/a';
    const prodName = (session.ultimo_producto_nombre && session.ultimo_producto_nombre.trim()) ? session.ultimo_producto_nombre.trim() : 'el repuesto consultado';

    let followUpText = settings.mensaje_insistencia || '';
    if (!followUpText) {
      followUpText = `¿Cómo va todo, *${pushName}*? 👋 Quedó pendiente el *${prodName}*. Si aún lo necesitas, con gusto te lo dejo listo en tienda. Cualquier cosa, escribe *VENDEDOR*.`;
    } else {
      // Reemplazo dinámico de variables de plantilla ({nombre}, {producto})
      followUpText = followUpText
        .replace(/\{nombre\}/gi, pushName)
        .replace(/\{producto\}/gi, prodName);

      if (followUpText.includes('{')) {
        followUpText = `¿Cómo va todo, *${pushName}*? 👋 Quedó pendiente el *${prodName}*. Si aún lo necesitas, escribe *VENDEDOR*.`;
      }
    }

    try {
      console.log(`[Seguimiento] Enviando recordatorio educado a ${session.jid} sobre ${prodName}`);
      await sendWhatsAppMessageCallback(session.jid, followUpText);

      db.prepare(`
        UPDATE chat_sessions
        SET seguimiento_enviado = 1,
            recordatorio_total = COALESCE(recordatorio_total, 0) + 1
        WHERE jid = ?
      `).run(session.jid);

      db.prepare(`
        INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
        VALUES (?, 'bot', ?, ?)
      `).run(session.jid, followUpText, Date.now());

      recordMetric('seguimiento_enviado', prodName, session.jid);
    } catch (err: any) {
      console.warn(`[Seguimiento] No se pudo enviar recordatorio a ${session.jid} (${err?.message || err})`);
    }
  }
}

/**
 * Recordatorio preventivo de rescate para apartados con 22 horas de antigüedad (a 2h del vencimiento).
 * Ofrece la posibilidad de coordinar delivery en Caracas antes de la liberación automática de stock.
 * 
 * @param sendWhatsAppMessageCallback - Función delegada para encolar el mensaje en el servicio de WhatsApp
 */
async function check22hReservationReminders(
  sendWhatsAppMessageCallback: (targetJid: string, messageText: string) => Promise<void> | void
): Promise<void> {
  if (typeof sendWhatsAppMessageCallback !== 'function') return;

  // [ANTI-BANEO META 2025] No enviar avisos fuera de horario comercial
  const settings = getSettings();
  if (!isWithinBusinessHours(settings)) {
    console.log('[Apartados 22h] Fuera de horario comercial — avisos de rescate pospuestos.');
    return;
  }

  const needingReminder = getReservationsNeeding22hReminder();

  for (const res of needingReminder) {
    const jid = res.jid;

    // [ANTI-BANEO META 2025] Respetar listas de exclusión voluntaria
    const session = db.prepare('SELECT no_molestar, bot_pausado FROM chat_sessions WHERE jid = ?').get(jid);
    if (session && (session.no_molestar === 1 || session.bot_pausado === 1)) {
      console.log(`[Apartados 22h] ⏸️ Aviso a ${jid} omitido (no_molestar o bot pausado).`);
      markReservation22hReminderSent(res.id);
      continue;
    }

    const pushName = res.nombre ? res.nombre.split(' ')[0] : 'amigo/a';
    const prodName = res.producto_nombre;

    const reminderMsg = `¡Hola, *${pushName}*! 👋 Te recuerdo que tienes apartado tu *${prodName}* en nuestra tienda de San Agustín Norte y te quedan 2 horas de reserva ⏱️.\n\n¿Vienes en camino a retirarlo o prefieres que te coordinemos un motorizado con delivery a tu casa o taller? 🛵\n\n_(Si ya retiraste tu pedido en tienda física, puedes ignorar este mensaje 👍)_`;

    try {
      console.log(`[Apartados 22h] Enviando aviso de rescate a ${jid} sobre ${prodName}`);
      await sendWhatsAppMessageCallback(jid, reminderMsg);
      markReservation22hReminderSent(res.id);

      db.prepare(`
        INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
        VALUES (?, 'bot', ?, ?)
      `).run(jid, reminderMsg, Date.now());

      recordMetric('aviso_apartado_22h', prodName, jid);
    } catch (err: any) {
      console.warn(`[Apartados 22h] Error enviando aviso a ${jid}:`, err?.message || err);
    }
  }
}

export {
  checkPendingFollowUps,
  check22hReservationReminders
};

export default {
  checkPendingFollowUps,
  check22hReminder: check22hReservationReminders
};
