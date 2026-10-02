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

import { whenReady, cleanExpiredReservations, purgeOldData } from './database';
import { initBCVService } from './bcvService';
import { startWhatsApp } from './whatsappService';
import { initWebSocket } from './websocket';
import apiRoutes from './routes';

const app = express();
const server = http.createServer(app);

// Inicializar capa de WebSockets para Live Inbox y streaming de eventos en tiempo real
initWebSocket(server);

// Middlewares estándar de Express para el procesamiento de solicitudes HTTP
// [SEGURIDAD] CORS restringido a orígenes locales (evita acceso remoto no autorizado)
const allowedOrigins = [
  'http://localhost:3333',
  'http://127.0.0.1:3333',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));
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

/**
 * Arranca secuencialmente los subsistemas del backend una vez que la base de datos esté lista.
 */
async function startServer() {
  // Esperar a que SQLite WASM compile esquemas y verifique integridad
  await whenReady();
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
