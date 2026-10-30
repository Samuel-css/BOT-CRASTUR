/**
 * @file useCatalogImport.js
 * @description Importación masiva de catálogo (CSV/JSON) y descarga de plantilla.
 * Incluye normalización de encabezados y parseo de delimitadores. Extraído de CatalogView.jsx.
 */

import { useRef, useState } from 'react';
import { toast as toastDefault } from 'sonner';

export const normalizeImportKey = (value) => String(value || '')
  .replace(/^\uFEFF/, '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_')
  .trim();

export const parseDelimited = (text, delimiter) => {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(current); current = '';
    } else if (char === '\n') {
      row.push(current); rows.push(row); row = []; current = '';
    } else if (char !== '\r') {
      current += char;
    }
  }
  if (current !== '' || row.length > 0) { row.push(current); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
};

export const mapCsvToProducts = (text) => {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const delimiter = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = parseDelimited(clean, delimiter);
  if (rows.length === 0) return [];

  const header = rows[0].map(normalizeImportKey);
  const hasHeader = header.some(h => ['marca', 'modelo', 'precio', 'precio_usd', 'categoria'].includes(h));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const columns = hasHeader ? header : ['marca', 'modelo', 'categoria', 'precio_usd', 'descripcion', 'stock', 'imagen_url'];

  return dataRows.map(cols => {
    const item = {};
    columns.forEach((key, idx) => {
      const value = String(cols[idx] ?? '').trim();
      if (key === 'precio' || key === 'precio_usd' || key === 'precio_usd_') item.precio_usd = value;
      else if (key === 'categoria' || key === 'categoría') item.categoria = value;
      else if (key === 'descripcion' || key === 'descripción' || key === 'detalle') item.descripcion = value;
      else if (key === 'imagen' || key === 'imagen_url' || key === 'foto') item.imagen_url = value;
      else if (key === 'stock' || key === 'cantidad' || key === 'existencia') item.stock = value;
      else if (key === 'marca' || key === 'fabricante') item.marca = value;
      else if (key === 'modelo' || key === 'producto' || key === 'nombre') item.modelo = value;
      else item[key] = value;
    });
    let precioRaw = String(item.precio_usd ?? '').replace(/\s/g, '').replace(/[^\d,.-]/g, '');
    // Acepta "3.50", "3,50" y "1.234,56" (formato venezolano).
    if (precioRaw.includes(',') && precioRaw.includes('.')) {
      if (precioRaw.lastIndexOf(',') > precioRaw.lastIndexOf('.')) {
        precioRaw = precioRaw.replace(/\./g, '').replace(',', '.');
      } else {
        precioRaw = precioRaw.replace(/,/g, '');
      }
    } else if (precioRaw.includes(',')) {
      precioRaw = precioRaw.replace(',', '.');
    }
    item.precio_usd = parseFloat(precioRaw);
    item.stock = item.stock !== undefined && item.stock !== '' ? parseInt(String(item.stock).replace(/[^\d-]/g, ''), 10) : 1;
    if (!Number.isFinite(item.stock)) item.stock = 0;
    return item;
  }).filter(item => item.marca && item.modelo && Number.isFinite(item.precio_usd) && item.precio_usd > 0);
};

export default function useCatalogImport({ toast: toastApi = toastDefault, onReload }) {
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  // ─── [IMPORTACIÓN MASIVA] CSV / JSON ──────────────────────────────────────
  // Permite cargar cientos de repuestos sin agregarlos uno por uno. Acepta el
  // JSON que exporta el propio sistema y CSV/Excel guardado como CSV.
  const handleImportFile = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      let productos = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        productos = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.productos) ? parsed.productos : []);
      } else {
        productos = mapCsvToProducts(text);
      }
      if (!productos.length) {
        toastApi.error('No se encontraron productos válidos. Revisa la plantilla (marca, modelo, precio).');
        return;
      }
      if (!window.confirm(`Se importarán ${productos.length} producto(s). Los que ya existan (misma marca + modelo) se actualizarán. ¿Continuar?`)) {
        return;
      }
      const res = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al importar el catálogo');
      toastApi.success(`Catálogo importado: ${data.inserted ?? 0} nuevos, ${data.updated ?? 0} actualizados.`);
      if (onReload) onReload();
    } catch (e) {
      toastApi.error(`No se pudo importar: ${e?.message || e}`);
    } finally {
      setImporting(false);
      if (event.target) event.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = '\uFEFFmarca;modelo;categoria;precio_usd;descripcion;stock;imagen_url\n'
      + 'NGK;Bujía D8EA Bera 150;Repuestos Moto;3.50;Bujía japonesa de rosca larga;20;\n'
      + 'Rema;Parches en Frío Tip Top;Insumos Cauchera;12.00;Caja de parches vulcanizados;15;\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_catalogo_crastur.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return {
    importing,
    importInputRef,
    handleImportFile,
    downloadTemplate
  };
}
