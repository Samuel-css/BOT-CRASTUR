/**
 * ============================================================================
 * RUTAS DE CONFIGURACIÓN OPERATIVA Y COMERCIAL (SETTINGS.ROUTES.TS)
 * ============================================================================
 * Administra la persistencia de parámetros generales de la tienda física y el bot:
 * dirección física en Caracas, horarios, textos de bienvenida, Cashea y políticas de despacho.
 * 
 * [MERCADO VENEZUELA] Almacena porcentajes de inicial y cuotas de Cashea, horarios en Caracas y métodos de pago.
 */

import { Router, Request, Response } from 'express';
import { getSettings, updateSetting } from '../database';

const router = Router();

/**
 * GET /api/settings
 * Retorna el mapa completo de configuraciones de la tienda como un diccionario clave/valor.
 */
router.get('/', (req: Request, res: Response) => {
  res.json(getSettings());
});

/**
 * POST /api/settings
 * Guarda o actualiza masivamente un conjunto de parámetros operativos en la base de datos.
 */
router.post('/', (req: Request, res: Response) => {
  const newSettings = req.body;
  if (newSettings && typeof newSettings === 'object') {
    for (const [key, val] of Object.entries(newSettings)) {
      updateSetting(key, val);
    }
  }
  res.json({ success: true, settings: getSettings() });
});

export default router;
