const {
  db,
  getSettings,
  getEffectiveRate,
  recordMetric,
  isBotPaused
} = require('../database');

// Utilidades y Reglas de Negocio
const { isSpamming } = require('./utils/antiSpam');
const { normalizeText } = require('./utils/textUtils');
const { isWithinBusinessHours, handleOutOfHoursTransactionResponse } = require('./services/businessRules');
const { searchProductsFuzzy, searchMultipleProducts } = require('./services/searchService');

// Handlers de Respuestas
const { handleMediaResponse } = require('./handlers/mediaHandlers');
const {
  handleGreetingResponse,
  handleCourtesyResponse,
  handleAffirmativeResponse,
  handleNegativeResponse
} = require('./handlers/greetingHandlers');
const {
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
} = require('./handlers/infoHandlers');
const { handleCasheaSmart, handleCasheaResponse } = require('./handlers/casheaHandlers');
const {
  handleProductResults,
  handleSingleProductDetail,
  handleMultiProductResults,
  handleContextualSelection
} = require('./handlers/productHandlers');
const { handleSellersResponse } = require('./handlers/advisoryHandlers');
const { handleDefaultFallback } = require('./handlers/fallbackHandlers');

// Flujo de Apartados y Seguimiento
const {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
} = require('./apartado/apartadoFlow');
const { checkPendingFollowUps } = require('./followUp/followUpService');

/**
 * Enrutador principal de mensajes de WhatsApp
 * Procesa el mensaje recibido y genera la respuesta adecuada
 */
function processIncomingMessage(jid, rawText, pushName = 'amigo/a', mediaInfo = null) {
  // 1. Si el bot fue pausado manualmente por un asesor en este chat, no responder
  if (isBotPaused(jid)) {
    console.log(`[Bot] Chat ${jid} está pausado manualmente. Silenciando respuesta automática.`);
    return null;
  }

  // 2. Protección anti-spam
  if (isSpamming(jid)) {
    return null; // Silenciar sin responder para no alimentar el spam
  }

  const settings = getSettings();
  const tasa = getEffectiveRate();
  const now = Date.now();

  // 2. Manejo de Mensajes Multimedia (Audios, Notas de voz, Fotos, Stickers)
  if (mediaInfo && mediaInfo.isMedia && !rawText) {
    recordMetric('mensaje_multimedia', mediaInfo.type, jid);
    return handleMediaResponse(pushName, mediaInfo.type);
  }

  const text = (rawText || '').trim();
  const norm = normalizeText(text);

  // Obtener o inicializar sesión
  let session = db.prepare('SELECT * FROM chat_sessions WHERE jid = ?').get(jid);
  if (!session) {
    db.prepare(`
      INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
      VALUES (?, ?, 'start', ?, 0, 0, 1)
    `).run(jid, pushName, now);
    session = { jid, push_name: pushName, step: 'start', ultimo_mensaje_at: now, seguimiento_enviado: 0, bot_pausado: 0, nivel_cashea: 1 };
  } else {
    db.prepare(`
      UPDATE chat_sessions
      SET push_name = ?, ultimo_mensaje_at = ?
      WHERE jid = ?
    `).run(pushName, now, jid);
  }

  // Guardar mensaje en el registro
  db.prepare(`
    INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
    VALUES (?, 'cliente', ?, ?)
  `).run(jid, text, now);

  // 3. Manejo de cancelación de flujos
  if (norm === 'cancelar' || norm === 'salir' || norm === 'abortar') {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    return `Operación cancelada 👍. Escribe *MENU* para volver al inicio o escribe el repuesto que buscas.`;
  }

  // 4. Máquina de estados para APARTADOS (Límite 24 Horas)
  if (session.step === 'apartado_pidiendo_nombre') {
    return handleApartadoNombre(jid, text, session, tasa, settings);
  }
  if (session.step === 'apartado_pidiendo_cedula') {
    return handleApartadoCedula(jid, text, session, tasa, settings);
  }
  if (session.step === 'apartado_pidiendo_telefono') {
    return handleApartadoTelefono(jid, text, session, tasa, settings);
  }

  // 5. Agradecimientos, Despedidas y Cortesía ("gracias", "chévere", "fino", etc.)
  if (
    norm === 'gracias' ||
    norm.startsWith('gracias') ||
    norm.includes('muchas gracias') ||
    norm.includes('agradecido') ||
    norm.includes('dale gracias') ||
    norm === 'chevere' ||
    norm === 'fino' ||
    norm === 'dale fino' ||
    norm === 'buenisimo' ||
    norm === 'perfecto gracias' ||
    norm === 'chao' ||
    norm === 'hasta luego'
  ) {
    recordMetric('cortesia_agradecimiento', text, jid);
    return handleCourtesyResponse(pushName, settings);
  }

  // 6. Confirmaciones cotidianas fuera de flujo ("si", "ok", "dale", "claro", "por favor")
  if (
    norm === 'si' ||
    norm === 'ok' ||
    norm === 'dale' ||
    norm === 'claro' ||
    norm === 'por favor' ||
    norm === 'si por favor' ||
    norm === 'si claro' ||
    norm === 'claro que si' ||
    norm === 'si dale' ||
    norm === 'me parece bien' ||
    norm === 'dale pues' ||
    norm === 'seguro' ||
    norm.startsWith('si ') ||
    norm.startsWith('ok ')
  ) {
    return handleAffirmativeResponse(pushName);
  }

  // 7. Negaciones cotidianas fuera de flujo ("no", "ya no", "ninguno", "nada")
  if (
    norm === 'no' ||
    norm === 'ya no' ||
    norm === 'ya no gracias' ||
    norm === 'no gracias' ||
    norm === 'ninguno' ||
    norm === 'nada' ||
    norm === 'por ahora no' ||
    norm === 'despues' ||
    norm === 'mas tarde' ||
    norm.startsWith('no ') ||
    norm.startsWith('ya no ')
  ) {
    return handleNegativeResponse();
  }

  // 8. Aclaratoria de Medios de Pago no aceptados (Zelle, Binance, Banesco Panamá, Punto de Venta)
  if (
    norm.includes('zelle') ||
    norm.includes('binance') ||
    norm.includes('usdt') ||
    norm.includes('banesco panama') ||
    norm.includes('punto de venta') ||
    norm.includes('tienen punto') ||
    norm.includes('tarjeta de debito') ||
    norm.includes('tarjeta de credito') ||
    norm.includes('tarjeta')
  ) {
    recordMetric('consulta_pago_especifico', text, jid);
    return handleNonAcceptedPaymentsResponse(tasa, settings);
  }

  // 9. Consulta directa de la Tasa BCV del día
  if (
    norm.includes('a que tasa') ||
    norm.includes('cual es la tasa') ||
    norm.includes('que tasa') ||
    norm.includes('tasa bcv') ||
    norm.includes('tasa de hoy') ||
    norm.includes('tasa del dia') ||
    norm.includes('a como esta el dolar') ||
    norm.includes('a como reciben') ||
    norm.includes('precio del dolar') ||
    norm === 'tasa'
  ) {
    recordMetric('consulta_tasa_bcv', text, jid);
    return handleRateQueryResponse(tasa, settings);
  }

  // 10. Envíos Nacionales / Interior del país (Aclaratoria de servicio exclusivo en Caracas)
  if (
    norm.includes('nacional') ||
    norm.includes('al interior') ||
    norm.includes('interior del pais') ||
    norm.includes('otra ciudad') ||
    norm.includes('otro estado') ||
    norm.includes('tealca') ||
    norm.includes('zoom') ||
    norm.includes('mrw') ||
    norm.includes('domesa') ||
    norm.includes('valencia') ||
    norm.includes('maracay') ||
    norm.includes('barquisimeto') ||
    norm.includes('maracaibo') ||
    norm.includes('puerto la cruz') ||
    norm.includes('maturin') ||
    norm.includes('merida') ||
    norm.includes('san cristobal')
  ) {
    recordMetric('consulta_envio_nacional', text, jid);
    return handleNationalShippingResponse(session, tasa);
  }

  // 11. Retiro Inmediato / "¿Puedo ir ya?"
  if (
    norm.includes('puedo ir ya') ||
    norm.includes('puedo pasar ya') ||
    norm.includes('puedo ir ahorita') ||
    norm.includes('puedo pasar ahorita') ||
    norm.includes('estan atendiendo ahorita') ||
    norm.includes('lo puedo retirar hoy') ||
    norm.includes('puedo retirar hoy') ||
    norm.includes('lo busco ya')
  ) {
    recordMetric('consulta_retiro_inmediato', text, jid);
    return handleImmediatePickupResponse(settings);
  }

  // 12. Puntos de Referencia y Cómo Llegar (Metro / Parque Central)
  if (
    norm.includes('como llego') ||
    norm.includes('punto de referencia') ||
    norm.includes('puntos de referencia') ||
    norm.includes('cerca de donde') ||
    norm.includes('cerca de que') ||
    norm.includes('que metro') ||
    norm.includes('estacion de metro') ||
    norm.includes('parque central') ||
    norm.includes('nuevo circo')
  ) {
    recordMetric('consulta_referencias', text, jid);
    return handleReferencePointsResponse(settings);
  }

  // 13. Instalación de Repuestos / Taller Mecánico
  if (
    norm.includes('instalan') ||
    norm.includes('instalacion') ||
    norm.includes('tienen taller') ||
    norm.includes('tienen mecanico') ||
    norm.includes('hacen la instalacion') ||
    norm.includes('quien lo monta') ||
    norm.includes('lo montan') ||
    norm.includes('cambian aceite') ||
    norm.includes('cambio de aceite')
  ) {
    recordMetric('consulta_instalacion', text, jid);
    return handleInstallationQueryResponse(session);
  }

  // 14. Calidad y Marcas de los Repuestos (OEM, Originales, Marcas)
  if (
    norm.includes('son originales') ||
    norm.includes('que marca') ||
    norm.includes('son de buena calidad') ||
    norm.includes('calidad') ||
    norm.includes('son chinos') ||
    norm.includes('son japoneses') ||
    norm.includes('son americanos') ||
    norm.includes('marcas trabajan')
  ) {
    recordMetric('consulta_calidad_marcas', text, jid);
    return handleQualityAndBrandsResponse();
  }

  // 15. Consulta de Repuestos para Motos
  if (
    norm.includes('para moto') ||
    norm.includes('de moto') ||
    norm.includes('repuestos de moto') ||
    norm.includes('repuesto de moto') ||
    norm.includes('cosas de moto') ||
    norm.includes('para motos') ||
    norm.includes('moto') ||
    norm.includes('motocicleta') ||
    norm.includes('scooter')
  ) {
    recordMetric('consulta_motos', text, jid);
    return handleMotoQueryResponse();
  }

  // 15b. Consulta de Cauchera / Llantas / Cauchos
  if (
    norm.includes('cauchera') ||
    norm.includes('caucho') ||
    norm.includes('llanta') ||
    norm.includes('llantas') ||
    norm.includes('goma') ||
    norm.includes('gomas') ||
    norm.includes('valvula') ||
    norm.includes('parche') ||
    norm.includes('nitrogeno') ||
    norm.includes('inflado') ||
    norm.includes('camara de aire') ||
    norm.includes('neumático')
  ) {
    recordMetric('consulta_cauchera', text, jid);
    return handleCaucheraQueryResponse();
  }

  // 15c. Consulta de Partes de Carro no comercializadas
  if (
    norm.includes('repuestos de carro') ||
    norm.includes('repuesto de carro') ||
    norm.includes('repuestos para carro') ||
    norm.includes('repuesto para carro') ||
    norm.includes('cosas de carro') ||
    norm.includes('repuestos de auto') ||
    norm.includes('repuesto de auto') ||
    norm.includes('para carros') ||
    norm.includes('tren delantero') ||
    norm.includes('caja de cambio') ||
    norm.includes('caja automatica') ||
    norm.includes('caja sincronica') ||
    norm.includes('tripoides') ||
    norm.includes('cremallera') ||
    norm.includes('amortiguador')
  ) {
    recordMetric('consulta_partes_no_manejadas', text, jid);
    return handleCarInquiryResponse();
  }

  // 16. Facturación y Presupuestos
  if (
    norm.includes('factura fiscal') ||
    norm.includes('dan factura') ||
    norm.includes('factura') ||
    norm.includes('presupuesto') ||
    norm.includes('cotizacion formal') ||
    norm.includes('nota de entrega')
  ) {
    recordMetric('consulta_facturacion', text, jid);
    return handleInvoicingQueryResponse();
  }

  // 17. Detección de Descuento en Divisas / Promociones
  if (
    norm.includes('descuento') ||
    norm.includes('rebaja') ||
    norm.includes('promo') ||
    norm.includes('precio en divisas') ||
    norm.includes('pago en divisas') ||
    norm.includes('descuento en divisas') ||
    norm.includes('descuento en dolares')
  ) {
    recordMetric('consulta_descuento', text, jid);
    return handleDiscountResponse(tasa, settings);
  }

  // 18. Métodos de Pago
  if (
    norm.includes('pago') ||
    norm.includes('pagar') ||
    norm.includes('pago movil') ||
    norm.includes('efectivo') ||
    norm.includes('dolares') ||
    norm.includes('transferencia') ||
    norm === '5'
  ) {
    recordMetric('consulta_pagos', text, jid);
    return handlePaymentMethodsResponse(tasa, settings);
  }

  // 19. Delivery y Envíos (Solo delivery a Caracas y retiro en local)
  if (
    norm.includes('delivery') ||
    norm.includes('envio') ||
    norm.includes('envios') ||
    norm.includes('hacen delivery') ||
    norm.includes('ponen delivery') ||
    norm.includes('traen') ||
    norm.includes('llevan') ||
    norm.includes('motorizado') ||
    norm.includes('mandan') ||
    norm.includes('flete') ||
    norm.includes('a domicilio') ||
    norm.includes('a toda caracas') ||
    norm.includes('a todas caracas')
  ) {
    recordMetric('consulta_delivery', text, jid);
    return handleDeliveryResponse(settings, session, tasa, text);
  }

  // 20. Horario de Tienda (Lunes a Sábado de 8:00 AM a 8:00 PM)
  if (
    norm.includes('horario') ||
    norm.includes('hora') ||
    norm.includes('abren') ||
    norm.includes('cierran') ||
    norm.includes('abierto') ||
    norm.includes('estan abiertos') ||
    norm.includes('sabado') ||
    norm.includes('domingo')
  ) {
    recordMetric('consulta_horario', text, jid);
    return handleStoreHoursResponse(settings);
  }

  // 21. Garantía y Devolución / Compatibilidad
  if (
    norm.includes('garantia') ||
    norm.includes('devolucion') ||
    norm.includes('cambio') ||
    norm.includes('si no le sirve') ||
    norm.includes('si no le queda') ||
    norm.includes('defectuoso')
  ) {
    recordMetric('consulta_garantia', text, jid);
    return handleWarrantyResponse();
  }

  // 22. Disponibilidad / Entrega Inmediata
  if (
    norm.includes('disponible') ||
    norm.includes('disponibilidad') ||
    norm.includes('hay disponible') ||
    norm.includes('tienen en tienda') ||
    norm.includes('entrega inmediata')
  ) {
    recordMetric('consulta_disponibilidad', text, jid);
    return handleAvailabilityResponse();
  }

  // 23. Detección de intención de APARTAR / RESERVAR (24H)
  if (
    norm.includes('apartar') ||
    norm.includes('reservar') ||
    norm.includes('aparta') ||
    norm.includes('reserva') ||
    norm.includes('guardamelo') ||
    norm.includes('guardamela') ||
    norm.includes('guardalo') ||
    norm.includes('guardala') ||
    norm.includes('lo quiero apartar') ||
    norm.includes('quiero apartar') ||
    norm.includes('lo paso a buscar') ||
    norm.includes('lo voy a buscar')
  ) {
    recordMetric('intencion_apartado', text, jid);
    // Fuera de horario: el apartado requiere presencia en tienda, informar al cliente
    if (settings.fuera_horario_activo === '1' && !isWithinBusinessHours()) {
      return handleOutOfHoursTransactionResponse(settings, 'apartar');
    }
    return initiateApartadoFlow(jid, text, norm, session, tasa, settings, pushName);
  }

  // 24. Detección de solicitud de VENDEDOR
  if (
    norm.includes('vendedor') ||
    norm.includes('asesor') ||
    norm.includes('humano') ||
    norm === '3' ||
    norm.includes('contacto') ||
    norm.includes('persona') ||
    norm.includes('asesores') ||
    norm.includes('hablar con alguien')
  ) {
    recordMetric('consulta_vendedor', text, jid);
    return handleSellersResponse(pushName);
  }

  // 25. Detección de CASHEA Inteligente (Nivel + Repuesto o Cashea general)
  if (
    norm.includes('cashea') ||
    norm === '2' ||
    norm.includes('financiamiento') ||
    norm.includes('cuotas') ||
    norm.includes('inicial') ||
    norm.includes('nivel')
  ) {
    recordMetric('consulta_cashea', text, jid);
    return handleCasheaSmart(text, norm, settings, tasa, session);
  }

  // 26. Detección de UBICACIÓN / GOOGLE MAPS
  if (
    norm.includes('ubicacion') ||
    norm.includes('direccion') ||
    norm.includes('mapa') ||
    norm.includes('maps') ||
    norm.includes('donde estan') ||
    norm.includes('donde queda') ||
    norm.includes('tienda') ||
    norm === '4'
  ) {
    recordMetric('consulta_ubicacion', text, jid);
    return handleLocationResponse(settings);
  }

  // 27. Selección Contextual de Producto Anterior (ej: "el primero", "el 1", "el segundo", "opción 2")
  const contextResult = handleContextualSelection(norm, session, tasa, settings);
  if (contextResult) {
    return contextResult;
  }

  // 28. Saludos o petición de Menú
  if (
    norm === 'hola' ||
    norm.startsWith('hola ') ||
    norm.includes('buenos dias') ||
    norm.includes('buenas tardes') ||
    norm.includes('buenas noches') ||
    norm === 'buenas' ||
    norm === 'menu' ||
    norm === 'inicio' ||
    norm === 'catalogo' ||
    norm === '1' ||
    norm === 'ayuda' ||
    norm === 'info' ||
    norm === 'informacion' ||
    norm.includes('epale')
  ) {
    recordMetric('saludo_menu', text, jid);
    return handleGreetingResponse(pushName, settings, tasa);
  }

  // 28b. Búsqueda Multi-Producto / Carrito de Compras (ej: "pastillas aveo y aceite 20w50")
  const multiProducts = searchMultipleProducts(text);
  if (multiProducts.length >= 2) {
    recordMetric('busqueda_multi_producto', `${multiProducts.length} repuestos`, jid);

    const contextJson = JSON.stringify(multiProducts.map(p => ({
      id: p.id,
      marca: p.marca,
      modelo: p.modelo,
      precio_usd: p.precio_usd,
      categoria: p.categoria
    })));

    const comboTitle = `Combo (${multiProducts.length} repuestos): ` + multiProducts.map(p => `${p.marca} ${p.modelo}`).join(' + ');

    db.prepare(`
      UPDATE chat_sessions
      SET ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          contexto_productos = ?,
          seguimiento_enviado = 0
      WHERE jid = ?
    `).run(multiProducts[0].id, comboTitle, contextJson, jid);

    return handleMultiProductResults(multiProducts, tasa, settings, session);
  }

  // 29. Búsqueda Difusa de Productos en SQLite (Fuzzy Search con Levenshtein)
  const productSearchResults = searchProductsFuzzy(text);
  if (productSearchResults.length > 0) {
    const firstProd = productSearchResults[0];
    recordMetric('busqueda_producto', `${firstProd.marca} ${firstProd.modelo}`, jid);

    // Guardar contexto de los productos encontrados en la sesión
    const contextJson = JSON.stringify(productSearchResults.map(p => ({
      id: p.id,
      marca: p.marca,
      modelo: p.modelo,
      precio_usd: p.precio_usd,
      categoria: p.categoria
    })));

    db.prepare(`
      UPDATE chat_sessions
      SET ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          contexto_productos = ?,
          seguimiento_enviado = 0
      WHERE jid = ?
    `).run(firstProd.id, `${firstProd.marca} ${firstProd.modelo}`, contextJson, jid);

    // Si encontró exactamente 1 producto, mostrar directamente su ficha detallada
    if (productSearchResults.length === 1) {
      return handleSingleProductDetail(firstProd, tasa, settings, session);
    }

    return handleProductResults(productSearchResults, tasa, settings, session);
  }

  // 30. Si consultó por carros y no hubo match en inventario
  if (norm.includes('carro') || norm.includes('auto') || norm.includes('vehiculo')) {
    recordMetric('consulta_carro_no_match', text, jid);
    return handleCarInquiryResponse();
  }

  // 31. Mensaje por defecto cuando no coincide nada
  recordMetric('consulta_sin_match', text, jid);
  return handleDefaultFallback(pushName, settings);
}

module.exports = {
  processIncomingMessage,
  searchProductsFuzzy,
  handleGreetingResponse,
  handleCasheaResponse,
  handleSellersResponse,
  handleLocationResponse,
  handleCarInquiryResponse,
  checkPendingFollowUps
};
