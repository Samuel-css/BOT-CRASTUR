/**
 * @file advisoryHandlers.ts
 * @description Transferencia a asesores comerciales con enlaces directos a WhatsApp.
 *
 * [COPY BREVE] Se listan máximo 3 asesores, una línea por persona.
 */

import { db, getSettings } from '../../database';
import type { Seller } from '../../types/database';
import { compose, storeAddress, storeHours, storeMaps } from '../copy/messages';

/**
 * Directorio corto de asesores activos o invitación a la tienda física.
 */
export function handleSellersResponse(pushName: string): string {
  const sellers: Seller[] = db.prepare('SELECT * FROM sellers WHERE activo = 1').all();

  if (sellers.length === 0) {
    return compose([
      '¡Con gusto! Nuestro equipo atiende directamente en la tienda física.',
      `📍 ${storeAddress(getSettings())}`,
      `🗺️ ${storeMaps(getSettings())}`,
      `🕒 ${storeHours(getSettings())}`,
      'Dime qué repuesto buscas y te ayudo por aquí.'
    ]);
  }

  const lines = ['Estos son nuestros asesores de Crastur:'];
  sellers.slice(0, 3).forEach(s => {
    let digits = String(s.telefono || '').replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '58' + digits.substring(1);
    } else if (digits.length === 10 && /^(412|414|424|416|426|422)/.test(digits)) {
      digits = '58' + digits;
    }
    lines.push(`👤 ${s.nombre} · ${s.telefono} · https://wa.me/${digits}`);
  });
  if (sellers.length > 3) lines.push(`Y ${sellers.length - 3} asesor(es) más en tienda.`);
  lines.push('También puedes seguir por este chat y te atiendo por aquí.');
  return compose(lines);
}

export default {
  handleSellersResponse
};
