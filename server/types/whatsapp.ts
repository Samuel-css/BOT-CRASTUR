/**
 * @file whatsapp.ts
 * @description Definiciones de tipos e interfaces para la conexión de Baileys,
 * la cola de salida anti-baneo y los eventos de estado del socket.
 * 
 * [BAILEYS v7 ESM]
 */

/**
 * Estados posibles del ciclo de vida de la conexión de WhatsApp.
 * - `disconnected`: Socket cerrado o no inicializado.
 * - `connecting`: Negociando handshake o cargando credenciales de autenticación.
 * - `qr_ready`: Código QR generado en base64 y listo para ser escaneado en el dashboard.
 * - `connected`: Sesión autenticada activamente y lista para recibir/enviar mensajes.
 */
export type WhatsAppConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_ready'
  | 'connected';

/**
 * Elemento de la cola de despacho saliente estocástica.
 * 
 * [ANTI-BANEO META 2025]
 * Usado para espaciar recordatorios de apartados y follow-ups con retardos humanos.
 */
export interface OutboundQueueItem {
  /** JID de WhatsApp del destinatario (ej. '584121234567@s.whatsapp.net') */
  jid: string;
  /** Texto plano del mensaje a enviar */
  text: string;
}

/**
 * Carga útil de sincronización de estado enviada vía WebSocket y endpoints REST.
 */
export interface WhatsAppStatusPayload {
  /** Estado de conexión actual del socket */
  status: WhatsAppConnectionStatus;
  /** Cadena Base64 Data URL del código QR actual (o null si ya está conectado/desconectado) */
  qr: string | null;
  /** Información de la cuenta vinculada (JID, teléfono, nombre) o null */
  user: {
    jid?: string;
    phone?: string;
    name?: string;
  } | null;
}
