#!/usr/bin/env node
/**
 * ============================================================================
 *  CRASTUR - INSTALADOR Y PANEL DE MANTENIMIENTO VISUAL (SIN CONSOLA)
 * ============================================================================
 * Servidor local sin dependencias externas que ofrece una interfaz web amigable
 * para: instalar/verificar el sistema, actualizar el panel, crear y restaurar
 * respaldos, y arrancar Crastur. Todo con botones, sin escribir comandos.
 *
 * Uso: node installer/server.js   (o doble clic en Instalar.bat)
 * Abre automáticamente http://localhost:4545
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execFile, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.INSTALLER_PORT) || 4545;
const isWin = process.platform === 'win32';

/** [REQUISITO DE NODE] Baileys 7 + Vite 8: Node 20.19+ o 22.12+. */
function isNodeCompatible() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);
}

/** Escapa una cadena como literal de PowerShell (comillas simples duplicadas). */
function psString(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

/** Ruta del acceso directo de inicio automático de Windows. */
function startupShortcutPath() {
  const appData = process.env.APPDATA || '';
  if (!appData) return '';
  return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Crastur.lnk');
}

function hasAutoStart() {
  if (!isWin) return false;
  const p = startupShortcutPath();
  return !!p && fs.existsSync(p);
}

/**
 * Crea/actualiza un acceso directo de Windows que ejecuta el iniciador silencioso.
 * Se usa para el inicio automático al encender la PC.
 */
function createWindowsShortcut(shortcutPath) {
  if (!isWin || !shortcutPath) throw new Error('El inicio automático solo está disponible en Windows.');
  const vbs = path.join(ROOT, 'Crastur_SegundoPlano.vbs');
  const ico = path.join(ROOT, 'crastur.ico');
  if (!fs.existsSync(vbs)) throw new Error('No se encontró Crastur_SegundoPlano.vbs.');

  const shortcutDir = path.dirname(shortcutPath);
  if (!fs.existsSync(shortcutDir)) fs.mkdirSync(shortcutDir, { recursive: true });

  const psScript = [
    '$ErrorActionPreference = "Stop"',
    '$ws = New-Object -ComObject WScript.Shell',
    `$s = $ws.CreateShortcut(${psString(shortcutPath)})`,
    `$s.TargetPath = ${psString('wscript.exe')}`,
    `$s.Arguments = ${psString('"' + vbs + '"')}`,
    `$s.WorkingDirectory = ${psString(ROOT)}`,
    `$s.IconLocation = ${psString(ico + ',0')}`,
    '$s.Description = "Crastur - Sistema de Ventas y Bot de WhatsApp"',
    '$s.Save()'
  ].join('\r\n');

  const dataDir = path.join(ROOT, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const psFile = path.join(dataDir, 'crear_acceso_inicio.ps1');
  fs.writeFileSync(psFile, psScript, 'utf8');
  try {
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile], { stdio: 'ignore', timeout: 15000 });
  } finally {
    try { fs.unlinkSync(psFile); } catch {}
  }
}

/**
 * [INSTALACIÓN COMPLETA] Revisa las piezas que el servidor necesita para arrancar,
 * no solo `express`. Antes una instalación a medias se consideraba "lista" y el
 * sistema fallaba al iniciar (faltaba `tsx`, `sql.js` o la librería de WhatsApp).
 */
function hasModules() {
  const nm = path.join(ROOT, 'node_modules');
  const required = [
    ['express'],
    ['tsx'],
    ['sql.js'],
    ['ws'],
    ['@whiskeysockets', 'baileys']
  ];
  for (const parts of required) {
    if (!fs.existsSync(path.join(nm, ...parts))) return false;
  }
  return hasPlatformEsbuild();
}

/** El motor de TypeScript (esbuild) trae un binario distinto por sistema operativo. */
function hasPlatformEsbuild() {
  try {
    const dir = path.join(ROOT, 'node_modules', '@esbuild');
    if (!fs.existsSync(dir)) return false;
    const prefix = `${process.platform}-`;
    return fs.readdirSync(dir).some((d) => d.startsWith(prefix));
  } catch {
    return false;
  }
}

function hasClientDist() {
  return fs.existsSync(path.join(ROOT, 'client', 'dist', 'index.html'));
}
function hasClientModules() {
  if (!fs.existsSync(path.join(ROOT, 'client', 'node_modules', 'vite'))) return false;
  // Vite también usa esbuild: si las dependencias del panel vienen de otro sistema
  // operativo, el binario no sirve y la compilación falla.
  try {
    const esbuildDir = path.join(ROOT, 'client', 'node_modules', '@esbuild');
    if (!fs.existsSync(esbuildDir)) return true;
    return fs.readdirSync(esbuildDir).some((d) => d.startsWith(`${process.platform}-`));
  } catch {
    return false;
  }
}
function dbExists() {
  return fs.existsSync(path.join(ROOT, 'data', 'crastur.db'));
}

/** Ejecuta un comando y transmite su salida en vivo al panel del instalador. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      shell: true,
      ...opts
    });
    let out = '';
    child.stdout?.on('data', d => { out += d.toString(); opts.onData?.(d.toString()); });
    child.stderr?.on('data', d => { out += d.toString(); opts.onData?.(d.toString()); });
    child.on('close', code => resolve({ code, out }));
    child.on('error', err => resolve({ code: -1, out: String(err) }));
  });
}

/**
 * Consulta con serenidad si el sistema Crastur ya está en ejecución (panel en el puerto 3333).
 * Se usa para evitar restaurar datos mientras el bot tiene la base de datos abierta en memoria.
 */
function estaCrasturEncendido() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 3333, path: '/api/health', timeout: 1200 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ─── API del instalador ─────────────────────────────────────────────────────
const routes = {
  'GET /api/estado': () => {
    return {
      ok: true,
      sistema: 'Crastur',
      node: process.version,
      nodeCompatible: isNodeCompatible(),
      nodeRequerido: '20.19+ o 22.12+ (recomendado 22 LTS)',
      plataforma: process.platform,
      carpeta: ROOT,
      dependencias: hasModules(),
      clienteInstalado: hasClientModules(),
      panelCompilado: hasClientDist(),
      baseDeDatos: dbExists(),
      inicioAutomatico: hasAutoStart(),
      // [VERACIDAD] La base de datos se crea al iniciar Crastur por primera vez.
      // No debe impedir que el instalador muestre "listo" tras una instalación correcta.
      listo: hasModules() && hasClientDist()
    };
  },

  'POST /api/instalar': async (send) => {
    if (!isNodeCompatible()) {
      send({
        completado: true,
        exito: false,
        texto: `Tu Node.js (${process.version}) no es compatible. Instala Node.js 22 LTS desde https://nodejs.org y vuelve a intentarlo.`
      });
      return;
    }
    send({ paso: 1, total: 4, texto: 'Instalando componentes del servidor...' });
    if (!hasModules()) {
      const r1 = await run('npm', ['install', '--no-audit', '--no-fund'], { onData: (d) => send({ log: d }) });
      // [VERACIDAD] Si la instalación falla, no se puede declarar éxito.
      if (r1.code !== 0) { send({ completado: true, exito: false, texto: 'No se pudieron instalar los componentes. Revisa tu conexión a internet e inténtalo nuevamente.' }); return; }
    }

    send({ paso: 2, total: 4, texto: 'Instalando componentes del panel visual...' });
    if (!hasClientModules()) {
      const r2 = await run('npm', ['--prefix', 'client', 'install', '--no-audit', '--no-fund'], { onData: (d) => send({ log: d }) });
      if (r2.code !== 0) { send({ completado: true, exito: false, texto: 'No se pudieron instalar los componentes del panel visual. Revisa tu conexión a internet e inténtalo nuevamente.' }); return; }
    }

    send({ paso: 3, total: 4, texto: 'Compilando el panel administrativo...' });
    if (!hasClientDist()) {
      const r3 = await run('npm', ['--prefix', 'client', 'run', 'build'], { onData: (d) => send({ log: d }) });
      if (r3.code !== 0) { send({ completado: true, exito: false, texto: 'No se pudo preparar el panel administrativo. Inténtalo nuevamente.' }); return; }
    }

    send({ paso: 4, total: 4, texto: 'Preparando carpetas de datos...' });
    const dataDir = path.join(ROOT, 'data');
    const backupDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    send({ completado: true, exito: true, texto: '¡Instalación completada con éxito!' });
  },

  'POST /api/actualizar-panel': async (send) => {
    send({ paso: 1, total: 2, texto: 'Instalando dependencias del panel...' });
    const r1 = await run('npm', ['--prefix', 'client', 'install', '--no-audit', '--no-fund'], { onData: (d) => send({ log: d }) });
    if (r1.code !== 0) { send({ completado: true, exito: false, texto: 'No se pudieron instalar las dependencias del panel. Inténtalo nuevamente.' }); return; }
    send({ paso: 2, total: 2, texto: 'Compilando el panel actualizado...' });
    const r2 = await run('npm', ['--prefix', 'client', 'run', 'build'], { onData: (d) => send({ log: d }) });
    if (r2.code !== 0) { send({ completado: true, exito: false, texto: 'No se pudo actualizar el panel. Inténtalo nuevamente.' }); return; }
    send({ completado: true, exito: true, texto: '¡Panel actualizado con éxito!' });
  },

  'POST /api/respaldar': async (send) => {
    if (!hasModules()) {
      send({ completado: true, exito: false, texto: 'Primero completa la instalación del sistema para poder crear respaldos.' });
      return;
    }
    send({ paso: 1, total: 1, texto: 'Creando copia de seguridad del catálogo y asesores...' });
    const outName = `catalogo_asesores_${new Date().toISOString().slice(0, 10)}.json`;
    const outPath = path.join('data', 'backups', outName);
    const result = await run('npx', ['tsx', 'scripts/migrar_catalogo_asesores.ts', '--db', 'data/crastur.db', '--out', outPath], { onData: (d) => send({ log: d }) });
    send({ completado: true, exito: result.code === 0, texto: result.code === 0 ? `Respaldo creado: ${outName}` : 'No se pudo crear el respaldo.' });
  },

  'POST /api/restaurar': async (body, send) => {
    // body: { archivo: 'ruta/al/archivo.json' }
    if (!body?.archivo) { send({ completado: true, exito: false, texto: 'No se indicó archivo a restaurar.' }); return; }
    if (!hasModules()) {
      send({ completado: true, exito: false, texto: 'Primero completa la instalación del sistema para poder restaurar respaldos.' });
      return;
    }

    // [SEGURIDAD] La ruta debe vivir dentro de la carpeta de respaldos del propio proyecto.
    // Esto evita que un valor manipulado pueda apuntar a otra ubicación del disco.
    const backupsDir = path.resolve(ROOT, 'data', 'backups');
    const archivo = path.resolve(ROOT, body.archivo);
    if (!archivo.startsWith(backupsDir + path.sep)) {
      send({ completado: true, exito: false, texto: 'El archivo de respaldo no se encuentra en la carpeta permitida.' });
      return;
    }
    if (!fs.existsSync(archivo) || !archivo.endsWith('.json')) {
      send({ completado: true, exito: false, texto: 'No encontramos ese archivo de respaldo.' });
      return;
    }

    // [COHERENCIA] Si Crastur está encendido, el servidor tiene la base de datos en memoria y
    // podría sobrescribir la restauración. Avisamos con calma y pedimos cerrarlo primero.
    const encendido = await estaCrasturEncendido();
    if (encendido) {
      send({ completado: true, exito: false, texto: 'Para restaurar con total seguridad, primero cierra Crastur (botón "Apagar" del panel) y vuelve a intentarlo. Así tus datos quedan protegidos.' });
      return;
    }

    send({ paso: 1, total: 1, texto: 'Restaurando catálogo y asesores...' });
    const result = await run('npx', ['tsx', 'scripts/migrar_catalogo_asesores.ts', '--db', 'data/crastur.db', '--in', archivo], { onData: (d) => send({ log: d }) });
    send({ completado: true, exito: result.code === 0, texto: result.code === 0 ? '¡Catálogo y asesores restaurados!' : 'No se pudo restaurar el archivo.' });
  },

  'POST /api/arrancar': async (send) => {
    if (!isNodeCompatible()) {
      send({
        completado: true,
        exito: false,
        texto: `Tu Node.js (${process.version}) no es compatible. Instala Node.js 22 LTS desde https://nodejs.org.`
      });
      return;
    }
    send({ texto: 'Iniciando Crastur en segundo plano...' });
    // [SIN VENTANA NEGRA] En Windows se usa el mismo iniciador silencioso del acceso
    // directo. Antes se abría una consola con `node launcher.js` y, si fallaba, el error
    // se perdía porque la salida no se guardaba en ningún lado.
    if (isWin) {
      const vbs = path.join(ROOT, 'Crastur_SegundoPlano.vbs');
      spawn('wscript.exe', [vbs], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn(process.execPath, ['launcher.js'], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
    }
    setTimeout(() => send({ completado: true, texto: 'Crastur está iniciando. En unos segundos se abrirá el panel en tu navegador.' }), 1500);
  },

  'POST /api/inicio-automatico': async (body, send) => {
    if (!isWin) {
      send({ completado: true, exito: false, texto: 'El inicio automático al encender la PC está disponible solo en Windows.' });
      return;
    }
    const activar = !!body?.activar;
    try {
      const target = startupShortcutPath();
      if (!target) throw new Error('No se pudo ubicar la carpeta de Inicio de Windows.');
      if (activar) {
        createWindowsShortcut(target);
        if (!fs.existsSync(target)) throw new Error('Windows no pudo crear el acceso directo de inicio.');
      } else if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
      send({
        completado: true,
        exito: true,
        activo: activar,
        inicioAutomatico: activar,
        texto: activar
          ? 'Listo: Crastur se iniciará automáticamente al encender la PC.'
          : 'Listo: Crastur ya no se iniciará automáticamente al encender la PC.'
      });
    } catch (e) {
      send({ completado: true, exito: false, texto: `No se pudo cambiar el inicio automático: ${e?.message || e}` });
    }
  },

  'POST /api/catalogo-demo': async (send) => {
    if (!isNodeCompatible()) {
      send({ completado: true, exito: false, texto: 'Actualiza Node.js a 20.19+ o 22.12+ antes de cargar el catálogo de prueba.' });
      return;
    }
    if (!hasModules()) {
      send({ completado: true, exito: false, texto: 'Primero completa la instalación del sistema.' });
      return;
    }
    if (await estaCrasturEncendido()) {
      send({ completado: true, exito: false, texto: 'Para cargar el catálogo de prueba, primero apaga Crastur desde el botón “Apagar” del panel y vuelve a intentarlo.' });
      return;
    }
    send({ texto: 'Cargando catálogo de demostración...' });
    const result = await run('npx', ['tsx', 'scripts/cargar_catalogo_demo.ts'], { onData: (d) => send({ log: d }) });
    send({
      completado: true,
      exito: result.code === 0,
      texto: result.code === 0
        ? '¡Catálogo de demostración cargado! Enciende Crastur para probar el bot.'
        : 'No se pudo cargar el catálogo de demostración. Revisa el detalle de arriba.'
    });
  },

  'GET /api/respaldos': () => {
    const dir = path.join(ROOT, 'data', 'backups');
    const list = [];
    const addIfFile = (full, nombre) => {
      try {
        const st = fs.statSync(full);
        if (st.isFile()) list.push({ nombre, ruta: full, bytes: st.size });
      } catch {}
    };
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        // Solo respaldos portables de catálogo + asesores (no los .db binarios ni carpetas)
        if (f.endsWith('.json') && f !== 'snapshot_maestro_crastur.json') {
          addIfFile(path.join(dir, f), f);
        }
      }
    }
    return { respaldos: list };
  }
};

// ─── Servidor HTTP ──────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  // Interfaz HTML
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE_HTML);
    return;
  }

  const key = `${req.method} ${url}`;
  if (routes[key]) {
    const body = req.method === 'POST' ? await readBody(req) : null;
    if (url === '/api/instalar' || url === '/api/actualizar-panel' || url === '/api/respaldar' || url === '/api/restaurar' || url === '/api/arrancar' || url === '/api/inicio-automatico' || url === '/api/catalogo-demo') {
      // Streaming NDJSON de progreso
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Transfer-Encoding': 'chunked' });
      const send = (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch {} };
      try {
        if (url === '/api/restaurar' || url === '/api/inicio-automatico') { await routes[key](body, send); }
        else { await routes[key](send); }
      } catch (e) { send({ error: String(e) }); }
      res.end();
      return;
    }
    // Respuestas JSON normales
    try {
      const result = await routes[key](body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('No encontrado');
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('============================================================');
  console.log('  CRASTUR - Panel de Instalación y Mantenimiento');
  console.log('============================================================');
  console.log(`  Abriendo interfaz en: ${url}`);
  console.log('  (Puedes cerrar esta ventana al terminar)');
  console.log('============================================================');
  // Abrir el navegador automáticamente
  try {
    if (isWin) {
      execFile('cmd', ['/c', 'start', '""', url]);
    } else if (process.platform === 'darwin') {
      execFile('open', [url]);
    } else {
      execFile('xdg-open', [url]);
    }
  } catch {}
});

// [LIMPIEZA] Liberar el puerto 4545 al cerrar la ventana del instalador (evita el
// error de "puerto ocupado" si el usuario vuelve a abrir el instalador).
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log('ℹ️ El panel de mantenimiento ya estaba abierto. Puedes usar esa pestaña del navegador.');
  } else {
    console.error('Error del instalador:', err?.message || err);
  }
});
const cerrarInstalador = () => { try { server.close(); } catch {} process.exit(0); };
process.on('SIGINT', cerrarInstalador);
process.on('SIGTERM', cerrarInstalador);
process.on('SIGHUP', cerrarInstalador);

// Página HTML embebida (interfaz visual)
const PAGE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Crastur - Instalación y Mantenimiento</title>
<style>
  :root{--bg:#0b1220;--card:#121c30;--line:#233150;--txt:#e7eefb;--mut:#93a4c4;--ori:#f97316;--grn:#22c55e;--red:#ef4444}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:linear-gradient(160deg,#0b1220,#080d18);color:var(--txt);min-height:100vh;display:flex;justify-content:center;padding:28px}
  .wrap{width:100%;max-width:860px}
  h1{font-size:26px;margin:0 0 4px;display:flex;align-items:center;gap:12px}
  .sub{color:var(--mut);font-size:14px;margin-bottom:22px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:22px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px}
  .stat .k{font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px}
  .stat .v{font-size:15px;font-weight:700;margin-top:4px}
  .ok{color:var(--grn)}.no{color:var(--red)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;margin-bottom:16px}
  .card h2{font-size:16px;margin:0 0 4px}
  .card p{color:var(--mut);font-size:13px;margin:0 0 14px}
  button{font:inherit;border:0;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer;transition:.15s}
  .b-main{background:linear-gradient(90deg,#f97316,#ea580c);color:#0b1220}
  .b-2{background:#1b2740;color:var(--txt);border:1px solid var(--line)}
  button:hover{transform:translateY(-1px)}
  button:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  .bar{height:10px;background:#0b1220;border:1px solid var(--line);border-radius:99px;overflow:hidden;margin:14px 0 8px}
  .bar > i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f97316,#fb923c);transition:.3s}
  .log{background:#070b14;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-family:ui-monospace,monospace;font-size:11px;color:#a9b8d6;max-height:180px;overflow:auto;white-space:pre-wrap;margin-top:10px;display:none}
  .msg{font-size:13px;margin-top:10px;min-height:18px}
  .foot{color:var(--mut);font-size:12px;text-align:center;margin-top:18px}
</style>
</head>
<body>
<div class="wrap">
  <h1>🛞🏍️ Crastur <span style="font-size:13px;color:var(--mut);font-weight:400">Panel de Instalación y Mantenimiento</span></h1>
  <div class="sub">Instala, actualiza y respalda tu sistema con un clic. No necesitas escribir comandos.</div>

  <div class="card" id="avisoNode" style="display:none;border:1px solid var(--red);background:#2a0e12">
    <h2 style="color:#fca5a5">⚠ Tu versión de Node.js no es compatible</h2>
    <p style="color:#fecaca">Crastur necesita <b>Node.js 20.19+ o 22.12+</b> (recomendado 22 LTS). Instálalo desde <b>https://nodejs.org</b> y vuelve a abrir este instalador.</p>
  </div>

  <div class="grid" id="stats"></div>

  <div class="card">
    <h2>1. Instalación</h2>
    <p>Verifica e instala todo lo necesario para que Crastur funcione.</p>
    <div class="row">
      <button class="b-main" id="btnInstalar">▶ Instalar / Verificar Sistema</button>
      <button class="b-2" id="btnPanel">🖥️ Actualizar Panel Visual</button>
    </div>
    <div class="bar"><i id="barra"></i></div>
    <div class="msg" id="msg"></div>
    <div class="log" id="log"></div>
  </div>

  <div class="card">
    <h2>Catálogo de demostración (opcional)</h2>
    <p>Para probar el bot y el panel antes de cargar tu inventario real. Se puede quitar después con el comando <b>npm run catalogo-demo -- --limpiar</b>. Apaga Crastur antes de usarlo.</p>
    <div class="row">
      <button class="b-2" id="btnDemo">🧪 Cargar catálogo de demostración</button>
    </div>
    <div class="msg" id="msgDemo"></div>
  </div>

  <div class="card">
    <h2>2. Copias de Seguridad</h2>
    <p>Crea un respaldo de tu Catálogo y Asesores, o restaura uno existente.</p>
    <p style="font-size:12px;color:var(--mut)">💡 Consejo: para restaurar tus datos con total seguridad, cierra primero Crastur desde el botón <b>“Apagar”</b> del panel y luego vuelve aquí.</p>
    <div class="row">
      <button class="b-2" id="btnRespaldar">💾 Crear Respaldo (Catálogo + Asesores)</button>
      <button class="b-2" id="btnVerRespaldos">📂 Ver Respaldos Guardados</button>
    </div>
    <div id="listaRespaldos" style="margin-top:12px"></div>
  </div>

  <div class="card">
    <h2>3. Iniciar Crastur</h2>
    <p>Arranca el sistema y abre el panel administrativo en tu navegador.</p>
    <div class="row">
      <button class="b-main" id="btnArrancar">🚀 Iniciar Crastur</button>
    </div>
  </div>

  <div class="card" id="cardInicioAuto">
    <h2>4. Inicio automático al encender la PC</h2>
    <p>Recomendado para la computadora del bot: si hay un corte de luz o reinicias Windows, Crastur vuelve a arrancar solo sin que nadie haga clic.</p>
    <div class="row">
      <button class="b-2" id="btnInicioAuto">⚙️ Activar inicio automático</button>
    </div>
    <div class="msg" id="msgInicio"></div>
  </div>

  <div class="foot">Crastur · Insumos para Caucheras y Repuestos de Moto · Caracas</div>
</div>

<script>
const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
let inicioAutoActivo = false;

async function cargarEstado(){
  try{
    const r = await fetch('/api/estado'); const d = await r.json();
    const s = (v,ok) => '<span class="'+(ok?'ok':'no')+'">'+(v?'✓ Instalado':'✗ Falta')+'</span>';
    const aviso = el('avisoNode');
    if (aviso) aviso.style.display = d.nodeCompatible ? 'none' : 'block';
    const cardAuto = el('cardInicioAuto');
    if (cardAuto) cardAuto.style.display = d.plataforma === 'win32' ? 'block' : 'none';
    el('stats').innerHTML = [
      ['Node.js', '<span class="'+(d.nodeCompatible?'ok':'no')+'">'+d.node+(d.nodeCompatible?' ✓':' ✗ incompatible')+'</span>'],
      ['Dependencias servidor', s(d.dependencias, d.dependencias)],
      ['Panel visual compilado', s(d.panelCompilado, d.panelCompilado)],
      ['Base de datos', d.baseDeDatos ? s(true,true) : '<span style="color:var(--mut)">Se crea al iniciar</span>'],
      ['Inicio automático', d.inicioAutomatico ? '<span class="ok">✓ Activado</span>' : '<span style="color:var(--mut)">Desactivado</span>'],
      ['Estado', d.listo ? '<span class="ok">Listo para usar</span>' : '<span class="no">Requiere instalación</span>']
    ].map(([k,v]) => '<div class="stat"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>').join('');
    inicioAutoActivo = !!d.inicioAutomatico;
    const btnAuto = el('btnInicioAuto');
    if (btnAuto) btnAuto.textContent = inicioAutoActivo ? '⛔ Quitar inicio automático' : '⚙️ Activar inicio automático';
  }catch(e){ el('stats').innerHTML = '<div class="stat"><div class="v no">No se pudo leer el estado</div></div>'; }
}

async function stream(url, opts, onDone, msgId = 'msg'){
  const logEl = el('log'); logEl.style.display='block'; logEl.textContent='';
  const barra = el('barra'); barra.style.width='5%';
  const msgEl = el(msgId);
  try{
    const res = await fetch(url, Object.assign({method:'POST',headers:{'Content-Type':'application/json'}}, opts));
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf='';
    while(true){
      const {done,value} = await reader.read(); if(done) break;
      buf += dec.decode(value,{stream:true});
      let idx;
      while((idx = buf.indexOf('\\n')) >= 0){
        const line = buf.slice(0,idx).trim(); buf = buf.slice(idx+1);
        if(!line) continue;
        let j; try{ j = JSON.parse(line); }catch{ continue; }
        if(j.log){ logEl.textContent += j.log; logEl.scrollTop = logEl.scrollHeight; }
        if(j.texto){ msgEl.textContent = j.texto; msgEl.className='msg ok'; }
        if(j.paso && j.total){ barra.style.width = Math.round(j.paso/j.total*100)+'%'; }
        if(j.completado){ barra.style.width='100%'; msgEl.textContent = j.texto || 'Listo'; msgEl.className='msg '+(j.exito===false?'no':'ok'); if(onDone) onDone(j); }
        if(j.error){ msgEl.textContent = 'Error: '+j.error; msgEl.className='msg no'; }
      }
    }
  }catch(e){ msgEl.textContent = 'Error de conexión: '+e; }
  cargarEstado();
}

el('btnInstalar').onclick = async () => { el('btnInstalar').disabled=true; await stream('/api/instalar',{},()=>el('btnInstalar').disabled=false); el('btnInstalar').disabled=false; };
el('btnPanel').onclick = async () => { el('btnPanel').disabled=true; await stream('/api/actualizar-panel',{},()=>el('btnPanel').disabled=false); el('btnPanel').disabled=false; };
el('btnRespaldar').onclick = async () => { el('btnRespaldar').disabled=true; await stream('/api/respaldar',{},()=>{el('btnRespaldar').disabled=false; verRespaldos();}); el('btnRespaldar').disabled=false; };
el('btnArrancar').onclick = async () => { el('btnArrancar').disabled=true; await stream('/api/arrancar',{},()=>{}); el('btnArrancar').disabled=false; };
el('btnInicioAuto').onclick = async () => {
  const activar = !inicioAutoActivo;
  el('btnInicioAuto').disabled = true;
  await stream('/api/inicio-automatico', { body: JSON.stringify({ activar }) }, () => { el('btnInicioAuto').disabled = false; }, 'msgInicio');
  el('btnInicioAuto').disabled = false;
};
el('btnDemo').onclick = async () => {
  if (!confirm('¿Cargar el catálogo de demostración? Se agregarán productos de prueba (no borra los que ya tengas). Recuerda apagar Crastur primero.')) return;
  el('btnDemo').disabled = true;
  await stream('/api/catalogo-demo', {}, () => { el('btnDemo').disabled = false; }, 'msgDemo');
  el('btnDemo').disabled = false;
};

async function verRespaldos(){
  const r = await fetch('/api/respaldos'); const d = await r.json();
  if(!d.respaldos || d.respaldos.length===0){ el('listaRespaldos').innerHTML = '<div class="sub">No hay respaldos todavía. Crea uno con el botón de arriba.</div>'; return; }
  el('listaRespaldos').innerHTML = d.respaldos.map(x =>
    '<div class="row" style="align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px">'
    + '<span style="font-size:13px">📄 '+esc(x.nombre)+' <span style="color:var(--mut)">('+(x.bytes/1024).toFixed(1)+' KB)</span></span>'
    + '<button class="b-2" data-ruta="'+esc(x.ruta)+'" onclick="restaurar(this)">↩ Restaurar</button></div>'
  ).join('');
}
async function restaurar(btn){
  if(!confirm('¿Restaurar este respaldo? Se agregarán/actualizarán los productos y asesores del archivo.')) return;
  const ruta = btn.getAttribute('data-ruta');
  btn.disabled=true;
  await stream('/api/restaurar',{body:JSON.stringify({archivo:ruta})},()=>{btn.disabled=false;});
  btn.disabled=false;
}
el('btnVerRespaldos').onclick = verRespaldos;

cargarEstado();
</script>
</body>
</html>`;
