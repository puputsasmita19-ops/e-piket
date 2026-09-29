/**
 * Anti-Fraud & Security Service for e-Piket Presensi & Proteksi Data Sekolah
 * Includes:
 * 1. High-accuracy GPS Lock & Geofencing Calculation (Haversine formula)
 * 2. Fake GPS & Mock Location Spoofing Detection
 * 3. Anti-Copy Paste & Anti-Data Extraction Guard (All Browsers & Incognito Mode)
 * 4. Anti-DevTools / Developer Mode Blocker & Realtime Detection
 * 5. Incognito / Private Browsing Mode Detection & Enforcement
 */

export interface GeofenceResult {
  distanceMeters: number;
  isWithinRadius: boolean;
  accuracyMeters: number;
  isAccuracyAcceptable: boolean;
  latitude: number;
  longitude: number;
  mockSuspected: boolean;
  mockReasons: string[];
}

export interface SecurityAuditCheck {
  isDevToolsOpen: boolean;
  isIncognito: boolean;
  isAutomated: boolean;
  isSecure: boolean;
  isCopyPasteBlocked: boolean;
  warnings: string[];
}

export type SecurityAlertCallback = (info: {
  action: 'copy' | 'paste' | 'cut' | 'contextmenu' | 'shortcut' | 'devtools';
  message: string;
}) => void;

class AntiFraudService {
  private lastKnownPosition: { lat: number; lng: number; time: number } | null = null;
  private devToolsOpen: boolean = false;
  private listenersAttached: boolean = false;
  private alertListeners: Set<SecurityAlertCallback> = new Set();
  private antiCopyEnabled: boolean = true;

  /**
   * Calculate exact distance between two coordinates using Haversine formula
   */
  calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  /**
   * Acquire accurate GPS position with highAccuracy & check for Mock / Fake GPS
   */
  async getAccuratePosition(
    schoolLat: number = -6.229746,
    schoolLng: number = 106.807493,
    maxRadiusMeters: number = 250
  ): Promise<GeofenceResult> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      throw new Error('Perangkat tidak mendukung sensor Geolocation GPS.');
    }

    return new Promise((resolve, reject) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Force fresh reading, no cached coordinates
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const mockReasons: string[] = [];

          // 1. Accuracy Check (accuracy > 150m is suspicious/imprecise)
          const isAccuracyAcceptable = accuracy <= 120;
          if (accuracy === 0) {
            mockReasons.push('Akurasi GPS bernilai 0 (indikasi emulator/mock).');
          }

          // 2. Teleportation / Speed anomaly check
          const now = Date.now();
          if (this.lastKnownPosition) {
            const timeDiffSec = (now - this.lastKnownPosition.time) / 1000;
            const distJump = this.calculateDistanceMeters(
              this.lastKnownPosition.lat,
              this.lastKnownPosition.lng,
              latitude,
              longitude
            );
            if (timeDiffSec > 0) {
              const computedSpeedKmH = (distJump / timeDiffSec) * 3.6;
              if (computedSpeedKmH > 350 && distJump > 500) {
                mockReasons.push(`Perpindahan koordinat tidak wajar (${Math.round(computedSpeedKmH)} km/jam).`);
              }
            }
          }

          // 3. Check automation flags
          if (navigator.webdriver) {
            mockReasons.push('Browser terdeteksi dijalankan dalam mode otomasi (webdriver).');
          }

          this.lastKnownPosition = { lat: latitude, lng: longitude, time: now };

          // Calculate distance to school
          const distanceMeters = this.calculateDistanceMeters(schoolLat, schoolLng, latitude, longitude);
          const isWithinRadius = distanceMeters <= maxRadiusMeters;

          resolve({
            distanceMeters,
            isWithinRadius,
            accuracyMeters: Math.round(accuracy),
            isAccuracyAcceptable,
            latitude,
            longitude,
            mockSuspected: mockReasons.length > 0,
            mockReasons
          });
        },
        (err) => {
          reject(new Error(`Gagal membaca GPS: ${err.message}. Pastikan izin lokasi aktif dan sinyal GPS terbuka.`));
        },
        options
      );
    });
  }

  /**
   * Detect Incognito / Private Browsing Mode across modern browsers (Chrome, Safari, Firefox, Edge)
   */
  async detectIncognito(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // 1. Chrome / Edge / Chromium storage quota check
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { quota } = await navigator.storage.estimate();
        if (quota && quota < 120000000) {
          return true;
        }
      }

      // 2. Safari private browsing check
      if ((window as any).safari && !(window as any).safari.pushNotification) {
        return true;
      }

      // 3. Firefox indexedDB private check
      if ('MozAppearance' in (document.documentElement as any).style) {
        const db = indexedDB.open('test_incognito');
        return new Promise((resolve) => {
          db.onerror = () => resolve(true);
          db.onsuccess = () => resolve(false);
        });
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to security alerts (e.g. when copy/paste or contextmenu is blocked)
   */
  onSecurityAlert(callback: SecurityAlertCallback): () => void {
    this.alertListeners.add(callback);
    return () => {
      this.alertListeners.delete(callback);
    };
  }

  private notifyAlert(action: 'copy' | 'paste' | 'cut' | 'contextmenu' | 'shortcut' | 'devtools', message: string) {
    this.alertListeners.forEach((cb) => {
      try {
        cb({ action, message });
      } catch (err) {
        console.warn('Security callback error:', err);
      }
    });
  }

  /**
   * Set Anti-Copy Paste protection state
   */
  setAntiCopyProtection(enabled: boolean) {
    this.antiCopyEnabled = enabled;
  }

  getAntiCopyProtectionStatus(): boolean {
    return this.antiCopyEnabled;
  }

  /**
   * Initialize Complete Anti-Fraud, Anti-Copy/Paste, and Security Guards
   * Works across all browser modes including Incognito / Private Browsing
   */
  initSecurityGuards(onDevToolsDetected?: (isOpen: boolean) => void) {
    if (this.listenersAttached || typeof window === 'undefined') return;
    this.listenersAttached = true;

    // 1. GLOBAL ANTI-COPY GUARD
    document.addEventListener(
      'copy',
      (e: ClipboardEvent) => {
        if (!this.antiCopyEnabled) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', '');
        }
        this.notifyAlert('copy', 'Fitur Salin (Copy) dinonaktifkan demi keamanan & privasi data sekolah.');
        return false;
      },
      true
    );

    // 2. GLOBAL ANTI-CUT GUARD
    document.addEventListener(
      'cut',
      (e: ClipboardEvent) => {
        if (!this.antiCopyEnabled) return;
        e.preventDefault();
        e.stopPropagation();
        this.notifyAlert('cut', 'Fitur Potong Teks (Cut) dinonaktifkan demi keamanan data.');
        return false;
      },
      true
    );

    // 3. GLOBAL ANTI-PASTE GUARD (Prevent external unauthorized paste into guarded sections)
    document.addEventListener(
      'paste',
      (e: ClipboardEvent) => {
        if (!this.antiCopyEnabled) return;
        const target = e.target as HTMLElement;
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        
        // If paste target is marked as anti-paste or not an allowed input
        if (!isInput || target?.classList.contains('no-paste')) {
          e.preventDefault();
          e.stopPropagation();
          this.notifyAlert('paste', 'Fitur Tempel (Paste) dibatasi demi integritas dokumen.');
          return false;
        }
      },
      true
    );

    // 4. GLOBAL ANTI-CONTEXT MENU (Right-Click & Long-Press Blocker)
    document.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        if (!this.antiCopyEnabled) return;
        const target = e.target as HTMLElement;
        // Block contextmenu across the entire app
        e.preventDefault();
        e.stopPropagation();
        this.notifyAlert('contextmenu', 'Klik kanan (Context Menu) dinonaktifkan untuk melindungi data e-Piket.');
        return false;
      },
      true
    );

    // 5. GLOBAL DRAG & TEXT SELECTION BLOCKER (except inside editable input fields)
    document.addEventListener(
      'dragstart',
      (e: DragEvent) => {
        if (!this.antiCopyEnabled) return;
        const target = e.target as HTMLElement;
        if (target && target.tagName === 'IMG') {
          e.preventDefault();
          return false;
        }
      },
      true
    );

    // 6. BLOCK KEYBOARD SHORTCUTS (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U, Ctrl+S, F12, Inspect, etc.)
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (!this.antiCopyEnabled) return;
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const metaKey = isMac ? e.metaKey : e.ctrlKey;
        const key = e.key ? e.key.toLowerCase() : '';

        // F12 (DevTools)
        if (e.key === 'F12' || e.keyCode === 123) {
          e.preventDefault();
          e.stopPropagation();
          this.notifyAlert('devtools', 'Mode Pengembang (F12) dinonaktifkan.');
          return false;
        }

        // Ctrl+Shift+I / J / C (or Cmd+Option+I/J/C)
        if (
          (metaKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
          (isMac && e.metaKey && e.altKey && (key === 'i' || key === 'j' || key === 'c'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          this.notifyAlert('devtools', 'Inspect Element dinonaktifkan demi integritas sistem.');
          return false;
        }

        // Ctrl+U (View Source)
        if (metaKey && key === 'u') {
          e.preventDefault();
          e.stopPropagation();
          this.notifyAlert('shortcut', 'Akses View Source dinonaktifkan.');
          return false;
        }

        // Ctrl+S (Save Webpage)
        if (metaKey && key === 's') {
          e.preventDefault();
          e.stopPropagation();
          this.notifyAlert('shortcut', 'Penyimpanan halaman langsung dinonaktifkan. Gunakan menu Ekspor Resmi.');
          return false;
        }

        // Ctrl+C (Copy Shortcut)
        if (metaKey && key === 'c' && !e.shiftKey && !e.altKey) {
          const selection = window.getSelection()?.toString();
          if (selection && selection.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            // Clear selection
            window.getSelection()?.removeAllRanges();
            this.notifyAlert('copy', 'Pintasan Salin (Ctrl+C) dinonaktifkan untuk melindungi data.');
            return false;
          }
        }

        // Ctrl+X (Cut Shortcut)
        if (metaKey && key === 'x') {
          const target = e.target as HTMLElement;
          const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
          if (!isInput) {
            e.preventDefault();
            e.stopPropagation();
            this.notifyAlert('cut', 'Pintasan Potong Teks (Ctrl+X) dinonaktifkan.');
            return false;
          }
        }
      },
      true
    );

    // 7. DEVTOOLS HEURISTICS DETECTION (Desktop only to prevent false positives and save mobile battery)
    const isMobileDevice = typeof navigator !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      window.innerWidth < 1024
    );

    if (!isMobileDevice) {
      const threshold = 160;
      const checkDevTools = () => {
        const widthDiff = window.outerWidth - window.innerWidth > threshold;
        const heightDiff = window.outerHeight - window.innerHeight > threshold;
        const isOpen = widthDiff || heightDiff;

        if (isOpen !== this.devToolsOpen) {
          this.devToolsOpen = isOpen;
          if (onDevToolsDetected) onDevToolsDetected(isOpen);
        }
      };

      window.addEventListener('resize', checkDevTools);
    }

    // Initial check for incognito mode
    this.detectIncognito().then((isIncog) => {
      if (isIncog) {
        console.info('🔒 Proteksi Data e-Piket: Berjalan di Mode Penyamaran (Incognito). Seluruh pembatasan copy-paste tetap aktif penuh.');
      }
    });
  }

  /**
   * Perform a comprehensive security audit check
   */
  async runSecurityAudit(): Promise<SecurityAuditCheck> {
    const isIncognito = await this.detectIncognito();
    const isAutomated = !!navigator.webdriver;
    const warnings: string[] = [];

    if (this.devToolsOpen) {
      warnings.push('Developer Tools / Panel Inspect terdeteksi aktif.');
    }
    if (isIncognito) {
      warnings.push('Aplikasi dibuka di Mode Penyamaran (Incognito/Private Mode). Proteksi anti copy-paste tetap aktif.');
    }
    if (isAutomated) {
      warnings.push('Indikasi software otomasi / bot browser terdeteksi.');
    }

    return {
      isDevToolsOpen: this.devToolsOpen,
      isIncognito,
      isAutomated,
      isSecure: warnings.length === 0,
      isCopyPasteBlocked: this.antiCopyEnabled,
      warnings
    };
  }
}

export const antiFraudService = new AntiFraudService();
