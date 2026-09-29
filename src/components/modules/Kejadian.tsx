import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, Search, Clock, MapPin, CheckCircle2, Camera, Star, MessageSquareQuote, User, Trash2, Edit3, Zap, Sliders, HardDrive, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Incident, IncidentCategory, IncidentPriority, IncidentStatus, AttachmentMeta } from '../../types';
import { getTodayDateString } from '../../services/seedData';
import { formatDateIndo, getPriorityBadge } from '../../utils/formatters';
import { RunningText } from '../common/RunningText';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { CachedIncidentImage } from '../common/CachedIncidentImage';
import { IncidentPhotoCacheModal } from '../common/IncidentPhotoCacheModal';
import { incidentPhotoCache } from '../../services/incidentPhotoCacheService';
import { showSuccessToast } from '../../utils/toast';

export const Kejadian: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const { incidents, createIncident, updateIncident, deleteIncident, uploadPhoto } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);

  // Photo Cache Statistics State
  const [cacheStats, setCacheStats] = useState<{
    totalCachedPhotos: number;
    totalSizeBytes: number;
    formattedSize: string;
    totalIncidentPhotosCount: number;
    offlineReadyPercentage: number;
    isOfflineReady: boolean;
  }>({
    totalCachedPhotos: 0,
    totalSizeBytes: 0,
    formattedSize: '0 KB',
    totalIncidentPhotosCount: 0,
    offlineReadyPercentage: 0,
    isOfflineReady: false
  });

  const refreshCacheStats = useCallback(async () => {
    const s = await incidentPhotoCache.getCacheStats(incidents);
    setCacheStats(s);
  }, [incidents]);

  useEffect(() => {
    refreshCacheStats();

    // Auto preload in background if enabled
    const config = incidentPhotoCache.getConfig();
    if (config.autoPreloadIncidentPhotos && typeof window !== 'undefined' && navigator.onLine) {
      incidentPhotoCache.prefetchAndCacheAllIncidents(incidents).then(() => {
        refreshCacheStats();
      }).catch(console.warn);
    }
  }, [refreshCacheStats, incidents]);

  // Delete Incident Confirm State
  const [deleteIncidentState, setDeleteIncidentState] = useState<{
    isOpen: boolean;
    incidentId: string;
    jenisKejadian: string;
    lokasi: string;
    tanggal: string;
  }>({
    isOpen: false,
    incidentId: '',
    jenisKejadian: '',
    lokasi: '',
    tanggal: ''
  });

  // Form State
  const [formLokasi, setFormLokasi] = useState('Gerbang Depan Sekolah');
  const [formKategori, setFormKategori] = useState<IncidentCategory>('kedisiplinan');
  const [formJenis, setFormJenis] = useState('');
  const [formPrioritas, setFormPrioritas] = useState<IncidentPriority>('sedang');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formPihak, setFormPihak] = useState('');
  const [formSiswa, setFormSiswa] = useState('');
  const [formTindakan, setFormTindakan] = useState('');
  const [formRekomendasi, setFormRekomendasi] = useState('');
  const [formPentingKepsek, setFormPentingKepsek] = useState(false);
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = getTodayDateString();

  const filteredIncidents = (incidents || []).filter((inc) => {
    if (!inc) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      (inc.jenisKejadian || '').toLowerCase().includes(q) ||
      (inc.deskripsi || '').toLowerCase().includes(q) ||
      (inc.lokasi || '').toLowerCase().includes(q) ||
      (inc.createdByUserName || '').toLowerCase().includes(q);

    const matchesCat = categoryFilter === 'all' || inc.kategori === categoryFilter;
    const matchesPrio = priorityFilter === 'all' || inc.prioritas === priorityFilter;
    const matchesStat = statusFilter === 'all' || inc.status === statusFilter;

    return matchesSearch && matchesCat && matchesPrio && matchesStat;
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormPhoto(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');

      let attachments: AttachmentMeta[] = [];
      if (formPhoto) {
        const uploaded = await uploadPhoto(formPhoto, {
          schoolName: 'SMP Negeri 1 Nusantara',
          schoolYear: '2026/2027',
          semester: 'Ganjil',
          postName: formLokasi.replace(/\s+/g, '_'),
          uploaderName: currentUser.nama,
          category: formKategori,
          entityType: 'incident'
        });
        attachments.push(uploaded);
      }

      const newInc = await createIncident({
        tanggal: today,
        waktu: `${hours}:${mins}`,
        lokasi: formLokasi,
        kategori: formKategori,
        jenisKejadian: formJenis,
        prioritas: formPrioritas,
        deskripsi: formDeskripsi,
        pihakTerlibat: formPihak,
        siswaTerkait: formSiswa,
        tindakanAwal: formTindakan,
        rekomendasiTindakLanjut: formRekomendasi,
        status: 'ditindaklanjuti',
        pentingKepalaSekolah: formPentingKepsek || formPrioritas === 'tinggi' || formPrioritas === 'darurat',
        createdByUserId: currentUser.id,
        createdByUserName: currentUser.nama,
        fotoDokumentasi: attachments
      });

      // Dedicated offline cache persistence immediately on upload
      if (attachments.length > 0) {
        for (const att of attachments) {
          try {
            await incidentPhotoCache.cachePhoto(att, newInc.id, photoPreview || undefined);
          } catch (cErr) {
            console.warn('Failed to cache uploaded photo:', cErr);
          }
        }
        refreshCacheStats();
      }

      // Reset form
      setFormJenis('');
      setFormDeskripsi('');
      setFormPihak('');
      setFormSiswa('');
      setFormTindakan('');
      setFormRekomendasi('');
      setFormPentingKepsek(false);
      setFormPhoto(null);
      setPhotoPreview(null);
      setShowCreateModal(false);
      showSuccessToast('Catatan kejadian dan tindak lanjut berhasil disimpan!');
    } catch (err) {
      console.error('Create incident error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Catatan Kejadian & Ketertiban
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Pencatatan insiden, pelanggaran disiplin, kesehatan siswa, tamu penting, dan eskalasi pimpinan.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Dedicated Photo Cache Button */}
          <button
            onClick={() => setShowCacheModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Kelola cache foto dokumentasi kejadian agar siap offline"
          >
            <Zap className={`w-4 h-4 ${cacheStats.offlineReadyPercentage >= 80 ? 'text-emerald-500 fill-emerald-500' : 'text-amber-500 fill-amber-500'}`} />
            <span>Cache Offline ({cacheStats.offlineReadyPercentage}%)</span>
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ TAMBAH KEJADIAN</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 transition-colors">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kejadian, lokasi, pelapor..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">Semua Kategori</option>
            <option value="kedisiplinan">Kedisiplinan</option>
            <option value="kehadiran">Kehadiran</option>
            <option value="keamanan">Keamanan</option>
            <option value="kebersihan">Kebersihan</option>
            <option value="siswa_sakit">Siswa Sakit</option>
            <option value="konflik_siswa">Konflik Siswa</option>
            <option value="fasilitas">Fasilitas</option>
            <option value="tamu">Tamu</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">Semua Prioritas</option>
            <option value="darurat">🚨 Darurat</option>
            <option value="tinggi">🔥 Tinggi</option>
            <option value="sedang">⚠️ Sedang</option>
            <option value="rendah">🟢 Rendah</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">Semua Status</option>
            <option value="ditindaklanjuti">Ditindaklanjuti</option>
            <option value="dipantau">Dipantau</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>
      </div>

      {/* INCIDENT CARDS */}
      <div className="space-y-4">
        {filteredIncidents.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 transition-colors">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Situasi Tertib & Aman</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Tidak ada catatan insiden atau pelanggaran yang sesuai dengan filter yang dipilih.
            </p>
          </div>
        ) : (
          filteredIncidents.map((inc) => (
            <div
              key={inc.id}
              className={`bg-white dark:bg-slate-900 rounded-3xl border shadow-xs p-5 sm:p-6 space-y-4 transition-all ${
                inc.pentingKepalaSekolah
                  ? 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/10'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${getPriorityBadge(inc.prioritas)}`}>
                    Prioritas: {inc.prioritas}
                  </span>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase border border-slate-200 dark:border-slate-700">
                    {inc.kategori.replace('_', ' ')}
                  </span>
                  {inc.pentingKepalaSekolah && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                      <Star className="w-3 h-3 text-rose-600 fill-rose-600" />
                      Penting Pimpinan
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDateIndo(inc.tanggal)} • {inc.waktu} WIB</span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{inc.jenisKejadian}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Lokasi: <strong className="text-slate-700 dark:text-slate-300">{inc.lokasi}</strong></span>
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  {inc.deskripsi}
                </p>
              </div>

              {/* Involved & Initial Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-teal-50/60 dark:bg-teal-950/40 rounded-2xl border border-teal-200/60 dark:border-teal-800/60 space-y-1">
                  <span className="font-bold text-teal-800 dark:text-teal-300 uppercase text-[10px]">Tindakan Awal Petugas</span>
                  <p className="text-slate-800 dark:text-slate-200">{inc.tindakanAwal}</p>
                </div>

                {inc.rekomendasiTindakLanjut && (
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/40 rounded-2xl border border-amber-200/60 dark:border-amber-800/60 space-y-1">
                    <span className="font-bold text-amber-800 dark:text-amber-300 uppercase text-[10px]">Rekomendasi Lanjutan</span>
                    <p className="text-slate-800 dark:text-slate-200">{inc.rekomendasiTindakLanjut}</p>
                  </div>
                )}
              </div>

              {/* Involved parties if any */}
              {(inc.pihakTerlibat || inc.siswaTerkait) && (
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1 max-w-full overflow-hidden">
                  {inc.pihakTerlibat && (
                    <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                      <span className="text-slate-400 text-[11px] shrink-0">Pihak:</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs min-w-0">
                        <RunningText text={inc.pihakTerlibat} maxLength={20} />
                      </span>
                    </div>
                  )}
                  {inc.siswaTerkait && (
                    <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                      <span className="text-slate-400 text-[11px] shrink-0">Siswa:</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs min-w-0">
                        <RunningText text={inc.siswaTerkait} maxLength={20} />
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Headmaster Notes if any */}
              {inc.catatanPimpinan && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs flex items-start gap-2 text-slate-900 dark:text-slate-100">
                  <MessageSquareQuote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Disposisi Kepala Sekolah:</strong>
                    <span>{inc.catatanPimpinan}</span>
                  </div>
                </div>
              )}

              {/* Photos */}
              {inc.fotoDokumentasi && inc.fotoDokumentasi.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Foto Bukti Insiden ({inc.fotoDokumentasi.length})
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Zap className="w-3 h-3 fill-current" />
                      Offline Cached
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {inc.fotoDokumentasi.map((photo) => (
                      <CachedIncidentImage
                        key={photo.id}
                        photo={photo}
                        incidentId={inc.id}
                        className="w-20 h-20"
                        onCacheUpdated={refreshCacheStats}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Status & Resolution Update */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 min-w-0 max-w-sm">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">Dilaporkan oleh:</span>
                  <RunningText
                    text={inc.createdByUserName}
                    maxLength={20}
                    className="text-slate-700 dark:text-slate-200 font-bold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Status Penanganan:</span>
                  <select
                    value={inc.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value as IncidentStatus;
                      await updateIncident(inc.id, { status: newStatus });
                      showSuccessToast(`Status kejadian di ${inc.lokasi} berhasil diperbarui!`);
                    }}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="informasi">Informasi</option>
                    <option value="dipantau">Dipantau</option>
                    <option value="ditindaklanjuti">Ditindaklanjuti</option>
                    <option value="selesai">✅ Selesai</option>
                  </select>

                  {(currentRole === 'admin' || currentUser?.id === inc.createdByUserId) && (
                    <button
                      onClick={() => {
                        setDeleteIncidentState({
                          isOpen: true,
                          incidentId: inc.id,
                          jenisKejadian: inc.jenisKejadian,
                          lokasi: inc.lokasi,
                          tanggal: inc.tanggal
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                      title="Hapus Laporan Kejadian"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* CREATE INCIDENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95 border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">+ Catat Kejadian Baru</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Kategori Kejadian
                  </label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as IncidentCategory)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  >
                    <option value="kedisiplinan">Kedisiplinan</option>
                    <option value="kehadiran">Kehadiran</option>
                    <option value="keamanan">Keamanan</option>
                    <option value="kebersihan">Kebersihan</option>
                    <option value="siswa_sakit">Siswa Sakit</option>
                    <option value="konflik_siswa">Konflik Siswa</option>
                    <option value="fasilitas">Fasilitas Rusak</option>
                    <option value="tamu">Tamu Khusus</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Tingkat Prioritas
                  </label>
                  <select
                    value={formPrioritas}
                    onChange={(e) => setFormPrioritas(e.target.value as IncidentPriority)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold"
                  >
                    <option value="rendah">🟢 Rendah (Info Rutin)</option>
                    <option value="sedang">⚠️ Sedang (Perlu Perhatian)</option>
                    <option value="tinggi">🔥 Tinggi (Mendesak)</option>
                    <option value="darurat">🚨 Darurat (Kepsek Segera)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Judul / Jenis Kejadian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formJenis}
                  onChange={(e) => setFormJenis(e.target.value)}
                  placeholder="Contoh: Siswa Terlambat Massal karena Hujan / Kaca Jendela Pecah"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Lokasi Kejadian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLokasi}
                  onChange={(e) => setFormLokasi(e.target.value)}
                  placeholder="Contoh: Gerbang Utama / Kantin Belakang / Lapangan"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Kronologi Kejadian <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  placeholder="Ceritakan kejadian secara rinci dan jelas..."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Pihak / Tamu Terlibat
                  </label>
                  <input
                    type="text"
                    value={formPihak}
                    onChange={(e) => setFormPihak(e.target.value)}
                    placeholder="Contoh: Orang tua siswa / Pengawas"
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Siswa Terkait (Bila ada)
                  </label>
                  <input
                    type="text"
                    value={formSiswa}
                    onChange={(e) => setFormSiswa(e.target.value)}
                    placeholder="Nama & kelas siswa"
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Tindakan Awal yang Telah Diambil <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTindakan}
                  onChange={(e) => setFormTindakan(e.target.value)}
                  placeholder="Contoh: Mengobati di UKS / Mendata dan memberikan pembinaan di pos"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Rekomendasi Tindak Lanjut
                </label>
                <input
                  type="text"
                  value={formRekomendasi}
                  onChange={(e) => setFormRekomendasi(e.target.value)}
                  placeholder="Contoh: Panggil wali murid / Perbaikan sarana oleh TU"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              {/* Important for Principal Checkbox */}
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formPentingKepsek}
                    onChange={(e) => setFormPentingKepsek(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded-sm cursor-pointer"
                  />
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    ⭐ Tandai: "Kejadian Penting untuk Kepala Sekolah"
                  </span>
                </label>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 pl-6">
                  Jika dicentang, langsung muncul di dashboard real-time Kepala Sekolah & mengirimkan notifikasi.
                </p>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Foto Bukti Dokumentasi (Google Drive)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700">
                    <Camera className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Ambil Foto / Galeri</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                  {formPhoto && (
                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                      {formPhoto.name}
                    </span>
                  )}
                </div>

                {photoPreview && (
                  <div className="mt-2 relative w-28 h-28 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700">
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setFormPhoto(null); setPhotoPreview(null); }}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan Kejadian...' : 'Simpan Laporan Kejadian'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL FOR INCIDENT */}
      <ConfirmDeleteModal
        isOpen={deleteIncidentState.isOpen}
        onClose={() => setDeleteIncidentState((prev) => ({ ...prev, isOpen: false }))}
        title="Konfirmasi Hapus Laporan Kejadian"
        itemName={`Laporan: ${deleteIncidentState.jenisKejadian}`}
        itemDetails={`Lokasi: ${deleteIncidentState.lokasi} • Tanggal: ${formatDateIndo(deleteIncidentState.tanggal || getTodayDateString())}`}
        onConfirm={async () => {
          await deleteIncident(deleteIncidentState.incidentId);
        }}
      />

      {/* DEDICATED INCIDENT PHOTO CACHE MODAL */}
      <IncidentPhotoCacheModal
        isOpen={showCacheModal}
        onClose={() => setShowCacheModal(false)}
        incidents={incidents}
        onCacheChanged={refreshCacheStats}
      />

    </div>
  );
};
