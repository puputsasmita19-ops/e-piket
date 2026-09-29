import React, { useState, useEffect } from 'react';
import { Bell, Send, MessageSquare, Settings, CheckCircle2, AlertCircle, Clock, Users, Smartphone } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { showSuccessToast } from '../../utils/toast';

export const NotifikasiModule: React.FC = () => {
  const { currentRole, currentUser } = useAuth();
  const { 
    notifications, 
    markNotificationAsRead, 
    systemSettings, 
    updateSystemSettings, 
    sendCustomWhatsApp,
    users 
  } = useData();

  const [activeTab, setActiveTab] = useState<'feed' | 'whatsapp'>(() => {
    try {
      const saved = localStorage.getItem('e_piket_notifikasi_tab');
      if (saved && ['feed', 'whatsapp'].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return 'feed';
  });

  useEffect(() => {
    try {
      localStorage.setItem('e_piket_notifikasi_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);
  const [waTargetPhone, setWaTargetPhone] = useState('081234567803');
  const [waCustomMessage, setWaCustomMessage] = useState(systemSettings.whatsApp.templatePagi);
  const [blastStatus, setBlastStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [sending, setSending] = useState(false);

  // Form for WA settings
  const [waConfig, setWaConfig] = useState(systemSettings.whatsApp);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveWaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSystemSettings({ whatsApp: waConfig });
    setSaveSuccess(true);
    showSuccessToast('Pengaturan WhatsApp Gateway berhasil disimpan!');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSendTestWA = async () => {
    setSending(true);
    setBlastStatus(null);
    const res = await sendCustomWhatsApp(waTargetPhone, waCustomMessage);
    setBlastStatus(res);
    setSending(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Pusat Notifikasi & WhatsApp Gateway
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Pemberitahuan pengingat jadwal piket, check-in terlambat, serah terima, dan integrasi broadcast WA.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'feed'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Daftar Notifikasi Sistem ({notifications.length})</span>
        </button>

        {currentRole === 'admin' && (
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Pengaturan WhatsApp Gateway</span>
          </button>
        )}
      </div>

      {/* NOTIFICATION FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              Tidak ada notifikasi baru.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markNotificationAsRead(n.id)}
                className={`p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-xs transition-all flex items-start gap-3 cursor-pointer ${
                  !n.read 
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30 ring-1 ring-emerald-500/20' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{formatTimeIndo(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                </div>
                {!n.read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0 mt-1"></span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* WHATSAPP GATEWAY CONFIGURATION */}
      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Settings Form */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Konfigurasi Gateway WhatsApp</h3>
            
            <form onSubmit={handleSaveWaConfig} className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Status Gateway WhatsApp</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waConfig.isEnabled}
                    onChange={(e) => setWaConfig({ ...waConfig, isEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Provider Gateway</label>
                <input
                  type="text"
                  value={waConfig.gatewayProvider}
                  onChange={(e) => setWaConfig({ ...waConfig, gatewayProvider: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">API Secret Key</label>
                <input
                  type="password"
                  value={waConfig.apiKey}
                  onChange={(e) => setWaConfig({ ...waConfig, apiKey: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Pengingat Pagi (WIB)</label>
                  <input
                    type="time"
                    value={waConfig.reminderPagiTime}
                    onChange={(e) => setWaConfig({ ...waConfig, reminderPagiTime: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Pengingat H-1 Malam</label>
                  <input
                    type="time"
                    value={waConfig.reminderMalamTime}
                    onChange={(e) => setWaConfig({ ...waConfig, reminderMalamTime: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Template Pesan Pengingat Pagi</label>
                <textarea
                  rows={4}
                  value={waConfig.templatePagi}
                  onChange={(e) => setWaConfig({ ...waConfig, templatePagi: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono"
                />
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Pengaturan WhatsApp Gateway berhasil disimpan!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                Simpan Konfigurasi WhatsApp
              </button>
            </form>
          </div>

          {/* Test Dispatcher Simulator */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Uji Kirim Pesan WhatsApp (Simulator)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lakukan tes pengiriman notifikasi instan ke nomor guru untuk verifikasi koneksi gateway.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Pilih Guru / Nomor Tujuan</label>
                <select
                  value={waTargetPhone}
                  onChange={(e) => setWaTargetPhone(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.nomorHP}>
                      {u.nama} ({u.nomorHP})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">Isi Pesan WhatsApp</label>
                <textarea
                  rows={6}
                  value={waCustomMessage}
                  onChange={(e) => setWaCustomMessage(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-sans"
                />
              </div>

              {blastStatus && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  blastStatus.success ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                }`}>
                  {blastStatus.message}
                </div>
              )}

              <button
                type="button"
                onClick={handleSendTestWA}
                disabled={sending}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Send className="w-4 h-4 text-emerald-400" />
                <span>{sending ? 'Mengirim...' : 'Kirim Pesan WhatsApp Sekarang'}</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
