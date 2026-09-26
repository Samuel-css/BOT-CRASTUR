import { useState, useEffect, useRef } from 'react';
import {
  Settings,
  MapPin,
  ShoppingBag,
  MessageSquare,
  Check,
  Clock,
  Bell,
  Moon,
  Building2,
  Eye,
  Truck,
  Plus,
  Trash2,
  RotateCcw,
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  HelpCircle,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_DELIVERY_ZONES } from '../../constants/deliveryZones';

const TABS = [
  { id: 'tienda', label: 'Mi Tienda', icon: Building2, desc: 'Nombre, dirección y horario' },
  { id: 'mensajes', label: 'Mensajes del Bot', icon: MessageSquare, desc: 'Bienvenida y respuestas' },
  { id: 'delivery', label: 'Delivery Caracas', icon: Truck, desc: 'Zonas y tarifas de envío' },
  { id: 'pagos', label: 'Pagos y Cashea', icon: ShoppingBag, desc: 'Métodos y financiamiento' },
  { id: 'seguridad', label: 'Copia de Seguridad', icon: Database, desc: 'Respaldos y protección' }
];

export default function SettingsView({ settings, onSaveSettings, onRequestConfirm }) {
  const [activeTab, setActiveTab] = useState('tienda');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [restoring, setRestoring] = useState(false);
  const [form, setForm] = useState(settings || {});
  const [deliveryZones, setDeliveryZones] = useState(() => {
    if (settings?.delivery_zonas_json) {
      try {
        const parsed = typeof settings.delivery_zonas_json === 'string'
          ? JSON.parse(settings.delivery_zonas_json)
          : settings.delivery_zonas_json;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((z) => ({
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
          setDeliveryZones(parsed.map((z) => ({
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
      { zona: '', tarifa: '$3 a $4 USD', palabras: '' }
    ]);
  };

  const handleDeleteZone = (index) => {
    const zoneName = deliveryZones[index]?.zona || 'esta zona';
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Eliminar zona de delivery?',
        message: `¿Estás seguro de eliminar "${zoneName}"? El bot ya no cotizará envíos automáticamente para este sector.`,
        confirmText: 'Sí, Eliminar Zona',
        isDanger: true,
        onConfirm: () => {
          setDeliveryZones((prev) => prev.filter((_, i) => i !== index));
          toast.info('Zona de delivery eliminada.');
        }
      });
    } else {
      setDeliveryZones((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleResetZones = () => {
    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Restablecer zonas de Caracas?',
        message: 'Esto cargará las zonas y tarifas predeterminadas de Caracas (San Agustín, Centro, Chacao, Baruta, etc.), reemplazando la lista actual.',
        confirmText: 'Restablecer Valores',
        isDanger: true,
        onConfirm: () => {
          setDeliveryZones(DEFAULT_DELIVERY_ZONES);
          toast.success('Zonas de Caracas restablecidas a valores recomendados.');
        }
      });
    } else {
      setDeliveryZones(DEFAULT_DELIVERY_ZONES);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setSaving(true);

    const normalizedZones = deliveryZones
      .map((z) => ({
        zona: (z.zona || '').trim(),
        tarifa: (z.tarifa || '').trim(),
        palabras:
          typeof z.palabras === 'string'
            ? z.palabras.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
            : Array.isArray(z.palabras)
            ? z.palabras
            : []
      }))
      .filter((z) => z.zona);

    onSaveSettings({
      ...form,
      delivery_zonas_json: JSON.stringify(normalizedZones)
    });

    setTimeout(() => {
      setSaving(false);
      toast.success('¡Configuración guardada exitosamente!');
    }, 400);
  };

  const handleDownloadBackup = () => {
    toast.info('Descargando archivo de respaldo de tu base de datos...');
    window.location.href = '/api/database/backup';
  };

  const handleSelectRestoreFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.db')) {
      toast.error('Formato no válido: Selecciona un archivo de respaldo con terminación .db');
      e.target.value = '';
      return;
    }

    const doRestore = async () => {
      setRestoring(true);
      const toastId = toast.loading('Restaurando base de datos y comprobando seguridad...');
      try {
        const arrayBuffer = await file.arrayBuffer();
        const res = await fetch('/api/database/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: arrayBuffer
        });
        const data = await res.json();
        if (data.success) {
          toast.success('¡Copia restaurada con éxito! Recargando sistema...', { id: toastId });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          toast.error(data.error || 'No se pudo restaurar el archivo', { id: toastId });
        }
      } catch (err) {
        toast.error('Error de conexión al cargar la copia', { id: toastId });
      } finally {
        setRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (onRequestConfirm) {
      onRequestConfirm({
        title: '¿Restaurar Copia de Seguridad?',
        message: `Estás a punto de restaurar la base de datos desde "${file.name}". Se generará un respaldo de seguridad preventivo automático antes de aplicar los datos. El catálogo y las opciones se actualizarán con este archivo.`,
        confirmText: 'Sí, Restaurar Copia',
        isDanger: true,
        onConfirm: doRestore
      });
    } else {
      if (window.confirm(`¿Confirmas restaurar la base de datos desde "${file.name}"?`)) {
        doRestore();
      }
    }
  };

  const field = (key) => ({
    value: form[key] !== undefined ? form[key] : '',
    onChange: (e) => setForm({ ...form, [key]: e.target.value })
  });

  const toggle = (key) => ({
    checked: form[key] === '1',
    onChange: (e) => setForm({ ...form, [key]: e.target.checked ? '1' : '0' })
  });

  // Clases compartidas para estética limpia
  const inputCls =
    'w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 transition mt-1.5 placeholder-slate-600';
  const textareaCls =
    'w-full bg-[#070b14] border border-slate-800 rounded-2xl p-4 text-xs text-white focus:border-orange-500 focus:outline-none transition mt-1.5 placeholder-slate-600 leading-relaxed';
  const labelCls = 'text-xs text-slate-300 font-semibold block';
  const helpCls = 'text-[11px] text-slate-500 mt-1';
  const cardCls =
    'bg-[#0a0f1d] border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5';

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-12">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ENCABEZADO PRINCIPAL */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Settings size={22} className="text-orange-400" />
              Configuración de la Tienda y el Bot
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Organiza la información de tu negocio, mensajes automáticos, delivery y seguridad en sencillos pasos
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="self-start sm:self-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Save size={15} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={15} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>

        {/* SELECTOR DE PESTAÑAS (TABS) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-[#070b14] border border-slate-800 rounded-2xl">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border border-orange-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-orange-400' : 'text-slate-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENIDO DE PESTAÑAS ANIMADO */}
        <div key={activeTab} className="animate-fade-in-up space-y-6">
          {/* ============================================================== */}
          {/* PESTAÑA 1: MI TIENDA */}
          {/* ============================================================== */}
          {activeTab === 'tienda' && (
            <div className="space-y-6">
            <div className={cardCls}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Identidad y Ubicación del Negocio</h3>
                  <p className="text-[11px] text-slate-400">Datos principales que el bot comparte con los clientes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Nombre Comercial del Negocio:</label>
                  <input
                    type="text"
                    {...field('nombre_negocio')}
                    placeholder="Ej: Crastur - Insumos de Cauchera y Repuestos de Moto"
                    className={inputCls}
                  />
                  <p className={helpCls}>Aparece en los saludos y textos del bot.</p>
                </div>

                <div>
                  <label className={labelCls}>Horario de Atención en Tienda Física:</label>
                  <input
                    type="text"
                    {...field('horario_atencion')}
                    placeholder="Ej: Lunes a Sábado de 8:00 AM a 8:00 PM"
                    className={inputCls}
                  />
                  <p className={helpCls}>El bot lo informa cuando preguntan si la tienda está abierta.</p>
                </div>

                <div className="md:col-span-2">
                  <label className={labelCls}>Dirección Exacta de la Tienda:</label>
                  <input
                    type="text"
                    {...field('direccion_tienda')}
                    placeholder="Ej: San Agustín Norte, Av. Lecuna, local Crastur, Caracas"
                    className={inputCls}
                  />
                  <p className={helpCls}>Indicación clara para que los clientes lleguen al mostrador.</p>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Enlace de Google Maps:</label>
                    {form.google_maps_url && (
                      <a
                        href={form.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <ExternalLink size={12} /> Probar Ubicación en Maps
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    {...field('google_maps_url')}
                    placeholder="https://maps.app.goo.gl/..."
                    className={inputCls}
                  />
                  <p className={helpCls}>Enlace que el bot envía cuando le piden la ubicación por WhatsApp.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: MENSAJES DEL BOT */}
        {/* ============================================================== */}
        {activeTab === 'mensajes' && (
          <div className="space-y-6">
            {/* Mensaje de Bienvenida */}
            <div className={cardCls}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Mensaje de Saludo y Bienvenida</h3>
                  <p className="text-[11px] text-slate-400">Es el primer mensaje que envía el bot cuando un cliente escribe por WhatsApp</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                <div>
                  <label className={labelCls}>Texto del Mensaje de Bienvenida:</label>
                  <textarea
                    rows={6}
                    {...field('mensaje_bienvenida')}
                    placeholder="Escribe el saludo cordial que recibirá el cliente..."
                    className={textareaCls}
                  />
                  <p className={helpCls}>Sé amable, breve y menciona que disponen de tienda física y delivery.</p>
                </div>

                {/* Vista previa estilo WhatsApp */}
                <div className="bg-[#070b14] border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                    <Eye size={14} /> Vista previa en WhatsApp
                  </div>
                  <div className="bg-[#12231b] border border-emerald-900/40 rounded-2xl p-4 text-xs text-emerald-100 whitespace-pre-wrap leading-relaxed shadow-inner">
                    {form.mensaje_bienvenida || 'Escribe tu mensaje para ver cómo se mostrará en WhatsApp.'}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">Así lo leerá el cliente en su teléfono celular</p>
                </div>
              </div>
            </div>

            {/* Modo Fuera de Horario */}
            <div className={cardCls}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                    <Moon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Atención Fuera de Horario (Noche y Domingos)</h3>
                    <p className="text-[11px] text-slate-400">Informa a los clientes cuando la tienda física esté cerrada</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" {...toggle('fuera_horario_activo')} />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:bg-orange-500"></div>
                </label>
              </div>

              <div>
                <label className={labelCls}>Mensaje cuando la tienda está cerrada:</label>
                <textarea
                  rows={3}
                  {...field('mensaje_fuera_horario')}
                  placeholder="Ej: ¡Hola! En este momento nuestra tienda física se encuentra cerrada. Nuestro horario es de Lun-Sáb de 8am a 8pm. Puedes consultar nuestros precios y mañana a primera hora te atendemos con gusto."
                  className={textareaCls}
                />
                <p className={helpCls}>El bot responderá dudas de precios pero no emitirá apartados hasta que la tienda abra.</p>
              </div>
            </div>

            {/* Seguimiento Automático (Insistencia) */}
            <div className={cardCls}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Seguimiento Amable a Clientes Indecisos</h3>
                    <p className="text-[11px] text-slate-400">Envía un recordatorio sutil si el cliente consultó un precio y no volvió a responder</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" {...toggle('insistencia_activa')} />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:bg-orange-500"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Minutos de espera:</label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    {...field('insistencia_minutos')}
                    placeholder="15"
                    className={inputCls}
                  />
                  <p className={helpCls}>Recomendado: 15 a 30 minutos.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelCls}>Mensaje de recordatorio:</label>
                  <textarea
                    rows={3}
                    {...field('mensaje_insistencia')}
                    placeholder="¡Hola, {nombre}! 👋 ¿Pudiste revisar la cotización de *{producto}*? Si deseas apartarlo o solicitar delivery indícanos para ayudarte."
                    className={textareaCls}
                  />
                  <p className={helpCls}>
                    Puedes usar <code className="text-orange-400 font-mono">{'{nombre}'}</code> y{' '}
                    <code className="text-orange-400 font-mono">{'{producto}'}</code> para personalizar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 3: DELIVERY CARACAS */}
        {/* ============================================================== */}
        {activeTab === 'delivery' && (
          <div className="space-y-6">
            <div className={cardCls}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Tarifas y Zonas de Motorizado en Caracas</h3>
                    <p className="text-[11px] text-slate-400">El bot cotiza la tarifa del delivery según el sector donde se encuentre el cliente</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetZones}
                  className="self-start sm:self-auto px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl flex items-center gap-1.5 transition border border-slate-800 cursor-pointer"
                  title="Restablecer a zonas predeterminadas"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer Caracas</span>
                </button>
              </div>

              <div>
                <label className={labelCls}>Política General de Delivery:</label>
                <input
                  type="text"
                  {...field('politica_envios')}
                  placeholder="Ej: Despachamos hoy mismo en Caracas con motorizado de confianza"
                  className={inputCls}
                />
              </div>

              {/* LISTA DE ZONAS */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-300">Zonas Registradas ({deliveryZones.length})</h4>
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {deliveryZones.map((z, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#070b14] rounded-2xl border border-slate-800/80 space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={z.zona}
                            onChange={(e) => handleZoneChange(idx, 'zona', e.target.value)}
                            placeholder="Nombre de la zona (ej: Chacao / Altamira / El Rosal)"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="text"
                            value={z.tarifa}
                            onChange={(e) => handleZoneChange(idx, 'tarifa', e.target.value)}
                            placeholder="Tarifa (ej: $3 a $4 USD)"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-orange-400 font-mono text-center font-bold focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteZone(idx)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                          title="Eliminar zona"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={z.palabras}
                          onChange={(e) => handleZoneChange(idx, 'palabras', e.target.value)}
                          placeholder="Palabras clave para el bot (ej: chacao, altamira, el rosal, lpg)"
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddZone}
                  className="w-full py-3 border border-dashed border-slate-700 hover:border-orange-500/60 rounded-2xl text-xs text-slate-300 hover:text-orange-400 font-bold flex items-center justify-center gap-2 transition bg-slate-900/30 cursor-pointer active:scale-98"
                >
                  <Plus size={16} />
                  <span>Agregar Otra Zona de Caracas</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 4: PAGOS Y CASHEA */}
        {/* ============================================================== */}
        {activeTab === 'pagos' && (
          <div className="space-y-6">
            <div className={cardCls}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Métodos de Pago Aceptados</h3>
                  <p className="text-[11px] text-slate-400">Formas de pago que el bot informa al cliente al momento de cotizar</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>Métodos de Pago Oficiales en Tienda:</label>
                <input
                  type="text"
                  {...field('metodos_pago')}
                  placeholder="Ej: Divisas en Efectivo $, Pago Móvil BCV, Binance USDT, Punto de Venta en Tienda Física"
                  className={inputCls}
                />
                <p className={helpCls}>Se mencionan en el mensaje de pago y cierre de ventas.</p>
              </div>
            </div>

            {/* CASHEA */}
            <div className={cardCls}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Condiciones de Financiamiento con Cashea</h3>
                  <p className="text-[11px] text-slate-400">Parámetros oficiales que el bot calcula y explica</p>
                </div>
              </div>

              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-xs text-orange-300 leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  📌 <span>¿Cómo funciona Cashea en Crastur?</span>
                </p>
                <p>
                  El financiamiento se hace <strong>presencialmente en la tienda física de San Agustín</strong> escaneando el código QR en caja. Compras o combos a partir de <strong>$25 USD</strong> aplican para llevarse el repuesto pagando solo la inicial hoy.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className={labelCls}>Porcentaje de Inicial Nivel 1 (%):</label>
                  <input
                    type="number"
                    min="10"
                    max="90"
                    {...field('cashea_inicial_pct')}
                    placeholder="40"
                    className={inputCls}
                  />
                  <p className={helpCls}>Porcentaje estándar de inicial (habitualmente 40%).</p>
                </div>

                <div>
                  <label className={labelCls}>Número de Cuotas Quincenales:</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    {...field('cashea_cuotas')}
                    placeholder="3"
                    className={inputCls}
                  />
                  <p className={helpCls}>Habitualmente son 3 cuotas cada 14 días sin interés.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 5: COPIA DE SEGURIDAD */}
        {/* ============================================================== */}
        {activeTab === 'seguridad' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-[#0a0f1d] via-[#11192e] to-[#0a0f1d] border border-orange-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Copia de Seguridad y Protección de Datos</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                        Blindaje Activo
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Guarda un archivo completo con todos tus productos, precios en dólares, combos, clientes y mensajes en tu computadora.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".db"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-slate-950 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 active:scale-95"
                  >
                    <Download size={15} />
                    <span>Descargar Copia de Seguridad</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectRestoreFile}
                    disabled={restoring}
                    className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Upload size={15} />
                    <span>{restoring ? 'Restaurando...' : 'Restaurar desde Copia'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
                <div className="flex items-start gap-3 bg-[#070b14]/70 p-4 rounded-2xl border border-slate-800/80">
                  <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-medium mb-0.5">Respaldos Automáticos Diarios:</strong>
                    El sistema crea una copia de seguridad cada vez que se enciende en la computadora, garantizando que nunca se pierda tu trabajo ante cortes de luz o imprevistos.
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#070b14]/70 p-4 rounded-2xl border border-slate-800/80">
                  <AlertCircle size={18} className="text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-medium mb-0.5">Restauración Segura:</strong>
                    Si alguna vez necesitas restaurar una copia, el sistema crea un respaldo de emergencia previo automáticamente antes de aplicar los datos nuevos.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* BARRA INFERIOR DE GUARDADO */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-800/80">
          <span className="text-xs text-slate-500">
            Pestaña activa: <strong className="text-slate-300">{TABS.find((t) => t.id === activeTab)?.label}</strong>
          </span>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/20 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Save size={15} className="animate-spin" />
                Guardando Cambios...
              </>
            ) : (
              <>
                <Check size={15} />
                Guardar Toda la Configuración
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
