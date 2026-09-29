export type UserRole = 'admin' | 'guru' | 'tendik' | 'kepsek';

export type IncidentCategory = 
  | 'kedisiplinan' 
  | 'kehadiran' 
  | 'keamanan' 
  | 'kebersihan' 
  | 'siswa_sakit' 
  | 'konflik_siswa' 
  | 'fasilitas' 
  | 'tamu' 
  | 'lainnya';

export type IncidentPriority = 'rendah' | 'sedang' | 'tinggi' | 'darurat';

export type IncidentStatus = 'informasi' | 'dipantau' | 'ditindaklanjuti' | 'selesai';

export type ScheduleStatus = 
  | 'belum_piket' 
  | 'belum_checkin' 
  | 'hadir' 
  | 'sedang_bertugas' 
  | 'terlambat' 
  | 'sudah_checkout' 
  | 'digantikan' 
  | 'dibatalkan';

export type HandoverStatus = 'menunggu' | 'diserahkan' | 'diterima';

export interface User {
  id: string;
  username?: string;
  pin?: string; // 6-digit PIN numeric login (e.g. "123456")
  password?: string; // Custom password
  firebaseUid?: string;
  nama: string;
  email: string;
  nomorHP: string;
  role: UserRole;
  nip?: string;
  nuptk?: string;
  jabatan: string;
  unitKerja?: string;
  foto?: string;
  statusAktif: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface School {
  id: string;
  npsn: string;
  nama: string;
  alamat: string;
  desaKelurahan: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  email: string;
  nomorTelepon: string;
  logo: string;
  kepalaSekolah: string;
  nipKepsek: string;
  jamOperasionalMulai: string;
  jamOperasionalSelesai: string;
  toleransiKeterlambatanMenit: number; // e.g. 15 mins
  latitude?: number;
  longitude?: number;
  radiusPresensiMeter?: number;
  isGpsLocked?: boolean;
  gpsLockedAt?: string;
  gpsLockedBy?: string;
  gpsAutoDetectedAt?: string;
  gpsAccuracyMeters?: number;
  aktif: boolean;
}

export interface DutyPost {
  id: string;
  namaPos: string;
  lokasi: string;
  deskripsi: string;
  petugasRequiredCount: number;
  statusAktif: boolean;
  iconName?: string;
}

export interface Shift {
  id: string;
  namaShift: string;
  jamMulai: string; // e.g. "06:30"
  jamSelesai: string; // e.g. "10:00"
  keterangan?: string;
  statusAktif: boolean;
}

export interface SchoolYear {
  id: string;
  tahunAjaran: string; // e.g. "2026/2027"
  semester: 'Ganjil' | 'Genap';
  statusAktif: boolean;
}

export interface DutySchedule {
  id: string;
  schoolYearId: string;
  tanggal: string; // YYYY-MM-DD
  hari: string; // 'Senin', 'Selasa', dst
  shiftId: string;
  shiftName?: string;
  jamMulai?: string;
  jamSelesai?: string;
  postId: string;
  postName?: string;
  userId: string;
  userName?: string;
  userRole?: UserRole;
  status: ScheduleStatus;
  isReplacement?: boolean;
  originalUserId?: string;
  originalUserName?: string;
  replacementReason?: string;
  notes?: string;
  attendanceId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Attendance {
  id: string;
  scheduleId: string;
  userId: string;
  userName: string;
  postId: string;
  postName: string;
  tanggal: string; // YYYY-MM-DD
  checkInAt: string; // ISO string
  checkOutAt?: string; // ISO string
  durasiMenit?: number;
  isLate: boolean;
  lateMinutes?: number;
  status: 'sedang_bertugas' | 'selesai';
  deviceInfo?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
    address?: string;
    distanceMeters?: number;
    isWithinRadius?: boolean;
  };
  fotoCheckIn?: string;
  fotoCheckOut?: string;
  biometricVerified?: boolean;
  biometricVerifiedAt?: string;
  biometricType?: string;
  checkInNotes?: string;
  checkOutNotes?: string;
  createdAt: string;
}

export interface Logbook {
  id: string;
  scheduleId?: string;
  attendanceId?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  postId: string;
  postName: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
  kondisiAwal: string;
  kondisiSelamaBertugas: string;
  catatanKhusus?: string;
  siswaTerkait?: string[];
  tindakLanjut?: string;
  status: 'draft' | 'terkirim' | 'diverifikasi';
  fotoDokumentasi?: AttachmentMeta[];
  createdAt: string;
  updatedAt?: string;
}

export interface Incident {
  id: string;
  scheduleId?: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
  lokasi: string;
  kategori: IncidentCategory;
  jenisKejadian: string;
  prioritas: IncidentPriority;
  deskripsi: string;
  pihakTerlibat?: string;
  siswaTerkait?: string;
  tindakanAwal: string;
  rekomendasiTindakLanjut?: string;
  status: IncidentStatus;
  pentingKepalaSekolah: boolean;
  createdByUserId: string;
  createdByUserName: string;
  fotoDokumentasi?: AttachmentMeta[];
  catatanPimpinan?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Handover {
  id: string;
  scheduleId: string;
  postId: string;
  postName: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  kondisiPos: string;
  kejadianBerlangsung?: string;
  siswaPerhatian?: string;
  tindakLanjutPending?: string;
  catatanTambahan?: string;
  status: HandoverStatus;
  acknowledgedAt?: string;
  acknowledgementNotes?: string;
  createdAt: string;
}

export interface DutyReplacement {
  id: string;
  scheduleId: string;
  tanggal: string;
  postId: string;
  postName: string;
  originalUserId: string;
  originalUserName: string;
  replacementUserId: string;
  replacementUserName: string;
  alasan: string;
  assignedByUserId: string;
  assignedByUserName: string;
  createdAt: string;
}

export interface AttachmentMeta {
  id: string;
  driveFileId: string;
  fileName: string;
  folderPath: string;
  mimeType: string;
  size: number;
  driveUrl: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  entityType: 'incident' | 'logbook' | 'profile' | 'report' | 'general';
  entityId?: string;
  isUploadedToDrive?: boolean;
}

export interface CachedIncidentPhoto {
  id: string; // photo ID or driveFileId
  incidentId?: string;
  driveFileId?: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string; // base64 / blob URL for offline rendering
  thumbnailUrl?: string;
  cachedAt: string;
  lastAccessedAt: string;
  isOfflineReady: boolean;
}

export interface IncidentPhotoCacheConfig {
  autoCacheOnUpload: boolean;
  autoPreloadIncidentPhotos: boolean;
  maxCacheSizeMb: number;
  offlineImageQuality: 'high' | 'medium' | 'compressed';
  maxRetentionDays: number;
  lastOptimizedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId?: string; // target user or undefined for all
  roleTarget?: UserRole | 'all';
  type: 'jadwal_hari_ini' | 'jadwal_besok' | 'terlambat' | 'penggantian' | 'serah_terima' | 'kejadian_penting' | 'sistem';
  title: string;
  message: string;
  linkUrl?: string;
  read: boolean;
  createdAt: string;
  whatsappSent?: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  recordId?: string;
  details: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  deviceInfo?: string;
  timestamp: string;
}

export interface GoogleDriveConfig {
  isConnected: boolean;
  rootFolderId: string;
  rootFolderName: string;
  accountEmail: string;
  lastSyncAt: string;
  folderHierarchyTemplate: string;
  autoSyncEnabled: boolean;
}

export interface WhatsAppConfig {
  isEnabled: boolean;
  apiKey: string;
  gatewayProvider: string;
  senderNumber: string;
  reminderPagiTime: string; // e.g. "06:00"
  reminderMalamTime: string; // e.g. "20:00"
  templatePagi: string;
  templatePenggantian: string;
  templateKejadianPenting: string;
}

export interface AppBrandingConfig {
  namaAplikasi: string;
  keterangan: string;
  logoUrl?: string;
  namaPembuat: string;
  copyrightYear?: string;
}

export interface SystemSettings {
  appBranding?: AppBrandingConfig;
  school: School;
  googleDrive: GoogleDriveConfig;
  whatsApp: WhatsAppConfig;
  allowGpsRadiusCheck: boolean;
  gpsRadiusMeters: number;
  schoolLatitude: number;
  schoolLongitude: number;
  isGpsLocked?: boolean;
  gpsLockedAt?: string;
  gpsLockedBy?: string;
  gpsAutoDetectedAt?: string;
  gpsAccuracyMeters?: number;
  requirePhotoOnLogbook: boolean;
  autoPushNotificationIntervalMinutes?: number; // 5, 10, 15, or 0 (Off)
}

export interface ImportErrorItem {
  rowNumber: number;
  identifier: string;
  field: string;
  rejectedValue?: string;
  errorMessage: string;
  critical: boolean;
}

export interface SystemSnapshot {
  id: string;
  title: string;
  createdAt: string;
  type: 'daily_auto' | 'manual_admin' | 'pre_restore_safety';
  createdBy?: string;
  checksum?: string;
  notes?: string;
  summary: {
    totalUsers: number;
    totalPosts: number;
    totalShifts: number;
    totalSchedules: number;
    totalAttendances: number;
    totalLogbooks: number;
    totalIncidents: number;
    totalHandovers: number;
    totalReplacements?: number;
    schoolName: string;
  };
  data: {
    school: School;
    systemSettings?: SystemSettings;
    users: User[];
    posts: DutyPost[];
    shifts: Shift[];
    schoolYear?: SchoolYear;
    schedules: DutySchedule[];
    attendances: Attendance[];
    logbooks: Logbook[];
    incidents: Incident[];
    handovers: Handover[];
    replacements?: DutyReplacement[];
  };
}

export interface RestoreOptions {
  restoreUsers?: boolean;
  restorePosts?: boolean;
  restoreShifts?: boolean;
  restoreSchedules?: boolean;
  restoreAttendances?: boolean;
  restoreLogbooks?: boolean;
  restoreIncidents?: boolean;
  restoreHandovers?: boolean;
  restoreSchoolAndSettings?: boolean;
  createPreRestoreSafetySnapshot?: boolean;
}

export interface PanicModeRestoreResult {
  success: boolean;
  snapshotId: string;
  timestamp: string;
  restoredEntities: {
    users: number;
    posts: number;
    shifts: number;
    schedules: number;
    attendances: number;
    logbooks: number;
    incidents: number;
    handovers: number;
  };
  safetyBackupId?: string;
  message: string;
}

export interface BatchImportResult {
  success: boolean;
  isAtomic: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportErrorItem[];
  message: string;
}

