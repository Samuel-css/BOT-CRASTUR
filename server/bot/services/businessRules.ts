/**
 * @file businessRules.ts
 * @description Evaluación de reglas de negocio temporales y cálculo del horario comercial en Caracas.
 * 
 * [MERCADO VENEZUELA]
 * Gestiona el huso horario oficial de Venezuela (`America/Caracas`, UTC-4):
 * - Días de semana (Lunes a Sábado): típicamente 8:00 AM a 8:00 PM.
 * - Domingos: horario especial de apertura parcial (ej. 8:30 AM a 2:00 PM) o cerrado.
 * - Validación ante transacciones intentadas fuera de horario (bloqueo amable de apartados nocturnos).
 */

import { getSettings } from '../../database';

/**
 * Convierte expresiones textuales de hora a minutos acumulados del día (0 a 1439).
 * Soporta formatos "8:00 AM", "8:30am", "2:00 PM", "14:00", etc.
 * 
 * @param timeStr - Cadena representativa de la hora
 * @returns Minutos acumulados desde medianoche o null si el formato no es válido
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3] ? match[3].toLowerCase() : null;

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * Determina si la tienda física se encuentra actualmente abierta y en horario de atención comercial.
 * Convierte el tiempo local al huso horario de Caracas (`America/Caracas`).
 * 
 * @param settingsOverride - Objeto de configuración opcional para evitar lecturas redundantes a la BD
 * @returns `true` si la tienda está abierta; `false` si está fuera de horario o en pausa manual.
 */
export function isWithinBusinessHours(settingsOverride: Record<string, string> | null = null): boolean {
  let settings = settingsOverride;
  if (!settings) {
    try {
      settings = getSettings ? getSettings() : {};
    } catch {
      settings = {};
    }
  }

  // Si se activó la bandera de fuera de horario manual desde el panel
  if (settings && String(settings.fuera_horario_activo) === '1') {
    return false;
  }

  const now = new Date();
  // Conversión precisa al huso horario de Venezuela (America/Caracas, UTC-4)
  const vzNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  const day = vzNow.getDay(); // 0 = Domingo, 1 = Lunes ... 6 = Sábado
  const hour = vzNow.getHours();
  const minute = vzNow.getMinutes();
  const currentTotalMinutes = hour * 60 + minute;

  const rawHorario = settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';
  const horarioStr = rawHorario.toLowerCase();

  // Partición entre horario regular de semana y horario especial de domingo
  let weekdayPart = horarioStr;
  let sundayPart = '';
  if (horarioStr.includes('|')) {
    const parts = horarioStr.split('|');
    weekdayPart = parts[0].trim();
    sundayPart = parts.slice(1).join(' ').trim();
  } else if (horarioStr.includes('domingo')) {
    const idx = horarioStr.indexOf('domingo');
    weekdayPart = horarioStr.slice(0, idx).trim();
    sundayPart = horarioStr.slice(idx).trim();
  }

  // 1. Caso Domingo (day === 0)
  if (day === 0) {
    if (!sundayPart || sundayPart.includes('cerrado') || sundayPart.includes('no laborable')) {
      return false;
    }

    const timesMatch = sundayPart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*a\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    let openMin = 8 * 60 + 30; // 8:30 AM
    let closeMin = 14 * 60;     // 2:00 PM

    if (timesMatch) {
      const parsedOpen = parseTimeToMinutes(timesMatch[1]);
      const parsedClose = parseTimeToMinutes(timesMatch[2]);
      if (parsedOpen !== null) openMin = parsedOpen;
      if (parsedClose !== null) closeMin = parsedClose;
    }

    return currentTotalMinutes >= openMin && currentTotalMinutes < closeMin;
  }

  // 2. Caso Lunes a Sábado (day >= 1 && day <= 6)
  let weekdayOpen = 8 * 60;   // 8:00 AM
  let weekdayClose = 20 * 60; // 8:00 PM (20:00)

  const weekdayTimesMatch = weekdayPart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*a\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (weekdayTimesMatch) {
    const pOpen = parseTimeToMinutes(weekdayTimesMatch[1]);
    const pClose = parseTimeToMinutes(weekdayTimesMatch[2]);
    if (pOpen !== null) weekdayOpen = pOpen;
    if (pClose !== null) weekdayClose = pClose;
  }

  return currentTotalMinutes >= weekdayOpen && currentTotalMinutes < weekdayClose;
}

/**
 * Respuesta emitida cuando el cliente intenta concretar una reserva o compra fuera del horario de atención.
 * Explica la imposibilidad temporal de despacho pero permite continuar cotizando en tiempo real.
 * 
 * @param settings - Configuración general
 * @param tipo - Tipo de transacción intentada ('apartar', 'comprar')
 * @returns Mensaje orientador de tienda cerrada
 */
export function handleOutOfHoursTransactionResponse(
  settings: Record<string, string> | null | undefined,
  tipo: string = 'apartar'
): string {
  const horario = settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM';
  const customNotice = settings?.mensaje_fuera_horario;
  let msg = `⏰ *Tienda Temporalmente Cerrada* 🛞🏍️\n\n`;
  if (customNotice) {
    msg += `${customNotice}\n\n`;
  }
  if (tipo === 'apartar') {
    msg += `Para registrar un apartado de repuesto y coordinar el retiro en tienda física en San Agustín Norte, necesitamos estar en horario de atención comercial.\n\n`;
  } else {
    msg += `Para concretar una compra o reserva, necesitamos que la tienda esté en horario de atención.\n\n`;
  }
  msg += `🕒 *Horario de Atención:* ${horario}\n\n`;
  msg += `✅ *¡Nuestro Asistente Virtual sigue activo! Lo que sí puedes hacer ahora:*\n`;
  msg += `• Consultar precios, marcas y disponibilidad en tiempo real.\n`;
  msg += `• Ver tasa oficial BCV del día sin recargos.\n`;
  msg += `• Solicitar cotización o escribir *VENDEDOR* para que un asesor te contacte al abrir.\n\n`;
  msg += `👉 Escribe el repuesto que buscas y te cotizamos de inmediato. 😊`;
  return msg;
}

export default {
  isWithinBusinessHours,
  handleOutOfHoursTransactionResponse,
  parseTimeToMinutes
};
