/**
 * @file contextSelection.ts
 * @description Módulo de productos extraído de productHandlers.ts.
 */

import { db } from '../../../database';
import { formatBs, formatRate } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { normalizeText } from '../../utils/textUtils';
import { resolveCasheaPlan } from '../../utils/cashea';
import { stockLabel } from '../../utils/stock';
import type { BotResponse } from '../../../types/bot';
import { handleSingleProductDetail } from './detail';
import { handleMultiProductResults } from './listing';
export function parseSelectionIndex(norm: string): number {
  const ordinales: Record<string, number> = {
    primero: 0, primera: 0, segundo: 1, segunda: 1, tercero: 2, tercera: 2,
    cuarto: 3, cuarta: 3, quinto: 4, quinta: 4, sexto: 5, sexta: 5
  };
  if (ordinales[norm] !== undefined) return ordinales[norm];

  const m = norm.match(/^(?:el|la)?\s*(?:opcion\s*)?([1-6])$/);
  if (m) return parseInt(m[1], 10) - 1;

  // Consultas de financiamiento sobre el primer producto mostrado.
  if (norm.includes('la inicial') || norm.includes('cuanto es la inicial') || norm.includes('las cuotas')) {
    return 0;
  }
  return -1;
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
export function handleContextualSelection(
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

  // [CONTEXTO CON VIGENCIA] Una lista cotizada hace horas (o ayer) no debe secuestrar
  // un "1" o un "2" que en realidad busca una categoría del menú. Pasado el TTL se
  // descarta el contexto y el mensaje sigue por el enrutador normal.
  const CONTEXT_TTL_MS = 45 * 60 * 1000;
  const contextAt = Number(session.contexto_at) || 0;
  if (contextAt > 0 && Date.now() - contextAt > CONTEXT_TTL_MS) {
    try {
      db.prepare('UPDATE chat_sessions SET contexto_productos = NULL, contexto_at = NULL WHERE jid = ?').run(session.jid);
    } catch {}
    return null;
  }

  // [MULETILLAS INICIALES] "y cuanto sale?", "bueno, el 2", "ok, cuanto?" deben
  // interpretarse igual que sin el conector inicial.
  const normLimpio = norm
    .replace(/^(y|e|ok|okey|bueno|entonces|listo|dale|oye|mira|verga|pana)\s+/, '')
    .trim();

  const selectedIndex = parseSelectionIndex(normLimpio);

  // [VENTA CRUZADA] Si el contexto es una sugerencia (producto base + complementos) y el
  // cliente responde con un número, se arma un pedido con su producto + el complemento elegido.
  const base = products.find((p: any) => p.es_base);
  if (base) {
    const sugeridos = products.filter((p: any) => p.es_sugerido);
    const selIdx = parseSelectionIndex(normLimpio);

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
          SET contexto_productos = ?, contexto_at = ?, ultimo_producto_id = ?, ultimo_producto_nombre = ?, seguimiento_enviado = 0
          WHERE jid = ?
        `).run(contextJson, Date.now(), fullBase.id, `${fullBase.marca} ${fullBase.modelo}`, session.jid);
        return `✅ ¡Excelente elección! Agregamos el complemento a tu pedido:\n\n` + handleMultiProductResults(nuevos, tasa, settings, session, '');
      }
    }

    // El cliente dice "no" (o nada útil) → continuar sin agregar complemento
    if (/^\s*no\b/.test(norm) || norm === 'no gracias' || norm === 'solo eso' || norm === 'nada mas') {
      const fullBase = db.prepare('SELECT * FROM products WHERE id = ?').get(base.id);
      try { db.prepare('UPDATE chat_sessions SET contexto_productos = NULL, contexto_at = NULL WHERE jid = ?').run(session.jid); } catch {}
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
        db.prepare('UPDATE chat_sessions SET contexto_productos = ?, contexto_at = ?, ultimo_producto_id = ? WHERE jid = ?')
          .run(contextQty, Date.now(), fullProd.id, session.jid);
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
        db.prepare('UPDATE chat_sessions SET contexto_productos = ?, contexto_at = ?, ultimo_producto_id = ? WHERE jid = ?')
          .run(contextJson, Date.now(), fullRestantes[0].id, session.jid);

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
        db.prepare('UPDATE chat_sessions SET contexto_productos = ?, contexto_at = ?, ultimo_producto_id = ? WHERE jid = ?')
          .run(contextJson, Date.now(), full.id, session.jid);
        const quitados2 = products.filter((_: any, i: number) => indicesAQuitar.has(i))
          .map((p: any) => `${p.marca} - ${p.modelo}`).join(', ');
        return `🗑️ *Quitamos de tu pedido:* ${quitados2}\n\nQueda solo este artículo:\n\n` + handleSingleProductDetail(full, tasa, settings, session);
      }

      // Si no queda ninguno, limpiar contexto
      db.prepare('UPDATE chat_sessions SET contexto_productos = NULL, contexto_at = NULL, ultimo_producto_id = NULL WHERE jid = ?').run(session.jid);
      return `🗑️ Listo, quité ese producto de tu pedido. ¿Qué repuesto deseas cotizar ahora? Escribe su nombre o *MENU* para ver las opciones.`;
    }
  }

  // [TOTAL DEL CONTEXTO] Si el cliente pregunta por el total/suma de lo que lleva en la
  // conversación ("cuanto es el total de los dos", "cuanto seria todo"), se consolidan
  // todos los productos del contexto reciente en una cotización de combo.
  const pideTotalContexto =
    (normLimpio.includes('total') || normLimpio.includes('todo') || normLimpio.includes('suma') || normLimpio.includes('los dos') || normLimpio.includes('ambos')) &&
    (normLimpio.includes('cuanto') || normLimpio.includes('cual') || normLimpio.includes('precio') || normLimpio.includes('sale') || normLimpio.includes('seria'));

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
  // ("tienes?", "si lo quiero", "cuanto?", "y cuanto sale", "me interesa") SIN nombrar un
  // producto, se asume que se refiere al último producto consultado y se le vuelve a mostrar
  // su ficha. Antes esto caía en el fallback genérico, rompiendo la conversación.
  const seguimientoExacto = new Set([
    'si lo quiero', 'lo quiero', 'me interesa', 'me interesa ese',
    'tienes', 'lo tienen', 'lo tienes', 'hay',
    'cuanto cuesta', 'cuanto sale', 'cuanto vale', 'cuanto', 'cuanto esta',
    'a como esta', 'a como lo tienen', 'a como sale', 'cuanto me sale', 'cuanto seria',
    'precio', 'el precio', 'y el precio', 'y cuanto', 'cuanto es el total', 'total', 'el total',
    'disponible', 'si esta disponible', 'lo puedo apartar'
  ]);
  const esSeguimiento = seguimientoExacto.has(normLimpio);

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
