/**
 * @file ChatHeader.jsx
 * @description Cabecera del chat abierto: datos del cliente, copia de teléfono,
 * estado del bot y botones Limpiar/Pausar. Extraído de LiveInboxView.jsx.
 */

import { ArrowLeft, Copy, Check, Trash2, PlayCircle, PauseCircle } from 'lucide-react';
import { formatPhone, formatHandoffTime } from './formatters';

export default function ChatHeader({
  selectedJid,
  activeSession,
  pausadoPorAsesor,
  asesorUltimoTexto,
  copiedPhone,
  onBack,
  onCopyPhone,
  onClearChat,
  onToggleBotPause
}) {
  const phoneVal = formatPhone(selectedJid, activeSession);
  const isRealPhone = phoneVal && !phoneVal.includes('Cuenta de WhatsApp');
  const handoffEstado = String(activeSession?.handoff_estado || '');
  const handoffPendiente = handoffEstado === 'pendiente';
  const handoffVencido = handoffEstado === 'vencido';
  const handoffFueraHorario = handoffEstado === 'fuera_horario';
  const pausadoPorHandoff = activeSession?.bot_pausado_por === 'handoff' || handoffPendiente;

  return (
    <div className="p-3 sm:p-3.5 border-b border-slate-800/80 bg-[#070b14] flex items-center justify-between gap-2 sm:gap-3 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Botón Volver a Lista en Móvil */}
        <button
          type="button"
          onClick={onBack}
          className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition shrink-0"
          title="Volver a la lista de chats"
          aria-label="Volver a lista de chats"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center font-bold uppercase text-xs sm:text-sm shrink-0">
          {(activeSession?.push_name || 'C').charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] sm:max-w-[200px]">
              {activeSession?.push_name || 'Cliente de WhatsApp'}
            </h4>
            {handoffPendiente ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap flex items-center gap-1.5 bg-sky-500/15 text-sky-300 border-sky-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                <span className="hidden xl:inline">Asesor solicitado · Límite {formatHandoffTime(activeSession?.handoff_vence_at)}</span>
                <span className="xl:hidden">Asesor</span>
              </span>
            ) : handoffVencido ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap flex items-center gap-1.5 bg-rose-500/15 text-rose-300 border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                <span className="hidden xl:inline">SLA vencido · el bot retomó</span>
                <span className="xl:hidden">SLA vencido</span>
              </span>
            ) : activeSession?.bot_pausado ? (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap flex items-center gap-1.5 ${
                pausadoPorAsesor
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pausadoPorAsesor ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className="hidden xl:inline">
                  {pausadoPorAsesor ? 'Asesor Atendiendo (Bot en Pausa)' : 'Modo Manual (Bot Pausado)'}
                </span>
                <span className="xl:hidden">{pausadoPorAsesor ? 'Asesor' : 'Manual'}</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="hidden xl:inline">Bot Automático Activo</span>
                <span className="xl:hidden">Bot Activo</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
            <span className="font-mono">{phoneVal}</span>
            {isRealPhone && (
              <button
                type="button"
                onClick={() => onCopyPhone(phoneVal)}
                className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
                title="Copiar número de teléfono"
              >
                {copiedPhone ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            )}
            {activeSession?.ultimo_producto_nombre && (
              <>
                <span className="text-slate-600">•</span>
                <span className="truncate text-slate-300">
                  📦 {activeSession.ultimo_producto_nombre}
                </span>
              </>
            )}
            {handoffPendiente && (
              <>
                <span className="text-slate-600">•</span>
                <span className="truncate text-sky-300/90">
                  ⏳ Límite: {formatHandoffTime(activeSession?.handoff_vence_at)}
                </span>
              </>
            )}
            {handoffFueraHorario && (
              <>
                <span className="text-slate-600">•</span>
                <span className="truncate text-slate-300">🌙 Asesor al abrir</span>
              </>
            )}
            {asesorUltimoTexto && (
              <>
                <span className="text-slate-600">•</span>
                <span
                  className="truncate text-emerald-300/90"
                  title="Última vez que un asesor respondió en este chat (confirma que la PC recibe los mensajes del teléfono)"
                >
                  ✋ Asesor: {asesorUltimoTexto}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Botones de acción superior del chat */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Botón Limpiar conversación */}
        <button
          type="button"
          onClick={onClearChat}
          title="Limpiar mensajes de esta conversación"
          className="h-9 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Limpiar Chat</span>
        </button>

        {/* Botón de Pausa/Reanudación del Bot por Chat (Human Takeover) */}
        <button
          type="button"
          onClick={onToggleBotPause}
          className={`h-9 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
            activeSession?.bot_pausado
              ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
          }`}
          title={
            pausadoPorHandoff
              ? 'Cancelar la espera del asesor y devolver el chat al bot'
              : activeSession?.bot_pausado
                ? 'Reactivar el bot para que vuelva a responder automáticamente en este chat'
                : 'Pausar el bot para atender tú este chat sin interrupciones'
          }
        >
          {activeSession?.bot_pausado ? (
            <>
              <PlayCircle size={15} />
              <span className="hidden xl:inline">{pausadoPorAsesor ? 'Reactivar Bot' : 'Reanudar Bot'}</span>
              <span className="xl:hidden">Reactivar</span>
            </>
          ) : (
            <>
              <PauseCircle size={15} />
              <span className="hidden xl:inline">Atender yo</span>
              <span className="xl:hidden">Atender</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
