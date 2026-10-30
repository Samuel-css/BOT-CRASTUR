/**
 * @file CatalogToolbar.jsx
 * @description Barra superior del catálogo: búsqueda, filtro por categoría,
 * alternador grid/tabla, importación/plantilla, ajuste masivo y alta de producto.
 * Extraído de CatalogView.jsx.
 */

import { Search, Grid, List, ChevronDown, Upload, Download, Plus, Sparkles } from 'lucide-react';

export default function CatalogToolbar({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categories,
  productsCount,
  viewMode,
  onViewModeChange,
  importInputRef,
  onImportFile,
  importing,
  onDownloadTemplate,
  onOpenBulkModal,
  onOpenAddModal
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0a0f1d] p-4 rounded-3xl border border-slate-800/80 shadow-xl">
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        {/* Input de Búsqueda */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por marca, modelo o producto..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#070b14] border border-slate-800 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        {/* Filtro de Categoría con diseño estilizado */}
        <div className="relative w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full sm:w-auto h-10 bg-[#070b14] border border-slate-800 hover:border-slate-700 rounded-xl pl-3.5 pr-8 text-xs text-slate-300 focus:outline-none focus:border-orange-500 transition appearance-none cursor-pointer"
          >
            <option value="all">Todas las Categorías ({productsCount})</option>
            {categories.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
        {/* Botón Ajuste Masivo de Precios en 1 Clic */}
        <button
          type="button"
          onClick={onOpenBulkModal}
          title="Ajustar precios masivamente en 1 clic (+% o monto)"
          className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:text-orange-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm shadow-orange-500/10"
        >
          <Sparkles size={14} className="text-orange-400" />
          <span>Ajuste Masivo</span>
        </button>

        {/* Alternador Grid / Table */}
        <div className="flex items-center bg-[#070b14] rounded-2xl p-1 border border-slate-800">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-xl text-xs transition ${
              viewMode === 'grid' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
            title="Vista en Tarjetas"
          >
            <Grid size={15} />
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 rounded-xl text-xs transition ${
              viewMode === 'table' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
            title="Vista en Tabla"
          >
            <List size={15} />
          </button>
        </div>

        {/* Botón Importar Catálogo (CSV / JSON) */}
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,.json,application/json,text/csv"
          className="hidden"
          onChange={onImportFile}
        />
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          disabled={importing}
          title="Importar catálogo desde Excel/CSV o un respaldo JSON"
          className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-orange-500/50 text-slate-300 hover:text-white text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <Upload size={14} className="text-orange-400" />
          <span>{importing ? 'Importando...' : 'Importar'}</span>
        </button>
        <button
          type="button"
          onClick={onDownloadTemplate}
          title="Descargar plantilla CSV de ejemplo"
          className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-900 border border-slate-700 hover:border-orange-500/50 text-slate-400 hover:text-orange-300 transition active:scale-95 cursor-pointer"
        >
          <Download size={14} />
        </button>

        {/* Botón Agregar Producto */}
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95"
        >
          <Plus size={16} />
          <span>Agregar Producto</span>
        </button>
      </div>
    </div>
  );
}
