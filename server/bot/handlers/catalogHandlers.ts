/**
 * @file catalogHandlers.ts
 * @description Manejadores para el menú interactivo y la entrega de catálogos en formato PDF.
 */

import { db } from '../../database';
import { formatRate } from '../utils/formatters';
import { getCategoryCatalogPdf, resolveCanonicalCategory } from '../services/catalogPdfService';
import type { BotResponse } from '../../types/bot';

/**
 * Muestra el menú interactivo con las 5 opciones de catálogos oficiales disponibles en PDF.
 * Actualiza el paso (`step`) de la sesión de chat a `catalogo_esperando_opcion`.
 * 
 * @param settings - Configuración general de la tienda
 * @param tasa - Tasa BCV oficial del día
 * @param session - Registro de la sesión de chat activa
 * @param jid - JID destinatario
 * @returns Mensaje con opciones del menú en PDF
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

  let msg = `📄 *Catálogos Oficiales en PDF - Crastur* 🛞🏍️✨\n\n`;
  msg += `Te enviamos directamente el documento PDF con fotos, fichas técnicas, precios en divisas y Bolívares a tasa oficial BCV (*Bs. ${formatRate(tasa)}*) y cuotas Cashea 💛.\n\n`;
  msg += `👉 *¿Cuál catálogo en PDF deseas recibir?*\n\n`;
  msg += `1️⃣ *Insumos para Caucheras* (Parches, válvulas, pegas, herramientas)\n`;
  msg += `2️⃣ *Repuestos para Moto* (Kits de arrastre, pastillas, bujías, bandas)\n`;
  msg += `3️⃣ *Accesorios para Moto* (Luces LED, guantes, candados, retrovisores)\n`;
  msg += `4️⃣ *Lubricantes y Otros* (Aceites Motul, spray de cadena, aditivos)\n`;
  msg += `5️⃣ *Catálogo Completo* (Todo el inventario disponible)\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👉 Responde con el *número* (ej: *1* o *2*) para enviarte el archivo PDF al instante.\n`;
  msg += `👉 O escribe el nombre específico del repuesto que buscas para confirmarte existencia en almacén.`;

  return msg;
}

/**
 * Genera y entrega el archivo binario PDF correspondiente a una categoría solicitada.
 * 
 * @param categoryInput - Nombre o identificador de categoría
 * @param settings - Configuración general
 * @param tasa - Tasa BCV oficial
 * @param session - Sesión de chat
 * @param jid - JID destinatario
 * @returns Objeto con payload del documento PDF, nombre de archivo y pie de foto (caption)
 */
export async function handleCatalogPdfDelivery(
  categoryInput: string,
  settings: Record<string, string>,
  tasa: number,
  session?: any,
  jid?: string
): Promise<any> {
  const result = await getCategoryCatalogPdf(categoryInput);

  if (!result || !result.success) {
    let msg = `📄 *Catálogo Crastur* 🛞🏍️\n\n`;
    msg += `En este momento estamos actualizando los artículos de *${result?.categoryTitle || categoryInput}*.\n\n`;
    msg += `👉 Escribe el modelo o pieza exacta que necesitas para confirmarte disponibilidad en tienda física.\n`;
    msg += `👉 O escribe *VENDEDOR* para que nuestro mostrador te cotice de inmediato. 👨‍🔧`;
    return msg;
  }

  // Restablecer el estado de la sesión tras completar la entrega
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

  let caption = `📄 *Catálogo Oficial: ${result.categoryTitle}* 🛞🏍️\n\n`;
  caption += `✅ *${result.count} productos disponibles* para retiro hoy en tienda física o delivery en Caracas.\n`;
  caption += `🇻🇪 Precios actualizados a Tasa Oficial BCV: *Bs. ${formatRate(tasa)}*.\n`;
  caption += `💛 Disponible financiamiento *Cashea* en tienda física.\n\n`;
  caption += `🏢 *Tienda Física:* Edificio Liberalba, Av. Sur 9, San Agustín Norte, Caracas.\n`;
  caption += `🛵 *Delivery disponible* en Caracas (envío en moto el mismo día).\n\n`;
  caption += `━━━━━━━━━━━━━━━━━━━━━\n`;
  caption += `👉 Escribe *APARTAR* o el nombre del repuesto para reservarlo por 24 horas sin costo.\n`;
  caption += `👉 Escribe *DELIVERY* para cotizar envío en moto a tu zona.\n`;
  caption += `👉 Escribe *VENDEDOR* para hablar con nuestro mostrador.`;

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
