/**
 * @file productMenu.ts
 * @description Secciones 29 a 35 del router: selección contextual, menú 1-6, Cashea,
 * ubicación, cómo comprar, búsqueda difusa, moto/cauchera y saludos.
 */

import type { RouterContext } from './context';
import { db, recordMetric } from '../../../database';
import { searchProductsFuzzy, searchMultipleProducts, extractLeadingQuantity } from '../../services/searchService';
import { KEYWORDS, includesAny, equalsAny, includesWordAny } from '../keywords';
import {
  handleProductResults,
  handleSingleProductDetail,
  handleMultiProductResults,
  handleContextualSelection
} from '../../handlers/productHandlers';
import { handleCasheaSmart } from '../../handlers/casheaHandlers';
import { handleSellersResponse } from '../../handlers/advisoryHandlers';
import { registerHandoff, getHandoffSlaMinutes } from '../../services/handoffService';
import { handleLocationResponse, handleHowToBuyResponse, handleCategoryBrowseResponse } from '../../handlers/infoHandlers';
import { handleMotoQueryResponse, handleCaucheraQueryResponse } from '../../handlers/infoHandlers';
import { handleGreetingResponse, handleShortGreeting } from '../../handlers/greetingHandlers';

export function runProductMenuSections(ctx: RouterContext): any | null {
  const { jid, text, norm, pushName, session, settings, tasa, productosDetectados } = ctx;
  // ============================================================================
  // [SECCIÓN 29] Selección Contextual de Productos Anteriores (Índice o Posición)
  // ============================================================================
  const contextResult = handleContextualSelection(norm, session, tasa, settings);
  if (contextResult) {
    return contextResult;
  }

  // ============================================================================
  // [SECCIÓN 30] Menú Principal y Categorías Canónicas (1 a 6)
  // ============================================================================
  // [ROBUSTEZ] La opción numérica del menú solo se acepta si el mensaje ORIGINAL es un
  // dígito simple (ej. "1"), para que entradas raras como "-1" o "1." no activen el menú
  // por accidente al normalizar (normalizeText convierte "-" en espacio y dejaría "1").
  const esNumeroMenuSeguro = /^\s*[1-6]\s*$/.test(text);

  // 1️⃣ Insumos Cauchera
  if (
    (esNumeroMenuSeguro && norm === '1') ||
    norm === '1️⃣' ||
    norm === 'opcion 1' ||
    norm === 'insumos cauchera' ||
    norm === 'insumos para cauchera' ||
    norm === 'insumos para caucheras' ||
    norm === 'cauchera' ||
    norm === 'caucheras'
  ) {
    recordMetric('categoria_insumos_cauchera', text, jid);
    return handleCategoryBrowseResponse('Insumos Cauchera', settings, tasa, session, jid);
  }

  // 2️⃣ Repuestos Moto
  if (
    (esNumeroMenuSeguro && norm === '2') ||
    norm === '2️⃣' ||
    norm === 'opcion 2' ||
    norm === 'repuestos moto' ||
    norm === 'repuestos para moto' ||
    norm === 'repuestos de moto' ||
    norm === 'repuesto moto' ||
    norm === 'repuesto de moto' ||
    norm === 'repuestos motos'
  ) {
    recordMetric('categoria_repuestos_moto', text, jid);
    return handleCategoryBrowseResponse('Repuestos Moto', settings, tasa, session, jid);
  }

  // 3️⃣ Accesorios Moto
  if (
    (esNumeroMenuSeguro && norm === '3') ||
    norm === '3️⃣' ||
    norm === 'opcion 3' ||
    norm === 'accesorios moto' ||
    norm === 'accesorios para moto' ||
    norm === 'accesorios de moto' ||
    norm === 'accesorio moto' ||
    norm === 'accesorios'
  ) {
    recordMetric('categoria_accesorios_moto', text, jid);
    return handleCategoryBrowseResponse('Accesorios Moto', settings, tasa, session, jid);
  }

  // 4️⃣ Otros Productos
  if (
    (esNumeroMenuSeguro && norm === '4') ||
    norm === '4️⃣' ||
    norm === 'opcion 4' ||
    norm === 'otros productos' ||
    norm === 'otros' ||
    norm === 'otro producto'
  ) {
    recordMetric('categoria_otros_productos', text, jid);
    return handleCategoryBrowseResponse('Otros Productos', settings, tasa, session, jid);
  }

  // 5️⃣ Cashea en Tienda
  if (
    (esNumeroMenuSeguro && norm === '5') ||
    norm === '5️⃣' ||
    norm === 'opcion 5'
  ) {
    recordMetric('menu_opcion_cashea', text, jid);
    return handleCasheaSmart(text, norm, settings, tasa, session);
  }

  // 6️⃣ Hablar con un Asesor / Vendedor
  const wantsHumanAgent =
    (esNumeroMenuSeguro && norm === '6') ||
    norm === '6️⃣' ||
    norm === 'opcion 6' ||
    norm === 'vendedor' ||
    norm === 'asesor' ||
    norm === 'humano' ||
    norm === 'hablar con alguien' ||
    norm === 'un asesor' ||
    norm === 'un vendedor' ||
    norm.includes('quiero hablar con') ||
    norm.includes('comunicarme con') ||
    norm.includes('hablar con un') ||
    norm.includes('hablar con el') ||
    norm.includes('atencion humana') ||
    norm.includes('persona de ventas') ||
    norm.includes('equipo de ventas') ||
    norm.includes('al mostrador') ||
    norm.includes('asesores') ||
    norm.includes('hablar con alguien') ||
    norm.includes('un humano') ||
    norm.includes('una humana') ||
    norm.includes('persona real') ||
    norm.includes('pasame con') ||
    norm.includes('paseme con') ||
    norm.includes('comunicame con') ||
    norm.includes('encargado') ||
    norm.includes('operador') ||
    norm.includes('un agente') ||
    norm.includes('agente de ventas') ||
    (norm.includes('vendedor') && !norm.includes('el vendedor me dijo') && !norm.includes('otro vendedor') && !norm.includes('su vendedor')) ||
    (norm.includes('asesor') && !norm.includes('mi asesor') && !norm.includes('asesor financiero') && !norm.includes('asesor de banco')) ||
    (norm.includes('contacto') && (norm.includes('tienda') || norm.includes('crastur') || norm.includes('ustedes') || norm === 'contacto')) ||
    (norm.includes('persona') && (norm.includes('hablar') || norm.includes('quiero') || norm.includes('atender') || norm.includes('atienda')));

  if (wantsHumanAgent) {
    recordMetric('consulta_vendedor', text, jid);
    // [HANDOFF CON SLA] Si el negocio configuró un plazo, se registra la solicitud,
    // se avisa al vendedor en el mismo chat y el bot se pausa solo en esta conversación.
    if (getHandoffSlaMinutes(settings) > 0) {
      const handoff = registerHandoff({ jid, pushName, session, settings, text });
      // [BYPASS] El bot queda pausado por el handoff, pero ESTE mensaje (la promesa al
      // cliente) debe salir igual. Se marca para que la verificación de última milla
      // no lo descarte.
      if (handoff.fueraHorario) return handoff.message;
      return { text: handoff.message, bypassPause: true } as any;
    }
    return handleSellersResponse(pushName);
  }

  // ============================================================================
  // [SECCIÓN 31] [MERCADO VENEZUELA] Financiamiento Cashea Inteligente
  // ============================================================================
  if (includesAny(norm, KEYWORDS.cashea)) {
    recordMetric('consulta_cashea', text, jid);
    return handleCasheaSmart(text, norm, settings, tasa, session);
  }

  // ============================================================================
  // [SECCIÓN 32] Ubicación Física y Google Maps
  // [PRIORIDAD DE PRODUCTO] "¿dónde está la bujía?" es una consulta de producto, no de
  // la tienda. La ubicación solo gana si no se identificó un producto o si el mensaje
  // habla explícitamente de la tienda/local/sucursal.
  // ============================================================================
  const storeLocationContext = includesAny(norm, [
    'tienda', 'local', 'negocio', 'ustedes', 'crastur', 'sucursal', 'direccion', 'retirar', 'mostrador', 'fisica'
  ]);
  const isLocationQuery =
    norm === 'donde' ||
    norm.startsWith('donde ') ||
    includesAny(norm, KEYWORDS.location) ||
    /\bdireccion(es)?\b/.test(norm) ||
    (norm.includes('tienda') && (norm.includes('donde') || norm.includes('como llego') || norm.includes('como queda') || norm.includes('fisica')));

  if (isLocationQuery && (productosDetectados.length === 0 || storeLocationContext)) {
    recordMetric('consulta_ubicacion', text, jid);
    return handleLocationResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 32b] Cómo Comprar / Hacer un Pedido (Guía para Clientes Nuevos)
  // [PRIORIDAD DE PRODUCTO] "quiero comprar una bujía" debe cotizar la bujía, no
  // mostrar la guía genérica. Solo se responde la guía si NO se detectó producto.
  // ============================================================================
  const productHintForHowToBuy = productosDetectados.length > 0 || searchMultipleProducts(text).length > 0;
  if (!productHintForHowToBuy && includesAny(norm, KEYWORDS.howToBuy)) {
    recordMetric('consulta_como_comprar', text, jid);
    return handleHowToBuyResponse(settings);
  }

  // ============================================================================
  // [SECCIÓN 33] Búsqueda Difusa en Catálogo (Fuzzy Search Levenshtein)
  // ============================================================================
  const productSearchResults = productosDetectados;
  if (productSearchResults.length > 0) {
    const firstProd = productSearchResults[0];
    recordMetric('busqueda_producto', `${firstProd.marca} ${firstProd.modelo}`, jid);

    // [ANTI-BANEO META 2025] Máximo 1 seguimiento proactivo por sesión: si ya se envió
    // un recordatorio previamente, no se re-arma (evita mensajes proactivos repetidos).
    const yaSeguido = session && (session.seguimiento_enviado === 1 || session.seguimiento_enviado === '1');

    // Preservar historial reciente de productos cotizados
    let prevHistory: any[] = [];
    try {
      prevHistory = JSON.parse(session?.contexto_productos || '[]');
      if (!Array.isArray(prevHistory)) prevHistory = [];
    } catch (e) {
      prevHistory = [];
    }

    // [CANTIDAD] Si el cliente pidió una cantidad ("quiero 4 aceites"), se propaga a cada
    // resultado para que, al elegir el número, el carrito respete esa cantidad.
    const qtySolicitada = extractLeadingQuantity(norm);
    const currentMatches = productSearchResults.map(p => ({
      id: p.id,
      marca: p.marca,
      modelo: p.modelo,
      precio_usd: p.precio_usd,
      categoria: p.categoria,
      ...(qtySolicitada > 1 ? { cantidad: qtySolicitada } : {})
    }));

    const combinedHistory = [...currentMatches];
    for (const h of prevHistory) {
      if (!combinedHistory.some(c => c.id === h.id)) {
        combinedHistory.push(h);
      }
    }
    const contextJson = JSON.stringify(combinedHistory.slice(0, 4));

    db.prepare(`
      UPDATE chat_sessions
      SET ultimo_producto_id = ?,
          ultimo_producto_nombre = ?,
          contexto_productos = ?,
          contexto_at = ?,
          seguimiento_enviado = ?
      WHERE jid = ?
    `).run(firstProd.id, `${firstProd.marca} ${firstProd.modelo}`, contextJson, Date.now(), yaSeguido ? 1 : 0, jid);

    if (productSearchResults.length === 1) {
      // [CANTIDAD] Si el cliente pide una cantidad mayor a 1 de un solo producto
      // ("4 aceites", "2 bujías"), se muestra el carrito con esa cantidad en vez de la ficha simple.
      const qty = extractLeadingQuantity(norm);
      if (qty > 1) {
        const conCantidad = [{ ...firstProd, cantidad: qty }];
        const contextQty = JSON.stringify([{
          id: firstProd.id, marca: firstProd.marca, modelo: firstProd.modelo,
          precio_usd: firstProd.precio_usd, categoria: firstProd.categoria, cantidad: qty
        }]);
        db.prepare(`
          UPDATE chat_sessions
          SET contexto_productos = ?, contexto_at = ?, ultimo_producto_id = ?, ultimo_producto_nombre = ?, seguimiento_enviado = 0
          WHERE jid = ?
        `).run(contextQty, Date.now(), firstProd.id, `${firstProd.marca} ${firstProd.modelo}`, jid);
        return handleMultiProductResults(conCantidad, tasa, settings, session, text);
      }
      return handleSingleProductDetail(firstProd, tasa, settings, session);
    }

    return handleProductResults(productSearchResults, tasa, settings, session);
  }

  // ============================================================================
  // [SECCIÓN 34] Consultas Genéricas de Moto o Cauchera sin Coincidencia
  // ============================================================================
  if (
    includesAny(norm, KEYWORDS.moto) ||
    equalsAny(norm, KEYWORDS.motoEquals)
  ) {
    recordMetric('consulta_motos', text, jid);
    return handleMotoQueryResponse();
  }

  if (includesAny(norm, KEYWORDS.cauchera)) {
    recordMetric('consulta_cauchera', text, jid);
    return handleCaucheraQueryResponse();
  }

  // ============================================================================
  // [SECCIÓN 35] Saludos y Menú Inicial
  // ============================================================================
  if (
    equalsAny(norm, KEYWORDS.greetingEquals) ||
    (norm.startsWith('hola ') && norm.length < 15 && !norm.includes('tienes') && !norm.includes('hay') && !norm.includes('precio') && !norm.includes('quiero') && !norm.includes('busco')) ||
    includesAny(norm, KEYWORDS.greetingParts) ||
    // [CLIENTE NUEVO] Preguntas de sondeo: "¿qué tienen?", "¿qué venden?", "¿qué manejan?".
    // Deben mostrar el menú de categorías, no un fallback genérico.
    norm.startsWith('que venden ') ||
    norm.startsWith('que tienen ')
  ) {
    recordMetric('saludo_menu', text, jid);

    // [SALUDAR UNA SOLA VEZ] Si el cliente ya recibió el menú hace poco y solo vuelve a
    // saludar, no le repetimos el menú completo: un saludo corto basta y se siente más
    // humano. Si vuelve después de 6 horas (u otro día), sí ve el menú otra vez.
    const esSaludoPuro = /^(hola|ola|buenas|buenos dias|buenas tardes|buenas noches|saludos|epale|que mas|que tal)(\s+\w+){0,2}$/.test(norm);
    const yaSaludo = parseInt(session?.saludo_enviado) === 1;
    const ultimaActividadPrevia = Number(session?.ultimo_mensaje_at || 0);
    const saludoReciente = yaSaludo && ultimaActividadPrevia > 0 && (Date.now() - ultimaActividadPrevia) < 6 * 60 * 60 * 1000;
    if (esSaludoPuro && saludoReciente) {
      recordMetric('saludo_repetido', text, jid);
      return handleShortGreeting(pushName);
    }

    if (jid) {
      try {
        db.prepare("UPDATE chat_sessions SET contexto_productos = NULL, contexto_at = NULL, step = 'start', saludo_enviado = 1 WHERE jid = ?").run(jid);
      } catch {}
    }
    return handleGreetingResponse(pushName, settings, tasa);
  }
  return null;
}
