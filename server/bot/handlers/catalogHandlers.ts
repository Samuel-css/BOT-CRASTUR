/**
 * @file catalogHandlers.ts
 * @description Menú y entrega de catálogos en PDF.
 */

import { db } from '../../database';
import { getCategoryCatalogPdf } from '../services/catalogPdfService';
import { formatRate } from '../utils/formatters';
import { compose } from '../copy/messages';

/**
 * Menú de catálogos PDF, sin párrafos de venta.
 */
export function handleCatalogMenuResponse(
  settings: Record<string, string>,
  tasa: number,
  session?: any,
  jid?: string
): string {
  if (jid) {
    try {
      db.prepare("UPDATE chat_sessions SET step = 'catalogo_esperando_opcion' WHERE jid = ?").run(jid);
    } catch (e) {}
  }

  return compose([
    '📄 *Catálogos en PDF*',
    '1 Insumos Cauchera',
    '2 Repuestos Moto',
    '3 Accesorios Moto',
    '4 Lubricantes y Otros',
    '5 Catálogo completo',
    '',
    'Responde el número y te envío el PDF al instante.'
  ]);
}

/**
 * Genera y entrega el PDF de una categoría.
 */
export async function handleCatalogPdfDelivery(
  categoryInput: string,
  settings: Record<string, string>,
  tasa: number,
  session?: any,
  jid?: string
): Promise<any> {
  let result: any = null;
  try {
    result = await getCategoryCatalogPdf(categoryInput);
  } catch (err: any) {
    console.error('[Catálogo PDF] Error generando el catálogo:', err?.message || err);
    result = { success: false };
  }

  if (!result || !result.success) {
    return compose([
      `📄 No pude generar el catálogo de *${result?.categoryTitle || categoryInput}* en este momento.`,
      'Dime el repuesto exacto que buscas y te confirmo disponibilidad.',
      'Si prefieres, escribe *ASESOR* y te paso con una persona.'
    ]);
  }

  if (jid) {
    try {
      db.prepare(`
        UPDATE chat_sessions
        SET step = 'start',
            ultimo_producto_nombre = ?,
            seguimiento_enviado = 0
        WHERE jid = ?
      `).run(`Catálogo ${result.categoryTitle}`, jid);
    } catch (e) {}
  }

  const caption = compose([
    `📄 *Catálogo: ${result.categoryTitle}*`,
    `✅ ${result.count} productos disponibles para retiro o delivery en Caracas.`,
    `🇻🇪 Precios a tasa BCV: *Bs. ${formatRate(tasa)} / USD*. 💛 Cashea disponible.`,
    `🏢 ${settings.direccion_tienda || 'Edificio Liberalba, San Agustín Norte, Caracas'}.`,
    'Responde *APARTAR* o el nombre del repuesto para reservarlo 24 h.'
  ]);

  return {
    document: result.filePath,
    fileName: result.fileName,
    caption
  };
}

export default {
  handleCatalogMenuResponse,
  handleCatalogPdfDelivery
};
