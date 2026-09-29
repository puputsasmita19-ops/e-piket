import React, { useEffect, useRef } from 'react';
import { Bell, CheckCheck, Clock, AlertTriangle, ArrowRightLeft, Calendar, Info, Check } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { formatTimeIndo } from '../../utils/formatters';

interface NotificationDropdownProps {
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose, onNavigate }) => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useData();
  const { currentUser } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-close after inactivity (5 seconds), pauses on hover, closes on click outside
  const startTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onClose();
    }, 5000);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    startTimer();

    // Click outside handler
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearTimer();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Filter notifications relevant to current user or role
  const userNotifs = notifications.filter(
    (n) =>
      !n.userId ||
      n.userId === currentUser?.id ||
      n.roleTarget === 'all' ||
      n.roleTarget === currentUser?.role
  );

  const unreadCount = userNotifs.filter((n) => !n.read).length;

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'kejadian_penting':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'terlambat':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'penggantian':
      case 'serah_terima':
        return <ArrowRightLeft className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
      case 'jadwal_hari_ini':
      case 'jadwal_besok':
        return <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  return (
    <div 
      ref={dropdownRef}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-3 z-50 animate-in fade-in zoom-in-95 transition-colors"
    >
      <div className="flex items-center justify-between px-4 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Pusat Notifikasi</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
              {unreadCount} baru
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsAsRead}
            className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Tandai semua dibaca
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {userNotifs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            Tidak ada notifikasi saat ini
          </div>
        ) : (
          userNotifs.slice(0, 10).map((n) => (
            <div
              key={n.id}
              onClick={() => {
                markNotificationAsRead(n.id);
                if (n.type === 'kejadian_penting') onNavigate('kejadian');
                else if (n.type === 'serah_terima') onNavigate('serah-terima');
                else if (n.type === 'terlambat') onNavigate(currentUser?.role === 'admin' ? 'dashboard' : 'piket-saya');
                else if (n.type === 'penggantian' || n.type === 'jadwal_hari_ini') onNavigate('piket-saya');
                else onNavigate('notifikasi');
                onClose();
              }}
              className={`p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-start gap-3 ${
                !n.read ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : ''
              }`}
            >
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-xs border border-slate-200/80 dark:border-slate-700 shrink-0 mt-0.5">
                {getNotifIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{n.title}</p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatTimeIndo(n.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">{n.message}</p>
              </div>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 mt-1.5"></span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="pt-2 px-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
        <button
          onClick={() => {
            onNavigate('notifikasi');
            onClose();
          }}
          className="w-full text-center py-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold cursor-pointer"
        >
          Lihat Semua & Pengaturan WhatsApp →
        </button>
      </div>
    </div>
  );
};
