import { useState } from 'react';
import { Package, Plus, Search, Grid, List, Copy, Check, Edit2, Trash2, ShoppingBag, Sparkles, ChevronDown, Car } from 'lucide-react';
import { toast } from 'sonner';
import { formatBs } from '../../utils/formatters';
import { PRODUCT_CATEGORIES } from '../../constants/categories';
import BulkPriceModal from '../modals/BulkPriceModal';

export default function CatalogView({
  products,
  bcvRate,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  onCopyQuote,
  copiedId,
  onReload
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');
  const [savingInline, setSavingInline] = useState(false);

  const startInlineEdit = (p) => {
    setEditingPriceId(p.id);
    setEditingPriceVal(String(p.precio_usd || ''));
  };

  const handleSaveInlinePrice = async (p) => {
    const parsed = parseFloat(editingPriceVal);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Precio inválido');
      return;
    }
    setSavingInline(true);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precio_usd: parsed })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Precio actualizado a $${parsed.toFixed(2)} USD`);
        setEditingPriceId(null);
        if (onReload) onReload();
      } else {
        toast.error(data.error || 'Error al actualizar precio');
      }
    } catch (e) {
      toast.error('Error de conexión');
    } finally {
      setSavingInline(false);
    }
  };

  const normalizeCat = (cat) => {
    if (!cat) return '';
    let c = String(cat).trim();
    if (c === 'Repuestos para Moto' || c.startsWith('Repuestos para Moto')) {
      c = c.replace('Repuestos para Moto', 'Repuestos Moto');
    }
    if (c === 'Insumos para Caucheras' || c.startsWith('Insumos para Caucheras')) {
      c = c.replace('Insumos para Caucheras', 'Insumos Cauchera');
    }
    return c;
  };

  const categories = Array.from(new Set([
    ...PRODUCT_CATEGORIES,
    ...products.map(p => normalizeCat(p.categoria)).filter(Boolean)
  ])).filter(c => c !== 'Test');

  const filtered = products.filter(p => {
    const q = searchTerm.toLowerCase();
    const marca = (p.marca || '').toLowerCase();
    const modelo = (p.modelo || '').toLowerCase();
    const rawCat = p.categoria || '';
    const normCat = normalizeCat(rawCat);
    const categoria = normCat.toLowerCase();

    const matchesSearch = marca.includes(q) || modelo.includes(q) || categoria.includes(q);
    const matchesCat = categoryFilter === 'all' ||
      normCat === categoryFilter ||
      rawCat === categoryFilter ||
      normCat.startsWith(categoryFilter + ' -') ||
      rawCat.startsWith(categoryFilter + ' -');

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

          {/* Filtro de Categoría con diseño estilizado */}
          <div className="relative w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto h-10 bg-[#070b14] border border-slate-800 hover:border-slate-700 rounded-xl pl-3.5 pr-8 text-xs text-slate-300 focus:outline-none focus:border-orange-500 transition appearance-none cursor-pointer"
            >
              <option value="all">Todas las Categorías ({products.length})</option>
              {categories.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Botón Ajuste Masivo de Precios en 1 Clic */}
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            title="Ajustar precios masivamente en 1 clic (+% o monto)"
            className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:text-orange-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm shadow-orange-500/10"
          >
            <Sparkles size={14} className="text-orange-400" />
            <span>Ajuste Masivo</span>
          </button>

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
                            <Car size={20} />
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
                              onChange={(e) => setEditingPriceVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveInlinePrice(p);
                                if (e.key === 'Escape') setEditingPriceId(null);
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
                              onClick={() => setEditingPriceId(null)}
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
      {/* Modal de Ajuste Masivo de Precios */}
      <BulkPriceModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        products={products}
        categories={categories}
        bcvRate={bcvRate}
        onSuccess={() => {
          if (onReload) onReload();
        }}
      />
    </div>
  );
}
