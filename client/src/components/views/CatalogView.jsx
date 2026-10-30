/**
 * ============================================================================
 * VISTA DE CATÁLOGO COMERCIAL E INVENTARIO (CATALOGVIEW.JSX)
 * ============================================================================
 * Panel de consulta y gestión del inventario físico de repuestos e insumos:
 * - Visualización en cuadrícula (tarjetas interactivas) o tabla densa de inventario
 * - Edición rápida en línea del precio en USD con persistencia inmediata
 * - Copia de cotizaciones formateadas para WhatsApp e Instagram
 * - Módulo de ajuste masivo de precios por porcentaje o monto fijo en dólares
 *
 * [MERCADO VENEZUELA]
 * - Precios calculados al vuelo en Bolívares a la tasa oficial BCV.
 * - Desglose de cuotas e inicial Cashea visible en cada tarjeta de repuesto.
 */

import { useState } from 'react';
import { Package, Plus, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import BulkPriceModal from '../modals/BulkPriceModal';
import useCatalogFilters from './catalog/useCatalogFilters';
import useCatalogImport from './catalog/useCatalogImport';
import useInlinePrice from './catalog/useInlinePrice';
import CatalogToolbar from './catalog/CatalogToolbar';
import ProductGrid from './catalog/ProductGrid';
import ProductTable from './catalog/ProductTable';

export default function CatalogView({
  products,
  bcvRate,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  onCopyQuote,
  copiedId,
  onReload
}) {
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const {
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    viewMode,
    setViewMode,
    categories,
    filtered
  } = useCatalogFilters({ products });

  const {
    importing,
    importInputRef,
    handleImportFile,
    downloadTemplate
  } = useCatalogImport({ toast, onReload });

  const {
    editingPriceId,
    editingPriceVal,
    setEditingPriceVal,
    savingInline,
    startInlineEdit,
    cancelInlineEdit,
    handleSaveInlinePrice
  } = useInlinePrice({ onReload });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <CatalogToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categories={categories}
        productsCount={products.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        importInputRef={importInputRef}
        onImportFile={handleImportFile}
        importing={importing}
        onDownloadTemplate={downloadTemplate}
        onOpenBulkModal={() => setBulkModalOpen(true)}
        onOpenAddModal={onOpenAddModal}
      />

      {/* Contenido del Catálogo */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-[#0a0f1d] border border-slate-800/80 rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#070b14] border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Package size={28} />
          </div>
          <h4 className="font-bold text-base text-white">No hay productos registrados</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            El catálogo se encuentra listo para registrar los productos de tu negocio. Haz clic en "Agregar Producto" para registrar el primero.
          </p>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 mt-2"
          >
            <Plus size={15} />
            <span>Agregar Primer Producto</span>
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-orange-500/50 text-slate-200 font-bold text-xs transition disabled:opacity-50"
            >
              <Upload size={14} className="text-orange-400" />
              <span>{importing ? 'Importando...' : 'Importar catálogo (CSV/JSON)'}</span>
            </button>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-orange-500/50 text-slate-300 font-bold text-xs transition"
            >
              <Download size={14} />
              <span>Descargar plantilla</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <ProductGrid
          products={filtered}
          bcvRate={bcvRate}
          onCopyQuote={onCopyQuote}
          copiedId={copiedId}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
        />
      ) : (
        /* Vista en Tabla */
        <ProductTable
          products={filtered}
          bcvRate={bcvRate}
          onCopyQuote={onCopyQuote}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
          editingPriceId={editingPriceId}
          editingPriceVal={editingPriceVal}
          onEditingPriceChange={setEditingPriceVal}
          savingInline={savingInline}
          startInlineEdit={startInlineEdit}
          cancelInlineEdit={cancelInlineEdit}
          handleSaveInlinePrice={handleSaveInlinePrice}
        />
      )}
      {/* Modal de Ajuste Masivo de Precios */}
      <BulkPriceModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        products={products}
        categories={categories}
        bcvRate={bcvRate}
        onSuccess={() => {
          if (onReload) onReload();
        }}
      />
    </div>
  );
}
