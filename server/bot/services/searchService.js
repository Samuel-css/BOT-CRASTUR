const { db } = require('../../database');
const { SYNONYMS } = require('../config/synonyms');
const { STOP_WORDS } = require('../config/stopWords');
const { normalizeText, isFuzzyMatch } = require('../utils/textUtils');

/**
 * Búsqueda difusa inteligente con tolerancia a errores ortográficos
 */
function searchProductsFuzzy(query) {
  const clean = normalizeText(query);
  let rawTokens = clean.split(/\s+/).filter(t => t.length > 1);

  if (rawTokens.length === 0) return [];

  // Reemplazar sinónimos conocidos
  let tokens = rawTokens.map(t => SYNONYMS[t] || t);

  // Filtrar stop words: si todas las palabras eran stop words, no es búsqueda de productos
  const meaningful = tokens.filter(t => !STOP_WORDS.has(t) && t.length >= 2);
  if (meaningful.length === 0) {
    return [];
  }
  tokens = meaningful;

  const allProducts = db.prepare('SELECT * FROM products WHERE activo = 1').all();

  const scored = allProducts.map(p => {
    const normModelo = normalizeText(p.modelo);
    const normMarca = normalizeText(p.marca);
    const normCat = normalizeText(p.categoria);
    const normDesc = normalizeText(p.descripcion || '');
    const modelWords = normModelo.split(' ');
    const brandWords = normMarca.split(' ');

    let score = 0;

    for (const token of tokens) {
      // Para tokens cortos (2 letras como 'v8', '15'), solo coincidir si es palabra completa
      if (token.length < 3) {
        if (modelWords.includes(token) || brandWords.includes(token)) score += 6;
        continue;
      }

      // 1. Coincidencia exacta
      if (normModelo.includes(token)) score += 8;
      else if (normMarca.includes(token)) score += 6;
      else if (normCat.includes(token)) score += 4;
      else if (normDesc.includes(token)) score += 2;
      else {
        // 2. Coincidencia difusa (Fuzzy)
        for (const mw of modelWords) {
          if (isFuzzyMatch(token, mw)) {
            score += 5;
            break;
          }
        }
        for (const bw of brandWords) {
          if (isFuzzyMatch(token, bw)) {
            score += 4;
            break;
          }
        }
      }
    }

    return { product: p, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(item => item.product);
}

/**
 * Detecta si el cliente está consultando múltiples productos a la vez (tipo Carrito/Combo)
 * Ej: "pastillas aveo y aceite 20w50", "bujias corolla, filtro de aire y aceite"
 */
function searchMultipleProducts(query) {
  if (!query) return [];

  // Separadores comunes en español
  const parts = query
    .split(/\s+y\s+|\s+con\s+|\s+mas\s+|\s*\+\s*|,\s*/)
    .map(p => p.trim())
    .filter(p => p.length >= 3);

  if (parts.length < 2) return [];

  const foundMap = new Map();

  for (const part of parts) {
    const results = searchProductsFuzzy(part);
    if (results.length > 0) {
      const best = results[0];
      if (!foundMap.has(best.id)) {
        foundMap.set(best.id, best);
      }
    }
  }

  const items = Array.from(foundMap.values());
  return items.length >= 2 ? items : [];
}

module.exports = {
  searchProductsFuzzy,
  searchMultipleProducts
};
