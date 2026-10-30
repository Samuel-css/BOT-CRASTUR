/**
 * @file combosCatalog.ts
 * @description Secciones 8, 10, 10b y 11: Binance, combos de Instagram, redes sociales
 * y catálogos PDF por categoría.
 */

import type { RouterContext } from './context';
import { recordMetric } from '../../../database';
import { searchMultipleProducts } from '../../services/searchService';
import { KEYWORDS, includesAny, equalsAny } from '../keywords';
import { handleBinancePaymentResponse, handleSocialResponse } from '../../handlers/infoHandlers';
import { handleInstagramCombosResponse } from '../../handlers/productHandlers';
import { handleCatalogMenuResponse, handleCatalogPdfDelivery } from '../../handlers/catalogHandlers';

export function runCombosCatalogSections(ctx: RouterContext): any | null {
  const { jid, text, norm, pushName, session, settings, tasa } = ctx;
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
  // [SECCIÓN 10b] Redes Sociales (Instagram, Facebook, TikTok)
  // [PRECISIÓN] "tienen instagram" ya no abre un combo aleatorio del catálogo.
  // ============================================================================
  if (includesAny(norm, KEYWORDS.social)) {
    recordMetric('consulta_redes', text, jid);
    return handleSocialResponse(pushName, settings);
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

  return null;
}
