/**
 * @file socketState.ts
 * @description HUB de estado compartido del socket de WhatsApp (singleton del proceso).
 * Centraliza el socket activo, el estado de conexión, el usuario, el QR y los
 * suscriptores (Live Inbox / dashboard). Todos los módulos de `whatsapp/` leen y
 * escriben aquí para mantener una única fuente de verdad.
 */

import type { WhatsAppConnectionStatus, WhatsAppStatusPayload } from '../types/whatsapp';

/** Socket activo de Baileys (null si no hay conexión). */
export let sock: any = null;
/** Estado actual de la conexión. */
export let connectionStatus: WhatsAppConnectionStatus = 'disconnected';
/** Código QR actual en formato Data URL (base64). */
export let currentQR: string | null = null;
/** Datos del usuario conectado (teléfono, nombre, JID). */
export let currentUser: any = null;

/** Suscriptores de cambios de estado (dashboard). */
export let statusChangeCallbacks: Array<(status: WhatsAppStatusPayload) => void> = [];
/** Suscriptores de mensajes en vivo (Live Inbox). */
export let liveMessageCallbacks: Array<(msg: any) => void> = [];

// ─── Seteadores (evitan "live bindings" frágiles entre módulos) ─────────────
export function setSock(value: any): void { sock = value; }
export function setConnectionStatus(value: WhatsAppConnectionStatus): void { connectionStatus = value; }
export function setCurrentQR(value: string | null): void { currentQR = value; }
export function setCurrentUser(value: any): void { currentUser = value; }

/**
 * Suscribe un callback a las actualizaciones de estado del socket de WhatsApp.
 * @returns Función para cancelar la suscripción (evita callbacks duplicados al reiniciar).
 */
export function subscribeStatusChange(cb: (status: WhatsAppStatusPayload) => void): () => void {
  statusChangeCallbacks.push(cb);
  cb({ status: connectionStatus, qr: currentQR, user: currentUser });
  return () => {
    statusChangeCallbacks = statusChangeCallbacks.filter(c => c !== cb);
  };
}

/**
 * Suscribe un callback a los mensajes en tiempo real para el Live Inbox.
 * @returns Función para cancelar la suscripción.
 */
export function subscribeLiveMessages(cb: (msg: any) => void): () => void {
  liveMessageCallbacks.push(cb);
  return () => {
    liveMessageCallbacks = liveMessageCallbacks.filter(c => c !== cb);
  };
}

/**
 * Emite el estado actual de la conexión a todos los observadores registrados.
 */
export function notifyStatusChange(): void {
  const payload: WhatsAppStatusPayload = {
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  };
  statusChangeCallbacks.forEach(cb => {
    try { cb(payload); } catch (e) { console.error('Error in status callback:', e); }
  });
}

/**
 * Emite un evento de mensaje entrante/saliente a todos los observadores del Live Inbox.
 */
export function notifyLiveMessage(msg: any): void {
  liveMessageCallbacks.forEach(cb => {
    try { cb(msg); } catch (e) { console.error('Error in message callback:', e); }
  });
}

/**
 * Obtiene el estado consolidado de la conexión actual.
 */
export function getStatus(): WhatsAppStatusPayload {
  return {
    status: connectionStatus,
    qr: currentQR,
    user: currentUser
  };
}
