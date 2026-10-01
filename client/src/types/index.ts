/**
 * ============================================================================
 * TIPOS MAESTROS DEL FRONTEND: ECOSISTEMA COMERCIAL CRASTUR
 * ============================================================================
 * Define las interfaces de datos compartidas en el dashboard administrativo React:
 * productos, proveedores, vendedores, apartados por 24 horas, tasa BCV,
 * estado del socket Baileys WhatsApp, Live Inbox y calculadora Cashea.
 * 
 * [MERCADO VENEZUELA] Modela inventarios en USD, conversiones dinámicas a Bs (BCV),
 * cálculos de cuotas quincenales Cashea y clientes con Cédula de Identidad venezolana.
 * [BAILEYS v7 ESM] Estados de socket y mensajería en tiempo real para el Live Inbox.
 */

/**
 * Representa un artículo en el catálogo de productos visualizado en el panel administrativo.
 */
export interface Product {
  /** Identificador único autoincremental en base de datos */
  id: number;
  /** Marca comercial del repuesto o fabricante */
  marca: string;
  /** Modelo, medida o compatibilidad técnica */
  modelo: string;
  /** Categoría comercial normalizada */
  categoria: 'Insumos Cauchera' | 'Repuestos Moto' | 'Accesorios Moto' | 'Combos & Kits' | 'Otros Productos' | string;
  /** Precio de venta referencial en USD */
  precio_usd: number;
  /** Especificaciones técnicas para el cliente o bot */
  descripcion?: string;
  /** URI o base64 de la imagen del producto */
  imagen_url?: string | null;
  /** Cantidad física disponible en tienda */
  stock: number;
  /** Estado de visibilidad y venta comercial (1 o true: activo) */
  activo: number | boolean;
  /** Fecha de registro */
  creado_en?: string;
  /** Precio calculado en Bolívares según la tasa vigente */
  precio_bs?: number;
  /** Monto de cuota inicial Cashea en USD */
  cashea_inicial_usd?: number;
  /** Monto de cuota inicial Cashea en Bs */
  cashea_inicial_bs?: number;
  /** Monto por cuota quincenal Cashea en USD */
  cashea_cuota_usd?: number;
  /** Monto por cuota quincenal Cashea en Bs */
  cashea_cuota_bs?: number;
}

/**
 * Aliado mayorista o proveedor de repuestos e insumos.
 */
export interface Supplier {
  /** Identificador único autoincremental */
  id: number;
  /** Razón social de la distribuidora */
  empresa: string;
  /** Nombre del contacto comercial directo */
  contacto_nombre?: string;
  /** Teléfono o WhatsApp de pedidos */
  telefono: string;
  /** Categorías o marcas abastecidas */
  categorias?: string;
  /** Días de entrega o despacho programado */
  dias_despacho?: string;
  /** Términos de pago y crédito comercial */
  condiciones_pago?: string;
  /** Notas internas de compras */
  notas?: string;
  /** Estado activo de la relación comercial */
  activo: number | boolean;
  /** Fecha de registro */
  creado_en?: string;
}

/**
 * Vendedor o asesor de mostrador de la tienda física.
 */
export interface Seller {
  /** Identificador único autoincremental */
  id: number;
  /** Nombre del asesor */
  nombre: string;
  /** Teléfono o WhatsApp de atención al cliente */
  telefono: string;
  /** Área asignada en tienda */
  departamento?: string;
  /** Estado activo para derivación de clientes desde el bot */
  activo: number | boolean;
}

/**
 * Ticket de apartado de producto con vigencia de 24 horas continuas.
 */
export interface Reservation {
  /** Identificador único del ticket */
  id: number;
  /** WhatsApp JID internacional del cliente */
  jid: string;
  /** Nombre completo del comprador */
  nombre: string;
  /** Cédula de Identidad venezolana (V, E o J) */
  cedula: string;
  /** Teléfono de contacto directo */
  telefono: string;
  /** ID del producto reservado (si aplica) */
  producto_id?: number | null;
  /** Nombre comercial del repuesto o kit apartado */
  producto_nombre: string;
  /** Precio congelado en Dólares (USD) */
  precio_usd: number;
  /** Precio fijado en Bolívares (Bs) a la tasa del momento */
  precio_bs: number;
  /** Timestamp Unix (ms) de creación */
  creado_en: number;
  /** Timestamp Unix (ms) de vencimiento (24 horas) */
  expira_en: number;
  /** Estado del ticket */
  estado: 'activo' | 'vencido' | 'entregado' | 'cancelado' | 'concretado';
  /** Indicador de si se envió la alerta de cortesía a las 22h */
  aviso_22h_enviado?: number;
}

/**
 * Mapa de configuración comercial y parámetros operativos de la tienda.
 */
export interface Settings {
  /** Nombre comercial del establecimiento */
  nombre_negocio?: string;
  /** Valor de la tasa oficial BCV */
  tasa_bcv?: string;
  /** Fecha o estado de última sincronización */
  fecha_tasa?: string;
  /** Indicador binario si prevalece la tasa personalizada manual */
  tasa_manual_activa?: string;
  /** Valor numérico de la tasa manual personalizada */
  tasa_personalizada?: string;
  /** Dirección física de la tienda en Caracas */
  direccion_tienda?: string;
  /** Enlace de ubicación en Google Maps */
  google_maps_url?: string;
  /** Porcentaje de inicial requerido en Cashea */
  cashea_inicial_pct?: string;
  /** Número de cuotas quincenales en Cashea */
  cashea_cuotas?: string;
  /** Texto explicativo de cómo comprar con Cashea en tienda */
  cashea_info?: string;
  /** Activar seguimiento comercial tras cotizar */
  insistencia_activa?: string;
  /** Minutos de espera antes del seguimiento comercial */
  insistencia_minutos?: string;
  /** Horarios de apertura y cierre de la tienda */
  horario_atencion?: string;
  /** Política de envíos y delivery en Caracas */
  politica_envios?: string;
  /** Métodos de pago aceptados */
  metodos_pago?: string;
  /** Plantilla de mensaje de seguimiento comercial */
  mensaje_insistencia?: string;
  /** Plantilla de mensaje de bienvenida */
  mensaje_bienvenida?: string;
  /** Interruptor de tienda cerrada / fuera de horario */
  fuera_horario_activo?: string;
  /** Mensaje automático para clientes cuando la tienda esté cerrada */
  mensaje_fuera_horario?: string;
  /** Pausa global de la intervención del bot */
  bot_pausado_global?: string;
  /** Zonas de delivery y tarifas personalizadas */
  zonas_delivery_custom?: string;
  [key: string]: string | undefined;
}

/**
 * Datos consolidados de la tasa de cambio para los encabezados y widgets.
 */
export interface BcvData {
  /** Tasa activa calculada utilizada para todas las conversiones */
  tasa_efectiva: number;
  /** Tasa capturada del Banco Central de Venezuela */
  tasa_bcv: number;
  /** Fecha de emisión reportada por el BCV */
  fecha_tasa: string;
  /** Indica si se está forzando una tasa personalizada manual */
  es_manual?: boolean;
}

/**
 * Estado en tiempo real del socket de WhatsApp Baileys v7.
 */
export interface WhatsAppStatus {
  /** Estado de conectividad */
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  /** Cadena de datos para renderizar el código QR (o null si está conectado) */
  qr: string | null;
  /** Datos del perfil de WhatsApp autenticado */
  user: {
    jid?: string;
    phone?: string;
    name?: string;
  } | null;
}

/**
 * Mensaje individual renderizado en la interfaz del Live Inbox.
 */
export interface ChatMessage {
  /** Identificador único autoincremental */
  id?: number;
  /** WhatsApp JID de la conversación */
  jid: string;
  /** Remitente del mensaje */
  remitente: 'cliente' | 'bot' | 'asesor';
  /** Texto legible del mensaje */
  contenido: string;
  /** Timestamp Unix (ms) del mensaje */
  timestamp: number;
  /** Nombre público de WhatsApp del cliente */
  pushName?: string;
}

/**
 * Sesión conversacional activa mostrada en la barra lateral del Live Inbox.
 */
export interface ChatSession {
  /** JID internacional del chat */
  jid: string;
  /** Nombre público de perfil de WhatsApp */
  push_name?: string;
  /** Paso en la máquina de estados del bot */
  step: 'start' | 'apartado_pidiendo_nombre' | 'apartado_pidiendo_cedula' | 'apartado_pidiendo_telefono' | 'menu_catalogo_pdf' | string;
  /** ID del último producto cotizado */
  ultimo_producto_id?: number | null;
  /** Nombre del último producto cotizado */
  ultimo_producto_nombre?: string | null;
  /** Timestamp Unix (ms) del mensaje más reciente */
  ultimo_mensaje_at: number;
  /** Bandera de seguimiento comercial enviado */
  seguimiento_enviado: number;
  /** Estado de pausa local del bot para este chat */
  bot_pausado: number;
  /** Nivel del usuario en Cashea (1 a 5) */
  nivel_cashea: 1 | 2 | 3 | 4 | 5;
  /** Teléfono de contacto registrado */
  telefono_contacto?: string | null;
  /** Bandera de no molestar */
  no_molestar?: number;
  /** Memoria contextual de productos cotizados */
  contexto_productos?: string | null;
  /** Memoria temporal del flujo de apartado */
  apartado_metadata?: string | null;
}

/**
 * Resultado estructurado del cálculo de cuotas e inicial de Cashea.
 */
export interface CasheaCalculation {
  /** Nivel de usuario en el programa Cashea */
  nivel: 1 | 2 | 3 | 4 | 5;
  /** Monto total de la compra en USD */
  totalUsd: number;
  /** Porcentaje de pago inicial requerido según el nivel */
  inicialPct: number;
  /** Monto de la inicial en USD */
  inicialUsd: number;
  /** Monto de la inicial convertido a Bolívares (tasa BCV) */
  inicialBs: number;
  /** Número de cuotas quincenales fijadas */
  cuotasCount: 3;
  /** Monto de cada cuota quincenal en USD */
  cuotaUsd: number;
  /** Monto de cada cuota quincenal convertido a Bolívares (tasa BCV) */
  cuotaBs: number;
  /** Valida si el monto total cumple con el monto mínimo de compra */
  cumpleMinimo: boolean;
}

/**
 * Contrato de carga útil para la importación y exportación de respaldos maestros en JSON.
 */
export interface MasterBackupPayload {
  /** Versión del esquema */
  version: string;
  /** Fecha ISO de generación */
  exportado_en: string;
  /** Total de productos exportados */
  total_productos: number;
  /** Total de proveedores exportados */
  total_proveedores: number;
  /** Total de asesores exportados */
  total_vendedores: number;
  /** Lista de productos */
  productos: Product[];
  /** Lista de proveedores */
  proveedores: Supplier[];
  /** Lista de vendedores */
  vendedores: Seller[];
  /** Mapa de configuración */
  configuracion: Record<string, string>;
}
