/**
 * @file apartadoFlow.ts
 * @description Máquina de estados conversacional para el sistema de Apartados de Repuestos por 24 Horas.
 * 
 * [MERCADO VENEZUELA]
 * - Límite de reserva: 24 horas continuas con liberación automática de stock.
 * - Soporte para combos multi-producto con validación individual de stock disponible.
 * - Validación adaptativa de Cédulas de Identidad venezolanas (V, E, J y cédulas históricas de 5 dígitos).
 * - Detección y formato de números de operadoras venezolanas (Digitel, Movistar, Movilnet).
 * - Protección legal de datos conforme al Art. 28 de la Constitución de la República Bolivariana de Venezuela.
 * - Tolerancia a interrupciones: responde consultas de precio/delivery en medio del flujo sin perder el estado.
 */

import { db, createReservation, recordMetric } from '../../database';
import { searchProductsFuzzy, searchMultipleProducts } from '../services/searchService';
import { formatBs, formatRate, formatVenezuelanPhone, extractVenezuelanPhones } from '../utils/formatters';
import { normalizeText } from '../utils/textUtils';
import { detectCaracasZone } from '../utils/caracasDelivery';

/**
 * Evalúa si el mensaje entrante constituye una interrupción (pregunta de negocio, adición de otro producto
 * o comando de cancelación) en lugar del dato personal solicitado en el paso actual.
 * 
 * @param text - Texto crudo enviado por el usuario
 * @param norm - Texto normalizado en minúsculas y sin acentos
 * @returns Objeto descriptor del tipo de interrupción ('cancel', 'product_addition', 'general_question') o null si es un dato válido.
 */
function detectInterruption(text: string, norm: string): { type: string } | null {
  // Comandos explícitos de cancelación
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

  // Detección de intención de anexar un repuesto adicional al apartado (construcción de combo)
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

  // Detección de preguntas sobre términos comerciales o logística
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

  // Vocabulario representativo del inventario automotriz de Crastur
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

  // Heurística de desambiguación: cadenas muy breves (<= 3 palabras) sin signos de pregunta ni verbos de consulta
  // corresponden habitualmente a nombres de personas (ej. "Luz García" contiene "luz" pero no es una pregunta de bombillos)
  const wordCount = text.trim().split(/\s+/).length;
  const isLikelyPersonalData = wordCount <= 3 && !text.includes('?') && !text.includes('¿') &&
    !norm.includes('cuanto') && !norm.includes('donde') && !norm.includes('tienen') &&
    !norm.includes('hay') && !norm.includes('vale') && !norm.includes('precio') &&
    !norm.includes('cuesta') && !norm.includes('delivery') && !norm.includes('vendedor');

  if (isLikelyPersonalData) {
    return null;
  }

  if (isQuestion || mentionsProduct) {
    return { type: 'general_question' };
  }

  return null;
}

/**
 * Responde a la interrupción de un usuario dentro del flujo de apartado y
 * reitera amablemente la solicitud del dato pendiente para no quebrar la reserva.
 * 
 * @param jid - JID destinatario
 * @param text - Texto del mensaje del usuario
 * @param norm - Texto normalizado
 * @param session - Registro de la sesión de chat activa
 * @param tasa - Tasa BCV efectiva en Bs/USD
 * @param settings - Configuración general de la tienda
 * @param interruption - Descriptor del tipo de interrupción
 * @param currentMetadata - Metadatos acumulados de la reserva (productos, precios, datos personales)
 * @param stepPrompt - Frase orientadora del paso actual a recordar
 * @returns Mensaje formateado de respuesta
 */
function handleInterruptionResponse(
  jid: string,
  text: string,
  norm: string,
  session: any,
  tasa: number,
  settings: any,
  interruption: { type: string },
  currentMetadata: any,
  stepPrompt: string
): string {
  if (interruption.type === 'cancel') {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    return `Operación de apartado cancelada 👍. Escribe *MENU* para volver al inicio o escribe el repuesto que buscas.`;
  }

  // Adición dinámica de repuestos al pedido (transformación a combo)
  if (interruption.type === 'product_addition') {
    const multi = searchMultipleProducts(text);
    let newProducts: any[] = [];
    if (multi.length > 0) {
      newProducts = multi;
    } else {
      const single = searchProductsFuzzy(text);
      if (single.length > 0) newProducts = [single[0]];
    }

    if (newProducts.length > 0) {
      let existingItems: any[] = [];
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

  // Despejar consultas operativas sin cancelar el flujo
  let answer = '';
  if (norm.includes('delivery') || norm.includes('envio') || norm.includes('motorizado') || norm.includes('flete')) {
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
      itemsDesc = currentMetadata.items.map((it: any, idx: number) => `   ${idx + 1}️⃣ ${it.nombre}: *$${parseFloat(it.precio_usd).toFixed(2)} USD*`).join('\n') + '\n';
    } else {
      itemsDesc = `   📦 ${currentMetadata.producto_nombre || 'Repuesto'}: *$${totalUsd.toFixed(2)} USD*\n`;
    }
    answer = `📊 *Resumen Actual de tu Pedido:* 🛞🏍️\n${itemsDesc}\n💵 *Total a Pagar:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalBs)} a tasa oficial BCV: ${formatRate(tasa)})\n🔥 _(¡Aprovecha nuestro Precio Promoción en Divisas pagando en Efectivo o Binance Pay!)_`;
  } else if (norm.includes('pago') || norm.includes('punto') || norm.includes('transferencia') || norm.includes('efectivo') || norm.includes('binance')) {
    answer = `💳 *Formas de Pago:* Precio Promoción en Divisas (Efectivo $ y Binance Pay USDT 🪙), Pago Móvil o transferencia a tasa oficial BCV (Bs. ${formatRate(tasa)}), y Cashea en tienda física.`;
  } else if (norm.includes('donde') || norm.includes('ubicacion') || norm.includes('direccion')) {
    answer = `🏢 *Tienda física:* ${settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas'}.\n🗺️ *Maps:* ${settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA'}`;
  } else if (norm.includes('horario') || norm.includes('abren') || norm.includes('cierran') ||
    (norm.includes('hora') && (norm.includes('abren') || norm.includes('cierran') || norm.includes('atienden') || norm.includes('horario')))) {
    answer = `🕒 *Horario:* ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'} (horario corrido).`;
  } else if (norm.includes('cashea')) {
    answer = `💛 *Cashea en Tienda:* Disponible a partir de $25 USD. Pagas la inicial al retirar y 3 cuotas quincenales a 0% interés.`;
  } else if (norm.includes('instala') || norm.includes('taller') || norm.includes('mecanico') || norm.includes('cambian') || norm.includes('cambio de aceite') || norm.includes('montan')) {
    answer = `🔧 *Venta de repuestos:* En Crastur somos tienda de venta de repuestos e insumos nuevos (no tenemos taller mecánico en el local). Te lo enviamos por delivery directo a tu mecánico o te recomendamos talleres aliados cercanos en Caracas.`;
  } else if (norm.includes('garantia') || norm.includes('defectuoso') || norm.includes('no le sirve') ||
    (norm.includes('cambio') && !norm.includes('aceite') && !norm.includes('pastilla') && !norm.includes('bujia') && !norm.includes('refrigerante') && !norm.includes('filtro'))) {
    answer = `🛡️ *Garantía:* Todos nuestros repuestos cuentan con garantía contra defectos de fábrica y garantía de calce (cambio inmediato en tienda con empaque original).`;
  } else if (norm.includes('tasa') || norm.includes('dolar') || norm.includes('bcv')) {
    answer = `🇻🇪 *Tasa BCV:* Calculamos todos los pagos a tasa oficial BCV del día (Bs. ${formatRate(tasa)} / USD).`;
  } else {
    answer = `Con gusto te aclaramos cualquier consulta.`;
  }

  return `${answer}\n\n━━━━━━━━━━━━━━━━━━━━━\n📌 _Para completar tu apartado por 24 horas:_\n${stepPrompt}`;
}

/**
 * Inicializa el flujo de apartado por 24 horas, identificando productos individuales o combos
 * y verificando stock antes de solicitar datos personales al cliente.
 * 
 * @param jid - JID destinatario
 * @param text - Texto del mensaje del cliente
 * @param norm - Texto normalizado
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración general
 * @param pushName - Nombre de perfil de WhatsApp sanitizado
 * @returns Mensaje con resumen de apartado y solicitud del nombre
 */
function initiateApartadoFlow(
  jid: string,
  text: string,
  norm: string,
  session: any,
  tasa: number,
  settings: any,
  pushName: string
): string {
  // 1. Detectar solicitud explícita de combo en el mismo mensaje (ej: "apartar bujia y aceite")
  const multiProducts = searchMultipleProducts(text);
  if (multiProducts.length >= 2) {
    // Validar stock disponible para cada uno de los productos que componen el combo
    const agotados = multiProducts.filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 0);
    if (agotados.length > 0) {
      const nombresAgotados = agotados.map(p => `*${p.marca} - ${p.modelo}*`).join(', ');
      return `⚠️ Los siguientes productos del combo se encuentran actualmente *agotados* en tienda: ${nombresAgotados}.\n\n👉 Escribe *VENDEDOR* para consultar fechas de llegada o armar un combo alternativo con nuestro asesor.`;
    }

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

  // 2. Comprobar si el usuario especificó un producto individual en el mensaje
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

    // Verificación de stock individual
    if (matchedProduct.stock !== null && matchedProduct.stock !== undefined && matchedProduct.stock <= 0) {
      return `⚠️ El repuesto *${prodNombre}* se encuentra actualmente *agotado* en nuestra tienda física.\n\n👉 Puedes escribir *VENDEDOR* para consultar con nuestro asesor la fecha de llegada del nuevo lote o escribir qué otro repuesto necesitas.`;
    }

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

  // 3. Evaluar si proviene de un contexto previo de combo o cotización múltiple
  let comboItems: any[] = [];
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

  // 4. Si no se especificó producto en el texto actual, utilizar el último producto consultado
  let matchedProduct: any = null;
  if (session.ultimo_producto_id) {
    matchedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
  }

  if (!matchedProduct) {
    return `🛞🏍️ *Apartado sin costo por 24 Horas - Crastur* ⏱️\n\nCon gusto te apartamos tu repuesto o insumo para que lo retires en tienda o lo pidas por delivery en Caracas.\n\n¿Qué pieza o insumo deseas apartar? Escribe el nombre (por ejemplo: *"bujía bera"*, *"aceite 20w50"*, *"parches"* o *"combo de bujía y aceite"*):`;
  }

  const prodNombre = `${matchedProduct.marca} - ${matchedProduct.modelo}`;

  if (matchedProduct.stock !== null && matchedProduct.stock !== undefined && matchedProduct.stock <= 0) {
    return `⚠️ El repuesto *${prodNombre}* se encuentra actualmente *agotado* en nuestra tienda física.\n\n👉 Puedes escribir *VENDEDOR* para consultar con nuestro asesor la fecha de llegada del nuevo lote o escribir qué otro repuesto necesitas.`;
  }

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
 * Valida el Nombre y Apellido del cliente para registrar en el comprobante oficial.
 * Filtra apodos, jerga venezolana y nombres de modelos de motos.
 * 
 * @param jid - JID destinatario
 * @param text - Mensaje con el nombre ingresado
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración de la tienda
 * @returns Respuesta de confirmación y solicitud de Cédula de Identidad
 */
function handleApartadoNombre(
  jid: string,
  text: string,
  session: any,
  tasa: number,
  settings: any
): string {
  const norm = normalizeText(text);

  let metadata: any = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const promptMsg = `Por favor, indícanos tu *Nombre y Apellido* completo para emitir el comprobante (ejemplo: *Carlos Pérez*):\n_(Escribe *cancelar* para salir)_`;

  const interruption = detectInterruption(text, norm);
  if (interruption) {
    return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
  }

  let cleanNombre = text.trim()
    .replace(/^(?:mi nombre es|me llamo|yo soy|a nombre de)\s+/i, '')
    .trim();
  const normClean = normalizeText(cleanNombre);

  // Validaciones morfológicas de nombres de personas reales
  const hasDigits = /\d/.test(cleanNombre);
  const hasSymbols = /[?!¿¡@#$%^&*()_+=<>{}[\]~;:]/.test(cleanNombre);
  const isValidChars = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\']+$/.test(cleanNombre);
  const words = cleanNombre.split(/\s+/).filter(w => w.length >= 2);

  // Palabras no válidas como nombre propio (jerga, motos o términos de catálogo)
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
 * Valida la Cédula de Identidad venezolana (o RIF comercial) del cliente.
 * Admite formatos venezolanos V-, E-, J- y números históricos cortos (5 a 9 dígitos).
 * 
 * @param jid - JID destinatario
 * @param text - Mensaje con el número de documento
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración de la tienda
 * @returns Respuesta de confirmación y solicitud del número telefónico de contacto
 */
function handleApartadoCedula(
  jid: string,
  text: string,
  session: any,
  tasa: number,
  settings: any
): string {
  const norm = normalizeText(text);

  let metadata: any = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const promptMsg = `Indícanos tu número de *Cédula de Identidad* (ejemplo: *V-18456789* o *28123456*):\n_(Escribe *cancelar* para salir)_`;

  const interruption = detectInterruption(text, norm);
  if (interruption) {
    return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
  }

  // Sanitización de prefijos conversacionales venezolanos
  let clean = text.toUpperCase().replace(/[\s\.\-]/g, '');
  clean = clean.replace(/^(?:MICEDULAES|MICEDULA|CEDULA:|CEDULA|CI:|CI|NUMERO:|NUMERO|DOCUMENTO:|ES LA|TENGO LA)/i, '');
  const match = clean.match(/^(?:([VE]))?(\d{5,9})$/);

  // Soporte para RIF jurídico (J-) para talleres mecánicos y pequeños comercios
  const matchJ = clean.match(/^(J)(\d{7,10})$/);
  if (matchJ && !match) {
    const cedula = `J-${matchJ[2]}`;
    metadata.cedula = cedula;
    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_telefono',
          apartado_metadata = ?
      WHERE jid = ?
    `).run(JSON.stringify(metadata), jid);
    const isLid = jid.endsWith('@lid');
    let msg = `¡Perfecto! RIF/Cédula *${cedula}* registrado. 📞\n\n`;
    if (isLid) {
      msg += `Indícanos tu *Número de Teléfono* (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* si deseas salir)_`;
    } else {
      const rawPhone = jid.split('@')[0];
      const phoneFormatted = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
      msg += `¿Deseas registrar este mismo número de WhatsApp (*${phoneFormatted}*) como teléfono de contacto?\n\n`;
      msg += `👉 Responde *SÍ* para usar este número.\n`;
      msg += `👉 O escribe tu número de teléfono (ejemplo: *0412 123 4567*):`;
    }
    return msg;
  }

  if (!match) {
    return `⚠️ Por favor ingresa un número de cédula válido para tu ticket (ejemplo: *V-18456789*, *28123456* o la cédula antigua de 5 dígitos):\n_(Escribe *cancelar* si deseas salir)_`;
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
 * Valida el Teléfono de contacto, registra la reserva en base de datos SQLite y
 * emite el Ticket Comprobante Oficial de Apartado por 24 Horas.
 * 
 * @param jid - JID destinatario
 * @param text - Mensaje con el número telefónico o confirmación afirmativa ('SÍ')
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración general de la tienda
 * @returns Comprobante oficial de reserva con ticket numerado y aviso legal
 */
function handleApartadoTelefono(
  jid: string,
  text: string,
  session: any,
  tasa: number,
  settings: any
): string {
  let metadata: any = {};
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
  const isAffirmative =
    norm === 'si' ||
    norm === 'ok' ||
    norm === 'este' ||
    norm === 'este mismo' ||
    norm === 'el mismo' ||
    norm === 'este es' ||
    norm === 'con este' ||
    norm === 'este numero' ||
    norm === 'a este' ||
    norm === 'si este' ||
    norm === 'si por favor' ||
    norm === 'usa este' ||
    norm === 'claro' ||
    norm === 'dale' ||
    norm === 'por favor';

  if (!isAffirmative) {
    const promptMsg = isLid
      ? `Indícanos tu *Número de Teléfono* de contacto (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* para salir)_`
      : `Responde *SÍ* para usar tu número actual o escribe tu teléfono (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* para salir)_`;

    const interruption = detectInterruption(text, norm);
    if (interruption) {
      return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
    }
  }

  let telefono: string | null = null;
  let primaryPhone: string | null = null;

  if (isAffirmative) {
    if (isLid) {
      return `Para que el equipo de tienda pueda registrar tu apartado correctamente, por favor escribe tu número de teléfono de contacto (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* si deseas salir)_`;
    } else {
      const rawPhone = jid.split('@')[0];
      const extracted = extractVenezuelanPhones(rawPhone);
      telefono = extracted.summary || formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
      primaryPhone = extracted.primary || telefono;
    }
  } else {
    const extracted = extractVenezuelanPhones(text);
    if (!extracted || !extracted.summary) {
      return `Por favor, indícanos un número de teléfono válido (por ejemplo: *0412 123 4567* o *0414 765 4321*):\n_(Escribe *cancelar* para salir)_`;
    }
    telefono = extracted.summary;
    primaryPhone = extracted.primary;
  }

  const nombre = (metadata.nombre && metadata.nombre.trim().length > 2)
    ? metadata.nombre.trim()
    : (session.push_name && /^[a-zA-ZÀ-ÿ\s]{3,}$/.test(session.push_name) ? session.push_name : 'Cliente');
  const cedula = metadata.cedula || 'V-00000000';
  const prodId = metadata.producto_id || session.ultimo_producto_id || null;
  const prodNombre = metadata.producto_nombre || session.ultimo_producto_nombre || 'Insumo / Repuesto Crastur';
  const precioUsd = parseFloat(metadata.precio_usd) || 0;
  const precioBs = precioUsd * tasa;

  // Persistir la reserva atómica en la base de datos con control de stock de TODOS los ítems del combo
  let reservation: any;
  try {
    const itemsToReserve = (metadata.items && Array.isArray(metadata.items) && metadata.items.length > 0)
      ? metadata.items
      : [{ id: prodId, nombre: prodNombre, precio_usd: precioUsd }];

    reservation = createReservation({
      jid,
      nombre,
      cedula,
      telefono,
      producto_id: prodId,
      producto_nombre: prodNombre,
      precio_usd: precioUsd,
      precio_bs: precioBs,
      items: itemsToReserve
    });
  } catch (err: any) {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    const errMsg = (err && typeof err.message === 'string' && err.message.trim())
      ? err.message.trim()
      : 'No fue posible registrar el apartado en este momento. Intenta de nuevo en unos minutos.';
    return `⚠️ ${errMsg}\n\nPuedes escribir *VENDEDOR* si deseas consultar alternativas con nuestro personal de tienda física o escribir qué otro repuesto buscas.`;
  }

  // Restablecer el estado de la sesión y sincronizar teléfono con el Live Inbox
  db.prepare(`
    UPDATE chat_sessions
    SET step = 'start',
        apartado_metadata = NULL,
        telefono_contacto = ?
    WHERE jid = ?
  `).run(primaryPhone || telefono, jid);

  recordMetric('apartado_creado', prodNombre, jid);

  // Calcular hora límite exacta de expiración (24 horas continuas)
  const expiraDate = new Date(reservation.expira_en);
  const expiraHora = expiraDate.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let ticket = `✅ *¡APARTADO CONFIRMADO CON ÉXITO!* 🎟️🛞🏍️\n\n`;
  ticket += `Estimado/a *${nombre}*, tu apartado ha sido guardado exclusivamente para ti:\n\n`;
  ticket += `🎟️ *Código Oficial de Ticket:* *#CRA-${String(reservation.id).padStart(4, '0')}*\n`;
  ticket += `📦 *Producto:* ${prodNombre}\n`;

  if (metadata.items && Array.isArray(metadata.items) && metadata.items.length > 1) {
    ticket += `📋 *Detalle del Combo:*\n`;
    metadata.items.forEach((it: any, idx: number) => {
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
  ticket += `🔒 *Protección de Datos (Venezuela):*\n`;
  ticket += `Tus datos personales se registran confidencialmente de forma exclusiva para la validación y canje de este apartado en tienda física conforme al Art. 28 de la CRBV y la Ley Especial contra los Delitos Informáticos.\n\n`;
  ticket += `Presenta tu cédula en caja al llegar y ¡listo! ¡Te esperamos en Crastur! 🛞🏍️✨`;

  return ticket;
}

export {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
};

export default {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
};
