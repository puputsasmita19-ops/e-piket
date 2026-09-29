/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { LoginPage } from './components/auth/LoginPage';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { SecurityGuardToast } from './components/security/SecurityGuardToast';
import { GlobalToast } from './components/common/GlobalToast';
import { ExitConfirmModal } from './components/common/ExitConfirmModal';
import { ExitScreen } from './components/common/ExitScreen';
import { ScrollToTopButton } from './components/common/ScrollToTopButton';
import { GuidedTour } from './components/common/GuidedTour';
import { PullToRefresh } from './components/common/PullToRefresh';
import { notificationService } from './services/notificationService';
import { antiFraudService } from './services/antiFraudService';
import { initGlobalHapticFeedback } from './utils/feedback';
import { showSuccessToast } from './utils/toast';
import { PanelLeftOpen } from 'lucide-react';

// Lazy load modules for high-performance mobile execution & tiny initial bundle
const AdminDashboard = lazy(() => import('./components/dashboards/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const KepsekDashboard = lazy(() => import('./components/dashboards/KepsekDashboard').then(m => ({ default: m.KepsekDashboard })));
const GuruDashboard = lazy(() => import('./components/dashboards/GuruDashboard').then(m => ({ default: m.GuruDashboard })));
const PiketSaya = lazy(() => import('./components/modules/PiketSaya').then(m => ({ default: m.PiketSaya })));
const BukuPiket = lazy(() => import('./components/modules/BukuPiket').then(m => ({ default: m.BukuPiket })));
const Kejadian = lazy(() => import('./components/modules/Kejadian').then(m => ({ default: m.Kejadian })));
const SerahTerima = lazy(() => import('./components/modules/SerahTerima').then(m => ({ default: m.SerahTerima })));
const PenggantianPetugas = lazy(() => import('./components/modules/PenggantianPetugas').then(m => ({ default: m.PenggantianPetugas })));
const JadwalPiket = lazy(() => import('./components/modules/JadwalPiket').then(m => ({ default: m.JadwalPiket })));
const MasterData = lazy(() => import('./components/modules/MasterData').then(m => ({ default: m.MasterData })));
const Laporan = lazy(() => import('./components/modules/Laporan').then(m => ({ default: m.Laporan })));
const Dokumentasi = lazy(() => import('./components/modules/Dokumentasi').then(m => ({ default: m.Dokumentasi })));
const NotifikasiModule = lazy(() => import('./components/modules/NotifikasiModule').then(m => ({ default: m.NotifikasiModule })));
const AuditLogModule = lazy(() => import('./components/modules/AuditLogModule').then(m => ({ default: m.AuditLogModule })));
const ProfilPengguna = lazy(() => import('./components/modules/ProfilPengguna').then(m => ({ default: m.ProfilPengguna })));
const PengaturanSistem = lazy(() => import('./components/modules/PengaturanSistem').then(m => ({ default: m.PengaturanSistem })));
const AISummaryModal = lazy(() => import('./components/modules/AISummaryModal').then(m => ({ default: m.AISummaryModal })));

const ModuleLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[260px] py-12 gap-3 text-slate-400 animate-in fade-in duration-150">
    <div className="w-8 h-8 rounded-full border-3 border-emerald-500/20 border-t-emerald-500 animate-spin" />
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Memuat modul e-Piket...</span>
  </div>
);

const VALID_TABS = [
  'dashboard',
  'piket-saya',
  'buku-piket',
  'kejadian',
  'serah-terima',
  'penggantian',
  'jadwal',
  'master-data',
  'laporan',
  'dokumentasi',
  'audit-log',
  'pengaturan',
  'profil'
];

const isTabAllowedForRole = (tab: string, role?: string | null): boolean => {
  if (!VALID_TABS.includes(tab)) return false;
  if (!role) return true;
  if (role === 'admin' || role === 'kepsek') {
    if (tab === 'piket-saya') return false;
  }
  if (role === 'kepsek') {
    return !['master-data', 'audit-log', 'pengaturan', 'piket-saya'].includes(tab);
  }
  if (role === 'admin') {
    return !['piket-saya'].includes(tab);
  }
  // guru / tendik
  return !['master-data', 'audit-log', 'pengaturan'].includes(tab);
};

const getStoredTab = (role?: string | null): string => {
  try {
    // 1. Direct URL hash (e.g. #buku-piket or #laporan)
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash && VALID_TABS.includes(hash)) {
      if (isTabAllowedForRole(hash, role)) return hash;
    }

    // 2. SessionStorage (preserves exact active page on browser refresh/reload in same tab)
    const sessionSaved = sessionStorage.getItem('e_piket_active_tab');
    if (sessionSaved && VALID_TABS.includes(sessionSaved)) {
      if (isTabAllowedForRole(sessionSaved, role)) return sessionSaved;
    }

    // 3. LocalStorage primary active tab
    const saved = localStorage.getItem('e_piket_active_tab');
    if (saved && VALID_TABS.includes(saved)) {
      if (isTabAllowedForRole(saved, role)) return saved;
    }

    // 4. LocalStorage backup key
    const backupSaved = localStorage.getItem('e_piket_last_active_tab');
    if (backupSaved && VALID_TABS.includes(backupSaved)) {
      if (isTabAllowedForRole(backupSaved, role)) return backupSaved;
    }
  } catch (e) {
    console.warn('Storage/hash error:', e);
  }
  return 'dashboard';
};

const MainLayout: React.FC = () => {
  const { isAuthenticated, currentRole, currentUser, logout } = useAuth();
  const { schedules, systemSettings, checkCloudStatus, triggerSyncOfflineActions } = useData();
  const [activeTab, setActiveTabState] = useState<string>(() => getStoredTab(currentRole));
  const [showAISummary, setShowAISummary] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isAppExited, setIsAppExited] = useState(false);
  const [devToolsActive, setDevToolsActive] = useState(false);

  const handlePullRefresh = async () => {
    try {
      await Promise.all([
        checkCloudStatus?.(),
        triggerSyncOfflineActions?.()
      ]);
      showSuccessToast('Data aplikasi & koneksi Cloud berhasil disegarkan!');
    } catch (e) {
      console.warn('Pull refresh error:', e);
    }
  };

  // Desktop Sidebar visibility state (persisted across page reloads)
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('e_piket_desktop_sidebar_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarHidden = useCallback(() => {
    setIsSidebarHidden(prev => {
      const next = !prev;
      try {
        localStorage.setItem('e_piket_desktop_sidebar_hidden', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle desktop sidebar hide/show
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarHidden();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarHidden]);

  // Tab switcher that maintains URL hash, sessionStorage & localStorage persistence
  const setActiveTab = useCallback((tab: string) => {
    if (!VALID_TABS.includes(tab)) return;
    setActiveTabState(tab);
    try {
      localStorage.setItem('e_piket_active_tab', tab);
      localStorage.setItem('e_piket_last_active_tab', tab);
      sessionStorage.setItem('e_piket_active_tab', tab);
      if (window.location.hash !== `#${tab}`) {
        window.history.pushState({ app: 'e-piket', tab }, '', `#${tab}`);
      }
    } catch (e) {
      console.warn('Failed to update tab in storage:', e);
    }
  }, []);

  // Keep storage and URL hash in sync with activeTab on initial mount and state changes
  useEffect(() => {
    try {
      localStorage.setItem('e_piket_active_tab', activeTab);
      localStorage.setItem('e_piket_last_active_tab', activeTab);
      sessionStorage.setItem('e_piket_active_tab', activeTab);
      
      const currentHash = window.location.hash.replace(/^#\/?/, '').trim();
      if (currentHash !== activeTab) {
        window.history.replaceState({ app: 'e-piket', tab: activeTab }, '', `#${activeTab}`);
      }
    } catch (e) {}
  }, [activeTab]);

  // Safeguard: redirect to dashboard if current tab is restricted for user's role
  useEffect(() => {
    if (currentRole && !isTabAllowedForRole(activeTab, currentRole)) {
      setActiveTab('dashboard');
    }
  }, [currentRole, activeTab, setActiveTab]);

  // Listen for browser/manual hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash && VALID_TABS.includes(hash) && hash !== activeTab) {
        if (isTabAllowedForRole(hash, currentRole)) {
          setActiveTabState(hash);
          try {
            localStorage.setItem('e_piket_active_tab', hash);
            localStorage.setItem('e_piket_last_active_tab', hash);
            sessionStorage.setItem('e_piket_active_tab', hash);
          } catch (e) {}
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [activeTab, currentRole]);

  // Smartphone Back Button Interception (popstate listener) across ALL pages
  useEffect(() => {
    const pushTrapState = () => {
      window.history.pushState({ app: 'e-piket-trap', time: Date.now() }, '', window.location.href);
    };

    // Seed initial trap state
    pushTrapState();

    const handlePopState = () => {
      // Check if back navigation targets a valid app tab
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash && VALID_TABS.includes(hash) && hash !== activeTab) {
        if (isTabAllowedForRole(hash, currentRole)) {
          setActiveTabState(hash);
          try {
            localStorage.setItem('e_piket_active_tab', hash);
            localStorage.setItem('e_piket_last_active_tab', hash);
            sessionStorage.setItem('e_piket_active_tab', hash);
          } catch (err) {}
          return;
        }
      }

      // Re-push trap state immediately to prevent browser from abruptly leaving
      pushTrapState();
      // Show exit confirmation modal across all pages
      setShowExitModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, currentRole]);

  // Initialize Anti-Fraud, Anti-Copy Paste & Security Guards
  useEffect(() => {
    initGlobalHapticFeedback();
    antiFraudService.initSecurityGuards((isOpen) => {
      setDevToolsActive(isOpen);
    });
  }, []);

  // Start background shift reminder & real-time late check-in alert daemon
  useEffect(() => {
    if (isAuthenticated) {
      notificationService.startScheduler(
        () => schedules,
        () => currentUser?.id,
        () => currentRole || undefined
      );
    }
    return () => {
      notificationService.stopScheduler();
    };
  }, [isAuthenticated, schedules, currentUser?.id, currentRole]);

  // Periodic Automated Push Notification Daemon for Non-Admin Roles (Interval: 5, 10, or 15 mins)
  useEffect(() => {
    if (!isAuthenticated || currentRole === 'admin') return;

    const intervalMins = systemSettings?.autoPushNotificationIntervalMinutes ?? 15;
    if (!intervalMins || intervalMins <= 0) return;

    const intervalMs = intervalMins * 60 * 1000;

    const fireAutoNotification = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const title = `⏰ Pengingat Piket Otomatis (${timeStr} WIB)`;
      const body = `Halo Bpk/Ibu ${currentUser?.nama || 'Petugas Piket'}, pastikan Anda memeriksa jadwal piket, check-in di pos tugas, dan mengisi entri Buku Piket Digital.`;

      // Web Push Notification to OS / Browser
      notificationService.sendNotification(title, {
        body,
        tag: `auto-push-reminder-${currentUser?.id}-${Date.now()}`
      });

      // In-app toast banner
      showSuccessToast(`${title}: ${body}`);
    };

    // First reminder after 1 minute, then repeat every configured interval (5, 10, or 15 mins)
    const initialTimer = setTimeout(() => {
      fireAutoNotification();
    }, 60000);

    const recurringTimer = setInterval(() => {
      fireAutoNotification();
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(recurringTimer);
    };
  }, [isAuthenticated, currentRole, currentUser?.id, currentUser?.nama, systemSettings?.autoPushNotificationIntervalMinutes]);

  // User confirmed exit from the app
  const handleConfirmExit = () => {
    setShowExitModal(false);
    setIsAppExited(true);
    logout();
    
    // Attempt standard browser/window close if permissible
    try {
      window.close();
    } catch (e) {}

    // Attempt hybrid app exit
    try {
      (navigator as any)?.app?.exitApp?.();
    } catch (e) {}
  };

  if (isAppExited) {
    return <ExitScreen onReopen={() => { setIsAppExited(false); setActiveTab('dashboard'); }} />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <SecurityGuardToast />
      </>
    );
  }

  // Render view based on activeTab & RBAC
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (currentRole === 'admin') {
          return <AdminDashboard setActiveTab={setActiveTab} onOpenAISummary={() => setShowAISummary(true)} />;
        }
        if (currentRole === 'kepsek') {
          return <KepsekDashboard setActiveTab={setActiveTab} onOpenAISummary={() => setShowAISummary(true)} />;
        }
        return <GuruDashboard setActiveTab={setActiveTab} />;

      case 'piket-saya':
        return <PiketSaya />;

      case 'buku-piket':
        return <BukuPiket />;

      case 'kejadian':
        return <Kejadian />;

      case 'serah-terima':
        return <SerahTerima />;

      case 'penggantian':
        return <PenggantianPetugas />;

      case 'jadwal':
        return <JadwalPiket />;

      case 'master-data':
        return <MasterData />;

      case 'laporan':
        return <Laporan />;

      case 'dokumentasi':
        return <Dokumentasi />;

      case 'audit-log':
        return <AuditLogModule />;

      case 'pengaturan':
        return <PengaturanSistem />;

      case 'profil':
        return <ProfilPengguna />;

      default:
        return <GuruDashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200">
        {/* Top Navbar */}
        <Navbar 
          onOpenAISummary={() => setShowAISummary(true)} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isSidebarHidden={isSidebarHidden}
          onToggleSidebar={toggleSidebarHidden}
        />

        <div className="flex-1 flex min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">
          {/* Desktop Sidebar Spacer to preserve grid flow with fixed sidebar */}
          <div 
            className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
              isSidebarHidden ? 'w-0' : 'w-64'
            }`} 
            aria-hidden="true" 
          />

          {/* Desktop Sidebar (Fixed position - 100% frozen, never scrolls with the page) */}
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            isHidden={isSidebarHidden}
            onToggleHide={toggleSidebarHidden}
          />

          {/* Main Content Area with Adaptive Ergonomic Width */}
          <main className={`flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 lg:pb-10 transition-all duration-300 w-full ${
            isSidebarHidden ? 'max-w-[1550px] mx-auto' : 'max-w-7xl mx-auto'
          }`}>
            <Suspense fallback={<ModuleLoadingFallback />}>
              {renderContent()}
            </Suspense>
          </main>
        </div>

        {/* Floating Button on Desktop to Quickly Restore/Unhide Sidebar Menu */}
        {isSidebarHidden && (
          <button
            onClick={toggleSidebarHidden}
            title="Tampilkan Panel Menu (Ctrl+B)"
            className="hidden lg:flex fixed left-4 bottom-5 z-40 items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-2xl backdrop-blur-md text-xs font-bold transition-all active:scale-95 cursor-pointer hover:border-emerald-500/50 group animate-in fade-in slide-in-from-left-4 duration-200"
          >
            <PanelLeftOpen className="w-4 h-4 group-hover:scale-110 transition-transform text-emerald-400 shrink-0" />
            <span>Panel Menu</span>
          </button>
        )}

        {/* Mobile Bottom Navigation */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Floating Scroll to Top Button */}
        <ScrollToTopButton />

        {/* Offline Connectivity & Sync Indicator */}
        <OfflineIndicator />

        {/* AI Executive Summary Modal */}
        {showAISummary && (
          <Suspense fallback={null}>
            <AISummaryModal onClose={() => setShowAISummary(false)} />
          </Suspense>
        )}

        {/* Smartphone Back Button Exit Confirmation Modal (Active across all pages) */}
        <ExitConfirmModal
          isOpen={showExitModal}
          onCancel={() => setShowExitModal(false)}
          onConfirmExit={handleConfirmExit}
        />

        {/* Global Success, Error & Info Action Toasts */}
        <GlobalToast />

        {/* Global Anti-Copy Paste & Security Guard Notification */}
        <SecurityGuardToast />

        {/* Guided Tour Overlay for First-Time Users */}
        <GuidedTour />
      </div>
    </PullToRefresh>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <MainLayout />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
