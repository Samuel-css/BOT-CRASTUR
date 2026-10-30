/**
 * @file PaymentsTab.jsx
 * @description Pestaña "Formas de Pago & Cashea".
 */

import { ShoppingBag, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_OPTIONS } from '../constants';
import { parseActivePayments } from '../helpers';
import { cardCls, labelCls } from '../styles';

export default function PaymentsTab({ form, setForm, togglePaymentItem }) {
  return (
            <div className="space-y-6">
              {/* TARJETAS CONMUTABLES DE FORMAS DE PAGO */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">¿Qué Formas de Pago Aceptamos Hoy?</h3>
                    <p className="text-[11px] text-slate-400">Toca cada tarjeta para encenderla o apagarla según lo que tengas disponible en caja</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PAYMENT_OPTIONS.map((item) => {
                    const activePayments = parseActivePayments(form.metodos_pago);
                    const isAvailable = activePayments.includes(item.label);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => togglePaymentItem(item.label)}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isAvailable
                            ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200 ring-1 ring-emerald-500/30 shadow-md'
                            : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                            isAvailable
                              ? 'bg-emerald-500/25 border-emerald-500/50'
                              : 'bg-slate-900 border-slate-800'
                          }`}>
                            {item.Icon && <item.Icon size={18} className={isAvailable ? 'text-emerald-300' : item.iconColor} />}
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            isAvailable
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'bg-slate-900 border border-slate-800 text-slate-500'
                          }`}>
                            {isAvailable ? '✓ ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{item.label}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                        <span className={`text-[10px] font-semibold mt-3 ${
                          isAvailable ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {isAvailable ? 'Tocar para apagar' : 'Tocar para encender'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* VISTA RESUMEN DEL TEXTO DE PAGOS */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Resumen informado a los clientes:
                  </span>
                  <p className="text-xs text-white font-medium">
                    {parseActivePayments(form.metodos_pago).length > 0
                      ? parseActivePayments(form.metodos_pago).join(', ')
                      : '⚠️ No has seleccionado formas de pago activas (todas apagadas).'}
                  </p>
                </div>
              </div>

              {/* CASHEA EN TIENDA */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Cashea (Financiamiento en Cuotas)</h3>
                    <p className="text-[11px] text-slate-400">Porcentaje de inicial que solicita la tienda física</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className={labelCls}>Porcentaje de inicial estándar:</label>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      { pct: 40, label: '40% (Nivel 1 - Estándar recomendado)' },
                      { pct: 30, label: '30% (Nivel 2)' },
                      { pct: 20, label: '20% (Nivel 3+)' }
                    ].map((c) => {
                      const isSelected = form.cashea_inicial_pct === String(c.pct);
                      return (
                        <button
                          key={c.pct}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, cashea_inicial_pct: String(c.pct) }));
                            toast.success(`Inicial de Cashea configurada en ${c.pct}%`);
                          }}
                          className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md'
                              : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          💛 {c.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Se aplica en compras presenciales mayores a <strong>$25 USD</strong> escaneando el código QR en caja.
                  </p>
                </div>
              </div>
            </div>
  );
}
