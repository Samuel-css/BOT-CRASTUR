/**
 * @file flowCommands.ts
 * @description Comandos transversales del router conversacional (Secciones 4 a 4d):
 * cancelación/reinicio de flujos, desuscripción voluntaria (opt-out anti-baneo),
 * detección de hostilidad/quejas y atención paciente a personas mayores o confundidas.
 */

import { db, getSettings, recordMetric } from '../../database';
import {
  handleHostilityOrComplaintResponse,
  handleElderlyOrConfusedResponse
} from '../handlers/infoHandlers';

/**
 * Evalúa comandos de cancelación, opt-out, hostilidad y atención especial.
 *
 * @returns string (respuesta), null (no aplica) o SILENCE (sentinela de silencio)
 */
export function runFlowCommands(jid: string, text: string, norm: string, pushName: string, session: any): string | null {
  // [ATENCIÓN PERSONA MAYOR / TRATO FORMAL] Saludos con tratamiento de respeto
  // (ej: "buenos días señor", "disculpe señora") reciben atención paciente.
  const esTratoFormal =
    (norm.includes('senor') || norm.includes('señor') || norm.includes('senora') || norm.includes('señora') || norm.includes('disculpe') || norm.includes('caballero')) &&
    (norm.includes('buenos dias') || norm.includes('buenas tardes') || norm.includes('buenas noches') || norm.includes('hola') || norm.includes('saludos') || norm.includes('disculpe'));

  if (esTratoFormal) {
    recordMetric('atencion_trato_formal', text, jid);
    return handleElderlyOrConfusedResponse(pushName, getSettings());
  }

  // [SECCIÓN 4] Cancelación y Reinicio de Flujos Conversacionales
  if (
    norm === 'cancelar' ||
    norm === 'cancelar operacion' ||
    norm === 'cancelar apartado' ||
    norm === 'salir' ||
    norm === 'reiniciar' ||
    norm === 'reset'
  ) {
    if (session.step && session.step !== 'start') {
      db.prepare("UPDATE chat_sessions SET step = 'start', apartado_metadata = NULL WHERE jid = ?").run(jid);
      return `Operación cancelada exitosamente 👍. Escribe *MENU* para volver al inicio o escribe el repuesto que estás buscando.`;
    }
    return `Escribe el repuesto o insumo que buscas (ejemplo: *"bujía bera"*, *"aceite 20w50"*) o escribe *MENU* para ver nuestras categorías.`;
  }

  // [SECCIÓN 4b] [ANTI-BANEO META 2025] Desuscripción Voluntaria (No Molestar)
  // Detección robusta por fragmentos para tolerar cortesías añadidas
  // (ej: "no me escriban más por favor") y variantes de "ya compré en otro lado".
  const isOptOut =
    norm === 'no molestar' ||
    norm === 'borrame' ||
    norm === 'eliminarme' ||
    norm === 'baja' ||
    norm === 'desuscribir' ||
    norm === 'opt out' ||
    norm === 'stop' ||
    norm.includes('no me escrib') ||
    norm.includes('no me mandes mensajes') ||
    norm.includes('no me manden mensajes') ||
    norm.includes('no me envies mensajes') ||
    norm.includes('no me envien mensajes') ||
    norm.includes('dejen de escribirme') ||
    norm.includes('deja de escribirme') ||
    norm.includes('no quiero mensajes') ||
    norm.includes('no quiero que me escriban') ||
    norm.includes('ya compre en otro lado') ||
    norm.includes('ya compré en otro lado') ||
    norm.includes('compre en otro lado') ||
    norm.includes('consegui en otro lado') ||
    norm.includes('conseguí en otro lado') ||
    norm.includes('ya no me interesa') ||
    norm.includes('no me contacten') ||
    norm.includes('no me contactes');

  if (isOptOut) {
    // [ANTI-BANEO / COHERENCIA] Se marca 'no_molestar = 1' para detener TODOS los mensajes
    // proactivos (seguimientos y recordatorios), pero NO se pausa el bot. Así el cliente que
    // escriba de nuevo (como promete el mensaje de confirmación) SÍ recibe respuesta.
    // Antes se ponía bot_pausado=1 y el cliente quedaba silenciado para siempre.
    db.prepare(`
      UPDATE chat_sessions
      SET no_molestar = 1,
          seguimiento_enviado = 1,
          step = 'start',
          apartado_metadata = NULL
      WHERE jid = ?
    `).run(jid);
    recordMetric('desuscripcion_no_molestar', text, jid);
    return `Entendido, *${pushName}*. Hemos registrado tu preferencia de *No Molestar* 👍 y no te enviaremos más mensajes automáticos ni recordatorios. Te ofrecemos una *disculpa* si te resultamos molestos. Si en el futuro necesitas consultar repuestos o insumos, solo escríbenos y con gusto te atenderemos. ¡Feliz día!`;
  }

  // [SECCIÓN 4c] Detección de Hostilidad, Quejas, Insultos o Acusaciones
  // Contexto dialectal de Venezuela: "coño" se usa como asombro cotidiano ("coño chamo qué barato").
  // [NOTA] normalizeText elimina la tilde de la ñ (coño -> cono). Por eso se evalúan
  // AMBAS variantes ('cono' y 'coño') para que la detección funcione con texto normalizado.
  const hasCono = norm.includes('cono') || norm.includes('coño');
  const hasAggressiveContext =
    norm.includes('madre') ||
    norm.includes('tu madre') ||
    norm.includes('maldit') ||
    norm.includes('ladron') ||
    norm.includes('estafador') ||
    norm.includes('mamag') ||
    norm.includes('mierda') ||
    norm.includes('hdp') ||
    norm.includes('incompetente');

  if (
    norm.includes('estafa') ||
    norm.includes('ladrones') ||
    norm.includes('robando') ||
    norm.includes('robo') ||
    norm.includes('trampa') ||
    norm.includes('enganoso') ||
    norm.includes('mentira') ||
    norm.includes('estafadores') ||
    norm.includes('denuncia') ||
    norm.includes('sundde') ||
    norm.includes('cicpc') ||
    norm.includes('fiscalia') ||
    norm.includes('policia') ||
    norm.includes('porqueria') ||
    norm.includes('pesimo servicio') ||
    norm.includes('mal servicio') ||
    norm.includes('incompetentes') ||
    norm.includes('estafaron') ||
    // [EMPATÍA] Cliente que se siente ignorado o mal atendido: merece disculpa y respuesta con
    // nombre y respaldo físico, no un fallback de "no logré ubicar el producto".
    norm.includes('no me han respondido') ||
    norm.includes('no me responden') ||
    norm.includes('no me contestan') ||
    norm.includes('nadie me responde') ||
    norm.includes('no atienden') ||
    norm.includes('no sirve esto') ||
    norm.includes('pesima atencion') ||
    norm.includes('mala atencion') ||
    norm.includes('mal atendido') ||
    norm.includes('no me han atendido') ||
    (hasCono && hasAggressiveContext) ||
    norm.includes('cono de tu madre') ||
    norm.includes('coño de tu madre') ||
    norm.includes('cono e tu madre') ||
    norm.includes('coño e tu madre') ||
    norm.includes('mamaguevo') ||
    norm.includes('maldito') ||
    norm.includes('malditos') ||
    norm.includes('hijo de puta') ||
    norm.includes('hdp')
  ) {
    recordMetric('queja_hostilidad', text, jid);
    return handleHostilityOrComplaintResponse(pushName, getSettings());
  }

  // [SECCIÓN 4d] Atención Paciente para Personas Mayores / Principiantes
  if (
    norm.includes('soy una persona mayor') ||
    norm.includes('soy mayor') ||
    norm.includes('soy viejo') ||
    norm.includes('soy vieja') ||
    norm.includes('tengo muchos anos') ||
    norm.includes('no entiendo nada') ||
    norm.includes('no se usar esto') ||
    norm.includes('no se como se usa') ||
    norm.includes('no se usarlo') ||
    norm.includes('no entiendo como funciona') ||
    norm.includes('me cuesta esto') ||
    norm.includes('es una computadora') ||
    norm.includes('eres una computadora') ||
    norm.includes('eres un robot') ||
    norm.includes('es un robot') ||
    norm.includes('hay alguien ahi') ||
    norm.includes('hay alguien hay') ||
    norm.includes('eres una persona') ||
    norm.includes('eres real') ||
    norm.includes('eres humano') ||
    norm.includes('no entiendo el telefono') ||
    norm.includes('no soy bueno con la tecnologia') ||
    norm.includes('no se como hacer') ||
    norm.includes('no entiendo la tecnologia') ||
    norm.includes('no se usar whatsapp') ||
    norm.includes('no entiendo esta aplicacion') ||
    norm.includes('me enrede') ||
    norm.includes('estoy enredado') ||
    norm.includes('estoy enredada') ||
    norm.includes('estoy confundido') ||
    norm.includes('estoy confundida') ||
    norm.includes('no comprendo') ||
    norm.includes('explicame mejor') ||
    norm.includes('explicamelo con calma') ||
    norm.includes('con calma') ||
    norm.includes('despacio por favor') ||
    norm.includes('poco a poco')
  ) {
    recordMetric('atencion_persona_mayor', text, jid);
    return handleElderlyOrConfusedResponse(pushName, getSettings());
  }

  return null;
}
