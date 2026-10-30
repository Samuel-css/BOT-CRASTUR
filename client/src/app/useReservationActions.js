/**
 * @file useReservationActions.js
 * @description Marcar apartados como retirados o liberarlos, con confirmación previa.
 */

export default function useReservationActions({
  reservations,
  setConfirmModal,
  setReservationModal,
  loadReservations,
  loadProducts,
  toast
}) {
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

  return { handleMarkDelivered, handleCancelReservation };
}
