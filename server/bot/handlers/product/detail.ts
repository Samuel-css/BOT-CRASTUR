/**
 * @file detail.ts
 * @description Ficha individual de producto.
 *
 * [COPY BREVE] Precio y stock primero. La venta cruzada se muestra como una sola
 * sugerencia en una línea, no como una lista de tres productos con párrafos.
 */

import { db } from '../../../database';
import type { BotResponse } from '../../../types/bot';
import { buscarComplementarios } from './crossSell';
import { buildProductDetail } from '../../copy/messages';

export function handleSingleProductDetail(
  p: any,
  tasa: number,
  settings: Record<string, string>,
  session: any
): BotResponse {
  const sugeridos = buscarComplementarios(p);
  const firstSuggested = sugeridos.length > 0 ? sugeridos[0] : null;

  // Guardar el contexto completo para que "1" agregue el sugerido al pedido.
  if (sugeridos.length > 0 && session) {
    try {
      const contexto = [
        { id: p.id, marca: p.marca, modelo: p.modelo, precio_usd: p.precio_usd, categoria: p.categoria, es_base: true },
        ...sugeridos.map((s: any) => ({
          id: s.id, marca: s.marca, modelo: s.modelo, precio_usd: s.precio_usd, categoria: s.categoria, es_sugerido: true
        }))
      ];
      db.prepare('UPDATE chat_sessions SET contexto_productos = ?, contexto_at = ? WHERE jid = ?')
        .run(JSON.stringify(contexto), Date.now(), session.jid);
    } catch {}
  }

  const msg = buildProductDetail({
    product: p,
    tasa,
    settings,
    session,
    suggested: firstSuggested
  });

  if (p.imagen_url && typeof p.imagen_url === 'string' && p.imagen_url.trim().length > 5) {
    return { text: msg, image: p.imagen_url.trim() } as any;
  }

  return msg;
}

export default {
  handleSingleProductDetail
};
