import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, Check } from 'lucide-react';
import { sound, haptic } from '../../utils/feedback';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  itemName: string;
  itemDetails?: string;
  requireTypingConfirmation?: boolean; // If true, user must type 'HAPUS' or item name to confirm
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemDetails,
  requireTypingConfirmation = false
}) => {
  const [typedValue, setTypedValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const isConfirmed = requireTypingConfirmation
    ? typedValue.trim().toUpperCase() === 'HAPUS'
    : true;

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    haptic.medium();
    setIsDeleting(true);
    try {
      await onConfirm();
      sound.playSuccess();
    } catch (e) {
      console.error('Failed delete operation:', e);
    } finally {
      setIsDeleting(false);
      setTypedValue('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-rose-200 dark:border-rose-950/80 animate-in zoom-in-95">
        
        {/* Header Icon */}
        <div className="flex items-start justify-between">
          <div className="p-3 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200 dark:border-rose-800 shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <button
            onClick={() => {
              haptic.light();
              setTypedValue('');
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Title & Warning */}
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>{title || 'Konfirmasi Penghapusan Data'}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Fitur keamanan pencegahan hapus tidak sengaja. Mohon periksa kembali sebelum melanjutkan.
          </p>
        </div>

        {/* Target Item Card Box */}
        <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300 block">
            Item yang akan dihapus:
          </span>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
            {itemName}
          </p>
          {itemDetails && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {itemDetails}
            </p>
          )}
        </div>

        {/* Optional Safety Typing Confirmation */}
        {requireTypingConfirmation && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Ketik kata <span className="text-rose-600 dark:text-rose-400 font-mono font-black">HAPUS</span> untuk mengonfirmasi:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder="Ketik HAPUS..."
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-center font-bold tracking-widest text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting || !isConfirmed}
            className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTypedValue('');
              onClose();
            }}
            className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
          >
            Batal
          </button>
        </div>

      </div>
    </div>
  );
};
