/**
 * ============================================================================
 * RUTAS DE TASA DE CAMBIO BCV Y CONVERSIÓN MONETARIA (BCV.ROUTES.TS)
 * ============================================================================
 * Controla la lectura, sincronización manual y sobreescritura personalizada de la
 * tasa de cambio oficial (Bs/USD) para la tienda física y el bot de WhatsApp.
 * 
 * [MERCADO VENEZUELA]
 * - Emite eventos WebSocket (`bcv_updated`) para refrescar precios en tiempo real en los clientes web.
 * - Limpia la caché del PDF del catálogo para que las próximas cotizaciones se generen con el monto exacto.
 */

import { Router, Request, Response } from 'express';
const router = Router();
import { getSettings, getEffectiveRate, updateSetting } from '../database';
import { fetchBCVRate } from '../bcvService';
import { clearCatalogCache } from '../bot/services/catalogPdfService';
import { broadcast } from '../websocket';

/**
 * GET /api/bcv
 * Consulta el valor oficial del BCV, fecha de captura, si existe tasa manual activa y la tasa efectiva calculada.
 */
router.get('/', (req: Request, res: Response) => {
  const settings = getSettings();
  res.json({
    tasa_bcv: parseFloat(settings.tasa_bcv) || 849.56,
    fecha_tasa: settings.fecha_tasa,
    tasa_manual_activa: settings.tasa_manual_activa === '1',
    tasa_personalizada: parseFloat(settings.tasa_personalizada) || 849.56,
    tasa_efectiva: getEffectiveRate()
  });
});

/**
 * POST /api/bcv/refresh
 * Fuerza una sincronización inmediata consultando la cascada oficial (Portal BCV -> DolarApi -> DB local).
 * Invalida cachés y notifica por WebSockets.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const result = await fetchBCVRate();
    clearCatalogCache();
    broadcast('bcv_updated', result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bcv/override
 * Activa, desactiva o define una tasa personalizada manual independiente del BCV.
 */
router.post('/override', (req: Request, res: Response) => {
  const { activa, tasa } = req.body;

  // [VALIDACIÓN] La tasa personalizada debe ser un número finito y positivo.
  if (tasa !== undefined) {
    const num = Number(tasa);
    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({ success: false, error: 'La tasa personalizada debe ser un número mayor a 0.' });
    }
  }

  if (activa !== undefined) {
    updateSetting('tasa_manual_activa', activa ? '1' : '0');
  }
  if (tasa !== undefined) {
    updateSetting('tasa_personalizada', String(Number(tasa)));
  }
  clearCatalogCache();
  const nuevaTasaEfectiva = getEffectiveRate();
  broadcast('bcv_updated', { tasa_efectiva: nuevaTasaEfectiva });
  res.json({ success: true, tasa_efectiva: nuevaTasaEfectiva });
});

export default router;
