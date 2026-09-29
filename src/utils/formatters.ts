/**
 * Formatting utilities for Indonesian locale e-Piket
 */

export const formatDateIndo = (dateStr?: string | Date): string => {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const formatTimeIndo = (dateStr?: string | Date): string => {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} WIB`;
};

export const formatFullDateIndo = (dateStr?: string | Date): string => {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${monthName} ${year}`;
};

export const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'sedang_bertugas':
    case 'hadir':
    case 'selesai':
    case 'diserahkan':
    case 'diterima':
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        label: 'Sedang Bertugas'
      };
    case 'belum_checkin':
    case 'belum_piket':
    case 'menunggu':
    case 'dipantau':
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
        label: 'Belum Check-In'
      };
    case 'terlambat':
    case 'darurat':
    case 'tinggi':
      return {
        bg: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
        dot: 'bg-rose-500',
        label: 'Terlambat'
      };
    case 'sudah_checkout':
      return {
        bg: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
        dot: 'bg-teal-600',
        label: 'Sudah Selesai'
      };
    case 'digantikan':
      return {
        bg: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
        dot: 'bg-slate-500',
        label: 'Digantikan'
      };
    default:
      return {
        bg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        dot: 'bg-slate-400',
        label: status
      };
  }
};

export const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'darurat':
      return 'bg-red-600 text-white font-bold';
    case 'tinggi':
      return 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-semibold';
    case 'sedang':
      return 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    case 'rendah':
    default:
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  }
};

export const formatMonthYearIndo = (monthStr?: string): string => {
  if (!monthStr) return '-';
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${months[month - 1] || parts[1]} ${year}`;
};
