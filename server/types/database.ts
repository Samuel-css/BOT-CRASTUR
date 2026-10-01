/**
 * ============================================================================
 * TIPOS Y MODELOS DE DATOS: BASE DE DATOS LOCAL SQLITE (SQL.JS WASM)
 * ============================================================================
 * Define las interfaces TypeScript correspondientes al esquema relacional de Crastur.
 * [ARQUITECTURA SQL.JS] La base de datos opera completamente en memoria mediante WebAssembly (WASM)
 * y se sincroniza en disco de forma atómica.
 * [MERCADO VENEZUELA] Modela inventarios en USD, conversiones dinámicas a Bs (BCV), clientes con C.I.,
 * reservas con ciclo de vida de 24 horas y sincronización con Cashea.
 */

/**
 * Representa un artículo en el inventario o catálogo comercial de Crastur.
 */
export interface Product {
  /** Identificador único autoincremental en SQLite */
  id: number;
  /** Marca comercial del producto o fabricante (ej: 'Bando', 'Kenda', 'Motul', 'Pirelli') */
  marca: string;
  /** Modelo, medida o descripción técnica específica (ej: 'Correa 842-20-30', 'Caucho 130/70-12') */
  modelo: string;
  /** Categoría comercial normalizada ('Repuestos Moto', 'Insumos Cauchera', 'Combos & Kits', etc.) */
  categoria: string;
  /** Precio de venta referencial en Dólares Estadounidenses (USD) */
  precio_usd: number;
  /** Especificaciones, compatibilidad o notas para el cliente y bot */
  descripcion?: string | null;
  /** Ruta local o URI pública de la imagen demostrativa del repuesto */
  imagen_url?: string | null;
  /** Cantidad física disponible en tienda para venta o apartado (decrementa al apartar) */
  stock?: number | null;
  /** Indicador binario de disponibilidad comercial (1: visible y vendible, 0: inactivo) */
  activo: number;
  /** Marca temporal ISO de creación del registro */
  creado_en?: string;
  /** Marca temporal ISO de última modificación */
  actualizado_en?: string;
}

/**
 * Representa a un aliado comercial o proveedor mayorista de repuestos e insumos.
 */
export interface Supplier {
  /** Identificador único autoincremental */
  id: number;
  /** Razón social o nombre comercial de la distribuidora/proveedor */
  empresa: string;
  /** Nombre del asesor o persona de contacto comercial directo */
  contacto_nombre?: string | null;
  /** Número de teléfono o WhatsApp para reposición de inventario */
  telefono: string;
  /** Rubros o marcas que suministra (ej: 'Cauchos, Tripas, Parches') */
  categorias?: string | null;
  /** Días programados de despacho o recepción de pedidos (ej: 'Martes y Jueves') */
  dias_despacho?: string | null;
  /** Términos crediticios o de cobranza acordados (ej: 'Crédito 15 días', 'Contado') */
  condiciones_pago?: string | null;
  /** Observaciones internas de compras */
  notas?: string | null;
  /** Estado de la relación comercial (1: proveedor activo, 0: inactivo) */
  activo: number;
  /** Fecha de registro en el sistema */
  creado_en?: string;
}

/**
 * Representa a un vendedor o asesor comercial de la tienda física Crastur.
 */
export interface Seller {
  /** Identificador único autoincremental */
  id: number;
  /** Nombre completo del asesor de ventas */
  nombre: string;
  /** Número de teléfono celular o WhatsApp asignado para atención al cliente */
  telefono: string;
  /** Área o turno dentro de la tienda (ej: 'Ventas Mostrador', 'Motos', 'Mayor') */
  departamento?: string | null;
  /** Estado del asesor en el sistema (1: activo y disponible para derivación, 0: inactivo) */
  activo: number;
  /** Fecha de alta en el sistema */
  creado_en?: string;
}

/**
 * Representa un apartado formal de producto por 24 horas continuas.
 * [MERCADO VENEZUELA] Congela precio en USD y monto en Bs calculado a la tasa oficial BCV del momento.
 */
export interface Reservation {
  /** Identificador único autoincremental del ticket de apartado */
  id: number;
  /** WhatsApp JID internacional del cliente (ej: '584121234567@s.whatsapp.net') */
  jid: string;
  /** Nombre y apellido suministrado por el cliente */
  nombre: string;
  /** Cédula de Identidad venezolana validada (ej: 'V-12345678', 'E-87654321', 'J-12345678-0') */
  cedula: string;
  /** Teléfono de contacto directo en formato nacional */
  telefono: string;
  /** ID del producto asociado en la tabla products (si aplica) */
  producto_id?: number | null;
  /** Denominación del producto o kit reservado */
  producto_nombre: string;
  /** Precio acordado congelado en Dólares (USD) */
  precio_usd: number;
  /** Precio fijado en Bolívares (Bs) a la tasa BCV del momento del apartado */
  precio_bs: number;
  /** Timestamp Unix (ms) de emisión de la reserva */
  creado_en: number;
  /** Timestamp Unix (ms) de vencimiento exacto (24 horas tras la creación) */
  expira_en: number;
  /** Estado de ciclo de vida del ticket */
  estado: 'activo' | 'entregado' | 'cancelado' | 'vencido';
  /** Bandera que indica si ya se despachó la alerta de cortesía a las 22h (1: enviada, 0: pendiente) */
  aviso_22h_enviado?: number;
}

/**
 * Sesión conversacional activa con un cliente en WhatsApp.
 * [ANTI-BANEO META 2025] Mantiene estado, pausas humanas, restricciones de no molestar y debouncing.
 */
export interface ChatSession {
  /** WhatsApp JID internacional único del chat */
  jid: string;
  /** Nombre de perfil público en WhatsApp o nombre identificado */
  push_name: string;
  /** Paso actual en la máquina de estados finita del bot */
  step: string;
  /** Timestamp Unix (ms) del último mensaje entrante */
  ultimo_mensaje_at: number;
  /** Bandera de insistencia comercial (1: seguimiento enviado, 0: no enviado) */
  seguimiento_enviado: number;
  /** Pausa local del bot para este chat (1: pausado por asesor humano, 0: atendido por bot) */
  bot_pausado: number;
  /** Nivel de usuario en el programa Cashea (1 a 5) para cálculo de inicial y cuotas */
  nivel_cashea?: number;
  /** Teléfono celular recopilado en flujos o reservas */
  telefono_contacto?: string | null;
  /** Memoria contextual temporal de los últimos productos consultados en formato JSON */
  contexto_productos?: string | null;
  /** Memoria transaccional temporal durante el flujo de creación de apartado */
  apartado_metadata?: string | null;
  /** Bandera de respeto al usuario ante peticiones de no contacto (1: silenciado para prospección comercial) */
  no_molestar?: number;
}

/**
 * Registro de un mensaje individual en el Live Inbox para auditoría y visualización.
 */
export interface ChatMessage {
  /** Identificador autoincremental */
  id: number;
  /** WhatsApp JID del chat al que pertenece */
  jid: string;
  /** Actor que originó el mensaje */
  remitente: 'cliente' | 'bot' | 'asesor';
  /** Texto legible del mensaje */
  contenido: string;
  /** Tipo de adjunto si incluye multimedia ('image', 'audio', 'document', etc.) */
  multimedia_tipo?: string | null;
  /** Enlace o URI local del archivo multimedia almacenado */
  multimedia_url?: string | null;
  /** Timestamp Unix (ms) del mensaje */
  timestamp: number;
}

/**
 * Respaldo maestro integral exportable e importable en formato JSON.
 * [PERSISTENCIA ATÓMICA] Permite clonar o migrar el catálogo comercial, proveedores y parámetros.
 */
export interface MasterSnapshot {
  /** Versión del esquema de respaldo maestro */
  version: '3.0';
  /** Fecha y hora ISO del momento de generación */
  exportado_en: string;
  /** Conteo total de productos exportados */
  total_productos: number;
  /** Conteo total de proveedores exportados */
  total_proveedores: number;
  /** Conteo total de vendedores/asesores exportados */
  total_vendedores: number;
  /** Colección íntegra de artículos del catálogo */
  productos: Product[];
  /** Colección íntegra de proveedores */
  proveedores: Supplier[];
  /** Colección de vendedores del equipo comercial */
  vendedores: Seller[];
  /** Diccionario de clave/valor con la parametrización de la tienda */
  configuracion: Record<string, string>;
}
