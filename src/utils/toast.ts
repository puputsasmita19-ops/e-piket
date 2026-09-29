import { sound, haptic } from './feedback';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export const showToast = (toast: Omit<ToastItem, 'id'>) => {
  if (typeof window === 'undefined') return;
  const id = Math.random().toString(36).substring(2, 9);

  if (toast.type === 'success') {
    sound.playSuccess();
    haptic.success();
  }

  window.dispatchEvent(
    new CustomEvent('app_global_toast', {
      detail: { ...toast, id, duration: toast.duration || 3200 }
    })
  );
};

export const showSuccessToast = (message: string, title: string = 'Berhasil Disimpan!') => {
  showToast({
    type: 'success',
    title,
    message
  });
};

export const showErrorToast = (message: string, title: string = 'Gagal Menyimpan') => {
  showToast({
    type: 'error',
    title,
    message
  });
};

export const showInfoToast = (message: string, title: string = 'Informasi') => {
  showToast({
    type: 'info',
    title,
    message
  });
};
