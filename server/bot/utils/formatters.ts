/**
 * @file formatters.ts
 * @description Utilidades de formateo monetario (Bs. y USD) y extracción de números telefónicos venezolanos.
 * 
 * [MERCADO VENEZUELA]
 * Soporta números de las 3 principales operadoras móviles (Digitel 0412, Movistar 0414/0424, Movilnet 0416/0426)
 * y líneas fijas de Caracas (CANTV 0212), además de formatear importes en Bolívares con separadores locales.
 */

/**
 * Resultado de la extracción de números telefónicos en un mensaje.
 */
export interface ExtractedPhones {
  /** Array con todos los teléfonos únicos identificados */
  phones: string[];
  /** Primer teléfono válido encontrado */
  primary: string | null;
  /** Cadena unificada de teléfonos para comprobantes o notas de contacto */
  summary: string | null;
}

/**
 * Formatea la tasa oficial del BCV a dos decimales con separadores locales.
 * 
 * @param rate - Valor numérico o cadena de la tasa
 * @returns Tasa formateada (ej. "36,50")
 */
export function formatRate(rate: number | string | null | undefined): string {
  if (!rate) return '0.00';
  const num = typeof rate === 'number' ? rate : parseFloat(rate);
  return num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea importes en Bolívares con puntuación estándar venezolana (puntos de miles y comas decimales).
 * 
 * @param amount - Importe numérico en Bs.
 * @returns Cadena con el monto formateado
 */
export function formatBs(amount: number | null | undefined): string {
  return (amount || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Extrae y formatea números telefónicos venezolanos presentes en una cadena de texto.
 * Reconoce prefijos internacionales (+58) y locales (0412, 0414, 0424, 0416, 0426, 0212).
 * 
 * @param text - Texto del mensaje que puede contener uno o más teléfonos
 * @returns Estructura con teléfonos individuales, principal y resumen consolidado
 */
export function extractVenezuelanPhones(text: string | null | undefined): ExtractedPhones {
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

  // Contingencia para secuencias numéricas continuas (10 a 15 dígitos)
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
 * Limpia y normaliza un número de teléfono venezolano en formato estándar legible (04XX-XXXXXXX).
 * 
 * @param raw - Cadena cruda con el número
 * @returns Teléfono normalizado o null si no se identifica un formato válido
 */
export function formatVenezuelanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const extracted = extractVenezuelanPhones(raw);
  if (extracted && extracted.summary) {
    return extracted.summary;
  }
  return null;
}

export default {
  formatRate,
  formatBs,
  formatVenezuelanPhone,
  extractVenezuelanPhones
};
