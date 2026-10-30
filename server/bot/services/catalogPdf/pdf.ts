/**
 * @file pdf.ts
 * @description Construcción, caché en disco y entrega del catálogo PDF por categoría.
 */

import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { getSettings, getEffectiveRate } from '../../../database';
import { catalogsDir } from './config';
import { resolveCanonicalCategory, getProductsForCategory, generateMapsQrBuffer } from './data';
import { drawHeader, drawFooter, drawSpaciousProductRow } from './layout';

export async function getCategoryCatalogPdf(categoryInput: any, options: { forceRefresh?: boolean } = {}) {
  const categoryInfo = resolveCanonicalCategory(categoryInput);
  const products = getProductsForCategory(categoryInfo.key);

  if (!products || products.length === 0) {
    return {
      success: false,
      reason: 'no_products',
      categoryTitle: categoryInfo.title,
      count: 0
    };
  }

  const rate = getEffectiveRate();
  const settings = getSettings();
  const rateRounded = rate ? Number(rate).toFixed(2) : '0.00';

  // Clave de caché basada en categoría, tasa BCV y total de ítems
  const cacheKey = `catalogo_${categoryInfo.slug}_bcv_${rateRounded}_n${products.length}.pdf`;
  const filePath = path.join(catalogsDir, cacheKey);

  // Si ya existe en caché y no se pide forzar recreación, devolverlo inmediatamente (0ms)
  if (!options.forceRefresh && fs.existsSync(filePath)) {
    return {
      success: true,
      filePath,
      fileName: `Catalogo_Crastur_${categoryInfo.slug}.pdf`,
      categoryTitle: categoryInfo.title,
      count: products.length,
      fromCache: true
    };
  }

  // Generar nuevo PDF
  await buildCatalogPdf(filePath, categoryInfo, products, rate, settings);

  return {
    success: true,
    filePath,
    fileName: `Catalogo_Crastur_${categoryInfo.slug}.pdf`,
    categoryTitle: categoryInfo.title,
    count: products.length,
    fromCache: false
  };
}

/**
 * Renderizado del documento PDF usando PDFKit con tipografía grande, respiro visual y sin colisiones
 */
export async function buildCatalogPdf(outputPath, categoryInfo, products, rate, settings) {
  return new Promise(async (resolve, reject) => {
    try {
      const qrBuffer = await generateMapsQrBuffer(settings.google_maps_url);

      // Dimensiones de página Letter: 612 x 792 pt
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: true,
        autoFirstPage: false
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // 3 tarjetas por página: máxima legibilidad en móviles con tipografía grande (11-17 pt)
      const itemsPerPage = 3;
      const totalPages = Math.ceil(products.length / itemsPerPage);

      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 32; // Margen lateral generoso de 32 pt
      const contentWidth = pageWidth - (margin * 2); // 548 pt útiles

      // Formato de fecha actual
      const todayStr = new Date().toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      for (let pIdx = 0; pIdx < totalPages; pIdx++) {
        doc.addPage();
        const pageNum = pIdx + 1;

        // 1. HEADER CORPORATIVO (Contenedor unificado sin colisión con banner)
        drawHeader(doc, margin, contentWidth, categoryInfo, rate, todayStr, products.length);

        // 2. PRODUCTOS EN TARJETAS AMPLIAS Y LEGIBLES
        const startItem = pIdx * itemsPerPage;
        const pageProducts = products.slice(startItem, startItem + itemsPerPage);

        const cardHeight = 166; // Altura generosa con espacio para tipografía grande
        const cardGap = 16;     // 16 pt de separación real entre tarjetas
        const startY = 146;     // Debajo del banner con 14 pt de respiro (104 + 28 + 14 = 146)

        pageProducts.forEach((prod, idx) => {
          const cardY = startY + idx * (cardHeight + cardGap);
          drawSpaciousProductRow(doc, prod, margin, cardY, contentWidth, cardHeight, rate, settings);
        });

        // 3. FOOTER
        drawFooter(doc, margin, contentWidth, pageHeight, pageNum, totalPages, qrBuffer, settings);
      }

      doc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Dibuja el encabezado corporativo con tarjeta unificada y sin colisiones con el banner inferior
 */
export function clearCatalogCache() {
  try {
    if (fs.existsSync(catalogsDir)) {
      const files = fs.readdirSync(catalogsDir);
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          fs.unlinkSync(path.join(catalogsDir, file));
        }
      }
      console.log('[CatalogPDF] 🧹 Caché de catálogos PDF limpiado.');
    }
  } catch (e) {
    console.warn('[CatalogPDF] Error limpiando caché:', e.message);
  }
}

