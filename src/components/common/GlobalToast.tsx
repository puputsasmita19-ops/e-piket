import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastItem } from '../../utils/toast';

export const GlobalToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastItem>;
      const newToast = customEvent.detail;
      if (!newToast) return;

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep max 4 toasts at once

      const duration = newToast.duration || 3200;
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== newToast.id));
      }, duration);
    };

    window.addEventListener('app_global_toast', handleToastEvent);
    return () => window.removeEventListener('app_global_toast', handleToastEvent);
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 sm:top-18 left-3 right-3 sm:left-auto sm:right-6 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl p-3.5 sm:p-4 shadow-2xl border backdrop-blur-md transition-all animate-in slide-in-from-top-3 fade-in duration-200 flex items-start gap-3 relative overflow-hidden ${
              isSuccess
                ? 'bg-emerald-950/95 border-emerald-500/50 text-white'
                : isError
                ? 'bg-rose-950/95 border-rose-500/50 text-white'
                : 'bg-slate-900/95 border-slate-700/70 text-white'
            }`}
          >
            {/* Icon */}
            <div
              className={`p-2 rounded-xl shrink-0 mt-0.5 shadow-sm ${
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isError
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="w-5 h-5 animate-in zoom-in-50 duration-200" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5 animate-pulse" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>

            {/* Message Body */}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>{toast.title}</span>
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-relaxed font-medium">
                {toast.message}
              </p>
            </div>

            {/* Manual Dismiss Button */}
            <button
              onClick={() => handleDismiss(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 mt-0.5"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Subtle Progress Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-1 origin-left ${
                isSuccess
                  ? 'bg-emerald-400/60'
                  : isError
                  ? 'bg-rose-400/60'
                  : 'bg-blue-400/60'
              }`}
              style={{
                animation: `shrinkWidth ${toast.duration || 3200}ms linear forwards`
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
