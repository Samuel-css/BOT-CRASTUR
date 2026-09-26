import { useState, useRef, useEffect } from 'react';
import {
  Calculator,
  DollarSign,
  ShoppingBag,
  Copy,
  Check,
  Search,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Layers,
  AlertTriangle,
  PackageCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBs, formatRate } from '../../utils/formatters';
import { handleNumericKeyDown, sanitizeCurrency } from '../../utils/inputSanitizers';

export default function CasheaCalculatorView({
  products = [],
  bcvRate = 849.56,
  onCopyManualQuote,
  copiedId
}) {
  const [calcMode, setCalcMode] = useState('catalog'); // 'catalog' | 'manual'
  const [manualUsd, setManualUsd] = useState('50');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedNivel, setSelectedNivel] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copiedCombo, setCopiedCombo] = useState(false);
  const dropdownRef = useRef(null);

  // Lista de productos combinados en combo para alcanzar los $25 USD
  const [comboItems, setComboItems] = useState([]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (products && products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

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

  // Agregar producto al Combo Cashea
  const handleAddToCombo = (prodToAdd = selectedProduct, qty = selectedQuantity) => {
    if (!prodToAdd) return;
    const cleanQty = Math.max(1, Math.min(99, qty));
    setComboItems(prev => {
      const existing = prev.find(item => String(item.id) === String(prodToAdd.id));
      if (existing) {
        return prev.map(item =>
          String(item.id) === String(prodToAdd.id)
            ? { ...item, cantidad: Math.min(99, item.cantidad + cleanQty) }
            : item
        );
      }
      return [
        ...prev,
        {
          id: prodToAdd.id,
          marca: prodToAdd.marca,
          modelo: prodToAdd.modelo,
          categoria: prodToAdd.categoria,
          precio_usd: parseFloat(prodToAdd.precio_usd) || 0,
          cantidad: cleanQty
        }
      ];
    });
    toast.success(`"${prodToAdd.modelo}" agregado al combo`);
  };

  // Modificar cantidad en el combo (acotada entre 1 y 99)
  const handleUpdateComboQty = (id, delta) => {
    setComboItems(prev =>
      prev
        .map(item => {
          if (String(item.id) === String(id)) {
            const nextQty = item.cantidad + delta;
            if (nextQty <= 0) return null;
            return { ...item, cantidad: Math.min(99, nextQty) };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveFromCombo = (id) => {
    setComboItems(prev => prev.filter(item => String(item.id) !== String(id)));
  };

  const handleClearCombo = () => {
    setComboItems([]);
    toast.info('Combo Cashea vaciado.');
  };

  // Cálculo del monto total USD
  const isComboActive = calcMode === 'catalog' && comboItems.length > 0;

  const totalUsd = calcMode === 'manual'
    ? (parseFloat(manualUsd) || 0)
    : (isComboActive
        ? comboItems.reduce((acc, item) => acc + (item.precio_usd * item.cantidad), 0)
        : (selectedProduct ? (parseFloat(selectedProduct.precio_usd) || 0) * selectedQuantity : 0));

  const inicialPct = selectedNivel === 1 ? 0.40 : selectedNivel === 2 ? 0.30 : 0.20;
  const inicialUsd = totalUsd * inicialPct;
  const inicialBs = inicialUsd * bcvRate;

  const saldoFinanciarUsd = totalUsd - inicialUsd;
  const saldoFinanciarBs = saldoFinanciarUsd * bcvRate;

  const cuotaQuincenalUsd = saldoFinanciarUsd / 3;
  const cuotaQuincenalBs = cuotaQuincenalUsd * bcvRate;

  const qualifiesCashea = totalUsd >= 25;
  const amountShort = Math.max(0, 25 - totalUsd);

  // Generador de cotización lista para WhatsApp
  const handleCopyQuote = () => {
    let quoteText = '';

    if (calcMode === 'manual') {
      if (typeof onCopyManualQuote === 'function') {
        onCopyManualQuote(totalUsd, selectedNivel, inicialUsd, inicialBs, cuotaQuincenalUsd, cuotaQuincenalBs);
        return;
      }
    }

    if (isComboActive) {
      quoteText = `¡Hola! 👋 Te compartimos tu cotización de *Combo Cashea 💛* en *Crastur Caracas*:\n\n`;
      quoteText += `📦 *Detalle de Repuestos Seleccionados:*\n`;
      comboItems.forEach(item => {
        const itemSubtotal = item.precio_usd * item.cantidad;
        quoteText += `• ${item.cantidad}x ${item.marca} - ${item.modelo}: *$${itemSubtotal.toFixed(2)} USD*\n`;
      });
      quoteText += `\n💰 *Total de la compra:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalUsd * bcvRate)} a tasa BCV: ${formatRate(bcvRate)})\n\n`;
      if (qualifiesCashea) {
        quoteText += `💛 *Plan de Pago Cashea (Nivel ${selectedNivel} - ${Math.round(inicialPct * 100)}%):*\n`;
        quoteText += `👉 *Inicial hoy en tienda:* *$${inicialUsd.toFixed(2)} USD* (Bs. ${formatBs(inicialBs)})\n`;
        quoteText += `👉 *3 Cuotas quincenales sin interés:* *$${cuotaQuincenalUsd.toFixed(2)} USD / cuota* (Bs. ${formatBs(cuotaQuincenalBs)})\n\n`;
        quoteText += `📍 *Retiro inmediato:* Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.\n`;
        quoteText += `🛵 O si prefieres te lo enviamos con delivery a toda Caracas.\n\n`;
        quoteText += `¿Deseas que te apartemos este combo por 24 horas sin costo? Escribe *SI* para reservarlo.`;
      } else {
        quoteText += `⚠️ *Aviso Cashea:* Para financiar en 3 cuotas con tu app Cashea, el consumo mínimo en tienda es de *$25 USD* (faltan solo $${amountShort.toFixed(2)} USD). ¡Puedes agregar otro repuesto para llevarte todo financiado!\n\n`;
        quoteText += `Escribe *VENDEDOR* si deseas que te armemos un combo a tu medida. 👨‍🔧`;
      }
    } else if (selectedProduct) {
      const prodSubtotal = parseFloat(selectedProduct.precio_usd) * selectedQuantity;
      quoteText = `¡Hola! 👋 Te cotizamos *${selectedQuantity > 1 ? `${selectedQuantity}x ` : ''}${selectedProduct.marca} - ${selectedProduct.modelo}* en *Crastur*:\n\n`;
      quoteText += `💵 *Precio:* *$${prodSubtotal.toFixed(2)} USD* (Bs. ${formatBs(prodSubtotal * bcvRate)} a tasa oficial BCV: ${formatRate(bcvRate)})\n\n`;
      if (qualifiesCashea) {
        quoteText += `💛 *Financiamiento Cashea (Nivel ${selectedNivel}):*\n`;
        quoteText += `👉 *Inicial hoy en tienda:* *$${inicialUsd.toFixed(2)} USD* (Bs. ${formatBs(inicialBs)})\n`;
        quoteText += `👉 *3 Cuotas quincenales:* *$${cuotaQuincenalUsd.toFixed(2)} USD / cuota* (Bs. ${formatBs(cuotaQuincenalBs)})\n\n`;
        quoteText += `📍 *Retiro en tienda física:* San Agustín Norte, Caracas.\n`;
        quoteText += `👉 Escribe *APARTAR* para reservarlo por 24 horas sin costo.`;
      } else {
        quoteText += `💡 *Nota Cashea:* Cashea aplica en nuestra tienda física a partir de *$25 USD*. Puedes combinar este repuesto con aceite, bujías o más unidades para llevarte todo en cuotas.\n\n`;
        quoteText += `👉 Escribe *VENDEDOR* para asistirte de inmediato.`;
      }
    }

    if (navigator.clipboard && quoteText) {
      navigator.clipboard.writeText(quoteText);
      setCopiedCombo(true);
      toast.success('¡Cotización copiada lista para WhatsApp!');
      setTimeout(() => setCopiedCombo(false), 2500);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Selector de Modo */}
      <div className="flex items-center justify-center">
        <div className="bg-[#0a0f1d] p-1.5 rounded-2xl border border-slate-800 flex items-center shadow-lg">
          <button
            type="button"
            onClick={() => setCalcMode('catalog')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              calcMode === 'catalog'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={15} />
            <span>Elegir o Combinar Repuestos del Catálogo</span>
          </button>
          <button
            type="button"
            onClick={() => setCalcMode('manual')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              calcMode === 'manual'
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign size={15} />
            <span>Monto Libre en Dólares ($)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: PARÁMETROS Y COMBOS */}
        <div className="lg:col-span-7 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Calculator size={18} className="text-orange-400" />
                Parámetros de Financiamiento
              </h3>
              <p className="text-xs text-slate-400 mt-1">Calcula inicial y 3 cuotas exactas con tasa oficial BCV</p>
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
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Monto del Repuesto o Combo en Dólares ($ USD):
              </label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualUsd}
                  onKeyDown={(e) => handleNumericKeyDown(e, true)}
                  onChange={(e) => setManualUsd(sanitizeCurrency(e.target.value, 0.01, 50000))}
                  placeholder="0.00"
                  className="w-full bg-[#070b14] border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white font-mono font-bold focus:outline-none focus:border-orange-500 transition"
                />
              </div>
            </div>
          ) : (
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
                    onClick={() => handleAddToCombo(selectedProduct, selectedQuantity)}
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
                              onClick={() => handleUpdateComboQty(item.id, -1)}
                              className="px-1.5 py-0.5 text-slate-400 hover:text-white"
                            >
                              -
                            </button>
                            <span className="px-2 text-[11px] font-mono font-bold text-white">
                              {item.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateComboQty(item.id, 1)}
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
                            onClick={() => handleRemoveFromCombo(item.id)}
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
          )}

          {/* Nivel de Usuario en Cashea */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Nivel de Usuario en Cashea:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedNivel(1)}
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
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
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
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
                className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
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

        {/* COLUMNA DERECHA: RESUMEN DE PAGO, BARRA $25 Y BOTÓN WHATSAPP */}
        <div className="lg:col-span-5 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between sticky top-6">
          <div className="space-y-4">
            <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Plan de Pago Cashea</h3>
                <p className="text-xs text-slate-400">3 Cuotas Quincenales sin Interés (Tienda Física)</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center">
                <ShoppingBag size={18} />
              </div>
            </div>

            {/* BARRA DE PROGRESO Y AVISO DE MÍNIMO $25 */}
            {!qualifiesCashea ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    <span>Faltan ${amountShort.toFixed(2)} USD</span>
                  </span>
                  <span className="font-mono text-slate-400">
                    ${totalUsd.toFixed(2)} / $25.00
                  </span>
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(8, (totalUsd / 25) * 100))}%` }}
                  />
                </div>

                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Cashea aplica a partir de <strong>$25 USD</strong> en tienda física. Puedes sumar otro repuesto o aumentar la cantidad para activar las 3 cuotas.
                </p>

                {/* Sugerencias rápidas para completar el combo */}
                {products.length > 1 && (
                  <div className="pt-1 border-t border-amber-500/20 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-amber-300/80 block">
                      💡 Sugerencias rápidas para llegar a los $25:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {products
                        .filter(p => selectedProduct && String(p.id) !== String(selectedProduct.id))
                        .slice(0, 3)
                        .map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleAddToCombo(p, 1)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={11} />
                            <span>{p.modelo} (${parseFloat(p.precio_usd).toFixed(2)})</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-fade-in">
                <span className="flex items-center gap-2 font-bold">
                  <PackageCheck size={17} className="text-emerald-400" />
                  <span>¡Mínimo de $25 Cashea alcanzado!</span>
                </span>
                <span className="font-mono font-black text-emerald-400">${totalUsd.toFixed(2)} USD</span>
              </div>
            )}

            {/* Inicial a pagar hoy */}
            <div className={`p-4 rounded-2xl space-y-1 border ${
              qualifiesCashea
                ? 'bg-orange-500/10 border-orange-500/30'
                : 'bg-slate-900/40 border-slate-800'
            }`}>
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
            type="button"
            onClick={handleCopyQuote}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95 cursor-pointer"
          >
            {copiedCombo || copiedId === 'manual' ? (
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
