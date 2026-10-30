/**
 * @file productTypes.ts
 * @description Catálogo canónico de tipos de productos y calificadores de contexto automotriz.
 *
 * Permite al buscador diferenciar entre el sustantivo buscado (ej: 'aceite')
 * y el calificador o compatibilidad vehicular (ej: 'moto', 'repuestos').
 *
 * [NORMALIZACIÓN OBLIGATORIA]
 * Igual que `synonyms.ts`, todas las entradas se normalizan con `normalizeText()`.
 * Así `piñón` y `puño` funcionan aunque el mensaje del cliente llegue sin tilde.
 */

import { normalizeText } from '../utils/textUtils';

/** Conjunto legible de sustantivos automotrices específicos comercializados por Crastur. */
const RAW_PRODUCT_TYPES: string[] = [
  // 🛢️ Aceites, lubricantes y fluidos
  'aceite', 'aceites', 'lubricante', 'lubricantes', 'aditivo', 'aditivos',
  'refrigerante', 'refrigerantes', 'coolant', 'grasa', 'grasas', 'liga', 'ligas',

  // ⚡ Encendido
  'bujia', 'bujias', 'bobina', 'bobinas', 'cdi', 'estator', 'magneto',
  'regulador', 'rectificador', 'bateria', 'baterias', 'acumulador',
  'bendix', 'arranque', 'inyector', 'inyectores',

  // 🛑 Sistema de frenos
  'pastilla', 'pastillas', 'balata', 'balatas', 'banda', 'bandas', 'freno', 'frenos',
  'zapata', 'zapatas', 'disco', 'discos',

  // ⛓️ Transmisión y kit de arrastre
  'arrastre', 'cadena', 'cadenas', 'piñon', 'piñones', 'corona', 'coronas',
  'catalina', 'sprocket', 'tensor', 'tensores', 'chaveta', 'chavetas',

  // 🛞 Cauchera, tripas y parches
  'tripa', 'tripas', 'camara', 'camaras',
  'parche', 'parches', 'pega', 'pegamento', 'cemento',
  'valvula', 'valvulas', 'gusanillo', 'gusanillos',
  'tarugo', 'tarugos', 'mecha', 'mechas',
  'plomo', 'plomos', 'balanceo', 'contrapeso', 'contrapesos',
  'sellador', 'pasta', 'aguja', 'agujas', 'terraja', 'terrajas',
  'rodillo', 'rodillos', 'manometro', 'calibrador',

  // 🏍️ Neumáticos y cauchos
  'caucho', 'cauchos', 'llanta', 'llantas', 'neumatico', 'neumaticos',
  'sellomatic', 'goma', 'gomas', 'cubierta', 'cubiertas',

  // 🎽 Cascos y seguridad (productos de la web)
  'casco', 'cascos', 'coraza', 'corazas', 'guante', 'guantes',

  // 🔋 Electricidad y luces
  'fusible', 'fusibles', 'bombillo', 'bombillos', 'faro', 'faros',
  'led', 'luces', 'luz', 'direccional', 'direccionales', 'stop', 'relay',
  'switch', 'bocina', 'bocinas', 'pito', 'pitos',

  // ⚙️ Transmisión interna y mandos
  'guaya', 'guayas', 'croche', 'clutch', 'embrague',
  'puño', 'puños', 'maneta', 'manetas', 'manubrio', 'manubrios',

  // 🛡️ Accesorios
  'retrovisor', 'retrovisores', 'espejo', 'espejos',
  'malla', 'mallas', 'pulpo', 'pulpos', 'candado', 'candados',
  'plumilla', 'plumillas', 'limpiaparabrisas', 'cepillo', 'cepillos',
  'silicon', 'silicona', 'impermeable', 'parabrisas',
  'soporte', 'soportes', 'portacasco',

  // ⚙️ Motor y suspensión
  'filtro', 'filtros', 'piston', 'pistones', 'anillos', 'segmentos',
  'culata', 'culatas', 'empaque', 'empaques', 'junta', 'juntas',
  'manguera', 'mangueras', 'radiador', 'radiadores', 'termostato',
  'horquilla', 'horquillas', 'amortiguador', 'amortiguadores',
  'suspension', 'suspensiones', 'reten', 'retenes',
  'rodamiento', 'rodamientos', 'ruleman', 'rulemanes',
  'ciguenal', 'ciguenales',

  // 🔩 Tornillería, cables y componentes
  'tornillo', 'tornillos', 'tuerca', 'tuercas', 'arandela', 'arandelas',
  'abrazadera', 'abrazaderas', 'remache', 'remaches', 'cable', 'cables',
  'sensor', 'sensores', 'bomba', 'bombas', 'carburador', 'carburadores',
  'cilindro', 'cilindros', 'biela', 'bielas', 'eje', 'ejes',
  'grifo', 'grifos', 'cinta', 'cintas', 'velocimetro', 'tacometro',
  'inflador', 'compresor', 'engrasadora'
];

/** Palabras que denotan categorías amplias o tipos de vehículos, no productos específicos. */
const RAW_QUALIFIERS: string[] = [
  'moto', 'motos', 'motocicleta', 'motocicletas',
  'carro', 'carros', 'auto', 'autos', 'automovil', 'automoviles',
  'vehiculo', 'vehiculos', 'burra', 'burras', 'fierro', 'fierros',
  'cauchera', 'caucheras', 'llanteras',
  'repuesto', 'repuestos', 'accesorio', 'accesorios',
  'articulo', 'articulos', 'producto', 'productos'
];

/** Normaliza un arreglo de términos y elimina duplicados/vacíos. */
function toNormalizedSet(entries: string[]): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeText(entry);
    if (normalized) set.add(normalized);
  }
  return set;
}

export const PRODUCT_TYPES: Set<string> = toNormalizedSet(RAW_PRODUCT_TYPES);
export const QUALIFIERS: Set<string> = toNormalizedSet(RAW_QUALIFIERS);

export default {
  PRODUCT_TYPES,
  QUALIFIERS
};
