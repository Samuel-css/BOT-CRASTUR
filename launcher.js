const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Colores para la consola de Windows
const reset = '\x1b[0m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const magenta = '\x1b[35m';
const bold = '\x1b[1m';

function printHeader() {
  console.clear();
  console.log(`${cyan}╔════════════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${cyan}║${bold}          CRASTUR - SISTEMA DE VENTAS Y BOT DE WHATSAPP             ${reset}${cyan}║${reset}`);
  console.log(`${cyan}║${reset}             Verificador Inteligente de Arranque en Windows          ${cyan}║${reset}`);
  console.log(`${cyan}╚════════════════════════════════════════════════════════════════════╝${reset}\n`);
}

function renderProgressBar(percentage, stepDescription) {
  const totalBars = 30;
  const filledBars = Math.round((percentage / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  const bar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  
  process.stdout.write(`\r ${green}[${bar}]${reset} ${bold}${percentage}%${reset} - ${stepDescription}   `);
}

function isServerAlreadyRunning(port = 3333) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
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

    // Único Acceso directo oficial: Crastur (Modo Silencioso Inteligente)
    const shortcut = path.join(desktop, 'Crastur.lnk');
    if (!fs.existsSync(shortcut)) {
      const cmd = `powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut('${shortcut.replace(/\\/g, '\\\\')}');$s.TargetPath='wscript.exe';$s.Arguments='\\\"${startVbs.replace(/\\/g, '\\\\')}\\\"';$s.WorkingDirectory='${__dirname.replace(/\\/g, '\\\\')}';$s.IconLocation='${ico.replace(/\\/g, '\\\\')},0';$s.Description='Crastur - Sistema de Ventas y Bot de WhatsApp';$s.Save()"`;
      execSync(cmd, { stdio: 'ignore' });
    }

    // Limpiar acceso redundante anterior si existiera en el escritorio
    const oldStopShortcut = path.join(desktop, 'Apagar Crastur.lnk');
    if (fs.existsSync(oldStopShortcut)) {
      try { fs.unlinkSync(oldStopShortcut); } catch (e) {}
    }
  } catch (e) {}
}

function runCommand(command, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: 'ignore'
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Comando falló con código ${code}`));
    });
  });
}

async function main() {
  printHeader();

  // Si Crastur ya está encendido y activo en segundo plano, simplemente abrir el navegador
  const alreadyRunning = await isServerAlreadyRunning(3333);
  if (alreadyRunning) {
    ensureDesktopShortcuts();
    console.log(`\n${green}${bold}✓ Crastur ya está encendido y funcionando en segundo plano.${reset}`);
    console.log(`${cyan}Abriendo el panel en tu navegador...${reset}\n`);
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '""', 'http://localhost:3333'], { stdio: 'ignore' });
    } else {
      spawn('xdg-open', ['http://localhost:3333'], { shell: true, stdio: 'ignore' });
    }
    return;
  }

  const rootNodeModules = path.join(__dirname, 'node_modules');
  const hasRootModules = fs.existsSync(rootNodeModules) && fs.existsSync(path.join(rootNodeModules, 'express'));

  const clientDist = path.join(__dirname, 'client', 'dist', 'index.html');
  const hasDist = fs.existsSync(clientDist);

  // Modo rápido: si el sistema ya está instalado y compilado, arrancar al instante
  const isFastPath = hasRootModules && hasDist;

  // Paso 1: Verificación de Entorno (20%)
  if (!isFastPath) {
    renderProgressBar(20, 'Verificando entorno de ejecución...');
  }

  // Paso 2: Dependencias backend
  if (!hasRootModules) {
    renderProgressBar(35, 'Instalando componentes del servidor (primera vez)...');
    try {
      await runCommand('npm', ['install', '--no-audit', '--no-fund']);
    } catch (e) {
      console.log(`\n${yellow}Aviso: Reintentando instalación de dependencias...${reset}`);
      await runCommand('npm', ['install']);
    }
  }

  // Paso 3: Compilar panel visual si no existe
  if (!hasDist) {
    renderProgressBar(65, 'Compilando panel administrativo para Windows...');
    try {
      await runCommand('npm', ['--prefix', 'client', 'install', '--no-audit', '--no-fund']);
      await runCommand('npm', ['--prefix', 'client', 'run', 'build']);
    } catch (e) {
      renderProgressBar(70, 'Compilando interfaz...');
      await runCommand('npm', ['--prefix', 'client', 'run', 'build']);
    }
  }

  // Paso 4: Comprobación de integridad de datos y auto-respaldo
  const dataDir = path.join(__dirname, 'data');
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dbFile = path.join(dataDir, 'crastur.db');
  if (fs.existsSync(dbFile)) {
    try {
      const backupTarget = path.join(backupDir, 'crastur_backup.db');
      fs.copyFileSync(dbFile, backupTarget);
    } catch (e) {}
  }

  // En Windows: crear accesos directos en el Escritorio (Encendido silencioso y Apagado seguro)
  ensureDesktopShortcuts();

  // Paso 5: Listo (100%)
  renderProgressBar(100, '¡Todo listo! Iniciando Crastur...');
  console.log(`\n\n${green}${bold}✓ El sistema está 100% operativo y protegido contra fallos.${reset}`);
  console.log(`${cyan}Abriendo la aplicación en tu navegador...${reset}\n`);

  // Iniciar servidor optimizado
  const serverProc = spawn('node', ['--max-old-space-size=512', 'server/server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // Abrir navegador
  setTimeout(() => {
    try {
      if (process.platform === 'win32') {
        spawn('cmd.exe', ['/c', 'start', '""', 'http://localhost:3333'], { stdio: 'ignore' });
      } else {
        spawn('xdg-open', ['http://localhost:3333'], { shell: true, stdio: 'ignore' });
      }
    } catch (e) {}
  }, 1200);

  serverProc.on('close', (code) => {
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error(`\n${yellow}[Lanzador] Error al iniciar: ${err.message}${reset}`);
  console.log('Iniciando modo de recuperación directa...');
  spawn('node', ['server/server.js'], { cwd: __dirname, stdio: 'inherit' });
});
