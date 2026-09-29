import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  writeBatch,
  getDocFromServer,
  enableMultiTabIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Initialize Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// The canonical database ID for this AI Studio project
export const FIRESTORE_DATABASE_ID: string | undefined = (firebaseConfigData as any).firestoreDatabaseId || undefined;

// Initialize Firestore with specific databaseId (if specified) and safe ignoreUndefinedProperties setting
let firestoreInstance: Firestore;
try {
  firestoreInstance = FIRESTORE_DATABASE_ID
    ? initializeFirestore(app, { ignoreUndefinedProperties: true }, FIRESTORE_DATABASE_ID)
    : initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  firestoreInstance = FIRESTORE_DATABASE_ID
    ? getFirestore(app, FIRESTORE_DATABASE_ID)
    : getFirestore(app);
}

export const db: Firestore = firestoreInstance;

// Enable multi-tab IndexedDB offline persistence safely
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    console.warn('Firestore multi-tab persistence could not be enabled:', err.message);
  });
}

/**
 * Standard collection names based on the Firestore schema requirement:
 * 'user', 'jadwal', 'bukuPiket', and 'kejadian'
 */
export const COLLECTIONS = {
  USER: 'user',
  USERS_LEGACY: 'users',
  JADWAL: 'jadwal',
  JADWAL_LEGACY: 'duty_schedules',
  BUKU_PIKET: 'bukuPiket',
  BUKU_PIKET_LEGACY: 'logbooks',
  KEJADIAN: 'kejadian',
  KEJADIAN_LEGACY: 'incidents',
  DUTY_POSTS: 'duty_posts',
  SHIFTS: 'shifts',
  SCHOOLS: 'schools',
  ATTENDANCES: 'attendances',
  HANDOVERS: 'handovers',
  REPLACEMENTS: 'replacements',
  NOTIFICATIONS: 'notifications',
  SYSTEM_SETTINGS: 'system_settings',
  TEST: 'test'
} as const;

// Clean undefined properties recursively before saving to Firestore
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) return obj.map(cleanFirestoreData) as any;
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        res[key] = cleanFirestoreData(val);
      }
    }
    return res;
  }
  return obj;
}

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Error Handling according to Firebase Skill standard
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test according to Firebase Skill standard
export async function testFirestoreConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, message: 'Terhubung ke Cloud Firestore' };
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as any)?.code;

    if (
      errCode === 'unavailable' ||
      errMsg.includes('the client is offline') ||
      errMsg.includes('Could not reach Cloud Firestore') ||
      errMsg.includes('Connection failed') ||
      errMsg.includes('Failed to get document')
    ) {
      console.warn("Client is offline or Cloud Firestore is unreachable. Using IndexedDB/Local storage fallback.");
      return { connected: false, message: 'Offline Mode (Menggunakan penyimpanan lokal/IndexedDB)' };
    }

    // If permission or document does not exist, Firestore endpoint itself responded (meaning we are connected)
    if (errCode === 'permission-denied' || errMsg.includes('Missing or insufficient permissions')) {
      return { connected: true, message: 'Firestore terhubung (Aturan keamanan aktif)' };
    }

    return { connected: false, message: 'Cloud Firestore tidak terjangkau (Offline Mode)' };
  }
}

export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
};
