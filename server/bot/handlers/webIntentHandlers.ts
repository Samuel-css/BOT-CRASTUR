/**
 * @file webIntentHandlers.ts
 * @description Respuestas para consultas originadas en los BOTONES de la PÁGINA WEB de Crastur.
 * Los botones de la web abren WhatsApp con mensajes muy concretos (ver lista abajo). Este módulo
 * reconoce ÚNICAMENTE esos patrones inequívocos, para no interferir con la búsqueda normal de
 * productos del catálogo.
 *
 * IMPORTANTE: la detección es ESTRICTA (frases/patrones completos de la web), no palabras
 * sueltas como "aceite" o "caucho", que deben seguir fluyendo a la búsqueda difusa.
 * [NO FALLAR AL CLIENTE] Cada intención devuelve una respuesta útil y ofrece un asesor humano.
 */

import { formatRate } from '../utils/formatters';

/** Catálogo de marcas anunciadas en la web. */
const ACEITES_MARCAS = ['motul', 'roshfrans', 'pdv', 'ipone', 'inca', 'ultralub'];
const CAUCHOS_MARCAS = ['michelin', 'ceat', 'eurogrip', 'timsun', 'euromina', 'macuro'];
const CASCOS_MARCAS = ['shaft', 'axxis', 'moxul', 'edge'];

/** Extrae la marca mencionada en el texto, si coincide con la lista dada. */
function extractBrand(norm: string, brands: string[]): string | null {
  for (const b of brands) {
    const clean = b.replace(/\s+/g, '');
    if (norm.includes(b) || norm.includes(clean)) return b.toUpperCase();
  }
  return null;
}

/**
 * Evalúa intenciones provenientes de la web. Retorna string si aplica, o null.
 * La detección es estricta para no robar consultas normales del catálogo.
 */
export function runWebIntents(
  norm: string,
  text: string,
  pushName: string,
  settings: Record<string, string>,
  tasa: number
): string | null {
  const horario = settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM';
  const direccion = settings?.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas';
  const maps = settings?.google_maps_url || 'https://maps.app.goo.gl/wvaqX1W6LjGRcxNA';

  // Patrón base de los mensajes que generan los botones de la web (todos empiezan por "Hola Crastur!").
  const fromWeb = norm.includes('hola crastur') || norm.includes('deseo') || norm.includes('quiero conocer') || norm.includes('voy en camino');

  // 1) Consultar MEDIDAS de cauchos de una marca (botón de BrandShowcase)
  if (norm.includes('medidas de cauchos') || norm.includes('medidas de neumaticos')) {
    const marca = extractBrand(norm, [...CAUCHOS_MARCAS, ...ACEITES_MARCAS]);
    let msg = `¡Hola, *${pushName}*! 🛞🏍️ Con gusto te ayudamos con las *medidas de cauchos*💛\n\n`;
    if (marca) msg += `Manejamos la marca *${marca}* y más opciones.\n\n`;
    msg += `Tenemos cauchos y tripas en *diversas medidas*. Para darte precio y disponibilidad exacta, indícanos:\n\n`;
    msg += `👉 La *medida* (ej: *170/70-R14*, *120/80-17*)\n`;
    msg += `👉 O el *modelo de tu moto* (ej: *Bera SBR*, *Empire Horse*)\n\n`;
    msg += `👉 Escribe *APARTAR* para reservar 24h o *VENDEDOR* para atención directa.`;
    return msg;
  }

  // 2) Conocer MODELOS de cascos de una marca (botón de BrandShowcase)
  if (norm.includes('modelos de cascos') || norm.includes('modelos de cascos') || (fromWeb && norm.includes('cascos') && norm.includes('modelos'))) {
    const marca = extractBrand(norm, CASCOS_MARCAS);
    let msg = `¡Hola, *${pushName}*! 🎽🏍️ ¡Excelente decisión cuidar tu seguridad!\n\n`;
    if (marca) msg += `Manejamos la marca *${marca}* con certificación y garantía.\n\n`;
    msg += `Contamos con *cascos integrales, semi-integrales y corazas* de las mejores marcas (SHAFT, AXXIS, MOXUL, EDGE).\n\n`;
    msg += `👉 Indícanos tu *talla* (M, L, XL) y el estilo que prefieres para confirmarte modelos y precio.\n`;
    msg += `👉 Escribe *VENDEDOR* para que un asesor te muestre los modelos disponibles.`;
    return msg;
  }

  // 3) Consultar DISPONIBILIDAD de una marca de lubricantes (botón de BrandShowcase)
  if (norm.includes('disponibilidad de la marca')) {
    const marca = extractBrand(norm, [...ACEITES_MARCAS, ...CAUCHOS_MARCAS, ...CASCOS_MARCAS]);
    let msg = `¡Hola, *${pushName}*! 🛞🏍️ Con gusto te confirmamos la disponibilidad.💛\n\n`;
    if (marca) msg += `Consultamos inventario de la marca *${marca}*.\n\n`;
    msg += `👉 Indícanos el *producto o medida exacta* que buscas (ej: *aceite 20W50*, *caucho 120/80-17*, *casco talla L*) y te confirmamos existencia y precio de inmediato.\n`;
    msg += `👉 O el *modelo de tu moto* para recomendarte lo correcto.\n`;
    msg += `👉 Escribe *VENDEDOR* para atención directa.`;
    return msg;
  }

  // 5) Coordinar DELIVERY desde la web (botón de DeliveryInfo)
  if (
    (norm.includes('servicio de delivery') || norm.includes('coordinar un delivery') || norm.includes('coordinar delivery')) ||
    (fromWeb && norm.includes('delivery en caracas') && norm.includes('coordinar'))
  ) {
    let msg = `¡Hola, *${pushName}*! 🛵 Con gusto coordinamos tu *delivery en Caracas*.\n\n`;
    msg += `Realizamos envíos el mismo día en moto a toda la zona metropolitana.\n\n`;
    msg += `👉 Indícanos tu *zona o sector* y el *producto* que deseas, para darte el costo del envío y confirmarte disponibilidad.\n`;
    msg += `👉 También puedes retirar sin costo en nuestra tienda: *${direccion}*.\n`;
    msg += `🕒 *Horario:* ${horario}`;
    return msg;
  }

  // 6) Cliente en camino a la tienda (botón de LocationMap)
  if (norm.includes('voy en camino') || norm.includes('en camino a su tienda')) {
    let msg = `¡Perfecto, *${pushName}*! 🛞🏍️✨ Te esperamos con gusto en Crastur.\n\n`;
    msg += `🏢 *Dirección:* ${direccion}\n`;
    msg += `🗺️ *Google Maps:* ${maps}\n\n`;
    msg += `🕒 *Horario:* ${horario}\n\n`;
    msg += `👉 Cuando llegues, menciona el producto que buscabas para atenderte más rápido. ¡Nos vemos! 💛`;
    return msg;
  }

  // 7) Consultas comerciales genéricas lanzadas por los botones CTA de la web
  if (
    norm.includes('consulta directa desde la pagina') ||
    norm.includes('consulta comercial') ||
    norm.includes('cotizar un repuesto') ||
    norm.includes('precio y disponibilidad de un repuesto') ||
    (fromWeb && norm.includes('hacer un pedido') && norm.includes('consultar disponibilidad'))
  ) {
    let msg = `¡Hola, *${pushName}*! 👋 Gracias por escribirnos desde nuestra página web 🛞🏍️💛\n\n`;
    msg += `Con gusto te ayudamos. Para darte precio y disponibilidad de inmediato:\n\n`;
    msg += `👉 Escribe el *repuesto, insumo o producto* que buscas (ej: *pastillas*, *bujía*, *aceite*, *casco*, *caucho*).\n`;
    msg += `👉 O el *modelo de tu moto* (ej: *Bera SBR*, *Empire Horse*).\n`;
    msg += `👉 Escribe *MENU* para ver nuestro catálogo por categorías.\n\n`;
    msg += `🇻🇪 Precios a *tasa oficial BCV del día: Bs. ${formatRate(tasa)} / USD* 💛 Con financiamiento *Cashea*.`;
    return msg;
  }

  return null;
}
