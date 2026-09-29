import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard, ShieldAlert, RotateCcw, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { cacheService } from '../../services/cacheService';

interface Props {
  children?: ReactNode;
  moduleName?: string;
  isModuleLevel?: boolean;
  onResetModule?: () => void;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isMasterDataError: boolean;
  showDetails: boolean;
  resetAttempt: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isMasterDataError: false,
    showDetails: false,
    resetAttempt: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isMaster = Boolean(
      this.props.moduleName?.toLowerCase().includes('master') ||
      this.props.moduleName?.toLowerCase().includes('manajemen data') ||
      error.message?.toLowerCase().includes('masterdata') ||
      error.stack?.toLowerCase().includes('masterdata') ||
      errorInfo.componentStack?.toLowerCase().includes('masterdata') ||
      (typeof window !== 'undefined' && window.location.hash.includes('master-data'))
    );

    console.error('ErrorBoundary caught exception in module [' + (this.props.moduleName || 'Root') + ']:', error, errorInfo);

    this.setState({
      errorInfo,
      isMasterDataError: isMaster
    });

    // Record error to local audit storage if possible
    try {
      if (typeof window !== 'undefined') {
        const errorLogs = JSON.parse(localStorage.getItem('epiket_error_logs') || '[]');
        errorLogs.unshift({
          timestamp: new Date().toISOString(),
          module: this.props.moduleName || (isMaster ? 'MasterData' : 'App'),
          message: error.message || String(error),
          stack: error.stack || errorInfo.componentStack || ''
        });
        localStorage.setItem('epiket_error_logs', JSON.stringify(errorLogs.slice(0, 30)));
      }
    } catch (e) {
      // Ignore logging failure
    }
  }

  /**
   * Resets this specific module without reloading the whole application.
   */
  private handleResetModule = () => {
    try {
      // Clear specific temporary UI keys that might have corrupted the module
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('e_piket_master_tab');
        sessionStorage.removeItem('e_piket_active_tab');
        localStorage.removeItem('e_piket_user_search');
        localStorage.removeItem('e_piket_post_search');
        localStorage.removeItem('e_piket_shift_search');
      }
    } catch (e) {
      console.warn('Error clearing module temp keys:', e);
    }

    if (this.props.onResetModule) {
      this.props.onResetModule();
    }

    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      resetAttempt: prev.resetAttempt + 1
    }));
  };

  /**
   * Resets active view to dashboard safely.
   */
  private handleNavigateHome = () => {
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
      this.setState({ hasError: false, error: null, errorInfo: null });
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#dashboard';
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  /**
   * Full application reload fallback.
   */
  private handleFullReload = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '#dashboard';
      window.location.reload();
    }
  };

  /**
   * Safe local cache purge and reload.
   */
  private handleClearCacheAndRecover = () => {
    try {
      cacheService.clearSafeLocalCache();
      if (typeof window !== 'undefined') {
        window.location.hash = '#dashboard';
        window.location.reload();
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      const moduleTitle = this.props.moduleName || (this.state.isMasterDataError ? 'Manajemen Data' : 'Komponen Aplikasi');
      const isMaster = this.state.isMasterDataError || this.props.moduleName?.toLowerCase().includes('master');

      // Embedded Module-Level UI (Preserves Navbar, Sidebar, and other tabs)
      if (this.props.isModuleLevel) {
        return (
          <div className="w-full p-4 sm:p-6 bg-slate-900/90 dark:bg-slate-950/95 rounded-3xl border-2 border-rose-500/40 text-white shadow-2xl animate-in fade-in zoom-in-95 space-y-5 my-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                    <span>Terjadi Kendala pada Modul {moduleTitle}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-950 text-rose-300 border border-rose-800">
                      Module Error Guard
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Komponen ini mengalami hambatan saat memproses data. Navigasi utama aplikasi tetap berjalan normal.
                  </p>
                </div>
              </div>

              {/* Action Buttons for Module Reset */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={this.handleResetModule}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Modul</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleNavigateHome}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                >
                  <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                  <span>Ke Dashboard</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {this.state.error && (
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] font-mono text-rose-300 overflow-x-auto space-y-1">
                <p className="font-bold text-slate-400">Pesan Kesalahan:</p>
                <p className="break-all">{this.state.error.toString()}</p>
              </div>
            )}

            {/* Collapsible Details */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{this.state.showDetails ? 'Sembunyikan Rincian Teknis' : 'Lihat Rincian Teknis & Rekomendasi Solusi'}</span>
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-4 bg-slate-950/90 rounded-2xl border border-slate-800 text-xs space-y-3 animate-in fade-in">
                  <div className="text-slate-300 space-y-1">
                    <p className="font-bold text-amber-400">💡 Langkah Pemulihan Cepat:</p>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11.5px]">
                      <li>Klik tombol <strong>"Reset Modul"</strong> di atas untuk mengulang inisialisasi modul {moduleTitle}.</li>
                      <li>Jika masalah tetap terjadi, buka menu <strong>Pengaturan Sistem &gt; Bersihkan Cache Lokal</strong> untuk membersihkan data filter sementara secara aman.</li>
                      <li>Data Anda di Cloud Firestore tetap tersimpan dan tidak terpengaruh.</li>
                    </ul>
                  </div>

                  {this.state.errorInfo?.componentStack && (
                    <div className="p-2.5 bg-black/50 rounded-xl border border-slate-900 text-[10px] font-mono text-slate-400 overflow-x-auto max-h-40">
                      <p className="font-bold text-slate-500 mb-1">Component Stack Trace:</p>
                      <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Root Full-Screen UI (When error affects the top-level tree)
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 antialiased">
          <div className="max-w-lg w-full bg-slate-800/95 rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Terjadi Kendala pada {isMaster ? 'Modul Manajemen Data' : 'Tampilan Aplikasi'}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sistem keamanan aktif mencegah layar putih. Anda dapat mencoba mereset modul yang bermasalah secara mandiri atau memuat ulang halaman.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-left text-[11px] font-mono text-rose-300 overflow-x-auto max-h-32">
                <p className="font-bold text-slate-400 mb-1">Rincian Diskripsi:</p>
                <p className="break-all">{this.state.error.toString()}</p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              {isMaster && (
                <button
                  type="button"
                  onClick={this.handleResetModule}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Modul MasterData</span>
                </button>
              )}

              <button
                type="button"
                onClick={this.handleFullReload}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Tampilan Aplikasi</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndRecover}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Bersihkan Cache Lokal &amp; Pulihkan</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
