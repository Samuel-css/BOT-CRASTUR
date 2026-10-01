/**
 * ============================================================================
 * RUTAS DE SALUD, ESTADO GENERAL Y CONTROL GLOBAL (HEALTH.ROUTES.TS)
 * ============================================================================
 * Expone endpoints para monitoreo del sistema (healthchecks), estado de la tienda
 * física y WhatsApp, pausa global del bot y métricas consolidadas del negocio.
 * 
 * [ARQUITECTURA SQL.JS] Consulta conteos de inventario, asesores y apartados en memoria.
 * [ANTI-BANEO META 2025] Interruptor de pausa global para detener intervenciones automáticas.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import {
  db,
  getSettings,
  getEffectiveRate,
  isBotGloballyPaused,
  setBotGlobalPause,
  getMetricsSummary
} from '../database';
import { getStatus } from '../whatsappService';
import { broadcast } from '../websocket';

/**
 * GET /api/health
 * Healthcheck ultraligero utilizado por monitores de proceso, scripts de inicio y Docker.
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

/**
 * GET /api/status
 * Resumen consolidado del estado del negocio: conexión Baileys, tasa BCV efectiva,
 * productos activos, vendedores disponibles y apartados vigentes.
 */
router.get('/status', (req: Request, res: Response) => {
  const settings = getSettings();
  const tasa = getEffectiveRate();
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE activo = 1').get()?.count || 0;
  const sellerCount = db.prepare('SELECT COUNT(*) as count FROM sellers WHERE activo = 1').get()?.count || 0;
  const apartadosCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE estado = 'activo'").get()?.count || 0;
  const waStatus = getStatus();

  res.json({
    whatsapp: waStatus,
    bot_pausado_global: isBotGloballyPaused(),
    tasa,
    fecha_tasa: settings.fecha_tasa,
    tasa_manual_activa: settings.tasa_manual_activa === '1',
    tasa_personalizada: parseFloat(settings.tasa_personalizada) || tasa,
    total_productos: productCount,
    total_vendedores: sellerCount,
    total_apartados: apartadosCount
  });
});

/**
 * POST /api/bot/pause-global
 * [ANTI-BANEO META 2025] Alterna la pausa global del bot para toda la tienda.
 * Útil durante jornadas de mantenimiento, contingencias o atención humana prioritaria.
 */
router.post('/bot/pause-global', (req: Request, res: Response) => {
  const { pausado } = req.body;
  const nuevoEstado = setBotGlobalPause(pausado !== undefined ? !!pausado : !isBotGloballyPaused());
  broadcast('bot_global_pause_changed', { bot_pausado_global: nuevoEstado });
  res.json({ success: true, bot_pausado_global: nuevoEstado });
});

/**
 * GET /api/metrics
 * Métricas operativas y analíticas del día: consultas atendidas, términos más buscados,
 * apartados activos acumulados en USD y alertas de stock crítico.
 */
router.get('/metrics', (req: Request, res: Response) => {
  res.json(getMetricsSummary());
});

export default router;
