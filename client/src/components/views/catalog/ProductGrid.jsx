/**
 * @file ProductGrid.jsx
 * @description Cuadrícula de tarjetas de producto del catálogo: imagen adaptativa,
 * precios USD/Bs, inicial Cashea y acciones (cotización, Instagram, editar, eliminar).
 * Extraído de CatalogView.jsx.
 */

import { Package, Copy, Check, Edit2, Trash2, ShoppingBag, Sparkles } from 'lucide-react';
import { formatBs } from '../../../utils/formatters';
import { copyInstagramCaption, InstagramIcon } from '../../../utils/instagramFormatter';

export default function ProductGrid({
  products,
  bcvRate,
  onCopyQuote,
  copiedId,
  onEditProduct,
  onDeleteProduct
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((p) => {
        const precioUsd = parseFloat(p.precio_usd) || 0;
        const precioBs = precioUsd * bcvRate;
        // [CONSISTENCIA] El backend ya calcula la inicial según la configuración real
        // (cashea_inicial_pct). Antes el panel mostraba siempre 40%.
        const casheaInicial = Number(p.cashea_inicial_usd ?? (precioUsd * 0.40));

        return (
          <div
            key={p.id}
            className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between card-hover group"
          >
            <div className="space-y-3">
              {/* Contenedor Adaptativo de Imagen (Cualquier resolución sin recorte) */}
              <div className="h-48 w-full rounded-2xl overflow-hidden bg-[#060913] border border-slate-800/80 relative flex items-center justify-center p-2.5 group-hover:border-slate-700 transition">
                {p.imagen_url ? (
                  <img
                    src={p.imagen_url}
                    alt={p.modelo}
                    className="max-h-full max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300 select-none"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-slate-600 select-none">
                    <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 group-hover:text-orange-400 group-hover:border-orange-500/30 transition-colors">
                      {p.categoria === 'Combos & Kits' ? (
                        <Sparkles size={20} />
                      ) : p.categoria === 'Lubricantes & Fluidos' ? (
                        <Package size={20} />
                      ) : (
                        <Package size={20} />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {p.categoria}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 font-mono">
                    {p.marca}
                  </span>
                  <h4 className="font-bold text-sm text-white line-clamp-1">{p.modelo}</h4>
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-[#070b14] text-slate-400 border border-slate-800">
                    {p.categoria}
                  </span>
                </div>

                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#070b14] font-mono text-slate-300 border border-slate-800 shrink-0">
                  Stock: {p.stock}
                </span>
              </div>

              {p.descripcion && (
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.descripcion}</p>
              )}

              {/* Precios y Cashea */}
              <div className="p-3 bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-white font-mono">
                    ${precioUsd.toFixed(2)} USD
                  </span>
                  <span className="text-xs font-bold text-orange-400 font-mono">
                    Bs. {formatBs(precioBs)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-900 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <ShoppingBag size={12} className="text-orange-400" /> Cashea:
                  </span>
                  {precioUsd >= 25 ? (
                    <span className="font-bold text-orange-300 font-mono" title="Inicial 40% en tienda física">
                      Inicial ${casheaInicial.toFixed(2)} USD
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic" title="Aplica a partir de $25 USD en tienda física">
                      Mín. $25 (en combo)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Acciones de la tarjeta */}
            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                onClick={() => onCopyQuote(p)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition active:scale-95"
                title="Copiar cotización para WhatsApp"
              >
                {copiedId === p.id ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Cotización</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => copyInstagramCaption(p, bcvRate)}
                  className="p-2 hover:bg-purple-950/40 rounded-xl text-purple-400 hover:text-purple-300 border border-transparent hover:border-purple-500/30 transition cursor-pointer"
                  title="Copiar texto listo para Instagram"
                >
                  <InstagramIcon size={14} />
                </button>
                <button
                  onClick={() => onEditProduct(p)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
                  title="Editar repuesto"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onDeleteProduct(p.id)}
                  className="p-2 hover:bg-rose-950/40 rounded-xl text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  title="Eliminar del catálogo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
