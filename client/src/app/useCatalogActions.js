/**
 * @file useCatalogActions.js
 * @description Acciones del catálogo: guardar/eliminar productos y copiar cotizaciones
 * formateadas para WhatsApp.
 */

import { formatBs, formatRate } from '../utils/formatters';

export default function useCatalogActions({
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
}) {
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

  const copyWhatsAppQuote = (product) => {
    const tasa = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
    const precioUsd = parseFloat(product.precio_usd) || 0;
    const precioBs = precioUsd * tasa;
    const cuotasCashea = Math.max(1, parseInt(product.cashea_cuotas ?? settings.cashea_cuotas ?? 3, 10) || 3);
    const inicialPct = Number(product.cashea_inicial_pct ?? parseFloat(settings.cashea_inicial_pct || '40'));
    const n1 = Number(product.cashea_inicial_usd ?? (precioUsd * (inicialPct / 100)));
    const cuota = Number(product.cashea_cuota_usd ?? ((precioUsd - n1) / cuotasCashea));

    const casheaLine = precioUsd >= 25
      ? `💛 *Cashea (En tienda física):* Inicial de *$${n1.toFixed(2)}* (Bs. ${formatBs(n1 * tasa)}) + ${cuotasCashea} cuotas quincenales de *$${cuota.toFixed(2)}* (Pago en caja escaneando con tu App Cashea)`
      : `💛 *Cashea:* Disponible para compras a partir de $25 USD en tienda física`;

    const quote = `🏍️ *${product.marca} - ${product.modelo}* 🛞\n💵 Precio: *$${precioUsd.toFixed(2)} USD*\n🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}* (Tasa BCV: ${formatRate(tasa)})\n${casheaLine}\n📦 *Disponibilidad:* Retiro inmediato en tienda física Crastur (Caracas).\n\n📍 *Ubicación:*\nEdificio Liberalba, Av. Sur 9, San Agustín, Caracas\nhttps://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`;
    navigator.clipboard.writeText(quote);
    setCopiedId(product.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyManualQuote = (usdAmount, nivel, inicialUsd, inicialBs, cuotaUsd, _cuotaBs) => {
    const tasa = typeof bcvData.tasa_efectiva === 'number' ? bcvData.tasa_efectiva : 849.56;
    const precioBs = usdAmount * tasa;
    const cuotasCashea = Math.max(1, parseInt(settings.cashea_cuotas || '3', 10) || 3);

    const casheaLine = usdAmount >= 25
      ? `💛 *Cashea (Nivel ${nivel} - En tienda física):* Inicial hoy de *$${inicialUsd.toFixed(2)}* (Bs. ${formatBs(inicialBs)}) + ${cuotasCashea} cuotas quincenales de *$${cuotaUsd.toFixed(2)}* (Escaneas en caja al retirar)`
      : `💛 *Cashea:* Disponible para compras a partir de $25 USD en tienda física`;

    const quote = `🏍️ *Cotización de Repuesto / Accesorio - Crastur* 🛞\n💵 Monto: *$${usdAmount.toFixed(2)} USD*\n🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}* (Tasa BCV: ${formatRate(tasa)})\n${casheaLine}\n\n🏢 *Tienda Física:* Edificio Liberalba, Av. Sur 9, San Agustín, Caracas.\nhttps://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`;
    navigator.clipboard.writeText(quote);
    setCopiedId('manual');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return { handleSaveProduct, handleDeleteProduct, copyWhatsAppQuote, copyManualQuote };
}
