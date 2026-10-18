/**
 * @file stock.ts
 * @description Etiqueta de disponibilidad de stock uniforme para todos los mensajes del bot.
 *
 * [POR QUÉ] Antes, un producto con `stock = 0` (agotado) y otro con `stock = null`
 * (sin dato) se mostraban igual como "Consultar", y el cliente creía que podría retirarlo.
 * Ahora se distinguen agotado, sin dato y disponible.
 */

/**
 * Devuelve la etiqueta de disponibilidad de un producto.
 *
 * @param product - Registro de producto (con campo `stock`)
 * @param disponibleText - Texto a usar cuando hay existencias
 */
export function stockLabel(product: any, disponibleText = 'Disponible para entrega inmediata'): string {
  const raw = product?.stock;
  if (raw === null || raw === undefined || raw === '') return '⚠️ Consultar stock';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '⚠️ Agotado — consulta reposición';
  return `✅ ${disponibleText}`;
}

export default { stockLabel };
