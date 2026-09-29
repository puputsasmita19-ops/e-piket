import React, { useState, useMemo } from 'react';
import { 
  AlertOctagon, 
  CheckCircle2, 
  ArrowRightLeft, 
  Clock, 
  MapPin, 
  Calendar, 
  Info, 
  Sparkles, 
  UserCheck, 
  X,
  AlertTriangle,
  Send,
  User as UserIcon,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { DutySchedule, User } from '../../types';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo } from '../../utils/formatters';
import { showSuccessToast, showErrorToast, showInfoToast } from '../../utils/toast';
import { sound, haptic } from '../../utils/feedback';

export const InstruksiPiketDadakanBanner: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const { 
    schedules, 
    users, 
    attendances, 
    acknowledgeTeacherSchedule, 
    createReplacement 
  } = useData();

  const [selectedScheduleForReplacement, setSelectedScheduleForReplacement] = useState<DutySchedule | null>(null);
  const [replacementUserId, setReplacementUserId] = useState<string>('');
  const [selectedReasonCategory, setSelectedReasonCategory] = useState<string>('Sedang mengajar di kelas');
  const [customReasonNotes, setCustomReasonNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // This banner is strictly for non-admin and non-kepsek roles (Guru & Tendik)
  if (currentRole === 'admin' || currentRole === 'kepsek' || !currentUser) {
    return null;
  }

  const today = getTodayDateString();

  // Find all schedules assigned to current user for today or upcoming where action is pending
  const pendingSchedules = useMemo(() => {
    return schedules.filter((s) => {
      // Must belong to this user
      const isMySchedule = s.userId === currentUser.id;
      if (!isMySchedule) return false;

      // Only today or future dates
      if (s.tanggal < today) return false;

      // If already finished/checkout or cancelled, no need for instruction
      if (s.status === 'sudah_checkout' || s.status === 'dibatalkan') return false;

      // Condition 1: Explicitly marked as Piket Dadakan and not yet checked out
      if (s.isDadakan && !s.acknowledgedByTeacher) return true;

      // Condition 2: Not yet acknowledged by teacher
      if (!s.acknowledgedByTeacher && (s.status === 'belum_piket' || s.status === 'belum_checkin')) return true;

      // Condition 3: Teacher already has another schedule today (already did duty or has multi-shift today)
      const userTodaySchedules = schedules.filter(
        (other) => other.tanggal === today && other.userId === currentUser.id
      );
      if (userTodaySchedules.length > 1 && !s.acknowledgedByTeacher) return true;

      return false;
    });
  }, [schedules, currentUser.id, today]);

  // Check if teacher already completed duty today
  const hasFinishedDutyToday = useMemo(() => {
    return attendances.some(
      (a) => a.userId === currentUser.id && a.tanggal === today && a.checkOutAt
    );
  }, [attendances, currentUser.id, today]);

  if (pendingSchedules.length === 0) {
    return null;
  }

  const handleTerimaTugas = async (sched: DutySchedule) => {
    try {
      haptic.medium();
      sound.playSuccess();
      await acknowledgeTeacherSchedule(sched.id);
      showSuccessToast(`Tugas piket di ${sched.postName || 'Pos Piket'} berhasil Anda terima dan dikonfirmasi!`);
    } catch (err) {
      showErrorToast('Gagal mengonfirmasi tugas piket. Silakan coba kembali.');
    }
  };

  const handleOpenModalPengganti = (sched: DutySchedule) => {
    haptic.light();
    setSelectedScheduleForReplacement(sched);
    // Auto select first available active colleague
    const eligibleColleagues = users.filter(
      (u) => u.id !== currentUser.id && u.statusAktif && u.role !== 'admin' && u.role !== 'kepsek'
    );
    if (eligibleColleagues.length > 0) {
      setReplacementUserId(eligibleColleagues[0].id);
    }
    setSelectedReasonCategory('Sedang mengajar di kelas');
    setCustomReasonNotes('');
  };

  const handleSubmitPengganti = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleForReplacement) return;

    if (!replacementUserId) {
      showErrorToast('Pilih rekan guru pengganti terlebih dahulu.');
      return;
    }

    const replacementUser = users.find((u) => u.id === replacementUserId);
    if (!replacementUser) {
      showErrorToast('Data guru pengganti tidak valid.');
      return;
    }

    const finalReason = customReasonNotes.trim()
      ? `${selectedReasonCategory} - ${customReasonNotes.trim()}`
      : selectedReasonCategory;

    setIsSubmitting(true);
    try {
      haptic.medium();
      sound.playSuccess();

      await createReplacement({
        scheduleId: selectedScheduleForReplacement.id,
        tanggal: selectedScheduleForReplacement.tanggal,
        postId: selectedScheduleForReplacement.postId,
        postName: selectedScheduleForReplacement.postName || 'Pos Piket',
        originalUserId: currentUser.id,
        originalUserName: currentUser.nama,
        replacementUserId: replacementUser.id,
        replacementUserName: replacementUser.nama,
        alasan: finalReason,
        assignedByUserId: currentUser.id,
        assignedByUserName: `${currentUser.nama} (Permintaan Guru)`
      });

      showSuccessToast(`Pengajuan pengganti ke ${replacementUser.nama} berhasil dikirimkan secara real-time.`);
      setSelectedScheduleForReplacement(null);
    } catch (err) {
      showErrorToast('Gagal mengajukan guru pengganti. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const eligibleColleagues = users.filter(
    (u) => u.id !== currentUser.id && u.statusAktif && u.role !== 'admin' && u.role !== 'kepsek'
  );

  return (
    <>
      <div className="space-y-3">
        {pendingSchedules.map((sched) => {
          const isToday = sched.tanggal === today;
          const isDadakan = Boolean(sched.isDadakan) || hasFinishedDutyToday;

          return (
            <div
              key={sched.id}
              className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 border shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
                isDadakan
                  ? 'bg-gradient-to-br from-rose-950/90 via-slate-900 to-amber-950/80 border-rose-500/50 shadow-rose-950/30'
                  : 'bg-gradient-to-br from-blue-950/90 via-slate-900 to-teal-950/80 border-teal-500/50 shadow-teal-950/30'
              }`}
            >
              {/* Background ambient pulse */}
              <div 
                className={`absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
                  isDadakan ? 'bg-rose-500 animate-pulse' : 'bg-teal-400'
                }`} 
              />

              <div className="relative z-10 space-y-4">
                {/* Header Tag */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm border ${
                    isDadakan
                      ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                      : 'bg-teal-500/20 text-teal-300 border-teal-400/40'
                  }">
                    <AlertOctagon className={`w-4 h-4 ${isDadakan ? 'animate-bounce text-rose-400' : 'text-teal-400'}`} />
                    <span>
                      {isDadakan ? '🚨 Instruksi Piket Dadakan Real-Time' : '📋 Instruksi Penugasan Piket Baru'}
                    </span>
                  </div>

                  <span className="text-[11px] font-bold text-slate-400 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                    Menunggu Konfirmasi Anda
                  </span>
                </div>

                {/* Main Info */}
                <div className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {sched.postName || 'Pos Piket Utama'}
                    </h3>
                    <span className="text-xs font-semibold text-emerald-400">
                      {sched.shiftName} ({sched.jamMulai} - {sched.jamSelesai} WIB)
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {isToday ? 'Hari Ini' : getDayNameIndo(sched.tanggal)}, {formatDateIndo(sched.tanggal)}
                    </span>
                  </p>

                  {/* Informative Note if teacher already completed duty earlier today */}
                  {hasFinishedDutyToday && isToday && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2 mt-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Pemberitahuan Sistem:</strong> Anda terdeteksi telah menyelesaikan sesi piket sebelumnya hari ini. Administrator menugaskan sesi piket tambahan/dadakan ini untuk Anda.
                      </span>
                    </div>
                  )}

                  {sched.notes && (
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs flex items-start gap-2 mt-1">
                      <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Instruksi Admin:</strong> {sched.notes}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions: Accept or Request Replacement */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleTerimaTugas(sched)}
                    className="w-full sm:w-auto flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 group"
                  >
                    <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>TERIMA TUGAS PIKET</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenModalPengganti(sched)}
                    className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 text-amber-300 hover:text-amber-200 border border-amber-500/30 font-bold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                    <span>Sibuk / Ajukan Pengganti</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: AJUKAN GURU PENGGANTI */}
      {selectedScheduleForReplacement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-7 shadow-2xl text-white space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Ajukan Guru Pengganti Piket</h3>
                  <p className="text-xs text-slate-400">Pemberitahuan real-time langsung ke rekan guru &amp; Admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScheduleForReplacement(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Schedule Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/70 space-y-1 text-xs">
              <p className="font-bold text-emerald-400">{selectedScheduleForReplacement.postName}</p>
              <p className="text-slate-300">
                Waktu: {selectedScheduleForReplacement.shiftName} ({selectedScheduleForReplacement.jamMulai} - {selectedScheduleForReplacement.jamSelesai} WIB)
              </p>
              <p className="text-slate-400">
                Tanggal: {formatDateIndo(selectedScheduleForReplacement.tanggal)}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitPengganti} className="space-y-4">
              {/* Select Replacement Colleague */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-teal-400" />
                  <span>Pilih Rekan Guru / Tendik Pengganti <span className="text-rose-400">*</span></span>
                </label>
                <select
                  value={replacementUserId}
                  onChange={(e) => setReplacementUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-hidden"
                  required
                >
                  <option value="" disabled>-- Pilih Rekan Pengganti --</option>
                  {eligibleColleagues.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama} ({u.role === 'tendik' ? 'Tendik' : 'Guru'}{u.nip ? ` - NIP: ${u.nip}` : ''})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Rekan yang dipilih akan otomatis menerima instruksi piket menggantikan Anda.
                </p>
              </div>

              {/* Select Category Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Alasan Berhalangan / Sibuk <span className="text-rose-400">*</span></span>
                </label>
                <select
                  value={selectedReasonCategory}
                  onChange={(e) => setSelectedReasonCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-hidden"
                  required
                >
                  <option value="Sedang mengajar di kelas">Sedang Mengajar di Kelas / Jam Efektif</option>
                  <option value="Tugas dinas luar / rapat resmi">Tugas Dinas Luar / Rapat Resmi</option>
                  <option value="Kondisi kesehatan kurang fit / izin medis">Kondisi Kesehatan Kurang Fit / Izin Medis</option>
                  <option value="Pendampingan siswa / lomba / ekstrakurikuler">Pendampingan Siswa / Lomba / Ekstrakurikuler</option>
                  <option value="Keperluan keluarga mendesak">Keperluan Keluarga Sangat Mendesak</option>
                  <option value="Lainnya">Alasan Lainnya</option>
                </select>
              </div>

              {/* Custom Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  value={customReasonNotes}
                  onChange={(e) => setCustomReasonNotes(e.target.value)}
                  placeholder="Contoh: Sedang mengajar di kelas 9B sampai jam 11.30 WIB..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedScheduleForReplacement(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-600/30 flex items-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan Pengganti'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
