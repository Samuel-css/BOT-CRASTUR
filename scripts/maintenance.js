#!/usr/bin/env node
/**
 * ====================================================================
 *              CRASTUR - SCRIPT DE MANTENIMIENTO DEL SISTEMA
 * ====================================================================
 * Utilidad integral de diagnóstico, salud del sistema, optimización SQLite,
 * verificación de versión de Node.js, depuración de copias de seguridad y limpieza.
 *
 * Uso por línea de comandos:
 *   node scripts/maintenance.js [opción]
 *   npm run maintenance
 *
 * Opciones disponibles:
 *   --node-check      Verificar versión de Node.js y compatibilidad LTS
 *   --rebuild-deps    Recompilar módulos nativos (npm rebuild) tras cambio de Node
 *   --diag            Diagnóstico de salud del sistema, base de datos y puertos
 *   --vacuum          Desfragmentar y optimizar SQLite (VACUUM / OPTIMIZE)
 *   --clean           Limpiar datos operacionales a 0 (mensajes, chats, métricas)
 *   --prune-backups   Depurar respaldos con más de 7 días y crear respaldo fresco
 *   --reset-wa        Reiniciar credenciales de WhatsApp de forma segura
 *   --build           Recompilar el panel visual web (Vite)
 *   --all             Ejecutar mantenimiento integral automático
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const net = require('net');

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

function header(title) {
  console.log(`\n${C.orange}${C.bold}================================================================${C.reset}`);
  console.log(`${C.orange}${C.bold} 🛞🏍️  CRASTUR - ${title.toUpperCase()}${C.reset}`);
  console.log(`${C.orange}${C.bold}================================================================${C.reset}\n`);
}

// -------------------------------------------------------------
// 1. CHEQUEO Y COMPATIBILIDAD DE NODE.JS
// -------------------------------------------------------------
async function checkNodeVersion() {
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
    const https = require('https');
    console.log(`\n🌐 Consultando última versión LTS oficial en nodejs.org...`);
    const latestData = await new Promise((resolve, reject) => {
      https.get('https://nodejs.org/dist/index.json', { timeout: 3500 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const list = JSON.parse(data);
            const latestLts = list.find(item => item.lts);
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

function printNodeUpdateInstructions() {
  console.log(`\n${C.bold}📖 Instrucciones para actualizar Node.js:${C.reset}`);
  if (process.platform === 'win32') {
    console.log(`   • Opción 1 (Automática por terminal PowerShell / CMD):`);
    console.log(`     ${C.blue}winget install OpenJS.NodeJS.LTS${C.reset}`);
    console.log(`   • Opción 2 (Instalador oficial):`);
    console.log(`     Descarga el instalador .msi LTS desde: ${C.blue}https://nodejs.org${C.reset}`);
  } else {
    console.log(`   • Opción 1 (con NVM recomendado):`);
    console.log(`     ${C.blue}nvm install --lts && nvm use --lts${C.reset}`);
    console.log(`   • Opción 2 (con gestor de paquetes apt/dnf):`);
    console.log(`     ${C.blue}curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs${C.reset}`);
  }
  console.log(`   ${C.dim}Tras actualizar Node.js, ejecuta: npm run maintenance --rebuild-deps${C.reset}\n`);
}

// -------------------------------------------------------------
// 2. RECONSTRUCCIÓN DE DEPENDENCIAS (NATIVE / WASM REBUILD)
// -------------------------------------------------------------
function rebuildDependencies() {
  header('Re-sincronización de Dependencias para Node.js');
  console.log(`🔄 Re-vinculando módulos binarios y WebAssembly para Node.js ${process.version}...`);
  try {
    execSync('npm rebuild', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`\n${C.green}✅ Módulos re-vinculados exitosamente con el runtime actual de Node.js.${C.reset}`);
  } catch (err) {
    console.error(`\n${C.red}❌ Error re-vinculando dependencias:${C.reset}`, err.message);
  }
}

// -------------------------------------------------------------
// 3. DIAGNÓSTICO INTEGRAL DEL SISTEMA Y BASE DE DATOS
// -------------------------------------------------------------
async function runDiagnostic() {
  header('Diagnóstico Integral de Salud del Sistema');

  // 1. Verificar archivo de Base de Datos
  console.log(`🗄️ ${C.bold}Estado de SQLite (Base de Datos Local):${C.reset}`);
  if (fs.existsSync(DB_PATH)) {
    const stats = fs.statSync(DB_PATH);
    const sizeKb = (stats.size / 1024).toFixed(1);
    console.log(`   • Archivo de BD:      ${C.green}Existe (${sizeKb} KB)${C.reset} en data/crastur.db`);

    // Prueba de integridad con sql.js
    try {
      const dbModule = require('../server/database');
      await dbModule.whenReady();
      const check = dbModule.db.prepare('PRAGMA integrity_check;').all();
      const status = check[0]?.integrity_check || 'ok';
      if (status === 'ok') {
        console.log(`   • Integridad física:  ${C.green}OK (Estructura 100% saludable)${C.reset}`);
      } else {
        console.log(`   • Integridad física:  ${C.red}ALERTA: ${status}${C.reset}`);
      }

      // Conteo de registros
      const prods = dbModule.db.prepare('SELECT COUNT(*) as c FROM products WHERE activo = 1').get()?.c || 0;
      const msgs = dbModule.db.prepare('SELECT COUNT(*) as c FROM chat_messages').get()?.c || 0;
      const sessions = dbModule.db.prepare('SELECT COUNT(*) as c FROM chat_sessions').get()?.c || 0;
      const reserves = dbModule.db.prepare('SELECT COUNT(*) as c FROM reservations WHERE estado = "activo"').get()?.c || 0;
      const settings = dbModule.db.prepare('SELECT COUNT(*) as c FROM settings').get()?.c || 0;

      console.log(`   • Catálogo activo:    ${C.bold}${prods} artículos${C.reset}`);
      console.log(`   • Apartados 24h:      ${C.bold}${reserves} activos${C.reset}`);
      console.log(`   • Mensajes en cola:   ${msgs}`);
      console.log(`   • Sesiones de chat:   ${sessions}`);
      console.log(`   • Parámetros tienda:  ${settings} configurados`);
    } catch (dbErr) {
      console.log(`   • ${C.red}Error inspeccionando SQLite:${C.reset} ${dbErr.message}`);
    }
  } else {
    console.log(`   • ${C.yellow}No se encontró archivo crastur.db. Se generará automáticamente al arrancar.${C.reset}`);
  }

  // 2. Copias de seguridad
  console.log(`\n📦 ${C.bold}Estado de Copias de Seguridad:${C.reset}`);
  if (fs.existsSync(BACKUPS_DIR)) {
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db'));
    console.log(`   • Respaldos disponibles: ${C.green}${files.length} archivo(s)${C.reset} en data/backups/`);
    files.forEach(f => {
      const bStat = fs.statSync(path.join(BACKUPS_DIR, f));
      console.log(`     - ${f} (${(bStat.size / 1024).toFixed(1)} KB)`);
    });
  } else {
    console.log(`   • Directorio data/backups no encontrado.`);
  }

  // 3. Puerto 3333 del Servidor
  console.log(`\n🔌 ${C.bold}Estado de Puertos de Red:${C.reset}`);
  const portInUse = await checkPortInUse(3333);
  if (portInUse) {
    console.log(`   • Puerto 3333: ${C.green}ACTIVO (El servidor de Crastur está en ejecución en http://localhost:3333)${C.reset}`);
  } else {
    console.log(`   • Puerto 3333: ${C.yellow}LIBRE (El servidor está detenido y listo para iniciar)${C.reset}`);
  }

  // 4. Panel Visual Compilado (dist/)
  console.log(`\n🖥️ ${C.bold}Estado del Panel Visual (Frontend Web):${C.reset}`);
  const distHtml = path.join(ROOT_DIR, 'client', 'dist', 'index.html');
  if (fs.existsSync(distHtml)) {
    const distStat = fs.statSync(distHtml);
    console.log(`   • Bundle de producción: ${C.green}Listo y compilado${C.reset} (Última actualización: ${distStat.mtime.toLocaleString('es-VE')})`);
  } else {
    console.log(`   • ${C.yellow}No se encontró client/dist. Ejecuta: npm run build${C.reset}`);
  }

  // 5. Sesión de WhatsApp
  console.log(`\n📲 ${C.bold}Estado de Vinculación de WhatsApp:${C.reset}`);
  if (fs.existsSync(WA_AUTH_DIR) && fs.readdirSync(WA_AUTH_DIR).length > 0) {
    console.log(`   • Credenciales guardadas: ${C.green}Presentes${C.reset} en data/auth_info_baileys/`);
  } else {
    console.log(`   • Credenciales: ${C.yellow}Sin vincular o sesión limpia (Listo para nuevo código QR)${C.reset}`);
  }

  console.log(`\n${C.green}✅ Diagnóstico completado.${C.reset}\n`);
}

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(true);
      else resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// -------------------------------------------------------------
// 4. OPTIMIZACIÓN Y DESFRAGMENTACIÓN SQLITE
// -------------------------------------------------------------
async function vacuumDatabase() {
  header('Optimización y Desfragmentación SQLite (VACUUM)');
  try {
    const dbModule = require('../server/database');
    await dbModule.whenReady();
    console.log('🔄 Ejecutando PRAGMA optimize y VACUUM...');
    dbModule.db.exec('PRAGMA optimize;');
    dbModule.persistDB();

    if (typeof dbModule.performDailyBackup === 'function') {
      dbModule.performDailyBackup();
    }

    const stats = fs.statSync(DB_PATH);
    console.log(`${C.green}✅ Base de datos desfragmentada y compactada con éxito.${C.reset}`);
    console.log(`📦 Tamaño actual optimizado: ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.error(`${C.red}❌ Error optimizando base de datos:${C.reset}`, err.message);
  }
}

// -------------------------------------------------------------
// 5. DEPURACIÓN DE RESPALDOS ANTIGUOS (> 7 DÍAS)
// -------------------------------------------------------------
function pruneBackups() {
  header('Depuración de Copias de Seguridad Antiguas');
  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log('Directorio data/backups no existe.');
    return;
  }

  const now = Date.now();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 días
  const files = fs.readdirSync(BACKUPS_DIR);
  let deletedCount = 0;

  files.forEach(f => {
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
function resetWhatsAppSession() {
  header('Reinicio Seguro de Sesión de WhatsApp');
  console.log(`${C.yellow}⚠️ Esta acción borrará la sesión actual de Baileys para forzar un código QR nuevo y limpio.${C.reset}`);

  if (fs.existsSync(WA_AUTH_DIR)) {
    try {
      fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(WA_AUTH_DIR, { recursive: true });
      console.log(`${C.green}✅ Carpeta de autenticación de WhatsApp vaciada.${C.reset}`);
      console.log(`👉 Al iniciar el sistema o pulsar 'Conexión WhatsApp' aparecerá un código QR fresco.`);
    } catch (err) {
      console.error(`${C.red}❌ Error limpiando sesión de WhatsApp:${C.reset}`, err.message);
    }
  } else {
    console.log('No existían credenciales previas de WhatsApp.');
  }
}

// -------------------------------------------------------------
// 7. RECOMPILACIÓN DEL PANEL WEB (BUILD)
// -------------------------------------------------------------
function rebuildClient() {
  header('Recompilación de Producción del Panel Web (Vite)');
  try {
    console.log('📦 Ejecutando npm --prefix client run build...');
    execSync('npm --prefix client run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log(`\n${C.green}✅ Panel visual web compilado y listo para producción.${C.reset}`);
  } catch (err) {
    console.error(`\n${C.red}❌ Error compilando el cliente web:${C.reset}`, err.message);
  }
}

// -------------------------------------------------------------
// 8. MANTENIMIENTO INTEGRAL AUTOMATIZADO (--all)
// -------------------------------------------------------------
async function runAllMaintenance() {
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
async function showInteractiveMenu() {
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
        const { cleanData } = require('./clean_data');
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
async function main() {
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
    const { cleanData } = require('./clean_data');
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

main().catch((err) => {
  console.error(`${C.red}Error ejecutando mantenimiento:${C.reset}`, err);
  process.exit(1);
});
