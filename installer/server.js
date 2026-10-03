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
const { spawn, execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.INSTALLER_PORT) || 4545;
const isWin = process.platform === 'win32';

// ─── Utilidades ─────────────────────────────────────────────────────────────
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

function hasModules() {
  return fs.existsSync(path.join(ROOT, 'node_modules', 'express'));
}
function hasClientDist() {
  return fs.existsSync(path.join(ROOT, 'client', 'dist', 'index.html'));
}
function hasClientModules() {
  return fs.existsSync(path.join(ROOT, 'client', 'node_modules'));
}
function dbExists() {
  return fs.existsSync(path.join(ROOT, 'data', 'crastur.db'));
}

// ─── API del instalador ─────────────────────────────────────────────────────
const routes = {
  'GET /api/estado': () => {
    return {
      ok: true,
      sistema: 'Crastur',
      node: process.version,
      plataforma: process.platform,
      carpeta: ROOT,
      dependencias: hasModules(),
      clienteInstalado: hasClientModules(),
      panelCompilado: hasClientDist(),
      baseDeDatos: dbExists(),
      listo: hasModules() && hasClientDist() && dbExists()
    };
  },

  'POST /api/instalar': async (send) => {
    send({ paso: 1, total: 4, texto: 'Instalando componentes del servidor...' });
    if (!hasModules()) {
      await run('npm', ['install', '--no-audit', '--no-fund'], { onData: (d) => send({ log: d }) });
    }
    send({ paso: 2, total: 4, texto: 'Instalando componentes del panel visual...' });
    if (!hasClientModules()) {
      await run('npm', ['--prefix', 'client', 'install', '--no-audit', '--no-fund'], { onData: (d) => send({ log: d }) });
    }
    send({ paso: 3, total: 4, texto: 'Compilando el panel administrativo...' });
    if (!hasClientDist()) {
      await run('npm', ['--prefix', 'client', 'run', 'build'], { onData: (d) => send({ log: d }) });
    }
    send({ paso: 4, total: 4, texto: 'Preparando carpetas de datos...' });
    const dataDir = path.join(ROOT, 'data');
    const backupDir = path.join(dataDir, 'backups');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    send({ completado: true, texto: '¡Instalación completada con éxito!' });
  },

  'POST /api/actualizar-panel': async (send) => {
    send({ paso: 1, total: 2, texto: 'Instalando dependencias del panel...' });
    await run('npm', ['--prefix', 'client', 'install', '--no-audit', '--no-fund'], { onData: (d) => send({ log: d }) });
    send({ paso: 2, total: 2, texto: 'Compilando el panel actualizado...' });
    await run('npm', ['--prefix', 'client', 'run', 'build'], { onData: (d) => send({ log: d }) });
    send({ completado: true, texto: '¡Panel actualizado con éxito!' });
  },

  'POST /api/respaldar': async (send) => {
    send({ paso: 1, total: 1, texto: 'Creando copia de seguridad del catálogo y asesores...' });
    const outName = `catalogo_asesores_${new Date().toISOString().slice(0, 10)}.json`;
    const outPath = path.join('data', 'backups', outName);
    const result = await run('npx', ['tsx', 'scripts/migrar_catalogo_asesores.ts', '--db', 'data/crastur.db', '--out', outPath], { onData: (d) => send({ log: d }) });
    send({ completado: true, exito: result.code === 0, texto: result.code === 0 ? `Respaldo creado: ${outName}` : 'No se pudo crear el respaldo.' });
  },

  'POST /api/restaurar': async (body, send) => {
    // body: { archivo: 'ruta/al/archivo.json' }
    const archivo = body?.archivo;
    if (!archivo) { send({ completado: true, exito: false, texto: 'No se indicó archivo a restaurar.' }); return; }
    send({ paso: 1, total: 1, texto: 'Restaurando catálogo y asesores...' });
    const result = await run('npx', ['tsx', 'scripts/migrar_catalogo_asesores.ts', '--db', 'data/crastur.db', '--in', archivo], { onData: (d) => send({ log: d }) });
    send({ completado: true, exito: result.code === 0, texto: result.code === 0 ? '¡Catálogo y asesores restaurados!' : 'No se pudo restaurar el archivo.' });
  },

  'POST /api/arrancar': async (send) => {
    send({ texto: 'Iniciando Crastur en segundo plano...' });
    const cmd = isWin ? 'cmd' : 'node';
    const args = isWin ? ['/c', 'start', '""', 'node', 'launcher.js'] : ['launcher.js'];
    spawn(cmd, args, { cwd: ROOT, detached: true, stdio: 'ignore', shell: true }).unref();
    setTimeout(() => send({ completado: true, texto: 'Crastur está iniciando. Abriendo el panel...' }), 1500);
  },

  'GET /api/respaldos': () => {
    const dir = path.join(ROOT, 'data', 'backups');
    const list = [];
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.json')) {
          const full = path.join(dir, f);
          list.push({ nombre: f, ruta: full, bytes: fs.statSync(full).size });
        }
      }
    }
    // También archivos json sueltos en la raíz
    for (const f of fs.readdirSync(ROOT)) {
      if (f.startsWith('catalogo_asesores') && f.endsWith('.json')) {
        const full = path.join(ROOT, f);
        list.push({ nombre: f, ruta: full, bytes: fs.statSync(full).size });
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
    if (url === '/api/instalar' || url === '/api/actualizar-panel' || url === '/api/respaldar' || url === '/api/restaurar' || url === '/api/arrancar') {
      // Streaming NDJSON de progreso
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Transfer-Encoding': 'chunked' });
      const send = (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch {} };
      try {
        if (url === '/api/restaurar') { await routes[key](body, send); }
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
    <h2>2. Copias de Seguridad</h2>
    <p>Crea un respaldo de tu Catálogo y Asesores, o restaura uno existente.</p>
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

  <div class="foot">Crastur · Insumos para Caucheras y Repuestos de Moto · Caracas</div>
</div>

<script>
const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

async function cargarEstado(){
  try{
    const r = await fetch('/api/estado'); const d = await r.json();
    const s = (v,ok) => '<span class="'+(ok?'ok':'no')+'">'+(v?'✓ Instalado':'✗ Falta')+'</span>';
    el('stats').innerHTML = [
      ['Sistema', d.sistema + ' (' + d.node + ')'],
      ['Dependencias servidor', s(d.dependencias, d.dependencias)],
      ['Panel visual compilado', s(d.panelCompilado, d.panelCompilado)],
      ['Base de datos', s(d.baseDeDatos, d.baseDeDatos)],
      ['Estado', d.listo ? '<span class="ok">Listo para usar</span>' : '<span class="no">Requiere instalación</span>']
    ].map(([k,v]) => '<div class="stat"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>').join('');
  }catch(e){ el('stats').innerHTML = '<div class="stat"><div class="v no">No se pudo leer el estado</div></div>'; }
}

async function stream(url, opts, onDone){
  const logEl = el('log'); logEl.style.display='block'; logEl.textContent='';
  const barra = el('barra'); barra.style.width='5%';
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
        if(j.texto){ el('msg').textContent = j.texto; el('msg').className='msg ok'; }
        if(j.paso && j.total){ barra.style.width = Math.round(j.paso/j.total*100)+'%'; }
        if(j.completado){ barra.style.width='100%'; el('msg').textContent = j.texto || 'Listo'; el('msg').className='msg '+(j.exito===false?'no':'ok'); if(onDone) onDone(j); }
        if(j.error){ el('msg').textContent = 'Error: '+j.error; el('msg').className='msg no'; }
      }
    }
  }catch(e){ el('msg').textContent = 'Error de conexión: '+e; }
  cargarEstado();
}

el('btnInstalar').onclick = async () => { el('btnInstalar').disabled=true; await stream('/api/instalar',{},()=>el('btnInstalar').disabled=false); el('btnInstalar').disabled=false; };
el('btnPanel').onclick = async () => { el('btnPanel').disabled=true; await stream('/api/actualizar-panel',{},()=>el('btnPanel').disabled=false); el('btnPanel').disabled=false; };
el('btnRespaldar').onclick = async () => { el('btnRespaldar').disabled=true; await stream('/api/respaldar',{},()=>{el('btnRespaldar').disabled=false; verRespaldos();}); el('btnRespaldar').disabled=false; };
el('btnArrancar').onclick = async () => { el('btnArrancar').disabled=true; await stream('/api/arrancar',{},()=>{}); el('btnArrancar').disabled=false; };

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
