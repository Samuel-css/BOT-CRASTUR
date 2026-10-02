/**
 * @file baileysLoader.ts
 * @description Carga perezosa (lazy-load) de los módulos ESM de Baileys v7.
 * Evita fallos de resolución CJS/ESM al iniciar el proceso Node.js y expone las
 * utilidades necesarias para crear el socket.
 */

let makeWASocket: any = null;
let DisconnectReason: any = null;
let useMultiFileAuthState: any = null;
let fetchLatestBaileysVersion: any = null;
let Browsers: any = null;
let baileysLoaded = false;

/**
 * Carga perezosa de los módulos ESM de Baileys v7.
 */
export async function loadBaileys(): Promise<void> {
  if (baileysLoaded) return;
  const baileys = await import('@whiskeysockets/baileys');
  makeWASocket = baileys.default ?? (baileys as any).makeWASocket;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  Browsers = baileys.Browsers;
  baileysLoaded = true;
}

export function getWASocket(): any { return makeWASocket; }
export function getDisconnectReason(): any { return DisconnectReason; }
export function getUseMultiFileAuthState(): any { return useMultiFileAuthState; }
export function getFetchLatestBaileysVersion(): any { return fetchLatestBaileysVersion; }
export function getBrowsers(): any { return Browsers; }
