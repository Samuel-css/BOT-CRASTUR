/**
 * @file cashea.ts
 * @description Utilidad única para resolver el plan de financiamiento Cashea.
 *
 * [POR QUÉ EXISTE]
 * Antes, la ficha de producto y el manejador de Cashea calculaban la inicial por separado:
 * la ficha usaba siempre `cashea_inicial_pct` (40%) y el manejador aplicaba 40/30/20 según
 * el nivel. Un cliente Nivel 3 veía "40%" en la ficha y "20%" en la consulta de Cashea.
 * Esta utilidad centraliza el cálculo para que ambos caminos coincidan.
 *
 * Reglas del negocio:
 * - Nivel 1: porcentaje configurado en el panel (por defecto 40%).
 * - Nivel 2: 30%.
 * - Nivel 3 o superior: 20%.
 */

export interface CasheaPlan {
  /** Nivel efectivo aplicado (1, 2 o 3+). */
  nivel: number;
  /** Fracción de inicial (0.40, 0.30 o 0.20). */
  inicialPct: number;
  /** Número de cuotas quincenales configurado por la tienda. */
  cuotas: number;
}

/**
 * Resuelve el plan Cashea a usar.
 *
 * @param settings - Configuración de la tienda
 * @param session - Sesión del chat (puede traer `nivel_cashea`)
 * @param levelHint - Nivel detectado explícitamente en el mensaje (prioridad máxima)
 */
export function resolveCasheaPlan(
  settings: Record<string, string> | null | undefined,
  session?: any,
  levelHint?: number | null
): CasheaPlan {
  const nivelSesion = parseInt(session?.nivel_cashea, 10);
  const nivel = levelHint && levelHint > 0
    ? levelHint
    : (Number.isFinite(nivelSesion) && nivelSesion > 0 ? nivelSesion : 1);

  let inicialPct: number;
  if (nivel >= 3) {
    inicialPct = 0.20;
  } else if (nivel === 2) {
    inicialPct = 0.30;
  } else {
    const configurado = parseFloat(String(settings?.cashea_inicial_pct ?? '40'));
    inicialPct = (Number.isFinite(configurado) ? configurado : 40) / 100;
  }

  const cuotasConfig = parseInt(String(settings?.cashea_cuotas ?? '3'), 10);
  const cuotas = Number.isFinite(cuotasConfig) && cuotasConfig > 0 ? cuotasConfig : 3;

  return { nivel, inicialPct, cuotas };
}

export default { resolveCasheaPlan };
