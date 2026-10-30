/**
 * @file paymentsLate.ts
 * @description Secciones 21 y 22: descuentos en divisas y métodos de pago aceptados.
 */

import type { RouterContext } from './context';
import { recordMetric } from '../../../database';
import { KEYWORDS, includesAny, equalsAny } from '../keywords';
import { handleDiscountResponse, handlePaymentMethodsResponse } from '../../handlers/infoHandlers';

export function runPaymentsLateSections(ctx: RouterContext): any | null {
  const { jid, text, norm, settings, tasa, productosDetectados } = ctx;
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
  const hasProductInPaymentQuery = productosDetectados.length > 0;
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
  return null;
}
