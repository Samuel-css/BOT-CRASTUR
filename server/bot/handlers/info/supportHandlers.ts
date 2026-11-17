/**
 * @file supportHandlers.ts
 * @description Atención paciente y manejo de quejas o desconfianza.
 *
 * [COPY BREVE] La respuesta reconoce al cliente, aclara que es un asistente virtual
 * y ofrece una persona, sin párrafos de defensa corporativa.
 */

import { buildPatientHelp, buildComplaintResponse } from '../../copy/messages';

/**
 * Atención paciente para clientes mayores o poco familiarizados con el chat.
 */
export function handleElderlyOrConfusedResponse(pushName: string, settings: Record<string, string>): string {
  return buildPatientHelp(settings);
}

/**
 * De-escala quejas, hostilidad o desconfianza ratificando la tienda física.
 */
export function handleHostilityOrComplaintResponse(pushName: string, settings: Record<string, string>): string {
  return buildComplaintResponse(settings);
}

export default {
  handleElderlyOrConfusedResponse,
  handleHostilityOrComplaintResponse
};
