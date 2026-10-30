/**
 * @file phone.ts
 * @description Paso del flujo de apartados 24h extraído de apartadoFlow.ts.
 */

import { db, createReservation, recordMetric } from '../../../database';
import { searchProductsFuzzy, searchMultipleProducts, extractLeadingQuantity } from '../../services/searchService';
import { formatBs, formatRate, formatVenezuelanPhone, extractVenezuelanPhones } from '../../utils/formatters';
import { normalizeText } from '../../utils/textUtils';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { detectInterruption, handleInterruptionResponse } from '../interruptions';
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
      : 'No fue posible registrar el apartado en este momento. Intenta de nuevo en unos minutos.';
    return `⚠️ ${errMsg}\n\nPuedes escribir *VENDEDOR* si deseas consultar alternativas con nuestro personal de tienda física o escribir qué otro repuesto buscas.`;
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

  // Calcular hora límite exacta de expiración (24 horas continuas)
  const expiraDate = new Date(reservation.expira_en);
  const expiraHora = expiraDate.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let ticket = `✅ *¡APARTADO CONFIRMADO CON ÉXITO!* 🎟️🛞🏍️\n\n`;
  ticket += `Estimado/a *${nombre}*, tu apartado ha sido guardado exclusivamente para ti:\n\n`;
  ticket += `🎟️ *Código Oficial de Ticket:* *#CRA-${String(reservation.id).padStart(4, '0')}*\n`;
  ticket += `📦 *Producto:* ${prodNombre}\n`;

  if (metadata.items && Array.isArray(metadata.items) && metadata.items.length > 1) {
    ticket += `📋 *Detalle del Combo:*\n`;
    metadata.items.forEach((it: any, idx: number) => {
      ticket += `   ${idx + 1}️⃣ ${it.nombre} ($${parseFloat(it.precio_usd).toFixed(2)})\n`;
    });
  }

  ticket += `💵 *Precio Contado:* *$${precioUsd.toFixed(2)} USD*\n`;
  ticket += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  ticket += `🪪 *Cédula:* ${cedula}\n`;
  ticket += `📞 *Teléfono:* ${telefono}\n`;
  ticket += `⏳ *Tiempo de Reserva:* 24 HORAS continuas\n`;
  ticket += `⚠️ *Límite para retirar:* Hasta mañana a las *${expiraHora}*\n`;
  ticket += `_(Si no se retira en 24 horas, el sistema liberará el stock automáticamente)_\n\n`;
  ticket += `━━━━━━━━━━━━━━━━━━━━━\n`;
  ticket += `🏢 *Punto de Retiro en Tienda Física:*\n`;
  ticket += `${settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.'}\n\n`;
  ticket += `🗺️ *Google Maps:* ${settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA'}\n\n`;
  ticket += `🕒 *Horario:* ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'}.\n`;
  ticket += `🛵 *¿Prefieres delivery en Caracas?* Escribe *DELIVERY* o *VENDEDOR* para coordinar el motorizado.\n\n`;
  ticket += `🔒 *Protección de Datos (Venezuela):*\n`;
  ticket += `Tus datos personales se registran confidencialmente de forma exclusiva para la validación y canje de este apartado en tienda física conforme al Art. 28 de la CRBV y la Ley Especial contra los Delitos Informáticos.\n\n`;
  ticket += `Presenta tu cédula en caja al llegar y ¡listo! ¡Te esperamos en Crastur! 🛞🏍️✨`;

  return ticket;
}
