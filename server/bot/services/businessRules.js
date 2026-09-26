/**
 * Convierte strings como "8:00 AM", "8:30am", "2:00 PM", "14:00" a minutos del día (0 - 1439).
 */
function parseTimeToMinutes(timeStr) {
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
 * Comprueba si la tienda física está dentro del horario de atención comercial.
 * Soporta horario de semana (Lunes a Sábado) y horario especial de Domingos (ej. 8:30 AM a 2:00 PM o cerrado).
 */
function isWithinBusinessHours(settingsOverride = null) {
  let settings = settingsOverride;
  if (!settings) {
    try {
      const dbModule = require('../../database');
      settings = dbModule.getSettings ? dbModule.getSettings() : {};
    } catch {
      settings = {};
    }
  }

  // Si se marcó manualmente como fuera de horario desde el panel, está cerrada
  if (settings && String(settings.fuera_horario_activo) === '1') {
    return false;
  }

  const now = new Date();
  // Hora local de Caracas, Venezuela (UTC-4)
  const vzNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  const day = vzNow.getDay(); // 0=Domingo, 1=Lunes … 6=Sábado
  const hour = vzNow.getHours();
  const minute = vzNow.getMinutes();
  const currentTotalMinutes = hour * 60 + minute;

  const rawHorario = settings?.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM | Domingos de 8:30 AM a 2:00 PM';
  const horarioStr = rawHorario.toLowerCase();

  // Partición entre horario de semana y horario de domingos
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

  // 1. CASO DOMINGO (day === 0)
  if (day === 0) {
    // Si no se menciona el domingo o indica que está cerrado / no laborable
    if (!sundayPart || sundayPart.includes('cerrado') || sundayPart.includes('no laborable')) {
      return false;
    }

    // Extraer horas de apertura y cierre para el domingo
    const timesMatch = sundayPart.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*a\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    let openMin = 8 * 60 + 30; // 8:30 AM por defecto
    let closeMin = 14 * 60;     // 2:00 PM por defecto

    if (timesMatch) {
      const parsedOpen = parseTimeToMinutes(timesMatch[1]);
      const parsedClose = parseTimeToMinutes(timesMatch[2]);
      if (parsedOpen !== null) openMin = parsedOpen;
      if (parsedClose !== null) closeMin = parsedClose;
    }

    return currentTotalMinutes >= openMin && currentTotalMinutes < closeMin;
  }

  // 2. CASO LUNES A SÁBADO (day >= 1 && day <= 6)
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
 * Respuesta para cuando el cliente intenta hacer una transacción (apartar/comprar)
 * fuera del horario de atención. Permite consultas pero indica que no puede concretar.
 */
function handleOutOfHoursTransactionResponse(settings, tipo = 'apartar') {
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

module.exports = {
  isWithinBusinessHours,
  handleOutOfHoursTransactionResponse
};
