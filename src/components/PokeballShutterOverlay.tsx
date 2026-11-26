import React from 'react';

export type PokeballShutterStage = 'idle' | 'closing' | 'holding' | 'opening';

export interface PokeballShutterState {
  stage: PokeballShutterStage;
  label: string;
}

let bootCurtainDismissed = false;

/**
 * Smoothly unlocks and opens the initial zero-JS `#pokeball-boot-curtain` placed in `index.html`
 * once the 3D WebGL world has painted its first live frames!
 */
export function dismissInitialBootPokeballCurtain(): void {
  if (bootCurtainDismissed || typeof document === 'undefined') return;
  const el = document.getElementById('pokeball-boot-curtain');
  if (!el) {
    bootCurtainDismissed = true;
    return;
  }
  bootCurtainDismissed = true;
  el.classList.add('is-ready');
  window.setTimeout(() => {
    el.classList.add('is-opening');
    window.setTimeout(() => {
      el.remove();
    }, 560);
  }, 110);
}

export const PokeballShutterOverlay: React.FC<{ state: PokeballShutterState }> = ({ state }) => {
  if (state.stage === 'idle') return null;
  const cls =
    state.stage === 'closing'
      ? 'is-closing'
      : state.stage === 'holding'
        ? 'is-holding'
        : 'is-opening';

  return (
    <div className={`pb-shutter-overlay ${cls}`} role="status" aria-live="polite">
      {/* Upper Crimson Poké Ball Hemisphere */}
      <div className="pb-shutter-half is-top">
        <div className="pb-top-sheen" />
        <div className="pb-top-socket" />
      </div>

      {/* Lower Pearl-White Poké Ball Hemisphere + Center Clasp Button */}
      <div className="pb-shutter-half is-bottom">
        <div className="pb-center-clasp">
          <div className="pb-btn-ring">
            <div className="pb-btn-core" />
          </div>
        </div>
        {state.label && (
          <div className="pb-shutter-label">
            <span>{state.label}</span>
            <i className="pb-dots" aria-hidden="true">
              ···
            </i>
          </div>
        )}
      </div>
    </div>
  );
};
