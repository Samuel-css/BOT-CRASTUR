import { useState } from 'react';
import { Clock, User, CheckCircle, Search, ExternalLink, Eye } from 'lucide-react';
import { formatBs, formatTimeRemaining } from '../../utils/formatters';

export default function ReservationsView({
  reservations,
  onMarkDelivered,
  onCancelReservation,
  onViewDetails
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('activo'); // 'activo' | 'all'

  const filtered = reservations.filter(r => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (r.nombre || '').toLowerCase().includes(q) ||
      (r.cedula || '').toLowerCase().includes(q) ||
      (r.telefono || '').toLowerCase().includes(q) ||
      (r.producto_nombre || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || r.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner Informativo */}
      <div className="bg-gradient-to-r from-orange-500/15 via-[#0a0f1d] to-[#0a0f1d] border border-orange-500/25 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
            <Clock size={18} />
            <span>Sistema de Apartados con Límite de 24 Horas</span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Los clientes pueden apartar piezas desde WhatsApp indicando su Nombre, Cédula y Teléfono. El apartado vence estrictamente a las 24 horas continuas; si no es retirado en tienda física, el sistema libera el stock automáticamente.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-5 py-3 rounded-2xl bg-[#070b14] border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Activos Ahora</span>
            <span className="text-2xl font-black text-orange-400 font-mono">
              {reservations.filter(r => r.estado === 'activo').length}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0a0f1d] p-3.5 rounded-2xl border border-slate-800/80 shadow-md">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, cédula o repuesto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('activo')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
              statusFilter === 'activo'
                ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Solo Activos (24h)
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${
              statusFilter === 'all'
                ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todos los Registros
          </button>
        </div>
      </div>

      {/* Grid de Apartados */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-[#0a0f1d] border border-slate-800/80 rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#070b14] border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Clock size={28} />
          </div>
          <h4 className="font-bold text-base text-white">No hay apartados registrados</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Cuando un cliente solicite apartar un repuesto por WhatsApp o escriba "apartar", el bot le solicitará sus datos y aparecerá aquí con su cuenta regresiva.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((res) => {
            const time = formatTimeRemaining(res.expira_en);
            const cleanPhone = (res.telefono || '').replace(/[^\d+]/g, '').replace('+', '');
            const waLink = `https://wa.me/${cleanPhone}`;

            return (
              <div
                key={res.id}
                className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between card-hover"
              >
                <div className="space-y-3">
                  {/* Header de la tarjeta: Tiempo restante */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        time.statusColor === 'emerald'
                          ? 'bg-emerald-400 animate-pulse'
                          : time.statusColor === 'amber'
                          ? 'bg-orange-400 animate-ping'
                          : 'bg-rose-500'
                      }`}></div>
                      <span className={`text-xs font-bold font-mono ${
                        time.statusColor === 'emerald'
                          ? 'text-emerald-400'
                          : time.statusColor === 'amber'
                          ? 'text-orange-400'
                          : 'text-rose-400'
                      }`}>
                        {time.text}
                      </span>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#070b14] text-slate-400 border border-slate-800 font-mono font-medium">
                      24h Límite
                    </span>
                  </div>

                  {/* Datos del Cliente */}
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <User size={14} className="text-orange-400 shrink-0" />
                      <span className="truncate">{res.nombre}</span>
                    </h4>
                    <div className="flex items-center gap-2 text-xs mt-1.5 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono font-bold text-[11px]">
                        {res.cedula}
                      </span>
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 font-mono text-xs hover:underline flex items-center gap-1"
                        title="Abrir chat en WhatsApp"
                      >
                        {res.telefono}
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* Repuesto Apartado */}
                  <div className="p-3 bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Repuesto Reservado:</span>
                    <p className="font-bold text-xs text-white line-clamp-1">{res.producto_nombre}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-bold text-orange-400 font-mono">
                        ${parseFloat(res.precio_usd || 0).toFixed(2)} USD
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Bs. {formatBs(res.precio_bs || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones de la tarjeta */}
                <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onViewDetails(res)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Ver detalles"
                  >
                    <Eye size={15} />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onCancelReservation(res.id)}
                      className="px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 text-[11px] font-semibold transition"
                      title="Liberar apartado antes de tiempo"
                    >
                      Liberar
                    </button>
                    <button
                      onClick={() => onMarkDelivered(res.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition shadow-md shadow-emerald-500/20 active:scale-95"
                    >
                      <CheckCircle size={13} />
                      <span>Retirado</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
