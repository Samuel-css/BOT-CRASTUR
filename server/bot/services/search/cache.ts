/**
 * @file cache.ts
 * @description Caché en memoria del catálogo activo para evitar leer toda la tabla
 * en cada búsqueda. Se invalida al crear, editar o importar productos.
 */

import { db } from '../../../database';

let productCache: any[] | null = null;
let productCacheAt = 0;
const PRODUCT_CACHE_TTL_MS = 30 * 1000;

/** Fuerza la recarga del catálogo en la próxima búsqueda. */
export function invalidateProductCache(): void {
  productCache = null;
  productCacheAt = 0;
}

/** Retorna el catálogo activo desde caché (o lo recarga si expiró). */
export function getActiveProducts(): any[] {
  const now = Date.now();
  if (!productCache || (now - productCacheAt) > PRODUCT_CACHE_TTL_MS) {
    productCache = db.prepare('SELECT * FROM products WHERE activo = 1').all();
    productCacheAt = now;
  }
  return productCache;
}
