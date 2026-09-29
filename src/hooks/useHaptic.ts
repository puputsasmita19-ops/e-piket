import { useState, useEffect } from 'react';
import { haptic, HapticIntensity } from '../utils/feedback';

export const useHaptic = () => {
  const [isHapticEnabled, setIsHapticEnabled] = useState<boolean>(() => haptic.isEnabled());
  const [hapticIntensity, setHapticIntensityState] = useState<HapticIntensity>(() => haptic.getIntensity());

  useEffect(() => {
    const handleSettingChange = (e: Event) => {
      const customEvt = e as CustomEvent<boolean>;
      setIsHapticEnabled(customEvt.detail);
    };

    const handleIntensityChange = (e: Event) => {
      const customEvt = e as CustomEvent<HapticIntensity>;
      setHapticIntensityState(customEvt.detail);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('haptic_setting_changed', handleSettingChange);
      window.addEventListener('haptic_intensity_changed', handleIntensityChange);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('haptic_setting_changed', handleSettingChange);
        window.removeEventListener('haptic_intensity_changed', handleIntensityChange);
      }
    };
  }, []);

  const toggleHaptic = () => {
    const newState = haptic.toggle();
    setIsHapticEnabled(newState);
    return newState;
  };

  const setHapticEnabled = (state: boolean) => {
    haptic.setEnabled(state);
    setIsHapticEnabled(state);
  };

  const setHapticIntensity = (level: HapticIntensity) => {
    haptic.setIntensity(level);
    setHapticIntensityState(level);
  };

  return {
    isHapticEnabled,
    hapticIntensity,
    toggleHaptic,
    setHapticEnabled,
    setHapticIntensity,
    haptic
  };
};
