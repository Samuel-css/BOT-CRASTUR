/**
 * ============================================================================
 * ESQUEMA RELACIONAL, MIGRACIONES Y VALORES POR DEFECTO (db/schema.ts)
 * ============================================================================
 * Crea las tablas base del ecosistema Crastur, aplica migraciones incrementales
 * para compatibilidad con versiones anteriores y define los parámetros comerciales
 * por defecto orientados al mercado venezolano.
 */

import { db } from './engine';

/**
 * [PERSISTENCIA / RECUPERACIÓN ANTE DESASTRES]
 * Crea las tablas base, aplica migraciones incrementales del esquema, construye índices
 * y asegura los parámetros de configuración por defecto.
 * Se invoca al iniciar el sistema y también después de restaurar una base de datos binaria,
 * garantizando que una BD de una versión anterior reciba las columnas nuevas.
 */
export function applySchemaAndMigrations(): void {
  // Creación de tablas principales del ecosistema Crastur
  db.exec(`
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

  // Migraciones automáticas: compatibilidad con esquemas anteriores.
  // [RECUPERACIÓN ANTE DESASTRES] Cada ALTER va protegido para que restaurar un .db
  // antiguo (con columnas faltantes) nunca rompa el arranque del sistema.
  const addColumnIfMissing = (table: string, column: string, definition: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`); } catch {}
  };

  // products: columnas tardías que pudieran faltar en catálogos muy antiguos
  addColumnIfMissing('products', 'categoria', "TEXT DEFAULT 'Otros Productos'");
  addColumnIfMissing('products', 'precio_usd', 'REAL DEFAULT 0');
  addColumnIfMissing('products', 'descripcion', 'TEXT');
  addColumnIfMissing('products', 'imagen_url', 'TEXT');
  addColumnIfMissing('products', 'stock', 'INTEGER DEFAULT 1');
  addColumnIfMissing('products', 'activo', 'INTEGER DEFAULT 1');
  addColumnIfMissing('products', 'creado_en', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

  // sellers
  addColumnIfMissing('sellers', 'telefono', "TEXT DEFAULT ''");
  addColumnIfMissing('sellers', 'departamento', "TEXT DEFAULT 'Ventas'");
  addColumnIfMissing('sellers', 'activo', 'INTEGER DEFAULT 1');

  // reservations: columnas NOT NULL base que pudieran faltar en respaldos antiguos
  addColumnIfMissing('reservations', 'jid', "TEXT DEFAULT ''");
  addColumnIfMissing('reservations', 'nombre', "TEXT DEFAULT ''");
  addColumnIfMissing('reservations', 'cedula', "TEXT DEFAULT ''");
  addColumnIfMissing('reservations', 'telefono', "TEXT DEFAULT ''");
  addColumnIfMissing('reservations', 'producto_nombre', "TEXT DEFAULT ''");
  addColumnIfMissing('reservations', 'precio_usd', 'REAL DEFAULT 0');
  addColumnIfMissing('reservations', 'precio_bs', 'REAL DEFAULT 0');
  addColumnIfMissing('reservations', 'creado_en', 'INTEGER DEFAULT 0');
  addColumnIfMissing('reservations', 'expira_en', 'INTEGER DEFAULT 0');

  // chat_messages / bot_metrics: columnas base
  addColumnIfMissing('chat_messages', 'jid', 'TEXT');
  addColumnIfMissing('chat_messages', 'remitente', 'TEXT');
  addColumnIfMissing('chat_messages', 'contenido', 'TEXT');
  addColumnIfMissing('chat_messages', 'timestamp', 'INTEGER');
  addColumnIfMissing('bot_metrics', 'evento', 'TEXT');
  addColumnIfMissing('bot_metrics', 'detalle', 'TEXT');
  addColumnIfMissing('bot_metrics', 'jid', 'TEXT');
  addColumnIfMissing('bot_metrics', 'timestamp', 'INTEGER');

  // chat_sessions
  addColumnIfMissing('chat_sessions', 'push_name', 'TEXT');
  addColumnIfMissing('chat_sessions', 'step', "TEXT DEFAULT 'start'");
  addColumnIfMissing('chat_sessions', 'ultimo_producto_id', 'INTEGER');
  addColumnIfMissing('chat_sessions', 'ultimo_producto_nombre', 'TEXT');
  addColumnIfMissing('chat_sessions', 'ultimo_mensaje_at', 'INTEGER');
  addColumnIfMissing('chat_sessions', 'seguimiento_enviado', 'INTEGER DEFAULT 0');
  addColumnIfMissing('chat_sessions', 'bot_pausado', 'INTEGER DEFAULT 0');
  addColumnIfMissing('chat_sessions', 'nivel_cashea', 'INTEGER DEFAULT 1');
  addColumnIfMissing('chat_sessions', 'contexto_productos', 'TEXT');
  addColumnIfMissing('chat_sessions', 'apartado_metadata', 'TEXT');
  addColumnIfMissing('chat_sessions', 'telefono_contacto', 'TEXT');
  // [ANTI-BANEO META 2025] Bandera de no molestar para excluir clientes que expresen rechazo comercial
  addColumnIfMissing('chat_sessions', 'no_molestar', 'INTEGER DEFAULT 0');

  // reservations
  addColumnIfMissing('reservations', 'producto_id', 'INTEGER');
  addColumnIfMissing('reservations', 'estado', "TEXT DEFAULT 'activo'");
  addColumnIfMissing('reservations', 'aviso_22h_enviado', 'INTEGER DEFAULT 0');
  // [APARTADOS MULTI-PRODUCTO] Detalle de todos los ítems de un combo para control de stock completo
  addColumnIfMissing('reservations', 'items_json', 'TEXT');

  // [RED DE SEGURIDAD DEL BOT] Contador de mensajes consecutivos no entendidos.
  // Con 2 seguidos se ofrece menú + asesor humano. NO guarda el texto del cliente.
  addColumnIfMissing('chat_sessions', 'fallos_consecutivos', 'INTEGER DEFAULT 0');

  // [LIMPIEZA DE MÓDULO RETIRADO] La gestión de proveedores/mayoristas fue eliminada
  // del sistema. Si se restaura un respaldo antiguo, se descarta esa tabla para
  // mantener el esquema actual coherente.
  try { db.exec('DROP TABLE IF EXISTS suppliers;'); } catch {}

  // [NORMALIZACIÓN DE ESTADOS HISTÓRICOS] Versiones anteriores del panel guardaban los
  // apartados retirados como 'retirado' o 'concretado', estados que ya no son válidos.
  // Se normalizan a 'entregado' para que el historial y las acciones del panel sean coherentes.
  try {
    db.exec("UPDATE reservations SET estado = 'entregado' WHERE estado IN ('retirado', 'concretado');");
  } catch {}

  // Sincronizar telefono_contacto desde reservations previas si estuviera vacío
  try {
    db.exec(`
      UPDATE chat_sessions
      SET telefono_contacto = (
        SELECT telefono FROM reservations WHERE jid = chat_sessions.jid ORDER BY id DESC LIMIT 1
      )
      WHERE (telefono_contacto IS NULL OR telefono_contacto = '') AND EXISTS (
        SELECT 1 FROM reservations WHERE jid = chat_sessions.jid
      );
    `);
  } catch {}

  // Índices para optimizar rendimiento de lectura en dashboards y colas.
  // [ROBUSTEZ] Cada índice va aislado: si una tabla restaurada carece de la columna,
  // no debe abortar el resto de la inicialización ni dejar la base a medias.
  const createIndexSafe = (sql: string) => {
    try { db.exec(sql); } catch (e: any) {
      console.warn('[DB] Índice omitido (columna ausente en esquema restaurado):', e?.message || e);
    }
  };
  createIndexSafe('CREATE INDEX IF NOT EXISTS idx_products_activo ON products(activo)');
  createIndexSafe('CREATE INDEX IF NOT EXISTS idx_sessions_jid ON chat_sessions(jid)');
  createIndexSafe('CREATE INDEX IF NOT EXISTS idx_messages_jid ON chat_messages(jid)');
  createIndexSafe('CREATE INDEX IF NOT EXISTS idx_metrics_evento ON bot_metrics(evento, timestamp)');
  createIndexSafe('CREATE INDEX IF NOT EXISTS idx_reservations_estado ON reservations(estado, expira_en)');

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
}
