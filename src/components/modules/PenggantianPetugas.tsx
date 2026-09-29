import React, { useState } from 'react';
import { UserCog, Plus, Calendar, Clock, UserCheck, ArrowRight, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { DutyReplacement } from '../../types';
import { formatDateIndo } from '../../utils/formatters';
import { RunningText } from '../common/RunningText';
import { showSuccessToast } from '../../utils/toast';

export const PenggantianPetugas: React.FC = () => {
  const { currentUser } = useAuth();
  const { schedules, users, replacements, createReplacement } = useData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [replacementUserId, setReplacementUserId] = useState('');
  const [alasan, setAlasan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Available schedules that can be substituted
  const eligibleSchedules = schedules.filter((s) => s.status !== 'sudah_checkout');

  const handleCreateReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedScheduleId || !replacementUserId) return;
    setSubmitting(true);

    try {
      const schedule = schedules.find((s) => s.id === selectedScheduleId);
      const repUser = users.find((u) => u.id === replacementUserId);

      if (schedule && repUser) {
        await createReplacement({
          scheduleId: schedule.id,
          tanggal: schedule.tanggal,
          postId: schedule.postId,
          postName: schedule.postName || 'Pos Piket',
          originalUserId: schedule.userId,
          originalUserName: schedule.userName || 'Petugas Asli',
          replacementUserId: repUser.id,
          replacementUserName: repUser.nama,
          alasan: alasan || 'Tugas dinas luar / Izin berhalangan hadir',
          assignedByUserId: currentUser.id,
          assignedByUserName: currentUser.nama
        });

        // Reset
        setSelectedScheduleId('');
        setReplacementUserId('');
        setAlasan('');
        setShowCreateModal(false);
        showSuccessToast('Penggantian petugas piket berhasil disimpan!');
      }
    } catch (err) {
      console.error('Replacement error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Penggantian Petugas Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Penugasan guru/tendik pengganti jika petugas berhalangan hadir tanpa menghapus rekam jejak jadwal asli.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ TUGASKAN PENGGANTI</span>
        </button>
      </div>

      {/* REPLACEMENTS LIST */}
      <div className="space-y-4">
        {replacements.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
            <UserCog className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Belum Ada Riwayat Penggantian</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Seluruh petugas saat ini bertugas sesuai jadwal reguler.
            </p>
          </div>
        ) : (
          replacements.map((rep) => (
            <div
              key={rep.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-teal-200/80 dark:border-teal-900/60 shadow-xs p-5 sm:p-6 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    <UserCog className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{rep.postName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tanggal Tugas: {formatDateIndo(rep.tanggal)}</p>
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Ditetapkan pada: {formatDateIndo(rep.createdAt)}
                </span>
              </div>

              {/* Transition visualization */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase block">Petugas Asli (Berhalangan)</span>
                  <div className="line-through text-slate-700 dark:text-slate-300 font-bold">
                    <RunningText text={rep.originalUserName} maxLength={18} />
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block">Petugas Pengganti</span>
                  <RunningText text={rep.replacementUserName} maxLength={18} className="text-teal-900 dark:text-teal-200 font-extrabold" />
                </div>
              </div>

              <div className="text-xs space-y-1">
                <p className="text-slate-700 dark:text-slate-300"><strong>Alasan Penggantian:</strong> {rep.alasan}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Ditugaskan oleh Administrator: {rep.assignedByUserName}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE REPLACEMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">+ Form Penggantian Petugas Piket</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReplacement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Jadwal Petugas yang Berhalangan <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Jadwal Petugas --</option>
                  {eligibleSchedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDateIndo(s.tanggal)} • {s.postName} • {s.userName} ({s.jamMulai} - {s.jamSelesai})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Petugas Pengganti <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={replacementUserId}
                  onChange={(e) => setReplacementUserId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Guru/Tendik Pengganti --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama} • {u.jabatan} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Alasan Berhalangan / Penggantian <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Contoh: Mengikuti Bimtek Kurikulum Dinas Pendidikan di luar kota"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200">
                <strong>Otomatisasi Sistem:</strong> Notifikasi tugas baru akan otomatis dikirim ke ponsel Guru Pengganti, dan menu Piket Saya langsung diperbarui.
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  {submitting ? 'Memproses...' : 'Tugaskan Pengganti'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
