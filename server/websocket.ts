/**
 * @file websocket.ts
 * @description Servidor WebSocket para sincronización bidireccional en tiempo real
 * entre el backend del bot (Baileys/Live Inbox) y el panel administrativo React.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import {
  getStatus,
  subscribeStatusChange,
  subscribeLiveMessages
} from './whatsappService';
import { isBotGloballyPaused } from './database';
import type { WhatsAppStatusPayload } from './types/whatsapp';

/** Instancia singleton activa del servidor WebSocket */
let wssInstance: WebSocketServer | null = null;
/** Intervalo de heartbeat para detectar conexiones muertas */
let heartbeatInterval: any = null;
/** Función de limpieza de suscripciones del estado de WhatsApp */
let unsubscribeStatus: (() => void) | null = null;
/** Función de limpieza de suscripciones de mensajes en vivo */
let unsubscribeLive: (() => void) | null = null;

/**
 * Inicializa el servidor WebSocket montándolo sobre el servidor HTTP de Express.
 * Conecta los listeners del servicio de WhatsApp con el canal de difusión WebSocket.
 * Es idempotente: reinvocarlo cierra la instancia previa y limpia sus suscripciones.
 * 
 * @param server - Servidor HTTP nativo de Node.js donde se monta la ruta `/ws`
 * @returns Instancia configurada de WebSocketServer
 */
export function initWebSocket(server: Server): WebSocketServer {
  // [IDEMPOTENCIA] Si ya existía una instancia, se desmonta para no duplicar listeners ni broadcasts.
  if (wssInstance) {
    try { if (unsubscribeStatus) unsubscribeStatus(); } catch (_) {}
    try { if (unsubscribeLive) unsubscribeLive(); } catch (_) {}
    try { if (heartbeatInterval) clearInterval(heartbeatInterval); } catch (_) {}
    try { wssInstance.close(); } catch (_) {}
    wssInstance = null;
  }

  wssInstance = new WebSocketServer({ server, path: '/ws' });

  // Retransmitir cambios de estado del socket WhatsApp (QR, conexión, desconexión)
  unsubscribeStatus = subscribeStatusChange((statusData: WhatsAppStatusPayload) => {
    broadcast('whatsapp_status', statusData);
  });

  // Retransmitir mensajes entrantes y salientes en tiempo real para el Live Inbox
  unsubscribeLive = subscribeLiveMessages((liveMsg: any) => {
    broadcast('live_chat_message', liveMsg);
  });

  // Enviar estado inicial inmediato al cliente web que acaba de abrir la interfaz
  wssInstance.on('connection', (ws: WebSocket) => {
    (ws as any).isAlive = true;
    ws.on('pong', () => { (ws as any).isAlive = true; });
    ws.on('error', () => { try { ws.terminate(); } catch (_) {} });
    try {
      ws.send(JSON.stringify({
        type: 'whatsapp_status',
        data: getStatus()
      }));
      ws.send(JSON.stringify({
        type: 'bot_global_pause_changed',
        data: { bot_pausado_global: isBotGloballyPaused() }
      }));
    } catch (_) {}
  });

  // [INTEGRIDAD] Heartbeat: termina conexiones muertas para evitar fugas de clientes en `wss.clients`.
  heartbeatInterval = setInterval(() => {
    if (!wssInstance) return;
    wssInstance.clients.forEach((client: WebSocket) => {
      if ((client as any).isAlive === false) {
        try { client.terminate(); } catch (_) {}
        return;
      }
      (client as any).isAlive = false;
      try { client.ping(); } catch (_) {}
    });
  }, 30000);
  if (heartbeatInterval.unref) heartbeatInterval.unref();

  return wssInstance;
}

/**
 * Difunde un mensaje a todos los clientes web (navegadores) actualmente conectados.
 * 
 * @param type - Identificador del evento (ej. 'whatsapp_status', 'live_chat_message')
 * @param data - Datos serializables en JSON que acompañan al evento
 */
export function broadcast(type: string, data: any): void {
  if (!wssInstance) return;
  const payload = JSON.stringify({ type, data });
  wssInstance.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (_) {}
    }
  });
}
