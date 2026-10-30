/**
 * @file storeInfoHandlers.ts
 * @description Respuestas informativas del bot (módulo extraído de infoHandlers.ts).
 */

import { db } from '../../../database';
import { formatRate, formatBs } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { searchProductsFuzzy } from '../../services/searchService';
import { getProductsByCanonicalCategory } from '../../config/categoryGroups';
import { stockLabel } from '../../utils/stock';
export function handleInstallationQueryResponse(session: any): string {
  let msg = `🔧 *Venta de Repuestos e Instalación - Crastur* 🛞🏍️⚙️\n\n`;
  msg += `En *Crastur* somos una tienda física especializada exclusivamente en la **venta de repuestos y accesorios nuevos y garantizados para motos, insumos para caucheras y otros productos** (no contamos con taller mecánico ni realizamos instalaciones en el local) 🏢.\n\n`;
  msg += `💡 *Sin embargo, te facilitamos todo:*\n`;
  msg += `1️⃣ *Envío directo a tu taller:* Te enviamos el repuesto por delivery en moto directo a las manos de tu mecánico de confianza en cualquier zona de Caracas 🛵.\n`;
  msg += `2️⃣ *Recomendación aliada:* Si no cuentas con mecánico de confianza, con gusto te recomendamos talleres mecánicos aliados cercanos a nuestra tienda en Caracas para una instalación segura y garantizada 👍.\n\n`;
  msg += `👉 Escribe qué repuesto necesitas o escribe *VENDEDOR* para hablar directamente con nuestro equipo técnico.`;
  return msg;
}

/**
 * Describe las políticas de calidad, marcas OEM/genéricas y garantías de calce.
 * 
 * @returns Mensaje informativo de calidad
 */
export function handleQualityAndBrandsResponse(): string {
  let msg = `🛡️ *Calidad y Marcas de Nuestros Productos - Crastur* 🛞🏍️✨\n\n`;
  msg += `En *Crastur* cuidamos tu seguridad y tu bolsillo:\n\n`;
  msg += `• 💯 *Productos 100% Nuevos:* Todos nuestros repuestos e insumos vienen sellados de fábrica.\n`;
  msg += `• 🏷️ *Marcas Reconocidas:* Trabajamos con marcas de excelente calidad y rendimiento comprobado.\n`;
  msg += `• 🛡️ *Garantía de Fábrica:* Todos los repuestos y accesorios cuentan con garantía contra defectos de fabricación.\n`;
  msg += `• 🔄 *Garantía de Calce:* Si por alguna razón la pieza de moto no le sirve a tu modelo, realizamos el cambio en tienda física con tu comprobante y el empaque original.\n\n`;
  msg += `👉 Indícanos el modelo de tu moto o el insumo de cauchera que buscas y te damos precio y disponibilidad al instante.`;
  return msg;
}

/**
 * Responde a consultas generales sobre repuestos y accesorios de moto.
 * 
 * @returns Listado de líneas de repuestos de moto comercializados
 */
export function handleMotoQueryResponse(): string {
  let msg = `🏍️ *Repuestos y Accesorios para Motos en Crastur* 🛵\n\n`;
  msg += `¡Sí! En *Crastur* somos especialistas en repuestos y accesorios para motos. Disponemos de:\n\n`;
  msg += `⚙️ *Repuestos Mecánicos:*\n`;
  msg += `• Kits de arrastre (cadena 428H, piñón y corona) para Bera, Empire, Keeway, Suzuki y más.\n`;
  msg += `• Pastillas y bandas de freno.\n`;
  msg += `• Bujías de encendido (NGK, Bosch).\n`;
  msg += `• Aceites de motor 4T y 2T (mineral y semisintético).\n`;
  msg += `• Guayas de croche y acelerador.\n`;
  msg += `• Tripas y cauchos para moto (diversas medidas).\n`;
  msg += `• Baterías para moto.\n\n`;
  msg += `🏍️ *Repuestos y Accesorios:*\n`;
  msg += `• Puños para manubrio, mallas porta-casco, pulpos elásticos, retrovisores, luces LED y spray para cadena.\n\n`;
  msg += `💡 *Dinos qué repuesto o accesorio necesitas o el modelo de tu moto* y te confirmamos disponibilidad al instante.\n`;
  msg += `👉 O escribe *VENDEDOR* para que un asesor te atienda directamente.`;
  return msg;
}

/**
 * Responde a consultas generales sobre insumos y materiales para caucheras y llanteras.
 * 
 * @returns Listado de insumos de cauchera disponibles
 */
export function handleCaucheraQueryResponse(): string {
  let msg = `🛞 *Insumos y Materiales para Caucheras en Crastur* 🔧\n\n`;
  msg += `¡Sí! En *Crastur* distribuimos los mejores materiales e insumos para caucheras y llanteras en Caracas:\n\n`;
  msg += `• 🩹 *Parches para cauchos y tripas:* En frío y caliente, redondos y ovalados (todas las medidas).\n`;
  msg += `• 🧴 *Pega para parches:* Cemento químico azul y negro de alta adherencia.\n`;
  msg += `• 🔩 *Válvulas para cauchos:* Válvulas sin tripa TR414, TR413, válvulas de moto y metálicas.\n`;
  msg += `• 🪢 *Tarugos / mechas:* Para reparar pinchazos al instante.\n`;
  msg += `• ⚖️ *Plomos para balanceo:* Adhesivos para rines de aluminio y de pestaña para rines de hierro.\n`;
  msg += `• 🔧 *Herramientas de cauchera:* Agujas, terrajas, rodillos asentadores y manómetros medidores de presión.\n`;
  msg += `• 🧴 *Sellador de talón y pasta para montar cauchos.*\n\n`;
  msg += `👉 Indícanos qué insumo necesitas y te damos el precio con delivery a tu taller en Caracas.`;
  return msg;
}

/**
 * Responde sobre la acreditación de pagos digitales mediante Binance Pay (USDT).
 * 
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @returns Mensaje informativo de pagos con criptomonedas
 */
export function handleSocialResponse(pushName: string, settings: Record<string, string>): string {
  const instagram = String(settings?.instagram_url || '').trim();
  let msg = `📸 ¡Claro, *${pushName}*! Publicamos combos, novedades y promociones en nuestras redes.\n\n`;
  if (instagram) {
    msg += `👉 *Instagram:* ${instagram}\n\n`;
  }
  msg += `Si viste un combo o publicación y quieres el precio exacto, escribe *VENDEDOR* y un asesor te comparte el enlace y la cotización al instante.`;
  return msg;
}

/**
 * Informa sobre notas de entrega, facturación y presupuestos sellados.
 *
 * @returns Mensaje sobre documentos fiscales y cotizaciones
 */
export function handleInvoicingQueryResponse(): string {
  let msg = `📄 *Facturación y Presupuestos - Crastur* 💼✨\n\n`;
  msg += `¡Sí, con todo gusto!\n\n`;
  msg += `• Entregamos **nota de entrega / factura comercial** con todos los datos detallados de tu compra y garantía del producto.\n`;
  msg += `• Si necesitas una **cotización formal o presupuesto sellado** para tu cauchera, taller o control administrativo, te lo preparamos con validez de precio.\n\n`;
  msg += `👉 Escribe los productos que necesitas cotizar o escribe *VENDEDOR* para que un asesor te elabore el presupuesto formal.`;
  return msg;
}

/**
 * Provee el horario de apertura de la tienda física en Caracas.
 * 
 * @param settings - Configuración general
 * @returns Mensaje con días y horas de atención
 */
export function handleWarrantyResponse(): string {
  let msg = `🛡️ *Garantía y Políticas de Cambio en Crastur* 🛞🏍️\n\n`;
  msg += `• Todos nuestros repuestos e insumos nuevos cuentan con *garantía contra defectos de fábrica*.\n`;
  msg += `• Si necesitas realizar un cambio de pieza por compatibilidad con tu modelo de moto, lo realizamos en tienda presentando tu comprobante de compra (la pieza debe estar en su caja y en perfecto estado).\n`;
  msg += `• Para verificar que una pieza le sirva a tu moto antes de comprar, indícanos el modelo de tu moto o escribe *VENDEDOR* para hablar con nuestro equipo.`;
  return msg;
}

/**
 * Confirma disponibilidad general de stock en tienda física.
 * 
 * @returns Mensaje sobre existencia en almacén
 */
export function handleAvailabilityResponse(): string {
  let msg = `📦 *Disponibilidad en Tienda Física* 🛞🏍️✨\n\n`;
  msg += `¡Sí! Contamos con amplio inventario en tienda para entrega inmediata hoy mismo.\n\n`;
  msg += `👉 Escribe el nombre del producto o repuesto que buscas (ej: *"parches"*, *"pega"*, *"valvulas"*, *"kit de arrastre"*, *"bujia"*, *"refrigerante"*).\n`;
  msg += `👉 O indícanos el modelo de tu moto o el insumo que buscas y te confirmamos de inmediato.\n`;
  msg += `👉 También puedes apartarlo por 24 horas escribiendo *APARTAR*.`;
  return msg;
}

/**
 * Provee la ubicación física de la tienda con enlace a Google Maps para navegación GPS.
 * 
 * @param settings - Configuración general
 * @returns Mensaje con dirección física y enlace de mapa
 */
export function handleHowToBuyResponse(settings: Record<string, string>): string {
  let msg = `¡Con mucho gusto te explico! 😊 Comprar en *Crastur* es muy fácil:\n\n`;
  msg += `1️⃣ *Dime qué repuesto buscas.* Puedes escribir el nombre (ej. *"bujía"*, *"aceite 20w50"*, *"caucho"*) o responder con el número del menú.\n`;
  msg += `2️⃣ *Te doy el precio* en dólares y en bolívares a tasa BCV, y te confirmo disponibilidad.\n`;
  msg += `3️⃣ *Elige cómo recibirlo:*\n`;
  msg += `   🏢 *Retiro en tienda* en San Agustín Norte (sin costo).\n`;
  msg += `   🛵 *Delivery* en Caracas (motorizado).\n`;
  msg += `   ⏱️ *Apartado por 24h* sin costo: escribe *APARTAR* y te guardo la pieza.\n\n`;
  msg += `💳 Pagas en *Efectivo ($)*, *Binance Pay (USDT)*, *Pago Móvil* a tasa BCV o *Cashea* en tienda.\n\n`;
  msg += `👉 Escríbeme el repuesto que necesitas y empezamos. Si prefieres una persona, escribe *VENDEDOR*.`;
  return msg;
}

/**
 * Aclara educadamente que Crastur no comercializa repuestos internos pesados para automóviles de 4 ruedas.
 * 
 * @returns Mensaje delimitando el catálogo de motos y caucheras
 */
export function handleCarInquiryResponse(): string {
  let msg = `¡Hola! 👋 En *Crastur* nos especializamos exclusivamente en:\n\n`;
  msg += `1️⃣ 🛞 *Insumos para Caucheras* (parches, pegas, válvulas, mechas, plomos)\n`;
  msg += `2️⃣ 🏍️ *Repuestos y Accesorios para Moto* (kits de arrastre, frenos, bujías, aceites 4T, tripas)\n`;
  msg += `3️⃣ 📦 *Otros Productos* (aceites de motor, refrigerantes, aditivos, bombillos, plumillas)\n\n`;
  msg += `⚠️ No vendemos piezas internas pesadas de motor (como cigüeñales o cajas de velocidad). Pero si necesitas aceites, refrigerantes, bombillos o insumos de cauchera, ¡con mucho gusto estamos a tu orden!\n\n`;
  msg += `👉 Escribe lo que buscas o escribe *VENDEDOR* para hablar con nuestro equipo.`;
  return msg;
}

/**
 * Ofrece asistencia paciente y simplificada para usuarios mayores o poco familiarizados con asistentes virtuales.
 * 
 * @param pushName - Nombre del remitente
 * @param settings - Configuración general
 * @returns Mensaje de atención paciente con opción de asesor humano
 */
export function handleCategoryBrowseResponse(
  categoryName: string,
  settings: Record<string, string>,
  tasa: number,
  session: any,
  jid?: string
): string {
  const categoryEmojis: Record<string, string> = {
    'Insumos Cauchera': '🛞',
    'Repuestos Moto': '🏍️',
    'Accesorios Moto': '🪖',
    'Otros Productos': '📦'
  };

  const emoji = categoryEmojis[categoryName] || '📦';
  // [CONSISTENCIA] Inicial Cashea configurable desde el panel.
  const inicialPctCat = (parseFloat(settings.cashea_inicial_pct || '40') || 40) / 100;
  const cuotasCat = parseInt(settings.cashea_cuotas || '3', 10);
  // [AGRUPACIÓN CANÓNICA] Incluye productos guardados en subcategorías del panel
  // (ej. "Lubricantes & Fluidos - ..." o "Repuestos Moto - ...") dentro de su menú.
  const prods: any[] = getProductsByCanonicalCategory(categoryName);

  if (prods.length === 0) {
    let msg = `${emoji} *${categoryName} - Crastur* ✨\n\n`;
    msg += `En este momento estamos actualizando el inventario digital de *${categoryName}*.\n\n`;
    if (categoryName === 'Accesorios Moto') {
      msg += `Disponemos en tienda de puños, mallas porta-casco, retrovisores, luces LED, pulpos y spray para cadenas.\n\n`;
    }
    msg += `👉 Escribe el modelo o repuesto específico que necesitas para confirmarte existencia en almacén.\n`;
    msg += `👉 O escribe *VENDEDOR* para que nuestro equipo te cotice directamente. 👨‍🔧`;
    return msg;
  }

  // Guardar contexto en sesión para permitir selección posicional posterior
  if (jid) {
    const contextJson = JSON.stringify(prods.slice(0, 5).map(p => ({
      id: p.id,
      marca: p.marca,
      modelo: p.modelo,
      precio_usd: p.precio_usd,
      categoria: p.categoria
    })));
    try {
      db.prepare(`
        UPDATE chat_sessions
        SET ultimo_producto_id = ?,
            ultimo_producto_nombre = ?,
            contexto_productos = ?,
            seguimiento_enviado = 0
        WHERE jid = ?
      `).run(prods[0].id, `${prods[0].marca} ${prods[0].modelo}`, contextJson, jid);
    } catch {}
  }

  let msg = `${emoji} *Catálogo: ${categoryName} - Crastur* 🇻🇪\n\n`;
  msg += `Disponemos de los siguientes artículos para entrega inmediata:\n\n`;

  prods.forEach((p, idx) => {
    const precioUsd = parseFloat(p.precio_usd);
    const precioBs = precioUsd * tasa;
    msg += `*${idx + 1}. ${p.marca} - ${p.modelo}*\n`;
    if (p.descripcion) {
      msg += `   📝 ${p.descripcion}\n`;
    }
    msg += `   💵 Precio: *$${precioUsd.toFixed(2)} USD* _(🔥 ¡Descuento en divisas!)_\n`;
    msg += `   🇻🇪 En Bolívares: *Bs. ${formatBs(precioBs)}*\n`;
    if (precioUsd >= 25) {
      const n1 = precioUsd * inicialPctCat;
      msg += `   💛 Cashea: Inicial *$${n1.toFixed(2)} USD* + ${cuotasCat} cuotas\n`;
    }
    msg += `   📦 Stock: ${stockLabel(p, 'Disponible en tienda')}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 *Opciones:*\n`;
  msg += `👉 Responde con el *número* (ej: *1*) para ver ficha detallada y fotos.\n`;
  msg += `👉 Escribe *PDF* para recibir este catálogo oficial en PDF 📄.\n`;
  msg += `👉 Escribe *APARTAR* para reservar un producto por 24h sin costo.\n`;
  msg += `👉 Escribe *DELIVERY* para cotizar envío en moto en Caracas 🛵.\n`;
  msg += `👉 Escribe *VENDEDOR* para hablar con nuestro mostrador.`;

  return msg;
}

/**
 * Responde cuando el cliente pregunta el precio sin decir qué repuesto busca.
 * Evita caer en el fallback genérico y le guía con ejemplos concretos.
 *
 * @param settings - Configuración general de la tienda
 * @returns Mensaje pidiendo el repuesto a cotizar
 */
export function handlePriceInquiryResponse(settings: Record<string, string>): string {
  let msg = `💵 *¡Con gusto te cotizamos!* 🛞🏍️\n\n`;
  msg += `Dime *qué repuesto o insumo* necesitas y te doy el precio en *dólares* y en *bolívares* al instante.\n\n`;
  msg += `📌 *Ejemplos:* *"bujía NGK"*, *"aceite 20w50"*, *"pastillas de freno Bera"*, *"kit de arrastre SBR"* o *"parches"*.\n\n`;
  msg += `👉 Escríbeme el nombre del repuesto o el modelo de tu moto y lo busco de una vez.`;
  return msg;
}

/**
 * Responde consultas de compra por volumen / para negocios (caucheras, llanteras, talleres).
 *
 * @param settings - Configuración general de la tienda
 * @returns Mensaje orientando a cotizar según cantidades
 */
export function handleWholesaleResponse(settings: Record<string, string>): string {
  let msg = `📦 *Compras para Negocios y por Cantidad - Crastur* 🛞🏍️\n\n`;
  msg += `¡Con gusto atendemos a *caucheras, llanteras, talleres y comercios*! 🧑‍🔧\n\n`;
  msg += `📝 Cuéntanos *qué insumo o repuesto* necesitas y *cuántas unidades*, y cotizamos según la cantidad.\n\n`;
  msg += `👉 Escribe la lista con cantidades (ej: *"50 parches"*, *"20 válvulas TR414"*) o escribe *VENDEDOR* para que un asesor te prepare la cotización.`;
  return msg;
}

