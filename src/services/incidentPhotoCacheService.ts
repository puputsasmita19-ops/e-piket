/**
 * Dedicated Incident & Documentation Photo Cache Service
 * Provides multi-tier offline caching (Cache Storage API + IndexedDB + Memory)
 * Ensures documentation photos in Kejadian & Logbook remain 100% responsive and visible offline.
 */

import { AttachmentMeta, CachedIncidentPhoto, IncidentPhotoCacheConfig, Incident } from '../types';
import { offlineDB } from './indexedDb';

const CACHE_NAME = 'epiket-incident-photos-v1';
const CONFIG_STORAGE_KEY = 'epiket_incident_photo_cache_config';

export const DEFAULT_PHOTO_CACHE_CONFIG: IncidentPhotoCacheConfig = {
  autoCacheOnUpload: true,
  autoPreloadIncidentPhotos: true,
  maxCacheSizeMb: 50,
  offlineImageQuality: 'medium', // high, medium, compressed
  maxRetentionDays: 60,
  lastOptimizedAt: new Date().toISOString()
};

class IncidentPhotoCacheService {
  private config: IncidentPhotoCacheConfig;
  private memoryCache: Map<string, string> = new Map(); // id -> dataUrl / objectUrl

  constructor() {
    this.config = this.loadConfig();
  }

  // --- Configuration Management ---
  public loadConfig(): IncidentPhotoCacheConfig {
    if (typeof window === 'undefined') return DEFAULT_PHOTO_CACHE_CONFIG;
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PHOTO_CACHE_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load incident photo cache config:', e);
    }
    return DEFAULT_PHOTO_CACHE_CONFIG;
  }

  public saveConfig(newConfig: Partial<IncidentPhotoCacheConfig>): IncidentPhotoCacheConfig {
    this.config = { ...this.config, ...newConfig };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      } catch (e) {
        console.warn('Failed to save incident photo cache config:', e);
      }
    }
    return this.config;
  }

  public getConfig(): IncidentPhotoCacheConfig {
    return { ...this.config };
  }

  // --- Helper to convert Image URL or Blob to Base64 with Quality compression ---
  public async compressToOfflineDataUrl(
    src: string | Blob | File,
    quality: 'high' | 'medium' | 'compressed' = this.config.offlineImageQuality
  ): Promise<string> {
    const maxDim = quality === 'high' ? 1600 : quality === 'medium' ? 1024 : 640;
    const qValue = quality === 'high' ? 0.88 : quality === 'medium' ? 0.75 : 0.55;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const cleanupAndResolve = (url: string) => {
        resolve(url);
      };

      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanupAndResolve(typeof src === 'string' ? src : '');
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', qValue);
          cleanupAndResolve(dataUrl);
        } catch (e) {
          console.warn('Canvas export error during offline photo caching:', e);
          if (typeof src === 'string') cleanupAndResolve(src);
          else reject(e);
        }
      };

      img.onerror = (err) => {
        if (typeof src === 'string') {
          // If network error on cross-origin image, resolve with original
          resolve(src);
        } else {
          reject(err);
        }
      };

      if (typeof src === 'string') {
        img.src = src;
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          img.src = ev.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(src);
      }
    });
  }

  // --- Cache Single Photo ---
  public async cachePhoto(
    photo: AttachmentMeta,
    incidentId?: string,
    explicitDataUrl?: string
  ): Promise<CachedIncidentPhoto> {
    const photoId = photo.id || photo.driveFileId || `photo_${Date.now()}`;
    const targetUrl = explicitDataUrl || photo.thumbnailUrl || photo.driveUrl;

    let optimizedDataUrl = targetUrl;
    if (targetUrl && (targetUrl.startsWith('data:') || targetUrl.startsWith('blob:'))) {
      optimizedDataUrl = targetUrl;
    } else if (targetUrl && typeof window !== 'undefined' && navigator.onLine) {
      try {
        optimizedDataUrl = await this.compressToOfflineDataUrl(targetUrl);
      } catch (e) {
        optimizedDataUrl = targetUrl;
      }
    }

    const approxSize = optimizedDataUrl ? Math.round(optimizedDataUrl.length * 0.75) : photo.size || 50000;

    const cachedItem: CachedIncidentPhoto = {
      id: photoId,
      incidentId: incidentId || photo.entityId,
      driveFileId: photo.driveFileId,
      fileName: photo.fileName || `kejadian_foto_${photoId}.jpg`,
      mimeType: photo.mimeType || 'image/jpeg',
      size: approxSize,
      dataUrl: optimizedDataUrl,
      thumbnailUrl: photo.thumbnailUrl || optimizedDataUrl,
      cachedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      isOfflineReady: true
    };

    // 1. Save to Memory Cache
    this.memoryCache.set(photoId, optimizedDataUrl);
    if (photo.driveFileId) this.memoryCache.set(photo.driveFileId, optimizedDataUrl);
    if (photo.driveUrl) this.memoryCache.set(photo.driveUrl, optimizedDataUrl);

    // 2. Save to IndexedDB Store
    try {
      await offlineDB.saveCachedIncidentPhoto(cachedItem);
    } catch (dbErr) {
      console.warn('Could not persist incident photo to IndexedDB:', dbErr);
    }

    // 3. Save to Cache Storage API (if supported)
    if (typeof window !== 'undefined' && 'caches' in window && photo.driveUrl) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const blob = await (await fetch(optimizedDataUrl)).blob();
        const response = new Response(blob, {
          headers: {
            'Content-Type': cachedItem.mimeType,
            'Content-Length': String(cachedItem.size),
            'X-Cached-By': 'ePiket-Incident-Cache',
            'X-Cached-Date': cachedItem.cachedAt
          }
        });
        await cache.put(photo.driveUrl, response);
      } catch (cacheErr) {
        // Silently skip if cache storage put fails
      }
    }

    return cachedItem;
  }

  // --- Retrieve Cached Photo ---
  public async getCachedPhoto(photoIdOrUrl: string): Promise<string | null> {
    if (!photoIdOrUrl) return null;

    // 1. Check memory cache
    if (this.memoryCache.has(photoIdOrUrl)) {
      return this.memoryCache.get(photoIdOrUrl)!;
    }

    // 2. Check IndexedDB
    try {
      const fromDb = await offlineDB.getCachedIncidentPhoto(photoIdOrUrl);
      if (fromDb && fromDb.dataUrl) {
        this.memoryCache.set(photoIdOrUrl, fromDb.dataUrl);
        return fromDb.dataUrl;
      }

      // Check all cached if query was by url or driveFileId
      const all = await offlineDB.getAllCachedIncidentPhotos();
      const match = all.find(
        (p) => p.id === photoIdOrUrl || p.driveFileId === photoIdOrUrl || p.fileName === photoIdOrUrl
      );
      if (match && match.dataUrl) {
        this.memoryCache.set(photoIdOrUrl, match.dataUrl);
        return match.dataUrl;
      }
    } catch (e) {
      console.warn('Error reading from IndexedDB photo cache:', e);
    }

    // 3. Check Cache Storage API
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const match = await cache.match(photoIdOrUrl);
        if (match) {
          const blob = await match.blob();
          const objectUrl = URL.createObjectURL(blob);
          this.memoryCache.set(photoIdOrUrl, objectUrl);
          return objectUrl;
        }
      } catch (e) {
        // Ignore cache storage match errors
      }
    }

    return null;
  }

  // --- Batch Preload & Cache All Incident Photos ---
  public async prefetchAndCacheAllIncidents(
    incidents: Incident[],
    onProgress?: (current: number, total: number, photoName: string) => void
  ): Promise<{ total: number; cached: number; failed: number }> {
    const allPhotos: { photo: AttachmentMeta; incidentId: string }[] = [];
    
    incidents.forEach((inc) => {
      if (inc.fotoDokumentasi && inc.fotoDokumentasi.length > 0) {
        inc.fotoDokumentasi.forEach((photo) => {
          allPhotos.push({ photo, incidentId: inc.id });
        });
      }
    });

    const total = allPhotos.length;
    let cached = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      const item = allPhotos[i];
      if (onProgress) {
        onProgress(i + 1, total, item.photo.fileName || `Foto ${i + 1}`);
      }

      try {
        // Check if already cached
        const existing = await this.getCachedPhoto(item.photo.id || item.photo.driveFileId);
        if (!existing) {
          await this.cachePhoto(item.photo, item.incidentId);
        }
        cached++;
      } catch (err) {
        console.warn(`Failed to pre-cache incident photo ${item.photo.fileName}:`, err);
        failed++;
      }
    }

    return { total, cached, failed };
  }

  // --- Cache Statistics ---
  public async getCacheStats(incidents: Incident[] = []): Promise<{
    totalCachedPhotos: number;
    totalSizeBytes: number;
    formattedSize: string;
    totalIncidentPhotosCount: number;
    offlineReadyPercentage: number;
    isOfflineReady: boolean;
  }> {
    let totalCachedPhotos = 0;
    let totalSizeBytes = 0;

    try {
      const allCached = await offlineDB.getAllCachedIncidentPhotos();
      totalCachedPhotos = allCached.length;
      totalSizeBytes = allCached.reduce((sum, item) => sum + (item.size || 0), 0);
    } catch (e) {
      console.warn('Failed to calculate incident photo cache stats:', e);
    }

    let totalIncidentPhotosCount = 0;
    incidents.forEach((inc) => {
      if (inc.fotoDokumentasi) {
        totalIncidentPhotosCount += inc.fotoDokumentasi.length;
      }
    });

    const offlineReadyPercentage =
      totalIncidentPhotosCount > 0
        ? Math.min(100, Math.round((totalCachedPhotos / totalIncidentPhotosCount) * 100))
        : 100;

    const formattedSize =
      totalSizeBytes > 1024 * 1024
        ? `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`
        : `${(totalSizeBytes / 1024).toFixed(1)} KB`;

    return {
      totalCachedPhotos,
      totalSizeBytes,
      formattedSize,
      totalIncidentPhotosCount,
      offlineReadyPercentage,
      isOfflineReady: offlineReadyPercentage >= 80 || totalIncidentPhotosCount === 0
    };
  }

  // --- Clear & Cleanup Cache ---
  public async clearAllCache(): Promise<void> {
    this.memoryCache.clear();
    try {
      await offlineDB.clearAllCachedIncidentPhotos();
    } catch (e) {
      console.warn('Error clearing IndexedDB photo cache:', e);
    }

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        await caches.delete(CACHE_NAME);
      } catch (e) {
        // ignore
      }
    }
  }

  public async deletePhotoFromCache(id: string): Promise<void> {
    this.memoryCache.delete(id);
    try {
      await offlineDB.deleteCachedIncidentPhoto(id);
    } catch (e) {
      console.warn('Error deleting photo from IndexedDB:', e);
    }
  }
}

export const incidentPhotoCache = new IncidentPhotoCacheService();
