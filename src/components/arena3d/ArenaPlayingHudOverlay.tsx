import { MONSTER_QUALITY_META } from './arenaTypesAndProps';
import type { ArenaSharedCtx } from './arenaTypesAndProps';
import React from 'react';
import { SURVIVOR_SKILLS, WORLD_TOWNS_3D } from '../../data/survivorsTactics';
import { GYM_BADGE_CATALOG, getActiveTrainerTagDef } from '../../data/metaProgression';
import { ShopOverlay } from '../ShopOverlay';
import { WorldMapHud } from '../WorldMapHud';
import { sound } from '../../utils/sound';
import { PixelIcon, PixelItemImg } from '../PixelSprite';
import { TrimmedSpriteImg } from '../TrimmedSpriteImg';
import { ArenaTownSocialAndBusOverlay } from './ArenaTownSocialAndBusOverlay';

function formatHudDistance(distM: number): string {
  if (!Number.isFinite(distM) || distM <= 0) return '0 m';
  if (distM < 1000) return `${Math.max(1, Math.round(distM))} m`;
  if (distM < 10000) return `${(distM / 1000).toFixed(2)} km`;
  if (distM < 100000) return `${(distM / 1000).toFixed(1)} km`;
  return `${Math.round(distM / 1000)} km`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const ArenaPlayingHudOverlay: React.FC<{ ctx: Record<string, any> }> = ({ ctx: rawCtx }) => {
  const ctx = rawCtx as ArenaSharedCtx;
  const { activeHeroDef, activeRoom, activeWorldRun, adventureStyle, autoNavActiveLabel, autoNavDistM, bannerMsg, bgmTrackLabel, bindMultiTouchAction, captureCutscene, captureOffer, cycleRideMode, diffMeta, difficultyId, dragFollowerIdxRef, dragOverFollowerIdx, edgeIndicators, externalPaused, floatingTags, followersView, hpPct, hud, inRunTownShopOpen, isSurfing, jumpQueuedRef, landRideMode, levelChoices, liveOverlandCity, liveWeather, mapSnapshot, meta, minStr, mobilePartyOpen, nearbyKoTarget, onBuyAccessory, onBuyFood, onBuyPokeball, onOpenPokemonManager, onPullGacha, onPullGachaTen, onToggleBgm, onUpdatePetConfig, pet, playerAltitudeM, prefs, regionMeta, reorderBattleFollowers, resetVirtualPad, resultModal, rideMode, save, selectedBiome, setDragOverFollowerIdx, setInRunTownShopOpen, setMobilePartyOpen, setTimeAlmanacOpen, setWorldMapOpen, shopOpen, solarInfo, startVirtualPad, stopAutoNavRef, toggleWorldMap, triggerBattleActionRef, tryRestorePointerLock, updateVirtualPad, vPad, vPadPointerRef, xpPct } = ctx;
  const isBgmOn = Boolean(save.bgmEnabled && !save.muted && save.bgmVolume > 0 && (prefs.masterVolume ?? 80) > 0);
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
                const badgeCount = (meta.unlockedBadges ?? []).length;
                return (
                  <div className="surv-hero-card">
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
                      <div className="surv-hero-sub-badges">
                        <span
                          className="top-trainer-tag"
                          style={{ borderColor: activeTag.color, color: activeTag.color }}
                        >
                          {activeTag.name}
                        </span>
                        <span
                          className="top-badge-mini"
                          title={`已收集 ${badgeCount}/${GYM_BADGE_CATALOG.length} 枚道馆徽章`}
                        >
                          <PixelItemImg src="/sprites/items/kings-rock.png" size={11} />
                          <span>徽章 {badgeCount}/{GYM_BADGE_CATALOG.length}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Top-Center: Left/Center = Open Map; Right = Dedicated Day/Night Time & Ecological Spawn Almanac + Integrated Live Auto-Navigation Distance Strip! */}
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
                    title="点击打开地图（关闭后直接返回当前游戏）"
                  >
                    <strong>{adventureStyle === 'vampire_rogue' ? '随机秘境' : '真实地球'}</strong>
                    <div className="top-deck-sub">
                      <span
                        className="top-weather-chip"
                        style={{ backgroundColor: liveWeather.accentColor }}
                        title={`${liveWeather.summary} · ${liveWeather.buffText}\n点击打开地图`}
                      >
                        {liveWeather.emoji} {liveWeather.label} {liveWeather.tempC}°C
                      </span>
                      <span className={`top-diff-tag is-${difficultyId}`}>{diffMeta.label}</span>
                    </div>
                  </div>
                  <div
                    className="top-deck-center"
                    style={{ borderRight: '2px solid #2b2d44', cursor: 'pointer' }}
                    onClick={() => {
                      sound.play('confirm');
                      toggleWorldMap();
                    }}
                    title="点击打开当前城市地图与自动寻路"
                  >
                    <PixelItemImg src="/sprites/items/poke-ball.png" size={15} />
                    <strong>{adventureStyle === 'vampire_rogue' ? minStr : solarInfo.localTimeStr}</strong>
                    <small>
                      {adventureStyle === 'vampire_rogue'
                        ? regionMeta.name
                        : liveOverlandCity?.name ??
                          activeWorldRun?.cityName ??
                          WORLD_TOWNS_3D.find(
                            (t) => Math.hypot(mapSnapshot.px - t.x, mapSnapshot.pz - t.z) < t.plazaRadius + 6,
                          )?.name ??
                          '野外探索'}
                    </small>
                  </div>
                  <div
                    className="top-deck-wing is-right"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      sound.play('confirm');
                      setTimeAlmanacOpen(true);
                    }}
                    title="点击查看昼夜星象与各时段出没宝可梦生态图鉴"
                  >
                    <span className="top-trainer-tag" style={{ borderColor: '#ffe066', color: '#ffe066' }}>
                      {solarInfo.phaseEmoji} {solarInfo.phaseLabel}
                    </span>
                    <div className="top-badge-mini">
                      <span>🌅{solarInfo.sunriseStr} · 🌇{solarInfo.sunsetStr}</span>
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
              </div>
            </div>

            {/* Top-Right: Large Icon-Only Action Buttons (Tactics, Handheld Care, Main Menu/Settings) */}
            <div className="hud-col-right">
              <div className="surv-right-stats">
                <button
                  type="button"
                  className="surv-top-btn is-lg is-tactics"
                  onClick={() => onOpenPokemonManager('tactics', true)}
                  aria-label="战术终端"
                  title="战术终端"
                >
                  <PixelItemImg src="/sprites/items/vs-seeker.png" size={24} />
                </button>
                <button
                  type="button"
                  className="surv-top-btn is-lg is-care-btn"
                  onClick={() => onOpenPokemonManager('home', true)}
                  aria-label="掌机球舱"
                  title="掌机球舱与球盒管理"
                >
                  <PixelItemImg src={activeRoom.ballSprite} size={24} />
                </button>
                <button
                  type="button"
                  className="surv-top-btn is-lg is-gear-btn"
                  onClick={() => onOpenPokemonManager('menu', true)}
                  aria-label="训练家菜单与设置"
                  title="训练家菜单与系统设置（镜头视角可在设置中切换）"
                >
                  <PixelItemImg src="/sprites/items/poke-radar.png" size={24} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onToggleBgm?.()}
                title={isBgmOn ? `正在播放：${bgmTrackLabel}（点击关闭背景音乐）` : '背景音乐已关闭（点击开启背景音乐）'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  background: isBgmOn ? 'rgba(20, 24, 38, 0.86)' : 'rgba(20, 24, 38, 0.65)',
                  border: `2px solid ${isBgmOn ? '#f6d265' : '#565c78'}`,
                  borderRadius: 4,
                  color: isBgmOn ? '#fff5cf' : '#9aa0b8',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.55)',
                  maxWidth: 168,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ color: isBgmOn ? '#f6d265' : '#7b8199', flexShrink: 0 }}>
                  {isBgmOn ? '♪' : '🔇'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isBgmOn ? bgmTrackLabel : '音乐已静音'}
                </span>
              </button>

              {/* 1:10 Real-Earth Multi-Gear Pokémon Ride & Flight Switcher (`T` hotkey / Click) */}
              <button
                type="button"
                onClick={() => cycleRideMode?.()}
                title="点击或按 T 键切换：徒步 → 疾驰骑乘 → 苍穹飞行（空格升空/X下降）→ 极速巡航"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  background:
                    rideMode === 'jet'
                      ? 'rgba(30, 58, 138, 0.92)'
                      : rideMode === 'fly'
                        ? 'rgba(13, 71, 102, 0.92)'
                        : rideMode === 'dash'
                          ? 'rgba(58, 42, 16, 0.92)'
                          : 'rgba(20, 24, 38, 0.86)',
                  border: `2px solid ${
                    rideMode === 'jet'
                      ? '#74c0fc'
                      : rideMode === 'fly'
                        ? '#63e6be'
                        : rideMode === 'dash'
                          ? '#ffd43b'
                          : '#868e96'
                  }`,
                  borderRadius: 4,
                  color: '#fff9db',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.55)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>
                  {rideMode === 'jet'
                    ? `⚡ 极速 · 海拔 ${playerAltitudeM ?? 0}m`
                    : rideMode === 'fly'
                      ? `🦅 飞行 · 海拔 ${playerAltitudeM ?? 0}m`
                      : rideMode === 'dash'
                        ? `🐕 疾驰 · 海拔 ${playerAltitudeM ?? 0}m`
                        : `🚶 徒步 [T骑乘] · ${playerAltitudeM ?? 0}m`}
                </span>
              </button>

              {(rideMode === 'fly' || rideMode === 'jet') && (
                <button
                  type="button"
                  onClick={() => landRideMode?.()}
                  title="立即降落回到地面"
                  style={{
                    padding: '3px 7px',
                    background: 'rgba(20, 24, 38, 0.88)',
                    border: '2px solid #ffa94d',
                    borderRadius: 4,
                    color: '#ffd8a8',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.55)',
                  }}
                >
                  ⬇ 降落
                </button>
              )}
            </div>
          </div>

          {/* Left-Edge RPG Party Status List (Collapsible toggle pill on mobile so 3D viewport stays wide open!) */}
          {!resultModal && (
            <div
              className={`surv-party-list is-centered ${mobilePartyOpen ? 'is-mobile-open' : 'is-mobile-collapsed'}`}
              title="拖拽或点击上下箭头调整出战顺序；点击卡片查看详情"
            >
              <button
                type="button"
                className="surv-party-mobile-toggle"
                onClick={() => setMobilePartyOpen((v) => !v)}
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={14} />
                <span>队伍 {followersView.length}</span>
                <em>{mobilePartyOpen ? '▲' : '▼'}</em>
              </button>
              <div className="surv-party-cards-wrap">
              {followersView.map((f, fIdx) => {
                const vitals = hud.followerVitals[f.id] ?? {
                  hp: Math.round((95 + f.level * 28) * (hpPct / 100)),
                  maxHp: 95 + f.level * 28,
                  mp: 100,
                  maxMp: 100,
                };
                const fHpPct = Math.max(0, Math.min(100, Math.round((vitals.hp / Math.max(1, vitals.maxHp)) * 100)));
                const fMpPct = Math.max(0, Math.min(100, Math.round((vitals.mp / Math.max(1, vitals.maxMp)) * 100)));
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
                    title={`${f.name} Lv.${f.level} · HP ${vitals.hp}/${vitals.maxHp} · 拖拽或点右侧箭头调序`}
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
                            backgroundColor: fHpPct > 40 ? '#48d167' : fHpPct > 20 ? '#fcc419' : '#ff5c5c',
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
                      <div className="party-reorder-col" onClick={(e) => e.stopPropagation()}>
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
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}

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

          {/* In-Run Town Poké Mart Full-Screen Boutique Shop Overlay */}
          {inRunTownShopOpen && (
            <ShopOverlay
              save={save}
              pet={pet}
              closing={false}
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

          {/* Optional Live FPS Counter & Kill Combo Streak Badges + Neo-Brutalist Pixel Minimap & Big World Map */}
          {prefs.showFps && (
            <div className="surv-fps-badge">{hud.fps} FPS</div>
          )}
          {prefs.showComboCounter && hud.combo >= 1 && (
            <div className="surv-combo-badge">
              <em>连续击败数</em>
              <strong>×{hud.combo}</strong>
            </div>
          )}
          {!resultModal && (
            <WorldMapHud
              biome={selectedBiome}
              regionName={regionMeta.name}
              snapshot={mapSnapshot}
              onToggleExpand={toggleWorldMap}
            />
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
                  <PixelItemImg
                    src={nearbyKoTarget.isBoss ? '/sprites/items/master-ball.png' : '/sprites/items/ultra-ball.png'}
                    size={18}
                  />
                  <span>投球收服</span>
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

          {/* Bottom-Right MOBA-Style Radial Action Wheel (Large Icon-Only Buttons, Zero Text Clutter!) */}
          {!externalPaused && !levelChoices && !shopOpen && !resultModal && !captureOffer && (
            <div className="surv-moba-wheel">
              {/* Outer Left Satellite (58x58): Full-MP Team Salvo */}
              <button
                type="button"
                className={`moba-btn is-aux-jump is-salvo ${hud.actionCds.salvo > 0 ? 'is-cd' : ''}`}
                disabled={hud.actionCds.salvo > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('salvo'), hud.actionCds.salvo > 0)}
                aria-label="齐射"
                title="齐射：全队瞬间满蓝，同步释放招牌绝招！"
              >
                <PixelItemImg src="/sprites/items/vs-seeker.png" size={32} />
                {hud.actionCds.salvo > 0 && (
                  <em className="moba-badge">{Math.ceil(hud.actionCds.salvo)}s</em>
                )}
              </button>

              {/* Arc Satellite 1 (0° Left): Throw Poké Ball */}
              <button
                type="button"
                className={`moba-btn is-sat is-sat-0 is-ball ${hud.actionCds.ball > 0 ? 'is-cd' : ''} ${nearbyKoTarget ? 'is-pulse' : ''}`}
                disabled={hud.actionCds.ball > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('ball'), hud.actionCds.ball > 0)}
                aria-label="投球"
                title="投球：向附近倒地/残血/异色野生宝可梦投掷精灵球收服！"
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={32} />
                {hud.actionCds.ball > 0 && (
                  <em className="moba-badge">{Math.ceil(hud.actionCds.ball)}s</em>
                )}
              </button>

              {/* Arc Satellite 2 (45° Upper-Left): Heal Potion */}
              <button
                type="button"
                className={`moba-btn is-sat is-sat-45 is-heal ${hud.actionCds.heal > 0 || hud.healCharges <= 0 ? 'is-cd' : ''}`}
                disabled={hud.actionCds.heal > 0 || hud.healCharges <= 0}
                {...bindMultiTouchAction(
                  () => triggerBattleActionRef.current?.('heal'),
                  hud.actionCds.heal > 0 || hud.healCharges <= 0,
                )}
                aria-label="伤药"
                title="伤药：使用好伤药立即回复全队 45% 生命值"
              >
                <PixelItemImg src="/sprites/items/super-potion.png" size={32} />
                <em className="moba-badge">
                  {hud.actionCds.heal > 0 ? `${Math.ceil(hud.actionCds.heal)}s` : `×${hud.healCharges}`}
                </em>
              </button>

              {/* Arc Satellite 3 (90° Top): Team Overdrive Boost */}
              <button
                type="button"
                className={`moba-btn is-sat is-sat-90 is-boost ${hud.actionCds.boost > 0 ? 'is-cd' : ''} ${hud.boostLeft > 0 ? 'is-active' : ''}`}
                disabled={hud.actionCds.boost > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('boost'), hud.actionCds.boost > 0)}
                aria-label="强化"
                title="强化：激活 8 秒力量强化（全队攻击 +55%、充能加速）"
              >
                <PixelItemImg src="/sprites/items/rare-candy.png" size={32} />
                {(hud.boostLeft > 0 || hud.actionCds.boost > 0) && (
                  <em className="moba-badge">
                    {hud.boostLeft > 0 ? `${Math.ceil(hud.boostLeft)}s` : `${Math.ceil(hud.actionCds.boost)}s`}
                  </em>
                )}
              </button>

              {/* Primary Corner Main Button (80x80): 3D Jump */}
              <button
                type="button"
                className="moba-btn is-primary is-jump-main"
                {...bindMultiTouchAction(() => {
                  jumpQueuedRef.current = true;
                })}
                aria-label="跳跃"
                title="跳跃：3D 跳跃翻越台阶或躲避弹幕"
              >
                <PixelIcon name="arrow_up" size={38} />
              </button>
            </div>
          )}

          {/* Cinematic Close-Up Poké Ball Capture Cutscene Overlay (Throw -> Crimson Absorb -> 3 Wobbles -> Starburst!) */}
          {/* Pure 3D Close-Up Capture Cinema Bars (Zero popup box! After 3D ball catches, opens our REAL MAIN HandheldConsole!) */}
          {captureCutscene && !resultModal && (
            <div className={`surv-capture-cutscene is-phase-${captureCutscene.phase}`}>
              <div className="cap-letterbox is-top" />
              <div className="cap-cinema-subtitle">
                {captureCutscene.phase === 'throw' && `去吧！精灵球！瞄准 ${captureCutscene.name}！`}
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
