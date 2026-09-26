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
  Truck,
  Plus,
  Trash2,
  RotateCcw,
  Database,
  Download,
  Upload,
  AlertCircle,
  ExternalLink,
  Save,
  Sparkles,
  Zap,
  CheckCircle2,
  RefreshCw,
  Sun,
  Coffee,
  Briefcase,
  Sliders,
  DollarSign,
  Coins,
  CreditCard,
  Flame,
  Smartphone,
  Store,
  Power
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_DELIVERY_ZONES } from '../../constants/deliveryZones';

const TABS = [
  { id: 'tienda', label: '1. Mi Tienda & Horario', icon: Building2, desc: 'Nombre, estado, tasa BCV y horario' },
  { id: 'mensajes', label: '2. Asistente Virtual', icon: MessageSquare, desc: 'Cómo habla el bot y respuestas' },
  { id: 'pagos', label: '3. Formas de Pago & Cashea', icon: ShoppingBag, desc: 'Métodos activos y cuotas' },
  { id: 'delivery', label: '4. Delivery Caracas', icon: Truck, desc: 'Zonas y tarifas de motorizado' },
  { id: 'seguridad', label: '5. Copia de Seguridad', icon: Database, desc: 'Respaldos y mantenimiento' }
];

// Presets de Tono para el Mensaje de Bienvenida del Bot
const WELCOME_TONE_PRESETS = [
  {
    id: 'motero',
    titulo: 'Pana Motero & Repuestero',
    badge: 'Recomendado 🔥',
    desc: 'Cercano, rápido, habla como un pana motero de confianza y destaca retiro ya.',
    Icon: Flame,
    iconColor: 'text-orange-400',
    color: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
    texto: '¡Hola! Te damos la bienvenida a *Crastur* 🛞🏍️\nTu tienda de insumos para caucheras, repuestos de moto y lubricantes en Caracas con Cashea 💛.\n\n📍 Tienda física en San Agustín Norte con horario corrido y delivery a toda Caracas.\n¿En qué repuesto te podemos ayudar hoy? Escribe el nombre de la pieza o modelo de moto y te cotizamos de inmediato.'
  },
  {
    id: 'profesional',
    titulo: 'Atención Formal & Tienda',
    badge: 'Formal 👔',
    desc: 'Educado, serio, enfocado en asesoría técnica y repuestos con garantía.',
    Icon: Building2,
    iconColor: 'text-sky-400',
    color: 'border-sky-500/50 bg-sky-500/10 text-sky-300',
    texto: '¡Saludos cordiales! Bienvenido a *Crastur Caracas* 🏢✨\nEspecialistas en repuestos para motos, insumos para cauchera y lubricantes con garantía de tienda.\n\nContamos con financiamiento Cashea 💛, retiro en mostrador y delivery directo. Indícanos el repuesto que requieres para asistirte.'
  },
  {
    id: 'rapido',
    titulo: 'Mostrador Express',
    badge: 'Express ⚡',
    desc: 'Directo al grano. Da precios en 1 segundo y ubicación para retirar.',
    Icon: Zap,
    iconColor: 'text-emerald-400',
    color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    texto: '¡Hola! Bienvenido a *Crastur* 🛞🏍️\nConsulta de precios y stock en segundos.\n\nEscribe el repuesto que buscas (ej: *pastillas*, *bujía*, *parches*, *aceite*) o escribe *MENU* para ver el catálogo completo.'
  },
  {
    id: 'cashea',
    titulo: 'Especial Cashea (En Cuotas)',
    badge: 'Cashea 💛',
    desc: 'Destaca que el cliente puede llevarse el repuesto hoy pagando en 3 cuotas.',
    Icon: ShoppingBag,
    iconColor: 'text-amber-400',
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    texto: '¡Hola! Bienvenido a *Crastur* 🛞🏍️💛\n¡Llévate hoy tus repuestos e insumos pagando solo el 40% inicial y el resto en 3 cuotas quincenales sin interés con Cashea!\n\n¿Qué repuesto necesitas para tu moto hoy? Te confirmamos precio y cuotas al instante.'
  }
];

// Presets para cuando la tienda está cerrada
const OUT_OF_HOURS_PRESETS = [
  {
    id: 'estandar',
    titulo: 'Cierre Nocturno',
    Icon: Moon,
    iconColor: 'text-indigo-400',
    desc: 'Avisa que la tienda está cerrada de noche y atiende al abrir',
    texto: '¡Hola! 👋 Gracias por escribirnos. En este momento nuestra tienda física está cerrada. Te atendemos de *Lunes a Sábado de 8:00 AM a 8:00 PM* y *Domingos de 8:30 AM a 2:00 PM*. Puedes dejarnos tu consulta y con gusto te respondemos al abrir. ¡Hasta pronto! 🛞🏍️✨'
  },
  {
    id: 'almuerzo',
    titulo: 'Pausa de Almuerzo',
    Icon: Coffee,
    iconColor: 'text-amber-400',
    desc: 'Pausa breve de almuerzo en el mostrador',
    texto: '¡Hola! 🥪 En este momento nuestro equipo está en pausa de almuerzo. Dejamos tu consulta anotada y en breve retomamos atención personalizada en mostrador.'
  },
  {
    id: 'domingo',
    titulo: 'Descanso Dominical',
    Icon: Sun,
    iconColor: 'text-yellow-400',
    desc: 'Para domingos no laborables o feriados',
    texto: '¡Hola! ☀️ Los domingos nuestra tienda física descansa. ¡El asistente virtual te puede dar precios de una vez! El lunes a las 8:00 AM abrimos para entregas y apartados en San Agustín.'
  }
];

// Presets para seguimiento automático
const FOLLOWUP_PRESETS = [
  {
    id: 'amable',
    titulo: 'Sutil & Amable',
    Icon: Sparkles,
    iconColor: 'text-emerald-400',
    texto: '¡Hola, {nombre}! 👋 ¿Pudiste revisar el precio de *{producto}*? Recuerda que tenemos tienda física en Caracas, garantía y Cashea 💛. Si necesitas hablar con un asesor, solo escribe *VENDEDOR*.'
  },
  {
    id: 'urgencia',
    titulo: 'Disponibilidad Limitada',
    Icon: Flame,
    iconColor: 'text-red-400',
    texto: '¡Hola, {nombre}! ⏱️ Nos quedan pocas unidades disponibles de *{producto}*. ¿Deseas que te lo apartemos sin costo por 24 horas para retirarlo en tienda física?'
  },
  {
    id: 'cashea',
    titulo: 'Financiamiento Cashea',
    Icon: ShoppingBag,
    iconColor: 'text-yellow-400',
    texto: '¡Hola, {nombre}! 💛 Recuerda que en *{producto}* puedes llevártelo hoy pagando solo la inicial en tienda física con tu app Cashea. ¿Te preparamos el pedido?'
  }
];

// Opciones de horario predefinidas para el Selector
const SCHEDULE_OPTIONS = [
  {
    id: 'crastur_completo',
    label: 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM (Horario Completo Crastur)',
    shortLabel: 'Semana 8am-8pm + Dom 8:30am-2pm',
    Icon: Clock,
    iconColor: 'text-orange-400',
    value: 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM'
  },
  {
    id: 'crastur_standard',
    label: '8:00 AM a 8:00 PM (Lunes a Sábado - Domingos Cerrado)',
    shortLabel: 'Lun a Sáb (8am - 8pm)',
    Icon: Store,
    iconColor: 'text-blue-400',
    value: 'Lunes a Sábado de 8:00 AM a 8:00 PM'
  },
  {
    id: 'comercial',
    label: '8:30 AM a 6:00 PM (Lunes a Sábado - Comercial Corrido)',
    shortLabel: 'Comercial (8:30am - 6pm)',
    Icon: Briefcase,
    iconColor: 'text-amber-400',
    value: 'Lunes a Sábado de 8:30 AM a 6:00 PM'
  },
  {
    id: 'medio_dia',
    label: '8:00 AM a 2:00 PM (Medio Día / Solo Sábados)',
    shortLabel: 'Medio Día (8am - 2pm)',
    Icon: Sun,
    iconColor: 'text-yellow-400',
    value: 'Lunes a Sábado de 8:00 AM a 2:00 PM'
  },
  {
    id: 'custom',
    label: '✏️ Horario Personalizado (Configurar semana y domingos a mi gusto)',
    shortLabel: 'Personalizado',
    Icon: Sliders,
    iconColor: 'text-emerald-400',
    value: 'custom'
  }
];

// Tarjetas interactivas de métodos de pago
const PAYMENT_OPTIONS = [
  { id: 'efectivo', label: 'Efectivo $', Icon: DollarSign, iconColor: 'text-emerald-400', desc: 'Dólares en efectivo en tienda física' },
  { id: 'binance', label: 'Binance Pay (USDT)', Icon: Coins, iconColor: 'text-amber-400', desc: 'Pago digital en criptoactivos' },
  { id: 'pagomovil', label: 'Pago Móvil BCV', Icon: Smartphone, iconColor: 'text-sky-400', desc: 'En bolívares a tasa oficial BCV' },
  { id: 'cashea', label: 'Cashea en Tienda', Icon: ShoppingBag, iconColor: 'text-yellow-400', desc: 'Pago en 3 cuotas quincenales' },
  { id: 'puntoventa', label: 'Punto de Venta', Icon: CreditCard, iconColor: 'text-purple-400', desc: 'Tarjeta de débito en mostrador' },
  { id: 'transferencia', label: 'Transferencia Bancaria', Icon: Building2, iconColor: 'text-blue-400', desc: 'Banesco o Mercantil' }
];

const QUICK_EMOJIS = ['🏍️', '🛞', '🔧', '💵', '🪙', '💛', '📍', '📦', '✅', '⚡', '🕒', '👋', '🤝'];

// Comparador robusto que ignora saltos de línea CRLF/LF o espacios accidentales
const cleanCompare = (a, b) => (a || '').replace(/\s+/g, ' ').trim() === (b || '').replace(/\s+/g, ' ').trim();

export default function SettingsView({ settings, onSaveSettings, onRequestConfirm }) {
  const [activeTab, setActiveTab] = useState('tienda');
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(settings || {});
  const [simulatorView, setSimulatorView] = useState('bienvenida');
  const [subTabMensajes, setSubTabMensajes] = useState('bienvenida');
  const [showAdvancedText, setShowAdvancedText] = useState(false);

  // Estado para el selector de horario
  const [scheduleMode, setScheduleMode] = useState(() => {
    const cur = (settings?.horario_atencion || '').trim();
    const match = SCHEDULE_OPTIONS.find(o => o.id !== 'custom' && o.value === cur);
    return match ? match.id : (cur ? 'custom' : 'crastur_standard');
  });

  const [customDays, setCustomDays] = useState('Lunes a Sábado');
  const [customOpenTime, setCustomOpenTime] = useState('8:00 AM');
  const [customCloseTime, setCustomCloseTime] = useState('8:00 PM');
  const [customSunday, setCustomSunday] = useState('8:30 AM a 2:00 PM');

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
    if (settings?.horario_atencion) {
      const cur = settings.horario_atencion.trim();
      const match = SCHEDULE_OPTIONS.find(o => o.id !== 'custom' && o.value === cur);
      if (match) {
        setScheduleMode(match.id);
      } else {
        setScheduleMode('custom');
      }
    }
  }, [settings]);

  // Generador de texto de horario combinando días de semana y domingos
  const buildScheduleString = (days, open, close, sunday) => {
    let str = `${days} de ${open} a ${close}`;
    if (sunday === 'cerrado') {
      str += ' (Domingos Cerrado)';
    } else if (sunday && sunday !== 'ninguno') {
      str += ` | Domingos de ${sunday}`;
    }
    return str;
  };

  // Manejo de cambio en el selector de horario
  const handleScheduleSelect = (modeId) => {
    setScheduleMode(modeId);
    if (modeId !== 'custom') {
      const found = SCHEDULE_OPTIONS.find(o => o.id === modeId);
      if (found) {
        setForm(prev => ({ ...prev, horario_atencion: found.value }));
        toast.success(`Horario seleccionado: ${found.shortLabel}`);
      }
    } else {
      const generated = buildScheduleString(customDays, customOpenTime, customCloseTime, customSunday);
      setForm(prev => ({ ...prev, horario_atencion: generated }));
      toast.info('Modo horario personalizado activo. Puedes ajustar semana y domingos abajo.');
    }
  };

  const handleUpdateCustomSchedule = (days, open, close, sunday) => {
    const nextDays = days !== undefined ? days : customDays;
    const nextOpen = open !== undefined ? open : customOpenTime;
    const nextClose = close !== undefined ? close : customCloseTime;
    const nextSunday = sunday !== undefined ? sunday : customSunday;

    setCustomDays(nextDays);
    setCustomOpenTime(nextOpen);
    setCustomCloseTime(nextClose);
    setCustomSunday(nextSunday);

    const generated = buildScheduleString(nextDays, nextOpen, nextClose, nextSunday);
    setForm(prev => ({ ...prev, horario_atencion: generated }));
  };

  // Conmutador interactivo de formas de pago
  const togglePaymentItem = (paymentLabel) => {
    const cur = form.metodos_pago || '';
    let updated = '';
    if (cur.toLowerCase().includes(paymentLabel.toLowerCase())) {
      const regex = new RegExp(`(,\\s*)?${paymentLabel}`, 'gi');
      updated = cur.replace(regex, '').replace(/^,\s*/, '').trim();
      toast.info(`Desactivado: ${paymentLabel}`);
    } else {
      updated = cur ? `${cur}, ${paymentLabel}` : paymentLabel;
      toast.success(`Activado: ${paymentLabel}`);
    }
    setForm(prev => ({ ...prev, metodos_pago: updated }));
  };

  const field = (name) => ({
    value: form[name] ?? '',
    onChange: (e) => setForm({ ...form, [name]: e.target.value })
  });

  const toggle = (name) => ({
    checked: form[name] === '1',
    onChange: (e) => setForm({ ...form, [name]: e.target.checked ? '1' : '0' })
  });

  const insertVariable = (fieldName, varTag) => {
    const cur = form[fieldName] || '';
    setForm(prev => ({ ...prev, [fieldName]: `${cur} ${varTag}` }));
    toast.info(`Insertado "${varTag}"`);
  };

  const insertEmoji = (fieldName, emoji) => {
    const cur = form[fieldName] || '';
    setForm(prev => ({ ...prev, [fieldName]: `${cur} ${emoji}` }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const zonesToSave = deliveryZones.map((z) => ({
        ...z,
        palabras: typeof z.palabras === 'string'
          ? z.palabras.split(',').map((p) => p.trim()).filter(Boolean)
          : z.palabras
      }));

      const payload = {
        ...form,
        delivery_zonas_json: JSON.stringify(zonesToSave)
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('¡Configuración guardada exitosamente!');
        if (onSaveSettings) onSaveSettings(data.settings);
      } else {
        toast.error('Error al guardar la configuración');
      }
    } catch (err) {
      toast.error('Error de red al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

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
          toast.success('Zonas de delivery restablecidas a valores recomendados.');
        }
      });
    } else {
      setDeliveryZones(DEFAULT_DELIVERY_ZONES);
    }
  };

  const handleDownloadBackup = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = '/api/backup/download';
    link.download = `backup_crastur_${dateStr}.db`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Descargando copia de seguridad de la tienda...');
  };

  const handleSelectRestoreFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const performRestore = async () => {
      setRestoring(true);
      const formData = new FormData();
      formData.append('backupFile', file);

      try {
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          toast.success('¡Respaldo restaurado correctamente! Recargando...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error(data.error || 'Error al restaurar el respaldo');
        }
      } catch (err) {
        toast.error('Error de red al subir la copia de seguridad');
      } finally {
        setRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (onRequestConfirm) {
      onRequestConfirm({
        title: '⚠️ ¿Restaurar información de la tienda?',
        message: `Esto reemplazará toda la información actual con el archivo de respaldo "${file.name}". Los datos actuales quedarán en el punto guardado en ese archivo.`,
        confirmText: 'Sí, Restaurar Ahora',
        checkboxLabel: 'Entiendo que se sobrescribirán los datos actuales con este respaldo',
        isDanger: true,
        onConfirm: performRestore
      });
    } else {
      performRestore();
    }
  };

  const cardCls = 'bg-[#0a0f1d] border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4';
  const labelCls = 'text-xs font-bold text-slate-300 block mb-1';
  const inputCls = 'w-full bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition';
  const textareaCls = 'w-full bg-[#070b14] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none transition leading-relaxed resize-none';

  // Simulador de WhatsApp
  const renderWhatsAppSimulator = () => {
    let previewTitle = '👋 Saludo Inicial';
    let previewText = form.mensaje_bienvenida || 'Te damos la bienvenida a Crastur...';
    let badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';

    if (subTabMensajes === 'fuera_horario') {
      previewTitle = '🌙 Tienda Cerrada';
      previewText = form.mensaje_fuera_horario || 'Nuestra tienda física se encuentra cerrada...';
      badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    } else if (subTabMensajes === 'seguimiento') {
      previewTitle = '⏱️ Recordatorio';
      previewText = (form.mensaje_insistencia || '¡Hola, {nombre}! ¿Pudiste revisar el precio de {producto}?')
        .replace('{nombre}', 'Carlos')
        .replace('{producto}', 'Pastillas de Freno SBR');
      badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }

    return (
      <div className="bg-[#0b141a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera WhatsApp */}
        <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xs">
              CR
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>{form.nombre_negocio || 'Crastur Repuestos'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-[10px] text-slate-400">en línea (Bot 24/7)</p>
            </div>
          </div>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono border ${badgeColor}`}>
            {previewTitle}
          </span>
        </div>

        {/* Cuerpo del Chat */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#0b141a] min-h-[300px]">
          <div className="flex justify-center">
            <span className="text-[10px] bg-[#182229] text-slate-400 px-3 py-1 rounded-full border border-slate-800">
              HOY
            </span>
          </div>

          {/* Mensaje simulado del cliente */}
          <div className="flex justify-end">
            <div className="bg-[#005c4b] text-slate-100 p-2.5 rounded-2xl rounded-tr-xs max-w-[85%] text-xs shadow-md">
              <p>Hola, buenas tardes. ¿Tienen pastillas de freno?</p>
              <div className="text-[9px] text-emerald-300/80 text-right mt-1 flex items-center justify-end gap-1 font-mono">
                <span>12:45 PM</span>
                <Check size={11} className="text-sky-300" />
              </div>
            </div>
          </div>

          {/* Respuesta del Bot de Crastur */}
          <div className="flex justify-start">
            <div className="bg-[#202c33] text-slate-100 p-3 rounded-2xl rounded-tl-xs max-w-[92%] text-xs shadow-md border border-slate-700/40 space-y-1.5">
              <p className="whitespace-pre-line leading-relaxed font-sans">{previewText}</p>
              <div className="text-[9px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1 font-mono">
                <span>12:45 PM</span>
                <CheckCircle2 size={11} className="text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior de WhatsApp */}
        <div className="bg-[#1f2c34] p-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
          <span>Vista en vivo del cliente</span>
          <span className="font-mono text-emerald-400 text-[10px] font-bold">● Simulación en tiempo real</span>
        </div>
      </div>
    );
  };

  const isStoreClosed = form.fuera_horario_activo === '1';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ENCABEZADO PRINCIPAL DE LA VISTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Settings size={22} className="text-orange-400" />
              Configuración de la Tienda y el Bot
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Fácil de usar: cambia horarios, activa o apaga formas de pago y estilos de atención con un solo toque.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="self-start sm:self-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={16} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>

        {/* NAVEGADOR DE PESTAÑAS (TABS GRANDES Y CLAROS) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-[#070b14] border border-slate-800 rounded-2xl shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border border-orange-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-orange-400' : 'text-slate-500'} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENIDO PRINCIPAL POR PESTAÑAS */}
        <div key={activeTab} className="space-y-6 animate-fade-in">
          {/* ============================================================== */}
          {/* PESTAÑA 1: MI TIENDA & HORARIO (CONTROL DIARIO EN 1 TOQUE)     */}
          {/* ============================================================== */}
          {activeTab === 'tienda' && (
            <div className="space-y-6">
              {/* INTERRUPTOR GIGANTE DE ESTADO: TIENDA ABIERTA O CERRADA */}
              <div className={`p-5 rounded-3xl border transition-all shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                !isStoreClosed
                  ? 'bg-gradient-to-r from-emerald-950/40 to-[#0a0f1d] border-emerald-500/40'
                  : 'bg-gradient-to-r from-indigo-950/50 to-[#0a0f1d] border-indigo-500/40'
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                    !isStoreClosed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {!isStoreClosed ? '🟢' : '🌙'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {!isStoreClosed ? 'Tienda Abierta al Público' : 'Tienda Cerrada (Modo Nocturno / Domingo)'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {!isStoreClosed
                        ? 'El bot atiende cotizaciones y permite a los clientes apartar productos por 24 horas.'
                        : 'El bot informa que la tienda física está cerrada pero sigue respondiendo consultas de precios.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = isStoreClosed ? '0' : '1';
                    setForm(prev => ({ ...prev, fuera_horario_activo: nextVal }));
                    toast.success(nextVal === '1' ? 'Tienda marcada como CERRADA' : 'Tienda marcada como ABIERTA');
                  }}
                  className={`px-5 py-3 rounded-2xl font-bold text-xs transition cursor-pointer flex items-center gap-2 shrink-0 shadow-md ${
                    !isStoreClosed
                      ? 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-orange-500 hover:text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  }`}
                >
                  {!isStoreClosed ? '🌙 Marcar como Tienda Cerrada' : '☀️ Abrir Tienda Ahora'}
                </button>
              </div>

              {/* SELECTOR INTERACTIVO DE HORARIO DE TRABAJO */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Horario de Atención de la Tienda</h3>
                    <p className="text-[11px] text-slate-400">Selecciona el horario con el menú desplegable o personalízalo con horas a tu gusto</p>
                  </div>
                </div>

                {/* MENÚ DESPLEGABLE (SELECT) INTERACTIVO */}
                <div className="space-y-3">
                  <label className={labelCls}>Elige el horario de la tienda:</label>
                  <select
                    value={scheduleMode}
                    onChange={(e) => handleScheduleSelect(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:border-orange-500 focus:outline-none transition font-semibold cursor-pointer"
                  >
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-[#0a0f1d] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* 4 BOTONES DE ACCESO RÁPIDO TIPO CHIP */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleScheduleSelect(opt.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          scheduleMode === opt.id
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-sm'
                            : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.Icon && <opt.Icon size={14} className={scheduleMode === opt.id ? 'text-orange-400' : opt.iconColor} />}
                        <span>{opt.shortLabel}</span>
                      </button>
                    ))}
                  </div>

                  {/* CAJA DE HORARIO PERSONALIZADO (APARECE SOLO SI SE ELIGE LA 4TA OPCIÓN) */}
                  {scheduleMode === 'custom' && (
                    <div className="mt-3 p-4 bg-slate-900/60 border border-orange-500/30 rounded-2xl space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
                        <span>✏️</span>
                        <span>Configurar horas personalizadas de apertura y cierre:</span>
                      </div>

                      <div className="space-y-3">
                        {/* 1. Horario de Lunes a Sábado */}
                        <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-2">
                          <span className="text-[11px] font-bold text-slate-300 block">
                            📅 Días de Semana (Lunes a Sábado):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">Días laborales:</label>
                              <select
                                value={customDays}
                                onChange={(e) => handleUpdateCustomSchedule(e.target.value, customOpenTime, customCloseTime, customSunday)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                              >
                                <option value="Lunes a Sábado">Lunes a Sábado</option>
                                <option value="Lunes a Viernes">Lunes a Viernes</option>
                                <option value="Todos los días">Todos los días</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">Apertura en semana:</label>
                              <select
                                value={customOpenTime}
                                onChange={(e) => handleUpdateCustomSchedule(customDays, e.target.value, customCloseTime, customSunday)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                              >
                                {['7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM'].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">Cierre en semana:</label>
                              <select
                                value={customCloseTime}
                                onChange={(e) => handleUpdateCustomSchedule(customDays, customOpenTime, e.target.value, customSunday)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                              >
                                {['2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM'].map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* 2. Horario especial de Domingos */}
                        <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-2">
                          <span className="text-[11px] font-bold text-orange-400 block flex items-center gap-1.5">
                            <span>☀️</span>
                            <span>Atención los Domingos en Tienda Física:</span>
                          </span>
                          <select
                            value={customSunday}
                            onChange={(e) => handleUpdateCustomSchedule(customDays, customOpenTime, customCloseTime, e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none cursor-pointer"
                          >
                            <option value="8:30 AM a 2:00 PM">☀️ Domingos de 8:30 AM a 2:00 PM (Medio Día habitual Crastur)</option>
                            <option value="8:00 AM a 1:00 PM">☀️ Domingos de 8:00 AM a 1:00 PM (Medio Día temprano)</option>
                            <option value="9:00 AM a 2:00 PM">☀️ Domingos de 9:00 AM a 2:00 PM</option>
                            <option value="8:00 AM a 8:00 PM">☀️ Domingos de 8:00 AM a 8:00 PM (Horario corrido)</option>
                            <option value="cerrado">🚫 Domingos Cerrado (Solo Asistente Virtual 24/7)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">O escribe el texto directamente si deseas:</label>
                        <input
                          type="text"
                          {...field('horario_atencion')}
                          placeholder="Ej: Lunes a Sábado de 8:00 AM a 8:00 PM"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}

                  {/* VISTA PREVIA DEL HORARIO QUE INFORMA EL BOT */}
                  <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>El bot informará a los clientes: <strong>"{form.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'}"</strong></span>
                    </span>
                  </div>
                </div>
              </div>

              {/* IDENTIDAD Y DIRECCIÓN FÍSICA */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Nombre y Ubicación de la Tienda</h3>
                    <p className="text-[11px] text-slate-400">Datos que se entregan al cliente para visitarnos en Caracas</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nombre Comercial del Negocio:</label>
                    <input
                      type="text"
                      {...field('nombre_negocio')}
                      placeholder="Ej: Crastur - Repuestos de Moto & Insumos de Cauchera"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-300">Enlace de Google Maps:</label>
                      {form.google_maps_url && (
                        <a
                          href={form.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <ExternalLink size={12} /> Probar Ubicación
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      {...field('google_maps_url')}
                      placeholder="https://maps.app.goo.gl/..."
                      className={inputCls}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelCls}>Dirección Exacta de la Tienda Física:</label>
                    <input
                      type="text"
                      {...field('direccion_tienda')}
                      placeholder="Ej: Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas"
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">El bot enviará esta dirección cuando los clientes pregunten dónde retirar los repuestos.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 2: ASISTENTE VIRTUAL (100% VISUAL, SIN REDACTAR)       */}
          {/* ============================================================== */}
          {activeTab === 'mensajes' && (
            <div className="space-y-5">
              {/* SUB-NAVEGADOR DE 3 PASOS SIMPLES */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-[#070b14] border border-slate-800 rounded-2xl shadow-sm">
                <button
                  type="button"
                  onClick={() => setSubTabMensajes('bienvenida')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                    subTabMensajes === 'bienvenida'
                      ? 'bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-400 border border-orange-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <MessageSquare size={17} className={subTabMensajes === 'bienvenida' ? 'text-orange-400' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="leading-tight">1. Saludo Inicial</div>
                    <div className="text-[10px] text-slate-500 font-normal">Cómo saluda el bot</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTabMensajes('fuera_horario')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                    subTabMensajes === 'fuera_horario'
                      ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/10 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Moon size={17} className={subTabMensajes === 'fuera_horario' ? 'text-indigo-400' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="leading-tight">2. Tienda Cerrada</div>
                    <div className="text-[10px] text-slate-500 font-normal">Noche y domingos</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTabMensajes('seguimiento')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                    subTabMensajes === 'seguimiento'
                      ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Bell size={17} className={subTabMensajes === 'seguimiento' ? 'text-amber-400' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="leading-tight">3. Recordatorio</div>
                    <div className="text-[10px] text-slate-500 font-normal">A los 15-30 minutos</div>
                  </div>
                </button>
              </div>

              {/* DISTRIBUCIÓN EQUILIBRADA EN 2 COLUMNAS (CONTROLES IZQUIERDA | SIMULADOR WHATSAPP DERECHA) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* COLUMNA IZQUIERDA: CONTROLES DEL ASISTENTE */}
                <div className="lg:col-span-7 space-y-4">
                  {/* SUBTAB 1: BIENVENIDA */}
                  {subTabMensajes === 'bienvenida' && (
                    <div className={cardCls}>
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                          <MessageSquare size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Estilo de Bienvenida para el Asistente</h3>
                          <p className="text-[11px] text-slate-400">Toca una personalidad para que el bot hable con ese estilo sin escribir nada</p>
                        </div>
                      </div>

                      {/* 4 TARJETAS EN GRID 2X2 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {WELCOME_TONE_PRESETS.map((p) => {
                          const isSelected = cleanCompare(form.mensaje_bienvenida, p.texto);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setForm(prev => ({ ...prev, mensaje_bienvenida: p.texto }));
                                toast.success(`Estilo "${p.titulo}" activado en el bot.`);
                              }}
                              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-500/30 shadow-lg shadow-orange-500/10'
                                  : 'bg-[#070b14] border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                                    isSelected
                                      ? 'bg-orange-500/25 border-orange-500/50'
                                      : 'bg-slate-900 border-slate-800'
                                  }`}>
                                    {p.Icon && <p.Icon size={18} className={p.iconColor} />}
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    isSelected ? 'bg-orange-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-700 text-slate-300'
                                  }`}>
                                    {isSelected ? '✓ ACTIVO' : p.badge}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-white">{p.titulo}</h4>
                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{p.desc}</p>
                              </div>
                              <span className={`text-[10px] font-bold mt-2.5 inline-block ${
                                isSelected ? 'text-orange-400' : 'text-slate-500'
                              }`}>
                                {isSelected ? '● Tono aplicado' : 'Tocar para activar →'}
                              </span>
                            </button>
                          );
                        })}

                        {/* TARJETA PERSONALIZADO: aparece sólo cuando el texto no coincide con ningún preset */}
                        {!WELCOME_TONE_PRESETS.some(p => cleanCompare(form.mensaje_bienvenida, p.texto)) && (
                          <div className="p-3.5 rounded-2xl border text-left flex flex-col justify-between bg-amber-950/30 border-amber-500/60 ring-2 ring-amber-500/25 shadow-lg shadow-amber-500/10 col-span-1 sm:col-span-2">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-amber-500/20 border-amber-500/50 text-xl">✏️</div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-slate-950">✓ ACTIVO</span>
                              </div>
                              <h4 className="text-xs font-bold text-white">Mensaje Personalizado</h4>
                              <p className="text-[11px] text-amber-300/80 mt-1">Estás usando tu propio texto de bienvenida. El bot lo enviará exactamente como lo escribiste.</p>
                            </div>
                            <span className="text-[10px] font-bold mt-2.5 inline-block text-amber-400">● Tu mensaje personalizado está activo</span>
                          </div>
                        )}
                      </div>

                      {/* EDITOR DE TEXTO DEL SALUDO */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-300">
                            📝 Mensaje que enviará el Asistente:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, mensaje_bienvenida: WELCOME_TONE_PRESETS[0].texto }));
                              toast.info('Texto restaurado al estilo Pana Motero.');
                            }}
                            className="text-[10px] text-slate-400 hover:text-orange-400 transition cursor-pointer"
                          >
                            Restaurar original
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Insertar:</span>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', '{nombre}')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-200 hover:text-white cursor-pointer"
                          >
                            + {'{nombre}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', '{negocio}')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-200 hover:text-white cursor-pointer"
                          >
                            + {'{negocio}'}
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', 'Cashea 💛')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-amber-500/40 text-[10px] text-amber-300 cursor-pointer"
                          >
                            + Cashea 💛
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', 'San Agustín Norte 📍')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-sky-500/40 text-[10px] text-sky-300 cursor-pointer"
                          >
                            + San Agustín 📍
                          </button>
                          <button
                            type="button"
                            onClick={() => insertVariable('mensaje_bienvenida', 'Delivery Caracas 🛵')}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-[10px] text-emerald-300 cursor-pointer"
                          >
                            + Delivery 🛵
                          </button>
                        </div>

                        <textarea
                          rows={4}
                          {...field('mensaje_bienvenida')}
                          placeholder="Escribe el saludo cordial del bot..."
                          className={textareaCls}
                        />
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 2: TIENDA CERRADA */}
                  {subTabMensajes === 'fuera_horario' && (
                    <div className={cardCls}>
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                          <Moon size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Respuestas Fuera de Horario</h3>
                          <p className="text-[11px] text-slate-400">Configura qué responder cuando escriban de noche, domingos o feriados</p>
                        </div>
                      </div>

                      {/* SWITCH RÁPIDO PARA ACTIVAR RESPUESTA DE CIERRE DIRECTO AQUÍ */}
                      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{isStoreClosed ? '🌙' : '🟢'}</span>
                          <div>
                            <div className="text-xs font-bold text-white">
                              {isStoreClosed ? 'Modo Tienda Cerrada Activo' : 'Tienda en Horario Normal'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {isStoreClosed
                                ? 'El bot está avisando que la tienda física está cerrada.'
                                : 'El bot atiende normalmente con el saludo estándar.'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = isStoreClosed ? '0' : '1';
                            setForm(prev => ({ ...prev, fuera_horario_activo: nextVal }));
                            toast.success(nextVal === '1' ? 'Tienda marcada como CERRADA' : 'Tienda marcada como ABIERTA');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            isStoreClosed
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-md'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {isStoreClosed ? '✓ Modo Cerrado ON' : 'Activar Modo Cerrado'}
                        </button>
                      </div>

                      {/* 3 TARJETAS DE PLANTILLA DE CIERRE */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {OUT_OF_HOURS_PRESETS.map((oh) => {
                          const isSelected = cleanCompare(form.mensaje_fuera_horario, oh.texto);
                          return (
                            <button
                              key={oh.id}
                              type="button"
                              onClick={() => {
                                setForm(prev => ({ ...prev, mensaje_fuera_horario: oh.texto }));
                                toast.success(`Plantilla "${oh.titulo}" aplicada.`);
                              }}
                              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 ring-2 ring-indigo-500/30 shadow-md'
                                  : 'bg-[#070b14] border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                                    isSelected
                                      ? 'bg-indigo-500/25 border-indigo-500/50'
                                      : 'bg-slate-900 border-slate-800'
                                  }`}>
                                    {oh.Icon && <oh.Icon size={16} className={oh.iconColor} />}
                                  </div>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    isSelected ? 'bg-indigo-500 text-white font-black' : 'bg-slate-900 border border-slate-700 text-slate-400'
                                  }`}>
                                    {isSelected ? '✓ ACTIVO' : 'Elegir'}
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-white">{oh.titulo}</h4>
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{oh.desc}</p>
                              </div>
                              <span className={`text-[10px] font-bold mt-2.5 ${
                                isSelected ? 'text-indigo-300' : 'text-slate-500'
                              }`}>
                                {isSelected ? '● Plantilla activa' : 'Tocar para elegir →'}
                              </span>
                            </button>
                          );
                        })}

                        {/* TARJETA PERSONALIZADO: fuera de horario */}
                        {!OUT_OF_HOURS_PRESETS.some(oh => cleanCompare(form.mensaje_fuera_horario, oh.texto)) && (
                          <div className="p-3.5 rounded-2xl border text-left flex flex-col justify-between bg-amber-950/30 border-amber-500/60 ring-2 ring-amber-500/25 shadow-md col-span-1 sm:col-span-3">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-amber-500/20 border-amber-500/50 text-lg">✏️</div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-amber-500 text-slate-950">✓ ACTIVO</span>
                              </div>
                              <h4 className="text-xs font-bold text-white">Mensaje Personalizado</h4>
                              <p className="text-[10px] text-amber-300/80 mt-1">Estás usando tu propio mensaje de tienda cerrada.</p>
                            </div>
                            <span className="text-[10px] font-bold mt-2.5 text-amber-400">● Tu mensaje personalizado está activo</span>
                          </div>
                        )}
                      </div>

                      {/* EDITOR DE TEXTO CIERRE */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className={labelCls}>Mensaje que dirá el bot al estar cerrado:</label>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, mensaje_fuera_horario: OUT_OF_HOURS_PRESETS[0].texto }));
                              toast.info('Texto restaurado a Cierre Nocturno.');
                            }}
                            className="text-[10px] text-slate-400 hover:text-indigo-300 transition cursor-pointer"
                          >
                            Restaurar original
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          {...field('mensaje_fuera_horario')}
                          className={textareaCls}
                        />
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 3: RECORDATORIO */}
                  {subTabMensajes === 'seguimiento' && (
                    <div className={cardCls}>
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                          <Bell size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Recordatorio Automático al Cliente</h3>
                          <p className="text-[11px] text-slate-400">Si un cliente consultó un precio y no volvió a responder</p>
                        </div>
                      </div>

                      {/* SELECTOR DE TIEMPO CON BOTONES */}
                      <div className="space-y-2">
                        <label className={labelCls}>¿Cuánto tiempo esperar antes de enviar un recordatorio?</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { min: 0, label: 'Desactivado' },
                            { min: 15, label: '15 minutos (Recomendado)' },
                            { min: 30, label: '30 minutos' },
                            { min: 60, label: '1 hora' }
                          ].map((t) => {
                            const isCurrent = (t.min === 0 && form.insistencia_activa === '0') ||
                              (form.insistencia_activa === '1' && form.insistencia_minutos === String(t.min));
                            return (
                              <button
                                key={t.min}
                                type="button"
                                onClick={() => {
                                  if (t.min === 0) {
                                    setForm(prev => ({ ...prev, insistencia_activa: '0' }));
                                    toast.info('Recordatorios automáticos desactivados.');
                                  } else {
                                    setForm(prev => ({ ...prev, insistencia_activa: '1', insistencia_minutos: String(t.min) }));
                                    toast.success(`Recordatorio configurado a los ${t.min} minutos.`);
                                  }
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                  isCurrent
                                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md'
                                    : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span>{isCurrent ? '✓ ' : ''}{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* PLANTILLAS DE RECORDATORIO */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {FOLLOWUP_PRESETS.map((fp) => {
                          const isSelected = cleanCompare(form.mensaje_insistencia, fp.texto);
                          return (
                            <button
                              key={fp.id}
                              type="button"
                              onClick={() => {
                                setForm(prev => ({ ...prev, mensaje_insistencia: fp.texto }));
                                toast.success(`Plantilla "${fp.titulo}" aplicada.`);
                              }}
                              className={`p-3.5 rounded-2xl border text-left transition cursor-pointer text-xs flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 ring-2 ring-amber-500/30'
                                  : 'bg-[#070b14] border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5 font-bold">
                                  <span className="flex items-center gap-1.5">
                                    {fp.Icon && <fp.Icon size={14} className={fp.iconColor} />}
                                    <span>{fp.titulo}</span>
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                    isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-500'
                                  }`}>
                                    {isSelected ? '✓ ACTIVO' : 'Elegir'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 line-clamp-2">{fp.texto.replace('{nombre}', 'el cliente').replace('{producto}', 'el repuesto')}</p>
                              </div>
                            </button>
                          );
                        })}

                        {/* TARJETA PERSONALIZADO: recordatorio */}
                        {!FOLLOWUP_PRESETS.some(fp => cleanCompare(form.mensaje_insistencia, fp.texto)) && (
                          <div className="p-3.5 rounded-2xl border text-left text-xs flex flex-col justify-between bg-amber-950/30 border-amber-500/60 ring-2 ring-amber-500/25 shadow-md col-span-1 sm:col-span-3">
                            <div>
                              <div className="flex items-center justify-between mb-1.5 font-bold">
                                <span className="flex items-center gap-1.5">✏️ <span>Personalizado</span></span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black">✓ ACTIVO</span>
                              </div>
                              <p className="text-[10px] text-amber-300/80 line-clamp-2">Estás usando tu propio recordatorio personalizado.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* EDITOR DE TEXTO RECORDATORIO */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className={labelCls}>Texto del recordatorio:</label>
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({ ...prev, mensaje_insistencia: FOLLOWUP_PRESETS[0].texto }));
                              toast.info('Texto restaurado a Sutil & Amable.');
                            }}
                            className="text-[10px] text-slate-400 hover:text-amber-300 transition cursor-pointer"
                          >
                            Restaurar original
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          {...field('mensaje_insistencia')}
                          className={textareaCls}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* COLUMNA DERECHA: SIMULADOR WHATSAPP EN VIVO (STICKY) */}
                <div className="lg:col-span-5 sticky top-6">
                  {renderWhatsAppSimulator()}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 3: FORMAS DE PAGO Y CASHEA (INTERRUPTORES CONMUTABLES)  */}
          {/* ============================================================== */}
          {activeTab === 'pagos' && (
            <div className="space-y-6">
              {/* TARJETAS CONMUTABLES DE FORMAS DE PAGO */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">¿Qué Formas de Pago Aceptamos Hoy?</h3>
                    <p className="text-[11px] text-slate-400">Toca cada tarjeta para encenderla o apagarla según lo que tengas disponible en caja</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PAYMENT_OPTIONS.map((item) => {
                    const isAvailable = (form.metodos_pago || '').toLowerCase().includes(item.label.toLowerCase());
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => togglePaymentItem(item.label)}
                        className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isAvailable
                            ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200 ring-1 ring-emerald-500/30 shadow-md'
                            : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                            isAvailable
                              ? 'bg-emerald-500/25 border-emerald-500/50'
                              : 'bg-slate-900 border-slate-800'
                          }`}>
                            {item.Icon && <item.Icon size={18} className={isAvailable ? 'text-emerald-300' : item.iconColor} />}
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            isAvailable
                              ? 'bg-emerald-500 text-slate-950 shadow-sm'
                              : 'bg-slate-900 border border-slate-800 text-slate-500'
                          }`}>
                            {isAvailable ? '✓ ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{item.label}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                        <span className={`text-[10px] font-semibold mt-3 ${
                          isAvailable ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {isAvailable ? 'Tocar para apagar' : 'Tocar para encender'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* VISTA RESUMEN DEL TEXTO DE PAGOS */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Resumen informado a los clientes:
                  </span>
                  <p className="text-xs text-white font-medium">
                    {form.metodos_pago || 'No has seleccionado formas de pago activas.'}
                  </p>
                </div>
              </div>

              {/* CASHEA EN TIENDA */}
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Cashea (Financiamiento en Cuotas)</h3>
                    <p className="text-[11px] text-slate-400">Porcentaje de inicial que solicita la tienda física</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className={labelCls}>Porcentaje de inicial estándar:</label>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      { pct: 40, label: '40% (Nivel 1 - Estándar recomendado)' },
                      { pct: 30, label: '30% (Nivel 2)' },
                      { pct: 20, label: '20% (Nivel 3+)' }
                    ].map((c) => {
                      const isSelected = form.cashea_inicial_pct === String(c.pct);
                      return (
                        <button
                          key={c.pct}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, cashea_inicial_pct: String(c.pct) }));
                            toast.success(`Inicial de Cashea configurada en ${c.pct}%`);
                          }}
                          className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md'
                              : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          💛 {c.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Se aplica en compras presenciales mayores a <strong>$25 USD</strong> escaneando el código QR en caja.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 4: DELIVERY EN CARACAS                                 */}
          {/* ============================================================== */}
          {activeTab === 'delivery' && (
            <div className="space-y-6">
              <div className={cardCls}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                      <Truck size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Tarifas y Cobertura de Delivery en Caracas</h3>
                      <p className="text-[11px] text-slate-400">El bot cotiza según la zona que indique el cliente</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetZones}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Restablecer Tarifas</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {deliveryZones.map((zone, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[#070b14] border border-slate-800/80 rounded-2xl space-y-3 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">Sector / Municipio:</label>
                            <input
                              type="text"
                              value={zone.zona}
                              onChange={(e) => handleZoneChange(idx, 'zona', e.target.value)}
                              placeholder="Ej: Chacao / Las Mercedes"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-400 block mb-1">Tarifa de Envío:</label>
                            <input
                              type="text"
                              value={zone.tarifa}
                              onChange={(e) => handleZoneChange(idx, 'tarifa', e.target.value)}
                              placeholder="Ej: $3 a $4 USD"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-orange-400 focus:outline-none focus:border-orange-500 font-mono font-bold"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteZone(idx)}
                          className="self-end sm:self-center p-2 rounded-xl text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">
                          Palabras clave que activan esta tarifa (separadas por comas):
                        </label>
                        <input
                          type="text"
                          value={zone.palabras}
                          onChange={(e) => handleZoneChange(idx, 'palabras', e.target.value)}
                          placeholder="Ej: chacao, altamira, el rosal, los palos grandes"
                          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddZone}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-slate-700 hover:border-orange-500 text-xs font-bold text-slate-400 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Agregar Nueva Zona de Delivery</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PESTAÑA 5: SEGURIDAD Y RESPALDOS (SOLO ADMINISTRADOR)          */}
          {/* ============================================================== */}
          {activeTab === 'seguridad' && (
            <div className="space-y-6">
              <div className={cardCls}>
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Copias de Seguridad de la Tienda</h3>
                    <p className="text-[11px] text-slate-400">Guarda un archivo de respaldo o restaura datos en otra computadora</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Descargar Respaldo */}
                  <div className="p-4 rounded-2xl bg-[#070b14] border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Download size={14} className="text-indigo-400" />
                        Descargar Copia de Seguridad
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Genera un archivo de respaldo con todos tus productos, clientes, apartados y configuración de la tienda.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Descargar Respaldo a mi PC</span>
                    </button>
                  </div>

                  {/* Restaurar Respaldo */}
                  <div className="p-4 rounded-2xl bg-[#070b14] border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Upload size={14} className="text-amber-400" />
                        Restaurar desde Respaldo
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Carga un archivo de respaldo descargado previamente para restaurar toda la información de la tienda.
                      </p>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".db"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={handleSelectRestoreFile}
                      disabled={restoring}
                      className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-200 hover:text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Upload size={14} />
                      <span>{restoring ? 'Restaurando...' : 'Seleccionar Archivo de Respaldo'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BARRA INFERIOR DE GUARDADO */}
        <div className="pt-4 flex items-center justify-between border-t border-slate-800/80">
          <span className="text-xs text-slate-500">
            Sección activa: <strong className="text-slate-300">{TABS.find((t) => t.id === activeTab)?.label}</strong>
          </span>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-slate-950 font-bold text-xs transition shadow-lg shadow-orange-500/25 flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Guardando Cambios...
              </>
            ) : (
              <>
                <Check size={16} />
                Guardar Toda la Configuración
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
