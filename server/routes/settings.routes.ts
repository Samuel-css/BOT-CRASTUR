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
 * [SEGURIDAD] Lista blanca de claves de configuración editables desde el panel.
 * Evita que una petición maliciosa escriba parámetros operativos arbitrarios.
 */
const ALLOWED_SETTING_KEYS = new Set([
  'nombre_negocio',
  'tasa_manual_activa',
  'tasa_personalizada',
  'direccion_tienda',
  'google_maps_url',
  'cashea_inicial_pct',
  'cashea_cuotas',
  'cashea_info',
  'insistencia_activa',
  'insistencia_minutos',
  'horario_atencion',
  'politica_envios',
  'metodos_pago',
  'mensaje_insistencia',
  'mensaje_bienvenida',
  'fuera_horario_activo',
  'mensaje_fuera_horario',
  'bot_pausado_global',
  'delivery_zonas_json',
  'zonas_delivery_custom'
]);

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
      // [SEGURIDAD] Solo se persisten claves permitidas
      if (!ALLOWED_SETTING_KEYS.has(key)) continue;
      if (val === undefined || val === null) continue;
      updateSetting(key, val);
    }
  }
  res.json({ success: true, settings: getSettings() });
});

export default router;
