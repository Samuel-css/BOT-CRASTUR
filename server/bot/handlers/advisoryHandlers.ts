/**
 * @file advisoryHandlers.ts
 * @description Manejador de transferencia hacia asesores comerciales y vendedores de mostrador.
 * Consulta la base de datos de vendedores activos y genera enlaces directos a WhatsApp (wa.me).
 * 
 * [MERCADO VENEZUELA]
 * Normaliza números móviles venezolanos agregando el prefijo de país 58 (+58) para enlaces directos.
 */

import { db } from '../../database';
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
    msg += `🕒 *Horario de Atención:* Lunes a Sábado de 8:00 AM a 8:00 PM.`;
    return msg;
  }

  msg += `Aquí tienes la lista de nuestros asesores de ventas en *Crastur* con sus números directos disponibles para llamar o escribir con un toque:\n\n`;

  sellers.forEach(s => {
    let digits = String(s.telefono || '').replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '58' + digits.substring(1);
    } else if (digits.length === 10 && /^(412|414|424|416|426|422)/.test(digits)) {
      digits = '58' + digits;
    }
    const waLink = `https://wa.me/${digits}`;

    msg += `👤 *${s.nombre}* (${s.departamento || 'Ventas'})\n`;
    msg += `📞 Número directo: ${s.telefono}\n`;
    msg += `💬 Enlace directo de WhatsApp:\n${waLink}\n\n`;
  });

  msg += `¡Nuestros asesores están a la orden para verificar el repuesto de tu moto, insumos para tu cauchera o apartar tus productos con Cashea! 🛞🏍️✨`;
  return msg;
}

export default {
  handleSellersResponse
};
