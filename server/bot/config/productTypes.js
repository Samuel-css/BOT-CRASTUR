// Categorización de tipos de productos específicos para Crastur
// Permite al buscador diferenciar entre el sustantivo buscado (ej: aceite)
// y el calificador o compatibilidad vehicular (ej: moto, repuestos).

const PRODUCT_TYPES = new Set([
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

// Palabras que representan vehículos o categorías amplias, NO un producto específico
const QUALIFIERS = new Set([
  'moto', 'motos', 'motocicleta', 'motocicletas',
  'carro', 'carros', 'auto', 'autos', 'automovil', 'automoviles', 'vehiculo', 'vehiculos',
  'cauchera', 'caucheras', 'llanteras',
  'repuesto', 'repuestos', 'accesorio', 'accesorios', 'articulo', 'articulos', 'producto', 'productos'
]);

module.exports = {
  PRODUCT_TYPES,
  QUALIFIERS
};
