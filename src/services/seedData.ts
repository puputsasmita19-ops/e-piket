import { 
  User, 
  School, 
  DutyPost, 
  Shift, 
  SchoolYear, 
  DutySchedule, 
  Attendance, 
  Logbook, 
  Incident, 
  Handover, 
  DutyReplacement,
  NotificationItem, 
  AuditLog, 
  SystemSettings 
} from '../types';

export const INITIAL_SCHOOL: School = {
  id: 'sch-001',
  npsn: '20104589',
  nama: 'SMP Negeri 1 Nusantara',
  alamat: 'Jl. Merdeka Pendidikan No. 45',
  desaKelurahan: 'Gunung',
  kecamatan: 'Kebayoran Baru',
  kabupaten: 'Jakarta Selatan',
  provinsi: 'DKI Jakarta',
  email: 'info@sekolah.sch.id',
  nomorTelepon: '(021) 7204589',
  logo: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=150&auto=format&fit=crop&q=80',
  kepalaSekolah: 'Dr. H. Ahmad Dahlan, M.Pd.',
  nipKepsek: '19720315 199802 1 004',
  jamOperasionalMulai: '06:30',
  jamOperasionalSelesai: '16:30',
  toleransiKeterlambatanMenit: 15,
  latitude: -6.229746,
  longitude: 106.807493,
  radiusPresensiMeter: 250,
  aktif: true
};

// Baseline Official Personnel (Admin & Kepsek). User accounts can be added or imported cleanly by the school.
export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'admin',
    pin: '123456',
    password: 'password123',
    nama: 'Administrator e-Piket',
    email: 'admin@sekolah.sch.id',
    nomorHP: '081234567801',
    role: 'admin',
    nip: '19850612 201001 1 012',
    nuptk: '4536763665200002',
    jabatan: 'Koordinator IT & Administrator Sistem',
    unitKerja: 'Tata Usaha / IT',
    statusAktif: true
  },
  {
    id: 'user-kepsek',
    username: 'kepsek',
    pin: '123456',
    password: 'password123',
    nama: 'Dr. H. Ahmad Dahlan, M.Pd.',
    email: 'kepsek@sekolah.sch.id',
    nomorHP: '081234567802',
    role: 'kepsek',
    nip: '19720315 199802 1 004',
    nuptk: '1238750652200013',
    jabatan: 'Kepala Sekolah',
    unitKerja: 'Pimpinan Sekolah',
    statusAktif: true
  }
];

export const INITIAL_POSTS: DutyPost[] = [
  {
    id: 'post-gerbang',
    namaPos: 'Pos 1: Gerbang Utama',
    lokasi: 'Pintu Gerbang Depan Sekolah',
    deskripsi: 'Menyambut siswa, 5S (Senyum, Salam, Sapa, Sopan, Santun), memantau kerapian seragam dan ketertiban penyeberangan.',
    petugasRequiredCount: 2,
    statusAktif: true,
    iconName: 'DoorOpen'
  },
  {
    id: 'post-lobby',
    namaPos: 'Pos 2: Lobby & Resepsionis',
    lokasi: 'Gedung Utama Lantai 1',
    deskripsi: 'Menerima tamu sekolah, buku tamu kedinasan/wali murid, surat izin masuk/keluar siswa.',
    petugasRequiredCount: 1,
    statusAktif: true,
    iconName: 'Building2'
  },
  {
    id: 'post-lapangan',
    namaPos: 'Pos 3: Lapangan & Koridor',
    lokasi: 'Area Lapangan Upacara & Selasar Kelas',
    deskripsi: 'Memantau mobilitas siswa saat pergantian jam dan istirahat, ketertiban koridor ruang kelas.',
    petugasRequiredCount: 1,
    statusAktif: true,
    iconName: 'Flag'
  },
  {
    id: 'post-kantin',
    namaPos: 'Pos 4: Kantin & Area Belakang',
    lokasi: 'Kantin Sekolah & Taman Belakang',
    deskripsi: 'Memantau ketertiban dan kebersihan kantin, memastikan siswa tidak keluar batas area sekolah saat istirahat.',
    petugasRequiredCount: 1,
    statusAktif: true,
    iconName: 'Utensils'
  },
  {
    id: 'post-perpustakaan',
    namaPos: 'Pos 5: Perpustakaan & Laboratorium',
    lokasi: 'Gedung Sayap Timur',
    deskripsi: 'Memastikan ketertiban ruang perpustakaan dan laboratorium selama jam belajar mengajar.',
    petugasRequiredCount: 1,
    statusAktif: true,
    iconName: 'BookOpen'
  }
];

export const INITIAL_SHIFTS: Shift[] = [
  {
    id: 'shift-pagi',
    namaShift: 'Piket Pagi (Sambut Siswa & Sesi 1)',
    jamMulai: '06:30',
    jamSelesai: '10:00',
    keterangan: 'Penyambutan siswa di gerbang, doa bersama pagi, apel, dan KBM sesi pertama.',
    statusAktif: true
  },
  {
    id: 'shift-siang',
    namaShift: 'Piket Siang (Istirahat & Sesi 2)',
    jamMulai: '10:00',
    jamSelesai: '14:00',
    keterangan: 'Pengawasan jam istirahat pertama/kedua, sholat dhuhur berjamaah, dan KBM sesi siang.',
    statusAktif: true
  },
  {
    id: 'shift-sore',
    namaShift: 'Piket Sore (Kepulangan Siswa & Ekskul)',
    jamMulai: '14:00',
    jamSelesai: '16:30',
    keterangan: 'Pengawasan kepulangan siswa, kegiatan ekstrakurikuler, dan penutupan sarana sekolah.',
    statusAktif: true
  }
];

export const INITIAL_SCHOOL_YEAR: SchoolYear = {
  id: 'sy-2026-ganjil',
  tahunAjaran: '2026/2027',
  semester: 'Ganjil',
  statusAktif: true
};

export const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDayNameIndo = (dateStr: string) => {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const date = new Date(dateStr);
  return days[date.getDay()];
};

// CLEAN PRODUCTION COMMERCIAL STATE (No Mock Demo Schedules or Dummy Logs)
export const INITIAL_SCHEDULES: DutySchedule[] = [];
export const INITIAL_ATTENDANCES: Attendance[] = [];
export const INITIAL_LOGBOOKS: Logbook[] = [];
export const INITIAL_INCIDENTS: Incident[] = [];
export const INITIAL_HANDOVERS: Handover[] = [];
export const INITIAL_REPLACEMENTS: DutyReplacement[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  appBranding: {
    namaAplikasi: 'e-Piket Digital',
    keterangan: 'Sistem Pengelolaan Jadwal Piket Guru & Buku Piket Digital Sekolah',
    logoUrl: '',
    namaPembuat: 'Puput Sasmita & Tim IT Sekolah',
    copyrightYear: '2026'
  },
  school: INITIAL_SCHOOL,
  googleDrive: {
    isConnected: false,
    rootFolderId: '18lJTqdfpB0NtY23aaxoAvq84GiTcCksQ',
    rootFolderName: 'EPiket_Sekolah_Drive',
    accountEmail: '',
    lastSyncAt: '',
    folderHierarchyTemplate: '/EPiket/{SchoolName}/{AcademicYear}/{Semester}/{Year}/{Month}/{Date}/{PostName}',
    autoSyncEnabled: true
  },
  whatsApp: {
    isEnabled: true,
    apiKey: '',
    gatewayProvider: 'Fonnte',
    senderNumber: '',
    reminderPagiTime: '06:00',
    reminderMalamTime: '20:00',
    templatePagi: 'Halo {NamaGuru}, Anda memiliki jadwal piket hari ini pada {Shift} di {PosPiket}. Mohon hadir tepat waktu dan lakukan presensi melalui e-Piket.',
    templatePenggantian: 'Halo {NamaGuru}, Anda ditugaskan menggantikan {NamaGuruAsal} pada {Tanggal} di {PosPiket}. Alasan: {Alasan}',
    templateKejadianPenting: '[PERINGATAN PIKET] Laporan kejadian penting: {JenisKejadian} di {Lokasi} ({Waktu} WIB).'
  },
  allowGpsRadiusCheck: true,
  gpsRadiusMeters: 250,
  schoolLatitude: -6.229746,
  schoolLongitude: 106.807493,
  requirePhotoOnLogbook: true,
  autoPushNotificationIntervalMinutes: 15
};
