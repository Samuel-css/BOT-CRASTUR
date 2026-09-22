// Contador anti-spam por JID: {jid: {count, resetAt}}
const spamCounters = new Map();

/**
 * Anti-spam: devuelve true si el cliente está enviando demasiados mensajes.
 * Límite: 15 mensajes por minuto
 */
function isSpamming(jid) {
  const now = Date.now();
  const limit = 30; // mensajes máximos por ventana de 60s (protección contra bots sin bloquear humanos rápidos)
  const window = 60 * 1000; // 60 segundos

  if (!spamCounters.has(jid)) {
    spamCounters.set(jid, { count: 1, resetAt: now + window });
    return false;
  }
  const counter = spamCounters.get(jid);
  if (now > counter.resetAt) {
    counter.count = 1;
    counter.resetAt = now + window;
    return false;
  }
  counter.count++;
  return counter.count > limit;
}

function resetSpam(jid = null) {
  if (jid) {
    spamCounters.delete(jid);
  } else {
    spamCounters.clear();
  }
}

module.exports = {
  isSpamming,
  resetSpam
};
