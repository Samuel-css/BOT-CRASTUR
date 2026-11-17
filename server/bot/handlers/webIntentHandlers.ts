/**
 * @file webIntentHandlers.ts
 * @description Respuestas para consultas originadas en los botones de la página web.
 *
 * [COPY BREVE] La respuesta concreta va primero; se evita repetir la dirección y
 * el horario completos si el cliente no los pidió.
 */

import { formatRate } from '../utils/formatters';
import { compose, storeAddress, storeHours, storeMaps, firstName } from '../copy/messages';

const ACEITES_MARCAS = ['motul', 'roshfrans', 'pdv', 'ipone', 'inca', 'ultralub'];
const CAUCHOS_MARCAS = ['michelin', 'ceat', 'eurogrip', 'timsun', 'euromina', 'macuro'];
const CASCOS_MARCAS = ['shaft', 'axxis', 'moxul', 'edge'];

function extractBrand(norm: string, brands: string[]): string | null {
  for (const b of brands) {
    const clean = b.replace(/\s+/g, '');
    if (norm.includes(b) || norm.includes(clean)) return b.toUpperCase();
  }
  return null;
}

export function runWebIntents(
  norm: string,
  text: string,
  pushName: string,
  settings: Record<string, string>,
  tasa: number
): string | null {
  const horario = storeHours(settings);
  const direccion = storeAddress(settings);
  const maps = storeMaps(settings);
  const fromWeb = norm.includes('hola crastur') || norm.includes('deseo') || norm.includes('quiero conocer') || norm.includes('voy en camino');

  if (norm.includes('medidas de cauchos') || norm.includes('medidas de neumaticos')) {
    const marca = extractBrand(norm, [...CAUCHOS_MARCAS, ...ACEITES_MARCAS]);
    const lines = [`¡Hola, ${firstName(pushName)}! 🛞 Con gusto te ayudo con las medidas.`];
    if (marca) lines.push(`Manejamos la marca *${marca}* y más opciones.`);
    lines.push('Dime la medida (ej: 120/80-17) o el modelo de tu moto.');
    lines.push('Te doy precio y disponibilidad al instante.');
    return compose(lines);
  }

  if (norm.includes('modelos de cascos') || (fromWeb && norm.includes('cascos') && norm.includes('modelos'))) {
    const marca = extractBrand(norm, CASCOS_MARCAS);
    const lines = [`¡Hola, ${firstName(pushName)}! 🎽 Con gusto te ayudo con los cascos.`];
    if (marca) lines.push(`Manejamos *${marca}* con certificación y garantía.`);
    lines.push('Dime tu talla (M, L, XL) y el estilo que prefieres.');
    return compose(lines);
  }

  if (norm.includes('disponibilidad de la marca')) {
    const marca = extractBrand(norm, [...ACEITES_MARCAS, ...CAUCHOS_MARCAS, ...CASCOS_MARCAS]);
    const lines = [`¡Hola, ${firstName(pushName)}! Con gusto te confirmo disponibilidad.`];
    if (marca) lines.push(`Consulto inventario de *${marca}*.`);
    lines.push('Dime el producto o medida exacta (ej: aceite 20W50, caucho 120/80-17).');
    return compose(lines);
  }

  if (
    (norm.includes('servicio de delivery') || norm.includes('coordinar un delivery') || norm.includes('coordinar delivery')) ||
    (fromWeb && norm.includes('delivery en caracas') && norm.includes('coordinar'))
  ) {
    return compose([
      `¡Hola, ${firstName(pushName)}! 🛵 Sí, coordinamos delivery en Caracas.`,
      'Dime tu zona y el producto que quieres, y te doy el costo del envío.',
      `También puedes retirar en tienda: ${direccion}.`
    ]);
  }

  if (norm.includes('voy en camino') || norm.includes('en camino a su tienda')) {
    return compose([
      `¡Perfecto, ${firstName(pushName)}! Te esperamos en Crastur.`,
      `📍 ${direccion}`,
      `🗺️ ${maps}`,
      `🕒 ${horario}`,
      'Cuando llegues, menciona el producto que buscabas para atenderte más rápido.'
    ]);
  }

  if (
    norm.includes('consulta directa desde la pagina') ||
    norm.includes('consulta comercial') ||
    norm.includes('cotizar un repuesto') ||
    norm.includes('precio y disponibilidad de un repuesto') ||
    (fromWeb && norm.includes('hacer un pedido') && norm.includes('consultar disponibilidad'))
  ) {
    return compose([
      `¡Hola, ${firstName(pushName)}! Gracias por escribirnos desde la web.`,
      'Dime el repuesto, insumo o modelo de tu moto y te doy precio y disponibilidad.',
      `Precios a tasa BCV: *Bs. ${formatRate(tasa)} / USD*. 💛 Cashea disponible.`
    ]);
  }

  return null;
}

export default {
  runWebIntents
};
