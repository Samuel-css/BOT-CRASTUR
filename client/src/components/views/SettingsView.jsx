import { useState, useEffect } from 'react';
import { Settings, MapPin, ShoppingBag, MessageSquare, Check, Clock, Bell, Moon, Building2, Eye, Truck, Plus, Trash2, RotateCcw } from 'lucide-react';
import { DEFAULT_DELIVERY_ZONES } from '../../constants/deliveryZones';

export default function SettingsView({ settings, onSaveSettings, onRequestConfirm }) {
  const [form, setForm] = useState(settings || {});
  const [deliveryZones, setDeliveryZones] = useState(() => {
    if (settings?.delivery_zonas_json) {
      try {
        const parsed = typeof settings.delivery_zonas_json === 'string'
          ? JSON.parse(settings.delivery_zonas_json)
          : settings.delivery_zonas_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(z => ({
            ...z,
            palabras: Array.isArray(z.palabras) ? z.palabras.join(', ') : (z.palabras || '')
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_DELIVERY_ZONES;
  });

  useEffect(() => {
    setForm(settings || {});
    if (settings?.delivery_zonas_json) {
      try {
        const parsed = typeof settings.delivery_zonas_json === 'string'
          ? JSON.parse(settings.delivery_zonas_json)
          : settings.delivery_zonas_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDeliveryZones(parsed.map(z => ({
            ...z,
            palabras: Array.isArray(z.palabras) ? z.palabras.join(', ') : (z.palabras || '')
          })));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [settings]);

  const handleZoneChange = (index, key, value) => {
    const updated = [...deliveryZones];
    updated[index] = { ...updated[index], [key]: value };
    setDeliveryZones(updated);
  };

  const handleAddZone = () => {
    setDeliveryZones([
      ...deliveryZones,
      { zona: '', tarifa: '$3 USD', palabras: '' }
    ]);
  };

  const handleDeleteZone = (index) => {
    const zoneName = deliveryZones[index]?.zona || 'esta zona';
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Eliminar zona de delivery?',
        message: `¿Estás seguro de eliminar "${zoneName}"? El bot ya no podrá cotizar envíos automáticamente para este sector.`,
        confirmText: 'Eliminar Zona',
        isDanger: true,
        onConfirm: () => {
          setDeliveryZones(prev => prev.filter((_, i) => i !== index));
        }
      });
    } else {
      setDeliveryZones(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleResetZones = () => {
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Restablecer zonas de delivery?',
        message: 'Esto cargará las zonas y tarifas predeterminadas de Caracas, reemplazando la lista actual.',
        confirmText: 'Restablecer Valores',
        isDanger: true,
        onConfirm: () => {
          setDeliveryZones(DEFAULT_DELIVERY_ZONES);
        }
      });
    } else {
      setDeliveryZones(DEFAULT_DELIVERY_ZONES);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const normalizedZones = deliveryZones.map(z => ({
      zona: (z.zona || '').trim(),
      tarifa: (z.tarifa || '').trim(),
      palabras: typeof z.palabras === 'string'
        ? z.palabras.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : (Array.isArray(z.palabras) ? z.palabras : [])
    })).filter(z => z.zona);

    onSaveSettings({
      ...form,
      delivery_zonas_json: JSON.stringify(normalizedZones)
    });
  };

  const field = (key) => ({
    value: form[key] !== undefined ? form[key] : '',
    onChange: (e) => setForm({ ...form, [key]: e.target.value })
  });

  const toggle = (key) => ({
    checked: form[key] === '1',
    onChange: (e) => setForm({ ...form, [key]: e.target.checked ? '1' : '0' })
  });

  const inputCls = "w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 transition mt-1";
  const textareaCls = "w-full bg-[#070b14] border border-slate-800 rounded-2xl p-3.5 text-xs text-white focus:border-orange-500 focus:outline-none transition mt-1";
  const labelCls = "text-xs text-slate-400 block font-medium";
  const sectionCls = "p-5 bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-3.5";

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Encabezado con botón de guardar superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings size={20} className="text-orange-400" />
              Configuración General del Bot y la Tienda
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Personaliza el comportamiento del bot en WhatsApp, políticas, tarifas de delivery y datos del negocio
            </p>
          </div>
          <button
            type="submit"
            className="self-start sm:self-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 flex items-center gap-2 active:scale-95"
          >
            <Check size={15} />
            Guardar Cambios
          </button>
        </div>

        {/* Grid de 2 Columnas Laterales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* === COLUMNA IZQUIERDA === */}
          <div className="space-y-6">
            {/* === INFORMACIÓN DEL NEGOCIO & BIENVENIDA === */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                <Building2 size={17} className="text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Información del Negocio</h3>
                  <p className="text-[11px] text-slate-400">Identidad comercial y saludo inicial del bot</p>
                </div>
              </div>

              <div className={sectionCls}>
                <div>
                  <label className={labelCls}>Nombre Comercial del Negocio:</label>
                  <input type="text" {...field('nombre_negocio')} className={inputCls} placeholder="Crastur - Repuestos, Motos y Caucheras" />
                </div>
              </div>

              {/* Mensaje de Bienvenida */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-orange-400" /> Mensaje de Bienvenida en WhatsApp:
                </label>
                <textarea rows={3} {...field('mensaje_bienvenida')}
                  placeholder="Mensaje con el que el bot saludará al cliente al escribir por primera vez..."
                  className={textareaCls}
                />
                {/* Preview */}
                {form.mensaje_bienvenida && (
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                    <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-bold mb-1">
                      <Eye size={11} /> Vista previa del mensaje:
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{form.mensaje_bienvenida}</p>
                  </div>
                )}
              </div>
            </div>

            {/* === HORARIO, DELIVERY Y PAGOS === */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                <Clock size={17} className="text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Horario, Delivery y Métodos de Pago</h3>
                  <p className="text-[11px] text-slate-400">Información que el bot comparte automáticamente con los clientes</p>
                </div>
              </div>
              <div className={sectionCls}>
                <div>
                  <label className={labelCls}>Horario de Atención en Tienda Física:</label>
                  <input type="text" {...field('horario_atencion')} className={inputCls} placeholder="Lunes a Sábado de 8:00 AM a 8:00 PM" />
                </div>
                <div>
                  <label className={labelCls}>Política General de Envíos y Delivery:</label>
                  <input type="text" {...field('politica_envios')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Métodos de Pago Oficiales:</label>
                  <input type="text" {...field('metodos_pago')} className={inputCls} />
                </div>
              </div>
            </div>

            {/* === CASHEA === */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                <ShoppingBag size={17} className="text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Parámetros de Financiamiento Cashea</h3>
                  <p className="text-[11px] text-slate-400">Condiciones de cuotas para compras financiadas (Mínimo $25 USD)</p>
                </div>
              </div>
              <div className="p-3.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-[11px] text-orange-300 leading-relaxed">
                📌 <strong>Importante:</strong> El financiamiento con Cashea se realiza presencialmente en la tienda física escaneando el código QR en caja. Compras menores a $25 USD no aplican individualmente pero pueden combinarse en combo.
              </div>
              <div className={sectionCls}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Porcentaje de Inicial Nivel 1 (%):</label>
                    <input type="number" {...field('cashea_inicial_pct')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Número de Cuotas Quincenales:</label>
                    <input type="number" {...field('cashea_cuotas')} className={inputCls} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === COLUMNA DERECHA === */}
          <div className="space-y-6">
            {/* === UBICACIÓN Y GOOGLE MAPS === */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                <MapPin size={17} className="text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Ubicación Física</h3>
                  <p className="text-[11px] text-slate-400">Punto de referencia y enlace de navegación para clientes</p>
                </div>
              </div>

              <div className={sectionCls}>
                <div>
                  <label className={labelCls}>Dirección Exacta de la Tienda:</label>
                  <input type="text" {...field('direccion_tienda')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Enlace directo de Google Maps:</label>
                  <input type="text" {...field('google_maps_url')} className={inputCls} />
                </div>
              </div>
            </div>

            {/* === TARIFAS Y ZONAS DE DELIVERY (MOTORIZADO CARACAS) === */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck size={17} className="text-orange-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Tarifas y Zonas de Delivery Caracas</h3>
                    <p className="text-[11px] text-slate-400">Zonas de cobertura y tarifas que el bot cotiza automáticamente</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetZones}
                  className="px-2.5 py-1 text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg flex items-center gap-1 transition border border-slate-800"
                  title="Restablecer a zonas predeterminadas"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {deliveryZones.map((z, idx) => (
                  <div key={idx} className="p-3.5 bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={z.zona}
                        onChange={(e) => handleZoneChange(idx, 'zona', e.target.value)}
                        placeholder="Nombre de la zona (ej: Chacao / Altamira)"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-orange-500"
                      />
                      <input
                        type="text"
                        value={z.tarifa}
                        onChange={(e) => handleZoneChange(idx, 'tarifa', e.target.value)}
                        placeholder="Tarifa (ej: $3 a $4 USD)"
                        className="w-28 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-orange-400 font-mono text-center focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteZone(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                        title="Eliminar zona"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={z.palabras}
                        onChange={(e) => handleZoneChange(idx, 'palabras', e.target.value)}
                        placeholder="Palabras clave separadas por comas (ej: chacao, altamira, lpg)"
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddZone}
                className="w-full py-2.5 border border-dashed border-slate-700 hover:border-orange-500/60 rounded-xl text-xs text-slate-400 hover:text-orange-400 font-medium flex items-center justify-center gap-1.5 transition bg-slate-900/40 active:scale-98"
              >
                <Plus size={14} /> Agregar Nueva Zona de Delivery
              </button>
            </div>

            {/* === SEGUIMIENTO / INSISTENCIA === */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                <Bell size={17} className="text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Seguimiento Automático a Clientes</h3>
                  <p className="text-[11px] text-slate-400">Recordatorio si el cliente no continúa la compra</p>
                </div>
              </div>

              <div className={sectionCls}>
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Seguimiento Automático Activo</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">El bot enviará un mensaje si el cliente no responde tras cotizar</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" {...toggle('insistencia_activa')} />
                    <div className="w-10 h-5 bg-slate-700 peer-focus:ring-0 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                <div>
                  <label className={labelCls}>Minutos de espera antes de insistir:</label>
                  <input type="number" min="5" max="120" {...field('insistencia_minutos')}
                    className={inputCls} placeholder="15"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Mínimo 5 minutos. Recomendado: 15-30 minutos.</p>
                </div>

                <div>
                  <label className={labelCls}>Mensaje de Seguimiento (Variables: <code className="text-orange-400">{'{nombre}'}</code> y <code className="text-orange-400">{'{producto}'}</code>):</label>
                  <textarea rows={3} {...field('mensaje_insistencia')} className={textareaCls}
                    placeholder="¡Hola, {nombre}! 👋 ¿Pudiste revisar la cotización de *{producto}*?..."
                  />
                </div>
              </div>
            </div>

            {/* === MODO FUERA DE HORARIO === */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                <Moon size={17} className="text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Modo Fuera de Horario</h3>
                  <p className="text-[11px] text-slate-400">Protección fuera de la jornada laboral</p>
                </div>
              </div>

              <div className={sectionCls}>
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Activar respuestas de "Tienda Cerrada"</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Apartados y ventas se bloquean fuera del horario; consultas se responden normalmente.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" {...toggle('fuera_horario_activo')} />
                    <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:bg-orange-500"></div>
                  </label>
                </div>

                <div>
                  <label className={labelCls}>Mensaje de Fuera de Horario:</label>
                  <textarea rows={3} {...field('mensaje_fuera_horario')} className={textareaCls} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior de guardar */}
        <div className="pt-3 pb-6 flex items-center justify-end border-t border-slate-800">
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 flex items-center gap-2 active:scale-95"
          >
            <Check size={16} />
            Guardar Toda la Configuración
          </button>
        </div>
      </form>
    </div>
  );
}
