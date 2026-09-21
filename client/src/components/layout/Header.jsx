import { DollarSign, RefreshCw, QrCode, CheckCircle2, Menu } from 'lucide-react';
import { formatRate } from '../../utils/formatters';

export default function Header({ activeTab, bcvData, onRefreshBCV, loadingBCV, waStatus, onToggleMobileMenu }) {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Panel Principal';
      case 'products':
        return 'Catálogo de Productos';
      case 'reservations':
        return 'Apartados de Productos (Límite 24h)';
      case 'calculator':
        return 'Calculadora de Financiamiento Cashea';
      case 'whatsapp':
        return 'Conexión a WhatsApp & Estado del Bot';
      case 'sellers':
        return 'Gestión de Asesores de Ventas';
      case 'settings':
        return 'Configuración General';
      default:
        return 'Crastur';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-3">
        {/* Botón menú móvil (hamburguesa) */}
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-orange-500/50 transition"
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>

        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
            {getTabTitle()}
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-400 hidden xs:block">
            Insumos para Caucheras, Repuestos de Moto & Otros Productos
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Badge Tasa BCV Oficial */}
        <div className="h-10 flex items-center gap-2 px-3 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-sm">
          <DollarSign size={15} className="text-orange-400 shrink-0" />
          <div className="flex flex-col justify-center text-left">
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none">
              BCV Oficial
            </span>
            <span className="text-xs font-bold text-white font-mono leading-none mt-1">
              Bs. {formatRate(bcvData?.tasa_efectiva || 849.56)}
            </span>
          </div>
          <button
            onClick={onRefreshBCV}
            disabled={loadingBCV}
            title="Sincronizar directamente con BCV"
            className="p-1 hover:bg-orange-500/20 rounded-lg text-slate-400 hover:text-orange-400 transition disabled:opacity-50 ml-0.5"
          >
            <RefreshCw size={13} className={loadingBCV ? 'animate-spin text-orange-400' : ''} />
          </button>
        </div>

        {/* Badge WhatsApp Status */}
        <div className={`h-10 flex items-center gap-2 px-3.5 rounded-xl border text-xs font-semibold transition ${
          waStatus.status === 'connected'
            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
            : waStatus.status === 'qr_ready'
            ? 'bg-orange-950/40 border-orange-800/60 text-orange-400'
            : 'bg-slate-900 border-slate-800/80 text-slate-400'
        }`}>
          {waStatus.status === 'connected' ? (
            <>
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span><span className="hidden sm:inline">WhatsApp </span>Activo</span>
            </>
          ) : waStatus.status === 'qr_ready' ? (
            <>
              <QrCode size={15} className="text-orange-400 animate-pulse shrink-0" />
              <span>Escanear QR</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-slate-500 shrink-0"></div>
              <span><span className="hidden sm:inline">Bot </span>Off</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
