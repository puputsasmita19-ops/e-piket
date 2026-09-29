import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Database, 
  Building2, 
  Users, 
  MapPin, 
  Clock, 
  Calendar, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  FileDown, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Key, 
  Zap, 
  UserCheck, 
  Camera, 
  Image as ImageIcon, 
  Sparkles, 
  FolderSync, 
  Flame,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Filter,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { User, DutyPost, Shift, UserRole, School } from '../../types';
import { exportToExcel } from '../../services/exportService';
import { RunningText } from '../common/RunningText';
import { BatchMultiScheduleModal } from '../common/BatchMultiScheduleModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ImportMasterDataModal } from '../common/ImportMasterDataModal';
import { SchoolGpsConfigPanel } from '../admin/SchoolGpsConfigPanel';
import { compressImageAuto, CompressionResult } from '../../utils/imageCompressor';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

export const MasterData: React.FC = () => {
  const { 
    school, 
    updateSchool, 
    users, 
    createUser, 
    updateUser, 
    deleteUser, 
    deleteMultipleUsers,
    posts, 
    createPost, 
    updatePost, 
    deletePost, 
    deleteMultiplePosts,
    shifts, 
    createShift, 
    updateShift, 
    deleteShift, 
    deleteMultipleShifts,
    schoolYear,
    isFirestoreConnected,
    firestoreStatusMessage,
    syncAllDataToFirestore,
    syncInitialMasterDataToFirestore,
    purgeAllDemoAndShadowData
  } = useData();

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isPurgingDemo, setIsPurgingDemo] = useState(false);
  const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);

  const handlePurgeCommercialDemoData = async () => {
    setIsPurgingDemo(true);
    setShowPurgeConfirmModal(false);
    try {
      const res = await purgeAllDemoAndShadowData();
      if (res.success) {
        showSuccessToast(res.message);
      } else {
        showErrorToast(res.message);
      }
    } catch (e: any) {
      showErrorToast(e.message || 'Gagal membersihkan data demo.');
    } finally {
      setIsPurgingDemo(false);
    }
  };

  const handleSyncFirebase = async (initialOnly: boolean = false) => {
    setIsSyncingFirebase(true);
    try {
      const res = initialOnly 
        ? await syncInitialMasterDataToFirestore()
        : await syncAllDataToFirestore();
      if (res.success) {
        showSuccessToast(res.message);
      }
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const [activeMasterTab, setActiveMasterTab] = useState<'sekolah' | 'pengguna' | 'pos' | 'shift' | 'tahun-ajaran'>(() => {
    try {
      const saved = localStorage.getItem('e_piket_masterdata_tab');
      if (saved && ['sekolah', 'pengguna', 'pos', 'shift', 'tahun-ajaran'].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return 'pengguna';
  });

  useEffect(() => {
    try {
      localStorage.setItem('e_piket_masterdata_tab', activeMasterTab);
    } catch (e) {}
  }, [activeMasterTab]);

  const [searchQuery, setSearchQuery] = useState('');

  // -------------------------------------------------------------
  // MULTI-SELECTION (BULK DELETION) STATES
  // -------------------------------------------------------------
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);

  // Clear selections whenever tab changes
  useEffect(() => {
    setSelectedUserIds([]);
    setSelectedPostIds([]);
    setSelectedShiftIds([]);
  }, [activeMasterTab]);

  // -------------------------------------------------------------
  // SORTING STATES
  // -------------------------------------------------------------
  // Master Pengguna sorting
  const [userSortField, setUserSortField] = useState<'nama' | 'username' | 'role' | 'nip' | 'jabatan' | 'statusAktif'>('nama');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');

  // Master Pos Piket sorting
  const [postSortField, setPostSortField] = useState<'namaPos' | 'lokasi' | 'petugasRequiredCount' | 'statusAktif'>('namaPos');
  const [postSortOrder, setPostSortOrder] = useState<'asc' | 'desc'>('asc');

  // Master Shift Piket sorting
  const [shiftSortField, setShiftSortField] = useState<'jamMulai' | 'namaShift' | 'jamSelesai'>('jamMulai');
  const [shiftSortOrder, setShiftSortOrder] = useState<'asc' | 'desc'>('asc');

  // Delete Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    itemName: string;
    itemDetails?: string;
    requireTypingConfirmation?: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    itemName: '',
    onConfirm: async () => {}
  });

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCategoryTarget, setImportCategoryTarget] = useState<'pengguna' | 'pos' | 'shift'>('pengguna');

  // Modals state
  const [showBatchMultiModal, setShowBatchMultiModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userPhotoCompression, setUserPhotoCompression] = useState<CompressionResult | null>(null);
  const userFileInputRef = useRef<HTMLInputElement | null>(null);
  const [userFormData, setUserFormData] = useState<Omit<User, 'id'>>({
    nama: '',
    username: '',
    pin: '123456',
    password: 'password123',
    email: '',
    nomorHP: '',
    role: 'guru',
    nip: '',
    nuptk: '',
    jabatan: '',
    unitKerja: 'Dewan Guru',
    foto: '',
    statusAktif: true
  });

  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postFormData, setPostFormData] = useState<Omit<DutyPost, 'id'>>({
    namaPos: '',
    lokasi: '',
    deskripsi: '',
    petugasRequiredCount: 1,
    statusAktif: true
  });

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftFormData, setShiftFormData] = useState<Omit<Shift, 'id'>>({
    namaShift: '',
    jamMulai: '06:30',
    jamSelesai: '10:00',
    keterangan: '',
    statusAktif: true
  });

  const [schoolForm, setSchoolForm] = useState<School>(() => school || {
    id: 'sch-001',
    nama: 'Sekolah Pengguna e-Piket',
    npsn: '',
    alamat: 'Jl. Pendidikan Sekolah',
    email: '',
    nomorTelepon: '',
    logo: '',
    kepalaSekolah: '',
    nipKepsek: '',
    jamOperasionalMulai: '06:30',
    jamOperasionalSelesai: '16:30',
    toleransiKeterlambatanMenit: 15,
    latitude: -6.2088,
    longitude: 106.8456,
    radiusPresensiMeter: 250,
    aktif: true
  });

  useEffect(() => {
    if (school) {
      setSchoolForm(school);
    }
  }, [school]);

  // -------------------------------------------------------------
  // SORTED & FILTERED DATA LISTS
  // -------------------------------------------------------------
  const filteredAndSortedUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = users.filter((u) => 
      u.nama.toLowerCase().includes(q) || 
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.nomorHP && u.nomorHP.includes(q)) ||
      (u.nip && u.nip.includes(q)) ||
      (u.jabatan && u.jabatan.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );

    list.sort((a, b) => {
      let comparison = 0;
      if (userSortField === 'nama') {
        comparison = a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' });
      } else if (userSortField === 'username') {
        comparison = (a.username || '').localeCompare(b.username || '', 'id');
      } else if (userSortField === 'role') {
        comparison = a.role.localeCompare(b.role);
      } else if (userSortField === 'nip') {
        comparison = (a.nip || '').localeCompare(b.nip || '');
      } else if (userSortField === 'jabatan') {
        comparison = (a.jabatan || '').localeCompare(b.jabatan || '', 'id');
      } else if (userSortField === 'statusAktif') {
        comparison = (a.statusAktif === b.statusAktif ? 0 : a.statusAktif ? -1 : 1);
      }
      return userSortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [users, searchQuery, userSortField, userSortOrder]);

  const filteredAndSortedPosts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = posts.filter((p) =>
      p.namaPos.toLowerCase().includes(q) ||
      p.lokasi.toLowerCase().includes(q) ||
      (p.deskripsi && p.deskripsi.toLowerCase().includes(q))
    );

    list.sort((a, b) => {
      let comparison = 0;
      if (postSortField === 'namaPos') {
        comparison = a.namaPos.localeCompare(b.namaPos, 'id');
      } else if (postSortField === 'lokasi') {
        comparison = a.lokasi.localeCompare(b.lokasi, 'id');
      } else if (postSortField === 'petugasRequiredCount') {
        comparison = a.petugasRequiredCount - b.petugasRequiredCount;
      } else if (postSortField === 'statusAktif') {
        comparison = (a.statusAktif === b.statusAktif ? 0 : a.statusAktif ? -1 : 1);
      }
      return postSortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [posts, searchQuery, postSortField, postSortOrder]);

  const filteredAndSortedShifts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = shifts.filter((s) =>
      s.namaShift.toLowerCase().includes(q) ||
      (s.keterangan && s.keterangan.toLowerCase().includes(q)) ||
      s.jamMulai.includes(q) ||
      s.jamSelesai.includes(q)
    );

    list.sort((a, b) => {
      let comparison = 0;
      if (shiftSortField === 'jamMulai') {
        comparison = a.jamMulai.localeCompare(b.jamMulai);
      } else if (shiftSortField === 'namaShift') {
        comparison = a.namaShift.localeCompare(b.namaShift, 'id');
      } else if (shiftSortField === 'jamSelesai') {
        comparison = a.jamSelesai.localeCompare(b.jamSelesai);
      }
      return shiftSortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [shifts, searchQuery, shiftSortField, shiftSortOrder]);

  // -------------------------------------------------------------
  // SORT HANDLERS
  // -------------------------------------------------------------
  const handleSortUser = (field: typeof userSortField) => {
    if (userSortField === field) {
      setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortField(field);
      setUserSortOrder('asc');
    }
  };

  const handleSortPost = (field: typeof postSortField) => {
    if (postSortField === field) {
      setPostSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPostSortField(field);
      setPostSortOrder('asc');
    }
  };

  const handleSortShift = (field: typeof shiftSortField) => {
    if (shiftSortField === field) {
      setShiftSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setShiftSortField(field);
      setShiftSortOrder('asc');
    }
  };

  // -------------------------------------------------------------
  // MULTI-SELECTION HANDLERS
  // -------------------------------------------------------------
  const toggleSelectUser = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllUsers = () => {
    if (selectedUserIds.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredAndSortedUsers.map(u => u.id));
    }
  };

  const toggleSelectPost = (id: string) => {
    setSelectedPostIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPosts = () => {
    if (selectedPostIds.length === filteredAndSortedPosts.length && filteredAndSortedPosts.length > 0) {
      setSelectedPostIds([]);
    } else {
      setSelectedPostIds(filteredAndSortedPosts.map(p => p.id));
    }
  };

  const toggleSelectShift = (id: string) => {
    setSelectedShiftIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllShifts = () => {
    if (selectedShiftIds.length === filteredAndSortedShifts.length && filteredAndSortedShifts.length > 0) {
      setSelectedShiftIds([]);
    } else {
      setSelectedShiftIds(filteredAndSortedShifts.map(s => s.id));
    }
  };

  // -------------------------------------------------------------
  // BULK DELETE HANDLERS
  // -------------------------------------------------------------
  const handleBatchDeleteUsers = () => {
    if (selectedUserIds.length === 0) return;
    const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
    const previewNames = selectedUsers.slice(0, 5).map(u => u.nama).join(', ');
    const moreText = selectedUsers.length > 5 ? ` (+${selectedUsers.length - 5} pengguna lainnya)` : '';

    setDeleteModalState({
      isOpen: true,
      title: `Konfirmasi Hapus Massal (${selectedUserIds.length} Pengguna)`,
      itemName: `${selectedUserIds.length} Akun Pengguna Terpilih`,
      itemDetails: `Pengguna: ${previewNames}${moreText}. Seluruh data akun akan dihapus permanen dari sistem dan cloud database.`,
      requireTypingConfirmation: selectedUserIds.length >= 5,
      onConfirm: async () => {
        const res = await deleteMultipleUsers(selectedUserIds);
        setSelectedUserIds([]);
        showSuccessToast(`Berhasil menghapus ${res.count} pengguna sekaligus.`);
      }
    });
  };

  const handleBatchDeletePosts = () => {
    if (selectedPostIds.length === 0) return;
    const selectedPosts = posts.filter(p => selectedPostIds.includes(p.id));
    const previewNames = selectedPosts.map(p => p.namaPos).join(', ');

    setDeleteModalState({
      isOpen: true,
      title: `Konfirmasi Hapus Massal (${selectedPostIds.length} Pos Piket)`,
      itemName: `${selectedPostIds.length} Pos Piket Terpilih`,
      itemDetails: `Pos: ${previewNames}. Data pos ini akan dihapus permanen dari sistem dan cloud database.`,
      requireTypingConfirmation: selectedPostIds.length >= 4,
      onConfirm: async () => {
        const res = await deleteMultiplePosts(selectedPostIds);
        setSelectedPostIds([]);
        showSuccessToast(`Berhasil menghapus ${res.count} pos piket.`);
      }
    });
  };

  const handleBatchDeleteShifts = () => {
    if (selectedShiftIds.length === 0) return;
    const selectedShifts = shifts.filter(s => selectedShiftIds.includes(s.id));
    const previewNames = selectedShifts.map(s => s.namaShift).join(', ');

    setDeleteModalState({
      isOpen: true,
      title: `Konfirmasi Hapus Massal (${selectedShiftIds.length} Shift)`,
      itemName: `${selectedShiftIds.length} Shift Piket Terpilih`,
      itemDetails: `Shift: ${previewNames}. Data shift ini akan dihapus permanen dari sistem dan cloud database.`,
      requireTypingConfirmation: selectedShiftIds.length >= 3,
      onConfirm: async () => {
        const res = await deleteMultipleShifts(selectedShiftIds);
        setSelectedShiftIds([]);
        showSuccessToast(`Berhasil menghapus ${res.count} shift piket.`);
      }
    });
  };

  // -------------------------------------------------------------
  // SINGLE CRUD MODAL OPENERS
  // -------------------------------------------------------------
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUserId(user.id);
      setUserFormData({
        nama: user.nama,
        username: user.username || user.email.split('@')[0].toLowerCase(),
        pin: user.pin || '123456',
        password: user.password || 'password123',
        email: user.email,
        nomorHP: user.nomorHP,
        role: user.role,
        nip: user.nip || '',
        nuptk: user.nuptk || '',
        jabatan: user.jabatan,
        unitKerja: user.unitKerja || 'Dewan Guru',
        foto: user.foto || '',
        statusAktif: user.statusAktif
      });
    } else {
      setEditingUserId(null);
      setUserFormData({
        nama: '',
        username: '',
        pin: '123456',
        password: 'password123',
        email: '',
        nomorHP: '',
        role: 'guru',
        nip: '',
        nuptk: '',
        jabatan: '',
        unitKerja: 'Dewan Guru',
        foto: '',
        statusAktif: true
      });
    }
    setUserPhotoCompression(null);
    setShowUserModal(true);
  };

  const handleUserPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const comp = await compressImageAuto(file, {
        maxDimension: 800,
        quality: 0.75,
        mimeType: 'image/jpeg'
      });
      setUserPhotoCompression(comp);
      setUserFormData((prev) => ({ ...prev, foto: comp.dataUrl }));
    } catch (err: any) {
      showErrorToast(`Gagal mengompresi foto: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUserId) {
      await updateUser(editingUserId, userFormData);
      showSuccessToast(`Perubahan pengguna '${userFormData.nama}' berhasil disimpan.`);
    } else {
      await createUser(userFormData);
      showSuccessToast(`Pengguna baru '${userFormData.nama}' berhasil ditambahkan.`);
    }
    setShowUserModal(false);
  };

  const handleOpenPostModal = (post?: DutyPost) => {
    if (post) {
      setEditingPostId(post.id);
      setPostFormData({
        namaPos: post.namaPos,
        lokasi: post.lokasi,
        deskripsi: post.deskripsi,
        petugasRequiredCount: post.petugasRequiredCount,
        statusAktif: post.statusAktif
      });
    } else {
      setEditingPostId(null);
      setPostFormData({
        namaPos: '',
        lokasi: '',
        deskripsi: '',
        petugasRequiredCount: 1,
        statusAktif: true
      });
    }
    setShowPostModal(true);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPostId) {
      await updatePost(editingPostId, postFormData);
      showSuccessToast(`Pos piket '${postFormData.namaPos}' berhasil diperbarui.`);
    } else {
      await createPost(postFormData);
      showSuccessToast(`Pos piket '${postFormData.namaPos}' berhasil ditambahkan.`);
    }
    setShowPostModal(false);
  };

  const handleOpenShiftModal = (shift?: Shift) => {
    if (shift) {
      setEditingShiftId(shift.id);
      setShiftFormData({
        namaShift: shift.namaShift,
        jamMulai: shift.jamMulai,
        jamSelesai: shift.jamSelesai,
        keterangan: shift.keterangan || '',
        statusAktif: shift.statusAktif
      });
    } else {
      setEditingShiftId(null);
      setShiftFormData({
        namaShift: '',
        jamMulai: '06:30',
        jamSelesai: '10:00',
        keterangan: '',
        statusAktif: true
      });
    }
    setShowShiftModal(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingShiftId) {
      await updateShift(editingShiftId, shiftFormData);
      showSuccessToast(`Shift '${shiftFormData.namaShift}' berhasil diperbarui.`);
    } else {
      await createShift(shiftFormData);
      showSuccessToast(`Shift '${shiftFormData.namaShift}' berhasil ditambahkan.`);
    }
    setShowShiftModal(false);
  };

  const handleSaveSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSchool(schoolForm);
    showSuccessToast('Data profil sekolah berhasil diperbarui.');
  };

  const handleExportUsers = () => {
    const data = filteredAndSortedUsers.map((u, i) => ({
      No: i + 1,
      'Nama Lengkap': u.nama,
      'Username': u.username || '',
      'Role': u.role.toUpperCase(),
      'NIP': u.nip || '-',
      'NUPTK': u.nuptk || '-',
      'Jabatan': u.jabatan,
      'Unit Kerja': u.unitKerja || '',
      'Email': u.email,
      'No. HP': u.nomorHP,
      'PIN Masuk': u.pin || '123456',
      'Status': u.statusAktif ? 'Aktif' : 'Non-Aktif'
    }));
    exportToExcel(`Master_Pengguna_${new Date().toISOString().split('T')[0]}`, [
      { name: 'Master Pengguna', data }
    ]);
  };

  const handleExportPosts = () => {
    const data = filteredAndSortedPosts.map((p, i) => ({
      No: i + 1,
      'Nama Pos': p.namaPos,
      'Lokasi': p.lokasi,
      'Jumlah Petugas': p.petugasRequiredCount,
      'Deskripsi': p.deskripsi || '-',
      'Status': p.statusAktif ? 'Aktif' : 'Non-Aktif'
    }));
    exportToExcel(`Master_Pos_Piket_${new Date().toISOString().split('T')[0]}`, [
      { name: 'Master Pos Piket', data }
    ]);
  };

  const handleExportShifts = () => {
    const data = filteredAndSortedShifts.map((s, i) => ({
      No: i + 1,
      'Nama Shift': s.namaShift,
      'Jam Mulai': s.jamMulai,
      'Jam Selesai': s.jamSelesai,
      'Keterangan': s.keterangan || '-',
      'Status': s.statusAktif ? 'Aktif' : 'Non-Aktif'
    }));
    exportToExcel(`Master_Shift_${new Date().toISOString().split('T')[0]}`, [
      { name: 'Master Shift', data }
    ]);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Master Data Sistem
            </h1>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
              isFirestoreConnected 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}>
              <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>{isFirestoreConnected ? 'Cloud Firebase Aktif' : 'Offline Mode'}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Pusat konfigurasi data sekolah, master pengguna & guru ({users.filter(u => u.role === 'guru' || u.role === 'tendik').length} Guru/PTK), pos piket, shift, dan tahun ajaran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPurgeConfirmModal(true)}
            disabled={isPurgingDemo}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
            title="Hapus semua data demo guru, kepsek dummy, dan jadwal bayangan di Firebase"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>{isPurgingDemo ? 'Membersihkan Firebase...' : 'Bersihkan Data Demo Firebase'}</span>
          </button>

          <div className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Realtime Database Otomatis</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        <button
          onClick={() => setActiveMasterTab('pengguna')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeMasterTab === 'pengguna'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pengguna & Guru ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveMasterTab('pos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeMasterTab === 'pos'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Pos Piket ({posts.length})</span>
        </button>

        <button
          onClick={() => setActiveMasterTab('shift')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeMasterTab === 'shift'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shift Piket ({shifts.length})</span>
        </button>

        <button
          onClick={() => setActiveMasterTab('sekolah')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeMasterTab === 'sekolah'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Profil Sekolah</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: MASTER PENGGUNA (GURU & TENAGA KEPENDIDIKAN)       */}
      {/* ========================================================= */}
      {activeMasterTab === 'pengguna' && (
        <div className="space-y-4">
          
          {/* Top Bar: Search, Sort Dropdown & Action Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
              
              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, NIP, username..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Quick Sort Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                <select
                  value={userSortField}
                  onChange={(e) => setUserSortField(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 border-none outline-none py-1 pr-1 cursor-pointer"
                  title="Urutkan berdasarkan kolom"
                >
                  <option value="nama">Nama Guru</option>
                  <option value="username">Username</option>
                  <option value="role">Role / Peran</option>
                  <option value="nip">NIP / NUPTK</option>
                  <option value="jabatan">Jabatan</option>
                  <option value="statusAktif">Status</option>
                </select>

                <button
                  type="button"
                  onClick={() => setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition flex items-center gap-0.5 cursor-pointer"
                  title={userSortOrder === 'asc' ? 'Urutan: Naik (A-Z / 1-9)' : 'Urutan: Turun (Z-A / 9-1)'}
                >
                  {userSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />}
                  <span className="text-[10px] uppercase font-mono">{userSortOrder}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowBatchMultiModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>+ Multi Petugas Harian</span>
              </button>

              <button
                onClick={() => {
                  setImportCategoryTarget('pengguna');
                  setShowImportModal(true);
                }}
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Import Excel</span>
              </button>

              <button
                onClick={handleExportUsers}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={() => handleOpenUserModal()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Pengguna</span>
              </button>
            </div>
          </div>

          {/* DYNAMIC BULK ACTION BAR (When 1 or more users selected) */}
          {selectedUserIds.length > 0 && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                  {selectedUserIds.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-950 dark:text-rose-100 block">
                    {selectedUserIds.length} Pengguna Dipilih (dari total {filteredAndSortedUsers.length})
                  </span>
                  <span className="text-[11px] text-rose-800/80 dark:text-rose-300">
                    Aksi massal akan diterapkan pada seluruh data yang dicentang.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={toggleSelectAllUsers}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                >
                  {selectedUserIds.length === filteredAndSortedUsers.length ? 'Batal Pilih Semua' : `Pilih Semua (${filteredAndSortedUsers.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedUserIds([])}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleBatchDeleteUsers}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus ({selectedUserIds.length}) Pengguna Terpilih</span>
                </button>
              </div>
            </div>
          )}

          {/* Table View */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {/* Checkbox Select All Column */}
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                        onChange={toggleSelectAllUsers}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title="Pilih Semua Pengguna"
                      />
                    </th>
                    
                    {/* Sortable Column: Nama & Username */}
                    <th 
                      onClick={() => handleSortUser('nama')}
                      className="py-3 px-4 cursor-pointer select-none hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Nama &amp; Username</span>
                        {userSortField === 'nama' ? (
                          userSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>

                    {/* Sortable Column: Role */}
                    <th 
                      onClick={() => handleSortUser('role')}
                      className="py-3 px-4 cursor-pointer select-none hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Role</span>
                        {userSortField === 'role' ? (
                          userSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>

                    {/* Sortable Column: NIP */}
                    <th 
                      onClick={() => handleSortUser('nip')}
                      className="py-3 px-4 cursor-pointer select-none hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>NIP / NUPTK</span>
                        {userSortField === 'nip' ? (
                          userSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>

                    {/* Sortable Column: Jabatan */}
                    <th 
                      onClick={() => handleSortUser('jabatan')}
                      className="py-3 px-4 cursor-pointer select-none hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Jabatan &amp; Unit</span>
                        {userSortField === 'jabatan' ? (
                          userSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>

                    <th className="py-3 px-4">Kontak (No. WA)</th>

                    {/* Sortable Column: Status */}
                    <th 
                      onClick={() => handleSortUser('statusAktif')}
                      className="py-3 px-4 cursor-pointer select-none hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        {userSortField === 'statusAktif' ? (
                          userSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </th>

                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAndSortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        Tidak ada data pengguna yang sesuai pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <tr 
                          key={user.id} 
                          className={`transition-colors ${
                            isSelected 
                              ? 'bg-rose-50/50 dark:bg-rose-950/20' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          {/* Checkbox Column */}
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectUser(user.id)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>

                          {/* Nama & Username */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white" title={user.nama}>
                              {user.nama}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono font-semibold">
                                @{user.username || user.email.split('@')[0]}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                                PIN: {user.pin || '123456'}
                              </span>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              user.role === 'admin' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' :
                              user.role === 'kepsek' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800' :
                              user.role === 'guru' ? 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border border-teal-300 dark:border-teal-800' : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>

                          {/* NIP */}
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
                            {user.nip || user.nuptk || '-'}
                          </td>

                          {/* Jabatan */}
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                            <div>{user.jabatan}</div>
                            {user.unitKerja && (
                              <span className="text-[10px] text-slate-400 block">{user.unitKerja}</span>
                            )}
                          </td>

                          {/* Kontak */}
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold font-mono">
                            <div>{user.nomorHP || '-'}</div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              user.statusAktif ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {user.statusAktif ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>

                          {/* Aksi */}
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleOpenUserModal(user)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                              title="Edit Pengguna"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteModalState({
                                  isOpen: true,
                                  title: 'Konfirmasi Hapus Pengguna',
                                  itemName: user.nama,
                                  itemDetails: `Role: ${user.role.toUpperCase()} • Username: @${user.username || 'user'}`,
                                  onConfirm: async () => {
                                    await deleteUser(user.id);
                                    showSuccessToast(`Pengguna '${user.nama}' berhasil dihapus.`);
                                  }
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                              title="Hapus Pengguna"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MASTER POS PIKET                                   */}
      {/* ========================================================= */}
      {activeMasterTab === 'pos' && (
        <div className="space-y-4">
          
          {/* Top Bar: Search, Sort Dropdown & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama pos, lokasi..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                <select
                  value={postSortField}
                  onChange={(e) => setPostSortField(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 border-none outline-none py-1 pr-1 cursor-pointer"
                >
                  <option value="namaPos">Nama Pos</option>
                  <option value="lokasi">Lokasi</option>
                  <option value="petugasRequiredCount">Jumlah Petugas</option>
                  <option value="statusAktif">Status</option>
                </select>

                <button
                  type="button"
                  onClick={() => setPostSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition flex items-center gap-0.5 cursor-pointer"
                >
                  {postSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />}
                  <span className="text-[10px] uppercase font-mono">{postSortOrder}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setImportCategoryTarget('pos');
                  setShowImportModal(true);
                }}
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Import Pos Excel</span>
              </button>
              <button
                onClick={handleExportPosts}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => handleOpenPostModal()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Pos Piket</span>
              </button>
            </div>
          </div>

          {/* DYNAMIC BULK ACTION BAR (When 1 or more posts selected) */}
          {selectedPostIds.length > 0 && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                  {selectedPostIds.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-950 dark:text-rose-100 block">
                    {selectedPostIds.length} Pos Piket Dipilih (dari total {filteredAndSortedPosts.length})
                  </span>
                  <span className="text-[11px] text-rose-800/80 dark:text-rose-300">
                    Pos terpilih akan dihapus permanen dari sistem.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={toggleSelectAllPosts}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                >
                  {selectedPostIds.length === filteredAndSortedPosts.length ? 'Batal Pilih Semua' : `Pilih Semua (${filteredAndSortedPosts.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPostIds([])}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleBatchDeletePosts}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus ({selectedPostIds.length}) Pos Terpilih</span>
                </button>
              </div>
            </div>
          )}

          {/* Pos Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedPosts.map((post) => {
              const isSelected = selectedPostIds.includes(post.id);
              return (
                <div 
                  key={post.id} 
                  className={`bg-white dark:bg-slate-900 p-5 rounded-3xl border shadow-xs flex flex-col justify-between transition-all ${
                    isSelected 
                      ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/30 shadow-md shadow-rose-500/10' 
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPost(post.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="Pilih Pos"
                        />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{post.namaPos}</h3>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold">
                        {post.petugasRequiredCount} Petugas
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mb-2 flex items-center gap-1 ml-6">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{post.lokasi}</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 ml-6">{post.deskripsi}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleOpenPostModal(post)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer"
                      title="Edit Pos"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteModalState({
                          isOpen: true,
                          title: 'Konfirmasi Hapus Pos Piket',
                          itemName: post.namaPos,
                          itemDetails: `Lokasi: ${post.lokasi} • Kuota: ${post.petugasRequiredCount} orang`,
                          onConfirm: async () => {
                            await deletePost(post.id);
                            showSuccessToast(`Pos piket '${post.namaPos}' berhasil dihapus.`);
                          }
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg cursor-pointer"
                      title="Hapus Pos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: MASTER SHIFT                                       */}
      {/* ========================================================= */}
      {activeMasterTab === 'shift' && (
        <div className="space-y-4">
          
          {/* Top Bar: Search, Sort Dropdown & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama shift, jam..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                <select
                  value={shiftSortField}
                  onChange={(e) => setShiftSortField(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 border-none outline-none py-1 pr-1 cursor-pointer"
                >
                  <option value="jamMulai">Jam Mulai</option>
                  <option value="namaShift">Nama Shift</option>
                  <option value="jamSelesai">Jam Selesai</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShiftSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition flex items-center gap-0.5 cursor-pointer"
                >
                  {shiftSortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />}
                  <span className="text-[10px] uppercase font-mono">{shiftSortOrder}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setImportCategoryTarget('shift');
                  setShowImportModal(true);
                }}
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Import Shift Excel</span>
              </button>
              <button
                onClick={handleExportShifts}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => handleOpenShiftModal()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Shift</span>
              </button>
            </div>
          </div>

          {/* DYNAMIC BULK ACTION BAR (When 1 or more shifts selected) */}
          {selectedShiftIds.length > 0 && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                  {selectedShiftIds.length}
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-950 dark:text-rose-100 block">
                    {selectedShiftIds.length} Shift Piket Dipilih (dari total {filteredAndSortedShifts.length})
                  </span>
                  <span className="text-[11px] text-rose-800/80 dark:text-rose-300">
                    Shift terpilih akan dihapus permanen dari sistem.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={toggleSelectAllShifts}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                >
                  {selectedShiftIds.length === filteredAndSortedShifts.length ? 'Batal Pilih Semua' : `Pilih Semua (${filteredAndSortedShifts.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedShiftIds([])}
                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleBatchDeleteShifts}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus ({selectedShiftIds.length}) Shift Terpilih</span>
                </button>
              </div>
            </div>
          )}

          {/* Shift Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredAndSortedShifts.map((shift) => {
              const isSelected = selectedShiftIds.includes(shift.id);
              return (
                <div 
                  key={shift.id} 
                  className={`bg-white dark:bg-slate-900 p-5 rounded-3xl border shadow-xs flex flex-col justify-between transition-all ${
                    isSelected 
                      ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/30 shadow-md shadow-rose-500/10' 
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectShift(shift.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="Pilih Shift"
                        />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{shift.namaShift}</h3>
                      </div>
                      <Clock className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-lg font-black text-emerald-800 dark:text-emerald-400 font-mono my-2 ml-6">
                      {shift.jamMulai} - {shift.jamSelesai} WIB
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 ml-6">{shift.keterangan || '-'}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenShiftModal(shift)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg cursor-pointer"
                      title="Edit Shift"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteModalState({
                          isOpen: true,
                          title: 'Konfirmasi Hapus Shift Piket',
                          itemName: shift.namaShift,
                          itemDetails: `Jam: ${shift.jamMulai} - ${shift.jamSelesai} WIB`,
                          onConfirm: async () => {
                            await deleteShift(shift.id);
                            showSuccessToast(`Shift '${shift.namaShift}' berhasil dihapus.`);
                          }
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg cursor-pointer"
                      title="Hapus Shift"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: MASTER SEKOLAH & GPS GEOFENCE CONFIG               */}
      {/* ========================================================= */}
      {activeMasterTab === 'sekolah' && (
        <div className="space-y-6 max-w-4xl">
          {/* 1. School GPS & Geofence Lock Config Panel */}
          <SchoolGpsConfigPanel
            school={school}
            onUpdateSchool={async (updated) => {
              setSchoolForm(prev => ({ ...prev, ...updated }));
              await updateSchool(updated);
            }}
          />

          {/* 2. School Profile & Metadata */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Profil & Identitas Resmi Sekolah</h3>
            
            <form onSubmit={handleSaveSchool} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Nama Sekolah</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.nama}
                    onChange={(e) => setSchoolForm({ ...schoolForm, nama: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">NPSN</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.npsn}
                    onChange={(e) => setSchoolForm({ ...schoolForm, npsn: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  required
                  value={schoolForm.alamat}
                  onChange={(e) => setSchoolForm({ ...schoolForm, alamat: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Kepala Sekolah</label>
                  <input
                    type="text"
                    required
                    value={schoolForm.kepalaSekolah}
                    onChange={(e) => setSchoolForm({ ...schoolForm, kepalaSekolah: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">NIP Kepala Sekolah</label>
                  <input
                    type="text"
                    value={schoolForm.nipKepsek}
                    onChange={(e) => setSchoolForm({ ...schoolForm, nipKepsek: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Email Sekolah</label>
                  <input
                    type="email"
                    value={schoolForm.email}
                    onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Telepon</label>
                  <input
                    type="text"
                    value={schoolForm.nomorTelepon}
                    onChange={(e) => setSchoolForm({ ...schoolForm, nomorTelepon: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Toleransi Keterlambatan (Menit)</label>
                  <input
                    type="number"
                    value={schoolForm.toleransiKeterlambatanMenit}
                    onChange={(e) => setSchoolForm({ ...schoolForm, toleransiKeterlambatanMenit: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  Simpan Profil Sekolah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS: USER / POS / SHIFT / BATCH / DELETE / IMPORT      */}
      {/* ========================================================= */}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingUserId ? 'Edit Data Pengguna' : '+ Tambah Pengguna Baru'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3">
              {/* Photo Upload & Avatar Preview */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="relative shrink-0">
                  {userFormData.foto ? (
                    <img
                      src={userFormData.foto}
                      alt={userFormData.nama || 'User'}
                      className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-emerald-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
                      {userFormData.nama?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => userFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{userFormData.foto ? 'Ganti Foto' : 'Upload Foto'}</span>
                    </button>
                    {userFormData.foto && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserFormData((prev) => ({ ...prev, foto: '' }));
                          setUserPhotoCompression(null);
                        }}
                        className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-[11px] font-bold transition cursor-pointer"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={userFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUserPhotoUpload}
                    className="hidden"
                  />
                  {userPhotoCompression ? (
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono mt-1 truncate">
                      ✓ Kompresi: {userPhotoCompression.originalSizeFormatted} ➔ {userPhotoCompression.compressedSizeFormatted} (-{userPhotoCompression.savingsPercentage}%)
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Foto otomatis dikompres hemat ruang penyimpanan.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={userFormData.nama}
                  onChange={(e) => setUserFormData({ ...userFormData, nama: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  placeholder="Nama lengkap dan gelar"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-emerald-800 dark:text-emerald-400 mb-1">Username Akun</label>
                  <input
                    type="text"
                    required
                    value={userFormData.username || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                    placeholder="Contoh: guru1 / bambang"
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Role / Peran</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="guru">Guru</option>
                    <option value="tendik">Tenaga Kependidikan</option>
                    <option value="kepsek">Kepala Sekolah</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    placeholder="nama@sekolah.sch.id"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={userFormData.nomorHP}
                    onChange={(e) => setUserFormData({ ...userFormData, nomorHP: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    placeholder="08123456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">NIP</label>
                  <input
                    type="text"
                    value={userFormData.nip}
                    onChange={(e) => setUserFormData({ ...userFormData, nip: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                    placeholder="19850101..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Jabatan</label>
                  <input
                    type="text"
                    value={userFormData.jabatan}
                    onChange={(e) => setUserFormData({ ...userFormData, jabatan: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    placeholder="Guru Matematika"
                  />
                </div>
              </div>

              {/* Kredensial Keamanan PIN & Kata Sandi */}
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    <span>Autentikasi PIN & Sandi Akun</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUserFormData((prev) => ({
                        ...prev,
                        pin: '123456',
                        password: 'password123'
                      }));
                      showSuccessToast('PIN & kata sandi direset ke default (123456 / password123)');
                    }}
                    className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                  >
                    Reset Default (123456 / password123)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-emerald-950 dark:text-emerald-200 mb-1">
                      PIN Masuk (4-8 Digit)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      required
                      value={userFormData.pin ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setUserFormData((prev) => ({ ...prev, pin: val }));
                      }}
                      placeholder="123456"
                      className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl font-mono font-bold text-center tracking-widest text-emerald-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold uppercase text-emerald-950 dark:text-emerald-200 mb-1">
                      Kata Sandi Alternatif
                    </label>
                    <input
                      type="text"
                      required
                      value={userFormData.password ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUserFormData((prev) => ({ ...prev, password: val }));
                      }}
                      placeholder="password123"
                      className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl font-mono text-emerald-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 cursor-pointer">
                  Simpan
                </button>
                <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST MODAL */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingPostId ? 'Edit Pos Piket' : '+ Tambah Pos Piket'}
            </h3>

            <form onSubmit={handleSavePost} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Nama Pos</label>
                <input
                  type="text"
                  required
                  value={postFormData.namaPos}
                  onChange={(e) => setPostFormData({ ...postFormData, namaPos: e.target.value })}
                  placeholder="Contoh: Pos 1: Gerbang Utama"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Lokasi</label>
                <input
                  type="text"
                  required
                  value={postFormData.lokasi}
                  onChange={(e) => setPostFormData({ ...postFormData, lokasi: e.target.value })}
                  placeholder="Pintu Gerbang Depan"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Jumlah Petugas Wajib</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={postFormData.petugasRequiredCount}
                  onChange={(e) => setPostFormData({ ...postFormData, petugasRequiredCount: Number(e.target.value) })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Deskripsi Tugas</label>
                <textarea
                  rows={2}
                  value={postFormData.deskripsi}
                  onChange={(e) => setPostFormData({ ...postFormData, deskripsi: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 cursor-pointer">
                  Simpan
                </button>
                <button type="button" onClick={() => setShowPostModal(false)} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingShiftId ? 'Edit Shift Piket' : '+ Tambah Shift Piket'}
            </h3>

            <form onSubmit={handleSaveShift} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Nama Shift</label>
                <input
                  type="text"
                  required
                  value={shiftFormData.namaShift}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, namaShift: e.target.value })}
                  placeholder="Contoh: Piket Pagi (Sambut Siswa)"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={shiftFormData.jamMulai}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, jamMulai: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={shiftFormData.jamSelesai}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, jamSelesai: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={shiftFormData.keterangan}
                  onChange={(e) => setShiftFormData({ ...shiftFormData, keterangan: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 cursor-pointer">
                  Simpan
                </button>
                <button type="button" onClick={() => setShowShiftModal(false)} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH MULTI PETUGAS SCHEDULE MODAL */}
      <BatchMultiScheduleModal
        isOpen={showBatchMultiModal}
        onClose={() => setShowBatchMultiModal(false)}
      />

      {/* CONFIRM DELETE MODAL (Single & Multi-Delete) */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalState.onConfirm}
        title={deleteModalState.title}
        itemName={deleteModalState.itemName}
        itemDetails={deleteModalState.itemDetails}
        requireTypingConfirmation={deleteModalState.requireTypingConfirmation}
      />

      {/* CONFIRM PURGE COMMERCIAL DEMO DATA MODAL */}
      <ConfirmDeleteModal
        isOpen={showPurgeConfirmModal}
        onClose={() => setShowPurgeConfirmModal(false)}
        onConfirm={handlePurgeCommercialDemoData}
        title="Bersihkan Semua Data Demo & Bayangan Firebase"
        itemName="Seluruh Akun Dummy & Data Simulasi"
        itemDetails="Sistem akan menghapus seluruh data guru demo, akun bayangan (user-kepsek/Dr. H. Ahmad Dahlan, user-ptk-*, guru-*), jadwal demo, dan logbook simulasi dari Firebase Firestore dan penyimpanan lokal. Data asli sekolah tidak akan terhapus."
        requireTypingConfirmation={false}
      />

      {/* IMPORT MASTER DATA MODAL */}
      <ImportMasterDataModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        initialCategory={importCategoryTarget}
      />

    </div>
  );
};
