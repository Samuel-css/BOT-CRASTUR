/**
 * @file data.ts
 * @description Consulta de productos y datos auxiliares para los catálogos PDF.
 */

import { db } from '../../../database';
import QRCode from 'qrcode';
import { getProductsByCanonicalCategory } from '../../config/categoryGroups';

export function resolveCanonicalCategory(input) {
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
    norm.includes('fluido') ||
    norm.includes('combo') ||
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
 * Consulta los productos de la categoría desde la base de datos.
 * [AGRUPACIÓN CANÓNICA] Usa el mapeo de categorías para incluir productos
 * guardados en subcategorías del panel (ej. "Repuestos Moto - Tripas y Cauchos").
 */
export function getProductsForCategory(categoryKey) {
  if (categoryKey === 'Todos') {
    return db.prepare(`
      SELECT * FROM products 
      WHERE activo = 1 
      ORDER BY categoria ASC, modelo ASC
    `).all();
  }

  // Ruta principal: agrupación canónica (tolera subcategorías)
  const grouped = getProductsByCanonicalCategory(categoryKey);
  if (grouped.length > 0) return grouped;

  // Compatibilidad con categorías exactas antiguas que no estén en el mapeo
  const all: any[] = db.prepare('SELECT * FROM products WHERE activo = 1').all();
  return all
    .filter(p => {
      const cat = String(p.categoria || '');
      return cat === categoryKey || cat.startsWith(`${categoryKey} - `) || cat.startsWith(`${categoryKey} (`);
    })
    .sort((a, b) => String(a.modelo || '').localeCompare(String(b.modelo || ''), 'es'));
}

/**
 * Genera el buffer del código QR para la ubicación en Google Maps
 */
export async function generateMapsQrBuffer(mapsUrl) {
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
