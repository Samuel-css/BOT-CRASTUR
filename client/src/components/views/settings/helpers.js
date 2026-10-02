/**
 * @file helpers.js
 * @description Funciones puras de apoyo para la vista de configuración:
 * parser de métodos de pago, comparador tolerante y constructor de horarios.
 * Extraído de SettingsView.jsx.
 */

import { PAYMENT_OPTIONS } from './constants';

/**
 * Analizador inteligente que normaliza las opciones de pago activas y descarta texto legado duplicado.
 */
export const parseActivePayments = (rawString) => {
  if (rawString === undefined || rawString === null) return PAYMENT_OPTIONS.map(o => o.label);
  const trimmed = String(rawString).trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'ninguno' || trimmed.toLowerCase() === 'vacio') return [];
  const lower = trimmed.toLowerCase();
  return PAYMENT_OPTIONS.filter(opt => {
    if (lower.includes(opt.label.toLowerCase())) return true;
    if (opt.id === 'efectivo' && (lower.includes('efectivo $') || lower.includes('efectivo') || lower.includes('divisas'))) return true;
    if (opt.id === 'binance' && (lower.includes('binance') || lower.includes('usdt'))) return true;
    if (opt.id === 'pagomovil' && (lower.includes('pago móvil') || lower.includes('pago movil'))) return true;
    if (opt.id === 'cashea' && lower.includes('cashea')) return true;
    if (opt.id === 'puntoventa' && (lower.includes('punto de venta') || lower.includes('punto'))) return true;
    if (opt.id === 'transferencia' && lower.includes('transferencia')) return true;
    return false;
  }).map(opt => opt.label);
};

/** Comparador robusto que ignora saltos de línea CRLF/LF o espacios accidentales. */
export const cleanCompare = (a, b) => (a || '').replace(/\s+/g, ' ').trim() === (b || '').replace(/\s+/g, ' ').trim();

/** Generador de texto de horario combinando días de semana y domingos. */
export const buildScheduleString = (days, open, close, sunday) => {
  let str = `${days} de ${open} a ${close}`;
  if (sunday === 'cerrado') {
    str += ' (Domingos Cerrado)';
  } else if (sunday && sunday !== 'ninguno') {
    str += ` | Domingos de ${sunday}`;
  }
  return str;
};
