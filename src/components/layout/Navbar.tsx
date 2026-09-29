import React, { useState, useEffect, useRef } from 'react';
import { Bell, Wifi, WifiOff, LogOut, ChevronDown, User as UserIcon, ShieldCheck, Zap, School as SchoolIcon, RefreshCw, Sun, Moon, Smartphone, Volume2, VolumeX, Compass, PanelLeftClose, PanelLeftOpen, Flame, HardDrive } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useHaptic } from '../../hooks/useHaptic';
import { NotificationDropdown } from './NotificationDropdown';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { RunningText } from '../common/RunningText';

interface NavbarProps {
  onOpenAISummary?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarHidden?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAISummary, setActiveTab, isSidebarHidden = false, onToggleSidebar }) => {
  const { currentUser, currentRole, logout, isGoogleDriveConnected } = useAuth();
  const { 
    school, 
    systemSettings, 
    isOnline, 
    isFirestoreConnected
  } = useData();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isHapticEnabled, toggleHaptic } = useHaptic();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // References for click-outside and auto-close timers
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-close handlers for user dropdown
  const startUserTimer = () => {
    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    userTimerRef.current = setTimeout(() => setShowUserDropdown(false), 5000);
  };
  const clearUserTimer = () => {
    if (userTimerRef.current) {
      clearTimeout(userTimerRef.current);
      userTimerRef.current = null;
    }
  };

  // Handle click outside for user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearUserTimer();
    };
  }, []);

  useEffect(() => {
    if (showUserDropdown) {
      startUserTimer();
    } else {
      clearUserTimer();
    }
  }, [showUserDropdown]);

  const appName = systemSettings?.appBranding?.namaAplikasi || 'e-Piket Digital';
  const logoUrl = systemSettings?.appBranding?.logoUrl;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-2">
          
          {/* Left: Brand & School (Compact & Ergonomic for 1 Screen View) */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
            {/* Desktop Sidebar Toggle Button (Freeze & Hide ergonomics) */}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                title={isSidebarHidden ? "Tampilkan Panel Menu (Ctrl+B)" : "Sembunyikan Panel Menu (Ctrl+B)"}
                className="hidden lg:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-all active:scale-95 cursor-pointer shrink-0"
                aria-label="Toggle Panel Menu"
              >
                {isSidebarHidden ? (
                  <PanelLeftOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
              </button>
            )}

            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20 font-extrabold text-sm sm:text-base shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 object-contain rounded-lg" />
              ) : (
                <SchoolIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 dark:text-white tracking-tight text-xs xs:text-sm sm:text-base md:text-lg truncate">
                  {appName}
                </span>
                <span className="hidden md:inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                  v2.6
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] md:max-w-xs">
                {school.nama}
              </p>
            </div>
          </div>

          {/* Right Actions: Ergonomic, Compact Icons Fitting 1 Screen Width */}
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
            
            {/* PWA Install Button */}
            <PWAInstallButton className="hidden sm:inline-flex" />

            {/* Online/Offline Status Indicator (Compact dot on mobile, full pill on md+) */}
            <div 
              title={isOnline ? 'Online Sync: Terhubung ke Firebase' : 'Offline: Menggunakan Antrean IndexedDB'}
              className={`flex items-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1 rounded-xl text-xs font-semibold border shrink-0 transition-colors ${
                isOnline 
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800/80 dark:text-emerald-300' 
                  : 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200 font-bold'
              }`}
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="hidden md:inline text-[11px] font-bold">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden md:inline text-[11px] font-bold">Offline</span>
                </>
              )}
            </div>

            {/* AI Executive Summary Button (for Kepsek / Admin) */}
            {(currentRole === 'kepsek' || currentRole === 'admin') && onOpenAISummary && (
              <button
                onClick={onOpenAISummary}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Generate AI Ringkasan Harian Pimpinan"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden md:inline">AI Ringkasan</span>
              </button>
            )}

            {/* Instant Dark / Light Mode Switch Button in Header */}
            <button
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              ) : (
                <Moon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-600/10" />
              )}
            </button>

            {/* Instant Haptic Feedback On/Off Toggle Button in Header for ALL Roles */}
            <button
              onClick={toggleHaptic}
              aria-label={isHapticEnabled ? 'Matikan Efek Getar (Haptic)' : 'Aktifkan Efek Getar (Haptic)'}
              title={isHapticEnabled ? 'Efek Getar (Haptic): AKTIF (Klik untuk Matikan)' : 'Efek Getar (Haptic): NONAKTIF (Klik untuk Aktifkan)'}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 cursor-pointer shrink-0 ${
                isHapticEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700'
                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              <Smartphone className={`w-4 h-4 ${isHapticEnabled ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            </button>

            {/* Direct Prominent Logout Button for Admin & All Roles */}
            <button
              onClick={logout}
              title="Keluar dari Aplikasi (Logout)"
              className="w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:hover:bg-rose-900/90 dark:text-rose-200 border border-rose-200 dark:border-rose-800/80 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span className="hidden sm:inline">Keluar</span>
            </button>

            {/* Profile Avatar & Menu with auto-close */}
            <div 
              ref={userDropdownRef}
              onMouseEnter={clearUserTimer}
              onMouseLeave={() => { if (showUserDropdown) startUserTimer(); }}
              className="relative shrink-0"
            >
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 p-0.5 sm:p-1 rounded-full hover:ring-2 hover:ring-emerald-400 transition-all cursor-pointer"
              >
                {currentUser?.foto ? (
                  <img
                    src={currentUser.foto}
                    alt={currentUser.nama}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {currentUser?.nama.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden md:block max-w-[110px] lg:max-w-[130px] overflow-hidden text-left">
                  <RunningText
                    text={currentUser?.nama || 'User'}
                    maxLength={13}
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                  />
                </div>
                <ChevronDown className="hidden md:block w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <RunningText
                      text={currentUser?.nama || ''}
                      maxLength={20}
                      className="text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <p className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
                      @{currentUser?.username || currentUser?.email.split('@')[0]}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      {currentUser?.jabatan}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setActiveTab('profil'); setShowUserDropdown(false); }}
                      className="w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <span>Profil Saya</span>
                    </button>

                    {/* Haptic Toggle in Dropdown */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHaptic();
                      }}
                      className="w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Smartphone className={`w-4 h-4 ${isHapticEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                        <span>Efek Getar (Haptic)</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isHapticEnabled
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {isHapticEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        localStorage.removeItem('epiket_guided_tour_completed');
                        window.location.reload();
                      }}
                      className="w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left cursor-pointer"
                    >
                      <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Panduan Aplikasi (Tour)</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <button
                      onClick={() => { logout(); setShowUserDropdown(false); }}
                      className="w-full px-4 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-left font-semibold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};
