import { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import DashboardView from './components/views/DashboardView';
import LiveInboxView from './components/views/LiveInboxView';
import CatalogView from './components/views/CatalogView';
import ReservationsView from './components/views/ReservationsView';
import CasheaCalculatorView from './components/views/CasheaCalculatorView';
import WhatsAppView from './components/views/WhatsAppView';
import SellersView from './components/views/SellersView';
import SettingsView from './components/views/SettingsView';

import ProductModal from './components/modals/ProductModal';
import SellerModal from './components/modals/SellerModal';
import ReservationModal from './components/modals/ReservationModal';
import ConfirmModal from './components/modals/ConfirmModal';
import QuickPriceModal from './components/modals/QuickPriceModal';
import ToastContainer, { useToast } from './components/ui/Toast';
import { Toaster } from 'sonner';

import { formatBs, formatRate } from './utils/formatters';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [settings, setSettings] = useState({});
  const [bcvData, setBcvData] = useState({ tasa_efectiva: 849.56, tasa_bcv: 849.56, fecha_tasa: '' });
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qr: null, user: null });
  const [botPausedGlobal, setBotPausedGlobal] = useState(false);
  const [metrics, setMetrics] = useState({ consultas_hoy: 0, total_mensajes: 0, total_clientes: 0, top_busquedas: [] });
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toasts, toast, removeToast } = useToast();

  // Modals state
  const [productModal, setProductModal] = useState({ isOpen: false, editing: null });
  const [sellerModal, setSellerModal] = useState({ isOpen: false, editing: null });
  const [reservationModal, setReservationModal] = useState({ isOpen: false, data: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true });
  const [quickPriceOpen, setQuickPriceOpen] = useState(false);

  // Escuchar tecla F2 para abrir consulta rápida de mostrador
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setQuickPriceOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleStoreStatus = () => {
    const isClosed = settings.fuera_horario_activo === '1';
    const newStatus = isClosed ? '0' : '1';
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fuera_horario_activo: newStatus })
    })
      .then(r => r.json())
      .then(data => {
        setSettings(data.settings || {});
        if (newStatus === '1') {
          toast.warning('Tienda marcada como CERRADA temporalmente');
        } else {
          toast.success('Tienda marcada como ABIERTA (Atendiendo normal)');
        }
      })
      .catch(() => toast.error('Error al cambiar estado de la tienda'));
  };

  const loadProducts = () => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => setProducts(data.products || []))
      .catch(() => {});
  };

  const loadReservations = () => {
    fetch('/api/reservations?active=false')
      .then(r => r.json())
      .then(data => setReservations(data.reservations || []))
      .catch(() => {});
  };

  const loadSellers = () => {
    fetch('/api/sellers')
      .then(r => r.json())
      .then(data => setSellers(data.sellers || []))
      .catch(() => {});
  };

  const loadBCV = () => {
    fetch('/api/bcv')
      .then(r => r.json())
      .then(data => setBcvData(data))
      .catch(() => {});
  };

  const loadSettings = () => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => setSettings(data))
      .catch(() => {});
  };

  const loadMetrics = () => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(data => setMetrics(data))
      .catch(() => {});
  };

  const loadAllData = () => {
    loadProducts();
    loadReservations();
    loadSellers();
    loadBCV();
    loadSettings();
    loadMetrics();
  };

  // Initial Load & Real-time WebSockets
  useEffect(() => {
    loadAllData();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws;
    let wsReconnectDelay = 2000;

    function connectWS() {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          wsReconnectDelay = 2000; // Reset delay on success
        };
        ws.onmessage = (event) => {
          try {
            const { type, data } = JSON.parse(event.data);
            if (type === 'whatsapp_status') {
              setWaStatus(data || { status: 'disconnected', qr: null, user: null });
            } else if (type === 'bot_global_pause_changed') {
              if (data && data.bot_pausado_global !== undefined) {
                setBotPausedGlobal(data.bot_pausado_global);
              }
            } else if (type === 'bcv_updated') {
              loadBCV();
              loadProducts();
              loadReservations();
            } else if (type === 'reservations_updated') {
              loadReservations();
            } else if (type === 'live_chat_message') {
              loadMetrics();
              loadReservations();
            }
          } catch (err) {
            console.error('[WS] Error procesando evento:', err);
          }
        };
        ws.onclose = () => {
          // Reconnect with exponential backoff (max 30s)
          setTimeout(() => {
            connectWS();
            wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
          }, wsReconnectDelay);
        };
        ws.onerror = () => {
          ws.close();
        };
      } catch {
        console.log('[WS] Conexión omitida');
      }
    }
    connectWS();

    const interval = setInterval(() => {
      fetch('/api/status')
        .then(r => r.json())
        .then(data => {
          if (data && data.whatsapp) {
            setWaStatus(data.whatsapp);
          } else {
            setWaStatus({ status: 'disconnected', qr: null, user: null });
          }
          if (data && data.bot_pausado_global !== undefined) setBotPausedGlobal(data.bot_pausado_global);
        })
        .catch(() => {});
      loadMetrics();
      loadReservations();
    }, 10000);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  const refreshBCV = () => {
    setLoading(true);
    fetch('/api/bcv/refresh', { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        setLoading(false);
        loadBCV();
        loadProducts();
        toast.success('¡Tasa BCV actualizada exitosamente!');
      })
      .catch(() => {
        setLoading(false);
        toast.error('Error al consultar la tasa BCV');
      });
  };

  // WhatsApp Actions
  const handleStartWhatsApp = () => {
    setLoading(true);
    fetch('/api/whatsapp/start', { method: 'POST' })
      .then(r => r.json())
      .then(() => {
        setLoading(false);
        setWaStatus(prev => ({ ...prev, status: 'connecting' }));
        toast.info('Conectando con WhatsApp...');
      })
      .catch(() => {
        setLoading(false);
        toast.error('Error al conectar con WhatsApp');
      });
  };

  const handleResetWhatsApp = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Restablecer conexión de WhatsApp?',
      message: 'Esta acción limpiará las credenciales y sesiones guardadas de WhatsApp y generará un nuevo código QR desde cero. Deberás volver a escanearlo con el teléfono.',
      confirmText: 'Sí, Generar Nuevo QR',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        toast.info('Restableciendo sesión y generando nuevo código QR...');
        fetch('/api/whatsapp/reset', { method: 'POST' })
          .then(r => r.json())
          .then(() => {
            setLoading(false);
            setWaStatus({ status: 'connecting', qr: null, user: null });
            toast.success('Sesión limpia. Generando código QR...');
          })
          .catch((err) => {
            setLoading(false);
            toast.error('Error al reiniciar WhatsApp: ' + err.message);
          });
      }
    });
  };

  const handleOpenLogoutConfirm = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Cerrar sesión de WhatsApp?',
      message: 'El bot dejará de responder mensajes automáticos y apartados hasta que vuelvas a escanear el código QR con tu teléfono.',
      confirmText: 'Cerrar Sesión',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch('/api/whatsapp/logout', { method: 'POST' })
          .then(r => r.json())
          .then(() => {
            setWaStatus({ status: 'disconnected', qr: null, user: null });
            toast.info('Sesión de WhatsApp cerrada');
          })
          .catch(() => {});
      }
    });
  };

  const handleToggleGlobalBotPause = () => {
    const nextState = !botPausedGlobal;
    fetch('/api/bot/pause-global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: nextState })
    })
      .then(r => r.json())
      .then(data => {
        if (data.bot_pausado_global !== undefined) {
          setBotPausedGlobal(data.bot_pausado_global);
          if (data.bot_pausado_global) {
            toast.warning('Bot PAUSADO globalmente. No responderá automáticamente a ningún chat.');
          } else {
            toast.success('Bot REANUDADO globalmente. Está atendiendo mensajes.');
          }
        }
      })
      .catch(() => {
        toast.error('Error al cambiar el estado del bot');
      });
  };

  // Product CRUD
  const handleSaveProduct = (formData) => {
    if (productModal.editing) {
      fetch(`/api/products/${productModal.editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
        .then(r => r.json())
        .then(() => {
          setProductModal({ isOpen: false, editing: null });
          loadProducts();
          toast.success('Repuesto actualizado correctamente ✅');
        })
        .catch(() => toast.error('Error al actualizar el repuesto'));
    } else {
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
        .then(r => r.json())
        .then(() => {
          setProductModal({ isOpen: false, editing: null });
          loadProducts();
          toast.success('Repuesto agregado al catálogo ✅');
        })
        .catch(() => toast.error('Error al agregar el repuesto'));
    }
  };

  const handleDeleteProduct = (productId) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar este repuesto?',
      message: 'Esta pieza se removerá de tu catálogo y el bot ya no la ofrecerá a los clientes en WhatsApp.',
      confirmText: 'Eliminar Repuesto',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch(`/api/products/${productId}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(() => loadProducts());
      }
    });
  };

  // Reservations Actions
  const handleMarkDelivered = (reservationId) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Marcar apartado como retirado?',
      message: '¿Confirmas que el cliente ya pagó y retiró su repuesto en la tienda física? Esta acción archivará el apartado en el historial.',
      confirmText: 'Sí, Marcar Retirado',
      cancelText: 'Cancelar',
      isDanger: false,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch(`/api/reservations/${reservationId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'retirado' })
        })
          .then(r => r.json())
          .then(() => {
            setReservationModal({ isOpen: false, data: null });
            loadReservations();
            toast.success('Apartado marcado como retirado ✅');
          })
          .catch(() => toast.error('Error al actualizar el apartado'));
      }
    });
  };

  const handleCancelReservation = (reservationId) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Liberar apartado?',
      message: 'El apartado será cancelado y el repuesto quedará libre nuevamente para la venta.',
      confirmText: 'Liberar Apartado',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch(`/api/reservations/${reservationId}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(() => {
            setReservationModal({ isOpen: false, data: null });
            loadReservations();
            toast.info('Apartado liberado. El repuesto está disponible nuevamente.');
          })
          .catch(() => toast.error('Error al liberar el apartado'));
      }
    });
  };

  // Seller CRUD
  const handleSaveSeller = (formData) => {
    if (sellerModal.editing) {
      fetch(`/api/sellers/${sellerModal.editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
        .then(r => r.json())
        .then(() => {
          setSellerModal({ isOpen: false, editing: null });
          loadSellers();
          toast.success('Datos del asesor actualizados ✅');
        })
        .catch(() => toast.error('Error al actualizar el asesor'));
    } else {
      fetch('/api/sellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
        .then(r => r.json())
        .then(() => {
          setSellerModal({ isOpen: false, editing: null });
          loadSellers();
          toast.success('Asesor registrado correctamente ✅');
        })
        .catch(() => toast.error('Error al registrar el asesor'));
    }
  };

  const handleDeleteSeller = (sellerId) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar este asesor?',
      message: 'El bot dejará de compartir este número telefónico cuando los clientes pidan hablar con un vendedor.',
      confirmText: 'Eliminar Asesor',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch(`/api/sellers/${sellerId}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(() => loadSellers());
      }
    });
  };

  // Settings Save
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

  // Quotes Copy
  const copyWhatsAppQuote = (product) => {
    const tasa = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
    const precioUsd = parseFloat(product.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    const n1 = precioUsd * 0.40;
    const cuota = (precioUsd - n1) / 3;

    const casheaLine = precioUsd >= 25
      ? `💛 *Cashea (En tienda física):* Inicial de *$${n1.toFixed(2)}* (Bs. ${formatBs(n1 * tasa)}) + 3 cuotas quincenales de *$${cuota.toFixed(2)}* (Pago en caja escaneando con tu App Cashea)`
      : `💛 *Cashea:* Aplica para compras a partir de $25 USD en tienda (puedes combinar repuestos en combo)`;

    const quote = `🚗 *${product.marca} - ${product.modelo}* ⚙️\n💵 Precio: *$${precioUsd.toFixed(2)} USD*\n🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}* (Tasa BCV: ${formatRate(tasa)})\n${casheaLine}\n📦 *Disponibilidad:* Retiro inmediato en tienda física Crastur (Caracas).\n\n📍 *Ubicación:*\nEdificio Liberalba, Av. Sur 9, San Agustín, Caracas\nhttps://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`;
    navigator.clipboard.writeText(quote);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyManualQuote = (usdAmount, nivel, inicialUsd, inicialBs, cuotaUsd, _cuotaBs) => {
    const tasa = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
    const precioBs = usdAmount * tasa;

    const casheaLine = usdAmount >= 25
      ? `💛 *Cashea (Nivel ${nivel} - En tienda física):* Inicial hoy de *$${inicialUsd.toFixed(2)}* (Bs. ${formatBs(inicialBs)}) + 3 cuotas quincenales de *$${cuotaUsd.toFixed(2)}* (Escaneas en caja al retirar)`
      : `💛 *Cashea:* Requiere compra mínima de $25 USD en tienda física (combina varios artículos para financiar)`;

    const quote = `🚗 *Cotización de Repuesto / Accesorio - Crastur* ⚙️\n💵 Monto: *$${usdAmount.toFixed(2)} USD*\n🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}* (Tasa BCV: ${formatRate(tasa)})\n${casheaLine}\n\n🏢 *Tienda Física:* Edificio Liberalba, Av. Sur 9, San Agustín, Caracas.\nhttps://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`;
    navigator.clipboard.writeText(quote);
    setCopiedId('manual');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentRate = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
  const activeReservationsCount = reservations.filter(r => r.estado === 'activo').length;

  return (
    <div className="flex h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans select-none">
      {/* SIDEBAR MODULAR */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        productCount={products.length}
        reservationCount={activeReservationsCount}
        waStatus={waStatus}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* HEADER MODULAR */}
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
        />

        {/* VIEW CONTAINER */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          {activeTab === 'dashboard' && (
            <DashboardView
              products={products}
              reservations={reservations}
              metrics={metrics}
              bcvData={bcvData}
              onNavigate={setActiveTab}
              onOpenProductModal={() => setProductModal({ isOpen: true, editing: null })}
            />
          )}

          {activeTab === 'inbox' && (
            <LiveInboxView
              waStatus={waStatus}
              onNavigate={setActiveTab}
              bcvRate={currentRate}
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
            />
          )}

          {activeTab === 'whatsapp' && (
            <WhatsAppView
              waStatus={waStatus}
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
        </main>
      </div>

      {/* MODALS MODULARES */}
      <ProductModal
        isOpen={productModal.isOpen}
        editingProduct={productModal.editing}
        bcvRate={currentRate}
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
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText || 'Cancelar'}
        isDanger={confirmModal.isDanger}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
      />

      <QuickPriceModal
        isOpen={quickPriceOpen}
        onClose={() => setQuickPriceOpen(false)}
        products={products}
        bcvData={bcvData}
      />

      {/* Notificaciones modernas Sonner y ToastContainer */}
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: '#0a0f1d',
            border: '1px solid rgba(30, 41, 59, 0.8)',
            color: '#f8fafc',
            borderRadius: '1rem',
            fontFamily: 'Plus Jakarta Sans, sans-serif'
          }
        }}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
