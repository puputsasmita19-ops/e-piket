import React, { useState, useEffect } from 'react';
import { Settings, HardDrive, MapPin, ShieldCheck, Clock, Smartphone, Save, CheckCircle2, RefreshCw, Database, Cloud, Zap, ExternalLink, AlertCircle, Check, Flame, Bot, FolderSync, Sun, Moon, Palette, Eye, School as SchoolIcon, Upload, User, Users, Image as ImageIcon, Lock, ShieldAlert, Sliders, Volume2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useHaptic } from '../../hooks/useHaptic';
import { HapticIntensity } from '../../utils/feedback';
import { checkGeminiApiStatus, generateExecutivePicketSummary } from '../../services/aiService';
import { antiFraudService } from '../../services/antiFraudService';
import { IncidentPhotoCacheModal } from '../common/IncidentPhotoCacheModal';
import { SchoolGpsConfigPanel } from '../admin/SchoolGpsConfigPanel';
import { incidentPhotoCache } from '../../services/incidentPhotoCacheService';
import { 
  autoSyncDatabaseToDrive, 
  listDrivePicketFiles, 
  setupAutomaticCommercialFolderStructure, 
  CommercialFolderStructureResult 
} from '../../services/driveService';
import { extractDriveFolderId } from '../../services/googleDriveService';
import { showSuccessToast } from '../../utils/toast';
import { AdminPanicModeModal } from '../modals/AdminPanicModeModal';

export const PengaturanSistem: React.FC = () => {
  const { isHapticEnabled, hapticIntensity, setHapticIntensity, toggleHaptic, haptic } = useHaptic();
  const { 
    school, 
    systemSettings, 
    updateSystemSettings, 
    updateSchool, 
    resetToDemoData,
    isFirestoreConnected,
    firestoreStatusMessage,
    syncAllDataToFirestore,
    syncInitialMasterDataToFirestore,
    checkCloudStatus,
    users,
    schedules,
    incidents,
    logbooks
  } = useData();

  const { 
    isGoogleDriveConnected, 
    googleDriveUser, 
    connectGoogleDrive, 
    disconnectGoogleDrive,
    getDriveAccessToken
  } = useAuth();

  const { theme, setTheme, isDarkMode, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({
    ...systemSettings,
    school: {
      ...school,
      ...(systemSettings.school || {})
    },
    appBranding: {
      namaAplikasi: systemSettings.appBranding?.namaAplikasi || 'e-Piket Digital',
      keterangan: systemSettings.appBranding?.keterangan || 'Sistem Pengelolaan Jadwal Piket Guru & Buku Piket Digital Sekolah',
      logoUrl: systemSettings.appBranding?.logoUrl || '',
      namaPembuat: systemSettings.appBranding?.namaPembuat || 'Puput Sasmita & Tim IT Sekolah',
      copyrightYear: systemSettings.appBranding?.copyrightYear || '2026'
    },
    schoolLatitude: school.latitude || systemSettings.schoolLatitude || -6.229746,
    schoolLongitude: school.longitude || systemSettings.schoolLongitude || 106.807493,
    gpsRadiusMeters: school.radiusPresensiMeter || systemSettings.gpsRadiusMeters || 250
  });

  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'identitas_aplikasi' | 'cloud_storage' | 'gemini_ai' | 'tema_tampilan' | 'operasional_gps'>(() => {
    try {
      const savedTab = localStorage.getItem('e_piket_pengaturan_tab');
      if (savedTab && ['identitas_aplikasi', 'cloud_storage', 'gemini_ai', 'tema_tampilan', 'operasional_gps'].includes(savedTab)) {
        return savedTab as any;
      }
    } catch (e) {}
    return 'identitas_aplikasi';
  });

  useEffect(() => {
    try {
      localStorage.setItem('e_piket_pengaturan_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);

  // Firebase testing state
  const [testingFirebase, setTestingFirebase] = useState(false);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Google Drive state
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [driveMessage, setDriveMessage] = useState<string | null>(null);

  // Gemini state
  const [geminiStatus, setGeminiStatus] = useState<{ available: boolean; model: string; apiKeyConfigured: boolean } | null>(null);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);

  // Photo Cache state
  const [showPhotoCacheModal, setShowPhotoCacheModal] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState<boolean>(false);
  const [photoCacheStats, setPhotoCacheStats] = useState<{
    totalCachedPhotos: number;
    totalSizeBytes: number;
    formattedSize: string;
    offlineReadyPercentage: number;
  }>({
    totalCachedPhotos: 0,
    totalSizeBytes: 0,
    formattedSize: '0 KB',
    offlineReadyPercentage: 0
  });

  const refreshCacheStats = () => {
    incidentPhotoCache.getCacheStats(incidents).then(setPhotoCacheStats).catch(console.warn);
  };

  useEffect(() => {
    refreshCacheStats();
  }, [incidents]);

  useEffect(() => {
    checkGeminiApiStatus().then(setGeminiStatus).catch(console.warn);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData({
            ...formData,
            appBranding: {
              ...formData.appBranding,
              logoUrl: event.target.result as string
            }
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedDriveFolderId = extractDriveFolderId(formData.googleDrive.rootFolderId);
    const cleanedSettings = {
      ...formData,
      googleDrive: {
        ...formData.googleDrive,
        rootFolderId: sanitizedDriveFolderId
      },
      school: {
        ...formData.school,
        latitude: formData.schoolLatitude,
        longitude: formData.schoolLongitude,
        radiusPresensiMeter: formData.gpsRadiusMeters
      }
    };
    setFormData(cleanedSettings);
    await updateSystemSettings(cleanedSettings);
    await updateSchool({
      ...formData.school,
      latitude: formData.schoolLatitude,
      longitude: formData.schoolLongitude,
      radiusPresensiMeter: formData.gpsRadiusMeters,
      toleransiKeterlambatanMenit: formData.school.toleransiKeterlambatanMenit || school.toleransiKeterlambatanMenit
    });
    setSaved(true);
    showSuccessToast('Pengaturan sistem dan identitas sekolah berhasil disimpan!');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestFirebase = async () => {
    setTestingFirebase(true);
    setSyncResult(null);
    await checkCloudStatus();
    setTestingFirebase(false);
  };

  const handleSyncAllToFirestore = async () => {
    setSyncingFirestore(true);
    setSyncResult(null);
    const res = await syncAllDataToFirestore();
    setSyncResult(res.message);
    if (res.success) {
      showSuccessToast(res.message);
    }
    setSyncingFirestore(false);
  };

  const handleSyncInitialMasterToFirestore = async () => {
    setSyncingFirestore(true);
    setSyncResult(null);
    const res = await syncInitialMasterDataToFirestore();
    setSyncResult(res.message);
    if (res.success) {
      showSuccessToast(res.message);
    }
    setSyncingFirestore(false);
  };

  const handleTestGemini = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await generateExecutivePicketSummary(school, today, schedules, incidents, logbooks);
      setAiTestResult(`[${res.source === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : 'Fallback Engine'}] ${res.headline}`);
    } catch (err: any) {
      setAiTestResult(`Gagal memanggil AI: ${err.message}`);
    } finally {
      setTestingAi(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl text-slate-900 dark:text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Sistem & Konfigurasi Aplikasi</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
              Konfigurasi Lengkap
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Atur identitas & profil resmi sekolah, nama aplikasi, nama pembuat, logo, tema gelap/terang, Firebase, Google Drive, dan GPS.
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Pengaturan Berhasil Disimpan</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('identitas_aplikasi')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'identitas_aplikasi'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <SchoolIcon className="w-4 h-4" />
          <span>Identitas Sekolah & Aplikasi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tema_tampilan')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tema_tampilan'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Tema & Tampilan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cloud_storage')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'cloud_storage'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Firebase & Google Drive</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gemini_ai')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'gemini_ai'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>Gemini AI (3.8 Flash)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operasional_gps')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'operasional_gps'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Operasional & Keamanan</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* ========================================================= */}
        {/* TAB 1: IDENTITAS & PROFIL SEKOLAH / BRANDING APLIKASI     */}
        {/* ========================================================= */}
        {activeTab === 'identitas_aplikasi' && (
          <div className="space-y-6 animate-in fade-in">
            
            {/* Card 1: Identitas Resmi Sekolah */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <SchoolIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Profil & Identitas Resmi Sekolah
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Nama sekolah ini otomatis tampil di seluruh dashboard, kop surat resmi laporan PDF, arsip Excel, dan watermark presensi piket.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid Form Profil Sekolah */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                {/* Nama Resmi Sekolah */}
                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Nama Resmi Sekolah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.school.nama}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, nama: e.target.value }
                      })
                    }
                    placeholder="Contoh: SMA Negeri 1 Teladan Jakarta"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Nama institusi pendidikan yang akan tercetak di seluruh dokumen resmi kedinasan.
                  </span>
                </div>

                {/* NPSN */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    NPSN (Nomor Pokok Sekolah Nasional)
                  </label>
                  <input
                    type="text"
                    value={formData.school.npsn || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, npsn: e.target.value }
                      })
                    }
                    placeholder="Contoh: 20101234"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                {/* Nomor Telepon / Kontak */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Nomor Telepon / Hotline Sekolah
                  </label>
                  <input
                    type="text"
                    value={formData.school.nomorTelepon || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, nomorTelepon: e.target.value }
                      })
                    }
                    placeholder="Contoh: (021) 7201234 / 0812-3456-7890"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Nama Kepala Sekolah */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Nama Kepala Sekolah (Lengkap dengan Gelar)
                  </label>
                  <input
                    type="text"
                    value={formData.school.kepalaSekolah || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, kepalaSekolah: e.target.value }
                      })
                    }
                    placeholder="Contoh: Dr. Hj. Nurjanah, M.Pd."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Penandatangan lembar pengesahan pada laporan rekapitulasi piket.
                  </span>
                </div>

                {/* NIP Kepala Sekolah */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    NIP Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={formData.school.nipKepsek || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, nipKepsek: e.target.value }
                      })
                    }
                    placeholder="Contoh: 19720415 199802 2 001"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                {/* Email Sekolah */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Email Resmi Sekolah
                  </label>
                  <input
                    type="email"
                    value={formData.school.email || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, email: e.target.value }
                      })
                    }
                    placeholder="Contoh: info@sman1teladan.sch.id"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                {/* Alamat Lengkap */}
                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Alamat Lengkap Jalan / Gedung Sekolah
                  </label>
                  <input
                    type="text"
                    value={formData.school.alamat || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, alamat: e.target.value }
                      })
                    }
                    placeholder="Contoh: Jl. Pendidikan No. 45, Kebayoran Baru"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Kelurahan, Kecamatan, Kota/Kab, Provinsi */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Kelurahan / Desa
                  </label>
                  <input
                    type="text"
                    value={formData.school.desaKelurahan || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, desaKelurahan: e.target.value }
                      })
                    }
                    placeholder="Contoh: Senayan"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    value={formData.school.kecamatan || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, kecamatan: e.target.value }
                      })
                    }
                    placeholder="Contoh: Kebayoran Baru"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Kabupaten / Kota
                  </label>
                  <input
                    type="text"
                    value={formData.school.kabupaten || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, kabupaten: e.target.value }
                      })
                    }
                    placeholder="Contoh: Jakarta Selatan"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Provinsi
                  </label>
                  <input
                    type="text"
                    value={formData.school.provinsi || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, provinsi: e.target.value }
                      })
                    }
                    placeholder="Contoh: DKI Jakarta"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

              </div>
            </div>

            {/* Card 2: Identitas & Branding Aplikasi */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Identitas Aplikasi, Logo & Nama Pembuat
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pengaturan merek sistem, judul aplikasi, kredit pengembang, dan logo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Fields Branding */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                {/* Nama Aplikasi */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Nama Aplikasi / Sistem
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.appBranding.namaAplikasi}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appBranding: { ...formData.appBranding, namaAplikasi: e.target.value }
                      })
                    }
                    placeholder="Contoh: e-Piket Digital"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Nama utama sistem yang tertera di header dan login.
                  </span>
                </div>

                {/* Nama Pembuat / Tim Pengembang */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Nama Pembuat / Pengembang
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.appBranding.namaPembuat}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appBranding: { ...formData.appBranding, namaPembuat: e.target.value }
                      })
                    }
                    placeholder="Contoh: Puput Sasmita & Tim IT Sekolah"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Kredit pengembang di bagian footer halaman dan dokumen.
                  </span>
                </div>

                {/* Keterangan Aplikasi */}
                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Keterangan / Slogan Aplikasi
                  </label>
                  <input
                    type="text"
                    value={formData.appBranding.keterangan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appBranding: { ...formData.appBranding, keterangan: e.target.value }
                      })
                    }
                    placeholder="Contoh: Sistem Pengelolaan Jadwal Piket Guru & Buku Piket Digital Sekolah"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Deskripsi singkat yang tampil di bawah judul aplikasi.
                  </span>
                </div>

                {/* Logo URL & File Upload */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300">
                    Logo Sekolah & Aplikasi
                  </label>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Live Logo Preview Box */}
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      {formData.appBranding.logoUrl ? (
                        <img 
                          src={formData.appBranding.logoUrl} 
                          alt="Preview Logo" 
                          className="w-12 h-12 object-contain rounded-xl"
                        />
                      ) : (
                        <SchoolIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex items-center gap-2">
                        <label className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 cursor-pointer transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Pilih Berkas Gambar (PNG/JPG)</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleLogoUpload} 
                            className="hidden" 
                          />
                        </label>

                        {formData.appBranding.logoUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                appBranding: { ...formData.appBranding, logoUrl: '' }
                              })
                            }
                            className="px-3 py-2 text-rose-600 hover:text-rose-700 dark:text-rose-400 text-xs font-semibold cursor-pointer"
                          >
                            Hapus Logo Kustom
                          </button>
                        )}
                      </div>

                      <input
                        type="url"
                        value={formData.appBranding.logoUrl}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            appBranding: { ...formData.appBranding, logoUrl: e.target.value }
                          })
                        }
                        placeholder="Atau masukkan URL Logo (https://...)"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Tahun Hak Cipta */}
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Tahun Hak Cipta
                  </label>
                  <input
                    type="text"
                    value={formData.appBranding.copyrightYear || '2026'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        appBranding: { ...formData.appBranding, copyrightYear: e.target.value }
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

              </div>
            </div>

            {/* Live Preview Card: Kop Surat & Header */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Pratinjau Langsung (Kop Surat Laporan & Header Aplikasi)
                </h4>
              </div>

              {/* Mock Kop Surat Resmi */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-black tracking-wide text-slate-900 dark:text-white uppercase">
                    {formData.school.nama || 'NAMA SEKOLAH BELUM DIISI'}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {formData.school.alamat || 'Alamat Sekolah'}, {formData.school.desaKelurahan || '-'}, {formData.school.kecamatan || '-'}, {formData.school.kabupaten || '-'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Telp: {formData.school.nomorTelepon || '-'} | Email: {formData.school.email || '-'} | NPSN: {formData.school.npsn || '-'}
                  </p>
                </div>
                {/* Official Double Border Line */}
                <div className="space-y-0.5 pt-1">
                  <div className="h-0.5 bg-slate-800 dark:bg-slate-300 w-full rounded-full"></div>
                  <div className="h-px bg-slate-400 dark:bg-slate-500 w-full"></div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 gap-2">
                  <span>Kepala Sekolah: <strong>{formData.school.kepalaSekolah || '-'}</strong> (NIP. {formData.school.nipKepsek || '-'})</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                    Kop Standar PDF Resmi
                  </span>
                </div>
              </div>

              {/* Mock Header Preview */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold">
                    {formData.appBranding.logoUrl ? (
                      <img src={formData.appBranding.logoUrl} alt="Logo" className="w-6 h-6 object-contain rounded-md" />
                    ) : (
                      <SchoolIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                      {formData.appBranding.namaAplikasi || 'e-Piket Digital'}
                    </h5>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      {formData.school.nama || 'Nama Sekolah'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  © {formData.appBranding.copyrightYear || '2026'} {formData.appBranding.namaPembuat || 'Pembuat'}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: TEMA & TAMPILAN (MODE GELAP / TERANG PASTEL)       */}
        {/* ========================================================= */}
        {activeTab === 'tema_tampilan' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5 transition-colors">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Pengaturan Tema & Kontras Tampilan</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {isDarkMode ? 'Mode Gelap Aktif' : 'Mode Terang Pastel Aktif'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pilih tema tampilan aplikasi. Dirancang dengan kontras tinggi agar semua teks selalu terbaca jelas.
                  </p>
                </div>
              </div>

              {/* Theme Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Light Pastel Option */}
                <div
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    theme === 'light'
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-200/50 dark:border-emerald-400 dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-900 dark:text-white block">Mode Terang (Pastel Modern)</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Nuansa lembut emerald & teal</span>
                      </div>
                    </div>
                    {theme === 'light' && (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                    Palet elegan dan ramah mata dengan kontras teks tajam (charcoal slate) yang nyaman saat jam dinas pagi hingga siang hari.
                  </p>

                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-white text-[11px] font-semibold flex items-center justify-between shadow-xs">
                    <span>Pratinjau Teks: Terbaca Jelas & Kontras</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">Aktif</span>
                  </div>
                </div>

                {/* Dark Obsidian Option */}
                <div
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    theme === 'dark'
                      ? 'border-emerald-500 bg-slate-900 shadow-md shadow-slate-950/60 dark:border-emerald-400 dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-900/5 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-900/50 text-emerald-300">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-900 dark:text-white block">Mode Gelap (Obsidian Dark)</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Deep slate dengan aksen emerald</span>
                      </div>
                    </div>
                    {theme === 'dark' && (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                    Latar belakang hitam-slate mewah dengan tulisan putih terang dan aksen emerald lembut yang nyaman digunakan malam hari.
                  </p>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-[11px] font-semibold flex items-center justify-between shadow-xs">
                    <span>Pratinjau Teks: Terang & Tidak Silau</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">Aktif</span>
                  </div>
                </div>
              </div>

              {/* Instant Toggle Button for Theme */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Ganti Cepat Mode Tema</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Anda juga dapat mengganti tema kapan saja melalui tombol ikon matahari/bulan di bilah navigasi atas atau halaman login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-emerald-100" />}
                  <span>{isDarkMode ? 'Beralih ke Terang' : 'Beralih ke Gelap'}</span>
                </button>
              </div>

              {/* Dedicated Haptic Feedback Setting Panel */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${isHapticEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Pengaturan Umpan Balik Taktil & Bunyi Aksi</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isHapticEnabled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {isHapticEnabled ? 'Aktif' : 'Muted'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Sakelar utama getaran single pulse dan efek bunyi akustik saat berinteraksi dengan aplikasi.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleHaptic}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm transition active:scale-95 cursor-pointer ${
                        isHapticEnabled
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {isHapticEnabled ? 'Getar & Bunyi: ON' : 'Getar & Bunyi: OFF'}
                    </button>
                  </div>
                </div>

                {isHapticEnabled && (
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Kekuatan Getar Single Pulse:</span>
                      </span>

                      <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-900/60 p-1 rounded-xl">
                        {(['sedang', 'kuat', 'ekstra'] as HapticIntensity[]).map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setHapticIntensity(level)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${
                              hapticIntensity === level
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {level === 'sedang' ? 'Sedang' : level === 'kuat' ? 'Kuat 🔥' : 'Ekstra Kuat ⚡'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => haptic.light()}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition cursor-pointer"
                      >
                        Uji Single Pulse (Ringan)
                      </button>
                      <button
                        type="button"
                        onClick={() => haptic.medium()}
                        className="px-3 py-1.5 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 text-xs font-bold hover:bg-teal-200 transition cursor-pointer"
                      >
                        Uji Single Pulse (Sedang)
                      </button>
                      <button
                        type="button"
                        onClick={() => haptic.heavy()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition cursor-pointer"
                      >
                        Uji Single Pulse (Maksimal) ⚡
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: CLOUD STORAGE (FIREBASE & GOOGLE DRIVE)            */}
        {/* ========================================================= */}
        {activeTab === 'cloud_storage' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Card: Firebase Firestore Storage */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Penyimpanan Cloud Firebase Firestore</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isFirestoreConnected 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {isFirestoreConnected ? '● Online & Aktif' : '● Tersambung (Offline Cache)'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Basis data cloud multi-perangkat tersinkronisasi otomatis dengan aturan keamanan firestore.rules.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestFirebase}
                  disabled={testingFirebase}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingFirebase ? 'animate-spin' : ''}`} />
                  <span>Cek Koneksi</span>
                </button>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Database Cloud ID</span>
                  <p className="font-mono text-slate-900 dark:text-slate-100 font-bold break-all">
                    ai-studio-336ecc13-2c88-4579-80d0-9b4b604d0208
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status Koneksi</span>
                  <p className="font-sans text-slate-800 dark:text-slate-200 font-medium">
                    {firestoreStatusMessage}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Master Pengguna Aktif</span>
                  <p className="font-sans text-emerald-700 dark:text-emerald-400 font-bold">
                    {users.length} Akun Terdaftar ({users.filter(u => u.role === 'admin' || u.role === 'kepsek').length} Administrator & Pimpinan)
                  </p>
                </div>
              </div>

              {/* Realtime Live Sync Status Banner */}
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <span>Sinkronisasi Otomatis Realtime Aktif</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono font-bold">
                        LIVE ON-SNAPSHOT
                      </span>
                    </h4>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Setiap penambahan, pengubahan, atau penghapusan data (pengguna, jadwal, absensi, logbook) langsung tersimpan dan terbaca secara realtime ke seluruh perangkat secara otomatis tanpa perlu sinkron manual.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Realtime Cloud Siap</span>
                  </span>
                </div>
              </div>

              {/* Admin Panic Mode & Disaster Recovery Snapshot Card */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-950/20 via-amber-950/15 to-slate-900/40 rounded-2xl border-2 border-rose-500/30 dark:border-rose-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                    <ShieldAlert className="w-6 h-6 animate-pulse text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-rose-900 dark:text-rose-200 flex items-center gap-2">
                      <span>🚨 Admin Panic Mode &amp; Disaster Recovery</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-bold">
                        SNAPSHOT BACKUP
                      </span>
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
                      Sistem mencadangkan snapshot harian secara otomatis ke Firestore. Jika terjadi penghapusan data tidak disengaja, Anda dapat memulihkan seluruh atau sebagian data secara instan dari riwayat snapshot cadangan.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPanicModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-800 hover:to-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 border border-rose-400/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-300" />
                    <span>Buka Panel Panic Mode</span>
                  </button>
                </div>
              </div>

              {syncResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{syncResult}</span>
                </div>
              )}
            </div>



            {/* Card: Dedicated Photo Cache for Incidents & Offline Documentation */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Cache Khusus Dokumentasi Foto Kejadian (Offline First)</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        photoCacheStats.offlineReadyPercentage >= 80
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {photoCacheStats.offlineReadyPercentage}% Kesiapan Offline
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Memastikan seluruh foto bukti insiden dan kejadian tetap responsif & dapat dibuka saat tidak ada jaringan internet.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPhotoCacheModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Kelola & Konfigurasi Cache</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Foto Ter-Cache</span>
                  <p className="font-sans text-slate-900 dark:text-slate-100 font-bold text-sm">
                    {photoCacheStats.totalCachedPhotos} Berkas Foto
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Ukuran Cache Lokal</span>
                  <p className="font-sans text-slate-900 dark:text-slate-100 font-bold text-sm">
                    {photoCacheStats.formattedSize}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Penyimpanan Offline</span>
                  <p className="font-sans text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    IndexedDB & Workbox
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: GEMINI AI INTEGRATION                              */}
        {/* ========================================================= */}
        {activeTab === 'gemini_ai' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                       <span>Google Gemini 3.8 Flash Engine</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Server-Side Proxy
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Kecerdasan buatan untuk analisis kedisiplinan guru, ringkasan eksekutif Kepala Sekolah, dan deteksi insiden.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={testingAi}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 ${testingAi ? 'animate-spin' : ''}`} />
                  <span>{testingAi ? 'Menjalankan...' : 'Uji Respon AI'}</span>
                </button>
              </div>

              {/* Status Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200/60 dark:border-amber-800/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Model AI Terpasang</span>
                  <p className="font-mono text-amber-950 dark:text-amber-200 font-bold">
                    gemini-3.8-flash
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Arsitektur Eksekusi</span>
                  <p className="font-sans text-slate-900 dark:text-slate-100 font-bold">
                    Full-Stack Server Proxy (/api/ai)
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Keamanan Kunci API</span>
                  <p className="font-sans text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Aman (Server Secrets)</span>
                  </p>
                </div>
              </div>

              {/* AI Test Output */}
              {aiTestResult && (
                <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white rounded-2xl text-xs space-y-1.5 font-mono shadow-inner animate-in fade-in border border-slate-800">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                    Hasil Uji Coba Gemini AI:
                  </span>
                  <p className="text-slate-200 text-xs leading-relaxed">
                    {aiTestResult}
                  </p>
                </div>
              )}

              {/* Features List */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-slate-100">Kemampuan AI yang Diaktifkan pada e-Piket:</h4>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside">
                  <li><strong>Executive Summary Kepala Sekolah:</strong> Pembuatan ringkasan 1-klik situasi ketertiban harian.</li>
                  <li><strong>Analisis Keterlambatan:</strong> Deteksi pos piket yang sering terlambat atau kosong.</li>
                  <li><strong>Rekomendasi Tindakan:</strong> Saran langkah solutif tindak lanjut insiden siswa dan penerimaan tamu.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: OPERASIONAL & GPS SEKOLAH                          */}
        {/* ========================================================= */}
        {activeTab === 'operasional_gps' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Card 1: Picket Validation Rules */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aturan Check-In & Validasi Keterlambatan</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Toleransi Keterlambatan (Menit)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={formData.school.toleransiKeterlambatanMenit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school: { ...formData.school, toleransiKeterlambatanMenit: Number(e.target.value) }
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Petugas yang check-in melebihi toleransi ini akan otomatis ditandai "Terlambat".
                  </span>
                </div>

                <div>
                  <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                    Wajib Foto pada Entri Buku Piket
                  </label>
                  <select
                    value={formData.requirePhotoOnLogbook ? 'yes' : 'no'}
                    onChange={(e) =>
                      setFormData({ ...formData, requirePhotoOnLogbook: e.target.value === 'yes' })
                    }
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  >
                    <option value="no">Opsional (Dianjurkan)</option>
                    <option value="yes">Wajib Melampirkan Foto</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 1.5: Configuration for Automatic Push Notifications to Non-Admin Roles */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Push Notification Otomatis untuk Non-Admin</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        (formData.autoPushNotificationIntervalMinutes ?? 15) > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}>
                        {(formData.autoPushNotificationIntervalMinutes ?? 15) > 0 
                          ? `● Aktif (Setiap ${formData.autoPushNotificationIntervalMinutes ?? 15} Menit)` 
                          : '● Non-Aktif'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Notifikasi pengingat otomatis tugas piket &amp; entri Buku Piket Digital yang akan muncul di HP/browser seluruh role pengguna kecuali Admin.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <label className="block font-bold uppercase text-slate-700 dark:text-slate-300">
                  Pilih Jeda Waktu Kemunculan Push Notification Otomatis:
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[5, 10, 15, 0].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setFormData({ ...formData, autoPushNotificationIntervalMinutes: mins })}
                      className={`p-3.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        (formData.autoPushNotificationIntervalMinutes ?? 15) === mins
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 font-extrabold'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold'
                      }`}
                    >
                      <span className="text-sm font-black">
                        {mins === 0 ? '🚫 Non-Aktif' : `⏱️ ${mins} Menit`}
                      </span>
                      <span className="text-[10.5px] opacity-80 font-normal">
                        {mins === 0 ? 'Matikan Notifikasi' : `Tampil tiap ${mins} menit`}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/60 text-[11px] text-indigo-950 dark:text-indigo-200 space-y-1">
                  <p className="font-bold">ℹ️ Informasi Sistem Push Notification Otomatis:</p>
                  <p className="text-indigo-800 dark:text-indigo-300 leading-relaxed">
                    Pengaturan ini berlaku otomatis untuk pengguna role <strong>Guru, Petugas Piket, Kepala Sekolah, dan Tendik</strong>. Pengguna Admin bebas dari gangguan notifikasi berkala ini.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: GPS Geolocation Radius & Locking Config Panel */}
            <SchoolGpsConfigPanel
              school={formData.school}
              systemSettings={formData}
              onUpdateSchool={async (updated) => {
                setFormData(prev => ({
                  ...prev,
                  school: { ...prev.school, ...updated }
                }));
                await updateSchool(updated);
              }}
              onUpdateSystemSettings={async (updatedSettings) => {
                setFormData(prev => ({
                  ...prev,
                  ...updatedSettings,
                  appBranding: {
                    ...prev.appBranding,
                    ...(updatedSettings.appBranding || {})
                  }
                }));
                await updateSystemSettings(updatedSettings);
              }}
            />

            {/* Card 3: Proteksi Keamanan Anti Copy-Paste & Incognito Guard */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Proteksi Keamanan Anti Copy-Paste & Kerahasiaan Data</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        ● Aktif di Semua Browser & Incognito
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mencegah penyalinan, pemotongan teks, klik kanan (context menu), dan eksfiltrasi data siswa/guru di seluruh peramban web.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status Proteksi Clipboard</span>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Copy & Cut Diblokir</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dukungan Mode Browser</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>Reguler + Incognito / Private</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pencegahan Menu & Pintasan</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-rose-500" />
                    <span>Right-Click, F12 & Ctrl+C</span>
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-xs text-rose-950 dark:text-rose-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Keamanan Data Sekolah Terjamin:</p>
                  <p className="text-[11px] text-rose-800 dark:text-rose-300">
                    Sistem mendeteksi dan mencegah upaya penggandaan data digital sekolah. Seluruh dokumen resmi piket tetap dapat diekspor melalui tombol Ekspor Resmi PDF & Excel yang telah disediakan bagi petugas berwenang.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="submit"
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Semua Pengaturan</span>
          </button>
        </div>

      </form>

      {/* DEDICATED INCIDENT PHOTO CACHE MODAL */}
      <IncidentPhotoCacheModal
        isOpen={showPhotoCacheModal}
        onClose={() => setShowPhotoCacheModal(false)}
        incidents={incidents}
        onCacheChanged={refreshCacheStats}
      />

      {/* ADMIN PANIC MODE MODAL */}
      <AdminPanicModeModal
        isOpen={showPanicModal}
        onClose={() => setShowPanicModal(false)}
      />

    </div>
  );
};
