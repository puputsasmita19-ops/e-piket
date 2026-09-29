import React, { useState, useRef } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  RotateCcw, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  X, 
  Calendar, 
  Clock, 
  Users, 
  BookOpen, 
  FileText, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  Eye, 
  Database,
  Building2,
  HardDrive
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { SystemSnapshot, RestoreOptions, PanicModeRestoreResult } from '../../types';
import { sound, triggerConfetti } from '../../utils/feedback';

interface AdminPanicModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanicModeModal: React.FC<AdminPanicModeModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    snapshots,
    isRestoringSnapshot,
    isCreatingSnapshot,
    createEmergencySnapshot,
    restoreFromSnapshot,
    deleteSnapshot,
    refreshSnapshots,
    exportSnapshotToFile,
    importSnapshotFromFile,
    users,
    schedules,
    logbooks,
    incidents,
    posts,
    shifts,
    school
  } = useData();

  const [activeTab, setActiveTab] = useState<'all' | 'daily_auto' | 'manual_admin' | 'pre_restore_safety'>('all');
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  
  // Create Manual Snapshot Form State
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Restore Confirmation State
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<SystemSnapshot | null>(null);
  const [confirmationInput, setConfirmationInput] = useState<string>('');
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    restoreUsers: true,
    restorePosts: true,
    restoreShifts: true,
    restoreSchedules: true,
    restoreAttendances: true,
    restoreLogbooks: true,
    restoreIncidents: true,
    restoreHandovers: true,
    restoreSchoolAndSettings: true,
    createPreRestoreSafetySnapshot: true,
  });
  const [restoreResult, setRestoreResult] = useState<PanicModeRestoreResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const filteredSnapshots = snapshots.filter((snap) => {
    if (activeTab === 'all') return true;
    return snap.type === activeTab;
  });

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await createEmergencySnapshot(manualTitle || undefined, manualNotes || undefined);
      setShowCreateForm(false);
      setManualTitle('');
      setManualNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat snapshot cadangan.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    try {
      const snap = await importSnapshotFromFile(file);
      setSelectedSnapshotForRestore(snap);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengimpor berkas snapshot.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteRestore = async () => {
    if (!selectedSnapshotForRestore) return;
    if (confirmationInput.trim().toUpperCase() !== 'PULIHKAN') {
      setErrorMessage("Silakan ketik kata 'PULIHKAN' untuk konfirmasi keamanan.");
      return;
    }

    setErrorMessage(null);
    setRestoreResult(null);

    const result = await restoreFromSnapshot(selectedSnapshotForRestore, restoreOptions);
    setRestoreResult(result);
    if (!result.success) {
      setErrorMessage(result.message);
    }
  };

  const formatDateTimeIndo = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* ========================================================= */}
        {/* HEADER MODAL: EMERGENCY PANIC MODE BRANDING               */}
        {/* ========================================================= */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md text-amber-300 ring-2 ring-white/20 shadow-inner shrink-0">
              <ShieldAlert className="w-7 h-7 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>🚨 Admin Panic Mode</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-950/60 text-amber-300 border border-amber-400/40 text-[10px] font-mono font-extrabold uppercase">
                  Disaster Recovery
                </span>
              </div>
              <p className="text-xs text-rose-100/90 mt-0.5 max-w-xl">
                Pemulihan Bencana &amp; Snapshot Cadangan Otomatis. Pulihkan seluruh data jika terjadi penghapusan tidak disengaja di Cloud Firebase.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRestoringSnapshot}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* CURRENT ACTIVE SYSTEM METRICS SUMMARY BAR                 */}
        {/* ========================================================= */}
        <div className="px-6 py-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Keadaan Database Saat Ini:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {users.length} Pengguna • {schedules.length} Jadwal • {logbooks.length} Buku Piket • {incidents.length} Kejadian
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Buat Snapshot Sekarang</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Impor Berkas (.json)</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => refreshSnapshots()}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Segarkan Daftar Snapshot"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error message toast banner if any */}
        {errorMessage && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-300 dark:bg-rose-950/80 dark:border-rose-800 rounded-2xl text-xs text-rose-900 dark:text-rose-200 flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL BODY CONTAINER (SCROLLABLE)                         */}
        {/* ========================================================= */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* CREATE MANUAL SNAPSHOT FORM CARD */}
          {showCreateForm && (
            <div className="p-5 bg-rose-50/70 dark:bg-rose-950/30 rounded-3xl border border-rose-200 dark:border-rose-900/60 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-rose-100 dark:border-rose-900/50">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h3 className="text-xs font-bold text-rose-950 dark:text-rose-200">
                    Buat Titik Pemulihan Cadangan Manual Baru
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSnapshot} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Judul / Label Snapshot
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder={`Contoh: Cadangan Sebelum Pembaruan Semester (${new Date().toLocaleDateString('id-ID')})`}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Catatan Opsional
                  </label>
                  <input
                    type="text"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="Contoh: Seluruh data 40 pengguna, pos, shift, dan 50 entri jadwal valid"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSnapshot}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-md shadow-rose-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Plus className={`w-3.5 h-3.5 ${isCreatingSnapshot ? 'animate-spin' : ''}`} />
                    <span>{isCreatingSnapshot ? 'Menyimpan Snapshot...' : 'Simpan Snapshot Cadangan'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* RESTORE CONFIRMATION PANEL (IF SNAPSHOT SELECTED)         */}
          {/* ========================================================= */}
          {selectedSnapshotForRestore && (
            <div className="p-5 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-amber-950/30 rounded-3xl border-2 border-rose-400 dark:border-rose-800 space-y-4 shadow-lg animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-rose-200 dark:border-rose-900/60">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/30 shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-rose-950 dark:text-rose-100 flex items-center gap-2">
                      <span>Konfirmasi Pemulihan Panic Mode</span>
                    </h3>
                    <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                      Memulihkan titik cadangan: <strong className="text-slate-900 dark:text-white font-bold">{selectedSnapshotForRestore.title}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSnapshotForRestore(null);
                    setRestoreResult(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Data comparison grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-rose-100 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pengguna / Guru</span>
                  <div className="text-sm font-black text-rose-700 dark:text-rose-400">
                    {selectedSnapshotForRestore.summary.totalUsers} Akun
                  </div>
                  <span className="text-[10px] text-slate-400">Saat ini: {users.length}</span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-rose-100 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Jadwal Piket</span>
                  <div className="text-sm font-black text-rose-700 dark:text-rose-400">
                    {selectedSnapshotForRestore.summary.totalSchedules} Entri
                  </div>
                  <span className="text-[10px] text-slate-400">Saat ini: {schedules.length}</span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-rose-100 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Buku Piket</span>
                  <div className="text-sm font-black text-rose-700 dark:text-rose-400">
                    {selectedSnapshotForRestore.summary.totalLogbooks} Catatan
                  </div>
                  <span className="text-[10px] text-slate-400">Saat ini: {logbooks.length}</span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-rose-100 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Laporan Kejadian</span>
                  <div className="text-sm font-black text-rose-700 dark:text-rose-400">
                    {selectedSnapshotForRestore.summary.totalIncidents} Insiden
                  </div>
                  <span className="text-[10px] text-slate-400">Saat ini: {incidents.length}</span>
                </div>
              </div>

              {/* Safety Option Checkbox */}
              <div className="p-3.5 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Buat Titik Pengaman Otomatis Sebelum Pemulihan (Direkomendasikan)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sistem akan menyimpan kondisi detik ini sebelum dipulihkan, sehingga Anda selalu bisa membatalkannya.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={restoreOptions.createPreRestoreSafetySnapshot}
                  onChange={(e) => setRestoreOptions({ ...restoreOptions, createPreRestoreSafetySnapshot: e.target.checked })}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              {/* Security Verification Word */}
              <div className="space-y-2 text-xs">
                <label className="block font-bold text-rose-950 dark:text-rose-200">
                  Ketik kata <span className="font-mono text-rose-600 dark:text-rose-400 font-extrabold bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded">PULIHKAN</span> di bawah ini untuk mengonfirmasi:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="Ketik PULIHKAN"
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border-2 border-rose-300 dark:border-rose-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold uppercase tracking-wider focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSnapshotForRestore(null);
                    setRestoreResult(null);
                  }}
                  disabled={isRestoringSnapshot}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={isRestoringSnapshot || confirmationInput.trim().toUpperCase() !== 'PULIHKAN'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-black rounded-xl text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <RotateCcw className={`w-4 h-4 ${isRestoringSnapshot ? 'animate-spin' : ''}`} />
                  <span>{isRestoringSnapshot ? 'Memulihkan Data ke Firestore...' : 'Eksekusi Pemulihan Panic Mode'}</span>
                </button>
              </div>

              {/* Restore Result Success Message */}
              {restoreResult && restoreResult.success && (
                <div className="p-4 bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-800 rounded-2xl text-xs text-emerald-950 dark:text-emerald-100 space-y-1 animate-in fade-in">
                  <div className="font-extrabold flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>Pemulihan Darurat Berhasil Diterapkan!</span>
                  </div>
                  <p>{restoreResult.message}</p>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono mt-1">
                    Dipulihkan: {restoreResult.restoredEntities.users} Guru, {restoreResult.restoredEntities.schedules} Jadwal, {restoreResult.restoredEntities.logbooks} Logbook, {restoreResult.restoredEntities.incidents} Kejadian.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB FILTER BUTTONS                                        */}
          {/* ========================================================= */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Semua Snapshot ({snapshots.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('daily_auto')}
              className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'daily_auto'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Harian Otomatis ({snapshots.filter(s => s.type === 'daily_auto').length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual_admin')}
              className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'manual_admin'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Manual Admin ({snapshots.filter(s => s.type === 'manual_admin').length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pre_restore_safety')}
              className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'pre_restore_safety'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Titik Pengaman ({snapshots.filter(s => s.type === 'pre_restore_safety').length})
            </button>
          </div>

          {/* ========================================================= */}
          {/* SNAPSHOTS LIST                                            */}
          {/* ========================================================= */}
          {filteredSnapshots.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <Database className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum Ada Snapshot Tersedia</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Sistem otomatis membuat snapshot harian. Anda juga dapat membuat snapshot cadangan manual kapan saja dengan tombol di atas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                + Buat Snapshot Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSnapshots.map((snap) => {
                const isExpanded = expandedSnapshotId === snap.id;
                const isDaily = snap.type === 'daily_auto';
                const isSafety = snap.type === 'pre_restore_safety';

                return (
                  <div
                    key={snap.id}
                    className="p-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs hover:border-slate-300 transition space-y-3"
                  >
                    {/* Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase ${
                            isDaily 
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 border border-teal-300 dark:border-teal-800'
                              : isSafety
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800'
                          }`}>
                            {isDaily ? 'Otomatis Harian' : isSafety ? 'Pra-Pemulihan Aman' : 'Manual Admin'}
                          </span>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {snap.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDateTimeIndo(snap.createdAt)}</span>
                          </span>
                          <span>•</span>
                          <span>Oleh: <strong>{snap.createdBy || 'Sistem'}</strong></span>
                        </div>
                      </div>

                      {/* Action Buttons on Snapshot Card */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSnapshotForRestore(snap);
                            setConfirmationInput('');
                            setRestoreResult(null);
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                          title="Pulihkan seluruh data dari snapshot ini"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Pulihkan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => exportSnapshotToFile(snap)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-slate-700/60 rounded-xl transition cursor-pointer"
                          title="Unduh berkas JSON cadangan"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setExpandedSnapshotId(isExpanded ? null : snap.id)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 dark:bg-slate-700/60 rounded-xl transition cursor-pointer"
                          title="Lihat Rincian Data"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Hapus snapshot '${snap.title}'? Tindakan ini tidak dapat dibatalkan.`)) {
                              deleteSnapshot(snap.id);
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition cursor-pointer"
                          title="Hapus Snapshot Ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metrics Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>{snap.summary.totalUsers} Pengguna</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        <span>{snap.summary.totalSchedules} Jadwal</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>{snap.summary.totalLogbooks} Buku Piket</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>{snap.summary.totalIncidents} Kejadian</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                        <span>{snap.summary.totalPosts || 0} Pos Piket</span>
                      </span>
                    </div>

                    {/* EXPANDABLE INSPECTOR PANEL */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs space-y-3 animate-in fade-in">
                        {snap.notes && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300">
                            <strong>Catatan:</strong> {snap.notes}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1">
                            <span className="font-bold uppercase text-slate-400">Daftar Pengguna ({snap.data.users?.length || 0})</span>
                            <p className="text-slate-700 dark:text-slate-300 line-clamp-3">
                              {snap.data.users?.map(u => `${u.nama} (${u.role})`).join(', ') || 'Tidak ada'}
                            </p>
                          </div>

                          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl space-y-1">
                            <span className="font-bold uppercase text-slate-400">Profil Sekolah &amp; Identitas</span>
                            <p className="text-slate-700 dark:text-slate-300">
                              {snap.data.school?.nama} • NPSN: {snap.data.school?.npsn} • Kepsek: {snap.data.school?.kepalaSekolah}
                            </p>
                          </div>
                        </div>

                        <div className="font-mono text-[10px] text-slate-400">
                          ID: {snap.id} • Checksum: {snap.checksum || '-'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* FOOTER BAR                                                */}
        {/* ========================================================= */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Multi-Layer Disaster Recovery: Cloud Firestore + Local IndexedDB Storage</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
