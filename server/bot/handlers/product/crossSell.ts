/**
 * @file crossSell.ts
 * @description Módulo de productos extraído de productHandlers.ts.
 */

import { db } from '../../../database';
import { formatBs, formatRate } from '../../utils/formatters';
import { detectCaracasZone } from '../../utils/caracasDelivery';
import { normalizeText } from '../../utils/textUtils';
import { resolveCasheaPlan } from '../../utils/cashea';
import { stockLabel } from '../../utils/stock';
import type { BotResponse } from '../../../types/bot';
export function reglasDeComplemento(p: any): { buscar: string[]; evitar: string[]; frase: string } | null {
  const cat = (p.categoria || '').toLowerCase();
  const mod = (p.modelo || '').toLowerCase();
  const esAceite = mod.includes('aceite') || cat.includes('lubricante') || cat.includes('aceite');
  const esBujia = mod.includes('bujia') || cat.includes('encendido');
  const esArrastre = mod.includes('arrastre') || mod.includes('cadena') || mod.includes('pinon') || mod.includes('corona') || mod.includes('kit de arrastre');
  const esFreno = mod.includes('pastilla') || mod.includes('freno') || mod.includes('banda') || mod.includes('balata');
  const esParche = mod.includes('parche') || mod.includes('pega') || mod.includes('mecha') || mod.includes('valvula') || cat.includes('cauchera');
  const esLLanta = mod.includes('caucho') || mod.includes('llanta') || mod.includes('tripa') || mod.includes('neumatico');

  if (esAceite) return { buscar: ['bujia', 'filtro', 'refrigerante'], evitar: ['aceite'], frase: 'Para el servicio completo, te puede servir' };
  if (esBujia) return { buscar: ['aceite', 'filtro', 'cadena'], evitar: ['bujia'], frase: 'Para completar el mantenimiento, te ofrecemos' };
  if (esArrastre) return { buscar: ['grasa', 'lubricante', 'spray', 'aceite', 'cadena'], evitar: ['arrastre'], frase: 'Para instalar tu kit de arrastre, te puede servir' };
  if (esFreno) return { buscar: ['liga', 'liquido', 'freno', 'dot'], evitar: ['pastilla', 'banda'], frase: 'Para el cambio de frenos, te puede servir' };
  if (esParche) return { buscar: ['parche', 'pega', 'valvula', 'mecha', 'terraja'], evitar: [], frase: 'Para el taller, no te puede faltar' };
  if (esLLanta) return { buscar: ['valvula', 'parche', 'pega', 'tripa'], evitar: [], frase: 'Para montarlo, te puede servir' };
  return null;
}

/**
 * [VENTA CRUZADA] Busca hasta 3 productos REALES del inventario que complementan al producto visto.
 * Excluye el propio producto y artículos sin stock. Nunca inventa productos que no existan.
 */
export function buscarComplementarios(p: any): any[] {
  const regla = reglasDeComplemento(p);
  if (!regla) return [];

  try {
    const activos: any[] = db.prepare('SELECT * FROM products WHERE activo = 1 AND stock > 0').all();
    const encontrados: any[] = [];
    for (const prod of activos) {
      if (String(prod.id) === String(p.id)) continue;
      const etiqueta = normalizeText(`${prod.marca} ${prod.modelo} ${prod.categoria} ${prod.descripcion || ''}`);
      if (regla.evitar.some(ev => etiqueta.includes(ev))) continue;
      if (regla.buscar.some(b => etiqueta.includes(b))) {
        encontrados.push(prod);
        if (encontrados.length >= 3) break;
      }
    }
    return encontrados;
  } catch {
    return [];
  }
}

/** Frase de sugerencia de venta cruzada según el producto visto. */
export function fraseComplemento(p: any): string {
  const regla = reglasDeComplemento(p);
  return regla ? regla.frase : 'También te puede interesar';
}

/**
 * Formatea un listado de múltiples productos coincidentes en la búsqueda difusa.
 * 
 * @param products - Lista de productos encontrados
 * @param tasa - Tasa BCV oficial
 * @param settings - Configuración general
 * @param session - Sesión de chat actual
 * @returns Listado numerado con precios y opciones rápidas
 */
