import type { LcdSharedCtx } from './lcdViewTypes';
import React from 'react';
import { ACCESSORY_CATALOG, FOOD_CATALOG, GACHA_BOXES, NATURE_CATALOG, ROOM_CATALOG, SPECIES_CATALOG, TALENT_CATALOG, getGrowthStage, getIvRank, getPokemonCryId } from '../../data/catalog';
import { POKEMON_SKIN_CATALOG, ensureFreshMetaProgress } from '../../data/metaProgression';
import { getAccessoryAvailability, getBallAvailability, getPetIVs, getPetNature, getPetTalent, getReleaseReward } from '../../utils/petEngine';
import { PixelIcon, PixelItemImg, PixelPetIcon, PixelPetSprite } from '../PixelSprite';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LcdBagAndMarketView: React.FC<{ ctx: LcdSharedCtx }> = ({ ctx }) => {
  const { bagTab, gachaBoxMeta, gachaPhase, gachaReleased, gachaResult, gachaTenResult, handleStartGacha, handleStartGachaTen, marketTab, mode, onBuyAccessory, onBuyFood, onBuyPokeball, onEquipAccessory, onExitMode, onGoBack, onHealPet, onNavigateMode, onReleasePet, onSelectFood, onUpdatePetConfig, pet, releasedTenIds, save, setBagTab, setDetailReturnMode, setGachaPhase, setGachaReleased, setMarketTab, setPartyDetailTab, setReleasedTenIds, setSelectedPartyPetId, speciesMeta } = ctx;
  return (
    <>
        {/* BAG & WAREHOUSE (树果 + 道具，无独立精灵球 tab) */}
        {mode === 'bag' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="lcd-subtabs">
                <button
                  type="button"
                  className={`lcd-subtab inline-icon-btn ${bagTab === 'berries' ? 'active' : ''}`}
                  onClick={() => setBagTab('berries')}
                >
                  <PixelItemImg src="/sprites/items/oran-berry.png" size={15} />
                  <span>树果</span>
                </button>
                <button
                  type="button"
                  className={`lcd-subtab inline-icon-btn ${bagTab === 'items' ? 'active' : ''}`}
                  onClick={() => setBagTab('items')}
                >
                  <PixelItemImg src="/sprites/items/kings-rock.png" size={15} />
                  <span>道具</span>
                </button>
              </div>
              <div className="lcd-head-actions">
                <button
                  type="button"
                  className="lcd-subtab inline-icon-btn"
                  onClick={() => {
                    setMarketTab('gacha');
                    setGachaPhase('idle');
                    onNavigateMode('market');
                  }}
                >
                  <PixelItemImg src="/sprites/items/amulet-coin.png" size={14} />
                  <span>去市场</span>
                </button>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => onGoBack()}
                >
                  返回
                </button>
              </div>
            </div>

            {bagTab === 'berries' && (
              <div className="lcd-grid-3 compact-grid scroll-y">
                {FOOD_CATALOG.map((food) => {
                  const count = food.unlimited ? '∞' : save.inventory[food.id] ?? 0;
                  const isFav = speciesMeta.favoriteFood === food.id;
                  const empty = !food.unlimited && (save.inventory[food.id] ?? 0) <= 0;
                  const canApply =
                    !pet.isSleeping &&
                    (Boolean(food.levelUp && pet.level < 100) ||
                      Boolean(food.curesSick && pet.isSick) ||
                      Boolean(food.health && pet.health < 100) ||
                      pet.hunger < 100);
                  const blocked = empty || !canApply;
                  return (
                    <button
                      key={food.id}
                      type="button"
                      disabled={blocked}
                      className="lcd-grid-tile compact"
                      onClick={() => onSelectFood(food.id)}
                      title={
                        empty
                          ? `${food.name} 库存不足`
                          : !canApply
                            ? pet.isSleeping
                              ? '睡眠中无法喂食'
                              : '饱食度已满，无需喂食'
                            : food.description
                      }
                    >
                      {isFav && <em className="tile-fav">最爱</em>}
                      <PixelItemImg src={food.itemSprite} size={30} />
                      <strong>{food.name}</strong>
                      <small>{!empty && !canApply ? '饱食已满' : `×${count}`}</small>
                    </button>
                  );
                })}
              </div>
            )}

            {bagTab === 'items' && (
              <div className="lcd-grid-3 compact-grid scroll-y">
                {/* Healing Potion moved from Home Dock into Bag -> Items */}
                {(() => {
                  const canHeal = pet.isSick || pet.health < 100;
                  return (
                    <button
                      type="button"
                      disabled={!canHeal}
                      className="lcd-grid-tile compact"
                      onClick={onHealPet}
                      title={
                        canHeal
                          ? `为 ${pet.name} 使用伤药恢复全部 HP 并治愈生病`
                          : `${pet.name} 当前 HP 满格，无需治疗`
                      }
                    >
                      <span className="tile-stock">×∞</span>
                      <PixelItemImg src="/sprites/items/potion.png" size={30} />
                      <strong>伤药治疗</strong>
                      <small>{canHeal ? (pet.isSick ? '治愈生病' : '回复HP') : 'HP已满'}</small>
                    </button>
                  );
                })()}

                {/* Owned Held Items with real stock quantities */}
                {ACCESSORY_CATALOG.filter(
                  (a) => a.id === 'none' || getAccessoryAvailability(save, a.id).total > 0,
                ).map((acc) => {
                  const equipped = pet.accessory === acc.id;
                  const avail = getAccessoryAvailability(save, acc.id);
                  const noSpare = acc.id !== 'none' && !equipped && avail.available <= 0;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={noSpare}
                      className={`lcd-grid-tile compact ${equipped ? 'is-selected' : ''}`}
                      onClick={() => onEquipAccessory(pet.id, acc.id)}
                      title={acc.description}
                    >
                      {acc.id !== 'none' && (
                        <span className="tile-stock">×{avail.total}</span>
                      )}
                      <PixelItemImg src={acc.itemSprite} size={30} />
                      <strong>{acc.name}</strong>
                      <small>
                        {equipped
                          ? '✓ 携带中'
                          : acc.id === 'none'
                            ? '卸下道具'
                            : avail.available > 0
                              ? `余${avail.available} · 携带`
                              : '已全装备'}
                      </small>
                    </button>
                  );
                })}

                {/* Owned Pokeball items with quantities */}
                {ROOM_CATALOG.filter(
                  (r) => r.id === 'pokeball_room' || getBallAvailability(save, r.id).total > 0,
                ).map((rm) => {
                  const avail = getBallAvailability(save, rm.id);
                  return (
                    <button
                      key={rm.id}
                      type="button"
                      className="lcd-grid-tile compact"
                      onClick={() => {
                        setSelectedPartyPetId(pet.id);
                        setPartyDetailTab('stats');
                        setDetailReturnMode('home');
                        onNavigateMode('party_detail');
                      }}
                      title="前往精灵详情页分配球舱"
                    >
                      <span className="tile-stock">
                        {rm.id === 'pokeball_room' ? '×∞' : `×${avail.total}`}
                      </span>
                      <PixelItemImg src={rm.ballSprite} size={30} />
                      <strong>{rm.shortName}</strong>
                      <small>
                        {rm.id === 'pokeball_room'
                          ? '基础球舱'
                          : `闲${avail.available} · 详情换球`}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MARKET & GACHA BLIND BOXES (盲盒单抽/十连 + 树果 + 道具) */}
        {mode === 'market' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="lcd-subtabs">
                <button
                  type="button"
                  className={`lcd-subtab inline-icon-btn ${marketTab === 'gacha' ? 'active' : ''}`}
                  onClick={() => {
                    setGachaPhase('idle');
                    setMarketTab('gacha');
                  }}
                >
                  <PixelItemImg src="/sprites/items/poke-ball.png" size={14} />
                  <span>盲盒</span>
                </button>
                <button
                  type="button"
                  className={`lcd-subtab inline-icon-btn ${marketTab === 'berries' ? 'active' : ''}`}
                  onClick={() => setMarketTab('berries')}
                >
                  <PixelItemImg src="/sprites/items/oran-berry.png" size={14} />
                  <span>树果</span>
                </button>
                <button
                  type="button"
                  className={`lcd-subtab inline-icon-btn ${marketTab === 'items' ? 'active' : ''}`}
                  onClick={() => setMarketTab('items')}
                >
                  <PixelItemImg src="/sprites/items/kings-rock.png" size={14} />
                  <span>道具</span>
                </button>
                <button
                  type="button"
                  className={`lcd-subtab inline-icon-btn ${marketTab === 'skins' ? 'active' : ''}`}
                  onClick={() => setMarketTab('skins')}
                >
                  <PixelIcon name="sparkle" size={13} />
                  <span>外观</span>
                </button>
              </div>
              <span className="lcd-wallet-mini inline-icon-row">
                <PixelItemImg src="/sprites/items/amulet-coin.png" size={15} />
                <span>{save.coins}</span>
              </span>
              <button
                type="button"
                className="lcd-mini-close"
                onClick={() => {
                  setGachaPhase('idle');
                  onGoBack();
                }}
              >
                返回
              </button>
            </div>

            {marketTab === 'gacha' && (
              <>
                {gachaPhase === 'idle' && (
                  <div className="lcd-grid-3 gacha-grid">
                    {GACHA_BOXES.map((box) => (
                      <div key={box.id} className="lcd-gacha-card" title={box.description}>
                        <span className="gacha-rate-tag">{box.badge}</span>
                        <PixelItemImg src={box.ballSprite} size={30} />
                        <strong>{box.name}</strong>
                        <div className="gacha-pull-btns">
                          <button
                            type="button"
                            disabled={save.coins < box.price}
                            className="gacha-pull-btn"
                            onClick={() => handleStartGacha(box.id, box.ballSprite)}
                          >
                            <span>单抽</span>
                            <span className="inline-icon-row">
                              <PixelItemImg src="/sprites/items/amulet-coin.png" size={11} />
                              <span>{box.price}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={save.coins < box.tenPrice}
                            className="gacha-pull-btn is-ten"
                            onClick={() => handleStartGachaTen(box.id, box.ballSprite)}
                          >
                            <span>十连</span>
                            <span className="inline-icon-row">
                              <PixelItemImg src="/sprites/items/amulet-coin.png" size={11} />
                              <span>{box.tenPrice}</span>
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {gachaPhase === 'shaking' && (
                  <div className="gacha-stage">
                    <div className="gacha-ball-shake">
                      <PixelItemImg
                        src={gachaBoxMeta?.ballSprite ?? '/sprites/items/poke-ball.png'}
                        size={60}
                      />
                    </div>
                    <strong>
                      {gachaBoxMeta?.isTen ? '十连盲盒 光芒汇聚中...' : '精灵球剧烈摇晃中...'}
                    </strong>
                  </div>
                )}

                {gachaPhase === 'reveal' && gachaResult?.pulledSpecies && (
                  <div className="gacha-stage reveal">
                    {(() => {
                      const pulledMeta = SPECIES_CATALOG[gachaResult.pulledSpecies];
                      const pulledPet = gachaResult.pulledPet;
                      const natureMeta = pulledPet
                        ? NATURE_CATALOG[getPetNature(pulledPet)]
                        : null;
                      const talentMeta = pulledPet
                        ? TALENT_CATALOG[getPetTalent(pulledPet)]
                        : null;
                      const ivs = pulledPet ? getPetIVs(pulledPet) : null;
                      const ivRank = ivs ? getIvRank(ivs) : null;
                      const relReward = pulledPet ? getReleaseReward(pulledPet) : null;
                      const canRelease =
                        Boolean(pulledPet) && !gachaReleased && save.pets.length > 1;
                      return (
                        <>
                          <div className="inline-icon-row">
                            <span className={`rarity-pill r-${pulledMeta.rarity}`}>
                              {pulledMeta.rarity}
                            </span>
                            {ivRank && (
                              <span className={`iv-rank-pill iv-${ivRank}`}>
                                资质 {ivRank}
                              </span>
                            )}
                            {gachaResult.isNewDex ? (
                              <span className="new-dex-pill">NEW! 图鉴登录</span>
                            ) : gachaResult.isDuplicateSpecies && pulledPet ? (
                              <span className="dup-keep-pill">新个体入队</span>
                            ) : null}
                          </div>
                          <PixelPetSprite
                            species={pulledMeta.id}
                            stage="baby"
                            size={88}
                          />
                          <strong>
                            {pulledMeta.dexNo}{' '}
                            {pulledPet ? `${pulledPet.name} (${pulledMeta.title})` : pulledMeta.title}
                          </strong>
                          {pulledPet && natureMeta && talentMeta && ivs ? (
                            <div className="gacha-trait-card">
                              <div className="inline-icon-row">
                                <span className="nature-chip">性格:{natureMeta.name}</span>
                                <span
                                  className="talent-chip"
                                  style={{ backgroundColor: talentMeta.color }}
                                >
                                  天分:{talentMeta.name}
                                </span>
                              </div>
                              <div className="gacha-iv-row">
                                <span>攻{ivs.atk}</span>
                                <span>防{ivs.def}</span>
                                <span>速{ivs.spd}</span>
                                <span>魅{ivs.charm}</span>
                              </div>
                            </div>
                          ) : (
                            <small>{gachaResult.message}</small>
                          )}
                          {gachaReleased && relReward && (
                            <small className="release-done-note">
                              已温柔放生！返还 +{relReward.coins} 金币与 +{relReward.xp} EXP
                            </small>
                          )}
                          <div className="gacha-actions">
                            <button
                              type="button"
                              className="lcd-inline-cta"
                              onClick={() => setGachaPhase('idle')}
                            >
                              继续抽盒
                            </button>
                            {canRelease && pulledPet && relReward && (
                              <button
                                type="button"
                                className="lcd-mini-close danger"
                                onClick={() => {
                                  if (onReleasePet(pulledPet.id)) {
                                    setGachaReleased(true);
                                  }
                                }}
                                title={`放生该个体，返还 +${relReward.coins} 金币与 +${relReward.xp} EXP`}
                              >
                                放生 (+{relReward.coins}币)
                              </button>
                            )}
                            <button
                              type="button"
                              className="lcd-mini-close"
                              onClick={() => {
                                setGachaPhase('idle');
                                onExitMode();
                              }}
                            >
                              回主页
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {gachaPhase === 'reveal' && gachaTenResult?.results && (
                  <div className="gacha-stage reveal-ten">
                    <div className="gacha-ten-summary">
                      <span className="rarity-pill r-SSR">十连结果</span>
                      <small>{gachaTenResult.message}</small>
                    </div>
                    <div className="gacha-ten-grid">
                      {gachaTenResult.results.map((entry, idx) => {
                        const spMeta = SPECIES_CATALOG[entry.species];
                        const isReleased = Boolean(
                          entry.petId && releasedTenIds.includes(entry.petId),
                        );
                        const canReleaseEntry =
                          Boolean(entry.petId) &&
                          entry.joinedParty &&
                          !isReleased &&
                          save.pets.length > 1;
                        return (
                          <div
                            key={`${entry.species}-${idx}`}
                            className={`gacha-ten-cell r-${spMeta.rarity} ${isReleased ? 'is-released' : ''}`}
                            title={
                              entry.nature && entry.talent
                                ? `${NATURE_CATALOG[entry.nature].name} · ${TALENT_CATALOG[entry.talent].name}`
                                : spMeta.title
                            }
                          >
                            <div className="ten-cell-badges">
                              <em className={`mini-rarity r-${spMeta.rarity}`}>
                                {spMeta.rarity}
                              </em>
                              {entry.ivRank && (
                                <em className={`mini-iv iv-${entry.ivRank}`}>
                                  {entry.ivRank}
                                </em>
                              )}
                              {entry.isNewDex && <em className="mini-new">NEW</em>}
                            </div>
                            <PixelPetIcon species={entry.species} stage="baby" width={30} />
                            <span>{spMeta.title}</span>
                            {isReleased ? (
                              <em className="ten-rel-done">已放生</em>
                            ) : canReleaseEntry && entry.petId ? (
                              <button
                                type="button"
                                className="ten-rel-btn"
                                onClick={() => {
                                  if (entry.petId && onReleasePet(entry.petId)) {
                                    setReleasedTenIds((prev) => [...prev, entry.petId!]);
                                  }
                                }}
                              >
                                放生
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className="gacha-actions">
                      {gachaBoxMeta && (
                        <button
                          type="button"
                          className="lcd-inline-cta"
                          disabled={
                            save.coins <
                            (GACHA_BOXES.find((b) => b.id === gachaBoxMeta.id)?.tenPrice ??
                              99999)
                          }
                          onClick={() =>
                            handleStartGachaTen(gachaBoxMeta.id, gachaBoxMeta.ballSprite)
                          }
                        >
                          再来十连
                        </button>
                      )}
                      <button
                        type="button"
                        className="lcd-subtab"
                        onClick={() => setGachaPhase('idle')}
                      >
                        选盲盒
                      </button>
                      <button
                        type="button"
                        className="lcd-mini-close"
                        onClick={() => {
                          setGachaPhase('idle');
                          onExitMode();
                        }}
                      >
                        回主页
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {marketTab === 'berries' && (
              <div className="lcd-grid-3 compact-grid scroll-y">
                {FOOD_CATALOG.filter((f) => !f.unlimited).map((food) => {
                  const stock = save.inventory[food.id] ?? 0;
                  return (
                    <button
                      key={food.id}
                      type="button"
                      disabled={save.coins < food.price}
                      className="lcd-grid-tile market-hero-tile"
                      onClick={() => onBuyFood(food.id)}
                      title={`${food.name} · ${food.description}`}
                    >
                      <span className="mk-corner-stock">存{stock}</span>
                      <span className="mk-corner-price">
                        <PixelItemImg src="/sprites/items/amulet-coin.png" size={12} />
                        <em>{food.price}</em>
                      </span>
                      <div className="mk-hero-img">
                        <PixelItemImg src={food.itemSprite} size={42} />
                      </div>
                      <span className="tile-corner-name">{food.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {marketTab === 'items' && (
              <div className="lcd-grid-3 compact-grid scroll-y">
                {/* Pokeball Capsules for sale (Hero-Icon Corner-Tag Showcase!) */}
                {ROOM_CATALOG.filter((r) => r.price > 0).map((rm) => {
                  const avail = getBallAvailability(save, rm.id);
                  return (
                    <button
                      key={rm.id}
                      type="button"
                      disabled={save.coins < rm.price}
                      className="lcd-grid-tile market-hero-tile"
                      onClick={() => onBuyPokeball(rm.id)}
                      title={`${rm.shortName} · ${rm.description}`}
                    >
                      <span className="mk-corner-stock">存{avail.total}</span>
                      <span className="mk-corner-price">
                        <PixelItemImg src="/sprites/items/amulet-coin.png" size={12} />
                        <em>{rm.price}</em>
                      </span>
                      <div className="mk-hero-img">
                        <PixelItemImg src={rm.ballSprite} size={42} />
                      </div>
                      <span className="tile-corner-name">{rm.shortName}</span>
                    </button>
                  );
                })}

                {/* Held Accessories for sale (Hero-Icon Corner-Tag Showcase!) */}
                {ACCESSORY_CATALOG.filter((a) => a.id !== 'none').map((acc) => {
                  const avail = getAccessoryAvailability(save, acc.id);
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={save.coins < acc.price}
                      className="lcd-grid-tile market-hero-tile"
                      onClick={() => onBuyAccessory(acc.id)}
                      title={`${acc.name} · ${acc.description}`}
                    >
                      <span className="mk-corner-stock">存{avail.total}</span>
                      <span className="mk-corner-price">
                        <PixelItemImg src="/sprites/items/amulet-coin.png" size={12} />
                        <em>{acc.price}</em>
                      </span>
                      <div className="mk-hero-img">
                        <PixelItemImg src={acc.itemSprite} size={42} />
                      </div>
                      <span className="tile-corner-name">{acc.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {marketTab === 'skins' && (() => {
              const curMeta = ensureFreshMetaProgress(save.meta);
              const ownedSkins = new Set(curMeta.unlockedSkins ?? ['classic']);
              const activeDexId = getPokemonCryId(pet.species, pet.level);
              const activeStg = getGrowthStage(pet.level, pet.species);
              return (
                <div className="skin-wardrobe-grid scroll-y">
                  {POKEMON_SKIN_CATALOG.map((sk) => {
                    const owned = sk.priceCoins === 0 || ownedSkins.has(sk.id);
                    const equipped = (pet.skin ?? 'classic') === sk.id;
                    const spriteSrc = sk.usesOfficialShiny
                      ? `/sprites/pokemon/shiny-animated/${activeDexId}.gif`
                      : SPECIES_CATALOG[pet.species].stageSprites[activeStg].animated;
                    return (
                      <div key={sk.id} className={`skin-shop-card ${equipped ? 'is-equipped' : ''}`}>
                        <div className="skin-shop-top">
                          <span className="skin-rarity-tag" style={{ backgroundColor: sk.rarityColor }}>
                            {sk.rarityLabel}
                          </span>
                          <strong>{sk.name}</strong>
                        </div>
                        <div className="skin-preview-box">
                          <img
                            src={spriteSrc}
                            alt={sk.name}
                            style={{ filter: sk.cssFilter }}
                            className="skin-preview-img"
                            draggable={false}
                          />
                        </div>
                        <p>{sk.desc}</p>
                        <button
                          type="button"
                          className="skin-action-btn"
                          disabled={!owned && save.coins < sk.priceCoins}
                          onClick={() => {
                            if (owned) {
                              onUpdatePetConfig?.(pet.id, { skin: sk.id });
                            } else {
                              onUpdatePetConfig?.(pet.id, {
                                skin: sk.id,
                                skinCost: sk.priceCoins,
                                unlockSkin: sk.id,
                              });
                            }
                          }}
                        >
                          {equipped ? '✓ 已穿戴' : owned ? `给${pet.name}换装` : `${sk.priceCoins} 金币解锁`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

    </>
  );
};
