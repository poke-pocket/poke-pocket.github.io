import { useCallback, useEffect, useState } from 'react';

interface FullscreenDoc extends Document {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
}

interface FullscreenEl extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

export function getFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDoc;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as StandaloneNavigator;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  );
}

export function checkSupportsFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDoc;
  const el = document.documentElement as FullscreenEl;
  const hasMethod = Boolean(
    el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen,
  );
  if (!hasMethod) return false;
  if (doc.fullscreenEnabled === false && doc.webkitFullscreenEnabled !== true) return false;
  return true;
}

export function checkIsMobileLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= h) return false;
  // Compact landscape height catches real phones (360-430px) & small landscape handheld viewports,
  // while never triggering on desktop monitors.
  if (h > 560) return false;
  const coarseOrTouch =
    Boolean(window.matchMedia?.('(pointer: coarse)').matches) ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return coarseOrTouch || w <= 960;
}

export async function requestBrowserFullscreen(): Promise<{ ok: boolean; reason?: 'unsupported' | 'failed' }> {
  if (!checkSupportsFullscreen()) {
    return { ok: false, reason: 'unsupported' };
  }
  const el = document.documentElement as FullscreenEl;
  try {
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        await el.requestFullscreen();
      }
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function exitBrowserFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDoc;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}

export function useFullscreenAndOrientation() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => getFullscreenActive());
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isStandalonePwa());
  const [isMobileLandscape, setIsMobileLandscape] = useState<boolean>(() => checkIsMobileLandscape());
  const [supportsFullscreen] = useState<boolean>(() => checkSupportsFullscreen());

  useEffect(() => {
    const syncAll = () => {
      setIsFullscreen(getFullscreenActive());
      setIsStandalone(isStandalonePwa());
      setIsMobileLandscape(checkIsMobileLandscape());
    };
    const orientationMq = window.matchMedia?.('(orientation: landscape)');
    window.addEventListener('resize', syncAll, { passive: true });
    window.addEventListener('orientationchange', syncAll, { passive: true });
    document.addEventListener('fullscreenchange', syncAll);
    document.addEventListener('webkitfullscreenchange', syncAll);
    orientationMq?.addEventListener?.('change', syncAll);
    syncAll();
    return () => {
      window.removeEventListener('resize', syncAll);
      window.removeEventListener('orientationchange', syncAll);
      document.removeEventListener('fullscreenchange', syncAll);
      document.removeEventListener('webkitfullscreenchange', syncAll);
      orientationMq?.removeEventListener?.('change', syncAll);
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    const res = await requestBrowserFullscreen();
    setIsFullscreen(getFullscreenActive());
    return res;
  }, []);

  const exitFullscreen = useCallback(async () => {
    const ok = await exitBrowserFullscreen();
    setIsFullscreen(getFullscreenActive());
    return ok;
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (getFullscreenActive()) {
      await exitBrowserFullscreen();
      setIsFullscreen(getFullscreenActive());
      return { ok: true, active: false };
    }
    const res = await requestBrowserFullscreen();
    const active = getFullscreenActive();
    setIsFullscreen(active);
    return { ...res, active };
  }, []);

  return {
    isFullscreen,
    isStandalone,
    isMobileLandscape,
    supportsFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
