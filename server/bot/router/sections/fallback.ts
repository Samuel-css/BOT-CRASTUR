/**
 * @file fallback.ts
 * @description Sección 36: respuesta por defecto con doble intento y aviso al panel
 * tras tres mensajes consecutivos sin coincidencia.
 */

import type { RouterContext } from './context';
import { db, recordMetric } from '../../../database';
import { notifyLiveMessage } from '../../../whatsapp/socketState';
import { handleDefaultFallback, handleSecondFallback } from '../../handlers/fallbackHandlers';

export function runFallbackSection(ctx: RouterContext): any {
  const { jid, text, pushName, session, settings } = ctx;
  // ============================================================================
  // [SECCIÓN 36] Respuesta por Defecto (Fallback con Doble Intento)
  // [RED DE SEGURIDAD] 1er intento: ejemplos. 2º seguido: menú completo + asesor.
  // ============================================================================
  recordMetric('consulta_sin_match', text, jid);

  let fallosPrevios = 0;
  try {
    fallosPrevios = parseInt(session?.fallos_consecutivos || 0, 10) || 0;
  } catch { fallosPrevios = 0; }

  const nuevosFallos = fallosPrevios + 1;
  try {
    db.prepare('UPDATE chat_sessions SET fallos_consecutivos = ? WHERE jid = ?').run(nuevosFallos, jid);
  } catch {}

  // [NO INSISTIR / NO SABROSEAR] Tercer mensaje seguido sin entender: el bot deja de
  // responder (evita el efecto "bot necio") y deja un aviso visible en el Live Inbox para
  // que un asesor humano tome el chat. Los comandos (VENDEDOR, MENU, precios, etc.) siguen
  // funcionando porque se evalúan antes de esta sección.
  if (nuevosFallos >= 3) {
    if (nuevosFallos === 3) {
      const aviso = '🟡 El bot no logró entender 3 mensajes seguidos. Un asesor debería atender esta conversación.';
      try {
        const avisoInsert = db.prepare(`
          INSERT INTO chat_messages (jid, remitente, contenido, timestamp)
          VALUES (?, 'sistema', ?, ?)
        `).run(jid, aviso, Date.now());
        notifyLiveMessage({
          id: avisoInsert?.lastInsertRowid,
          jid,
          pushName: 'Sistema',
          remitente: 'sistema',
          contenido: aviso,
          timestamp: Date.now()
        });
      } catch {}
      console.log(`[Bot] 🤐 Silencio preventivo para ${jid}: 3 mensajes seguidos sin coincidencia. Aviso enviado al panel.`);
    }
    return null;
  }

  if (nuevosFallos >= 2) {
    // El cliente ya lleva 2 mensajes sin coincidencia → persona del mostrador (sin listas largas)
    return handleSecondFallback(pushName, settings);
  }

  return handleDefaultFallback(pushName, settings);
}
