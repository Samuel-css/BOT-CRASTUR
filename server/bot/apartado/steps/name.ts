/**
 * @file name.ts
 * @description Paso del flujo de apartados 24h extraído de apartadoFlow.ts.
 */

import { db, createReservation, recordMetric } from '../../../database';
import { searchProductsFuzzy, searchMultipleProducts, extractLeadingQuantity } from '../../services/searchService';
import { formatBs, formatRate, formatVenezuelanPhone, extractVenezuelanPhones } from '../../utils/formatters';
import { normalizeText } from '../../utils/textUtils';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { detectInterruption, handleInterruptionResponse } from '../interruptions';
/**
 * Valida el Nombre y Apellido del cliente para registrar en el comprobante oficial.
 * Filtra apodos, jerga venezolana y nombres de modelos de motos.
 * 
 * @param jid - JID destinatario
 * @param text - Mensaje con el nombre ingresado
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración de la tienda
 * @returns Respuesta de confirmación y solicitud de Cédula de Identidad
 */
export function handleApartadoNombre(
  jid: string,
  text: string,
  session: any,
  tasa: number,
  settings: any
): string {
  const norm = normalizeText(text);

  let metadata: any = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const promptMsg = `Por favor, indícanos tu *Nombre y Apellido* completo para emitir el comprobante (ejemplo: *Carlos Pérez*):\n_(Escribe *cancelar* para salir)_`;

  const interruption = detectInterruption(text, norm);
  if (interruption) {
    return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
  }

  let cleanNombre = text.trim()
    .replace(/^(?:mi nombre es|me llamo|yo soy|a nombre de)\s+/i, '')
    .trim();
  const normClean = normalizeText(cleanNombre);

  // Validaciones morfológicas de nombres de personas reales
  const hasDigits = /\d/.test(cleanNombre);
  const hasSymbols = /[?!¿¡@#$%^&*()_+=<>{}[\]~;:]/.test(cleanNombre);
  const isValidChars = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.\']+$/.test(cleanNombre);
  const words = cleanNombre.split(/\s+/).filter(w => w.length >= 2);

  // Palabras no válidas como nombre propio (jerga, motos, verbos de pedido o términos de catálogo)
  const invalidNameTokens = [
    'chamo', 'pana', 'mano', 'bro', 'amigo', 'cliente', 'moto', 'sbr', 'bera', 'empire',
    'horse', 'owen', 'mecanico', 'comprador', 'tienda', 'repuesto', 'repuestos',
    // Verbos/expresiones de pedido que nunca son un nombre
    'quiero', 'quiere', 'necesito', 'necesita', 'agrega', 'agregar', 'dame', 'deme',
    'busco', 'buscar', 'llevo', 'aparta', 'apartar', 'reserva', 'reservar', 'comprar',
    // Términos de catálogo que tampoco son nombres
    'bujia', 'aceite', 'pastilla', 'balata', 'freno', 'disco', 'zapata', 'cadena',
    'arrastre', 'pinon', 'corona', 'tripa', 'camara', 'caucho', 'llanta', 'parche',
    'pega', 'valvula', 'mecha', 'plomo', 'filtro', 'bateria', 'casco', 'guante',
    'retrovisor', 'espejo', 'led', 'bombillo', 'refrigerante'
  ];
  const containsInvalidToken = invalidNameTokens.some(tok => normClean.split(' ').includes(tok));
  const startsWithArticle = normClean.startsWith('el ') || normClean.startsWith('la ');

  if (hasDigits || hasSymbols || !isValidChars || words.length < 2 || cleanNombre.length < 5 || cleanNombre.length > 50 || containsInvalidToken || startsWithArticle) {
    return `Para que el apartado quede a tu nombre en caja, indícanos tu *Nombre y Apellido* completo (ejemplo: *Carlos Pérez*):\n_(Escribe *cancelar* si deseas salir)_`;
  }

  const nombre = cleanNombre;
  metadata.nombre = nombre;

  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_cedula',
        apartado_metadata = ?
    WHERE jid = ?
  `).run(JSON.stringify(metadata), jid);

  let msg = `¡Gracias, *${nombre}*! 🪪\n\n`;
  msg += `Ahora indícanos tu número de *Cédula de Identidad* (ejemplo: *V-18456789* o *28123456*):\n_(Escribe *cancelar* si deseas salir)_`;
  return msg;
}
