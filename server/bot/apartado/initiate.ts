/**
 * @file initiate.ts
 * @description Módulo del flujo de apartados 24h extraído de apartadoFlow.ts.
 */

import { db, createReservation, recordMetric } from '../../database';
import { searchProductsFuzzy, searchMultipleProducts, extractLeadingQuantity } from '../services/searchService';
import { formatBs, formatRate, formatVenezuelanPhone, extractVenezuelanPhones } from '../utils/formatters';
import { normalizeText } from '../utils/textUtils';
import { detectCaracasZone } from '../utils/caracasDelivery';
/**
 * Inicializa el flujo de apartado por 24 horas, identificando productos individuales o combos
 * y verificando stock antes de solicitar datos personales al cliente.
 * 
 * @param jid - JID destinatario
 * @param text - Texto del mensaje del cliente
 * @param norm - Texto normalizado
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV efectiva
 * @param settings - Configuración general
 * @param pushName - Nombre de perfil de WhatsApp sanitizado
 * @returns Mensaje con resumen de apartado y solicitud del nombre
 */
export function initiateApartadoFlow(
  jid: string,
  text: string,
  norm: string,
  session: any,
  tasa: number,
  settings: any,
  pushName: string
): string {
  // 1. Detectar solicitud explícita de combo en el mismo mensaje (ej: "apartar bujia y aceite")
  const multiProducts = searchMultipleProducts(text);
  if (multiProducts.length >= 2) {
    // Validar stock disponible para cada uno de los productos que componen el combo
    const agotados = multiProducts.filter(p => p.stock !== null && p.stock !== undefined && p.stock <= 0);
    if (agotados.length > 0) {
      const nombresAgotados = agotados.map(p => `*${p.marca} - ${p.modelo}*`).join(', ');
      return `⚠️ Los siguientes productos del combo se encuentran actualmente *agotados* en tienda: ${nombresAgotados}.\n\n👉 Escribe *VENDEDOR* para consultar fechas de llegada o armar un combo alternativo con nuestro asesor.`;
    }

    const totalUsd = multiProducts.reduce((sum, p) => sum + (parseFloat(p.precio_usd) || 0) * (p.cantidad || 1), 0);
    const comboNombre = `Combo: ${multiProducts.map(p => `${p.marca} ${p.modelo}`).join(' + ')}`;
    const metadata = {
      is_combo: true,
      producto_id: multiProducts[0].id,
      producto_nombre: comboNombre,
      precio_usd: totalUsd,
      items: multiProducts.map(p => ({
        id: p.id,
        nombre: `${p.marca} ${p.modelo}`,
        precio_usd: p.precio_usd,
        cantidad: p.cantidad || 1
      }))
    };

    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_nombre',
          ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          apartado_metadata = ?
      WHERE jid = ?
    `).run(multiProducts[0].id, comboNombre, JSON.stringify(metadata), jid);

    let msg = `🛒 *Apartado de Combo por 24 Horas:* *${comboNombre}* ⏱️\n\n`;
    multiProducts.forEach((p, idx) => {
      const cant = p.cantidad || 1;
      msg += `${idx + 1}️⃣ *${p.marca} - ${p.modelo}${cant > 1 ? ` (x${cant})` : ''}:* *$${(parseFloat(p.precio_usd) * cant).toFixed(2)} USD* (Bs. ${formatBs(p.precio_usd * cant * tasa)})\n`;
    });
    msg += `\n💵 *Total Combo:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalUsd * tasa)})\n`;
    msg += `Te reservamos todos los productos por 24 horas continuas sin costo para retirar en tienda física.\n\n`;
    msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
    return msg;
  }

  // 2. Comprobar si el usuario especificó un producto individual en el mensaje
  const searchResults = searchProductsFuzzy(text);
  const wantsBoth =
    norm.includes('ambos') ||
    norm.includes('ambas') ||
    norm.includes('los dos') ||
    norm.includes('las dos') ||
    norm.includes('los 2') ||
    norm.includes('las 2') ||
    norm.includes('las dos cosas') ||
    norm.includes('los dos repuestos');

  if (searchResults.length > 0 && !wantsBoth) {
    const matchedProduct = searchResults[0];
    const prodNombre = `${matchedProduct.marca} - ${matchedProduct.modelo}`;

    // Verificación de stock individual
    if (matchedProduct.stock !== null && matchedProduct.stock !== undefined && matchedProduct.stock <= 0) {
      return `⚠️ El repuesto *${prodNombre}* se encuentra actualmente *agotado* en nuestra tienda física.\n\n👉 Puedes escribir *VENDEDOR* para consultar con nuestro asesor la fecha de llegada del nuevo lote o escribir qué otro repuesto necesitas.`;
    }

    const prodPrecioUsd = parseFloat(matchedProduct.precio_usd) || 0;
    // [CANTIDAD] "apartar 4 aceites" reserva 4 unidades de verdad.
    const cantSingle = Math.max(1, extractLeadingQuantity(norm));
    const totalSingleUsd = prodPrecioUsd * cantSingle;

    const metadata = {
      is_combo: false,
      producto_id: matchedProduct.id,
      producto_nombre: prodNombre,
      precio_usd: totalSingleUsd,
      items: [{
        id: matchedProduct.id,
        nombre: prodNombre,
        precio_usd: prodPrecioUsd,
        cantidad: cantSingle
      }]
    };

    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_nombre',
          ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          apartado_metadata = ?
      WHERE jid = ?
    `).run(matchedProduct.id, prodNombre, JSON.stringify(metadata), jid);

    let msg = `🛞🏍️ *Apartado por 24 Horas:* *${prodNombre}*${cantSingle > 1 ? ` (x${cantSingle})` : ''} ⏱️\n\n`;
    msg += `💵 *Precio Contado:* *$${totalSingleUsd.toFixed(2)} USD* (Bs. ${formatBs(totalSingleUsd * tasa)})\n\n`;
    msg += `Te reservamos esta pieza sin costo adicional por 24 horas continuas para retirarla en tienda física o pedirla por delivery en Caracas.\n\n`;
    msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
    return msg;
  }

  // 3. Evaluar si proviene de un contexto previo de combo o cotización múltiple
  let comboItems: any[] = [];
  try {
    comboItems = JSON.parse(session.contexto_productos || '[]');
  } catch (e) {}

  const isComboAlready = session.ultimo_producto_nombre && session.ultimo_producto_nombre.startsWith('Combo');

  // [CONTEXTO] El cliente puede pedir "apartar todo lo que te pedí", "todo eso", "la cotización",
  // refiriéndose a los productos ya cotizados en la conversación. En ese caso se aparta el combo completo.
  const wantsEverything =
    norm.includes('todo lo que') ||
    norm.includes('todo eso') ||
    norm.includes('todo esto') ||
    norm.includes('todo el pedido') ||
    norm.includes('todos los productos') ||
    norm.includes('la cotizacion') ||
    norm.includes('el combo completo') ||
    norm.includes('todos') ||
    norm.includes('todo');

  if ((isComboAlready || wantsBoth || wantsEverything) && Array.isArray(comboItems) && comboItems.length >= 2) {
    const selectedItems = (wantsBoth && !wantsEverything) ? comboItems.slice(0, 2) : comboItems;
    const comboTotalUsd = selectedItems.reduce((sum, p) => sum + (parseFloat(p.precio_usd) || 0) * (parseInt(p.cantidad, 10) || 1), 0);
    const comboTitle = `Combo: ${selectedItems.map(p => `${p.marca} ${p.modelo}`).join(' + ')}`;
    const metadata = {
      is_combo: true,
      producto_id: selectedItems[0].id,
      producto_nombre: comboTitle,
      precio_usd: comboTotalUsd,
      items: selectedItems.map(p => ({
        id: p.id,
        nombre: `${p.marca} ${p.modelo}`,
        precio_usd: p.precio_usd,
        cantidad: parseInt(p.cantidad, 10) || 1
      }))
    };

    db.prepare(`
      UPDATE chat_sessions
      SET step = 'apartado_pidiendo_nombre',
          ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          apartado_metadata = ?
      WHERE jid = ?
    `).run(selectedItems[0].id, comboTitle, JSON.stringify(metadata), jid);

    let msg = `🛒 *Apartado de Combo por 24 Horas:* *${comboTitle}* ⏱️\n\n`;
    selectedItems.forEach((p, idx) => {
      msg += `${idx + 1}️⃣ *${p.marca} - ${p.modelo}:* *$${parseFloat(p.precio_usd).toFixed(2)} USD* (Bs. ${formatBs(p.precio_usd * tasa)})\n`;
    });
    msg += `\n💵 *Total Combo:* *$${comboTotalUsd.toFixed(2)} USD* (Bs. ${formatBs(comboTotalUsd * tasa)})\n`;
    msg += `Te reservamos todos los repuestos del combo por 24 horas continuas para retirarlos en tienda física.\n\n`;
    msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
    return msg;
  }

  // 4. Si no se especificó producto en el texto actual, utilizar el último producto consultado
  let matchedProduct: any = null;
  if (session.ultimo_producto_id) {
    matchedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
  }

  if (!matchedProduct) {
    return `🛞🏍️ *Apartado sin costo por 24 Horas - Crastur* ⏱️\n\nCon gusto te apartamos tu repuesto o insumo para que lo retires en tienda o lo pidas por delivery en Caracas.\n\n¿Qué pieza o insumo deseas apartar? Escribe el nombre (por ejemplo: *"bujía bera"*, *"aceite 20w50"*, *"parches"* o *"combo de bujía y aceite"*):`;
  }

  const prodNombre = `${matchedProduct.marca} - ${matchedProduct.modelo}`;

  if (matchedProduct.stock !== null && matchedProduct.stock !== undefined && matchedProduct.stock <= 0) {
    return `⚠️ El repuesto *${prodNombre}* se encuentra actualmente *agotado* en nuestra tienda física.\n\n👉 Puedes escribir *VENDEDOR* para consultar con nuestro asesor la fecha de llegada del nuevo lote o escribir qué otro repuesto necesitas.`;
  }

  const prodPrecioUsd = parseFloat(matchedProduct.precio_usd) || 0;

  const metadata = {
    is_combo: false,
    producto_id: matchedProduct.id,
    producto_nombre: prodNombre,
    precio_usd: prodPrecioUsd,
    items: [{
      id: matchedProduct.id,
      nombre: prodNombre,
      precio_usd: prodPrecioUsd
    }]
  };

  db.prepare(`
    UPDATE chat_sessions
    SET step = 'apartado_pidiendo_nombre',
        ultimo_producto_id = ?,
        ultimo_producto_nombre = ?,
        apartado_metadata = ?
    WHERE jid = ?
  `).run(matchedProduct.id, prodNombre, JSON.stringify(metadata), jid);

  let msg = `🛞🏍️ *Apartado por 24 Horas:* *${prodNombre}* ⏱️\n\n`;
  msg += `💵 *Precio Contado:* *$${prodPrecioUsd.toFixed(2)} USD* (Bs. ${formatBs(prodPrecioUsd * tasa)})\n\n`;
  msg += `Te reservamos esta pieza sin costo adicional por 24 horas continuas para retirarla en tienda física o pedirla por delivery en Caracas.\n\n`;
  msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
  return msg;
}
