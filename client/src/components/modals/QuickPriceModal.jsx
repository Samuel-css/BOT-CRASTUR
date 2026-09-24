import { useState, useEffect, useRef } from 'react';
import { Search, X, Copy, Check, Package, Sparkles } from 'lucide-react';
import { formatBs, formatRate } from '../../utils/formatters';

export default function QuickPriceModal({ isOpen, onClose, products = [], bcvData }) {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const inputRef = useRef(null);
  const tasa = bcvData?.tasa_efectiva || 849.56;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCopiedId(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Escuchar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cleanQuery = query.toLowerCase().trim();
  const filtered = products.filter(p => {
    if (!cleanQuery) return true;
    const text = `${p.marca} ${p.modelo} ${p.categoria} ${p.descripcion || ''}`.toLowerCase();
    return cleanQuery.split(' ').every(token => text.includes(token));
  }).slice(0, 8);

  const handleCopyPrice = (p) => {
    const precioUsd = parseFloat(p.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    const textToCopy = `*${p.marca} - ${p.modelo}*\n💵 *$${precioUsd.toFixed(2)} USD* (Bs. ${formatBs(precioBs)})\n📦 Disponible en tienda física Crastur (San Agustín Norte)`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto pt-10 sm:pt-16">
      <div 
        className="w-full max-w-2xl bg-[#0b101b] border border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO DEL BUSCADOR */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <Search size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe bujía, sbr, pastillas, aceite, parches..."
              className="w-full bg-transparent text-white text-base sm:text-lg font-bold placeholder-slate-500 focus:outline-none"
            />
          </div>
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition text-xs font-mono"
            title="Cerrar (Esc)"
          >
            ESC
          </button>
        </div>

        {/* BARRA INFORMATIVA DE TASA EN VIVO */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Sparkles size={12} className="text-orange-400" />
            <strong className="text-slate-300">Modo Mostrador Rápido</strong> - Consulta en 1 segundo
          </span>
          <span className="font-mono font-bold text-orange-300">
            Tasa BCV: Bs. {formatRate(tasa)}
          </span>
        </div>

        {/* LISTADO DE RESULTADOS EN GRANDE */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              <Package size={32} className="mx-auto text-slate-600 mb-2 opacity-60" />
              <p>No se encontraron productos con <strong className="text-white">"{query}"</strong></p>
              <p className="text-xs text-slate-500 mt-1">Prueba con otra palabra clave o modelo de moto</p>
            </div>
          ) : (
            filtered.map((p) => {
              const precioUsd = parseFloat(p.precio_usd) || 0;
              const precioBs = precioUsd * tasa;
              const hasCashea = precioUsd >= 25;
              const casheaInicial = precioUsd * 0.40;
              const isCopied = copiedId === p.id;
              const hasStock = p.stock > 0;

              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-orange-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {p.categoria}
                      </span>
                      {hasStock ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          ✅ Stock: {p.stock} unids
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/50">
                          ⚠️ Agotado
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-white truncate">
                      {p.marca} - {p.modelo}
                    </h4>
                    {p.descripcion && (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {p.descripcion}
                      </p>
                    )}

                    {hasCashea && (
                      <div className="mt-1.5 text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                        <span>💛 Cashea: Inicial ${casheaInicial.toFixed(2)} + 3 cuotas quincenales</span>
                      </div>
                    )}
                  </div>

                  {/* PRECIOS EN GRANDE Y BOTÓN COPIAR */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <div className="text-left sm:text-right">
                      <div className="text-lg sm:text-xl font-extrabold text-orange-400 font-mono leading-none">
                        ${precioUsd.toFixed(2)} <span className="text-xs font-sans text-slate-400">USD</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white font-mono mt-1">
                        Bs. {formatBs(precioBs)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopyPrice(p)}
                      title="Copiar precio para enviar por WhatsApp"
                      className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                        isCopied
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                          : 'bg-slate-800 hover:bg-orange-500/20 hover:border-orange-500/50 text-slate-300 hover:text-white border-slate-700'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} className="text-emerald-400" />
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span className="hidden sm:inline">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PIE DE PÁGINA */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-center text-xs text-slate-500">
          Tip: Presiona <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">F2</kbd> en cualquier momento para abrir esta consulta rápida.
        </div>
      </div>
    </div>
  );
}
