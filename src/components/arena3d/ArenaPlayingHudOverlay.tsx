import { MONSTER_QUALITY_META } from './arenaTypesAndProps';
import type { ArenaSharedCtx } from './arenaTypesAndProps';
import React, { useEffect, useRef, useState } from 'react';
import { POKEBALL_CATCH_STATS, ROOM_CATALOG } from '../../data/catalog';
import { SURVIVOR_SKILLS, WORLD_TOWNS_3D } from '../../data/survivorsTactics';
import { GYM_BADGE_CATALOG, getActiveTrainerTagDef, getShowcaseBadgeIds } from '../../data/metaProgression';
import type { RoomThemeId } from '../../types/pet';
import { getBallAvailability } from '../../utils/petEngine';
import { ShopOverlay } from '../ShopOverlay';
import { WorldMapHud } from '../WorldMapHud';
import { BGM_PLAY_MODE_LABELS, sound, type BgmPlayMode, type BgmPlayerState } from '../../utils/sound';
import { PixelGrid, PixelIcon, PixelItemImg } from '../PixelSprite';
import type { PixelIconName } from '../../data/pixelIcons';
import { TrimmedSpriteImg } from '../TrimmedSpriteImg';
import { ArenaTownSocialAndBusOverlay } from './ArenaTownSocialAndBusOverlay';

const POKEBALL_RING_PALETTE: Record<string, string> = {
  K: '#12101a',
  R: '#e03131',
  H: '#ff8787',
  D: '#b02020',
  W: '#fffdf5',
  S: '#ced4da',
};

const POKEBALL_RING_GRID: string[] = [
  '.......KKKKKKKK.......',
  '.....KKHHHHHHHHKK.....',
  '...KKHHHRRRRRRRDDKK...',
  '..KHHRRKKKKKKKKRRDDK..',
  '..KHRKK........KKRDK..',
  '.KHRK............KRDK.',
  '.KRK..............KDK.',
  'KRK................KDK',
  'KRK................KDK',
  'KRK................KDK',
  'KKKK..............KKKK',
  'KKKK..............KKKK',
  'KWK................KSK',
  'KWK................KSK',
  'KWK................KSK',
  '.KWK..............KSK.',
  '.KWWK............KSSK.',
  '..KWWKK........KKSSK..',
  '..KWWWWKKKKKKKKSSSSK..',
  '...KKWWWWWWWWSSSSKK...',
  '.....KKWWWWSSSSKK.....',
  '.......KKKKKKKK.......',
];

/**
 * 24x24 8-way symmetric stepped pixel-art circular medallion for bottom-right MOBA wheel buttons
 * (Authentic stepped 1-pixel GBA/NDS outline matching the top-left Poké Ball ring aesthetic!)
 */
const MOBA_CIRCLE_GRID: string[] = [
  '........KKKKKKKK........',
  '......KKHHHHHHHHKK......',
  '....KKHHFFFFFFFFHHKK....',
  '...KHHFFFFFFFFFFFFSSK...',
  '..KHHFFFFFFFFFFFFFFSSK..',
  '..KHFFFFFFFFFFFFFFFFSK..',
  '.KHHFFFFFFFFFFFFFFFFSSK.',
  '.KHFFFFFFFFFFFFFFFFFFSK.',
  'KHFFFFFFFFFFFFFFFFFFFFSK',
  'KHFFFFFFFFFFFFFFFFFFFFSK',
  'KHFFFFFFFFFFFFFFFFFFFFSK',
  'KHFFFFFFFFFFFFFFFFFFFFSK',
  'KFFFFFFFFFFFFFFFFFFFFFFK',
  'KFFFFFFFFFFFFFFFFFFFFFSK',
  'KFFFFFFFFFFFFFFFFFFFFFSK',
  'KFFFFFFFFFFFFFFFFFFFFFSK',
  '.KFFFFFFFFFFFFFFFFFFSSK.',
  '.KFFFFFFFFFFFFFFFFFFSSK.',
  '..KFFFFFFFFFFFFFFFFSSK..',
  '..KSSFFFFFFFFFFFFFFSSK..',
  '...KSSFFFFFFFFFFFFSSK...',
  '....KKSSSSSSSSSSSSKK....',
  '......KKSSSSSSSSKK......',
  '........KKKKKKKK........',
];

const MOBA_CIRCLE_PALETTES: Record<
  'jump' | 'ball' | 'salvo' | 'heal' | 'boost',
  Record<string, string>
> = {
  jump: { K: '#12101a', H: '#fff9db', F: '#ffe066', S: '#f0b429' },
  ball: { K: '#12101a', H: '#ffffff', F: '#fffdf4', S: '#ded4b4' },
  salvo: { K: '#12101a', H: '#e7f5ff', F: '#74c0fc', S: '#339af0' },
  heal: { K: '#12101a', H: '#ebfbee', F: '#8ce99a', S: '#40c057' },
  boost: { K: '#12101a', H: '#fff4e6', F: '#ffc078', S: '#fd7e14' },
};

const TRAINER_EMBLEM_GRID: string[] = [
  '.KKKKKKKKKK.',
  'KHHHHHHHHHHK',
  'KCCCCCCCCCCK',
  'KCCCYYYYCCCK',
  'KCCYYWWYYCCK',
  'KCCKKKKKKCCK',
  '.KCCWWWWCCK.',
  '.KCCCCCCCCK.',
  '..KCCCCCCK..',
  '...KCCCCK...',
  '....KKKK....',
  '............',
];

const GYM_BADGE_PIXEL_ART: Record<
  string,
  { grid: string[]; palette: Record<string, string> }
> = {
  boulder_badge: {
    palette: { K: '#161420', W: '#ffffff', L: '#dee2e6', G: '#adb5bd', D: '#6c757d' },
    grid: [
      '...KKKKKK...',
      '..KLLLLLLK..',
      '.KLWWWWLLGK.',
      'KLWWGGGGGGDK',
      'KLWGGGGGGGGK',
      'KLGGGGGGGGDK',
      'KGGGGGGGGDDK',
      'KGGGGGGGDDDK',
      '.KGGGGGDDDK.',
      '..KDDDDDDK..',
      '...KKKKKK...',
      '............',
    ],
  },
  cascade_badge: {
    palette: { K: '#10233b', W: '#ffffff', L: '#74c0fc', B: '#228be6', D: '#1864ab' },
    grid: [
      '.....KK.....',
      '....KLLK....',
      '...KLWWLK...',
      '..KLWBBBLK..',
      '.KLWBBBBBLK.',
      '.KLBBBBBBBK.',
      'KLBBBBBBBBBK',
      'KBBBBBBBBBDK',
      '.KBBBBBBBDK.',
      '..KDDDDDDK..',
      '...KKKKKK...',
      '............',
    ],
  },
  thunder_badge: {
    palette: { K: '#3b2200', W: '#fff9db', Y: '#ffd43b', O: '#f08c00' },
    grid: [
      '.....KK.....',
      '.KK..YY..KK.',
      '.KYYKYYKYYK.',
      '..KYYYYYYK..',
      '.KYYWWWWYYK.',
      'KYYWWOOOWYYK',
      'KYYWOOOOYYYK',
      '.KYYOOOOYYK.',
      '..KYYYYYYK..',
      '.KYYKYYKYYK.',
      '.KK..KK..KK.',
      '............',
    ],
  },
  rainbow_badge: {
    palette: { K: '#162818', R: '#ff6b6b', B: '#4dabf7', G: '#51cf66', P: '#cc5de8', Y: '#ffe066' },
    grid: [
      '....KKKK....',
      '...KRRRRK...',
      '.KKRRRRRRKK.',
      'KBBBBYYGGGGK',
      'KBBBYYYYGGGK',
      'KBBBYYYYGGGK',
      '.KKBYYYYGKK.',
      '..KPPPPPPK..',
      '..KPPPPPPK..',
      '...KKKKKK...',
      '............',
      '............',
    ],
  },
  volcano_badge: {
    palette: { K: '#2b0b0e', W: '#fff9db', Y: '#ffd43b', R: '#fa5252' },
    grid: [
      '.....KK.....',
      '....KRRK....',
      '..KKRRRRKK..',
      '.KRRRYYRRRK.',
      'KRRRYWWYRRRK',
      'KRRRYYYYRRRK',
      'KRRRRYYRRRRK',
      '.KRRRRRRRRK.',
      '..KRRRRRRK..',
      '...KKKKKK...',
      '............',
      '............',
    ],
  },
  earth_badge: {
    palette: { K: '#122618', L: '#8ce99a', G: '#2f9e44', Y: '#fcc419' },
    grid: [
      '.....KK.....',
      '....KLLK....',
      '..KKLLLLKK..',
      '.KLLGGGGLLK.',
      'KLLGGYYGGLLK',
      '.KLLGYYGLLK.',
      '..KLGYYGLK..',
      '...KGYYGK...',
      '....KYYK....',
      '...KKKKKK...',
      '............',
      '............',
    ],
  },
};

const LOCKED_BADGE_PALETTE: Record<string, string> = {
  K: '#141522',
  W: '#6c738a',
  L: '#5c6278',
  G: '#494f63',
  B: '#494f63',
  R: '#494f63',
  P: '#43485c',
  Y: '#5c6278',
  O: '#43485c',
  D: '#363b4d',
};

function formatHudDistance(distM: number): string {
  if (!Number.isFinite(distM) || distM <= 0) return '0 m';
  if (distM < 1000) return `${Math.max(1, Math.round(distM))} m`;
  if (distM < 10000) return `${(distM / 1000).toFixed(2)} km`;
  if (distM < 100000) return `${(distM / 1000).toFixed(1)} km`;
  return `${Math.round(distM / 1000)} km`;
}

function formatHudEta(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '即将抵达';
  const s = Math.max(1, Math.round(sec));
  if (s < 60) return `约 ${s}秒`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `约 ${m}分${String(rem).padStart(2, '0')}秒` : `约 ${m}分钟`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m > 0 ? `约 ${h}小时${m}分` : `约 ${h}小时`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const ArenaPlayingHudOverlay: React.FC<{ ctx: Record<string, any> }> = ({ ctx: rawCtx }) => {
  const ctx = rawCtx as ArenaSharedCtx;
  const { activeHeroDef, activeRoom, activeWorldRun, adventureStyle, autoNavActiveLabel, autoNavDistM, autoNavEtaSec, bannerMsg, bgmState, bgmTrackLabel, bindMultiTouchAction, captureCutscene, captureOffer, diffMeta, difficultyId, dragFollowerIdxRef, dragOverFollowerIdx, edgeIndicators, externalPaused, floatingTags, followersView, handleBgmCycleMode, handleBgmNext, handleBgmPlayPause, handleBgmPrev, hpPct, hud, inRunTownShopOpen, isSurfing, jumpQueuedRef, levelChoices, liveOverlandCity, liveWeather, mapSnapshot, meta, minStr, mobilePartyOpen, nearbyKoTarget, onBuyAccessory, onBuyFood, onBuyPokeball, onOpenPokemonManager, onPullGacha, onPullGachaTen, onToggleBgm, onUpdatePetConfig, openHeroOrBadgeOverlay, pet, prefs, regionMeta, removeBattleFollower, reorderBattleFollowers, resetVirtualPad, resultModal, save, selectedBallId, selectedBiome, setDragOverFollowerIdx, setInRunTownShopOpen, setMobilePartyOpen, setSelectedBallId, setTimeAlmanacOpen, setWorldMapOpen, shopOpen, showBanner, solarInfo, startVirtualPad, stopAutoNavRef, toggleWorldMap, triggerBattleActionRef, tryRestorePointerLock, updateVirtualPad, vPad, vPadPointerRef, xpPct } = ctx;

  // Owned Poké Ball types + Long-press left-side Poké Ball switcher state
  const [ballPickerOpen, setBallPickerOpen] = useState(false);
  const ballAnchorRef = useRef<HTMLDivElement | null>(null);
  const ballPressTimerRef = useRef<number | null>(null);
  const ballLongPressedRef = useRef(false);
  const ballPointerDownRef = useRef<number | null>(null);

  const ownedBalls = ROOM_CATALOG.filter(
    (rm) =>
      rm.id === 'pokeball_room' ||
      save.unlockedRooms.includes(rm.id) ||
      (save.ballStock?.[rm.id] ?? 0) > 0,
  );
  const activeBallMeta =
    ownedBalls.find((b) => b.id === selectedBallId) ??
    ROOM_CATALOG.find((b) => b.id === 'pokeball_room') ??
    ROOM_CATALOG[0];
  const activeBallStat =
    POKEBALL_CATCH_STATS[activeBallMeta.id] ?? POKEBALL_CATCH_STATS.pokeball_room;

  useEffect(() => {
    if (!ballPickerOpen) return;
    const onDocDown = (e: PointerEvent) => {
      if (ballAnchorRef.current && !ballAnchorRef.current.contains(e.target as Node)) {
        setBallPickerOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDocDown, true);
    return () => window.removeEventListener('pointerdown', onDocDown, true);
  }, [ballPickerOpen]);

  useEffect(() => {
    return () => {
      if (ballPressTimerRef.current !== null) {
        window.clearTimeout(ballPressTimerRef.current);
      }
    };
  }, []);

  const choosePokeball = (roomId: RoomThemeId) => {
    const rm = ROOM_CATALOG.find((r) => r.id === roomId) ?? ROOM_CATALOG[0];
    const st = POKEBALL_CATCH_STATS[rm.id] ?? POKEBALL_CATCH_STATS.pokeball_room;
    sound.play('confirm');
    setSelectedBallId?.(rm.id);
    setBallPickerOpen(false);
    showBanner?.(`已切换为「${rm.shortName}」（${st.desc}）`, 2000);
  };

  const handleBallBtnPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault();
    }
    ballPointerDownRef.current = e.pointerId;
    ballLongPressedRef.current = false;
    if (ballPressTimerRef.current !== null) {
      window.clearTimeout(ballPressTimerRef.current);
    }
    ballPressTimerRef.current = window.setTimeout(() => {
      ballPressTimerRef.current = null;
      ballLongPressedRef.current = true;
      sound.play('cursor');
      setBallPickerOpen(true);
    }, 280);
  };

  const handleBallBtnPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (ballPointerDownRef.current !== e.pointerId) return;
    ballPointerDownRef.current = null;
    if (ballPressTimerRef.current !== null) {
      window.clearTimeout(ballPressTimerRef.current);
      ballPressTimerRef.current = null;
    }
    if (ballLongPressedRef.current) {
      // Allow press-hold-slide-release directly onto a ball option on the left!
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const optionEl = el?.closest?.('[data-ball-id]') as HTMLElement | null;
      const pickedId = optionEl?.dataset?.ballId as RoomThemeId | undefined;
      if (pickedId) {
        choosePokeball(pickedId);
      }
      return;
    }
    // Short tap: toggle off if picker is open, otherwise throw equipped Poké Ball!
    if (ballPickerOpen) {
      sound.play('cancel');
      setBallPickerOpen(false);
      return;
    }
    if (hud.actionCds.ball <= 0) {
      triggerBattleActionRef.current?.('ball');
    } else {
      sound.play('error');
    }
  };

  const handleBallBtnPointerCancel = () => {
    ballPointerDownRef.current = null;
    if (ballPressTimerRef.current !== null) {
      window.clearTimeout(ballPressTimerRef.current);
      ballPressTimerRef.current = null;
    }
  };
  const isBgmOn = Boolean(save.bgmEnabled && !save.muted && save.bgmVolume > 0 && (prefs.masterVolume ?? 80) > 0);
  const locationLabel =
    adventureStyle === 'vampire_rogue'
      ? regionMeta.name
      : liveOverlandCity?.name ??
        activeWorldRun?.cityName ??
        WORLD_TOWNS_3D.find(
          (t) => Math.hypot(mapSnapshot.px - t.x, mapSnapshot.pz - t.z) < t.plazaRadius + 6,
        )?.name ??
        '野外探索';
  const weatherPixelIcon: PixelIconName =
    liveWeather.kind === 'cloudy'
      ? 'weather_cloudy'
      : liveWeather.kind === 'rain'
        ? 'weather_rain'
        : liveWeather.kind === 'storm'
          ? 'weather_storm'
          : liveWeather.kind === 'hail'
            ? 'weather_hail'
            : liveWeather.kind === 'snow'
            ? 'weather_snow'
            : liveWeather.kind === 'windy'
              ? 'weather_windy'
              : solarInfo.phase === 'night'
                ? 'weather_night_clear'
                : 'weather_clear';
  const weatherChipBg =
    liveWeather.kind === 'clear' && solarInfo.phase === 'night'
      ? '#364fc7'
      : liveWeather.accentColor;
  const phasePixelIcon: PixelIconName =
    solarInfo.phase === 'night'
      ? 'moon'
      : solarInfo.phase === 'dawn'
        ? 'sunrise'
        : solarInfo.phase === 'dusk'
          ? 'sunset'
          : 'sun';
  return (
    <>
          {/* 2D Projected Floating Damage & Enemy Trainer Nameplates */}
          <div className="surv-tags-layer">
            {floatingTags.map((t) => (
              <div
                key={t.id}
                className={`surv-float-tag ${t.isHpBar ? 'is-trainer-tag' : ''}`}
                style={{ left: `${t.sx}%`, top: `${t.sy}%`, color: t.color }}
              >
                <span>{t.text}</span>
                {t.isHpBar && (
                  <div className="tag-hp-track">
                    <div className="tag-hp-fill" style={{ width: `${t.hpPct ?? 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Screen-Perimeter Directional Arrows for Off-Screen Priority Targets (Boss / Knocked-Out Catchable / ★Shiny / Gym Leader!) */}
          {!resultModal && edgeIndicators.length > 0 && (
            <div className="surv-edge-layer" aria-hidden="true">
              {edgeIndicators.map((ind) => (
                <div
                  key={ind.id}
                  className={`surv-edge-pill is-${ind.kind}`}
                  style={{ left: `${ind.sx}%`, top: `${ind.sy}%` }}
                >
                  <span
                    className="edge-arrow"
                    style={{ transform: `rotate(${ind.angleDeg.toFixed(1)}deg)` }}
                  >
                    ▶
                  </span>
                  <PixelItemImg src={ind.icon} size={15} />
                  <strong>{ind.label}</strong>
                  <em>{formatHudDistance(ind.distM)}</em>
                </div>
              ))}
            </div>
          )}

          {/* Clean Sleek Combat Top HUD (EXP Bar integrated directly into Top-Left Hero Card!) */}
          <div
            className="surv-hud-row is-wide is-no-top-xp"
            style={{
              opacity: prefs.hudOpacity / 100,
              transform: prefs.hudScale !== 100 ? `scale(${prefs.hudScale / 100})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            {/* Top-Left: Protagonist Avatar Card + Trainer Title/Badges + HP & EXP Bars */}
            <div className="hud-col-left">
              {(() => {
                const activeTag = getActiveTrainerTagDef(meta);
                const earnedSet = new Set(meta.unlockedBadges ?? []);
                const trainerPalette: Record<string, string> = {
                  K: '#12101a',
                  C: activeTag.color,
                  H: '#ffffff',
                  Y: '#ffe066',
                  W: '#fffdf5',
                };
                return (
                  <div
                    className="surv-hero-card is-clickable"
                    role="button"
                    tabIndex={0}
                    title={`点击查看「${activeHeroDef.name}」角色详情与专属觉醒技`}
                    onClick={() => openHeroOrBadgeOverlay?.('heroes')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openHeroOrBadgeOverlay?.('heroes');
                      }
                    }}
                  >
                    <div className="surv-hero-avatar">
                      <img
                        src={activeHeroDef.avatarSprite}
                        alt={activeHeroDef.name}
                        draggable={false}
                      />
                      <em>LV.{hud.runLevel}</em>
                    </div>
                    <div className="surv-hero-info">
                      <div className="surv-hero-top">
                        <strong>{activeHeroDef.name}</strong>
                        {isSurfing ? (
                          <span className="surv-surf-pill">🌊 水系冲浪</span>
                        ) : hud.boostLeft > 0 ? (
                          <span className="surv-boost-pill">强化 {Math.ceil(hud.boostLeft)}s</span>
                        ) : (
                          <span className="surv-hero-hp-num">{hud.hp}/{hud.maxHp}</span>
                        )}
                      </div>
                      <div className="surv-hero-hp-track">
                        <div
                          className="surv-hero-hp-fill"
                          style={{
                            width: `${hpPct}%`,
                            backgroundColor: hpPct > 35 ? '#48d167' : '#ff4d4d',
                          }}
                        />
                      </div>
                      <div className="surv-hero-xp-track" title={`经验 ${hud.xp}/${hud.xpNeed}`}>
                        <div className="surv-hero-xp-fill" style={{ width: `${xpPct}%` }} />
                      </div>
                      <div
                        className="surv-hero-sub-badges"
                        role="button"
                        tabIndex={0}
                        title="点击查看训练师等级与道馆徽章成就"
                        onClick={(e) => {
                          e.stopPropagation();
                          openHeroOrBadgeOverlay?.('badges');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            openHeroOrBadgeOverlay?.('badges');
                          }
                        }}
                      >
                        <span
                          className="hero-badge-slot is-trainer-emblem is-earned"
                          style={{ borderColor: activeTag.color }}
                          title={`训练师头衔：${activeTag.name}\n加成：${activeTag.perkText}\n点击查看头衔与徽章成就`}
                        >
                          <PixelGrid
                            grid={TRAINER_EMBLEM_GRID}
                            palette={trainerPalette}
                            size={15}
                          />
                        </span>
                        <span className="hero-badge-divider" aria-hidden="true" />
                        {getShowcaseBadgeIds(meta).map((bid) => {
                          const badge = GYM_BADGE_CATALOG.find((x) => x.id === bid);
                          if (!badge) return null;
                          const isEarned = earnedSet.has(badge.id);
                          const art = GYM_BADGE_PIXEL_ART[badge.id];
                          return (
                            <span
                              key={badge.id}
                              className={`hero-badge-slot ${isEarned ? 'is-earned' : 'is-unearned is-target-badge'}`}
                              style={isEarned ? { borderColor: badge.color } : undefined}
                              title={
                                isEarned
                                  ? `展示徽章：${badge.name}（${badge.gymName} · ${badge.leaderName}）\n加成：${badge.perkText}\n点击管理展示与目标徽章`
                                  : `目标徽章：${badge.name}（${badge.gymName}）\n获取条件：${badge.unlockHint}\n点击管理展示与目标徽章`
                              }
                            >
                              {art ? (
                                <PixelGrid
                                  grid={art.grid}
                                  palette={isEarned ? art.palette : LOCKED_BADGE_PALETTE}
                                  size={15}
                                />
                              ) : (
                                <PixelItemImg
                                  src={badge.icon}
                                  size={14}
                                  className={isEarned ? '' : 'hero-badge-item-locked'}
                                />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Party Dock directly beneath Hero Card: Default = Compact Poké Ball Avatar Row; Expanded = Full Party Cards */}
              {!resultModal && followersView.length > 0 && (
                <div className={`surv-party-dock ${mobilePartyOpen ? 'is-expanded' : 'is-compact'}`}>
                  {!mobilePartyOpen ? (
                    <div className="surv-party-compact-row">
                      {followersView.map((f, fIdx) => {
                        const vitals = hud.followerVitals[f.id] ?? {
                          hp: Math.round((95 + f.level * 28) * (hpPct / 100)),
                          maxHp: 95 + f.level * 28,
                          mp: 100,
                          maxMp: 100,
                        };
                        const fHpPct = Math.max(
                          0,
                          Math.min(100, Math.round((vitals.hp / Math.max(1, vitals.maxHp)) * 100)),
                        );
                        const fMpPct = Math.max(
                          0,
                          Math.min(100, Math.round((vitals.mp / Math.max(1, vitals.maxMp)) * 100)),
                        );
                        return (
                          <button
                            key={f.id}
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              dragFollowerIdxRef.current = fIdx;
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragOverFollowerIdx !== fIdx) setDragOverFollowerIdx(fIdx);
                            }}
                            onDragLeave={() => {
                              if (dragOverFollowerIdx === fIdx) setDragOverFollowerIdx(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const from = dragFollowerIdxRef.current;
                              dragFollowerIdxRef.current = null;
                              setDragOverFollowerIdx(null);
                              if (from !== null && from !== fIdx) {
                                reorderBattleFollowers(from, fIdx);
                              }
                            }}
                            onDragEnd={() => {
                              dragFollowerIdxRef.current = null;
                              setDragOverFollowerIdx(null);
                            }}
                            className={`party-ball-slot ${dragOverFollowerIdx === fIdx ? 'is-drag-over' : ''}`}
                            title={`${f.name} Lv.${f.level} · HP ${vitals.hp}/${vitals.maxHp}（点击查看详情与技能）`}
                            onClick={() => {
                              if (f.sourcePetId) {
                                onOpenPokemonManager('party_detail', true, f.sourcePetId);
                              } else {
                                onOpenPokemonManager('tactics', true);
                              }
                            }}
                          >
                            <span className="party-ball-avatar-wrap">
                              <span className="party-ball-well">
                                <TrimmedSpriteImg
                                  src={f.staticSprite ?? f.sprite}
                                  alt={f.name}
                                  size={32}
                                  fillRatio={0.88}
                                />
                              </span>
                              <PixelGrid
                                grid={POKEBALL_RING_GRID}
                                palette={POKEBALL_RING_PALETTE}
                                size={46}
                                className="party-ball-ring-svg"
                              />
                            </span>
                            <span className="party-ball-bars">
                              <span className="party-ball-bar-track is-hp">
                                <span
                                  className="party-ball-bar-fill"
                                  style={{
                                    width: `${fHpPct}%`,
                                    backgroundColor:
                                      fHpPct > 40 ? '#48d167' : fHpPct > 20 ? '#fcc419' : '#ff5c5c',
                                  }}
                                />
                              </span>
                              <span className="party-ball-bar-track is-mp">
                                <span
                                  className={`party-ball-bar-fill is-mp ${fMpPct >= 96 ? 'is-ready' : ''}`}
                                  style={{ width: `${fMpPct}%` }}
                                />
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="party-compact-expand-btn"
                        aria-label="向下展开队伍详情列表"
                        title="展开完整队伍列表"
                        onClick={() => {
                          sound.play('confirm');
                          setMobilePartyOpen(true);
                        }}
                      >
                        <span>▼</span>
                      </button>
                    </div>
                  ) : (
                    <div className="surv-party-expanded-panel">
                      <button
                        type="button"
                        className="party-collapse-top-btn"
                        aria-label="收起队伍列表"
                        title="收起为精灵球精简视图"
                        onClick={() => {
                          sound.play('cancel');
                          setMobilePartyOpen(false);
                        }}
                      >
                        <span>▲</span>
                        <strong>收起队伍</strong>
                      </button>
                      <div className="surv-party-cards-wrap">
                        {followersView.map((f, fIdx) => {
                          const vitals = hud.followerVitals[f.id] ?? {
                            hp: Math.round((95 + f.level * 28) * (hpPct / 100)),
                            maxHp: 95 + f.level * 28,
                            mp: 100,
                            maxMp: 100,
                          };
                          const fHpPct = Math.max(
                            0,
                            Math.min(100, Math.round((vitals.hp / Math.max(1, vitals.maxHp)) * 100)),
                          );
                          const fMpPct = Math.max(
                            0,
                            Math.min(100, Math.round((vitals.mp / Math.max(1, vitals.maxMp)) * 100)),
                          );
                          const uniqueSkills = Array.from(new Set(f.skills)).slice(0, 4);
                          const accentCol = SURVIVOR_SKILLS[f.skills[0]]?.color ?? '#ffe066';
                          return (
                            <div
                              key={f.id}
                              draggable
                              onDragStart={(e) => {
                                dragFollowerIdxRef.current = fIdx;
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverFollowerIdx !== fIdx) setDragOverFollowerIdx(fIdx);
                              }}
                              onDragLeave={() => {
                                if (dragOverFollowerIdx === fIdx) setDragOverFollowerIdx(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const from = dragFollowerIdxRef.current;
                                dragFollowerIdxRef.current = null;
                                setDragOverFollowerIdx(null);
                                if (from !== null && from !== fIdx) {
                                  reorderBattleFollowers(from, fIdx);
                                }
                              }}
                              onDragEnd={() => {
                                dragFollowerIdxRef.current = null;
                                setDragOverFollowerIdx(null);
                              }}
                              className={`surv-party-card ${dragOverFollowerIdx === fIdx ? 'is-drag-over' : ''}`}
                              style={{ '--unit-accent': accentCol } as React.CSSProperties}
                              title={`${f.name} Lv.${f.level} · HP ${vitals.hp}/${vitals.maxHp} · 右侧可调序或移出队伍`}
                              onClick={() => {
                                if (f.sourcePetId) {
                                  onOpenPokemonManager('party_detail', true, f.sourcePetId);
                                } else {
                                  onOpenPokemonManager('tactics', true);
                                }
                              }}
                            >
                              <div className="party-portrait">
                                <TrimmedSpriteImg
                                  src={f.sprite}
                                  alt={f.name}
                                  size={38}
                                  fillRatio={0.86}
                                />
                                <em className="party-lv-tag">Lv.{f.level}</em>
                              </div>
                              <div className="party-info">
                                <div className="party-head-line">
                                  <strong>{f.name}</strong>
                                  <div className="party-skill-icons">
                                    {uniqueSkills.map((sid) => {
                                      const sk = SURVIVOR_SKILLS[sid];
                                      return (
                                        <span key={sid} className="party-sk-dot" title={sk.name}>
                                          <PixelItemImg src={sk.sprite} size={12} />
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="party-bar-track is-hp">
                                  <div
                                    className="party-bar-fill is-hp"
                                    style={{
                                      width: `${fHpPct}%`,
                                      backgroundColor:
                                        fHpPct > 40 ? '#48d167' : fHpPct > 20 ? '#fcc419' : '#ff5c5c',
                                    }}
                                  />
                                </div>
                                <div className="party-bar-track is-mp">
                                  <div
                                    className={`party-bar-fill is-mp ${fMpPct >= 96 ? 'is-ready' : ''}`}
                                    style={{ width: `${fMpPct}%` }}
                                  />
                                </div>
                              </div>
                              {followersView.length > 1 && (
                                <div className="party-side-actions" onClick={(e) => e.stopPropagation()}>
                                  <div className="party-reorder-col">
                                    <button
                                      type="button"
                                      className="party-reorder-btn"
                                      disabled={fIdx === 0}
                                      aria-label="上移出战顺序"
                                      title="上移顺序"
                                      onClick={() => reorderBattleFollowers(fIdx, fIdx - 1)}
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      className="party-reorder-btn"
                                      disabled={fIdx === followersView.length - 1}
                                      aria-label="下移出战顺序"
                                      title="下移顺序"
                                      onClick={() => reorderBattleFollowers(fIdx, fIdx + 1)}
                                    >
                                      ▼
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    className="party-remove-btn"
                                    aria-label={`将 ${f.name} 移出队伍`}
                                    title={`将「${f.name}」移出当前队伍`}
                                    onClick={() => removeBattleFollower(f.id)}
                                  >
                                    <span>移出</span>
                                    <span>队伍</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Top-Center: Left = Location & Pixel Weather (Map); Center = Now Playing BGM; Right = Time & Day/Night Almanac */}
            <div className="hud-col-center">
              <div className="surv-top-status-deck">
                <div className="surv-top-status-main">
                  <div
                    className="top-deck-wing is-left"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      sound.play('confirm');
                      if (adventureStyle === 'vampire_rogue') toggleWorldMap();
                      else setWorldMapOpen(true);
                    }}
                    title={`当前位置：${locationLabel}（点击打开世界地图）`}
                  >
                    <strong>{locationLabel}</strong>
                    <div className="top-deck-sub">
                      <span
                        className="top-weather-chip"
                        style={{ backgroundColor: weatherChipBg }}
                        title={`${liveWeather.label} ${liveWeather.tempC}°C · ${liveWeather.buffText}\n点击打开地图`}
                      >
                        <PixelIcon name={weatherPixelIcon} size={12} />
                        <span>{liveWeather.label} {liveWeather.tempC}°C</span>
                      </span>
                      <span className={`top-diff-tag is-${difficultyId}`}>{diffMeta.label}</span>
                    </div>
                  </div>
                  {(() => {
                    const playerState: BgmPlayerState = bgmState ?? sound.getBgmState();
                    const isConfigMuted = !isBgmOn;
                    const isPlayingNow = isBgmOn && !playerState.paused;
                    const modeNow: BgmPlayMode = playerState.playMode;
                    const modeShortLabel =
                      modeNow === 'single_loop' ? '单曲' : modeNow === 'shuffle' ? '随机' : '循环';
                    const modeTitle = `播放模式：${BGM_PLAY_MODE_LABELS[modeNow]}（点击切换：列表循环 / 单曲循环 / 随机播放）`;
                    return (
                      <div
                        className={`top-deck-center is-bgm-deck ${isPlayingNow ? 'is-playing' : 'is-muted'}`}
                        style={{ borderRight: '2px solid #2b2d44' }}
                      >
                        <div
                          className="top-bgm-title-row"
                          onClick={(e) => {
                            e.stopPropagation();
                            (handleBgmPlayPause ?? onToggleBgm)?.();
                          }}
                          title={
                            isPlayingNow
                              ? `正在播放：${bgmTrackLabel}（${playerState.songIndex + 1}/${playerState.playlistLength}）· 点击暂停`
                              : isConfigMuted
                                ? '背景音乐已静音（点击开启音乐）'
                                : `已暂停：${bgmTrackLabel}（点击继续播放）`
                          }
                        >
                          {isPlayingNow ? (
                            <span className="top-bgm-eq" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : (
                            <PixelIcon name={isConfigMuted ? 'sound_off' : 'music_note'} size={11} />
                          )}
                          <strong className="top-bgm-title">
                            {isConfigMuted ? '点击开启音乐' : bgmTrackLabel}
                          </strong>
                          {playerState.playlistLength > 1 && (
                            <span className="top-bgm-idx">
                              {playerState.songIndex + 1}/{playerState.playlistLength}
                            </span>
                          )}
                        </div>

                        <div className="top-bgm-controls" role="group" aria-label="区域音乐播放控制">
                          <button
                            type="button"
                            className="top-bgm-btn"
                            aria-label="上一首"
                            title="上一首"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBgmPrev?.();
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
                              <rect x="1" y="2" width="1.5" height="6" fill="currentColor" />
                              <rect x="7" y="2" width="2" height="6" fill="currentColor" />
                              <rect x="5" y="3" width="2" height="4" fill="currentColor" />
                              <rect x="3" y="4" width="2" height="2" fill="currentColor" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className={`top-bgm-btn is-play-toggle ${isPlayingNow ? 'is-active' : ''}`}
                            aria-label={isPlayingNow ? '暂停音乐' : '播放音乐'}
                            title={isPlayingNow ? '暂停音乐' : '播放音乐'}
                            onClick={(e) => {
                              e.stopPropagation();
                              (handleBgmPlayPause ?? onToggleBgm)?.();
                            }}
                          >
                            {isPlayingNow ? (
                              <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
                                <rect x="2" y="2" width="2" height="6" fill="currentColor" />
                                <rect x="6" y="2" width="2" height="6" fill="currentColor" />
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
                                <rect x="2" y="1" width="2" height="8" fill="currentColor" />
                                <rect x="4" y="2" width="2" height="6" fill="currentColor" />
                                <rect x="6" y="3" width="2" height="4" fill="currentColor" />
                                <rect x="8" y="4" width="1" height="2" fill="currentColor" />
                              </svg>
                            )}
                          </button>

                          <button
                            type="button"
                            className="top-bgm-btn"
                            aria-label="下一首"
                            title="下一首"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBgmNext?.();
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
                              <rect x="1" y="2" width="2" height="6" fill="currentColor" />
                              <rect x="3" y="3" width="2" height="4" fill="currentColor" />
                              <rect x="5" y="4" width="2" height="2" fill="currentColor" />
                              <rect x="7.5" y="2" width="1.5" height="6" fill="currentColor" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className={`top-bgm-btn is-mode-btn is-mode-${modeNow}`}
                            aria-label={BGM_PLAY_MODE_LABELS[modeNow]}
                            title={modeTitle}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBgmCycleMode?.();
                            }}
                          >
                            {modeNow === 'shuffle' ? (
                              <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
                                <rect x="1" y="2" width="2" height="1" fill="currentColor" />
                                <rect x="3" y="3" width="1" height="1" fill="currentColor" />
                                <rect x="4" y="4" width="2" height="2" fill="currentColor" />
                                <rect x="6" y="6" width="1" height="1" fill="currentColor" />
                                <rect x="7" y="7" width="2" height="1" fill="currentColor" />
                                <rect x="1" y="7" width="2" height="1" fill="currentColor" />
                                <rect x="3" y="6" width="1" height="1" fill="currentColor" />
                                <rect x="6" y="3" width="1" height="1" fill="currentColor" />
                                <rect x="7" y="2" width="2" height="1" fill="currentColor" />
                                <rect x="8" y="1" width="1" height="3" fill="currentColor" />
                                <rect x="8" y="6" width="1" height="3" fill="currentColor" />
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
                                <rect x="2" y="2" width="6" height="1" fill="currentColor" />
                                <rect x="7" y="1" width="1" height="3" fill="currentColor" />
                                <rect x="1" y="3" width="1" height="3" fill="currentColor" />
                                <rect x="2" y="7" width="6" height="1" fill="currentColor" />
                                <rect x="2" y="6" width="1" height="3" fill="currentColor" />
                                <rect x="8" y="4" width="1" height="3" fill="currentColor" />
                                {modeNow === 'single_loop' && (
                                  <rect x="4.5" y="4" width="1" height="2" fill="currentColor" />
                                )}
                              </svg>
                            )}
                            <span>{modeShortLabel}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  <div
                    className="top-deck-wing is-right"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      sound.play('confirm');
                      setTimeAlmanacOpen(true);
                    }}
                    title="点击查看昼夜星象与各时段出没宝可梦生态图鉴"
                  >
                    <div className="top-time-phase-row">
                      <strong className="top-live-clock">
                        {adventureStyle === 'vampire_rogue' ? minStr : solarInfo.localTimeStr}
                      </strong>
                      <span
                        className="top-trainer-tag is-phase-pill"
                        style={{ borderColor: '#ffe066', color: '#ffe066' }}
                      >
                        <PixelIcon name={phasePixelIcon} size={11} />
                        <span>{solarInfo.phaseLabel}</span>
                      </span>
                    </div>
                    <div className="top-badge-mini">
                      <PixelIcon name="sunrise" size={11} />
                      <span>{solarInfo.sunriseStr}</span>
                      <span style={{ opacity: 0.55 }}>·</span>
                      <PixelIcon name="sunset" size={11} />
                      <span>{solarInfo.sunsetStr}</span>
                    </div>
                  </div>
                </div>
                {autoNavActiveLabel && (
                  <div className="surv-top-nav-strip">
                    <div
                      className="surv-top-nav-target"
                      onClick={() => {
                        sound.play('confirm');
                        toggleWorldMap();
                      }}
                      title={`正在前往：${autoNavActiveLabel}（点击打开地图）`}
                    >
                      <span className="surv-top-nav-compass">🧭</span>
                      <span className="surv-top-nav-name">前往「{autoNavActiveLabel}」</span>
                    </div>
                    <div className="surv-top-nav-right">
                      {autoNavDistM !== null && autoNavDistM !== undefined && (
                        <strong className="surv-top-nav-dist" title="距离目标剩余实时距离">
                          距离 {formatHudDistance(autoNavDistM)}
                        </strong>
                      )}
                      {autoNavEtaSec !== null && autoNavEtaSec !== undefined && (
                        <span
                          className="surv-top-nav-eta"
                          title="按当前移动/骑乘档位速度实时估算的抵达耗时（按 T 切换骑乘/飞行会立即缩短）"
                        >
                          ⏱ {formatHudEta(autoNavEtaSec)}
                        </span>
                      )}
                      <button
                        type="button"
                        className="surv-top-nav-cancel"
                        onClick={() => stopAutoNavRef.current(false)}
                        title="停止自动寻路"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
                {hud.anomalyHazard && (
                  <div
                    role="status"
                    style={{
                      marginTop: 6,
                      padding: '4px 10px',
                      background: 'rgba(130, 18, 28, 0.92)',
                      border: `2px solid ${hud.anomalyHazard.accentColor || '#ff6b6b'}`,
                      color: '#fff5f5',
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 2px 0 #161420',
                    }}
                  >
                    <span>⚠️ 未开放禁区 · {hud.anomalyHazard.zoneName}</span>
                    <span style={{ color: '#ffe066' }}>
                      {hud.anomalyHazard.shortTag} {hud.anomalyHazard.causeLabel} (-5% HP/秒)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Top-Right: Large Bare Pixel-Art Icon Action Buttons (No Box Background!) */}
            <div className="hud-col-right">
              <div className="surv-right-stats">
                <button
                  type="button"
                  className="surv-top-btn is-lg is-tactics"
                  onClick={() => onOpenPokemonManager('tactics', true)}
                  aria-label="战术终端"
                  title="战术终端（调整阵型、目标策略与随从技能）"
                >
                  <PixelIcon name="tactics_command" size={64} className="top-hud-bare-svg" />
                </button>
                <button
                  type="button"
                  className="surv-top-btn is-lg is-care-btn"
                  onClick={() => onOpenPokemonManager('home', true)}
                  aria-label="掌机球舱"
                  title="掌机球舱与球盒管理"
                >
                  <TrimmedSpriteImg
                    src={activeRoom.ballSprite}
                    alt="掌机球舱"
                    size={70}
                    fillRatio={0.9}
                    className="top-hud-bare-icon"
                  />
                </button>
                <button
                  type="button"
                  className="surv-top-btn is-lg is-gear-btn"
                  onClick={() => onOpenPokemonManager('menu', true)}
                  aria-label="训练家菜单与设置"
                  title="训练家菜单与系统设置（镜头视角可在设置中切换）"
                >
                  <TrimmedSpriteImg
                    src="/sprites/items/poke-radar.png"
                    alt="训练家菜单与设置"
                    size={70}
                    fillRatio={0.9}
                    className="top-hud-bare-icon"
                  />
                </button>
              </div>

              {!resultModal && (
                <WorldMapHud
                  biome={selectedBiome}
                  regionName={regionMeta.name}
                  snapshot={mapSnapshot}
                  onToggleExpand={toggleWorldMap}
                />
              )}
            </div>
          </div>

          {/* Boss HP Bar (Respects Boss Bar Opacity + Remaining HP vs Percentage Preference!) */}
          {hud.bossAliveName && (
            <div
              className="surv-boss-bar is-wide"
              style={{ opacity: prefs.bossBarOpacity / 100 }}
            >
              <div className="surv-boss-bar-head">
                <span>{hud.bossAliveName}</span>
                <em>
                  {prefs.bossHpMode === 'hp'
                    ? `${hud.bossHp.toLocaleString()} / ${hud.bossMaxHp.toLocaleString()}`
                    : `${hud.bossHpPct}%`}
                </em>
              </div>
              <div className="boss-hp-track">
                <div className="boss-hp-fill" style={{ width: `${hud.bossHpPct}%` }} />
              </div>
            </div>
          )}

          {/* In-Run Town Poké Mart Full-Screen Dedicated Supplies Shop Overlay */}
          {inRunTownShopOpen && (
            <ShopOverlay
              save={save}
              pet={pet}
              closing={false}
              initialTab="berries"
              cityName={liveOverlandCity?.name}
              onClose={() => {
                sound.play('cancel');
                setInRunTownShopOpen(false);
                tryRestorePointerLock();
              }}
              onBuyFood={(fid) => onBuyFood?.(fid)}
              onBuyAccessory={(aid) => onBuyAccessory?.(aid)}
              onBuyPokeball={(rid) => onBuyPokeball?.(rid)}
              onPullGacha={(bid) =>
                onPullGacha?.(bid) ?? { ok: false, save, message: '暂不可用' }
              }
              onPullGachaTen={(bid) =>
                onPullGachaTen?.(bid) ?? { ok: false, save, results: [], message: '暂不可用' }
              }
              onUpdatePetConfig={onUpdatePetConfig}
            />
          )}

          {/* Optional Live FPS Counter & Kill Combo Streak Badges */}
          {prefs.showFps && (
            <div className="surv-fps-badge">{hud.fps} FPS</div>
          )}
          {prefs.showComboCounter && hud.combo >= 1 && (
            <div className="surv-combo-badge">
              <em>连续击败数</em>
              <strong>×{hud.combo}</strong>
            </div>
          )}

          {/* Interactive World & NPC Prompts now render directly beside the target in 3D space via ArenaTownSocialAndBusOverlay! */}

          {/* Mobile-Only Floating Dynamic Left-Area 360° Joystick (Hidden when idle & hidden on Desktop!) */}
          {!externalPaused && !levelChoices && !shopOpen && !resultModal && !captureOffer && (
            <div
              className="vpad-touch-zone"
              aria-label="左侧触控移动区域"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (vPadPointerRef.current !== null) return;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                vPadPointerRef.current = e.pointerId;
                startVirtualPad(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
              }}
              onPointerMove={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  e.stopPropagation();
                  updateVirtualPad(e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  e.stopPropagation();
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {}
                  resetVirtualPad();
                }
              }}
              onPointerCancel={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  resetVirtualPad();
                }
              }}
              onLostPointerCapture={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  resetVirtualPad();
                }
              }}
            >
              {vPad.active && (
                <div
                  className="vpad-360 is-active is-floating"
                  style={{
                    left: `${vPad.originX}px`,
                    top: `${vPad.originY}px`,
                  }}
                >
                  <span className="omni-cross-v" aria-hidden="true" />
                  <span className="omni-cross-h" aria-hidden="true" />
                  <span className="omni-diag omni-ul" aria-hidden="true" />
                  <span className="omni-diag omni-ur" aria-hidden="true" />
                  <span className="omni-diag omni-dl" aria-hidden="true" />
                  <span className="omni-diag omni-dr" aria-hidden="true" />
                  <div
                    className="omni-puck"
                    style={{ transform: `translate(${vPad.x}px, ${vPad.y}px)` }}
                  >
                    <span className="omni-puck-dimple" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proximity Knocked-Out Monster Capture Bar (Walk near downed Boss / Rare / Shiny on the grass!) */}
          {nearbyKoTarget && !externalPaused && !levelChoices && !shopOpen && !resultModal && (
            <div className="surv-ko-prompt">
              <div className="ko-prompt-left">
                <div className="ko-prompt-thumb">
                  <TrimmedSpriteImg src={nearbyKoTarget.sprite} alt={nearbyKoTarget.name} size={46} fillRatio={0.86} />
                </div>
                <div className="ko-prompt-meta">
                  <div className="ko-prompt-title">
                    {nearbyKoTarget.isShiny && <span className="ko-badge is-shiny">★异色</span>}
                    {MONSTER_QUALITY_META[nearbyKoTarget.quality].label && (
                      <span
                        className="ko-badge"
                        style={{ backgroundColor: MONSTER_QUALITY_META[nearbyKoTarget.quality].color }}
                      >
                        {MONSTER_QUALITY_META[nearbyKoTarget.quality].label}
                      </span>
                    )}
                    <strong>{nearbyKoTarget.name}</strong>
                    <em>Lv.{nearbyKoTarget.level}</em>
                  </div>
                  <small>
                    倒地昏迷 · 身高 {nearbyKoTarget.heightM}m · 体重 {nearbyKoTarget.weightKg}kg
                  </small>
                </div>
              </div>
              <div className="ko-prompt-actions">
                <button
                  type="button"
                  className="ko-btn is-catch"
                  {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('capture_ko', nearbyKoTarget.enemyId))}
                >
                  <PixelItemImg src={activeBallMeta.ballSprite} size={18} />
                  <span>{activeBallMeta.shortName}收服</span>
                  <span className="surv-interact-key">E</span>
                </button>
                <button
                  type="button"
                  className="ko-btn is-pass"
                  {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('dismiss_ko', nearbyKoTarget.enemyId))}
                >
                  <PixelIcon name="paw" size={12} />
                  <span>放走</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom-Right MOBA-Style Radial Action Wheel (1.4x Large Tight-Fill Pixel Buttons!) */}
          {!externalPaused && !levelChoices && !shopOpen && !resultModal && !captureOffer && (
            <div className="surv-moba-wheel">
              {/* Outer Left Satellite (82x82): Throw Poké Ball + Long-Press Left Ball Switcher */}
              <div ref={ballAnchorRef} className="moba-ball-anchor">
                {ballPickerOpen && (
                  <div
                    className="moba-ball-picker is-icon-only"
                    role="listbox"
                    aria-label="切换持有的精灵球"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {ownedBalls.map((rm) => {
                      const stat = POKEBALL_CATCH_STATS[rm.id] ?? POKEBALL_CATCH_STATS.pokeball_room;
                      const avail = getBallAvailability(save, rm.id);
                      const isCur = rm.id === activeBallMeta.id;
                      const qtyText = rm.id === 'pokeball_room' ? '∞' : `×${avail.total}`;
                      return (
                        <button
                          key={rm.id}
                          type="button"
                          role="option"
                          aria-selected={isCur}
                          aria-label={`${rm.shortName}（${stat.desc}，${qtyText}）`}
                          data-ball-id={rm.id}
                          className={`moba-ball-opt is-icon-only ${isCur ? 'is-active' : ''} ${stat.guaranteed ? 'is-master' : ''}`}
                          style={{ '--ball-accent': stat.accent } as React.CSSProperties}
                          onClick={(e) => {
                            e.stopPropagation();
                            choosePokeball(rm.id);
                          }}
                          title={`${rm.shortName} · ${stat.desc} · ${qtyText}`}
                        >
                          <TrimmedSpriteImg src={rm.ballSprite} alt={rm.shortName} size={38} fillRatio={0.9} />
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className={`moba-btn is-pixel-circle is-aux-jump is-ball ${hud.actionCds.ball > 0 ? 'is-cd' : ''} ${nearbyKoTarget ? 'is-pulse' : ''} ${ballPickerOpen ? 'is-picker-open' : ''}`}
                  style={{ '--ball-accent': activeBallStat.accent } as React.CSSProperties}
                  onPointerDown={handleBallBtnPointerDown}
                  onPointerUp={handleBallBtnPointerUp}
                  onPointerCancel={handleBallBtnPointerCancel}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    sound.play('cursor');
                    setBallPickerOpen((v) => !v);
                  }}
                  aria-label="投球"
                  title={`${activeBallMeta.shortName}（${activeBallStat.desc}）· 点按投球，长按可切换持有的精灵球`}
                >
                  <PixelGrid
                    grid={MOBA_CIRCLE_GRID}
                    palette={MOBA_CIRCLE_PALETTES.ball}
                    size={82}
                    className="moba-circle-bg"
                  />
                  <TrimmedSpriteImg
                    src={activeBallMeta.ballSprite}
                    alt={activeBallMeta.shortName}
                    size={54}
                    fillRatio={0.9}
                    className="moba-icon-fill"
                  />
                  {ownedBalls.length > 1 && (
                    <span className="moba-ball-switch-hint" aria-hidden="true">◀</span>
                  )}
                  {hud.actionCds.ball > 0 ? (
                    <em className="moba-badge">{Math.ceil(hud.actionCds.ball)}s</em>
                  ) : (
                    activeBallMeta.id !== 'pokeball_room' && (
                      <em className="moba-badge is-ball-tag">{activeBallStat.tag}</em>
                    )
                  )}
                </button>
              </div>

              {/* Arc Satellite 1 (0° Inner-Left): Full-MP Team Salvo */}
              <button
                type="button"
                className={`moba-btn is-pixel-circle is-sat is-sat-0 is-salvo ${hud.actionCds.salvo > 0 ? 'is-cd' : ''}`}
                disabled={hud.actionCds.salvo > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('salvo'), hud.actionCds.salvo > 0)}
                aria-label="齐射"
                title="齐射：全队瞬间满蓝，同步释放招牌绝招！"
              >
                <PixelGrid
                  grid={MOBA_CIRCLE_GRID}
                  palette={MOBA_CIRCLE_PALETTES.salvo}
                  size={82}
                  className="moba-circle-bg"
                />
                <PixelIcon name="salvo_barrage" size={50} className="moba-icon-fill" />
                {hud.actionCds.salvo > 0 && (
                  <em className="moba-badge">{Math.ceil(hud.actionCds.salvo)}s</em>
                )}
              </button>

              {/* Arc Satellite 2 (45° Upper-Left): Heal Potion */}
              <button
                type="button"
                className={`moba-btn is-pixel-circle is-sat is-sat-45 is-heal ${hud.actionCds.heal > 0 || hud.healCharges <= 0 ? 'is-cd' : ''}`}
                disabled={hud.actionCds.heal > 0 || hud.healCharges <= 0}
                {...bindMultiTouchAction(
                  () => triggerBattleActionRef.current?.('heal'),
                  hud.actionCds.heal > 0 || hud.healCharges <= 0,
                )}
                aria-label="伤药"
                title="伤药：使用好伤药立即回复全队 45% 生命值"
              >
                <PixelGrid
                  grid={MOBA_CIRCLE_GRID}
                  palette={MOBA_CIRCLE_PALETTES.heal}
                  size={82}
                  className="moba-circle-bg"
                />
                <TrimmedSpriteImg
                  src="/sprites/items/super-potion.png"
                  alt="伤药"
                  size={54}
                  fillRatio={0.9}
                  className="moba-icon-fill"
                />
                <em className="moba-badge">
                  {hud.actionCds.heal > 0 ? `${Math.ceil(hud.actionCds.heal)}s` : `×${hud.healCharges}`}
                </em>
              </button>

              {/* Arc Satellite 3 (90° Top): Team Overdrive Boost */}
              <button
                type="button"
                className={`moba-btn is-pixel-circle is-sat is-sat-90 is-boost ${hud.actionCds.boost > 0 ? 'is-cd' : ''} ${hud.boostLeft > 0 ? 'is-active' : ''}`}
                disabled={hud.actionCds.boost > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('boost'), hud.actionCds.boost > 0)}
                aria-label="强化"
                title="强化：激活 8 秒力量强化（全队攻击 +55%、充能加速）"
              >
                <PixelGrid
                  grid={MOBA_CIRCLE_GRID}
                  palette={MOBA_CIRCLE_PALETTES.boost}
                  size={82}
                  className="moba-circle-bg"
                />
                <TrimmedSpriteImg
                  src="/sprites/items/rare-candy.png"
                  alt="强化"
                  size={54}
                  fillRatio={0.9}
                  className="moba-icon-fill"
                />
                {(hud.boostLeft > 0 || hud.actionCds.boost > 0) && (
                  <em className="moba-badge">
                    {hud.boostLeft > 0 ? `${Math.ceil(hud.boostLeft)}s` : `${Math.ceil(hud.actionCds.boost)}s`}
                  </em>
                )}
              </button>

              {/* Primary Corner Main Button (112x112): 3D Jump */}
              <button
                type="button"
                className="moba-btn is-pixel-circle is-primary is-jump-main"
                {...bindMultiTouchAction(() => {
                  jumpQueuedRef.current = true;
                })}
                aria-label="跳跃"
                title="跳跃：3D 跳跃翻越台阶或躲避弹幕"
              >
                <PixelGrid
                  grid={MOBA_CIRCLE_GRID}
                  palette={MOBA_CIRCLE_PALETTES.jump}
                  size={112}
                  className="moba-circle-bg"
                />
                <PixelIcon name="jump_leap" size={72} className="moba-icon-fill" />
              </button>
            </div>
          )}

          {/* Cinematic Close-Up Poké Ball Capture Cutscene Overlay (Throw -> Crimson Absorb -> 3 Wobbles -> Starburst!) */}
          {/* Pure 3D Close-Up Capture Cinema Bars (Zero popup box! After 3D ball catches, opens our REAL MAIN HandheldConsole!) */}
          {captureCutscene && !resultModal && (
            <div className={`surv-capture-cutscene is-phase-${captureCutscene.phase}`}>
              <div className="cap-letterbox is-top" />
              <div className="cap-cinema-subtitle">
                {captureCutscene.phase === 'throw' && `去吧！${captureCutscene.ballName ?? '精灵球'}！瞄准 ${captureCutscene.name}！`}
                {captureCutscene.phase === 'absorb' && `命中！正在将 ${captureCutscene.name} 收入球中...`}
                {captureCutscene.phase === 'wobble' &&
                  `摇晃中 ${'● '.repeat(Math.max(1, captureCutscene.wobbleCount))}${'○ '.repeat(Math.max(0, 3 - captureCutscene.wobbleCount))}`}
                {captureCutscene.phase === 'caught' && `★ 叮咚！成功收服了 ${captureCutscene.name}！正在同步图鉴...`}
                {captureCutscene.phase === 'escaped' && '糟糕！野生宝可梦挣脱了精灵球！'}
              </div>
              <div className="cap-letterbox is-bottom" />
            </div>
          )}

          {/* Event Toast Banner — Positioned cleanly at TOP below Status Deck (Zero bottom clutter!) */}
          {bannerMsg && !externalPaused && !levelChoices && !shopOpen && !resultModal && !captureOffer && (
            <div className={`surv-event-banner is-wide is-top-banner ${!prefs.largeBanners ? 'is-compact' : ''}`}>
              {bannerMsg}
            </div>
          )}

          {/* Street & Indoor NPC Social/Ask/Battle Modal + Intra-City & Overland Bus Stop Terminal */}
          <ArenaTownSocialAndBusOverlay ctx={ctx} />

    </>
  );
};
