import React, { useEffect, useState } from 'react';
import {
  ACCESSORY_CATALOG,
  ACHIEVEMENTS,
  FOOD_CATALOG,
  GACHA_BOXES,
  NATURE_CATALOG,
  POKEDEX_ORDER,
  ROOM_CATALOG,
  SHELL_THEMES,
  SPECIES_CATALOG,
  TALENT_CATALOG,
  getGrowthStage,
  getIvRank,
  getNextEvolutionHint,
  getPokemonCryId,
  getPokemonDexNo,
  getPokemonStageName,
  getXpForNextLevel,
} from '../data/catalog';
import {
  BOND_MILESTONES,
  POKEMON_SKIN_CATALOG,
  SPECIES_MEGA_FORMS,
  computePetBondBonuses,
  ensureFreshMetaProgress,
  getHeroDef,
  getSkinDef,
} from '../data/metaProgression';
import { resolveBadgeIconName, type PixelIconName } from '../data/pixelIcons';
import { POOP_SPRITE, type PetAnimPose } from '../data/sprites';
import {
  ALL_SURVIVOR_SKILL_IDS,
  CAST_MODE_OPTIONS,
  DIFFICULTIES,
  FORMATION_OPTIONS,
  MAP_REGIONS,
  SURVIVOR_SKILLS,
  TARGET_PRIORITY_OPTIONS,
  type CastCadenceMode,
  type FollowerFormation,
  type LiveRunTacticsBridge,
  type SurvivorSkillId,
  type TargetPriority,
} from '../data/survivorsTactics';
import {
  DEFAULT_GAME_PREFS,
  DEFAULT_TRAINER_PROFILE,
  type AccessoryId,
  type ActionAnim,
  type EnemyDisplayMode,
  type FloatingEffect,
  type FoodId,
  type GachaBoxId,
  type GamePrefs,
  type GameSave,
  type GraphicsQualityMode,
  type KeyBindings,
  type LcdMode,
  type PetRecord,
  type RoomThemeId,
  ShellThemeId,
  SpeciesId,
} from '../types/pet';
import type {
  BattleResultPayload,
  GachaOutcome,
  GachaTenOutcome,
  SurvivorsResultPayload,
} from '../utils/petEngine';
import {
  DEFAULT_KEY_BINDINGS,
  MAX_PET_SLOTS,
  STAMINA_COSTS,
  getAccessoryAvailability,
  getBallAvailability,
  getPetIVs,
  getPetMood,
  getPetNature,
  getPetTalent,
  getReleaseReward,
  getStaminaNextRecoverySec,
} from '../utils/petEngine';
import { sound } from '../utils/sound';
import { BattleArena } from './BattleArena';
import type { AppSettingsPatch } from './HandheldConsole';
import { DEFAULT_ANNOUNCEMENTS } from './MetaOverlays';
import { HandheldWorldMapView, type WorldMapData } from './WorldMapHud';
import { CatchTreatsGame, PeekabooGame } from './MiniGames';
import {
  PixelFillMeter,
  PixelIcon,
  PixelItemImg,
  PixelOverlayIcon,
  PixelPetIcon,
  PixelPetPortrait,
  PixelPetSprite,
  PixelPettingHand,
} from './PixelSprite';
import { PokeballRoomBg } from './PokeballRoomBg';
import { Survivors3DArena } from './Survivors3DArena';

export type HomeIconActionId = 'clean' | 'light' | 'play' | 'recall';

// Bottom Dock: 4 direct Pet Actions (Bag, Shop Coin, and Menu are all Level-1 top-right buttons!)
export const HOME_SIDE_ACTIONS: {
  id: HomeIconActionId;
  itemImg: string;
  label: string;
}[] = [
  { id: 'clean', itemImg: '/sprites/items/fresh-water.png', label: '洗澡清理' },
  { id: 'light', itemImg: '/sprites/items/light-ball.png', label: '开关灯休息' },
  { id: 'play', itemImg: '/sprites/items/vs-seeker.png', label: '特训小游戏' },
  { id: 'recall', itemImg: '/sprites/items/poke-ball.png', label: '收起精灵球 · 外出对战' },
];

export function isHomeActionDisabled(
  action: HomeIconActionId,
  pet: PetRecord,
  stamina = 99,
): boolean {
  switch (action) {
    case 'clean':
      return (
        pet.isSleeping ||
        (pet.cleanliness >= 100 && pet.poopCount <= 0) ||
        stamina < STAMINA_COSTS.clean
      );
    case 'light':
      return !pet.isSleeping && pet.energy >= 100;
    case 'play':
      return pet.isSleeping || pet.energy < 12 || stamina < STAMINA_COSTS.play;
    case 'recall':
      return pet.isSleeping;
  }
}

function getHomeActionTitle(
  item: { id: HomeIconActionId; label: string },
  pet: PetRecord,
  stamina: number,
): string {
  if (!isHomeActionDisabled(item.id, pet, stamina)) {
    if (item.id === 'light') {
      return pet.isSleeping ? '开灯唤醒宝可梦' : '关灯休息恢复体力';
    }
    if (item.id === 'clean') return `洗澡清理（消耗 ${STAMINA_COSTS.clean} 体力）`;
    if (item.id === 'play') return `特训小游戏（消耗 ${STAMINA_COSTS.play} 体力）`;
    if (item.id === 'recall') return '收起精灵球，前往关都野外地图冒险与对战！';
    return item.label;
  }
  switch (item.id) {
    case 'clean':
      if (pet.isSleeping) return '睡眠中不可洗澡';
      if (stamina < STAMINA_COSTS.clean) return `体力不足（需要 ${STAMINA_COSTS.clean}，请等待恢复）`;
      return '清洁度已满，干干净净啦';
    case 'light':
      return '体力满格，精神充沛不想睡';
    case 'play':
      if (pet.isSleeping) return '睡眠中不可特训';
      if (stamina < STAMINA_COSTS.play) return `体力不足（需要 ${STAMINA_COSTS.play}，请等待恢复）`;
      return '宝可梦体力不足，先休息恢复吧';
    case 'recall':
      return '睡眠中请先开灯叫醒再收起精灵球';
  }
}

interface LcdScreenProps {
  save: GameSave;
  pet: PetRecord;
  mode: LcdMode;
  battleIsTrainer: boolean;
  actionAnim: ActionAnim;
  patSeq: number;
  activeFood: FoodId | null;
  speech: string | null;
  effects: FloatingEffect[];
  bezelIndex: number;
  menuCursor: number;
  controlSignal: {
    seq: number;
    dir: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | null;
  };
  analogVecRef: React.MutableRefObject<{ x: number; y: number }>;
  onNavigateMode: (next: LcdMode) => void;
  onHomeIconClick: (action: HomeIconActionId, idx: number) => void;
  onPatPet: () => void;
  onCleanPoop: () => void;
  onHealPet: () => void;
  onHealParty: () => void;
  onReleaseBallToRoom: () => void;
  onStartBattle: (isTrainer: boolean) => void;
  onFinishBattle: (fighterId: string, payload: BattleResultPayload) => void;
  onFinishSurvivors: (petId: string, payload: SurvivorsResultPayload, returnToRoom?: boolean) => void;
  onSpendCoinsInRun: (cost: number) => boolean;
  onCaptureBoss: (species: SpeciesId, level: number) => void;
  onSelectFood: (foodId: FoodId) => void;
  onBuyFood: (foodId: FoodId) => void;
  onStartGame: (game: 'game_catch' | 'game_peekaboo') => void;
  onFinishGame: (gameLabel: string, score: number, won: boolean) => void;
  onBuyAccessory: (id: AccessoryId) => void;
  onEquipAccessory: (petId: string, id: AccessoryId) => void;
  onBuyPokeball: (roomId: RoomThemeId) => void;
  onAssignPetRoom: (petId: string, roomId: RoomThemeId) => void;
  onPullGacha: (boxId: GachaBoxId) => GachaOutcome;
  onPullGachaTen: (boxId: GachaBoxId) => GachaTenOutcome;
  onReleasePet: (petId: string) => boolean;
  onReleasePetsBatch?: (petIds: string[]) => { ok: boolean; count: number; coins: number; xp: number; message: string };
  onSwitchPet: (petId: string) => void;
  onUpdatePetConfig?: (
    petId: string,
    patch: {
      enhanceCost?: number;
      enhanceDelta?: number;
      pinnedSkills?: string[];
      bannedSkills?: string[];
      skin?: import('../types/pet').PetSkinId;
      skinCost?: number;
      unlockSkin?: string;
    },
  ) => boolean;
  onUpdateSettings: (patch: AppSettingsPatch) => void;
  onUpdateMeta?: (updater: (prev: import('../data/metaProgression').MetaProgressState) => import('../data/metaProgression').MetaProgressState, coinDelta?: number) => void;
  onResetSave: () => void;
  onExitMode: () => void;
  tacticsBridge?: LiveRunTacticsBridge | null;
  onCloseHandheldTo3D?: () => void;
  openedFromBattle?: boolean;
  openedEntryMode?: LcdMode | null;
  focusedDetailPetId?: string | null;
  captureReveal?: import('../types/pet').CaptureRevealPayload | null;
  worldMapData?: WorldMapData | null;
}

const STAT_BAR_ROWS: {
  key: 'hunger' | 'happiness' | 'cleanliness' | 'energy' | 'health';
  label: string;
  icon: PixelIconName;
  color: string;
}[] = [
  { key: 'hunger', label: '饱食', icon: 'meat', color: '#f59e42' },
  { key: 'happiness', label: '亲密', icon: 'smile', color: '#ff6b9d' },
  { key: 'cleanliness', label: '清洁', icon: 'bubble', color: '#4ecdc4' },
  { key: 'energy', label: '体力', icon: 'bolt', color: '#ffd43b' },
  { key: 'health', label: 'HP', icon: 'heart', color: '#51cf66' },
];

export const LcdScreen: React.FC<LcdScreenProps> = ({
  save,
  pet,
  mode,
  battleIsTrainer,
  actionAnim,
  patSeq,
  activeFood,
  speech,
  effects,
  bezelIndex,
  menuCursor,
  controlSignal,
  analogVecRef,
  onNavigateMode,
  onHomeIconClick,
  onPatPet,
  onCleanPoop,
  onHealPet,
  onHealParty,
  onFinishBattle,
  onFinishSurvivors,
  onSpendCoinsInRun,
  onCaptureBoss,
  onSelectFood,
  onBuyFood,
  onStartGame,
  onFinishGame,
  onBuyAccessory,
  onEquipAccessory,
  onBuyPokeball,
  onAssignPetRoom,
  onPullGacha,
  onPullGachaTen,
  onReleasePet,
  onReleasePetsBatch,
  onSwitchPet,
  onUpdatePetConfig,
  onUpdateSettings,
  onUpdateMeta,
  onResetSave,
  onExitMode,
  tacticsBridge,
  onCloseHandheldTo3D,
  openedFromBattle,
  openedEntryMode,
  focusedDetailPetId = null,
  captureReveal = null,
  worldMapData = null,
}) => {
  const [wanderOffset, setWanderOffset] = useState(0);
  const [facingLeft, setFacingLeft] = useState(false);
  const [idleHop, setIdleHop] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (save.stamina >= save.maxStamina) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [save.stamina, save.maxStamina]);

  const [bagTab, setBagTab] = useState<'berries' | 'items'>('berries');
  const [marketTab, setMarketTab] = useState<'gacha' | 'berries' | 'items' | 'skins'>('gacha');
  const [selectedPartyPetId, setSelectedPartyPetId] = useState<string>(focusedDetailPetId ?? pet.id);
  const [partyDetailTab, setPartyDetailTab] = useState<'stats' | 'profile' | 'gear' | 'train' | 'bond_mega'>('stats');
  const [detailReturnMode, setDetailReturnMode] = useState<'party' | 'home' | 'squad'>(
    openedFromBattle || openedEntryMode === 'squad' ? 'squad' : 'party',
  );
  const [partySearch, setPartySearch] = useState('');
  const [partyGradeFilter, setPartyGradeFilter] = useState<'all' | 'S' | 'A' | 'B'>('all');
  const [partySortBy, setPartySortBy] = useState<'default' | 'level' | 'grade'>('default');
  const [partyBatchMode, setPartyBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [confirmBatchRelease, setConfirmBatchRelease] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [squadPickerSlot, setSquadPickerSlot] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null);
  const [newsPhotoIdx, setNewsPhotoIdx] = useState(0);
  const [achCategory, setAchCategory] = useState<'all' | 'care' | 'dex' | 'battle' | 'collect' | 'legend'>('all');
  const [captureWhoStage, setCaptureWhoStage] = useState(false);

  useEffect(() => {
    if (mode !== 'capture_result' || !captureReveal?.isNewSpecies) {
      setCaptureWhoStage(false);
      return;
    }
    setCaptureWhoStage(true);
    const t = window.setTimeout(() => {
      sound.play('levelup');
      setCaptureWhoStage(false);
    }, 950);
    return () => window.clearTimeout(t);
  }, [mode, captureReveal]);

  useEffect(() => {
    if (focusedDetailPetId && save.pets.some((p) => p.id === focusedDetailPetId)) {
      setSelectedPartyPetId(focusedDetailPetId);
      setPartyDetailTab('stats');
      if (mode === 'party_detail' && (openedFromBattle || openedEntryMode === 'party_detail')) {
        setDetailReturnMode('squad');
      }
    }
  }, [focusedDetailPetId, mode, openedFromBattle, openedEntryMode, save.pets]);
  const [dexTab, setDexTab] = useState<'overview' | 'pokemon' | 'skills' | 'items' | 'journey'>('overview');
  const [selectedDexSpecies, setSelectedDexSpecies] = useState<SpeciesId>('pikachu');
  const [dexDetailTab, setDexDetailTab] = useState<'evo' | 'owned'>('evo');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);
  const [petActionMenuOpen, setPetActionMenuOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'audio' | 'hud' | 'perf' | 'style' | 'keys'>('audio');
  const [rebindingAction, setRebindingAction] = useState<keyof KeyBindings | null>(null);
  const [tacticsTab, setTacticsTab] = useState<'skills' | 'squad' | 'mode'>('skills');
  const [tacticsFollowerId, setTacticsFollowerId] = useState<string | null>(null);
  const [tacticsDetailTab, setTacticsDetailTab] = useState<'skills' | 'gear'>('skills');
  const [selectedSkillSlot, setSelectedSkillSlot] = useState<number>(0);
  const [inspectedSkillId, setInspectedSkillId] = useState<SurvivorSkillId>('thunderbolt');

  useEffect(() => {
    if (!rebindingAction) {
      delete document.body.dataset.capturingKey;
      return;
    }
    document.body.dataset.capturingKey = '1';
    const onCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key === ' ' ? 'Space' : e.key;
      const nextKb: KeyBindings = {
        ...(save.keyBindings ?? DEFAULT_KEY_BINDINGS),
        [rebindingAction]: key === 'Space' ? ' ' : key,
      };
      onUpdateSettings({ keyBindings: nextKb });
      setRebindingAction(null);
    };
    window.addEventListener('keydown', onCapture, true);
    return () => {
      delete document.body.dataset.capturingKey;
      window.removeEventListener('keydown', onCapture, true);
    };
  }, [rebindingAction, save.keyBindings, onUpdateSettings]);

  const [gachaPhase, setGachaPhase] = useState<'idle' | 'shaking' | 'reveal'>('idle');
  const [gachaResult, setGachaResult] = useState<GachaOutcome | null>(null);
  const [gachaTenResult, setGachaTenResult] = useState<GachaTenOutcome | null>(null);
  const [gachaReleased, setGachaReleased] = useState(false);
  const [releasedTenIds, setReleasedTenIds] = useState<string[]>([]);
  const [gachaBoxMeta, setGachaBoxMeta] = useState<{
    id: GachaBoxId;
    ballSprite: string;
    isTen: boolean;
  } | null>(null);

  useEffect(() => {
    if (pet.isSleeping || actionAnim !== 'idle' || mode !== 'home') {
      setWanderOffset(0);
      setIdleHop(false);
      return;
    }
    const id = window.setInterval(() => {
      const next = Math.round((Math.random() - 0.5) * 64);
      // PMD Row-1 sprites naturally face right, so flip when moving left!
      setFacingLeft(next < wanderOffset);
      setWanderOffset(next);
      if (Math.random() < 0.45) {
        setIdleHop(true);
        window.setTimeout(() => setIdleHop(false), 450);
      }
    }, 2400);
    return () => window.clearInterval(id);
  }, [pet.isSleeping, actionAnim, mode, wanderOffset]);

  const activeRoomId = pet.ballRoom ?? save.activeRoom ?? 'pokeball_room';
  const room = ROOM_CATALOG.find((r) => r.id === activeRoomId) ?? ROOM_CATALOG[0];
  const speciesMeta = SPECIES_CATALOG[pet.species];
  const mood = getPetMood(pet);
  const stage = getGrowthStage(pet.level, pet.species);
  const dexNo = getPokemonDexNo(pet.species, pet.level);
  const xpNeeded = getXpForNextLevel(pet.level);
  const xpPct = Math.min(100, Math.round((pet.xp / xpNeeded) * 100));
  const curPetIdx = Math.max(
    0,
    save.pets.findIndex((p) => p.id === pet.id),
  );
  const prevPet =
    save.pets.length > 1
      ? save.pets[(curPetIdx - 1 + save.pets.length) % save.pets.length]
      : null;
  const nextPet =
    save.pets.length > 1
      ? save.pets[(curPetIdx + 1) % save.pets.length]
      : null;
  const equippedAcc =
    pet.accessory !== 'none'
      ? ACCESSORY_CATALOG.find((a) => a.id === pet.accessory)
      : null;
  const activeFoodMeta = activeFood
    ? FOOD_CATALOG.find((f) => f.id === activeFood)
    : null;

  const hpBarColor =
    pet.health >= 55 ? '#48d167' : pet.health >= 25 ? '#f5c52b' : '#f04e4e';

  const resolvePose = (): PetAnimPose => {
    if (pet.isSleeping || actionAnim === 'sleeping') return 'sleep';
    if (
      actionAnim === 'happy' ||
      actionAnim === 'patting' ||
      actionAnim === 'eating' ||
      actionAnim === 'bathing' ||
      actionAnim === 'medicine' ||
      actionAnim === 'levelup'
    ) {
      return 'happy';
    }
    if (mood === 'sick' || mood === 'hungry' || mood === 'dirty') {
      return 'sad';
    }
    return 'idle0';
  };

  const handleStartGacha = (boxId: GachaBoxId, ballSprite: string) => {
    const res = onPullGacha(boxId);
    if (!res.ok) return;
    setGachaBoxMeta({ id: boxId, ballSprite, isTen: false });
    setGachaTenResult(null);
    setGachaResult(res);
    setGachaReleased(false);
    setGachaPhase('shaking');
    window.setTimeout(() => {
      setGachaPhase('reveal');
      if (res.pulledSpecies) {
        sound.playCry(getPokemonCryId(res.pulledSpecies, 5));
      }
    }, 900);
  };

  const handleStartGachaTen = (boxId: GachaBoxId, ballSprite: string) => {
    const res = onPullGachaTen(boxId);
    if (!res.ok) return;
    setGachaBoxMeta({ id: boxId, ballSprite, isTen: true });
    setGachaResult(null);
    setGachaTenResult(res);
    setReleasedTenIds([]);
    setGachaPhase('shaking');
    window.setTimeout(() => {
      setGachaPhase('reveal');
    }, 1000);
  };

  const partyDetailPet =
    save.pets.find((p) => p.id === selectedPartyPetId) ?? pet;
  const dexSpeciesMeta = SPECIES_CATALOG[selectedDexSpecies];
  const dexDiscovered = save.discoveredSpecies.includes(selectedDexSpecies);

  return (
    <div
      className={`lcd-viewport ${pet.isSleeping ? 'is-night' : ''}`}
      style={{
        backgroundColor: pet.isSleeping ? room.nightSky : room.daySky,
      }}
    >
      {/* Native Integrated Fullscreen Bar (ONLY when LCD is expanded to fullscreen over 3D!) */}
      {!save.showShell && onCloseHandheldTo3D && (
        <div className="lcd-fs-native-bar">
          <span className="inline-icon-row">
            <PixelItemImg src="/sprites/items/poke-radar.png" size={13} />
            <strong>POKé POCKET 终端</strong>
          </span>
          <div className="lcd-head-actions">
            <button
              type="button"
              className="lcd-subtab inline-icon-row"
              onClick={() => onUpdateSettings({ showShell: true })}
              title="切换回掌机外壳模式"
            >
              <PixelIcon name="shrink" size={10} />
              <span>掌机外壳</span>
            </button>
            <button
              type="button"
              className="lcd-mini-close is-resume inline-icon-row"
              onClick={onCloseHandheldTo3D}
            >
              <PixelIcon name="play" size={10} />
              <span>{openedFromBattle ? '继续战斗' : '返回 3D'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="lcd-body-area">
        {/* NATIVE PIXEL-ART TACTICS TERMINAL INSIDE HANDHELD LCD (招式 / 编队 / 策略) */}
        {mode === 'tactics' && tacticsBridge && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="lcd-subtabs">
                <button
                  type="button"
                  className={`lcd-subtab ${tacticsTab === 'skills' ? 'active' : ''}`}
                  onClick={() => setTacticsTab('skills')}
                >
                  招式
                </button>
                <button
                  type="button"
                  className={`lcd-subtab ${tacticsTab === 'squad' ? 'active' : ''}`}
                  onClick={() => setTacticsTab('squad')}
                >
                  编队({tacticsBridge.followers.length}/6)
                </button>
                <button
                  type="button"
                  className={`lcd-subtab ${tacticsTab === 'mode' ? 'active' : ''}`}
                  onClick={() => setTacticsTab('mode')}
                >
                  策略
                </button>
              </div>
              <div className="lcd-head-actions">
                <button
                  type="button"
                  className="lcd-subtab lcd-fs-toggle-btn inline-icon-row"
                  onClick={() => onUpdateSettings({ showShell: !save.showShell })}
                  title={save.showShell ? '展开为全屏模式' : '切换为掌机外壳模式'}
                >
                  <PixelIcon name={save.showShell ? 'fullscreen' : 'shrink'} size={10} />
                  <span>{save.showShell ? '全屏' : '外壳'}</span>
                </button>
                <button
                  type="button"
                  className="lcd-mini-close is-resume inline-icon-row"
                  onClick={() => {
                    tacticsBridge.onResumeBattle();
                    onCloseHandheldTo3D?.();
                  }}
                >
                  <PixelIcon name="play" size={10} />
                  <span>继续战斗</span>
                </button>
              </div>
            </div>

            {tacticsTab === 'skills' && (() => {
              const curF = tacticsFollowerId
                ? tacticsBridge.followers.find((f) => f.id === tacticsFollowerId) ?? null
                : null;

              // LEVEL 1: Clean Visual Squad Overview (Shows all 4 equal skills, NO 主槽/副槽!)
              if (!curF) {
                return (
                  <div className="lcd-tac-body scroll-y">
                    <div className="tac-squad-l1-grid">
                      {tacticsBridge.followers.map((f) => {
                        const four = [0, 1, 2, 3].map(
                          (idx) => SURVIVOR_SKILLS[f.skills[idx] ?? f.skills[0] ?? 'swift_volley'],
                        );
                        return (
                          <button
                            key={f.id}
                            type="button"
                            className="tac-poke-overview-card"
                            onClick={() => {
                              setTacticsFollowerId(f.id);
                              setTacticsDetailTab('skills');
                              setSelectedSkillSlot(0);
                              setInspectedSkillId(four[0].id);
                            }}
                          >
                            <div className="tac-poke-ov-left">
                              <div className="tac-poke-ov-avatar">
                                <img src={f.sprite} alt={f.name} draggable={false} />
                                <em className="tac-ov-lv">Lv.{f.level}</em>
                              </div>
                              <strong>{f.name}</strong>
                            </div>
                            <div className="tac-poke-ov-moves is-four">
                              {four.map((sk, idx) => (
                                <div
                                  key={`${f.id}_${idx}`}
                                  className="tac-ov-move-pill is-compact"
                                  style={{ borderLeftColor: sk.color }}
                                >
                                  <PixelItemImg src={sk.sprite} size={16} />
                                  <div className="tac-ov-move-txt">
                                    <strong>{sk.name}</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <span className="tac-ov-enter">配置 ›</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // LEVEL 2: Dedicated Pokémon Loadout Page with Clean 2-Tab Switcher (招式配置 4槽 | 携带装备)
              const fourIds = [0, 1, 2, 3].map((idx) => curF.skills[idx] ?? curF.skills[0] ?? 'swift_volley');
              const activeSk = SURVIVOR_SKILLS[inspectedSkillId] ?? SURVIVOR_SKILLS[fourIds[0]];
              const activeEstDmg = Math.round(
                tacticsBridge.baseAtk *
                  tacticsBridge.atkMult *
                  activeSk.powerMult *
                  (0.9 + curF.level * 0.25),
              );
              const boxPet = curF.sourcePetId
                ? save.pets.find((p) => p.id === curF.sourcePetId) ?? null
                : null;
              const curAccId: AccessoryId = boxPet?.accessory ?? 'none';
              const curAccMeta = ACCESSORY_CATALOG.find((a) => a.id === curAccId) ?? ACCESSORY_CATALOG[0];

              return (
                <div className="lcd-tac-body scroll-y">
                  <div className="tac-l2-head">
                    <button
                      type="button"
                      className="lcd-subtab tac-l2-back"
                      onClick={() => setTacticsFollowerId(null)}
                    >
                      ‹ 返回随从列表
                    </button>
                    <div className="tac-l2-tabs">
                      <button
                        type="button"
                        className={`lcd-subtab ${tacticsDetailTab === 'skills' ? 'is-active' : ''}`}
                        onClick={() => {
                          sound.play('cursor');
                          setTacticsDetailTab('skills');
                        }}
                      >
                        招式 (4)
                      </button>
                      <button
                        type="button"
                        className={`lcd-subtab ${tacticsDetailTab === 'gear' ? 'is-active' : ''}`}
                        onClick={() => {
                          sound.play('cursor');
                          setTacticsDetailTab('gear');
                        }}
                      >
                        携带装备
                      </button>
                    </div>
                    <div className="tac-l2-pet">
                      <img src={curF.sprite} alt={curF.name} className="surv-minion-ico" draggable={false} />
                      <strong>{curF.name}</strong>
                      <em>Lv.{curF.level}</em>
                    </div>
                  </div>

                  {tacticsDetailTab === 'skills' ? (
                    <>
                      {/* 4 Equal Move Slots (2x2 Grid — Click any slot to edit it, ZERO 主槽/副槽!) */}
                      <div className="equipped-slots-row is-four">
                        {[0, 1, 2, 3].map((slot) => {
                          const sk = SURVIVOR_SKILLS[fourIds[slot]];
                          const estDmg = Math.round(
                            tacticsBridge.baseAtk *
                              tacticsBridge.atkMult *
                              sk.powerMult *
                              (0.9 + curF.level * 0.25),
                          );
                          const isTargetSlot = selectedSkillSlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              className={`eq-slot-box is-visual is-compact ${isTargetSlot ? 'is-inspected' : ''}`}
                              style={{ borderLeftWidth: 4, borderLeftColor: sk.color }}
                              onClick={() => {
                                sound.play('cursor');
                                setSelectedSkillSlot(slot);
                                setInspectedSkillId(sk.id);
                              }}
                            >
                              <div className="eq-slot-ico">
                                <PixelItemImg src={sk.sprite} size={20} />
                              </div>
                              <div className="eq-slot-meta">
                                <small>招式 {slot + 1} · 伤{estDmg}</small>
                                <strong>{sk.name}</strong>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* 4x2 Authentic Skill Pixel-Art Icon Grid */}
                      <div className="skill-icon-grid">
                        {ALL_SURVIVOR_SKILL_IDS.map((sid) => {
                          const sk = SURVIVOR_SKILLS[sid];
                          const equippedIdx = fourIds.indexOf(sid);
                          const isEquipped = equippedIdx !== -1;
                          const isInSelectedSlot = fourIds[selectedSkillSlot] === sid;
                          const isInsp = inspectedSkillId === sid;
                          return (
                            <div
                              key={sid}
                              role="button"
                              tabIndex={0}
                              className={`skill-icon-tile ${isInsp ? 'is-inspected' : ''} ${isEquipped ? 'is-equipped' : ''}`}
                              style={{ '--sk-color': sk.color } as React.CSSProperties}
                              onMouseEnter={() => setInspectedSkillId(sid)}
                              onClick={() => {
                                setInspectedSkillId(sid);
                                tacticsBridge.onSetFollowerSkill(curF.id, selectedSkillSlot, sid);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setInspectedSkillId(sid);
                                  tacticsBridge.onSetFollowerSkill(curF.id, selectedSkillSlot, sid);
                                }
                              }}
                              title={`${sk.name} (${sk.tag}) · 点击装入招式 ${selectedSkillSlot + 1}`}
                            >
                              <span className="sk-corner-tag" style={{ backgroundColor: sk.color }}>
                                {sk.tag}
                              </span>
                              {isEquipped && (
                                <em className="sk-corner-eq">槽{equippedIdx + 1}</em>
                              )}
                              <div className="sk-hero-ico">
                                <PixelItemImg src={sk.sprite} size={30} />
                              </div>
                              <span className="sk-corner-name">{sk.name}</span>

                              <div className="sk-hover-ops">
                                <button
                                  type="button"
                                  className={`sk-op-mini ${isInSelectedSlot ? 'is-on' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    tacticsBridge.onSetFollowerSkill(curF.id, selectedSkillSlot, sid);
                                  }}
                                >
                                  {isInSelectedSlot ? `槽${selectedSkillSlot + 1}✓` : `装槽${selectedSkillSlot + 1}`}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Live Selected / Hovered Skill Inspector & Action Bar */}
                      <div className="skill-inspector-bar" style={{ borderLeftColor: activeSk.color }}>
                        <div className="sk-insp-info">
                          <div className="inline-icon-row">
                            <PixelItemImg src={activeSk.sprite} size={18} />
                            <strong>{activeSk.name}</strong>
                            <span className="sk-tag" style={{ backgroundColor: activeSk.color }}>
                              伤{activeEstDmg} · {activeSk.baseCd}s
                            </span>
                          </div>
                          <small>{activeSk.desc}</small>
                        </div>
                        <div className="sk-insp-actions">
                          <button
                            type="button"
                            className={`sk-assign-btn ${fourIds[selectedSkillSlot] === activeSk.id ? 'is-on' : ''}`}
                            onClick={() => tacticsBridge.onSetFollowerSkill(curF.id, selectedSkillSlot, activeSk.id)}
                          >
                            {fourIds[selectedSkillSlot] === activeSk.id
                              ? `招式${selectedSkillSlot + 1}已装✓`
                              : `装入招式 ${selectedSkillSlot + 1}`}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Dedicated Held Equipment / Gear Tab (Cleanly separated from Skills!) */
                    <div className="tac-gear-pane">
                      <div className="tac-gear-cur">
                        <div className="tac-gear-cur-ico">
                          <PixelItemImg src={curAccMeta.itemSprite} size={28} />
                        </div>
                        <div className="tac-gear-cur-meta">
                          <strong>当前携带：{curAccMeta.name}</strong>
                          <small>{curAccMeta.description}</small>
                        </div>
                      </div>
                      {boxPet ? (
                        <div className="tac-gear-grid">
                          {ACCESSORY_CATALOG.filter(
                            (a) => a.id === 'none' || save.unlockedAccessories.includes(a.id),
                          ).map((acc) => {
                            const active = acc.id === curAccId;
                            return (
                              <button
                                key={acc.id}
                                type="button"
                                className={`tac-gear-tile ${active ? 'is-active' : ''}`}
                                onClick={() => onEquipAccessory(boxPet.id, acc.id)}
                                title={`${acc.name}：${acc.description}`}
                              >
                                <PixelItemImg src={acc.itemSprite} size={28} />
                                <strong>{acc.name}</strong>
                                <small>{active ? '已装备' : acc.description}</small>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="tac-gear-empty">
                          该伙伴为本局临时招募，收服加入精灵球盒后即可自由更换携带装备！
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {tacticsTab === 'squad' && (
              <div className="lcd-tac-body scroll-y">
                <div className="setup-squad-grid">
                  {save.pets.map((p) => {
                    const on = tacticsBridge.followers.some((f) => f.sourcePetId === p.id);
                    const stg = getGrowthStage(p.level, p.species);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`squad-pick-chip ${on ? 'is-picked' : ''}`}
                        onClick={() => tacticsBridge.onToggleFollower(p.id)}
                      >
                        <img
                          src={SPECIES_CATALOG[p.species].stageSprites[stg].static}
                          alt={p.name}
                          className="surv-minion-ico"
                          draggable={false}
                        />
                        <div className="squad-pick-meta">
                          <strong>{p.name}</strong>
                          <small>Lv.{p.level} · HP {p.health}%</small>
                        </div>
                        <em className="squad-check">{on ? '出战' : '待命'}</em>
                      </button>
                    );
                  })}
                </div>
                <div className="lcd-tac-quicklinks">
                  <button type="button" className="lcd-subtab" onClick={() => onNavigateMode('home')}>
                    进入球舱养成
                  </button>
                  <button type="button" className="lcd-subtab" onClick={() => onNavigateMode('party')}>
                    精灵球盒详情
                  </button>
                  <button type="button" className="lcd-subtab" onClick={() => onNavigateMode('market')}>
                    盲盒商店
                  </button>
                </div>
              </div>
            )}

            {tacticsTab === 'mode' && (
              <div className="lcd-tac-body scroll-y">
                <div className="mode-sec-title">技能释放模式</div>
                <div className="mode-opt-grid">
                  {CAST_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`mode-opt-btn ${tacticsBridge.tactics.castMode === opt.id ? 'is-on' : ''}`}
                      onClick={() => tacticsBridge.onChangeTactics({ castMode: opt.id as CastCadenceMode })}
                    >
                      <strong>{opt.label}</strong>
                      <small>{opt.desc}</small>
                    </button>
                  ))}
                </div>
                <div className="mode-sec-title">随从阵型</div>
                <div className="mode-opt-grid">
                  {FORMATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`mode-opt-btn ${tacticsBridge.tactics.formation === opt.id ? 'is-on' : ''}`}
                      onClick={() => tacticsBridge.onChangeTactics({ formation: opt.id as FollowerFormation })}
                    >
                      <strong>{opt.label}</strong>
                      <small>{opt.desc}</small>
                    </button>
                  ))}
                </div>
                <div className="mode-sec-title">索敌优先级 & 3D 镜头</div>
                <div className="mode-opt-grid two-col">
                  {TARGET_PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`mode-opt-btn ${tacticsBridge.tactics.targetPriority === opt.id ? 'is-on' : ''}`}
                      onClick={() => tacticsBridge.onChangeTactics({ targetPriority: opt.id as TargetPriority })}
                    >
                      <strong>{opt.label}</strong>
                    </button>
                  ))}
                </div>
                <div className="lcd-tac-quicklinks">
                  <button
                    type="button"
                    className={`lcd-subtab ${tacticsBridge.camPreset === 'wide' ? 'active' : ''}`}
                    onClick={() => tacticsBridge.onChangeCamPreset('wide')}
                  >
                    广角镜头
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab ${tacticsBridge.camPreset === 'close' ? 'active' : ''}`}
                    onClick={() => tacticsBridge.onChangeCamPreset('close')}
                  >
                    近景镜头
                  </button>
                  <button type="button" className="lcd-subtab" onClick={() => onNavigateMode('settings')}>
                    系统设置
                  </button>
                  <button type="button" className="lcd-mini-close" onClick={tacticsBridge.onSettleAndExit}>
                    结算撤离
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* 3D HD-2D POKEMON SURVIVORS WORLD (Rendered full-viewport in App.tsx) */}
        {(mode === 'recalled' || mode === 'survivors') && (
          <Survivors3DArena
            save={save}
            pet={pet}
            analogVecRef={analogVecRef}
            onFinish={onFinishSurvivors}
            onHealParty={onHealParty}
            onSpendCoinsInRun={onSpendCoinsInRun}
            onCaptureBoss={onCaptureBoss}
            onOpenPokemonManager={(sub) => onNavigateMode(sub ?? 'home')}
          />
        )}

        {/* GBA TURN-BASED POKEMON BATTLE ARENA */}
        {mode === 'battle' && (
          <BattleArena
            save={save}
            activePet={pet}
            isTrainer={battleIsTrainer}
            onFinish={onFinishBattle}
          />
        )}

        {/* Mini-Games */}
        {mode === 'game_catch' && (
          <CatchTreatsGame
            pet={pet}
            controlSignal={{
              seq: controlSignal.seq,
              dir:
                controlSignal.dir === 'left' ||
                controlSignal.dir === 'right' ||
                controlSignal.dir === 'confirm' ||
                controlSignal.dir === 'cancel'
                  ? controlSignal.dir
                  : null,
            }}
            onComplete={(score, won) => onFinishGame('接树果大作战', score, won)}
            onExit={onExitMode}
          />
        )}

        {mode === 'game_peekaboo' && (
          <PeekabooGame
            pet={pet}
            controlSignal={{
              seq: controlSignal.seq,
              dir:
                controlSignal.dir === 'left' ||
                controlSignal.dir === 'right' ||
                controlSignal.dir === 'confirm' ||
                controlSignal.dir === 'cancel'
                  ? controlSignal.dir
                  : null,
            }}
            onComplete={(score, won) => onFinishGame('草丛猜方向', score, won)}
            onExit={onExitMode}
          />
        )}

        {/* MAIN GRID MENU (Clean 3x2 grid — Bag & Market are Level-1 top-right entries!) */}
        {mode === 'menu' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <span className="inline-icon-row">
                <PixelItemImg src="/sprites/items/poke-radar.png" size={15} />
                <span>训练家菜单</span>
              </span>
              <span className="lcd-wallet-mini inline-icon-row">
                <PixelItemImg src="/sprites/items/amulet-coin.png" size={15} />
                <span>{save.coins}</span>
              </span>
              <button type="button" className="lcd-mini-close" onClick={onExitMode}>
                返回
              </button>
            </div>

            <div className="lcd-grid-3 menu-grid">
              <button
                type="button"
                className="lcd-menu-tile"
                onClick={() => onNavigateMode('party')}
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={30} />
                <strong>精灵球盒</strong>
                <small>{save.pets.length}/{MAX_PET_SLOTS} 只</small>
              </button>
              <button
                type="button"
                className="lcd-menu-tile"
                onClick={() => onNavigateMode('pokedex')}
              >
                <PixelItemImg src="/sprites/items/town-map.png" size={30} />
                <strong>宝可梦图鉴</strong>
                <small>{save.discoveredSpecies.length}/{POKEDEX_ORDER.length} 收录</small>
              </button>
              <button
                type="button"
                className="lcd-menu-tile"
                onClick={() => onNavigateMode('achievements')}
              >
                <PixelItemImg src="/sprites/items/kings-rock.png" size={30} />
                <strong>成就徽章</strong>
                <small>{save.unlockedAchievements.length}/{ACHIEVEMENTS.length}</small>
              </button>
              <button
                type="button"
                className="lcd-menu-tile"
                onClick={() => onNavigateMode('diary')}
              >
                <PixelItemImg src="/sprites/items/vs-seeker.png" size={30} />
                <strong>冒险日记</strong>
                <small>成长记录</small>
              </button>
              <button
                type="button"
                disabled={!pet.isSick && pet.health >= 100}
                className="lcd-menu-tile"
                onClick={onHealPet}
                title={
                  pet.isSick || pet.health < 100
                    ? `为 ${pet.name} 使用伤药回复全部 HP`
                    : `${pet.name} 当前 HP 满格`
                }
              >
                <PixelItemImg src="/sprites/items/potion.png" size={30} />
                <strong>精灵治疗</strong>
                <small>{pet.isSick ? '需治疗!' : pet.health < 100 ? `HP ${pet.health}%` : 'HP满格'}</small>
              </button>
              <button
                type="button"
                className="lcd-menu-tile"
                onClick={() => onNavigateMode('settings')}
              >
                <PixelItemImg src="/sprites/items/exp-share.png" size={30} />
                <strong>系统设置</strong>
                <small>音量 / 外观 / 按键</small>
              </button>
            </div>

            {tacticsBridge?.inBattle && (
              <div className="lcd-menu-run-actions">
                <button
                  type="button"
                  className="lcd-run-resume-btn"
                  onClick={() => onCloseHandheldTo3D?.()}
                >
                  <PixelIcon name="play" size={11} />
                  <span>继续当局冒险</span>
                </button>
                <button
                  type="button"
                  className="lcd-run-exit-btn"
                  onClick={() => {
                    onCloseHandheldTo3D?.();
                    tacticsBridge.onSettleAndExit();
                  }}
                >
                  <PixelIcon name="paw" size={11} />
                  <span>退出当局游戏</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* SYSTEM SETTINGS (5 Full Pro Tabs: 音频 | 界面 | 画面 | 外观 | 按键) */}
        {mode === 'settings' && (() => {
          const directOpened = openedEntryMode === 'settings' && Boolean(onCloseHandheldTo3D);
          const cryOn = save.cryEnabled ?? true;
          const cryVol = save.cryVolume ?? 60;
          const combatSfxOn = save.combatSfxEnabled ?? true;
          const prefs: GamePrefs = { ...DEFAULT_GAME_PREFS, ...(save.prefs ?? {}) };
          const setPref = (p: Partial<GamePrefs>) => onUpdateSettings({ prefs: p });
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="lcd-subtabs is-settings-tabs">
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'audio' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('audio');
                    }}
                  >
                    <PixelIcon name="sound_on" size={11} />
                    <span>音频</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'hud' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('hud');
                    }}
                  >
                    <PixelIcon name="trophy" size={11} />
                    <span>界面</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'perf' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('perf');
                    }}
                  >
                    <PixelIcon name="bolt" size={11} />
                    <span>画面</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'style' ? 'active' : ''}`}
                    onClick={() => {
                      setRebindingAction(null);
                      setSettingsTab('style');
                    }}
                  >
                    <PixelIcon name="sparkle" size={11} />
                    <span>外观</span>
                  </button>
                  <button
                    type="button"
                    className={`lcd-subtab inline-icon-btn ${settingsTab === 'keys' ? 'active' : ''}`}
                    onClick={() => setSettingsTab('keys')}
                  >
                    <PixelIcon name="gamepad" size={11} />
                    <span>按键</span>
                  </button>
                </div>
                <button
                  type="button"
                  className={`lcd-mini-close ${directOpened && openedFromBattle ? 'is-resume inline-icon-row' : ''}`}
                  onClick={() => {
                    setRebindingAction(null);
                    if (directOpened && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {directOpened && openedFromBattle && <PixelIcon name="play" size={10} />}
                  <span>{directOpened ? (openedFromBattle ? '继续战斗' : '关闭') : '返回'}</span>
                </button>
              </div>

              <div className="settings-stack scroll-y">
                {settingsTab === 'audio' && (
                  <div className="settings-grid-2">
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>总音量</strong>
                        <em className="vol-pill">{prefs.masterVolume}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-amber"
                        min={0}
                        max={100}
                        step={5}
                        value={prefs.masterVolume}
                        style={{ '--val': `${prefs.masterVolume}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ masterVolume: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>音乐</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`px-switch ${save.bgmEnabled ? 'is-on' : ''}`}
                            onClick={() => onUpdateSettings({ bgmEnabled: !save.bgmEnabled })}
                          >
                            {save.bgmEnabled ? '开' : '关'}
                          </button>
                          <em className="vol-pill">{save.bgmVolume}%</em>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-amber"
                        min={0}
                        max={100}
                        step={5}
                        value={save.bgmVolume}
                        style={{ '--val': `${save.bgmVolume}%` } as React.CSSProperties}
                        onChange={(e) =>
                          onUpdateSettings({ bgmEnabled: true, bgmVolume: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>效果音</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`px-switch ${!save.muted ? 'is-on' : ''}`}
                            onClick={() => onUpdateSettings({ muted: !save.muted })}
                          >
                            {save.muted ? '关' : '开'}
                          </button>
                          <em className="vol-pill">{save.sfxVolume}%</em>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-amber"
                        min={0}
                        max={100}
                        step={5}
                        value={save.sfxVolume}
                        style={{ '--val': `${save.sfxVolume}%` } as React.CSSProperties}
                        onChange={(e) =>
                          onUpdateSettings({ muted: false, sfxVolume: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>宝可梦叫声</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`px-switch ${cryOn ? 'is-on' : ''}`}
                            onClick={() => onUpdateSettings({ cryEnabled: !cryOn })}
                          >
                            {cryOn ? '开' : '关'}
                          </button>
                          <em className="vol-pill">{cryVol}%</em>
                        </div>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-pink"
                        min={0}
                        max={100}
                        step={5}
                        value={cryVol}
                        style={{ '--val': `${cryVol}%` } as React.CSSProperties}
                        onChange={(e) =>
                          onUpdateSettings({ cryEnabled: true, cryVolume: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>后台时静音</strong>
                          <small className="audio-track-hint">切换标签页自动静音</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.muteOnBlur ? 'is-on' : ''}`}
                          onClick={() => setPref({ muteOnBlur: !prefs.muteOnBlur })}
                        >
                          {prefs.muteOnBlur ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>战斗技能音效</strong>
                          <small className="audio-track-hint">落雷 / 火球 / 击中音</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${combatSfxOn ? 'is-on' : ''}`}
                          onClick={() => onUpdateSettings({ combatSfxEnabled: !combatSfxOn })}
                        >
                          {combatSfxOn ? '开' : '关'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'hud' && (
                  <div className="settings-grid-2">
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>界面大小</strong>
                        <em className="vol-pill">{prefs.hudScale}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-red"
                        min={75}
                        max={125}
                        step={5}
                        value={prefs.hudScale}
                        style={{ '--val': `${((prefs.hudScale - 75) / 50) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ hudScale: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>界面不透明度</strong>
                        <em className="vol-pill">{prefs.hudOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-red"
                        min={40}
                        max={100}
                        step={5}
                        value={prefs.hudOpacity}
                        style={{ '--val': `${((prefs.hudOpacity - 40) / 60) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ hudOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>首领血条不透明度</strong>
                        <em className="vol-pill">{prefs.bossBarOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-red"
                        min={35}
                        max={100}
                        step={5}
                        value={prefs.bossBarOpacity}
                        style={{ '--val': `${((prefs.bossBarOpacity - 35) / 65) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ bossBarOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>首领体力显示</strong>
                        <div className="inline-icon-row">
                          <button
                            type="button"
                            className={`lcd-subtab ${prefs.bossHpMode === 'hp' ? 'active' : ''}`}
                            onClick={() => setPref({ bossHpMode: 'hp' })}
                          >
                            HP
                          </button>
                          <button
                            type="button"
                            className={`lcd-subtab ${prefs.bossHpMode === 'pct' ? 'active' : ''}`}
                            onClick={() => setPref({ bossHpMode: 'pct' })}
                          >
                            百分比
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>大号横幅提示</strong>
                          <small className="audio-track-hint">事件 / 收服醒目横幅</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.largeBanners ? 'is-on' : ''}`}
                          onClick={() => setPref({ largeBanners: !prefs.largeBanners })}
                        >
                          {prefs.largeBanners ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>首领机制提示</strong>
                          <small className="audio-track-hint">狂暴与弹幕阶段预警</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.bossAlerts ? 'is-on' : ''}`}
                          onClick={() => setPref({ bossAlerts: !prefs.bossAlerts })}
                        >
                          {prefs.bossAlerts ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>伤害数字</strong>
                          <small className="audio-track-hint">战斗飘字伤害统计</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.showDamageNumbers ? 'is-on' : ''}`}
                          onClick={() => setPref({ showDamageNumbers: !prefs.showDamageNumbers })}
                        >
                          {prefs.showDamageNumbers ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>连续击败</strong>
                          <small className="audio-track-hint">显示右侧连续击败徽章</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.showComboCounter ? 'is-on' : ''}`}
                          onClick={() => setPref({ showComboCounter: !prefs.showComboCounter })}
                        >
                          {prefs.showComboCounter ? '开' : '关'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'perf' && (
                  <div className="settings-grid-2">
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>画质品质</strong>
                        <div className="inline-icon-row">
                          {(['high', 'medium', 'low'] as GraphicsQualityMode[]).map((q) => (
                            <button
                              key={q}
                              type="button"
                              className={`lcd-subtab ${prefs.graphicsQuality === q ? 'active' : ''}`}
                              onClick={() => setPref({ graphicsQuality: q })}
                            >
                              {q === 'high' ? '高' : q === 'medium' ? '中' : '低'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>省电模式</strong>
                          <small className="audio-track-hint">限 30 帧并降低分辨率</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.powerSaver ? 'is-on' : ''}`}
                          onClick={() => setPref({ powerSaver: !prefs.powerSaver })}
                        >
                          {prefs.powerSaver ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card is-span-2">
                      <div className="settings-card-head">
                        <strong>帧率上限</strong>
                        <div className="inline-icon-row">
                          {([0, 30, 60, 90, 120] as const).map((cap) => (
                            <button
                              key={cap}
                              type="button"
                              className={`lcd-subtab ${prefs.fpsLimit === cap ? 'active' : ''}`}
                              onClick={() => setPref({ fpsLimit: cap })}
                            >
                              {cap === 0 ? '无限制' : cap}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>屏幕震动</strong>
                        <button
                          type="button"
                          className={`px-switch ${prefs.screenShake ? 'is-on' : ''}`}
                          onClick={() => setPref({ screenShake: !prefs.screenShake })}
                        >
                          {prefs.screenShake ? '开' : '关'}
                        </button>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-blue"
                        min={0}
                        max={100}
                        step={10}
                        value={prefs.shakeIntensity}
                        style={{ '--val': `${prefs.shakeIntensity}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ shakeIntensity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>特效不透明度</strong>
                        <em className="vol-pill">{prefs.vfxOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-blue"
                        min={20}
                        max={100}
                        step={5}
                        value={prefs.vfxOpacity}
                        style={{ '--val': `${((prefs.vfxOpacity - 20) / 80) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ vfxOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <strong>我方攻击不透明度</strong>
                        <em className="vol-pill">{prefs.playerAttackOpacity}%</em>
                      </div>
                      <input
                        type="range"
                        className="pkb-range is-blue"
                        min={15}
                        max={100}
                        step={5}
                        value={prefs.playerAttackOpacity}
                        style={{ '--val': `${((prefs.playerAttackOpacity - 15) / 85) * 100}%` } as React.CSSProperties}
                        onChange={(e) => setPref({ playerAttackOpacity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>隐藏我方攻击</strong>
                          <small className="audio-track-hint">弹幕过多时提升视野</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.hidePlayerAttacks ? 'is-on' : ''}`}
                          onClick={() => setPref({ hidePlayerAttacks: !prefs.hidePlayerAttacks })}
                        >
                          {prefs.hidePlayerAttacks ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card is-span-2">
                      <div className="settings-card-head">
                        <strong>显示的敌人</strong>
                        <div className="inline-icon-row">
                          {(
                            [
                              ['all', '全部'],
                              ['near', '附近'],
                              ['very_near', '非常近'],
                              ['shadow_only', '只显示阴影'],
                            ] as [EnemyDisplayMode, string][]
                          ).map(([val, lbl]) => (
                            <button
                              key={val}
                              type="button"
                              className={`lcd-subtab ${prefs.enemyDisplayMode === val ? 'active' : ''}`}
                              onClick={() => setPref({ enemyDisplayMode: val })}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>减少闪光</strong>
                          <small className="audio-track-hint">柔和过场与光效</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.reduceFlashes ? 'is-on' : ''}`}
                          onClick={() => setPref({ reduceFlashes: !prefs.reduceFlashes })}
                        >
                          {prefs.reduceFlashes ? '开' : '关'}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div>
                          <strong>显示 FPS</strong>
                          <small className="audio-track-hint">实时帧率监测</small>
                        </div>
                        <button
                          type="button"
                          className={`px-switch ${prefs.showFps ? 'is-on' : ''}`}
                          onClick={() => setPref({ showFps: !prefs.showFps })}
                        >
                          {prefs.showFps ? '开' : '关'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {settingsTab === 'style' && (
                <div className="settings-card">
                  <div className="settings-card-title">样式与显示模式</div>
                  <div className="settings-row">
                    <span>画面显示模式</span>
                    <div className="inline-icon-row">
                      <button
                        type="button"
                        className={`lcd-subtab ${save.showShell ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ showShell: true })}
                      >
                        掌机外壳
                      </button>
                      <button
                        type="button"
                        className={`lcd-subtab ${!save.showShell ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ showShell: false })}
                      >
                        全屏模式
                      </button>
                    </div>
                  </div>
                  <div className="settings-row col">
                    <span>掌机外壳涂装颜色</span>
                    <div className="shell-swatch-grid">
                      {(
                        [
                          ['pikachu_yellow', '皮卡黄'],
                          ['pokeball_red', '精灵红'],
                          ['crystal_blue', '水晶蓝'],
                          ['gengar_purple', '耿鬼紫'],
                        ] as [ShellThemeId, string][]
                      ).map(([id, shortLabel]) => {
                        const th = SHELL_THEMES[id];
                        const active = save.shellTheme === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`shell-swatch-btn ${active ? 'active' : ''}`}
                            onClick={() => onUpdateSettings({ shellTheme: id })}
                            title={th.name}
                          >
                            <span
                              className="lcd-shell-dot"
                              style={{ backgroundColor: th.body }}
                            />
                            <span>{shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'keys' && (
                <div className="settings-card">
                  <div className="settings-row">
                    <span className="settings-card-title">按键映射（支持全屏键盘操作）</span>
                    <button
                      type="button"
                      className="lcd-subtab"
                      onClick={() => {
                        setRebindingAction(null);
                        onUpdateSettings({ keyBindings: { ...DEFAULT_KEY_BINDINGS } });
                      }}
                    >
                      恢复默认
                    </button>
                  </div>
                  <div className="keybind-grid">
                    {(
                      [
                        ['up', '方向 · 上'],
                        ['down', '方向 · 下'],
                        ['left', '方向 · 左'],
                        ['right', '方向 · 右'],
                        ['confirm', '确认 (A键)'],
                        ['cancel', '返回 (B键)'],
                        ['menu', '菜单 (START)'],
                        ['party', '球盒 (SELECT)'],
                      ] as [keyof KeyBindings, string][]
                    ).map(([actionKey, label]) => {
                      const raw = (save.keyBindings ?? DEFAULT_KEY_BINDINGS)[actionKey];
                      const display =
                        raw === ' '
                          ? 'SPACE'
                          : raw === 'Escape'
                            ? 'ESC'
                            : raw === 'Enter'
                              ? 'ENTER'
                              : raw.toUpperCase();
                      const isListening = rebindingAction === actionKey;
                      return (
                        <div key={actionKey} className="keybind-item">
                          <span>{label}</span>
                          <button
                            type="button"
                            className={`keybind-btn ${isListening ? 'is-listening' : ''}`}
                            onClick={() =>
                              setRebindingAction(isListening ? null : actionKey)
                            }
                          >
                            {isListening ? '请按键...' : display}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const pads =
                      typeof navigator !== 'undefined' && navigator.getGamepads
                        ? Array.from(navigator.getGamepads()).filter((g): g is Gamepad => Boolean(g && g.connected))
                        : [];
                    return (
                      <div className="gamepad-guide-box">
                        <div className="gamepad-guide-head">
                          <div className="inline-icon-row">
                            <PixelIcon name="gamepad" size={14} />
                            <strong>手柄即插即用（Xbox / PS / Switch Pro / 8BitDo）</strong>
                          </div>
                          <span className={`gamepad-status-pill ${pads.length > 0 ? 'is-connected' : ''}`}>
                            {pads.length > 0 ? `已连接：${pads[0].id.slice(0, 22)}` : '待接入 · 按手柄任意键激活'}
                          </span>
                        </div>
                        <div className="gamepad-map-grid">
                          <div><b>左摇杆 / 十字键</b><span>360° 移动</span></div>
                          <div><b>右摇杆</b><span>自由旋转视角</span></div>
                          <div><b>A / ✕</b><span>跳跃</span></div>
                          <div><b>X / □</b><span>投掷精灵球</span></div>
                          <div><b>B / ○</b><span>使用伤药</span></div>
                          <div><b>Y / △</b><span>力量强化</span></div>
                          <div><b>RB / R1</b><span>全队齐射</span></div>
                          <div><b>LB / L1</b><span>展开大地图</span></div>
                          <div><b>START</b><span>训练家菜单</span></div>
                          <div><b>SELECT</b><span>视角复位</span></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* REAL MAIN HANDHELD CONSOLE CAPTURE REVEAL & NEW POKÉDEX REGISTRATION! */}
        {mode === 'capture_result' && captureReveal && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="inline-icon-row">
                <PixelItemImg src="/sprites/items/poke-ball.png" size={15} />
                <span>
                  {captureWhoStage
                    ? '我是谁？！· 新图鉴发现！'
                    : captureReveal.isNewSpecies
                      ? '图鉴新收录！'
                      : '收服成功！'}
                </span>
              </div>
              <button
                type="button"
                className="lcd-mini-close is-resume inline-icon-row"
                onClick={() => onCloseHandheldTo3D?.()}
              >
                <PixelIcon name="play" size={10} />
                <span>继续冒险</span>
              </button>
            </div>
            <div className="cap-lcd-body">
              <div className="cap-head-strip">
                {captureReveal.isShiny && <span className="ko-badge is-shiny">★异色</span>}
                {captureReveal.qualityLabel && (
                  <span className="ko-badge" style={{ backgroundColor: captureReveal.qualityColor }}>
                    {captureReveal.qualityLabel}
                  </span>
                )}
                <strong>{captureWhoStage ? '？？？' : captureReveal.name}</strong>
                <em>Lv.{captureReveal.level}</em>
                <small>
                  {captureReveal.heightM}m · {captureReveal.weightKg}kg
                </small>
              </div>
              <div className="cap-arena-viewport">
                {captureWhoStage && <div className="cap-who-banner">我是谁？！</div>}
                <div className={`cap-mon-wrap ${captureWhoStage ? 'is-who_is_it' : 'is-pokedex_new'}`}>
                  <img
                    src={captureReveal.sprite}
                    alt={captureReveal.name}
                    style={{ width: 96, height: 96, objectFit: 'contain', imageRendering: 'pixelated' }}
                    draggable={false}
                  />
                </div>
                {!captureWhoStage && (
                  <div className="cap-stars-burst" aria-hidden="true">
                    <PixelIcon name="star" size={20} />
                    <PixelIcon name="star" size={26} />
                    <PixelIcon name="star" size={20} />
                  </div>
                )}
              </div>
              <div className="cap-dex-card">
                <div className="cap-dex-head">
                  <span className="cap-dex-badge">
                    {captureReveal.isNewSpecies ? 'NEW 图鉴收录' : '★ 已送入球盒'}
                  </span>
                  <strong>
                    {captureReveal.dexNo} {captureWhoStage ? '？？？' : captureReveal.name}
                  </strong>
                  <span className="pkb-type-pill" style={{ backgroundColor: captureReveal.typeColor }}>
                    {captureReveal.typeLabel}
                  </span>
                </div>
                <p>
                  {captureWhoStage
                    ? '正在扫描野生宝可梦基因数据，即将揭晓全新图鉴条目...'
                    : captureReveal.lore}
                </p>
                {!captureWhoStage && (
                  <button
                    type="button"
                    className="cap-continue-btn"
                    onClick={() => onCloseHandheldTo3D?.()}
                  >
                    {captureReveal.isNewSpecies ? '收入图鉴 · 继续冒险' : '继续冒险'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TRAINER PROFILE & SOCIAL CARD INSIDE HANDHELD */}
        {mode === 'profile' && (() => {
          const prof = { ...DEFAULT_TRAINER_PROFILE, ...(save.trainerProfile ?? {}) };
          const curMeta = ensureFreshMetaProgress(save.meta);
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="inline-icon-row">
                  <PixelIcon name="crown" size={14} />
                  <span>训练家名片与档案</span>
                </div>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => {
                    if (openedEntryMode === 'profile' && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {openedEntryMode === 'profile' ? '关闭' : '返回'}
                </button>
              </div>
              <div className="pkb-prof-body scroll-y">
                <div className="pkb-prof-preview">
                  <div className="pkb-prof-avatar-lg">
                    <PixelItemImg src={getHeroDef(curMeta.activeHero).avatarSprite} size={56} />
                  </div>
                  <div className="pkb-prof-stats">
                    <strong>{prof.name}</strong>
                    <span className="pkb-prof-title-badge">{prof.title}</span>
                    <p>{prof.bio}</p>
                    <div className="pkb-prof-kpis">
                      <span>图鉴 {save.discoveredSpecies.length}/{POKEDEX_ORDER.length}</span>
                      <span>伙伴 {save.pets.length} 只</span>
                      <span>道馆徽章 {(curMeta.unlockedBadges ?? []).length}/6</span>
                    </div>
                  </div>
                </div>
                <div className="pkb-prof-form">
                  <label>
                    <span>训练家昵称</span>
                    <input
                      type="text"
                      maxLength={14}
                      value={prof.name}
                      onChange={(e) =>
                        onUpdateSettings({
                          trainerProfile: { ...prof, name: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>展示称号</span>
                    <input
                      type="text"
                      maxLength={16}
                      value={prof.title}
                      onChange={(e) =>
                        onUpdateSettings({
                          trainerProfile: { ...prof, title: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>个人展示签名</span>
                    <input
                      type="text"
                      maxLength={36}
                      value={prof.bio}
                      onChange={(e) =>
                        onUpdateSettings({
                          trainerProfile: { ...prof, bio: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })()}

        {/* NATIVE HANDHELD TOWN MAP / FULL-BLEED REGIONAL TOPOGRAPHIC MAP (Zero top bar, floating drawer!) */}
        {mode === 'map' && (
          <div className="lcd-submenu is-fullbleed-map">
            {worldMapData ? (
              <HandheldWorldMapView
                data={worldMapData}
                closeLabel={openedEntryMode === 'map' ? '关闭' : '返回'}
                onClose={() => {
                  if (openedEntryMode === 'map' && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onNavigateMode('menu');
                  }
                }}
              />
            ) : (
              <div className="lcd-news-list scroll-y" style={{ padding: 12 }}>
                <div className="lcd-news-card">
                  <p>进入 3D 冒险原野后即可查看实时地形、湖泊水域与地点坐标！</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OFFICIAL ANNOUNCEMENTS & PATCH NOTES INSIDE HANDHELD (Click to view full detail!) */}
        {mode === 'news' && (() => {
          const activeNews = selectedNewsId
            ? DEFAULT_ANNOUNCEMENTS.find((n) => n.id === selectedNewsId) ?? null
            : null;
          const activePhotos = activeNews
            ? (activeNews.photos && activeNews.photos.length > 0
                ? activeNews.photos
                : activeNews.photo
                  ? [{ src: activeNews.photo, caption: activeNews.photoCaption ?? activeNews.title }]
                  : [])
            : [];
          const safePhotoIdx = activePhotos.length > 0 ? Math.min(newsPhotoIdx, activePhotos.length - 1) : 0;
          const curPhoto = activePhotos[safePhotoIdx] ?? null;
          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <div className="inline-icon-row">
                  <PixelItemImg src="/sprites/items/poke-radar.png" size={16} />
                  <span
                    className="lcd-submenu-head-title"
                    title={activeNews ? activeNews.title : '官方公告与版本更新'}
                  >
                    {activeNews ? activeNews.title : '官方公告与版本更新'}
                  </span>
                </div>
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => {
                    if (activeNews) {
                      setSelectedNewsId(null);
                      setNewsPhotoIdx(0);
                    } else if (openedEntryMode === 'news' && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {activeNews ? '‹ 列表' : openedEntryMode === 'news' ? '关闭' : '返回'}
                </button>
              </div>
              {activeNews ? (
                <div className="lcd-news-detail scroll-y">
                  <div className="lcd-news-head">
                    <span className="lcd-news-tag">{activeNews.tag}</span>
                    {activeNews.reporter && <span className="lcd-news-reporter">{activeNews.reporter}</span>}
                    <em>{activeNews.date}</em>
                  </div>
                  {curPhoto && (
                    <figure className="lcd-news-photo-frame">
                      <img
                        src={curPhoto.src}
                        alt={curPhoto.caption}
                        className="lcd-news-photo-img"
                        draggable={false}
                      />
                      <span className="lcd-photo-stamp">
                        LIVE · PRESS {activePhotos.length > 1 ? `${safePhotoIdx + 1}/${activePhotos.length}` : ''}
                      </span>
                      <figcaption>📷 {curPhoto.caption}</figcaption>
                    </figure>
                  )}
                  {activePhotos.length > 1 && (
                    <div className="lcd-news-gallery-bar">
                      <div className="lcd-news-gallery-thumbs">
                        {activePhotos.map((ph, idx) => (
                          <button
                            key={ph.src}
                            type="button"
                            className={`lcd-news-thumb-btn ${idx === safePhotoIdx ? 'active' : ''}`}
                            title={`查看现场图 ${idx + 1}：${ph.caption}`}
                            onClick={() => {
                              sound.play('cursor');
                              setNewsPhotoIdx(idx);
                            }}
                          >
                            <img src={ph.src} alt={ph.caption} draggable={false} />
                          </button>
                        ))}
                      </div>
                      <div className="lcd-news-nav-btns">
                        <span className="lcd-news-photo-counter">
                          现场图 {safePhotoIdx + 1}/{activePhotos.length}
                        </span>
                        <button
                          type="button"
                          className="lcd-news-nav-btn"
                          aria-label="上一张现场照片"
                          onClick={() => {
                            sound.play('cursor');
                            setNewsPhotoIdx((prev) => (prev - 1 + activePhotos.length) % activePhotos.length);
                          }}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="lcd-news-nav-btn"
                          aria-label="下一张现场照片"
                          onClick={() => {
                            sound.play('cursor');
                            setNewsPhotoIdx((prev) => (prev + 1) % activePhotos.length);
                          }}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="lcd-news-detail-lead">{activeNews.body}</p>
                  {activeNews.details && activeNews.details.length > 0 && (
                    <ul className="lcd-news-bullets">
                      {activeNews.details.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="kanto-paper scroll-y">
                  {/* Classic Newspaper Masthead (报头) */}
                  <header className="paper-masthead">
                    <div className="paper-masthead-top">
                      <span>关都联盟官方特刊</span>
                      <strong>关 都 日 报</strong>
                      <span>KANTO DAILY</span>
                    </div>
                    <div className="paper-masthead-meta">
                      <span>关都历 11月26日 · 第 149 期</span>
                      <span>✈ 东亚 14 城巡礼 · 华夏限定色上线</span>
                      <span>点击任意报道阅读全文</span>
                    </div>
                  </header>

                  {/* Lead Front-Page Story (头版头条) */}
                  {DEFAULT_ANNOUNCEMENTS[0] && (() => {
                    const lead = DEFAULT_ANNOUNCEMENTS[0];
                    const photoCount = lead.photos?.length ?? (lead.photo ? 1 : 0);
                    return (
                      <article
                        className="paper-lead-story"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          sound.play('cursor');
                          setSelectedNewsId(lead.id);
                          setNewsPhotoIdx(0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            sound.play('cursor');
                            setSelectedNewsId(lead.id);
                            setNewsPhotoIdx(0);
                          }
                        }}
                      >
                        <div className="paper-kicker-row">
                          <span className="paper-kicker is-red">头版头条 · {lead.tag}</span>
                          <span className="paper-byline">{lead.reporter ?? '关都日报记者'}</span>
                          <time>{lead.date}</time>
                        </div>
                        <h3 className="paper-lead-headline">{lead.title}</h3>
                        <div className="paper-lead-grid">
                          {lead.photo && (
                            <figure className="paper-lead-photo">
                              <img src={lead.photo} alt={lead.title} draggable={false} />
                              {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                            </figure>
                          )}
                          <div className="paper-lead-copy">
                            <p>{lead.body}</p>
                            <span className="paper-read-more">阅读头版全文 ›</span>
                          </div>
                        </div>
                      </article>
                    );
                  })()}

                  {/* Asymmetric Broadsheet Editorial Mosaic (不规则报刊版面：按重要级别区分大小与图文形态) */}
                  {DEFAULT_ANNOUNCEMENTS.length > 1 && (
                    <div className="paper-bento-grid">
                      {DEFAULT_ANNOUNCEMENTS.slice(1).map((a) => {
                        const photoCount = a.photos?.length ?? (a.photo ? 1 : 0);
                        const layout = a.layout ?? 'feature_tall';
                        const openArticle = () => {
                          sound.play('cursor');
                          setSelectedNewsId(a.id);
                          setNewsPhotoIdx(0);
                        };
                        const onKey = (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openArticle();
                          }
                        };

                        if (layout === 'photo_spotlight') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-photo-spotlight"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              {a.photo && (
                                <img
                                  className="paper-spotlight-img"
                                  src={a.photo}
                                  alt={a.title}
                                  draggable={false}
                                />
                              )}
                              <span className="paper-spotlight-tag">{a.tag}</span>
                              {photoCount > 1 && (
                                <span className="paper-spotlight-count">📷 {photoCount}图</span>
                              )}
                              <div className="paper-spotlight-overlay">
                                <time>{a.date}</time>
                                <h4>{a.title}</h4>
                              </div>
                            </article>
                          );
                        }

                        if (layout === 'wide_horizontal') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-wide-horizontal"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              {a.photo && (
                                <figure className="paper-wide-photo">
                                  <img src={a.photo} alt={a.title} draggable={false} />
                                  {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                                </figure>
                              )}
                              <div className="paper-wide-body">
                                <div className="paper-col-kicker">
                                  <span className="paper-kicker is-teal">{a.tag}</span>
                                  <time>{a.date}</time>
                                </div>
                                <h4 className="paper-col-headline is-lg">{a.title}</h4>
                                <p className="paper-col-excerpt">{a.body}</p>
                                <div className="paper-col-foot">
                                  <span>{a.reporter?.split('·')[1]?.trim() ?? '技术专报'}</span>
                                  <em>阅读全文 ›</em>
                                </div>
                              </div>
                            </article>
                          );
                        }

                        if (layout === 'text_wire') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-text-wire"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              <div className="paper-col-kicker">
                                <span className="paper-kicker is-amber">⚡ {a.tag}</span>
                                <time>{a.date}</time>
                              </div>
                              <h4 className="paper-wire-headline">{a.title}</h4>
                              <p className="paper-wire-excerpt">{a.body}</p>
                              <div className="paper-col-foot">
                                <span>{photoCount > 0 ? `含 ${photoCount} 张现场图` : '快讯'}</span>
                                <em>详情 ›</em>
                              </div>
                            </article>
                          );
                        }

                        if (layout === 'photo_title') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-photo-title"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              <div className="paper-col-kicker">
                                <span className="paper-kicker">{a.tag}</span>
                                <time>{a.date}</time>
                              </div>
                              {a.photo && (
                                <figure className="paper-col-photo is-compact">
                                  <img src={a.photo} alt={a.title} draggable={false} />
                                  {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                                </figure>
                              )}
                              <h4 className="paper-col-headline">{a.title}</h4>
                            </article>
                          );
                        }

                        if (layout === 'archive_right_thumb') {
                          return (
                            <article
                              key={a.id}
                              className="paper-bento-card is-archive-right"
                              role="button"
                              tabIndex={0}
                              onClick={openArticle}
                              onKeyDown={onKey}
                            >
                              <div className="paper-archive-copy">
                                <div className="paper-col-kicker">
                                  <span className="paper-kicker is-purple">{a.tag}</span>
                                  <time>{a.date}</time>
                                </div>
                                <h4 className="paper-col-headline">{a.title}</h4>
                                <p className="paper-col-excerpt is-two-line">{a.body}</p>
                              </div>
                              {a.photo && (
                                <figure className="paper-archive-thumb">
                                  <img src={a.photo} alt={a.title} draggable={false} />
                                  {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}</span>}
                                </figure>
                              )}
                            </article>
                          );
                        }

                        // Default: 'feature_tall' (large feature photo + headline + summary + footer)
                        return (
                          <article
                            key={a.id}
                            className="paper-bento-card is-feature-tall"
                            role="button"
                            tabIndex={0}
                            onClick={openArticle}
                            onKeyDown={onKey}
                          >
                            <div className="paper-col-kicker">
                              <span className="paper-kicker is-red">{a.tag}</span>
                              <time>{a.date}</time>
                            </div>
                            <h4 className="paper-col-headline is-lg">{a.title}</h4>
                            {a.photo && (
                              <figure className="paper-col-photo is-tall">
                                <img src={a.photo} alt={a.title} draggable={false} />
                                {photoCount > 1 && <span className="paper-photo-badge">📷 {photoCount}图</span>}
                              </figure>
                            )}
                            <p className="paper-col-excerpt">{a.body}</p>
                            <div className="paper-col-foot">
                              <span>{a.reporter?.split('·')[1]?.trim() ?? '前线快讯'}</span>
                              <em>全文 ›</em>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom Newspaper Weather & Regional Brief Strip */}
                  <footer className="paper-brief-strip">
                    <strong>【东亚航线气象】</strong>
                    <span>上海 18°C 晴 · 深圳/香港 25°C 多云 · 东京/京都 16°C 樱风 · 札幌/哈尔滨 -3°C 小雪</span>
                  </footer>
                </div>
              )}
            </div>
          );
        })()}

        {/* ADVENTURE GUIDE INSIDE HANDHELD */}
        {mode === 'guide' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="inline-icon-row">
                <PixelItemImg src="/sprites/items/light-ball.png" size={16} />
                <span>3D 冒险操作指南</span>
              </div>
              <button
                type="button"
                className="lcd-mini-close"
                onClick={() => {
                  if ((openedEntryMode === 'guide' || openedEntryMode === 'feedback') && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onNavigateMode('menu');
                  }
                }}
              >
                {openedEntryMode === 'guide' || openedEntryMode === 'feedback' ? '关闭' : '返回'}
              </button>
            </div>
            <div className="lcd-news-list scroll-y">
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">移动与视角</span>
                  <strong>自由探索阶梯原野</strong>
                </div>
                <p>WASD / 方向键 / 手柄左摇杆 360° 移动；鼠标拖动或右摇杆旋转视角，滚轮缩放，空格 / 手柄 A 键跳跃跨越崖壁。</p>
              </div>
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">战斗与战术</span>
                  <strong>4 招式配置 & 近战冲撞</strong>
                </div>
                <p>随从自动施放 4 个自由配置的像素招式，近战体格精灵会主动发起冲撞突袭！点击左侧精灵卡片可随时打开掌机调整招式与携带道具。</p>
              </div>
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">收服与徽章</span>
                  <strong>击晕收服 & 挑战道馆馆主</strong>
                </div>
                <p>击败精英、异色或区域守护者后可靠近或按投球键触发特写收服！击败野外道馆馆主收集关都 6 大徽章，解锁强力属性加成。</p>
              </div>
            </div>
          </div>
        )}

        {/* PLAYER FEEDBACK INSIDE HANDHELD */}
        {mode === 'feedback' && (
          <div className="lcd-submenu">
            <div className="lcd-submenu-head">
              <div className="inline-icon-row">
                <PixelItemImg src="/sprites/items/potion.png" size={16} />
                <span>问题反馈与建议箱</span>
              </div>
              <button
                type="button"
                className="lcd-mini-close"
                onClick={() => {
                  if ((openedEntryMode === 'guide' || openedEntryMode === 'feedback') && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onNavigateMode('menu');
                  }
                }}
              >
                {openedEntryMode === 'guide' || openedEntryMode === 'feedback' ? '关闭' : '返回'}
              </button>
            </div>
            <div className="lcd-news-list scroll-y">
              <div className="lcd-news-card">
                <div className="lcd-news-head">
                  <span className="lcd-news-tag">训练家留言</span>
                  <strong>欢迎提交宝可梦平衡、美术或新玩法建议</strong>
                </div>
                <p>你的每一条建议都会帮助我们把掌上像素宝可梦世界打磨得更生动有趣！</p>
              </div>
              <textarea
                className="lcd-fb-textarea"
                rows={4}
                placeholder="在这里输入你想新增的宝可梦、招式、地区或体验建议..."
                value={feedbackText}
                onChange={(e) => {
                  setFeedbackText(e.target.value);
                  setFeedbackSent(false);
                }}
              />
              <button
                type="button"
                className="lcd-inline-cta full"
                disabled={!feedbackText.trim()}
                onClick={() => {
                  sound.play('confirm');
                  setFeedbackSent(true);
                  setFeedbackText('');
                }}
              >
                {feedbackSent ? '✓ 感谢反馈！已收录至训练家意见箱' : '提交建议'}
              </button>
            </div>
          </div>
        )}

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
                <button type="button" className="lcd-mini-close" onClick={onExitMode}>
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
                  if (openedEntryMode === 'market' && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onExitMode();
                  }
                }}
              >
                {openedEntryMode === 'market' && onCloseHandheldTo3D ? '关闭' : '返回'}
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

        {/* PARTY GRID (精灵球收藏 / 同行队伍 — 支持搜索、筛选排序与批量放生!) */}
        {mode === 'party' && (() => {
          const q = partySearch.trim().toLowerCase();
          const rankWeight = (r: string) => (r === 'S' ? 3 : r === 'A' ? 2 : 1);
          const filteredPets = save.pets
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

          const selectedSet = new Set(batchSelectedIds.filter((id) => id !== pet.id && save.pets.some((p) => p.id === id)));
          const selectedPets = save.pets.filter((p) => selectedSet.has(p.id));
          const previewCoins = selectedPets.reduce((acc, p) => acc + getReleaseReward(p).coins, 0);
          const selectableVisible = filteredPets.filter((p) => p.id !== pet.id);

          const toggleSelectPet = (id: string) => {
            if (id === pet.id) return;
            sound.play('cursor');
            setConfirmBatchRelease(false);
            setBatchSelectedIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            );
          };

          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <span className="inline-icon-row">
                  <PixelItemImg src="/sprites/items/poke-ball.png" size={15} />
                  <span>精灵球盒 ({save.pets.length}/{MAX_PET_SLOTS})</span>
                </span>
                <div className="lcd-head-actions">
                  <button
                    type="button"
                    className={`lcd-subtab ${partyBatchMode ? 'active' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      setPartyBatchMode((v) => {
                        if (v) {
                          setBatchSelectedIds([]);
                          setConfirmBatchRelease(false);
                        }
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
                      setBatchSelectedIds([]);
                      setConfirmBatchRelease(false);
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

              {/* Batch Release Action Strip */}
              {partyBatchMode && (
                <div className="party-batch-bar">
                  <div className="party-batch-quick">
                    <button
                      type="button"
                      className="party-mini-pill"
                      onClick={() => {
                        sound.play('cursor');
                        setConfirmBatchRelease(false);
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
                  <button
                    type="button"
                    className={`party-batch-release-btn ${confirmBatchRelease ? 'is-confirm' : ''}`}
                    disabled={selectedSet.size === 0}
                    onClick={() => {
                      if (selectedSet.size === 0) return;
                      if (!confirmBatchRelease) {
                        sound.play('cursor');
                        setConfirmBatchRelease(true);
                        return;
                      }
                      const res = onReleasePetsBatch?.(Array.from(selectedSet));
                      setConfirmBatchRelease(false);
                      setBatchSelectedIds([]);
                      if (res?.ok) {
                        setBatchFeedback(res.message);
                        window.setTimeout(() => setBatchFeedback(null), 2600);
                      }
                    }}
                  >
                    {confirmBatchRelease
                      ? `确认放生 ${selectedSet.size} 只 (+${previewCoins}G)?`
                      : selectedSet.size > 0
                        ? `批量放生 (${selectedSet.size} · +${previewCoins}G)`
                        : '批量放生'}
                  </button>
                </div>
              )}

              {batchFeedback && <div className="party-batch-toast">{batchFeedback}</div>}

              <div className="lcd-grid-4 party-compact-grid scroll-y">
                {filteredPets.length === 0 ? (
                  <div className="party-empty-hint">未找到匹配的宝可梦，试试更换关键词或评级筛选</div>
                ) : (
                  filteredPets.map((p) => {
                    const isCur = p.id === pet.id;
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
                              ? '当前出战伙伴不可批量放生'
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

        {/* PARTY 2ND-LEVEL DETAIL (Actions moved cleanly to top-right with icons + secondary dropdown!) */}
        {mode === 'party_detail' && (() => {
          const p = partyDetailPet;
          const st = getGrowthStage(p.level, p.species);
          const meta = SPECIES_CATALOG[p.species];
          const pDex = getPokemonDexNo(p.species, p.level);
          const formName = getPokemonStageName(p.species, p.level);
          const evoHint = getNextEvolutionHint(p.species, p.level);
          const isCur = p.id === pet.id;
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
          const canHeal = isCur && (p.isSick || p.health < 100);

          return (
            <div className="lcd-submenu">
              <div className="lcd-submenu-head">
                <span className="inline-icon-row">
                  <PixelItemImg src="/sprites/items/poke-ball.png" size={14} />
                  <span>{p.name}</span>
                </span>
                {/* Top-Right Pokémon Actions: Primary Frequent Outside + Secondary Infrequent Dropdown */}
                <div className="lcd-head-actions detail-top-actions">
                  {isCur ? (
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
                        onSwitchPet(p.id);
                      }}
                      title={`将 ${p.name} 设为当前主力宝可梦`}
                    >
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={12} />
                      <span>出战</span>
                    </button>
                  )}

                  {/* Icon-only Heal Button (frequent action!) */}
                  <button
                    type="button"
                    className={`lcd-subtab detail-icon-only-btn ${canHeal ? 'is-heal-ready' : ''}`}
                    disabled={!canHeal}
                    onClick={() => {
                      setPetActionMenuOpen(false);
                      onHealPet();
                    }}
                    title={canHeal ? `给 ${p.name} 使用伤药回满 HP` : '当前 HP 已满（仅可治疗当前主力）'}
                    aria-label="使用伤药"
                  >
                    <PixelItemImg src="/sprites/items/potion.png" size={13} />
                  </button>

                  {/* Secondary Dropdown Menu for Infrequent Actions (Care Room / Cry / Release) */}
                  <div className="detail-more-wrap">
                    <button
                      type="button"
                      className={`lcd-subtab detail-icon-only-btn ${petActionMenuOpen ? 'active' : ''}`}
                      onClick={() => {
                        setConfirmReleaseId(null);
                        setPetActionMenuOpen((o) => !o);
                      }}
                      title="更多操作（进球舱 / 放生）"
                      aria-label="更多操作"
                    >
                      <PixelIcon name="menu" size={11} />
                    </button>
                    {petActionMenuOpen && (
                      <div className="detail-action-dropdown">
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
                        {save.pets.length > 1 &&
                          (confirmReleaseId === p.id ? (
                            <button
                              type="button"
                              className="detail-dd-item is-danger-confirm"
                              onClick={() => {
                                setConfirmReleaseId(null);
                                setPetActionMenuOpen(false);
                                if (onReleasePet(p.id)) {
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
                      setPetActionMenuOpen(false);
                      onNavigateMode(detailReturnMode);
                    }}
                  >
                    {detailReturnMode === 'squad' ? '返回队伍' : '返回'}
                  </button>
                </div>
              </div>

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
                    const bondVal = Math.min(
                      100,
                      Math.round(p.happiness * 0.55 + p.level * 1.8 + (p.totalPats + p.totalFeeds) * 1.5),
                    );
                    const bondInfo = computePetBondBonuses(bondVal);
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
                            <strong>Lv.{bondInfo.lv}/10</strong>
                          </div>
                          <div className="bond-hero-meta">
                            <div className="inline-icon-row">
                              <strong>与{p.name}的亲密度 ({bondVal}/100)</strong>
                              <span
                                className="mega-status-pill"
                                style={{ backgroundColor: bondInfo.megaUnlocked ? megaDef.auraColor : '#868e96' }}
                              >
                                {bondInfo.megaUnlocked ? `★ ${megaDef.formName} 已解锁` : `Lv.5 解锁 ${megaDef.badgeLabel}`}
                              </span>
                            </div>
                            <small>{megaDef.perkSummary}</small>
                            <div className="gba-exp-track">
                              <div className="gba-exp-fill" style={{ width: `${Math.min(100, bondVal)}%`, background: '#f06595' }} />
                            </div>
                          </div>
                        </div>

                        {/* 2. Bond Milestone Ladder (Lv.2 -> Lv.10) */}
                        <div className="bond-section-title">亲密度等级奖励</div>
                        <div className="bond-ladder-grid">
                          {BOND_MILESTONES.map((m) => {
                            const reached = bondInfo.lv >= m.level;
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
                      {STAT_BAR_ROWS.map((row) => (
                        <div key={row.key} className="lcd-bar-cell">
                          <div className="lcd-bar-head">
                            <span className="inline-icon-row">
                              <PixelIcon name={row.icon} size={11} />
                              <span>{row.label}</span>
                            </span>
                            <strong>{p[row.key]}%</strong>
                          </div>
                          <div className="lcd-bar-track">
                            <div
                              className="lcd-bar-fill"
                              style={{
                                width: `${p[row.key]}%`,
                                backgroundColor: p[row.key] < 25 ? '#ff4d6d' : row.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="lcd-bar-cell meta-cell">
                        <div className="detail-stat-note">
                          <PixelIcon name="sparkle" size={11} />
                          <span>性格 {natureMeta.name} · {talentMeta.name} · 资质 {ivRank}</span>
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
                    if (openedEntryMode === 'pokedex' && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {openedEntryMode === 'pokedex' && onCloseHandheldTo3D ? '关闭' : '返回'}
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
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={() => onNavigateMode('pokedex')}
                >
                  返回图鉴
                </button>
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
                        <div className={`lcd-evo-node ${dexDiscovered ? 'reached' : 'locked'}`}>
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
                    if (openedEntryMode === 'achievements' && onCloseHandheldTo3D) {
                      onCloseHandheldTo3D();
                    } else {
                      onNavigateMode('menu');
                    }
                  }}
                >
                  {openedEntryMode === 'achievements' && onCloseHandheldTo3D ? '关闭' : '返回'}
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
                  if (openedEntryMode === 'diary' && onCloseHandheldTo3D) {
                    onCloseHandheldTo3D();
                  } else {
                    onNavigateMode('menu');
                  }
                }}
              >
                {openedEntryMode === 'diary' && onCloseHandheldTo3D ? '关闭' : '返回'}
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

        {/* MAIN HOME STAGE */}
        {mode === 'home' && (
          <div className="lcd-stage">
            <PokeballRoomBg roomId={room.id} isNight={pet.isSleeping} />

            {/* Top HUD Row: Interactive Left Card (Native <button> avoids handheld shell pointer capture!) */}
            <div className="gba-hud-row">
              <button
                type="button"
                className="gba-status-box is-clickable-card"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPartyPetId(pet.id);
                  setConfirmReleaseId(null);
                  setPetActionMenuOpen(false);
                  setPartyDetailTab('stats');
                  setDetailReturnMode('home');
                  onNavigateMode('party_detail');
                }}
                title={`点击进入「${pet.name}」的精灵详情界面`}
              >
                <div className="gba-name-line">
                  <PixelItemImg src={room.ballSprite} size={15} />
                  <span className="hud-dex-inline">{dexNo}</span>
                  <strong>{pet.name}</strong>
                  <span
                    className="poke-type-pill mini"
                    style={{ backgroundColor: speciesMeta.typeColor }}
                  >
                    <PixelIcon name={speciesMeta.typeIcon} size={9} />
                    <span>{speciesMeta.typeLabel}</span>
                  </span>
                  {equippedAcc && (
                    <span
                      className="hud-gear-hit"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPartyPetId(pet.id);
                        setConfirmReleaseId(null);
                        setPetActionMenuOpen(false);
                        setPartyDetailTab('gear');
                        setDetailReturnMode('home');
                        onNavigateMode('party_detail');
                      }}
                      title={`点击更换携带道具（当前：${equippedAcc.name}）`}
                    >
                      <PixelItemImg
                        src={equippedAcc.itemSprite}
                        size={14}
                        alt={equippedAcc.name}
                      />
                    </span>
                  )}
                  <span className="gba-lv">Lv.{pet.level}</span>
                </div>

                <div className="hud-vitals-zone">
                  <div className="gba-hp-line">
                    <span className="hp-tag">HP</span>
                    <div className="gba-hp-track">
                      <div
                        className="gba-hp-fill"
                        style={{ width: `${pet.health}%`, backgroundColor: hpBarColor }}
                      />
                    </div>
                  </div>
                  <div className="gba-exp-track">
                    <div className="gba-exp-fill" style={{ width: `${xpPct}%` }} />
                  </div>

                  <div className="hud-mini-meters">
                    <PixelFillMeter name="meat" value={pet.hunger} label="饱食" size={14} />
                    <PixelFillMeter name="heart" value={pet.happiness} label="亲密" size={14} />
                    <PixelFillMeter name="bubble" value={pet.cleanliness} label="清洁" size={14} />
                    <PixelFillMeter name="bolt" value={pet.energy} label="体力" size={14} />
                  </div>
                </div>
              </button>

              <div className="gba-dex-coin">
                <div className="hud-top-actions">
                  <button
                    type="button"
                    className="hud-coin-btn"
                    onClick={() => {
                      setGachaPhase('idle');
                      onNavigateMode('market');
                    }}
                    title="点击快速前往商店与盲盒"
                    aria-label="前往商店"
                  >
                    <PixelItemImg src="/sprites/items/amulet-coin.png" size={28} />
                    <strong>{save.coins}</strong>
                  </button>
                  <button
                    type="button"
                    className="lcd-sq-btn hud-bag-btn"
                    onClick={() => onNavigateMode('bag')}
                    title="打开背包仓库（树果与道具）"
                    aria-label="背包"
                  >
                    <PixelItemImg src="/sprites/items/berry-pouch.png" size={28} />
                  </button>
                  <button
                    type="button"
                    className="lcd-sq-btn hud-menu-btn"
                    onClick={() => onNavigateMode('menu')}
                    title="打开训练家菜单与设置"
                    aria-label="主菜单"
                  >
                    <PixelItemImg src="/sprites/items/poke-radar.png" size={30} />
                  </button>
                </div>

                {/* Full-Width Matched-Height Trainer Stamina Bar (ball slot pill removed cleanly!) */}
                <div className="hud-sub-row is-full-stamina">
                  {(() => {
                    const regenSec = getStaminaNextRecoverySec(save, nowMs);
                    const stamPct = Math.round((save.stamina / save.maxStamina) * 100);
                    const isLow = save.stamina <= 3;
                    return (
                      <div
                        className={`hud-stamina-pill ${isLow ? 'is-low' : ''}`}
                        title={
                          save.stamina < save.maxStamina
                            ? `训练家体力 ${save.stamina}/${save.maxStamina} · ${regenSec}秒后自动回复 +1（仅随时间恢复）`
                            : `训练家体力已满 (${save.stamina}/${save.maxStamina})`
                        }
                      >
                        <div className="stamina-top-line">
                          <span className="inline-icon-row">
                            <PixelIcon name="bolt" size={10} />
                            <span>
                              体力 {save.stamina}/{save.maxStamina}
                            </span>
                          </span>
                          {save.stamina < save.maxStamina && (
                            <em className="stamina-timer">
                              {Math.floor(regenSec / 60)}:
                              {String(regenSec % 60).padStart(2, '0')}
                            </em>
                          )}
                        </div>
                        <div className="stamina-bar-track">
                          <div
                            className="stamina-bar-fill"
                            style={{ width: `${stamPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Upper Notification Banner (Never covers bottom action buttons!) */}
            {speech ? (
              <div className="gba-dialogue-box">
                <span>{speech}</span>
                <em className="gba-caret">▼</em>
              </div>
            ) : (
              (mood === 'hungry' || mood === 'dirty' || mood === 'sick') && (
                <div className="lcd-alert-tag inline-icon-row">
                  <PixelIcon
                    name={mood === 'sick' ? 'pill' : mood === 'dirty' ? 'bubble' : 'meat'}
                    size={12}
                  />
                  <span>
                    {mood === 'sick' ? '需要伤药' : mood === 'dirty' ? '想要洗澡' : '饿肚肚啦'}
                  </span>
                </div>
              )
            )}

            {/* Left & Right Pokeball Room Switchers */}
            {prevPet && nextPet && (
              <>
                <button
                  type="button"
                  className="lcd-ball-nav prev"
                  onClick={() => onSwitchPet(prevPet.id)}
                  title={`上一颗精灵球 (${prevPet.name})`}
                  aria-label="上一颗精灵球"
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="lcd-ball-nav next"
                  onClick={() => onSwitchPet(nextPet.id)}
                  title={`下一颗精灵球 (${nextPet.name})`}
                  aria-label="下一颗精灵球"
                >
                  ▶
                </button>
              </>
            )}

            {effects.map((fx) => (
              <div
                key={fx.id}
                className={`lcd-float fx-${fx.kind} inline-icon-row`}
                style={{ left: `${fx.x}%`, top: `${fx.y}%` }}
              >
                {fx.icon && <PixelIcon name={fx.icon} size={15} />}
                {fx.text && <span>{fx.text}</span>}
              </div>
            ))}

            {/* Animated Pokemon Sprite (Unified 44x44 PMD pixel art rendered at exact 3x = 132px!) */}
            <button
              type="button"
              className={`lcd-pet-hitbox anim-${actionAnim} ${idleHop ? 'is-hopping' : ''}`}
              style={{
                transform: `translateX(${wanderOffset}px)`,
              }}
              onClick={onPatPet}
              title={
                pet.isSleeping
                  ? `${pet.name} 正在呼呼大睡`
                  : pet.happiness >= 100
                    ? `${pet.name} 亲密度已满格`
                    : '点击抚摸宝可梦'
              }
            >
              <div className="pet-shadow" />
              {!pet.isSleeping && actionAnim === 'idle' && (
                <div className="pet-mood-bubble" aria-hidden="true">
                  <PixelIcon
                    name={
                      mood === 'ecstatic' || mood === 'happy'
                        ? 'heart'
                        : mood === 'hungry'
                          ? 'meat'
                          : mood === 'dirty'
                            ? 'bubble'
                            : mood === 'sick'
                              ? 'pill'
                              : 'sparkle'
                    }
                    size={11}
                  />
                </div>
              )}
              <PixelPetSprite
                species={pet.species}
                pose={resolvePose()}
                stage={stage}
                size={132}
                flipX={facingLeft}
              />
              {actionAnim === 'patting' && (
                <div key={patSeq} className="lcd-pat-hand" aria-hidden="true">
                  <PixelPettingHand size={36} />
                </div>
              )}
            </button>

            {actionAnim === 'eating' && activeFoodMeta && (
              <div className="lcd-food-drop">
                <PixelItemImg src={activeFoodMeta.itemSprite} size={30} />
              </div>
            )}

            {actionAnim === 'bathing' && (
              <div className="lcd-bubbles" aria-hidden="true">
                <span className="bubble b1"><PixelIcon name="bubble" size={18} /></span>
                <span className="bubble b2"><PixelIcon name="bubble" size={15} /></span>
                <span className="bubble b3"><PixelIcon name="bubble" size={20} /></span>
                <span className="bubble b4"><PixelIcon name="sparkle" size={14} /></span>
              </div>
            )}

            {actionAnim === 'levelup' && (
              <div className="lcd-evo-burst" aria-hidden="true">
                <span className="evo-star s1"><PixelIcon name="sparkle" size={22} /></span>
                <span className="evo-star s2"><PixelIcon name="star" size={18} /></span>
                <span className="evo-star s3"><PixelIcon name="sparkle" size={20} /></span>
              </div>
            )}

            {(actionAnim === 'sleeping' || pet.isSleeping) && (
              <div className="lcd-zzz" aria-hidden="true">
                <span>Z</span>
                <span>z</span>
                <span>z</span>
              </div>
            )}

            {actionAnim === 'medicine' && (
              <div className="lcd-med-pulse inline-icon-row" aria-hidden="true">
                <PixelItemImg src="/sprites/items/potion.png" size={22} />
                <PixelIcon name="heart" size={18} />
              </div>
            )}

            {pet.poopCount > 0 && (
              <div className="lcd-poop-row">
                {Array.from({ length: pet.poopCount }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="poop-btn"
                    onClick={onCleanPoop}
                    title="点击清理场地 (+金币)"
                  >
                    <PixelOverlayIcon sprite={POOP_SPRITE} size={22} />
                  </button>
                ))}
              </div>
            )}

            {/* Bottom Solid-Background Uniform 30x30 Pixel Dock (4 Care Actions + Recall Ball) */}
            <div className="lcd-home-dock">
              {HOME_SIDE_ACTIONS.map((item, idx) => {
                const isDisabled = isHomeActionDisabled(item.id, pet, save.stamina);
                const imgSrc = item.id === 'recall' ? room.ballSprite : item.itemImg;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isDisabled}
                    className={`lcd-sq-btn ${item.id === 'recall' ? 'is-recall' : ''} ${bezelIndex === idx && !isDisabled ? 'is-focused' : ''}`}
                    onClick={() => onHomeIconClick(item.id, idx)}
                    title={getHomeActionTitle(item, pet, save.stamina)}
                    aria-label={item.label}
                  >
                    <PixelItemImg src={imgSrc} size={30} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
