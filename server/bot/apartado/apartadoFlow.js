const { db, createReservation, recordMetric } = require('../../database');
const { searchProductsFuzzy } = require('../services/searchService');
const { formatBs, formatRate, formatVenezuelanPhone } = require('../utils/formatters');
const { normalizeText } = require('../utils/textUtils');

function initiateApartadoFlow(jid, text, norm, session, tasa, settings, pushName) {
  // 0. Si el cliente venía de cotizar un Combo / Carrito multi-producto y no especificó otro repuesto puntual
  if (session.ultimo_producto_nombre && session.ultimo_producto_nombre.startsWith('Combo (') && norm.length <= 15) {
    let comboItems = [];
    try {
      comboItems = JSON.parse(session.contexto_productos || '[]');
    } catch (e) {}

    if (Array.isArray(comboItems) && comboItems.length >= 2) {
      const comboTotalUsd = comboItems.reduce((sum, p) => sum + (parseFloat(p.precio_usd) || 0), 0);
      const metadata = {
        producto_id: comboItems[0].id,
        producto_nombre: session.ultimo_producto_nombre,
        precio_usd: comboTotalUsd,
        is_combo: true
      };

      db.prepare(`
        UPDATE chat_sessions
        SET step = 'apartado_pidiendo_nombre',
            apartado_metadata = ?
        WHERE jid = ?
      `).run(JSON.stringify(metadata), jid);

      let msg = `🛒 *Apartado de Combo por 24 Horas:* *${session.ultimo_producto_nombre}* ⏱️\n\n`;
      msg += `💵 Total Combo: *$${comboTotalUsd.toFixed(2)} USD* (Bs. ${formatBs(comboTotalUsd * tasa)})\n\n`;
      msg += `Con gusto te reservamos todos los repuestos del combo sin costo adicional por 24 horas continuas para retirarlos en nuestra tienda física en Caracas.\n\n`;
      msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
      return msg;
    }
  }

  let matchedProduct = null;

  // 1. Intentar buscar si especificó el producto en la frase (ej: "apartar pastillas corolla")
  const searchResults = searchProductsFuzzy(text);
  if (searchResults.length > 0) {
    matchedProduct = searchResults[0];
  } else if (session.ultimo_producto_id) {
    matchedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
  }

  if (!matchedProduct) {
    return `🚗 *Apartado de Repuesto por 24 Horas - Crastur* ⏱️\n\nCon gusto te apartamos el repuesto sin costo para que lo retires en tienda o te lo enviemos por delivery en Caracas.\n\nPor favor, escribe primero el nombre o modelo de la pieza que deseas apartar (por ejemplo: *"pastillas corolla"*, *"aceite 20w50"*, *"batería"*):`;
  }

  const prodNombre = `${matchedProduct.marca} - ${matchedProduct.modelo}`;
  const prodPrecioUsd = parseFloat(matchedProduct.precio_usd) || 0;

  const metadata = {
    producto_id: matchedProduct.id,
    producto_nombre: prodNombre,
    precio_usd: prodPrecioUsd
  };

  // Usar apartado_metadata separado para no contaminar contexto_productos
  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_nombre',
        ultimo_producto_id = ?,
        ultimo_producto_nombre = ?,
        apartado_metadata = ?
    WHERE jid = ?
  `).run(matchedProduct.id, prodNombre, JSON.stringify(metadata), jid);

  let msg = `🚗 *Apartado por 24 Horas:* *${prodNombre}* ⏱️\n\n`;
  msg += `💵 Precio: *$${prodPrecioUsd.toFixed(2)} USD* (Bs. ${formatBs(prodPrecioUsd * tasa)})\n\n`;
  msg += `Con gusto te reservamos esta pieza sin costo adicional por 24 horas continuas para retirarla en nuestra tienda física en Caracas o pedirla por delivery.\n\n`;
  msg += `Para generar tu comprobante de apartado oficial, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
  return msg;
}

function handleApartadoNombre(jid, text, session, tasa, settings) {
  const nombre = text.trim();
  // Requiere al menos nombre + apellido (un espacio) y mínimo 5 caracteres
  if (nombre.length < 5 || !nombre.includes(' ')) {
    return `Por favor, indícanos tu *Nombre y Apellido* completo para poder emitir el comprobante de apartado:\n_(Ejemplo: *Carlos Pérez*)_\n_(Escribe *cancelar* para salir)_`;
  }

  let metadata = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }
  metadata.nombre = nombre;

  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_cedula',
        apartado_metadata = ?
    WHERE jid = ?
  `).run(JSON.stringify(metadata), jid);

  let msg = `¡Gracias, *${nombre}*! 🪪\n\n`;
  msg += `Ahora por favor indícanos tu número de *Cédula de Identidad* (ejemplo: *V-18456789* o *E-84123456*):\n_(Escribe *cancelar* para salir)_`;
  return msg;
}

function handleApartadoCedula(jid, text, session, tasa, settings) {
  const cedula = text.trim().toUpperCase();
  if (cedula.length < 5) {
    return `Por favor, indícanos un número de cédula válido (ejemplo: *V-18456789*):\n_(Escribe *cancelar* para salir)_`;
  }

  let metadata = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }
  metadata.cedula = cedula;

  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_telefono',
        apartado_metadata = ?
    WHERE jid = ?
  `).run(JSON.stringify(metadata), jid);

  const isLid = jid.endsWith('@lid');
  let msg = `¡Perfecto! Cédula *${cedula}* registrada. 📞\n\n`;

  if (isLid) {
    msg += `Para avisarte cuando tu apartado esté listo para retirar en tienda, por favor indícanos tu *Número de Teléfono* (ejemplo: *0412 123 4567* o *0414 765 4321*):\n_(Escribe *cancelar* si deseas salir)_`;
  } else {
    const rawPhone = jid.split('@')[0];
    const phoneFormatted = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
    msg += `¿Deseas registrar este mismo número de WhatsApp (*${phoneFormatted}*) como tu teléfono de contacto para el retiro en tienda?\n\n`;
    msg += `👉 Responde *SÍ* para usar este número.\n`;
    msg += `👉 O escribe tu número de teléfono (ejemplo: *0412 123 4567*):`;
  }
  return msg;
}

function handleApartadoTelefono(jid, text, session, tasa, settings) {
  let metadata = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const norm = normalizeText(text);
  const isLid = jid.endsWith('@lid');
  const isAffirmative = norm === 'si' || norm === 'ok' || norm === 'este' || norm === 'este mismo' || norm === 'claro' || norm === 'dale';

  let telefono = null;

  if (isAffirmative) {
    if (isLid) {
      return `Para que el equipo de tienda pueda registrar tu apartado correctamente, por favor escribe tu número de teléfono de contacto (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* si deseas salir)_`;
    } else {
      const rawPhone = jid.split('@')[0];
      telefono = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
    }
  } else {
    const validated = formatVenezuelanPhone(text);
    if (!validated) {
      return `Por favor, indícanos un número de teléfono válido (por ejemplo: *0412 123 4567* o *0414 765 4321*):\n_(Escribe *cancelar* para salir)_`;
    }
    telefono = validated;
  }

  const nombre = metadata.nombre || session.push_name || 'Cliente';
  const cedula = metadata.cedula || 'V-00000000';
  const prodId = metadata.producto_id || session.ultimo_producto_id || null;
  const prodNombre = metadata.producto_nombre || session.ultimo_producto_nombre || 'Repuesto Automotriz';
  const precioUsd = parseFloat(metadata.precio_usd) || 0;
  const precioBs = precioUsd * tasa;

  // Crear la reserva en la base de datos con límite de 24 horas
  const reservation = createReservation({
    jid,
    nombre,
    cedula,
    telefono,
    producto_id: prodId,
    producto_nombre: prodNombre,
    precio_usd: precioUsd,
    precio_bs: precioBs
  });

  // Resetear el estado de la sesión (limpiar apartado_metadata)
  db.prepare(`
    UPDATE chat_sessions
    SET step = 'start',
        apartado_metadata = NULL
    WHERE jid = ?
  `).run(jid);

  recordMetric('apartado_creado', prodNombre, jid);

  // Calcular hora y fecha de vencimiento (24 horas continuas)
  const expiraDate = new Date(reservation.expira_en);
  const expiraHora = expiraDate.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let ticket = `✅ *¡APARTADO CONFIRMADO CON ÉXITO!* 🎟️🚗\n\n`;
  ticket += `Estimado/a *${nombre}*, tu repuesto ha sido apartado exclusivamente para ti:\n\n`;
  ticket += `📦 *Producto:* ${prodNombre}\n`;
  ticket += `💵 *Precio Contado:* *$${precioUsd.toFixed(2)} USD*\n`;
  ticket += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa BCV: ${formatRate(tasa)})_\n`;
  ticket += `🪪 *Cédula:* ${cedula}\n`;
  ticket += `📞 *Teléfono:* ${telefono}\n`;
  ticket += `⏳ *Tiempo de Reserva:* 24 HORAS continuas\n`;
  ticket += `⚠️ *Límite para retirar:* Hasta mañana a las *${expiraHora}*\n`;
  ticket += `_(Si no se retira dentro de las 24 horas, el sistema liberará automáticamente el apartado)_\n\n`;
  ticket += `━━━━━━━━━━━━━━━━━━━━━\n`;
  ticket += `🏢 *Punto de Retiro en Tienda Física:*\n`;
  ticket += `Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.\n\n`;
  ticket += `🗺️ *Enlace directo en Google Maps:*\n`;
  ticket += `https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA\n\n`;
  ticket += `🕒 *Horario de Atención:* Lunes a Sábado de *8:00 AM a 8:00 PM* (corrido).\n`;
  ticket += `🛵 *¿Prefieres delivery en Caracas?* Escribe *DELIVERY* o *VENDEDOR* y coordinamos el motorizado a tu taller o domicilio.\n\n`;
  ticket += `Presenta tu cédula en caja al llegar y ¡listo! ¡Te esperamos en Crastur! 🚘✨`;

  return ticket;
}

module.exports = {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
};
