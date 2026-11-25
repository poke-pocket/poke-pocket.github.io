import React, { useMemo, useState } from 'react';
import {
  ACCESSORY_CATALOG,
  FOOD_CATALOG,
  GACHA_BOXES,
  ROOM_CATALOG,
  SPECIES_CATALOG,
  getGrowthStage,
  getIvRank,
  getPokemonCryId,
} from '../data/catalog';
import {
  POKEMON_SKIN_CATALOG,
  ensureFreshMetaProgress,
  type PokemonSkinDef,
} from '../data/metaProgression';
import type {
  AccessoryId,
  FoodId,
  GachaBoxId,
  GameSave,
  PetRecord,
  PetSkinId,
  RoomThemeId,
  SpeciesId,
} from '../types/pet';
import {
  getAccessoryAvailability,
  getBallAvailability,
  getPetIVs,
  type GachaOutcome,
  type GachaTenOutcome,
} from '../utils/petEngine';
import { sound } from '../utils/sound';
import { PixelIcon, PixelItemImg } from './PixelSprite';

interface ShopOverlayProps {
  save: GameSave;
  pet: PetRecord;
  closing: boolean;
  onClose: () => void;
  onBuyFood: (foodId: FoodId) => void;
  onBuyAccessory: (id: AccessoryId) => void;
  onBuyPokeball: (roomId: RoomThemeId) => void;
  onPullGacha: (boxId: GachaBoxId) => GachaOutcome;
  onPullGachaTen: (boxId: GachaBoxId) => GachaTenOutcome;
  onUpdatePetConfig?: (
    petId: string,
    patch: {
      skin?: PetSkinId;
      skinCost?: number;
      unlockSkin?: string;
    },
  ) => boolean;
}

type ShopMainTab = 'skins' | 'gacha' | 'berries' | 'items';
type SkinFilterTab = 'featured' | 'mythic' | 'vanguard' | 'huaxia' | 'celestial' | 'by_species';

function getSkinSpriteSrc(skin: PokemonSkinDef): string {
  const spMeta = SPECIES_CATALOG[skin.showcaseSpecies] ?? SPECIES_CATALOG.pikachu;
  if (skin.usesOfficialShiny) {
    const dexId = getPokemonCryId(skin.showcaseSpecies, skin.showcaseStage === 'adult' ? 40 : 5);
    return `/sprites/pokemon/shiny-animated/${dexId}.gif`;
  }
  return spMeta.stageSprites[skin.showcaseStage]?.animated ?? spMeta.stageSprites.baby.animated;
}

export const ShopOverlay: React.FC<ShopOverlayProps> = ({
  save,
  pet,
  closing,
  onClose,
  onBuyFood,
  onBuyAccessory,
  onBuyPokeball,
  onPullGacha,
  onPullGachaTen,
  onUpdatePetConfig,
}) => {
  const [mainTab, setMainTab] = useState<ShopMainTab>('skins');
  const [skinTab, setSkinTab] = useState<SkinFilterTab>('featured');
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<SpeciesId | 'all'>('all');
  const [inspectSkin, setInspectSkin] = useState<PokemonSkinDef | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Blind box reveal state
  const [gachaSingle, setGachaSingle] = useState<GachaOutcome | null>(null);
  const [gachaTen, setGachaTen] = useState<GachaTenOutcome | null>(null);

  const meta = ensureFreshMetaProgress(save.meta);
  const ownedSkins = useMemo(() => new Set<string>(meta.unlockedSkins ?? ['classic']), [meta.unlockedSkins]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2800);
  };

  // All distinct species lines that have dedicated showcase skins
  const speciesFilterList = useMemo(() => {
    const seen = new Set<SpeciesId>();
    const out: { species: SpeciesId; label: string }[] = [];
    for (const sk of POKEMON_SKIN_CATALOG) {
      if (sk.id === 'classic') continue;
      if (sk.targetSpecies && !seen.has(sk.targetSpecies)) {
        seen.add(sk.targetSpecies);
        const spMeta = SPECIES_CATALOG[sk.targetSpecies];
        out.push({ species: sk.targetSpecies, label: spMeta?.defaultName ?? sk.targetSpecies });
      }
    }
    return out;
  }, []);

  const mythicSkin = POKEMON_SKIN_CATALOG.find((s) => s.collection === 'mythic') ?? POKEMON_SKIN_CATALOG[0];
  const vanguardSkins = POKEMON_SKIN_CATALOG.filter((s) => s.collection === 'vanguard');
  const huaxiaSkins = POKEMON_SKIN_CATALOG.filter((s) => s.collection === 'huaxia');
  const celestialSkins = POKEMON_SKIN_CATALOG.filter((s) => s.collection === 'celestial');

  /** Find best matching owned Pokémon for a given skin (prefers matching species line, falls back to active pet) */
  const findTargetPetForSkin = (sk: PokemonSkinDef): PetRecord | null => {
    if (sk.targetSpecies) {
      const exact = save.pets.find((p) => p.species === sk.targetSpecies);
      if (exact) return exact;
    }
    return pet ?? save.pets[0] ?? null;
  };

  const handleUnlockOrEquipSkin = (sk: PokemonSkinDef, explicitPetId?: string) => {
    const unlocked = sk.priceCoins === 0 || ownedSkins.has(sk.id);
    const targetPet =
      (explicitPetId ? save.pets.find((p) => p.id === explicitPetId) : null) ??
      findTargetPetForSkin(sk);

    if (!unlocked && save.coins < sk.priceCoins) {
      sound.play('error');
      showToast(`金币不足！需要 ${sk.priceCoins} 金币（当前 ${save.coins}）`);
      return;
    }

    if (!targetPet) {
      sound.play('error');
      showToast('球盒中暂无可换装的宝可梦');
      return;
    }

    // If skin is species-specific and player doesn't own that species yet, still allow purchasing & unlocking into collection!
    const ownsMatchingSpecies = !sk.targetSpecies || save.pets.some((p) => p.species === sk.targetSpecies);
    const shouldEquipNow = Boolean(explicitPetId) || ownsMatchingSpecies;

    const ok = onUpdatePetConfig?.(targetPet.id, {
      ...(shouldEquipNow ? { skin: sk.id } : {}),
      ...(unlocked ? {} : { skinCost: sk.priceCoins, unlockSkin: sk.id }),
    });

    if (ok) {
      sound.play(unlocked ? 'confirm' : 'coin');
      if (!unlocked && !shouldEquipNow) {
        showToast(`✨ 已收藏外观「${sk.name}」！收服「${SPECIES_CATALOG[sk.targetSpecies!]?.defaultName}」后即可立即穿戴`);
      } else {
        showToast(`✨ 已为「${targetPet.name}」换上「${sk.name}」！`);
      }
    }
  };

  const renderSkinCard = (sk: PokemonSkinDef, variant: 'vanguard' | 'collection' = 'vanguard') => {
    const unlocked = sk.priceCoins === 0 || ownedSkins.has(sk.id);
    const matchingPets = sk.targetSpecies
      ? save.pets.filter((p) => p.species === sk.targetSpecies)
      : save.pets;
    const equippedCount = matchingPets.filter((p) => (p.skin ?? 'classic') === sk.id).length;
    const spriteSrc = getSkinSpriteSrc(sk);

    return (
      <div
        key={sk.id}
        className={`shop-skin-card is-${variant} ${unlocked ? 'is-owned' : ''}`}
        onClick={() => {
          sound.play('cursor');
          setInspectSkin(sk);
        }}
      >
        <div className="shop-skin-stage" style={{ background: sk.backdropGradient }}>
          <span className="shop-skin-badge" style={{ backgroundColor: sk.rarityColor }}>
            {sk.rarityLabel}
          </span>
          {unlocked && <span className="shop-owned-pill">{equippedCount > 0 ? '穿戴中' : '已拥有'}</span>}
          <img
            src={spriteSrc}
            alt={sk.name}
            className="shop-skin-sprite"
            style={{ filter: sk.cssFilter }}
            draggable={false}
          />
        </div>
        <div className="shop-skin-info">
          <div className="shop-skin-title-row">
            <strong>{sk.name}</strong>
          </div>
          <small className="shop-skin-line">{sk.lineLabel}</small>
          <div className="shop-skin-foot">
            <span className="shop-price-tag">
              <PixelItemImg src="/sprites/items/amulet-coin.png" size={14} />
              <b>{unlocked ? '已解锁' : `${sk.priceCoins}`}</b>
            </span>
            <button
              type="button"
              className={`shop-mini-act ${unlocked ? 'is-equip' : ''}`}
              disabled={!unlocked && save.coins < sk.priceCoins}
              onClick={(e) => {
                e.stopPropagation();
                handleUnlockOrEquipSkin(sk);
              }}
            >
              {equippedCount > 0 ? '已穿戴' : unlocked ? '立即换装' : '购买'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`meta-fullscreen-overlay ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="meta-panel is-shop">
        <header className="meta-head">
          <button type="button" className="pkb-esc-btn" onClick={onClose}>
            <PixelIcon name="arrow_left" size={13} />
            <span>返回</span>
          </button>
          <div className="meta-ribbon is-gold">
            <PixelItemImg src="/sprites/items/amulet-coin.png" size={18} />
            <h2>宝可梦精品商店 · 外观 · 盲盒 · 补给</h2>
          </div>
          <div className="meta-head-right">
            <div className="stardust-pill is-coin-pill" title="当前可用宝可币">
              <PixelItemImg src="/sprites/items/amulet-coin.png" size={18} />
              <strong>{save.coins.toLocaleString()}</strong>
              <small>金币</small>
            </div>
          </div>
        </header>

        <div className="meta-split-shell">
          <nav className="meta-side-rail" aria-label="商店分类">
            <button
              type="button"
              className={`meta-rail-tab ${mainTab === 'skins' ? 'active' : ''}`}
              title="精品外观展厅"
              onClick={() => {
                sound.play('cursor');
                setMainTab('skins');
              }}
            >
              <PixelItemImg src="/sprites/items/light-ball.png" size={30} />
              <em>外观</em>
            </button>
            <button
              type="button"
              className={`meta-rail-tab ${mainTab === 'gacha' ? 'active' : ''}`}
              title="精灵球盲盒"
              onClick={() => {
                sound.play('cursor');
                setMainTab('gacha');
              }}
            >
              <PixelItemImg src="/sprites/items/master-ball.png" size={30} />
              <em>盲盒</em>
            </button>
            <button
              type="button"
              className={`meta-rail-tab ${mainTab === 'berries' ? 'active' : ''}`}
              title="树果与糖果补给"
              onClick={() => {
                sound.play('cursor');
                setMainTab('berries');
              }}
            >
              <PixelItemImg src="/sprites/items/sitrus-berry.png" size={30} />
              <em>树果</em>
            </button>
            <button
              type="button"
              className={`meta-rail-tab ${mainTab === 'items' ? 'active' : ''}`}
              title="携带道具与球舱"
              onClick={() => {
                sound.play('cursor');
                setMainTab('items');
              }}
            >
              <PixelItemImg src="/sprites/items/kings-rock.png" size={30} />
              <em>道具</em>
            </button>
          </nav>

          <div className="meta-body shop-body scroll-y">
            {toast && <div className="shop-toast-bar">{toast}</div>}

            {/* ===================== 1. EDITORIAL SKINS SHOWCASE ===================== */}
            {mainTab === 'skins' && (
              <div className="shop-skins-shell">
                {/* Sub-navigation pills */}
                <div className="shop-subnav-bar">
                  {(
                    [
                      { id: 'featured', label: '精选展厅' },
                      { id: 'mythic', label: `神话 (${POKEMON_SKIN_CATALOG.filter((s) => s.collection === 'mythic').length})` },
                      { id: 'vanguard', label: `先锋 (${vanguardSkins.length})` },
                      { id: 'huaxia', label: `华夏典藏 (${huaxiaSkins.length})` },
                      { id: 'celestial', label: `星辰收藏 (${celestialSkins.length})` },
                      { id: 'by_species', label: '按精灵筛选' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`shop-pill-tab ${skinTab === t.id ? 'active' : ''}`}
                      onClick={() => {
                        sound.play('cursor');
                        setSkinTab(t.id);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Species filter strip when in "按精灵筛选" */}
                {skinTab === 'by_species' && (
                  <div className="shop-species-strip">
                    <button
                      type="button"
                      className={`shop-species-chip ${selectedSpeciesFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setSelectedSpeciesFilter('all')}
                    >
                      全部精灵线
                    </button>
                    {speciesFilterList.map((item) => {
                      const spMeta = SPECIES_CATALOG[item.species];
                      const active = selectedSpeciesFilter === item.species;
                      return (
                        <button
                          key={item.species}
                          type="button"
                          className={`shop-species-chip ${active ? 'active' : ''}`}
                          onClick={() => {
                            sound.play('cursor');
                            setSelectedSpeciesFilter(item.species);
                          }}
                        >
                          <img
                            src={spMeta.stageSprites.baby.animated}
                            alt={item.label}
                            className="shop-species-mini"
                            draggable={false}
                          />
                          <span>{item.label}线</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* HERO MYTHIC SPOTLIGHT BANNER (Shown in Featured & Mythic tabs) */}
                {(skinTab === 'featured' || skinTab === 'mythic') && (() => {
                  const unlocked = ownedSkins.has(mythicSkin.id);
                  const spriteSrc = getSkinSpriteSrc(mythicSkin);
                  return (
                    <section
                      className="shop-hero-banner"
                      style={{ background: mythicSkin.backdropGradient }}
                    >
                      <div className="shop-hero-copy">
                        <div className="shop-hero-tags">
                          <span className="shop-hero-new">新</span>
                          <span className="shop-hero-tier">{mythicSkin.rarityLabel}</span>
                        </div>
                        <h3>{mythicSkin.name}</h3>
                        <p className="shop-hero-line">{mythicSkin.lineLabel}</p>
                        <p className="shop-hero-desc">{mythicSkin.desc}</p>
                        {mythicSkin.highlights && (
                          <ul className="shop-hero-bullets">
                            {mythicSkin.highlights.map((h) => (
                              <li key={h}>✦ {h}</li>
                            ))}
                          </ul>
                        )}
                        <div className="shop-hero-cta-row">
                          <button
                            type="button"
                            className="shop-hero-btn"
                            disabled={!unlocked && save.coins < mythicSkin.priceCoins}
                            onClick={() => handleUnlockOrEquipSkin(mythicSkin)}
                          >
                            {unlocked ? '立即为小火龙线换装' : '立即收藏神话外观'}
                          </button>
                          <button
                            type="button"
                            className="shop-hero-inspect-btn"
                            onClick={() => {
                              sound.play('cursor');
                              setInspectSkin(mythicSkin);
                            }}
                          >
                            在展示柜中查看
                          </button>
                          <span className="shop-hero-price">
                            <PixelItemImg src="/sprites/items/amulet-coin.png" size={18} />
                            <strong>{unlocked ? '已拥有' : `${mythicSkin.priceCoins} 金币`}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="shop-hero-visual">
                        <div className="shop-hero-halo" />
                        <img
                          src={spriteSrc}
                          alt={mythicSkin.name}
                          className="shop-hero-sprite"
                          style={{ filter: mythicSkin.cssFilter }}
                          draggable={false}
                        />
                        <div className="shop-hero-pedestal" />
                      </div>
                    </section>
                  );
                })()}

                {/* VANGUARD 4-COLUMN GALLERY */}
                {(skinTab === 'featured' || skinTab === 'vanguard') && (
                  <section className="shop-section">
                    <div className="shop-section-head">
                      <div>
                        <h4>先锋限定</h4>
                        <small>专属宝可梦进化线定制外观，每款皆有独特视觉风格</small>
                      </div>
                      {skinTab === 'featured' && (
                        <button
                          type="button"
                          className="shop-view-all-btn"
                          onClick={() => setSkinTab('vanguard')}
                        >
                          查看全部先锋 →
                        </button>
                      )}
                    </div>
                    <div className="shop-grid-4">
                      {vanguardSkins.map((sk) => renderSkinCard(sk, 'vanguard'))}
                    </div>
                  </section>
                )}

                {/* HUAXIA EDITORIAL COLLECTION */}
                {(skinTab === 'featured' || skinTab === 'huaxia') && (
                  <section className="shop-section">
                    <div className="shop-section-head">
                      <div>
                        <h4>华夏国风典藏</h4>
                        <small>源自东亚巡礼地标的限定配色，分属皮卡丘 / 妙蛙 / 迷你龙 / 伊布进化线</small>
                      </div>
                      {skinTab === 'featured' && (
                        <button
                          type="button"
                          className="shop-view-all-btn"
                          onClick={() => setSkinTab('huaxia')}
                        >
                          查看华夏典藏 →
                        </button>
                      )}
                    </div>
                    <div className="shop-grid-4">
                      {huaxiaSkins.map((sk) => renderSkinCard(sk, 'collection'))}
                    </div>
                  </section>
                )}

                {/* CELESTIAL COLLECTION */}
                {(skinTab === 'featured' || skinTab === 'celestial') && (
                  <section className="shop-section">
                    <div className="shop-section-head">
                      <div>
                        <h4>星辰收藏 · 异色光辉</h4>
                        <small>梦幻绯樱与全图鉴官方异色闪光形态</small>
                      </div>
                    </div>
                    <div className="shop-grid-2">
                      {celestialSkins.map((sk) => renderSkinCard(sk, 'collection'))}
                    </div>
                  </section>
                )}

                {/* FILTERED BY SPECIES */}
                {skinTab === 'by_species' && (
                  <section className="shop-section">
                    <div className="shop-grid-4">
                      {POKEMON_SKIN_CATALOG.filter(
                        (s) =>
                          s.id !== 'classic' &&
                          (selectedSpeciesFilter === 'all' ||
                            s.targetSpecies === selectedSpeciesFilter ||
                            !s.targetSpecies),
                      ).map((sk) => renderSkinCard(sk, 'vanguard'))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ===================== 2. FULL-SCREEN BLIND BOX HALL ===================== */}
            {mainTab === 'gacha' && (
              <div className="shop-gacha-shell">
                <div className="shop-section-head">
                  <div>
                    <h4>精灵球盲盒展厅</h4>
                    <small>开启高稀有度球盒结识新伙伴，重复种族仍可获得极品性格与 S/SS 资质</small>
                  </div>
                </div>
                <div className="shop-gacha-grid">
                  {GACHA_BOXES.map((box) => {
                    const tenPrice = box.tenPrice;
                    return (
                      <div key={box.id} className="shop-gacha-card">
                        <div className="shop-gacha-head">
                          <PixelItemImg src={box.ballSprite} size={40} />
                          <div>
                            <strong>{box.name}</strong>
                            <small>{box.badge}</small>
                          </div>
                        </div>
                        <div className="shop-gacha-rates">
                          <span>{box.description}</span>
                        </div>
                        <div className="shop-gacha-actions">
                          <button
                            type="button"
                            className="shop-gacha-btn"
                            disabled={save.coins < box.price}
                            onClick={() => {
                              const res = onPullGacha(box.id);
                              setGachaTen(null);
                              setGachaSingle(res);
                              if (!res.ok) showToast(res.message);
                            }}
                          >
                            单抽 · {box.price} 币
                          </button>
                          <button
                            type="button"
                            className="shop-gacha-btn is-ten"
                            disabled={save.coins < tenPrice}
                            onClick={() => {
                              const res = onPullGachaTen(box.id);
                              setGachaSingle(null);
                              setGachaTen(res);
                              if (!res.ok) showToast(res.message);
                            }}
                          >
                            十连 (9折) · {tenPrice} 币
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {gachaSingle && gachaSingle.ok && gachaSingle.pulledSpecies && (
                  <div className="shop-gacha-result">
                    <div className="shop-gacha-result-head">
                      <strong>🎉 盲盒开启结果</strong>
                      <span>{gachaSingle.message}</span>
                    </div>
                    <div className="shop-gacha-pull-row">
                      <div className="shop-gacha-pull-chip">
                        <img
                          src={SPECIES_CATALOG[gachaSingle.pulledSpecies].stageSprites.baby.animated}
                          alt={gachaSingle.pulledSpecies}
                          draggable={false}
                        />
                        <strong>{gachaSingle.pulledPet?.name ?? SPECIES_CATALOG[gachaSingle.pulledSpecies].defaultName}</strong>
                        {gachaSingle.pulledPet && (
                          <em>{getIvRank(getPetIVs(gachaSingle.pulledPet))}级</em>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {gachaTen && gachaTen.ok && gachaTen.results && (
                  <div className="shop-gacha-result">
                    <div className="shop-gacha-result-head">
                      <strong>🎉 十连盲盒开启结果</strong>
                      <span>{gachaTen.message}</span>
                    </div>
                    <div className="shop-gacha-pull-row">
                      {gachaTen.results.map((pull, idx) => (
                        <div key={`${pull.species}_${idx}`} className="shop-gacha-pull-chip">
                          <img
                            src={SPECIES_CATALOG[pull.species].stageSprites.baby.animated}
                            alt={pull.species}
                            draggable={false}
                          />
                          <strong>{SPECIES_CATALOG[pull.species].defaultName}</strong>
                          <em>{pull.ivRank ? `${pull.ivRank}级` : pull.isNewDex ? 'NEW!' : '已入盒'}</em>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===================== 3. BERRIES & RARE CANDY ===================== */}
            {mainTab === 'berries' && (
              <div className="shop-section">
                <div className="shop-section-head">
                  <div>
                    <h4>树果与养成补给</h4>
                    <small>喂食最爱树果可大幅提升亲密等级，神奇糖果可直接升级</small>
                  </div>
                </div>
                <div className="shop-item-grid">
                  {FOOD_CATALOG.filter((f) => !f.unlimited).map((f) => {
                    const qty = save.inventory[f.id] ?? 0;
                    return (
                      <div key={f.id} className="shop-item-card">
                        <div className="shop-item-icon">
                          <PixelItemImg src={f.itemSprite} size={34} />
                          <em className="shop-item-qty">拥 {qty}</em>
                        </div>
                        <div className="shop-item-meta">
                          <strong>{f.name}</strong>
                          <small>
                            {f.levelUp
                              ? '食用直接升 1 级'
                              : `饱食+${f.hunger} · 亲密+${f.happiness} · EXP+${f.xp}`}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="shop-buy-btn"
                          disabled={save.coins < f.price}
                          onClick={() => {
                            onBuyFood(f.id);
                            showToast(`已购入 ${f.name} ×1`);
                          }}
                        >
                          {f.price} 币
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===================== 4. HELD ACCESSORIES & POKEBALL ROOMS ===================== */}
            {mainTab === 'items' && (
              <div className="shop-section">
                <div className="shop-section-head">
                  <div>
                    <h4>携带道具</h4>
                    <small>购买后可在「背包」或「精灵详情」中分配给任意出战伙伴</small>
                  </div>
                </div>
                <div className="shop-item-grid">
                  {ACCESSORY_CATALOG.filter((a) => a.id !== 'none').map((acc) => {
                    const avail = getAccessoryAvailability(save, acc.id);
                    return (
                      <div key={acc.id} className="shop-item-card">
                        <div className="shop-item-icon">
                          <PixelItemImg src={acc.itemSprite} size={34} />
                          <em className="shop-item-qty">余 {avail.available}/{avail.total}</em>
                        </div>
                        <div className="shop-item-meta">
                          <strong>{acc.name}</strong>
                          <small>{acc.description}</small>
                        </div>
                        <button
                          type="button"
                          className="shop-buy-btn"
                          disabled={save.coins < acc.price}
                          onClick={() => {
                            onBuyAccessory(acc.id);
                            showToast(`已购入道具「${acc.name}」`);
                          }}
                        >
                          {acc.price} 币
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="shop-section-head" style={{ marginTop: 18 }}>
                  <div>
                    <h4>主题精灵球舱</h4>
                    <small>更换伙伴的专属居住球舱，带来独立属性与视觉主题</small>
                  </div>
                </div>
                <div className="shop-item-grid">
                  {ROOM_CATALOG.filter((r) => r.id !== 'pokeball_room').map((rm) => {
                    const avail = getBallAvailability(save, rm.id);
                    return (
                      <div key={rm.id} className="shop-item-card">
                        <div className="shop-item-icon">
                          <PixelItemImg src={rm.ballSprite} size={34} />
                          <em className="shop-item-qty">余 {avail.available}/{avail.total}</em>
                        </div>
                        <div className="shop-item-meta">
                          <strong>{rm.name}</strong>
                          <small>{rm.description}</small>
                        </div>
                        <button
                          type="button"
                          className="shop-buy-btn"
                          disabled={save.coins < rm.price}
                          onClick={() => {
                            onBuyPokeball(rm.id);
                            showToast(`已购入「${rm.shortName}」`);
                          }}
                        >
                          {rm.price} 币
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SHOWCASE INSPECT MODAL (Choose which matching Pokémon equips this skin!) */}
        {inspectSkin && (() => {
          const unlocked = inspectSkin.priceCoins === 0 || ownedSkins.has(inspectSkin.id);
          const eligiblePets = inspectSkin.targetSpecies
            ? save.pets.filter((p) => p.species === inspectSkin.targetSpecies)
            : save.pets;
          const spriteSrc = getSkinSpriteSrc(inspectSkin);
          return (
            <div
              className="shop-inspect-backdrop"
              onClick={() => setInspectSkin(null)}
            >
              <div
                className="shop-inspect-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shop-inspect-stage" style={{ background: inspectSkin.backdropGradient }}>
                  <span className="shop-skin-badge" style={{ backgroundColor: inspectSkin.rarityColor }}>
                    {inspectSkin.rarityLabel}
                  </span>
                  <img
                    src={spriteSrc}
                    alt={inspectSkin.name}
                    className="shop-inspect-sprite"
                    style={{ filter: inspectSkin.cssFilter }}
                    draggable={false}
                  />
                </div>
                <div className="shop-inspect-body">
                  <h3>{inspectSkin.name}</h3>
                  <p className="shop-inspect-line">{inspectSkin.lineLabel}</p>
                  <p className="shop-inspect-desc">{inspectSkin.desc}</p>

                  {eligiblePets.length > 0 ? (
                    <div className="shop-inspect-pets">
                      <small>选择球盒中的适配伙伴立即穿戴：</small>
                      <div className="shop-inspect-pet-list">
                        {eligiblePets.map((ep) => {
                          const wearing = (ep.skin ?? 'classic') === inspectSkin.id;
                          const st = getGrowthStage(ep.level, ep.species);
                          return (
                            <button
                              key={ep.id}
                              type="button"
                              className={`shop-pet-equip-chip ${wearing ? 'active' : ''}`}
                              disabled={!unlocked && save.coins < inspectSkin.priceCoins}
                              onClick={() => handleUnlockOrEquipSkin(inspectSkin, ep.id)}
                            >
                              <img
                                src={SPECIES_CATALOG[ep.species].stageSprites[st].animated}
                                alt={ep.name}
                                draggable={false}
                              />
                              <span>
                                {ep.name} Lv.{ep.level} {wearing ? '✓' : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="shop-inspect-empty">
                      球盒中暂未拥有「{SPECIES_CATALOG[inspectSkin.targetSpecies!]?.defaultName}」，
                      {unlocked ? '已永久收藏，收服后即可直接穿戴！' : '可先行优惠收藏，收服对应进化线后即可穿戴！'}
                    </div>
                  )}

                  <div className="shop-inspect-foot">
                    {!unlocked && (
                      <button
                        type="button"
                        className="shop-hero-btn"
                        disabled={save.coins < inspectSkin.priceCoins}
                        onClick={() => handleUnlockOrEquipSkin(inspectSkin)}
                      >
                        {inspectSkin.priceCoins} 金币解锁收藏
                      </button>
                    )}
                    <button
                      type="button"
                      className="pkb-esc-btn"
                      onClick={() => setInspectSkin(null)}
                    >
                      关闭展示柜
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
