import {
  Package,
  Wrench,
  LayoutDashboard,
  MessageSquare,
  Calculator,
  QrCode,
  Users,
  Settings,
  MapPin,
  ExternalLink,
  Clock,
  X
} from 'lucide-react';

function MotorcycleIcon({ className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h4.2c.45 2.31 2.44 4 4.9 4 2.8 0 5-2.2 5-5 0-2.55-1.92-4.63-4.41-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H5v2h2.82zm11.36 2c-1.63 0-3-1.37-3-3 0-.55.18-1.05.45-1.5l1.78 2.37 1.6-1.2-2.14-2.85c.41-.52 1.05-.82 1.71-.82 1.63 0 3 1.37 3 3s-1.37 3-3 3z" />
    </svg>
  );
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  productCount,
  reservationCount,
  waStatus = { status: 'disconnected', qr: null, user: null },
  mobileMenuOpen,
  onCloseMobileMenu
}) {
  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const navContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Logo Brand */}
        <div className="p-5 border-b border-slate-800/80 bg-[#070b14]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30 text-white shrink-0">
                <MotorcycleIcon className="w-6 h-6 text-white drop-shadow-sm" />
              </div>
              <div className="min-w-0">
                <h1 className="font-black text-lg text-white tracking-wider leading-none">CRASTUR</h1>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 whitespace-nowrap inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                    MOTO & CAUCHERA
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                  <Wrench size={10} className="text-orange-400/80 shrink-0" />
                  <span className="truncate">Insumos & Repuestos</span>
                </p>
              </div>
            </div>

            {isMobile && (
              <button
                onClick={onCloseMobileMenu}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Enlace directo a Google Maps */}
          <a
            href="https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3.5 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs hover:border-orange-500/40 hover:text-orange-400 transition group"
            title="Abrir ubicación en Google Maps"
          >
            <MapPin size={14} className="shrink-0 text-orange-400 group-hover:scale-110 transition-transform" />
            <span className="truncate font-medium">San Agustín, Caracas</span>
            <ExternalLink size={12} className="ml-auto shrink-0 text-slate-500 group-hover:text-orange-400" />
          </a>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {/* Bloque: General */}
          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <LayoutDashboard size={18} className="shrink-0" />
              <span className="truncate whitespace-nowrap">Dashboard</span>
            </button>
          </div>

          {/* Separador estético: Operaciones */}
          <div className="pt-3 pb-1 px-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Operaciones
            </span>
          </div>

          <div className="space-y-1">
            {/* Live Inbox */}
            <button
              onClick={() => handleNavClick('inbox')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'inbox'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <MessageSquare size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Live Inbox</span>
              </div>
              <span className={`shrink-0 ml-2 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                activeTab === 'inbox'
                  ? 'bg-slate-950/40 text-slate-950'
                  : waStatus?.status === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {waStatus?.status === 'connected' ? 'En Vivo' : 'Sin WhatsApp'}
              </span>
            </button>

            <button
              onClick={() => handleNavClick('products')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'products'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Package size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Catálogo Productos</span>
              </div>
              <span className={`shrink-0 ml-2 text-xs px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'products'
                  ? 'bg-slate-950/30 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {productCount}
              </span>
            </button>

            {/* Apartados 24h */}
            <button
              onClick={() => handleNavClick('reservations')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'reservations'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Clock size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Apartados (24h)</span>
              </div>
              {reservationCount > 0 ? (
                <span className={`shrink-0 ml-2 text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === 'reservations'
                    ? 'bg-slate-950 text-orange-400'
                    : 'bg-orange-500 text-slate-950'
                }`}>
                  {reservationCount}
                </span>
              ) : (
                <span className="shrink-0 ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  0
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavClick('calculator')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'calculator'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Calculator size={18} className="shrink-0" />
              <span className="truncate whitespace-nowrap">Calculadora Cashea</span>
            </button>
          </div>

          {/* Separador estético: Sistema & Bot */}
          <div className="pt-3 pb-1 px-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Sistema & Bot
            </span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('whatsapp')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'whatsapp'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <QrCode size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Conexión WhatsApp</span>
              </div>
              {waStatus?.status === 'connected' ? (
                <span className="shrink-0 ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Conectado
                </span>
              ) : waStatus?.status === 'qr_ready' ? (
                <span className="shrink-0 ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  Escanear QR
                </span>
              ) : waStatus?.status === 'connecting' ? (
                <span className="shrink-0 ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Conectando...
                </span>
              ) : (
                <span className="shrink-0 ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-950/40 text-rose-400 border border-rose-800/60">
                  Desconectado
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavClick('sellers')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'sellers'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Users size={18} className="shrink-0" />
              <span className="truncate whitespace-nowrap">Asesores de Ventas</span>
            </button>

            <button
              onClick={() => handleNavClick('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Settings size={18} className="shrink-0" />
              <span className="truncate whitespace-nowrap">Configuración</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-[#070b14]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
          <span className="text-xs text-slate-300 font-semibold">Crastur Repuestos</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">Caracas • San Agustín</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar fijo en Desktop */}
      <aside className="hidden md:flex w-68 bg-[#0a0f1d] border-r border-slate-800/80 flex-col justify-between shrink-0">
        {navContent(false)}
      </aside>

      {/* Drawer móvil */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            onClick={onCloseMobileMenu}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] border-r border-slate-800 shadow-2xl flex flex-col justify-between animate-slide-in-left">
            {navContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
