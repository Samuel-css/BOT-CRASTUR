/**
 * @file keywords.ts
 * @description Diccionario centralizado de palabras clave del enrutador conversacional.
 *
 * [MANTENIBILIDAD] Antes, cada sección de `bot/index.ts` tenía largas cadenas
 * `norm.includes('a') || norm.includes('b') || ...`. Centralizarlas aquí:
 *  - reduce el tamaño de `index.ts`,
 *  - evita duplicar listas entre secciones,
 *  - y permite ajustar falsos positivos en un solo lugar.
 *
 * Todas las cadenas se comparan contra el texto NORMALIZADO (`normalizeText`):
 * minúsculas, sin tildes y sin `ñ`. Por eso aquí se escriben ya sin tildes.
 */

/** True si el texto normalizado contiene al menos una de las frases. */
export function includesAny(norm: string, phrases: readonly string[]): boolean {
  for (const p of phrases) {
    if (p && norm.includes(p)) return true;
  }
  return false;
}

/** True si el texto normalizado es exactamente una de las frases. */
export function equalsAny(norm: string, phrases: readonly string[]): boolean {
  return phrases.includes(norm);
}

/**
 * [PRECISIÓN] True si el texto contiene la frase como PALABRA COMPLETA.
 * Necesario para claves ambiguas: evita que "aparta" active apartados en "apartamento"
 * o que "auto" active la respuesta de carros en "automático".
 */
export function includesWordAny(norm: string, phrases: readonly string[]): boolean {
  for (const phrase of phrases) {
    if (!phrase) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(norm)) return true;
  }
  return false;
}

export const KEYWORDS = {
  binance: ['binance', 'usdt', 'binance pay', 'cripto', 'crypto', 'bitcoin', 'btc', 'criptomoneda', 'criptomonedas'],

  combos: ['combo', 'combos', 'instagram', 'promo', 'promos', 'promocion', 'promociones', 'vi en ig', 'vi en instagram', 'publicacion'],
  combosKits: ['kits'],

  catalog: ['catalogo', 'catalogos', 'lista de precios', 'listado de precios', 'en pdf', 'el pdf'],
  catalogEquals: ['pdf', 'en pdf', 'el pdf'],

  nonAcceptedPayments: [
    'zelle', 'banesco panama', 'punto de venta', 'tienen punto',
    'tarjeta de debito', 'tarjeta de credito', 'tarjeta',
    'zinli', 'paypal', 'wally', 'wally tech', 'airtm', 'uphold',
    'wise', 'payoneer', 'skrill', 'neteller', 'western union',
    'moneygram', 'venmo', 'cash app', 'efectivo digital', 'monedero digital'
  ],

  rate: ['a que tasa', 'cual es la tasa', 'que tasa', 'tasa bcv', 'tasa de hoy', 'tasa del dia', 'a como esta el dolar', 'a como reciben', 'precio del dolar'],
  rateEquals: ['tasa', 'dolar', 'dolares'],

  nationalShipping: ['nacional', 'al interior', 'interior del pais', 'otra ciudad', 'otro estado', 'tealca', 'zoom', 'mrw', 'domesa', 'valencia', 'maracay', 'barquisimeto', 'maracaibo', 'puerto la cruz', 'maturin', 'merida', 'san cristobal'],

  immediatePickup: ['puedo ir ya', 'puedo pasar ya', 'puedo ir ahorita', 'puedo pasar ahorita', 'estan atendiendo ahorita', 'lo puedo retirar hoy', 'puedo retirar hoy', 'puedo retirar', 'retirar ya', 'retirar en la tienda', 'retirar en tienda', 'mandar a retirar', 'pasar a retirar', 'retirar yo mismo', 'retirar personalmente', 'lo busco ya'],

  referencePoints: ['como llego', 'punto de referencia', 'puntos de referencia', 'cerca de donde', 'cerca de que', 'que metro', 'estacion de metro', 'parque central', 'nuevo circo'],

  installation: ['instalan', 'instalacion', 'tienen taller', 'tienen mecanico', 'hacen la instalacion', 'quien lo monta', 'lo montan', 'montan', 'montaje', 'cambian aceite', 'cambio de aceite', 'reparan', 'arreglan moto', 'arreglan motos'],

  quality: ['son originales', 'que marca', 'son de buena calidad', 'calidad', 'son chinos', 'son japoneses', 'son americanos', 'marcas trabajan', 'repuestos usados', 'repuestos nuevos', 'productos usados', 'productos nuevos', 'totalmente nuevos', 'totalmente usados', 'son nuevos', 'son usados', 'segunda mano'],

  carInquiry: ['repuestos de carro', 'repuesto de carro', 'repuestos para carro', 'repuesto para carro', 'cosas de carro', 'repuestos de auto', 'repuesto de auto', 'para carros', 'para carro', 'para autos', 'toyota', 'corolla', 'aveo', 'optra', 'spark', 'chevrolet', 'ford', 'tren delantero', 'caja de cambio', 'caja automatica', 'caja sincronica', 'tripoides', 'cremallera'],

  invoicing: ['factura fiscal', 'dan factura', 'factura', 'comprobante', 'recibo', 'presupuesto', 'cotizacion formal', 'nota de entrega'],

  discount: ['descuento', 'rebaja', 'promo', 'lo ultimo', 'mas barato', 'precio minimo', 'precio en divisas', 'pago en divisas', 'descuento en divisas', 'descuento en dolares'],

  paymentMethods: ['como pagar', 'como pago', 'formas de pago', 'metodos de pago', 'pago movil', 'que metodo', 'aceptan dolares', 'aceptan divisas', 'como reciben el pago', 'como se realiza el pago', 'transferencia', 'se puede pagar', 'puedo pagar', 'pagar al llegar', 'pago al llegar', 'pagar en persona', 'pago en persona', 'pagar al recibir', 'pago al recibir', 'pago contra entrega', 'pagar al recibir el pedido', 'aceptan efectivo', 'pago en efectivo', 'efectivo', 'bolivares', 'en bolivares'],
  paymentMethodsEquals: ['como se paga', 'formas de pago', 'metodos de pago'],

  apartado: ['apartar', 'reservar', 'aparta', 'reserva', 'guardamelo', 'guardamela', 'guardalo', 'guardala', 'lo quiero apartar', 'quiero apartar', 'lo paso a buscar', 'lo voy a buscar', 'apartame', 'reservame', 'apartalo', 'apartala', 'apartalos', 'apartalas'],

  delivery: ['delivery', 'envio', 'envios', 'hacen delivery', 'ponen delivery', 'traen', 'llevan', 'motorizado', 'mandan', 'flete', 'a domicilio', 'a toda caracas', 'a todas caracas'],

  storeHours: ['horario', 'abren', 'cierran', 'estan abiertos', 'que hora abren', 'a que hora', 'hasta que hora', 'atienden hoy', 'atienden el', 'trabajan los domingos', 'trabajan domingos', 'trabajan el domingo', 'atienden el domingo', 'abren los domingos', 'abren domingo', 'feriado', 'feriados', 'dia feriado'],

  warranty: ['garantia', 'devolucion', 'defectuoso', 'si no le sirve', 'si no le queda', 'no le funciono', 'vino malo', 'vino defectuoso', 'viene malo', 'sale malo', 'salio malo', 'no funciona', 'dejo de funcionar'],

  availability: ['hay disponible en tienda', 'entrega inmediata', 'tienes en stock', 'disponible', 'disponibilidad'],
  availabilityEquals: ['disponibilidad', 'disponible', 'hay disponible', 'tienen en tienda', 'entrega inmediata'],

  cashea: ['cashea', 'financiamiento', 'financiado', 'financiar', 'financiera', 'a credito', 'credito', 'cuotas', 'cuota', 'inicial', 'nivel', 'pagar por partes', 'pago por partes'],

  location: ['ubicacion', 'mapa', 'maps', 'donde estan', 'donde queda', 'donde quedan', 'donde es', 'que parte', 'q parte', 'por donde', 'se ubican', 'se encuentran', 'sucursal', 'sucursales'],

  howToBuy: ['como compro', 'como comprar', 'como hago para comprar', 'como puedo comprar', 'como se compra', 'como hago un pedido', 'como pido', 'como hago el pedido', 'como hacer el pedido', 'quiero comprar', 'quiero hacer un pedido', 'como se hace la compra'],

  moto: ['para moto', 'de moto', 'repuestos de moto', 'repuesto de moto', 'cosas de moto', 'para motos', 'motocicleta', 'scooter'],
  motoEquals: ['moto'],

  cauchera: ['cauchera', 'caucho', 'llanta', 'llantas', 'goma', 'gomas', 'valvula', 'parche', 'nitrogeno', 'inflado', 'camara de aire', 'neumatico'],

  greetingParts: ['buenos dias', 'buen dia', 'buenas tardes', 'buenas noches', 'epale', 'que mas', 'que tal', 'saludos', 'mi pana'],
  greetingEquals: ['hola', 'hola!', 'ola', 'buenas', 'menu', 'inicio', 'ayuda', 'info', 'informacion', 'que tienen', 'que venden', 'que manejan', 'que tienen disponible', 'que ofrecen', 'que productos tienen', 'que productos venden', 'que venden aqui', 'que tienes', 'tienen catalogo', 'que hay', 'chamo', 'pana', 'todo', 'todo el catalogo', 'ver todo'],

  // [VENTA AL MAYOR] Consultas de compra por volumen
  wholesale: ['al mayor', 'mayorista', 'por mayor', 'precio al mayor', 'ventas al mayor', 'compra por volumen'],

  // [PRECIO SIN PRODUCTO] El cliente pregunta el precio sin decir qué repuesto
  barePriceEquals: [
    'cuanto vale', 'cuanto cuesta', 'cuanto sale', 'cuanto es', 'cuanto seria',
    'vale', 'cuesta', 'precio', 'precios', 'que precio', 'a como', 'a cuanto',
    'cuanto valen', 'cuanto cuestan', 'cuanto esta', 'cuanto estan', 'cotizame'
  ],

  carGeneric: ['carro', 'auto', 'vehiculo', 'camioneta', 'sedan', '4x4']
} as const;

export default { KEYWORDS, includesAny, equalsAny, includesWordAny };
