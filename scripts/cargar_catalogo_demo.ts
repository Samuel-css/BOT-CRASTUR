/**
 * ============================================================================
 * CARGADOR DE CATÁLOGO DE DEMOSTRACIÓN (scripts/cargar_catalogo_demo.ts)
 * ============================================================================
 * Inserta un catálogo REALISTA de Crastur (insumos de cauchera, repuestos de moto,
 * accesorios y lubricantes) para poder probar el bot, el diccionario y el panel
 * sin depender de cargar el inventario real a mano.
 *
 * Características:
 * - Idempotente: hace UPSERT por (marca + modelo), así se puede ejecutar varias veces.
 * - No borra nada por defecto.
 * - `--limpiar` elimina EXACTAMENTE los productos de demostración de esta lista.
 *
 * Uso:
 *   npm run catalogo-demo              # cargar/actualizar catálogo demo
 *   npm run catalogo-demo -- --limpiar # quitar los productos demo
 *
 * [AVISO] Los productos demo quedarán visibles para el bot. Para una entrega real,
 * usa `npm run reset` o `npm run preparar-entrega -- --confirmar`.
 */

import { db, whenReady, persistDB, saveMasterSnapshotToDisk } from '../server/database';
import { invalidateProductCache } from '../server/bot/services/searchService';

interface DemoProduct {
  marca: string;
  modelo: string;
  categoria: string;
  precio_usd: number;
  stock: number;
  descripcion: string;
}

export const DEMO_CATALOG: DemoProduct[] = [
  // ── 🛞 Insumos para Caucheras ──────────────────────────────────────────────
  { marca: 'Tip Top', modelo: 'Parches en Frío Caja x50', categoria: 'Insumos Cauchera - Parches', precio_usd: 12, stock: 20, descripcion: 'Parches vulcanizados en frío para tripas y cauchos.' },
  { marca: 'Rema', modelo: 'Parches en Caliente Ovalados', categoria: 'Insumos Cauchera - Parches', precio_usd: 14, stock: 15, descripcion: 'Parches ovalados para reparación en caliente de cauchos.' },
  { marca: 'Genérico', modelo: 'Pega Química Azul para Parches', categoria: 'Insumos Cauchera - Pegas', precio_usd: 4, stock: 25, descripcion: 'Cemento químico azul de alta adherencia para parches.' },
  { marca: 'Genérico', modelo: 'Cemento Vulcanizante Negro', categoria: 'Insumos Cauchera - Pegas', precio_usd: 5, stock: 18, descripcion: 'Pega negra vulcanizante para parches en frío.' },
  { marca: 'Wurth', modelo: 'Válvula Corta TR412 x10', categoria: 'Insumos Cauchera - Válvulas', precio_usd: 3, stock: 40, descripcion: 'Válvulas de goma sin tripa TR412 para caucho tubeless.' },
  { marca: 'Genérico', modelo: 'Válvula sin Tripa TR414', categoria: 'Insumos Cauchera - Válvulas', precio_usd: 2, stock: 2, descripcion: 'Válvula metálica TR414 para rines de aluminio.' },
  { marca: 'Genérico', modelo: 'Tarugos Mechas para Pinchazos', categoria: 'Insumos Cauchera - Tarugos', precio_usd: 2, stock: 30, descripcion: 'Mechas de goma para reparar pinchazos al instante.' },
  { marca: 'Genérico', modelo: 'Plomos de Balanceo Adhesivos', categoria: 'Insumos Cauchera - Plomos', precio_usd: 6, stock: 12, descripcion: 'Contrapesos adhesivos para rines de aluminio.' },
  { marca: 'Genérico', modelo: 'Plomos de Pestaña para Rin de Hierro', categoria: 'Insumos Cauchera - Plomos', precio_usd: 5, stock: 3, descripcion: 'Contrapesos de pestaña para balanceo de rines de hierro.' },
  { marca: 'Genérico', modelo: 'Aguja de Cauchera', categoria: 'Insumos Cauchera - Herramientas', precio_usd: 4, stock: 10, descripcion: 'Aguja de acero para insertar mechas de pinchazo.' },
  { marca: 'Genérico', modelo: 'Terraja de Rosca para Válvulas', categoria: 'Insumos Cauchera - Herramientas', precio_usd: 8, stock: 8, descripcion: 'Terraja para reparar la rosca de válvulas.' },
  { marca: 'Genérico', modelo: 'Rodillo Asentador de Talón', categoria: 'Insumos Cauchera - Herramientas', precio_usd: 10, stock: 6, descripcion: 'Rodillo asentador para montar cauchos.' },
  { marca: 'Genérico', modelo: 'Manómetro Calibrador de Presión', categoria: 'Insumos Cauchera - Herramientas', precio_usd: 12, stock: 7, descripcion: 'Manómetro medidor de presión de cauchos.' },
  { marca: 'Genérico', modelo: 'Sellador de Talón Pasta', categoria: 'Insumos Cauchera - Selladores', precio_usd: 6, stock: 9, descripcion: 'Pasta selladora de talón para evitar fugas.' },
  { marca: 'Genérico', modelo: 'Pasta para Montar Cauchos', categoria: 'Insumos Cauchera - Selladores', precio_usd: 7, stock: 8, descripcion: 'Pasta lubricante para montaje de cauchos.' },

  // ── 🏍️ Repuestos para Moto ────────────────────────────────────────────────
  { marca: 'Choho', modelo: 'Kit de Arrastre 428H Bera SBR', categoria: 'Repuestos Moto - Transmisión', precio_usd: 28, stock: 10, descripcion: 'Kit de arrastre reforzado paso 428H con piñón y corona.' },
  { marca: 'Genérico', modelo: 'Cadena 428H Reforzada', categoria: 'Repuestos Moto - Transmisión', precio_usd: 10, stock: 14, descripcion: 'Cadena de transmisión 428H para moto.' },
  { marca: 'Genérico', modelo: 'Piñón 15 Dientes Bera SBR 150', categoria: 'Repuestos Moto - Transmisión', precio_usd: 6, stock: 12, descripcion: 'Piñón de arrastre 15 dientes para Bera SBR.' },
  { marca: 'Genérico', modelo: 'Corona 43 Dientes Empire Horse', categoria: 'Repuestos Moto - Transmisión', precio_usd: 9, stock: 11, descripcion: 'Corona de arrastre 43 dientes para Empire Horse.' },
  { marca: 'Bera', modelo: 'Pastillas de Freno Delanteras SBR 150', categoria: 'Repuestos Moto - Frenos', precio_usd: 5, stock: 20, descripcion: 'Pastillas de freno semimetálicas delanteras para Bera SBR.' },
  { marca: 'Empire', modelo: 'Balatas de Freno Traseras Horse', categoria: 'Repuestos Moto - Frenos', precio_usd: 5, stock: 16, descripcion: 'Balatas de freno traseras para Empire Horse.' },
  { marca: 'Genérico', modelo: 'Banda de Freno Suzuki GN125', categoria: 'Repuestos Moto - Frenos', precio_usd: 7, stock: 15, descripcion: 'Banda de freno para Suzuki GN125.' },
  { marca: 'Genérico', modelo: 'Zapata de Freno Keeway Owen', categoria: 'Repuestos Moto - Frenos', precio_usd: 8, stock: 10, descripcion: 'Zapatas de freno para Keeway Owen.' },
  { marca: 'Genérico', modelo: 'Disco de Freno Delantero Pulsar', categoria: 'Repuestos Moto - Frenos', precio_usd: 18, stock: 6, descripcion: 'Disco de freno delantero para Pulsar 180.' },
  { marca: 'NGK', modelo: 'Bujía D8EA', categoria: 'Repuestos Moto - Encendido', precio_usd: 3.5, stock: 30, descripcion: 'Bujía original japonesa D8EA de rosca larga.' },
  { marca: 'NGK', modelo: 'Bujía C7HSA', categoria: 'Repuestos Moto - Encendido', precio_usd: 4, stock: 28, descripcion: 'Bujía de encendido NGK C7HSA para moto.' },
  { marca: 'Genérico', modelo: 'Bobina de Encendido Bera SBR', categoria: 'Repuestos Moto - Encendido', precio_usd: 12, stock: 8, descripcion: 'Bobina de encendido para Bera SBR.' },
  { marca: 'Genérico', modelo: 'CDI Keeway Owen 150', categoria: 'Repuestos Moto - Encendido', precio_usd: 15, stock: 7, descripcion: 'Módulo CDI para Keeway Owen 150.' },
  { marca: 'Genérico', modelo: 'Regulador Rectificador Suzuki GN', categoria: 'Repuestos Moto - Encendido', precio_usd: 14, stock: 6, descripcion: 'Regulador rectificador de voltaje para Suzuki GN.' },
  { marca: 'Genérico', modelo: 'Estator Magneto Bera SBR', categoria: 'Repuestos Moto - Encendido', precio_usd: 25, stock: 5, descripcion: 'Estator magneto para Bera SBR.' },
  { marca: 'Genérico', modelo: 'Batería 12V 5Ah Moto', categoria: 'Repuestos Moto - Electricidad', precio_usd: 30, stock: 9, descripcion: 'Batería 12V 5Ah para moto.' },
  { marca: 'Genérico', modelo: 'Filtro de Aire Bera SBR 150', categoria: 'Repuestos Moto - Motor', precio_usd: 6, stock: 12, descripcion: 'Filtro de aire para Bera SBR 150.' },
  { marca: 'Genérico', modelo: 'Filtro de Aceite Pulsar 180', categoria: 'Repuestos Moto - Motor', precio_usd: 7, stock: 10, descripcion: 'Filtro de aceite para Pulsar 180.' },
  { marca: 'Genérico', modelo: 'Direccional LED Universal Par', categoria: 'Repuestos Moto - Luces', precio_usd: 8, stock: 14, descripcion: 'Direccionales LED universales para moto.' },
  { marca: 'Genérico', modelo: 'Stop Trasero LED', categoria: 'Repuestos Moto - Luces', precio_usd: 9, stock: 10, descripcion: 'Luz de stop trasera LED para moto.' },
  { marca: 'Genérico', modelo: 'Pito Bocina 12V Moto', categoria: 'Repuestos Moto - Electricidad', precio_usd: 5, stock: 13, descripcion: 'Bocina 12V para moto.' },
  { marca: 'Genérico', modelo: 'Guaya de Acelerador Bera SBR', categoria: 'Repuestos Moto - Mandos', precio_usd: 3, stock: 20, descripcion: 'Guaya de acelerador para Bera SBR.' },
  { marca: 'Genérico', modelo: 'Guaya de Croche Empire Horse', categoria: 'Repuestos Moto - Mandos', precio_usd: 3.5, stock: 18, descripcion: 'Guaya de clutch para Empire Horse.' },
  { marca: 'Genérico', modelo: 'Croche Completo Suzuki GN125', categoria: 'Repuestos Moto - Mandos', precio_usd: 12, stock: 8, descripcion: 'Kit de croche completo para Suzuki GN125.' },
  { marca: 'Genérico', modelo: 'Tripa Aro 17 Reforzada Moto', categoria: 'Repuestos Moto - Tripas y Cauchos', precio_usd: 6, stock: 20, descripcion: 'Tripa reforzada aro 17 para moto.' },
  { marca: 'Genérico', modelo: 'Tripa Aro 18 Reforzada Moto', categoria: 'Repuestos Moto - Tripas y Cauchos', precio_usd: 6.5, stock: 22, descripcion: 'Tripa reforzada aro 18 para moto.' },
  { marca: 'Michelin', modelo: 'Caucho 170/70-R14 Moto', categoria: 'Repuestos Moto - Tripas y Cauchos', precio_usd: 20, stock: 5, descripcion: 'Caucho trasero 170/70 R14 para moto.' },
  { marca: 'Genérico', modelo: 'Caucho 275-18 Moto', categoria: 'Repuestos Moto - Tripas y Cauchos', precio_usd: 15, stock: 7, descripcion: 'Caucho 275-18 para moto.' },
  { marca: 'Genérico', modelo: 'Amortiguador Trasero Pulsar 180', categoria: 'Repuestos Moto - Suspensión', precio_usd: 22, stock: 6, descripcion: 'Amortiguador trasero para Pulsar 180.' },
  { marca: 'Genérico', modelo: 'Horquilla Delantera Bera SBR', categoria: 'Repuestos Moto - Suspensión', precio_usd: 35, stock: 4, descripcion: 'Horquilla delantera completa para Bera SBR.' },
  { marca: 'Genérico', modelo: 'Rodamiento Ruleman 6202', categoria: 'Repuestos Moto - Motor', precio_usd: 4, stock: 30, descripcion: 'Rodamiento 6202 para motor de moto.' },
  { marca: 'Genérico', modelo: 'Retén de Aceite 20x35x7', categoria: 'Repuestos Moto - Motor', precio_usd: 3, stock: 25, descripcion: 'Retén de aceite 20x35x7 para moto.' },
  { marca: 'Genérico', modelo: 'Empaque Junta de Culata Bera SBR', categoria: 'Repuestos Moto - Motor', precio_usd: 5, stock: 12, descripcion: 'Empaque de culata para Bera SBR.' },

  // ── 🎽 Accesorios para Moto ───────────────────────────────────────────────
  { marca: 'Genérico', modelo: 'Puños Antideslizantes Universales', categoria: 'Accesorios Moto - Mandos', precio_usd: 5, stock: 20, descripcion: 'Puños antideslizantes para manubrio de moto.' },
  { marca: 'Genérico', modelo: 'Malla Porta Casco Pulpo Pulpos', categoria: 'Accesorios Moto - Porta Casco', precio_usd: 3, stock: 25, descripcion: 'Malla elástica porta casco tipo pulpo.' },
  { marca: 'Genérico', modelo: 'Retrovisores Par Moto Universal', categoria: 'Accesorios Moto - Espejos', precio_usd: 9, stock: 15, descripcion: 'Par de retrovisores universales para moto.' },
  { marca: 'Genérico', modelo: 'Espejos Cromados Bera SBR', categoria: 'Accesorios Moto - Espejos', precio_usd: 10, stock: 12, descripcion: 'Espejos cromados para Bera SBR.' },
  { marca: 'Genérico', modelo: 'Candado de Disco con Alarma', categoria: 'Accesorios Moto - Seguridad', precio_usd: 12, stock: 10, descripcion: 'Candado de disco con alarma para moto.' },
  { marca: 'Genérico', modelo: 'Spray Lubricante para Cadena', categoria: 'Accesorios Moto - Mantenimiento', precio_usd: 6, stock: 18, descripcion: 'Spray lubricante para cadena de moto.' },
  { marca: 'Genérico', modelo: 'Guantes Moto Talla L', categoria: 'Accesorios Moto - Seguridad', precio_usd: 8, stock: 14, descripcion: 'Guantes de protección para moto talla L.' },
  { marca: 'Genérico', modelo: 'Impermeable para Moto', categoria: 'Accesorios Moto - Seguridad', precio_usd: 7, stock: 9, descripcion: 'Impermeable para piloto de moto.' },
  { marca: 'Genérico', modelo: 'Soporte de Celular para Manubrio', categoria: 'Accesorios Moto - Accesorios', precio_usd: 6, stock: 11, descripcion: 'Soporte para celular en el manubrio de moto.' },
  { marca: 'Shaft', modelo: 'Casco Abatible Talla M', categoria: 'Accesorios Moto - Cascos', precio_usd: 35, stock: 6, descripcion: 'Casco abatible con visor, talla M.' },

  // ── 📦 Otros Productos (lubricantes y mantenimiento) ─────────────────────
  { marca: 'Motul', modelo: 'Aceite 4T 20W50 Mineral 1L', categoria: 'Lubricantes & Fluidos - Aceites de Motor 4T / 2T', precio_usd: 6, stock: 23, descripcion: 'Aceite mineral 4 tiempos 20W50 para motor de moto.' },
  { marca: 'Motul', modelo: 'Aceite 2T 100% Sintético 1L', categoria: 'Lubricantes & Fluidos - Aceites de Motor 4T / 2T', precio_usd: 9, stock: 15, descripcion: 'Aceite 2 tiempos 100% sintético para moto.' },
  { marca: 'Venoco', modelo: 'Aceite 4T 20W50 Mineral 1L', categoria: 'Lubricantes & Fluidos - Aceites de Motor 4T / 2T', precio_usd: 5, stock: 20, descripcion: 'Aceite mineral 4T 20W50 para moto.' },
  { marca: 'Genérico', modelo: 'Refrigerante Verde para Radiador 1L', categoria: 'Otros Productos - Fluidos', precio_usd: 5, stock: 14, descripcion: 'Refrigerante verde para radiador.' },
  { marca: 'Genérico', modelo: 'Limpiador de Inyectores 300ml', categoria: 'Otros Productos - Aditivos', precio_usd: 6, stock: 16, descripcion: 'Limpiador de inyectores para motor.' },
  { marca: 'Genérico', modelo: 'Aditivo de Gasolina 4 en 1', categoria: 'Otros Productos - Aditivos', precio_usd: 7, stock: 12, descripcion: 'Aditivo de gasolina 4 en 1.' },
  { marca: 'Genérico', modelo: 'Bombillo LED H4 12V', categoria: 'Otros Productos - Electricidad', precio_usd: 6, stock: 20, descripcion: 'Bombillo LED H4 12V de alta luminosidad.' },
  { marca: 'Genérico', modelo: 'Bombillo Halógeno H4', categoria: 'Otros Productos - Electricidad', precio_usd: 4, stock: 18, descripcion: 'Bombillo halógeno H4 12V.' },
  { marca: 'Genérico', modelo: 'Plumillas Limpiaparabrisas 14"', categoria: 'Otros Productos - Accesorios', precio_usd: 5, stock: 10, descripcion: 'Plumilla limpiaparabrisas de 14 pulgadas.' },
  { marca: 'Genérico', modelo: 'Silicona para Empaques', categoria: 'Otros Productos - Aditivos', precio_usd: 3, stock: 15, descripcion: 'Silicona selladora para empaques y juntas.' }
];

async function run(): Promise<void> {
  const limpiar = process.argv.includes('--limpiar');
  await whenReady();

  if (limpiar) {
    const del = db.prepare('DELETE FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?))');
    let removed = 0;
    for (const p of DEMO_CATALOG) {
      const before = db.prepare('SELECT COUNT(*) as c FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?))').get(p.marca, p.modelo)?.c || 0;
      del.run(p.marca, p.modelo);
      removed += before;
    }
    invalidateProductCache();
    persistDB();
    saveMasterSnapshotToDisk();
    console.log(`🧹 Catálogo demo eliminado: ${removed} producto(s) retirado(s).`);
    return;
  }

  // [CORRECCIÓN] Arregla el error ortográfico heredado "aciete" en el catálogo existente.
  try {
    db.prepare("UPDATE products SET modelo = REPLACE(modelo, 'aciete', 'aceite') WHERE LOWER(modelo) LIKE '%aciete%'").run();
  } catch {}

  const findStmt = db.prepare('SELECT id FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?)) LIMIT 1');
  const insertStmt = db.prepare(`
    INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, stock, activo)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const updateStmt = db.prepare(`
    UPDATE products SET categoria = ?, precio_usd = ?, descripcion = ?, stock = ?, activo = 1 WHERE id = ?
  `);

  let inserted = 0;
  let updated = 0;
  for (const p of DEMO_CATALOG) {
    const existing = findStmt.get(p.marca, p.modelo);
    if (existing) {
      updateStmt.run(p.categoria, p.precio_usd, p.descripcion, p.stock, existing.id);
      updated++;
    } else {
      insertStmt.run(p.marca, p.modelo, p.categoria, p.precio_usd, p.descripcion, p.stock);
      inserted++;
    }
  }

  invalidateProductCache();
  persistDB();
  saveMasterSnapshotToDisk();

  const total = (db.prepare('SELECT COUNT(*) as c FROM products WHERE activo = 1').get() as any)?.c || 0;
  console.log(`✅ Catálogo demo cargado: ${inserted} nuevos, ${updated} actualizados.`);
  console.log(`📦 Productos activos en la base: ${total}`);
  console.log('💡 Para quitarlos: npm run catalogo-demo -- --limpiar');
}

if (process.argv[1]?.includes('cargar_catalogo_demo')) {
  run()
    .then(() => process.exit(0))
    .catch((err: Error) => {
      console.error('❌ Error cargando catálogo demo:', err);
      process.exit(1);
    });
}

export default run;
