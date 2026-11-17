/**
 * @file messages.ts
 * @description Centro único de textos del bot de Crastur.
 *
 * [REGLAS DE COPY]
 * - La primera línea responde la pregunta; no empieza con un párrafo de bienvenida.
 * - Máximo 5 líneas para respuestas informativas y 10 para el ticket de apartado.
 * - Una sola acción por mensaje (o dos opciones en una misma línea, nunca 4 CTA).
 * - El precio en dólares va primero; los bolívares aparecen en el detalle y el ticket.
 * - El tono es cercano y venezolano, pero sin sonar a robot ni a guion de call center.
 * - La bienvenida aclara que es un asistente virtual y ofrece pasar con una persona.
 */

import { formatBs, formatRate } from '../utils/formatters';
import { stockLabel } from '../utils/stock';
import { resolveCasheaPlan } from '../utils/cashea';

/** Límites de longitud que vigila la suite de pruebas. */
export const COPY_LIMITS = {
  /** Respuestas informativas normales. */
  infoChars: 560,
  infoLines: 9,
  /** Listas de productos (máximo 5 ítems). */
  listChars: 760,
  listLines: 12,
  /** Ticket de apartado. */
  ticketChars: 820,
  ticketLines: 10,
  /** Promedios del conjunto de consultas típicas. */
  averageChars: 320,
  averageLines: 7,
  /** Número máximo de productos visibles en una lista. */
  maxListItems: 5
} as const;

/** Cuenta caracteres y líneas de un texto. */
export function measureCopy(text: string): { chars: number; lines: number } {
  const clean = String(text || '');
  return { chars: clean.length, lines: clean ? clean.split('\n').length : 0 };
}

/** Extrae el texto de una respuesta del bot (string u objeto con `text`/`caption`). */
export function asText(value: any): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.text || value.caption || '';
  return '';
}

/** Une solo las partes que existen, sin dejar líneas vacías al final. */
export function compose(parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join('\n');
}

/** Precio en dólares con dos decimales. */
export function usd(value: number | string): string {
  return `$${(Number(value) || 0).toFixed(2)} USD`;
}

/** Precio en bolívares con separadores venezolanos. */
export function bs(value: number | string): string {
  return `Bs. ${formatBs(Number(value) || 0)}`;
}

/** Tasa BCV formateada. */
export function rateLabel(tasa: number | string): string {
  return `Bs. ${formatRate(tasa)} / USD`;
}

/** Primer nombre del cliente, sin apellidos ni valores vacíos. */
export function firstName(pushName: string): string {
  const clean = String(pushName || '').trim();
  if (!clean || clean === 'amigo/a') return 'amigo/a';
  return clean.split(/\s+/)[0];
}

/** Dirección corta para no repetir la dirección completa en cada mensaje. */
export function storeAddress(settings: Record<string, string>): string {
  return settings?.direccion_tienda || 'Edificio Liberalba, San Agustín Norte, Caracas';
}

/** Enlace de Google Maps. */
export function storeMaps(settings: Record<string, string>): string {
  return settings?.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
}

/** Horario configurado. */
export function storeHours(settings: Record<string, string>): string {
  return settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';
}

/** Línea de una sola acción para apartar. */
export function apartarLine(): string {
  return 'Responde *APARTAR* para reservarlo 24 h.';
}

/** Línea de una sola acción para pasar con una persona. */
export function asesorLine(): string {
  return 'Si prefieres, escribe *ASESOR* y te paso con una persona.';
}

/** Bienvenida: transparente (asistente virtual) y con una sola pregunta. */
export function buildWelcome(params: {
  pushName: string;
  settings: Record<string, string>;
  isClosed?: boolean;
  tasa?: number;
}): string {
  const { pushName, settings, isClosed, tasa } = params;
  const name = firstName(pushName);
  const custom = String(settings?.mensaje_bienvenida || '').trim();
  const rateLine = tasa ? `🇻🇪 Tasa BCV: ${rateLabel(tasa)}` : '';

  const intro = `¡Hola, ${name}! 👋 Soy el asistente virtual de Crastur 🤖`;

  if (isClosed) {
    const closedCustom = String(settings?.mensaje_fuera_horario || '').trim();
    const closedBody = closedCustom || [
      `⏰ La tienda está cerrada ahora. Te atendemos ${storeHours(settings)}.`,
      'Puedo darte precios y disponibilidad mientras tanto. Dime qué repuesto buscas.'
    ].join('\n');
    return compose([intro, closedBody, rateLine]);
  }

  const body = custom || 'Te ayudo con precios y disponibilidad al instante.';

  return compose([
    intro,
    body,
    rateLine,
    '1️⃣ Cauchera · 2️⃣ Repuestos · 3️⃣ Accesorios · 4️⃣ Aceites · 5️⃣ Cashea · 6️⃣ Asesor',
    'O dime qué repuesto buscas (ej: pastillas, aceite 20w50).'
  ]);
}

/** Mensaje corto cuando el cliente ya vio el menú y vuelve a saludar. */
export function buildShortGreeting(pushName: string): string {
  return `¡Hola de nuevo, ${firstName(pushName)}! 👋 Soy el asistente virtual de Crastur. Dime qué repuesto buscas y te doy precio al instante.`;
}

/** Identidad del bot: honesta, breve y con salida a una persona. */
export function buildBotIdentity(): string {
  return compose([
    'Sí, soy el asistente virtual de Crastur 🤖',
    'Puedo darte precios y disponibilidad al instante.',
    'Si prefieres hablar con una persona, escribe *ASESOR* y te paso.'
  ]);
}

/** Respuesta paciente para clientes mayores o poco familiarizados con el chat. */
export function buildPatientHelp(settings: Record<string, string>): string {
  return compose([
    'Con gusto te ayudo, con toda la paciencia 😊',
    `Soy el asistente virtual de Crastur, tienda física en ${storeAddress(settings)}.`,
    'Dime qué pieza necesitas con tus palabras o mándame una foto.',
    'Si prefieres una persona, escribe *ASESOR* o *HUMANO*.'
  ]);
}

/** De-escalación de quejas o desconfianza. */
export function buildComplaintResponse(settings: Record<string, string>): string {
  return compose([
    'Te ofrezco una disculpa por la molestia. En Crastur atendemos con seriedad y respeto.',
    `Somos tienda física en ${storeAddress(settings)}.`,
    'Si quieres, te paso con una persona para resolverlo: escribe *ASESOR*.'
  ]);
}

/** Métodos de pago, solo con los que la tienda tiene activos. */
export function buildPaymentMethods(settings: Record<string, string>, tasa: number): string {
  const raw = String(settings?.metodos_pago || '').trim();
  const low = raw.toLowerCase();
  const isNone = !raw || low === 'ninguno';

  if (isNone) {
    return compose([
      '💳 Estamos actualizando los métodos de pago.',
      'Si quieres, te paso con una persona para confirmarte cómo pagar.',
      'Escribe *VENDEDOR* o *ASESOR* y te ayudo.'
    ]);
  }

  const lines: string[] = ['💳 Aceptamos:'];
  const promos: string[] = [];
  if (low.includes('efectivo')) promos.push('Efectivo ($)');
  if (low.includes('binance')) promos.push('Binance Pay (USDT)');
  if (promos.length > 0) lines.push(`• ${promos.join(' y ')} → *Precio Promoción*`);
  if (low.includes('pago movil') || low.includes('pago móvil')) {
    lines.push(`• Pago Móvil → tasa BCV (${rateLabel(tasa)})`);
  }
  if (low.includes('transferencia') || low.includes('banesco') || low.includes('mercantil')) {
    lines.push('• Transferencia → tasa BCV');
  }
  if (low.includes('cashea')) lines.push('• Cashea → inicial + cuotas sin interés');
  if (low.includes('punto')) lines.push('• Punto de venta');
  if (lines.length === 1) lines.push(`• ${raw}`);
  lines.push('');
  lines.push('¿Qué producto quieres cotizar?');
  return compose(lines);
}

/** Respuesta puntual sobre Binance. */
export function buildBinance(tasa: number): string {
  return compose([
    'Sí, aceptamos Binance Pay (USDT) con *Precio Promoción*.',
    'Puedes pagar por correo, Pay ID o QR.',
    `La tasa BCV de hoy es ${rateLabel(tasa)}.`,
    '¿Qué producto quieres cotizar?'
  ]);
}

/** Respuesta sobre descuento en divisas. */
export function buildDiscount(tasa: number, settings: Record<string, string>): string {
  const cuotas = parseInt(String(settings?.cashea_cuotas || '3'), 10) || 3;
  return compose([
    'Sí: pagando en efectivo ($) o Binance Pay (USDT) tienes *Precio Promoción*.',
    `Pago Móvil y transferencia van a tasa BCV (${rateLabel(tasa)}).`,
    `Cashea: inicial + ${cuotas} cuotas quincenales sin interés.`,
    '¿Qué producto te interesa?'
  ]);
}

/** Respuesta sobre la tasa BCV. */
export function buildRate(tasa: number): string {
  return compose([
    `🇻🇪 Tasa BCV de hoy: *${rateLabel(tasa)}*`,
    'Todos los pagos en bolívares se calculan a esa tasa, sin recargo.',
    'Si pagas en efectivo ($) o Binance, tienes *Precio Promoción*.',
    '¿Qué repuesto buscas?'
  ]);
}

/** Delivery en Caracas. */
export function buildDelivery(params: {
  settings: Record<string, string>;
  zoneName?: string;
  zoneFare?: string;
  productName?: string;
  productPriceUsd?: number;
  tasa: number;
}): string {
  const { settings, zoneName, zoneFare, productName, productPriceUsd, tasa } = params;
  const lines = ['🛵 Sí, hacemos *Delivery* en moto a toda Caracas.'];
  if (productName && productPriceUsd !== undefined) {
    lines.push(`📦 ${productName} — ${usd(productPriceUsd)} (${bs(productPriceUsd * tasa)})`);
  }
  if (zoneName && zoneFare) {
    lines.push(`📍 ${zoneName}: ${zoneFare}`);
  } else {
    lines.push('Tarifas: $2 a $3 cerca del centro y $3 a $5 a otras zonas.');
  }
  lines.push(`🏢 Retiro gratis en tienda: ${storeAddress(settings)}.`);
  lines.push('¿A qué zona lo enviamos?');
  return compose(lines);
}

/** Retiro inmediato en tienda. */
export function buildPickup(settings: Record<string, string>): string {
  return compose([
    'Sí, puedes retirar hoy en tienda.',
    `📍 ${storeAddress(settings)}`,
    `🕒 ${storeHours(settings)}`,
    `🗺️ ${storeMaps(settings)}`,
    'Si quieres, te lo aparto 24 h para que lo retires sin apuro.'
  ]);
}

/** Ubicación física. */
export function buildLocation(settings: Record<string, string>): string {
  return compose([
    `📍 Somos tienda física en ${storeAddress(settings)}.`,
    `🗺️ Google Maps: ${storeMaps(settings)}`,
    `🕒 Horario: ${storeHours(settings)}`,
    'Si vienes, te recomiendo apartarlo antes para que lo tengas listo.'
  ]);
}

/** Horario de atención. */
export function buildHours(settings: Record<string, string>): string {
  return compose([
    `🕒 Horario: ${storeHours(settings)}.`,
    'Hacemos delivery en Caracas y retiro en tienda.',
    '¿Qué repuesto buscas?'
  ]);
}

/** Garantía y cambios. */
export function buildWarranty(): string {
  return compose([
    '🛡️ Todos nuestros repuestos son nuevos y tienen garantía contra defectos de fábrica.',
    'Si la pieza no le sirve a tu moto, la cambiamos en tienda con el empaque original.',
    '¿Qué modelo de moto tienes?'
  ]);
}

/** Guía de compra. */
export function buildHowToBuy(): string {
  return compose([
    'Comprar es fácil:',
    '1. Dime qué repuesto buscas (ej: pastillas, aceite 20w50).',
    '2. Te doy precio y disponibilidad.',
    '3. Lo retiras en tienda o lo pides por delivery.',
    'Si quieres, te lo aparto 24 h sin costo.'
  ]);
}

/** Calidad y marcas. */
export function buildQuality(): string {
  return compose([
    '💯 Todos nuestros repuestos son nuevos y sellados de fábrica.',
    'Trabajamos con marcas reconocidas y damos garantía de calce.',
    'Dime el modelo de tu moto y te confirmo la pieza.'
  ]);
}

/** Instalación y talleres. */
export function buildInstallation(): string {
  return compose([
    'Somos tienda de repuestos; no tenemos taller en el local.',
    'Si quieres, te enviamos la pieza por delivery directo a tu mecánico.',
    'También podemos recomendarte talleres aliados en Caracas.',
    '¿Qué repuesto necesitas?'
  ]);
}

/** Consulta sobre repuestos de carro. */
export function buildCarInquiry(): string {
  return compose([
    'En Crastur vendemos insumos de cauchera, repuestos y accesorios para motos, y aceites.',
    'No vendemos piezas internas pesadas de carro.',
    'Si buscas aceite, refrigerante o bombillo, con gusto te ayudo.'
  ]);
}

/** Compras al mayor. */
export function buildWholesale(): string {
  return compose([
    'Sí, atendemos caucheras, talleres y comercios.',
    'Dime qué insumo necesitas y cuántas unidades, y te preparo la cotización.',
    'Si prefieres, te paso con un asesor.'
  ]);
}

/** Facturación y cotizaciones. */
export function buildInvoicing(): string {
  return compose([
    'Sí, entregamos nota de entrega y factura con tu compra.',
    'Si necesitas una cotización formal, te la preparo.',
    'Dime qué productos necesitas.'
  ]);
}

/** Redes sociales. */
export function buildSocial(pushName: string, settings: Record<string, string>): string {
  const instagram = String(settings?.instagram_url || '').trim();
  const lines = [`📸 ¡Claro, ${firstName(pushName)}! Publicamos combos y novedades en Instagram.`];
  if (instagram) lines.push(instagram);
  lines.push('Si viste un combo, dime cuál y te doy el precio exacto.');
  return compose(lines);
}

/** Disponibilidad general. */
export function buildAvailability(): string {
  return compose([
    '📦 Tenemos inventario disponible para entrega hoy.',
    'Dime el producto o el modelo de tu moto y te confirmo.',
    'Si quieres, te lo aparto 24 h sin costo.'
  ]);
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'Insumos Cauchera': '🛞',
  'Repuestos Moto': '🏍️',
  'Accesorios Moto': '🪖',
  'Otros Productos': '📦'
};

/** Lista de una categoría: máximo 5 productos, una línea por producto. */
export function buildCategoryList(params: {
  categoryName: string;
  products: any[];
  settings: Record<string, string>;
  maxItems?: number;
}): string {
  const { categoryName, products, maxItems = COPY_LIMITS.maxListItems } = params;
  const emoji = CATEGORY_EMOJIS[categoryName] || '📦';
  const total = products.length;

  if (total === 0) {
    return compose([
      `${emoji} *${categoryName}*`,
      'Estamos actualizando el inventario de esta categoría.',
      'Dime qué repuesto específico buscas y te confirmo existencia.',
      'Si prefieres, escribe *ASESOR* y te paso con una persona.'
    ]);
  }

  const visible = products.slice(0, maxItems);
  const lines = [`${emoji} *${categoryName}* — ${total} producto${total === 1 ? '' : 's'}`];
  visible.forEach((p: any, index: number) => {
    const price = Number(p.precio_usd) || 0;
    lines.push(`${index + 1}. ${p.marca} ${p.modelo} — ${usd(price)}`);
  });
  const extra = total > visible.length ? ` Hay ${total - visible.length} más.` : '';
  lines.push(`Responde *1-${visible.length}* para ver ficha.${extra}`);
  lines.push('PDF = catálogo completo · ASESOR = persona');
  return compose(lines);
}

/** Lista de resultados de búsqueda: máximo 5 productos, una línea por producto. */
export function buildProductSearch(params: {
  products: any[];
  settings: Record<string, string>;
  maxItems?: number;
}): string {
  const { products, settings, maxItems = COPY_LIMITS.maxListItems } = params;
  const nombreNegocio = settings?.nombre_negocio || 'Crastur';
  const visible = products.slice(0, maxItems);
  const total = products.length;

  const lines = [`🛞🏍️ *${nombreNegocio}*`];
  visible.forEach((p: any, index: number) => {
    const price = Number(p.precio_usd) || 0;
    lines.push(`${index + 1}. ${p.marca} ${p.modelo} — ${usd(price)}`);
  });
  const extra = total > visible.length ? ` Hay ${total - visible.length} más.` : '';
  lines.push(`Responde *1-${visible.length}* para ver ficha.${extra}`);
  lines.push('Si buscas otra cosa, dime el nombre o el modelo de tu moto.');
  return compose(lines);
}

/** Ficha individual de producto. */
export function buildProductDetail(params: {
  product: any;
  tasa: number;
  settings: Record<string, string>;
  session?: any;
  suggested?: any | null;
}): string {
  const { product, tasa, settings, session, suggested } = params;
  const price = Number(product.precio_usd) || 0;
  const plan = resolveCasheaPlan(settings, session);
  const inicial = price * plan.inicialPct;
  const cuota = plan.cuotas > 0 ? (price - inicial) / plan.cuotas : 0;

  const lines = [
    `*${product.marca} - ${product.modelo}*`,
    product.descripcion ? `📝 ${product.descripcion}` : '',
    `💵 *Precio Promoción:* ${usd(price)} (${bs(price * tasa)})`,
    `📦 Stock: ${stockLabel(product)}`
  ];

  if (price >= 25) {
    lines.push(`💛 Cashea: inicial ${usd(inicial)} + ${plan.cuotas} cuotas de ${usd(cuota)}.`);
  } else {
    lines.push('💛 Cashea: disponible desde $25.');
  }

  if (suggested) {
    const sPrice = Number(suggested.precio_usd) || 0;
    lines.push(`💡 También te puede servir: ${suggested.marca} ${suggested.modelo} — ${usd(sPrice)}.`);
    lines.push('Responde *1* para agregar el sugerido o *APARTAR* para reservar.');
  } else {
    lines.push(apartarLine());
  }

  return compose(lines);
}

/** Cotización de varios productos (carrito o combo). */
export function buildMultiProduct(params: {
  products: any[];
  tasa: number;
  settings: Record<string, string>;
  session?: any;
  zoneName?: string;
  zoneFare?: string;
  maxItems?: number;
}): string {
  const { products, tasa, settings, session, zoneName, zoneFare, maxItems = COPY_LIMITS.maxListItems } = params;
  const qtyOf = (p: any) => Math.max(1, Math.min(99, parseInt(p.cantidad, 10) || 1));
  const totalUsd = products.reduce((sum: number, p: any) => sum + (Number(p.precio_usd) || 0) * qtyOf(p), 0);
  const totalUnits = products.reduce((sum: number, p: any) => sum + qtyOf(p), 0);
  const plan = resolveCasheaPlan(settings, session);
  const visible = products.slice(0, maxItems);

  const lines = [`🛒 *Tu pedido* — ${products.length} artículo${products.length === 1 ? '' : 's'} · ${totalUnits} unidad${totalUnits === 1 ? '' : 'es'}`];
  visible.forEach((p: any, index: number) => {
    const qty = qtyOf(p);
    const subtotal = (Number(p.precio_usd) || 0) * qty;
    lines.push(`${index + 1}. ${p.marca} ${p.modelo}${qty > 1 ? ` x${qty}` : ''} — ${usd(subtotal)}`);
  });
  if (products.length > visible.length) {
    lines.push(`… y ${products.length - visible.length} más.`);
  }
  lines.push('');
  lines.push(`💵 *Total:* ${usd(totalUsd)} (${bs(totalUsd * tasa)} a tasa BCV)`);
  if (totalUsd >= 25) {
    const inicial = totalUsd * plan.inicialPct;
    const cuota = plan.cuotas > 0 ? (totalUsd - inicial) / plan.cuotas : 0;
    lines.push(`💛 Cashea: inicial ${usd(inicial)} + ${plan.cuotas} cuotas de ${usd(cuota)}.`);
  }
  if (zoneName && zoneFare) {
    lines.push(`🛵 Delivery a ${zoneName}: ${zoneFare}.`);
  }
  lines.push('');
  lines.push('Responde *APARTAR* para reservar el pedido 24 h.');
  lines.push('Si quieres cambiar algo, dime “quita el 2”.');
  return compose(lines);
}

/** Ficha de un combo de Instagram. */
export function buildComboDetail(params: {
  combo: any;
  tasa: number;
  settings: Record<string, string>;
}): string {
  const { combo, tasa, settings } = params;
  const price = Number(combo.precio_usd) || 0;
  const lines = [
    `🔥 *Combo: ${combo.marca} ${combo.modelo}*`,
    combo.descripcion ? `📝 ${combo.descripcion}` : '',
    `💵 *Precio Promoción:* ${usd(price)} (${bs(price * tasa)})`,
    `📦 Stock: ${stockLabel(combo, 'Disponible para entrega hoy')}`
  ];
  if (price >= 25) lines.push('💛 Cashea: inicial + cuotas sin interés.');
  lines.push('Responde *APARTAR* para reservarlo 24 h.');
  return compose(lines);
}

/** Lista de combos de Instagram. */
export function buildComboList(params: {
  combos: any[];
  settings: Record<string, string>;
  maxItems?: number;
}): string {
  const { combos, settings, maxItems = COPY_LIMITS.maxListItems } = params;
  const nombreNegocio = settings?.nombre_negocio || 'Crastur';
  const visible = combos.slice(0, maxItems);
  const lines = [`🔥 *Combos de Instagram - ${nombreNegocio}*`];
  visible.forEach((c: any, index: number) => {
    lines.push(`${index + 1}. ${c.marca} ${c.modelo} — ${usd(Number(c.precio_usd) || 0)}`);
  });
  lines.push('');
  lines.push(`Responde *1-${visible.length}* para ver el detalle.`);
  lines.push('Si viste otro combo en redes, dime cuál y te doy el precio.');
  return compose(lines);
}

/** Cashea general. */
export function buildCasheaGeneral(settings: Record<string, string>): string {
  const cuotas = parseInt(String(settings?.cashea_cuotas || '3'), 10) || 3;
  return compose([
    '💛 Cashea en tienda física:',
    '• Compra mínima: $25.',
    '• Nivel 1: 40% de inicial · Nivel 2: 30% · Nivel 3+: 20%.',
    `• El resto: ${cuotas} cuotas quincenales sin interés.`,
    'Se paga escaneando el QR en caja al retirar.',
    '¿Qué repuesto quieres calcular?'
  ]);
}

/** Cashea para un producto concreto. */
export function buildCasheaProduct(params: {
  product: any;
  tasa: number;
  settings: Record<string, string>;
  session?: any;
  nivel?: number | null;
}): string {
  const { product, tasa, settings, session, nivel } = params;
  const price = Number(product.precio_usd) || 0;
  const plan = resolveCasheaPlan(settings, session, nivel);
  const inicial = price * plan.inicialPct;
  const cuota = plan.cuotas > 0 ? (price - inicial) / plan.cuotas : 0;

  if (price < 25) {
    return compose([
      `💛 *${product.marca} ${product.modelo}* — ${usd(price)}`,
      'Cashea aplica desde $25 en tienda física.',
      '¿Quieres ver otra opción o te lo aparto igual?'
    ]);
  }

  return compose([
    `💛 *${product.marca} ${product.modelo}* — ${usd(price)}`,
    `Inicial (Nivel ${plan.nivel}, ${Math.round(plan.inicialPct * 100)}%): ${usd(inicial)} (${bs(inicial * tasa)})`,
    `${plan.cuotas} cuotas de ${usd(cuota)} (${bs(cuota * tasa)})`,
    'Se paga en tienda al retirar.',
    'Responde *APARTAR* para reservarlo 24 h.'
  ]);
}

/** Ticket de apartado, sin párrafo legal ni datos repetidos. */
export function buildTicket(params: {
  reservation: any;
  nombre: string;
  telefono: string;
  cedula: string;
  productName: string;
  priceUsd: number;
  tasa: number;
  settings: Record<string, string>;
  items?: any[];
  expiraEn?: number;
}): string {
  const { reservation, nombre, telefono, cedula, productName, priceUsd, tasa, settings, items, expiraEn } = params;
  const expira = new Date(expiraEn || reservation?.expira_en || Date.now() + 24 * 60 * 60 * 1000);
  const hora = expira.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
  const code = `#CRA-${String(reservation?.id || 0).padStart(4, '0')}`;

  const lines = [
    `✅ *Apartado ${code} confirmado*`,
    `📦 ${productName} — ${usd(priceUsd)} (${bs(priceUsd * tasa)})`
  ];

  if (items && items.length > 1) {
    const names = items.slice(0, 3).map((it: any) => it.nombre).filter(Boolean);
    const extra = items.length > names.length ? ` y ${items.length - names.length} más` : '';
    if (names.length > 0) lines.push(`📋 Incluye: ${names.join(' · ')}${extra}`);
  }

  lines.push(`🪪 ${cedula} · 📞 ${telefono}`);
  lines.push(`⏳ Tienes 24 HORAS: retíralo antes de mañana a las ${hora}`);
  lines.push(`🏢 ${storeAddress(settings)}`);
  lines.push(`🗺️ ${storeMaps(settings)}`);
  lines.push('Tus datos se usan solo para validar el apartado.');
  lines.push('Presenta tu cédula en caja. ¡Te esperamos!');
  return compose(lines);
}

/** Promesa al cliente cuando pide un asesor. */
export function buildHandoffClient(pushName: string, minutesLabel: string): string {
  return compose([
    `Listo, ${firstName(pushName)}. Ya avisé al equipo.`,
    `Un asesor te escribe por aquí en un máximo de ${minutesLabel}.`,
    'Si no quieres esperar, escribe *MENU* y te atiendo.'
  ]);
}

/** Promesa fuera de horario. */
export function buildHandoffOutside(pushName: string, hours: string): string {
  return compose([
    `Gracias por escribir, ${firstName(pushName)}. El equipo está fuera de horario.`,
    `Un asesor te escribe al abrir: ${hours}.`,
    'Mientras tanto, puedo darte precios y disponibilidad.',
    'Escribe *MENU* si quieres seguir conmigo.'
  ]);
}

/** Aviso cuando vence el plazo sin respuesta del asesor. */
export function buildHandoffExpiry(pushName: string): string {
  return compose([
    `${firstName(pushName)}, pasó el tiempo de espera y el asesor aún no se conecta.`,
    'Retomo la conversación para no dejarte esperando.',
    'Dime qué repuesto buscas o escribe *MENU*.'
  ]);
}

/** Seguimiento comercial por defecto. */
export function buildFollowUp(nombre: string, producto: string): string {
  return compose([
    `¿Cómo va todo, ${nombre || 'amigo/a'}? 👋`,
    `Quedó pendiente el *${producto}*. Si aún lo necesitas, te lo dejo listo en tienda.`,
    'Si prefieres una persona, escribe *VENDEDOR*.'
  ]);
}

export default {
  COPY_LIMITS,
  measureCopy,
  asText,
  compose,
  usd,
  bs,
  rateLabel,
  firstName,
  storeAddress,
  storeMaps,
  storeHours,
  apartarLine,
  asesorLine,
  buildWelcome,
  buildShortGreeting,
  buildBotIdentity,
  buildPatientHelp,
  buildComplaintResponse,
  buildPaymentMethods,
  buildBinance,
  buildDiscount,
  buildRate,
  buildDelivery,
  buildPickup,
  buildLocation,
  buildHours,
  buildWarranty,
  buildHowToBuy,
  buildQuality,
  buildInstallation,
  buildCarInquiry,
  buildWholesale,
  buildInvoicing,
  buildSocial,
  buildAvailability,
  buildCategoryList,
  buildProductSearch,
  buildProductDetail,
  buildMultiProduct,
  buildComboDetail,
  buildComboList,
  buildCasheaGeneral,
  buildCasheaProduct,
  buildTicket,
  buildHandoffClient,
  buildHandoffOutside,
  buildHandoffExpiry,
  buildFollowUp
};
