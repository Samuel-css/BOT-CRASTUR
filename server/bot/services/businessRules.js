/**
 * Comprueba si la tienda está dentro del horario de atención.
 * Lunes=1 … Sábado=6. Horario: 8:00 AM – 8:00 PM (hora Venezuela UTC-4).
 */
function isWithinBusinessHours() {
  const now = new Date();
  // Hora Venezuela (UTC-4)
  const vzNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  const day = vzNow.getDay(); // 0=Dom, 1=Lun … 6=Sáb
  const hour = vzNow.getHours();
  const isWeekday = day >= 1 && day <= 6; // Lunes a Sábado
  const isOpenHour = hour >= 8 && hour < 20; // 8:00 AM a 8:00 PM
  return isWeekday && isOpenHour;
}

/**
 * Respuesta para cuando el cliente intenta hacer una transacción (apartar/comprar)
 * fuera del horario de atención. Permite consultas pero indica que no puede concretar.
 */
function handleOutOfHoursTransactionResponse(settings, tipo = 'apartar') {
  const horario = settings.horario_atencion || 'Lunes a Sábado de 8:00 AM a 8:00 PM';
  let msg = `⏰ *Tienda Temporalmente Cerrada* 🚗\n\n`;
  if (tipo === 'apartar') {
    msg += `Para registrar un apartado de repuesto necesitamos que la tienda esté abierta para coordinar el retiro.\n\n`;
  } else {
    msg += `Para concretar una compra o reserva, necesitamos que la tienda esté abierta.\n\n`;
  }
  msg += `🕒 *Horario de Atención:* ${horario}\n\n`;
  msg += `✅ *Lo que sí puedes hacer ahora:*\n`;
  msg += `• Consultar precios y disponibilidad de repuestos.\n`;
  msg += `• Preguntar por medidas, compatibilidad o cualquier duda técnica.\n`;
  msg += `• Solicitar cotización para tenerla lista al abrir.\n\n`;
  msg += `👉 Escribe el repuesto que buscas y te cotizamos de inmediato, o escribe *VENDEDOR* para que un asesor te contacte al abrir. 😊`;
  return msg;
}

module.exports = {
  isWithinBusinessHours,
  handleOutOfHoursTransactionResponse
};
