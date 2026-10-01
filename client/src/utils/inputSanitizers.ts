import React from 'react';

/**
 * Utilitarios de Sanitización y Protección de Inputs para CRASTUR
 * Previene errores humanos, caracteres inválidos (e, +, -, espacios en números),
 * números negativos, desbordamiento y clonación accidental por doble clic.
 */

/**
 * Intercepta teclas en inputs numéricos en tiempo real (onKeyDown).
 */
export function handleNumericKeyDown(e: React.KeyboardEvent<HTMLInputElement>, allowDecimals = true): void {
  // Teclas de navegación y control de edición permitidas
  const allowedControlKeys = [
    'Backspace',
    'Delete',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Tab',
    'Enter',
    'Escape',
    'Home',
    'End'
  ];

  if (allowedControlKeys.includes(e.key)) {
    return;
  }

  // Permitir atajos con Ctrl o Meta (Cmd en Mac) como Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+Z
  if (e.ctrlKey || e.metaKey) {
    return;
  }

  // Bloqueo explícito de 'e', 'E', '+', '-', ' '
  if (['e', 'E', '+', '-', ' '].includes(e.key)) {
    e.preventDefault();
    return;
  }

  // Manejo de decimales (punto o coma)
  if (allowDecimals && (e.key === '.' || e.key === ',')) {
    const target = e.target as HTMLInputElement;
    const val = String(target?.value || '');
    if (val.includes('.') || val.includes(',')) {
      e.preventDefault(); // Ya contiene un separador decimal
    }
    return;
  }

  // Si no es un dígito del 0 al 9, bloquear
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

/**
 * Sanitiza montos en dólares ($ USD) al escribir (onChange) o al perder foco (onBlur).
 */
export function sanitizeCurrency(val: string | number | null | undefined, min = 0.01, max = 50000): string {
  if (val === undefined || val === null || val === '') return '';
  
  // Reemplazar comas por puntos y quitar cualquier carácter no numérico ni punto
  let cleaned = String(val).replace(/,/g, '.').replace(/[^\d.]/g, '');
  
  // Permitir solo el primer punto decimal
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  // Limitar a 2 decimales si ya tiene punto
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = `${parts[0]}.${parts[1].slice(0, 2)}`;
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return '';
  
  // Si excede el máximo razonable para un repuesto
  if (num > max) return String(max);

  return cleaned;
}

/**
 * Sanitiza números enteros estrictos para Stock o Cantidades.
 */
export function sanitizeInteger(val: string | number | null | undefined, min = 0, max = 99999): number {
  if (val === undefined || val === null || val === '') return min;
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return min;
  const num = parseInt(digits, 10);
  if (isNaN(num) || num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Sanitiza y recorta cadenas de texto (Marca, Modelo, Descripción, Asesor).
 * Evita inyección de espacios múltiples o textos gigantescos.
 */
export function sanitizeText(val: string | number | null | undefined, maxLength = 100): string {
  if (!val) return '';
  return String(val)
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, maxLength);
}

/**
 * Sanitiza números de teléfono al escribir.
 * Permite solo dígitos, espacios, guiones y un '+' inicial.
 */
export function handlePhoneKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
  const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'];
  if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
  
  const target = e.target as HTMLInputElement;

  // Permitir '+' solo como primer carácter
  if (e.key === '+') {
    if (target.selectionStart !== 0 || target.value.includes('+')) {
      e.preventDefault();
    }
    return;
  }

  // Permitir guión o espacio para separación
  if (e.key === '-' || e.key === ' ') {
    return;
  }

  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}
