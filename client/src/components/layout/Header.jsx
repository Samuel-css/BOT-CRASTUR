import { DollarSign, RefreshCw, QrCode, CheckCircle2, Menu, PauseCircle, PlayCircle } from 'lucide-react';
import { formatRate } from '../../utils/formatters';

export default function Header({
  activeTab,
  bcvData,
  onRefreshBCV,
  loadingBCV,
  waStatus = { status: 'disconnected', qr: null, user: null },
  onToggleMobileMenu,
  botPausedGlobal,
  onToggleBotPause,
  onNavigate
}) {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Panel Principal';
      case 'inbox':
        return 'Live Inbox - Chat en Vivo';
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

  const status = waStatus?.status || 'disconnected';

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

        <div className="min-w-0">
          <h2 className="text-xs sm:text-base font-bold text-white tracking-wide flex items-center gap-2 truncate max-w-[130px] sm:max-w-none">
            {getTabTitle()}
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-400 hidden lg:block">
            Insumos para Caucheras, Repuestos de Moto & Otros Productos
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Botón de Pausa / Reanudación Global del Bot */}
        <button
          onClick={onToggleBotPause}
          type="button"
          title={botPausedGlobal ? 'El bot está silenciado. Clic para reactivar respuestas automáticas.' : 'El bot está respondiendo automáticamente. Clic para pausarlo.'}
          className={`h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition cursor-pointer shadow-sm shrink-0 ${
            botPausedGlobal
              ? 'bg-amber-950/50 border-amber-500/80 text-amber-300 hover:bg-amber-900/60 hover:border-amber-400'
              : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400'
          }`}
        >
          {botPausedGlobal ? (
            <>
              <PlayCircle size={14} className="text-amber-400 shrink-0 animate-pulse" />
              <span><span className="hidden sm:inline">Bot: </span>Pausa</span>
            </>
          ) : (
            <>
              <PauseCircle size={14} className="text-emerald-400 shrink-0" />
              <span><span className="hidden sm:inline">Bot: </span>Activo</span>
            </>
          )}
        </button>

        {/* Badge Tasa BCV Oficial */}
        <div className="h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-sm shrink-0">
          <DollarSign size={13} className="text-orange-400 shrink-0" />
          <div className="flex flex-col justify-center text-left">
            <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none hidden xs:block">
              BCV
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-white font-mono leading-none mt-0.5">
              Bs. {formatRate(bcvData?.tasa_efectiva || 849.56)}
            </span>
          </div>
          <button
            onClick={onRefreshBCV}
            disabled={loadingBCV}
            title="Sincronizar directamente con BCV"
            className="p-1 hover:bg-orange-500/20 rounded-lg text-slate-400 hover:text-orange-400 transition disabled:opacity-50 ml-0.5"
          >
            <RefreshCw size={12} className={loadingBCV ? 'animate-spin text-orange-400' : ''} />
          </button>
        </div>

        {/* Botón interactivo de Estado de WhatsApp */}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('whatsapp')}
          title="Clic para gestionar la conexión de WhatsApp o escanear QR"
          className={`h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition cursor-pointer active:scale-95 shadow-sm shrink-0 ${
            status === 'connected'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400 hover:border-emerald-500'
              : status === 'qr_ready'
              ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500/60 text-orange-300 hover:border-orange-400 animate-pulse'
              : status === 'connecting'
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              : 'bg-rose-950/30 border-rose-800/50 text-rose-300 hover:border-rose-500 hover:text-rose-200'
          }`}
        >
          {status === 'connected' ? (
            <>
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span><span className="hidden sm:inline">WhatsApp </span>Activo</span>
            </>
          ) : status === 'qr_ready' ? (
            <>
              <QrCode size={14} className="text-orange-400 shrink-0 animate-pulse" />
              <span>QR</span>
            </>
          ) : status === 'connecting' ? (
            <>
              <RefreshCw size={13} className="text-amber-400 shrink-0 animate-spin" />
              <span className="hidden sm:inline">Conectando...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div>
              <span><span className="hidden sm:inline">WhatsApp </span>Offline</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
