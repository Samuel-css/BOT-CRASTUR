/**
 * ============================================================================
 * CONFIGURACIÓN COMERCIAL Y CONTROL DE PAUSA DEL BOT (db/settings.ts)
 * ============================================================================
 * Gestiona los parámetros operativos de la tienda (clave/valor), la tasa de cambio
 * efectiva (BCV o personalizada) y los interruptores de pausa del bot orientados al
 * cumplimiento de las políticas de mensajería de Meta.
 */

import { db, persistDB } from './engine';
import { resolveChatJids } from './aliases';

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
 *
 * [HUMAN TAKEOVER AUTOMÁTICO] Registra quién pausó el bot (`bot_pausado_por`) para que la
 * reactivación automática solo aplique a pausas originadas por un asesor y nunca a una
 * decisión manual del operador.
 */
export function toggleBotPause(jid: string, paused?: boolean | number): void {
  const now = Date.now();

  if (!paused) {
    // [ALIAS] Reanudar debe liberar TODAS las identidades conocidas del contacto.
    // Si no, el chat podía seguir pausado por el JID alterno (LID / número real).
    // No se crea una sesión nueva si el chat no existía: solo se limpia lo que haya.
    for (const target of resolveChatJids(jid)) {
      db.prepare(`
        UPDATE chat_sessions
        SET bot_pausado = 0,
            bot_pausado_por = NULL,
            bot_pausado_at = NULL
        WHERE jid = ?
      `).run(target);
    }
    return;
  }

  const exists = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
  if (!exists) {
    db.prepare(`
      INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea, bot_pausado_por, bot_pausado_at)
      VALUES (?, 'Cliente', 'start', ?, 0, 1, 1, 'manual', ?)
    `).run(jid, now, now);
  } else {
    db.prepare(`
      UPDATE chat_sessions
      SET bot_pausado = 1,
          bot_pausado_por = COALESCE(bot_pausado_por, 'manual'),
          bot_pausado_at = COALESCE(bot_pausado_at, ?)
      WHERE jid = ?
    `).run(now, jid);
  }
}

/**
 * [HUMAN TAKEOVER AUTOMÁTICO] Registra que un asesor humano escribió en el chat.
 * Si la pausa automática está activa (`auto_pausa_asesor`), silencia al bot de inmediato
 * para que nunca responda por encima de la conversación humana.
 *
 * @returns `true` si el bot quedó pausado por esta intervención.
 */
export function registerAdvisorActivity(jid: string, at?: number): boolean {
  const settings = getSettings();
  const autoPauseEnabled = settings.auto_pausa_asesor !== '0';
  const now = Date.now();
  const activityAt = Number(at) > 0 ? Number(at) : now;

  const exists = db.prepare('SELECT jid FROM chat_sessions WHERE jid = ?').get(jid);
  if (!exists) {
    db.prepare(`
      INSERT INTO chat_sessions (jid, push_name, step, ultimo_mensaje_at, seguimiento_enviado, bot_pausado, nivel_cashea, bot_pausado_por, bot_pausado_at, asesor_ultimo_at)
      VALUES (?, 'Cliente', 'start', ?, 1, ?, 1, ?, ?, ?)
    `).run(jid, now, autoPauseEnabled ? 1 : 0, autoPauseEnabled ? 'asesor' : null, autoPauseEnabled ? activityAt : null, activityAt);
    return autoPauseEnabled;
  }

  // `seguimiento_enviado = 1` evita recordatorios proactivos tras una intervención humana.
  // `fallos_consecutivos = 0` limpia el contador del bot (el humano ya está atendiendo).
  if (autoPauseEnabled) {
    db.prepare(`
      UPDATE chat_sessions
      SET bot_pausado = 1,
          bot_pausado_por = CASE
            WHEN bot_pausado = 1 AND bot_pausado_por = 'manual' THEN 'manual'
            ELSE 'asesor'
          END,
          bot_pausado_at = COALESCE(bot_pausado_at, ?),
          asesor_ultimo_at = CASE
            WHEN asesor_ultimo_at IS NULL OR asesor_ultimo_at < ? THEN ?
            ELSE asesor_ultimo_at
          END,
          seguimiento_enviado = 1,
          fallos_consecutivos = 0
      WHERE jid = ?
    `).run(activityAt, activityAt, activityAt, jid);
    return true;
  }

  db.prepare(`
    UPDATE chat_sessions
    SET asesor_ultimo_at = CASE
          WHEN asesor_ultimo_at IS NULL OR asesor_ultimo_at < ? THEN ?
          ELSE asesor_ultimo_at
        END,
        seguimiento_enviado = 1,
        fallos_consecutivos = 0
    WHERE jid = ?
  `).run(activityAt, activityAt, jid);
  return false;
}

/**
 * [REACTIVACIÓN AUTOMÁTICA] Evalúa si el bot debe retomar la conversación cuando el cliente
 * vuelve a escribir. Solo aplica a chats pausados automáticamente por un asesor:
 * si el asesor no responde desde hace `reactivar_bot_minutos`, el bot vuelve a atender.
 *
 * @returns `true` si el bot quedó habilitado para responder este mensaje.
 */
export function shouldReactivateBotForClient(jid: string): boolean {
  // [ALIAS] Se revisa el grupo completo de identificadores del mismo contacto.
  const targets = resolveChatJids(jid);
  let pausedByAdvisor = false;
  let lastAdvisorAt = 0;

  for (const target of targets) {
    const row = db.prepare('SELECT bot_pausado, bot_pausado_por, asesor_ultimo_at FROM chat_sessions WHERE jid = ?').get(target);
    if (!row || parseInt(row.bot_pausado) !== 1) continue;

    // Una pausa manual del operador jamás se revierte sola.
    if (row.bot_pausado_por === 'manual') return false;
    if (row.bot_pausado_por !== 'asesor') return false;

    pausedByAdvisor = true;
    const at = Number(row.asesor_ultimo_at) || 0;
    if (at > lastAdvisorAt) lastAdvisorAt = at;
  }

  if (!pausedByAdvisor) return true;
  if (!lastAdvisorAt) return false;

  const settings = getSettings();
  const minutos = parseInt(settings.reactivar_bot_minutos ?? '180', 10);
  if (isNaN(minutos) || minutos <= 0) return false;
  if (Date.now() - lastAdvisorAt < minutos * 60 * 1000) return false;

  for (const target of targets) {
    db.prepare(`
      UPDATE chat_sessions
      SET bot_pausado = 0, bot_pausado_por = NULL, bot_pausado_at = NULL
      WHERE jid = ? AND bot_pausado_por = 'asesor'
    `).run(target);
  }
  return true;
}

/**
 * Verifica si el bot se encuentra pausado localmente para una conversación individual.
 * [ALIAS] Revisa también el identificador alterno (LID / número real) del mismo contacto.
 */
export function isBotPaused(jid: string): boolean {
  const targets = resolveChatJids(jid);
  for (const target of targets) {
    const session = db.prepare('SELECT bot_pausado FROM chat_sessions WHERE jid = ?').get(target);
    if (session && parseInt(session.bot_pausado) === 1) return true;
  }
  return false;
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
