/**
 * @file productHandlers.ts
 * @description Manejadores de respuestas de catálogo: ficha detallada de producto individual,
 * listado de resultados, selección contextual previa, combos de carrito y promociones de Instagram.
 */

import { db } from '../../database';
import { formatBs, formatRate } from '../utils/formatters';
import { detectCaracasZone } from '../utils/caracasDelivery';
import type { Product } from '../../types/database';
import type { BotResponse } from '../../types/bot';

/**
 * Genera la ficha detallada de un producto individual, incluyendo precio promocional en divisas,
 * equivalente en Bolívares (BCV), cuotas Cashea y venta cruzada inteligente.
 * 
 * @param p - Objeto producto de la base de datos
 * @param tasa - Tasa BCV oficial del día
 * @param settings - Configuración general
 * @param session - Sesión de chat actual
 * @returns Mensaje textual o respuesta estructurada con imagen
 */
function handleSingleProductDetail(
  p: any,
  tasa: number,
  settings: Record<string, string>,
  session: any
): BotResponse {
  const precioUsd = parseFloat(p.precio_usd);
  const precioBs = precioUsd * tasa;
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const n1 = precioUsd * 0.40;

  let msg = `🛞🏍️ *${p.marca} - ${p.modelo}*\n`;
  if (p.descripcion) {
    msg += `📝 ${p.descripcion}\n`;
  }
  msg += `💵 *Precio Promoción en Divisas:* *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance Pay 🪙)_\n`;
  msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  msg += `📦 *Disponibilidad:* ${p.stock > 0 ? '✅ Disponible para entrega inmediata' : '⚠️ Consultar stock'}\n\n`;

  // Esquema resumido de financiamiento Cashea
  if (precioUsd < 25) {
    msg += `💛 *Cashea en Tienda Física:* Disponible para compras a partir de *$25 USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  }

  // Sugerencia contextual de venta cruzada según la categoría del producto
  const normCat = (p.categoria || '').toLowerCase();
  const normMod = (p.modelo || '').toLowerCase();

  if (normMod.includes('arrastre') || normMod.includes('cadena') || normMod.includes('pinon') || normMod.includes('corona')) {
    msg += `💡 *Para el servicio:* ¿Te sumamos la grasa lubricante de cadena? 🛢️\n\n`;
  } else if (normMod.includes('pastilla') || normMod.includes('freno') || normMod.includes('banda')) {
    msg += `💡 *Para el servicio:* ¿Llevas la liga de freno (DOT 4) o tienes allá? 🛞\n\n`;
  } else if (normMod.includes('parche') || normMod.includes('mecha') || normCat.includes('cauchera')) {
    msg += `💡 *Para el taller:* ¿Cuentas con pega azul Tip Top o terraja para válvulas? 🔧\n\n`;
  } else if (normMod.includes('aceite') || normMod.includes('lubricante') || normCat.includes('otros')) {
    msg += `💡 *Para el cambio:* ¿Te agregamos la bujía para hacerle el servicio completo a la moto? 🏍️⚡\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo 24h sin costo y retirar en tienda 🏢.\n`;
  msg += `👉 Escribe *DELIVERY* para cotizar envío en moto en Caracas 🛵.\n`;
  msg += `👉 Escribe *VENDEDOR* para hablar con un asesor humano 👨‍🔧.`;

  if (p.imagen_url && typeof p.imagen_url === 'string' && p.imagen_url.trim().length > 5) {
    return { text: msg, image: p.imagen_url.trim() } as any;
  }

  return msg;
}

/**
 * Formatea un listado de múltiples productos coincidentes en la búsqueda difusa.
 * 
 * @param products - Lista de productos encontrados
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat actual
 * @returns Listado numerado con precios y opciones rápidas
 */
function handleProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any
): string {
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const inicialPct = parseFloat(settings.cashea_inicial_pct || '40') / 100;

  const nombreNegocio = settings.nombre_negocio || 'Crastur';
  let msg = `🛞🏍️ *${nombreNegocio}* 📦\n\n`;

  products.forEach((p: any, idx: number) => {
    const precioUsd = parseFloat(p.precio_usd);
    const precioBs = precioUsd * tasa;
    const inicialUsd = precioUsd * inicialPct;
    const cuotaUsd = (precioUsd - inicialUsd) / cuotasCashea;

    msg += `*${idx + 1}. ${p.marca} - ${p.modelo}* ⚙️\n`;
    if (p.descripcion) {
      msg += `   📝 ${p.descripcion}\n`;
    }
    msg += `   💵 Precio Promo Divisas: *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance)_\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n`;
    if (precioUsd < 25) {
      msg += `   💛 Cashea en Tienda: Disponible para compras a partir de $25 USD\n`;
    } else {
      msg += `   💛 Cashea en Tienda: Inicial *$${inicialUsd.toFixed(2)}* + ${cuotasCashea} cuotas de *$${cuotaUsd.toFixed(2)}*\n`;
    }
    msg += `   📦 Stock: ${p.stock > 0 ? '✅ En tienda' : '⚠️ Consultar'}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 *Opciones rápidas:*\n`;
  msg += `👉 Responde con el *número* (ej: *1*) para ver detalles y fotos.\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo por 24 horas.\n`;
  msg += `👉 Escribe *VENDEDOR* para atención personalizada de un asesor.`;

  return msg;
}

/**
 * Resuelve la selección contextual por posición o mención de un producto mostrado previamente en pantalla
 * (ej. "el primero", "el 1", "el segundo", "la inicial").
 * 
 * @param norm - Texto normalizado
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @returns Detalle del producto seleccionado o null si no corresponde
 */
function handleContextualSelection(
  norm: string,
  session: any,
  tasa: number,
  settings: Record<string, string>
): BotResponse | null {
  if (!session || !session.contexto_productos) return null;

  let products: any[] = [];
  try {
    const parsed = JSON.parse(session.contexto_productos);
    if (!Array.isArray(parsed)) return null;
    products = parsed;
  } catch (e: any) {
    return null;
  }

  if (products.length === 0) return null;

  let selectedIndex = -1;

  if (norm === '1' || norm === 'el 1' || norm === 'el primero' || norm === 'la opcion 1' || norm === 'primero') {
    selectedIndex = 0;
  } else if (norm === '2' || norm === 'el 2' || norm === 'el segundo' || norm === 'la opcion 2' || norm === 'segundo') {
    selectedIndex = 1;
  } else if (norm === '3' || norm === 'el 3' || norm === 'el tercero' || norm === 'la opcion 3' || norm === 'tercero') {
    selectedIndex = 2;
  } else if (norm === '4' || norm === 'el 4' || norm === 'el cuarto' || norm === 'la opcion 4') {
    selectedIndex = 3;
  } else if (norm.includes('la inicial') || norm.includes('cuanto es la inicial') || norm.includes('las cuotas')) {
    selectedIndex = 0;
  }

  if (selectedIndex >= 0 && selectedIndex < products.length) {
    const p = products[selectedIndex];
    const fullProd = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
    if (fullProd) {
      return handleSingleProductDetail(fullProd, tasa, settings, session);
    }
  }

  return null;
}

/**
 * Genera la cotización consolidada para múltiples repuestos solicitados simultáneamente (Carrito/Combo).
 * 
 * @param products - Array de productos que componen el carrito
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat
 * @param text - Texto original para detección de zona de delivery
 * @returns Resumen consolidado con subtotales, total general y cuotas Cashea
 */
function handleMultiProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any,
  text: string = ''
): string {
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const totalUsd = products.reduce((sum: number, p: any) => sum + (parseFloat(p.precio_usd) || 0), 0);
  const totalBs = totalUsd * tasa;

  let msg = `🛒 *Cotización de Combo / Carrito - Crastur* 🛞🏍️✨\n\n`;
  msg += `Has seleccionado *${products.length} productos*:\n\n`;

  products.forEach((p: any, idx: number) => {
    const precioUsd = parseFloat(p.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    msg += `${idx + 1}️⃣ *${p.marca} - ${p.modelo}*\n`;
    msg += `   💵 Subtotal: *$${precioUsd.toFixed(2)} USD* (Bs. ${formatBs(precioBs)})\n`;
    msg += `   📦 Stock: ${p.stock > 0 ? '✅ Disponible en tienda' : '⚠️ Consultar'}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 *Resumen Total del Pedido:*\n`;
  msg += `💵 *Total a Pagar:* *$${totalUsd.toFixed(2)} USD*\n`;
  msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(totalBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  msg += `🔥 *¡Precio Promoción en Divisas!* Aplica pagando en Efectivo ($) o Binance Pay (USDT) 🪙🏷️\n\n`;

  if (totalUsd >= 25) {
    const n1 = totalUsd * 0.40;
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((totalUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Disponible para compras a partir de *$25 USD*.\n\n`;
  }

  const detectedZone = text ? detectCaracasZone(text, settings) : null;
  if (detectedZone) {
    msg += `🛵 *Delivery estimado a ${detectedZone.nombre}:* *${detectedZone.tarifa}* (motorizado hoy mismo).\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe *APARTAR* para reservar este combo por 24 horas y retirarlo en tienda.\n`;
  msg += `👉 Escribe *DELIVERY* para solicitar envío en moto a tu zona en Caracas 🛵.\n`;
  msg += `👉 Escribe *VENDEDOR* para coordinar con un asesor de ventas.`;

  return msg;
}

/**
 * Atiende consultas sobre combos, promociones y kits promocionados en redes sociales (Instagram).
 * 
 * @param text - Texto de la consulta
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat
 * @param jid - JID destinatario
 * @returns Listado de combos vigentes o detalle individual
 */
function handleInstagramCombosResponse(
  text: string,
  tasa: number,
  settings: Record<string, string>,
  session: any,
  jid?: string
): BotResponse {
  const combos: any[] = db.prepare(`
    SELECT * FROM products 
    WHERE activo = 1 
      AND (categoria LIKE '%Combo%' OR categoria LIKE '%Kit%' OR modelo LIKE '%Combo%' OR modelo LIKE '%Kit%' OR descripcion LIKE '%combo%' OR descripcion LIKE '%kit%')
    ORDER BY id DESC
    LIMIT 6
  `).all();

  const nombreNegocio = settings.nombre_negocio || 'Crastur';

  if (!combos || combos.length === 0) {
    let msg = `🔥 *Combos & Promociones de Instagram - ${nombreNegocio}* 🛞🏍️📸\n\n`;
    msg += `¡Hola! Con gusto te atendemos con nuestras promociones publicadas en Instagram.\n\n`;
    msg += `📦 Armamos combos semanales para caucheras, talleres y cambios de aceite con **Precio Promoción en Divisas** (Efectivo / Binance Pay) y financiamiento Cashea.\n\n`;
    msg += `👉 ¿Qué repuesto, aceite o insumo viste en nuestras redes? Escríbenos o escribe *VENDEDOR* para darte el precio exacto del combo publicado.`;
    return msg;
  }

  if (combos.length === 1) {
    const c = combos[0];
    const precioUsd = parseFloat(c.precio_usd);
    const precioBs = precioUsd * tasa;
    let msg = `🔥 *Combo Promocional Oficial - ${c.marca} ${c.modelo}* 🛞📸\n\n`;
    if (c.descripcion) {
      msg += `📝 *Incluye:*\n${c.descripcion}\n\n`;
    }
    msg += `💵 *Precio Promoción en Divisas:* *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance Pay 🪙)_\n`;
    msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
    if (precioUsd >= 25) {
      msg += `💛 *Cashea en Tienda Física:* Disponible en cuotas quincenales sin interés.\n`;
    }
    msg += `📦 *Disponibilidad:* ${c.stock > 0 ? '✅ Disponible para entrega hoy' : '⚠️ Consultar stock'}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👉 Escribe *APARTAR* para reservarlo 24h sin costo y retirar en tienda física.\n`;
    msg += `👉 Escribe *DELIVERY* para cotizar envío en moto a tu ubicación en Caracas.\n`;
    msg += `👉 Escribe *VENDEDOR* para hablar con nuestro asesor.`;

    if (c.imagen_url && typeof c.imagen_url === 'string' && c.imagen_url.trim().length > 5) {
      return { text: msg, image: c.imagen_url.trim() } as any;
    }
    return msg;
  }

  let msg = `🔥 *Combos & Kits Oficiales de Instagram - ${nombreNegocio}* 🛞📸\n\n`;
  msg += `Aquí tienes los combos vigentes publicados en nuestras redes sociales:\n\n`;

  combos.forEach((c: any, idx: number) => {
    const precioUsd = parseFloat(c.precio_usd);
    const precioBs = precioUsd * tasa;
    msg += `*${idx + 1}️⃣ ${c.marca} - ${c.modelo}*\n`;
    if (c.descripcion) {
      msg += `   📝 ${c.descripcion}\n`;
    }
    msg += `   💵 Precio Promo: *$${precioUsd.toFixed(2)} USD* (Efectivo / Binance 🪙)\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe el *número del combo* (ej: *1*) para ver detalles y apartarlo.\n`;
  msg += `👉 Escribe *VENDEDOR* para armar un combo personalizado a tu medida.`;
  return msg;
}

export {
  handleSingleProductDetail,
  handleProductResults,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
};

export default {
  handleSingleProductDetail,
  handleProductResults,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
};
