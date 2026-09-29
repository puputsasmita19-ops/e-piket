/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker for Background Push Notifications
// Allows teachers and staff to receive real-time duty notifications even when the app is closed or in the background.

try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Could not load external Firebase compat scripts (offline mode):', err);
}

// Ensure service worker activates immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Initialize Firebase App in Service Worker with project credentials
const firebaseConfig = {
  apiKey: "AIzaSyB935FQACmtDngoMEw4qTsGCdlZ8QiVqO8",
  authDomain: "gen-lang-client-0402274970.firebaseapp.com",
  projectId: "gen-lang-client-0402274970",
  storageBucket: "gen-lang-client-0402274970.firebasestorage.app",
  messagingSenderId: "46900601033",
  appId: "1:46900601033:web:e80367df3c15d27856ad18"
};

let messaging = null;
try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    firebase.initializeApp(firebaseConfig);
    if (firebase.messaging && firebase.messaging.isSupported()) {
      messaging = firebase.messaging();
    }
  }
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Firebase init error:', e);
}

// Handle Background Messages via FCM SDK
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background FCM message:', payload);

    const title = payload.notification?.title || payload.data?.title || '🚨 Notifikasi Piket Sekolah';
    const body = payload.notification?.body || payload.data?.body || payload.data?.message || 'Tugas piket baru telah ditugaskan untuk Anda.';
    
    const notificationOptions = {
      body: body,
      icon: payload.notification?.icon || '/pwa-192x192.png',
      badge: '/icon.svg',
      tag: payload.data?.tag || `epiket-fcm-${Date.now()}`,
      data: payload.data || { url: '/' },
      vibrate: [200, 100, 200, 100, 250],
      requireInteraction: true,
      actions: [
        { action: 'open_app', title: 'Buka Jadwal' },
        { action: 'dismiss', title: 'Tutup' }
      ]
    };

    return self.registration.showNotification(title, notificationOptions);
  });
}

// Fallback & Direct Web Push Event Listener
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);

  let title = '🚨 Instruksi Piket Real-Time';
  let body = 'Anda menerima instruksi jadwal piket sekolah terbaru.';
  let data = { url: '/' };
  let tag = `push-${Date.now()}`;

  if (event.data) {
    try {
      const json = event.data.json();
      if (json.notification) {
        title = json.notification.title || title;
        body = json.notification.body || body;
      } else if (json.title) {
        title = json.title;
        body = json.body || json.message || body;
      }
      data = json.data || json;
      if (json.tag) tag = json.tag;
    } catch {
      const text = event.data.text();
      if (text) body = text;
    }
  }

  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/icon.svg',
    tag,
    data,
    vibrate: [200, 100, 200, 100, 250],
    requireInteraction: true,
    actions: [
      { action: 'open_app', title: 'Buka Aplikasi' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler: Opens or Focuses the App Window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: event.notification.data
          });
          return client.focus();
        }
      }
      // If no tab is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
