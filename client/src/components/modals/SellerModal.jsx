import { useState, useEffect, useMemo } from 'react';
import { X, UserCheck, Phone, Briefcase, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { handlePhoneKeyDown, sanitizeText } from '../../utils/inputSanitizers';

/**
 * Normaliza cualquier número venezolano (0412, 0414, 0424, 0416, 0426, 0422, +58...)
 * a formato internacional garantizado para wa.me/
 */
export function normalizeSellerPhone(rawInput) {
  if (!rawInput) return { digits: '', display: '', waUrl: '', isValid: false };

  let digits = String(rawInput).replace(/\D/g, '');

  // Si empieza con 0 (ej: 04121234567 o 04221234567), cambiar 0 por 58
  if (digits.startsWith('0')) {
    digits = '58' + digits.substring(1);
  } else if (digits.length === 10 && /^(412|414|424|416|426|422)/.test(digits)) {
    // Si escribió 4121234567 sin el 0 ni el 58
    digits = '58' + digits;
  }

  // Comprobar validez venezolana: 58 seguido de 412, 414, 424, 416, 426 o 422 + 7 dígitos (total 12 dígitos)
  const isVE = /^58(412|414|424|416|426|422)\d{7}$/.test(digits);
  const isValid = isVE || (digits.length >= 11 && digits.length <= 15);

  let display = rawInput;
  if (isVE) {
    const op = digits.substring(2, 5);
    const part1 = digits.substring(5, 8);
    const part2 = digits.substring(8);
    display = `+58 ${op} ${part1}-${part2}`;
  }

  const waUrl = digits ? `https://wa.me/${digits}` : '';

  return { digits, display, waUrl, isValid };
}

export default function SellerModal({ isOpen, onClose, onSave, editingSeller }) {
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    departamento: 'Repuestos & Ventas'
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(false);
  }, [editingSeller, isOpen]);

  const phoneInfo = useMemo(() => normalizeSellerPhone(form.telefono), [form.telefono]);

  if (!isOpen) return null;

  const handleApplyPrefix = (prefix) => {
    // Si ya tiene dígitos, conservar los últimos 7
    let currentDigits = form.telefono.replace(/\D/g, '');
    let rest = '';
    if (currentDigits.length >= 7) {
      rest = currentDigits.slice(-7);
    }
    setForm({ ...form, telefono: `+58 ${prefix} ${rest}`.trim() });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const nombreClean = form.nombre.trim();
    if (!nombreClean || !form.telefono.trim()) {
      setFormError('Ingresa el nombre y teléfono del asesor para continuar.');
      return;
    }

    if (nombreClean.length < 3) {
      setFormError('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    if (!phoneInfo.isValid) {
      setFormError('Verifica el número telefónico. Debe ser un celular válido (ej: 0412, 0414, 0424, 0422, 0416, 0426).');
      return;
    }

    setFormError('');
    setIsSubmitting(true);
    try {
      if (onSave) {
        await onSave({
          ...form,
          nombre: nombreClean,
          departamento: form.departamento.trim() || 'Repuestos & Ventas',
          telefono: phoneInfo.display || form.telefono.trim()
        });
      }
    } catch (err) {
      setFormError('Error al guardar el asesor. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-[#0a0f1d] border border-slate-800/90 rounded-3xl w-full max-w-md max-h-[94vh] flex flex-col overflow-hidden shadow-2xl shadow-black/80 animate-scale-in">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#070b14] shrink-0">
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
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300">Nombre y Apellido: *</label>
              <input
                type="text"
                required
                maxLength={60}
                placeholder="Ej: Carlos Mendoza"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: sanitizeText(e.target.value, 60) })}
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
                  maxLength={25}
                  placeholder="Ej: 0412 1234567 o +58 424 5551234"
                  value={form.telefono}
                  onKeyDown={handlePhoneKeyDown}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none font-mono transition"
                />
              </div>

              {/* Botones de prefijos rápidos de Venezuela */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400 font-medium mr-1">Operadoras:</span>
                {['412', '414', '424', '422', '416', '426'].map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => handleApplyPrefix(pref)}
                    className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 hover:border-orange-500/50 hover:text-orange-400 hover:bg-slate-800 transition cursor-pointer"
                  >
                    0{pref}
                  </button>
                ))}
              </div>

              {/* Caja de validación y previsualización de enlace de WhatsApp */}
              {form.telefono.trim().length > 3 && (
                <div className={`mt-2.5 p-3 rounded-2xl border text-xs transition-all ${
                  phoneInfo.isValid
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {phoneInfo.isValid ? (
                      <>
                        <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                        <span className="font-medium text-emerald-400">Número válido para WhatsApp</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={15} className="text-amber-400 shrink-0" />
                        <span>Escribe el número completo (11 dígitos para Venezuela)</span>
                      </>
                    )}
                  </div>

                  {phoneInfo.isValid && (
                    <div className="mt-1.5 pt-1.5 border-t border-emerald-500/20 flex flex-col gap-0.5 text-[11px] font-mono">
                      <span className="text-slate-300">Formato guardado: <b className="text-white">{phoneInfo.display}</b></span>
                      <span className="text-emerald-400/90 truncate">Enlace: {phoneInfo.waUrl}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Departamento o Especialidad:</label>
              <div className="relative mt-1.5">
                <Briefcase size={14} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Ej: Repuestos de Motor, Mostrador, Asesor Motos"
                  value={form.departamento}
                  onChange={(e) => setForm({ ...form, departamento: sanitizeText(e.target.value, 60) })}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3.5 sm:p-4 bg-[#070b14] border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition cursor-pointer disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin shrink-0" />}
              <span>{isSubmitting ? 'Guardando...' : (editingSeller ? 'Guardar Cambios' : 'Registrar Asesor')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
