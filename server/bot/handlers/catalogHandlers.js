const { db } = require('../../database');
const { formatRate } = require('../utils/formatters');
const { getCategoryCatalogPdf, resolveCanonicalCategory } = require('../services/catalogPdfService');

/**
 * Menú interactivo de selección de catálogo en PDF
 */
function handleCatalogMenuResponse(settings, tasa, session, jid) {
  // Guardar estado en sesión para responder ante selecciones numéricas 1..5
  if (jid) {
    try {
      db.prepare("UPDATE chat_sessions SET step = 'menu_catalogo_pdf' WHERE jid = ?").run(jid);
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
 * Despacho del documento PDF de una categoría específica
 */
async function handleCatalogPdfDelivery(categoryInput, settings, tasa, session, jid) {
  const result = await getCategoryCatalogPdf(categoryInput);

  if (!result || !result.success) {
    let msg = `📄 *Catálogo Crastur* 🛞🏍️\n\n`;
    msg += `En este momento estamos actualizando los artículos de *${result?.categoryTitle || categoryInput}*.\n\n`;
    msg += `👉 Escribe el modelo o pieza exacta que necesitas para confirmarte disponibilidad en tienda física.\n`;
    msg += `👉 O escribe *VENDEDOR* para que nuestro mostrador te cotice de inmediato. 👨‍🔧`;
    return msg;
  }

  // Actualizar sesión tras entrega de catálogo
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

  const nombreNegocio = settings.nombre_negocio || 'Crastur';
  let caption = `📄 *Catálogo Oficial: ${result.categoryTitle}* 🛞🏍️\n\n`;
  caption += `✅ *${result.count} productos disponibles* para retiro hoy en tienda física o delivery en Caracas.\n`;
  caption += `🇻🇪 Precios actualizados a Tasa Oficial BCV: *Bs. ${formatRate(tasa)}*.\n`;
  caption += `💛 Disponible financiamiento *Cashea* en tienda física.\n\n`;
  caption += `🏢 *Tienda Física:* Edificio Liberalba, Av. Sur 9, San Agustín Norte, Caracas.\n`;
  caption += `🛵 *Delivery disponible* en Caracas y envíos a toda Venezuela (Zoom / Tealca / MRW).\n\n`;
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

module.exports = {
  handleCatalogMenuResponse,
  handleCatalogPdfDelivery
};
