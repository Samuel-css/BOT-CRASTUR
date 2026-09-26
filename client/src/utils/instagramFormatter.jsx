import { toast } from 'sonner';
import { formatBs } from './formatters';

/**
 * Componente SVG de icono de Instagram
 */
export function InstagramIcon({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

/**
 * Genera el texto formateado profesional para publicar un repuesto o combo en Instagram
 * Optimizado para generar interacción, ventas por WhatsApp y compras con Cashea
 */
export function generateInstagramCaption(product, bcvRate = 849.56) {
  if (!product) return '';

  const marca = (product.marca || '').trim();
  const modelo = (product.modelo || '').trim();
  const categoria = (product.categoria || '').trim();
  const descripcion = (product.descripcion || '').trim();
  const precioUsd = parseFloat(product.precio_usd || 0);
  const precioBs = precioUsd * (parseFloat(bcvRate) || 849.56);
  const isCombo = categoria.toLowerCase().includes('combo') || categoria.toLowerCase().includes('kit') || modelo.toLowerCase().includes('kit') || modelo.toLowerCase().includes('combo');
  const hasCashea = precioUsd >= 25;
  const casheaInicial = precioUsd * 0.40;
  const casheaCuota = (precioUsd - casheaInicial) / 3;

  let caption = `🔥 ${isCombo ? 'COMBO CRASTUR' : 'DISPONIBLE EN CRASTUR'} 🛞🏍️\n`;
  caption += `📌 *${marca ? marca.toUpperCase() + ' - ' : ''}${modelo.toUpperCase()}*\n\n`;

  if (descripcion) {
    caption += `📝 *Detalles:*\n${descripcion}\n\n`;
  }

  caption += `💵 *Precio Promoción en Divisas:* *$${precioUsd.toFixed(2)} USD* (Efectivo / Binance Pay 🪙)\n`;
  caption += `🇻🇪 *En Bolívares:* *Bs. ${formatBs(precioBs)}* (Tasa oficial BCV)\n\n`;

  if (hasCashea) {
    caption += `💛 *Llévatelo con Cashea en Tienda Física:*\n`;
    caption += `• Inicial hoy: *$${casheaInicial.toFixed(2)} USD* (40%)\n`;
    caption += `• + 3 cuotas quincenales de *$${casheaCuota.toFixed(2)} USD* (sin intereses)\n\n`;
  }

  caption += `🏢 *Tienda física:* Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas.\n`;
  caption += `🕒 *Horario:* Lunes a Sábado de 8:00 AM a 8:00 PM (horario corrido).\n`;
  caption += `🛵 *Delivery disponible* en toda Caracas con motorizado de confianza.\n\n`;
  caption += `👉 ¡Escríbenos al enlace de WhatsApp en nuestra biografía para apartarlo por 24 horas sin costo antes de que se agote! 🤝✨\n\n`;

  // Hashtags optimizados para el mercado caraqueño de repuestos y caucheras
  caption += isCombo
    ? `#crastur #combos #repuestosmoto #insumosdecauchera #motoscaracas #berasbr #motul #cashea #caracas #venezuela #ofertascaracas`
    : `#crastur #repuestosmoto #cauchera #insumosdecauchera #motosvenezuela #motoscaracas #cashea #sanagustin #caracas #tallerdelmoto`;

  return caption;
}

/**
 * Copia el texto formateado al portapapeles y notifica al usuario con un Toast
 */
export async function copyInstagramCaption(product, bcvRate = 849.56) {
  try {
    const text = generateInstagramCaption(product, bcvRate);
    if (!text) {
      toast.error('No se pudo generar el texto para Instagram.');
      return false;
    }

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback para navegadores antiguos sin Clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    const title = product.modelo ? `"${product.modelo}"` : 'del producto';
    toast.success(`¡Post de Instagram para ${title} copiado! Listo para pegar 📸`);
    return true;
  } catch (err) {
    console.error('Error al copiar texto de Instagram:', err);
    toast.error('Error al copiar al portapapeles.');
    return false;
  }
}
