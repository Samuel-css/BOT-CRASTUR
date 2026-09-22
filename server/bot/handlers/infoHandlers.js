const { db } = require('../../database');
const { formatRate, formatBs } = require('../utils/formatters');
const { detectCaracasZone } = require('../utils/caracasDelivery');
const { searchProductsFuzzy } = require('../services/searchService');

/**
 * Formas de pago aceptadas
 */
function handlePaymentMethodsResponse(tasa, settings) {
  const tasaFormatted = formatRate(tasa);
  let msg = `💳 *Métodos de Pago Aceptados en Crastur* 🛞🏍️\n\n`;
  msg += `En nuestra tienda aceptamos los siguientes métodos de pago autorizados:\n\n`;
  msg += `💵 *Efectivo en Divisas / Dólares* (🔥 *¡Con descuento especial por pago en divisas!*)\n`;
  msg += `✅ *Pago Móvil* (a tasa oficial BCV del día, sin recargos)\n`;
  msg += `✅ *Transferencia Bancaria*\n`;
  msg += `✅ *Efectivo en Bolívares* (a tasa oficial BCV)\n`;
  msg += `💛 *Cashea* (Pagas solo la inicial hoy y el resto en 3 cuotas quincenales sin interés)\n\n`;
  msg += `🇻🇪 *Tasa oficial BCV hoy:* *Bs. ${tasaFormatted} / USD*\n\n`;
  msg += `👉 Escribe el repuesto que deseas cotizar o escribe *VENDEDOR* si deseas consultar el descuento exacto de tu pieza.`;
  return msg;
}

/**
 * Información sobre descuento especial en divisas
 */
function handleDiscountResponse(tasa, settings) {
  const tasaFormatted = formatRate(tasa);
  let msg = `🔥 *¡Descuento Especial en Divisas en Crastur!* 💵🏷️\n\n`;
  msg += `¡Sí! Al pagar tus repuestos y accesorios en **efectivo en divisas**, cuentas con un **descuento especial** directo en tienda 🏷️.\n\n`;
  msg += `📌 *Métodos de pago disponibles:*\n`;
  msg += `💵 *Efectivo en Divisas* (🔥 *¡Con descuento especial directo!*)\n`;
  msg += `✅ *Pago Móvil* (a tasa oficial BCV sin recargos)\n`;
  msg += `✅ *Transferencia Bancaria*\n`;
  msg += `✅ *Efectivo en Bolívares* (a tasa oficial BCV)\n`;
  msg += `💛 *Cashea* (Inicial + 3 cuotas quincenales a 0% interés)\n\n`;
  msg += `🇻🇪 *Tasa oficial BCV hoy:* *Bs. ${tasaFormatted} / USD*\n\n`;
  msg += `👉 Escribe qué repuesto buscas (ej: *"pastillas"*, *"aceite"*, *"batería"*) o escribe *VENDEDOR* para darte el precio con descuento directo de tu pieza.`;
  return msg;
}

/**
 * Envíos (Solo delivery en Caracas y retiro en local)
 * Con soporte inteligente para mostrar los detalles del producto en contexto
 */
function handleDeliveryResponse(settings, session, tasa, text) {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';

  let matchedProduct = null;
  const searchResults = searchProductsFuzzy(text);
  if (searchResults.length > 0) {
    matchedProduct = searchResults[0];
  } else if (session?.ultimo_producto_id) {
    matchedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
  }

  const detectedZone = detectCaracasZone(text, settings);

  let msg = `🛵 *Delivery en Caracas - Crastur* 📦\n\n`;
  msg += `¡Sí! Despachamos hoy mismo con motorizado a tu domicilio, trabajo o taller mecánico en Caracas.\n\n`;

  if (matchedProduct) {
    const precioUsd = parseFloat(matchedProduct.precio_usd) || 0;
    msg += `📦 *Repuesto:* *${matchedProduct.marca} - ${matchedProduct.modelo}*\n`;
    msg += `💵 *Precio:* *$${precioUsd.toFixed(2)} USD* (Bs. ${formatBs(precioUsd * tasa)})\n\n`;
  }

  if (detectedZone) {
    msg += `📍 *Zona:* *${detectedZone.nombre}*\n`;
    msg += `🛵 *Tarifa motorizado:* *${detectedZone.tarifa}* (despacho hoy).\n\n`;
  } else {
    msg += `📍 *Tarifas estimadas de motorizado:*\n`;
    msg += `• San Agustín, Centro, Bellas Artes: *$2 a $3 USD*\n`;
    msg += `• Catia, El Valle, Chacao, Baruta, Petare: *$3 a $5 USD*\n\n`;
  }

  msg += `🏢 *Retiro gratis en tienda:* ${direccion} (Lun-Sáb 8am-8pm).\n`;
  msg += `💳 *Pago:* Efectivo ($ con descuento), Pago Móvil (tasa BCV) o Cashea en tienda.\n\n`;
  msg += `👉 Indícanos tu *zona o dirección exacta* para coordinar el despacho, o escribe *VENDEDOR*.`;
  return msg;
}

/**
 * Envíos Nacionales / Interior del país
 */
function handleNationalShippingResponse(session, tasa) {
  let msg = `📦 *Envíos al Interior del País - Crastur* 🇻🇪\n\n`;
  msg += `Actualmente trabajamos exclusivamente con:\n`;
  msg += `1️⃣ *Delivery en moto a toda Caracas* 🛵\n`;
  msg += `2️⃣ *Retiro en tienda física:* San Agustín Norte, Caracas (Edif. Liberalba) 🏢\n\n`;
  msg += `⚠️ No realizamos envíos directos por agencias nacionales (MRW, Zoom o Tealca).\n`;
  msg += `💡 Si tienes un familiar, amigo o comisionista en Caracas, ¡con gusto se lo entregamos a él!\n\n`;
  msg += `👉 Escribe qué repuesto buscas para darte precio y disponibilidad.`;
  return msg;
}

/**
 * Consulta directa de la Tasa BCV
 */
function handleRateQueryResponse(tasa, settings) {
  const tasaFormatted = formatRate(tasa);
  let msg = `🇻🇪 *Tasa Oficial BCV Hoy:* *Bs. ${tasaFormatted} / USD* 🏦\n\n`;
  msg += `• Calculamos todos los precios a tasa oficial BCV del día sin recargos.\n`;
  msg += `• 🔥 *¡Descuento en Divisas!* Cuentas con precio especial pagando en efectivo en tienda física 🏷️.\n`;
  msg += `• 💛 *Cashea:* Inicial a tasa BCV y 3 cuotas quincenales a 0% interés.\n\n`;
  msg += `👉 Escribe el repuesto que buscas para cotizártelo de una vez en $ y Bs.`;
  return msg;
}

/**
 * Retiro Inmediato / "¿Puedo ir ya?"
 */
function handleImmediatePickupResponse(settings) {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  let msg = `¡Claro que sí! Estamos activos y atendiendo con gusto en nuestra tienda física 🛞🏍️🏢✨\n\n`;
  msg += `🕒 *Horario de Atención:* Lunes a Sábado de *8:00 AM a 8:00 PM* (horario corrido).\n`;
  msg += `🏠 *Dirección:* ${direccion}\n`;
  msg += `🗺️ *Google Maps:* ${mapsUrl}\n\n`;
  msg += `💡 *Consejo:* Si ya sabes qué repuesto necesitas, escribe *APARTAR* antes de salir para dejártelo reservado en caja a tu nombre por 24 horas continuas sin costo adicional. ¡Así te aseguras de tenerlo apartado al llegar! 👍\n\n`;
  msg += `👉 Escribe el repuesto que buscas o escribe *VENDEDOR* si deseas que te esperemos con la pieza lista.`;
  return msg;
}

/**
 * Puntos de Referencia y Cómo Llegar
 */
function handleReferencePointsResponse(settings) {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  let msg = `📍 *Cómo Llegar a Crastur - Puntos de Referencia* 🛞🏢\n\n`;
  msg += `Nuestra tienda física está ubicada en el centro de Caracas, con acceso rápido y cómodo:\n\n`;
  msg += `🏠 *Dirección:* ${direccion}\n\n`;
  msg += `📌 *Puntos de Referencia Clave:*\n`;
  msg += `• A escasos metros de las torres de *Parque Central*.\n`;
  msg += `• Entre la *Avenida Bolívar* y la *Avenida Lecuna*.\n`;
  msg += `• 🚇 *Estaciones de Metro más cercanas:*\n`;
  msg += `  - *Metro Bellas Artes* (a 3 cuadras caminando).\n`;
  msg += `  - *Metro Nuevo Circo* (a 4 cuadras).\n\n`;
  msg += `🗺️ *Toca aquí para abrir la ubicación en Google Maps (Ruta GPS):*\n`;
  msg += `${mapsUrl}\n\n`;
  msg += `🕒 *Horario Corrido:* Lunes a Sábado de *8:00 AM a 8:00 PM*.\n`;
  msg += `🛵 *¿Prefieres no salir?* Escribe *DELIVERY* y te lo enviamos en moto directo a tu casa o taller en Caracas.\n\n`;
  msg += `👉 Escribe el repuesto que buscas para confirmarte existencia antes de venir.`;
  return msg;
}

/**
 * Consulta sobre Instalación y Taller Mecánico
 */
function handleInstallationQueryResponse(session) {
  let msg = `🔧 *Venta de Repuestos e Instalación - Crastur* 🛞🏍️⚙️\n\n`;
  msg += `En *Crastur* somos una tienda física especializada exclusivamente en la **venta de repuestos y accesorios nuevos y garantizados para motos, insumos para caucheras y otros productos** (no contamos con taller mecánico ni realizamos instalaciones en el local) 🏢.\n\n`;
  msg += `💡 *Sin embargo, te facilitamos todo:*\n`;
  msg += `1️⃣ *Envío directo a tu taller:* Te enviamos el repuesto por delivery en moto directo a las manos de tu mecánico de confianza en cualquier zona de Caracas 🛵.\n`;
  msg += `2️⃣ *Recomendación aliada:* Si no cuentas con mecánico de confianza, con gusto te recomendamos talleres mecánicos aliados cercanos a nuestra tienda en Caracas para una instalación segura y garantizada 👍.\n\n`;
  msg += `👉 Escribe qué repuesto necesitas o escribe *VENDEDOR* para hablar directamente con nuestro equipo técnico.`;
  return msg;
}

/**
 * Calidad, marcas y garantía de los repuestos
 */
function handleQualityAndBrandsResponse() {
  let msg = `🛡️ *Calidad y Marcas de Nuestros Productos - Crastur* 🛞🏍️✨\n\n`;
  msg += `En *Crastur* cuidamos tu seguridad y tu bolsillo:\n\n`;
  msg += `• 💯 *Productos 100% Nuevos:* Todos nuestros repuestos e insumos vienen sellados de fábrica.\n`;
  msg += `• 🏷️ *Marcas Reconocidas:* Trabajamos con marcas de excelente calidad y rendimiento comprobado.\n`;
  msg += `• 🛡️ *Garantía de Fábrica:* Todos los repuestos y accesorios cuentan con garantía contra defectos de fabricación.\n`;
  msg += `• 🔄 *Garantía de Calce:* Si por alguna razón la pieza de moto no le sirve a tu modelo, realizamos el cambio en tienda física con tu comprobante y el empaque original.\n\n`;
  msg += `👉 Indícanos el modelo de tu moto o el insumo de cauchera que buscas y te damos precio y disponibilidad al instante.`;
  return msg;
}

/**
 * Consulta sobre repuestos para motocicletas
 */
function handleMotoQueryResponse() {
  let msg = `🏍️ *Repuestos y Accesorios para Motos en Crastur* 🛵\n\n`;
  msg += `¡Sí! En *Crastur* somos especialistas en repuestos y accesorios para motos. Disponemos de:\n\n`;
  msg += `⚙️ *Repuestos Mecánicos:*\n`;
  msg += `• Kits de arrastre (cadena 428H, piñón y corona) para Bera, Empire, Keeway, Suzuki y más.\n`;
  msg += `• Pastillas y bandas de freno.\n`;
  msg += `• Bujías de encendido (NGK, Bosch).\n`;
  msg += `• Aceites de motor 4T y 2T (mineral y semisintético).\n`;
  msg += `• Guayas de croche y acelerador.\n`;
  msg += `• Tripas y cauchos para moto (diversas medidas).\n`;
  msg += `• Baterías para moto.\n\n`;
  msg += `🎽 *Accesorios:*\n`;
  msg += `• Puños para manubrio, mallas porta-casco, pulpos elásticos, retrovisores, luces LED y spray para cadena.\n\n`;
  msg += `💡 *Dinos qué repuesto o accesorio necesitas o el modelo de tu moto* y te confirmamos disponibilidad al instante.\n`;
  msg += `👉 O escribe *VENDEDOR* para que un asesor te atienda directamente.`;
  return msg;
}

/**
 * Respuesta específica para consultas de cauchera, cauchos y llantas
 */
function handleCaucheraQueryResponse() {
  let msg = `🛞 *Insumos y Materiales para Caucheras en Crastur* 🔧\n\n`;
  msg += `¡Sí! En *Crastur* distribuimos los mejores materiales e insumos para caucheras y llanteras en Caracas:\n\n`;
  msg += `• 🩹 *Parches para cauchos y tripas:* En frío y caliente, redondos y ovalados (todas las medidas).\n`;
  msg += `• 🧴 *Pega para parches:* Cemento químico azul y negro de alta adherencia.\n`;
  msg += `• 🔩 *Válvulas para cauchos:* Válvulas sin tripa TR414, TR413, válvulas de moto y metálicas.\n`;
  msg += `• 🪢 *Tarugos / mechas:* Para reparar pinchazos al instante.\n`;
  msg += `• ⚖️ *Plomos para balanceo:* Adhesivos para rines de aluminio y de pestaña para rines de hierro.\n`;
  msg += `• 🔧 *Herramientas de cauchera:* Agujas, terrajas, rodillos asentadores y manómetros medidores de presión.\n`;
  msg += `• 🧴 *Sellador de talón y pasta para montar cauchos.*\n\n`;
  msg += `👉 Indícanos qué insumo necesitas y te damos precio al detal o por caja con delivery a tu taller en Caracas.`;
  return msg;
}

/**
 * Aclaratoria sobre medios de pago específicos no aceptados
 */
function handleNonAcceptedPaymentsResponse(tasa, settings) {
  const tasaFormatted = formatRate(tasa);
  let msg = `💳 *Métodos de Pago Aceptados en Crastur* 🛞🏍️\n\n`;
  msg += `En nuestra tienda aceptamos los siguientes métodos de pago autorizados:\n\n`;
  msg += `💵 *Efectivo en Dólares / Divisas* (🔥 *¡Con descuento especial en tienda!*)\n`;
  msg += `✅ *Pago Móvil* (a tasa oficial BCV del día, sin recargos)\n`;
  msg += `✅ *Transferencia Bancaria Nacional* (a tasa oficial BCV)\n`;
  msg += `✅ *Efectivo en Bolívares* (a tasa oficial BCV)\n`;
  msg += `💛 *Cashea* (Pagas solo la inicial hoy y el resto en 3 cuotas quincenales a 0% interés)\n\n`;
  msg += `🇻🇪 *Tasa oficial BCV hoy:* *Bs. ${tasaFormatted} / USD*\n\n`;
  msg += `⚠️ *Nota aclaratoria:* Actualmente no aceptamos Zelle, Binance USDT, Banesco Panamá ni tarjetas por punto de venta. Puedes pagar cómodamente con *Pago Móvil*, *Efectivo* (con descuento en divisas) o *Cashea*.\n\n`;
  msg += `👉 Escribe el producto que deseas cotizar o escribe *VENDEDOR* si deseas comunicarte con un asesor.`;
  return msg;
}

/**
 * Facturación fiscal, cotizaciones y presupuestos
 */
function handleInvoicingQueryResponse() {
  let msg = `📄 *Facturación y Presupuestos - Crastur* 💼✨\n\n`;
  msg += `¡Sí, con todo gusto!\n\n`;
  msg += `• Entregamos **nota de entrega / factura comercial** con todos los datos detallados de tu compra y garantía del producto.\n`;
  msg += `• Si necesitas una **cotización formal o presupuesto sellado** para tu cauchera, taller o control administrativo, te lo preparamos con validez de precio.\n\n`;
  msg += `👉 Escribe los productos que necesitas cotizar o escribe *VENDEDOR* para que un asesor te elabore el presupuesto formal.`;
  return msg;
}

/**
 * Horario de tienda oficial
 */
function handleStoreHoursResponse(settings) {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  let msg = `🕒 *Horario de Atención - Crastur* 🛞🏍️🏢\n\n`;
  msg += `Te atendemos en nuestra tienda física en el siguiente horario:\n\n`;
  msg += `📅 *Lunes a Sábado:* De *8:00 AM a 8:00 PM* (horario corrido).\n`;
  msg += `📅 *Domingos:* Cerrados (nuestro bot continúa activo 24/7 para consultas y apartados).\n\n`;
  msg += `🏠 *Dirección:* ${direccion}\n`;
  msg += `🗺️ *Google Maps:* ${mapsUrl}\n\n`;
  msg += `¡Te esperamos con la mejor atención y productos garantizados! 🛞🏍️✨`;
  return msg;
}

/**
 * Garantía y políticas de cambio
 */
function handleWarrantyResponse() {
  let msg = `🛡️ *Garantía y Políticas de Cambio en Crastur* 🛞🏍️\n\n`;
  msg += `• Todos nuestros repuestos e insumos nuevos cuentan con *garantía contra defectos de fábrica*.\n`;
  msg += `• Si necesitas realizar un cambio de pieza por compatibilidad con tu modelo de moto, lo realizamos en tienda presentando tu comprobante de compra (la pieza debe estar en su caja y en perfecto estado).\n`;
  msg += `• Para verificar que una pieza le sirva a tu moto antes de comprar, indícanos el modelo de tu moto o escribe *VENDEDOR* para hablar con nuestro equipo.`;
  return msg;
}

/**
 * Disponibilidad y stock en tienda
 */
function handleAvailabilityResponse() {
  let msg = `📦 *Disponibilidad en Tienda Física* 🛞🏍️✨\n\n`;
  msg += `¡Sí! Contamos con amplio inventario en tienda para entrega inmediata hoy mismo.\n\n`;
  msg += `👉 Escribe el nombre del producto o repuesto que buscas (ej: *"parches"*, *"pega"*, *"valvulas"*, *"kit de arrastre"*, *"bujia"*, *"refrigerante"*).\n`;
  msg += `👉 O indícanos el modelo de tu moto o el insumo que buscas y te confirmamos de inmediato.\n`;
  msg += `👉 También puedes apartarlo por 24 horas escribiendo *APARTAR*.`;
  return msg;
}

/**
 * Ubicación y Google Maps en azul directo para 1 toque
 */
function handleLocationResponse(settings) {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas, Venezuela';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';

  let msg = `📍 *Ubicación de Tienda Física - Crastur* 🛞🏍️🏢\n\n`;
  msg += `🏠 *Dirección:* ${direccion}\n\n`;
  msg += `🗺️ *Enlace directo en Google Maps:*\n${mapsUrl}\n\n`;
  msg += `🕒 *Horario de Atención:* Lunes a Sábado de *8:00 AM a 8:00 PM* (corrido).\n`;
  msg += `🛵 *Delivery:* Disponible a toda Caracas con motorizado de confianza.\n\n`;
  msg += `¡Te esperamos con la mejor atención en insumos de cauchera y repuestos de moto! 🛞🏍️✨`;
  return msg;
}

/**
 * Aclaratoria amable si preguntan por piezas pesadas de motor
 */
function handleCarInquiryResponse() {
  let msg = `¡Hola! 👋 En *Crastur* nos especializamos exclusivamente en:\n\n`;
  msg += `1️⃣ 🛞 *Insumos para Caucheras* (parches, pegas, válvulas, mechas, plomos)\n`;
  msg += `2️⃣ 🏍️ *Repuestos y Accesorios para Moto* (kits de arrastre, frenos, bujías, aceites 4T, tripas)\n`;
  msg += `3️⃣ 📦 *Otros Productos* (aceites de motor, refrigerantes, aditivos, bombillos, plumillas)\n\n`;
  msg += `⚠️ No vendemos piezas internas pesadas de motor (como cigüeñales o cajas de velocidad). Pero si necesitas aceites, refrigerantes, bombillos o insumos de cauchera, ¡con mucho gusto estamos a tu orden!\n\n`;
  msg += `👉 Escribe lo que buscas o escribe *VENDEDOR* para hablar con nuestro equipo.`;
  return msg;
}

module.exports = {
  handlePaymentMethodsResponse,
  handleDiscountResponse,
  handleDeliveryResponse,
  handleNationalShippingResponse,
  handleRateQueryResponse,
  handleImmediatePickupResponse,
  handleReferencePointsResponse,
  handleInstallationQueryResponse,
  handleQualityAndBrandsResponse,
  handleMotoQueryResponse,
  handleCaucheraQueryResponse,
  handleNonAcceptedPaymentsResponse,
  handleInvoicingQueryResponse,
  handleStoreHoursResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse,
  handleLocationResponse,
  handleCarInquiryResponse
};
