import React from 'react';
import { LayoutDashboard, CalendarCheck, BookOpen, AlertTriangle, ArrowRightLeft, UserCog, Database, FileText, HardDrive, Bell, History, Settings, User, Calendar, LogOut, PanelLeftClose } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isHidden = false, onToggleHide }) => {
  const { currentRole, logout } = useAuth();

  // Role based navigation menu items
  const getNavItems = () => {
    switch (currentRole) {
      case 'admin':
        return [
          { group: 'Utama', items: [
            { id: 'login', label: 'Login Admin', icon: LayoutDashboard }
          ]},
          { group: 'Piket & Transaksi', items: [
            { id: 'buku-piket', label: 'Buku Piket Digital', icon: BookOpen },
            { id: 'kejadian', label: 'Catatan Kejadian', icon: AlertTriangle },
            { id: 'serah-terima', label: 'Serah Terima Tugas', icon: ArrowRightLeft },
            { id: 'penggantian', label: 'Penggantian Petugas', icon: UserCog },
            { id: 'jadwal', label: 'Manajemen Jadwal', icon: Calendar }
          ]},
          { group: 'Data & Laporan', items: [
            { id: 'master-data', label: 'Master Data', icon: Database },
            { id: 'laporan', label: 'Laporan & Rekap', icon: FileText },
            { id: 'dokumentasi', label: 'Dokumentasi Drive', icon: HardDrive }
          ]},
          { group: 'Sistem & Konfigurasi', items: [
            { id: 'audit-log', label: 'Audit Trail / Log', icon: History },
            { id: 'pengaturan', label: 'Pengaturan Sistem', icon: Settings }
          ]}
        ];

      case 'kepsek':
        return [
          { group: 'Monitoring Pimpinan', items: [
            { id: 'login', label: 'Login Monitoring', icon: LayoutDashboard },
            { id: 'buku-piket', label: 'Buku Piket Digital', icon: BookOpen },
            { id: 'kejadian', label: 'Kejadian & Ketertiban', icon: AlertTriangle },
            { id: 'serah-terima', label: 'Monitoring Serah Terima', icon: ArrowRightLeft }
          ]},
          { group: 'Rekap & Analisis', items: [
            { id: 'laporan', label: 'Rekap & Laporan PDF', icon: FileText },
            { id: 'dokumentasi', label: 'Dokumentasi Foto', icon: HardDrive },
            { id: 'jadwal', label: 'Jadwal Sekolah', icon: Calendar }
          ]},
          { group: 'Akun', items: [
            { id: 'profil', label: 'Profil Saya', icon: User }
          ]}
        ];

      case 'guru':
      case 'tendik':
      default:
        return [
          { group: 'Tugas Piket', items: [
            { id: 'login', label: 'Login', icon: LayoutDashboard },
            { id: 'piket-saya', label: 'Piket Saya (Check-in)', icon: CalendarCheck },
            { id: 'jadwal', label: 'Jadwal Piket', icon: Calendar }
          ]},
          { group: 'Operasional', items: [
            { id: 'buku-piket', label: 'Buku Piket Digital', icon: BookOpen },
            { id: 'kejadian', label: 'Input Kejadian', icon: AlertTriangle },
            { id: 'serah-terima', label: 'Serah Terima Tugas', icon: ArrowRightLeft },
            { id: 'dokumentasi', label: 'Dokumentasi Foto', icon: HardDrive }
          ]},
          { group: 'Lainnya', items: [
            { id: 'profil', label: 'Profil Saya', icon: User }
          ]}
        ];
    }
  };

  const menuGroups = getNavItems();

  return (
    <aside
      className={`hidden lg:flex flex-col bg-slate-900 text-slate-300 fixed top-14 sm:top-16 left-0 bottom-0 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] border-r border-slate-800 shrink-0 select-none z-20 transition-all duration-300 ease-in-out ${
        isHidden
          ? 'w-0 -translate-x-full opacity-0 pointer-events-none border-none p-0 overflow-hidden'
          : 'w-64 translate-x-0 opacity-100'
      }`}
    >
      {/* Header Panel dengan Tombol Tutup / Hide Ergonomis */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          Panel Menu
        </span>
        {onToggleHide && (
          <button
            onClick={onToggleHide}
            title="Sembunyikan Panel Menu (Ctrl+B)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px]">Tutup</span>
          </button>
        )}
      </div>

      {/* Daftar Menu Scrollable (Frozen Container) */}
      <div className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
        {menuGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {group.group}
            </p>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              {/* Tombol Keluar: Tepat di bawah menu Pengaturan Sistem (atau menu terakhir pada peran lainnya) */}
              {groupIdx === menuGroups.length - 1 && (
                <div className="pt-2">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/70 shadow-xs transition-all active:scale-95 cursor-pointer"
                    title="Keluar dari Aplikasi (Logout)"
                  >
                    <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Keluar Aplikasi</span>
                  </button>
                </div>
              )}
            </nav>
          </div>
        ))}
      </div>

      {/* Bagian bawah hanya menampilkan versi aplikasi tanpa nama aplikasi & pembuat */}
      <div className="py-2.5 px-3 border-t border-slate-800/80 text-center shrink-0">
        <span className="text-[10px] font-mono text-slate-400 tracking-wider">
          v2.6 Aktif
        </span>
      </div>
    </aside>
  );
};
