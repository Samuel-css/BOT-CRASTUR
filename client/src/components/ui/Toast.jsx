import { toast as sonnerToast } from 'sonner';

/**
 * Hook unificado useToast compatible con Sonner
 * Evita duplicación y garantiza que todas las notificaciones
 * se muestren en la parte superior derecha con diseño nítido y sin estorbar.
 */
export function useToast() {
  const toast = {
    success: (msg, opts) => sonnerToast.success(msg, typeof opts === 'number' ? { duration: opts } : opts),
    error:   (msg, opts) => sonnerToast.error(msg, typeof opts === 'number' ? { duration: opts } : opts),
    info:    (msg, opts) => sonnerToast.info(msg, typeof opts === 'number' ? { duration: opts } : opts),
    warning: (msg, opts) => sonnerToast.warning(msg, typeof opts === 'number' ? { duration: opts } : opts),
  };

  return {
    toasts: [],
    toast,
    removeToast: () => {}
  };
}

/**
 * ToastContainer simplificado (Sonner maneja el renderizado del portal)
 */
export default function ToastContainer() {
  return null;
}
