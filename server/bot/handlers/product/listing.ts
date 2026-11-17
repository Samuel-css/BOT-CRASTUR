/**
 * @file listing.ts
 * @description Listados de productos y cotizaciones múltiples.
 *
 * [COPY BREVE] Máximo 5 productos visibles, una línea por producto, precio en
 * dólares primero y una sola acción al final.
 */

import { detectCaracasZone } from '../../utils/caracasDelivery';
import { buildProductSearch, buildMultiProduct } from '../../copy/messages';

export function handleProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any
): string {
  return buildProductSearch({ products, settings });
}

/**
 * Genera la cotización consolidada para varios repuestos (carrito o combo).
 */
export function handleMultiProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any,
  text: string = ''
): string {
  const detectedZone = text ? detectCaracasZone(text, settings) : null;
  return buildMultiProduct({
    products,
    tasa,
    settings,
    session,
    zoneName: detectedZone?.nombre,
    zoneFare: detectedZone?.tarifa
  });
}

export default {
  handleProductResults,
  handleMultiProductResults
};
