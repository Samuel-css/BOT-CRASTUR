const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { updateSetting, getSettings } = require('./database');

async function fetchBCVRate() {
  console.log('[BCV] Consultando tasa oficial directamente en bcv.org.ve...');
  try {
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
  } catch (error) {
    console.error('[BCV] Error consultando sitio oficial del BCV:', error.message);
    const currentSettings = getSettings();
    return {
      success: false,
      error: error.message,
      tasa: parseFloat(currentSettings.tasa_bcv) || 849.56,
      fecha: currentSettings.fecha_tasa || 'Última registrada',
      source: 'Caché local (Última tasa guardada)'
    };
  }
}

// Iniciar chequeo periódico cada 60 minutos
function initBCVService() {
  fetchBCVRate();
  setInterval(() => {
    fetchBCVRate();
  }, 60 * 60 * 1000);
}

module.exports = {
  fetchBCVRate,
  initBCVService
};
