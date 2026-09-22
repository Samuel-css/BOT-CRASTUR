const db = require('../server/database');
const { resetSpam } = require('../server/bot/utils/antiSpam');

async function cleanData() {
  console.log('🧹 [Limpieza] Iniciando limpieza de datos y Live Inbox...');
  await db.whenReady();

  // 1. Limpiar mensajes de chat
  db.db.prepare('DELETE FROM chat_messages').run();
  console.log('✅ chat_messages vaciado (0)');

  // 2. Limpiar sesiones de chat
  db.db.prepare('DELETE FROM chat_sessions').run();
  console.log('✅ chat_sessions vaciado (0)');

  // 3. Limpiar apartados de prueba
  db.db.prepare('DELETE FROM reservations').run();
  console.log('✅ reservations vaciado (0)');

  // 4. Limpiar métricas de prueba
  db.db.prepare('DELETE FROM bot_metrics').run();
  console.log('✅ bot_metrics vaciado (0)');

  // 5. Eliminar productos de prueba (e.g. TEST-PIECE)
  db.db.prepare("DELETE FROM products WHERE modelo LIKE '%TEST%' OR categoria LIKE '%Test%' OR marca = 'TEST'").run();
  console.log('✅ Productos de prueba eliminados');

  // 6. Estandarizar y corregir categorías para evitar discrepancias
  db.db.prepare("UPDATE products SET categoria = 'Repuestos Moto' WHERE categoria = 'Repuestos para Moto' OR categoria LIKE 'Repuestos para Moto%'").run();
  db.db.prepare("UPDATE products SET categoria = 'Insumos Cauchera' WHERE categoria = 'Insumos para Caucheras' OR categoria LIKE 'Insumos para Caucheras%'").run();
  console.log('✅ Categorías de productos estandarizadas a las canónicas oficiales');

  // 7. Resetear anti-spam en memoria
  resetSpam();
  console.log('✅ Anti-spam memoria reiniciada');

  // 8. Persistir cambios en disco de SQLite y actualizar backups limpios
  db.persistDB();
  if (typeof db.performDailyBackup === 'function') {
    db.performDailyBackup();
  }

  // 9. Verificar estado final
  const products = db.db.prepare('SELECT id, marca, modelo, categoria, precio_usd FROM products WHERE activo = 1').all();
  const settingsCount = db.db.prepare('SELECT COUNT(*) as c FROM settings').get()?.c || 0;

  console.log(`\n📦 Catálogo de productos preservado (${products.length} artículos legítimos):`);
  products.forEach(p => console.log(`   • [${p.categoria}] ${p.marca} - ${p.modelo} ($${p.precio_usd})`));
  console.log(`⚙️ Configuración del negocio preservada: ${settingsCount} parámetros`);
  console.log('✨ [Limpieza] Base de datos en 0 operacional y categorías 100% armonizadas.');
}

if (require.main === module) {
  cleanData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error limpiando datos:', err);
      process.exit(1);
    });
}

module.exports = { cleanData };
