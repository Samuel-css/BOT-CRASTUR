const { db, createReservation, recordMetric } = require('../../database');
const { searchProductsFuzzy, searchMultipleProducts } = require('../services/searchService');
const { formatBs, formatRate, formatVenezuelanPhone } = require('../utils/formatters');
const { normalizeText } = require('../utils/textUtils');

/**
 * Detecta si el texto enviado por el usuario es una pregunta, solicitud de otro producto,
 * o comando de cancelación en lugar de un dato personal (Nombre o Cédula).
 */
function detectInterruption(text, norm) {
  if (
    norm === 'cancelar' ||
    norm === 'salir' ||
    norm === 'abortar' ||
    norm === 'ya no' ||
    norm === 'no quiero' ||
    norm === 'cancela' ||
    norm === 'cancelalo' ||
    norm.includes('cancel') ||
    norm.includes('ya no quiero') ||
    norm.includes('no quiero apartar') ||
    norm.includes('no voy a apartar') ||
    norm.includes('olvidalo') ||
    norm.includes('olvida eso') ||
    norm.includes('dejalo asi') ||
    norm.includes('dejarlo asi')
  ) {
    return { type: 'cancel' };
  }

  // Detección explícita de intención de agregar otro producto
  const wantsToAddProduct =
    norm.includes('agrega') ||
    norm.includes('tambien quiero') ||
    norm.includes('tambien la quiero') ||
    norm.includes('tambien el') ||
    norm.includes('y tambien') ||
    norm.includes('incluye') ||
    norm.includes('ponle') ||
    norm.includes('suma') ||
    norm.startsWith('y la ') ||
    norm.startsWith('y el ') ||
    norm.startsWith('y las ') ||
    norm.startsWith('y los ') ||
    norm.startsWith('y una ') ||
    norm.startsWith('y un ') ||
    norm.startsWith('y otro ') ||
    norm.startsWith('y otra ');

  // Detección de preguntas o consultas
  const isQuestion =
    text.includes('?') ||
    text.includes('¿') ||
    norm.startsWith('cuanto') ||
    norm.startsWith('donde') ||
    norm.startsWith('tienen') ||
    norm.startsWith('hay') ||
    norm.startsWith('que vale') ||
    norm.startsWith('cual') ||
    norm.startsWith('cuanto es') ||
    norm.includes('precio') ||
    norm.includes('total') ||
    norm.includes('cuesta') ||
    norm.includes('vale') ||
    norm.includes('delivery') ||
    norm.includes('envio') ||
    norm.includes('pago movil') ||
    norm.includes('punto') ||
    norm.includes('cashea') ||
    norm.includes('horario') ||
    norm.includes('ubicacion') ||
    norm.includes('direccion') ||
    norm.includes('vendedor') ||
    norm.includes('asesor');

  // Palabras comunes de repuestos e insumos de Crastur
  const productWords = [
    'bujia', 'aceite', 'pastilla', 'banda', 'freno', 'cadena', 'arrastre',
    'tripa', 'caucho', 'parche', 'pega', 'valvula', 'mecha', 'plomo',
    'pulpo', 'filtro', 'bateria', 'refrigerante', 'limpiador', 'aditivo',
    'corona', 'pinon', 'spray', 'manubrio', 'puno', 'luz', 'led'
  ];

  const mentionsProduct = productWords.some(w => norm.includes(w));

  if (wantsToAddProduct && mentionsProduct) {
    return { type: 'product_addition' };
  }

  if (isQuestion || mentionsProduct) {
    return { type: 'general_question' };
  }

  return null;
}

/**
 * Responde a una interrupción durante el flujo de apartado sin romper la reserva
 */
function handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, currentMetadata, stepPrompt) {
  if (interruption.type === 'cancel') {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    return `Operación de apartado cancelada 👍. Escribe *MENU* para volver al inicio o escribe el repuesto que buscas.`;
  }

  // Caso: Mencionó otro repuesto o combo adicional (ej: "Y la bujía también la quiero apartar")
  if (interruption.type === 'product_addition') {
    const multi = searchMultipleProducts(text);
    let newProducts = [];
    if (multi.length > 0) {
      newProducts = multi;
    } else {
      const single = searchProductsFuzzy(text);
      if (single.length > 0) newProducts = [single[0]];
    }

    if (newProducts.length > 0) {
      let existingItems = [];
      if (currentMetadata.items && Array.isArray(currentMetadata.items) && currentMetadata.items.length > 0) {
        existingItems = [...currentMetadata.items];
      } else if (currentMetadata.producto_id) {
        existingItems = [{
          id: currentMetadata.producto_id,
          nombre: currentMetadata.producto_nombre,
          precio_usd: parseFloat(currentMetadata.precio_usd) || 0
        }];
      }

      for (const np of newProducts) {
        if (!existingItems.some(it => it.id === np.id)) {
          existingItems.push({
            id: np.id,
            nombre: `${np.marca} - ${np.modelo}`,
            precio_usd: parseFloat(np.precio_usd) || 0
          });
        }
      }

      const totalUsd = existingItems.reduce((sum, it) => sum + (parseFloat(it.precio_usd) || 0), 0);
      const comboNombre = existingItems.length > 1
        ? `Combo: ${existingItems.map(it => it.nombre).join(' + ')}`
        : existingItems[0].nombre;

      const updatedMeta = {
        ...currentMetadata,
        is_combo: existingItems.length > 1,
        producto_id: existingItems[0].id,
        producto_nombre: comboNombre,
        precio_usd: totalUsd,
        items: existingItems
      };

      db.prepare(`
        UPDATE chat_sessions
        SET apartado_metadata = ?,
            ultimo_producto_nombre = ?,
            step = 'apartado_pidiendo_nombre'
        WHERE jid = ?
      `).run(JSON.stringify(updatedMeta), comboNombre, jid);

      let msg = `🛒 *¡Excelente! Agregamos los repuestos a tu pedido:* 🛞🏍️\n\n`;
      existingItems.forEach((it, idx) => {
        msg += `${idx + 1}️⃣ *${it.nombre}:* *$${parseFloat(it.precio_usd).toFixed(2)} USD* (Bs. ${formatBs(it.precio_usd * tasa)})\n`;
      });
      msg += `\n📊 *Total Combinado:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalUsd * tasa)})\n`;
      msg += `⏱️ Te guardamos este combo sin costo por 24 horas continuas.\n\n`;
      msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
      return msg;
    }
  }

  // Caso: Pregunta general (precio, total, delivery, horario, ubicación, formas de pago)
  let answer = '';
  if (norm.includes('delivery') || norm.includes('envio') || norm.includes('motorizado') || norm.includes('flete')) {
    const { detectCaracasZone } = require('../utils/caracasDelivery');
    const detectedZone = detectCaracasZone(text, settings);
    if (detectedZone) {
      answer = `🛵 *Delivery a ${detectedZone.nombre}:* *${detectedZone.tarifa}* con motorizado el mismo día.`;
    } else {
      answer = `🛵 *Delivery en Caracas:* San Agustín, Centro y zonas cercanas *$2 a $3 USD*. Otras zonas (Catia, Propatria, El Valle, Baruta, Petare) *$3 a $5 USD*.`;
    }
  } else if (norm.includes('total') || norm.includes('cuanto es en total') || norm.includes('cuanto seria todo') || norm.includes('cuanto es') || norm.includes('cuanto seria') || norm.includes('cuanto sale') || norm.includes('precio')) {
    const totalUsd = parseFloat(currentMetadata.precio_usd) || 0;
    const totalBs = totalUsd * tasa;
    let itemsDesc = '';
    if (currentMetadata.items && Array.isArray(currentMetadata.items) && currentMetadata.items.length > 1) {
      itemsDesc = currentMetadata.items.map((it, idx) => `   ${idx + 1}️⃣ ${it.nombre}: *$${parseFloat(it.precio_usd).toFixed(2)} USD*`).join('\n') + '\n';
    } else {
      itemsDesc = `   📦 ${currentMetadata.producto_nombre || 'Repuesto'}: *$${totalUsd.toFixed(2)} USD*\n`;
    }
    answer = `📊 *Resumen Actual de tu Pedido:* 🛞🏍️\n${itemsDesc}\n💵 *Total a Pagar:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalBs)} a tasa oficial BCV: ${formatRate(tasa)})\n🔥 _(¡Aprovecha precio especial con descuento pagando en efectivo en divisas!)_`;
  } else if (norm.includes('pago') || norm.includes('punto') || norm.includes('transferencia') || norm.includes('efectivo')) {
    answer = `💳 *Formas de Pago:* Efectivo en divisas (¡con descuento especial!), Pago Móvil o transferencia a tasa oficial BCV (Bs. ${formatRate(tasa)}), y Cashea en tienda física.`;
  } else if (norm.includes('donde') || norm.includes('ubicacion') || norm.includes('direccion')) {
    answer = `🏢 *Tienda física:* ${settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas'}.\n🗺️ *Maps:* ${settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA'}`;
  } else if (norm.includes('horario') || norm.includes('hora') || norm.includes('abren')) {
    answer = `🕒 *Horario:* ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'} (horario corrido).`;
  } else if (norm.includes('cashea')) {
    answer = `💛 *Cashea en Tienda:* Disponible a partir de $25 USD. Pagas la inicial al retirar y 3 cuotas quincenales a 0% interés.`;
  } else if (norm.includes('instala') || norm.includes('taller') || norm.includes('mecanico') || norm.includes('cambian') || norm.includes('cambio de aceite') || norm.includes('montan')) {
    answer = `🔧 *Venta de repuestos:* En Crastur somos tienda de venta de repuestos e insumos nuevos (no tenemos taller mecánico en el local). Te lo enviamos por delivery directo a tu mecánico o te recomendamos talleres aliados cercanos en Caracas.`;
  } else if (norm.includes('garantia') || norm.includes('cambio') || norm.includes('defectuoso') || norm.includes('no le sirve')) {
    answer = `🛡️ *Garantía:* Todos nuestros repuestos cuentan con garantía contra defectos de fábrica y garantía de calce (cambio inmediato en tienda con empaque original).`;
  } else if (norm.includes('tasa') || norm.includes('dolar') || norm.includes('bcv')) {
    answer = `🇻🇪 *Tasa BCV:* Calculamos todos los pagos a tasa oficial BCV del día (Bs. ${formatRate(tasa)} / USD).`;
  } else {
    answer = `Con gusto te aclaramos cualquier consulta.`;
  }

  return `${answer}\n\n━━━━━━━━━━━━━━━━━━━━━\n📌 _Para completar tu apartado por 24 horas:_\n${stepPrompt}`;
}

/**
 * Inicia el flujo de apartado (aporta producto o combo)
 */
function initiateApartadoFlow(jid, text, norm, session, tasa, settings, pushName) {
  // 1. Detectar si el usuario especificó múltiples productos directamente
  // ej: "apartar bujia y aceite", "quiero apartar la bujia y el aceite"
  const multiProducts = searchMultipleProducts(text);
  if (multiProducts.length >= 2) {
    const totalUsd = multiProducts.reduce((sum, p) => sum + (parseFloat(p.precio_usd) || 0), 0);
    const comboNombre = `Combo: ${multiProducts.map(p => `${p.marca} ${p.modelo}`).join(' + ')}`;
    const metadata = {
      is_combo: true,
      producto_id: multiProducts[0].id,
      producto_nombre: comboNombre,
      precio_usd: totalUsd,
      items: multiProducts.map(p => ({
        id: p.id,
        nombre: `${p.marca} ${p.modelo}`,
        precio_usd: p.precio_usd
      }))
    };

    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_nombre',
          ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          apartado_metadata = ?
      WHERE jid = ?
    `).run(multiProducts[0].id, comboNombre, JSON.stringify(metadata), jid);

    let msg = `🛒 *Apartado de Combo por 24 Horas:* *${comboNombre}* ⏱️\n\n`;
    multiProducts.forEach((p, idx) => {
      msg += `${idx + 1}️⃣ *${p.marca} - ${p.modelo}:* *$${parseFloat(p.precio_usd).toFixed(2)} USD* (Bs. ${formatBs(p.precio_usd * tasa)})\n`;
    });
    msg += `\n💵 *Total Combo:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalUsd * tasa)})\n`;
    msg += `Te reservamos todos los productos por 24 horas continuas sin costo para retirar en tienda física.\n\n`;
    msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
    return msg;
  }

  // 2. Comprobar si el usuario especificó un producto individual en este mensaje (ej: "apartar kit de arrastre")
  const searchResults = searchProductsFuzzy(text);
  const wantsBoth =
    norm.includes('ambos') ||
    norm.includes('ambas') ||
    norm.includes('los dos') ||
    norm.includes('las dos') ||
    norm.includes('los 2') ||
    norm.includes('las 2') ||
    norm.includes('las dos cosas') ||
    norm.includes('los dos repuestos');

  if (searchResults.length > 0 && !wantsBoth) {
    const matchedProduct = searchResults[0];
    const prodNombre = `${matchedProduct.marca} - ${matchedProduct.modelo}`;
    const prodPrecioUsd = parseFloat(matchedProduct.precio_usd) || 0;

    const metadata = {
      is_combo: false,
      producto_id: matchedProduct.id,
      producto_nombre: prodNombre,
      precio_usd: prodPrecioUsd,
      items: [{
        id: matchedProduct.id,
        nombre: prodNombre,
        precio_usd: prodPrecioUsd
      }]
    };

    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_nombre',
          ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          apartado_metadata = ?
      WHERE jid = ?
    `).run(matchedProduct.id, prodNombre, JSON.stringify(metadata), jid);

    let msg = `🛞🏍️ *Apartado por 24 Horas:* *${prodNombre}* ⏱️\n\n`;
    msg += `💵 *Precio Contado:* *$${prodPrecioUsd.toFixed(2)} USD* (Bs. ${formatBs(prodPrecioUsd * tasa)})\n\n`;
    msg += `Te reservamos esta pieza sin costo adicional por 24 horas continuas para retirarla en tienda física o pedirla por delivery en Caracas.\n\n`;
    msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
    return msg;
  }

  // 3. Si el cliente venía de cotizar un Combo o solicita "apartar ambos", "los dos", etc.
  let comboItems = [];
  try {
    comboItems = JSON.parse(session.contexto_productos || '[]');
  } catch (e) {}

  const isComboAlready = session.ultimo_producto_nombre && session.ultimo_producto_nombre.startsWith('Combo');

  if ((isComboAlready || wantsBoth) && Array.isArray(comboItems) && comboItems.length >= 2) {
    const selectedItems = wantsBoth ? comboItems.slice(0, 2) : comboItems;
    const comboTotalUsd = selectedItems.reduce((sum, p) => sum + (parseFloat(p.precio_usd) || 0), 0);
    const comboTitle = `Combo: ${selectedItems.map(p => `${p.marca} ${p.modelo}`).join(' + ')}`;
    const metadata = {
      is_combo: true,
      producto_id: selectedItems[0].id,
      producto_nombre: comboTitle,
      precio_usd: comboTotalUsd,
      items: selectedItems.map(p => ({
        id: p.id,
        nombre: `${p.marca} ${p.modelo}`,
        precio_usd: p.precio_usd
      }))
    };

    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_nombre',
          ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          apartado_metadata = ?
      WHERE jid = ?
    `).run(selectedItems[0].id, comboTitle, JSON.stringify(metadata), jid);

    let msg = `🛒 *Apartado de Combo por 24 Horas:* *${comboTitle}* ⏱️\n\n`;
    selectedItems.forEach((p, idx) => {
      msg += `${idx + 1}️⃣ *${p.marca} - ${p.modelo}:* *$${parseFloat(p.precio_usd).toFixed(2)} USD* (Bs. ${formatBs(p.precio_usd * tasa)})\n`;
    });
    msg += `\n💵 *Total Combo:* *$${comboTotalUsd.toFixed(2)} USD* (Bs. ${formatBs(comboTotalUsd * tasa)})\n`;
    msg += `Te reservamos todos los repuestos del combo por 24 horas continuas para retirarlos en tienda física.\n\n`;
    msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
    return msg;
  }

  // 4. Si no especificó producto en el texto ni venía de combo, usar el último producto en contexto
  let matchedProduct = null;
  if (session.ultimo_producto_id) {
    matchedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
  }

  if (!matchedProduct) {
    return `🛞🏍️ *Apartado sin costo por 24 Horas - Crastur* ⏱️\n\nCon gusto te apartamos tu repuesto o insumo para que lo retires en tienda o lo pidas por delivery en Caracas.\n\n¿Qué pieza o insumo deseas apartar? Escribe el nombre (por ejemplo: *"bujía bera"*, *"aceite 20w50"*, *"parches"* o *"combo de bujía y aceite"*):`;
  }

  const prodNombre = `${matchedProduct.marca} - ${matchedProduct.modelo}`;
  const prodPrecioUsd = parseFloat(matchedProduct.precio_usd) || 0;

  const metadata = {
    is_combo: false,
    producto_id: matchedProduct.id,
    producto_nombre: prodNombre,
    precio_usd: prodPrecioUsd,
    items: [{
      id: matchedProduct.id,
      nombre: prodNombre,
      precio_usd: prodPrecioUsd
    }]
  };

  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_nombre',
        ultimo_producto_id = ?,
        ultimo_producto_nombre = ?,
        apartado_metadata = ?
    WHERE jid = ?
  `).run(matchedProduct.id, prodNombre, JSON.stringify(metadata), jid);

  let msg = `🛞🏍️ *Apartado por 24 Horas:* *${prodNombre}* ⏱️\n\n`;
  msg += `💵 *Precio Contado:* *$${prodPrecioUsd.toFixed(2)} USD* (Bs. ${formatBs(prodPrecioUsd * tasa)})\n\n`;
  msg += `Te reservamos esta pieza sin costo adicional por 24 horas continuas para retirarla en tienda física o pedirla por delivery en Caracas.\n\n`;
  msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
  return msg;
}

/**
 * Valida y procesa el Nombre del Cliente
 */
function handleApartadoNombre(jid, text, session, tasa, settings) {
  const norm = normalizeText(text);

  let metadata = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const promptMsg = `Por favor, indícanos tu *Nombre y Apellido* completo para emitir el comprobante (ejemplo: *Carlos Pérez*):\n_(Escribe *cancelar* para salir)_`;

  // 1. Verificar si es una interrupción (pregunta, combo, cancelación)
  const interruption = detectInterruption(text, norm);
  if (interruption) {
    return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
  }

  let cleanNombre = text.trim()
    .replace(/^(?:mi nombre es|me llamo|yo soy|a nombre de)\s+/i, '')
    .trim();
  const normClean = normalizeText(cleanNombre);

  // 2. Validaciones estrictas de nombre de persona real
  const hasDigits = /\d/.test(cleanNombre);
  const hasSymbols = /[?!¿¡@#$%^&*()_+=<>{}[\]~;:]/.test(cleanNombre);
  const isValidChars = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\']+$/.test(cleanNombre);
  const words = cleanNombre.split(/\s+/).filter(w => w.length >= 2);

  // Palabras no permitidas como nombre propio (apodos, artículos iniciales, motos, slang)
  const invalidNameTokens = [
    'chamo', 'pana', 'mano', 'bro', 'amigo', 'cliente', 'moto', 'sbr', 'bera', 'empire',
    'horse', 'owen', 'mecanico', 'comprador', 'tienda', 'repuesto', 'repuestos'
  ];
  const containsInvalidToken = invalidNameTokens.some(tok => normClean.split(' ').includes(tok));
  const startsWithArticle = normClean.startsWith('el ') || normClean.startsWith('la ');

  if (hasDigits || hasSymbols || !isValidChars || words.length < 2 || cleanNombre.length < 5 || cleanNombre.length > 50 || containsInvalidToken || startsWithArticle) {
    return `Para que el apartado quede a tu nombre en caja, indícanos tu *Nombre y Apellido* completo (ejemplo: *Carlos Pérez*):\n_(Escribe *cancelar* si deseas salir)_`;
  }

  const nombre = cleanNombre;
  metadata.nombre = nombre;

  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_cedula',
        apartado_metadata = ?
    WHERE jid = ?
  `).run(JSON.stringify(metadata), jid);

  let msg = `¡Gracias, *${nombre}*! 🪪\n\n`;
  msg += `Ahora indícanos tu número de *Cédula de Identidad* (ejemplo: *V-18456789* o *28123456*):\n_(Escribe *cancelar* si deseas salir)_`;
  return msg;
}

/**
 * Valida y procesa la Cédula del Cliente
 */
function handleApartadoCedula(jid, text, session, tasa, settings) {
  const norm = normalizeText(text);

  let metadata = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const promptMsg = `Indícanos tu número de *Cédula de Identidad* (ejemplo: *V-18456789* o *28123456*):\n_(Escribe *cancelar* para salir)_`;

  // 1. Verificar si es una interrupción (pregunta, combo, cancelación)
  const interruption = detectInterruption(text, norm);
  if (interruption) {
    return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
  }

  // 2. Validación estricta de Cédula venezolana (tolerando prefijos conversacionales)
  let clean = text.toUpperCase().replace(/[\s\.\-]/g, '');
  clean = clean.replace(/^(?:MICEDULAES|MICEDULA|CEDULA:|CEDULA|CI:|CI|NUMERO:|NUMERO|DOCUMENTO:)/i, '');
  const match = clean.match(/^(?:([VE]))?(\d{6,9})$/);

  if (!match) {
    return `⚠️ Por favor ingresa un número de cédula válido para tu ticket (ejemplo: *V-18456789* o *28123456*):\n_(Escribe *cancelar* si deseas salir)_`;
  }

  const prefix = match[1] || 'V';
  const number = match[2];
  const cedula = `${prefix}-${number}`;

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
    msg += `Para avisarte cuando tu apartado esté listo para retirar en tienda, indícanos tu *Número de Teléfono* (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* si deseas salir)_`;
  } else {
    const rawPhone = jid.split('@')[0];
    const phoneFormatted = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
    msg += `¿Deseas registrar este mismo número de WhatsApp (*${phoneFormatted}*) como teléfono de contacto para el retiro en tienda?\n\n`;
    msg += `👉 Responde *SÍ* para usar este número.\n`;
    msg += `👉 O escribe tu número de teléfono (ejemplo: *0412 123 4567*):`;
  }
  return msg;
}

/**
 * Valida el Teléfono y emite el Comprobante Final de Apartado por 24 Horas
 */
function handleApartadoTelefono(jid, text, session, tasa, settings) {
  let metadata = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const norm = normalizeText(text);
  if (
    norm === 'cancelar' ||
    norm === 'salir' ||
    norm === 'abortar' ||
    norm === 'cancela' ||
    norm.includes('cancel') ||
    norm.includes('ya no quiero') ||
    norm.includes('no voy a apartar') ||
    norm.includes('olvidalo') ||
    norm.includes('dejalo asi')
  ) {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    return `Operación cancelada 👍. Escribe *MENU* para volver al inicio o escribe el repuesto que buscas.`;
  }

  const isLid = jid.endsWith('@lid');
  const isAffirmative = norm === 'si' || norm === 'ok' || norm === 'este' || norm === 'este mismo' || norm === 'claro' || norm === 'dale';

  if (!isAffirmative) {
    const promptMsg = isLid
      ? `Indícanos tu *Número de Teléfono* de contacto (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* para salir)_`
      : `Responde *SÍ* para usar tu número actual o escribe tu teléfono (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* para salir)_`;

    const interruption = detectInterruption(text, norm);
    if (interruption) {
      return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
    }
  }

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
  const prodNombre = metadata.producto_nombre || session.ultimo_producto_nombre || 'Insumo / Repuesto Crastur';
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

  // Resetear el estado de la sesión
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

  let ticket = `✅ *¡APARTADO CONFIRMADO CON ÉXITO!* 🎟️🛞🏍️\n\n`;
  ticket += `Estimado/a *${nombre}*, tu apartado ha sido guardado exclusivamente para ti:\n\n`;
  ticket += `📦 *Producto:* ${prodNombre}\n`;

  if (metadata.items && Array.isArray(metadata.items) && metadata.items.length > 1) {
    ticket += `📋 *Detalle del Combo:*\n`;
    metadata.items.forEach((it, idx) => {
      ticket += `   ${idx + 1}️⃣ ${it.nombre} ($${parseFloat(it.precio_usd).toFixed(2)})\n`;
    });
  }

  ticket += `💵 *Precio Contado:* *$${precioUsd.toFixed(2)} USD*\n`;
  ticket += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  ticket += `🪪 *Cédula:* ${cedula}\n`;
  ticket += `📞 *Teléfono:* ${telefono}\n`;
  ticket += `⏳ *Tiempo de Reserva:* 24 HORAS continuas\n`;
  ticket += `⚠️ *Límite para retirar:* Hasta mañana a las *${expiraHora}*\n`;
  ticket += `_(Si no se retira en 24 horas, el sistema liberará el stock automáticamente)_\n\n`;
  ticket += `━━━━━━━━━━━━━━━━━━━━━\n`;
  ticket += `🏢 *Punto de Retiro en Tienda Física:*\n`;
  ticket += `${settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.'}\n\n`;
  ticket += `🗺️ *Google Maps:* ${settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA'}\n\n`;
  ticket += `🕒 *Horario:* ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'}.\n`;
  ticket += `🛵 *¿Prefieres delivery en Caracas?* Escribe *DELIVERY* o *VENDEDOR* para coordinar el motorizado.\n\n`;
  ticket += `Presenta tu cédula en caja al llegar y ¡listo! ¡Te esperamos en Crastur! 🛞🏍️✨`;

  return ticket;
}

module.exports = {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
};
