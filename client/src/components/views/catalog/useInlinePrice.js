/**
 * @file useInlinePrice.js
 * @description Edición rápida del precio en USD directamente sobre la tabla,
 * con persistencia inmediata vía API. Extraído de CatalogView.jsx.
 */

import { useState } from 'react';
import { toast } from 'sonner';

export default function useInlinePrice({ onReload }) {
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');
  const [savingInline, setSavingInline] = useState(false);

  const startInlineEdit = (p) => {
    setEditingPriceId(p.id);
    setEditingPriceVal(String(p.precio_usd || ''));
  };

  const cancelInlineEdit = () => {
    setEditingPriceId(null);
  };

  const handleSaveInlinePrice = async (p) => {
    const parsed = parseFloat(editingPriceVal);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Precio inválido');
      return;
    }
    setSavingInline(true);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precio_usd: parsed })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Precio actualizado a $${parsed.toFixed(2)} USD`);
        setEditingPriceId(null);
        if (onReload) onReload();
      } else {
        toast.error(data.error || 'Error al actualizar precio');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingInline(false);
    }
  };

  return {
    editingPriceId,
    editingPriceVal,
    setEditingPriceVal,
    savingInline,
    startInlineEdit,
    cancelInlineEdit,
    handleSaveInlinePrice
  };
}
