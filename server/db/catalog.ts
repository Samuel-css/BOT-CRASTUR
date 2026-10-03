/**
 * ============================================================================
 * IMPORTACIÓN / EXPORTACIÓN DE CATÁLOGO (db/catalog.ts)
 * ============================================================================
 * Transferencia ligera de productos en formato JSON y purga de datos antiguos
 * (retención de privacidad y rendimiento).
 */

import { db, persistDB } from './engine';

/**
 * Exporta el catálogo activo en formato JSON para transferencias ligeras.
 */
export function exportCatalog() {
  const products = db.prepare('SELECT marca, modelo, categoria, precio_usd, descripcion, stock FROM products WHERE activo = 1').all();
  return {
    version: '1.0',
    exportado_en: new Date().toISOString(),
    total: products.length,
    productos: products
  };
}

/**
 * Importa por lote una colección de productos al catálogo de la tienda.
 * [UPSERT SIN DUPLICADOS] Si un producto ya existe (misma marca + modelo), se ACTUALIZA
 * en lugar de insertarse de nuevo. Antes, reimportar el mismo catálogo duplicaba todo el
 * inventario, un problema grave y muy común al migrar entre versiones o PCs.
 *
 * @param productsList - Lista de productos a importar
 * @returns Conteo de productos nuevos y actualizados
 */
export function importCatalog(productsList: any[]) {
  if (!Array.isArray(productsList)) throw new Error('El formato debe ser una lista de productos');

  const findStmt = db.prepare(
    'SELECT id FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?)) LIMIT 1'
  );
  const insertStmt = db.prepare(`
    INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, stock, activo)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const updateStmt = db.prepare(`
    UPDATE products SET categoria = ?, precio_usd = ?, descripcion = ?, stock = ?, activo = 1 WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;
  for (const p of productsList) {
    if (p.marca && p.modelo && p.precio_usd !== undefined) {
      const marca = String(p.marca).trim();
      const modelo = String(p.modelo).trim();
      if (!marca || !modelo) continue;

      let cat = String(p.categoria || 'Otros Productos').trim();
      if (cat === 'Repuestos para Moto' || cat.startsWith('Repuestos para Moto')) {
        cat = cat.replace('Repuestos para Moto', 'Repuestos Moto');
      }
      if (cat === 'Insumos para Caucheras' || cat.startsWith('Insumos para Caucheras')) {
        cat = cat.replace('Insumos para Caucheras', 'Insumos Cauchera');
      }

      const precio = parseFloat(p.precio_usd) || 0;
      const desc = String(p.descripcion || '').trim();
      const stock = parseInt(p.stock || 1, 10);

      const existing = findStmt.get(marca, modelo);
      if (existing) {
        updateStmt.run(cat, precio, desc, stock, existing.id);
        updated++;
      } else {
        insertStmt.run(marca, modelo, cat, precio, desc, stock);
        inserted++;
      }
    }
  }

  persistDB();
  return { success: true, count: inserted + updated, inserted, updated };
}

/**
 * [MANTENIMIENTO/RETENCIÓN]
 * Purga datos antiguos para mantener la base ligera y proteger la privacidad:
 * - chat_messages: conserva los últimos N días (por defecto 90).
 * - bot_metrics: conserva los últimos N días (por defecto 180).
 * Los apartados vencidos ya se purgan aparte tras su período de gracia.
 */
export function purgeOldData(chatRetentionDays = 90, metricsRetentionDays = 180) {
  try {
    const chatCutoff = Date.now() - (chatRetentionDays * 24 * 60 * 60 * 1000);
    const metricsCutoff = Date.now() - (metricsRetentionDays * 24 * 60 * 60 * 1000);

    const beforeMsgs = db.prepare('SELECT COUNT(*) as c FROM chat_messages').get()?.c || 0;
    db.prepare('DELETE FROM chat_messages WHERE timestamp < ?').run(chatCutoff);
    const afterMsgs = db.prepare('SELECT COUNT(*) as c FROM chat_messages').get()?.c || 0;

    const beforeMetrics = db.prepare('SELECT COUNT(*) as c FROM bot_metrics').get()?.c || 0;
    db.prepare('DELETE FROM bot_metrics WHERE timestamp < ?').run(metricsCutoff);
    const afterMetrics = db.prepare('SELECT COUNT(*) as c FROM bot_metrics').get()?.c || 0;

    persistDB();

    const purgedMsgs = beforeMsgs - afterMsgs;
    const purgedMetrics = beforeMetrics - afterMetrics;
    if (purgedMsgs > 0 || purgedMetrics > 0) {
      console.log(`[Purga] Datos antiguos eliminados → ${purgedMsgs} mensajes, ${purgedMetrics} métricas.`);
    }
  } catch (e: any) {
    console.error('[Purga] Error eliminando datos antiguos:', e?.message || e);
  }
}
