const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

async function resetCleanInstall() {
  console.log('🔄 ==============================================================');
  console.log('🔄 CRASTUR - RESTABLECIMIENTO LIMPIO DE FÁBRICA (RECIÉN INSTALADO)');
  console.log('🔄 ==============================================================');

  const dataDir = path.join(__dirname, '..', 'data');
  const dbPath = path.join(dataDir, 'crastur.db');
  const backupDir = path.join(dataDir, 'backups');
  const catalogsDir = path.join(dataDir, 'catalogs');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  let db;

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 1. Limpieza total de historial de chat, sesiones y reservas
  console.log('🧹 Vaciando mensajes, sesiones de chat, apartados y métricas...');
  db.run('DELETE FROM chat_messages;');
  db.run('DELETE FROM chat_sessions;');
  db.run('DELETE FROM reservations;');
  db.run('DELETE FROM bot_metrics;');
  db.run('DELETE FROM sellers;');

  // 2. Opción A: Catálogo 100% limpio para despliegue en producción (0 productos)
  console.log('📦 Vaciando catálogo de productos para producción limpia (0 productos)...');
  db.run('DELETE FROM products;');
  db.run("DELETE FROM sqlite_sequence WHERE name='products';");

  // 3. Restablecer configuración a valores de fábrica oficiales de Crastur
  console.log('⚙️ Restableciendo configuración oficial de la tienda...');
  db.run('DELETE FROM settings;');

  const defaultSettings = {
    'nombre_negocio': 'Crastur - Insumos para Caucheras, Repuestos de Moto & Otros Productos',
    'tasa_bcv': '857.01',
    'fecha_tasa': 'Sincronizado con BCV',
    'tasa_manual_activa': '0',
    'tasa_personalizada': '857.01',
    'direccion_tienda': 'Edificio Liberalba, Avenida Sur 9, San Agustín Norte, Caracas, Venezuela',
    'google_maps_url': 'https://maps.app.goo.gl/wvaqXJ1W6LjGRcxNA',
    'cashea_inicial_pct': '40',
    'cashea_cuotas': '3',
    'cashea_info': '¡En Crastur contamos con Cashea! Llévate hoy tus repuestos y accesorios para moto e insumos pagando solo una inicial y el resto en 3 cuotas quincenales sin interés.',
    'insistencia_activa': '1',
    'insistencia_minutos': '15',
    'horario_atencion': 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM',
    'politica_envios': 'Delivery a toda Caracas y retiro directo en nuestra tienda física en San Agustín Norte.',
    'metodos_pago': 'Precio Promoción en Divisas (Efectivo $ y Binance Pay USDT), Pago Móvil y Transferencia (tasa BCV), Efectivo Bs y Cashea en tienda.',
    'mensaje_insistencia': '¡Hola, {nombre}! 👋 ¿Pudiste revisar el precio de *{producto}*? Recuerda que tenemos tienda física en Caracas, garantía y Cashea 💛. Si necesitas hablar con un asesor, solo escribe *VENDEDOR*.',
    'mensaje_bienvenida': '¡Hola! Te damos la bienvenida a *Crastur* 🛞🏍️\nTu tienda de insumos para caucheras, repuestos de moto y lubricantes en Caracas con Cashea 💛.\n\n📍 Tienda física en San Agustín Norte con horario corrido y delivery a toda Caracas.\n¿En qué repuesto te podemos ayudar hoy? Escribe el nombre de la pieza o modelo de moto y te cotizamos de inmediato.',
    'fuera_horario_activo': '0',
    'mensaje_fuera_horario': '¡Hola! 👋 Gracias por escribirnos. En este momento nuestra tienda física está cerrada. Te atendemos de *Lunes a Sábado de 8:00 AM a 8:00 PM* y *Domingos de 8:30 AM a 2:00 PM*. Puedes dejarnos tu consulta y con gusto te respondemos al abrir. ¡Hasta pronto! 🛞🏍️✨',
    'bot_pausado_global': '0',
    'zonas_delivery_custom': '[]'
  };

  for (const [key, val] of Object.entries(defaultSettings)) {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, val]);
  }

  // 4. Guardar archivo crastur.db
  const exported = db.export();
  fs.writeFileSync(dbPath, Buffer.from(exported));
  console.log('💾 Archivo crastur.db guardado exitosamente.');

  // 5. Limpiar backups antiguos con datos viejos de pruebas y crear respaldo nuevo limpio
  console.log('🗂️ Limpiando respaldos antiguos de pruebas...');
  if (fs.existsSync(backupDir)) {
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
    for (const f of backupFiles) {
      try {
        fs.unlinkSync(path.join(backupDir, f));
      } catch {}
    }
    const cleanBackupPath = path.join(backupDir, 'crastur_backup.db');
    fs.writeFileSync(cleanBackupPath, Buffer.from(exported));
    console.log('✅ Respaldo limpio crastur_backup.db generado.');
  }

  // 6. Limpiar PDFs temporales de catálogos en caché
  if (fs.existsSync(catalogsDir)) {
    const pdfFiles = fs.readdirSync(catalogsDir).filter(f => f.endsWith('.pdf'));
    for (const f of pdfFiles) {
      try { fs.unlinkSync(path.join(catalogsDir, f)); } catch {}
    }
    console.log(`🧹 ${pdfFiles.length} catálogos PDF en caché limpiados.`);
  }

  console.log('\n✨ ¡RESETEO DE FÁBRICA COMPLETADO CON ÉXITO!');
  console.log('   • Mensajes y chats: 0 (Bandeja limpia)');
  console.log('   • Apartados: 0');
  console.log('   • Asesores: 0');
  console.log('   • Productos en inventario: 0 (Opción A - Producción 100% limpia)');
  console.log('   • Horario oficial: Lunes a Sábado (8am-8pm) y Domingos (8:30am-2pm)');
  console.log('   • Respaldo nuevo inicial creado.');
}

if (require.main === module) {
  resetCleanInstall()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error en reseteo de fábrica:', err);
      process.exit(1);
    });
}

module.exports = { resetCleanInstall };
