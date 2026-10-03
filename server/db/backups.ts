/**
 * ============================================================================
 * RESPALDOS, SNAPSHOT MAESTRO Y MIGRACIÓN PORTABLE (db/backups.ts)
 * ============================================================================
 * Estrategia de salvaguarda en dos niveles:
 * 1. Copias automáticas circulares de 7 días + snapshot maestro completo (auto-recuperación).
 * 2. Respaldo PORTABLE de Catálogo + Asesores para migrar entre versiones de Crastur.
 * Incluye restauración binaria de SQLite con verificación de integridad.
 */

import path from 'path';
import fs from 'fs';
import { db, rawDb, setRawDb, SQLInstance, backupDir, latestBackupPath, dbPath, persistDB } from './engine';
import { applySchemaAndMigrations } from './schema';
import { cleanExpiredReservations } from './reservations';

const snapshotDir = backupDir;
export const masterSnapshotPath = path.join(snapshotDir, 'snapshot_maestro_crastur.json');

/**
 * Escribe un buffer de respaldo en disco de forma atómica (archivo .tmp + rename)
 * para que un corte de energía no deje el respaldo a medio escribir.
 */
function writeBackupAtomic(targetPath: string, buffer: Buffer): void {
  const tmp = targetPath + '.tmp';
  fs.writeFileSync(tmp, buffer);
  try {
    fs.renameSync(tmp, targetPath);
  } catch (e: any) {
    // Windows/NTFS puede bloquear el rename por antivirus: fallback a copia directa
    if (process.platform === 'win32' || e?.code === 'EPERM' || e?.code === 'EBUSY') {
      fs.copyFileSync(tmp, targetPath);
      try { fs.unlinkSync(tmp); } catch {}
    } else {
      throw e;
    }
  }
}

/**
 * [SNAPSHOT MAESTRO Y BACKUP CIRCULAR 7 DÍAS]
 * Genera una copia de seguridad diaria fechada y elimina automáticamente aquellas
 * que superen los 7 días de antigüedad para mantener el almacenamiento acotado.
 *
 * [INTEGRIDAD] El respaldo del día se ACTUALIZA en cada ejecución (antes solo se creaba
 * una vez y quedaba congelado con los datos del primer arranque del día, perdiendo todas
 * las ventas y apartados posteriores). Así el respaldo diario siempre refleja el estado
 * más reciente.
 *
 * @param force - Si es true, actualiza el respaldo del día aunque ya exista (usado al apagar).
 */
export function performDailyBackup(force: boolean = true): void {
  if (!rawDb) return;
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dailyBackupPath = path.join(backupDir, `crastur_backup_${today}.db`);
    const backupData = Buffer.from(rawDb.export());

    writeBackupAtomic(dailyBackupPath, backupData);

    // Política de retención circular: mantener solo los 7 respaldos diarios más recientes
    const files = fs.readdirSync(backupDir)
      .filter(f => f.match(/^crastur_backup_\d{4}-\d{2}-\d{2}\.db$/))
      .sort(); // Orden cronológico ascendente
    if (files.length > 7) {
      const toDelete = files.slice(0, files.length - 7);
      toDelete.forEach(f => {
        try { fs.unlinkSync(path.join(backupDir, f)); } catch {}
        console.log(`[DB Backup] Backup antiguo eliminado: ${f}`);
      });
    }

    // Actualizar el archivo de respaldo maestro unificado (para auto-recuperación)
    writeBackupAtomic(latestBackupPath, backupData);
  } catch (bkErr: any) {
    console.error('[DB Backup] Error en backup diario:', bkErr?.message || bkErr);
  }
}

/**
 * [RESPALDO AL APAGAR] Garantiza que toda la jornada quede salvada antes de cerrar.
 * Se invoca desde el apagado seguro del servidor y del panel. Es tolerante a fallos:
 * si el respaldo no se puede escribir, el apagado continúa sin interrumpirse.
 */
export function performShutdownBackup(): void {
  try {
    console.log('[DB Backup] Guardando respaldo de cierre de jornada...');
    performDailyBackup(true);
    console.log('[DB Backup] Respaldo de cierre guardado correctamente.');
  } catch (e: any) {
    console.error('[DB Backup] No se pudo guardar el respaldo de cierre:', e?.message || e);
  }
}

/**
 * Genera el snapshot integral con productos, vendedores y configuraciones.
 */
export function exportMasterBackup() {
  const products = db.prepare('SELECT id, marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo FROM products').all();
  const sellers = db.prepare('SELECT id, nombre, telefono, departamento, activo FROM sellers').all();
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settingsMap: Record<string, string> = {};
  for (const s of settingsRows) settingsMap[s.key] = s.value;

  return {
    version: '3.0',
    exportado_en: new Date().toISOString(),
    total_productos: products.length,
    total_vendedores: sellers.length,
    productos: products,
    vendedores: sellers,
    configuracion: settingsMap
  };
}

/**
 * Escribe el snapshot maestro en formato JSON en disco para fácil versionamiento y migración.
 */
export function saveMasterSnapshotToDisk() {
  try {
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    const data = exportMasterBackup();
    fs.writeFileSync(masterSnapshotPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err: any) {
    console.error('[Snapshot Maestro] Error al escribir snapshot en disco:', err?.message || err);
  }
}

/**
 * Restaura o fusiona el snapshot maestro en la base de datos (Upsert por clave natural).
 */
export function importMasterBackup(payload: any) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Formato de respaldo inválido');
  }

  let importedProducts = 0;
  let importedSellers = 0;

  // 1. Restaurar o actualizar productos evitando duplicaciones por marca y modelo
  if (Array.isArray(payload.productos)) {
    const findStmt = db.prepare('SELECT id FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?))');
    const updateStmt = db.prepare(`
      UPDATE products SET
        categoria = ?, precio_usd = ?, descripcion = ?, imagen_url = COALESCE(?, imagen_url), stock = ?, activo = 1
      WHERE id = ?
    `);
    const insertStmt = db.prepare(`
      INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const p of payload.productos) {
      if (p.marca && p.modelo && p.precio_usd !== undefined) {
        const existing = findStmt.get(p.marca, p.modelo);
        const cat = p.categoria || 'Otros Productos';
        const precio = parseFloat(p.precio_usd) || 0;
        const desc = p.descripcion || '';
        const img = p.imagen_url || null;
        const stock = parseInt(p.stock || 1, 10);

        if (existing) {
          updateStmt.run(cat, precio, desc, img, stock, existing.id);
        } else {
          insertStmt.run(p.marca.trim(), p.modelo.trim(), cat, precio, desc, img, stock);
        }
        importedProducts++;
      }
    }
  }

  // 2. Restaurar o actualizar vendedores
  if (Array.isArray(payload.vendedores)) {
    const findSelStmt = db.prepare('SELECT id FROM sellers WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))');
    const updateSelStmt = db.prepare('UPDATE sellers SET telefono = ?, departamento = ?, activo = 1 WHERE id = ?');
    const insertSelStmt = db.prepare('INSERT INTO sellers (nombre, telefono, departamento, activo) VALUES (?, ?, ?, 1)');

    for (const sel of payload.vendedores) {
      if (sel.nombre && sel.telefono) {
        const existing = findSelStmt.get(sel.nombre);
        if (existing) {
          updateSelStmt.run(sel.telefono, sel.departamento || 'Ventas', existing.id);
        } else {
          insertSelStmt.run(sel.nombre.trim(), sel.telefono.trim(), sel.departamento || 'Ventas');
        }
        importedSellers++;
      }
    }
  }

  // 3. Restaurar configuración preservando parámetros preestablecidos
  if (payload.configuracion && typeof payload.configuracion === 'object') {
    const setStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(payload.configuracion)) {
      if (v !== undefined && v !== null && String(v).trim()) {
        setStmt.run(k, String(v));
      }
    }
  }

  persistDB();
  saveMasterSnapshotToDisk();

  return { success: true, importedProducts, importedSellers };
}

/**
 * Si se detecta un catálogo vacío al inicio, reestablece el inventario desde el snapshot maestro,
 * salvo que el snapshot esté vacío (instalación limpia).
 */
export function autoRestoreSnapshotIfEmpty() {
  try {
    const prodCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE activo = 1').get()?.count || 0;
    if (prodCount !== 0 || !fs.existsSync(masterSnapshotPath)) return;

    let parsed: any = null;
    try {
      parsed = JSON.parse(fs.readFileSync(masterSnapshotPath, 'utf8'));
    } catch {
      return;
    }
    const snapProducts = Array.isArray(parsed?.productos) ? parsed.productos.length : 0;
    if (snapProducts === 0) {
      console.log('[Snapshot Maestro] Snapshot vacío detectado. No se auto-restaura nada (instalación limpia).');
      return;
    }

    console.log('[Snapshot Maestro] 🔄 Base de datos vacía detectada al iniciar. Auto-restaurando catálogo desde snapshot_maestro_crastur.json...');
    const res = importMasterBackup(parsed);
    console.log(`[Snapshot Maestro] ✅ Auto-restauración completada: ${res.importedProducts} productos, ${res.importedSellers} asesores restablecidos.`);
  } catch (e: any) {
    console.error('[Snapshot Maestro] Error en auto-restauración:', e?.message || e);
  }
}

// ==================== RESPALDO PORTABLE: CATÁLOGO + ASESORES ====================

/**
 * [MIGRACIÓN ENTRE VERSIONES]
 * Exporta ÚNICAMENTE el catálogo de productos y los asesores de venta en un formato
 * portable e independiente del esquema, pensado para llevarse a otra versión de Crastur.
 * No incluye configuración, chats ni apartados.
 */
export function exportCatalogoAsesores() {
  const products = db.prepare('SELECT marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo FROM products').all();
  const sellers = db.prepare('SELECT nombre, telefono, departamento, activo FROM sellers').all();

  return {
    formato: 'crastur_catalogo_asesores',
    version: '1.0',
    exportado_en: new Date().toISOString(),
    total_productos: products.length,
    total_asesores: sellers.length,
    productos: products,
    asesores: sellers
  };
}

/**
 * [MIGRACIÓN ENTRE VERSIONES]
 * Importa catálogo y asesores desde el respaldo portable, fusionando por clave natural
 * (marca+modelo para productos, nombre para asesores). NO toca la configuración.
 */
export function importCatalogoAsesores(payload: any) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Formato de respaldo inválido');
  }

  const productos: any[] = Array.isArray(payload.productos)
    ? payload.productos
    : (Array.isArray(payload.products) ? payload.products : []);
  const asesores: any[] = Array.isArray(payload.asesores)
    ? payload.asesores
    : (Array.isArray(payload.vendedores) ? payload.vendedores : []);

  if (productos.length === 0 && asesores.length === 0) {
    throw new Error('El archivo no contiene productos ni asesores reconocibles.');
  }

  let importedProducts = 0;
  let importedSellers = 0;

  // 1. Catálogo: upsert por marca + modelo
  const findProdStmt = db.prepare('SELECT id FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?)) LIMIT 1');
  const updateProdStmt = db.prepare(`
    UPDATE products SET
      categoria = ?, precio_usd = ?, descripcion = ?, imagen_url = COALESCE(?, imagen_url), stock = ?, activo = ?
    WHERE id = ?
  `);
  const insertProdStmt = db.prepare(`
    INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of productos) {
    if (!p || !p.marca || !p.modelo) continue;
    const marca = String(p.marca).trim();
    const modelo = String(p.modelo).trim();
    if (!marca || !modelo) continue;

    const cat = String(p.categoria || 'Otros Productos').trim();
    const precio = parseFloat(p.precio_usd) || 0;
    const desc = String(p.descripcion || '').trim();
    const img = p.imagen_url != null ? String(p.imagen_url) : null;
    const stock = p.stock !== undefined && p.stock !== null ? (parseInt(p.stock, 10) || 0) : 1;
    const activo = p.activo !== undefined && p.activo !== null ? (p.activo ? 1 : 0) : 1;

    const existing = findProdStmt.get(marca, modelo);
    if (existing) {
      updateProdStmt.run(cat, precio, desc, img, stock, activo, existing.id);
    } else {
      insertProdStmt.run(marca, modelo, cat, precio, desc, img, stock, activo);
    }
    importedProducts++;
  }

  // 2. Asesores: upsert por nombre
  const findSelStmt = db.prepare('SELECT id FROM sellers WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1');
  const updateSelStmt = db.prepare('UPDATE sellers SET telefono = ?, departamento = ?, activo = ? WHERE id = ?');
  const insertSelStmt = db.prepare('INSERT INTO sellers (nombre, telefono, departamento, activo) VALUES (?, ?, ?, ?)');

  for (const s of asesores) {
    if (!s || !s.nombre || !s.telefono) continue;
    const nombre = String(s.nombre).trim();
    const telefono = String(s.telefono).trim();
    if (!nombre || !telefono) continue;

    const departamento = String(s.departamento || 'Ventas').trim();
    const activo = s.activo !== undefined && s.activo !== null ? (s.activo ? 1 : 0) : 1;

    const existing = findSelStmt.get(nombre);
    if (existing) {
      updateSelStmt.run(telefono, departamento, activo, existing.id);
    } else {
      insertSelStmt.run(nombre, telefono, departamento, activo);
    }
    importedSellers++;
  }

  persistDB();
  saveMasterSnapshotToDisk();

  return { success: true, importedProducts, importedSellers };
}

/**
 * [RECUPERACIÓN ANTE DESASTRES]
 * Restaura la base de datos completa a partir de un Buffer binario de SQLite (.db),
 * verificando previamente su encabezado e integridad física.
 */
export function restoreDatabaseFromBuffer(buffer: Buffer | any) {
  if (!SQLInstance) return { success: false, error: 'Motor SQLite no inicializado.' };
  try {
    if (!buffer || buffer.length < 100) {
      return { success: false, error: 'El archivo está vacío o dañado.' };
    }
    const header = buffer.slice(0, 16).toString('utf8');
    if (!header.startsWith('SQLite format 3')) {
      return { success: false, error: 'El archivo no tiene el formato SQLite válido.' };
    }

    const testDb = new SQLInstance.Database(buffer);
    const integrityResult = testDb.exec('PRAGMA integrity_check;');
    const integrityStatus = integrityResult[0]?.values[0]?.[0];
    if (integrityStatus !== 'ok') {
      try { testDb.close(); } catch {}
      return { success: false, error: `Integridad SQLite fallida (${integrityStatus})` };
    }

    // Copia de seguridad preventiva previa a la sobreescritura
    persistDB();
    const backupPre = path.join(backupDir, `crastur_pre_restore_${Date.now()}.db`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPre);
    }

    fs.writeFileSync(dbPath, buffer);
    // [INTEGRIDAD] Cerrar la base anterior en memoria WASM antes de reemplazarla evita
    // fugas de memoria acumuladas en cada restauración.
    try { if (rawDb && typeof rawDb.close === 'function') rawDb.close(); } catch {}
    setRawDb(testDb);

    // [ROBUSTEZ ENTRE VERSIONES] Re-aplicar esquema, migraciones, índices y valores base
    applySchemaAndMigrations();
    try { cleanExpiredReservations(); } catch {}
    try { saveMasterSnapshotToDisk(); } catch {}
    persistDB();

    console.log('[DB] ¡Base de datos restaurada exitosamente desde archivo de respaldo!');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
