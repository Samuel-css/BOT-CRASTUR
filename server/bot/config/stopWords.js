// Palabras vacías en búsquedas comerciales y automotrices de Crastur
const STOP_WORDS = new Set([
  'tienen', 'tendra', 'tendras', 'tienes', 'venden', 'hay', 'precio', 'precios', 'cuanto', 'cuesta', 'vale',
  'sale', 'salen', 'costo', 'costos', 'valor', 'valen', 'vende', 'vendes', 'queda', 'quedan', 'habra', 'tendran', 'tnen', 'tiene',
  'busco', 'quiero', 'quisiera', 'necesito', 'por', 'favor', 'buenas', 'hola', 'epale', 'chamo', 'bro',
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'para', 'pa', 'q', 'k', 'd', 'm', 'en', 'con', 'del', 'al',
  'ya', 'no', 'si', 'gracias', 'ok', 'bien', 'bueno', 'amigo', 'pana', 'mano', 'dias', 'tardes', 'noches',
  'donde', 'como', 'cuando', 'que', 'cual', 'quien', 'toda', 'todas', 'todos', 'caracas', 'ccs',
  'total', 'totales', 'ambos', 'ambas', 'juntos', 'junto', 'dos', 'tres', 'tambien', 'otro', 'otra', 'mas',
  'apartar', 'aparta', 'apartado', 'reservar', 'reserva', 'guardar', 'guardame', 'guardamelo', 'guardamela',
  'pieza', 'piezas', 'unidad', 'pote', 'potecito'
]);

module.exports = { STOP_WORDS };
