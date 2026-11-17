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
    texto: 'Te ayudo con precios y disponibilidad al instante. ¿Qué buscas para tu moto o cauchera?'
  },
  {
    id: 'profesional',
    titulo: 'Atención Formal & Tienda',
    badge: 'Formal 👔',
    desc: 'Educado, serio, enfocado en asesoría técnica y repuestos con garantía.',
    Icon: Building2,
    iconColor: 'text-sky-400',
    color: 'border-sky-500/50 bg-sky-500/10 text-sky-300',
    texto: 'Con gusto te ayudo con precios y disponibilidad. ¿Qué repuesto necesitas?'
  },
  {
    id: 'rapido',
    titulo: 'Mostrador Express',
    badge: 'Express ⚡',
    desc: 'Directo al grano. Da precios en 1 segundo y ubicación para retirar.',
    Icon: Zap,
    iconColor: 'text-emerald-400',
    color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    texto: 'Precios y stock al instante. Dime qué repuesto buscas (ej: pastillas, bujía, aceite).'
  },
  {
    id: 'cashea',
    titulo: 'Especial Cashea (En Cuotas)',
    badge: 'Cashea 💛',
    desc: 'Destaca que el cliente puede llevarse el repuesto hoy pagando en cuotas.',
    Icon: ShoppingBagIcon,
    iconColor: 'text-amber-400',
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    texto: '¡Hola! Bienvenido a *Crastur* 🛞🏍️💛\n¡Llévate hoy tus repuestos e insumos pagando la inicial y el resto en cuotas quincenales sin interés con Cashea!\n\n¿Qué repuesto necesitas para tu moto hoy? Te confirmamos precio y cuotas al instante.'
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
    texto: '⏰ La tienda está cerrada ahora. Te atendemos en nuestro horario habitual.\nPuedo darte precios y disponibilidad mientras tanto. Dime qué repuesto buscas.'
  },
  {
    id: 'almuerzo',
    titulo: 'Pausa de Almuerzo',
    Icon: Coffee,
    iconColor: 'text-amber-400',
    desc: 'Pausa breve de almuerzo en el mostrador',
    texto: '🥪 Estamos en pausa de almuerzo. Te respondemos apenas volvamos al mostrador.'
  },
  {
    id: 'domingo',
    titulo: 'Descanso Dominical',
    Icon: Sun,
    iconColor: 'text-yellow-400',
    desc: 'Para domingos no laborables o feriados',
    texto: '☀️ Los domingos la tienda física descansa. El asistente virtual te da precios de una vez. El lunes abrimos a las 8:00 AM.'
  }
];

// Presets para seguimiento automático
export const FOLLOWUP_PRESETS = [
  {
    id: 'amable',
    titulo: 'Sutil & Amable',
    Icon: Sparkles,
    iconColor: 'text-emerald-400',
    texto: '¿Cómo va todo, {nombre}? 👋\nQuedó pendiente el *{producto}*. Si aún lo necesitas, te lo dejo listo en tienda.\nSi prefieres una persona, escribe *VENDEDOR*.'
  },
  {
    id: 'urgencia',
    titulo: 'Disponibilidad Limitada',
    Icon: Flame,
    iconColor: 'text-red-400',
    texto: '¡Hola, {nombre}! ⏱️ Quedan pocas unidades de *{producto}*. ¿Te lo aparto 24 h sin costo?'
  },
  {
    id: 'cashea',
    titulo: 'Financiamiento Cashea',
    Icon: ShoppingBagIcon,
    iconColor: 'text-yellow-400',
    texto: '¡Hola, {nombre}! 💛 Con Cashea llevas *{producto}* pagando solo la inicial. ¿Te preparo el pedido?'
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
