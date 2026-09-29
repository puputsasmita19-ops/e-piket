import { 
  SystemSnapshot, 
  RestoreOptions, 
  PanicModeRestoreResult,
  School,
  SystemSettings,
  User,
  DutyPost,
  Shift,
  SchoolYear,
  DutySchedule,
  Attendance,
  Logbook,
  Incident,
  Handover,
  DutyReplacement
} from '../types';
import { 
  db, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  collection, 
  writeBatch, 
  cleanFirestoreData 
} from './firebase';

const LOCAL_STORAGE_SNAPSHOTS_KEY = 'epiket_system_snapshots_archive';

export interface SnapshotStatePayload {
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
}

/**
 * Generate a simple hash/checksum for snapshot data validation
 */
function generateChecksum(data: any): string {
  try {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `chk-${Math.abs(hash).toString(16)}-${str.length}`;
  } catch {
    return `chk-${Date.now()}`;
  }
}

/**
 * Create a new System Snapshot (daily auto, manual checkpoint, or safety backup)
 */
export async function createSystemSnapshot(params: {
  type: 'daily_auto' | 'manual_admin' | 'pre_restore_safety';
  title?: string;
  notes?: string;
  createdBy?: string;
  state: SnapshotStatePayload;
}): Promise<SystemSnapshot> {
  const now = new Date();
  const nowIso = now.toISOString();
  const dateStr = nowIso.split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');

  const id = `snap-${params.type}-${dateStr}-${timeStr}-${Math.random().toString(36).substring(2, 6)}`;
  
  const defaultTitle = 
    params.type === 'daily_auto'
      ? `Snapshot Cadangan Harian (${dateStr})`
      : params.type === 'pre_restore_safety'
      ? `Titik Pengaman Pra-Pemulihan (${dateStr} ${now.toLocaleTimeString('id-ID')})`
      : `Cadangan Manual Admin (${dateStr} ${now.toLocaleTimeString('id-ID')})`;

  const snapshot: SystemSnapshot = {
    id,
    title: params.title || defaultTitle,
    createdAt: nowIso,
    type: params.type,
    createdBy: params.createdBy || (params.type === 'daily_auto' ? 'Sistem Otomatis' : 'Administrator'),
    notes: params.notes || '',
    checksum: generateChecksum(params.state),
    summary: {
      totalUsers: params.state.users?.length || 0,
      totalPosts: params.state.posts?.length || 0,
      totalShifts: params.state.shifts?.length || 0,
      totalSchedules: params.state.schedules?.length || 0,
      totalAttendances: params.state.attendances?.length || 0,
      totalLogbooks: params.state.logbooks?.length || 0,
      totalIncidents: params.state.incidents?.length || 0,
      totalHandovers: params.state.handovers?.length || 0,
      totalReplacements: params.state.replacements?.length || 0,
      schoolName: params.state.school?.nama || 'SMP Negeri 1 Nusantara'
    },
    data: {
      school: params.state.school,
      systemSettings: params.state.systemSettings,
      users: params.state.users || [],
      posts: params.state.posts || [],
      shifts: params.state.shifts || [],
      schoolYear: params.state.schoolYear,
      schedules: params.state.schedules || [],
      attendances: params.state.attendances || [],
      logbooks: params.state.logbooks || [],
      incidents: params.state.incidents || [],
      handovers: params.state.handovers || [],
      replacements: params.state.replacements || []
    }
  };

  // 1. Save to LocalStorage Archive
  saveSnapshotToLocalStorage(snapshot);

  // 2. Save to Cloud Firestore
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await setDoc(doc(db, 'system_snapshots', snapshot.id), cleanFirestoreData(snapshot));
    }
  } catch (err) {
    console.warn('Could not save snapshot to Cloud Firestore (fallback to local only):', err);
  }

  return snapshot;
}

/**
 * Save snapshot into localStorage with rotation limit (last 40 snapshots)
 */
function saveSnapshotToLocalStorage(snapshot: SystemSnapshot): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SNAPSHOTS_KEY);
    let list: SystemSnapshot[] = raw ? JSON.parse(raw) : [];
    
    // Check if already exists
    const idx = list.findIndex(s => s.id === snapshot.id);
    if (idx >= 0) {
      list[idx] = snapshot;
    } else {
      list = [snapshot, ...list];
    }

    // Keep max 40 snapshots in localStorage to conserve space
    if (list.length > 40) {
      list = list.slice(0, 40);
    }

    localStorage.setItem(LOCAL_STORAGE_SNAPSHOTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage snapshot save error:', e);
  }
}

/**
 * Fetch all available snapshots from Firestore + LocalStorage
 */
export async function getAvailableSnapshots(): Promise<SystemSnapshot[]> {
  const snapshotMap = new Map<string, SystemSnapshot>();

  // 1. Read from LocalStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SNAPSHOTS_KEY);
    if (raw) {
      const localList: SystemSnapshot[] = JSON.parse(raw);
      localList.forEach(s => {
        if (s && s.id) snapshotMap.set(s.id, s);
      });
    }
  } catch (e) {
    console.warn('Error reading local snapshots:', e);
  }

  // 2. Read from Cloud Firestore
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const snapDocs = await getDocs(collection(db, 'system_snapshots'));
      snapDocs.forEach(d => {
        const item = d.data() as SystemSnapshot;
        if (item && item.id) {
          snapshotMap.set(item.id, item);
        }
      });
    }
  } catch (err) {
    console.warn('Error reading snapshots from Firestore:', err);
  }

  const allSnapshots = Array.from(snapshotMap.values());
  // Sort descending by creation date
  allSnapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return allSnapshots;
}

/**
 * Delete a snapshot from Firestore & LocalStorage
 */
export async function deleteSnapshotRecord(snapshotId: string): Promise<boolean> {
  try {
    // 1. Delete from LocalStorage
    const raw = localStorage.getItem(LOCAL_STORAGE_SNAPSHOTS_KEY);
    if (raw) {
      const list: SystemSnapshot[] = JSON.parse(raw);
      const filtered = list.filter(s => s.id !== snapshotId);
      localStorage.setItem(LOCAL_STORAGE_SNAPSHOTS_KEY, JSON.stringify(filtered));
    }

    // 2. Delete from Firestore
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await deleteDoc(doc(db, 'system_snapshots', snapshotId));
    }

    return true;
  } catch (err) {
    console.warn('Error deleting snapshot:', err);
    return false;
  }
}

/**
 * Download a snapshot as a stand-alone JSON disaster recovery file
 */
export function downloadSnapshotAsFile(snapshot: SystemSnapshot): void {
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = snapshot.createdAt ? snapshot.createdAt.split('T')[0] : 'backup';
  const fileName = `ePiket_Snapshot_${dateStr}_${snapshot.type}_${snapshot.id.slice(-6)}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate an uploaded snapshot JSON file
 */
export async function parseSnapshotFile(file: File): Promise<SystemSnapshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Basic schema validation
        if (!parsed.data || typeof parsed.data !== 'object') {
          throw new Error('Berkas tidak valid: format data snapshot tidak ditemukan.');
        }

        const snapshot: SystemSnapshot = {
          id: parsed.id || `snap-import-${Date.now()}`,
          title: parsed.title || `Snapshot Impor (${file.name})`,
          createdAt: parsed.createdAt || new Date().toISOString(),
          type: parsed.type || 'manual_admin',
          createdBy: parsed.createdBy || 'Impor Berkas JSON',
          notes: parsed.notes || `Diimpor dari berkas: ${file.name}`,
          checksum: parsed.checksum || generateChecksum(parsed.data),
          summary: {
            totalUsers: parsed.data.users?.length || parsed.summary?.totalUsers || 0,
            totalPosts: parsed.data.posts?.length || parsed.summary?.totalPosts || 0,
            totalShifts: parsed.data.shifts?.length || parsed.summary?.totalShifts || 0,
            totalSchedules: parsed.data.schedules?.length || parsed.summary?.totalSchedules || 0,
            totalAttendances: parsed.data.attendances?.length || parsed.summary?.totalAttendances || 0,
            totalLogbooks: parsed.data.logbooks?.length || parsed.summary?.totalLogbooks || 0,
            totalIncidents: parsed.data.incidents?.length || parsed.summary?.totalIncidents || 0,
            totalHandovers: parsed.data.handovers?.length || parsed.summary?.totalHandovers || 0,
            totalReplacements: parsed.data.replacements?.length || parsed.summary?.totalReplacements || 0,
            schoolName: parsed.data.school?.nama || parsed.summary?.schoolName || 'Sekolah'
          },
          data: parsed.data
        };

        saveSnapshotToLocalStorage(snapshot);
        resolve(snapshot);
      } catch (err: any) {
        reject(new Error(`Gagal membaca berkas snapshot: ${err.message || 'Format JSON rusak'}`));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas dari media penyimpanan.'));
    reader.readAsText(file);
  });
}
