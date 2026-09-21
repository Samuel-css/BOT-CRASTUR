const { formatBs } = require('../utils/formatters');
const { searchProductsFuzzy } = require('../services/searchService');

/**
 * Cashea inteligente: detecta nivel y repuesto consultado en la misma frase
 */
function handleCasheaSmart(text, norm, settings, tasa, session) {
  let nivel = null;
  let inicialPct = 0.40;

  if (norm.includes('nivel 1') || norm.includes('nv 1') || norm.includes('primer nivel')) {
    nivel = 1;
    inicialPct = 0.40;
  } else if (norm.includes('nivel 2') || norm.includes('nv 2') || norm.includes('segundo nivel')) {
    nivel = 2;
    inicialPct = 0.30;
  } else if (norm.includes('nivel 3') || norm.includes('nv 3') || norm.includes('nivel 4') || norm.includes('nivel 5') || norm.includes('tercer nivel')) {
    nivel = 3;
    inicialPct = 0.20;
  }

  // Comprobar si menciona un repuesto en la misma consulta
  const products = searchProductsFuzzy(text);
  if (products.length > 0) {
    const prod = products[0];
    const precioUsd = parseFloat(prod.precio_usd);
    const cuotas = parseInt(settings.cashea_cuotas || '3', 10);
    const nivelNum = nivel || 1;
    const inicialUsd = precioUsd * inicialPct;
    const cuotaUsd = (precioUsd - inicialUsd) / cuotas;

    let msg = `💛 *Financiamiento con CASHEA en Tienda Física* 🏬🚗\n`;
    msg += `Repuesto: *${prod.marca} - ${prod.modelo}*\n`;
    msg += `💵 *Precio Contado:* *$${precioUsd.toFixed(2)} USD* (Bs. ${formatBs(precioUsd * tasa)})\n\n`;

    if (precioUsd < 25) {
      msg += `⚠️ *Nota sobre compra mínima Cashea:*\n`;
      msg += `El financiamiento con Cashea aplica exclusivamente para compras a partir de *$25.00 USD*.\n\n`;
      msg += `💡 *¿Cómo pagarlo con Cashea?*\n`;
      msg += `Esta pieza cuesta *$${precioUsd.toFixed(2)} USD*. Puedes agregar otro repuesto o accesorio (como aceite, bujías, filtros o aditivos) a tu pedido para sumar *$25 USD o más*. Al retirar en nuestra tienda física, ¡lo pagas financiado en cuotas con tu app Cashea! 🏬✨\n\n`;
    } else {
      msg += `📌 *Cálculo para tu Nivel ${nivelNum} (Inicial ${(inicialPct * 100).toFixed(0)}%):*\n`;
      msg += `• *Inicial a pagar en tienda:* *$${inicialUsd.toFixed(2)} USD* (Bs. ${formatBs(inicialUsd * tasa)})\n`;
      msg += `• *Restante:* *${cuotas} cuotas quincenales* de *$${cuotaUsd.toFixed(2)} USD* (Bs. ${formatBs(cuotaUsd * tasa)})\n\n`;
      msg += `⚠️ *Recuerda:* El financiamiento con Cashea se procesa directamente en nuestra tienda física escaneando el código QR en caja con tu app Cashea al momento del retiro.\n\n`;
    }

    msg += `📦 Te llevas tu repuesto de inmediato retirando en tienda.\n\n`;
    msg += `👉 Escribe *APARTAR* para reservarlo por 24 horas.\n`;
    msg += `👉 O escribe *VENDEDOR* para comunicarte con un asesor.`;

    if (prod.imagen_url && typeof prod.imagen_url === 'string' && prod.imagen_url.trim().length > 5) {
      return {
        text: msg,
        image: prod.imagen_url.trim()
      };
    }
    return msg;
  }

  return handleCasheaResponse(settings, tasa, session, nivel);
}

/**
 * Información general de Cashea con niveles
 */
function handleCasheaResponse(settings, tasa, session, nivelExplicit = null) {
  const cuotas = settings.cashea_cuotas || '3';
  let msg = `💛 *Financiamiento con CASHEA en Crastur (Tienda Física)* 🚗🏬\n\n`;
  msg += `¡Llévate hoy tus repuestos y accesorios pagando solo una inicial y el resto en cuotas quincenales sin interés!\n\n`;
  msg += `📌 *Condiciones y Niveles de Cashea:*\n`;
  msg += `• 🏷️ *Monto Mínimo:* Aplica para compras a partir de *$25.00 USD* (puedes combinar varios repuestos para llegar al monto).\n`;
  msg += `• *Nivel 1:* Pagas el *40%* de inicial en tienda física.\n`;
  msg += `• *Nivel 2:* Pagas el *30%* de inicial en tienda física.\n`;
  msg += `• *Nivel 3 o superior:* Pagas únicamente el *20%* de inicial en tienda física.\n`;
  msg += `• El resto lo pagas en *${cuotas} cuotas quincenales* a tasa 0% interés a través de tu app Cashea.\n\n`;
  msg += `⚠️ *Importante:* El pago con Cashea se realiza **directamente en nuestra tienda física** escaneando el código QR en caja con tu teléfono al momento de retirar tus repuestos.\n\n`;
  msg += `👉 Escribe el repuesto que deseas cotizar (ej: *"pastillas"*, *"aceite"*, *"batería"*).\n`;
  msg += `👉 O escribe *VENDEDOR* para que te asista un asesor en tu compra.`;

  return msg;
}

module.exports = {
  handleCasheaSmart,
  handleCasheaResponse
};
