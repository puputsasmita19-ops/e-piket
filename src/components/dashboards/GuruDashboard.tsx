import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarCheck, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  BookOpen, 
  AlertTriangle, 
  HardDrive, 
  ArrowRightLeft, 
  Zap, 
  Camera, 
  ChevronRight, 
  ShieldAlert, 
  Calendar, 
  ShieldCheck,
  BarChart3,
  Award,
  TrendingUp,
  Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  CartesianGrid 
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo, formatTimeIndo, formatMonthYearIndo } from '../../utils/formatters';
import { SelfieCameraModal } from '../presence/SelfieCameraModal';
import { RunningText } from '../common/RunningText';
import { PiketInstanWidget } from '../common/PiketInstanWidget';
import { PetaLokasiMap } from '../common/PetaLokasiMap';
import { PiketReminderNotification } from '../common/PiketReminderNotification';
import { InstruksiPiketDadakanBanner } from '../common/InstruksiPiketDadakanBanner';

interface GuruDashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenCheckInModal?: (scheduleId: string) => void;
  onOpenCheckOutModal?: (scheduleId: string) => void;
}

export const GuruDashboard: React.FC<GuruDashboardProps> = ({ 
  setActiveTab, 
  onOpenCheckInModal,
  onOpenCheckOutModal
}) => {
  const { currentUser } = useAuth();
  const { school, schedules, attendances, logbooks, incidents, handovers, checkIn, checkOut } = useData();

  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [selfieModalState, setSelfieModalState] = useState<{
    isOpen: boolean;
    mode: 'checkin' | 'checkout';
    schedule: any;
  }>({
    isOpen: false,
    mode: 'checkin',
    schedule: null
  });

  const today = getTodayDateString();
  const dayName = getDayNameIndo(today);

  // Find today's duty for current user
  const myTodaySchedule = schedules.find(
    (s) => s.tanggal === today && (s.userId === currentUser?.id || s.originalUserId === currentUser?.id)
  );

  const myAttendance = myTodaySchedule
    ? attendances.find((a) => a.scheduleId === myTodaySchedule.id)
    : null;

  // Realtime elapsed duty time counter
  useEffect(() => {
    if (myAttendance?.checkInAt && !myAttendance?.checkOutAt) {
      const updateElapsed = () => {
        const checkInTime = new Date(myAttendance.checkInAt).getTime();
        const now = new Date().getTime();
        setElapsedMinutes(Math.max(0, Math.floor((now - checkInTime) / 60000)));
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 30000);
      return () => clearInterval(interval);
    }
  }, [myAttendance]);

  // Today's stats for this teacher
  const todayMyLogbooks = logbooks.filter((l) => l.tanggal === today && l.userId === currentUser?.id);
  const todayMyIncidents = incidents.filter((i) => i.tanggal === today && i.createdByUserId === currentUser?.id);
  const pendingHandoversForMe = handovers.filter((h) => h.toUserId === currentUser?.id && h.status === 'diserahkan');

  // Upcoming schedules
  const upcomingSchedules = schedules
    .filter((s) => s.userId === currentUser?.id && s.tanggal > today)
    .slice(0, 3);

  // User's schedule & attendance history from DataContext
  const mySchedules = useMemo(() => {
    return schedules.filter((s) => s.userId === currentUser?.id || s.originalUserId === currentUser?.id);
  }, [schedules, currentUser]);

  const myAttendances = useMemo(() => {
    return attendances.filter((a) => a.userId === currentUser?.id);
  }, [attendances, currentUser]);

  // Current month attendances
  const currentMonthStr = today.slice(0, 7);
  const monthlyMyAttendances = useMemo(() => {
    return myAttendances.filter((a) => a.tanggal?.startsWith(currentMonthStr));
  }, [myAttendances, currentMonthStr]);

  const monthlyAttendanceCount = monthlyMyAttendances.length;

  // Total duty hours calculation
  const totalDutyHours = useMemo(() => {
    const totalMins = myAttendances.reduce((acc, curr) => {
      if (curr.durasiMenit) return acc + curr.durasiMenit;
      if (curr.checkInAt && curr.checkOutAt) {
        const diff = Math.floor((new Date(curr.checkOutAt).getTime() - new Date(curr.checkInAt).getTime()) / 60000);
        return acc + Math.max(0, diff);
      }
      return acc + 180; // default 3 hours per shift if active
    }, 0);
    return (totalMins / 60).toFixed(1);
  }, [myAttendances]);

  // On-time percentage calculation
  const onTimeRate = useMemo(() => {
    if (monthlyAttendanceCount === 0) return 100;
    const lateCount = monthlyMyAttendances.filter((a) => a.isLate).length;
    return Math.round(((monthlyAttendanceCount - lateCount) / monthlyAttendanceCount) * 100);
  }, [monthlyMyAttendances, monthlyAttendanceCount]);

  // Time range filter for statistics: 'mingguan' | 'bulanan' | 'tahunan'
  const [timeRange, setTimeRange] = useState<'mingguan' | 'bulanan' | 'tahunan'>('bulanan');

  // Bar Chart Data based on selected timeRange (Mingguan, Bulanan, Tahunan)
  const chartData = useMemo(() => {
    if (timeRange === 'mingguan') {
      const sorted = [...mySchedules].sort((a, b) => (a?.tanggal || '').localeCompare(b?.tanggal || ''));
      const list = sorted.slice(-7);
      if (list.length === 0) {
        return ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => ({
          tanggal: today,
          label: d,
          jam: 0,
          hadir: 0,
          status: 'Belum Ada Jadwal',
          isLate: false,
          postName: 'Pos Piket'
        }));
      }
      return list.map((sch) => {
        const att = myAttendances.find((a) => a.scheduleId === sch.id || a.tanggal === sch.tanggal);
        let durasiHours = att?.durasiMenit ? Math.round((att.durasiMenit / 60) * 10) / 10 : 0;
        if (att && !durasiHours) durasiHours = 3.5;
        const dayLabel = new Date(sch.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
        return {
          tanggal: sch.tanggal,
          label: dayLabel,
          jam: durasiHours || (att ? 3.5 : 0.5),
          hadir: att ? 1 : 0,
          status: att ? (att.isLate ? 'Terlambat' : 'Tepat Waktu') : 'Belum Check-In',
          isLate: att?.isLate || false,
          postName: sch.postName || 'Pos Piket'
        };
      });
    }

    if (timeRange === 'tahunan') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const currentYear = new Date().getFullYear();

      return monthNames.map((mn, idx) => {
        const monthKey = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
        const monthAtts = myAttendances.filter((a) => a.tanggal?.startsWith(monthKey));
        const totalMins = monthAtts.reduce((sum, a) => sum + (a.durasiMenit || 180), 0);
        const hours = Math.round((totalMins / 60) * 10) / 10;
        const lateCount = monthAtts.filter((a) => a.isLate).length;

        return {
          tanggal: monthKey,
          label: mn,
          jam: hours || (monthAtts.length ? monthAtts.length * 3.5 : 0),
          hadir: monthAtts.length,
          status: `${monthAtts.length} Sesi Hadir (${lateCount} Terlambat)`,
          isLate: lateCount > 0 && lateCount >= monthAtts.length / 2,
          postName: `Rekap Bulan ${mn} ${currentYear}`
        };
      });
    }

    // Default: 'bulanan'
    const sorted = [...mySchedules].sort((a, b) => (a?.tanggal || '').localeCompare(b?.tanggal || ''));
    const list = sorted.length > 0 ? sorted.slice(-10) : [];

    return list.map((sch) => {
      const att = myAttendances.find((a) => a.scheduleId === sch.id || a.tanggal === sch.tanggal);
      let durasiHours = att?.durasiMenit ? Math.round((att.durasiMenit / 60) * 10) / 10 : 0;
      if (att && !durasiHours) durasiHours = 3.5;

      const dayLabel = new Date(sch.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

      let statusText = 'Belum Check-In';
      if (sch.status === 'sudah_checkout' || att?.checkOutAt) {
        statusText = att?.isLate ? 'Selesai (Terlambat)' : 'Selesai (Tepat Waktu)';
      } else if (sch.status === 'sedang_bertugas' || att?.checkInAt) {
        statusText = 'Sedang Bertugas';
      } else if (sch.status === 'dibatalkan') {
        statusText = 'Dibatalkan';
      }

      return {
        tanggal: sch.tanggal,
        label: dayLabel,
        jam: durasiHours || (att ? 3.5 : 0.5),
        hadir: att ? 1 : 0,
        status: statusText,
        isLate: att?.isLate || false,
        postName: sch.postName || 'Pos Piket'
      };
    });
  }, [mySchedules, myAttendances, timeRange]);

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 p-4 sm:p-6 lg:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] sm:text-xs font-semibold mb-1.5 sm:mb-2 border border-emerald-400/30">
              <Zap className="w-3.5 h-3.5" />
              <span>Portal Presensi & Petugas Piket Harian</span>
            </div>
            <div className="flex items-center gap-2 max-w-lg overflow-hidden">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
                Halo,
              </h1>
              <RunningText
                text={currentUser?.nama || 'Bapak/Ibu Guru'}
                maxLength={22}
                className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-emerald-300"
              />
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 sm:mt-1">
              {school.nama} • {dayName}, {formatDateIndo(today)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <button
              onClick={() => setActiveTab('buku-piket')}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-xs transition-all border border-white/20 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Buku Piket</span>
            </button>
            <button
              onClick={() => setActiveTab('kejadian')}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Lapor Kejadian</span>
            </button>
          </div>
        </div>
      </div>

      {/* REAL-TIME DUTY INSTRUCTION & DADAKAN ALERT BANNER */}
      <InstruksiPiketDadakanBanner />

      {/* FIREBASE CLOUD MESSAGING (FCM) BACKGROUND PUSH NOTIFICATION BANNER */}
      <PiketReminderNotification />

      {/* ONE-TAP INSTANT CHECK-IN WIDGET */}
      <PiketInstanWidget />

      {/* REAL-TIME INTERACTIVE LEAFLET GEOFENCE MAP */}
      <PetaLokasiMap />

      {/* TODAY'S DUTY HIGHLIGHT CARD */}
      {myTodaySchedule ? (
        <div className="bg-gradient-to-br from-slate-900 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-500/30 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                Tugas Piket Hari Ini
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white mt-2">
                {myTodaySchedule.postName}
              </h2>
              <p className="text-xs text-teal-200 flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-teal-300" />
                <span>{myTodaySchedule.shiftName} ({myTodaySchedule.jamMulai} - {myTodaySchedule.jamSelesai} WIB)</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-400">Status Tugas</p>
                <p className="text-sm font-bold text-emerald-400 capitalize">
                  {myTodaySchedule.status === 'sedang_bertugas' ? 'Sedang Bertugas' : 
                   myTodaySchedule.status === 'sudah_checkout' ? 'Selesai' :
                   myTodaySchedule.status === 'terlambat' ? 'Terlambat' : 'Belum Check-In'}
                </p>
              </div>

              {myAttendance?.checkInAt && (
                <div className="p-3 bg-white/10 rounded-2xl border border-white/15 text-center">
                  <span className="text-[10px] text-slate-300 uppercase block">Durasi Piket</span>
                  <span className="text-lg font-black text-amber-300 font-mono">{elapsedMinutes} mnt</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-300 max-w-md">
              {myTodaySchedule.notes ? (
                <p><strong>Catatan Tugas:</strong> {myTodaySchedule.notes}</p>
              ) : (
                <p>Jalankan protokol piket 5S, pengawasan gerbang/koridor, serta presensi kehadiran piket digital.</p>
              )}
            </div>

            <div className="w-full sm:w-auto">
              {myTodaySchedule.status === 'sedang_bertugas' ? (
                <button
                  onClick={async () => {
                    const res = await checkOut(myTodaySchedule.id, 'Selesai piket');
                    alert(res.message);
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-xl shadow-rose-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ABSEN SELESAI PIKET</span>
                </button>
              ) : myTodaySchedule.status === 'sudah_checkout' ? (
                <button
                  onClick={() => setActiveTab('buku-piket')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Lihat Arsip Buku Piket</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    const res = await checkIn(myTodaySchedule.id, 'Absen Mulai Piket');
                    alert(res.message);
                  }}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/40 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ABSEN MULAI PIKET</span>
                </button>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-100 to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-between transition-colors">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Anda Tidak Terjadwal Piket Hari Ini</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Nikmati hari Anda atau lihat jadwal piket mendatang Anda pada tab Jadwal.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('jadwal')}
            className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer transition"
          >
            Lihat Jadwal Piket
          </button>
        </div>
      )}

      {/* VISUAL PIKET STATISTICS & BAR CHART (Data from DataContext) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 mb-1">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Statistik & Analisis Presensi Saya</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Ringkasan Performa & Riwayat Piket
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Bulan Ini: {formatMonthYearIndo(today)}
          </span>
        </div>

        {/* Visual Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kehadiran Bulan Ini</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{monthlyAttendanceCount}</span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Sesi Hadir</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 rounded-2xl text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Akumulasi Piket</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{totalDutyHours}</span>
                <span className="text-xs text-teal-700 dark:text-teal-400 font-bold">Jam Kerja</span>
              </div>
            </div>
            <div className="p-3 bg-teal-100 dark:bg-teal-950/80 rounded-2xl text-teal-800 dark:text-teal-300">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Kedisiplinan Waktu</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{onTimeRate}%</span>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Tepat Waktu</span>
              </div>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-950/80 rounded-2xl text-amber-800 dark:text-amber-300">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Diagram Batang Riwayat Presensi (Bar Chart with Time Range Filter) */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Diagram Tren Durasi Presensi ({timeRange === 'mingguan' ? 'Mingguan' : timeRange === 'bulanan' ? 'Bulanan' : 'Tahunan'})
            </h3>

            {/* Time Range Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
              <button
                onClick={() => setTimeRange('mingguan')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeRange === 'mingguan'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mingguan
              </button>
              <button
                onClick={() => setTimeRange('bulanan')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeRange === 'bulanan'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setTimeRange('tahunan')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeRange === 'tahunan'
                    ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tahunan
              </button>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    unit="j"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl text-xs space-y-1 border border-slate-700">
                            <p className="font-extrabold text-emerald-400">{data.label} ({data.tanggal})</p>
                            <p className="text-slate-300"><strong>Pos:</strong> {data.postName}</p>
                            <p className="text-slate-300"><strong>Durasi Piket:</strong> {data.jam} Jam</p>
                            <p className="text-slate-300"><strong>Status:</strong> {data.status}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="jam" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isLate ? '#f43f5e' : entry.hadir ? '#059669' : '#94a3b8'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                Belum ada data presensi tercatat untuk diagram.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3 Quick Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Catatan Buku Piket Saya</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{todayMyLogbooks.length}</h3>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1">Entri aktif hari ini</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Kejadian Dilaporkan</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{todayMyIncidents.length}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1">Insiden & atensi</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-2xl text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Serah Terima Menunggu</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{pendingHandoversForMe.length}</h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">Perlu konfirmasi Anda</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-2xl text-amber-600 dark:text-amber-400">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Main Grid: Quick Action & Upcoming Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Menu shortcuts (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Aksi Cepat Petugas Piket</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTab('piket-saya')}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Presensi Selfie & GPS</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ambil foto presensi masuk/pulang ber-watermark</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('buku-piket')}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-slate-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Buku Piket Digital</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Catat tamu, izin siswa & situasi pos</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('serah-terima')}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Serah Terima Tugas</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Oper penugasan ke shift berikutnya</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('penggantian')}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Penggantian Petugas</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ajukan izin berhalangan atau ganti guru</p>
              </div>
            </button>
          </div>
        </div>

        {/* Upcoming Schedules (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Jadwal Piket Mendatang</h2>
            <button
              onClick={() => setActiveTab('jadwal')}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-bold cursor-pointer"
            >
              Semua →
            </button>
          </div>

          <div className="space-y-3">
            {upcomingSchedules.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">Tidak ada jadwal mendatang pekan ini.</p>
            ) : (
              upcomingSchedules.map((sch) => (
                <div key={sch.id} className="p-3.5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatDateIndo(sch.tanggal)}</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">{sch.postName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{sch.jamMulai} - {sch.jamSelesai} WIB</p>
                  </div>
                  <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* REALTIME SELFIE & GPS CAMERA MODAL */}
      {selfieModalState.isOpen && selfieModalState.schedule && (
        <SelfieCameraModal
          schedule={selfieModalState.schedule}
          mode={selfieModalState.mode}
          onClose={() => setSelfieModalState({ isOpen: false, mode: 'checkin', schedule: null })}
          onSuccess={() => {}}
        />
      )}

    </div>
  );
};
