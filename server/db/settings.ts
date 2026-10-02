/**
 * ============================================================================
 * CONFIGURACIÓN COMERCIAL Y CONTROL DE PAUSA DEL BOT (db/settings.ts)
 * ============================================================================
 * Gestiona los parámetros operativos de la tienda (clave/valor), la tasa de cambio
 * efectiva (BCV o personalizada) y los interruptores de pausa del bot orientados al
 * cumplimiento de las políticas de mensajería de Meta.
 */

import { db, persistDB } from './engine';

/**
 * Obtiene el mapa completo de configuración y parámetros de la tienda.
 */
export function getSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj: Record<string, string> = {};
  for (const r of rows) {
    obj[r.key] = r.value;
  }
  return obj;
}

/**
 * Actualiza o inserta un parámetro individual en la configuración.
 */
export function updateSetting(key: string, value: any): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

/**
 * [MERCADO VENEZUELA]
 * Retorna la tasa de cambio vigente para conversiones comerciales (Bs/USD).
 * Si el comercio activó la tasa personalizada/manual, prevalece sobre el BCV.
 */
export function getEffectiveRate(): number {
  const settings = getSettings();
  if (settings.tasa_manual_activa === '1' && settings.tasa_personalizada) {
    return parseFloat(settings.tasa_personalizada) || 849.56;
  }
  return parseFloat(settings.tasa_bcv) || 849.56;
}

/**
 * Pausa o reactiva la intervención del bot para un chat específico.
 * [ANTI-BANEO META 2025] Permite a un asesor humano tomar el control sin interferencia del bot.
 */
export function toggleBotPause(jid: string, paused?: boolean | number): void {
  const exists = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
  if (!exists) {
    db.prepare(`
      INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea)
      VALUES (?, 'Cliente', 'start', ?, 0, ?, 1)
    `).run(jid, Date.now(), paused ? 1 : 0);
  } else {
    db.prepare(`
      UPDATE chat_sessions
      SET bot_pausado = ?
      WHERE jid = ?
    `).run(paused ? 1 : 0, jid);
  }
}

/**
 * Verifica si el bot se encuentra pausado localmente para una conversación individual.
 */
export function isBotPaused(jid: string): boolean {
  const session = db.prepare('SELECT bot_pausado FROM chat_sessions WHERE jid = ?').get(jid);
  return session ? parseInt(session.bot_pausado) === 1 : false;
}

/**
 * Comprueba si la intervención del bot está pausada a nivel global para todas las conversaciones.
 */
export function isBotGloballyPaused(): boolean {
  const s = getSettings();
  return s.bot_pausado_global === '1';
}

/**
 * Modifica el interruptor de pausa global del bot en toda la tienda.
 */
export function setBotGlobalPause(paused: boolean | number): boolean {
  updateSetting('bot_pausado_global', paused ? '1' : '0');
  return !!paused;
}

/** Fuerza la persistencia inmediata a disco (utilidad de conveniencia). */
export function persistImmediateSync(): void {
  persistDB();
}
