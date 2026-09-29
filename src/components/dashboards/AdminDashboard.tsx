import React, { useState } from 'react';
import { Users, MapPin, Clock, AlertTriangle, BookOpen, CheckCircle2, XCircle, Calendar, Plus, FileText, HardDrive, Zap, ArrowRight, TrendingUp, ShieldCheck, Phone, MessageSquare, ArrowRightLeft, BellRing, AlertCircle, ShieldAlert } from 'lucide-react';
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

interface AdminDashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenAISummary?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ setActiveTab, onOpenAISummary }) => {
  const { school, users, posts, schedules, attendances, incidents, logbooks, auditLogs, sendCustomWhatsApp } = useData();
  const [showPanicModal, setShowPanicModal] = useState<boolean>(false);

  const today = getTodayDateString();
  const dayName = getDayNameIndo(today);
  const todaySchedules = schedules.filter((s) => s.tanggal === today);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const tolerance = school.toleransiKeterlambatanMenit || 15;

  // Real-time Late Check-in calculation: scheduled teachers who have not checked in past their start time
  const lateCheckInList = todaySchedules
    .filter((s) => {
      if (s.status === 'sedang_bertugas' || s.status === 'sudah_checkout') return false;
      if (!s.jamMulai) return false;
      const [h, m] = s.jamMulai.split(':').map(Number);
      const startMin = h * 60 + m;
      return currentMinutes > startMin;
    })
    .map((s) => {
      const [h, m] = s.jamMulai!.split(':').map(Number);
      const startMin = h * 60 + m;
      const minutesLate = currentMinutes - startMin;
      const user = users.find((u) => u.id === s.userId);
      return {
        ...s,
        minutesLate,
        userPhone: user?.nomorHP,
        userPhoto: user?.foto,
        userNip: user?.nip
      };
    });

  const totalGuru = users.filter((u) => u.role === 'guru').length;
  const totalTendik = users.filter((u) => u.role === 'tendik').length;
  const petugasAktif = todaySchedules.filter((s) => s.status === 'sedang_bertugas').length;
  const belumCheckin = todaySchedules.filter((s) => s.status === 'belum_checkin' || s.status === 'belum_piket').length;
  const terlambat = todaySchedules.filter((s) => s.status === 'terlambat').length;
  const kejadianHariIni = incidents.filter((i) => i.tanggal === today);
  const urgentIncidents = incidents.filter((i) => i.pentingKepalaSekolah || i.prioritas === 'darurat' || i.prioritas === 'tinggi');

  const handleSendWhatsAppReminder = (teacherName: string, postName: string, phone?: string, jamMulai?: string) => {
    if (!phone) {
      alert(`Nomor telepon untuk ${teacherName} belum terdaftar.`);
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const msgText = encodeURIComponent(
      `Halo Bpk/Ibu ${teacherName}, kami menginformasikan bahwa Anda terjadwal piket di ${postName} hari ini mulai pukul ${jamMulai} WIB dan saat ini tercatat belum melakukan check-in di aplikasi e-Piket Digital. Mohon segera menuju pos dan melakukan check-in presensi selfie. Terima kasih.`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${msgText}`, '_blank');
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

      {/* REAL-TIME INTERACTIVE LEAFLET GEOFENCE MAP */}
      <PetaLokasiMap />

      {/* REAL-TIME LATE CHECK-IN ALERT BANNER FOR ADMIN */}
      {lateCheckInList.length > 0 && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-amber-500/10 border-2 border-rose-500/40 dark:border-rose-500/50 shadow-lg shadow-rose-500/10 space-y-3.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-rose-900 dark:text-rose-200 flex items-center gap-2">
                  <span>Peringatan Real-Time: Petugas Belum Check-In</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold">
                    {lateCheckInList.length} Guru Terlambat
                  </span>
                </h2>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  Petugas piket berikut telah melewati jam mulai shift dan belum melakukan check-in di pos.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('penggantian')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Tugaskan Pengganti</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {lateCheckInList.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                    {item.userPhoto ? (
                      <img src={item.userPhoto} alt={item.userName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{item.userName?.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <RunningText
                        text={item.userName || ''}
                        maxLength={18}
                        className="text-xs font-bold text-slate-900 dark:text-white"
                      />
                      <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 px-1.5 py-0.5 rounded-md shrink-0">
                        +{item.minutesLate}m
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      {item.postName} • Jadwal: <strong className="font-mono">{item.jamMulai} WIB</strong>
                    </p>
                    {item.userPhone && (
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                        WA: {item.userPhone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppReminder(item.userName || '', item.postName || '', item.userPhone, item.jamMulai)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                    title="Kirim pesan peringatan via WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Hubungi WA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('penggantian')}
                    className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                    title="Cari guru pengganti piket"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Ganti</span>
                  </button>
                </div>
              </div>
            ))}
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

      {/* Main Grid: Realtime Picket Status & Recent System Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Picket Status by Post (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Status Pos Piket Hari Ini</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring real-time kehadiran petugas di seluruh pos</p>
            </div>
            <button
              onClick={() => setActiveTab('jadwal')}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              Lihat Jadwal Piket →
            </button>
          </div>

          <div className="space-y-3">
            {posts.map((post) => {
              const postSchedules = todaySchedules.filter((s) => s.postId === post.id);
              return (
                <div
                  key={post.id}
                  className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{post.namaPos}</h4>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{post.lokasi}</span>
                  </div>

                  {postSchedules.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Tidak ada petugas terjadwal saat ini.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {postSchedules.map((sch) => {
                        const att = attendances.find((a) => a.scheduleId === sch.id);
                        return (
                          <div
                            key={sch.id}
                            className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{sch.userName}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {sch.jamMulai} - {sch.jamSelesai} • {sch.userRole === 'guru' ? 'Guru' : 'Tendik'}
                              </p>
                            </div>
                            <div className="text-right ml-2 shrink-0">
                              {sch.status === 'sedang_bertugas' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                  Hadir {att?.checkInAt ? formatTimeIndo(att.checkInAt).split(' ')[0] : ''}
                                </span>
                              )}
                              {sch.status === 'terlambat' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  Terlambat
                                </span>
                              )}
                              {(sch.status === 'belum_checkin' || sch.status === 'belum_piket') && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  Belum Hadir
                                </span>
                              )}
                              {sch.status === 'sudah_checkout' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                                  Selesai
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

        {/* Audit & Activity Feed (Glide Sliders for Mobile & Desktop) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Aktivitas Sistem</h2>
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
              <span>Buka Laporan & Rekap Bulanan</span>
            </button>
          </div>
        </div>

      </div>

      {/* ADMIN PANIC MODE & DISASTER RECOVERY MODAL */}
      <AdminPanicModeModal
        isOpen={showPanicModal}
        onClose={() => setShowPanicModal(false)}
      />

    </div>
  );
};
