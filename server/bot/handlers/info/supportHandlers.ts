/**
 * @file supportHandlers.ts
 * @description Respuestas informativas del bot (módulo extraído de infoHandlers.ts).
 */

import { db } from '../../../database';
import { formatRate, formatBs } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { searchProductsFuzzy } from '../../services/searchService';
import { getProductsByCanonicalCategory } from '../../config/categoryGroups';
import { stockLabel } from '../../utils/stock';
export function handleElderlyOrConfusedResponse(pushName: string, settings: Record<string, string>): string {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';

  let msg = `¡Hola! Con mucho gusto le atiendo con toda la paciencia del mundo 😊\n\n`;
  msg += `Soy el asistente virtual de la tienda física de *Crastur* en Caracas. No se preocupe si no está familiarizado/a con esto, aquí estamos para servirle:\n\n`;
  msg += `🏢 *Somos tienda física establecida:* Estamos ubicados en ${direccion} (muy cerca del Centro Financiero Latino y Parque Central).\n`;
  msg += `🗺️ *Ubicación en mapa:* ${mapsUrl}\n`;
  msg += `🕒 *Horario:* ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'}.\n\n`;
  msg += `📌 *¿Cómo le podemos ayudar?*\n`;
  msg += `• Solo dígame qué repuesto o pieza necesita con sus propias palabras (o la marca/modelo de la moto).\n`;
  msg += `• También puede enviarnos una *foto de la pieza* que necesita para que el equipo la identifique.\n`;
  msg += `• O si prefiere hablar o recibir llamada de una *persona de ventas directamente*, escriba la palabra *ASESOR* o *HUMANO* y le pondremos en contacto con nuestro mostrador.`;
  return msg;
}

/**
 * De-escala situaciones de quejas, hostilidad o desconfianza, ratificando la legitimidad del comercio físico.
 * 
 * @param pushName - Nombre del remitente
 * @param settings - Configuración general
 * @returns Mensaje de de-escalación conciliador
 */
export function handleHostilityOrComplaintResponse(pushName: string, settings: Record<string, string>): string {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';

  let msg = `Estimado cliente, lamentamos de antemano cualquier inconveniente, molestia o malentendido 🙏.\n\n`;
  msg += `En *Crastur* nos tomamos con total seriedad el respeto y la atención a cada cliente:\n\n`;
  msg += `🏢 *Somos una empresa comercial legal y tienda física abierta al público:*\n`;
  msg += `📍 ${direccion}\n`;
  msg += `🗺️ *Ver ubicación en Google Maps:*\n${mapsUrl}\n`;
  msg += `🕒 Trabajamos ${settings.horario_atencion || 'de Lunes a Sábado de 8:00 AM a 8:00 PM'} con factura legal y garantía.\n\n`;
  msg += `🤝 Queremos ayudarle a resolver cualquier situación o duda de la mejor manera. Por favor escriba la palabra *ASESOR* para que nuestro personal encargado le atienda de forma prioritaria y personalizada.`;
  return msg;
}

/**
 * Genera el listado de productos de una categoría canónica específica (1. Insumos Cauchera, 2. Repuestos Moto, etc.).
 * 
 * @param categoryName - Nombre oficial de la categoría
 * @param settings - Configuración general
 * @param tasa - Tasa BCV oficial
 * @param session - Sesión de chat actual
 * @param jid - JID destinatario
 * @returns Mensaje listando productos de la categoría con precios y cuotas Cashea
 */
