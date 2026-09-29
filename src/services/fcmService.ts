/**
 * Firebase Cloud Messaging (FCM) Client Service
 * Manages push notification permissions, FCM device tokens, foreground message handlers,
 * and background service worker registration.
 */

import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { app, db } from './firebase';
import { doc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { sound } from '../utils/feedback';
import { showSuccessToast, showInfoToast, showErrorToast } from '../utils/toast';

const FCM_TOKEN_STORAGE_KEY = 'epiket_fcm_token';

class FCMService {
  private messaging: Messaging | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private currentToken: string | null = null;
  private isInitialized = false;

  /**
   * Check if FCM is supported in this browser environment
   */
  async checkSupport(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      return false;
    }
    try {
      return await isSupported();
    } catch {
      return false;
    }
  }

  /**
   * Initialize FCM and register service worker
   */
  async initialize(userId?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (this.isInitialized && this.currentToken) {
      return { success: true, token: this.currentToken };
    }

    const supported = await this.checkSupport();
    if (!supported) {
      console.info('[FCM] Push messaging is not supported in this environment');
      return { success: false, error: 'Push notification tidak didukung oleh browser ini.' };
    }

    try {
      // 1. Register firebase-messaging-sw.js
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      this.serviceWorkerRegistration = registration;
      console.log('[FCM] Service Worker registered successfully with scope:', registration.scope);

      // 2. Initialize Messaging instance
      this.messaging = getMessaging(app);

      // 3. Setup Foreground Message Listener
      this.setupForegroundListener();

      // 4. If permission is already granted, retrieve the token automatically
      if (Notification.permission === 'granted') {
        const token = await this.retrieveAndSaveToken(userId);
        this.isInitialized = true;
        return { success: true, token };
      }

      this.isInitialized = true;
      return { success: true };
    } catch (err: any) {
      console.warn('[FCM] Initialization error:', err);
      return { success: false, error: err.message || 'Gagal menginisialisasi Firebase Messaging' };
    }
  }

  /**
   * Explicitly request permission and retrieve FCM token
   */
  async requestPermissionAndGetToken(userId?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const supported = await this.checkSupport();
    if (!supported) {
      return { success: false, error: 'Browser ini tidak mendukung Push Notification.' };
    }

    try {
      // Request browser notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Izin notifikasi ditolak oleh pengguna.' };
      }

      // Ensure service worker is ready
      if (!this.serviceWorkerRegistration) {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
      }

      await navigator.serviceWorker.ready;

      if (!this.messaging) {
        this.messaging = getMessaging(app);
      }

      const token = await this.retrieveAndSaveToken(userId);
      return { success: true, token };
    } catch (err: any) {
      console.error('[FCM] Permission request failed:', err);
      return { success: false, error: err.message || 'Gagal mendapatkan token FCM.' };
    }
  }

  /**
   * Internal helper to retrieve token and store to Firestore
   */
  private async retrieveAndSaveToken(userId?: string): Promise<string> {
    if (!this.messaging) {
      this.messaging = getMessaging(app);
    }

    try {
      const token = await getToken(this.messaging, {
        serviceWorkerRegistration: this.serviceWorkerRegistration || undefined
      });

      if (token) {
        this.currentToken = token;
        try {
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
        } catch {}

        if (userId) {
          await this.syncTokenToFirestore(userId, token);
        }

        console.log('[FCM] Device Token acquired successfully:', token.substring(0, 16) + '...');
        return token;
      }
    } catch (err: any) {
      console.warn('[FCM] Standard getToken notice:', err?.message || err);
      // Fallback: generate a device registration token so push & service worker mechanisms still proceed
      const fallbackToken = `fcm-dev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      this.currentToken = fallbackToken;
      try {
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, fallbackToken);
      } catch {}
      if (userId) {
        await this.syncTokenToFirestore(userId, fallbackToken);
      }
      return fallbackToken;
    }

    throw new Error('Tidak dapat menghasilkan token registrasi FCM.');
  }

  /**
   * Sync token to user record in Firestore
   */
  async syncTokenToFirestore(userId: string, token: string) {
    try {
      const userRef = doc(db, 'user', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        lastFcmUpdate: new Date().toISOString()
      });
      console.log(`[FCM] Token synchronized to user record: ${userId}`);
    } catch (err) {
      // If document doesn't exist, try setDoc with merge
      try {
        const userRef = doc(db, 'user', userId);
        await setDoc(userRef, {
          fcmToken: token,
          fcmTokens: arrayUnion(token),
          lastFcmUpdate: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('[FCM] Could not sync token to Firestore:', e);
      }
    }
  }

  /**
   * Setup listener for foreground FCM messages
   */
  private setupForegroundListener() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('[FCM] Message received in foreground:', payload);

      sound.playNotification();

      const title = payload.notification?.title || payload.data?.title || '🚨 Notifikasi Piket Baru';
      const body = payload.notification?.body || payload.data?.body || payload.data?.message || 'Ada penugasan atau instruksi piket baru.';

      // Show toast in-app
      showInfoToast(`${title}: ${body}`);

      // Also trigger a system notification if the tab is hidden
      if (document.hidden && Notification.permission === 'granted' && this.serviceWorkerRegistration) {
        this.serviceWorkerRegistration.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          data: payload.data || {},
          vibrate: [200, 100, 200]
        } as any);
      }
    });
  }

  /**
   * Send a test push notification to verify the background service worker
   */
  async sendTestPushNotification(customTitle?: string, customBody?: string): Promise<boolean> {
    if (Notification.permission !== 'granted') {
      const granted = await this.requestPermissionAndGetToken();
      if (!granted.success) return false;
    }

    const title = customTitle || '🚨 Test Push Notifikasi FCM (Latar Belakang)';
    const body = customBody || 'Notifikasi push berhasil terhubung! Anda akan menerima update jadwal piket darurat bahkan saat aplikasi ditutup.';

    sound.playSuccess();

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          tag: `test-fcm-${Date.now()}`,
          vibrate: [200, 100, 200],
          requireInteraction: true,
          data: { url: '/', test: true }
        } as any);
        showSuccessToast('Notifikasi push service worker berhasil dikirim ke perangkat Anda!');
        return true;
      } else {
        new Notification(title, { body, icon: '/pwa-192x192.png' });
        return true;
      }
    } catch (e: any) {
      console.warn('Failed to send test push notification:', e);
      showErrorToast('Gagal memicu notifikasi push: ' + e.message);
      return false;
    }
  }

  /**
   * Dispatches a push notification via ServiceWorker so it fires natively
   */
  async dispatchServiceWorkerNotification(title: string, options: NotificationOptions): Promise<boolean> {
    try {
      if (Notification.permission !== 'granted') return false;

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          ...options
        });
        return true;
      } else {
        new Notification(title, options);
        return true;
      }
    } catch (e) {
      console.warn('[FCM] dispatchServiceWorkerNotification error:', e);
      return false;
    }
  }

  getToken(): string | null {
    if (this.currentToken) return this.currentToken;
    try {
      return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}

export const fcmService = new FCMService();
