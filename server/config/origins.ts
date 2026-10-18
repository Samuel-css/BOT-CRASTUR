/**
 * @file origins.ts
 * @description Orígenes locales autorizados para HTTP y WebSocket.
 *
 * [SEGURIDAD] El panel escucha en 127.0.0.1:3333 y el modo desarrollo usa 5173.
 * Cualquier otro origen (una página web abierta en el mismo navegador) no debe poder
 * leer el Live Inbox ni ejecutar acciones destructivas.
 */

export const ALLOWED_ORIGINS = [
  'http://localhost:3333',
  'http://127.0.0.1:3333',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

/** True si el origen está autorizado. Un origen ausente (curl/scripts locales) se permite. */
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

export default { ALLOWED_ORIGINS, isAllowedOrigin };
