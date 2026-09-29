import React from 'react';
import { LogOut, ShieldAlert, ArrowLeft, X } from 'lucide-react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirmExit: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  isOpen,
  onCancel,
  onConfirmExit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-modal-title"
      >
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-8 ring-amber-500/5">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h3 id="exit-modal-title" className="text-lg font-bold text-slate-900 dark:text-white font-heading">
            Peringatan Keluar Aplikasi
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Anda menekan tombol kembali pada perangkat smartphone. Apakah Anda yakin ingin keluar dari aplikasi <strong>e-Piket Digital Sekolah</strong>?
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50">
            💡 Pastikan Anda telah menyimpan seluruh catatan buku piket atau laporan kejadian sebelum keluar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Tetap di Aplikasi
          </button>
          <button
            type="button"
            onClick={onConfirmExit}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/50 dark:text-slate-300 dark:hover:text-rose-400 font-semibold text-sm border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
};
