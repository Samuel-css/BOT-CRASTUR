/**
 * @file run_copy_budget_tests.ts
 * @description Vigila que los mensajes del bot se mantengan cortos y legibles.
 *
 * Reglas:
 * - Promedio <= 320 caracteres y <= 7 líneas.
 * - Ninguna respuesta normal supera 600 caracteres ni 10 líneas.
 * - La bienvenida dice "asistente virtual" y ofrece "Asesor".
 * - El ticket de apartado no incluye el párrafo legal y cabe en 10 líneas.
 *
 * Se ejecuta sobre una base temporal (CRASTUR_DATA_DIR) para no tocar producción.
 */

import db, { whenReady } from '../server/database';
import { processIncomingMessage } from '../server/bot';
import { DEMO_CATALOG } from './cargar_catalogo_demo';
import {
  asText,
  measureCopy,
  COPY_LIMITS,
  buildTicket
} from '../server/bot/copy/messages';

interface ResultRow {
  query: string;
  chars: number;
  lines: number;
  text: string;
}

const CONSULTAS = [
  'hola',
  'pastillas de freno',
  'aceite 20w50',
  'kit de arrastre',
  'cuanto cuesta',
  'binance',
  'formas de pago',
  'delivery a chacao',
  'horario',
  'donde estan ubicados',
  'garantia',
  'tienen combos',
  'quiero apartar',
  '1',
  '2',
  '3',
  '4',
  'menu',
  'vendedor',
  'eres un bot',
  'gracias',
  'no',
  'si',
  'parches',
  'valvulas',
  'bujia',
  'transfiero por pago movil',
  'aceptan zelle',
  'hacen instalacion',
  'tienen para carro',
  'compras al mayor',
  'como comprar',
  'envio a maracaibo',
  'abren los domingos',
  'tienen punto de venta',
  'descuento en dolares',
  'cashea',
  'tasa bcv',
  'garantia de fabrica',
  'calidad de los repuestos'
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASÓ] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FALLÓ] ${name}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function main() {
  await whenReady();

  // Catálogo de demostración para que las listas y búsquedas tengan contenido.
  const findStmt = db.db.prepare('SELECT id FROM products WHERE LOWER(TRIM(marca)) = LOWER(TRIM(?)) AND LOWER(TRIM(modelo)) = LOWER(TRIM(?)) LIMIT 1');
  const insertStmt = db.db.prepare('INSERT INTO products (marca, modelo, categoria, precio_usd, descripcion, stock, activo) VALUES (?, ?, ?, ?, ?, ?, 1)');
  for (const p of DEMO_CATALOG) {
    if (!findStmt.get(p.marca, p.modelo)) {
      insertStmt.run(p.marca, p.modelo, p.categoria, p.precio_usd, p.descripcion, p.stock);
    }
  }
  db.updateSetting('metodos_pago', 'Efectivo $, Binance Pay (USDT), Pago Móvil BCV, Cashea en Tienda, Punto de Venta, Transferencia Bancaria');
  db.updateSetting('bot_pausado_global', '0');
  db.persistDB();

  const results: ResultRow[] = [];
  for (let i = 0; i < CONSULTAS.length; i++) {
    const query = CONSULTAS[i];
    const jid = `58416000${String(i).padStart(4, '0')}@s.whatsapp.net`;
    let response: any = processIncomingMessage(jid, query, 'Carlos');
    if (response && typeof response.then === 'function') response = await response;
    const text = asText(response);
    const measured = measureCopy(text);
    results.push({ query, chars: measured.chars, lines: measured.lines, text });
  }

  const avgChars = results.reduce((sum, r) => sum + r.chars, 0) / results.length;
  const avgLines = results.reduce((sum, r) => sum + r.lines, 0) / results.length;

  console.log('\n=== RANKING DE LONGITUD ===');
  [...results].sort((a, b) => b.chars - a.chars).forEach(r => {
    console.log(`${String(r.chars).padStart(5)} chars | ${String(r.lines).padStart(2)} líneas | ${r.query}`);
  });

  console.log('\n=== REGLAS DE COPY ===');
  console.log(`Promedio actual: ${avgChars.toFixed(0)} caracteres / ${avgLines.toFixed(1)} líneas por respuesta.`);
  assert(avgChars <= COPY_LIMITS.averageChars, `Promedio de caracteres <= ${COPY_LIMITS.averageChars}`, `actual: ${avgChars.toFixed(0)}`);
  assert(avgLines <= COPY_LIMITS.averageLines, `Promedio de líneas <= ${COPY_LIMITS.averageLines}`, `actual: ${avgLines.toFixed(1)}`);

  const overLimit = results.filter(r => r.chars > 600 || r.lines > 10);
  assert(overLimit.length === 0, 'Ninguna respuesta supera 600 caracteres ni 10 líneas', overLimit.map(r => `${r.query}: ${r.chars}/${r.lines}`).join(', '));

  const welcome = results.find(r => r.query === 'hola')?.text || '';
  assert(/asistente virtual|bot/i.test(welcome), 'La bienvenida aclara que es un asistente virtual');
  assert(/asesor|persona/i.test(welcome), 'La bienvenida ofrece hablar con una persona');

  const identity = results.find(r => r.query === 'eres un bot')?.text || '';
  assert(/asistente virtual|bot/i.test(identity), 'Responde con honestidad cuando preguntan si es un bot');
  assert(/asesor|persona/i.test(identity), 'Ofrece una persona cuando preguntan si es un bot');

  const category = results.find(r => r.query === '1')?.text || '';
  const categoryLines = measureCopy(category).lines;
  assert(categoryLines <= 10, 'La lista de categoría cabe en 10 líneas', `actual: ${categoryLines}`);

  const legalLeak = results.some(r => /CRBV|Delitos Informáticos|Art\. 28/i.test(r.text));
  assert(!legalLeak, 'Ningún mensaje automático incluye el párrafo legal del ticket');

  // [DETALLE] Después de una búsqueda, el cliente puede pedir la ficha sin repetir el nombre.
  const jidDetalle = '584160009999@s.whatsapp.net';
  processIncomingMessage(jidDetalle, 'pastillas de freno', 'Carlos');
  const detalle = asText(processIncomingMessage(jidDetalle, 'detalle', 'Carlos'));
  const detalleMeasure = measureCopy(detalle);
  assert(/pastillas/i.test(detalle) && /precio/i.test(detalle), 'El comando DETALLE muestra la ficha del último producto');
  assert(detalleMeasure.chars <= 600 && detalleMeasure.lines <= 10, 'La ficha de detalle se mantiene corta', `${detalleMeasure.chars}/${detalleMeasure.lines}`);

  // Ticket: se prueba el constructor directo para no depender de todo el flujo.
  const ticket = buildTicket({
    reservation: { id: 42, expira_en: Date.now() + 24 * 60 * 60 * 1000 },
    nombre: 'Carlos Pérez',
    telefono: '0412 123 4567',
    cedula: 'V-18456789',
    productName: 'Kit de Arrastre 428H Bera SBR',
    priceUsd: 28,
    tasa: 914.0218,
    settings: { direccion_tienda: 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas', google_maps_url: 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA' },
    items: [{ nombre: 'Kit de Arrastre 428H Bera SBR' }],
    expiraEn: Date.now() + 24 * 60 * 60 * 1000
  });
  const ticketMeasure = measureCopy(ticket);
  console.log('\n--- TICKET DE APARTADO ---\n' + ticket + '\n');
  assert(ticketMeasure.lines <= COPY_LIMITS.ticketLines, `El ticket cabe en ${COPY_LIMITS.ticketLines} líneas`, `actual: ${ticketMeasure.lines}`);
  assert(ticketMeasure.chars <= COPY_LIMITS.ticketChars, `El ticket no supera ${COPY_LIMITS.ticketChars} caracteres`, `actual: ${ticketMeasure.chars}`);
  assert(!/CRBV|Delitos Informáticos|Art\. 28/i.test(ticket), 'El ticket no lleva el párrafo legal');
  assert(/CRA-0042/.test(ticket) && /24 HORAS/.test(ticket), 'El ticket conserva el código y el plazo de 24 HORAS');

  console.log('\n================================================================');
  console.log(`🏁 RESULTADO COPY: ${passed} PASADAS | ${failed} FALLIDAS`);
  console.log('================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[Copy Budget] Error:', err);
  process.exit(1);
});
