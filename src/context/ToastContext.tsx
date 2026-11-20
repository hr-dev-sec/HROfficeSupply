import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (title: string, type?: ToastType, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (title: string, type: ToastType = 'success', description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, type }]);
      setTimeout(() => removeToast(id), 4200);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="no-print fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const iconMap = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
            error: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
            info: <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />,
          };
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-[#171A1F]/95 backdrop-blur-md p-3.5 shadow-lg transition-all"
            >
              {iconMap[t.type]}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1F2328] dark:text-neutral-100 leading-snug">
                  {t.title}
                </p>
                {t.description && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Tutup notifikasi"
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus digunakan di dalam ToastProvider');
  return ctx;
}
