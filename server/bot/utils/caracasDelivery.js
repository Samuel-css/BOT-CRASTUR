const { normalizeText } = require('./textUtils');

const DEFAULT_ZONES = [
  {
    id: 'centro',
    keywords: ['san agustin', 'centro', 'candelaria', 'bellas artes', 'parque central', 'silencio', 'av bolivar', 'av lecuna', 'av urdaneta', 'la hoyada', 'quinta crespo', 'plaza venezuela', 'plaza vzla', 'plz vzla', 'parque carabobo'],
    nombre: 'Centro / San Agustín / Bellas Artes / Candelaria / Plaza Venezuela',
    tarifa: '$2 a $3 USD'
  },
  {
    id: 'chacao',
    keywords: ['chacao', 'altamira', 'palos grandes', 'bello campo', 'el rosal', 'campo alegre', 'castellana', 'chuao', 'country club'],
    nombre: 'Municipio Chacao (Altamira / El Rosal / Los Palos Grandes / Las Mercedes)',
    tarifa: '$3 a $4 USD'
  },
  {
    id: 'oeste',
    keywords: ['catia', '23 de enero', 'propatria', 'agua salud', 'el paraiso', 'montalban', 'san martin', 'antimano', 'la vega'],
    nombre: 'Oeste de Caracas (Catia / 23 de Enero / El Paraíso / Montalbán)',
    tarifa: '$3 a $4 USD'
  },
  {
    id: 'sur',
    keywords: ['el valle', 'coche', 'santa monica', 'los chaguaramos', 'san pedro', 'el cementerio'],
    nombre: 'Sur de Caracas (El Valle / Coche / Santa Mónica / Los Chaguaramos)',
    tarifa: '$3 a $4 USD'
  },
  {
    id: 'baruta',
    keywords: ['las mercedes', 'bello monte', 'baruta', 'cafetal', 'prados del este', 'cumbres de curumo', 'santa fe', 'manzanares', 'el penon', 'trinidad'],
    nombre: 'Municipio Baruta (Las Mercedes / El Cafetal / Prados del Este / La Trinidad)',
    tarifa: '$3 a $4 USD'
  },
  {
    id: 'sucre',
    keywords: ['petare', 'palo verde', 'dos caminos', 'los ruices', 'la urbina', 'el marques', 'macaracuay', 'boleita', 'sebucan', 'california'],
    nombre: 'Municipio Sucre (Petare / La Urbina / Los Ruices / El Marqués / Palo Verde)',
    tarifa: '$4 a $5 USD'
  },
  {
    id: 'caricuao',
    keywords: ['caricuao', 'ruiz pineda', 'macarao', 'zoologico'],
    nombre: 'Suroeste de Caracas (Caricuao / Ruiz Pineda / Macarao)',
    tarifa: '$4 a $5 USD'
  },
  {
    id: 'hatillo',
    keywords: ['el hatillo', 'lagunita', 'naranjos', 'la boyera', 'oripoto'],
    nombre: 'Municipio El Hatillo (La Lagunita / Los Naranjos / La Boyera)',
    tarifa: '$4 a $5 USD'
  },
  {
    id: 'adyacentes',
    keywords: ['san antonio', 'los teques', 'carrizal', 'altos mirandinos', 'la guaira', 'vargas', 'catia la mar', 'maiquetia', 'guarenas', 'guatire'],
    nombre: 'Zonas Adyacentes (Altos Mirandinos / La Guaira / Guarenas - Guatire)',
    tarifa: 'Consultar tarifa especial con motorizado'
  }
];

/**
 * Obtiene las zonas de delivery configuradas o las por defecto
 */
function getDeliveryZones(settings) {
  if (settings && settings.delivery_zonas_json) {
    try {
      const parsed = JSON.parse(settings.delivery_zonas_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {}
  }
  return DEFAULT_ZONES;
}

/**
 * Detecta zonas de Caracas en el texto y devuelve la tarifa estimada de motorizado
 */
function detectCaracasZone(text, settings = null) {
  const norm = normalizeText(text);
  const zones = getDeliveryZones(settings);

  for (const z of zones) {
    const kws = Array.isArray(z.keywords) ? z.keywords : (z.keywords || '').split(',').map(s => s.trim());
    for (const kw of kws) {
      if (kw && norm.includes(normalizeText(kw))) {
        return z;
      }
    }
  }

  return null;
}

module.exports = {
  DEFAULT_ZONES,
  getDeliveryZones,
  detectCaracasZone
};
