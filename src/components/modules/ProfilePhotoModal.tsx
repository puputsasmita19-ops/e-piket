import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, RefreshCw, FlipHorizontal, ShieldCheck, Sparkles, HardDrive, Image as ImageIcon, Trash2 } from 'lucide-react';
import { compressImageAuto, CompressionResult } from '../../utils/imageCompressor';
import { uploadProfilePhotoToDrive } from '../../services/driveService';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { sound } from '../../utils/feedback';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: string;
  currentPhoto?: string;
  onPhotoUpdated: (photoUrl: string, driveUrl?: string, compression?: CompressionResult) => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  userRole,
  currentPhoto,
  onPhotoUpdated
}) => {
  const { isGoogleDriveConnected, getDriveAccessToken } = useAuth();
  const { school } = useData();

  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera when closing or switching mode
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (!isOpen) return null;

  // Start Camera
  const startCamera = async (newFacingMode = facingMode) => {
    stopCamera();
    setErrorMessage(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      setFacingMode(newFacingMode);
      setMode('camera');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setErrorMessage(`Kamera tidak dapat diakses: ${err.message || 'Periksa izin kamera pada browser Anda.'}`);
    }
  };

  // Flip Camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(nextMode);
  };

  // Capture Photo from Camera
  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    stopCamera();
    await processAndPreviewImage(rawDataUrl);
  };

  // Handle File Input selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processAndPreviewImage(file);
    e.target.value = '';
  };

  // Compress and generate preview
  const processAndPreviewImage = async (input: File | Blob | string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await compressImageAuto(input, {
        maxDimension: 600,
        quality: 0.85,
        mimeType: 'image/jpeg'
      });

      setCompressionResult(result);
      setPreviewImage(result.dataUrl);
      setMode('preview');
      sound.playClickTap();
    } catch (err: any) {
      setErrorMessage(`Gagal memproses & mengompres foto: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save & Upload to Google Drive / Firebase
  const handleSavePhoto = async () => {
    if (!previewImage || !compressionResult) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let driveUrl: string | undefined = undefined;
      let driveFileId: string | undefined = undefined;

      // 1. Upload to Google Drive if OAuth is connected
      if (isGoogleDriveConnected) {
        try {
          const accessToken = await getDriveAccessToken();
          const uploadRes = await uploadProfilePhotoToDrive(
            compressionResult.blob,
            userName,
            userRole,
            school?.nama || 'Sekolah',
            accessToken
          );
          driveUrl = uploadRes.driveUrl;
          driveFileId = uploadRes.driveFileId;
        } catch (driveErr) {
          console.warn('Google Drive sync error, keeping Firebase photo:', driveErr);
        }
      }

      // 2. Callback to persist in Firebase & local context
      onPhotoUpdated(previewImage, driveUrl, compressionResult);
      sound.playSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan foto profil: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove photo (reset to default initials)
  const handleRemoveCurrentPhoto = () => {
    if (confirm('Apakah Anda yakin ingin menghapus foto profil ini dan kembali ke inisial avatar standar?')) {
      onPhotoUpdated('', undefined, undefined);
      sound.playSuccess();
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setMode('select');
    setPreviewImage(null);
    setCompressionResult(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] flex flex-col justify-between overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                Upload Foto Profil ({userRole.toUpperCase()})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[220px]">
                {userName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Content Body based on Mode */}
        {mode === 'select' && (
          <div className="space-y-4 text-center py-2">
            {/* Current / Active Photo Display */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="relative">
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt={userName}
                    className="w-28 h-28 rounded-full object-cover border-4 border-emerald-500/30 shadow-lg ring-4 ring-emerald-500/10"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-4xl flex items-center justify-center shadow-lg ring-4 ring-emerald-500/10">
                    {userName.charAt(0) || 'U'}
                  </div>
                )}

                <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-600 text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {currentPhoto ? 'Foto Profil Aktif' : 'Avatar Inisial Standar'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pilih file galeri atau potret langsung dari kamera
                </p>
              </div>
            </div>

            {/* Smart Storage & Compression Info Banner */}
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/90 dark:border-emerald-800/80 text-left space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Kompresi Otomatis Hemat Ruang &amp; Cloud Drive</span>
              </div>
              <p className="text-[10.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Setiap foto yang masuk dikompresi otomatis (~90%+ lebih hemat penyimpanan) dengan kualitas HD tajam, dan disinkronkan ke Firebase Cloud &amp; Google Drive.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* File Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Pilih dari Galeri / File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Camera Capture Button */}
              <button
                type="button"
                onClick={() => startCamera('user')}
                className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Ambil Foto Kamera</span>
              </button>
            </div>

            {/* Remove photo option if custom photo exists */}
            {currentPhoto && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRemoveCurrentPhoto}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Foto Profil (Gunakan Inisial)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Camera Mode */}
        {mode === 'camera' && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border-2 border-emerald-500/50 shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Circle Avatar Frame Guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-dashed border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                  <span className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded-full font-bold">
                    Posisikan Wajah di Sini
                  </span>
                </div>
              </div>

              {/* Flip Camera Button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                title="Putar Kamera Depan / Belakang"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setMode('select');
                }}
                className="w-1/3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Ambil Foto</span>
              </button>
            </div>
          </div>
        )}

        {/* Preview & Compression Result Mode */}
        {mode === 'preview' && previewImage && (
          <div className="space-y-4">
            {/* Compressed Image Preview */}
            <div className="flex flex-col items-center justify-center gap-3">
              <img
                src={previewImage}
                alt="Preview"
                className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500 shadow-xl ring-4 ring-emerald-500/20"
              />

              {/* Compression Metric Badge */}
              {compressionResult && (
                <div className="w-full p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs space-y-1 text-center">
                  <div className="flex items-center justify-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300 text-xs">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Dikompresi Otomatis ({compressionResult.savingsPercentage}% Lebih Ringan)</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                    <span className="line-through text-slate-400">{compressionResult.originalSizeFormatted}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">➔ {compressionResult.compressedSizeFormatted}</span>
                    <span className="text-[10px] text-slate-500">({compressionResult.width}x{compressionResult.height}px)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Google Drive & Firebase Sync indicator */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sinkronisasi Otomatis:</span>
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Firebase Firestore {isGoogleDriveConnected ? '+ Google Drive' : ''}
              </span>
            </div>

            {/* Confirmation Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setMode('select')}
                className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Ganti Foto
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSavePhoto}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Terapkan Foto Profil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
