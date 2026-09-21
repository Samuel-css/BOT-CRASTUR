/**
 * Normaliza texto eliminando acentos y signos de puntuación
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distancia de Levenshtein para búsqueda difusa (Fuzzy Matching)
 * Tolera errores ortográficos como 'sansumg', 'ifon', 'xaomi'
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Comprueba si un token del usuario se parece a una palabra clave del catálogo
 */
function isFuzzyMatch(userToken, targetWord) {
  if (!userToken || !targetWord) return false;
  if (targetWord.includes(userToken)) return true;

  // Si la palabra es muy corta, requerir coincidencia exacta
  if (userToken.length < 3 || targetWord.length < 3) return userToken === targetWord;

  const maxDist = userToken.length > 5 ? 2 : 1;
  const dist = levenshteinDistance(userToken, targetWord);
  return dist <= maxDist;
}

module.exports = {
  normalizeText,
  levenshteinDistance,
  isFuzzyMatch
};
