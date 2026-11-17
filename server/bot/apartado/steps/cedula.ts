/**
 * @file cedula.ts
 * @description Paso del flujo de apartados 24h extraído de apartadoFlow.ts.
 */

import { db } from '../../../database';
import { formatVenezuelanPhone } from '../../utils/formatters';
import { normalizeText } from '../../utils/textUtils';
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

  const promptMsg = `Dime tu *Cédula de Identidad* (ej: *V-18456789*).\n_(Escribe *cancelar* para salir)_`;

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
    let msg = `¡Perfecto! RIF/Cédula *${cedula}* registrado. 📞\n`;
    if (isLid) {
      msg += 'Dime tu *Número de Teléfono* (ej: *0412 123 4567*).\n';
    } else {
      const rawPhone = jid.split('@')[0];
      const phoneFormatted = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
      msg += `¿Registro este mismo WhatsApp (*${phoneFormatted}*) como teléfono de contacto?\n`;
      msg += 'Responde *SÍ* o escribe tu número (ej: *0412 123 4567*).\n';
    }
    msg += '_(Escribe *cancelar* para salir)_';
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
  let msg = `¡Perfecto! Cédula *${cedula}* registrada. 📞\n`;

  if (isLid) {
    msg += 'Dime tu *Número de Teléfono* (ej: *0412 123 4567*).\n';
  } else {
    const rawPhone = jid.split('@')[0];
    const phoneFormatted = formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
    msg += `¿Registro este mismo WhatsApp (*${phoneFormatted}*) como teléfono de contacto?\n`;
    msg += 'Responde *SÍ* o escribe tu número (ej: *0412 123 4567*).\n';
  }
  msg += '_(Escribe *cancelar* para salir)_';
  return msg;
}
