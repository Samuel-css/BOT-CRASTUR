/**
 * @file MessagesTab.jsx
 * @description Pestaña "Asistente Virtual": sub-navegador de mensajes y simulador.
 */

import { MessageSquare, Moon, Bell } from 'lucide-react';
import WhatsAppSimulator from '../WhatsAppSimulator';
import WelcomePanel from './messages/WelcomePanel';
import OutOfHoursPanel from './messages/OutOfHoursPanel';
import FollowupPanel from './messages/FollowupPanel';
import HumanTakeoverPanel from './messages/HumanTakeoverPanel';

export default function MessagesTab({
  form,
  setForm,
  field,
  insertVariable,
  subTabMensajes,
  setSubTabMensajes
}) {
  const isStoreClosed = form.fuera_horario_activo === '1';

  return (
            <div className="space-y-5">
              {/* SUB-NAVEGADOR DE 3 PASOS SIMPLES */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-[#070b14] border border-slate-800 rounded-2xl shadow-sm">
                <button
                  type="button"
                  onClick={() => setSubTabMensajes('bienvenida')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                    subTabMensajes === 'bienvenida'
                      ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border border-orange-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <MessageSquare size={17} className={subTabMensajes === 'bienvenida' ? 'text-orange-400' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="leading-tight">1. Saludo Inicial</div>
                    <div className="text-[10px] text-slate-500 font-normal">Cómo saluda el bot</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTabMensajes('fuera_horario')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                    subTabMensajes === 'fuera_horario'
                      ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/10 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Moon size={17} className={subTabMensajes === 'fuera_horario' ? 'text-indigo-400' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="leading-tight">2. Tienda Cerrada</div>
                    <div className="text-[10px] text-slate-500 font-normal">Noche y domingos</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTabMensajes('seguimiento')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                    subTabMensajes === 'seguimiento'
                      ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Bell size={17} className={subTabMensajes === 'seguimiento' ? 'text-amber-400' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="leading-tight">3. Recordatorio</div>
                    <div className="text-[10px] text-slate-500 font-normal">Mínimo 1 hora · 1 por chat</div>
                  </div>
                </button>
              </div>
      {/* DISTRIBUCIÓN EQUILIBRADA EN 2 COLUMNAS (CONTROLES IZQUIERDA | SIMULADOR WHATSAPP DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: CONTROLES DEL ASISTENTE */}
        <div className="lg:col-span-7 space-y-4">
          {/* SUBTAB 1: BIENVENIDA */}
          {subTabMensajes === 'bienvenida' && (
            <WelcomePanel
              form={form}
              setForm={setForm}
              field={field}
              insertVariable={insertVariable}
            />
          )}

          {/* SUBTAB 2: TIENDA CERRADA */}
          {subTabMensajes === 'fuera_horario' && (
            <OutOfHoursPanel
              form={form}
              setForm={setForm}
              field={field}
              isStoreClosed={isStoreClosed}
            />
          )}

          {/* SUBTAB 3: RECORDATORIO */}
          {subTabMensajes === 'seguimiento' && (
            <FollowupPanel form={form} setForm={setForm} field={field} />
          )}

          {/* SUBTAB 3b: [HUMAN TAKEOVER] EL BOT SE CALLA CUANDO UN VENDEDOR CONTESTA */}
          {subTabMensajes === 'seguimiento' && (
            <HumanTakeoverPanel form={form} setForm={setForm} />
          )}
        </div>

        {/* COLUMNA DERECHA: SIMULADOR WHATSAPP EN VIVO (STICKY) */}
        <div className="lg:col-span-5 sticky top-6">
          <WhatsAppSimulator form={form} subTabMensajes={subTabMensajes} />
        </div>
      </div>
    </div>
  );
}
