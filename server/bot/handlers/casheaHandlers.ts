/**
 * @file casheaHandlers.ts
 * @description Manejadores de respuestas y cálculos de financiamiento comercial mediante Cashea.
 * 
 * [MERCADO VENEZUELA]
 * Cashea es una plataforma de crédito al consumo muy extendida en Venezuela que opera
 * bajo el modelo "Compra ahora, paga después" (BNPL):
 * - Compra mínima: $25.00 USD en tienda física.
 * - Nivel 1: 40% inicial al retirar en caja + 3 cuotas quincenales (0% interés).
 * - Nivel 2: 30% inicial al retirar en caja + 3 cuotas quincenales (0% interés).
 * - Nivel 3+: 20% inicial al retirar en caja + 3 cuotas quincenales (0% interés).
 * - El canje se realiza escaneando el código QR de caja directamente con la app móvil de Cashea.
 */

import { formatBs } from '../utils/formatters';
import { searchProductsFuzzy } from '../services/searchService';
import type { BotResponse } from '../../types/bot';

/**
 * Procesa consultas combinadas de financiamiento y producto (ej. "cuánto es la inicial de la bujía en Cashea nivel 2").
 * Calcula montos exactos de cuotas e inicial según el precio del repuesto y el nivel del usuario.
 * 
 * @param text - Consulta original del usuario
 * @param norm - Texto normalizado
 * @param settings - Configuración general de la tienda
 * @param tasa - Tasa BCV oficial del día
 * @param session - Registro de la sesión de chat activa
 * @returns Ficha descriptiva de cuotas o mensaje orientador general
 */
export function handleCasheaSmart(
  text: string,
  norm: string,
  settings: Record<string, string>,
  tasa: number,
  session?: any
): BotResponse {
  let nivel: number | null = null;
  let inicialPct = 0.40;

  if (norm.includes('nivel 1') || norm.includes('nv 1') || norm.includes('primer nivel')) {
    nivel = 1;
    inicialPct = 0.40;
  } else if (norm.includes('nivel 2') || norm.includes('nv 2') || norm.includes('segundo nivel')) {
    nivel = 2;
    inicialPct = 0.30;
  } else if (norm.includes('nivel 3') || norm.includes('nv 3') || norm.includes('nivel 4') || norm.includes('nivel 5') || norm.includes('tercer nivel')) {
    nivel = 3;
    inicialPct = 0.20;
  }

  // Identificar si la consulta incluye un repuesto específico del inventario
  const products = searchProductsFuzzy(text);
  if (products.length > 0) {
    const prod = products[0];
    const precioUsd = parseFloat(String(prod.precio_usd));
    const cuotas = parseInt(settings.cashea_cuotas || '3', 10);
    const nivelNum = nivel || 1;
    const inicialUsd = precioUsd * inicialPct;
    const cuotaUsd = (precioUsd - inicialUsd) / cuotas;

    let msg = `💛 *Financiamiento con CASHEA en Tienda Física* 🛞🏍️\n`;
    msg += `Repuesto: *${prod.marca} - ${prod.modelo}*\n`;
    msg += `💵 *Precio Contado:* *$${precioUsd.toFixed(2)} USD* (Bs. ${formatBs(precioUsd * tasa)})\n\n`;

    if (precioUsd < 25) {
      msg += `📌 *Condiciones de Financiamiento Cashea:*\n`;
      msg += `El financiamiento con Cashea aplica exclusivamente para compras a partir de *$25.00 USD* en nuestra tienda física.\n\n`;
    } else {
      msg += `📌 *Cálculo para tu Nivel ${nivelNum} (Inicial ${(inicialPct * 100).toFixed(0)}%):*\n`;
      msg += `• *Inicial a pagar en tienda:* *$${inicialUsd.toFixed(2)} USD* (Bs. ${formatBs(inicialUsd * tasa)})\n`;
      msg += `• *Restante:* *${cuotas} cuotas quincenales* de *$${cuotaUsd.toFixed(2)} USD* (Bs. ${formatBs(cuotaUsd * tasa)})\n\n`;
      msg += `⚠️ *Recuerda:* El financiamiento con Cashea se procesa directamente en nuestra tienda física escaneando el código QR en caja con tu app Cashea al momento del retiro.\n\n`;
    }

    msg += `📦 Te llevas tu repuesto de inmediato retirando en tienda.\n\n`;
    msg += `👉 Escribe *APARTAR* para reservarlo por 24 horas.\n`;
    msg += `👉 O escribe *VENDEDOR* para comunicarte con un asesor.`;

    if (prod.imagen_url && typeof prod.imagen_url === 'string' && prod.imagen_url.trim().length > 5) {
      return { text: msg, image: prod.imagen_url.trim() } as any;
    }
    return msg;
  }

  return handleCasheaResponse(settings, tasa, session, nivel);
}

/**
 * Genera la información institucional y tabla de niveles del sistema Cashea.
 * 
 * @param settings - Configuración de la tienda
 * @param tasa - Tasa BCV oficial
 * @param session - Sesión de chat
 * @param nivelExplicit - Nivel opcional detectado en la conversación
 * @returns Mensaje informativo de políticas de Cashea
 */
export function handleCasheaResponse(
  settings: Record<string, string>,
  tasa: number,
  session?: any,
  nivelExplicit: number | null = null
): string {
  const cuotas = settings?.cashea_cuotas || '3';
  let msg = `💛 *Financiamiento con CASHEA en Crastur (Tienda Física)* 🛞🏍️✨\n\n`;
  msg += `¡Llévate hoy tus repuestos y accesorios pagando solo una inicial y el resto en cuotas quincenales sin interés!\n\n`;
  msg += `📌 *Condiciones y Niveles de Cashea:*\n`;
  msg += `• 🏷️ *Monto Mínimo:* Aplica para compras a partir de *$25.00 USD* en tienda física.\n`;
  msg += `• *Nivel 1:* Pagas el *40%* de inicial en tienda física.\n`;
  msg += `• *Nivel 2:* Pagas el *30%* de inicial en tienda física.\n`;
  msg += `• *Nivel 3 o superior:* Pagas únicamente el *20%* de inicial en tienda física.\n`;
  msg += `• El resto lo pagas en *${cuotas} cuotas quincenales* a tasa 0% interés a través de tu app Cashea.\n\n`;
  msg += `⚠️ *Importante:* El pago con Cashea se realiza **directamente en nuestra tienda física** escaneando el código QR en caja con tu teléfono al momento de retirar tus repuestos.\n\n`;
  msg += `👉 Escribe el repuesto que deseas cotizar (ej: *"pastillas"*, *"aceite"*, *"batería"*).\n`;
  msg += `👉 O escribe *VENDEDOR* para que te asista un asesor en tu compra.`;

  return msg;
}

export default {
  handleCasheaSmart,
  handleCasheaResponse
};
