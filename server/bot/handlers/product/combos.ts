/**
 * @file combos.ts
 * @description Combos y promociones de Instagram.
 *
 * [COPY BREVE] Un combo se muestra como ficha corta; varios combos se listan
 * en una línea cada uno, máximo 5.
 */

import { db } from '../../../database';
import type { BotResponse } from '../../../types/bot';
import { buildComboDetail, buildComboList, compose } from '../../copy/messages';

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
    return compose([
      `🔥 *Combos de Instagram - ${nombreNegocio}*`,
      'Armamos combos semanales con *Precio Promoción* y Cashea.',
      'Dime qué combo viste en redes o qué repuesto necesitas y te doy el precio.'
    ]);
  }

  if (combos.length === 1) {
    const c = combos[0];
    const msg = buildComboDetail({ combo: c, tasa, settings });
    if (c.imagen_url && typeof c.imagen_url === 'string' && c.imagen_url.trim().length > 5) {
      return { text: msg, image: c.imagen_url.trim() } as any;
    }
    return msg;
  }

  // Guardar contexto para que el cliente responda 1-5 y vea el detalle.
  if (jid) {
    try {
      const contextJson = JSON.stringify(combos.slice(0, 5).map((c: any) => ({
        id: c.id, marca: c.marca, modelo: c.modelo, precio_usd: c.precio_usd, categoria: c.categoria
      })));
      db.prepare(`
        UPDATE chat_sessions
        SET contexto_productos = ?, contexto_at = ?, ultimo_producto_id = ?, ultimo_producto_nombre = ?, seguimiento_enviado = 0
        WHERE jid = ?
      `).run(contextJson, Date.now(), combos[0].id, `${combos[0].marca} ${combos[0].modelo}`, jid);
    } catch {}
  }

  return buildComboList({ combos, settings });
}

export default {
  handleInstagramCombosResponse
};
