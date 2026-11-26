export interface WorldCheckpointData {
  mode: 'geo' | 'procedural';
  cityId: string;
  cityName?: string;
  lat?: number;
  lng?: number;
  x: number;
  z: number;
  facingAngle: number;
  updatedAt: number;
}

const CHECKPOINT_STORAGE_KEY = 'pocket_paw_world_checkpoint_v2';
const ACTIVE_CARE_SESSION_KEY = 'pocket_paw_active_care_session_v1';

export function saveWorldCheckpoint(cp: WorldCheckpointData): void {
  if (typeof window === 'undefined') return;
  try {
    const clean: WorldCheckpointData = {
      mode: cp.mode,
      cityId: cp.cityId,
      cityName: cp.cityName,
      lat: typeof cp.lat === 'number' && Number.isFinite(cp.lat) ? Number(cp.lat.toFixed(6)) : undefined,
      lng: typeof cp.lng === 'number' && Number.isFinite(cp.lng) ? Number(cp.lng.toFixed(6)) : undefined,
      x: Number(cp.x.toFixed(2)),
      z: Number(cp.z.toFixed(2)),
      facingAngle: Number((cp.facingAngle || 0).toFixed(3)),
      updatedAt: cp.updatedAt || Date.now(),
    };
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // ignore quota / privacy errors
  }
}

export function loadWorldCheckpoint(): WorldCheckpointData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorldCheckpointData>;
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.z !== 'number' ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.z)
    ) {
      return null;
    }
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
  } catch {
    return null;
  }
}

export function clearWorldCheckpoint(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Tracks whether the user was actively in 3D Care/Exploration Playing mode across F5 page reloads! */
export function setActiveCareSessionFlag(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      window.sessionStorage.setItem(ACTIVE_CARE_SESSION_KEY, '1');
    } else {
      window.sessionStorage.removeItem(ACTIVE_CARE_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

export function wasActiveCareSessionOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(ACTIVE_CARE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}
