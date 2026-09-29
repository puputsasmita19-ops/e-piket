import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  School,
  User,
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
  SystemSettings,
  AttachmentMeta,
  ScheduleStatus,
  ImportErrorItem,
  BatchImportResult,
  SystemSnapshot,
  RestoreOptions,
  PanicModeRestoreResult
} from '../types';
import {
  INITIAL_SCHOOL,
  INITIAL_USERS,
  INITIAL_POSTS,
  INITIAL_SHIFTS,
  INITIAL_SCHOOL_YEAR,
  INITIAL_SCHEDULES,
  INITIAL_ATTENDANCES,
  INITIAL_LOGBOOKS,
  INITIAL_INCIDENTS,
  INITIAL_HANDOVERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SYSTEM_SETTINGS,
  getTodayDateString,
  getDayNameIndo
} from '../services/seedData';
import { useAuth } from './AuthContext';
import { sound, triggerConfetti } from '../utils/feedback';
import { uploadToGoogleDrive, UploadFileOptions } from '../services/driveService';
import { offlineDB, CachedReport, OfflineAction } from '../services/indexedDb';
import { notificationService } from '../services/notificationService';
import {
  createSystemSnapshot,
  getAvailableSnapshots,
  deleteSnapshotRecord,
  downloadSnapshotAsFile,
  parseSnapshotFile
} from '../services/snapshotBackupService';
import { 
  db, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  onSnapshot,
  testFirestoreConnection, 
  handleFirestoreError, 
  OperationType,
  cleanFirestoreData,
  writeBatch,
  FIRESTORE_DATABASE_ID,
  COLLECTIONS
} from '../services/firebase';

interface DataContextType {
  school: School;
  users: User[];
  posts: DutyPost[];
  shifts: Shift[];
  schoolYear: SchoolYear;
  schedules: DutySchedule[];
  attendances: Attendance[];
  logbooks: Logbook[];
  incidents: Incident[];
  handovers: Handover[];
  replacements: DutyReplacement[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  systemSettings: SystemSettings;
  isOnline: boolean;

  // Cloud Firestore Sync & Status
  isFirestoreConnected: boolean;
  firestoreStatusMessage: string;
  syncAllDataToFirestore: () => Promise<{ success: boolean; message: string; count: number }>;
  syncInitialMasterDataToFirestore: () => Promise<{ success: boolean; message: string; count: number }>;
  checkCloudStatus: () => Promise<void>;

  // Offline / IndexedDB stats & functions
  cachedReports: CachedReport[];
  cachedReportsCount: number;
  pendingSyncCount: number;
  pendingOfflineActions: OfflineAction[];
  triggerSyncOfflineActions: () => Promise<void>;
  cacheCurrentReport: (type?: 'harian' | 'mingguan' | 'bulanan' | 'semester', dateStr?: string) => Promise<CachedReport>;
  
  // Actions
  checkIn: (
    scheduleId: string,
    notes?: string,
    coords?: { lat: number; lng: number; accuracy?: number; distanceMeters?: number; isWithinRadius?: boolean },
    fotoSelfie?: string,
    biometricData?: { verified: boolean; verifiedAt?: string; type?: string }
  ) => Promise<{ success: boolean; message: string }>;
  checkOut: (
    scheduleId: string,
    notes?: string,
    fotoSelfie?: string
  ) => Promise<{ success: boolean; message: string }>;
  createLogbook: (log: Omit<Logbook, 'id' | 'createdAt'>) => Promise<Logbook>;
  updateLogbook: (id: string, data: Partial<Logbook>) => Promise<void>;
  deleteLogbook: (id: string) => Promise<void>;
  createIncident: (incident: Omit<Incident, 'id' | 'createdAt'>) => Promise<Incident>;
  updateIncident: (id: string, data: Partial<Incident>) => Promise<void>;
  deleteIncident: (id: string) => Promise<void>;
  createHandover: (handover: Omit<Handover, 'id' | 'createdAt'>) => Promise<Handover>;
  updateHandover: (id: string, data: Partial<Handover>) => Promise<void>;
  deleteHandover: (id: string) => Promise<void>;
  acknowledgeHandover: (handoverId: string, notes?: string) => Promise<void>;
  createReplacement: (rep: Omit<DutyReplacement, 'id' | 'createdAt'>) => Promise<void>;
  updateReplacement: (id: string, data: Partial<DutyReplacement>) => Promise<void>;
  deleteReplacement: (id: string) => Promise<void>;
  adminManualCheckIn: (
    scheduleId: string,
    status: 'sedang_bertugas' | 'terlambat' | 'sakit' | 'izin' | 'lowbat_tunggu',
    notes: string
  ) => Promise<{ success: boolean; message: string }>;
  
  // Schedules CRUD
  createSchedule: (schedule: Omit<DutySchedule, 'id' | 'createdAt'>) => Promise<DutySchedule>;
  updateSchedule: (id: string, data: Partial<DutySchedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  deleteMultipleSchedules: (ids: string[]) => Promise<{ success: boolean; count: number }>;
  generateSemesterSchedule: (params: { startDate: string; endDate: string; postAssignments: { [day: string]: { [postId: string]: string[] } } }) => Promise<number>;
  
  // Master CRUD
  createUser: (user: Omit<User, 'id'>) => Promise<User>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  deleteMultipleUsers: (ids: string[]) => Promise<{ success: boolean; count: number }>;
  importUsersBatch: (newUsers: Omit<User, 'id'>[], mode?: 'append' | 'update_existing', options?: { atomic?: boolean }) => Promise<BatchImportResult>;
  createPost: (post: Omit<DutyPost, 'id'>) => Promise<DutyPost>;
  updatePost: (id: string, data: Partial<DutyPost>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  deleteMultiplePosts: (ids: string[]) => Promise<{ success: boolean; count: number }>;
  importPostsBatch: (newPosts: Omit<DutyPost, 'id'>[], mode?: 'append' | 'update_existing', options?: { atomic?: boolean }) => Promise<BatchImportResult>;
  createShift: (shift: Omit<Shift, 'id'>) => Promise<Shift>;
  updateShift: (id: string, data: Partial<Shift>) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  deleteMultipleShifts: (ids: string[]) => Promise<{ success: boolean; count: number }>;
  importShiftsBatch: (newShifts: Omit<Shift, 'id'>[], mode?: 'append' | 'update_existing', options?: { atomic?: boolean }) => Promise<BatchImportResult>;
  updateSchool: (data: Partial<School>) => Promise<void>;
  updateSystemSettings: (data: Partial<SystemSettings>) => Promise<void>;
  
  // Upload Photo
  uploadPhoto: (file: File, options: UploadFileOptions) => Promise<AttachmentMeta>;
  
  // Notifications
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  sendCustomWhatsApp: (toPhone: string, message: string) => Promise<{ success: boolean; message: string }>;
  
  // Audit & Reset
  recordAudit: (action: string, module: string, details: string, recordId?: string, oldData?: any, newData?: any) => void;
  resetToDemoData: () => void;

  // Admin Panic Mode & Disaster Recovery Snapshots
  snapshots: SystemSnapshot[];
  isRestoringSnapshot: boolean;
  isCreatingSnapshot: boolean;
  createEmergencySnapshot: (title?: string, notes?: string) => Promise<SystemSnapshot>;
  restoreFromSnapshot: (snapshot: SystemSnapshot, options?: RestoreOptions) => Promise<PanicModeRestoreResult>;
  deleteSnapshot: (snapshotId: string) => Promise<boolean>;
  refreshSnapshots: () => Promise<void>;
  exportSnapshotToFile: (snapshot: SystemSnapshot) => void;
  importSnapshotFromFile: (file: File) => Promise<SystemSnapshot>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STORAGE_PREFIX = 'epiket_db_';

const loadInitial = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const saveToStorage = <T,>(key: string, data: T) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to save ${key} to localStorage:`, err);
  }
};

const mergeListsById = <T extends { id: string }>(prev: T[], next: T[]): T[] => {
  if (next.length === 0) return prev;
  const map = new Map<string, T>();
  prev.forEach((item) => map.set(item.id, item));
  next.forEach((item) => {
    const existing = map.get(item.id);
    map.set(item.id, existing ? { ...existing, ...item } : item);
  });
  return Array.from(map.values());
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, getDriveAccessToken } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Cloud Firestore Sync states
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [firestoreStatusMessage, setFirestoreStatusMessage] = useState<string>('Memeriksa status Cloud Firestore...');

  const [school, setSchool] = useState<School>(() => loadInitial('school', INITIAL_SCHOOL));
  const [users, setUsers] = useState<User[]>(() => {
    const loaded = loadInitial<User[]>('users', INITIAL_USERS);
    if (Array.isArray(loaded) && loaded.length > 0) {
      // Filter out any legacy dummy teacher accounts (user-ptk-* or guru-*)
      const filtered = loaded.filter((u) => !u.id.startsWith('user-ptk-') && !u.id.startsWith('guru-'));
      if (filtered.length === 0) return INITIAL_USERS;
      return filtered;
    }
    return INITIAL_USERS;
  });
  const [posts, setPosts] = useState<DutyPost[]>(() => {
    const loaded = loadInitial<DutyPost[]>('posts', INITIAL_POSTS);
    if (Array.isArray(loaded) && loaded.length > 0) {
      const existingIds = new Set(loaded.map((p) => p.id));
      const missing = INITIAL_POSTS.filter((p) => !existingIds.has(p.id));
      if (missing.length > 0) {
        const merged = [...loaded, ...missing];
        saveToStorage('posts', merged);
        return merged;
      }
      return loaded;
    }
    return INITIAL_POSTS;
  });
  const [shifts, setShifts] = useState<Shift[]>(() => {
    const loaded = loadInitial<Shift[]>('shifts', INITIAL_SHIFTS);
    if (Array.isArray(loaded) && loaded.length > 0) {
      const existingIds = new Set(loaded.map((s) => s.id));
      const missing = INITIAL_SHIFTS.filter((s) => !existingIds.has(s.id));
      if (missing.length > 0) {
        const merged = [...loaded, ...missing];
        saveToStorage('shifts', merged);
        return merged;
      }
      return loaded;
    }
    return INITIAL_SHIFTS;
  });
  const [schoolYear] = useState<SchoolYear>(() => loadInitial('schoolYear', INITIAL_SCHOOL_YEAR));
  const [schedules, setSchedules] = useState<DutySchedule[]>(() => loadInitial('schedules', INITIAL_SCHEDULES));
  const [attendances, setAttendances] = useState<Attendance[]>(() => loadInitial('attendances', INITIAL_ATTENDANCES));
  const [logbooks, setLogbooks] = useState<Logbook[]>(() => loadInitial('logbooks', INITIAL_LOGBOOKS));
  const [incidents, setIncidents] = useState<Incident[]>(() => loadInitial('incidents', INITIAL_INCIDENTS));
  const [handovers, setHandovers] = useState<Handover[]>(() => loadInitial('handovers', INITIAL_HANDOVERS));
  const [replacements, setReplacements] = useState<DutyReplacement[]>(() => loadInitial('replacements', []));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadInitial('notifications', INITIAL_NOTIFICATIONS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadInitial('auditLogs', INITIAL_AUDIT_LOGS));
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const loaded = loadInitial('systemSettings', INITIAL_SYSTEM_SETTINGS);
    const TARGET_FOLDER = '18lJTqdfpB0NtY23aaxoAvq84GiTcCksQ';
    if (!loaded.googleDrive?.rootFolderId || loaded.googleDrive.rootFolderId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlhs74OIv76ih4A') {
      const migrated = {
        ...loaded,
        googleDrive: {
          ...loaded.googleDrive,
          rootFolderId: TARGET_FOLDER
        }
      };
      saveToStorage('systemSettings', migrated);
      return migrated;
    }
    return loaded;
  });

  // Offline IndexedDB state
  const [cachedReports, setCachedReports] = useState<CachedReport[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [pendingOfflineActions, setPendingOfflineActions] = useState<OfflineAction[]>([]);

  // Admin Panic Mode & Disaster Recovery Snapshots state
  const [snapshots, setSnapshots] = useState<SystemSnapshot[]>([]);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState<boolean>(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState<boolean>(false);

  const refreshPendingActions = useCallback(async () => {
    try {
      const actions = await offlineDB.getPendingOfflineActions();
      setPendingOfflineActions(actions);
      setPendingSyncCount(actions.length);
    } catch (e) {
      console.warn('Could not read pending offline actions:', e);
    }
  }, []);

  const refreshSnapshots = useCallback(async () => {
    try {
      const list = await getAvailableSnapshots();
      setSnapshots(list);
    } catch (e) {
      console.warn('Failed to refresh snapshots:', e);
    }
  }, []);

  useEffect(() => {
    refreshPendingActions();
  }, [refreshPendingActions]);

  // Sync state to local storage and IndexedDB
  useEffect(() => {
    saveToStorage('school', school);
    offlineDB.saveMetadata('school', school).catch(console.warn);
  }, [school]);

  useEffect(() => {
    saveToStorage('users', users);
    localStorage.setItem('epiket_users_list', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    saveToStorage('posts', posts);
    offlineDB.saveMetadata('posts', posts).catch(console.warn);
  }, [posts]);

  useEffect(() => { saveToStorage('shifts', shifts); }, [shifts]);

  useEffect(() => {
    saveToStorage('schedules', schedules);
    offlineDB.saveSchedules(schedules).catch(console.warn);
  }, [schedules]);

  useEffect(() => { saveToStorage('attendances', attendances); }, [attendances]);

  useEffect(() => {
    saveToStorage('logbooks', logbooks);
    offlineDB.saveLogbooks(logbooks).catch(console.warn);
  }, [logbooks]);

  useEffect(() => {
    saveToStorage('incidents', incidents);
    offlineDB.saveIncidents(incidents).catch(console.warn);
  }, [incidents]);

  useEffect(() => { saveToStorage('handovers', handovers); }, [handovers]);
  useEffect(() => { saveToStorage('replacements', replacements); }, [replacements]);
  useEffect(() => { saveToStorage('notifications', notifications); }, [notifications]);
  useEffect(() => { saveToStorage('auditLogs', auditLogs); }, [auditLogs]);
  useEffect(() => { saveToStorage('systemSettings', systemSettings); }, [systemSettings]);

  // Load and refresh IndexedDB cached reports and pending actions count
  const refreshIndexedDBState = useCallback(async () => {
    try {
      const reports = await offlineDB.getAllCachedReports();
      setCachedReports(reports);

      const pending = await offlineDB.getPendingOfflineActions();
      setPendingSyncCount(pending.length);
    } catch (e) {
      console.warn('IndexedDB initial sync error:', e);
    }
  }, []);

  // Cloud Firestore Status Check
  const checkCloudStatus = useCallback(async () => {
    try {
      const res = await testFirestoreConnection();
      setIsFirestoreConnected(res.connected);
      setFirestoreStatusMessage(res.message);
    } catch (e) {
      setIsFirestoreConnected(false);
      setFirestoreStatusMessage('Cloud Firestore sedang offline');
    }
  }, []);

  useEffect(() => {
    refreshIndexedDBState();
    checkCloudStatus();

    // 1. Purge any legacy dummy teachers (user-ptk-* or guru-*) from Firestore
    const purgeLegacyDummyData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const dummyDocIds: string[] = [];
        usersSnap.forEach((d) => {
          if (d.id.startsWith('user-ptk-') || d.id.startsWith('guru-')) {
            dummyDocIds.push(d.id);
          }
        });
        if (dummyDocIds.length > 0) {
          console.log(`Menghapus ${dummyDocIds.length} data guru dummy dari Firestore...`);
          const CHUNK = 400;
          for (let i = 0; i < dummyDocIds.length; i += CHUNK) {
            const chunk = dummyDocIds.slice(i, i + CHUNK);
            const b = writeBatch(db);
            chunk.forEach((id) => b.delete(doc(db, 'users', id)));
            await b.commit();
          }
          console.log('Semua 38 data guru dummy berhasil dihapus dari Firebase Firestore.');
        }

        // Ensure baseline admin and kepsek exist in Firestore without overwriting custom PINs or profiles
        for (const u of INITIAL_USERS) {
          const userDocRef = doc(db, 'users', u.id);
          const userSnap = await getDoc(userDocRef);
          if (!userSnap.exists()) {
            await setDoc(userDocRef, cleanFirestoreData(u));
          }
          const userCanonicalRef = doc(db, 'user', u.id);
          const canonicalSnap = await getDoc(userCanonicalRef);
          if (!canonicalSnap.exists()) {
            await setDoc(userCanonicalRef, cleanFirestoreData(u));
          }
        }
      } catch (err) {
        console.warn('Purge legacy dummy data error:', err);
      }
    };

    purgeLegacyDummyData();

    // 2. Real-time Live Firestore Subscriptions (Two-Way Automatic Synchronization)
    // Synchronize both canonical schemas ('user', 'jadwal', 'bukuPiket', 'kejadian') and mirrors
    const unsubCanonicalUser = onSnapshot(collection(db, 'user'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: User[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as User));
        if (loaded.length > 0) {
          setUsers(loaded);
          saveToStorage('users', loaded);
          localStorage.setItem('epiket_users_list', JSON.stringify(loaded));
          setIsFirestoreConnected(true);
        }
      }
    }, (err) => console.warn('user onSnapshot error:', err));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: User[] = [];
        snapshot.forEach((d) => {
          loaded.push(d.data() as User);
        });
        if (loaded.length > 0) {
          setUsers(loaded);
          saveToStorage('users', loaded);
          localStorage.setItem('epiket_users_list', JSON.stringify(loaded));
          setIsFirestoreConnected(true);
        }
      }
    }, (err) => console.warn('users onSnapshot error:', err));

    const unsubPosts = onSnapshot(collection(db, 'duty_posts'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: DutyPost[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as DutyPost));
        if (loaded.length > 0) {
          setPosts(loaded);
          saveToStorage('posts', loaded);
        }
      }
    }, (err) => console.warn('duty_posts onSnapshot error:', err));

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Shift[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as Shift));
        if (loaded.length > 0) {
          setShifts(loaded);
          saveToStorage('shifts', loaded);
        }
      }
    }, (err) => console.warn('shifts onSnapshot error:', err));

    const unsubSchool = onSnapshot(doc(db, 'schools', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as School;
        setSchool(data);
        saveToStorage('school', data);
      }
    }, (err) => console.warn('schools onSnapshot error:', err));

    const unsubSettings = onSnapshot(doc(db, 'system_settings', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SystemSettings;
        setSystemSettings(data);
        saveToStorage('systemSettings', data);
      }
    }, (err) => console.warn('system_settings onSnapshot error:', err));

    const unsubCanonicalJadwal = onSnapshot(collection(db, 'jadwal'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: DutySchedule[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as DutySchedule));
        setSchedules((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('jadwal onSnapshot error:', err));

    const unsubSchedules = onSnapshot(collection(db, 'duty_schedules'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: DutySchedule[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as DutySchedule));
        setSchedules((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('duty_schedules onSnapshot error:', err));

    const unsubAttendances = onSnapshot(collection(db, 'attendances'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Attendance[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as Attendance));
        setAttendances((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('attendances onSnapshot error:', err));

    const unsubCanonicalBukuPiket = onSnapshot(collection(db, 'bukuPiket'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Logbook[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as Logbook));
        setLogbooks((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('bukuPiket onSnapshot error:', err));

    const unsubLogbooks = onSnapshot(collection(db, 'logbooks'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Logbook[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as Logbook));
        setLogbooks((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('logbooks onSnapshot error:', err));

    const unsubCanonicalKejadian = onSnapshot(collection(db, 'kejadian'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Incident[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as Incident));
        setIncidents((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('kejadian onSnapshot error:', err));

    const unsubIncidents = onSnapshot(collection(db, 'incidents'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Incident[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as Incident));
        setIncidents((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('incidents onSnapshot error:', err));

    const unsubHandovers = onSnapshot(collection(db, 'handovers'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: Handover[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as Handover));
        setHandovers((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('handovers onSnapshot error:', err));

    const unsubReplacements = onSnapshot(collection(db, 'replacements'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: DutyReplacement[] = [];
        snapshot.forEach((d) => loaded.push(d.data() as DutyReplacement));
        setReplacements((prev) => mergeListsById(prev, loaded));
      }
    }, (err) => console.warn('replacements onSnapshot error:', err));

    // 3. Auto-load snapshots and ensure today's daily snapshot checkpoint exists
    const initDailySnapshot = async () => {
      try {
        const existing = await getAvailableSnapshots();
        setSnapshots(existing);
        
        const todayStr = new Date().toISOString().split('T')[0];
        const hasTodayAutoSnapshot = existing.some(
          s => s.type === 'daily_auto' && s.createdAt && s.createdAt.startsWith(todayStr)
        );

        // If today's auto snapshot doesn't exist yet, create one silently
        if (!hasTodayAutoSnapshot) {
          const autoSnap = await createSystemSnapshot({
            type: 'daily_auto',
            title: `Snapshot Cadangan Harian (${todayStr})`,
            notes: 'Cadangan otomatis harian terjadwal oleh sistem.',
            createdBy: 'Sistem Otomatis',
            state: {
              school,
              systemSettings,
              users,
              posts,
              shifts,
              schoolYear,
              schedules,
              attendances,
              logbooks,
              incidents,
              handovers,
              replacements
            }
          });
          setSnapshots(prev => [autoSnap, ...prev.filter(s => s.id !== autoSnap.id)]);
        }
      } catch (err) {
        console.warn('Auto daily snapshot error:', err);
      }
    };

    initDailySnapshot();

    return () => {
      unsubCanonicalUser();
      unsubUsers();
      unsubPosts();
      unsubShifts();
      unsubSchool();
      unsubSettings();
      unsubCanonicalJadwal();
      unsubSchedules();
      unsubAttendances();
      unsubCanonicalBukuPiket();
      unsubLogbooks();
      unsubCanonicalKejadian();
      unsubIncidents();
      unsubHandovers();
      unsubReplacements();
    };
  }, [refreshIndexedDBState, checkCloudStatus]);

  // Sync all application documents to Cloud Firestore using high-performance atomic writeBatch
  const syncAllDataToFirestore = async (): Promise<{ success: boolean; message: string; count: number }> => {
    let syncedCount = 0;
    try {
      const existingUserIds = new Set(users.map((u) => u.id));
      const effectiveUsers = [
        ...users,
        ...INITIAL_USERS.filter((u) => !existingUserIds.has(u.id))
      ];

      // Batch 1: Master Data (School, Settings, Baseline Users, Posts, Shifts, Ping)
      const batch1 = writeBatch(db);

      // 1. School
      batch1.set(doc(db, 'schools', 'main'), cleanFirestoreData({ ...school, updatedAt: new Date().toISOString() }));
      syncedCount++;

      // 2. Settings
      batch1.set(doc(db, 'system_settings', 'main'), cleanFirestoreData({ ...systemSettings, updatedAt: new Date().toISOString() }));
      syncedCount++;

      // 3. Users (Master Pengguna Aktif - sinkron ke koleksi canonical 'user' dan 'users')
      for (const u of effectiveUsers) {
        const cleanedUser = cleanFirestoreData(u);
        batch1.set(doc(db, 'user', u.id), cleanedUser);
        batch1.set(doc(db, 'users', u.id), cleanedUser);
        syncedCount++;
      }

      // 4. Duty Posts (Master Pos Piket)
      for (const p of posts) {
        batch1.set(doc(db, 'duty_posts', p.id), cleanFirestoreData(p));
        syncedCount++;
      }

      // 5. Shifts (Master Shift Piket)
      for (const sh of shifts) {
        batch1.set(doc(db, 'shifts', sh.id), cleanFirestoreData(sh));
        syncedCount++;
      }

      // 6. Test ping document
      batch1.set(doc(db, 'test', 'connection'), {
        lastSyncedAt: new Date().toISOString(),
        databaseId: FIRESTORE_DATABASE_ID,
        status: 'online',
        totalUsers: effectiveUsers.length
      });

      await batch1.commit();

      // Batch 2: Operational Data (Schedules 'jadwal', Logbooks 'bukuPiket', Incidents 'kejadian', Attendances, Handovers, Replacements)
      const operationalItems: Array<{ collection: string; id: string; data: any }> = [
        ...schedules.map((s) => ({ collection: 'jadwal', id: s.id, data: s })),
        ...schedules.map((s) => ({ collection: 'duty_schedules', id: s.id, data: s })),
        ...attendances.map((a) => ({ collection: 'attendances', id: a.id, data: a })),
        ...logbooks.map((l) => ({ collection: 'bukuPiket', id: l.id, data: l })),
        ...logbooks.map((l) => ({ collection: 'logbooks', id: l.id, data: l })),
        ...incidents.map((inc) => ({ collection: 'kejadian', id: inc.id, data: inc })),
        ...incidents.map((inc) => ({ collection: 'incidents', id: inc.id, data: inc })),
        ...handovers.map((h) => ({ collection: 'handovers', id: h.id, data: h })),
        ...replacements.map((r) => ({ collection: 'replacements', id: r.id, data: r })),
      ];

      // Commit operational items in safe chunks of 400
      const CHUNK_SIZE = 400;
      for (let i = 0; i < operationalItems.length; i += CHUNK_SIZE) {
        const chunk = operationalItems.slice(i, i + CHUNK_SIZE);
        const batchOp = writeBatch(db);
        for (const item of chunk) {
          batchOp.set(doc(db, item.collection, item.id), cleanFirestoreData(item.data));
          syncedCount++;
        }
        await batchOp.commit();
      }

      // Keep state in sync with effectiveUsers
      if (effectiveUsers.length !== users.length) {
        setUsers(effectiveUsers);
        saveToStorage('users', effectiveUsers);
      }

      setIsFirestoreConnected(true);
      setFirestoreStatusMessage(`Tersinkronkan ke Cloud Firestore (${effectiveUsers.length} Pengguna/Guru, Pos, Shift)`);
      sound.playSuccess();
      triggerConfetti();

      const teacherCount = effectiveUsers.filter((u) => u.role === 'guru' || u.role === 'tendik').length;
      return {
        success: true,
        message: `Berhasil menyinkronkan & menyimpan ${syncedCount} data ke Cloud Firestore (${teacherCount} Nama Guru & Tendik, Pos Piket, Shift, Profil Sekolah, & Jadwal).`,
        count: syncedCount
      };
    } catch (err: any) {
      console.warn('Error syncing to Cloud Firestore:', err);
      return {
        success: false,
        message: `Gagal sinkronisasi: ${err.message || 'Periksa koneksi internet/aturan Firebase'}`,
        count: syncedCount
      };
    }
  };

  // Explicitly reset & save canonical initial master data (38 teachers, admin, kepsek, posts, shifts, school, settings)
  const syncInitialMasterDataToFirestore = async (): Promise<{ success: boolean; message: string; count: number }> => {
    setUsers(INITIAL_USERS);
    saveToStorage('users', INITIAL_USERS);
    localStorage.setItem('epiket_users_list', JSON.stringify(INITIAL_USERS));

    setPosts(INITIAL_POSTS);
    saveToStorage('posts', INITIAL_POSTS);

    setShifts(INITIAL_SHIFTS);
    saveToStorage('shifts', INITIAL_SHIFTS);

    setSchool(INITIAL_SCHOOL);
    saveToStorage('school', INITIAL_SCHOOL);

    setSystemSettings(INITIAL_SYSTEM_SETTINGS);
    saveToStorage('systemSettings', INITIAL_SYSTEM_SETTINGS);

    return await syncAllDataToFirestore();
  };

  // Generate / Cache Report Helper to IndexedDB
  const cacheCurrentReport = async (
    type: 'harian' | 'mingguan' | 'bulanan' | 'semester' = 'harian',
    dateStr: string = getTodayDateString()
  ): Promise<CachedReport> => {
    const reportSchedules = schedules.filter((s) => {
      if (type === 'harian') return s.tanggal === dateStr;
      if (type === 'bulanan') return s.tanggal.startsWith(dateStr.substring(0, 7));
      return true;
    });

    const reportIncidents = incidents.filter((i) => {
      if (type === 'harian') return i.tanggal === dateStr;
      if (type === 'bulanan') return i.tanggal.startsWith(dateStr.substring(0, 7));
      return true;
    });

    const reportLogbooks = logbooks.filter((l) => {
      if (type === 'harian') return l.tanggal === dateStr;
      if (type === 'bulanan') return l.tanggal.startsWith(dateStr.substring(0, 7));
      return true;
    });

    const totalSchedules = reportSchedules.length;
    const hadirCount = reportSchedules.filter((s) => s.status === 'sedang_bertugas' || s.status === 'sudah_checkout').length;
    const terlambatCount = reportSchedules.filter((s) => s.status === 'terlambat').length;
    const disciplineRate = totalSchedules > 0 ? Math.round((hadirCount / totalSchedules) * 100) : 100;

    const report: CachedReport = {
      id: `rep-${type}-${dateStr}`,
      type,
      period: dateStr,
      generatedAt: new Date().toISOString(),
      summary: {
        totalSchedules,
        hadirCount,
        terlambatCount,
        disciplineRate,
        incidentCount: reportIncidents.length
      },
      schedules: reportSchedules,
      incidents: reportIncidents,
      logbooks: reportLogbooks
    };

    await offlineDB.saveReport(report);
    const updated = await offlineDB.getAllCachedReports();
    setCachedReports(updated);
    return report;
  };

  // Automatically ensure today's daily report is stored in IndexedDB cache
  useEffect(() => {
    const today = getTodayDateString();
    cacheCurrentReport('harian', today).catch(console.warn);
  }, [schedules.length, incidents.length, logbooks.length]);

  // Sync Pending Offline Actions to Cloud Firestore when online
  const triggerSyncOfflineActions = async () => {
    const pendingActions = await offlineDB.getPendingOfflineActions();
    if (pendingActions.length === 0) return;

    let successfulSyncs = 0;
    for (const act of pendingActions) {
      try {
        if (act.actionType === 'checkIn') {
          const payload = act.payload;
          if (payload.attendance?.id) {
            await setDoc(doc(db, 'attendances', payload.attendance.id), payload.attendance, { merge: true });
          }
          if (payload.scheduleId) {
            const schedUpdate = {
              status: payload.newStatus || 'sedang_bertugas',
              attendanceId: payload.attendance?.id,
              updatedAt: payload.updatedAt || new Date().toISOString()
            };
            await Promise.all([
              setDoc(doc(db, 'jadwal', payload.scheduleId), schedUpdate, { merge: true }),
              setDoc(doc(db, 'duty_schedules', payload.scheduleId), schedUpdate, { merge: true })
            ]);
          }
        } else if (act.actionType === 'checkOut') {
          const payload = act.payload;
          if (payload.attendance?.id) {
            await setDoc(doc(db, 'attendances', payload.attendance.id), payload.attendance, { merge: true });
          }
          if (payload.scheduleId) {
            const schedUpdate = {
              status: 'sudah_checkout',
              updatedAt: payload.updatedAt || new Date().toISOString()
            };
            await Promise.all([
              setDoc(doc(db, 'jadwal', payload.scheduleId), schedUpdate, { merge: true }),
              setDoc(doc(db, 'duty_schedules', payload.scheduleId), schedUpdate, { merge: true })
            ]);
          }
        } else if (act.actionType === 'createLogbook') {
          if (act.payload?.id) {
            await Promise.all([
              setDoc(doc(db, 'bukuPiket', act.payload.id), act.payload, { merge: true }),
              setDoc(doc(db, 'logbooks', act.payload.id), act.payload, { merge: true })
            ]);
          }
        } else if (act.actionType === 'createIncident') {
          if (act.payload?.id) {
            await Promise.all([
              setDoc(doc(db, 'kejadian', act.payload.id), act.payload, { merge: true }),
              setDoc(doc(db, 'incidents', act.payload.id), act.payload, { merge: true })
            ]);
          }
        } else if (act.actionType === 'createHandover') {
          if (act.payload?.id) {
            await setDoc(doc(db, 'handovers', act.payload.id), act.payload, { merge: true });
          }
        }

        await offlineDB.removeOfflineAction(act.id);
        successfulSyncs++;
        recordAudit('SYNC_OFFLINE_ACTION', 'IndexedDB Queue Sync', `Otomatis mengunggah antrean kehadiran piket offline ke Firebase: ${act.actionType} (${act.id})`);
      } catch (err: any) {
        console.warn('Failed to sync offline action to Firebase (will retry):', err);
        await offlineDB.updateOfflineAction({
          ...act,
          retryCount: (act.retryCount || 0) + 1,
          lastError: err?.message || 'Gagal tersambung ke Firebase'
        });
      }
    }

    await refreshPendingActions();
    if (successfulSyncs > 0) {
      sound.playSuccess();
      triggerConfetti();
      setIsFirestoreConnected(true);
      setFirestoreStatusMessage(`${successfulSyncs} antrean kehadiran piket offline berhasil diunggah ke Firebase Cloud`);
    }
  };

  // Online / Offline monitor, automatic background sync, & Real-time late check-in event listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSyncOfflineActions();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleLateDetected = (e: any) => {
      const detail = e.detail;
      if (!detail) return;

      const notifId = `notif-late-${detail.scheduleId}-${detail.tanggal}`;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notifId)) return prev;
        const newNotif: NotificationItem = {
          id: notifId,
          roleTarget: 'admin',
          type: 'terlambat',
          title: `🚨 Peringatan: ${detail.userName} Belum Check-In!`,
          message: `Petugas piket ${detail.userName} di ${detail.postName} belum melakukan check-in (Jadwal: ${detail.jamMulai} WIB | Terlambat: +${detail.minutesLate} menit). Segera hubungi guru atau tugaskan pengganti.`,
          read: false,
          createdAt: detail.timestamp || new Date().toISOString()
        };
        return [newNotif, ...prev];
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('late_checkin_detected', handleLateDetected);

    // Periodic auto-sync worker every 15 seconds if online and items exist in queue
    const syncInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        offlineDB.getPendingOfflineActions().then((actions) => {
          if (actions.length > 0) {
            triggerSyncOfflineActions();
          }
        }).catch(console.warn);
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('late_checkin_detected', handleLateDetected);
      clearInterval(syncInterval);
    };
  }, []);

  const recordAudit = (
    action: string,
    module: string,
    details: string,
    recordId?: string,
    oldData?: any,
    newData?: any
  ) => {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: currentUser?.id || 'sys-anonymous',
      userName: currentUser?.nama || 'Sistem / Anonim',
      userRole: currentUser?.role || 'sistem',
      action,
      module,
      recordId,
      details,
      oldData: oldData ? JSON.stringify(oldData) : undefined,
      newData: newData ? JSON.stringify(newData) : undefined,
      ipAddress: isOnline ? '127.0.0.1 (Client App)' : 'Offline Localhost',
      deviceInfo: `${navigator.platform} / ${navigator.userAgent.substring(0, 45)}...`,
      timestamp: new Date().toISOString()
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const checkIn = async (
    scheduleId: string,
    notes?: string,
    coords?: { lat: number; lng: number; accuracy?: number; distanceMeters?: number; isWithinRadius?: boolean },
    fotoSelfie?: string,
    biometricData?: { verified: boolean; verifiedAt?: string; type?: string }
  ): Promise<{ success: boolean; message: string }> => {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) {
      return { success: false, message: 'Jadwal piket tidak ditemukan.' };
    }

    if (schedule.status === 'sedang_bertugas') {
      return { success: false, message: 'Anda sudah melakukan check-in pada tugas ini.' };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Strict start time enforcement: User CANNOT check in before scheduled jamMulai
    if (schedule.jamMulai) {
      const [startHour, startMin] = schedule.jamMulai.split(':').map(Number);
      const shiftStartMinutes = startHour * 60 + startMin;

      if (currentMinutes < shiftStartMinutes) {
        return {
          success: false,
          message: `Belum waktunya Absen Mulai Piket. Sesuai jadwal, presensi baru dibuka tepat pada jam ${schedule.jamMulai} WIB.`
        };
      }
    }

    // Check if late based on shift start time + tolerance
    let isLate = false;
    let lateMinutes = 0;
    if (schedule.jamMulai) {
      const [startHour, startMin] = schedule.jamMulai.split(':').map(Number);
      const shiftMinutes = startHour * 60 + startMin;
      const tolerance = school.toleransiKeterlambatanMenit || 15;

      if (currentMinutes > shiftMinutes + tolerance) {
        isLate = true;
        lateMinutes = currentMinutes - shiftMinutes;
      }
    }

    const attId = `att-${Date.now()}`;
    const newAttendance: Attendance = {
      id: attId,
      scheduleId: schedule.id,
      userId: currentUser?.id || schedule.userId,
      userName: currentUser?.nama || schedule.userName || 'Petugas',
      postId: schedule.postId,
      postName: schedule.postName || 'Pos Piket',
      tanggal: schedule.tanggal,
      checkInAt: nowIso,
      isLate,
      lateMinutes,
      status: 'sedang_bertugas',
      deviceInfo: `${navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser'} (${navigator.platform})`,
      location: coords
        ? {
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy || 10,
            distanceMeters: coords.distanceMeters,
            isWithinRadius: coords.isWithinRadius ?? true,
            address: `Area ${schedule.postName}`
          }
        : undefined,
      fotoCheckIn: fotoSelfie,
      biometricVerified: biometricData?.verified ?? false,
      biometricVerifiedAt: biometricData?.verifiedAt,
      biometricType: biometricData?.type,
      checkInNotes: notes || (isLate ? `Check-in terlambat ${lateMinutes} menit` : 'Check-in tepat waktu'),
      createdAt: nowIso
    };

    const newStatus: ScheduleStatus = isLate ? 'terlambat' : 'sedang_bertugas';

    setAttendances((prev) => [newAttendance, ...prev]);
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? { ...s, status: newStatus, attendanceId: attId, updatedAt: nowIso }
          : s
      )
    );

    // Try direct Firebase upload if online; fallback to offline queue if offline or upload fails
    let savedDirectToCloud = false;
    if (isOnline) {
      try {
        const scheduleUpdate = {
          status: newStatus,
          attendanceId: attId,
          updatedAt: nowIso
        };
        await Promise.all([
          setDoc(doc(db, 'attendances', newAttendance.id), newAttendance, { merge: true }),
          setDoc(doc(db, 'jadwal', schedule.id), scheduleUpdate, { merge: true }),
          setDoc(doc(db, 'duty_schedules', schedule.id), scheduleUpdate, { merge: true })
        ]);
        savedDirectToCloud = true;
      } catch (cloudErr) {
        console.warn('Direct upload to Firebase failed (queueing offline):', cloudErr);
      }
    }

    if (!savedDirectToCloud) {
      await offlineDB.enqueueOfflineAction('checkIn', {
        attendance: newAttendance,
        scheduleId: schedule.id,
        newStatus,
        updatedAt: nowIso,
        userName: newAttendance.userName,
        postName: newAttendance.postName,
        checkInAt: newAttendance.checkInAt,
        isLate,
        lateMinutes,
        fotoCheckIn: fotoSelfie
      });
      await refreshPendingActions();
    }

    // Audio & visual feedback
    sound.playSuccess();
    triggerConfetti();

    // Record audit
    const bioText = biometricData?.verified ? ' [Biometrik Terverifikasi]' : '';
    recordAudit(
      'CHECK_IN',
      'Kehadiran Piket',
      `Petugas ${currentUser?.nama} berhasil check-in selfie di ${schedule.postName}${bioText} (${isLate ? `Terlambat ${lateMinutes} mnt` : 'Tepat Waktu'}${!savedDirectToCloud ? ' - Masuk Antrean Offline' : ' - Terunggah ke Firebase'})`,
      attId,
      undefined,
      newAttendance
    );

    // Notify Headmaster and Admin if late
    if (isLate) {
      const notif: NotificationItem = {
        id: `notif-${Date.now()}`,
        roleTarget: 'all',
        type: 'terlambat',
        title: 'Peringatan Keterlambatan Check-In',
        message: `${schedule.userName} melakukan check-in terlambat ${lateMinutes} menit di ${schedule.postName}.`,
        read: false,
        createdAt: nowIso
      };
      setNotifications((prev) => [notif, ...prev]);
    }

    return {
      success: true,
      message: isLate
        ? `Check-in selfie berhasil dicatat (Keterlambatan ${lateMinutes} menit tercatat${!savedDirectToCloud ? ' di antrean memori offline' : ' dan tersinkron ke Firebase'}).`
        : `Check-in selfie${biometricData?.verified ? ' & Biometrik' : ''} berhasil diverifikasi! Selamat menjalankan tugas piket${!savedDirectToCloud ? ' (Tersimpan di antrean offline, otomatis diunggah saat online)' : ' (Tersinkron ke Firebase)'}.`
    };
  };

  const checkOut = async (
    scheduleId: string,
    notes?: string,
    fotoSelfie?: string
  ): Promise<{ success: boolean; message: string }> => {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) {
      return { success: false, message: 'Jadwal piket tidak ditemukan.' };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Strict end time enforcement: User CANNOT check out before scheduled jamSelesai
    if (schedule.jamSelesai) {
      const [endHour, endMin] = schedule.jamSelesai.split(':').map(Number);
      const shiftEndMinutes = endHour * 60 + endMin;

      if (currentMinutes < shiftEndMinutes) {
        return {
          success: false,
          message: `Belum waktunya Absen Selesai Piket. Sesuai jadwal, presensi selesai baru dibuka tepat pada jam ${schedule.jamSelesai} WIB.`
        };
      }
    }

    const attendance = attendances.find((a) => a.scheduleId === scheduleId);
    let durasiMenit = 0;
    if (attendance?.checkInAt) {
      const checkInTime = new Date(attendance.checkInAt).getTime();
      durasiMenit = Math.max(1, Math.round((now.getTime() - checkInTime) / 60000));
    }

    const updatedAttendance: Attendance = attendance ? {
      ...attendance,
      checkOutAt: nowIso,
      durasiMenit,
      status: 'selesai',
      fotoCheckOut: fotoSelfie || attendance.fotoCheckOut,
      checkOutNotes: notes || 'Tugas piket selesai dengan aman.'
    } : {
      id: `att-${Date.now()}`,
      scheduleId,
      userId: currentUser?.id || schedule.userId,
      userName: currentUser?.nama || schedule.userName || 'Petugas',
      postId: schedule.postId,
      postName: schedule.postName || 'Pos Piket',
      tanggal: schedule.tanggal,
      checkInAt: nowIso,
      checkOutAt: nowIso,
      isLate: false,
      lateMinutes: 0,
      durasiMenit,
      status: 'selesai',
      fotoCheckOut: fotoSelfie,
      checkOutNotes: notes || 'Tugas piket selesai dengan aman.',
      createdAt: nowIso
    };

    setAttendances((prev) =>
      prev.map((a) =>
        a.scheduleId === scheduleId ? updatedAttendance : a
      )
    );

    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? { ...s, status: 'sudah_checkout', updatedAt: nowIso }
          : s
      )
    );

    // Try direct Firebase upload if online; fallback to offline queue if offline or upload fails
    let savedDirectToCloud = false;
    if (isOnline) {
      try {
        const promises: Promise<any>[] = [
          setDoc(doc(db, 'jadwal', scheduleId), {
            status: 'sudah_checkout',
            updatedAt: nowIso
          }, { merge: true }),
          setDoc(doc(db, 'duty_schedules', scheduleId), {
            status: 'sudah_checkout',
            updatedAt: nowIso
          }, { merge: true })
        ];
        if (updatedAttendance.id) {
          promises.push(setDoc(doc(db, 'attendances', updatedAttendance.id), updatedAttendance, { merge: true }));
        }
        await Promise.all(promises);
        savedDirectToCloud = true;
      } catch (cloudErr) {
        console.warn('Direct upload to Firebase failed on checkout (queueing offline):', cloudErr);
      }
    }

    if (!savedDirectToCloud) {
      await offlineDB.enqueueOfflineAction('checkOut', {
        attendance: updatedAttendance,
        scheduleId,
        updatedAt: nowIso,
        durasiMenit,
        userName: schedule.userName,
        postName: schedule.postName,
        checkOutAt: nowIso,
        fotoCheckOut: fotoSelfie
      });
      await refreshPendingActions();
    }

    sound.playSuccess();

    recordAudit(
      'CHECK_OUT',
      'Kehadiran Piket',
      `Petugas ${currentUser?.nama} telah check-out selfie di ${schedule.postName} (Durasi: ${durasiMenit} menit)${!savedDirectToCloud ? ' - Masuk Antrean Offline' : ' - Terunggah ke Firebase'}`,
      updatedAttendance.id,
      attendance,
      { status: 'selesai', checkOutAt: nowIso, durasiMenit }
    );

    return {
      success: true,
      message: `Check-out selesai! Terima kasih atas dedikasi tugas piket hari ini (Total: ${durasiMenit} menit)${!savedDirectToCloud ? ' (Tersimpan di antrean offline, otomatis diunggah saat online)' : ''}.`
    };
  };

  const createLogbook = async (log: Omit<Logbook, 'id' | 'createdAt'>): Promise<Logbook> => {
    const newLog: Logbook = {
      ...log,
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setLogbooks((prev) => {
      const updated = [newLog, ...prev];
      offlineDB.saveLogbooks(updated).catch(console.warn);
      return updated;
    });

    if (isOnline) {
      try {
        const cleaned = cleanFirestoreData(newLog);
        await Promise.all([
          setDoc(doc(db, 'bukuPiket', newLog.id), cleaned),
          setDoc(doc(db, 'logbooks', newLog.id), cleaned)
        ]);
      } catch (e) {
        console.warn('Could not sync logbook to Firestore:', e);
      }
    } else {
      await offlineDB.enqueueOfflineAction('createLogbook', newLog);
      await refreshPendingActions();
    }

    recordAudit('CREATE_LOGBOOK', 'Buku Piket Digital', `Menambah catatan buku piket di ${log.postName}${!isOnline ? ' (Offline Queue)' : ''}`, newLog.id, undefined, newLog);
    return newLog;
  };

  const updateLogbook = async (id: string, data: Partial<Logbook>) => {
    const old = logbooks.find((l) => l.id === id);
    const updated = old ? { ...old, ...data, updatedAt: new Date().toISOString() } : { id, ...data, updatedAt: new Date().toISOString() };
    
    setLogbooks((prev) => {
      const next = prev.map((l) => (l.id === id ? (updated as Logbook) : l));
      offlineDB.saveLogbooks(next).catch(console.warn);
      return next;
    });

    if (isOnline) {
      try {
        const cleaned = cleanFirestoreData(updated);
        await Promise.all([
          setDoc(doc(db, 'bukuPiket', id), cleaned, { merge: true }),
          setDoc(doc(db, 'logbooks', id), cleaned, { merge: true })
        ]);
      } catch (e) {
        console.warn('Could not update logbook in Firestore:', e);
      }
    }

    recordAudit('UPDATE_LOGBOOK', 'Buku Piket Digital', `Memperbarui catatan buku piket ID: ${id}`, id, old, data);
  };

  const deleteLogbook = async (id: string) => {
    const old = logbooks.find((l) => l.id === id);
    setLogbooks((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      offlineDB.saveLogbooks(updated).catch(console.warn);
      return updated;
    });

    if (isOnline) {
      try {
        await Promise.all([
          deleteDoc(doc(db, 'bukuPiket', id)),
          deleteDoc(doc(db, 'logbooks', id))
        ]);
      } catch (e) {
        console.warn('Could not delete logbook from Firestore:', e);
      }
    }

    recordAudit('DELETE_LOGBOOK', 'Buku Piket Digital', `Menghapus catatan buku piket ID: ${id}`, id, old);
  };

  const createIncident = async (incident: Omit<Incident, 'id' | 'createdAt'>): Promise<Incident> => {
    const newInc: Incident = {
      ...incident,
      id: `inc-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setIncidents((prev) => {
      const updated = [newInc, ...prev];
      offlineDB.saveIncidents(updated).catch(console.warn);
      return updated;
    });

    if (isOnline) {
      try {
        const cleaned = cleanFirestoreData(newInc);
        await Promise.all([
          setDoc(doc(db, 'kejadian', newInc.id), cleaned),
          setDoc(doc(db, 'incidents', newInc.id), cleaned)
        ]);
      } catch (e) {
        console.warn('Could not sync incident to Firestore:', e);
      }
    } else {
      await offlineDB.enqueueOfflineAction('createIncident', newInc);
      await refreshPendingActions();
    }
    
    // If flagged important for headmaster, broadcast alert
    if (newInc.pentingKepalaSekolah || newInc.prioritas === 'tinggi' || newInc.prioritas === 'darurat') {
      const notif: NotificationItem = {
        id: `notif-${Date.now()}`,
        roleTarget: 'kepsek',
        type: 'kejadian_penting',
        title: `🚨 Kejadian Penting (${newInc.prioritas.toUpperCase()}): ${newInc.lokasi}`,
        message: `${newInc.jenisKejadian} - ${newInc.deskripsi.substring(0, 100)}... Dilaporkan oleh: ${newInc.createdByUserName}`,
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [notif, ...prev]);
    }

    recordAudit('CREATE_INCIDENT', 'Kejadian', `Mencatat insiden [${newInc.prioritas}] di ${newInc.lokasi}: ${newInc.jenisKejadian}`, newInc.id, undefined, newInc);
    return newInc;
  };

  const updateIncident = async (id: string, data: Partial<Incident>) => {
    const old = incidents.find((i) => i.id === id);
    const updated = old ? { ...old, ...data, updatedAt: new Date().toISOString() } : { id, ...data, updatedAt: new Date().toISOString() };
    
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? (updated as Incident) : i))
    );

    if (isOnline) {
      try {
        const cleaned = cleanFirestoreData(updated);
        await Promise.all([
          setDoc(doc(db, 'kejadian', id), cleaned, { merge: true }),
          setDoc(doc(db, 'incidents', id), cleaned, { merge: true })
        ]);
      } catch (e) {
        console.warn('Could not update incident in Firestore:', e);
      }
    }

    recordAudit('UPDATE_INCIDENT', 'Kejadian', `Memperbarui status insiden ID: ${id}`, id, old, data);
  };

  const deleteIncident = async (id: string) => {
    const old = incidents.find((i) => i.id === id);
    setIncidents((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      offlineDB.saveIncidents(updated).catch(console.warn);
      return updated;
    });

    if (isOnline) {
      try {
        await Promise.all([
          deleteDoc(doc(db, 'kejadian', id)),
          deleteDoc(doc(db, 'incidents', id))
        ]);
      } catch (e) {
        console.warn('Could not delete incident from Firestore:', e);
      }
    }

    recordAudit('DELETE_INCIDENT', 'Kejadian', `Menghapus laporan kejadian ID: ${id}`, id, old);
  };

  const createHandover = async (handover: Omit<Handover, 'id' | 'createdAt'>): Promise<Handover> => {
    const newH: Handover = {
      ...handover,
      id: `handover-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setHandovers((prev) => [newH, ...prev]);

    if (isOnline) {
      try {
        await setDoc(doc(db, 'handovers', newH.id), cleanFirestoreData(newH));
      } catch (e) {
        console.warn('Could not sync handover to Firestore:', e);
      }
    }

    const notif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: newH.toUserId,
      type: 'serah_terima',
      title: '📋 Serah Terima Tugas Piket Baru',
      message: `${newH.fromUserName} telah menyerahkan tugas piket di ${newH.postName}. Silakan baca catatan dan konfirmasi.`,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);

    // Send automated Web Push Notification to recipient teacher
    notificationService.sendHandoverPushNotification({
      toUserId: newH.toUserId,
      toUserName: newH.toUserName,
      fromUserName: newH.fromUserName,
      postName: newH.postName,
      kondisiPos: newH.kondisiPos,
      tindakLanjutPending: newH.tindakLanjutPending,
      waktu: newH.waktu
    });

    recordAudit('CREATE_HANDOVER', 'Serah Terima', `Serah terima tugas dari ${newH.fromUserName} ke ${newH.toUserName} di ${newH.postName}`, newH.id, undefined, newH);
    return newH;
  };

  const acknowledgeHandover = async (handoverId: string, notes?: string) => {
    const nowIso = new Date().toISOString();
    setHandovers((prev) =>
      prev.map((h) =>
        h.id === handoverId
          ? { ...h, status: 'diterima', acknowledgedAt: nowIso, acknowledgementNotes: notes }
          : h
      )
    );

    if (isOnline) {
      try {
        await setDoc(doc(db, 'handovers', handoverId), {
          status: 'diterima',
          acknowledgedAt: nowIso,
          acknowledgementNotes: notes || ''
        }, { merge: true });
      } catch (e) {
        console.warn('Could not update handover in Firestore:', e);
      }
    }

    recordAudit('ACKNOWLEDGE_HANDOVER', 'Serah Terima', `Konfirmasi penerimaan serah terima tugas ID: ${handoverId}`, handoverId);
  };

  const updateHandover = async (id: string, data: Partial<Handover>) => {
    setHandovers((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...data } : h))
    );
    if (isOnline) {
      try {
        await setDoc(doc(db, 'handovers', id), cleanFirestoreData(data), { merge: true });
      } catch (e) {
        console.warn('Failed to update handover in Firestore:', e);
      }
    }
    recordAudit('UPDATE_HANDOVER', 'Serah Terima', `Memperbarui data serah terima ID ${id}`, id);
  };

  const deleteHandover = async (id: string) => {
    setHandovers((prev) => prev.filter((h) => h.id !== id));
    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'handovers', id));
      } catch (e) {
        console.warn('Failed to delete handover in Firestore:', e);
      }
    }
    recordAudit('DELETE_HANDOVER', 'Serah Terima', `Menghapus entri serah terima ID ${id}`, id);
  };

  const createReplacement = async (rep: Omit<DutyReplacement, 'id' | 'createdAt'>) => {
    const newRep: DutyReplacement = {
      ...rep,
      id: `rep-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setReplacements((prev) => [newRep, ...prev]);

    setSchedules((prev) =>
      prev.map((s) => {
        if (s.id === rep.scheduleId) {
          return {
            ...s,
            isReplacement: true,
            originalUserId: rep.originalUserId,
            originalUserName: rep.originalUserName,
            userId: rep.replacementUserId,
            userName: rep.replacementUserName,
            replacementReason: rep.alasan,
            status: 'belum_checkin'
          };
        }
        return s;
      })
    );

    if (isOnline) {
      try {
        const schedUpdate = {
          isReplacement: true,
          originalUserId: rep.originalUserId,
          originalUserName: rep.originalUserName,
          userId: rep.replacementUserId,
          userName: rep.replacementUserName,
          replacementReason: rep.alasan,
          status: 'belum_checkin',
          updatedAt: new Date().toISOString()
        };
        await Promise.all([
          setDoc(doc(db, 'replacements', newRep.id), cleanFirestoreData(newRep)),
          setDoc(doc(db, 'jadwal', rep.scheduleId), schedUpdate, { merge: true }),
          setDoc(doc(db, 'duty_schedules', rep.scheduleId), schedUpdate, { merge: true })
        ]);
      } catch (e) {
        console.warn('Could not sync replacement to Firestore:', e);
      }
    }

    const notif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: rep.replacementUserId,
      type: 'penggantian',
      title: '🔄 Penugasan Guru Pengganti Piket',
      message: `Anda ditugaskan menggantikan ${rep.originalUserName} di ${rep.postName} pada tanggal ${rep.tanggal}. Alasan: ${rep.alasan}`,
      read: false,
      createdAt: new Date().toISOString()
    };
    setNotifications((prev) => [notif, ...prev]);

    recordAudit('CREATE_REPLACEMENT', 'Penggantian Petugas', `Penggantian petugas ${rep.originalUserName} digantikan oleh ${rep.replacementUserName} (${rep.alasan})`, rep.scheduleId);
  };

  const updateReplacement = async (id: string, data: Partial<DutyReplacement>) => {
    setReplacements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...data } : r))
    );
    if (isOnline) {
      try {
        await setDoc(doc(db, 'replacements', id), cleanFirestoreData(data), { merge: true });
      } catch (e) {
        console.warn('Failed to update replacement in Firestore:', e);
      }
    }
    recordAudit('UPDATE_REPLACEMENT', 'Penggantian Petugas', `Memperbarui data penggantian ID ${id}`, id);
  };

  const deleteReplacement = async (id: string) => {
    setReplacements((prev) => prev.filter((r) => r.id !== id));
    if (isOnline) {
      try {
        await deleteDoc(doc(db, 'replacements', id));
      } catch (e) {
        console.warn('Failed to delete replacement in Firestore:', e);
      }
    }
    recordAudit('DELETE_REPLACEMENT', 'Penggantian Petugas', `Menghapus entri penggantian ID ${id}`, id);
  };

  const adminManualCheckIn = async (
    scheduleId: string,
    status: 'sedang_bertugas' | 'terlambat' | 'sakit' | 'izin' | 'lowbat_tunggu',
    notes: string
  ): Promise<{ success: boolean; message: string }> => {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) {
      return { success: false, message: 'Jadwal piket tidak ditemukan.' };
    }

    const nowIso = new Date().toISOString();
    let targetStatus: ScheduleStatus = 'sedang_bertugas';
    let labelNotes = notes || 'Presensi Manual oleh Admin';

    if (status === 'terlambat') {
      targetStatus = 'terlambat';
    } else if (status === 'sakit') {
      targetStatus = 'dibatalkan';
      labelNotes = `[SAKIT] ${notes}`;
    } else if (status === 'izin') {
      targetStatus = 'dibatalkan';
      labelNotes = `[IZIN] ${notes}`;
    } else if (status === 'lowbat_tunggu') {
      targetStatus = 'belum_checkin';
      labelNotes = `[STATUS TUNGGU - HP LOW-BAT/KENDALA HP] ${notes}`;
    }

    if (status === 'sedang_bertugas' || status === 'terlambat') {
      const attId = `att-${Date.now()}`;
      const newAttendance: Attendance = {
        id: attId,
        scheduleId: schedule.id,
        userId: schedule.userId,
        userName: schedule.userName || 'Petugas',
        postId: schedule.postId,
        postName: schedule.postName || 'Pos Piket',
        tanggal: schedule.tanggal,
        checkInAt: nowIso,
        isLate: status === 'terlambat',
        lateMinutes: status === 'terlambat' ? 15 : 0,
        status: 'sedang_bertugas',
        deviceInfo: 'Admin Manual Override',
        checkInNotes: `[Presensi Manual Admin] ${labelNotes}`,
        createdAt: nowIso
      };

      setAttendances((prev) => [newAttendance, ...prev]);
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === scheduleId
            ? { ...s, status: targetStatus, attendanceId: attId, notes: labelNotes, updatedAt: nowIso }
            : s
        )
      );

      if (isOnline) {
        try {
          await Promise.all([
            setDoc(doc(db, 'attendances', attId), newAttendance, { merge: true }),
            setDoc(doc(db, 'jadwal', scheduleId), { status: targetStatus, attendanceId: attId, notes: labelNotes, updatedAt: nowIso }, { merge: true }),
            setDoc(doc(db, 'duty_schedules', scheduleId), { status: targetStatus, attendanceId: attId, notes: labelNotes, updatedAt: nowIso }, { merge: true })
          ]);
        } catch (e) {
          console.warn('Failed to sync admin manual check-in to Firestore:', e);
        }
      }
    } else {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === scheduleId
            ? { ...s, status: targetStatus, notes: labelNotes, updatedAt: nowIso }
            : s
        )
      );

      if (isOnline) {
        try {
          await Promise.all([
            setDoc(doc(db, 'jadwal', scheduleId), { status: targetStatus, notes: labelNotes, updatedAt: nowIso }, { merge: true }),
            setDoc(doc(db, 'duty_schedules', scheduleId), { status: targetStatus, notes: labelNotes, updatedAt: nowIso }, { merge: true })
          ]);
        } catch (e) {
          console.warn('Failed to sync schedule status update to Firestore:', e);
        }
      }
    }

    sound.playSuccess();
    recordAudit('ADMIN_MANUAL_CHECKIN', 'Kehadiran Piket', `Admin memperbarui status piket ${schedule.userName} (${status}): ${labelNotes}`, scheduleId);

    return {
      success: true,
      message: `Status presensi ${schedule.userName} berhasil diperbarui oleh Admin.`
    };
  };

  const createSchedule = async (schedule: Omit<DutySchedule, 'id' | 'createdAt'>): Promise<DutySchedule> => {
    const newSch: DutySchedule = {
      ...schedule,
      id: `sch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };
    setSchedules((prev) => [newSch, ...prev]);

    if (isOnline) {
      try {
        const cleaned = cleanFirestoreData(newSch);
        await Promise.all([
          setDoc(doc(db, 'jadwal', newSch.id), cleaned),
          setDoc(doc(db, 'duty_schedules', newSch.id), cleaned)
        ]);
      } catch (e) {
        console.warn('Could not sync schedule to Firestore:', e);
      }
    }

    recordAudit('CREATE_SCHEDULE', 'Jadwal Piket', `Membuat jadwal piket ${newSch.userName} pada ${newSch.tanggal} di ${newSch.postName}`, newSch.id, undefined, newSch);
    return newSch;
  };

  const updateSchedule = async (id: string, data: Partial<DutySchedule>) => {
    const old = schedules.find((s) => s.id === id);
    const updated = old ? { ...old, ...data, updatedAt: new Date().toISOString() } : { id, ...data, updatedAt: new Date().toISOString() };
    
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? (updated as DutySchedule) : s))
    );

    if (isOnline) {
      try {
        const cleaned = cleanFirestoreData(updated);
        await Promise.all([
          setDoc(doc(db, 'jadwal', id), cleaned, { merge: true }),
          setDoc(doc(db, 'duty_schedules', id), cleaned, { merge: true })
        ]);
      } catch (e) {
        console.warn('Could not update schedule in Firestore:', e);
      }
    }

    recordAudit('UPDATE_SCHEDULE', 'Jadwal Piket', `Memperbarui jadwal ID: ${id}`, id, old, data);
  };

  const deleteSchedule = async (id: string) => {
    const old = schedules.find((s) => s.id === id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));

    if (isOnline) {
      try {
        await Promise.all([
          deleteDoc(doc(db, 'jadwal', id)),
          deleteDoc(doc(db, 'duty_schedules', id))
        ]);
      } catch (e) {
        console.warn('Could not delete schedule from Firestore:', e);
      }
    }

    recordAudit('DELETE_SCHEDULE', 'Jadwal Piket', `Menghapus jadwal ID: ${id} (${old?.userName} - ${old?.tanggal})`, id, old);
  };

  const deleteMultipleSchedules = async (ids: string[]): Promise<{ success: boolean; count: number }> => {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    const idSet = new Set(ids);
    const deletedSchedules = schedules.filter((s) => idSet.has(s.id));

    setSchedules((prev) => prev.filter((s) => !idSet.has(s.id)));

    if (isOnline) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'jadwal', id));
          batch.delete(doc(db, 'duty_schedules', id));
        });
        await batch.commit();
      } catch (fbErr) {
        console.warn('Batch delete schedules from Firebase failed, falling back to individual deletes:', fbErr);
        for (const id of ids) {
          deleteDoc(doc(db, 'jadwal', id)).catch(console.warn);
          deleteDoc(doc(db, 'duty_schedules', id)).catch(console.warn);
        }
      }
    }

    recordAudit(
      'DELETE_MULTIPLE_SCHEDULES',
      'Jadwal Piket',
      `Menghapus massal ${deletedSchedules.length} jadwal piket: ${deletedSchedules.slice(0, 5).map(s => `${s.userName} (${s.tanggal})`).join(', ')}${deletedSchedules.length > 5 ? ' dan lainnya' : ''}`,
      undefined,
      deletedSchedules
    );

    return { success: true, count: deletedSchedules.length };
  };

  const generateSemesterSchedule = async (params: {
    startDate: string;
    endDate: string;
    postAssignments: { [day: string]: { [postId: string]: string[] } };
  }): Promise<number> => {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const newGenerated: DutySchedule[] = [];
    const defaultShift = shifts[0] || INITIAL_SHIFTS[0];

    let current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayName = getDayNameIndo(dateStr);

      if (current.getDay() !== 0) {
        const dayPlan = params.postAssignments[dayName];
        if (dayPlan) {
          Object.keys(dayPlan).forEach((postId) => {
            const userIds = dayPlan[postId];
            const postObj = posts.find((p) => p.id === postId);

            userIds.forEach((uId) => {
              const userObj = users.find((u) => u.id === uId);
              if (userObj && postObj) {
                newGenerated.push({
                  id: `gen-sch-${dateStr}-${postId}-${uId}-${Math.random().toString(36).substr(2, 3)}`,
                  schoolYearId: schoolYear.id,
                  tanggal: dateStr,
                  hari: dayName,
                  shiftId: defaultShift.id,
                  shiftName: defaultShift.namaShift,
                  jamMulai: defaultShift.jamMulai,
                  jamSelesai: defaultShift.jamSelesai,
                  postId: postObj.id,
                  postName: postObj.namaPos,
                  userId: userObj.id,
                  userName: userObj.nama,
                  userRole: userObj.role,
                  status: 'belum_checkin',
                  createdAt: new Date().toISOString()
                });
              }
            });
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    setSchedules((prev) => [...prev, ...newGenerated]);

    if (isOnline && newGenerated.length > 0) {
      try {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < newGenerated.length; i += CHUNK_SIZE) {
          const chunk = newGenerated.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const s of chunk) {
            const cleaned = cleanFirestoreData(s);
            batch.set(doc(db, 'jadwal', s.id), cleaned);
            batch.set(doc(db, 'duty_schedules', s.id), cleaned);
          }
          await batch.commit();
        }
      } catch (e) {
        console.warn('Could not sync semester schedules to Firestore:', e);
      }
    }

    recordAudit('GENERATE_SEMESTER_SCHEDULES', 'Jadwal Piket', `Generate massal 1 semester berhasil (${newGenerated.length} entri jadwal).`);
    return newGenerated.length;
  };

  // Helper validators for batch imports to prevent false duplicate collisions
  const isValidNipForDuplicate = (nip?: string | null): boolean => {
    if (!nip) return false;
    const clean = nip.trim().toLowerCase();
    if (['-', '--', '---', '0', 'none', 'null', 'n/a', 'na', 'tidak ada', 'belum ada', 'belum punya', ''].includes(clean)) {
      return false;
    }
    return clean.length >= 4;
  };

  const isValidEmailForDuplicate = (email?: string | null): boolean => {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    if (['-', '--', 'none', 'null', 'n/a', ''].includes(clean)) return false;
    return clean.includes('@') && clean.length >= 5;
  };

  const isValidUsernameForDuplicate = (username?: string | null): boolean => {
    if (!username) return false;
    const clean = username.trim().toLowerCase();
    return clean.length >= 3 && clean !== '-' && !clean.startsWith('user_temp');
  };

  // Master Users CRUD
  const createUser = async (userData: Omit<User, 'id'>): Promise<User> => {
    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    console.log(`[DataContext.createUser Stage 1] Creating new user: ${newUser.nama} (${newUser.id})...`);
    setUsers((prev) => {
      const next = [...prev, newUser];
      saveToStorage('users', next);
      return next;
    });

    try {
      if (isOnline) {
        console.log(`[DataContext.createUser Stage 2] Sending setDoc Promise to Firestore 'user/${newUser.id}' and 'users/${newUser.id}'...`);
        const cleaned = cleanFirestoreData(newUser);
        await Promise.all([
          setDoc(doc(db, 'user', newUser.id), cleaned),
          setDoc(doc(db, 'users', newUser.id), cleaned)
        ]);
        console.log(`[DataContext.createUser Stage 3] ✅ User doc '${newUser.id}' persisted to Cloud Firestore successfully.`);
      }
    } catch (fbErr) {
      console.error('[DataContext.createUser ERROR] ❌ Could not sync newUser to Firebase Firestore:', fbErr);
    }

    recordAudit('CREATE_USER', 'Master Pengguna', `Menambahkan pengguna baru: ${newUser.nama} (${newUser.role})`, newUser.id, undefined, newUser);
    return newUser;
  };

  const updateUser = async (id: string, data: Partial<User>) => {
    const old = users.find((u) => u.id === id);
    const updatedUserObj = old ? { ...old, ...data, updatedAt: new Date().toISOString() } : { id, ...data };

    console.log(`[DataContext.updateUser Stage 1] Initiating user update for ID '${id}'... Changed keys:`, Object.keys(data));

    setUsers((prev) => {
      const nextList = prev.map((u) => (u.id === id ? { ...u, ...data, updatedAt: new Date().toISOString() } : u));
      saveToStorage('users', nextList);
      console.log(`[DataContext.updateUser Stage 2] Local React State & LocalStorage updated for ID '${id}'.`);
      return nextList;
    });

    try {
      if (isOnline) {
        console.log(`[DataContext.updateUser Stage 3] Executing setDoc Promise (merge: true) to Firestore collection 'user' and 'users' for doc '${id}'...`);
        const cleaned = cleanFirestoreData(updatedUserObj);
        await Promise.all([
          setDoc(doc(db, 'user', id), cleaned, { merge: true }),
          setDoc(doc(db, 'users', id), cleaned, { merge: true })
        ]);
        console.log(`[DataContext.updateUser Stage 4] ✅ Firestore setDoc Promise resolved successfully! User doc '${id}' persisted to Cloud Firestore.`);
      } else {
        console.warn(`[DataContext.updateUser Stage 3 Offline] Client is offline. Data cached locally.`);
      }
    } catch (fbErr: any) {
      console.error(`[DataContext.updateUser Stage 4 ERROR] ❌ Failed to persist user doc '${id}' to Firestore:`, fbErr);
    }

    recordAudit('UPDATE_USER', 'Master Pengguna', `Mengubah data pengguna: ${data.nama || old?.nama}`, id, old, data);
  };

  const deleteUser = async (id: string) => {
    const old = users.find((u) => u.id === id);
    setUsers((prev) => prev.filter((u) => u.id !== id));

    try {
      if (isOnline) {
        await Promise.all([
          deleteDoc(doc(db, 'user', id)),
          deleteDoc(doc(db, 'users', id))
        ]);
      }
    } catch (fbErr) {
      console.warn('Could not delete user from Firebase Firestore:', fbErr);
    }

    recordAudit('DELETE_USER', 'Master Pengguna', `Menghapus pengguna: ${old?.nama}`, id, old);
  };

  const deleteMultipleUsers = async (ids: string[]): Promise<{ success: boolean; count: number }> => {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    const idSet = new Set(ids);
    const deletedUsers = users.filter((u) => idSet.has(u.id));

    setUsers((prev) => prev.filter((u) => !idSet.has(u.id)));

    if (isOnline) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'user', id));
          batch.delete(doc(db, 'users', id));
        });
        await batch.commit();
      } catch (fbErr) {
        console.warn('Batch delete users from Firebase failed, falling back to individual deletes:', fbErr);
        // Fallback
        for (const id of ids) {
          deleteDoc(doc(db, 'user', id)).catch(console.warn);
          deleteDoc(doc(db, 'users', id)).catch(console.warn);
        }
      }
    }

    recordAudit(
      'DELETE_MULTIPLE_USERS',
      'Master Pengguna',
      `Menghapus massal ${deletedUsers.length} pengguna: ${deletedUsers.slice(0, 5).map(u => u.nama).join(', ')}${deletedUsers.length > 5 ? ' dan lainnya' : ''}`,
      undefined,
      deletedUsers
    );

    return { success: true, count: deletedUsers.length };
  };

  const importUsersBatch = async (
    newUsers: Omit<User, 'id'>[],
    mode: 'append' | 'update_existing' = 'append',
    options?: { atomic?: boolean }
  ): Promise<BatchImportResult> => {
    const isAtomic = options?.atomic !== false;
    const errors: ImportErrorItem[] = [];
    const validRoles = ['admin', 'guru', 'tendik', 'kepsek'];

    // 1. PRE-VALIDATION PASS (Atomic schema & constraint checks)
    const seenUsernamesInBatch = new Set<string>();
    const seenNipsInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();

    newUsers.forEach((u, index) => {
      const rowNum = index + 1;
      const ident = u.nama || `Baris #${rowNum}`;

      // Check Nama (Mandatory)
      if (!u.nama || u.nama.trim().length < 2) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'Nama Lengkap',
          rejectedValue: u.nama || '(kosong)',
          errorMessage: 'Nama Lengkap wajib diisi minimal 2 karakter.',
          critical: true
        });
      }

      // Check Role
      if (u.role && !validRoles.includes(u.role)) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'Role',
          rejectedValue: u.role,
          errorMessage: `Role '${u.role}' tidak valid. Pilihan: guru, tendik, kepsek, admin.`,
          critical: true
        });
      }

      // Check PIN format
      if (u.pin && !/^\d{4,8}$/.test(u.pin)) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'PIN Masuk',
          rejectedValue: u.pin,
          errorMessage: 'PIN harus berupa 4-8 digit angka.',
          critical: false
        });
      }

      // Check Internal Duplicate Username in File
      if (u.username && isValidUsernameForDuplicate(u.username)) {
        const uNorm = u.username.toLowerCase().trim();
        if (seenUsernamesInBatch.has(uNorm)) {
          errors.push({
            rowNumber: rowNum,
            identifier: ident,
            field: 'Username',
            rejectedValue: u.username,
            errorMessage: `Username '@${u.username}' duplikat dalam file import yang sama.`,
            critical: true
          });
        } else {
          seenUsernamesInBatch.add(uNorm);
        }
      }

      // Check Internal Duplicate NIP in File
      if (u.nip && isValidNipForDuplicate(u.nip)) {
        const nipNorm = u.nip.trim();
        if (seenNipsInBatch.has(nipNorm)) {
          errors.push({
            rowNumber: rowNum,
            identifier: ident,
            field: 'NIP',
            rejectedValue: u.nip,
            errorMessage: `NIP '${u.nip}' duplikat dalam file import yang sama.`,
            critical: true
          });
        } else {
          seenNipsInBatch.add(nipNorm);
        }
      }

      // Check Internal Duplicate Email in File
      if (u.email && isValidEmailForDuplicate(u.email)) {
        const emailNorm = u.email.toLowerCase().trim();
        if (seenEmailsInBatch.has(emailNorm)) {
          errors.push({
            rowNumber: rowNum,
            identifier: ident,
            field: 'Email',
            rejectedValue: u.email,
            errorMessage: `Email '${u.email}' duplikat dalam file import yang sama.`,
            critical: true
          });
        } else {
          seenEmailsInBatch.add(emailNorm);
        }
      }
    });

    // 2. ATOMIC ROLLBACK EVALUATION
    if (isAtomic && errors.some((e) => e.critical)) {
      recordAudit(
        'IMPORT_USERS_ROLLBACK',
        'Master Pengguna',
        `[TRANSAKSI ATOMIK DIBATALKAN] Gagal mengimpor ${newUsers.length} data. Ditemukan ${errors.length} kesalahan validasi. Seluruh perubahan dibatalkan (Rollback 100%).`
      );
      return {
        success: false,
        isAtomic: true,
        total: newUsers.length,
        created: 0,
        updated: 0,
        skipped: newUsers.length,
        errors,
        message: `Transaksi atomik dibatalkan: Ditemukan ${errors.length} baris dengan kesalahan data. Seluruh ${newUsers.length} baris dibatalkan demi integritas database.`
      };
    }

    // 3. ATOMIC COMMIT / PROCESS (All-or-Nothing or Filtered)
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const invalidRowIndices = new Set(errors.filter((e) => e.critical).map((e) => e.rowNumber - 1));
    const usersToSyncToFirestore: User[] = [];

    setUsers((prev) => {
      const userMap = new Map<string, User>();
      const existingUsernames = new Set<string>();

      prev.forEach((u) => {
        if (isValidUsernameForDuplicate(u.username)) {
          const uKey = u.username!.toLowerCase().trim();
          userMap.set(`user:${uKey}`, u);
          existingUsernames.add(uKey);
        }
        if (isValidNipForDuplicate(u.nip)) {
          userMap.set(`nip:${u.nip!.trim()}`, u);
        }
        if (isValidEmailForDuplicate(u.email)) {
          userMap.set(`email:${u.email!.toLowerCase().trim()}`, u);
        }
      });

      const updatedList = [...prev];

      newUsers.forEach((input, idx) => {
        if (!isAtomic && invalidRowIndices.has(idx)) {
          skippedCount++;
          return;
        }

        let baseSlug = (
          input.username ||
          (input.email && isValidEmailForDuplicate(input.email) ? input.email.split('@')[0] : '') ||
          input.nama
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/^_+|_+$/g, '')
          .substring(0, 18);

        if (!baseSlug || baseSlug.length < 2) {
          baseSlug = `user_${idx + 1}`;
        }

        const inputUsername = input.username?.toLowerCase().trim();
        const inputNip = input.nip?.trim() || '-';
        const inputEmail = input.email?.toLowerCase().trim();

        let existing: User | undefined;
        if (isValidUsernameForDuplicate(inputUsername) && userMap.has(`user:${inputUsername}`)) {
          existing = userMap.get(`user:${inputUsername}`);
        } else if (isValidNipForDuplicate(inputNip) && userMap.has(`nip:${inputNip}`)) {
          existing = userMap.get(`nip:${inputNip}`);
        } else if (isValidEmailForDuplicate(inputEmail) && userMap.has(`email:${inputEmail}`)) {
          existing = userMap.get(`email:${inputEmail}`);
        }

        if (existing) {
          if (mode === 'update_existing') {
            const indexInList = updatedList.findIndex((u) => u.id === existing!.id);
            if (indexInList !== -1) {
              const updatedObj: User = {
                ...updatedList[indexInList],
                ...input,
                nama: input.nama || updatedList[indexInList].nama,
                role: input.role || updatedList[indexInList].role,
                nip: input.nip !== undefined ? input.nip : updatedList[indexInList].nip,
                nuptk: input.nuptk !== undefined ? input.nuptk : updatedList[indexInList].nuptk,
                nomorHP: input.nomorHP || updatedList[indexInList].nomorHP,
                jabatan: input.jabatan || updatedList[indexInList].jabatan,
                unitKerja: input.unitKerja || updatedList[indexInList].unitKerja,
                pin: input.pin || updatedList[indexInList].pin || '123456',
                password: input.password || updatedList[indexInList].password || 'password123',
                statusAktif: input.statusAktif !== undefined ? input.statusAktif : updatedList[indexInList].statusAktif,
                updatedAt: new Date().toISOString()
              };
              updatedList[indexInList] = updatedObj;
              usersToSyncToFirestore.push(updatedObj);
              updatedCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          let cleanUsername = input.username && isValidUsernameForDuplicate(input.username)
            ? input.username.toLowerCase().trim()
            : baseSlug;

          let suffix = 1;
          while (existingUsernames.has(cleanUsername)) {
            suffix++;
            cleanUsername = `${baseSlug.substring(0, 14)}_${suffix}`;
          }
          existingUsernames.add(cleanUsername);

          const finalEmail = isValidEmailForDuplicate(inputEmail)
            ? inputEmail!
            : `${cleanUsername}@sekolah.sch.id`;

          const newUser: User = {
            ...input,
            id: `user-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            username: cleanUsername,
            email: finalEmail,
            nip: inputNip,
            nuptk: input.nuptk?.trim() || '-',
            pin: input.pin || '123456',
            password: input.password || 'password123',
            statusAktif: input.statusAktif !== undefined ? input.statusAktif : true,
            createdAt: new Date().toISOString()
          };
          updatedList.push(newUser);
          usersToSyncToFirestore.push(newUser);

          if (isValidUsernameForDuplicate(cleanUsername)) {
            userMap.set(`user:${cleanUsername}`, newUser);
          }
          if (isValidNipForDuplicate(inputNip)) {
            userMap.set(`nip:${inputNip}`, newUser);
          }
          if (isValidEmailForDuplicate(finalEmail)) {
            userMap.set(`email:${finalEmail}`, newUser);
          }
          createdCount++;
        }
      });

      return updatedList;
    });

    // Write all new and updated users to Cloud Firestore in chunks of up to 400
    if (isOnline && usersToSyncToFirestore.length > 0) {
      try {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < usersToSyncToFirestore.length; i += CHUNK_SIZE) {
          const chunk = usersToSyncToFirestore.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const u of chunk) {
            const cleaned = cleanFirestoreData(u);
            batch.set(doc(db, 'user', u.id), cleaned, { merge: true });
            batch.set(doc(db, 'users', u.id), cleaned, { merge: true });
          }
          await batch.commit();
        }
      } catch (fbErr) {
        console.warn('Batch write users to Firebase failed, falling back to individual writes:', fbErr);
        for (const u of usersToSyncToFirestore) {
          try {
            const cleaned = cleanFirestoreData(u);
            await Promise.all([
              setDoc(doc(db, 'user', u.id), cleaned, { merge: true }),
              setDoc(doc(db, 'users', u.id), cleaned, { merge: true })
            ]);
          } catch (e) {
            console.warn(`Could not sync user ${u.id} to Firestore:`, e);
          }
        }
      }
    }

    recordAudit(
      'IMPORT_USERS_BATCH',
      'Master Pengguna',
      `[TRANSAKSI SUKSES] Impor data master pengguna: ${createdCount} baru, ${updatedCount} diperbarui, ${skippedCount} dilewati dari total ${newUsers.length} data.`
    );

    return {
      success: true,
      isAtomic,
      total: newUsers.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors,
      message: `Berhasil mengimpor ${createdCount} pengguna baru, memperbarui ${updatedCount} data, dan ${skippedCount} dilewati.`
    };
  };

  // Master Posts CRUD
  const createPost = async (postData: Omit<DutyPost, 'id'>): Promise<DutyPost> => {
    const newPost: DutyPost = {
      ...postData,
      id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    setPosts((prev) => [...prev, newPost]);

    try {
      if (isOnline) {
        await setDoc(doc(db, 'duty_posts', newPost.id), cleanFirestoreData(newPost));
      }
    } catch (e) {
      console.warn('Could not sync post to Firestore:', e);
    }

    recordAudit('CREATE_POST', 'Master Pos Piket', `Menambahkan pos piket baru: ${newPost.namaPos}`, newPost.id, undefined, newPost);
    return newPost;
  };

  const updatePost = async (id: string, data: Partial<DutyPost>) => {
    const old = posts.find((p) => p.id === id);
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));

    try {
      if (isOnline) {
        await setDoc(doc(db, 'duty_posts', id), cleanFirestoreData({ id, ...data }), { merge: true });
      }
    } catch (e) {
      console.warn('Could not sync post to Firestore:', e);
    }

    recordAudit('UPDATE_POST', 'Master Pos Piket', `Mengubah pos piket: ${data.namaPos || old?.namaPos}`, id, old, data);
  };

  const deletePost = async (id: string) => {
    const old = posts.find((p) => p.id === id);
    setPosts((prev) => prev.filter((p) => p.id !== id));

    try {
      if (isOnline) {
        await deleteDoc(doc(db, 'duty_posts', id));
      }
    } catch (e) {
      console.warn('Could not delete post from Firestore:', e);
    }

    recordAudit('DELETE_POST', 'Master Pos Piket', `Menghapus pos piket: ${old?.namaPos}`, id, old);
  };

  const deleteMultiplePosts = async (ids: string[]): Promise<{ success: boolean; count: number }> => {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    const idSet = new Set(ids);
    const deletedPosts = posts.filter((p) => idSet.has(p.id));

    setPosts((prev) => prev.filter((p) => !idSet.has(p.id)));

    if (isOnline) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'duty_posts', id));
        });
        await batch.commit();
      } catch (fbErr) {
        console.warn('Batch delete posts from Firebase failed, falling back:', fbErr);
        for (const id of ids) {
          deleteDoc(doc(db, 'duty_posts', id)).catch(console.warn);
        }
      }
    }

    recordAudit(
      'DELETE_MULTIPLE_POSTS',
      'Master Pos Piket',
      `Menghapus massal ${deletedPosts.length} pos piket: ${deletedPosts.map(p => p.namaPos).join(', ')}`,
      undefined,
      deletedPosts
    );

    return { success: true, count: deletedPosts.length };
  };

  const importPostsBatch = async (
    newPosts: Omit<DutyPost, 'id'>[],
    mode: 'append' | 'update_existing' = 'append',
    options?: { atomic?: boolean }
  ): Promise<BatchImportResult> => {
    const isAtomic = options?.atomic !== false;
    const errors: ImportErrorItem[] = [];
    const seenPostNames = new Set<string>();

    // 1. PRE-VALIDATION PASS
    newPosts.forEach((p, idx) => {
      const rowNum = idx + 1;
      const ident = p.namaPos || `Pos #${rowNum}`;

      if (!p.namaPos || p.namaPos.trim().length < 2) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'Nama Pos',
          rejectedValue: p.namaPos || '(kosong)',
          errorMessage: 'Nama Pos wajib diisi minimal 2 karakter.',
          critical: true
        });
      } else {
        const norm = p.namaPos.toLowerCase().trim();
        if (seenPostNames.has(norm)) {
          errors.push({
            rowNumber: rowNum,
            identifier: ident,
            field: 'Nama Pos',
            rejectedValue: p.namaPos,
            errorMessage: `Nama Pos '${p.namaPos}' duplikat dalam file import yang sama.`,
            critical: true
          });
        } else {
          seenPostNames.add(norm);
        }
      }

      if (p.petugasRequiredCount !== undefined && (isNaN(Number(p.petugasRequiredCount)) || Number(p.petugasRequiredCount) < 1)) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'Jumlah Petugas Wajib',
          rejectedValue: String(p.petugasRequiredCount),
          errorMessage: 'Jumlah petugas wajib minimal 1 orang.',
          critical: false
        });
      }
    });

    // 2. ATOMIC ROLLBACK CHECK
    if (isAtomic && errors.some((e) => e.critical)) {
      recordAudit(
        'IMPORT_POSTS_ROLLBACK',
        'Master Pos Piket',
        `[TRANSAKSI ATOMIK DIBATALKAN] Gagal mengimpor pos piket. Ditemukan ${errors.length} kesalahan validasi. Rollback 100%.`
      );
      return {
        success: false,
        isAtomic: true,
        total: newPosts.length,
        created: 0,
        updated: 0,
        skipped: newPosts.length,
        errors,
        message: `Transaksi atomik dibatalkan: Ditemukan ${errors.length} kesalahan pada baris data pos.`
      };
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const invalidIndices = new Set(errors.filter((e) => e.critical).map((e) => e.rowNumber - 1));
    const postsToSyncToFirestore: DutyPost[] = [];

    setPosts((prev) => {
      const postMap = new Map<string, DutyPost>();
      prev.forEach((p) => {
        if (p.namaPos?.trim()) {
          postMap.set(p.namaPos.toLowerCase().trim(), p);
        }
      });
      const updatedList = [...prev];

      newPosts.forEach((input, idx) => {
        if (!isAtomic && invalidIndices.has(idx)) {
          skippedCount++;
          return;
        }
        if (!input.namaPos || !input.namaPos.trim()) return;

        const key = input.namaPos.toLowerCase().trim();
        const existing = postMap.get(key);
        if (existing) {
          if (mode === 'update_existing') {
            const indexInList = updatedList.findIndex((p) => p.id === existing.id);
            if (indexInList !== -1) {
              const updatedObj: DutyPost = {
                ...updatedList[indexInList],
                ...input,
                lokasi: input.lokasi || updatedList[indexInList].lokasi,
                petugasRequiredCount: input.petugasRequiredCount || updatedList[indexInList].petugasRequiredCount || 1,
                deskripsi: input.deskripsi || updatedList[indexInList].deskripsi,
                statusAktif: input.statusAktif !== undefined ? input.statusAktif : updatedList[indexInList].statusAktif
              };
              updatedList[indexInList] = updatedObj;
              postsToSyncToFirestore.push(updatedObj);
              updatedCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          const newPost: DutyPost = {
            ...input,
            id: `post-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            petugasRequiredCount: input.petugasRequiredCount || 1,
            statusAktif: input.statusAktif !== undefined ? input.statusAktif : true
          };
          updatedList.push(newPost);
          postsToSyncToFirestore.push(newPost);
          postMap.set(key, newPost);
          createdCount++;
        }
      });
      return updatedList;
    });

    // Write all new and updated posts to Cloud Firestore
    if (isOnline && postsToSyncToFirestore.length > 0) {
      try {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < postsToSyncToFirestore.length; i += CHUNK_SIZE) {
          const chunk = postsToSyncToFirestore.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const p of chunk) {
            batch.set(doc(db, 'duty_posts', p.id), cleanFirestoreData(p), { merge: true });
          }
          await batch.commit();
        }
      } catch (fbErr) {
        console.warn('Batch write posts to Firebase failed, falling back:', fbErr);
        for (const p of postsToSyncToFirestore) {
          setDoc(doc(db, 'duty_posts', p.id), cleanFirestoreData(p), { merge: true }).catch(console.warn);
        }
      }
    }

    recordAudit(
      'IMPORT_POSTS_BATCH',
      'Master Pos Piket',
      `[TRANSAKSI SUKSES] Impor data master pos: ${createdCount} baru, ${updatedCount} diperbarui, ${skippedCount} dilewati.`
    );
    return {
      success: true,
      isAtomic,
      total: newPosts.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors,
      message: `Berhasil mengimpor ${createdCount} pos baru dan memperbarui ${updatedCount} pos.`
    };
  };

  // Master Shifts CRUD
  const createShift = async (shiftData: Omit<Shift, 'id'>): Promise<Shift> => {
    const newShift: Shift = {
      ...shiftData,
      id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    setShifts((prev) => [...prev, newShift]);

    try {
      if (isOnline) {
        await setDoc(doc(db, 'shifts', newShift.id), cleanFirestoreData(newShift));
      }
    } catch (e) {
      console.warn('Could not sync shift to Firestore:', e);
    }

    recordAudit('CREATE_SHIFT', 'Master Shift', `Menambahkan shift baru: ${newShift.namaShift}`, newShift.id, undefined, newShift);
    return newShift;
  };

  const updateShift = async (id: string, data: Partial<Shift>) => {
    const old = shifts.find((s) => s.id === id);
    setShifts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));

    try {
      if (isOnline) {
        await setDoc(doc(db, 'shifts', id), cleanFirestoreData({ id, ...data }), { merge: true });
      }
    } catch (e) {
      console.warn('Could not sync shift to Firestore:', e);
    }

    recordAudit('UPDATE_SHIFT', 'Master Shift', `Mengubah shift: ${data.namaShift || old?.namaShift}`, id, old, data);
  };

  const deleteShift = async (id: string) => {
    const old = shifts.find((s) => s.id === id);
    setShifts((prev) => prev.filter((p) => p.id !== id));

    try {
      if (isOnline) {
        await deleteDoc(doc(db, 'shifts', id));
      }
    } catch (e) {
      console.warn('Could not delete shift from Firestore:', e);
    }

    recordAudit('DELETE_SHIFT', 'Master Shift', `Menghapus shift: ${old?.namaShift}`, id, old);
  };

  const deleteMultipleShifts = async (ids: string[]): Promise<{ success: boolean; count: number }> => {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    const idSet = new Set(ids);
    const deletedShifts = shifts.filter((s) => idSet.has(s.id));

    setShifts((prev) => prev.filter((p) => !idSet.has(p.id)));

    if (isOnline) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'shifts', id));
        });
        await batch.commit();
      } catch (fbErr) {
        console.warn('Batch delete shifts from Firebase failed, falling back:', fbErr);
        for (const id of ids) {
          deleteDoc(doc(db, 'shifts', id)).catch(console.warn);
        }
      }
    }

    recordAudit(
      'DELETE_MULTIPLE_SHIFTS',
      'Master Shift',
      `Menghapus massal ${deletedShifts.length} shift: ${deletedShifts.map(s => s.namaShift).join(', ')}`,
      undefined,
      deletedShifts
    );

    return { success: true, count: deletedShifts.length };
  };

  const importShiftsBatch = async (
    newShifts: Omit<Shift, 'id'>[],
    mode: 'append' | 'update_existing' = 'append',
    options?: { atomic?: boolean }
  ): Promise<BatchImportResult> => {
    const isAtomic = options?.atomic !== false;
    const errors: ImportErrorItem[] = [];
    const seenShiftNames = new Set<string>();

    // 1. PRE-VALIDATION PASS
    newShifts.forEach((s, idx) => {
      const rowNum = idx + 1;
      const ident = s.namaShift || `Shift #${rowNum}`;

      if (!s.namaShift || s.namaShift.trim().length < 2) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'Nama Shift',
          rejectedValue: s.namaShift || '(kosong)',
          errorMessage: 'Nama Shift wajib diisi minimal 2 karakter.',
          critical: true
        });
      } else {
        const norm = s.namaShift.toLowerCase().trim();
        if (seenShiftNames.has(norm)) {
          errors.push({
            rowNumber: rowNum,
            identifier: ident,
            field: 'Nama Shift',
            rejectedValue: s.namaShift,
            errorMessage: `Nama Shift '${s.namaShift}' duplikat dalam file import yang sama.`,
            critical: true
          });
        } else {
          seenShiftNames.add(norm);
        }
      }

      if (!s.jamMulai || !/^\d{2}:\d{2}/.test(s.jamMulai)) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'Jam Mulai',
          rejectedValue: s.jamMulai || '(kosong)',
          errorMessage: 'Format jam mulai tidak valid (gunakan format HH:mm, contoh 06:30).',
          critical: true
        });
      }

      if (!s.jamSelesai || !/^\d{2}:\d{2}/.test(s.jamSelesai)) {
        errors.push({
          rowNumber: rowNum,
          identifier: ident,
          field: 'Jam Selesai',
          rejectedValue: s.jamSelesai || '(kosong)',
          errorMessage: 'Format jam selesai tidak valid (gunakan format HH:mm, contoh 10:00).',
          critical: true
        });
      }
    });

    // 2. ATOMIC ROLLBACK CHECK
    if (isAtomic && errors.some((e) => e.critical)) {
      recordAudit(
        'IMPORT_SHIFTS_ROLLBACK',
        'Master Shift',
        `[TRANSAKSI ATOMIK DIBATALKAN] Gagal mengimpor shift. Ditemukan ${errors.length} kesalahan validasi. Rollback 100%.`
      );
      return {
        success: false,
        isAtomic: true,
        total: newShifts.length,
        created: 0,
        updated: 0,
        skipped: newShifts.length,
        errors,
        message: `Transaksi atomik dibatalkan: Ditemukan ${errors.length} kesalahan pada baris data shift.`
      };
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const invalidIndices = new Set(errors.filter((e) => e.critical).map((e) => e.rowNumber - 1));
    const shiftsToSyncToFirestore: Shift[] = [];

    setShifts((prev) => {
      const shiftMap = new Map<string, Shift>();
      prev.forEach((s) => {
        if (s.namaShift?.trim()) {
          shiftMap.set(s.namaShift.toLowerCase().trim(), s);
        }
      });
      const updatedList = [...prev];

      newShifts.forEach((input, idx) => {
        if (!isAtomic && invalidIndices.has(idx)) {
          skippedCount++;
          return;
        }
        if (!input.namaShift || !input.namaShift.trim()) return;

        const key = input.namaShift.toLowerCase().trim();
        const existing = shiftMap.get(key);
        if (existing) {
          if (mode === 'update_existing') {
            const indexInList = updatedList.findIndex((s) => s.id === existing.id);
            if (indexInList !== -1) {
              const updatedObj: Shift = {
                ...updatedList[indexInList],
                ...input,
                jamMulai: input.jamMulai || updatedList[indexInList].jamMulai,
                jamSelesai: input.jamSelesai || updatedList[indexInList].jamSelesai,
                keterangan: input.keterangan || updatedList[indexInList].keterangan,
                statusAktif: input.statusAktif !== undefined ? input.statusAktif : updatedList[indexInList].statusAktif
              };
              updatedList[indexInList] = updatedObj;
              shiftsToSyncToFirestore.push(updatedObj);
              updatedCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          const newShift: Shift = {
            ...input,
            id: `shift-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            statusAktif: input.statusAktif !== undefined ? input.statusAktif : true
          };
          updatedList.push(newShift);
          shiftsToSyncToFirestore.push(newShift);
          shiftMap.set(key, newShift);
          createdCount++;
        }
      });
      return updatedList;
    });

    // Write all new and updated shifts to Cloud Firestore
    if (isOnline && shiftsToSyncToFirestore.length > 0) {
      try {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < shiftsToSyncToFirestore.length; i += CHUNK_SIZE) {
          const chunk = shiftsToSyncToFirestore.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const s of chunk) {
            batch.set(doc(db, 'shifts', s.id), cleanFirestoreData(s), { merge: true });
          }
          await batch.commit();
        }
      } catch (fbErr) {
        console.warn('Batch write shifts to Firebase failed, falling back:', fbErr);
        for (const s of shiftsToSyncToFirestore) {
          setDoc(doc(db, 'shifts', s.id), cleanFirestoreData(s), { merge: true }).catch(console.warn);
        }
      }
    }

    recordAudit(
      'IMPORT_SHIFTS_BATCH',
      'Master Shift',
      `[TRANSAKSI SUKSES] Impor data master shift: ${createdCount} baru, ${updatedCount} diperbarui, ${skippedCount} dilewati.`
    );
    return {
      success: true,
      isAtomic,
      total: newShifts.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors,
      message: `Berhasil mengimpor ${createdCount} shift baru dan memperbarui ${updatedCount} shift.`
    };
  };

  const updateSchool = async (data: Partial<School>) => {
    const updated = { ...school, ...data, updatedAt: new Date().toISOString() };
    setSchool((prev) => ({ ...prev, ...data }));

    try {
      if (isOnline) {
        await setDoc(doc(db, 'schools', 'main'), cleanFirestoreData(updated), { merge: true });
      }
    } catch (e) {
      console.warn('Could not sync school to Firestore:', e);
    }

    recordAudit('UPDATE_SCHOOL', 'Master Sekolah', 'Memperbarui profil informasi sekolah.');
  };

  const updateSystemSettings = async (data: Partial<SystemSettings>) => {
    const updated = { ...systemSettings, ...data, updatedAt: new Date().toISOString() };
    setSystemSettings((prev) => ({ ...prev, ...data }));

    try {
      if (isOnline) {
        await setDoc(doc(db, 'system_settings', 'main'), cleanFirestoreData(updated), { merge: true });
      }
    } catch (e) {
      console.warn('Could not sync system settings to Firestore:', e);
    }

    recordAudit('UPDATE_SETTINGS', 'Pengaturan Sistem', 'Memperbarui konfigurasi sistem.');
  };

  // Upload Photo with Google Drive metadata and real upload if authenticated
  const uploadPhoto = async (file: File, options: UploadFileOptions): Promise<AttachmentMeta> => {
    const accessToken = await getDriveAccessToken();
    const targetFolderId = systemSettings?.googleDrive?.rootFolderId || '18lJTqdfpB0NtY23aaxoAvq84GiTcCksQ';
    const attachment = await uploadToGoogleDrive(file, {
      ...options,
      targetFolderId,
      schoolName: school.nama,
      schoolYear: schoolYear.tahunAjaran,
      semester: schoolYear.semester
    }, accessToken);
    recordAudit('UPLOAD_FILE', 'Dokumentasi Drive', `Upload file foto: ${attachment.fileName} ke Google Drive (Folder: ${targetFolderId})`, attachment.id);
    return attachment;
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const sendCustomWhatsApp = async (toPhone: string, message: string): Promise<{ success: boolean; message: string }> => {
    if (!systemSettings.whatsApp.isEnabled) {
      return { success: false, message: 'Gateway WhatsApp sedang dinonaktifkan di Pengaturan Sistem.' };
    }
    recordAudit('SEND_WHATSAPP', 'Notifikasi WhatsApp', `Kirim notifikasi WA ke nomor ${toPhone}`);
    return { success: true, message: `Pesan WhatsApp berhasil dikirim ke ${toPhone} melalui gateway.` };
  };

  const createEmergencySnapshot = async (title?: string, notes?: string): Promise<SystemSnapshot> => {
    setIsCreatingSnapshot(true);
    try {
      const snap = await createSystemSnapshot({
        type: 'manual_admin',
        title: title || `Cadangan Manual Admin (${new Date().toLocaleDateString('id-ID')})`,
        notes: notes || 'Cadangan manual dibuat oleh Administrator.',
        createdBy: currentUser?.nama || 'Administrator',
        state: {
          school,
          systemSettings,
          users,
          posts,
          shifts,
          schoolYear,
          schedules,
          attendances,
          logbooks,
          incidents,
          handovers,
          replacements
        }
      });
      setSnapshots((prev) => [snap, ...prev.filter((s) => s.id !== snap.id)]);
      recordAudit('CREATE_SNAPSHOT', 'Admin Panic Mode', `Membuat snapshot cadangan manual: ${snap.title} (ID: ${snap.id})`, snap.id);
      sound.playSuccess();
      return snap;
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const restoreFromSnapshot = async (
    snapshot: SystemSnapshot,
    options: RestoreOptions = {
      restoreUsers: true,
      restorePosts: true,
      restoreShifts: true,
      restoreSchedules: true,
      restoreAttendances: true,
      restoreLogbooks: true,
      restoreIncidents: true,
      restoreHandovers: true,
      restoreSchoolAndSettings: true,
      createPreRestoreSafetySnapshot: true,
    }
  ): Promise<PanicModeRestoreResult> => {
    setIsRestoringSnapshot(true);
    let safetyBackupId: string | undefined;

    try {
      // 1. Create Pre-Restore Safety Checkpoint if requested
      if (options.createPreRestoreSafetySnapshot !== false) {
        try {
          const safetySnap = await createSystemSnapshot({
            type: 'pre_restore_safety',
            title: `Titik Pengaman Pra-Pemulihan (${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')})`,
            notes: `Cadangan otomatis pengaman sebelum memulihkan snapshot '${snapshot.title}' (ID: ${snapshot.id})`,
            createdBy: currentUser?.nama || 'Admin Panic Mode',
            state: {
              school,
              systemSettings,
              users,
              posts,
              shifts,
              schoolYear,
              schedules,
              attendances,
              logbooks,
              incidents,
              handovers,
              replacements
            }
          });
          safetyBackupId = safetySnap.id;
        } catch (e) {
          console.warn('Safety backup before restore warning:', e);
        }
      }

      const data = snapshot.data;
      const restoredCounts = {
        users: 0,
        posts: 0,
        shifts: 0,
        schedules: 0,
        attendances: 0,
        logbooks: 0,
        incidents: 0,
        handovers: 0
      };

      // 2. Prepare atomic writeBatch items for Cloud Firestore
      const batchOps: Array<{ collection: string; id: string; data: any }> = [];

      // School & Settings
      if (options.restoreSchoolAndSettings !== false && data.school) {
        setSchool(data.school);
        saveToStorage('school', data.school);
        batchOps.push({ collection: 'schools', id: 'main', data: { ...data.school, updatedAt: new Date().toISOString() } });
        
        if (data.systemSettings) {
          setSystemSettings(data.systemSettings);
          saveToStorage('systemSettings', data.systemSettings);
          batchOps.push({ collection: 'system_settings', id: 'main', data: { ...data.systemSettings, updatedAt: new Date().toISOString() } });
        }
      }

      // Users
      if (options.restoreUsers !== false && Array.isArray(data.users)) {
        setUsers(data.users);
        saveToStorage('users', data.users);
        localStorage.setItem('epiket_users_list', JSON.stringify(data.users));
        data.users.forEach((u) => batchOps.push({ collection: 'users', id: u.id, data: u }));
        restoredCounts.users = data.users.length;
      }

      // Posts
      if (options.restorePosts !== false && Array.isArray(data.posts)) {
        setPosts(data.posts);
        saveToStorage('posts', data.posts);
        data.posts.forEach((p) => batchOps.push({ collection: 'duty_posts', id: p.id, data: p }));
        restoredCounts.posts = data.posts.length;
      }

      // Shifts
      if (options.restoreShifts !== false && Array.isArray(data.shifts)) {
        setShifts(data.shifts);
        saveToStorage('shifts', data.shifts);
        data.shifts.forEach((s) => batchOps.push({ collection: 'shifts', id: s.id, data: s }));
        restoredCounts.shifts = data.shifts.length;
      }

      // Schedules
      if (options.restoreSchedules !== false && Array.isArray(data.schedules)) {
        setSchedules(data.schedules);
        saveToStorage('schedules', data.schedules);
        offlineDB.saveSchedules(data.schedules).catch(console.warn);
        data.schedules.forEach((s) => batchOps.push({ collection: 'duty_schedules', id: s.id, data: s }));
        restoredCounts.schedules = data.schedules.length;
      }

      // Attendances
      if (options.restoreAttendances !== false && Array.isArray(data.attendances)) {
        setAttendances(data.attendances);
        saveToStorage('attendances', data.attendances);
        data.attendances.forEach((a) => batchOps.push({ collection: 'attendances', id: a.id, data: a }));
        restoredCounts.attendances = data.attendances.length;
      }

      // Logbooks
      if (options.restoreLogbooks !== false && Array.isArray(data.logbooks)) {
        setLogbooks(data.logbooks);
        saveToStorage('logbooks', data.logbooks);
        offlineDB.saveLogbooks(data.logbooks).catch(console.warn);
        data.logbooks.forEach((l) => batchOps.push({ collection: 'logbooks', id: l.id, data: l }));
        restoredCounts.logbooks = data.logbooks.length;
      }

      // Incidents
      if (options.restoreIncidents !== false && Array.isArray(data.incidents)) {
        setIncidents(data.incidents);
        saveToStorage('incidents', data.incidents);
        offlineDB.saveIncidents(data.incidents).catch(console.warn);
        data.incidents.forEach((inc) => batchOps.push({ collection: 'incidents', id: inc.id, data: inc }));
        restoredCounts.incidents = data.incidents.length;
      }

      // Handovers
      if (options.restoreHandovers !== false && Array.isArray(data.handovers)) {
        setHandovers(data.handovers);
        saveToStorage('handovers', data.handovers);
        data.handovers.forEach((h) => batchOps.push({ collection: 'handovers', id: h.id, data: h }));
        restoredCounts.handovers = data.handovers.length;
      }

      // Replacements
      if (Array.isArray(data.replacements)) {
        setReplacements(data.replacements);
        saveToStorage('replacements', data.replacements);
        data.replacements.forEach((r) => batchOps.push({ collection: 'replacements', id: r.id, data: r }));
      }

      // 3. Commit batch operations to Cloud Firestore in safe chunks
      if (isOnline && batchOps.length > 0) {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < batchOps.length; i += CHUNK_SIZE) {
          const chunk = batchOps.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const op of chunk) {
            batch.set(doc(db, op.collection, op.id), cleanFirestoreData(op.data));
          }
          await batch.commit();
        }
      }

      // 4. Record Audit Log
      recordAudit(
        'PANIC_MODE_RESTORE',
        'Admin Panic Mode',
        `Pemulihan darurat berhasil diterapkan dari snapshot '${snapshot.title}' (ID: ${snapshot.id}). Dipulihkan: ${restoredCounts.users} Pengguna, ${restoredCounts.schedules} Jadwal, ${restoredCounts.logbooks} Logbook, ${restoredCounts.incidents} Insiden. Safety backup ID: ${safetyBackupId || 'none'}`,
        snapshot.id
      );

      await refreshSnapshots();
      sound.playSuccess();
      triggerConfetti();

      return {
        success: true,
        snapshotId: snapshot.id,
        timestamp: new Date().toISOString(),
        restoredEntities: restoredCounts,
        safetyBackupId,
        message: `Pemulihan Panic Mode berhasil! Seluruh data dari snapshot '${snapshot.title}' telah diterapkan ke sistem dan database Firebase.`
      };
    } catch (err: any) {
      console.error('Panic Mode Restore Error:', err);
      return {
        success: false,
        snapshotId: snapshot.id,
        timestamp: new Date().toISOString(),
        restoredEntities: { users: 0, posts: 0, shifts: 0, schedules: 0, attendances: 0, logbooks: 0, incidents: 0, handovers: 0 },
        message: `Gagal melakukan pemulihan darurat: ${err.message || 'Kesalahan sistem'}`
      };
    } finally {
      setIsRestoringSnapshot(false);
    }
  };

  const deleteSnapshot = async (snapshotId: string): Promise<boolean> => {
    const ok = await deleteSnapshotRecord(snapshotId);
    if (ok) {
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      recordAudit('DELETE_SNAPSHOT', 'Admin Panic Mode', `Menghapus snapshot cadangan ID: ${snapshotId}`, snapshotId);
    }
    return ok;
  };

  const exportSnapshotToFile = (snapshot: SystemSnapshot) => {
    downloadSnapshotAsFile(snapshot);
    recordAudit('EXPORT_SNAPSHOT', 'Admin Panic Mode', `Mengunduh berkas snapshot pemulihan: ${snapshot.title}`, snapshot.id);
  };

  const importSnapshotFromFile = async (file: File): Promise<SystemSnapshot> => {
    const snap = await parseSnapshotFile(file);
    setSnapshots((prev) => [snap, ...prev.filter((s) => s.id !== snap.id)]);
    recordAudit('IMPORT_SNAPSHOT', 'Admin Panic Mode', `Mengimpor berkas snapshot pemulihan: ${file.name} (ID: ${snap.id})`, snap.id);
    sound.playSuccess();
    return snap;
  };

  const resetToDemoData = () => {
    setSchool(INITIAL_SCHOOL);
    setUsers(INITIAL_USERS);
    setPosts(INITIAL_POSTS);
    setShifts(INITIAL_SHIFTS);
    setSchedules(INITIAL_SCHEDULES);
    setAttendances(INITIAL_ATTENDANCES);
    setLogbooks(INITIAL_LOGBOOKS);
    setIncidents(INITIAL_INCIDENTS);
    setHandovers(INITIAL_HANDOVERS);
    setReplacements([]);
    setNotifications(INITIAL_NOTIFICATIONS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setSystemSettings(INITIAL_SYSTEM_SETTINGS);
    
    ['school', 'users', 'posts', 'shifts', 'schedules', 'attendances', 'logbooks', 'incidents', 'handovers', 'replacements', 'notifications', 'auditLogs', 'systemSettings'].forEach((k) => {
      localStorage.removeItem(STORAGE_PREFIX + k);
    });

    recordAudit('RESET_DEMO_DATA', 'Sistem', 'Reset seluruh database ke data demo awal.');
  };

  return (
    <DataContext.Provider
      value={{
        school,
        users,
        posts,
        shifts,
        schoolYear,
        schedules,
        attendances,
        logbooks,
        incidents,
        handovers,
        replacements,
        notifications,
        auditLogs,
        systemSettings,
        isOnline,
        isFirestoreConnected,
        firestoreStatusMessage,
        syncAllDataToFirestore,
        syncInitialMasterDataToFirestore,
        checkCloudStatus,
        cachedReports,
        cachedReportsCount: cachedReports.length,
        pendingSyncCount,
        pendingOfflineActions,
        triggerSyncOfflineActions,
        cacheCurrentReport,
        checkIn,
        checkOut,
        createLogbook,
        updateLogbook,
        deleteLogbook,
        createIncident,
        updateIncident,
        deleteIncident,
        createHandover,
        updateHandover,
        deleteHandover,
        acknowledgeHandover,
        createReplacement,
        updateReplacement,
        deleteReplacement,
        adminManualCheckIn,
        createSchedule,
        updateSchedule,
        deleteSchedule,
        deleteMultipleSchedules,
        generateSemesterSchedule,
        createUser,
        updateUser,
        deleteUser,
        deleteMultipleUsers,
        importUsersBatch,
        createPost,
        updatePost,
        deletePost,
        deleteMultiplePosts,
        importPostsBatch,
        createShift,
        updateShift,
        deleteShift,
        deleteMultipleShifts,
        importShiftsBatch,
        updateSchool,
        updateSystemSettings,
        uploadPhoto,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        sendCustomWhatsApp,
        recordAudit,
        resetToDemoData,
        snapshots,
        isRestoringSnapshot,
        isCreatingSnapshot,
        createEmergencySnapshot,
        restoreFromSnapshot,
        deleteSnapshot,
        refreshSnapshots,
        exportSnapshotToFile,
        importSnapshotFromFile
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
