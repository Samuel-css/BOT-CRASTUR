/**
 * @file courtesy.ts
 * @description Secciones 6, 6b y 7: cortesía, agradecimientos, confirmaciones y negaciones.
 */

import type { RouterContext } from './context';
import { db } from '../../../database';
import {
  handleCourtesyResponse,
  handleAffirmativeResponse,
  handleNegativeResponse
} from '../../handlers/greetingHandlers';

export function runCourtesySections(ctx: RouterContext): any | null {
  const { jid, text, norm, pushName, settings, session } = ctx;

  // ============================================================================
  // [SECCIÓN 6] Cortesía, Agradecimientos y Despedidas
  // Detección por fragmentos para tolerar modismos venezolanos ("fino gracias mano").
  // ============================================================================
  const esCortesia =
    norm === 'gracias' ||
    norm === 'chevere' ||
    norm === 'fino' ||
    norm === 'todo fino' ||
    norm === 'chao' ||
    norm === 'adios' ||
    norm === 'hasta luego' ||
    norm === 'nos vemos' ||
    norm === 'buen dia' ||
    norm === 'feliz dia' ||
    norm === 'feliz tarde' ||
    norm === 'feliz noche' ||
    norm === 'ok' ||
    norm === 'listo mi pana' ||
    norm.includes('gracias') ||
    norm.includes('fino gracias') ||
    norm.includes('chevere gracias') ||
    norm.includes('todo fino') ||
    norm.includes('mil gracias') ||
    norm.includes('muy amable') ||
    norm.includes('excelente servicio') ||
    norm.includes('buen servicio');

  // No tratar como cortesía si es una consulta (contiene signos de pregunta o intención de producto)
  const pareceConsulta = text.includes('?') || text.includes('¿') ||
    norm.includes('cuanto') || norm.includes('precio') || norm.includes('tienen') ||
    norm.includes('quiero') || norm.includes('busco') || norm.includes('hay ') || norm.includes('necesito');

  if (esCortesia && !pareceConsulta) {
    return handleCourtesyResponse(pushName, settings);
  }

  // ============================================================================
  // [SECCIÓN 6b] Confirmaciones Cotidianas Fuera de Flujo ("sí", "ok", "dale")
  // ============================================================================
  // Solo capturar frases muy cortas para no interceptar consultas con "si" condicional
  if (
    norm === 'si' ||
    norm === 'si!' ||
    norm === 'okey' ||
    norm === 'dale' ||
    norm === 'dale!' ||
    norm === 'listo' ||
    norm === 'perfecto' ||
    norm === 'vale' ||
    norm === 'claro' ||
    norm === 'seguro' ||
    norm === 'por favor' ||
    norm === 'porfa' ||
    norm === 'esta bien' ||
    norm === 'de acuerdo' ||
    norm === 'entendido' ||
    norm === 'copiado' ||
    (norm.startsWith('si ') && norm.length < 8 && !norm.includes('tienes') && !norm.includes('hay') && !norm.includes('precio') && !norm.includes('quiero') && !norm.includes('puedo')) ||
    (norm.startsWith('ok ') && norm.length < 10)
  ) {
    return handleAffirmativeResponse(pushName);
  }

  // ============================================================================
  // [SECCIÓN 7] Negaciones Cotidianas Fuera de Flujo ("no", "ya no")
  // ============================================================================
  if (
    norm === 'no' ||
    norm === 'ya no' ||
    norm === 'ya no gracias' ||
    norm === 'no gracias' ||
    norm === 'ninguno' ||
    norm === 'nada' ||
    norm === 'por ahora no' ||
    norm === 'despues' ||
    norm === 'mas tarde' ||
    norm === 'no por ahora' ||
    norm === 'luego' ||
    norm === 'en otro momento' ||
    (norm.startsWith('no ') && norm.length < 15 && !norm.includes('tienes') && !norm.includes('tienen') && !norm.includes('hay') && !norm.includes('tengo') && !norm.includes('se') && !norm.includes('sé') && !norm.includes('quiero') && !norm.includes('busco')) ||
    (norm.startsWith('ya no ') && norm.length < 20)
  ) {
    db.prepare("UPDATE chat_sessions SET seguimiento_enviado = 1 WHERE jid = ?").run(jid);
    return handleNegativeResponse();
  }

  return null;
}
