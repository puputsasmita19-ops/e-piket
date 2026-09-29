import React, { useState } from 'react';
import { Users, MapPin, Clock, AlertTriangle, BookOpen, CheckCircle2, XCircle, Calendar, Plus, FileText, HardDrive, Zap, ArrowRight, TrendingUp, ShieldCheck, Phone, MessageSquare, ArrowRightLeft, BellRing, AlertCircle, ShieldAlert, UserCog, Battery, X, Check, Pencil, ChevronRight, List, LayoutGrid, Info, Trash2, History } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { AttendanceTrendChart } from '../analytics/AttendanceTrendChart';
import { AdminWeeklyAttendanceBarChart } from '../analytics/AdminWeeklyAttendanceBarChart';
import { notificationService } from '../../services/notificationService';
import { fcmService } from '../../services/fcmService';
import { sound } from '../../utils/feedback';
import { RunningText } from '../common/RunningText';
import { GlideCarousel } from '../common/GlideCarousel';
import { PiketInstanWidget } from '../common/PiketInstanWidget';
import { PetaLokasiMap } from '../common/PetaLokasiMap';
import { PiketReminderNotification } from '../common/PiketReminderNotification';
import { AdminPanicModeModal } from '../modals/AdminPanicModeModal';
import { DutySchedule, DutyPost } from '../../types';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

interface AdminDashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenAISummary?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ setActiveTab, onOpenAISummary }) => {
  const { school, users, posts, schedules, attendances, incidents, logbooks, auditLogs, adminManualCheckIn, createReplacement, updateSchedule, deleteSchedule } = useData();
  const [showPanicModal, setShowPanicModal] = useState<boolean>(false);

  // Mobile Monitoring List-View & Detail State
  const [selectedPosDetail, setSelectedPosDetail] = useState<DutyPost | null>(null);
  const [monitoringViewMode, setMonitoringViewMode] = useState<'auto' | 'list' | 'grid'>('auto');

  // Admin Manual Override State (Requirement 6)
  const [overrideSchedule, setOverrideSchedule] = useState<DutySchedule | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'sedang_bertugas' | 'terlambat' | 'sakit' | 'izin' | 'lowbat_tunggu'>('sedang_bertugas');
  const [overrideNotes, setOverrideNotes] = useState<string>('');
  const [overrideSubmitting, setOverrideSubmitting] = useState<boolean>(false);

  // Dashboard Quick Replacement State (Requirement 5)
  const [replacementSchedule, setReplacementSchedule] = useState<DutySchedule | null>(null);
  const [replacementUserId, setReplacementUserId] = useState<string>('');
  const [replacementReason, setReplacementReason] = useState<string>('');
  const [replacementSubmitting, setReplacementSubmitting] = useState<boolean>(false);

  // Edit Schedule State
  const [editingSchedule, setEditingSchedule] = useState<DutySchedule | null>(null);
  const [editFormUserId, setEditFormUserId] = useState<string>('');
  const [editFormJamMulai, setEditFormJamMulai] = useState<string>('');
  const [editFormJamSelesai, setEditFormJamSelesai] = useState<string>('');
  const [editFormNotes, setEditFormNotes] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);

  const today = getTodayDateString();
  const dayName = getDayNameIndo(today);
  const todaySchedules = schedules.filter((s) => s.tanggal === today);
  const activeSchedules = todaySchedules.filter((s) => s.status !== 'sudah_checkout' && s.status !== 'dibatalkan');
  const historySchedules = todaySchedules.filter((s) => s.status === 'sudah_checkout' || s.status === 'dibatalkan');

  const totalGuru = users.filter((u) => u.role === 'guru').length;
  const totalTendik = users.filter((u) => u.role === 'tendik').length;
  const petugasAktif = activeSchedules.filter((s) => s.status === 'sedang_bertugas').length;
  const belumCheckin = activeSchedules.filter((s) => s.status === 'belum_checkin' || s.status === 'belum_piket').length;
  const kejadianHariIni = incidents.filter((i) => i.tanggal === today);
  const urgentIncidents = incidents.filter((i) => i.pentingKepalaSekolah || i.prioritas === 'darurat' || i.prioritas === 'tinggi');

  const handleAdminOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideSchedule) return;
    setOverrideSubmitting(true);
    try {
      const res = await adminManualCheckIn(overrideSchedule.id, overrideStatus, overrideNotes);
      if (res && res.success) {
        showSuccessToast(res.message);
        setOverrideSchedule(null);
        setOverrideNotes('');
      } else {
        showErrorToast(res?.message || 'Gagal memproses presensi manual admin.');
      }
    } catch (e: any) {
      showErrorToast(e.message || 'Terjadi kesalahan saat memproses presensi.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleQuickReplacementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacementSchedule || !replacementUserId) return;
    setReplacementSubmitting(true);
    try {
      const repUser = users.find((u) => u.id === replacementUserId);
      if (repUser) {
        await createReplacement({
          scheduleId: replacementSchedule.id,
          tanggal: replacementSchedule.tanggal,
          postId: replacementSchedule.postId,
          postName: replacementSchedule.postName || 'Pos Piket',
          originalUserId: replacementSchedule.userId,
          originalUserName: replacementSchedule.userName || 'Petugas Asli',
          replacementUserId: repUser.id,
          replacementUserName: repUser.nama,
          alasan: replacementReason || 'Tugas dinas luar / Izin berhalangan',
          assignedByUserId: 'admin-1',
          assignedByUserName: 'Administrator'
        });
        showSuccessToast(`Guru pengganti (${repUser.nama}) berhasil ditugaskan!`, 'Berhasil Ditugaskan');
        setReplacementSchedule(null);
        setReplacementUserId('');
        setReplacementReason('');
      }
    } catch (e: any) {
      showErrorToast(e.message || 'Gagal memproses penggantian tugas.');
    } finally {
      setReplacementSubmitting(false);
    }
  };

  const handleEditScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setEditSubmitting(true);
    try {
      const uObj = users.find((u) => u.id === editFormUserId);
      await updateSchedule(editingSchedule.id, {
        userId: editFormUserId,
        userName: uObj ? uObj.nama : editingSchedule.userName,
        userRole: uObj ? uObj.role : editingSchedule.userRole,
        jamMulai: editFormJamMulai,
        jamSelesai: editFormJamSelesai,
        notes: editFormNotes,
        updatedAt: new Date().toISOString()
      });
      showSuccessToast('Jadwal piket berhasil diperbarui.', 'Berhasil Diperbarui');
      setEditingSchedule(null);
    } catch (e: any) {
      showErrorToast(e.message || 'Gagal memperbarui jadwal.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteScheduleItem = async (sch: DutySchedule) => {
    if (window.confirm(`Hapus jadwal piket untuk ${sch.userName} di ${sch.postName}?`)) {
      try {
        await deleteSchedule(sch.id);
        showSuccessToast('Jadwal piket berhasil dihapus.', 'Berhasil Dihapus');
      } catch (e: any) {
        showErrorToast(e.message || 'Gagal menghapus jadwal.');
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 p-4 sm:p-6 lg:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] sm:text-xs font-semibold mb-1.5 sm:mb-2 border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Panel Kendali Administrator e-Piket</span>
            </div>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
              Selamat Datang di e-Piket Digital
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 sm:mt-1 max-w-2xl">
              {school.nama} • {dayName}, {formatDateIndo(today)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <button
              type="button"
              onClick={() => setShowPanicModal(true)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-800 hover:to-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-600/40 border border-rose-400/40 transition-all active:scale-95 cursor-pointer animate-pulse"
              title="Buka panel Admin Panic Mode untuk pemulihan darurat dari snapshot backup"
            >
              <ShieldAlert className="w-4 h-4 text-amber-300" />
              <span>🚨 Panic Mode</span>
            </button>

            {onOpenAISummary && (
              <button
                onClick={onOpenAISummary}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-200" />
                <span>AI Ringkasan Harian</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('jadwal')}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Atur Jadwal Piket</span>
            </button>
          </div>
        </div>
      </div>

      {/* FIREBASE CLOUD MESSAGING (FCM) BACKGROUND PUSH NOTIFICATION BANNER */}
      <PiketReminderNotification />

      {/* TOP SECTION: REALTIME MONITORING STATUS POS PIKET HARI INI */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>📊 Monitoring Pos Piket Hari Ini</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                Live Status
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Klik pos untuk melihat detail kehadiran, foto presensi, dan kelola penugasan
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMonitoringViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  monitoringViewMode === 'list' || (monitoringViewMode === 'auto')
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
                title="Tampilan List Ramping (Ideal untuk Layar Ponsel)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="text-[11px]">List</span>
              </button>
              <button
                type="button"
                onClick={() => setMonitoringViewMode('grid')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  monitoringViewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
                title="Tampilan Grid Kartu"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="text-[11px]">Grid</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('jadwal')}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer pl-1"
            >
              <span>Jadwal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 1. STREAMLINED VERTICAL LIST VIEW (Shown on mobile by default or when 'list' chosen) */}
        {(monitoringViewMode === 'list' || monitoringViewMode === 'auto') && (
          <div className={`space-y-2.5 ${monitoringViewMode === 'auto' ? 'block md:hidden' : 'block'}`}>
            {posts.map((post) => {
              const postSchedules = activeSchedules.filter((s) => s.postId === post.id);
              const activeCount = postSchedules.filter((s) => s.status === 'sedang_bertugas').length;
              const waitingCount = postSchedules.filter((s) => s.status === 'belum_checkin' || s.status === 'belum_piket').length;
              const lateCount = postSchedules.filter((s) => s.status === 'terlambat').length;
              const isEmpty = postSchedules.length === 0;

              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPosDetail(post)}
                  className="group p-3 sm:p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 hover:border-emerald-500/50 shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3"
                  title="Klik untuk melihat detail petugas piket di pos ini"
                >
                  {/* Left: Icon, Name, and Location */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      activeCount > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                        : waitingCount > 0 || lateCount > 0
                        ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          activeCount > 0 ? 'bg-emerald-500 animate-pulse' : waitingCount > 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`} />
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          {post.namaPos}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {post.lokasi || 'Area Sekolah'} • <span className="font-semibold">{postSchedules.length} Petugas Aktif</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Badges & Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isEmpty ? (
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-lg">
                        Selesai / Kosong
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        {activeCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            {activeCount} Hadir
                          </span>
                        )}
                        {waitingCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/40">
                            {waitingCount} Menunggu
                          </span>
                        )}
                        {lateCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300/40">
                            {lateCount} Terlambat
                          </span>
                        )}
                      </div>
                    )}

                    <div className="w-6 h-6 rounded-full bg-slate-200/60 dark:bg-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. GRID CARDS VIEW (Desktop default or when 'grid' chosen) */}
        {(monitoringViewMode === 'grid' || monitoringViewMode === 'auto') && (
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 ${
            monitoringViewMode === 'auto' ? 'hidden md:grid' : 'grid'
          }`}>
            {posts.map((post) => {
              const postSchedules = activeSchedules.filter((s) => s.postId === post.id);
              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPosDetail(post)}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all hover:border-emerald-400/50 shadow-2xs cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                        {post.namaPos}
                      </h4>
                    </div>
                    <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate pl-2">{post.lokasi}</span>
                  </div>

                  {postSchedules.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">Tidak ada petugas aktif saat ini (sudah selesai).</p>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {postSchedules.map((sch) => {
                        const att = attendances.find((a) => a.scheduleId === sch.id);
                        return (
                          <div
                            key={sch.id}
                            className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between shadow-2xs"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{sch.userName}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {sch.jamMulai} - {sch.jamSelesai} • {sch.userRole === 'guru' ? 'Guru' : 'Tendik'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {sch.status === 'sedang_bertugas' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                  Hadir {att?.checkInAt ? formatTimeIndo(att.checkInAt).split(' ')[0] : ''}
                                </span>
                              )}
                              {sch.status === 'terlambat' && (
                                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  Terlambat
                                </span>
                              )}
                              {(sch.status === 'belum_checkin' || sch.status === 'belum_piket') && (
                                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  {sch.notes?.includes('LOW-BAT') ? '⏳ Status Tunggu (Low-Bat)' : 'Belum Hadir'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REAL-TIME INTERACTIVE LEAFLET GEOFENCE MAP (MOVED BELOW MONITORING REAL-TIME) */}
      <PetaLokasiMap />

      {/* JADWAL REALTIME PIKET HARI INI & FITUR PRESENSI ADMIN / PENGGANTIAN (REQUIREMENTS 4, 5, 6) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Jadwal Aktif Piket Hari Ini ({activeSchedules.length} Petugas)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monitoring jadwal guru piket aktif hari ini. Admin dapat mengedit, menghapus, memperbarui presensi, atau menugaskan pengganti.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('penggantian')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <UserCog className="w-4 h-4" />
            <span>Kelola Penggantian Tugas</span>
          </button>
        </div>

        {activeSchedules.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            Tidak ada jadwal piket aktif tersisa untuk hari ini ({dayName}, {formatDateIndo(today)}). Semua shift telah selesai.
          </div>
        ) : (
          <>
            {/* MOBILE STREAMLINED VERTICAL LIST-VIEW */}
            <div className="block md:hidden space-y-2.5">
              {activeSchedules.map((sch) => {
                const att = attendances.find((a) => a.scheduleId === sch.id);
                return (
                  <div
                    key={sch.id}
                    className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 shadow-2xs"
                  >
                    {/* Top Row: User & Role & Status Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {sch.userName}
                          </h4>
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {(sch.userRole || 'guru').toUpperCase()}
                          </span>
                          {sch.isReplacement && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Pengganti
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{sch.postName}</span>
                          <span>•</span>
                          <span>{sch.shiftName} ({sch.jamMulai}-{sch.jamSelesai})</span>
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {sch.status === 'sedang_bertugas' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Hadir {att?.checkInAt ? formatTimeIndo(att.checkInAt).split(' ')[0] : ''}
                          </span>
                        )}
                        {sch.status === 'terlambat' && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            Terlambat
                          </span>
                        )}
                        {(sch.status === 'belum_checkin' || sch.status === 'belum_piket') && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {sch.notes?.includes('LOW-BAT') ? '⏳ Low-Bat' : 'Belum Hadir'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notes if any */}
                    {sch.notes && (
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 italic bg-white/60 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                        {sch.notes}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideSchedule(sch);
                          setOverrideNotes(sch.notes || '');
                        }}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold text-[10.5px] border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Presensi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingSchedule(sch);
                          setEditFormUserId(sch.userId);
                          setEditFormJamMulai(sch.jamMulai || '07:00');
                          setEditFormJamSelesai(sch.jamSelesai || '14:00');
                          setEditFormNotes(sch.notes || '');
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        title="Edit Jadwal"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteScheduleItem(sch)}
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                        title="Hapus Jadwal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP FULL TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Petugas Piket</th>
                    <th className="py-2.5 px-3">Pos &amp; Shift</th>
                    <th className="py-2.5 px-3">Jam Tugas</th>
                    <th className="py-2.5 px-3">Status Live</th>
                    <th className="py-2.5 px-3 text-right">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeSchedules.map((sch) => {
                    const att = attendances.find((a) => a.scheduleId === sch.id);
                    return (
                      <tr key={sch.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{sch.userName}</span>
                            {sch.isReplacement && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Pengganti
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-500 dark:text-slate-400">{(sch.userRole || 'guru').toUpperCase()}</p>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {sch.postName}
                          <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">{sch.shiftName}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {sch.jamMulai} - {sch.jamSelesai} WIB
                        </td>
                        <td className="py-3 px-3">
                          {sch.status === 'sedang_bertugas' && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              Hadir ({att?.checkInAt ? formatTimeIndo(att.checkInAt).split(' ')[0] : 'Aktif'})
                            </span>
                          )}
                          {sch.status === 'terlambat' && (
                            <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              Terlambat
                            </span>
                          )}
                          {(sch.status === 'belum_checkin' || sch.status === 'belum_piket') && (
                            <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {sch.notes?.includes('LOW-BAT') ? '⏳ Status Tunggu (Low-Bat)' : 'Belum Hadir'}
                            </span>
                          )}
                          {sch.notes && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate max-w-xs mt-0.5">
                              {sch.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setOverrideSchedule(sch);
                                setOverrideNotes(sch.notes || '');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-extrabold text-[11px] border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center gap-1"
                              title="Presensi Manual Admin / Ubah Status"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Presensi</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingSchedule(sch);
                                setEditFormUserId(sch.userId);
                                setEditFormJamMulai(sch.jamMulai || '07:00');
                                setEditFormJamSelesai(sch.jamSelesai || '14:00');
                                setEditFormNotes(sch.notes || '');
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition cursor-pointer"
                              title="Ubah Jadwal"
                            >
                              Ubah
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteScheduleItem(sch)}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* HISTORY / RIWAYAT PIKET SELESAI HARI INI SECTION */}
      {historySchedules.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-colors space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span>📜 Histori &amp; Riwayat Piket Selesai Hari Ini ({historySchedules.length})</span>
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              Arsip Selesai
            </span>
          </div>

          <div className="space-y-2">
            {historySchedules.map((sch) => (
              <div key={sch.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 dark:text-white">{sch.userName}</span>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {sch.postName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      {sch.status === 'sudah_checkout' ? 'Selesai Checkout' : 'Dibatalkan / Sakit / Izin'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Shift: {sch.shiftName} ({sch.jamMulai} - {sch.jamSelesai} WIB) {sch.notes ? `• Catatan: ${sch.notes}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeleteScheduleItem(sch)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 transition"
                    title="Hapus riwayat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDIT SCHEDULE MODAL */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-600" />
                <span>Ubah Jadwal Piket</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Petugas Piket <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={editFormUserId}
                  onChange={(e) => setEditFormUserId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Petugas --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama} • {u.jabatan} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={editFormJamMulai}
                    onChange={(e) => setEditFormJamMulai(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={editFormJamSelesai}
                    onChange={(e) => setEditFormJamSelesai(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Catatan Jadwal</label>
                <textarea
                  rows={2}
                  value={editFormNotes}
                  onChange={(e) => setEditFormNotes(e.target.value)}
                  placeholder="Catatan tambahan jadwal..."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  {editSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Petugas Aktif</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{petugasAktif}</h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Sedang di pos tugas</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Belum Check-In</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{belumCheckin}</h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">Menunggu kehadiran</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-2xl text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kejadian Hari Ini</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kejadianHariIni.length}</h3>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">{urgentIncidents.length} atensi penting</p>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-2xl text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Guru & Tendik</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{users.length}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1">{totalGuru} Guru • {totalTendik} Tendik</p>
          </div>
          <div className="p-3 bg-teal-50 dark:bg-teal-950/60 rounded-2xl text-teal-600 dark:text-teal-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* RECHARTS WEEKLY ATTENDANCE RATE & PUNCTUALITY SPLIT BAR CHART */}
      <AdminWeeklyAttendanceBarChart
        schedules={schedules}
        attendances={attendances}
        posts={posts}
      />

      {/* RECHARTS ATTENDANCE & PUNCTUALITY TREND VISUALIZATION */}
      <AttendanceTrendChart
        schedules={schedules}
        attendances={attendances}
        posts={posts}
        incidents={incidents}
        logbooks={logbooks}
        users={users}
        title="Visualisasi Statistik & Tren Operasional Piket Sekolah"
        subtitle="Analisis grafik kehadiran guru bulanan, tren kejadian harian, ringkasan buku piket pos, dan komparasi ketertiban"
        variant="admin"
      />

      {/* System Activity Feed & Quick Report Access */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between transition-colors">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Aktivitas Sistem Real-Time</h2>
            <button
              onClick={() => setActiveTab('audit-log')}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-bold cursor-pointer"
            >
              Log Lengkap →
            </button>
          </div>

          <GlideCarousel itemClassName="w-[85%] sm:w-[280px]">
            {auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="text-xs border-l-2 border-emerald-500 pl-3 py-2.5 bg-slate-50/70 dark:bg-slate-800/60 rounded-r-2xl border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{log.userName}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">{formatTimeIndo(log.timestamp)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 text-[11px] leading-relaxed">{log.details}</p>
                </div>
                <span className="text-[9.5px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block mt-2">{log.module}</span>
              </div>
            ))}
          </GlideCarousel>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('laporan')}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
          >
            <FileText className="w-4 h-4" />
            <span>Buka Laporan &amp; Rekap Bulanan</span>
          </button>
        </div>
      </div>

      {/* ADMIN OVERRIDE PRESENSI & STATUS MODAL (REQUIREMENT 6) */}
      {overrideSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-600" />
                <span>Presensi / Status Override Admin</span>
              </h3>
              <button
                type="button"
                onClick={() => setOverrideSchedule(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
              <p className="font-extrabold text-slate-900 dark:text-white">{overrideSchedule.userName} ({(overrideSchedule.userRole || 'guru').toUpperCase()})</p>
              <p className="text-slate-600 dark:text-slate-300">Pos: {overrideSchedule.postName} • Shift: {overrideSchedule.shiftName}</p>
              <p className="text-slate-500 font-mono text-[11px]">Jadwal: {overrideSchedule.jamMulai} - {overrideSchedule.jamSelesai} WIB</p>
            </div>

            <form onSubmit={handleAdminOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Pilih Status Presensi
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="sedang_bertugas">🟢 Hadir (Presensi Manual Admin)</option>
                  <option value="lowbat_tunggu">⏳ Status Tunggu (HP Low-Bat / Kendala Smartphone)</option>
                  <option value="terlambat">⚠️ Terlambat Check-In</option>
                  <option value="sakit">😷 Sakit (Izin Berhalangan)</option>
                  <option value="izin">✉️ Izin (Dinas Luar / Izin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Catatan Admin <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="Contoh: Guru sudah bertugas di pos jam 06:30, HP low-battery. Presensi diverifikasi Admin."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={overrideSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  {overrideSubmitting ? 'Simpan...' : 'Simpan Status Presensi'}
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideSchedule(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK REPLACEMENT MODAL (REQUIREMENT 5) */}
      {replacementSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCog className="w-4 h-4 text-teal-600" />
                <span>Tugaskan Guru Pengganti Piket</span>
              </h3>
              <button
                type="button"
                onClick={() => setReplacementSchedule(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800 text-xs space-y-1 text-teal-950 dark:text-teal-200">
              <p><strong>Petugas Berhalangan:</strong> {replacementSchedule.userName}</p>
              <p><strong>Pos Piket:</strong> {replacementSchedule.postName} ({replacementSchedule.jamMulai} - {replacementSchedule.jamSelesai} WIB)</p>
            </div>

            <form onSubmit={handleQuickReplacementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Pilih Guru / Tendik Pengganti <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={replacementUserId}
                  onChange={(e) => setReplacementUserId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Guru/Tendik Pengganti --</option>
                  {users
                    .filter((u) => u.id !== replacementSchedule.userId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nama} • {u.jabatan} ({u.role.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Alasan Penggantian <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  placeholder="Contoh: Petugas asli berhalangan karena izin sakit / dinas luar"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={replacementSubmitting}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  {replacementSubmitting ? 'Memproses...' : 'Tugaskan Pengganti'}
                </button>
                <button
                  type="button"
                  onClick={() => setReplacementSchedule(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POS PIKET DETAIL MODAL (CLICK-TO-VIEW DETAIL FROM LIST VIEW) */}
      {selectedPosDetail && (() => {
        const postSchedules = todaySchedules.filter((s) => s.postId === selectedPosDetail.id);
        const activeCount = postSchedules.filter((s) => s.status === 'sedang_bertugas').length;
        const waitingCount = postSchedules.filter((s) => s.status === 'belum_checkin' || s.status === 'belum_piket').length;
        const lateCount = postSchedules.filter((s) => s.status === 'terlambat').length;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col p-5 sm:p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-5 sm:zoom-in-95">
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {selectedPosDetail.namaPos}
                      </h3>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {selectedPosDetail.lokasi || 'Area Sekolah'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Detail Kehadiran &amp; Petugas Hari Ini ({dayName}, {formatDateIndo(today)})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPosDetail(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Summary Pills */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Petugas</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">{postSchedules.length}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Aktif Hadir</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{activeCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">Menunggu</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400">{waitingCount + lateCount}</span>
                </div>
              </div>

              {/* Description if any */}
              {selectedPosDetail.deskripsi && (
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <p>{selectedPosDetail.deskripsi}</p>
                </div>
              )}

              {/* Officers List */}
              <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Daftar Petugas Piket di Pos Ini
                </h4>

                {postSchedules.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="font-semibold">Belum ada petugas terjadwal di pos ini hari ini.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPosDetail(null);
                        setActiveTab('jadwal');
                      }}
                      className="mt-2 text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
                    >
                      + Tambah Jadwal Petugas Sekarang
                    </button>
                  </div>
                ) : (
                  postSchedules.map((sch) => {
                    const att = attendances.find((a) => a.scheduleId === sch.id);

                    return (
                      <div
                        key={sch.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                                {sch.userName}
                              </span>
                              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {(sch.userRole || 'guru').toUpperCase()}
                              </span>
                              {sch.isReplacement && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Pengganti
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{sch.shiftName} ({sch.jamMulai} - {sch.jamSelesai} WIB)</span>
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            {sch.status === 'sedang_bertugas' && (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                Hadir {att?.checkInAt ? formatTimeIndo(att.checkInAt).split(' ')[0] : ''}
                              </span>
                            )}
                            {sch.status === 'terlambat' && (
                              <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                Terlambat
                              </span>
                            )}
                            {(sch.status === 'belum_checkin' || sch.status === 'belum_piket') && (
                              <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {sch.notes?.includes('LOW-BAT') ? '⏳ Status Tunggu (Low-Bat)' : 'Belum Hadir'}
                              </span>
                            )}
                            {sch.status === 'sudah_checkout' && (
                              <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                                Selesai
                              </span>
                            )}
                            {sch.status === 'dibatalkan' && (
                              <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                {sch.notes?.includes('SAKIT') ? '😷 Sakit' : sch.notes?.includes('IZIN') ? '✉️ Izin' : 'Dibatalkan'}
                              </span>
                            )}
                          </div>
                        </div>

                        {sch.notes && (
                          <p className="text-[10.5px] text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800">
                            {sch.notes}
                          </p>
                        )}

                        {/* Direct action buttons for this officer */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPosDetail(null);
                              setOverrideSchedule(sch);
                              setOverrideNotes(sch.notes || '');
                            }}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Presensi Admin</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPosDetail(null);
                              setReplacementSchedule(sch);
                              setReplacementUserId('');
                              setReplacementReason('');
                            }}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:hover:bg-teal-900/80 dark:text-teal-300 font-bold text-xs border border-teal-200 dark:border-teal-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            <span>Ganti Petugas</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedPosDetail(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADMIN PANIC MODE & DISASTER RECOVERY MODAL */}
      <AdminPanicModeModal
        isOpen={showPanicModal}
        onClose={() => setShowPanicModal(false)}
      />

    </div>
  );
};
