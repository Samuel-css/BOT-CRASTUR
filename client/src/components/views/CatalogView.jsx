import { useState } from 'react';
import { Package, Plus, Search, Grid, List, Copy, Check, Edit2, Trash2, ShoppingBag } from 'lucide-react';
import { formatBs } from '../../utils/formatters';
import { PRODUCT_CATEGORIES } from '../../constants/categories';

export default function CatalogView({
  products,
  bcvRate,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  onCopyQuote,
  copiedId
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  const categories = Array.from(new Set([
    ...PRODUCT_CATEGORIES,
    ...products.map(p => p.categoria).filter(Boolean)
  ]));

  const filtered = products.filter(p => {
    const q = searchTerm.toLowerCase();
    const marca = (p.marca || '').toLowerCase();
    const modelo = (p.modelo || '').toLowerCase();
    const categoria = (p.categoria || '').toLowerCase();

    const matchesSearch = marca.includes(q) || modelo.includes(q) || categoria.includes(q);
    const matchesCat = categoryFilter === 'all' || p.categoria === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Barra superior de controles */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0a0f1d] p-4 rounded-3xl border border-slate-800/80 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Input de Búsqueda */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#070b14] border border-slate-800 rounded-2xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
            />
          </div>

          {/* Filtro de Categoría */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto bg-[#070b14] border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-orange-500 transition"
          >
            <option value="all">Todas las Categorías ({products.length})</option>
            {categories.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Alternador Grid / Table */}
          <div className="flex items-center bg-[#070b14] rounded-2xl p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl text-xs transition ${
                viewMode === 'grid' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista en Tarjetas"
            >
              <Grid size={15} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-xl text-xs transition ${
                viewMode === 'table' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista en Tabla"
            >
              <List size={15} />
            </button>
          </div>

          {/* Botón Agregar Producto */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95"
          >
            <Plus size={16} />
            <span>Agregar Producto</span>
          </button>
        </div>
      </div>

      {/* Contenido del Catálogo */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-[#0a0f1d] border border-slate-800/80 rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#070b14] border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Package size={28} />
          </div>
          <h4 className="font-bold text-base text-white">No hay productos registrados</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            El catálogo se encuentra listo para registrar los productos de tu negocio. Haz clic en "Agregar Producto" para registrar el primero.
          </p>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 mt-2"
          >
            <Plus size={15} />
            <span>Agregar Primer Producto</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const precioUsd = parseFloat(p.precio_usd) || 0;
            const precioBs = precioUsd * bcvRate;
            const casheaInicial = precioUsd * 0.40;

            return (
              <div
                key={p.id}
                className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl flex flex-col justify-between card-hover group"
              >
                <div className="space-y-3">
                  {p.imagen_url && (
                    <div className="h-44 rounded-2xl overflow-hidden bg-[#070b14] border border-slate-800/80">
                      <img
                        src={p.imagen_url}
                        alt={p.modelo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}

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
                      onClick={() => onEditProduct(p)}
                      className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
                      title="Editar repuesto"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteProduct(p.id)}
                      className="p-2 hover:bg-rose-950/40 rounded-xl text-rose-400 hover:text-rose-300 transition"
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
      ) : (
        /* Vista en Tabla */
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
                {filtered.map((p) => {
                  const precioUsd = parseFloat(p.precio_usd) || 0;
                  const precioBs = precioUsd * bcvRate;
                  const casheaInicial = precioUsd * 0.40;

                  return (
                    <tr key={p.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {p.marca} {p.modelo}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{p.categoria}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{p.stock}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">${precioUsd.toFixed(2)}</td>
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
                            onClick={() => onCopyQuote(p)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
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
      )}
    </div>
  );
}
