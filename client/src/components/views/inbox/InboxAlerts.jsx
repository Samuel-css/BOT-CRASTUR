/**
 * @file InboxAlerts.jsx
 * @description Avisos del Live Inbox: WhatsApp desconectado, apartado activo del cliente
 * y estado del bot (pausa manual o human takeover). Extraído de LiveInboxView.jsx.
 */

import { AlertTriangle, QrCode, ChevronRight, Clock } from 'lucide-react';
import { formatRate } from '../../../utils/formatters';
import { formatHandoffTime } from './formatters';

// ALERTA CRÍTICA: WHATSAPP DESCONECTADO (Con botón de acción directa)
export function WaDisconnectedAlert({ isConnected, onNavigate }) {
  if (isConnected) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/80 via-[#2a1707] to-amber-950/80 border-2 border-amber-500/60 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
      <div className="flex items-start sm:items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle size={20} className="animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
            <span>WhatsApp no está conectado al sistema</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
              Desconectado
            </span>
          </h4>
          <p className="text-[11px] sm:text-xs text-amber-300/80 mt-0.5 leading-relaxed">
            El Live Inbox y las respuestas automáticas del bot están en pausa hasta que vincules tu teléfono celular escaneando el código QR.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onNavigate && onNavigate('whatsapp')}
        className="h-10 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-orange-500/30 active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
      >
        <QrCode size={16} />
        <span>Vincular WhatsApp Ahora</span>
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// Banner de Apartado Activo si el cliente tiene una reserva vigente
export function ApartadoBanner({ activeSession, effectiveRate, onNavigate }) {
  if (!activeSession?.apartado_producto) return null;

  return (
    <div className="bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-[#070b14] border-b border-orange-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
          <Clock size={15} className="animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-orange-300 font-bold truncate">
              Apartado Activo: {activeSession.apartado_producto}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/30 text-orange-200 border border-orange-500/40 font-mono">
              24 Horas
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
            ${parseFloat(activeSession.apartado_monto || 0).toFixed(2)} USD (Bs. {formatRate(parseFloat(activeSession.apartado_monto || 0) * effectiveRate)})
            {activeSession.apartado_cedula && ` • CI: ${activeSession.apartado_cedula}`}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onNavigate && onNavigate('reservations')}
        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 transition shrink-0 cursor-pointer shadow-md shadow-orange-500/20 active:scale-95 whitespace-nowrap"
      >
        Ver en Apartados
      </button>
    </div>
  );
}

// Banner de estado del handoff con SLA
export function HandoffBanner({ activeSession }) {
  const estado = String(activeSession?.handoff_estado || '');
  if (!['pendiente', 'vencido', 'fuera_horario'].includes(estado)) return null;

  if (estado === 'pendiente') {
    return (
      <div className="bg-sky-950/40 border-b border-sky-500/25 px-4 py-2.5 text-[11px] text-sky-200 flex items-center gap-2.5">
        <span className="text-base">⏳</span>
        <span className="leading-relaxed">
          <strong>Asesor solicitado.</strong> El bot está en silencio en este chat hasta que un asesor responda.
          Límite: <strong>{formatHandoffTime(activeSession.handoff_vence_at)}</strong>.
        </span>
      </div>
    );
  }

  if (estado === 'vencido') {
    return (
      <div className="bg-rose-950/40 border-b border-rose-500/30 px-4 py-2.5 text-[11px] text-rose-200 flex items-center gap-2.5">
        <span className="text-base">🔴</span>
        <span className="leading-relaxed">
          <strong>SLA vencido:</strong> el asesor no respondió en el plazo. El bot retomó la conversación.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border-b border-slate-700/60 px-4 py-2.5 text-[11px] text-slate-300 flex items-center gap-2.5">
      <span className="text-base">🌙</span>
      <span className="leading-relaxed">
        <strong>Asesor solicitado fuera de horario.</strong> El bot sigue atendiendo; un asesor responderá al abrir.
      </span>
    </div>
  );
}

// Banner de Estado del Bot
export function BotStatusBanner({ activeSession, pausadoPorAsesor, botSettings, reactivacionTexto }) {
  if (!activeSession?.bot_pausado) return null;
  // El handoff tiene su propio banner para no duplicar el aviso de "modo manual".
  if (activeSession?.handoff_estado === 'pendiente') return null;

  return (
    <div className={`border-b px-4 py-2 text-[11px] flex items-center justify-between gap-3 ${
      pausadoPorAsesor
        ? 'bg-emerald-950/40 border-emerald-500/25 text-emerald-200'
        : 'bg-amber-950/40 border-amber-500/25 text-amber-300'
    }`}>
      <span className="leading-relaxed">
        {pausadoPorAsesor ? (
          <>
            ✋ <strong>Un asesor está atendiendo este chat:</strong> el bot quedó en silencio
            {parseInt(botSettings.reactivar_bot_minutos || '180', 10) > 0
              ? <> y se reactivará solo si el cliente vuelve a escribir después de {reactivacionTexto} sin respuesta del asesor.</>
              : <> y no se reactivará automáticamente.</>}
            {' '}También puedes reactivarlo ahora con el botón <strong>“Reactivar Bot”</strong>.
          </>
        ) : (
          <>
            ✋ <strong>El bot está silenciado para este cliente:</strong> puedes escribir y despachar
            libremente. El bot no intervendrá hasta que hagas clic en <strong>“Reanudar Bot”</strong>.
          </>
        )}
      </span>
    </div>
  );
}
