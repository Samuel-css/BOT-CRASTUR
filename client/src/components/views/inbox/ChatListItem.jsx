/**
 * @file ChatListItem.jsx
 * @description Ítem de la lista de conversaciones del Live Inbox: avatar, badges,
 * último mensaje, hora relativa y acción de borrado. Extraído de LiveInboxView.jsx.
 */

import { Trash2 } from 'lucide-react';
import { formatPhone, formatChatTime, handoffRemainingText } from './formatters';

export default function ChatListItem({ session, isSelected, onSelect, onDelete, now }) {
  const isPaused = session.bot_pausado === 1 || session.bot_pausado === '1';
  const phone = formatPhone(session.jid, session);
  const lastMsg = session.ultimo_mensaje_texto || 'Consulta recibida';
  const isClient = session.ultimo_remitente === 'cliente';
  const hasApartado = (session.tiene_apartado_activo && session.tiene_apartado_activo > 0) || !!session.apartado_producto;
  const handoffEstado = String(session.handoff_estado || '');
  const handoffPendiente = handoffEstado === 'pendiente' && Number(session.handoff_vence_at) > 0;
  const handoffVencido = handoffEstado === 'vencido';
  const handoffFueraHorario = handoffEstado === 'fuera_horario';
  const pausadoPorHandoff = session.bot_pausado_por === 'handoff' || handoffPendiente;
  const handoffTiempo = handoffPendiente ? handoffRemainingText(session.handoff_vence_at, now) : '';

  return (
    <div
      onClick={() => onSelect(session.jid)}
      className={`p-3 cursor-pointer transition flex items-start gap-3 select-none group ${
        isSelected
          ? 'bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border-l-4 border-orange-500'
          : 'hover:bg-slate-900/60'
      }`}
    >
      {/* Avatar con indicador */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
          {(session.push_name || 'C').charAt(0)}
        </div>
        {isPaused ? (
          <span
            title={
              pausadoPorHandoff
                ? handoffVencido
                  ? 'SLA vencido: el asesor no respondió en el plazo'
                  : 'Asesor solicitado: el bot está en pausa hasta que responda'
                : session.bot_pausado_por === 'asesor'
                  ? 'Un asesor está atendiendo (bot pausado automáticamente)'
                  : 'Bot pausado manualmente por el asesor'
            }
            className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-[#070b14] flex items-center justify-center text-[8px] text-slate-950 font-black ${
              handoffVencido
                ? 'bg-rose-500'
                : pausadoPorHandoff
                  ? 'bg-sky-400'
                  : session.bot_pausado_por === 'asesor'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
            }`}
          >
            {handoffVencido ? '!' : pausadoPorHandoff ? 'H' : session.bot_pausado_por === 'asesor' ? 'A' : 'P'}
          </span>
        ) : (
          <span
            title="Bot respondiendo automáticamente"
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070b14]"
          ></span>
        )}
      </div>

      {/* Información del chat */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-bold text-white truncate">
            {session.push_name || phone}
          </h4>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <span className="text-[10px] text-slate-500 font-mono">
              {formatChatTime(session.ultimo_mensaje_at)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.jid, session.push_name || phone);
              }}
              title={`Eliminar conversación con ${session.push_name || phone}`}
              className="opacity-70 sm:opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all ml-0.5"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* BADGES DE ESTADO (Limpios y sin falsos positivos de palabras clave) */}
        <div className="flex items-center gap-1.5 flex-wrap my-1">
          {hasApartado && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-0.5 shrink-0">
              🏷️ Apartado Activo
            </span>
          )}
          {handoffPendiente && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1 shrink-0">
              ⏳ Asesor · {handoffTiempo}
            </span>
          )}
          {handoffVencido && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 shrink-0">
              🔴 SLA vencido
            </span>
          )}
          {handoffFueraHorario && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-300 border border-slate-600/60 flex items-center gap-1 shrink-0">
              🌙 Asesor al abrir
            </span>
          )}
          {isClient ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              Por Responder
            </span>
          ) : (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50 shrink-0">
              ✓ Respondido
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 truncate font-sans">
          {isClient ? '' : '↪ '}
          {lastMsg}
        </p>

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-slate-500 font-mono truncate">
            {phone}
          </span>
          {isPaused ? (
            pausadoPorHandoff ? (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-semibold whitespace-nowrap ${
                handoffVencido
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
              }`}>
                {handoffVencido ? 'SLA vencido' : 'Asesor'}
              </span>
            ) : session.bot_pausado_por === 'asesor' ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold whitespace-nowrap">
                Asesor
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold whitespace-nowrap">
                Manual
              </span>
            )
          ) : handoffFueraHorario ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-700/50 border border-slate-600/50 text-slate-300 font-semibold whitespace-nowrap">
              Al abrir
            </span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium whitespace-nowrap">
              Bot Activo
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
