import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = true, checkboxLabel, checkboxChecked, onCheckboxChange, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl shadow-black/80 animate-scale-in transition-all">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDanger ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{title}</h3>
              <p className="text-xs text-slate-400">Confirmación de acción</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-[#0a0f1d] space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            {message}
          </p>

          {checkboxLabel && (
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                checked={!!checkboxChecked}
                onChange={(e) => onCheckboxChange && onCheckboxChange(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-orange-500 focus:ring-0 focus:ring-offset-0 bg-slate-800 cursor-pointer"
              />
              <span className="select-none font-medium">{checkboxLabel}</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#070b14] border-t border-slate-800/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => onConfirm && onConfirm(checkboxChecked)}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg active:scale-95 ${
              isDanger
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 shadow-orange-500/25'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
