/**
 * @file useAppData.js
 * @description Estado y carga de datos del panel: catálogo, apartados, asesores,
 * configuración, tasa BCV, estado de WhatsApp y métricas. Incluye WebSocket,
 * polling de respaldo y actualización manual de la tasa.
 */

import { useEffect, useState } from 'react';

export default function useAppData(toast) {
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

  // Carga inicial y suscripción a eventos en tiempo real vía WebSocket.
  useEffect(() => {
    loadAllData();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws;
    let wsReconnectDelay = 2000;
    let liveReloadTimer = null;

    function connectWS() {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          wsReconnectDelay = 2000;
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
              if (liveReloadTimer) clearTimeout(liveReloadTimer);
              liveReloadTimer = setTimeout(() => {
                liveReloadTimer = null;
                loadMetrics();
                loadReservations();
                loadProducts();
              }, 1200);
            }
          } catch (err) {
            console.error('[WS] Error procesando evento:', err);
          }
        };
        ws.onclose = () => {
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

    // Polling de respaldo cada 10 segundos.
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
      if (liveReloadTimer) clearTimeout(liveReloadTimer);
      if (ws) ws.close();
    };
  }, []);

  /** Fuerza una consulta manual de la tasa BCV oficial. */
  const refreshBCV = () => {
    setLoading(true);
    fetch('/api/bcv/refresh', { method: 'POST' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        setLoading(false);
        loadBCV();
        loadProducts();
        if (data && data.success === false) {
          toast.warning(`No se pudo consultar el BCV ahora. Se mantiene la última tasa guardada${data?.tasa ? ` (Bs. ${Number(data.tasa).toFixed(2)})` : ''}.`);
        } else {
          toast.success('¡Tasa BCV actualizada exitosamente!');
        }
      })
      .catch(() => {
        setLoading(false);
        toast.error('Error al consultar la tasa BCV');
      });
  };

  /** Alterna el estado físico de la tienda (abierta/cerrada) desde el panel. */
  const toggleStoreStatus = () => {
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

  return {
    products,
    setProducts,
    reservations,
    setReservations,
    sellers,
    setSellers,
    settings,
    setSettings,
    bcvData,
    setBcvData,
    waStatus,
    setWaStatus,
    waReconexionPausada,
    botPausedGlobal,
    setBotPausedGlobal,
    metrics,
    setMetrics,
    loading,
    setLoading,
    loadProducts,
    loadReservations,
    loadSellers,
    loadBCV,
    loadSettings,
    loadMetrics,
    loadAllData,
    refreshBCV,
    toggleStoreStatus
  };
}
