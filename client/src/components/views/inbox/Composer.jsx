/**
 * @file Composer.jsx
 * @description Barra de atajos rápidos y barra de entrada de mensaje del Live Inbox.
 * Extraído de LiveInboxView.jsx.
 */

import { Sparkles, ChevronRight, Send, RefreshCw } from 'lucide-react';

export default function Composer({
  shortcuts,
  onInsertShortcut,
  onOpenShortcuts,
  inputText,
  onInputChange,
  onSend,
  sendingMessage,
  isConnected
}) {
  return (
    <>
      {/* BARRA DE ATAJOS RÁPIDOS PROFESIONALES */}
      <div className="px-4 py-2.5 bg-[#070b14] border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs scrollbar-thin">
        <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0 flex items-center gap-1">
          <Sparkles size={11} className="text-orange-400" />
          Atajos:
        </span>

        {/* Botones de Atajos Directos */}
        <button
          type="button"
          onClick={() => onInsertShortcut(shortcuts[0].texto)}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>👋 Saludo</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertShortcut(shortcuts[1].texto)}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-orange-400 hover:border-orange-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>📍 Ubicación Maps</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertShortcut(shortcuts[2].texto)}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>💳 Pagos & Tasa BCV</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertShortcut(shortcuts[3].texto)}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>💛 Cashea</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertShortcut(shortcuts[4].texto)}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-orange-400 hover:border-orange-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>🛵 Delivery Caracas</span>
        </button>

        <button
          type="button"
          onClick={() => onInsertShortcut(shortcuts[5].texto)}
          className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-orange-400 hover:border-orange-500/40 transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>⏱️ Apartar 24h</span>
        </button>

        {/* Botón Ver Todos los Atajos */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="ml-auto px-2.5 py-1 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 text-[11px] font-bold transition shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-1"
        >
          <span>Ver Todos ({shortcuts.length})</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Barra de Entrada de Mensaje */}
      <form onSubmit={onSend} className="p-3 bg-[#070b14] border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={
            isConnected
              ? 'Escribe un mensaje al cliente... (Presiona Enter para enviar)'
              : '⚠️ Vincula WhatsApp para poder enviar mensajes...'
          }
          disabled={sendingMessage || !isConnected}
          className="flex-1 bg-[#0a0f1d] border border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || sendingMessage || !isConnected}
          className="h-10 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-orange-500/20 disabled:opacity-40 active:scale-95 shrink-0 cursor-pointer"
        >
          {sendingMessage ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <>
              <span>Enviar</span>
              <Send size={14} />
            </>
          )}
        </button>
      </form>
    </>
  );
}
