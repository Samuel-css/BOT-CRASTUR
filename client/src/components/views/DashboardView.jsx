import { useEffect, useState } from 'react';
import {
  Car,
  Clock,
  Sparkles,
  DollarSign,
  Plus,
  QrCode,
  MapPin,
  ExternalLink,
  ArrowRight,
  Users,
  AlertTriangle,
  Package,
  Layers,
  CheckCircle2,
  Copy,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRate } from '../../utils/formatters';
import { copyInstagramCaption, InstagramIcon } from '../../utils/instagramFormatter';

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

export default function DashboardView({
  products = [],
  reservations = [],
  metrics = {},
  bcvData = {},
  waStatus = {},
  onNavigate,
  onOpenProductModal
}) {
  const effectiveRate = bcvData?.tasa_efectiva || 849.56;
  const isConnected = waStatus?.status === 'connected';

  // Apartados activos y monto total
  const activeReservations = reservations.filter(r => r.estado === 'activo');
  const totalApartadosUsd = activeReservations.reduce(
    (sum, r) => sum + parseFloat(r.precio_usd || 0),
    0
  );

  // Alertas de Stock Crítico (stock <= 3)
  const lowStockItems = products
    .filter(p => p.activo !== 0 && p.stock !== null && p.stock !== undefined && p.stock <= 3)
    .sort((a, b) => (a.stock || 0) - (b.stock || 0));

  // Combos & Kits activos
  const activeCombos = products.filter(
    p => p.categoria === 'Combos & Kits' && p.activo !== 0
  );

  const handleCopyComboCaption = (combo) => {
    copyInstagramCaption(combo, effectiveRate);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. BARRA DE ESTADO OPERATIVO EN VIVO */}
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
              Venta al mayor y detal • Insumos de cauchera, lubricantes y repuestos de moto
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
            <span>Lun-Sáb: 8am - 8pm</span>
          </div>
        </div>
      </div>

      {/* 2. 4 TARJETAS DE RENDIMIENTO CLAVE (KPIS DE ALTO IMPACTO) */}
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
            {activeReservations.length}
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
            {products.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{activeCombos.length} combos listos</span>
            {lowStockItems.length > 0 ? (
              <span className="text-rose-400 font-bold">{lowStockItems.length} bajo stock</span>
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

      {/* 3. TASA BCV & CALCULADOR REFERENCIAL */}
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

      {/* 4. ACCESOS RÁPIDOS DE TIENDA */}
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
              <p className="text-[11px] text-slate-400">{activeReservations.length} reservas activas</p>
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

      {/* 5. DOS COLUMNAS: ALERTAS DE STOCK CRÍTICO & COMBOS DE INSTAGRAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WIDGET: Alertas de Stock Crítico */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className={lowStockItems.length > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'} />
              <h3 className="text-sm font-bold text-white">
                Alertas de Stock Crítico (Insumos & Repuestos)
              </h3>
            </div>
            <button
              onClick={() => onNavigate('catalog')}
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

        {/* WIDGET: Combos & Kits de Instagram Activos */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-orange-400" />
              <h3 className="text-sm font-bold text-white">
                Combos & Kits para Instagram
              </h3>
            </div>
            <button
              onClick={onOpenProductModal}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <span>+ Nuevo Combo</span>
            </button>
          </div>

          {activeCombos.length === 0 ? (
            <div className="p-6 text-center bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-2">
              <p className="text-xs text-slate-400">No hay combos registrados bajo la categoría "Combos & Kits".</p>
              <button
                onClick={onOpenProductModal}
                className="px-3 py-1.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold hover:bg-orange-500/30 transition cursor-pointer"
              >
                Crear Primer Combo
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeCombos.slice(0, 4).map((combo) => (
                <div
                  key={combo.id}
                  className="p-3 bg-[#070b14] rounded-2xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition"
                >
                  <div className="min-w-0 pr-2">
                    <h5 className="font-bold text-xs text-white truncate">
                      {combo.modelo}
                    </h5>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {combo.descripcion || 'Kit promocional'}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-400 font-mono">
                      ${parseFloat(combo.precio_usd || 0).toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleCopyComboCaption(combo)}
                      title="Copiar post listo para Instagram"
                      className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                    >
                      <InstagramIcon size={13} />
                      <span className="hidden sm:inline">Instagram</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. GRID: APARTADOS RECIENTES Y TOP REPUESTOS MÁS BUSCADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Apartados Recientes */}
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

        {/* Repuestos más buscados */}
        <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-orange-400" />
              Top Repuestos e Insumos Más Consultados
            </h3>
            <span className="text-[11px] text-slate-500">Tendencia WhatsApp</span>
          </div>

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
