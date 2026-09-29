import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  ShieldCheck, 
  Calendar, 
  Award, 
  Clock, 
  Fingerprint, 
  ScanFace, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Zap, 
  Smartphone, 
  BellRing, 
  Sliders, 
  Volume2, 
  Camera, 
  Upload, 
  Edit3, 
  Key, 
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
  HardDrive, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { biometricService } from '../../services/biometricService';
import { sound, HapticIntensity } from '../../utils/feedback';
import { useHaptic } from '../../hooks/useHaptic';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { ProfilePhotoModal } from './ProfilePhotoModal';
import { CompressionResult } from '../../utils/imageCompressor';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

export const ProfilPengguna: React.FC = () => {
  const { currentUser, updateUserProfile, updateUserCredentials, isGoogleDriveConnected } = useAuth();
  const { school, schedules, attendances, updateUser } = useData();
  const { isHapticEnabled, hapticIntensity, toggleHaptic, setHapticIntensity, haptic } = useHaptic();

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [credentialInfo, setCredentialInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile Photo Upload Modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [latestCompression, setLatestCompression] = useState<CompressionResult | null>(null);

  // Profile Edit Modal / State
  const [isEditingData, setIsEditingData] = useState(false);
  const [editFormData, setEditFormData] = useState({
    nama: '',
    nomorHP: '',
    nip: '',
    jabatan: '',
    pin: '',
    password: ''
  });

  // Security Credentials Modal & State
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityFormData, setSecurityFormData] = useState({
    pin: '',
    password: ''
  });
  const [showSecurityPin, setShowSecurityPin] = useState(false);
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const enrolled = biometricService.isUserEnrolled(currentUser.id);
      setIsEnrolled(enrolled);
      setCredentialInfo(biometricService.getUserCredential(currentUser.id));
      setEditFormData({
        nama: currentUser.nama || '',
        nomorHP: currentUser.nomorHP || '',
        nip: currentUser.nip || '',
        jabatan: currentUser.jabatan || '',
        pin: currentUser.pin !== undefined ? currentUser.pin : '123456',
        password: currentUser.password !== undefined ? currentUser.password : 'password123'
      });
      setSecurityFormData({
        pin: currentUser.pin !== undefined ? currentUser.pin : '123456',
        password: currentUser.password !== undefined ? currentUser.password : 'password123'
      });
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const mySchedules = schedules.filter((s) => s.userId === currentUser.id);
  const myAttendances = attendances.filter((a) => a.userId === currentUser.id);
  const completedDuties = myAttendances.filter((a) => a.status === 'selesai').length;

  // Handle Photo Updated from Modal
  const handlePhotoUpdated = async (photoUrl: string, driveUrl?: string, compression?: CompressionResult) => {
    setLoading(true);
    setMsg(null);
    try {
      if (compression) {
        setLatestCompression(compression);
      }

      // Update in DataContext (syncs to Firebase Firestore)
      await updateUser(currentUser.id, {
        foto: photoUrl,
        ...(driveUrl ? { fotoDriveUrl: driveUrl } : {})
      });

      // Update in AuthContext (local memory & storage)
      await updateUserProfile(currentUser.id, {
        foto: photoUrl,
        ...(driveUrl ? { fotoDriveUrl: driveUrl } : {})
      });

      sound.playSuccess();
      showSuccessToast(photoUrl ? 'Foto profil baru berhasil disimpan!' : 'Foto profil berhasil dihapus!');
      setMsg({
        type: 'success',
        text: photoUrl 
          ? `Foto profil berhasil diperbarui & disinkronkan ke Firebase${driveUrl ? ' dan Google Drive' : ''}! ${compression ? `[Dikompresi: ${compression.originalSizeFormatted} ➔ ${compression.compressedSizeFormatted} (-${compression.savingsPercentage}%)]` : ''}`
          : 'Foto profil berhasil dihapus dan kembali ke inisial avatar.'
      });
    } catch (err: any) {
      setMsg({ type: 'error', text: `Gagal memperbarui foto: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Handle Save Personal Data
  const handleSavePersonalData = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const cleanPin = editFormData.pin.trim() || '123456';
      const cleanPassword = editFormData.password.trim() || 'password123';

      await updateUser(currentUser.id, {
        nama: editFormData.nama,
        nomorHP: editFormData.nomorHP,
        nip: editFormData.nip,
        jabatan: editFormData.jabatan,
        pin: cleanPin,
        password: cleanPassword
      });

      await updateUserProfile(currentUser.id, {
        nama: editFormData.nama,
        nomorHP: editFormData.nomorHP,
        nip: editFormData.nip,
        jabatan: editFormData.jabatan,
        pin: cleanPin,
        password: cleanPassword
      });

      await updateUserCredentials(currentUser.id, cleanPin, cleanPassword);

      setIsEditingData(false);
      sound.playSuccess();
      showSuccessToast('Data profil dan kredensial login berhasil disimpan!');
      setMsg({ type: 'success', text: 'Data profil & PIN/Sandi berhasil diperbarui serta tersimpan di Cloud Firebase!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: `Gagal menyimpan data: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Handle Save Security Credentials (PIN & Password)
  const handleSaveSecurityCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const cleanPin = securityFormData.pin.trim();
    const cleanPassword = securityFormData.password.trim();

    if (!cleanPin || cleanPin.length < 4) {
      showErrorToast('PIN harus terdiri dari 4 sampai 8 digit angka.');
      setLoading(false);
      return;
    }

    if (!cleanPassword || cleanPassword.length < 4) {
      showErrorToast('Kata sandi minimal 4 karakter.');
      setLoading(false);
      return;
    }

    try {
      await updateUser(currentUser.id, {
        pin: cleanPin,
        password: cleanPassword
      });

      await updateUserProfile(currentUser.id, {
        pin: cleanPin,
        password: cleanPassword
      });

      await updateUserCredentials(currentUser.id, cleanPin, cleanPassword);

      setShowSecurityModal(false);
      sound.playSuccess();
      showSuccessToast('PIN dan kata sandi berhasil diperbarui!');
      setMsg({ type: 'success', text: `Kredensial login akun Anda berhasil diperbarui (PIN: ${cleanPin}).` });
    } catch (err: any) {
      setMsg({ type: 'error', text: `Gagal memperbarui kredensial: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset PIN & Password to Default
  const handleResetCredentialsToDefault = async () => {
    if (confirm('Apakah Anda yakin ingin mereset PIN menjadi 123456 dan kata sandi menjadi password123?')) {
      setLoading(true);
      try {
        const defaultPin = '123456';
        const defaultPassword = 'password123';

        await updateUser(currentUser.id, {
          pin: defaultPin,
          password: defaultPassword
        });

        await updateUserProfile(currentUser.id, {
          pin: defaultPin,
          password: defaultPassword
        });

        await updateUserCredentials(currentUser.id, defaultPin, defaultPassword);

        setSecurityFormData({
          pin: defaultPin,
          password: defaultPassword
        });
        setEditFormData((prev) => ({
          ...prev,
          pin: defaultPin,
          password: defaultPassword
        }));

        setShowSecurityModal(false);
        sound.playSuccess();
        showSuccessToast('PIN & kata sandi berhasil direset ke nilai default!');
        setMsg({ type: 'success', text: 'Kredensial akun telah direset ke default sistem (PIN: 123456, Sandi: password123).' });
      } catch (err: any) {
        showErrorToast('Gagal mereset kredensial: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRegisterSensor = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await biometricService.registerBiometric(currentUser.id, currentUser.nama);
      if (res.success) {
        setIsEnrolled(true);
        setCredentialInfo(res.credential);
        sound.playSuccess();
        setMsg({ type: 'success', text: res.message });
      } else {
        setMsg({ type: 'error', text: res.message });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Pendaftaran sensor gagal.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSensor = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await biometricService.verifyBiometric(currentUser.id, currentUser.nama, 'login');
      if (res.success) {
        sound.playSuccess();
        setMsg({ type: 'success', text: `${res.message} (Sensor responsif & aktif)` });
      } else {
        setMsg({ type: 'error', text: 'Verifikasi sensor tidak berhasil.' });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Pengujian sensor gagal.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSensor = () => {
    if (confirm('Apakah Anda yakin ingin menghapus data sensor biometrik dari perangkat ini?')) {
      biometricService.removeBiometric(currentUser.id);
      setIsEnrolled(false);
      setCredentialInfo(null);
      setMsg({ type: 'success', text: 'Data sensor biometrik berhasil dihapus dari perangkat ini.' });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Profil Pengguna
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Kelola foto profil, identitas kedinasan, hak akses role {currentUser.role.toUpperCase()}, dan autentikasi biometrik.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPhotoModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Camera className="w-4 h-4" />
          <span>Upload / Ganti Foto Profil</span>
        </button>
      </div>

      {/* Global Status Message Toast */}
      {msg && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs animate-in fade-in ${
          msg.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}>
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-bold">{msg.type === 'success' ? 'Berhasil: ' : 'Pemberitahuan: '}</span>
            <span>{msg.text}</span>
          </div>
        </div>
      )}

      {/* Main Profile Card with Photo Upload & Edit Details */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-slate-100 dark:border-slate-800 text-center sm:text-left">
          
          {/* Interactive Avatar with Upload Trigger Overlay */}
          <div className="relative group shrink-0">
            {currentUser.foto ? (
              <img
                src={currentUser.foto}
                alt={currentUser.nama}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-emerald-500/40 shadow-lg ring-4 ring-emerald-500/10"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-3xl sm:text-4xl flex items-center justify-center shadow-lg ring-4 ring-emerald-500/10">
                {currentUser.nama.charAt(0)}
              </div>
            )}

            {/* Change Photo Overlay Button */}
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="absolute inset-0 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer"
              title="Klik untuk upload foto baru atau ambil selfie"
            >
              <Camera className="w-5 h-5" />
              <span className="text-[10px] font-bold">Ubah Foto</span>
            </button>

            {/* Quick Mini Camera Button on Corner */}
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition active:scale-95 cursor-pointer"
              title="Upload foto profil"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {currentUser.nama}
                </h2>
                <p className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  @{currentUser.username || currentUser.email.split('@')[0]}
                </p>
              </div>

              <div className="flex items-center gap-2 self-center sm:self-auto">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Role: {currentUser.role}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingData(!isEditingData)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingData ? 'Tutup' : 'Edit Info'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
              {currentUser.jabatan || 'Tenaga Pendidik'} • {currentUser.unitKerja || school.nama}
            </p>
            
            {/* Cloud Sync Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Data tersinkronisasi Firebase Firestore</span>
              {isGoogleDriveConnected && (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">• Google Drive Aktif</span>
              )}
            </div>
          </div>
        </div>

        {/* Inline Edit Form for Personal Data & PIN */}
        {isEditingData ? (
          <form onSubmit={handleSavePersonalData} className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>Perbarui Informasi Profil &amp; Kredensial</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditFormData((prev) => ({
                    ...prev,
                    pin: '123456',
                    password: 'password123'
                  }));
                  showSuccessToast('PIN & sandi direset ke default (123456 / password123)');
                }}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset PIN & Sandi ke Default</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap &amp; Gelar</label>
                <input
                  type="text"
                  required
                  value={editFormData.nama}
                  onChange={(e) => setEditFormData({ ...editFormData, nama: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Nomor WhatsApp Aktif</label>
                <input
                  type="text"
                  required
                  value={editFormData.nomorHP}
                  onChange={(e) => setEditFormData({ ...editFormData, nomorHP: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">NIP (Nomor Induk Pegawai)</label>
                <input
                  type="text"
                  value={editFormData.nip}
                  onChange={(e) => setEditFormData({ ...editFormData, nip: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Jabatan Kedinasan</label>
                <input
                  type="text"
                  value={editFormData.jabatan}
                  onChange={(e) => setEditFormData({ ...editFormData, jabatan: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                <label className="block text-[11px] font-bold uppercase text-emerald-950 dark:text-emerald-200 mb-1">
                  6-Digit PIN Masuk Cepat
                </label>
                <input
                  type="text"
                  maxLength={8}
                  required
                  value={editFormData.pin ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setEditFormData((prev) => ({ ...prev, pin: val }));
                  }}
                  placeholder="123456"
                  className="w-full p-2 rounded-xl border bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 font-mono font-black text-center text-sm tracking-widest text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                <label className="block text-[11px] font-bold uppercase text-emerald-950 dark:text-emerald-200 mb-1">
                  Kata Sandi Akun
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.password ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditFormData((prev) => ({ ...prev, password: val }));
                  }}
                  placeholder="password123"
                  className="w-full p-2 rounded-xl border bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 font-mono font-medium text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingData(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Perubahan ke Firebase</span>
              </button>
            </div>
          </form>
        ) : (
          /* Detailed Static Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/80 dark:border-emerald-800 space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Username (Akun Masuk)</span>
              <p className="text-emerald-950 dark:text-emerald-200 font-mono font-bold text-sm">@{currentUser.username || currentUser.email.split('@')[0]}</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Alamat Email</span>
              <p className="text-slate-800 dark:text-slate-200 font-medium">{currentUser.email}</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">NIP (Nomor Induk Pegawai)</span>
              <p className="text-slate-800 dark:text-slate-200 font-mono font-bold text-sm">{currentUser.nip || '-'}</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nomor WhatsApp Aktif</span>
              <p className="text-slate-800 dark:text-slate-200 font-medium">{currentUser.nomorHP}</p>
            </div>
          </div>
        )}

        {/* DEDICATED PIN & PASSWORD MANAGEMENT CARD */}
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 shrink-0">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Kredensial Keamanan (PIN &amp; Kata Sandi Akun)</span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Aktif
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Ubah 6 digit PIN untuk login cepat perbankan atau kata sandi teks akun Anda.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setSecurityFormData({
                    pin: currentUser.pin !== undefined ? currentUser.pin : '123456',
                    password: currentUser.password !== undefined ? currentUser.password : 'password123'
                  });
                  setShowSecurityModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ubah PIN &amp; Sandi</span>
              </button>

              <button
                type="button"
                onClick={handleResetCredentialsToDefault}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1"
                title="Reset PIN ke 123456 dan sandi ke password123"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-700 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">PIN Masuk Saat Ini</span>
                <p className="font-mono font-black text-sm text-slate-900 dark:text-white tracking-widest mt-0.5">
                  {showSecurityPin ? (currentUser.pin || '123456') : '••••••'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityPin(!showSecurityPin)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                {showSecurityPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Kata Sandi Saat Ini</span>
                <p className="font-mono font-medium text-xs text-slate-900 dark:text-white mt-0.5">
                  {showSecurityPassword ? (currentUser.password || 'password123') : '••••••••••••'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                {showSecurityPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* HAPTIC FEEDBACK SETTINGS CARD FOR ALL ROLES */}
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${isHapticEnabled ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'} shrink-0`}>
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Aksesibilitas & Umpan Balik Taktil (Haptic Feedback)</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    isHapticEnabled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {isHapticEnabled ? '● Getar Aktif' : '○ Getar Muted'}
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Memberikan efek getaran kuat/taktil saat menekan tombol utama, navigasi bawah, atau konfirmasi presensi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={toggleHaptic}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-2 ${
                  isHapticEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100'
                }`}
              >
                <span>{isHapticEnabled ? 'ON (Getar Aktif)' : 'OFF (Getar Mati)'}</span>
              </button>
            </div>
          </div>

          {/* Intensity Selector & Test Buttons */}
          {isHapticEnabled && (
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Tingkat Kekuatan Getaran (Vibration Power):</span>
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

              {/* Multi-Test Buttons */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Uji Getaran Perangkat (Tekan untuk merasakan getaran pola baru):
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => haptic.light()}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer border border-slate-300 dark:border-slate-600"
                  >
                    Sentuhan Ringan
                  </button>
                  <button
                    type="button"
                    onClick={() => haptic.medium()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition active:scale-95 cursor-pointer border border-emerald-300 dark:border-emerald-700"
                  >
                    Pilihan Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => haptic.heavy()}
                    className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-bold transition active:scale-95 cursor-pointer border border-teal-300 dark:border-teal-700"
                  >
                    Aksi Mantap
                  </button>
                  <button
                    type="button"
                    onClick={() => haptic.success()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                  >
                    ✨ Sukses Presensi
                  </button>
                  <button
                    type="button"
                    onClick={() => haptic.warning()}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                  >
                    ⚠️ Peringatan
                  </button>
                  <button
                    type="button"
                    onClick={() => haptic.error()}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
                  >
                    🚨 Getar Kejadian
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WEBAUTHN / BIOMETRIC ENROLLMENT CARD */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50/70 to-teal-50/70 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 shrink-0">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Autentikasi Biometrik (WebAuthn / Sidik Jari / Face ID)</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    isEnrolled 
                      ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200' 
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {isEnrolled ? '✓ Terdaftar & Siap' : 'Belum Terdaftar'}
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Masuk ke aplikasi dan verifikasi kehadiran selfie menggunakan sensor biometrik perangkat tanpa perlu mengetik PIN.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isEnrolled ? (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleTestSensor}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <ScanFace className="w-4 h-4" />
                    <span>Uji Sensor</span>
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleRemoveSensor}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 transition active:scale-95 cursor-pointer"
                    title="Hapus Kredensial Sensor dari Perangkat Ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleRegisterSensor}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Daftarkan Sensor Biometrik</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MODAL UPLOAD / GANTI FOTO PROFIL */}
      <ProfilePhotoModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        userId={currentUser.id}
        userName={currentUser.nama}
        userRole={currentUser.role}
        currentPhoto={currentUser.foto}
        onPhotoUpdated={handlePhotoUpdated}
      />

      {/* MODAL UBAH / RESET PIN & KATA SANDI */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Ubah PIN &amp; Kata Sandi
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kredensial akun @{currentUser.username || currentUser.email.split('@')[0]}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSecurityModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSecurityCredentials} className="space-y-4">
              {/* PIN INPUT */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    PIN Masuk (4-8 Digit Angka)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecurityPin(!showSecurityPin)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {showSecurityPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSecurityPin ? 'Sembunyikan' : 'Lihat'}</span>
                  </button>
                </div>

                <input
                  type={showSecurityPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={securityFormData.pin ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setSecurityFormData((prev) => ({ ...prev, pin: val }));
                  }}
                  placeholder="Contoh: 123456"
                  className="w-full text-base p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-black text-center tracking-widest text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 text-center">
                  Digunakan untuk verifikasi cepat di keypad halaman login.
                </p>
              </div>

              {/* PASSWORD INPUT */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Kata Sandi Akun
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {showSecurityPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showSecurityPassword ? 'Sembunyikan' : 'Lihat'}</span>
                  </button>
                </div>

                <input
                  type={showSecurityPassword ? 'text' : 'password'}
                  required
                  value={securityFormData.password ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSecurityFormData((prev) => ({ ...prev, password: val }));
                  }}
                  placeholder="Masukkan kata sandi baru"
                  className="w-full text-sm p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Digunakan untuk opsi masuk dengan username/password manual.
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResetCredentialsToDefault}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default (123456)</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowSecurityModal(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Kredensial</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
