#!/usr/bin/env node
/**
 * ============================================================================
 *  CRASTUR - HERRAMIENTA PORTABLE DE MIGRACIÓN: CATÁLOGO + ASESORES
 * ============================================================================
 * Extrae e importa ÚNICAMENTE el catálogo de productos y los asesores de venta
 * entre distintas versiones de Crastur, leyendo/escribiendo la base de datos
 * SQLite directamente (sql.js) SIN depender del esquema de cada versión.
 *
 * Lee el esquema real con `PRAGMA table_info` y toma solo las columnas que
 * existan, por lo que funciona aunque la base de datos vieja sea distinta.
 *
 * USO:
 *   Exportar (desde la versión vieja):
 *     npm run migrar -- --db "data/crastur.db" --out "catalogo_asesores.json"
 *
 *   Importar (en la versión nueva, ya con base de datos limpia):
 *     npm run migrar -- --db "data/crastur.db" --in "catalogo_asesores.json"
 *
 * Si se omite --db se usa "data/crastur.db" por defecto.
 * ============================================================================
 */

import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

type Row = Record<string, any>;

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DB = path.join(ROOT_DIR, 'data', 'crastur.db');

/** Columnas que nos interesan de cada tabla (se filtran según existan). */
const PRODUCT_COLUMNS = ['marca', 'modelo', 'categoria', 'precio_usd', 'descripcion', 'imagen_url', 'stock', 'activo'];
const SELLER_COLUMNS = ['nombre', 'telefono', 'departamento', 'activo'];

const FORMATO = 'crastur_catalogo_asesores';
const VERSION = '1.0';

/** Devuelve la lista de columnas reales de una tabla (o [] si no existe). */
function getColumns(db: any, table: string): string[] {
  try {
    const res = db.exec(`PRAGMA table_info(${table});`);
    if (!res || res.length === 0) return [];
    return res[0].values.map((v: any[]) => String(v[1]));
  } catch {
    return [];
  }
}

/** Lee filas de una tabla tomando únicamente las columnas existentes. */
function readRows(db: any, table: string, wanted: string[]): Row[] {
  const cols = getColumns(db, table);
  if (cols.length === 0) return [];
  const selected = wanted.filter((c) => cols.includes(c));
  if (selected.length === 0) return [];

  const sql = `SELECT ${selected.map((c) => `"${c}"`).join(', ')} FROM ${table};`;
  const res = db.exec(sql);
  if (!res || res.length === 0) return [];

  const { columns, values } = res[0];
  return values.map((v: any[]) => {
    const row: Row = {};
    columns.forEach((c: string, i: number) => {
      row[c] = v[i];
    });
    return row;
  });
}

/** Nombre del archivo de salida por defecto con fecha. */
function defaultOutName(): string {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(ROOT_DIR, `catalogo_asesores_${today}.json`);
}

/**
 * EXPORTAR: abre la BD indicada, extrae catálogo y asesores y escribe el JSON portable.
 */
async function exportar(dbPath: string, outPath: string): Promise<void> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`No se encontró la base de datos: ${dbPath}`);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const productos = readRows(db, 'products', PRODUCT_COLUMNS);
  const asesores = readRows(db, 'sellers', SELLER_COLUMNS);

  // Compatibilidad por si una versión antigua usara otra tabla para vendedores
  const asesoresFinal = asesores.length > 0 ? asesores : readRows(db, 'vendedores', SELLER_COLUMNS);

  const payload = {
    formato: FORMATO,
    version: VERSION,
    exportado_en: new Date().toISOString(),
    origen_bd: path.basename(dbPath),
    total_productos: productos.length,
    total_asesores: asesoresFinal.length,
    productos,
    asesores: asesoresFinal
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  try { db.close(); } catch {}

  console.log('✅ ================================================================');
  console.log('✅  EXTRACCIÓN COMPLETADA (CATÁLOGO + ASESORES)');
  console.log('✅ ================================================================');
  console.log(`📦 Productos exportados : ${productos.length}`);
  console.log(`👤 Asesores exportados  : ${asesoresFinal.length}`);
  console.log(`📄 Archivo generado     : ${outPath}`);
  console.log('\nGuarda ese archivo (pendrive/nube). Lo usarás en la versión nueva.');
}

/** Asegura que existen las tablas mínimas en la BD destino. */
function ensureTargetTables(db: any): void {
  db.run(`
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
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      departamento TEXT DEFAULT 'Ventas',
      activo INTEGER DEFAULT 1
    );
  `);
}

/** Escapa un valor para usarlo como parámetro de sql.js. */
function upsertProductos(db: any, productos: Row[]): { insertados: number; actualizados: number; omitidos: number } {
  let insertados = 0;
  let actualizados = 0;
  let omitidos = 0;
  const cols = getColumns(db, 'products');

  for (const p of productos) {
    if (!p || !p.marca || !p.modelo) { omitidos++; continue; }

    const marca = String(p.marca).trim();
    const modelo = String(p.modelo).trim();
    if (!marca || !modelo) { omitidos++; continue; }

    const categoria = String(p.categoria || 'Otros Productos').trim();
    const precio = parseFloat(p.precio_usd) || 0;
    const descripcion = String(p.descripcion || '').trim();
    const imagen = p.imagen_url != null ? String(p.imagen_url) : null;
    const stock = p.stock !== undefined && p.stock !== null ? parseInt(p.stock, 10) || 0 : 1;
    const activo = p.activo !== undefined && p.activo !== null ? (p.activo ? 1 : 0) : 1;

    const existing = db.exec(
      'SELECT id FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?)) LIMIT 1',
      [marca, modelo]
    );
    const existingId = existing?.[0]?.values?.[0]?.[0];

    if (existingId) {
      // Actualiza solo columnas disponibles en el esquema destino
      const sets: string[] = [];
      const vals: any[] = [];
      if (cols.includes('categoria')) { sets.push('categoria = ?'); vals.push(categoria); }
      if (cols.includes('precio_usd')) { sets.push('precio_usd = ?'); vals.push(precio); }
      if (cols.includes('descripcion')) { sets.push('descripcion = ?'); vals.push(descripcion); }
      if (cols.includes('imagen_url') && imagen !== null) { sets.push('imagen_url = ?'); vals.push(imagen); }
      if (cols.includes('stock')) { sets.push('stock = ?'); vals.push(stock); }
      if (cols.includes('activo')) { sets.push('activo = ?'); vals.push(activo); }
      if (sets.length > 0) {
        vals.push(existingId);
        db.run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      actualizados++;
    } else {
      db.run(
        `INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, imagen_url, stock, activo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [marca, modelo, categoria, precio, descripcion, imagen, stock, activo]
      );
      insertados++;
    }
  }

  return { insertados, actualizados, omitidos };
}

/** Inserta/actualiza asesores evitando duplicados por nombre. */
function upsertAsesores(db: any, asesores: Row[]): { insertados: number; actualizados: number; omitidos: number } {
  let insertados = 0;
  let actualizados = 0;
  let omitidos = 0;
  const cols = getColumns(db, 'sellers');

  for (const s of asesores) {
    if (!s || !s.nombre || !s.telefono) { omitidos++; continue; }

    const nombre = String(s.nombre).trim();
    const telefono = String(s.telefono).trim();
    if (!nombre || !telefono) { omitidos++; continue; }

    const departamento = String(s.departamento || 'Ventas').trim();
    const activo = s.activo !== undefined && s.activo !== null ? (s.activo ? 1 : 0) : 1;

    const existing = db.exec(
      'SELECT id FROM sellers WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1',
      [nombre]
    );
    const existingId = existing?.[0]?.values?.[0]?.[0];

    if (existingId) {
      const sets: string[] = [];
      const vals: any[] = [];
      if (cols.includes('telefono')) { sets.push('telefono = ?'); vals.push(telefono); }
      if (cols.includes('departamento')) { sets.push('departamento = ?'); vals.push(departamento); }
      if (cols.includes('activo')) { sets.push('activo = ?'); vals.push(activo); }
      if (sets.length > 0) {
        vals.push(existingId);
        db.run(`UPDATE sellers SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      actualizados++;
    } else {
      db.run(
        `INSERT INTO sellers (nombre, telefono, departamento, activo) VALUES (?, ?, ?, ?)`,
        [nombre, telefono, departamento, activo]
      );
      insertados++;
    }
  }

  return { insertados, actualizados, omitidos };
}

/**
 * IMPORTAR: carga catálogo y asesores en la BD destino sin tocar la configuración.
 */
async function importar(dbPath: string, inPath: string): Promise<void> {
  if (!fs.existsSync(inPath)) {
    throw new Error(`No se encontró el archivo de respaldo: ${inPath}`);
  }
  const payload = JSON.parse(fs.readFileSync(inPath, 'utf8'));

  const productos: Row[] = Array.isArray(payload.productos)
    ? payload.productos
    : (Array.isArray(payload.products) ? payload.products : []);
  const asesores: Row[] = Array.isArray(payload.asesores)
    ? payload.asesores
    : (Array.isArray(payload.vendedores) ? payload.vendedores : []);

  if (productos.length === 0 && asesores.length === 0) {
    throw new Error('El archivo no contiene productos ni asesores reconocibles.');
  }

  const SQL = await initSqlJs();

  const targetDir = path.dirname(dbPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  let db: any;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  ensureTargetTables(db);

  const prodRes = upsertProductos(db, productos);
  const sellerRes = upsertAsesores(db, asesores);

  // Guardado atómico (archivo temporal + reemplazo)
  const tmpPath = dbPath + '.tmp';
  fs.writeFileSync(tmpPath, Buffer.from(db.export()));
  try {
    fs.renameSync(tmpPath, dbPath);
  } catch {
    fs.copyFileSync(tmpPath, dbPath);
    try { fs.unlinkSync(tmpPath); } catch {}
  }
  try { db.close(); } catch {}

  console.log('✅ ================================================================');
  console.log('✅  IMPORTACIÓN COMPLETADA (CATÁLOGO + ASESORES)');
  console.log('✅ ================================================================');
  console.log(`📦 Productos  → nuevos: ${prodRes.insertados} | actualizados: ${prodRes.actualizados} | omitidos: ${prodRes.omitidos}`);
  console.log(`👤 Asesores   → nuevos: ${sellerRes.insertados} | actualizados: ${sellerRes.actualizados} | omitidos: ${sellerRes.omitidos}`);
  console.log(`🗄️ Base de datos destino: ${dbPath}`);
  console.log('\nPuedes arrancar Crastur y verificar el catálogo y los asesores.');
}

/** Parsea banderas simples de línea de comandos (--clave valor). */
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = args.db ? path.resolve(args.db) : DEFAULT_DB;

  if (args.in) {
    await importar(dbPath, path.resolve(args.in));
    return;
  }

  if (args.export || args.out) {
    const outPath = args.out && args.out !== 'true' ? path.resolve(args.out) : defaultOutName();
    await exportar(dbPath, outPath);
    return;
  }

  console.log(`
🛞🏍️  CRASTUR - Migración de Catálogo + Asesores
================================================================
Uso:

  EXPORTAR (desde la versión vieja):
    npm run migrar -- --db "data/crastur.db" --out "catalogo_asesores.json"

  IMPORTAR (en la versión nueva):
    npm run migrar -- --db "data/crastur.db" --in "catalogo_asesores.json"

Si omites --db se usa "data/crastur.db".
================================================================`);
}

main().catch((err: Error) => {
  console.error(`\n❌ Error en la migración: ${err.message}`);
  process.exit(1);
});
