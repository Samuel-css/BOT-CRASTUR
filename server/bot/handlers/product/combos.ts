/**
 * @file combos.ts
 * @description Módulo de productos extraído de productHandlers.ts.
 */

import { db } from '../../../database';
import { formatBs, formatRate } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { normalizeText } from '../../utils/textUtils';
import { resolveCasheaPlan } from '../../utils/cashea';
import { stockLabel } from '../../utils/stock';
import type { BotResponse } from '../../../types/bot';
export function handleInstagramCombosResponse(
  text: string,
  tasa: number,
  settings: Record<string, string>,
  session: any,
  jid?: string
): BotResponse {
  const combos: any[] = db.prepare(`
    SELECT * FROM products 
    WHERE activo = 1 
      AND (categoria LIKE '%Combo%' OR categoria LIKE '%Kit%' OR modelo LIKE '%Combo%' OR modelo LIKE '%Kit%' OR descripcion LIKE '%combo%' OR descripcion LIKE '%kit%')
    ORDER BY id DESC
    LIMIT 6
  `).all();

  const nombreNegocio = settings.nombre_negocio || 'Crastur';

  if (!combos || combos.length === 0) {
    let msg = `🔥 *Combos & Promociones de Instagram - ${nombreNegocio}* 🛞🏍️📸\n\n`;
    msg += `¡Hola! Con gusto te atendemos con nuestras promociones publicadas en Instagram.\n\n`;
    msg += `📦 Armamos combos semanales para caucheras, talleres y cambios de aceite con **Precio Promoción en Divisas** (Efectivo / Binance Pay) y financiamiento Cashea.\n\n`;
    msg += `👉 ¿Qué repuesto, aceite o insumo viste en nuestras redes? Escríbenos o escribe *VENDEDOR* para darte el precio exacto del combo publicado.`;
    return msg;
  }

  if (combos.length === 1) {
    const c = combos[0];
    const precioUsd = parseFloat(c.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    let msg = `🔥 *Combo Promocional Oficial - ${c.marca} ${c.modelo}* 🛞📸\n\n`;
    if (c.descripcion) {
      msg += `📝 *Incluye:*\n${c.descripcion}\n\n`;
    }
    msg += `💵 *Precio Promoción en Divisas:* *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance Pay 🪙)_\n`;
    msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
    if (precioUsd >= 25) {
      msg += `💛 *Cashea en Tienda Física:* Disponible en cuotas quincenales sin interés.\n`;
    }
    msg += `📦 *Disponibilidad:* ${stockLabel(c, 'Disponible para entrega hoy')}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👉 Escribe *APARTAR* para reservarlo 24h sin costo y retirar en tienda física.\n`;
    msg += `👉 Escribe *DELIVERY* para cotizar envío en moto a tu ubicación en Caracas.\n`;
    msg += `👉 Escribe *VENDEDOR* para hablar con nuestro asesor.`;

    if (c.imagen_url && typeof c.imagen_url === 'string' && c.imagen_url.trim().length > 5) {
      return { text: msg, image: c.imagen_url.trim() } as any;
    }
    return msg;
  }

  let msg = `🔥 *Combos & Kits Oficiales de Instagram - ${nombreNegocio}* 🛞📸\n\n`;
  msg += `Aquí tienes los combos vigentes publicados en nuestras redes sociales:\n\n`;

  combos.forEach((c: any, idx: number) => {
    const precioUsd = parseFloat(c.precio_usd);
    const precioBs = precioUsd * tasa;
    msg += `*${idx + 1}️⃣ ${c.marca} - ${c.modelo}*\n`;
    if (c.descripcion) {
      msg += `   📝 ${c.descripcion}\n`;
    }
    msg += `   💵 Precio Promo: *$${precioUsd.toFixed(2)} USD* (Efectivo / Binance 🪙)\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe el *número del combo* (ej: *1*) para ver detalles y apartarlo.\n`;
  msg += `👉 Escribe *VENDEDOR* para armar un combo personalizado a tu medida.`;

  // [COHERENCIA] Guardar el contexto de los combos listados para que, si el cliente responde
  // con un número (ej. "1"), el bot muestre el detalle de ESE combo y no el menú de categorías.
  // Antes el mensaje prometía "responde 1 para ver detalles" pero el número abría el catálogo.
  if (jid && combos.length >= 2) {
    try {
      const contextJson = JSON.stringify(combos.slice(0, 6).map((c: any) => ({
        id: c.id, marca: c.marca, modelo: c.modelo, precio_usd: c.precio_usd, categoria: c.categoria
      })));
      db.prepare(`
        UPDATE chat_sessions
        SET contexto_productos = ?, contexto_at = ?, ultimo_producto_id = ?, ultimo_producto_nombre = ?, seguimiento_enviado = 0
        WHERE jid = ?
      `).run(contextJson, Date.now(), combos[0].id, `${combos[0].marca} ${combos[0].modelo}`, jid);
    } catch {}
  }

  return msg;
}

