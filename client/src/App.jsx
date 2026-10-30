/**
 * ============================================================================
 * COMPONENTE RAÍZ DEL PANEL ADMINISTRATIVO: DASHBOARD CRASTUR (APP.JSX)
 * ============================================================================
 * Orquesta la interfaz de usuario en React, integrando navegación modular por pestañas,
 * streaming de eventos en tiempo real mediante WebSockets, sincronización con la tasa BCV,
 * control de pausas del bot (Human Takeover) y gestión de modales transaccionales.
 * 
 * [MERCADO VENEZUELA]
 * - Monitorea en vivo la tasa oficial del BCV (Bs/USD) y recalcula precios y cuotas Cashea.
 * - Gestiona el estado de apertura/cierre de la tienda física en San Agustín Norte, Caracas.
 * - Copia cotizaciones optimizadas para WhatsApp con desglose de cuotas e inicial Cashea.
 * 
 * [ARQUITECTURA SQL.JS]
 * - Sincroniza catálogo, reservas por 24h, asesores y métricas desde SQLite WASM.
 * 
 * [ANTI-BANEO META 2025]
 * - Control de interruptor de pausa global y derivación fluida a asesores comerciales humanos.
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { Power, RotateCcw, CheckCircle2 } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import DashboardView from './components/views/DashboardView';

// [RENDIMIENTO] Code-splitting: cada vista se carga bajo demanda (lazy) para reducir
// el bundle inicial. El Dashboard (pestaña por defecto) se importa directo para que
// aparezca de inmediato; las demás vistas se descargan cuando el usuario navega a ellas.
const LiveInboxView = lazy(() => import('./components/views/LiveInboxView'));
const CatalogView = lazy(() => import('./components/views/CatalogView'));
const ReservationsView = lazy(() => import('./components/views/ReservationsView'));
const CasheaCalculatorView = lazy(() => import('./components/views/CasheaCalculatorView'));
const WhatsAppView = lazy(() => import('./components/views/WhatsAppView'));
const SellersView = lazy(() => import('./components/views/SellersView'));
const SettingsView = lazy(() => import('./components/views/SettingsView'));

import ProductModal from './components/modals/ProductModal';
import SellerModal from './components/modals/SellerModal';
import ReservationModal from './components/modals/ReservationModal';
import ConfirmModal from './components/modals/ConfirmModal';
import QuickPriceModal from './components/modals/QuickPriceModal';
import ToastContainer, { useToast } from './components/ui/Toast';
import { Toaster } from 'sonner';
import useAppData from './app/useAppData';
import useSystemActions from './app/useSystemActions';
import useCatalogActions from './app/useCatalogActions';
import useReservationActions from './app/useReservationActions';
import useSellerActions from './app/useSellerActions';

/**
 * Indicador visual mostrado mientras una vista lazy se descarga por primera vez.
 * Mantiene la sensación de fluidez sin bloquear el resto del panel.
 */
function ViewLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
      <div className="w-9 h-9 rounded-full border-2 border-slate-700 border-t-orange-500 animate-spin" />
      <span className="text-xs font-medium tracking-wide">Cargando módulo...</span>
    </div>
  );
}

export default function App() {
  // Pestaña activa, notificaciones y estado de interfaz.
  const [activeTab, setActiveTab] = useState('dashboard');
  const [copiedId, setCopiedId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toasts, toast, removeToast } = useToast();

  // Estados de control de apertura para modales interactivos.
  const [productModal, setProductModal] = useState({ isOpen: false, editing: null });
  const [sellerModal, setSellerModal] = useState({ isOpen: false, editing: null });
  const [reservationModal, setReservationModal] = useState({ isOpen: false, data: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true });
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);
  const [isSystemShutdown, setIsSystemShutdown] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('crastur_sidebar_collapsed');
      if (stored !== null) return stored === 'true';
      return window.innerWidth < 1180;
    } catch {
      return false;
    }
  });

  // Datos, carga inicial, WebSocket, polling y tasa BCV.
  const {
    products,
    reservations,
    sellers,
    settings,
    setSettings,
    bcvData,
    waStatus,
    waReconexionPausada,
    botPausedGlobal,
    setBotPausedGlobal,
    metrics,
    loading,
    setLoading,
    setWaStatus,
    loadProducts,
    loadReservations,
    loadSellers,
    refreshBCV,
    toggleStoreStatus: handleToggleStoreStatus
  } = useAppData(toast);

  // Acciones de ciclo de vida (WhatsApp, pausa global, apagado).
  const {
    handleStartWhatsApp,
    handleResetWhatsApp,
    handleOpenLogoutConfirm,
    handleToggleGlobalBotPause,
    handleShutdownSystem
  } = useSystemActions({
    setLoading,
    setWaStatus,
    setConfirmModal,
    setIsSystemShutdown,
    botPausedGlobal,
    setBotPausedGlobal,
    toast
  });

  // Acciones del catálogo y cotizaciones.
  const {
    handleSaveProduct,
    handleDeleteProduct,
    copyWhatsAppQuote,
    copyManualQuote
  } = useCatalogActions({
    products,
    reservations,
    productModal,
    setProductModal,
    setConfirmModal,
    loadProducts,
    toast,
    bcvData,
    settings,
    setCopiedId
  });

  // Acciones de apartados.
  const { handleMarkDelivered, handleCancelReservation } = useReservationActions({
    reservations,
    setConfirmModal,
    setReservationModal,
    loadReservations,
    loadProducts,
    toast
  });

  // Acciones de asesores.
  const { handleSaveSeller, handleDeleteSeller } = useSellerActions({
    sellers,
    sellerModal,
    setSellerModal,
    setConfirmModal,
    loadSellers,
    toast
  });

  /**
   * Alterna la barra lateral entre modo expandido y colapsado (con persistencia).
   */
  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('crastur_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  // Atajos globales de teclado: F2 (Calculadora rápida) y Ctrl+B (Plegar navegación).
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setQuickPriceOpen(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Adaptación de interfaz responsiva ante cambios de resolución.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1100) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Guarda parámetros de configuración operativa.
   */
  const handleSaveSettings = (newSettings) => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    })
      .then(r => r.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
        toast.success('Configuración guardada correctamente ✅');
      })
      .catch(() => toast.error('Error al guardar la configuración'));
  };

  const currentRate = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
  const activeReservationsCount = reservations.filter(r => r.estado === 'activo').length;

  if (isSystemShutdown) {
    return (
      <div className="flex h-screen w-screen bg-[#070b14] text-slate-100 items-center justify-center p-4 select-none">
        <div className="max-w-md w-full bg-[#0d1527] border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-black/80 animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Power size={32} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">Sistema Apagado</h2>
          <p className="text-sm text-slate-300 mb-5 leading-relaxed">
            La información de tu tienda fue guardada con éxito, WhatsApp se desconectó sin problemas y el sistema se detuvo de forma segura.
          </p>

          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-3.5 mb-5 flex items-center gap-3 text-left">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-200/90 leading-tight">
              Tus datos están a salvo. Ya puedes cerrar esta pestaña con su <strong>[X]</strong>. <em>Tus demás pestañas del navegador no se verán afectadas.</em>
            </p>
          </div>

          <div className="bg-[#080d1a] border border-slate-800/80 rounded-2xl p-4 text-left mb-6 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">¿Cómo volver a entrar?</div>
            <p className="text-xs text-slate-300 leading-normal">
              • <strong>En tu Escritorio:</strong> Haz doble clic en el acceso directo <strong className="text-white font-mono">Crastur</strong>.
            </p>
            <p className="text-xs text-slate-400 leading-normal">
              Se iniciará automáticamente y reabrirá la aplicación en tu navegador.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 active:scale-95"
          >
            <RotateCcw size={14} />
            Volver a Conectar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans select-none">
      {/* BARRA LATERAL DE NAVEGACIÓN */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        productCount={products.length}
        reservationCount={activeReservationsCount}
        waStatus={waStatus}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* CONTENEDOR PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ENCABEZADO SUPERIOR CON WIDGET DE TASA BCV Y CONTROLES */}
        <Header
          activeTab={activeTab}
          bcvData={bcvData}
          onRefreshBCV={refreshBCV}
          loadingBCV={loading}
          waStatus={waStatus}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
          botPausedGlobal={botPausedGlobal}
          onToggleBotPause={handleToggleGlobalBotPause}
          onNavigate={setActiveTab}
          onOpenQuickPrice={() => setQuickPriceOpen(true)}
          settings={settings}
          onToggleStoreStatus={handleToggleStoreStatus}
          isSidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          onShutdown={handleShutdownSystem}
        />

        {/* CONTENEDOR DE VISTAS ACTIVAS */}
        <main className="flex-1 overflow-y-auto p-2.5 sm:p-4 lg:p-6">
          <div key={activeTab} className="animate-fade-in-up">
            <Suspense fallback={<ViewLoadingFallback />}>
            {activeTab === 'dashboard' && (
              <DashboardView
                products={products}
                reservations={reservations}
                metrics={metrics}
                bcvData={bcvData}
                waStatus={waStatus}
                settings={settings}
                onNavigate={setActiveTab}
                onOpenProductModal={() => setProductModal({ isOpen: true, editing: null })}
              />
            )}

            {activeTab === 'inbox' && (
              <LiveInboxView
                waStatus={waStatus}
                onNavigate={setActiveTab}
                bcvRate={currentRate}
                settings={settings}
                onRequestConfirm={(opts) => setConfirmModal({
                  isOpen: true,
                  title: opts.title,
                  message: opts.message,
                  confirmText: opts.confirmText,
                  cancelText: opts.cancelText || 'Cancelar',
                  isDanger: opts.isDanger !== false,
                  onConfirm: () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    if (opts.onConfirm) opts.onConfirm();
                  }
                })}
              />
            )}

            {activeTab === 'products' && (
              <CatalogView
                products={products}
                bcvRate={currentRate}
                onOpenAddModal={() => setProductModal({ isOpen: true, editing: null })}
                onEditProduct={(p) => setProductModal({ isOpen: true, editing: p })}
                onDeleteProduct={handleDeleteProduct}
                onCopyQuote={copyWhatsAppQuote}
                copiedId={copiedId}
                onReload={loadProducts}
              />
            )}

            {activeTab === 'reservations' && (
              <ReservationsView
                reservations={reservations}
                bcvRate={currentRate}
                onMarkDelivered={handleMarkDelivered}
                onCancelReservation={handleCancelReservation}
                onViewDetails={(res) => setReservationModal({ isOpen: true, data: res })}
              />
            )}

            {activeTab === 'calculator' && (
              <CasheaCalculatorView
                products={products}
                bcvRate={currentRate}
                onCopyManualQuote={copyManualQuote}
                copiedId={copiedId}
                casheaCuotas={settings.cashea_cuotas}
              />
            )}

            {activeTab === 'whatsapp' && (
              <WhatsAppView
                waStatus={waStatus}
                reconexionPausada={waReconexionPausada}
                loading={loading}
                onStartWhatsApp={handleStartWhatsApp}
                onResetWhatsApp={handleResetWhatsApp}
                onOpenLogoutConfirm={handleOpenLogoutConfirm}
              />
            )}

            {activeTab === 'sellers' && (
              <SellersView
                sellers={sellers}
                onOpenAddModal={() => setSellerModal({ isOpen: true, editing: null })}
                onEditSeller={(s) => setSellerModal({ isOpen: true, editing: s })}
                onDeleteSeller={handleDeleteSeller}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onRequestConfirm={(opts) => setConfirmModal({
                  isOpen: true,
                  title: opts.title,
                  message: opts.message,
                  confirmText: opts.confirmText,
                  cancelText: opts.cancelText || 'Cancelar',
                  isDanger: opts.isDanger !== false,
                  onConfirm: () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    if (opts.onConfirm) opts.onConfirm();
                  }
                })}
              />
            )}
            </Suspense>
          </div>
        </main>
      </div>

      {/* MODALES TRANSACCIONALES */}
      <ProductModal
        isOpen={productModal.isOpen}
        editingProduct={productModal.editing}
        bcvRate={currentRate}
        casheaInicialPct={settings.cashea_inicial_pct}
        casheaCuotas={settings.cashea_cuotas}
        onClose={() => setProductModal({ isOpen: false, editing: null })}
        onSave={handleSaveProduct}
      />

      <SellerModal
        isOpen={sellerModal.isOpen}
        editingSeller={sellerModal.editing}
        onClose={() => setSellerModal({ isOpen: false, editing: null })}
        onSave={handleSaveSeller}
      />

      <ReservationModal
        isOpen={reservationModal.isOpen}
        reservation={reservationModal.data}
        bcvRate={currentRate}
        onClose={() => setReservationModal({ isOpen: false, data: null })}
        onMarkDelivered={handleMarkDelivered}
        onCancel={handleCancelReservation}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        subtitle={confirmModal.subtitle}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText || 'Cancelar'}
        isDanger={confirmModal.isDanger}
        checkboxLabel={confirmModal.checkboxLabel}
        checkboxChecked={confirmModal.checkboxChecked}
        onCheckboxChange={(checked) => setConfirmModal(prev => ({ ...prev, checkboxChecked: checked }))}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />

      <QuickPriceModal
        isOpen={quickPriceOpen}
        onClose={() => setQuickPriceOpen(false)}
        products={products}
        bcvData={bcvData}
        casheaCuotas={settings.cashea_cuotas}
      />

      {/* NOTIFICACIONES TOAST FLOTANTES (CENTRADAS) */}
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        closeButton
        expand
        toastOptions={{
          style: {
            background: 'rgba(12, 19, 34, 0.95)',
            border: '1px solid rgba(249, 115, 22, 0.35)',
            boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.8), 0 0 15px rgba(249, 115, 22, 0.12)',
            color: '#f8fafc',
            borderRadius: '1rem',
            padding: '12px 16px',
            fontSize: '0.85rem',
            fontWeight: 500,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            backdropFilter: 'blur(16px)',
            textAlign: 'center',
            minWidth: '320px',
            maxWidth: '460px'
          }
        }}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
