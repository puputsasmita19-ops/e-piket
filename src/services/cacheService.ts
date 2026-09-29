/**
 * Service for managing, auditing, and safely clearing local application caches.
 * Cleans temporary UI states, search caches, and session memory without deleting
 * cloud-synced Master Data (users, duty posts, shifts, school years, schedules).
 */

export interface CacheStats {
  sessionStorageItems: number;
  tempLocalStorageKeys: number;
  totalEstimatedBytes: number;
  formattedSize: string;
  isMasterDataHealthy: boolean;
  lastCleanedAt?: string | null;
}

export interface CacheCleanResult {
  success: boolean;
  itemsCleared: number;
  bytesFreed: number;
  formattedBytesFreed: string;
  message: string;
  cleanedKeys: string[];
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const cacheService = {
  /**
   * Calculates metrics about temporary local cache currently held in the browser.
   */
  getCacheStats(): CacheStats {
    let sessionCount = 0;
    let tempLocalCount = 0;
    let totalBytes = 0;

    // Check sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionCount = window.sessionStorage.length;
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            const val = window.sessionStorage.getItem(key) || '';
            totalBytes += (key.length + val.length) * 2;
          }
        }
      }
    } catch (e) {
      console.warn('Could not inspect sessionStorage:', e);
    }

    // Check temporary UI keys in localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (
            key.startsWith('e_piket_temp_') ||
            key.startsWith('e_piket_draft_') ||
            key.startsWith('e_piket_search_') ||
            key.startsWith('e_piket_filter_') ||
            key.startsWith('e_piket_preview_') ||
            key.includes('search_query') ||
            key.includes('_temp_')
          )) {
            tempLocalCount++;
            const val = window.localStorage.getItem(key) || '';
            totalBytes += (key.length + val.length) * 2;
          }
        }
      }
    } catch (e) {
      console.warn('Could not inspect localStorage:', e);
    }

    // Check Master Data health
    let isMasterHealthy = true;
    try {
      const usersStr = localStorage.getItem('epiket_db_users');
      const schoolStr = localStorage.getItem('epiket_db_school');
      if (usersStr === 'null' || schoolStr === 'null' || usersStr === 'undefined' || schoolStr === 'undefined') {
        isMasterHealthy = false;
      }
    } catch {
      isMasterHealthy = false;
    }

    const lastCleaned = typeof window !== 'undefined' ? localStorage.getItem('e_piket_last_cache_cleanup') : null;

    return {
      sessionStorageItems: sessionCount,
      tempLocalStorageKeys: tempLocalCount,
      totalEstimatedBytes: totalBytes,
      formattedSize: formatBytes(totalBytes),
      isMasterDataHealthy: isMasterHealthy,
      lastCleanedAt: lastCleaned
    };
  },

  /**
   * Safely clears temporary caches without deleting synchronized database entities or auth sessions.
   */
  clearSafeLocalCache(): CacheCleanResult {
    let itemsCleared = 0;
    let bytesFreed = 0;
    const cleanedKeys: string[] = [];

    // 1. Clear sessionStorage safely
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            const val = window.sessionStorage.getItem(key) || '';
            bytesFreed += (key.length + val.length) * 2;
            cleanedKeys.push(`session:${key}`);
            itemsCleared++;
          }
        }
        window.sessionStorage.clear();
      }
    } catch (e) {
      console.warn('Failed clearing sessionStorage:', e);
    }

    // 2. Remove temporary and corrupted transient keys from localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (!key) continue;

          // Target temporary UI caches
          const isTempKey = (
            key.startsWith('e_piket_temp_') ||
            key.startsWith('e_piket_draft_') ||
            key.startsWith('e_piket_search_') ||
            key.startsWith('e_piket_filter_') ||
            key.startsWith('e_piket_preview_') ||
            key === 'e_piket_user_search' ||
            key === 'e_piket_post_search' ||
            key === 'e_piket_shift_search'
          );

          // Detect corrupted entries (e.g. string "null" or "undefined")
          const val = window.localStorage.getItem(key);
          const isCorruptedVal = val === 'null' || val === 'undefined' || val === '""';

          if (isTempKey || (isCorruptedVal && !key.startsWith('firebase:') && !key.startsWith('auth_'))) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach((key) => {
          const val = window.localStorage.getItem(key) || '';
          bytesFreed += (key.length + val.length) * 2;
          cleanedKeys.push(`local:${key}`);
          window.localStorage.removeItem(key);
          itemsCleared++;
        });

        // Record cleanup timestamp
        const now = new Date().toISOString();
        window.localStorage.setItem('e_piket_last_cache_cleanup', now);
      }
    } catch (e) {
      console.warn('Failed clearing transient localStorage keys:', e);
    }

    return {
      success: true,
      itemsCleared,
      bytesFreed,
      formattedBytesFreed: formatBytes(bytesFreed),
      message: `Cache lokal aplikasi berhasil dibersihkan (${itemsCleared} item / ${formatBytes(bytesFreed)}). Seluruh data cloud dan sesi login tetap aman.`,
      cleanedKeys
    };
  }
};
