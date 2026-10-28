/**
 * @file aliases.ts
 * @description Resolución de identidades de chat de WhatsApp.
 *
 * [PROBLEMA] WhatsApp puede entregar el mismo contacto con dos identificadores distintos:
 * el número real (`584121234567@s.whatsapp.net`) y el identificador LID (`123456789@lid`).
 * Antes, la pausa del bot se guardaba en un solo identificador; si el asesor escribía
 * con uno y el cliente con el otro, el bot no veía la pausa y respondía por encima del
 * humano.
 *
 * [SOLUCIÓN] Se guarda una tabla de alias (`chat_aliases`) que agrupa todos los JID
 * conocidos de un mismo contacto bajo un `canonical_jid`. Todas las consultas de pausa
 * y reactivación revisan el grupo completo.
 */

import { db } from './engine';

/** Limpia un JID y descarta valores que no sean chats individuales. */
function cleanJid(jid: any): string {
  const value = String(jid || '').trim();
  if (!value) return '';
  if (!value.endsWith('@s.whatsapp.net') && !value.endsWith('@lid')) return '';
  return value;
}

/**
 * Registra que varios JID pertenecen al mismo contacto.
 * Si ya existía un grupo para alguno de ellos, se reutiliza su canónico.
 */
export function registerChatAliases(jids: Array<string | null | undefined>): void {
  const clean = Array.from(new Set(jids.map(cleanJid).filter(Boolean)));
  if (clean.length < 2) return;

  try {
    let canonical = '';
    for (const jid of clean) {
      const row = db.prepare('SELECT canonical_jid FROM chat_aliases WHERE alias_jid = ?').get(jid);
      if (row?.canonical_jid) {
        canonical = String(row.canonical_jid);
        break;
      }
    }

    // Preferir el número real como canónico (es el que use el panel para mostrar el teléfono).
    if (!canonical) {
      canonical = clean.find(j => j.endsWith('@s.whatsapp.net')) || clean[0];
    }

    const now = Date.now();
    for (const jid of clean) {
      const current = db.prepare('SELECT canonical_jid FROM chat_aliases WHERE alias_jid = ?').get(jid);
      if (current?.canonical_jid === canonical) continue;
      db.prepare(`
        INSERT OR REPLACE INTO chat_aliases (alias_jid, canonical_jid, updated_at)
        VALUES (?, ?, ?)
      `).run(jid, canonical, now);
    }
  } catch (e) {
    // Un fallo de alias nunca debe interrumpir la atención del chat.
  }
}

/**
 * Devuelve todos los JID conocidos del mismo contacto, incluyendo el recibido.
 * Si no hay alias registrados, devuelve únicamente el JID consultado.
 */
export function resolveChatJids(jid: string): string[] {
  const clean = cleanJid(jid);
  if (!clean) return [];

  try {
    const row = db.prepare('SELECT canonical_jid FROM chat_aliases WHERE alias_jid = ?').get(clean);
    const canonical = row?.canonical_jid ? String(row.canonical_jid) : clean;
    const rows = db.prepare('SELECT alias_jid FROM chat_aliases WHERE canonical_jid = ?').all(canonical);
    const group = new Set<string>([canonical, clean]);
    for (const r of rows) {
      if (r?.alias_jid) group.add(String(r.alias_jid));
    }
    return Array.from(group).filter(Boolean);
  } catch {
    return [clean];
  }
}

export default {
  registerChatAliases,
  resolveChatJids
};
