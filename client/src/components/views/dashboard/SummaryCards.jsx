import { Clock, Package, Sparkles, Users } from 'lucide-react';

export default function SummaryCards({
  activeReservationsCount,
  totalApartadosUsd,
  productsCount,
  activeCombosCount,
  lowStockCount,
  metrics
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Apartados Activos y Monto */}
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl card-hover animate-fade-in-up delay-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Apartados Activos (24h)</span>
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/25">
            <Clock size={17} />
          </div>
        </div>
        <div className="text-3xl font-black text-orange-400 font-mono mt-3">
          {activeReservationsCount}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>Valor en espera:</span>
          <strong className="text-white font-mono font-bold">${totalApartadosUsd.toFixed(2)} USD</strong>
        </div>
      </div>

      {/* KPI 2: Inventario & Alertas */}
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl card-hover animate-fade-in-up delay-150">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Total en Catálogo</span>
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/25">
            <Package size={17} />
          </div>
        </div>
        <div className="text-3xl font-black text-white font-mono mt-3">
          {productsCount}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>{activeCombosCount} combos listos</span>
          {lowStockCount > 0 ? (
            <span className="text-rose-400 font-bold">{lowStockCount} bajo stock</span>
          ) : (
            <span className="text-emerald-400 font-medium">Stock óptimo</span>
          )}
        </div>
      </div>

      {/* KPI 3: Consultas Bot Hoy */}
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl card-hover animate-fade-in-up delay-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Consultas Atendidas Hoy</span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
            <Sparkles size={17} />
          </div>
        </div>
        <div className="text-3xl font-black text-emerald-400 font-mono mt-3">
          {metrics.consultas_hoy || 0}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Cotizaciones automáticas 24/7</p>
      </div>

      {/* KPI 4: Clientes Únicos */}
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl card-hover animate-fade-in-up delay-300">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">Clientes WhatsApp</span>
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/25">
            <Users size={17} />
          </div>
        </div>
        <div className="text-3xl font-black text-white font-mono mt-3">
          {metrics.total_clientes || 0}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Contactos únicos en cartera</p>
      </div>
    </div>
  );
}
