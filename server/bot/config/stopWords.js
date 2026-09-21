// Palabras vacías en búsquedas automotrices
const STOP_WORDS = new Set([
  'tienen', 'tendra', 'tendras', 'venden', 'hay', 'precio', 'precios', 'cuanto', 'cuesta', 'vale',
  'busco', 'quiero', 'quisiera', 'necesito', 'por', 'favor', 'buenas', 'hola', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'para',
  'ya', 'no', 'si', 'gracias', 'ok', 'bien', 'bueno', 'amigo', 'pana', 'mano', 'dias', 'tardes', 'noches',
  'donde', 'como', 'cuando', 'que', 'cual', 'quien', 'toda', 'todas', 'todos', 'caracas', 'tienes', 'tienen'
]);

module.exports = { STOP_WORDS };
