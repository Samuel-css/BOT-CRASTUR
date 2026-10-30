/**
 * @file OutOfHoursPanel.jsx
 * @description Sub-pestaña "Tienda Cerrada" del Asistente Virtual.
 */

import { Moon } from 'lucide-react';
import { toast } from 'sonner';
import { OUT_OF_HOURS_PRESETS } from '../../constants';
import { cleanCompare } from '../../helpers';
import { cardCls, labelCls, textareaCls } from '../../styles';

export default function OutOfHoursPanel({ form, setForm, field, isStoreClosed }) {
  return (
                    <div className={cardCls}>
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                          <Moon size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Respuestas Fuera de Horario</h3>
                          <p className="text-[11px] text-slate-400">Configura qué responder cuando escriban de noche, domingos o feriados</p>
                        </div>
                      </div>

                      {/* SWITCH RÁPIDO PARA ACTIVAR RESPUESTA DE CIERRE DIRECTO AQUÍ */}
                      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{isStoreClosed ? '🌙' : '🟢'}</span>
                          <div>
                            <div className="text-xs font-bold text-white">
                              {isStoreClosed ? 'Modo Tienda Cerrada Activo' : 'Tienda en Horario Normal'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {isStoreClosed
                                ? 'El bot está avisando que la tienda física está cerrada.'
                                : 'El bot atiende normalmente con el saludo estándar.'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = isStoreClosed ? '0' : '1';
                            setForm(prev => ({ ...prev, fuera_horario_activo: nextVal }));
                            toast.success(nextVal === '1' ? 'Tienda marcada como CERRADA' : 'Tienda marcada como ABIERTA');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isStoreClosed
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-md'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {isStoreClosed ? '✓ Modo Cerrado ON' : 'Activar Modo Cerrado'}
                        </button>
                      </div>

                      {/* 3 TARJETAS DE PLANTILLA DE CIERRE */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {OUT_OF_HOURS_PRESETS.map((oh) => {
                          const isSelected = cleanCompare(form.mensaje_fuera_horario, oh.texto);
                          return (
                            <button
                              key={oh.id}
                              type="button"
                              onClick={() => {
                                setForm(prev => ({ ...prev, mensaje_fuera_horario: oh.texto }));
                                toast.success(`Plantilla "${oh.titulo}" aplicada.`);
                              }}
                              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 ring-2 ring-indigo-500/30 shadow-md'
                                  : 'bg-[#070b14] border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                                    isSelected
                                      ? 'bg-indigo-500/25 border-indigo-500/50'
                                      : 'bg-slate-900 border-slate-800'
                                  }`}>
                                    {oh.Icon && <oh.Icon size={16} className={oh.iconColor} />}
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    isSelected ? 'bg-indigo-500 text-white font-black' : 'bg-slate-900 border border-slate-700 text-slate-400'
                                  }`}>
                                    {isSelected ? '✓ ACTIVO' : 'Elegir'}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-white">{oh.titulo}</h4>
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{oh.desc}</p>
                              </div>
                              <span className={`text-[10px] font-bold mt-2.5 ${
                                isSelected ? 'text-indigo-300' : 'text-slate-500'
                              }`}>
                                {isSelected ? '● Plantilla activa' : 'Tocar para elegir →'}
                              </span>
                            </button>
                          );
                        })}

                        {/* TARJETA PERSONALIZADO: fuera de horario */}
                        {!OUT_OF_HOURS_PRESETS.some(oh => cleanCompare(form.mensaje_fuera_horario, oh.texto)) && (
                          <div className="p-3.5 rounded-2xl border text-left flex flex-col justify-between bg-amber-950/30 border-amber-500/60 ring-2 ring-amber-500/25 shadow-md col-span-1 sm:col-span-3">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-amber-500/20 border-amber-500/50 text-lg">✏️</div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-slate-950">✓ ACTIVO</span>
                              </div>
                              <h4 className="text-xs font-bold text-white">Mensaje Personalizado</h4>
                              <p className="text-[10px] text-amber-300/80 mt-1">Estás usando tu propio mensaje de tienda cerrada.</p>
                            </div>
                            <span className="text-[10px] font-bold mt-2.5 text-amber-400">● Tu mensaje personalizado está activo</span>
                          </div>
                        )}
                      </div>

                      {/* EDITOR DE TEXTO CIERRE */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className={labelCls}>Mensaje que dirá el bot al estar cerrado:</label>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, mensaje_fuera_horario: OUT_OF_HOURS_PRESETS[0].texto }));
                              toast.info('Texto restaurado a Cierre Nocturno.');
                            }}
                            className="text-[10px] text-slate-400 hover:text-indigo-300 transition cursor-pointer"
                          >
                            Restaurar original
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          {...field('mensaje_fuera_horario')}
                          className={textareaCls}
                        />
                      </div>
                    </div>
  );
}
