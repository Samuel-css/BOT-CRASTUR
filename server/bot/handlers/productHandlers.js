const { db } = require('../../database');
const { formatBs, formatRate } = require('../utils/formatters');

/**
 * Ficha detallada de un solo producto
 */
function handleSingleProductDetail(p, tasa, settings, session) {
  const precioUsd = parseFloat(p.precio_usd);
  const precioBs = precioUsd * tasa;
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);

  // Niveles Cashea
  const n1 = precioUsd * 0.40;
  const n2 = precioUsd * 0.30;
  const n3 = precioUsd * 0.20;

  let msg = `🛞🏍️ *${p.marca} - ${p.modelo}* ⚙️\n\n`;
  if (p.descripcion) {
    msg += `📝 *Detalles:* ${p.descripcion}\n`;
  }
  msg += `📂 *Categoría:* ${p.categoria}\n`;
  msg += `💵 *Precio Contado:* *$${precioUsd.toFixed(2)} USD* _(🔥 ¡Pregunta por tu **descuento especial en divisas** en efectivo! 🏷️)_\n`;
  msg += `🇻🇪 *Precio en Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n\n`;

  // REGLA CASHEA: Mínimo $25 USD
  if (precioUsd < 25) {
    msg += `💛 *Financiamiento con CASHEA en Tienda Física:*\n`;
    msg += `⚠️ _Cashea aplica exclusivamente para compras a partir de *$25.00 USD*._\n`;
    msg += `💡 Este producto cuesta *$${precioUsd.toFixed(2)} USD*. Si agregas otro repuesto, accesorio u otro producto (como aceite, bujía, una tripa o pegas) y sumas *$25 USD o más*, ¡puedes pagarlo en cuotas con Cashea directamente en nuestra tienda física! 🏬✨\n\n`;
  } else {
    msg += `💛 *Planes de Financiamiento con CASHEA en Tienda Física 🏬:*\n`;
    msg += `_(⚠️ El pago con Cashea se procesa directamente en caja al momento de retirar en nuestra tienda física)_\n`;
    msg += `• *Nivel 1 (Inicial 40%):* Inicial en tienda de *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) + ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n1) / cuotasCashea).toFixed(2)} USD*\n`;
    msg += `• *Nivel 2 (Inicial 30%):* Inicial en tienda de *$${n2.toFixed(2)} USD* (Bs. ${formatBs(n2 * tasa)}) + ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n2) / cuotasCashea).toFixed(2)} USD*\n`;
    msg += `• *Nivel 3+ (Inicial 20%):* Inicial en tienda de *$${n3.toFixed(2)} USD* (Bs. ${formatBs(n3 * tasa)}) + ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n3) / cuotasCashea).toFixed(2)} USD*\n\n`;
  }

  msg += `📦 *Disponibilidad:* ${p.stock > 0 ? '✅ Disponible para entrega inmediata en tienda y delivery' : '⚠️ Consultar disponibilidad'}\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `¿Qué deseas hacer con este producto?\n\n`;
  msg += `👉 Escribe *DELIVERY* para solicitar envío en moto a tu zona en Caracas 🛵.\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo sin costo por 24 horas y retirarlo en tienda 🏢.\n`;
  msg += `👉 Escribe *PAGO* para conocer formas de pago y descuento en divisas 💵.\n`;
  msg += `👉 Escribe *VENDEDOR* para hablar con un asesor de ventas 👨‍🔧.\n`;
  msg += `👉 Escribe *MENU* para volver al inicio.`;

  // Si tiene imagen asociada, enviamos payload estructurado con foto
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
function handleMultiProductResults(products, tasa, settings, session) {
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
    const n2 = totalUsd * 0.30;
    const n3 = totalUsd * 0.20;
    msg += `💛 *Financiamiento con CASHEA en Tienda Física 🏬:*\n`;
    msg += `_(Como tu pedido suma *$${totalUsd.toFixed(2)} USD* [mínimo $25], ¡calificas para pagar todo el combo en cuotas con Cashea al retirar en tienda!)_\n`;
    msg += `• *Nivel 1 (Inicial 40%):* Inicial en tienda de *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) + ${cuotasCashea} cuotas de *$${((totalUsd - n1) / cuotasCashea).toFixed(2)} USD*\n`;
    msg += `• *Nivel 2 (Inicial 30%):* Inicial en tienda de *$${n2.toFixed(2)} USD* (Bs. ${formatBs(n2 * tasa)}) + ${cuotasCashea} cuotas de *$${((totalUsd - n2) / cuotasCashea).toFixed(2)} USD*\n`;
    msg += `• *Nivel 3+ (Inicial 20%):* Inicial en tienda de *$${n3.toFixed(2)} USD* (Bs. ${formatBs(n3 * tasa)}) + ${cuotasCashea} cuotas de *$${((totalUsd - n3) / cuotasCashea).toFixed(2)} USD*\n`;
    msg += `⚠️ _Recuerda: El pago con Cashea se procesa directamente en caja al momento de retirar en nuestra tienda física con tu app Cashea._\n\n`;
  } else {
    msg += `💛 *Nota sobre Cashea:* Este pedido suma *$${totalUsd.toFixed(2)} USD*. Cashea requiere una compra mínima de *$25.00 USD*. Si agregas otro repuesto o producto para llegar a $25, ¡podrás pagarlo en cuotas con Cashea en tienda física! 🏬\n\n`;
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
