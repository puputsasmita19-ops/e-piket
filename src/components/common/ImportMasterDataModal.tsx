import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Users, 
  MapPin, 
  Clock, 
  FileCheck, 
  ShieldCheck, 
  ShieldAlert,
  Search, 
  Check, 
  Copy,
  AlertOctagon,
  XCircle,
  FileWarning,
  Activity,
  Layers,
  ArrowRight,
  Database,
  Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';
import { User, DutyPost, Shift, UserRole, ImportErrorItem, BatchImportResult } from '../../types';
import { 
  downloadUserImportTemplate, 
  downloadPostImportTemplate, 
  downloadShiftImportTemplate,
  exportImportErrorLog
} from '../../services/exportService';
import { sound, triggerConfetti, haptic } from '../../utils/feedback';

interface ImportMasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'pengguna' | 'pos' | 'shift';
}

type ImportCategory = 'pengguna' | 'pos' | 'shift';
type ImportMode = 'append' | 'update_existing';
type ProgressStage = 'idle' | 'validating' | 'duplicate_check' | 'committing' | 'finished' | 'aborted';

interface ParsedUserRow {
  index: number;
  nama: string;
  username: string;
  role: UserRole;
  nip: string;
  nuptk: string;
  jabatan: string;
  unitKerja: string;
  nomorHP: string;
  email: string;
  pin: string;
  password: string;
  statusAktif: boolean;
  isDuplicate: boolean;
  duplicateField?: string;
  validationError?: string;
}

interface ParsedPostRow {
  index: number;
  namaPos: string;
  lokasi: string;
  petugasRequiredCount: number;
  deskripsi: string;
  statusAktif: boolean;
  isDuplicate: boolean;
  validationError?: string;
}

interface ParsedShiftRow {
  index: number;
  namaShift: string;
  jamMulai: string;
  jamSelesai: string;
  keterangan: string;
  statusAktif: boolean;
  isDuplicate: boolean;
  validationError?: string;
}

export const ImportMasterDataModal: React.FC<ImportMasterDataModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'pengguna'
}) => {
  const { 
    users, 
    posts, 
    shifts, 
    importUsersBatch, 
    importPostsBatch, 
    importShiftsBatch 
  } = useData();

  const [category, setCategory] = useState<ImportCategory>(initialCategory);
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [isAtomicMode, setIsAtomicMode] = useState<boolean>(true); // Default atomic validation (All-or-Nothing)
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('');
  const [copiedErrorLog, setCopiedErrorLog] = useState(false);

  // Real-time Progress State
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<ProgressStage>('idle');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [processedItemCount, setProcessedItemCount] = useState<number>(0);

  // Parsed states
  const [parsedUsers, setParsedUsers] = useState<ParsedUserRow[]>([]);
  const [parsedPosts, setParsedPosts] = useState<ParsedPostRow[]>([]);
  const [parsedShifts, setParsedShifts] = useState<ParsedShiftRow[]>([]);

  // Detailed Result & Error Log state
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize category if initialCategory changes
  React.useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      resetState();
    }
  }, [isOpen, initialCategory]);

  const resetState = () => {
    setFile(null);
    setParsedUsers([]);
    setParsedPosts([]);
    setParsedShifts([]);
    setImportResult(null);
    setPreviewFilter('');
    setProgressPercent(0);
    setProgressStage('idle');
    setProgressMessage('');
    setProcessedItemCount(0);
    setCopiedErrorLog(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  // Helpers for checking valid identifier formats
  const isValidNipForCheck = (nip?: string | null): boolean => {
    if (!nip) return false;
    const clean = String(nip).trim().toLowerCase();
    if (['-', '--', '---', '0', 'none', 'null', 'n/a', 'na', 'tidak ada', 'belum ada', 'belum punya', ''].includes(clean)) {
      return false;
    }
    return clean.length >= 4;
  };

  const isValidEmailForCheck = (email?: string | null): boolean => {
    if (!email) return false;
    const clean = String(email).trim().toLowerCase();
    if (['-', '--', 'none', 'null', 'n/a', ''].includes(clean)) return false;
    return clean.includes('@') && clean.length >= 5;
  };

  const isValidUsernameForCheck = (username?: string | null): boolean => {
    if (!username) return false;
    const clean = String(username).trim().toLowerCase();
    return clean.length >= 3 && clean !== '-' && !clean.startsWith('user_temp');
  };

  // Helper to normalize cell value (handles numbers, scientific notation, and trimming)
  const cleanCellValue = (val: any): string => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'number') {
      if (Number.isInteger(val) || val > 1000000) {
        return BigInt(Math.round(val)).toString();
      }
      return String(val);
    }
    const str = String(val).trim();
    if (/^\d+\.?\d*e[+-]?\d+$/i.test(str)) {
      try {
        const num = Number(str);
        if (!isNaN(num)) {
          return BigInt(Math.round(num)).toString();
        }
      } catch {
        // fallback
      }
    }
    return str;
  };

  // Helper to extract value from row by multiple potential header keys
  const getVal = (row: any, ...keys: string[]): string => {
    if (!row || typeof row !== 'object') return '';
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        const cleaned = cleanCellValue(row[key]);
        if (cleaned !== '') return cleaned;
      }
      const targetNorm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const foundKey = Object.keys(row).find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        const cleaned = cleanCellValue(row[foundKey]);
        if (cleaned !== '') return cleaned;
      }
    }
    return '';
  };

  // Normalize time formats (e.g. 0.270833, "6:30", "06.30", "06:30:00")
  const formatExcelTime = (val: any, fallback: string): string => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') {
      if (val >= 0 && val <= 1) {
        const totalMinutes = Math.round(val * 24 * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    }
    const str = cleanCellValue(val).replace('.', ':');
    const match = str.match(/(\d{1,2})[:.](\d{2})/);
    if (match) {
      return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
    }
    return str.length >= 4 ? str : fallback;
  };

  const handleDownloadTemplate = () => {
    haptic.medium();
    if (category === 'pengguna') {
      downloadUserImportTemplate();
    } else if (category === 'pos') {
      downloadPostImportTemplate();
    } else {
      downloadShiftImportTemplate();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    const validExts = ['.xlsx', '.xls', '.csv'];
    const fileName = selectedFile.name.toLowerCase();
    const isValid = validExts.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      sound.playWarning();
      alert('Format file tidak didukung! Harap unggah file spreadsheet Excel (.xlsx, .xls) atau CSV (.csv).');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile, category);
  };

  const parseFile = async (targetFile: File, targetCategory: ImportCategory) => {
    setParsing(true);
    setImportResult(null);

    try {
      const data = await targetFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      
      let sheetName = workbook.SheetNames[0];
      if (targetCategory === 'pengguna') {
        const found = workbook.SheetNames.find((s) => {
          const lower = s.toLowerCase();
          return lower.includes('pengguna') || lower.includes('user') || lower.includes('guru') || lower.includes('ptk') || lower.includes('pegawai');
        });
        if (found) sheetName = found;
      } else if (targetCategory === 'pos') {
        const found = workbook.SheetNames.find((s) => s.toLowerCase().includes('pos'));
        if (found) sheetName = found;
      } else if (targetCategory === 'shift') {
        const found = workbook.SheetNames.find((s) => s.toLowerCase().includes('shift') || s.toLowerCase().includes('waktu'));
        if (found) sheetName = found;
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        alert('Lembar kerja spreadsheet tidak ditemukan.');
        setParsing(false);
        return;
      }

      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rawRows || rawRows.length === 0) {
        alert('File spreadsheet kosong atau tidak berisi data tabel.');
        setParsing(false);
        return;
      }

      // Detect header row index
      let headerRowIndex = 0;
      const headerKeywords = ['nama', 'nama lengkap', 'username', 'role', 'nip', 'pos', 'shift', 'guru', 'petugas', 'waktu', 'jam'];
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i];
        if (Array.isArray(row)) {
          const matchCount = row.filter((cell) => {
            const str = String(cell || '').toLowerCase().trim();
            return headerKeywords.some((k) => str.includes(k));
          }).length;
          if (matchCount >= 1) {
            headerRowIndex = i;
            break;
          }
        }
      }

      const headers = (rawRows[headerRowIndex] || []).map((h) => String(h || '').trim());
      const jsonData: any[] = [];

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const rowCells = rawRows[r];
        if (!Array.isArray(rowCells) || rowCells.every((c) => String(c || '').trim() === '')) {
          continue;
        }
        const rowObj: any = {};
        headers.forEach((h, colIdx) => {
          if (h) {
            rowObj[h] = rowCells[colIdx] !== undefined ? rowCells[colIdx] : '';
          }
        });
        jsonData.push(rowObj);
      }

      if (jsonData.length === 0) {
        alert('Tidak ditemukan baris data di file Excel. Pastikan data tidak kosong.');
        setParsing(false);
        return;
      }

      if (targetCategory === 'pengguna') {
        const parsed: ParsedUserRow[] = jsonData.map((row, idx) => {
          const rawNama = getVal(row, 'Nama Lengkap', 'Nama', 'Full Name', 'Nama Guru', 'Nama Pegawai', 'Nama PTK', 'Nama Guru / Tendik', 'Nama Petugas');
          let rawUsername = getVal(row, 'Username', 'User Name', 'Akun', 'ID Pengguna', 'User ID', 'User');
          const rawRole = getVal(row, 'Role', 'Role (guru/tendik/kepsek/admin)', 'Peran', 'Jenis PTK', 'Status Kepegawaian', 'Jabatan / Role').toLowerCase();
          const rawNip = getVal(row, 'NIP', 'Nomor Induk Pegawai', 'No NIP', 'NIP / NUPTK', 'NIP/NUPTK', 'No. NIP');
          const rawNuptk = getVal(row, 'NUPTK', 'No NUPTK', 'No. NUPTK');
          const rawJabatan = getVal(row, 'Jabatan', 'Tugas Tambahan', 'Posisi', 'Tugas');
          const rawUnit = getVal(row, 'Unit Kerja', 'Unit', 'Departemen', 'Bagian');
          const rawNomorHP = getVal(row, 'No WhatsApp', 'Nomor WA', 'No WA', 'No HP', 'Nomor HP', 'Telepon', 'WA', 'HP', 'Handphone', 'Kontak');
          const rawEmail = getVal(row, 'Email', 'Alamat Email', 'E-mail', 'Surat Elektronik');
          const rawPin = getVal(row, 'PIN Masuk (6 Angka)', 'PIN', 'PIN Masuk', 'PIN Akun', 'PIN Login');
          const rawPassword = getVal(row, 'Kata Sandi', 'Password', 'Sandi');
          const rawStatus = getVal(row, 'Status Aktif (Aktif/Nonaktif)', 'Status Aktif', 'Status', 'Keaktifan');

          let generatedUsername = rawUsername;
          if (!generatedUsername && rawNama) {
            generatedUsername = rawNama.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').substring(0, 16);
          } else if (generatedUsername) {
            generatedUsername = generatedUsername.toLowerCase().replace(/\s+/g, '');
          }

          let role: UserRole = 'guru';
          if (rawRole.includes('admin') || rawRole.includes('operator')) role = 'admin';
          else if (rawRole.includes('kepsek') || rawRole.includes('kepala')) role = 'kepsek';
          else if (rawRole.includes('tendik') || rawRole.includes('tu') || rawRole.includes('staf') || rawRole.includes('staff') || rawRole.includes('administrasi') || rawRole.includes('satpam') || rawRole.includes('penjaga')) role = 'tendik';
          else role = 'guru';

          let isDuplicate = false;
          let duplicateField = '';
          const dupByUsername = isValidUsernameForCheck(rawUsername) && users.some((u) => u.username && u.username.toLowerCase() === rawUsername.toLowerCase());
          const dupByNip = isValidNipForCheck(rawNip) && users.some((u) => isValidNipForCheck(u.nip) && u.nip!.trim() === rawNip.trim());
          const dupByEmail = isValidEmailForCheck(rawEmail) && users.some((u) => isValidEmailForCheck(u.email) && u.email!.toLowerCase() === rawEmail.toLowerCase());

          if (dupByUsername) {
            isDuplicate = true;
            duplicateField = `Username (@${rawUsername})`;
          } else if (dupByNip) {
            isDuplicate = true;
            duplicateField = `NIP (${rawNip})`;
          } else if (dupByEmail) {
            isDuplicate = true;
            duplicateField = `Email (${rawEmail})`;
          }

          let validationError = '';
          if (!rawNama || rawNama.trim().length < 2) {
            validationError = 'Nama Lengkap wajib diisi (minimal 2 karakter)';
          }

          const cleanPin = rawPin && /^\d{4,8}$/.test(rawPin) ? (rawPin.length === 6 ? rawPin : rawPin.padEnd(6, '0').slice(0, 6)) : '123456';
          const cleanEmail = isValidEmailForCheck(rawEmail) ? rawEmail : (generatedUsername ? `${generatedUsername}@sekolah.sch.id` : `user_${idx + 1}@sekolah.sch.id`);

          return {
            index: idx + 1,
            nama: rawNama,
            username: generatedUsername || `user_${idx + 1}`,
            role,
            nip: rawNip || '-',
            nuptk: rawNuptk || '-',
            jabatan: rawJabatan || (role === 'guru' ? 'Guru Mata Pelajaran' : role === 'tendik' ? 'Staff TU' : role === 'kepsek' ? 'Kepala Sekolah' : 'Pendidik'),
            unitKerja: rawUnit || (role === 'guru' ? 'Dewan Guru' : role === 'tendik' ? 'Tata Usaha (TU)' : 'Pimpinan Sekolah'),
            nomorHP: rawNomorHP || '-',
            email: cleanEmail,
            pin: cleanPin,
            password: rawPassword || 'password123',
            statusAktif: rawStatus.toLowerCase().includes('non') || rawStatus.toLowerCase().includes('tidak') || rawStatus.toLowerCase().includes('pasif') ? false : true,
            isDuplicate,
            duplicateField,
            validationError
          };
        });

        const validParsed = parsed.filter((p) => p.nama.trim() !== '');
        setParsedUsers(validParsed);
      } else if (targetCategory === 'pos') {
        const parsed: ParsedPostRow[] = jsonData.map((row, idx) => {
          const rawNamaPos = getVal(row, 'Nama Pos', 'Nama', 'Pos Piket', 'Pos', 'Nama Pos Piket', 'Nama Pos Pengawasan');
          const rawLokasi = getVal(row, 'Lokasi', 'Lokasi Pos', 'Tempat', 'Area', 'Ruangan');
          const rawCount = Number(getVal(row, 'Jumlah Petugas Wajib', 'Jumlah Petugas', 'Petugas', 'Kuota', 'Kapasitas', 'Petugas Wajib')) || 1;
          const rawDeskripsi = getVal(row, 'Deskripsi Tugas', 'Deskripsi', 'Keterangan', 'Tugas', 'Uraian Tugas');

          const isDuplicate = posts.some((p) => p.namaPos && p.namaPos.toLowerCase().trim() === rawNamaPos.toLowerCase().trim());
          let validationError = '';
          if (!rawNamaPos || rawNamaPos.trim().length < 2) validationError = 'Nama Pos wajib diisi (min. 2 karakter)';

          return {
            index: idx + 1,
            namaPos: rawNamaPos,
            lokasi: rawLokasi || 'Lingkungan Sekolah',
            petugasRequiredCount: rawCount > 0 ? rawCount : 1,
            deskripsi: rawDeskripsi || 'Melaksanakan pengawasan dan ketertiban pos piket.',
            statusAktif: true,
            isDuplicate,
            validationError
          };
        });

        const validParsed = parsed.filter((p) => p.namaPos.trim() !== '');
        setParsedPosts(validParsed);
      } else if (targetCategory === 'shift') {
        const parsed: ParsedShiftRow[] = jsonData.map((row, idx) => {
          const rawNamaShift = getVal(row, 'Nama Shift', 'Nama', 'Shift', 'Nama Sesi', 'Sesi');
          const rawMulai = formatExcelTime(row['Jam Mulai'] || row['Mulai'] || row['Waktu Mulai'] || getVal(row, 'Jam Mulai', 'Mulai', 'Waktu Mulai'), '06:30');
          const rawSelesai = formatExcelTime(row['Jam Selesai'] || row['Selesai'] || row['Waktu Selesai'] || getVal(row, 'Jam Selesai', 'Selesai', 'Waktu Selesai'), '10:00');
          const rawKet = getVal(row, 'Keterangan', 'Deskripsi', 'Catatan', 'Uraian');

          const isDuplicate = shifts.some((s) => s.namaShift && s.namaShift.toLowerCase().trim() === rawNamaShift.toLowerCase().trim());
          let validationError = '';
          if (!rawNamaShift || rawNamaShift.trim().length < 2) validationError = 'Nama Shift wajib diisi (min. 2 karakter)';

          return {
            index: idx + 1,
            namaShift: rawNamaShift,
            jamMulai: rawMulai,
            jamSelesai: rawSelesai,
            keterangan: rawKet || '-',
            statusAktif: true,
            isDuplicate,
            validationError
          };
        });

        const validParsed = parsed.filter((p) => p.namaShift.trim() !== '');
        setParsedShifts(validParsed);
      }

      sound.playSuccess();
      haptic.light();
    } catch (err) {
      console.error('Error parsing Excel:', err);
      sound.playWarning();
      alert('Gagal membaca file spreadsheet. Pastikan file tidak rusak dan format tabel sesuai.');
    } finally {
      setParsing(false);
    }
  };

  const handleCategorySwitch = (newCat: ImportCategory) => {
    haptic.light();
    setCategory(newCat);
    resetState();
  };

  // Helper delay to give visual feedback to the user
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleExecuteImport = async () => {
    setImporting(true);
    setImportResult(null);
    setProgressPercent(5);
    setProgressStage('validating');
    setProgressMessage('Memulai pemindaian integritas & validasi transaksi atomik...');

    try {
      if (category === 'pengguna') {
        const totalRows = parsedUsers.length;
        if (totalRows === 0) {
          alert('Tidak ada baris data pengguna untuk diimpor.');
          setImporting(false);
          return;
        }

        // Live visual progress step 1: Validating rows
        for (let i = 0; i < totalRows; i++) {
          const u = parsedUsers[i];
          setProcessedItemCount(i + 1);
          setProgressMessage(`[Tahap 1/3] Memverifikasi integritas baris #${i + 1}: ${u.nama || 'Tanpa Nama'}...`);
          setProgressPercent(Math.min(40, Math.round(((i + 1) / totalRows) * 35) + 5));
          if (totalRows > 15 && i % 8 === 0) await sleep(15);
        }

        await sleep(100);
        setProgressStage('duplicate_check');
        setProgressPercent(60);
        setProgressMessage('[Tahap 2/3] Memeriksa duplikasi NIP, email, dan identitas unik...');
        await sleep(150);

        setProgressStage('committing');
        setProgressPercent(80);
        setProgressMessage('[Tahap 3/3] Melakukan komit data atomik ke penyimpanan lokal & database...');

        const payload: Omit<User, 'id'>[] = parsedUsers.map((p) => ({
          nama: p.nama,
          username: p.username,
          role: p.role,
          nip: p.nip,
          nuptk: p.nuptk,
          jabatan: p.jabatan,
          unitKerja: p.unitKerja,
          nomorHP: p.nomorHP,
          email: p.email,
          pin: p.pin,
          password: p.password,
          statusAktif: p.statusAktif
        }));

        const res = await importUsersBatch(payload, importMode, { atomic: isAtomicMode });
        await sleep(200);

        if (res.success) {
          setProgressPercent(100);
          setProgressStage('finished');
          setProgressMessage('Proses impor data master pengguna selesai dengan sukses!');
          sound.playSuccess();
          haptic.success();
          triggerConfetti();
        } else {
          setProgressPercent(100);
          setProgressStage('aborted');
          setProgressMessage('Transaksi atomik dibatalkan: Seluruh perubahan di-rollback.');
          sound.playWarning();
          haptic.medium();
        }

        setImportResult(res);

      } else if (category === 'pos') {
        const totalRows = parsedPosts.length;
        if (totalRows === 0) {
          alert('Tidak ada baris data pos untuk diimpor.');
          setImporting(false);
          return;
        }

        for (let i = 0; i < totalRows; i++) {
          const p = parsedPosts[i];
          setProcessedItemCount(i + 1);
          setProgressMessage(`[Tahap 1/3] Memverifikasi data pos #${i + 1}: ${p.namaPos || 'Tanpa Nama'}...`);
          setProgressPercent(Math.min(45, Math.round(((i + 1) / totalRows) * 40) + 5));
          if (totalRows > 10 && i % 5 === 0) await sleep(15);
        }

        setProgressStage('committing');
        setProgressPercent(75);
        setProgressMessage('[Tahap 2/2] Melakukan komit pos piket ke database...');
        await sleep(150);

        const payload: Omit<DutyPost, 'id'>[] = parsedPosts.map((p) => ({
          namaPos: p.namaPos,
          lokasi: p.lokasi,
          petugasRequiredCount: p.petugasRequiredCount,
          deskripsi: p.deskripsi,
          statusAktif: p.statusAktif
        }));

        const res = await importPostsBatch(payload, importMode, { atomic: isAtomicMode });
        await sleep(150);

        if (res.success) {
          setProgressPercent(100);
          setProgressStage('finished');
          setProgressMessage('Proses impor master pos piket berhasil!');
          sound.playSuccess();
          haptic.success();
          triggerConfetti();
        } else {
          setProgressPercent(100);
          setProgressStage('aborted');
          setProgressMessage('Transaksi atomik pos piket dibatalkan.');
          sound.playWarning();
        }
        setImportResult(res);

      } else if (category === 'shift') {
        const totalRows = parsedShifts.length;
        if (totalRows === 0) {
          alert('Tidak ada baris data shift untuk diimpor.');
          setImporting(false);
          return;
        }

        for (let i = 0; i < totalRows; i++) {
          const s = parsedShifts[i];
          setProcessedItemCount(i + 1);
          setProgressMessage(`[Tahap 1/3] Memverifikasi jam shift #${i + 1}: ${s.namaShift}...`);
          setProgressPercent(Math.min(45, Math.round(((i + 1) / totalRows) * 40) + 5));
          if (totalRows > 10 && i % 5 === 0) await sleep(15);
        }

        setProgressStage('committing');
        setProgressPercent(75);
        setProgressMessage('[Tahap 2/2] Melakukan komit shift piket ke database...');
        await sleep(150);

        const payload: Omit<Shift, 'id'>[] = parsedShifts.map((s) => ({
          namaShift: s.namaShift,
          jamMulai: s.jamMulai,
          jamSelesai: s.jamSelesai,
          keterangan: s.keterangan,
          statusAktif: s.statusAktif
        }));

        const res = await importShiftsBatch(payload, importMode, { atomic: isAtomicMode });
        await sleep(150);

        if (res.success) {
          setProgressPercent(100);
          setProgressStage('finished');
          setProgressMessage('Proses impor master shift piket berhasil!');
          sound.playSuccess();
          haptic.success();
          triggerConfetti();
        } else {
          setProgressPercent(100);
          setProgressStage('aborted');
          setProgressMessage('Transaksi atomik shift piket dibatalkan.');
          sound.playWarning();
        }
        setImportResult(res);
      }
    } catch (e: any) {
      console.error('Import execution failed:', e);
      setProgressStage('aborted');
      sound.playWarning();
      alert(`Terjadi kesalahan saat memproses data: ${e.message || 'Kesalahan sistem'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleCopyErrorLog = () => {
    if (!importResult || importResult.errors.length === 0) return;
    const textLines = [
      `=== LOG KESALAHAN IMPORT DATA MASTER (${category.toUpperCase()}) ===`,
      `Waktu: ${new Date().toLocaleString('id-ID')}`,
      `Total Baris File: ${importResult.total}`,
      `Status Transaksi: ${importResult.success ? 'Berhasil Sebagian' : 'DIBATALKAN (Atomic Rollback)'}`,
      `Jumlah Error: ${importResult.errors.length}`,
      '--------------------------------------------------',
      ...importResult.errors.map(
        (err, i) =>
          `${i + 1}. [Baris #${err.rowNumber}] ${err.identifier} -> Kolom: ${err.field} | Nilai: '${err.rejectedValue || '-'}' | Error: ${err.errorMessage} (${err.critical ? 'KRITIKAL' : 'PERINGATAN'})`
      )
    ].join('\n');

    navigator.clipboard.writeText(textLines);
    setCopiedErrorLog(true);
    sound.playSuccess();
    setTimeout(() => setCopiedErrorLog(false), 3000);
  };

  const handleExportErrorsExcel = () => {
    if (!importResult || importResult.errors.length === 0) return;
    exportImportErrorLog(category, importResult.errors);
    sound.playSuccess();
  };

  // Stats calculation
  const totalUsersCount = parsedUsers.length;
  const validUsersCount = parsedUsers.filter((u) => !u.validationError).length;
  const duplicateUsersCount = parsedUsers.filter((u) => u.isDuplicate).length;
  const errorUsersCount = parsedUsers.filter((u) => u.validationError).length;

  const totalPostsCount = parsedPosts.length;
  const validPostsCount = parsedPosts.filter((p) => !p.validationError).length;
  const duplicatePostsCount = parsedPosts.filter((p) => p.isDuplicate).length;

  const totalShiftsCount = parsedShifts.length;
  const validShiftsCount = parsedShifts.filter((s) => !s.validationError).length;
  const duplicateShiftsCount = parsedShifts.filter((s) => s.isDuplicate).length;

  const hasData = (category === 'pengguna' && totalUsersCount > 0) ||
                  (category === 'pos' && totalPostsCount > 0) ||
                  (category === 'shift' && totalShiftsCount > 0);

  const currentTotal = category === 'pengguna' ? totalUsersCount : category === 'pos' ? totalPostsCount : totalShiftsCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Import Data Master Sistem</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold uppercase">
                  Excel / CSV
                </span>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Validasi Atomik</span>
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unggah spreadsheet data massal dengan jaminan integritas transaksi atomik (*All-or-Nothing*).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-900 dark:text-white">

          {/* REAL-TIME PROGRESS BAR (Active during execution or when progress is visible) */}
          {(importing || progressStage === 'validating' || progressStage === 'committing' || progressStage === 'duplicate_check') && (
            <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-3.5 animate-slideDown">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <span>Memproses Transaksi Import Data...</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-mono">
                        {progressPercent}%
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 font-mono truncate max-w-md mt-0.5">
                      {progressMessage}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs text-slate-400">
                  <span className="text-white font-bold">{processedItemCount}</span> / {currentTotal} Baris
                </div>
              </div>

              {/* Visual Progress Bar Strip */}
              <div className="relative w-full h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60 shadow-inner">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 transition-all duration-300 relative overflow-hidden"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ backgroundSize: '30px 30px' }} />
                </div>
              </div>

              {/* Stage Indicators */}
              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 text-slate-400">
                <div className={`flex items-center gap-1.5 ${progressStage === 'validating' ? 'text-emerald-400 font-bold' : progressPercent > 40 ? 'text-slate-300' : ''}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>1. Validasi Skema</span>
                </div>
                <div className={`flex items-center gap-1.5 text-center justify-center ${progressStage === 'duplicate_check' ? 'text-emerald-400 font-bold' : progressPercent > 70 ? 'text-slate-300' : ''}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span>2. Resolusi Duplikat</span>
                </div>
                <div className={`flex items-center gap-1.5 text-right justify-end ${progressStage === 'committing' ? 'text-indigo-400 font-bold' : progressPercent === 100 ? 'text-slate-300' : ''}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>3. Komit Database</span>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS BANNER */}
          {importResult && importResult.success && (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slideDown">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <span>Transaksi Impor Berhasil Sempurna!</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 rounded-full font-bold">
                      100% Selesai
                    </span>
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5">
                    {importResult.created} data baru ditambahkan • {importResult.updated} data diperbarui • {importResult.skipped} dilewati dari total {importResult.total} data.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={resetState}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100/50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Impor File Lain</span>
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}

          {/* ATOMIC ROLLBACK / ERROR ALERT BANNER */}
          {importResult && !importResult.success && (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 space-y-4 animate-slideDown">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-rose-900 dark:text-rose-200 flex items-center gap-2">
                      <span>Transaksi Atomik Dibatalkan (Rollback 100%)</span>
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 font-bold">
                        Data Utuh &amp; Aman
                      </span>
                    </h4>
                    <p className="text-xs text-rose-800 dark:text-rose-300/90 mt-0.5">
                      Ditemukan <strong>{importResult.errors.length} kesalahan validasi</strong> pada baris data. Demi keamanan, tidak ada 1 pun data yang disimpan sebelum seluruh baris diperbaiki.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleExportErrorsExcel}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-300 dark:border-rose-700 hover:bg-rose-100/50 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Log Error Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyErrorLog}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedErrorLog ? 'Tersalin!' : 'Salin Log'}</span>
                  </button>
                </div>
              </div>

              {/* Error Log Detailed Table */}
              <div className="border border-rose-200 dark:border-rose-900/60 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white dark:bg-slate-900">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-rose-100/80 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 uppercase font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Baris #</th>
                      <th className="py-2 px-3">Identitas Baris</th>
                      <th className="py-2 px-3">Kolom</th>
                      <th className="py-2 px-3">Nilai Ditolak</th>
                      <th className="py-2 px-3">Pesan Kesalahan &amp; Solusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-900/40 text-slate-800 dark:text-slate-200">
                    {importResult.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20">
                        <td className="py-2 px-3 font-mono font-bold text-rose-600">Baris {err.rowNumber}</td>
                        <td className="py-2 px-3 font-semibold">{err.identifier}</td>
                        <td className="py-2 px-3 font-mono text-[10.5px] text-slate-600 dark:text-slate-400">{err.field}</td>
                        <td className="py-2 px-3 font-mono text-rose-700 dark:text-rose-300">
                          <code className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950 rounded text-[10px]">{err.rejectedValue || '-'}</code>
                        </td>
                        <td className="py-2 px-3 text-rose-800 dark:text-rose-300 font-medium">{err.errorMessage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 1. Category Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              1. Pilih Kategori Data yang Akan Diimpor:
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleCategorySwitch('pengguna')}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  category === 'pengguna'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${category === 'pengguna' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Master Pengguna</div>
                  <div className="text-[11px] opacity-75">Guru, Tendik &amp; Akun ({users.length})</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategorySwitch('pos')}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  category === 'pos'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${category === 'pos' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Pos Piket</div>
                  <div className="text-[11px] opacity-75">Lokasi &amp; Kuota ({posts.length})</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategorySwitch('shift')}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  category === 'shift'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${category === 'shift' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Shift Piket</div>
                  <div className="text-[11px] opacity-75">Waktu &amp; Jam ({shifts.length})</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2 & 3. Template Download & Upload Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Step 2: Download Template */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                  2. Unduh Template Standar
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Gunakan format kolom resmi agar seluruh data terbaca secara akurat oleh sistem e-Piket.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="w-full py-2.5 px-4 bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600/20 border border-emerald-300 dark:border-emerald-700/60 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Download Template ({category === 'pengguna' ? 'Pengguna' : category === 'pos' ? 'Pos' : 'Shift'}.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Step 3: Upload Dropzone */}
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-1">
                3. Unggah File (.xlsx, .xls, .csv)
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                {file ? (
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <FileCheck className="w-6 h-6 shrink-0" />
                    <div className="text-left overflow-hidden">
                      <div className="text-xs font-black truncate max-w-[220px]">{file.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB • Klik untuk ganti file
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Klik untuk pilih file atau tarik file ke sini
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Format didukung: XLSX, XLS, CSV</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ATOMIC TRANSACTION & DUPLICATE CONFIG */}
          {hasData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Atomic Validation Guarantee Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Mode Validasi Transaksi Atomik:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAtomicMode(!isAtomicMode)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                      isAtomicMode 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {isAtomicMode ? '🛡️ Aktif (All-or-Nothing)' : '⚡ Fleksibel (Skip Error)'}
                  </button>
                </div>
                <p className="text-[11px] text-indigo-800 dark:text-indigo-300/80">
                  {isAtomicMode
                    ? 'Menjamin seluruh 100% baris sukses disimpan. Jika terdapat 1 baris yang rusak/salah, seluruh batch dibatalkan dan log error ditampilkan.'
                    : 'Hanya baris yang valid yang akan disimpan ke database, baris dengan format rusak akan dilewati.'}
                </p>
              </div>

              {/* Duplicate Handling Mode */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-200">
                    Penanganan Duplikat:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setImportMode('append')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                        importMode === 'append'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Lewati Duplikat
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('update_existing')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                        importMode === 'update_existing'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Timpa / Update
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {importMode === 'append' 
                    ? 'Jika Username/NIP sudah ada di database, data tersebut akan dilewati.' 
                    : 'Jika Username/NIP sudah ada di database, data lama akan diperbarui dengan data baru dari file.'}
                </p>
              </div>
            </div>
          )}

          {/* PREVIEW TABLE SECTION */}
          {hasData && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Preview Data Hasil Pembacaan:
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    {category === 'pengguna' ? totalUsersCount : category === 'pos' ? totalPostsCount : totalShiftsCount} Baris
                  </span>

                  {(category === 'pengguna' ? duplicateUsersCount : category === 'pos' ? duplicatePostsCount : duplicateShiftsCount) > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10.5px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{category === 'pengguna' ? duplicateUsersCount : category === 'pos' ? duplicatePostsCount : duplicateShiftsCount} Duplikat</span>
                    </span>
                  )}

                  {category === 'pengguna' && errorUsersCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10.5px] font-bold flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      <span>{errorUsersCount} Error Format</span>
                    </span>
                  )}
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari di tabel preview..."
                    value={previewFilter}
                    onChange={(e) => setPreviewFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Table User Preview */}
              {category === 'pengguna' && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Nama Lengkap &amp; Username</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">NIP / NUPTK</th>
                        <th className="py-2.5 px-3">Jabatan &amp; Unit</th>
                        <th className="py-2.5 px-3">WhatsApp / PIN</th>
                        <th className="py-2.5 px-3">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {parsedUsers
                        .filter((u) => {
                          if (!u) return false;
                          const f = (previewFilter || '').toLowerCase();
                          return (
                            (u.nama || '').toLowerCase().includes(f) ||
                            (u.username || '').toLowerCase().includes(f) ||
                            String(u.nip || '').includes(previewFilter || '')
                          );
                        })
                        .map((u) => (
                          <tr key={u.index} className={u.validationError ? 'bg-rose-50/50 dark:bg-rose-950/20' : u.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}>
                            <td className="py-2 px-3 font-mono text-slate-500">{u.index}</td>
                            <td className="py-2 px-3 font-semibold">
                              <div>{u.nama}</div>
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">@{u.username}</div>
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase bg-slate-100 dark:bg-slate-800">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-[10.5px]">{u.nip || u.nuptk || '-'}</td>
                            <td className="py-2 px-3">
                              <div>{u.jabatan}</div>
                              <div className="text-[10px] text-slate-500">{u.unitKerja}</div>
                            </td>
                            <td className="py-2 px-3 font-mono text-[10.5px]">
                              <div>{u.nomorHP}</div>
                              <div className="text-[9.5px] text-slate-500">PIN: {u.pin}</div>
                            </td>
                            <td className="py-2 px-3">
                              {u.validationError ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{u.validationError}</span>
                                </span>
                              ) : u.isDuplicate ? (
                                <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{importMode === 'update_existing' ? 'Akan Diperbarui' : `Duplikat (${u.duplicateField})`}</span>
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Valid &amp; Siap Diproses</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Pos Preview */}
              {category === 'pos' && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Nama Pos</th>
                        <th className="py-2.5 px-3">Lokasi</th>
                        <th className="py-2.5 px-3">Petugas Wajib</th>
                        <th className="py-2.5 px-3">Deskripsi Tugas</th>
                        <th className="py-2.5 px-3">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {parsedPosts
                        .filter((p) => {
                          if (!p) return false;
                          const f = (previewFilter || '').toLowerCase();
                          return (p.namaPos || '').toLowerCase().includes(f) || (p.lokasi || '').toLowerCase().includes(f);
                        })
                        .map((p) => (
                          <tr key={p.index} className={p.validationError ? 'bg-rose-50/50 dark:bg-rose-950/20' : p.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}>
                            <td className="py-2 px-3 font-mono text-slate-500">{p.index}</td>
                            <td className="py-2 px-3 font-bold">{p.namaPos}</td>
                            <td className="py-2 px-3">{p.lokasi}</td>
                            <td className="py-2 px-3 font-bold text-emerald-700 dark:text-emerald-400">{p.petugasRequiredCount} Orang</td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">{p.deskripsi}</td>
                            <td className="py-2 px-3">
                              {p.isDuplicate ? (
                                <span className="text-amber-700 dark:text-amber-400 font-bold">
                                  {importMode === 'update_existing' ? 'Akan Diupdate' : 'Duplikat (Dilewati)'}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Valid</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Shift Preview */}
              {category === 'shift' && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Nama Shift</th>
                        <th className="py-2.5 px-3">Jam Operasional</th>
                        <th className="py-2.5 px-3">Keterangan</th>
                        <th className="py-2.5 px-3">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {parsedShifts
                        .filter((s) => {
                          if (!s) return false;
                          const f = (previewFilter || '').toLowerCase();
                          return (s.namaShift || '').toLowerCase().includes(f);
                        })
                        .map((s) => (
                          <tr key={s.index} className={s.validationError ? 'bg-rose-50/50 dark:bg-rose-950/20' : s.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}>
                            <td className="py-2 px-3 font-mono text-slate-500">{s.index}</td>
                            <td className="py-2 px-3 font-bold">{s.namaShift}</td>
                            <td className="py-2 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {s.jamMulai} - {s.jamSelesai} WIB
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{s.keterangan}</td>
                            <td className="py-2 px-3">
                              {s.isDuplicate ? (
                                <span className="text-amber-700 dark:text-amber-400 font-bold">
                                  {importMode === 'update_existing' ? 'Akan Diupdate' : 'Duplikat (Dilewati)'}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Valid</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {hasData && (
              <button
                type="button"
                onClick={resetState}
                className="px-3 py-2.5 text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold cursor-pointer"
              >
                Reset Pilihan
              </button>
            )}

            <button
              type="button"
              disabled={!hasData || parsing || importing}
              onClick={handleExecuteImport}
              className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                !hasData || parsing || importing
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-95'
              }`}
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses ({progressPercent}%)...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    Eksekusi Impor Transaksi ({currentTotal} Baris)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
