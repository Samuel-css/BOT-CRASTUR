/**
 * @file DeliveryTab.jsx
 * @description Pestaña "Delivery Caracas": zonas y tarifas de motorizado.
 */

import { Truck, RotateCcw, Trash2, Plus } from 'lucide-react';
import { cardCls } from '../styles';

export default function DeliveryTab({
  deliveryZones,
  handleResetZones,
  handleZoneChange,
  handleDeleteZone,
  handleAddZone
}) {
  return (
            <div className="space-y-6">
              <div className={cardCls}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                      <Truck size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Tarifas y Cobertura de Delivery en Caracas</h3>
                      <p className="text-[11px] text-slate-400">El bot cotiza según la zona que indique el cliente</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetZones}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Restablecer Tarifas</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {deliveryZones.map((zone, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[#070b14] border border-slate-800/80 rounded-2xl space-y-3 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">Sector / Municipio:</label>
                            <input
                              type="text"
                              value={zone.zona}
                              onChange={(e) => handleZoneChange(idx, 'zona', e.target.value)}
                              placeholder="Ej: Chacao / Las Mercedes"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">Tarifa de Envío:</label>
                            <input
                              type="text"
                              value={zone.tarifa}
                              onChange={(e) => handleZoneChange(idx, 'tarifa', e.target.value)}
                              placeholder="Ej: $3 a $4 USD"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-orange-400 focus:outline-none focus:border-orange-500 font-mono font-bold"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteZone(idx)}
                          className="self-end sm:self-center p-2 rounded-xl text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">
                          Palabras clave que activan esta tarifa (separadas por comas):
                        </label>
                        <input
                          type="text"
                          value={zone.palabras}
                          onChange={(e) => handleZoneChange(idx, 'palabras', e.target.value)}
                          placeholder="Ej: chacao, altamira, el rosal, los palos grandes"
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddZone}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-slate-700 hover:border-orange-500 text-xs font-bold text-slate-400 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Agregar Nueva Zona de Delivery</span>
                </button>
              </div>
            </div>
  );
}
