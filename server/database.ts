/**
 * ============================================================================
 * MOTOR DE PERSISTENCIA RELACIONAL: SQLITE WASM (SQL.JS) PARA CRASTUR
 * ============================================================================
 * Implementa la capa de persistencia en memoria mediante WebAssembly (sql.js),
 * ofreciendo un wrapper idéntico a la API de better-sqlite3 para máxima compatibilidad.
 * 
 * [ARQUITECTURA SQL.JS]
 * - Ejecuta SQLite en memoria sin requerir dependencias de compilación nativa (C/C++).
 * - Sincroniza el estado a disco (crastur.db) con una estrategia de guardado atómico (archivo .tmp
 *   y renombrado/copia segura) para prevenir corrupción ante caídas de tensión o apagones.
 * - Incluye verificación proactiva de integridad (`PRAGMA integrity_check`) en cada inicio y
 *   auto-reparación a partir de respaldos circulares en caso de daño estructural.
 * 
 * [MERCADO VENEZUELA]
 * - Persiste tasas de cambio BCV, catálogo multimoneda (USD / Bs), proveedores y clientes con C.I.
 * - Motor de apartados con caducidad estricta de 24 horas continuas y período de gracia de 12 horas.
 * - Respaldo maestro integral (`snapshot_maestro_crastur.json`) y copias de seguridad de 7 días.
 */

import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import type { Product, Supplier, Seller, Reservation, ChatSession, ChatMessage, MasterSnapshot } from './types/database';

// Ubicación de almacenamiento local persistente
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'crastur.db');

let rawDb: any = null;
let SQLInstance: any = null;
let saveScheduled = false;
let isReady = false;
let readyResolvers: Array<() => void> = [];

/**
 * Retorna una promesa que se resuelve cuando el motor SQLite WASM y sus esquemas
 * han completado su inicialización y migraciones.
 */
function whenReady(): Promise<void> {
  if (isReady) return Promise.resolve();
  return new Promise(resolve => readyResolvers.push(resolve));
}

/**
 * [PERSISTENCIA ATÓMICA Y RECUPERACIÓN ANTE DESASTRES]
 * Exporta el binario de SQLite desde la memoria WASM y lo escribe en disco de forma atómica.
 * Utiliza un archivo temporal `.tmp` y posterior reemplazo (`renameSync` / `copyFileSync`)
 * para garantizar que un corte de energía nunca deje el archivo principal a medio escribir.
 */
function persistDB() {
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
 */
function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    persistDB();
  }, 100);
}

/**
 * [ARQUITECTURA SQL.JS]
 * Capa de compatibilidad (wrapper) que emula la API síncrona de better-sqlite3
 * sobre la máquina virtual WebAssembly de sql.js.
 */
const db = {
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

const backupDir = path.join(dataDir, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const latestBackupPath = path.join(backupDir, 'crastur_backup.db');

/**
 * [SNAPSHOT MAESTRO Y BACKUP CIRCULAR 7 DÍAS]
 * Genera una copia de seguridad diaria fechada y elimina automáticamente aquellas
 * que superen los 7 días de antigüedad para mantener el almacenamiento acotado.
 */
function performDailyBackup() {
  if (!rawDb) return;
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dailyBackupPath = path.join(backupDir, `crastur_backup_${today}.db`);
    if (!fs.existsSync(dailyBackupPath)) {
      const backupData = rawDb.export();
      fs.writeFileSync(dailyBackupPath, Buffer.from(backupData));
      console.log(`[DB Backup] Respaldo diario creado: crastur_backup_${today}.db`);
    }

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

    // Actualizar el archivo de respaldo maestro unificado
    fs.writeFileSync(latestBackupPath, Buffer.from(rawDb.export()));
  } catch (bkErr: any) {
    console.error('[DB Backup] Error en backup diario:', bkErr?.message || bkErr);
  }
}

/**
 * Inicializa la base de datos SQLite en memoria WASM, aplica verificaciones de integridad,
 * ejecuta migraciones incrementales del esquema relacional y carga configuraciones base.
 */
async function initDB() {
  if (isReady) return;

  const SQL = await initSqlJs();
  SQLInstance = SQL;

  // 1. Cargar archivo existente en disco o iniciar protocolo de recuperación ante desastres
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      rawDb = new SQL.Database(fileBuffer);
      // Verificación de integridad estructural SQLite
      const integrityResult = rawDb.exec('PRAGMA integrity_check;');
      const integrityStatus = integrityResult[0]?.values[0]?.[0];
      if (integrityStatus !== 'ok') {
        throw new Error(`Integridad fallida: ${integrityStatus}`);
      }
    } catch (e: any) {
      console.error('[DB Auto-Recuperación] Base de datos dañada o ilegible. Intentando restaurar desde backup...', e?.message || e);
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
          rawDb = new SQL.Database(backupBuffer);
          fs.writeFileSync(dbPath, backupBuffer);
          console.log(`[DB Auto-Recuperación] ¡Base de datos restaurada desde respaldo: ${backupFile}!`);
          restored = true;
          break;
        } catch {}
      }

      if (!restored && fs.existsSync(latestBackupPath)) {
        try {
          const backupBuffer = fs.readFileSync(latestBackupPath);
          rawDb = new SQL.Database(backupBuffer);
          fs.writeFileSync(dbPath, backupBuffer);
          console.log('[DB Auto-Recuperación] ¡Base de datos restaurada exitosamente desde el respaldo legacy!');
          restored = true;
        } catch (bkErr: any) {
          console.error('[DB Auto-Recuperación] Respaldo no disponible. Creando nueva base de datos limpia.');
        }
      }

      if (!restored) {
        rawDb = new SQL.Database();
      }
    }
  } else if (fs.existsSync(latestBackupPath)) {
    try {
      const backupBuffer = fs.readFileSync(latestBackupPath);
      rawDb = new SQL.Database(backupBuffer);
      fs.writeFileSync(dbPath, backupBuffer);
      console.log('[DB Auto-Recuperación] Archivo recuperado desde backup existente.');
    } catch (e: any) {
      rawDb = new SQL.Database();
    }
  } else {
    rawDb = new SQL.Database();
  }

  // 2. Respaldo de seguridad preventivo al iniciar
  try {
    const backupData = rawDb.export();
    fs.writeFileSync(latestBackupPath, Buffer.from(backupData));
  } catch {}

  // 3. Creación de tablas principales del ecosistema Crastur
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      categoria TEXT NOT NULL,
      precio_usd REAL NOT NULL,
      descripcion TEXT,
      imagen_url TEXT,
      stock INTEGER DEFAULT 1,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      departamento TEXT DEFAULT 'Ventas',
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa TEXT NOT NULL,
      contacto_nombre TEXT,
      telefono TEXT NOT NULL,
      categorias TEXT,
      dias_despacho TEXT,
      condiciones_pago TEXT,
      notas TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      jid TEXT PRIMARY KEY,
      push_name TEXT,
      step TEXT DEFAULT 'start',
      ultimo_producto_id INTEGER,
      ultimo_producto_nombre TEXT,
      ultimo_mensaje_at INTEGER,
      seguimiento_enviado INTEGER DEFAULT 0,
      bot_pausado INTEGER DEFAULT 0,
      nivel_cashea INTEGER DEFAULT 1,
      contexto_productos TEXT,
      apartado_metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT,
      remitente TEXT,
      contenido TEXT,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS bot_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento TEXT,
      detalle TEXT,
      jid TEXT,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT NOT NULL,
      nombre TEXT NOT NULL,
      cedula TEXT NOT NULL,
      telefono TEXT NOT NULL,
      producto_id INTEGER,
      producto_nombre TEXT NOT NULL,
      precio_usd REAL NOT NULL,
      precio_bs REAL NOT NULL,
      creado_en INTEGER NOT NULL,
      expira_en INTEGER NOT NULL,
      estado TEXT DEFAULT 'activo',
      aviso_22h_enviado INTEGER DEFAULT 0
    );
  `);

  // Migraciones automáticas: compatibilidad con esquemas anteriores
  try {
    rawDb.exec('ALTER TABLE chat_sessions ADD COLUMN apartado_metadata TEXT;');
  } catch {}

  try {
    rawDb.exec('ALTER TABLE chat_sessions ADD COLUMN telefono_contacto TEXT;');
  } catch {}

  // [ANTI-BANEO META 2025] Bandera de no molestar para excluir clientes que expresen rechazo comercial
  try {
    rawDb.exec('ALTER TABLE chat_sessions ADD COLUMN no_molestar INTEGER DEFAULT 0;');
  } catch {}

  // Sincronizar telefono_contacto desde reservations previas si estuviera vacío
  try {
    rawDb.exec(`
      UPDATE chat_sessions
      SET telefono_contacto = (
        SELECT telefono FROM reservations WHERE jid = chat_sessions.jid ORDER BY id DESC LIMIT 1
      )
      WHERE (telefono_contacto IS NULL OR telefono_contacto = '') AND EXISTS (
        SELECT 1 FROM reservations WHERE jid = chat_sessions.jid
      );
    `);
  } catch {}

  try {
    rawDb.exec('ALTER TABLE reservations ADD COLUMN aviso_22h_enviado INTEGER DEFAULT 0;');
  } catch {}

  // Índices para optimizar rendimiento de lectura en dashboards y colas
  rawDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_activo ON products(activo);
    CREATE INDEX IF NOT EXISTS idx_suppliers_activo ON suppliers(activo);
    CREATE INDEX IF NOT EXISTS idx_sessions_jid ON chat_sessions(jid);
    CREATE INDEX IF NOT EXISTS idx_messages_jid ON chat_messages(jid);
    CREATE INDEX IF NOT EXISTS idx_metrics_evento ON bot_metrics(evento, timestamp);
    CREATE INDEX IF NOT EXISTS idx_reservations_estado ON reservations(estado, expira_en);
  `);

  // [MERCADO VENEZUELA] Parámetros operativos y comerciales por defecto
  const defaultSettings = {
    'nombre_negocio': 'Crastur - Insumos para Caucheras, Repuestos de Moto & Otros Productos',
    'tasa_bcv': '849.56',
    'fecha_tasa': 'Sincronizado con BCV',
    'tasa_manual_activa': '0',
    'tasa_personalizada': '849.56',
    'direccion_tienda': 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas, Venezuela',
    'google_maps_url': 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA',
    'cashea_inicial_pct': '40',
    'cashea_cuotas': '3',
    'cashea_info': '¡En Crastur contamos con Cashea! Llévate hoy tus repuestos y accesorios para moto e insumos pagando solo una inicial y el resto en 3 cuotas quincenales sin interés.',
    'insistencia_activa': '1',
    'insistencia_minutos': '15',
    'horario_atencion': 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM',
    'politica_envios': 'Delivery a toda Caracas y retiro directo en nuestra tienda física en San Agustín Norte.',
    'metodos_pago': 'Efectivo $, Binance Pay (USDT), Pago Móvil BCV, Cashea en Tienda, Punto de Venta, Transferencia Bancaria',
    'mensaje_insistencia': '¡Hola, {nombre}! 👋 ¿Pudiste revisar el precio de *{producto}*? Recuerda que tenemos tienda física en Caracas, garantía y Cashea 💛. Si necesitas hablar con un asesor, solo escribe *VENDEDOR*.',
    'mensaje_bienvenida': '¡Hola! Te damos la bienvenida a *Crastur* 🛞🏍️\nTu tienda de insumos para caucheras, repuestos de moto y lubricantes en Caracas con Cashea 💛.\n\n📍 Tienda física en San Agustín Norte con horario corrido y delivery a toda Caracas.\n¿En qué repuesto te podemos ayudar hoy? Escribe el nombre de la pieza o modelo de moto y te cotizamos de inmediato.',
    'fuera_horario_activo': '0',
    'mensaje_fuera_horario': '¡Hola! 👋 Gracias por escribirnos. En este momento nuestra tienda física está cerrada. Te atendemos de *Lunes a Sábado de 8:00 AM a 8:00 PM* y *Domingos de 8:30 AM a 2:00 PM*. Puedes dejarnos tu consulta y con gusto te respondemos al abrir. ¡Hasta pronto! 🛞🏍️✨',
    'bot_pausado_global': '0'
  };

  const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, val] of Object.entries(defaultSettings)) {
    const exists = getStmt.get(key);
    if (!exists) {
      insertStmt.run(key, val);
    }
  }

  // Garantizar que la tabla de vendedores inicie limpia (0 asesores ficticios de prueba)
  db.exec('DELETE FROM sellers WHERE nombre LIKE "%Asesor de Repuestos%";');

  // Normalizar y sanear categorías para prevenir discordancias históricas
  try {
    db.prepare("UPDATE products SET categoria = 'Repuestos Moto' WHERE categoria = 'Repuestos para Moto' OR categoria LIKE 'Repuestos para Moto%'").run();
    db.prepare("UPDATE products SET categoria = 'Insumos Cauchera' WHERE categoria = 'Insumos para Caucheras' OR categoria LIKE 'Insumos para Caucheras%'").run();
    db.prepare("DELETE FROM products WHERE modelo LIKE '%TEST%' OR categoria LIKE '%Test%' OR marca = 'TEST'").run();

    // Limpieza de duplicación de cadenas en metodos_pago
    const curMetodos = db.prepare("SELECT value FROM settings WHERE key = 'metodos_pago'").get()?.value;
    if (curMetodos && curMetodos.includes('Precio Promoción') && curMetodos.includes('Efectivo $')) {
      db.prepare("UPDATE settings SET value = 'Efectivo $, Binance Pay (USDT), Pago Móvil BCV, Cashea en Tienda, Punto de Venta, Transferencia Bancaria' WHERE key = 'metodos_pago'").run();
    }
  } catch {}

  // Optimización de arranque y liberación limpia de apartados vencidos durante períodos de apagado
  try {
    rawDb.exec('PRAGMA optimize;');
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

  // Auto-restaurar desde snapshot maestro si la base de datos estuviera vacía (primera instalación)
  autoRestoreSnapshotIfEmpty();

  // Generar snapshot maestro actualizado en disco
  saveMasterSnapshotToDisk();

  isReady = true;
  readyResolvers.forEach((res: () => void) => res());
  readyResolvers = [];
  console.log('[DB] Base de datos local SQLite (sql.js WASM) lista y persistida en crastur.db');
}

// Iniciar automáticamente en segundo plano
initDB().catch((err: any) => console.error('[DB] Error iniciando base de datos:', err));

/**
 * Obtiene el mapa completo de configuración y parámetros de la tienda.
 */
function getSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj: Record<string, string> = {};
  for (const r of rows) {
    obj[r.key] = r.value;
  }
  return obj;
}

/**
 * Actualiza o inserta un parámetro individual en la configuración.
 */
function updateSetting(key: string, value: any) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

/**
 * [MERCADO VENEZUELA]
 * Retorna la tasa de cambio vigente para conversiones comerciales (Bs/USD).
 * Si el comercio activó la tasa personalizada/manual, prevalece sobre el BCV.
 */
function getEffectiveRate(): number {
  const settings = getSettings();
  if (settings.tasa_manual_activa === '1' && settings.tasa_personalizada) {
    return parseFloat(settings.tasa_personalizada) || 849.56;
  }
  return parseFloat(settings.tasa_bcv) || 849.56;
}

/**
 * Registra un evento analítico o métrica operativa en SQLite para tableros de control.
 */
function recordMetric(evento: string, detalle: string = '', jid: string = '') {
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
 * Pausa o reactiva la intervención del bot para un chat específico.
 * [ANTI-BANEO META 2025] Permite a un asesor humano tomar el control sin interferencia del bot.
 */
function toggleBotPause(jid: string, paused?: boolean | number) {
  const exists = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
  if (!exists) {
    db.prepare(`
      INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
      VALUES (?, 'Cliente', 'start', ?, 0, ?, 1)
    `).run(jid, Date.now(), paused ? 1 : 0);
  } else {
    db.prepare(`
      UPDATE chat_sessions
      SET bot_pausado = ?
      WHERE jid = ?
    `).run(paused ? 1 : 0, jid);
  }
}

/**
 * Verifica si el bot se encuentra pausado localmente para una conversación individual.
 */
function isBotPaused(jid: string): boolean {
  const session = db.prepare('SELECT bot_pausado FROM chat_sessions WHERE jid = ?').get(jid);
  return session ? parseInt(session.bot_pausado) === 1 : false;
}

/**
 * Comprueba si la intervención del bot está pausada a nivel global para todas las conversaciones.
 */
function isBotGloballyPaused(): boolean {
  const s = getSettings();
  return s.bot_pausado_global === '1';
}

/**
 * Modifica el interruptor de pausa global del bot en toda la tienda.
 */
function setBotGlobalPause(paused: boolean | number): boolean {
  updateSetting('bot_pausado_global', paused ? '1' : '0');
  return !!paused;
}

/**
 * Consolida las estadísticas del día para el panel de métricas operativas.
 */
function getMetricsSummary() {
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

/**
 * Exporta el catálogo activo en formato JSON para transferencias ligeras.
 */
function exportCatalog() {
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
 */
function importCatalog(productsList: any[]) {
  if (!Array.isArray(productsList)) throw new Error('El formato debe ser una lista de productos');

  const insertStmt = db.prepare(`
    INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, stock, activo)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  let count = 0;
  for (const p of productsList) {
    if (p.marca && p.modelo && p.precio_usd !== undefined) {
      let cat = String(p.categoria || 'Otros Productos').trim();
      if (cat === 'Repuestos para Moto' || cat.startsWith('Repuestos para Moto')) {
        cat = cat.replace('Repuestos para Moto', 'Repuestos Moto');
      }
      if (cat === 'Insumos para Caucheras' || cat.startsWith('Insumos para Caucheras')) {
        cat = cat.replace('Insumos para Caucheras', 'Insumos Cauchera');
      }

      insertStmt.run(
        String(p.marca).trim(),
        String(p.modelo).trim(),
        cat,
        parseFloat(p.precio_usd) || 0,
        String(p.descripcion || '').trim(),
        parseInt(p.stock || 1, 10)
      );
      count++;
    }
  }

  persistDB();
  return { success: true, count };
}

/**
 * [RECUPERACIÓN ANTE DESASTRES]
 * Restaura la base de datos completa a partir de un Buffer binario de SQLite (.db),
 * verificando previamente su encabezado e integridad física.
 */
function restoreDatabaseFromBuffer(buffer: Buffer | any) {
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
    try { if (rawDb) rawDb.close(); } catch {}
    rawDb = testDb;
    console.log('[DB] ¡Base de datos restaurada exitosamente desde archivo de respaldo!');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// ==================== GESTIÓN DE PROVEEDORES ====================

/**
 * Retorna la lista de proveedores comerciales registrados.
 */
function getSuppliers(activeOnly = true) {
  const sql = activeOnly
    ? 'SELECT * FROM suppliers WHERE activo = 1 ORDER BY empresa ASC'
    : 'SELECT * FROM suppliers ORDER BY empresa ASC';
  return db.prepare(sql).all();
}

/**
 * Busca un proveedor específico por su identificador primario.
 */
function getSupplierById(id: number | string) {
  return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
}

/**
 * Registra un nuevo aliado comercial o proveedor y actualiza el snapshot maestro.
 */
function createSupplier(data: any) {
  const { empresa, contacto_nombre, telefono, categorias, dias_despacho, condiciones_pago, notas } = data;
  if (!empresa || !telefono) throw new Error('Empresa y teléfono son obligatorios');
  const res = db.prepare(`
    INSERT INTO suppliers (empresa, contacto_nombre, telefono, categorias, dias_despacho, condiciones_pago, notas, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    String(empresa).trim(),
    String(contacto_nombre || '').trim(),
    String(telefono).trim(),
    String(categorias || 'Repuestos Moto').trim(),
    String(dias_despacho || '').trim(),
    String(condiciones_pago || '').trim(),
    String(notas || '').trim()
  );
  persistDB();
  saveMasterSnapshotToDisk();
  return { id: res.lastInsertRowid, ...data };
}

/**
 * Actualiza los datos de contacto o condiciones de un proveedor existente.
 */
function updateSupplier(id: number | string, data: any) {
  const { empresa, contacto_nombre, telefono, categorias, dias_despacho, condiciones_pago, notas, activo } = data;
  const existing = getSupplierById(id);
  if (!existing) throw new Error('Proveedor no encontrado');

  db.prepare(`
    UPDATE suppliers SET
      empresa = COALESCE(?, empresa),
      contacto_nombre = COALESCE(?, contacto_nombre),
      telefono = COALESCE(?, telefono),
      categorias = COALESCE(?, categorias),
      dias_despacho = COALESCE(?, dias_despacho),
      condiciones_pago = COALESCE(?, condiciones_pago),
      notas = COALESCE(?, notas),
      activo = COALESCE(?, activo)
    WHERE id = ?
  `).run(
    empresa !== undefined ? String(empresa).trim() : null,
    contacto_nombre !== undefined ? String(contacto_nombre).trim() : null,
    telefono !== undefined ? String(telefono).trim() : null,
    categorias !== undefined ? String(categorias).trim() : null,
    dias_despacho !== undefined ? String(dias_despacho).trim() : null,
    condiciones_pago !== undefined ? String(condiciones_pago).trim() : null,
    notas !== undefined ? String(notas).trim() : null,
    activo !== undefined ? (activo ? 1 : 0) : null,
    id
  );
  persistDB();
  saveMasterSnapshotToDisk();
  return getSupplierById(id);
}

/**
 * Inactiva lógicamente a un proveedor para preservar su historial transaccional.
 */
function deleteSupplier(id: number | string) {
  db.prepare('UPDATE suppliers SET activo = 0 WHERE id = ?').run(id);
  persistDB();
  saveMasterSnapshotToDisk();
  return { success: true };
}

// ==================== RESPALDO MAESTRO SNAPSHOT (CATÁLOGO + PROVEEDORES) ====================

const snapshotDir = path.join(dataDir, 'backups');
const masterSnapshotPath = path.join(snapshotDir, 'snapshot_maestro_crastur.json');

/**
 * Genera el snapshot integral con productos, proveedores, vendedores y configuraciones.
 */
function exportMasterBackup() {
  const products = db.prepare('SELECT id, marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo FROM products').all();
  const suppliers = db.prepare('SELECT id, empresa, contacto_nombre, telefono, categorias, dias_despacho, condiciones_pago, notas, activo FROM suppliers').all();
  const sellers = db.prepare('SELECT id, nombre, telefono, departamento, activo FROM sellers').all();
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settingsMap: Record<string, string> = {};
  for (const s of settingsRows) settingsMap[s.key] = s.value;

  return {
    version: '3.0',
    exportado_en: new Date().toISOString(),
    total_productos: products.length,
    total_proveedores: suppliers.length,
    total_vendedores: sellers.length,
    productos: products,
    proveedores: suppliers,
    vendedores: sellers,
    configuracion: settingsMap
  };
}

/**
 * Escribe el snapshot maestro en formato JSON en disco para fácil versionamiento y migración.
 */
function saveMasterSnapshotToDisk() {
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
function importMasterBackup(payload: any) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Formato de respaldo inválido');
  }

  let importedProducts = 0;
  let importedSuppliers = 0;
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

  // 2. Restaurar o actualizar proveedores por razón social
  if (Array.isArray(payload.proveedores)) {
    const findSupStmt = db.prepare('SELECT id FROM suppliers WHERE LOWER(TRIM(empresa)) = LOWER(TRIM(?))');
    const updateSupStmt = db.prepare(`
      UPDATE suppliers SET
        contacto_nombre = ?, telefono = ?, categorias = ?, dias_despacho = ?, condiciones_pago = ?, notas = ?, activo = 1
      WHERE id = ?
    `);
    const insertSupStmt = db.prepare(`
      INSERT INTO suppliers (empresa, contacto_nombre, telefono, categorias, dias_despacho, condiciones_pago, notas, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const s of payload.proveedores) {
      if (s.empresa && s.telefono) {
        const existing = findSupStmt.get(s.empresa);
        if (existing) {
          updateSupStmt.run(s.contacto_nombre || '', s.telefono, s.categorias || '', s.dias_despacho || '', s.condiciones_pago || '', s.notas || '', existing.id);
        } else {
          insertSupStmt.run(s.empresa.trim(), s.contacto_nombre || '', s.telefono.trim(), s.categorias || '', s.dias_despacho || '', s.condiciones_pago || '', s.notas || '');
        }
        importedSuppliers++;
      }
    }
  }

  // 3. Restaurar o actualizar vendedores
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

  // 4. Restaurar configuración preservando parámetros preestablecidos
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

  return {
    success: true,
    importedProducts,
    importedSuppliers,
    importedSellers
  };
}

/**
 * Si se detecta un catálogo vacío al inicio (por ejemplo tras clonar el repositorio),
 * reestablece automáticamente el inventario a partir del snapshot maestro.
 */
function autoRestoreSnapshotIfEmpty() {
  try {
    const prodCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE activo = 1').get()?.count || 0;
    if (prodCount === 0 && fs.existsSync(masterSnapshotPath)) {
      console.log('[Snapshot Maestro] 🔄 Base de datos vacía detectada al iniciar. Auto-restaurando catálogo y proveedores desde snapshot_maestro_crastur.json...');
      const raw = fs.readFileSync(masterSnapshotPath, 'utf8');
      const parsed = JSON.parse(raw);
      const res = importMasterBackup(parsed);
      console.log(`[Snapshot Maestro] ✅ Auto-restauración completada: ${res.importedProducts} productos, ${res.importedSuppliers} proveedores restablecidos.`);
    }
  } catch (e: any) {
    console.error('[Snapshot Maestro] Error en auto-restauración:', e?.message || e);
  }
}

// ==================== APARTADOS Y RESERVAS (24 HORAS) ====================

/**
 * Consulta la lista de apartados comerciales registrados.
 * @param onlyActive Si es true, retorna únicamente aquellos tickets vigentes no vencidos ni cancelados.
 */
function getReservations(onlyActive = false) {
  cleanExpiredReservations();
  if (onlyActive) {
    return db.prepare("SELECT * FROM reservations WHERE estado = 'activo' ORDER BY expira_en ASC").all();
  }
  return db.prepare("SELECT * FROM reservations ORDER BY id DESC").all();
}

/**
 * [APARTADOS Y RESERVAS 24H]
 * Crea un apartado formal con 24 horas continuas de validez.
 * Descuenta atómicamente 1 unidad del inventario físico para garantizar la reserva.
 */
function createReservation({ jid, nombre, cedula, telefono, producto_id, producto_nombre, precio_usd, precio_bs }: any) {
  const now = Date.now();
  const expiraEn = now + (24 * 60 * 60 * 1000); // 24 horas continuas de vigencia

  // Control de Stock: verificar y reservar unidad física
  if (producto_id) {
    const prod = db.prepare('SELECT id, stock, activo FROM products WHERE id = ?').get(producto_id);
    if (prod && prod.stock !== null && prod.stock !== undefined) {
      if (prod.stock <= 0) {
        throw new Error(`El repuesto "${producto_nombre}" no cuenta con stock disponible para apartar.`);
      }
      // Decrementar stock activo para apartar
      db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0').run(producto_id);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO reservations (jid, nombre, cedula, telefono, producto_id, producto_nombre, precio_usd, precio_bs, creado_en, expira_en, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')
  `);
  const res = stmt.run(
    jid || '',
    nombre.trim(),
    cedula.trim().toUpperCase(),
    telefono.trim(),
    producto_id || null,
    producto_nombre.trim(),
    parseFloat(precio_usd) || 0,
    parseFloat(precio_bs) || 0,
    now,
    expiraEn
  );
  persistDB();
  return {
    id: res.lastInsertRowid,
    jid,
    nombre: nombre.trim(),
    cedula: cedula.trim().toUpperCase(),
    telefono: telefono.trim(),
    producto_id,
    producto_nombre: producto_nombre.trim(),
    precio_usd: parseFloat(precio_usd) || 0,
    precio_bs: parseFloat(precio_bs) || 0,
    creado_en: now,
    expira_en: expiraEn,
    estado: 'activo'
  };
}

/**
 * Modifica el estado de un apartado (activo, entregado, cancelado, vencido).
 * Repone o descuenta el stock físico según la transición de estado.
 */
function updateReservationStatus(id: number | string, estado: string) {
  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (current) {
    // Si se cancela o vence un apartado activo, devolver stock al catálogo
    if ((estado === 'cancelado' || estado === 'vencido') && current.estado === 'activo' && current.producto_id) {
      db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(current.producto_id);
    }
    // Si se reactiva un apartado cancelado o vencido, reservar nuevamente si hay existencias
    if (estado === 'activo' && current.estado !== 'activo' && current.producto_id) {
      db.prepare('UPDATE products SET stock = MAX(0, stock - 1) WHERE id = ?').run(current.producto_id);
    }
  }
  db.prepare("UPDATE reservations SET estado = ? WHERE id = ?").run(estado, id);
  persistDB();
}

/**
 * Elimina físicamente un registro de apartado de la base de datos, reponiendo su stock si estaba activo.
 */
function deleteReservation(id: number | string) {
  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (current && current.estado === 'activo' && current.producto_id) {
    db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(current.producto_id);
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
function cleanExpiredReservations() {
  const now = Date.now();
  const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 horas adicionales de gracia

  // Paso 1: Vencer apartados que superaron las 24 horas y restituir inventario
  const newlyExpired = db.prepare("SELECT id, producto_id, producto_nombre, nombre FROM reservations WHERE expira_en <= ? AND estado = 'activo'").all(now);
  if (newlyExpired.length > 0) {
    for (const item of newlyExpired) {
      db.prepare("UPDATE reservations SET estado = 'vencido' WHERE id = ?").run(item.id);
      if (item.producto_id) {
        db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(item.producto_id);
      }
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
function getReservationsNeeding22hReminder() {
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
function markReservation22hReminderSent(id: number | string) {
  db.prepare('UPDATE reservations SET aviso_22h_enviado = 1 WHERE id = ?').run(id);
  persistDB();
}

export {
  db,
  initDB,
  whenReady,
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
  cleanExpiredReservations,
  getReservationsNeeding22hReminder,
  markReservation22hReminderSent,
  persistDB,
  persistDB as persistImmediateSync,
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  exportMasterBackup,
  saveMasterSnapshotToDisk,
  importMasterBackup,
  restoreDatabaseFromBuffer
};

export default {
  db,
  initDB,
  whenReady,
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
  cleanExpiredReservations,
  getReservationsNeeding22hReminder,
  markReservation22hReminderSent,
  persistDB,
  persistImmediateSync: persistDB,
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  exportMasterBackup,
  saveMasterSnapshotToDisk,
  importMasterBackup,
  restoreDatabaseFromBuffer
};
