import { copyInstagramCaption } from '../../utils/instagramFormatter';
import OperationalStatusBar from './dashboard/OperationalStatusBar';
import FirstSteps from './dashboard/FirstSteps';
import SummaryCards from './dashboard/SummaryCards';
import InventoryByCategory from './dashboard/InventoryByCategory';
import BcvRateCard from './dashboard/BcvRateCard';
import QuickAccess from './dashboard/QuickAccess';
import StockAlerts from './dashboard/StockAlerts';
import InstagramCombos from './dashboard/InstagramCombos';
import ReservationAlerts from './dashboard/ReservationAlerts';
import TopSearches from './dashboard/TopSearches';

export default function DashboardView({
  products = [],
  reservations = [],
  metrics = {},
  bcvData = {},
  waStatus = {},
  settings = {},
  onNavigate,
  onOpenProductModal
}) {
  const effectiveRate = bcvData?.tasa_efectiva || 849.56;
  const isConnected = waStatus?.status === 'connected';
  // [CONSISTENCIA] El horario mostrado se toma de la configuración real de la tienda.
  const horarioTexto = settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';

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

  // Combos & Kits activos (tolera subcategorías como "Combos & Kits - Promociones")
  const activeCombos = products.filter(
    p => p.activo !== 0 && String(p.categoria || '').toLowerCase().includes('combo')
  );

  // [PRIMEROS PASOS] Guía para una instalación nueva: no basta con que el sistema
  // abra; hay que conectar WhatsApp, cargar el catálogo y revisar la tasa/asesor.
  const pasosPendientes = {
    whatsapp: !isConnected,
    catalogo: products.length === 0,
    tasa: bcvData?.sincronizada === false && !bcvData?.tasa_manual_activa,
    asesor: settings?.auto_pausa_asesor === '0'
  };
  const mostrarPrimerosPasos = Object.values(pasosPendientes).some(Boolean);

  const handleCopyComboCaption = (combo) => {
    copyInstagramCaption(combo, effectiveRate);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. BARRA DE ESTADO OPERATIVO EN VIVO */}
      <OperationalStatusBar
        isConnected={isConnected}
        horarioTexto={horarioTexto}
        onNavigate={onNavigate}
      />

      {/* GUÍA DE PRIMEROS PASOS (solo mientras falte algo por configurar) */}
      {mostrarPrimerosPasos && (
        <FirstSteps
          pasosPendientes={pasosPendientes}
          productsCount={products.length}
          onNavigate={onNavigate}
        />
      )}

      {/* 2. 4 TARJETAS DE RENDIMIENTO CLAVE (KPIS DE ALTO IMPACTO) */}
      <SummaryCards
        activeReservationsCount={activeReservations.length}
        totalApartadosUsd={totalApartadosUsd}
        productsCount={products.length}
        activeCombosCount={activeCombos.length}
        lowStockCount={lowStockItems.length}
        metrics={metrics}
      />

      {/* 3. INVENTARIO POR LÍNEA COMERCIAL (detecta categorías vacías) */}
      <InventoryByCategory products={products} onNavigate={onNavigate} />

      {/* 4. TASA BCV & CALCULADOR REFERENCIAL */}
      <BcvRateCard bcvData={bcvData} effectiveRate={effectiveRate} />

      {/* 4. ACCESOS RÁPIDOS DE TIENDA */}
      <QuickAccess
        onOpenProductModal={onOpenProductModal}
        onNavigate={onNavigate}
        activeReservationsCount={activeReservations.length}
      />

      {/* 5. DOS COLUMNAS: ALERTAS DE STOCK CRÍTICO & COMBOS DE INSTAGRAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockAlerts lowStockItems={lowStockItems} onNavigate={onNavigate} />
        <InstagramCombos
          activeCombos={activeCombos}
          onOpenProductModal={onOpenProductModal}
          onCopyComboCaption={handleCopyComboCaption}
        />
      </div>

      {/* 6. GRID: APARTADOS RECIENTES Y TOP REPUESTOS MÁS BUSCADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReservationAlerts activeReservations={activeReservations} onNavigate={onNavigate} />
        <TopSearches topBusquedas={metrics.top_busquedas} />
      </div>
    </div>
  );
}
