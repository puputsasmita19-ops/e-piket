import React, { useState, useEffect } from 'react';
import { Bell, BellRing, CheckCircle2, ShieldCheck, Zap, X, AlertCircle, Smartphone } from 'lucide-react';
import { fcmService } from '../../services/fcmService';
import { useAuth } from '../../context/AuthContext';
import { sound } from '../../utils/feedback';

export const PiketReminderNotification: React.FC = () => {
  const { currentUser } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('epiket_fcm_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [hasToken, setHasToken] = useState<boolean>(false);

  useEffect(() => {
    fcmService.checkSupport().then((sup) => {
      setIsSupported(sup);
      if (sup) {
        // Initialize FCM silently if user is logged in
        fcmService.initialize(currentUser?.id).then((res) => {
          if (res.token) {
            setHasToken(true);
          }
        });
      }
    });

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, [currentUser?.id]);

  if (!isSupported || isDismissed) {
    return null;
  }

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      sound.playNotification();
      const res = await fcmService.requestPermissionAndGetToken(currentUser?.id);
      if (res.success && res.token) {
        setPermission('granted');
        setHasToken(true);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestPush = async () => {
    await fcmService.sendTestPushNotification(
      '🚨 Test Notifikasi Latar Belakang (FCM)',
      `Halo ${currentUser?.nama || 'Petugas'}! Notifikasi push service worker siap menerima instruksi piket bahkan saat aplikasi di latar belakang.`
    );
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('epiket_fcm_banner_dismissed', 'true');
    } catch {}
  };

  // If already granted, show a compact status badge or minimal banner
  if (permission === 'granted') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black">Push Notifikasi Latar Belakang (FCM) Aktif</span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                Service Worker Siaga
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              Anda menerima instruksi jadwal piket &amp; alert keterlambatan secara realtime di latar belakang.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleTestPush}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            title="Kirim notifikasi uji coba ke perangkat ini"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Uji Coba Push</span>
          </button>
        </div>
      </div>
    );
  }

  // If permission is default/prompt, show prominent call-to-action
  return (
    <div className="relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-teal-950 border border-indigo-500/40 shadow-xl text-white animate-in fade-in">
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30 shrink-0 mt-0.5">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/30">
              <Zap className="w-3 h-3 text-amber-300" />
              <span>Firebase Cloud Messaging (FCM)</span>
            </div>
            <h3 className="text-sm sm:text-base font-black text-white">
              Aktifkan Push Notifikasi Latar Belakang
            </h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Dapatkan pemberitahuan penugasan piket dadakan, pengingat shift H-15 menit, dan alert keterlambatan secara instan bahkan saat browser ditutup.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 sm:pt-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={isRequesting}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{isRequesting ? 'Mengaktifkan...' : 'Izinkan Notifikasi'}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            title="Tutup banner ini"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
