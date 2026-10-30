/**
 * @file interruptions.ts
 * @description Módulo del flujo de apartados 24h extraído de apartadoFlow.ts.
 */

import { db, createReservation, recordMetric } from '../../database';
import { searchProductsFuzzy, searchMultipleProducts, extractLeadingQuantity } from '../services/searchService';
import { formatBs, formatRate, formatVenezuelanPhone, extractVenezuelanPhones } from '../utils/formatters';
import { normalizeText } from '../utils/textUtils';
import { detectCaracasZone } from '../utils/caracasDelivery';
/**
 * [SALIDA DE EMERGENCIA] Comandos universales que SIEMPRE deben poder escapar del flujo de
 * apartado (menú, saludo, catálogo, catálogo PDF, hablar con asesor o elegir opción del menú).
 * Devuelve true si el mensaje debe reenviarse al enrutador normal en lugar de tratarse como
 * el dato personal que el bot está pidiendo (nombre/cédula/teléfono).
 *
 * @param norm - Texto normalizado en minúsculas y sin acentos
 */
export function isApartadoEscapeCommand(norm: string): boolean {
  return (
    norm === 'menu' || norm === 'inicio' || norm === 'ayuda' ||
    norm === 'hola' || norm.startsWith('hola ') || norm === 'ola' ||
    /^\s*[1-6]\s*$/.test(norm) ||
    norm.includes('catalogo') || norm.includes('catalogos') ||
    norm.includes('vendedor') || norm.includes('asesor') || norm.includes('humano')
  );
}

/**
 * Evalúa si el mensaje entrante constituye una interrupción (pregunta de negocio, adición de otro producto
 * o comando de cancelación) en lugar del dato personal solicitado en el paso actual.
 *
 * @param text - Texto crudo enviado por el usuario
 * @param norm - Texto normalizado en minúsculas y sin acentos
 * @returns Objeto descriptor del tipo de interrupción ('cancel', 'product_addition', 'general_question') o null si es un dato válido.
 */
export function detectInterruption(text: string, norm: string): { type: string } | null {
  // Comandos explícitos de cancelación
  if (
    norm === 'cancelar' ||
    norm === 'salir' ||
    norm === 'abortar' ||
    norm === 'ya no' ||
    norm === 'no quiero' ||
    norm === 'cancela' ||
    norm === 'cancelalo' ||
    norm.includes('cancel') ||
    norm.includes('ya no quiero') ||
    norm.includes('no quiero apartar') ||
    norm.includes('no voy a apartar') ||
    norm.includes('olvidalo') ||
    norm.includes('olvida eso') ||
    norm.includes('dejalo asi') ||
    norm.includes('dejarlo asi')
  ) {
    return { type: 'cancel' };
  }

  // [SALIDA DE EMERGENCIA] Comandos universales (menú, saludo, catálogo, asesor, opciones 1-6).
  // En la práctica el router los intercepta antes de llegar aquí (ver isApartadoEscapeCommand),
  // pero se conserva la clasificación para que cualquier llamador directo reciba una salida útil.
  if (isApartadoEscapeCommand(norm) || norm.includes('no me interesa') || norm.includes('dejame')) {
    return { type: 'general_question' };
  }

  // Detección de intención de anexar un repuesto adicional al apartado (construcción de combo)
  const wantsToAddProduct =
    norm.includes('agrega') ||
    norm.includes('tambien quiero') ||
    norm.includes('tambien la quiero') ||
    norm.includes('tambien el') ||
    norm.includes('y tambien') ||
    norm.includes('incluye') ||
    norm.includes('ponle') ||
    norm.includes('suma') ||
    norm.includes('quiero') ||
    norm.includes('necesito') ||
    norm.startsWith('dame ') ||
    norm.startsWith('y la ') ||
    norm.startsWith('y el ') ||
    norm.startsWith('y las ') ||
    norm.startsWith('y los ') ||
    norm.startsWith('y una ') ||
    norm.startsWith('y un ') ||
    norm.startsWith('y otro ') ||
    norm.startsWith('y otra ');

  // Detección de preguntas sobre términos comerciales o logística
  const isQuestion =
    text.includes('?') ||
    text.includes('¿') ||
    norm.startsWith('cuanto') ||
    norm.startsWith('donde') ||
    norm.startsWith('tienen') ||
    norm.startsWith('hay') ||
    norm.startsWith('que vale') ||
    norm.startsWith('cual') ||
    norm.startsWith('cuanto es') ||
    norm.includes('precio') ||
    norm.includes('total') ||
    norm.includes('cuesta') ||
    norm.includes('vale') ||
    norm.includes('delivery') ||
    norm.includes('envio') ||
    norm.includes('pago movil') ||
    norm.includes('punto') ||
    norm.includes('cashea') ||
    norm.includes('horario') ||
    norm.includes('ubicacion') ||
    norm.includes('direccion') ||
    norm.includes('vendedor') ||
    norm.includes('asesor');

  if (wantsToAddProduct && mentionsProductIn(norm)) {
    return { type: 'product_addition' };
  }

  // Heurística de desambiguación: cadenas muy breves (<= 3 palabras) sin signos de pregunta ni verbos de consulta
  // corresponden habitualmente a nombres de personas (ej. "Luz García" contiene "luz" pero no es una pregunta de bombillos)
  const wordCount = text.trim().split(/\s+/).length;
  const isLikelyPersonalData = wordCount <= 3 && !text.includes('?') && !text.includes('¿') &&
    !norm.includes('cuanto') && !norm.includes('donde') && !norm.includes('tienen') &&
    !norm.includes('hay') && !norm.includes('vale') && !norm.includes('precio') &&
    !norm.includes('cuesta') && !norm.includes('delivery') && !norm.includes('vendedor') &&
    !wantsToAddProduct;

  if (isLikelyPersonalData) {
    return null;
  }

  if (isQuestion || mentionsProductIn(norm)) {
    return { type: 'general_question' };
  }

  return null;
}

/**
 * Vocabulario representativo del inventario automotriz de Crastur. Se usa para distinguir
 * un pedido de repuesto de un nombre propio durante el flujo de apartado.
 */
const APARTADO_PRODUCT_WORDS = [
  'bujia', 'aceite', 'pastilla', 'balata', 'banda', 'freno', 'disco', 'zapata',
  'cadena', 'arrastre', 'pinon', 'corona', 'catalina', 'sprocket',
  'tripa', 'camara', 'caucho', 'llanta', 'neumatico', 'parche', 'pega', 'valvula',
  'mecha', 'tarugo', 'plomo', 'gusanillo', 'aguja', 'terraja',
  'pulpo', 'malla', 'retrovisor', 'espejo', 'puno', 'guante', 'casco', 'coraza',
  'candado', 'filtro', 'bateria', 'bobina', 'cdi', 'estator', 'regulador',
  'refrigerante', 'limpiador', 'aditivo', 'bombillo', 'faro', 'plumilla',
  'amortiguador', 'horquilla', 'guaya', 'croche', 'clutch', 'embrague',
  'spray', 'manubrio', 'luz', 'led', 'pito', 'bocina', 'direccional', 'stop'
];

/** True si el texto normalizado menciona un repuesto/insumo conocido del catálogo. */
export function mentionsProductIn(norm: string): boolean {
  return APARTADO_PRODUCT_WORDS.some(w => norm.includes(w));
}

/**
 * Responde a la interrupción de un usuario dentro del flujo de apartado y
 * reitera amablemente la solicitud del dato pendiente para no quebrar la reserva.
 * 
 * @param jid - JID destinatario
 * @param text - Texto del mensaje del usuario
 * @param norm - Texto normalizado
 * @param session - Registro de la sesión de chat activa
 * @param tasa - Tasa BCV efectiva en Bs/USD
 * @param settings - Configuración general de la tienda
 * @param interruption - Descriptor del tipo de interrupción
 * @param currentMetadata - Metadatos acumulados de la reserva (productos, precios, datos personales)
 * @param stepPrompt - Frase orientadora del paso actual a recordar
 * @returns Mensaje formateado de respuesta
 */
export function handleInterruptionResponse(
  jid: string,
  text: string,
  norm: string,
  session: any,
  tasa: number,
  settings: any,
  interruption: { type: string },
  currentMetadata: any,
  stepPrompt: string
): string {
  if (interruption.type === 'cancel') {
    db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
    return `Operación de apartado cancelada 👍. Escribe *MENU* para volver al inicio o escribe el repuesto que buscas.`;
  }

  // Adición dinámica de repuestos al pedido (transformación a combo)
  if (interruption.type === 'product_addition') {
    const multi = searchMultipleProducts(text);
    let newProducts: any[] = [];
    if (multi.length > 0) {
      newProducts = multi;
    } else {
      const single = searchProductsFuzzy(text);
      if (single.length > 0) newProducts = [single[0]];
    }

    if (newProducts.length > 0) {
      let existingItems: any[] = [];
      if (currentMetadata.items && Array.isArray(currentMetadata.items) && currentMetadata.items.length > 0) {
        existingItems = [...currentMetadata.items];
      } else if (currentMetadata.producto_id) {
        existingItems = [{
          id: currentMetadata.producto_id,
          nombre: currentMetadata.producto_nombre,
          precio_usd: parseFloat(currentMetadata.precio_usd) || 0
        }];
      }

      for (const np of newProducts) {
        if (!existingItems.some(it => it.id === np.id)) {
          existingItems.push({
            id: np.id,
            nombre: `${np.marca} - ${np.modelo}`,
            precio_usd: parseFloat(np.precio_usd) || 0,
            cantidad: np.cantidad || 1
          });
        }
      }

      const totalUsd = existingItems.reduce((sum, it) => sum + (parseFloat(it.precio_usd) || 0) * (parseInt(it.cantidad, 10) || 1), 0);
      const comboNombre = existingItems.length > 1
        ? `Combo: ${existingItems.map(it => it.nombre).join(' + ')}`
        : existingItems[0].nombre;

      const updatedMeta = {
        ...currentMetadata,
        is_combo: existingItems.length > 1,
        producto_id: existingItems[0].id,
        producto_nombre: comboNombre,
        precio_usd: totalUsd,
        items: existingItems
      };

      db.prepare(`
        UPDATE chat_sessions
        SET apartado_metadata = ?,
            ultimo_producto_nombre = ?,
            step = 'apartado_pidiendo_nombre'
        WHERE jid = ?
      `).run(JSON.stringify(updatedMeta), comboNombre, jid);

      let msg = `🛒 *¡Excelente! Agregamos los repuestos a tu pedido:* 🛞🏍️\n\n`;
      existingItems.forEach((it, idx) => {
        msg += `${idx + 1}️⃣ *${it.nombre}:* *$${parseFloat(it.precio_usd).toFixed(2)} USD* (Bs. ${formatBs(it.precio_usd * tasa)})\n`;
      });
      msg += `\n📊 *Total Combinado:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalUsd * tasa)})\n`;
      msg += `⏱️ Te guardamos este combo sin costo por 24 horas continuas.\n\n`;
      msg += `Para generar tu comprobante oficial en caja, por favor indícanos tu *Nombre y Apellido*:\n_(Escribe *cancelar* si deseas salir)_`;
      return msg;
    }
  }

  // Despejar consultas operativas sin cancelar el flujo
  let answer = '';
  if (norm.includes('delivery') || norm.includes('envio') || norm.includes('motorizado') || norm.includes('flete')) {
    const detectedZone = detectCaracasZone(text, settings);
    if (detectedZone) {
      answer = `🛵 *Delivery a ${detectedZone.nombre}:* *${detectedZone.tarifa}* con motorizado el mismo día.`;
    } else {
      answer = `🛵 *Delivery en Caracas:* San Agustín, Centro y zonas cercanas *$2 a $3 USD*. Otras zonas (Catia, Propatria, El Valle, Baruta, Petare) *$3 a $5 USD*.`;
    }
  } else if (norm.includes('total') || norm.includes('cuanto es en total') || norm.includes('cuanto seria todo') || norm.includes('cuanto es') || norm.includes('cuanto seria') || norm.includes('cuanto sale') || norm.includes('precio')) {
    const totalUsd = parseFloat(currentMetadata.precio_usd) || 0;
    const totalBs = totalUsd * tasa;
    let itemsDesc = '';
    if (currentMetadata.items && Array.isArray(currentMetadata.items) && currentMetadata.items.length > 1) {
      itemsDesc = currentMetadata.items.map((it: any, idx: number) => `   ${idx + 1}️⃣ ${it.nombre}: *$${parseFloat(it.precio_usd).toFixed(2)} USD*`).join('\n') + '\n';
    } else {
      itemsDesc = `   📦 ${currentMetadata.producto_nombre || 'Repuesto'}: *$${totalUsd.toFixed(2)} USD*\n`;
    }
    answer = `📊 *Resumen Actual de tu Pedido:* 🛞🏍️\n${itemsDesc}\n💵 *Total a Pagar:* *$${totalUsd.toFixed(2)} USD* (Bs. ${formatBs(totalBs)} a tasa oficial BCV: ${formatRate(tasa)})\n🔥 _(¡Aprovecha nuestro Precio Promoción en Divisas pagando en Efectivo o Binance Pay!)_`;
  } else if (norm.includes('pago') || norm.includes('punto') || norm.includes('transferencia') || norm.includes('efectivo') || norm.includes('binance')) {
    answer = `💳 *Formas de Pago:* Precio Promoción en Divisas (Efectivo $ y Binance Pay USDT 🪙), Pago Móvil o transferencia a tasa oficial BCV (Bs. ${formatRate(tasa)}), y Cashea en tienda física.`;
  } else if (norm.includes('donde') || norm.includes('ubicacion') || norm.includes('direccion')) {
    answer = `🏢 *Tienda física:* ${settings.direccion_tienda || 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas'}.\n🗺️ *Maps:* ${settings.google_maps_url || 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA'}`;
  } else if (norm.includes('horario') || norm.includes('abren') || norm.includes('cierran') ||
    (norm.includes('hora') && (norm.includes('abren') || norm.includes('cierran') || norm.includes('atienden') || norm.includes('horario')))) {
    answer = `🕒 *Horario:* ${settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM'} (horario corrido).`;
  } else if (norm.includes('cashea')) {
    answer = `💛 *Cashea en Tienda:* Disponible a partir de $25 USD. Pagas la inicial al retirar y 3 cuotas quincenales a 0% interés.`;
  } else if (norm.includes('instala') || norm.includes('taller') || norm.includes('mecanico') || norm.includes('cambian') || norm.includes('cambio de aceite') || norm.includes('montan')) {
    answer = `🔧 *Venta de repuestos:* En Crastur somos tienda de venta de repuestos e insumos nuevos (no tenemos taller mecánico en el local). Te lo enviamos por delivery directo a tu mecánico o te recomendamos talleres aliados cercanos en Caracas.`;
  } else if (norm.includes('garantia') || norm.includes('defectuoso') || norm.includes('no le sirve') ||
    (norm.includes('cambio') && !norm.includes('aceite') && !norm.includes('pastilla') && !norm.includes('bujia') && !norm.includes('refrigerante') && !norm.includes('filtro'))) {
    answer = `🛡️ *Garantía:* Todos nuestros repuestos cuentan con garantía contra defectos de fábrica y garantía de calce (cambio inmediato en tienda con empaque original).`;
  } else if (norm.includes('tasa') || norm.includes('dolar') || norm.includes('bcv')) {
    answer = `🇻🇪 *Tasa BCV:* Calculamos todos los pagos a tasa oficial BCV del día (Bs. ${formatRate(tasa)} / USD).`;
  } else if (norm.includes('menu') || norm === 'hola' || norm.startsWith('hola ') || norm === 'catalogo' || norm.includes('catalogo')) {
    answer = `👋 Puedes escribir *MENU* para ver todas las opciones, *CATALOGO* para los PDF, o directamente el repuesto que buscas. También puedes escribir *CANCELAR* para salir del apartado.`;
  } else {
    // [NO ATRAPAR AL CLIENTE] Si no se reconoce la consulta, se da una salida clara en vez de
    // repetir un genérico vacío. El cliente siempre puede cancelar para volver a consultar.
    answer = `Con gusto te ayudamos. Si deseas continuar con el apartado, responde el dato solicitado. También puedes escribir *CANCELAR* para salir del apartado y consultar cualquier otra cosa del catálogo.`;
  }

  return `${answer}\n\n━━━━━━━━━━━━━━━━━━━━━\n📌 _Para completar tu apartado por 24 horas:_\n${stepPrompt}`;
}
