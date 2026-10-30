/**
 * @file formatters.js
 * @description Formateadores puros del Live Inbox: teléfono, hora de mensaje y tiempo relativo
 * de la lista de chats. Extraídos de LiveInboxView.jsx sin cambios de comportamiento.
 */

// Formateador de teléfono para mostrar
export function formatPhone(jid, session = null) {
  if (session?.telefono_contacto) {
    return session.telefono_contacto;
  }
  if (!jid) return '';
  if (jid.endsWith('@lid')) {
    return 'Cuenta de WhatsApp';
  }
  const num = jid.split('@')[0];
  if (num.startsWith('58') && num.length >= 12) {
    return `+58 ${num.slice(2, 5)} ${num.slice(5, 8)} ${num.slice(8)}`;
  }
  return `+${num}`;
}

// Formateador de fecha/hora para mensajes
export function formatMsgTime(ts) {
  if (!ts) return '';
  const date = new Date(Number(ts));
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Formateador de tiempo relativo inteligente para la lista de chats
export function formatChatTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - Number(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Ayer';
  if (d < 7) return `${d}d`;
  return new Date(Number(ts)).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
}

/** Hora exacta de un handoff: "03:40 p.m." */
export function formatHandoffTime(ts) {
  if (!ts) return '';
  try {
    return new Date(Number(ts))
      .toLocaleTimeString('es-VE', {
        timeZone: 'America/Caracas',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      .replace(/\s?([ap])\.?\s?m\.?/i, ' $1.m.')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return new Date(Number(ts)).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  }
}

/** Texto corto del tiempo restante del SLA: "42 min", "Vencido". */
export function handoffRemainingText(venceAt, now = Date.now()) {
  const vence = Number(venceAt) || 0;
  if (!vence) return '';
  const diff = vence - now;
  if (diff <= 0) return 'Vencido';
  const min = Math.ceil(diff / 60000);
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${min} min`;
}
