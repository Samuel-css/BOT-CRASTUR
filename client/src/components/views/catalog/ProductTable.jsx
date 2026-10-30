/**
 * @file ProductTable.jsx
 * @description Tabla densa de inventario con edición inline del precio USD,
 * precios en Bolívares, inicial Cashea y acciones por producto.
 * Extraído de CatalogView.jsx.
 */

import { Copy, Edit2, Trash2 } from 'lucide-react';
import { formatBs } from '../../../utils/formatters';
import { copyInstagramCaption, InstagramIcon } from '../../../utils/instagramFormatter';

export default function ProductTable({
  products,
  bcvRate,
  onCopyQuote,
  onEditProduct,
  onDeleteProduct,
  editingPriceId,
  editingPriceVal,
  onEditingPriceChange,
  savingInline,
  startInlineEdit,
  cancelInlineEdit,
  handleSaveInlinePrice
}) {
  return (
    <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#070b14] text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Marca & Modelo</th>
              <th className="py-3.5 px-4">Categoría</th>
              <th className="py-3.5 px-4">Stock</th>
              <th className="py-3.5 px-4">Precio USD</th>
              <th className="py-3.5 px-4">Bolívares</th>
              <th className="py-3.5 px-4">Inicial Cashea</th>
              <th className="py-3.5 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {products.map((p) => {
              const precioUsd = parseFloat(p.precio_usd) || 0;
              const precioBs = precioUsd * bcvRate;
              const casheaInicial = Number(p.cashea_inicial_usd ?? (precioUsd * 0.40));

              return (
                <tr key={p.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-bold text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#060913] border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden p-1">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt={p.modelo} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-500 font-bold">CR</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-white block truncate">{p.marca ? `${p.marca} - ` : ''}{p.modelo}</span>
                        {p.descripcion && <span className="text-[11px] text-slate-500 font-normal line-clamp-1">{p.descripcion}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{p.categoria}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">{p.stock}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    {editingPriceId === p.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-orange-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          autoFocus
                          value={editingPriceVal}
                          onChange={(e) => onEditingPriceChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlinePrice(p);
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          className="w-20 bg-slate-900 border border-orange-500 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlinePrice(p)}
                          disabled={savingInline}
                          className="px-1.5 py-1 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold text-xs"
                          title="Guardar (Enter)"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={cancelInlineEdit}
                          className="px-1.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white text-xs"
                          title="Cancelar (Esc)"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startInlineEdit(p)}
                        title="Haz clic para editar precio al instante (Enter para guardar)"
                        className="group/price flex items-center gap-1.5 hover:text-orange-300 px-2 py-1 -mx-2 rounded-lg hover:bg-slate-800/80 transition cursor-pointer"
                      >
                        <span>${precioUsd.toFixed(2)}</span>
                        <Edit2 size={11} className="opacity-0 group-hover/price:opacity-100 text-slate-400" />
                      </button>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-orange-400">Bs. {formatBs(precioBs)}</td>
                  <td className="py-3.5 px-4 font-mono text-orange-300 font-semibold">
                    {precioUsd >= 25 ? (
                      `$${casheaInicial.toFixed(2)}`
                    ) : (
                      <span className="text-[10px] text-slate-500 font-normal italic" title="Aplica en compras mayores a $25 en tienda">Mín. $25</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => copyInstagramCaption(p, bcvRate)}
                        className="p-1.5 hover:bg-purple-950/40 rounded-lg text-purple-400 hover:text-purple-300 transition cursor-pointer"
                        title="Copiar texto para Instagram"
                      >
                        <InstagramIcon size={13} />
                      </button>
                      <button
                        onClick={() => onCopyQuote(p)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                        title="Copiar cotización"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => onEditProduct(p)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteProduct(p.id)}
                        className="p-1.5 hover:bg-rose-950/40 rounded-lg text-rose-400 transition"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
