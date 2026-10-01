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

/**
 * Inicializa el servidor WebSocket montándolo sobre el servidor HTTP de Express.
 * Conecta los listeners del servicio de WhatsApp con el canal de difusión WebSocket.
 * 
 * @param server - Servidor HTTP nativo de Node.js donde se monta la ruta `/ws`
 * @returns Instancia configurada de WebSocketServer
 */
export function initWebSocket(server: Server): WebSocketServer {
  wssInstance = new WebSocketServer({ server, path: '/ws' });

  // Retransmitir cambios de estado del socket WhatsApp (QR, conexión, desconexión)
  subscribeStatusChange((statusData: WhatsAppStatusPayload) => {
    broadcast('whatsapp_status', statusData);
  });

  // Retransmitir mensajes entrantes y salientes en tiempo real para el Live Inbox
  subscribeLiveMessages((liveMsg: any) => {
    broadcast('live_chat_message', liveMsg);
  });

  // Enviar estado inicial inmediato al cliente web que acaba de abrir la interfaz
  wssInstance.on('connection', (ws: WebSocket) => {
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
