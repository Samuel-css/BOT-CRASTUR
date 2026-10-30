/**
 * @file paymentHandlers.ts
 * @description Respuestas informativas del bot (módulo extraído de infoHandlers.ts).
 */

import { db } from '../../../database';
import { formatRate, formatBs } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { searchProductsFuzzy } from '../../services/searchService';
import { getProductsByCanonicalCategory } from '../../config/categoryGroups';
import { stockLabel } from '../../utils/stock';
export function handlePaymentMethodsResponse(tasa: number, settings: Record<string, string>): string {
  const tasaFormatted = formatRate(tasa);
  const metodosRaw = settings.metodos_pago || '';
  const isNone = metodosRaw.trim().toLowerCase() === 'ninguno' || metodosRaw.trim() === '';

  if (isNone) {
    let msg = `💳 *Formas de Pago en Tienda - Crastur* 🛞🏍️\n\n`;
    msg += `⚠️ En este momento estamos actualizando la disponibilidad de pagos en caja y mostrador.\n\n`;
    msg += `👉 Por favor escribe *VENDEDOR* para que un asesor te confirme directamente cómo coordinar tu pago.`;
    return msg;
  }

  const activeItems = metodosRaw.split(',').map(s => s.trim()).filter(Boolean);
  let msg = `💳 *Métodos de Pago Autorizados en Crastur* 🛞🏍️\n\n`;
  msg += `En nuestra tienda aceptamos los siguientes métodos de pago disponibles hoy:\n\n`;

  activeItems.forEach(item => {
    const low = item.toLowerCase();
    if (low.includes('efectivo')) {
      msg += `💵 *Precio Promoción en Divisas:* Aplica pagando en *Efectivo ($)* 🪙🔥\n`;
    } else if (low.includes('binance')) {
      msg += `🪙 *Binance Pay (USDT):* Pago digital instantáneo a Precio Promoción.\n`;
    } else if (low.includes('cashea')) {
      msg += `💛 *Cashea en Tienda Física:* Pagas solo la inicial hoy y el resto en 3 cuotas quincenales sin interés.\n`;
    } else if (low.includes('pago móvil') || low.includes('pago movil')) {
      msg += `✅ *Pago Móvil:* A tasa oficial BCV del día (sin recargos).\n`;
    } else if (low.includes('transferencia')) {
      msg += `🏦 *Transferencia Bancaria Nacional:* Banesco o Mercantil a tasa BCV.\n`;
    } else if (low.includes('punto')) {
      msg += `💳 *Punto de Venta:* Tarjeta de débito en mostrador de tienda física.\n`;
    } else {
      msg += `• *${item}*\n`;
    }
  });

  msg += `\n🇻🇪 *Tasa oficial BCV hoy:* *Bs. ${tasaFormatted} / USD*\n\n`;
  msg += `👉 Escribe el repuesto, combo o insumo que deseas cotizar o escribe *VENDEDOR* para atención personalizada.`;
  return msg;
}

/**
 * Informa sobre los descuentos aplicables al pagar en divisas (Precio Promoción).
 * 
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @returns Mensaje detallando los beneficios del pago en divisas
 */
export function handleDiscountResponse(tasa: number, settings: Record<string, string>): string {
  const tasaFormatted = formatRate(tasa);
  let msg = `🔥 *¡Precio Promoción en Divisas en Crastur!* 💵🪙🏷️\n\n`;
  msg += `¡Sí! Al pagar tus compras en divisas cuentas con un **descuento especial y Precio Promoción** pagando en:\n\n`;
  msg += `💵 *Efectivo en Dólares ($)* en tienda física o delivery.\n`;
  msg += `🪙 *Binance Pay / USDT* (acreditación instantánea y sin comisiones).\n\n`;
  msg += `📌 *Otros métodos de pago:*\n`;
  msg += `✅ *Pago Móvil y Transferencia:* A tasa oficial BCV sin recargos (Bs. ${tasaFormatted} / USD)\n`;
  msg += `💛 *Cashea:* Paga hoy solo la inicial y el resto en 3 cuotas a 0% interés.\n\n`;
  msg += `👉 Escribe qué repuesto o combo buscas (ej: *"pastillas"*, *"aceite 20w50"*, *"parches"*, *"combos"*) o escribe *VENDEDOR*.`;
  return msg;
}

/**
 * Responde a consultas sobre delivery en Caracas, estimando tarifas por zona si se detecta la dirección.
 * 
 * @param settings - Configuración general
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV oficial
 * @param text - Texto del mensaje para detección de zona
 * @returns Mensaje con opciones de despacho motorizado y tarifas
 */
export function handleRateQueryResponse(tasa: number, settings: Record<string, string>): string {
  const tasaFormatted = formatRate(tasa);
  let msg = `🇻🇪 *Tasa Oficial BCV Hoy:* *Bs. ${tasaFormatted} / USD* 🏦\n\n`;
  msg += `• Calculamos todos los precios a tasa oficial BCV del día sin recargos.\n`;
  msg += `• 🔥 *¡Descuento en Divisas!* Cuentas con precio especial pagando en efectivo en tienda física 🏷️.\n`;
  msg += `• 💛 *Cashea:* Inicial a tasa BCV y 3 cuotas quincenales a 0% interés.\n\n`;
  msg += `👉 Escribe el repuesto que buscas para cotizártelo de una vez en $ y Bs.`;
  return msg;
}

/**
 * Confirma disponibilidad para retiro inmediato en tienda física e invita a apartar.
 * 
 * @param settings - Configuración general
 * @returns Mensaje con dirección, horario y recomendación de apartado
 */
export function handleBinancePaymentResponse(tasa: number, settings: Record<string, string>): string {
  const tasaFormatted = formatRate(tasa);
  let msg = `🪙 *¡Sí, Aceptamos Binance Pay / USDT en Crastur!* ⚡\n\n`;
  msg += `Puedes pagar tus compras, combos e insumos directamente con **Binance** sin recargos ni comisiones extra:\n\n`;
  msg += `🔥 *Aprovechas el Precio Promoción en Divisas* en todos nuestros productos y combos.\n`;
  msg += `📲 *Transferencia Binance Pay:* Pagas directo por correo, Pay ID o escaneando nuestro código QR de Binance.\n`;
  msg += `⚡ *Acreditación inmediata:* Verificamos el pago en segundos y te despachamos o apartamos tu pedido.\n\n`;
  msg += `🇻🇪 *Tasa oficial BCV del día:* Bs. ${tasaFormatted} / USD (también aceptamos Pago Móvil y Bolívares).\n\n`;
  msg += `👉 Escribe qué producto o combo deseas comprar o escribe *VENDEDOR* para recibir los datos de Binance Pay de la tienda.`;
  return msg;
}

/**
 * Aclara la no aceptación de medios de pago externos no soportados (Zelle, cuentas panameñas, etc.).
 * 
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @returns Mensaje de aclaratoria de medios no aceptados
 */
export function handleNonAcceptedPaymentsResponse(tasa: number, settings: Record<string, string>): string {
  // [COHERENCIA CON EL PANEL] La lista de métodos aceptados se lee de la configuración
  // real de la tienda. Antes el texto decía "no aceptamos punto de venta" aunque el
  // panel lo tuviera activado, y el cliente recibía respuestas contradictorias.
  const metodos = String(settings?.metodos_pago || '').toLowerCase();
  const aceptaEfectivo = metodos.includes('efectivo');
  const aceptaBinance = metodos.includes('binance');
  const aceptaPagoMovil = metodos.includes('pago movil') || metodos.includes('pago móvil');
  const aceptaTransferencia = metodos.includes('transferencia') || metodos.includes('banesco') || metodos.includes('mercantil');
  const aceptaPunto = metodos.includes('punto');
  const aceptaCashea = metodos.includes('cashea');

  let msg = `💳 *Formas de Pago Autorizadas en Crastur* 🛞🏍️\n\n`;
  msg += `En Crastur aceptamos cómodamente:\n`;

  if (aceptaEfectivo || aceptaBinance) {
    const medios = [aceptaEfectivo ? '*Efectivo ($)*' : '', aceptaBinance ? '*Binance Pay (USDT)*' : ''].filter(Boolean).join(' o ');
    msg += `💵 *Precio Promoción en Divisas:* Pagando en ${medios} 🪙🔥\n`;
  }
  if (aceptaPagoMovil) msg += `✅ *Pago Móvil* (a tasa oficial BCV del día, sin recargos)\n`;
  if (aceptaTransferencia) msg += `✅ *Transferencia Bancaria Nacional* (a tasa oficial BCV)\n`;
  if (aceptaEfectivo) msg += `✅ *Efectivo en Bolívares* (a tasa oficial BCV)\n`;
  if (aceptaPunto) msg += `💳 *Punto de Venta* (tarjeta de débito en el mostrador de la tienda física)\n`;
  if (aceptaCashea) msg += `💛 *Cashea en Tienda Física* (Inicial + 3 cuotas quincenales sin interés)\n`;

  msg += `\n⚠️ *Nota aclaratoria:* Actualmente no aceptamos Zelle, Zinli, PayPal, Wally, AirTM ni otras billeteras digitales`;
  if (!aceptaPunto) msg += `, ni tarjetas por punto de venta`;
  msg += `. Te recomendamos pagar cómodamente con *Binance Pay (USDT)*, *Pago Móvil* o *Efectivo en divisas* con Precio Promoción.\n\n`;
  msg += `👉 Escribe el producto que deseas cotizar o escribe *VENDEDOR* si deseas comunicarte con un asesor.`;
  return msg;
}

/**
 * Responde consultas sobre redes sociales sin abrir combos por accidente.
 * Si el panel configura `instagram_url`, se comparte; si no, se deriva a un asesor.
 */
