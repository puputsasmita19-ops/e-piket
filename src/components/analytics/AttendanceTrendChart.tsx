import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line,
  Cell
} from 'recharts';
import { TrendingUp, Calendar, CheckCircle2, Clock, AlertTriangle, Award, Filter, BarChart3, Layers, Zap, BookOpen, ShieldAlert, Users, Activity, ChevronDown } from 'lucide-react';
import { DutySchedule, Attendance, DutyPost, Incident, Logbook, User } from '../../types';
import { formatDateIndo, formatMonthYearIndo } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';

interface AttendanceTrendChartProps {
  schedules: DutySchedule[];
  attendances: Attendance[];
  posts: DutyPost[];
  incidents?: Incident[];
  logbooks?: Logbook[];
  users?: User[];
  title?: string;
  subtitle?: string;
  variant?: 'admin' | 'kepsek';
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({
  schedules,
  attendances,
  posts,
  incidents = [],
  logbooks = [],
  users = [],
  title = 'Visualisasi Statistik & Analisis Operasional Piket',
  subtitle = 'Statistik kehadiran guru per bulan, tren kejadian harian, dan ringkasan buku piket',
  variant = 'admin'
}) => {
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'incidents' | 'logbooks' | 'posts'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Unique list of months available in schedules
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    schedules.forEach((s) => {
      if (s.tanggal) {
        months.add(s.tanggal.substring(0, 7));
      }
    });
    incidents.forEach((i) => {
      if (i.tanggal) {
        months.add(i.tanggal.substring(0, 7));
      }
    });
    logbooks.forEach((l) => {
      if (l.tanggal) {
        months.add(l.tanggal.substring(0, 7));
      }
    });
    const arr = Array.from(months).sort().reverse();
    return arr.length > 0 ? arr : [selectedMonth];
  }, [schedules, incidents, logbooks, selectedMonth]);

  // 1. Daily Attendance Trend Data for selected month
  const dailyTrendData = useMemo(() => {
    const monthSchedules = schedules.filter((s) => s.tanggal.startsWith(selectedMonth));
    
    const dateMap: { [date: string]: { total: number; tepatWaktu: number; terlambat: number; belumHadir: number } } = {};
    
    monthSchedules.forEach((s) => {
      if (!dateMap[s.tanggal]) {
        dateMap[s.tanggal] = { total: 0, tepatWaktu: 0, terlambat: 0, belumHadir: 0 };
      }
      dateMap[s.tanggal].total += 1;
      if (s.status === 'sedang_bertugas' || s.status === 'sudah_checkout') {
        dateMap[s.tanggal].tepatWaktu += 1;
      } else if (s.status === 'terlambat') {
        dateMap[s.tanggal].terlambat += 1;
      } else {
        dateMap[s.tanggal].belumHadir += 1;
      }
    });

    const dates = Object.keys(dateMap).sort();
    return dates.map((date) => {
      const d = dateMap[date];
      const dayNum = date.split('-')[2];
      const disciplineRate = d.total > 0 ? Math.round(((d.tepatWaktu) / d.total) * 100) : 100;
      return {
        date,
        shortDate: `Tgl ${dayNum}`,
        fullDate: formatDateIndo(date),
        total: d.total,
        tepatWaktu: d.tepatWaktu,
        terlambat: d.terlambat,
        belumHadir: d.belumHadir,
        persentaseDisiplin: disciplineRate
      };
    });
  }, [schedules, selectedMonth]);

  // 2. Monthly Attendance Breakdown Data (Multi-month comparison)
  const monthlyAttendanceData = useMemo(() => {
    const monthMap: { [m: string]: { total: number; hadir: number; terlambat: number; digantikan: number } } = {};

    schedules.forEach((s) => {
      const m = s.tanggal ? s.tanggal.substring(0, 7) : selectedMonth;
      if (!monthMap[m]) {
        monthMap[m] = { total: 0, hadir: 0, terlambat: 0, digantikan: 0 };
      }
      monthMap[m].total += 1;
      if (s.status === 'sedang_bertugas' || s.status === 'sudah_checkout') {
        monthMap[m].hadir += 1;
      } else if (s.status === 'terlambat') {
        monthMap[m].terlambat += 1;
      }
      if (s.isReplacement || s.status === 'digantikan') {
        monthMap[m].digantikan += 1;
      }
    });

    const sortedMonths = Object.keys(monthMap).sort();
    return sortedMonths.map((m) => {
      const item = monthMap[m];
      const rate = item.total > 0 ? Math.round((item.hadir / item.total) * 100) : 100;
      return {
        month: m,
        label: formatMonthYearIndo(m),
        shortLabel: m,
        total: item.total,
        hadir: item.hadir,
        terlambat: item.terlambat,
        digantikan: item.digantikan,
        persentase: rate
      };
    });
  }, [schedules, selectedMonth]);

  // 3. Daily Incidents Trend Data
  const dailyIncidentData = useMemo(() => {
    const monthIncidents = incidents.filter((i) => i.tanggal.startsWith(selectedMonth));
    const dateMap: {
      [date: string]: {
        total: number;
        darurat: number;
        tinggi: number;
        sedang: number;
        rendah: number;
        kedisiplinan: number;
        keamanan: number;
        medis: number;
        lainnya: number;
      };
    } = {};

    monthIncidents.forEach((inc) => {
      if (!dateMap[inc.tanggal]) {
        dateMap[inc.tanggal] = {
          total: 0,
          darurat: 0,
          tinggi: 0,
          sedang: 0,
          rendah: 0,
          kedisiplinan: 0,
          keamanan: 0,
          medis: 0,
          lainnya: 0
        };
      }
      dateMap[inc.tanggal].total += 1;
      if (inc.prioritas === 'darurat') dateMap[inc.tanggal].darurat += 1;
      else if (inc.prioritas === 'tinggi') dateMap[inc.tanggal].tinggi += 1;
      else if (inc.prioritas === 'sedang') dateMap[inc.tanggal].sedang += 1;
      else dateMap[inc.tanggal].rendah += 1;

      const kat = (inc.kategori || '').toLowerCase();
      if (kat.includes('disiplin') || kat.includes('terlambat') || kat.includes('seragam')) {
        dateMap[inc.tanggal].kedisiplinan += 1;
      } else if (kat.includes('aman') || kat.includes('tamu') || kat.includes('gerbang')) {
        dateMap[inc.tanggal].keamanan += 1;
      } else if (kat.includes('medis') || kat.includes('sakit') || kat.includes('uks')) {
        dateMap[inc.tanggal].medis += 1;
      } else {
        dateMap[inc.tanggal].lainnya += 1;
      }
    });

    const dates = Object.keys(dateMap).sort();
    return dates.map((date) => {
      const d = dateMap[date];
      const dayNum = date.split('-')[2];
      return {
        date,
        shortDate: `Tgl ${dayNum}`,
        fullDate: formatDateIndo(date),
        total: d.total,
        darurat: d.darurat,
        tinggi: d.tinggi,
        sedang: d.sedang,
        rendah: d.rendah,
        kedisiplinan: d.kedisiplinan,
        keamanan: d.keamanan,
        medis: d.medis
      };
    });
  }, [incidents, selectedMonth]);

  // 4. Logbook Summary Data per Post & Date
  const logbookSummaryData = useMemo(() => {
    const monthLogs = logbooks.filter((l) => l.tanggal.startsWith(selectedMonth));
    
    return posts.map((post) => {
      const pLogs = monthLogs.filter((l) => l.postId === post.id);
      const total = pLogs.length;
      const withStudents = pLogs.filter((l) => {
        if (!l.siswaTerkait) return false;
        if (Array.isArray(l.siswaTerkait)) return l.siswaTerkait.length > 0;
        return String(l.siswaTerkait).trim() !== '';
      }).length;
      const withFollowUp = pLogs.filter((l) => l.tindakLanjut && l.tindakLanjut.trim() !== '').length;

      return {
        postName: post.namaPos.replace('Pos Piket ', '').replace('Pos ', ''),
        fullName: post.namaPos,
        totalLogs: total,
        catatanSiswa: withStudents,
        tindakLanjut: withFollowUp
      };
    });
  }, [logbooks, posts, selectedMonth]);

  // 5. Post Comparison Data for attendance
  const postComparisonData = useMemo(() => {
    const monthSchedules = schedules.filter((s) => s.tanggal.startsWith(selectedMonth));
    
    return posts.map((post) => {
      const pSchedules = monthSchedules.filter((s) => s.postId === post.id);
      const total = pSchedules.length;
      const tepatWaktu = pSchedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
      const terlambat = pSchedules.filter((s) => s.status === 'terlambat').length;
      const rate = total > 0 ? Math.round((tepatWaktu / total) * 100) : 100;

      return {
        postName: post.namaPos.replace('Pos Piket ', '').replace('Pos ', ''),
        fullName: post.namaPos,
        total,
        tepatWaktu,
        terlambat,
        disiplinRate: rate
      };
    });
  }, [schedules, posts, selectedMonth]);

  // Monthly KPIs
  const monthlyStats = useMemo(() => {
    const monthSchedules = schedules.filter((s) => s.tanggal.startsWith(selectedMonth));
    const monthIncidents = incidents.filter((i) => i.tanggal.startsWith(selectedMonth));
    const monthLogs = logbooks.filter((l) => l.tanggal.startsWith(selectedMonth));

    const total = monthSchedules.length;
    const tepatWaktu = monthSchedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
    const terlambat = monthSchedules.filter((s) => s.status === 'terlambat').length;
    const rate = total > 0 ? Math.round((tepatWaktu / total) * 100) : 100;

    return {
      total,
      tepatWaktu,
      terlambat,
      rate,
      totalIncidents: monthIncidents.length,
      totalLogs: monthLogs.length
    };
  }, [schedules, incidents, logbooks, selectedMonth]);

  // Custom Tooltip for Daily Attendance
  const DailyAttendanceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 text-xs space-y-1.5 min-w-[190px]">
          <p className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 flex items-center justify-between">
            <span>{data.fullDate || data.fullName || label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
              {data.persentaseDisiplin ?? data.disiplinRate}% Disiplin
            </span>
          </p>
          <div className="space-y-1 pt-1">
            <p className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Tepat Waktu:
              </span>
              <strong className="font-mono font-bold">{data.tepatWaktu}</strong>
            </p>
            <p className="flex items-center justify-between text-amber-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Terlambat:
              </span>
              <strong className="font-mono font-bold">{data.terlambat}</strong>
            </p>
            <p className="flex items-center justify-between text-slate-300 border-t border-slate-800 pt-1 font-semibold">
              <span>Total Tugas:</span>
              <span className="font-mono">{data.total} Sesi</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Incidents
  const IncidentTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/80 text-xs space-y-1.5 min-w-[190px]">
          <p className="font-bold text-rose-300 border-b border-slate-700/80 pb-1 flex items-center justify-between">
            <span>{data.fullDate || label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
              {data.total} Kejadian
            </span>
          </p>
          <div className="space-y-1 pt-1">
            <p className="flex items-center justify-between text-rose-400">
              <span>Darurat / Tinggi:</span>
              <strong className="font-mono font-bold">{data.darurat + data.tinggi}</strong>
            </p>
            <p className="flex items-center justify-between text-amber-400">
              <span>Kedisiplinan:</span>
              <strong className="font-mono font-bold">{data.kedisiplinan}</strong>
            </p>
            <p className="flex items-center justify-between text-teal-400">
              <span>Medis / UKS:</span>
              <strong className="font-mono font-bold">{data.medis}</strong>
            </p>
            <p className="flex items-center justify-between text-slate-300">
              <span>Keamanan & Tamu:</span>
              <strong className="font-mono font-bold">{data.keamanan}</strong>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6 transition-colors">
      
      {/* Header with Title, Month Filter, and Tab switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl text-white ${variant === 'kepsek' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Filters & View Modes */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none cursor-pointer"
            >
              {availableMonths.map((m) => {
                const [y, mn] = m.split('-');
                const label = new Date(parseInt(y), parseInt(mn) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                return (
                  <option key={m} value={m} className="dark:bg-slate-800 dark:text-white">
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* View Mode Dropdown Select (Neat & Compact Dropdown in Gray Frame) */}
          <div className="relative flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 px-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold gap-2 shadow-2xs min-w-[200px] sm:min-w-[240px]">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-extrabold shrink-0">
              {viewMode === 'daily' && <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              {viewMode === 'monthly' && <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              {viewMode === 'incidents' && <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
              {viewMode === 'logbooks' && <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
              {viewMode === 'posts' && <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            </div>

            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              aria-label="Pilih Tampilan Analisis"
              className="bg-transparent text-slate-900 dark:text-white font-black text-xs py-1 pr-6 focus:outline-none cursor-pointer appearance-none w-full"
            >
              <option value="daily" className="dark:bg-slate-800 text-slate-900 dark:text-white font-semibold">Kehadiran Harian</option>
              <option value="monthly" className="dark:bg-slate-800 text-slate-900 dark:text-white font-semibold">Kehadiran Bulanan</option>
              <option value="incidents" className="dark:bg-slate-800 text-slate-900 dark:text-white font-semibold">Kejadian Harian</option>
              <option value="logbooks" className="dark:bg-slate-800 text-slate-900 dark:text-white font-semibold">Buku Piket Pos</option>
              <option value="posts" className="dark:bg-slate-800 text-slate-900 dark:text-white font-semibold">Pos Piket</option>
            </select>

            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none absolute right-3" />
          </div>

        </div>
      </div>

      {/* Monthly Mini KPI Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Kedisiplinan Piket</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300">{monthlyStats.rate}%</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Tepat Waktu</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">Buku Piket Terisi</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-teal-900 dark:text-teal-300">{monthlyStats.totalLogs}</span>
            <span className="text-[10px] text-teal-700 dark:text-teal-400">Logbook</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Total Kejadian</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-rose-800 dark:text-rose-300">{monthlyStats.totalIncidents}</span>
            <span className="text-[10px] text-rose-600 dark:text-rose-400">Laporan</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Total Sesi Bulan Ini</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-200">{monthlyStats.total}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Jadwal</span>
          </div>
        </div>
      </div>

      {/* CHART 1: DAILY ATTENDANCE TREND */}
      {viewMode === 'daily' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Grafik Tren Kehadiran & Ketepatan Waktu Harian
            </h3>
            <span className="text-xs text-slate-500 font-mono">Area & Bar Chart</span>
          </div>
          
          <div className="h-72 w-full">
            {dailyTrendData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Calendar className="w-8 h-8 mb-2 opacity-40" />
                <span>Belum ada data jadwal kehadiran pada bulan ini</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTepat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="shortDate" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                  <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                  <Tooltip content={<DailyAttendanceTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area type="monotone" dataKey="tepatWaktu" name="Tepat Waktu" stroke="#10b981" fillOpacity={1} fill="url(#colorTepat)" />
                  <Bar dataKey="terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={14} />
                  <Line type="monotone" dataKey="persentaseDisiplin" name="Skor Disiplin (%)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* CHART 2: MONTHLY ATTENDANCE STATS */}
      {viewMode === 'monthly' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Statistik Kehadiran Guru & Tendik Antar Bulan
            </h3>
            <span className="text-xs text-slate-500 font-mono">Recharts Bar & Discipline Rate</span>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis dataKey="label" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === 'persentase' ? `${value}%` : `${value} Sesi`,
                    name === 'hadir' ? 'Hadir Tepat' : name === 'terlambat' ? 'Terlambat' : name === 'digantikan' ? 'Digantikan' : 'Kedisiplinan'
                  ]}
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '16px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="hadir" name="Hadir Tepat" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="digantikan" name="Digantikan" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CHART 3: DAILY INCIDENTS TREND */}
      {viewMode === 'incidents' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Jumlah Kejadian Harian & Analisis Kategori Insiden</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Recharts Incident Line</span>
          </div>
          
          <div className="h-72 w-full">
            {dailyIncidentData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500" />
                <span className="font-bold text-slate-700 dark:text-slate-300">Nihil Kejadian Pada Bulan Ini</span>
                <span className="text-[11px]">Seluruh kegiatan sekolah terpantau aman dan tertib terkendali.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyIncidentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="shortDate" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                  <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} allowDecimals={false} />
                  <Tooltip content={<IncidentTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="darurat" name="Darurat / Urgen" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="kedisiplinan" name="Kedisiplinan" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="medis" name="Medis / UKS" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={14} />
                  <Line type="monotone" dataKey="total" name="Total Insiden" stroke="#881337" strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* CHART 4: BUKU PIKET LOGBOOK SUMMARY */}
      {viewMode === 'logbooks' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>Ringkasan Buku Piket & Aktivitas Logbook per Pos</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Recharts Bar Logbook</span>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logbookSummaryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis dataKey="postName" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} allowDecimals={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value} Catatan`,
                    name === 'totalLogs' ? 'Total Buku Piket Terisi' : name === 'catatanSiswa' ? 'Ada Catatan Siswa' : 'Tindak Lanjut Tercatat'
                  ]}
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '16px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="totalLogs" name="Buku Piket Terisi" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="catatanSiswa" name="Catatan Siswa Terkait" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tindakLanjut" name="Tindak Lanjut / Solusi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CHART 5: POST COMPARISON */}
      {viewMode === 'posts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Komparasi Ketertiban Antar Pos Piket
            </h3>
            <span className="text-xs text-slate-500 font-mono">Recharts Bar Post</span>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={postComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
                <XAxis dataKey="postName" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={11} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value} Sesi`,
                    name === 'tepatWaktu' ? 'Tepat Waktu' : 'Terlambat'
                  ]}
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                    borderRadius: '16px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="tepatWaktu" name="Tepat Waktu" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terlambat" name="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
};
