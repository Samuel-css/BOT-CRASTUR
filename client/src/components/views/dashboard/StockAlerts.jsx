import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function StockAlerts({ lowStockItems, onNavigate }) {
  return (
    <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className={lowStockItems.length > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'} />
          <h3 className="text-sm font-bold text-white">
            Alertas de Stock Crítico (Insumos & Repuestos)
          </h3>
        </div>
        <button
          onClick={() => onNavigate('products')}
          className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold cursor-pointer"
        >
          <span>Ver catálogo</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="p-6 text-center bg-[#070b14] rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-xs font-semibold text-white">Inventario en Buen Estado</p>
          <p className="text-[11px] text-slate-400">
            No hay ningún insumo de cauchera, lubricante o repuesto con stock menor o igual a 3 unidades.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lowStockItems.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="p-3 bg-[#070b14] rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
            >
              <div className="min-w-0 pr-2">
                <h5 className="font-bold text-xs text-white truncate">
                  {item.marca ? `${item.marca} - ` : ''}{item.modelo}
                </h5>
                <span className="text-[10px] text-slate-400">
                  {item.categoria} • ${parseFloat(item.precio_usd || 0).toFixed(2)} USD
                </span>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  (item.stock || 0) <= 1
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}>
                  {item.stock <= 0 ? 'Agotado (0)' : `Quedan ${item.stock}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
