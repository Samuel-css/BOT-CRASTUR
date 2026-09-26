const { formatRate } = require('../utils/formatters');

/**
 * Menú de bienvenida cálido, claro, humano y sin palabras raras
 */
function handleGreetingResponse(pushName, settings, tasa) {
  const tasaFormatted = formatRate(tasa);
  let msg = `¡Hola, *${pushName}*! 👋\n\n`;

  if (settings && String(settings.fuera_horario_activo) === '1') {
    const customNotice = settings.mensaje_fuera_horario;
    if (customNotice) {
      msg += `⏰ ${customNotice}\n\n`;
    } else {
      msg += `⏰ *Nota de Horario:* Nuestra tienda física se encuentra *cerrada* en este momento (Horario: ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'}).\n\n`;
    }
    msg += `💬 *¡Nuestro Asistente Virtual está 100% activo!* Puedes consultar precios, marcas y disponibilidad en cualquier momento:\n\n`;
  } else {
    msg += `${settings.mensaje_bienvenida || 'Te damos la bienvenida a *Crastur* 🛞🏍️📦\nTu tienda de insumos para caucheras, repuestos de moto y otros productos en Caracas con Cashea.'}\n\n`;
  }

  msg += `🇻🇪 *Tasa oficial BCV hoy:* *Bs. ${tasaFormatted} / USD*\n\n`;
  msg += `¿Qué estás buscando hoy? Puedes responder con el *número* o escribir directamente el producto:\n\n`;
  msg += `1️⃣ *Insumos Cauchera* 🛞\n_(Parches, pegas, válvulas, mechas para pinchazos, plomos de balanceo, tripas)_\n\n`;
  msg += `2️⃣ *Repuestos Moto* 🏍️\n_(Kits de arrastre, cadenas, pastillas y bandas de freno, bujías, repuestos de motor)_\n\n`;
  msg += `3️⃣ *Accesorios Moto* 🎽\n_(Puños, mallas porta-casco, retrovisores, luces LED, spray para cadena)_\n\n`;
  msg += `4️⃣ *Otros Productos* 📦\n_(Aceites de motor 4T/2T, refrigerantes para radiador, aditivos, bombillos, plumillas)_\n\n`;
  msg += `5️⃣ *Pagar con Cashea en la Tienda* 💛\n_(Llévate tus productos hoy pagando solo la inicial en compras desde $25)_\n\n`;
  msg += `6️⃣ *Hablar con un Asesor / Vendedor* 👨‍🔧\n_(Atención directa con nuestro equipo de ventas en tienda)_\n\n`;
  msg += `¡Escríbenos lo que necesitas y te damos precio y disponibilidad al instante! 🤝✨`;

  return msg;
}

/**
 * Cortesía y agradecimientos
 */
function handleCourtesyResponse(pushName, settings) {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  let msg = `¡A tu total orden, *${pushName}*! 😊\n\n`;
  msg += `Si necesitas consultar algún otro producto de moto, cauchera o apartar una pieza, estamos para servirte.\n\n`;
  msg += `🏢 *Tienda física:* ${direccion}\n`;
  msg += `🗺️ *Google Maps:* ${mapsUrl}\n`;
  const horario = settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';
  msg += `🕒 *Horario:* ${horario}.\n\n`;
  msg += `¡Que tengas un excelente día! 🛞🏍️✨`;
  return msg;
}

/**
 * Respuestas afirmativas cotidianas fuera de flujo ("sí", "ok", "dale", "claro")
 */
function handleAffirmativeResponse(pushName) {
  let msg = `¡Excelente, *${pushName}*! 👍\n\n`;
  msg += `¿Qué producto o repuesto te podemos cotizar hoy?\n\n`;
  msg += `👉 Escribe directamente el nombre (por ejemplo: *"parches"*, *"pega"*, *"valvulas"*, *"kit de arrastre"*, *"bujia"*, *"refrigerante"*).\n`;
  msg += `👉 O indícanos el modelo de tu moto para confirmarte disponibilidad de una vez.\n`;
  msg += `👉 Escribe *MENU* para ver todas las opciones o *VENDEDOR* para hablar con nuestro equipo.`;
  return msg;
}

/**
 * Respuestas negativas o de despedida ("no", "ya no", "nada")
 */
function handleNegativeResponse() {
  let msg = `¡Entendido! 👍\n\n`;
  msg += `Guarda nuestro contacto de *Crastur*. Cuando necesites insumos para tu cauchera, repuestos para tu moto o financiamiento con Cashea, escríbenos con toda confianza.\n\n`;
  msg += `¡Estamos a tu orden en Caracas de Lunes a Sábado de 8:00 AM a 8:00 PM! 🛞🏍️✨`;
  return msg;
}

module.exports = {
  handleGreetingResponse,
  handleCourtesyResponse,
  handleAffirmativeResponse,
  handleNegativeResponse
};
