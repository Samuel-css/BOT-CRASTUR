/**
 * @file deliveryPolicies.ts
 * @description Secciones 25 a 28 del router: delivery en Caracas, horario de tienda,
 * garantías y disponibilidad inmediata.
 */

import type { RouterContext } from './context';
import { recordMetric } from '../../../database';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { KEYWORDS, includesAny, equalsAny } from '../keywords';
import {
  handleDeliveryResponse,
  handleStoreHoursResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse
} from '../../handlers/infoHandlers';

export function runDeliveryPoliciesSections(ctx: RouterContext): any | null {
  const { jid, text, norm, session, settings, tasa, productosDetectados } = ctx;
  // ============================================================================
  // [SECCIÓN 25] [MERCADO VENEZUELA] Delivery en Gran Caracas
  // ============================================================================
  const detectedDeliveryZone = detectCaracasZone(text, settings);
  const isAddressText = /\b(av|avenida|esquina|calle|torre|edificio|residencia|edif|piso|apto|apartamento|baralt)\b/i.test(text);
  // [PRECISIÓN] Una zona sola ("soy de Petare") no debe secuestrar una consulta de producto.
  // Solo se activa delivery si además hay un verbo/intención de envío.
  const hasShippingVerb = includesAny(norm, [
    'enviar', 'envia', 'envian', 'envias', 'mandan', 'mandas', 'mandar', 'llevan', 'llevas', 'llevar',
    'traen', 'traes', 'traer', 'despachan', 'despacho', 'reparten', 'delivery', 'motorizado', 'domicilio'
  ]);

  if (
    includesAny(norm, KEYWORDS.delivery) ||
    (detectedDeliveryZone && (isAddressText || hasShippingVerb))
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
    (norm.includes('disponible') && productosDetectados.length === 0) ||
    (norm.includes('disponibilidad') && productosDetectados.length === 0) ||
    norm.includes('hay disponible en tienda') ||
    norm.includes('entrega inmediata') ||
    norm.includes('tienes en stock')
  ) {
    recordMetric('consulta_disponibilidad', text, jid);
    return handleAvailabilityResponse();
  }
  return null;
}
