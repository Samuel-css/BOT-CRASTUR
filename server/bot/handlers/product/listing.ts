/**
 * @file listing.ts
 * @description Módulo de productos extraído de productHandlers.ts.
 */

import { db } from '../../../database';
import { formatBs, formatRate } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { normalizeText } from '../../utils/textUtils';
import { resolveCasheaPlan } from '../../utils/cashea';
import { stockLabel } from '../../utils/stock';
import type { BotResponse } from '../../../types/bot';
export function handleProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any
): string {
  const plan = resolveCasheaPlan(settings, session);
  const cuotasCashea = plan.cuotas;
  const inicialPct = plan.inicialPct;

  const nombreNegocio = settings.nombre_negocio || 'Crastur';
  let msg = `🛞🏍️ *${nombreNegocio}* 📦\n\n`;

  products.forEach((p: any, idx: number) => {
    const precioUsd = parseFloat(p.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    const inicialUsd = precioUsd * inicialPct;
    const cuotaUsd = (precioUsd - inicialUsd) / cuotasCashea;

    msg += `*${idx + 1}. ${p.marca} - ${p.modelo}* ⚙️\n`;
    if (p.descripcion) {
      msg += `   📝 ${p.descripcion}\n`;
    }
    msg += `   💵 Precio Promo Divisas: *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance)_\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n`;
    if (precioUsd < 25) {
      msg += `   💛 Cashea en Tienda: Disponible para compras a partir de $25 USD\n`;
    } else {
      msg += `   💛 Cashea en Tienda: Inicial *$${inicialUsd.toFixed(2)}* + ${cuotasCashea} cuotas de *$${cuotaUsd.toFixed(2)}*\n`;
    }
    msg += `   📦 Stock: ${stockLabel(p, 'En tienda')}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 *Opciones rápidas:*\n`;
  msg += `👉 Responde con el *número* (ej: *1*) para ver detalles y fotos.\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo por 24 horas.\n`;
  msg += `👉 Escribe *VENDEDOR* para atención personalizada de un asesor.`;

  return msg;
}

/**
 * [SELECCIÓN CONTEXTUAL ÚNICA] Traduce respuestas como "1", "el 2", "la opción 3",
 * "primero"… a un índice base 0. Se usa tanto para el listado normal como para las
 * sugerencias de venta cruzada, evitando que una de las dos rutas acepte formatos distintos.
 *
 * @returns Índice 0..5 o -1 si el mensaje no es una selección.
 */
/**
 * Genera la cotización consolidada para múltiples repuestos solicitados simultáneamente (Carrito/Combo).
 * 
 * @param products - Array de productos que componen el carrito
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat
 * @param text - Texto original para detección de zona de delivery
 * @returns Resumen consolidado con subtotales, total general y cuotas Cashea
 */
export function handleMultiProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any,
  text: string = ''
): string {
  const plan = resolveCasheaPlan(settings, session);
  const cuotasCashea = plan.cuotas;
  // [CONSISTENCIA] Porcentaje de inicial configurable desde el panel y por nivel Cashea.
  const inicialPct = plan.inicialPct;
  // [CANTIDAD] Cada artículo puede llevar una cantidad (ej. "4 aceites" -> cantidad 4).
  const qtyOf = (p: any) => Math.max(1, Math.min(99, parseInt(p.cantidad, 10) || 1));
  const totalUsd = products.reduce((sum: number, p: any) => sum + (parseFloat(p.precio_usd) || 0) * qtyOf(p), 0);
  const totalBs = totalUsd * tasa;
  const totalUnidades = products.reduce((sum: number, p: any) => sum + qtyOf(p), 0);

  let msg = `🛒 *Cotización de Combo / Carrito - Crastur* 🛞🏍️✨\n\n`;
  msg += `Has seleccionado *${products.length} artículo(s)* — *${totalUnidades} unidad(es)*:\n\n`;

  products.forEach((p: any, idx: number) => {
    const precioUsd = parseFloat(p.precio_usd) || 0;
    const qty = qtyOf(p);
    const subtotal = precioUsd * qty;
    const precioBs = subtotal * tasa;
    msg += `${idx + 1}️⃣ *${p.marca} - ${p.modelo}*\n`;
    if (qty > 1) {
      msg += `   🔢 Cantidad: *${qty}* × $${precioUsd.toFixed(2)}\n`;
    }
    msg += `   💵 Subtotal: *$${subtotal.toFixed(2)} USD* (Bs. ${formatBs(precioBs)})\n`;
    if (qty > 1 && p.stock > 0 && qty > p.stock) {
      msg += `   ⚠️ Solo hay *${p.stock}* en tienda — el resto se confirma al retirar.\n`;
    } else {
      msg += `   📦 Stock: ${stockLabel(p, 'Disponible en tienda')}\n`;
    }
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 *Resumen Total del Pedido:*\n`;
  msg += `💵 *Total a Pagar:* *$${totalUsd.toFixed(2)} USD*\n`;
  msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(totalBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  msg += `🔥 *¡Precio Promoción en Divisas!* Aplica pagando en Efectivo ($) o Binance Pay (USDT) 🪙🏷️\n\n`;

  if (totalUsd >= 25) {
    const n1 = totalUsd * inicialPct;
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((totalUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Disponible para compras a partir de *$25 USD*.\n\n`;
  }

  const detectedZone = text ? detectCaracasZone(text, settings) : null;
  if (detectedZone) {
    msg += `🛵 *Delivery estimado a ${detectedZone.nombre}:* *${detectedZone.tarifa}* (motorizado hoy mismo).\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe *APARTAR* para reservar este combo por 24 horas y retirarlo en tienda.\n`;
  msg += `👉 Escribe *DELIVERY* para solicitar envío en moto a tu zona en Caracas 🛵.\n`;
  msg += `👉 ¿Quieres cambiar algo? Escribe *ej: quita el aceite* o *quita el 2* para eliminar un artículo.\n`;
  msg += `👉 Escribe *VENDEDOR* para coordinar con un asesor de ventas.`;

  return msg;
}

/**
 * Atiende consultas sobre combos, promociones y kits promocionados en redes sociales (Instagram).
 * 
 * @param text - Texto de la consulta
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat
 * @param jid - JID destinatario
 * @returns Listado de combos vigentes o detalle individual
 */
