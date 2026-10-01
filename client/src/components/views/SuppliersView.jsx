import { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  MessageCircle,
  Edit2,
  Trash2,
  Calendar,
  CreditCard,
  Building2,
  Tag,
  Download,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';

export default function SuppliersView({
  suppliers = [],
  onOpenAddModal,
  onEditSupplier,
  onDeleteSupplier
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      const matchSearch =
        (sup.empresa || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sup.contacto_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sup.telefono || '').includes(searchTerm) ||
        (sup.notas || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' ||
        (sup.categorias || '').toLowerCase().includes(selectedCategory.toLowerCase());

      return matchSearch && matchCategory;
    });
  }, [suppliers, searchTerm, selectedCategory]);

  const handleExportSuppliers = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(suppliers, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `proveedores_crastur_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Respaldo de proveedores descargado exitosamente');
    } catch {
      toast.error('Error al exportar proveedores');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      {/* Encabezado Superior con Acciones Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a0f1d] p-5 sm:p-6 rounded-3xl border border-slate-800/80 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
            <Truck size={22} className="text-orange-400" />
            Proveedores y Mayoristas
          </h3>
          <p className="text-xs text-slate-400">
            Directorio de distribuidores de insumos de cauchera, repuestos de moto y lubricantes para reposición rápida de inventario.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportSuppliers}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition active:scale-95"
            title="Exportar respaldo de proveedores en formato JSON"
          >
            <Download size={14} className="text-orange-400" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs transition shadow-lg shadow-orange-500/20 active:scale-95"
          >
            <Plus size={15} />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#0a0f1d] p-3 rounded-2xl border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por empresa, contacto, teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#070b14] border border-slate-800/90 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'Cauchera', 'Moto', 'Lubricantes'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {cat === 'ALL' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Proveedores */}
      {filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center bg-[#0a0f1d] border border-slate-800/80 rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#070b14] border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Building2 size={28} />
          </div>
          <h4 className="font-bold text-base text-white">No se encontraron proveedores</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Registra los mayoristas que te surten parches, tripas, pastillas de freno, kits de arrastre o aceites para tener sus números y condiciones de crédito a la mano.
          </p>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 mt-2"
          >
            <Plus size={15} />
            <span>Registrar Primer Proveedor</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map((sup) => {
            const cleanPhone = (sup.telefono || '').replace(/\D/g, '');
            const waLink = cleanPhone.startsWith('58')
              ? `https://wa.me/${cleanPhone}`
              : `https://wa.me/58${cleanPhone.replace(/^0+/, '')}`;

            return (
              <div
                key={sup.id}
                className="p-5 bg-[#0a0f1d] border border-slate-800/80 rounded-3xl shadow-xl card-hover flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center font-bold text-base shrink-0">
                        {sup.empresa.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white line-clamp-1">{sup.empresa}</h4>
                        {sup.contacto_nombre && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>Contacto:</span> <strong className="text-slate-300">{sup.contacto_nombre}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditSupplier(sup)}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
                        title="Editar proveedor"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteSupplier(sup.id)}
                        className="p-2 hover:bg-rose-950/40 rounded-xl text-rose-400 hover:text-rose-300 transition"
                        title="Eliminar proveedor"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-[#070b14] border border-slate-800/80 rounded-xl p-2.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                        <Tag size={10} className="text-orange-400" /> Categoría
                      </span>
                      <span className="font-semibold text-white block mt-0.5 truncate">
                        {sup.categorias || 'Repuestos Moto'}
                      </span>
                    </div>

                    <div className="bg-[#070b14] border border-slate-800/80 rounded-xl p-2.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                        <Calendar size={10} className="text-orange-400" /> Despacho
                      </span>
                      <span className="font-semibold text-white block mt-0.5 truncate">
                        {sup.dias_despacho || 'Semanal'}
                      </span>
                    </div>
                  </div>

                  {sup.condiciones_pago && (
                    <div className="text-xs text-slate-400 bg-slate-900/40 border border-slate-800/60 rounded-xl p-2.5 flex items-center gap-2">
                      <CreditCard size={13} className="text-emerald-400 shrink-0" />
                      <span className="truncate">{sup.condiciones_pago}</span>
                    </div>
                  )}

                  {sup.notas && (
                    <p className="text-xs text-slate-400 line-clamp-2 italic px-1">
                      "{sup.notas}"
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <a
                    href={`tel:${sup.telefono}`}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold hover:underline"
                  >
                    <Phone size={12} />
                    <span>{sup.telefono}</span>
                  </a>

                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold transition active:scale-95"
                  >
                    <MessageCircle size={13} />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
