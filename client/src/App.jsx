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

import { formatBs, formatRate } from './utils/formatters';

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
  // Pestaña activa del dashboard y colecciones de datos primarias
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [settings, setSettings] = useState({});
  const [bcvData, setBcvData] = useState({ tasa_efectiva: null, tasa_bcv: null, fecha_tasa: '' });
  const [waStatus, setWaStatus] = useState({ status: 'disconnected', qr: null, user: null });
  const [waReconexionPausada, setWaReconexionPausada] = useState(false);
  const [botPausedGlobal, setBotPausedGlobal] = useState(false);
  const [metrics, setMetrics] = useState({ consultas_hoy: 0, total_mensajes: 0, total_clientes: 0, top_busquedas: [] });
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toasts, toast, removeToast } = useToast();

  // Estados de control de apertura para modales interactivos
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

  /**
   * Alterna la barra lateral entre modo expandido y colapsado (con persistencia en localStorage).
   */
  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('crastur_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  // Atajos globales de teclado: F2 (Calculadora rápida) y Ctrl+B (Plegar/Desplegar navegación)
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

  // Adaptación de interfaz responsiva ante cambios en la resolución de pantalla
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
   * Modifica el indicador de apertura física de la tienda (Horario de atención / Fuera de horario).
   */
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

  // Carga inicial y suscripción a eventos en tiempo real vía WebSocket (con reconexión estocástica)
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
          wsReconnectDelay = 2000; // Restablecer retardo base tras reconexión exitosa
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
              loadProducts();
            } else if (type === 'products_updated') {
              loadProducts();
            } else if (type === 'live_chat_message') {
              loadMetrics();
              loadReservations();
              loadProducts();
            }
          } catch (err) {
            console.error('[WS] Error procesando evento:', err);
          }
        };
        ws.onclose = () => {
          // Reintentar conexión con backoff exponencial (límite máximo 30 segundos)
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

    // Polling de respaldo cada 10 segundos como red de seguridad ante caídas de WebSocket
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
          if (data && data.reconexion_pausada !== undefined) setWaReconexionPausada(!!data.reconexion_pausada);
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

  /**
   * Fuerza una consulta manual de la tasa BCV oficial y actualiza el estado.
   */
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

  /**
   * Inicia el proceso de conexión de WhatsApp Baileys.
   */
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

  /**
   * Restablece las credenciales de WhatsApp en disco y genera un nuevo código QR limpio.
   */
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

  /**
   * Cierra la sesión activa de WhatsApp con opción de vaciado de chats por privacidad.
   */
  const handleOpenLogoutConfirm = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Cerrar sesión de WhatsApp?',
      message: 'El bot dejará de responder mensajes automáticos y apartados hasta que vuelvas a escanear el código QR con tu teléfono.',
      confirmText: 'Cerrar Sesión',
      checkboxLabel: 'Vaciar también el historial de chats del Live Inbox (Privacidad)',
      checkboxChecked: true,
      isDanger: true,
      onConfirm: (clearChats) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch('/api/whatsapp/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clearHistory: !!clearChats })
        })
          .then(r => r.json())
          .then((res) => {
            setWaStatus({ status: 'disconnected', qr: null, user: null });
            if (res.cleared) {
              toast.info('Sesión de WhatsApp cerrada y chats eliminados');
            } else {
              toast.info('Sesión de WhatsApp cerrada');
            }
          })
          .catch(() => {});
      }
    });
  };

  /**
   * [ANTI-BANEO META 2025] Alterna la pausa global del bot para toda la tienda física.
   */
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

  /**
   * Guarda o actualiza un producto en el inventario de la tienda.
   */
  const handleSaveProduct = async (formData) => {
    try {
      if (productModal.editing) {
        const r = await fetch(`/api/products/${productModal.editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await r.json();
        if (data.success) {
          setProductModal({ isOpen: false, editing: null });
          loadProducts();
          toast.success('Repuesto actualizado correctamente ✅');
        } else {
          toast.error(data.error || 'Error al actualizar el repuesto');
        }
      } else {
        const r = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await r.json();
        if (data.success) {
          setProductModal({ isOpen: false, editing: null });
          loadProducts();
          toast.success('Repuesto agregado al catálogo ✅');
        } else {
          toast.error(data.error || 'Error al agregar el repuesto');
        }
      }
    } catch {
      toast.error('Error de conexión al guardar el repuesto');
    }
  };

  /**
   * Elimina un producto tras verificar si existen apartados activos comprometidos.
   */
  const handleDeleteProduct = (productId) => {
    const prod = products.find(p => p.id === productId);
    const prodName = prod ? `"${prod.marca} - ${prod.modelo}"` : 'este repuesto';
    const hasActiveReservation = reservations.some(r => r.producto_id === productId && r.estado === 'activo');

    let warningMsg = `¿Estás seguro de eliminar definitivamente ${prodName} del inventario? Esta pieza se removerá de tu catálogo y el bot ya no la ofrecerá a los clientes en WhatsApp.`;
    if (hasActiveReservation) {
      warningMsg += `\n\n⚠️ ¡ADVERTENCIA DE SEGURIDAD!: Este repuesto tiene un apartado activo por 24 horas registrado por un cliente. Si lo eliminas, la reserva no podrá ser canjeada en el mostrador.`;
    }

    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar repuesto definitivamente?',
      message: warningMsg,
      confirmText: 'Sí, Eliminar Definitivamente',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            toast.success(`Repuesto ${prodName} eliminado del catálogo`);
            loadProducts();
          } else {
            toast.error(data.error || 'Error al eliminar el repuesto');
          }
        } catch {
          toast.error('Error de red al intentar eliminar el repuesto');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  /**
   * Marca un apartado como retirado en mostrador y lo archiva en el historial.
   */
  const handleMarkDelivered = (reservationId) => {
    const resItem = reservations.find(r => r.id === reservationId);
    const clientName = resItem?.nombre ? ` de ${resItem.nombre}` : '';

    setConfirmModal({
      isOpen: true,
      title: '¿Marcar apartado como retirado?',
      message: `¿Confirmas que el cliente ya pagó y retiró su repuesto${clientName} en la tienda física? Esta acción archivará el apartado en el historial.`,
      confirmText: 'Sí, Marcar Retirado',
      cancelText: 'Cancelar',
      isDanger: false,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch(`/api/reservations/${reservationId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          // [INTEGRIDAD] El estado oficial del backend es 'entregado' (no 'retirado').
          body: JSON.stringify({ estado: 'entregado' })
        })
          .then(async (r) => {
            const data = await r.json().catch(() => ({}));
            if (!r.ok || data.success === false) {
              throw new Error(data.error || 'No se pudo actualizar el apartado');
            }
            setReservationModal({ isOpen: false, data: null });
            loadReservations();
            loadProducts();
            toast.success('Apartado marcado como retirado ✅');
          })
          .catch((err) => toast.error(err.message || 'Error al actualizar el apartado'));
      }
    });
  };

  /**
   * Cancela una reserva y reintegra la unidad física al stock de la tienda.
   */
  const handleCancelReservation = (reservationId) => {
    const resItem = reservations.find(r => r.id === reservationId);
    const prodName = resItem?.producto_nombre ? ` (${resItem.producto_nombre})` : '';

    setConfirmModal({
      isOpen: true,
      title: '¿Liberar apartado por 24h?',
      message: `El apartado${prodName} será cancelado y el repuesto quedará inmediatamente disponible para la venta en mostrador y WhatsApp.`,
      confirmText: 'Liberar Apartado',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        fetch(`/api/reservations/${reservationId}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(() => {
            setReservationModal({ isOpen: false, data: null });
            loadReservations();
            loadProducts();
            toast.info('Apartado liberado. El repuesto está disponible nuevamente.');
          })
          .catch(() => toast.error('Error al liberar el apartado'));
      }
    });
  };

  /**
   * Guarda o actualiza un asesor comercial.
   */
  const handleSaveSeller = async (formData) => {
    try {
      if (sellerModal.editing) {
        const r = await fetch(`/api/sellers/${sellerModal.editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await r.json();
        if (data.success) {
          setSellerModal({ isOpen: false, editing: null });
          loadSellers();
          toast.success('Datos del asesor actualizados ✅');
        } else {
          toast.error(data.error || 'Error al actualizar el asesor');
        }
      } else {
        const r = await fetch('/api/sellers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await r.json();
        if (data.success) {
          setSellerModal({ isOpen: false, editing: null });
          loadSellers();
          toast.success('Asesor registrado correctamente ✅');
        } else {
          toast.error(data.error || 'Error al registrar el asesor');
        }
      }
    } catch {
      toast.error('Error de conexión al guardar el asesor');
    }
  };

  /**
   * Elimina un asesor del equipo de ventas.
   */
  const handleDeleteSeller = (sellerId) => {
    const seller = sellers.find(s => s.id === sellerId);
    const sellerName = seller ? `"${seller.nombre}"` : 'este asesor';

    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar asesor de ventas?',
      message: `¿Estás seguro de eliminar a ${sellerName}? El bot ya no derivará clientes ni entregará este contacto en WhatsApp cuando pidan hablar con un vendedor.`,
      confirmText: 'Sí, Eliminar Asesor',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/sellers/${sellerId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) {
            toast.success(`Asesor ${sellerName} eliminado`);
            loadSellers();
          } else {
            toast.error(data.error || 'Error al eliminar el asesor');
          }
        } catch {
          toast.error('Error al eliminar el asesor');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

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

  /**
   * Copia una cotización de producto con formato enriquecido para WhatsApp.
   */
  const copyWhatsAppQuote = (product) => {
    const tasa = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
    const precioUsd = parseFloat(product.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    const n1 = precioUsd * 0.40;
    const cuota = (precioUsd - n1) / 3;

    const casheaLine = precioUsd >= 25
      ? `💛 *Cashea (En tienda física):* Inicial de *$${n1.toFixed(2)}* (Bs. ${formatBs(n1 * tasa)}) + 3 cuotas quincenales de *$${cuota.toFixed(2)}* (Pago en caja escaneando con tu App Cashea)`
      : `💛 *Cashea:* Disponible para compras a partir de $25 USD en tienda física`;

    const quote = `🚗 *${product.marca} - ${product.modelo}* ⚙️\n💵 Precio: *$${precioUsd.toFixed(2)} USD*\n🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}* (Tasa BCV: ${formatRate(tasa)})\n${casheaLine}\n📦 *Disponibilidad:* Retiro inmediato en tienda física Crastur (Caracas).\n\n📍 *Ubicación:*\nEdificio Liberalba, Av. Sur 9, San Agustín, Caracas\nhttps://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`;
    navigator.clipboard.writeText(quote);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /**
   * Copia una cotización libre o calculada desde la herramienta de Cashea.
   */
  const copyManualQuote = (usdAmount, nivel, inicialUsd, inicialBs, cuotaUsd, _cuotaBs) => {
    const tasa = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
    const precioBs = usdAmount * tasa;

    const casheaLine = usdAmount >= 25
      ? `💛 *Cashea (Nivel ${nivel} - En tienda física):* Inicial hoy de *$${inicialUsd.toFixed(2)}* (Bs. ${formatBs(inicialBs)}) + 3 cuotas quincenales de *$${cuotaUsd.toFixed(2)}* (Escaneas en caja al retirar)`
      : `💛 *Cashea:* Disponible para compras a partir de $25 USD en tienda física`;

    const quote = `🚗 *Cotización de Repuesto / Accesorio - Crastur* ⚙️\n💵 Monto: *$${usdAmount.toFixed(2)} USD*\n🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}* (Tasa BCV: ${formatRate(tasa)})\n${casheaLine}\n\n🏢 *Tienda Física:* Edificio Liberalba, Av. Sur 9, San Agustín, Caracas.\nhttps://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`;
    navigator.clipboard.writeText(quote);
    setCopiedId('manual');
    setTimeout(() => setCopiedId(null), 2000);
  };

  /**
   * [PERSISTENCIA ATÓMICA] Apagado controlado de la plataforma tras guardar estado en disco.
   */
  const handleShutdownSystem = () => {
    setConfirmModal({
      isOpen: true,
      title: '¿Deseas apagar el sistema?',
      subtitle: 'Cierre de turno o jornada',
      message: 'Se guardarán todas las ventas, apartados y cambios del día de forma segura.\n\nEl asistente de WhatsApp se pondrá en pausa hasta que vuelvas a abrir el sistema con el acceso directo Crastur de tu Escritorio.',
      confirmText: 'Sí, Apagar Sistema',
      cancelText: 'Seguir Trabajando',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        toast.info('Guardando información y cerrando el sistema...');
        try {
          await fetch('/api/system/shutdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'user_requested_ui' })
          });
        } catch {
          // El servidor se apaga inmediatamente tras recibir la orden
        }
        setIsSystemShutdown(true);
      }
    });
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
