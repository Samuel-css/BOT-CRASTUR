/**
 * @file paymentHandlers.ts
 * @description Respuestas informativas de pagos, tasa BCV y descuentos.
 *
 * [COPY BREVE] Cada respuesta resuelve la duda en las primeras líneas y deja una
 * sola acción. El detalle completo vive en el catálogo o en el manual.
 */

import {
  buildPaymentMethods,
  buildBinance,
  buildDiscount,
  buildRate,
  rateLabel
} from '../../copy/messages';

export function handlePaymentMethodsResponse(tasa: number, settings: Record<string, string>): string {
  return buildPaymentMethods(settings, tasa);
}

/**
 * Informa sobre los descuentos aplicables al pagar en divisas (Precio Promoción).
 */
export function handleDiscountResponse(tasa: number, settings: Record<string, string>): string {
  return buildDiscount(tasa, settings);
}

/**
 * Responde a consultas sobre la tasa BCV y cómo se aplica a los pagos.
 */
export function handleRateQueryResponse(tasa: number, settings: Record<string, string>): string {
  return buildRate(tasa);
}

/**
 * Confirma la aceptación de Binance Pay / USDT.
 */
export function handleBinancePaymentResponse(tasa: number, settings: Record<string, string>): string {
  return buildBinance(tasa);
}

/**
 * Aclara los medios de pago no aceptados sin enviar un muro de texto.
 */
export function handleNonAcceptedPaymentsResponse(tasa: number, settings: Record<string, string>): string {
  const metodos = String(settings?.metodos_pago || '').toLowerCase();
  const aceptados: string[] = [];
  if (metodos.includes('efectivo')) aceptados.push('Efectivo ($)');
  if (metodos.includes('binance')) aceptados.push('Binance Pay (USDT)');
  if (metodos.includes('pago movil') || metodos.includes('pago móvil')) aceptados.push('Pago Móvil');
  if (metodos.includes('transferencia') || metodos.includes('banesco') || metodos.includes('mercantil')) aceptados.push('Transferencia');
  if (metodos.includes('punto')) aceptados.push('Punto de Venta');
  if (metodos.includes('cashea')) aceptados.push('Cashea');

  const lista = aceptados.length > 0 ? aceptados.join(', ') : 'Efectivo ($), Binance Pay (USDT), Pago Móvil y Cashea';
  return [
    '💳 Aceptamos: ' + lista + '.',
    `Pago Móvil y transferencia van a tasa BCV (${rateLabel(tasa)}).`,
    'No aceptamos Zelle, Zinli, PayPal, Wally ni AirTM.',
    '¿Qué producto quieres cotizar?'
  ].join('\n');
}

export default {
  handlePaymentMethodsResponse,
  handleDiscountResponse,
  handleRateQueryResponse,
  handleBinancePaymentResponse,
  handleNonAcceptedPaymentsResponse
};
