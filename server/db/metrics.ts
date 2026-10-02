/**
 * ============================================================================
 * MÉTRICAS OPERATIVAS Y TABLEROS DE CONTROL (db/metrics.ts)
 * ============================================================================
 * Registra eventos analíticos del bot y consolida el resumen diario que alimenta
 * el dashboard: consultas, términos más buscados, apartados vigentes y stock crítico.
 */

import { db } from './engine';
import { cleanExpiredReservations } from './reservations';

/**
 * Registra un evento analítico o métrica operativa en SQLite para tableros de control.
 */
export function recordMetric(evento: string, detalle: string = '', jid: string = ''): void {
  try {
    db.prepare(`
      INSERT INTO bot_metrics (evento, detalle, jid, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(evento, detalle, jid, Date.now());
  } catch (e: any) {
    console.error('Error recording metric:', e?.message || e);
  }
}

/**
 * Consolida las estadísticas del día para el panel de métricas operativas.
 */
export function getMetricsSummary() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const totalHoy = db.prepare('SELECT COUNT(*) as count FROM bot_metrics WHERE timestamp >= ?').get(todayMs)?.count || 0;
  const totalMensajes = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get()?.count || 0;
  const totalSesiones = db.prepare('SELECT COUNT(*) as count FROM chat_sessions').get()?.count || 0;
  const topBusquedas = db.prepare(`
    SELECT detalle, COUNT(*) as total
    FROM bot_metrics
    WHERE evento = 'busqueda_producto' AND detalle != ''
    GROUP BY detalle
    ORDER BY total DESC
    LIMIT 5
  `).all();

  // Estadísticas comerciales de apartados e inventario crítico
  cleanExpiredReservations();
  const resStats = db.prepare("SELECT COUNT(*) as count, SUM(precio_usd) as total_usd FROM reservations WHERE estado = 'activo'").get() || {};
  const totalApartados = resStats.count || 0;
  const montoApartadosUsd = parseFloat(resStats.total_usd || 0);

  const stockBajoItems = db.prepare("SELECT id, marca, modelo, categoria, stock, precio_usd FROM products WHERE activo = 1 AND stock IS NOT NULL AND stock <= 3 ORDER BY stock ASC LIMIT 6").all();
  const totalStockBajo = db.prepare("SELECT COUNT(*) as count FROM products WHERE activo = 1 AND stock IS NOT NULL AND stock <= 3").get()?.count || 0;

  const totalCombos = db.prepare("SELECT COUNT(*) as count FROM products WHERE activo = 1 AND categoria = 'Combos & Kits'").get()?.count || 0;
  const totalProductosActivos = db.prepare("SELECT COUNT(*) as count FROM products WHERE activo = 1").get()?.count || 0;

  return {
    consultas_hoy: totalHoy,
    total_mensajes: totalMensajes,
    total_clientes: totalSesiones,
    top_busquedas: topBusquedas,
    apartados_activos_total: totalApartados,
    monto_apartados_usd: montoApartadosUsd,
    stock_bajo_total: totalStockBajo,
    stock_bajo_items: stockBajoItems,
    combos_total: totalCombos,
    total_productos_activos: totalProductosActivos
  };
}
