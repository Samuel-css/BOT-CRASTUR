import { Search, ChevronDown, Plus, Minus, Trash2, Layers } from 'lucide-react';

export default function ProductComboPicker({
  products,
  filteredProducts,
  selectedProduct,
  selectedProductId,
  setSelectedProductId,
  selectedQuantity,
  setSelectedQuantity,
  isDropdownOpen,
  setIsDropdownOpen,
  searchQuery,
  setSearchQuery,
  dropdownRef,
  comboItems,
  totalUsd,
  onAddToCombo,
  onUpdateComboQty,
  onRemoveFromCombo
}) {
  return (
    <div className="space-y-4">
      {/* SELECTOR DESPLEGABLE CON BÚSQUEDA */}
      <div className="relative" ref={dropdownRef}>
        <label className="text-xs font-semibold text-slate-300 block mb-1.5">
          Selecciona el Repuesto del Catálogo:
        </label>

        {products.length === 0 ? (
          <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">📦 No hay repuestos registrados en el inventario.</p>
            <p className="text-[11px] text-slate-500">Carga productos desde el menú Catálogo o usa la pestaña "Monto Libre en Dólares ($)".</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full flex items-center justify-between bg-[#070b14] border rounded-2xl px-4 py-3 text-left transition cursor-pointer ${
                isDropdownOpen
                  ? 'border-orange-500 ring-1 ring-orange-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="min-w-0 pr-2">
                {selectedProduct ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white truncate">
                      {selectedProduct.marca} {selectedProduct.modelo}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                      ${parseFloat(selectedProduct.precio_usd).toFixed(2)} USD
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Seleccionar repuesto...</span>
                )}
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                  isDropdownOpen ? 'rotate-180 text-orange-400' : ''
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute z-30 left-0 right-0 mt-2 bg-[#0a0f1d] border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2 backdrop-blur-md animate-fade-in-up">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar por repuesto, marca o modelo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-8.5 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No se encontraron repuestos con "{searchQuery}"
                    </div>
                  ) : (
                    filteredProducts.map((p) => {
                      const isSelected = String(p.id) === String(selectedProductId);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setSelectedQuantity(1);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition cursor-pointer border ${
                            isSelected
                              ? 'bg-orange-500/20 border-orange-500 text-white font-bold shadow-md shadow-orange-500/10'
                              : 'bg-[#070b14]/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className={`truncate font-bold ${isSelected ? 'text-white' : 'text-slate-100'}`}>
                                {p.marca} {p.modelo}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-orange-500 text-slate-950 shrink-0">
                                  Seleccionado
                                </span>
                              )}
                            </div>
                            <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-orange-300 font-medium' : 'text-slate-400'}`}>
                              {p.categoria}
                            </div>
                          </div>
                          <span className={`font-mono font-black text-sm shrink-0 ${isSelected ? 'text-orange-400' : 'text-slate-300'}`}>
                            ${parseFloat(p.precio_usd).toFixed(2)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* SELECTOR DE CANTIDAD Y BOTÓN SUMAR AL COMBO */}
      {selectedProduct && (
        <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold">Cantidad:</span>
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                disabled={selectedQuantity <= 1}
                className="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              >
                <Minus size={13} />
              </button>
              <span className="px-3 py-1 text-xs font-mono font-bold text-white">
                {selectedQuantity}
              </span>
              <button
                type="button"
                onClick={() => setSelectedQuantity(Math.min(99, selectedQuantity + 1))}
                disabled={selectedQuantity >= 99}
                className="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              >
                <Plus size={13} />
              </button>
            </div>
            <span className="text-xs font-mono font-bold text-orange-400">
              = ${(parseFloat(selectedProduct.precio_usd) * selectedQuantity).toFixed(2)} USD
            </span>
          </div>

          <button
            type="button"
            onClick={() => onAddToCombo(selectedProduct, selectedQuantity)}
            className="px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/40 hover:bg-orange-500/25 text-orange-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>Sumar a Combo Cashea</span>
          </button>
        </div>
      )}

      {/* LISTA DE ITEMS EN EL COMBO CASHEA */}
      {comboItems.length > 0 && (
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Layers size={14} className="text-orange-400" />
              <span>Artículos en este Combo ({comboItems.length}):</span>
            </span>
            <span className="font-mono font-black text-orange-400 text-sm">
              Total: ${totalUsd.toFixed(2)} USD
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {comboItems.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-[#070b14] border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-white truncate">{item.marca} {item.modelo}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ${item.precio_usd.toFixed(2)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onUpdateComboQty(item.id, -1)}
                      className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                    >
                      -
                    </button>
                    <span className="px-2 text-[11px] font-mono font-bold text-white">
                      {item.cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateComboQty(item.id, 1)}
                      className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-mono font-bold text-orange-300 w-16 text-right">
                    ${(item.precio_usd * item.cantidad).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFromCombo(item.id)}
                    className="text-slate-500 hover:text-red-400 transition p-1"
                    title="Quitar del combo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
