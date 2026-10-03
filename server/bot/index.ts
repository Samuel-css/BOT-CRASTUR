/**
 * @file index.ts
 * @description Enrutador semántico central del bot de WhatsApp para Crastur Caracas.
 * 
 * [ARQUITECTURA DE ENRUTAMIENTO]
 * Evalúa los mensajes entrantes a través de un árbol de decisión jerárquico ordenado por prioridad:
 * 1. Filtros de seguridad e integridad: Pausa global, pausa por asesor, anti-spam y sanitización de entrada.
 * 2. Mensajería multimedia y estados interactivos de flujo (máquina de estados de apartados y menú de catálogos).
 * 3. Intenciones de cortesía, desuscripción voluntaria (opt-out), reclamos y prevención de hostilidad.
 * 4. Reglas de negocio operativas: Cripto/Binance, combos Instagram, catálogo PDF, medios de pago y tasa BCV.
 * 5. Logística física en Caracas: Delivery motorizado, horarios de tienda, retiro inmediato, puntos de referencia y garantía.
 * 6. Carrito multi-producto y activación de apartado por 24 horas.
 * 7. Búsqueda difusa de productos en inventario SQLite mediante algoritmo de Levenshtein ponderado.
 * 8. Menú principal canónico (opciones 1 a 6), asesor humano y fallback interactivo.
 * 
 * [ANTI-BANEO META 2025]
 * - Límite de entrada estricto (máx 2000 caracteres) para prevenir ataques de desbordamiento de búfer.
 * - TTL de sesión de 24 horas: limpieza de contexto obsoleto si el usuario regresa tras 1 día de inactividad.
 * - Respeto irrestricto al comando "no molestar" / "salir" para garantizar listas limpias.
 * 
 * [MERCADO VENEZUELA]
 * - Manejo contextual de modismos locales (p. ej. "coño" no hostil, "chamo", "fino", "epale").
 * - Soporte para métodos de pago venezolanos: Pago Móvil BCV, Cashea (Niveles 1-3), Efectivo USD y Binance Pay.
 */

import type { BotMediaInfo, BotResponse } from '../types/bot';

import {
  db,
  getSettings,
  getEffectiveRate,
  recordMetric
} from '../database';

// Utilidades y Reglas de Negocio
import { normalizeText } from './utils/textUtils';
import { isWithinBusinessHours, handleOutOfHoursTransactionResponse } from './services/businessRules';
import { searchProductsFuzzy, searchMultipleProducts } from './services/searchService';
import { extractVenezuelanPhones } from './utils/formatters';
import { detectCaracasZone } from './utils/caracasDelivery';

// Handlers de Respuestas Especializados
import {
  handleGreetingResponse,
  handleCourtesyResponse,
  handleAffirmativeResponse,
  handleNegativeResponse
} from './handlers/greetingHandlers';
import {
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
  handleInvoicingQueryResponse,
  handleStoreHoursResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse,
  handleLocationResponse,
  handleCarInquiryResponse,
  handleCategoryBrowseResponse
} from './handlers/infoHandlers';
import { handleCasheaSmart, handleCasheaResponse } from './handlers/casheaHandlers';
import {
  handleProductResults,
  handleSingleProductDetail,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
} from './handlers/productHandlers';
import { handleSellersResponse } from './handlers/advisoryHandlers';
import { handleDefaultFallback, handleSecondFallback } from './handlers/fallbackHandlers';
import { runWebIntents } from './handlers/webIntentHandlers';
import {
  handleCatalogMenuResponse,
  handleCatalogPdfDelivery
} from './handlers/catalogHandlers';

// Flujo de Apartados y Seguimiento Comercial
import {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
} from './apartado/apartadoFlow';
import { checkPendingFollowUps, check22hReservationReminders } from './followUp/followUpService';

// Módulos de enrutamiento extraídos (guards y comandos de flujo)
import { runGuards, SILENCE } from './router/guards';
import { runFlowCommands } from './router/flowCommands';

/**
 * Procesa un mensaje entrante de WhatsApp y genera la respuesta automática correspondiente.
 * 
 * @param jid - JID único del usuario en WhatsApp (ej. '584121234567@s.whatsapp.net')
 * @param rawText - Texto original del mensaje
 * @param pushName - Nombre público del perfil del cliente (o valor por defecto seguro)
 * @param mediaInfo - Metadatos si el mensaje contiene audio, imagen o documento
 * @returns Cadena con la respuesta textual, objeto con documento/imagen, o null si debe silenciarse.
 */
function processIncomingMessageCore(
  jid: string,
  rawText: string,
  pushName: string = 'amigo/a',
  mediaInfo: BotMediaInfo | null = null
): any {
  const now = Date.now();

  // Sanitización de pushName: previene valores vacíos o espacios cuando el cliente tiene privacidad estricta
  const safePushName = (typeof pushName === 'string' && pushName.trim().length >= 2)
    ? pushName.trim()
    : 'amigo/a';
  pushName = safePushName;

  // Límite de longitud de entrada por seguridad (máx 2000 caracteres)
  let safeRawText = typeof rawText === 'string' ? rawText : '';
  if (safeRawText.length > 2000) {
    safeRawText = safeRawText.slice(0, 2000);
  }

  const text = safeRawText.trim();
  const norm = normalizeText(text);

  // Inicialización o recuperación de la sesión de chat en SQLite
  let session = db.prepare('SELECT * FROM chat_sessions WHERE jid = ?').get(jid);
  if (!session) {
    db.prepare(`
      INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
      VALUES (?, ?, 'start', ?, 0, 0, 1)
    `).run(jid, pushName, now);
    session = { jid, push_name: pushName, step: 'start', ultimo_mensaje_at: now, seguimiento_enviado: 0, bot_pausado: 0, nivel_cashea: 1 };
  } else {
    // TTL de 24 horas: si el cliente regresa tras más de 24h de inactividad, limpiar contexto obsoleto
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (session.ultimo_mensaje_at && (now - session.ultimo_mensaje_at > TWENTY_FOUR_HOURS)) {
      if (session.step && session.step !== 'start') {
        session.step = 'start';
      }
      session.contexto_productos = null;
      session.apartado_metadata = null;
      db.prepare(`
        UPDATE chat_sessions
        SET step = 'start', contexto_productos = NULL, apartado_metadata = NULL, push_name = ?, ultimo_mensaje_at = ?
        WHERE jid = ?
      `).run(pushName, now, jid);
    } else {
      db.prepare(`
        UPDATE chat_sessions
        SET push_name = ?, ultimo_mensaje_at = ?
        WHERE jid = ?
      `).run(pushName, now, jid);
    }
  }

  // Captura pasiva del teléfono de contacto si el cliente escribe un número venezolano
  if (text) {
    const autoExtracted = extractVenezuelanPhones(text);
    if (autoExtracted && autoExtracted.summary && (!session.telefono_contacto || session.telefono_contacto === 'Cuenta de WhatsApp')) {
      try {
        db.prepare('UPDATE chat_sessions SET telefono_contacto = ? WHERE jid = ?').run(autoExtracted.summary, jid);
        session.telefono_contacto = autoExtracted.summary;
      } catch (e) {}
    }
  }

  // Registro del mensaje entrante en auditoría (permite lectura en el Live Inbox incluso con bot pausado)
  const contentToStore = text || (mediaInfo && mediaInfo.isMedia ? `[Mensaje ${mediaInfo.type || 'Multimedia'}]` : '');
  if (contentToStore) {
    db.prepare(`
      INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
      VALUES (?, 'cliente', ?, ?)
    `).run(jid, contentToStore, now);
  }

  // Consulta de configuración y tasa de cambio oficial activa
  const settings = getSettings();
  const tasa = getEffectiveRate();

  // ============================================================================
  // [SECCIONES 0-3] Guardas de silenciamiento, anti-spam, entradas confusas y multimedia
  // (ver server/bot/router/guards.ts)
  // ============================================================================
  const guardResult = runGuards(jid, text, pushName, mediaInfo, session);
  if (guardResult === SILENCE) return null;
  if (guardResult !== null) return guardResult;

  // ============================================================================
  // [SECCIONES 4-4d] Cancelación, opt-out, hostilidad y atención especial
  // (ver server/bot/router/flowCommands.ts)
  // ============================================================================
  const flowResult = runFlowCommands(jid, text, norm, pushName, session);
  if (flowResult !== null) return flowResult;

  // ============================================================================
  // [SECCIÓN 4e] Intenciones provenientes de la PÁGINA WEB
  // Los botones de la web generan mensajes concretos (cascos, cauchos por medida,
  // lubricantes de marca, delivery y consultas comerciales). Se evalúan
  // temprano para garantizar que SIEMPRE reciban una respuesta útil y nunca un fallback.
  // ============================================================================
  const webIntent = runWebIntents(norm, text, pushName, settings, tasa);
  if (webIntent) {
    recordMetric('consulta_desde_web', text.slice(0, 80), jid);
    return webIntent;
  }

  // ============================================================================
  // [SECCIÓN 5] Máquina de Estados: Flujo de Apartados (Límite 24 Horas)
  // ============================================================================
  if (session.step === 'apartado_pidiendo_nombre') {
    return handleApartadoNombre(jid, text, session, tasa, settings);
  }

  if (session.step === 'apartado_pidiendo_cedula') {
    return handleApartadoCedula(jid, text, session, tasa, settings);
  }

  if (session.step === 'apartado_pidiendo_telefono') {
    return handleApartadoTelefono(jid, text, session, tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 5b] Máquina de Estados: Catálogo Interactivo en PDF
  // ============================================================================
  if (session.step === 'catalogo_esperando_opcion') {
    const opcion = norm.trim();
    if (opcion === '1' || opcion === '1️⃣' || opcion.includes('cauchera')) {
      return handleCatalogPdfDelivery('Insumos Cauchera', settings, tasa, session, jid);
    } else if (opcion === '2' || opcion === '2️⃣' || opcion.includes('repuesto') || opcion.includes('moto')) {
      return handleCatalogPdfDelivery('Repuestos Moto', settings, tasa, session, jid);
    } else if (opcion === '3' || opcion === '3️⃣' || opcion.includes('accesorio')) {
      return handleCatalogPdfDelivery('Accesorios Moto', settings, tasa, session, jid);
    } else if (opcion === '4' || opcion === '4️⃣' || opcion.includes('otro') || opcion.includes('lubricante')) {
      return handleCatalogPdfDelivery('Otros Productos', settings, tasa, session, jid);
    } else if (opcion === '5' || opcion === '5️⃣' || opcion.includes('todo') || opcion.includes('completo')) {
      return handleCatalogPdfDelivery('Todos', settings, tasa, session, jid);
    }
    // Si la entrada no corresponde a 1..5, restablecer step a 'start' y dejar fluir al router
    try {
      db.prepare("UPDATE chat_sessions SET step = 'start' WHERE jid = ?").run(jid);
      session.step = 'start';
    } catch (_) {}
  }

  // ============================================================================
  // [SECCIÓN 6] Cortesía, Agradecimientos y Despedidas
  // Detección por fragmentos para tolerar modismos venezolanos ("fino gracias mano").
  // ============================================================================
  const esCortesia =
    norm === 'gracias' ||
    norm === 'chevere' ||
    norm === 'fino' ||
    norm === 'todo fino' ||
    norm === 'chao' ||
    norm === 'adios' ||
    norm === 'hasta luego' ||
    norm === 'nos vemos' ||
    norm === 'buen dia' ||
    norm === 'feliz dia' ||
    norm === 'feliz tarde' ||
    norm === 'feliz noche' ||
    norm === 'ok' ||
    norm === 'listo mi pana' ||
    norm.includes('gracias') ||
    norm.includes('fino gracias') ||
    norm.includes('chevere gracias') ||
    norm.includes('todo fino') ||
    norm.includes('mil gracias') ||
    norm.includes('muy amable') ||
    norm.includes('excelente servicio') ||
    norm.includes('buen servicio');

  // No tratar como cortesía si es una consulta (contiene signos de pregunta o intención de producto)
  const pareceConsulta = text.includes('?') || text.includes('¿') ||
    norm.includes('cuanto') || norm.includes('precio') || norm.includes('tienen') ||
    norm.includes('quiero') || norm.includes('busco') || norm.includes('hay ') || norm.includes('necesito');

  if (esCortesia && !pareceConsulta) {
    return handleCourtesyResponse(pushName, settings);
  }

  // ============================================================================
  // [SECCIÓN 6b] Confirmaciones Cotidianas Fuera de Flujo ("sí", "ok", "dale")
  // ============================================================================
  // Solo capturar frases muy cortas para no interceptar consultas con "si" condicional
  if (
    norm === 'si' ||
    norm === 'si!' ||
    norm === 'ok' ||
    norm === 'ok!' ||
    norm === 'dale' ||
    norm === 'dale!' ||
    norm === 'claro' ||
    norm === 'seguro' ||
    norm === 'por favor' ||
    norm === 'porfa' ||
    norm === 'esta bien' ||
    norm === 'de acuerdo' ||
    norm === 'entendido' ||
    norm === 'copiado' ||
    (norm.startsWith('si ') && norm.length < 8 && !norm.includes('tienes') && !norm.includes('hay') && !norm.includes('precio') && !norm.includes('quiero') && !norm.includes('puedo')) ||
    (norm.startsWith('ok ') && norm.length < 10)
  ) {
    return handleAffirmativeResponse(pushName);
  }

  // ============================================================================
  // [SECCIÓN 7] Negaciones Cotidianas Fuera de Flujo ("no", "ya no")
  // ============================================================================
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
    norm === 'no por ahora' ||
    norm === 'luego' ||
    norm === 'en otro momento' ||
    (norm.startsWith('no ') && norm.length < 15 && !norm.includes('tienes') && !norm.includes('tienen') && !norm.includes('hay') && !norm.includes('tengo') && !norm.includes('se') && !norm.includes('sé') && !norm.includes('quiero') && !norm.includes('busco')) ||
    (norm.startsWith('ya no ') && norm.length < 20)
  ) {
    db.prepare("UPDATE chat_sessions SET seguimiento_enviado = 1 WHERE jid = ?").run(jid);
    return handleNegativeResponse();
  }

  // ============================================================================
  // [SECCIÓN 8] Consultas de Cripto / Binance Pay (USDT)
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 10] Promociones y Combos de Redes Sociales (Instagram)
  // ============================================================================
  const isKitProductSearch = norm.includes('kit de arrastre') || norm.includes('kit arrastre') ||
    norm.includes('kit de freno') || norm.includes('kit cadena') || norm.includes('kit pastilla');

  if (
    norm.includes('combo') ||
    norm.includes('combos') ||
    (!isKitProductSearch && norm.includes('kits')) ||
    (!isKitProductSearch && norm === 'kit') ||
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

  // ============================================================================
  // [SECCIÓN 11] Catálogos Oficiales en PDF por Categoría
  // ============================================================================
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

    // 1. Insumos de Cauchera
    if (norm.includes('cauchera') || norm.includes('caucho') || norm.includes('parche') || norm.includes('valvula')) {
      return handleCatalogPdfDelivery('Insumos Cauchera', settings, tasa, session, jid);
    }

    // 2. Repuestos de Moto
    if (norm.includes('repuesto') || norm.includes('moto') || norm.includes('arrastre') || norm.includes('freno')) {
      return handleCatalogPdfDelivery('Repuestos Moto', settings, tasa, session, jid);
    }

    // 3. Accesorios de Moto
    if (norm.includes('accesorio') || norm.includes('casco') || norm.includes('guante') ||
        (norm.includes('luz') && (norm.includes('led') || norm.includes('faro') || norm.includes('moto') || norm.includes('accesorio')))) {
      return handleCatalogPdfDelivery('Accesorios Moto', settings, tasa, session, jid);
    }

    // 4. Lubricantes / Otros
    if (norm.includes('otro') || norm.includes('aceite') || norm.includes('lubricante') || norm.includes('motul')) {
      return handleCatalogPdfDelivery('Otros Productos', settings, tasa, session, jid);
    }

    // 5. Catálogo Completo / General
    if (norm.includes('todo') || norm.includes('completo') || norm.includes('general')) {
      return handleCatalogPdfDelivery('Todos', settings, tasa, session, jid);
    }

    // 6. Solicitud directa de "pdf" sobre la categoría del producto consultado previamente
    if ((norm === 'pdf' || norm === 'en pdf' || norm === 'el pdf' || norm === 'descargar pdf') && session.contexto_productos) {
      try {
        const parsed = JSON.parse(session.contexto_productos);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].categoria) {
          return handleCatalogPdfDelivery(parsed[0].categoria, settings, tasa, session, jid);
        }
      } catch (e) {}
    }

    // 7. Menú interactivo por defecto
    return handleCatalogMenuResponse(settings, tasa, session, jid);
  }

  // ============================================================================
  // [SECCIÓN 12] Aclaratoria de Medios No Aceptados (Zelle, Banesco Panamá, etc.)
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 13] [MERCADO VENEZUELA] Consulta Directa de Tasa BCV Oficial
  // ============================================================================
  const isPaymentMethodContext = norm.includes('pago movil') || norm.includes('transferencia') || norm.includes('como pagar') || norm.includes('formas de pago') || norm.includes('metodos de pago') || norm.includes('aceptan');
  if (
    !isPaymentMethodContext && (
      norm.includes('a que tasa') ||
      norm.includes('cual es la tasa') ||
      norm.includes('que tasa') ||
      norm.includes('tasa bcv') ||
      norm.includes('tasa de hoy') ||
      norm.includes('tasa del dia') ||
      norm.includes('a como esta el dolar') ||
      norm.includes('a como reciben') ||
      norm.includes('precio del dolar') ||
      norm === 'tasa' ||
      norm === 'precio' ||
      norm === 'precios'
    )
  ) {
    recordMetric('consulta_tasa_bcv', text, jid);
    return handleRateQueryResponse(tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 14] [MERCADO VENEZUELA] Envíos Nacionales e Interior del País
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 15] Retiro Inmediato en Tienda Física
  // ============================================================================
  if (
    norm.includes('puedo ir ya') ||
    norm.includes('puedo pasar ya') ||
    norm.includes('puedo ir ahorita') ||
    norm.includes('puedo pasar ahorita') ||
    norm.includes('estan atendiendo ahorita') ||
    norm.includes('lo puedo retirar hoy') ||
    norm.includes('puedo retirar hoy') ||
    norm.includes('puedo retirar') ||
    norm.includes('retirar ya') ||
    norm.includes('retirar en la tienda') ||
    norm.includes('retirar en tienda') ||
    norm.includes('mandar a retirar') ||
    norm.includes('pasar a retirar') ||
    norm.includes('retirar yo mismo') ||
    norm.includes('retirar personalmente') ||
    norm.includes('lo busco ya')
  ) {
    recordMetric('consulta_retiro_inmediato', text, jid);
    return handleImmediatePickupResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 16] Puntos de Referencia y Cómo Llegar (Metro / Parque Central)
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 17] Servicio Mecánico / Instalación (Aclaratoria de Solo Venta)
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 18] Calidad de Repuestos (OEM, Originales, Marcas)
  // ============================================================================
  if (
    norm.includes('son originales') ||
    norm.includes('que marca') ||
    norm.includes('son de buena calidad') ||
    norm.includes('calidad') ||
    norm.includes('son chinos') ||
    norm.includes('son japoneses') ||
    norm.includes('son americanos') ||
    norm.includes('marcas trabajan') ||
    norm.includes('usados') ||
    norm.includes('nuevos') ||
    norm.includes('segunda mano')
  ) {
    recordMetric('consulta_calidad_marcas', text, jid);
    return handleQualityAndBrandsResponse();
  }

  // ============================================================================
  // [SECCIÓN 19] Aclaratoria de Repuestos de Carro (Solo Moto y Cauchera)
  // ============================================================================
  if (
    norm.includes('repuestos de carro') ||
    norm.includes('repuesto de carro') ||
    norm.includes('repuestos para carro') ||
    norm.includes('repuesto para carro') ||
    norm.includes('cosas de carro') ||
    norm.includes('repuestos de auto') ||
    norm.includes('repuesto de auto') ||
    norm.includes('para carros') ||
    norm.includes('para carro') ||
    norm.includes('para autos') ||
    norm.includes('toyota') ||
    norm.includes('corolla') ||
    norm.includes('aveo') ||
    norm.includes('optra') ||
    norm.includes('spark') ||
    norm.includes('chevrolet') ||
    norm.includes('ford') ||
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

  // ============================================================================
  // [SECCIÓN 20] Facturación Fiscal y Presupuestos
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 21] Descuentos y Promociones en Divisas
  // ============================================================================
  if (
    norm.includes('descuento') ||
    norm.includes('rebaja') ||
    norm.includes('promo') ||
    norm.includes('lo ultimo') ||
    norm.includes('mas barato') ||
    norm.includes('precio minimo') ||
    norm.includes('precio en divisas') ||
    norm.includes('pago en divisas') ||
    norm.includes('descuento en divisas') ||
    norm.includes('descuento en dolares')
  ) {
    recordMetric('consulta_descuento', text, jid);
    return handleDiscountResponse(tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 22] Medios de Pago Aceptados (Efectivo, Pago Móvil, Cashea)
  // ============================================================================
  const hasProductInPaymentQuery = searchProductsFuzzy(text).length > 0;
  const isSpecializedPaymentOrDelivery = norm.includes('cashea') || norm.includes('motorizado') || norm.includes('delivery');
  if (
    !hasProductInPaymentQuery && !isSpecializedPaymentOrDelivery && (
      norm === 'como se paga' ||
      norm === 'formas de pago' ||
      norm === 'metodos de pago' ||
      norm.includes('como pagar') ||
      norm.includes('formas de pago') ||
      norm.includes('metodos de pago') ||
      norm.includes('pago movil') ||
      norm.includes('que metodo') ||
      norm.includes('aceptan dolares') ||
      norm.includes('aceptan divisas') ||
      norm.includes('como reciben el pago') ||
      norm.includes('como se realiza el pago') ||
      norm.includes('transferencia') ||
      norm.includes('se puede pagar') ||
      norm.includes('puedo pagar')
    )
  ) {
    recordMetric('consulta_pagos', text, jid);
    return handlePaymentMethodsResponse(tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 23] Solicitud de Apartado / Reserva 24h
  // ============================================================================
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
    if (settings.fuera_horario_activo === '1') {
      return handleOutOfHoursTransactionResponse(settings, 'apartar');
    }
    return initiateApartadoFlow(jid, text, norm, session, tasa, settings, pushName);
  }

  // ============================================================================
  // [SECCIÓN 24] Búsqueda Multi-Producto / Carrito Combinado
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 25] [MERCADO VENEZUELA] Delivery en Gran Caracas
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 26] Horario Comercial de Tienda Física
  // ============================================================================
  if (
    norm.includes('horario') ||
    norm.includes('abren') ||
    norm.includes('cierran') ||
    norm.includes('estan abiertos') ||
    norm.includes('que hora abren') ||
    norm.includes('a que hora') ||
    norm.includes('hasta que hora') ||
    norm.includes('atienden hoy') ||
    norm.includes('atienden el') ||
    (norm.includes('sabado') && !norm.includes('bera') && !norm.includes('moto') && !norm.includes('sbr') && !norm.includes('kit') && norm.length < 30) ||
    (norm.includes('domingo') && !norm.includes('moto') && norm.length < 30) ||
    (norm.includes('hora') && (norm.includes('abren') || norm.includes('cierran') || norm.includes('atienden') || norm.includes('horario')))
  ) {
    recordMetric('consulta_horario', text, jid);
    return handleStoreHoursResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 27] Políticas de Garantía y Devolución
  // ============================================================================
  const hasProductContext = norm.includes('aceite') || norm.includes('pastilla') || norm.includes('bujia') ||
    norm.includes('freno') || norm.includes('banda') || norm.includes('cadena') || norm.includes('arrastre') ||
    norm.includes('refrigerante') || norm.includes('filtro') || norm.includes('bateria') || norm.includes('tripa') ||
    norm.includes('caucho') || norm.includes('parche') || norm.includes('valvula');

  const cambioIsServiceContext = norm.includes('cambio') && hasProductContext;

  if (
    norm.includes('garantia') ||
    norm.includes('devolucion') ||
    norm.includes('defectuoso') ||
    norm.includes('si no le sirve') ||
    norm.includes('si no le queda') ||
    norm.includes('no le funciono') ||
    norm.includes('vino malo') ||
    norm.includes('vino defectuoso') ||
    (norm.includes('cambio') && !cambioIsServiceContext && (norm.includes('garantia') || norm.includes('devolucion') || norm.includes('regresar') || norm.includes('queja') || norm.includes('reclamar') || norm === 'cambio'))
  ) {
    recordMetric('consulta_garantia', text, jid);
    return handleWarrantyResponse();
  }

  // ============================================================================
  // [SECCIÓN 28] Disponibilidad Inmediata en Inventario
  // ============================================================================
  if (
    norm === 'disponibilidad' ||
    norm === 'disponible' ||
    norm === 'hay disponible' ||
    norm === 'tienen en tienda' ||
    norm === 'entrega inmediata' ||
    (norm.includes('disponible') && searchProductsFuzzy(text).length === 0) ||
    (norm.includes('disponibilidad') && searchProductsFuzzy(text).length === 0) ||
    norm.includes('hay disponible en tienda') ||
    norm.includes('entrega inmediata') ||
    norm.includes('tienes en stock')
  ) {
    recordMetric('consulta_disponibilidad', text, jid);
    return handleAvailabilityResponse();
  }

  // ============================================================================
  // [SECCIÓN 29] Selección Contextual de Productos Anteriores (Índice o Posición)
  // ============================================================================
  const contextResult = handleContextualSelection(norm, session, tasa, settings);
  if (contextResult) {
    return contextResult;
  }

  // ============================================================================
  // [SECCIÓN 30] Menú Principal y Categorías Canónicas (1 a 6)
  // ============================================================================

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
  const wantsHumanAgent =
    norm === '6' ||
    norm === '6️⃣' ||
    norm === 'opcion 6' ||
    norm === 'vendedor' ||
    norm === 'asesor' ||
    norm === 'humano' ||
    norm === 'hablar con alguien' ||
    norm === 'un asesor' ||
    norm === 'un vendedor' ||
    norm.includes('quiero hablar con') ||
    norm.includes('comunicarme con') ||
    norm.includes('hablar con un') ||
    norm.includes('hablar con el') ||
    norm.includes('atencion humana') ||
    norm.includes('persona de ventas') ||
    norm.includes('equipo de ventas') ||
    norm.includes('al mostrador') ||
    norm.includes('asesores') ||
    norm.includes('hablar con alguien') ||
    (norm.includes('vendedor') && !norm.includes('el vendedor me dijo') && !norm.includes('otro vendedor') && !norm.includes('su vendedor')) ||
    (norm.includes('asesor') && !norm.includes('mi asesor') && !norm.includes('asesor financiero') && !norm.includes('asesor de banco')) ||
    (norm.includes('contacto') && (norm.includes('tienda') || norm.includes('crastur') || norm.includes('ustedes') || norm === 'contacto')) ||
    (norm.includes('persona') && (norm.includes('hablar') || norm.includes('quiero') || norm.includes('atender') || norm.includes('atienda')));

  if (wantsHumanAgent) {
    recordMetric('consulta_vendedor', text, jid);
    return handleSellersResponse(pushName);
  }

  // ============================================================================
  // [SECCIÓN 31] [MERCADO VENEZUELA] Financiamiento Cashea Inteligente
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 32] Ubicación Física y Google Maps
  // ============================================================================
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
    (norm.includes('tienda') && (norm.includes('donde') || norm.includes('como llego') || norm.includes('como queda') || norm.includes('fisica')))
  ) {
    recordMetric('consulta_ubicacion', text, jid);
    return handleLocationResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 33] Búsqueda Difusa en Catálogo (Fuzzy Search Levenshtein)
  // ============================================================================
  const productSearchResults = searchProductsFuzzy(text);
  if (productSearchResults.length > 0) {
    const firstProd = productSearchResults[0];
    recordMetric('busqueda_producto', `${firstProd.marca} ${firstProd.modelo}`, jid);

    // [ANTI-BANEO META 2025] Máximo 1 seguimiento proactivo por sesión: si ya se envió
    // un recordatorio previamente, no se re-arma (evita mensajes proactivos repetidos).
    const yaSeguido = session && (session.seguimiento_enviado === 1 || session.seguimiento_enviado === '1');

    // Preservar historial reciente de productos cotizados
    let prevHistory: any[] = [];
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
          seguimiento_enviado = ?
      WHERE jid = ?
    `).run(firstProd.id, `${firstProd.marca} ${firstProd.modelo}`, contextJson, yaSeguido ? 1 : 0, jid);

    if (productSearchResults.length === 1) {
      return handleSingleProductDetail(firstProd, tasa, settings, session);
    }

    return handleProductResults(productSearchResults, tasa, settings, session);
  }

  // ============================================================================
  // [SECCIÓN 34] Consultas Genéricas de Moto o Cauchera sin Coincidencia
  // ============================================================================
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

  // ============================================================================
  // [SECCIÓN 35] Saludos y Menú Inicial
  // ============================================================================
  if (
    norm === 'hola' ||
    norm === 'hola!' ||
    norm === 'ola' ||
    (norm.startsWith('hola ') && norm.length < 15 && !norm.includes('tienes') && !norm.includes('hay') && !norm.includes('precio') && !norm.includes('quiero') && !norm.includes('busco')) ||
    norm.includes('buenos dias') ||
    norm.includes('buenas tardes') ||
    norm.includes('buenas noches') ||
    norm === 'buenas' ||
    norm === 'menu' ||
    norm === 'inicio' ||
    norm === 'ayuda' ||
    norm === 'info' ||
    norm === 'informacion' ||
    norm.includes('epale') ||
    norm.includes('que mas') ||
    norm.includes('que tal') ||
    norm.includes('saludos') ||
    norm.includes('mi pana')
  ) {
    recordMetric('saludo_menu', text, jid);
    if (jid) {
      try {
        db.prepare("UPDATE chat_sessions SET contexto_productos = NULL, step = 'start' WHERE jid = ?").run(jid);
      } catch {}
    }
    return handleGreetingResponse(pushName, settings, tasa);
  }

  // Aclaratoria cuando consultan explícitamente por vehículos de 4 ruedas
  if (
    norm.includes('carro') || norm.includes('auto') || norm.includes('vehiculo') ||
    norm.includes('camioneta') || norm.includes('sedan') || norm.includes('4x4')
  ) {
    recordMetric('consulta_carro_no_match', text, jid);
    return handleCarInquiryResponse();
  }

  // ============================================================================
  // [SECCIÓN 36] Respuesta por Defecto (Fallback con Doble Intento)
  // [RED DE SEGURIDAD] 1er intento: ejemplos. 2º seguido: menú completo + asesor.
  // ============================================================================
  recordMetric('consulta_sin_match', text, jid);

  let fallosPrevios = 0;
  try {
    fallosPrevios = parseInt(session?.fallos_consecutivos || 0, 10) || 0;
  } catch { fallosPrevios = 0; }

  const nuevosFallos = fallosPrevios + 1;
  try {
    db.prepare('UPDATE chat_sessions SET fallos_consecutivos = ? WHERE jid = ?').run(nuevosFallos, jid);
  } catch {}

  if (nuevosFallos >= 2) {
    // El cliente ya lleva 2 mensajes sin coincidencia → menú + asesor
    try { db.prepare('UPDATE chat_sessions SET fallos_consecutivos = 0 WHERE jid = ?').run(jid); } catch {}
    return handleSecondFallback(pushName, settings);
  }

  return handleDefaultFallback(pushName, settings);
}

/**
 * [RED DE SEGURIDAD DEL BOT] Envoltorio público del router.
 * Resetea el contador de "fallos consecutivos" cuando el bot SÍ logra responder
 * algo útil (distinto del mensaje de fallback). Así el aviso de segundo intento
 * (menú + asesor) solo aparece cuando el cliente realmente no es entendido 2 veces seguidas.
 */
function processIncomingMessage(
  jid: string,
  rawText: string,
  pushName: string = 'amigo/a',
  mediaInfo: BotMediaInfo | null = null
): any {
  const respuesta = processIncomingMessageCore(jid, rawText, pushName, mediaInfo);

  // [RESPUESTA ASÍNCRONA] Algunas rutas (p. ej. entrega de catálogo PDF) devuelven
  // una Promesa. Se resuelve y se aplica el mismo reinicio de contador de fallos.
  if (respuesta && typeof respuesta.then === 'function') {
    return respuesta.then((resuelta: any) => {
      evaluarFallback(resuelta, jid);
      return resuelta;
    });
  }

  evaluarFallback(respuesta, jid);
  return respuesta;
}

/** Ajusta el contador de fallos consecutivos según si la respuesta fue útil o un fallback. */
function evaluarFallback(respuesta: any, jid: string): void {
  try {
    // Determinar si la respuesta fue un fallback (no entendido) o una respuesta útil
    const textoResp = typeof respuesta === 'string'
      ? respuesta
      : (respuesta && typeof respuesta === 'object' ? (respuesta.text || respuesta.caption || '') : '');

    const esFallback = !textoResp || textoResp.includes('No logré ubicar el producto') || textoResp.includes('Gracias por tu paciencia');

    if (!esFallback && jid) {
      // El bot entendió: reiniciar el contador de fallos consecutivos
      db.prepare('UPDATE chat_sessions SET fallos_consecutivos = 0 WHERE jid = ?').run(jid);
    }
  } catch { /* nunca interrumpir la respuesta por un fallo de contador */ }
}

export {
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

export default {
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
