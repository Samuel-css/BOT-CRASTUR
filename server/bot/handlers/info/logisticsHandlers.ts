/**
 * @file logisticsHandlers.ts
 * @description Respuestas de delivery, retiro, ubicación y horario.
 *
 * [COPY BREVE] La primera línea responde; la dirección completa solo se muestra
 * cuando el cliente la pide o cuando va a retirar.
 */

import { db } from '../../../database';
import { searchProductsFuzzy } from '../../services/searchService';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import {
  buildDelivery,
  buildPickup,
  buildLocation,
  buildHours,
  storeAddress,
  storeHours,
  storeMaps,
  compose
} from '../../copy/messages';

/**
 * Delivery en Caracas, con tarifa estimada por zona si se detecta.
 */
export function handleDeliveryResponse(
  settings: Record<string, string>,
  session: any,
  tasa: number,
  text: string
): string {
  let matchedProduct: any = null;
  const searchResults = searchProductsFuzzy(text);
  if (searchResults.length > 0) {
    matchedProduct = searchResults[0];
  } else if (session?.ultimo_producto_id) {
    matchedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
  }

  const detectedZone = detectCaracasZone(text, settings);

  return buildDelivery({
    settings,
    zoneName: detectedZone?.nombre,
    zoneFare: detectedZone?.tarifa,
    productName: matchedProduct ? `${matchedProduct.marca} ${matchedProduct.modelo}` : undefined,
    productPriceUsd: matchedProduct ? parseFloat(matchedProduct.precio_usd) || 0 : undefined,
    tasa
  });
}

/**
 * Aclara la cobertura: solo Caracas y entrega a comisionistas.
 */
export function handleNationalShippingResponse(session: any, tasa: number): string {
  return compose([
    '📦 Por ahora entregamos solo en Caracas, con delivery en moto o retiro en tienda física.',
    'No hacemos envíos por MRW, Zoom ni Tealca.',
    'Si tienes un familiar o comisionista en Caracas, con gusto se lo entregamos.',
    '¿Qué repuesto buscas?'
  ]);
}

/**
 * Retiro inmediato en tienda.
 */
export function handleImmediatePickupResponse(settings: Record<string, string>): string {
  return buildPickup(settings);
}

/**
 * Puntos de referencia para llegar a la tienda.
 */
export function handleReferencePointsResponse(settings: Record<string, string>): string {
  return compose([
    `📍 Estamos en ${storeAddress(settings)}.`,
    '🚇 Metro Bellas Artes (3 cuadras) o Nuevo Circo (4 cuadras). Cerca de Parque Central.',
    `🗺️ ${storeMaps(settings)}`,
    `🕒 ${storeHours(settings)}`,
    'Si vienes, te recomiendo apartarlo antes para que lo tengas listo.'
  ]);
}

/**
 * Horario de atención.
 */
export function handleStoreHoursResponse(settings: Record<string, string>): string {
  return buildHours(settings);
}

/**
 * Ubicación física con mapa.
 */
export function handleLocationResponse(settings: Record<string, string>): string {
  return buildLocation(settings);
}

export default {
  handleDeliveryResponse,
  handleNationalShippingResponse,
  handleImmediatePickupResponse,
  handleReferencePointsResponse,
  handleStoreHoursResponse,
  handleLocationResponse
};
