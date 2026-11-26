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
  }, 120);
}

/**
 * Authentic 24x12 integer-grid pixel-staircase upper socket arch (`shapeRendering="crispEdges"`)
 */
const PixelTopSocketSvg: React.FC = () => (
  <svg
    className="pb-pixel-socket-svg"
    viewBox="0 0 24 12"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    {/* Dark pixel staircase arch cupping the center Poké Ball clasp */}
    <rect x="6" y="0" width="12" height="1" fill="#9e1f1f" />
    <rect x="4" y="1" width="2" height="1" fill="#9e1f1f" />
    <rect x="18" y="1" width="2" height="1" fill="#9e1f1f" />
    <rect x="2" y="2" width="2" height="2" fill="#9e1f1f" />
    <rect x="20" y="2" width="2" height="2" fill="#9e1f1f" />
    <rect x="7" y="1" width="10" height="1" fill="#14121d" />
    <rect x="5" y="2" width="14" height="1" fill="#14121d" />
    <rect x="3" y="3" width="18" height="2" fill="#14121d" />
    <rect x="2" y="5" width="20" height="2" fill="#14121d" />
    <rect x="1" y="7" width="22" height="2" fill="#14121d" />
    <rect x="0" y="9" width="24" height="3" fill="#14121d" />
  </svg>
);

/**
 * Authentic 24x24 integer-grid pixel-art Poké Ball Center Clasp (`shapeRendering="crispEdges"`)
 * Zero smooth vector circles — 100% chunky stepped pixel staircase rings, specular glints & glowing pixel core!
 */
const PixelClaspButtonSvg: React.FC = () => (
  <svg
    className="pb-pixel-clasp-svg"
    viewBox="0 0 24 24"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    {/* 1. Outer Dark Pixel Ring (#14121d) */}
    <rect x="7" y="0" width="10" height="24" fill="#14121d" />
    <rect x="5" y="1" width="14" height="22" fill="#14121d" />
    <rect x="3" y="2" width="18" height="20" fill="#14121d" />
    <rect x="2" y="3" width="20" height="18" fill="#14121d" />
    <rect x="1" y="5" width="22" height="14" fill="#14121d" />
    <rect x="0" y="7" width="24" height="10" fill="#14121d" />

    {/* 2. Brushed Pearl-White Pixel Ring (#f1f3f5 base + #ffffff top-left bevel + #adb5bd bottom-right shade) */}
    <rect x="8" y="3" width="8" height="18" fill="#f1f3f5" />
    <rect x="6" y="4" width="12" height="16" fill="#f1f3f5" />
    <rect x="4" y="6" width="16" height="12" fill="#f1f3f5" />
    <rect x="3" y="8" width="18" height="8" fill="#f1f3f5" />
    {/* Top-left bright pixel highlight */}
    <rect x="8" y="3" width="8" height="1" fill="#ffffff" />
    <rect x="6" y="4" width="5" height="1" fill="#ffffff" />
    <rect x="4" y="6" width="2" height="3" fill="#ffffff" />
    <rect x="3" y="8" width="1" height="5" fill="#ffffff" />
    {/* Bottom-right pixel shadow */}
    <rect x="8" y="20" width="8" height="1" fill="#adb5bd" />
    <rect x="13" y="19" width="5" height="1" fill="#adb5bd" />
    <rect x="18" y="15" width="2" height="3" fill="#adb5bd" />
    <rect x="20" y="11" width="1" height="5" fill="#adb5bd" />

    {/* 3. Inner Dark Pixel Bezel (#14121d) */}
    <rect x="9" y="6" width="6" height="12" fill="#14121d" />
    <rect x="7" y="7" width="10" height="10" fill="#14121d" />
    <rect x="6" y="9" width="12" height="6" fill="#14121d" />

    {/* 4. Glowing Stepped Pixel Core (CSS-animated via currentColor / class!) */}
    <g className="pb-pixel-core-group">
      <rect className="pb-core-base" x="9" y="7" width="6" height="10" />
      <rect className="pb-core-base" x="8" y="8" width="8" height="8" />
      <rect className="pb-core-base" x="7" y="9" width="10" height="6" />
      {/* Bottom-right pixel shade */}
      <rect className="pb-core-shade" x="9" y="16" width="6" height="1" />
      <rect className="pb-core-shade" x="14" y="14" width="2" height="2" />
      <rect className="pb-core-shade" x="16" y="11" width="1" height="4" />
      {/* Crisp 2x2 + 1x1 top-left pixel specular glint */}
      <rect x="9" y="8" width="2" height="2" fill="#ffffff" />
      <rect x="11" y="8" width="1" height="1" fill="#fff5f5" />
      <rect x="9" y="10" width="1" height="1" fill="#fff5f5" />
    </g>
  </svg>
);

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
      {/* Upper Crimson Pixel-Art Poké Ball Hemisphere */}
      <div className="pb-shutter-half is-top">
        <div className="pb-top-pixel-glint" />
        <div className="pb-top-dither-hi" />
        <div className="pb-top-dither-low" />
        <div className="pb-top-seam-bevel" />
        <PixelTopSocketSvg />
      </div>

      {/* Lower Pearl-White Pixel-Art Poké Ball Hemisphere + Stepped Pixel Clasp */}
      <div className="pb-shutter-half is-bottom">
        <div className="pb-bottom-seam-hi" />
        <div className="pb-bottom-dither-low" />
        <div className="pb-center-clasp">
          <PixelClaspButtonSvg />
        </div>
        <div className="pb-shutter-hud-box">
          <div className="pb-shutter-title-row">
            <span className="pb-px-tag">LOADING</span>
            <span className="pb-shutter-text">{state.label || '正在载入掌机世界…'}</span>
          </div>
          <div className="pb-px-bar" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
};
