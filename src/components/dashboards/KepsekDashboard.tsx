import React, { useState } from 'react';
import { ShieldCheck, Zap, FileDown, AlertTriangle, CheckCircle2, Clock, XCircle, Eye, HardDrive, Users, MessageSquareQuote, Calendar } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo, formatTimeIndo, getPriorityBadge } from '../../utils/formatters';
import { exportPicketDailyReportPDF, exportPicketMonthlyReportPDF, exportToExcel } from '../../services/exportService';
import { AttendanceTrendChart } from '../analytics/AttendanceTrendChart';
import { RunningText } from '../common/RunningText';
import { PiketInstanWidget } from '../common/PiketInstanWidget';

interface KepsekDashboardProps {
  setActiveTab: (tab: string) => void;
  onOpenAISummary: () => void;
}

export const KepsekDashboard: React.FC<KepsekDashboardProps> = ({ setActiveTab, onOpenAISummary }) => {
  const { school, posts, users, schedules, attendances, incidents, logbooks, handovers, updateIncident } = useData();
  const [selectedIncidentNote, setSelectedIncidentNote] = useState<{ id: string; note: string } | null>(null);

  const today = getTodayDateString();
  const dayName = getDayNameIndo(today);
  const todaySchedules = schedules.filter((s) => s.tanggal === today);

  const hadirCount = todaySchedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
  const terlambatCount = todaySchedules.filter((s) => s.status === 'terlambat').length;
  const belumHadirCount = todaySchedules.filter((s) => s.status === 'belum_checkin' || s.status === 'belum_piket').length;
  const totalPetugas = todaySchedules.length;

  const disciplineRate = totalPetugas > 0 ? Math.round((hadirCount / totalPetugas) * 100) : 100;
  const urgentIncidents = incidents.filter((i) => i.pentingKepalaSekolah || i.prioritas === 'darurat' || i.prioritas === 'tinggi');

  const handleExportDailyPDF = () => {
    exportPicketDailyReportPDF(school, today, todaySchedules, attendances, incidents, logbooks, handovers);
  };

  const handleExportMonthlyPDF = () => {
    const currentMonth = today.substring(0, 7);
    exportPicketMonthlyReportPDF(
      school,
      currentMonth,
      schedules,
      attendances,
      incidents,
      posts,
      users,
      handovers
    );
  };

  const handleExportExcel = () => {
    const dataJadwal = todaySchedules.map((s, idx) => ({
      No: idx + 1,
      Tanggal: s.tanggal,
      Pos: s.postName,
      Petugas: s.userName,
      Role: s.userRole,
      Shift: s.shiftName,
      Jam: `${s.jamMulai} - ${s.jamSelesai}`,
      Status: s.status
    }));

    const dataKejadian = incidents.map((i, idx) => ({
      No: idx + 1,
      Tanggal: i.tanggal,
      Waktu: i.waktu,
      Lokasi: i.lokasi,
      Kategori: i.kategori,
      Prioritas: i.prioritas,
      Deskripsi: i.deskripsi,
      TindakanAwal: i.tindakanAwal,
      Status: i.status,
      Pelapor: i.createdByUserName
    }));

    exportToExcel(`Rekap_Piket_${today}`, [
      { name: 'Jadwal & Kehadiran', data: dataJadwal },
      { name: 'Kejadian', data: dataKejadian }
    ]);
  };

  const handleSaveIncidentNote = async (id: string) => {
    if (!selectedIncidentNote) return;
    await updateIncident(id, { catatanPimpinan: selectedIncidentNote.note });
    setSelectedIncidentNote(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Principal Executive Top Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 p-4 sm:p-6 lg:p-8 text-white shadow-xl border border-emerald-900/60">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] sm:text-xs font-semibold mb-1.5 sm:mb-2 border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Monitoring Real-Time Kepala Sekolah</span>
            </div>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
              Dashboard Monitoring Piket Sekolah
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200 mt-0.5 sm:mt-1">
              {school.nama} • {dayName}, {formatDateIndo(today)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <button
              onClick={onOpenAISummary}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>AI Ringkasan</span>
            </button>
            <button
              onClick={handleExportDailyPDF}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs shadow-md transition-all active:scale-95 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Unduh Laporan Harian Hari Ini dalam Format PDF"
            >
              <FileDown className="w-4 h-4 text-rose-600" />
              <span>PDF Harian</span>
            </button>
            <button
              onClick={handleExportMonthlyPDF}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/30 transition-all active:scale-95 cursor-pointer"
              title="Unduh Rekapitulasi Bulan Ini dalam Format PDF"
            >
              <FileDown className="w-4 h-4 text-amber-200" />
              <span>PDF Rekap Bulanan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Presence Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Petugas Hadir</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{hadirCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {totalPetugas}</span></h3>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${disciplineRate}%` }}></div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Terlambat</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{terlambatCount}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Check-in lewat batas waktu</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Belum Check-In</span>
            <XCircle className="w-5 h-5 text-rose-500" />
          </div>
          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">{belumHadirCount}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Perlu atensi / follow-up</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Kedisiplinan</span>
            <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{disciplineRate}%</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Skor ketertiban hari ini</p>
        </div>

      </div>

      {/* RECHARTS ATTENDANCE TREND & PUNCTUALITY ANALYTICS FOR KEPSEK */}
      <AttendanceTrendChart
        schedules={schedules}
        attendances={attendances}
        posts={posts}
        incidents={incidents}
        logbooks={logbooks}
        users={users}
        title="Evaluasi Kedisiplinan & Statistik Operasional Piket"
        subtitle="Analisis kehadiran guru per bulan, jumlah kejadian harian, ringkasan buku piket, dan komparasi ketertiban pos"
        variant="kepsek"
      />

      {/* Urgent Incident Alerts (Penting untuk Kepala Sekolah) */}
      {urgentIncidents.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/40 rounded-3xl border border-rose-200 dark:border-rose-900/60 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Laporan Kejadian Penting Memerlukan Perhatian Pimpinan ({urgentIncidents.length})
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300">Diteruskan secara otomatis dari petugas pos lapangan</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('kejadian')}
              className="text-xs font-bold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 underline cursor-pointer"
            >
              Buka Semua Kejadian →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentIncidents.map((inc) => (
              <div key={inc.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${getPriorityBadge(inc.prioritas)}`}>
                    {inc.prioritas.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {inc.waktu} WIB • {inc.lokasi}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{inc.jenisKejadian}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{inc.deskripsi}</p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-50/70 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <strong>Tindakan Awal:</strong> {inc.tindakanAwal}
                </p>

                {inc.catatanPimpinan ? (
                  <div className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 p-2 rounded-xl border border-amber-200 dark:border-amber-800">
                    <strong>Catatan Kepala Sekolah:</strong> {inc.catatanPimpinan}
                  </div>
                ) : (
                  <div>
                    {selectedIncidentNote?.id === inc.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={selectedIncidentNote.note}
                          onChange={(e) => setSelectedIncidentNote({ id: inc.id, note: e.target.value })}
                          placeholder="Tulis arahan / disposisi kepala sekolah..."
                          className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveIncidentNote(inc.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
                          >
                            Simpan Arahan
                          </button>
                          <button
                            onClick={() => setSelectedIncidentNote(null)}
                            className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-xs cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedIncidentNote({ id: inc.id, note: '' })}
                        className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold flex items-center gap-1 mt-1 cursor-pointer"
                      >
                        <MessageSquareQuote className="w-3.5 h-3.5" />
                        <span>Beri Arahan Pimpinan</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POS PIKET STATUS BOARD */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Status Seluruh Pos Piket Hari Ini</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Kondisi operasional dan daftar nama petugas yang stand by</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => {
            const postSchedules = todaySchedules.filter((s) => s.postId === post.id);
            const isAnyActive = postSchedules.some((s) => s.status === 'sedang_bertugas');
            const isAnyLate = postSchedules.some((s) => s.status === 'terlambat');
            const isAllFinished = postSchedules.length > 0 && postSchedules.every((s) => s.status === 'sudah_checkout');

            let borderTheme = 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/60';
            let statusBadge = (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Belum Dimulai
              </span>
            );

            if (isAnyActive) {
              borderTheme = 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-500/20';
              statusBadge = (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Aktif Terjaga
                </span>
              );
            } else if (isAnyLate) {
              borderTheme = 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20';
              statusBadge = (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Terlambat
                </span>
              );
            } else if (isAllFinished) {
              borderTheme = 'border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20';
              statusBadge = (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  Selesai Shift
                </span>
              );
            }

            return (
              <div key={post.id} className={`p-5 rounded-2xl border ${borderTheme} flex flex-col justify-between transition-colors`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">{post.namaPos}</h3>
                    {statusBadge}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{post.lokasi}</p>

                  <div className="space-y-2">
                    {postSchedules.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">Belum ada petugas terjadwal.</p>
                    ) : (
                      postSchedules.map((sch) => {
                        const att = attendances.find((a) => a.scheduleId === sch.id);
                        return (
                          <div key={sch.id} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <div className="flex items-center justify-between gap-1">
                              <RunningText
                                text={sch.userName}
                                maxLength={16}
                                className="text-xs font-bold text-slate-800 dark:text-slate-200"
                              />
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{sch.shiftName}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              <span>{sch.jamMulai} - {sch.jamSelesai}</span>
                              {att?.checkInAt ? (
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
                                  In: {formatTimeIndo(att.checkInAt).split(' ')[0]}
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">Belum Check-In</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Petugas Wajib: {post.petugasRequiredCount} orang</span>
                  <button
                    onClick={() => setActiveTab('buku-piket')}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 font-bold cursor-pointer"
                  >
                    Buku Piket →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
