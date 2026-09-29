import React, { useState } from 'react';
import { History, Search, Filter, ShieldCheck, User, Clock, FileText, Activity, Terminal, LayoutGrid, Table } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { GlideCarousel } from '../common/GlideCarousel';

export const AuditLogModule: React.FC = () => {
  const { auditLogs } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [viewMode, setViewMode] = useState<'glide' | 'table'>('glide');

  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch = 
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchModule = selectedModule === 'all' || log.module === selectedModule;
    return matchSearch && matchModule;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Audit Trail & Log Aktivitas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Rekam jejak seluruh aktivitas sistem, check-in, mutasi jadwal, insiden, dan integritas keamanan (Immutable).
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari aksi, nama user, detail..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">Semua Modul</option>
            <option value="Kehadiran Piket">Kehadiran Piket</option>
            <option value="Buku Piket Digital">Buku Piket Digital</option>
            <option value="Kejadian">Kejadian</option>
            <option value="Serah Terima">Serah Terima</option>
            <option value="Penggantian Petugas">Penggantian Petugas</option>
            <option value="Jadwal Piket">Jadwal Piket</option>
            <option value="Master Pengguna">Master Pengguna</option>
            <option value="Dokumentasi Drive">Dokumentasi Drive</option>
          </select>

          {/* Toggle Glides vs Table */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setViewMode('glide')}
              title="Tampilan Glide Sliders"
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'glide'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Glide Sliders</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Tampilan Tabel Lengkap"
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabel</span>
            </button>
          </div>
        </div>
      </div>

      {/* GLIDES CAROUSEL VIEW FOR COMPACT MOBILE & QUICK SWIPE */}
      {viewMode === 'glide' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <GlideCarousel title="Glide Ringkas Log Aktivitas" badge={`${filteredLogs.length} Aktivitas`} itemClassName="w-[85%] sm:w-[320px]">
            {filteredLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Tidak ada log aktivitas tercatat.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="p-4 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white block">{log.userName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{log.userRole}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/50">
                        {log.module}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 line-clamp-3 leading-relaxed font-sans">
                      {log.details}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{formatDateIndo(log.timestamp)} {formatTimeIndo(log.timestamp)}</span>
                    <span className="truncate max-w-[100px]">{log.deviceInfo || 'Client App'}</span>
                  </div>
                </div>
              ))
            )}
          </GlideCarousel>
        </div>
      )}

      {/* AUDIT LOG TABLE */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Waktu (WIB)</th>
                  <th className="py-3 px-4">Pengguna & Role</th>
                  <th className="py-3 px-4">Aksi / Event</th>
                  <th className="py-3 px-4">Modul</th>
                  <th className="py-3 px-4">Rincian Aktivitas</th>
                  <th className="py-3 px-4">Perangkat / IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                      Tidak ada log aktivitas tercatat.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateIndo(log.timestamp)} {formatTimeIndo(log.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">{log.userName}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">{log.userRole}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-800 dark:text-emerald-400">{log.module}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-sm">{log.details}</td>
                      <td className="py-3 px-4 text-slate-400 dark:text-slate-500 text-[11px] font-mono whitespace-nowrap">
                        {log.deviceInfo || 'Client App'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
