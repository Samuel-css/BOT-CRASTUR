/**
 * @file ShortcutsModal.jsx
 * @description Modal / banco completo de atajos comerciales del Live Inbox.
 * Extraído de LiveInboxView.jsx.
 */

import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';

export default function ShortcutsModal({ open, onClose, shortcuts, onInsertShortcut }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl bg-[#0a0f1d] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Banco de Atajos Comerciales Crastur</h3>
              <p className="text-[11px] text-slate-400">Plantillas de respuesta rápida con información oficial completa</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {shortcuts.map((item) => {
            const IconComponent = item.icono;
            return (
              <div
                key={item.id}
                className="p-4 bg-[#070b14] border border-slate-800/80 rounded-2xl hover:border-orange-500/40 transition space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-orange-400 flex items-center justify-center">
                      <IconComponent size={14} />
                    </div>
                    <h4 className="text-xs font-bold text-white">{item.titulo}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                      {item.categoria}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onInsertShortcut(item.texto)}
                    className="px-3 py-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Usar Atajo
                  </button>
                </div>

                <p className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap leading-relaxed bg-[#0a0f1d] p-3 rounded-xl border border-slate-800/50">
                  {item.texto}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
