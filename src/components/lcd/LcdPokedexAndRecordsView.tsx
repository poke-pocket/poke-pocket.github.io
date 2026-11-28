import type { LcdSharedCtx } from './lcdViewTypes';
import React from 'react';
import { ACCESSORY_CATALOG, ACHIEVEMENTS, FOOD_CATALOG, POKEDEX_ORDER, ROOM_CATALOG, SPECIES_CATALOG, getGrowthStage, getIvRank, getPokemonCryId } from '../../data/catalog';
import { ensureFreshMetaProgress } from '../../data/metaProgression';
import { resolveBadgeIconName } from '../../data/pixelIcons';
import { ALL_SURVIVOR_SKILL_IDS, DIFFICULTIES, MAP_REGIONS, SURVIVOR_SKILLS } from '../../data/survivorsTactics';
import { getAccessoryAvailability, getBallAvailability, getPetIVs } from '../../utils/petEngine';
import { sound } from '../../utils/sound';
import { PixelIcon, PixelItemImg, PixelPetIcon, PixelPetPortrait, PixelPetSprite } from '../PixelSprite';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LcdPokedexAndRecordsView: React.FC<{ ctx: LcdSharedCtx }> = ({ ctx }) => {
  const { achCategory, confirmReset, dexCardOpen, dexDetailTab, dexDiscovered, dexSpeciesMeta, dexTab, menuCursor, mode, onExitMode, onGoBack, onNavigateMode, onResetSave, onStartGame, onToggleDexCard, pet, save, selectedDexSpecies, setAchCategory, setConfirmReleaseId, setConfirmReset, setDetailReturnMode, setDexDetailTab, setDexTab, setPartyDetailTab, setPetActionMenuOpen, setSelectedDexSpecies, setSelectedPartyPetId } = ctx;
  return (
    <>
        {/* POKEDEX+ MULTI-CATEGORY COLLECTION ENCYCLOPEDIA (总览 | 宝可梦 | 招式 | 道具 | 历程) */}
        {mode === 'pokedex' && (() => {
          const meta = ensureFreshMetaProgress(save.meta);
          const pokeOwned = save.discoveredSpecies.length;
          const pokeTotal = POKEDEX_ORDER.length;

          const seenSkillsSet = new Set(meta.seenSkills);
          const maxedSkillsSet = new Set(meta.maxedSkills);
          const skillsOwned = ALL_SURVIVOR_SKILL_IDS.filter((id) => seenSkillsSet.has(id)).length;
          const skillsTotal = ALL_SURVIVOR_SKILL_IDS.length;

          const realAccessories = ACCESSORY_CATALOG.filter((a) => a.id !== 'none');
          const ownedFoodsCount = FOOD_CATALOG.filter(
            (f) => f.unlimited || (save.inventory[f.id] ?? 0) > 0,
          ).length;
          const ownedAccCount = realAccessories.filter(
            (a) => save.unlockedAccessories.includes(a.id) || getAccessoryAvailability(save, a.id).total > 0,
          ).length;
          const ownedRoomsCount = ROOM_CATALOG.filter(
            (r) => r.id === 'pokeball_room' || save.unlockedRooms.includes(r.id) || getBallAvailability(save, r.id).total > 0,
          ).length;
          const itemsOwned = ownedFoodsCount + ownedAccCount + ownedRoomsCount;
          const itemsTotal = FOOD_CATALOG.length + realAccessories.length + ROOM_CATALOG.length;

          const journeyOwned = save.unlockedAchievements.length + meta.clearedBiomes.length;
          const journeyTotal = ACHIEVEMENTS.length + MAP_REGIONS.length;

          const totalCollected = pokeOwned + skillsOwned + itemsOwned + journeyOwned;
          const totalPossible = Math.max(1, pokeTotal + skillsTotal + itemsTotal + journeyTotal);
          const overallPct = Math.min(100, Math.round((totalCollected / totalPossible) * 100));

          const collectorRank =
            overallPct >= 95
              ? '传说收藏家'
              : overallPct >= 70
                ? '关都大师'
                : overallPct >= 45
                  ? '资深图鉴专家'
                  : overallPct >= 20
                    ? '见习研究员'
                    : '新手收藏家';

          const categoryCards: {
            tab: 'pokemon' | 'skills' | 'items' | 'journey';
            title: string;
            owned: number;
            total: number;
            color: string;
            sprite: string;
          }[] = [
            {
              tab: 'pokemon',
              title: '宝可梦',
              owned: pokeOwned,
              total: pokeTotal,
              color: '#ff6b6b',
              sprite: '/sprites/items/poke-ball.png',
            },
            {
              tab: 'skills',
              title: '招式',
              owned: skillsOwned,
              total: skillsTotal,
              color: '#f59f00',
              sprite: '/sprites/items/magnet.png',
            },
            {
              tab: 'items',
              title: '道具与球舱',
              owned: itemsOwned,
              total: itemsTotal,
              color: '#339af0',
              sprite: '/sprites/items/berry-pouch.png',
            },
            {
              tab: 'journey',
              title: '成就与历程',
              owned: journeyOwned,
              total: journeyTotal,
              color: '#40c057',
              sprite: '/sprites/items/kings-rock.png',
            },
          ];

          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="lcd-subtabs is-dex-tabs">
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${dexTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setDexTab('overview')}
                  >
                    <PixelIcon name="chart" size={11} />
                    <span>总览</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${dexTab === 'pokemon' ? 'active' : ''}`}
                    onClick={() => setDexTab('pokemon')}
                  >
                    <PixelItemImg src="/sprites/items/poke-ball.png" size={12} />
                    <span>宝可梦</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${dexTab === 'skills' ? 'active' : ''}`}
                    onClick={() => setDexTab('skills')}
                  >
                    <PixelIcon name="bolt" size={11} />
                    <span>招式</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${dexTab === 'items' ? 'active' : ''}`}
                    onClick={() => setDexTab('items')}
                  >
                    <PixelItemImg src="/sprites/items/berry-pouch.png" size={12} />
                    <span>道具</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${dexTab === 'journey' ? 'active' : ''}`}
                    onClick={() => setDexTab('journey')}
                  >
                    <PixelIcon name="trophy" size={11} />
                    <span>历程</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => {
                    sound.play('cancel');
                    onGoBack();
                  }}
                >
                  返回
                </button>
              </div>

              {/* TAB 1: OVERVIEW */}
              {dexTab === 'overview' && (
                <div className="dex-overview-wrap scroll-y">
                  <div className="dex-overview-hero">
                    <div
                      className="dex-donut"
                      style={{
                        background: `conic-gradient(#f59f00 0% ${overallPct}%, rgba(22, 20, 32, 0.14) ${overallPct}% 100%)`,
                      }}
                      aria-label={`总收集完成度 ${overallPct}%`}
                    >
                      <div className="dex-donut-inner">
                        <strong>{overallPct}%</strong>
                        <small>完成度</small>
                      </div>
                    </div>
                    <div className="dex-rank-meta">
                      <span className="dex-rank-kicker inline-icon-row">
                        <PixelIcon name="crown" size={11} />
                        <span>宝可梦图鉴+</span>
                      </span>
                      <strong className="dex-rank-title">{collectorRank}</strong>
                      <small>
                        全图鉴收录 {totalCollected} / {totalPossible} 项
                      </small>
                    </div>
                  </div>

                  <div className="dex-cat-grid">
                    {categoryCards.map((cat) => {
                      const pct = Math.min(100, Math.round((cat.owned / Math.max(1, cat.total)) * 100));
                      return (
                        <button
                          key={cat.tab}
                          type="button"
                          className="dex-cat-card"
                          onClick={() => setDexTab(cat.tab)}
                        >
                          <div className="dex-cat-head">
                            <span className="inline-icon-row">
                              <PixelItemImg src={cat.sprite} size={18} />
                              <strong>{cat.title}</strong>
                            </span>
                            <em className="dex-cat-count">
                              {cat.owned}/{cat.total}
                            </em>
                          </div>
                          <div className="dex-cat-bar">
                            <div
                              className="dex-cat-fill"
                              style={{ width: `${pct}%`, backgroundColor: cat.color }}
                            />
                          </div>
                          <div className="dex-cat-foot">
                            <small>{pct}% 已收录</small>
                            <span>查看 ›</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: POKEMON */}
              {dexTab === 'pokemon' && (
                <div className="lcd-grid-4 dex-compact-grid scroll-y">
                  {POKEDEX_ORDER.map((sp) => {
                    const spMeta = SPECIES_CATALOG[sp];
                    const unlocked = save.discoveredSpecies.includes(sp);
                    const ownedCnt = save.pets.filter((x) => x.species === sp).length;
                    return (
                      <button
                        key={sp}
                        type="button"
                        className={`lcd-dex-tile ${unlocked ? 'unlocked' : 'locked'}`}
                        onClick={() => {
                          setSelectedDexSpecies(sp);
                          setDexDetailTab('evo');
                          if (unlocked) {
                            sound.playCry(getPokemonCryId(sp, 5));
                          }
                          onNavigateMode('pokedex_detail');
                        }}
                      >
                        <span className="dex-tile-no">{spMeta.dexNo}</span>
                        {ownedCnt > 0 && <em className="dex-owned-pin">×{ownedCnt}</em>}
                        <div className={`dex-sprite-hero ${unlocked ? '' : 'silhouette-wrap'}`}>
                          <PixelPetSprite species={sp} stage="baby" size={56} pose="idle0" useStatic={!unlocked} />
                        </div>
                        <span className="tile-corner-name">{unlocked ? spMeta.title : '???'}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: SKILLS */}
              {dexTab === 'skills' && (
                <div className="dex-skill-grid scroll-y">
                  {ALL_SURVIVOR_SKILL_IDS.map((sid) => {
                    const sk = SURVIVOR_SKILLS[sid];
                    const isSeen = seenSkillsSet.has(sid);
                    const isMaxed = maxedSkillsSet.has(sid);
                    return (
                      <div
                        key={sid}
                        className={`dex-skill-card ${isMaxed ? 'is-maxed' : isSeen ? 'is-unlocked' : 'is-locked'}`}
                        style={{ borderLeftColor: sk.color }}
                      >
                        <div className="dex-skill-top">
                          <div className="dex-skill-ico">
                            <PixelItemImg src={sk.sprite} size={28} />
                          </div>
                          <div className="dex-skill-head-meta">
                            <div className="inline-icon-row">
                              <strong>{sk.name}</strong>
                              <span className="sk-tag" style={{ backgroundColor: sk.color }}>
                                {sk.tag}
                              </span>
                            </div>
                            <small className="dex-skill-stats">
                              倍率 ×{sk.powerMult.toFixed(2)} · 冷却 {sk.baseCd}s
                            </small>
                          </div>
                          <em
                            className={`dex-mastery-badge ${
                              isMaxed ? 'is-maxed' : isSeen ? 'is-seen' : 'is-unseen'
                            }`}
                          >
                            {isMaxed ? '已满级' : isSeen ? '已解锁' : '未收录'}
                          </em>
                        </div>
                        <p className="dex-skill-desc">{sk.desc}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: ITEMS (Berries + Held Accessories + Pokeball Capsules) */}
              {dexTab === 'items' && (
                <div className="dex-items-wrap scroll-y">
                  <div className="dex-section-bar">
                    <span>树果与美食</span>
                    <em>
                      {ownedFoodsCount}/{FOOD_CATALOG.length}
                    </em>
                  </div>
                  <div className="dex-item-grid">
                    {FOOD_CATALOG.map((food) => {
                      const owned = food.unlimited || (save.inventory[food.id] ?? 0) > 0;
                      return (
                        <div
                          key={food.id}
                          className={`dex-item-card ${owned ? 'is-owned' : 'is-missing'}`}
                          title={`${food.name} · ${food.description}`}
                        >
                          <div className={`dex-item-ico ${owned ? '' : 'is-dim'}`}>
                            <PixelItemImg src={food.itemSprite} size={28} />
                          </div>
                          <strong>{food.name}</strong>
                          <em className={`dex-item-state ${owned ? 'is-owned' : ''}`}>
                            {owned ? '已收录' : '未获得'}
                          </em>
                        </div>
                      );
                    })}
                  </div>

                  <div className="dex-section-bar">
                    <span>携带道具</span>
                    <em>
                      {ownedAccCount}/{realAccessories.length}
                    </em>
                  </div>
                  <div className="dex-item-grid">
                    {realAccessories.map((acc) => {
                      const owned =
                        save.unlockedAccessories.includes(acc.id) ||
                        getAccessoryAvailability(save, acc.id).total > 0;
                      return (
                        <div
                          key={acc.id}
                          className={`dex-item-card ${owned ? 'is-owned' : 'is-missing'}`}
                          title={`${acc.name} · ${acc.description}`}
                        >
                          <div className={`dex-item-ico ${owned ? '' : 'is-dim'}`}>
                            <PixelItemImg src={acc.itemSprite} size={28} />
                          </div>
                          <strong>{acc.name}</strong>
                          <em className={`dex-item-state ${owned ? 'is-owned' : ''}`}>
                            {owned ? '已收录' : '未获得'}
                          </em>
                        </div>
                      );
                    })}
                  </div>

                  <div className="dex-section-bar">
                    <span>精灵球舱</span>
                    <em>
                      {ownedRoomsCount}/{ROOM_CATALOG.length}
                    </em>
                  </div>
                  <div className="dex-item-grid">
                    {ROOM_CATALOG.map((rm) => {
                      const owned =
                        rm.id === 'pokeball_room' ||
                        save.unlockedRooms.includes(rm.id) ||
                        getBallAvailability(save, rm.id).total > 0;
                      return (
                        <div
                          key={rm.id}
                          className={`dex-item-card ${owned ? 'is-owned' : 'is-missing'}`}
                          title={`${rm.shortName} · ${rm.description}`}
                        >
                          <div className={`dex-item-ico ${owned ? '' : 'is-dim'}`}>
                            <PixelItemImg src={rm.ballSprite} size={28} />
                          </div>
                          <strong>{rm.shortName}</strong>
                          <em className={`dex-item-state ${owned ? 'is-owned' : ''}`}>
                            {owned ? '已收录' : '未获得'}
                          </em>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: JOURNEY */}
              {dexTab === 'journey' && (
                <div className="dex-journey-wrap scroll-y">
                  <div className="dex-section-bar">
                    <span>关都区域通关勋章</span>
                    <em>
                      {meta.clearedBiomes.length}/{MAP_REGIONS.length}
                    </em>
                  </div>
                  <div className="dex-medal-row">
                    {MAP_REGIONS.map((reg) => {
                      const cleared = meta.clearedBiomes.includes(reg.id);
                      return (
                        <div
                          key={reg.id}
                          className={`dex-medal-card ${cleared ? 'is-cleared' : 'is-unexplored'}`}
                          style={{ borderTopColor: reg.headerColor }}
                          title={`${reg.name} · ${reg.bossName}`}
                        >
                          <div className={cleared ? '' : 'silhouette-wrap'}>
                            <PixelPetIcon species={reg.bossSpecies} stage="baby" width={24} />
                          </div>
                          <strong>{reg.name}</strong>
                          <em className={`dex-medal-state ${cleared ? 'is-cleared' : ''}`}>
                            {cleared ? '已通关' : '未探索'}
                          </em>
                        </div>
                      );
                    })}
                  </div>

                  <div className="dex-section-bar">
                    <span>难度制霸印记</span>
                    <em>
                      {meta.clearedDifficulties.length}/{DIFFICULTIES.length}
                    </em>
                  </div>
                  <div className="dex-medal-row is-diff-row">
                    {DIFFICULTIES.map((diff) => {
                      const cleared = meta.clearedDifficulties.includes(diff.id);
                      return (
                        <div
                          key={diff.id}
                          className={`dex-diff-badge ${cleared ? 'is-cleared' : 'is-locked'}`}
                          title={diff.desc}
                        >
                          <PixelIcon name={cleared ? 'trophy' : 'lock'} size={13} />
                          <strong>{diff.label}</strong>
                          <small>{cleared ? '已通关' : '未征服'}</small>
                        </div>
                      );
                    })}
                  </div>

                  <div className="dex-section-bar">
                    <span>冒险生涯档案</span>
                  </div>
                  <div className="dex-kpi-row">
                    <div className="dex-kpi-card">
                      <span>总击败</span>
                      <strong>{meta.totalKills}</strong>
                    </div>
                    <div className="dex-kpi-card">
                      <span>击败首领</span>
                      <strong>{meta.totalBossesDefeated}</strong>
                    </div>
                    <div className="dex-kpi-card">
                      <span>探索局数</span>
                      <strong>{meta.totalRuns}</strong>
                    </div>
                    <div className="dex-kpi-card">
                      <span>累计金币</span>
                      <strong>{meta.totalCoinsEarned}</strong>
                    </div>
                    <div className="dex-kpi-card">
                      <span>已解锁徽章</span>
                      <strong>
                        {save.unlockedAchievements.length}/{ACHIEVEMENTS.length}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* POKEDEX 2ND-LEVEL DETAIL (With Tabs: 进化路线 | 已拥有伙伴!) */}
        {mode === 'pokedex_detail' && (() => {
          const ownedOfSpecies = save.pets.filter((x) => x.species === selectedDexSpecies);
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <span className="inline-icon-row">
                  <PixelItemImg src="/sprites/items/town-map.png" size={15} />
                  <span>
                    图鉴 · {dexSpeciesMeta.dexNo}{' '}
                    {dexDiscovered ? dexSpeciesMeta.title : '未发现'}
                  </span>
                </span>
                <div className="dex-head-actions">
                  <button
                    type="button"
                    className={`dex-card-btn ${dexCardOpen ? 'is-active' : ''}`}
                    onClick={() => onToggleDexCard?.(selectedDexSpecies, 'baby', dexDiscovered)}
                    title={dexCardOpen ? '收起珍藏实体闪卡' : '展开 3D 实体全息珍藏卡'}
                  >
                    <PixelIcon name="sparkle" size={11} />
                    <span>{dexCardOpen ? '收起卡片' : '珍藏卡'}</span>
                  </button>
                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={() => {
                      sound.play('cancel');
                      onGoBack();
                    }}
                  >
                    返回
                  </button>
                </div>
              </div>

              <div className="detail-stack">
                <div className="lcd-dex-top">
                  <div className={`dex-sprite-box square lg ${dexDiscovered ? '' : 'silhouette-wrap'}`}>
                    <PixelPetPortrait species={selectedDexSpecies} stage="baby" size={56} />
                  </div>
                  <div className="lcd-dex-meta">
                    <div className="inline-icon-row">
                      <strong>{dexDiscovered ? dexSpeciesMeta.title : '???'}</strong>
                      <span className={`rarity-pill r-${dexSpeciesMeta.rarity}`}>
                        {dexSpeciesMeta.rarity}
                      </span>
                      <span
                        className="poke-type-pill mini"
                        style={{ backgroundColor: dexSpeciesMeta.typeColor }}
                      >
                        <PixelIcon name={dexSpeciesMeta.typeIcon} size={9} />
                        <span>{dexSpeciesMeta.typeLabel}</span>
                      </span>
                      {dexDiscovered && (
                        <button
                          type="button"
                          className="cry-play-btn"
                          onClick={() => sound.playCry(getPokemonCryId(selectedDexSpecies, 5))}
                          title={`聆听 ${dexSpeciesMeta.title} 的叫声`}
                          aria-label="聆听叫声"
                        >
                          <PixelIcon name="sound_on" size={11} />
                          <span>叫声</span>
                        </button>
                      )}
                    </div>
                    <small>{dexSpeciesMeta.trait}</small>
                    <small>
                      {dexDiscovered
                        ? dexSpeciesMeta.description
                        : '尚未收录此宝可梦，可前往「市场盲盒」抽取解锁！'}
                    </small>
                  </div>
                </div>

                {/* Pokédex Detail Tabs: Evolution Chain vs Owned Pokémon of this Species */}
                <div className="detail-tabs-row">
                  <div className="lcd-subtabs">
                    <button
                      type="button"
                      className={`lcd-subtab inline-icon-btn ${dexDetailTab === 'evo' ? 'active' : ''}`}
                      onClick={() => setDexDetailTab('evo')}
                    >
                      <PixelIcon name="sparkle" size={11} />
                      <span>进化路线</span>
                    </button>
                    <button
                      type="button"
                      className={`lcd-subtab inline-icon-btn ${dexDetailTab === 'owned' ? 'active' : ''}`}
                      onClick={() => setDexDetailTab('owned')}
                    >
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={12} />
                      <span>已拥有 ({ownedOfSpecies.length})</span>
                    </button>
                  </div>
                </div>

                {dexDetailTab === 'evo' && (
                  <div className="lcd-evo-chain compact">
                    {(dexSpeciesMeta.id === 'mew'
                      ? (['baby'] as const)
                      : dexSpeciesMeta.evoLevels.adult === dexSpeciesMeta.evoLevels.teen
                        ? (['baby', 'teen'] as const)
                        : (['baby', 'teen', 'adult'] as const)
                    ).map((st, idx) => (
                      <React.Fragment key={st}>
                        {idx > 0 && <span className="evo-next">→</span>}
                        <div
                          className={`lcd-evo-node is-card-clickable ${dexDiscovered ? 'reached' : 'locked'}`}
                          role="button"
                          tabIndex={0}
                          title={`点击查看「${dexDiscovered ? dexSpeciesMeta.stageNames[st] : '???'}」实体珍藏闪卡`}
                          onClick={() => onToggleDexCard?.(selectedDexSpecies, st, dexDiscovered, true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onToggleDexCard?.(selectedDexSpecies, st, dexDiscovered, true);
                            }
                          }}
                        >
                          <div className={dexDiscovered ? '' : 'silhouette-wrap'}>
                            <PixelPetSprite
                              species={selectedDexSpecies}
                              stage={st}
                              size={58}
                              pose="idle0"
                              useStatic={!dexDiscovered}
                            />
                          </div>
                          <strong>
                            {dexDiscovered ? dexSpeciesMeta.stageNames[st] : '???'}
                          </strong>
                          <small>
                            {st === 'baby'
                              ? `${dexSpeciesMeta.stageDexNos[st]} · 初始`
                              : `${dexSpeciesMeta.stageDexNos[st]} · Lv.${dexSpeciesMeta.evoLevels[st]}`}
                          </small>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                )}

                {dexDetailTab === 'owned' && (
                  ownedOfSpecies.length === 0 ? (
                    <div className="dex-owned-empty">
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={24} />
                      <span>球盒中暂无该品种宝可梦，去盲盒商店或 3D 野外收服吧！</span>
                    </div>
                  ) : (
                    <div className="lcd-grid-3 dex-owned-grid scroll-y">
                      {ownedOfSpecies.map((op) => {
                        const ost = getGrowthStage(op.level, op.species);
                        const oRank = getIvRank(getPetIVs(op));
                        const oBall =
                          ROOM_CATALOG.find((r) => r.id === op.ballRoom) ?? ROOM_CATALOG[0];
                        const isActive = op.id === pet.id;
                        return (
                          <button
                            key={op.id}
                            type="button"
                            className={`lcd-grid-tile compact party-compact-tile ${isActive ? 'is-selected' : ''}`}
                            onClick={() => {
                              setSelectedPartyPetId(op.id);
                              setConfirmReleaseId(null);
                              setPetActionMenuOpen(false);
                              setPartyDetailTab('stats');
                              setDetailReturnMode('party');
                              onNavigateMode('party_detail');
                            }}
                          >
                            <div className="tile-tl-group">
                              <PixelItemImg src={oBall.ballSprite} size={18} />
                              {isActive ? (
                                <em className="tile-tl-badge is-cur">当前</em>
                              ) : (
                                <em className={`tile-tl-badge iv-${oRank}`}>{oRank}</em>
                              )}
                            </div>
                            <em className="tile-tr-lv">Lv.{op.level}</em>
                            <div className="party-sprite-hero">
                              <PixelPetSprite species={op.species} stage={ost} size={56} pose="idle0" />
                            </div>
                            <span className="tile-corner-name">{op.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })()}

        {/* MINI-GAME SELECTOR (2-Column Neo-Brutalist Pixel Grid!) */}
        {mode === 'play_menu' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <span className="inline-icon-row">
                <PixelItemImg src="/sprites/items/vs-seeker.png" size={15} />
                <span>选择特训小游戏</span>
              </span>
              <button type="button" className="lcd-mini-close" onClick={onExitMode}>
                返回
              </button>
            </div>
            <div className="lcd-grid-2 play-menu-grid">
              <button
                type="button"
                className={`lcd-game-tile ${menuCursor % 2 === 0 ? 'is-selected' : ''}`}
                onClick={() => onStartGame('game_catch')}
              >
                <div className="game-tile-ico">
                  <PixelItemImg src="/sprites/items/oran-berry.png" size={32} />
                </div>
                <strong>接树果大作战</strong>
                <small>接住树果与星星，躲避炸弹赢金币！</small>
                <span className="game-tile-tag">
                  <PixelIcon name="coin" size={10} />
                  金币 & 亲密
                </span>
              </button>
              <button
                type="button"
                className={`lcd-game-tile ${menuCursor % 2 === 1 ? 'is-selected' : ''}`}
                onClick={() => onStartGame('game_peekaboo')}
              >
                <div className="game-tile-ico">
                  <PixelItemImg src="/sprites/items/poke-ball.png" size={32} />
                </div>
                <strong>草丛猜方向</strong>
                <small>5 轮直觉对决，猜中 {pet.name} 会扑向哪边！</small>
                <span className="game-tile-tag">
                  <PixelIcon name="star" size={10} />
                  直觉特训
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ACHIEVEMENTS */}
        {mode === 'achievements' && (() => {
          const ACH_TABS: { id: 'all' | 'care' | 'dex' | 'battle' | 'collect' | 'legend'; label: string }[] = [
            { id: 'all', label: '全部' },
            { id: 'care', label: '养成' },
            { id: 'dex', label: '图鉴' },
            { id: 'battle', label: '战斗' },
            { id: 'collect', label: '收藏' },
            { id: 'legend', label: '传说' },
          ];
          const filteredAchs = ACHIEVEMENTS.filter(
            (a) => achCategory === 'all' || a.category === achCategory,
          ).sort((a, b) => {
            const ad = save.unlockedAchievements.includes(a.id) ? 1 : 0;
            const bd = save.unlockedAchievements.includes(b.id) ? 1 : 0;
            return bd - ad;
          });
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <span className="inline-icon-row">
                  <PixelItemImg src="/sprites/items/kings-rock.png" size={15} />
                  <span>成就徽章 ({save.unlockedAchievements.length}/{ACHIEVEMENTS.length})</span>
                </span>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => {
                    sound.play('cancel');
                    onGoBack();
                  }}
                >
                  返回
                </button>
              </div>
              <div className="ach-cat-bar">
                {ACH_TABS.map((tab) => {
                  const tabAll = tab.id === 'all'
                    ? ACHIEVEMENTS
                    : ACHIEVEMENTS.filter((a) => a.category === tab.id);
                  const tabDone = tabAll.filter((a) => save.unlockedAchievements.includes(a.id)).length;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`party-mini-pill ${achCategory === tab.id ? 'active' : ''}`}
                      onClick={() => {
                        sound.play('cursor');
                        setAchCategory(tab.id);
                      }}
                    >
                      {tab.label} {tabDone}/{tabAll.length}
                    </button>
                  );
                })}
              </div>
              <div className="lcd-grid-2 compact-grid scroll-y">
                {filteredAchs.map((ach) => {
                  const done = save.unlockedAchievements.includes(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`lcd-room-tile compact ach-badge-card ${done ? 'is-selected' : ''}`}
                    >
                      <div className="ach-card-top">
                        <div className="inline-icon-row">
                          <PixelIcon
                            name={done ? resolveBadgeIconName(ach.badge) : 'lock'}
                            size={14}
                          />
                          <strong>{ach.title}</strong>
                        </div>
                        <span className={`ach-reward-pill ${done ? 'is-done' : ''}`}>
                          {done ? '✓ 已达成' : `+${ach.rewardCoins}币`}
                        </span>
                      </div>
                      <small className="ach-card-desc">{ach.description}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* DIARY & RESET */}
        {mode === 'diary' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <span className="inline-icon-row">
                <PixelItemImg src="/sprites/items/vs-seeker.png" size={15} />
                <span>冒险日记</span>
              </span>
              <button
                type="button"
                className="lcd-mini-close"
                onClick={() => {
                  sound.play('cancel');
                  onGoBack();
                }}
              >
                返回
              </button>
            </div>
            <div className="lcd-diary-wrap">
              <div className="lcd-submenu-list">
                {save.diary.slice(0, 14).map((entry) => (
                  <div key={entry.id} className="lcd-menu-row static">
                    <span className="row-left">
                      <PixelIcon name={resolveBadgeIconName(entry.badge)} size={13} />
                      <span className="diary-snippet">
                        {entry.petName}: {entry.text}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="lcd-reset-row">
                {!confirmReset ? (
                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={() => setConfirmReset(true)}
                  >
                    重置存档
                  </button>
                ) : (
                  <div className="inline-icon-row">
                    <button
                      type="button"
                      className="lcd-mini-close danger"
                      onClick={() => {
                        setConfirmReset(false);
                        onResetSave();
                      }}
                    >
                      确认清空
                    </button>
                    <button
                      type="button"
                      className="lcd-mini-close"
                      onClick={() => setConfirmReset(false)}
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

    </>
  );
};
