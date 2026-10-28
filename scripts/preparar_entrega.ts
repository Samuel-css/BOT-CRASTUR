/**
 * ============================================================================
 * PREPARAR ENTREGA — CRASTUR (scripts/preparar_entrega.ts)
 * ============================================================================
 * Deja la instalación 100% limpia para copiarla a otra PC o entregarla a un
 * cliente, SIN arrastrar la base de datos, los chats, los respaldos, los PDFs
 * ni la sesión de WhatsApp del equipo de origen.
 *
 * USO:
 *   npm run preparar-entrega              → solo previsualiza (no borra nada)
 *   npm run preparar-entrega -- --confirmar   → limpia y recrea la BD limpia
 *
 * OPCIONES:
 *   --confirmar        Ejecuta la limpieza (sin este flag solo muestra el plan)
 *   --sin-respaldo     No crea copia de seguridad previa
 *   --destino <ruta>   Carpeta donde guardar el respaldo previo
 *   --conservar-dependencias  No borra node_modules (solo si la PC destino usa el MISMO sistema operativo)
 *
 * SEGURIDAD:
 *   - Nunca borra sin `--confirmar`.
 *   - Antes de limpiar, respalda toda la carpeta `data/` FUERA del proyecto.
 *   - Al final recrea una base de datos limpia usando el propio motor del
 *     sistema (esquema + configuración por defecto, 0 productos).
 *   - [ENTREGA ENTRE PLATAFORMAS] Por defecto elimina node_modules y
 *     client/node_modules: contienen binarios de ESTE sistema operativo y
 *     rompen el arranque si se copian a Windows/Mac/Linux distintos.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const KEEP_FILENAME = '.gitkeep';

function listarArchivos(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

/** Elimina directorios vacíos bajo `dir` conservando la estructura con .gitkeep. */
function podarDirectoriosVacios(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const full = path.join(dir, entry.name);
      podarDirectoriosVacios(full);
      if (fs.existsSync(full) && fs.readdirSync(full).length === 0) {
        fs.rmdirSync(full);
      }
    }
  }
}

function formatearRuta(p: string): string {
  return p.replace(os.homedir(), '~');
}

async function prepararEntrega(): Promise<void> {
  const confirmar = process.argv.includes('--confirmar');
  const sinRespaldo = process.argv.includes('--sin-respaldo');
  const destinoIdx = process.argv.indexOf('--destino');
  const destinoArg = destinoIdx >= 0 ? process.argv[destinoIdx + 1] : null;

  const projectRoot = path.resolve(__dirname, '..');
  const dataDir = process.env.CRASTUR_DATA_DIR
    ? path.resolve(process.env.CRASTUR_DATA_DIR)
    : path.join(projectRoot, 'data');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destPath = destinoArg
    ? path.resolve(destinoArg)
    : path.join(os.homedir(), 'Crastur_respaldos', `entrega_${stamp}`);

  console.log('==============================================================');
  console.log('   CRASTUR — PREPARAR SISTEMA PARA ENTREGA / OTRA PC');
  console.log('==============================================================');
  console.log(`Carpeta de datos: ${dataDir}`);

  if (!fs.existsSync(dataDir)) {
    console.log('\nNo existe la carpeta de datos. El sistema ya está limpio.');
    return;
  }

  const archivos = listarArchivos(dataDir);
  const aBorrar = archivos.filter(f => path.basename(f) !== KEEP_FILENAME);

  console.log(`\nSe van a eliminar ${aBorrar.length} archivo(s) de datos:`);
  for (const f of aBorrar) console.log(`   • data/${path.relative(dataDir, f)}`);

  if (!confirmar) {
    console.log('\n⚠️  MODO PREVISUALIZACIÓN: no se borró nada.');
    console.log('   Para ejecutar la limpieza de verdad, repite con:');
    console.log('   npm run preparar-entrega -- --confirmar\n');
    return;
  }

  // 1. Respaldo de seguridad FUERA del proyecto
  if (!sinRespaldo && aBorrar.length > 0) {
    try {
      fs.mkdirSync(destPath, { recursive: true });
      fs.cpSync(dataDir, path.join(destPath, 'data'), { recursive: true });
      console.log(`\n💾 Respaldo guardado en: ${formatearRuta(destPath)}`);
    } catch (e: any) {
      console.error(`❌ No se pudo crear el respaldo (${e?.message || e}). Se cancela por seguridad.`);
      process.exit(1);
    }
  } else if (sinRespaldo) {
    console.log('\n⚠️  Respaldo omitido (--sin-respaldo).');
  }

  // 2. Borrar datos operativos conservando los .gitkeep
  for (const f of aBorrar) {
    try { fs.rmSync(f, { force: true }); } catch (e: any) {
      console.warn(`   No se pudo borrar ${f}: ${e?.message || e}`);
    }
  }
  podarDirectoriosVacios(dataDir);
  console.log('🧹 Datos operativos, respaldos, PDFs y sesión de WhatsApp eliminados.');

  // 3. Recrear base de datos limpia + configuración por defecto + snapshot vacío
  console.log('🗄️  Recreando base de datos limpia (0 productos)...');
  const database = await import('../server/database');
  await database.whenReady();
  database.persistDB();

  // El arranque del motor de datos crea un respaldo preventivo y el snapshot del
  // estado actual. Como acabamos de recrear una BD de fábrica, ese respaldo sería
  // una copia de algo vacío: se elimina para que la entrega no arrastre residuos.
  try {
    for (const f of listarArchivos(dataDir)) {
      const base = path.basename(f);
      if (base === KEEP_FILENAME) continue;
      if (base.endsWith('.db') || (base.endsWith('.json') && base.startsWith('snapshot'))) {
        fs.rmSync(f, { force: true });
      }
    }
    podarDirectoriosVacios(dataDir);
  } catch (e: any) {
    console.warn('   Aviso al limpiar residuos del motor de datos:', e?.message || e);
  }

  // Snapshot maestro vacío para que la primera instalación en la otra PC no
  // auto-restaure ningún catálogo (instalación limpia real).
  try {
    const snapshotPath = path.join(dataDir, 'backups', 'snapshot_maestro_crastur.json');
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, JSON.stringify({
      version: '3.0',
      exportado_en: new Date().toISOString(),
      total_productos: 0,
      total_vendedores: 0,
      productos: [],
      vendedores: [],
      configuracion: {}
    }, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('   Aviso al crear el snapshot vacío:', e?.message || e);
  }

  const totalProductos = (database.db.prepare('SELECT COUNT(*) as c FROM products').get() as any)?.c || 0;
  const totalMensajes = (database.db.prepare('SELECT COUNT(*) as c FROM chat_messages').get() as any)?.c || 0;
  const totalApartados = (database.db.prepare('SELECT COUNT(*) as c FROM reservations').get() as any)?.c || 0;

  // 5. [ENTREGA ENTRE PLATAFORMAS] Eliminar dependencias instaladas en ESTA PC.
  // `node_modules` contiene binarios específicos del sistema (por ejemplo, el motor de
  // TypeScript/esbuild de macOS no funciona en Windows). Si viajan en la carpeta, el
  // instalador de la otra PC ve "dependencias instaladas" y no reinstala, dejando el
  // sistema roto. La otra PC las descargará con Instalar.bat (requiere internet).
  // Usa --conservar-dependencias si vas a entregar a un equipo con el MISMO sistema operativo.
  const conservarDeps = process.argv.includes('--conservar-dependencias');
  if (!conservarDeps) {
    const dirsAEliminar = [
      path.join(projectRoot, 'node_modules'),
      path.join(projectRoot, 'client', 'node_modules'),
      path.join(projectRoot, 'dist')
    ];
    for (const dir of dirsAEliminar) {
      if (!fs.existsSync(dir)) continue;
      try {
        console.log(`🧹 Eliminando dependencias de esta PC: ${formatearRuta(dir)}`);
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (e: any) {
        console.warn(`   No se pudo eliminar ${dir}: ${e?.message || e}`);
      }
    }
    console.log('   La PC de destino deberá abrir Instalar.bat (con internet) para descargar sus dependencias.');
    console.log('   ⚠️ En ESTA PC también se eliminaron: ejecuta "npm install" si vas a seguir trabajando aquí.');
    if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
      console.warn('   ⚠️ No se pudo borrar node_modules por completo (puede estar en uso). Ciérralo y elimínalo manualmente antes de copiar la carpeta.');
    }
  } else {
    console.log('ℹ️  Dependencias conservadas (--conservar-dependencias). Úsalas solo en un equipo con el mismo sistema operativo.');
  }

  console.log('\n==============================================================');
  console.log('✅ SISTEMA LISTO PARA ENTREGA (100% LIMPIO)');
  console.log(`   • Productos:  ${totalProductos}`);
  console.log(`   • Mensajes:   ${totalMensajes}`);
  console.log(`   • Apartados:  ${totalApartados}`);
  console.log('   • Sesión WhatsApp: eliminada (la nueva PC debe escanear su QR)');
  console.log('   • Configuración: valores de fábrica de Crastur');
  console.log(`   • Dependencias: ${conservarDeps ? 'conservadas' : 'eliminadas (se instalan en la PC de destino)'}`);
  console.log(`   • Respaldo previo: ${sinRespaldo ? 'omitido' : formatearRuta(destPath)}`);
  console.log('==============================================================\n');

  process.exit(0);
}

if (process.argv[1]?.endsWith('preparar_entrega.ts') || process.argv[1]?.endsWith('preparar_entrega.js')) {
  prepararEntrega().catch((err: Error) => {
    console.error('❌ Error preparando la entrega:', err);
    process.exit(1);
  });
}

export default prepararEntrega;
