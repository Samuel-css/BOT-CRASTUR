/**
 * @file cedula.ts
 * @description Paso del flujo de apartados 24h extraído de apartadoFlow.ts.
 */

import { db, createReservation, recordMetric } from '../../../database';
import { searchProductsFuzzy, searchMultipleProducts, extractLeadingQuantity } from '../../services/searchService';
import { formatBs, formatRate, formatVenezuelanPhone, extractVenezuelanPhones } from '../../utils/formatters';
import { normalizeText } from '../../utils/textUtils';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { detectInterruption, handleInterruptionResponse } from '../interruptions';
/**
 * Valida la Cédula de Identidad venezolana (o RIF comercial) del cliente.
 * Admite formatos venezolanos V-, E-, J- y números históricos cortos (5 a 9 dígitos).
 * 
 * @param jid - JID destinatario
 * @param text - Mensaje con el número de documento
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración de la tienda
 * @returns Respuesta de confirmación y solicitud del número telefónico de contacto
 */
export function handleApartadoCedula(
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

  const promptMsg = `Indícanos tu número de *Cédula de Identidad* (ejemplo: *V-18456789* o *28123456*):\n_(Escribe *cancelar* para salir)_`;

  const interruption = detectInterruption(text, norm);
  if (interruption) {
    return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
  }

  // Sanitización de prefijos conversacionales venezolanos
  let clean = text.toUpperCase().replace(/[\s\.\-]/g, '');
  clean = clean.replace(/^(?:MICEDULAES|MICEDULA|CEDULA:|CEDULA|CI:|CI|NUMERO:|NUMERO|DOCUMENTO:|ES LA|TENGO LA)/i, '');
  const match = clean.match(/^(?:([VE]))?(\d{5,9})$/);

  // Soporte para RIF jurídico (J-) para talleres mecánicos y pequeños comercios
  const matchJ = clean.match(/^(J)(\d{7,10})$/);
  if (matchJ && !match) {
    const cedula = `J-${matchJ[2]}`;
    metadata.cedula = cedula;
    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_telefono',
          apartado_metadata = ?
      WHERE jid = ?
    `).run(JSON.stringify(metadata), jid);
    const isLid = jid.endsWith('@lid');
    let msg = `¡Perfecto! RIF/Cédula *${cedula}* registrado. 📞\n\n`;
    if (isLid) {
      msg += `Indícanos tu *Número de Teléfono* (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* si deseas salir)_`;
    } else {
      const rawPhone = jid.split('@')[0];
      const phoneFormatted = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
      msg += `¿Deseas registrar este mismo número de WhatsApp (*${phoneFormatted}*) como teléfono de contacto?\n\n`;
      msg += `👉 Responde *SÍ* para usar este número.\n`;
      msg += `👉 O escribe tu número de teléfono (ejemplo: *0412 123 4567*):`;
    }
    return msg;
  }

  if (!match) {
    return `⚠️ Por favor ingresa un número de cédula válido para tu ticket (ejemplo: *V-18456789*, *28123456* o la cédula antigua de 5 dígitos):\n_(Escribe *cancelar* si deseas salir)_`;
  }

  const prefix = match[1] || 'V';
  const number = match[2];
  const cedula = `${prefix}-${number}`;

  metadata.cedula = cedula;

  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_telefono',
        apartado_metadata = ?
    WHERE jid = ?
  `).run(JSON.stringify(metadata), jid);

  const isLid = jid.endsWith('@lid');
  let msg = `¡Perfecto! Cédula *${cedula}* registrada. 📞\n\n`;

  if (isLid) {
    msg += `Para avisarte cuando tu apartado esté listo para retirar en tienda, indícanos tu *Número de Teléfono* (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* si deseas salir)_`;
  } else {
    const rawPhone = jid.split('@')[0];
    const phoneFormatted = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
    msg += `¿Deseas registrar este mismo número de WhatsApp (*${phoneFormatted}*) como teléfono de contacto para el retiro en tienda?\n\n`;
    msg += `👉 Responde *SÍ* para usar este número.\n`;
    msg += `👉 O escribe tu número de teléfono (ejemplo: *0412 123 4567*):`;
  }
  return msg;
}
