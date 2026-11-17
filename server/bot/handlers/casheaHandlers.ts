/**
 * @file casheaHandlers.ts
 * @description Calculadora y respuestas de financiamiento Cashea.
 *
 * [COPY BREVE] La ficha de Cashea muestra inicial, cuotas y el paso a seguir en
 * pocas líneas. La explicación de niveles queda en una sola línea.
 */

import { db } from '../../database';
import { searchProductsFuzzy } from '../services/searchService';
import { resolveCasheaPlan } from '../utils/cashea';
import type { BotResponse } from '../../types/bot';
import { buildCasheaGeneral, buildCasheaProduct } from '../copy/messages';

/**
 * Procesa consultas de Cashea con un producto concreto o la explicación general.
 */
export function handleCasheaSmart(
  text: string,
  norm: string,
  settings: Record<string, string>,
  tasa: number,
  session?: any
): BotResponse {
  let nivel: number | null = null;

  if (norm.includes('nivel 1') || norm.includes('nv 1') || norm.includes('primer nivel')) {
    nivel = 1;
  } else if (norm.includes('nivel 2') || norm.includes('nv 2') || norm.includes('segundo nivel')) {
    nivel = 2;
  } else if (norm.includes('nivel 3') || norm.includes('nv 3') || norm.includes('nivel 4') || norm.includes('nivel 5') || norm.includes('tercer nivel')) {
    nivel = 3;
  }

  const plan = resolveCasheaPlan(settings, session, nivel);

  // Guardar el nivel para las siguientes fichas del mismo cliente.
  if (nivel && session && session.jid) {
    try {
      db.prepare('UPDATE chat_sessions SET nivel_cashea = ? WHERE jid = ?').run(nivel, session.jid);
      session.nivel_cashea = nivel;
    } catch {}
  }

  const products = searchProductsFuzzy(text);
  if (products.length > 0) {
    const prod = products[0];
    const msg = buildCasheaProduct({
      product: prod,
      tasa,
      settings,
      session,
      nivel: plan.nivel
    });

    if (prod.imagen_url && typeof prod.imagen_url === 'string' && prod.imagen_url.trim().length > 5) {
      return { text: msg, image: prod.imagen_url.trim() } as any;
    }
    return msg;
  }

  return handleCasheaResponse(settings, tasa, session, nivel);
}

/**
 * Explicación general de Cashea.
 */
export function handleCasheaResponse(
  settings: Record<string, string>,
  tasa: number,
  session?: any,
  nivelExplicit: number | null = null
): string {
  return buildCasheaGeneral(settings);
}

export default {
  handleCasheaSmart,
  handleCasheaResponse
};
