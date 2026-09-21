const { db, getSettings, recordMetric } = require('../../database');

/**
 * Motor de insistencia educada / seguimiento automático
 */
async function checkPendingFollowUps(sendWhatsAppMessageCallback) {
  if (typeof sendWhatsAppMessageCallback !== 'function') return;

  const settings = getSettings();
  if (settings.insistencia_activa !== '1') return;

  const minutos = parseInt(settings.insistencia_minutos || '15', 10);
  const delayMs = minutos * 60 * 1000;
  const now = Date.now();
  const threshold = now - delayMs;

  const pendingSessions = db.prepare(`
    SELECT * FROM chat_sessions
    WHERE ultimo_producto_nombre IS NOT NULL
      AND seguimiento_enviado = 0
      AND bot_pausado = 0
      AND ultimo_mensaje_at <= ?
  `).all(threshold);

  for (const session of pendingSessions) {
    const pushName = session.push_name || 'amigo/a';
    const prodName = session.ultimo_producto_nombre;

    let followUpText = settings.mensaje_insistencia || '';
    if (!followUpText) {
      followUpText = `¡Hola, *${pushName}*! 👋 Quería saber si pudiste revisar la información del *${prodName}*. Te recuerdo que contamos con garantía, entrega inmediata en tienda y financiamiento con Cashea 💛. Si tienes cualquier duda o deseas que un asesor te asista directamente, escribe *VENDEDOR* y con gusto te atendemos.`;
    } else {
      followUpText = followUpText
        .replace(/\{nombre\}/gi, pushName)
        .replace(/\{producto\}/gi, prodName);
    }

    try {
      console.log(`[Seguimiento] Enviando recordatorio educado a ${session.jid} sobre ${prodName}`);
      await sendWhatsAppMessageCallback(session.jid, followUpText);

      db.prepare(`
        UPDATE chat_sessions
        SET seguimiento_enviado = 1
        WHERE jid = ?
      `).run(session.jid);

      db.prepare(`
        INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
        VALUES (?, 'bot', ?, ?)
      `).run(session.jid, followUpText, Date.now());

      recordMetric('seguimiento_enviado', prodName, session.jid);
    } catch (err) {
      // Si falló (por ejemplo, desconexión temporal), silenciar y esperar a que WhatsApp esté reconectado
      console.warn(`[Seguimiento] No se pudo enviar recordatorio a ${session.jid} (${err.message})`);
    }
  }
}

module.exports = {
  checkPendingFollowUps
};
