import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard, ShieldAlert } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.hash = '#dashboard';
      window.location.reload();
    }
  };

  private handleClearCache = () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        window.location.reload();
      }
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 antialiased">
          <div className="max-w-md w-full bg-slate-800/90 rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Terjadi Kendala pada Tampilan
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Aplikasi mendeteksi adanya penyesuaian memori atau kegagalan memuat modul. Sistem keamanan aktif mencegah tampilan layar putih.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-left text-[11px] font-mono text-rose-300 overflow-x-auto max-h-32">
                <p className="font-bold text-slate-400 mb-1">Rincian Diskripsi:</p>
                <p>{this.state.error.toString()}</p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Muat Ulang Tampilan Aplikasi</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCache}
                className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Bersihkan Cache Sesi &amp; Pulihkan</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
