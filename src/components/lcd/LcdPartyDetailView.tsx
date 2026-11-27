import type { LcdSharedCtx } from './lcdViewTypes';
import React, { useState } from 'react';
import { ACCESSORY_CATALOG, FOOD_CATALOG, NATURE_CATALOG, ROOM_CATALOG, SPECIES_CATALOG, TALENT_CATALOG, getGrowthStage, getIvRank, getNextEvolutionHint, getPokemonCryId, getPokemonDexNo, getPokemonStageName, getXpForNextLevel } from '../../data/catalog';
import { BOND_MILESTONES, POKEMON_SKIN_CATALOG, SPECIES_MEGA_FORMS, computePetBondBonuses, ensureFreshMetaProgress, getSkinDef } from '../../data/metaProgression';
import { ALL_SURVIVOR_SKILL_IDS, SURVIVOR_SKILLS, type SurvivorSkillId } from '../../data/survivorsTactics';
import { isDevVirtualPetId } from '../../utils/devMode';
import { MAX_BOND_LEVEL, MAX_PET_SLOTS, getAccessoryAvailability, getBallAvailability, getPetBondInfo, getPetIVs, getPetNature, getPetTalent, getReleaseReward } from '../../utils/petEngine';
import { sound } from '../../utils/sound';
import { PixelIcon, PixelItemImg, PixelPetPortrait } from '../PixelSprite';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LcdPartyDetailView: React.FC<{ ctx: LcdSharedCtx }> = ({ ctx }) => {
  const { STAT_BAR_ROWS, confirmReleaseId, mode, onAssignPetRoom, onDepositPet, onEquipAccessory, onGoBack, onHealPet, onNavigateMode, onQuickCarePet, onReleasePet, onReleaseStoredPet, onSwitchPet, onUpdatePetConfig, onWithdrawPet, openedFromBattle, partyDetailIsStored, partyDetailPet, partyDetailTab, pet, petActionMenuOpen, save, setConfirmReleaseId, setPartyDetailTab, setPetActionMenuOpen } = ctx;
  const [quickFeedOpen, setQuickFeedOpen] = useState(false);
  const [careToast, setCareToast] = useState<string | null>(null);
  const flashCareToast = (msg: string) => {
    setCareToast(msg);
    window.setTimeout(() => {
      setCareToast((cur) => (cur === msg ? null : cur));
    }, 2200);
  };
  return (
    <>
        {/* PARTY 2ND-LEVEL DETAIL (Actions moved cleanly to top-right with icons + secondary dropdown!) */}
        {mode === 'party_detail' && (() => {
          const p = partyDetailPet;
          const isStored = partyDetailIsStored;
          const st = getGrowthStage(p.level, p.species);
          const meta = SPECIES_CATALOG[p.species];
          const pDex = getPokemonDexNo(p.species, p.level);
          const formName = getPokemonStageName(p.species, p.level);
          const bond = getPetBondInfo(p);
          const evoHint = bond.evoBlockedByBond
            ? `🔒 需亲密 Lv.${bond.evoBlockedByBond.requiredBondLv} 进化为${bond.evoBlockedByBond.nextFormName}`
            : getNextEvolutionHint(p.species, p.level);
          const isCur = !isStored && p.id === pet.id;
          const pXpNeed = getXpForNextLevel(p.level);
          const pXpPct = Math.min(100, Math.round((p.xp / pXpNeed) * 100));
          const natureMeta = NATURE_CATALOG[getPetNature(p)];
          const talentMeta = TALENT_CATALOG[getPetTalent(p)];
          const ivs = getPetIVs(p);
          const ivRank = getIvRank(ivs);
          const relReward = getReleaseReward(p);
          const favFoodMeta =
            FOOD_CATALOG.find((f) => f.id === meta.favoriteFood) ?? FOOD_CATALOG[0];
          const curAccMeta =
            ACCESSORY_CATALOG.find((a) => a.id === p.accessory) ?? ACCESSORY_CATALOG[0];
          const isVirtualPet = isDevVirtualPetId(p.id);
          const realBoxCount = save.pets.filter((x) => !isDevVirtualPetId(x.id)).length;
          const canHeal = !isStored && (p.isSick || p.health < 100);
          const canBath = !isStored && !p.isSleeping && (p.cleanliness < 100 || p.poopCount > 0);
          const canPat = !isStored && !p.isSleeping && !(bond.level >= MAX_BOND_LEVEL && p.happiness >= 100);
          const availableFoods = FOOD_CATALOG.filter(
            (f) => f.unlimited || (save.inventory[f.id] ?? 0) > 0,
          );

          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <span className="inline-icon-row">
                  <PixelItemImg src="/sprites/items/poke-ball.png" size={14} />
                  <span>{p.name}</span>
                  {isVirtualPet && <em className="dev-pet-chip">调试</em>}
                </span>
                {/* Top-Right Pokémon Actions: Status/Lead + Quick Care (Feed/Heal/Bath/Pat) + More + Back */}
                <div className="lcd-head-actions detail-top-actions">
                  {isStored ? (
                    <button
                      type="button"
                      className="lcd-subtab detail-act-btn is-primary"
                      disabled={Boolean(openedFromBattle) || realBoxCount >= MAX_PET_SLOTS}
                      onClick={() => {
                        setPetActionMenuOpen(false);
                        setQuickFeedOpen(false);
                        if (onWithdrawPet?.(p.id)) {
                          onNavigateMode('party');
                        }
                      }}
                      title={
                        openedFromBattle
                          ? '战斗进行中无法取出'
                          : realBoxCount >= MAX_PET_SLOTS
                            ? `随身球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})`
                            : `将 ${p.name} 放回随身球盒`
                      }
                    >
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={12} />
                      <span>{openedFromBattle ? '战后可取' : realBoxCount >= MAX_PET_SLOTS ? '球盒满' : '放回球盒'}</span>
                    </button>
                  ) : isCur ? (
                    <span className="cur-ball-pill" title="当前正在球舱与队列首位的宝可梦">
                      <PixelIcon name="star" size={10} />
                      <span>当前</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="lcd-subtab detail-act-btn is-primary"
                      onClick={() => {
                        setPetActionMenuOpen(false);
                        setQuickFeedOpen(false);
                        onSwitchPet(p.id);
                      }}
                      title={`将 ${p.name} 设为当前主力宝可梦`}
                    >
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={12} />
                      <span>出战</span>
                    </button>
                  )}

                  {/* Quick Feed Berry Dropdown (In-place quick feeding for ANY inspected Pokémon!) */}
                  {!isStored && (
                    <div className="detail-more-wrap">
                      <button
                        type="button"
                        className={`lcd-subtab detail-icon-only-btn ${quickFeedOpen ? 'active' : p.hunger < 80 ? 'is-feed-ready' : ''}`}
                        disabled={p.isSleeping}
                        onClick={() => {
                          setPetActionMenuOpen(false);
                          sound.play('cursor');
                          setQuickFeedOpen((o) => !o);
                        }}
                        title={p.isSleeping ? '睡眠中无法喂食' : `快速喂食树果（当前饱食 ${Math.round(p.hunger)}%）`}
                        aria-label="快速喂食"
                      >
                        <PixelItemImg src="/sprites/items/oran-berry.png" size={13} />
                      </button>
                      {quickFeedOpen && (
                        <div className="detail-action-dropdown detail-feed-popover">
                          <div className="detail-feed-head">
                            <span>快速喂食 · 饱食 {Math.round(p.hunger)}%</span>
                          </div>
                          {availableFoods.map((food) => {
                            const isFav = meta.favoriteFood === food.id;
                            const stockLabel = food.unlimited ? '∞' : `×${save.inventory[food.id] ?? 0}`;
                            const canEat =
                              !p.isSleeping &&
                              (Boolean(food.levelUp && p.level < 100) ||
                                Boolean(food.curesSick && p.isSick) ||
                                Boolean(food.health && p.health < 100) ||
                                p.hunger < 100);
                            return (
                              <button
                                key={food.id}
                                type="button"
                                className={`detail-dd-item ${isFav ? 'is-fav-food' : ''}`}
                                disabled={!canEat}
                                onClick={() => {
                                  const res = onQuickCarePet?.(p.id, 'feed', food.id);
                                  if (res?.message) flashCareToast(res.message);
                                }}
                                title={food.description}
                              >
                                <PixelItemImg src={food.itemSprite} size={14} />
                                <span className="detail-food-name">
                                  {food.name}
                                  {isFav ? ' ★' : ''}
                                </span>
                                <em className="detail-food-qty">{stockLabel}</em>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Heal Potion (Works on ANY inspected Pokémon in-place!) */}
                  {!isStored && (
                    <button
                      type="button"
                      className={`lcd-subtab detail-icon-only-btn ${canHeal ? 'is-heal-ready' : ''}`}
                      disabled={!canHeal}
                      onClick={() => {
                        setPetActionMenuOpen(false);
                        setQuickFeedOpen(false);
                        if (onQuickCarePet) {
                          const res = onQuickCarePet(p.id, 'heal');
                          if (res?.message) flashCareToast(res.message);
                        } else {
                          onHealPet();
                        }
                      }}
                      title={canHeal ? `给 ${p.name} 使用伤药回满 HP 并治愈生病` : `${p.name} 当前 HP 已满`}
                      aria-label="使用伤药"
                    >
                      <PixelItemImg src="/sprites/items/potion.png" size={13} />
                    </button>
                  )}

                  {/* Quick Bath / Clean */}
                  {!isStored && (
                    <button
                      type="button"
                      className={`lcd-subtab detail-icon-only-btn ${canBath ? 'is-bath-ready' : ''}`}
                      disabled={!canBath}
                      onClick={() => {
                        setPetActionMenuOpen(false);
                        setQuickFeedOpen(false);
                        const res = onQuickCarePet?.(p.id, 'bath');
                        if (res?.message) flashCareToast(res.message);
                      }}
                      title={canBath ? `给 ${p.name} 快速洗澡清理（当前清洁 ${Math.round(p.cleanliness)}%）` : `${p.name} 已经干干净净啦`}
                      aria-label="快速洗澡"
                    >
                      <PixelItemImg src="/sprites/items/fresh-water.png" size={13} />
                    </button>
                  )}

                  {/* Quick Pat / Bond */}
                  {!isStored && (
                    <button
                      type="button"
                      className={`lcd-subtab detail-icon-only-btn ${canPat ? 'is-pat-ready' : ''}`}
                      disabled={!canPat}
                      onClick={() => {
                        setPetActionMenuOpen(false);
                        setQuickFeedOpen(false);
                        const res = onQuickCarePet?.(p.id, 'pat');
                        if (res?.message) flashCareToast(res.message);
                      }}
                      title={canPat ? `抚摸 ${p.name} 提升亲密度与心情` : `${p.name} 亲密度已达满级`}
                      aria-label="快速抚摸"
                    >
                      <PixelIcon name="heart" size={11} />
                    </button>
                  )}

                  {/* Secondary Dropdown Menu for Infrequent Actions (Care Room / Cry / Deposit / Release) */}
                  <div className="detail-more-wrap">
                    <button
                      type="button"
                      className={`lcd-subtab detail-icon-only-btn ${petActionMenuOpen ? 'active' : ''}`}
                      onClick={() => {
                        setQuickFeedOpen(false);
                        setConfirmReleaseId(null);
                        setPetActionMenuOpen((o) => !o);
                      }}
                      title="更多操作（进球舱 / 寄存 / 放生）"
                      aria-label="更多操作"
                    >
                      <PixelIcon name="menu" size={11} />
                    </button>
                    {petActionMenuOpen && (
                      <div className="detail-action-dropdown">
                        {!isStored && (
                          <button
                            type="button"
                            className="detail-dd-item"
                            onClick={() => {
                              setPetActionMenuOpen(false);
                              if (!isCur) onSwitchPet(p.id);
                              onNavigateMode('home');
                            }}
                          >
                            <PixelIcon name="house" size={11} />
                            <span>进球舱照顾</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="detail-dd-item"
                          onClick={() => {
                            sound.playCry(getPokemonCryId(p.species, p.level));
                            setPetActionMenuOpen(false);
                          }}
                        >
                          <PixelIcon name="sound_on" size={11} />
                          <span>播放叫声</span>
                        </button>
                        {!isStored && !isVirtualPet && realBoxCount > 1 && onDepositPet && (
                          <button
                            type="button"
                            className="detail-dd-item"
                            disabled={Boolean(openedFromBattle)}
                            title={openedFromBattle ? '战斗进行中不可寄存，请等本局结束后再寄存' : '寄存至大木博士寄放箱，释放随身球盒名额'}
                            onClick={() => {
                              setPetActionMenuOpen(false);
                              if (onDepositPet(p.id)) {
                                onNavigateMode('party');
                              }
                            }}
                          >
                            <span>📦</span>
                            <span>{openedFromBattle ? '寄存 (战后开放)' : '寄存到大木处'}</span>
                          </button>
                        )}
                        {!isVirtualPet && (isStored || realBoxCount > 1) &&
                          (confirmReleaseId === p.id ? (
                            <button
                              type="button"
                              className="detail-dd-item is-danger-confirm"
                              onClick={() => {
                                setConfirmReleaseId(null);
                                setPetActionMenuOpen(false);
                                const ok = isStored
                                  ? onReleaseStoredPet?.(p.id)
                                  : onReleasePet(p.id);
                                if (ok) {
                                  onNavigateMode('party');
                                }
                              }}
                            >
                              <PixelIcon name="coin" size={11} />
                              <span>确认放生 (+{relReward.coins})</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="detail-dd-item is-danger"
                              onClick={() => setConfirmReleaseId(p.id)}
                              title={`放生返还 +${relReward.coins} 金币与 +${relReward.xp} EXP`}
                            >
                              <PixelIcon name="paw" size={11} />
                              <span>放生伙伴</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={() => {
                      sound.play('cancel');
                      setPetActionMenuOpen(false);
                      setQuickFeedOpen(false);
                      onGoBack();
                    }}
                  >
                    返回
                  </button>
                </div>
              </div>

              {careToast && <div className="detail-care-toast">{careToast}</div>}

              <div className="detail-stack">
                  {/* Top Hero Card: Square Headshot + Summary + Embedded Pokeball Strip */}
                  <div className="lcd-detail-hero-card">
                    <div className="hero-card-main">
                      <div className="dex-sprite-box square">
                        <PixelPetPortrait species={p.species} stage={st} size={50} />
                      </div>
                      <div className="lcd-dex-meta">
                        <div className="inline-icon-row">
                          <strong>{p.name}</strong>
                          <span
                            className="poke-type-pill mini"
                            style={{ backgroundColor: meta.typeColor }}
                          >
                            <PixelIcon name={meta.typeIcon} size={9} />
                            <span>{meta.typeLabel}</span>
                          </span>
                          <span className={`iv-rank-pill mini iv-${ivRank}`}>{ivRank}</span>
                          <button
                            type="button"
                            className="cry-play-btn"
                            onClick={() => sound.playCry(getPokemonCryId(p.species, p.level))}
                            title={`播放「${p.name}」的叫声`}
                            aria-label="播放叫声"
                          >
                            <PixelIcon name="sound_on" size={11} />
                          </button>
                          <span className="dex-lv-inline">Lv.{p.level}</span>
                        </div>
                        <small>
                          {pDex} {formName} · {evoHint}
                        </small>
                        <div className="lcd-mini-xp">
                          <span>EXP {p.xp}/{pXpNeed}</span>
                          <div className="gba-exp-track">
                            <div className="gba-exp-fill" style={{ width: `${pXpPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="hero-card-ball-strip">
                      <span className="ball-bar-lbl">精灵球:</span>
                      <div className="ball-chip-row">
                        {ROOM_CATALOG.map((rm) => {
                          const assigned = (p.ballRoom ?? 'pokeball_room') === rm.id;
                          const avail = getBallAvailability(save, rm.id);
                          const canSelect = assigned || rm.id === 'pokeball_room' || avail.available > 0;
                          return (
                            <button
                              key={rm.id}
                              type="button"
                              disabled={!canSelect}
                              className={`ball-chip ${assigned ? 'active' : ''}`}
                              onClick={() => onAssignPetRoom(p.id, rm.id)}
                              title={
                                canSelect
                                  ? `切换为 ${rm.name}`
                                  : `无空闲${rm.shortName}（余0），请去市场购买`
                              }
                            >
                              <PixelItemImg src={rm.ballSprite} size={14} />
                              <span>{rm.shortName}</span>
                              <em className="chip-qty">
                                {rm.id === 'pokeball_room' ? '∞' : `×${avail.available}`}
                              </em>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Detail Tabs Below Hero Card */}
                  <div className="detail-tabs-row">
                    <div className="lcd-subtabs">
                      <button
                        type="button"
                        className={`lcd-subtab inline-icon-btn ${partyDetailTab === 'stats' ? 'active' : ''}`}
                        onClick={() => setPartyDetailTab('stats')}
                      >
                        <PixelIcon name="heart" size={12} />
                        <span>状态数值</span>
                      </button>
                      <button
                        type="button"
                        className={`lcd-subtab inline-icon-btn ${partyDetailTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setPartyDetailTab('profile')}
                      >
                        <PixelIcon name="star" size={12} />
                        <span>性格档案</span>
                      </button>
                      <button
                        type="button"
                        className={`lcd-subtab inline-icon-btn ${partyDetailTab === 'gear' ? 'active' : ''}`}
                        onClick={() => setPartyDetailTab('gear')}
                      >
                        <PixelItemImg src="/sprites/items/kings-rock.png" size={13} />
                        <span>携带道具</span>
                      </button>
                      <button
                        type="button"
                        className={`lcd-subtab inline-icon-btn ${partyDetailTab === 'train' ? 'active' : ''}`}
                        onClick={() => setPartyDetailTab('train')}
                      >
                        <PixelIcon name="sword" size={12} />
                        <span>强化招式</span>
                      </button>
                      <button
                        type="button"
                        className={`lcd-subtab inline-icon-btn ${partyDetailTab === 'bond_mega' ? 'active' : ''}`}
                        onClick={() => setPartyDetailTab('bond_mega')}
                      >
                        <PixelIcon name="sparkle" size={12} />
                        <span>亲密·外观</span>
                      </button>
                    </div>
                  </div>

                  {partyDetailTab === 'bond_mega' && (() => {
                    const bondInfo = computePetBondBonuses(bond.bondScore100);
                    const megaDef = SPECIES_MEGA_FORMS[p.species] ?? SPECIES_MEGA_FORMS.pikachu;
                    const curMeta = ensureFreshMetaProgress(save.meta);
                    const ownedSkins = new Set(curMeta.unlockedSkins ?? ['classic']);
                    const pDexId = getPokemonCryId(p.species, p.level);
                    const curSkin = getSkinDef(p.skin);
                    return (
                      <div className="bond-mega-wrap scroll-y">
                        {/* 1. Bond Progress & Mega Evolution Banner */}
                        <div className="bond-hero-banner">
                          <div className="bond-heart-badge">
                            <PixelIcon name="heart" size={14} />
                            <strong>Lv.{bond.level}/{MAX_BOND_LEVEL}</strong>
                          </div>
                          <div className="bond-hero-meta">
                            <div className="inline-icon-row">
                              <strong>
                                与{p.name}的亲密 Lv.{bond.level} ({bond.level >= MAX_BOND_LEVEL ? 'MAX' : `${bond.progressPct}%`})
                              </strong>
                              <span
                                className="mega-status-pill"
                                style={{ backgroundColor: bondInfo.megaUnlocked ? megaDef.auraColor : '#868e96' }}
                              >
                                {bondInfo.megaUnlocked ? `★ ${megaDef.formName} 已解锁` : `Lv.5 解锁 ${megaDef.badgeLabel}`}
                              </span>
                            </div>
                            <small>
                              {bond.xpMultLabel} · Lv.2 解锁一阶进化 · Lv.4 解锁最终进化
                            </small>
                            <div className="gba-exp-track">
                              <div className="gba-exp-fill" style={{ width: `${bond.progressPct}%`, background: '#f06595' }} />
                            </div>
                          </div>
                        </div>

                        {/* 2. Bond Milestone Ladder (Lv.2 -> Lv.10) */}
                        <div className="bond-section-title">亲密度等级奖励</div>
                        <div className="bond-ladder-grid">
                          {BOND_MILESTONES.map((m) => {
                            const reached = bond.level >= m.level;
                            return (
                              <div key={m.level} className={`bond-ms-card ${reached ? 'is-reached' : ''}`}>
                                <div className="bond-ms-head">
                                  <b>Lv.{m.level}</b>
                                  <span>{m.title}</span>
                                  {reached && <em>✓</em>}
                                </div>
                                <small>{m.perkText}</small>
                              </div>
                            );
                          })}
                        </div>

                        {/* 3. Shiny & Mythic Skin Wardrobe */}
                        <div className="bond-section-title">异色与外观皮肤（当前：{curSkin.name}）</div>
                        <div className="skin-wardrobe-grid is-compact">
                          {POKEMON_SKIN_CATALOG.map((sk) => {
                            const owned = sk.priceCoins === 0 || ownedSkins.has(sk.id);
                            const eq = (p.skin ?? 'classic') === sk.id;
                            const sSrc = sk.usesOfficialShiny
                              ? `/sprites/pokemon/shiny-animated/${pDexId}.gif`
                              : meta.stageSprites[st].animated;
                            return (
                              <button
                                key={sk.id}
                                type="button"
                                className={`skin-mini-tile ${eq ? 'is-equipped' : ''}`}
                                disabled={!owned && save.coins < sk.priceCoins}
                                onClick={() => {
                                  if (owned) {
                                    onUpdatePetConfig?.(p.id, { skin: sk.id });
                                  } else {
                                    onUpdatePetConfig?.(p.id, {
                                      skin: sk.id,
                                      skinCost: sk.priceCoins,
                                      unlockSkin: sk.id,
                                    });
                                  }
                                }}
                                title={`${sk.name} · ${sk.desc}`}
                              >
                                <span className="skin-rarity-tag" style={{ backgroundColor: sk.rarityColor }}>
                                  {sk.rarityLabel}
                                </span>
                                <img
                                  src={sSrc}
                                  alt={sk.name}
                                  style={{ filter: sk.cssFilter }}
                                  className="skin-mini-img"
                                  draggable={false}
                                />
                                <strong>{sk.name}</strong>
                                <small>{eq ? '✓ 穿戴中' : owned ? '点击换装' : `${sk.priceCoins} 金币`}</small>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {partyDetailTab === 'stats' && (
                    <div className="lcd-bars-grid">
                      {STAT_BAR_ROWS.map((row) => {
                        const isBond = row.key === 'happiness';
                        const valPct = isBond ? bond.progressPct : p[row.key];
                        const barColor = isBond
                          ? bond.level <= 1
                            ? '#ff6b6b'
                            : row.color
                          : p[row.key] < 25
                            ? '#ff4d6d'
                            : row.color;
                        return (
                          <div key={row.key} className="lcd-bar-cell">
                            <div className="lcd-bar-head">
                              <span className="inline-icon-row">
                                <PixelIcon name={row.icon} size={11} />
                                <span>{isBond ? `亲密 Lv.${bond.level}` : row.label}</span>
                              </span>
                              <strong>{isBond && bond.level >= MAX_BOND_LEVEL ? 'MAX' : `${valPct}%`}</strong>
                            </div>
                            <div className="lcd-bar-track">
                              <div
                                className="lcd-bar-fill"
                                style={{
                                  width: `${valPct}%`,
                                  backgroundColor: barColor,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="lcd-bar-cell meta-cell">
                        <div className="detail-stat-note">
                          <PixelIcon name="sparkle" size={11} />
                          <span>
                            {bond.xpMultLabel} · 性格 {natureMeta.name} · 资质 {ivRank}
                            {bond.evoBlockedByBond ? ` · 🔒进化需亲密Lv.${bond.evoBlockedByBond.requiredBondLv}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {partyDetailTab === 'profile' && (
                    <div className="detail-profile-panel">
                      <div className="profile-kv-grid">
                        <div className="profile-kv-box">
                          <span>性格</span>
                          <strong>{natureMeta.name}</strong>
                          <small>{natureMeta.perk}</small>
                        </div>
                        <div className="profile-kv-box">
                          <span>个体天分</span>
                          <div className="inline-icon-row">
                            <span
                              className="talent-chip"
                              style={{ backgroundColor: talentMeta.color }}
                            >
                              {talentMeta.name}
                            </span>
                          </div>
                          <small>{talentMeta.perk}</small>
                        </div>
                        <div className="profile-kv-box">
                          <span>个体资质 ({ivRank}级)</span>
                          <div className="profile-iv-line">
                            <span>攻{ivs.atk}</span>
                            <span>防{ivs.def}</span>
                            <span>速{ivs.spd}</span>
                            <span>魅{ivs.charm}</span>
                          </div>
                        </div>
                        <div className="profile-kv-box">
                          <span>最爱树果 / 道具</span>
                          <div className="inline-icon-row">
                            <PixelItemImg src={favFoodMeta.itemSprite} size={15} />
                            <strong>{favFoodMeta.name}</strong>
                            <PixelItemImg src={curAccMeta.itemSprite} size={15} />
                          </div>
                        </div>
                      </div>
                      <div className="profile-desc-box">
                        {meta.trait} · 喂{p.totalFeeds} 摸{p.totalPats} 洗{p.totalBaths} 训{p.totalPlays}
                      </div>
                    </div>
                  )}

                  {partyDetailTab === 'gear' && (
                    <div className="lcd-grid-3 compact-grid scroll-y">
                      {ACCESSORY_CATALOG.filter(
                        (a) => a.id === 'none' || getAccessoryAvailability(save, a.id).total > 0,
                      ).map((acc) => {
                        const equipped = p.accessory === acc.id;
                        const avail = getAccessoryAvailability(save, acc.id);
                        const noSpare = acc.id !== 'none' && !equipped && avail.available <= 0;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            disabled={noSpare}
                            className={`lcd-grid-tile compact ${equipped ? 'is-selected' : ''}`}
                            onClick={() => onEquipAccessory(p.id, acc.id)}
                            title={acc.description}
                          >
                            {acc.id !== 'none' && (
                              <span className="tile-stock">余{avail.available}</span>
                            )}
                            <PixelItemImg src={acc.itemSprite} size={28} />
                            <strong>{acc.name}</strong>
                            <small>
                              {equipped ? '✓ 携带中' : noSpare ? '已全装备' : '点击携带'}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {partyDetailTab === 'train' && (() => {
                    const enhanceLv = p.enhanceLevel ?? 0;
                    const isMaxEnhance = enhanceLv >= 10;
                    const enhanceCost = 45 + enhanceLv * 35;
                    const canAffordEnhance = !isMaxEnhance && save.coins >= enhanceCost;
                    const maxPins = ivRank === 'SS' || ivRank === 'S' || p.level >= 20 ? 2 : 1;
                    const maxBans = Math.min(
                      5,
                      (ivRank === 'SS' ? 4 : ivRank === 'S' ? 3 : ivRank === 'A' ? 2 : 1) +
                        Math.floor(p.level / 15),
                    );
                    const pinnedSkills = p.pinnedSkills ?? [];
                    const bannedSkills = p.bannedSkills ?? [];

                    const handleTogglePin = (sid: SurvivorSkillId) => {
                      if (!onUpdatePetConfig) return;
                      const isPinned = pinnedSkills.includes(sid);
                      if (isPinned) {
                        onUpdatePetConfig(p.id, {
                          pinnedSkills: pinnedSkills.filter((id) => id !== sid),
                        });
                      } else if (pinnedSkills.length < maxPins) {
                        onUpdatePetConfig(p.id, {
                          pinnedSkills: [...pinnedSkills, sid],
                          bannedSkills: bannedSkills.filter((id) => id !== sid),
                        });
                      }
                    };

                    const handleToggleBan = (sid: SurvivorSkillId) => {
                      if (!onUpdatePetConfig) return;
                      const isBanned = bannedSkills.includes(sid);
                      if (isBanned) {
                        onUpdatePetConfig(p.id, {
                          bannedSkills: bannedSkills.filter((id) => id !== sid),
                        });
                      } else if (bannedSkills.length < maxBans) {
                        onUpdatePetConfig(p.id, {
                          bannedSkills: [...bannedSkills, sid],
                          pinnedSkills: pinnedSkills.filter((id) => id !== sid),
                        });
                      }
                    };

                    return (
                      <div className="train-tab-wrap scroll-y">
                        {/* 1. Direct Pokémon Enhancement Card */}
                        <div className="train-enhance-card">
                          <div className="train-enhance-info">
                            <div className="inline-icon-row">
                              <PixelIcon name="bolt" size={12} />
                              <strong>强化 +{enhanceLv}</strong>
                              <span className="train-tier-cap">/ +10</span>
                            </div>
                            <small>
                              3D 战斗加成：攻 +{enhanceLv * 6}% · 血 +{enhanceLv * 8}%（每级 +6% 攻 / +8% 血）
                            </small>
                          </div>
                          <button
                            type="button"
                            className="train-enhance-btn inline-icon-btn"
                            disabled={!canAffordEnhance || !onUpdatePetConfig}
                            onClick={() =>
                              onUpdatePetConfig?.(p.id, {
                                enhanceCost,
                                enhanceDelta: 1,
                              })
                            }
                            title={
                              isMaxEnhance
                                ? '已达最高强化等级 (+10)'
                                : canAffordEnhance
                                  ? `消耗 ${enhanceCost} 宝可币提升 1 级强化`
                                  : `宝可币不足（需要 ${enhanceCost}，当前 ${save.coins}）`
                            }
                          >
                            {isMaxEnhance ? (
                              <span>已满级</span>
                            ) : (
                              <>
                                <span>金币强化 (+1)</span>
                                <span className="inline-icon-row">
                                  <PixelItemImg src="/sprites/items/amulet-coin.png" size={12} />
                                  <em>{enhanceCost}</em>
                                </span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* 2. Skill Loadout Pool (Pin / Banish) */}
                        <div className="train-pool-head">
                          <span className="inline-icon-row">
                            <PixelIcon name="sword" size={11} />
                            <strong>3D 招式池配置</strong>
                          </span>
                          <small className="train-pool-quota">
                            已锁定 {pinnedSkills.length}/{maxPins} · 已屏蔽 {bannedSkills.length}/{maxBans}
                          </small>
                        </div>
                        <div className="train-skill-grid">
                          {ALL_SURVIVOR_SKILL_IDS.map((sid) => {
                            const sk = SURVIVOR_SKILLS[sid];
                            const isPinned = pinnedSkills.includes(sid);
                            const isBanned = bannedSkills.includes(sid);
                            const pinDisabled = !onUpdatePetConfig || (!isPinned && pinnedSkills.length >= maxPins);
                            const banDisabled = !onUpdatePetConfig || (!isBanned && bannedSkills.length >= maxBans);
                            return (
                              <div
                                key={sid}
                                className={`train-skill-row ${isPinned ? 'is-pinned' : ''} ${isBanned ? 'is-banned' : ''}`}
                                style={{ borderLeftColor: sk.color }}
                                title={`${sk.name}（${sk.tag}）· ${sk.desc}`}
                              >
                                <div className="train-skill-meta">
                                  <PixelItemImg src={sk.sprite} size={22} />
                                  <div className="train-skill-txt">
                                    <strong>{sk.name}</strong>
                                    <span className="sk-tag" style={{ backgroundColor: sk.color }}>
                                      {sk.tag}
                                    </span>
                                  </div>
                                </div>
                                <div className="train-skill-ops">
                                  <button
                                    type="button"
                                    className={`train-op-btn is-pin ${isPinned ? 'active' : ''}`}
                                    disabled={pinDisabled}
                                    onClick={() => handleTogglePin(sid)}
                                    title={isPinned ? '取消锁定' : '锁定招式（3D 冒险必定携带）'}
                                  >
                                    {isPinned ? '已锁定' : '锁定'}
                                  </button>
                                  <button
                                    type="button"
                                    className={`train-op-btn is-ban ${isBanned ? 'active' : ''}`}
                                    disabled={banDisabled}
                                    onClick={() => handleToggleBan(sid)}
                                    title={isBanned ? '取消屏蔽' : '屏蔽招式（排除出 3D 招式池）'}
                                  >
                                    {isBanned ? '已屏蔽' : '屏蔽'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

    </>
  );
};
