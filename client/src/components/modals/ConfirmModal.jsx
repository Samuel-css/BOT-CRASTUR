import { useEffect } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title,
  subtitle = 'Confirmación de seguridad',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = true,
  checkboxLabel,
  checkboxChecked,
  onCheckboxChange,
  onConfirm,
  onCancel,
  isSubmitting = false
}) {
  // Manejo de tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onCancel && onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  const isConfirmDisabled = isSubmitting || (checkboxLabel && !checkboxChecked);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={() => {
        if (!isSubmitting && onCancel) onCancel();
      }}
    >
      <div
        className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-2xl shadow-black/80 animate-scale-in transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#070b14] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">{title}</h3>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 bg-[#0a0f1d] space-y-4 flex-1 overflow-y-auto">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {message}
          </p>

          {checkboxLabel && (
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={!!checkboxChecked}
                disabled={isSubmitting}
                onChange={(e) => onCheckboxChange && onCheckboxChange(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-orange-500 focus:ring-0 focus:ring-offset-0 bg-slate-800 cursor-pointer shrink-0"
              />
              <span className="select-none font-semibold text-slate-200">{checkboxLabel}</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-[#070b14] border-t border-slate-800/80 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition disabled:opacity-40 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={() => onConfirm && onConfirm(checkboxChecked)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${
              isDanger
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 shadow-orange-500/25'
            }`}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin shrink-0" />}
            <span>{isSubmitting ? 'Procesando...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
