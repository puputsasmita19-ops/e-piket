/**
 * IndexedDB storage engine for e-Piket Digital Offline First mode.
 * Stores schedules, cached reports, logbooks, incidents, and offline sync actions.
 */

import { DutySchedule, Logbook, Incident, DutyPost, Attendance, School, CachedIncidentPhoto } from '../types';

const DB_NAME = 'ePiket_Offline_DB';
const DB_VERSION = 2;

export interface CachedReport {
  id: string;
  type: 'harian' | 'mingguan' | 'bulanan' | 'semester';
  period: string; // e.g. "2026-09-25"
  generatedAt: string;
  summary: {
    totalSchedules: number;
    hadirCount: number;
    terlambatCount: number;
    disciplineRate: number;
    incidentCount: number;
  };
  schedules: DutySchedule[];
  incidents: Incident[];
  logbooks: Logbook[];
}

export interface OfflineAction {
  id: string;
  actionType: 'checkIn' | 'checkOut' | 'createLogbook' | 'createIncident' | 'createHandover' | 'updateSchedule' | 'syncAttendance';
  payload: any;
  createdAt: string;
  status: 'pending' | 'synced' | 'failed';
  retryCount?: number;
  lastError?: string;
}

class OfflineDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Schedules store
        if (!db.objectStoreNames.contains('schedules')) {
          const store = db.createObjectStore('schedules', { keyPath: 'id' });
          store.createIndex('tanggal', 'tanggal', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }

        // Cached reports store
        if (!db.objectStoreNames.contains('cached_reports')) {
          const store = db.createObjectStore('cached_reports', { keyPath: 'id' });
          store.createIndex('period', 'period', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }

        // Logbooks store
        if (!db.objectStoreNames.contains('logbooks')) {
          const store = db.createObjectStore('logbooks', { keyPath: 'id' });
          store.createIndex('tanggal', 'tanggal', { unique: false });
        }

        // Incidents store
        if (!db.objectStoreNames.contains('incidents')) {
          const store = db.createObjectStore('incidents', { keyPath: 'id' });
          store.createIndex('tanggal', 'tanggal', { unique: false });
        }

        // Master Posts & School Store (Key-Value)
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }

        // Offline Actions Queue store
        if (!db.objectStoreNames.contains('offline_actions')) {
          const store = db.createObjectStore('offline_actions', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
        }

        // Incident Photos Cache Store (Dedicated for Incident Documentation)
        if (!db.objectStoreNames.contains('incident_photos_cache')) {
          const store = db.createObjectStore('incident_photos_cache', { keyPath: 'id' });
          store.createIndex('incidentId', 'incidentId', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Schedules ---
  async saveSchedules(schedules: DutySchedule[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('schedules', 'readwrite');
    const store = tx.objectStore('schedules');
    
    // Clear and batch insert
    store.clear();
    for (const schedule of schedules) {
      store.put(schedule);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllSchedules(): Promise<DutySchedule[]> {
    const db = await this.getDB();
    const tx = db.transaction('schedules', 'readonly');
    const store = tx.objectStore('schedules');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getSchedulesByDate(dateStr: string): Promise<DutySchedule[]> {
    const db = await this.getDB();
    const tx = db.transaction('schedules', 'readonly');
    const store = tx.objectStore('schedules');
    const index = store.index('tanggal');
    const request = index.getAll(dateStr);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Cached Reports ---
  async saveReport(report: CachedReport): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('cached_reports', 'readwrite');
    tx.objectStore('cached_reports').put(report);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllCachedReports(): Promise<CachedReport[]> {
    const db = await this.getDB();
    const tx = db.transaction('cached_reports', 'readonly');
    const request = tx.objectStore('cached_reports').getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedReportByPeriod(type: string, period: string): Promise<CachedReport | null> {
    const all = await this.getAllCachedReports();
    return all.find((r) => r.type === type && r.period === period) || null;
  }

  // --- Logbooks & Incidents ---
  async saveLogbooks(logbooks: Logbook[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('logbooks', 'readwrite');
    const store = tx.objectStore('logbooks');
    store.clear();
    for (const log of logbooks) store.put(log);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllLogbooks(): Promise<Logbook[]> {
    const db = await this.getDB();
    const tx = db.transaction('logbooks', 'readonly');
    const request = tx.objectStore('logbooks').getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveIncidents(incidents: Incident[]): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('incidents', 'readwrite');
    const store = tx.objectStore('incidents');
    store.clear();
    for (const inc of incidents) store.put(inc);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllIncidents(): Promise<Incident[]> {
    const db = await this.getDB();
    const tx = db.transaction('incidents', 'readonly');
    const request = tx.objectStore('incidents').getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Metadata (School & Posts) ---
  async saveMetadata(key: string, data: any): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('metadata', 'readwrite');
    tx.objectStore('metadata').put({ key, data, updatedAt: new Date().toISOString() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMetadata<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    const tx = db.transaction('metadata', 'readonly');
    const request = tx.objectStore('metadata').get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => reject(request.error);
    });
  }

  // --- Offline Action Queue ---
  async enqueueOfflineAction(actionType: OfflineAction['actionType'], payload: any): Promise<OfflineAction> {
    const db = await this.getDB();
    const tx = db.transaction('offline_actions', 'readwrite');
    const action: OfflineAction = {
      id: `offline-act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      actionType,
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    tx.objectStore('offline_actions').put(action);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(action);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingOfflineActions(): Promise<OfflineAction[]> {
    const db = await this.getDB();
    const tx = db.transaction('offline_actions', 'readonly');
    const request = tx.objectStore('offline_actions').getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const list: OfflineAction[] = request.result || [];
        resolve(list.filter((a) => a.status === 'pending'));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeOfflineAction(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('offline_actions', 'readwrite');
    tx.objectStore('offline_actions').delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateOfflineAction(action: OfflineAction): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('offline_actions', 'readwrite');
    tx.objectStore('offline_actions').put(action);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllOfflineActions(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('offline_actions', 'readwrite');
    tx.objectStore('offline_actions').clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Dedicated Incident Photos Cache ---
  async saveCachedIncidentPhoto(photo: CachedIncidentPhoto): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('incident_photos_cache', 'readwrite');
    tx.objectStore('incident_photos_cache').put(photo);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedIncidentPhoto(id: string): Promise<CachedIncidentPhoto | null> {
    const db = await this.getDB();
    const tx = db.transaction('incident_photos_cache', 'readonly');
    const request = tx.objectStore('incident_photos_cache').get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCachedIncidentPhotos(): Promise<CachedIncidentPhoto[]> {
    const db = await this.getDB();
    const tx = db.transaction('incident_photos_cache', 'readonly');
    const request = tx.objectStore('incident_photos_cache').getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCachedIncidentPhoto(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('incident_photos_cache', 'readwrite');
    tx.objectStore('incident_photos_cache').delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllCachedIncidentPhotos(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('incident_photos_cache', 'readwrite');
    tx.objectStore('incident_photos_cache').clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineDB = new OfflineDB();
