/**
 * @file context.ts
 * @description Contexto compartido por las secciones del router conversacional.
 * Evita pasar 8 parámetros sueltos a cada módulo y mantiene el orden de evaluación
 * idéntico al del enrutador original.
 */

export interface RouterContext {
  /** JID del chat. */
  jid: string;
  /** Texto original (sin normalizar). */
  text: string;
  /** Texto normalizado (minúsculas, sin tildes ni signos). */
  norm: string;
  /** Nombre público del cliente. */
  pushName: string;
  /** Fila de `chat_sessions`. */
  session: any;
  /** Configuración de la tienda. */
  settings: Record<string, string>;
  /** Tasa BCV efectiva. */
  tasa: number;
  /** Productos detectados una sola vez por mensaje (caché de búsqueda difusa). */
  productosDetectados: any[];
}

export default RouterContext;
