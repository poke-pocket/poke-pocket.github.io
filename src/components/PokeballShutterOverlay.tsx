import React, { useEffect, useMemo, useState } from 'react';
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

interface TravelLoreEntry {
  text: string;
  icons: string[];
}

const TRAVEL_LORE_TIPS: TravelLoreEntry[] = [
  {
    text: '下雨天水系伙伴格外有干劲，雷雨时电系招式的威力也会更强。',
    icons: ['/sprites/items/mystic-water.png', '/sprites/items/light-ball.png'],
  },
  {
    text: '晴空万里时，火系与草系宝可梦的招式威力都会得到明显增幅。',
    icons: ['/sprites/items/charcoal.png', '/sprites/items/miracle-seed.png'],
  },
  {
    text: '夜幕降临后使用黑暗球，能更轻松收服野外击晕的稀有宝可梦。',
    icons: ['/sprites/items/dusk-ball.png', '/sprites/items/ultra-ball.png'],
  },
  {
    text: '路过城市友好商店记得备足树果与携带道具，长途探索更有底气。',
    icons: ['/sprites/items/berry-pouch.png', '/sprites/items/sitrus-berry.png'],
  },
  {
    text: '野外击晕稀有宝可梦后，长按投球键即可立刻换上更高级的精灵球。',
    icons: ['/sprites/items/great-ball.png', '/sprites/items/master-ball.png'],
  },
  {
    text: '走累了就推门进宝可梦中心歇一会儿，乔伊小姐随时都能帮队伍恢复元气。',
    icons: ['/sprites/items/heal-ball.png', '/sprites/items/super-potion.png'],
  },
  {
    text: '挑战各地道馆收集徽章，不仅能强化伙伴战力，还能晋升更高训练师等级。',
    icons: ['/sprites/items/kings-rock.png', '/sprites/items/vs-seeker.png'],
  },
];

interface ClaspRingPixel {
  x: number;
  y: number;
  frac: number;
  shade: 'hi' | 'base' | 'lo';
}

/** Precomputed exact integer pixels of the 24x24 Poké Ball clasp's white ring, sorted clockwise from 12 o'clock */
const CLASP_RING_PIXELS: ClaspRingPixel[] = (() => {
  const isInWhiteDisk = (x: number, y: number) =>
    (x >= 8 && x <= 15 && y >= 3 && y <= 20) ||
    (x >= 6 && x <= 17 && y >= 4 && y <= 19) ||
    (x >= 4 && x <= 19 && y >= 6 && y <= 17) ||
    (x >= 3 && x <= 20 && y >= 8 && y <= 15);
  const isInInnerBezel = (x: number, y: number) =>
    (x >= 9 && x <= 14 && y >= 6 && y <= 17) ||
    (x >= 7 && x <= 16 && y >= 7 && y <= 16) ||
    (x >= 6 && x <= 17 && y >= 9 && y <= 14);
  const isTopLeftHi = (x: number, y: number) =>
    (y === 3 && x >= 8 && x <= 15) ||
    (y === 4 && x >= 6 && x <= 10) ||
    (x >= 4 && x <= 5 && y >= 6 && y <= 8) ||
    (x === 3 && y >= 8 && y <= 12);
  const isBottomRightLo = (x: number, y: number) =>
    (y === 20 && x >= 8 && x <= 15) ||
    (y === 19 && x >= 13 && x <= 17) ||
    (x >= 18 && x <= 19 && y >= 15 && y <= 17) ||
    (x === 20 && y >= 11 && y <= 15);

  const out: ClaspRingPixel[] = [];
  for (let y = 3; y <= 20; y++) {
    for (let x = 3; x <= 20; x++) {
      if (!isInWhiteDisk(x, y) || isInInnerBezel(x, y)) continue;
      const frac = ((Math.atan2(x + 0.5 - 12, -(y + 0.5 - 12)) / (Math.PI * 2)) + 1) % 1;
      const shade: 'hi' | 'base' | 'lo' = isTopLeftHi(x, y)
        ? 'hi'
        : isBottomRightLo(x, y)
          ? 'lo'
          : 'base';
      out.push({ x, y, frac, shade });
    }
  }
  out.sort((a, b) => a.frac - b.frac);
  return out;
})();

const TIER_BALL_ICON: Record<ShutterBallTier, string> = {
  pokeball: '/sprites/items/poke-ball.png',
  greatball: '/sprites/items/great-ball.png',
  ultraball: '/sprites/items/ultra-ball.png',
  masterball: '/sprites/items/master-ball.png',
};

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
let bootCurtainPct = 18;

/** Smoothly advances the initial boot curtain clockwise radial clasp-ring progress (monotonic) */
export function setBootCurtainProgress(pct: number): void {
  if (bootCurtainDismissed || typeof document === 'undefined') return;
  const clamped = Math.max(bootCurtainPct, Math.min(96, Math.round(pct)));
  bootCurtainPct = clamped;
  const fn = (window as unknown as { __pbSetBootProgress?: (p: number) => void }).__pbSetBootProgress;
  if (typeof fn === 'function') {
    fn(clamped);
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
  const fn = (window as unknown as { __pbSetBootProgress?: (p: number) => void }).__pbSetBootProgress;
  if (typeof fn === 'function') {
    fn(100);
  }
  el.classList.add('is-ready');
  window.setTimeout(() => {
    el.classList.add('is-opening');
    window.setTimeout(() => {
      el.remove();
    }, 560);
  }, 160);
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
 * whose white pixel border fills clockwise pixel-by-pixel to indicate loading progress!
 */
const PixelClaspButtonSvg: React.FC<{ progressPct: number; isComplete: boolean }> = ({
  progressPct,
  isComplete,
}) => {
  const threshold = Math.max(0, Math.min(1, progressPct / 100));
  return (
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

      {/* 2. White Ring Pixels — Clockwise Radial Pixel Progress Fill! */}
      {CLASP_RING_PIXELS.map((p) => {
        const filled = isComplete || (threshold > 0 && p.frac <= threshold);
        let fill: string;
        if (filled) {
          if (isComplete) {
            fill = p.shade === 'hi' ? '#b2f2bb' : p.shade === 'lo' ? '#2b8a3e' : '#51cf66';
          } else {
            fill =
              p.shade === 'hi'
                ? 'var(--pb-ring-hi)'
                : p.shade === 'lo'
                  ? 'var(--pb-ring-lo)'
                  : 'var(--pb-ring-fill)';
          }
        } else {
          fill = p.shade === 'hi' ? '#ffffff' : p.shade === 'lo' ? '#adb5bd' : '#f1f3f5';
        }
        return <rect key={`${p.x}_${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={fill} />;
      })}

      {/* 3. Inner Dark Pixel Bezel (#14121d) */}
      <rect x="9" y="6" width="6" height="12" fill="#14121d" />
      <rect x="7" y="7" width="10" height="10" fill="#14121d" />
      <rect x="6" y="9" width="12" height="6" fill="#14121d" />

      {/* 4. Glowing Stepped Pixel Core */}
      <g className="pb-pixel-core-group">
        <rect className="pb-core-base" x="9" y="7" width="6" height="10" />
        <rect className="pb-core-base" x="8" y="8" width="8" height="8" />
        <rect className="pb-core-base" x="7" y="9" width="10" height="6" />
        <rect className="pb-core-shade" x="9" y="16" width="6" height="1" />
        <rect className="pb-core-shade" x="14" y="14" width="2" height="2" />
        <rect className="pb-core-shade" x="16" y="11" width="1" height="4" />
        <rect x="9" y="8" width="2" height="2" fill="#ffffff" />
        <rect x="11" y="8" width="1" height="1" fill="#fff5f5" />
        <rect x="9" y="10" width="1" height="1" fill="#fff5f5" />
      </g>
    </svg>
  );
};

/** Iconic pixel-art upper hemisphere crests for Great Ball, Ultra Ball, and Master Ball */
const TierBallMotifSvg: React.FC<{ tier: ShutterBallTier }> = ({ tier }) => {
  if (tier === 'greatball') {
    return (
      <svg className="pb-tier-motif-svg" viewBox="0 0 80 28" shapeRendering="crispEdges" aria-hidden="true">
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

function resolveStatusIconForLabel(label: string, tier: ShutterBallTier): string {
  if (label.includes('道馆') || label.includes('馆主')) return '/sprites/items/kings-rock.png';
  if (label.includes('草丛') || label.includes('森林') || label.includes('秘境')) {
    return '/sprites/items/poke-radar.png';
  }
  if (label.includes('列车') || label.includes('抵达') || label.includes('城市')) {
    return '/sprites/items/town-map.png';
  }
  return TIER_BALL_ICON[tier];
}

export const PokeballShutterOverlay: React.FC<{
  state: PokeballShutterState;
  save?: GameSave | null;
}> = ({ state, save }) => {
  const theme = useMemo(() => resolveShutterTheme(save), [save]);
  const loreEntry = useMemo(() => {
    if (!state.label) return TRAVEL_LORE_TIPS[0];
    let hash = 0;
    for (let i = 0; i < state.label.length; i++) {
      hash = (hash * 31 + state.label.charCodeAt(i)) >>> 0;
    }
    return TRAVEL_LORE_TIPS[hash % TRAVEL_LORE_TIPS.length];
  }, [state.label]);

  const [ringPct, setRingPct] = useState(0);

  // Smooth clockwise radial fill on the Poké Ball clasp's white pixel border
  useEffect(() => {
    if (state.stage === 'idle') {
      setRingPct(0);
      return;
    }
    if (state.stage === 'opening') {
      setRingPct(100);
      return;
    }
    const target = state.stage === 'closing' ? 38 : 92;
    let raf = 0;
    const step = () => {
      setRingPct((prev) => {
        if (prev >= target) return prev;
        const delta = Math.max(1.8, (target - prev) * 0.14);
        return Math.min(target, prev + delta);
      });
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [state.stage]);

  if (state.stage === 'idle') return null;
  const cls =
    state.stage === 'closing'
      ? 'is-closing'
      : state.stage === 'holding'
        ? 'is-holding'
        : 'is-opening';
  const statusIcon = resolveStatusIconForLabel(state.label, theme.tier);

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

      {/* Lower Pearl-White Pixel-Art Poké Ball Hemisphere + Radial-Progress Pixel Clasp */}
      <div className="pb-shutter-half is-bottom">
        <div className="pb-bottom-seam-hi" />
        <div className="pb-bottom-dither-low" />
        <div className="pb-center-clasp">
          <PixelClaspButtonSvg progressPct={ringPct} isComplete={state.stage === 'opening'} />
        </div>

        {/* Part 1 (Directly Below the Center Orb): Current Loading Action + Earned Badges & Rank */}
        <div className="pb-shutter-center-info">
          <div className="pb-shutter-status-row">
            <PixelItemImg src={statusIcon} size={22} />
            <span className="pb-shutter-text">{state.label || '背上行囊，准备踏上旅途…'}</span>
          </div>

          {(theme.badgeIcons.length > 0 || theme.tier !== 'pokeball') && (
            <div className="pb-shutter-badges-row">
              {theme.badgeIcons.length > 0 && (
                <div className="pb-shutter-badge-icons">
                  {theme.badgeIcons.map((b) => (
                    <span key={b.id} className="pb-shutter-badge-item" title={b.name}>
                      <PixelItemImg src={b.icon} size={22} />
                    </span>
                  ))}
                </div>
              )}
              <span className="pb-shutter-rank-label">
                {theme.rankName}
                {theme.badgeCount > 0 ? ` · ${theme.badgeCount} 枚徽章` : ` · Lv.${theme.maxLevel}`}
              </span>
            </div>
          )}
        </div>

        {/* Part 2 (Bottom-Right Above Shadow Band): Immersive Travel Tip + Matching Pixel Icons */}
        <div className="pb-shutter-corner-lore">
          <div className="pb-lore-icons" aria-hidden="true">
            {loreEntry.icons.map((src) => (
              <PixelItemImg key={src} src={src} size={22} />
            ))}
          </div>
          <p className="pb-shutter-tip">{loreEntry.text}</p>
        </div>
      </div>
    </div>
  );
};
