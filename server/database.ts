/**
 * ============================================================================
 * MOTOR DE PERSISTENCIA RELACIONAL: SQLITE WASM (SQL.JS) PARA CRASTUR
 * ============================================================================
 * Este archivo es el PUNTO DE ENTRADA y BARRIL del subsistema de base de datos.
 * Internamente delega en módulos especializados dentro de `server/db/`:
 *   - db/engine.ts       → Singleton SQL.js, persistencia atómica, whenReady/initDB base.
 *   - db/schema.ts       → Esquema, migraciones e índices.
 *   - db/settings.ts     → Configuración comercial y pausa del bot.
 *   - db/metrics.ts      → Métricas y tablero de control.
 *   - db/reservations.ts → Apartados por 24 horas y control de stock.
 *   - db/catalog.ts      → Import/export de catálogo y purga de datos.
 *   - db/backups.ts      → Respaldos, snapshot maestro y migración portable.
 *
 * Se mantiene esta fachada para no alterar los ~20 puntos del código que importan
 * de `./database`, garantizando compatibilidad total de la API pública.
 */

import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import {
  dataDir,
  dbPath,
  backupDir,
  latestBackupPath,
  whenReady,
  persistDB,
  markReady,
  setRawDb,
  setSQLInstance,
  db
} from './db/engine';
import { applySchemaAndMigrations } from './db/schema';
import { cleanExpiredReservations } from './db/reservations';
import {
  performDailyBackup,
  autoRestoreSnapshotIfEmpty,
  saveMasterSnapshotToDisk
} from './db/backups';
import { purgeOldData } from './db/catalog';

// Reexportación de la API pública del subsistema de base de datos
export * from './db/engine';
export * from './db/settings';
export * from './db/metrics';
export * from './db/reservations';
export * from './db/catalog';
export * from './db/backups';

/**
 * Inicializa la base de datos SQLite en memoria WASM, aplica verificaciones de integridad,
 * ejecuta migraciones incrementales del esquema relacional y carga configuraciones base.
 */
async function initDB() {
  const SQL = await initSqlJs();
  setSQLInstance(SQL);

  let workingDb: any = null;

  // 1. Cargar archivo existente en disco o iniciar protocolo de recuperación ante desastres
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      workingDb = new SQL.Database(fileBuffer);
      // Verificación de integridad estructural SQLite
      const integrityResult = workingDb.exec('PRAGMA integrity_check;');
      const integrityStatus = integrityResult[0]?.values[0]?.[0];
      if (integrityStatus !== 'ok') {
        throw new Error(`Integridad fallida: ${integrityStatus}`);
      }
    } catch (e: any) {
      console.error('[DB Auto-Recuperación] Base de datos dañada o ilegible. Intentando restaurar desde backup...', e?.message || e);
      workingDb = null;
      let restored = false;

      // Buscar el respaldo diario más reciente disponible
      const backupFiles = fs.existsSync(backupDir)
        ? fs.readdirSync(backupDir)
            .filter(f => f.match(/^crastur_backup_\d{4}-\d{2}-\d{2}\.db$/))
            .sort()
            .reverse()
        : [];

      for (const backupFile of backupFiles) {
        try {
          const backupBuffer = fs.readFileSync(path.join(backupDir, backupFile));
          workingDb = new SQL.Database(backupBuffer);
          fs.writeFileSync(dbPath, backupBuffer);
          console.log(`[DB Auto-Recuperación] ¡Base de datos restaurada desde respaldo: ${backupFile}!`);
          restored = true;
          break;
        } catch {}
      }

      if (!restored && fs.existsSync(latestBackupPath)) {
        try {
          const backupBuffer = fs.readFileSync(latestBackupPath);
          workingDb = new SQL.Database(backupBuffer);
          fs.writeFileSync(dbPath, backupBuffer);
          console.log('[DB Auto-Recuperación] ¡Base de datos restaurada exitosamente desde el respaldo legacy!');
          restored = true;
        } catch (bkErr: any) {
          console.error('[DB Auto-Recuperación] Respaldo no disponible. Creando nueva base de datos limpia.');
        }
      }

      if (!restored) {
        workingDb = new SQL.Database();
      }
    }
  } else if (fs.existsSync(latestBackupPath)) {
    try {
      const backupBuffer = fs.readFileSync(latestBackupPath);
      workingDb = new SQL.Database(backupBuffer);
      fs.writeFileSync(dbPath, backupBuffer);
      console.log('[DB Auto-Recuperación] Archivo recuperado desde backup existente.');
    } catch (e: any) {
      workingDb = new SQL.Database();
    }
  } else {
    workingDb = new SQL.Database();
  }

  setRawDb(workingDb);

  // 2. Respaldo de seguridad preventivo al iniciar
  try {
    const backupData = workingDb.export();
    fs.writeFileSync(latestBackupPath, Buffer.from(backupData));
  } catch {}

  // 3. Creación de tablas, migraciones de esquema, índices y valores por defecto
  applySchemaAndMigrations();

  // Garantizar que la tabla de vendedores inicie limpia (0 asesores ficticios de prueba)
  // y normalizar categorías históricas para prevenir discordancias.
  try {
    db.prepare("DELETE FROM sellers WHERE nombre LIKE ?").run('%Asesor de Repuestos%');
    db.prepare("UPDATE products SET categoria = 'Repuestos Moto' WHERE categoria = 'Repuestos para Moto' OR categoria LIKE 'Repuestos para Moto%'").run();
    db.prepare("UPDATE products SET categoria = 'Insumos Cauchera' WHERE categoria = 'Insumos para Caucheras' OR categoria LIKE 'Insumos para Caucheras%'").run();
    db.prepare("DELETE FROM products WHERE modelo LIKE '%TEST%' OR categoria LIKE '%Test%' OR marca = 'TEST'").run();

    const curMetodos = db.prepare("SELECT value FROM settings WHERE key = 'metodos_pago'").get()?.value;
    if (curMetodos && curMetodos.includes('Precio Promoción') && curMetodos.includes('Efectivo $')) {
      db.prepare("UPDATE settings SET value = 'Efectivo $, Binance Pay (USDT), Pago Móvil BCV, Cashea en Tienda, Punto de Venta, Transferencia Bancaria' WHERE key = 'metodos_pago'").run();
    }
  } catch {}

  // Optimización de arranque y liberación limpia de apartados vencidos durante períodos de apagado
  try {
    workingDb.exec('PRAGMA optimize;');
    cleanExpiredReservations();
  } catch {}

  // Guardar inmediatamente el estado consolidado en disco
  persistDB();

  // Programar respaldo circular diario cada 24 horas (unref para no bloquear cierre en scripts)
  const dailyBackupTimer = setInterval(performDailyBackup, 24 * 60 * 60 * 1000);
  if (dailyBackupTimer && dailyBackupTimer.unref) dailyBackupTimer.unref();

  // Respaldo preventivo inicial a los 5 segundos de arrancar
  const initBackupTimer = setTimeout(performDailyBackup, 5000);
  if (initBackupTimer && initBackupTimer.unref) initBackupTimer.unref();

  // [MANTENIMIENTO AUTOMÁTICO] Purga periódica de datos antiguos (privacidad + rendimiento)
  const purgeTimer = setInterval(() => {
    try { purgeOldData(); } catch {}
  }, 6 * 60 * 60 * 1000);
  if (purgeTimer && purgeTimer.unref) purgeTimer.unref();
  const initPurgeTimer = setTimeout(() => { try { purgeOldData(); } catch {} }, 30000);
  if (initPurgeTimer && initPurgeTimer.unref) initPurgeTimer.unref();

  // Auto-restaurar desde snapshot maestro si la base de datos estuviera vacía (primera instalación)
  autoRestoreSnapshotIfEmpty();

  // Generar snapshot maestro actualizado en disco
  saveMasterSnapshotToDisk();

  markReady();
  console.log('[DB] Base de datos local SQLite (sql.js WASM) lista y persistida en crastur.db');
}
// Iniciar automáticamente en segundo plano
initDB().catch((err: any) => console.error('[DB] Error iniciando base de datos:', err));

// ─── Reexportación explícita para compatibilidad con import { ... } ───────────
export {
  whenReady,
  persistDB,
  dbPath,
  dataDir,
  backupDir,
  latestBackupPath
};

// Importaciones de los símbolos para construir el export default unificado
import {
  getSettings,
  updateSetting,
  getEffectiveRate,
  toggleBotPause,
  isBotPaused,
  isBotGloballyPaused,
  setBotGlobalPause,
  persistImmediateSync
} from './db/settings';
import { recordMetric, getMetricsSummary } from './db/metrics';
import {
  getReservations,
  createReservation,
  updateReservationStatus,
  deleteReservation,
  cleanExpiredReservations as _cleanExpiredReservations,
  getReservationsNeeding22hReminder,
  markReservation22hReminderSent
} from './db/reservations';
import { exportCatalog, importCatalog, purgeOldData as _purgeOldData } from './db/catalog';
import {
  exportMasterBackup,
  saveMasterSnapshotToDisk as _saveMasterSnapshot,
  importMasterBackup,
  exportCatalogoAsesores,
  importCatalogoAsesores,
  restoreDatabaseFromBuffer
} from './db/backups';

export default {
  db,
  initDB,
  whenReady,
  persistDB,
  persistImmediateSync,
  getSettings,
  updateSetting,
  getEffectiveRate,
  recordMetric,
  toggleBotPause,
  isBotPaused,
  isBotGloballyPaused,
  setBotGlobalPause,
  getMetricsSummary,
  exportCatalog,
  importCatalog,
  getReservations,
  createReservation,
  updateReservationStatus,
  deleteReservation,
  cleanExpiredReservations: _cleanExpiredReservations,
  getReservationsNeeding22hReminder,
  markReservation22hReminderSent,
  exportMasterBackup,
  saveMasterSnapshotToDisk: _saveMasterSnapshot,
  importMasterBackup,
  exportCatalogoAsesores,
  importCatalogoAsesores,
  restoreDatabaseFromBuffer,
  purgeOldData: _purgeOldData
};
