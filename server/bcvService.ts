/**
 * @file bcvService.ts
 * @description Servicio de consulta y sincronización de la tasa oficial del dólar (USD/VES)
 * del Banco Central de Venezuela (BCV), con arquitectura de redundancia de 3 niveles.
 * 
 * [MERCADO VENEZUELA]
 * Nivel 1: Scraping directo a bcv.org.ve con bypass SSL controlado.
 * Nivel 2: Espejo de contingencia oficial (DolarApi).
 * Nivel 3: Caché persistente en base de datos local SQLite.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { updateSetting, getSettings } from './database';

/**
 * Resultado de la consulta de tasa oficial del BCV.
 */
export interface BCVRateResult {
  /** Indica si la consulta o recuperación de tasa fue exitosa */
  success: boolean;
  /** Valor numérico de la tasa en Bolívares por Dólar (ej. 36.50) */
  tasa: number;
  /** Fecha oficial de vigencia reportada por el BCV (o fecha local de contingencia) */
  fecha: string;
  /** Origen de la tasa ('Oficial Banco Central de Venezuela', 'Espejo Oficial', 'Caché local') */
  source: string;
  /** Mensaje de error en caso de que fallen las consultas remotas */
  error?: string;
}

/**
 * Consulta la tasa oficial del BCV implementando una estrategia de resiliencia en cascada:
 * 1. Intenta scraping web directo al portal oficial `bcv.org.ve`.
 * 2. Si el portal falla o presenta bloqueo/timeout, consulta la API espejo de contingencia.
 * 3. Si no hay conexión a internet, recurre a la última tasa guardada en la base de datos local.
 * 
 * Actualiza automáticamente la configuración del sistema (`tasa_bcv` y `fecha_tasa`) en BD.
 * 
 * @returns Promesa con el resultado de la tasa obtenida
 */
export async function fetchBCVRate(): Promise<BCVRateResult> {
  console.log('[BCV] Consultando tasa oficial directamente en bcv.org.ve...');
  try {
    // Nivel 1: Portal oficial BCV (rejectUnauthorized: false debido a certificados intermedios comunes en Venezuela)
    const agent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.get('https://www.bcv.org.ve', {
      httpsAgent: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache'
      }
    });

    const $ = cheerio.load(response.data);
    const usdRaw = $('#dolar strong').text().trim();
    const fechaRaw = $('span.date-display-single').first().text().trim() || new Date().toLocaleDateString('es-VE');

    if (!usdRaw) {
      throw new Error('No se encontró el elemento selector #dolar strong en el sitio del BCV');
    }

    // Convertir formato venezolano (ej. "36.250,50" o "36,25") a punto decimal estándar
    const tasaParsed = parseFloat(usdRaw.replace(/\./g, '').replace(',', '.'));

    if (isNaN(tasaParsed) || tasaParsed <= 0) {
      throw new Error(`Tasa inválida recibida del BCV: ${usdRaw}`);
    }

    updateSetting('tasa_bcv', tasaParsed.toFixed(4));
    updateSetting('fecha_tasa', fechaRaw);

    console.log(`[BCV] Tasa oficial actualizada con éxito: ${tasaParsed} Bs/USD (${fechaRaw})`);
    return {
      success: true,
      tasa: tasaParsed,
      fecha: fechaRaw,
      source: 'Oficial Banco Central de Venezuela'
    };
  } catch (error: any) {
    console.error('[BCV] Falla al consultar portal bcv.org.ve:', error.message);
    console.log('[BCV] Intentando consultar espejo de contingencia oficial (DolarApi)...');

    // Nivel 2: Espejo de contingencia oficial (DolarApi)
    try {
      const mirrorResp = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', {
        timeout: 8000,
        headers: { 'User-Agent': 'CrasturBot/1.0' }
      });
      const promedio = parseFloat(mirrorResp.data?.promedio);
      if (promedio && !isNaN(promedio) && promedio > 0) {
        const fechaRaw = mirrorResp.data?.fechaActualizacion
          ? new Date(mirrorResp.data.fechaActualizacion).toLocaleDateString('es-VE')
          : new Date().toLocaleDateString('es-VE');

        updateSetting('tasa_bcv', promedio.toFixed(4));
        updateSetting('fecha_tasa', fechaRaw);

        console.log(`[BCV] Tasa oficial sincronizada exitosamente vía espejo: ${promedio} Bs/USD (${fechaRaw})`);
        return {
          success: true,
          tasa: promedio,
          fecha: fechaRaw,
          source: 'Espejo Oficial BCV (DolarApi)'
        };
      }
    } catch (mirrorErr: any) {
      console.warn('[BCV] Espejo de contingencia no disponible:', mirrorErr.message);
    }

    // Nivel 3: Caché local guardado en la base de datos SQLite
    const currentSettings = getSettings();
    return {
      success: false,
      error: error.message,
      tasa: parseFloat(currentSettings.tasa_bcv) || 0,
      fecha: currentSettings.fecha_tasa || 'Última registrada',
      source: 'Caché local (Última tasa guardada)'
    };
  }
}

/**
 * Inicializa el sincronizador periódico de la tasa BCV.
 * Realiza una consulta inicial inmediata y programa refrescos automáticos cada 60 minutos.
 */
export function initBCVService(): void {
  fetchBCVRate();
  setInterval(() => {
    fetchBCVRate();
  }, 60 * 60 * 1000);
}

export default {
  fetchBCVRate,
  initBCVService
};
