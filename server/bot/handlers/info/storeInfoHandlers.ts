/**
 * @file storeInfoHandlers.ts
 * @description Respuestas informativas de la tienda: calidad, garantía, categorías,
 * precios, mayoreo, redes y guías de compra.
 *
 * [COPY BREVE] Se eliminaron los párrafos de relleno y los 3-5 CTA repetidos.
 * La respuesta va primero y el detalle queda para quien lo pida.
 */

import { db } from '../../../database';
import { getProductsByCanonicalCategory } from '../../config/categoryGroups';
import {
  buildCategoryList,
  buildQuality,
  buildWarranty,
  buildAvailability,
  buildHowToBuy,
  buildCarInquiry,
  buildWholesale,
  buildInvoicing,
  buildSocial,
  buildInstallation,
  compose
} from '../../copy/messages';

/**
 * Aclara que Crastur vende repuestos y no tiene taller mecánico.
 */
export function handleInstallationQueryResponse(session: any): string {
  return buildInstallation();
}

/**
 * Calidad, marcas y garantía.
 */
export function handleQualityAndBrandsResponse(): string {
  return buildQuality();
}

/**
 * Repuestos y accesorios para moto.
 */
export function handleMotoQueryResponse(): string {
  return compose([
    '🏍️ Sí, tenemos repuestos y accesorios para moto:',
    '• Kits de arrastre, pastillas, bujías, aceites, guayas, tripas y baterías.',
    '• Puños, mallas, retrovisores, luces LED y spray para cadena.',
    'Dime el modelo de tu moto o la pieza que buscas.'
  ]);
}

/**
 * Insumos y materiales para caucheras.
 */
export function handleCaucheraQueryResponse(): string {
  return compose([
    '🛞 Sí, tenemos insumos para caucheras:',
    '• Parches, pega, válvulas, tarugos, plomos, agujas y herramientas.',
    'Dime qué insumo necesitas y te doy precio.'
  ]);
}

/**
 * Redes sociales: Instagram y combos.
 */
export function handleSocialResponse(pushName: string, settings: Record<string, string>): string {
  return buildSocial(pushName, settings);
}

/**
 * Facturación y cotizaciones.
 */
export function handleInvoicingQueryResponse(): string {
  return buildInvoicing();
}

/**
 * Garantía y políticas de cambio.
 */
export function handleWarrantyResponse(): string {
  return buildWarranty();
}

/**
 * Disponibilidad general de inventario.
 */
export function handleAvailabilityResponse(): string {
  return buildAvailability();
}

/**
 * Guía de compra en 3 pasos.
 */
export function handleHowToBuyResponse(settings: Record<string, string>): string {
  return buildHowToBuy();
}

/**
 * Aclara que no se venden piezas internas pesadas de carro.
 */
export function handleCarInquiryResponse(): string {
  return buildCarInquiry();
}

/**
 * Lista una categoría canónica con máximo 5 productos.
 */
export function handleCategoryBrowseResponse(
  categoryName: string,
  settings: Record<string, string>,
  tasa: number,
  session: any,
  jid?: string
): string {
  const prods: any[] = getProductsByCanonicalCategory(categoryName);

  // Guardar contexto para que el cliente pueda responder 1-5 y ver la ficha.
  if (jid && prods.length > 0) {
    try {
      const contextJson = JSON.stringify(prods.slice(0, 5).map(p => ({
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
      `).run(prods[0].id, `${prods[0].marca} ${prods[0].modelo}`, contextJson, jid);
    } catch {}
  }

  return buildCategoryList({ categoryName, products: prods, settings });
}

/**
 * Responde cuando el cliente pregunta el precio sin decir qué repuesto busca.
 */
export function handlePriceInquiryResponse(settings: Record<string, string>): string {
  return compose([
    '💵 Con gusto te cotizo.',
    'Dime qué repuesto o insumo necesitas (ej: bujía NGK, aceite 20w50, pastillas de freno).',
    'También puedes decirme el modelo de tu moto.'
  ]);
}

/**
 * Compras por volumen para caucheras, talleres y comercios.
 */
export function handleWholesaleResponse(settings: Record<string, string>): string {
  return buildWholesale();
}

export default {
  handleInstallationQueryResponse,
  handleQualityAndBrandsResponse,
  handleMotoQueryResponse,
  handleCaucheraQueryResponse,
  handleSocialResponse,
  handleInvoicingQueryResponse,
  handleWarrantyResponse,
  handleAvailabilityResponse,
  handleHowToBuyResponse,
  handleCarInquiryResponse,
  handleCategoryBrowseResponse,
  handlePriceInquiryResponse,
  handleWholesaleResponse
};
