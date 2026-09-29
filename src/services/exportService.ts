import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { School, DutySchedule, Attendance, Incident, Logbook, Handover, User, DutyPost } from '../types';
import { formatDateIndo, formatTimeIndo, formatMonthYearIndo } from '../utils/formatters';

export const exportToExcel = (
  filename: string,
  sheets: { name: string; data: any[] }[]
) => {
  const wb = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)); // sheet names max 31 chars
  });

  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Render standard school letterhead (Kop Surat Resmi)
 */
const renderSchoolHeader = (doc: jsPDF, school: School, pageWidth: number): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(school.nama.toUpperCase(), pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(`${school.alamat}, ${school.desaKelurahan}, ${school.kecamatan}, ${school.kabupaten}`, pageWidth / 2, 22, { align: 'center' });
  doc.text(`Telp: ${school.nomorTelepon} | Email: ${school.email} | NPSN: ${school.npsn}`, pageWidth / 2, 27, { align: 'center' });

  // Double Divider Line (Kop Standar Kedinasan)
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.8);
  doc.line(14, 31, pageWidth - 14, 31);
  doc.setLineWidth(0.2);
  doc.line(14, 32.2, pageWidth - 14, 32.2);

  return 36;
};

/**
 * Render standard signature block (Pengesahan Kepala Sekolah & Koordinator Piket)
 */
const renderSignatureBlock = (
  doc: jsPDF, 
  school: School, 
  pageWidth: number, 
  currentY: number, 
  dateLabel: string
) => {
  if (currentY > 230) {
    doc.addPage();
    currentY = 25;
  }

  const sigLeft = 25;
  const sigRight = pageWidth - 70;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('Mengetahui,', sigLeft, currentY);
  doc.text(`${school.kabupaten || 'Sekolah'}, ${dateLabel}`, sigRight, currentY);
  
  doc.text('Kepala Sekolah', sigLeft, currentY + 5);
  doc.text('Koordinator Piket Sekolah', sigRight, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text(school.kepalaSekolah, sigLeft, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${school.nipKepsek || '-'}`, sigLeft, currentY + 33);

  doc.setFont('helvetica', 'bold');
  doc.text('Bambang Hermawan, S.Kom', sigRight, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.text('NIP. 19850612 201001 1 012', sigRight, currentY + 33);
};

/**
 * 1. EKSPOR LAPORAN HARIAN PIKET (PDF)
 */
export const exportPicketDailyReportPDF = (
  school: School,
  dateStr: string,
  schedules: DutySchedule[],
  attendances: Attendance[],
  incidents: Incident[],
  logbooks: Logbook[] = [],
  handovers: Handover[] = []
) => {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let currentY = renderSchoolHeader(doc, school, pageWidth);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('LAPORAN HARIAN e-PIKET GURU & TENAGA KEPENDIDIKAN', pageWidth / 2, currentY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Tanggal Tugas : ${formatDateIndo(dateStr)}`, 14, currentY + 14);
  doc.text(`Dicetak Pada   : ${new Date().toLocaleString('id-ID')}`, 14, currentY + 19);

  // Daily Summary Stats
  const hadirCount = schedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
  const terlambatCount = schedules.filter((s) => s.status === 'terlambat').length;
  const totalCount = schedules.length;
  const disciplineRate = totalCount > 0 ? Math.round((hadirCount / totalCount) * 100) : 100;

  // KPI Summary Strip Box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, currentY + 23, pageWidth - 28, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Ringkasan: Total Terjadwal: ${totalCount} Petugas | Hadir Tepat Waktu: ${hadirCount} | Terlambat: ${terlambatCount} | Kedisiplinan: ${disciplineRate}%`, 18, currentY + 30.5);

  currentY += 40;

  // Table 1: Kehadiran Petugas Piket
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('A. REKAP KEHADIRAN PETUGAS PIKET', 14, currentY);
  currentY += 3;

  const attendanceRows = schedules.map((sch, index) => {
    const att = attendances.find((a) => a.scheduleId === sch.id);
    const checkIn = att?.checkInAt ? formatTimeIndo(att.checkInAt) : '-';
    const checkOut = att?.checkOutAt ? formatTimeIndo(att.checkOutAt) : '-';
    const durasi = att?.durasiMenit ? `${att.durasiMenit} mnt` : '-';
    
    let statusText = 'Belum Hadir';
    if (sch.status === 'sedang_bertugas') statusText = 'Bertugas';
    else if (sch.status === 'sudah_checkout') statusText = 'Selesai';
    else if (sch.status === 'terlambat') statusText = 'Terlambat';
    else if (sch.status === 'digantikan') statusText = `Diganti (${sch.originalUserName || 'Guru'})`;

    return [
      String(index + 1),
      sch.postName || '-',
      sch.userName || '-',
      sch.userRole === 'guru' ? 'Guru' : 'Tendik',
      `${sch.jamMulai} - ${sch.jamSelesai}`,
      checkIn,
      checkOut,
      durasi,
      statusText
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Pos Piket', 'Nama Petugas', 'Role', 'Jam Shift', 'Masuk', 'Keluar', 'Durasi', 'Status']],
    body: attendanceRows.length > 0 ? attendanceRows : [['-', 'Tidak ada jadwal petugas pada tanggal ini', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: Catatan Situasi Buku Piket (Logbook)
  const todayLogs = logbooks.filter((l) => l.tanggal === dateStr);
  if (todayLogs.length > 0) {
    if (currentY > 235) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('B. CATATAN SITUASI & BUKU PIKET HARIAN', 14, currentY);
    currentY += 3;

    const logRows = todayLogs.map((l, index) => [
      String(index + 1),
      l.postName,
      l.userName,
      l.waktu,
      l.kondisiAwal || '-',
      l.kondisiSelamaBertugas || '-',
      l.tindakLanjut || '-'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Pos Piket', 'Petugas', 'Waktu', 'Kondisi Awal', 'Situasi Bertugas', 'Tindak Lanjut']],
      body: logRows,
      theme: 'grid',
      headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Table 3: Catatan Kejadian & Ketertiban
  if (currentY > 235) { doc.addPage(); currentY = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('C. CATATAN KEJADIAN & KETERTIBAN', 14, currentY);
  currentY += 3;

  const incidentRows = incidents.map((inc, index) => [
    String(index + 1),
    inc.waktu || '-',
    inc.lokasi || '-',
    inc.kategori.toUpperCase(),
    inc.deskripsi || '-',
    inc.tindakanAwal || '-',
    inc.status.toUpperCase(),
    inc.createdByUserName || '-'
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Waktu', 'Lokasi', 'Kategori', 'Uraian Kejadian', 'Tindakan Awal', 'Status', 'Pelapor']],
    body: incidentRows.length > 0 ? incidentRows : [['-', '-', '-', '-', 'Kondisi sekolah tertib, nihil kejadian menonjol.', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 4: Catatan Serah Terima Tugas (if any for this date)
  const todayHandovers = handovers.filter((h) => h.tanggal === dateStr);
  if (todayHandovers.length > 0) {
    if (currentY > 235) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('D. CATATAN SERAH TERIMA TUGAS', 14, currentY);
    currentY += 3;

    const handoverRows = todayHandovers.map((h, index) => [
      String(index + 1),
      h.postName,
      `${h.fromUserName} -> ${h.toUserName}`,
      h.waktu,
      h.kondisiPos,
      h.tindakLanjutPending || '-'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Pos', 'Petugas (Dari -> Ke)', 'Waktu', 'Kondisi Pos', 'Catatan Pending']],
      body: handoverRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Signature Block
  renderSignatureBlock(doc, school, pageWidth, currentY + 6, formatDateIndo(dateStr));

  // Save PDF
  doc.save(`Laporan_Harian_ePiket_${school.nama.replace(/\s+/g, '_')}_${dateStr}.pdf`);
};

/**
 * 2. EKSPOR LAPORAN BULANAN / REKAPITULASI BULANAN PIKET (PDF)
 */
export const exportPicketMonthlyReportPDF = (
  school: School,
  monthStr: string, // YYYY-MM
  schedules: DutySchedule[],
  attendances: Attendance[],
  incidents: Incident[],
  posts: DutyPost[],
  users: User[],
  handovers: Handover[] = []
) => {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let currentY = renderSchoolHeader(doc, school, pageWidth);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('LAPORAN REKAPITULASI BULANAN e-PIKET SEKOLAH', pageWidth / 2, currentY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Periode Bulan : ${formatMonthYearIndo(monthStr)}`, 14, currentY + 14);
  doc.text(`Dicetak Pada  : ${new Date().toLocaleString('id-ID')}`, 14, currentY + 19);

  // Filter schedules and incidents strictly for this month
  const monthSchedules = schedules.filter((s) => s && s.tanggal && typeof s.tanggal === 'string' && s.tanggal.startsWith(monthStr));
  const monthIncidents = incidents.filter((i) => i && i.tanggal && typeof i.tanggal === 'string' && i.tanggal.startsWith(monthStr));
  const monthHandovers = handovers.filter((h) => h && h.tanggal && typeof h.tanggal === 'string' && h.tanggal.startsWith(monthStr));

  // Executive Monthly KPIs
  const totalSessions = monthSchedules.length;
  const onTimeCount = monthSchedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
  const lateCount = monthSchedules.filter((s) => s.status === 'terlambat').length;
  const replacedCount = monthSchedules.filter((s) => s.isReplacement || s.status === 'digantikan').length;
  const overallRate = totalSessions > 0 ? Math.round((onTimeCount / totalSessions) * 100) : 100;

  // Monthly KPI Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, currentY + 23, pageWidth - 28, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Sesi Piket: ${totalSessions} | Hadir Tepat Waktu: ${onTimeCount} (${overallRate}%) | Terlambat: ${lateCount} | Izin/Ganti: ${replacedCount} | Kejadian: ${monthIncidents.length}`, 18, currentY + 31.5);

  currentY += 42;

  // Table 1: Rekapitulasi Kinerja & Kedisiplinan Per Guru/Tendik
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('A. REKAPITULASI KEDISIPLINAN PETUGAS PIKET (GURU & TENDIK)', 14, currentY);
  currentY += 3;

  // Aggregate stats per user
  const userStats = users
    .filter((u) => u.role === 'guru' || u.role === 'tendik')
    .map((u) => {
      const userSchs = monthSchedules.filter((s) => s.userId === u.id);
      const total = userSchs.length;
      const onTime = userSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
      const late = userSchs.filter((s) => s.status === 'terlambat').length;
      const replaced = userSchs.filter((s) => s.isReplacement || s.status === 'digantikan').length;
      const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
      
      let predikat = 'Sangat Tertib';
      if (rate < 75) predikat = 'Perlu Pembinaan';
      else if (rate < 90) predikat = 'Tertib';

      return {
        nama: u.nama,
        nip: u.nip || '-',
        role: u.role === 'guru' ? 'Guru' : 'Tendik',
        total,
        onTime,
        late,
        replaced,
        rate,
        predikat
      };
    })
    .filter((u) => u.total > 0 || users.length <= 15); // Show users with tasks or all if small team

  const userRows = userStats.map((item, index) => [
    String(index + 1),
    item.nama,
    item.nip,
    item.role,
    String(item.total),
    String(item.onTime),
    String(item.late),
    String(item.replaced),
    `${item.rate}%`,
    item.predikat
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Nama Petugas', 'NIP', 'Role', 'Jadwal', 'Tepat', 'Lambat', 'Ganti', 'Skor %', 'Predikat']],
    body: userRows.length > 0 ? userRows : [['-', 'Belum ada data jadwal bulan ini', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: Komparasi Kinerja Antar Pos Piket
  if (currentY > 230) { doc.addPage(); currentY = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('B. KOMPARASI & REKAP KINERJA POS PIKET BULANAN', 14, currentY);
  currentY += 3;

  const postRows = posts.map((p, index) => {
    const postSchs = monthSchedules.filter((s) => s.postId === p.id);
    const total = postSchs.length;
    const onTime = postSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
    const late = postSchs.filter((s) => s.status === 'terlambat').length;
    const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;

    return [
      String(index + 1),
      p.namaPos,
      p.lokasi,
      String(p.petugasRequiredCount),
      String(total),
      String(onTime),
      String(late),
      `${rate}%`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Nama Pos Piket', 'Lokasi Pos', 'Target/Shift', 'Total Sesi', 'Tepat Waktu', 'Terlambat', 'Ketertiban Pos']],
    body: postRows,
    theme: 'grid',
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 3: Rekapitulasi Catatan Kejadian & Ketertiban Bulanan
  if (currentY > 230) { doc.addPage(); currentY = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('C. REKAPITULASI CATATAN KEJADIAN & KETERTIBAN BULANAN', 14, currentY);
  currentY += 3;

  const incidentRows = monthIncidents.map((inc, index) => [
    String(index + 1),
    `${formatDateIndo(inc.tanggal)} ${inc.waktu}`,
    inc.lokasi || '-',
    inc.jenisKejadian || inc.kategori.toUpperCase(),
    inc.prioritas.toUpperCase(),
    inc.deskripsi,
    inc.tindakanAwal || '-',
    inc.status.toUpperCase()
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Tgl / Jam', 'Lokasi', 'Kejadian', 'Prioritas', 'Uraian Kejadian', 'Tindakan/Solusi', 'Status']],
    body: incidentRows.length > 0 ? incidentRows : [['-', '-', '-', '-', '-', 'Selama bulan ini nihil insiden/kejadian ketertiban menonjol.', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 4: Catatan Serah Terima Tugas Bulanan (if any)
  if (monthHandovers.length > 0) {
    if (currentY > 230) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('D. REKAP ESTAFET SERAH TERIMA TUGAS BULANAN', 14, currentY);
    currentY += 3;

    const handoverRows = monthHandovers.map((h, index) => [
      String(index + 1),
      formatDateIndo(h.tanggal),
      h.postName,
      `${h.fromUserName} -> ${h.toUserName}`,
      h.waktu,
      h.kondisiPos,
      h.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Tanggal', 'Pos', 'Estafet Petugas', 'Waktu', 'Kondisi Pos', 'Status']],
      body: handoverRows,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Official Signature Block
  renderSignatureBlock(doc, school, pageWidth, currentY + 6, formatMonthYearIndo(monthStr));

  // Save PDF
  doc.save(`Rekap_Bulanan_ePiket_${school.nama.replace(/\s+/g, '_')}_${monthStr}.pdf`);
};

/**
 * 3. EKSPOR LAPORAN BUKU PIKET BULANAN (LOGBOOK POS) (PDF)
 */
export const exportPicketLogbookMonthlyPDF = (
  school: School,
  monthStr: string, // YYYY-MM
  logbooks: Logbook[],
  posts: DutyPost[],
  users: User[]
) => {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let currentY = renderSchoolHeader(doc, school, pageWidth);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('BUKU CATATAN LOGBOOK PIKET SEKOLAH (REKAPITULASI BULANAN)', pageWidth / 2, currentY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Periode Bulan : ${formatMonthYearIndo(monthStr)}`, 14, currentY + 13);
  doc.text(`Dicetak Pada  : ${new Date().toLocaleString('id-ID')}`, 14, currentY + 18);

  // Filter logbooks for month
  const monthLogs = logbooks.filter((l) => l && l.tanggal && typeof l.tanggal === 'string' && l.tanggal.startsWith(monthStr));

  // KPI Summary Strip
  const totalLogs = monthLogs.length;
  const withStudents = monthLogs.filter((l) => {
    if (!l.siswaTerkait) return false;
    if (Array.isArray(l.siswaTerkait)) return l.siswaTerkait.length > 0;
    return String(l.siswaTerkait).trim() !== '';
  }).length;
  const withFollowUp = monthLogs.filter((l) => l.tindakLanjut && l.tindakLanjut.trim() !== '').length;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, currentY + 22, pageWidth - 28, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Arsip Buku Piket: Total ${totalLogs} Catatan Logbook Terdata | ${withStudents} Catatan Siswa | ${withFollowUp} Tindak Lanjut & Solusi Lapangan`,
    18,
    currentY + 29.5
  );

  currentY += 38;

  // Logbook Table
  const logRows = monthLogs.map((l, index) => {
    const studentStr = Array.isArray(l.siswaTerkait) ? l.siswaTerkait.join(', ') : (l.siswaTerkait || '-');
    return [
      String(index + 1),
      formatDateIndo(l.tanggal),
      l.postName,
      l.userName,
      l.kondisiAwal || '-',
      l.kondisiSelamaBertugas || '-',
      studentStr || '-',
      l.tindakLanjut || '-'
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [[
      'No',
      'Tanggal',
      'Pos Piket',
      'Petugas',
      'Kondisi Awal Pos',
      'Situasi & Kejadian Selama Bertugas',
      'Siswa Terkait',
      'Tindak Lanjut / Solusi'
    ]],
    body: logRows.length > 0 ? logRows : [['-', '-', '-', '-', '-', 'Belum ada catatan buku piket pada bulan ini.', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 26 },
      2: { cellWidth: 32 },
      3: { cellWidth: 32 },
      4: { cellWidth: 40 },
      5: { cellWidth: 55 },
      6: { cellWidth: 36 },
      7: { cellWidth: 38 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Signatures
  renderSignatureBlock(doc, school, pageWidth, currentY + 4, formatMonthYearIndo(monthStr));

// Save PDF
  doc.save(`Buku_Piket_Bulanan_${school.nama.replace(/\s+/g, '_')}_${monthStr}.pdf`);
};

/**
 * 4. DOWNLOAD TEMPLATE IMPORT EXCEL
 */
export const downloadUserImportTemplate = () => {
  const sampleData = [
    {
      'Nama Lengkap': 'Budi Santoso, S.Pd',
      'Username': 'budisantoso',
      'Role (guru/tendik/kepsek/admin)': 'guru',
      'NIP': '198501012010011001',
      'NUPTK': '1234567890123456',
      'Jabatan': 'Guru Mata Pelajaran',
      'Unit Kerja': 'Dewan Guru',
      'No WhatsApp': '081234567890',
      'Email': 'budi.santoso@sekolah.id',
      'PIN Masuk (6 Angka)': '123456',
      'Kata Sandi': 'password123',
      'Status Aktif (Aktif/Nonaktif)': 'Aktif'
    },
    {
      'Nama Lengkap': 'Siti Nurhaliza, S.Pd',
      'Username': 'sitinur',
      'Role (guru/tendik/kepsek/admin)': 'guru',
      'NIP': '198804152011012009',
      'NUPTK': '9234857201948271',
      'Jabatan': 'Guru Matematika',
      'Unit Kerja': 'Dewan Guru',
      'No WhatsApp': '081398765432',
      'Email': 'siti.nurhaliza@sekolah.sch.id',
      'PIN Masuk (6 Angka)': '123456',
      'Kata Sandi': 'password123',
      'Status Aktif (Aktif/Nonaktif)': 'Aktif'
    },
    {
      'Nama Lengkap': 'Agus Prabowo, A.Md',
      'Username': 'agus_tu',
      'Role (guru/tendik/kepsek/admin)': 'tendik',
      'NIP': '199203102015021004',
      'NUPTK': '-',
      'Jabatan': 'Staff Tata Usaha & Kepegawaian',
      'Unit Kerja': 'Tata Usaha (TU)',
      'No WhatsApp': '085712349988',
      'Email': 'agus.tu@sekolah.sch.id',
      'PIN Masuk (6 Angka)': '123456',
      'Kata Sandi': 'password123',
      'Status Aktif (Aktif/Nonaktif)': 'Aktif'
    }
  ];

  const petunjukData = [
    { 'KOLOM': 'Nama Lengkap', 'STATUS': 'WAJIB', 'KETERANGAN': 'Nama lengkap guru/tendik beserta gelar akademis' },
    { 'KOLOM': 'Username', 'STATUS': 'OPSIONAL', 'KETERANGAN': 'Username akun untuk login, tanpa spasi huruf kecil (jika kosong, sistem auto buat)' },
    { 'KOLOM': 'Role', 'STATUS': 'WAJIB', 'KETERANGAN': 'Pilihan: guru, tendik, kepsek, atau admin' },
    { 'KOLOM': 'NIP / NUPTK', 'STATUS': 'OPSIONAL', 'KETERANGAN': 'Nomor Identitas Pegawai / NUPTK' },
    { 'KOLOM': 'Jabatan & Unit', 'STATUS': 'OPSIONAL', 'KETERANGAN': 'Jabatan tugas pokok dan unit kerja' },
    { 'KOLOM': 'No WhatsApp', 'STATUS': 'DIANJURKAN', 'KETERANGAN': 'Nomor WA aktif untuk notifikasi penugasan piket' },
    { 'KOLOM': 'Email', 'STATUS': 'OPSIONAL', 'KETERANGAN': 'Email resmi/pribadi (jika kosong, sistem auto buat)' },
    { 'KOLOM': 'PIN Masuk', 'STATUS': 'OPSIONAL', 'KETERANGAN': 'PIN 6 angka login cepat (Default: 123456)' },
    { 'KOLOM': 'Kata Sandi', 'STATUS': 'OPSIONAL', 'KETERANGAN': 'Kata sandi akun (Default: password123)' },
    { 'KOLOM': 'Status Aktif', 'STATUS': 'OPSIONAL', 'KETERANGAN': 'Aktif atau Nonaktif (Default: Aktif)' }
  ];

  exportToExcel('Template_Import_Pengguna_Guru', [
    { name: 'Data Pengguna', data: sampleData },
    { name: 'Petunjuk Pengisian', data: petunjukData }
  ]);
};

export const downloadPostImportTemplate = () => {
  const sampleData = [
    {
      'Nama Pos': 'Pos 1: Gerbang Utama',
      'Lokasi': 'Pintu Gerbang Depan',
      'Jumlah Petugas Wajib': 2,
      'Deskripsi Tugas': 'Sambut kedatangan siswa, cek kerapian atribut, pantau tamu masuk'
    },
    {
      'Nama Pos': 'Pos 2: Lobby & Resepsionis',
      'Lokasi': 'Gedung A Lantai 1',
      'Jumlah Petugas Wajib': 1,
      'Deskripsi Tugas': 'Pelayanan buku tamu, pantau perizinan keluar masuk siswa'
    },
    {
      'Nama Pos': 'Pos 3: Area Kantin & Lapangan',
      'Lokasi': 'Plaza Tengah & Kantin Sehat',
      'Jumlah Petugas Wajib': 1,
      'Deskripsi Tugas': 'Monitoring ketertiban istirahat, cegah perundungan dan sampah sembarangan'
    }
  ];

  exportToExcel('Template_Import_Pos_Piket', [
    { name: 'Data Pos Piket', data: sampleData }
  ]);
};

export const downloadShiftImportTemplate = () => {
  const sampleData = [
    {
      'Nama Shift': 'Piket Pagi (Sambut Siswa)',
      'Jam Mulai': '06:30',
      'Jam Selesai': '10:00',
      'Keterangan': 'Piket penyambutan dan pengawasan jam belajar pagi'
    },
    {
      'Nama Shift': 'Piket Siang (Istirahat & KBM 2)',
      'Jam Mulai': '10:00',
      'Jam Selesai': '13:30',
      'Keterangan': 'Pengawasan istirahat salat zuhur dan lingkungan belajar'
    },
    {
      'Nama Shift': 'Piket Sore (Kepulangan Siswa)',
      'Jam Mulai': '13:30',
      'Jam Selesai': '16:00',
      'Keterangan': 'Pengawasan jam pulang sekolah dan penutupan gerbang'
    }
  ];

  exportToExcel('Template_Import_Shift_Piket', [
    { name: 'Data Shift Piket', data: sampleData }
  ]);
};

export const exportImportErrorLog = (
  category: string,
  errors: { rowNumber: number; identifier: string; field: string; rejectedValue?: string; errorMessage: string; critical: boolean }[]
) => {
  const data = errors.map((err, idx) => ({
    'No': idx + 1,
    'No Baris File': err.rowNumber,
    'Identitas Baris': err.identifier,
    'Kolom Bermasalah': err.field,
    'Nilai yang Ditolak': err.rejectedValue || '-',
    'Tingkat Keparahan': err.critical ? 'KRITIKAL (Menyebabkan Rollback)' : 'PERINGATAN',
    'Pesan Kesalahan': err.errorMessage,
    'Waktu Analisis': new Date().toLocaleString('id-ID')
  }));

  exportToExcel(`Log_Error_Import_${category}_${Date.now()}`, [
    { name: 'Log Kesalahan Import', data }
  ]);
};


/**
 * 2.5. EKSPOR LAPORAN MINGGUAN PIKET (PDF)
 */
export const exportPicketWeeklyReportPDF = (
  school: School,
  weekStartStr: string,
  weekEndStr: string,
  schedules: DutySchedule[],
  attendances: Attendance[],
  incidents: Incident[]
) => {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let currentY = renderSchoolHeader(doc, school, pageWidth);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('LAPORAN MINGGUAN e-PIKET GURU & TENAGA KEPENDIDIKAN', pageWidth / 2, currentY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Periode Minggu : ${formatDateIndo(weekStartStr)} s/d ${formatDateIndo(weekEndStr)}`, 14, currentY + 14);
  doc.text(`Dicetak Pada   : ${new Date().toLocaleString('id-ID')}`, 14, currentY + 19);

  // Weekly Summary Stats
  const hadirCount = schedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
  const terlambatCount = schedules.filter((s) => s.status === 'terlambat').length;
  const totalCount = schedules.length;
  const disciplineRate = totalCount > 0 ? Math.round((hadirCount / totalCount) * 100) : 100;

  // KPI Summary Strip Box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, currentY + 23, pageWidth - 28, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Ringkasan: Total Terjadwal: ${totalCount} | Tepat Waktu: ${hadirCount} | Terlambat: ${terlambatCount} | Kedisiplinan: ${disciplineRate}%`, 18, currentY + 30.5);

  currentY += 40;

  // Table 1: Kehadiran Petugas Piket
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('A. REKAP KEHADIRAN PETUGAS PIKET MINGGUAN', 14, currentY);
  currentY += 3;

  const attendanceRows = schedules.map((sch, index) => {
    const att = attendances.find((a) => a.scheduleId === sch.id);
    const checkIn = att?.checkInAt ? formatTimeIndo(att.checkInAt) : '-';
    const checkOut = att?.checkOutAt ? formatTimeIndo(att.checkOutAt) : '-';
    const durasi = att?.durasiMenit ? `${att.durasiMenit} mnt` : '-';
    
    let statusText = 'Belum Hadir';
    if (sch.status === 'sedang_bertugas') statusText = 'Bertugas';
    else if (sch.status === 'sudah_checkout') statusText = 'Selesai';
    else if (sch.status === 'terlambat') statusText = 'Terlambat';
    else if (sch.status === 'digantikan') statusText = `Diganti (${sch.originalUserName || 'Guru'})`;

    return [
      String(index + 1),
      sch.tanggal ? formatDateIndo(sch.tanggal) : '-',
      sch.hari || '-',
      sch.postName || '-',
      sch.userName || '-',
      checkIn,
      checkOut,
      statusText
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Tanggal', 'Hari', 'Pos Piket', 'Nama Petugas', 'Masuk', 'Keluar', 'Status']],
    body: attendanceRows.length > 0 ? attendanceRows : [['-', '-', '-', '-', 'Tidak ada jadwal petugas pada minggu ini', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: Catatan Kejadian
  if (currentY > 235) { doc.addPage(); currentY = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('B. CATATAN KEJADIAN & KETERTIBAN MINGGUAN', 14, currentY);
  currentY += 3;

  const incidentRows = incidents.map((inc, index) => [
    String(index + 1),
    inc.tanggal ? formatDateIndo(inc.tanggal) : '-',
    inc.waktu || '-',
    inc.lokasi || '-',
    inc.jenisKejadian || inc.kategori.toUpperCase(),
    inc.deskripsi || '-',
    inc.tindakanAwal || '-',
    inc.status.toUpperCase()
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Tanggal', 'Waktu', 'Lokasi', 'Kejadian', 'Uraian Kejadian', 'Tindakan Awal', 'Status']],
    body: incidentRows.length > 0 ? incidentRows : [['-', '-', '-', '-', 'Minggu ini nihil kejadian ketertiban menonjol.', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Signature Block
  renderSignatureBlock(doc, school, pageWidth, currentY + 6, `${formatDateIndo(weekStartStr)} - ${formatDateIndo(weekEndStr)}`);

  // Save PDF
  doc.save(`Laporan_Mingguan_ePiket_${school.nama.replace(/\s+/g, '_')}_${weekStartStr}_${weekEndStr}.pdf`);
};

/**
 * 2.6. EKSPOR LAPORAN REKAPITULASI SEMESTER PIKET (PDF)
 */
export const exportPicketSemesterReportPDF = (
  school: School,
  schoolYear: { tahunAjaran: string; semester: 'Ganjil' | 'Genap' },
  schedules: DutySchedule[],
  attendances: Attendance[],
  incidents: Incident[],
  posts: DutyPost[],
  users: User[]
) => {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  let currentY = renderSchoolHeader(doc, school, pageWidth);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('LAPORAN REKAPITULASI SEMESTER e-PIKET GURU & TENDIK', pageWidth / 2, currentY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Tahun Ajaran : ${schoolYear.tahunAjaran} | Semester : ${schoolYear.semester}`, 14, currentY + 14);
  doc.text(`Dicetak Pada : ${new Date().toLocaleString('id-ID')}`, 14, currentY + 19);

  // Summary Stats
  const totalSessions = schedules.length;
  const onTimeCount = schedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
  const lateCount = schedules.filter((s) => s.status === 'terlambat').length;
  const overallRate = totalSessions > 0 ? Math.round((onTimeCount / totalSessions) * 100) : 100;

  // KPI Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, currentY + 23, pageWidth - 28, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Sesi Piket Semester: ${totalSessions} | Hadir Tepat Waktu: ${onTimeCount} (${overallRate}%) | Terlambat: ${lateCount} | Kejadian: ${incidents.length}`, 18, currentY + 31.5);

  currentY += 42;

  // Table 1: Rekapitulasi Kedisiplinan Petugas Piket
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('A. REKAPITULASI KEDISIPLINAN PETUGAS PIKET (GURU & TENDIK)', 14, currentY);
  currentY += 3;

  // Aggregate stats per user over semester
  const userStats = users
    .filter((u) => u.role === 'guru' || u.role === 'tendik')
    .map((u) => {
      const userSchs = schedules.filter((s) => s.userId === u.id);
      const total = userSchs.length;
      const onTime = userSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
      const late = userSchs.filter((s) => s.status === 'terlambat').length;
      const replaced = userSchs.filter((s) => s.isReplacement || s.status === 'digantikan').length;
      const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;
      
      let predikat = 'Sangat Tertib';
      if (rate < 75) predikat = 'Perlu Pembinaan';
      else if (rate < 90) predikat = 'Tertib';

      return {
        nama: u.nama,
        nip: u.nip || '-',
        role: u.role === 'guru' ? 'Guru' : 'Tendik',
        total,
        onTime,
        late,
        replaced,
        rate,
        predikat
      };
    })
    .filter((u) => u.total > 0 || users.length <= 15);

  const userRows = userStats.map((item, index) => [
    String(index + 1),
    item.nama,
    item.nip,
    item.role,
    String(item.total),
    String(item.onTime),
    String(item.late),
    String(item.replaced),
    `${item.rate}%`,
    item.predikat
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Nama Petugas', 'NIP', 'Role', 'Jadwal', 'Tepat', 'Lambat', 'Ganti', 'Skor %', 'Predikat']],
    body: userRows.length > 0 ? userRows : [['-', 'Belum ada data jadwal semester ini', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: Komparasi Kinerja Antar Pos Piket
  if (currentY > 230) { doc.addPage(); currentY = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('B. KOMPARASI & REKAP KINERJA POS PIKET SEMESTER', 14, currentY);
  currentY += 3;

  const postRows = posts.map((p, index) => {
    const postSchs = schedules.filter((s) => s.postId === p.id);
    const total = postSchs.length;
    const onTime = postSchs.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
    const late = postSchs.filter((s) => s.status === 'terlambat').length;
    const rate = total > 0 ? Math.round((onTime / total) * 100) : 100;

    return [
      String(index + 1),
      p.namaPos,
      p.lokasi,
      String(p.petugasRequiredCount),
      String(total),
      String(onTime),
      String(late),
      `${rate}%`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Nama Pos Piket', 'Lokasi Pos', 'Target/Shift', 'Total Sesi', 'Tepat Waktu', 'Terlambat', 'Ketertiban Pos']],
    body: postRows,
    theme: 'grid',
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Signature Block
  renderSignatureBlock(doc, school, pageWidth, currentY + 6, `Semester ${schoolYear.semester} TA ${schoolYear.tahunAjaran}`);

  // Save PDF
  doc.save(`Rekap_Semester_ePiket_${school.nama.replace(/\s+/g, '_')}_${schoolYear.tahunAjaran.replace('/', '_')}_${schoolYear.semester}.pdf`);
};




