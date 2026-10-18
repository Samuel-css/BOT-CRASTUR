/**
 * @file searchService.ts
 * @description Motor de búsqueda difusa (Fuzzy Search) y carrito multi-producto para inventario automotriz.
 * 
 * [ARQUITECTURA DE BÚSQUEDA]
 * Combina un enfoque en etapas para garantizar máxima precisión sin falsos positivos:
 * 1. Normalización fonética y remoción de signos diacríticos.
 * 2. Expansión de sinónimos y modismos mecánicos venezolanos (ej. 'pastiya' -> 'pastillas').
 * 3. Filtrado de palabras vacías (stop-words), preservando tokens técnicos cortos (ej. '4t', '2t', 'gn', 'hj').
 * 4. Detección estricta de tipos de productos (PRODUCT_TYPES): si el cliente pide "aceite", se excluyen bujías o pastillas.
 * 5. Puntuación ponderada: Modelo (12 pts), Marca (8 pts), Descripción (5 pts), Categoría (6 pts) y Fuzzy Levenshtein.
 * 6. Umbral de relevancia dinámico (mínimo 5 puntos y al menos el 50% del mejor puntaje).
 * 7. Descomposición multi-producto para cotizaciones conjuntas ("pastillas aveo y aceite 20w50").
 */

import { db } from '../../database';
import { SYNONYMS } from '../config/synonyms';
import { STOP_WORDS } from '../config/stopWords';
import { PRODUCT_TYPES, QUALIFIERS } from '../config/productTypes';
import { normalizeText, isFuzzyMatch } from '../utils/textUtils';
import type { Product } from '../../types/database';

/**
 * Caché en memoria del catálogo activo para evitar leer toda la tabla en cada consulta.
 * Se invalida mediante `invalidateProductCache()` cada vez que cambian los productos.
 */
let productCache: any[] | null = null;
let productCacheAt = 0;
const PRODUCT_CACHE_TTL_MS = 30 * 1000; // 30 segundos de respaldo si no se invalida explícitamente

/** Fuerza la recarga del catálogo en la próxima búsqueda. */
function invalidateProductCache(): void {
  productCache = null;
  productCacheAt = 0;
}

/**
 * [PRECISIÓN] Comprueba si un token aparece en un texto.
 * Para tokens de 3+ letras se permite subcadena (ej. "past" en "pastillas").
 * Para tokens de 1-2 letras se exige PALABRA COMPLETA: así "hi" no coincide con
 * "hierro", "si" no coincide con "silicona" ni "pa" con "parche".
 */
function containsToken(haystack: string, token: string): boolean {
  if (!haystack || !token) return false;
  if (token.length >= 3) return haystack.includes(token);
  return haystack.split(/\s+/).includes(token);
}

/**
 * [PLURALES Y Ñ] Devuelve una forma singular aproximada del token.
 * No pretende ser lingüísticamente perfecto: solo resolver plurales comerciales
 * habituales ('filtros' -> 'filtro', 'zapatas' -> 'zapata', 'piñones' -> 'piñon').
 */
function singularizeToken(token: string): string {
  if (!token || token.length <= 3) return token;
  if (token.endsWith('ces') && token.length > 4) return token.slice(0, -3) + 'z'; // luces -> luz
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

/**
 * [DICCIONARIO] Traduce un token del cliente usando sinónimos y, si no hay coincidencia,
 * su forma singular. El diccionario ya está normalizado (sin tildes ni ñ), por lo que
 * 'piñones' -> 'pinones' -> 'pinon' y 'puño' -> 'puno' -> 'punos'.
 */
function mapToken(token: string): string {
  if (SYNONYMS[token]) return SYNONYMS[token];
  const singular = singularizeToken(token);
  if (SYNONYMS[singular]) return SYNONYMS[singular];
  return token;
}

/** Retorna el catálogo activo desde caché (o lo recarga si expiró). */
function getActiveProducts(): any[] {
  const now = Date.now();
  if (!productCache || (now - productCacheAt) > PRODUCT_CACHE_TTL_MS) {
    productCache = db.prepare('SELECT * FROM products WHERE activo = 1').all();
    productCacheAt = now;
  }
  return productCache;
}

/**
 * Ejecuta una búsqueda difusa inteligente sobre los productos activos del catálogo.
 * Tolera errores ortográficos y aplica coherencia estricta de tipo de pieza.
 * 
 * @param query - Consulta del cliente en lenguaje natural
 * @returns Array con hasta 4 productos más relevantes ordenados por puntaje
 */
function searchProductsFuzzy(query: string): any[] {
  const clean = normalizeText(query);
  let rawTokens = clean.split(/\s+/).filter(t => t.length >= 1);

  if (rawTokens.length === 0) return [];

  // 1. Reemplazo de sinónimos conocidos (incluye forma singular para plurales)
  let tokens = rawTokens.map(t => mapToken(t));

  // 2. Filtrado de stop-words, reteniendo términos automotrices breves de 2 caracteres
  const meaningful = tokens.filter(t => !STOP_WORDS.has(t) && t.length >= 2);
  if (meaningful.length === 0) return [];

  // 3. Detección de tipo de pieza específico (bujía, pastillas, aceite, etc.)
  const detectedProductTypes: string[] = [];
  for (const t of meaningful) {
    if (PRODUCT_TYPES.has(t)) {
      if (!detectedProductTypes.includes(t)) detectedProductTypes.push(t);
    } else {
      const singular = singularizeToken(t);
      if (PRODUCT_TYPES.has(singular)) {
        if (!detectedProductTypes.includes(singular)) detectedProductTypes.push(singular);
        continue;
      }
      for (const pt of PRODUCT_TYPES) {
        if (isFuzzyMatch(t, pt)) {
          if (!detectedProductTypes.includes(pt)) detectedProductTypes.push(pt);
          break;
        }
      }
    }
  }

  // Segmentar tokens específicos de calificadores genéricos ('moto', 'repuestos')
  const specificTokens = meaningful.filter(t => !QUALIFIERS.has(t));
  const qualifierTokens = meaningful.filter(t => QUALIFIERS.has(t));

  const allProducts: any[] = getActiveProducts();

  const scored = allProducts.map(p => {
    const normModelo = normalizeText(p.modelo);
    const normMarca = normalizeText(p.marca);
    const normCat = normalizeText(p.categoria);
    const normDesc = normalizeText(p.descripcion || '');
    const modelWords = normModelo.split(' ');
    const brandWords = normMarca.split(' ');

    // REGLA 1: Coherencia de tipo de producto
    if (detectedProductTypes.length > 0) {
      const matchesType = detectedProductTypes.some(pt => {
        return normModelo.includes(pt) ||
               normCat.includes(pt) ||
               normDesc.includes(pt) ||
               modelWords.some(mw => isFuzzyMatch(pt, mw));
      });
      if (!matchesType) return { product: p, score: 0 };
    }

    const descWords = normDesc.split(' ');

    // REGLA 2: Coincidencia con tokens específicos
    if (detectedProductTypes.length === 0 && specificTokens.length > 0) {
      const matchesSpecific = specificTokens.some(st => {
        return containsToken(normModelo, st) ||
               containsToken(normMarca, st) ||
               descWords.some(dw => dw === st || (st.length >= 4 && dw.startsWith(st))) ||
               modelWords.some(mw => isFuzzyMatch(st, mw)) ||
               brandWords.some(bw => isFuzzyMatch(st, bw));
      });
      if (!matchesSpecific) return { product: p, score: 0 };
    }

    let score = 0;
    const tokensToScore = specificTokens.length > 0 ? specificTokens : meaningful;

    for (const token of tokensToScore) {
      if (token.length < 2) continue;

      // Ponderaciones de coincidencia exacta
      if (containsToken(normModelo, token)) score += 12;
      else if (containsToken(normMarca, token)) score += 8;
      else if (descWords.some(dw => dw === token || (token.length >= 4 && dw.startsWith(token)))) score += 5;
      else if (containsToken(normCat, token)) score += 6;
      else {
        // Ponderaciones de coincidencia difusa (Levenshtein)
        for (const mw of modelWords) {
          if (mw.length >= 2 && isFuzzyMatch(token, mw)) { score += 7; break; }
        }
        for (const bw of brandWords) {
          if (bw.length >= 2 && isFuzzyMatch(token, bw)) { score += 5; break; }
        }
        const catWords = normCat.split(' ');
        for (const cw of catWords) {
          if (cw.length >= 3 && isFuzzyMatch(token, cw)) { score += 4; break; }
        }
      }
    }

    // Puntuación de contexto por calificadores (desempate)
    for (const qToken of qualifierTokens) {
      if (normCat.includes(qToken)) score += 2;
      else if (normDesc.includes(qToken)) score += 1;
      else if (normModelo.includes(qToken)) score += 1;
    }

    return { product: p, score };
  });

  const validScored = scored.filter(item => item.score >= 5);
  if (validScored.length === 0) return [];

  validScored.sort((a, b) => b.score - a.score);
  const maxScore = validScored[0].score;

  // Umbral dinámico adaptativo
  const threshold = Math.max(5, maxScore * 0.5);

  return validScored
    .filter(item => item.score >= threshold)
    .slice(0, 4)
    .map(item => item.product);
}

/**
 * Búsqueda asistida por categoría/tipo general cuando la consulta no detalla un modelo específico
 * (ej. "aceite", "caucho"). Admite tokens adicionales para desambiguar (marca, viscosidad).
 * 
 * @param typeToken - Tipo de producto normalizado
 * @param extraTokens - Términos complementarios opcionales (marca, modelo)
 * @returns El mejor producto representativo de esa categoría o null
 */
function searchByProductType(typeToken: string, extraTokens: string[] = []): any | null {
  const clean = normalizeText(typeToken);
  const allProducts: any[] = getActiveProducts();

  const scored = allProducts.map(p => {
    const normModelo = normalizeText(p.modelo);
    const normMarca = normalizeText(p.marca);
    const normCat = normalizeText(p.categoria);
    const normDesc = normalizeText(p.descripcion || '');

    let score = 0;

    if (containsToken(normCat, clean)) score += 10;
    else if (containsToken(normModelo, clean)) score += 8;
    else if (containsToken(normDesc, clean)) score += 4;
    else {
      const catWords = normCat.split(' ');
      for (const cw of catWords) {
        if (cw.length >= 3 && isFuzzyMatch(clean, cw)) { score += 6; break; }
      }
    }

    if (score === 0) return { product: p, score: 0 };

    for (const extra of extraTokens) {
      if (extra.length < 2) continue;
      if (containsToken(normModelo, extra)) score += 12;
      else if (containsToken(normMarca, extra)) score += 10;
      else if (containsToken(normDesc, extra)) score += 4;
      else {
        for (const mw of normModelo.split(' ')) {
          if (mw.length >= 2 && isFuzzyMatch(extra, mw)) { score += 7; break; }
        }
        for (const bw of normMarca.split(' ')) {
          if (bw.length >= 2 && isFuzzyMatch(extra, bw)) { score += 5; break; }
        }
      }
    }

    return { product: p, score };
  }).filter(i => i.score >= 4);

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].product;
}

/**
 * Descompone consultas multi-producto en sub-búsquedas independientes
 * (ej. "pastillas bera y aceite 20w50" o "bujía + cadena").
 * 
 * @param query - Consulta que agrupa múltiples artículos
 * @returns Array de productos únicos encontrados (mínimo 2 para activar modo combo)
 */
function searchMultipleProducts(query: string): any[] {
  if (!query) return [];

  // [CONSISTENCIA] Se divide el texto CRUDO por separadores explícitos (+, coma, y, con, más)
  // y LUEGO se normaliza cada parte. Es necesario dividir antes de normalizar porque
  // normalizeText elimina los símbolos "+" y "," (quedan como espacios) y se perderían.
  // Antes "bujía + kit de arrastre" no se descomponía y devolvía un solo producto.
  const rawParts = String(query)
    .split(/\s*\+\s*|[,;/]|\s+y\s+|\s+con\s+|\s+m[aá]s\s+/i)
    .map(p => normalizeText(p).trim())
    .filter(p => p.length >= 2);

  const parts = rawParts;

  if (parts.length < 2) return [];

  const foundMap = new Map();

  for (const part of parts) {
    // 1. Intento principal: búsqueda difusa normal
    const results = searchProductsFuzzy(part);
    if (results.length > 0) {
      const best = results[0];
      if (!foundMap.has(best.id)) {
        // [CANTIDAD] Se extrae el número que precede al producto ("4 aceites" -> cantidad 4).
        // Si no hay número, la cantidad por defecto es 1.
        const qty = extractLeadingQuantity(part);
        foundMap.set(best.id, qty > 1 ? { ...best, cantidad: qty } : best);
      }
      continue;
    }

    // 2. Intento de contingencia: búsqueda por categoría con tokens complementarios
    const cleanPart = normalizeText(part);
    const partTokens = cleanPart
      .split(/\s+/)
      .map(t => mapToken(t))
      .filter(t => t.length >= 2 && !STOP_WORDS.has(t));

    let typeToken: string | undefined;
    for (const tk of partTokens) {
      if (PRODUCT_TYPES.has(tk)) { typeToken = tk; break; }
      const singular = singularizeToken(tk);
      if (PRODUCT_TYPES.has(singular)) { typeToken = singular; break; }
    }

    if (typeToken) {
      const extraTokens = partTokens.filter(t => {
        const canonical = PRODUCT_TYPES.has(t) ? t : singularizeToken(t);
        return canonical !== typeToken && !QUALIFIERS.has(t);
      });
      const fallback = searchByProductType(typeToken, extraTokens);
      if (fallback && !foundMap.has(fallback.id)) {
        const qty = extractLeadingQuantity(part);
        foundMap.set(fallback.id, qty > 1 ? { ...fallback, cantidad: qty } : fallback);
      }
    }
  }

  const items = Array.from(foundMap.values());
  return items.length >= 2 ? items : [];
}

/**
 * Palabras que indican que el número siguiente es una MEDIDA y no una cantidad.
 * Ej.: "aro 18", "rin 17", "medida 18", "pulgadas 14".
 */
const MEASURE_WORDS = new Set([
  'aro', 'aros', 'rin', 'rines', 'medida', 'medidas', 'pulgada', 'pulgadas',
  'mm', 'cm', 'modelo', 'talla', 'numero', 'num', 'r'
]);

/** Verbos o expresiones que sí introducen una cantidad real. */
const QUANTITY_CUES = new Set([
  'quiero', 'quisiera', 'necesito', 'necesitaria', 'ocupo', 'dame', 'deme', 'dime',
  'mandame', 'enviame', 'llevo', 'llevar', 'apartame', 'reservame', 'agrega',
  'sumame', 'cuantas', 'cuantos', 'cuanta', 'cantidad', 'compro', 'busco',
  'tienen', 'tienes', 'vende', 'vendes'
]);

/** Unidades que confirman que el número es una cantidad. */
const UNIT_WORDS = new Set([
  'unidad', 'unidades', 'pieza', 'piezas', 'pote', 'potes', 'par', 'pares',
  'caja', 'cajas', 'juego', 'juegos'
]);

/**
 * Determina si el número en `tokens[index]` forma parte de una medida, talla o
 * viscosidad (18, 17, 14, 275-18, 170/70, 110/90-16, 20w50, r14, ...).
 * `normalizeText()` convierte guiones y barras en espacios, por eso también se
 * revisan los tokens vecinos.
 */
function looksLikeMeasurement(tokens: string[], index: number): boolean {
  const token = tokens[index] || '';
  const prev = tokens[index - 1] || '';
  const next = tokens[index + 1] || '';

  // Viscosidad compacta: 20w50, 10w40, 15w40
  if (/\d+w\d+/.test(token)) return true;
  // Radio compacto: r14, r17, r18
  if (/^r\d+$/.test(token)) return true;
  // Palabra de medida antes o después: aro 18, rin 17, 18 pulgadas
  if (MEASURE_WORDS.has(prev) || MEASURE_WORDS.has(next)) return true;
  // Viscosidad separada: "20 w 50"
  if (next === 'w') return true;
  // Medida compuesta separada por normalizeText: 275 18, 170 70, 110 90 16
  if (/^\d{2,3}$/.test(prev) && /^\d{1,2}$/.test(token)) return true;

  return false;
}

/**
 * Extrae la cantidad indicada por el cliente.
 * Soporta dígitos ("4 aceites", "2 bujías"), "x4"/"4x" y números escritos
 * ("cuatro aceites"), pero NUNCA confunde una medida con una cantidad.
 *
 * Reglas para aceptar un número como cantidad:
 *  1. Está al inicio del fragmento ("4 aceites").
 *  2. Lo precede un verbo de cantidad ("quiero 4", "dame 2").
 *  3. Lo sigue una unidad ("2 unidades", "3 piezas").
 * En cualquier otro caso se asume 1 unidad (ej. "tripas 18" = 1 tripa aro 18).
 *
 * @param part - Fragmento normalizado (ej. "quiero 4 aceites")
 * @returns Cantidad entre 1 y 99 (1 si no se indica)
 */
function extractLeadingQuantity(part: string): number {
  const wordNums: Record<string, number> = {
    un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
    siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12
  };

  // Cantidad explícita con "x": "x4 bujías", "4x parches".
  const explicit = part.match(/\bx\s*(\d{1,2})\b|\b(\d{1,2})\s*x\b/);
  if (explicit) {
    const n = parseInt(explicit[1] || explicit[2], 10);
    if (n >= 1 && n <= 99) return n;
  }

  const tokens = part.trim().split(/\s+/).filter(Boolean);

  // Números con dígitos: solo se aceptan con contexto de cantidad.
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!/^\d{1,2}$/.test(token)) continue;
    if (looksLikeMeasurement(tokens, i)) continue;

    const n = parseInt(token, 10);
    if (!Number.isFinite(n) || n < 1 || n > 99) continue;

    const prev = tokens[i - 1] || '';
    const next = tokens[i + 1] || '';
    const beforeIsFiller = tokens
      .slice(0, i)
      .every(t => STOP_WORDS.has(t) || QUANTITY_CUES.has(t));

    if (beforeIsFiller || QUANTITY_CUES.has(prev) || UNIT_WORDS.has(next)) {
      return n;
    }
  }

  // Números escritos en palabras ("cuatro aceites", "tres parches").
  for (const token of tokens) {
    if (wordNums[token]) return wordNums[token];
  }

  return 1;
}

export {
  searchProductsFuzzy,
  searchMultipleProducts,
  searchByProductType,
  extractLeadingQuantity,
  invalidateProductCache
};

export default {
  searchProductsFuzzy,
  searchMultipleProducts,
  searchByProductType,
  extractLeadingQuantity,
  invalidateProductCache
};
