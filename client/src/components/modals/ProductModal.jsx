import { useState, useEffect, useRef } from 'react';
import { X, Search, DollarSign, Package, Upload } from 'lucide-react';
import { AUTOMOTIVE_CATEGORIES } from '../../constants/categories';
import { formatBs, formatRate } from '../../utils/formatters';

export default function ProductModal({ isOpen, onClose, onSave, editingProduct, bcvRate }) {
  const [form, setForm] = useState({
    marca: '',
    modelo: '',
    categoria: 'Insumos Cauchera',
    precio_usd: '',
    descripcion: '',
    imagen_url: '',
    stock: 1
  });

  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editingProduct) {
      setForm({
        marca: editingProduct.marca || '',
        modelo: editingProduct.modelo || '',
        categoria: editingProduct.categoria || 'Insumos Cauchera',
        precio_usd: editingProduct.precio_usd || '',
        descripcion: editingProduct.descripcion || '',
        imagen_url: editingProduct.imagen_url || '',
        stock: editingProduct.stock !== undefined ? editingProduct.stock : 1
      });
    } else {
      setForm({
        marca: '',
        modelo: '',
        categoria: 'Insumos Cauchera',
        precio_usd: '',
        descripcion: '',
        imagen_url: '',
        stock: 1
      });
    }
    setCategorySearch('');
    setIsCategoryOpen(false);
    setFormError('');
  }, [editingProduct, isOpen]);

  if (!isOpen) return null;

  const filteredCategories = AUTOMOTIVE_CATEGORIES.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const precioUsdNum = parseFloat(form.precio_usd) || 0;
  const precioBs = precioUsdNum * bcvRate;
  const casheaNivel1 = precioUsdNum * 0.40;

  const handleSubmit = (e) => {
    e.preventDefault();
    const precio = parseFloat(form.precio_usd);
    if (!form.marca.trim() || !form.modelo.trim() || !form.precio_usd || isNaN(precio) || precio <= 0) {
      setFormError('Completa la marca, modelo y un precio en USD mayor a $0.00 para continuar.');
      return;
    }
    if (form.stock !== undefined && (isNaN(parseInt(form.stock, 10)) || parseInt(form.stock, 10) < 0)) {
      setFormError('El stock debe ser un número entero mayor o igual a 0.');
      return;
    }
    setFormError('');
    onSave(form);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setFormError('La imagen es demasiado pesada (máximo 2 MB). Por favor selecciona una imagen más liviana para optimizar WhatsApp.');
        return;
      }
      setFormError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, imagen_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl shadow-black/80 my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#070b14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
              </h3>
              <p className="text-xs text-slate-400">Ingresa los datos para cotizaciones en catálogo y WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <span>⚠️</span> {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Marca / Fabricante: *</label>
              <input
                type="text"
                required
                placeholder="Ej: Tip Top, Bera, Choho, Motul, NGK, SQ"
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
                className="w-full mt-1.5 bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Modelo / Nombre de Pieza: *</label>
              <input
                type="text"
                required
                placeholder="Ej: Parches No. 2, Kit Arrastre SBR, Aceite 20W50"
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                className="w-full mt-1.5 bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Categoría */}
          <div className="relative">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Categoría de Producto:</span>
              <span className="text-[11px] text-orange-400 font-normal">Predefinida con buscador</span>
            </label>

            {/* Selector trigger */}
            <div
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="w-full mt-1.5 bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white flex items-center justify-between cursor-pointer hover:border-slate-700 transition"
            >
              <span className="truncate">{form.categoria || 'Selecciona una categoría'}</span>
              <Search size={14} className="text-slate-400 ml-2 shrink-0" />
            </div>

            {/* Dropdown Menu */}
            {isCategoryOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0a0f1d] border border-slate-700 rounded-2xl shadow-2xl p-2.5 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Escribe para buscar categoría..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredCategories.map((cat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, categoria: cat });
                        setIsCategoryOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition ${
                        form.categoria === cat
                          ? 'bg-orange-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}

                  {categorySearch.trim() && !filteredCategories.includes(categorySearch.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, categoria: categorySearch.trim() });
                        setIsCategoryOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs bg-orange-950/40 border border-orange-800/40 text-orange-300 hover:bg-orange-900/40 transition"
                    >
                      ➕ Usar "{categorySearch.trim()}" como categoría personalizada
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Precio en Dólares ($ USD): *</label>
              <div className="relative mt-1.5">
                <DollarSign size={14} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={form.precio_usd}
                  onChange={(e) => setForm({ ...form, precio_usd: e.target.value })}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none font-mono transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Stock en Tienda:</label>
              <div className="relative mt-1.5">
                <Package size={14} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white focus:border-orange-500 focus:outline-none font-mono transition"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta de Conversión Live a Bolívares y Cashea */}
          {precioUsdNum > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#070b14] border border-slate-800 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400">Total en Bolívares:</span>
                <p className="font-bold text-white font-mono text-sm mt-0.5">
                  Bs. {formatBs(precioBs)}
                </p>
                <span className="text-[10px] text-slate-400 font-mono">Tasa BCV: {formatRate(bcvRate)}</span>
              </div>
              <div>
                <span className="text-[11px] text-orange-400 font-semibold">Cashea (Mín. $25 en tienda):</span>
                {precioUsdNum >= 25 ? (
                  <>
                    <p className="font-bold text-orange-300 font-mono text-sm mt-0.5">
                      Inicial: ${casheaNivel1.toFixed(2)} USD
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">Bs. {formatBs(casheaNivel1 * bcvRate)} (En tienda física)</span>
                  </>
                ) : (
                  <p className="text-[10px] text-orange-400/80 mt-1">
                    No aplica individual (&lt;$25). Puede combinarse en combo en tienda.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300">Descripción / Detalles Técnicos:</label>
            <textarea
              rows={2}
              placeholder="Ej: Incluye láminas silenciadoras y sensor de desgaste. Compatible con motor 1.8L."
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full mt-1.5 bg-[#070b14] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Imagen del Repuesto (Opcional):</label>
            <div className="flex items-center gap-3 mt-1.5">
              <input
                type="text"
                placeholder="URL de la imagen o carga un archivo"
                value={form.imagen_url}
                onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
                className="flex-1 bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition shrink-0 active:scale-95"
              >
                <Upload size={14} /> Subir
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
            {form.imagen_url && (
              <div className="mt-2.5 flex items-center justify-between p-2.5 bg-[#070b14] rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <img src={form.imagen_url} alt="Vista previa" className="w-12 h-12 object-cover rounded-lg" />
                  <span className="text-[11px] text-emerald-400 font-medium">Imagen lista para WhatsApp</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, imagen_url: '' }))}
                  className="px-2.5 py-1 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition"
                >
                  Quitar imagen
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 active:scale-95"
            >
              {editingProduct ? 'Guardar Cambios' : 'Registrar Repuesto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
