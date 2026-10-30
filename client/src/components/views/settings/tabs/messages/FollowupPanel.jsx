/**
 * @file FollowupPanel.jsx
 * @description Sub-pestaña "Recordatorio" del Asistente Virtual.
 */

import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { FOLLOWUP_PRESETS } from '../../constants';
import { cleanCompare } from '../../helpers';
import { cardCls, labelCls, textareaCls } from '../../styles';

export default function FollowupPanel({ form, setForm, field }) {
  return (
                    <div className={cardCls}>
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                          <Bell size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Recordatorio Automático al Cliente</h3>
                          <p className="text-[11px] text-slate-400">Máximo 1 recordatorio por chat · nunca si un vendedor ya atendió · nunca si el cliente se despidió</p>
                        </div>
                      </div>

                      {/* SELECTOR DE TIEMPO CON BOTONES */}
                      <div className="space-y-2">
                        <label className={labelCls}>¿Cuánto tiempo esperar antes de enviar un recordatorio?</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { min: 0, label: 'Desactivado' },
                            { min: 60, label: '1 hora (Recomendado)' },
                            { min: 180, label: '3 horas' },
                            { min: 360, label: '6 horas' }
                          ].map((t) => {
                            const isCurrent = (t.min === 0 && form.insistencia_activa === '0') ||
                              (form.insistencia_activa === '1' && form.insistencia_minutos === String(t.min));
                            return (
                              <button
                                key={t.min}
                                type="button"
                                onClick={() => {
                                  if (t.min === 0) {
                                    setForm(prev => ({ ...prev, insistencia_activa: '0' }));
                                    toast.info('Recordatorios automáticos desactivados.');
                                  } else {
                                    setForm(prev => ({ ...prev, insistencia_activa: '1', insistencia_minutos: String(t.min) }));
                                    toast.success(`Recordatorio configurado: ${t.label.replace(' (Recomendado)', '')} de espera, máximo 1 por chat.`);
                                  }
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                  isCurrent
                                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md'
                                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span>{isCurrent ? '✓ ' : ''}{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* PLANTILLAS DE RECORDATORIO */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {FOLLOWUP_PRESETS.map((fp) => {
                          const isSelected = cleanCompare(form.mensaje_insistencia, fp.texto);
                          return (
                            <button
                              key={fp.id}
                              type="button"
                              onClick={() => {
                                setForm(prev => ({ ...prev, mensaje_insistencia: fp.texto }));
                                toast.success(`Plantilla "${fp.titulo}" aplicada.`);
                              }}
                              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer text-xs flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 ring-2 ring-amber-500/30'
                                  : 'bg-[#070b14] border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5 font-bold">
                                  <span className="flex items-center gap-1.5">
                                    {fp.Icon && <fp.Icon size={14} className={fp.iconColor} />}
                                    <span>{fp.titulo}</span>
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                    isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-500'
                                  }`}>
                                    {isSelected ? '✓ ACTIVO' : 'Elegir'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 line-clamp-2">{fp.texto.replace('{nombre}', 'el cliente').replace('{producto}', 'el repuesto')}</p>
                              </div>
                            </button>
                          );
                        })}

                        {/* TARJETA PERSONALIZADO: recordatorio */}
                        {!FOLLOWUP_PRESETS.some(fp => cleanCompare(form.mensaje_insistencia, fp.texto)) && (
                          <div className="p-3.5 rounded-2xl border text-left text-xs flex flex-col justify-between bg-amber-950/30 border-amber-500/60 ring-2 ring-amber-500/25 shadow-md col-span-1 sm:col-span-3">
                            <div>
                              <div className="flex items-center justify-between mb-1.5 font-bold">
                                <span className="flex items-center gap-1.5">✏️ <span>Personalizado</span></span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black">✓ ACTIVO</span>
                              </div>
                              <p className="text-[10px] text-amber-300/80 line-clamp-2">Estás usando tu propio recordatorio personalizado.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* EDITOR DE TEXTO RECORDATORIO */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className={labelCls}>Texto del recordatorio:</label>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, mensaje_insistencia: FOLLOWUP_PRESETS[0].texto }));
                              toast.info('Texto restaurado a Sutil & Amable.');
                            }}
                            className="text-[10px] text-slate-400 hover:text-amber-300 transition cursor-pointer"
                          >
                            Restaurar original
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          {...field('mensaje_insistencia')}
                          className={textareaCls}
                        />
                      </div>
                    </div>
  );
}
