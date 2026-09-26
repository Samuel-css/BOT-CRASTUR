const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'crastur.db');

let rawDb = null;
let SQLInstance = null;
let saveScheduled = false;
let isReady = false;
let readyResolvers = [];

function whenReady() {
  if (isReady) return Promise.resolve();
  return new Promise(resolve => readyResolvers.push(resolve));
}

function persistDB() {
  if (!rawDb) return;
  try {
    const data = rawDb.export();
    const tempPath = dbPath + '.tmp';
    fs.writeFileSync(tempPath, Buffer.from(data));
    try {
      fs.renameSync(tempPath, dbPath);
    } catch (renameErr) {
      // En Windows, si el archivo está retenido por un antivirus o proceso de indexación
      if (process.platform === 'win32' || renameErr.code === 'EPERM' || renameErr.code === 'EBUSY') {
        fs.copyFileSync(tempPath, dbPath);
        try { fs.unlinkSync(tempPath); } catch (_) {}
      } else {
        throw renameErr;
      }
    }
  } catch (e) {
    console.error('[DB] Error guardando archivo crastur.db:', e.message);
  }
}

// Protección de guardado atómico ante apagones o cierre de la PC
if (typeof process !== 'undefined') {
  const handleExit = () => {
    try {
      persistDB();
    } catch (e) {}
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

function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    persistDB();
  }, 100);
}

// Wrapper compatible con la API de better-sqlite3
const db = {
  pragma: () => {},
  exec: (sql) => {
    if (!rawDb) throw new Error('Base de datos no inicializada');
    const res = rawDb.exec(sql);
    scheduleSave();
    return res;
  },
  prepare: (sql) => {
    return {
      run: (...params) => {
        if (!rawDb) throw new Error('Base de datos no inicializada');
        const flat = params.flat();
        rawDb.run(sql, flat);
        scheduleSave();
        const lastId = rawDb.exec('SELECT last_insert_rowid() as id');
        return { lastInsertRowid: lastId[0]?.values[0]?.[0] || 0 };
      },
      get: (...params) => {
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
      all: (...params) => {
        if (!rawDb) throw new Error('Base de datos no inicializada');
        const flat = params.flat();
        const stmt = rawDb.prepare(sql);
        stmt.bind(flat);
        const results = [];
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
 * Guarda un backup diario con fecha y elimina backups con más de 7 días.
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

    // Eliminar backups de más de 7 días
    const files = fs.readdirSync(backupDir)
      .filter(f => f.match(/^crastur_backup_\d{4}-\d{2}-\d{2}\.db$/))
      .sort(); // orden cronológico
    if (files.length > 7) {
      const toDelete = files.slice(0, files.length - 7);
      toDelete.forEach(f => {
        try { fs.unlinkSync(path.join(backupDir, f)); } catch {}
        console.log(`[DB Backup] Backup antiguo eliminado: ${f}`);
      });
    }

    // También actualizar el backup "último" legacy para compatibilidad
    fs.writeFileSync(latestBackupPath, Buffer.from(rawDb.export()));
  } catch (bkErr) {
    console.error('[DB Backup] Error en backup diario:', bkErr.message);
  }
}

async function initDB() {
  if (isReady) return;

  const SQL = await initSqlJs();
  SQLInstance = SQL;

  // 1. Intentar cargar base de datos existente o restaurar desde backup si está dañada
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      rawDb = new SQL.Database(fileBuffer);
      // Verificación de integridad REAL con PRAGMA
      const integrityResult = rawDb.exec('PRAGMA integrity_check;');
      const integrityStatus = integrityResult[0]?.values[0]?.[0];
      if (integrityStatus !== 'ok') {
        throw new Error(`Integridad fallida: ${integrityStatus}`);
      }
    } catch (e) {
      console.error('[DB Auto-Recuperación] Base de datos dañada o ilegible. Intentando restaurar desde backup...', e.message);
      let restored = false;

      // Buscar el backup más reciente disponible (primero el diario, luego el legacy)
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
        } catch (bkErr) {
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
    } catch (e) {
      rawDb = new SQL.Database();
    }
  } else {
    rawDb = new SQL.Database();
  }

  // 2. Crear backup inicial inmediato
  try {
    const backupData = rawDb.export();
    fs.writeFileSync(latestBackupPath, Buffer.from(backupData));
  } catch {}


  // Crear tablas principales
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

  // Migración: agregar columna apartado_metadata si no existe (bases de datos antiguas)
  try {
    rawDb.exec('ALTER TABLE chat_sessions ADD COLUMN apartado_metadata TEXT;');
  } catch {}

  // Migración: agregar columna telefono_contacto a chat_sessions si no existe
  try {
    rawDb.exec('ALTER TABLE chat_sessions ADD COLUMN telefono_contacto TEXT;');
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

  // Migración: agregar columna aviso_22h_enviado si no existe
  try {
    rawDb.exec('ALTER TABLE reservations ADD COLUMN aviso_22h_enviado INTEGER DEFAULT 0;');
  } catch {}

  // Índices optimizadores para queries frecuentes
  rawDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_activo ON products(activo);
    CREATE INDEX IF NOT EXISTS idx_sessions_jid ON chat_sessions(jid);
    CREATE INDEX IF NOT EXISTS idx_messages_jid ON chat_messages(jid);
    CREATE INDEX IF NOT EXISTS idx_metrics_evento ON bot_metrics(evento, timestamp);
    CREATE INDEX IF NOT EXISTS idx_reservations_estado ON reservations(estado, expira_en);
  `);

  // Default settings
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
    'metodos_pago': 'Precio Promoción en Divisas (Efectivo $ y Binance Pay USDT), Pago Móvil y Transferencia (tasa BCV), Efectivo Bs y Cashea en tienda.',
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

  // Garantizar que la tabla de vendedores inicie limpia (0 asesores por defecto)
  db.exec('DELETE FROM sellers WHERE nombre LIKE "%Asesor de Repuestos%";');

  // Normalizar y blindar categorías contra inconsistencias históricas o de prueba
  try {
    db.prepare("UPDATE products SET categoria = 'Repuestos Moto' WHERE categoria = 'Repuestos para Moto' OR categoria LIKE 'Repuestos para Moto%'").run();
    db.prepare("UPDATE products SET categoria = 'Insumos Cauchera' WHERE categoria = 'Insumos para Caucheras' OR categoria LIKE 'Insumos para Caucheras%'").run();
    db.prepare("DELETE FROM products WHERE modelo LIKE '%TEST%' OR categoria LIKE '%Test%' OR marca = 'TEST'").run();
  } catch {}

  // Optimización de arranque y liberación limpia de apartados vencidos mientras la PC estuvo apagada
  try {
    rawDb.exec('PRAGMA optimize;');
    cleanExpiredReservations();
  } catch {}

  // Guardar inmediatamente en disco
  persistDB();

  // Programar backup diario cada 24 horas (unref para no bloquear cierre en scripts)
  const dailyBackupTimer = setInterval(performDailyBackup, 24 * 60 * 60 * 1000);
  if (dailyBackupTimer && dailyBackupTimer.unref) dailyBackupTimer.unref();

  // Backup inicial al arrancar (diferido 5 segundos)
  const initBackupTimer = setTimeout(performDailyBackup, 5000);
  if (initBackupTimer && initBackupTimer.unref) initBackupTimer.unref();

  isReady = true;
  readyResolvers.forEach(res => res());
  readyResolvers = [];
  console.log('[DB] Base de datos local SQLite (sql.js WASM) lista y persistida en crastur.db');
}

// Iniciar automáticamente en segundo plano
initDB().catch(err => console.error('[DB] Error iniciando base de datos:', err));

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) {
    obj[r.key] = r.value;
  }
  return obj;
}

function updateSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

function getEffectiveRate() {
  const settings = getSettings();
  if (settings.tasa_manual_activa === '1' && settings.tasa_personalizada) {
    return parseFloat(settings.tasa_personalizada) || 849.56;
  }
  return parseFloat(settings.tasa_bcv) || 849.56;
}

function recordMetric(evento, detalle = '', jid = '') {
  try {
    db.prepare(`
      INSERT INTO bot_metrics (evento, detalle, jid, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(evento, detalle, jid, Date.now());
  } catch (e) {
    console.error('Error recording metric:', e.message);
  }
}

function toggleBotPause(jid, paused) {
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

function isBotPaused(jid) {
  const session = db.prepare('SELECT bot_pausado FROM chat_sessions WHERE jid = ?').get(jid);
  // Comparación robusta: acepta tanto número 1 como string '1'
  return session ? parseInt(session.bot_pausado) === 1 : false;
}

function isBotGloballyPaused() {
  const s = getSettings();
  return s.bot_pausado_global === '1';
}

function setBotGlobalPause(paused) {
  updateSetting('bot_pausado_global', paused ? '1' : '0');
  return !!paused;
}

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

  // Métricas de alto impacto comercial
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

function exportCatalog() {
  const products = db.prepare('SELECT marca, modelo, categoria, precio_usd, descripcion, stock FROM products WHERE activo = 1').all();
  return {
    version: '1.0',
    exportado_en: new Date().toISOString(),
    total: products.length,
    productos: products
  };
}

function importCatalog(productsList) {
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

  // Respaldo inmediato tras importar
  persistDB();
  return { success: true, count };
}

function restoreDatabaseFromBuffer(buffer) {
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

    // Respaldo preventivo antes de sobrescribir
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
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getReservations(onlyActive = false) {
  cleanExpiredReservations();
  if (onlyActive) {
    return db.prepare("SELECT * FROM reservations WHERE estado = 'activo' ORDER BY expira_en ASC").all();
  }
  return db.prepare("SELECT * FROM reservations ORDER BY id DESC").all();
}

function createReservation({ jid, nombre, cedula, telefono, producto_id, producto_nombre, precio_usd, precio_bs }) {
  const now = Date.now();
  const expiraEn = now + (24 * 60 * 60 * 1000); // 24 horas continuas

  // 1. Control de Stock: verificar y reservar unidad
  if (producto_id) {
    const prod = db.prepare('SELECT id, stock, activo FROM products WHERE id = ?').get(producto_id);
    if (prod && prod.stock !== null && prod.stock !== undefined) {
      if (prod.stock <= 0) {
        throw new Error(`El repuesto "${producto_nombre}" no cuenta con stock disponible para apartar.`);
      }
      // Descontar unidad del stock activo
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

function updateReservationStatus(id, estado) {
  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (current) {
    // Si se cancela o expira un apartado que estaba activo, devolver stock al inventario
    if ((estado === 'cancelado' || estado === 'vencido') && current.estado === 'activo' && current.producto_id) {
      db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(current.producto_id);
    }
    // Si se reactiva un apartado que estaba inactivo, descontar nuevamente si hay stock
    if (estado === 'activo' && current.estado !== 'activo' && current.producto_id) {
      db.prepare('UPDATE products SET stock = MAX(0, stock - 1) WHERE id = ?').run(current.producto_id);
    }
  }
  db.prepare("UPDATE reservations SET estado = ? WHERE id = ?").run(estado, id);
  persistDB();
}

function deleteReservation(id) {
  const current = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
  if (current && current.estado === 'activo' && current.producto_id) {
    db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(current.producto_id);
  }
  db.prepare("DELETE FROM reservations WHERE id = ?").run(id);
  persistDB();
}

/**
 * Gestiona el ciclo de vida de los apartados:
 * 1. A las 24h: pasa de 'activo' a 'vencido' y repone el stock para que la tienda pueda venderlo.
 * 2. 12 horas adicionales de gracia: permanece visible como 'vencido' en el panel para consulta.
 * 3. A las 36h totales (24h + 12h de gracia): se purga definitivamente de la base de datos.
 */
function cleanExpiredReservations() {
  const now = Date.now();
  const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 horas extras

  // Paso 1: Marcar como 'vencido' los apartados que superaron las 24 horas y reponer stock
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

  // Paso 2: Purgar definitivamente solo los que superaron las 12 horas extras tras vencer
  const deadlineForPurge = now - GRACE_PERIOD_MS;
  const toPurge = db.prepare("SELECT id, nombre, producto_nombre FROM reservations WHERE estado = 'vencido' AND expira_en <= ?").all(deadlineForPurge);
  if (toPurge.length > 0) {
    db.prepare("DELETE FROM reservations WHERE estado = 'vencido' AND expira_en <= ?").run(deadlineForPurge);
    persistDB();
    console.log(`[Apartados 24h] Purgados ${toPurge.length} apartados tras cumplir sus 12 horas extras de gracia post-vencimiento.`);
  }

  return newlyExpired;
}

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

function markReservation22hReminderSent(id) {
  db.prepare('UPDATE reservations SET aviso_22h_enviado = 1 WHERE id = ?').run(id);
  persistDB();
}

module.exports = {
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
  performDailyBackup,
  restoreDatabaseFromBuffer
};
