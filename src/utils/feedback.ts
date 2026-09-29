export type HapticIntensity = 'sedang' | 'kuat' | 'ekstra';

/**
 * Haptic Feedback & Sound Utility
 * Single pulse vibration for sedang, kuat, and ekstra kuat modes (no double/triple rumble).
 * Comprehensive synthesized audio effects for every app action.
 */
export class HapticFeedback {
  private enabled: boolean = true;
  private intensity: HapticIntensity = 'ekstra';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedEnabled = localStorage.getItem('epiket_haptic_enabled');
        this.enabled = storedEnabled !== null ? storedEnabled === 'true' : true;

        const storedIntensity = localStorage.getItem('epiket_haptic_intensity') as HapticIntensity;
        if (storedIntensity && ['sedang', 'kuat', 'ekstra'].includes(storedIntensity)) {
          this.intensity = storedIntensity;
        } else {
          this.intensity = 'ekstra';
        }
      } catch (e) {
        this.enabled = true;
        this.intensity = 'ekstra';
      }
    }
  }

  /**
   * Check if haptic feedback is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current vibration intensity mode
   */
  getIntensity(): HapticIntensity {
    return this.intensity;
  }

  /**
   * Set vibration intensity level ('sedang', 'kuat', 'ekstra') and persist
   */
  setIntensity(level: HapticIntensity): void {
    this.intensity = level;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('epiket_haptic_intensity', level);
        window.dispatchEvent(new CustomEvent('haptic_intensity_changed', { detail: level }));
      } catch (e) {
        console.warn('Could not save haptic intensity:', e);
      }
    }
    // Single test pulse immediately
    this.medium();
  }

  /**
   * Enable or disable haptic feedback globally and persist in localStorage
   */
  setEnabled(state: boolean): void {
    this.enabled = state;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('epiket_haptic_enabled', state ? 'true' : 'false');
        window.dispatchEvent(new CustomEvent('haptic_setting_changed', { detail: state }));
      } catch (e) {
        console.warn('Could not save haptic setting to storage:', e);
      }
    }
  }

  /**
   * Toggle haptic feedback on or off
   */
  toggle(): boolean {
    const newState = !this.enabled;
    this.setEnabled(newState);
    if (newState) {
      this.heavy();
    }
    return newState;
  }

  private isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && typeof window.navigator.vibrate === 'function';
  }

  /**
   * Light single pulse for minor interactions (tab switch, filter, toggle)
   */
  light() {
    if (!this.enabled) return;

    if (this.isSupported()) {
      try {
        // SINGLE pulse duration based on intensity
        const duration = this.intensity === 'sedang' ? 40 : this.intensity === 'kuat' ? 80 : 120;
        window.navigator.vibrate(duration);
      } catch (e) {
        // ignore
      }
    }

    // Audio sound effect for action
    sound.playClickTap(0.12, 420);
  }

  /**
   * Medium single pulse for primary buttons & key actions
   */
  medium() {
    if (!this.enabled) return;

    if (this.isSupported()) {
      try {
        // SINGLE pulse duration based on intensity
        const duration = this.intensity === 'sedang' ? 70 : this.intensity === 'kuat' ? 140 : 200;
        window.navigator.vibrate(duration);
      } catch (e) {
        // ignore
      }
    }

    sound.playClickTap(0.18, 340);
  }

  /**
   * Heavy single pulse for major actions (delete, logout, reset)
   */
  heavy() {
    if (!this.enabled) return;

    if (this.isSupported()) {
      try {
        // SINGLE pulse duration based on intensity
        const duration = this.intensity === 'sedang' ? 120 : this.intensity === 'kuat' ? 220 : 320;
        window.navigator.vibrate(duration);
      } catch (e) {
        // ignore
      }
    }

    sound.playDelete();
  }

  /**
   * Success single pulse & sound
   */
  success() {
    if (!this.enabled) return;

    if (this.isSupported()) {
      try {
        const duration = this.intensity === 'sedang' ? 100 : this.intensity === 'kuat' ? 180 : 260;
        window.navigator.vibrate(duration);
      } catch (e) {
        // ignore
      }
    }

    sound.playSuccess();
  }

  /**
   * Warning single pulse & sound
   */
  warning() {
    if (!this.enabled) return;

    if (this.isSupported()) {
      try {
        const duration = this.intensity === 'sedang' ? 110 : this.intensity === 'kuat' ? 190 : 280;
        window.navigator.vibrate(duration);
      } catch (e) {
        // ignore
      }
    }

    sound.playWarning();
  }

  /**
   * Error single pulse & sound
   */
  error() {
    if (!this.enabled) return;

    if (this.isSupported()) {
      try {
        const duration = this.intensity === 'sedang' ? 130 : this.intensity === 'kuat' ? 220 : 320;
        window.navigator.vibrate(duration);
      } catch (e) {
        // ignore
      }
    }

    sound.playWarning();
  }
}

export const haptic = new HapticFeedback();

/**
 * Global delegated listener for instant tactile haptic feedback & action sounds on touch / pointer down
 */
export const initGlobalHapticFeedback = () => {
  if (typeof window === 'undefined') return;

  let lastVibrate = 0;
  const handlePointerDown = (e: PointerEvent | TouchEvent) => {
    if (!haptic.isEnabled()) return;

    // Throttle slightly to prevent duplicate events on touch+pointer
    const now = Date.now();
    if (now - lastVibrate < 60) return;

    const target = (e.target as HTMLElement)?.closest('button, a, [role="button"], input[type="submit"], input[type="button"], select, label, [data-haptic]');
    if (target) {
      lastVibrate = now;
      const customHaptic = target.getAttribute('data-haptic');
      if (customHaptic === 'medium') {
        haptic.medium();
      } else if (customHaptic === 'heavy') {
        haptic.heavy();
      } else if (customHaptic === 'success') {
        haptic.success();
      } else if (customHaptic === 'warning') {
        haptic.warning();
      } else if (customHaptic === 'toggle') {
        sound.playToggle();
        haptic.medium();
      } else if (customHaptic === 'none') {
        // skip
      } else {
        haptic.light();
      }
    }
  };

  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
  window.addEventListener('touchstart', handlePointerDown, { passive: true });
};

/**
 * Web Audio API synthesized sounds for instant acoustic feedback for every action in the app
 */
class SoundFeedback {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  /**
   * Crisp click/tap sound for button presses and navigation
   */
  playClickTap(volume: number = 0.15, pitch: number = 360) {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      // ignore audio context failures
    }
  }

  /**
   * Distinct toggle switch sound for dark/light theme, filters, and settings
   */
  playToggle(state: boolean = true) {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      if (state) {
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
      } else {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(250, now + 0.06);
      }

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Sound when changing active tab or menu section
   */
  playTabSwitch() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.05);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Sound when opening a modal dialog
   */
  playModalOpen() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Sound when closing a modal dialog
   */
  playModalClose() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.07);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Sound for delete or destructive actions
   */
  playDelete() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Harmonious chime for successful actions (saving, clock-in, biometric verify)
   */
  playSuccess() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.35); // C6
      
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }

  /**
   * Melodic notification chime for push alerts & duty reminders
   */
  playNotification() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
      osc.frequency.setValueAtTime(1318.51, now + 0.25); // E6
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }

  /**
   * Warning / error sound
   */
  playWarning() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(370, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }

  playListeningStart() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }

  playListeningStop() {
    if (!haptic.isEnabled()) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12); // A4

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }
}

export const sound = new SoundFeedback();

export const triggerConfetti = () => {
  try {
    import('canvas-confetti').then((module) => {
      const confettiFn = module.default || module;
      confettiFn({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#2563eb', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6']
      });
    }).catch((e) => console.warn('Confetti module load error:', e));
  } catch (e) {
    console.warn('Confetti error:', e);
  }
};
