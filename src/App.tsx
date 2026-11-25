import { useCallback, useEffect, useRef, useState } from 'react';
import { AdoptionModal } from './components/AdoptionModal';
import { HandheldConsole, type AppSettingsPatch } from './components/HandheldConsole';
import {
  HOME_SIDE_ACTIONS,
  isHomeActionDisabled,
  type HomeIconActionId,
} from './components/LcdScreen';
import { Survivors3DArena } from './components/Survivors3DArena';
import { ACHIEVEMENTS, SPECIES_CATALOG, getPokemonCryId } from './data/catalog';
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
  equipAccessory,
  feedPet,
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
  recordSurvivorsOutcome,
  releasePet,
  releasePetsBatch,
  spendStaminaForBattle,
  spendStaminaForGame,
  switchPet,
  tickPet,
  tickStamina,
  toggleSleep,
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
  const [tacticsBridge, setTacticsBridge] = useState<LiveRunTacticsBridge | null>(null);
  const [battleIsTrainer, setBattleIsTrainer] = useState(false);
  const [bezelIndex, setBezelIndex] = useState(0);
  const [menuCursor, setMenuCursor] = useState(0);

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

  const activePet = getActivePet(save);

  useEffect(() => {
    sound.setMasterVolume(save.prefs?.masterVolume ?? 80);
    sound.setMuteOnBlur(save.prefs?.muteOnBlur ?? true);
    sound.setSfxVolume(save.sfxVolume);
    sound.setBgm(save.bgmEnabled, save.bgmVolume);
    sound.setMuted(save.muted);
    sound.setCry(save.cryEnabled ?? true, save.cryVolume ?? 80);
    sound.setCombatSfx(save.combatSfxEnabled ?? true);
    persistSave(save);
  }, [save]);

  // Dynamic 8-bit BGM switching by active scene!
  useEffect(() => {
    if (managerOpen) {
      sound.setTrack('town');
    } else if (lcdMode === 'battle') {
      sound.setTrack('battle');
    } else if (lcdMode === 'recalled' || lcdMode === 'survivors') {
      sound.setTrack('adventure');
    } else {
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
    if (applyOutcome(outcome, 'happy')) {
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
      const outcome = feedPet(save, activePet.id, foodId);
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
    [activePet, save, applyOutcome, triggerAnim, spawnEffect],
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
      setSave((prev) => {
        const curMeta = ensureFreshMetaProgress(prev.meta);
        const nextMeta = updater(curMeta);
        return {
          ...prev,
          coins: Math.max(0, prev.coins + coinDelta),
          meta: nextMeta,
        };
      });
    },
    [],
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
      let ok = false;
      setSave((prev) => {
        const cost = (patch.enhanceCost ?? 0) + (patch.skinCost ?? 0);
        if (cost > 0 && prev.coins < cost) return prev;
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
          coins: Math.max(0, prev.coins - cost),
          pets: nextPets,
          meta: patch.enhanceDelta ? incrementBounties(metaUpdated, { gacha_or_care: 1 }) : metaUpdated,
        };
      });
      if (ok) sound.play(patch.enhanceDelta || patch.unlockSkin ? 'levelup' : 'confirm');
      else sound.play('error');
      return ok;
    },
    [],
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
      if (save.coins < cost) return false;
      setSave((prev) => ({
        ...prev,
        coins: Math.max(0, prev.coins - cost),
      }));
      return true;
    },
    [save.coins],
  );

  const handleCaptureBoss = useCallback(
    (species: SpeciesId, level: number) => {
      setSave((prev) => captureBossPet(prev, species, level).save);
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
      const outcome = buyFood(save, foodId, 1);
      applyOutcome(outcome, 'coin', true);
    },
    [save, applyOutcome],
  );

  const handleBuyAccessory = useCallback(
    (accId: AccessoryId) => {
      const outcome = buyAccessory(save, accId);
      applyOutcome(outcome, 'coin', true);
    },
    [save, applyOutcome],
  );

  const handleEquipAccessory = useCallback(
    (petId: string, accId: AccessoryId) => {
      const outcome = equipAccessory(save, petId, accId);
      applyOutcome(outcome, 'confirm', true);
    },
    [save, applyOutcome],
  );

  const handleBuyPokeball = useCallback(
    (roomId: RoomThemeId) => {
      const outcome = buyPokeball(save, roomId);
      applyOutcome(outcome, 'coin', true);
    },
    [save, applyOutcome],
  );

  const handleAssignPetRoom = useCallback(
    (petId: string, roomId: RoomThemeId) => {
      const outcome = assignPetBallRoom(save, petId, roomId);
      applyOutcome(outcome, 'confirm', true);
    },
    [save, applyOutcome],
  );

  const handlePullGacha = useCallback(
    (boxId: GachaBoxId) => {
      const res = pullGachaBox(save, boxId);
      if (!res.ok) {
        sound.play('error');
        return res;
      }
      sound.play('hatch');
      setSave(res.save);
      return res;
    },
    [save],
  );

  const handlePullGachaTen = useCallback(
    (boxId: GachaBoxId) => {
      const res = pullGachaTen(save, boxId);
      if (!res.ok) {
        sound.play('error');
        return res;
      }
      sound.play('hatch');
      setSave(res.save);
      return res;
    },
    [save],
  );

  const handleReleasePet = useCallback(
    (petId: string): boolean => {
      const outcome = releasePet(save, petId);
      return applyOutcome(outcome, 'coin', true);
    },
    [save, applyOutcome],
  );

  const handleReleasePetsBatch = useCallback(
    (petIds: string[]) => {
      const outcome = releasePetsBatch(save, petIds);
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
      setLcdMode(managerOpenedFromBattle || managerEntryMode === 'squad' ? 'squad' : 'party');
      return;
    }
    if (lcdMode === 'squad' && managerOpenedFromBattle) {
      handleClosePokemonManager();
      return;
    }
    if (lcdMode === 'pokedex_detail') {
      sound.play('cancel');
      setLcdMode('pokedex');
      return;
    }
    if (
      lcdMode === 'party' ||
      lcdMode === 'pokedex' ||
      lcdMode === 'achievements' ||
      lcdMode === 'diary' ||
      lcdMode === 'settings'
    ) {
      sound.play('cancel');
      setLcdMode('menu');
      return;
    }
    if (lcdMode !== 'home') {
      sound.play('cancel');
      setLcdMode('home');
      setControlSignal((s) => ({ seq: s.seq + 1, dir: null }));
    } else {
      handlePat();
    }
  }, [lcdMode, managerOpenedFromBattle, managerEntryMode, handleClosePokemonManager, handlePat, handleReleaseBallToRoom]);

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

  const handleResetSave = () => {
    const fresh = createInitialSave();
    setSave(fresh);
    setLcdMode('home');
  };

  const needsAdoption = save.pets.length === 0 || !activePet;

  return (
    <div className={`app-shell ${!managerOpen || !save.showShell ? 'is-fullscreen' : ''}`}>
      {/* FULL-VIEWPORT 3D PIXEL-ART POKEMON SURVIVORS WORLD (Stays mounted while Handheld Console is pulled out!) */}
      {activePet && (
        <div className={`world3d-root-layer ${managerOpen && !managerClosing ? 'is-behind-manager' : ''}`}>
          <Survivors3DArena
            save={save}
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
          />
        </div>
      )}

      {/* NATIVE HANDHELD CONSOLE POPUP OVERLAY (Bidirectional Pull-Up & Tuck-Down Animations!) */}
      {activePet && managerOpen && (
        <div
          className={`manager-overlay-wrap ${managerClosing ? 'is-closing' : ''}`}
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
              save={save}
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
              onUpdateSettings={handleUpdateSettings}
              onUpdateMeta={handleUpdateMeta}
              onUpdatePetConfig={handleUpdatePetConfig}
              onSwitchPet={(petId) => {
                sound.play('cursor');
                const target = save.pets.find((p) => p.id === petId);
                if (target) {
                  sound.playCry(getPokemonCryId(target.species, target.level));
                }
                setSave((prev) => switchPet(prev, petId));
                setLcdMode('home');
                showSpeech(target ? `打开了「${target.name}」的精灵球！` : '切换了当前精灵球！');
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
    </div>
  );
}

export default App;
