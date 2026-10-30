import { Sparkles, Plus, Clock, MessageSquare, MapPin, ExternalLink } from 'lucide-react';

export default function QuickAccess({ onOpenProductModal, onNavigate, activeReservationsCount }) {
  return (
    <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles size={16} className="text-orange-400" />
          Accesos Rápidos de la Tienda
        </h3>
        <span className="text-xs text-slate-400 font-medium">Operaciones directas</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={onOpenProductModal}
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-orange-500/50 hover:bg-slate-900 transition text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-orange-500/25">
            <Plus size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Agregar Producto / Combo</h4>
            <p className="text-[11px] text-slate-400">Crear pieza, insumo o kit</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('reservations')}
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-orange-500/50 hover:bg-slate-900 transition text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-orange-500/25">
            <Clock size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Apartados (24h)</h4>
            <p className="text-[11px] text-slate-400">{activeReservationsCount} reservas activas</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('inbox')}
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-900 transition text-left group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-emerald-500/25">
            <MessageSquare size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Live Inbox</h4>
            <p className="text-[11px] text-slate-400">Chats en vivo de WhatsApp</p>
          </div>
        </button>

        <a
          href="https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-orange-500/50 hover:bg-slate-900 transition text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-orange-500/25">
            <MapPin size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1">
              Tienda Física <ExternalLink size={11} className="text-slate-400" />
            </h4>
            <p className="text-[11px] text-slate-400">San Agustín, Caracas</p>
          </div>
        </a>
      </div>
    </div>
  );
}
