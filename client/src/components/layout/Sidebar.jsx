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
  X,
  PanelLeftClose,
  PanelLeftOpen
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

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'General' },
  { id: 'inbox', label: 'Live Inbox', icon: MessageSquare, section: 'Operaciones', type: 'inbox' },
  { id: 'products', label: 'Catálogo Productos', icon: Package, section: 'Operaciones', type: 'products' },
  { id: 'reservations', label: 'Apartados (24h)', icon: Clock, section: 'Operaciones', type: 'reservations' },
  { id: 'calculator', label: 'Calculadora Cashea', icon: Calculator, section: 'Operaciones' },
  { id: 'whatsapp', label: 'Conexión WhatsApp', icon: QrCode, section: 'Sistema & Bot', type: 'whatsapp' },
  { id: 'sellers', label: 'Asesores de Ventas', icon: Users, section: 'Sistema & Bot' },
  { id: 'settings', label: 'Configuración', icon: Settings, section: 'Sistema & Bot' },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  productCount = 0,
  reservationCount = 0,
  waStatus = { status: 'disconnected', qr: null, user: null },
  mobileMenuOpen,
  onCloseMobileMenu,
  isCollapsed = false,
  onToggleCollapse
}) {
  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (onCloseMobileMenu) onCloseMobileMenu();
  };

  const isConnected = waStatus?.status === 'connected';

  // Render para modo COLAPSADO (pantallas pequeñas / monitores viejos como 1024x768)
  const renderCollapsedNav = () => (
    <div className="flex flex-col justify-between h-full py-3 px-2">
      <div className="space-y-4">
        {/* Logo Icono */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => handleNavClick('dashboard')}
            className="w-12 h-12 flex items-center justify-center shrink-0 hover:scale-110 transition-transform cursor-pointer"
            title="Crastur - Repuestos de Moto & Cauchera"
          >
            <img src="/logo_icon.png" alt="Crastur" className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(255,107,0,0.4)]" />
          </button>
          
          <a
            href="https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-orange-400 hover:border-orange-500/50 hover:bg-slate-800 transition"
            title="Ubicación: San Agustín, Caracas (Google Maps)"
          >
            <MapPin size={14} />
          </a>
        </div>

        <div className="w-8 h-px bg-slate-800 mx-auto" />

        {/* Iconos de Navegación Compactos */}
        <nav className="space-y-1.5 flex flex-col items-center">
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="relative w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon size={19} className="shrink-0" />

                  {/* Indicadores en modo colapsado */}
                  {item.type === 'inbox' && (
                    <span
                      className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                        isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                  )}

                  {item.type === 'products' && productCount > 0 && (
                    <span
                      className={`absolute -top-1 -right-1 text-[9px] px-1 py-0.2 rounded-full font-mono font-bold leading-none ${
                        isActive
                          ? 'bg-slate-950 text-orange-300'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {productCount}
                    </span>
                  )}

                  {item.type === 'reservations' && reservationCount > 0 && (
                    <span
                      className={`absolute -top-1 -right-1 text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-none ${
                        isActive
                          ? 'bg-slate-950 text-orange-400'
                          : 'bg-orange-500 text-slate-950 shadow-sm'
                      }`}
                    >
                      {reservationCount}
                    </span>
                  )}

                  {item.type === 'whatsapp' && (
                    <span
                      className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ${
                        isConnected ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Botón inferior para Desplegar barra */}
      {onToggleCollapse && (
        <div className="pt-3 border-t border-slate-800/80 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-orange-500/50 flex items-center justify-center transition cursor-pointer"
            title="Expandir barra lateral (Ctrl+B)"
            aria-label="Expandir barra lateral"
          >
            <PanelLeftOpen size={16} className="text-orange-400" />
          </button>
        </div>
      )}
    </div>
  );

  // Render para modo EXPANDIDO (o drawer móvil)
  const renderExpandedNav = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full">
      <div className="overflow-y-auto">
        {/* Logo Brand */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#070b14]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                onClick={() => handleNavClick('dashboard')}
                className="w-12 h-12 flex items-center justify-center shrink-0 hover:scale-105 transition-transform cursor-pointer"
                title="Crastur"
              >
                <img src="/logo_icon.png" alt="Crastur Logo" className="w-full h-full object-contain drop-shadow-[0_0_14px_rgba(255,107,0,0.4)]" />
              </div>
              <div className="min-w-0">
                <h1 className="font-black text-base sm:text-lg text-white tracking-wider leading-none">CRASTUR</h1>
                <div className="flex items-center gap-1 mt-1 sm:mt-1.5">
                  <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 whitespace-nowrap inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                    MOTO & CAUCHERA
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1 truncate">
                  <Wrench size={10} className="text-orange-400/80 shrink-0" />
                  <span className="truncate">Insumos & Repuestos</span>
                </p>
              </div>
            </div>

            {isMobile && (
              <button
                onClick={onCloseMobileMenu}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
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
            className="mt-3 flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs hover:border-orange-500/40 hover:text-orange-400 transition group"
            title="Abrir ubicación en Google Maps"
          >
            <MapPin size={14} className="shrink-0 text-orange-400 group-hover:scale-110 transition-transform" />
            <span className="truncate font-medium text-[11px] sm:text-xs">San Agustín, Caracas</span>
            <ExternalLink size={12} className="ml-auto shrink-0 text-slate-500 group-hover:text-orange-400" />
          </a>
        </div>

        {/* Navigation Links */}
        <nav className="p-2.5 sm:p-3 space-y-1">
          {/* Bloque: General */}
          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <LayoutDashboard size={18} className="shrink-0" />
              <span className="truncate whitespace-nowrap">Dashboard</span>
            </button>
          </div>

          {/* Separador: Operaciones */}
          <div className="pt-2 sm:pt-3 pb-1 px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Operaciones
            </span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('inbox')}
              className={`w-full flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'inbox'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <MessageSquare size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Live Inbox</span>
              </div>
              <span className={`shrink-0 ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                activeTab === 'inbox'
                  ? 'bg-slate-950/40 text-slate-950'
                  : isConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {isConnected ? 'En Vivo' : 'Offline'}
              </span>
            </button>

            <button
              onClick={() => handleNavClick('products')}
              className={`w-full flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <Package size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Catálogo Productos</span>
              </div>
              <span className={`shrink-0 ml-1.5 text-xs px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'products'
                  ? 'bg-slate-950/30 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {productCount}
              </span>
            </button>

            <button
              onClick={() => handleNavClick('reservations')}
              className={`w-full flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'reservations'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <Clock size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Apartados (24h)</span>
              </div>
              {reservationCount > 0 ? (
                <span className={`shrink-0 ml-1.5 text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === 'reservations'
                    ? 'bg-slate-950 text-orange-400'
                    : 'bg-orange-500 text-slate-950'
                }`}>
                  {reservationCount}
                </span>
              ) : (
                <span className="shrink-0 ml-1.5 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  0
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavClick('calculator')}
              className={`w-full flex items-center gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'calculator'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Calculator size={18} className="shrink-0" />
              <span className="truncate whitespace-nowrap">Calculadora Cashea</span>
            </button>
          </div>

          {/* Separador: Sistema & Bot */}
          <div className="pt-2 sm:pt-3 pb-1 px-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Sistema & Bot
            </span>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('whatsapp')}
              className={`w-full flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'whatsapp'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-slate-950 font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <QrCode size={18} className="shrink-0" />
                <span className="truncate whitespace-nowrap">Conexión WhatsApp</span>
              </div>
              {isConnected ? (
                <span className="shrink-0 ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  OK
                </span>
              ) : (
                <span className="shrink-0 ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-950/40 text-rose-400 border border-rose-800/60">
                  Off
                </span>
              )}
            </button>

            <button
              onClick={() => handleNavClick('sellers')}
              className={`w-full flex items-center gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
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
              className={`w-full flex items-center gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
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
      <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-[#070b14] shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shrink-0"></div>
              <span className="text-xs text-slate-300 font-semibold truncate">Crastur Repuestos</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">Caracas • San Agustín</p>
          </div>

          {!isMobile && onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-orange-500/40 transition shrink-0 cursor-pointer"
              title="Plegar barra lateral (Ctrl+B)"
              aria-label="Plegar barra lateral"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar fijo en Desktop con soporte colapsable para monitores viejos (1024x768 / 1280x1024) */}
      <aside
        className={`hidden md:flex bg-[#0a0f1d] border-r border-slate-800/80 flex-col justify-between shrink-0 transition-all duration-200 select-none ${
          isCollapsed ? 'w-18' : 'w-60 lg:w-68'
        }`}
      >
        {isCollapsed ? renderCollapsedNav() : renderExpandedNav(false)}
      </aside>

      {/* Drawer móvil */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            onClick={onCloseMobileMenu}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-[#0a0f1d] border-r border-slate-800 shadow-2xl flex flex-col justify-between animate-slide-in-left">
            {renderExpandedNav(true)}
          </aside>
        </div>
      )}
    </>
  );
}
