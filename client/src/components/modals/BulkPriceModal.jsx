import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Percent,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  X,
  Check,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

export default function BulkPriceModal({
  isOpen,
  onClose,
  products = [],
  categories = [],
  bcvRate = 849.56,
  onSuccess
}) {
  const [categoria, setCategoria] = useState('all');
  const [direccion, setDireccion] = useState('aumentar'); // 'aumentar' | 'disminuir'
  const [tipo, setTipo] = useState('percentage'); // 'percentage' | 'fixed'
  const [valor, setValor] = useState('10');
  const [loading, setLoading] = useState(false);

  // Filtrar productos seleccionados
  const targetProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoria === 'all') return true;
      const cat = p.categoria || '';
      return cat === categoria || cat.startsWith(`${categoria} -`);
    });
  }, [products, categoria]);

  // Calcular previsualización de precios
  const previewProducts = useMemo(() => {
    const numVal = parseFloat(valor);
    if (isNaN(numVal) || numVal <= 0) return [];

    return targetProducts.slice(0, 10).map((p) => {
      const oldPrice = parseFloat(p.precio_usd) || 0;
      let newPrice = oldPrice;
      if (tipo === 'percentage') {
        const factor = numVal / 100;
        newPrice = direccion === 'disminuir' ? oldPrice * (1 - factor) : oldPrice * (1 + factor);
      } else {
        newPrice = direccion === 'disminuir' ? oldPrice - numVal : oldPrice + numVal;
      }
      newPrice = Math.max(0.01, Math.round(newPrice * 100) / 100);
      const diff = newPrice - oldPrice;
      return {
        ...p,
        oldPrice,
        newPrice,
        diff
      };
    });
  }, [targetProducts, valor, tipo, direccion]);

  if (!isOpen) return null;

  const handleApply = async () => {
    const numVal = parseFloat(valor);
    if (isNaN(numVal) || numVal <= 0) {
      toast.error('Ingresa un valor mayor a cero');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/products/bulk-price-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          valor: numVal,
          categoria,
          direccion
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`¡Listo! Se actualizaron los precios de ${data.count} productos`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Error al aplicar ajuste masivo');
      }
    } catch (err) {
      toast.error('Error de conexión al ajustar precios');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
    >
      <div
        className="w-full max-w-2xl bg-[#0a0f1d] border border-orange-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-orange-500/15 flex flex-col max-h-[88vh] my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fijo */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#070b14] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Ajuste Masivo de Precios</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  En 1 Clic
                </span>
              </h3>
              <p className="text-xs text-slate-400">Actualiza 100+ productos al mismo tiempo sin editar uno a uno</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Formulario con scroll independiente y min-h-0 */}
        <div className="p-4 sm:p-5 overflow-y-auto min-h-0 space-y-4 flex-1">
          {/* 1. Categoría o alcance */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              1. Selecciona a qué productos aplicar:
            </label>
            <div className="relative">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full appearance-none bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 pr-10 text-xs sm:text-sm text-white focus:outline-none focus:border-orange-500 transition cursor-pointer font-medium"
              >
                <option value="all">Todo el Catálogo ({products.length} productos)</option>
                {categories.map((c, i) => (
                  <option key={i} value={c}>
                    Categoría: {c}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* 2. Dirección: Aumentar o Disminuir */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              2. Acción:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDireccion('aumentar')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition cursor-pointer ${
                  direccion === 'aumentar'
                    ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ArrowUpRight size={17} className="text-emerald-400" />
                <span>Aumentar Precios (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setDireccion('disminuir')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition cursor-pointer ${
                  direccion === 'disminuir'
                    ? 'bg-rose-950/60 border-rose-500/80 text-rose-300 shadow-md shadow-rose-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ArrowDownRight size={17} className="text-rose-400" />
                <span>Disminuir Precios (-)</span>
              </button>
            </div>
          </div>

          {/* 3. Tipo: Porcentaje vs Monto Fijo */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              3. Tipo de Cálculo y Valor:
            </label>
            <div className="flex items-center gap-2 mb-2.5">
              <button
                type="button"
                onClick={() => setTipo('percentage')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  tipo === 'percentage'
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <Percent size={14} />
                <span>Porcentaje (%)</span>
              </button>
              <button
                type="button"
                onClick={() => setTipo('fixed')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  tipo === 'fixed'
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <DollarSign size={14} />
                <span>Monto Fijo ($ USD)</span>
              </button>
            </div>

            {/* Input y atajos rápidos */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold text-sm">
                  {tipo === 'percentage' ? '%' : '$'}
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={tipo === 'percentage' ? 'Ej: 10' : 'Ej: 2.50'}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-8 pr-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* Botones rápidos */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {tipo === 'percentage' ? (
                  <>
                    {['5', '10', '15', '20'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setValor(val)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          valor === val
                            ? 'bg-orange-500 text-slate-950 font-black border-orange-500'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {direccion === 'aumentar' ? `+${val}%` : `-${val}%`}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {['1', '2', '5', '10'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setValor(val)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          valor === val
                            ? 'bg-orange-500 text-slate-950 font-black border-orange-500'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {direccion === 'aumentar' ? `+$${val}` : `-$${val}`}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 4. Previsualización en Vivo */}
          <div className="p-3.5 bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-orange-400" />
                Previsualización en tiempo real ({targetProducts.length} productos afectados)
              </span>
              <span className="text-[11px] text-slate-500">Muestra hasta 10 artículos</span>
            </div>

            <div className="max-h-36 overflow-y-auto divide-y divide-slate-800/60 text-xs pr-1">
              {previewProducts.length === 0 ? (
                <p className="text-center py-4 text-slate-500">Ingresa un valor para ver la vista previa</p>
              ) : (
                previewProducts.map((p) => (
                  <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">
                        {p.marca} - {p.modelo}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase">{p.categoria}</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 font-mono text-right">
                      <span className="text-slate-500 line-through text-[11px]">
                        ${p.oldPrice.toFixed(2)}
                      </span>
                      <span className="text-white font-bold text-xs">${p.newPrice.toFixed(2)}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          p.diff >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {p.diff >= 0 ? `+$${p.diff.toFixed(2)}` : `-$${Math.abs(p.diff).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Siempre Visible (Sticky Bottom) */}
        <div className="p-4 bg-[#070b14] border-t border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-400">
            Afectará a <strong className="text-white font-mono">{targetProducts.length}</strong> productos
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={loading || targetProducts.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Check size={16} />
              <span>
                {loading ? 'Aplicando...' : `Aplicar a ${targetProducts.length} Productos`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
