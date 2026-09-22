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
  msg += `💵 *Precio Contado:* *$${precioUsd.toFixed(2)} USD* _(🔥 ¡Descuento especial en divisas en efectivo! 🏷️)_\n`;
  msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  msg += `📦 *Disponibilidad:* ${p.stock > 0 ? '✅ Disponible para entrega inmediata' : '⚠️ Consultar stock'}\n\n`;

  // Cashea resumido y claro
  if (precioUsd < 25) {
    msg += `💛 *Cashea en Tienda Física:* Aplica desde *$25 USD*. (Si agregas otro producto y llegas a $25, ¡lo pagas en cuotas!).\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo 24h sin costo y retirar en tienda 🏢.\n`;
  msg += `👉 Escribe *DELIVERY* para cotizar envío en moto en Caracas 🛵.\n`;
  msg += `👉 Escribe *VENDEDOR* para hablar con un asesor humano 👨‍🔧.`;

  if (p.imagen_url && typeof p.imagen_url === 'string' && p.imagen_url.trim().length > 5) {
    return {
      text: msg,
      image: p.imagen_url.trim()
    };
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
    msg += `   💵 Precio: *$${precioUsd.toFixed(2)} USD* _(🔥 ¡Con descuento en divisas!)_\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n`;
    if (precioUsd < 25) {
      msg += `   💛 Cashea: Aplica a partir de $25 (¡agrega otro producto y paga en cuotas en tienda!)\n`;
    } else {
      msg += `   💛 Cashea en Tienda: Inicial *$${inicialUsd.toFixed(2)}* + ${cuotasCashea} cuotas de *$${cuotaUsd.toFixed(2)}*\n`;
    }
    msg += `   📦 Stock: ${p.stock > 0 ? '✅ En tienda' : '⚠️ Consultar'}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 *Opciones rápidas:*\n`;
  msg += `👉 Responde con el *número* (ej: *1*) para ver detalles y descuentos.\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo por 24 horas.\n`;
  msg += `👉 Escribe *VENDEDOR* si deseas consultar precio con descuento en divisas.`;

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

  if (selectedIndex >= 0 && selectedIndex >= products.length) {
    return `Solo encontré *${products.length}* resultado${products.length > 1 ? 's' : ''}. Escribe un número del *1* al *${products.length}* para ver los detalles, o consulta otro producto. 😊`;
  }

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
  msg += `🔥 *¡Descuento en Divisas!* Cuentas con precio especial pagando en efectivo en tienda física 🏷️\n\n`;

  if (totalUsd >= 25) {
    const n1 = totalUsd * 0.40;
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((totalUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda:* Requiere compra mínima de $25 (¡agrega otro producto para financiar en cuotas!).\n\n`;
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

module.exports = {
  handleSingleProductDetail,
  handleProductResults,
  handleMultiProductResults,
  handleContextualSelection
};
