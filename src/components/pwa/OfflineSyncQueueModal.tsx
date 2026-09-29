import React, { useState } from 'react';
import { Database, WifiOff, RefreshCw, X, CheckCircle2, Clock, BookOpen, AlertTriangle, Camera, Layers, Zap } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { haptic } from '../../utils/feedback';

interface OfflineSyncQueueModalProps {
  onClose: () => void;
}

export const OfflineSyncQueueModal: React.FC<OfflineSyncQueueModalProps> = ({ onClose }) => {
  const { isOnline, pendingSyncCount, pendingOfflineActions, triggerSyncOfflineActions } = useData();
  const [syncing, setSyncing] = useState(false);
  const [syncedSuccess, setSyncedSuccess] = useState(false);

  const handleSyncNow = async () => {
    setSyncing(true);
    haptic.medium();
    try {
      await triggerSyncOfflineActions();
      setSyncedSuccess(true);
      setTimeout(() => {
        setSyncedSuccess(false);
      }, 3000);
    } catch (e) {
      console.error('Manual sync queue error:', e);
    } finally {
      setSyncing(false);
    }
  };

  const getActionBadge = (actionType: string, payload: any) => {
    switch (actionType) {
      case 'createLogbook':
        return {
          icon: <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          title: 'Buku Piket Digital',
          bgColor: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
        };
      case 'createIncident':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          title: 'Laporan Kejadian',
          bgColor: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800'
        };
      case 'checkIn':
        return {
          icon: <Camera className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
          title: `Presensi Check-In (${payload.userName || 'Petugas'})`,
          bgColor: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800'
        };
      case 'checkOut':
        return {
          icon: <Camera className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          title: `Presensi Check-Out (${payload.userName || 'Petugas'})`,
          bgColor: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800'
        };
      case 'createHandover':
        return {
          icon: <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          title: 'Serah Terima Pos Piket',
          bgColor: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800'
        };
      default:
        return {
          icon: <Database className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
          title: 'Perubahan Data',
          bgColor: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col justify-between p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl ${!isOnline ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'} shrink-0`}>
              {!isOnline ? <WifiOff className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Antrean Sinkronisasi Data Offline</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {pendingSyncCount} Mengantre
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Data buku piket &amp; kejadian tersimpan aman di IndexedDB memori HP Anda.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Banner */}
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
          !isOnline
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            )}
            <span className="font-extrabold">
              {!isOnline ? 'Status: Mode Offline (Tanpa Internet)' : 'Status: Tersambung Internet (Online)'}
            </span>
          </div>

          <span className="text-[10.5px] font-mono font-bold">
            {pendingSyncCount} Item Siap
          </span>
        </div>

        {/* Success Alert */}
        {syncedSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">Seluruh antrean data offline berhasil disinkronkan ke server!</span>
          </div>
        )}

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-64">
          {pendingOfflineActions.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Tidak Ada Antrean Offline</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Semua entri buku piket digital dan laporan telah tersimpan dan tersinkronisasi sempurna.
              </p>
            </div>
          ) : (
            pendingOfflineActions.map((item) => {
              const payload = item.payload || {};
              const badge = getActionBadge(item.actionType, payload);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border ${badge.bgColor} flex flex-col justify-between gap-2 shadow-xs`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-xs">
                        {badge.icon}
                      </div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {badge.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.retryCount && item.retryCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-300 font-extrabold text-[10px] border border-rose-300 dark:border-rose-800">
                          Retry #{item.retryCount}
                        </span>
                      ) : null}
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-extrabold text-[10px] flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                        <Clock className="w-3 h-3" />
                        <span>Mengantre (IndexedDB)</span>
                      </span>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="text-[11.5px] text-slate-700 dark:text-slate-300 space-y-0.5 font-medium pl-1">
                    {payload.userName && <p><strong>Petugas:</strong> {payload.userName}</p>}
                    {payload.postName && <p><strong>Pos Piket:</strong> {payload.postName}</p>}
                    {payload.checkInAt && (
                      <p><strong>Waktu Check-In:</strong> {formatTimeIndo(payload.checkInAt)} WIB {payload.isLate ? `(Terlambat +${payload.lateMinutes}m)` : '(Tepat Waktu)'}</p>
                    )}
                    {payload.checkOutAt && (
                      <p><strong>Waktu Check-Out:</strong> {formatTimeIndo(payload.checkOutAt)} WIB (Durasi: {payload.durasiMenit || 0} menit)</p>
                    )}
                    {payload.fotoCheckIn && (
                      <p className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Foto Selfie Ber-Watermark Tersimpan di Cache Offline</span>
                      </p>
                    )}
                    {payload.kondisiSelamaBertugas && (
                      <p className="line-clamp-2"><strong>Jurnal:</strong> {payload.kondisiSelamaBertugas}</p>
                    )}
                    {payload.jenisKejadian && (
                      <p><strong>Insiden:</strong> {payload.jenisKejadian} ({payload.lokasi})</p>
                    )}
                    {item.lastError && (
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">
                        Pesan koneksi: {item.lastError}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono pt-1">
                      Waktu Pembuatan: {formatDateIndo(item.createdAt?.split('T')[0] || '')} • {formatTimeIndo(item.createdAt || '')} WIB
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            disabled={syncing || pendingSyncCount === 0 || !isOnline}
            onClick={handleSyncNow}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>
              {!isOnline
                ? 'Harap Hubungkan Internet untuk Sinkron'
                : syncing
                ? 'Memproses Sinkronisasi...'
                : 'Sinkronkan Seluruh Antrean Sekarang 🔄'}
            </span>
          </button>
        </div>

      </div>

    </div>
  );
};
