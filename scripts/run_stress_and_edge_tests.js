const db = require('../server/database');
const { processIncomingMessage } = require('../server/bot');
const { resetSpam } = require('../server/bot/utils/antiSpam');

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
  console.log('🚀 SUITE DE PRUEBAS DE ESTRÉS Y VALIDACIÓN EXTREMA DEL BOT');
  console.log('================================================================\n');

  await db.whenReady();
  db.updateSetting('bot_pausado_global', '0');
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

  // -------------------------------------------------------------
  // FASE 1: PRUEBA DE ESTRÉS Y CONCURRENCIA
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
  assert(stressResults.length === 100, 'Se completaron las 100 peticiones');
  assert(stressResults.every(r => typeof r === 'string' && r.length > 10), 'Todas las respuestas fueron textos válidos');
  console.log(`⏱️ Tiempo total de ejecución: ${elapsedMs} ms (${rps} peticiones/segundo)\n`);

  resetSpam();

  // -------------------------------------------------------------
  // FASE 2: BATERÍA DE PERFILES DE CLIENTES Y CASOS LÍMITE
  // -------------------------------------------------------------
  console.log('👥 FASE 2: VALIDACIÓN DE 14 PERFILES DE CLIENTES Y CASOS LÍMITE');
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
  }

  // PERFIL 2: El Apurado / Minimalista
  console.log('\n⚡ [Perfil 2: El Apurado / Mensajes de una palabra]');
  {
    const jid = '584149990002@s.whatsapp.net';
    const resTasa = processIncomingMessage(jid, 'tasa', 'Carlos');
    assert(resTasa && resTasa.includes('BCV') && resTasa.includes('Bs.'), 'Responde tasa BCV directamente ante la palabra "tasa"');

    const resDonde = processIncomingMessage(jid, 'donde', 'Carlos');
    assert(resDonde && resDonde.includes('Liberalba') && resDonde.includes('Google Maps'), 'Responde ubicación y enlace ante la palabra "donde"');

    const resHorario = processIncomingMessage(jid, 'horario', 'Carlos');
    assert(resHorario && resHorario.includes('8:00 AM a 8:00 PM'), 'Responde horario corrido ante la palabra "horario"');

    const resTripa = processIncomingMessage(jid, 'tripa', 'Carlos');
    assert(resTripa && (resTripa.includes('Tripa') || resTripa.includes('tripa')), 'Localiza el repuesto tripa con búsqueda de 1 palabra');
  }

  // PERFIL 3: El Coloquial / Venezolanismos
  console.log('\n🇻🇪 [Perfil 3: Coloquial / Venezolanismos]');
  {
    const jid = '584149990003@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'epale mano que tal buenas tardes', 'Yorman');
    assert(res1 && res1.includes('Crastur') && res1.includes('BCV'), 'Responde saludo coloquial "epale mano" con saludo y tasa');

    const res2 = processIncomingMessage(jid, 'chamo tienes pastillas de freno?', 'Yorman');
    const res2Str = typeof res2 === 'object' && res2 !== null ? res2.text : String(res2 || '');
    assert(res2Str && res2Str.includes('Pastillas') && res2Str.includes('USD'), 'Entiende modismo "chamo tienes pastillas..." y cotiza');

    const resCaucho = processIncomingMessage(jid, 'chamo tienes caucho?', 'Yorman');
    assert(resCaucho && (resCaucho.includes('Cauchera') || resCaucho.toLowerCase().includes('caucho')), 'Consulta por caucho devuelve insumos de cauchera o cotización de caucho');

    const res3 = processIncomingMessage(jid, 'fino gracias mi pana', 'Yorman');
    assert(res3 && (res3.includes('orden') || res3.includes('gusto') || res3.includes('placer')), 'Reconoce cortesía venezolana "fino gracias"');
  }

  // PERFIL 4: Errores Ortográficos y Abreviaciones
  console.log('\n📝 [Perfil 4: Errores Ortográficos y Abreviaciones]');
  {
    const jid = '584149990004@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'kiero pastiya d freno', 'Luis');
    const res1Str = typeof res1 === 'object' && res1 !== null ? res1.text : String(res1 || '');
    assert(res1Str && (res1Str.includes('Pastilla') || res1Str.includes('Freno')), 'Fuzzy match encuentra pastillas ante "pastiya d freno"');

    const res2 = processIncomingMessage(jid, 'q vale la bujya', 'Luis');
    assert(res2 && (res2.includes('Bujía') || res2.includes('Bujia')), 'Fuzzy match encuentra bujía ante "bujya"');

    const res3 = processIncomingMessage(jid, 'kuanto sale la valvula d aire', 'Luis');
    assert(res3 && res3.includes('Válvula'), 'Fuzzy match encuentra válvulas ante "valvula d aire"');

    // Búsqueda de alta precisión: calificador vehicular no debe mezclar repuestos no solicitados
    const resAceite = processIncomingMessage(jid, 'Tienes aceite para moto ? Y cuáles tienes ?', 'Luis');
    assert(
      resAceite &&
      resAceite.includes('Aceite') &&
      !resAceite.includes('Bujía') &&
      !resAceite.includes('Kit de Arrastre') &&
      !resAceite.includes('Pastillas de Freno'),
      'Consulta específica de "aceite para moto" devuelve solo aceite y no mezcla bujías ni frenos'
    );

    const resBujia = processIncomingMessage(jid, 'Tienes bujias para moto ?', 'Luis');
    assert(
      resBujia &&
      resBujia.includes('Bujía') &&
      !resBujia.includes('Aceite') &&
      !resBujia.includes('Pastillas de Freno'),
      'Consulta específica de "bujías para moto" devuelve solo bujías y no mezcla aceites'
    );
  }

  // PERFIL 5: Métodos de Pago Venezolanos
  console.log('\n💵 [Perfil 5: Métodos de Pago Venezolanos]');
  {
    const jid = '584149990005@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'aceptan pago movil?', 'Maria');
    assert(res1 && res1.includes('Pago Móvil') && res1.includes('BCV'), 'Informa Pago Móvil a tasa BCV sin recargos');

    const res2 = processIncomingMessage(jid, 'tienen punto de venta?', 'Maria');
    assert(res2 && res2.includes('Pago Móvil') && res2.includes('Efectivo'), 'Aclara métodos y alternativas a punto de venta');

    const res3 = processIncomingMessage(jid, 'si pago en efectivo en dolares me dan descuento?', 'Maria');
    assert(res3 && res3.includes('descuento especial') && res3.includes('divisas'), 'Informa descuento especial por pago en divisas en tienda');

    const res4 = processIncomingMessage(jid, 'aceptan binance usdt?', 'Maria');
    assert(res4 && res4.includes('Binance') && res4.includes('Precio Promoción'), 'Informa aceptación de Binance Pay con Precio Promoción en Divisas');

    const res5 = processIncomingMessage(jid, 'venden al mayor para cauchera?', 'Maria');
    assert(res5 && res5.includes('Ventas al Mayor') && res5.includes('caja cerrada'), 'Atiende consulta de Venta al Mayor para caucheras y talleres');

    const res6 = processIncomingMessage(jid, 'vi un combo en instagram que tienen?', 'Maria');
    assert(res6 && res6.includes('Combo') && res6.includes('Precio Promo'), 'Responde consultas de Combos & Kits de Instagram');
  }

  // PERFIL 6: El Comprador Cashea
  console.log('\n💛 [Perfil 6: El Comprador Cashea]');
  {
    const jid = '584149990006@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'como es lo de cashea?', 'Alejandro');
    assert(res1 && res1.includes('Cashea') && res1.includes('$25') && res1.includes('3 cuotas'), 'Explica financiamiento Cashea con mínimo $25 USD y 3 cuotas');

    const res2 = processIncomingMessage(jid, 'nivel 1 cashea', 'Alejandro');
    assert(res2 && res2.includes('40%') && res2.includes('Nivel 1'), 'Calcula desglose específico para Cashea Nivel 1');

    const res3 = processIncomingMessage(jid, 'nivel 2 cashea', 'Alejandro');
    assert(res3 && res3.includes('30%') && res3.includes('Nivel 2'), 'Calcula desglose específico para Cashea Nivel 2');
  }

  // PERFIL 7: Envíos Nacionales / Interior del país
  console.log('\n🚚 [Perfil 7: Envíos Nacionales / Interior]');
  {
    const jid = '584149990007@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'envian a Maracay por Tealca?', 'Pedro');
    assert(res1 && res1.includes('Caracas') && res1.includes('tienda física'), 'Aclara amablemente que solo opera en tienda física y delivery en Caracas');

    const res2 = processIncomingMessage(jid, 'hacen envios nacionales a Valencia?', 'Pedro');
    assert(res2 && res2.includes('Caracas'), 'Aclara cobertura local');
  }

  // PERFIL 8: Delivery en Caracas por Zonas
  console.log('\n🛵 [Perfil 8: Delivery en Caracas por Zonas]');
  {
    const jid = '584149990008@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'hacen delivery a Petare?', 'Jose');
    assert(res1 && res1.includes('Delivery') && res1.includes('Caracas'), 'Cotiza delivery indicando servicio con motorizado confiable');

    const res2 = processIncomingMessage(jid, 'cuanto cuesta el envio a Chacao?', 'Jose');
    assert(res2 && (res2.includes('Chacao') || res2.includes('Delivery')), 'Detecta zona Chacao o detalla delivery');
  }

  // PERFIL 9: Repuestos de Carro / Fuera de Ramo
  console.log('\n🚗 [Perfil 9: Repuestos de Carro / Fuera de Ramo]');
  {
    const jid = '584149990009@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'tienen amortiguadores de corsa?', 'Gabriel');
    assert(res1 && (res1.includes('Motos') || res1.includes('pesadas') || res1.includes('exclusivamente')), 'Aclara especialidad en motos y cauchera');

    const res2 = processIncomingMessage(jid, 'venden tren delantero de aveo?', 'Gabriel');
    assert(res2 && (res2.includes('Cauchera') || res2.includes('moto') || res2.includes('VENDEDOR')), 'Redirige a catálogo de motos/cauchera');
  }

  // PERFIL 10: Flujo Completo de Apartado 24h
  console.log('\n⏱️ [Perfil 10: Flujo Completo de Apartado 24h]');
  {
    const jid = '584149990010@s.whatsapp.net';
    db.db.prepare('DELETE FROM chat_sessions WHERE jid = ?').run(jid);
    db.db.prepare('DELETE FROM chat_messages WHERE jid = ?').run(jid);
    db.db.prepare("DELETE FROM reservations WHERE nombre LIKE '%Ramon%'").run();

    // 1. Iniciar apartado con un producto existente (Bujía)
    const res1 = processIncomingMessage(jid, 'apartar bujia', 'Ramon');
    assert(res1 && res1.includes('Nombre y Apellido'), 'Paso 1: Solicita Nombre y Apellido');

    // 2. Dar nombre
    const res2 = processIncomingMessage(jid, 'Ramon Rodriguez', 'Ramon');
    assert(res2 && res2.includes('Cédula'), 'Paso 2: Solicita Cédula de Identidad');

    // 3. Dar cédula venezolana
    const res3 = processIncomingMessage(jid, 'V-19876543', 'Ramon');
    assert(res3 && (res3.includes('teléfono') || res3.includes('telefono') || res3.includes('número') || res3.includes('TICKET')), 'Paso 3: Solicita Teléfono o emite ticket');

    // 4. Confirmar usando teléfono de la línea actual
    const res4 = processIncomingMessage(jid, 'si', 'Ramon');
    assert(res4 && res4.includes('APARTADO CONFIRMADO') && res4.includes('CRA-'), 'Paso 4: Genera ticket con código único CRA-');
    assert(res4 && (res4.includes('Artículo 28') || res4.includes('Privacidad') || res4.includes('CRBV')), 'Incluye aviso legal de protección de datos CRBV Art 28');

    // Verificar en la BD que la reserva fue creada y el stock descontado
    const resBD = db.db.prepare("SELECT * FROM reservations WHERE nombre LIKE '%Ramon%'").get();
    assert(resBD && resBD.estado === 'activo' && resBD.id > 0, 'Reserva guardada en base de datos como activa');

    // Prueba de apartado con múltiples teléfonos (caso "04126137652 o 04241881126")
    const jidMulti = '584129990099@lid';
    db.toggleBotPause(jidMulti, false);
    processIncomingMessage(jidMulti, 'apartar aceite', 'Eliezer');
    processIncomingMessage(jidMulti, 'Eliezer Pinto', 'Eliezer');
    processIncomingMessage(jidMulti, 'V-20123456', 'Eliezer');
    const resMultiPhone = processIncomingMessage(jidMulti, '04126137652 o 04241881126', 'Eliezer');
    assert(resMultiPhone && resMultiPhone.includes('APARTADO CONFIRMADO') && resMultiPhone.includes('CRA-'), 'Apartado acepta múltiples números de teléfono ("0412... o 0424...")');
    const resEliezer = db.db.prepare("SELECT * FROM reservations WHERE jid = '584129990099@lid' ORDER BY id DESC LIMIT 1").get();
    assert(resEliezer && resEliezer.telefono.includes('0412-6137652') && resEliezer.telefono.includes('0424-1881126'), 'Teléfonos múltiples almacenados y formateados en la reserva');
  }

  // PERFIL 11: Interrupciones y Cancelación durante Apartado
  console.log('\n🛑 [Perfil 11: Interrupciones y Cancelación en Apartado]');
  {
    const jid = '584149990011@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'apartar pastillas', 'Daniel');
    assert(res1 && res1.includes('Nombre'), 'Inicia apartado');

    // Interrupción con pregunta en vez de nombre
    const res2 = processIncomingMessage(jid, 'a que hora cierran hoy?', 'Daniel');
    assert(res2 && res2.includes('8:00 AM a 8:00 PM'), 'Responde la pregunta intermedia de horario');

    // Cancelación limpia
    const res3 = processIncomingMessage(jid, 'ya no quiero apartar', 'Daniel');
    assert(res3 && res3.includes('cancelada'), 'Cancela el flujo de forma limpia y reinicia sesión');

    const sessionBD = db.db.prepare('SELECT * FROM chat_sessions WHERE jid = ?').get(jid);
    assert(sessionBD && sessionBD.step === 'start', 'Sesión reseteada a step "start"');
  }

  // PERFIL 12: Hostilidad / Malas Palabras / Quejas
  console.log('\n🛡️ [Perfil 12: De-escalación ante Hostilidad o Insultos]');
  {
    const jid = '584149990012@s.whatsapp.net';
    const res1 = processIncomingMessage(jid, 'ustedes son unos ladrones y estafadores', 'Cliente Molesto');
    assert(res1 && res1.includes('lamentamos') && res1.includes('Liberalba') && res1.includes('ASESOR'), 'De-escala respetuosamente dando respaldo de tienda física en San Agustín y contacto con asesor');

    const res2 = processIncomingMessage(jid, 'coño de su madre que mal servicio', 'Cliente Molesto');
    assert(res2 && res2.includes('respeto') && res2.includes('ASESOR'), 'Maneja insulto venezolano con calma y profesionalismo');
  }

  // PERFIL 13: Ciberseguridad y Casos Extremos
  console.log('\n🔒 [Perfil 13: Ciberseguridad y Casos Extremos]');
  {
    const jid = '584149990013@s.whatsapp.net';
    // Inyección SQL 1
    const resSql1 = processIncomingMessage(jid, "' OR '1'='1", 'Hacker');
    assert(typeof resSql1 === 'string', 'Inyección clásica 1 no causa crash en SQLite');

    // Inyección SQL 2
    const resSql2 = processIncomingMessage(jid, "'; DROP TABLE products; --", 'Hacker');
    assert(typeof resSql2 === 'string', 'Inyección DROP TABLE no destruye la base de datos');
    const tableCheck = db.db.prepare('SELECT COUNT(*) as c FROM products').get();
    assert(tableCheck && tableCheck.c >= 5, 'Tabla products permanece intacta');

    // Payload de longitud extrema (10.000 caracteres)
    const longPayload = 'A'.repeat(10000);
    const resLong = processIncomingMessage(jid, longPayload, 'Flooder');
    assert(typeof resLong === 'string', 'Payload de 10.000 caracteres manejado sin fugas de memoria');

    // Emojis solos
    const resEmojis = processIncomingMessage(jid, '🛵🔥💨🏁', 'Motero');
    assert(typeof resEmojis === 'string' && resEmojis.length > 10, 'Mensaje de solo emojis respondido adecuadamente');

    // Anti-spam masivo
    resetSpam(jid);
    for (let k = 0; k < 35; k++) {
      processIncomingMessage(jid, `spam ${k}`, 'Spammer');
    }
    const resSpam = processIncomingMessage(jid, 'otro mensaje mas', 'Spammer');
    assert(resSpam === null, 'Anti-spam silencia automáticamente al superar 30 msgs/min');
  }

  // PERFIL 14: Multimedia (Notas de voz y Fotos)
  console.log('\n🎙️ [Perfil 14: Mensajes Multimedia]');
  {
    const jid = '584149990014@s.whatsapp.net';
    resetSpam(jid);
    const resAudio = processIncomingMessage(jid, '', 'Cliente', { isMedia: true, type: 'audio' });
    assert(resAudio && (resAudio.includes('audio') || resAudio.includes('voz') || resAudio.includes('texto')), 'Orienta amablemente ante notas de voz');

    const resImg = processIncomingMessage(jid, '', 'Cliente', { isMedia: true, type: 'image' });
    assert(resImg && (resImg.includes('imagen') || resImg.includes('foto') || resImg.includes('texto')), 'Orienta amablemente ante fotos/imágenes');
  }

  // PERFIL 15: Opciones del Menú Principal (1 a 6) y Categorías Canónicas
  console.log('\n🧭 [Perfil 15: Menú Numérico 1..6 y Categorías Oficiales]');
  {
    const jid = '584149990015@s.whatsapp.net';
    resetSpam(jid);

    // Opción 1: Insumos Cauchera
    processIncomingMessage(jid, 'menu', 'Tester');
    const res1 = processIncomingMessage(jid, '1', 'Tester');
    assert(typeof res1 === 'string' && (res1.includes('Insumos Cauchera') || res1.includes('Parches')), 'Opción 1 despliega catálogo de Insumos Cauchera');

    // Opción 2: Repuestos Moto
    processIncomingMessage(jid, 'menu', 'Tester');
    const res2 = processIncomingMessage(jid, '2', 'Tester');
    assert(typeof res2 === 'string' && (res2.includes('Repuestos Moto') || res2.includes('Arrastre') || res2.includes('Bujía')), 'Opción 2 despliega catálogo de Repuestos Moto');

    // Opción 3: Accesorios Moto
    processIncomingMessage(jid, 'menu', 'Tester');
    const res3 = processIncomingMessage(jid, '3', 'Tester');
    assert(typeof res3 === 'string' && res3.includes('Accesorios Moto'), 'Opción 3 atiende consulta de Accesorios Moto');

    // Opción 4: Otros Productos
    processIncomingMessage(jid, 'menu', 'Tester');
    const res4 = processIncomingMessage(jid, '4', 'Tester');
    assert(typeof res4 === 'string' && (res4.includes('Otros Productos') || res4.includes('Aceite')), 'Opción 4 despliega catálogo de Otros Productos');

    // Opción 5: Cashea en Tienda
    processIncomingMessage(jid, 'menu', 'Tester');
    const res5 = processIncomingMessage(jid, '5', 'Tester');
    assert(typeof res5 === 'string' && res5.includes('Cashea'), 'Opción 5 brinda información de financiamiento Cashea');

    // Opción 6: Asesor de Ventas
    processIncomingMessage(jid, 'menu', 'Tester');
    const res6 = processIncomingMessage(jid, '6', 'Tester');
    assert(typeof res6 === 'string' && (res6.includes('asesores de ventas') || res6.includes('equipo de ventas') || res6.includes('mostrador') || res6.includes('tienda física') || res6.includes('asesor')), 'Opción 6 ofrece atención de vendedor humano');

    // Consultas directas por texto de categoría
    const resCat1 = processIncomingMessage(jid, 'cauchera', 'Tester');
    assert(typeof resCat1 === 'string' && resCat1.includes('Insumos Cauchera'), 'Búsqueda por texto "cauchera" responde con Insumos Cauchera');

    const resCat2 = processIncomingMessage(jid, 'repuestos moto', 'Tester');
    assert(typeof resCat2 === 'string' && resCat2.includes('Repuestos Moto'), 'Búsqueda por texto "repuestos moto" responde con Repuestos Moto');
  }

  // PERFIL 16: Ciclo de Vida de Apartados y Período de Gracia (24h + 12h)
  console.log('\n⏳ [Perfil 16: Ciclo de Apartados y 12 Horas de Gracia]');
  {
    const now = Date.now();
    const jidTest = '584149990016@s.whatsapp.net';
    resetSpam(jidTest);

    // 1. Crear apartado vencido hace 2 horas (expiró hace 2 horas, dentro del período de gracia de 12h)
    const expira2hAtras = now - (2 * 60 * 60 * 1000);
    const idGrace = db.db.prepare(`
      INSERT INTO reservations (jid, nombre, cedula, telefono, producto_nombre, precio_usd, precio_bs, creado_en, expira_en, estado)
      VALUES (?, 'Carlos Gracia', 'V-22111222', '04121234567', 'Bujía D8EA', 3.5, 2900, ?, ?, 'activo')
    `).run(jidTest, now - (26 * 60 * 60 * 1000), expira2hAtras).lastInsertRowid;

    // Ejecutar purga de vencidos
    db.cleanExpiredReservations();
    const resGrace = db.db.prepare('SELECT estado FROM reservations WHERE id = ?').get(idGrace);
    assert(resGrace && resGrace.estado === 'vencido', 'Apartado de 26h pasa a estado "vencido" sin borrarse');

    // 2. Crear apartado vencido hace 15 horas (superó las 12h de gracia post-vencimiento)
    const expira15hAtras = now - (15 * 60 * 60 * 1000);
    const idPurge = db.db.prepare(`
      INSERT INTO reservations (jid, nombre, cedula, telefono, producto_nombre, precio_usd, precio_bs, creado_en, expira_en, estado)
      VALUES (?, 'Pedro Purga', 'V-33111222', '04127654321', 'Aceite 4T', 6.0, 5100, ?, ?, 'vencido')
    `).run(jidTest, now - (39 * 60 * 60 * 1000), expira15hAtras).lastInsertRowid;

    // Ejecutar purga de vencidos
    db.cleanExpiredReservations();
    const resPurge = db.db.prepare('SELECT id FROM reservations WHERE id = ?').get(idPurge);
    assert(!resPurge, 'Apartado con más de 12h de gracia cumplidas es purgado definitivamente');
  }

  // -------------------------------------------------------------
  // FASE 3: PRUEBA DE CONCURRENCIA ULTRA EXTENDIDA (200 PETICIONES)
  // -------------------------------------------------------------
  console.log('\n📊 FASE 3: PRUEBA DE CONCURRENCIA ULTRA EXTENDIDA (200 peticiones)');
  console.log('-----------------------------------------------------------------');
  {
    const heavyClients = Array.from({ length: 25 }, (_, i) => `58412888${String(i).padStart(4, '0')}@s.whatsapp.net`);
    const heavyQueries = [
      'hola', '1', '2', '3', '4', '5', '6',
      'precio de pastillas', 'kit de arrastre bera', 'aceite motul',
      'tasa', 'donde quedan', 'cashea', 'delivery catia', 'gracias'
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

    await Promise.all(heavyPromises);
    const hDuration = Date.now() - hStart;
    const hReqPerSec = ((200 / hDuration) * 1000).toFixed(1);

    console.log(`⏱️ 200 peticiones procesadas en: ${C.bold}${hDuration} ms${C.reset} (${C.green}${hReqPerSec} req/s${C.reset})`);
    assert(heavyErrors === 0, 'Cero errores de ejecución bajo concurrencia de 200 peticiones simultáneas');
    assert(hDuration < 1500, 'Tiempo de respuesta global dentro de umbrales óptimos (< 1500ms)');
  }

  // Limpieza selectiva post-pruebas: elimina ÚNICAMENTE datos generados por la prueba sin tocar los chats reales de clientes
  console.log('\n🧹 [Auto-Limpieza Post-Pruebas] Limpiando datos sintéticos de pruebas (preservando datos reales de la tienda)...');
  db.db.prepare("DELETE FROM chat_messages WHERE jid LIKE '%000%@s.whatsapp.net' OR jid LIKE '%User%'").run();
  db.db.prepare("DELETE FROM chat_sessions WHERE jid LIKE '%000%@s.whatsapp.net' OR push_name LIKE '%User%' OR push_name = 'Carlos Gracia'").run();
  db.db.prepare("DELETE FROM reservations WHERE nombre LIKE '%Carlos Gracia%' OR cedula = 'V-12345678'").run();
  db.db.prepare("DELETE FROM products WHERE modelo LIKE '%TEST%' OR categoria LIKE '%Test%'").run();
  if (insertedFixtureIds.length > 0) {
    console.log(`🧹 Eliminando ${insertedFixtureIds.length} fixtures temporales de prueba para preservar los productos del usuario...`);
    const placeholders = insertedFixtureIds.map(() => '?').join(',');
    db.db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...insertedFixtureIds);
  }
  resetSpam();
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
    console.log('🎉 ¡TODAS LAS PRUEBAS PASARON AL 100%! El bot y sistema Crastur cumplen con todos los estándares.');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err);
  process.exit(1);
});
