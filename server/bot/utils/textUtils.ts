/**
 * @file textUtils.ts
 * @description Utilidades de procesamiento de lenguaje natural, normalización diacrítica,
 * distancia de Levenshtein para coincidencia difusa (Fuzzy Matching) y estandarización ortográfica.
 */

/**
 * Normaliza una cadena de texto eliminando tildes, diacríticos, caracteres especiales
 * y espacios múltiples repetidos, convirtiendo todo a minúsculas.
 * 
 * @param text - Cadena original
 * @returns Cadena limpia y normalizada
 */
export function normalizeText(text: string | null | undefined): string {
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
 * Calcula la distancia mínima de edición de Levenshtein entre dos cadenas.
 * Tolera errores tipográficos comunes (sustitución, inserción y omisión).
 * 
 * @param a - Primera cadena
 * @param b - Segunda cadena
 * @returns Número mínimo de operaciones de edición necesarias para transformar 'a' en 'b'
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
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
          matrix[i - 1][j - 1] + 1, // Sustitución
          matrix[i][j - 1] + 1,     // Inserción
          matrix[i - 1][j] + 1      // Eliminación
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Evalúa si un token del usuario coincide de forma difusa con una palabra objetivo del catálogo.
 * Aplica umbrales adaptativos según la longitud del término.
 * 
 * @param userToken - Palabra enviada por el usuario
 * @param targetWord - Palabra del catálogo a contrastar
 * @returns `true` si hay coincidencia exacta, prefijo o distancia admisible; `false` en caso contrario.
 */
export function isFuzzyMatch(userToken: string, targetWord: string): boolean {
  if (!userToken || !targetWord) return false;
  if (userToken === targetWord) return true;

  // Tokens muy cortos (< 3 caracteres) requieren coincidencia exacta
  if (userToken.length < 3 || targetWord.length < 3) return userToken === targetWord;

  // Coincidencia por subcadena o prefijo
  if (userToken.length >= 4 && targetWord.includes(userToken)) return true;
  if (userToken.length === 3 && targetWord.startsWith(userToken)) return true;

  const maxDist = userToken.length > 5 ? 2 : 1;
  const dist = levenshteinDistance(userToken, targetWord);
  return dist <= maxDist;
}

/**
 * Estandariza la tipografía y estilo de los mensajes generados por el bot:
 * - Asegura mayúscula inicial en párrafos y oraciones.
 * - Respeta la capitalización canónica de marcas comerciales (Motul, Bera, Tip Top, Cashea, BCV).
 * 
 * @param text - Mensaje crudo a despachar
 * @returns Mensaje con capitalización y marcas pulidas
 */
export function standardizeBotMessage(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return text || '';

  let formatted = text.trim();

  // Asegurar mayúscula al inicio de mensaje y tras saltos de línea
  formatted = formatted.replace(/(^|\n+)([a-záéíóúñ])/g, (match, prefix, letter) => {
    return prefix + letter.toUpperCase();
  });

  // Asegurar mayúscula tras punto y seguido
  formatted = formatted.replace(/(\.\s+)([a-záéíóúñ])/g, (match, sep, letter) => {
    return sep + letter.toUpperCase();
  });

  // Reemplazo estandarizado de nombres comerciales reconocidos
  const brandReplacements: [RegExp, string][] = [
    [/\bmotul\b/gi, 'Motul'],
    [/\bbera\b/gi, 'Bera'],
    [/\bempire\b/gi, 'Empire'],
    [/\byamaha\b/gi, 'Yamaha'],
    [/\bchoho\b/gi, 'Choho'],
    [/\bngk\b/gi, 'NGK'],
    [/\btip top\b/gi, 'Tip Top'],
    [/\brema\b/gi, 'Rema'],
    [/\bcastrol\b/gi, 'Castrol'],
    [/\bvenoco\b/gi, 'Venoco'],
    [/\bshell\b/gi, 'Shell'],
    [/\bbinance pay\b/gi, 'Binance Pay'],
    [/\bbinance\b/gi, 'Binance'],
    [/\busdt\b/gi, 'USDT'],
    [/\bcashea\b/gi, 'Cashea'],
    [/\bbcv\b/gi, 'BCV']
  ];

  for (const [regex, replacement] of brandReplacements) {
    formatted = formatted.replace(regex, replacement);
  }

  return formatted;
}

export default {
  normalizeText,
  levenshteinDistance,
  isFuzzyMatch,
  standardizeBotMessage
};
