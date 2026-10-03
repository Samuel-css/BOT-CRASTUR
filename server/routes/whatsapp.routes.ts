/**
 * ============================================================================
 * RUTAS DE CONTROL DE WHATSAPP BAILEYS Y LIVE INBOX (WHATSAPP.ROUTES.TS)
 * ============================================================================
 * Provee la interfaz REST para la gestión del socket de WhatsApp y la bandeja de entrada en vivo:
 * - Inicio y cierre de sesión de Baileys
 * - Reseteo de credenciales en disco (`data/baileys_auth`)
 * - Consulta de sesiones y mensajes para el Live Inbox
 * - Human Takeover (pausar o reanudar bot por chat individual)
 * - Envío manual de mensajes desde el panel administrativo
 * - Depuración y vaciado de historiales de conversación
 * 
 * [ANTI-BANEO META 2025] Enrutamiento de mensajes manuales a través de la cola con presencia 'composing'.
 * [BAILEYS v7 ESM] Interfaz con el ciclo de vida del socket y eventos del Live Inbox.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import { db, toggleBotPause } from '../database';
import {
  startWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  sendManualMessage,
  resumeWhatsAppReconnection,
  isWhatsAppReconnectionPaused
} from '../whatsappService';
import { broadcast } from '../websocket';

/**
 * GET /api/whatsapp/reconnection
 * Informa si la reconexión automática de WhatsApp está pausada tras varios intentos
 * fallidos (p. ej. error 428 sin sesión vinculada).
 */
router.get('/whatsapp/reconnection', (req: Request, res: Response) => {
  res.json({ pausada: isWhatsAppReconnectionPaused() });
});

/**
 * POST /api/whatsapp/reconnection/resume
 * Reactiva manualmente la reconexión automática (usado por "Generar QR"/"Resetear").
 */
router.post('/whatsapp/reconnection/resume', (req: Request, res: Response) => {
  resumeWhatsAppReconnection();
  startWhatsApp();
  res.json({ success: true, pausada: false });
});

/**
 * POST /api/start
 * Inicia el proceso de conexión del socket de Baileys y generación de QR / emparejamiento.
 * Se expone también como /api/whatsapp/start para compatibilidad con el panel.
 */
const startHandler = async (req: Request, res: Response) => {
  try {
    // [SOLICITUD MANUAL] Conectar desde el panel siempre habilita un intento limpio,
    // aunque no haya credenciales guardadas (para poder generar el QR).
    resumeWhatsAppReconnection();
    startWhatsApp();
    res.json({ success: true, message: 'Iniciando servicio de WhatsApp...' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.post('/start', startHandler);
router.post('/whatsapp/start', startHandler);

/**
 * POST /api/logout
 * Desconecta la sesión activa de WhatsApp y opcionalmente limpia el historial de mensajes de la base de datos.
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { clearHistory } = req.body || {};
    await logoutWhatsApp();
    if (clearHistory) {
      db.prepare('DELETE FROM chat_messages').run();
      db.prepare('DELETE FROM chat_sessions').run();
      broadcast('live_chat_message', { action: 'all_deleted' });
      console.log('[WhatsApp] Sesión cerrada y chats eliminados de la base de datos.');
    }
    res.json({ success: true, message: 'Sesión de WhatsApp cerrada exitosamente', cleared: !!clearHistory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Alias compatible con el panel: /api/whatsapp/logout
router.post('/whatsapp/logout', async (req: Request, res: Response) => {
  try {
    const { clearHistory } = req.body || {};
    await logoutWhatsApp();
    if (clearHistory) {
      db.prepare('DELETE FROM chat_messages').run();
      db.prepare('DELETE FROM chat_sessions').run();
      broadcast('live_chat_message', { action: 'all_deleted' });
      console.log('[WhatsApp] Sesión cerrada y chats eliminados de la base de datos.');
    }
    res.json({ success: true, message: 'Sesión de WhatsApp cerrada exitosamente', cleared: !!clearHistory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reset
 * Purga las credenciales almacenadas en `data/baileys_auth` y reinicia el socket en limpio.
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const result = await resetWhatsApp();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Alias compatible con el panel: /api/whatsapp/reset
router.post('/whatsapp/reset', async (req: Request, res: Response) => {
  try {
    const result = await resetWhatsApp();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/inbox
 * Live Inbox: Retorna la lista de las 60 conversaciones más recientes con su último mensaje y estado de apartado.
 */
router.get('/inbox', (req: Request, res: Response) => {
  const sessions = db.prepare(`
    SELECT s.*, 
      (SELECT contenido FROM chat_messages WHERE jid = s.jid ORDER BY id DESC LIMIT 1) as ultimo_mensaje_texto,
      (SELECT remitente FROM chat_messages WHERE jid = s.jid ORDER BY id DESC LIMIT 1) as ultimo_remitente,
      (SELECT COUNT(*) FROM reservations WHERE jid = s.jid AND estado = 'activo') as tiene_apartado_activo,
      (SELECT producto_nombre FROM reservations WHERE jid = s.jid AND estado = 'activo' ORDER BY id DESC LIMIT 1) as apartado_producto,
      (SELECT precio_usd FROM reservations WHERE jid = s.jid AND estado = 'activo' ORDER BY id DESC LIMIT 1) as apartado_monto,
      (SELECT expira_en FROM reservations WHERE jid = s.jid AND estado = 'activo' ORDER BY id DESC LIMIT 1) as apartado_expira_en,
      (SELECT telefono FROM reservations WHERE jid = s.jid ORDER BY id DESC LIMIT 1) as telefono_contacto
    FROM chat_sessions s
    ORDER BY s.ultimo_mensaje_at DESC
    LIMIT 60
  `).all();
  res.json(sessions);
});

/**
 * GET /api/inbox/:jid
 * Live Inbox: Obtiene la conversación completa y metadatos de sesión y apartados para un cliente específico.
 */
router.get('/inbox/:jid', (req: Request, res: Response) => {
  const { jid } = req.params;
  const messages = db.prepare('SELECT * FROM chat_messages WHERE jid = ? ORDER BY id ASC').all(jid);
  const session = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM reservations WHERE jid = s.jid AND estado = 'activo') as tiene_apartado_activo,
      (SELECT producto_nombre FROM reservations WHERE jid = s.jid AND estado = 'activo' ORDER BY id DESC LIMIT 1) as apartado_producto,
      (SELECT precio_usd FROM reservations WHERE jid = s.jid AND estado = 'activo' ORDER BY id DESC LIMIT 1) as apartado_monto,
      (SELECT expira_en FROM reservations WHERE jid = s.jid AND estado = 'activo' ORDER BY id DESC LIMIT 1) as apartado_expira_en,
      (SELECT cedula FROM reservations WHERE jid = s.jid AND estado = 'activo' ORDER BY id DESC LIMIT 1) as apartado_cedula,
      (SELECT telefono FROM reservations WHERE jid = s.jid ORDER BY id DESC LIMIT 1) as telefono_contacto
    FROM chat_sessions s
    WHERE s.jid = ?
  `).get(jid);
  res.json({ session, messages });
});

/**
 * POST /api/chat/pause
 * [ANTI-BANEO META 2025] Human Takeover: Pausa o reanuda las respuestas automáticas del bot en un chat individual.
 */
router.post('/chat/pause', (req: Request, res: Response) => {
  const { jid, pausado } = req.body;
  if (!jid) return res.status(400).json({ error: 'JID es requerido' });

  toggleBotPause(jid, !!pausado);
  broadcast('chat_pause_changed', { jid, pausado: !!pausado });
  res.json({ success: true, jid, pausado: !!pausado });
});

/**
 * POST /api/chat/send-manual
 * Despacha un mensaje redactado por un operador humano a través de la cola de Baileys v7.
 */
router.post('/chat/send-manual', async (req: Request, res: Response) => {
  const { jid, text } = req.body;
  if (!jid || !text) return res.status(400).json({ error: 'JID y texto son requeridos' });

  try {
    const result = await sendManualMessage(jid, text);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/inbox/:jid
 * Elimina una conversación individual y su registro de sesión del Live Inbox.
 */
router.delete('/inbox/:jid', (req: Request, res: Response) => {
  try {
    const { jid } = req.params;
    db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jid);
    db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jid);
    broadcast('live_chat_message', { jid, action: 'deleted' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/inbox/clear-all
 * Vacía la totalidad de los mensajes y sesiones del Live Inbox.
 */
router.post('/inbox/clear-all', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM chat_messages').run();
    db.prepare('DELETE FROM chat_sessions').run();
    broadcast('live_chat_message', { action: 'all_deleted' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/chat/logs
 * Auditoría: Extrae los últimos 50 mensajes y 20 sesiones para diagnóstico rápido.
 */
router.get('/chat/logs', (req: Request, res: Response) => {
  const messages = db.prepare('SELECT * FROM chat_messages ORDER BY id DESC LIMIT 50').all();
  const sessions = db.prepare('SELECT * FROM chat_sessions ORDER BY ultimo_mensaje_at DESC LIMIT 20').all();
  res.json({ messages: messages.reverse(), sessions });
});

export default router;
