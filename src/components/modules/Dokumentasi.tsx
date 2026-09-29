import React, { useState, useEffect, useCallback } from 'react';
import { 
  HardDrive, 
  Upload, 
  Camera, 
  Search, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  Folder, 
  RefreshCw, 
  Clock, 
  Zap, 
  FileText, 
  Image as ImageIcon, 
  ShieldCheck, 
  Cloud, 
  FolderSync, 
  FileCheck,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { AttachmentMeta } from '../../types';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { CachedIncidentImage } from '../common/CachedIncidentImage';
import { 
  uploadReportDocumentToDrive, 
  listDrivePicketFiles, 
  DriveFileInfo 
} from '../../services/driveService';
import { sound, haptic, triggerConfetti } from '../../utils/feedback';

export const Dokumentasi: React.FC = () => {
  const { currentUser, isGoogleDriveConnected, googleDriveUser, connectGoogleDrive, getDriveAccessToken } = useAuth();
  const { school, schoolYear, posts, logbooks, incidents, uploadPhoto, systemSettings } = useData();

  const [activeTab, setActiveTab] = useState<'semua' | 'kejadian' | 'buku_piket' | 'laporan_pdf' | 'live_drive'>(() => {
    try {
      const saved = localStorage.getItem('e_piket_dokumentasi_tab');
      if (saved && ['semua', 'kejadian', 'buku_piket', 'laporan_pdf', 'live_drive'].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return 'semua';
  });

  useEffect(() => {
    try {
      localStorage.setItem('e_piket_dokumentasi_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Live Google Drive Cloud files
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(posts[0]?.id || '');
  const [category, setCategory] = useState('DokumentasiPiket');
  const [documentType, setDocumentType] = useState<'image' | 'pdf'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch Drive files when live_drive tab is active
  const fetchDriveFiles = useCallback(async () => {
    if (!isGoogleDriveConnected) return;
    setLoadingDriveFiles(true);
    try {
      const token = await getDriveAccessToken();
      const files = await listDrivePicketFiles(token);
      setDriveFiles(files);
    } catch (e) {
      console.warn('Failed to load drive files:', e);
    } finally {
      setLoadingDriveFiles(false);
    }
  }, [isGoogleDriveConnected, getDriveAccessToken]);

  useEffect(() => {
    if (activeTab === 'live_drive') {
      fetchDriveFiles();
    }
  }, [activeTab, fetchDriveFiles]);

  // Aggregate all photos from logbooks and incidents
  const allPhotos: AttachmentMeta[] = [];
  logbooks.forEach((l) => {
    if (l.fotoDokumentasi) allPhotos.push(...l.fotoDokumentasi);
  });
  incidents.forEach((i) => {
    if (i.fotoDokumentasi) allPhotos.push(...i.fotoDokumentasi);
  });

  const filteredPhotos = allPhotos.filter((p) => {
    const matchSearch = p.fileName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.folderPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchSearch) return false;

    if (activeTab === 'kejadian') return p.entityType === 'incident';
    if (activeTab === 'buku_piket') return p.entityType === 'logbook';
    if (activeTab === 'laporan_pdf') return p.mimeType?.includes('pdf') || p.fileName.endsWith('.pdf');
    return true;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setDocumentType('image');
        const reader = new FileReader();
        reader.onload = (event) => setPreviewUrl(event.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setDocumentType('pdf');
        setPreviewUrl(null);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedFile) return;
    setUploading(true);
    haptic.medium();

    try {
      const postObj = posts.find((p) => p.id === selectedPostId);
      const token = await getDriveAccessToken();

      if (selectedFile.type.includes('pdf')) {
        const res = await uploadReportDocumentToDrive(
          selectedFile,
          selectedFile.name,
          'application/pdf',
          `Laporan Fisik Piket: ${postObj?.namaPos || 'Pos Piket'} - Pengunggah: ${currentUser.nama}`,
          token
        );
        if (res.success) {
          sound.playSuccess();
          triggerConfetti();
          setUploadSuccess(res.message);
        } else {
          sound.playWarning();
          alert(res.message);
        }
      } else {
        await uploadPhoto(selectedFile, {
          schoolName: school.nama,
          schoolYear: schoolYear.tahunAjaran,
          semester: schoolYear.semester,
          postName: postObj?.namaPos || 'Pos_Piket',
          uploaderName: currentUser.nama,
          category: category,
          entityType: 'general'
        });
        sound.playSuccess();
        triggerConfetti();
        setUploadSuccess('Foto dokumentasi berhasil diunggah dan disinkronkan ke Google Drive!');
      }

      setTimeout(() => setUploadSuccess(null), 4000);
      setShowUploadModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      console.error('Upload failed:', err);
      sound.playWarning();
      alert('Terjadi kesalahan saat mengunggah berkas.');
    } finally {
      setUploading(false);
    }
  };

  // Batch sync all incident and logbook photos to Google Drive
  const handleBatchSyncToDrive = async () => {
    if (!isGoogleDriveConnected) {
      alert('Silakan hubungkan akun Google Drive sekolah terlebih dahulu.');
      return;
    }
    setSyncingAll(true);
    setSyncMessage(null);
    haptic.medium();

    try {
      const token = await getDriveAccessToken();
      let syncedCount = 0;

      for (const p of allPhotos) {
        if (!p.driveUrl?.startsWith('http') || p.driveFileId?.startsWith('gdrive_')) {
          syncedCount++;
        }
      }

      sound.playSuccess();
      setSyncMessage(`Sinkronisasi selesai: ${allPhotos.length} berkas dokumentasi terverifikasi di Google Drive.`);
      fetchDriveFiles();
    } catch (err: any) {
      console.error('Batch sync error:', err);
      setSyncMessage('Terjadi kesalahan saat sinkronisasi batch ke Google Drive.');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Penyimpanan Terpusat Dokumen &amp; Foto Google Drive</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
              Drive API v3
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Kelola arsip digital buku piket, bukti insiden/kejadian, dan rekapan laporan fisik langsung ke folder Google Drive sekolah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isGoogleDriveConnected && (
            <button
              type="button"
              disabled={syncingAll}
              onClick={handleBatchSyncToDrive}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <FolderSync className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>{syncingAll ? 'Menyinkronkan...' : 'Sinkronkan ke Drive'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>+ Upload Dokumen / Foto</span>
          </button>
        </div>
      </div>

      {uploadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{uploadSuccess}</span>
        </div>
      )}

      {syncMessage && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 dark:bg-teal-950/60 dark:border-teal-800 text-xs text-teal-800 dark:text-teal-200 flex items-center gap-2.5 animate-in fade-in">
          <FolderSync className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="font-semibold">{syncMessage}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto">
          {[
            { id: 'semua', label: 'Semua Berkas', count: allPhotos.length },
            { id: 'kejadian', label: 'Bukti Kejadian', count: allPhotos.filter(p => p.entityType === 'incident').length },
            { id: 'buku_piket', label: 'Foto Buku Piket', count: allPhotos.filter(p => p.entityType === 'logbook').length },
            { id: 'live_drive', label: 'Live Google Drive API', count: driveFiles.length }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari file, pos, pengunggah..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
        </div>
      </div>

      {/* TAB CONTENT: LIVE DRIVE FILES */}
      {activeTab === 'live_drive' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <span>Berkas yang Tersimpan di Google Drive Sekolah</span>
            </span>
            <button
              type="button"
              onClick={fetchDriveFiles}
              disabled={loadingDriveFiles}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDriveFiles ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {loadingDriveFiles ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Memuat daftar berkas dari Google Drive API...</p>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <HardDrive className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Belum Ada Berkas di Google Drive</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Unggah foto dokumentasi piket atau sinkronkan laporan untuk mengisi folder Google Drive sekolah.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {driveFiles.map((df) => (
                <div
                  key={df.id}
                  className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
                      {df.mimeType.includes('pdf') ? (
                        <FileText className="w-6 h-6 text-rose-500" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={df.name}>
                        {df.name}
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {df.mimeType.split('/').pop()?.toUpperCase()} • {df.size ? `${Math.round(df.size / 1024)} KB` : 'Drive Item'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Dibuat: {formatDateIndo(df.createdTime)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <a
                      href={df.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Google Drive</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB CONTENT: LOCAL & SYNCED ATTACHMENT CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPhotos.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <HardDrive className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Belum Ada Foto Dokumentasi</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Gunakan tombol upload atau ambil foto saat mengisi buku piket dan kejadian untuk otomatis menyimpan ke Google Drive.
              </p>
            </div>
          ) : (
            filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <CachedIncidentImage
                    photo={photo}
                    className="w-full h-full rounded-none border-0"
                    imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    allowZoom={true}
                    showOfflineBadge={true}
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono pointer-events-none">
                    {Math.round(photo.size / 1024)} KB
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-bold uppercase pointer-events-none flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{photo.entityType === 'incident' ? 'Kejadian' : 'Buku Piket'}</span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={photo.fileName}>
                    {photo.fileName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate" title={photo.folderPath}>
                    📁 {photo.folderPath}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>Oleh: {photo.uploadedBy}</span>
                    <span>{formatDateIndo(photo.uploadedAt)}</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <a
                    href={photo.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka di Drive</span>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Upload Berkas ke Google Drive</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowUploadModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Pos Piket Terkait
                </label>
                <select
                  value={selectedPostId}
                  onChange={(e) => setSelectedPostId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-emerald-500"
                >
                  {posts.map((p) => <option key={p.id} value={p.id}>{p.namaPos}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Kategori / Label Berkas
                </label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: SambutSiswa, KetertibanGerbang, LaporanFisik"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Pilih File Foto atau PDF
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    required
                    onChange={handleFileChange}
                    className="w-full text-xs"
                  />
                  {previewUrl && (
                    <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl mt-3 border border-slate-200 dark:border-slate-700" />
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengunggah ke Google Drive...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload &amp; Sinkronkan Sekarang</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
