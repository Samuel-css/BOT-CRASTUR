import { Calculator, Trash2 } from 'lucide-react';
import { useCasheaCalculator } from './cashea/useCasheaCalculator';
import ModeSelector from './cashea/ModeSelector';
import ManualCalculator from './cashea/ManualCalculator';
import ProductComboPicker from './cashea/ProductComboPicker';
import LevelSelector from './cashea/LevelSelector';
import QuotePreview from './cashea/QuotePreview';

export default function CasheaCalculatorView({
  products = [],
  bcvRate = 849.56,
  onCopyManualQuote,
  copiedId,
  casheaCuotas = 3
}) {
  const {
    calcMode,
    setCalcMode,
    manualUsd,
    setManualUsd,
    selectedProductId,
    setSelectedProductId,
    selectedQuantity,
    setSelectedQuantity,
    selectedNivel,
    setSelectedNivel,
    searchQuery,
    setSearchQuery,
    isDropdownOpen,
    setIsDropdownOpen,
    copiedCombo,
    dropdownRef,
    comboItems,
    filteredProducts,
    selectedProduct,
    handleAddToCombo,
    handleUpdateComboQty,
    handleRemoveFromCombo,
    handleClearCombo,
    isComboActive,
    totalUsd,
    inicialPct,
    inicialUsd,
    inicialBs,
    saldoFinanciarUsd,
    cuotasCasheaNum,
    cuotaQuincenalUsd,
    cuotaQuincenalBs,
    qualifiesCashea,
    amountShort,
    handleCopyQuote
  } = useCasheaCalculator({ products, bcvRate, onCopyManualQuote, casheaCuotas });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Selector de Modo */}
      <ModeSelector calcMode={calcMode} setCalcMode={setCalcMode} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: PARÁMETROS Y COMBOS */}
        <div className="lg:col-span-7 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Calculator size={18} className="text-orange-400" />
                Parámetros de Financiamiento
              </h3>
              <p className="text-xs text-slate-400 mt-1">Calcula inicial y {cuotasCasheaNum} cuotas exactas con tasa oficial BCV</p>
            </div>
            {isComboActive && (
              <button
                type="button"
                onClick={handleClearCombo}
                className="text-[11px] text-slate-400 hover:text-red-400 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={13} />
                Vaciar Combo
              </button>
            )}
          </div>

          {calcMode === 'manual' ? (
            <ManualCalculator manualUsd={manualUsd} setManualUsd={setManualUsd} />
          ) : (
            <ProductComboPicker
              products={products}
              filteredProducts={filteredProducts}
              selectedProduct={selectedProduct}
              selectedProductId={selectedProductId}
              setSelectedProductId={setSelectedProductId}
              selectedQuantity={selectedQuantity}
              setSelectedQuantity={setSelectedQuantity}
              isDropdownOpen={isDropdownOpen}
              setIsDropdownOpen={setIsDropdownOpen}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dropdownRef={dropdownRef}
              comboItems={comboItems}
              totalUsd={totalUsd}
              onAddToCombo={handleAddToCombo}
              onUpdateComboQty={handleUpdateComboQty}
              onRemoveFromCombo={handleRemoveFromCombo}
            />
          )}

          <LevelSelector
            selectedNivel={selectedNivel}
            setSelectedNivel={setSelectedNivel}
            bcvRate={bcvRate}
          />
        </div>

        {/* COLUMNA DERECHA: RESUMEN DE PAGO, BARRA $25 Y BOTÓN WHATSAPP */}
        <QuotePreview
          products={products}
          selectedProduct={selectedProduct}
          selectedNivel={selectedNivel}
          inicialPct={inicialPct}
          inicialUsd={inicialUsd}
          inicialBs={inicialBs}
          cuotasCasheaNum={cuotasCasheaNum}
          cuotaQuincenalUsd={cuotaQuincenalUsd}
          cuotaQuincenalBs={cuotaQuincenalBs}
          saldoFinanciarUsd={saldoFinanciarUsd}
          qualifiesCashea={qualifiesCashea}
          amountShort={amountShort}
          totalUsd={totalUsd}
          copiedCombo={copiedCombo}
          copiedId={copiedId}
          onCopyQuote={handleCopyQuote}
          onAddToCombo={handleAddToCombo}
        />
      </div>
    </div>
  );
}
