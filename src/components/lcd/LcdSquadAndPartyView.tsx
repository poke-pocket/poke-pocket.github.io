import type { LcdSharedCtx } from './lcdViewTypes';
import React from 'react';
import { NATURE_CATALOG, ROOM_CATALOG, SPECIES_CATALOG, getGrowthStage, getIvRank } from '../../data/catalog';
import { ensureFreshMetaProgress } from '../../data/metaProgression';
import { type PetRecord } from '../../types/pet';
import { MAX_PET_SLOTS, getPetIVs, getPetNature, getReleaseReward } from '../../utils/petEngine';
import { sound } from '../../utils/sound';
import { PixelIcon, PixelItemImg, PixelPetSprite } from '../PixelSprite';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const LcdSquadAndPartyView: React.FC<{ ctx: LcdSharedCtx }> = ({ ctx }) => {
  const { batchFeedback, batchSelectedIds, confirmBatchDeposit, confirmBatchRelease, confirmBatchWithdraw, mode, onCloseHandheldTo3D, onDepositPetsBatch, onNavigateMode, onReleasePetsBatch, onReleaseStoredPetsBatch, onSwitchPet, onUpdateMeta, onWithdrawPetsBatch, openedEntryMode, openedFromBattle, partyBatchMode, partyBoxTab, partyGradeFilter, partySearch, partySortBy, pet, save, setBatchFeedback, setBatchSelectedIds, setConfirmBatchDeposit, setConfirmBatchRelease, setConfirmBatchWithdraw, setConfirmReleaseId, setDetailReturnMode, setGachaPhase, setMarketTab, setPartyBatchMode, setPartyBoxTab, setPartyDetailTab, setPartyGradeFilter, setPartySearch, setPartySortBy, setPetActionMenuOpen, setSelectedPartyPetId, setSquadPickerSlot, squadPickerSlot } = ctx;
  return (
    <>
        {/* CURRENT ACTIVE SQUAD MANAGER (支持多编队增删、全部移出、空槽位 '+' 卡片进入第二页球盒选人!) */}
        {mode === 'squad' && (() => {
          const curMeta = ensureFreshMetaProgress(save.meta);
          const extraCap = curMeta.labLevels.squad_cap ?? 0;
          const maxSquadSize = Math.min(8, 6 + extraCap);
          const defaultTeamIds = save.pets.filter((p) => !p.isSleeping).slice(0, maxSquadSize).map((p) => p.id);
          const presets =
            curMeta.squadPresets && curMeta.squadPresets.length > 0
              ? curMeta.squadPresets
              : [
                  { id: 'sq_1', name: '队伍 1', petIds: defaultTeamIds },
                  { id: 'sq_2', name: '队伍 2', petIds: defaultTeamIds.slice(0, 3) },
                  { id: 'sq_3', name: '队伍 3', petIds: [] },
                  { id: 'sq_4', name: '队伍 4', petIds: [] },
                  { id: 'sq_5', name: '队伍 5', petIds: [] },
                ];
          const activeIdx = Math.min(presets.length - 1, Math.max(0, curMeta.activeSquadIdx ?? 0));
          const curPreset = presets[activeIdx] ?? presets[0];
          const curIds = curPreset.petIds.filter((id) => save.pets.some((p) => p.id === id));
          const activeTeamPets = curIds
            .map((id) => save.pets.find((p) => p.id === id))
            .filter((p): p is PetRecord => Boolean(p));
          const inSquadSet = new Set(curIds);

          const savePresets = (nextPresets: typeof presets, nextIdx: number) => {
            onUpdateMeta?.((prev) => ({ ...prev, squadPresets: nextPresets, activeSquadIdx: nextIdx }));
          };

          const selectPreset = (idx: number) => {
            sound.play('cursor');
            setSquadPickerSlot(null);
            savePresets(presets, idx);
          };

          const addNewPreset = () => {
            if (presets.length >= 8) {
              sound.play('error');
              return;
            }
            sound.play('confirm');
            const nextNum = presets.length + 1;
            const nextPresets = [...presets, { id: `sq_${Date.now()}`, name: `队伍 ${nextNum}`, petIds: [] }];
            setSquadPickerSlot(null);
            savePresets(nextPresets, nextPresets.length - 1);
          };

          const deleteCurrentPreset = () => {
            if (presets.length <= 1) {
              // On last remaining squad, clearing removes all members
              sound.play('cancel');
              const cleared = presets.map((pr, i) => (i === activeIdx ? { ...pr, petIds: [] } : pr));
              savePresets(cleared, 0);
              return;
            }
            sound.play('cancel');
            const nextPresets = presets.filter((_, i) => i !== activeIdx);
            const nextIdx = Math.min(activeIdx, nextPresets.length - 1);
            setSquadPickerSlot(null);
            savePresets(nextPresets, nextIdx);
          };

          const removeMemberAt = (petId: string) => {
            sound.play('cancel');
            const nextIds = curIds.filter((id) => id !== petId);
            const nextPresets = presets.map((pr, i) => (i === activeIdx ? { ...pr, petIds: nextIds } : pr));
            savePresets(nextPresets, activeIdx);
          };

          const clearAllMembers = () => {
            sound.play('cancel');
            const nextPresets = presets.map((pr, i) => (i === activeIdx ? { ...pr, petIds: [] } : pr));
            savePresets(nextPresets, activeIdx);
          };

          const pickPetForSlot = (petId: string) => {
            if (squadPickerSlot === null) return;
            const exists = inSquadSet.has(petId);
            let nextIds = [...curIds];
            if (squadPickerSlot < curIds.length) {
              // Replacing an existing slot
              const oldId = curIds[squadPickerSlot];
              if (oldId === petId) {
                setSquadPickerSlot(null);
                return;
              }
              if (exists) {
                // Swap positions cleanly!
                const otherIdx = curIds.indexOf(petId);
                nextIds[otherIdx] = oldId;
                nextIds[squadPickerSlot] = petId;
              } else {
                nextIds[squadPickerSlot] = petId;
              }
            } else {
              // Adding into an empty '+' slot
              if (exists) {
                sound.play('cancel');
                nextIds = curIds.filter((id) => id !== petId);
              } else if (curIds.length < maxSquadSize) {
                nextIds.push(petId);
              } else {
                sound.play('error');
                return;
              }
            }
            sound.play('confirm');
            const nextPresets = presets.map((pr, i) => (i === activeIdx ? { ...pr, petIds: nextIds } : pr));
            savePresets(nextPresets, activeIdx);
            setSquadPickerSlot(null);
          };

          // PAGE 2: Poké Box Picker for the clicked '+' / Replace slot!
          if (squadPickerSlot !== null) {
            const q = partySearch.trim().toLowerCase();
            const rankWeight = (r: string) => (r === 'S' ? 3 : r === 'A' ? 2 : 1);
            const pickerPets = save.pets
              .filter((p) => {
                const sp = SPECIES_CATALOG[p.species];
                const ivRank = getIvRank(getPetIVs(p));
                if (partyGradeFilter !== 'all' && ivRank !== partyGradeFilter) return false;
                if (!q) return true;
                const stName = sp.stageNames[getGrowthStage(p.level, p.species)] ?? sp.defaultName;
                return (
                  p.name.toLowerCase().includes(q) ||
                  sp.defaultName.toLowerCase().includes(q) ||
                  stName.toLowerCase().includes(q) ||
                  sp.typeLabel.toLowerCase().includes(q)
                );
              })
              .sort((a, b) => {
                if (partySortBy === 'level') return b.level - a.level;
                if (partySortBy === 'grade') {
                  const diff = rankWeight(getIvRank(getPetIVs(b))) - rankWeight(getIvRank(getPetIVs(a)));
                  return diff !== 0 ? diff : b.level - a.level;
                }
                return 0;
              });

            const replacingPet = squadPickerSlot < activeTeamPets.length ? activeTeamPets[squadPickerSlot] : null;
            return (
              <div className="lcd-submenu">
                <div className="lcd-submenu-head">
                  <span className="inline-icon-row">
                    <PixelItemImg src="/sprites/items/poke-ball.png" size={15} />
                    <span>
                      {replacingPet
                        ? `替换「${replacingPet.name}」· 选择伙伴`
                        : `为「${curPreset.name}」选择入队宝可梦 (${curIds.length}/${maxSquadSize})`}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={() => {
                      sound.play('cancel');
                      setSquadPickerSlot(null);
                    }}
                  >
                    ‹ 返回队伍
                  </button>
                </div>

                {/* Compact Search + Grade Filter + Sort Toolbar */}
                <div className="party-tool-bar">
                  <div className="party-search-wrap">
                    <input
                      type="text"
                      className="party-search-input"
                      placeholder="搜索昵称 / 种族 / 属性..."
                      value={partySearch}
                      onChange={(e) => setPartySearch(e.target.value)}
                    />
                    {partySearch && (
                      <button
                        type="button"
                        className="party-search-clear"
                        aria-label="清空搜索"
                        onClick={() => setPartySearch('')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="party-filter-pills">
                    {(['all', 'S', 'A', 'B'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`party-mini-pill ${partyGradeFilter === g ? 'active' : ''}`}
                        onClick={() => {
                          sound.play('cursor');
                          setPartyGradeFilter(g);
                        }}
                      >
                        {g === 'all' ? '全部' : `${g}级`}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`party-mini-pill ${partySortBy !== 'default' ? 'active' : ''}`}
                      onClick={() => {
                        sound.play('cursor');
                        setPartySortBy((s) => (s === 'default' ? 'level' : s === 'level' ? 'grade' : 'default'));
                      }}
                    >
                      {partySortBy === 'default' ? '默认序' : partySortBy === 'level' ? '等级↓' : '评级↓'}
                    </button>
                  </div>
                </div>

                <div className="lcd-grid-4 party-compact-grid scroll-y">
                  {pickerPets.length === 0 ? (
                    <div className="party-empty-hint">未找到匹配的宝可梦，试试更换筛选条件</div>
                  ) : (
                    pickerPets.map((p) => {
                      const inTeam = inSquadSet.has(p.id);
                      const st = getGrowthStage(p.level, p.species);
                      const ivRank = getIvRank(getPetIVs(p));
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`lcd-grid-tile compact party-compact-tile ${inTeam ? 'is-selected' : ''}`}
                          onClick={() => pickPetForSlot(p.id)}
                        >
                          <div className="tile-tl-group">
                            {inTeam && <em className="tile-tl-badge is-lock">在队</em>}
                            <em className={`tile-tl-badge iv-${ivRank}`}>{ivRank}</em>
                          </div>
                          <em className="tile-tr-lv">Lv.{p.level}</em>
                          <div className="party-sprite-hero">
                            <PixelPetSprite species={p.species} pose="idle0" stage={st} size={56} />
                          </div>
                          <span className="tile-corner-name">{p.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          }

          // PAGE 1: Current Active Squad Slot Grid with '+' Cards!
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="lcd-subtabs">
                  <button type="button" className="lcd-subtab active">
                    当前队伍 ({activeTeamPets.length}/{maxSquadSize})
                  </button>
                  <button
                    type="button"
                    className="lcd-subtab"
                    onClick={() => {
                      sound.play('cursor');
                      onNavigateMode('party');
                    }}
                  >
                    全部球盒 ({save.pets.length})
                  </button>
                </div>
                <button
                  type="button"
                  className="lcd-mini-close inline-icon-row"
                  onClick={() => {
                    if ((openedFromBattle || openedEntryMode === 'squad') && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  <span>{openedFromBattle ? '继续战斗' : openedEntryMode === 'squad' ? '关闭' : '返回'}</span>
                </button>
              </div>

              {/* Multi-Squad Preset Tabs + Add / Delete Squad Controls */}
              <div className="squad-preset-bar">
                <div className="squad-preset-scroll">
                  {presets.map((pr, idx) => (
                    <button
                      key={pr.id}
                      type="button"
                      className={`squad-preset-pill ${idx === activeIdx ? 'active' : ''}`}
                      onClick={() => selectPreset(idx)}
                    >
                      {pr.name} ({pr.petIds.filter((id) => save.pets.some((p) => p.id === id)).length})
                    </button>
                  ))}
                  {presets.length < 8 && (
                    <button
                      type="button"
                      className="squad-preset-add"
                      title="新建编队方案"
                      onClick={addNewPreset}
                    >
                      + 新建
                    </button>
                  )}
                </div>
                <div className="squad-preset-ops">
                  {activeTeamPets.length > 0 && (
                    <button
                      type="button"
                      className="squad-op-btn"
                      title="一键移出当前队伍全部成员"
                      onClick={clearAllMembers}
                    >
                      清空成员
                    </button>
                  )}
                  {presets.length > 1 && (
                    <button
                      type="button"
                      className="squad-op-btn is-danger"
                      title={`删除「${curPreset.name}」`}
                      onClick={deleteCurrentPreset}
                    >
                      删队
                    </button>
                  )}
                </div>
              </div>

              {/* Spacious Squad Slot Grid: Filled Cards + Empty '+' Cards (Click '+' -> Page 2 Poké Box Picker!) */}
              <div className="squad-slots-stage scroll-y">
                <div className="squad-active-grid is-spacious">
                  {Array.from({ length: maxSquadSize }).map((_, slotIdx) => {
                    const p = activeTeamPets[slotIdx] ?? null;
                    if (!p) {
                      return (
                        <button
                          key={`empty_${slotIdx}`}
                          type="button"
                          className="squad-add-card"
                          title="点击从精灵球盒选择宝可梦加入队伍"
                          onClick={() => {
                            sound.play('cursor');
                            setSquadPickerSlot(slotIdx);
                          }}
                        >
                          <span className="squad-add-plus">+</span>
                          <small>选择宝可梦</small>
                        </button>
                      );
                    }
                    const st = getGrowthStage(p.level, p.species);
                    const ivRank = getIvRank(getPetIVs(p));
                    const isLead = p.id === pet.id;
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(slotIdx));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                          if (Number.isInteger(fromIdx) && fromIdx !== slotIdx && fromIdx >= 0 && fromIdx < curIds.length && slotIdx < curIds.length) {
                            sound.play('cursor');
                            const nextIds = [...curIds];
                            const [mv] = nextIds.splice(fromIdx, 1);
                            nextIds.splice(slotIdx, 0, mv);
                            const nextPresets = presets.map((pr, i) => (i === activeIdx ? { ...pr, petIds: nextIds } : pr));
                            savePresets(nextPresets, activeIdx);
                          }
                        }}
                        className={`squad-slot-card ${isLead ? 'is-lead' : ''}`}
                      >
                        <button
                          type="button"
                          className="squad-slot-main"
                          title={`查看「${p.name}」详情与招式配置`}
                          onClick={() => {
                            setSelectedPartyPetId(p.id);
                            setPartyDetailTab('stats');
                            setDetailReturnMode('squad');
                            onNavigateMode('party_detail');
                          }}
                        >
                          <div className="squad-slot-top">
                            <span className={`tile-tl-badge iv-${ivRank}`}>{ivRank}</span>
                            <em className="tile-tr-lv">Lv.{p.level}</em>
                          </div>
                          <PixelPetSprite species={p.species} pose="idle0" stage={st} size={56} />
                          <strong className="squad-slot-name">
                            {isLead ? '★ ' : ''}{p.name}
                          </strong>
                        </button>
                        <div className="squad-slot-actions">
                          {!isLead && (
                            <button
                              type="button"
                              className="squad-mini-btn"
                              title="设为领队主角伙伴"
                              onClick={() => onSwitchPet(p.id)}
                            >
                              领队
                            </button>
                          )}
                          <button
                            type="button"
                            className="squad-mini-btn"
                            title="从球盒替换此位置宝可梦"
                            onClick={() => {
                              sound.play('cursor');
                              setSquadPickerSlot(slotIdx);
                            }}
                          >
                            替换
                          </button>
                          <button
                            type="button"
                            className="squad-mini-btn is-rm"
                            title="移出当前队伍"
                            onClick={() => removeMemberAt(p.id)}
                          >
                            移出
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* PARTY GRID (精灵球盒 & 寄存箱 — 统一交互、搜索筛选排序与图标化批量管理!) */}
        {mode === 'party' && (() => {
          const isStorageTab = partyBoxTab === 'storage';
          const sourceList = isStorageTab ? (save.storedPets ?? []) : save.pets;
          const q = partySearch.trim().toLowerCase();
          const rankWeight = (r: string) => (r === 'SS' ? 4 : r === 'S' ? 3 : r === 'A' ? 2 : 1);
          const filteredPets = sourceList
            .filter((p) => {
              const sp = SPECIES_CATALOG[p.species];
              const ivRank = getIvRank(getPetIVs(p));
              if (partyGradeFilter !== 'all' && ivRank !== partyGradeFilter) return false;
              if (!q) return true;
              const stName = sp.stageNames[getGrowthStage(p.level, p.species)] ?? sp.defaultName;
              return (
                p.name.toLowerCase().includes(q) ||
                sp.defaultName.toLowerCase().includes(q) ||
                stName.toLowerCase().includes(q) ||
                sp.typeLabel.toLowerCase().includes(q)
              );
            })
            .sort((a, b) => {
              if (partySortBy === 'level') return b.level - a.level;
              if (partySortBy === 'grade') {
                const diff = rankWeight(getIvRank(getPetIVs(b))) - rankWeight(getIvRank(getPetIVs(a)));
                return diff !== 0 ? diff : b.level - a.level;
              }
              return 0;
            });

          const selectedSet = new Set(
            batchSelectedIds.filter((id) => {
              if (!isStorageTab && id === pet.id) return false;
              return sourceList.some((p) => p.id === id);
            }),
          );
          const selectedPets = sourceList.filter((p) => selectedSet.has(p.id));
          const previewCoins = selectedPets.reduce((acc, p) => acc + getReleaseReward(p).coins, 0);
          const selectableVisible = isStorageTab
            ? filteredPets
            : filteredPets.filter((p) => p.id !== pet.id);
          const freeBoxSlots = Math.max(0, MAX_PET_SLOTS - save.pets.length);

          const toggleSelectPet = (id: string) => {
            if (!isStorageTab && id === pet.id) return;
            sound.play('cursor');
            setConfirmBatchRelease(false);
            setConfirmBatchDeposit(false);
            setConfirmBatchWithdraw(false);
            setBatchSelectedIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            );
          };

          const resetBatchState = () => {
            setBatchSelectedIds([]);
            setConfirmBatchRelease(false);
            setConfirmBatchDeposit(false);
            setConfirmBatchWithdraw(false);
          };

          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="party-storage-bar">
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${partyBoxTab === 'active' ? 'active' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      resetBatchState();
                      setPartyBoxTab('active');
                    }}
                  >
                    <PixelItemImg src="/sprites/items/poke-ball.png" size={13} />
                    <span>球盒 ({save.pets.length}/{MAX_PET_SLOTS})</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${partyBoxTab === 'storage' ? 'active' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      resetBatchState();
                      setPartyBoxTab('storage');
                    }}
                  >
                    <span>📦 寄存箱 ({(save.storedPets ?? []).length})</span>
                  </button>
                </div>
                <div className="lcd-head-actions">
                  <button
                    type="button"
                    className={`lcd-subtab ${partyBatchMode ? 'active' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      setPartyBatchMode((v) => {
                        if (v) resetBatchState();
                        return !v;
                      });
                    }}
                  >
                    {partyBatchMode ? '完成管理' : '批量管理'}
                  </button>
                  <button
                    type="button"
                    className="lcd-subtab inline-icon-btn"
                    onClick={() => {
                      setMarketTab('gacha');
                      setGachaPhase('idle');
                      onNavigateMode('market');
                    }}
                  >
                    <PixelItemImg src="/sprites/items/poke-ball.png" size={13} />
                    <span>+ 抽盲盒</span>
                  </button>
                  <button
                    type="button"
                    className="lcd-mini-close inline-icon-row"
                    onClick={() => {
                      setPartyBatchMode(false);
                      resetBatchState();
                      if ((openedFromBattle || openedEntryMode === 'party') && onCloseHandheldTo3D) {
                        onCloseHandheldTo3D();
                      } else {
                        onNavigateMode('menu');
                      }
                    }}
                  >
                    {openedFromBattle && <PixelIcon name="play" size={10} />}
                    <span>
                      {openedFromBattle ? '继续战斗' : openedEntryMode === 'party' ? '关闭' : '返回'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Compact Search + Grade Filter + Sort Toolbar */}
              <div className="party-tool-bar">
                <div className="party-search-wrap">
                  <input
                    type="text"
                    className="party-search-input"
                    placeholder="搜索昵称 / 种族 / 属性..."
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                  />
                  {partySearch && (
                    <button
                      type="button"
                      className="party-search-clear"
                      aria-label="清空搜索"
                      onClick={() => setPartySearch('')}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="party-filter-pills">
                  {(['all', 'S', 'A', 'B'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`party-mini-pill ${partyGradeFilter === g ? 'active' : ''}`}
                      onClick={() => {
                        sound.play('cursor');
                        setPartyGradeFilter(g);
                      }}
                    >
                      {g === 'all' ? '全部' : `${g}级`}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`party-mini-pill ${partySortBy !== 'default' ? 'active' : ''}`}
                    title="切换排序方式"
                    onClick={() => {
                      sound.play('cursor');
                      setPartySortBy((s) => (s === 'default' ? 'level' : s === 'level' ? 'grade' : 'default'));
                    }}
                  >
                    {partySortBy === 'default' ? '默认序' : partySortBy === 'level' ? '等级↓' : '评级↓'}
                  </button>
                </div>
              </div>

              {/* Unified Batch Action Strip (Active Box: 寄存 + 放生 | Storage Box: 放回球盒 + 放生) */}
              {partyBatchMode && (
                <div className="party-batch-bar">
                  <div className="party-batch-quick">
                    <button
                      type="button"
                      className="party-mini-pill"
                      onClick={() => {
                        sound.play('cursor');
                        setConfirmBatchRelease(false);
                        setConfirmBatchDeposit(false);
                        setConfirmBatchWithdraw(false);
                        const bIds = selectableVisible
                          .filter((p) => getIvRank(getPetIVs(p)) === 'B')
                          .map((p) => p.id);
                        setBatchSelectedIds(bIds);
                      }}
                    >
                      快选B级
                    </button>
                    <button
                      type="button"
                      className="party-mini-pill"
                      onClick={() => {
                        sound.play('cursor');
                        setConfirmBatchRelease(false);
                        setConfirmBatchDeposit(false);
                        setConfirmBatchWithdraw(false);
                        if (selectedSet.size === selectableVisible.length && selectableVisible.length > 0) {
                          setBatchSelectedIds([]);
                        } else {
                          setBatchSelectedIds(selectableVisible.map((p) => p.id));
                        }
                      }}
                    >
                      {selectedSet.size === selectableVisible.length && selectableVisible.length > 0 ? '取消全选' : '全选当前'}
                    </button>
                    {selectedSet.size > 0 && (
                      <span className="party-batch-count">已选 {selectedSet.size} 只</span>
                    )}
                  </div>
                  <div className="party-batch-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isStorageTab ? (
                      onWithdrawPetsBatch && (
                        <button
                          type="button"
                          className={`party-batch-deposit-btn inline-icon-btn ${confirmBatchWithdraw ? 'is-confirm' : ''}`}
                          disabled={selectedSet.size === 0 || Boolean(openedFromBattle) || freeBoxSlots <= 0}
                          title={
                            openedFromBattle
                              ? '战斗进行中无法取出，请结束本局后再放回球盒'
                              : freeBoxSlots <= 0
                                ? `球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})`
                                : '批量放回随身球盒'
                          }
                          aria-label="批量放回球盒"
                          onClick={() => {
                            if (selectedSet.size === 0 || openedFromBattle || freeBoxSlots <= 0) return;
                            if (!confirmBatchWithdraw) {
                              sound.play('cursor');
                              setConfirmBatchRelease(false);
                              setConfirmBatchWithdraw(true);
                              return;
                            }
                            const res = onWithdrawPetsBatch(Array.from(selectedSet));
                            resetBatchState();
                            if (res?.message) {
                              setBatchFeedback(res.message);
                              window.setTimeout(() => setBatchFeedback(null), 2600);
                            }
                          }}
                        >
                          <PixelItemImg src="/sprites/items/poke-ball.png" size={14} />
                          {confirmBatchWithdraw ? (
                            <span>确认放回球盒 {Math.min(selectedSet.size, freeBoxSlots)} 只?</span>
                          ) : (
                            <span>{selectedSet.size > 0 ? selectedSet.size : '0'}</span>
                          )}
                        </button>
                      )
                    ) : (
                      onDepositPetsBatch && (
                        <button
                          type="button"
                          className={`party-batch-deposit-btn inline-icon-btn ${confirmBatchDeposit ? 'is-confirm' : ''}`}
                          disabled={selectedSet.size === 0 || Boolean(openedFromBattle)}
                          title={
                            openedFromBattle
                              ? '战斗进行中无法寄存，请结束本局后再寄存'
                              : '批量寄存至大木博士寄放箱'
                          }
                          aria-label="批量寄存"
                          onClick={() => {
                            if (selectedSet.size === 0 || openedFromBattle) return;
                            if (!confirmBatchDeposit) {
                              sound.play('cursor');
                              setConfirmBatchRelease(false);
                              setConfirmBatchDeposit(true);
                              return;
                            }
                            const res = onDepositPetsBatch(Array.from(selectedSet));
                            resetBatchState();
                            if (res?.ok) {
                              setBatchFeedback(res.message);
                              window.setTimeout(() => setBatchFeedback(null), 2600);
                            }
                          }}
                        >
                          <PixelItemImg src="/sprites/items/poke-ball.png" size={14} />
                          {confirmBatchDeposit ? (
                            <span>确认寄存 {selectedSet.size} 只?</span>
                          ) : (
                            <span>{selectedSet.size > 0 ? selectedSet.size : '0'}</span>
                          )}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className={`party-batch-release-btn inline-icon-btn ${confirmBatchRelease ? 'is-confirm' : ''}`}
                      disabled={selectedSet.size === 0}
                      title="批量放生并返还金币"
                      aria-label="批量放生"
                      onClick={() => {
                        if (selectedSet.size === 0) return;
                        if (!confirmBatchRelease) {
                          sound.play('cursor');
                          setConfirmBatchDeposit(false);
                          setConfirmBatchWithdraw(false);
                          setConfirmBatchRelease(true);
                          return;
                        }
                        const res = isStorageTab
                          ? onReleaseStoredPetsBatch?.(Array.from(selectedSet))
                          : onReleasePetsBatch?.(Array.from(selectedSet));
                        resetBatchState();
                        if (res?.ok) {
                          setBatchFeedback(res.message);
                          window.setTimeout(() => setBatchFeedback(null), 2600);
                        }
                      }}
                    >
                      <PixelIcon name="paw" size={12} />
                      {confirmBatchRelease ? (
                        <span>确认放生 {selectedSet.size} 只 (+{previewCoins}G)?</span>
                      ) : (
                        <span>
                          {selectedSet.size > 0 ? `${selectedSet.size} · +${previewCoins}G` : '0'}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {batchFeedback && <div className="party-batch-toast">{batchFeedback}</div>}

              <div className="lcd-grid-4 party-compact-grid scroll-y">
                {filteredPets.length === 0 ? (
                  <div className="party-empty-hint">
                    {isStorageTab && sourceList.length === 0
                      ? '寄存箱目前为空'
                      : '未找到匹配的宝可梦，试试更换关键词或评级筛选'}
                  </div>
                ) : (
                  filteredPets.map((p) => {
                    const isCur = !isStorageTab && p.id === pet.id;
                    const isChecked = selectedSet.has(p.id);
                    const st = getGrowthStage(p.level, p.species);
                    const ballMeta =
                      ROOM_CATALOG.find((r) => r.id === p.ballRoom) ?? ROOM_CATALOG[0];
                    const ivRank = getIvRank(getPetIVs(p));
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`lcd-grid-tile compact party-compact-tile ${isCur ? 'is-selected' : ''} ${partyBatchMode && isChecked ? 'is-batch-checked' : ''} ${partyBatchMode && isCur ? 'is-batch-locked' : ''}`}
                        title={
                          partyBatchMode
                            ? isCur
                              ? '当前出战伙伴不可批量操作'
                              : `点击${isChecked ? '取消' : '选中'}「${p.name}」`
                            : `${p.name} · Lv.${p.level} · ${NATURE_CATALOG[getPetNature(p)].name} · ${ivRank}级`
                        }
                        onClick={() => {
                          if (partyBatchMode) {
                            toggleSelectPet(p.id);
                            return;
                          }
                          setSelectedPartyPetId(p.id);
                          setConfirmReleaseId(null);
                          setPetActionMenuOpen(false);
                          setPartyDetailTab('stats');
                          setDetailReturnMode('party');
                          onNavigateMode('party_detail');
                        }}
                      >
                        <div className="tile-tl-group">
                          {partyBatchMode ? (
                            isCur ? (
                              <em className="tile-tl-badge is-lock">出战</em>
                            ) : (
                              <span className={`party-batch-chk ${isChecked ? 'is-on' : ''}`}>
                                {isChecked ? '✓' : ''}
                              </span>
                            )
                          ) : (
                            <PixelItemImg src={ballMeta.ballSprite} size={18} />
                          )}
                          <em className={`tile-tl-badge iv-${ivRank}`}>{ivRank}</em>
                          {p.isSleeping && <em className="tile-tl-badge is-sleep">休眠</em>}
                        </div>
                        <em className="tile-tr-lv">Lv.{p.level}</em>
                        <div className="party-sprite-hero">
                          <PixelPetSprite
                            species={p.species}
                            pose="idle0"
                            stage={st}
                            size={58}
                          />
                        </div>
                        <span className="tile-corner-name">{p.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

    </>
  );
};
