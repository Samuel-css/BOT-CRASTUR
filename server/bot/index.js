const {
  db,
  getSettings,
  getEffectiveRate,
  recordMetric,
  isBotPaused,
  isBotGloballyPaused
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
  handleBinancePaymentResponse,
  handleWholesaleQueryResponse,
  handleInvoicingQueryResponse,
  handleStoreHoursResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse,
  handleLocationResponse,
  handleCarInquiryResponse,
  handleElderlyOrConfusedResponse,
  handleHostilityOrComplaintResponse,
  handleCategoryBrowseResponse
} = require('./handlers/infoHandlers');
const { handleCasheaSmart, handleCasheaResponse } = require('./handlers/casheaHandlers');
const {
  handleProductResults,
  handleSingleProductDetail,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
} = require('./handlers/productHandlers');
const { handleSellersResponse } = require('./handlers/advisoryHandlers');
const { handleDefaultFallback } = require('./handlers/fallbackHandlers');
const {
  handleCatalogMenuResponse,
  handleCatalogPdfDelivery
} = require('./handlers/catalogHandlers');

// Flujo de Apartados y Seguimiento
const {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
} = require('./apartado/apartadoFlow');
const { checkPendingFollowUps, check22hReservationReminders } = require('./followUp/followUpService');

/**
 * Enrutador principal de mensajes de WhatsApp
 * Procesa el mensaje recibido y genera la respuesta adecuada
 */
function processIncomingMessage(jid, rawText, pushName = 'amigo/a', mediaInfo = null) {
  const now = Date.now();

  // Limitar tamaño de entrada por seguridad (máx 2000 caracteres)
  let safeRawText = typeof rawText === 'string' ? rawText : '';
  if (safeRawText.length > 2000) {
    safeRawText = safeRawText.slice(0, 2000);
  }

  const text = safeRawText.trim();
  const norm = normalizeText(text);

  // Obtener o inicializar sesión de chat
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

  // Auto-capturar teléfono de contacto si el cliente escribe un número telefónico en su mensaje
  if (text) {
    const { extractVenezuelanPhones } = require('./utils/formatters');
    const autoExtracted = extractVenezuelanPhones(text);
    if (autoExtracted && autoExtracted.summary && (!session.telefono_contacto || session.telefono_contacto === 'Cuenta de WhatsApp')) {
      try {
        db.prepare('UPDATE chat_sessions SET telefono_contacto = ? WHERE jid = ?').run(autoExtracted.summary, jid);
        session.telefono_contacto = autoExtracted.summary;
      } catch (e) {}
    }
  }

  // Guardar mensaje en el registro (SIEMPRE se almacena para que el asesor pueda leerlo en Live Inbox aunque el bot esté pausado)
  const contentToStore = text || (mediaInfo && mediaInfo.isMedia ? `[Mensaje ${mediaInfo.type || 'Multimedia'}]` : '');
  if (contentToStore) {
    db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'cliente', ?, ?)
    `).run(jid, contentToStore, now);
  }

  // 0. Si el bot está pausado globalmente desde la interfaz, registrar mensaje pero no responder
  if (isBotGloballyPaused()) {
    console.log('[Bot] Silenciado globalmente por el panel administrativo. Mensaje guardado en Live Inbox.');
    return null;
  }

  // 1. Si el bot fue pausado manualmente por un asesor en este chat, registrar mensaje pero no responder
  if (isBotPaused(jid)) {
    console.log(`[Bot] Chat ${jid} está pausado manualmente. Mensaje de cliente guardado en Live Inbox para el asesor.`);
    return null;
  }

  // 2. Protección anti-spam
  if (isSpamming(jid)) {
    return null; // Silenciar sin responder para no alimentar el spam
  }

  const settings = getSettings();
  const tasa = getEffectiveRate();

  // Si el mensaje son puros signos de interrogación o confusión ("???", "¿?")
  const onlyQuestionMarks = rawText && /^[\?\¿\s]+$/.test(rawText.trim());
  if (onlyQuestionMarks) {
    recordMetric('consulta_persona_mayor_confundida', rawText, jid);
    return handleElderlyOrConfusedResponse(pushName, settings);
  }

  // Si el mensaje está vacío (y no es multimedia)
  if (!text && (!mediaInfo || !mediaInfo.isMedia)) {
    return `¡Hola, *${pushName}*! 😊 ¿En qué repuesto o insumo para tu moto o cauchera te podemos ayudar hoy? Puedes escribir el nombre del repuesto o escribir *MENU* para ver opciones.`;
  }

  // 3. Manejo de Mensajes Multimedia (Audios, Notas de voz, Fotos, Stickers)
  if (mediaInfo && mediaInfo.isMedia && !rawText) {
    recordMetric('mensaje_multimedia', mediaInfo.type, jid);

    // Si el usuario está en proceso de apartado y envía foto o audio
    if (session.step && session.step.startsWith('apartado_pidiendo_')) {
      if (mediaInfo.type === 'image') {
        return `📷 Veo que enviaste una imagen (o foto de documento). Para generar tu ticket de apartado por 24 horas automáticamente en caja, por favor escribe tus datos en texto ✍️\n_(Escribe *cancelar* si deseas salir)_`;
      }
      if (mediaInfo.type === 'audio' || mediaInfo.type === 'voice') {
        return `🎙️ Veo que enviaste una nota de voz. Por este canal procesamos los tickets por texto escrito. Por favor indícanos tus datos por mensaje escrito para completar tu apartado de 24 horas ✍️\n_(Escribe *cancelar* si deseas salir)_`;
      }
    }

    return handleMediaResponse(pushName, mediaInfo.type);
  }

  // 4. Manejo de cancelación de flujos
  const isCancel =
    norm === 'cancelar' ||
    norm === 'salir' ||
    norm === 'abortar' ||
    norm === 'cancela' ||
    norm.includes('cancel') ||
    norm.includes('ya no quiero') ||
    norm.includes('no quiero apartar') ||
    norm.includes('no voy a apartar') ||
    norm.includes('olvidalo') ||
    norm.includes('dejalo asi');

  if (isCancel) {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL, seguimiento_enviado = 1 WHERE jid = ?").run(jid);
    return `Operación cancelada 👍. ¿En qué más te podemos ayudar? Escribe el repuesto que buscas, *DELIVERY*, *CASHEA* o escribe *MENU* para volver al inicio.`;
  }

  // 4b. Manejo de quejas, hostilidad, insultos o acusaciones de estafa
  const isHostileOrComplaint =
    norm.includes('ladron') ||
    norm.includes('estafa') ||
    norm.includes('trampos') ||
    norm.includes('coño') ||
    norm.includes('cono de tu madre') ||
    norm.includes('cono de su madre') ||
    norm.includes('cono de la madre') ||
    norm.includes('maldit') ||
    norm.includes('hijos de puta') ||
    norm.includes('hdp') ||
    norm.includes('mierda') ||
    norm.includes('mamaguevo') ||
    norm.includes('pajuo') ||
    norm.includes('desgraciad') ||
    norm.includes('mal servicio') ||
    norm.includes('vayanse al carajo');

  if (isHostileOrComplaint) {
    recordMetric('queja_hostilidad', text, jid);
    return handleHostilityOrComplaintResponse(pushName, settings);
  }

  // 4c. Manejo para personas mayores, confundidas o no familiarizadas con asistentes virtuales
  const isElderlyOrConfused =
    norm.includes('no se como se usa') ||
    norm.includes('no se usar esto') ||
    norm.includes('no se de esto') ||
    norm.includes('no entiendo nada') ||
    norm.includes('no entiendo como') ||
    norm.includes('con quien hablo') ||
    norm.includes('con quien me comunico') ||
    norm.includes('quien me atiende') ||
    norm.includes('hay alguien ahi') ||
    norm.includes('hay alguien') ||
    norm.includes('es una persona') ||
    norm.includes('es una computadora') ||
    norm.includes('es un robot') ||
    norm.includes('eres un robot') ||
    norm.includes('eres un bot') ||
    norm.includes('esto es un robot') ||
    norm.includes('me pueden llamar') ||
    norm.includes('llamenme') ||
    norm.includes('deme su numero') ||
    norm.includes('deme un numero') ||
    norm.includes('disculpe la molestia') ||
    norm.includes('buenas tardes caballero') ||
    norm.includes('buenas tardes senor') ||
    norm.includes('buenos dias senor') ||
    norm === '???';

  if (isElderlyOrConfused) {
    recordMetric('consulta_persona_mayor_confundida', text, jid);
    return handleElderlyOrConfusedResponse(pushName, settings);
  }

  // 5. Máquina de estados para APARTADOS (Límite 24 Horas)
  if (session.step === 'apartado_pidiendo_nombre') {
    return handleApartadoNombre(jid, text, session, tasa, settings);
  }
  if (session.step === 'apartado_pidiendo_cedula') {
    return handleApartadoCedula(jid, text, session, tasa, settings);
  }
  if (session.step === 'apartado_pidiendo_telefono') {
    return handleApartadoTelefono(jid, text, session, tasa, settings);
  }

  // 5b. Máquina de estados para selección interactiva de Catálogo en PDF
  if (session.step === 'menu_catalogo_pdf') {
    if (norm === '1' || norm === '1️⃣' || norm.includes('cauchera') || norm.includes('caucho') || norm.includes('parche')) {
      recordMetric('catalogo_pdf_cauchera', text, jid);
      return handleCatalogPdfDelivery('Insumos Cauchera', settings, tasa, session, jid);
    }
    if (norm === '2' || norm === '2️⃣' || norm.includes('repuesto') || norm.includes('moto') || norm.includes('arrastre')) {
      recordMetric('catalogo_pdf_repuestos', text, jid);
      return handleCatalogPdfDelivery('Repuestos Moto', settings, tasa, session, jid);
    }
    if (norm === '3' || norm === '3️⃣' || norm.includes('accesorio') || norm.includes('casco') || norm.includes('luz')) {
      recordMetric('catalogo_pdf_accesorios', text, jid);
      return handleCatalogPdfDelivery('Accesorios Moto', settings, tasa, session, jid);
    }
    if (norm === '4' || norm === '4️⃣' || norm.includes('otro') || norm.includes('aceite') || norm.includes('lubricante') || norm.includes('motul')) {
      recordMetric('catalogo_pdf_otros', text, jid);
      return handleCatalogPdfDelivery('Otros Productos', settings, tasa, session, jid);
    }
    if (norm === '5' || norm === '5️⃣' || norm.includes('todo') || norm.includes('completo') || norm.includes('general')) {
      recordMetric('catalogo_pdf_todos', text, jid);
      return handleCatalogPdfDelivery('Todos', settings, tasa, session, jid);
    }
    // Si no fue una opción 1..5, restablecer step a 'start' y permitir que el router procese la consulta
    db.prepare("UPDATE chat_sessions SET step = 'start' WHERE jid = ?").run(jid);
    session.step = 'start';
  }

  // 6. Agradecimientos, Despedidas y Cortesía ("gracias", "chévere", "fino", etc.)
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
    (norm.startsWith('si ') && norm.length < 18 && !norm.includes('pago') && !norm.includes('descuento') && !norm.includes('dolares') && !norm.includes('apartar')) ||
    (norm.startsWith('ok ') && norm.length < 18)
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
    db.prepare("UPDATE chat_sessions SET seguimiento_enviado = 1 WHERE jid = ?").run(jid);
    return handleNegativeResponse();
  }

  // 7b. Consulta de Binance Pay / USDT / Cripto
  if (
    norm.includes('binance') ||
    norm.includes('usdt') ||
    norm.includes('binance pay') ||
    norm.includes('cripto') ||
    norm.includes('crypto')
  ) {
    recordMetric('consulta_binance', text, jid);
    return handleBinancePaymentResponse(tasa, settings);
  }

  // 7c. Consulta de Ventas al Mayor / Cajas / Bultos / Talleres / Caucheras
  if (
    norm.includes('al mayor') ||
    norm.includes('por mayor') ||
    norm.includes('precio al mayor') ||
    norm.includes('precios al mayor') ||
    norm.includes('por bulto') ||
    norm.includes('por caja') ||
    norm.includes('cajas cerradas') ||
    norm.includes('para taller') ||
    norm.includes('para cauchera') ||
    norm.includes('descuento por cantidad') ||
    norm.includes('descuento por volumen') ||
    norm.includes('catalogo mayorista') ||
    norm.includes('somos taller') ||
    norm.includes('somos cauchera') ||
    norm.includes('tengo una cauchera') ||
    norm.includes('tengo un taller')
  ) {
    recordMetric('consulta_mayorista', text, jid);
    return handleWholesaleQueryResponse(pushName, settings);
  }

  // 7d. Consulta de Combos, Kits y Promociones de Instagram
  if (
    norm.includes('combo') ||
    norm.includes('combos') ||
    norm.includes('kit') ||
    norm.includes('kits') ||
    norm.includes('instagram') ||
    norm.includes('promo') ||
    norm.includes('promos') ||
    norm.includes('promocion') ||
    norm.includes('promociones') ||
    norm.includes('vi en ig') ||
    norm.includes('vi en instagram') ||
    norm.includes('publicacion')
  ) {
    recordMetric('consulta_combos_instagram', text, jid);
    return handleInstagramCombosResponse(text, tasa, settings, session, jid);
  }

  // 7e. Solicitud de Catálogos Oficiales en PDF (Por Categoría o Menú Guiado)
  const isCatalogPdfQuery =
    norm.includes('catalogo') ||
    norm.includes('catalogos') ||
    norm.includes('lista de precios') ||
    norm.includes('listado de precios') ||
    norm === 'pdf' ||
    norm === 'en pdf' ||
    norm === 'el pdf' ||
    norm.includes('en pdf') ||
    norm.includes('el pdf');

  if (isCatalogPdfQuery) {
    recordMetric('consulta_catalogo_pdf', text, jid);

    // 1. Si especificó Insumos de Cauchera
    if (norm.includes('cauchera') || norm.includes('caucho') || norm.includes('parche') || norm.includes('valvula')) {
      return handleCatalogPdfDelivery('Insumos Cauchera', settings, tasa, session, jid);
    }

    // 2. Si especificó Repuestos de Moto
    if (norm.includes('repuesto') || norm.includes('moto') || norm.includes('arrastre') || norm.includes('freno')) {
      return handleCatalogPdfDelivery('Repuestos Moto', settings, tasa, session, jid);
    }

    // 3. Si especificó Accesorios de Moto
    if (norm.includes('accesorio') || norm.includes('casco') || norm.includes('guante') || norm.includes('luz')) {
      return handleCatalogPdfDelivery('Accesorios Moto', settings, tasa, session, jid);
    }

    // 4. Si especificó Lubricantes / Otros
    if (norm.includes('otro') || norm.includes('aceite') || norm.includes('lubricante') || norm.includes('motul')) {
      return handleCatalogPdfDelivery('Otros Productos', settings, tasa, session, jid);
    }

    // 5. Si especificó Catálogo Completo / General
    if (norm.includes('todo') || norm.includes('completo') || norm.includes('general')) {
      return handleCatalogPdfDelivery('Todos', settings, tasa, session, jid);
    }

    // 6. Si solo escribió "pdf" y estaba viendo productos previamente en el chat
    if ((norm === 'pdf' || norm === 'en pdf' || norm === 'el pdf' || norm === 'descargar pdf') && session.contexto_productos) {
      try {
        const parsed = JSON.parse(session.contexto_productos);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].categoria) {
          return handleCatalogPdfDelivery(parsed[0].categoria, settings, tasa, session, jid);
        }
      } catch (e) {}
    }

    // 7. En cualquier otro caso genérico ("catalogo", "pásame el catálogo", "tienen catálogo?"):
    return handleCatalogMenuResponse(settings, tasa, session, jid);
  }

  // 8. Aclaratoria de Medios de Pago no aceptados (Zelle, Banesco Panamá, Punto de Venta)
  if (
    norm.includes('zelle') ||
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
    norm.includes('transferencia')
  ) {
    recordMetric('consulta_pagos', text, jid);
    return handlePaymentMethodsResponse(tasa, settings);
  }

  // 18. Detección de intención de APARTAR / RESERVAR (24H)
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
    if (settings.fuera_horario_activo === '1' && !isWithinBusinessHours()) {
      return handleOutOfHoursTransactionResponse(settings, 'apartar');
    }
    return initiateApartadoFlow(jid, text, norm, session, tasa, settings, pushName);
  }

  // 18b. Búsqueda Multi-Producto / Carrito de Compras (Combo con o sin Delivery/Cashea)
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

    return handleMultiProductResults(multiProducts, tasa, settings, session, text);
  }

  // 19. Delivery y Envíos (Solo delivery a Caracas y retiro en local) o Dirección de Entrega
  const { detectCaracasZone } = require('./utils/caracasDelivery');
  const detectedDeliveryZone = detectCaracasZone(text, settings);
  const isAddressText = /\b(av|avenida|esquina|calle|torre|edificio|residencia|edif|piso|apto|apartamento|baralt)\b/i.test(text);

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
    norm.includes('a todas caracas') ||
    (detectedDeliveryZone && isAddressText)
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

  // 24. Selección Contextual de Producto Anterior (ej: "el primero", "el 1", "el segundo", "opción 2")
  const contextResult = handleContextualSelection(norm, session, tasa, settings);
  if (contextResult) {
    return contextResult;
  }

  // 25. Opciones del Menú Principal y Categorías Canónicas Oficiales (1..6)
  // 1️⃣ Insumos Cauchera
  if (
    norm === '1' ||
    norm === '1️⃣' ||
    norm === 'opcion 1' ||
    norm === 'insumos cauchera' ||
    norm === 'insumos para cauchera' ||
    norm === 'insumos para caucheras' ||
    norm === 'cauchera' ||
    norm === 'caucheras'
  ) {
    recordMetric('categoria_insumos_cauchera', text, jid);
    return handleCategoryBrowseResponse('Insumos Cauchera', settings, tasa, session, jid);
  }

  // 2️⃣ Repuestos Moto
  if (
    norm === '2' ||
    norm === '2️⃣' ||
    norm === 'opcion 2' ||
    norm === 'repuestos moto' ||
    norm === 'repuestos para moto' ||
    norm === 'repuestos de moto' ||
    norm === 'repuesto moto' ||
    norm === 'repuesto de moto' ||
    norm === 'repuestos motos'
  ) {
    recordMetric('categoria_repuestos_moto', text, jid);
    return handleCategoryBrowseResponse('Repuestos Moto', settings, tasa, session, jid);
  }

  // 3️⃣ Accesorios Moto
  if (
    norm === '3' ||
    norm === '3️⃣' ||
    norm === 'opcion 3' ||
    norm === 'accesorios moto' ||
    norm === 'accesorios para moto' ||
    norm === 'accesorios de moto' ||
    norm === 'accesorio moto' ||
    norm === 'accesorios'
  ) {
    recordMetric('categoria_accesorios_moto', text, jid);
    return handleCategoryBrowseResponse('Accesorios Moto', settings, tasa, session, jid);
  }

  // 4️⃣ Otros Productos
  if (
    norm === '4' ||
    norm === '4️⃣' ||
    norm === 'opcion 4' ||
    norm === 'otros productos' ||
    norm === 'otros' ||
    norm === 'otro producto'
  ) {
    recordMetric('categoria_otros_productos', text, jid);
    return handleCategoryBrowseResponse('Otros Productos', settings, tasa, session, jid);
  }

  // 5️⃣ Cashea en Tienda
  if (
    norm === '5' ||
    norm === '5️⃣' ||
    norm === 'opcion 5'
  ) {
    recordMetric('menu_opcion_cashea', text, jid);
    return handleCasheaSmart(text, norm, settings, tasa, session);
  }

  // 6️⃣ Hablar con un Asesor / Vendedor
  if (
    norm === '6' ||
    norm === '6️⃣' ||
    norm === 'opcion 6' ||
    norm === 'vendedor' ||
    norm === 'asesor' ||
    norm === 'humano' ||
    norm.includes('vendedor') ||
    norm.includes('asesor') ||
    norm.includes('humano') ||
    norm.includes('contacto') ||
    norm.includes('persona') ||
    norm.includes('asesores') ||
    norm.includes('hablar con alguien')
  ) {
    recordMetric('consulta_vendedor', text, jid);
    return handleSellersResponse(pushName);
  }

  // 26. Detección de CASHEA Inteligente (Nivel + Repuesto o Cashea general)
  if (
    norm.includes('cashea') ||
    norm.includes('financiamiento') ||
    norm.includes('cuotas') ||
    norm.includes('inicial') ||
    norm.includes('nivel')
  ) {
    recordMetric('consulta_cashea', text, jid);
    return handleCasheaSmart(text, norm, settings, tasa, session);
  }

  // 27. Detección de UBICACIÓN / GOOGLE MAPS
  if (
    norm === 'donde' ||
    norm.startsWith('donde ') ||
    norm.includes('ubicacion') ||
    norm.includes('direccion') ||
    norm.includes('mapa') ||
    norm.includes('maps') ||
    norm.includes('donde estan') ||
    norm.includes('donde queda') ||
    norm.includes('donde quedan') ||
    norm.includes('donde es') ||
    norm.includes('que parte') ||
    norm.includes('q parte') ||
    norm.includes('por donde') ||
    norm.includes('quedan') ||
    norm.includes('qdan') ||
    norm.includes('se ubican') ||
    norm.includes('se encuentran') ||
    norm.includes('tienda fisica') ||
    norm.includes('tienda')
  ) {
    recordMetric('consulta_ubicacion', text, jid);
    return handleLocationResponse(settings);
  }

  // 29. Búsqueda Difusa de Productos en SQLite (Fuzzy Search con Levenshtein)
  const productSearchResults = searchProductsFuzzy(text);
  if (productSearchResults.length > 0) {
    const firstProd = productSearchResults[0];
    recordMetric('busqueda_producto', `${firstProd.marca} ${firstProd.modelo}`, jid);

    // Acumular historial de productos recientes (para permitir "apartar ambos", "los dos", etc.)
    let prevHistory = [];
    try {
      prevHistory = JSON.parse(session?.contexto_productos || '[]');
      if (!Array.isArray(prevHistory)) prevHistory = [];
    } catch (e) {
      prevHistory = [];
    }

    const currentMatches = productSearchResults.map(p => ({
      id: p.id,
      marca: p.marca,
      modelo: p.modelo,
      precio_usd: p.precio_usd,
      categoria: p.categoria
    }));

    // El producto actual va al principio, seguido por los anteriores únicos
    const combinedHistory = [...currentMatches];
    for (const h of prevHistory) {
      if (!combinedHistory.some(c => c.id === h.id)) {
        combinedHistory.push(h);
      }
    }
    const contextJson = JSON.stringify(combinedHistory.slice(0, 4));

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

  // 30. Consulta general de Repuestos para Moto (cuando no hubo match específico en catálogo)
  if (
    norm.includes('para moto') ||
    norm.includes('de moto') ||
    norm.includes('repuestos de moto') ||
    norm.includes('repuesto de moto') ||
    norm.includes('cosas de moto') ||
    norm.includes('para motos') ||
    norm === 'moto' ||
    norm.includes('motocicleta') ||
    norm.includes('scooter')
  ) {
    recordMetric('consulta_motos', text, jid);
    return handleMotoQueryResponse();
  }

  // 30b. Consulta general de Cauchera / Llantas / Insumos (cuando no hubo match específico en catálogo)
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
    norm.includes('neumatico')
  ) {
    recordMetric('consulta_cauchera', text, jid);
    return handleCaucheraQueryResponse();
  }

  // 31. Saludos puros o petición de Menú (cuando no se consultó un producto específico)
  if (
    norm === 'hola' ||
    norm.startsWith('hola ') ||
    norm.includes('buenos dias') ||
    norm.includes('buenas tardes') ||
    norm.includes('buenas noches') ||
    norm === 'buenas' ||
    norm === 'menu' ||
    norm === 'inicio' ||
    norm === 'ayuda' ||
    norm === 'info' ||
    norm === 'informacion' ||
    norm.includes('epale')
  ) {
    recordMetric('saludo_menu', text, jid);
    if (jid) {
      try {
        db.prepare("UPDATE chat_sessions SET contexto_productos = NULL, step = 'start' WHERE jid = ?").run(jid);
      } catch {}
    }
    return handleGreetingResponse(pushName, settings, tasa);
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
  handleCatalogMenuResponse,
  handleCatalogPdfDelivery,
  checkPendingFollowUps,
  check22hReservationReminders
};
