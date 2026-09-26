const { db } = require('../../database');
const { formatBs, formatRate } = require('../utils/formatters');

/**
 * Ficha detallada de un solo producto
 */
function handleSingleProductDetail(p, tasa, settings, session) {
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

  // Cashea resumido y claro
  if (precioUsd < 25) {
    msg += `💛 *Cashea en Tienda Física:* Disponible para compras a partir de *$25 USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  }

  // Sugerencia rápida y natural de mostrador (Venta Cruzada directa en 1 línea)
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
    const wrapped = new String(msg);
    wrapped.text = msg;
    wrapped.image = p.imagen_url.trim();
    return wrapped;
  }

  return msg;
}

/**
 * Formatea fichas de productos encontrados
 */
function handleProductResults(products, tasa, settings, session) {
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const inicialPct = parseFloat(settings.cashea_inicial_pct || '40') / 100;

  const nombreNegocio = settings.nombre_negocio || 'Crastur';
  let msg = `🛞🏍️ *${nombreNegocio}* 📦\n\n`;

  products.forEach((p, idx) => {
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
  msg += `👉 Escribe *VENDEDOR* para precio al mayor o atención de asesor.`;

  return msg;
}

/**
 * Manejador de selección contextual ("el primero", "el 1", "la inicial")
 * SOLO actúa si contexto_productos es un ARRAY de resultados de búsqueda.
 */
function handleContextualSelection(norm, session, tasa, settings) {
  if (!session || !session.contexto_productos) return null;

  let products = [];
  try {
    const parsed = JSON.parse(session.contexto_productos);
    if (!Array.isArray(parsed)) return null;
    products = parsed;
  } catch (e) {
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

  // Si el índice solicitado no pertenece a la lista actual de productos en pantalla,
  // retornar null para permitir que el enrutador ejecute la opción de categoría o menú correspondiente.
  return null;
}

/**
 * Formatea cotización combinada para múltiples productos (Carrito/Combo)
 */
function handleMultiProductResults(products, tasa, settings, session, text = '') {
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const totalUsd = products.reduce((sum, p) => sum + (parseFloat(p.precio_usd) || 0), 0);
  const totalBs = totalUsd * tasa;

  let msg = `🛒 *Cotización de Combo / Carrito - Crastur* 🛞🏍️✨\n\n`;
  msg += `Has seleccionado *${products.length} productos*:\n\n`;

  products.forEach((p, idx) => {
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

  const { detectCaracasZone } = require('../utils/caracasDelivery');
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
 * Manejador especializado para consultas de Combos & Kits de Instagram
 */
function handleInstagramCombosResponse(text, tasa, settings, session, jid) {
  // Buscar combos registrados en base de datos
  const combos = db.prepare(`
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

  // Si hay exactamente 1 combo activo
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
      const wrapped = new String(msg);
      wrapped.text = msg;
      wrapped.image = c.imagen_url.trim();
      return wrapped;
    }
    return msg;
  }

  // Varios combos activos
  let msg = `🔥 *Combos & Kits Oficiales de Instagram - ${nombreNegocio}* 🛞📸\n\n`;
  msg += `Aquí tienes los combos vigentes publicados en nuestras redes sociales:\n\n`;

  combos.forEach((c, idx) => {
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

module.exports = {
  handleSingleProductDetail,
  handleProductResults,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
};
