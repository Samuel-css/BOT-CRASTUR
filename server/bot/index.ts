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
import { handleOutOfHoursTransactionResponse } from './services/businessRules';
import { searchProductsFuzzy, searchMultipleProducts, extractLeadingQuantity } from './services/searchService';
import { extractVenezuelanPhones } from './utils/formatters';
import { detectCaracasZone } from './utils/caracasDelivery';

// Handlers de Respuestas Especializados
import {
  handleGreetingResponse,
  handleShortGreeting,
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
  handleHowToBuyResponse,
  handleCategoryBrowseResponse,
  handlePriceInquiryResponse,
  handleWholesaleResponse
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
import { handleDefaultFallback, handleSecondFallback, esRespuestaFallback } from './handlers/fallbackHandlers';
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
  handleApartadoTelefono,
  isApartadoEscapeCommand
} from './apartado/apartadoFlow';
import { checkPendingFollowUps, check22hReservationReminders } from './followUp/followUpService';

// Módulos de enrutamiento extraídos (guards y comandos de flujo)
import { runGuards, SILENCE } from './router/guards';
import { runFlowCommands } from './router/flowCommands';
import { KEYWORDS, includesAny, equalsAny } from './router/keywords';

// [AVISO AL PANEL] Notificación en vivo al Live Inbox cuando el bot necesita ayuda humana
import { notifyLiveMessage } from '../whatsapp/socketState';

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
  // [SALIDA DE EMERGENCIA] Si el cliente está a mitad de un apartado y escribe MENU, hola,
  // CATALOGO, VENDEDOR o una opción 1-6, se reinicia el apartado y el mensaje sigue por el
  // enrutador normal. Sin esto, el cliente quedaba atrapado repitiendo el dato solicitado.
  if (session.step && String(session.step).startsWith('apartado_') && isApartadoEscapeCommand(norm)) {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    session.step = 'start';
    session.apartado_metadata = null;
  } else if (session.step === 'apartado_pidiendo_nombre') {
    return handleApartadoNombre(jid, text, session, tasa, settings);
  } else if (session.step === 'apartado_pidiendo_cedula') {
    return handleApartadoCedula(jid, text, session, tasa, settings);
  } else if (session.step === 'apartado_pidiendo_telefono') {
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
    norm === 'okey' ||
    norm === 'dale' ||
    norm === 'dale!' ||
    norm === 'listo' ||
    norm === 'perfecto' ||
    norm === 'vale' ||
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
  if (includesAny(norm, KEYWORDS.binance)) {
    recordMetric('consulta_binance', text, jid);
    return handleBinancePaymentResponse(tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 10] Promociones y Combos de Redes Sociales (Instagram)
  // ============================================================================
  const isKitProductSearch = norm.includes('kit de arrastre') || norm.includes('kit arrastre') ||
    norm.includes('kit de freno') || norm.includes('kit cadena') || norm.includes('kit pastilla');

  // [PRIORIDAD DE PRODUCTO] Si el cliente describe un combo con repuestos concretos
  // (ej. "combo de bujía y pastillas"), NO se debe responder el combo promocional genérico:
  // gana la cotización real de esos productos. La sección solo atiende consultas de
  // promociones/combos sin productos específicos.
  const comboConProductosReales = searchMultipleProducts(text).length >= 2;

  if (
    !comboConProductosReales && (
      includesAny(norm, KEYWORDS.combos) ||
      (!isKitProductSearch && includesAny(norm, KEYWORDS.combosKits)) ||
      (!isKitProductSearch && norm === 'kit')
    )
  ) {
    recordMetric('consulta_combos_instagram', text, jid);
    return handleInstagramCombosResponse(text, tasa, settings, session, jid);
  }

  // ============================================================================
  // [SECCIÓN 11] Catálogos Oficiales en PDF por Categoría
  // ============================================================================
  const isCatalogPdfQuery =
    includesAny(norm, KEYWORDS.catalog) ||
    equalsAny(norm, KEYWORDS.catalogEquals);

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
  if (includesAny(norm, KEYWORDS.nonAcceptedPayments)) {
    recordMetric('consulta_pago_especifico', text, jid);
    return handleNonAcceptedPaymentsResponse(tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 13] [MERCADO VENEZUELA] Consulta Directa de Tasa BCV Oficial
  // ============================================================================
  const isPaymentMethodContext = norm.includes('pago movil') || norm.includes('transferencia') || norm.includes('como pagar') || norm.includes('formas de pago') || norm.includes('metodos de pago') || norm.includes('aceptan');
  if (
    !isPaymentMethodContext && (
      includesAny(norm, KEYWORDS.rate) ||
      equalsAny(norm, KEYWORDS.rateEquals)
    )
  ) {
    recordMetric('consulta_tasa_bcv', text, jid);
    return handleRateQueryResponse(tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 13b] Precio sin decir el producto ("cuanto vale?", "cuanto cuesta?")
  // Se responde pidiendo el repuesto con ejemplos, en vez de un fallback seco.
  // ============================================================================
  if (equalsAny(norm, KEYWORDS.barePriceEquals)) {
    recordMetric('consulta_precio_generico', text, jid);
    return handlePriceInquiryResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 13c] Compras al Mayor / para Negocios
  // ============================================================================
  if (includesAny(norm, KEYWORDS.wholesale)) {
    recordMetric('consulta_mayorista', text, jid);
    return handleWholesaleResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 14] [MERCADO VENEZUELA] Envíos Nacionales e Interior del País
  // ============================================================================
  if (includesAny(norm, KEYWORDS.nationalShipping)) {
    recordMetric('consulta_envio_nacional', text, jid);
    return handleNationalShippingResponse(session, tasa);
  }

  // ============================================================================
  // [SECCIÓN 15] Retiro Inmediato en Tienda Física
  // ============================================================================
  if (includesAny(norm, KEYWORDS.immediatePickup)) {
    recordMetric('consulta_retiro_inmediato', text, jid);
    return handleImmediatePickupResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 16] Puntos de Referencia y Cómo Llegar (Metro / Parque Central)
  // ============================================================================
  if (includesAny(norm, KEYWORDS.referencePoints)) {
    recordMetric('consulta_referencias', text, jid);
    return handleReferencePointsResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 17] Servicio Mecánico / Instalación (Aclaratoria de Solo Venta)
  // ============================================================================
  if (includesAny(norm, KEYWORDS.installation)) {
    recordMetric('consulta_instalacion', text, jid);
    return handleInstallationQueryResponse(session);
  }

  // ============================================================================
  // [SECCIÓN 18] Calidad de Repuestos (OEM, Originales, Marcas)
  // ============================================================================
  if (includesAny(norm, KEYWORDS.quality)) {
    recordMetric('consulta_calidad_marcas', text, jid);
    return handleQualityAndBrandsResponse();
  }

  // ============================================================================
  // [SECCIÓN 19] Aclaratoria de Repuestos de Carro (Solo Moto y Cauchera)
  // ============================================================================
  if (
    includesAny(norm, KEYWORDS.carInquiry) ||
    // [MOTO VS CARRO] El amortiguador también existe en motos: solo se trata como
    // repuesto de carro cuando el mensaje no menciona moto.
    (norm.includes('amortiguador') && !norm.includes('moto'))
  ) {
    recordMetric('consulta_partes_no_manejadas', text, jid);
    return handleCarInquiryResponse();
  }

  // ============================================================================
  // [SECCIÓN 20] Facturación Fiscal y Presupuestos
  // ============================================================================
  if (includesAny(norm, KEYWORDS.invoicing)) {
    recordMetric('consulta_facturacion', text, jid);
    return handleInvoicingQueryResponse();
  }

  // ============================================================================
  // [SECCIÓN 21] Descuentos y Promociones en Divisas
  // ============================================================================
  if (includesAny(norm, KEYWORDS.discount)) {
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
      equalsAny(norm, KEYWORDS.paymentMethodsEquals) ||
      includesAny(norm, KEYWORDS.paymentMethods)
    )
  ) {
    recordMetric('consulta_pagos', text, jid);
    return handlePaymentMethodsResponse(tasa, settings);
  }

  // ============================================================================
  // [SECCIÓN 23] Solicitud de Apartado / Reserva 24h
  // ============================================================================
  if (includesAny(norm, KEYWORDS.apartado)) {
    recordMetric('intencion_apartado', text, jid);
    if (settings.fuera_horario_activo === '1') {
      return handleOutOfHoursTransactionResponse(settings, 'apartar');
    }
    return initiateApartadoFlow(jid, text, norm, session, tasa, settings, pushName);
  }

  // ============================================================================
  // [SECCIÓN 24] Búsqueda Multi-Producto / Carrito Combinado
  // ============================================================================
  // [QUITAR DEL COMBO] Si el cliente pide quitar productos ("saca la bujía y el parche",
  // "quita el aceite"), NO se debe interpretar como una búsqueda nueva de esos productos.
  // Se deja pasar para que la sección 29 (selección contextual) procese la eliminación.
  const pideQuitarEnCombo =
    norm.includes('quita') || norm.includes('quitame') || norm.includes('quitar') ||
    norm.includes('elimina') || norm.includes('eliminar') || norm.includes('remueve') ||
    norm.includes('remover') || norm.includes('borra') || norm.includes('borrar') ||
    norm.includes('saca ') || norm.includes('sacar ') || norm.startsWith('saca ') || norm.startsWith('sin ');

  const multiProducts = pideQuitarEnCombo ? [] : searchMultipleProducts(text);
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
    includesAny(norm, KEYWORDS.delivery) ||
    (detectedDeliveryZone && isAddressText)
  ) {
    recordMetric('consulta_delivery', text, jid);
    return handleDeliveryResponse(settings, session, tasa, text);
  }

  // ============================================================================
  // [SECCIÓN 26] Horario Comercial de Tienda Física
  // ============================================================================
  if (
    includesAny(norm, KEYWORDS.storeHours) ||
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
    includesAny(norm, KEYWORDS.warranty) ||
    (norm.includes('cambio') && !cambioIsServiceContext && (norm.includes('garantia') || norm.includes('devolucion') || norm.includes('regresar') || norm.includes('queja') || norm.includes('reclamar') || norm === 'cambio'))
  ) {
    recordMetric('consulta_garantia', text, jid);
    return handleWarrantyResponse();
  }

  // ============================================================================
  // [SECCIÓN 28] Disponibilidad Inmediata en Inventario
  // ============================================================================
  if (
    equalsAny(norm, KEYWORDS.availabilityEquals) ||
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
  // [ROBUSTEZ] La opción numérica del menú solo se acepta si el mensaje ORIGINAL es un
  // dígito simple (ej. "1"), para que entradas raras como "-1" o "1." no activen el menú
  // por accidente al normalizar (normalizeText convierte "-" en espacio y dejaría "1").
  const esNumeroMenuSeguro = /^\s*[1-6]\s*$/.test(text);

  // 1️⃣ Insumos Cauchera
  if (
    (esNumeroMenuSeguro && norm === '1') ||
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
    (esNumeroMenuSeguro && norm === '2') ||
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
    (esNumeroMenuSeguro && norm === '3') ||
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
    (esNumeroMenuSeguro && norm === '4') ||
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
    (esNumeroMenuSeguro && norm === '5') ||
    norm === '5️⃣' ||
    norm === 'opcion 5'
  ) {
    recordMetric('menu_opcion_cashea', text, jid);
    return handleCasheaSmart(text, norm, settings, tasa, session);
  }

  // 6️⃣ Hablar con un Asesor / Vendedor
  const wantsHumanAgent =
    (esNumeroMenuSeguro && norm === '6') ||
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
  if (includesAny(norm, KEYWORDS.cashea)) {
    recordMetric('consulta_cashea', text, jid);
    return handleCasheaSmart(text, norm, settings, tasa, session);
  }

  // ============================================================================
  // [SECCIÓN 32] Ubicación Física y Google Maps
  // ============================================================================
  if (
    norm === 'donde' ||
    norm.startsWith('donde ') ||
    includesAny(norm, KEYWORDS.location) ||
    /\bdireccion(es)?\b/.test(norm) ||
    (norm.includes('tienda') && (norm.includes('donde') || norm.includes('como llego') || norm.includes('como queda') || norm.includes('fisica')))
  ) {
    recordMetric('consulta_ubicacion', text, jid);
    return handleLocationResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 32b] Cómo Comprar / Hacer un Pedido (Guía para Clientes Nuevos)
  // ============================================================================
  if (includesAny(norm, KEYWORDS.howToBuy)) {
    recordMetric('consulta_como_comprar', text, jid);
    return handleHowToBuyResponse(settings);
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

    // [CANTIDAD] Si el cliente pidió una cantidad ("quiero 4 aceites"), se propaga a cada
    // resultado para que, al elegir el número, el carrito respete esa cantidad.
    const qtySolicitada = extractLeadingQuantity(norm);
    const currentMatches = productSearchResults.map(p => ({
      id: p.id,
      marca: p.marca,
      modelo: p.modelo,
      precio_usd: p.precio_usd,
      categoria: p.categoria,
      ...(qtySolicitada > 1 ? { cantidad: qtySolicitada } : {})
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
      // [CANTIDAD] Si el cliente pide una cantidad mayor a 1 de un solo producto
      // ("4 aceites", "2 bujías"), se muestra el carrito con esa cantidad en vez de la ficha simple.
      const qty = extractLeadingQuantity(norm);
      if (qty > 1) {
        const conCantidad = [{ ...firstProd, cantidad: qty }];
        const contextQty = JSON.stringify([{
          id: firstProd.id, marca: firstProd.marca, modelo: firstProd.modelo,
          precio_usd: firstProd.precio_usd, categoria: firstProd.categoria, cantidad: qty
        }]);
        db.prepare(`
          UPDATE chat_sessions
          SET contexto_productos = ?, ultimo_producto_id = ?, ultimo_producto_nombre = ?, seguimiento_enviado = 0
          WHERE jid = ?
        `).run(contextQty, firstProd.id, `${firstProd.marca} ${firstProd.modelo}`, jid);
        return handleMultiProductResults(conCantidad, tasa, settings, session, text);
      }
      return handleSingleProductDetail(firstProd, tasa, settings, session);
    }

    return handleProductResults(productSearchResults, tasa, settings, session);
  }

  // ============================================================================
  // [SECCIÓN 34] Consultas Genéricas de Moto o Cauchera sin Coincidencia
  // ============================================================================
  if (
    includesAny(norm, KEYWORDS.moto) ||
    equalsAny(norm, KEYWORDS.motoEquals)
  ) {
    recordMetric('consulta_motos', text, jid);
    return handleMotoQueryResponse();
  }

  if (includesAny(norm, KEYWORDS.cauchera)) {
    recordMetric('consulta_cauchera', text, jid);
    return handleCaucheraQueryResponse();
  }

  // ============================================================================
  // [SECCIÓN 35] Saludos y Menú Inicial
  // ============================================================================
  if (
    equalsAny(norm, KEYWORDS.greetingEquals) ||
    (norm.startsWith('hola ') && norm.length < 15 && !norm.includes('tienes') && !norm.includes('hay') && !norm.includes('precio') && !norm.includes('quiero') && !norm.includes('busco')) ||
    includesAny(norm, KEYWORDS.greetingParts) ||
    // [CLIENTE NUEVO] Preguntas de sondeo: "¿qué tienen?", "¿qué venden?", "¿qué manejan?".
    // Deben mostrar el menú de categorías, no un fallback genérico.
    norm.startsWith('que venden ') ||
    norm.startsWith('que tienen ')
  ) {
    recordMetric('saludo_menu', text, jid);

    // [SALUDAR UNA SOLA VEZ] Si el cliente ya recibió el menú hace poco y solo vuelve a
    // saludar, no le repetimos el menú completo: un saludo corto basta y se siente más
    // humano. Si vuelve después de 6 horas (u otro día), sí ve el menú otra vez.
    const esSaludoPuro = /^(hola|ola|buenas|buenos dias|buenas tardes|buenas noches|saludos|epale|que mas|que tal)(\s+\w+){0,2}$/.test(norm);
    const yaSaludo = parseInt(session?.saludo_enviado) === 1;
    const ultimaActividadPrevia = Number(session?.ultimo_mensaje_at || 0);
    const saludoReciente = yaSaludo && ultimaActividadPrevia > 0 && (Date.now() - ultimaActividadPrevia) < 6 * 60 * 60 * 1000;
    if (esSaludoPuro && saludoReciente) {
      recordMetric('saludo_repetido', text, jid);
      return handleShortGreeting(pushName);
    }

    if (jid) {
      try {
        db.prepare("UPDATE chat_sessions SET contexto_productos = NULL, step = 'start', saludo_enviado = 1 WHERE jid = ?").run(jid);
      } catch {}
    }
    return handleGreetingResponse(pushName, settings, tasa);
  }

  // Aclaratoria cuando consultan explícitamente por vehículos de 4 ruedas
  if (includesAny(norm, KEYWORDS.carGeneric)) {
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

  // [NO INSISTIR / NO SABROSEAR] Tercer mensaje seguido sin entender: el bot deja de
  // responder (evita el efecto "bot necio") y deja un aviso visible en el Live Inbox para
  // que un asesor humano tome el chat. Los comandos (VENDEDOR, MENU, precios, etc.) siguen
  // funcionando porque se evalúan antes de esta sección.
  if (nuevosFallos >= 3) {
    if (nuevosFallos === 3) {
      const aviso = '🟡 El bot no logró entender 3 mensajes seguidos. Un asesor debería atender esta conversación.';
      try {
        const avisoInsert = db.prepare(`
          INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
          VALUES (?, 'sistema', ?, ?)
        `).run(jid, aviso, Date.now());
        notifyLiveMessage({
          id: avisoInsert?.lastInsertRowid,
          jid,
          pushName: 'Sistema',
          remitente: 'sistema',
          contenido: aviso,
          timestamp: Date.now()
        });
      } catch {}
      console.log(`[Bot] 🤐 Silencio preventivo para ${jid}: 3 mensajes seguidos sin coincidencia. Aviso enviado al panel.`);
    }
    return null;
  }

  if (nuevosFallos >= 2) {
    // El cliente ya lleva 2 mensajes sin coincidencia → persona del mostrador (sin listas largas)
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
    return respuesta
      .then((resuelta: any) => {
        evaluarFallback(resuelta, jid);
        return resuelta;
      })
      .catch((err: any) => {
        console.error('[Bot] Error en respuesta asíncrona:', err?.message || err);
        return handleDefaultFallback(pushName, undefined);
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

    const esFallback = esRespuestaFallback(textoResp);

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
