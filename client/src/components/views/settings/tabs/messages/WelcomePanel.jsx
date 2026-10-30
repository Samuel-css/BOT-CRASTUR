/**
 * @file WelcomePanel.jsx
 * @description Sub-pestaña "Saludo Inicial" del Asistente Virtual.
 */

import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { WELCOME_TONE_PRESETS } from '../../constants';
import { cleanCompare } from '../../helpers';
import { cardCls, textareaCls } from '../../styles';

export default function WelcomePanel({ form, setForm, field, insertVariable }) {
  return (
                    <div className={cardCls}>
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Estilo de Bienvenida para el Asistente</h3>
                          <p className="text-[11px] text-slate-400">Toca una personalidad para que el bot hable con ese estilo sin escribir nada</p>
                        </div>
                      </div>

                      {/* 4 TARJETAS EN GRID 2X2 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {WELCOME_TONE_PRESETS.map((p) => {
                          const isSelected = cleanCompare(form.mensaje_bienvenida, p.texto);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setForm(prev => ({ ...prev, mensaje_bienvenida: p.texto }));
                                toast.success(`Estilo "${p.titulo}" activado en el bot.`);
                              }}
                              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-500/30 shadow-lg shadow-orange-500/10'
                                  : 'bg-[#070b14] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                                    isSelected
                                      ? 'bg-orange-500/25 border-orange-500/50'
                                      : 'bg-slate-900 border-slate-800'
                                  }`}>
                                    {p.Icon && <p.Icon size={18} className={p.iconColor} />}
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    isSelected ? 'bg-orange-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-700 text-slate-300'
                                  }`}>
                                    {isSelected ? '✓ ACTIVO' : p.badge}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-white">{p.titulo}</h4>
                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{p.desc}</p>
                              </div>
                              <span className={`text-[10px] font-bold mt-2.5 inline-block ${
                                isSelected ? 'text-orange-400' : 'text-slate-500'
                              }`}>
                                {isSelected ? '● Tono aplicado' : 'Tocar para activar →'}
                              </span>
                            </button>
                          );
                        })}

                        {/* TARJETA PERSONALIZADO: aparece sólo cuando el texto no coincide con ningún preset */}
                        {!WELCOME_TONE_PRESETS.some(p => cleanCompare(form.mensaje_bienvenida, p.texto)) && (
                          <div className="p-3.5 rounded-2xl border text-left flex flex-col justify-between bg-amber-950/30 border-amber-500/60 ring-2 ring-amber-500/25 shadow-lg shadow-amber-500/10 col-span-1 sm:col-span-2">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-amber-500/20 border-amber-500/50 text-xl">✏️</div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-slate-950">✓ ACTIVO</span>
                              </div>
                              <h4 className="text-xs font-bold text-white">Mensaje Personalizado</h4>
                              <p className="text-[11px] text-amber-300/80 mt-1">Estás usando tu propio texto de bienvenida. El bot lo enviará exactamente como lo escribiste.</p>
                            </div>
                            <span className="text-[10px] font-bold mt-2.5 inline-block text-amber-400">● Tu mensaje personalizado está activo</span>
                          </div>
                        )}
                      </div>

                      {/* EDITOR DE TEXTO DEL SALUDO */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-300">
                            📝 Mensaje que enviará el Asistente:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, mensaje_bienvenida: WELCOME_TONE_PRESETS[0].texto }));
                              toast.info('Texto restaurado al estilo Pana Motero.');
                            }}
                            className="text-[10px] text-slate-400 hover:text-orange-400 transition cursor-pointer"
                          >
                            Restaurar original
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Insertar:</span>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', '{nombre}')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-200 hover:text-white cursor-pointer"
                          >
                            + {'{nombre}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', '{negocio}')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-200 hover:text-white cursor-pointer"
                          >
                            + {'{negocio}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', 'Cashea 💛')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-amber-500/40 text-[10px] text-amber-300 cursor-pointer"
                          >
                            + Cashea 💛
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', 'San Agustín Norte 📍')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-sky-500/40 text-[10px] text-sky-300 cursor-pointer"
                          >
                            + San Agustín 📍
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', 'Delivery Caracas 🛵')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-[10px] text-emerald-300 cursor-pointer"
                          >
                            + Delivery 🛵
                          </button>
                        </div>

                        <textarea
                          rows={4}
                          {...field('mensaje_bienvenida')}
                          placeholder="Escribe el saludo cordial del bot..."
                          className={textareaCls}
                        />
                      </div>
                    </div>
  );
}
