import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (msg: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

let globalToastHandler: ((msg: Omit<ToastMessage, "id">) => void) | null = null;

export const toast = {
  success: (message: string, title?: string) => {
    globalToastHandler?.({ type: "success", message, title });
  },
  error: (message: string, title?: string) => {
    globalToastHandler?.({ type: "error", message, title });
  },
  warning: (message: string, title?: string) => {
    globalToastHandler?.({ type: "warning", message, title });
  },
  info: (message: string, title?: string) => {
    globalToastHandler?.({ type: "info", message, title });
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, message, duration = 3500 }: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  globalToastHandler = addToast;

  const value = {
    toasts,
    addToast,
    removeToast,
    toast,
  };

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
        };
      case "error":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100",
          icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
        };
      default:
        return {
          bg: "bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100",
          icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />,
        };
    }
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2 sm:px-0">
        {toasts.map((t) => {
          const { bg, icon } = getToastStyles(t.type);
          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200 ease-out translate-y-0 opacity-100 ${bg}`}
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                {t.title && <h4 className="text-xs font-bold leading-tight mb-0.5">{t.title}</h4>}
                <p className="text-xs leading-normal font-medium break-words">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="opacity-60 hover:opacity-100 p-0.5 rounded transition-opacity"
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

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { toast };
  }
  return ctx;
}
