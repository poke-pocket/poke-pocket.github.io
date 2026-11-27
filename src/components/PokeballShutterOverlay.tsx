import React, { useMemo } from 'react';
import {
  GYM_BADGE_CATALOG,
  ensureFreshMetaProgress,
  getActiveTrainerTagDef,
  getShowcaseBadgeIds,
} from '../data/metaProgression';
import type { GameSave } from '../types/pet';
import { PixelItemImg } from './PixelSprite';

export type PokeballShutterStage = 'idle' | 'closing' | 'holding' | 'opening';
export type ShutterBallTier = 'pokeball' | 'greatball' | 'ultraball' | 'masterball';

export interface PokeballShutterState {
  stage: PokeballShutterStage;
  label: string;
}

export interface ShutterThemeSnapshot {
  tier: ShutterBallTier;
  tierLabel: string;
  rankName: string;
  maxLevel: number;
  badgeCount: number;
  badgeIcons: { id: string; name: string; icon: string }[];
}

export const BOOT_SHUTTER_THEME_KEY = 'poke_pocket_boot_shutter_v1';

const TRAVEL_WHISPER_TIPS: string[] = [
  '「城市友好商店备有各类树果、携带道具与专用精灵球，路过时记得补货。」',
  '「下雨天水系伙伴格外有干劲，雷雨时电系招式威力大增。」',
  '「击晕稀有宝可梦后，长按投球键就能立刻换上高级球或大师球。」',
  '「夜幕降临时，黑暗球的收服成功率会大幅提升。」',
  '「累了就去城市里的宝可梦中心坐坐，乔伊小姐随时都能帮队伍恢复元气。」',
  '「多和街头的路人聊聊天，也许能打听到附近少见宝可梦的去向。」',
  '「在宝可梦中心日报里，能翻阅全球各地最新发生的趣闻与通告。」',
];

/**
 * Resolves the trainer's current loading-screen Poké Ball tier and unlocked badge showcase
 * based on highest Pokémon level and earned gym/honor badges:
 * - Master Ball: >= 6 badges OR max Lv >= 65
 * - Ultra Ball:  >= 3 badges OR max Lv >= 40
 * - Great Ball:  >= 1 badge  OR max Lv >= 20
 * - Poké Ball:   Starter tier
 */
export function resolveShutterTheme(save?: GameSave | null): ShutterThemeSnapshot {
  if (!save) {
    return {
      tier: 'pokeball',
      tierLabel: '精灵球',
      rankName: '见习训练师',
      maxLevel: 1,
      badgeCount: 0,
      badgeIcons: [],
    };
  }
  const meta = ensureFreshMetaProgress(save.meta);
  const maxLevel = save.pets.reduce((m, p) => Math.max(m, p.level ?? 1), 1);
  const earnedIds = meta.unlockedBadges ?? [];
  const earnedSet = new Set<string>(earnedIds);
  const badgeCount = earnedIds.length;
  const rankName = getActiveTrainerTagDef(meta).name;

  // Prioritize player's chosen showcase badges that are earned, then fill up to 6 from other earned badges
  const orderedIds: string[] = [];
  for (const id of getShowcaseBadgeIds(meta)) {
    if (earnedSet.has(id) && !orderedIds.includes(id)) orderedIds.push(id);
  }
  for (const id of earnedIds) {
    if (orderedIds.length >= 6) break;
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }
  const badgeIcons = orderedIds
    .slice(0, 6)
    .map((id) => GYM_BADGE_CATALOG.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map((b) => ({ id: b.id, name: b.name, icon: b.icon }));

  let tier: ShutterBallTier = 'pokeball';
  let tierLabel = '精灵球';
  if (badgeCount >= 6 || maxLevel >= 65) {
    tier = 'masterball';
    tierLabel = '大师球';
  } else if (badgeCount >= 3 || maxLevel >= 40) {
    tier = 'ultraball';
    tierLabel = '高级球';
  } else if (badgeCount >= 1 || maxLevel >= 20) {
    tier = 'greatball';
    tierLabel = '超级球';
  }

  return {
    tier,
    tierLabel,
    rankName,
    maxLevel,
    badgeCount,
    badgeIcons,
  };
}

/** Persists compact theme snapshot to localStorage so zero-JS index.html renders the matching ball & badges on Frame 0 */
export function syncBootShutterThemeCache(save: GameSave): void {
  if (typeof window === 'undefined') return;
  try {
    const snap = resolveShutterTheme(save);
    window.localStorage.setItem(BOOT_SHUTTER_THEME_KEY, JSON.stringify(snap));
  } catch {
    // ignore storage errors
  }
}

let bootCurtainDismissed = false;
let bootCurtainPct = 24;

/** Smoothly advances the initial boot curtain pixel progress gauge (monotonic, never regresses) */
export function setBootCurtainProgress(pct: number): void {
  if (bootCurtainDismissed || typeof document === 'undefined') return;
  const clamped = Math.max(bootCurtainPct, Math.min(96, Math.round(pct)));
  bootCurtainPct = clamped;
  const fill = document.getElementById('pb-boot-fill');
  if (fill) {
    fill.style.width = `${clamped}%`;
  }
}

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
  const fill = document.getElementById('pb-boot-fill');
  if (fill) fill.style.width = '100%';
  el.classList.add('is-ready');
  window.setTimeout(() => {
    el.classList.add('is-opening');
    window.setTimeout(() => {
      el.remove();
    }, 560);
  }, 140);
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
    <rect x="6" y="0" width="12" height="1" fill="var(--pb-low)" />
    <rect x="4" y="1" width="2" height="1" fill="var(--pb-low)" />
    <rect x="18" y="1" width="2" height="1" fill="var(--pb-low)" />
    <rect x="2" y="2" width="2" height="2" fill="var(--pb-low)" />
    <rect x="20" y="2" width="2" height="2" fill="var(--pb-low)" />
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

/** Iconic pixel-art upper hemisphere crests for Great Ball, Ultra Ball, and Master Ball */
const TierBallMotifSvg: React.FC<{ tier: ShutterBallTier }> = ({ tier }) => {
  if (tier === 'greatball') {
    return (
      <svg className="pb-tier-motif-svg" viewBox="0 0 80 28" shapeRendering="crispEdges" aria-hidden="true">
        {/* Twin crimson stepped pixel wing chevrons */}
        <rect x="6" y="4" width="12" height="5" fill="#14121d" />
        <rect x="10" y="9" width="12" height="5" fill="#14121d" />
        <rect x="14" y="14" width="12" height="5" fill="#14121d" />
        <rect x="7" y="5" width="10" height="3" fill="#e03131" />
        <rect x="11" y="10" width="10" height="3" fill="#e03131" />
        <rect x="15" y="15" width="10" height="3" fill="#e03131" />
        <rect x="8" y="5" width="7" height="1" fill="#ff8787" />
        <rect x="12" y="10" width="7" height="1" fill="#ff8787" />
        <rect x="62" y="4" width="12" height="5" fill="#14121d" />
        <rect x="58" y="9" width="12" height="5" fill="#14121d" />
        <rect x="54" y="14" width="12" height="5" fill="#14121d" />
        <rect x="63" y="5" width="10" height="3" fill="#e03131" />
        <rect x="59" y="10" width="10" height="3" fill="#e03131" />
        <rect x="55" y="15" width="10" height="3" fill="#e03131" />
        <rect x="65" y="5" width="7" height="1" fill="#ff8787" />
        <rect x="61" y="10" width="7" height="1" fill="#ff8787" />
      </svg>
    );
  }
  if (tier === 'ultraball') {
    return (
      <svg className="pb-tier-motif-svg" viewBox="0 0 80 28" shapeRendering="crispEdges" aria-hidden="true">
        {/* Iconic Ultra Ball Golden 'H' Pixel Bands */}
        <rect x="17" y="0" width="9" height="28" fill="#14121d" />
        <rect x="54" y="0" width="9" height="28" fill="#14121d" />
        <rect x="24" y="1" width="32" height="8" fill="#14121d" />
        <rect x="18" y="0" width="7" height="28" fill="#ffd43b" />
        <rect x="55" y="0" width="7" height="28" fill="#ffd43b" />
        <rect x="25" y="2" width="30" height="6" fill="#ffd43b" />
        <rect x="19" y="0" width="2" height="28" fill="#fff3bf" />
        <rect x="56" y="0" width="2" height="28" fill="#fff3bf" />
        <rect x="25" y="2" width="30" height="2" fill="#fff3bf" />
      </svg>
    );
  }
  if (tier === 'masterball') {
    return (
      <svg className="pb-tier-motif-svg" viewBox="0 0 80 28" shapeRendering="crispEdges" aria-hidden="true">
        {/* Left & Right Magenta Master Ball Pixel Domes */}
        <rect x="6" y="5" width="14" height="12" fill="#14121d" />
        <rect x="8" y="3" width="10" height="16" fill="#14121d" />
        <rect x="7" y="6" width="12" height="10" fill="#e64980" />
        <rect x="9" y="4" width="8" height="14" fill="#e64980" />
        <rect x="9" y="5" width="5" height="2" fill="#ff87ab" />
        <rect x="60" y="5" width="14" height="12" fill="#14121d" />
        <rect x="62" y="3" width="10" height="16" fill="#14121d" />
        <rect x="61" y="6" width="12" height="10" fill="#e64980" />
        <rect x="63" y="4" width="8" height="14" fill="#e64980" />
        <rect x="64" y="5" width="5" height="2" fill="#ff87ab" />
        {/* Iconic Center Pixel 'M' Crest */}
        <rect x="33" y="4" width="14" height="12" fill="#14121d" opacity="0.28" />
        <rect x="34" y="5" width="2" height="10" fill="#ffffff" />
        <rect x="44" y="5" width="2" height="10" fill="#ffffff" />
        <rect x="36" y="7" width="2" height="2" fill="#ffffff" />
        <rect x="42" y="7" width="2" height="2" fill="#ffffff" />
        <rect x="38" y="9" width="4" height="2" fill="#ffffff" />
      </svg>
    );
  }
  return null;
};

export const PokeballShutterOverlay: React.FC<{
  state: PokeballShutterState;
  save?: GameSave | null;
}> = ({ state, save }) => {
  const theme = useMemo(() => resolveShutterTheme(save), [save]);
  const tipText = useMemo(() => {
    if (!state.label) return TRAVEL_WHISPER_TIPS[0];
    let hash = 0;
    for (let i = 0; i < state.label.length; i++) {
      hash = (hash * 31 + state.label.charCodeAt(i)) >>> 0;
    }
    return TRAVEL_WHISPER_TIPS[hash % TRAVEL_WHISPER_TIPS.length];
  }, [state.label]);

  if (state.stage === 'idle') return null;
  const cls =
    state.stage === 'closing'
      ? 'is-closing'
      : state.stage === 'holding'
        ? 'is-holding'
        : 'is-opening';
  const fillPct = state.stage === 'closing' ? 35 : state.stage === 'holding' ? 82 : 100;

  return (
    <div
      className={`pb-shutter-overlay is-tier-${theme.tier} ${cls}`}
      role="status"
      aria-live="polite"
    >
      {/* Upper Tiered Pixel-Art Poké Ball Hemisphere */}
      <div className="pb-shutter-half is-top">
        <div className="pb-top-pixel-glint" />
        <div className="pb-top-dither-hi" />
        <div className="pb-top-dither-low" />
        <div className="pb-top-seam-bevel" />
        <TierBallMotifSvg tier={theme.tier} />
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
            <span className="pb-px-tag">旅途中</span>
            <span className="pb-shutter-text">{state.label || '背上行囊，准备踏上旅途…'}</span>
          </div>
          <div className="pb-px-gauge" aria-hidden="true">
            <div className="pb-px-gauge-fill" style={{ width: `${fillPct}%` }} />
          </div>
          {(theme.badgeIcons.length > 0 || theme.tier !== 'pokeball') && (
            <div className="pb-shutter-badges-row">
              <span className="pb-shutter-rank-label">
                {theme.rankName}
                {theme.badgeCount > 0 ? ` · ${theme.badgeCount} 枚徽章` : ` · Lv.${theme.maxLevel}`}
              </span>
              {theme.badgeIcons.length > 0 && (
                <div className="pb-shutter-badge-icons">
                  {theme.badgeIcons.map((b) => (
                    <span key={b.id} className="pb-shutter-badge-item" title={b.name}>
                      <PixelItemImg src={b.icon} size={22} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="pb-shutter-tip">{tipText}</div>
        </div>
      </div>
    </div>
  );
};
