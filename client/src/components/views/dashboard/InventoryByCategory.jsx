import { Layers, AlertTriangle } from 'lucide-react';

export default function InventoryByCategory({ products, onNavigate }) {
  // [CONTEÓ POR CATEGORÍA CANÓNICA] Agrupa subcategorías del panel para saber
  // qué líneas comerciales aún no tienen productos cargados.
  const normalizeCat = (c) => String(c || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const categoryGroups = [
    { key: 'Insumos Cauchera', label: 'Insumos Cauchera', emoji: '🛞', aliases: ['insumos cauchera', 'insumos para caucheras', 'cauchera'] },
    { key: 'Repuestos Moto', label: 'Repuestos Moto', emoji: '🏍️', aliases: ['repuestos moto', 'repuestos para moto', 'repuestos de moto'] },
    { key: 'Accesorios Moto', label: 'Accesorios Moto', emoji: '🪖', aliases: ['accesorios moto', 'accesorios para moto', 'accesorio'] },
    { key: 'Otros Productos', label: 'Otros Productos', emoji: '📦', aliases: ['otros productos', 'lubricantes', 'combos'] }
  ];
  const countByCategory = categoryGroups.map(g => {
    const total = products.filter(p => {
      if (p.activo === 0) return false;
      const n = normalizeCat(p.categoria);
      return g.aliases.some(a => n === a || n.startsWith(a + ' '));
    }).length;
    return { ...g, total };
  });
  const categoriasVacias = countByCategory.filter(g => g.total === 0);

  return (
    <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-5 shadow-xl animate-fade-in-up delay-150">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers size={16} className="text-orange-400" />
          Inventario por Línea Comercial
        </h3>
        {categoriasVacias.length > 0 && (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1.5">
            <AlertTriangle size={12} />
            {categoriasVacias.length} categoría{categoriasVacias.length > 1 ? 's' : ''} sin productos
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {countByCategory.map(g => (
          <button
            key={g.key}
            type="button"
            onClick={() => onNavigate && onNavigate('products')}
            className={`text-left p-3.5 rounded-2xl border transition active:scale-95 ${
              g.total === 0
                ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                : 'bg-[#070b14] border-slate-800/80 hover:border-orange-500/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{g.emoji}</span>
              <span className="text-[11px] font-semibold text-slate-300 truncate">{g.label}</span>
            </div>
            <div className={`text-2xl font-black mt-1 ${g.total === 0 ? 'text-amber-400' : 'text-white'}`}>
              {g.total}
            </div>
            <span className="text-[10px] text-slate-500">
              {g.total === 0 ? 'Falta cargar productos' : 'productos activos'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
