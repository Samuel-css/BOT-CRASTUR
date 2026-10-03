/**
 * ============================================================================
 * NÚCLEO DEL MOTOR SQLITE WASM (db/engine.ts)
 * ============================================================================
 * Contiene la instancia única (singleton) de la base de datos en memoria, el wrapper
 * compatible con la API de better-sqlite3, la persistencia atómica a disco y el
 * ciclo de vida (whenReady / initDB).
 *
 * El resto de módulos de `db/` importan `rawDb`/`db`/`persistDB` desde aquí.
 * `server/database.ts` actúa como BARRIL que reexporta toda la API pública.
 */

import path from 'path';
import fs from 'fs';

// Ubicación de almacenamiento local persistente.
// [AISLAMIENTO DE PRUEBAS] CRASTUR_DATA_DIR permite redirigir la base de datos a una
// carpeta temporal (usado por las suites de prueba) sin tocar los datos de producción.
const defaultDataDir = path.join(__dirname, '..', '..', 'data');
export const dataDir = process.env.CRASTUR_DATA_DIR
  ? path.resolve(process.env.CRASTUR_DATA_DIR)
  : defaultDataDir;
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'crastur.db');

export let rawDb: any = null;
export let SQLInstance: any = null;
let saveScheduled = false;
let pendingSaveTimer: any = null;
let isReady = false;
let readyResolvers: Array<() => void> = [];

/** Asigna la instancia cruda de SQL.js (usado por el motor y la restauración). */
export function setRawDb(instance: any): void {
  rawDb = instance;
}

/** Asigna la instancia del runtime SQL.js. */
export function setSQLInstance(instance: any): void {
  SQLInstance = instance;
}

/**
 * Retorna una promesa que se resuelve cuando el motor SQLite WASM y sus esquemas
 * han completado su inicialización y migraciones.
 */
export function whenReady(): Promise<void> {
  if (isReady) return Promise.resolve();
  return new Promise(resolve => readyResolvers.push(resolve));
}

/** Marca el motor como listo y libera a quienes esperaban con whenReady(). */
export function markReady(): void {
  isReady = true;
  readyResolvers.forEach((res: () => void) => res());
  readyResolvers = [];
}

/** Indica si el motor ya terminó de inicializar. */
export function getIsReady(): boolean {
  return isReady;
}

/**
 * [PERSISTENCIA ATÓMICA Y RECUPERACIÓN ANTE DESASTRES]
 * Exporta el binario de SQLite desde la memoria WASM y lo escribe en disco de forma atómica.
 * Utiliza un archivo temporal `.tmp` y posterior reemplazo (`renameSync` / `copyFileSync`)
 * para garantizar que un corte de energía nunca deje el archivo principal a medio escribir.
 */
export function persistDB(): void {
  if (!rawDb) return;
  try {
    const data = rawDb.export();
    const tempPath = dbPath + '.tmp';
    fs.writeFileSync(tempPath, Buffer.from(data));
    try {
      fs.renameSync(tempPath, dbPath);
    } catch (renameErr: any) {
      // Manejo de bloqueos por antivirus o procesos de indexación en entornos Windows/NTFS
      if (process.platform === 'win32' || renameErr?.code === 'EPERM' || renameErr?.code === 'EBUSY') {
        fs.copyFileSync(tempPath, dbPath);
        try { fs.unlinkSync(tempPath); } catch (_) {}
      } else {
        throw renameErr;
      }
    }
  } catch (e: any) {
    console.error('[DB] Error guardando archivo crastur.db:', e?.message || e);
  }
}

// Protección de guardado atómico ante señales de apagado o terminación del proceso Node.js
if (typeof process !== 'undefined') {
  const handleExit = () => {
    try {
      // [INTEGRIDAD] Forzar primero cualquier guardado pendiente del debounce y luego persistir.
      if (saveScheduled && pendingSaveTimer) { clearTimeout(pendingSaveTimer); pendingSaveTimer = null; saveScheduled = false; }
      persistDB();
    } catch (e: any) {}
  };
  process.once('beforeExit', handleExit);
  process.once('SIGINT', () => {
    handleExit();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    handleExit();
    process.exit(0);
  });
}

/**
 * Encola una solicitud de persistencia en disco con debounce (100ms)
 * para agrupar múltiples transacciones consecutivas y minimizar el desgaste de I/O.
 * [INTEGRIDAD] Si hay un guardado pendiente, `flushScheduledSave()` lo fuerza de inmediato
 * antes de que el proceso termine, evitando perder escrituras recientes.
 */
export function scheduleSave(): void {
  if (saveScheduled) return;
  saveScheduled = true;
  pendingSaveTimer = setTimeout(() => {
    saveScheduled = false;
    pendingSaveTimer = null;
    persistDB();
  }, 100);
}

/** Fuerza de inmediato cualquier guardado pendiente del debounce (uso en cierres y scripts). */
export function flushScheduledSave(): void {
  if (!saveScheduled) return;
  try {
    if (pendingSaveTimer) { clearTimeout(pendingSaveTimer); pendingSaveTimer = null; }
    saveScheduled = false;
    persistDB();
  } catch (e: any) {
    console.error('[DB] Error al forzar guardado pendiente:', e?.message || e);
  }
}

/**
 * [ARQUITECTURA SQL.JS]
 * Capa de compatibilidad (wrapper) que emula la API síncrona de better-sqlite3
 * sobre la máquina virtual WebAssembly de sql.js.
 */
export const db = {
  pragma: (_cmd?: string) => {},
  exec: (sql: string) => {
    if (!rawDb) throw new Error('Base de datos no inicializada');
    const res = rawDb.exec(sql);
    scheduleSave();
    return res;
  },
  prepare: (sql: string) => {
    return {
      run: (...params: any[]) => {
        if (!rawDb) throw new Error('Base de datos no inicializada');
        const flat = params.flat();
        rawDb.run(sql, flat);
        scheduleSave();
        const lastId = rawDb.exec('SELECT last_insert_rowid() as id');
        return { lastInsertRowid: lastId[0]?.values[0]?.[0] || 0 };
      },
      get: (...params: any[]) => {
        if (!rawDb) throw new Error('Base de datos no inicializada');
        const flat = params.flat();
        const stmt = rawDb.prepare(sql);
        stmt.bind(flat);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all: (...params: any[]) => {
        if (!rawDb) throw new Error('Base de datos no inicializada');
        const flat = params.flat();
        const stmt = rawDb.prepare(sql);
        stmt.bind(flat);
        const results: any[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }
};

export const backupDir = path.join(dataDir, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export const latestBackupPath = path.join(backupDir, 'crastur_backup.db');
