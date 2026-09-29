import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings, 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  ShieldCheck, 
  Sliders, 
  Image,
  Sparkles,
  Info
} from 'lucide-react';
import { Incident } from '../../types';
import { incidentPhotoCache } from '../../services/incidentPhotoCacheService';
import { sound, triggerConfetti } from '../../utils/feedback';

interface IncidentPhotoCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
  onCacheChanged?: () => void;
}

export const IncidentPhotoCacheModal: React.FC<IncidentPhotoCacheModalProps> = ({
  isOpen,
  onClose,
  incidents,
  onCacheChanged
}) => {
  const [config, setConfig] = useState(incidentPhotoCache.getConfig());
  const [stats, setStats] = useState<{
    totalCachedPhotos: number;
    totalSizeBytes: number;
    formattedSize: string;
    totalIncidentPhotosCount: number;
    offlineReadyPercentage: number;
    isOfflineReady: boolean;
  }>({
    totalCachedPhotos: 0,
    totalSizeBytes: 0,
    formattedSize: '0 KB',
    totalIncidentPhotosCount: 0,
    offlineReadyPercentage: 0,
    isOfflineReady: false
  });

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; photoName: string }>({
    current: 0,
    total: 0,
    photoName: ''
  });
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const refreshStats = async () => {
    const s = await incidentPhotoCache.getCacheStats(incidents);
    setStats(s);
  };

  useEffect(() => {
    if (isOpen) {
      setConfig(incidentPhotoCache.getConfig());
      refreshStats();
      setSyncSuccess(false);
      setClearSuccess(false);
    }
  }, [isOpen, incidents]);

  if (!isOpen) return null;

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncSuccess(false);

    try {
      const result = await incidentPhotoCache.prefetchAndCacheAllIncidents(incidents, (current, total, photoName) => {
        setSyncProgress({ current, total, photoName });
      });

      await refreshStats();
      sound.playSuccess();
      triggerConfetti();
      setSyncSuccess(true);
      if (onCacheChanged) onCacheChanged();
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (e) {
      console.error('Batch cache error:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    incidentPhotoCache.saveConfig(config);
    sound.playClickTap();
    setSaveSuccess(true);
    if (onCacheChanged) onCacheChanged();
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleClearCache = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mengosongkan seluruh cache foto kejadian lokal? Foto di Google Drive / Cloud tetap aman.')) {
      return;
    }

    setClearing(true);
    try {
      await incidentPhotoCache.clearAllCache();
      await refreshStats();
      sound.playClickTap();
      setClearSuccess(true);
      if (onCacheChanged) onCacheChanged();
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (e) {
      console.error('Clear cache error:', e);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 p-6 space-y-6 animate-in fade-in zoom-in-95 transition-colors">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Konfigurasi Cache Foto Kejadian
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Optimasi penyimpanan offline IndexedDB & Cache Storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Cache Health Dashboard Widget */}
        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Status Penyimpanan Offline</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              stats.offlineReadyPercentage >= 80
                ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
            }`}>
              {stats.offlineReadyPercentage}% Ter-Cache
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                stats.offlineReadyPercentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, stats.offlineReadyPercentage)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-medium">Foto Ter-Cache</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {stats.totalCachedPhotos} / {stats.totalIncidentPhotosCount}
              </span>
            </div>
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-medium">Ukuran Cache</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {stats.formattedSize}
              </span>
            </div>
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-medium">Batas Alokasi</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {config.maxCacheSizeMb} MB
              </span>
            </div>
          </div>

          {/* Sync All Button */}
          <div className="pt-2">
            <button
              onClick={handleSyncAll}
              disabled={syncing || stats.totalIncidentPhotosCount === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>
                {syncing
                  ? `Meng-cache ${syncProgress.current}/${syncProgress.total} foto...`
                  : '⚡ Sinkronkan & Cache Semua Foto Kejadian Sekarang'}
              </span>
            </button>

            {syncSuccess && (
              <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Semua foto kejadian berhasil di-cache untuk akses offline instan!
              </p>
            )}
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Sliders className="w-3.5 h-3.5" />
            <span>Pengaturan Otomatisasi Cache</span>
          </div>

          {/* Toggle 1: Auto cache on upload */}
          <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-Cache Foto Kejadian Saat Diunggah
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Otomatis mengompresi dan menyimpan foto langsung ke IndexedDB saat petugas membuat laporan.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.autoCacheOnUpload}
                onChange={(e) => setConfig({ ...config, autoCacheOnUpload: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Toggle 2: Auto preload on module load */}
          <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-Preload di Latar Belakang
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Memuat dan menyimpan foto kejadian secara otomatis di latar belakang saat modul Kejadian dibuka.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.autoPreloadIncidentPhotos}
                onChange={(e) => setConfig({ ...config, autoPreloadIncidentPhotos: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {/* Quality selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kualitas Kompresi Offline
              </label>
              <select
                value={config.offlineImageQuality}
                onChange={(e) =>
                  setConfig({ ...config, offlineImageQuality: e.target.value as 'high' | 'medium' | 'compressed' })
                }
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-medium"
              >
                <option value="compressed">🚀 Cepat & Hemat (640px, ~50KB)</option>
                <option value="medium">⚖️ Optimal Seimbang (1024px, ~150KB)</option>
                <option value="high">💎 Resolusi Tinggi (1600px, ~350KB)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Batas Kapasitas Maksimum
              </label>
              <select
                value={config.maxCacheSizeMb}
                onChange={(e) => setConfig({ ...config, maxCacheSizeMb: Number(e.target.value) })}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-medium"
              >
                <option value={25}>25 MB (Cukup ~200 foto)</option>
                <option value={50}>50 MB (Rekomendasi ~400 foto)</option>
                <option value={100}>100 MB (Besar ~800 foto)</option>
                <option value={200}>200 MB (Maksimal)</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              {saveSuccess ? '✓ Konfigurasi Tersimpan!' : 'Simpan Konfigurasi'}
            </button>

            <button
              type="button"
              onClick={handleClearCache}
              disabled={clearing || stats.totalCachedPhotos === 0}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 font-bold rounded-xl text-xs border border-slate-300 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
              <span>{clearing ? 'Membersihkan...' : 'Kosongkan Cache'}</span>
            </button>
          </div>

          {clearSuccess && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold text-center">
              ✓ Seluruh cache foto kejadian lokal telah dibersihkan.
            </p>
          )}
        </form>

      </div>
    </div>
  );
};
