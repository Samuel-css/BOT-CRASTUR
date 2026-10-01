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

  // 1. Reemplazo de sinónimos conocidos
  let tokens = rawTokens.map(t => SYNONYMS[t] || t);

  // 2. Filtrado de stop-words, reteniendo términos automotrices breves de 2 caracteres
  const meaningful = tokens.filter(t => !STOP_WORDS.has(t) && t.length >= 2);
  if (meaningful.length === 0) return [];

  // 3. Detección de tipo de pieza específico (bujía, pastillas, aceite, etc.)
  const detectedProductTypes: string[] = [];
  for (const t of meaningful) {
    if (PRODUCT_TYPES.has(t)) {
      detectedProductTypes.push(t);
    } else {
      for (const pt of PRODUCT_TYPES) {
        if (isFuzzyMatch(t, pt)) {
          detectedProductTypes.push(pt);
          break;
        }
      }
    }
  }

  // Segmentar tokens específicos de calificadores genéricos ('moto', 'repuestos')
  const specificTokens = meaningful.filter(t => !QUALIFIERS.has(t));
  const qualifierTokens = meaningful.filter(t => QUALIFIERS.has(t));

  const allProducts: any[] = db.prepare('SELECT * FROM products WHERE activo = 1').all();

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
        return normModelo.includes(st) ||
               normMarca.includes(st) ||
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
      if (normModelo.includes(token)) score += 12;
      else if (normMarca.includes(token)) score += 8;
      else if (descWords.some(dw => dw === token || (token.length >= 4 && dw.startsWith(token)))) score += 5;
      else if (normCat.includes(token)) score += 6;
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
  const allProducts: any[] = db.prepare('SELECT * FROM products WHERE activo = 1').all();

  const scored = allProducts.map(p => {
    const normModelo = normalizeText(p.modelo);
    const normMarca = normalizeText(p.marca);
    const normCat = normalizeText(p.categoria);
    const normDesc = normalizeText(p.descripcion || '');

    let score = 0;

    if (normCat.includes(clean)) score += 10;
    else if (normModelo.includes(clean)) score += 8;
    else if (normDesc.includes(clean)) score += 4;
    else {
      const catWords = normCat.split(' ');
      for (const cw of catWords) {
        if (cw.length >= 3 && isFuzzyMatch(clean, cw)) { score += 6; break; }
      }
    }

    if (score === 0) return { product: p, score: 0 };

    for (const extra of extraTokens) {
      if (extra.length < 2) continue;
      if (normModelo.includes(extra)) score += 12;
      else if (normMarca.includes(extra)) score += 10;
      else if (normDesc.includes(extra)) score += 4;
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

  // Separadores conjuntivos en español
  const parts = query
    .split(/\s+y\s+|\s+con\s+|\s+mas\s+|\s*\+\s*|,\s*/i)
    .map(p => p.trim())
    .filter(p => p.length >= 2);

  if (parts.length < 2) return [];

  const foundMap = new Map();

  for (const part of parts) {
    // 1. Intento principal: búsqueda difusa normal
    const results = searchProductsFuzzy(part);
    if (results.length > 0) {
      const best = results[0];
      if (!foundMap.has(best.id)) {
        foundMap.set(best.id, best);
      }
      continue;
    }

    // 2. Intento de contingencia: búsqueda por categoría con tokens complementarios
    const cleanPart = normalizeText(part);
    const partTokens = cleanPart
      .split(/\s+/)
      .map(t => SYNONYMS[t] || t)
      .filter(t => t.length >= 2 && !STOP_WORDS.has(t));

    const typeToken = partTokens.find(t => PRODUCT_TYPES.has(t));

    if (typeToken) {
      const extraTokens = partTokens.filter(t => t !== typeToken && !QUALIFIERS.has(t));
      const fallback = searchByProductType(typeToken, extraTokens);
      if (fallback && !foundMap.has(fallback.id)) {
        foundMap.set(fallback.id, fallback);
      }
    }
  }

  const items = Array.from(foundMap.values());
  return items.length >= 2 ? items : [];
}

export {
  searchProductsFuzzy,
  searchMultipleProducts,
  searchByProductType
};

export default {
  searchProductsFuzzy,
  searchMultipleProducts,
  searchByProductType
};
