import { Clock, ArrowRight } from 'lucide-react';
import { useRelativeTime } from './useRelativeTime';

function ReservationRow({ r }) {
  const { label, color } = useRelativeTime(r.expira_en);
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  };

  return (
    <div className="p-3.5 bg-[#070b14] rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition">
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1.5">
          <h5 className="font-bold text-xs text-white truncate">{r.nombre}</h5>
          {r.cedula && (
            <span className="text-[10px] text-slate-500 font-mono">({r.cedula})</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-[260px] mt-0.5">
          {r.producto_nombre}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="font-bold text-xs text-orange-400 font-mono block">
          ${parseFloat(r.precio_usd || 0).toFixed(2)} USD
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border inline-block mt-0.5 ${colorMap[color]}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default function ReservationAlerts({ activeReservations, onNavigate }) {
  return (
    <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock size={16} className="text-orange-400" />
          Apartados Activos Recientes
        </h3>
        <button
          onClick={() => onNavigate('reservations')}
          className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold cursor-pointer"
        >
          <span>Ver todos ({activeReservations.length})</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {activeReservations.length === 0 ? (
        <div className="p-8 text-center bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-1">
          <p className="text-xs text-slate-400">No hay apartados activos en este momento.</p>
          <p className="text-[11px] text-slate-500">Se generan cuando los clientes dicen "apartar" en WhatsApp.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeReservations.slice(0, 4).map((r) => (
            <ReservationRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
