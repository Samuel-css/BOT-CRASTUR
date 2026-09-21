import { useState, useEffect } from 'react';
import { X, UserCheck, Phone, Briefcase } from 'lucide-react';

export default function SellerModal({ isOpen, onClose, onSave, editingSeller }) {
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    departamento: 'Repuestos & Ventas'
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (editingSeller) {
      setForm({
        nombre: editingSeller.nombre || '',
        telefono: editingSeller.telefono || '',
        departamento: editingSeller.departamento || 'Repuestos & Ventas'
      });
    } else {
      setForm({
        nombre: '',
        telefono: '',
        departamento: 'Repuestos & Ventas'
      });
    }
    setFormError('');
  }, [editingSeller, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.telefono.trim()) {
      setFormError('Ingresa el nombre y teléfono del asesor para continuar.');
      return;
    }
    setFormError('');
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl shadow-black/80">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {editingSeller ? 'Editar Asesor' : 'Registrar Nuevo Asesor'}
              </h3>
              <p className="text-xs text-slate-400">El bot entregará este contacto directo a los clientes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <span>⚠️</span> {formError}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-300">Nombre y Apellido: *</label>
            <input
              type="text"
              required
              placeholder="Ej: Carlos Mendoza"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full mt-1.5 bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Número de WhatsApp / Teléfono: *</label>
            <div className="relative mt-1.5">
              <Phone size={14} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                required
                placeholder="+58 412 1234567"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none font-mono transition"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Coloca el código de país (ej: +58) para generar el enlace directo de WhatsApp.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Departamento o Especialidad:</label>
            <div className="relative mt-1.5">
              <Briefcase size={14} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Ej: Repuestos de Motor, Mostrador, Asesor Motos"
                value={form.departamento}
                onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95"
            >
              {editingSeller ? 'Guardar Cambios' : 'Registrar Asesor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
