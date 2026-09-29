import React, { useState, useCallback } from 'react';
import { CalendarCheck, Clock, MapPin, CheckCircle2, AlertCircle, History, Smartphone, Send, Calendar, ShieldCheck, Compass, Fingerprint, Bell, Zap, Camera, ShieldAlert, LogOut, X, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo, formatTimeIndo, getStatusBadgeColor } from '../../utils/formatters';
import { SelfieCameraModal } from '../presence/SelfieCameraModal';
import { GpsLocationValidatorCard } from '../presence/GpsLocationValidatorCard';
import { GpsValidationResult } from '../../services/gpsService';
import { biometricService } from '../../services/biometricService';
import { notificationService } from '../../services/notificationService';
import { showErrorToast } from '../../utils/toast';
import { InstruksiPiketDadakanBanner } from '../common/InstruksiPiketDadakanBanner';

export const PiketSaya: React.FC = () => {
  const { currentUser } = useAuth();
  const { school, schedules, attendances, isOnline, pendingOfflineActions, checkIn, checkOut } = useData();

  const [selfieModalState, setSelfieModalState] = useState<{
    isOpen: boolean;
    mode: 'checkin' | 'checkout';
    schedule: any;
  }>({
    isOpen: false,
    mode: 'checkin',
    schedule: null
  });

  const [previewSelfieImage, setPreviewSelfieImage] = useState<{ url: string; title: string } | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>(notificationService.getPermission());
  const [gpsValidation, setGpsValidation] = useState<GpsValidationResult | null>(null);

  const handleGpsValidationChange = useCallback((val: GpsValidationResult | null) => {
    setGpsValidation(val);
  }, []);

  const today = getTodayDateString();
  const dayName = getDayNameIndo(today);

  // Today's schedule for me
  const myTodaySchedule = (schedules || []).find(
    (s) => s && s.tanggal === today && (s.userId === currentUser?.id || s.originalUserId === currentUser?.id)
  );

  const myAttendance = myTodaySchedule
    ? (attendances || []).find((a) => a && a.scheduleId === myTodaySchedule.id)
    : null;

  const hasPendingOfflineAction = myTodaySchedule && (pendingOfflineActions || []).some(
    (a) => a && (a.payload?.scheduleId === myTodaySchedule.id || a.payload?.attendance?.scheduleId === myTodaySchedule.id)
  );

  // History of my duties
  const myHistorySchedules = (schedules || [])
    .filter((s) => s && s.userId === currentUser?.id && Boolean(s.tanggal) && s.tanggal <= today)
    .sort((a, b) => (b?.tanggal || '').localeCompare(a?.tanggal || ''));

  const handleOpenSelfieModal = (mode: 'checkin' | 'checkout', schedule: any) => {
    // Strict Location Check for Check-in (can be bypassed for checkout or if inside radius)
    if (mode === 'checkin' && gpsValidation && !gpsValidation.isWithinRadius) {
      showErrorToast(
        `Presensi Terkunci: Anda berada ${gpsValidation.distanceMeters}m dari sekolah (Maksimal ${gpsValidation.maxRadiusMeters}m). Silakan mendekat ke area sekolah.`
      );
      return;
    }

    setSelfieModalState({
      isOpen: true,
      mode,
      schedule
    });
  };

  const handleEnablePushNotifications = async () => {
    const res = await notificationService.requestPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      notificationService.sendNotification('🎉 Notifikasi Pengingat Piket Aktif!', {
        body: 'Anda akan menerima pengingat otomatis 1 jam (H-60m) dan 15 menit (H-15m) sebelum giliran piket dimulai.'
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Notification Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Presensi Piket Saya (Digital &amp; GPS)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Presensi kehadiran piket dengan koordinat GPS akurat dan proteksi geofencing lokasi sekolah.
          </p>
        </div>
      </div>

      {/* REAL-TIME DUTY INSTRUCTION & DADAKAN ALERT BANNER */}
      <InstruksiPiketDadakanBanner />

      {/* GPS LIVE LOCATION VALIDATOR CARD */}
      <GpsLocationValidatorCard 
        school={school} 
        onValidationChange={handleGpsValidationChange} 
      />

      {/* TODAY'S DUTY CARD */}
      {myTodaySchedule ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                Tugas Hari Ini • {dayName}, {formatDateIndo(today)}
              </span>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                {myTodaySchedule.postName}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{myTodaySchedule.shiftName} ({myTodaySchedule.jamMulai} - {myTodaySchedule.jamSelesai} WIB)</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {myTodaySchedule.status === 'sedang_bertugas' ? (
                <button
                  onClick={async () => {
                    const res = await checkOut(myTodaySchedule.id, 'Selesai piket');
                    alert(res.message);
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ABSEN SELESAI PIKET</span>
                </button>
              ) : myTodaySchedule.status === 'sudah_checkout' ? (
                <div className="px-5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Sudah Selesai Check-out</span>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    if (gpsValidation && !gpsValidation.isWithinRadius) {
                      showErrorToast(
                        `Presensi Terkunci: Anda berada ${gpsValidation.distanceMeters}m dari sekolah (Maksimal ${gpsValidation.maxRadiusMeters}m). Silakan mendekat ke area sekolah.`
                      );
                      return;
                    }
                    const res = await checkIn(myTodaySchedule.id, 'Absen Mulai Piket');
                    alert(res.message);
                  }}
                  className={`w-full sm:w-auto px-7 py-3.5 text-white font-extrabold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm active:scale-95 cursor-pointer ${
                    gpsValidation && !gpsValidation.isWithinRadius
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 shadow-rose-600/30 hover:from-rose-700 hover:to-amber-700'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/30'
                  }`}
                >
                  {gpsValidation && !gpsValidation.isWithinRadius ? (
                    <>
                      <Lock className="w-5 h-5 text-amber-200" />
                      <span>CHECK-IN TERKUNCI ({gpsValidation.distanceMeters}M DARI SEKOLAH)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>ABSEN MULAI PIKET</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Info Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Petugas Terjadwal</span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">{myTodaySchedule.userName}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentUser?.jabatan}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Status Presensi</span>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                {myTodaySchedule.status === 'sedang_bertugas' ? '✅ Sedang Bertugas di Pos' :
                 myTodaySchedule.status === 'sudah_checkout' ? '🏁 Telah Check-Out' :
                 myTodaySchedule.status === 'terlambat' ? '⚠️ Terlambat Check-In' : '⏳ Menunggu Check-In'}
              </p>
              {myAttendance?.checkInAt && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Check-In: {formatTimeIndo(myAttendance.checkInAt)}
                </p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Proteksi Kehadiran</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>GPS Lock & Anti-Spoofing</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-300 font-medium mt-1">
                <Fingerprint className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>WebAuthn Biometrik {myAttendance?.biometricVerified ? '✓ Terverifikasi' : 'Tersedia'}</span>
              </div>
            </div>
          </div>

          {/* Offline Queue Sync Alert */}
          {hasPendingOfflineAction && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <div>
                  <p className="font-bold">Data Kehadiran Tersimpan di Antrean Offline (IndexedDB)</p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    Data presensi selfie Anda tersimpan aman dan otomatis diunggah ke Firebase Cloud segera setelah perangkat terhubung kembali ke internet.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-extrabold text-[10px] shrink-0">
                Antrean Aktif ⏳
              </span>
            </div>
          )}

          {myTodaySchedule.isReplacement && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
              <strong>Tugas Pengganti:</strong> Anda ditugaskan menggantikan <strong>{myTodaySchedule.originalUserName}</strong>. Alasan: {myTodaySchedule.replacementReason}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Tidak Ada Tugas Piket Hari Ini</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Anda sedang tidak terjadwal piket pada tanggal {formatDateIndo(today)}.
            </p>
          </div>
        </div>
      )}

      {/* ALL TODAY'S PICKETS PRESENCE LIST FOR TEACHERS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daftar Rekan Guru Piket Hari Ini ({formatDateIndo(today)})</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring presensi seluruh petugas piket aktif hari ini</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {schedules.filter((s) => s.tanggal === today).map((sch) => {
            const att = attendances.find((a) => a.scheduleId === sch.id);
            const isMe = sch.userId === currentUser?.id;
            return (
              <div
                key={sch.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isMe ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-400/30' : 'bg-slate-50/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">{sch.postName}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    sch.status === 'sedang_bertugas' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                    sch.status === 'sudah_checkout' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' :
                    sch.status === 'terlambat' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {sch.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {sch.userName} {isMe && <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">(Saya)</span>}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{sch.shiftName} ({sch.jamMulai} - {sch.jamSelesai})</p>

                <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>Masuk: {att?.checkInAt ? formatTimeIndo(att.checkInAt).split(' ')[0] : '-'}</span>
                  <span>Keluar: {att?.checkOutAt ? formatTimeIndo(att.checkOutAt).split(' ')[0] : '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MY DUTY HISTORY */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat Presensi Piket Saya</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Pos Piket</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Durasi</th>
                <th className="py-3 px-4">Foto Selfie</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {myHistorySchedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400 dark:text-slate-500">
                    Belum ada riwayat piket.
                  </td>
                </tr>
              ) : (
                myHistorySchedules.map((sch) => {
                  const att = attendances.find((a) => a.scheduleId === sch.id);
                  const badge = getStatusBadgeColor(sch.status);
                  const selfiePhoto = att?.fotoCheckIn || att?.fotoCheckOut;
                  return (
                    <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{formatDateIndo(sch.tanggal)}</td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">{sch.postName}</td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{sch.shiftName || `${sch.jamMulai} - ${sch.jamSelesai}`}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {att?.checkInAt ? formatTimeIndo(att.checkInAt) : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {att?.checkOutAt ? formatTimeIndo(att.checkOutAt) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {att?.durasiMenit ? `${att.durasiMenit} menit` : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {selfiePhoto ? (
                          <button
                            onClick={() => setPreviewSelfieImage({ url: selfiePhoto, title: `Foto Presensi: ${sch.userName} (${formatDateIndo(sch.tanggal)})` })}
                            className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold text-[11px] cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Lihat Foto</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHOTO PREVIEW MODAL */}
      {previewSelfieImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-5 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{previewSelfieImage.title}</h3>
              <button onClick={() => setPreviewSelfieImage(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
              <img src={previewSelfieImage.url} alt="Selfie Presensi" className="w-full h-auto object-cover" />
            </div>
            <button
              onClick={() => setPreviewSelfieImage(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer transition"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}

      {/* REALTIME SELFIE & GPS CAMERA MODAL */}
      {selfieModalState.isOpen && selfieModalState.schedule && (
        <SelfieCameraModal
          schedule={selfieModalState.schedule}
          mode={selfieModalState.mode}
          onClose={() => setSelfieModalState({ isOpen: false, mode: 'checkin', schedule: null })}
          onSuccess={() => {}}
        />
      )}

    </div>
  );
};
