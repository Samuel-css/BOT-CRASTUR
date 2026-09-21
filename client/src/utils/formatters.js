/**
 * Formatea un monto en Bolívares con separadores de miles y 2 decimales
 */
export function formatBs(amount) {
  return (amount || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea la tasa oficial del BCV exactamente sin redondear a entero
 * Muestra hasta 4 decimales si existen o mínimo 2 (ej: 849.5640 o 849.56)
 */
export function formatRate(rate) {
  if (!rate) return '0.00';
  const num = typeof rate === 'number' ? rate : parseFloat(rate);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Calcula el tiempo restante para el límite de 24 horas de un apartado
 */
export function formatTimeRemaining(expiraEn) {
  const now = Date.now();
  const diffMs = expiraEn - now;

  if (diffMs <= 0) {
    return {
      hours: 0,
      minutes: 0,
      totalMs: 0,
      isExpired: true,
      text: 'Expirado',
      statusColor: 'rose'
    };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let text = '';
  if (hours > 0) {
    text = `${hours}h ${minutes}m restantes`;
  } else {
    text = `${minutes} min restantes`;
  }

  let statusColor = 'emerald'; // Más de 6 horas
  if (hours < 2) {
    statusColor = 'rose'; // Menos de 2 horas (Urgente)
  } else if (hours < 6) {
    statusColor = 'amber'; // Entre 2 y 6 horas
  }

  return {
    hours,
    minutes,
    totalMs: diffMs,
    isExpired: false,
    text,
    statusColor
  };
}

/**
 * Formatea una fecha y hora en formato legible
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
