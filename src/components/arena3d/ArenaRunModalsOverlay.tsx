import type { ArenaSharedCtx } from './arenaTypesAndProps';
import React from 'react';
import { SPECIES_CATALOG } from '../../data/catalog';
import { SURVIVOR_SKILLS } from '../../data/survivorsTactics';
import { sound } from '../../utils/sound';
import { PixelIcon, PixelItemImg } from '../PixelSprite';
import { TrimmedSpriteImg } from '../TrimmedSpriteImg';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const ArenaRunModalsOverlay: React.FC<{ ctx: Record<string, any> }> = ({ ctx: rawCtx }) => {
  const ctx = rawCtx as ArenaSharedCtx;
  const { activeRoom, banishMode, banishedIdsRef, buySafeShopItem, captureOffer, closeResultAndRun, closeShopModal, closingCapture, closingLevelUp, closingResult, closingShop, diffMeta, endedRef, followersView, gameMode, handleCaptureBossConfirm, handleChooseUpgrade, hud, levelChoices, onFinish, pausedRef, pet, rebuildChoicesRef, regionMeta, rerollsLeft, resultModal, resultSummary, setBanishMode, setClosingLevelUp, setLevelChoices, setPhase, setRerollsLeft, setRunNonce, shopOpen, simRef, totalSpendableCoins, tryRestorePointerLock } = ctx;
  return (
    <>
          {/* Horizontal 3-Card Neo-Brutalist Pixel Level-Up Draft (Hotkeys [1/2/3], [F] Reroll, [X] Skip, [Z] Banish!) */}
          {levelChoices && !resultModal && (
            <div className={`surv-modal-backdrop ${closingLevelUp ? 'is-closing' : ''}`}>
              <div className="surv-draft-stage">
                <div className="surv-draft-ribbon">
                  <span>等级 {hud.runLevel}！</span>
                </div>

                <div className="surv-draft-grid">
                  {levelChoices.map((opt, idx) => {
                    const kindLabel =
                      opt.kind === 'upgrade_follower'
                        ? '精灵升级'
                        : opt.kind === 'item'
                          ? '实战道具'
                          : opt.badge === '新被动'
                            ? '获取被动'
                            : '提升被动';
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`surv-draft-card ${banishMode ? 'is-banish-target' : ''}`}
                        onClick={() => {
                          if (banishMode) {
                            banishedIdsRef.current.add(opt.id);
                            setBanishMode(false);
                            sound.play('cancel');
                            if (rebuildChoicesRef.current) setLevelChoices(rebuildChoicesRef.current());
                          } else {
                            handleChooseUpgrade(opt);
                          }
                        }}
                      >
                        <div className="draft-card-banner" style={{ '--card-col': opt.color } as React.CSSProperties}>
                          <span className="draft-tl-tag">{kindLabel}</span>
                          <span className="draft-tr-tag">{opt.badge}</span>
                          <div className="draft-hero-art">
                            <TrimmedSpriteImg
                              src={opt.sprite}
                              alt={opt.title}
                              size={104}
                              fillRatio={0.84}
                            />
                          </div>
                        </div>
                        <div className="draft-card-body">
                          <strong>{opt.title}</strong>
                          <p>{opt.desc}</p>
                          <div className="draft-card-foot">
                            <span className="draft-action-hint">
                              {banishMode ? '点击放逐此选项' : '点击或按键选择'}
                            </span>
                            <kbd className="px-keycap is-lg">{idx + 1}</kbd>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Draft Utility Action Bar ([F] Reroll / [X] Skip / [Z] Banish) */}
                <div className="surv-draft-utils">
                  <button
                    type="button"
                    className="draft-util-btn is-reroll"
                    disabled={rerollsLeft <= 0}
                    onClick={() => {
                      if (rerollsLeft <= 0 || !rebuildChoicesRef.current) return;
                      sound.play('confirm');
                      setRerollsLeft((r) => Math.max(0, r - 1));
                      setLevelChoices(rebuildChoicesRef.current());
                    }}
                  >
                    <PixelIcon name="replay" size={12} />
                    <span>刷新 ({rerollsLeft})</span>
                    <kbd className="px-keycap">F</kbd>
                  </button>
                  <button
                    type="button"
                    className="draft-util-btn is-skip"
                    onClick={() => {
                      sound.play('coin');
                      if (simRef.current) simRef.current.coins += 15;
                      setClosingLevelUp(true);
                      tryRestorePointerLock();
                      window.setTimeout(() => {
                        setClosingLevelUp(false);
                        setLevelChoices(null);
                        pausedRef.current = false;
                      }, 155);
                    }}
                  >
                    <span>跳过 (+15 金币)</span>
                    <kbd className="px-keycap">X</kbd>
                  </button>
                  <button
                    type="button"
                    className={`draft-util-btn is-banish ${banishMode ? 'is-armed' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      setBanishMode((b) => !b);
                    }}
                  >
                    <span>{banishMode ? '取消放逐' : '放逐'}</span>
                    <kbd className="px-keycap">Z</kbd>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Boss Defeat -> Pokéball Capture Offer (Hotkeys [1] Catch / [2] Skip + Bidirectional Animation!) */}
          {captureOffer && !resultModal && (
            <div className={`surv-modal-backdrop ${closingCapture ? 'is-closing' : ''}`}>
              <div className="surv-upgrade-box is-result">
                <div className="surv-upgrade-head">击败区域守护者！投掷精灵球收服？</div>
                <div className="capture-offer-body">
                  <img
                    src={SPECIES_CATALOG[captureOffer.species].stageSprites.adult.animated}
                    alt={captureOffer.name}
                    className="capture-boss-img"
                    draggable={false}
                  />
                  <strong>{captureOffer.name} (Lv.{captureOffer.level})</strong>
                  <small>收服后将永久加入你的精灵球盒，并立刻并肩作战！</small>
                </div>
                <div className="capture-btn-row">
                  <button
                    type="button"
                    className="lcd-inline-cta full inline-icon-row"
                    onClick={() => handleCaptureBossConfirm(true)}
                  >
                    <kbd className="px-keycap">1</kbd>
                    <span>投掷精灵球收服！</span>
                  </button>
                  <button
                    type="button"
                    className="lcd-mini-close inline-icon-row"
                    onClick={() => handleCaptureBossConfirm(false)}
                  >
                    <kbd className="px-keycap">2</kbd>
                    <span>跳过</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Safe Zone Poké Mart Modal (Bidirectional Open + Close Animation!) */}
          {shopOpen && !resultModal && (
            <div className={`surv-modal-backdrop ${closingShop ? 'is-closing' : ''}`}>
              <div className="surv-upgrade-box is-shop-modal is-wide-modal">
                <div className="surv-upgrade-head shop-head-row">
                  <span>3D 安全区 · 友好商店</span>
                  <span className="shop-coin-badge">金币：{totalSpendableCoins}</span>
                  <button
                    type="button"
                    className="lcd-mini-close inline-icon-row"
                    onClick={closeShopModal}
                  >
                    <kbd className="px-keycap">ESC</kbd>
                    <span>继续</span>
                  </button>
                </div>
                <div className="surv-choice-list">
                  <button
                    type="button"
                    className="surv-choice-card"
                    disabled={totalSpendableCoins < 15 || hud.hp >= hud.maxHp}
                    onClick={() => buySafeShopItem('potion', 15)}
                  >
                    <kbd className="px-keycap is-lg">1</kbd>
                    <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/potion.png" size={20} /></div>
                    <div className="surv-choice-info">
                      <div className="inline-icon-row"><strong>超级伤药</strong><span className="surv-price-tag">15 金币</span></div>
                      <small>立刻回复主角 65% HP</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="surv-choice-card"
                    disabled={totalSpendableCoins < 35}
                    onClick={() => buySafeShopItem('summon', 35)}
                  >
                    <kbd className="px-keycap is-lg">2</kbd>
                    <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/great-ball.png" size={20} /></div>
                    <div className="surv-choice-info">
                      <div className="inline-icon-row">
                        <strong>全体出战精灵 Lv+1</strong>
                        <span className="surv-price-tag">35 金币</span>
                      </div>
                      <small>立刻强化当前全队 {followersView.length} 只宝可梦的所有招式</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="surv-choice-card"
                    disabled={totalSpendableCoins < 30}
                    onClick={() => buySafeShopItem('tome', 30)}
                  >
                    <kbd className="px-keycap is-lg">3</kbd>
                    <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/exp-share.png" size={20} /></div>
                    <div className="surv-choice-info">
                      <div className="inline-icon-row"><strong>招式特训秘籍</strong><span className="surv-price-tag">30 金币</span></div>
                      <small>全队伤害 +25% · 冷却 -10%</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="surv-choice-card"
                    disabled={totalSpendableCoins < 25}
                    onClick={() => buySafeShopItem('berry', 25)}
                  >
                    <kbd className="px-keycap is-lg">4</kbd>
                    <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/sitrus-berry.png" size={20} /></div>
                    <div className="surv-choice-info">
                      <div className="inline-icon-row"><strong>元气树果补给</strong><span className="surv-price-tag">25 金币</span></div>
                      <small>最大 HP +25% 并回复 35% 血量</small>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FULL-SCREEN ZERO-SCROLL NEO-BRUTALIST PIXEL VICTORY / SETTLEMENT DASHBOARD */}
          {resultSummary && (() => {
            const mvpRow = resultSummary.squadReport[0] ?? null;
            const maxDmg = Math.max(1, ...resultSummary.squadReport.map((r) => r.damageDealt));
            const teamDmg = Math.max(1, resultSummary.totalDamage);
            return (
              <div className={`surv-result-fullscreen ${closingResult ? 'is-closing' : ''}`}>
                {/* Full-Width Top Hero Ribbon */}
                <header className={`res-fs-head ${resultSummary.payload.cleared ? 'is-win' : 'is-over'}`}>
                  <div className="res-hero-left">
                    <div className="res-title-row">
                      <PixelIcon
                        name={resultSummary.payload.cleared ? 'trophy' : 'sword'}
                        size={26}
                      />
                      <h3>
                        {resultSummary.payload.cleared
                          ? `${regionMeta.name} · 守护者讨伐胜利！`
                          : gameMode === 'endless'
                            ? '无尽征途 · 战绩结算'
                            : `${regionMeta.name} · 探索战绩结算`}
                      </h3>
                    </div>
                    <div className="res-badge-strip">
                      <span className="res-meta-pill">{gameMode === 'story' ? '剧情模式' : '无尽模式'}</span>
                      <span className="res-meta-pill is-diff">{diffMeta.label} {diffMeta.badgeText}</span>
                      <span className="res-meta-pill is-lv">Lv.{resultSummary.payload.runLevel}</span>
                      {resultSummary.trainersDefeated > 0 && (
                        <span className="res-meta-pill is-tr">击败训练师 ×{resultSummary.trainersDefeated}</span>
                      )}
                    </div>
                  </div>
                  <div className="res-boss-box">
                    <img
                      src={SPECIES_CATALOG[regionMeta.bossSpecies].stageSprites.adult.animated}
                      alt={regionMeta.bossName}
                      className="res-boss-sprite"
                      draggable={false}
                    />
                    <em className={`res-boss-stamp ${resultSummary.capturedBoss ? 'is-caught' : resultSummary.payload.cleared ? 'is-ko' : ''}`}>
                      {resultSummary.capturedBoss
                        ? '已收服!'
                        : resultSummary.payload.cleared
                          ? '已讨伐'
                          : regionMeta.bossName}
                    </em>
                  </div>
                </header>

                {/* Middle Zero-Scroll 2-Column Widescreen Body */}
                <div className="res-fs-body">
                  {/* LEFT COLUMN: 2x2 KPI Cards + MVP Spotlight + Captured Boss Banner */}
                  <div className="res-fs-left">
                    <div className="res-kpi-grid-2x2">
                      <div className="res-kpi-card">
                        <div className="res-kpi-ico"><PixelIcon name="clock" size={18} /></div>
                        <div className="res-kpi-val">
                          <strong>
                            {Math.floor(resultSummary.payload.survivedSec / 60)}:
                            {String(resultSummary.payload.survivedSec % 60).padStart(2, '0')}
                          </strong>
                          <small>探索时长</small>
                        </div>
                      </div>
                      <div className="res-kpi-card">
                        <div className="res-kpi-ico"><PixelIcon name="sword" size={18} /></div>
                        <div className="res-kpi-val">
                          <strong>{resultSummary.payload.kills}</strong>
                          <small>击败对手</small>
                        </div>
                      </div>
                      <div className="res-kpi-card">
                        <div className="res-kpi-ico"><PixelIcon name="bolt" size={18} /></div>
                        <div className="res-kpi-val">
                          <strong>{resultSummary.totalDamage.toLocaleString()}</strong>
                          <small>总伤害 · {resultSummary.dps}/秒</small>
                        </div>
                      </div>
                      <div className="res-kpi-card is-gold">
                        <div className="res-kpi-ico">
                          <PixelItemImg src="/sprites/items/amulet-coin.png" size={20} />
                        </div>
                        <div className="res-kpi-val">
                          <strong>+{resultSummary.payload.coinsCollected}</strong>
                          <small>获得金币</small>
                        </div>
                      </div>
                    </div>

                    {/* MVP Spotlight Hero Card */}
                    {mvpRow && (
                      <div className="res-mvp-spotlight">
                        <div className="res-mvp-head">
                          <PixelIcon name="crown" size={14} />
                          <span>本局输出 MVP</span>
                          <em>{Math.round((mvpRow.damageDealt / teamDmg) * 100)}% 团队贡献</em>
                        </div>
                        <div className="res-mvp-body">
                          <div className="res-mvp-img-wrap">
                            <img src={mvpRow.sprite} alt={mvpRow.name} draggable={false} />
                          </div>
                          <div className="res-mvp-meta">
                            <strong>{mvpRow.name} <small>Lv.{mvpRow.level}</small></strong>
                            <div className="res-mvp-nums">
                              <span>总伤害 <b>{mvpRow.damageDealt.toLocaleString()}</b></span>
                              <span>击败 <b>{mvpRow.kills}</b></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Captured Boss Showcase Card */}
                    {resultSummary.capturedBoss && (
                      <div className="res-capture-banner is-fs">
                        <PixelItemImg src="/sprites/items/poke-ball.png" size={22} />
                        <img
                          src={SPECIES_CATALOG[resultSummary.capturedBoss.species].stageSprites.adult.animated}
                          alt={resultSummary.capturedBoss.name}
                          className="res-cap-ico"
                          draggable={false}
                        />
                        <span>
                          成功收服守护者 <strong>{resultSummary.capturedBoss.name} (Lv.{resultSummary.capturedBoss.level})</strong> 已入球盒！
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: 2x3 Zero-Scroll Squad Damage Grid (Fits all 6 Pokémon cleanly!) */}
                  <div className="res-fs-right">
                    <div className="res-sec-head">
                      <span className="inline-icon-row">
                        <PixelIcon name="chart" size={14} />
                        <span>出战精灵伤害贡献 ({resultSummary.squadReport.length}/6)</span>
                      </span>
                      <small>按总输出排序</small>
                    </div>
                    <div className="res-squad-grid-2x3">
                      {resultSummary.squadReport.map((row, idx) => {
                        const pctBar = Math.max(4, Math.round((row.damageDealt / maxDmg) * 100));
                        const pctShare = Math.round((row.damageDealt / teamDmg) * 100);
                        const sk0 = SURVIVOR_SKILLS[row.skills[0]];
                        const sk1 = SURVIVOR_SKILLS[row.skills[1]];
                        const isMvp = idx === 0 && row.damageDealt > 0;
                        return (
                          <div key={row.id} className={`res-poke-card ${isMvp ? 'is-mvp' : ''}`}>
                            <div className="res-poke-card-top">
                              <div className="res-poke-avatar">
                                <img src={row.sprite} alt={row.name} draggable={false} />
                                {isMvp && (
                                  <span className="res-mvp-tag">
                                    <PixelIcon name="crown" size={10} />
                                    MVP
                                  </span>
                                )}
                              </div>
                              <div className="res-poke-card-info">
                                <div className="inline-icon-row">
                                  <strong>{row.name}</strong>
                                  <em className="res-poke-lv">Lv.{row.level}</em>
                                </div>
                                <div className="res-poke-skills">
                                  <span style={{ borderColor: sk0.color }}>
                                    <PixelItemImg src={sk0.sprite} size={11} />
                                    {sk0.name}
                                  </span>
                                  {sk1.id !== sk0.id && (
                                    <span style={{ borderColor: sk1.color }}>
                                      <PixelItemImg src={sk1.sprite} size={11} />
                                      {sk1.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="res-dmg-bar-row">
                              <div className="res-dmg-track">
                                <div
                                  className="res-dmg-fill"
                                  style={{ width: `${pctBar}%`, backgroundColor: sk0.color }}
                                />
                              </div>
                              <span className="res-dmg-num">
                                <b>{row.damageDealt.toLocaleString()}</b> ({pctShare}%) · 击{row.kills}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Full-Width Bottom Action Footer with Keycaps + Smooth Closing Animation */}
                <footer className="res-fs-footer">
                  <button
                    type="button"
                    className="res-btn is-replay"
                    onClick={() =>
                      closeResultAndRun(() => {
                        onFinish(pet.id, resultSummary.payload, false);
                        endedRef.current = false;
                        pausedRef.current = false;
                        setRunNonce((n) => n + 1);
                      })
                    }
                  >
                    <kbd className="px-keycap">1</kbd>
                    <PixelIcon name="replay" size={14} />
                    <span>再来一局</span>
                  </button>
                  <button
                    type="button"
                    className="res-btn is-primary"
                    onClick={() =>
                      closeResultAndRun(() => {
                        onFinish(pet.id, resultSummary.payload, false);
                        setPhase('hub');
                      })
                    }
                  >
                    <kbd className="px-keycap">2</kbd>
                    <PixelIcon name="trophy" size={14} />
                    <span>领奖并返回 3D 大厅</span>
                  </button>
                  <button
                    type="button"
                    className="res-btn is-manage"
                    onClick={() =>
                      closeResultAndRun(() => {
                        onFinish(pet.id, resultSummary.payload, true);
                      })
                    }
                  >
                    <kbd className="px-keycap">3</kbd>
                    <PixelItemImg src={activeRoom.ballSprite} size={16} />
                    <span>前往宝可梦管理</span>
                  </button>
                </footer>
              </div>
            );
          })()}
    </>
  );
};
