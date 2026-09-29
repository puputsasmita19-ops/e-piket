import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Crosshair, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Sliders, 
  Compass, 
  Layers, 
  ShieldCheck, 
  Navigation,
  Sparkles,
  Info,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { gpsService, AccurateGpsReading } from '../../services/gpsService';
import { School, SystemSettings } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { formatDateIndo, formatTimeIndo } from '../../utils/formatters';
import { sound } from '../../utils/feedback';

interface SchoolGpsConfigPanelProps {
  school: School;
  systemSettings?: SystemSettings;
  onUpdateSchool: (updatedSchool: Partial<School>) => Promise<void> | void;
  onUpdateSystemSettings?: (updatedSettings: Partial<SystemSettings>) => Promise<void> | void;
}

export const SchoolGpsConfigPanel: React.FC<SchoolGpsConfigPanelProps> = ({
  school,
  systemSettings,
  onUpdateSchool,
  onUpdateSystemSettings
}) => {
  const { currentUser } = useAuth();

  const [lat, setLat] = useState<number>(school?.latitude || -6.229746);
  const [lng, setLng] = useState<number>(school?.longitude || 106.807493);
  const [radius, setRadius] = useState<number>(school?.radiusPresensiMeter || 250);
  const [isLocked, setIsLocked] = useState<boolean>(Boolean(school?.isGpsLocked));
  const [lockedAt, setLockedAt] = useState<string | undefined>(school?.gpsLockedAt);
  const [lockedBy, setLockedBy] = useState<string | undefined>(school?.gpsLockedBy);

  const [detectingGps, setDetectingGps] = useState(false);
  const [detectingStep, setDetectingStep] = useState<string>('');
  const [detectedAccuracy, setDetectedAccuracy] = useState<number | null>(school?.gpsAccuracyMeters || null);
  const [lastAutoDetectAt, setLastAutoDetectAt] = useState<string | undefined>(school?.gpsAutoDetectedAt);

  const [testingDistance, setTestingDistance] = useState(false);
  const [testedDistance, setTestedDistance] = useState<number | null>(null);
  const [showConfirmUnlockModal, setShowConfirmUnlockModal] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [pasteLinkInput, setPasteLinkInput] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);

  // Sync internal state whenever parent school changes
  useEffect(() => {
    if (!school) return;
    if (school.latitude !== undefined) setLat(school.latitude);
    if (school.longitude !== undefined) setLng(school.longitude);
    if (school.radiusPresensiMeter !== undefined) setRadius(school.radiusPresensiMeter);
    if (school.isGpsLocked !== undefined) setIsLocked(Boolean(school.isGpsLocked));
    if (school.gpsLockedAt !== undefined) setLockedAt(school.gpsLockedAt);
    if (school.gpsLockedBy !== undefined) setLockedBy(school.gpsLockedBy);
    if (school.gpsAccuracyMeters !== undefined) setDetectedAccuracy(school.gpsAccuracyMeters);
    if (school.gpsAutoDetectedAt !== undefined) setLastAutoDetectAt(school.gpsAutoDetectedAt);
  }, [school]);

  // 1. Automatic High-Accuracy GPS Detection
  const handleAutoDetectCoordinates = async () => {
    if (isLocked) {
      showErrorToast('Titik koordinat sedang terkunci. Buka kunci terlebih dahulu untuk menentukan titik baru.');
      return;
    }

    setDetectingGps(true);
    setDetectingStep('Meminta izin akses GPS sensor...');

    try {
      setDetectingStep('Mendeteksi sinyal satelit & akurasi...');
      const reading = await gpsService.getHighAccuracyPosition(2, 7000);
      
      setLat(reading.latitude);
      setLng(reading.longitude);
      setDetectedAccuracy(reading.accuracy);
      const nowIso = new Date().toISOString();
      setLastAutoDetectAt(nowIso);

      // Instantly update parent state
      await onUpdateSchool({
        latitude: reading.latitude,
        longitude: reading.longitude,
        gpsAccuracyMeters: reading.accuracy,
        gpsAutoDetectedAt: nowIso
      });

      if (onUpdateSystemSettings) {
        await onUpdateSystemSettings({
          schoolLatitude: reading.latitude,
          schoolLongitude: reading.longitude,
          gpsAccuracyMeters: reading.accuracy,
          gpsAutoDetectedAt: nowIso
        });
      }

      sound.playSuccess();
      showSuccessToast(`Titik koordinat berhasil diambil otomatis: ${reading.latitude}, ${reading.longitude} (Akurasi: ±${reading.accuracy}m)!`);
    } catch (err: any) {
      sound.playWarning();
      showErrorToast(err.message || 'Gagal membaca GPS otomatis. Pastikan izin lokasi browser telah diaktifkan.');
    } finally {
      setDetectingGps(false);
      setDetectingStep('');
    }
  };

  // Quick Copy Coordinates
  const handleCopyCoordinates = () => {
    const text = `${lat}, ${lng}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCoords(true);
      showSuccessToast(`Koordinat disalin: ${text}`);
      setTimeout(() => setCopiedCoords(false), 2500);
    }).catch(() => {
      showSuccessToast(`Koordinat: ${text}`);
    });
  };

  // Helper to parse pasted Google Maps link or raw coordinates
  const handleApplyPastedCoordinates = () => {
    if (!pasteLinkInput.trim()) return;
    const raw = pasteLinkInput.trim();

    // 1. Try matching lat, lng directly: e.g. "-6.229746, 106.807493" or "-6.229746 106.807493"
    const directMatch = raw.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
    if (directMatch) {
      const parsedLat = Number(directMatch[1]);
      const parsedLng = Number(directMatch[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        applyNewCoords(parsedLat, parsedLng);
        return;
      }
    }

    // 2. Try matching google maps URL: @-6.229746,106.807493 or q=-6.229746,106.807493
    const urlMatch = raw.match(/[@=](-?\d+\.\d+),(-?\d+\.\d+)/);
    if (urlMatch) {
      const parsedLat = Number(urlMatch[1]);
      const parsedLng = Number(urlMatch[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        applyNewCoords(parsedLat, parsedLng);
        return;
      }
    }

    showErrorToast('Format link atau koordinat tidak dikenali. Masukkan format seperti "-6.229746, 106.807493" atau tautan Google Maps.');
  };

  const applyNewCoords = async (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setShowPasteModal(false);
    setPasteLinkInput('');

    await onUpdateSchool({
      latitude: newLat,
      longitude: newLng
    });

    if (onUpdateSystemSettings) {
      await onUpdateSystemSettings({
        schoolLatitude: newLat,
        schoolLongitude: newLng
      });
    }

    sound.playSuccess();
    showSuccessToast(`Koordinat diperbarui ke: ${newLat}, ${newLng}`);
  };

  // 2. Lock Coordinates
  const handleLockCoordinates = async () => {
    const nowIso = new Date().toISOString();
    const adminName = currentUser?.nama || 'Administrator e-Piket';

    setIsLocked(true);
    setLockedAt(nowIso);
    setLockedBy(adminName);

    await onUpdateSchool({
      latitude: lat,
      longitude: lng,
      radiusPresensiMeter: radius,
      isGpsLocked: true,
      gpsLockedAt: nowIso,
      gpsLockedBy: adminName
    });

    if (onUpdateSystemSettings) {
      await onUpdateSystemSettings({
        schoolLatitude: lat,
        schoolLongitude: lng,
        gpsRadiusMeters: radius,
        isGpsLocked: true,
        gpsLockedAt: nowIso,
        gpsLockedBy: adminName
      });
    }

    showSuccessToast('Titik koordinat GPS dan radius presensi sekolah berhasil DIKUNCI!');
  };

  // 3. Unlock Coordinates
  const handleUnlockCoordinates = async () => {
    setIsLocked(false);
    setShowConfirmUnlockModal(false);

    await onUpdateSchool({
      isGpsLocked: false
    });

    if (onUpdateSystemSettings) {
      await onUpdateSystemSettings({
        isGpsLocked: false
      });
    }

    showSuccessToast('Kunci titik koordinat GPS berhasil dibuka. Anda dapat mengubah atau mendeteksi ulang titik.');
  };

  // 4. Test Current Distance
  const handleTestDistance = async () => {
    setTestingDistance(true);
    try {
      const reading = await gpsService.getHighAccuracyPosition(1, 6000);
      const dist = gpsService.calculateDistanceMeters(reading.latitude, reading.longitude, lat, lng);
      setTestedDistance(dist);
      showSuccessToast(`Jarak Anda saat ini: ${dist} meter dari titik sekolah (Radius: ${radius}m).`);
    } catch (err: any) {
      showErrorToast(err.message || 'Gagal mengukur jarak.');
    } finally {
      setTestingDistance(false);
    }
  };

  // Quick Preset Radiuses
  const presets = [50, 100, 150, 250, 500, 1000];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6 transition-colors">
      
      {/* Header & Lock State Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${
            isLocked 
              ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' 
              : 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
          }`}>
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Pengaturan Titik Koordinat GPS & Validasi Radius Presensi
              </h3>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                isLocked
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
                {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                <span>{isLocked ? 'STATUS: TERKUNCI RESMI' : 'STATUS: DAPAT DIEDIT'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Menentukan titik lintang (latitude) & bujur (longitude) pusat sekolah serta toleransi jarak presensi guru.
            </p>
          </div>
        </div>

        {/* Lock / Unlock Primary Action */}
        <div>
          {isLocked ? (
            <button
              type="button"
              onClick={() => setShowConfirmUnlockModal(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-500" />
              <span>Buka Kunci Koordinat</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLockCoordinates}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition active:scale-95 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kunci Titik Koordinat Resmi</span>
            </button>
          )}
        </div>
      </div>

      {/* Lock Metadata Banner */}
      {isLocked && lockedAt && (
        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Titik Koordinat GPS Telah Dikunci Resmi:</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Dikunci oleh <strong>{lockedBy || 'Administrator'}</strong> pada{' '}
              {formatDateIndo(lockedAt.split('T')[0])} ({formatTimeIndo(lockedAt)} WIB). Perubahan tidak disengaja dicegah agar validasi presensi guru tetap konsisten.
            </p>
          </div>
        </div>
      )}

      {/* 1. AUTO-DETECT GPS BUTTON & STATUS */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Crosshair className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Tentukan Titik Koordinat Otomatis (GPS Akurasi Tinggi)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Berdiri di area pusat sekolah (lapangan / gerbang), lalu tekan tombol ini untuk mengambil koordinat presisi via GPS browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              disabled={isLocked}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tempel Link Maps / Input</span>
            </button>

            <button
              type="button"
              onClick={handleAutoDetectCoordinates}
              disabled={detectingGps || isLocked}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                isLocked
                  ? 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${detectingGps ? 'animate-spin' : ''}`} />
              <span>{detectingGps ? (detectingStep || 'Mengukur GPS...') : 'Ambil Titik Otomatis (GPS)'}</span>
            </button>
          </div>
        </div>

        {detectingGps && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex items-center gap-2 text-emerald-900 dark:text-emerald-200 animate-pulse">
            <Crosshair className="w-4 h-4 animate-spin text-emerald-600" />
            <span className="font-semibold">{detectingStep || 'Sedang mengukur posisi satelit GPS presisi tinggi...'}</span>
          </div>
        )}

        {detectedAccuracy !== null && !detectingGps && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Akurasi GPS Terakhir: ±{detectedAccuracy} meter</span>
              </span>
              {lastAutoDetectAt && (
                <span className="text-slate-400 font-mono">
                  • Diperbarui: {formatTimeIndo(lastAutoDetectAt)} WIB
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="px-2.5 py-1 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1 transition cursor-pointer"
            >
              {copiedCoords ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCoords ? 'Tersalin!' : 'Salin Koordinat'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. COORDINATE INPUTS (LAT & LNG) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
            Latitude Titik Sekolah (Lintang)
          </label>
          <input
            type="number"
            step="any"
            disabled={isLocked}
            value={lat}
            onChange={(e) => {
              const val = Number(e.target.value);
              setLat(val);
              onUpdateSchool({ latitude: val });
              if (onUpdateSystemSettings) onUpdateSystemSettings({ schoolLatitude: val });
            }}
            placeholder="Contoh: -6.229746"
            className={`w-full p-2.5 rounded-xl font-mono text-xs border ${
              isLocked
                ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700'
            }`}
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Derajat desimal (e.g. -6.229746 untuk wilayah Jakarta)
          </span>
        </div>

        <div>
          <label className="block font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
            Longitude Titik Sekolah (Bujur)
          </label>
          <input
            type="number"
            step="any"
            disabled={isLocked}
            value={lng}
            onChange={(e) => {
              const val = Number(e.target.value);
              setLng(val);
              onUpdateSchool({ longitude: val });
              if (onUpdateSystemSettings) onUpdateSystemSettings({ schoolLongitude: val });
            }}
            placeholder="Contoh: 106.807493"
            className={`w-full p-2.5 rounded-xl font-mono text-xs border ${
              isLocked
                ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700'
            }`}
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Derajat desimal (e.g. 106.807493 untuk wilayah Jakarta)
          </span>
        </div>
      </div>

      {/* 3. RADIUS PRESENSI SLIDER & PRESETS */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span>Validasi Radius Presensi Guru (Geofence)</span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Guru wajib berada dalam batas jarak ini dari titik pusat sekolah untuk dapat melakukan presensi selfie.
            </p>
          </div>

          <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-800 dark:text-indigo-300 font-black text-sm font-mono">
            {radius} Meter
          </div>
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min={25}
          max={1000}
          step={25}
          value={radius}
          onChange={(e) => {
            const val = Number(e.target.value);
            setRadius(val);
            onUpdateSchool({ radiusPresensiMeter: val });
            if (onUpdateSystemSettings) onUpdateSystemSettings({ gpsRadiusMeters: val });
          }}
          className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
        />

        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Preset:</span>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setRadius(p);
                onUpdateSchool({ radiusPresensiMeter: p });
                if (onUpdateSystemSettings) onUpdateSystemSettings({ gpsRadiusMeters: p });
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                radius === p
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {p}m
            </button>
          ))}
        </div>
      </div>

      {/* 4. RADAR SIMULASI, MAP PREVIEW & UJI JARAK ADMIN */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Simulasi Uji Jarak Lokasi Admin
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMapPreview(!showMapPreview)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showMapPreview ? 'Tutup Peta' : 'Pratinjau Peta Satelit'}</span>
            </button>

            <button
              type="button"
              onClick={handleTestDistance}
              disabled={testingDistance}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Navigation className={`w-3.5 h-3.5 ${testingDistance ? 'animate-spin' : ''}`} />
              <span>{testingDistance ? 'Mengukur Jarak...' : 'Uji Jarak Sekarang'}</span>
            </button>

            <a
              href={gpsService.getMapUrl(lat, lng)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {showMapPreview && (
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-1 space-y-2 animate-in fade-in">
            <iframe
              title="Pratinjau Lokasi Sekolah"
              width="100%"
              height="240"
              style={{ border: 0, borderRadius: '0.75rem' }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`}
            />
            <div className="flex items-center justify-between text-[11px] px-2 text-slate-400">
              <span>Titik Pusat: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
              <span>Radius Presensi: {radius} meter</span>
            </div>
          </div>
        )}

        {testedDistance !== null && (
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            testedDistance <= radius 
              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200' 
              : 'bg-rose-950/60 border-rose-700 text-rose-200'
          }`}>
            <span>
              Jarak Anda saat ini: <strong>{testedDistance} meter</strong> dari titik sekolah
            </span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
              testedDistance <= radius ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}>
              {testedDistance <= radius ? 'DI DALAM RADIUS' : 'DI LUAR RADIUS'}
            </span>
          </div>
        )}
      </div>

      {/* MODAL TEMPEL LINK / KOORDINAT */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Input / Tempel Koordinat Sekolah
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Tempel link Google Maps atau angka koordinat titik sekolah Anda:
              </p>

              <input
                type="text"
                value={pasteLinkInput}
                onChange={(e) => setPasteLinkInput(e.target.value)}
                placeholder="Contoh: -6.229746, 106.807493 atau https://maps.app.goo.gl/..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 space-y-1">
                <p className="font-bold text-slate-700 dark:text-slate-300">Format yang didukung:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Angka Lintang, Bujur (e.g. <code>-6.229746, 106.807493</code>)</li>
                  <li>Link Google Maps pin lokasi sekolah</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleApplyPastedCoordinates}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/30 transition cursor-pointer"
              >
                Terapkan Koordinat
              </button>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM UNLOCK MODAL */}
      {showConfirmUnlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Unlock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Buka Kunci Titik Koordinat GPS Sekolah?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Membuka kunci memungkinkan perubahan latitude, longitude, dan deteksi ulang GPS. Pastikan perubahan dilakukan saat berada di lokasi sekolah resmi.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleUnlockCoordinates}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-600/30 transition cursor-pointer"
              >
                Ya, Buka Kunci
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmUnlockModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
