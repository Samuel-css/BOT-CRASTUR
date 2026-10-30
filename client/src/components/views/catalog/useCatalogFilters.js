/**
 * @file useCatalogFilters.js
 * @description Estado de búsqueda, filtro por categoría, modo de vista (grid/tabla),
 * lista de categorías y productos filtrados del catálogo. Extraído de CatalogView.jsx.
 */

import { useState } from 'react';
import { PRODUCT_CATEGORIES } from '../../../constants/categories';

export const normalizeCat = (cat) => {
  if (!cat) return '';
  let c = String(cat).trim();
  if (c === 'Repuestos para Moto' || c.startsWith('Repuestos para Moto')) {
    c = c.replace('Repuestos para Moto', 'Repuestos Moto');
  }
  if (c === 'Insumos para Caucheras' || c.startsWith('Insumos para Caucheras')) {
    c = c.replace('Insumos para Caucheras', 'Insumos Cauchera');
  }
  return c;
};

export default function useCatalogFilters({ products }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  const categories = Array.from(new Set([
    ...PRODUCT_CATEGORIES,
    ...products.map(p => normalizeCat(p.categoria)).filter(Boolean)
  ])).filter(c => c !== 'Test');

  const filtered = products.filter(p => {
    const q = searchTerm.toLowerCase();
    const marca = (p.marca || '').toLowerCase();
    const modelo = (p.modelo || '').toLowerCase();
    const rawCat = p.categoria || '';
    const normCat = normalizeCat(rawCat);
    const categoria = normCat.toLowerCase();

    const matchesSearch = marca.includes(q) || modelo.includes(q) || categoria.includes(q);
    const matchesCat = categoryFilter === 'all' ||
      normCat === categoryFilter ||
      rawCat === categoryFilter ||
      normCat.startsWith(categoryFilter + ' -') ||
      rawCat.startsWith(categoryFilter + ' -');

    return matchesSearch && matchesCat;
  });

  return {
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    viewMode,
    setViewMode,
    categories,
    filtered
  };
}
