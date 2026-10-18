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
  // [HUMAN TAKEOVER AUTOMÁTICO] Pausa del bot cuando un vendedor responde y reactivación automática
  'auto_pausa_asesor',
  'reactivar_bot_minutos',
  'horario_atencion',
  'politica_envios',
  'metodos_pago',
  'mensaje_insistencia',
  'mensaje_bienvenida',
  'fuera_horario_activo',
  'mensaje_fuera_horario',
  'bot_pausado_global',
  'proactivos_max_dia',
  'delivery_zonas_json',
  'zonas_delivery_custom'
]);

/** Límite de longitud para valores de texto (evita payloads gigantes en la BD). */
const MAX_VALUE_LENGTH = 20000;

/** Claves numéricas con su rango permitido [min, max]. */
const NUMERIC_KEYS: Record<string, [number, number]> = {
  cashea_inicial_pct: [0, 100],
  cashea_cuotas: [1, 12],
  insistencia_minutos: [0, 10080],
  reactivar_bot_minutos: [0, 10080],
  proactivos_max_dia: [0, 1000]
};

/**
 * Valida y normaliza un valor de configuración.
 * @returns El valor como texto listo para guardar, o null si debe rechazarse.
 */
function normalizeSettingValue(key: string, value: any): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return null;

  if (NUMERIC_KEYS[key]) {
    const [min, max] = NUMERIC_KEYS[key];
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return String(Math.trunc(n));
  }

  const text = String(value);
  if (text.length > MAX_VALUE_LENGTH) return text.slice(0, MAX_VALUE_LENGTH);
  return text;
}

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
      const safeValue = normalizeSettingValue(key, val);
      if (safeValue === null) {
        console.warn(`[Settings] Valor rechazado para "${key}": ${JSON.stringify(val)}`);
        continue;
      }
      updateSetting(key, safeValue);
    }
  }
  res.json({ success: true, settings: getSettings() });
});

export default router;
