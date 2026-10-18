/**
 * @file stopWords.ts
 * @description Conjunto de palabras vacías (stop-words) excluidas en búsquedas comerciales y automotrices.
 * Filtra pronombres, preposiciones, saludos y verbos comunes para aislar los términos de producto clave.
 *
 * [NORMALIZACIÓN] Las entradas se normalizan con `normalizeText()` para que las tildes
 * y la `ñ` nunca impidan el filtrado (p. ej. 'señor' -> 'senor').
 */

import { normalizeText } from '../utils/textUtils';

const RAW_STOP_WORDS: string[] = [
  // Consultas de precio / disponibilidad
  'tienen', 'tendra', 'tendras', 'tienes', 'venden', 'hay', 'precio', 'precios',
  'cuanto', 'cuanta', 'cuantos', 'cuantas', 'cuesta', 'vale', 'sale', 'salen',
  'costo', 'costos', 'valor', 'valen', 'vende', 'vendes', 'queda', 'quedan',
  'habra', 'tendran', 'tnen', 'tiene', 'manejan', 'maneja', 'ofrecen', 'ofrece',

  // Verbos de intención
  'busco', 'buscar', 'buscando', 'quiero', 'quisiera', 'necesito', 'necesitaria',
  'ocupo', 'dame', 'deme', 'dime', 'mandame', 'enviame', 'llevo', 'llevar',
  'comprar', 'compra', 'compro', 'pedido', 'pedidos', 'orden', 'aparta', 'apartar',
  'apartado', 'reservar', 'reserva', 'guardar', 'guardame', 'guardamelo', 'guardamela',

  // Cortesía y muletillas
  'por', 'favor', 'porfa', 'porfavor', 'buenas', 'hola', 'epale', 'chamo', 'bro',
  'gracias', 'ok', 'okey', 'bien', 'bueno', 'amigo', 'amiga', 'amigos', 'pana',
  'mano', 'compa', 'compadre', 'senor', 'senora', 'caballero', 'dama',
  'saludos', 'tal', 'dia', 'dias', 'tarde', 'tardes', 'noche', 'noches',

  // Artículos y preposiciones
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'para', 'pa',
  'q', 'k', 'd', 'm', 'en', 'con', 'del', 'al', 'lo', 'me', 'te', 'se', 'le',
  'les', 'nos', 'mi', 'mis', 'su', 'sus', 'tu', 'tus', 'a', 'e', 'o', 'u',
  'pero', 'porque', 'sobre', 'acerca', 'desde', 'hasta', 'entre', 'sin',

  // Tiempo / lugar / cantidad
  'ya', 'no', 'si', 'tambien', 'otro', 'otra', 'otros', 'otras', 'mas', 'menos',
  'total', 'totales', 'ambos', 'ambas', 'juntos', 'junto', 'dos', 'tres',
  'donde', 'como', 'cuando', 'que', 'cual', 'cuales', 'quien',
  'toda', 'todas', 'todos', 'caracas', 'ccs',
  'unidad', 'unidades', 'pieza', 'piezas', 'pote', 'potes', 'caja', 'cajas',
  'tipo', 'tipos', 'marca', 'marcas', 'modelo', 'modelos',
  'disponible', 'disponibles', 'disponibilidad', 'existencia', 'existencias',
  'algo', 'algun', 'alguna', 'algunos', 'algunas',
  'estan', 'esta', 'este', 'estos', 'estas', 'es', 'son', 'seria', 'serian',
  'era', 'sea', 'haber', 'tener',

  // Referencias al catálogo
  'saber', 'informacion', 'info', 'catalogo', 'catalogos',
  'opcion', 'opciones', 'cashea', 'listado', 'lista'
];

export const STOP_WORDS: Set<string> = new Set(
  RAW_STOP_WORDS
    .map((word) => normalizeText(word))
    .filter(Boolean)
);

export default STOP_WORDS;
