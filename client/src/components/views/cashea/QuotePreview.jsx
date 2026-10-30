import { ShoppingBag, AlertTriangle, PackageCheck, Plus, Copy, Check } from 'lucide-react';
import { formatBs } from '../../../utils/formatters';

export default function QuotePreview({
  products,
  selectedProduct,
  selectedNivel,
  inicialPct,
  inicialUsd,
  inicialBs,
  cuotasCasheaNum,
  cuotaQuincenalUsd,
  cuotaQuincenalBs,
  saldoFinanciarUsd,
  qualifiesCashea,
  amountShort,
  totalUsd,
  copiedCombo,
  copiedId,
  onCopyQuote,
  onAddToCombo
}) {
  return (
    <div className="lg:col-span-5 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between sticky top-6">
      <div className="space-y-4">
        <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-white">Plan de Pago Cashea</h3>
            <p className="text-xs text-slate-400">{cuotasCasheaNum} Cuotas Quincenales sin Interés (Tienda Física)</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center">
            <ShoppingBag size={18} />
          </div>
        </div>

        {/* BARRA DE PROGRESO Y AVISO DE MÍNIMO $25 */}
        {!qualifiesCashea ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle size={15} />
                <span>Faltan ${amountShort.toFixed(2)} USD</span>
              </span>
              <span className="font-mono text-slate-400">
                ${totalUsd.toFixed(2)} / $25.00
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(8, (totalUsd / 25) * 100))}%` }}
              />
            </div>

            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Cashea aplica a partir de <strong>$25 USD</strong> en tienda física. Puedes sumar otro repuesto o aumentar la cantidad para activar las {cuotasCasheaNum} cuotas.
            </p>

            {/* Sugerencias rápidas para completar el combo */}
            {products.length > 1 && (
              <div className="pt-1 border-t border-amber-500/20 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-amber-300/80 block">
                  💡 Sugerencias rápidas para llegar a los $25:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {products
                    .filter(p => selectedProduct && String(p.id) !== String(selectedProduct.id))
                    .slice(0, 3)
                    .map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onAddToCombo(p, 1)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>{p.modelo} (${parseFloat(p.precio_usd).toFixed(2)})</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-fade-in">
            <span className="flex items-center gap-2 font-bold">
              <PackageCheck size={17} className="text-emerald-400" />
              <span>¡Mínimo de $25 Cashea alcanzado!</span>
            </span>
            <span className="font-mono font-black text-emerald-400">${totalUsd.toFixed(2)} USD</span>
          </div>
        )}

        {/* Inicial a pagar hoy */}
        <div className={`p-4 rounded-2xl space-y-1 border ${
          qualifiesCashea
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-slate-900/40 border-slate-800'
        }`}>
          <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">
            Pago Inicial en Tienda (Nivel {selectedNivel} - {Math.round(inicialPct * 100)}%)
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-orange-300 font-mono">
              ${inicialUsd.toFixed(2)} USD
            </span>
            <span className="text-sm font-bold text-white font-mono">
              Bs. {formatBs(inicialBs)}
            </span>
          </div>
          <p className="text-[11px] text-orange-400/80">Escaneas con tu app Cashea en caja y retiras de inmediato</p>
        </div>

        {/* Cuotas Quincenales */}
        <div className="p-4 bg-[#070b14] rounded-2xl border border-slate-800 space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            {cuotasCasheaNum} Cuotas Quincenales (Vía Cashea)
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-white font-mono">
              ${cuotaQuincenalUsd.toFixed(2)} USD / cuota
            </span>
            <span className="text-xs font-bold text-orange-400 font-mono">
              Bs. {formatBs(cuotaQuincenalBs)}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Total financiado: ${saldoFinanciarUsd.toFixed(2)} USD</p>
        </div>
      </div>

      {/* Botón Copiar Cotización */}
      <button
        type="button"
        onClick={onCopyQuote}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95 cursor-pointer"
      >
        {copiedCombo || copiedId === 'manual' ? (
          <>
            <Check size={16} />
            <span>¡Cotización Copiada con Éxito!</span>
          </>
        ) : (
          <>
            <Copy size={16} />
            <span>Copiar Cotización Lista para WhatsApp</span>
          </>
        )}
      </button>
    </div>
  );
}
