import React, { useState, useMemo, useEffect } from 'react';
import { FileText, Download, Printer, Calendar, Filter, CheckCircle2, Clock, AlertTriangle, HardDrive, Users, Database, BookmarkCheck, Eye, Check, FileDown, Zap, Cloud, FolderSync } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { getTodayDateString } from '../../services/seedData';
import { formatDateIndo, formatTimeIndo, formatMonthYearIndo } from '../../utils/formatters';
import { 
  exportPicketDailyReportPDF, 
  exportPicketMonthlyReportPDF, 
  exportPicketLogbookMonthlyPDF, 
  exportToExcel,
  exportPicketWeeklyReportPDF,
  exportPicketSemesterReportPDF
} from '../../services/exportService';
import { uploadReportDocumentToDrive } from '../../services/driveService';
import { CachedReport } from '../../services/indexedDb';
import { BookOpen, Award, ShieldCheck } from 'lucide-react';
import { sound, haptic, triggerConfetti } from '../../utils/feedback';

export const Laporan: React.FC = () => {
  const { isGoogleDriveConnected, getDriveAccessToken } = useAuth();
  const { 
    school, 
    posts, 
    users, 
    schedules, 
    attendances, 
    incidents, 
    logbooks, 
    handovers, 
    cachedReports,
    cacheCurrentReport,
    schoolYear
  } = useData();

  const [reportType, setReportType] = useState<'harian' | 'mingguan' | 'bulanan' | 'semester'>(() => {
    try {
      const saved = localStorage.getItem('e_piket_laporan_type');
      if (saved && ['harian', 'mingguan', 'bulanan', 'semester'].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return 'harian';
  });

  useEffect(() => {
    try {
      localStorage.setItem('e_piket_laporan_type', reportType);
    } catch (e) {}
  }, [reportType]);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [selectedPost, setSelectedPost] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');

  // Offline view state
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<string | null>(null);

  // Week range calculation helper
  const getWeekRange = (dateStr: string) => {
    if (!dateStr) return { start: '', end: '', startFormatted: '', endFormatted: '' };
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return { start: dateStr, end: dateStr, startFormatted: dateStr, endFormatted: dateStr };
    
    const day = dateObj.getDay();
    // Adjust so start of the week is Monday
    const diffToMonday = dateObj.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dateObj);
    monday.setDate(diffToMonday);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const r = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${r}`;
    };
    
    const start = formatYMD(monday);
    const end = formatYMD(sunday);
    
    return {
      start,
      end,
      startFormatted: formatDateIndo(start),
      endFormatted: formatDateIndo(end)
    };
  };

  // Filter schedules based on report type & criteria
  const filteredSchedules = useMemo(() => {
    const weekRange = getWeekRange(selectedDate);
    return schedules.filter((s) => {
      let dateMatch = true;
      if (reportType === 'harian') {
        dateMatch = s.tanggal === selectedDate;
      } else if (reportType === 'bulanan') {
        dateMatch = Boolean(s && s.tanggal && typeof s.tanggal === 'string' && s.tanggal.startsWith(selectedDate.substring(0, 7)));
      } else if (reportType === 'mingguan') {
        dateMatch = Boolean(s && s.tanggal && typeof s.tanggal === 'string' && s.tanggal >= weekRange.start && s.tanggal <= weekRange.end);
      } else if (reportType === 'semester') {
        dateMatch = s.schoolYearId === schoolYear?.id;
      }

      const postMatch = selectedPost === 'all' || s.postId === selectedPost;
      const userMatch = selectedUser === 'all' || s.userId === selectedUser;

      return dateMatch && postMatch && userMatch;
    });
  }, [schedules, reportType, selectedDate, selectedPost, selectedUser, schoolYear]);

  const filteredIncidents = useMemo(() => {
    const weekRange = getWeekRange(selectedDate);
    return incidents.filter((i) => {
      if (reportType === 'harian') return i.tanggal === selectedDate;
      if (reportType === 'bulanan') return Boolean(i && i.tanggal && typeof i.tanggal === 'string' && i.tanggal.startsWith(selectedDate.substring(0, 7)));
      if (reportType === 'mingguan') return Boolean(i && i.tanggal && typeof i.tanggal === 'string' && i.tanggal >= weekRange.start && i.tanggal <= weekRange.end);
      if (reportType === 'semester') return i.tanggal ? true : false; // all incidents
      return true;
    });
  }, [incidents, reportType, selectedDate]);

  const hadirCount = filteredSchedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
  const terlambatCount = filteredSchedules.filter((s) => s.status === 'terlambat').length;
  const totalSchedules = filteredSchedules.length;
  const disciplineRate = totalSchedules > 0 ? Math.round((hadirCount / totalSchedules) * 100) : 100;

  // Monthly aggregated stats per teacher (for monthly view & export)
  const monthlyTeacherStats = useMemo(() => {
    const monthStr = selectedDate.substring(0, 7);
    const monthSchs = schedules.filter((s) => s && s.tanggal && typeof s.tanggal === 'string' && s.tanggal.startsWith(monthStr));
    return users
      .filter((u) => u.role === 'guru' || u.role === 'tendik')
      .map((u) => {
        const userSchs = monthSchs.filter((s) => s.userId === u.id);
        const total = userSchs.length;
        const onTime = userSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
        const late = userSchs.filter((s) => s.status === 'terlambat').length;
        const replaced = userSchs.filter((s) => s.isReplacement || s.status === 'digantikan').length;
        const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
        let predikat = 'Sangat Tertib';
        if (rate < 75) predikat = 'Perlu Pembinaan';
        else if (rate < 90) predikat = 'Tertib';

        return { user: u, total, onTime, late, replaced, rate, predikat };
      })
      .filter((item) => selectedUser === 'all' || item.user.id === selectedUser);
  }, [users, schedules, selectedDate, selectedUser]);

  // Monthly aggregated stats per post
  const monthlyPostStats = useMemo(() => {
    const monthStr = selectedDate.substring(0, 7);
    const monthSchs = schedules.filter((s) => s && s.tanggal && typeof s.tanggal === 'string' && s.tanggal.startsWith(monthStr));
    return posts.map((p) => {
      const postSchs = monthSchs.filter((s) => s.postId === p.id);
      const total = postSchs.length;
      const onTime = postSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
      const late = postSchs.filter((s) => s.status === 'terlambat').length;
      const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
      return { post: p, total, onTime, late, rate };
    }).filter((item) => selectedPost === 'all' || item.post.id === selectedPost);
  }, [posts, schedules, selectedDate, selectedPost]);

  // Semester aggregated stats per teacher (for semester view & export)
  const semesterTeacherStats = useMemo(() => {
    const semesterSchs = schedules.filter((s) => s.schoolYearId === schoolYear?.id);
    return users
      .filter((u) => u.role === 'guru' || u.role === 'tendik')
      .map((u) => {
        const userSchs = semesterSchs.filter((s) => s.userId === u.id);
        const total = userSchs.length;
        const onTime = userSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
        const late = userSchs.filter((s) => s.status === 'terlambat').length;
        const replaced = userSchs.filter((s) => s.isReplacement || s.status === 'digantikan').length;
        const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
        let predikat = 'Sangat Tertib';
        if (rate < 75) predikat = 'Perlu Pembinaan';
        else if (rate < 90) predikat = 'Tertib';

        return { user: u, total, onTime, late, replaced, rate, predikat };
      })
      .filter((item) => selectedUser === 'all' || item.user.id === selectedUser);
  }, [users, schedules, schoolYear, selectedUser]);

  // Semester aggregated stats per post
  const semesterPostStats = useMemo(() => {
    const semesterSchs = schedules.filter((s) => s.schoolYearId === schoolYear?.id);
    return posts.map((p) => {
      const postSchs = semesterSchs.filter((s) => s.postId === p.id);
      const total = postSchs.length;
      const onTime = postSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
      const late = postSchs.filter((s) => s.status === 'terlambat').length;
      const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
      return { post: p, total, onTime, late, rate };
    }).filter((item) => selectedPost === 'all' || item.post.id === selectedPost);
  }, [posts, schedules, schoolYear, selectedPost]);

  /**
   * Action 1: Export Daily Report PDF
   */
  const handlePrintDailyPDF = () => {
    const daySchedules = schedules.filter((s) => s.tanggal === selectedDate && (selectedPost === 'all' || s.postId === selectedPost) && (selectedUser === 'all' || s.userId === selectedUser));
    const dayIncidents = incidents.filter((i) => i.tanggal === selectedDate);
    const dayLogs = logbooks.filter((l) => l.tanggal === selectedDate);
    const dayHandovers = handovers.filter((h) => h.tanggal === selectedDate);

    exportPicketDailyReportPDF(
      school,
      selectedDate,
      daySchedules.length > 0 ? daySchedules : schedules.filter((s) => s.tanggal === selectedDate),
      attendances,
      dayIncidents,
      dayLogs,
      dayHandovers
    );
  };

  /**
   * Action 1.5: Export Weekly Report PDF
   */
  const handlePrintWeeklyPDF = () => {
    const weekRange = getWeekRange(selectedDate);
    exportPicketWeeklyReportPDF(
      school,
      weekRange.start,
      weekRange.end,
      filteredSchedules,
      attendances,
      filteredIncidents
    );
  };

  /**
   * Action 2: Export Monthly Recap PDF
   */
  const handlePrintMonthlyPDF = () => {
    const monthStr = selectedDate.substring(0, 7);
    const monthSchedules = schedules.filter((s) => s && s.tanggal && typeof s.tanggal === 'string' && s.tanggal.startsWith(monthStr) && (selectedPost === 'all' || s.postId === selectedPost) && (selectedUser === 'all' || s.userId === selectedUser));
    const monthIncidents = incidents.filter((i) => i && i.tanggal && typeof i.tanggal === 'string' && i.tanggal.startsWith(monthStr));
    const monthHandovers = handovers.filter((h) => h && h.tanggal && typeof h.tanggal === 'string' && h.tanggal.startsWith(monthStr));

    exportPicketMonthlyReportPDF(
      school,
      monthStr,
      monthSchedules.length > 0 ? monthSchedules : schedules.filter((s) => s && s.tanggal && typeof s.tanggal === 'string' && s.tanggal.startsWith(monthStr)),
      attendances,
      monthIncidents,
      posts,
      users,
      monthHandovers
    );
  };

  /**
   * Action 2.5: Export Semester Recap PDF
   */
  const handlePrintSemesterPDF = () => {
    exportPicketSemesterReportPDF(
      school,
      schoolYear || { tahunAjaran: '2026/2027', semester: 'Ganjil' },
      filteredSchedules,
      attendances,
      filteredIncidents,
      posts,
      users
    );
  };

  /**
   * Action 3: Export Monthly Picket Logbook (Buku Piket) PDF
   */
  const handlePrintLogbookMonthlyPDF = () => {
    const monthStr = selectedDate.substring(0, 7);
    exportPicketLogbookMonthlyPDF(
      school,
      monthStr,
      logbooks,
      posts,
      users
    );
  };

  /**
   * Universal Smart PDF Print
   */
  const handlePrintPDF = () => {
    if (reportType === 'bulanan') {
      handlePrintMonthlyPDF();
    } else if (reportType === 'semester') {
      handlePrintSemesterPDF();
    } else if (reportType === 'mingguan') {
      handlePrintWeeklyPDF();
    } else {
      handlePrintDailyPDF();
    }
  };

  const handleSaveToOfflineCache = async () => {
    await cacheCurrentReport(reportType, selectedDate);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSyncReportToDrive = async () => {
    if (!isGoogleDriveConnected) {
      alert('Google Drive belum terhubung. Silakan hubungkan akun di menu Pengaturan Sistem terlebih dahulu.');
      return;
    }
    setSyncingDrive(true);
    setDriveSyncSuccess(null);
    haptic.medium();

    try {
      const token = await getDriveAccessToken();
      const reportName = `Laporan_Piket_${reportType}_${selectedDate}.json`;
      const reportContent = JSON.stringify({
        sekolah: school.nama,
        tipe: reportType,
        tanggal: selectedDate,
        totalJadwal: filteredSchedules.length,
        tingkatKedisiplinan: `${disciplineRate}%`,
        jadwal: filteredSchedules,
        kejadian: filteredIncidents,
        timestamp: new Date().toISOString()
      }, null, 2);

      const blob = new Blob([reportContent], { type: 'application/json' });
      const res = await uploadReportDocumentToDrive(
        blob,
        reportName,
        'application/json',
        `Arsip Laporan Piket ${reportType.toUpperCase()} (${selectedDate}) - ${school.nama}`,
        token
      );

      if (res.success) {
        sound.playSuccess();
        triggerConfetti();
        setDriveSyncSuccess(res.message);
        setTimeout(() => setDriveSyncSuccess(null), 5000);
      } else {
        sound.playWarning();
        alert(res.message);
      }
    } catch (e: any) {
      sound.playWarning();
      alert('Terjadi kesalahan saat sinkronisasi laporan ke Google Drive.');
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleExportExcel = () => {
    const dataJadwal = filteredSchedules.map((s, idx) => {
      const att = attendances.find((a) => a.scheduleId === s.id);
      return {
        No: idx + 1,
        Tanggal: s.tanggal,
        Hari: s.hari,
        Pos: s.postName,
        Petugas: s.userName,
        Role: s.userRole,
        JamMulai: s.jamMulai,
        JamSelesai: s.jamSelesai,
        JamCheckIn: att?.checkInAt ? formatTimeIndo(att.checkInAt) : '-',
        JamCheckOut: att?.checkOutAt ? formatTimeIndo(att.checkOutAt) : '-',
        DurasiMenit: att?.durasiMenit || 0,
        Status: s.status
      };
    });

    const dataKejadian = filteredIncidents.map((i, idx) => ({
      No: idx + 1,
      Tanggal: i.tanggal,
      Waktu: i.waktu,
      Lokasi: i.lokasi,
      Kategori: i.kategori,
      Prioritas: i.prioritas,
      Deskripsi: i.deskripsi,
      TindakanAwal: i.tindakanAwal,
      Pelapor: i.createdByUserName,
      Status: i.status
    }));

    exportToExcel(`Laporan_Piket_${reportType}_${selectedDate}`, [
      { name: 'Kehadiran Piket', data: dataJadwal },
      { name: 'Kejadian', data: dataKejadian }
    ]);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Laporan & Rekapitulasi Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Ekspor laporan harian dan rekapitulasi bulanan ke PDF resmi untuk Kepala Sekolah & arsip kedinasan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowOfflineModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Lihat Laporan Tersimpan di IndexedDB"
          >
            <Database className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">Arsip</span> ({cachedReports.length})
          </button>

          <button
            onClick={handleSaveToOfflineCache}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              savedSuccess 
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="Simpan Laporan Ini ke IndexedDB Lokal"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            <span className="hidden md:inline">{savedSuccess ? 'Tersimpan!' : 'Simpan Cache'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel</span>
          </button>

          {/* Tombol Sinkronkan ke Google Drive */}
          {isGoogleDriveConnected && (
            <button
              onClick={handleSyncReportToDrive}
              disabled={syncingDrive}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hover:bg-teal-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Sinkronkan Berkas Laporan ke Folder Google Drive Sekolah"
            >
              <Cloud className={`w-3.5 h-3.5 ${syncingDrive ? 'animate-spin' : ''}`} />
              <span>{syncingDrive ? 'Mengunggah...' : 'Sinkron Drive'}</span>
            </button>
          )}
          
          {/* Tombol Cetak PDF Dinamis Berdasarkan Tipe Laporan */}
          {reportType === 'harian' && (
            <button
              onClick={handlePrintDailyPDF}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
              title="Ekspor Laporan Harian ke Format PDF Resmi"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PDF Harian</span>
            </button>
          )}

          {reportType === 'mingguan' && (
            <button
              onClick={handlePrintWeeklyPDF}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
              title="Ekspor Laporan Mingguan ke Format PDF Resmi"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PDF Mingguan</span>
            </button>
          )}

          {reportType === 'bulanan' && (
            <button
              onClick={handlePrintMonthlyPDF}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/30 transition-all active:scale-95 cursor-pointer"
              title="Ekspor Rekapitulasi Bulanan ke Format PDF Resmi"
            >
              <FileDown className="w-4 h-4 text-amber-200" />
              <span>Cetak PDF Rekap Bulanan</span>
            </button>
          )}

          {reportType === 'semester' && (
            <button
              onClick={handlePrintSemesterPDF}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/30 transition-all active:scale-95 cursor-pointer"
              title="Ekspor Rekapitulasi Semester ke Format PDF Resmi"
            >
              <FileDown className="w-4 h-4 text-white" />
              <span>Cetak PDF Rekap Semester</span>
            </button>
          )}
        </div>
      </div>

      {driveSyncSuccess && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 dark:bg-teal-950/60 dark:border-teal-800 text-xs text-teal-800 dark:text-teal-200 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="font-semibold">{driveSyncSuccess}</span>
        </div>
      )}

      {/* QUICK DOWNLOAD SECTION: ARSIP FISIK SEKOLAH */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg space-y-4 border border-emerald-900/60 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Pusat Cetak & Unduh Arsip Fisik Sekolah</h2>
              <p className="text-xs text-slate-300">Format PDF kedinasan siap cetak & jilid untuk arsip laporan operasional piket</p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/10 text-emerald-300 border border-white/10 self-start sm:self-center">
            Periode: {
              reportType === 'bulanan'
                ? formatMonthYearIndo(selectedDate.substring(0, 7))
                : reportType === 'mingguan'
                ? `${getWeekRange(selectedDate).startFormatted} - ${getWeekRange(selectedDate).endFormatted}`
                : reportType === 'semester'
                ? `${schoolYear?.semester || 'Semester'} TA ${schoolYear?.tahunAjaran || 'Aktif'}`
                : formatDateIndo(selectedDate)
            }
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Buku Piket Bulanan */}
          <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between gap-3 transition-all">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-teal-500/30 text-teal-200">
                  Landscape PDF
                </span>
              </div>
              <h3 className="text-sm font-bold text-white pt-1">Buku Piket Bulanan</h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Logbook lengkap seluruh pos, catatan kondisi, siswa binaan, dan tindak lanjut per pos.
              </p>
            </div>
            <button
              onClick={handlePrintLogbookMonthlyPDF}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Unduh Buku Piket (PDF)</span>
            </button>
          </div>

          {/* Card 2: Rekap Kehadiran Guru Bulanan */}
          <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between gap-3 transition-all">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/30 text-amber-200">
                  Portrait PDF
                </span>
              </div>
              <h3 className="text-sm font-bold text-white pt-1">Rekap Kehadiran Guru</h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Rekapitulasi skor kedisiplinan guru & tendik, persentase kehadiran, dan komparasi pos.
              </p>
            </div>
            <button
              onClick={handlePrintMonthlyPDF}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-amber-200" />
              <span>Unduh Rekap Guru (PDF)</span>
            </button>
          </div>

          {/* Card 3: Laporan Harian Piket */}
          <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between gap-3 transition-all">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200">
                  Harian PDF
                </span>
              </div>
              <h3 className="text-sm font-bold text-white pt-1">Laporan Harian Lengkap</h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Lembar laporan piket resmi harian ({formatDateIndo(selectedDate)}) dengan Kop & pengesahan.
              </p>
            </div>
            <button
              onClick={handlePrintDailyPDF}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 border border-white/15 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Unduh Laporan Harian</span>
            </button>
          </div>

          {/* Card 4: Data Excel Lengkap */}
          <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col justify-between gap-3 transition-all">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
                  <Download className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-500/30 text-cyan-200">
                  Excel (.xlsx)
                </span>
              </div>
              <h3 className="text-sm font-bold text-white pt-1">Rekap Excel Spreadsheet</h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Data mentah multi-sheet jadwal, presensi, jam check-in/out, dan kejadian piket.
              </p>
            </div>
            <button
              onClick={handleExportExcel}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Spreadsheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Controls & Filter Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4 print:hidden">
        
        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          {(['harian', 'bulanan', 'mingguan', 'semester'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                reportType === type
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Laporan {type}
            </button>
          ))}
        </div>

        {/* Filter inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              {reportType === 'bulanan' ? 'Pilih Bulan & Tahun' : 'Pilih Tanggal Laporan'}
            </label>
            <input
              type={reportType === 'bulanan' ? 'month' : 'date'}
              value={reportType === 'bulanan' ? selectedDate.substring(0, 7) : selectedDate}
              onChange={(e) => {
                if (reportType === 'bulanan') {
                  setSelectedDate(`${e.target.value}-01`);
                } else {
                  setSelectedDate(e.target.value);
                }
              }}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Filter Pos Piket</label>
            <select
              value={selectedPost}
              onChange={(e) => setSelectedPost(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Pos Piket</option>
              {posts.map((p) => <option key={p.id} value={p.id}>{p.namaPos}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Filter Petugas</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Petugas</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
            </select>
          </div>
        </div>

        {/* Quick info banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-700 dark:text-slate-300">
              Format Aktif: <strong>{
                reportType === 'bulanan' 
                  ? `Rekapitulasi Bulanan (${formatMonthYearIndo(selectedDate.substring(0, 7))})` 
                  : reportType === 'mingguan'
                  ? `Rekapitulasi Mingguan (${getWeekRange(selectedDate).startFormatted} - ${getWeekRange(selectedDate).endFormatted})`
                  : reportType === 'semester'
                  ? `Rekapitulasi Semester (${schoolYear?.semester || 'Semester'} TA ${schoolYear?.tahunAjaran || 'Aktif'})`
                  : `Laporan Harian (${formatDateIndo(selectedDate)})`
              }</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {reportType === 'bulanan' ? (
              <button
                onClick={handlePrintMonthlyPDF}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <FileDown className="w-3.5 h-3.5 text-amber-200" />
                <span>Unduh PDF Rekap Bulanan</span>
              </button>
            ) : reportType === 'mingguan' ? (
              <button
                onClick={handlePrintWeeklyPDF}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Unduh PDF Laporan Mingguan</span>
              </button>
            ) : reportType === 'semester' ? (
              <button
                onClick={handlePrintSemesterPDF}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Unduh PDF Rekap Semester</span>
              </button>
            ) : (
              <button
                onClick={handlePrintDailyPDF}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Unduh PDF Laporan Harian</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Summary KPI Cards for this Report Range */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Jadwal Tugas</span>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalSchedules}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Sesi piket terdaftar</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Tingkat Kehadiran</span>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{disciplineRate}%</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hadirCount} dari {totalSchedules} bertugas</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Keterlambatan</span>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{terlambatCount}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Check-in lewat batas</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Insiden Kejadian</span>
          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{filteredIncidents.length}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Tercatat di sistem</p>
        </div>

      </div>

      {/* REPORT PREVIEW (KOP SURAT PREVIEW) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-6 sm:p-10 space-y-6 print:block print:w-full print:shadow-none print:border-none print:p-0 print:m-0 print:text-black print:bg-white">
        
        {/* Kop Surat Header */}
        <div className="text-center border-b-2 border-slate-900 dark:border-slate-700 pb-4">
          <h2 className="text-lg font-black tracking-wide text-slate-900 dark:text-white uppercase">
            {school.nama}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {school.alamat}, {school.desaKelurahan}, {school.kecamatan}, {school.kabupaten}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Telp: {school.nomorTelepon} | Email: {school.email} | NPSN: {school.npsn}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
              {reportType === 'bulanan'
                ? 'REKAPITULASI BULANAN e-PIKET GURU & TENAGA KEPENDIDIKAN'
                : reportType === 'mingguan'
                ? 'REKAPITULASI MINGGUAN e-PIKET GURU & TENAGA KEPENDIDIKAN'
                : reportType === 'semester'
                ? 'REKAPITULASI SEMESTER e-PIKET GURU & TENAGA KEPENDIDIKAN'
                : `LAPORAN HARIAN e-PIKET GURU & TENAGA KEPENDIDIKAN`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Periode: {
                reportType === 'bulanan' 
                  ? formatMonthYearIndo(selectedDate.substring(0, 7)) 
                  : reportType === 'mingguan'
                  ? `${getWeekRange(selectedDate).startFormatted} s/d ${getWeekRange(selectedDate).endFormatted}`
                  : reportType === 'semester'
                  ? `${schoolYear?.semester || 'Semester'} TA ${schoolYear?.tahunAjaran || 'Aktif'}`
                  : formatDateIndo(selectedDate)
              }
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => { haptic.medium(); window.print(); }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Dokumen Ini</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: BULANAN (REKAP GURU & KOMPARASI POS) */}
        {reportType === 'bulanan' && (
          <div className="space-y-6">
            
            {/* Table A: Rekap Disiplin Guru Bulanan */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                A. Rekapitulasi Kehadiran & Kedisiplinan Petugas Piket (Guru & Tendik)
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Petugas</th>
                      <th className="py-2.5 px-3">NIP</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Total Jadwal</th>
                      <th className="py-2.5 px-3">Tepat Waktu</th>
                      <th className="py-2.5 px-3">Terlambat</th>
                      <th className="py-2.5 px-3">Kedisiplinan</th>
                      <th className="py-2.5 px-3">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthlyTeacherStats.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400 dark:text-slate-500">Belum ada data jadwal bulan ini.</td>
                      </tr>
                    ) : (
                      monthlyTeacherStats.map((item, idx) => (
                        <tr key={item.user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.user.nama}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.user.nip || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 capitalize">{item.user.role}</td>
                          <td className="py-2.5 px-3 font-bold">{item.total}</td>
                          <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">{item.onTime}</td>
                          <td className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-bold">{item.late}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{item.rate}%</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.rate >= 90 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : item.rate >= 75 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {item.predikat}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table B: Komparasi Pos Piket */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                B. Komparasi & Rekapitulasi Pos Piket Bulanan
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Pos Piket</th>
                      <th className="py-2.5 px-3">Lokasi</th>
                      <th className="py-2.5 px-3">Target Shift</th>
                      <th className="py-2.5 px-3">Total Sesi</th>
                      <th className="py-2.5 px-3">Tepat Waktu</th>
                      <th className="py-2.5 px-3">Terlambat</th>
                      <th className="py-2.5 px-3">Kedisiplinan Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthlyPostStats.map((item, idx) => (
                      <tr key={item.post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.post.namaPos}</td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{item.post.lokasi}</td>
                        <td className="py-2.5 px-3">{item.post.petugasRequiredCount} orang</td>
                        <td className="py-2.5 px-3 font-bold">{item.total}</td>
                        <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">{item.onTime}</td>
                        <td className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-bold">{item.late}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-700 dark:text-teal-400">{item.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table C: Kejadian Bulanan */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                C. Catatan Kejadian & Ketertiban Bulanan ({filteredIncidents.length})
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Tanggal / Waktu</th>
                      <th className="py-2.5 px-3">Lokasi</th>
                      <th className="py-2.5 px-3">Jenis Kejadian</th>
                      <th className="py-2.5 px-3">Prioritas</th>
                      <th className="py-2.5 px-3">Uraian Singkat</th>
                      <th className="py-2.5 px-3">Tindakan / Solusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredIncidents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-400 dark:text-slate-500">Nihil kejadian menonjol selama bulan ini.</td>
                      </tr>
                    ) : (
                      filteredIncidents.map((inc, i) => (
                        <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{formatDateIndo(inc.tanggal)} {inc.waktu}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{inc.lokasi}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{inc.jenisKejadian || inc.kategori}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              {inc.prioritas}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">{inc.deskripsi}</td>
                          <td className="py-2.5 px-3 text-emerald-800 dark:text-emerald-300 font-medium">{inc.tindakanAwal}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: HARIAN */}
        {reportType === 'harian' && (
          <div className="space-y-6">
            
            {/* Attendance Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">A. Daftar Kehadiran Petugas Pos Piket</h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Pos Piket</th>
                      <th className="py-2.5 px-3">Nama Petugas</th>
                      <th className="py-2.5 px-3">Shift Jam</th>
                      <th className="py-2.5 px-3">Check-In</th>
                      <th className="py-2.5 px-3">Check-Out</th>
                      <th className="py-2.5 px-3">Durasi</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSchedules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400 dark:text-slate-500">Tidak ada jadwal pada tanggal ini.</td>
                      </tr>
                    ) : (
                      filteredSchedules.map((sch, i) => {
                        const att = attendances.find((a) => a.scheduleId === sch.id);
                        return (
                          <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{sch.postName}</td>
                            <td className="py-2 px-3 text-emerald-800 dark:text-emerald-400 font-bold">{sch.userName}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{sch.jamMulai} - {sch.jamSelesai}</td>
                            <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{att?.checkInAt ? formatTimeIndo(att.checkInAt) : '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{att?.checkOutAt ? formatTimeIndo(att.checkOutAt) : '-'}</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{att?.durasiMenit ? `${att.durasiMenit} mnt` : '-'}</td>
                            <td className="py-2 px-3 font-bold capitalize text-[11px] text-slate-700 dark:text-slate-300">{sch.status.replace('_', ' ')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Incidents Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">B. Catatan Kejadian & Ketertiban</h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Waktu</th>
                      <th className="py-2.5 px-3">Lokasi</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Uraian Kejadian</th>
                      <th className="py-2.5 px-3">Tindakan Awal</th>
                      <th className="py-2.5 px-3">Pelapor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredIncidents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-400 dark:text-slate-500">Nihil kejadian menonjol.</td>
                      </tr>
                    ) : (
                      filteredIncidents.map((inc, i) => (
                        <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                          <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{inc.waktu}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{inc.lokasi}</td>
                          <td className="py-2 px-3 uppercase text-[10px] font-bold text-slate-600 dark:text-slate-400">{inc.kategori}</td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{inc.deskripsi}</td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{inc.tindakanAwal}</td>
                          <td className="py-2 px-3 text-emerald-800 dark:text-emerald-400 font-medium">{inc.createdByUserName}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* VIEW 3: MINGGUAN */}
        {reportType === 'mingguan' && (
          <div className="space-y-6">
            
            {/* Table A: Kehadiran Mingguan */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                A. Daftar Kehadiran Petugas Pos Piket Mingguan
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Hari</th>
                      <th className="py-2.5 px-3">Pos Piket</th>
                      <th className="py-2.5 px-3">Nama Petugas</th>
                      <th className="py-2.5 px-3">Masuk</th>
                      <th className="py-2.5 px-3">Keluar</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSchedules.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400 dark:text-slate-500">Tidak ada jadwal pada minggu ini.</td>
                      </tr>
                    ) : (
                      filteredSchedules.map((sch, i) => {
                        const att = attendances.find((a) => a.scheduleId === sch.id);
                        return (
                          <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                            <td className="py-2 px-3 font-mono">{sch.tanggal ? formatDateIndo(sch.tanggal) : '-'}</td>
                            <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">{sch.hari}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{sch.postName}</td>
                            <td className="py-2 px-3 text-emerald-800 dark:text-emerald-400 font-bold">{sch.userName}</td>
                            <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{att?.checkInAt ? formatTimeIndo(att.checkInAt) : '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{att?.checkOutAt ? formatTimeIndo(att.checkOutAt) : '-'}</td>
                            <td className="py-2 px-3 font-bold capitalize text-[11px] text-slate-700 dark:text-slate-300">{sch.status.replace('_', ' ')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table B: Catatan Kejadian */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">B. Catatan Kejadian & Ketertiban Mingguan</h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Tanggal / Waktu</th>
                      <th className="py-2.5 px-3">Lokasi</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Uraian Kejadian</th>
                      <th className="py-2.5 px-3">Tindakan Awal</th>
                      <th className="py-2.5 px-3">Pelapor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredIncidents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-slate-400 dark:text-slate-500">Nihil kejadian menonjol minggu ini.</td>
                      </tr>
                    ) : (
                      filteredIncidents.map((inc, i) => (
                        <tr key={inc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                          <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{formatDateIndo(inc.tanggal)} {inc.waktu}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">{inc.lokasi}</td>
                          <td className="py-2 px-3 uppercase text-[10px] font-bold text-slate-600 dark:text-slate-400">{inc.kategori}</td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{inc.deskripsi}</td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{inc.tindakanAwal}</td>
                          <td className="py-2 px-3 text-emerald-800 dark:text-emerald-400 font-medium">{inc.createdByUserName}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* VIEW 4: SEMESTER */}
        {reportType === 'semester' && (
          <div className="space-y-6">
            
            {/* Table A: Rekap Kedisiplinan Guru Semester */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                A. Rekapitulasi Kehadiran & Kedisiplinan Petugas Piket Semester ({schoolYear?.semester || 'Semester'} TA {schoolYear?.tahunAjaran || 'Aktif'})
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Petugas</th>
                      <th className="py-2.5 px-3">NIP</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Total Jadwal</th>
                      <th className="py-2.5 px-3">Tepat Waktu</th>
                      <th className="py-2.5 px-3">Terlambat</th>
                      <th className="py-2.5 px-3">Kedisiplinan</th>
                      <th className="py-2.5 px-3">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {semesterTeacherStats.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400 dark:text-slate-500">Belum ada data jadwal semester ini.</td>
                      </tr>
                    ) : (
                      semesterTeacherStats.map((item, idx) => (
                        <tr key={item.user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.user.nama}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.user.nip || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 capitalize">{item.user.role}</td>
                          <td className="py-2.5 px-3 font-bold">{item.total}</td>
                          <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">{item.onTime}</td>
                          <td className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-bold">{item.late}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{item.rate}%</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.rate >= 90 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                                : item.rate >= 75 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {item.predikat}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table B: Komparasi Pos Piket Semester */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                B. Komparasi & Rekapitulasi Pos Piket Semester
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Nama Pos Piket</th>
                      <th className="py-2.5 px-3">Lokasi</th>
                      <th className="py-2.5 px-3">Target Shift</th>
                      <th className="py-2.5 px-3">Total Sesi</th>
                      <th className="py-2.5 px-3">Tepat Waktu</th>
                      <th className="py-2.5 px-3">Terlambat</th>
                      <th className="py-2.5 px-3">Kedisiplinan Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {semesterPostStats.map((item, idx) => (
                      <tr key={item.post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.post.namaPos}</td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{item.post.lokasi}</td>
                        <td className="py-2.5 px-3">{item.post.petugasRequiredCount} orang</td>
                        <td className="py-2.5 px-3 font-bold">{item.total}</td>
                        <td className="py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-bold">{item.onTime}</td>
                        <td className="py-2.5 px-3 text-amber-700 dark:text-amber-400 font-bold">{item.late}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-700 dark:text-teal-400">{item.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Signatures Preview */}
        <div className="pt-8 grid grid-cols-2 text-xs text-slate-800 dark:text-slate-200">
          <div className="text-left">
            <p>Mengetahui,</p>
            <p className="font-bold mt-1">Kepala Sekolah</p>
            <div className="h-16"></div>
            <p className="font-bold text-slate-900 dark:text-white">{school.kepalaSekolah}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">NIP. {school.nipKepsek || '-'}</p>
          </div>

          <div className="text-right">
            <p>
              {school.kabupaten || 'Jakarta'}, {
                reportType === 'bulanan' 
                  ? formatMonthYearIndo(selectedDate.substring(0, 7)) 
                  : reportType === 'mingguan'
                  ? `${getWeekRange(selectedDate).startFormatted} - ${getWeekRange(selectedDate).endFormatted}`
                  : reportType === 'semester'
                  ? `TA ${schoolYear?.tahunAjaran || 'Aktif'}`
                  : formatDateIndo(selectedDate)
              }
            </p>
            <p className="font-bold mt-1">Koordinator Piket Sekolah</p>
            <div className="h-16"></div>
            <p className="font-bold text-slate-900 dark:text-white">Bambang Hermawan, S.Kom</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">NIP. 19850612 201001 1 012</p>
          </div>
        </div>

      </div>

      {/* OFFLINE INDEXEDDB REPORTS BROWSER MODAL */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Arsip Laporan Offline (IndexedDB)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dapat diakses kapan saja tanpa kuota / koneksi internet</p>
                </div>
              </div>
              <button onClick={() => setShowOfflineModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              {cachedReports.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                  Belum ada laporan yang di-cache di IndexedDB. Gunakan tombol "Simpan Cache" untuk menyimpan.
                </div>
              ) : (
                cachedReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px]">
                          Laporan {rep.type}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">{formatDateIndo(rep.period)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {rep.summary.totalSchedules} Jadwal • Kehadiran: {rep.summary.disciplineRate}% • {rep.summary.incidentCount} Kejadian
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        Disimpan: {new Date(rep.generatedAt).toLocaleString('id-ID')}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedDate(rep.period);
                        setReportType(rep.type as any);
                        setShowOfflineModal(false);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
                    >
                      Buka Laporan
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
