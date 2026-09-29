import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Calendar,
  Layers
} from 'lucide-react';
import { DutySchedule, Attendance, DutyPost } from '../../types';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';

interface AdminWeeklyAttendanceBarChartProps {
  schedules: DutySchedule[];
  attendances: Attendance[];
  posts?: DutyPost[];
}

export const AdminWeeklyAttendanceBarChart: React.FC<AdminWeeklyAttendanceBarChartProps> = ({
  schedules,
  attendances,
  posts = []
}) => {
  const { isDarkMode } = useTheme();
  const [filterPeriod, setFilterPeriod] = useState<'current_week' | 'last_7_days' | 'month'>('current_week');
  const [activeMetricTab, setActiveMetricTab] = useState<'attendance_rate' | 'punctuality_split' | 'both'>('both');

  const today = getTodayDateString();

  // Calculate dates for current week (Monday to Saturday)
  const weekDates = useMemo(() => {
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diffToMonday);

    const dates: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // Calculate dates for rolling last 7 days
  const last7DaysDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // Target dates based on filterPeriod
  const targetDates = useMemo(() => {
    if (filterPeriod === 'current_week') return weekDates;
    if (filterPeriod === 'last_7_days') return last7DaysDates;
    // Month: get all unique dates from this month
    const curMonth = today.slice(0, 7);
    const set = new Set<string>();
    schedules.forEach(s => {
      if (s.tanggal?.startsWith(curMonth)) set.add(s.tanggal);
    });
    return Array.from(set).sort();
  }, [filterPeriod, weekDates, last7DaysDates, schedules, today]);

  // Transform into daily data for Weekly Attendance Rate & Punctuality Bar Chart
  const chartData = useMemo(() => {
    return targetDates.map((dateStr) => {
      const daySchedules = schedules.filter((s) => s.tanggal === dateStr);
      const totalJadwal = daySchedules.length;

      // Attendees
      const attendedSchedules = daySchedules.filter(
        (s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout'
      );
      const totalHadir = attendedSchedules.length;

      // Punctuality split
      let tepatWaktu = 0;
      let terlambat = 0;

      attendedSchedules.forEach((sch) => {
        const att = attendances.find((a) => a.scheduleId === sch.id || a.tanggal === sch.tanggal);
        if (att?.isLate || sch.status === 'terlambat') {
          terlambat += 1;
        } else {
          tepatWaktu += 1;
        }
      });

      // Also count late schedules even if still on duty or marked terlambat
      const additionalLate = daySchedules.filter(
        (s) => s.status === 'terlambat' && !attendedSchedules.includes(s)
      ).length;
      terlambat += additionalLate;

      const belumHadir = Math.max(0, totalJadwal - totalHadir);

      // Percentages
      const tingkatKehadiran = totalJadwal > 0 ? Math.round((totalHadir / totalJadwal) * 100) : 0;
      const totalEvaluated = tepatWaktu + terlambat;
      const persenTepatWaktu = totalEvaluated > 0 ? Math.round((tepatWaktu / totalEvaluated) * 100) : 0;
      const persenTerlambat = totalEvaluated > 0 ? Math.round((terlambat / totalEvaluated) * 100) : 0;

      const dayName = getDayNameIndo(dateStr);
      const dayShort = dayName.slice(0, 3);
      const dayNum = dateStr.split('-')[2];

      return {
        dateStr,
        label: `${dayShort} (${dayNum})`,
        dayName,
        totalJadwal,
        totalHadir,
        belumHadir,
        tepatWaktu,
        terlambat,
        tingkatKehadiran,
        persenTepatWaktu,
        persenTerlambat,
        isToday: dateStr === today
      };
    });
  }, [targetDates, schedules, attendances, today]);

  // Aggregate KPI stats across the selected period
  const aggregateStats = useMemo(() => {
    let totalScheduled = 0;
    let totalPresent = 0;
    let totalOnTime = 0;
    let totalLate = 0;

    chartData.forEach((d) => {
      totalScheduled += d.totalJadwal;
      totalPresent += d.totalHadir;
      totalOnTime += d.tepatWaktu;
      totalLate += d.terlambat;
    });

    const overallRate = totalScheduled > 0 ? Math.round((totalPresent / totalScheduled) * 100) : 100;
    const evaluatedPresent = totalOnTime + totalLate;
    const onTimeRate = evaluatedPresent > 0 ? Math.round((totalOnTime / evaluatedPresent) * 100) : 100;
    const lateRate = evaluatedPresent > 0 ? Math.round((totalLate / evaluatedPresent) * 100) : 0;

    return {
      totalScheduled,
      totalPresent,
      totalOnTime,
      totalLate,
      overallRate,
      onTimeRate,
      lateRate
    };
  }, [chartData]);

  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? '#1e293b' : '#f1f5f9';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-6 transition-colors">
      {/* Header with Title & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 mb-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Visualisasi Recharts Kehadiran Mingguan</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Tingkat Kehadiran Guru &amp; Komparasi Tepat Waktu vs Terlambat
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Analisis grafik batang real-time kedisiplinan dan absensi piket sekolah mingguan.
          </p>
        </div>

        {/* Filter Period Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setFilterPeriod('current_week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'current_week'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Minggu Ini
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('last_7_days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'last_7_days'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterPeriod === 'month'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Bulan Ini
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Scheduled */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Penugasan</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {aggregateStats.totalScheduled}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Petugas piket terjadwal
          </p>
        </div>

        {/* Overall Attendance Rate */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tingkat Kehadiran</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {aggregateStats.overallRate}%
          </p>
          <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5 font-medium">
            {aggregateStats.totalPresent} dari {aggregateStats.totalScheduled} sesi hadir
          </p>
        </div>

        {/* On-Time Rate */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tepat Waktu</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {aggregateStats.onTimeRate}%
          </p>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5 font-medium">
            {aggregateStats.totalOnTime} petugas tepat waktu
          </p>
        </div>

        {/* Late Rate */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rasio Terlambat</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
            {aggregateStats.lateRate}%
          </p>
          <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 mt-0.5 font-medium">
            {aggregateStats.totalLate} petugas terlambat
          </p>
        </div>
      </div>

      {/* Metric Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveMetricTab('both')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMetricTab === 'both'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Semua Visualisasi
          </button>
          <button
            type="button"
            onClick={() => setActiveMetricTab('attendance_rate')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMetricTab === 'attendance_rate'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tingkat Kehadiran (%)
          </button>
          <button
            type="button"
            onClick={() => setActiveMetricTab('punctuality_split')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMetricTab === 'punctuality_split'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tepat Waktu vs Terlambat
          </button>
        </div>

        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Periode: {targetDates.length > 0 ? `${formatDateIndo(targetDates[0])} - ${formatDateIndo(targetDates[targetDates.length - 1])}` : 'Tidak Ada Data'}
        </span>
      </div>

      {/* CHARTS CONTAINER */}
      <div className={`grid gap-6 ${activeMetricTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        
        {/* CHART 1: GRAFIK BATANG TINGKAT KEHADIRAN GURU PIKET MINGGUAN */}
        {(activeMetricTab === 'both' || activeMetricTab === 'attendance_rate') && (
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span>Grafik Batang Tingkat Kehadiran Harian</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Persentase (%) guru hadir vs total penugasan piket
                </p>
              </div>
              <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                Rata-rata: {aggregateStats.overallRate}%
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={240}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    stroke={textColor}
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                  />
                  <YAxis
                    stroke={textColor}
                    fontSize={11}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-700 text-xs space-y-1.5">
                          <p className="font-extrabold text-indigo-300">
                            {data.dayName}, {formatDateIndo(data.dateStr)}
                          </p>
                          <div className="space-y-1 pt-1 border-t border-slate-700">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Tingkat Kehadiran:</span>
                              <span className="font-black text-emerald-400 font-mono">{data.tingkatKehadiran}%</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-300">Petugas Hadir:</span>
                              <span className="font-bold text-white font-mono">{data.totalHadir} / {data.totalJadwal} Guru</span>
                            </div>
                            {data.belumHadir > 0 && (
                              <div className="flex items-center justify-between gap-4 text-amber-300">
                                <span>Belum Check-In:</span>
                                <span className="font-bold font-mono">{data.belumHadir} Guru</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="tingkatKehadiran"
                    name="Tingkat Kehadiran (%)"
                    radius={[8, 8, 0, 0]}
                    fill="#6366f1"
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.tingkatKehadiran >= 90
                            ? '#10b981'
                            : entry.tingkatKehadiran >= 70
                            ? '#6366f1'
                            : '#f59e0b'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Color Legend */}
            <div className="flex items-center justify-center gap-4 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                ≥ 90% (Sangat Baik)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                70-89% (Optimal)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                &lt; 70% (Perlu Perhatian)
              </span>
            </div>
          </div>
        )}

        {/* CHART 2: GRAFIK BATANG PERSENTASE TEPAT WAKTU VS TERLAMBAT */}
        {(activeMetricTab === 'both' || activeMetricTab === 'punctuality_split') && (
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Komparasi Persentase Tepat Waktu vs Terlambat</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Rasio kedisiplinan guru hadir tepat waktu vs terlambat
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-200/50">
                  {aggregateStats.onTimeRate}% Tepat
                </span>
                <span className="text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-200/50">
                  {aggregateStats.lateRate}% Telat
                </span>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={240}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="label"
                    stroke={textColor}
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                  />
                  <YAxis
                    stroke={textColor}
                    fontSize={11}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-700 text-xs space-y-1.5">
                          <p className="font-extrabold text-teal-300">
                            {data.dayName}, {formatDateIndo(data.dateStr)}
                          </p>
                          <div className="space-y-1 pt-1 border-t border-slate-700">
                            <div className="flex items-center justify-between gap-4 text-emerald-400">
                              <span>Tepat Waktu:</span>
                              <span className="font-bold font-mono">{data.tepatWaktu} Guru ({data.persenTepatWaktu}%)</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-rose-400">
                              <span>Terlambat:</span>
                              <span className="font-bold font-mono">{data.terlambat} Guru ({data.persenTerlambat}%)</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-300 pt-1 border-t border-slate-800">
                              <span>Total Hadir:</span>
                              <span className="font-bold font-mono text-white">{data.totalHadir} Guru</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                  <Bar
                    dataKey="persenTepatWaktu"
                    name="Tepat Waktu (%)"
                    stackId="a"
                    fill="#10b981"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="persenTerlambat"
                    name="Terlambat (%)"
                    stackId="a"
                    fill="#f43f5e"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subtext info */}
            <p className="text-[10.5px] text-center text-slate-500 dark:text-slate-400 italic">
              Persentase dihitung dari perbandingan kehadiran tepat waktu dan keterlambatan pada setiap hari tugas.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
