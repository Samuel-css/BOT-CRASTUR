/**
 * ============================================================================
 * RUTAS DE INVENTARIO Y CATÁLOGO DE PRODUCTOS (PRODUCTS.ROUTES.TS)
 * ============================================================================
 * Gestiona el catálogo de repuestos de motos, insumos de cauchera y combos:
 * listado enriquecido con precios en Bolívares (tasa BCV) e inicial/cuotas Cashea,
 * creación, edición, eliminación y módulo de ajuste masivo de precios.
 * 
 * [MERCADO VENEZUELA]
 * - Enriquecimiento dinámico en el listado con conversión a Bs y desglose de cuotas quincenales Cashea.
 * - Validación estricta de precio mayor a cero y tamaño de imágenes en Base64 (< 5MB).
 * - Notificaciones WebSocket (`products_updated`) e invalidación de caché del PDF de catálogo.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import { db, getSettings, getEffectiveRate, saveMasterSnapshotToDisk } from '../database';
import { clearCatalogCache } from '../bot/services/catalogPdfService';
import { invalidateProductCache } from '../bot/services/searchService';
import { broadcast } from '../websocket';
import type { Product } from '../types/database';

/**
 * [RESILIENCIA] Envuelve un handler síncrono para capturar errores y responder 500
 * en formato JSON, sin dejar que una excepción no capturada tumbe el proceso.
 */
const safe = (handler: (req: Request, res: Response) => any) => (req: Request, res: Response) => {
  try {
    return handler(req, res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err?.message || 'Error interno del servidor' });
    }
  }
};

/**
 * GET /api/products
 * Retorna todos los productos del catálogo enriquecidos con su equivalencia en Bs y cuotas de Cashea.
 */
router.get('/', (req: Request, res: Response) => {
  const products: Product[] = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  const tasa = getEffectiveRate();
  const settings = getSettings();
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const inicialPct = parseFloat(settings.cashea_inicial_pct || '40') / 100;

  const enriched = products.map((p) => {
    const precioUsd = parseFloat(String(p.precio_usd)) || 0;
    const precioBs = precioUsd * tasa;
    const inicialUsd = precioUsd * inicialPct;
    const cuotaUsd = cuotasCashea > 0 ? (precioUsd - inicialUsd) / cuotasCashea : 0;

    return {
      ...p,
      precio_bs: precioBs,
      cashea_inicial_usd: inicialUsd,
      cashea_inicial_bs: inicialUsd * tasa,
      cashea_cuota_usd: cuotaUsd,
      cashea_cuota_bs: cuotaUsd * tasa
    };
  });

  res.json({ products: enriched });
});

/**
 * POST /api/products
 * Registra un nuevo producto o kit en el catálogo comercial.
 */
router.post('/', safe((req: Request, res: Response) => {
  const { marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, permitir_duplicado } = req.body;

  if (!marca || !modelo || !categoria || precio_usd === undefined) {
    return res.status(400).json({ error: 'Marca, modelo, categoría y precio en USD son obligatorios' });
  }

  // [VALIDACIÓN] Los campos de texto deben ser cadenas; evita TypeError por datos malformados.
  const safeMarca = String(marca).trim();
  const safeModelo = String(modelo).trim();
  const safeCategoria = String(categoria).trim();
  if (!safeMarca || !safeModelo || !safeCategoria) {
    return res.status(400).json({ error: 'Marca, modelo y categoría no pueden estar vacíos' });
  }

  // [PREVENCIÓN DE DUPLICADOS] Evita crear dos veces el mismo repuesto (misma marca + modelo),
  // un error frecuente al cargar inventario. Se compara sin distinguir mayúsculas ni espacios.
  // El panel puede forzar la creación enviando `permitir_duplicado: true`.
  if (!permitir_duplicado) {
    const duplicado = db.prepare(
      'SELECT id, marca, modelo FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?)) LIMIT 1'
    ).get(safeMarca, safeModelo);
    if (duplicado) {
      return res.status(409).json({
        success: false,
        duplicado: true,
        existingId: duplicado.id,
        error: `Ya existe un repuesto igual en el catálogo: "${duplicado.marca} - ${duplicado.modelo}". Actualízalo en vez de crearlo de nuevo.`
      });
    }
  }

  const parsedPrice = parseFloat(precio_usd);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'El precio en USD debe ser un número válido mayor a 0' });
  }

  const parsedStock = stock !== undefined ? parseInt(stock, 10) : 1;
  if (isNaN(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'El stock debe ser un número entero mayor o igual a 0' });
  }

  if (imagen_url && typeof imagen_url === 'string' && imagen_url.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'La imagen excede el límite permitido de 5 MB' });
  }

  const result = db.prepare(`
    INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    safeMarca,
    safeModelo,
    safeCategoria,
    parsedPrice,
    typeof descripcion === 'string' ? descripcion.trim() : '',
    typeof imagen_url === 'string' ? imagen_url.trim() : '',
    parsedStock
  );

  clearCatalogCache();
  invalidateProductCache();
  broadcast('products_updated', { action: 'created', id: result.lastInsertRowid });
  saveMasterSnapshotToDisk();
  res.json({ success: true, id: result.lastInsertRowid });
}));

/**
 * PUT /api/products/:id
 * Modifica las propiedades, precio, existencias o estado de un producto existente.
 */
router.put('/:id', safe((req: Request, res: Response) => {
  const { id } = req.params;
  const { marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo } = req.body;

  // [INTEGRIDAD] El producto debe existir; antes se respondía "success" aunque el id no existiera.
  const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!exists) {
    return res.status(404).json({ success: false, error: 'El repuesto indicado no existe en el catálogo.' });
  }

  // [VALIDACIÓN] Si se envía un campo de texto, no puede quedar vacío (rompería el catálogo).
  const safeText = (val: any, campo: string): string | null | { error: string } => {
    if (val === undefined) return null;
    const t = String(val).trim();
    if (!t) return { error: `El campo "${campo}" no puede quedar vacío.` };
    return t;
  };
  const m = safeText(marca, 'marca'); if (m && typeof m === 'object') return res.status(400).json({ error: m.error });
  const mo = safeText(modelo, 'modelo'); if (mo && typeof mo === 'object') return res.status(400).json({ error: mo.error });
  const ca = safeText(categoria, 'categoría'); if (ca && typeof ca === 'object') return res.status(400).json({ error: ca.error });

  let parsedPrice: number | null = null;
  if (precio_usd !== undefined) {
    parsedPrice = parseFloat(precio_usd);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'El precio en USD debe ser un número válido mayor a 0' });
    }
  }

  let parsedStock: number | null = null;
  if (stock !== undefined) {
    parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'El stock debe ser un número entero mayor o igual a 0' });
    }
  }

  if (imagen_url && typeof imagen_url === 'string' && imagen_url.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'La imagen excede el límite permitido de 5 MB' });
  }

  db.prepare(`
    UPDATE products
    SET marca = COALESCE(?, marca),
        modelo = COALESCE(?, modelo),
        categoria = COALESCE(?, categoria),
        precio_usd = COALESCE(?, precio_usd),
        descripcion = COALESCE(?, descripcion),
        imagen_url = COALESCE(?, imagen_url),
        stock = COALESCE(?, stock),
        activo = COALESCE(?, activo)
    WHERE id = ?
  `).run(
    m,
    mo,
    ca,
    parsedPrice,
    descripcion !== undefined ? (typeof descripcion === 'string' ? descripcion.trim() : '') : null,
    imagen_url !== undefined ? (typeof imagen_url === 'string' ? imagen_url.trim() : '') : null,
    parsedStock,
    activo !== undefined ? (activo ? 1 : 0) : null,
    id
  );

  clearCatalogCache();
  invalidateProductCache();
  broadcast('products_updated', { action: 'updated', id });
  saveMasterSnapshotToDisk();
  res.json({ success: true });
}));

/**
 * DELETE /api/products/:id
 * Elimina físicamente un producto del catálogo de la base de datos.
 * [INTEGRIDAD] Rechaza el borrado si el producto tiene apartados activos, para no dejar
 * reservas huérfanas y evitar inconsistencias de stock.
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activas = db.prepare(`
      SELECT COUNT(*) AS c FROM reservations r
      WHERE r.estado = 'activo' AND (
        r.producto_id = ? OR (r.items_json IS NOT NULL AND r.items_json LIKE ?)
      )
    `).get(id, `%\"id\":${Number(id)}%`) as any;

    if (activas && Number(activas.c) > 0) {
      return res.status(409).json({
        success: false,
        error: 'No se puede eliminar: este repuesto tiene un apartado activo. Cancela o entrega el apartado primero.'
      });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    clearCatalogCache();
    invalidateProductCache();
    broadcast('products_updated', { action: 'deleted', id });
    saveMasterSnapshotToDisk();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/products/bulk-price-adjustment
 * [MERCADO VENEZUELA] Ajuste masivo de precios por porcentaje o monto fijo en dólares,
 * filtrable por categoría o lista de identificadores seleccionados.
 */
router.post('/bulk-price-adjustment', (req: Request, res: Response) => {
  try {
    const { tipo = 'percentage', valor, categoria = 'all', productIds, direccion = 'aumentar' } = req.body;

    const numVal = parseFloat(valor);
    if (isNaN(numVal) || numVal <= 0) {
      return res.status(400).json({ error: 'El valor de ajuste debe ser un número mayor a 0' });
    }

    let query = 'SELECT id, marca, modelo, categoria, precio_usd FROM products WHERE activo = 1';
    const params: any[] = [];

    if (categoria && categoria !== 'all') {
      query += ' AND (categoria = ? OR categoria LIKE ?)';
      params.push(categoria, `${categoria} -%`);
    }

    if (Array.isArray(productIds) && productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...productIds);
    }

    const prods = db.prepare(query).all(...params);
    if (prods.length === 0) {
      return res.json({ success: true, count: 0, message: 'No hay productos que coincidan con el filtro' });
    }

    const updateStmt = db.prepare('UPDATE products SET precio_usd = ? WHERE id = ?');
    let updatedCount = 0;

    for (const p of prods) {
      let nuevoPrecio = parseFloat(p.precio_usd) || 0;
      if (tipo === 'percentage') {
        const factor = numVal / 100;
        if (direccion === 'disminuir') {
          nuevoPrecio = Math.max(0.01, nuevoPrecio * (1 - factor));
        } else {
          nuevoPrecio = nuevoPrecio * (1 + factor);
        }
      } else {
        if (direccion === 'disminuir') {
          nuevoPrecio = Math.max(0.01, nuevoPrecio - numVal);
        } else {
          nuevoPrecio = nuevoPrecio + numVal;
        }
      }

      nuevoPrecio = Math.round(nuevoPrecio * 100) / 100;
      updateStmt.run(nuevoPrecio, p.id);
      updatedCount++;
    }

    clearCatalogCache();
    invalidateProductCache();
    broadcast('products_updated', { action: 'bulk_price_updated', count: updatedCount });
    saveMasterSnapshotToDisk();
    res.json({ success: true, count: updatedCount, message: `Se actualizaron los precios de ${updatedCount} productos.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
