/**
 * @file logisticsHandlers.ts
 * @description Respuestas informativas del bot (módulo extraído de infoHandlers.ts).
 */

import { db } from '../../../database';
import { formatRate, formatBs } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { searchProductsFuzzy } from '../../services/searchService';
import { getProductsByCanonicalCategory } from '../../config/categoryGroups';
import { stockLabel } from '../../utils/stock';
export function handleDeliveryResponse(
  settings: Record<string, string>,
  session: any,
  tasa: number,
  text: string
): string {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const horario = settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';

  let matchedProduct: any = null;
  const searchResults = searchProductsFuzzy(text);
  if (searchResults.length > 0) {
    matchedProduct = searchResults[0];
  } else if (session?.ultimo_producto_id) {
    matchedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
  }

  const detectedZone = detectCaracasZone(text, settings);

  let msg = `🛵 *Delivery en Caracas - Crastur* 📦\n\n`;
  msg += `¡Sí! Despachamos hoy mismo con motorizado a tu domicilio, trabajo o taller mecánico en Caracas.\n\n`;

  if (matchedProduct) {
    const precioUsd = parseFloat(matchedProduct.precio_usd) || 0;
    msg += `📦 *Repuesto:* *${matchedProduct.marca} - ${matchedProduct.modelo}*\n`;
    msg += `💵 *Precio:* *$${precioUsd.toFixed(2)} USD* (Bs. ${formatBs(precioUsd * tasa)})\n\n`;
  }

  if (detectedZone) {
    msg += `📍 *Zona:* *${detectedZone.nombre}*\n`;
    msg += `🛵 *Tarifa motorizado:* *${detectedZone.tarifa}* (despacho hoy).\n\n`;
  } else {
    msg += `📍 *Tarifas estimadas de motorizado:*\n`;
    msg += `• San Agustín, Centro, Bellas Artes: *$2 a $3 USD*\n`;
    msg += `• Catia, El Valle, Chacao, Baruta, Petare: *$3 a $5 USD*\n\n`;
  }

  msg += `🏢 *Retiro gratis en tienda:* ${direccion} (${horario}).\n`;
  msg += `💳 *Pago:* Efectivo ($ con descuento), Pago Móvil (tasa BCV) o Cashea en tienda.\n\n`;
  msg += `👉 Indícanos tu *zona o dirección exacta* para coordinar el despacho, o escribe *VENDEDOR*.`;
  return msg;
}

/**
 * Aclara la política de cobertura territorial (servicio exclusivo en Caracas y entrega a comisionistas).
 * 
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV oficial
 * @returns Mensaje aclaratorio de envíos
 */
export function handleNationalShippingResponse(session: any, tasa: number): string {
  let msg = `📦 *Envíos al Interior del País - Crastur* 🇻🇪\n\n`;
  msg += `Actualmente trabajamos exclusivamente con:\n`;
  msg += `1️⃣ *Delivery en moto a toda Caracas* 🛵\n`;
  msg += `2️⃣ *Retiro en tienda física:* San Agustín Norte, Caracas (Edif. Liberalba) 🏢\n\n`;
  msg += `⚠️ No realizamos envíos directos por agencias nacionales (MRW, Zoom o Tealca).\n`;
  msg += `💡 Si tienes un familiar, amigo o comisionista en Caracas, ¡con gusto se lo entregamos a él!\n\n`;
  msg += `👉 Escribe qué repuesto buscas para darte precio y disponibilidad.`;
  return msg;
}

/**
 * Provee la tasa de cambio oficial vigente del BCV y explica las modalidades de pago vinculadas.
 * 
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @returns Mensaje informativo de tasa
 */
export function handleImmediatePickupResponse(settings: Record<string, string>): string {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  const horario = settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';
  let msg = `¡Claro que sí! Estamos activos y atendiendo con gusto en nuestra tienda física 🛞🏍️🏢✨\n\n`;
  msg += `🕒 *Horario de Atención:* ${horario}\n`;
  msg += `🏠 *Dirección:* ${direccion}\n`;
  msg += `🗺️ *Google Maps:* ${mapsUrl}\n\n`;
  msg += `💡 *Consejo:* Si ya sabes qué repuesto necesitas, escribe *APARTAR* antes de salir para dejártelo reservado en caja a tu nombre por 24 horas continuas sin costo adicional. ¡Así te aseguras de tenerlo apartado al llegar! 👍\n\n`;
  msg += `👉 Escribe el repuesto que buscas o escribe *VENDEDOR* si deseas que te esperemos con la pieza lista.`;
  return msg;
}

/**
 * Detalla puntos de referencia urbanos, estaciones de metro y rutas de acceso a la tienda física.
 * 
 * @param settings - Configuración general
 * @returns Mensaje con guía de cómo llegar
 */
export function handleReferencePointsResponse(settings: Record<string, string>): string {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  const horario = settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';
  let msg = `📍 *Cómo Llegar a Crastur - Puntos de Referencia* 🛞🏢\n\n`;
  msg += `Nuestra tienda física está ubicada en el centro de Caracas, con acceso rápido y cómodo:\n\n`;
  msg += `🏠 *Dirección:* ${direccion}\n\n`;
  msg += `📌 *Puntos de Referencia Clave:*\n`;
  msg += `• A escasos metros de las torres de *Parque Central*.\n`;
  msg += `• Entre la *Avenida Bolívar* y la *Avenida Lecuna*.\n`;
  msg += `• 🚇 *Estaciones de Metro más cercanas:*\n`;
  msg += `  - *Metro Bellas Artes* (a 3 cuadras caminando).\n`;
  msg += `  - *Metro Nuevo Circo* (a 4 cuadras).\n\n`;
  msg += `🗺️ *Toca aquí para abrir la ubicación en Google Maps (Ruta GPS):*\n`;
  msg += `${mapsUrl}\n\n`;
  msg += `🕒 *Horario Corrido:* ${horario}.\n`;
  msg += `🛵 *¿Prefieres no salir?* Escribe *DELIVERY* y te lo enviamos en moto directo a tu casa o taller en Caracas.\n\n`;
  msg += `👉 Escribe el repuesto que buscas para confirmarte existencia antes de venir.`;
  return msg;
}

/**
 * Aclara que Crastur es una tienda de venta de repuestos nuevos y no un taller mecánico.
 * Ofrece servicio de delivery al mecánico de confianza o recomendaciones aliadas.
 * 
 * @param session - Sesión de chat actual
 * @returns Mensaje aclaratorio sobre instalación
 */
export function handleStoreHoursResponse(settings: Record<string, string>): string {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  const rawHorario = settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';

  let msg = `🕒 *Horario de Atención - Crastur* 🛞🏍️🏢\n\n`;
  msg += `Te atendemos en nuestra tienda física en el siguiente horario:\n\n`;
  if (rawHorario.includes('|')) {
    const parts = rawHorario.split('|').map(s => s.trim());
    parts.forEach(p => {
      msg += `📅 *${p}*\n`;
    });
  } else {
    msg += `📅 *${rawHorario}*\n`;
  }
  msg += `\n🤖 Nuestro asistente virtual responde consultas y cotizaciones 24/7.\n\n`;
  msg += `🏠 *Dirección:* ${direccion}\n`;
  msg += `🗺️ *Google Maps:* ${mapsUrl}\n\n`;
  msg += `¡Te esperamos con la mejor atención y productos garantizados! 🛞🏍️✨`;
  return msg;
}

/**
 * Informa sobre políticas de cambio y garantías por defectos de fábrica.
 * 
 * @returns Mensaje con condiciones de garantía
 */
export function handleLocationResponse(settings: Record<string, string>): string {
  const direccion = settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas, Venezuela';
  const mapsUrl = settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
  const horario = settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';

  let msg = `📍 *Ubicación de Tienda Física - Crastur* 🛞🏍️🏢\n\n`;
  msg += `🏠 *Dirección:* ${direccion}\n\n`;
  msg += `🗺️ *Enlace directo en Google Maps:*\n${mapsUrl}\n\n`;
  msg += `🕒 *Horario de Atención:* ${horario}.\n`;
  msg += `🛵 *Delivery:* Disponible a toda Caracas con motorizado de confianza.\n\n`;
  msg += `¡Te esperamos con la mejor atención en insumos de cauchera y repuestos de moto! 🛞🏍️✨`;
  return msg;
}

/**
 * Explica con claridad y de forma cercana cómo comprar o apartar en Crastur.
 * Pensado para clientes nuevos que preguntan "¿cómo compro?" o "¿cómo hago el pedido?".
 *
 * @param settings - Configuración general de la tienda
 * @returns Guía amable de compra en 3 pasos
 */
