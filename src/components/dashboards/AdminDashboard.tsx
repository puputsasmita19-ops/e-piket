import React, { useState } from 'react';
import { Users, MapPin, Clock, AlertTriangle, BookOpen, CheckCircle2, XCircle, Calendar, Plus, FileText, HardDrive, Zap, ArrowRight, TrendingUp, ShieldCheck, Phone, MessageSquare, ArrowRightLeft, BellRing, AlertCircle, ShieldAlert, UserCog, Battery, X, Check, Pencil } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { AttendanceTrendChart } from '../analytics/AttendanceTrendChart';
import { notificationService } from '../../services/notificationService';
import { sound } from '../../utils/feedback';
import { RunningText } from '../common/RunningText';
import { GlideCarousel } from '../common/GlideCarousel';
import { PiketInstanWidget } from '../common/PiketInstanWidget';
import { PetaLokasiMap } from '../common/PetaLokasiMap';
import { PiketReminderNotification } from '../common/PiketReminderNotification';
import { AdminPanicModeModal } from '../modals/AdminPanicModeModal';
import { DutySchedule } from '../../types';
import { showSuccessToast } from '../../utils/toast';

interface AdminDashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenAISummary?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ setActiveTab, onOpenAISummary }) => {
  const { school, users, posts, schedules, attendances, incidents, logbooks, auditLogs, adminManualCheckIn, createReplacement } = useData();
  const [showPanicModal, setShowPanicModal] = useState<boolean>(false);

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

  const today = getTodayDateString();
  const dayName = getDayNameIndo(today);
  const todaySchedules = schedules.filter((s) => s.tanggal === today);

  const totalGuru = users.filter((u) => u.role === 'guru').length;
  const totalTendik = users.filter((u) => u.role === 'tendik').length;
  const petugasAktif = todaySchedules.filter((s) => s.status === 'sedang_bertugas').length;
  const belumCheckin = todaySchedules.filter((s) => s.status === 'belum_checkin' || s.status === 'belum_piket').length;
  const kejadianHariIni = incidents.filter((i) => i.tanggal === today);
  const urgentIncidents = incidents.filter((i) => i.pentingKepalaSekolah || i.prioritas === 'darurat' || i.prioritas === 'tinggi');

  const handleAdminOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideSchedule) return;
    setOverrideSubmitting(true);
    try {
      const res = await adminManualCheckIn(overrideSchedule.id, overrideStatus, overrideNotes);
      showSuccessToast(res.message);
      setOverrideSchedule(null);
      setOverrideNotes('');
    } catch (e: any) {
      alert('Gagal memproses presensi manual admin.');
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
        showSuccessToast(`Guru pengganti (${repUser.nama}) berhasil ditugaskan!`);
        setReplacementSchedule(null);
        setReplacementUserId('');
        setReplacementReason('');
      }
    } catch (e: any) {
      alert('Gagal memproses penggantian tugas.');
    } finally {
      setReplacementSubmitting(false);
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

      {/* TOP SECTION: REALTIME MONITORING STATUS POS PIKET HARI INI */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-colors">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>📊 Monitoring Real-Time Petugas Piket Hari Ini</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                Live Status
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring kehadiran &amp; posisi petugas piket di seluruh pos sekolah</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('jadwal')}
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Lihat Jadwal Piket</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {posts.map((post) => {
            const postSchedules = todaySchedules.filter((s) => s.postId === post.id);
            return (
              <div
                key={post.id}
                className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors shadow-2xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{post.namaPos}</h4>
                  </div>
                  <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate pl-2">{post.lokasi}</span>
                </div>

                {postSchedules.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">Tidak ada petugas terjadwal saat ini.</p>
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
                            {sch.status === 'sudah_checkout' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                                Selesai
                              </span>
                            )}
                            {sch.status === 'dibatalkan' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                {sch.notes?.includes('SAKIT') ? '😷 Sakit' : sch.notes?.includes('IZIN') ? '✉️ Izin' : 'Dibatalkan'}
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
      </div>

      {/* REAL-TIME INTERACTIVE LEAFLET GEOFENCE MAP (MOVED BELOW MONITORING REAL-TIME) */}
      <PetaLokasiMap />

      {/* JADWAL REALTIME PIKET HARI INI & FITUR PRESENSI ADMIN / PENGGANTIAN (REQUIREMENTS 4, 5, 6) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Jadwal Realtime Piket Hari Ini ({todaySchedules.length} Petugas)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monitoring jadwal guru piket hari ini. Admin dapat memperbarui status presensi (Sakit/Izin/HP Low-Bat) atau menugaskan pengganti secara langsung.
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

        {todaySchedules.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            Tidak ada jadwal piket reguler untuk hari ini ({dayName}, {formatDateIndo(today)}).
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {todaySchedules.map((sch) => {
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
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-300 font-extrabold text-[11px] border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center gap-1"
                            title="Presensi Manual Admin / Ubah Status (Low-Bat/Sakit/Izin)"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Presensi Admin</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setReplacementSchedule(sch);
                              setReplacementUserId('');
                              setReplacementReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:hover:bg-teal-900/80 dark:text-teal-300 font-extrabold text-[11px] border border-teal-200 dark:border-teal-800 transition cursor-pointer flex items-center gap-1"
                            title="Tugaskan Guru Pengganti"
                          >
                            <UserCog className="w-3 h-3" />
                            <span>Ganti</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {/* ADMIN PANIC MODE & DISASTER RECOVERY MODAL */}
      <AdminPanicModeModal
        isOpen={showPanicModal}
        onClose={() => setShowPanicModal(false)}
      />

    </div>
  );
};
