import { useState, useRef, useEffect } from 'react';
import { Calculator, DollarSign, ShoppingBag, Copy, Check, Car, Search, ChevronDown } from 'lucide-react';
import { formatBs, formatRate } from '../../utils/formatters';

export default function CasheaCalculatorView({
  products,
  bcvRate,
  onCopyManualQuote,
  copiedId
}) {
  const [calcMode, setCalcMode] = useState('manual'); // 'manual' | 'catalog'
  const [manualUsd, setManualUsd] = useState('50');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedNivel, setSelectedNivel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = (products || []).filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const marca = (p.marca || '').toLowerCase();
    const modelo = (p.modelo || '').toLowerCase();
    const desc = (p.descripcion || '').toLowerCase();
    const cat = (p.categoria || '').toLowerCase();
    return marca.includes(q) || modelo.includes(q) || desc.includes(q) || cat.includes(q);
  });

  const selectedProduct = (products || []).find(p => String(p.id) === String(selectedProductId)) || (products && products[0]);

  const usdAmount = calcMode === 'catalog' && selectedProduct
    ? (parseFloat(selectedProduct.precio_usd) || 0)
    : (parseFloat(manualUsd) || 0);

  const inicialPct = selectedNivel === 1 ? 0.40 : selectedNivel === 2 ? 0.30 : 0.20;
  const inicialUsd = usdAmount * inicialPct;
  const inicialBs = inicialUsd * bcvRate;

  const saldoFinanciarUsd = usdAmount - inicialUsd;
  const saldoFinanciarBs = saldoFinanciarUsd * bcvRate;

  const cuotaQuincenalUsd = saldoFinanciarUsd / 3;
  const cuotaQuincenalBs = cuotaQuincenalUsd * bcvRate;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Selector de Modo */}
      <div className="flex items-center justify-center">
        <div className="bg-[#0a0f1d] p-1 rounded-2xl border border-slate-800 flex items-center shadow-lg">
          <button
            onClick={() => setCalcMode('manual')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              calcMode === 'manual'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Monto Libre en Dólares ($)
          </button>
          <button
            onClick={() => {
              setCalcMode('catalog');
              if (products.length > 0 && !selectedProductId) {
                setSelectedProductId(products[0].id);
              }
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              calcMode === 'catalog'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Elegir Repuesto del Catálogo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Parámetros de Cotización */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Calculator size={18} className="text-orange-400" />
              Parámetros de Financiamiento
            </h3>
            <p className="text-xs text-slate-400 mt-1">Calcula la inicial y 3 cuotas exactas con tasa oficial BCV</p>
          </div>

          {calcMode === 'manual' ? (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Monto del Repuesto o Combo en Dólares ($ USD):
              </label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={manualUsd}
                  onChange={(e) => setManualUsd(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#070b14] border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white font-mono font-bold focus:outline-none focus:border-orange-500 transition"
                />
              </div>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Selecciona el Repuesto del Catálogo:
              </label>

              {products.length === 0 ? (
                <div className="p-3 bg-[#070b14] border border-slate-800 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
                  <Car size={14} className="text-slate-500" />
                  <span>No hay repuestos registrados en el catálogo.</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`w-full flex items-center justify-between bg-[#070b14] border rounded-2xl px-4 py-3 text-left transition ${
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
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs px-1"
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
                                  setIsDropdownOpen(false);
                                  setSearchQuery('');
                                }}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition ${
                                  isSelected
                                    ? 'bg-orange-500 text-slate-950 font-bold'
                                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="truncate font-semibold">
                                    {p.marca} {p.modelo}
                                  </div>
                                </div>
                                <span className={`font-mono font-bold shrink-0 ${isSelected ? 'text-slate-950' : 'text-orange-400'}`}>
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
          )}

          {/* Niveles de Cashea */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Nivel de Usuario en Cashea:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedNivel(1)}
                className={`p-3 rounded-2xl border text-center transition ${
                  selectedNivel === 1
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold shadow-sm'
                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-xs font-bold">Nivel 1</span>
                <span className="text-[11px] font-mono">40% Inicial</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNivel(2)}
                className={`p-3 rounded-2xl border text-center transition ${
                  selectedNivel === 2
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold shadow-sm'
                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-xs font-bold">Nivel 2</span>
                <span className="text-[11px] font-mono">30% Inicial</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNivel(3)}
                className={`p-3 rounded-2xl border text-center transition ${
                  selectedNivel === 3
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold shadow-sm'
                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-xs font-bold">Nivel 3+</span>
                <span className="text-[11px] font-mono">20% Inicial</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-[#070b14] rounded-2xl border border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Tasa Oficial BCV:</span>
            <span className="text-orange-400 font-bold">Bs. {formatRate(bcvRate)} / USD</span>
          </div>
        </div>

        {/* Resumen de Pago y Cuotas */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Plan de Pago Cashea</h3>
                <p className="text-xs text-slate-400">3 Cuotas Quincenales sin Interés (En Tienda Física)</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center">
                <ShoppingBag size={18} />
              </div>
            </div>

            {/* Aviso si es menor a $25 */}
            {usdAmount > 0 && usdAmount < 25 && (
              <div className="p-3.5 bg-orange-500/10 border border-orange-500/30 rounded-2xl text-[11px] text-orange-300">
                ⚠️ <strong>Mínimo $25 USD:</strong> Cashea aplica a partir de $25 USD en nuestra tienda física. Si este repuesto cuesta menos, puedes cotizarlo en combo con otros productos.
              </div>
            )}

            {/* Inicial a pagar hoy */}
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">
                Pago Inicial en Tienda (Nivel {selectedNivel} - {Math.round(inicialPct * 100)}%)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-orange-300 font-mono">
                  ${inicialUsd.toFixed(2)} USD
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  Bs. {formatBs(inicialBs)}
                </span>
              </div>
              <p className="text-[11px] text-orange-400/80">Escaneas con tu app Cashea en caja y retiras de inmediato</p>
            </div>

            {/* 3 Cuotas Quincenales */}
            <div className="p-4 bg-[#070b14] rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                3 Cuotas Quincenales (Vía Cashea)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-white font-mono">
                  ${cuotaQuincenalUsd.toFixed(2)} USD / cuota
                </span>
                <span className="text-xs font-bold text-orange-400 font-mono">
                  Bs. {formatBs(cuotaQuincenalBs)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">Total financiado: ${saldoFinanciarUsd.toFixed(2)} USD</p>
            </div>
          </div>

          {/* Botón Copiar Cotización */}
          <button
            onClick={() => onCopyManualQuote(usdAmount, selectedNivel, inicialUsd, inicialBs, cuotaQuincenalUsd, cuotaQuincenalBs)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95"
          >
            {copiedId === 'manual' ? (
              <>
                <Check size={16} />
                <span>¡Cotización Copiada con Éxito!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copiar Cotización Lista para WhatsApp</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
