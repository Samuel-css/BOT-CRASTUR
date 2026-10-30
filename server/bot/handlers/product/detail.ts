/**
 * @file detail.ts
 * @description Módulo de productos extraído de productHandlers.ts.
 */

import { db } from '../../../database';
import { formatBs, formatRate } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { normalizeText } from '../../utils/textUtils';
import { resolveCasheaPlan } from '../../utils/cashea';
import { stockLabel } from '../../utils/stock';
import type { BotResponse } from '../../../types/bot';
import { reglasDeComplemento, buscarComplementarios, fraseComplemento } from './crossSell';
export function handleSingleProductDetail(
  p: any,
  tasa: number,
  settings: Record<string, string>,
  session: any
): BotResponse {
  const precioUsd = parseFloat(p.precio_usd) || 0;
  const precioBs = precioUsd * tasa;
  // [CONSISTENCIA] Plan Cashea centralizado: respeta el nivel del cliente (session.nivel_cashea)
  // y la configuración del panel, evitando que la ficha diga 40% cuando Cashea aplica 20%.
  const plan = resolveCasheaPlan(settings, session);
  const cuotasCashea = plan.cuotas;
  const inicialPct = plan.inicialPct;
  const n1 = precioUsd * inicialPct;

  let msg = `🛞🏍️ *${p.marca} - ${p.modelo}*\n`;
  if (p.descripcion) {
    msg += `📝 ${p.descripcion}\n`;
  }
  msg += `💵 *Precio Promoción en Divisas:* *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance Pay 🪙)_\n`;
  msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  msg += `📦 *Disponibilidad:* ${stockLabel(p)}\n\n`;

  // Esquema resumido de financiamiento Cashea
  if (precioUsd < 25) {
    msg += `💛 *Cashea en Tienda Física:* Disponible para compras a partir de *$25 USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  }

  // [VENTA CRUZADA REAL] Se buscan productos COMPLEMENTARIOS del inventario según la
  // categoría/tipo del artículo visto, y se ofrecen para que el cliente elija.
  const sugeridos = buscarComplementarios(p);
  if (sugeridos.length > 0 && session) {
    msg += `💡 *${fraseComplemento(p)}:*\n`;
    sugeridos.forEach((s: any, i: number) => {
      const sPrec = parseFloat(s.precio_usd) || 0;
      msg += `   *${i + 1}.* ${s.marca} - ${s.modelo} — *$${sPrec.toFixed(2)} USD* (Bs. ${formatBs(sPrec * tasa)})\n`;
    });
    msg += `   👉 Responde con el *número* para agregarlo a tu pedido, o *NO* para continuar sin agregar.\n\n`;

    // Guardar los sugeridos en el contexto para que "1" los reconozca (handleContextualSelection).
    // Se marca `es_sugerido` y se incluye el producto base para que, al elegir un número,
    // el cliente termine con su producto + el complemento armado en el carrito.
    try {
      const contexto = [
        { id: p.id, marca: p.marca, modelo: p.modelo, precio_usd: p.precio_usd, categoria: p.categoria, es_base: true },
        ...sugeridos.map((s: any) => ({
          id: s.id, marca: s.marca, modelo: s.modelo, precio_usd: s.precio_usd, categoria: s.categoria, es_sugerido: true
        }))
      ];
      db.prepare('UPDATE chat_sessions SET contexto_productos = ?, contexto_at = ? WHERE jid = ?').run(JSON.stringify(contexto), Date.now(), session.jid);
    } catch {}
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo 24h sin costo y retirar en tienda 🏢.\n`;
  msg += `👉 Escribe *DELIVERY* para cotizar envío en moto en Caracas 🛵.\n`;
  msg += `👉 Escribe *VENDEDOR* para hablar con un asesor humano 👨‍🔧.`;

  if (p.imagen_url && typeof p.imagen_url === 'string' && p.imagen_url.trim().length > 5) {
    return { text: msg, image: p.imagen_url.trim() } as any;
  }

  return msg;
}

/**
 * [VENTA CRUZADA] Devuelve el conjunto de palabras clave con las que un producto
 * "conversa" comercialmente (qué se vende junto a qué), y la frase de sugerencia.
 */
