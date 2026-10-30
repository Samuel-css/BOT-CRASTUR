/**
 * @file HumanTakeoverPanel.jsx
 * @description Sub-pestaña de pausa automática del bot cuando un vendedor contesta.
 */

import { UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cardCls, labelCls } from '../../styles';

export default function HumanTakeoverPanel({ form, setForm }) {
  return (
                    <div className={cardCls}>
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                          <UserCheck size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Cuando un Vendedor Contesta, el Bot se Calla</h3>
                          <p className="text-[11px] text-slate-400">El bot deja de responder ESE chat para no interrumpir la conversación humana</p>
                        </div>
                      </div>

                      {/* INTERRUPTOR DE PAUSA AUTOMÁTICA */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-white">Silenciar el bot automáticamente</div>
                          <p className="text-[11px] text-slate-400">Se activa apenas un vendedor escribe desde el teléfono o desde este panel</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const activo = form.auto_pausa_asesor !== '0';
                            const nextVal = activo ? '0' : '1';
                            setForm(prev => ({ ...prev, auto_pausa_asesor: nextVal }));
                            toast.success(nextVal === '1'
                              ? 'Pausa automática ACTIVADA: el bot se callará cuando un vendedor responda.'
                              : 'Pausa automática DESACTIVADA: el bot seguirá respondiendo aunque un vendedor escriba.');
                          }}
                          className={`px-5 py-3 rounded-2xl font-bold text-xs transition cursor-pointer flex items-center gap-2 shrink-0 shadow-md ${
                            form.auto_pausa_asesor !== '0'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                              : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
                          }`}
                        >
                          {form.auto_pausa_asesor !== '0' ? '✓ Activado' : 'Desactivado'}
                        </button>
                      </div>

                      {/* TIEMPO DE REACTIVACIÓN AUTOMÁTICA */}
                      <div className={`space-y-2 pt-3 border-t border-slate-800/70 transition ${
                        form.auto_pausa_asesor === '0' ? 'opacity-40 pointer-events-none select-none' : ''
                      }`}>
                        <label className={labelCls}>¿Cuándo debe volver a responder el bot?</label>
                        <p className="text-[10px] text-slate-500">
                          Solo si el cliente vuelve a escribir y el vendedor no ha respondido en ese tiempo. Si el vendedor sigue hablando, el bot nunca interrumpe.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { min: 60, label: '1 hora' },
                            { min: 180, label: '3 horas (Recomendado)' },
                            { min: 360, label: '6 horas' },
                            { min: 0, label: 'Nunca solo' }
                          ].map((t) => {
                            const isCurrent = String(form.reactivar_bot_minutos ?? '180') === String(t.min);
                            return (
                              <button
                                key={t.min}
                                type="button"
                                onClick={() => {
                                  setForm(prev => ({ ...prev, reactivar_bot_minutos: String(t.min) }));
                                  toast.success(t.min === 0
                                    ? 'El bot no se reactivará solo: el vendedor decide cuándo reanudarlo.'
                                    : `El bot retomará el chat si el cliente escribe después de ${t.label.replace(' (Recomendado)', '')} sin respuesta del vendedor.`);
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                  isCurrent
                                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md'
                                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span>{isCurrent ? '✓ ' : ''}{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {/* SLA DE RESPUESTA CUANDO EL CLIENTE PIDE UN ASESOR */}
                      <div className="space-y-2 pt-3 border-t border-slate-800/70">
                        <label className={labelCls}>Plazo cuando el cliente pide un asesor</label>
                        <p className="text-[10px] text-slate-500">
                          El bot avisa al cliente el tiempo máximo de espera, pausa este chat y deja el aviso al vendedor.
                          Si nadie responde, retoma la conversación y alerta al panel.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { min: 30, label: '30 minutos' },
                            { min: 60, label: '1 hora (Recomendado)' },
                            { min: 120, label: '2 horas' },
                            { min: 0, label: 'Sin plazo' }
                          ].map((t) => {
                            const isCurrent = String(form.handoff_sla_minutos ?? '60') === String(t.min);
                            return (
                              <button
                                key={t.min}
                                type="button"
                                onClick={() => {
                                  setForm(prev => ({ ...prev, handoff_sla_minutos: String(t.min) }));
                                  toast.success(t.min === 0
                                    ? 'Handoff desactivado: el bot seguirá mostrando la lista de asesores.'
                                    : `El cliente verá un plazo máximo de ${t.label.replace(' (Recomendado)', '')} para que un asesor responda.`);
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                  isCurrent
                                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300 shadow-md'
                                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span>{isCurrent ? '✓ ' : ''}{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
  );
}
