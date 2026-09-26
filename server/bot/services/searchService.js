const { db } = require('../../database');
const { SYNONYMS } = require('../config/synonyms');
const { STOP_WORDS } = require('../config/stopWords');
const { PRODUCT_TYPES, QUALIFIERS } = require('../config/productTypes');
const { normalizeText, isFuzzyMatch } = require('../utils/textUtils');

/**
 * Búsqueda difusa inteligente con tolerancia a errores ortográficos
 * y estricta coherencia de producto (evita mezclar aceites con bujías o pastillas).
 */
function searchProductsFuzzy(query) {
  const clean = normalizeText(query);
  let rawTokens = clean.split(/\s+/).filter(t => t.length > 1);

  if (rawTokens.length === 0) return [];

  // 1. Reemplazar sinónimos conocidos
  let tokens = rawTokens.map(t => SYNONYMS[t] || t);

  // 2. Filtrar stop words: si todas las palabras eran stop words, no es búsqueda de productos
  const meaningful = tokens.filter(t => !STOP_WORDS.has(t) && t.length >= 2);
  if (meaningful.length === 0) {
    return [];
  }

  // 3. Detectar si el usuario consultó un tipo de producto específico (ej: aceite, bujía, pastillas)
  const detectedProductTypes = [];
  for (const t of meaningful) {
    if (PRODUCT_TYPES.has(t)) {
      detectedProductTypes.push(t);
    } else {
      // Chequear si es un error ortográfico de un tipo de producto conocido
      for (const pt of PRODUCT_TYPES) {
        if (isFuzzyMatch(t, pt)) {
          detectedProductTypes.push(pt);
          break;
        }
      }
    }
  }

  // Tokens específicos (excluye calificadores genéricos como 'moto' o 'repuestos')
  const specificTokens = meaningful.filter(t => !QUALIFIERS.has(t));
  const qualifierTokens = meaningful.filter(t => QUALIFIERS.has(t));

  const allProducts = db.prepare('SELECT * FROM products WHERE activo = 1').all();

  const scored = allProducts.map(p => {
    const normModelo = normalizeText(p.modelo);
    const normMarca = normalizeText(p.marca);
    const normCat = normalizeText(p.categoria);
    const normDesc = normalizeText(p.descripcion || '');
    const modelWords = normModelo.split(' ');
    const brandWords = normMarca.split(' ');

    // REGLA FUNDAMENTAL 1: Si el usuario especificó un tipo de producto (ej: "aceite"),
    // el producto OBLIGATORIAMENTE debe coincidir con ese tipo de producto.
    // (Jamás mostrar bujías o kit de arrastre si el cliente pidió aceite).
    if (detectedProductTypes.length > 0) {
      const matchesType = detectedProductTypes.some(pt => {
        return normModelo.includes(pt) || 
               normCat.includes(pt) || 
               normDesc.includes(pt) ||
               modelWords.some(mw => isFuzzyMatch(pt, mw));
      });
      if (!matchesType) {
        return { product: p, score: 0 };
      }
    }

    // REGLA FUNDAMENTAL 2: Si no hay tipo específico pero hay tokens específicos
    // (ej: marcas "motul", modelos "sbr", especificaciones "20w50", "428h"),
    // el producto debe coincidir con al menos un token específico.
    // Evita que un producto puntúe solo por tener la palabra "moto".
    if (detectedProductTypes.length === 0 && specificTokens.length > 0) {
      const matchesSpecific = specificTokens.some(st => {
        return normModelo.includes(st) || 
               normMarca.includes(st) || 
               normDesc.includes(st) ||
               modelWords.some(mw => isFuzzyMatch(st, mw)) ||
               brandWords.some(bw => isFuzzyMatch(st, bw));
      });
      if (!matchesSpecific) {
        return { product: p, score: 0 };
      }
    }

    let score = 0;

    // Puntuación por tokens específicos
    const tokensToScore = specificTokens.length > 0 ? specificTokens : meaningful;
    for (const token of tokensToScore) {
      if (token.length < 3) {
        if (modelWords.includes(token) || brandWords.includes(token)) score += 8;
        continue;
      }

      // 1. Coincidencia exacta
      if (normModelo.includes(token)) score += 12;
      else if (normMarca.includes(token)) score += 8;
      else if (normDesc.includes(token)) score += 4;
      else if (normCat.includes(token)) score += 3;
      else {
        // 2. Coincidencia difusa (Fuzzy)
        for (const mw of modelWords) {
          if (isFuzzyMatch(token, mw)) {
            score += 7;
            break;
          }
        }
        for (const bw of brandWords) {
          if (isFuzzyMatch(token, bw)) {
            score += 5;
            break;
          }
        }
      }
    }

    // Puntuación de contexto por calificadores (ej: "para moto" suma un pequeño desempate pero no califica por sí solo)
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

  // Umbral de relevancia: no mostrar productos con puntuación muy inferior al mejor match
  const threshold = Math.max(5, maxScore * 0.5);

  return validScored
    .filter(item => item.score >= threshold)
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
