/**
 * ============================================================================
 * APARTADOS Y RESERVAS 24 HORAS (db/reservations.ts)
 * ============================================================================
 * Motor transaccional del sistema de apartados comerciales:
 * - Control atómico de stock multi-producto (combos y piezas individuales).
 * - Caducidad estricta a 24 horas con reposición automática de inventario.
 * - Período de gracia de 12 horas para auditoría antes de purgar el registro.
 *
 * [MERCADO VENEZUELA] Tickets con C.I./RIF venezolano y precio dual USD/Bs.
 */

import { db, persistDB } from './engine';

/**
 * Consulta la lista de apartados comerciales registrados.
 * @param onlyActive Si es true, retorna únicamente aquellos tickets vigentes no vencidos ni cancelados.
 */
export function getReservations(onlyActive = false) {
  cleanExpiredReservations();
  if (onlyActive) {
    return db.prepare("SELECT * FROM reservations WHERE estado = 'activo' ORDER BY expira_en ASC").all();
  }
  return db.prepare("SELECT * FROM reservations ORDER BY id DESC").all();
}

/**
 * [APARTADOS Y RESERVAS 24H]
 * Crea un apartado formal con 24 horas continuas de validez.
 * Descuenta atómicamente 1 unidad del inventario físico de CADA ítem del apartado
 * (soporta combos multi-producto, no solo el primer producto).
 */
export function createReservation({ jid, nombre, cedula, telefono, producto_id, producto_nombre, precio_usd, precio_bs, items }: any) {
  const now = Date.now();
  const expiraEn = now + (24 * 60 * 60 * 1000); // 24 horas continuas de vigencia

  // Normalizar la lista de ítems a reservar: usa el detalle del combo si viene, o el producto único
  let itemsToReserve: Array<{ id: number; nombre: string }> = [];
  if (Array.isArray(items) && items.length > 0) {
    itemsToReserve = items
      .filter((it: any) => it && it.id !== undefined && it.id !== null)
      .map((it: any) => ({ id: Number(it.id), nombre: String(it.nombre || '') }));
  } else if (producto_id !== undefined && producto_id !== null && producto_id !== '') {
    itemsToReserve = [{ id: Number(producto_id), nombre: String(producto_nombre || '') }];
  }

  // Eliminar duplicados por id (un mismo producto no debe descontarse dos veces)
  const seenIds = new Set<number>();
  itemsToReserve = itemsToReserve.filter(it => {
    if (seenIds.has(it.id)) return false;
    seenIds.add(it.id);
    return true;
  });

  // 1. Validar existencias de TODOS los ítems antes de descontar (evita apartados a medias)
  for (const item of itemsToReserve) {
    const prod = db.prepare('SELECT id, stock, activo, marca, modelo FROM products WHERE id = ?').get(item.id);
    if (!prod) {
      throw new Error(`El repuesto "${item.nombre}" ya no está disponible en el catálogo.`);
    }
    if (prod.stock !== null && prod.stock !== undefined && prod.stock <= 0) {
      throw new Error(`El repuesto "${item.nombre || `${prod.marca} ${prod.modelo}`}" no cuenta con stock disponible para apartar.`);
    }
  }

  // 2. Descontar atómicamente una unidad de cada ítem del apartado
  for (const item of itemsToReserve) {
    db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0').run(item.id);
  }

  // Almacenar el detalle de ítems para poder reponer el stock exacto al vencer/cancelar
  const itemsJson = itemsToReserve.length > 0 ? JSON.stringify(itemsToReserve) : null;

  const stmt = db.prepare(`
    INSERT INTO reservations (jid, nombre, cedula, telefono, producto_id, producto_nombre, precio_usd, precio_bs, creado_en, expira_en, estado, items_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', ?)
  `);
  const res = stmt.run(
    jid || '',
    nombre.trim(),
    cedula.trim().toUpperCase(),
    telefono.trim(),
    producto_id || (itemsToReserve[0]?.id ?? null),
    producto_nombre.trim(),
    parseFloat(precio_usd) || 0,
    parseFloat(precio_bs) || 0,
    now,
    expiraEn,
    itemsJson
  );
  persistDB();
  return {
    id: res.lastInsertRowid,
    jid,
    nombre: nombre.trim(),
    cedula: cedula.trim().toUpperCase(),
    telefono: telefono.trim(),
    producto_id: producto_id || (itemsToReserve[0]?.id ?? null),
    producto_nombre: producto_nombre.trim(),
    precio_usd: parseFloat(precio_usd) || 0,
    precio_bs: parseFloat(precio_bs) || 0,
    creado_en: now,
    expira_en: expiraEn,
    estado: 'activo'
  };
}

/**
 * Repone al inventario las unidades correspondientes a un apartado.
 * Usa el detalle de ítems del combo (items_json); si no existe, repone solo el producto principal.
 */
export function restoreReservationStock(current: any): void {
  let items: Array<{ id: number }> = [];
  if (current && current.items_json) {
    try {
      const parsed = JSON.parse(current.items_json);
      if (Array.isArray(parsed)) {
        items = parsed.filter((it: any) => it && it.id !== undefined && it.id !== null).map((it: any) => ({ id: Number(it.id) }));
      }
    } catch {}
  }

  if (items.length === 0 && current && current.producto_id) {
    items = [{ id: Number(current.producto_id) }];
  }

  const seen = new Set<number>();
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(it.id);
  }
}

/**
 * Descuenta del inventario las unidades correspondientes a un apartado (al reactivarlo).
 */
export function deductReservationStock(current: any): void {
  let items: Array<{ id: number }> = [];
  if (current && current.items_json) {
    try {
      const parsed = JSON.parse(current.items_json);
      if (Array.isArray(parsed)) {
        items = parsed.filter((it: any) => it && it.id !== undefined && it.id !== null).map((it: any) => ({ id: Number(it.id) }));
      }
    } catch {}
  }

  if (items.length === 0 && current && current.producto_id) {
    items = [{ id: Number(current.producto_id) }];
  }

  const seen = new Set<number>();
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    db.prepare('UPDATE products SET stock = MAX(0, stock - 1) WHERE id = ?').run(it.id);
  }
}

/** Estados válidos y oficiales de un apartado. */
export const ESTADOS_RESERVA_VALIDOS = ['activo', 'entregado', 'cancelado', 'vencido'] as const;

/**
 * Modifica el estado de un apartado (activo, entregado, cancelado, vencido).
 * Repone o descuenta el stock físico según la transición de estado (soporta combos).
 *
 * [INTEGRIDAD] Valida que el estado sea uno de los permitidos y que el registro exista,
 * evitando corromper el apartado con valores arbitrarios desde el panel o la API.
 *
 * @throws Error si el estado no es válido o el apartado no existe.
 */
export function updateReservationStatus(id: number | string, estado: string) {
  if (!estado || !ESTADOS_RESERVA_VALIDOS.includes(String(estado) as any)) {
    throw new Error(`Estado de apartado inválido. Debe ser uno de: ${ESTADOS_RESERVA_VALIDOS.join(', ')}.`);
  }

  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!current) {
    throw new Error(`No existe un apartado con el ID ${id}.`);
  }

  if (current) {
    // Si se cancela o vence un apartado activo, devolver stock al catálogo
    if ((estado === 'cancelado' || estado === 'vencido') && current.estado === 'activo') {
      restoreReservationStock(current);
    }
    // Si se reactiva un apartado cancelado o vencido, reservar nuevamente si hay existencias
    if (estado === 'activo' && current.estado !== 'activo') {
      deductReservationStock(current);
    }
  }
  db.prepare("UPDATE reservations SET estado = ? WHERE id = ?").run(estado, id);
  persistDB();
}

/**
 * Elimina físicamente un registro de apartado de la base de datos, reponiendo su stock si estaba activo.
 */
export function deleteReservation(id: number | string) {
  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (!current) {
    throw new Error(`No existe un apartado con el ID ${id}.`);
  }
  if (current.estado === 'activo') {
    restoreReservationStock(current);
  }
  db.prepare("DELETE FROM reservations WHERE id = ?").run(id);
  persistDB();
}

/**
 * [APARTADOS Y RESERVAS 24H]
 * Gestiona el ciclo de vida temporal de los apartados:
 * 1. A las 24h: Transita de 'activo' a 'vencido' y repone el stock para que la tienda física pueda venderlo.
 * 2. 12 horas adicionales de gracia: Permanece visible como 'vencido' en el panel administrativo para auditoría.
 * 3. A las 36h totales (24h + 12h de gracia): Se purga definitivamente de SQLite.
 */
export function cleanExpiredReservations() {
  const now = Date.now();
  const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 horas adicionales de gracia

  // Paso 1: Vencer apartados que superaron las 24 horas y restituir inventario
  const newlyExpired = db.prepare("SELECT id, producto_id, producto_nombre, nombre, items_json FROM reservations WHERE expira_en <= ? AND estado = 'activo'").all(now);
  if (newlyExpired.length > 0) {
    for (const item of newlyExpired) {
      db.prepare("UPDATE reservations SET estado = 'vencido' WHERE id = ?").run(item.id);
      restoreReservationStock(item);
      console.log(`[Apartados 24h] Apartado #${item.id} (${item.nombre} - ${item.producto_nombre}) marcado como VENCIDO. Stock restablecido.`);
    }
    persistDB();
  }

  // Paso 2: Purgar definitivamente registros que sobrepasaron las 12 horas posteriores al vencimiento
  const deadlineForPurge = now - GRACE_PERIOD_MS;
  const toPurge = db.prepare("SELECT id, nombre, producto_nombre FROM reservations WHERE estado = 'vencido' AND expira_en <= ?").all(deadlineForPurge);
  if (toPurge.length > 0) {
    db.prepare("DELETE FROM reservations WHERE estado = 'vencido' AND expira_en <= ?").run(deadlineForPurge);
    persistDB();
    console.log(`[Apartados 24h] Purgados ${toPurge.length} apartados tras cumplir sus 12 horas extras de gracia post-vencimiento.`);
  }

  return newlyExpired;
}

/**
 * Obtiene las reservas que están a 2 horas de expirar (22 horas de vida) y no han recibido la notificación de cortesía.
 */
export function getReservationsNeeding22hReminder() {
  const now = Date.now();
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  return db.prepare(`
    SELECT * FROM reservations
    WHERE estado = 'activo'
      AND (expira_en - ?) <= ?
      AND expira_en > ?
      AND (aviso_22h_enviado IS NULL OR aviso_22h_enviado = 0)
      AND jid IS NOT NULL
      AND jid != ''
  `).all(now, TWO_HOURS_MS, now);
}

/**
 * Marca que el aviso de las 22 horas ya fue enviado exitosamente al cliente.
 */
export function markReservation22hReminderSent(id: number | string) {
  db.prepare('UPDATE reservations SET aviso_22h_enviado = 1 WHERE id = ?').run(id);
  persistDB();
}
