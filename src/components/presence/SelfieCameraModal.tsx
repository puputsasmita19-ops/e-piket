import React, { useEffect } from 'react';
import { DutySchedule } from '../../types';
import { useData } from '../../context/DataContext';

interface SelfieCameraModalProps {
  schedule: DutySchedule;
  mode: 'checkin' | 'checkout';
  onClose: () => void;
  onSuccess: () => void;
}

export const SelfieCameraModal: React.FC<SelfieCameraModalProps> = ({
  schedule,
  mode,
  onClose,
  onSuccess
}) => {
  const { checkIn, checkOut } = useData();

  useEffect(() => {
    const executeDirectAction = async () => {
      if (mode === 'checkin') {
        const res = await checkIn(schedule.id, 'Absen Mulai Piket');
        if (!res.success) {
          alert(res.message);
        } else {
          onSuccess();
        }
      } else {
        const res = await checkOut(schedule.id, 'Selesai piket');
        if (!res.success) {
          alert(res.message);
        } else {
          onSuccess();
        }
      }
      onClose();
    };

    executeDirectAction();
  }, [schedule.id, mode, checkIn, checkOut, onClose, onSuccess]);

  return null;
};
