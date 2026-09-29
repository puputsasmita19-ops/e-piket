import React, { useState } from 'react';
import { BookOpen, Plus, Search, Calendar, MapPin, User, Camera, CheckCircle2, Clock, UserCheck, WifiOff, Database, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Logbook, AttachmentMeta } from '../../types';
import { getTodayDateString } from '../../services/seedData';
import { formatDateIndo } from '../../utils/formatters';
import { RunningText } from '../common/RunningText';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { showSuccessToast } from '../../utils/toast';

export const BukuPiket: React.FC = () => {
  const { currentUser, currentRole } = useAuth();
  const { posts, logbooks, createLogbook, deleteLogbook, uploadPhoto, isOnline, pendingSyncCount } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPostFilter, setSelectedPostFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Delete Logbook Confirm State
  const [deleteLogState, setDeleteLogState] = useState<{
    isOpen: boolean;
    logId: string;
    postName: string;
    userName: string;
    tanggal: string;
  }>({
    isOpen: false,
    logId: '',
    postName: '',
    userName: '',
    tanggal: ''
  });

  // Form State
  const [formPostId, setFormPostId] = useState(posts[0]?.id || '');
  const [formKondisiAwal, setFormKondisiAwal] = useState('');
  const [formKondisiBertugas, setFormKondisiBertugas] = useState('');
  const [formCatatanKhusus, setFormCatatanKhusus] = useState('');
  const [formSiswaTerkait, setFormSiswaTerkait] = useState('');
  const [formTindakLanjut, setFormTindakLanjut] = useState('');
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = getTodayDateString();

  // Filtered logbooks
  const filteredLogbooks = (logbooks || []).filter((log) => {
    if (!log) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !q ||
      (log.postName || '').toLowerCase().includes(q) ||
      (log.userName || '').toLowerCase().includes(q) ||
      (log.kondisiSelamaBertugas || '').toLowerCase().includes(q) ||
      (Boolean(log.catatanKhusus) && (log.catatanKhusus || '').toLowerCase().includes(q));

    const matchesPost = selectedPostFilter === 'all' || log.postId === selectedPostFilter;
    const matchesDate = !selectedDateFilter || log.tanggal === selectedDateFilter;

    return matchesSearch && matchesPost && matchesDate;
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

  const handleSubmitLogbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    try {
      const postObj = posts.find((p) => p.id === formPostId);
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');

      let photoAttachments: AttachmentMeta[] = [];
      if (formPhoto) {
        const uploaded = await uploadPhoto(formPhoto, {
          schoolName: 'SMP Negeri 1 Nusantara',
          schoolYear: '2026/2027',
          semester: 'Ganjil',
          postName: postObj?.namaPos || 'Pos_Piket',
          uploaderName: currentUser.nama,
          category: 'BukuPiket',
          entityType: 'logbook'
        });
        photoAttachments.push(uploaded);
      }

      const siswaArray = formSiswaTerkait
        ? formSiswaTerkait.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      await createLogbook({
        userId: currentUser.id,
        userName: currentUser.nama,
        userRole: currentUser.role,
        postId: formPostId,
        postName: postObj?.namaPos || 'Pos Piket',
        tanggal: today,
        waktu: `${hours}:${mins}`,
        kondisiAwal: formKondisiAwal || 'Kondisi awal pos tertib dan bersih.',
        kondisiSelamaBertugas: formKondisiBertugas,
        catatanKhusus: formCatatanKhusus,
        siswaTerkait: siswaArray,
        tindakLanjut: formTindakLanjut,
        status: 'terkirim',
        fotoDokumentasi: photoAttachments
      });

      // Reset form
      setFormKondisiAwal('');
      setFormKondisiBertugas('');
      setFormCatatanKhusus('');
      setFormSiswaTerkait('');
      setFormTindakLanjut('');
      setFormPhoto(null);
      setPhotoPreview(null);
      setShowCreateModal(false);
      showSuccessToast('Catatan buku piket digital berhasil disimpan!');
    } catch (err) {
      console.error('Submit logbook error:', err);
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
            Buku Piket Digital
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Jurnal pencatatan situasi, pemantauan ketertiban siswa, dan kronologi piket harian.
          </p>
        </div>

        {currentRole !== 'kepsek' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ ISI BUKU PIKET</span>
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 transition-colors">
        <div className="relative w-full md:w-96 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari catatan, pos, nama guru..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedPostFilter}
            onChange={(e) => setSelectedPostFilter(e.target.value)}
            className="w-full md:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
          >
            <option value="all">Semua Pos Piket</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>{p.namaPos}</option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
          />

          {(selectedPostFilter !== 'all' || selectedDateFilter || searchQuery) && (
            <button
              onClick={() => {
                setSelectedPostFilter('all');
                setSelectedDateFilter('');
                setSearchQuery('');
              }}
              className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline px-2 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* TIMELINE LIST */}
      <div className="space-y-4">
        {filteredLogbooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 transition-colors">
            <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Belum Ada Catatan Buku Piket</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Tidak ditemukan data buku piket dengan kriteria pencarian yang Anda pilih.
            </p>
          </div>
        ) : (
          filteredLogbooks.map((log) => (
            <div
              key={log.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0 max-w-md">
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{log.postName}</h3>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <span>Petugas:</span>
                      <RunningText
                        text={log.userName}
                        maxLength={20}
                        className="text-slate-700 dark:text-slate-200 font-bold"
                        suffix={
                          <span className="text-slate-400 text-[10px]">
                            ({log.userRole === 'guru' ? 'Guru' : 'Tendik'})
                          </span>
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDateIndo(log.tanggal)}</span>
                  <span>•</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{log.waktu} WIB</span>

                  {(currentRole === 'admin' || currentUser?.id === log.userId) && (
                    <button
                      onClick={() => {
                        setDeleteLogState({
                          isOpen: true,
                          logId: log.id,
                          postName: log.postName,
                          userName: log.userName,
                          tanggal: log.tanggal
                        });
                      }}
                      className="ml-2 p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                      title="Hapus Catatan Buku Piket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Log Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Kondisi Awal Shift</span>
                  <p className="text-slate-800 dark:text-slate-200">{log.kondisiAwal}</p>
                </div>

                <div className="p-3 bg-teal-50/50 dark:bg-teal-950/40 rounded-2xl border border-teal-200/60 dark:border-teal-800/60 space-y-1">
                  <span className="font-bold text-teal-800 dark:text-teal-300 uppercase text-[10px]">Kondisi & Situasi Selama Bertugas</span>
                  <p className="text-slate-900 dark:text-slate-100 font-medium">{log.kondisiSelamaBertugas}</p>
                </div>
              </div>

              {log.catatanKhusus && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-300 uppercase text-[10px]">Catatan Khusus Kejadian</span>
                  <p className="text-amber-950 dark:text-amber-200">{log.catatanKhusus}</p>
                </div>
              )}

              {/* Students involved & Follow up */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                {log.siswaTerkait && log.siswaTerkait.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Siswa Terkait:</span>
                    {log.siswaTerkait.map((s, idx) => (
                      <span key={idx} className="max-w-xs inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                        <RunningText text={s} maxLength={22} />
                      </span>
                    ))}
                  </div>
                )}

                {log.tindakLanjut && (
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <strong>Tindak Lanjut:</strong> {log.tindakLanjut}
                  </div>
                )}
              </div>

              {/* Photos from Google Drive */}
              {log.fotoDokumentasi && log.fotoDokumentasi.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                    Foto Dokumentasi Google Drive ({log.fotoDokumentasi.length})
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {log.fotoDokumentasi.map((photo) => (
                      <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <img
                          src={photo.thumbnailUrl || photo.driveUrl}
                          alt={photo.fileName}
                          className="w-24 h-24 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <a
                            href={photo.driveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-[10px] font-bold"
                          >
                            Lihat Foto
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* CREATE LOGBOOK MODAL */}
      {showCreateModal && currentRole !== 'kepsek' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95 border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">+ Entri Buku Piket Digital</h3>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">Jurnal Operasional & Ketertiban Pos Piket</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLogbook} className="space-y-4">
              {!isOnline && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
                  <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-medium text-[11px] leading-snug">
                    <strong>Mode Offline Aktif:</strong> Catatan buku piket ini akan langsung disimpan secara lokal di IndexedDB HP Anda dan otomatis mengantre untuk disinkronkan saat internet terhubung.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Pos Piket <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formPostId}
                  onChange={(e) => setFormPostId(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                >
                  {posts.map((p) => (
                    <option key={p.id} value={p.id}>{p.namaPos}</option>
                  ))}
                </select>
              </div>

              {/* Field 1: Kondisi Awal Pos */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Kondisi Awal Pos & Lingkungan
                </label>
                <input
                  type="text"
                  value={formKondisiAwal}
                  onChange={(e) => setFormKondisiAwal(e.target.value)}
                  placeholder="Contoh: Gerbang dibuka pukul 06.30, situasi tertib dan kondusif"
                  className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Field 2: Situasi & Kejadian Selama Bertugas */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Situasi & Kejadian Selama Bertugas <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formKondisiBertugas}
                  onChange={(e) => setFormKondisiBertugas(e.target.value)}
                  placeholder="Jelaskan dinamika siswa, kehadiran tamu, kerapian seragam, atau catatan ketertiban..."
                  className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium leading-relaxed"
                />
              </div>

              {/* Field 3: Catatan Khusus */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Khusus (Opsional)
                </label>
                <input
                  type="text"
                  value={formCatatanKhusus}
                  onChange={(e) => setFormCatatanKhusus(e.target.value)}
                  placeholder="Catatan tambahan bila ada..."
                  className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Field 4: Siswa Terkait */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Siswa Terkait (Pisahkan koma bila lebih dari satu)
                </label>
                <input
                  type="text"
                  value={formSiswaTerkait}
                  onChange={(e) => setFormSiswaTerkait(e.target.value)}
                  placeholder="Contoh: Arya Pratama (8B), Rian Firmansyah (9C)"
                  className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Field 5: Tindak Lanjut */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Tindak Lanjut / Solusi yang Dilakukan
                </label>
                <input
                  type="text"
                  value={formTindakLanjut}
                  onChange={(e) => setFormTindakLanjut(e.target.value)}
                  placeholder="Contoh: Koordinasi dengan wali kelas dan guru BK untuk pembinaan"
                  className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
                />
              </div>

              {/* Photo Upload with Camera capture option */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Lampirkan Foto Dokumentasi (Google Drive)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700">
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Mengunggah & Menyimpan...' : 'Simpan ke Buku Piket'}
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

      {/* CONFIRM DELETE MODAL FOR LOGBOOK */}
      <ConfirmDeleteModal
        isOpen={deleteLogState.isOpen}
        onClose={() => setDeleteLogState((prev) => ({ ...prev, isOpen: false }))}
        title="Konfirmasi Hapus Buku Piket"
        itemName={`Catatan Buku Piket (${deleteLogState.postName})`}
        itemDetails={`Oleh: ${deleteLogState.userName} • Tanggal: ${formatDateIndo(deleteLogState.tanggal || getTodayDateString())}`}
        onConfirm={async () => {
          await deleteLogbook(deleteLogState.logId);
        }}
      />

    </div>
  );
};
