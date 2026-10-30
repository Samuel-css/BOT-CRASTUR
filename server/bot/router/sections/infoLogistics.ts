/**
 * @file infoLogistics.ts
 * @description Secciones 14 a 20 del router: envíos nacionales, retiro inmediato,
 * puntos de referencia, instalación, calidad, repuestos de carro y facturación.
 */

import type { RouterContext } from './context';
import { db, recordMetric } from '../../../database';
import { KEYWORDS, includesAny } from '../keywords';
import {
  handleNationalShippingResponse,
  handleImmediatePickupResponse,
  handleReferencePointsResponse,
  handleInstallationQueryResponse,
  handleQualityAndBrandsResponse,
  handleCarInquiryResponse,
  handleInvoicingQueryResponse
} from '../../handlers/infoHandlers';

export function runInfoLogisticsSections(ctx: RouterContext): any | null {
  const { jid, text, norm, session, settings, tasa, productosDetectados } = ctx;
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
  // [PRIORIDAD DE PRODUCTO] "tienen pastillas de buena calidad" debe cotizar las pastillas,
  // no responder un texto genérico de calidad. La aclaratoria solo aplica cuando NO se
  // identificó un producto concreto en el mensaje.
  if (productosDetectados.length === 0 && includesAny(norm, KEYWORDS.quality)) {
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
  return null;
}
