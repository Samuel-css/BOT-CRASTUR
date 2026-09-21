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
 * Limpia y formatea un número telefónico venezolano
 */
function formatVenezuelanPhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Formato internacional de Venezuela: 584121234567 (12 dígitos) -> 0412-1234567
  if (digits.startsWith('58') && digits.length === 12) {
    return `0${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  // Formato local estándar: 04121234567 (11 dígitos) -> 0412-1234567
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  // Formato sin cero inicial: 4121234567 (10 dígitos) -> 0412-1234567
  if (digits.length === 10) {
    return `0${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  // Número internacional u otro válido (entre 7 y 15 dígitos)
  if (digits.length >= 7 && digits.length <= 15) {
    return raw.trim();
  }
  return null;
}

module.exports = {
  formatRate,
  formatBs,
  formatVenezuelanPhone
};
