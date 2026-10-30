/**
 * @file fuzzy.ts
 * @description Búsqueda difusa de productos: normalización de tokens, sinónimos,
 * coherencia de tipo y puntuación ponderada con Levenshtein.
 */

import { SYNONYMS } from '../../config/synonyms';
import { STOP_WORDS } from '../../config/stopWords';
import { PRODUCT_TYPES, QUALIFIERS } from '../../config/productTypes';
import { normalizeText, isFuzzyMatch } from '../../utils/textUtils';
import { getActiveProducts } from './cache';

export function containsToken(haystack: string, token: string): boolean {
  if (!haystack || !token) return false;
  if (token.length >= 3) return haystack.includes(token);
  return haystack.split(/\s+/).includes(token);
}

/**
 * [PLURALES Y Ñ] Devuelve una forma singular aproximada del token.
 * No pretende ser lingüísticamente perfecto: solo resolver plurales comerciales
 * habituales ('filtros' -> 'filtro', 'zapatas' -> 'zapata', 'piñones' -> 'piñon').
 */
export function singularizeToken(token: string): string {
  if (!token || token.length <= 3) return token;
  if (token.endsWith('ces') && token.length > 4) return token.slice(0, -3) + 'z'; // luces -> luz
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

/**
 * [FRASES DE VARIAS PALABRAS] El diccionario incluye expresiones como "parche frio",
 * "camara de aire" o "kit de arrastre". Antes se traducían token por token y esas claves
 * nunca coincidían. Aquí se reemplazan completas, de la frase más larga a la más corta,
 * antes de dividir en palabras.
 */
const SYNONYM_PHRASES: Array<[string, string]> = Object.entries(SYNONYMS)
  .filter(([key]) => key.includes(' '))
  .sort((a, b) => b[0].length - a[0].length);

export function applySynonymPhrases(normalizedText: string): string {
  if (!normalizedText || SYNONYM_PHRASES.length === 0) return normalizedText;
  let out = normalizedText;
  for (const [phrase, replacement] of SYNONYM_PHRASES) {
    if (!out.includes(phrase)) continue;
    out = out.split(phrase).join(` ${replacement} `);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * [DICCIONARIO] Traduce un token del cliente usando sinónimos y, si no hay coincidencia,
 * su forma singular. El diccionario ya está normalizado (sin tildes ni ñ), por lo que
 * 'piñones' -> 'pinones' -> 'pinon' y 'puño' -> 'puno' -> 'punos'.
 */
export function mapToken(token: string): string {
  if (SYNONYMS[token]) return SYNONYMS[token];
  const singular = singularizeToken(token);
  if (SYNONYMS[singular]) return SYNONYMS[singular];
  return token;
}

/** Retorna el catálogo activo desde caché (o lo recarga si expiró). */
export function searchProductsFuzzy(query: string): any[] {
  const clean = applySynonymPhrases(normalizeText(query));
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

    // REGLA 1: Coherencia de tipo de producto.
    // [PRECISIÓN] Aquí se exige coincidencia REAL (palabra, singular o prefijo), no fuzzy.
    // Con fuzzy, "caucho" coincidía con "casco" y se cotizaba un casco al pedir cauchos.
    if (detectedProductTypes.length > 0) {
      const matchesType = detectedProductTypes.some(pt => {
        const singularPt = singularizeToken(pt);
        return normModelo.includes(pt) ||
               normModelo.includes(singularPt) ||
               normCat.includes(pt) ||
               normCat.includes(singularPt) ||
               normDesc.includes(pt) ||
               normDesc.includes(singularPt) ||
               modelWords.some(mw =>
                 mw === pt ||
                 mw === singularPt ||
                 (pt.length >= 4 && mw.startsWith(pt)) ||
                 (mw.length >= 4 && pt.startsWith(mw))
               );
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
export function searchByProductType(typeToken: string, extraTokens: string[] = []): any | null {
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
