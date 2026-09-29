import React, { useState, useEffect } from 'react';
import { Compass, CheckCircle2, ArrowRight, ArrowLeft, X, Sparkles, LayoutDashboard, BookOpen, UserCheck, ShieldCheck, Smartphone } from 'lucide-react';
import { haptic, sound } from '../../utils/feedback';

interface GuidedTourProps {
  onComplete?: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({ onComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('epiket_guided_tour_completed');
      if (completed !== 'true') {
        // Show guided tour automatically for new users after short delay
        const timer = setTimeout(() => setIsOpen(true), 800);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const tourSteps = [
    {
      icon: <LayoutDashboard className="w-8 h-8 text-emerald-500" />,
      title: 'Login & Presensi Piket Instan',
      subtitle: 'Ringkasan Tugas & Performa Harian',
      description: 'Di halaman Login, Anda dapat melihat jadwal piket hari ini, grafik statistik jam kerja, serta melakukan Presensi Piket Instan satu sentuhan saat berada di lokasi sekolah.',
      badge: 'Langkah 1 dari 3'
    },
    {
      icon: <BookOpen className="w-8 h-8 text-teal-500" />,
      title: 'Buku Piket Digital & Jurnal',
      subtitle: 'Catatan Kedinasan & Kejadian',
      description: 'Gunakan menu Buku Piket & Kejadian untuk mencatat siswa izin keluar, tamu kedinasan, berita acara piket, serta serah terima tugas antar shift.',
      badge: 'Langkah 2 dari 3'
    },
    {
      icon: <Smartphone className="w-8 h-8 text-amber-500" />,
      title: 'Profil, Biometrik & Getaran (Haptic)',
      subtitle: 'Aksesibilitas & Pengaturan Akun',
      description: 'Di menu Profil Pengguna, Anda dapat mengaktifkan sensor Biometrik (Sidik Jari/Touch ID), mengatur tingkat kekuatan getaran single pulse, serta mengganti tema gelap/terang.',
      badge: 'Langkah 3 dari 3'
    }
  ];

  const handleNext = () => {
    haptic.light();
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    haptic.light();
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    haptic.success();
    sound.playSuccess();
    if (typeof window !== 'undefined') {
      localStorage.setItem('epiket_guided_tour_completed', 'true');
    }
    setIsOpen(false);
    if (onComplete) onComplete();
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      
      {/* Floating Spotlight Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-6 border border-slate-200 dark:border-slate-800 relative overflow-hidden animate-in zoom-in-95">
        
        {/* Top Header Badge & Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              <Compass className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Panduan Aplikasi • {step.badge}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            title="Tutup Panduan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Icon & Hero Content */}
        <div className="space-y-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
              {step.icon}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                {step.title}
              </h3>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {step.subtitle}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
            {step.description}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 py-1">
          {tourSteps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? 'w-8 bg-emerald-600 dark:bg-emerald-400'
                  : 'w-2 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              currentStep === 0
                ? 'opacity-30 cursor-not-allowed text-slate-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFinish}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Lewati
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <span>{currentStep === tourSteps.length - 1 ? 'Saya Mengerti ✓' : 'Lanjut'}</span>
              {currentStep < tourSteps.length - 1 && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
