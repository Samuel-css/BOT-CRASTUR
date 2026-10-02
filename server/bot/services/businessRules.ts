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

  // [HORARIO ROBUSTO] ¿Aplica el horario de semana a TODOS los días (incluido domingo)?
  const coversAllDays =
    horarioStr.includes('todos los dias') ||
    horarioStr.includes('todos los días') ||
    horarioStr.includes('lunes a domingo') ||
    horarioStr.includes('7 dias') ||
    horarioStr.includes('7 días');

  // [HORARIO ROBUSTO] Rango de días laborables de semana
  const worksMonday = !(horarioStr.includes('domingo') && horarioStr.trim().startsWith('domingo'));
  const weekdayRangeMatch = horarioStr.match(/lunes\s+a\s+(viernes|sabado|sábado|domingo)/);
  let worksSaturday = true;
  let worksSundayViaRange = false;
  if (weekdayRangeMatch) {
    const endDay = weekdayRangeMatch[1];
    worksSaturday = endDay === 'sabado' || endDay === 'sábado' || endDay === 'domingo';
    worksSundayViaRange = endDay === 'domingo';
  }

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

  // Extrae el par "apertura a cierre" de un fragmento de horario
  const extractTimes = (fragment: string): { open: number | null; close: number | null } => {
    const m = fragment.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*a\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (!m) return { open: null, close: null };
    return { open: parseTimeToMinutes(m[1]), close: parseTimeToMinutes(m[2]) };
  };

  // Horario general de semana (por defecto 8:00 AM - 8:00 PM)
  const weekdayTimes = extractTimes(weekdayPart);
  const weekdayOpen = weekdayTimes.open !== null ? weekdayTimes.open : 8 * 60;
  const weekdayClose = weekdayTimes.close !== null ? weekdayTimes.close : 20 * 60;

  // 1. Caso Domingo (day === 0)
  if (day === 0) {
    // Si el horario cubre todos los días, aplica el horario general
    if (coversAllDays) {
      return currentTotalMinutes >= weekdayOpen && currentTotalMinutes < weekdayClose;
    }

    if (!sundayPart || sundayPart.includes('cerrado') || sundayPart.includes('no laborable')) {
      // Sin horario de domingo explícito: solo abierto si el rango de días incluye domingo
      return worksSundayViaRange && currentTotalMinutes >= weekdayOpen && currentTotalMinutes < weekdayClose;
    }

    const sundayTimes = extractTimes(sundayPart);
    const openMin = sundayTimes.open !== null ? sundayTimes.open : 8 * 60 + 30;
    const closeMin = sundayTimes.close !== null ? sundayTimes.close : 14 * 60;
    return currentTotalMinutes >= openMin && currentTotalMinutes < closeMin;
  }

  // 2. Sábado (day === 6): respetar rangos "Lunes a Viernes"
  if (day === 6 && !coversAllDays && !worksSaturday) {
    return false;
  }

  // 3. Caso Lunes a Viernes (day 1..5) y sábados laborables
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
