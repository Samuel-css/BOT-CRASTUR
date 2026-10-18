/**
 * ============================================================================
 * ACTUALIZACIÓN SEGURA DEL SISTEMA (scripts/actualizar.ts)
 * ============================================================================
 * Deja el sistema al día con un solo comando:
 *   1. Guarda una copia de seguridad de la base de datos ANTES de tocar nada.
 *   2. Instala/actualiza las dependencias del servidor y del panel.
 *   3. Recompila el panel visual (Vite).
 *
 * Uso:
 *   npm run actualizar
 *
 * [SEGURIDAD] Nunca borra la base de datos ni los respaldos. Si algo falla, el
 * respaldo preventivo queda guardado con fecha y hora en data/backups/.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'crastur.db');
const isWin = process.platform === 'win32';
const NPM = isWin ? 'npm.cmd' : 'npm';

function run(cmd: string, args: string[], cwd: string, label: string): boolean {
  console.log(`\n▶ ${label}...`);
  try {
    execSync(`${cmd} ${args.join(' ')}`, { cwd, stdio: 'inherit' });
    return true;
  } catch (e: any) {
    console.error(`\n❌ Falló: ${label}`);
    return false;
  }
}

function backupDatabase(): void {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      console.log('ℹ️  No hay base de datos todavía (instalación nueva). Nada que respaldar.');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(BACKUP_DIR, `crastur_pre_actualizacion_${stamp}.db`);
    fs.copyFileSync(DB_FILE, dest);
    console.log(`💾 Respaldo preventivo creado: data/backups/${path.basename(dest)}`);
  } catch (e: any) {
    console.warn('⚠️  No se pudo crear el respaldo preventivo:', e?.message || e);
  }
}

async function main(): Promise<void> {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   CRASTUR · Actualización segura del sistema');
  console.log('════════════════════════════════════════════════════════════');

  // 1. Respaldo preventivo
  backupDatabase();

  // 2. Dependencias del servidor
  const okServer = run(NPM, ['install', '--no-audit', '--no-fund'], ROOT, 'Instalando dependencias del servidor');

  // 3. Dependencias del panel
  const okClient = run(NPM, ['--prefix', 'client', 'install', '--no-audit', '--no-fund'], ROOT, 'Instalando dependencias del panel');

  // 4. Compilar el panel
  let okBuild = false;
  if (okServer && okClient) {
    okBuild = run(NPM, ['--prefix', 'client', 'run', 'build'], ROOT, 'Compilando el panel visual');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  if (okServer && okClient && okBuild) {
    console.log('✅ Actualización completada con éxito.');
    console.log('👉 Reinicia Crastur (Crastur.bat o npm start) para aplicar los cambios.');
  } else {
    console.log('⚠️  La actualización no se completó del todo.');
    console.log('   Tu base de datos y tu respaldo preventivo están a salvo.');
    console.log('   Vuelve a ejecutar "npm run actualizar" o abre Instalar.bat para reparar.');
  }
  console.log('────────────────────────────────────────────────────────────\n');
}

if (process.argv[1]?.includes('actualizar')) {
  main().catch((e) => { console.error('Error en la actualización:', e); process.exit(1); });
}

export default main;
