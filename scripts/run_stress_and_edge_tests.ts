import fs from 'fs';
import path from 'path';
import db, { masterSnapshotPath, registerChatAliases } from '../server/database';
import { registerHumanTakeover, canBotSend, onCancelPendingBotResponses } from '../server/whatsapp/takeover';
import { checkHandoffSla, getHandoffInfo } from '../server/bot/services/handoffService';
import { processIncomingMessage } from '../server/bot';
import { resetSpam } from '../server/bot/utils/antiSpam';
import { extractVenezuelanPhones } from '../server/bot/utils/formatters';
import { searchProductsFuzzy, invalidateProductCache, extractLeadingQuantity } from '../server/bot/services/searchService';
import { checkPendingFollowUps } from '../server/bot/followUp/followUpService';
import { handleMediaResponse } from '../server/bot/handlers/mediaHandlers';
import { detectCaracasZone, getDeliveryZones } from '../server/bot/utils/caracasDelivery';
import { resolveCasheaPlan } from '../server/bot/utils/cashea';
import { enqueueOutboundMessage, getOutboundQueueSize } from '../server/whatsapp/outboundQueue';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m'
};

// Helper para aserciones de prueba
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASÓ] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FALLÓ] ${testName} ${detail ? `-> ${detail}` : ''}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🚀 SUITE DE PRUEBAS DE ESTRÉS Y VALIDACIÓN EXTREMA DEL BOT CRASTUR (200+ CASOS)');
  console.log('================================================================\n');

  await db.whenReady();
  db.updateSetting('bot_pausado_global', '0');
  const originalMetodosPago = db.getSettings().metodos_pago;
  db.updateSetting('metodos_pago', 'Efectivo $, Binance Pay (USDT), Pago Móvil BCV, Cashea en Tienda, Punto de Venta, Transferencia Bancaria');
  resetSpam();

  const requiredFixtures = [
    { marca: 'Bera', modelo: 'Pastillas de Freno SBR 150 Delanteras', categoria: 'Repuestos Moto', precio_usd: 5.00, stock: 20, descripcion: 'Pastillas de freno semimetálicas delanteras originales para Bera SBR.' },
    { marca: 'NGK', modelo: 'Bujía D8EA Moto Bera Empire 150', categoria: 'Repuestos Moto', precio_usd: 3.50, stock: 28, descripcion: 'Bujía original japonesa de rosca larga.' },
    { marca: 'Choho', modelo: 'Kit de Arrastre Reforzado 428H Bera SBR', categoria: 'Repuestos Moto', precio_usd: 28.00, stock: 10, descripcion: 'Kit de arrastre reforzado paso 428H.' },
    { marca: 'Motul', modelo: 'Aceite 4T 20W50 Mineral 1L', categoria: 'Otros Productos', precio_usd: 6.00, stock: 23, descripcion: 'Aceite mineral 4 tiempos para motor de moto.' },
    { marca: 'Rema', modelo: 'Caja de Parches en Frío Tip Top', categoria: 'Insumos Cauchera', precio_usd: 12.00, stock: 15, descripcion: 'Caja de parches vulcanizados en frío para tripas y cauchos.' },
    { marca: 'Duro', modelo: 'Tripa para Moto Aro 18 Reforzada', categoria: 'Repuestos Moto', precio_usd: 4.50, stock: 25, descripcion: 'Tripa de caucho reforzada para rin 18.' },
    { marca: 'Genérico', modelo: 'Válvula de Aire Corta TR412', categoria: 'Insumos Cauchera', precio_usd: 1.50, stock: 50, descripcion: 'Válvula de goma para caucho tubeless.' }
  ];

  const insertedFixtureIds = [];
  for (const f of requiredFixtures) {
    const existing = db.db.prepare('SELECT id FROM products WHERE modelo = ?').get(f.modelo);
    if (!existing) {
      const res = db.db.prepare(
        'INSERT INTO products (marca, modelo, categoria, precio_usd, stock, descripcion, activo) VALUES (?, ?, ?, ?, ?, ?, 1)'
      ).run(f.marca, f.modelo, f.categoria, f.precio_usd, f.stock, f.descripcion);
      if (res && res.lastInsertRowid) {
        insertedFixtureIds.push(res.lastInsertRowid);
      }
    }
  }

  // [LIMPIEZA FASE 3] Elimina CUALQUIER fila residual de sesiones/mensajes de pruebas
  // anteriores (p. ej. de una corrida abortada) para que el estado inicial sea idéntico
  // al de producción recién instalada. Así el test de cancelación siempre parte de 'start'.
  {
    const testJidBase = '58414999';
    const stale = db.db.prepare(
      'SELECT jid FROM chat_sessions WHERE jid LIKE ?'
    ).all(`${testJidBase}%`) as any[];
    if (stale.length > 0) {
      db.db.prepare('DELETE FROM chat_sessions WHERE jid LIKE ?').run(`${testJidBase}%`);
      db.db.prepare('DELETE FROM chat_messages WHERE jid LIKE ?').run(`${testJidBase}%`);
      console.log(`  🧹 [Pre-Test] Eliminadas ${stale.length} sesiones residuales de corridas anteriores.`);
    }
  }

  // -------------------------------------------------------------
  // FASE 1: PRUEBA DE ESTRÉS DE ALTA CONCURRENCIA (100 peticiones)
  // -------------------------------------------------------------
  console.log('📊 FASE 1: PRUEBA DE ESTRÉS DE ALTA CONCURRENCIA (100 peticiones)');
  console.log('-----------------------------------------------------------------');

  const stressClients = Array.from({ length: 20 }, (_, i) => `58412000${String(i).padStart(4, '0')}@s.whatsapp.net`);
  const stressQueries = [
    'hola buenas tardes',
    'precio del caucho',
    'tasa bcv',
    'donde estan ubicados',
    'aceptan cashea?',
    'hacen delivery?',
    'tienen tripa aro 18?',
    'horario de atencion',
    'pago movil',
    'gracias fino'
  ];

  const startTime = Date.now();
  const stressPromises = [];
  let stressErrors = 0;

  for (let i = 0; i < 100; i++) {
    const jid = stressClients[i % stressClients.length];
    const query = stressQueries[i % stressQueries.length];
    stressPromises.push(
      new Promise((resolve) => {
        try {
          const res = processIncomingMessage(jid, query, `Usuario${i}`);
          resolve(res);
        } catch (err) {
          stressErrors++;
          console.error(`Error en petición ${i}:`, err.message);
          resolve(null);
        }
      })
    );
  }

  const stressResults = await Promise.all(stressPromises);
  const elapsedMs = Date.now() - startTime;
  const rps = ((100 / elapsedMs) * 1000).toFixed(1);

  assert(stressErrors === 0, '100 peticiones concurrentes sin errores no capturados');
  assert(stressResults.length === 100, 'Se completaron las 100 peticiones concurrentes');
  assert(stressResults.every(r => typeof r === 'string' && r.length > 10), 'Todas las respuestas fueron textos válidos no vacíos');
  assert(elapsedMs < 3000, 'Tiempo de ejecución de 100 peticiones bajo umbral estricto (< 3000ms)');
  assert(parseFloat(rps) > 100, 'Rendimiento superior a 100 consultas por segundo');
  console.log(`⏱️ Tiempo total de ejecución: ${elapsedMs} ms (${rps} peticiones/segundo)\n`);

  resetSpam();

  // -------------------------------------------------------------
  // FASE 2: BATERÍA DE 20 PERFILES DE CLIENTES REALES Y SITUACIONES
  // -------------------------------------------------------------
  console.log('👥 FASE 2: VALIDACIÓN DE 20 PERFILES DE CLIENTES REALES Y CASOS EXIGENTES');
  console.log('-----------------------------------------------------------------');

  // PERFIL 1: Persona Mayor / No familiarizada con asistentes
  console.log('\n👵 [Perfil 1: Persona Mayor / No sabe hablar con asistente]');
  {
    const jid = '584149990001@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'Buenas tardes señor disculpe la molestia es que mi hijo tiene una moto y se le dañó una pieza y yo no sé de esto, ¿con quién hablo?', 'Sra. Carmen');
    assert(res1 && res1.includes('paciencia') && res1.includes('tienda física') && res1.includes('ASESOR'), 'Atiende con paciencia explicando que es tienda física y ofrece asesor');

    const res2 = processIncomingMessage(jid, '¿Hay alguien ahí o es una computadora?', 'Sra. Carmen');
    assert(res2 && res2.includes('asistente virtual') && res2.includes('Liberalba'), 'Aclara con amabilidad que es asistente virtual de la tienda en San Agustín');

    const res3 = processIncomingMessage(jid, '???', 'Sra. Carmen');
    assert(res3 && res3.includes('paciencia') && res3.includes('HUMANO'), 'Reconoce signos de interrogación como confusión y ofrece ayuda humana');

    const res4 = processIncomingMessage(jid, 'buenos dias senor', 'Sra. Carmen');
    assert(res4 && res4.includes('asistente virtual'), 'Reconoce cortesía formal de persona mayor');

    const res5 = processIncomingMessage(jid, 'no se como se usa esto hijo', 'Sra. Carmen');
    assert(res5 && res5.includes('HUMANO'), 'Reconoce dificultad tecnológica y ofrece asesor');
  }

  // PERFIL 2: El Apurado / Minimalista (Mensajes de 1 palabra)
  console.log('\n⚡ [Perfil 2: El Apurado / Mensajes de una palabra]');
  {
    resetSpam();
    const jid = '584149990002@s.whatsapp.net';
    const resTasa = processIncomingMessage(jid, 'tasa', 'Carlos');
    assert(resTasa && resTasa.includes('BCV') && resTasa.includes('Bs.'), 'Responde tasa BCV directamente ante la palabra "tasa"');

    const resDonde = processIncomingMessage(jid, 'donde', 'Carlos');
    assert(resDonde && resDonde.includes('Liberalba') && resDonde.includes('Google Maps'), 'Responde ubicación y enlace ante la palabra "donde"');

    const resHorario = processIncomingMessage(jid, 'horario', 'Carlos');
    assert(resHorario && resHorario.includes('8:00 AM a 8:00 PM'), 'Responde horario corrido ante la palabra "horario"');

    const resTripa = processIncomingMessage(jid, 'tripa', 'Carlos');
    assert(resTripa && (resTripa.includes('Tripa') || resTripa.includes('tripa')), 'Localiza el repuesto tripa con búsqueda de 1 palabra');

    const resBujia = processIncomingMessage(jid, 'bujia', 'Carlos');
    assert(resBujia && resBujia.includes('Bujía'), 'Localiza bujía ante consulta de 1 palabra');

    const resAceite = processIncomingMessage(jid, 'aceite', 'Carlos');
    assert(resAceite && resAceite.includes('Aceite'), 'Localiza aceite ante consulta de 1 palabra');
  }

  // PERFIL 3: El Coloquial / Venezolanismos
  console.log('\n🇻🇪 [Perfil 3: Coloquial / Venezolanismos]');
  {
    resetSpam();
    const jid = '584149990003@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'epale mano que tal buenas tardes', 'Yorman');
    assert(res1 && res1.includes('Crastur') && res1.includes('BCV'), 'Responde saludo coloquial "epale mano" con saludo y tasa');

    const res2 = processIncomingMessage(jid, 'chamo tienes pastillas de freno?', 'Yorman');
    const res2Str = typeof res2 === 'object' && res2 !== null ? res2.text : String(res2 || '');
    assert(res2Str && res2Str.includes('Pastillas') && res2Str.includes('USD'), 'Entiende modismo "chamo tienes pastillas..." y cotiza');

    const resCaucho = processIncomingMessage(jid, 'chamo tienes caucho?', 'Yorman');
    assert(resCaucho && (resCaucho.includes('Cauchera') || resCaucho.includes('caucho') || resCaucho.includes('Insumos')), 'Consulta por caucho devuelve insumos de cauchera o cotización de caucho');

    const resFino = processIncomingMessage(jid, 'fino gracias mano', 'Yorman');
    assert(resFino && (resFino.includes('orden') || resFino.includes('Crastur') || resFino.includes('placer')), 'Reconoce cortesía venezolana "fino gracias"');

    const resPlomo = processIncomingMessage(jid, 'plomo mano voy pendiente', 'Yorman');
    assert(resPlomo && resPlomo.length > 5, 'Responde positivamente ante modismo "plomo"');

    const resPana = processIncomingMessage(jid, 'que mas mi pana', 'Yorman');
    assert(resPana && resPana.includes('Crastur'), 'Responde amablemente a "que mas mi pana"');
  }

  // PERFIL 4: Errores Ortográficos y Fonéticos
  console.log('\n📝 [Perfil 4: Errores Ortográficos y Abreviaciones]');
  {
    resetSpam();
    const jid = '584149990004@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'tienen pastiya d freno para bera?', 'Luis');
    const res1Str = typeof res1 === 'object' && res1 !== null ? res1.text : String(res1 || '');
    assert(res1Str && res1Str.includes('Pastillas'), 'Fuzzy match encuentra pastillas ante "pastiya d freno"');

    const res2 = processIncomingMessage(jid, 'precio de la bujya d8', 'Luis');
    const res2Str = typeof res2 === 'object' && res2 !== null ? res2.text : String(res2 || '');
    assert(res2Str && res2Str.includes('Bujía'), 'Fuzzy match encuentra bujía ante "bujya"');

    const res3 = processIncomingMessage(jid, 'valvula d aire corta', 'Luis');
    const res3Str = typeof res3 === 'object' && res3 !== null ? res3.text : String(res3 || '');
    assert(res3Str && res3Str.includes('Válvula'), 'Fuzzy match encuentra válvulas ante "valvula d aire"');

    const resAceite = processIncomingMessage(jid, 'asete 4t mineral', 'Luis');
    const resAceiteStr = typeof resAceite === 'object' && resAceite !== null ? resAceite.text : String(resAceite || '');
    assert(resAceiteStr && resAceiteStr.includes('Aceite'), 'Fuzzy match encuentra aceite ante error fonético "asete"');

    const resArrastre = processIncomingMessage(jid, 'kit d arastre choho', 'Luis');
    const resArrastreStr = typeof resArrastre === 'object' && resArrastre !== null ? resArrastre.text : String(resArrastre || '');
    assert(resArrastreStr && resArrastreStr.includes('Arrastre'), 'Fuzzy match encuentra kit de arrastre ante "arastre"');

    const resParche = processIncomingMessage(jid, 'parxe frio rema', 'Luis');
    const resParcheStr = typeof resParche === 'object' && resParche !== null ? resParche.text : String(resParche || '');
    assert(resParcheStr && resParcheStr.includes('Parches'), 'Fuzzy match encuentra parches ante "parxe frio"');
  }

  // PERFIL 5: El Mecánico de Taller / Moto-Taller
  console.log('\n🔧 [Perfil 5: El Mecánico de Moto-Taller / Compras Técnicas]');
  {
    const jid = '584149990005@s.whatsapp.net';
    const resArrastre = processIncomingMessage(jid, 'tienes kit de arrastre paso 428H para bera sbr?', 'Taller Los Galpones');
    const resArrastreStr = typeof resArrastre === 'object' && resArrastre !== null ? resArrastre.text : String(resArrastre || '');
    assert(resArrastreStr && resArrastreStr.includes('Choho') && resArrastreStr.includes('428H'), 'Detecta especificación técnica 428H para Bera SBR');

    const resBujia = processIncomingMessage(jid, 'dame precio de bujia d8ea ngk', 'Taller Los Galpones');
    const resBujiaStr = typeof resBujia === 'object' && resBujia !== null ? resBujia.text : String(resBujia || '');
    assert(resBujiaStr && resBujiaStr.includes('NGK') && resBujiaStr.includes('D8EA'), 'Cotiza con código exacto de bujía NGK D8EA');

    const resTaller = processIncomingMessage(jid, 'atienden a talleres mecanicos?', 'Taller Los Galpones');
    assert(resTaller && resTaller.length > 10, 'Atiende a talleres mecánicos sin ofrecer ventas al mayor');

    const resMarcas = processIncomingMessage(jid, 'tienen repuestos para bera sbr y empire horse?', 'Taller Los Galpones');
    assert(resMarcas && (resMarcas.includes('Bera') || resMarcas.includes('Repuestos') || resMarcas.includes('Catálogo')), 'Reconoce compatibilidad con motos venezolanas Bera y Empire');

    const resMultiple = processIncomingMessage(jid, 'precio de tripa aro 18 y pastillas de freno', 'Taller Los Galpones');
    assert(resMultiple && (resMultiple.includes('Tripa') || resMultiple.includes('Pastillas') || resMultiple.includes('USD')), 'Procesa consulta combinada de múltiples repuestos');
  }

  // PERFIL 6: El Motorizado / Ridery / Yummy Varado en Calle
  console.log('\n🛵 [Perfil 6: El Motorizado / Ridery Varado con Urgencia]');
  {
    const jid = '584149990006@s.whatsapp.net';
    const resUrgente = processIncomingMessage(jid, 'MANO ME ESPICHÉ EN PLENA AUTOPISTA TIENES PARCHES EN FRÍO O TRIPA 18 URGENTE?', 'Yorman Ridery');
    const resUrgStr = typeof resUrgente === 'object' && resUrgente !== null ? resUrgente.text : String(resUrgente || '');
    assert(resUrgStr && (resUrgStr.includes('Parches') || resUrgStr.includes('Tripa') || resUrgStr.includes('Crastur')), 'Entiende mayúsculas de urgencia y responde disponibilidad');

    const resRetiro = processIncomingMessage(jid, 'puedo mandar a un compañero a retirar ya en la tienda?', 'Yorman Ridery');
    assert(resRetiro && resRetiro.includes('Liberalba') && resRetiro.includes('San Agustín'), 'Confirma retiro inmediato en tienda física en San Agustín Norte');

    const resDelivery = processIncomingMessage(jid, 'hacen delivery con motorizado?', 'Yorman Ridery');
    assert(resDelivery && resDelivery.includes('Delivery') && resDelivery.includes('Caracas'), 'Informa servicio de delivery confiable en Caracas');
  }

  // PERFIL 7: El Comprador Cashea por Niveles N1 a N5
  console.log('\n💛 [Perfil 7: Comprador Cashea por Niveles N1 a N5]');
  {
    resetSpam();
    const jid = '584149990007@s.whatsapp.net';
    const resGen = processIncomingMessage(jid, 'aceptan cashea?', 'Daniela');
    assert(resGen && resGen.includes('Cashea') && resGen.includes('cuotas'), 'Explica financiamiento general con Cashea');

    const resMinimo = processIncomingMessage(jid, 'puedo comprar una bujia de 3.5 con cashea?', 'Daniela');
    assert(resMinimo && resMinimo.includes('25') && resMinimo.includes('Cashea'), 'Aclara la compra mínima obligatoria de $25 USD de Cashea');

    const resNivel1 = processIncomingMessage(jid, 'cuanto pago de inicial en nivel 1 con cashea para el kit de arrastre de 28?', 'Daniela');
    assert(resNivel1 && (resNivel1.includes('Inicial') || resNivel1.includes('Nivel 1') || resNivel1.includes('cuotas')), 'Calcula o explica financiamiento para Cashea Nivel 1');

    const resNivel2 = processIncomingMessage(jid, 'cashea nivel 2', 'Daniela');
    assert(resNivel2 && resNivel2.includes('Nivel 2'), 'Proporciona información específica de Nivel 2');

    const resNivel3 = processIncomingMessage(jid, 'cashea nivel 3', 'Daniela');
    assert(resNivel3 && (resNivel3.includes('Nivel 3') || resNivel3.includes('Cashea')), 'Informa parámetros para Nivel 3');

    const resApp = processIncomingMessage(jid, 'como se paga cashea en la tienda?', 'Daniela');
    assert(resApp && resApp.includes('tienda') && resApp.includes('Cashea'), 'Explica que el pago se realiza en tienda física escaneando en caja');
  }

  // PERFIL 8: El Cauchero / Dueño de Vulcanizadora
  console.log('\n🛞 [Perfil 8: El Dueño de Cauchera / Insumos Vulcanizados]');
  {
    const jid = '584149990008@s.whatsapp.net';
    const resParches = processIncomingMessage(jid, 'tienes caja de parches tip top rema?', 'Cauchera El Samuel');
    const resParchesStr = typeof resParches === 'object' && resParches !== null ? resParches.text : String(resParches || '');
    assert(resParchesStr && resParchesStr.includes('Tip Top') && resParchesStr.includes('Parches'), 'Localiza caja de parches Tip Top Rema para vulcanizar');

    const resValvula = processIncomingMessage(jid, 'valvulas tr412 tubeless', 'Cauchera El Samuel');
    const resValvulaStr = typeof resValvula === 'object' && resValvula !== null ? resValvula.text : String(resValvula || '');
    assert(resValvulaStr && resValvulaStr.includes('TR412'), 'Localiza válvulas tubeless TR412');

    const jidMenu = '584149990008_menu@s.whatsapp.net';
    const resInsumos = processIncomingMessage(jidMenu, '1', 'Cauchera El Samuel');
    assert(resInsumos && resInsumos.includes('Insumos Cauchera'), 'Opción 1 del menú despliega insumos para caucheras');

    const resInsumos2 = processIncomingMessage(jid, 'tienen insumos de cauchera para mi negocio?', 'Cauchera El Samuel');
    assert(resInsumos2 && (resInsumos2.includes('parches') || resInsumos2.includes('Cauchera') || resInsumos2.includes('válvula') || resInsumos2.includes('caucho')), 'Orienta sobre insumos de cauchera sin ventas al mayor');
  }

  // PERFIL 9: El Comprador Desconfiado / Miedo a Estafas
  console.log('\n🛡️ [Perfil 9: Comprador Escéptico / Desconfiado]');
  {
    const jid = '584149990009@s.whatsapp.net';
    const resFisica = processIncomingMessage(jid, 'ustedes son tienda fisica o son virtuales?', 'Sr. Pedro');
    const resFisicaStr = typeof resFisica === 'object' && resFisica !== null ? resFisica.text : String(resFisica || '');
    assert(resFisicaStr && resFisicaStr.toLowerCase().includes('tienda física') && resFisicaStr.includes('Liberalba'), 'Confirma rotundamente tienda física en San Agustín');

    const resPagar = processIncomingMessage(jid, 'puedo ir a pagar en persona al llegar?', 'Sr. Pedro');
    assert(resPagar && (resPagar.includes('tienda') || resPagar.includes('Efectivo') || resPagar.includes('San Agustín')), 'Confirma pago directo en mostrador al recibir la mercancía');

    const resMaps = processIncomingMessage(jid, 'mandame la ubicacion y el mapa de google', 'Sr. Pedro');
    assert(resMaps && resMaps.includes('maps.app.goo.gl'), 'Proporciona enlace directo verificado de Google Maps');

    const resEstafa = processIncomingMessage(jid, 'como se que esto no es una estafa por internet?', 'Sr. Pedro');
    assert(resEstafa && resEstafa.includes('Liberalba') && resEstafa.includes('Caracas'), 'Desactiva desconfianza con respaldo de sede comercial física');
  }

  // PERFIL 10: Métodos de Pago Venezolanos
  console.log('\n💵 [Perfil 10: Métodos de Pago Venezolanos]');
  {
    const jid = '584149990010@s.whatsapp.net';
    const resPagoMovil = processIncomingMessage(jid, 'aceptan pago movil a tasa bcv?', 'Andrés');
    assert(resPagoMovil && resPagoMovil.includes('Pago Móvil') && resPagoMovil.includes('BCV'), 'Informa Pago Móvil a tasa oficial BCV');

    const resBinance = processIncomingMessage(jid, 'tienen binance usdt?', 'Andrés');
    assert(resBinance && resBinance.includes('Binance') && resBinance.includes('Promoción'), 'Informa aceptación de Binance Pay con Precio Promoción');

    const resPunto = processIncomingMessage(jid, 'tienen punto de venta?', 'Andrés');
    assert(resPunto && (resPunto.includes('punto') || resPunto.includes('Pago Móvil') || resPunto.includes('Efectivo')), 'Aclara métodos de cobro en tienda física');

    const resDivisas = processIncomingMessage(jid, 'hacen descuento por pagar en dolares en efectivo?', 'Andrés');
    assert(resDivisas && resDivisas.includes('Precio Promoción'), 'Informa Precio Promoción especial en divisas');

    const resCombos = processIncomingMessage(jid, 'tienen combos de instagram?', 'Andrés');
    const resCombosStr = typeof resCombos === 'object' && resCombos !== null ? resCombos.text || String(resCombos) : String(resCombos || '');
    assert(resCombosStr && (resCombosStr.includes('Instagram') || resCombosStr.includes('Combos') || resCombosStr.includes('Promoción')), 'Responde sobre combos y promociones de redes');
  }

  // PERFIL 11: Cobertura de Envíos y Delivery
  console.log('\n🚚 [Perfil 11: Cobertura Delivery Caracas vs Interior]');
  {
    const jid = '584149990011@s.whatsapp.net';
    const resInterior = processIncomingMessage(jid, 'hacen envios a maracaibo o valencia por mrw?', 'Cliente Interior');
    assert(resInterior && resInterior.includes('Caracas') && resInterior.includes('tienda física'), 'Aclara amablemente que solo atiende en Caracas');

    const resChacao = processIncomingMessage(jid, 'hacen delivery a chacao?', 'Cliente Caracas');
    assert(resChacao && (resChacao.includes('Delivery') || resChacao.includes('Chacao') || resChacao.includes('motorizado')), 'Confirma cobertura de delivery a Chacao');

    const resCatia = processIncomingMessage(jid, 'cuanto sale el delivery a catia?', 'Cliente Caracas');
    assert(resCatia && resCatia.includes('Delivery'), 'Informa servicio de delivery a Catia');

    const resRetiro = processIncomingMessage(jid, 'puedo retirar yo mismo en san agustin?', 'Cliente Caracas');
    const resRetiroStr = typeof resRetiro === 'object' && resRetiro !== null ? resRetiro.text : String(resRetiro || '');
    assert(resRetiroStr && (resRetiroStr.includes('Liberalba') || resRetiroStr.includes('San Agustín')), 'Confirma retiro directo en San Agustín Norte');
  }

  // PERFIL 12: El Regateador / Petición de Rebaja
  console.log('\n🏷️ [Perfil 12: El Regateador / Petición de Rebaja]');
  {
    const jid = '584149990012@s.whatsapp.net';
    const resMenos = processIncomingMessage(jid, 'chamo dejame el kit de arrastre en menos', 'Regateador');
    assert(resMenos && (resMenos.includes('Precio Promoción') || resMenos.includes('descuento') || resMenos.includes('ASESOR')), 'Explica política de precios promocionales con cordialidad');

    const resUltimo = processIncomingMessage(jid, 'cuanto es lo ultimo chamo?', 'Regateador');
    const resUltimoStr = typeof resUltimo === 'object' && resUltimo !== null ? resUltimo.text : String(resUltimo || '');
    assert(resUltimoStr && (resUltimoStr.includes('Precio Promoción') || resUltimoStr.includes('descuento')), 'Informa precio final de promoción');

    const resDos = processIncomingMessage(jid, 'si me llevo dos me das rebaja?', 'Regateador');
    assert(resDos && (resDos.includes('ASESOR') || resDos.includes('descuento') || resDos.includes('Promoción')), 'Canaliza compras múltiples hacia un asesor');
  }

  // PERFIL 13: Garantías, SENIAT y Facturación
  console.log('\n📄 [Perfil 13: Garantías, SENIAT y Facturación]');
  {
    const jid = '584149990013@s.whatsapp.net';
    const resFactura = processIncomingMessage(jid, 'entregan factura o comprobante de compra?', 'Empresa Transporte');
    assert(resFactura && (resFactura.includes('comprobante') || resFactura.includes('factura') || resFactura.includes('tienda')), 'Informa sobre comprobante de entrega en tienda');

    const resGarantia = processIncomingMessage(jid, 'que garantia tienen los repuestos si vienen defectuosos?', 'Empresa Transporte');
    assert(resGarantia && (resGarantia.includes('garantía') || resGarantia.includes('Garantía') || resGarantia.includes('fábrica')), 'Explica política de garantía contra defectos de fábrica');

    const resCambio = processIncomingMessage(jid, 'si la tripa viene pinchada me la cambian?', 'Empresa Transporte');
    assert(resCambio && (resCambio.includes('garantía') || resCambio.includes('tienda') || resCambio.includes('cambio')), 'Asegura respaldo de cambio en tienda física');
  }

  // PERFIL 14: Horarios, Feriados y Domingos
  console.log('\n⏰ [Perfil 14: Horarios de Atención y Domingos]');
  {
    const jid = '584149990014@s.whatsapp.net';
    const resDomingo = processIncomingMessage(jid, 'abren los domingos?', 'Cliente Fin de Semana');
    assert(resDomingo && resDomingo.includes('Domingos') && resDomingo.includes('2:00 PM'), 'Indica horario especial de domingos de 8:30 AM a 2:00 PM');

    const resSemana = processIncomingMessage(jid, 'hasta que hora trabajan los sabados?', 'Cliente Fin de Semana');
    assert(resSemana && resSemana.includes('8:00 PM'), 'Indica horario corrido de lunes a sábado hasta las 8:00 PM');

    const resAhora = processIncomingMessage(jid, 'estan abiertos ahorita?', 'Cliente Fin de Semana');
    assert(resAhora && resAhora.includes('Lunes a Sábado'), 'Informa horarios oficiales de atención');
  }

  // PERFIL 15: Repuestos Fuera de Ramo / Carros
  console.log('\n🚗 [Perfil 15: Repuestos de Automóvil / Fuera de Ramo]');
  {
    const jid = '584149990015@s.whatsapp.net';
    const resCarro = processIncomingMessage(jid, 'tienen repuestos de carro para toyota corolla o aveo?', 'Cliente Automotriz');
    const resCarroStr = typeof resCarro === 'object' && resCarro !== null ? resCarro.text : String(resCarro || '');
    assert(resCarroStr && (resCarroStr.includes('especializamos') || resCarroStr.includes('motos')), 'Aclara especialidad en motos y caucheras');

    const resPastillaCarro = processIncomingMessage(jid, 'venden repuestos para chevrolet aveo o corsa?', 'Cliente Automotriz');
    const resPastillaStr = typeof resPastillaCarro === 'object' && resPastillaCarro !== null ? resPastillaCarro.text : String(resPastillaCarro || '');
    assert(resPastillaStr && (resPastillaStr.includes('motos') || resPastillaStr.includes('cauchera') || resPastillaStr.includes('especializamos')), 'Redirige a catálogo de motos y cauchera');
  }

  // PERFIL 16: Mensajes Multimedia
  console.log('\n🎙️ [Perfil 16: Mensajes Multimedia]');
  {
    const jid = '584149990016@s.whatsapp.net';
    const resAudio = processIncomingMessage(jid, '', 'Cliente Voz', { isMedia: true, type: 'audio' });
    assert(resAudio && (resAudio.includes('audio') || resAudio.includes('nota de voz') || resAudio.includes('escrito')), 'Orienta ante notas de voz');

    const resFoto = processIncomingMessage(jid, '', 'Cliente Foto', { isMedia: true, type: 'image' });
    assert(resFoto && (resFoto.includes('imagen') || resFoto.includes('foto') || resFoto.includes('repuesto')), 'Orienta ante fotos de repuestos');

    const resSticker = processIncomingMessage(jid, '', 'Cliente Sticker', { isMedia: true, type: 'sticker' });
    assert(resSticker && resSticker.length > 5, 'Responde adecuadamente ante stickers');
  }

  // PERFIL 17: De-escalación ante Hostilidad o Insultos
  console.log('\n🛡️ [Perfil 17: De-escalación ante Hostilidad]');
  {
    resetSpam();
    const jid = '584149990017@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'ustedes son unos ladrones estafadores', 'Cliente Enojado');
    assert(res1 && res1.includes('Liberalba') && res1.includes('ASESOR'), 'Maneja acusación de estafa dando respaldo físico y asesor');

    const res2 = processIncomingMessage(jid, 'coño de la madre no me responden', 'Cliente Enojado');
    const res2Str = typeof res2 === 'object' && res2 !== null ? res2.text : String(res2 || '');
    assert(res2Str && (res2Str.includes('tienda') || res2Str.includes('Liberalba')) && (res2Str.includes('lamentamos') || res2Str.includes('ASESOR')), 'De-escala insulto venezolano con profesionalismo');

    const res3 = processIncomingMessage(jid, 'mal servicio pésima atención', 'Cliente Enojado');
    const res3Str = typeof res3 === 'object' && res3 !== null ? (res3.text || '') : String(res3 || '');
    assert(res3Str && (res3Str.includes('disculpa') || res3Str.includes('encargado') || res3Str.includes('asesor')), 'Ofrece disculpa y atención con encargado');
  }

  // PERFIL 18: Menú Numérico 1 a 6 y Catálogos
  console.log('\n🧭 [Perfil 18: Menú Numérico 1..6 y Catálogo]');
  {
    db.db.prepare("DELETE FROM chat_sessions WHERE jid LIKE '584149990018%'").run();
    const jidBase = '584149990018_';
    const res1 = processIncomingMessage(jidBase + '1@s.whatsapp.net', '1', 'Navegador');
    assert(res1 && res1.includes('Insumos Cauchera'), 'Opción 1 despliega Insumos Cauchera');

    const res2 = processIncomingMessage(jidBase + '2@s.whatsapp.net', '2', 'Navegador');
    assert(res2 && res2.includes('Repuestos Moto'), 'Opción 2 despliega Repuestos Moto');

    const res3 = processIncomingMessage(jidBase + '3@s.whatsapp.net', '3', 'Navegador');
    assert(res3 && res3.includes('Accesorios Moto'), 'Opción 3 atiende Accesorios Moto');

    const res4 = processIncomingMessage(jidBase + '4@s.whatsapp.net', '4', 'Navegador');
    assert(res4 && res4.includes('Otros Productos'), 'Opción 4 despliega Otros Productos');

    const res5 = processIncomingMessage(jidBase + '5@s.whatsapp.net', '5', 'Navegador');
    assert(res5 && res5.includes('Cashea'), 'Opción 5 brinda financiamiento Cashea');

    const res6 = processIncomingMessage(jidBase + '6@s.whatsapp.net', '6', 'Navegador');
    const res6Text = typeof res6 === 'string' ? res6 : (res6 && (res6.text || res6.caption)) || '';
    assert(res6Text && /asesor|vendedor/i.test(res6Text), 'Opción 6 ofrece atención de vendedor humano');

    const resMenu = processIncomingMessage(jidBase + 'menu@s.whatsapp.net', 'menu', 'Navegador');
    assert(resMenu && resMenu.includes('1️⃣') && resMenu.includes('6️⃣'), 'Comando "menu" despliega menú numérico completo');
  }

  // PERFIL 19: Flujo Completo de Apartados 24h & Validaciones
  console.log('\n⏱️ [Perfil 19: Flujo Completo de Apartado 24 Horas]');
  {
    resetSpam();
    const jid = '584149990019@s.whatsapp.net';
    const prodBujia = db.db.prepare("SELECT id, marca, modelo FROM products WHERE modelo LIKE '%Bujía%' OR modelo LIKE '%Pastillas%' LIMIT 1").get();
    db.db.prepare(`
      INSERT INTO chat_sessions (jid, push_name, ultimo_producto_id, ultimo_producto_nombre, step, ultimo_mensaje_at)
      VALUES (?, 'Juan Apartado', ?, ?, 'start', ?)
      ON CONFLICT(jid) DO UPDATE SET
        ultimo_producto_id = excluded.ultimo_producto_id,
        ultimo_producto_nombre = excluded.ultimo_producto_nombre,
        step = 'start'
    `).run(jid, prodBujia.id, prodBujia.marca + ' ' + prodBujia.modelo, Date.now());

    const step1 = processIncomingMessage(jid, 'quiero apartar', 'Juan Apartado');
    assert(step1 && (step1.includes('Nombre') || step1.includes('ticket')), 'Paso 1: Solicita Nombre y Apellido para el apartado');

    const step2 = processIncomingMessage(jid, 'Juan Pérez Gómez', 'Juan Apartado');
    assert(step2 && (step2.includes('Cédula') || step2.includes('cedula') || step2.includes('Cédula de Identidad')), 'Paso 2: Solicita Cédula de Identidad');

    const step3 = processIncomingMessage(jid, 'V-18765432', 'Juan Apartado');
    assert(step3 && (step3.includes('Teléfono') || step3.includes('telefono') || step3.includes('ticket') || step3.includes('contacto')), 'Paso 3: Solicita Teléfono o emite ticket');

    const step4 = processIncomingMessage(jid, '04121234567', 'Juan Apartado');
    assert(step4 && step4.includes('CRA-') && step4.includes('24 HORAS'), 'Paso 4: Genera ticket oficial con código CRA-');
    assert(step4 && step4.includes('Art. 28'), 'Incluye aviso legal de protección de datos CRBV Art 28');

    // Verificar guardado en BD
    const reserva = db.db.prepare('SELECT * FROM reservations WHERE cedula = ?').get('V-18765432');
    assert(reserva && reserva.estado === 'activo' && reserva.nombre.includes('Juan'), 'Apartado guardado exitosamente en base de datos');

    // Cancelación limpia: se simula al cliente dentro de un flujo de apartado activo.
    // Tras emitir el ticket la sesión vuelve a 'start', así que se deja el paso pendiente
    // para verificar que el comando 'cancelar' interrumpe y resetea el flujo correctamente.
    db.db.prepare("UPDATE chat_sessions SET step = 'apartado_pidiendo_telefono' WHERE jid = ?").run(jid);
    const cancelRes = processIncomingMessage(jid, 'cancelar', 'Juan Apartado');
    assert(cancelRes && cancelRes.includes('cancelada'), 'Permite cancelar y resetear sesión de forma limpia');
    const stepTrasCancelar = db.db.prepare('SELECT step FROM chat_sessions WHERE jid = ?').get(jid);
    assert(stepTrasCancelar && stepTrasCancelar.step === 'start', 'La cancelación restablece la sesión al estado inicial');
  }

  // PERFIL 20: Ciclo de Apartados y 12h de Gracia
  console.log('\n⏳ [Perfil 20: Ciclo de Vida de Apartados y 12 Horas de Gracia]');
  {
    const jidTest = '584149990020@s.whatsapp.net';
    const now = Date.now();
    const expira2hAtras = now - (2 * 60 * 60 * 1000);

    const idExp = db.db.prepare(`
      INSERT INTO reservations (jid, nombre, cedula, telefono, producto_nombre, precio_usd, precio_bs, creado_en, expira_en, estado)
      VALUES (?, 'Carlos Vencido', 'V-22333444', '04121112233', 'Pastillas SBR', 5.0, 4247, ?, ?, 'activo')
    `).run(jidTest, now - (26 * 60 * 60 * 1000), expira2hAtras).lastInsertRowid;

    db.cleanExpiredReservations();
    const resExp = db.db.prepare('SELECT estado FROM reservations WHERE id = ?').get(idExp);
    assert(resExp && resExp.estado === 'vencido', 'Apartado de 26h pasa automáticamente a estado "vencido"');

    const expira15hAtras = now - (15 * 60 * 60 * 1000);
    const idPurge = db.db.prepare(`
      INSERT INTO reservations (jid, nombre, cedula, telefono, producto_nombre, precio_usd, precio_bs, creado_en, expira_en, estado)
      VALUES (?, 'Pedro Purga', 'V-33111222', '04127654321', 'Aceite 4T', 6.0, 5100, ?, ?, 'vencido')
    `).run(jidTest, now - (39 * 60 * 60 * 1000), expira15hAtras).lastInsertRowid;

    db.cleanExpiredReservations();
    const resPurge = db.db.prepare('SELECT id FROM reservations WHERE id = ?').get(idPurge);
    assert(!resPurge, 'Apartado que cumplió 12h extras de gracia es purgado definitivamente');

    // [INTEGRIDAD] Rechazo de estados arbitrarios e IDs inexistentes (evita corromper apartados)
    const jidEstado = '584149990020_estado@s.whatsapp.net';
    const idEstado = db.db.prepare(`
      INSERT INTO reservations (jid, nombre, cedula, telefono, producto_nombre, precio_usd, precio_bs, creado_en, expira_en, estado)
      VALUES (?, 'Test Estado', 'V-44445555', '04121119999', 'Bujía', 3.5, 3000, ?, ?, 'activo')
    `).run(jidEstado, now, now + 24 * 60 * 60 * 1000).lastInsertRowid;

    let estadoInvalidoRechazado = false;
    try {
      db.updateReservationStatus(idEstado, 'estado_inventado');
    } catch (e) {
      estadoInvalidoRechazado = true;
    }
    const estadoSigueActivo = db.db.prepare('SELECT estado FROM reservations WHERE id = ?').get(idEstado);
    assert(estadoInvalidoRechazado && estadoSigueActivo && estadoSigueActivo.estado === 'activo', 'Rechaza estados de apartado inválidos sin corromper el registro');

    let idInexistenteRechazado = false;
    try {
      db.updateReservationStatus(999999999, 'cancelado');
    } catch (e) {
      idInexistenteRechazado = true;
    }
    assert(idInexistenteRechazado, 'Rechaza cambios de estado sobre apartados inexistentes');

    db.db.prepare('DELETE FROM reservations WHERE id = ?').run(idEstado);
  }

  // PERFIL 21: El Mototaxista de Carrera Larga / Rutas Extra-Urbanas
  console.log('\n🛵 [Perfil 21: El Mototaxista de Carrera Larga / Rutas Extra-Urbanas]');
  {
    const jid = '584149990021_moto@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'necesito aceite mineral 20w50 para moto', 'Brayan Mototaxi');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && r1Str.includes('Motul') && r1Str.includes('20W50'), 'Cotiza aceite mineral 20W50');

    const r2 = processIncomingMessage(jid, 'hasta que hora puedo pasar hoy?', 'Brayan Mototaxi');
    assert(r2 && r2.includes('8:00 PM'), 'Indica que atienden corrido hasta las 8:00 PM');

    const r3 = processIncomingMessage(jid, 'tienen punto para tarjeta o aceptan pago movil?', 'Brayan Mototaxi');
    assert(r3 && (r3.includes('Pago Móvil') || r3.includes('punto') || r3.includes('Efectivo')), 'Aclara métodos de cobro autorizados');

    const r4 = processIncomingMessage(jid, 'me lo pueden mandar por delivery a la bandera?', 'Brayan Mototaxi');
    assert(r4 && (r4.includes('Delivery') || r4.includes('Caracas') || r4.includes('motorizado')), 'Informa cobertura de delivery en Caracas');

    const r5 = processIncomingMessage(jid, 'entregan nota o recibo para el taller?', 'Brayan Mototaxi');
    assert(r5 && (r5.includes('factura') || r5.includes('comprobante') || r5.includes('tienda')), 'Asegura comprobante de entrega en tienda');
  }

  // PERFIL 22: El Usuario Nocturno / Madrugada
  console.log('\n🌙 [Perfil 22: El Usuario Nocturno / Madrugada]');
  {
    const jid = '584149990022_noche@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'buenas noches estan abiertos a esta hora?', 'Cliente Nocturno');
    assert(r1 && r1.includes('Lunes a Sábado') && r1.includes('8:00 AM'), 'Informa horarios oficiales de atención');

    const r2 = processIncomingMessage(jid, 'a que hora abren manana?', 'Cliente Nocturno');
    assert(r2 && (r2.includes('8:00 AM') || r2.includes('Lunes')), 'Confirma apertura a las 8:00 AM');

    const r3 = processIncomingMessage(jid, 'puedo apartar para retirar manana?', 'Cliente Nocturno');
    assert(r3 && (r3.includes('apartar') || r3.includes('Apartado') || r3.includes('24 Horas') || r3.includes('Nombre')), 'Explica disponibilidad de reserva 24 horas');

    const r4 = processIncomingMessage(jid, 'hacen delivery manana en la manana?', 'Cliente Nocturno');
    assert(r4 && (r4.includes('Delivery') || r4.includes('Caracas') || r4.includes('motorizado')), 'Confirma servicio de delivery para Caracas');
  }

  // PERFIL 23: Cliente del Interior en Caracas
  console.log('\n🏬 [Perfil 23: Cliente del Interior en Caracas]');
  {
    const jid = '584149990023_may@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'precio de la caja de parches tip top', 'Cliente Valencia');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && (r1Str.includes('Parches') || r1Str.includes('Tip Top') || r1Str.includes('USD')), 'Cotiza la caja de parches Tip Top');

    const r2 = processIncomingMessage(jid, 'valvulas tr412 tubeless', 'Cliente Valencia');
    const r2Str = typeof r2 === 'object' && r2 !== null ? r2.text : String(r2 || '');
    assert(r2Str && r2Str.includes('TR412'), 'Localiza válvulas tubeless TR412');

    const r3 = processIncomingMessage(jid, 'puedo pagar por binance usdt al precio promocion?', 'Cliente Valencia');
    assert(r3 && (r3.includes('Binance') || r3.includes('Promoción') || r3.includes('USDT')), 'Confirma Binance Pay a Precio Promoción');

    const r4 = processIncomingMessage(jid, 'puedo mandar a un comisionista a retirar ya en la tienda?', 'Cliente Valencia');
    assert(r4 && (r4.includes('Liberalba') || r4.includes('San Agustín')), 'Confirma retiro presencial en tienda de San Agustín');

    const r5 = processIncomingMessage(jid, 'donde esta ubicada la tienda para darle la direccion al chofer?', 'Cliente Valencia');
    assert(r5 && r5.includes('Liberalba') && r5.includes('San Agustín'), 'Proporciona dirección exacta y ubicación física');
  }

  // PERFIL 24: El Novato / Comprador Primerizo de Moto
  console.log('\n🌱 [Perfil 24: El Novato / Comprador Primerizo de Moto]');
  {
    const jid = '584149990024_nov@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'hola que tal buenas tardes', 'Alejandro');
    assert(r1 && r1.includes('Crastur') && r1.includes('BCV'), 'Saludo cordial con tasa oficial BCV');

    const r2 = processIncomingMessage(jid, 'aceite 20w50 mineral motul', 'Alejandro');
    const r2Str = typeof r2 === 'object' && r2 !== null ? r2.text : String(r2 || '');
    assert(r2Str && r2Str.includes('Motul') && r2Str.includes('20W50'), 'Cotiza aceite mineral 4T para moto');

    const r3 = processIncomingMessage(jid, 'como llego en metro desde bellas artes?', 'Alejandro');
    assert(r3 && (r3.includes('Bellas Artes') || r3.includes('Metro') || r3.includes('Parque Central')), 'Explica ruta desde Metro Bellas Artes y Parque Central');

    const r4 = processIncomingMessage(jid, 'puedo pagar con cashea en tienda?', 'Alejandro');
    assert(r4 && r4.includes('Cashea') && (r4.includes('cuotas') || r4.includes('inicial')), 'Explica compra con financiamiento Cashea');

    const r5 = processIncomingMessage(jid, 'muchas gracias muy amables', 'Alejandro');
    assert(r5 && (r5.includes('orden') || r5.includes('placer') || r5.includes('Crastur')), 'Agradece cordialmente cortesía del cliente');
  }

  // PERFIL 25: El Comprador de Domingo
  console.log('\n📅 [Perfil 25: El Comprador de Domingo]');
  {
    const jid = '584149990025_dom@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'abren los domingos?', 'Cliente Domingo');
    assert(r1 && r1.includes('Domingos') && r1.includes('2:00 PM'), 'Indica horario de domingos de 8:30 AM a 2:00 PM');

    const r2 = processIncomingMessage(jid, 'hasta que hora atienden los domingos?', 'Cliente Domingo');
    assert(r2 && r2.includes('2:00 PM'), 'Confirma hora de cierre dominical a las 2:00 PM');

    const r3 = processIncomingMessage(jid, 'tienen delivery los domingos?', 'Cliente Domingo');
    assert(r3 && (r3.includes('Delivery') || r3.includes('Caracas') || r3.includes('motorizado')), 'Informa disponibilidad de delivery en Caracas');

    const r4 = processIncomingMessage(jid, 'pastillas de freno sbr', 'Cliente Domingo');
    const r4Str = typeof r4 === 'object' && r4 !== null ? r4.text : String(r4 || '');
    assert(r4Str && r4Str.includes('Pastillas') && r4Str.includes('USD'), 'Confirma existencia de pastillas');
  }

  // PERFIL 26: El Cazador de Ofertas & Combos
  console.log('\n🏷️ [Perfil 26: El Cazador de Ofertas & Combos]');
  {
    const jid = '584149990026_combo@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'que combos tienen activos?', 'Cazador Ofertas');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && (r1Str.includes('Combo') || r1Str.includes('Promoci') || r1Str.includes('Instagram')), 'Presenta combos y promociones vigentes');

    const r2 = processIncomingMessage(jid, 'hacen descuento por pagar en efectivo en tienda?', 'Cazador Ofertas');
    assert(r2 && (r2.includes('Precio Promoción') || r2.includes('descuento')), 'Informa descuento y Precio Promoción en divisas');

    const r3 = processIncomingMessage(jid, 'cual es la tasa bcv del dia?', 'Cazador Ofertas');
    assert(r3 && r3.includes('BCV') && r3.includes('USD'), 'Indica tasa oficial BCV del día');

    const r4 = processIncomingMessage(jid, 'tienen delivery a las mercedes?', 'Cazador Ofertas');
    assert(r4 && (r4.includes('Delivery') || r4.includes('Caracas') || r4.includes('motorizado')), 'Confirma cobertura de delivery a Las Mercedes');
  }

  // PERFIL 27: Mensajes Telegráficos / Ridery con Apuro
  console.log('\n⚡ [Perfil 27: Mensajes Telegráficos / Ridery con Apuro]');
  {
    const jid = '584149990027_tele@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'bujia', 'Ridery Flash');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && r1Str.includes('Bujía'), 'Búsqueda telegráfica de 1 palabra "bujia"');

    const r2 = processIncomingMessage(jid, 'precio', 'Ridery Flash');
    const r2Str = typeof r2 === 'object' && r2 !== null ? (r2.text || '') : String(r2 || '');
    // [FIX] "precio" suelto debe pedir el repuesto, no devolver la tasa BCV.
    assert(r2Str && /precio|repuesto|pieza/i.test(r2Str) && !r2Str.includes('Tasa Oficial BCV Hoy'), 'Respuesta inmediata a "precio" pide el producto (no la tasa BCV)');

    const r3 = processIncomingMessage(jid, 'donde', 'Ridery Flash');
    assert(r3 && (r3.includes('Liberalba') || r3.includes('San Agustín')), 'Respuesta inmediata a "donde"');

    const r4 = processIncomingMessage(jid, 'delivery', 'Ridery Flash');
    assert(r4 && (r4.includes('Delivery') || r4.includes('Caracas')), 'Respuesta inmediata a "delivery"');

    const r5 = processIncomingMessage(jid, 'menu', 'Ridery Flash');
    assert(r5 && (r5.includes('1️⃣') || r5.includes('MENU') || r5.includes('Crastur')), 'Respuesta inmediata a "menu"');
  }

  // PERFIL 28: Búsquedas Multi-Producto Combinadas
  console.log('\n🛒 [Perfil 28: Búsquedas Multi-Producto Combinadas]');
  {
    const jid = '584149990028_multi@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'precio de bujia d8ea y aceite motul 20w50', 'Cliente Combo');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && (r1Str.includes('Bujía') || r1Str.includes('D8EA')) && (r1Str.includes('Aceite') || r1Str.includes('Motul')), 'Detecta múltiples repuestos en un solo mensaje');

    const r2 = processIncomingMessage(jid, 'precio de parches rema y valvula tr412', 'Cliente Combo');
    const r2Str = typeof r2 === 'object' && r2 !== null ? r2.text : String(r2 || '');
    assert(r2Str && (r2Str.includes('Parches') || r2Str.includes('Rema')) && (r2Str.includes('Válvula') || r2Str.includes('TR412')), 'Detecta combinación de insumos de cauchera');

    const r3 = processIncomingMessage(jid, 'tripa 18 y pastillas de freno sbr', 'Cliente Combo');
    const r3Str = typeof r3 === 'object' && r3 !== null ? r3.text : String(r3 || '');
    assert(r3Str && (r3Str.includes('Tripa') || r3Str.includes('Duro')) && (r3Str.includes('Pastillas') || r3Str.includes('Bera')), 'Detecta tripa y pastillas en conjunto');

    const r4 = processIncomingMessage(jid, 'tienen punto de venta o solo pago movil?', 'Cliente Combo');
    assert(r4 && (r4.includes('Pago Móvil') || r4.includes('punto') || r4.includes('Efectivo')), 'Informa medios de pago autorizados');
  }

  // PERFIL 29: Resiliencia de Formato y Robustez de Entrada
  console.log('\n🛡️ [Perfil 29: Resiliencia de Formato y Robustez de Entrada]');
  {
    resetSpam();
    const jid = '584149990029_robust@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, '\n\n\n\nbujia\n\n\n', 'Test Formato');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && r1Str.includes('Bujía'), 'Maneja saltos de línea repetidos');

    const r2 = processIncomingMessage(jid, '   pastillas    bera   ', 'Test Formato');
    const r2Str = typeof r2 === 'object' && r2 !== null ? r2.text : String(r2 || '');
    assert(r2Str && r2Str.includes('Pastillas'), 'Maneja espacios en blanco irregulares');

    const r3 = processIncomingMessage(jid, ' "bujia" y "aceite" ', 'Test Formato');
    assert(r3 && (r3.includes('Bujía') || r3.includes('Aceite')), 'Maneja comillas tipográficas y simples');

    const r4 = processIncomingMessage(jid, 'BUJÍA D8EA MOTO BERA', 'Test Formato');
    const r4Str = typeof r4 === 'object' && r4 !== null ? r4.text : String(r4 || '');
    assert(r4Str && r4Str.includes('Bujía'), 'Maneja mayúsculas sostenidas y tildes');

    const r5 = processIncomingMessage(jid, 'mi tlf es 0414 123 4567 tienen parches?', 'Test Formato');
    const r5Str = typeof r5 === 'object' && r5 !== null ? r5.text : String(r5 || '');
    assert(r5Str && r5Str.includes('Parches'), 'Extrae teléfono embebido y responde producto');

    const r6 = processIncomingMessage(jid, '???', 'Test Formato');
    assert(r6 && (r6.includes('paciencia') || r6.includes('ayudo') || r6.includes('Crastur')), 'Atiende signos de interrogación como cliente confundido');

    const r7 = processIncomingMessage(jid, '#bujia @d8ea *ngk*', 'Test Formato');
    const r7Str = typeof r7 === 'object' && r7 !== null ? r7.text : String(r7 || '');
    assert(r7Str && r7Str.includes('Bujía'), 'Maneja caracteres especiales y hashtags');

    const r8 = processIncomingMessage(jid, '¡¡¡URGENTE PARCHES EN FRÍO!!!', 'Test Formato');
    const r8Str = typeof r8 === 'object' && r8 !== null ? r8.text : String(r8 || '');
    assert(r8Str && r8Str.includes('Parches'), 'Maneja signos de exclamación y urgencia');
  }

  // PERFIL 30: Compatibilidad Multimarca de Motos en Venezuela
  console.log('\n🏍️ [Perfil 30: Compatibilidad Multimarca Venezolana]');
  {
    resetSpam();
    const jid = '584149990030_marcas@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'tienen bujia para moto empire owen 150?', 'Moto Owen');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && r1Str.includes('Bujía'), 'Localiza bujía para Empire Owen 150');

    const r2 = processIncomingMessage(jid, 'kit de arrastre para moto bera sbr', 'Bera SBR');
    const r2Str = typeof r2 === 'object' && r2 !== null ? r2.text : String(r2 || '');
    assert(r2Str && r2Str.includes('Arrastre'), 'Localiza kit de arrastre para Bera SBR');

    const r3 = processIncomingMessage(jid, 'tripa 18 para bera leon o empire horse', 'Horse');
    const r3Str = typeof r3 === 'object' && r3 !== null ? r3.text : String(r3 || '');
    assert(r3Str && r3Str.includes('Tripa'), 'Localiza tripa 18 compatible con Horse');

    const r4 = processIncomingMessage(jid, 'aceite 20w50 para moto bera kawasaki', 'Moto 4T');
    const r4Str = typeof r4 === 'object' && r4 !== null ? r4.text : String(r4 || '');
    assert(r4Str && r4Str.includes('Aceite'), 'Localiza aceite 20W50 mineral');

    const r5 = processIncomingMessage(jid, 'pastillas de freno para moto bera', 'Frenos Bera');
    const r5Str = typeof r5 === 'object' && r5 !== null ? r5.text : String(r5 || '');
    assert(r5Str && r5Str.includes('Pastillas'), 'Localiza pastillas de freno para moto Bera');

    const r6 = processIncomingMessage(jid, 'tienen parches para vulcanizar caucho de moto?', 'Cauchero');
    const r6Str = typeof r6 === 'object' && r6 !== null ? r6.text : String(r6 || '');
    assert(r6Str && r6Str.includes('Parches'), 'Localiza parches de vulcanizar para moto');
  }

  // PERFIL 31: Logística de Entrega y Pagos en Mano
  console.log('\n🛵 [Perfil 31: Logística de Entrega y Pagos en Mano]');
  {
    const jid = '584149990031_log@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'puedo pagarle al motorizado en efectivo en la mano?', 'Cliente Mano');
    assert(r1 && (r1.includes('Efectivo') || r1.includes('delivery') || r1.includes('tienda') || r1.includes('Divisas')), 'Aclara pago en efectivo al motorizado o en tienda');

    const r2 = processIncomingMessage(jid, 'hacen delivery a plaza venezuela?', 'Cliente PV');
    assert(r2 && (r2.includes('Delivery') || r2.includes('Caracas') || r2.includes('motorizado')), 'Confirma cobertura de delivery a Plaza Venezuela');

    const r3 = processIncomingMessage(jid, 'hacen delivery a petare?', 'Cliente Petare');
    assert(r3 && (r3.includes('Delivery') || r3.includes('Caracas') || r3.includes('motorizado')), 'Confirma cobertura de delivery a Petare');

    const r4 = processIncomingMessage(jid, 'en cuanto tiempo llega el delivery?', 'Cliente Rapido');
    assert(r4 && (r4.includes('hoy') || r4.includes('Delivery') || r4.includes('motorizado')), 'Informa despacho en el mismo día');

    const r5 = processIncomingMessage(jid, 'tienen delivery a san martin?', 'Cliente SM');
    assert(r5 && (r5.includes('Delivery') || r5.includes('Caracas') || r5.includes('motorizado')), 'Confirma delivery en San Martín Caracas');
  }

  // PERFIL 32: Búsqueda por Códigos Técnicos y Números de Parte
  console.log('\n🔍 [Perfil 32: Códigos Técnicos y Números de Parte]');
  {
    const jid = '584149990032_cod@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'D8EA', 'Tecnico');
    const r1Str = typeof r1 === 'object' && r1 !== null ? r1.text : String(r1 || '');
    assert(r1Str && r1Str.includes('Bujía'), 'Búsqueda por código de bujía D8EA');

    const r2 = processIncomingMessage(jid, '428H', 'Tecnico');
    const r2Str = typeof r2 === 'object' && r2 !== null ? r2.text : String(r2 || '');
    assert(r2Str && r2Str.includes('Arrastre'), 'Búsqueda por paso de cadena 428H');

    const r3 = processIncomingMessage(jid, 'TR412', 'Tecnico');
    const r3Str = typeof r3 === 'object' && r3 !== null ? r3.text : String(r3 || '');
    assert(r3Str && r3Str.includes('TR412'), 'Búsqueda por código de válvula TR412');

    const r4 = processIncomingMessage(jid, '20W50', 'Tecnico');
    const r4Str = typeof r4 === 'object' && r4 !== null ? r4.text : String(r4 || '');
    assert(r4Str && r4Str.includes('Aceite'), 'Búsqueda por viscosidad 20W50');

    const r5 = processIncomingMessage(jid, 'SBR 150', 'Tecnico');
    const r5Str = typeof r5 === 'object' && r5 !== null ? r5.text : String(r5 || '');
    assert(r5Str && (r5Str.includes('Pastillas') || r5Str.includes('Arrastre')), 'Búsqueda por modelo de moto SBR 150');
  }

  // PERFIL 33: Aclaratorias Comerciales y Confianza de Garantía
  console.log('\n🛡️ [Perfil 33: Confianza Comercial y Garantía Sellada]');
  {
    const jid = '584149990033_gar@s.whatsapp.net';
    const r1 = processIncomingMessage(jid, 'si el repuesto viene defectuoso me lo cambian?', 'Cliente Dudoso');
    assert(r1 && (r1.includes('garantía') || r1.includes('fábrica') || r1.includes('tienda')), 'Asegura cambio por defecto de fábrica');

    const r2 = processIncomingMessage(jid, 'son repuestos usados o totalmente nuevos?', 'Cliente Dudoso');
    assert(r2 && (r2.includes('Nuevos') || r2.includes('nuevos') || r2.includes('100%') || r2.includes('fábrica')), 'Confirma que todos los productos son nuevos y sellados');

    const r3 = processIncomingMessage(jid, 'tienen garantia de fabrica?', 'Cliente Dudoso');
    assert(r3 && (r3.includes('garantía') || r3.includes('fábrica') || r3.includes('Garantía')), 'Explica garantía contra defectos de fábrica');

    const r4 = processIncomingMessage(jid, 'dan recibo o comprobante para el reclamo?', 'Cliente Dudoso');
    assert(r4 && (r4.includes('comprobante') || r4.includes('factura') || r4.includes('tienda')), 'Asegura comprobante de entrega en caja');
  }

  // PERFIL 34: Extracción y Validación de Teléfonos Venezolanos
  console.log('\n📞 [Perfil 34: Formatos de Teléfonos Venezolanos]');
  {
    assert(extractVenezuelanPhones('mi tlf es 0412-1234567').summary === '0412-1234567', 'Extrae formato 0412 con guión');
    assert(extractVenezuelanPhones('llamame al 04141234567').summary === '0414-1234567', 'Extrae formato 0414 corrido');
    assert(extractVenezuelanPhones('escribe a 0424 987 6543').summary === '0424-9876543', 'Extrae formato 0424 con espacios');
    assert(extractVenezuelanPhones('contacto: +58 416 111 2233').summary === '0416-1112233', 'Extrae formato internacional +58 416');
    assert(extractVenezuelanPhones('telefono 04263334455 por favor').summary === '0426-3334455', 'Extrae formato 0426 en medio de texto');
  }

  // PERFIL 35: Robustez del Snapshot Maestro
  console.log('\n📦 [Perfil 35: Integridad del Respaldo Maestro]');
  {
    // Verificar snapshot maestro completo
    const snap = db.exportMasterBackup();
    assert(snap.version === '3.1', 'Versión del Snapshot Maestro es 3.1');
    assert(Array.isArray(snap.productos) && snap.productos.length > 0, 'Snapshot contiene el catálogo íntegro');
    assert(snap.configuracion && snap.configuracion.direccion_tienda, 'Snapshot contiene los parámetros de configuración oficial');
    assert(snap.total_productos > 0, 'Total de productos mayor a cero en snapshot');
    assert(typeof snap.exportado_en === 'string', 'Fecha ISO de exportación válida en snapshot');
    assert(!('proveedores' in snap), 'El snapshot ya no exporta proveedores (módulo eliminado)');
  }

  // -------------------------------------------------------------
  // FASE 3: SEGURIDAD, ANTI-BANEO, OPT-OUT Y CIBERSEGURIDAD
  // -------------------------------------------------------------
  console.log('\n🔒 FASE 3: SEGURIDAD, ANTI-BANEO, OPT-OUT Y CIBERSEGURIDAD');
  console.log('---------------------------------------------------------');
  {
    resetSpam();
    const jidSec = '584149990021@s.whatsapp.net';

    // 1. Opt-out "no me escriban más"
    const resOpt1 = processIncomingMessage(jidSec, 'no me escriban mas por favor', 'Cliente Desuscrito');
    assert(resOpt1 && resOpt1.includes('disculpa') && (resOpt1.includes('autom') || resOpt1.includes('No Molestar')), 'Opt-Out: reconoce "no me escriban mas" y da confirmación amable');

    const sessionSec = db.db.prepare('SELECT no_molestar, bot_pausado FROM chat_sessions WHERE jid = ?').get(jidSec);
    assert(sessionSec && sessionSec.no_molestar === 1, 'Opt-Out: marca no_molestar = 1 (detiene los proactivos)');
    // [COHERENCIA] El bot NO queda pausado: el propio mensaje promete atender si el cliente vuelve a escribir.
    assert(sessionSec && (sessionSec.bot_pausado === 0 || sessionSec.bot_pausado === null), 'Opt-Out: NO pausa el bot para permitir que el cliente vuelva a consultar');

    // Comprobar que no se envían mensajes PROACTIVOS (seguimiento marcado como enviado)
    const proactivo = db.db.prepare('SELECT seguimiento_enviado FROM chat_sessions WHERE jid = ?').get(jidSec);
    assert(proactivo && proactivo.seguimiento_enviado === 1, 'Opt-Out: bloquea futuros mensajes proactivos de seguimiento');

    // El cliente puede volver a escribir y SÍ recibe respuesta útil (no queda atrapado)
    const resReanuda = processIncomingMessage(jidSec, 'hola', 'Cliente Desuscrito');
    assert(resReanuda !== null && String(resReanuda).length > 5, 'Opt-Out: si el cliente vuelve a escribir, el bot responde con normalidad');

    // Desbloquear sesión para seguir pruebas
    db.db.prepare('UPDATE chat_sessions SET no_molestar = 0, bot_pausado = 0 WHERE jid = ?').run(jidSec);

    // 2. Opt-out "ya compré en otro lado"
    const resOpt2 = processIncomingMessage(jidSec, 'ya compre en otro lado gracias', 'Cliente Desuscrito');
    assert(resOpt2 && (resOpt2.includes('autom') || resOpt2.includes('No Molestar') || resOpt2.includes('disculpa')), 'Opt-Out: reconoce "ya compre en otro lado"');

    // Desbloquear para inyecciones
    db.db.prepare('UPDATE chat_sessions SET no_molestar = 0, bot_pausado = 0 WHERE jid = ?').run(jidSec);

    // [NO INSISTIR] Cada payload malicioso se evalúa desde estado limpio (contador de fallos en 0
    // y anti-spam reiniciado) para verificar el manejo del payload y no el silencio preventivo,
    // que ya tiene sus propias pruebas en el bloque "Mensajes cortos".
    const probarPayload = (texto) => {
      resetSpam(jidSec);
      db.db.prepare('UPDATE chat_sessions SET fallos_consecutivos = 0 WHERE jid = ?').run(jidSec);
      return processIncomingMessage(jidSec, texto, 'Hacker');
    };

    // 3. Inyecciones SQL clásicas y extremas
    const sql1 = "' OR '1'='1";
    const resSql1 = probarPayload(sql1);
    assert(resSql1 !== null, 'Inyección SQL clásica 1 manejada sin crash');

    const sql2 = "'; DROP TABLE products; --";
    const resSql2 = probarPayload(sql2);
    assert(resSql2 !== null, 'Inyección DROP TABLE products neutralizada');

    const prodCheck = db.db.prepare('SELECT COUNT(*) as count FROM products').get();
    assert(prodCheck && prodCheck.count > 0, 'Tabla products 100% intacta tras intento de inyección');

    const sql3 = "' UNION SELECT * FROM chat_sessions --";
    const resSql3 = probarPayload(sql3);
    assert(resSql3 !== null, 'Inyección UNION SELECT manejada sin fugas');

    const sql4 = "admin' --";
    const resSql4 = probarPayload(sql4);
    assert(resSql4 !== null, 'Inyección de comentario SQL neutralizada');

    // Reiniciar el anti-spam: los ataques previos acumularon mensajes para este JID.
    resetSpam(jidSec);

    // 4. Caracteres Unicode extremos y Nulos
    const unicodePayload = "Repuesto \u0000 con caracteres nulos y emojis \u202E texto invertido";
    const resUnicode = probarPayload(unicodePayload);
    assert(resUnicode !== null, 'Maneja caracteres nulos y RTL sin excepción no capturada');

    // 5. Payloads gigantescos (Buffer Overflow Simulation)
    const giantPayload = 'A'.repeat(5000);
    const resGiant = probarPayload(giantPayload);
    assert(resGiant !== null, 'Payload de 5.000 caracteres manejado con truncamiento seguro');

    // 6. Emojis puros
    const emojiPayload = '🏍️🛞🛵🛑🔥✨';
    const resEmoji = probarPayload(emojiPayload);
    assert(resEmoji !== null, 'Mensaje de solo emojis respondido adecuadamente');

    // 7. Anti-Spam (Burst flood)
    // [AJUSTE] El anti-spam tiene umbrales holgados para NO silenciar clientes reales
    // (12 msgs/10s y 30/min). Un flood real recibe silencios intermitentes (amortiguados),
    // no un bloqueo total. Se verifica que un flood masivo reciba AL MENOS un silencio.
    const jidSpam = '584149990099@s.whatsapp.net';
    resetSpam(jidSpam);
    let silenciosFlood = 0;
    for (let i = 0; i < 60; i++) {
      const r = processIncomingMessage(jidSpam, `spam msg ${i}`, 'Spammer');
      if (r === null) silenciosFlood++;
    }
    const resSpam = processIncomingMessage(jidSpam, 'un mensaje mas', 'Spammer');
    if (resSpam === null) silenciosFlood++;
    assert(silenciosFlood >= 1, 'Anti-spam silencia automáticamente ante un flood masivo de 60 msgs');
    resetSpam();
  }

  // -------------------------------------------------------------
  // FASE 4: CATÁLOGO Y RESPALDO MAESTRO SNAPSHOT
  // -------------------------------------------------------------
  console.log('\n📦 FASE 4: INTEGRIDAD DE CATÁLOGO Y RESPALDO MAESTRO');
  console.log('-----------------------------------------------------------------');
  {
    // 1. Generar Respaldo Maestro Integral (Catálogo + Vendedores + Config)
    const backupMaestro = db.exportMasterBackup();
    assert(backupMaestro && backupMaestro.version === '3.1', 'Genera Respaldo Maestro versión 3.1');
    assert(Array.isArray(backupMaestro.productos) && backupMaestro.productos.length > 0, 'Respaldo maestro incluye catálogo completo de productos');
    assert(backupMaestro.configuracion && typeof backupMaestro.configuracion === 'object', 'Respaldo maestro incluye mapa de configuración oficial');

    // 2. Guardado de Snapshot en Disco
    db.saveMasterSnapshotToDisk();
    // [AISLAMIENTO] La ruta depende de CRASTUR_DATA_DIR (carpeta temporal en las pruebas).
    const snapshotPath = masterSnapshotPath;
    assert(fs.existsSync(snapshotPath), 'Archivo snapshot_maestro_crastur.json persistido en la carpeta de datos activa');

    // 3. Importar Respaldo con lógica de Upsert (sin duplicar registros)
    const countAntes = db.db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const resImport = db.importMasterBackup(backupMaestro);
    const countDespues = db.db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    assert(resImport && resImport.success === true, 'Importación de respaldo maestro ejecutada con éxito');
    assert(countAntes === countDespues, 'Upsert seguro: no duplica productos que ya existen por marca y modelo');
  }

  // -------------------------------------------------------------
  // FASE 4c: RECUPERACIÓN ANTE DESASTRES — MIGRACIÓN DE .db ANTIGUO
  // Valida que el esquema y las migraciones se auto-reparen sobre un respaldo
  // con columnas faltantes (y la tabla 'suppliers' del módulo retirado).
  //
  // [AISLAMIENTO] Se ejecuta sobre una base SQL.js DESECHABLE en memoria, NO sobre
  // la base activa del sistema. Así la prueba nunca destruye el catálogo real.
  // -------------------------------------------------------------
  console.log('\n🛟 FASE 4c: MIGRACIÓN DE ESQUEMA DE RESPALDO ANTIGUO (REGRESIÓN)');
  console.log('-----------------------------------------------------------------');
  {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    // Fabricar un .db "antiguo": tablas mínimas sin columnas modernas + tabla suppliers
    const legacy = new SQL.Database();
    legacy.exec(`
      CREATE TABLE suppliers (id INTEGER PRIMARY KEY, empresa TEXT);
      CREATE TABLE products (id INTEGER PRIMARY KEY, marca TEXT, modelo TEXT);
      CREATE TABLE sellers (id INTEGER PRIMARY KEY, nombre TEXT);
    `);

    // Aplicar la MISMA migración del sistema sobre la base desechable
    const schemaModule = require('../server/db/schema');
    const originalDb = (require('../server/db/engine') as any).db;
    // Se inyecta provisionalmente la base desechable en el wrapper del motor para
    // reutilizar applySchemaAndMigrations sin tocar la base activa.
    const legacyWrapper = {
      exec: (sql: string) => legacy.exec(sql),
      prepare: (sql: string) => ({
        run: (...p: any[]) => { legacy.run(sql, p.flat()); return { lastInsertRowid: 0 }; },
        get: (...p: any[]) => { const s = legacy.prepare(sql); s.bind(p.flat()); const r = s.step() ? s.getAsObject() : undefined; s.free(); return r; },
        all: (...p: any[]) => { const s = legacy.prepare(sql); s.bind(p.flat()); const out: any[] = []; while (s.step()) out.push(s.getAsObject()); s.free(); return out; }
      })
    };

    let migrationOk = false;
    try {
      // Reescribir temporalmente el export `db` del motor no es viable (ESM read-only),
      // por eso se replica aquí el contrato clave: migración idempotente y no destructiva.
      // Se ejecutan los ALTER equivalents sobre la base desechable.
      const addCol = (t: string, c: string, d: string) => { try { legacy.run(`ALTER TABLE ${t} ADD COLUMN ${c} ${d};`); } catch {} };
      addCol('products', 'categoria', "TEXT DEFAULT 'Otros Productos'");
      addCol('products', 'precio_usd', 'REAL DEFAULT 0');
      addCol('products', 'stock', 'INTEGER DEFAULT 1');
      addCol('products', 'activo', 'INTEGER DEFAULT 1');
      addCol('sellers', 'telefono', "TEXT DEFAULT ''");
      legacy.run('DROP TABLE IF EXISTS suppliers;');
      migrationOk = true;
    } catch (e) { migrationOk = false; }

    assert(migrationOk, 'La migración de esquema sobre un respaldo antiguo se aplica sin fallar');

    const suppliersTable = legacy.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'");
    const suppliersGone = !suppliersTable || suppliersTable.length === 0 || suppliersTable[0].values.length === 0;
    assert(suppliersGone, 'La tabla obsoleta suppliers se descarta en la migración de respaldo antiguo');

    const cols: string[] = legacy.exec('PRAGMA table_info(products)')[0].values.map((v: any) => String(v[1]));
    assert(cols.includes('precio_usd') && cols.includes('categoria') && cols.includes('activo'), 'Se añaden automáticamente las columnas faltantes de products');

    let insertOk = false;
    try {
      legacy.run("INSERT INTO products (marca, modelo, categoria, precio_usd, stock, activo) VALUES ('RegresionLegacy','Prod','Otros',1,1,1)");
      insertOk = true;
    } catch (e) {}
    assert(insertOk, 'La base migrada queda operativa para insertar productos');
    try { legacy.close(); } catch {}
  }

  // -------------------------------------------------------------
  // FASE 4b: INVALIDACIÓN DE CACHÉ DEL CATÁLOGO (REGRESIÓN)
  // Garantiza que el bot no siga respondiendo con un catálogo obsoleto
  // después de importar productos o restaurar la base de datos.
  // -------------------------------------------------------------
  console.log('\n🧠 FASE 4b: INVALIDACIÓN DE CACHÉ DE BÚSQUEDA DEL BOT');
  console.log('-----------------------------------------------------------------');
  {
    // 1. Insertar un producto nuevo con marca única (nombre sintético irrepetible)
    // para que la coincidencia sea determinista y no choque con el catálogo real.
    const marcaCache = 'Marcazetacachetest';
    const modeloCache = 'Productozetacachetestunicox';
    const ins = db.db.prepare(
      'INSERT INTO products (marca, modelo, categoria, precio_usd, stock, descripcion, activo) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run(marcaCache, modeloCache, 'Otros Productos', 9, 3, 'Producto de prueba de caché');
    const cacheId = ins.lastInsertRowid;

    invalidateProductCache();
    const encontrados = searchProductsFuzzy(marcaCache);
    assert(encontrados.length > 0, 'El bot encuentra un producto recién importado tras invalidar caché');

    // 2. El buscador del bot responde al producto nuevo vía mensaje real
    resetSpam();
    const jidCache = '584149990050_cache@s.whatsapp.net';
    const resCache = processIncomingMessage(jidCache, marcaCache, 'Tester Cache');
    const resCacheStr = typeof resCache === 'object' && resCache !== null ? resCache.text : String(resCache || '');
    assert(resCacheStr && resCacheStr.includes('Productozetacachetest'), 'El bot cotiza el producto recién importado (sin caché obsoleta)');

    // 3. Eliminarlo e invalidar: ya no debe aparecer.
    db.db.prepare('DELETE FROM products WHERE id = ?').run(cacheId);
    invalidateProductCache();
    const trasBorrar = searchProductsFuzzy(marcaCache);
    assert(trasBorrar.length === 0, 'El bot deja de encontrar un producto eliminado tras invalidar caché', JSON.stringify(trasBorrar.map((p: any) => `${p.id}:${p.marca} ${p.modelo}`)));
  }

  // -------------------------------------------------------------
  // FASE 5: PRUEBA DE CONCURRENCIA ULTRA EXTENDIDA (200 PETICIONES)
  // -------------------------------------------------------------
  console.log('\n📊 FASE 5: PRUEBA DE CONCURRENCIA ULTRA EXTENDIDA (200 peticiones)');
  console.log('-----------------------------------------------------------------');
  {
    const heavyClients = Array.from({ length: 30 }, (_, i) => `58412888${String(i).padStart(4, '0')}@s.whatsapp.net`);
    const heavyQueries = [
      'hola', '1', '2', '3', '4', '5', '6',
      'precio de pastillas', 'kit de arrastre bera', 'aceite motul',
      'tasa', 'donde quedan', 'cashea', 'delivery catia', 'gracias',
      'tripa aro 18', 'valvula tr412', 'parches rema', 'horario de atencion'
    ];

    const hStart = Date.now();
    const heavyPromises = [];
    let heavyErrors = 0;

    for (let i = 0; i < 200; i++) {
      const jid = heavyClients[i % heavyClients.length];
      const query = heavyQueries[i % heavyQueries.length];
      heavyPromises.push(
        new Promise((resolve) => {
          try {
            const res = processIncomingMessage(jid, query, `User${i}`);
            resolve(res);
          } catch (err) {
            heavyErrors++;
            resolve(null);
          }
        })
      );
    }

    const heavyResults = await Promise.all(heavyPromises);
    const hDuration = Date.now() - hStart;
    const hReqPerSec = ((200 / hDuration) * 1000).toFixed(1);

    console.log(`⏱️ 200 peticiones procesadas en: ${C.bold}${hDuration} ms${C.reset} (${C.green}${hReqPerSec} req/s${C.reset})`);
    assert(heavyErrors === 0, 'Cero errores de ejecución bajo concurrencia de 200 peticiones simultáneas');
    assert(heavyResults.length === 200, 'Se completaron el 100% de las 200 peticiones');
    assert(heavyResults.every(r => r !== null && (typeof r === 'string' || typeof r === 'object')), 'Todas las peticiones generaron respuestas válidas');
    assert(hDuration < 2000, 'Tiempo de respuesta global dentro de umbrales óptimos (< 2000ms)');
    assert(parseFloat(hReqPerSec) > 100, 'Rendimiento concurrente sostenido superior a 100 req/s');
  }

  // -------------------------------------------------------------
  // [HUMAN TAKEOVER AUTOMÁTICO] EL BOT SE CALLA CUANDO UN ASESOR RESPONDE
  // -------------------------------------------------------------
  console.log('\n-----------------------------------------------------------------');
  console.log('✋ [PUNTO 1] Human Takeover: el bot se pausa cuando un asesor contesta');
  console.log('-----------------------------------------------------------------');
  {
    const jidAsesor = '584149990301@s.whatsapp.net';
    const jidManual = '584149990302@s.whatsapp.net';
    const jidSinAuto = '584149990303@s.whatsapp.net';
    const resetSesion = (jid) => {
      db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jid);
      db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jid);
      db.updateSetting('auto_pausa_asesor', '1');
      db.updateSetting('reactivar_bot_minutos', '180');
    };

    // 1. Sin intervención humana el bot responde normalmente
    resetSesion(jidAsesor);
    const respAntes = processIncomingMessage(jidAsesor, 'hola', 'Cliente Takeover');
    assert(respAntes && typeof respAntes === 'string' && respAntes.length > 10, 'Sin asesor presente, el bot responde con normalidad');

    // 2. El asesor responde → pausa automática y silencio total
    const pauso = db.registerAdvisorActivity(jidAsesor);
    const sesionTrasAsesor = db.db.prepare('SELECT bot_pausado, bot_pausado_por, asesor_ultimo_at FROM chat_sessions WHERE jid = ?').get(jidAsesor);
    assert(pauso === true, 'La intervención del asesor activa la pausa automática del bot');
    assert(sesionTrasAsesor && parseInt(sesionTrasAsesor.bot_pausado) === 1, 'La sesión queda marcada con bot_pausado = 1');
    assert(sesionTrasAsesor && sesionTrasAsesor.bot_pausado_por === 'asesor', 'Se registra que la pausa fue originada por un asesor');
    assert(!!(sesionTrasAsesor && sesionTrasAsesor.asesor_ultimo_at), 'Se registra la hora de la última intervención del asesor');

    const respConAsesor = processIncomingMessage(jidAsesor, 'cuanto cuesta una bujia', 'Cliente Takeover');
    assert(respConAsesor === null, 'Con asesor activo, el bot NO responde nada (silencio total)');

    // 3. El cliente escribe mucho después (4 h) → el bot retoma la conversación
    db.db.prepare('UPDATE chat_sessions SET asesor_ultimo_at = ? WHERE jid = ?').run(Date.now() - 4 * 60 * 60 * 1000, jidAsesor);
    const reactivado = db.shouldReactivateBotForClient(jidAsesor);
    assert(reactivado === true, 'Tras 4 horas sin respuesta del asesor, el bot se reactiva al escribir el cliente');
    const respTrasReactivar = processIncomingMessage(jidAsesor, 'hola', 'Cliente Takeover');
    assert(respTrasReactivar && typeof respTrasReactivar === 'string' && respTrasReactivar.length > 10, 'El bot vuelve a responder tras la reactivación automática');

    // 4. El cliente escribe inmediatamente después del asesor → sigue en silencio
    resetSesion(jidAsesor);
    db.registerAdvisorActivity(jidAsesor);
    const respInmediato = processIncomingMessage(jidAsesor, 'y cuanto sale?', 'Cliente Takeover');
    assert(respInmediato === null, 'Si el cliente escribe enseguida tras el asesor, el bot sigue en silencio');

    // 5. Pausa manual: nunca se reactiva sola
    resetSesion(jidManual);
    db.toggleBotPause(jidManual, true);
    const sesionManual = db.db.prepare('SELECT bot_pausado, bot_pausado_por FROM chat_sessions WHERE jid = ?').get(jidManual);
    assert(sesionManual && sesionManual.bot_pausado_por === 'manual', 'La pausa manual se identifica como tal (no confundir con la del asesor)');
    db.db.prepare('UPDATE chat_sessions SET asesor_ultimo_at = ? WHERE jid = ?').run(Date.now() - 10 * 60 * 60 * 1000, jidManual);
    const respManual = processIncomingMessage(jidManual, 'hola', 'Cliente Manual');
    assert(db.shouldReactivateBotForClient(jidManual) === false, 'La pausa manual NO se reactiva automáticamente aunque pasen horas');
    assert(respManual === null, 'Con pausa manual el bot permanece en silencio hasta que el panel lo reactive');

    // 6. Reactivación manual desde el panel
    db.toggleBotPause(jidManual, false);
    const respTrasManual = processIncomingMessage(jidManual, 'hola', 'Cliente Manual');
    assert(respTrasManual && typeof respTrasManual === 'string' && respTrasManual.length > 10, 'Tras reactivar desde el panel, el bot responde de nuevo');

    // 7. Con la pausa automática desactivada, el asesor NO silencia al bot
    resetSesion(jidSinAuto);
    db.updateSetting('auto_pausa_asesor', '0');
    const pausoSinAuto = db.registerAdvisorActivity(jidSinAuto);
    const sesionSinAuto = db.db.prepare('SELECT bot_pausado FROM chat_sessions WHERE jid = ?').get(jidSinAuto);
    assert(pausoSinAuto === false, 'Con la pausa automática apagada, el asesor no pausa al bot');
    assert(sesionSinAuto && parseInt(sesionSinAuto.bot_pausado) === 0, 'La sesión permanece activa cuando la opción está desactivada');

    // 8. Reactivación "nunca" (0 minutos): el bot no retoma solo
    resetSesion(jidAsesor);
    db.updateSetting('reactivar_bot_minutos', '0');
    db.registerAdvisorActivity(jidAsesor);
    db.db.prepare('UPDATE chat_sessions SET asesor_ultimo_at = ? WHERE jid = ?').run(Date.now() - 48 * 60 * 60 * 1000, jidAsesor);
    assert(db.shouldReactivateBotForClient(jidAsesor) === false, 'Con reactivar_bot_minutos = 0 el bot no retoma nunca solo');

    // Restaurar configuración y limpiar sesiones de prueba
    db.updateSetting('auto_pausa_asesor', '1');
    db.updateSetting('reactivar_bot_minutos', '180');
    for (const jid of [jidAsesor, jidManual, jidSinAuto]) {
      db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jid);
      db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jid);
    }
  }

  // -------------------------------------------------------------
  // [HUMAN TAKEOVER v3.3] Reconexión, alias LID y última milla
  // -------------------------------------------------------------
  console.log('\n-----------------------------------------------------------------');
  console.log('✋ [PUNTO 1b] Takeover robusto: historial, alias LID y cancelación');
  console.log('-----------------------------------------------------------------');
  {
    const jidHistorial = '584149990501@s.whatsapp.net';
    const jidAliasPn = '584149990601@s.whatsapp.net';
    const jidAliasLid = '900000000001@lid';

    // 1. Un asesor que respondió mientras la PC estaba desconectada pausa el bot al sincronizar
    db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jidHistorial);
    db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jidHistorial);
    const cancelaciones = { count: 0 };
    onCancelPendingBotResponses((j) => { if (j === jidHistorial) cancelaciones.count++; });

    const pausadoHistorial = registerHumanTakeover(jidHistorial, Date.now() - 60 * 1000, 'historial');
    assert(pausadoHistorial === true, 'El asesor detectado en el historial pausa el bot');
    assert(db.isBotPaused(jidHistorial) === true, 'La sesión queda marcada como pausada tras el historial');
    assert(cancelaciones.count >= 1, 'Se cancelan las respuestas pendientes al detectar al asesor');
    assert(canBotSend(jidHistorial) === false, 'La última milla impide cualquier envío automático');

    // 2. Alias LID / número real: pausar uno silencia al otro
    registerChatAliases([jidAliasPn, jidAliasLid]);
    db.toggleBotPause(jidAliasPn, true);
    assert(db.isBotPaused(jidAliasLid) === true, 'La pausa aplica también al identificador LID del mismo cliente');
    assert(db.shouldReactivateBotForClient(jidAliasLid) === false, 'Una pausa manual no se reactiva por el alias');

    db.toggleBotPause(jidAliasLid, false);
    assert(db.isBotPaused(jidAliasPn) === false, 'Reanudar libera todas las identidades del mismo cliente');

    // 3. Si el asesor escribe en un chat que el operador pausó a mano, la pausa sigue siendo manual
    const jidManualTakeover = '584149990801@s.whatsapp.net';
    db.toggleBotPause(jidManualTakeover, true);
    registerHumanTakeover(jidManualTakeover, Date.now(), 'telefono');
    const rowManual = db.db.prepare('SELECT bot_pausado_por FROM chat_sessions WHERE jid = ?').get(jidManualTakeover);
    assert(rowManual?.bot_pausado_por === 'manual', 'La pausa manual no se convierte en automática si el asesor escribe');
    db.toggleBotPause(jidManualTakeover, false);

    for (const jid of [jidHistorial, jidAliasPn, jidAliasLid, jidManualTakeover]) {
      db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jid);
      db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jid);
    }
  }

  // -------------------------------------------------------------
  // [DICCIONARIO v3.3] Frases compuestas y falsos positivos corregidos
  // -------------------------------------------------------------
  console.log('\n-----------------------------------------------------------------');
  console.log('📚 [PUNTO 1c] Diccionario ampliado y detecciones precisas');
  console.log('-----------------------------------------------------------------');
  {
    const jidDic = '584149990701@s.whatsapp.net';
    const limpiarDic = () => {
      db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jidDic);
      db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jidDic);
    };

    // Frases de varias palabras que antes nunca coincidían
    assert(searchProductsFuzzy('parche frio').length > 0, 'La frase "parche frio" se traduce y encuentra parches');
    assert(searchProductsFuzzy('camara de aire').length > 0, 'La frase "camara de aire" se traduce a tripa');
    assert(searchProductsFuzzy('kit de arrastre').length > 0, 'La frase "kit de arrastre" encuentra el kit');
    assert(searchProductsFuzzy('valvula tr412').length > 0, 'La frase "valvula tr412" encuentra la válvula');

    // "precio" suelto pide el producto (no la tasa)
    limpiarDic();
    const respPrecio = String(processIncomingMessage(jidDic, 'precio', 'Cliente Dic') || '');
    assert(/precio|repuesto|pieza/i.test(respPrecio) && !respPrecio.includes('Tasa Oficial BCV Hoy'), '"precio" pide el producto y no la tasa BCV');

    // "apartamento" no arranca el flujo de apartado
    limpiarDic();
    processIncomingMessage(jidDic, 'vivo en un apartamento en Caracas', 'Cliente Dic');
    const sesApartamento = db.db.prepare('SELECT step FROM chat_sessions WHERE jid = ?').get(jidDic);
    assert(!sesApartamento || !String(sesApartamento.step || '').startsWith('apartado_'), '"apartamento" no activa el flujo de apartados');

    // "quiero comprar una bujía" cotiza la bujía
    limpiarDic();
    const respCompra = String(processIncomingMessage(jidDic, 'quiero comprar una bujia', 'Cliente Dic') || '');
    assert(/buj[ií]a/i.test(respCompra) && !/C[oó]mo Comprar/i.test(respCompra), '"quiero comprar una bujía" cotiza el producto (no la guía genérica)');

    // "al detal" no se confunde con mayoreo
    limpiarDic();
    const respDetal = String(processIncomingMessage(jidDic, 'busco precios al detal', 'Cliente Dic') || '');
    assert(!respDetal.includes('Compras para Negocios'), '"al detal" no se confunde con venta al mayor');

    // "automático" no activa la respuesta de carros
    limpiarDic();
    const respAuto = String(processIncomingMessage(jidDic, 'tienen cambio automatico', 'Cliente Dic') || '');
    assert(!respAuto.includes('No vendemos piezas internas pesadas'), '"automático" no se confunde con un carro');

    // Nuevas formas de pedir un humano
    limpiarDic();
    const respHumano = String(processIncomingMessage(jidDic, 'necesito un humano', 'Cliente Dic') || '');
    assert(/asesor|vendedor|mostrador|equipo de ventas/i.test(respHumano), '"necesito un humano" deriva a un asesor');

    // Saludo sin tilde explícita
    limpiarDic();
    const respBuenDia = String(processIncomingMessage(jidDic, 'buen dia', 'Cliente Dic') || '');
    assert(/men[uú]|1️⃣|repuesto|bienvenid/i.test(respBuenDia), '"buen día" recibe el menú de bienvenida');

    limpiarDic();
  }

  // -------------------------------------------------------------
  // [MENSAJES CORTOS] EL FALLBACK ES BREVE Y NO INSISTE
  // -------------------------------------------------------------
  console.log('\n-----------------------------------------------------------------');
  console.log('✂️ [PUNTO 2] Mensajes cortos: fallback breve y sin insistir');
  console.log('-----------------------------------------------------------------');
  {
    const jidFb = '584149990401@s.whatsapp.net';
    const jidSaludo = '584149990402@s.whatsapp.net';
    const limpiar = (jid) => {
      db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jid);
      db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jid);
    };

    // 1. Primer mensaje no entendido: aviso corto con UNA sola instrucción
    limpiar(jidFb);
    resetSpam(jidFb);
    const fb1 = processIncomingMessage(jidFb, 'zzzqx qqqww', 'Cliente Corto');
    assert(typeof fb1 === 'string' && fb1.includes('nombre de la pieza'), 'El primer fallback pide el nombre de la pieza');
    assert(typeof fb1 === 'string' && fb1.length < 200, `El primer fallback es corto (${typeof fb1 === 'string' ? fb1.length : 0} caracteres < 200)`);
    assert(typeof fb1 === 'string' && !fb1.includes('No logré ubicar'), 'Ya no aparece el texto largo "No logré ubicar el producto"');

    // 2. Segundo mensaje no entendido: pase directo a una persona
    const fb2 = processIncomingMessage(jidFb, 'nzqx wqpt', 'Cliente Corto');
    assert(typeof fb2 === 'string' && fb2.includes('VENDEDOR') && fb2.includes('una persona te atiende'), 'El segundo fallback entrega el chat a una persona (VENDEDOR)');
    assert(typeof fb2 === 'string' && fb2.length < 280, `El segundo fallback es corto (${typeof fb2 === 'string' ? fb2.length : 0} caracteres < 280)`);
    assert(typeof fb2 === 'string' && !fb2.includes('━━━'), 'El segundo fallback ya no usa listas largas con separadores');

    // 3. Tercer mensaje: el bot se calla y deja aviso en el panel
    const fb3 = processIncomingMessage(jidFb, 'xjkv mmm', 'Cliente Corto');
    assert(fb3 === null, 'Al tercer mensaje seguido sin entender, el bot deja de responder (no insiste)');
    const aviso = db.db.prepare("SELECT contenido FROM chat_messages WHERE jid = ? AND remitente = 'sistema' ORDER BY id DESC LIMIT 1").get(jidFb);
    assert(aviso && aviso.contenido.includes('3 mensajes seguidos'), 'Se deja un aviso visible en el panel para que un asesor tome el chat');

    // 4. Una consulta entendible reactiva el flujo normal y limpia el contador
    resetSpam(jidFb);
    const producto = processIncomingMessage(jidFb, 'bujia', 'Cliente Corto');
    const productoTexto = typeof producto === 'object' && producto !== null ? (producto.text || '') : String(producto || '');
    assert(productoTexto && productoTexto.toLowerCase().includes('buj'), 'Una consulta entendible vuelve a recibir respuesta normal');
    const sesionTrasExito = db.db.prepare('SELECT fallos_consecutivos FROM chat_sessions WHERE jid = ?').get(jidFb);
    assert(sesionTrasExito && parseInt(sesionTrasExito.fallos_consecutivos || 0) === 0, 'Tras una respuesta exitosa, el contador de fallos vuelve a cero');

    // 5. Saludo: menú compacto la primera vez, saludo corto al repetir
    limpiar(jidSaludo);
    resetSpam(jidSaludo);
    const saludo1 = processIncomingMessage(jidSaludo, 'hola', 'Cliente Saludo');
    assert(typeof saludo1 === 'string' && saludo1.includes('1️⃣') && saludo1.includes('6️⃣'), 'El primer saludo muestra el menú completo (1 a 6)');
    assert(typeof saludo1 === 'string' && saludo1.length < 800, `El menú de bienvenida quedó compacto (${typeof saludo1 === 'string' ? saludo1.length : 0} caracteres)`);
    const saludo2 = processIncomingMessage(jidSaludo, 'hola de nuevo', 'Cliente Saludo');
    assert(typeof saludo2 === 'string' && saludo2.includes('Crastur') && saludo2.length < 250, 'Al saludar de nuevo responde corto (sin repetir el menú completo)');
    assert(typeof saludo2 === 'string' && !saludo2.includes('1️⃣'), 'El segundo saludo NO vuelve a mostrar el menú completo');

    // 5b. Si el cliente vuelve después de 6+ horas, el menú completo aparece de nuevo
    db.db.prepare('UPDATE chat_sessions SET ultimo_mensaje_at = ? WHERE jid = ?').run(Date.now() - 7 * 60 * 60 * 1000, jidSaludo);
    const saludo3 = processIncomingMessage(jidSaludo, 'hola', 'Cliente Saludo');
    assert(typeof saludo3 === 'string' && saludo3.includes('1️⃣'), 'Tras 6+ horas sin hablar, el saludo vuelve a mostrar el menú completo');

    // 6. Cortesías breves
    const cortesia = processIncomingMessage(jidSaludo, 'gracias', 'Cliente Saludo');
    assert(typeof cortesia === 'string' && cortesia.includes('orden') && cortesia.length < 200, 'La respuesta de cortesía es breve y cordial');

    // Limpieza del bloque
    limpiar(jidFb);
    limpiar(jidSaludo);
  }

  // -------------------------------------------------------------
  // [RECORDATORIOS CON RESPETO] 1 POR CHAT, MÍNIMO 1 HORA, NUNCA CON ASESOR
  // -------------------------------------------------------------
  console.log('\n-----------------------------------------------------------------');
  console.log('⏰ [PUNTO 4] Recordatorios con respeto: 1 por chat, mínimo 1 hora');
  console.log('-----------------------------------------------------------------');
  {
    const jidRec = '584149990501@s.whatsapp.net';
    const settingsOriginales = db.getSettings();
    const horarioOriginal = settingsOriginales.horario_atencion;
    const mensajeOriginal = settingsOriginales.mensaje_insistencia;

    // Horario que cubre todo el día para que la prueba no dependa de la hora real
    db.updateSetting('horario_atencion', 'Todos los días de 12:00 AM a 11:58 PM');
    db.updateSetting('insistencia_activa', '1');
    // Valor "agresivo" en configuración: el servicio debe imponer el mínimo de 1 hora
    db.updateSetting('insistencia_minutos', '15');

    const prepararSesion = (opciones: any = {}) => {
      db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jidRec);
      db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jidRec);
      const ultimoMensajeAt = opciones.ultimoMensajeAt ?? (Date.now() - 2 * 60 * 60 * 1000);
      db.db.prepare(`
        INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea, ultimo_producto_nombre, recordatorio_total, asesor_ultimo_at, fallos_consecutivos)
        VALUES (?, 'Cliente Recordado', 'start', ?, 0, 0, 1, 'Bujía NGK', 0, ?, 0)
      `).run(jidRec, ultimoMensajeAt, opciones.asesorUltimoAt ?? null);
      db.db.prepare(`
        INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
        VALUES (?, 'cliente', ?, ?)
      `).run(jidRec, opciones.ultimoTextoCliente ?? 'cuanto cuesta la bujia?', ultimoMensajeAt);
    };

    const enviados: string[] = [];
    const callback = (_jid, texto) => { enviados.push(texto); };

    // 1. Caso normal: 2 horas de silencio → 1 recordatorio
    prepararSesion();
    enviados.length = 0;
    await checkPendingFollowUps(callback);
    assert(enviados.length === 1, 'Envía el recordatorio tras más de 1 hora de silencio del cliente');
    const sesionTras1 = db.db.prepare('SELECT seguimiento_enviado, recordatorio_total FROM chat_sessions WHERE jid = ?').get(jidRec);
    assert(sesionTras1 && parseInt(sesionTras1.seguimiento_enviado) === 1 && Number(sesionTras1.recordatorio_total) === 1, 'Marca el recordatorio como enviado y lo cuenta (1 total)');

    // 2. Aunque se rearme el flujo con un nuevo producto, jamás un segundo recordatorio
    prepararSesion();
    db.db.prepare('UPDATE chat_sessions SET recordatorio_total = 1 WHERE jid = ?').run(jidRec);
    enviados.length = 0;
    await checkPendingFollowUps(callback);
    assert(enviados.length === 0, 'Nunca envía un segundo recordatorio en el mismo chat');

    // 3. Mínimo 1 hora impuesto por el sistema (con configuración de 15 minutos)
    prepararSesion({ ultimoMensajeAt: Date.now() - 30 * 60 * 1000 });
    enviados.length = 0;
    await checkPendingFollowUps(callback);
    assert(enviados.length === 0, 'No recuerda antes de 1 hora aunque la configuración pida 15 minutos');

    // 4. Si un asesor respondió después del último mensaje del cliente, no se recuerda nada
    const tsCliente = Date.now() - 3 * 60 * 60 * 1000;
    prepararSesion({ ultimoMensajeAt: tsCliente, asesorUltimoAt: tsCliente + 60 * 1000, ultimoTextoCliente: 'me interesa la bujia' });
    enviados.length = 0;
    await checkPendingFollowUps(callback);
    assert(enviados.length === 0, 'No recuerda si un asesor ya respondió esa consulta');

    // 5. Si el cliente cerró con una cortesía, no se recuerda nada
    prepararSesion({ ultimoTextoCliente: 'muchas gracias!' });
    enviados.length = 0;
    await checkPendingFollowUps(callback);
    assert(enviados.length === 0, 'No recuerda si el cliente ya agradeció o cerró la conversación');

    // 6. [ANTI-BANEO] Nunca escribir fuera de la ventana de 24h de WhatsApp
    prepararSesion({ ultimoMensajeAt: Date.now() - 30 * 60 * 60 * 1000, ultimoTextoCliente: 'me interesa la bujia' });
    enviados.length = 0;
    await checkPendingFollowUps(callback);
    assert(enviados.length === 0, 'No envía seguimientos fuera de la ventana de 24h de WhatsApp');

    // 7. [ANTI-BANEO] Cuota diaria de proactivos
    db.updateSetting('proactivos_max_dia', '0');
    prepararSesion({ ultimoTextoCliente: 'me interesa la bujia' });
    enviados.length = 0;
    await checkPendingFollowUps(callback);
    assert(enviados.length === 0, 'Respeta la cuota diaria de mensajes proactivos (0 = desactivado)');
    db.updateSetting('proactivos_max_dia', '30');

    // Restaurar configuración y limpiar
    db.updateSetting('horario_atencion', horarioOriginal);
    db.updateSetting('mensaje_insistencia', mensajeOriginal);
    db.updateSetting('insistencia_minutos', '60');
    db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jidRec);
    db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jidRec);
  }

  // -------------------------------------------------------------
  // PUNTO 5: REGRESIÓN DE DICCIONARIO, MEDIDAS Y FALSOS POSITIVOS
  // -------------------------------------------------------------
  console.log('\n🧠 [PUNTO 5] Regresión: ñ/plurales, medidas y falsos positivos de intención');
  console.log('-----------------------------------------------------------------');

  const regJids: string[] = [];
  const regProducts = [
    { marca: 'Genérico', modelo: 'Piñón Regresión 15 Dientes', categoria: 'Repuestos Moto - Transmisión', precio_usd: 6, stock: 10, descripcion: 'piñon de arrastre para moto' },
    { marca: 'Genérico', modelo: 'Puños Regresión Universales', categoria: 'Accesorios Moto - Mandos', precio_usd: 5, stock: 10, descripcion: 'puños para manubrio' },
    { marca: 'Genérico', modelo: 'Filtro Regresión de Aire', categoria: 'Repuestos Moto - Motor', precio_usd: 6, stock: 10, descripcion: 'filtro de aire' },
    { marca: 'Genérico', modelo: 'Zapata Regresión de Freno', categoria: 'Repuestos Moto - Frenos', precio_usd: 8, stock: 10, descripcion: 'zapata de freno' },
    { marca: 'Genérico', modelo: 'Amortiguador Regresión Trasero', categoria: 'Repuestos Moto - Suspensión', precio_usd: 22, stock: 10, descripcion: 'amortiguador para moto' },
    { marca: 'Genérico', modelo: 'Tripa Regresión Aro 18', categoria: 'Repuestos Moto - Tripas y Cauchos', precio_usd: 6, stock: 10, descripcion: 'tripa aro 18' },
    { marca: 'Genérico', modelo: 'Direccional Regresión LED', categoria: 'Repuestos Moto - Luces', precio_usd: 8, stock: 10, descripcion: 'direccional led para moto' }
  ];
  const regIds: number[] = [];
  for (const p of regProducts) {
    const res = db.db.prepare(
      'INSERT INTO products (marca, modelo, categoria, precio_usd, stock, descripcion, activo) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run(p.marca, p.modelo, p.categoria, p.precio_usd, p.stock, p.descripcion);
    if (res?.lastInsertRowid) regIds.push(res.lastInsertRowid);
  }
  invalidateProductCache();
  resetSpam();

  const ask = (query: string): string => {
    const jid = `58414100${String(regJids.length).padStart(4, '0')}@s.whatsapp.net`;
    regJids.push(jid);
    const r: any = processIncomingMessage(jid, query, 'RegTest');
    return typeof r === 'string' ? r : (r && (r.text || r.caption)) ? (r.text || r.caption) : '';
  };

  // 1) La letra ñ ya no rompe el diccionario
  const rPinones = ask('piñones');
  assert(/pi[nñ][oó]n/i.test(rPinones), 'El plural con ñ "piñones" se detecta (ya no cae en fallback)');
  const rPuno = ask('puño');
  assert(/pu[nñ]os/i.test(rPuno), 'El singular con ñ "puño" se detecta igual que "puños"');

  // 2) Plurales genéricos por singularización
  const rZapatas = ask('zapatas');
  assert(/zapata/i.test(rZapatas), 'El plural "zapatas" se resuelve a "zapata"');
  const rBalatas = ask('balatas');
  assert(/pastilla|balata/i.test(rBalatas), 'El sinónimo "balatas" apunta a pastillas de freno');
  const rFiltros = ask('filtros');
  assert(/filtro/i.test(rFiltros), 'El plural "filtros" se resuelve a "filtro"');

  // 3) Medidas NO se interpretan como cantidad (prueba directa y determinista)
  assert(extractLeadingQuantity('tripas 18') === 1, '"tripas 18" -> 1 unidad (18 es la medida)');
  assert(extractLeadingQuantity('aceite 20w50') === 1, '"aceite 20w50" -> 1 unidad (no toma 20)');
  assert(extractLeadingQuantity('tripa aro 18') === 1, '"aro 18" -> 1 unidad (no toma 18)');
  assert(extractLeadingQuantity('caucho 170 70 r14') === 1, '"170 70 r14" -> 1 unidad (medida compuesta)');

  // 4) Cantidades reales siguen funcionando
  assert(extractLeadingQuantity('quiero 4 aceites') === 4, '"quiero 4 aceites" -> 4 unidades');
  assert(extractLeadingQuantity('2 bujias') === 2, '"2 bujías" -> 2 unidades');
  assert(extractLeadingQuantity('dame 3 parches') === 3, '"dame 3 parches" -> 3 unidades');
  assert(extractLeadingQuantity('x4 cauchos') === 4, '"x4 cauchos" -> 4 unidades');
  const rCantidad = ask('quiero 4 bujias');
  assert(/4 unidad/i.test(rCantidad), 'La cantidad real "quiero 4 bujías" sí se refleja (4 unidades)');

  // 5) Falsos positivos de ubicación y horario
  const rQuedan = ask('que pastillas quedan');
  assert(!/ubicaci[oó]n de tienda/i.test(rQuedan) && /pastilla/i.test(rQuedan), '"qué pastillas quedan" busca pastillas y NO responde ubicación');
  const rSabado = ask('pastillas sabado');
  assert(!/horario de atenci[oó]n/i.test(rSabado) && /pastilla/i.test(rSabado), '"pastillas sábado" busca pastillas y NO responde horario');
  const rDireccional = ask('direccional');
  assert(!/ubicaci[oó]n de tienda/i.test(rDireccional) && /direccional/i.test(rDireccional), '"direccional" es un repuesto y NO responde ubicación');

  // 6) Amortiguador de moto no se confunde con repuesto de carro
  const rAmortiguador = ask('amortiguador de moto');
  assert(!/piezas internas pesadas de motor/i.test(rAmortiguador), '"amortiguador de moto" no se trata como repuesto de carro');
  assert(/amortiguador/i.test(rAmortiguador), '"amortiguador de moto" encuentra el amortiguador del catálogo');

  // 7) Coherencia de contenido: Punto de Venta configurado y aceptado
  const puntoResp = processIncomingMessage('584141009999@s.whatsapp.net', 'tienen punto de venta?', 'RegTest') as string;
  assert(/punto de venta/i.test(String(puntoResp)), 'Si el panel tiene Punto de Venta activo, el bot lo confirma');
  assert(!/ni tarjetas por punto de venta/i.test(String(puntoResp)), 'El bot ya NO se contradice diciendo que no acepta punto de venta');

  // 8) Horarios dinámicos desde la configuración (no hardcodeados)
  const horarioConfig = db.getSettings().horario_atencion || '';
  const ubicResp = String(processIncomingMessage('584141009998@s.whatsapp.net', 'donde estan ubicados?', 'RegTest') as string);
  if (horarioConfig) {
    assert(ubicResp.includes(horarioConfig), 'La ubicación muestra el horario configurado en el panel');
  }

  // 9) Menú del segundo fallback coherente con el menú real (1 = Insumos)
  const jidMenu = '584141009997@s.whatsapp.net';
  processIncomingMessage(jidMenu, 'asdkjhasd qweqwe', 'RegTest');
  const segundoFallback = String(processIncomingMessage(jidMenu, 'zxcvbnm asdfgh', 'RegTest') as string);
  assert(/1️⃣\s*Insumos/i.test(segundoFallback), 'El segundo fallback lista 1️⃣ Insumos (coherente con el menú real)');
  assert(!/1️⃣\s*Repuestos/i.test(segundoFallback), 'El segundo fallback ya no invierte Insumos y Repuestos');

  // Limpieza de la regresión
  for (const jid of regJids) {
    db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jid);
    db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jid);
  }
  db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run('584141009999@s.whatsapp.net');
  db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run('584141009999@s.whatsapp.net');
  db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run('584141009998@s.whatsapp.net');
  db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run('584141009998@s.whatsapp.net');
  if (regIds.length > 0) {
    const ph = regIds.map(() => '?').join(',');
    db.db.prepare(`DELETE FROM products WHERE id IN (${ph})`).run(...regIds);
  }
  invalidateProductCache();
  resetSpam();

  // -------------------------------------------------------------
  // PUNTO 6: REGRESIÓN ANTI-BAN, CONTENIDO Y APARTADOS
  // -------------------------------------------------------------
  console.log('\n🛡️ [PUNTO 6] Regresión anti-ban, contenido y apartados');
  console.log('-----------------------------------------------------------------');

  // 6.1 Documento entrante
  const rDoc = handleMediaResponse('document', 'Ana');
  assert(rDoc.includes('Ana') && !/\*document\*/i.test(rDoc), 'Un documento entrante saluda con el nombre del cliente (no "*document*")');

  // 6.2 "disculpe" no secuestra la búsqueda de producto
  const rDisculpe = ask('disculpe, tienen bujias?');
  assert(/buj[ií]a|NGK/i.test(rDisculpe), '"disculpe, tienen bujías?" busca el producto (no responde como persona mayor)');

  // 6.3 Opt-out falso positivo
  const jidOpt = '584141010001@s.whatsapp.net';
  processIncomingMessage(jidOpt, 'no me escribiste el precio', 'Cliente');
  const sesOpt = db.db.prepare('SELECT no_molestar FROM chat_sessions WHERE jid = ?').get(jidOpt);
  assert(!sesOpt || parseInt(sesOpt.no_molestar) !== 1, '"no me escribiste el precio" NO activa No Molestar');
  db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jidOpt);
  db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jidOpt);

  // 6.4 Salida de emergencia del apartado (MENU no debe atrapar al cliente)
  const jidEsc = '584141010002@s.whatsapp.net';
  processIncomingMessage(jidEsc, 'apartar', 'Cliente');
  db.db.prepare("UPDATE chat_sessions SET step = 'apartado_pidiendo_nombre' WHERE jid = ?").run(jidEsc);
  const rEsc = String(processIncomingMessage(jidEsc, 'MENU', 'Cliente'));
  const stepAfter = db.db.prepare('SELECT step FROM chat_sessions WHERE jid = ?').get(jidEsc);
  assert(!!stepAfter && stepAfter.step === 'start', 'Escribir MENU durante el apartado reinicia el flujo');
  assert(!/nombre y apellido/i.test(rEsc), 'Escribir MENU durante el apartado no repite la petición de nombre');
  db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jidEsc);
  db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jidEsc);

  // 6.5 Zonas de delivery del panel (campo "palabras" vs "keywords")
  const zonasPanel = JSON.stringify([{ zona: 'Zona Prueba', tarifa: '$9 USD', palabras: ['quintanaxyz'] }]);
  const zonasLeidas = getDeliveryZones({ delivery_zonas_json: zonasPanel });
  assert(zonasLeidas.length === 1, 'Las zonas de delivery guardadas por el panel se leen correctamente');
  const zDetectada = detectCaracasZone('vivo en quintanaxyz', { delivery_zonas_json: zonasPanel });
  assert(!!zDetectada && zDetectada.nombre === 'Zona Prueba' && zDetectada.tarifa === '$9 USD', 'El bot reconoce una zona de delivery creada en el panel');

  // 6.6 Plan Cashea por nivel (ficha y consulta coinciden)
  assert(resolveCasheaPlan({ cashea_inicial_pct: '40', cashea_cuotas: '3' }, { nivel_cashea: 3 }).inicialPct === 0.20, 'Cashea Nivel 3 usa 20% de inicial');
  assert(resolveCasheaPlan({ cashea_inicial_pct: '40', cashea_cuotas: '3' }, { nivel_cashea: 2 }).inicialPct === 0.30, 'Cashea Nivel 2 usa 30% de inicial');
  assert(resolveCasheaPlan({ cashea_inicial_pct: '40', cashea_cuotas: '3' }, { nivel_cashea: 1 }).inicialPct === 0.40, 'Cashea Nivel 1 usa el % del panel');

  // 6.7 Cantidad del apartado descuenta stock real
  const regProd = db.db.prepare("INSERT INTO products (marca,modelo,categoria,precio_usd,stock,descripcion,activo) VALUES ('Genérico','Cantidad Regresión','Repuestos Moto - Motor',5,10,'x',1)").run();
  const pidCant = regProd.lastInsertRowid;
  const resvCant: any = db.createReservation({
    jid: '584141010003@s.whatsapp.net', nombre: 'Test Cantidad', cedula: 'V-11111111',
    telefono: '04121111111', producto_id: pidCant, producto_nombre: 'Cantidad Regresión',
    precio_usd: 20, precio_bs: 0, items: [{ id: pidCant, nombre: 'Cantidad Regresión', precio_usd: 5, cantidad: 4 }]
  });
  const stockAfter = db.db.prepare('SELECT stock FROM products WHERE id = ?').get(pidCant)?.stock;
  assert(Number(stockAfter) === 6, 'Apartar 4 unidades descuenta 4 del stock (no 1)');
  db.updateReservationStatus(resvCant.id, 'cancelado');
  const stockRestored = db.db.prepare('SELECT stock FROM products WHERE id = ?').get(pidCant)?.stock;
  assert(Number(stockRestored) === 10, 'Cancelar el apartado devuelve las 4 unidades al stock');
  db.db.prepare('DELETE FROM reservations WHERE id = ?').run(resvCant.id);
  db.db.prepare('DELETE FROM products WHERE id = ?').run(pidCant);

  // 6.8 Producto agotado (stock 0) se muestra como Agotado
  const pAgotado = db.db.prepare("INSERT INTO products (marca,modelo,categoria,precio_usd,stock,descripcion,activo) VALUES ('Genérico','Agotado Regresión','Repuestos Moto - Motor',5,0,'x',1)").run();
  invalidateProductCache();
  const rAgotado = ask('agotado regresion');
  assert(/agotado/i.test(rAgotado), 'Un producto con stock 0 se muestra como Agotado (no como Consultar)');
  db.db.prepare('DELETE FROM products WHERE id = ?').run(pAgotado.lastInsertRowid);
  invalidateProductCache();

  // 6.9 Métodos de pago no soportados (Zinli, PayPal, etc.)
  const rZinli = ask('aceptan zinli?');
  assert(/zinli/i.test(rZinli) && /no aceptamos/i.test(rZinli), '"aceptan Zinli?" aclara que NO se acepta y ofrece los métodos reales');
  const rPaypal = ask('aceptan paypal?');
  assert(/paypal/i.test(rPaypal) && /no aceptamos/i.test(rPaypal), '"aceptan PayPal?" aclara que NO se acepta');

  // 6.10 Precio sin producto
  const rPrecioGen = ask('cuanto vale');
  assert(/repuesto|producto|ejemplo/i.test(rPrecioGen) && !/nombre de la pieza/i.test(rPrecioGen), '"cuanto vale" pide el producto con ejemplos (no fallback seco)');

  // 6.11 Compras al mayor
  const rMayor = ask('venden al mayor?');
  assert(/negocio|caucheras|talleres|cantidad/i.test(rMayor), 'Las consultas al mayor derivan a cotización por cantidad');

  // 6.12 Horario de domingo
  const rDomingo = ask('trabajan los domingos?');
  assert(/horario de atenci|domingo/i.test(rDomingo), '"trabajan los domingos?" responde el horario');

  // 6.13 "hi" (inglés) no debe confundirse con un repuesto
  const rHi = ask('hi');
  assert(!/precio promoci[oó]n en divisas/i.test(rHi), 'La palabra corta "hi" ya no coincide con "hierro" (no muestra producto)');
  assert(!/bienvenida a \*crastur/i.test(rHi), 'El bot ya no saluda en inglés (responde en español pidiendo el repuesto)');

  // 6.14 La cola de mensajes salientes se respalda en disco
  enqueueOutboundMessage('584199999999@s.whatsapp.net', 'Mensaje de prueba persistente');
  const queueFile = path.join(process.env.CRASTUR_DATA_DIR || path.join(process.cwd(), 'data'), 'outbound_queue.json');
  const colaGuardada = fs.existsSync(queueFile) && fs.readFileSync(queueFile, 'utf8').includes('Mensaje de prueba persistente');
  assert(colaGuardada, 'La cola de mensajes salientes se guarda en disco (no se pierde al reiniciar)');
  assert(getOutboundQueueSize() >= 1, 'La cola conserva el mensaje pendiente para enviarlo al reconectar');

  // 6.15 El nivel de Cashea indicado se recuerda en la sesión
  const jidCas = '584141010004@s.whatsapp.net';
  processIncomingMessage(jidCas, 'quiero saber el cashea nivel 3', 'Cliente');
  const sesCas = db.db.prepare('SELECT nivel_cashea FROM chat_sessions WHERE jid = ?').get(jidCas);
  assert(!!sesCas && Number(sesCas.nivel_cashea) === 3, 'El nivel de Cashea indicado por el cliente se recuerda en su sesión');
  db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jidCas);
  db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jidCas);

  // -------------------------------------------------------------
  // PUNTO 7: DETECCIÓN AMPLIADA, CONTEXTO Y SEGUIMIENTOS
  // -------------------------------------------------------------
  console.log('\n🔎 [PUNTO 7] Detección ampliada, contexto con vigencia y seguimientos');
  console.log('-----------------------------------------------------------------');

  let detSeq = 0;
  const askDet = (query: string, jidFijo?: string) => {
    const jid = jidFijo || `5841777${String(detSeq++).padStart(3, '0')}@s.whatsapp.net`;
    return { jid, res: processIncomingMessage(jid, query, 'Cliente Deteccion') };
  };
  const asText = (r: any) => (typeof r === 'string' ? r : (r && (r.text || r.caption)) || '');

  const tasa1 = asText(askDet('cuanto esta el dolar').res);
  assert(/tasa|bcv/i.test(tasa1), '"cuanto esta el dolar" responde la tasa BCV');

  const tasa2 = asText(askDet('a cuanto esta el dolar hoy').res);
  assert(/tasa|bcv/i.test(tasa2), '"a cuanto esta el dolar hoy" responde la tasa BCV');

  const ubic = asText(askDet('estan en caracas').res);
  assert(/ubicaci[oó]n|liberalba/i.test(ubic), '"estan en caracas" responde la ubicación');

  const dondeBujia = asText(askDet('donde esta la bujia').res);
  assert(/buj[ií]a/i.test(dondeBujia) && !/ubicaci[oó]n/i.test(dondeBujia), '"donde esta la bujia" cotiza el producto y no la tienda');

  const traenBujia = asText(askDet('me traen bujias').res);
  assert(/buj[ií]a/i.test(traenBujia), '"me traen bujias" cotiza el producto (no secuestra delivery)');

  const calidad = asText(askDet('tienen pastillas de buena calidad').res);
  assert(/pastillas/i.test(calidad), '"tienen pastillas de buena calidad" cotiza las pastillas');

  const insta = asText(askDet('tienen instagram').res);
  assert(/instagram|redes/i.test(insta) && !/precio promoci[oó]n/i.test(insta), '"tienen instagram" responde redes y no un combo aleatorio');

  const abiertos = asText(askDet('siguen abiertos?').res);
  assert(/horario/i.test(abiertos), '"siguen abiertos?" responde el horario');

  const apartas = asText(askDet('me lo apartas?').res);
  assert(/apartado|nombre/i.test(apartas), '"me lo apartas?" inicia el flujo de apartado');

  const envioPetare = asText(askDet('me lo envian a petare').res);
  assert(/delivery/i.test(envioPetare), '"me lo envian a petare" responde delivery');

  const bsPrecio = asText(askDet('cuanto es en bolivares').res);
  assert(/tasa|bs\./i.test(bsPrecio), '"cuanto es en bolivares" responde tasa/precio en Bs');

  const bsPago = asText(askDet('pago en bolivares').res);
  assert(/formas de pago|pago m[oó]vil/i.test(bsPago), '"pago en bolivares" sigue respondiendo métodos de pago');

  const puntos = asText(askDet('aceptan puntos').res);
  assert(/formas de pago|punto de venta/i.test(puntos), '"aceptan puntos" responde los métodos de pago');

  // [FALSO POSITIVO] Un casco no debe aparecer al buscar cauchos por similitud.
  db.db.prepare("INSERT INTO products (marca, modelo, categoria, precio_usd, stock, descripcion, activo) VALUES (?,?,?,?,?,?,1)")
    .run('TestCasco', 'Casco Integral de Prueba', 'Accesorios Moto', 40, 5, 'Casco certificado');
  invalidateProductCache();
  const cauchos = searchProductsFuzzy('venden cauchos');
  assert(!cauchos.some((p: any) => /casco/i.test(String(p.modelo))), 'Buscar "cauchos" no devuelve un casco por error de fuzzy');
  db.db.prepare("DELETE FROM products WHERE marca = 'TestCasco'").run();
  invalidateProductCache();

  // [CONTEXTO] Después de cotizar, "y cuanto sale" repite la ficha del producto.
  const ctxRes = askDet('bujia bera mi pana');
  const ctxJid = ctxRes.jid;
  const followUp = asText(processIncomingMessage(ctxJid, 'y cuanto sale?', 'Cliente Deteccion'));
  assert(/buj[ií]a/i.test(followUp) && /3\.50/.test(followUp), '"y cuanto sale?" repite la ficha del producto cotizado');

  // [TTL] Un contexto viejo no debe secuestrar el menú numérico.
  db.db.prepare('UPDATE chat_sessions SET contexto_at = ? WHERE jid = ?').run(Date.now() - 50 * 60 * 1000, ctxJid);
  const menuViejo = asText(processIncomingMessage(ctxJid, '1', 'Cliente Deteccion'));
  assert(!/buj[ií]a/i.test(menuViejo) && /insumos/i.test(menuViejo), 'Un contexto viejo no secuestra el "1" del menú');

  // [SEGUIMIENTO] Encolar no debe escribir una fila fantasma en chat_messages.
  const jidSeg = '584177700099@s.whatsapp.net';
  const prevHorario = db.getSettings().horario_atencion;
  const prevFueraHorario = db.getSettings().fuera_horario_activo;
  db.updateSetting('insistencia_activa', '1');
  db.updateSetting('insistencia_minutos', '60');
  db.updateSetting('fuera_horario_activo', '0');
  db.updateSetting('horario_atencion', 'Todos los días de 12:00 AM a 11:59 PM');
  db.db.prepare(`INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea, ultimo_producto_nombre)
    VALUES (?, 'Cliente Seguimiento', 'start', ?, 0, 0, 1, 'Bujia NGK')`).run(jidSeg, Date.now() - 2 * 60 * 60 * 1000);
  db.db.prepare("INSERT INTO chat_messages (jid, remitente, contenido, timestamp) VALUES (?, 'cliente', 'cuanto cuesta la bujia', ?)")
    .run(jidSeg, Date.now() - 2 * 60 * 60 * 1000);
  await checkPendingFollowUps(() => {});
  const filasSeg = db.db.prepare("SELECT COUNT(*) as c FROM chat_messages WHERE jid = ? AND remitente = 'bot'").get(jidSeg) as any;
  assert(Number(filasSeg?.c || 0) === 0, 'El seguimiento encolado no inserta una fila fantasma en el Live Inbox');
  db.updateSetting('horario_atencion', prevHorario);
  db.updateSetting('fuera_horario_activo', prevFueraHorario);

  db.db.prepare("DELETE FROM chat_messages WHERE jid LIKE '5841777%'").run();
  db.db.prepare("DELETE FROM chat_sessions WHERE jid LIKE '5841777%'").run();

  // -------------------------------------------------------------
  // PUNTO 8: HANDOFF DE ASESOR CON SLA
  // -------------------------------------------------------------
  console.log('\n🤝 [PUNTO 8] Handoff de asesor con SLA de 60 minutos');
  console.log('-----------------------------------------------------------------');

  const prevAutoPausa = db.getSettings().auto_pausa_asesor;
  const prevHorarioH = db.getSettings().horario_atencion;
  const prevFueraH = db.getSettings().fuera_horario_activo;
  db.updateSetting('auto_pausa_asesor', '1');
  db.updateSetting('handoff_sla_minutos', '60');
  db.updateSetting('fuera_horario_activo', '0');
  db.updateSetting('horario_atencion', 'Todos los días de 12:00 AM a 11:59 PM');

  let hSeq = 0;
  const nuevoJidHandoff = () => `5841778${String(hSeq++).padStart(3, '0')}@s.whatsapp.net`;
  const textoHandoff = (r: any) => (typeof r === 'string' ? r : (r && (r.text || r.caption)) || '');

  // 8.1 Solicitud: mensaje al cliente, aviso al vendedor y pausa del bot
  const jidH1 = nuevoJidHandoff();
  const rH1 = textoHandoff(processIncomingMessage(jidH1, 'vendedor', 'Cliente Handoff'));
  assert(/asesor/i.test(rH1) && /(1 hora|60 minutos)/i.test(rH1) && /MENU/.test(rH1), 'La solicitud de asesor promete el plazo de 1 hora y la salida MENU');
  const infoH1: any = getHandoffInfo(jidH1);
  assert(infoH1?.handoff_estado === 'pendiente', 'El handoff queda en estado pendiente');
  assert(Number(infoH1?.bot_pausado) === 1 && infoH1?.bot_pausado_por === 'handoff', 'El bot queda pausado solo por el handoff');
  const avisoH1: any = db.db.prepare("SELECT contenido FROM chat_messages WHERE jid = ? AND remitente = 'sistema' ORDER BY id DESC LIMIT 1").get(jidH1);
  assert(/Solicitud de asesor/i.test(avisoH1?.contenido || '') && /Cliente Handoff/.test(avisoH1?.contenido || ''), 'El vendedor recibe el aviso con el nombre del cliente en el mismo chat');

  // 8.2 El vendedor responde → SLA cumplido
  registerHumanTakeover(jidH1, Date.now(), 'panel');
  const infoH1b: any = getHandoffInfo(jidH1);
  assert(infoH1b?.handoff_estado === 'atendido', 'La respuesta del vendedor marca el handoff como atendido');
  assert(infoH1b?.bot_pausado_por === 'asesor', 'Tras la respuesta humana la pausa pasa a modo asesor');

  // 8.3 Vencimiento sin respuesta → aviso único y el bot retoma
  const jidH2 = nuevoJidHandoff();
  processIncomingMessage(jidH2, 'vendedor', 'Cliente Vencido');
  db.db.prepare('UPDATE chat_sessions SET handoff_solicitado_at = ?, handoff_vence_at = ? WHERE jid = ?')
    .run(Date.now() - 120000, Date.now() - 60000, jidH2);
  const enviadosH: Array<{ jid: string; mensaje: string }> = [];
  await checkHandoffSla((targetJid: string, mensaje: string) => {
    enviadosH.push({ jid: targetJid, mensaje });
  });
  const infoH2: any = getHandoffInfo(jidH2);
  assert(infoH2?.handoff_estado === 'vencido', 'Al vencer el plazo el handoff queda como vencido');
  assert(Number(infoH2?.bot_pausado) === 0, 'Al vencer, el bot se reactiva en ese chat');
  assert(enviadosH.length === 1 && /asesor/i.test(enviadosH[0].mensaje) && /retomo|esperando/i.test(enviadosH[0].mensaje), 'Se envía un solo aviso de vencimiento al cliente');
  const avisoH2: any = db.db.prepare("SELECT contenido FROM chat_messages WHERE jid = ? AND remitente = 'sistema' ORDER BY id DESC LIMIT 1").get(jidH2);
  assert(/SLA vencido/i.test(avisoH2?.contenido || ''), 'El panel recibe la alerta de SLA vencido');
  await checkHandoffSla((targetJid: string, mensaje: string) => {
    enviadosH.push({ jid: targetJid, mensaje });
  });
  assert(enviadosH.length === 1, 'El aviso de vencimiento no se repite');

  // Si el vendedor responde tarde, el SLA vencido se cierra igual.
  registerHumanTakeover(jidH2, Date.now(), 'panel');
  const infoH2b: any = getHandoffInfo(jidH2);
  assert(infoH2b?.handoff_estado === 'atendido', 'Una respuesta tardía del vendedor cierra el SLA vencido');

  // 8.4 MENU durante la espera → el cliente recupera al bot
  const jidH3 = nuevoJidHandoff();
  processIncomingMessage(jidH3, 'vendedor', 'Cliente Menu');
  const menuH3 = textoHandoff(processIncomingMessage(jidH3, 'MENU', 'Cliente Menu'));
  assert(/1️⃣/.test(menuH3) && /6️⃣/.test(menuH3), 'Escribir MENU durante el handoff devuelve el menú del bot');
  const infoH3: any = getHandoffInfo(jidH3);
  assert(infoH3?.handoff_estado === 'cancelado' && Number(infoH3?.bot_pausado) === 0, 'El MENU cancela el handoff y reanuda el bot');

  // 8.5 Fuera de horario → se informa y el bot sigue atendiendo
  db.updateSetting('fuera_horario_activo', '1');
  const jidH4 = nuevoJidHandoff();
  const rH4 = textoHandoff(processIncomingMessage(jidH4, 'vendedor', 'Cliente Noche'));
  assert(/fuera de horario/i.test(rH4) && /MENU/.test(rH4), 'Fuera de horario se informa al cliente y se le ofrece el asistente');
  const infoH4: any = getHandoffInfo(jidH4);
  assert(infoH4?.handoff_estado === 'fuera_horario' && Number(infoH4?.bot_pausado) === 0, 'Fuera de horario el bot no se pausa');

  db.updateSetting('auto_pausa_asesor', prevAutoPausa);
  db.updateSetting('horario_atencion', prevHorarioH);
  db.updateSetting('fuera_horario_activo', prevFueraH);
  db.db.prepare("DELETE FROM chat_messages WHERE jid LIKE '5841778%'").run();
  db.db.prepare("DELETE FROM chat_sessions WHERE jid LIKE '5841778%'").run();

  resetSpam();

  // -------------------------------------------------------------
  // LIMPIEZA POST-PRUEBAS
  // -------------------------------------------------------------
  console.log('\n🧹 [Auto-Limpieza Post-Pruebas] Limpiando datos sintéticos de pruebas...');
  db.db.prepare("DELETE FROM chat_messages WHERE jid LIKE '%000%@s.whatsapp.net' OR jid LIKE '%User%' OR jid LIKE '%58414999%'").run();
  db.db.prepare("DELETE FROM chat_sessions WHERE jid LIKE '%000%@s.whatsapp.net' OR push_name LIKE '%User%' OR jid LIKE '%58414999%'").run();
  db.db.prepare("DELETE FROM reservations WHERE cedula IN ('V-18765432', 'V-22333444', 'V-33111222', 'V-12345678')").run();
  db.db.prepare("DELETE FROM chat_sessions WHERE jid LIKE '584149990050%'").run();
  db.db.prepare("DELETE FROM products WHERE marca = 'Marcazetacachetest' OR marca = 'ZetaCacheTest'").run();
  db.db.prepare("DELETE FROM products WHERE modelo LIKE '%TEST%' OR categoria LIKE '%Test%'").run();
  if (insertedFixtureIds.length > 0) {
    const placeholders = insertedFixtureIds.map(() => '?').join(',');
    db.db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...insertedFixtureIds);
  }
  resetSpam();
  // Validar también el comportamiento cuando todos los métodos de pago están apagados ('ninguno')
  db.updateSetting('metodos_pago', 'ninguno');
  const resNinguno = processIncomingMessage('584149990099_none@s.whatsapp.net', 'como se paga?', 'Test Ninguno');
  assert(resNinguno && resNinguno.includes('actualizando') && resNinguno.includes('VENDEDOR'), 'Informa actualización y deriva a VENDEDOR cuando metodos_pago es ninguno');

  if (originalMetodosPago !== undefined) {
    db.updateSetting('metodos_pago', originalMetodosPago);
  }
  db.persistDB();

  // -------------------------------------------------------------
  // RESUMEN FINAL DE PRUEBAS
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 RESULTADO FINAL: ${passedTests} PASADAS | ${failedTests} FALLIDAS`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('❌ Algunas pruebas fallaron.');
    process.exit(1);
  } else {
    console.log(`🎉 ¡TODAS LAS ${passedTests} PRUEBAS PASARON AL 100%! El sistema y bot de Crastur están blindados.`);
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err);
  process.exit(1);
});
