const { db } = require('../../database');
const { SYNONYMS } = require('../config/synonyms');
const { STOP_WORDS } = require('../config/stopWords');
const { PRODUCT_TYPES, QUALIFIERS } = require('../config/productTypes');
const { normalizeText, isFuzzyMatch } = require('../utils/textUtils');

/**
 * Búsqueda difusa inteligente con tolerancia a errores ortográficos
 * y estricta coherencia de producto (evita mezclar aceites con bujías o pastillas).
 *
 * FIXES aplicados:
 * - Categoría ahora puntúa 6 (antes 3) para superar el umbral mínimo de 5
 * - Tokens de 2 letras (4t, 2t, gn, hj) puntúan correctamente en fuzzy
 * - Umbral dinámico ajustado para no descartar products válidos de baja especificidad
 */
function searchProductsFuzzy(query) {
  const clean = normalizeText(query);
  // FIX: filtrar tokens de longitud >= 1 (antes > 1, perdía tokens de 2 chars como "4t")
  let rawTokens = clean.split(/\s+/).filter(t => t.length >= 1);

  if (rawTokens.length === 0) return [];

  // 1. Reemplazar sinónimos conocidos
  let tokens = rawTokens.map(t => SYNONYMS[t] || t);

  // 2. Filtrar stop words: si todas las palabras eran stop words, no es búsqueda de productos
  // FIX: mantener tokens cortos significativos (4t, 2t, rx, gn) aunque tengan 2 chars
  const meaningful = tokens.filter(t => !STOP_WORDS.has(t) && t.length >= 2);
  if (meaningful.length === 0) return [];

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
    if (detectedProductTypes.length > 0) {
      const matchesType = detectedProductTypes.some(pt => {
        return normModelo.includes(pt) ||
               normCat.includes(pt) ||
               normDesc.includes(pt) ||
               modelWords.some(mw => isFuzzyMatch(pt, mw));
      });
      if (!matchesType) return { product: p, score: 0 };
    }

    // REGLA FUNDAMENTAL 2: Si no hay tipo específico pero hay tokens específicos,
    // el producto debe coincidir con al menos uno.
    if (detectedProductTypes.length === 0 && specificTokens.length > 0) {
      const matchesSpecific = specificTokens.some(st => {
        return normModelo.includes(st) ||
               normMarca.includes(st) ||
               normDesc.includes(st) ||
               modelWords.some(mw => isFuzzyMatch(st, mw)) ||
               brandWords.some(bw => isFuzzyMatch(st, bw));
      });
      if (!matchesSpecific) return { product: p, score: 0 };
    }

    let score = 0;
    const tokensToScore = specificTokens.length > 0 ? specificTokens : meaningful;

    for (const token of tokensToScore) {
      // FIX: tokens de 2 chars (4t, gn, hj, rx) también pueden hacer fuzzy match
      if (token.length < 2) continue;

      // Coincidencia exacta en modelo/marca/desc/cat
      if (normModelo.includes(token)) score += 12;
      else if (normMarca.includes(token)) score += 8;
      else if (normDesc.includes(token)) score += 5;
      // FIX: categoría ahora puntúa 6 en vez de 3 — permite superar umbral mínimo de 5
      else if (normCat.includes(token)) score += 6;
      else {
        // Coincidencia difusa (Fuzzy) en palabras del modelo
        for (const mw of modelWords) {
          if (mw.length >= 2 && isFuzzyMatch(token, mw)) { score += 7; break; }
        }
        // Fuzzy en marca
        for (const bw of brandWords) {
          if (bw.length >= 2 && isFuzzyMatch(token, bw)) { score += 5; break; }
        }
        // FIX: también fuzzy en categoría
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

  // Umbral dinámico: mínimo 5 pts, máximo 60% del mejor score
  const threshold = Math.max(5, maxScore * 0.5);

  return validScored
    .filter(item => item.score >= threshold)
    .slice(0, 4)
    .map(item => item.product);
}

/**
 * Búsqueda relajada por tipo de producto: cuando el usuario solo escribe
 * "caucho" o "aceite" sin modelo específico, busca el mejor producto de esa categoría.
 * Opcionalmente recibe tokens adicionales (marca, modelo) para afinar dentro de la categoría.
 *
 * FIX: ahora acepta extraTokens para filtrar dentro de la categoría (ej: "aceite motul")
 */
function searchByProductType(typeToken, extraTokens = []) {
  const clean = normalizeText(typeToken);
  const allProducts = db.prepare('SELECT * FROM products WHERE activo = 1').all();

  const scored = allProducts.map(p => {
    const normModelo = normalizeText(p.modelo);
    const normMarca = normalizeText(p.marca);
    const normCat = normalizeText(p.categoria);
    const normDesc = normalizeText(p.descripcion || '');

    let score = 0;

    // Primero: el producto debe ser de esta categoría/tipo
    if (normCat.includes(clean)) score += 10;
    else if (normModelo.includes(clean)) score += 8;
    else if (normDesc.includes(clean)) score += 4;
    else {
      // Fuzzy en categoría como fallback
      const catWords = normCat.split(' ');
      for (const cw of catWords) {
        if (cw.length >= 3 && isFuzzyMatch(clean, cw)) { score += 6; break; }
      }
    }

    // Si no es de esta categoría en absoluto, descartar
    if (score === 0) return { product: p, score: 0 };

    // FIX: si hay tokens extras (marca, modelo), sumarles puntuación para afinar
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
 * Detecta si el cliente está consultando múltiples productos a la vez (tipo Carrito/Combo).
 * Ej: "pastillas aveo y aceite 20w50", "caucho y aceite", "bujías, cadena y aceite motul"
 *
 * FIXES:
 * - Soporta 2, 3, 4... productos en una sola consulta
 * - Si fuzzy normal falla, hace fallback por categoría usando extraTokens del segmento
 * - No devuelve duplicados (misma categoría = mismo producto en catálogo pequeño)
 * - Retorna mínimo 2 productos distintos para activar el modo combo
 */
function searchMultipleProducts(query) {
  if (!query) return [];

  // Separadores comunes en español: "y", "con", "mas/más", "+", ","
  const parts = query
    .split(/\s+y\s+|\s+con\s+|\s+mas\s+|\s*\+\s*|,\s*/i)
    .map(p => p.trim())
    .filter(p => p.length >= 2); // FIX: antes >= 3, perdía tokens cortos

  if (parts.length < 2) return [];

  const foundMap = new Map(); // key: product.id → value: product

  for (const part of parts) {
    // Intento 1: búsqueda fuzzy normal (la más precisa)
    const results = searchProductsFuzzy(part);
    if (results.length > 0) {
      const best = results[0];
      if (!foundMap.has(best.id)) {
        foundMap.set(best.id, best);
      }
      continue;
    }

    // Intento 2: fallback — extraer el tipo de producto del segmento y buscar por categoría
    // FIX: también extraemos tokens que no son stop-words ni el type para filtrar dentro de la categoría
    const cleanPart = normalizeText(part);
    const partTokens = cleanPart
      .split(/\s+/)
      .map(t => SYNONYMS[t] || t)
      .filter(t => t.length >= 2 && !STOP_WORDS.has(t));

    const typeToken = partTokens.find(t => PRODUCT_TYPES.has(t));

    if (typeToken) {
      // Los tokens que NO son el typeToken son posibles marcas/modelos para afinar
      const extraTokens = partTokens.filter(t => t !== typeToken && !QUALIFIERS.has(t));
      const fallback = searchByProductType(typeToken, extraTokens);
      if (fallback && !foundMap.has(fallback.id)) {
        foundMap.set(fallback.id, fallback);
      }
    }
  }

  const items = Array.from(foundMap.values());

  // Retornar si encontramos al menos 2 productos distintos
  return items.length >= 2 ? items : [];
}

module.exports = {
  searchProductsFuzzy,
  searchMultipleProducts,
  searchByProductType
};
