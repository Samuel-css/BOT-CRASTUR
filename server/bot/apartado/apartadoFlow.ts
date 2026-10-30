/**
 * @file apartadoFlow.ts
 * @description BARRIL del flujo de Apartados por 24 horas. La implementación está dividida en:
 *   - interruptions.ts  → comandos de escape, detección de interrupciones y respuestas a consultas.
 *   - initiate.ts       → identificación de producto/combo y arranque del flujo.
 *   - steps/name.ts     → validación del nombre y apellido.
 *   - steps/cedula.ts   → validación de cédula/RIF.
 *   - steps/phone.ts    → teléfono, creación de la reserva y ticket oficial.
 *
 * Se conserva esta fachada para no cambiar los imports del router.
 */

export { isApartadoEscapeCommand } from './interruptions';
export { initiateApartadoFlow } from './initiate';
export { handleApartadoNombre } from './steps/name';
export { handleApartadoCedula } from './steps/cedula';
export { handleApartadoTelefono } from './steps/phone';

import { initiateApartadoFlow } from './initiate';
import { handleApartadoNombre } from './steps/name';
import { handleApartadoCedula } from './steps/cedula';
import { handleApartadoTelefono } from './steps/phone';

export default {
  initiateApartadoFlow,
  handleApartadoNombre,
  handleApartadoCedula,
  handleApartadoTelefono
};
