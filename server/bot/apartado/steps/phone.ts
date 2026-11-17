/**
 * @file phone.ts
 * @description Paso del flujo de apartados 24h extraído de apartadoFlow.ts.
 */

import { db, createReservation, recordMetric } from '../../../database';
import { formatVenezuelanPhone, extractVenezuelanPhones } from '../../utils/formatters';
import { normalizeText } from '../../utils/textUtils';
import { detectInterruption, handleInterruptionResponse } from '../interruptions';
import { buildTicket } from '../../copy/messages';
/**
 * Valida el Teléfono de contacto, registra la reserva en base de datos SQLite y
 * emite el Ticket Comprobante Oficial de Apartado por 24 Horas.
 * 
 * @param jid - JID destinatario
 * @param text - Mensaje con el número telefónico o confirmación afirmativa ('SÍ')
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración general de la tienda
 * @returns Comprobante oficial de reserva con ticket numerado y aviso legal
 */
export function handleApartadoTelefono(
  jid: string,
  text: string,
  session: any,
  tasa: number,
  settings: any
): string {
  let metadata: any = {};
  try {
    metadata = JSON.parse(session.apartado_metadata || '{}');
  } catch (e) {
    metadata = {};
  }

  const norm = normalizeText(text);
  if (
    norm === 'cancelar' ||
    norm === 'salir' ||
    norm === 'abortar' ||
    norm === 'cancela' ||
    norm.includes('cancel') ||
    norm.includes('ya no quiero') ||
    norm.includes('no voy a apartar') ||
    norm.includes('olvidalo') ||
    norm.includes('dejalo asi')
  ) {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    return `Operación cancelada 👍. Escribe *MENU* para volver al inicio o escribe el repuesto que buscas.`;
  }

  const isLid = jid.endsWith('@lid');
  const isAffirmative =
    norm === 'si' ||
    norm === 'ok' ||
    norm === 'este' ||
    norm === 'este mismo' ||
    norm === 'el mismo' ||
    norm === 'este es' ||
    norm === 'con este' ||
    norm === 'este numero' ||
    norm === 'a este' ||
    norm === 'si este' ||
    norm === 'si por favor' ||
    norm === 'usa este' ||
    norm === 'claro' ||
    norm === 'dale' ||
    norm === 'por favor' ||
    norm === 'confirmo' ||
    norm === 'te confirmo' ||
    norm === 'correcto' ||
    norm === 'afirmativo' ||
    norm === 'asi es' ||
    norm === 'exacto';

  if (!isAffirmative) {
    const promptMsg = isLid
      ? `Indícanos tu *Número de Teléfono* de contacto (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* para salir)_`
      : `Responde *SÍ* para usar tu número actual o escribe tu teléfono (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* para salir)_`;

    const interruption = detectInterruption(text, norm);
    if (interruption) {
      return handleInterruptionResponse(jid, text, norm, session, tasa, settings, interruption, metadata, promptMsg);
    }
  }

  let telefono: string | null = null;
  let primaryPhone: string | null = null;

  if (isAffirmative) {
    if (isLid) {
      return `Para que el equipo de tienda pueda registrar tu apartado correctamente, por favor escribe tu número de teléfono de contacto (ejemplo: *0412 123 4567*):\n_(Escribe *cancelar* si deseas salir)_`;
    } else {
      const rawPhone = jid.split('@')[0];
      const extracted = extractVenezuelanPhones(rawPhone);
      telefono = extracted.summary || formatVenezuelanPhone(rawPhone) || `+${rawPhone}`;
      primaryPhone = extracted.primary || telefono;
    }
  } else {
    const extracted = extractVenezuelanPhones(text);
    if (!extracted || !extracted.summary) {
      return `Por favor, indícanos un número de teléfono válido (por ejemplo: *0412 123 4567* o *0414 765 4321*):\n_(Escribe *cancelar* para salir)_`;
    }
    telefono = extracted.summary;
    primaryPhone = extracted.primary;
  }

  const nombre = (metadata.nombre && metadata.nombre.trim().length > 2)
    ? metadata.nombre.trim()
    : (session.push_name && /^[a-zA-ZÀ-ÿ\s]{3,}$/.test(session.push_name) ? session.push_name : 'Cliente');
  const cedula = metadata.cedula || 'V-00000000';
  const prodId = metadata.producto_id || session.ultimo_producto_id || null;
  const prodNombre = metadata.producto_nombre || session.ultimo_producto_nombre || 'Insumo / Repuesto Crastur';
  const precioUsd = parseFloat(metadata.precio_usd) || 0;
  const precioBs = precioUsd * tasa;

  // Persistir la reserva atómica en la base de datos con control de stock de TODOS los ítems del combo
  let reservation: any;
  try {
    const itemsToReserve = (metadata.items && Array.isArray(metadata.items) && metadata.items.length > 0)
      ? metadata.items
      : [{ id: prodId, nombre: prodNombre, precio_usd: precioUsd }];

    reservation = createReservation({
      jid,
      nombre,
      cedula,
      telefono,
      producto_id: prodId,
      producto_nombre: prodNombre,
      precio_usd: precioUsd,
      precio_bs: precioBs,
      items: itemsToReserve
    });
  } catch (err: any) {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    const errMsg = (err && typeof err.message === 'string' && err.message.trim())
      ? err.message.trim()
      : 'No pude registrar el apartado en este momento.';
    return `⚠️ ${errMsg}\nSi quieres, escribe *VENDEDOR* y lo resolvemos con una persona.`;
  }

  // Restablecer el estado de la sesión y sincronizar teléfono con el Live Inbox
  db.prepare(`
    UPDATE chat_sessions
    SET step = 'start',
        apartado_metadata = NULL,
        telefono_contacto = ?
    WHERE jid = ?
  `).run(primaryPhone || telefono, jid);

  recordMetric('apartado_creado', prodNombre, jid);

  return buildTicket({
    reservation,
    nombre,
    telefono,
    cedula,
    productName: prodNombre,
    priceUsd: precioUsd,
    tasa,
    settings,
    items: metadata.items,
    expiraEn: reservation.expira_en
  });
}
