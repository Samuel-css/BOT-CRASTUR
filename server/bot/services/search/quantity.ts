/**
 * @file quantity.ts
 * @description Extracción de cantidades sin confundirlas con medidas, viscosidades o aros.
 */

import { STOP_WORDS } from '../../config/stopWords';

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
export function looksLikeMeasurement(tokens: string[], index: number): boolean {
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
export function extractLeadingQuantity(part: string): number {
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

