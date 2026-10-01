/**
 * @file stopWords.ts
 * @description Conjunto de palabras vacías (stop-words) excluidas en búsquedas comerciales y automotrices.
 * Filtra pronombres, preposiciones, saludos y verbos comunes para aislar los términos de producto clave.
 */

export const STOP_WORDS: Set<string> = new Set([
  'tienen', 'tendra', 'tendras', 'tienes', 'venden', 'hay', 'precio', 'precios', 'cuanto', 'cuesta', 'vale',
  'sale', 'salen', 'costo', 'costos', 'valor', 'valen', 'vende', 'vendes', 'queda', 'quedan', 'habra', 'tendran', 'tnen', 'tiene',
  'busco', 'quiero', 'quisiera', 'necesito', 'por', 'favor', 'buenas', 'hola', 'epale', 'chamo', 'bro',
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'para', 'pa', 'q', 'k', 'd', 'm', 'en', 'con', 'del', 'al',
  'ya', 'no', 'si', 'gracias', 'ok', 'bien', 'bueno', 'amigo', 'pana', 'mano', 'dias', 'tardes', 'noches',
  'donde', 'como', 'cuando', 'que', 'cual', 'cuales', 'quien', 'toda', 'todas', 'todos', 'caracas', 'ccs',
  'cuanto', 'cuanta', 'cuantos', 'cuantas',
  'total', 'totales', 'ambos', 'ambas', 'juntos', 'junto', 'dos', 'tres', 'tambien', 'otro', 'otra', 'mas',
  'apartar', 'aparta', 'apartado', 'reservar', 'reserva', 'guardar', 'guardame', 'guardamelo', 'guardamela',
  'pieza', 'piezas', 'unidad', 'pote', 'potecito',
  'tipo', 'tipos', 'marca', 'marcas', 'modelo', 'modelos',
  'disponible', 'disponibles', 'disponibilidad', 'existencia', 'existencias',
  'algo', 'algun', 'alguna', 'algunos', 'algunas',
  'estan', 'esta', 'este', 'estos', 'estas', 'es', 'son', 'seria', 'serian', 'era', 'sea',
  'lo', 'los', 'me', 'te', 'se', 'le', 'les', 'nos', 'mi', 'mis', 'su', 'sus', 'tu', 'tus',
  'a', 'e', 'o', 'u', 'pero', 'porque', 'porfa', 'porfavor', 'cashea',
  'tal', 'saludos', 'amiga', 'amigos', 'compa', 'compadre', 'senor', 'senora', 'caballero', 'dama',
  'sobre', 'acerca', 'saber', 'informacion', 'info', 'catalogo', 'opcion', 'opciones'
]);

export default STOP_WORDS;
