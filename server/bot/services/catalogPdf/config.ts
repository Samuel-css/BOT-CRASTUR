/**
 * @file config.ts
 * @description Rutas de disco del generador de catálogos PDF (aisladas para pruebas).
 */

import fs from 'fs';
import path from 'path';

/** Directorio persistente de catálogos (respeta CRASTUR_DATA_DIR en pruebas). */
export const catalogsRoot = process.env.CRASTUR_DATA_DIR
  ? path.resolve(process.env.CRASTUR_DATA_DIR)
  : path.join(__dirname, '..', '..', '..', '..', 'data');
export const catalogsDir = path.join(catalogsRoot, 'catalogs');
if (!fs.existsSync(catalogsDir)) {
  fs.mkdirSync(catalogsDir, { recursive: true });
}

/** Logo oficial de Crastur. */
export const logoPath = path.join(__dirname, '..', '..', '..', '..', 'client', 'public', 'logo_icon.png');
