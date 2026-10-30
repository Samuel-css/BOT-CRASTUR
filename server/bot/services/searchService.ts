/**
 * @file searchService.ts
 * @description BARRIL del motor de búsqueda. La implementación está dividida en
 * `services/search/`:
 *   - cache.ts    → caché del catálogo activo e invalidación.
 *   - fuzzy.ts    → normalización, sinónimos y búsqueda difusa ponderada.
 *   - quantity.ts → extracción de cantidades sin confundir medidas.
 *   - multi.ts    → consultas con varios productos.
 *
 * Se conserva esta fachada para no cambiar los imports existentes.
 */

export {
  searchProductsFuzzy,
  searchByProductType
} from './search/fuzzy';
export { searchMultipleProducts } from './search/multi';
export { extractLeadingQuantity } from './search/quantity';
export { invalidateProductCache } from './search/cache';

import { searchProductsFuzzy, searchByProductType } from './search/fuzzy';
import { searchMultipleProducts } from './search/multi';
import { extractLeadingQuantity } from './search/quantity';
import { invalidateProductCache } from './search/cache';

export default {
  searchProductsFuzzy,
  searchMultipleProducts,
  searchByProductType,
  extractLeadingQuantity,
  invalidateProductCache
};
