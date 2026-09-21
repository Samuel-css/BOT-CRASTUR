import { useEffect, useState } from 'react';
import { Car, Clock, Sparkles, DollarSign, Plus, QrCode, MapPin, ExternalLink, ArrowRight, Users } from 'lucide-react';
import { formatRate } from '../../utils/formatters';

function useRelativeTime(expiraEn) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('emerald');

  useEffect(() => {
    function calc() {
      const msLeft = Number(expiraEn) - Date.now();
      if (msLeft <= 0) { setLabel('Vencido'); setColor('rose'); return; }
      const h = Math.floor(msLeft / 3600000);
      const m = Math.floor((msLeft % 3600000) / 60000);
      if (h < 2) { setColor('rose'); }
      else if (h < 6) { setColor('orange'); }
      else { setColor('emerald'); }
      setLabel(h > 0 ? `${h}h ${m}m restantes` : `${m}m restantes`);
    }
    calc();
    const timer = setInterval(calc, 30000);
    return () => clearInterval(timer);
  }, [expiraEn]);

  return { label, color };
}

function ReservationRow({ r }) {
  const { label, color } = useRelativeTime(r.expira_en);
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  };

  return (
    <div className="p-3.5 bg-[#070b14] rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition">
      <div>
        <h5 className="font-bold text-xs text-white">{r.nombre}</h5>
        <p className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-[240px] mt-0.5">{r.producto_nombre}</p>
      </div>
      <div className="text-right">
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

export default function DashboardView({
  products,
  reservations,
  metrics,
  bcvData,
  onNavigate,
  onOpenProductModal
}) {
  const activeReservations = reservations.filter(r => r.estado === 'activo');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 4 KPI CARDS con efectos hover y paleta gris/naranja */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Repuestos */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl card-hover animate-fade-in-up delay-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Repuestos</span>
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/25">
              <Car size={17} />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono mt-3">
            {products.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">En catálogo activo</p>
        </div>

        {/* KPI 2: Apartados 24h */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl card-hover animate-fade-in-up delay-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Apartados Activos (24h)</span>
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center border border-orange-500/25">
              <Clock size={17} />
            </div>
          </div>
          <div className="text-3xl font-black text-orange-400 font-mono mt-3">
            {activeReservations.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Con reserva vigente</p>
        </div>

        {/* KPI 3: Consultas Bot */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl card-hover animate-fade-in-up delay-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Consultas de Clientes</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
              <Sparkles size={17} />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 font-mono mt-3">
            {metrics.consultas_hoy || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Atendidas hoy por WhatsApp</p>
        </div>

        {/* KPI 4: Total Clientes WA */}
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
          <p className="text-[11px] text-slate-500 mt-1">Contactos únicos registrados</p>
        </div>
      </div>

      {/* Tasa BCV destacada con diseño corporativo */}
      <div className="bg-gradient-to-r from-orange-500/10 via-[#0a0f1d] to-[#0a0f1d] border border-orange-500/20 rounded-3xl p-5 sm:p-6 flex items-center justify-between shadow-xl animate-fade-in-up delay-150">
        <div>
          <p className="text-xs text-orange-400/90 font-bold uppercase tracking-wider">Tasa Oficial Banco Central de Venezuela (BCV)</p>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
            Bs. {formatRate(bcvData?.tasa_efectiva || 849.56)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{bcvData?.fecha_tasa || 'Sincronizada con bcv.org.ve'}</p>
        </div>
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
          <DollarSign size={26} />
        </div>
      </div>

      {/* ACCESOS RÁPIDOS DE TIENDA */}
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-fade-in-up delay-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-orange-400" />
            Accesos Rápidos del Negocio
          </h3>
          <span className="text-xs text-slate-400 font-medium">Gestión directa de tienda</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={onOpenProductModal}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-orange-500/50 hover:bg-slate-900 transition text-left group card-hover-subtle"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-orange-500/25">
              <Plus size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Agregar Repuesto</h4>
              <p className="text-[11px] text-slate-400">Registrar pieza o accesorio</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('reservations')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-orange-500/50 hover:bg-slate-900 transition text-left group card-hover-subtle"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-orange-500/25">
              <Clock size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Ver Apartados (24h)</h4>
              <p className="text-[11px] text-slate-400">{activeReservations.length} piezas apartadas</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('whatsapp')}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-900 transition text-left group card-hover-subtle"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-emerald-500/25">
              <QrCode size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Conexión a WhatsApp</h4>
              <p className="text-[11px] text-slate-400">Código QR y estado</p>
            </div>
          </button>

          <a
            href="https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#070b14] border border-slate-800/80 hover:border-orange-500/50 hover:bg-slate-900 transition text-left group card-hover-subtle"
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

      {/* Grid: Apartados Recientes y Repuestos más buscados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Apartados Recientes */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-fade-in-up delay-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-orange-400" />
              Apartados Activos Recientes
            </h3>
            <button
              onClick={() => onNavigate('reservations')}
              className="text-xs text-orange-400 hover:text-orange-300 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Ver todos</span>
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

        {/* Repuestos más buscados */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-fade-in-up delay-400">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-orange-400" />
            Top Repuestos Más Consultados
          </h3>

          {!metrics.top_busquedas || metrics.top_busquedas.length === 0 ? (
            <div className="p-8 text-center bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-1">
              <p className="text-xs text-slate-400">Aún no hay búsquedas registradas en el bot.</p>
              <p className="text-[11px] text-slate-500">A medida que los clientes pregunten, aquí verás las piezas más cotizadas.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {metrics.top_busquedas.map((item, idx) => (
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
      </div>
    </div>
  );
}
