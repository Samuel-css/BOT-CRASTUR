/**
 * ============================================================================
 * SERVIDOR PRINCIPAL: API REST, WEBSOCKETS Y SERVICIOS DE FONDO (CRASTUR)
 * ============================================================================
 * Orquesta la infraestructura backend del bot de WhatsApp y el panel administrativo.
 * Integra Express 5, WebSocket (Live Inbox), SQLite WASM, sincronización de tasa BCV,
 * Baileys v7 ESM y la máquina de estados de apartados por 24 horas.
 * 
 * [CICLO DE VIDA SERVIDOR EXPRESS 5 / NODE.JS]
 * - Inicializa primero el canal de WebSockets sobre el servidor HTTP nativo.
 * - Registra middlewares de seguridad (CORS) y parseo JSON con límite de 10MB.
 * - Sirve la API modular bajo el prefijo `/api` y el bundle estático del frontend React SPA.
 * - [RECUPERACIÓN ANTE FALLOS Y PUERTO OCUPADO] Captura excepciones no controladas y
 *   ofrece diagnósticos y comandos automatizados (PowerShell/Linux) si el puerto 3333 está en uso.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';

import { whenReady, cleanExpiredReservations, persistDB } from './database';
import { initBCVService } from './bcvService';
import { startWhatsApp } from './whatsappService';
import { initWebSocket } from './websocket';
import apiRoutes from './routes';
import { ALLOWED_ORIGINS, isAllowedOrigin } from './config/origins';

const app = express();
const server = http.createServer(app);

// Inicializar capa de WebSockets para Live Inbox y streaming de eventos en tiempo real
initWebSocket(server);

// Middlewares estándar de Express para el procesamiento de solicitudes HTTP
// [SEGURIDAD] CORS restringido a orígenes locales (evita acceso remoto no autorizado)
const allowedOrigins = ALLOWED_ORIGINS;
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));
// [ANTI-CSRF] CORS bloquea la lectura de la respuesta, pero NO impide que una página
// maliciosa dispare un POST/DELETE (p. ej. apagar el sistema o borrar el inbox).
// Para peticiones que mutan estado, si viene un Origin no autorizado se rechaza con 403.
app.use((req: Request, res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (!isAllowedOrigin(req.get('origin'))) {
      return res.status(403).json({ success: false, error: 'Origen no autorizado' });
    }
  }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Registrar el árbol de rutas modulares de la API administrativa y del bot
app.use('/api', apiRoutes);

// Servir la aplicación React de producción compilada en client/dist si existe
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Redirección de fallback para Single Page Application (SPA) en rutas GET no API
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      const indexPath = path.join(clientDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath, (err) => {
          if (err && !res.headersSent) {
            next();
          }
        });
      }
    }
    next();
  });
}

const PORT = Number(process.env.PORT) || 3333;

// [RECUPERACIÓN ANTE FALLOS] Captura global para evitar que el proceso se detenga abruptamente
process.on('uncaughtException', (err: any) => {
  console.error('[Protección Anti-Fallos] Error no capturado recuperado:', err.message);
  if (err.code === 'EADDRINUSE') {
    const isWin = process.platform === 'win32';
    const killCmd = isWin
      ? `powershell -NoProfile -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force"`
      : `fuser -k ${PORT}/tcp`;
    console.error(`\n⚠️  [Puerto Ocupado] El puerto ${PORT} ya está siendo utilizado por otra instancia de Crastur.`);
    console.error(`💡 Para liberar el puerto puedes ejecutar: ${killCmd} o verificar si ya tienes otra terminal abierta.\n`);
    process.exit(1);
  }
  try {
    const errorLogPath = path.join(__dirname, '..', 'data', 'app_error.log');
    fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] ${err.stack || err.message}\n`);
  } catch (e) {}
  // [INTEGRIDAD] Antes de continuar tras un error no controlado, se intenta persistir el
  // estado en memoria para no perder ventas/apartados recientes.
  try { persistDB(); } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Protección Anti-Fallos] Promesa rechazada recuperada:', reason);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    const isWin = process.platform === 'win32';
    const killCmd = isWin
      ? `powershell -NoProfile -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force"`
      : `fuser -k ${PORT}/tcp`;
    console.error(`\n⚠️  [Puerto Ocupado] El puerto ${PORT} ya está siendo utilizado por otra instancia de Crastur.`);
    console.error(`💡 Para liberar el puerto puedes ejecutar: ${killCmd} o verificar si ya tienes otra terminal abierta.\n`);
    process.exit(1);
  } else {
    console.error('[Error de Servidor]', err.message);
  }
});

/** Espera a la BD con límite de tiempo para no dejar el proceso colgado para siempre. */
async function waitForDatabase(maxMs = 60000): Promise<boolean> {
  return Promise.race([
    whenReady().then(() => true),
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), maxMs);
      if (timer.unref) timer.unref();
    })
  ]);
}

/**
 * Arranca secuencialmente los subsistemas del backend una vez que la base de datos esté lista.
 */
async function startServer() {
  // Esperar a que SQLite WASM compile esquemas y verifique integridad.
  // [DIAGNÓSTICO] Si la inicialización falla, `whenReady()` nunca se resuelve: antes el
  // launcher esperaba 120 s sin explicación. Ahora se detecta y se informa con claridad.
  const dbReady = await waitForDatabase();
  if (!dbReady) {
    console.error('\n⚠️  [Arranque] La base de datos no terminó de inicializar en 60 segundos.');
    console.error('💡 Revisa data/crastur.db y data/app_error.log. Si el archivo está dañado,');
    console.error('   renómbralo y arranca de nuevo: el sistema restaurará el respaldo más reciente.\n');
    process.exit(1);
  }
  // [SEGURIDAD] Escuchar solo en localhost: el panel (chats, cédulas, teléfonos)
  // no queda expuesto a la red local ni a otros equipos.
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[Servidor Crastur] Escuchando en http://localhost:${PORT}`);
    // [MERCADO VENEZUELA] Iniciar sincronizador de tasa BCV en cascada
    initBCVService();
    // [BAILEYS v7 ESM] Iniciar socket y restaurar credenciales de sesión en disco
    startWhatsApp();
    // [APARTADOS Y RESERVAS 24H] Verificación periódica independiente de expiración de reservas (cada 2 minutos)
    const reservationInterval = setInterval(() => {
      try {
        cleanExpiredReservations();
      } catch (e) {}
    }, 2 * 60 * 1000);
    if (reservationInterval.unref) reservationInterval.unref();
  });
}

startServer();

export { app, server };
export default app;
