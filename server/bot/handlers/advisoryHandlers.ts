/**
 * @file advisoryHandlers.ts
 * @description Manejador de transferencia hacia asesores comerciales y vendedores de mostrador.
 * Consulta la base de datos de vendedores activos y genera enlaces directos a WhatsApp (wa.me).
 * 
 * [MERCADO VENEZUELA]
 * Normaliza números móviles venezolanos agregando el prefijo de país 58 (+58) para enlaces directos.
 */

import { db, getSettings } from '../../database';
import type { Seller } from '../../types/database';

/**
 * Genera el directorio de vendedores comerciales disponibles o un mensaje de visita a tienda física.
 * 
 * @param pushName - Nombre del remitente
 * @returns Mensaje con enlaces de contacto a WhatsApp de los asesores activos
 */
export function handleSellersResponse(pushName: string): string {
  const sellers: Seller[] = db.prepare('SELECT * FROM sellers WHERE activo = 1').all();

  let msg = `¡Con mucho gusto, *${pushName}*! 🤝\n\n`;

  if (sellers.length === 0) {
    msg += `Actualmente nuestro equipo de ventas y asesores comerciales está atendiendo directamente en nuestra tienda física 🏢.\n\n`;
    msg += `Puedes visitarnos en persona o escribirnos por aquí el modelo de tu moto o el insumo de cauchera que buscas para responderte a la brevedad posible.\n\n`;
    msg += `📍 *Ubicación en Caracas:*\nEdificio Liberalba, Avenida Sur 9, San Agustín Norte.\n\n`;
    msg += `🗺️ *Enlace directo en Google Maps:*\n`;
    msg += `https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA\n\n`;
    const horario = getSettings().horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM';
    msg += `🕒 *Horario de Atención:* ${horario}.`;
    return msg;
  }

  msg += `Estos son nuestros asesores de ventas de *Crastur*, con su número directo para llamar o escribir:\n\n`;

  sellers.forEach(s => {
    let digits = String(s.telefono || '').replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '58' + digits.substring(1);
    } else if (digits.length === 10 && /^(412|414|424|416|426|422)/.test(digits)) {
      digits = '58' + digits;
    }
    const waLink = `https://wa.me/${digits}`;

    msg += `👤 *${s.nombre}* · ${s.departamento || 'Ventas'}\n`;
    msg += `📞 ${s.telefono}\n`;
    msg += `💬 WhatsApp: ${waLink}\n\n`;
  });

  msg += `También puedes seguir escribiendo por este chat y un asesor te atiende. ¡Estamos a la orden para ayudarte con tu moto, tu cauchera o tus compras con Cashea! 🛞🏍️✨`;
  return msg;
}

export default {
  handleSellersResponse
};
