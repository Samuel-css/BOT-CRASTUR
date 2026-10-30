/**
 * @file productHandlers.ts
 * @description BARRIL de respuestas de catálogo. La implementación está dividida en
 * `handlers/product/`:
 *   - detail.ts            → ficha individual de producto.
 *   - crossSell.ts         → sugerencias de complementos reales del inventario.
 *   - listing.ts           → listados y cotización de combos/carrito.
 *   - contextSelection.ts  → selección por número, quitar del combo y total.
 *   - combos.ts            → promociones de Instagram.
 *
 * Se conserva esta fachada para no cambiar los imports del router.
 */

export { handleSingleProductDetail } from './product/detail';
export { handleProductResults, handleMultiProductResults } from './product/listing';
export { handleContextualSelection } from './product/contextSelection';
export { handleInstagramCombosResponse } from './product/combos';

import { handleSingleProductDetail } from './product/detail';
import { handleProductResults, handleMultiProductResults } from './product/listing';
import { handleContextualSelection } from './product/contextSelection';
import { handleInstagramCombosResponse } from './product/combos';

export default {
  handleSingleProductDetail,
  handleProductResults,
  handleMultiProductResults,
  handleContextualSelection,
  handleInstagramCombosResponse
};
