import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Search, Filter, Clock, MapPin, Users, FileDown, Zap, Trash2, Edit3, AlertCircle, CalendarRange, CheckCircle2, CheckSquare, Square, UserCheck, Check, Sparkles, CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { DutySchedule } from '../../types';
import { getTodayDateString, getDayNameIndo } from '../../services/seedData';
import { formatDateIndo, getStatusBadgeColor } from '../../utils/formatters';
import { exportToExcel } from '../../services/exportService';
import { sound, triggerConfetti } from '../../utils/feedback';
import { showSuccessToast } from '../../utils/toast';
import { RunningText } from '../common/RunningText';
import { BatchMultiScheduleModal } from '../common/BatchMultiScheduleModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

export const JadwalPiket: React.FC = () => {
  const { currentRole } = useAuth();
  const { 
    schoolYear, 
    posts, 
    shifts, 
    users, 
    schedules, 
    createSchedule, 
    updateSchedule,
    deleteSchedule, 
    deleteMultipleSchedules,
    generateSemesterSchedule 
  } = useData();

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>(() => {
    try {
      const saved = localStorage.getItem('e_piket_jadwal_view');
      if (saved === 'table' || saved === 'calendar') return saved;
    } catch (e) {}
    return 'calendar';
  });

  useEffect(() => {
    try {
      localStorage.setItem('e_piket_jadwal_view', viewMode);
    } catch (e) {}
  }, [viewMode]);
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth()); // 0-indexed

  const [selectedDayFilter, setSelectedDayFilter] = useState('all');
  const [selectedPostFilter, setSelectedPostFilter] = useState('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Selection State for Batch Delete
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [showBulkDeleteMenu, setShowBulkDeleteMenu] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [showBatchMultiModal, setShowBatchMultiModal] = useState(false);
  const [showSemesterWizard, setShowSemesterWizard] = useState(false);

  // Delete Schedule Confirm State
  const [deleteScheduleState, setDeleteScheduleState] = useState<{
    isOpen: boolean;
    scheduleId: string;
    userName: string;
    postName: string;
    tanggal: string;
  }>({
    isOpen: false,
    scheduleId: '',
    userName: '',
    postName: '',
    tanggal: ''
  });

  // Bulk Delete Confirm State
  const [bulkDeleteState, setBulkDeleteState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    ids: string[];
  }>({
    isOpen: false,
    title: '',
    description: '',
    ids: []
  });

  // Single Schedule Form State
  const [formDate, setFormDate] = useState(getTodayDateString());
  const [formPostId, setFormPostId] = useState(posts[0]?.id || '');
  const [formShiftId, setFormShiftId] = useState(shifts[0]?.id || '');
  const [formUserId, setFormUserId] = useState(users[0]?.id || '');
  const [formNotes, setFormNotes] = useState('');
  const [formIsDadakan, setFormIsDadakan] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Batch Multi-Person Form State
  const [batchDate, setBatchDate] = useState(getTodayDateString());
  const [batchPostId, setBatchPostId] = useState(posts[0]?.id || '');
  const [batchShiftId, setBatchShiftId] = useState(shifts[0]?.id || '');
  const [batchSelectedUserIds, setBatchSelectedUserIds] = useState<string[]>([]);
  const [batchTeacherSearch, setBatchTeacherSearch] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Semester Wizard Form State
  const [wizardStartDate, setWizardStartDate] = useState(getTodayDateString());
  const [wizardEndDate, setWizardEndDate] = useState(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    return end.toISOString().split('T')[0];
  });
  const [wizardAssignments, setWizardAssignments] = useState<{ [day: string]: { [postId: string]: string[] } }>({
    'Senin': { [posts[0]?.id || 'post-gerbang']: ['user-guru-1'], [posts[1]?.id || 'post-lobby']: ['user-guru-2'] },
    'Selasa': { [posts[0]?.id || 'post-gerbang']: ['user-guru-3'], [posts[1]?.id || 'post-lobby']: ['user-guru-4'] },
    'Rabu': { [posts[0]?.id || 'post-gerbang']: ['user-guru-2'], [posts[1]?.id || 'post-lobby']: ['user-guru-1'] },
    'Kamis': { [posts[0]?.id || 'post-gerbang']: ['user-guru-4'], [posts[1]?.id || 'post-lobby']: ['user-guru-3'] },
    'Jumat': { [posts[0]?.id || 'post-gerbang']: ['user-guru-1'], [posts[1]?.id || 'post-tendik']: ['user-tendik'] },
    'Sabtu': { [posts[0]?.id || 'post-gerbang']: ['user-tendik'] }
  });
  const [generating, setGenerating] = useState(false);

  // Toggle single schedule selection in table
  const handleToggleScheduleSelection = (id: string) => {
    setSelectedScheduleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all filtered schedules
  const handleSelectAllFiltered = () => {
    if (selectedScheduleIds.length === filteredSchedules.length) {
      setSelectedScheduleIds([]);
    } else {
      setSelectedScheduleIds(filteredSchedules.map((s) => s.id));
    }
  };

  // Trigger delete for selected schedules
  const handleConfirmDeleteSelected = () => {
    if (selectedScheduleIds.length === 0) return;
    setBulkDeleteState({
      isOpen: true,
      title: `Hapus ${selectedScheduleIds.length} Jadwal Terpilih`,
      description: `Apakah Anda yakin ingin menghapus ${selectedScheduleIds.length} jadwal piket yang telah dipilih secara permanen dari penyimpanan lokal dan Cloud Firebase?`,
      ids: selectedScheduleIds
    });
  };

  // Trigger delete all schedules in current active month
  const handleConfirmDeleteCurrentMonth = () => {
    const monthStr = String(calendarMonth + 1).padStart(2, '0');
    const prefix = `${calendarYear}-${monthStr}`;
    const monthSchedules = schedules.filter((s) => s.tanggal.startsWith(prefix));
    if (monthSchedules.length === 0) {
      return;
    }
    setBulkDeleteState({
      isOpen: true,
      title: `Hapus Semua Jadwal Bulan ${monthNamesIndo[calendarMonth]} ${calendarYear}`,
      description: `Apakah Anda yakin ingin menghapus seluruh ${monthSchedules.length} jadwal piket pada bulan ${monthNamesIndo[calendarMonth]} ${calendarYear}?`,
      ids: monthSchedules.map((s) => s.id)
    });
  };

  // Trigger delete all filtered schedules
  const handleConfirmDeleteFiltered = () => {
    if (filteredSchedules.length === 0) {
      return;
    }
    setBulkDeleteState({
      isOpen: true,
      title: `Hapus ${filteredSchedules.length} Jadwal Hasil Filter`,
      description: `Apakah Anda yakin ingin menghapus ${filteredSchedules.length} jadwal piket yang sedang ditampilkan?`,
      ids: filteredSchedules.map((s) => s.id)
    });
  };

  const handleExecuteBulkDelete = async () => {
    if (bulkDeleteState.ids.length === 0) return;
    const res = await deleteMultipleSchedules(bulkDeleteState.ids);
    sound.playSuccess();
    showSuccessToast(`Berhasil menghapus ${res.count} entri jadwal piket secara tuntas!`);
    setSelectedScheduleIds([]);
    setBulkDeleteState({ isOpen: false, title: '', description: '', ids: [] });
  };

  // Check collision when single form changes
  const checkConflict = (dateStr: string, userId: string, shiftId: string) => {
    const conflict = schedules.find(
      (s) => s.tanggal === dateStr && s.userId === userId && s.shiftId === shiftId
    );
    if (conflict) {
      setConflictWarning(`⚠️ Peringatan: Guru ini telah terjadwal pada jam/shift yang sama di ${conflict.postName}.`);
    } else {
      setConflictWarning(null);
    }
  };

  const filteredSchedules = schedules.filter((s) => {
    const matchesDay = selectedDayFilter === 'all' || s.hari === selectedDayFilter;
    const matchesPost = selectedPostFilter === 'all' || s.postId === selectedPostFilter;
    const matchesTeacher = selectedTeacherFilter === 'all' || s.userId === selectedTeacherFilter;
    const matchesSearch = 
      s.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.postName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tanggal.includes(searchQuery);

    return matchesDay && matchesPost && matchesTeacher && matchesSearch;
  });

  const handleOpenAddScheduleModal = () => {
    setEditingScheduleId(null);
    setFormDate(getTodayDateString());
    setFormPostId(posts[0]?.id || '');
    setFormShiftId(shifts[0]?.id || '');
    setFormUserId(users[0]?.id || '');
    setFormNotes('');
    setFormIsDadakan(false);
    setConflictWarning(null);
    setShowAddModal(true);
  };

  const handleOpenEditScheduleModal = (sch: DutySchedule) => {
    setEditingScheduleId(sch.id);
    setFormDate(sch.tanggal);
    setFormPostId(sch.postId);
    setFormShiftId(sch.shiftId);
    setFormUserId(sch.userId);
    setFormNotes(sch.notes || '');
    setFormIsDadakan(Boolean(sch.isDadakan));
    setConflictWarning(null);
    setShowAddModal(true);
  };

  const handleSaveSingleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const postObj = posts.find((p) => p.id === formPostId);
    const shiftObj = shifts.find((s) => s.id === formShiftId);
    const userObj = users.find((u) => u.id === formUserId);

    if (postObj && shiftObj && userObj) {
      if (editingScheduleId) {
        await updateSchedule(editingScheduleId, {
          tanggal: formDate,
          hari: getDayNameIndo(formDate),
          shiftId: shiftObj.id,
          shiftName: shiftObj.namaShift,
          jamMulai: shiftObj.jamMulai,
          jamSelesai: shiftObj.jamSelesai,
          postId: postObj.id,
          postName: postObj.namaPos,
          userId: userObj.id,
          userName: userObj.nama,
          userRole: userObj.role,
          isDadakan: formIsDadakan,
          notes: formNotes
        });
      } else {
        await createSchedule({
          schoolYearId: schoolYear.id,
          tanggal: formDate,
          hari: getDayNameIndo(formDate),
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
          isDadakan: formIsDadakan,
          acknowledgedByTeacher: false,
          notes: formNotes
        });
      }

      sound.playSuccess();
      showSuccessToast(
        editingScheduleId
          ? `Perubahan jadwal piket ${userObj.nama} berhasil disimpan!`
          : formIsDadakan
          ? `🚨 Jadwal piket dadakan untuk ${userObj.nama} berhasil diterbitkan & dinotifikasikan!`
          : `Jadwal piket untuk ${userObj.nama} berhasil disimpan!`
      );
      setShowAddModal(false);
      setEditingScheduleId(null);
      setFormNotes('');
      setFormIsDadakan(false);
    }
  };

  // Toggle user in batch multi selection
  const toggleBatchUser = (userId: string) => {
    if (batchSelectedUserIds.includes(userId)) {
      setBatchSelectedUserIds((prev) => prev.filter((id) => id !== userId));
    } else {
      setBatchSelectedUserIds((prev) => [...prev, userId]);
    }
  };

  const selectAllFilteredBatchUsers = () => {
    const visibleUsers = users.filter((u) =>
      u.statusAktif &&
      (u.nama.toLowerCase().includes(batchTeacherSearch.toLowerCase()) ||
       u.role.toLowerCase().includes(batchTeacherSearch.toLowerCase()) ||
       (u.jabatan && u.jabatan.toLowerCase().includes(batchTeacherSearch.toLowerCase())))
    );
    setBatchSelectedUserIds(visibleUsers.map((u) => u.id));
  };

  const clearBatchUsers = () => {
    setBatchSelectedUserIds([]);
  };

  // Submit Batch Multi-User Schedules for a specific date
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

    const dayName = getDayNameIndo(batchDate);
    let createdCount = 0;

    for (const userId of batchSelectedUserIds) {
      const userObj = users.find((u) => u.id === userId);
      if (userObj) {
        // Check for duplicates on same date/pos/user
        const already = schedules.some((s) => s.tanggal === batchDate && s.postId === postObj.id && s.userId === userObj.id);
        if (!already) {
          await createSchedule({
            schoolYearId: schoolYear.id,
            tanggal: batchDate,
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
            notes: batchNotes || 'Penugasan piket harian kelompok'
          });
          createdCount++;
        }
      }
    }

    sound.playSuccess();
    triggerConfetti();
    setBatchSubmitting(false);
    setShowBatchMultiModal(false);
    setBatchSelectedUserIds([]);
    setBatchNotes('');
    showSuccessToast(`Berhasil menambahkan & menyimpan ${createdCount} jadwal piket pada ${formatDateIndo(batchDate)}!`);
  };

  const handleRunSemesterGenerator = async () => {
    setGenerating(true);
    const count = await generateSemesterSchedule({
      startDate: wizardStartDate,
      endDate: wizardEndDate,
      postAssignments: wizardAssignments
    });
    setGenerating(false);
    setShowSemesterWizard(false);
    sound.playSuccess();
    triggerConfetti();
    showSuccessToast(`Berhasil membuat & menyimpan ${count} entri jadwal 1 semester!`);
  };

  const handleExportExcel = () => {
    const exportData = filteredSchedules.map((s, idx) => ({
      No: idx + 1,
      Tanggal: s.tanggal,
      Hari: s.hari,
      Pos: s.postName,
      Shift: s.shiftName,
      Jam: `${s.jamMulai} - ${s.jamSelesai}`,
      Petugas: s.userName,
      Role: s.userRole,
      Status: s.status,
      Pengganti: s.isReplacement ? `Ya (Asli: ${s.originalUserName})` : 'Tidak'
    }));

    exportToExcel(`Jadwal_Piket_${schoolYear.tahunAjaran.replace('/', '_')}`, [
      { name: 'Jadwal Piket', data: exportData }
    ]);
  };

  const monthNamesIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleTodayMonth = () => {
    const today = new Date();
    setCalendarYear(today.getFullYear());
    setCalendarMonth(today.getMonth());
  };

  // Calendar cells generation
  const getCalendarDays = () => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sunday
    
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding days
    const prevMonthDays = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const prevMonth = calendarMonth === 0 ? 12 : calendarMonth;
      const monthStr = String(prevMonth).padStart(2, '0');
      const dayStr = String(prevMonthDays - i).padStart(2, '0');
      cells.push({
        dateStr: `${prevYear}-${monthStr}-${dayStr}`,
        dayNum: prevMonthDays - i,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(calendarMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${calendarYear}-${monthStr}-${dayStr}`;
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true
      });
    }

    // Next month padding days to complete grid
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const nextMonth = calendarMonth === 11 ? 1 : calendarMonth + 2;
      const monthStr = String(nextMonth).padStart(2, '0');
      for (let i = 1; i <= remaining; i++) {
        const dayStr = String(i).padStart(2, '0');
        cells.push({
          dateStr: `${nextYear}-${monthStr}-${dayStr}`,
          dayNum: i,
          isCurrentMonth: false
        });
      }
    }

    return cells;
  };

  const calendarGrid = getCalendarDays();

  // Filtered teachers for batch modal
  const filteredBatchTeachers = users.filter((u) =>
    u.statusAktif &&
    (u.nama.toLowerCase().includes(batchTeacherSearch.toLowerCase()) ||
     u.role.toLowerCase().includes(batchTeacherSearch.toLowerCase()) ||
     (u.jabatan && u.jabatan.toLowerCase().includes(batchTeacherSearch.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Manajemen Jadwal Piket
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Tahun Ajaran {schoolYear.tahunAjaran} ({schoolYear.semester}) • Pembagian Pos &amp; Shift Petugas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Tampilan Switcher */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Kalender Visual</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabel</span>
            </button>
          </div>

          {currentRole === 'admin' && (
            <>
              {/* Batch Multi-Person Button */}
              <button
                onClick={() => setShowBatchMultiModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Users className="w-4 h-4 text-indigo-100" />
                <span>+ Multi Petugas Harian</span>
              </button>

              <button
                onClick={() => setShowSemesterWizard(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <CalendarRange className="w-4 h-4 text-teal-100" />
                <span>Input 1 Semester Massal</span>
              </button>

              <button
                onClick={handleOpenAddScheduleModal}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Single Jadwal</span>
              </button>

              {/* Hapus Massal Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteMenu(!showBulkDeleteMenu)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-900 transition-all cursor-pointer"
                  title="Menu Hapus Jadwal Massal"
                >
                  <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Hapus Massal</span>
                </button>

                {showBulkDeleteMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-40 space-y-1 animate-in fade-in zoom-in-95">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Opsi Penghapusan Jadwal
                    </div>
                    {selectedScheduleIds.length > 0 && (
                      <button
                        onClick={() => {
                          setShowBulkDeleteMenu(false);
                          handleConfirmDeleteSelected();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between cursor-pointer"
                      >
                        <span>Hapus Terpilih</span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-200 dark:bg-rose-800 text-[10px] font-mono">
                          {selectedScheduleIds.length} data
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowBulkDeleteMenu(false);
                        handleConfirmDeleteCurrentMonth();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span>Hapus Bulan Ini</span>
                      <span className="text-[10px] text-slate-400">
                        {monthNamesIndo[calendarMonth].substring(0, 3)} {calendarYear}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setShowBulkDeleteMenu(false);
                        handleConfirmDeleteFiltered();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-between cursor-pointer"
                    >
                      <span>Hapus Hasil Filter</span>
                      <span className="text-[10px] text-slate-400">
                        {filteredSchedules.length} data
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama guru, pos..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">Semua Hari</option>
            <option value="Senin">Senin</option>
            <option value="Selasa">Selasa</option>
            <option value="Rabu">Rabu</option>
            <option value="Kamis">Kamis</option>
            <option value="Jumat">Jumat</option>
            <option value="Sabtu">Sabtu</option>
          </select>

          <select
            value={selectedPostFilter}
            onChange={(e) => setSelectedPostFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">Semua Pos</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>{p.namaPos}</option>
            ))}
          </select>

          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">Semua Petugas</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.nama}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CONTENT VIEW: KALENDER VISUAL vs TABEL */}
      {viewMode === 'calendar' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden p-4 sm:p-6 space-y-4">
          
          {/* Calendar Header Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-2xl shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{monthNamesIndo[calendarMonth]} {calendarYear}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tampilan visual jadwal piket bulanan guru &amp; petugas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer transition-all"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTodayMonth}
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 cursor-pointer"
              >
                Bulan Ini
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer transition-all"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Month Selector */}
              <select
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(Number(e.target.value))}
                className="text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                {monthNamesIndo.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(Number(e.target.value))}
                className="text-xs font-bold p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid Headers (Sunday to Saturday) */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 py-1 border-b border-slate-100 dark:border-slate-800">
            <div className="text-rose-500">Minggu</div>
            <div>Senin</div>
            <div>Selasa</div>
            <div>Rabu</div>
            <div>Kamis</div>
            <div>Jumat</div>
            <div className="text-indigo-500">Sabtu</div>
          </div>

          {/* Month Calendar Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarGrid.map((cell, idx) => {
              const isToday = cell.dateStr === getTodayDateString();
              const daySchedules = filteredSchedules.filter((s) => s.tanggal === cell.dateStr);

              return (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  className={`min-h-[110px] sm:min-h-[135px] p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                    cell.isCurrentMonth
                      ? isToday
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50/50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      : 'bg-slate-100/30 dark:bg-slate-950/30 border-slate-100 dark:border-slate-900 opacity-40'
                  }`}
                >
                  {/* Top Cell Header: Day Number & Badge */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded-lg ${
                      isToday
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : cell.isCurrentMonth
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-600'
                    }`}>
                      {cell.dayNum}
                    </span>

                    {isToday && (
                      <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-600 text-white font-extrabold tracking-wider">
                        HARI INI
                      </span>
                    )}

                    {currentRole === 'admin' && cell.isCurrentMonth && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingScheduleId(null);
                          setFormDate(cell.dateStr);
                          setFormPostId(posts[0]?.id || '');
                          setFormShiftId(shifts[0]?.id || '');
                          setFormUserId(users[0]?.id || '');
                          setFormNotes('');
                          setShowAddModal(true);
                        }}
                        className="w-5 h-5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-600 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                        title={`Tambah Jadwal pada ${formatDateIndo(cell.dateStr)}`}
                      >
                        +
                      </button>
                    )}
                  </div>

                  {/* Schedule Pills inside Cell */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-24 pr-0.5">
                    {daySchedules.length === 0 ? (
                      cell.isCurrentMonth && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-600 italic block pt-2 text-center">
                          -
                        </span>
                      )
                    ) : (
                      daySchedules.map((sch) => {
                        const badge = getStatusBadgeColor(sch.status);
                        return (
                          <div
                            key={sch.id}
                            onClick={() => handleOpenEditScheduleModal(sch)}
                            className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs hover:border-emerald-400 transition-all cursor-pointer group relative"
                            title={`${sch.userName} - ${sch.postName} (${sch.shiftName})`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9.5px] font-extrabold text-slate-900 dark:text-white truncate block">
                                {sch.userName}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`} />
                                {currentRole === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteScheduleState({
                                        isOpen: true,
                                        scheduleId: sch.id,
                                        userName: sch.userName || 'Petugas',
                                        postName: sch.postName || 'Pos Piket',
                                        tanggal: sch.tanggal
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity"
                                    title="Hapus Jadwal Ini"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-[8.5px] text-emerald-700 dark:text-emerald-400 font-bold truncate">
                              {sch.postName}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      ) : (
        /* SCHEDULES TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {currentRole === 'admin' && (
                    <th className="py-3.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredSchedules.length > 0 && selectedScheduleIds.length === filteredSchedules.length}
                        onChange={handleSelectAllFiltered}
                        className="rounded accent-emerald-600 cursor-pointer"
                        title="Pilih Semua"
                      />
                    </th>
                  )}
                  <th className="py-3.5 px-4">Hari / Tanggal</th>
                  <th className="py-3.5 px-4">Pos Piket</th>
                  <th className="py-3.5 px-4">Petugas Piket</th>
                  <th className="py-3.5 px-4">Shift &amp; Jam</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  {currentRole === 'admin' && <th className="py-3.5 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={currentRole === 'admin' ? 8 : 7} className="text-center py-10 text-slate-400 dark:text-slate-500">
                      Tidak ditemukan data jadwal piket.
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((sch) => {
                    const badge = getStatusBadgeColor(sch.status);
                    const isSelected = selectedScheduleIds.includes(sch.id);
                    return (
                      <tr 
                        key={sch.id} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        {currentRole === 'admin' && (
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleScheduleSelection(sch.id)}
                              className="rounded accent-emerald-600 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-white block">{sch.hari}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{formatDateIndo(sch.tanggal)}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">{sch.postName}</td>
                        <td className="py-3 px-4 max-w-[200px]">
                          <RunningText
                            text={sch.userName}
                            maxLength={20}
                            className="font-bold text-emerald-800 dark:text-emerald-400 block"
                          />
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{sch.userRole?.toUpperCase()}</span>
                          {sch.isReplacement && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold flex items-center gap-1 w-fit mt-0.5 max-w-[180px]">
                              <span>Ganti</span>
                              <RunningText text={sch.originalUserName || ''} maxLength={14} />
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          <span className="font-medium block">{sch.shiftName}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{sch.jamMulai} - {sch.jamSelesai} WIB</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{sch.notes || '-'}</td>
                        {currentRole === 'admin' && (
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleOpenEditScheduleModal(sch)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                              title="Edit Jadwal"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteScheduleState({
                                  isOpen: true,
                                  scheduleId: sch.id,
                                  userName: sch.userName || 'Petugas',
                                  postName: sch.postName || 'Pos Piket',
                                  tanggal: sch.tanggal
                                });
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Batch Selection Bar for Table View */}
      {selectedScheduleIds.length > 0 && viewMode === 'table' && currentRole === 'admin' && (
        <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:left-6 z-40 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-700 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-xs">
              {selectedScheduleIds.length}
            </div>
            <div>
              <p className="text-xs font-bold">{selectedScheduleIds.length} Jadwal Piket Dipilih</p>
              <p className="text-[11px] text-slate-400">Siap dihapus massal dari database lokal &amp; Cloud Firebase.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleConfirmDeleteSelected}
              className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer transition active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus {selectedScheduleIds.length} Jadwal Terpilih</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedScheduleIds([])}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition"
            >
              Batal Pilihan
            </button>
          </div>
        </div>
      )}

      {/* MODAL INPUT MULTI PETUGAS HARIAN (BATCH CREATOR) */}
      <BatchMultiScheduleModal
        isOpen={showBatchMultiModal}
        onClose={() => setShowBatchMultiModal(false)}
      />

      {/* ADD SINGLE SCHEDULE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingScheduleId ? 'Edit Jadwal Piket' : '+ Buat Jadwal Piket Single'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveSingleSchedule} className="space-y-4">
              {conflictWarning && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  {conflictWarning}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Tanggal Piket</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => {
                    setFormDate(e.target.value);
                    checkConflict(e.target.value, formUserId, formShiftId);
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Pos Piket</label>
                <select
                  value={formPostId}
                  onChange={(e) => setFormPostId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                >
                  {posts.map((p) => <option key={p.id} value={p.id}>{p.namaPos}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Shift Jam</label>
                <select
                  value={formShiftId}
                  onChange={(e) => {
                    setFormShiftId(e.target.value);
                    checkConflict(formDate, formUserId, e.target.value);
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                >
                  {shifts.map((s) => <option key={s.id} value={s.id}>{s.namaShift} ({s.jamMulai} - {s.jamSelesai})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Guru / Petugas</label>
                <select
                  value={formUserId}
                  onChange={(e) => {
                    setFormUserId(e.target.value);
                    checkConflict(formDate, e.target.value, formShiftId);
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold"
                >
                  {users.map((u) => <option key={u.id} value={u.id}>{u.nama} ({u.role.toUpperCase()})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Catatan Khusus Pos</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: Fokus sambut siswa 5S dan penyeberangan"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div>
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 cursor-pointer transition hover:bg-amber-100/70 dark:hover:bg-amber-950/60">
                  <input
                    type="checkbox"
                    checked={formIsDadakan}
                    onChange={(e) => setFormIsDadakan(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                      🚨 Tandai sebagai Jadwal Piket Dadakan / Instruksi Cepat
                    </span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-0.5 leading-snug">
                      Guru yang ditugaskan akan langsung menerima pengumuman darurat real-time di dashboard &amp; notifikasi instan untuk konfirmasi terima atau ajukan pengganti.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                {editingScheduleId && currentRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      const sch = schedules.find((s) => s.id === editingScheduleId);
                      setShowAddModal(false);
                      if (sch) {
                        setDeleteScheduleState({
                          isOpen: true,
                          scheduleId: sch.id,
                          userName: sch.userName || 'Petugas',
                          postName: sch.postName || 'Pos Piket',
                          tanggal: sch.tanggal
                        });
                      }
                    }}
                    className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-rose-200 dark:border-rose-900"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Jadwal</span>
                  </button>
                )}

                <div className="flex flex-1 gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    Simpan Jadwal
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1 SEMESTER MASS GENERATOR WIZARD */}
      {showSemesterWizard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-xl">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Wizard Input Jadwal 1 Semester Massal</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Generate otomatis jadwal berulang selama satu semester penuh</p>
                </div>
              </div>
              <button onClick={() => setShowSemesterWizard(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Tanggal Mulai Semester</label>
                <input
                  type="date"
                  value={wizardStartDate}
                  onChange={(e) => setWizardStartDate(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">Tanggal Akhir Semester</label>
                <input
                  type="date"
                  value={wizardEndDate}
                  onChange={(e) => setWizardEndDate(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>
            </div>

            {/* Matrix Day & Post Mapping */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Pola Jadwal Mingguan (Senin s/d Sabtu)
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950">
                {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((day) => (
                  <div key={day} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-2">
                      <span>Hari {day}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {posts.slice(0, 2).map((post) => (
                        <div key={post.id} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{post.namaPos}</span>
                          <select
                            value={wizardAssignments[day]?.[post.id]?.[0] || users[0]?.id}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWizardAssignments((prev) => ({
                                ...prev,
                                [day]: {
                                  ...(prev[day] || {}),
                                  [post.id]: [val]
                                }
                              }));
                            }}
                            className="w-full text-[11px] p-1.5 mt-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md font-semibold"
                          >
                            {users.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200">
              💡 Sistem akan mengulang pola mingguan ini secara otomatis pada setiap tanggal efektif tanpa perlu memasukkan satu per satu.
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleRunSemesterGenerator}
                disabled={generating}
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-teal-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {generating ? 'Menggenerate...' : '✨ Generate Jadwal 1 Semester'}
              </button>
              <button
                onClick={() => setShowSemesterWizard(false)}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL FOR SINGLE SCHEDULE */}
      <ConfirmDeleteModal
        isOpen={deleteScheduleState.isOpen}
        onClose={() => setDeleteScheduleState((prev) => ({ ...prev, isOpen: false }))}
        title="Konfirmasi Hapus Jadwal Piket"
        itemName={`Jadwal: ${deleteScheduleState.userName}`}
        itemDetails={`Pos: ${deleteScheduleState.postName} • Tanggal: ${formatDateIndo(deleteScheduleState.tanggal || getTodayDateString())}`}
        onConfirm={async () => {
          await deleteSchedule(deleteScheduleState.scheduleId);
          sound.playSuccess();
          showSuccessToast(`Jadwal piket ${deleteScheduleState.userName} berhasil dihapus.`);
        }}
      />

      {/* CONFIRM DELETE MODAL FOR BULK SCHEDULES */}
      <ConfirmDeleteModal
        isOpen={bulkDeleteState.isOpen}
        onClose={() => setBulkDeleteState((prev) => ({ ...prev, isOpen: false }))}
        title={bulkDeleteState.title || "Konfirmasi Hapus Massal Jadwal"}
        itemName={`${bulkDeleteState.ids.length} Jadwal Piket`}
        itemDetails={bulkDeleteState.description || "Data jadwal piket terpilih akan dihapus permanen dari penyimpanan lokal dan Cloud Firestore."}
        onConfirm={handleExecuteBulkDelete}
      />

    </div>
  );
};
