/**
 * @file StoreTab.jsx
 * @description Pestaña "Mi Tienda & Horario": estado de la tienda, horario e identidad.
 */

import { Clock, MapPin, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { SCHEDULE_OPTIONS } from '../constants';
import { cardCls, labelCls, inputCls } from '../styles';

export default function StoreTab({
  form,
  setForm,
  field,
  scheduleMode,
  handleScheduleSelect,
  handleUpdateCustomSchedule,
  customDays,
  customOpenTime,
  customCloseTime,
  customSunday
}) {
  const isStoreClosed = form.fuera_horario_activo === '1';

  return (
            <div className="space-y-6">
              {/* INTERRUPTOR GIGANTE DE ESTADO: TIENDA ABIERTA O CERRADA */}
              <div className={`p-5 rounded-3xl border transition-all shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                !isStoreClosed
                  ? 'bg-gradient-to-r from-emerald-950/40 to-[#0a0f1d] border-emerald-500/40'
                  : 'bg-gradient-to-r from-indigo-950/50 to-[#0a0f1d] border-indigo-500/40'
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                    !isStoreClosed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {!isStoreClosed ? '🟢' : '🌙'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {!isStoreClosed ? 'Tienda Abierta al Público' : 'Tienda Cerrada (Modo Nocturno / Domingo)'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {!isStoreClosed
                        ? 'El bot atiende cotizaciones y permite a los clientes apartar productos por 24 horas.'
                        : 'El bot informa que la tienda física está cerrada pero sigue respondiendo consultas de precios.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = isStoreClosed ? '0' : '1';
                    setForm(prev => ({ ...prev, fuera_horario_activo: nextVal }));
                    toast.success(nextVal === '1' ? 'Tienda marcada como CERRADA' : 'Tienda marcada como ABIERTA');
                  }}
                  className={`px-5 py-3 rounded-2xl font-bold text-xs transition cursor-pointer flex items-center gap-2 shrink-0 shadow-md ${
                    !isStoreClosed
                      ? 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-orange-500 hover:text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  }`}
                >
                  {!isStoreClosed ? '🌙 Marcar como Tienda Cerrada' : '☀️ Abrir Tienda Ahora'}
                </button>
              </div>

              {/* SELECTOR INTERACTIVO DE HORARIO DE TRABAJO */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Horario de Atención de la Tienda</h3>
                    <p className="text-[11px] text-slate-400">Selecciona el horario con el menú desplegable o personalízalo con horas a tu gusto</p>
                  </div>
                </div>

                {/* MENÚ DESPLEGABLE (SELECT) INTERACTIVO */}
                <div className="space-y-3">
                  <label className={labelCls}>Elige el horario de la tienda:</label>
                  <select
                    value={scheduleMode}
                    onChange={(e) => handleScheduleSelect(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:border-orange-500 focus:outline-none transition font-semibold cursor-pointer"
                  >
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-[#0a0f1d] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* 4 BOTONES DE ACCESO RÁPIDO TIPO CHIP */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleScheduleSelect(opt.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          scheduleMode === opt.id
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-sm'
                            : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.Icon && <opt.Icon size={14} className={scheduleMode === opt.id ? 'text-orange-400' : opt.iconColor} />}
                        <span>{opt.shortLabel}</span>
                      </button>
                    ))}
                  </div>

                  {/* CAJA DE HORARIO PERSONALIZADO (APARECE SOLO SI SE ELIGE LA 4TA OPCIÓN) */}
                  {scheduleMode === 'custom' && (
                    <div className="mt-3 p-4 bg-slate-900/60 border border-orange-500/30 rounded-2xl space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                        <span>✏️</span>
                        <span>Configurar horas personalizadas de apertura y cierre:</span>
                      </div>

                      <div className="space-y-3">
                        {/* 1. Horario de Lunes a Sábado */}
                        <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-2">
                          <span className="text-[11px] font-bold text-slate-300 block">
                            📅 Días de Semana (Lunes a Sábado):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">Días laborales:</label>
                              <select
                                value={customDays}
                                onChange={(e) => handleUpdateCustomSchedule(e.target.value, customOpenTime, customCloseTime, customSunday)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                              >
                                <option value="Lunes a Sábado">Lunes a Sábado</option>
                                <option value="Lunes a Viernes">Lunes a Viernes</option>
                                <option value="Todos los días">Todos los días</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">Apertura en semana:</label>
                              <select
                                value={customOpenTime}
                                onChange={(e) => handleUpdateCustomSchedule(customDays, e.target.value, customCloseTime, customSunday)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                              >
                                {['7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM'].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">Cierre en semana:</label>
                              <select
                                value={customCloseTime}
                                onChange={(e) => handleUpdateCustomSchedule(customDays, customOpenTime, e.target.value, customSunday)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                              >
                                {['2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM'].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* 2. Horario especial de Domingos */}
                        <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-2">
                          <span className="text-[11px] font-bold text-orange-400 block flex items-center gap-1.5">
                            <span>☀️</span>
                            <span>Atención los Domingos en Tienda Física:</span>
                          </span>
                          <select
                            value={customSunday}
                            onChange={(e) => handleUpdateCustomSchedule(customDays, customOpenTime, customCloseTime, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none cursor-pointer"
                          >
                            <option value="8:30 AM a 2:00 PM">☀️ Domingos de 8:30 AM a 2:00 PM (Medio Día habitual Crastur)</option>
                            <option value="8:00 AM a 1:00 PM">☀️ Domingos de 8:00 AM a 1:00 PM (Medio Día temprano)</option>
                            <option value="9:00 AM a 2:00 PM">☀️ Domingos de 9:00 AM a 2:00 PM</option>
                            <option value="8:00 AM a 8:00 PM">☀️ Domingos de 8:00 AM a 8:00 PM (Horario corrido)</option>
                            <option value="cerrado">🚫 Domingos Cerrado (Solo Asistente Virtual 24/7)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">O escribe el texto directamente si deseas:</label>
                        <input
                          type="text"
                          {...field('horario_atencion')}
                          placeholder="Ej: Lunes a Sábado de 8:00 AM a 8:00 PM"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}

                  {/* VISTA PREVIA DEL HORARIO QUE INFORMA EL BOT */}
                  <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>El bot informará a los clientes: <strong>"{form.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'}"</strong></span>
                    </span>
                  </div>
                </div>
              </div>

              {/* IDENTIDAD Y DIRECCIÓN FÍSICA */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Nombre y Ubicación de la Tienda</h3>
                    <p className="text-[11px] text-slate-400">Datos que se entregan al cliente para visitarnos en Caracas</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nombre Comercial del Negocio:</label>
                    <input
                      type="text"
                      {...field('nombre_negocio')}
                      placeholder="Ej: Crastur - Repuestos de Moto & Insumos de Cauchera"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-300">Enlace de Google Maps:</label>
                      {form.google_maps_url && (
                        <a
                          href={form.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <ExternalLink size={12} /> Probar Ubicación
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      {...field('google_maps_url')}
                      placeholder="https://maps.app.goo.gl/..."
                      className={inputCls}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelCls}>Dirección Exacta de la Tienda Física:</label>
                    <input
                      type="text"
                      {...field('direccion_tienda')}
                      placeholder="Ej: Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas"
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">El bot enviará esta dirección cuando los clientes pregunten dónde retirar los repuestos.</p>
                  </div>
                </div>
              </div>
            </div>
  );
}
