/**
 * GPS & Geolocation Service for e-Piket Digital
 * High-Accuracy Geolocation, Geofencing, Coordinate Locking & Distance Calculation
 */

export interface AccurateGpsReading {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
  sampleCount: number;
}

export interface GpsValidationResult {
  isValid: boolean;
  distanceMeters: number;
  maxRadiusMeters: number;
  isWithinRadius: boolean;
  accuracyMeters: number;
  isAccuracyAcceptable: boolean; // accuracy <= 150m
  userLatitude: number;
  userLongitude: number;
  schoolLatitude: number;
  schoolLongitude: number;
  statusMessage: string;
  statusType: 'success' | 'warning' | 'danger' | 'loading';
}

class GpsService {
  /**
   * Earth Radius in Meters (WGS84 ellipsoid mean)
   */
  private readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Calculate precise distance between two coordinates in meters using Haversine formula
   */
  calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(this.EARTH_RADIUS_METERS * c);
  }

  /**
   * Acquire high-accuracy GPS with progressive multi-sampling and fast fallback
   */
  async getHighAccuracyPosition(
    samplesNeeded = 1,
    timeoutMs = 6000
  ): Promise<AccurateGpsReading> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      throw new Error('Sensor Geolocation GPS tidak didukung pada browser/perangkat ini.');
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const collectedSamples: AccurateGpsReading[] = [];

      const cleanup = () => {
        isSettled = true;
        if (watchId !== null) {
          try {
            navigator.geolocation.clearWatch(watchId);
          } catch {}
        }
        if (safetyTimer !== null) {
          clearTimeout(safetyTimer);
        }
      };

      const finishWithBestSample = () => {
        if (collectedSamples.length > 0) {
          // Sort by lowest accuracy number (best precision)
          collectedSamples.sort((a, b) => a.accuracy - b.accuracy);
          const best = collectedSamples[0];
          cleanup();
          resolve({
            ...best,
            sampleCount: collectedSamples.length
          });
          return true;
        }
        return false;
      };

      // Safety timeout
      const safetyTimer = setTimeout(() => {
        if (isSettled) return;
        if (finishWithBestSample()) return;

        // Try fast standard fallback if no samples collected yet
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (isSettled) return;
            cleanup();
            resolve({
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: Math.round(pos.coords.accuracy || 25),
              altitude: pos.coords.altitude,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              timestamp: pos.timestamp || Date.now(),
              sampleCount: 1
            });
          },
          (err) => {
            if (isSettled) return;
            cleanup();
            let msg = 'Waktu permintaan sinyal GPS habis.';
            if (err.code === err.PERMISSION_DENIED) {
              msg = 'Izin akses lokasi GPS ditolak oleh browser. Silakan aktifkan izin lokasi di setelan browser.';
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              msg = 'Sinyal lokasi tidak tersedia atau perangkat tidak memiliki sensor GPS aktif.';
            }
            reject(new Error(msg));
          },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
        );
      }, timeoutMs);

      // Multi-sample watchPosition for high accuracy
      let watchId: number | null = null;
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (isSettled) return;

            const reading: AccurateGpsReading = {
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: Math.round(pos.coords.accuracy || 15),
              altitude: pos.coords.altitude,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              timestamp: pos.timestamp || Date.now(),
              sampleCount: collectedSamples.length + 1
            };

            collectedSamples.push(reading);

            // If we got high precision (accuracy <= 15m) or reached target samples
            if (reading.accuracy <= 15 || collectedSamples.length >= Math.max(1, samplesNeeded)) {
              finishWithBestSample();
            }
          },
          (err) => {
            // If watchPosition fails with permission denied, reject immediately
            if (err.code === err.PERMISSION_DENIED) {
              if (isSettled) return;
              cleanup();
              reject(new Error('Izin akses lokasi GPS ditolak oleh browser. Silakan aktifkan izin lokasi di setelan browser.'));
              return;
            }

            // Otherwise attempt single-shot standard accuracy
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (isSettled) return;
                cleanup();
                resolve({
                  latitude: Number(pos.coords.latitude.toFixed(6)),
                  longitude: Number(pos.coords.longitude.toFixed(6)),
                  accuracy: Math.round(pos.coords.accuracy || 25),
                  altitude: pos.coords.altitude,
                  speed: pos.coords.speed,
                  heading: pos.coords.heading,
                  timestamp: pos.timestamp || Date.now(),
                  sampleCount: 1
                });
              },
              (fallbackErr) => {
                if (isSettled) return;
                cleanup();
                let msg = 'Gagal mengakses sensor lokasi GPS perangkat.';
                if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
                  msg = 'Izin akses lokasi GPS ditolak oleh browser.';
                } else if (fallbackErr.code === fallbackErr.POSITION_UNAVAILABLE) {
                  msg = 'Sinyal GPS tidak terdeteksi. Pastikan GPS/Location perangkat telah aktif.';
                }
                reject(new Error(msg));
              },
              { enableHighAccuracy: false, timeout: 3500, maximumAge: 30000 }
            );
          },
          {
            enableHighAccuracy: true,
            timeout: Math.max(4000, timeoutMs - 1000),
            maximumAge: 5000
          }
        );
      } catch (err: any) {
        if (!isSettled) {
          cleanup();
          reject(new Error(`Gagal memulai sensor GPS: ${err.message}`));
        }
      }
    });
  }

  /**
   * Validate user location against school coordinates and allowed radius
   */
  validateUserLocation(
    userLat: number,
    userLng: number,
    userAccuracy: number,
    schoolLat: number,
    schoolLng: number,
    radiusMeters: number
  ): GpsValidationResult {
    const distanceMeters = this.calculateDistanceMeters(userLat, userLng, schoolLat, schoolLng);
    const isAccuracyAcceptable = userAccuracy <= 150;
    const isWithinRadius = distanceMeters <= radiusMeters;
    const isValid = isWithinRadius;

    let statusMessage = '';
    let statusType: 'success' | 'warning' | 'danger' = 'success';

    if (isWithinRadius) {
      statusMessage = `Lokasi terverifikasi di lingkungan sekolah (Jarak ${distanceMeters} m dari pusat sekolah, batas ${radiusMeters} m).`;
      statusType = 'success';
    } else {
      const excess = distanceMeters - radiusMeters;
      statusMessage = `Di luar radius sekolah (${distanceMeters} m, melewati batas ${excess} m). Anda harus berada di area sekolah untuk melakukan presensi piket.`;
      statusType = 'danger';
    }

    return {
      isValid,
      distanceMeters,
      maxRadiusMeters: radiusMeters,
      isWithinRadius,
      accuracyMeters: userAccuracy,
      isAccuracyAcceptable,
      userLatitude: userLat,
      userLongitude: userLng,
      schoolLatitude: schoolLat,
      schoolLongitude: schoolLng,
      statusMessage,
      statusType
    };
  }

  /**
   * Format distance into human-friendly string (e.g. "35 meter" or "1.4 km")
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters} meter`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }

  /**
   * Format coordinate into standard DD string (e.g. "-6.229746, 106.807493")
   */
  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  /**
   * Generate Google Maps / OSM link for coordinates
   */
  getMapUrl(lat: number, lng: number): string {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
}

export const gpsService = new GpsService();
