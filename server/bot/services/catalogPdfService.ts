/**
 * @file catalogPdfService.ts
 * @description BARRIL del generador de catálogos PDF. La implementación está dividida en
 * `services/catalogPdf/`:
 *   - config.ts  → rutas de disco (data/catalogs y logo).
 *   - data.ts    → categorías canónicas, consulta de productos y QR de Maps.
 *   - layout.ts  → encabezado, fichas de producto y pie de página.
 *   - pdf.ts     → construcción, caché y entrega del PDF.
 *
 * Se conserva esta fachada para no cambiar los imports existentes.
 */

export { resolveCanonicalCategory } from './catalogPdf/data';
export { getCategoryCatalogPdf, clearCatalogCache } from './catalogPdf/pdf';

import { resolveCanonicalCategory } from './catalogPdf/data';
import { getCategoryCatalogPdf, clearCatalogCache } from './catalogPdf/pdf';

export default {
  resolveCanonicalCategory,
  getCategoryCatalogPdf,
  clearCatalogCache
};
