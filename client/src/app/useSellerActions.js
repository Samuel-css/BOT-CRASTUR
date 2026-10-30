/**
 * @file useSellerActions.js
 * @description Alta, edición y eliminación de asesores comerciales.
 */

export default function useSellerActions({
  sellers,
  sellerModal,
  setSellerModal,
  setConfirmModal,
  loadSellers,
  toast
}) {
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

  return { handleSaveSeller, handleDeleteSeller };
}
