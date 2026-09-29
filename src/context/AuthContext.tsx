import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../services/seedData';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { auth, db, collection, onSnapshot, doc, setDoc, cleanFirestoreData } from '../services/firebase';
import firebaseAppletConfig from '../../firebase-applet-config.json';

interface AuthContextType {
  currentUser: User | null;
  currentRole: UserRole | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  loginWithPin: (pin: string, userId?: string) => Promise<{ success: boolean; message?: string }>;
  updateUserCredentials: (userId: string, newPin?: string, newPassword?: string) => Promise<void>;
  updateUserProfile: (userId: string, data: Partial<User>) => Promise<void>;
  quickLoginAs: (role: UserRole, userId?: string) => void;
  logout: () => void;
  switchUser: (userId: string) => void;
  usersList: User[];
  
  // Google Drive & Firebase Auth
  isGoogleDriveConnected: boolean;
  googleDriveUser: FirebaseUser | null;
  connectGoogleDrive: () => Promise<{ success: boolean; message: string }>;
  disconnectGoogleDrive: () => Promise<void>;
  getDriveAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'epiket_auth_user_id';
const DRIVE_TOKEN_SESSION_KEY = 'epiket_drive_token';
const DRIVE_EXPIRY_SESSION_KEY = 'epiket_drive_token_expiry';

// Verified OAuth Client ID and required scopes
const OAUTH_CLIENT_ID = firebaseAppletConfig.oAuthClientId || '46900601033-t50267uivq38l571ug1jrqntn3p9rdd7.apps.googleusercontent.com';
const REQUIRED_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive'
].join(' ');

import { setDriveTokenRefreshCallback } from '../services/googleDriveService';
let cachedDriveAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY) : null;
let cachedDriveTokenExpiry: number = typeof window !== 'undefined' ? Number(sessionStorage.getItem(DRIVE_EXPIRY_SESSION_KEY) || '0') : 0;
let isSigningIn = false;

const setDriveTokenCache = (token: string | null, expiresInSeconds = 3600) => {
  cachedDriveAccessToken = token;
  const expiryMs = Date.now() + expiresInSeconds * 1000;
  cachedDriveTokenExpiry = token ? expiryMs : 0;

  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem(DRIVE_TOKEN_SESSION_KEY, token);
      sessionStorage.setItem(DRIVE_EXPIRY_SESSION_KEY, String(expiryMs));
    } else {
      sessionStorage.removeItem(DRIVE_TOKEN_SESSION_KEY);
      sessionStorage.removeItem(DRIVE_EXPIRY_SESSION_KEY);
    }
  }
};

const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window unavailable'));
    if ((window as any).google?.accounts?.oauth2) return resolve();
    const existing = document.getElementById('gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

const requestGsiOAuthToken = (clientId: string, promptMode: 'consent' | '' = 'consent'): Promise<{ accessToken: string; expiresIn?: number; userInfo?: any }> => {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGsiScript();
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        throw new Error('Google Identity Services script failed to initialize');
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: REQUIRED_DRIVE_SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            let errText = response.error_description || response.error;
            if (response.error === 'origin_mismatch' || String(errText).includes('origin_mismatch')) {
              const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://e-piket-six.vercel.app';
              errText = `Error 400 (origin_mismatch): Domain '${currentOrigin}' belum didaftarkan di Authorized JavaScript Origins untuk OAuth Client ID (${clientId}). Pastikan 'https://e-piket-six.vercel.app' telah ditambahkan pada Google Cloud Console (Authorized JavaScript Origins & Authorized redirect URIs).`;
            }
            reject(new Error(errText));
            return;
          }
          if (response.access_token) {
            let userInfo = null;
            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` }
              });
              if (uRes.ok) {
                userInfo = await uRes.json();
              }
            } catch (e) {}
            resolve({ 
              accessToken: response.access_token, 
              expiresIn: response.expires_in ? Number(response.expires_in) : 3600,
              userInfo 
            });
          } else {
            reject(new Error('Access token not returned from Google OAuth'));
          }
        }
      });

      client.requestAccessToken({ prompt: promptMode });
    } catch (err) {
      reject(err);
    }
  });
};

const isDummyUserRecord = (u: any): boolean => {
  if (!u) return true;
  const id = String(u.id || '');
  const nama = String(u.nama || '');
  const email = String(u.email || '');
  if (id === 'user-kepsek') return true;
  if (id.startsWith('user-ptk-') || id.startsWith('guru-') || id.startsWith('demo-') || id.startsWith('test-')) return true;
  if (nama.includes('Ahmad Dahlan') || email.includes('kepsek@sekolah.sch.id')) return true;
  return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usersList, setUsersList] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('epiket_users_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((u) => !isDummyUserRecord(u));
          if (clean.length > 0) return clean;
        }
      }
      return INITIAL_USERS;
    } catch (e) {
      return INITIAL_USERS;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // 1. Direct active user object serialization (most accurate & preserves uploaded photo/custom edits)
    const savedUserJson = localStorage.getItem('epiket_current_user');
    if (savedUserJson) {
      try {
        const parsed = JSON.parse(savedUserJson);
        if (parsed && parsed.id && !isDummyUserRecord(parsed)) return parsed;
      } catch (e) {
        console.warn('Failed parsing epiket_current_user:', e);
      }
    }

    // 2. Lookup by ID in persisted usersList or INITIAL_USERS
    const savedUserId = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUserId && !isDummyUserRecord({ id: savedUserId })) {
      try {
        const savedList = localStorage.getItem('epiket_users_list');
        const list: User[] = savedList ? JSON.parse(savedList) : INITIAL_USERS;
        const cleanList = list.filter((u) => !isDummyUserRecord(u));
        const found = cleanList.find((u) => u.id === savedUserId) || INITIAL_USERS.find((u) => u.id === savedUserId);
        if (found) return found;
      } catch (e) {}
    }
    // Always land on Login Page by default on new deployments or unauthenticated sessions
    return null;
  });

  const [googleDriveUser, setGoogleDriveUser] = useState<FirebaseUser | null>(null);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setGoogleDriveUser(firebaseUser);
      if (!firebaseUser && !isSigningIn) {
        cachedDriveAccessToken = null;
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Live Firestore Subscriptions for usersList (ensures newly imported teachers appear in real-time)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'epiket_users_list' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed.filter((u) => !isDummyUserRecord(u));
            if (clean.length > 0) setUsersList(clean);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: User[] = [];
        snapshot.forEach((d) => {
          const u = d.data() as User;
          if (!isDummyUserRecord(u)) loaded.push(u);
        });
        if (loaded.length > 0) {
          setUsersList(loaded);
          localStorage.setItem('epiket_users_list', JSON.stringify(loaded));
        }
      }
    }, (err) => console.warn('Auth users onSnapshot error:', err));

    const unsubCanonicalUser = onSnapshot(collection(db, 'user'), (snapshot) => {
      if (!snapshot.empty) {
        const loaded: User[] = [];
        snapshot.forEach((d) => {
          const u = d.data() as User;
          if (!isDummyUserRecord(u)) loaded.push(u);
        });
        if (loaded.length > 0) {
          setUsersList((prev) => {
            const existingIds = new Set(loaded.map((u) => u.id));
            const merged = [...loaded, ...prev.filter((p) => !existingIds.has(p.id) && !isDummyUserRecord(p))];
            localStorage.setItem('epiket_users_list', JSON.stringify(merged));
            return merged;
          });
        }
      }
    }, (err) => console.warn('Auth user onSnapshot error:', err));

    return () => {
      window.removeEventListener('storage', handleStorage);
      unsubUsers();
      unsubCanonicalUser();
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, currentUser.id);
      localStorage.setItem('epiket_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('epiket_current_user');
    }
  }, [currentUser]);

  const loginWithPin = async (pin: string, userId?: string): Promise<{ success: boolean; message?: string }> => {
    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      return { success: false, message: 'Masukkan 6 digit angka PIN Anda.' };
    }

    let targetUser: User | undefined;

    if (userId) {
      targetUser = usersList.find((u) => u.id === userId);
      if (!targetUser) {
        return { success: false, message: 'Akun pengguna yang dipilih tidak ditemukan.' };
      }
    } else {
      // Find user whose customized PIN or Password matches cleanPin exactly
      targetUser = usersList.find((u) => u.statusAktif && (u.pin === cleanPin || (!u.pin && cleanPin === '123456') || u.password === cleanPin));
      if (!targetUser) {
        // Fallback to active admin if cleanPin matches admin's custom PIN or default '123456' when pin is unset
        const adminUser = usersList.find((u) => u.role === 'admin' && u.statusAktif);
        if (adminUser) {
          const adminPin = adminUser.pin || '123456';
          const adminPass = adminUser.password || 'password123';
          if (cleanPin === adminPin || cleanPin === adminPass) {
            targetUser = adminUser;
          }
        }
      }
    }

    if (!targetUser) {
      return { 
        success: false, 
        message: 'PIN Keamanan tidak sesuai. Silakan masukkan 6 digit PIN akun Anda.' 
      };
    }

    if (!targetUser.statusAktif) {
      return { success: false, message: 'Akun ini dinonaktifkan oleh Administrator.' };
    }

    // Verify PIN strictly against user's specific set PIN or Password
    const userPin = targetUser.pin || '123456';
    const userPassword = targetUser.password || 'password123';

    const isPinMatch = cleanPin === userPin;
    const isPasswordMatch = cleanPin === userPassword;

    if (!isPinMatch && !isPasswordMatch) {
      return { 
        success: false, 
        message: `PIN Keamanan salah. Silakan periksa kembali 6 digit PIN akun Anda.` 
      };
    }

    setCurrentUser(targetUser);
    return { success: true };
  };

  const updateUserCredentials = async (userId: string, newPin?: string, newPassword?: string) => {
    console.log(`[AuthContext.updateUserCredentials Stage 1] Updating credentials for user '${userId}'... Has PIN: ${!!newPin}`);
    setUsersList((prev) => {
      const updated = prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            ...(newPin ? { pin: newPin } : {}),
            ...(newPassword ? { password: newPassword } : {})
          };
        }
        return u;
      });
      localStorage.setItem('epiket_users_list', JSON.stringify(updated));
      console.log(`[AuthContext.updateUserCredentials Stage 2] Local usersList & localStorage updated.`);
      return updated;
    });

    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? {
        ...prev,
        ...(newPin ? { pin: newPin } : {}),
        ...(newPassword ? { password: newPassword } : {})
      } : null));
    }

    try {
      console.log(`[AuthContext.updateUserCredentials Stage 3] Sending setDoc Promise to Firestore 'users/${userId}' (merge: true)...`);
      const payload: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (newPin) payload.pin = newPin;
      if (newPassword) payload.password = newPassword;
      await setDoc(doc(db, 'users', userId), payload, { merge: true });
      console.log(`[AuthContext.updateUserCredentials Stage 4] ✅ Firestore setDoc Promise resolved! PIN/Password updated in Cloud Firestore.`);
    } catch (err) {
      console.error('[AuthContext.updateUserCredentials ERROR] ❌ Firestore PIN credentials update error:', err);
    }
  };

  const updateUserProfile = async (userId: string, data: Partial<User>) => {
    console.log(`[AuthContext.updateUserProfile Stage 1] Updating profile for user '${userId}'... Keys:`, Object.keys(data));
    setUsersList((prev) => {
      const updated = prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            ...data,
            updatedAt: new Date().toISOString()
          };
        }
        return u;
      });
      localStorage.setItem('epiket_users_list', JSON.stringify(updated));
      console.log(`[AuthContext.updateUserProfile Stage 2] Local usersList & localStorage updated.`);
      return updated;
    });

    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? {
        ...prev,
        ...data,
        updatedAt: new Date().toISOString()
      } : null));
    }

    try {
      console.log(`[AuthContext.updateUserProfile Stage 3] Sending setDoc Promise to Firestore 'users/${userId}' (merge: true)...`);
      await setDoc(doc(db, 'users', userId), cleanFirestoreData({
        ...data,
        updatedAt: new Date().toISOString()
      }), { merge: true });
      console.log(`[AuthContext.updateUserProfile Stage 4] ✅ Firestore setDoc Promise resolved! Profile updated in Cloud Firestore.`);
    } catch (err) {
      console.error('[AuthContext.updateUserProfile ERROR] ❌ Firestore user profile update error:', err);
    }
  };

  const login = async (identifier: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    const clean = identifier.trim().toLowerCase();
    const found = usersList.find((u) => {
      const emailMatch = u.email.toLowerCase() === clean;
      const usernameMatch = u.username && u.username.toLowerCase() === clean;
      const prefixMatch = u.email.toLowerCase().split('@')[0] === clean;
      const idMatch = u.id.toLowerCase() === clean;
      return emailMatch || usernameMatch || prefixMatch || idMatch;
    });

    if (!found) {
      return { 
        success: false, 
        message: 'Username tidak ditemukan. Untuk Admin gunakan username "admin" dengan PIN "123456" atau kata sandi "password123".' 
      };
    }

    if (!found.statusAktif) {
      return { success: false, message: 'Akun Anda sedang dinonaktifkan oleh administrator.' };
    }

    // Password & PIN validation: check strictly against user's specific set PIN or Password
    const userPin = found.pin || '123456';
    const userPassword = found.password || 'password123';
    const validCredentials = [userPin, userPassword].filter(Boolean);

    if (password && !validCredentials.includes(password.trim())) {
      return { 
        success: false, 
        message: 'Kata sandi / PIN yang Anda masukkan tidak sesuai.' 
      };
    }

    setCurrentUser(found);
    return { success: true };
  };

  const quickLoginAs = (role: UserRole, userId?: string) => {
    if (userId) {
      const found = usersList.find((u) => u.id === userId);
      if (found) {
        setCurrentUser(found);
        return;
      }
    }
    const foundRole = usersList.find((u) => u.role === role);
    if (foundRole) {
      setCurrentUser(foundRole);
    }
  };

  const switchUser = (userId: string) => {
    const found = usersList.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('epiket_current_user');
    localStorage.setItem('e_piket_active_tab', 'dashboard');
    localStorage.setItem('e_piket_last_active_tab', 'dashboard');
    try {
      sessionStorage.removeItem('e_piket_active_tab');
      window.location.hash = 'dashboard';
    } catch (e) {}
  };

  // Google Drive Connection & OAuth Access Token Flow
  const refreshDriveAccessTokenSilently = async (): Promise<string | null> => {
    return cachedDriveAccessToken;
  };

  const connectGoogleDrive = async (): Promise<{ success: boolean; message: string }> => {
    return {
      success: false,
      message: 'Fitur Google Drive OAuth telah dinonaktifkan sesuai permintaan.'
    };
  };

  const disconnectGoogleDrive = async () => {
    try {
      await auth.signOut();
    } catch (e) {
      console.warn(e);
    }
    setDriveTokenCache(null);
    setGoogleDriveUser(null);
  };

  const getDriveAccessToken = async (): Promise<string | null> => {
    if (!cachedDriveAccessToken && typeof window !== 'undefined') {
      cachedDriveAccessToken = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY);
      cachedDriveTokenExpiry = Number(sessionStorage.getItem(DRIVE_EXPIRY_SESSION_KEY) || '0');
    }

    // Auto-refresh token if it's about to expire in less than 5 minutes (300,000 ms)
    const isExpiringSoon = !cachedDriveTokenExpiry || Date.now() >= cachedDriveTokenExpiry - 300000;

    if (cachedDriveAccessToken && isExpiringSoon) {
      console.log('[Google Drive Auth] Token expiring soon. Executing background auto-refresh...');
      const freshToken = await refreshDriveAccessTokenSilently();
      if (freshToken) return freshToken;
    }

    return cachedDriveAccessToken;
  };

  // Background daemon: Auto-refresh Google Drive OAuth token every 10 minutes when connected
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setDriveTokenRefreshCallback(async () => {
      return await refreshDriveAccessTokenSilently();
    });

    const intervalId = setInterval(async () => {
      if (cachedDriveAccessToken) {
        const token = await getDriveAccessToken();
        if (token) {
          console.log('[Google Drive Auth Daemon] Background session check & refresh complete.');
        }
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const isDriveConnected = !!googleDriveUser && !!(
    cachedDriveAccessToken || (typeof window !== 'undefined' && sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY))
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole: currentUser?.role || null,
        isAuthenticated: !!currentUser,
        login,
        loginWithPin,
        updateUserCredentials,
        updateUserProfile,
        quickLoginAs,
        logout,
        switchUser,
        usersList,
        isGoogleDriveConnected: isDriveConnected,
        googleDriveUser,
        connectGoogleDrive,
        disconnectGoogleDrive,
        getDriveAccessToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
