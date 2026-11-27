import React, { useEffect, useRef, useState } from 'react';
import { ACCESSORY_CATALOG, ACHIEVEMENTS, FOOD_CATALOG, POKEDEX_ORDER, ROOM_CATALOG, SPECIES_CATALOG, getGrowthStage, getPokemonCryId, getPokemonDexNo, getXpForNextLevel } from '../data/catalog';
import { isDevVirtualPetId } from '../utils/devMode';
import { DEFAULT_ANNOUNCEMENTS } from './MetaOverlays';
import { type PixelIconName } from '../data/pixelIcons';
import { POOP_SPRITE, type PetAnimPose } from '../data/sprites';
import { ALL_SURVIVOR_SKILL_IDS, CAST_MODE_OPTIONS, FORMATION_OPTIONS, SURVIVOR_SKILLS, TARGET_PRIORITY_OPTIONS, getRequiredLevelForSkillSlot, getUnlockedSkillSlotCount, type CastCadenceMode, type FollowerFormation, type LiveRunTacticsBridge, type SurvivorSkillId, type TargetPriority } from '../data/survivorsTactics';
import { type AccessoryId, type ActionAnim, type FloatingEffect, type FoodId, type GachaBoxId, type GameSave, type KeyBindings, type LcdMode, type PetRecord, type RoomThemeId, SpeciesId } from '../types/pet';
import type { BattleResultPayload, GachaOutcome, GachaTenOutcome, SurvivorsResultPayload } from '../utils/petEngine';
import { DEFAULT_KEY_BINDINGS, MAX_BOND_LEVEL, MAX_PET_SLOTS, STAMINA_COSTS, getPetBondInfo, getPetMood, getStaminaNextRecoverySec } from '../utils/petEngine';
import { sound } from '../utils/sound';
import { BattleArena } from './BattleArena';
import type { AppSettingsPatch } from './HandheldConsole';
import { type WorldMapData } from './WorldMapHud';
import { CatchTreatsGame, PeekabooGame } from './MiniGames';
import { PixelFillMeter, PixelIcon, PixelItemImg, PixelOverlayIcon, PixelPetSprite, PixelPettingHand } from './PixelSprite';
import { PokeballRoomBg } from './PokeballRoomBg';
import { Survivors3DArena } from './Survivors3DArena';
import { LcdSettingsView } from './lcd/LcdSettingsView';
import { LcdProfileMapNewsView } from './lcd/LcdProfileMapNewsView';
import { LcdBagAndMarketView } from './lcd/LcdBagAndMarketView';
import { LcdSquadAndPartyView } from './lcd/LcdSquadAndPartyView';
import { LcdPartyDetailView } from './lcd/LcdPartyDetailView';
import { LcdPokedexAndRecordsView } from './lcd/LcdPokedexAndRecordsView';
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
  onFeedSquad?: (petIds: string[]) => { ok: boolean; message: string };
  onQuickCarePet?: (
    petId: string,
    action: 'feed' | 'heal' | 'bath' | 'pat',
    foodId?: FoodId,
  ) => { ok: boolean; message: string };
  onDevGrantItems99?: () => void;
  onDevGrantPokeballs99?: () => void;
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
  onReleaseStoredPet?: (petId: string) => boolean;
  onReleaseStoredPetsBatch?: (petIds: string[]) => { ok: boolean; count: number; coins: number; xp: number; message: string };
  onDepositPet?: (petId: string) => boolean;
  onDepositPetsBatch?: (petIds: string[]) => { ok: boolean; count: number; message: string };
  onWithdrawPet?: (petId: string) => boolean;
  onWithdrawPetsBatch?: (petIds: string[]) => { ok: boolean; count: number; message: string };
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
  onFeedSquad,
  onQuickCarePet,
  onDevGrantItems99,
  onDevGrantPokeballs99,
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
  onReleaseStoredPet,
  onReleaseStoredPetsBatch,
  onDepositPet,
  onDepositPetsBatch,
  onWithdrawPet,
  onWithdrawPetsBatch,
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
  isFullscreen = false,
  onToggleFullscreen,
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
  const [partyBoxTab, setPartyBoxTab] = useState<'active' | 'storage'>('active');
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [confirmBatchRelease, setConfirmBatchRelease] = useState(false);
  const [confirmBatchDeposit, setConfirmBatchDeposit] = useState(false);
  const [confirmBatchWithdraw, setConfirmBatchWithdraw] = useState(false);
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
  const [settingsTab, setSettingsTab] = useState<'audio' | 'hud' | 'perf' | 'style' | 'keys' | 'world' | 'debug'>('audio');
  const [keysSubTab, setKeysSubTab] = useState<'keyboard' | 'gamepad'>('keyboard');
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(() => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const found = Array.from(navigator.getGamepads()).find((g): g is Gamepad => Boolean(g && g.connected));
    return found ? found.id : null;
  });
  const [rebindingAction, setRebindingAction] = useState<keyof KeyBindings | null>(null);

  useEffect(() => {
    const syncPads = () => {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) {
        setConnectedGamepadName(null);
        return;
      }
      const found = Array.from(navigator.getGamepads()).find((g): g is Gamepad => Boolean(g && g.connected));
      setConnectedGamepadName(found ? found.id : null);
      if (!found) setKeysSubTab('keyboard');
    };
    window.addEventListener('gamepadconnected', syncPads);
    window.addEventListener('gamepaddisconnected', syncPads);
    syncPads();
    return () => {
      window.removeEventListener('gamepadconnected', syncPads);
      window.removeEventListener('gamepaddisconnected', syncPads);
    };
  }, []);
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
    save.pets.find((p) => p.id === selectedPartyPetId) ??
    (save.storedPets ?? []).find((p) => p.id === selectedPartyPetId) ??
    pet;
  const partyDetailIsStored =
    !save.pets.some((p) => p.id === partyDetailPet.id) &&
    (save.storedPets ?? []).some((p) => p.id === partyDetailPet.id);
  const dexSpeciesMeta = SPECIES_CATALOG[selectedDexSpecies];
  const dexDiscovered = save.discoveredSpecies.includes(selectedDexSpecies);

  const navHistoryRef = useRef<LcdMode[]>([]);
  useEffect(() => {
    // Reset subpage back stack whenever console opens at a fresh entry mode
    navHistoryRef.current = [];
  }, [openedEntryMode]);

  const navigateWithHistory = (next: LcdMode) => {
    if (next !== mode) {
      const stack = navHistoryRef.current;
      if (next === 'menu' || next === 'home') {
        navHistoryRef.current = [];
      } else if (stack[stack.length - 1] !== mode) {
        stack.push(mode);
        if (stack.length > 16) stack.shift();
      }
    }
    onNavigateMode(next);
  };

  const handleGoBack = () => {
    const stack = navHistoryRef.current;
    while (stack.length > 0) {
      const prev = stack.pop();
      if (prev && prev !== mode) {
        onNavigateMode(prev);
        return;
      }
    }
    if (openedEntryMode === mode && onCloseHandheldTo3D) {
      onCloseHandheldTo3D();
      return;
    }
    if (mode === 'party_detail') {
      onNavigateMode(detailReturnMode);
      return;
    }
    if (mode === 'pokedex_detail') {
      onNavigateMode('pokedex');
      return;
    }
    if (mode !== 'menu' && mode !== 'home') {
      onNavigateMode('menu');
      return;
    }
    if (onCloseHandheldTo3D) {
      onCloseHandheldTo3D();
    } else {
      onExitMode();
    }
  };

  const lcdSubCtx = { STAT_BAR_ROWS, achCategory, bagTab, batchFeedback, batchSelectedIds, confirmBatchDeposit, confirmBatchRelease, confirmBatchWithdraw, confirmReleaseId, confirmReset, connectedGamepadName, detailReturnMode, dexDetailTab, dexDiscovered, dexSpeciesMeta, dexTab, feedbackSent, feedbackText, gachaBoxMeta, gachaPhase, gachaReleased, gachaResult, gachaTenResult, handleStartGacha, handleStartGachaTen, isFullscreen, keysSubTab, marketTab, menuCursor, mode, newsPhotoIdx, onAssignPetRoom, onBuyAccessory, onBuyFood, onBuyPokeball, onCloseHandheldTo3D, onDepositPet, onDepositPetsBatch, onDevGrantItems99, onDevGrantPokeballs99, onEquipAccessory, onExitMode, onFeedSquad, onGoBack: handleGoBack, onHealParty, onHealPet, onNavigateMode: navigateWithHistory, onQuickCarePet, onReleasePet, onReleasePetsBatch, onReleaseStoredPet, onReleaseStoredPetsBatch, onResetSave, onSelectFood, onStartGame, onSwitchPet, onToggleFullscreen, onUpdateMeta, onUpdatePetConfig, onUpdateSettings, onWithdrawPet, onWithdrawPetsBatch, openedEntryMode, openedFromBattle, partyBatchMode, partyBoxTab, partyDetailIsStored, partyDetailPet, partyDetailTab, partyGradeFilter, partySearch, partySortBy, pet, petActionMenuOpen, rebindingAction, releasedTenIds, save, selectedDexSpecies, selectedNewsId, setAchCategory, setBagTab, setBatchFeedback, setBatchSelectedIds, setConfirmBatchDeposit, setConfirmBatchRelease, setConfirmBatchWithdraw, setConfirmReleaseId, setConfirmReset, setDetailReturnMode, setDexDetailTab, setDexTab, setFeedbackSent, setFeedbackText, setGachaPhase, setGachaReleased, setKeysSubTab, setMarketTab, setNewsPhotoIdx, setPartyBatchMode, setPartyBoxTab, setPartyDetailTab, setPartyGradeFilter, setPartySearch, setPartySortBy, setPetActionMenuOpen, setRebindingAction, setReleasedTenIds, setSelectedDexSpecies, setSelectedNewsId, setSelectedPartyPetId, setSettingsTab, setSquadPickerSlot, settingsTab, speciesMeta, squadPickerSlot, worldMapData };
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
                          const unlockedSlots = getUnlockedSkillSlotCount(curF.level);
                          const isLockedSlot = slot >= unlockedSlots;
                          const reqLv = getRequiredLevelForSkillSlot(slot);
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
                              style={{
                                borderLeftWidth: 4,
                                borderLeftColor: isLockedSlot ? '#868e96' : sk.color,
                                opacity: isLockedSlot ? 0.62 : 1,
                              }}
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
                                <small>
                                  {isLockedSlot ? `🔒 Lv.${reqLv} 激活` : `招式 ${slot + 1} · 伤${estDmg}`}
                                </small>
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
              {!tacticsBridge?.inBattle && (
                <button
                  type="button"
                  className="lcd-mini-close"
                  onClick={
                    openedEntryMode === 'menu' && onCloseHandheldTo3D
                      ? onCloseHandheldTo3D
                      : onExitMode
                  }
                >
                  返回
                </button>
              )}
            </div>

            {/* Top News Ticker Banner (Directly reuses Kanto Daily news page!) */}
            <button
              type="button"
              className="lcd-menu-tile is-news-wide is-top-news"
              onClick={() => {
                setSelectedNewsId(null);
                setNewsPhotoIdx(0);
                navigateWithHistory('news');
              }}
              title="查看关都日报与最新更新公告"
            >
              <span className="menu-news-badge">NEWS</span>
              <PixelItemImg src="/sprites/items/poke-radar.png" size={18} />
              <div className="menu-news-copy">
                <strong>新闻公告 · 关都日报</strong>
                <small>{DEFAULT_ANNOUNCEMENTS[0]?.title ?? '查看近期更新与活动情报'}</small>
              </div>
              <span className="menu-news-arrow">查看 ›</span>
            </button>

            <div className="menu-rows-wrap">
              <div className="menu-row is-4">
                <button
                  type="button"
                  className="lcd-menu-tile"
                  onClick={() => navigateWithHistory('party')}
                >
                  <PixelItemImg src="/sprites/items/poke-ball.png" size={28} />
                  <strong>精灵球盒</strong>
                  <small>
                    {save.pets.filter((p) => !isDevVirtualPetId(p.id)).length}/{MAX_PET_SLOTS} 只
                  </small>
                </button>
                <button
                  type="button"
                  className="lcd-menu-tile"
                  onClick={() => navigateWithHistory('squad')}
                >
                  <PixelItemImg src="/sprites/items/ultra-ball.png" size={28} />
                  <strong>队伍管理</strong>
                  <small>调整出战阵容</small>
                </button>
                <button
                  type="button"
                  className="lcd-menu-tile"
                  onClick={() => navigateWithHistory('pokedex')}
                >
                  <PixelItemImg src="/sprites/items/town-map.png" size={28} />
                  <strong>宝可梦图鉴</strong>
                  <small>{save.discoveredSpecies.length}/{POKEDEX_ORDER.length} 收录</small>
                </button>
                <button
                  type="button"
                  className="lcd-menu-tile"
                  onClick={() => {
                    sound.play('confirm');
                    onCloseHandheldTo3D?.();
                    window.dispatchEvent(
                      new CustomEvent('poke-pocket:open-lab', { detail: { tab: 'universal' } }),
                    );
                  }}
                >
                  <PixelItemImg src="/sprites/items/life-orb.png" size={28} />
                  <strong>大木研究所</strong>
                  <small>强化 / 主角 / 徽章</small>
                </button>
              </div>
              <div className="menu-row is-3">
                <button
                  type="button"
                  className="lcd-menu-tile"
                  onClick={() => navigateWithHistory('achievements')}
                >
                  <PixelItemImg src="/sprites/items/kings-rock.png" size={28} />
                  <strong>成就徽章</strong>
                  <small>{save.unlockedAchievements.length}/{ACHIEVEMENTS.length}</small>
                </button>
                <button
                  type="button"
                  className="lcd-menu-tile"
                  onClick={() => navigateWithHistory('diary')}
                >
                  <PixelItemImg src="/sprites/items/vs-seeker.png" size={28} />
                  <strong>冒险日记</strong>
                  <small>成长记录</small>
                </button>
                <button
                  type="button"
                  className="lcd-menu-tile"
                  onClick={() => navigateWithHistory('settings')}
                >
                  <PixelItemImg src="/sprites/items/exp-share.png" size={28} />
                  <strong>系统设置</strong>
                  <small>音频 / 画面 / 世界</small>
                </button>
              </div>
            </div>

            {tacticsBridge?.inBattle && (
              <div className="lcd-menu-run-actions">
                <button
                  type="button"
                  className="lcd-run-exit-btn"
                  onClick={() => {
                    onCloseHandheldTo3D?.();
                    tacticsBridge.onSettleAndExit();
                  }}
                >
                  <PixelIcon name="arrow_left" size={11} />
                  <span>返回菜单</span>
                </button>
                <button
                  type="button"
                  className="lcd-run-resume-btn"
                  onClick={() => onCloseHandheldTo3D?.()}
                >
                  <PixelIcon name="play" size={11} />
                  <span>继续冒险</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* SYSTEM SETTINGS (5 Full Pro Tabs: 音频 | 界面 | 画面 | 外观 | 按键) */}
        <LcdSettingsView ctx={lcdSubCtx} />
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

        <LcdProfileMapNewsView ctx={lcdSubCtx} />
        <LcdBagAndMarketView ctx={lcdSubCtx} />
        <LcdSquadAndPartyView ctx={lcdSubCtx} />
        <LcdPartyDetailView ctx={lcdSubCtx} />
        <LcdPokedexAndRecordsView ctx={lcdSubCtx} />
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
                    <PixelFillMeter
                      name="heart"
                      value={getPetBondInfo(pet).progressPct}
                      label={`亲密 Lv.${getPetBondInfo(pet).level}`}
                      size={14}
                    />
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
                  : getPetBondInfo(pet).level >= MAX_BOND_LEVEL && pet.happiness >= 100
                    ? `${pet.name} 亲密已达满级 Lv.10`
                    : `点击抚摸宝可梦（当前亲密 Lv.${getPetBondInfo(pet).level}）`
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
