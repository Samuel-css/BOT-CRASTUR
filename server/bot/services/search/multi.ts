/**
 * @file multi.ts
 * @description Descomposición de consultas con varios productos ("bujía y aceite").
 */

import { normalizeText } from '../../utils/textUtils';
import { STOP_WORDS } from '../../config/stopWords';
import { PRODUCT_TYPES, QUALIFIERS } from '../../config/productTypes';
import { searchProductsFuzzy, searchByProductType, mapToken, singularizeToken } from './fuzzy';
import { extractLeadingQuantity } from './quantity';

export function searchMultipleProducts(query: string): any[] {
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
