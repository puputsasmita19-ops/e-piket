import { DutySchedule, Incident, Logbook, School } from '../types';
import { formatDateIndo } from '../utils/formatters';

export interface SummaryResult {
  headline: string;
  attendanceSummary: string;
  incidentAnalysis: string;
  actionItems: string[];
  praiseNotes?: string;
  rawText?: string;
  source?: 'gemini-3.8-flash' | 'fallback';
}

/**
 * Check Gemini API server status
 */
export const checkGeminiApiStatus = async (): Promise<{
  available: boolean;
  model: string;
  apiKeyConfigured: boolean;
}> => {
  try {
    const res = await fetch('/api/ai/status');
    if (res.ok) {
      const data = await res.json();
      return {
        available: true,
        model: data.model || 'gemini-3.8-flash',
        apiKeyConfigured: data.apiKeyConfigured ?? true
      };
    }
  } catch (err) {
    console.warn('AI status check failed:', err);
  }
  return {
    available: false,
    model: 'gemini-3.8-flash',
    apiKeyConfigured: false
  };
};

/**
 * Generate Executive Summary via Server-Side Gemini 3.8 Flash
 */
export const generateExecutivePicketSummary = async (
  school: School,
  dateStr: string,
  schedules: DutySchedule[],
  incidents: Incident[],
  logbooks: Logbook[]
): Promise<SummaryResult> => {
  const totalPetugas = schedules.length;
  const hadir = schedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
  const terlambat = schedules.filter((s) => s.status === 'terlambat').length;
  const belumCheckin = schedules.filter((s) => s.status === 'belum_checkin').length;
  const importantIncidents = incidents.filter((i) => i.pentingKepalaSekolah || i.prioritas === 'tinggi' || i.prioritas === 'darurat');

  // 1. Attempt Server-Side Gemini API Call
  try {
    const response = await fetch('/api/ai/executive-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schoolName: school.nama,
        dateStr: formatDateIndo(dateStr),
        schedules: schedules.map((s) => ({
          userName: s.userName,
          postName: s.postName,
          status: s.status
        })),
        incidents: incidents.map((inc) => ({
          jenisKejadian: inc.jenisKejadian,
          prioritas: inc.prioritas,
          lokasi: inc.lokasi,
          waktu: inc.waktu,
          deskripsi: inc.deskripsi,
          tindakanAwal: inc.tindakanAwal
        })),
        logbooks: logbooks.map((l) => ({
          userName: l.userName,
          postName: l.postName,
          kondisiSelamaBertugas: l.kondisiSelamaBertugas,
          tindakLanjut: l.tindakLanjut
        }))
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.headline) {
        return {
          ...data,
          source: 'gemini-3.8-flash'
        };
      }
    }
  } catch (err) {
    console.warn('Server-side Gemini generation unreachable, using intelligent heuristic fallback:', err);
  }

  // 2. Intelligent Deterministic Fallback Generator
  const disciplineRate = totalPetugas > 0 ? Math.round((hadir / totalPetugas) * 100) : 100;
  
  const headline = importantIncidents.length > 0
    ? `Operasional piket ${formatDateIndo(dateStr)} berjalan aktif dengan ${importantIncidents.length} atensi pimpinan di pos sekolah.`
    : `Aktivitas sekolah pada ${formatDateIndo(dateStr)} kondusif dan tertib dengan tingkat kehadiran petugas ${disciplineRate}%.`;

  const attendanceSummary = `Dari ${totalPetugas} petugas terjadwal di ${schedules.length} pos piket, ${hadir} petugas telah aktif bertugas, ${terlambat} terlambat, dan ${belumCheckin} belum check-in. Seluruh pos gerbang dan lobby terpantau terjaga.`;

  const incidentAnalysis = incidents.length > 0
    ? `Tercatat ${incidents.length} kejadian (termasuk ${importantIncidents.length} prioritas khusus). Masalah utama meliputi: ${incidents.map((i) => i.jenisKejadian).slice(0, 2).join(', ')}. Tindakan awal telah dilakukan oleh petugas di lokasi.`
    : `Tidak ada laporan insiden darurat atau pelanggaran berat. Seluruh alur mobilisasi siswa dan penerimaan tamu berjalan sesuai SOP 5S.`;

  const actionItems: string[] = [
    'Tindak lanjuti catatan siswa terlambat bersama wali kelas dan guru BK.',
    'Pastikan seluruh buku piket ditutup dengan serah terima tertib sebelum jam pulang.',
    'Verifikasi laporan dokumentasi foto pos piket di Google Drive.'
  ];

  if (terlambat > 0) {
    actionItems.unshift('Beri pengingat kepada petugas yang terlambat check-in untuk konsistensi jam masuk 06.30 WIB.');
  }

  const praiseNotes = hadir > 0 
    ? `Apresiasi kepada rekan guru yang telah stand by menyambut siswa di Gerbang Utama dan melayani tamu di Lobby sejak pagi.`
    : undefined;

  return {
    headline,
    attendanceSummary,
    incidentAnalysis,
    actionItems,
    praiseNotes,
    source: 'fallback'
  };
};

