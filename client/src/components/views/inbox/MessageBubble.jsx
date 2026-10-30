/**
 * @file MessageBubble.jsx
 * @description Burbuja individual del Live Inbox: mensajes del cliente, del asesor,
 * del bot y avisos de sistema. Extraído de LiveInboxView.jsx.
 */

import { User, Bot, CheckCircle2 } from 'lucide-react';
import { formatMsgTime } from './formatters';

export default function MessageBubble({ msg, activeSession }) {
  const isFromClient = msg.remitente === 'cliente';
  const isFromAdvisor = msg.remitente === 'asesor';
  const isSystem = msg.remitente === 'sistema';

  // [HUMAN TAKEOVER AUTOMÁTICO] Avisos del sistema en el centro del chat
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[92%] text-center text-[11px] text-slate-400 bg-slate-900/70 border border-slate-800 rounded-2xl px-3.5 py-1.5 leading-relaxed">
          {msg.contenido}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isFromClient ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 shadow-md ${
          isFromClient
            ? 'bg-[#121829] border border-slate-800 text-slate-100 rounded-tl-sm'
            : isFromAdvisor
            ? 'bg-gradient-to-r from-emerald-950/80 to-[#071d15] border border-emerald-500/30 text-emerald-100 rounded-tr-sm'
            : 'bg-gradient-to-r from-[#1b1509] to-[#26180a] border border-orange-500/30 text-orange-100 rounded-tr-sm'
        }`}
      >
        {/* Etiqueta del remitente */}
        <div className="flex items-center gap-1.5 text-[10px] mb-1 font-semibold">
          {isFromClient ? (
            <span className="text-slate-400 flex items-center gap-1">
              <User size={11} />
              {activeSession?.push_name || 'Cliente'}
            </span>
          ) : isFromAdvisor ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={11} />
              Asesor Humano
            </span>
          ) : (
            <span className="text-orange-400 flex items-center gap-1">
              <Bot size={11} />
              Bot Crastur
            </span>
          )}
        </div>

        {/* Contenido del mensaje */}
        <p className="text-xs sm:text-[13px] whitespace-pre-wrap leading-relaxed break-words">
          {msg.contenido}
        </p>

        {/* Hora del mensaje */}
        <div className="text-right mt-1">
          <span className="text-[9px] text-slate-400 font-mono opacity-80">
            {formatMsgTime(msg.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}
