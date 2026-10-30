/**
 * @file constants.js
 * @description Constantes del Live Inbox: catálogo de atajos comerciales y tasa BCV de respaldo.
 * Extraído de LiveInboxView.jsx sin cambios de contenido.
 */

import { User, MapPin, DollarSign, Layers, Truck, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { formatRate } from '../../../utils/formatters';

// [MERCADO VENEZUELA] Tasa usada solo si el backend todavía no ha entregado una cotización.
export const FALLBACK_BCV_RATE = 849.56;

/**
 * Catálogo completo de atajos comerciales profesionales para Crastur.
 * Depende de la configuración de la tienda (horario y cuotas Cashea) y de la tasa BCV vigente.
 */
export function createCannedShortcuts({ settings = {}, effectiveRate } = {}) {
  // [CONSISTENCIA] Número de cuotas Cashea configurado en Ajustes (por defecto 3).
  const cuotasCashea = Math.max(1, parseInt(settings?.cashea_cuotas || '3', 10) || 3);
  const pctCuotaN1 = (60 / cuotasCashea).toFixed(1).replace('.0', '');
  const pctCuotaN2 = (70 / cuotasCashea).toFixed(1).replace('.0', '');
  const pctCuotaN3 = (80 / cuotasCashea).toFixed(1).replace('.0', '');

  return [
    {
      id: 'saludo',
      titulo: 'Saludo de Asesor',
      categoria: 'Atención',
      icono: User,
      color: 'emerald',
      texto: `¡Hola! 👋 Te atiende directamente un asesor de ventas de *Crastur*. ¿En qué repuesto o insumo para cauchera te podemos ayudar hoy? Con gusto te verificamos disponibilidad y precio en tienda física.`
    },
    {
      id: 'ubicacion',
      titulo: 'Ubicación & Puntos de Referencia',
      categoria: 'Tienda',
      icono: MapPin,
      color: 'orange',
      texto: `🏢 *Tienda Física Crastur - Insumos & Repuestos de Moto* 🛞🏍️\n📍 *Dirección:* Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.\n📌 *Puntos de Referencia:* Frente al Centro Financiero Latino, a 2 cuadras de la estación de Metro Parque Central y muy cerca de la Av. Bolívar.\n🕒 *Horario:* ${settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM'}.\n🗺️ *Google Maps:* https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA`
    },
    {
      id: 'pagos',
      titulo: 'Métodos de Pago & Tasa BCV',
      categoria: 'Pagos',
      icono: DollarSign,
      color: 'emerald',
      texto: `💳 *Formas de Pago Autorizadas en Crastur:*\n💵 *Precio Promoción en Divisas:* Pagando en *Efectivo ($)* o por *Binance Pay (USDT)* 🪙🔥\n✅ *Pago Móvil y Transferencia Bancaria* (a tasa oficial BCV del día, sin recargos)\n✅ *Efectivo en Bolívares* (a tasa oficial BCV)\n💳 *Punto de Venta* (tarjeta de débito en mostrador)\n💛 *Cashea en Tienda Física* (Disponible a partir de $25 USD)\n🇻🇪 *Tasa oficial BCV hoy:* Bs. ${formatRate(effectiveRate)} / USD`
    },
    {
      id: 'binance',
      titulo: 'Datos de Binance Pay',
      categoria: 'Pagos',
      icono: DollarSign,
      color: 'amber',
      texto: `🪙 *Pago por Binance Pay / USDT - Crastur* ⚡\n¡Aprovecha nuestro *Precio Promoción en Divisas* pagando con Binance sin comisiones!\n📲 *Pay ID / Correo:* (Consulta con nuestro asesor en caja)\n💡 *Instrucciones:* Abre tu app Binance > Pay > Enviar, ingresa el monto exacto en USDT y envíanos la captura o ID de transacción por aquí para procesar tu pedido de inmediato.`
    },
    {
      id: 'cashea',
      titulo: 'Financiamiento Cashea Completo',
      categoria: 'Pagos',
      icono: Layers,
      color: 'amber',
      texto: `💛 *Financiamiento Cashea en Crastur:*\n¡Sí! Aplica para compras y combos a partir de *$25 USD* en nuestra tienda física de San Agustín Norte:\n• *Pagas hoy solo la inicial* en caja escaneando con tu App Cashea al retirar.\n• *El monto restante* te queda en ${cuotasCashea} cuotas quincenales a 0% de interés.\n📊 *Porcentajes según tu nivel de usuario:*\n- Nivel 1: 40% inicial + ${cuotasCashea} cuotas quincenales del ${pctCuotaN1}%\n- Nivel 2: 30% inicial + ${cuotasCashea} cuotas quincenales del ${pctCuotaN2}%\n- Nivel 3+: 20% inicial + ${cuotasCashea} cuotas quincenales del ${pctCuotaN3}%`
    },
    {
      id: 'delivery',
      titulo: 'Delivery en Caracas & Tarifas',
      categoria: 'Envíos',
      icono: Truck,
      color: 'orange',
      texto: `🛵 *Servicio de Delivery en Caracas - Crastur* 📦\nDespachamos hoy mismo con motorizado confiable directo a tu domicilio, trabajo o taller mecánico.\n📍 *Tarifas estimadas de motorizado:*\n• San Agustín, Centro, Bellas Artes: *$2 a $3 USD*\n• Catia, El Valle, Chacao, Baruta, Petare: *$3 a $5 USD*\n👉 Indícanos tu zona o dirección exacta para confirmarte la tarifa del motorizado.`
    },
    {
      id: 'apartado',
      titulo: 'Cómo Apartar por 24 Horas',
      categoria: 'Ventas',
      icono: Clock,
      color: 'orange',
      texto: `⏱️ *Apartado sin Costo por 24 Horas en Crastur:*\nTe reservamos tu repuesto en tienda física durante 24 horas continuas para que lo retires con calma.\nPara emitir tu ticket oficial en caja, por favor indícanos:\n1️⃣ *Nombre y Apellido*\n2️⃣ *Cédula de Identidad (V- o E-)*\n3️⃣ *Teléfono de Contacto*\n¡Al llegar a tienda presentas tu cédula en caja y retiras!`
    },
    {
      id: 'disponibilidad',
      titulo: 'Disponibilidad Inmediata',
      categoria: 'Ventas',
      icono: CheckCircle2,
      color: 'emerald',
      texto: `✅ ¡Sí, tenemos disponibilidad inmediata! Puedes retirar hoy mismo en nuestra tienda física de San Agustín Norte (Lun-Sáb 8am-8pm) o solicitar despacho con motorizado a tu ubicación en Caracas.`
    },
    {
      id: 'garantia',
      titulo: 'Garantía & Devoluciones',
      categoria: 'Atención',
      icono: ShieldCheck,
      color: 'emerald',
      texto: `🛡️ *Garantía de Repuestos Crastur:*\nTodos nuestros repuestos y accesorios son 100% nuevos y cuentan con garantía contra defectos de fábrica y garantía de calce. Para hacer válida cualquier garantía o cambio es indispensable conservar el repuesto en su empaque original sin daños físicos ni modificaciones.`
    }
  ];
}
