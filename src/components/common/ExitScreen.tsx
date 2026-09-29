import React from 'react';
import { LogOut, RotateCcw, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ExitScreenProps {
  onReopen: () => void;
}

export const ExitScreen: React.FC<ExitScreenProps> = ({ onReopen }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950 text-white select-none animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight">
            Aplikasi Telah Ditutup
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Anda telah berhasil keluar dari sistem <strong>e-Piket Digital Sekolah</strong>. Data dan sesi kerja Anda tersimpan dengan aman.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 text-left space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Informasi Keamanan Sesi</span>
          </div>
          <p className="text-slate-400">
            Untuk privasi dan keamanan data sekolah, Anda dapat menutup tab peramban ini atau menekan tombol di bawah untuk kembali ke halaman login.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button
            type="button"
            onClick={onReopen}
            className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Buka / Masuk Kembali ke Aplikasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
