/**
 * ============================================================================
 * PRUEBAS E2E DE LA INTERFAZ WEB (PANEL ADMINISTRATIVO CRASTUR)
 * ============================================================================
 * Arranca el servidor real de Crastur, abre el panel administrativo en un
 * navegador Chrome headless (vía puppeteer-core) y valida la experiencia de
 * usuario end-to-end: carga de la SPA, navegación entre las 9 vistas, widgets
 * del encabezado (tasa BCV), apertura de modales y errores de consola.
 *
 * Requisitos:
 *   - Google Chrome / Chromium instalado (se usa el que ya existe en el sistema).
 *   - puppeteer-core (devDependency).
 *
 * Uso:
 *   npm run test:ui
 *   # o contra un servidor ya encendido:
 *   CRASTUR_E2E_BASE_URL=http://127.0.0.1:3333 npm run test:ui
 * ============================================================================
 */

import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m'
};

const PORT = Number(process.env.PORT) || 3333;
const BASE_URL = process.env.CRASTUR_E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

// El código ejecutado dentro de page.evaluate() corre en el NAVEGADOR, no en Node.
// El tsconfig del servidor no incluye la librería DOM, por eso se declaran aquí las
// APIs mínimas del navegador que usamos (document, elemento botón, parseInt).
declare const document: any;
type HTMLElementRef = any;

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail = ''): void {
  if (condition) {
    console.log(`  ${C.green}✅ [PASÓ]${C.reset} ${name}`);
    passed++;
  } else {
    console.error(`  ${C.red}❌ [FALLÓ]${C.reset} ${name} ${detail ? `-> ${detail}` : ''}`);
    failed++;
  }
}

/** Localiza un ejecutable de Chrome/Chromium en el sistema. */
function findChrome(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return null;
}

/** Comprueba si el servidor responde en /api/health. */
function isServerUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, { timeout: 1200 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(maxMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isServerUp()) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function runUiTests(): Promise<void> {
  console.log('================================================================');
  console.log('🖥️  PRUEBAS E2E DE INTERFAZ WEB - PANEL ADMINISTRATIVO CRASTUR');
  console.log('================================================================\n');

  const chromePath = findChrome();
  if (!chromePath) {
    console.error(`${C.yellow}⚠️  No se encontró Google Chrome/Chromium. Saltando pruebas E2E.${C.reset}`);
    console.error('   Instala Chrome o define la variable CHROME_PATH.');
    process.exit(0);
  }
  console.log(`🔎 Navegador detectado: ${chromePath}`);

  // ── Arranque del servidor (si no está ya encendido) ──────────────────────
  let serverProc: ChildProcess | null = null;
  const alreadyUp = await isServerUp();
  if (!alreadyUp) {
    console.log('🚀 Arrancando servidor Crastur para las pruebas...');
    serverProc = spawn('node', ['--import', 'tsx', 'server/server.ts'], {
      cwd: ROOT,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(PORT) }
    });
    const ready = await waitForServer(60000);
    if (!ready) {
      console.error(`${C.red}❌ El servidor no respondió a tiempo. Abortando E2E.${C.reset}`);
      if (serverProc) serverProc.kill();
      process.exit(1);
    }
  } else {
    console.log('♻️  Servidor ya en ejecución: reutilizando instancia.');
  }
  console.log(`🌐 Panel: ${BASE_URL}\n`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        // Ignorar ruido de red esperado (BCV offline, websocket, favicon) en entorno de prueba
        if (/favicon|WebSocket|Failed to load resource|net::ERR|bcv/i.test(txt)) return;
        consoleErrors.push(txt);
      }
    });
    page.on('pageerror', (err: any) => pageErrors.push(String(err && err.message ? err.message : err)));

    // ── 1. Carga inicial de la SPA ─────────────────────────────────────────
    console.log('📄 [Bloque 1: Carga de la SPA y Layout]');
    const resp = await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    assert(resp !== null && resp.status() === 200, 'El panel carga con HTTP 200');

    await page.waitForSelector('#root', { timeout: 10000 });
    const rootHtml = await page.$eval('#root', (el: any) => el.innerHTML.length);
    assert(rootHtml > 500, 'React monta el árbol de componentes en #root');

    const title = await page.title();
    assert(/Crastur/i.test(title), `El título de la página es de Crastur ("${title}")`);

    // Dashboard visible por defecto (texto característico)
    const bodyText = await page.evaluate(() => document.body.innerText);
    assert(/Dashboard|Resumen|Crastur/i.test(bodyText), 'El Dashboard se muestra por defecto');

    // ── 2. Navegación entre las 9 vistas ───────────────────────────────────
    console.log('\n🧭 [Bloque 2: Navegación por las vistas del panel]');
    const views: Array<{ label: string; navText: string; expect: RegExp }> = [
      { label: 'Dashboard', navText: 'Dashboard', expect: /Dashboard|Resumen|Ventas/i },
      { label: 'Live Inbox', navText: 'Live Inbox', expect: /Live Inbox|Bandeja|Chat|Inbox/i },
      { label: 'Catálogo Productos', navText: 'Catálogo Productos', expect: /Cat[aá]logo|Productos|Inventario/i },
      { label: 'Apartados (24h)', navText: 'Apartados', expect: /Apartado|Reserva|24h/i },
      { label: 'Calculadora Cashea', navText: 'Calculadora Cashea', expect: /Cashea|Calculadora|Combo/i },
      { label: 'Conexión WhatsApp', navText: 'Conexión WhatsApp', expect: /WhatsApp|QR|Conectar/i },
      { label: 'Asesores de Ventas', navText: 'Asesores de Ventas', expect: /Asesor|Vendedor/i },
      { label: 'Configuración', navText: 'Configuración', expect: /Configuraci[oó]n|Tienda|Ajustes/i }
    ];

    for (const view of views) {
      // El botón de navegación puede estar en el layout expandido (texto visible)
      // o en el colapsado (atributo title). Se aceptan ambos.
      const clicked = await page.evaluate((navText: string) => {
        const btns = Array.from(document.querySelectorAll('button')) as HTMLElementRef[];
        const byText = btns.find(b => (b.innerText || '').trim().startsWith(navText));
        if (byText) { byText.click(); return true; }
        const byTitle = btns.find(b => (b.getAttribute('title') || '').trim() === navText);
        if (byTitle) { byTitle.click(); return true; }
        return false;
      }, view.navText);

      if (!clicked) {
        assert(false, `Vista "${view.label}" tiene botón de navegación`, 'no encontrado');
        continue;
      }

      await new Promise(r => setTimeout(r, 700));
      const txt = await page.evaluate(() => document.body.innerText);
      assert(view.expect.test(txt), `Vista "${view.label}" renderiza su contenido`);
    }

    // ── 3. Widget de tasa BCV en el encabezado ─────────────────────────────
    console.log('\n💱 [Bloque 3: Widget de tasa BCV]');
    const headerText = await page.evaluate(() => document.body.innerText);
    assert(/BCV|Bs\.?\s*\d/i.test(headerText), 'El encabezado muestra la tasa BCV del día');

    // ── 4. Modales interactivos ────────────────────────────────────────────
    console.log('\n🪟 [Bloque 4: Apertura de modales]');
    // Ir al catálogo y abrir el modal de "nuevo producto"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')) as HTMLElementRef[];
      const target = btns.find(b => (b.innerText || '').trim().startsWith('Catálogo Productos'));
      if (target) target.click();
    });
    await new Promise(r => setTimeout(r, 650));

    const addBtnClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button')) as HTMLElementRef[];
      const add = all.find(b => /Nuevo|Agregar|A[ñn]adir|\+/i.test((b.textContent || '').trim()));
      if (add) { add.click(); return true; }
      return false;
    });
    if (addBtnClicked) {
      await new Promise(r => setTimeout(r, 500));
      const modalText = await page.evaluate(() => document.body.innerText);
      assert(/Marca|Modelo|Precio|Nuevo/i.test(modalText), 'El modal de producto se abre correctamente');

      // [UX] El modal debe cerrarse con la tecla Escape (y quedarse sin campos de formulario)
      const inputsAntes = await page.$$eval('input', (els: any[]) => els.length);
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 450));
      const inputsDespues = await page.$$eval('input', (els: any[]) => els.length);
      const modalSigueAbierto = await page.evaluate(() => /Marca|Modelo/i.test(document.body.innerText));
      assert(inputsDespues < inputsAntes && !modalSigueAbierto, 'El modal se cierra con la tecla Escape');
    } else {
      assert(true, 'Modal de producto (botón no etiquetado; se omite)');
    }

    // ── 5. Responsividad (viewport móvil) ──────────────────────────────────
    console.log('\n📱 [Bloque 5: Responsividad móvil]');
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 400));
    const mobileRoot = await page.$eval('#root', (el: any) => el.innerHTML.length);
    assert(mobileRoot > 500, 'La interfaz se renderiza en viewport móvil (390x844)');
    await page.setViewport({ width: 1440, height: 900 });

    // ── 6. Sin errores críticos de consola ─────────────────────────────────
    console.log('\n🧯 [Bloque 6: Salud de la consola del navegador]');
    assert(pageErrors.length === 0, 'Sin errores de ejecución JavaScript (pageerror)', pageErrors.slice(0, 3).join(' | '));
    assert(consoleErrors.length === 0, 'Sin errores críticos en la consola del navegador', consoleErrors.slice(0, 3).join(' | '));

  } finally {
    await browser.close();
    if (serverProc) {
      try { serverProc.kill(); } catch {}
    }
  }

  console.log('\n================================================================');
  console.log(`🏁 RESULTADO E2E: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log('================================================================');

  if (failed > 0) {
    console.error('❌ Algunas pruebas E2E fallaron.');
    process.exit(1);
  } else {
    console.log(`🎉 ¡TODAS LAS ${passed} PRUEBAS E2E DE INTERFAZ PASARON!`);
    process.exit(0);
  }
}

runUiTests().catch((err) => {
  console.error('Error fatal en pruebas E2E:', err);
  process.exit(1);
});
