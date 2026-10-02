/**
 * @file constants.js
 * @description Constantes de configuración de la tienda: pestañas, presets de mensajes,
 * horarios, métodos de pago y emojis rápidos. Extraído de SettingsView.jsx.
 */

import {
  MessageSquare, ShoppingBag, Truck, Database,
  Flame, Building2, Zap, ShoppingBag as ShoppingBagIcon,
  Moon, Coffee, Sun, Clock, Store, Briefcase, Sliders,
  DollarSign, Coins, Smartphone, CreditCard, Sparkles
} from 'lucide-react';

export const TABS = [
  { id: 'tienda', label: '1. Mi Tienda & Horario', icon: Building2, desc: 'Nombre, estado, tasa BCV y horario' },
  { id: 'mensajes', label: '2. Asistente Virtual', icon: MessageSquare, desc: 'Cómo habla el bot y respuestas' },
  { id: 'pagos', label: '3. Formas de Pago & Cashea', icon: ShoppingBag, desc: 'Métodos activos y cuotas' },
  { id: 'delivery', label: '4. Delivery Caracas', icon: Truck, desc: 'Zonas y tarifas de motorizado' },
  { id: 'seguridad', label: '5. Copia de Seguridad', icon: Database, desc: 'Respaldos y mantenimiento' }
];

// Presets de Tono para el Mensaje de Bienvenida del Bot
export const WELCOME_TONE_PRESETS = [
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
    Icon: ShoppingBagIcon,
    iconColor: 'text-amber-400',
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    texto: '¡Hola! Bienvenido a *Crastur* 🛞🏍️💛\n¡Llévate hoy tus repuestos e insumos pagando solo el 40% inicial y el resto en 3 cuotas quincenales sin interés con Cashea!\n\n¿Qué repuesto necesitas para tu moto hoy? Te confirmamos precio y cuotas al instante.'
  }
];

// Presets para cuando la tienda está cerrada
export const OUT_OF_HOURS_PRESETS = [
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
export const FOLLOWUP_PRESETS = [
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
    Icon: ShoppingBagIcon,
    iconColor: 'text-yellow-400',
    texto: '¡Hola, {nombre}! 💛 Recuerda que en *{producto}* puedes llevártelo hoy pagando solo la inicial en tienda física con tu app Cashea. ¿Te preparamos el pedido?'
  }
];

// Opciones de horario predefinidas para el Selector
export const SCHEDULE_OPTIONS = [
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
export const PAYMENT_OPTIONS = [
  { id: 'efectivo', label: 'Efectivo $', Icon: DollarSign, iconColor: 'text-emerald-400', desc: 'Dólares en efectivo en tienda física' },
  { id: 'binance', label: 'Binance Pay (USDT)', Icon: Coins, iconColor: 'text-amber-400', desc: 'Pago digital en criptoactivos' },
  { id: 'pagomovil', label: 'Pago Móvil BCV', Icon: Smartphone, iconColor: 'text-sky-400', desc: 'En bolívares a tasa oficial BCV' },
  { id: 'cashea', label: 'Cashea en Tienda', Icon: ShoppingBagIcon, iconColor: 'text-yellow-400', desc: 'Pago en 3 cuotas quincenales' },
  { id: 'puntoventa', label: 'Punto de Venta', Icon: CreditCard, iconColor: 'text-purple-400', desc: 'Tarjeta de débito en mostrador' },
  { id: 'transferencia', label: 'Transferencia Bancaria', Icon: Building2, iconColor: 'text-blue-400', desc: 'Banesco o Mercantil' }
];

export const QUICK_EMOJIS = ['🏍️', '🛞', '🔧', '💵', '🪙', '💛', '📍', '📦', '✅', '⚡', '🕒', '👋', '🤝'];
