import React, { useEffect, useState } from 'react';
import {
  GYM_BADGE_CATALOG,
  HERO_ROSTER,
  LAB_UPGRADES,
  MAX_SHOWCASE_BADGES,
  TRAINER_TAG_CATALOG,
  getActiveTrainerTagDef,
  getDailyResetCountdown,
  getHeroEvolutionStage,
  getLabUpgradeCost,
  getShowcaseBadgeIds,
  getUnlockedTrainerTags,
  getWeeklyResetCountdown,
  type GymBadgeCategory,
  type GymBadgeId,
  type HeroId,
  type LabUpgradeId,
  type MetaProgressState,
  type TrainerTagId,
} from '../data/metaProgression';
import { PixelIcon, PixelItemImg } from './PixelSprite';
import { sound } from '../utils/sound';
import {
  DEFAULT_ANNOUNCEMENTS,
  NEWS_EDITIONS,
  type NewsCardLayout,
  type NewsEdition,
  type NewsPhotoItem,
  type ServerAnnouncement,
} from '../data/newsEditions';

export {
  DEFAULT_ANNOUNCEMENTS,
  NEWS_EDITIONS,
  type NewsCardLayout,
  type NewsEdition,
  type NewsPhotoItem,
  type ServerAnnouncement,
};

/* =========================================================================
   1. RESEARCH LAB OVERLAY (Universal Permanent Upgrades + Switchable Heroes!)
   ========================================================================= */
interface LabOverlayProps {
  meta: MetaProgressState;
  closing: boolean;
  initialTab?: 'universal' | 'heroes' | 'badges';
  onClose: () => void;
  onBuyLabUpgrade: (id: LabUpgradeId) => void;
  onUnlockOrSelectHero: (heroId: HeroId) => void;
  onUpgradeHeroSkill: (heroId: HeroId, skillId: string) => void;
  onSelectTrainerTag?: (tagId: TrainerTagId) => void;
  onToggleShowcaseBadge?: (badgeId: GymBadgeId) => void;
  onOpenTrainerCard?: () => void;
  onOpenAchievements?: () => void;
  achievementsLabel?: string;
}

export const LabOverlay: React.FC<LabOverlayProps> = ({
  meta,
  closing,
  initialTab = 'universal',
  onClose,
  onBuyLabUpgrade,
  onUnlockOrSelectHero,
  onUpgradeHeroSkill,
  onSelectTrainerTag,
  onToggleShowcaseBadge,
  onOpenTrainerCard,
  onOpenAchievements,
  achievementsLabel,
}) => {
  const [tab, setTab] = useState<'universal' | 'heroes' | 'badges'>(initialTab);
  const [selectedHeroId, setSelectedHeroId] = useState<HeroId>(meta.activeHero);
  const [badgeCat, setBadgeCat] = useState<'all' | GymBadgeCategory>('all');

  useEffect(() => {
    setTab(initialTab);
    if (initialTab === 'heroes') {
      setSelectedHeroId(meta.activeHero);
    }
  }, [initialTab, meta.activeHero]);
  const unlockedTags = getUnlockedTrainerTags(meta);
  const activeTagDef = getActiveTrainerTagDef(meta);
  const earnedBadges = meta.unlockedBadges ?? [];
  const showcaseIds = getShowcaseBadgeIds(meta);
  const showcaseSet = new Set(showcaseIds);

  const totalLabLv = LAB_UPGRADES.reduce((acc, u) => acc + (meta.labLevels[u.id] ?? 0), 0);
  const maxLabLv = LAB_UPGRADES.reduce((acc, u) => acc + u.maxLevel, 0);
  const inspectedHero = HERO_ROSTER.find((h) => h.id === selectedHeroId) ?? HERO_ROSTER[0];
  const heroUnlocked = meta.unlockedHeroes.includes(inspectedHero.id);
  const isActiveHero = meta.activeHero === inspectedHero.id;
  const heroEvo = getHeroEvolutionStage(inspectedHero.id, meta.heroSkillLevels);

  return (
    <div
      className={`meta-fullscreen-overlay ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="meta-panel is-lab">
        <header className="meta-head">
          <button type="button" className="pkb-esc-btn" onClick={onClose}>
            <PixelIcon name="arrow_left" size={13} />
            <span>返回</span>
          </button>
          <div className="meta-ribbon is-orange">
            <PixelItemImg src="/sprites/items/exp-share.png" size={18} />
            <h2>研究所 · 永久强化与主角觉醒</h2>
          </div>
          <div className="meta-head-right">
            <div className="stardust-pill" title="星星沙子 · 通过 3D 讨伐、首领与委托获取">
              <PixelItemImg src="/sprites/items/bright-powder.png" size={18} />
              <strong>{meta.stardust}</strong>
              <small>星沙</small>
            </div>
          </div>
        </header>

        <div className="meta-split-shell">
          <nav className="meta-side-rail" aria-label="研究所分类">
            <button
              type="button"
              className={`meta-rail-tab ${tab === 'universal' ? 'active' : ''}`}
              title={`通用强化 (${totalLabLv}/${maxLabLv})`}
              aria-label={`通用强化 ${totalLabLv}/${maxLabLv}`}
              onClick={() => {
                sound.play('cursor');
                setTab('universal');
              }}
            >
              <PixelItemImg src="/sprites/items/life-orb.png" size={32} />
              <em>{totalLabLv}/{maxLabLv}</em>
            </button>
            <button
              type="button"
              className={`meta-rail-tab ${tab === 'heroes' ? 'active' : ''}`}
              title={`主角与专属技能 (${meta.unlockedHeroes.length}/${HERO_ROSTER.length})`}
              aria-label={`主角与专属技能 ${meta.unlockedHeroes.length}/${HERO_ROSTER.length}`}
              onClick={() => {
                sound.play('cursor');
                setTab('heroes');
              }}
            >
              <PixelItemImg src={inspectedHero.avatarSprite} size={32} />
              <em>{meta.unlockedHeroes.length}/{HERO_ROSTER.length}</em>
            </button>
            <button
              type="button"
              className={`meta-rail-tab ${tab === 'badges' ? 'active' : ''}`}
              title={`道馆徽章与标签 (${earnedBadges.length}/${GYM_BADGE_CATALOG.length})`}
              aria-label={`道馆徽章与标签 ${earnedBadges.length}/${GYM_BADGE_CATALOG.length}`}
              onClick={() => {
                sound.play('cursor');
                setTab('badges');
              }}
            >
              <PixelItemImg src="/sprites/items/kings-rock.png" size={32} />
              <em>{earnedBadges.length}/{GYM_BADGE_CATALOG.length}</em>
            </button>
          </nav>

          {tab === 'universal' ? (
          <div className="meta-body scroll-y">
            <div className="meta-section-label">
              <strong>全局永久属性强化</strong>
              <span>对所有出战主角与随从永久生效</span>
            </div>
            <div className="lab-upgrade-grid">
              {LAB_UPGRADES.map((u) => {
                const lv = meta.labLevels[u.id] ?? 0;
                const maxed = lv >= u.maxLevel;
                const cost = getLabUpgradeCost(u, lv);
                const canBuy = !maxed && meta.stardust >= cost;
                return (
                  <div key={u.id} className={`lab-card ${maxed ? 'is-maxed' : ''}`}>
                    <div className="lab-card-stripe" style={{ backgroundColor: u.accent }}>
                      <span className="lab-lv-tag">
                        Lv.{lv}/{u.maxLevel}
                      </span>
                    </div>
                    <div className="lab-card-ico">
                      <PixelItemImg src={u.icon} size={32} />
                    </div>
                    <strong>{u.name}</strong>
                    <small>{u.perLevelLabel}</small>
                    <p>{u.desc}</p>
                    <div className="lab-pip-bar">
                      {Array.from({ length: u.maxLevel }).map((_, i) => (
                        <i
                          key={i}
                          className={i < lv ? 'is-filled' : ''}
                          style={i < lv ? { backgroundColor: u.accent } : undefined}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="lab-buy-btn"
                      disabled={!canBuy}
                      onClick={() => onBuyLabUpgrade(u.id)}
                    >
                      {maxed ? (
                        <span>已满级</span>
                      ) : (
                        <>
                          <PixelItemImg src="/sprites/items/bright-powder.png" size={14} />
                          <span>{cost}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tab === 'heroes' ? (
          <div className="meta-body hero-lab-layout">
            {/* Left: 4 Switchable Protagonists */}
            <div className="hero-roster-col">
              {HERO_ROSTER.map((h) => {
                const unlocked = meta.unlockedHeroes.includes(h.id);
                const active = meta.activeHero === h.id;
                const evo = getHeroEvolutionStage(h.id, meta.heroSkillLevels);
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`hero-pick-card ${selectedHeroId === h.id ? 'is-selected' : ''} ${active ? 'is-active' : ''}`}
                    style={{ '--hero-accent': h.accentColor } as React.CSSProperties}
                    onClick={() => {
                      sound.play('cursor');
                      setSelectedHeroId(h.id);
                    }}
                  >
                    <div className="hero-pick-avatar">
                      <PixelItemImg src={h.avatarSprite} size={36} />
                    </div>
                    <div className="hero-pick-info">
                      <div className="inline-icon-row">
                        <strong>{h.name}</strong>
                        {active && <em className="hero-tag is-on">出战中</em>}
                        {!unlocked && <em className="hero-tag is-lock">待解锁</em>}
                      </div>
                      <small>{evo.title}</small>
                      <div className="hero-mini-bar">
                        <div style={{ width: `${(evo.totalSkillLv / evo.maxSkillLv) * 100}%`, backgroundColor: h.accentColor }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Selected Protagonist Details, Awakening Evolution & Exclusive Skills */}
            <div className="hero-detail-col">
              <div className="hero-banner-card" style={{ borderLeftColor: inspectedHero.accentColor }}>
                <div className="hero-banner-left">
                  <div className="hero-lg-frame" style={{ borderColor: inspectedHero.accentColor }}>
                    <PixelItemImg src={inspectedHero.avatarSprite} size={52} />
                  </div>
                  <div>
                    <div className="inline-icon-row">
                      <h3>{inspectedHero.name}</h3>
                      <span className="hero-evo-pill" style={{ backgroundColor: inspectedHero.accentColor }}>
                        {heroEvo.tier === 2 ? '★ 觉醒形态' : heroEvo.tier === 1 ? '◆ 进阶形态' : '● 初始形态'} · {heroEvo.title}
                      </span>
                    </div>
                    <p>{inspectedHero.bio}</p>
                    <div className="hero-base-chips">
                      <span>HP {inspectedHero.baseHpBonus >= 0 ? `+${inspectedHero.baseHpBonus}` : inspectedHero.baseHpBonus}</span>
                      <span>伤害 +{Math.round(inspectedHero.baseAtkBonus * 100)}%</span>
                      <span>移速 {inspectedHero.baseSpeedBonus >= 0 ? `+${Math.round(inspectedHero.baseSpeedBonus * 100)}%` : `${Math.round(inspectedHero.baseSpeedBonus * 100)}%`}</span>
                      <span>觉醒进度 {heroEvo.totalSkillLv}/{heroEvo.maxSkillLv}</span>
                    </div>
                  </div>
                </div>
                <div className="hero-banner-cta">
                  {heroUnlocked ? (
                    <button
                      type="button"
                      className={`hero-deploy-btn ${isActiveHero ? 'is-on' : ''}`}
                      disabled={isActiveHero}
                      onClick={() => onUnlockOrSelectHero(inspectedHero.id)}
                    >
                      {isActiveHero ? '当前出战主角' : '切换为出战主角'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="hero-deploy-btn is-unlock"
                      disabled={meta.stardust < inspectedHero.unlockCost}
                      onClick={() => onUnlockOrSelectHero(inspectedHero.id)}
                    >
                      <PixelItemImg src="/sprites/items/bright-powder.png" size={14} />
                      <span>{inspectedHero.unlockCost} 解锁主角</span>
                    </button>
                  )}
                  {onOpenTrainerCard && (
                    <button
                      type="button"
                      className="hero-deploy-btn"
                      style={{ marginTop: 6 }}
                      onClick={() => {
                        sound.play('confirm');
                        onOpenTrainerCard();
                      }}
                    >
                      编辑训练家名片
                    </button>
                  )}
                </div>
              </div>

              <div className="hero-skills-grid">
                {inspectedHero.skills.map((sk) => {
                  const skLv = meta.heroSkillLevels[sk.id] ?? 0;
                  const evolved = skLv >= sk.maxLevel;
                  const cost = sk.baseCost + skLv * sk.costStep;
                  const canUpgrade = heroUnlocked && !evolved && meta.stardust >= cost;
                  return (
                    <div key={sk.id} className={`hero-skill-card ${evolved ? 'is-evolved' : ''}`}>
                      <div className="hero-sk-top">
                        <div className="hero-sk-ico">
                          <PixelItemImg src={sk.icon} size={32} />
                        </div>
                        <div className="hero-sk-title">
                          <div className="inline-icon-row">
                            <strong>{evolved ? sk.evolvedName : sk.name}</strong>
                            <em className="hero-sk-lv">Lv.{skLv}/{sk.maxLevel}</em>
                          </div>
                          <small>{evolved ? sk.evolvedDesc : sk.desc}</small>
                        </div>
                      </div>
                      <div className="lab-pip-bar">
                        {Array.from({ length: sk.maxLevel }).map((_, i) => (
                          <i
                            key={i}
                            className={i < skLv ? 'is-filled' : ''}
                            style={i < skLv ? { backgroundColor: inspectedHero.accentColor } : undefined}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="lab-buy-btn"
                        disabled={!canUpgrade}
                        onClick={() => onUpgradeHeroSkill(inspectedHero.id, sk.id)}
                      >
                        {!heroUnlocked ? (
                          <span>请先解锁主角</span>
                        ) : evolved ? (
                          <span>★ 已觉醒满级</span>
                        ) : (
                          <>
                            <PixelItemImg src="/sprites/items/bright-powder.png" size={14} />
                            <span>{cost} 强化专属技</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="meta-body scroll-y">
            <div className="meta-section-label">
              <strong>训练师等级体系（当前：{activeTagDef.name}）</strong>
              <div className="inline-icon-row" style={{ gap: 8 }}>
                <span>切换已解锁的训练师等级，为出战宝可梦提供战力光环</span>
                {onOpenAchievements && (
                  <button
                    type="button"
                    className="lcd-subtab inline-icon-btn"
                    onClick={() => {
                      sound.play('confirm');
                      onOpenAchievements();
                    }}
                  >
                    <PixelIcon name="trophy" size={11} />
                    <span>全部成就{achievementsLabel ? ` (${achievementsLabel})` : ''}</span>
                  </button>
                )}
              </div>
            </div>
            <div className="lab-tags-grid">
              {TRAINER_TAG_CATALOG.map((tag) => {
                const isUnlocked = unlockedTags.includes(tag.id);
                const isActive = activeTagDef.id === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={!isUnlocked}
                    className={`lab-tag-card ${isActive ? 'is-active' : ''} ${!isUnlocked ? 'is-locked' : ''}`}
                    style={{ '--tag-col': tag.color } as React.CSSProperties}
                    onClick={() => {
                      if (!isUnlocked) return;
                      sound.play('confirm');
                      onSelectTrainerTag?.(tag.id);
                    }}
                  >
                    <div className="lab-tag-head">
                      <PixelItemImg src={tag.icon} size={22} />
                      <div className="lab-tag-title">
                        <strong>{tag.name}</strong>
                        <em style={{ backgroundColor: tag.color }}>{tag.tierLabel}</em>
                      </div>
                      {isActive && <span className="lab-tag-equipped">生效中</span>}
                    </div>
                    <p className="lab-tag-perk">{tag.perkText}</p>
                    <small className="lab-tag-unlock">{isUnlocked ? '✓ 已解锁 · 点击切换' : `解锁条件：${tag.unlockText}`}</small>
                  </button>
                );
              })}
            </div>

            <div className="meta-section-label" style={{ marginTop: 14 }}>
              <strong>
                展示与目标徽章位（{showcaseIds.length}/{MAX_SHOWCASE_BADGES} · 已收集 {earnedBadges.length}/{GYM_BADGE_CATALOG.length}）
              </strong>
              <span>徽章库持续扩展，最多任选 {MAX_SHOWCASE_BADGES} 枚在顶部展示或设为追逐目标！</span>
            </div>

            {/* 6-Slot Showcase & Target Badge Dock */}
            <div className="lab-showcase-dock">
              {Array.from({ length: MAX_SHOWCASE_BADGES }).map((_, slotIdx) => {
                const bid = showcaseIds[slotIdx];
                const bDef = bid ? GYM_BADGE_CATALOG.find((x) => x.id === bid) : null;
                if (!bDef) {
                  return (
                    <div key={`empty_slot_${slotIdx}`} className="lab-showcase-slot is-empty">
                      <span>空位 {slotIdx + 1}</span>
                    </div>
                  );
                }
                const owned = earnedBadges.includes(bDef.id);
                return (
                  <button
                    key={bDef.id}
                    type="button"
                    className={`lab-showcase-slot ${owned ? 'is-owned' : 'is-target'}`}
                    style={{ '--badge-col': bDef.color } as React.CSSProperties}
                    title={`${bDef.name}（${owned ? '展示中' : '目标追踪中'}）· 点击移出展示位`}
                    onClick={() => {
                      sound.play('cursor');
                      onToggleShowcaseBadge?.(bDef.id);
                    }}
                  >
                    <PixelItemImg src={bDef.icon} size={22} />
                    <div className="lab-showcase-meta">
                      <strong>{bDef.name}</strong>
                      <small>{owned ? '展示中' : '目标徽章'}</small>
                    </div>
                    <em className="lab-showcase-rm" aria-hidden="true">×</em>
                  </button>
                );
              })}
            </div>

            {/* Badge Category Filter Tabs */}
            <div className="lab-badge-filter-row">
              {(
                [
                  { id: 'all', label: `全部徽章 (${GYM_BADGE_CATALOG.length})` },
                  { id: 'kanto', label: `关都道馆 (${GYM_BADGE_CATALOG.filter((b) => b.category === 'kanto').length})` },
                  { id: 'tour', label: `东亚巡礼 (${GYM_BADGE_CATALOG.filter((b) => b.category === 'tour').length})` },
                  { id: 'master', label: `大师荣誉 (${GYM_BADGE_CATALOG.filter((b) => b.category === 'master').length})` },
                ] as { id: 'all' | GymBadgeCategory; label: string }[]
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`party-mini-pill ${badgeCat === c.id ? 'active' : ''}`}
                  onClick={() => {
                    sound.play('cursor');
                    setBadgeCat(c.id);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="lab-badges-grid">
              {GYM_BADGE_CATALOG.filter((b) => badgeCat === 'all' || b.category === badgeCat).map((b) => {
                const owned = earnedBadges.includes(b.id);
                const inShowcase = showcaseSet.has(b.id);
                return (
                  <div
                    key={b.id}
                    className={`lab-badge-card ${owned ? 'is-owned' : 'is-locked'} ${inShowcase ? 'is-pinned' : ''}`}
                    style={{ '--badge-col': b.color } as React.CSSProperties}
                  >
                    <div className="lab-badge-ico">
                      <PixelItemImg src={b.icon} size={30} />
                    </div>
                    <div className="lab-badge-info">
                      <div className="lab-badge-top">
                        <strong>{b.name}</strong>
                        <small>{b.gymName}</small>
                        {onToggleShowcaseBadge && (
                          <button
                            type="button"
                            className={`lab-badge-pin-btn ${inShowcase ? 'is-on' : ''} ${!owned && inShowcase ? 'is-target' : ''}`}
                            onClick={() => {
                              sound.play('confirm');
                              onToggleShowcaseBadge(b.id);
                            }}
                            title={
                              inShowcase
                                ? '点击取消展示 / 取消目标'
                                : owned
                                  ? '设为顶部展示徽章（最多6枚）'
                                  : '设为目标徽章并追踪进度（最多6枚）'
                            }
                          >
                            {inShowcase
                              ? owned
                                ? '★ 展示中'
                                : '◎ 目标中'
                              : owned
                                ? '+ 展示'
                                : '+ 设为目标'}
                          </button>
                        )}
                      </div>
                      <p>{b.perkText}</p>
                      <span className="lab-badge-cond">{owned ? '★ 已点亮生效' : b.unlockHint}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   2. DAILY & WEEKLY BOUNTIES OVERLAY (任务委托)
   ========================================================================= */
interface BountiesOverlayProps {
  meta: MetaProgressState;
  closing: boolean;
  onClose: () => void;
  onClaimBounty: (kind: 'daily' | 'weekly', slotIdx: number) => void;
  onRerollBounty: (kind: 'daily' | 'weekly', slotIdx: number) => void;
  onClaimBonusChest: (kind: 'daily' | 'weekly') => void;
}

export const BountiesOverlay: React.FC<BountiesOverlayProps> = ({
  meta,
  closing,
  onClose,
  onClaimBounty,
  onRerollBounty,
  onClaimBonusChest,
}) => {
  const dailyDone = meta.dailyBounties.filter((b) => b.claimed).length;
  const weeklyDone = meta.weeklyBounties.filter((b) => b.claimed).length;

  const renderColumn = (kind: 'daily' | 'weekly') => {
    const isDaily = kind === 'daily';
    const list = isDaily ? meta.dailyBounties : meta.weeklyBounties;
    const doneCnt = isDaily ? dailyDone : weeklyDone;
    const bonusClaimed = isDaily ? meta.dailyBonusClaimed : meta.weeklyBonusClaimed;
    const canClaimBonus = !bonusClaimed && doneCnt >= 3;

    return (
      <section className={`bounty-col ${isDaily ? 'is-daily' : 'is-weekly'}`}>
        <div className="bounty-col-head">
          <div>
            <small>{isDaily ? '每日委托 · UTC 00:00 刷新' : '本周委托 · 每周一刷新'}</small>
            <h3>{isDaily ? '今日委托' : '本周委托'}</h3>
            <span className="bounty-countdown">
              距下次刷新：{isDaily ? getDailyResetCountdown() : getWeeklyResetCountdown()}
            </span>
          </div>
          {isDaily && <span className="bounty-streak-pill">连续 {meta.dailyStreak} 天</span>}
        </div>

        {/* 3-Step Milestone Track */}
        <div className="bounty-steps">
          {[1, 2, 3].map((step) => (
            <span key={step} className={doneCnt >= step ? 'is-done' : ''}>
              {step}
            </span>
          ))}
        </div>

        <div className="bounty-list">
          {list.map((b, idx) => {
            const pct = Math.min(100, Math.round((b.progress / b.target) * 100));
            const ready = !b.claimed && b.progress >= b.target;
            return (
              <div key={b.id} className={`bounty-card ${ready ? 'is-ready' : ''} ${b.claimed ? 'is-claimed' : ''}`}>
                <div className="bounty-ico">
                  <PixelItemImg src={b.icon} size={28} />
                </div>
                <div className="bounty-info">
                  <div className="inline-icon-row">
                    <span className={`bounty-tier tier-${b.tier}`}>{b.tierLabel}</span>
                    <strong>{b.title}</strong>
                  </div>
                  <small>{b.desc}</small>
                  <div className="bounty-prog-row">
                    <div className="bounty-prog-track">
                      <div className="bounty-prog-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <em>
                      {b.progress.toLocaleString()} / {b.target.toLocaleString()}
                    </em>
                  </div>
                </div>
                <div className="bounty-actions">
                  {b.claimed ? (
                    <span className="bounty-done-tag">✓ 已领</span>
                  ) : ready ? (
                    <button
                      type="button"
                      className="bounty-claim-btn"
                      onClick={() => onClaimBounty(kind, idx)}
                    >
                      领取 +{b.rewardStardust}
                    </button>
                  ) : (
                    <>
                      <span className="bounty-reward-chip">
                        <PixelItemImg src="/sprites/items/bright-powder.png" size={12} />+{b.rewardStardust}
                      </span>
                      <button
                        type="button"
                        className="bounty-reroll-btn"
                        onClick={() => onRerollBounty(kind, idx)}
                        title="免费更换一条委托"
                      >
                        更换
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grand Completion Chest */}
        <div className={`bounty-chest-box ${canClaimBonus ? 'is-ready' : ''}`}>
          <div>
            <strong>{isDaily ? '每日全勤大奖' : '每周全勤大奖'}</strong>
            <small>
              领取全部 3 条委托解锁 ({doneCnt}/3) · 奖励 {isDaily ? '+80 星沙 +120 金币' : '+450 星沙 +500 金币'}
            </small>
          </div>
          <button
            type="button"
            className="bounty-chest-btn"
            disabled={!canClaimBonus}
            onClick={() => onClaimBonusChest(kind)}
          >
            {bonusClaimed ? '✓ 已领取' : canClaimBonus ? '立即开启宝箱！' : '未达成'}
          </button>
        </div>
      </section>
    );
  };

  return (
    <div
      className={`meta-fullscreen-overlay ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="meta-panel is-bounties">
        <header className="meta-head">
          <button type="button" className="pkb-esc-btn" onClick={onClose}>
            <PixelIcon name="arrow_left" size={13} />
            <span>返回</span>
          </button>
          <div className="meta-ribbon is-purple">
            <PixelItemImg src="/sprites/items/vs-seeker.png" size={18} />
            <h2>任务委托 · 赚取星星沙子</h2>
          </div>
          <div className="stardust-pill">
            <PixelItemImg src="/sprites/items/bright-powder.png" size={18} />
            <strong>{meta.stardust}</strong>
            <small>星沙</small>
          </div>
        </header>
        <div className="bounties-grid-2 scroll-y">
          {renderColumn('daily')}
          {renderColumn('weekly')}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   3. NEWS / GUIDE / FEEDBACK MODALS
   ========================================================================= */
interface InfoModalProps {
  kind: 'news' | 'guide' | 'feedback';
  closing: boolean;
  onClose: () => void;
}

export const HubInfoModal: React.FC<InfoModalProps> = ({ kind, closing, onClose }) => {
  const [fbText, setFbText] = useState('');
  const [fbSent, setFbSent] = useState(false);

  return (
    <div
      className={`surv-modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="surv-upgrade-box pkb-info-modal">
        <div className="surv-upgrade-head shop-head-row">
          <span>
            {kind === 'news'
              ? '全球宝可梦中心新闻 · 版本日报'
              : kind === 'guide'
                ? 'POKé POCKET 3D 冒险操作指南'
                : '问题反馈与建议提交'}
          </span>
          <button type="button" className="lcd-mini-close" onClick={onClose}>
            关闭
          </button>
        </div>

        {kind === 'news' && (
          <div className="info-modal-body scroll-y">
            {NEWS_EDITIONS.map((ed) => (
              <article key={ed.id} className="news-card">
                <div className="news-card-head">
                  <span className="news-tag">{ed.version}</span>
                  <strong>{ed.title}</strong>
                  <em>第 {ed.issueNo} 期 · {ed.shortDate}</em>
                </div>
                <p>{ed.subtitle}</p>
              </article>
            ))}
          </div>
        )}

        {kind === 'guide' && (
          <div className="info-modal-body scroll-y">
            <div className="guide-grid">
              <div className="guide-box">
                <strong>3D 移动与视角控制</strong>
                <p>WASD / 方向键移动，空格跳跃登上 2m 阶梯崖壁。点击 3D 画面锁定自由鼠标视角（ESC/Alt 释放），也可直接按住左/右键拖拽转向，滚轮缩放，R 复位。</p>
              </div>
              <div className="guide-box">
                <strong>随从战斗与战术切换</strong>
                <p>所有非休眠的随从会自主游走并释放双招式！按 Q 打开战术终端切换招式/阵型，按 E 掏出掌机照顾宝可梦，升级时按 1/2/3 极速选卡。</p>
              </div>
              <div className="guide-box">
                <strong>研究所、主角觉醒与委托</strong>
                <p>击败首领和完成每日/每周委托可赚取「星星沙子」，在研究所强化全局属性、解锁切换赤红/小霞/小刚/小茂并觉醒满级专属技能！</p>
              </div>
              <div className="guide-box">
                <strong>3D 实体掌机彩蛋</strong>
                <p>按住掌机非按钮外壳区域可自由 3D 倾斜把玩，双击外壳区域一键放平回正，右侧挂件支持全屏大视野模式！</p>
              </div>
            </div>
          </div>
        )}

        {kind === 'feedback' && (
          <div className="info-modal-body">
            {fbSent ? (
              <div className="fb-done-box">
                <PixelIcon name="heart" size={24} />
                <strong>感谢你的宝贵反馈！</strong>
                <p>反馈记录已保存至本地日志，后续接入后端服务器后将自动同步给开发团队。</p>
                <button type="button" className="lcd-inline-cta" onClick={onClose}>
                  返回
                </button>
              </div>
            ) : (
              <div className="pkb-prof-form">
                <label>
                  <span>描述你遇到的问题或想新增的宝可梦/玩法建议</span>
                  <textarea
                    rows={4}
                    value={fbText}
                    onChange={(e) => setFbText(e.target.value)}
                    placeholder="例如：希望增加某个地图、优化某个技能特效、或报告画面异常..."
                  />
                </label>
                <button
                  type="button"
                  className="lcd-inline-cta full"
                  disabled={!fbText.trim()}
                  onClick={() => {
                    sound.play('confirm');
                    try {
                      const prev = JSON.parse(localStorage.getItem('pokepocket_feedback') || '[]');
                      prev.push({ at: new Date().toISOString(), text: fbText.trim() });
                      localStorage.setItem('pokepocket_feedback', JSON.stringify(prev));
                    } catch {
                      // ignore
                    }
                    setFbSent(true);
                  }}
                >
                  提交反馈
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
