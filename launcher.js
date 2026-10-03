const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Colores para la consola
const reset = '\x1b[0m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const bold = '\x1b[1m';

const PORT = Number(process.env.PORT) || 3333;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`;

function printHeader() {
  console.clear();
  console.log(`${cyan}╔════════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}║${bold}          CRASTUR - SISTEMA DE VENTAS Y BOT DE WHATSAPP             ${reset}${cyan}║${reset}`);
  console.log(`${cyan}║${reset}                  Iniciador Seguro y Verificado                      ${cyan}║${reset}`);
  console.log(`${cyan}╚════════════════════════════════════════════════════════════════════╝${reset}\n`);
}

function renderProgressBar(percentage, stepDescription) {
  const totalBars = 30;
  const filledBars = Math.round((percentage / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  const bar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  process.stdout.write(`\r ${green}[${bar}]${reset} ${bold}${percentage}%${reset} - ${stepDescription}   `);
}

/** Comprueba si el servidor ya responde correctamente en el puerto. */
function isServerResponding() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, { timeout: 1200 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * [ESPERA REAL Y SEGURA] Aguarda a que el sistema responda de verdad.
 * No usa un límite corto y arbitrario: espera hasta que el servidor esté listo
 * o hasta un máximo de seguridad amplio (por defecto 120 s).
 */
async function waitForServerReady(maxMs = 120000, checkExit = null) {
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < maxMs) {
    if (typeof checkExit === 'function' && checkExit()) return { ready: false, exited: true };
    attempts++;
    if (await isServerResponding()) {
      return { ready: true, exited: false, elapsedMs: Date.now() - start };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { ready: false, exited: false };
}

function openBrowser() {
  const url = `http://localhost:${PORT}`;
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '""', url], { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { stdio: 'ignore' });
    } else {
      spawn('xdg-open', [url], { stdio: 'ignore' });
    }
  } catch (e) {}
}

/** Escapa una cadena como literal de PowerShell (comillas simples duplicadas). */
function psString (value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function ensureDesktopShortcuts() {
  if (process.platform !== 'win32') return;
  try {
    const userProfile = process.env.USERPROFILE || '';
    const candidateDesktops = [
      path.join(userProfile, 'OneDrive', 'Desktop'),
      path.join(userProfile, 'OneDrive', 'Escritorio'),
      path.join(userProfile, 'Desktop'),
      path.join(userProfile, 'Escritorio')
    ];
    const desktop = candidateDesktops.find(d => fs.existsSync(d)) || candidateDesktops[2];
    if (!desktop || !fs.existsSync(desktop)) return;

    const ico = path.join(__dirname, 'crastur.ico');
    const startVbs = path.join(__dirname, 'Crastur_SegundoPlano.vbs');

    const shortcut = path.join(desktop, 'Crastur.lnk');
    if (!fs.existsSync(shortcut) && fs.existsSync(startVbs)) {
      // [WINDOWS-ROBUSTO] Se crea el acceso directo con un script de PowerShell escrito en un
      // archivo temporal (con codificación UTF-8 y comillas simples escapadas), en lugar de
      // una sola línea con triple escape de comillas, que fallaba con rutas que contienen
      // espacios o caracteres especiales (ej. "C:\Users\Juan Pérez\...").
      const psScript = [
        '$ErrorActionPreference = "Stop"',
        '$ws = New-Object -ComObject WScript.Shell',
        `$s = $ws.CreateShortcut(${psString(shortcut)})`,
        `$s.TargetPath = ${psString('wscript.exe')}`,
        `$s.Arguments = ${psString('"' + startVbs + '"')}`,
        `$s.WorkingDirectory = ${psString(__dirname)}`,
        `$s.IconLocation = ${psString(ico + ',0')}`,
        '$s.Description = "Crastur - Sistema de Ventas y Bot de WhatsApp"',
        '$s.Save()'
      ].join('\r\n');
      const psFile = path.join(__dirname, 'data', 'crear_acceso_directo.ps1');
      fs.writeFileSync(psFile, psScript, 'utf8');
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { stdio: 'ignore' });
      try { fs.unlinkSync(psFile); } catch (e) {}
    }

    // Limpiar accesos redundantes anteriores si existieran
    for (const name of ['Apagar Crastur.lnk']) {
      const p = path.join(desktop, name);
      if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (e) {} }
    }
  } catch (e) {}
}

async function main() {
  printHeader();

  // 1) Si el sistema YA está encendido y responde, solo abrir el panel.
  const alreadyRunning = await isServerResponding();
  if (alreadyRunning) {
    ensureDesktopShortcuts();
    console.log(`\n${green}${bold}✓ Crastur ya está encendido y funcionando.${reset}`);
    console.log(`${cyan}Abriendo el panel en tu navegador...${reset}\n`);
    openBrowser();
    return;
  }

  const rootNodeModules = path.join(__dirname, 'node_modules');
  const hasRootModules = fs.existsSync(rootNodeModules) && fs.existsSync(path.join(rootNodeModules, 'express'));
  const clientDist = path.join(__dirname, 'client', 'dist', 'index.html');
  const hasDist = fs.existsSync(clientDist);

  // 2) Verificar instalación completa antes de arrancar (prevención de fallos)
  if (!hasRootModules || !hasDist) {
    console.log(`\n${yellow}${bold}⚠️ El sistema aún no está instalado o le faltan componentes.${reset}`);
    console.log(`${cyan}Abriendo el INSTALADOR VISUAL para dejarlo listo con un clic...${reset}\n`);
    spawn(process.execPath, ['installer/server.js'], { cwd: __dirname, stdio: 'inherit' });
    return;
  }

  // 3) Asegurar carpetas de datos y respaldo preventivo
  const dataDir = path.join(__dirname, 'data');
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const dbFile = path.join(dataDir, 'crastur.db');
  if (fs.existsSync(dbFile)) {
    try { fs.copyFileSync(dbFile, path.join(backupDir, 'crastur_backup.db')); } catch (e) {}
  }

  ensureDesktopShortcuts();

  // 4) Arrancar el servidor (node directo = rápido y confiable)
  renderProgressBar(30, 'Encendiendo el sistema...');
  let serverExitedEarly = false;
  let serverExitCode = null;

  // [WINDOWS-ROBUSTO] Sin `shell:true`: evita que cmd.exe rompa la ruta cuando el usuario
  // o la carpeta contienen espacios (ej. "C:\Users\Juan Pérez\Crastur"). Se invoca node
  // directamente con argumentos ya separados.
  const serverProc = spawn(process.execPath, ['--import', 'tsx', 'server/server.ts'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  serverProc.on('exit', (code) => { serverExitedEarly = true; serverExitCode = code; });
  serverProc.on('error', () => { serverExitedEarly = true; serverExitCode = -1; });

  // 5) Esperar de VERDAD a que esté listo (sin límite corto arbitrario)
  renderProgressBar(70, 'Conectando con la base de datos y servicios...');
  const result = await waitForServerReady(120000, () => serverExitedEarly);

  if (serverExitedEarly) {
    console.log(`\n\n${red}${bold}⚠️ El sistema se detuvo al encender (código: ${serverExitCode}).${reset}`);
    console.log(`${yellow}Los detalles se muestran arriba en pantalla o en data${path.sep}launcher.log si abriste Crastur en segundo plano.${reset}`);
    console.log(`${yellow}También puedes abrir Instalar.bat para reparar el sistema.${reset}\n`);
    process.exit(serverExitCode || 1);
  }

  if (!result.ready) {
    // NO abrir el navegador si no respondió: evita el error de "no se puede conectar"
    console.log(`\n\n${red}${bold}⚠️ El sistema está tardando demasiado en responder.${reset}`);
    console.log(`${yellow}NO se abrió el navegador para no mostrar un error.${reset}`);
    console.log(`${cyan}Espera unos segundos y vuelve a hacer doble clic en Crastur, o pulsa Instalar.bat para reparar.${reset}\n`);
    return;
  }

  // 6) ÉXITO: ahora sí abrir el navegador, con el sistema 100% operativo
  renderProgressBar(100, '¡Todo listo! Abriendo el panel...');
  console.log(`\n\n${green}${bold}✓ El sistema está 100% operativo y en línea.${reset}`);
  console.log(`${cyan}Abriendo la aplicación en tu navegador...${reset}\n`);
  openBrowser();

  serverProc.on('close', (code) => { process.exit(code || 0); });
}

main().catch(err => {
  console.error(`\n${red}[Lanzador] Error al iniciar: ${err.message}${reset}`);
  console.log(`${yellow}Abriendo el reparador visual (Instalar.bat)...${reset}`);
  spawn(process.execPath, ['installer/server.js'], { cwd: __dirname, stdio: 'inherit' });
});
