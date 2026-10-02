/**
 * @file productTypes.ts
 * @description Catálogo canónico de tipos de productos y calificadores de contexto automotriz.
 * 
 * Permite al buscador diferenciar entre el sustantivo buscado (ej: 'aceite')
 * y el calificador o compatibilidad vehicular (ej: 'moto', 'repuestos').
 */

/** Conjunto de sustantivos automotrices específicos comercializados por Crastur */
export const PRODUCT_TYPES: Set<string> = new Set([
  // 🛢️ Aceites, lubricantes y fluidos
  'aceite', 'aceites', 'lubricante', 'lubricantes', 'aditivo', 'aditivos',
  'refrigerante', 'refrigerantes', 'coolant', 'grasa', 'grasas', 'liga', 'ligas',

  // ⚡ Bujías
  'bujia', 'bujias',

  // 🛑 Sistema de frenos
  'pastilla', 'pastillas', 'balata', 'balatas', 'banda', 'bandas', 'freno', 'frenos',

  // ⛓️ Transmisión y kit de arrastre
  'arrastre', 'cadena', 'cadenas', 'piñon', 'piñones', 'corona', 'coronas', 'catalina',

  // 🛞 Cauchera, tripas y parches
  'tripa', 'tripas', 'camara', 'camaras',
  'parche', 'parches', 'pega', 'pegamento', 'cemento',
  'valvula', 'valvulas', 'gusanillo', 'gusanillos',
  'tarugo', 'tarugos', 'mecha', 'mechas',
  'plomo', 'plomos', 'balanceo', 'contrapeso', 'contrapesos',
  'sellador', 'pasta',

  // 🏍️ Neumáticos y cauchos
  'caucho', 'cauchos', 'llanta', 'llantas', 'neumatico', 'neumaticos', 'sellomatic',

  // 🎽 Cascos y seguridad (productos de la web)
  'casco', 'cascos', 'coraza', 'corazas',

  // 🔋 Electricidad y encendido
  'bateria', 'baterias', 'acumulador', 'fusible', 'fusibles',
  'bombillo', 'bombillos', 'faro', 'faros', 'led', 'luces', 'luz',

  // ⚙️ Transmisión interna y mandos
  'guaya', 'guayas', 'croche', 'clutch', 'embrague',
  'puño', 'puños', 'gomas',

  // 🛡️ Accesorios
  'retrovisor', 'retrovisores', 'espejo', 'espejos',
  'malla', 'mallas', 'pulpo', 'pulpos', 'candado', 'candados',
  'plumilla', 'plumillas', 'limpiaparabrisas', 'cepillo', 'cepillos',
  'silicon', 'silicona'
]);

/** Palabras que denotan categorías amplias o tipos de vehículos, no productos específicos */
export const QUALIFIERS: Set<string> = new Set([
  'moto', 'motos', 'motocicleta', 'motocicletas',
  'carro', 'carros', 'auto', 'autos', 'automovil', 'automoviles', 'vehiculo', 'vehiculos',
  'cauchera', 'caucheras', 'llanteras',
  'repuesto', 'repuestos', 'accesorio', 'accesorios', 'articulo', 'articulos', 'producto', 'productos'
]);

export default {
  PRODUCT_TYPES,
  QUALIFIERS
};
