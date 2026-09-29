import React, { useState } from 'react';
import { WifiOff, Database, Check, RefreshCw, Layers, Clock, ListChecks } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { OfflineSyncQueueModal } from './OfflineSyncQueueModal';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, cachedReportsCount, schedules, pendingSyncCount, triggerSyncOfflineActions } = useData();
  const [syncing, setSyncing] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);

  if (isOnline && pendingSyncCount === 0) return null;

  const handleSync = async () => {
    setSyncing(true);
    await triggerSyncOfflineActions();
    setSyncing(false);
  };

  return (
    <>
      <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-40 animate-in slide-in-from-bottom-3">
        <div className={`p-3.5 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-xs ${
          !isOnline 
            ? 'bg-slate-900 text-white border-amber-500/40' 
            : 'bg-emerald-900 text-white border-emerald-500/40'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {!isOnline ? (
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                <Database className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="font-bold flex items-center gap-1.5">
                {!isOnline ? (
                  <>
                    <span className="text-amber-400 truncate">Mode Offline Aktif</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                  </>
                ) : (
                  <span className="text-emerald-300">Sinyal Terhubung</span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {!isOnline 
                  ? `Antrean Offline: ${pendingSyncCount} Entri Mengantre di Memori HP.`
                  : `${pendingSyncCount} perubahan antrean siap disinkronisasi.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={() => setShowQueueModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] transition cursor-pointer border border-amber-400/30 flex items-center gap-1"
                title="Lihat Rincian Antrean Offline"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Antrean ({pendingSyncCount})</span>
              </button>
            )}

            {isOnline && pendingSyncCount > 0 && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Sinkron...' : 'Sinkronkan'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showQueueModal && (
        <OfflineSyncQueueModal onClose={() => setShowQueueModal(false)} />
      )}
    </>
  );
};
