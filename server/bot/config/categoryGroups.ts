/**
 * @file categoryGroups.ts
 * @description Agrupación canónica de categorías comerciales del bot.
 *
 * [PROBLEMA QUE RESUELVE]
 * El panel administrativo permite una taxonomía amplia de 6 categorías y
 * subcategorías del tipo "Lubricantes & Fluidos - Aceites de Motor 4T / 2T",
 * "Repuestos Moto - Tripas y Cauchos" o "Combos & Kits - Promociones".
 * El menú del bot, en cambio, trabaja con 4 categorías canónicas. Sin este
 * mapeo, cualquier producto guardado en una subcategoría (p. ej. un aceite
 * Motul) queda invisible al navegar por el menú, aunque sí lo encuentre la
 * búsqueda difusa por nombre.
 *
 * Este módulo normaliza CUALQUIER categoría del panel a su grupo canónico,
 * de modo que menús, catálogos PDF y respaldos siempre encuentren el producto.
 */

import { db } from '../../database';
import { normalizeText } from '../utils/textUtils';

/** Categorías canónicas visibles en el menú principal del bot (opciones 1 a 4). */
export const CANONICAL_CATEGORIES = [
  'Insumos Cauchera',
  'Repuestos Moto',
  'Accesorios Moto',
  'Otros Productos'
] as const;

export type CanonicalCategory = typeof CANONICAL_CATEGORIES[number];

/**
 * Alias (en texto normalizado: minúsculas y sin tildes) que se agrupan bajo
 * cada categoría canónica. Se evalúan por prefijo respetando límite de palabra.
 */
const GROUP_ALIASES: Record<CanonicalCategory, string[]> = {
  'Insumos Cauchera': [
    'insumos cauchera',
    'insumos para caucheras',
    'insumos para cauchera',
    'caucheras',
    'cauchera'
  ],
  'Repuestos Moto': [
    'repuestos moto',
    'repuestos para moto',
    'repuestos de moto',
    'repuesto moto',
    'repuesto de moto'
  ],
  'Accesorios Moto': [
    'accesorios moto',
    'accesorios para moto',
    'accesorios de moto',
    'accesorio moto',
    'accesorios'
  ],
  'Otros Productos': [
    'otros productos',
    'otro producto',
    'lubricantes y fluidos',
    'lubricantes fluidos',
    'lubricantes',
    'lubricante',
    'aceites y lubricantes',
    'combos y kits',
    'combos kits',
    'combos',
    'kits'
  ]
};

/**
 * Devuelve la categoría canónica a la que pertenece cualquier categoría del panel.
 * Elige el alias coincidente más largo para evitar falsos positivos.
 *
 * @param rawCategory - Categoría tal cual está guardada en la base de datos
 * @returns Categoría canónica o `null` si no se reconoce
 */
export function canonicalCategoryOf(rawCategory: string | null | undefined): CanonicalCategory | null {
  const norm = normalizeText(String(rawCategory || ''));
  if (!norm) return null;

  let best: CanonicalCategory | null = null;
  let bestLen = -1;

  for (const group of CANONICAL_CATEGORIES) {
    for (const alias of GROUP_ALIASES[group]) {
      const a = normalizeText(alias);
      if (!a) continue;
      // Coincidencia exacta o por prefijo con límite de palabra.
      if (norm === a || norm.startsWith(a + ' ')) {
        if (a.length > bestLen) {
          bestLen = a.length;
          best = group;
        }
      }
    }
  }

  return best;
}

/**
 * Obtiene los productos activos que pertenecen a una categoría canónica,
 * sin importar cómo esté subdividida su categoría en el panel.
 *
 * @param canonical - Categoría canónica del bot ('Insumos Cauchera', etc.)
 * @returns Lista de productos activos ordenados por modelo
 */
export function getProductsByCanonicalCategory(canonical: string): any[] {
  const all: any[] = db.prepare('SELECT * FROM products WHERE activo = 1').all();
  return all
    .filter(p => canonicalCategoryOf(p.categoria) === canonical)
    .sort((a, b) => String(a.modelo || '').localeCompare(String(b.modelo || ''), 'es'));
}

export default {
  CANONICAL_CATEGORIES,
  canonicalCategoryOf,
  getProductsByCanonicalCategory
};
