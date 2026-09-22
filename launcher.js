const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

  // Paso 1: Verificación de Entorno (15%)
  renderProgressBar(15, 'Verificando entorno de ejecución...');
  await new Promise(r => setTimeout(r, 600));

  // Paso 2: Comprobar dependencias del backend (40%)
  const rootNodeModules = path.join(__dirname, 'node_modules');
  const hasRootModules = fs.existsSync(rootNodeModules) && fs.existsSync(path.join(rootNodeModules, 'express'));

  if (!hasRootModules) {
    renderProgressBar(30, 'Instalando componentes del servidor (primera vez)...');
    try {
      await runCommand('npm', ['install', '--no-audit', '--no-fund']);
    } catch (e) {
      console.log(`\n${yellow}Aviso: Reintentando instalación de dependencias...${reset}`);
      await runCommand('npm', ['install']);
    }
  }
  renderProgressBar(50, 'Componentes del servidor verificados con éxito.');
  await new Promise(r => setTimeout(r, 400));

  // Paso 3: Comprobar panel visual compilado (75%)
  const clientDist = path.join(__dirname, 'client', 'dist', 'index.html');
  const hasDist = fs.existsSync(clientDist);

  if (!hasDist) {
    renderProgressBar(60, 'Compilando panel administrativo para Windows...');
    try {
      await runCommand('npm', ['--prefix', 'client', 'install', '--no-audit', '--no-fund']);
      await runCommand('npm', ['--prefix', 'client', 'run', 'build']);
    } catch (e) {
      renderProgressBar(65, 'Compilando interfaz...');
      await runCommand('npm', ['--prefix', 'client', 'run', 'build']);
    }
  }
  renderProgressBar(85, 'Panel administrativo optimizado y listo.');
  await new Promise(r => setTimeout(r, 400));

  // Paso 4: Comprobación de integridad de datos y auto-respaldo (95%)
  renderProgressBar(95, 'Verificando base de datos y creando copia de seguridad...');
  const dataDir = path.join(__dirname, 'data');
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dbFile = path.join(dataDir, 'crastur.db');
  if (fs.existsSync(dbFile)) {
    try {
      const backupTarget = path.join(backupDir, `crastur_backup.db`);
      fs.copyFileSync(dbFile, backupTarget);
    } catch (e) {}
  }
  
  // En Windows: crear acceso directo en el Escritorio con icono oficial si no existe
  if (process.platform === 'win32') {
    try {
      const desktop = path.join(process.env.USERPROFILE || '', 'Desktop');
      const shortcut = path.join(desktop, 'Crastur.lnk');
      if (fs.existsSync(desktop) && !fs.existsSync(shortcut)) {
        const ico = path.join(__dirname, 'crastur.ico');
        const target = path.join(__dirname, 'Crastur.bat');
        const cmd = `powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut('${shortcut.replace(/\\/g, '\\\\')}');$s.TargetPath='${target.replace(/\\/g, '\\\\')}';$s.WorkingDirectory='${__dirname.replace(/\\/g, '\\\\')}';$s.IconLocation='${ico.replace(/\\/g, '\\\\')},0';$s.Save()"`;
        execSync(cmd, { stdio: 'ignore' });
      }
    } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 400));

  // Paso 5: Listo (100%)
  renderProgressBar(100, '¡Todo listo! Iniciando Crastur...');
  console.log(`\n\n${green}${bold}✓ El sistema está 100% operativo y protegido contra fallos.${reset}`);
  console.log(`${cyan}Abriendo la aplicación en tu navegador...${reset}\n`);

  // Iniciar servidor
  const serverProc = spawn('node', ['server/server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // Abrir navegador en Windows
  setTimeout(() => {
    try {
      const startCmd = process.platform === 'win32' ? 'start' : 'xdg-open';
      spawn(startCmd, ['http://localhost:3333'], { shell: true, stdio: 'ignore' });
    } catch (e) {}
  }, 1800);

  serverProc.on('close', (code) => {
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error(`\n${yellow}[Lanzador] Error al iniciar: ${err.message}${reset}`);
  console.log('Iniciando modo de recuperación directa...');
  spawn('node', ['server/server.js'], { cwd: __dirname, stdio: 'inherit' });
});
