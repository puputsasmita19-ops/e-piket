import React, { useState, useEffect } from 'react';
import { Zap, HardDrive, Eye, Download, ExternalLink, RefreshCw, X, Check, Image as ImageIcon } from 'lucide-react';
import { AttachmentMeta } from '../../types';
import { incidentPhotoCache } from '../../services/incidentPhotoCacheService';
import { formatDateIndo } from '../../utils/formatters';

interface CachedIncidentImageProps {
  photo: AttachmentMeta;
  incidentId?: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  showOfflineBadge?: boolean;
  allowZoom?: boolean;
  onCacheUpdated?: () => void;
}

export const CachedIncidentImage: React.FC<CachedIncidentImageProps> = ({
  photo,
  incidentId,
  alt = 'Dokumentasi Kejadian',
  className = 'w-20 h-20',
  imgClassName = 'w-full h-full object-cover',
  showOfflineBadge = true,
  allowZoom = true,
  onCacheUpdated
}) => {
  const [imageSrc, setImageSrc] = useState<string>(photo.thumbnailUrl || photo.driveUrl);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [cachingInProgress, setCachingInProgress] = useState<boolean>(false);
  const [cacheSuccessMsg, setCacheSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resolvePhoto = async () => {
      setLoading(true);
      try {
        const photoKey = photo.id || photo.driveFileId;
        const cachedUrl = await incidentPhotoCache.getCachedPhoto(photoKey);

        if (cachedUrl && isMounted) {
          setImageSrc(cachedUrl);
          setIsCached(true);
          setLoading(false);
          return;
        }

        // If not in cache, fallback to provided URL and auto-cache in background if online
        const fallback = photo.thumbnailUrl || photo.driveUrl;
        if (isMounted) {
          setImageSrc(fallback);
          setIsCached(false);
          setLoading(false);
        }

        const config = incidentPhotoCache.getConfig();
        if (config.autoPreloadIncidentPhotos && typeof window !== 'undefined' && navigator.onLine) {
          try {
            await incidentPhotoCache.cachePhoto(photo, incidentId);
            if (isMounted) {
              setIsCached(true);
              if (onCacheUpdated) onCacheUpdated();
            }
          } catch (e) {
            // Silently ignore background caching errors
          }
        }
      } catch (err) {
        if (isMounted) {
          setImageSrc(photo.thumbnailUrl || photo.driveUrl);
          setLoading(false);
        }
      }
    };

    resolvePhoto();

    return () => {
      isMounted = false;
    };
  }, [photo.id, photo.driveFileId, photo.thumbnailUrl, photo.driveUrl, incidentId, onCacheUpdated]);

  const handleManualCache = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCachingInProgress(true);
    try {
      await incidentPhotoCache.cachePhoto(photo, incidentId);
      setIsCached(true);
      setCacheSuccessMsg('Tersimpan di Cache Offline!');
      if (onCacheUpdated) onCacheUpdated();
      setTimeout(() => setCacheSuccessMsg(null), 3000);
    } catch (err) {
      console.warn('Manual cache failed:', err);
    } finally {
      setCachingInProgress(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = photo.fileName || `kejadian_foto_${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div
        onClick={() => allowZoom && setIsLightboxOpen(true)}
        className={`relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 ${
          allowZoom ? 'cursor-pointer hover:shadow-md transition-all' : ''
        } ${className}`}
      >
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800 animate-pulse">
            <ImageIcon className="w-5 h-5 text-slate-400" />
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={alt}
            className={`${imgClassName} group-hover:scale-105 transition-transform duration-300`}
            loading="lazy"
            onError={() => {
              // If dataUrl failed, fall back to driveUrl
              if (imageSrc !== photo.driveUrl) {
                setImageSrc(photo.driveUrl);
              }
            }}
          />
        )}

        {/* Offline Cache Status Badge */}
        {showOfflineBadge && (
          <div className="absolute top-1 left-1">
            {isCached ? (
              <span
                title="Tersimpan di cache offline (dapat dibuka tanpa internet)"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-bold backdrop-blur-xs shadow-xs"
              >
                <Zap className="w-2.5 h-2.5 fill-current" />
                <span>Offline</span>
              </span>
            ) : (
              <span
                title="Belum tersimpan di cache offline"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-900/70 text-slate-300 text-[9px] font-medium backdrop-blur-xs shadow-xs"
              >
                <HardDrive className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
        )}

        {/* Hover zoom overlay */}
        {allowZoom && (
          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Eye className="w-5 h-5 text-white drop-shadow-md" />
          </div>
        )}
      </div>

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                    {photo.fileName || 'Dokumentasi Kejadian'}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{photo.uploadedBy ? `Oleh: ${photo.uploadedBy}` : 'Bukti Kejadian'}</span>
                    {photo.uploadedAt && <span>• {formatDateIndo(photo.uploadedAt.split('T')[0])}</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-2 min-h-[300px] max-h-[60vh] overflow-hidden relative select-none">
              <img
                src={imageSrc}
                alt={alt}
                className="max-w-full max-h-[58vh] object-contain rounded-lg shadow-lg"
              />

              {/* Cache status pill over image */}
              <div className="absolute top-4 left-4">
                {isCached ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/90 text-white text-xs font-bold backdrop-blur-md shadow-lg">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Tersimpan di Cache Offline (IndexedDB)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-600/90 text-white text-xs font-bold backdrop-blur-md shadow-lg">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Memuat dari Jaringan Google Drive</span>
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer Toolbar */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Ukuran:</span>
                  <span>{photo.size ? `${(photo.size / 1024).toFixed(1)} KB` : 'Terkonversi'}</span>
                  {photo.folderPath && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-slate-400 truncate max-w-xs">{photo.folderPath}</span>
                    </>
                  )}
                </div>
                {cacheSuccessMsg && (
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                    <Check className="w-3 h-3" /> {cacheSuccessMsg}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isCached && (
                  <button
                    onClick={handleManualCache}
                    disabled={cachingInProgress}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cachingInProgress ? 'animate-spin' : ''}`} />
                    <span>{cachingInProgress ? 'Menyimpan...' : '⚡ Simpan ke Cache Offline'}</span>
                  </button>
                )}

                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Foto</span>
                </button>

                {photo.driveUrl && !photo.driveUrl.startsWith('data:') && (
                  <a
                    href={photo.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Drive</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
