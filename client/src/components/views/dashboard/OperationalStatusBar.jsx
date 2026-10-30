import { Clock, QrCode } from 'lucide-react';

export default function OperationalStatusBar({ isConnected, horarioTexto, onNavigate }) {
  return (
    <div className="bg-gradient-to-r from-[#0a0f1d] via-[#11192e] to-[#0a0f1d] border border-slate-800/80 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center font-black text-sm shrink-0">
          CR
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Crastur Insumos & Repuestos</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              San Agustín Norte, Caracas
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Insumos de cauchera, lubricantes y repuestos de moto
          </p>
        </div>
      </div>

      {/* Semáforo de WhatsApp & Bot */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#070b14] border border-slate-800 text-xs">
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
          <span className="text-slate-300 font-medium">
            WhatsApp: <strong className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>{isConnected ? 'En Línea' : 'Desconectado'}</strong>
          </span>
        </div>

        {!isConnected && (
          <button
            onClick={() => onNavigate && onNavigate('whatsapp')}
            className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-orange-500/20 active:scale-95"
          >
            <QrCode size={14} />
            <span>Vincular</span>
          </button>
        )}

        <div className="px-3 py-1.5 rounded-xl bg-[#070b14] border border-slate-800 text-xs text-slate-300 font-medium hidden sm:flex items-center gap-1.5">
          <Clock size={13} className="text-orange-400" />
          <span>{horarioTexto}</span>
        </div>
      </div>
    </div>
  );
}
