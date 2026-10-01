/**
 * ============================================================================
 * CONTRATOS Y TIPOS: MOTOR CONVERSACIONAL DE WHATSAPP (BOT CRASTUR)
 * ============================================================================
 * Define las interfaces, estados de sesión y contextos utilizados por el árbol
 * de decisión, el enrutador de intenciones y los controladores especializados.
 * [BAILEYS v7 ESM] Tipado compatible con el pipeline asíncrono y streaming de Baileys.
 * [ANTI-BANEO META 2025] Estructura de contexto con banderas de respeto, no molestar y pausas humanas.
 */

/**
 * Pasos posibles de la máquina de estados finita (FSM) de la sesión conversacional.
 */
export type BotSessionStep =
  | 'start'
  | 'apartado_pidiendo_nombre'
  | 'apartado_pidiendo_cedula'
  | 'apartado_pidiendo_telefono'
  | 'menu_catalogo_pdf';

/**
 * Metadatos descriptivos de cargas multimedia entrantes analizadas por el bot.
 */
export interface BotMediaInfo {
  /** Indica si el mensaje recibido contiene archivos adjuntos o contenido visual/auditivo */
  isMedia: boolean;
  /** Categoría del archivo multimedia detectado */
  type?: 'image' | 'audio' | 'voice' | 'sticker' | 'video' | 'document';
  /** Texto que acompaña a la imagen o documento (caption) */
  caption?: string;
}

/**
 * Respuesta generada por los handlers del bot para su despacho a WhatsApp.
 * Puede ser una cadena de texto simple o un objeto enriquecido con adjuntos y documentos.
 */
export type BotResponse =
  | string
  | {
      /** Cuerpo del mensaje en texto plano con formato de WhatsApp (*negrita*, _cursiva_, etc.) */
      text?: string;
      /** Ruta local o URL de imagen a enviar */
      image?: string;
      /** Ruta local o URL de documento a enviar (ej: PDF de catálogo) */
      document?: string;
      /** Nombre con el que se mostrará el archivo al destinatario */
      fileName?: string;
      /** Pie de foto o descripción que acompaña a la imagen o documento */
      caption?: string;
      /** Tipo MIME del archivo (ej: 'application/pdf', 'image/jpeg') */
      mimetype?: string;
      /** Estructura alternativa para adjuntos de medios */
      media?: {
        path: string;
        mime: string;
        filename?: string;
      };
      [key: string]: any;
    };

/**
 * Contexto completo de ejecución inyectado a cada handler o regla de intención.
 * [ANTI-BANEO META 2025] Provee acceso a la tasa de cambio BCV, sesión persistida y ajustes comerciales.
 */
export interface BotContext {
  /** JID internacional del remitente de WhatsApp (ej: '584121234567@s.whatsapp.net') */
  jid: string;
  /** Mensaje original sin modificaciones ni recortes */
  rawText: string;
  /** Texto procesado y recortado (trim) */
  text: string;
  /** Texto normalizado: minúsculas, sin tildes ni caracteres especiales para coincidencia difusa */
  norm: string;
  /** Nombre público de WhatsApp del cliente */
  pushName: string;
  /** Información sobre adjuntos si el mensaje incluyó contenido multimedia */
  mediaInfo?: BotMediaInfo | null;
  /** Registro de sesión conversacional activa persistido en SQLite WASM */
  session: {
    jid: string;
    push_name: string;
    step: BotSessionStep;
    ultimo_mensaje_at: number;
    seguimiento_enviado: number;
    bot_pausado: number;
    nivel_cashea?: number;
    telefono_contacto?: string;
    contexto_productos?: string | null;
    apartado_metadata?: string | null;
    no_molestar?: number;
  };
  /** Diccionario de configuración operativa de la tienda en memoria */
  settings: Record<string, string>;
  /** Tasa de cambio oficial vigente en Bs/USD para cálculos inmediatos */
  tasa: number;
}

/**
 * Regla de intención con peso de prioridad y función de evaluación booleana.
 */
export interface IntentRule {
  /** Identificador único semántico de la regla */
  id: string;
  /** Nombre descriptivo para auditoría y métricas */
  name: string;
  /** Nivel de precedencia en el árbol de decisión (valores más altos evalúan primero) */
  priority: number;
  /** Función de evaluación rápida que determina si el contexto actual activa esta intención */
  matches: (ctx: BotContext) => boolean;
  /** Controlador ejecutable que construye la respuesta comercial */
  execute: (ctx: BotContext) => Promise<BotResponse> | BotResponse;
}
