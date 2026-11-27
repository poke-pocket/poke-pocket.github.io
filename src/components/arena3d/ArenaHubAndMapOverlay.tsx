import type { ArenaSharedCtx } from './arenaTypesAndProps';
import React from 'react';
import { ACHIEVEMENTS, POKEDEX_ORDER, SPECIES_CATALOG, getGrowthStage } from '../../data/catalog';
import { DIFFICULTIES, WORLD_TOWNS_3D } from '../../data/survivorsTactics';
import { MAX_PET_SLOTS } from '../../utils/petEngine';
import { WorldMapOverlay } from '../WorldMapOverlay';
import { DEFAULT_TRAINER_PROFILE, type PetRecord } from '../../types/pet';
import { type TrainerTagId } from '../../data/metaProgression';
import { LANG_LABELS, tr } from '../../data/i18n';
import { BountiesOverlay, DEFAULT_ANNOUNCEMENTS, HubInfoModal, LabOverlay } from '../MetaOverlays';
import { ShopOverlay } from '../ShopOverlay';
import { sound } from '../../utils/sound';
import { TimeEcologyModal } from '../TimeEcologyModal';
import { PixelIcon, PixelItemImg } from '../PixelSprite';
import type { PixelIconName } from '../../data/pixelIcons';
import { TrimmedSpriteImg } from '../TrimmedSpriteImg';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const ArenaHubAndMapOverlay: React.FC<{ ctx: Record<string, any> }> = ({ ctx: rawCtx }) => {
  const ctx = rawCtx as ArenaSharedCtx;
  const { activeHeroDef, activeSquadIdx, activeSquadPreset, activeWorldRun, claimableBountyCount, closeHubModal, closeMapSelect, closeProfileModal, closeSquadEditor, closingHubModal, closingMapSelect, closingProfile, closingSquadEditor, cycleLanguage, diffMeta, difficultyId, dockRowRef, effectiveSquadPets, gameMode, handleBuyLabUpgrade, handleClaimBonusChest, handleClaimBounty, handleLaunchRandomRogueRun, handleLaunchRun, handleLaunchWorldRun, handleRerollBounty, handleUnlockOrSelectHero, handleUpgradeHeroSkill, hubModal, isFullscreen, labInitialTab, lang, liveOverlandCity, liveWeather, mapSnapshot, maxFollowers, meta, newsTickerIdx, onBuyAccessory, onBuyFood, onBuyPokeball, onOpenPokemonManager, onPullGacha, onPullGachaTen, onToggleFullscreen, onUpdateMeta, onUpdatePetConfig, onUpdatePrefs, onUpdateProfile, pet, petMeta, petStage, phase, profileDraft, profileOpen, pwaInstallPrompt, regionMeta, save, selectSquadPreset, setDifficultyId, setGameMode, setHubModal, setLabInitialTab, setProfileDraft, setPwaInstallPrompt, setSquadEditorOpen, setTimeAlmanacOpen, setWorldMapOpen, solarInfo, squadEditorOpen, squadPresets, timeAlmanacOpen, togglePetInActiveSquad, trainerProfile, visibleDockCount, worldMapOpen } = ctx;
  return (
    <>
      {/* =====================================================================
          LAYER 1: POKEBONK-STYLE PIXEL MAIN HUB (Top-Left Squad Avatars + Top-Right Trainer/Settings + Open 3D Vista!)
         ===================================================================== */}
      {phase === 'hub' && (
        <div className="pkb-hub-overlay">
          {/* Top Status Ribbon: Wide Desktop shows full 6-avatar squad strip; Mobile/Compact converges into Squad entry pill! */}
          <header className="pkb-topbar">
            <div className="pkb-top-squad" title={`当前出战队伍：${activeSquadPreset.name} · 点击管理当前队伍`}>
              {/* Wide-screen full squad avatar strip */}
              <div className="pkb-top-squad-wide">
                {effectiveSquadPets.slice(0, 6).map((p) => {
                  const stg = getGrowthStage(p.level, p.species);
                  const spMeta = SPECIES_CATALOG[p.species];
                  const isLead = p.id === pet.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pkb-top-avatar-btn ${isLead ? 'is-lead' : ''}`}
                      onClick={() => onOpenPokemonManager('squad', false)}
                      title={`${p.name} (${spMeta.typeLabel}) · Lv.${p.level} · 点击管理当前队伍`}
                    >
                      <TrimmedSpriteImg
                        src={spMeta.stageSprites[stg].animated}
                        alt={p.name}
                        size={36}
                        fillRatio={0.86}
                      />
                      <em>{p.level}</em>
                    </button>
                  );
                })}
                {save.pets.length < 6 && (
                  <button
                    type="button"
                    className="pkb-top-avatar-btn is-add"
                    onClick={() => {
                      sound.play('confirm');
                      setHubModal('shop');
                    }}
                    title="打开精品商店与精灵盲盒"
                  >
                    <span>+</span>
                  </button>
                )}
              </div>

              {/* Compact / mobile converged Squad entry pill */}
              <button
                type="button"
                className="pkb-squad-entry-btn"
                onClick={() => onOpenPokemonManager('squad', false)}
                title={`管理出战队伍（${activeSquadPreset.name} · ${effectiveSquadPets.length}/${maxFollowers}）`}
              >
                <span className="pkb-squad-entry-ava">
                  <TrimmedSpriteImg
                    src={petMeta.stageSprites[petStage].static}
                    alt={pet.name}
                    size={26}
                    fillRatio={0.86}
                  />
                </span>
                <strong>{tr(lang, 'squadBtn')}</strong>
                <em className="pkb-squad-entry-count">{effectiveSquadPets.length}/{maxFollowers}</em>
              </button>
            </div>

            <div className="pkb-top-right">
              {(() => {
                const hubWeatherIcon: PixelIconName =
                  liveWeather.kind === 'cloudy'
                    ? 'weather_cloudy'
                    : liveWeather.kind === 'rain'
                      ? 'weather_rain'
                      : liveWeather.kind === 'storm'
                        ? 'weather_storm'
                        : liveWeather.kind === 'snow'
                          ? 'weather_snow'
                          : liveWeather.kind === 'windy'
                            ? 'weather_windy'
                            : solarInfo.phase === 'night'
                              ? 'weather_night_clear'
                              : 'weather_clear';
                return (
                  <button
                    type="button"
                    className="pkb-weather-pill"
                    onClick={() => {
                      sound.play('confirm');
                      setWorldMapOpen(true);
                    }}
                    title={`${liveWeather.locationLabel ?? '当地'} ${liveWeather.label} ${liveWeather.tempC}°C · ${solarInfo.phaseLabel}（日出 ${solarInfo.sunriseStr} / 日落 ${solarInfo.sunsetStr}）\n点击打开全球地图`}
                  >
                    <PixelIcon name={hubWeatherIcon} size={15} />
                    <strong>{liveWeather.label} {liveWeather.tempC}°C</strong>
                  </button>
                );
              })()}

              <button
                type="button"
                className="pkb-profile-pill is-clickable"
                onClick={() => onOpenPokemonManager('profile', false)}
                title="点击在掌机中查看与编辑训练家名片"
              >
                <img
                  src={petMeta.stageSprites[petStage].static}
                  alt={pet.name}
                  className="pkb-avatar"
                  draggable={false}
                />
                <div className="pkb-trainer-meta">
                  <span className="pkb-trainer-name">{trainerProfile.name}</span>
                  <small className="pkb-trainer-sub">{trainerProfile.title}</small>
                </div>
              </button>

              <button
                type="button"
                className="pkb-coin-standalone"
                onClick={() => {
                  sound.play('confirm');
                  setHubModal('shop');
                }}
                title="当前持有金币 · 点击打开宝可梦精品商店"
              >
                <PixelItemImg src="/sprites/items/amulet-coin.png" size={18} />
                <span>{save.coins}</span>
              </button>

              <button
                type="button"
                className="pkb-icon-btn is-icon-only"
                onClick={() => onOpenPokemonManager('settings', false)}
                title="系统设置（分轨音频 / 界面 / 画面性能 / 外观 / 按键）"
                aria-label="系统设置"
              >
                <PixelItemImg src="/sprites/items/exp-share.png" size={24} />
              </button>
            </div>
          </header>

          {/* Trainer Profile Social Card Modal (Bidirectional Open + Close Animation!) */}
          {profileOpen && (
            <div
              className={`surv-modal-backdrop ${closingProfile ? 'is-closing' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeProfileModal();
              }}
            >
              <div className="surv-upgrade-box pkb-profile-modal">
                <div className="surv-upgrade-head shop-head-row">
                  <span className="inline-icon-row">
                    <PixelIcon name="crown" size={15} />
                    <span>训练家详情与名片设置</span>
                  </span>
                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={closeProfileModal}
                  >
                    关闭
                  </button>
                </div>
                <div className="pkb-prof-body">
                  <div className="pkb-prof-preview">
                    <div className="pkb-prof-avatar-lg">
                      <img
                        src={petMeta.stageSprites[petStage].animated}
                        alt={pet.name}
                        draggable={false}
                      />
                    </div>
                    <div className="pkb-prof-stats">
                      <strong>{profileDraft.name.trim() || DEFAULT_TRAINER_PROFILE.name}</strong>
                      <span className="pkb-prof-title-badge">{profileDraft.title.trim() || DEFAULT_TRAINER_PROFILE.title}</span>
                      <p>{profileDraft.bio.trim() || DEFAULT_TRAINER_PROFILE.bio}</p>
                      <div className="pkb-prof-kpis">
                        <span>图鉴 {save.discoveredSpecies.length}/{POKEDEX_ORDER.length}</span>
                        <span>伙伴 {save.pets.length} 只</span>
                        <span>徽章 {save.unlockedAchievements.length} 枚</span>
                      </div>
                    </div>
                  </div>

                  <div className="pkb-prof-form">
                    <label>
                      <span>训练家昵称</span>
                      <input
                        type="text"
                        maxLength={14}
                        value={profileDraft.name}
                        onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="输入你的训练家昵称"
                      />
                    </label>
                    <label>
                      <span>展示称号</span>
                      <input
                        type="text"
                        maxLength={16}
                        value={profileDraft.title}
                        onChange={(e) => setProfileDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="例如：关都新锐训练家 / 森林守护者"
                      />
                    </label>
                    <label>
                      <span>个人展示签名</span>
                      <input
                        type="text"
                        maxLength={40}
                        value={profileDraft.bio}
                        onChange={(e) => setProfileDraft((d) => ({ ...d, bio: e.target.value }))}
                        placeholder="向其他训练家展示你的冒险宣言..."
                      />
                    </label>
                  </div>

                  <div className="pkb-prof-actions">
                    <button
                      type="button"
                      className="lcd-inline-cta full"
                      onClick={() => {
                        sound.play('confirm');
                        onUpdateProfile?.({
                          name: profileDraft.name.trim() || DEFAULT_TRAINER_PROFILE.name,
                          title: profileDraft.title.trim() || DEFAULT_TRAINER_PROFILE.title,
                          bio: profileDraft.bio.trim() || DEFAULT_TRAINER_PROFILE.bio,
                        });
                        closeProfileModal();
                      }}
                    >
                      保存训练家名片
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Center-Left Hero Launch Deck (Clean Title + Co-Linear 60° Slanted Parallelogram Cards!) */}
          <div className="pkb-hub-body">
            <div className="pkb-hub-left">
              <div className="pkb-title-block">
                <h1>
                  POKé POCKET <span className="pkb-3d-tag">3D</span>
                </h1>
              </div>

              {/* Primary Co-Linear Slanted Parallelogram Arcade Mode Cards */}
              <div className="pkb-hero-grid is-slanted-deck">
                <button
                  type="button"
                  className="pkb-hero-cta is-story"
                  onClick={() => {
                    const nextDiff = save.prefs?.worldDifficulty ?? 'normal';
                    setGameMode('story');
                    setDifficultyId(nextDiff);
                    handleLaunchRun();
                  }}
                >
                  <div className="pkb-unskew-inner">
                    <div className="pkb-hero-ico-box is-lg">
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={58} />
                    </div>
                    <div className="pkb-cta-txt">
                      <strong>{tr(lang, 'startAdventure')}</strong>
                      <small>{tr(lang, 'startAdventureSub')}</small>
                    </div>
                  </div>
                  <kbd className="px-keycap on-hero">1</kbd>
                </button>

                <div className="pkb-hero-subcol">
                  <button
                    type="button"
                    className="pkb-sub-cta is-world"
                    onClick={() => handleLaunchRandomRogueRun()}
                    title="随机降临森林/火山/雪峰/荒漠秘境，体验爽快肉鸽割草与三选一进化！"
                  >
                    <div className="pkb-unskew-inner">
                      <div className="pkb-hero-ico-box">
                        <PixelItemImg src="/sprites/items/vs-seeker.png" size={44} />
                      </div>
                      <div>
                        <strong>{tr(lang, 'randomAdventure')}</strong>
                        <small>{tr(lang, 'randomAdventureSub')}</small>
                      </div>
                    </div>
                    <kbd className="px-keycap on-hero">2</kbd>
                  </button>
                  <button
                    type="button"
                    className="pkb-sub-cta is-care"
                    onClick={() => {
                      sound.play('confirm');
                      onOpenPokemonManager('home', false);
                    }}
                  >
                    <div className="pkb-unskew-inner">
                      <div className="pkb-hero-ico-box">
                        <PixelItemImg src="/sprites/items/soothe-bell.png" size={44} />
                      </div>
                      <div>
                        <strong>{tr(lang, 'pokemonManager')}</strong>
                        <small>{tr(lang, 'pokemonManagerSub')}</small>
                      </div>
                    </div>
                    <kbd className="px-keycap on-hero">3</kbd>
                  </button>
                </div>
              </div>

              {/* True Responsive Priority+ Single-Row Hub Dock: packs as many tiles as fit in 1 row, overflows ONLY the rest into "More"! */}
              {(() => {
                const allDockItems: {
                  id: string;
                  label: string;
                  icon: string;
                  title: string;
                  badge?: string | number;
                  badgeClass?: string;
                  onClick: () => void;
                }[] = [
                  {
                    id: 'box',
                    label: tr(lang, 'dockBox'),
                    icon: '/sprites/items/great-ball.png',
                    title: `精灵球盒 · 共 ${save.pets.length}/${MAX_PET_SLOTS} 只伙伴`,
                    badge: save.pets.length,
                    onClick: () => onOpenPokemonManager('party', false),
                  },
                  {
                    id: 'bag',
                    label: tr(lang, 'dockBag'),
                    icon: '/sprites/items/berry-pouch.png',
                    title: '训练家背包 · 树果补给与携带道具',
                    onClick: () => onOpenPokemonManager('bag', false),
                  },
                  {
                    id: 'dex',
                    label: tr(lang, 'dockDex'),
                    icon: '/sprites/items/town-map.png',
                    title: `宝可梦图鉴+ · 已收录 ${save.discoveredSpecies.length}/${POKEDEX_ORDER.length}`,
                    badge: `${save.discoveredSpecies.length}/${POKEDEX_ORDER.length}`,
                    badgeClass: 'is-blue',
                    onClick: () => onOpenPokemonManager('pokedex', false),
                  },
                  {
                    id: 'lab',
                    label: tr(lang, 'dockLab'),
                    icon: '/sprites/items/bright-powder.png',
                    title: `研究所 · 星星沙子 ${meta.stardust} · 永久强化与切换主角 (${activeHeroDef.name})`,
                    badge: meta.stardust,
                    badgeClass: 'is-purple',
                    onClick: () => {
                      sound.play('confirm');
                      setHubModal('lab');
                    },
                  },
                  {
                    id: 'bounties',
                    label: tr(lang, 'dockBounties'),
                    icon: '/sprites/items/vs-seeker.png',
                    title: '每日 & 每周任务委托 · 赚取星星沙子',
                    badge: claimableBountyCount > 0 ? claimableBountyCount : undefined,
                    onClick: () => {
                      sound.play('confirm');
                      setHubModal('bounties');
                    },
                  },
                  {
                    id: 'shop',
                    label: tr(lang, 'dockShop'),
                    icon: '/sprites/items/amulet-coin.png',
                    title: '宝可梦精品商店 · 专属外观 / 盲盒 / 补给',
                    badge: '精品',
                    badgeClass: 'is-gold',
                    onClick: () => {
                      sound.play('confirm');
                      setHubModal('shop');
                    },
                  },
                  {
                    id: 'world_tour',
                    label: '世界巡礼',
                    icon: '/sprites/items/town-map.png',
                    title: '全球地图 · GPS老家定位 · 航线与城市道馆巡礼',
                    onClick: () => {
                      sound.play('confirm');
                      setWorldMapOpen(true);
                    },
                  },
                  {
                    id: 'achieve',
                    label: tr(lang, 'dockAchieve'),
                    icon: '/sprites/items/kings-rock.png',
                    title: `成就徽章 · 已解锁 ${save.unlockedAchievements.length}/${ACHIEVEMENTS.length} 枚`,
                    badge: save.unlockedAchievements.length,
                    badgeClass: 'is-green',
                    onClick: () => onOpenPokemonManager('achievements', false),
                  },
                  {
                    id: 'diary',
                    label: tr(lang, 'dockDiary'),
                    icon: '/sprites/items/poke-radar.png',
                    title: '冒险日记 · 成长与战绩',
                    onClick: () => onOpenPokemonManager('diary', false),
                  },
                ];
                const visibleItems = allDockItems.slice(0, visibleDockCount);
                const overflowCount = Math.max(0, allDockItems.length - visibleItems.length);
                return (
                  <>
                    <div
                      ref={dockRowRef}
                      className="pkb-dock-row is-single-row"
                      style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
                    >
                      {visibleItems.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          className="pkb-dock-tile"
                          onClick={it.onClick}
                          title={it.title}
                        >
                          {it.badge !== undefined && (
                            <em className={`pkb-dock-badge ${it.badgeClass ?? ''}`}>{it.badge}</em>
                          )}
                          <PixelItemImg src={it.icon} size={38} />
                          <strong>{it.label}</strong>
                        </button>
                      ))}
                    </div>

                    {/* Bottom Action Bar: Rolling Announcement Ticker + Adaptive "More" Button (shown only when items overflow or on compact screens!) */}
                    <div className="pkb-hub-bar">
                      <button
                        type="button"
                        className="pkb-news-ticker"
                        onClick={() => onOpenPokemonManager('news', false)}
                        title="点击在掌机中查看《关都日报》"
                      >
                        <PixelItemImg src="/sprites/items/poke-radar.png" size={16} />
                        <span className="pkb-news-pill">
                          {lang === 'zh'
                            ? DEFAULT_ANNOUNCEMENTS[newsTickerIdx % DEFAULT_ANNOUNCEMENTS.length]?.tag ?? tr(lang, 'newsTag')
                            : tr(lang, 'newsTag')}
                        </span>
                        <span className="pkb-news-text">
                          {lang === 'zh'
                            ? `${DEFAULT_ANNOUNCEMENTS[newsTickerIdx % DEFAULT_ANNOUNCEMENTS.length]?.title ?? tr(lang, 'newsHeadline')}`
                            : tr(lang, 'newsHeadline')}
                        </span>
                        <em>→</em>
                      </button>

                      {overflowCount > 0 && (
                        <button
                          type="button"
                          className="pkb-more-btn is-always-visible"
                          onClick={() => {
                            sound.play('confirm');
                            setHubModal('more');
                          }}
                          title="展开剩余功能"
                        >
                          <em className="pkb-dock-badge">{overflowCount}</em>
                          <PixelItemImg src="/sprites/items/town-map.png" size={18} />
                          <strong>{tr(lang, 'moreBtn')}</strong>
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Corner Footer (Desktop shows Guide/Feedback/PWA/Lang; Mobile folds Guide/Feedback into More!) */}
          <footer className="pkb-hub-footer">
            <button
              type="button"
              className="pkb-util-btn pkb-wide-footer-item"
              onClick={() => onOpenPokemonManager('guide', false)}
              title={tr(lang, 'guideBtn')}
            >
              <PixelItemImg src="/sprites/items/light-ball.png" size={15} />
              <span>{tr(lang, 'guideBtn')}</span>
            </button>
            <button
              type="button"
              className="pkb-util-btn pkb-wide-footer-item"
              onClick={() => onOpenPokemonManager('feedback', false)}
              title={tr(lang, 'feedbackBtn')}
            >
              <PixelItemImg src="/sprites/items/potion.png" size={15} />
              <span>{tr(lang, 'feedbackBtn')}</span>
            </button>
            {pwaInstallPrompt && (
              <button
                type="button"
                className="pkb-util-btn is-pwa"
                title="将 POKé POCKET 安装为桌面/手机独立应用 (PWA)"
                onClick={async () => {
                  sound.play('confirm');
                  await pwaInstallPrompt.prompt();
                  const choice = await pwaInstallPrompt.userChoice;
                  if (choice.outcome === 'accepted') {
                    setPwaInstallPrompt(null);
                  }
                }}
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={15} />
                <span>安装应用</span>
              </button>
            )}
            <button
              type="button"
              className="pkb-util-btn is-lang"
              onClick={cycleLanguage}
              aria-label="语言"
              title="切换界面语言 (中文 / English / 日本語)"
            >
              <PixelItemImg src="/sprites/items/town-map.png" size={15} />
              <span>{LANG_LABELS[lang]}</span>
            </button>
            {onToggleFullscreen && (
              <button
                type="button"
                className={`pkb-util-btn is-fs ${isFullscreen ? 'is-active' : ''}`}
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? tr(lang, 'exitFullscreenBtn') : tr(lang, 'fullscreenBtn')}
                title={isFullscreen ? '退出浏览器全屏' : '开启浏览器全屏模式'}
              >
                <PixelIcon name={isFullscreen ? 'shrink' : 'fullscreen'} size={13} />
                <span>{isFullscreen ? tr(lang, 'exitFullscreenBtn') : tr(lang, 'fullscreenBtn')}</span>
              </button>
            )}
          </footer>

          {/* Clean "More" Hub Drawer Modal (All 7 Secondary Features + Guide/Feedback) */}
          {hubModal === 'more' && (
            <div
              className={`surv-modal-backdrop ${closingHubModal ? 'is-closing' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeHubModal();
              }}
            >
              <div className="surv-upgrade-box pkb-more-modal">
                <div className="surv-upgrade-head shop-head-row">
                  <span className="inline-icon-row">
                    <PixelItemImg src="/sprites/items/town-map.png" size={18} />
                    <span>更多功能</span>
                  </span>
                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={closeHubModal}
                  >
                    {tr(lang, 'close')}
                  </button>
                </div>

                <div className="pkb-more-grid">
                  {([
                    {
                      id: 'box',
                      label: tr(lang, 'dockBox'),
                      icon: '/sprites/items/great-ball.png',
                      badge: save.pets.length,
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('party', false);
                      },
                    },
                    {
                      id: 'bag',
                      label: tr(lang, 'dockBag'),
                      icon: '/sprites/items/berry-pouch.png',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('bag', false);
                      },
                    },
                    {
                      id: 'dex',
                      label: tr(lang, 'dockDex'),
                      icon: '/sprites/items/town-map.png',
                      badge: `${save.discoveredSpecies.length}/${POKEDEX_ORDER.length}`,
                      badgeClass: 'is-blue',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('pokedex', false);
                      },
                    },
                    {
                      id: 'lab',
                      label: tr(lang, 'dockLab'),
                      icon: '/sprites/items/bright-powder.png',
                      badge: meta.stardust,
                      badgeClass: 'is-purple',
                      onClick: () => {
                        sound.play('confirm');
                        setHubModal('lab');
                      },
                    },
                    {
                      id: 'bounties',
                      label: tr(lang, 'dockBounties'),
                      icon: '/sprites/items/vs-seeker.png',
                      badge: claimableBountyCount > 0 ? claimableBountyCount : undefined,
                      onClick: () => {
                        sound.play('confirm');
                        setHubModal('bounties');
                      },
                    },
                    {
                      id: 'shop',
                      label: tr(lang, 'dockShop'),
                      icon: '/sprites/items/amulet-coin.png',
                      badge: '精品',
                      badgeClass: 'is-gold',
                      onClick: () => {
                        sound.play('confirm');
                        setHubModal('shop');
                      },
                    },
                    {
                      id: 'world_tour',
                      label: '世界巡礼',
                      icon: '/sprites/items/town-map.png',
                      onClick: () => {
                        setHubModal('none');
                        sound.play('confirm');
                        setWorldMapOpen(true);
                      },
                    },
                    {
                      id: 'achieve',
                      label: tr(lang, 'dockAchieve'),
                      icon: '/sprites/items/kings-rock.png',
                      badge: save.unlockedAchievements.length,
                      badgeClass: 'is-green',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('achievements', false);
                      },
                    },
                    {
                      id: 'diary',
                      label: tr(lang, 'dockDiary'),
                      icon: '/sprites/items/poke-radar.png',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('diary', false);
                      },
                    },
                  ] as const)
                    .slice(visibleDockCount)
                    .map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className="pkb-dock-tile"
                        onClick={it.onClick}
                      >
                        {'badge' in it && it.badge !== undefined && (
                          <em className={`pkb-dock-badge ${'badgeClass' in it && it.badgeClass ? it.badgeClass : ''}`}>
                            {it.badge}
                          </em>
                        )}
                        <PixelItemImg src={it.icon} size={34} />
                        <strong>{it.label}</strong>
                      </button>
                    ))}
                </div>

                <div className="pkb-more-footer">
                  <button
                    type="button"
                    className="pkb-util-btn"
                    onClick={() => {
                      setHubModal('none');
                      onOpenPokemonManager('guide', false);
                    }}
                  >
                    <PixelItemImg src="/sprites/items/light-ball.png" size={15} />
                    <span>{tr(lang, 'guideBtn')}</span>
                  </button>
                  <button
                    type="button"
                    className="pkb-util-btn"
                    onClick={() => {
                      setHubModal('none');
                      onOpenPokemonManager('feedback', false);
                    }}
                  >
                    <PixelItemImg src="/sprites/items/potion.png" size={15} />
                    <span>{tr(lang, 'feedbackBtn')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Shop, Lab, Bounties & Info Modals */}
          {hubModal === 'shop' && (
            <ShopOverlay
              save={save}
              pet={pet}
              closing={closingHubModal}
              onClose={closeHubModal}
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
          {hubModal === 'bounties' && (
            <BountiesOverlay
              meta={meta}
              closing={closingHubModal}
              onClose={closeHubModal}
              onClaimBounty={handleClaimBounty}
              onRerollBounty={handleRerollBounty}
              onClaimBonusChest={handleClaimBonusChest}
            />
          )}
          {(hubModal === 'news' || hubModal === 'guide' || hubModal === 'feedback') && (
            <HubInfoModal
              kind={hubModal}
              closing={closingHubModal}
              onClose={closeHubModal}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          NON-DESTRUCTIVE LAB / HERO DETAIL / BADGES OVERLAY (Works in Hub & Playing!)
         ===================================================================== */}
      {hubModal === 'lab' && (
        <LabOverlay
          meta={meta}
          closing={closingHubModal}
          initialTab={labInitialTab}
          onClose={() => {
            closeHubModal();
            setLabInitialTab('universal');
          }}
          onBuyLabUpgrade={handleBuyLabUpgrade}
          onUnlockOrSelectHero={handleUnlockOrSelectHero}
          onUpgradeHeroSkill={handleUpgradeHeroSkill}
          onSelectTrainerTag={(tagId: TrainerTagId) => {
            onUpdateMeta?.((prev) => ({ ...prev, activeTrainerTag: tagId }));
          }}
          onOpenTrainerCard={() => {
            setHubModal('none');
            setLabInitialTab('universal');
            onOpenPokemonManager('profile', phase === 'playing');
          }}
          onOpenAchievements={() => {
            setHubModal('none');
            setLabInitialTab('universal');
            onOpenPokemonManager('achievements', phase === 'playing');
          }}
          achievementsLabel={`${save.unlockedAchievements.length}/${ACHIEVEMENTS.length}`}
        />
      )}

      {/* =====================================================================
          NON-DESTRUCTIVE GLOBAL WORLD MAP OVERLAY (Closes directly back to active Hub or Playing!)
         ===================================================================== */}
      {worldMapOpen && (
        <WorldMapOverlay
          coins={save.coins}
          lang={lang}
          meta={meta}
          onUpdateMeta={(updater, coinDelta) => onUpdateMeta?.(updater, coinDelta)}
          onLaunchWorldRun={(payload) => handleLaunchWorldRun(payload, true)}
          onClose={() => {
            sound.play('cancel');
            setWorldMapOpen(false);
          }}
        />
      )}

      {timeAlmanacOpen && (
        <TimeEcologyModal
          solar={solarInfo}
          locationName={
            liveOverlandCity?.name ??
            activeWorldRun?.cityName ??
            WORLD_TOWNS_3D.find((t) => Math.hypot(mapSnapshot.px - t.x, mapSnapshot.pz - t.z) < t.plazaRadius + 6)?.name ??
            '真实地球'
          }
          timeOverride={save.prefs?.worldTimeMode ?? 'auto'}
          onChangeTimeOverride={(mode) => {
            sound.play('confirm');
            onUpdatePrefs?.({ worldTimeMode: mode });
          }}
          onClose={() => {
            sound.play('cancel');
            setTimeAlmanacOpen(false);
          }}
        />
      )}

      {/* =====================================================================
          LAYER 2: POKEBONK-STYLE 2-COLUMN MAP SELECT & READY SCREEN
         ===================================================================== */}
      {phase === 'map_select' && (
        <div className={`pkb-mapselect-overlay ${closingMapSelect ? 'is-closing' : ''}`}>
          {/* Top Navigation Bar */}
          <div className="pkb-ms-header">
            <button
              type="button"
              className="pkb-esc-btn"
              onClick={closeMapSelect}
            >
              <PixelIcon name="arrow_left" size={13} />
              <span>返回</span>
            </button>
            <div className="pkb-ms-ribbon">冒险准备 · 无限大世界</div>
            <div className="pkb-gen-pill">
              <span>{liveWeather.emoji}</span>
              <span>{liveWeather.label} {liveWeather.tempC}°C</span>
            </div>
          </div>

          {/* Main 2-Column Split: Left Live 3D Infinite World Showcase + Right Ready Panel */}
          <div className="pkb-ms-split">
            {/* LEFT: Transparent Frame Exposing the LIVE 3D Seamless Multi-Biome World! */}
            <div className="pkb-ms-showcase">
              <div className="pkb-ms-showcase-top">
                <div className="pkb-ms-title-card">
                  <small>无界探索 · 剧情冒险</small>
                  <h2>关都无限大世界</h2>
                  <div className="pkb-type-row">
                    <span className="pkb-type-pill" style={{ backgroundColor: '#2f9e44' }}>森林</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#d97724' }}>沙漠</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#1971c2' }}>海岸</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#15aabf' }}>冰川</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#c92a2a' }}>火山</span>
                  </div>
                  <p>
                    单一连续的无限大世界：默认出发点位于「上海市」南郊，向北即入上海市中心（含东方明珠、宝可梦中心、友好商店与高铁站），沿四方公路可跨桥穿洞远行至北京、广州、东京、京都。当前天气：{liveWeather.summary}（{liveWeather.buffText}）。
                  </p>
                </div>

                {/* Compact Vertically Stacked Squad Presets (Avatars Only!) */}
                <div className="pkb-squad-stack">
                  {squadPresets.map((sq, idx) => {
                    const isSelected = idx === activeSquadIdx;
                    const rowPets = sq.petIds
                      .map((id) => save.pets.find((p) => p.id === id))
                      .filter((p): p is PetRecord => p !== undefined && !p.isSleeping);
                    const shownPets =
                      rowPets.length > 0
                        ? rowPets.slice(0, maxFollowers)
                        : save.pets.filter((p) => !p.isSleeping).slice(0, Math.min(3, maxFollowers));
                    return (
                      <div
                        key={sq.id}
                        role="button"
                        tabIndex={0}
                        className={`pkb-squad-row ${isSelected ? 'is-active' : ''}`}
                        onClick={() => selectSquadPreset(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectSquadPreset(idx);
                          }
                        }}
                      >
                        <span className="pkb-squad-row-label">{sq.name}</span>
                        <div className="pkb-squad-row-avatars">
                          <span className="pkb-squad-mini-ava is-hero" title={activeHeroDef.name}>
                            <PixelItemImg src={activeHeroDef.avatarSprite} size={20} />
                          </span>
                          {shownPets.map((p) => {
                            const stg = getGrowthStage(p.level, p.species);
                            return (
                              <span key={p.id} className="pkb-squad-mini-ava" title={p.name}>
                                <TrimmedSpriteImg
                                  src={SPECIES_CATALOG[p.species].stageSprites[stg].static}
                                  alt={p.name}
                                  size={22}
                                  fillRatio={0.86}
                                />
                              </span>
                            );
                          })}
                        </div>
                        {isSelected && (
                          <button
                            type="button"
                            className="pkb-squad-edit-mini"
                            onClick={(e) => {
                              e.stopPropagation();
                              sound.play('confirm');
                              setSquadEditorOpen(true);
                            }}
                          >
                            编辑
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Inline Saved Squad Editor Modal */}
                {squadEditorOpen && (
                  <div
                    className={`surv-modal-backdrop ${closingSquadEditor ? 'is-closing' : ''}`}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) closeSquadEditor();
                    }}
                  >
                    <div className="surv-upgrade-box pkb-squad-editor-modal">
                      <div className="surv-upgrade-head shop-head-row">
                        <span>配置出战阵容 · {activeSquadPreset.name} ({effectiveSquadPets.length}/{maxFollowers})</span>
                        <button type="button" className="lcd-mini-close" onClick={closeSquadEditor}>
                          完成
                        </button>
                      </div>
                      <div className="squad-editor-grid scroll-y">
                        {save.pets.map((p) => {
                          const stg = getGrowthStage(p.level, p.species);
                          const inTeam = activeSquadPreset.petIds.includes(p.id) && !p.isSleeping;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={p.isSleeping}
                              className={`sq-edit-tile ${inTeam ? 'is-in' : ''} ${p.isSleeping ? 'is-sleep' : ''}`}
                              onClick={() => togglePetInActiveSquad(p.id)}
                            >
                              <img
                                src={SPECIES_CATALOG[p.species].stageSprites[stg].static}
                                alt={p.name}
                                draggable={false}
                              />
                              <strong>{p.name}</strong>
                              <small>{p.isSleeping ? '休眠中(不可出战)' : inTeam ? '✓ 已编入' : `Lv.${p.level}`}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Guardians Preview Bar (Crisp single-row square backpack-style tiles, zero wrapping!) */}
              <div className="pkb-guardians-bar">
                <div className="pkb-guard-head">区域守护者与安全圣地</div>
                <div className="pkb-guard-chain">
                  {regionMeta.guardians.map((sp, i) => (
                    <React.Fragment key={`${sp}_${i}`}>
                      <div
                        className="pkb-guard-tile"
                        title={`区域 ${i + 1} · ${SPECIES_CATALOG[sp].defaultName}`}
                      >
                        <img
                          src={SPECIES_CATALOG[sp].stageSprites.adult.static}
                          alt={SPECIES_CATALOG[sp].defaultName}
                          className="pkb-guard-tile-img"
                          draggable={false}
                        />
                        <span className="pkb-guard-tile-name">{SPECIES_CATALOG[sp].defaultName}</span>
                      </div>
                      {i < 2 && <em className="pkb-guard-arrow">→</em>}
                    </React.Fragment>
                  ))}
                  <div
                    className="pkb-guard-tile is-sanctuary"
                    title="安全区圣地 · 精灵中心 + 商店"
                  >
                    <PixelItemImg src="/sprites/items/potion.png" size={26} />
                    <span className="pkb-guard-tile-name">安全区</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Ready Panel (准备游戏 · 模式 · 难度 · 出发!) */}
            <aside className="pkb-ready-panel">
              <div
                className="pkb-ready-head"
                style={{ backgroundColor: regionMeta.headerColor }}
              >
                <strong>准备游戏</strong>
                <span>{regionMeta.name}</span>
              </div>

              <div className="pkb-ready-body">
                <div className="pkb-sec-lbl">模式</div>
                <div className="pkb-mode-pair">
                  <button
                    type="button"
                    className={`pkb-mode-card ${gameMode === 'story' ? 'is-story-on' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      setGameMode('story');
                    }}
                  >
                    <PixelItemImg src="/sprites/items/poke-ball.png" size={18} />
                    <div>
                      <strong>剧情模式</strong>
                      <small>区域、守护者与圣地</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`pkb-mode-card ${gameMode === 'endless' ? 'is-endless-on' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      setGameMode('endless');
                    }}
                  >
                    <PixelItemImg src="/sprites/items/vs-seeker.png" size={18} />
                    <div>
                      <strong>无尽模式</strong>
                      <small>无限宝可梦群与里程碑</small>
                    </div>
                  </button>
                </div>

                <div className="pkb-sec-lbl">难度</div>
                <div className="pkb-diff-list">
                  {DIFFICULTIES.map((d) => {
                    const active = d.id === difficultyId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`pkb-diff-btn ${active ? `is-on diff-${d.id}` : ''}`}
                        onClick={() => {
                          sound.play('cursor');
                          setDifficultyId(d.id);
                        }}
                      >
                        <strong>{d.label}</strong>
                        <small className="pkb-diff-full-desc">{d.badgeText} · {d.desc}</small>
                        <small className="pkb-diff-compact-badge">{d.badgeText}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="pkb-diff-compact-note">
                  {diffMeta.badgeText} · {diffMeta.desc}
                </div>

                <div className="pkb-record-box">
                  <div className="pkb-record-row">
                    <span>当前随从出战</span>
                    <strong>{Math.min(save.pets.length, 3)} 只（局内可随时暂停调整）</strong>
                  </div>
                  <div className="pkb-record-row">
                    <span>通关守护者奖励</span>
                    <strong className="is-gold">+{Math.round(regionMeta.rewardCoins * diffMeta.rewardMult)} 金币 + Boss收服</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="pkb-launch-cta"
                onClick={handleLaunchRun}
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={20} />
                <span>出发！</span>
                <em>回车</em>
              </button>
            </aside>
          </div>
        </div>
      )}

    </>
  );
};
