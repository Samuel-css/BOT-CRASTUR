/**
 * @file productHandlers.ts
 * @description Manejadores de respuestas de catálogo: ficha detallada de producto individual,
 * listado de resultados, selección contextual previa, combos de carrito y promociones de Instagram.
 */

import { db } from '../../database';
import { formatBs, formatRate } from '../utils/formatters';
import { detectCaracasZone } from '../utils/caracasDelivery';
import { normalizeText } from '../utils/textUtils';
import type { Product } from '../../types/database';
import type { BotResponse } from '../../types/bot';

/**
 * Genera la ficha detallada de un producto individual, incluyendo precio promocional en divisas,
 * equivalente en Bolívares (BCV), cuotas Cashea y venta cruzada inteligente.
 * 
 * @param p - Objeto producto de la base de datos
 * @param tasa - Tasa BCV oficial del día
 * @param settings - Configuración general
 * @param session - Sesión de chat actual
 * @returns Mensaje textual o respuesta estructurada con imagen
 */
function handleSingleProductDetail(
  p: any,
  tasa: number,
  settings: Record<string, string>,
  session: any
): BotResponse {
  const precioUsd = parseFloat(p.precio_usd);
  const precioBs = precioUsd * tasa;
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  // [CONSISTENCIA] Respeta el porcentaje configurado en el panel (cashea_inicial_pct),
  // no un 40% fijo, para que la ficha coincida con la configuración de la tienda.
  const inicialPct = (parseFloat(settings.cashea_inicial_pct || '40') || 40) / 100;
  const n1 = precioUsd * inicialPct;

  let msg = `🛞🏍️ *${p.marca} - ${p.modelo}*\n`;
  if (p.descripcion) {
    msg += `📝 ${p.descripcion}\n`;
  }
  msg += `💵 *Precio Promoción en Divisas:* *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance Pay 🪙)_\n`;
  msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  msg += `📦 *Disponibilidad:* ${p.stock > 0 ? '✅ Disponible para entrega inmediata' : '⚠️ Consultar stock'}\n\n`;

  // Esquema resumido de financiamiento Cashea
  if (precioUsd < 25) {
    msg += `💛 *Cashea en Tienda Física:* Disponible para compras a partir de *$25 USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((precioUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  }

  // [VENTA CRUZADA REAL] Se buscan productos COMPLEMENTARIOS del inventario según la
  // categoría/tipo del artículo visto, y se ofrecen para que el cliente elija.
  const sugeridos = buscarComplementarios(p);
  if (sugeridos.length > 0 && session) {
    msg += `💡 *${fraseComplemento(p)}:*\n`;
    sugeridos.forEach((s: any, i: number) => {
      const sPrec = parseFloat(s.precio_usd) || 0;
      msg += `   *${i + 1}.* ${s.marca} - ${s.modelo} — *$${sPrec.toFixed(2)} USD* (Bs. ${formatBs(sPrec * tasa)})\n`;
    });
    msg += `   👉 Responde con el *número* para agregarlo a tu pedido, o *NO* para continuar sin agregar.\n\n`;

    // Guardar los sugeridos en el contexto para que "1" los reconozca (handleContextualSelection).
    // Se marca `es_sugerido` y se incluye el producto base para que, al elegir un número,
    // el cliente termine con su producto + el complemento armado en el carrito.
    try {
      const contexto = [
        { id: p.id, marca: p.marca, modelo: p.modelo, precio_usd: p.precio_usd, categoria: p.categoria, es_base: true },
        ...sugeridos.map((s: any) => ({
          id: s.id, marca: s.marca, modelo: s.modelo, precio_usd: s.precio_usd, categoria: s.categoria, es_sugerido: true
        }))
      ];
      db.prepare('UPDATE chat_sessions SET contexto_productos = ? WHERE jid = ?').run(JSON.stringify(contexto), session.jid);
    } catch {}
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo 24h sin costo y retirar en tienda 🏢.\n`;
  msg += `👉 Escribe *DELIVERY* para cotizar envío en moto en Caracas 🛵.\n`;
  msg += `👉 Escribe *VENDEDOR* para hablar con un asesor humano 👨‍🔧.`;

  if (p.imagen_url && typeof p.imagen_url === 'string' && p.imagen_url.trim().length > 5) {
    return { text: msg, image: p.imagen_url.trim() } as any;
  }

  return msg;
}

/**
 * [VENTA CRUZADA] Devuelve el conjunto de palabras clave con las que un producto
 * "conversa" comercialmente (qué se vende junto a qué), y la frase de sugerencia.
 */
function reglasDeComplemento(p: any): { buscar: string[]; evitar: string[]; frase: string } | null {
  const cat = (p.categoria || '').toLowerCase();
  const mod = (p.modelo || '').toLowerCase();
  const esAceite = mod.includes('aceite') || cat.includes('lubricante') || cat.includes('aceite');
  const esBujia = mod.includes('bujia') || cat.includes('encendido');
  const esArrastre = mod.includes('arrastre') || mod.includes('cadena') || mod.includes('pinon') || mod.includes('corona') || mod.includes('kit de arrastre');
  const esFreno = mod.includes('pastilla') || mod.includes('freno') || mod.includes('banda') || mod.includes('balata');
  const esParche = mod.includes('parche') || mod.includes('pega') || mod.includes('mecha') || mod.includes('valvula') || cat.includes('cauchera');
  const esLLanta = mod.includes('caucho') || mod.includes('llanta') || mod.includes('tripa') || mod.includes('neumatico');

  if (esAceite) return { buscar: ['bujia', 'filtro', 'refrigerante'], evitar: ['aceite'], frase: 'Para el servicio completo, te puede servir' };
  if (esBujia) return { buscar: ['aceite', 'filtro', 'cadena'], evitar: ['bujia'], frase: 'Para completar el mantenimiento, te ofrecemos' };
  if (esArrastre) return { buscar: ['grasa', 'lubricante', 'spray', 'aceite', 'cadena'], evitar: ['arrastre'], frase: 'Para instalar tu kit de arrastre, te puede servir' };
  if (esFreno) return { buscar: ['liga', 'liquido', 'freno', 'dot'], evitar: ['pastilla', 'banda'], frase: 'Para el cambio de frenos, te puede servir' };
  if (esParche) return { buscar: ['parche', 'pega', 'valvula', 'mecha', 'terraja'], evitar: [], frase: 'Para el taller, no te puede faltar' };
  if (esLLanta) return { buscar: ['valvula', 'parche', 'pega', 'tripa'], evitar: [], frase: 'Para montarlo, te puede servir' };
  return null;
}

/**
 * [VENTA CRUZADA] Busca hasta 3 productos REALES del inventario que complementan al producto visto.
 * Excluye el propio producto y artículos sin stock. Nunca inventa productos que no existan.
 */
function buscarComplementarios(p: any): any[] {
  const regla = reglasDeComplemento(p);
  if (!regla) return [];

  try {
    const activos: any[] = db.prepare('SELECT * FROM products WHERE activo = 1 AND stock > 0').all();
    const encontrados: any[] = [];
    for (const prod of activos) {
      if (String(prod.id) === String(p.id)) continue;
      const etiqueta = normalizeText(`${prod.marca} ${prod.modelo} ${prod.categoria} ${prod.descripcion || ''}`);
      if (regla.evitar.some(ev => etiqueta.includes(ev))) continue;
      if (regla.buscar.some(b => etiqueta.includes(b))) {
        encontrados.push(prod);
        if (encontrados.length >= 3) break;
      }
    }
    return encontrados;
  } catch {
    return [];
  }
}

/** Frase de sugerencia de venta cruzada según el producto visto. */
function fraseComplemento(p: any): string {
  const regla = reglasDeComplemento(p);
  return regla ? regla.frase : 'También te puede interesar';
}

/**
 * Formatea un listado de múltiples productos coincidentes en la búsqueda difusa.
 * 
 * @param products - Lista de productos encontrados
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat actual
 * @returns Listado numerado con precios y opciones rápidas
 */
function handleProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any
): string {
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const inicialPct = parseFloat(settings.cashea_inicial_pct || '40') / 100;

  const nombreNegocio = settings.nombre_negocio || 'Crastur';
  let msg = `🛞🏍️ *${nombreNegocio}* 📦\n\n`;

  products.forEach((p: any, idx: number) => {
    const precioUsd = parseFloat(p.precio_usd);
    const precioBs = precioUsd * tasa;
    const inicialUsd = precioUsd * inicialPct;
    const cuotaUsd = (precioUsd - inicialUsd) / cuotasCashea;

    msg += `*${idx + 1}. ${p.marca} - ${p.modelo}* ⚙️\n`;
    if (p.descripcion) {
      msg += `   📝 ${p.descripcion}\n`;
    }
    msg += `   💵 Precio Promo Divisas: *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance)_\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n`;
    if (precioUsd < 25) {
      msg += `   💛 Cashea en Tienda: Disponible para compras a partir de $25 USD\n`;
    } else {
      msg += `   💛 Cashea en Tienda: Inicial *$${inicialUsd.toFixed(2)}* + ${cuotasCashea} cuotas de *$${cuotaUsd.toFixed(2)}*\n`;
    }
    msg += `   📦 Stock: ${p.stock > 0 ? '✅ En tienda' : '⚠️ Consultar'}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 *Opciones rápidas:*\n`;
  msg += `👉 Responde con el *número* (ej: *1*) para ver detalles y fotos.\n`;
  msg += `👉 Escribe *APARTAR* para reservarlo por 24 horas.\n`;
  msg += `👉 Escribe *VENDEDOR* para atención personalizada de un asesor.`;

  return msg;
}

/**
 * Resuelve la selección contextual por posición o mención de un producto mostrado previamente en pantalla
 * (ej. "el primero", "el 1", "el segundo", "la inicial").
 * 
 * @param norm - Texto normalizado
 * @param session - Sesión de chat actual
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @returns Detalle del producto seleccionado o null si no corresponde
 */
function handleContextualSelection(
  norm: string,
  session: any,
  tasa: number,
  settings: Record<string, string>
): BotResponse | null {
  if (!session || !session.contexto_productos) return null;

  let products: any[] = [];
  try {
    const parsed = JSON.parse(session.contexto_productos);
    if (!Array.isArray(parsed)) return null;
    products = parsed;
  } catch (e: any) {
    return null;
  }

  if (products.length === 0) return null;

  let selectedIndex = -1;

  if (norm === '1' || norm === 'el 1' || norm === 'el primero' || norm === 'la opcion 1' || norm === 'primero') {
    selectedIndex = 0;
  } else if (norm === '2' || norm === 'el 2' || norm === 'el segundo' || norm === 'la opcion 2' || norm === 'segundo') {
    selectedIndex = 1;
  } else if (norm === '3' || norm === 'el 3' || norm === 'el tercero' || norm === 'la opcion 3' || norm === 'tercero') {
    selectedIndex = 2;
  } else if (norm === '4' || norm === 'el 4' || norm === 'el cuarto' || norm === 'la opcion 4') {
    selectedIndex = 3;
  } else if (norm.includes('la inicial') || norm.includes('cuanto es la inicial') || norm.includes('las cuotas')) {
    selectedIndex = 0;
  }

  // [VENTA CRUZADA] Si el contexto es una sugerencia (producto base + complementos) y el
  // cliente responde con un número, se arma un pedido con su producto + el complemento elegido.
  const base = products.find((p: any) => p.es_base);
  if (base) {
    const sugeridos = products.filter((p: any) => p.es_sugerido);
    const selIdx = norm === '1' || norm === 'el 1' || norm === 'el primero' || norm === 'opcion 1' || norm === 'primero' ? 0
      : norm === '2' || norm === 'el 2' || norm === 'el segundo' || norm === 'opcion 2' || norm === 'segundo' ? 1
      : norm === '3' || norm === 'el 3' || norm === 'el tercero' || norm === 'opcion 3' || norm === 'tercero' ? 2
      : -1;

    if (selIdx >= 0 && selIdx < sugeridos.length) {
      const elegido = sugeridos[selIdx];
      const fullBase = db.prepare('SELECT * FROM products WHERE id = ?').get(base.id);
      const fullElegido = db.prepare('SELECT * FROM products WHERE id = ?').get(elegido.id);

      // Marca "NO" para rechazar la sugerencia
      if (fullBase && fullElegido) {
        const nuevos = [
          { id: fullBase.id, marca: fullBase.marca, modelo: fullBase.modelo, precio_usd: fullBase.precio_usd, categoria: fullBase.categoria, stock: fullBase.stock },
          { id: fullElegido.id, marca: fullElegido.marca, modelo: fullElegido.modelo, precio_usd: fullElegido.precio_usd, categoria: fullElegido.categoria, stock: fullElegido.stock }
        ];
        const contextJson = JSON.stringify(nuevos);
        db.prepare(`
          UPDATE chat_sessions
          SET contexto_productos = ?, ultimo_producto_id = ?, ultimo_producto_nombre = ?, seguimiento_enviado = 0
          WHERE jid = ?
        `).run(contextJson, fullBase.id, `${fullBase.marca} ${fullBase.modelo}`, session.jid);
        return `✅ ¡Excelente elección! Agregamos el complemento a tu pedido:\n\n` + handleMultiProductResults(nuevos, tasa, settings, session, '');
      }
    }

    // El cliente dice "no" (o nada útil) → continuar sin agregar complemento
    if (/^\s*no\b/.test(norm) || norm === 'no gracias' || norm === 'solo eso' || norm === 'nada mas') {
      const fullBase = db.prepare('SELECT * FROM products WHERE id = ?').get(base.id);
      try { db.prepare('UPDATE chat_sessions SET contexto_productos = NULL WHERE jid = ?').run(session.jid); } catch {}
      if (fullBase) return handleSingleProductDetail(fullBase, tasa, settings, session);
    }
  } else if (selectedIndex >= 0 && selectedIndex < products.length) {
    const p = products[selectedIndex];
    const fullProd = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
    if (fullProd) {
      // [CANTIDAD] Si el ítem elegido trae cantidad ("4 aceites" -> eligió el 1), armar el carrito.
      const qty = Math.max(1, Math.min(99, parseInt(p.cantidad, 10) || 1));
      if (qty > 1) {
        const conCantidad = [{ ...fullProd, cantidad: qty }];
        const contextQty = JSON.stringify([{
          id: fullProd.id, marca: fullProd.marca, modelo: fullProd.modelo,
          precio_usd: fullProd.precio_usd, categoria: fullProd.categoria, cantidad: qty
        }]);
        db.prepare('UPDATE chat_sessions SET contexto_productos = ?, ultimo_producto_id = ? WHERE jid = ?')
          .run(contextQty, fullProd.id, session.jid);
        return handleMultiProductResults(conCantidad, tasa, settings, session, '');
      }
      return handleSingleProductDetail(fullProd, tasa, settings, session);
    }
  }

  // [QUITAR DEL COMBO] El cliente puede pedir quitar uno o varios productos del combo que
  // ya se le cotizó ("quita el aceite", "elimina el 2", "sin las pastillas", "saca bujia y aceite").
  // Se identifica por nombre (búsqueda difusa) o por número de posición, se elimina del contexto
  // y se vuelve a cotizar el combo restante.
  const pideQuitar =
    norm.includes('quita') || norm.includes('quitame') || norm.includes('quitar') ||
    norm.includes('elimina') || norm.includes('eliminar') || norm.includes('remueve') ||
    norm.includes('remover') || norm.includes('saca') || norm.includes('sacar') ||
    norm.includes('sin el ') || norm.includes('sin la ') || norm.includes('sin los ') ||
    norm.includes('sin las ') || norm.startsWith('sin ') || norm.includes('no quiero el ') ||
    norm.includes('no quiero la ') || norm.includes('no quiero los ') || norm.includes('no quiero las ') ||
    norm.includes('borra') || norm.includes('borrar');

  if (pideQuitar && products.length >= 1) {
    // 1. Determinar qué ítems quitar por NÚMERO de posición (ej. "quita el 2", "elimina el 1 y 3")
    const numsEnTexto = (norm.match(/\b[1-9]\b/g) || []).map(Number).filter(n => n >= 1 && n <= products.length);
    let indicesAQuitar = new Set<number>(numsEnTexto.map(n => n - 1));

    // 2. Si no hay números, se interpreta por POSICIONES ORDINALES ("el primero", "el segundo"...)
    if (indicesAQuitar.size === 0) {
      const ordinales: Array<[RegExp, number]> = [
        [/\bprimer(o|a)\b/, 0], [/\bsegund(o|a)\b/, 1], [/\btercer(o|a)\b/, 2],
        [/\bcuart(o|a)\b/, 3], [/\bquint(o|a)\b/, 4]
      ];
      for (const [re, idx] of ordinales) {
        if (re.test(norm) && idx < products.length) indicesAQuitar.add(idx);
      }
    }

    // 3. Si aún no hay nada, se busca por NOMBRE usando búsqueda difusa en cada ítem del contexto
    if (indicesAQuitar.size === 0) {
      for (let i = 0; i < products.length; i++) {
        const p: any = products[i];
        const etiqueta = normalizeText(`${p.marca} ${p.modelo}`);
        // Tokens significativos del nombre del producto (>= 4 letras), buscados en el texto
        const tokens = etiqueta.split(/\s+/).filter((w: string) => w.length >= 4);
        if (tokens.some((w: string) => norm.includes(w))) {
          indicesAQuitar.add(i);
        }
      }
    }

    // 4. "quita todo" / "sin todo": marcar todos, y la lógica de abajo conservará al menos uno.
    if (indicesAQuitar.size === 0 && (norm.includes('todo') || norm.includes('todos') || norm.includes('todo el combo') || norm.includes('todos los productos'))) {
      for (let i = 0; i < products.length; i++) indicesAQuitar.add(i);
    }

    if (indicesAQuitar.size > 0) {
      // Nunca eliminar todos: si el cliente intenta quitar todo, se conserva el primero.
      if (indicesAQuitar.size >= products.length && products.length > 1) {
        const primero = indicesAQuitar.has(0) ? 0 : Math.min(...indicesAQuitar);
        indicesAQuitar = new Set([...indicesAQuitar].filter(i => i !== primero));
      }

      const restantes = products.filter((_: any, i: number) => !indicesAQuitar.has(i));

      if (restantes.length >= 2) {
        // Recargar los productos completos y reemitir la cotización actualizada
        const fullRestantes = restantes
          .map((p: any) => db.prepare('SELECT * FROM products WHERE id = ?').get(p.id))
          .filter(Boolean);
        const contextJson = JSON.stringify(fullRestantes.map((p: any) => ({
          id: p.id, marca: p.marca, modelo: p.modelo, precio_usd: p.precio_usd, categoria: p.categoria
        })));
        db.prepare('UPDATE chat_sessions SET contexto_productos = ?, ultimo_producto_id = ? WHERE jid = ?')
          .run(contextJson, fullRestantes[0].id, session.jid);

        const quitados = products.filter((_: any, i: number) => indicesAQuitar.has(i))
          .map((p: any) => `${p.marca} - ${p.modelo}`).join(', ');
        const preview = `🗑️ *Quitamos de tu pedido:* ${quitados}\n\n`;
        return preview + handleMultiProductResults(fullRestantes, tasa, settings, session, '');
      }

      if (restantes.length === 1) {
        const full = db.prepare('SELECT * FROM products WHERE id = ?').get(restantes[0].id);
        const contextJson = JSON.stringify([{
          id: full.id, marca: full.marca, modelo: full.modelo, precio_usd: full.precio_usd, categoria: full.categoria
        }]);
        db.prepare('UPDATE chat_sessions SET contexto_productos = ?, ultimo_producto_id = ? WHERE jid = ?')
          .run(contextJson, full.id, session.jid);
        const quitados2 = products.filter((_: any, i: number) => indicesAQuitar.has(i))
          .map((p: any) => `${p.marca} - ${p.modelo}`).join(', ');
        return `🗑️ *Quitamos de tu pedido:* ${quitados2}\n\nQueda solo este artículo:\n\n` + handleSingleProductDetail(full, tasa, settings, session);
      }

      // Si no queda ninguno, limpiar contexto
      db.prepare('UPDATE chat_sessions SET contexto_productos = NULL, ultimo_producto_id = NULL WHERE jid = ?').run(session.jid);
      return `🗑️ Listo, quité ese producto de tu pedido. ¿Qué repuesto deseas cotizar ahora? Escribe su nombre o *MENU* para ver las opciones.`;
    }
  }

  // [TOTAL DEL CONTEXTO] Si el cliente pregunta por el total/suma de lo que lleva en la
  // conversación ("cuanto es el total de los dos", "cuanto seria todo"), se consolidan
  // todos los productos del contexto reciente en una cotización de combo.
  const pideTotalContexto =
    (norm.includes('total') || norm.includes('todo') || norm.includes('suma') || norm.includes('los dos') || norm.includes('ambos')) &&
    (norm.includes('cuanto') || norm.includes('cual') || norm.includes('precio') || norm.includes('sale') || norm.includes('seria'));

  if (pideTotalContexto && products.length >= 1) {
    const fullProducts = products
      .slice(0, 4)
      .map(p => db.prepare('SELECT * FROM products WHERE id = ?').get(p.id))
      .filter(Boolean);
    if (fullProducts.length >= 2) {
      return handleMultiProductResults(fullProducts, tasa, settings, session, '');
    }
    // Con un solo producto en contexto, mostrar su ficha (evita el fallback genérico).
    if (fullProducts.length === 1) {
      return handleSingleProductDetail(fullProducts[0], tasa, settings, session);
    }
  }

  // [SEGUIMIENTO CONVERSACIONAL] Si el cliente responde con una frase corta de continuación
  // ("tienes?", "si lo quiero", "cuanto cuesta", "me interesa") SIN nombrar un producto,
  // se asume que se refiere al último producto consultado y se le vuelve a mostrar su ficha.
  // Antes esto caía en el fallback genérico ("no logré ubicar el producto"), rompiendo la conversación.
  const esSeguimiento =
    norm === 'si lo quiero' ||
    norm === 'lo quiero' ||
    norm === 'me interesa' ||
    norm === 'me interesa ese' ||
    norm === 'tienes' ||
    norm === 'tienes?' ||
    norm === 'lo tienen' ||
    norm === 'lo tienes' ||
    norm === 'hay' ||
    norm === 'hay?' ||
    norm === 'cuanto cuesta' ||
    norm === 'cuanto sale' ||
    norm === 'cuanto vale' ||
    norm === 'precio' ||
    norm === 'y el precio' ||
    norm === 'y cuanto' ||
    norm === 'disponible' ||
    norm === 'si esta disponible' ||
    norm === 'lo puedo apartar';

  if (esSeguimiento) {
    // Se prioriza el último producto exacto consultado; si no, el primero del contexto.
    let target: any = null;
    if (session.ultimo_producto_id) {
      target = db.prepare('SELECT * FROM products WHERE id = ?').get(session.ultimo_producto_id);
    }
    if (!target) {
      target = db.prepare('SELECT * FROM products WHERE id = ?').get(products[0].id);
    }
    if (target) {
      return handleSingleProductDetail(target, tasa, settings, session);
    }
  }

  return null;
}

/**
 * Genera la cotización consolidada para múltiples repuestos solicitados simultáneamente (Carrito/Combo).
 * 
 * @param products - Array de productos que componen el carrito
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat
 * @param text - Texto original para detección de zona de delivery
 * @returns Resumen consolidado con subtotales, total general y cuotas Cashea
 */
function handleMultiProductResults(
  products: any[],
  tasa: number,
  settings: Record<string, string>,
  session: any,
  text: string = ''
): string {
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  // [CONSISTENCIA] Porcentaje de inicial configurable desde el panel.
  const inicialPct = (parseFloat(settings.cashea_inicial_pct || '40') || 40) / 100;
  // [CANTIDAD] Cada artículo puede llevar una cantidad (ej. "4 aceites" -> cantidad 4).
  const qtyOf = (p: any) => Math.max(1, Math.min(99, parseInt(p.cantidad, 10) || 1));
  const totalUsd = products.reduce((sum: number, p: any) => sum + (parseFloat(p.precio_usd) || 0) * qtyOf(p), 0);
  const totalBs = totalUsd * tasa;
  const totalUnidades = products.reduce((sum: number, p: any) => sum + qtyOf(p), 0);

  let msg = `🛒 *Cotización de Combo / Carrito - Crastur* 🛞🏍️✨\n\n`;
  msg += `Has seleccionado *${products.length} artículo(s)* — *${totalUnidades} unidad(es)*:\n\n`;

  products.forEach((p: any, idx: number) => {
    const precioUsd = parseFloat(p.precio_usd) || 0;
    const qty = qtyOf(p);
    const subtotal = precioUsd * qty;
    const precioBs = subtotal * tasa;
    msg += `${idx + 1}️⃣ *${p.marca} - ${p.modelo}*\n`;
    if (qty > 1) {
      msg += `   🔢 Cantidad: *${qty}* × $${precioUsd.toFixed(2)}\n`;
    }
    msg += `   💵 Subtotal: *$${subtotal.toFixed(2)} USD* (Bs. ${formatBs(precioBs)})\n`;
    if (qty > 1 && p.stock > 0 && qty > p.stock) {
      msg += `   ⚠️ Solo hay *${p.stock}* en tienda — el resto se confirma al retirar.\n`;
    } else {
      msg += `   📦 Stock: ${p.stock > 0 ? '✅ Disponible en tienda' : '⚠️ Consultar'}\n`;
    }
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 *Resumen Total del Pedido:*\n`;
  msg += `💵 *Total a Pagar:* *$${totalUsd.toFixed(2)} USD*\n`;
  msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(totalBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
  msg += `🔥 *¡Precio Promoción en Divisas!* Aplica pagando en Efectivo ($) o Binance Pay (USDT) 🪙🏷️\n\n`;

  if (totalUsd >= 25) {
    const n1 = totalUsd * inicialPct;
    msg += `💛 *Cashea en Tienda Física:* Inicial desde *$${n1.toFixed(2)} USD* (Bs. ${formatBs(n1 * tasa)}) y ${cuotasCashea} cuotas quincenales de *$${((totalUsd - n1) / cuotasCashea).toFixed(2)} USD*.\n\n`;
  } else {
    msg += `💛 *Cashea en Tienda Física:* Disponible para compras a partir de *$25 USD*.\n\n`;
  }

  const detectedZone = text ? detectCaracasZone(text, settings) : null;
  if (detectedZone) {
    msg += `🛵 *Delivery estimado a ${detectedZone.nombre}:* *${detectedZone.tarifa}* (motorizado hoy mismo).\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe *APARTAR* para reservar este combo por 24 horas y retirarlo en tienda.\n`;
  msg += `👉 Escribe *DELIVERY* para solicitar envío en moto a tu zona en Caracas 🛵.\n`;
  msg += `👉 ¿Quieres cambiar algo? Escribe *ej: quita el aceite* o *quita el 2* para eliminar un artículo.\n`;
  msg += `👉 Escribe *VENDEDOR* para coordinar con un asesor de ventas.`;

  return msg;
}

/**
 * Atiende consultas sobre combos, promociones y kits promocionados en redes sociales (Instagram).
 * 
 * @param text - Texto de la consulta
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat
 * @param jid - JID destinatario
 * @returns Listado de combos vigentes o detalle individual
 */
function handleInstagramCombosResponse(
  text: string,
  tasa: number,
  settings: Record<string, string>,
  session: any,
  jid?: string
): BotResponse {
  const combos: any[] = db.prepare(`
    SELECT * FROM products 
    WHERE activo = 1 
      AND (categoria LIKE '%Combo%' OR categoria LIKE '%Kit%' OR modelo LIKE '%Combo%' OR modelo LIKE '%Kit%' OR descripcion LIKE '%combo%' OR descripcion LIKE '%kit%')
    ORDER BY id DESC
    LIMIT 6
  `).all();

  const nombreNegocio = settings.nombre_negocio || 'Crastur';

  if (!combos || combos.length === 0) {
    let msg = `🔥 *Combos & Promociones de Instagram - ${nombreNegocio}* 🛞🏍️📸\n\n`;
    msg += `¡Hola! Con gusto te atendemos con nuestras promociones publicadas en Instagram.\n\n`;
    msg += `📦 Armamos combos semanales para caucheras, talleres y cambios de aceite con **Precio Promoción en Divisas** (Efectivo / Binance Pay) y financiamiento Cashea.\n\n`;
    msg += `👉 ¿Qué repuesto, aceite o insumo viste en nuestras redes? Escríbenos o escribe *VENDEDOR* para darte el precio exacto del combo publicado.`;
    return msg;
  }

  if (combos.length === 1) {
    const c = combos[0];
    const precioUsd = parseFloat(c.precio_usd);
    const precioBs = precioUsd * tasa;
    let msg = `🔥 *Combo Promocional Oficial - ${c.marca} ${c.modelo}* 🛞📸\n\n`;
    if (c.descripcion) {
      msg += `📝 *Incluye:*\n${c.descripcion}\n\n`;
    }
    msg += `💵 *Precio Promoción en Divisas:* *$${precioUsd.toFixed(2)} USD* _(Efectivo / Binance Pay 🪙)_\n`;
    msg += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* _(Tasa oficial BCV: ${formatRate(tasa)})_\n`;
    if (precioUsd >= 25) {
      msg += `💛 *Cashea en Tienda Física:* Disponible en cuotas quincenales sin interés.\n`;
    }
    msg += `📦 *Disponibilidad:* ${c.stock > 0 ? '✅ Disponible para entrega hoy' : '⚠️ Consultar stock'}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👉 Escribe *APARTAR* para reservarlo 24h sin costo y retirar en tienda física.\n`;
    msg += `👉 Escribe *DELIVERY* para cotizar envío en moto a tu ubicación en Caracas.\n`;
    msg += `👉 Escribe *VENDEDOR* para hablar con nuestro asesor.`;

    if (c.imagen_url && typeof c.imagen_url === 'string' && c.imagen_url.trim().length > 5) {
      return { text: msg, image: c.imagen_url.trim() } as any;
    }
    return msg;
  }

  let msg = `🔥 *Combos & Kits Oficiales de Instagram - ${nombreNegocio}* 🛞📸\n\n`;
  msg += `Aquí tienes los combos vigentes publicados en nuestras redes sociales:\n\n`;

  combos.forEach((c: any, idx: number) => {
    const precioUsd = parseFloat(c.precio_usd);
    const precioBs = precioUsd * tasa;
    msg += `*${idx + 1}️⃣ ${c.marca} - ${c.modelo}*\n`;
    if (c.descripcion) {
      msg += `   📝 ${c.descripcion}\n`;
    }
    msg += `   💵 Precio Promo: *$${precioUsd.toFixed(2)} USD* (Efectivo / Binance 🪙)\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Escribe el *número del combo* (ej: *1*) para ver detalles y apartarlo.\n`;
  msg += `👉 Escribe *VENDEDOR* para armar un combo personalizado a tu medida.`;

  // [COHERENCIA] Guardar el contexto de los combos listados para que, si el cliente responde
  // con un número (ej. "1"), el bot muestre el detalle de ESE combo y no el menú de categorías.
  // Antes el mensaje prometía "responde 1 para ver detalles" pero el número abría el catálogo.
  if (jid && combos.length >= 2) {
    try {
      const contextJson = JSON.stringify(combos.slice(0, 5).map((c: any) => ({
        id: c.id, marca: c.marca, modelo: c.modelo, precio_usd: c.precio_usd, categoria: c.categoria
      })));
      db.prepare(`
        UPDATE chat_sessions
        SET contexto_productos = ?, ultimo_producto_id = ?, ultimo_producto_nombre = ?, seguimiento_enviado = 0
        WHERE jid = ?
      `).run(contextJson, combos[0].id, `${combos[0].marca} ${combos[0].modelo}`, jid);
    } catch {}
  }

  return msg;
}

export {
  handleSingleProductDetail,
  handleProductResults,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
};

export default {
  handleSingleProductDetail,
  handleProductResults,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
};
