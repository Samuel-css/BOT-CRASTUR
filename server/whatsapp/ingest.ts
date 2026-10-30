/**
 * @file ingest.ts
 * @description BARRIL de la ingestión de eventos de Baileys. La implementación está
 * dividida en `whatsapp/ingest/`:
 *   - state.ts    → buffers, cola de arranque, cancelación de respuestas y reset.
 *   - deliver.ts  → despacho de respuestas (última milla + anti-duplicado).
 *   - history.ts  → historial multi-dispositivo y detección de asesor.
 *   - live.ts     → mensajes en vivo, debounce, reactivación y catch-up nocturno.
 */

export { resetIngestState, bindBotReady } from './ingest/state';
export { flushPendingStartupMessages, deliverBotResponse } from './ingest/deliver';
export { registerHistoryHandler } from './ingest/history';
export { registerMessageHandler } from './ingest/live';
export { ingestState, cancelPendingBotResponses, CATCHUP_MAX_AGE_MS } from './ingest/state';
