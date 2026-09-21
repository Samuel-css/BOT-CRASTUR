/**
 * ==============================================================================
 * CRASTUR BOT ENGINE - PUENTE RETROCOMPATIBLE
 * ==============================================================================
 * La arquitectura de este archivo ha sido modularizada en el directorio ./bot/
 * para facilitar su lectura por Inteligencia Artificial y permitir un
 * mantenimiento estructurado, limpio y sin riesgo de errores colaterales.
 *
 * Módulos:
 *  - server/bot/config/     -> Sinónimos y Stop Words
 *  - server/bot/utils/      -> Normalizadores, Formateadores, Delivery y Anti-spam
 *  - server/bot/services/   -> Búsqueda difusa y Horario comercial
 *  - server/bot/handlers/   -> Respuestas de Saludos, Cashea, Info, Productos y Asesores
 *  - server/bot/apartado/   -> Flujo de reserva 24 horas y validaciones
 *  - server/bot/followUp/   -> Motor de seguimiento automático
 *  - server/bot/index.js    -> Enrutador principal (processIncomingMessage)
 * ==============================================================================
 */

module.exports = require('./bot');
