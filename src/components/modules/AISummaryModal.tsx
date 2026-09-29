import React, { useState, useEffect, useRef } from 'react';
import { Zap, CheckCircle2, AlertTriangle, FileText, Copy, Check, RefreshCw, Printer, X } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { generateExecutivePicketSummary, SummaryResult } from '../../services/aiService';
import { getTodayDateString } from '../../services/seedData';
import { formatDateIndo } from '../../utils/formatters';

interface AISummaryModalProps {
  onClose: () => void;
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({ onClose }) => {
  const { school, schedules, incidents, logbooks } = useData();
  const today = getTodayDateString();
  const modalContentRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const todaySchedules = schedules.filter((s) => s.tanggal === today);
      const todayIncidents = incidents.filter((i) => i.tanggal === today);
      const todayLogbooks = logbooks.filter((l) => l.tanggal === today);

      const result = await generateExecutivePicketSummary(
        school,
        today,
        todaySchedules,
        todayIncidents,
        todayLogbooks
      );
      setSummary(result);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleCopyText = () => {
    if (!summary) return;
    const textToCopy = `*RINGKASAN EKSEKUTIF PIKET - ${school.nama}*\nTanggal: ${formatDateIndo(today)}\n\n${summary.headline}\n\n📌 *Kehadiran Petugas:*\n${summary.attendanceSummary}\n\n🚨 *Analisis Kejadian & Ketertiban:*\n${summary.incidentAnalysis}\n\n📋 *Arahan Tindak Lanjut:*\n${summary.actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n${summary.praiseNotes ? `🌟 *Apresiasi:* ${summary.praiseNotes}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      onClick={(e) => {
        if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
    >
      <div 
        ref={modalContentRef}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 border border-slate-200 dark:border-slate-800 transition-colors"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl shadow-md shadow-emerald-600/30">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Ringkasan Eksekutif Piket Harian</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Disiapkan untuk Kepala Sekolah & Pimpinan • {formatDateIndo(today)}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Menganalisis data kehadiran pos, buku piket, dan laporan kejadian...</p>
          </div>
        ) : summary ? (
          <div className="space-y-4 text-xs">
            
            {/* Headline Box */}
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-1">
                Headline Situasi Hari Ini
              </span>
              <p className="text-sm font-bold text-amber-950 dark:text-amber-100 leading-snug">
                {summary.headline}
              </p>
            </div>

            {/* Attendance & Disciplines */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Analisis Kehadiran & Pos Piket:</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed pl-6">
                {summary.attendanceSummary}
              </p>
            </div>

            {/* Incident Analysis */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Analisis Ketertiban & Kejadian:</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed pl-6">
                {summary.incidentAnalysis}
              </p>
            </div>

            {/* Action Items */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Rekomendasi Tindak Lanjut:</span>
              </div>
              <ul className="space-y-1.5 pl-6 list-disc text-slate-600 dark:text-slate-300">
                {summary.actionItems.map((act, idx) => (
                  <li key={idx} className="leading-relaxed">{act}</li>
                ))}
              </ul>
            </div>

            {/* Praise Notes */}
            {summary.praiseNotes && (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                <p className="font-semibold">{summary.praiseNotes}</p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleCopyText}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Ringkasan untuk WhatsApp'}</span>
              </button>

              <button
                onClick={fetchSummary}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                title="Refresh Analisis"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Ulangi</span>
              </button>
            </div>

          </div>
        ) : null}

      </div>
    </div>
  );
};
