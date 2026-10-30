/**
 * @file payments.ts
 * @description Secciones 12 a 13d: medios no aceptados, tasa BCV, precio genérico,
 * compras al mayor y precio en bolívares.
 */

import type { RouterContext } from './context';
import { db, recordMetric } from '../../../database';
import { KEYWORDS, includesAny, equalsAny } from '../keywords';
import {
  handleNonAcceptedPaymentsResponse,
  handleRateQueryResponse,
  handlePriceInquiryResponse,
  handleWholesaleResponse
} from '../../handlers/infoHandlers';
import { handleContextualSelection, handleSingleProductDetail } from '../../handlers/productHandlers';

export function runPaymentsSections(ctx: RouterContext): any | null {
  const { jid, text, norm, session, settings, tasa, productosDetectados } = ctx;
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
  // [CONTEXTO] Si el cliente acaba de ver un producto ("y cuanto?", "cuanto?"),
  // se le vuelve a mostrar esa ficha en vez de pedirle el nombre otra vez.
  // ============================================================================
  if (equalsAny(norm, KEYWORDS.barePriceEquals)) {
    recordMetric('consulta_precio_generico', text, jid);
    if (session.contexto_productos) {
      const contextualPrice = handleContextualSelection(norm, session, tasa, settings);
      if (contextualPrice) return contextualPrice;
    }
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
  // [SECCIÓN 13d] Precio Expresado en Bolívares ("cuanto es en bolivares")
  // [PRIORIDAD] Antes caía en "métodos de pago" solo porque la palabra bolívares está
  // en esa lista. Si hay un producto en contexto se muestra su ficha; si no, la tasa.
  // Las consultas de PAGO en bolívares siguen yendo a métodos de pago.
  // ============================================================================
  // [RENDIMIENTO] El catálogo se consulta una sola vez por mensaje y se reutiliza en las
  // secciones de calidad, pagos, delivery, disponibilidad y búsqueda final.

  const mentionsBs = norm.includes('bolivar') || /\bbs\b/.test(norm);
  const asksForAmount = includesAny(norm, ['cuanto', 'precio', 'costo', 'sale', 'vale', 'total', 'como queda', 'en cuanto']);
  const isPaymentTalk = includesAny(norm, [
    'pago', 'pagar', 'aceptan', 'reciben', 'metodo', 'forma', 'transferencia', 'punto de venta', 'efectivo'
  ]);
  const asksPriceInBs =
    mentionsBs && (asksForAmount || norm.startsWith('y en')) && !isPaymentTalk &&
    productosDetectados.length === 0;

  if (asksPriceInBs) {
    recordMetric('consulta_precio_bs', text, jid);
    if (session.ultimo_producto_id) {
      const fullProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
      if (fullProduct) return handleSingleProductDetail(fullProduct, tasa, settings, session);
    }
    return handleRateQueryResponse(tasa, settings);
  }
  return null;
}
