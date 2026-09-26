const { whenReady } = require('../server/database');
const { getCategoryCatalogPdf, clearCatalogCache } = require('../server/bot/services/catalogPdfService');

async function testAllCatalogs() {
  console.log('====================================================');
  console.log('📄 GENERADOR DE CATÁLOGOS PDF - PRUEBA Y AUDITORÍA');
  console.log('====================================================\n');

  await whenReady();

  // Limpiar caché anterior para asegurar prueba fresca
  clearCatalogCache();

  const categoriesToTest = [
    'Insumos Cauchera',
    'Repuestos Moto',
    'Otros Productos',
    'Todos'
  ];

  for (const cat of categoriesToTest) {
    const t0 = Date.now();
    const res = await getCategoryCatalogPdf(cat);
    const duration = Date.now() - t0;

    if (res.success) {
      console.log(`✅ [OK] ${res.categoryTitle}`);
      console.log(`   📁 Archivo: ${res.fileName}`);
      console.log(`   📦 Productos: ${res.count}`);
      console.log(`   ⏱️ Tiempo de generación: ${duration} ms\n`);
    } else {
      console.warn(`⚠️ [VACÍO] ${cat}: ${res.reason}\n`);
    }
  }

  console.log('🎉 Auditoría de generación de PDFs completada con éxito.');
}

testAllCatalogs().catch(err => {
  console.error('❌ Error ejecutando auditoría de catálogos:', err);
  process.exit(1);
});
