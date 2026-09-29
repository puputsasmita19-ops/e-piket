import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { School as SchoolIcon, Lock, User as UserIcon, Eye, EyeOff, ShieldCheck, AlertCircle, Sun, Moon, Info, X, Key, Delete, RotateCcw, ChevronDown, Check, Zap, ArrowRight, Fingerprint, ScanFace, CheckCircle2, Smartphone, HelpCircle, Search, Users, GraduationCap, Briefcase, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { User, UserRole } from '../../types';
import { biometricService } from '../../services/biometricService';
import { sound, haptic } from '../../utils/feedback';
import { RunningText } from '../common/RunningText';

export const LoginPage: React.FC = () => {
  const { login, loginWithPin, quickLoginAs, usersList } = useAuth();
  const { school, systemSettings } = useData();
  const { isDarkMode, toggleTheme } = useTheme();

  // Selected User state for banking-style PIN entry (defaults to Admin or first user)
  const [selectedUser, setSelectedUser] = useState<User>(() => {
    return usersList.find((u) => u.role === 'admin') || usersList[0];
  });

  // Keep selectedUser in sync if usersList loads/updates
  useEffect(() => {
    if (selectedUser && usersList.length > 0) {
      const exists = usersList.find(u => u.id === selectedUser.id);
      if (!exists) {
        setSelectedUser(usersList.find((u) => u.role === 'admin') || usersList[0]);
      }
    } else if (!selectedUser && usersList.length > 0) {
      setSelectedUser(usersList.find((u) => u.role === 'admin') || usersList[0]);
    }
  }, [usersList]);

  // PIN state (max 6 digits)
  const [pin, setPin] = useState<string>('');
  const [showPinDigits, setShowPinDigits] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const lastPressTimeRef = useRef<number>(0);

  // Biometric state
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState<boolean>(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean>(true);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);

  // Switch to classic username/password form
  const [useClassicLogin, setUseClassicLogin] = useState<boolean>(false);
  const [classicUsername, setClassicUsername] = useState<string>('admin');
  const [classicPassword, setClassicPassword] = useState<string>('password123');
  const [showClassicPassword, setShowClassicPassword] = useState<boolean>(false);

  // Modals
  const [showAccountSelector, setShowAccountSelector] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Account Selector search & filter state
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>('');
  const [accountRoleFilter, setAccountRoleFilter] = useState<'all' | 'guru' | 'tendik' | 'kepsek' | 'admin'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const appName = systemSettings?.appBranding?.namaAplikasi || 'e-Piket Digital';
  const appDesc = systemSettings?.appBranding?.keterangan || 'Sistem Pengelolaan Jadwal Piket Guru & Buku Piket Digital';
  const logoUrl = systemSettings?.appBranding?.logoUrl;
  const authorName = systemSettings?.appBranding?.namaPembuat || 'Tim IT Sekolah';
  const year = systemSettings?.appBranding?.copyrightYear || '2026';

  // Focus search input whenever modal opens
  useEffect(() => {
    if (showAccountSelector) {
      setAccountSearchQuery('');
      setAccountRoleFilter('all');
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showAccountSelector]);

  // Counts per category for pills
  const counts = useMemo(() => {
    const active = usersList.filter((u) => u.statusAktif);
    return {
      all: active.length,
      guru: active.filter((u) => u.role === 'guru').length,
      tendik: active.filter((u) => u.role === 'tendik').length,
      kepsek: active.filter((u) => u.role === 'kepsek').length,
      admin: active.filter((u) => u.role === 'admin').length,
    };
  }, [usersList]);

  // Filtered accounts based on search query & role pill
  const filteredAccountUsers = useMemo(() => {
    const active = usersList.filter((u) => u.statusAktif);
    return active.filter((u) => {
      if (accountRoleFilter !== 'all' && u.role !== accountRoleFilter) {
        return false;
      }
      if (!accountSearchQuery.trim()) return true;
      const q = accountSearchQuery.toLowerCase().trim();
      const matchName = u.nama.toLowerCase().includes(q);
      const matchNip = u.nip ? u.nip.toLowerCase().includes(q) : false;
      const matchNuptk = u.nuptk ? u.nuptk.toLowerCase().includes(q) : false;
      const matchJabatan = u.jabatan ? u.jabatan.toLowerCase().includes(q) : false;
      const matchUsername = u.username ? u.username.toLowerCase().includes(q) : false;
      const matchRole = u.role.toLowerCase().includes(q);
      return matchName || matchNip || matchNuptk || matchJabatan || matchUsername || matchRole;
    });
  }, [usersList, accountRoleFilter, accountSearchQuery]);

  // Check biometric enrollment on user selection change
  useEffect(() => {
    if (selectedUser) {
      setIsBiometricEnrolled(biometricService.isUserEnrolled(selectedUser.id));
      biometricService.checkAvailability().then((avail) => setBiometricSupported(avail));
    }
  }, [selectedUser]);

  // Handle Biometric Login
  const handleBiometricLogin = async () => {
    if (biometricLoading || !selectedUser) return;
    setBiometricLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await biometricService.verifyBiometric(selectedUser.id, selectedUser.nama, 'login');
      if (res.success) {
        sound.playSuccess();
        setSuccessMessage(res.message);
        setTimeout(() => {
          quickLoginAs(selectedUser.role, selectedUser.id);
        }, 300);
      } else {
        setErrorMessage('Verifikasi biometrik tidak cocok atau dibatalkan.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal melakukan verifikasi biometrik.');
    } finally {
      setBiometricLoading(false);
    }
  };

  // Handle Register Biometric from Login Page
  const handleRegisterBiometric = async () => {
    if (biometricLoading || !selectedUser) return;
    setBiometricLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await biometricService.registerBiometric(selectedUser.id, selectedUser.nama);
      if (res.success) {
        setIsBiometricEnrolled(true);
        sound.playSuccess();
        setSuccessMessage(res.message);
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Pendaftaran biometrik gagal.');
    } finally {
      setBiometricLoading(false);
    }
  };

  // Handle PIN verification
  const handleVerifyPin = useCallback(async (pinToVerify: string) => {
    if (pinToVerify.length < 6) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await loginWithPin(pinToVerify, selectedUser?.id);
      if (!res.success) {
        setIsShaking(true);
        setErrorMessage(res.message || 'PIN Keamanan tidak sesuai.');
        setTimeout(() => setIsShaking(false), 500);
        setTimeout(() => setPin(''), 550);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi gangguan saat memverifikasi PIN.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  }, [loginWithPin, selectedUser?.id]);

  // Instant Keypad actions with zero latency and direct verification trigger
  const handleKeyPress = useCallback((digit: string) => {
    if (loading) return;
    setErrorMessage('');
    
    // Non-blocking instant audio/haptic
    try {
      haptic.light();
    } catch {}

    setPin((prev) => {
      if (prev.length >= 6) return prev;
      const nextPin = prev + digit;
      if (nextPin.length === 6) {
        setTimeout(() => {
          handleVerifyPin(nextPin);
        }, 0);
      }
      return nextPin;
    });
  }, [loading, handleVerifyPin]);

  const handleBackspace = useCallback(() => {
    if (loading) return;
    setErrorMessage('');
    try {
      haptic.light();
    } catch {}
    setPin((prev) => prev.slice(0, -1));
  }, [loading]);

  const handleClear = useCallback(() => {
    if (loading) return;
    setErrorMessage('');
    try {
      haptic.light();
    } catch {}
    setPin('');
  }, [loading]);

  // Fast Button Press Handler
  const handleFastButtonPress = useCallback((action: () => void) => () => {
    action();
  }, []);

  // Physical Keyboard Listener
  useEffect(() => {
    if (useClassicLogin || showAccountSelector || showHelpModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [useClassicLogin, showAccountSelector, showHelpModal, handleKeyPress, handleBackspace, handleClear]);

  // Handle Classic Form Submit
  const handleClassicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const res = await login(classicUsername, classicPassword);
      if (!res.success) {
        setErrorMessage(res.message || 'Username atau kata sandi tidak cocok.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat mencoba masuk.');
    } finally {
      setLoading(false);
    }
  };

  // Keypad layout definition inspired by mobile banking apps
  const keypadButtons = [
    { num: '1' },
    { num: '2' },
    { num: '3' },
    { num: '4' },
    { num: '5' },
    { num: '6' },
    { num: '7' },
    { num: '8' },
    { num: '9' },
    { num: 'C', action: handleClear },
    { num: '0' },
    { num: '⌫', action: handleBackspace }
  ];

  return (
    <div className="h-screen max-h-screen w-full overflow-hidden flex items-center justify-center p-3 sm:p-4 relative select-none transition-colors duration-300 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      
      {/* Ambient background glow */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40 bg-emerald-200 dark:bg-emerald-900/20"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40 bg-teal-200 dark:bg-teal-900/20"></div>

      {/* Theme Toggle Button (Top Right) */}
      <div className="absolute top-4 right-4 z-40">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer bg-white/90 text-slate-800 hover:bg-white border border-slate-200/90 dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-750"
        >
          {isDarkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline font-semibold">Mode Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline font-semibold">Mode Gelap</span>
            </>
          )}
        </button>
      </div>

      {/* Main Single-Frame Bank-Inspired Card */}
      <div className="w-full max-w-sm sm:max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl relative z-10 transition-all duration-300 border bg-white/95 backdrop-blur-xl border-white/90 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.25)] dark:bg-slate-900/95 dark:border-slate-800 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] max-h-[96vh] flex flex-col justify-between overflow-y-auto">
        
        {/* App Logo & School Name Header */}
        <div className="text-center mb-1.5 sm:mb-2">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl shadow-md mb-1 transition-transform bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/25">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-6 h-6 sm:w-7 sm:h-7 object-contain rounded-lg" />
            ) : (
              <SchoolIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </div>
          
          <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            {appName}
          </h1>
          <p className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 truncate px-2">
            {school.nama}
          </p>
          <p className="text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
            {appDesc}
          </p>
        </div>

        {/* BANK-STYLE PIN LOGIN INTERFACE */}
        {!useClassicLogin ? (
          <div className="space-y-2.5">
            
            {/* Account Selector Badge (Profil Pengguna Aktif & Pencarian Cepat) */}
            <div 
              onClick={() => setShowAccountSelector(true)}
              className="group p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/50 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-400 dark:hover:border-emerald-600 flex items-center justify-between transition cursor-pointer shadow-xs"
              title="Klik untuk mencari & memilih nama guru / petugas"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden shadow-xs ring-2 ring-emerald-500/20">
                  {selectedUser.foto ? (
                    <img src={selectedUser.foto} alt={selectedUser.nama} className="w-full h-full object-cover" />
                  ) : (
                    <span>{selectedUser.nama.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* RUNNING TEXT FOR LONG TEACHER NAMES */}
                    <div className="min-w-0 flex-1">
                      <RunningText 
                        text={selectedUser.nama} 
                        maxLength={18}
                        className="text-xs font-black text-slate-900 dark:text-white"
                        wrapperClassName="w-full"
                      />
                    </div>
                    <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                      {selectedUser.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedUser.jabatan || 'Tenaga Pendidik / Staf'}
                  </p>
                </div>
              </div>

              <div className="px-2.5 py-1.5 rounded-xl bg-white group-hover:bg-emerald-600 group-hover:text-white dark:bg-slate-700 dark:group-hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-bold border border-slate-200 group-hover:border-emerald-600 dark:border-slate-600 flex items-center gap-1.5 shrink-0 transition-all shadow-xs">
                <Search className="w-3 h-3" />
                <span>Cari Guru</span>
              </div>
            </div>

            {/* Success & Error Notification Alerts */}
            {successMessage && (
              <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200 flex items-center gap-2 text-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-[11px]">{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200 flex items-start gap-2 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="font-medium text-[11px] leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* WEBAUTHN / BIOMETRIC QUICK LOGIN BUTTON */}
            <div className="p-2.5 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/90 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/90 dark:border-emerald-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200">
                    Otentikasi Biometrik
                  </span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  isBiometricEnrolled
                    ? 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                    : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {isBiometricEnrolled ? '✓ Sensor Siap' : 'Belum Aktif'}
                </span>
              </div>

              {isBiometricEnrolled ? (
                <button
                  type="button"
                  disabled={biometricLoading}
                  onClick={handleBiometricLogin}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {biometricLoading ? (
                    <>
                      <Zap className="w-3.5 h-3.5 animate-spin" />
                      <span>Memindai Biometrik...</span>
                    </>
                  ) : (
                    <>
                      <ScanFace className="w-4 h-4" />
                      <span>Masuk dengan Biometrik</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                    Masuk cepat &amp; presensi via sensor perangkat.
                  </p>
                  <button
                    type="button"
                    disabled={biometricLoading}
                    onClick={handleRegisterBiometric}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1 shadow-xs"
                  >
                    <Fingerprint className="w-3 h-3" />
                    <span>Daftarkan</span>
                  </button>
                </div>
              )}
            </div>

            {/* PIN Entry Header with Quick Help & Eye Action */}
            <div className={`text-center space-y-1 py-0.5 ${isShaking ? 'animate-bounce' : ''}`}>
              <div className="flex items-center justify-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Masukkan 6-Digit PIN
                </p>

                {/* Eye Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowPinDigits(!showPinDigits)}
                  className="p-1 rounded-full text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  title={showPinDigits ? 'Sembunyikan Angka' : 'Tampilkan Angka'}
                >
                  {showPinDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* 6 Discrete Banking PIN Indicators */}
              <div className="flex items-center justify-center gap-3 py-1">
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const isFilled = index < pin.length;
                  const currentDigit = pin[index];

                  return (
                    <div
                      key={index}
                      className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isFilled
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/50 scale-110'
                          : 'border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80'
                      }`}
                    >
                      {isFilled && showPinDigits && (
                        <span className="text-[10px] font-mono font-black">
                          {currentDigit}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {loading && (
                <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1.5 animate-pulse">
                  <Zap className="w-3 h-3 animate-spin" />
                  <span>Memverifikasi PIN...</span>
                </p>
              )}
            </div>

            {/* NUMERIC KEYPAD */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {keypadButtons.map((btn, idx) => {
                const isSpecial = btn.num === 'C' || btn.num === '⌫';
                const onClickAction = btn.action || (() => handleKeyPress(btn.num));

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={loading}
                    onClick={onClickAction}
                    style={{ touchAction: 'manipulation' }}
                    className={`h-10 sm:h-11 rounded-2xl flex items-center justify-center cursor-pointer shadow-xs border select-none transition-transform duration-75 active:scale-90 ${
                      isSpecial
                        ? 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-750 dark:active:bg-slate-700 dark:text-slate-300 dark:border-slate-700 font-bold text-sm sm:text-base'
                        : 'bg-white hover:bg-emerald-50/70 active:bg-emerald-600 active:text-white text-slate-900 border-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-750 dark:active:bg-emerald-600 dark:active:text-white dark:text-white dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-700 text-lg sm:text-xl font-bold'
                    }`}
                  >
                    <span>
                      {btn.num === '⌫' ? <Delete className="w-4 h-4 mx-auto" /> : btn.num}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ULTRA-COMPACT PROFESSIONAL ACTION BAR */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setUseClassicLogin(true);
                  setErrorMessage('');
                }}
                className="text-[11px] font-bold text-slate-700 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer transition"
              >
                <Key className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Username &amp; Password Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-300 transition cursor-pointer flex items-center gap-1 font-bold text-[10.5px]"
                title="Bantuan PIN & Petunjuk Akses"
              >
                <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Bantuan</span>
              </button>
            </div>

          </div>
        ) : (
          /* ALTERNATIVE CLASSIC USERNAME & PASSWORD FORM */
          <form onSubmit={handleClassicSubmit} className="space-y-3.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Masuk Kredensial Manual
              </span>
              <button
                type="button"
                onClick={() => {
                  setUseClassicLogin(false);
                  setErrorMessage('');
                }}
                className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
              >
                ← Mode PIN
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200 flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="text-[11px]">{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-800 dark:text-slate-200 mb-1">
                Username / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={classicUsername}
                  onChange={(e) => setClassicUsername(e.target.value)}
                  placeholder="admin atau guru1"
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-800 dark:text-slate-200 mb-1">
                Kata Sandi / PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showClassicPassword ? 'text' : 'password'}
                  required
                  value={classicPassword}
                  onChange={(e) => setClassicPassword(e.target.value)}
                  placeholder="password123 atau 123456"
                  className="w-full pl-9 pr-9 py-2 rounded-xl text-xs font-medium border bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowClassicPassword(!showClassicPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showClassicPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
            >
              <span>{loading ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Minimalist Footer */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            © {year} {appName} • {authorName}
          </p>
        </div>

      </div>

      {/* MODAL PILIH & CARI AKUN / NAMA GURU */}
      {showAccountSelector && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                    Cari &amp; Pilih Nama Guru / Petugas
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ketik nama atau filter untuk menemukan akun Anda dengan cepat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountSelector(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* INSTANT SEARCH BAR WITH AUTO-FOCUS */}
            <div className="relative shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600 dark:text-emerald-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={accountSearchQuery}
                onChange={(e) => setAccountSearchQuery(e.target.value)}
                placeholder="Cari nama guru, NIP, NUPTK, mata pelajaran..."
                className="w-full pl-10 pr-10 py-2.5 rounded-2xl text-xs sm:text-sm font-medium border bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition shadow-inner"
              />
              {accountSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setAccountSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* CATEGORY FILTER TABS */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setAccountRoleFilter('all')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  accountRoleFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Semua</span>
                <span className="opacity-80 text-[10px]">({counts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountRoleFilter('guru')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  accountRoleFilter === 'guru'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>👨‍🏫 Guru</span>
                <span className="opacity-80 text-[10px]">({counts.guru})</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountRoleFilter('tendik')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  accountRoleFilter === 'tendik'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>🏢 Tendik</span>
                <span className="opacity-80 text-[10px]">({counts.tendik})</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountRoleFilter('kepsek')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  accountRoleFilter === 'kepsek'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>👑 Kepsek</span>
                <span className="opacity-80 text-[10px]">({counts.kepsek})</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountRoleFilter('admin')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                  accountRoleFilter === 'admin'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>⚙️ Admin</span>
                <span className="opacity-80 text-[10px]">({counts.admin})</span>
              </button>
            </div>

            {/* RESULTS COUNTER */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 shrink-0 font-medium">
              <span>Menampilkan {filteredAccountUsers.length} petugas</span>
              {accountSearchQuery && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Hasil filter pencarian "{accountSearchQuery}"
                </span>
              )}
            </div>

            {/* SCROLLABLE LIST OF TEACHERS & STAFF WITH RUNNING TEXT */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 max-h-80 sm:max-h-96">
              {filteredAccountUsers.length > 0 ? (
                filteredAccountUsers.map((user) => {
                  const isSelected = selectedUser.id === user.id;

                  return (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setClassicUsername(user.username || user.role);
                        setPin('');
                        setErrorMessage('');
                        setShowAccountSelector(false);
                        sound.playClickTap();
                      }}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer group ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/50 dark:border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-emerald-50/40 dark:hover:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                          {user.foto ? (
                            <img src={user.foto} alt={user.nama} className="w-full h-full object-cover" />
                          ) : (
                            <span>{user.nama.substring(0, 2).toUpperCase()}</span>
                          )}
                        </div>

                        {/* Teacher Information with RunningText for long names */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="min-w-0 flex-1">
                              <RunningText
                                text={user.nama}
                                maxLength={22}
                                highlight={accountSearchQuery}
                                className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white"
                                wrapperClassName="w-full"
                              />
                            </div>
                            <span className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded-full shrink-0 ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : user.role === 'kepsek'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : user.role === 'tendik'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {user.role}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            <span>{user.jabatan || 'Tenaga Pendidik'}</span>
                            {(user.nip || user.nuptk) && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{user.nip ? `NIP ${user.nip}` : `NUPTK ${user.nuptk}`}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Select Action Indicator */}
                      <div className="shrink-0 flex items-center pl-2">
                        {isSelected ? (
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70">
                            Pilih
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      Nama guru/petugas tidak ditemukan
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Coba periksa kembali ejaan nama atau ubah filter kategori di atas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSearchQuery('');
                      setAccountRoleFilter('all');
                      searchInputRef.current?.focus();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Pencarian</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
              <span>💡 Klik nama Anda untuk langsung mengisi PIN</span>
              <button
                type="button"
                onClick={() => setShowAccountSelector(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL POP-UP BANTUAN PIN & PETUNJUK AKSES */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Bantuan PIN &amp; Petunjuk Akses
                  </h3>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    Petunjuk autentikasi cepat aplikasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 space-y-1">
                <p className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>PIN Default Seluruh Akun:</span>
                </p>
                <p className="font-mono text-lg font-black text-emerald-700 dark:text-emerald-300 tracking-widest text-center py-1">
                  123456
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400">
                  Gunakan PIN default <strong className="font-mono">123456</strong> untuk masuk ke akun Admin, Kepala Sekolah, maupun Guru Piket.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">Pengaturan &amp; Ganti PIN:</p>
                <p className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-snug">
                  Administrator dapat mengubah, mengelola, dan mereset PIN atau password setiap guru/tendik melalui menu <strong>Master Data &gt; Pengguna &amp; Guru</strong>.
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpModal(false);
                    setUseClassicLogin(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Beralih ke Form Username &amp; Password Manual</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-sm"
            >
              Tutup Petunjuk
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
