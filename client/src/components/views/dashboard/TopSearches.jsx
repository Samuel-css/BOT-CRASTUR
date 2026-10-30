import { TrendingUp } from 'lucide-react';

export default function TopSearches({ topBusquedas }) {
  return (
    <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-orange-400" />
          Top Repuestos e Insumos Más Consultados
        </h3>
        <span className="text-[11px] text-slate-500">Tendencia WhatsApp</span>
      </div>

      {!topBusquedas || topBusquedas.length === 0 ? (
        <div className="p-8 text-center bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-1">
          <p className="text-xs text-slate-400">Aún no hay búsquedas registradas en el bot.</p>
          <p className="text-[11px] text-slate-500">A medida que los clientes pregunten, aquí verás las piezas más cotizadas.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {topBusquedas.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-[#070b14] rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-orange-500/15 text-orange-400 font-mono font-bold text-xs flex items-center justify-center border border-orange-500/25">
                  {idx + 1}
                </span>
                <span className="font-semibold text-xs text-white capitalize">{item.detalle}</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {item.total} {item.total === 1 ? 'consulta' : 'consultas'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
