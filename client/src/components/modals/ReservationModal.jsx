import { X, Clock, User, Phone, CreditCard, Package, ExternalLink, CheckCircle, Trash2 } from 'lucide-react';
import { formatBs, formatRate, formatTimeRemaining, formatDateTime } from '../../utils/formatters';

export default function ReservationModal({ isOpen, onClose, reservation, bcvRate, onMarkDelivered, onCancel }) {
  if (!isOpen || !reservation) return null;

  const time = formatTimeRemaining(reservation.expira_en);
  const cleanPhone = (reservation.telefono || '').replace(/[^\d+]/g, '').replace('+', '');
  const waUrl = `https://wa.me/${cleanPhone}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl shadow-black/80 animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Comprobante de Apartado (24h)</h3>
              <p className="text-xs text-slate-400">Detalles de la reserva y datos del cliente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Banner de Tiempo Restante */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            time.statusColor === 'emerald'
              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
              : time.statusColor === 'amber'
              ? 'bg-orange-950/40 border-orange-800/40 text-orange-400'
              : 'bg-rose-950/40 border-rose-800/40 text-rose-400'
          }`}>
            <div className="flex items-center gap-2.5">
              <Clock size={18} className="shrink-0" />
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider block">Tiempo de Reserva</span>
                <span className="text-sm font-bold font-mono">{time.text}</span>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 font-mono font-semibold">
              Límite 24h
            </span>
          </div>

          {/* Información del Cliente */}
          <div className="p-4 bg-[#070b14] rounded-2xl border border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <User size={13} className="text-orange-400" /> Datos del Cliente
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-500 block text-[11px]">Nombre y Apellido:</span>
                <span className="font-bold text-white text-sm">{reservation.nombre}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Cédula de Identidad:</span>
                <span className="font-bold text-slate-200 font-mono text-sm">{reservation.cedula}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[11px]">Teléfono de Contacto:</span>
                <span className="font-bold text-emerald-400 font-mono">{reservation.telefono}</span>
              </div>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-semibold transition"
              >
                <span>WhatsApp</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Información del Repuesto */}
          <div className="p-4 bg-[#070b14] rounded-2xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Package size={13} className="text-orange-400" /> Repuesto Apartado
            </h4>
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-sm text-white">{reservation.producto_nombre}</span>
              <div className="text-right">
                <span className="font-bold text-orange-400 font-mono text-base block">
                  ${parseFloat(reservation.precio_usd || 0).toFixed(2)} USD
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Bs. {formatBs(reservation.precio_bs || 0)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              Apartado registrado el {formatDateTime(reservation.creado_en)}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#070b14] border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onCancel(reservation.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 text-xs font-semibold transition"
          >
            <Trash2 size={14} /> Liberar Apartado
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => onMarkDelivered(reservation.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <CheckCircle size={14} /> Marcar como Retirado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
