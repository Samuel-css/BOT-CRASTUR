import { useState, useEffect } from 'react';
import { X, Building2, User, Phone, Tag, Calendar, CreditCard, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function SupplierModal({ isOpen, onClose, onSave, editingSupplier }) {
  const [formData, setFormData] = useState({
    empresa: '',
    contacto_nombre: '',
    telefono: '',
    categorias: 'Repuestos Moto',
    dias_despacho: 'Lunes a Viernes',
    condiciones_pago: 'Contado contra entrega',
    notas: ''
  });

  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        empresa: editingSupplier.empresa || '',
        contacto_nombre: editingSupplier.contacto_nombre || '',
        telefono: editingSupplier.telefono || '',
        categorias: editingSupplier.categorias || 'Repuestos Moto',
        dias_despacho: editingSupplier.dias_despacho || '',
        condiciones_pago: editingSupplier.condiciones_pago || '',
        notas: editingSupplier.notas || ''
      });
    } else {
      setFormData({
        empresa: '',
        contacto_nombre: '',
        telefono: '',
        categorias: 'Repuestos Moto',
        dias_despacho: 'Lunes a Viernes',
        condiciones_pago: 'Contado contra entrega',
        notas: ''
      });
    }
  }, [editingSupplier, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.empresa.trim() || !formData.telefono.trim()) {
      toast.error('Nombre de la empresa y teléfono son requeridos');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b1120] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editingSupplier ? 'Editar Proveedor / Mayorista' : 'Registrar Nuevo Proveedor'}
              </h3>
              <p className="text-xs text-slate-400">
                Almacena datos clave de despacho, crédito y contacto directo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 size={13} className="text-orange-400" />
                Nombre de la Empresa o Distribuidora *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Mayorista Rema Tip Top Venezuela / Repuestos Bera Centro"
                value={formData.empresa}
                onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User size={13} className="text-orange-400" />
                Persona de Contacto
              </label>
              <input
                type="text"
                placeholder="Ej. Carlos Méndez (Ventas)"
                value={formData.contacto_nombre}
                onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone size={13} className="text-emerald-400" />
                Teléfono / WhatsApp *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. 04141234567 / 0412..."
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Tag size={13} className="text-orange-400" />
                Categorías Suministradas
              </label>
              <select
                value={formData.categorias}
                onChange={(e) => setFormData({ ...formData, categorias: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 transition"
              >
                <option value="Insumos Cauchera">Insumos para Cauchera</option>
                <option value="Repuestos Moto">Repuestos para Moto</option>
                <option value="Accesorios Moto">Accesorios para Moto</option>
                <option value="Lubricantes y Aceites">Lubricantes y Aceites</option>
                <option value="Mixto / Varios">Mixto / Todas las Categorías</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-orange-400" />
                Días de Despacho
              </label>
              <input
                type="text"
                placeholder="Ej. Martes y Jueves"
                value={formData.dias_despacho}
                onChange={(e) => setFormData({ ...formData, dias_despacho: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <CreditCard size={13} className="text-orange-400" />
                Condiciones de Pago
              </label>
              <input
                type="text"
                placeholder="Ej. Contado contra entrega / Crédito 15 días / Divisas efectivo"
                value={formData.condiciones_pago}
                onChange={(e) => setFormData({ ...formData, condiciones_pago: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText size={13} className="text-slate-400" />
                Notas Adicionales / Marcas Distribuidas
              </label>
              <textarea
                rows={2}
                placeholder="Ej. Distribuidor oficial de parches Tip Top, mechas de caucho y válvulas TR412. Descuento adicional por bulto cerrado."
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition"
            >
              {editingSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
