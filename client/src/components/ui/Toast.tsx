import { toast as sonnerToast, type ExternalToast } from 'sonner';

export type ToastOptions = number | ExternalToast;

export interface ToastMethods {
  success: (msg: string, opts?: ToastOptions) => string | number;
  error: (msg: string, opts?: ToastOptions) => string | number;
  info: (msg: string, opts?: ToastOptions) => string | number;
  warning: (msg: string, opts?: ToastOptions) => string | number;
}

export interface UseToastReturn {
  toasts: unknown[];
  toast: ToastMethods;
  removeToast: () => void;
}

/**
 * Hook unificado useToast compatible con Sonner
 * Evita duplicación y garantiza que todas las notificaciones
 * se muestren en la parte superior derecha con diseño nítido y sin estorbar.
 */
export function useToast(): UseToastReturn {
  const toast: ToastMethods = {
    success: (msg: string, opts?: ToastOptions) => sonnerToast.success(msg, typeof opts === 'number' ? { duration: opts } : opts),
    error:   (msg: string, opts?: ToastOptions) => sonnerToast.error(msg, typeof opts === 'number' ? { duration: opts } : opts),
    info:    (msg: string, opts?: ToastOptions) => sonnerToast.info(msg, typeof opts === 'number' ? { duration: opts } : opts),
    warning: (msg: string, opts?: ToastOptions) => sonnerToast.warning(msg, typeof opts === 'number' ? { duration: opts } : opts),
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
export default function ToastContainer(): null {
  return null;
}
