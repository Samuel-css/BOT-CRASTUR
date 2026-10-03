/**
 * @file whatsappService.ts
 * @description Punto de entrada y BARRIL del subsistema de WhatsApp. Conserva la API pública
 * histórica (11 símbolos) mientras delega en módulos especializados en `server/whatsapp/`:
 *   - whatsapp/baileysLoader.ts    → carga perezosa de Baileys v7 ESM.
 *   - whatsapp/socketState.ts      → hub de estado del socket y suscriptores.
 *   - whatsapp/messageParsing.ts   → desempaquetado y extracción de mensajes (puro).
 *   - whatsapp/sending.ts          → despacho de texto/imagen/documento/manual.
 *   - whatsapp/outboundQueue.ts    → cola estocástica saliente anti-baneo.
 *   - whatsapp/connection.ts       → ciclo de vida del socket (start/stop/logout/reset).
 *   - whatsapp/ingest.ts           → ingestión de eventos (historial + mensajes en vivo).
 *
 * [BAILEYS v7 ESM] La biblioteca es un módulo ESM puro cargado dinámicamente.
 * [ANTI-BANEO META 2025] Retardos humanos, presencia 'composing', ventana de 24h y opt-out.
 */

export {
  getStatus,
  subscribeStatusChange,
  subscribeLiveMessages
} from './whatsapp/socketState';

export {
  sendTextMessage,
  sendProductMessage,
  sendDocumentMessage,
  sendManualMessage
} from './whatsapp/sending';

export { enqueueOutboundMessage } from './whatsapp/outboundQueue';

export {
  startWhatsApp,
  stopWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  resumeWhatsAppReconnection,
  isWhatsAppReconnectionPaused
} from './whatsapp/connection';

import {
  getStatus,
  subscribeStatusChange,
  subscribeLiveMessages
} from './whatsapp/socketState';
import {
  sendTextMessage,
  sendProductMessage,
  sendDocumentMessage,
  sendManualMessage
} from './whatsapp/sending';
import { enqueueOutboundMessage } from './whatsapp/outboundQueue';
import {
  startWhatsApp,
  stopWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  resumeWhatsAppReconnection,
  isWhatsAppReconnectionPaused
} from './whatsapp/connection';
export default {
  startWhatsApp,
  stopWhatsApp,
  logoutWhatsApp,
  resetWhatsApp,
  getStatus,
  sendTextMessage,
  sendProductMessage,
  sendDocumentMessage,
  sendManualMessage,
  enqueueOutboundMessage,
  subscribeStatusChange,
  subscribeLiveMessages
};
