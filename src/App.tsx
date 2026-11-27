import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdoptionModal } from './components/AdoptionModal';
import { HandheldConsole, type AppSettingsPatch } from './components/HandheldConsole';
import { LandscapeFullscreenCover } from './components/LandscapeFullscreenCover';
import { useFullscreenAndOrientation } from './utils/fullscreen';
import {
  HOME_SIDE_ACTIONS,
  isHomeActionDisabled,
  type HomeIconActionId,
} from './components/LcdScreen';
import { Survivors3DArena } from './components/Survivors3DArena';
import { ACCESSORY_CATALOG, ACHIEVEMENTS, FOOD_CATALOG, ROOM_CATALOG, SPECIES_CATALOG, getPokemonCryId } from './data/catalog';
import {
  DEV_GRANT_CURRENCY_LEVEL,
  DEV_GRANT_FILL_COUNT,
  DEV_INFINITE_CURRENCY_DISPLAY,
  applyDevGrantsOverlay,
  isDevVirtualPetId,
  patchDevVirtualPet,
  sanitizeRealSaveAfterDevRollback,
  setDevActiveVirtualPetId,
  useDevGrants,
  useDevMode,
} from './utils/devMode';
import type { PixelIconName } from './data/pixelIcons';
import type {
  AccessoryId,
  ActionAnim,
  FloatingEffect,
  FoodId,
  GachaBoxId,
  GameSave,
  LcdMode,
  RoomThemeId,
  SpeciesId,
} from './types/pet';
import {
  DEFAULT_KEY_BINDINGS,
  adoptPet,
  assignPetBallRoom,
  bathPet,
  buyAccessory,
  buyFood,
  buyPokeball,
  captureBossPet,
  cleanPoop,
  createInitialSave,
  depositPetToStorage,
  depositPetsBatch,
  equipAccessory,
  feedPet,
  feedSquadPets,
  getActivePet,
  healAllPets,
  healPet,
  loadSave,
  patPet,
  persistSave,
  pullGachaBox,
  pullGachaTen,
  recordBattleOutcome,
  recordMiniGameResult,
  syncAchievements,
  recordSurvivorsOutcome,
  releasePet,
  releasePetsBatch,
  releaseStoredPet,
  releaseStoredPetsBatch,
  spendStaminaForBattle,
  spendStaminaForGame,
  switchPet,
  tickPet,
  tickStamina,
  toggleSleep,
  withdrawPetFromStorage,
  withdrawPetsBatch,
  type ActionOutcome,
  type BattleResultPayload,
  type SurvivorsResultPayload,
} from './utils/petEngine';
import type { LiveRunTacticsBridge } from './data/survivorsTactics';
import {
  ensureFreshMetaProgress,
  incrementBounties,
  type MetaProgressState,
} from './data/metaProgression';
import { sound, type SfxKind } from './utils/sound';

function matchesKey(e: KeyboardEvent, bound: string): boolean {
  if (!bound) return false;
  if (bound.length === 1) return e.key.toLowerCase() === bound.toLowerCase();
  return e.key === bound;
}

export function App() {
  const [save, setSave] = useState<GameSave>(() => {
    const loaded = loadSave();
    const now = Date.now();
    const tickedPets = loaded.pets.map((p) => tickPet(p, now).pet);
    return {
      ...loaded,
      pets: tickedPets,
      meta: ensureFreshMetaProgress(loaded.meta, now),
    };
  });

  // Default landing experience is the Full-Viewport 3D Pixel World Hub!
  const [lcdMode, setLcdMode] = useState<LcdMode>('survivors');
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerClosing, setManagerClosing] = useState(false);
  const managerCloseTimerRef = useRef<number | null>(null);
  const [managerFromBattle, setManagerFromBattle] = useState(false);
  const [managerEntryMode, setManagerEntryMode] = useState<LcdMode | null>(null);
  const [focusedDetailPetId, setFocusedDetailPetId] = useState<string | null>(null);
  const [captureReveal, setCaptureReveal] = useState<import('./types/pet').CaptureRevealPayload | null>(null);
  const [worldMapData, setWorldMapData] = useState<import('./components/WorldMapHud').WorldMapData | null>(null);
  const captureAfterCloseRef = useRef<(() => void) | null>(null);
  const [arenaHasBackLayer, setArenaHasBackLayer] = useState(false);
  const arenaBackHandlerRef = useRef<(() => boolean) | null>(null);
  const backGuardPushedRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const [tacticsBridge, setTacticsBridge] = useState<LiveRunTacticsBridge | null>(null);
  const [battleIsTrainer, setBattleIsTrainer] = useState(false);
  const [bezelIndex, setBezelIndex] = useState(0);
  const [menuCursor, setMenuCursor] = useState(0);
  const {
    isFullscreen,
    isStandalone,
    isMobileLandscape,
    supportsFullscreen,
    enterFullscreen,
    toggleFullscreen,
  } = useFullscreenAndOrientation();
  const [dismissedLandscapeCover, setDismissedLandscapeCover] = useState(false);
  const [manualFullscreenGuide, setManualFullscreenGuide] = useState(false);

  const handleHubToggleFullscreen = useCallback(async () => {
    sound.play('confirm');
    const res = await toggleFullscreen();
    if (!res.ok) {
      setManualFullscreenGuide(true);
    }
  }, [toggleFullscreen]);

  const [actionAnim, setActionAnim] = useState<ActionAnim>('idle');
  const [patSeq, setPatSeq] = useState(0);
  const [activeFood, setActiveFood] = useState<FoodId | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [controlSignal, setControlSignal] = useState<{
    seq: number;
    dir: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | null;
  }>({ seq: 0, dir: null });

  const animTimerRef = useRef<number | null>(null);
  const speechTimerRef = useRef<number | null>(null);
  const analogVecRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [devMode] = useDevMode();
  const [devGrants, devGrantsVer] = useDevGrants();

  // Sanitize real save cleanly whenever debug grants or debug mode are toggled OFF
  useEffect(() => {
    setSave((prev) => sanitizeRealSaveAfterDevRollback(prev, devGrants, devMode));
  }, [devMode, devGrants.allPets, devGrants.allItems, devGrants.allPokeballs, devGrants.allLabUpgrades]);

  const effectiveSave = useMemo(
    () => applyDevGrantsOverlay(save, devMode, devGrants),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save, devMode, devGrants, devGrantsVer],
  );
  const activePet = getActivePet(effectiveSave);
  const realActivePet = getActivePet(save);

  useEffect(() => {
    sound.setMasterVolume(save.prefs?.masterVolume ?? 80);
    sound.setMuteOnBlur(save.prefs?.muteOnBlur ?? true);
    sound.setSfxVolume(save.sfxVolume);
    sound.setBgm(save.bgmEnabled, save.bgmVolume);
    sound.setAmbient(save.prefs?.ambientEnabled ?? true, save.prefs?.ambientVolume ?? 68);
    sound.setMuted(save.muted);
    sound.setCry(save.cryEnabled ?? true, save.cryVolume ?? 80);
    sound.setCombatSfx(save.combatSfxEnabled ?? true);
    persistSave(save);
  }, [save]);

  // Dynamic BGM switching for 2D Handheld modes (3D Open-World zones & interiors dynamically manage their own BGM!)
  useEffect(() => {
    if (lcdMode === 'battle') {
      sound.setTrack('battle');
    } else if (managerOpen && (lcdMode === 'home' || lcdMode === 'party' || lcdMode === 'party_detail')) {
      sound.setTrack('house');
    } else if (lcdMode !== 'survivors' && !managerOpen) {
      sound.setTrack('town');
    }
  }, [lcdMode, managerOpen]);

  useEffect(() => {
    const unlockAudio = () => sound.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useEffect(() => {
    const initial = loadSave();
    const pet = getActivePet(initial);
    if (pet) {
      const gapMins = Math.floor((Date.now() - pet.lastTickAt) / 60_000);
      if (gapMins >= 2) {
        setSpeech(`欢迎回来训练家！等了你 ${gapMins} 分钟啦～`);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setSave((prev) => {
        if (!prev.pets.length) return tickStamina(prev, now);
        const withStamina = tickStamina(prev, now);
        return {
          ...withStamina,
          pets: withStamina.pets.map((p) => tickPet(p, now).pet),
        };
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const showSpeech = useCallback((msg: string) => {
    setSpeech(msg);
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    speechTimerRef.current = window.setTimeout(() => setSpeech(null), 2800);
  }, []);

  const triggerAnim = useCallback((anim: ActionAnim, durationMs = 1500) => {
    setActionAnim(anim);
    if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    animTimerRef.current = window.setTimeout(() => {
      setActionAnim('idle');
      setActiveFood(null);
    }, durationMs);
  }, []);

  const spawnEffect = useCallback(
    (
      kind: FloatingEffect['kind'],
      text: string,
      x = 50,
      y = 45,
      icon?: PixelIconName,
    ) => {
      const id = `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setEffects((prev) => [...prev.slice(-8), { id, kind, icon, text, x, y }]);
      window.setTimeout(() => {
        setEffects((prev) => prev.filter((item) => item.id !== id));
      }, 1150);
    },
    [],
  );

  const applyOutcome = useCallback(
    (
      outcome: ActionOutcome,
      sfx?: SfxKind,
      silentSpeech = false,
    ) => {
      if (!outcome.ok) {
        sound.play('error');
        if (!silentSpeech) showSpeech(outcome.message);
        return false;
      }

      setSave(outcome.save);
      if (sfx) sound.play(sfx);

      if (outcome.coinsEarned) {
        spawnEffect('coin', `+${outcome.coinsEarned}`, 68, 34, 'coin');
      }
      if (outcome.xpEarned) {
        spawnEffect('xp', `+${outcome.xpEarned} EXP`, 28, 38);
      }

      if (outcome.leveledUp) {
        window.setTimeout(() => sound.play('levelup'), 220);
        triggerAnim('levelup', 1900);
        if (!silentSpeech) {
          showSpeech(
            outcome.evolvedTo
              ? `不可思议！进化成了【${outcome.evolvedTo}】！`
              : `升级啦！获得 +15 金币奖励！`,
          );
        }
      } else if (outcome.newlyUnlocked && outcome.newlyUnlocked.length > 0) {
        const ach = ACHIEVEMENTS.find((a) => a.id === outcome.newlyUnlocked?.[0]);
        if (!silentSpeech) {
          showSpeech(
            ach
              ? `解锁成就「${ach.title}」(+${ach.rewardCoins} 金币)`
              : outcome.message,
          );
        }
      } else if (!silentSpeech) {
        showSpeech(outcome.message);
      }
      return true;
    },
    [showSpeech, spawnEffect, triggerAnim],
  );

  const handlePat = useCallback(() => {
    if (!activePet || lcdMode !== 'home') return;
    const outcome = patPet(save, activePet.id);
    // Avoid clashing harsh 8-bit square chime directly over the Pokémon's voice cry
    const patSfx = (save.cryEnabled ?? true) ? undefined : 'happy';
    if (applyOutcome(outcome, patSfx)) {
      sound.playCry(getPokemonCryId(activePet.species, activePet.level));
      setPatSeq((s) => s + 1);
      triggerAnim('patting', 1100);
      spawnEffect('heart', '', 42, 34, 'heart');
      spawnEffect('heart', '', 58, 28, 'heart');
      spawnEffect('sparkle', '', 50, 22, 'sparkle');
    }
  }, [activePet, lcdMode, save, applyOutcome, triggerAnim, spawnEffect]);

  const handleFeed = useCallback(
    (foodId: FoodId) => {
      if (!activePet) return;
      const foodMeta = FOOD_CATALOG.find((f) => f.id === foodId);
      if (isDevVirtualPetId(activePet.id)) {
        if (foodMeta) {
          patchDevVirtualPet(activePet.id, {
            hunger: Math.min(100, activePet.hunger + foodMeta.hunger),
            happiness: Math.min(100, activePet.happiness + foodMeta.happiness),
            health: Math.min(100, activePet.health + (foodMeta.health ?? 0)),
            isSick: foodMeta.curesSick ? false : activePet.isSick,
            level: foodMeta.levelUp ? Math.min(100, activePet.level + 1) : activePet.level,
          });
          sound.play('eat');
          setLcdMode('home');
          setActiveFood(foodId);
          triggerAnim('eating', 1600);
          spawnEffect('heart', '美味!', 52, 28, 'heart');
          showSpeech(`${activePet.name} 吃下了${foodMeta.name}！`);
        }
        return;
      }
      const realStock = save.inventory[foodId] ?? 0;
      const isInfiniteItems = devMode && devGrants.allItems && Boolean(foodMeta && !foodMeta.unlimited);
      const feedSourceSave =
        isInfiniteItems && realStock <= 0
          ? { ...save, inventory: { ...save.inventory, [foodId]: 1 } }
          : save;
      const outcome = feedPet(feedSourceSave, activePet.id, foodId);
      if (outcome.ok && isInfiniteItems) {
        outcome.save = {
          ...outcome.save,
          inventory: { ...outcome.save.inventory, [foodId]: realStock },
        };
      }
      if (applyOutcome(outcome, 'eat')) {
        if (SPECIES_CATALOG[activePet.species].favoriteFood === foodId || outcome.evolvedTo) {
          const updated = outcome.save.pets.find((p) => p.id === activePet.id) ?? activePet;
          window.setTimeout(
            () => sound.playCry(getPokemonCryId(updated.species, updated.level)),
            240,
          );
        }
        setLcdMode('home');
        setActiveFood(foodId);
        triggerAnim('eating', 1600);
        spawnEffect('heart', '美味!', 52, 28, 'heart');
      }
    },
    [activePet, save, devMode, devGrants.allItems, applyOutcome, triggerAnim, spawnEffect, showSpeech],
  );

  const handleBath = useCallback(() => {
    if (!activePet) return;
    const outcome = bathPet(save, activePet.id);
    if (applyOutcome(outcome, 'bath')) {
      setLcdMode('home');
      triggerAnim('bathing', 1900);
      spawnEffect('bubble', '香香!', 48, 30, 'bubble');
      spawnEffect('sparkle', '', 62, 42, 'sparkle');
    }
  }, [activePet, save, applyOutcome, triggerAnim, spawnEffect]);

  const handleCleanPoop = useCallback(() => {
    if (!activePet) return;
    const outcome = cleanPoop(save, activePet.id);
    if (applyOutcome(outcome, 'bath')) {
      triggerAnim('happy', 1100);
      spawnEffect('sparkle', '干净!', 56, 62, 'sparkle');
    }
  }, [activePet, save, applyOutcome, triggerAnim, spawnEffect]);

  const handleToggleSleep = useCallback(() => {
    if (!activePet) return;
    const outcome = toggleSleep(save, activePet.id);
    if (applyOutcome(outcome, 'sleep')) {
      setLcdMode('home');
    }
  }, [activePet, save, applyOutcome]);

  const handleHeal = useCallback(() => {
    if (!activePet) return;
    const outcome = healPet(save, activePet.id);
    if (applyOutcome(outcome, 'happy')) {
      setLcdMode('home');
      triggerAnim('medicine', 1600);
      spawnEffect('heart', '全满', 50, 32, 'pill');
    }
  }, [activePet, save, applyOutcome, triggerAnim, spawnEffect]);

  const handleHealParty = useCallback(() => {
    const outcome = healAllPets(save);
    applyOutcome(outcome, 'heal_jingle', true);
  }, [save, applyOutcome]);

  const handleFeedSquad = useCallback(
    (petIds: string[]) => {
      const realIds = petIds.filter((id) => !isDevVirtualPetId(id));
      const virtualIds = petIds.filter((id) => isDevVirtualPetId(id));
      let virtualFed = 0;
      for (const vid of virtualIds) {
        const vp = effectiveSave.pets.find((p) => p.id === vid);
        if (vp && !vp.isSleeping && vp.hunger < 100) {
          virtualFed += 1;
          patchDevVirtualPet(vid, {
            hunger: Math.min(100, vp.hunger + 30),
            happiness: Math.min(100, vp.happiness + 8),
          });
        }
      }
      if (realIds.length > 0) {
        const outcome = feedSquadPets(save, realIds);
        if (outcome.ok) {
          applyOutcome(outcome, 'eat', true);
          return { ok: true, message: outcome.message };
        }
        if (virtualFed > 0) {
          sound.play('eat');
          return { ok: true, message: `已为 ${virtualFed} 只伙伴一键喂食橙橙果！` };
        }
        sound.play('error');
        return { ok: false, message: outcome.message };
      }
      if (virtualFed > 0) {
        sound.play('eat');
        return { ok: true, message: `已为 ${virtualFed} 只伙伴一键喂食橙橙果！` };
      }
      sound.play('error');
      return { ok: false, message: '当前队伍里的宝可梦都已经吃得饱饱的啦！' };
    },
    [save, effectiveSave.pets, applyOutcome],
  );

  const handleQuickCarePet = useCallback(
    (
      petId: string,
      action: 'feed' | 'heal' | 'bath' | 'pat',
      foodId?: FoodId,
    ): { ok: boolean; message: string } => {
      const target = effectiveSave.pets.find((p) => p.id === petId);
      if (!target) return { ok: false, message: '未找到该宝可梦' };

      if (isDevVirtualPetId(petId)) {
        if (action === 'heal') {
          if (!target.isSick && target.health >= 100) {
            sound.play('error');
            return { ok: false, message: `${target.name} HP 已满，无需治疗！` };
          }
          patchDevVirtualPet(petId, { health: 100, isSick: false, happiness: Math.min(100, target.happiness + 10) });
          sound.play('heal_jingle');
          return { ok: true, message: `已治愈 ${target.name}，HP 恢复满格！` };
        }
        if (action === 'bath') {
          if (target.cleanliness >= 100 && target.poopCount <= 0) {
            sound.play('error');
            return { ok: false, message: `${target.name} 已经干干净净啦！` };
          }
          patchDevVirtualPet(petId, { cleanliness: 100, poopCount: 0, happiness: Math.min(100, target.happiness + 12) });
          sound.play('bath');
          return { ok: true, message: `${target.name} 洗完澡闪闪发亮！` };
        }
        if (action === 'pat') {
          patchDevVirtualPet(petId, { happiness: Math.min(100, target.happiness + 10) });
          sound.playCry(getPokemonCryId(target.species, target.level));
          return { ok: true, message: `温柔抚摸了 ${target.name}，心情大好！` };
        }
        const fMeta = FOOD_CATALOG.find((f) => f.id === (foodId ?? 'oran_berry')) ?? FOOD_CATALOG[0];
        if (!fMeta.levelUp && !fMeta.curesSick && !(fMeta.health && target.health < 100) && target.hunger >= 100) {
          sound.play('error');
          return { ok: false, message: `${target.name} 饱食度已经满啦！` };
        }
        patchDevVirtualPet(petId, {
          hunger: Math.min(100, target.hunger + fMeta.hunger),
          happiness: Math.min(100, target.happiness + fMeta.happiness),
          health: Math.min(100, target.health + (fMeta.health ?? 0)),
          isSick: fMeta.curesSick ? false : target.isSick,
          level: fMeta.levelUp ? Math.min(100, target.level + 1) : target.level,
        });
        sound.play('eat');
        return { ok: true, message: `${target.name} 享用了${fMeta.name}！` };
      }

      if (action === 'heal') {
        const outcome = healPet(save, petId);
        const ok = applyOutcome(outcome, 'heal_jingle', true);
        return { ok, message: outcome.message };
      }
      if (action === 'bath') {
        const outcome = bathPet(save, petId);
        const ok = applyOutcome(outcome, 'bath', true);
        return { ok, message: outcome.message };
      }
      if (action === 'pat') {
        const outcome = patPet(save, petId);
        const patSfx = (save.cryEnabled ?? true) ? undefined : 'happy';
        const ok = applyOutcome(outcome, patSfx, true);
        if (ok) {
          sound.playCry(getPokemonCryId(target.species, target.level));
        }
        return { ok, message: outcome.message };
      }
      const chosenFoodId: FoodId = foodId ?? 'oran_berry';
      const fMeta = FOOD_CATALOG.find((f) => f.id === chosenFoodId);
      const realStock = save.inventory[chosenFoodId] ?? 0;
      const isInfiniteItems = devMode && devGrants.allItems && Boolean(fMeta && !fMeta.unlimited);
      const feedSourceSave =
        isInfiniteItems && realStock <= 0
          ? { ...save, inventory: { ...save.inventory, [chosenFoodId]: 1 } }
          : save;
      const outcome = feedPet(feedSourceSave, petId, chosenFoodId);
      if (outcome.ok && isInfiniteItems) {
        outcome.save = {
          ...outcome.save,
          inventory: { ...outcome.save.inventory, [chosenFoodId]: realStock },
        };
      }
      const ok = applyOutcome(outcome, 'eat', true);
      if (ok && (SPECIES_CATALOG[target.species].favoriteFood === chosenFoodId || outcome.evolvedTo)) {
        const updated = outcome.save.pets.find((p) => p.id === petId) ?? target;
        window.setTimeout(() => sound.playCry(getPokemonCryId(updated.species, updated.level)), 200);
      }
      return { ok, message: outcome.message };
    },
    [effectiveSave.pets, save, devMode, devGrants.allItems, applyOutcome],
  );

  const handleDevGrantItems99 = useCallback(() => {
    sound.play('coin');
    setSave((prev) => {
      const nextInv = { ...prev.inventory };
      for (const food of FOOD_CATALOG) {
        nextInv[food.id] = Math.max(nextInv[food.id] ?? 0, DEV_GRANT_FILL_COUNT);
      }
      const nextAccStock = { ...prev.accessoryStock };
      const nextUnlockedAcc = new Set<AccessoryId>(prev.unlockedAccessories);
      for (const acc of ACCESSORY_CATALOG) {
        nextUnlockedAcc.add(acc.id);
        if (acc.id !== 'none') {
          nextAccStock[acc.id] = Math.max(nextAccStock[acc.id] ?? 0, DEV_GRANT_FILL_COUNT);
        }
      }
      return {
        ...prev,
        inventory: nextInv,
        accessoryStock: nextAccStock,
        unlockedAccessories: Array.from(nextUnlockedAcc),
      };
    });
  }, []);

  const handleDevGrantPokeballs99 = useCallback(() => {
    sound.play('coin');
    setSave((prev) => {
      const nextBallStock = { ...prev.ballStock };
      const nextUnlockedRooms = new Set<RoomThemeId>(prev.unlockedRooms);
      for (const rm of ROOM_CATALOG) {
        nextUnlockedRooms.add(rm.id);
        if (rm.id !== 'pokeball_room') {
          nextBallStock[rm.id] = Math.max(nextBallStock[rm.id] ?? 0, DEV_GRANT_FILL_COUNT);
        }
      }
      return {
        ...prev,
        ballStock: nextBallStock,
        unlockedRooms: Array.from(nextUnlockedRooms),
      };
    });
  }, []);

  const handleDevGrantStardust99999 = useCallback(() => {
    sound.play('levelup');
    setSave((prev) => {
      const curMeta = ensureFreshMetaProgress(prev.meta);
      return {
        ...prev,
        meta: {
          ...curMeta,
          stardust: Math.max(curMeta.stardust, DEV_GRANT_CURRENCY_LEVEL),
        },
      };
    });
  }, []);

  const handleDevGrantCoins99999 = useCallback(() => {
    sound.play('coin');
    setSave((prev) => ({
      ...prev,
      coins: Math.max(prev.coins, DEV_GRANT_CURRENCY_LEVEL),
    }));
  }, []);

  const handleOpenPokemonManager = useCallback(
    (subMode: LcdMode = 'home', fromBattle = false, focusPetId?: string) => {
      if (managerCloseTimerRef.current !== null) {
        window.clearTimeout(managerCloseTimerRef.current);
        managerCloseTimerRef.current = null;
      }
      sound.play('confirm');
      setManagerClosing(false);
      setManagerFromBattle(fromBattle);
      setManagerEntryMode(subMode);
      setFocusedDetailPetId(focusPetId ?? null);
      setLcdMode(subMode);
      setManagerOpen(true);
    },
    [],
  );

  const handleClosePokemonManager = useCallback(() => {
    if (!managerOpen || managerClosing) return;
    sound.play('cancel');
    setManagerClosing(true);
    if (managerCloseTimerRef.current !== null) {
      window.clearTimeout(managerCloseTimerRef.current);
    }
    managerCloseTimerRef.current = window.setTimeout(() => {
      managerCloseTimerRef.current = null;
      setManagerOpen(false);
      setManagerClosing(false);
      setManagerFromBattle(false);
      setManagerEntryMode(null);
      setLcdMode('survivors');
      const cb = captureAfterCloseRef.current;
      captureAfterCloseRef.current = null;
      if (cb) cb();
      tacticsBridge?.onResumeBattle();
    }, 210);
  }, [managerOpen, managerClosing, tacticsBridge]);

  const handleRecallToOverworld = useCallback(() => {
    if (!activePet) return;
    if (activePet.isSleeping) {
      sound.play('error');
      showSpeech(`${activePet.name} 正在熟睡，先开灯叫醒再出发吧～`);
      return;
    }
    sound.play('pokeball');
    triggerAnim('recalling', 360);
    window.setTimeout(() => {
      setManagerOpen(false);
      setManagerFromBattle(false);
      setLcdMode('survivors');
    }, 280);
  }, [activePet, showSpeech, triggerAnim]);

  const handleUpdateMeta = useCallback(
    (updater: (prevMeta: MetaProgressState) => MetaProgressState, coinDelta = 0) => {
      const freeCoins = devMode && devGrants.infiniteCoins;
      setSave((prev) => {
        const curMeta = ensureFreshMetaProgress(prev.meta);
        const nextMeta = updater(curMeta);
        const appliedDelta = freeCoins && coinDelta < 0 ? 0 : coinDelta;
        return syncAchievements({
          ...prev,
          coins: Math.max(0, prev.coins + appliedDelta),
          meta: nextMeta,
        });
      });
    },
    [devMode, devGrants.infiniteCoins],
  );

  const handleUpdatePetConfig = useCallback(
    (
      petId: string,
      patch: {
        enhanceCost?: number;
        enhanceDelta?: number;
        pinnedSkills?: string[];
        bannedSkills?: string[];
        skin?: import('./types/pet').PetSkinId;
        skinCost?: number;
        unlockSkin?: string;
      },
    ): boolean => {
      if (isDevVirtualPetId(petId)) {
        const cur = effectiveSave.pets.find((p) => p.id === petId);
        patchDevVirtualPet(petId, {
          enhanceLevel: patch.enhanceDelta
            ? Math.min(10, (cur?.enhanceLevel ?? 0) + patch.enhanceDelta)
            : cur?.enhanceLevel,
          pinnedSkills: patch.pinnedSkills ?? cur?.pinnedSkills,
          bannedSkills: patch.bannedSkills ?? cur?.bannedSkills,
          skin: patch.skin ?? cur?.skin,
        });
        sound.play('confirm');
        return true;
      }
      let ok = false;
      const freeCoins = devMode && devGrants.infiniteCoins;
      setSave((prev) => {
        const cost = (patch.enhanceCost ?? 0) + (patch.skinCost ?? 0);
        if (!freeCoins && cost > 0 && prev.coins < cost) return prev;
        ok = true;
        const nextPets = prev.pets.map((p) => {
          if (p.id !== petId) return p;
          return {
            ...p,
            enhanceLevel: patch.enhanceDelta
              ? Math.min(10, (p.enhanceLevel ?? 0) + patch.enhanceDelta)
              : p.enhanceLevel,
            pinnedSkills: patch.pinnedSkills ?? p.pinnedSkills,
            bannedSkills: patch.bannedSkills ?? p.bannedSkills,
            skin: patch.skin ?? p.skin,
          };
        });
        const curMeta = ensureFreshMetaProgress(prev.meta);
        const nextUnlockedSkins = patch.unlockSkin
          ? Array.from(new Set([...(curMeta.unlockedSkins ?? ['classic']), patch.unlockSkin]))
          : curMeta.unlockedSkins;
        const metaUpdated = {
          ...curMeta,
          unlockedSkins: nextUnlockedSkins,
        };
        return {
          ...prev,
          coins: freeCoins ? prev.coins : Math.max(0, prev.coins - cost),
          pets: nextPets,
          meta: patch.enhanceDelta ? incrementBounties(metaUpdated, { gacha_or_care: 1 }) : metaUpdated,
        };
      });
      if (ok) sound.play(patch.enhanceDelta || patch.unlockSkin ? 'levelup' : 'confirm');
      else sound.play('error');
      return ok;
    },
    [effectiveSave.pets, devMode, devGrants.infiniteCoins],
  );

  const handleFinishSurvivors = useCallback(
    (petId: string, payload: SurvivorsResultPayload, returnToRoom = false) => {
      const outcome = recordSurvivorsOutcome(save, petId, payload);
      const curMeta = ensureFreshMetaProgress(outcome.save.meta);
      const stardustGain = Math.max(
        18,
        Math.round(payload.kills * 0.35 + (payload.cleared ? 65 : 15) + payload.runLevel * 4),
      );
      const prevBadges = new Set(curMeta.unlockedBadges ?? []);
      const newTotalKills = curMeta.totalKills + payload.kills;
      const newTotalRuns = curMeta.totalRuns + 1;
      const newBosses = curMeta.totalBossesDefeated + (payload.cleared ? 1 : 0);
      if (newBosses >= 1) prevBadges.add('boulder_badge');
      if (newBosses >= 2 || newTotalKills >= 80) prevBadges.add('cascade_badge');
      if (newBosses >= 3 || newTotalKills >= 160) prevBadges.add('thunder_badge');
      if (newTotalKills >= 120) prevBadges.add('rainbow_badge');
      if (newTotalKills >= 240 || newTotalRuns >= 3) prevBadges.add('volcano_badge');
      if (newBosses >= 4 || newTotalKills >= 360) prevBadges.add('earth_badge');
      const nextMeta = incrementBounties(
        {
          ...curMeta,
          stardust: curMeta.stardust + stardustGain,
          totalKills: newTotalKills,
          totalBossesDefeated: newBosses,
          totalRuns: newTotalRuns,
          totalCoinsEarned: curMeta.totalCoinsEarned + payload.coinsCollected,
          unlockedBadges: Array.from(prevBadges),
        },
        {
          kills: payload.kills,
          bosses: payload.cleared ? 1 : 0,
          runs_cleared: payload.cleared ? 1 : 0,
          coins_earned: payload.coinsCollected,
          upgrades_picked: Math.max(0, payload.runLevel - 1),
        },
      );
      setSave({ ...outcome.save, meta: nextMeta });
      if (returnToRoom) {
        sound.play('hatch');
        setLcdMode('home');
        setManagerOpen(true);
        setManagerFromBattle(false);
        triggerAnim('happy', 900);
        if (activePet) {
          window.setTimeout(
            () => sound.playCry(getPokemonCryId(activePet.species, activePet.level)),
            260,
          );
        }
      }
      if (outcome.leveledUp) {
        sound.play('levelup');
      }
      showSpeech(`${outcome.message}（+${stardustGain} 星星沙子）`);
    },
    [save, activePet, showSpeech, triggerAnim],
  );

  const handleSpendCoinsInRun = useCallback(
    (cost: number): boolean => {
      if (cost <= 0) return true;
      if (devMode && devGrants.infiniteCoins) return true;
      if (save.coins < cost) return false;
      setSave((prev) => ({
        ...prev,
        coins: Math.max(0, prev.coins - cost),
      }));
      return true;
    },
    [save.coins, devMode, devGrants.infiniteCoins],
  );

  const handleCaptureBoss = useCallback(
    (species: SpeciesId, level: number, skin?: import('./types/pet').PetSkinId) => {
      setSave((prev) => captureBossPet(prev, species, level, Date.now(), skin).save);
    },
    [],
  );

  const handleReleaseBallToRoom = useCallback(() => {
    sound.play('hatch');
    setLcdMode('home');
    triggerAnim('happy', 900);
    if (activePet) {
      window.setTimeout(
        () => sound.playCry(getPokemonCryId(activePet.species, activePet.level)),
        260,
      );
      showSpeech(`出来吧！「${activePet.name}」！回到温馨球舱啦～`);
    }
  }, [activePet, showSpeech, triggerAnim]);

  const handleStartBattle = useCallback(
    (isTrainer: boolean) => {
      if (!activePet) return;
      const res = spendStaminaForBattle(save);
      if (!res.ok) {
        sound.play('error');
        showSpeech(res.message);
        return;
      }
      sound.play('confirm');
      setSave(res.save);
      setBattleIsTrainer(isTrainer);
      setLcdMode('battle');
    },
    [activePet, save, showSpeech],
  );

  const handleFinishBattle = useCallback(
    (fighterId: string, payload: BattleResultPayload) => {
      const outcome = recordBattleOutcome(save, fighterId, payload);
      setSave(outcome.save);
      setLcdMode('recalled');
      if (outcome.leveledUp) {
        sound.play('levelup');
      }
      showSpeech(outcome.message);
    },
    [save, showSpeech],
  );

  const handleFinishGame = useCallback(
    (gameLabel: string, score: number, won: boolean) => {
      if (!activePet) return;
      const outcome = recordMiniGameResult(save, activePet.id, gameLabel, score, won);
      setLcdMode('home');
      if (applyOutcome(outcome, won ? 'levelup' : 'coin')) {
        triggerAnim('happy', 1500);
      }
    },
    [activePet, save, applyOutcome, triggerAnim],
  );

  const handleBuyFood = useCallback(
    (foodId: FoodId) => {
      const freeCoins = devMode && devGrants.infiniteCoins;
      const src = freeCoins ? { ...save, coins: Math.max(save.coins, DEV_INFINITE_CURRENCY_DISPLAY) } : save;
      const outcome = buyFood(src, foodId, 1);
      if (outcome.ok && freeCoins) outcome.save = { ...outcome.save, coins: save.coins };
      applyOutcome(outcome, 'coin', true);
    },
    [save, devMode, devGrants.infiniteCoins, applyOutcome],
  );

  const handleBuyAccessory = useCallback(
    (accId: AccessoryId) => {
      const freeCoins = devMode && devGrants.infiniteCoins;
      const src = freeCoins ? { ...save, coins: Math.max(save.coins, DEV_INFINITE_CURRENCY_DISPLAY) } : save;
      const outcome = buyAccessory(src, accId);
      if (outcome.ok && freeCoins) outcome.save = { ...outcome.save, coins: save.coins };
      applyOutcome(outcome, 'coin', true);
    },
    [save, devMode, devGrants.infiniteCoins, applyOutcome],
  );

  const handleEquipAccessory = useCallback(
    (petId: string, accId: AccessoryId) => {
      if (isDevVirtualPetId(petId)) {
        patchDevVirtualPet(petId, { accessory: accId });
        sound.play('confirm');
        return;
      }
      const allowDevItems = devMode && devGrants.allItems;
      const outcome = equipAccessory(save, petId, accId, Date.now(), allowDevItems);
      applyOutcome(outcome, 'confirm', true);
    },
    [save, devMode, devGrants.allItems, applyOutcome],
  );

  const handleBuyPokeball = useCallback(
    (roomId: RoomThemeId) => {
      const freeCoins = devMode && devGrants.infiniteCoins;
      const src = freeCoins ? { ...save, coins: Math.max(save.coins, DEV_INFINITE_CURRENCY_DISPLAY) } : save;
      const outcome = buyPokeball(src, roomId);
      if (outcome.ok && freeCoins) outcome.save = { ...outcome.save, coins: save.coins };
      applyOutcome(outcome, 'coin', true);
    },
    [save, devMode, devGrants.infiniteCoins, applyOutcome],
  );

  const handleAssignPetRoom = useCallback(
    (petId: string, roomId: RoomThemeId) => {
      if (isDevVirtualPetId(petId)) {
        patchDevVirtualPet(petId, { ballRoom: roomId });
        sound.play('confirm');
        return;
      }
      const allowDevBalls = devMode && devGrants.allPokeballs;
      const outcome = assignPetBallRoom(save, petId, roomId, Date.now(), allowDevBalls);
      applyOutcome(outcome, 'confirm', true);
    },
    [save, devMode, devGrants.allPokeballs, applyOutcome],
  );

  const handlePullGacha = useCallback(
    (boxId: GachaBoxId) => {
      const freeCoins = devMode && devGrants.infiniteCoins;
      const src = freeCoins ? { ...save, coins: Math.max(save.coins, DEV_INFINITE_CURRENCY_DISPLAY) } : save;
      const res = pullGachaBox(src, boxId);
      if (!res.ok) {
        sound.play('error');
        return res;
      }
      sound.play('hatch');
      setSave(freeCoins ? { ...res.save, coins: save.coins } : res.save);
      return res;
    },
    [save, devMode, devGrants.infiniteCoins],
  );

  const handlePullGachaTen = useCallback(
    (boxId: GachaBoxId) => {
      const freeCoins = devMode && devGrants.infiniteCoins;
      const src = freeCoins ? { ...save, coins: Math.max(save.coins, DEV_INFINITE_CURRENCY_DISPLAY) } : save;
      const res = pullGachaTen(src, boxId);
      if (!res.ok) {
        sound.play('error');
        return res;
      }
      sound.play('hatch');
      setSave(freeCoins ? { ...res.save, coins: save.coins } : res.save);
      return res;
    },
    [save, devMode, devGrants.infiniteCoins],
  );

  const handleReleasePet = useCallback(
    (petId: string): boolean => {
      if (isDevVirtualPetId(petId)) {
        sound.play('error');
        showSpeech('调试体验精灵无法放生，关闭调试开关即可一键回退！');
        return false;
      }
      const outcome = releasePet(save, petId);
      return applyOutcome(outcome, 'coin', true);
    },
    [save, applyOutcome, showSpeech],
  );

  const handleDepositPet = useCallback(
    (petId: string): boolean => {
      if (isDevVirtualPetId(petId)) {
        sound.play('error');
        showSpeech('调试体验精灵无需寄存，关闭调试开关即可一键回退！');
        return false;
      }
      if (managerFromBattle) {
        sound.play('error');
        showSpeech('战斗进行中无法寄存，请结束本局后再寄存到大木博士处！');
        return false;
      }
      const outcome = depositPetToStorage(save, petId);
      return applyOutcome(outcome, 'confirm', false);
    },
    [save, managerFromBattle, applyOutcome, showSpeech],
  );

  const handleDepositPetsBatch = useCallback(
    (petIds: string[]) => {
      const realIds = petIds.filter((id) => !isDevVirtualPetId(id));
      if (realIds.length === 0) {
        sound.play('error');
        return { ok: false, count: 0, message: '调试体验精灵无法寄存！' };
      }
      if (managerFromBattle) {
        sound.play('error');
        return { ok: false, count: 0, message: '战斗进行中无法寄存，请结束本局后再寄存！' };
      }
      const outcome = depositPetsBatch(save, realIds);
      const ok = applyOutcome(outcome, 'confirm', true);
      return {
        ok,
        count: outcome.depositedCount ?? 0,
        message: outcome.message ?? '',
      };
    },
    [save, managerFromBattle, applyOutcome],
  );

  const handleWithdrawPet = useCallback(
    (petId: string): boolean => {
      if (managerFromBattle) {
        sound.play('error');
        showSpeech('战斗进行中无法从大木博士寄放箱取出宝可梦！');
        return false;
      }
      const outcome = withdrawPetFromStorage(save, petId);
      return applyOutcome(outcome, 'confirm', false);
    },
    [save, managerFromBattle, applyOutcome, showSpeech],
  );

  const handleWithdrawPetsBatch = useCallback(
    (petIds: string[]) => {
      if (managerFromBattle) {
        sound.play('error');
        return { ok: false, count: 0, message: '战斗进行中无法从寄放箱取出宝可梦！' };
      }
      const outcome = withdrawPetsBatch(save, petIds);
      const ok = applyOutcome(outcome, 'confirm', true);
      return {
        ok,
        count: outcome.withdrawnCount ?? 0,
        message: outcome.message ?? '',
      };
    },
    [save, managerFromBattle, applyOutcome],
  );

  const handleReleaseStoredPet = useCallback(
    (petId: string): boolean => {
      const outcome = releaseStoredPet(save, petId);
      return applyOutcome(outcome, 'coin', false);
    },
    [save, applyOutcome],
  );

  const handleReleaseStoredPetsBatch = useCallback(
    (petIds: string[]) => {
      const outcome = releaseStoredPetsBatch(save, petIds);
      const ok = applyOutcome(outcome, 'coin', true);
      return {
        ok,
        count: outcome.releasedCount ?? 0,
        coins: outcome.coinsEarned ?? 0,
        xp: outcome.xpEarned ?? 0,
        message: outcome.message ?? '',
      };
    },
    [save, applyOutcome],
  );

  const handleReleasePetsBatch = useCallback(
    (petIds: string[]) => {
      const realIds = petIds.filter((id) => !isDevVirtualPetId(id));
      if (realIds.length === 0) {
        sound.play('error');
        return { ok: false, count: 0, coins: 0, xp: 0, message: '调试体验精灵无法放生！' };
      }
      const outcome = releasePetsBatch(save, realIds);
      const ok = applyOutcome(outcome, 'coin', true);
      return {
        ok,
        count: outcome.releasedCount ?? 0,
        coins: outcome.coinsEarned ?? 0,
        xp: outcome.xpEarned ?? 0,
        message: outcome.message ?? '',
      };
    },
    [save, applyOutcome],
  );

  const handleAdopt = useCallback(
    (species: SpeciesId, name: string) => {
      const outcome = adoptPet(save, species, name);
      if (applyOutcome(outcome, 'happy')) {
        setLcdMode('home');
        triggerAnim('happy', 1800);
      }
    },
    [save, applyOutcome, triggerAnim],
  );

  // Ensure bezelIndex never stays focused on a disabled dock action
  useEffect(() => {
    if (!activePet) return;
    const curAction = HOME_SIDE_ACTIONS[bezelIndex];
    if (curAction && isHomeActionDisabled(curAction.id, activePet, save.stamina)) {
      const nextValid = HOME_SIDE_ACTIONS.findIndex(
        (item) => !isHomeActionDisabled(item.id, activePet, save.stamina),
      );
      if (nextValid !== -1 && nextValid !== bezelIndex) {
        setBezelIndex(nextValid);
      }
    }
  }, [activePet, save.stamina, bezelIndex]);

  const handleStartMiniGame = useCallback(
    (game: 'game_catch' | 'game_peekaboo') => {
      const res = spendStaminaForGame(save);
      if (!res.ok) {
        sound.play('error');
        setLcdMode('home');
        showSpeech(res.message);
        return;
      }
      sound.play('confirm');
      setSave(res.save);
      setLcdMode(game);
    },
    [save, showSpeech],
  );

  const handleUpdateSettings = useCallback((patch: AppSettingsPatch) => {
    setSave((prev) => {
      const nextPrefs = patch.prefs
        ? { ...(prev.prefs ?? {}), ...patch.prefs }
        : prev.prefs;
      const nextProfile = patch.trainerProfile
        ? { ...(prev.trainerProfile ?? {}), ...patch.trainerProfile }
        : prev.trainerProfile;
      const next: GameSave = {
        ...prev,
        ...patch,
        prefs: nextPrefs,
        trainerProfile: nextProfile,
      };
      sound.setMasterVolume(nextPrefs?.masterVolume ?? 80);
      sound.setMuteOnBlur(nextPrefs?.muteOnBlur ?? true);
      sound.setSfxVolume(next.sfxVolume);
      sound.setBgm(next.bgmEnabled, next.bgmVolume);
      sound.setAmbient(nextPrefs?.ambientEnabled ?? true, nextPrefs?.ambientVolume ?? 68);
      sound.setMuted(next.muted);
      sound.setCry(next.cryEnabled ?? true, next.cryVolume ?? 80);
      sound.setCombatSfx(next.combatSfxEnabled ?? true);
      return next;
    });
  }, []);

  const handleHomeIconClick = useCallback(
    (action: HomeIconActionId, idx: number) => {
      if (activePet && isHomeActionDisabled(action, activePet, save.stamina)) {
        return;
      }
      setBezelIndex(idx);
      setMenuCursor(0);
      sound.play('cursor');
      switch (action) {
        case 'clean':
          if (activePet && activePet.poopCount > 0) {
            handleCleanPoop();
          } else {
            handleBath();
          }
          break;
        case 'light':
          handleToggleSleep();
          break;
        case 'play':
          if (activePet?.isSleeping) {
            showSpeech(`${activePet.name} 正在睡梦中，先开灯再特训吧～`);
            sound.play('error');
          } else {
            setLcdMode('play_menu');
          }
          break;
        case 'recall':
          handleRecallToOverworld();
          break;
      }
    },
    [
      activePet,
      save.stamina,
      handleCleanPoop,
      handleBath,
      handleToggleSleep,
      handleRecallToOverworld,
      showSpeech,
    ],
  );

  const handleDpad = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (lcdMode === 'game_catch' || lcdMode === 'game_peekaboo') {
        if (dir === 'left' || dir === 'right') {
          setControlSignal((s) => ({ seq: s.seq + 1, dir }));
        }
        return;
      }
      if (lcdMode === 'recalled' || lcdMode === 'survivors' || lcdMode === 'battle') return;

      sound.play('cursor');
      if (lcdMode === 'home') {
        const delta = dir === 'left' || dir === 'up' ? -1 : 1;
        const total = HOME_SIDE_ACTIONS.length;
        setBezelIndex((idx) => {
          for (let step = 1; step <= total; step++) {
            const candidate = (idx + delta * step + total * 2) % total;
            if (
              !activePet ||
              !isHomeActionDisabled(HOME_SIDE_ACTIONS[candidate].id, activePet, save.stamina)
            ) {
              return candidate;
            }
          }
          return idx;
        });
      } else {
        const delta = dir === 'up' || dir === 'left' ? -1 : 1;
        setMenuCursor((c) => Math.max(0, c + delta));
      }
    },
    [lcdMode, activePet, save.stamina],
  );

  const handleButtonA = useCallback(() => {
    if (lcdMode === 'game_catch' || lcdMode === 'game_peekaboo') {
      setControlSignal((s) => ({ seq: s.seq + 1, dir: 'confirm' }));
      return;
    }
    if (lcdMode === 'battle' || lcdMode === 'recalled' || lcdMode === 'survivors') return;
    if (lcdMode === 'home') {
      const target = HOME_SIDE_ACTIONS[bezelIndex];
      if (
        target &&
        (!activePet || !isHomeActionDisabled(target.id, activePet, save.stamina))
      ) {
        handleHomeIconClick(target.id, bezelIndex);
      }
      return;
    }
    if (lcdMode === 'play_menu') {
      const game = menuCursor % 2 === 0 ? 'game_catch' : 'game_peekaboo';
      handleStartMiniGame(game);
      return;
    }
    sound.play('cancel');
    setLcdMode('home');
  }, [lcdMode, bezelIndex, menuCursor, activePet, save.stamina, handleHomeIconClick, handleStartMiniGame]);

  const handleButtonB = useCallback(() => {
    if (lcdMode === 'battle' || lcdMode === 'survivors') return;
    if (lcdMode === 'recalled') {
      handleReleaseBallToRoom();
      return;
    }
    if (lcdMode === 'party_detail') {
      sound.play('cancel');
      setLcdMode(managerFromBattle || managerEntryMode === 'squad' ? 'squad' : 'party');
      return;
    }
    if (lcdMode === 'pokedex_detail') {
      sound.play('cancel');
      setLcdMode('pokedex');
      return;
    }
    if (
      lcdMode === 'squad' ||
      lcdMode === 'party' ||
      lcdMode === 'pokedex' ||
      lcdMode === 'achievements' ||
      lcdMode === 'diary' ||
      lcdMode === 'settings' ||
      lcdMode === 'news' ||
      lcdMode === 'profile' ||
      lcdMode === 'guide' ||
      lcdMode === 'feedback'
    ) {
      if (managerEntryMode === lcdMode) {
        handleClosePokemonManager();
      } else {
        sound.play('cancel');
        setLcdMode('menu');
      }
      return;
    }
    if (lcdMode !== 'home') {
      sound.play('cancel');
      setLcdMode('home');
      setControlSignal((s) => ({ seq: s.seq + 1, dir: null }));
    } else {
      handlePat();
    }
  }, [lcdMode, managerFromBattle, managerEntryMode, handleClosePokemonManager, handlePat, handleReleaseBallToRoom]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || save.pets.length === 0) return;
      // When remapping a key inside Settings, let the Settings listener capture it
      if (document.body.dataset.capturingKey === '1') return;
      // In real-time 3D Open-World mode (when Manager overlay is closed), let Survivors3DArena handle keys directly!
      if (!managerOpen) {
        return;
      }

      const kb = save.keyBindings ?? DEFAULT_KEY_BINDINGS;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClosePokemonManager();
        return;
      }

      // Symmetric Map Hotkey (`M` or `` ` `` / `~`): pressing it again while Handheld Map is open closes the map back to 3D world!
      if (
        lcdMode === 'map' &&
        (e.code === 'KeyM' || e.key.toLowerCase() === 'm' || e.code === 'Backquote' || e.key === '`' || e.key === '~')
      ) {
        e.preventDefault();
        handleClosePokemonManager();
        return;
      }

      if (e.key === 'ArrowLeft' || matchesKey(e, kb.left)) {
        e.preventDefault();
        handleDpad('left');
      } else if (e.key === 'ArrowRight' || matchesKey(e, kb.right)) {
        e.preventDefault();
        handleDpad('right');
      } else if (e.key === 'ArrowUp' || matchesKey(e, kb.up)) {
        e.preventDefault();
        handleDpad('up');
      } else if (e.key === 'ArrowDown' || matchesKey(e, kb.down)) {
        e.preventDefault();
        handleDpad('down');
      } else if (matchesKey(e, kb.confirm) || e.key === ' ') {
        e.preventDefault();
        handleButtonA();
      } else if (matchesKey(e, kb.cancel) || e.key === 'Backspace') {
        e.preventDefault();
        handleButtonB();
      } else if (matchesKey(e, kb.menu)) {
        e.preventDefault();
        sound.play('cursor');
        setLcdMode((m) => (m === 'menu' ? 'home' : 'menu'));
      } else if (matchesKey(e, kb.party)) {
        e.preventDefault();
        sound.play('cursor');
        setLcdMode((m) => (m === 'party' ? 'home' : 'party'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDpad, handleButtonA, handleButtonB, handleClosePokemonManager, lcdMode, managerOpen, save.pets.length, save.keyBindings]);

  // Mobile Hardware Back / Swipe-Back (`popstate`) Integration:
  // Keeps a lightweight history guard whenever Handheld Console or an in-game overlay/sub-page is open,
  // so swiping back on phones steps back inside the console or closes it instead of exiting the web app!
  const hasAnyBackLayer = managerOpen || arenaHasBackLayer;

  useEffect(() => {
    if (hasAnyBackLayer && !backGuardPushedRef.current) {
      try {
        window.history.pushState({ ppBackGuard: true }, '');
        backGuardPushedRef.current = true;
      } catch {
        // ignore in restricted environments
      }
    } else if (!hasAnyBackLayer && backGuardPushedRef.current) {
      backGuardPushedRef.current = false;
      ignoreNextPopRef.current = true;
      try {
        window.history.back();
      } catch {
        ignoreNextPopRef.current = false;
      }
    }
  }, [hasAnyBackLayer]);

  useEffect(() => {
    const onPopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      backGuardPushedRef.current = false;

      if (managerOpen) {
        // Determine whether we are inside a nested LCD sub-page that should step back one level
        const isNestedSubpage =
          lcdMode === 'party_detail' ||
          lcdMode === 'pokedex_detail' ||
          lcdMode === 'play_menu' ||
          lcdMode === 'game_catch' ||
          lcdMode === 'game_peekaboo' ||
          (managerEntryMode === 'menu' &&
            (lcdMode === 'party' ||
              lcdMode === 'pokedex' ||
              lcdMode === 'achievements' ||
              lcdMode === 'diary' ||
              lcdMode === 'settings'));

        if (isNestedSubpage) {
          handleButtonB();
          try {
            window.history.pushState({ ppBackGuard: true }, '');
            backGuardPushedRef.current = true;
          } catch {
            // ignore
          }
          return;
        }

        // At root of Handheld Console -> close the console cleanly!
        handleClosePokemonManager();
        if (arenaHasBackLayer) {
          try {
            window.history.pushState({ ppBackGuard: true }, '');
            backGuardPushedRef.current = true;
          } catch {
            // ignore
          }
        }
        return;
      }

      if (arenaHasBackLayer && arenaBackHandlerRef.current) {
        const stillHasLayer = arenaBackHandlerRef.current();
        if (stillHasLayer) {
          try {
            window.history.pushState({ ppBackGuard: true }, '');
            backGuardPushedRef.current = true;
          } catch {
            // ignore
          }
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    managerOpen,
    lcdMode,
    managerEntryMode,
    arenaHasBackLayer,
    handleButtonB,
    handleClosePokemonManager,
  ]);

  const handleResetSave = () => {
    const fresh = createInitialSave();
    setSave(fresh);
    setLcdMode('home');
  };

  const needsAdoption = save.pets.length === 0 || !realActivePet;

  return (
    <div className={`app-shell ${!managerOpen || !effectiveSave.showShell ? 'is-fullscreen' : ''}`}>
      {/* FULL-VIEWPORT 3D PIXEL-ART POKEMON SURVIVORS WORLD (Stays mounted while Handheld Console is pulled out!) */}
      {activePet && (
        <div className={`world3d-root-layer ${managerOpen && !managerClosing ? 'is-behind-manager' : ''}`}>
          <Survivors3DArena
            save={effectiveSave}
            pet={activePet}
            analogVecRef={analogVecRef}
            externalPaused={managerOpen && !managerClosing}
            onFinish={handleFinishSurvivors}
            onHealParty={handleHealParty}
            onSpendCoinsInRun={handleSpendCoinsInRun}
            onCaptureBoss={handleCaptureBoss}
            onShowCaptureInHandheld={(info, onClosed) => {
              setCaptureReveal(info);
              captureAfterCloseRef.current = onClosed ?? null;
              handleOpenPokemonManager('capture_result', true);
            }}
            onSyncWorldMapData={setWorldMapData}
            onOpenPokemonManager={handleOpenPokemonManager}
            onSyncTacticsBridge={setTacticsBridge}
            onUpdateProfile={(profilePatch) =>
              handleUpdateSettings({ trainerProfile: profilePatch })
            }
            onUpdatePrefs={(prefsPatch) => handleUpdateSettings({ prefs: prefsPatch })}
            onUpdateMeta={handleUpdateMeta}
            onBuyFood={handleBuyFood}
            onBuyAccessory={handleBuyAccessory}
            onBuyPokeball={handleBuyPokeball}
            onPullGacha={handlePullGacha}
            onPullGachaTen={handlePullGachaTen}
            onUpdatePetConfig={handleUpdatePetConfig}
            onBackLayerActiveChange={setArenaHasBackLayer}
            onRegisterBackHandler={(fn) => {
              arenaBackHandlerRef.current = fn;
            }}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleHubToggleFullscreen}
            onToggleBgm={() => {
              sound.unlock();
              const nextEnabled = !save.bgmEnabled || save.muted || save.bgmVolume <= 0;
              handleUpdateSettings({
                bgmEnabled: nextEnabled,
                muted: nextEnabled ? false : save.muted,
                bgmVolume: nextEnabled && save.bgmVolume <= 0 ? 48 : save.bgmVolume,
              });
              sound.play(nextEnabled ? 'confirm' : 'cancel');
            }}
          />
        </div>
      )}

      {/* NATIVE HANDHELD CONSOLE POPUP OVERLAY (Bidirectional Pull-Up & Tuck-Down Animations!) */}
      {activePet && managerOpen && (
        <div
          className={`manager-overlay-wrap ${!save.showShell ? 'is-fullscreen-mode' : ''} ${managerClosing ? 'is-closing' : ''}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClosePokemonManager();
            }
          }}
        >
          <main
            className={`solo-console-stage ${!save.showShell ? 'is-fullscreen' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleClosePokemonManager();
              }
            }}
          >
            <HandheldConsole
              save={effectiveSave}
              pet={activePet}
              mode={lcdMode === 'survivors' || lcdMode === 'recalled' ? 'home' : lcdMode}
              battleIsTrainer={battleIsTrainer}
              actionAnim={actionAnim}
              patSeq={patSeq}
              activeFood={activeFood}
              speech={speech}
              effects={effects}
              bezelIndex={bezelIndex}
              menuCursor={menuCursor}
              controlSignal={controlSignal}
              analogVecRef={analogVecRef}
              tacticsBridge={tacticsBridge}
              onCloseHandheldTo3D={() => {
                handleClosePokemonManager();
                const cb = captureAfterCloseRef.current;
                captureAfterCloseRef.current = null;
                if (cb) cb();
              }}
              openedFromBattle={managerFromBattle}
              openedEntryMode={managerEntryMode}
              focusedDetailPetId={focusedDetailPetId}
              captureReveal={captureReveal}
              worldMapData={worldMapData}
              isFullscreen={isFullscreen}
              onToggleFullscreen={handleHubToggleFullscreen}
              onNavigateMode={(next) => {
                sound.play('cursor');
                setLcdMode(next);
              }}
              onHomeIconClick={handleHomeIconClick}
              onDpad={handleDpad}
              onButtonA={handleButtonA}
              onButtonB={handleButtonB}
              onSelectButton={() => {
                sound.play('cursor');
                setLcdMode((m) => (m === 'party' ? 'home' : 'party'));
              }}
              onStartButton={() => {
                sound.play('cursor');
                setLcdMode((m) => (m === 'menu' ? 'home' : 'menu'));
              }}
              onPatPet={handlePat}
              onCleanPoop={handleCleanPoop}
              onHealPet={handleHeal}
              onHealParty={handleHealParty}
              onFeedSquad={handleFeedSquad}
              onQuickCarePet={handleQuickCarePet}
              onDevGrantItems99={handleDevGrantItems99}
              onDevGrantPokeballs99={handleDevGrantPokeballs99}
              onDevGrantStardust99999={handleDevGrantStardust99999}
              onDevGrantCoins99999={handleDevGrantCoins99999}
              onReleaseBallToRoom={handleReleaseBallToRoom}
              onStartBattle={handleStartBattle}
              onFinishBattle={handleFinishBattle}
              onFinishSurvivors={handleFinishSurvivors}
              onSpendCoinsInRun={handleSpendCoinsInRun}
              onCaptureBoss={handleCaptureBoss}
              onSelectFood={handleFeed}
              onBuyFood={handleBuyFood}
              onStartGame={handleStartMiniGame}
              onFinishGame={handleFinishGame}
              onBuyAccessory={handleBuyAccessory}
              onEquipAccessory={handleEquipAccessory}
              onBuyPokeball={handleBuyPokeball}
              onAssignPetRoom={handleAssignPetRoom}
              onPullGacha={handlePullGacha}
              onPullGachaTen={handlePullGachaTen}
              onReleasePet={handleReleasePet}
              onReleasePetsBatch={handleReleasePetsBatch}
              onReleaseStoredPet={handleReleaseStoredPet}
              onReleaseStoredPetsBatch={handleReleaseStoredPetsBatch}
              onDepositPet={handleDepositPet}
              onDepositPetsBatch={handleDepositPetsBatch}
              onWithdrawPet={handleWithdrawPet}
              onWithdrawPetsBatch={handleWithdrawPetsBatch}
              onUpdateSettings={handleUpdateSettings}
              onUpdateMeta={handleUpdateMeta}
              onUpdatePetConfig={handleUpdatePetConfig}
              onSwitchPet={(petId) => {
                sound.play('cursor');
                const target = effectiveSave.pets.find((p) => p.id === petId);
                if (target) {
                  sound.playCry(getPokemonCryId(target.species, target.level));
                }
                if (isDevVirtualPetId(petId)) {
                  setDevActiveVirtualPetId(petId);
                } else {
                  setDevActiveVirtualPetId(null);
                  setSave((prev) => switchPet(prev, petId));
                }
                if (lcdMode !== 'squad' && lcdMode !== 'party_detail') {
                  setLcdMode('home');
                }
                showSpeech(target ? `已将「${target.name}」设为当前领队伙伴！` : '切换了当前领队伙伴！');
              }}
              onResetSave={handleResetSave}
              onExitMode={() => {
                sound.play('cancel');
                setLcdMode('home');
              }}
            />
          </main>
        </div>
      )}

      {needsAdoption && <AdoptionModal isFirstPet onAdopt={handleAdopt} />}

      <LandscapeFullscreenCover
        visible={
          manualFullscreenGuide ||
          (isMobileLandscape && !isFullscreen && !isStandalone && !dismissedLandscapeCover)
        }
        isManualGuide={manualFullscreenGuide}
        supportsFullscreen={supportsFullscreen}
        onEnterFullscreen={async () => {
          const res = await enterFullscreen();
          if (res.ok) {
            setManualFullscreenGuide(false);
            setDismissedLandscapeCover(false);
          }
          return res;
        }}
        onDismiss={() => {
          setManualFullscreenGuide(false);
          if (isMobileLandscape) {
            setDismissedLandscapeCover(true);
          }
        }}
      />
    </div>
  );
}

export default App;
