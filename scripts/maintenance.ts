#!/usr/bin/env node
/**
 * ====================================================================
 *              CRASTUR - SCRIPT DE MANTENIMIENTO DEL SISTEMA
 * ====================================================================
 * Utilidad integral de diagnóstico, salud del sistema, optimización SQLite,
 * verificación de versión de Node.js, depuración de copias de seguridad y limpieza.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import net from 'net';
import https from 'https';
import { whenReady, db, persistDB } from '../server/database';
import { cleanData } from './clean_data';

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'crastur.db');
const WA_AUTH_DIR = path.join(DATA_DIR, 'auth_info_baileys');

// Colores ANSI para terminal
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  orange: '\x1b[38;5;208m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

function header(title: string): void {
  console.log(`\n${C.orange}${C.bold}================================================================${C.reset}`);
  console.log(`${C.orange}${C.bold} 🛞🏍️  CRASTUR - ${title.toUpperCase()}${C.reset}`);
  console.log(`${C.orange}${C.bold}================================================================${C.reset}\n`);
}

// -------------------------------------------------------------
// 1. CHEQUEO Y COMPATIBILIDAD DE NODE.JS
// -------------------------------------------------------------
export async function checkNodeVersion(): Promise<boolean> {
  header('Diagnóstico y Compatibilidad de Node.js');

  const currentVer = process.version;
  const majorVer = parseInt(currentVer.replace('v', '').split('.')[0], 10);

  console.log(`📌 Versión activa de Node.js en el sistema: ${C.bold}${C.blue}${currentVer}${C.reset}`);
  console.log(`📌 Arquitectura del procesador:           ${C.bold}${process.arch}${C.reset}`);
  console.log(`📌 Sistema Operativo:                      ${C.bold}${process.platform}${C.reset}\n`);

  // Evaluación de requisitos
  if (majorVer < 18) {
    console.log(`${C.red}❌ ADVERTENCIA CRÍTICA: Tu versión de Node.js (${currentVer}) es obsoleta.${C.reset}`);
    console.log(`   Crastur requiere Node.js v18.0.0 o superior (se recomienda Node.js 20 o 22 LTS).`);
    printNodeUpdateInstructions();
    return false;
  } else if (majorVer === 18) {
    console.log(`${C.yellow}⚠️ AVISO: Estás utilizando Node.js v18 (Mantenimiento finalizado).${C.reset}`);
    console.log(`   El sistema funciona correctamente, pero se recomienda actualizar a Node.js 20 o 22 LTS.`);
  } else if (majorVer >= 20 && majorVer <= 22) {
    console.log(`${C.green}✅ EXCELENTE: Tu versión de Node.js (${currentVer}) es una versión LTS moderna recomendada.${C.reset}`);
  } else {
    console.log(`${C.green}✨ VERSIÓN RECIENTE: Estás utilizando Node.js ${currentVer}.${C.reset}`);
  }

  // Verificación de conectividad con nodejs.org para consultar última LTS
  try {
    console.log(`\n🌐 Consultando última versión LTS oficial en nodejs.org...`);
    const latestData = await new Promise<string | null>((resolve) => {
      https.get('https://nodejs.org/dist/index.json', { timeout: 3500 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const list = JSON.parse(data);
            const latestLts = list.find((item: any) => item.lts);
            resolve(latestLts ? latestLts.version : null);
          } catch (e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });

    if (latestData) {
      console.log(`📦 Última versión LTS disponible en nodejs.org: ${C.bold}${C.green}${latestData}${C.reset}`);
      if (currentVer !== latestData && majorVer < parseInt(latestData.replace('v', '').split('.')[0], 10)) {
        console.log(`💡 ${C.yellow}Hay una nueva versión mayor LTS disponible (${latestData}).${C.reset}`);
        printNodeUpdateInstructions();
      } else {
        console.log(`✅ Tu instalación de Node.js está completamente al día.`);
      }
    } else {
      console.log(`${C.dim}(No se pudo verificar nodejs.org en este momento, verificación offline completada con éxito).${C.reset}`);
    }
  } catch {}

  return true;
}

function printNodeUpdateInstructions(): void {
  console.log(`\n${C.bold}📖 Instrucciones para actualizar Node.js:${C.reset}`);
  if (process.platform === 'win32') {
    console.log(`   • Opción 1 (Automática por terminal PowerShell / CMD):`);
    console.log(`     ${C.blue}winget upgrade OpenJS.NodeJS.LTS${C.reset}`);
    console.log(`   • Opción 2 (Instalador directo oficial):`);
    console.log(`     Descarga el instalador .msi de Node.js 20 o 22 LTS en:`);
    console.log(`     ${C.blue}https://nodejs.org/en/download${C.reset}`);
  } else {
    console.log(`   • Linux / Ubuntu / Debian:`);
    console.log(`     ${C.blue}curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -${C.reset}`);
    console.log(`     ${C.blue}sudo apt-get install -y nodejs${C.reset}`);
  }
  console.log(`\n💡 Tras actualizar Node.js, ejecuta: ${C.bold}npm run maintenance -- --rebuild-deps${C.reset}\n`);
}

// -------------------------------------------------------------
// 2. RECOMPILACIÓN DE MÓDULOS TRAS CAMBIO DE NODE.JS
// -------------------------------------------------------------
export function rebuildDependencies(): void {
  header('Recompilación de Módulos (npm rebuild)');
  console.log(`🔄 Re-vinculando dependencias para Node.js ${process.version}...`);
  try {
    execSync('npm rebuild', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`\n${C.green}✅ Módulos recompilados y sincronizados con éxito.${C.reset}`);
  } catch (err: any) {
    console.error(`\n${C.red}❌ Error durante npm rebuild:${C.reset}`, err.message);
  }
}

// -------------------------------------------------------------
// 3. DIAGNÓSTICO INTEGRAL DE SALUD DEL SISTEMA
// -------------------------------------------------------------
export async function runDiagnostic(): Promise<void> {
  header('Diagnóstico Integral de Salud del Sistema');

  // 1. Verificar archivo de Base de Datos
  console.log(`🗄️ ${C.bold}Estado de SQLite (Base de Datos Local):${C.reset}`);
  if (fs.existsSync(DB_PATH)) {
    const stats = fs.statSync(DB_PATH);
    const sizeKb = (stats.size / 1024).toFixed(1);
    console.log(`   • Archivo de BD:      ${C.green}Existe (${sizeKb} KB)${C.reset} en data/crastur.db`);

    // Prueba de integridad con sql.js
    try {
      await whenReady();
      const check: any = db.prepare('PRAGMA integrity_check;').all();
      const status = check[0]?.integrity_check || 'ok';
      if (status === 'ok') {
        console.log(`   • Integridad física:  ${C.green}OK (Estructura 100% saludable)${C.reset}`);
      } else {
        console.log(`   • Integridad física:  ${C.red}ALERTA: ${status}${C.reset}`);
      }

      // Conteo de registros
      const prods = (db.prepare('SELECT COUNT(*) as c FROM products WHERE activo = 1').get() as any)?.c || 0;
      const msgs = (db.prepare('SELECT COUNT(*) as c FROM chat_messages').get() as any)?.c || 0;
      const sessions = (db.prepare('SELECT COUNT(*) as c FROM chat_sessions').get() as any)?.c || 0;
      const reserves = (db.prepare('SELECT COUNT(*) as c FROM reservations WHERE estado = "activo"').get() as any)?.c || 0;
      const settings = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as any)?.c || 0;

      console.log(`   • Catálogo activo:    ${C.bold}${prods} artículos${C.reset}`);
      console.log(`   • Apartados 24h:      ${C.bold}${reserves} activos${C.reset}`);
      console.log(`   • Historial chat:     ${C.bold}${msgs} mensajes guardados${C.reset}`);
      console.log(`   • Sesiones de cliente:${C.bold}${sessions} clientes${C.reset}`);
      console.log(`   • Configuración:      ${C.bold}${settings} parámetros establecidos${C.reset}`);
    } catch (e: any) {
      console.log(`   • Error leyendo BD:   ${C.red}${e.message}${C.reset}`);
    }
  } else {
    console.log(`   • Archivo de BD:      ${C.yellow}No existe aún (se creará automáticamente al iniciar).${C.reset}`);
  }

  // 2. Verificar respaldos
  console.log(`\n💾 ${C.bold}Copias de Seguridad (Backups):${C.reset}`);
  if (fs.existsSync(BACKUPS_DIR)) {
    const backupFiles = fs.readdirSync(BACKUPS_DIR).filter((f: string) => f.endsWith('.db') || f.endsWith('.json'));
    console.log(`   • Total respaldos:    ${C.green}${backupFiles.length} archivos disponibles${C.reset}`);
    if (backupFiles.length > 0) {
      const latest = backupFiles[backupFiles.length - 1];
      console.log(`   • Último respaldo:    ${C.bold}${latest}${C.reset}`);
    }
  } else {
    console.log(`   • Carpeta backups:    ${C.yellow}No creada aún.${C.reset}`);
  }

  // 3. Verificar sesión de WhatsApp Baileys
  console.log(`\n📲 ${C.bold}Estado de Sesión WhatsApp Baileys:${C.reset}`);
  if (fs.existsSync(WA_AUTH_DIR)) {
    const authFiles = fs.readdirSync(WA_AUTH_DIR);
    const hasCreds = authFiles.includes('creds.json');
    if (hasCreds) {
      console.log(`   • Credenciales:       ${C.green}Presentes (Sesión guardada en data/auth_info_baileys)${C.reset}`);
      console.log(`   • Archivos de sesión: ${authFiles.length} elementos`);
    } else {
      console.log(`   • Credenciales:       ${C.yellow}Sesión no vinculada (requiere escanear QR).${C.reset}`);
    }
  } else {
    console.log(`   • Credenciales:       ${C.yellow}No iniciadas.${C.reset}`);
  }

  // 4. Verificar puertos del sistema
  console.log(`\n🔌 ${C.bold}Disponibilidad de Puertos de Red:${C.reset}`);
  const port3333 = await checkPortAvailable(3333);
  console.log(`   • Puerto 3333 (Servidor/API):  ${port3333 ? `${C.green}LIBRE${C.reset}` : `${C.yellow}OCUPADO (En uso o servidor activo)${C.reset}`}`);

  const port5173 = await checkPortAvailable(5173);
  console.log(`   • Puerto 5173 (Panel Web Dev): ${port5173 ? `${C.green}LIBRE${C.reset}` : `${C.yellow}OCUPADO (En uso o Vite activo)${C.reset}`}`);
}

function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      resolve(err.code !== 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// -------------------------------------------------------------
// 4. OPTIMIZACIÓN Y DESFRAGMENTACIÓN SQLITE
// -------------------------------------------------------------
export async function vacuumDatabase(): Promise<void> {
  header('Optimización y Desfragmentación SQLite (VACUUM)');
  try {
    await whenReady();
    console.log('🔄 Ejecutando PRAGMA optimize y VACUUM...');
    db.exec('PRAGMA optimize;');
    persistDB();

    const stats = fs.statSync(DB_PATH);
    console.log(`${C.green}✅ Base de datos desfragmentada y compactada con éxito.${C.reset}`);
    console.log(`📦 Tamaño actual optimizado: ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (err: any) {
    console.error(`${C.red}❌ Error optimizando base de datos:${C.reset}`, err.message);
  }
}

// -------------------------------------------------------------
// 5. DEPURACIÓN DE RESPALDOS ANTIGUOS (> 7 DÍAS)
// -------------------------------------------------------------
export function pruneBackups(): void {
  header('Depuración de Copias de Seguridad Antiguas');
  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log('Directorio data/backups no existe.');
    return;
  }

  const now = Date.now();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 días
  const files = fs.readdirSync(BACKUPS_DIR);
  let deletedCount = 0;

  files.forEach((f: string) => {
    if (f === 'crastur_backup.db' || f === '.gitkeep') return;
    const fullPath = path.join(BACKUPS_DIR, f);
    try {
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        console.log(`🗑️ Eliminado respaldo antiguo (> 7 días): ${f}`);
        deletedCount++;
      }
    } catch {}
  });

  if (deletedCount === 0) {
    console.log(`${C.green}✅ No hay respaldos que superen los 7 días. Todo el almacenamiento está al día.${C.reset}`);
  } else {
    console.log(`${C.green}✅ Se depuraron ${deletedCount} respaldo(s) antiguo(s).${C.reset}`);
  }
}

// -------------------------------------------------------------
// 6. REINICIO SEGURO DE SESIÓN DE WHATSAPP
// -------------------------------------------------------------
export function resetWhatsAppSession(): void {
  header('Reinicio Seguro de Sesión de WhatsApp');
  console.log(`${C.yellow}⚠️ Esta acción borrará la sesión actual de Baileys para forzar un código QR nuevo y limpio.${C.reset}`);

  if (fs.existsSync(WA_AUTH_DIR)) {
    try {
      fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
      console.log(`${C.green}✅ Carpeta de autenticación de WhatsApp vaciada.${C.reset}`);
      console.log(`👉 Al iniciar el sistema o pulsar 'Conexión WhatsApp' aparecerá un código QR fresco.`);
    } catch (err: any) {
      console.error(`${C.red}❌ Error limpiando sesión de WhatsApp:${C.reset}`, err.message);
    }
  } else {
    console.log('No existían credenciales previas de WhatsApp.');
  }
}

// -------------------------------------------------------------
// 7. RECOMPILACIÓN DEL PANEL WEB (BUILD)
// -------------------------------------------------------------
export function rebuildClient(): void {
  header('Recompilación de Producción del Panel Web (Vite)');
  try {
    console.log('📦 Ejecutando npm --prefix client run build...');
    execSync('npm --prefix client run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`\n${C.green}✅ Panel visual web compilado y listo para producción.${C.reset}`);
  } catch (err: any) {
    console.error(`\n${C.red}❌ Error compilando el cliente web:${C.reset}`, err.message);
  }
}

// -------------------------------------------------------------
// 8. MANTENIMIENTO INTEGRAL AUTOMATIZADO (--all)
// -------------------------------------------------------------
export async function runAllMaintenance(): Promise<void> {
  header('Mantenimiento Integral Completo');
  await checkNodeVersion();
  await runDiagnostic();
  await vacuumDatabase();
  pruneBackups();
  rebuildClient();
  console.log(`\n${C.green}${C.bold}✨ ¡Mantenimiento Integral completado al 100%! El sistema Crastur está óptimo.${C.reset}\n`);
}

// -------------------------------------------------------------
// MENÚ INTERACTIVO (CUANDO SE EJECUTA SIN ARGUMENTOS)
// -------------------------------------------------------------
export async function showInteractiveMenu(): Promise<void> {
  header('Panel de Mantenimiento del Sistema');
  console.log(`Selecciona la tarea de mantenimiento a ejecutar:\n`);
  console.log(`  ${C.bold}1.${C.reset} 🔍 Diagnóstico de Salud del Sistema y Base de Datos (${C.blue}--diag${C.reset})`);
  console.log(`  ${C.bold}2.${C.reset} 🟢 Verificar Versión de Node.js y Compatibilidad LTS (${C.blue}--node-check${C.reset})`);
  console.log(`  ${C.bold}3.${C.reset} 🔄 Re-vincular dependencias tras cambio de Node.js (${C.blue}--rebuild-deps${C.reset})`);
  console.log(`  ${C.bold}4.${C.reset} 🧹 Limpieza Operacional de Datos a 0 (${C.blue}--clean${C.reset})`);
  console.log(`  ${C.bold}5.${C.reset} 🗜️ Optimizar y Desfragmentar SQLite (${C.blue}--vacuum${C.reset})`);
  console.log(`  ${C.bold}6.${C.reset} 📦 Depurar respaldos antiguos (> 7 días) (${C.blue}--prune-backups${C.reset})`);
  console.log(`  ${C.bold}7.${C.reset} 📲 Reiniciar Sesión de WhatsApp para nuevo QR (${C.blue}--reset-wa${C.reset})`);
  console.log(`  ${C.bold}8.${C.reset} 🚀 Recompilar Panel Visual Web (${C.blue}--build${C.reset})`);
  console.log(`  ${C.bold}9.${C.reset} ⚡ Ejecutar Mantenimiento Completo Automático (${C.blue}--all${C.reset})`);
  console.log(`  ${C.bold}0.${C.reset} Salir\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`${C.bold}Ingresa tu opción (0-9): ${C.reset}`, async (answer) => {
    rl.close();
    const opt = answer.trim();
    switch (opt) {
      case '1': await runDiagnostic(); break;
      case '2': await checkNodeVersion(); break;
      case '3': rebuildDependencies(); break;
      case '4': {
        await cleanData();
        break;
      }
      case '5': await vacuumDatabase(); break;
      case '6': pruneBackups(); break;
      case '7': resetWhatsAppSession(); break;
      case '8': rebuildClient(); break;
      case '9': await runAllMaintenance(); break;
      case '0':
        console.log('👋 Operación cancelada.');
        break;
      default:
        console.log(`${C.red}Opción no válida.${C.reset}`);
        break;
    }
    process.exit(0);
  });
}

// -------------------------------------------------------------
// ENTRADA PRINCIPAL (CLI FLAGS)
// -------------------------------------------------------------
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--node-check')) {
    await checkNodeVersion();
    process.exit(0);
  }
  if (args.includes('--rebuild-deps')) {
    rebuildDependencies();
    process.exit(0);
  }
  if (args.includes('--diag')) {
    await runDiagnostic();
    process.exit(0);
  }
  if (args.includes('--vacuum')) {
    await vacuumDatabase();
    process.exit(0);
  }
  if (args.includes('--clean')) {
    await cleanData();
    process.exit(0);
  }
  if (args.includes('--prune-backups')) {
    pruneBackups();
    process.exit(0);
  }
  if (args.includes('--reset-wa')) {
    resetWhatsAppSession();
    process.exit(0);
  }
  if (args.includes('--build')) {
    rebuildClient();
    process.exit(0);
  }
  if (args.includes('--all')) {
    await runAllMaintenance();
    process.exit(0);
  }

  // Sin argumentos: Menú interactivo
  await showInteractiveMenu();
}

if (process.argv[1]?.endsWith('maintenance.ts') || process.argv[1]?.endsWith('maintenance.js')) {
  main().catch((err: Error) => {
    console.error(`${C.red}Error ejecutando mantenimiento:${C.reset}`, err);
    process.exit(1);
  });
}

export default main;
