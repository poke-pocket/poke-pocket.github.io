export interface WorldCheckpointData {
  mode: 'geo' | 'procedural';
  cityId: string;
  cityName?: string;
  /** Exact real-world GPS coordinates (authoritative in 1:1 meter Real-Earth mode) */
  lat?: number;
  lng?: number;
  /** Local 3D world meters `(px, pz)` */
  x: number;
  z: number;
  facingAngle: number;
  updatedAt: number;
}

const CHECKPOINT_STORAGE_KEY = 'pocket_paw_world_checkpoint_v3_1to1';
const LEGACY_CHECKPOINT_KEY_V2 = 'pocket_paw_world_checkpoint_v2';
const ACTIVE_SESSION_KEY = 'pocket_paw_active_care_session_v1';

export function loadWorldCheckpoint(): WorldCheckpointData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WorldCheckpointData>;
      if (typeof parsed.x === 'number' && typeof parsed.z === 'number' && Number.isFinite(parsed.x) && Number.isFinite(parsed.z)) {
        return {
          mode: parsed.mode === 'procedural' ? 'procedural' : 'geo',
          cityId: typeof parsed.cityId === 'string' && parsed.cityId ? parsed.cityId : 'shanghai',
          cityName: typeof parsed.cityName === 'string' ? parsed.cityName : undefined,
          lat: typeof parsed.lat === 'number' && Number.isFinite(parsed.lat) ? parsed.lat : undefined,
          lng: typeof parsed.lng === 'number' && Number.isFinite(parsed.lng) ? parsed.lng : undefined,
          x: parsed.x,
          z: parsed.z,
          facingAngle: typeof parsed.facingAngle === 'number' && Number.isFinite(parsed.facingAngle) ? parsed.facingAngle : 0,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        };
      }
    }
    // Migrate GPS coordinates cleanly from v2 checkpoint if present
    const legacyRaw = window.localStorage.getItem(LEGACY_CHECKPOINT_KEY_V2);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as Partial<WorldCheckpointData>;
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
        return {
          mode: 'geo',
          cityId: typeof parsed.cityId === 'string' && parsed.cityId ? parsed.cityId : 'shanghai',
          cityName: typeof parsed.cityName === 'string' ? parsed.cityName : undefined,
          lat: parsed.lat,
          lng: parsed.lng,
          x: -22,
          z: 12,
          facingAngle: typeof parsed.facingAngle === 'number' && Number.isFinite(parsed.facingAngle) ? parsed.facingAngle : 0,
          updatedAt: Date.now(),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWorldCheckpoint(cp: WorldCheckpointData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(cp));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearWorldCheckpoint(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CHECKPOINT_KEY_V2);
  } catch {
    // Ignore
  }
}

export function setActiveCareSessionFlag(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      window.sessionStorage.setItem(ACTIVE_SESSION_KEY, '1');
    } else {
      window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    // Ignore
  }
}

export function wasActiveCareSessionOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(ACTIVE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}
