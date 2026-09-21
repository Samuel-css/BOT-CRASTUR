import { useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ===================== Hook useToast =====================
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration, exiting: false }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev =>
      prev.map(t => t.id === id ? { ...t, exiting: true } : t)
    );
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return { toasts, toast, removeToast };
}

// ===================== ToastItem =====================
function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const configs = {
    success: {
      icon: <CheckCircle size={17} />,
      bg: 'bg-emerald-950/90 border-emerald-700/60',
      iconColor: 'text-emerald-400',
      bar: 'bg-emerald-500'
    },
    error: {
      icon: <XCircle size={17} />,
      bg: 'bg-rose-950/90 border-rose-700/60',
      iconColor: 'text-rose-400',
      bar: 'bg-rose-500'
    },
    info: {
      icon: <Info size={17} />,
      bg: 'bg-sky-950/90 border-sky-700/60',
      iconColor: 'text-sky-400',
      bar: 'bg-sky-500'
    },
    warning: {
      icon: <AlertTriangle size={17} />,
      bg: 'bg-orange-950/90 border-orange-700/60',
      iconColor: 'text-orange-400',
      bar: 'bg-orange-500'
    }
  };

  const c = configs[toast.type] || configs.info;
  const dur = toast.duration || 4000;

  return (
    <div
      className={`relative flex items-start gap-3 min-w-[280px] max-w-sm w-full px-4 py-3.5 rounded-2xl border backdrop-blur-sm shadow-2xl overflow-hidden ${c.bg} ${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
    >
      <span className={`shrink-0 mt-0.5 ${c.iconColor}`}>{c.icon}</span>
      <p className="text-xs text-slate-100 font-medium leading-snug flex-1 pr-2">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-slate-400 hover:text-white transition mt-0.5"
      >
        <X size={14} />
      </button>
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${c.bar} opacity-60`}
        style={{ animation: `progressBar ${dur}ms linear forwards` }}
      />
    </div>
  );
}

// ===================== ToastContainer =====================
export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
