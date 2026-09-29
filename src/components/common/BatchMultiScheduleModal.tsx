import React, { useState } from 'react';
import { Users, Search, Check, Zap, UserCheck, Calendar, Clock, MapPin, Sparkles, X, CheckSquare, RefreshCw, Repeat, ArrowRight } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo } from '../../utils/formatters';
import { sound, triggerConfetti, haptic } from '../../utils/feedback';

interface BatchMultiScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export const BatchMultiScheduleModal: React.FC<BatchMultiScheduleModalProps> = ({
  isOpen,
  onClose,
  defaultDate
}) => {
  const { schoolYear, posts, shifts, users, schedules, createSchedule } = useData();

  const [batchDate, setBatchDate] = useState<string>(defaultDate || getTodayDateString());
  const [batchPostId, setBatchPostId] = useState<string>(posts[0]?.id || '');
  const [batchShiftId, setBatchShiftId] = useState<string>(shifts[0]?.id || '');
  const [batchSelectedUserIds, setBatchSelectedUserIds] = useState<string[]>([]);
  const [batchRoleFilter, setBatchRoleFilter] = useState<'all' | 'guru' | 'tendik' | 'kepsek'>('all');
  const [batchTeacherSearch, setBatchTeacherSearch] = useState<string>('');
  const [batchNotes, setBatchNotes] = useState<string>('');
  const [batchSubmitting, setBatchSubmitting] = useState<boolean>(false);

  // Recurring options state
  const [repeatMode, setRepeatMode] = useState<'sekali' | 'mingguan'>('sekali');
  const [repeatWeeks, setRepeatWeeks] = useState<number>(4);

  if (!isOpen) return null;

  // Helper date generators
  const getOffsetDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const getNextWeekday = (targetDay: number) => { // 1: Senin, 2: Selasa, ... 6: Sabtu
    const d = new Date();
    const current = d.getDay(); // 0 is Sunday
    let diff = targetDay - current;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  };

  // Generate target dates array based on repeatMode and repeatWeeks
  const getCalculatedTargetDates = (): string[] => {
    const dates: string[] = [];
    if (repeatMode === 'sekali') {
      dates.push(batchDate);
    } else {
      const startDate = new Date(batchDate + 'T00:00:00');
      for (let w = 0; w < repeatWeeks; w++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + w * 7);
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    return dates;
  };

  const calculatedDates = getCalculatedTargetDates();

  // Filter users based on search and role
  const filteredTeachers = users.filter((u) => {
    if (!u.statusAktif) return false;
    const matchesRole = batchRoleFilter === 'all' || u.role === batchRoleFilter;
    const matchesSearch =
      u.nama.toLowerCase().includes(batchTeacherSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(batchTeacherSearch.toLowerCase()) ||
      (u.nip && u.nip.includes(batchTeacherSearch)) ||
      (u.jabatan && u.jabatan.toLowerCase().includes(batchTeacherSearch.toLowerCase()));

    return matchesRole && matchesSearch;
  });

  const toggleBatchUser = (userId: string) => {
    haptic.light();
    if (batchSelectedUserIds.includes(userId)) {
      setBatchSelectedUserIds((prev) => prev.filter((id) => id !== userId));
    } else {
      setBatchSelectedUserIds((prev) => [...prev, userId]);
    }
  };

  const selectAllFiltered = () => {
    haptic.light();
    const visibleIds = filteredTeachers.map((u) => u.id);
    setBatchSelectedUserIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const clearSelection = () => {
    haptic.light();
    setBatchSelectedUserIds([]);
  };

  const invertSelection = () => {
    haptic.light();
    const visibleIds = filteredTeachers.map((u) => u.id);
    const newSelected = visibleIds.filter((id) => !batchSelectedUserIds.includes(id));
    setBatchSelectedUserIds(newSelected);
  };

  const handleSaveBatchSchedules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchSelectedUserIds.length === 0) return;

    setBatchSubmitting(true);
    const postObj = posts.find((p) => p.id === batchPostId);
    const shiftObj = shifts.find((s) => s.id === batchShiftId);

    if (!postObj || !shiftObj) {
      setBatchSubmitting(false);
      return;
    }

    const targetDates = getCalculatedTargetDates();
    let createdCount = 0;
    let skippedCount = 0;

    for (const targetDate of targetDates) {
      const dayName = getDayNameIndo(targetDate);

      for (const userId of batchSelectedUserIds) {
        const userObj = users.find((u) => u.id === userId);
        if (userObj) {
          // Check duplicate on same date and shift for this user
          const already = schedules.some(
            (s) => s.tanggal === targetDate && s.userId === userObj.id && s.shiftId === shiftObj.id
          );

          if (!already) {
            await createSchedule({
              schoolYearId: schoolYear.id,
              tanggal: targetDate,
              hari: dayName,
              shiftId: shiftObj.id,
              shiftName: shiftObj.namaShift,
              jamMulai: shiftObj.jamMulai,
              jamSelesai: shiftObj.jamSelesai,
              postId: postObj.id,
              postName: postObj.namaPos,
              userId: userObj.id,
              userName: userObj.nama,
              userRole: userObj.role,
              status: 'belum_checkin',
              notes: batchNotes || `Penugasan piket ${repeatMode === 'mingguan' ? `berulang (${repeatWeeks} Mgg)` : 'kelompok'}`
            });
            createdCount++;
          } else {
            skippedCount++;
          }
        }
      }
    }

    sound.playSuccess();
    triggerConfetti();
    setBatchSubmitting(false);
    onClose();
    setBatchSelectedUserIds([]);
    setBatchNotes('');

    const currentDayName = getDayNameIndo(batchDate);
    const message = repeatMode === 'mingguan'
      ? `✓ Berhasil membuat total ${createdCount} entri jadwal berulang untuk ${batchSelectedUserIds.length} petugas piket setiap hari ${currentDayName} (${repeatWeeks} Minggu)! ${skippedCount > 0 ? `(${skippedCount} entri dilewati karena sudah ada jadwal).` : ''}`
      : skippedCount > 0
        ? `✓ Berhasil membuat ${createdCount} jadwal petugas piket pada ${formatDateIndo(batchDate)}! (${skippedCount} petugas dilewati karena sudah terjadwal di shift ini).`
        : `✓ Berhasil menambahkan ${createdCount} jadwal petugas piket pada ${formatDateIndo(batchDate)}!`;

    alert(message);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col justify-between p-5 sm:p-6 space-y-4 border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>+ Penjadwalan Multi Petugas Harian</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-extrabold">
                  {batchSelectedUserIds.length} Terpilih
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilih beberapa guru/petugas sekaligus untuk ditugaskan pada tanggal &amp; pos yang sama dengan cepat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveBatchSchedules} className="space-y-4 flex-1 overflow-y-auto pr-1">
          
          {/* Quick Date Presets */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Pilih Tanggal &amp; Pintasan Hari
            </label>
            
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBatchDate(getTodayDateString())}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  batchDate === getTodayDateString()
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setBatchDate(getOffsetDate(1))}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  batchDate === getOffsetDate(1)
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Besok
              </button>
              
              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 my-auto" />

              {[
                { label: 'Senin', dayIdx: 1 },
                { label: 'Selasa', dayIdx: 2 },
                { label: 'Rabu', dayIdx: 3 },
                { label: 'Kamis', dayIdx: 4 },
                { label: 'Jumat', dayIdx: 5 },
                { label: 'Sabtu', dayIdx: 6 }
              ].map((item) => {
                const targetDate = getNextWeekday(item.dayIdx);
                const isSelected = batchDate === targetDate;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setBatchDate(targetDate)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Grid: Tanggal Input, Pos & Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Input Tanggal Custom
              </label>
              <input
                type="date"
                required
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold"
              />
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-1 block">
                {getDayNameIndo(batchDate)}, {formatDateIndo(batchDate)}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Pos Piket Target
              </label>
              <select
                value={batchPostId}
                onChange={(e) => setBatchPostId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold"
              >
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.namaPos} ({p.petugasRequiredCount} orang)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Shift Jam Piket
              </label>
              <select
                value={batchShiftId}
                onChange={(e) => setBatchShiftId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaShift} ({s.jamMulai} - {s.jamSelesai})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode Pengulangan Penjadwalan */}
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Mode Pengulangan Penjadwalan</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-extrabold">
                {repeatMode === 'sekali' ? '1 Tanggal' : `${repeatWeeks} Minggu Berulang`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRepeatMode('sekali')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  repeatMode === 'sekali'
                    ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                    : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Hanya Sekali</span>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${repeatMode === 'sekali' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>
                    {repeatMode === 'sekali' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  1 tanggal saja ({formatDateIndo(batchDate)})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRepeatMode('mingguan')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  repeatMode === 'mingguan'
                    ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                    : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <span>Setiap {getDayNameIndo(batchDate)}</span>
                    <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
                  </span>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${repeatMode === 'mingguan' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>
                    {repeatMode === 'mingguan' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Pengulangan setiap {getDayNameIndo(batchDate)} seterusnya
                </span>
              </button>
            </div>

            {/* If repeatMode === 'mingguan', show duration options */}
            {repeatMode === 'mingguan' && (
              <div className="space-y-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/50 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold text-indigo-900 dark:text-indigo-200">
                    Durasi Pengulangan (Jumlah Minggu):
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    {repeatWeeks} Minggu (Total {batchSelectedUserIds.length * repeatWeeks} Penugasan)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '2 Mgg', val: 2 },
                    { label: '4 Mgg (1 Bln)', val: 4 },
                    { label: '8 Mgg (2 Bln)', val: 8 },
                    { label: '12 Mgg (3 Bln)', val: 12 },
                    { label: '16 Mgg (1 Sem)', val: 16 }
                  ].map((w) => (
                    <button
                      key={w.val}
                      type="button"
                      onClick={() => setRepeatWeeks(w.val)}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                        repeatWeeks === w.val
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}

                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-slate-500">Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={26}
                      value={repeatWeeks}
                      onChange={(e) => setRepeatWeeks(Math.max(1, Math.min(26, Number(e.target.value))))}
                      className="w-12 text-center text-xs p-1 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg font-bold"
                    />
                  </div>
                </div>

                {/* Target Dates Preview Chips */}
                <div className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-1">
                  <p className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                    <span>📅 Pratinjau Tanggal Berulang ({calculatedDates.length} Tanggal):</span>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatDateIndo(calculatedDates[0])} s/d {formatDateIndo(calculatedDates[calculatedDates.length - 1])}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-0.5">
                    {calculatedDates.map((d, idx) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md text-[9.5px] font-mono font-bold"
                      >
                        {idx + 1}. {getDayNameIndo(d)}, {formatDateIndo(d)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Teacher Checklist Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Pilih Petugas ({filteredTeachers.length} Orang Tersedia):</span>
              </label>

              {/* Selection Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-lg text-[10.5px] font-bold border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={invertSelection}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 rounded-lg text-[10.5px] font-bold cursor-pointer"
                >
                  Invers
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-lg text-[10.5px] font-bold cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Filter controls inside modal */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={batchTeacherSearch}
                  onChange={(e) => setBatchTeacherSearch(e.target.value)}
                  placeholder="Cari nama guru, NIP, atau jabatan..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'guru', label: 'Guru' },
                  { id: 'tendik', label: 'Tendik' }
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setBatchRoleFilter(r.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold cursor-pointer ${
                      batchRoleFilter === r.id
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Teacher Selection Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950">
              {filteredTeachers.map((user) => {
                const isChecked = batchSelectedUserIds.includes(user.id);
                // Check if user already scheduled on batchDate & shift
                const existing = schedules.find(
                  (s) => s.tanggal === batchDate && s.userId === user.id && s.shiftId === batchShiftId
                );

                return (
                  <div
                    key={user.id}
                    onClick={() => toggleBatchUser(user.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-500 dark:border-indigo-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                        {user.foto ? (
                          <img src={user.foto} alt={user.nama} className="w-full h-full object-cover" />
                        ) : (
                          <span>{user.nama.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {user.nama}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {user.jabatan || user.unitKerja} • <span className="uppercase font-semibold">{user.role}</span>
                          </p>
                        </div>
                        {existing && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-bold flex items-center gap-1 w-fit mt-0.5">
                            <span>⚠️ Sudah Ada ({existing.postName})</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Catatan Tugas Kelompok (Opsional)
            </label>
            <input
              type="text"
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder="Contoh: Petugas kelompok piket penyambutan siswa &amp; penegakan disiplin"
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={batchSubmitting || batchSelectedUserIds.length === 0}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>
                {batchSubmitting
                  ? 'Menyimpan Jadwal Kelompok...'
                  : repeatMode === 'mingguan'
                    ? `⚡ Simpan ${batchSelectedUserIds.length * repeatWeeks} Penugasan (${batchSelectedUserIds.length} Petugas x ${repeatWeeks} Minggu)`
                    : `⚡ Simpan ${batchSelectedUserIds.length} Penugasan Petugas`}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
            >
              Batal
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
