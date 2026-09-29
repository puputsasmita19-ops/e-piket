import React, { useState, useEffect } from 'react';
import { Bell, Clock, AlertTriangle, CheckCircle2, Volume2, Sparkles, X, ShieldAlert, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { getTodayDateString } from '../../services/seedData';
import { notificationService } from '../../services/notificationService';
import { sound } from '../../utils/feedback';

export const PiketReminderNotification: React.FC = () => {
  const { currentUser } = useAuth();
  const { schedules } = useData();
  
  const [showSimulatedBanner, setShowSimulatedBanner] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  const today = getTodayDateString();

  // Find today's schedule for current logged in user
  const myTodaySchedule = schedules.find(
    (s) => s.tanggal === today && (s.userId === currentUser?.id || s.originalUserId === currentUser?.id)
  );

  useEffect(() => {
    if (notificationService.isSupported()) {
      setPermissionStatus(notificationService.getPermission());
    }
  }, []);

  // Check if current time is within 15 minutes before shift start
  const is15MinWindow = React.useMemo(() => {
    if (!myTodaySchedule || !myTodaySchedule.jamMulai) return false;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const [h, m] = myTodaySchedule.jamMulai.split(':').map(Number);
    const startMins = h * 60 + m;
    const diff = startMins - currentMins;
    return diff >= 0 && diff <= 15;
  }, [myTodaySchedule]);

  const handleEnableWebPush = async () => {
    const perm = await notificationService.requestPermission();
    setPermissionStatus(perm);
    if (perm === 'granted') {
      sound.playSuccess();
      notificationService.sendNotification('🔔 Notifikasi Browser Diaktifkan', {
        body: 'Anda akan menerima pengingat otomatis 15 menit sebelum piket dimulai.',
      });
    }
  };

  const handleTriggerSimulated15MinPush = () => {
    sound.playNotification();
    setTestNotificationSent(true);

    const postName = myTodaySchedule ? myTodaySchedule.postName : 'Pos Piket Utama';
    const jamMulai = myTodaySchedule ? myTodaySchedule.jamMulai : '07:00';

    const title = `🚨 PENGINGAT H-15 MENIT: Shift Piket ${postName}`;
    const body = `Bpk/Ibu ${currentUser?.nama || 'Petugas'}, tugas piket Anda di ${postName} dimulai pukul ${jamMulai} WIB (15 menit lagi). Silakan persiapkan diri & lakukan Check-In.`;

    // Trigger browser notification
    notificationService.sendNotification(title, {
      body,
      requireInteraction: true
    });

    setTimeout(() => {
      setTestNotificationSent(false);
    }, 5000);
  };

  if (!myTodaySchedule && !showSimulatedBanner) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 dark:from-amber-950/40 dark:via-emerald-950/40 dark:to-teal-950/40 border border-amber-300 dark:border-amber-700/50 rounded-3xl p-4 sm:p-5 text-slate-900 dark:text-white shadow-md relative overflow-hidden transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-amber-500 dark:bg-amber-600 text-white rounded-2xl shadow-lg shadow-amber-500/30 shrink-0 animate-bounce">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/40">
                Pengingat Otomatis H-15 Menit
              </span>
              {is15MinWindow && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white animate-pulse">
                  ⚡ MENDEKATI WAKTU PIKET (15 MNT)
                </span>
              )}
            </div>

            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1">
              {myTodaySchedule ? (
                <>Pengingat Tugas Hari Ini: <span className="text-emerald-700 dark:text-emerald-300">{myTodaySchedule.postName}</span> ({myTodaySchedule.jamMulai} WIB)</>
              ) : (
                <>Sistem Push Notification Simulasi Piket H-15 Menit Active</>
              )}
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Sistem akan mengirim notifikasi browser &amp; bunyi peringatan otomatis 15 menit sebelum waktu tugas piket Anda dimulai.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto shrink-0">
          {permissionStatus !== 'granted' && (
            <button
              onClick={handleEnableWebPush}
              className="px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Aktifkan Izin Push</span>
            </button>
          )}

          <button
            onClick={handleTriggerSimulated15MinPush}
            disabled={testNotificationSent}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            title="Simulasikan Notifikasi Push H-15 Menit"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testNotificationSent ? '✓ Push Terkirim!' : 'Simulasi Push H-15 Mnt'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
