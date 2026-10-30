import { formatRate } from '../../../utils/formatters';

export default function BcvRateCard({ bcvData, effectiveRate }) {
  return (
    <div className="bg-gradient-to-r from-orange-500/10 via-[#0a0f1d] to-[#0a0f1d] border border-orange-500/20 rounded-3xl p-5 sm:p-6 shadow-xl animate-fade-in-up delay-150">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-orange-400 font-bold uppercase tracking-wider">
              Tasa Oficial Banco Central de Venezuela (BCV)
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-medium">
              Sin comisiones
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-1">
            Bs. {formatRate(effectiveRate)} <span className="text-sm font-normal text-slate-400">/ USD</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {bcvData?.fecha_tasa || 'Actualizada automáticamente con el BCV'}
          </p>
        </div>

        {/* Tabla de equivalencias rápidas para el mostrador */}
        <div className="bg-[#070b14] border border-slate-800/80 rounded-2xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-1.5 rounded-xl bg-slate-900/60">
            <span className="text-[10px] text-slate-400 block">$5 USD</span>
            <strong className="text-white font-mono text-[11px] font-bold">Bs. {formatRate(5 * effectiveRate)}</strong>
          </div>
          <div className="p-1.5 rounded-xl bg-slate-900/60">
            <span className="text-[10px] text-slate-400 block">$10 USD</span>
            <strong className="text-white font-mono text-[11px] font-bold">Bs. {formatRate(10 * effectiveRate)}</strong>
          </div>
          <div className="p-1.5 rounded-xl bg-slate-900/60">
            <span className="text-[10px] text-slate-400 block">$20 USD</span>
            <strong className="text-white font-mono text-[11px] font-bold">Bs. {formatRate(20 * effectiveRate)}</strong>
          </div>
          <div className="p-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <span className="text-[10px] text-orange-400 block font-semibold">$50 USD</span>
            <strong className="text-orange-300 font-mono text-[11px] font-bold">Bs. {formatRate(50 * effectiveRate)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
