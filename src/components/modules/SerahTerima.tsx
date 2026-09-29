import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Plus, CheckCircle2, Clock, MapPin, Bell, Volume2, Send, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Handover } from '../../types';
import { getTodayDateString } from '../../services/seedData';
import { formatDateIndo } from '../../utils/formatters';
import { notificationService } from '../../services/notificationService';
import { RunningText } from '../common/RunningText';
import { showSuccessToast } from '../../utils/toast';

export const SerahTerima: React.FC = () => {
  const { currentUser } = useAuth();
  const { posts, users, handovers, createHandover, updateHandover, deleteHandover, acknowledgeHandover } = useData();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingHandover, setEditingHandover] = useState<Handover | null>(null);
  const [selectedHandoverAck, setSelectedHandoverAck] = useState<Handover | null>(null);
  const [ackNotes, setAckNotes] = useState('');

  // Push notification permission state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => 
    notificationService.getPermission()
  );
  const [pushSentToast, setPushSentToast] = useState<{ recipientName: string; postName: string } | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<{
    toUserId: string;
    toUserName: string;
    fromUserName: string;
    postName: string;
    kondisiPos: string;
    waktu: string;
  } | null>(null);

  // Form State
  const [formPostId, setFormPostId] = useState(posts[0]?.id || '');
  const [formToUserId, setFormToUserId] = useState(users.find((u) => u.id !== currentUser?.id)?.id || '');
  const [formKondisiPos, setFormKondisiPos] = useState('');
  const [formKejadianBerlangsung, setFormKejadianBerlangsung] = useState('');
  const [formSiswaPerhatian, setFormSiswaPerhatian] = useState('');
  const [formPending, setFormPending] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const today = getTodayDateString();

  // Listen to incoming push notification event
  useEffect(() => {
    const handlePushReceived = (e: any) => {
      const detail = e.detail;
      if (detail && (!currentUser || detail.toUserId === currentUser.id || currentUser.role === 'admin')) {
        setIncomingAlert(detail);
      }
    };

    window.addEventListener('handover_push_received', handlePushReceived);
    return () => {
      window.removeEventListener('handover_push_received', handlePushReceived);
    };
  }, [currentUser]);

  const handleRequestPushPermission = async () => {
    const perm = await notificationService.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      notificationService.sendNotification('🔔 Notifikasi Browser e-Piket Aktif', {
        body: 'Anda akan menerima pengingat otomatis saat ada serah terima tugas piket.'
      });
    }
  };

  const handleTestNotification = () => {
    const toUser = users.find((u) => u.id === formToUserId) || users[0];
    notificationService.sendHandoverPushNotification({
      toUserId: toUser.id,
      toUserName: toUser.nama,
      fromUserName: currentUser?.nama || 'Petugas Piket',
      postName: posts.find((p) => p.id === formPostId)?.namaPos || 'Pos 1 (Gerbang Utama)',
      kondisiPos: 'Kondisi pos tertib, kunci lengkap di laci.',
      waktu: '10:00'
    });
  };

  const handleCreateHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    try {
      const postObj = posts.find((p) => p.id === formPostId);
      const toUserObj = users.find((u) => u.id === formToUserId);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      await createHandover({
        scheduleId: `sch-handover-${Date.now()}`,
        postId: formPostId,
        postName: postObj?.namaPos || 'Pos Piket',
        tanggal: today,
        waktu: timeStr,
        fromUserId: currentUser.id,
        fromUserName: currentUser.nama,
        toUserId: formToUserId,
        toUserName: toUserObj?.nama || 'Petugas Pengganti',
        kondisiPos: formKondisiPos,
        kejadianBerlangsung: formKejadianBerlangsung,
        siswaPerhatian: formSiswaPerhatian,
        tindakLanjutPending: formPending,
        catatanTambahan: formCatatan,
        status: 'diserahkan'
      });

      // Show toast confirmation of push notification dispatch
      setPushSentToast({
        recipientName: toUserObj?.nama || 'Petugas Penerima',
        postName: postObj?.namaPos || 'Pos Piket'
      });
      setTimeout(() => setPushSentToast(null), 5000);

      // Reset form
      setFormKondisiPos('');
      setFormKejadianBerlangsung('');
      setFormSiswaPerhatian('');
      setFormPending('');
      setFormCatatan('');
      setShowCreateModal(false);
      showSuccessToast('Berita acara serah terima tugas piket berhasil disimpan!');
    } catch (err) {
      console.error('Create handover error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAcknowledge = async () => {
    if (!selectedHandoverAck) return;
    setSubmitting(true);
    await acknowledgeHandover(selectedHandoverAck.id, ackNotes || 'Tugas telah diterima dengan baik.');
    setSubmitting(false);
    setSelectedHandoverAck(null);
    setAckNotes('');
    setIncomingAlert(null);
    showSuccessToast('Konfirmasi penerimaan tugas piket berhasil disimpan!');
  };

  const targetRecipient = users.find((u) => u.id === formToUserId);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Serah Terima Tugas Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Estafet tugas antar petugas pos piket dengan pengingat otomatis (push notification) ke guru shift berikutnya.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTestNotification}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs transition cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Uji simulasi suara dan notifikasi pop-up"
          >
            <Volume2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Uji Push Notifikasi</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ SERAHKAN TUGAS</span>
          </button>
        </div>
      </div>

      {/* Push Notification Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            notifPermission === 'granted' 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
          }`}>
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">Status Pengingat Otomatis (Push Notification):</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                notifPermission === 'granted'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {notifPermission === 'granted' ? '🟢 Aktif' : '⚠️ Perlu Izin Browser'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              {notifPermission === 'granted'
                ? 'Guru penerima tugas akan menerima notifikasi suara dan pop-up otomatis di perangkat saat estafet tugas dibuat.'
                : 'Izinkan notifikasi browser agar Anda dapat menerima pemberitahuan otomatis saat tugas piket dialihkan ke Anda.'}
            </p>
          </div>
        </div>

        {notifPermission !== 'granted' && (
          <button
            onClick={handleRequestPushPermission}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition shrink-0"
          >
            Aktifkan Notifikasi Sekarang
          </button>
        )}
      </div>

      {/* Floating Success Toast when push notification is dispatched */}
      {pushSentToast && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
            <span>
              ⚡ <strong>Pengingat Otomatis Berhasil Dikirim!</strong> Push notification instan dan nada panggil telah dikirimkan ke HP/Laptop <strong>{pushSentToast.recipientName}</strong> untuk penugasan di <strong>{pushSentToast.postName}</strong>.
            </span>
          </div>
          <button
            onClick={() => setPushSentToast(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Incoming Handover Push Banner (Realtime alert) */}
      {incomingAlert && (
        <div className="p-4 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/60 dark:to-emerald-950/60 border border-teal-300 dark:border-teal-800 rounded-2xl text-slate-800 dark:text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-teal-600 text-white shadow-xs shrink-0 mt-0.5">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <p className="font-bold text-teal-900 dark:text-teal-200 text-sm">
                Pemberitahuan: Serah Terima Tugas Piket Masuk!
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                <strong>{incomingAlert.fromUserName}</strong> telah mengalihkan tugas piket di <strong>{incomingAlert.postName}</strong> (Pukul {incomingAlert.waktu} WIB).
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
                Kondisi Pos: "{incomingAlert.kondisiPos}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => {
                const handover = handovers.find((h) => h.toUserId === incomingAlert.toUserId) || handovers[0];
                if (handover) setSelectedHandoverAck(handover);
                setIncomingAlert(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition"
            >
              Konfirmasi Penerimaan
            </button>
            <button
              onClick={() => setIncomingAlert(null)}
              className="px-2.5 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* HANDOVER LIST */}
      <div className="space-y-4">
        {handovers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
            <ArrowRightLeft className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Belum Ada Catatan Serah Terima</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Serah terima dibuat oleh petugas piket yang akan berganti giliran shift pos.
            </p>
          </div>
        ) : (
          handovers.map((h) => {
            const isTargetUser = h.toUserId === currentUser?.id;
            const isWaitingAck = h.status === 'diserahkan' || h.status === 'menunggu';

            return (
              <div
                key={h.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0 max-w-md">
                    <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                      <ArrowRightLeft className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{h.postName}</h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="shrink-0">Dari:</span>
                        <RunningText text={h.fromUserName} maxLength={18} className="font-bold text-slate-700 dark:text-slate-300" />
                        <span className="shrink-0">➔ Ke:</span>
                        <RunningText text={h.toUserName} maxLength={18} className="font-bold text-slate-700 dark:text-slate-300" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      {formatDateIndo(h.tanggal)} • {h.waktu} WIB
                    </span>
                    {h.status === 'diterima' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Sudah Diterima
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Menunggu Konfirmasi
                      </span>
                    )}

                    <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingHandover(h)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Edit Serah Terima"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Apakah Anda yakin ingin menghapus catatan serah terima di ${h.postName}?`)) {
                            await deleteHandover(h.id);
                            showSuccessToast('Serah terima berhasil dihapus.');
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Hapus Serah Terima"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Handover Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-1">
                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Kondisi Pos Saat Serah Terima</span>
                    <p className="text-slate-800 dark:text-slate-200">{h.kondisiPos}</p>
                  </div>

                  {h.tindakLanjutPending && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-1">
                      <span className="font-bold text-amber-900 dark:text-amber-300 uppercase text-[10px]">Catatan / Tugas Pending</span>
                      <p className="text-amber-950 dark:text-amber-200 font-medium">{h.tindakLanjutPending}</p>
                    </div>
                  )}
                </div>

                {h.siswaPerhatian && (
                  <div className="p-2.5 bg-teal-50/70 dark:bg-teal-950/40 rounded-xl text-xs text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                    <strong>Siswa yang Perlu Perhatian:</strong> <RunningText text={h.siswaPerhatian} maxLength={28} />
                  </div>
                )}

                {/* Acceptance Info */}
                {h.status === 'diterima' && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300">
                        Diterima oleh {h.toUserName} pada {formatDateIndo(h.acknowledgedAt || h.tanggal)}:
                      </strong>
                      <span>{h.acknowledgementNotes || 'Tugas telah diterima dan dilanjutkan.'}</span>
                    </div>
                  </div>
                )}

                {/* Action for incoming officer */}
                {isTargetUser && isWaitingAck && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                      👉 Anda adalah petugas penerima shift ini.
                    </span>
                    <button
                      onClick={() => setSelectedHandoverAck(h)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Konfirmasi Terima Tugas</span>
                    </button>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* CREATE HANDOVER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Form Serah Terima Tugas Piket</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Informative Push Notification Banner inside Modal */}
            <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Bell className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 animate-pulse" />
                <span>Pengingat Otomatis (Web Push Notification) Aktif</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Sistem akan secara instan membunyikan nada panggil & memunculkan notifikasi pop-up di layar laptop/HP <strong>{targetRecipient?.nama || 'petugas penerima'}</strong> begitu Anda menekan tombol kirim.
              </p>
            </div>

            <form onSubmit={handleCreateHandoverSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Pos Piket
                  </label>
                  <select
                    value={formPostId}
                    onChange={(e) => setFormPostId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {posts.map((p) => (
                      <option key={p.id} value={p.id}>{p.namaPos}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Petugas Penerima Shift
                  </label>
                  <select
                    value={formToUserId}
                    onChange={(e) => setFormToUserId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {users
                      .filter((u) => u.id !== currentUser?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.nama} ({u.role.toUpperCase()})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Kondisi Pos Saat Ini <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formKondisiPos}
                  onChange={(e) => setFormKondisiPos(e.target.value)}
                  placeholder="Contoh: Gerbang terkunci, kunci disimpan di laci meja pos, buku tamu terisi 3 orang..."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Siswa yang Perlu Perhatian / Pemantauan
                </label>
                <input
                  type="text"
                  value={formSiswaPerhatian}
                  onChange={(e) => setFormSiswaPerhatian(e.target.value)}
                  placeholder="Contoh: Nabila (8C) - izin pulang sakit dijemput jam 11.00"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Tugas / Tindak Lanjut Pending
                </label>
                <input
                  type="text"
                  value={formPending}
                  onChange={(e) => setFormPending(e.target.value)}
                  placeholder="Contoh: Tolong cek surat izin penjemputan dari orang tua siswa"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Contoh: Kamera CCTV pos dalam kondisi prima"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Menyerahkan & Mengirim Notifikasi...' : 'Kirim Serah Terima & Push Notif'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT HANDOVER MODAL */}
      {editingHandover && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Catatan Serah Terima</h3>
              <button
                onClick={() => setEditingHandover(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingHandover) return;
                await updateHandover(editingHandover.id, {
                  kondisiPos: editingHandover.kondisiPos,
                  tindakLanjutPending: editingHandover.tindakLanjutPending,
                  siswaPerhatian: editingHandover.siswaPerhatian,
                  catatanTambahan: editingHandover.catatanTambahan
                });
                setEditingHandover(null);
                showSuccessToast('Data serah terima berhasil diperbarui.');
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Kondisi Pos
                </label>
                <textarea
                  required
                  rows={2}
                  value={editingHandover.kondisiPos}
                  onChange={(e) => setEditingHandover({ ...editingHandover, kondisiPos: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Siswa yang Perlu Perhatian
                </label>
                <input
                  type="text"
                  value={editingHandover.siswaPerhatian || ''}
                  onChange={(e) => setEditingHandover({ ...editingHandover, siswaPerhatian: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Tugas Pending
                </label>
                <input
                  type="text"
                  value={editingHandover.tindakLanjutPending || ''}
                  onChange={(e) => setEditingHandover({ ...editingHandover, tindakLanjutPending: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingHandover(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACKNOWLEDGE MODAL */}
      {selectedHandoverAck && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Konfirmasi Terima Tugas</h3>
              <button
                onClick={() => setSelectedHandoverAck(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <p>Menerima tugas dari <strong>{selectedHandoverAck.fromUserName}</strong> di <strong>{selectedHandoverAck.postName}</strong>.</p>
              {selectedHandoverAck.tindakLanjutPending && (
                <p className="mt-1 font-semibold text-emerald-800 dark:text-emerald-300">
                  Tugas Pending: {selectedHandoverAck.tindakLanjutPending}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Catatan Penerimaan (Opsional)
              </label>
              <textarea
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                placeholder="Contoh: Sudah membaca dan siap melanjutkan piket sesi siang..."
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleConfirmAcknowledge}
                disabled={submitting}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {submitting ? 'Menyimpan...' : 'Saya Sudah Membaca & Menerima Tugas'}
              </button>
              <button
                onClick={() => setSelectedHandoverAck(null)}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
