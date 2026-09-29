import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Lock, Copy, X } from 'lucide-react';
import { antiFraudService } from '../../services/antiFraudService';

export const SecurityGuardToast: React.FC = () => {
  const [alertInfo, setAlertInfo] = useState<{ message: string; action: string } | null>(null);
  const [isIncognito, setIsIncognito] = useState<boolean>(false);

  useEffect(() => {
    // Check incognito state on mount
    antiFraudService.detectIncognito().then(setIsIncognito);

    // Subscribe to security alerts
    const unsubscribe = antiFraudService.onSecurityAlert((info) => {
      setAlertInfo({ message: info.message, action: info.action });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (alertInfo) {
      const timer = setTimeout(() => {
        setAlertInfo(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [alertInfo]);

  if (!alertInfo) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-3 right-3 sm:left-auto sm:right-6 z-[9999] max-w-sm p-4 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white shadow-2xl border border-rose-500/40 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 border border-rose-500/30">
          <Lock className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                Akses Dilindungi
              </span>
              {isIncognito && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Incognito
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAlertInfo(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-200 mt-1 leading-snug">
            {alertInfo.message}
          </p>

          <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Kerahasiaan data e-Piket sekolah terlindungi aktif.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
