/**
 * @file WhatsAppSimulator.jsx
 * @description Simulador visual del chat de WhatsApp con la vista previa del mensaje activo.
 */

import { Check, CheckCircle2 } from 'lucide-react';

export default function WhatsAppSimulator({ form, subTabMensajes }) {
  let previewTitle = '👋 Saludo Inicial';
  let previewText = form.mensaje_bienvenida || 'Te damos la bienvenida a Crastur...';
  let badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';

  if (subTabMensajes === 'fuera_horario') {
    previewTitle = '🌙 Tienda Cerrada';
    previewText = form.mensaje_fuera_horario || 'Nuestra tienda física se encuentra cerrada...';
    badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  } else if (subTabMensajes === 'seguimiento') {
    previewTitle = '⏱️ Recordatorio';
    previewText = (form.mensaje_insistencia || '¡Hola, {nombre}! ¿Pudiste revisar el precio de {producto}?')
      .replace('{nombre}', 'Carlos')
      .replace('{producto}', 'Pastillas de Freno SBR');
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }

  return (
      <div className="bg-[#0b141a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera WhatsApp */}
        <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xs">
              CR
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>{form.nombre_negocio || 'Crastur Repuestos'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-[10px] text-slate-400">en línea (Bot 24/7)</p>
            </div>
          </div>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono border ${badgeColor}`}>
            {previewTitle}
          </span>
        </div>

        {/* Cuerpo del Chat */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#0b141a] min-h-[300px]">
          <div className="flex justify-center">
            <span className="text-[10px] bg-[#182229] text-slate-400 px-3 py-1 rounded-full border border-slate-800">
              HOY
            </span>
          </div>

          {/* Mensaje simulado del cliente */}
          <div className="flex justify-end">
            <div className="bg-[#005c4b] text-slate-100 p-2.5 rounded-2xl rounded-tr-xs max-w-[85%] text-xs shadow-md">
              <p>Hola, buenas tardes. ¿Tienen pastillas de freno?</p>
              <div className="text-[9px] text-emerald-300/80 text-right mt-1 flex items-center justify-end gap-1 font-mono">
                <span>12:45 PM</span>
                <Check size={11} className="text-sky-300" />
              </div>
            </div>
          </div>

          {/* Respuesta del Bot de Crastur */}
          <div className="flex justify-start">
            <div className="bg-[#202c33] text-slate-100 p-3 rounded-2xl rounded-tl-xs max-w-[92%] text-xs shadow-md border border-slate-700/40 space-y-1.5">
              <p className="whitespace-pre-line leading-relaxed font-sans">{previewText}</p>
              <div className="text-[9px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1 font-mono">
                <span>12:45 PM</span>
                <CheckCircle2 size={11} className="text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior de WhatsApp */}
        <div className="bg-[#1f2c34] p-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
          <span>Vista en vivo del cliente</span>
          <span className="font-mono text-emerald-400 text-[10px] font-bold">● Simulación en tiempo real</span>
        </div>
      </div>
  );
}
