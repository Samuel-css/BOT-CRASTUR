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
  handleWholesaleResponse,
  handleSocialResponse
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
import { KEYWORDS, includesAny, equalsAny, includesWordAny } from './router/keywords';
import { runInfoLogisticsSections } from './router/sections/infoLogistics';
import { runDeliveryPoliciesSections } from './router/sections/deliveryPolicies';
import { runProductMenuSections } from './router/sections/productMenu';
import { runFallbackSection } from './router/sections/fallback';
import { runCourtesySections } from './router/sections/courtesy';
import { runCombosCatalogSections } from './router/sections/combosCatalog';
import { runPaymentsSections } from './router/sections/payments';
import { runPaymentsLateSections } from './router/sections/paymentsLate';

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
        SET step = 'start', contexto_productos = NULL, contexto_at = NULL, apartado_metadata = NULL, push_name = ?, ultimo_mensaje_at = ?
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
  // [RENDIMIENTO] El catálogo se consulta una sola vez por mensaje y se reutiliza en
  // las secciones de pagos, calidad, delivery, disponibilidad y búsqueda final.
  const productosDetectados = searchProductsFuzzy(text);
  const ctx = { jid, text, norm, pushName, session, settings, tasa, productosDetectados };

  const courtesyResult = runCourtesySections(ctx);
  if (courtesyResult !== null) return courtesyResult;
  const combosResult = runCombosCatalogSections(ctx);
  if (combosResult !== null) return combosResult;
  const paymentsResult = runPaymentsSections(ctx);
  if (paymentsResult !== null) return paymentsResult;

  const infoLogisticsResult = runInfoLogisticsSections(ctx);
  if (infoLogisticsResult !== null) return infoLogisticsResult;

  const paymentsLateResult = runPaymentsLateSections(ctx);
  if (paymentsLateResult !== null) return paymentsLateResult;

  // ============================================================================
  // [SECCIÓN 23] Solicitud de Apartado / Reserva 24h
  // ============================================================================
  if (includesWordAny(norm, KEYWORDS.apartado)) {
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
          contexto_at = ?,
          seguimiento_enviado = 0
      WHERE jid = ?
    `).run(multiProducts[0].id, comboTitle, contextJson, Date.now(), jid);

    return handleMultiProductResults(multiProducts, tasa, settings, session, text);
  }

  const deliveryPoliciesResult = runDeliveryPoliciesSections(ctx);
  if (deliveryPoliciesResult !== null) return deliveryPoliciesResult;

  const productMenuResult = runProductMenuSections(ctx);
  if (productMenuResult !== null) return productMenuResult;

  // Aclaratoria cuando consultan explícitamente por vehículos de 4 ruedas
  if (includesWordAny(norm, KEYWORDS.carGeneric)) {
    recordMetric('consulta_carro_no_match', text, jid);
    return handleCarInquiryResponse();
  }

  return runFallbackSection(ctx);
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
