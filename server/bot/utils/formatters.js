/**
 * Formatea tasa oficial BCV exacta sin truncar decimales significativos
 */
function formatRate(rate) {
  if (!rate) return '0.00';
  const num = typeof rate === 'number' ? rate : parseFloat(rate);
  return num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea número en bolívares con separadores legibles
 */
function formatBs(amount) {
  return (amount || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Extrae y formatea uno o varios números telefónicos venezolanos de un texto
 * Soporta entradas como: "04126137652 o 04241881126", "0412-1234567 / 0414-7654321", etc.
 */
function extractVenezuelanPhones(text) {
  if (!text) return { phones: [], primary: null, summary: null };

  const str = String(text);
  const regex = /(?:(?:\+?58\s*|0)?(412|414|424|416|426|212)[\s.-]?(\d{3})[\s.-]?(\d{4}))/gi;
  const matches = [...str.matchAll(regex)];

  if (matches.length > 0) {
    const phones = matches.map(m => `0${m[1]}-${m[2]}${m[3]}`);
    const unique = [...new Set(phones)];
    return {
      phones: unique,
      primary: unique[0],
      summary: unique.join(' / ')
    };
  }

  // Fallback para secuencias numéricas simples (10 a 15 dígitos)
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    let formatted = str.trim();
    if (digits.length === 11 && digits.startsWith('0')) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    } else if (digits.length === 10) {
      formatted = `0${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else if (digits.startsWith('58') && digits.length === 12) {
      formatted = `0${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return {
      phones: [formatted],
      primary: formatted,
      summary: formatted
    };
  }

  return { phones: [], primary: null, summary: null };
}

/**
 * Limpia y formatea un número telefónico venezolano (soporta números múltiples y textos con teléfono)
 */
function formatVenezuelanPhone(raw) {
  if (!raw) return null;
  const extracted = extractVenezuelanPhones(raw);
  if (extracted && extracted.summary) {
    return extracted.summary;
  }
  return null;
}

module.exports = {
  formatRate,
  formatBs,
  formatVenezuelanPhone,
  extractVenezuelanPhones
};
