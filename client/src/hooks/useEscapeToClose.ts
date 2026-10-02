import { useEffect } from 'react';

/**
 * Cierra un modal/diálogo al presionar la tecla Escape.
 *
 * Centraliza el comportamiento para que TODOS los modales respondan igual
 * (antes solo ConfirmModal y QuickPriceModal lo hacían, generando inconsistencia).
 *
 * @param isOpen - Si el modal está actualmente abierto.
 * @param onClose - Callback a ejecutar al presionar Escape.
 * @param enabled - Permite desactivarlo (p. ej. mientras se guarda un formulario).
 */
export function useEscapeToClose(isOpen: boolean, onClose?: (() => void) | null, enabled: boolean = true): void {
  useEffect(() => {
    if (!isOpen || !enabled || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Evita que Escape cierre varios modales anidados a la vez
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, enabled, onClose]);
}

export default useEscapeToClose;
