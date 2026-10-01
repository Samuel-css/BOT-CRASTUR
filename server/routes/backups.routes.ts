/**
 * ============================================================================
 * RUTAS DE RESPALDO, RESTAURACIÓN Y MANTENIMIENTO DEL SISTEMA (BACKUPS.ROUTES.TS)
 * ============================================================================
 * Provee mecanismos de salvaguarda de datos tanto a nivel lógico (JSON) como físico (.db):
 * - Respaldo maestro integral (Catálogo + Proveedores + Vendedores + Configuración)
 * - Importación y exportación de catálogo ligero en 1 clic
 * - Descarga y restauración binaria de la base de datos SQLite WASM
 * - Apagado seguro y controlado del servidor con persistencia previa a disco
 * 
 * [PERSISTENCIA ATÓMICA Y RECUPERACIÓN ANTE DESASTRES]
 * - Verificación de integridad SQLite format 3 previa a restaurar buffers binarios.
 */

import { Router, Request, Response, raw } from 'express';
const router = Router();
import path from 'path';
import fs from 'fs';
import {
  exportMasterBackup,
  importMasterBackup,
  exportCatalog,
  importCatalog,
  persistDB,
  restoreDatabaseFromBuffer
} from '../database';
import { clearCatalogCache } from '../bot/services/catalogPdfService';
import { broadcast } from '../websocket';
import { stopWhatsApp } from '../whatsappService';

/**
 * GET /api/backup/export-full
 * Descarga el snapshot maestro completo en formato JSON con fecha en el nombre.
 */
router.get('/backup/export-full', (req: Request, res: Response) => {
  try {
    const data = exportMasterBackup();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=respaldo_maestro_crastur_${new Date().toISOString().slice(0, 10)}.json`);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/backup/import-full
 * Restaura o fusiona masivamente productos, proveedores y configuraciones desde un snapshot maestro JSON.
 */
router.post('/backup/import-full', (req: Request, res: Response) => {
  try {
    const result = importMasterBackup(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/catalog/export
 * Exporta el catálogo activo en formato JSON para transferencias ágiles.
 */
router.get('/catalog/export', (req: Request, res: Response) => {
  const data = exportCatalog();
  const filename = `crastur_catalogo_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

/**
 * POST /api/catalog/import
 * Importa por lote productos desde una lista JSON y limpia la memoria caché del PDF.
 */
router.post('/catalog/import', (req: Request, res: Response) => {
  try {
    const { productos } = req.body;
    if (!productos || !Array.isArray(productos)) {
      return res.status(400).json({ error: 'Formato inválido. Se esperaba una lista de productos.' });
    }
    const result = importCatalog(productos);
    clearCatalogCache();
    broadcast('products_updated', { action: 'imported' });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/database/backup
 * Descarga el archivo binario crastur.db consolidado directamente en disco.
 */
router.get('/database/backup', (req: Request, res: Response) => {
  try {
    persistDB();
    const dbFilePath = path.join(__dirname, '..', '..', 'data', 'crastur.db');
    if (!fs.existsSync(dbFilePath)) {
      return res.status(404).json({ error: 'Archivo de base de datos no encontrado.' });
    }
    const today = new Date().toISOString().slice(0, 10);
    const filename = `crastur_respaldo_${today}.db`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const fileStream = fs.createReadStream(dbFilePath);
    fileStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/database/restore
 * Recibe un archivo binario SQLite vía stream crudo, verifica su firma e integridad y sustituye la base de datos activa.
 */
router.post('/database/restore', raw({ type: ['application/octet-stream', 'application/x-sqlite3', 'multipart/form-data', '*/*'], limit: '60mb' }), (req: Request, res: Response) => {
  try {
    const buffer = req.body;
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'No se recibieron datos de archivo.' });
    }
    const result = restoreDatabaseFromBuffer(buffer);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, message: 'Base de datos restaurada exitosamente.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/system/shutdown
 * Detiene ordenadamente el bot de WhatsApp, guarda la base de datos en disco y finaliza el proceso Node.js.
 */
router.post('/system/shutdown', (req: Request, res: Response) => {
  console.log('\n[Sistema] 🛑 Solicitud de apagado seguro recibida...');
  try {
    persistDB();
    console.log('[Sistema] Base de datos guardada correctamente.');
  } catch (e: any) {
    console.error('[Sistema] Error persistiendo base de datos al apagar:', e.message);
  }

  res.json({
    success: true,
    message: 'Sistema Crastur apagado correctamente. Ya puedes cerrar esta pestaña.'
  });

  try {
    if (typeof stopWhatsApp === 'function') {
      stopWhatsApp();
    }
  } catch (e) {}

  setTimeout(() => {
    console.log('[Sistema] Servidor y bot detenidos. ¡Hasta pronto!');
    process.exit(0);
  }, 600);
});

export default router;
