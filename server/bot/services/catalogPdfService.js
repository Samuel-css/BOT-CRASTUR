const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { db, getSettings, getEffectiveRate } = require('../../database');
const { formatBs, formatRate } = require('../utils/formatters');

// Directorio para almacenar PDFs cacheados
const catalogsDir = path.join(__dirname, '..', '..', '..', 'data', 'catalogs');
if (!fs.existsSync(catalogsDir)) {
  fs.mkdirSync(catalogsDir, { recursive: true });
}

// Ruta al logo oficial de la empresa
const logoPath = path.join(__dirname, '..', '..', '..', 'client', 'public', 'logo_icon.png');

/**
 * Normaliza y mapea categorías del bot a nombres canónicos oficiales
 */
function resolveCanonicalCategory(input) {
  if (!input) return { key: 'Todos', title: 'Catálogo General Completo', slug: 'general' };
  const norm = String(input).toLowerCase().trim();

  if (
    norm === '1' ||
    norm === '1️⃣' ||
    norm.includes('cauchera') ||
    norm.includes('caucho') ||
    norm.includes('parche') ||
    norm.includes('valvula') ||
    norm.includes('insumo')
  ) {
    return { key: 'Insumos Cauchera', title: 'Insumos para Caucheras', slug: 'insumos_cauchera' };
  }

  if (
    norm === '2' ||
    norm === '2️⃣' ||
    norm.includes('repuesto') ||
    norm.includes('arrastre') ||
    norm.includes('freno') ||
    norm.includes('pastilla') ||
    norm.includes('bujia') ||
    norm.includes('cadena') ||
    norm.includes('corona') ||
    norm.includes('pinon')
  ) {
    return { key: 'Repuestos Moto', title: 'Repuestos para Moto', slug: 'repuestos_moto' };
  }

  if (
    norm === '3' ||
    norm === '3️⃣' ||
    norm.includes('accesorio') ||
    norm.includes('casco') ||
    norm.includes('guante') ||
    norm.includes('luz') ||
    norm.includes('led') ||
    norm.includes('retrovisor')
  ) {
    return { key: 'Accesorios Moto', title: 'Accesorios para Moto', slug: 'accesorios_moto' };
  }

  if (
    norm === '4' ||
    norm === '4️⃣' ||
    norm.includes('otro') ||
    norm.includes('aceite') ||
    norm.includes('lubricante') ||
    norm.includes('motul')
  ) {
    return { key: 'Otros Productos', title: 'Lubricantes y Otros Productos', slug: 'otros_productos' };
  }

  if (
    norm === '5' ||
    norm === '5️⃣' ||
    norm.includes('todo') ||
    norm.includes('completo') ||
    norm.includes('general') ||
    norm.includes('catalogo')
  ) {
    return { key: 'Todos', title: 'Catálogo General de Productos', slug: 'catalogo_general' };
  }

  return { key: input, title: `Catálogo: ${input}`, slug: input.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() };
}

/**
 * Consulta los productos de la categoría desde la base de datos
 */
function getProductsForCategory(categoryKey) {
  if (categoryKey === 'Todos') {
    return db.prepare(`
      SELECT * FROM products 
      WHERE activo = 1 
      ORDER BY categoria ASC, modelo ASC
    `).all();
  }

  return db.prepare(`
    SELECT * FROM products
    WHERE activo = 1 AND (
      categoria = ? OR
      categoria LIKE ? OR
      categoria LIKE ?
    )
    ORDER BY modelo ASC
  `).all(categoryKey, `${categoryKey} - %`, `${categoryKey}%`);
}

/**
 * Genera el buffer del código QR para la ubicación en Google Maps
 */
async function generateMapsQrBuffer(mapsUrl) {
  try {
    const url = mapsUrl || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA';
    return await QRCode.toBuffer(url, {
      margin: 1,
      width: 140,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      }
    });
  } catch (e) {
    console.warn('[CatalogPDF] Error generando QR:', e.message);
    return null;
  }
}

/**
 * Genera o recupera de caché el catálogo PDF para una categoría dada
 */
async function getCategoryCatalogPdf(categoryInput, options = {}) {
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
  const rateRounded = rate ? parseFloat(rate).toFixed(2) : '0.00';

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
async function buildCatalogPdf(outputPath, categoryInfo, products, rate, settings) {
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
function drawHeader(doc, margin, contentWidth, categoryInfo, rate, todayStr, totalCount) {
  const topY = 22;

  // Barra de acento superior naranja automotriz
  doc.rect(margin, topY, contentWidth, 3.5)
     .fill('#EA580C');

  // Contenedor del Encabezado Corporativo (Y=30 a Y=92)
  const headerY = topY + 8;
  const headerH = 62;
  const logoSize = 46;

  // Fondo suave para el bloque de marca
  doc.roundedRect(margin, headerY, contentWidth, headerH, 6)
     .fillAndStroke('#FFFFFF', '#E2E8F0');

  // Logo en marco limpio dentro de su contenedor
  const logoBoxX = margin + 8;
  const logoBoxY = headerY + 8;
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, logoBoxX, logoBoxY, { width: logoSize, height: logoSize });
    } catch (e) {}
  }

  // Textos de Marca Crastur
  const brandX = logoBoxX + logoSize + 12;
  doc.fillColor('#0F172A')
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('CRASTUR', brandX, headerY + 10, { lineBreak: false });

  doc.fillColor('#EA580C')
     .font('Helvetica-Bold')
     .fontSize(7.5)
     .text('REPUESTOS PARA MOTO & INSUMOS PARA CAUCHERAS', brandX, headerY + 28, { lineBreak: false });

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(7.2)
     .text('Tienda Física: Edif. Liberalba, Av. Sur 9, San Agustín Norte, Caracas', brandX, headerY + 41, { lineBreak: false });

  // Widget BCV y Fecha (Lado derecho del contenedor de cabecera)
  const bcvBoxW = 185;
  const bcvBoxX = margin + contentWidth - bcvBoxW - 8;
  const bcvBoxY = headerY + 8;
  const bcvBoxH = headerH - 16;

  doc.roundedRect(bcvBoxX, bcvBoxY, bcvBoxW, bcvBoxH, 4)
     .fillAndStroke('#F8FAFC', '#CBD5E1');

  doc.fillColor('#0F172A')
     .font('Helvetica-Bold')
     .fontSize(9.5)
     .text(`Tasa Oficial BCV: Bs. ${formatRate(rate)}`, bcvBoxX + 8, bcvBoxY + 7, {
       width: bcvBoxW - 16,
       align: 'right',
       lineBreak: false
     });

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(7.2)
     .text(`Fecha de Emisión: ${todayStr}`, bcvBoxX + 8, bcvBoxY + 20, {
       width: bcvBoxW - 16,
       align: 'right',
       lineBreak: false
     });

  doc.fillColor('#94A3B8')
     .font('Helvetica')
     .fontSize(6.5)
     .text('Precios en Bolívares según BCV oficial', bcvBoxX + 8, bcvBoxY + 31, {
       width: bcvBoxW - 16,
       align: 'right',
       lineBreak: false
     });

  // Banner Oficial de la Categoría (Totalmente separado, Y=104 a Y=132)
  const bannerY = headerY + headerH + 12; // 30 + 62 + 12 = 104
  const bannerHeight = 28;

  // Banner con fondo azul oscuro
  doc.roundedRect(margin, bannerY, contentWidth, bannerHeight, 5)
     .fill('#0F172A');

  // Acento lateral naranja automotriz
  doc.roundedRect(margin, bannerY, 4, bannerHeight, 2)
     .fill('#EA580C');

  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(10)
     .text(`CATÁLOGO OFICIAL: ${categoryInfo.title.toUpperCase()}`, margin + 14, bannerY + 8.5, { lineBreak: false });

  doc.fillColor('#F59E0B')
     .font('Helvetica-Bold')
     .fontSize(8.5)
     .text(`${totalCount} PRODUCTOS DISPONIBLES`, margin + contentWidth - 190, bannerY + 9.5, {
       width: 180,
       align: 'right',
       lineBreak: false
     });
}

/**
 * Dibuja un icono vectorial limpio cuando no hay foto de producto cargada
 */
function drawVectorPlaceholder(doc, x, y, w, h, marca) {
  const cx = x + w / 2;
  const cy = y + h / 2 - 12;

  // Cuerpo de cámara / producto
  doc.roundedRect(cx - 20, cy - 14, 40, 28, 4).fill('#E2E8F0');
  doc.circle(cx, cy, 8).fill('#CBD5E1');
  doc.circle(cx, cy, 6).fill('#FFFFFF');
  doc.circle(cx + 11, cy - 8, 2).fill('#94A3B8');

  doc.fillColor('#0F172A')
     .font('Helvetica-Bold')
     .fontSize(8)
     .text(marca || 'CRASTUR', x, y + h - 28, { width: w, align: 'center', lineBreak: false });

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(7)
     .text('FOTO OFICIAL', x, y + h - 16, { width: w, align: 'center', lineBreak: false });
}

/**
 * Dibuja una tarjeta amplia, con tipografía grande, respiro y lenguaje comercial formal
 */
function drawSpaciousProductRow(doc, prod, x, y, width, height, rate, settings) {
  const precioUsd = parseFloat(prod.precio_usd) || 0;
  const precioBs = precioUsd * rate;
  const cuotasCashea = parseInt(settings.cashea_cuotas || '3', 10);
  const inicialPct = parseFloat(settings.cashea_inicial_pct || '40') / 100;
  const inicialUsd = precioUsd * inicialPct;
  const cuotaUsd = (precioUsd - inicialUsd) / cuotasCashea;

  // Contenedor principal de la tarjeta con borde definido
  doc.roundedRect(x, y, width, height, 8)
     .fillAndStroke('#FFFFFF', '#CBD5E1');

  // 1. COLUMNA IZQUIERDA: Miniatura / Fotografía (110 pt ancho x 140 pt alto)
  const thumbX = x + 14;
  const thumbY = y + 14;
  const thumbW = 110;
  const thumbH = height - 28;

  doc.roundedRect(thumbX, thumbY, thumbW, thumbH, 6)
     .fillAndStroke('#F8FAFC', '#E2E8F0');

  let imageLoaded = false;
  if (prod.imagen_url && typeof prod.imagen_url === 'string') {
    try {
      if (prod.imagen_url.startsWith('data:image/')) {
        const base64Data = prod.imagen_url.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, thumbX + 6, thumbY + 8, {
          fit: [thumbW - 12, thumbH - 16],
          align: 'center',
          valign: 'center'
        });
        imageLoaded = true;
      } else if (fs.existsSync(prod.imagen_url)) {
        doc.image(prod.imagen_url, thumbX + 6, thumbY + 8, {
          fit: [thumbW - 12, thumbH - 16],
          align: 'center',
          valign: 'center'
        });
        imageLoaded = true;
      }
    } catch (e) {
      imageLoaded = false;
    }
  }

  if (!imageLoaded) {
    drawVectorPlaceholder(doc, thumbX, thumbY, thumbW, thumbH, prod.marca);
  }

  // 2. COLUMNA CENTRAL: Información del Producto (235 pt ancho)
  const infoX = thumbX + thumbW + 16;
  const infoW = width - (thumbW + 16 + 155 + 42); // 225 pt libres

  // Badge de Marca (Elegante en azul oscuro con letras blancas)
  const marcaText = (prod.marca || 'GENÉRICO').toUpperCase();
  const marcaW = 12 + marcaText.length * 6;
  doc.roundedRect(infoX, y + 14, marcaW, 16, 3)
     .fill('#0F172A');

  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(8)
     .text(marcaText, infoX + 6, y + 17.5, { lineBreak: false });

  // Categoría secundaria al lado de la marca
  if (prod.categoria) {
    doc.fillColor('#64748B')
       .font('Helvetica-Bold')
       .fontSize(8)
       .text(`•  ${prod.categoria}`, infoX + marcaW + 8, y + 17.5, { lineBreak: false });
  }

  // Título / Modelo del Producto (Grande 13 pt para excelente lectura móvil)
  doc.fillColor('#0F172A')
     .font('Helvetica-Bold')
     .fontSize(13)
     .text(prod.modelo || 'Producto', infoX, y + 37, {
       width: infoW,
       height: 34,
       lineGap: 1.5,
       ellipsis: true
     });

  // Descripción técnica con espacio cómodo
  let descText = prod.descripcion || 'Artículo garantizado con disponibilidad para entrega inmediata.';
  if (descText.length > 95) {
    descText = descText.substring(0, 92) + '...';
  }
  doc.fillColor('#334155')
     .font('Helvetica')
     .fontSize(8.2)
     .text(descText, infoX, y + 74, {
       width: infoW,
       height: 36,
       lineGap: 2.5
     });

  // Fila de Características Rápidas (Garantía y Entrega)
  const specY = y + 114;
  doc.fillColor('#475569')
     .font('Helvetica-Bold')
     .fontSize(7.2)
     .text('• Garantía Crastur', infoX, specY, { lineBreak: false });

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(7.2)
     .text('• Retiro en Tienda Física o Delivery Caracas', infoX + 78, specY, { lineBreak: false });

  // Insignia de Stock y Entrega Inmediata (Clara y formal)
  const inStock = prod.stock > 0;
  const stockY = y + 128;
  doc.roundedRect(infoX, stockY, 220, 22, 4)
     .fill(inStock ? '#DCFCE7' : '#FEE2E2');

  doc.circle(infoX + 11, stockY + 11, 3.5)
     .fill(inStock ? '#16A34A' : '#DC2626');

  doc.fillColor(inStock ? '#166534' : '#991B1B')
     .font('Helvetica-Bold')
     .fontSize(7.5)
     .text(inStock ? 'STOCK DISPONIBLE EN TIENDA FÍSICA' : 'CONSULTAR DISPONIBILIDAD CON ASESOR', infoX + 20, stockY + 7, { lineBreak: false });

  // 3. COLUMNA DERECHA: Caja de Precios y Cashea (150 pt ancho)
  const priceBoxW = 150;
  const priceBoxX = x + width - priceBoxW - 14;
  const priceBoxY = y + 14;
  const priceBoxH = height - 28;

  doc.roundedRect(priceBoxX, priceBoxY, priceBoxW, priceBoxH, 6)
     .fillAndStroke('#F8FAFC', '#CBD5E1');

  // Encabezado Divisas
  doc.fillColor('#64748B')
     .font('Helvetica-Bold')
     .fontSize(6.8)
     .text('PRECIO EN DIVISAS', priceBoxX + 10, priceBoxY + 8, { lineBreak: false });

  // Precio en Divisas ($ USD) Grande y Llamativo
  const usdText = `$${precioUsd.toFixed(2)}`;
  doc.fillColor('#EA580C')
     .font('Helvetica-Bold')
     .fontSize(16)
     .text(usdText, priceBoxX + 10, priceBoxY + 20, { lineBreak: false });

  doc.fillColor('#64748B')
     .font('Helvetica-Bold')
     .fontSize(8)
     .text('USD', priceBoxX + 12 + (usdText.length * 9), priceBoxY + 25, { lineBreak: false });

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(6.8)
     .text('Efectivo • Binance • Zelle', priceBoxX + 10, priceBoxY + 40, { lineBreak: false });

  // Separador interior suave
  doc.rect(priceBoxX + 10, priceBoxY + 50, priceBoxW - 20, 0.6)
     .fill('#E2E8F0');

  // Bolívares a tasa oficial BCV
  doc.fillColor('#64748B')
     .font('Helvetica-Bold')
     .fontSize(6.8)
     .text('EN BOLÍVARES (TASA BCV)', priceBoxX + 10, priceBoxY + 55, { lineBreak: false });

  doc.fillColor('#0F172A')
     .font('Helvetica-Bold')
     .fontSize(10.5)
     .text(`Bs. ${formatBs(precioBs)}`, priceBoxX + 10, priceBoxY + 67, { lineBreak: false });

  // Insignia de Financiamiento Cashea (Cuidando el vocabulario comercial estricto)
  const casheaBoxY = priceBoxY + 86;
  const casheaBoxH = 44;

  if (precioUsd >= 25) {
    doc.roundedRect(priceBoxX + 8, casheaBoxY, priceBoxW - 16, casheaBoxH, 4)
       .fillAndStroke('#FEF3C7', '#F59E0B');

    doc.fillColor('#92400E')
       .font('Helvetica-Bold')
       .fontSize(7)
       .text('FINANCIAMIENTO CASHEA', priceBoxX + 12, casheaBoxY + 6, { lineBreak: false });

    doc.fillColor('#78350F')
       .font('Helvetica-Bold')
       .fontSize(7.5)
       .text(`Inicial: $${inicialUsd.toFixed(2)} USD (40%)`, priceBoxX + 12, casheaBoxY + 18, { lineBreak: false });

    doc.fillColor('#78350F')
       .font('Helvetica')
       .fontSize(7)
       .text(`+ 3 cuotas de $${cuotaUsd.toFixed(2)} quincenal`, priceBoxX + 12, casheaBoxY + 30, { lineBreak: false });
  } else {
    doc.roundedRect(priceBoxX + 8, casheaBoxY, priceBoxW - 16, casheaBoxH, 4)
       .fillAndStroke('#F1F5F9', '#CBD5E1');

    doc.fillColor('#334155')
       .font('Helvetica-Bold')
       .fontSize(7)
       .text('FINANCIAMIENTO CASHEA', priceBoxX + 12, casheaBoxY + 6, { lineBreak: false });

    doc.fillColor('#475569')
       .font('Helvetica-Bold')
       .fontSize(7.2)
       .text('Compras a partir de $25 USD', priceBoxX + 12, casheaBoxY + 18, { lineBreak: false });

    doc.fillColor('#64748B')
       .font('Helvetica')
       .fontSize(6.8)
       .text('Disponible en tienda física', priceBoxX + 12, casheaBoxY + 30, { lineBreak: false });
  }
}

/**
 * Dibuja el pie de página fijo con QR de ubicación, dirección y paginación
 */
function drawFooter(doc, margin, contentWidth, pageHeight, pageNum, totalPages, qrBuffer, settings) {
  const footerY = pageHeight - 56;

  // Línea divisoria suave
  doc.strokeColor('#CBD5E1')
     .lineWidth(0.8)
     .moveTo(margin, footerY)
     .lineTo(margin + contentWidth, footerY)
     .stroke();

  // QR Code de Google Maps en el lateral derecho
  if (qrBuffer) {
    const qrSize = 42;
    const qrX = margin + contentWidth - qrSize;
    const qrY = footerY + 5;
    try {
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      doc.fillColor('#64748B')
         .font('Helvetica')
         .fontSize(5.5)
         .text('Escanea el QR para', qrX - 68, qrY + 12, { width: 64, align: 'right', lineBreak: false });
      doc.fillColor('#0F172A')
         .font('Helvetica-Bold')
         .fontSize(5.5)
         .text('Ubicación Tienda', qrX - 68, qrY + 20, { width: 64, align: 'right', lineBreak: false });
    } catch (e) {}
  }

  // Información de Tienda Física y Políticas
  const infoX = margin;
  const infoY = footerY + 7;

  doc.fillColor('#0F172A')
     .font('Helvetica-Bold')
     .fontSize(7.5)
     .text('Tienda Física Crastur: Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.', infoX, infoY, { lineBreak: false });

  doc.fillColor('#475569')
     .font('Helvetica')
     .fontSize(6.8)
     .text('Horario: Lunes a Sábado de 8:00 AM a 8:00 PM • Delivery en Caracas y Envíos Nacionales (MRW / Zoom / Tealca).', infoX, infoY + 11, { lineBreak: false });

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(6.2)
     .text(`Página ${pageNum} de ${totalPages} • Precios en Bs. calculados a la tasa oficial del BCV del día • Reservas válidas por 24 horas.`, infoX, infoY + 23, { lineBreak: false });
}

/**
 * Invalida todos los archivos en caché de catálogos
 */
function clearCatalogCache() {
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

module.exports = {
  resolveCanonicalCategory,
  getCategoryCatalogPdf,
  clearCatalogCache
};
