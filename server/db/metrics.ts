/**
 * ============================================================================
 * MÉTRICAS OPERATIVAS Y TABLEROS DE CONTROL (db/metrics.ts)
 * ============================================================================
 * Registra eventos analíticos del bot y consolida el resumen diario que alimenta
 * el dashboard: consultas, términos más buscados, apartados vigentes y stock crítico.
 */

import { db } from './engine';
import { cleanExpiredReservations } from './reservations';
import { canonicalCategoryOf } from '../bot/config/categoryGroups';

/**
 * Cuenta los productos pertenecientes a la línea "Combos & Kits" (por prefijo),
 * tolerando subcategorías como "Combos & Kits - Promociones".
 */
function countCombos(): number {
  const all: any[] = db.prepare('SELECT categoria FROM products WHERE activo = 1').all();
  return all.filter(p => String(p.categoria || '').toLowerCase().includes('combo')).length;
}

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

  // [CATEGORÍAS CANÓNICAS] Conteo real por categoría agrupando subcategorías del panel
  // (ej. "Lubricantes & Fluidos - ..." cuenta como "Otros Productos"). Permite detectar
  // qué líneas comerciales aún no tienen productos cargados.
  const allActive: any[] = db.prepare('SELECT categoria FROM products WHERE activo = 1').all();
  const conteoCategorias: Record<string, number> = {
    'Insumos Cauchera': 0,
    'Repuestos Moto': 0,
    'Accesorios Moto': 0,
    'Otros Productos': 0,
    'Sin clasificar': 0
  };
  for (const p of allActive) {
    const canon = canonicalCategoryOf(p.categoria);
    conteoCategorias[canon || 'Sin clasificar'] += 1;
  }

  const totalCombos = countCombos();
  const totalProductosActivos = allActive.length;

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
    total_productos_activos: totalProductosActivos,
    productos_por_categoria: conteoCategorias
  };
}
