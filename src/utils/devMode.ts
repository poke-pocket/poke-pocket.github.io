import { useEffect, useState } from 'react';

const DEV_MODE_STORAGE_KEY = 'poke_pocket_dev_mode';

type DevModeListener = (enabled: boolean) => void;
const listeners = new Set<DevModeListener>();

function computeInitialDevMode(): boolean {
  const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  if (metaEnv?.VITE_DEBUG_MODE === '1') {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('debug') ?? params.get('dev');
      if (q === '1' || q === 'true') {
        window.localStorage.setItem(DEV_MODE_STORAGE_KEY, '1');
        return true;
      }
      if (q === '0' || q === 'false') {
        window.localStorage.removeItem(DEV_MODE_STORAGE_KEY);
        return false;
      }
      return window.localStorage.getItem(DEV_MODE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
  return false;
}

let devModeState = computeInitialDevMode();

function notifyListeners() {
  listeners.forEach((fn) => fn(devModeState));
}

export function isDevModeEnabled(): boolean {
  return devModeState;
}

export function setDevModeEnabled(next: boolean): boolean {
  devModeState = Boolean(next);
  if (typeof window !== 'undefined') {
    try {
      if (devModeState) window.localStorage.setItem(DEV_MODE_STORAGE_KEY, '1');
      else window.localStorage.removeItem(DEV_MODE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }
  notifyListeners();
  return devModeState;
}

export function toggleDevMode(): boolean {
  return setDevModeEnabled(!devModeState);
}

export function useDevMode(): [boolean, (next: boolean) => boolean] {
  const [enabled, setEnabled] = useState<boolean>(() => devModeState);
  useEffect(() => {
    const onChange: DevModeListener = (val) => setEnabled(val);
    listeners.add(onChange);
    setEnabled(devModeState);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return [enabled, setDevModeEnabled];
}

// Expose scriptable global hook for AI / developer verification tools
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__POKE_POCKET_DEBUG__ = {
    enable: () => setDevModeEnabled(true),
    disable: () => setDevModeEnabled(false),
    toggle: () => toggleDevMode(),
    isEnabled: () => isDevModeEnabled(),
  };
}
