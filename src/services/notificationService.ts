/**
 * Web Notification & Push Notification Service
 * Handles shift reminders at H-60 minutes and H-15 minutes before duty
 */

export interface ScheduledReminder {
  scheduleId: string;
  postName: string;
  jamMulai: string;
  reminderType: '60min' | '15min' | 'late_alert';
  sentAt: string;
}

export interface LateCheckInAlertDetail {
  scheduleId: string;
  userId: string;
  userName: string;
  postName: string;
  jamMulai: string;
  minutesLate: number;
  tanggal: string;
  timestamp: string;
}

const REMINDER_STORAGE_KEY = 'epiket_sent_reminders';
const LATE_ALERT_STORAGE_KEY = 'epiket_sent_late_alerts';

class NotificationService {
  private reminderCheckInterval: any = null;

  /**
   * Check if browser supports Web Notifications
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current permission state
   */
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request push notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('Notification permission error:', e);
      return 'denied';
    }
  }

  /**
   * Play an audible chime for notifications
   */
  playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy might restrict without interaction
    }
  }

  /**
   * Play an urgent alert chime for Late Check-in notifications
   */
  playLateAlertChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.25); // C6
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio autoplay policy
    }
  }

  /**
   * Send an immediate browser notification
   */
  sendNotification(title: string, options?: NotificationOptions): boolean {
    this.playChime();

    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const notifOptions: NotificationOptions = {
        icon: '/icon.svg',
        badge: '/icon.svg',
        ...options
      };

      // Try ServiceWorker showNotification if available (better PWA background support)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, notifOptions);
        }).catch(() => {
          const notif = new Notification(title, notifOptions);
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        });
      } else {
        const notif = new Notification(title, notifOptions);
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
      return true;
    } catch (err) {
      console.warn('Error sending web notification:', err);
      return false;
    }
  }

  /**
   * Push notification specifically for handover (Serah Terima Tugas) to the next duty teacher
   */
  sendHandoverPushNotification(data: {
    toUserId: string;
    toUserName: string;
    fromUserName: string;
    postName: string;
    kondisiPos: string;
    tindakLanjutPending?: string;
    waktu: string;
  }): boolean {
    const title = `🔔 Serah Terima Tugas Piket: Pos ${data.postName}`;
    const body = `Bpk/Ibu ${data.toUserName}, tugas piket telah dialihkan oleh ${data.fromUserName} (Pukul ${data.waktu} WIB). Kondisi: "${data.kondisiPos}". Mohon segera konfirmasi di aplikasi.`;

    // 1. Play sound
    this.playChime();

    // 2. Dispatch custom event for in-app alert banner
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('handover_push_received', {
          detail: { ...data, title, body, timestamp: new Date().toISOString() }
        })
      );
    }

    // 3. Send Web Push Notification to OS / Browser
    const sent = this.sendNotification(title, {
      body,
      tag: `handover-${data.toUserId}-${Date.now()}`,
      requireInteraction: true
    });

    return sent;
  }

  /**
   * Push notification specifically for Late Check-in Alert for Admin and Headmaster
   */
  sendLateCheckInPushNotification(detail: LateCheckInAlertDetail): boolean {
    const title = `🚨 PERINGATAN: Petugas Piket Terlambat Check-In!`;
    const body = `Guru ${detail.userName} belum melakukan check-in di ${detail.postName} (Jadwal: ${detail.jamMulai} WIB | Terlambat: +${detail.minutesLate} menit). Segera hubungi petugas atau tugaskan pengganti.`;

    // 1. Play urgent chime
    this.playLateAlertChime();

    // 2. Dispatch in-app reactive event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('late_checkin_detected', {
          detail
        })
      );
    }

    // 3. Send Web Push Notification to OS / Browser
    const sent = this.sendNotification(title, {
      body,
      tag: `late-checkin-${detail.scheduleId}-${detail.tanggal}`,
      requireInteraction: true
    });

    return sent;
  }

  /**
   * Real-time Late Check-in Alert Detection System
   * Examines today's scheduled teachers. If a teacher has not checked in by start time (+ tolerance),
   * immediately triggers alert notifications for school admin and headmaster.
   */
  checkAndDispatchLateAlerts(
    schedules: Array<{
      id: string;
      userId: string;
      userName?: string;
      tanggal: string;
      jamMulai?: string;
      postName?: string;
      status: string;
      attendanceId?: string;
    }>,
    toleranceMinutes: number = 0,
    onLateAlertTriggered?: (detail: LateCheckInAlertDetail) => void
  ): LateCheckInAlertDetail[] {
    if (!schedules || schedules.length === 0) return [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const sentLateAlerts = this.getSentLateAlerts();
    const activeLateList: LateCheckInAlertDetail[] = [];

    // Filter today's schedules where teacher is expected to be on duty and hasn't checked in
    const todayUnattended = schedules.filter(
      (s) =>
        s.tanggal === todayStr &&
        (s.status === 'belum_checkin' || s.status === 'belum_piket' || s.status === 'terlambat') &&
        !s.attendanceId
    );

    for (const sch of todayUnattended) {
      if (!sch.jamMulai) continue;

      const [hour, min] = sch.jamMulai.split(':').map(Number);
      const startMinutes = hour * 60 + min;
      const effectiveDeadlineMinutes = startMinutes + toleranceMinutes;

      // Has the teacher passed designated start time?
      if (currentMinutes > effectiveDeadlineMinutes) {
        const minutesLate = currentMinutes - startMinutes;
        const detail: LateCheckInAlertDetail = {
          scheduleId: sch.id,
          userId: sch.userId,
          userName: sch.userName || 'Petugas Piket',
          postName: sch.postName || 'Pos Piket',
          jamMulai: sch.jamMulai,
          minutesLate,
          tanggal: todayStr,
          timestamp: new Date().toISOString()
        };

        activeLateList.push(detail);

        // Check if we already sent push notification for this schedule today
        const key = `${sch.id}_late_${todayStr}`;
        if (!sentLateAlerts[key]) {
          sentLateAlerts[key] = {
            scheduleId: sch.id,
            postName: sch.postName || 'Pos Piket',
            jamMulai: sch.jamMulai,
            reminderType: 'late_alert',
            sentAt: new Date().toISOString()
          };
          this.saveSentLateAlerts(sentLateAlerts);

          // Dispatch Push Notification & In-app alert
          this.sendLateCheckInPushNotification(detail);

          if (onLateAlertTriggered) {
            onLateAlertTriggered(detail);
          }
        }
      }
    }

    return activeLateList;
  }

  /**
   * Check schedules and dispatch H-60 min and H-15 min reminders
   */
  checkAndDispatchReminders(
    schedules: Array<{
      id: string;
      userId: string;
      tanggal: string;
      jamMulai: string;
      postName: string;
      status: string;
    }>,
    currentUserId?: string
  ) {
    if (!schedules || schedules.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const sentReminders = this.getSentReminders();

    // Filter schedules for today for this user (or all if currentUserId is not provided)
    const myTodaySchedules = schedules.filter(
      (s) => s.tanggal === todayStr && (!currentUserId || s.userId === currentUserId) && s.status === 'belum_checkin'
    );

    for (const sch of myTodaySchedules) {
      if (!sch.jamMulai) continue;

      const [hour, min] = sch.jamMulai.split(':').map(Number);
      const startMinutes = hour * 60 + min;
      const minutesUntilShift = startMinutes - currentMinutes;

      // 1. Reminder H-60 Menit (between 50 and 65 minutes before)
      if (minutesUntilShift <= 60 && minutesUntilShift >= 50) {
        const key = `${sch.id}_60min_${todayStr}`;
        if (!sentReminders[key]) {
          const title = `⏰ Pengingat Piket (1 Jam Lagi) - ${sch.postName}`;
          const body = `Tugas piket Anda di ${sch.postName} dimulai pukul ${sch.jamMulai} WIB. Mohon persiapkan diri.`;
          
          this.sendNotification(title, {
            body,
            tag: key,
            requireInteraction: false
          });

          sentReminders[key] = {
            scheduleId: sch.id,
            postName: sch.postName,
            jamMulai: sch.jamMulai,
            reminderType: '60min',
            sentAt: new Date().toISOString()
          };
          this.saveSentReminders(sentReminders);
        }
      }

      // 2. Reminder H-15 Menit (between 5 and 18 minutes before)
      if (minutesUntilShift <= 15 && minutesUntilShift >= 0) {
        const key = `${sch.id}_15min_${todayStr}`;
        if (!sentReminders[key]) {
          const title = `🚨 Siap di Pos! 15 Menit Menuju Piket - ${sch.postName}`;
          const body = `Shift Anda dimulai pukul ${sch.jamMulai} WIB. Silakan menuju ${sch.postName} dan lakukan Check-In QR / Biometrik.`;

          this.sendNotification(title, {
            body,
            tag: key,
            requireInteraction: true
          });

          sentReminders[key] = {
            scheduleId: sch.id,
            postName: sch.postName,
            jamMulai: sch.jamMulai,
            reminderType: '15min',
            sentAt: new Date().toISOString()
          };
          this.saveSentReminders(sentReminders);
        }
      }
    }
  }

  /**
   * Start automatic daemon monitoring
   */
  startScheduler(
    getSchedules: () => Array<any>,
    getCurrentUserId: () => string | undefined,
    getUserRole?: () => string | undefined,
    onLateAlert?: (detail: LateCheckInAlertDetail) => void,
    toleranceMinutes?: number
  ) {
    if (this.reminderCheckInterval) return;

    const runChecks = () => {
      const schedules = getSchedules();
      const currentUserId = getCurrentUserId();
      const role = getUserRole ? getUserRole() : undefined;

      // 1. Shift reminder for current teacher
      this.checkAndDispatchReminders(schedules, currentUserId);

      // 2. Real-time Late Check-in Alert for Admin / Kepsek / All users
      if (!role || role === 'admin' || role === 'kepsek') {
        this.checkAndDispatchLateAlerts(schedules, toleranceMinutes || 0, onLateAlert);
      }
    };

    // Run immediately on start
    runChecks();

    // Check every 20 seconds for precise, real-time alert triggers
    this.reminderCheckInterval = setInterval(runChecks, 20000);
  }

  stopScheduler() {
    if (this.reminderCheckInterval) {
      clearInterval(this.reminderCheckInterval);
      this.reminderCheckInterval = null;
    }
  }

  private getSentReminders(): Record<string, ScheduledReminder> {
    try {
      const data = localStorage.getItem(REMINDER_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private saveSentReminders(reminders: Record<string, ScheduledReminder>) {
    try {
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    } catch (e) {
      console.warn('Error saving sent reminders:', e);
    }
  }

  private getSentLateAlerts(): Record<string, ScheduledReminder> {
    try {
      const data = localStorage.getItem(LATE_ALERT_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private saveSentLateAlerts(alerts: Record<string, ScheduledReminder>) {
    try {
      localStorage.setItem(LATE_ALERT_STORAGE_KEY, JSON.stringify(alerts));
    } catch (e) {
      console.warn('Error saving late alerts:', e);
    }
  }
}

export const notificationService = new NotificationService();

