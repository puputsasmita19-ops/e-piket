import React, { useState } from 'react';
import { LayoutDashboard, CalendarCheck, BookOpen, AlertTriangle, User, Layers, Menu, X, FileText, Camera, ArrowRightLeft, UserCheck, Calendar, Settings, Shield, Zap, ChevronRight, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { currentRole, currentUser, logout } = useAuth();
  const { isHapticEnabled, toggleHaptic } = useHaptic();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isAdminOrKepsek = currentRole === 'admin' || currentRole === 'kepsek';

  const mainNavItems = [
    { id: 'login', label: currentRole === 'admin' ? 'Dashboard' : 'Dashboard', icon: LayoutDashboard },
    { 
      id: isAdminOrKepsek ? 'jadwal' : 'piket-saya', 
      label: isAdminOrKepsek ? 'Jadwal' : 'Piket Saya', 
      icon: isAdminOrKepsek ? Calendar : CalendarCheck 
    },
    { id: 'buku-piket', label: 'Buku Piket', icon: BookOpen },
    { id: 'kejadian', label: 'Kejadian', icon: AlertTriangle },
  ];

  const allModules = [
    {
      group: 'Operasional Piket',
      items: [
        ...(!isAdminOrKepsek ? [
          { id: 'piket-saya', label: 'Piket Saya (Presensi Selfie)', icon: CalendarCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/60' }
        ] : []),
        { id: 'buku-piket', label: 'Buku Piket Digital', icon: BookOpen, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/60' },
        { id: 'kejadian', label: 'Catatan Kejadian & Insiden', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/60' },
        { id: 'serah-terima', label: 'Serah Terima Tugas Piket', icon: ArrowRightLeft, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/60' },
        { id: 'penggantian', label: 'Penggantian Petugas Piket', icon: UserCheck, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/60' },
      ]
    },
    {
      group: 'Laporan & Arsip',
      items: [
        { id: 'laporan', label: 'Laporan & Unduh PDF Rekap', icon: FileText, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/60' },
        { id: 'dokumentasi', label: 'Galeri Foto Dokumentasi Drive', icon: Camera, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/60' },
      ]
    },
    {
      group: 'Manajemen & Sistem',
      items: [
        { id: 'jadwal', label: 'Jadwal Piket Keseluruhan', icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/60' },
        ...(currentRole === 'admin' ? [
          { id: 'master-data', label: 'Master Data & Petugas Pos', icon: Layers, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
          { id: 'pengaturan', label: 'Pengaturan Jam & Radius Sekolah', icon: Settings, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/60' },
          { id: 'audit-log', label: 'Audit Log Aktivitas Sistem', icon: Shield, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/60' },
        ] : []),
        { id: 'profil', label: 'Profil Saya & Biometrik WebAuthn', icon: User, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/60' },
      ]
    }
  ];

  const handleSelectModule = (id: string) => {
    setActiveTab(id);
    setShowMoreMenu(false);
  };

  const isMoreActive = !mainNavItems.some((m) => m.id === activeTab);

  return (
    <>
      {/* Mobile Bottom Sheet / Drawer for All Modules */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
          <div 
            className="bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[82vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            {/* Header with pull handle */}
            <div className="pt-3 pb-2 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-emerald-500/30">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Menu e-Piket Digital</h3>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                    Akses cepat seluruh fitur aplikasi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center text-sm cursor-pointer active:scale-95 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modules List */}
            <div className="overflow-y-auto p-4 space-y-4 max-h-[65vh]">
              {allModules.map((grp, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                    {grp.group}
                  </span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {grp.items.map((item) => {
                      const Icon = item.icon;
                      const isCurrent = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectModule(item.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left border ${
                            isCurrent
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold shadow-xs'
                              : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium active:scale-[0.99]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.bg} ${item.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-semibold">{item.label}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${isCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Quick Haptic Feedback Toggle in Mobile Menu */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={toggleHaptic}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition cursor-pointer active:scale-98 ${
                    isHapticEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isHapticEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Efek Getar (Haptic Feedback)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Tekan untuk beralih On / Off</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                    isHapticEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                  }`}>
                    {isHapticEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Direct Logout Option in Drawer */}
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-extrabold text-xs transition cursor-pointer active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span>Keluar dari Aplikasi (Logout)</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Ergonomic Bottom Navigation Bar */}
      <nav 
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/90 dark:border-slate-800 shadow-2xl px-2 pt-1 transition-colors duration-200"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setShowMoreMenu(false);
                }}
                className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-2xl transition-all relative cursor-pointer min-w-[56px] ${
                  isActive 
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-600 dark:text-emerald-400 scale-110 shadow-xs' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-semibold">{item.label}</span>
                {isActive && (
                  <span className="absolute -top-1 w-6 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                )}
              </button>
            );
          })}

          {/* More Menu Trigger */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-2xl transition-all relative cursor-pointer min-w-[56px] ${
              isMoreActive 
                ? 'text-emerald-600 dark:text-emerald-400 font-bold' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${isMoreActive ? 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-600 dark:text-emerald-400 scale-110 shadow-xs' : ''}`}>
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-semibold">Menu</span>
            {isMoreActive && (
              <span className="absolute -top-1 w-6 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
};
