import { stepArenaCombatSimulation3D } from './arena3d/arenaCombatTick3D';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { computeBattleStats } from '../data/battleMoves';
import { ROOM_CATALOG, SPECIES_CATALOG, getGrowthStage, getPokemonCryId, getPokemonWorldScale3D } from '../data/catalog';
import { DEFAULT_TACTICAL_CONFIG, DIFFICULTIES, MAP_REGIONS, SURVIVOR_SKILLS, WATER_LEVEL_3D, WORLD_SECTOR_SIZE, WORLD_TOWNS_3D, clearTerrainHeightCache3D, getDefaultSkillsForElement, getRawNaturalTerrainHeight3D, getTerrainHeight3D, getUnlockedSkillSlotCount, getUrbanRegions3D, getWalkableSurfaceHeight3D, isNearAnyRoadOrRailForFlora3D, registerActiveTownRoadLayouts3D, setWalkableBuildingFloorZones3D, type DifficultyId, type SafeZone3D, type SurvivorSkillId, type SurvivorsGameMode, type TacticalConfig } from '../data/survivorsTactics';
import { BIOME_PALETTES, createHorizonBackdropMesh, createPixelWaterMaterial, createSculptedTerrainMaterial, getAnimatedGifTextures, getBiomeTextures, getHeroSpriteFrames, syncTerrainGeoUniforms3D, syncUrbanTerrainUniforms3D, type AnimatedSpriteSheet3D, type BiomeId } from '../data/worldTextures3D';
import { computeInstantKickoffWaypoints3D, createAutoWalkPathJob3D, findForwardSpliceIndex3D, type AutoNavBuildingPortalInfo, type AutoNavWaypoint, type IncrementalAutoPathJob3D } from '../utils/autoPathfinder3D';
import { CAM_MODE_LIST, CAM_MODE_SPECS, createCameraRigSmoothState, updatePhysicalCameraRig3D } from '../utils/cameraRig3D';
import { advanceGroundJump, cameraRelativeMovement, GAME_JUMP_VELOCITY } from '../utils/cameraRigShared3D';
import { computeSolarDayNight, type SolarDayNightState } from '../utils/solarDayNight3D';
import { extractDexIdFromSpriteUrl, getPmd8DirSheet, type Pmd8DirSheet3D } from '../data/pmdSprites3D';
import { GEO_UNITS_PER_KM, geoToWorld, getActiveGeoTerrainOrigin, getProjectedGeoCities, hasLocalDemCoverage, prefetchGeoDetailAround, setActiveGeoTerrainOrigin, subscribeGeoDemLoaded, worldToGeo, worldYToRealMeters3D } from '../data/geoTerrain3D';
import { getCompiledInterCityNetwork } from '../utils/interCityHighwayGraph';
import { clearWorldCheckpoint, loadWorldCheckpoint, saveWorldCheckpoint, setActiveCareSessionFlag, wasActiveCareSessionOpen } from '../utils/worldCheckpoint';
import { createInterCityHighwayStreamer3D } from '../world3d/interCityHighway3D';
import { createWeatherVisuals3D } from '../world3d/weatherVisuals3D';
import { DEFAULT_WORLD_TOUR_STATE, WORLD_CITIES, getDefaultHomeByLanguage, type WorldCityDef } from '../data/worldTour';
import { type WorldLaunchPayload } from './WorldMapOverlay';
import { DEFAULT_GAME_PREFS, DEFAULT_TRAINER_PROFILE, type CameraFollowMode, type GamePrefs, type PetRecord, type PetSkinId, type RoomThemeId, type SpeciesId, type TrainerProfile } from '../types/pet';
import { getDevGrants, isDevModeEnabled, isDevVirtualPetId } from '../utils/devMode';
import { HERO_ROSTER, LAB_UPGRADES, computeMetaCombatBonuses, countClaimableBounties, ensureFreshMetaProgress, getHeroDef, getLabUpgradeCost, getSkinDef, rerollBountySlot, type HeroId, type LabUpgradeId, type MetaProgressState } from '../data/metaProgression';
import { type AppLang } from '../data/i18n';
import { DEFAULT_ANNOUNCEMENTS } from './MetaOverlays';
import { PokeballShutterOverlay, dismissInitialBootPokeballCurtain, setBootCurtainProgress, type PokeballShutterState } from './PokeballShutterOverlay';
import { type LiveMapSnapshot, type ScenicMountainSpot } from './WorldMapHud';
import type { SurvivorsResultPayload } from '../utils/petEngine';
import { sound, type BgmPlayerState, type BgmTrackId } from '../utils/sound';
import { clearTownLayoutCache, hashCitySeed } from '../utils/townStreetGen';
import { buildInterTownRoadNetwork3D, buildProceduralTown3D, resolveTownWallCollisions, setGlobalNightLampGlow3D, type ProceduralTownInstance } from '../utils/townBuilder3D';
import { createRenderedTerrainSampler, setRenderedTerrainSampler } from '../world3d/renderedTerrain3D';
import { setRoadTerrainGrid } from '../world3d/roadKitSurface';
import { createWeatherFloraMaterial3D, syncGlobalFloraWeather3D } from '../world3d/weatherFloraMaterial3D';
import { buildFallbackWeather, buildWeatherInfo, fetchLiveWeatherAt, getWeatherAtmosphereProfile, resolveGeoSeason, type GeoSeasonInfo, type LiveWeatherInfo, type WeatherIntensity, type WeatherKind } from '../utils/weatherSystem';
import { BILLBOARD_PITCH_TILT, MAX_CAM_PITCH, MAX_FOLLOWERS, SHARED_ENTITY_SHADOW_MAT, UNIT_SHADOW_GEO, UPRIGHT_QUAD_GEO, createSafeZone3DMesh, type ActiveCapture3D, type ActiveFollower, type ArenaScreenPhase, type Enemy3D, type FloatingTag2D, type FollowerReportRow, type LevelChoice, type Loot3D, type MonsterQuality, type Projectile3D, type RunResultSummary, type Survivors3DArenaProps, type Vfx3D } from './arena3d/arenaTypesAndProps';
import { setupHubWildlifeDiorama3D } from './arena3d/arenaWildlifeDiorama3D';
import { createArenaCombatActions3D } from './arena3d/arenaCombatActions3D';
import { ArenaHubAndMapOverlay } from './arena3d/ArenaHubAndMapOverlay';
import { ArenaPlayingHudOverlay } from './arena3d/ArenaPlayingHudOverlay';
import { ArenaRunModalsOverlay } from './arena3d/ArenaRunModalsOverlay';
import {
  type ActiveBusStopModalState,
  type LiveWorldBubble,
  type NearbyActionMenuState,
  type ProjectedBubble2D,
} from './arena3d/ArenaTownSocialAndBusOverlay';
import { useArenaKeyboardHotkeys } from './arena3d/useArenaHotkeys';
import { createArenaFloraStreamer3D } from './arena3d/arenaFloraStreamer3D';
import { renderHubDioramaFrame3D } from './arena3d/arenaHubIdleLoop3D';
import { stepArenaTownAndWorldNodes3D } from './arena3d/arenaTownAndWorldStep3D';
import { stepArenaCaptureCinema3D, stepArenaHudProjection3D } from './arena3d/arenaHudAndCinemaStep3D';
export const Survivors3DArena: React.FC<Survivors3DArenaProps> = ({
  save,
  pet,
  analogVecRef,
  externalPaused = false,
  onFinish,
  onHealParty,
  onSpendCoinsInRun,
  onCaptureBoss,
  onShowCaptureInHandheld,
  onSyncWorldMapData,
  onOpenPokemonManager,
  onSyncTacticsBridge,
  onUpdateProfile,
  onUpdatePrefs,
  onUpdateMeta,
  onBuyFood,
  onBuyAccessory,
  onBuyPokeball,
  onPullGacha,
  onPullGachaTen,
  onUpdatePetConfig,
  onBackLayerActiveChange,
  onRegisterBackHandler,
  isFullscreen = false,
  onToggleFullscreen,
  onToggleBgm,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const meta = ensureFreshMetaProgress(save.meta);
  const metaRef = useRef<MetaProgressState>(meta);
  metaRef.current = meta;
  const realPetsCount = save.pets.filter((p) => !isDevVirtualPetId(p.id)).length;
  const savePetsCountRef = useRef(realPetsCount);
  savePetsCountRef.current = realPetsCount;
  const [selectedBallId, setSelectedBallId] = useState<RoomThemeId>('pokeball_room');
  const selectedBallIdRef = useRef<RoomThemeId>('pokeball_room');
  selectedBallIdRef.current = selectedBallId;
  useEffect(() => {
    if (selectedBallId === 'pokeball_room') return;
    const stillHeld =
      save.unlockedRooms.includes(selectedBallId) || (save.ballStock?.[selectedBallId] ?? 0) > 0;
    if (!stillHeld) {
      setSelectedBallId('pokeball_room');
    }
  }, [selectedBallId, save.unlockedRooms, save.ballStock]);
  const dockRowRef = useRef<HTMLDivElement | null>(null);
  const [visibleDockCount, setVisibleDockCount] = useState(8);
  const metaBonuses = computeMetaCombatBonuses(meta);
  const metaBonusesRef = useRef(metaBonuses);
  metaBonusesRef.current = metaBonuses;
  const maxFollowers = MAX_FOLLOWERS + metaBonuses.extraSquadSlots;
  const maxFollowersRef = useRef(maxFollowers);
  maxFollowersRef.current = maxFollowers;
  const activeHeroDef = getHeroDef(meta.activeHero);
  const claimableBountyCount = countClaimableBounties(meta);

  const lang: AppLang = (save.prefs?.language ?? 'zh') as AppLang;
  const cycleLanguage = () => {
    const order: AppLang[] = ['zh', 'en', 'ja'];
    const next = order[(order.indexOf(lang) + 1) % order.length];
    sound.play('cursor');
    onUpdatePrefs?.({ language: next });
  };

  // Hub Meta Overlays (Shop, Lab, Bounties, News, Guide, Feedback) with Bidirectional Close Animations!
  const [hubModal, setHubModal] = useState<'none' | 'shop' | 'lab' | 'bounties' | 'news' | 'guide' | 'feedback' | 'more'>('none');
  const hubModalRef = useRef(hubModal);
  hubModalRef.current = hubModal;
  const [labInitialTab, setLabInitialTab] = useState<'universal' | 'heroes' | 'badges'>('universal');
  const openHeroOrBadgeOverlay = (targetTab: 'heroes' | 'badges' | 'universal') => {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    }
    sound.play('confirm');
    setLabInitialTab(targetTab);
    setHubModal('lab');
  };

  useEffect(() => {
    const onOpenLabEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: 'heroes' | 'badges' | 'universal' }>).detail;
      const targetTab = detail?.tab ?? 'universal';
      setLabInitialTab(targetTab);
      setHubModal('lab');
    };
    window.addEventListener('poke-pocket:open-lab', onOpenLabEvt);
    return () => window.removeEventListener('poke-pocket:open-lab', onOpenLabEvt);
  }, []);
  const [inRunTownShopOpen, setInRunTownShopOpen] = useState(false);
  const inRunTownShopOpenRef = useRef(false);
  inRunTownShopOpenRef.current = inRunTownShopOpen;
  const [liveWeather, setLiveWeather] = useState<LiveWeatherInfo>(() =>
    buildFallbackWeather(31.23, 121.47, '上海'),
  );
  const liveWeatherRef = useRef<LiveWeatherInfo>(liveWeather);
  liveWeatherRef.current = liveWeather;
  const [mobilePartyOpen, setMobilePartyOpen] = useState(false);
  const [closingHubModal, setClosingHubModal] = useState(false);
  const [newsTickerIdx, setNewsTickerIdx] = useState(0);
  const closeHubModal = () => {
    if (hubModal === 'none' || closingHubModal) return;
    sound.play('cancel');
    setClosingHubModal(true);
    window.setTimeout(() => {
      setClosingHubModal(false);
      setHubModal('none');
    }, 175);
  };

  const handleBuyLabUpgrade = (id: LabUpgradeId) => {
    const def = LAB_UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const curLv = meta.labLevels[id] ?? 0;
    if (curLv >= def.maxLevel) return;
    const cost = getLabUpgradeCost(def, curLv);
    const freeStardust = isDevModeEnabled() && getDevGrants().infiniteStardust;
    if (!freeStardust && meta.stardust < cost) {
      sound.play('error');
      return;
    }
    sound.play('levelup');
    onUpdateMeta?.((prev) => ({
      ...prev,
      stardust: freeStardust ? prev.stardust : Math.max(0, prev.stardust - cost),
      labLevels: { ...prev.labLevels, [id]: curLv + 1 },
    }));
  };

  const handleUnlockOrSelectHero = (heroId: HeroId) => {
    const def = HERO_ROSTER.find((h) => h.id === heroId);
    if (!def) return;
    if (meta.unlockedHeroes.includes(heroId)) {
      sound.play('confirm');
      onUpdateMeta?.((prev) => ({ ...prev, activeHero: heroId }));
      return;
    }
    const freeStardust = isDevModeEnabled() && getDevGrants().infiniteStardust;
    if (!freeStardust && meta.stardust < def.unlockCost) {
      sound.play('error');
      return;
    }
    sound.play('hatch');
    onUpdateMeta?.((prev) => ({
      ...prev,
      stardust: freeStardust ? prev.stardust : Math.max(0, prev.stardust - def.unlockCost),
      unlockedHeroes: [...prev.unlockedHeroes, heroId],
      activeHero: heroId,
    }));
  };

  const handleUpgradeHeroSkill = (heroId: HeroId, skillId: string) => {
    const def = HERO_ROSTER.find((h) => h.id === heroId);
    const sk = def?.skills.find((s) => s.id === skillId);
    if (!def || !sk || !meta.unlockedHeroes.includes(heroId)) return;
    const curLv = meta.heroSkillLevels[skillId] ?? 0;
    if (curLv >= sk.maxLevel) return;
    const cost = sk.baseCost + curLv * sk.costStep;
    const freeStardust = isDevModeEnabled() && getDevGrants().infiniteStardust;
    if (!freeStardust && meta.stardust < cost) {
      sound.play('error');
      return;
    }
    sound.play(curLv + 1 >= sk.maxLevel ? 'hatch' : 'levelup');
    onUpdateMeta?.((prev) => ({
      ...prev,
      stardust: freeStardust ? prev.stardust : Math.max(0, prev.stardust - cost),
      heroSkillLevels: { ...prev.heroSkillLevels, [skillId]: curLv + 1 },
    }));
  };

  const handleClaimBounty = (kind: 'daily' | 'weekly', slotIdx: number) => {
    const list = kind === 'daily' ? meta.dailyBounties : meta.weeklyBounties;
    const b = list[slotIdx];
    if (!b || b.claimed || b.progress < b.target) return;
    sound.play('coin');
    onUpdateMeta?.((prev) => {
      const nextList = (kind === 'daily' ? prev.dailyBounties : prev.weeklyBounties).map((it, idx) =>
        idx === slotIdx ? { ...it, claimed: true } : it,
      );
      return kind === 'daily'
        ? { ...prev, stardust: prev.stardust + b.rewardStardust, dailyBounties: nextList }
        : { ...prev, stardust: prev.stardust + b.rewardStardust, weeklyBounties: nextList };
    });
  };

  const handleRerollBounty = (kind: 'daily' | 'weekly', slotIdx: number) => {
    sound.play('cursor');
    onUpdateMeta?.((prev) => rerollBountySlot(prev, kind, slotIdx));
  };

  const handleClaimBonusChest = (kind: 'daily' | 'weekly') => {
    sound.play('hatch');
    if (kind === 'daily') {
      onUpdateMeta?.(
        (prev) => ({
          ...prev,
          stardust: prev.stardust + 80,
          dailyStreak: prev.dailyStreak + 1,
          dailyBonusClaimed: true,
        }),
        120,
      );
    } else {
      onUpdateMeta?.(
        (prev) => ({
          ...prev,
          stardust: prev.stardust + 450,
          weeklyBonusClaimed: true,
        }),
        500,
      );
    }
  };

  // Saved Battle Squad Presets (3 Saveable Teams — Replaces single "Starter" concept!)
  const defaultTeamIds = save.pets.filter((p) => !p.isSleeping).slice(0, 6).map((p) => p.id);
  const squadPresets =
    meta.squadPresets && meta.squadPresets.length >= 3
      ? meta.squadPresets
      : [
          { id: 'sq_1', name: '队伍 1', petIds: defaultTeamIds },
          { id: 'sq_2', name: '队伍 2', petIds: defaultTeamIds.slice(0, 3) },
          { id: 'sq_3', name: '队伍 3', petIds: defaultTeamIds.slice(0, 3) },
        ];
  const activeSquadIdx = Math.min(squadPresets.length - 1, Math.max(0, meta.activeSquadIdx ?? 0));
  const activeSquadPreset = squadPresets[activeSquadIdx] ?? squadPresets[0];
  const activeSquadPets = activeSquadPreset.petIds
    .map((id) => save.pets.find((p) => p.id === id))
    .filter((p): p is PetRecord => p !== undefined && !p.isSleeping);
  const effectiveSquadPets =
    activeSquadPets.length > 0
      ? activeSquadPets
      : save.pets.filter((p) => !p.isSleeping).slice(0, 6);
  const [squadEditorOpen, setSquadEditorOpen] = useState(false);
  const [closingSquadEditor, setClosingSquadEditor] = useState(false);
  const closeSquadEditor = () => {
    if (!squadEditorOpen || closingSquadEditor) return;
    sound.play('cancel');
    setClosingSquadEditor(true);
    window.setTimeout(() => {
      setClosingSquadEditor(false);
      setSquadEditorOpen(false);
    }, 165);
  };
  const selectSquadPreset = (idx: number) => {
    sound.play('cursor');
    onUpdateMeta?.((prev) => ({
      ...prev,
      squadPresets,
      activeSquadIdx: idx,
    }));
  };
  const togglePetInActiveSquad = (petId: string) => {
    const curIds = activeSquadPreset.petIds.filter((id) => save.pets.some((p) => p.id === id));
    const exists = curIds.includes(petId);
    if (exists && curIds.length <= 1) {
      sound.play('error');
      return;
    }
    if (!exists && curIds.length >= maxFollowers) {
      sound.play('error');
      return;
    }
    sound.play('confirm');
    const nextIds = exists ? curIds.filter((id) => id !== petId) : [...curIds, petId];
    const nextPresets = squadPresets.map((sq, i) =>
      i === activeSquadIdx ? { ...sq, petIds: nextIds } : sq,
    );
    onUpdateMeta?.((prev) => ({
      ...prev,
      squadPresets: nextPresets,
      activeSquadIdx,
    }));
  };

  // Level-up Draft Reroll / Skip / Banish Controls
  const [rerollsLeft, setRerollsLeft] = useState(0);
  const [banishMode, setBanishMode] = useState(false);
  const banishedIdsRef = useRef<Set<string>>(new Set());
  const passiveLevelsRef = useRef<Record<string, number>>({});
  const rebuildChoicesRef = useRef<(() => LevelChoice[]) | null>(null);

  const trainerProfile: TrainerProfile = {
    ...DEFAULT_TRAINER_PROFILE,
    ...(save.trainerProfile ?? {}),
  };
  const [profileOpen, setProfileOpen] = useState(false);
  const [closingProfile, setClosingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<TrainerProfile>(trainerProfile);
  const closeProfileModal = () => {
    if (!profileOpen || closingProfile) return;
    sound.play('cancel');
    setClosingProfile(true);
    window.setTimeout(() => {
      setClosingProfile(false);
      setProfileOpen(false);
    }, 165);
  };

  // Multi-Layer Flow: Main Hub -> Map Select -> Live 3D Playing (Auto-resumes directly into Playing on F5 without double-building Hub!)
  const [initialAutoResumePayload] = useState<WorldLaunchPayload | null>(() => {
    if (!wasActiveCareSessionOpen()) return null;
    const savedCp = loadWorldCheckpoint();
    if (!savedCp) return null;
    const wt = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
    const activeId = (savedCp.mode === 'geo' && savedCp.cityId) || wt.currentCityId || 'shanghai';
    const city =
      WORLD_CITIES.find((c) => c.id === activeId) ??
      WORLD_CITIES.find((c) => c.id === 'shanghai') ??
      WORLD_CITIES[0];
    const cityName = `${city.name}市`.replace(/市市$/, '市');
    setActiveGeoTerrainOrigin({
      originLat: city.lat,
      originLng: city.lng,
      startCityId: city.id,
      startCityName: cityName,
      unitsPerKm: GEO_UNITS_PER_KM,
    });
    return {
      cityId: city.id,
      cityName,
      gymName: city.gymName,
      gymBadgeName: city.gymBadgeName,
      biome: city.biome,
      wildPool: city.wildPool,
      bossSpecies: city.gymBossSpecies,
      bossName: city.gymBossTitle,
      bossTrainerKey: city.gymTrainerKey,
      bossTrainerName: city.gymLeaderName,
      regionalSkinId: city.regionalSkinId,
      rewardCoins: city.rewardCoins,
      originLat: city.lat,
      originLng: city.lng,
      isGymChallenge: false,
      isHomeTurf: true,
      hotelTier: wt.stayHotelTier ?? null,
    };
  });

  const [phase, setPhase] = useState<ArenaScreenPhase>(() => (initialAutoResumePayload ? 'playing' : 'hub'));
  const [worldMapOpen, setWorldMapOpen] = useState(false);
  const worldMapOpenRef = useRef(false);
  worldMapOpenRef.current = worldMapOpen;
  const [timeAlmanacOpen, setTimeAlmanacOpen] = useState(false);
  const timeAlmanacOpenRef = useRef(false);
  timeAlmanacOpenRef.current = timeAlmanacOpen;
  const [adventureStyle, setAdventureStyle] = useState<'care_world' | 'vampire_rogue'>('care_world');
  const adventureStyleRef = useRef<'care_world' | 'vampire_rogue'>('care_world');
  adventureStyleRef.current = adventureStyle;
  const [solarInfo, setSolarInfo] = useState<SolarDayNightState>(() =>
    computeSolarDayNight(31.23, 121.47, Date.now(), save.prefs?.worldTimeMode ?? 'auto'),
  );
  const solarInfoRef = useRef<SolarDayNightState>(solarInfo);
  solarInfoRef.current = solarInfo;
  const [activeWorldRun, setActiveWorldRun] = useState<WorldLaunchPayload | null>(initialAutoResumePayload);
  const [liveOverlandCity, setLiveOverlandCity] = useState<WorldCityDef | null>(null);
  const liveOverlandCityRef = useRef<WorldCityDef | null>(null);
  const overlandCityIdRef = useRef<string | null>(initialAutoResumePayload?.cityId ?? null);
  const [selectedBiome, setSelectedBiome] = useState<BiomeId>(initialAutoResumePayload?.biome ?? 'verdant_forest');
  const [gameMode, setGameMode] = useState<SurvivorsGameMode>('story');
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('normal');
  const [camPreset, setCamPreset] = useState<'wide' | 'close'>('wide');
  const camPresetRef = useRef<'wide' | 'close'>('wide');
  const CAM_MODE_META = CAM_MODE_SPECS;
  const CAM_MODE_ORDER = CAM_MODE_LIST;
  const [camFollowMode, setCamFollowMode] = useState<CameraFollowMode>(
    save.prefs?.cameraFollowMode ?? 'hd2d',
  );
  const camFollowModeRef = useRef<CameraFollowMode>(save.prefs?.cameraFollowMode ?? 'hd2d');
  // 1-Click A* Auto-Pathfinding State & Quick Destination Directory (Exposed inside 2D World Map!)
  interface AutoNavTargetItem {
    id: string;
    label: string;
    subLabel: string;
    icon: string;
    x: number;
    z: number;
  }
  const [autoNavActiveLabel, setAutoNavActiveLabel] = useState<string | null>(null);
  const [autoNavDistM, setAutoNavDistM] = useState<number | null>(null);
  const [autoNavEtaSec, setAutoNavEtaSec] = useState<number | null>(null);
  const lastNavDistSyncMsRef = useRef(0);
  const [autoNavTargets, setAutoNavTargets] = useState<AutoNavTargetItem[]>([]);
  const autoNavTargetsRef = useRef<AutoNavTargetItem[]>([]);
  autoNavTargetsRef.current = autoNavTargets;
  const autoNavRef = useRef<{
    label: string;
    goalX: number;
    goalZ: number;
    waypoints: AutoNavWaypoint[];
    idx: number;
    stuckTimer: number;
    lastCheckX: number;
    lastCheckZ: number;
    planningJob?: IncrementalAutoPathJob3D | null;
    hasRemainingHorizon?: boolean;
  } | null>(null);
  const startAutoNavRef = useRef<(target: { label: string; x: number; z: number }) => void>(() => {});
  const stopAutoNavRef = useRef<(silent?: boolean) => void>(() => {});
  // Standard PC 3D Third-Person Camera (Click-to-Pointer-Lock Mouse Look + Left/Right-Drag Orbit Fallback + Wheel Zoom + Physical Wall/Viaduct/Room Zoom!)
  const [pointerLocked, setPointerLocked] = useState(false);
  const restorePointerLockRef = useRef(false);
  const programmaticUnlockRef = useRef(false);
  const phaseRef = useRef<ArenaScreenPhase>(phase);
  phaseRef.current = phase;
  const camOrbitRef = useRef({ yaw: 0, pitch: 0.58, zoom: 1.0 });
  const camPivotRef = useRef(new THREE.Vector3(0, 1.55, 0));
  const camSmoothRef = useRef(createCameraRigSmoothState());
  const camDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    dragged: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    dragged: false,
  });
  useEffect(() => {
    camPresetRef.current = camPreset;
  }, [camPreset]);
  useEffect(() => {
    camFollowModeRef.current = camFollowMode;
  }, [camFollowMode]);
  useEffect(() => {
    const prefCam = save.prefs?.cameraFollowMode;
    if (prefCam && prefCam !== camFollowModeRef.current) {
      camFollowModeRef.current = prefCam;
      setCamFollowMode(prefCam);
      camOrbitRef.current.pitch = CAM_MODE_META[prefCam].pitch;
      camOrbitRef.current.zoom = 1.0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.prefs?.cameraFollowMode]);

  const applyCameraFollowMode = (nextMode: CameraFollowMode, announce = true) => {
    const metaCam = CAM_MODE_META[nextMode];
    camFollowModeRef.current = nextMode;
    setCamFollowMode(nextMode);
    onUpdatePrefs?.({ cameraFollowMode: nextMode });
    camOrbitRef.current.pitch = metaCam.pitch;
    camOrbitRef.current.zoom = 1.0;
    const mappedPreset = nextMode === 'chase' || nextMode === 'free' ? 'close' : 'wide';
    camPresetRef.current = mappedPreset;
    setCamPreset(mappedPreset);
    if (announce) {
      sound.play('cursor');
      showBanner(`🎥 镜头模式：${metaCam.label} — ${metaCam.desc}`, 2400);
    }
  };
  const cycleCameraFollowMode = () => {
    const curIdx = CAM_MODE_ORDER.indexOf(camFollowModeRef.current);
    const nextMode = CAM_MODE_ORDER[(curIdx + 1) % CAM_MODE_ORDER.length];
    applyCameraFollowMode(nextMode, true);
  };

  // Floating Dynamic 360° Mobile Joystick (appears where touched on left zone; hidden when idle & hidden on desktop!)
  const [vPad, setVPad] = useState({ originX: 0, originY: 0, x: 0, y: 0, active: false });
  const vPadOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const vPadPointerRef = useRef<number | null>(null);
  const camDragPointerRef = useRef<number | null>(null);
  const lastTouchBtnMsRef = useRef<number>(0);

  const resetVirtualPad = () => {
    vPadPointerRef.current = null;
    analogVecRef.current = { x: 0, y: 0 };
    setVPad((prev) =>
      prev.active || prev.x !== 0 || prev.y !== 0 ? { ...prev, x: 0, y: 0, active: false } : prev,
    );
  };

  // Global mobile safety net: catch missed pointerup/pointercancel/edge-swipe/blur so joystick NEVER sticks!
  useEffect(() => {
    const onWinPointerEnd = (e: PointerEvent) => {
      if (vPadPointerRef.current === e.pointerId) {
        resetVirtualPad();
      }
      if (camDragPointerRef.current === e.pointerId) {
        camDragPointerRef.current = null;
        camDragRef.current.active = false;
      }
    };
    const onWinTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        resetVirtualPad();
        camDragPointerRef.current = null;
        camDragRef.current.active = false;
      }
    };
    const onWinBlur = () => {
      resetVirtualPad();
      camDragPointerRef.current = null;
      camDragRef.current.active = false;
    };
    window.addEventListener('pointerup', onWinPointerEnd, { passive: true });
    window.addEventListener('pointercancel', onWinPointerEnd, { passive: true });
    window.addEventListener('touchend', onWinTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onWinTouchEnd, { passive: true });
    window.addEventListener('blur', onWinBlur);
    return () => {
      window.removeEventListener('pointerup', onWinPointerEnd);
      window.removeEventListener('pointercancel', onWinPointerEnd);
      window.removeEventListener('touchend', onWinTouchEnd);
      window.removeEventListener('touchcancel', onWinTouchEnd);
      window.removeEventListener('blur', onWinBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Multi-touch safe button handler:
   * - On touch/pen: fires IMMEDIATELY on pointerdown even while Finger #1 is dragging the left joystick!
   * - On mouse/keyboard: fires cleanly via onClick with dedupe so nothing ever double-triggers.
   */
  const bindMultiTouchAction = (action: () => void, isDisabled = false) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (isDisabled) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        e.preventDefault();
        lastTouchBtnMsRef.current = performance.now();
        action();
      }
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (isDisabled) return;
      if (performance.now() - lastTouchBtnMsRef.current < 420) return;
      action();
    },
  });

  // Live Tactical Configuration (Editable anytime during Pause!)
  const [tactics, setTactics] = useState<TacticalConfig>({ ...DEFAULT_TACTICAL_CONFIG });
  const tacticsRef = useRef<TacticalConfig>({ ...DEFAULT_TACTICAL_CONFIG });
  useEffect(() => {
    tacticsRef.current = tactics;
  }, [tactics]);

  // Sync external Handheld Console popup pause cleanly with the 3D loop
  const externalPausedRef = useRef(externalPaused);
  useEffect(() => {
    externalPausedRef.current = externalPaused;
  }, [externalPaused]);

  // Live merged Game Preferences (Audio, HUD Scale/Opacity, Boss Bar, Graphics Quality, FPS Cap, VFX Opacity!)
  const prefs: GamePrefs = { ...DEFAULT_GAME_PREFS, ...(save.prefs ?? {}) };
  const prefsRef = useRef<GamePrefs>(prefs);
  prefsRef.current = prefs;
  const shakeRef = useRef(0);
  const comboRef = useRef({ count: 0, timer: 0 });

  // HUD & Modals
  const [hud, setHud] = useState<{
    hp: number;
    maxHp: number;
    xp: number;
    xpNeed: number;
    runLevel: number;
    kills: number;
    coins: number;
    totalDamage: number;
    elapsedSec: number;
    inSafeZone: boolean;
    safeDirArrow: string;
    safeDistM: number;
    bossAliveName: string;
    bossHpPct: number;
    bossHp: number;
    bossMaxHp: number;
    fps: number;
    combo: number;
    followerVitals: Record<string, { hp: number; maxHp: number; mp: number; maxMp: number }>;
    actionCds: { ball: number; heal: number; boost: number; salvo: number };
    healCharges: number;
    boostLeft: number;
  }>({
    hp: 120,
    maxHp: 120,
    xp: 0,
    xpNeed: 18,
    runLevel: 1,
    kills: 0,
    coins: 0,
    totalDamage: 0,
    elapsedSec: 0,
    inSafeZone: false,
    safeDirArrow: '↗',
    safeDistM: 22,
    bossAliveName: '',
    bossHpPct: 0,
    bossHp: 0,
    bossMaxHp: 0,
    fps: 60,
    combo: 0,
    followerVitals: {},
    actionCds: { ball: 0, heal: 0, boost: 0, salvo: 0 },
    healCharges: 3,
    boostLeft: 0,
  });
  const [nearbyKoTarget, setNearbyKoTarget] = useState<{
    enemyId: number;
    species: SpeciesId;
    name: string;
    stage: 'baby' | 'teen' | 'adult';
    level: number;
    isBoss: boolean;
    isShiny: boolean;
    quality: MonsterQuality;
    heightM: number;
    weightKg: number;
    sprite: string;
  } | null>(null);
  const [captureCutscene, setCaptureCutscene] = useState<{
    species: SpeciesId;
    name: string;
    sprite: string;
    ballSprite: string;
    ballName?: string;
    level: number;
    isShiny: boolean;
    isNewSpecies: boolean;
    dexNo: string;
    typeLabel: string;
    typeColor: string;
    lore: string;
    quality: MonsterQuality;
    heightM: number;
    weightKg: number;
    phase: 'throw' | 'absorb' | 'wobble' | 'who_is_it' | 'pokedex_new' | 'caught' | 'escaped';
    wobbleCount: number;
  } | null>(null);
  const captureFinishRef = useRef<(() => void) | null>(null);
  const [isSurfing, setIsSurfing] = useState(false);
  type RideGearId = 'walk' | 'dash' | 'fly' | 'jet';
  const [rideMode, setRideMode] = useState<RideGearId>('walk');
  const rideModeRef = useRef<RideGearId>('walk');
  rideModeRef.current = rideMode;
  const [playerAltitudeM, setPlayerAltitudeM] = useState(2);
  const lastAltSyncMsRef = useRef(0);

  const cycleRideMode = () => {
    const order: RideGearId[] = ['walk', 'dash', 'fly', 'jet'];
    const cur = rideModeRef.current;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    rideModeRef.current = next;
    setRideMode(next);
    lastNavDistSyncMsRef.current = 0;
    const sim = simRef.current;
    if (sim && (next === 'fly' || next === 'jet')) {
      const floorNow = getWalkableSurfaceHeight3D(sim.px, sim.pz, sim.py);
      if (sim.py < floorNow + 14) {
        sim.py = floorNow + 18;
      }
      sim.vy = 0;
    }
    sound.play(next === 'walk' ? 'cursor' : 'levelup');
    const labels: Record<RideGearId, string> = {
      walk: '🚶 已切换为【徒步探索】（按住 Shift 可加速冲刺）',
      dash: '🐕 召唤陆地骑乘！【疾驰模式】轻松翻越山坡与城际大道！',
      fly: '🦅 召唤苍穹飞骑！【高空飞行】（空格拔高 / X键下降，自由翱翔群山！）',
      jet: '⚡ 进入超音速云端！【极速巡航】数十秒跨越邻近城市与名山！',
    };
    showBanner(labels[next], 2800);
  };

  const landRideMode = () => {
    rideModeRef.current = 'walk';
    setRideMode('walk');
    lastNavDistSyncMsRef.current = 0;
    const sim = simRef.current;
    if (sim) {
      sim.py = Math.max(WATER_LEVEL_3D + 0.14, getWalkableSurfaceHeight3D(sim.px, sim.pz));
      sim.vy = 0;
    }
    sound.play('confirm');
    showBanner('🛬 已平稳降落至地面！', 1600);
  };
  const surfWarnCdRef = useRef(0);
  const triggerBattleActionRef = useRef<
    ((kind: 'ball' | 'heal' | 'boost' | 'salvo' | 'capture_ko' | 'dismiss_ko', enemyId?: number) => void) | null
  >(null);
  const [followersView, setFollowersView] = useState<
    {
      id: string;
      sourcePetId?: string;
      species: SpeciesId;
      name: string;
      level: number;
      sprite: string;
      staticSprite: string;
      skills: SurvivorSkillId[];
    }[]
  >([]);
  const [floatingTags, setFloatingTags] = useState<FloatingTag2D[]>([]);
  const [edgeIndicators, setEdgeIndicators] = useState<
    {
      id: number;
      sx: number;
      sy: number;
      angleDeg: number;
      label: string;
      distM: number;
      kind: 'boss' | 'shiny' | 'ko' | 'trainer';
      icon: string;
    }[]
  >([]);
  const [levelChoices, setLevelChoices] = useState<LevelChoice[] | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const shopOpenRef = useRef(false);
  shopOpenRef.current = shopOpen;
  const [activeBgmTrack, setActiveBgmTrack] = useState<BgmTrackId>('hub');
  const activeBgmTrackRef = useRef<BgmTrackId>('hub');
  const [bgmState, setBgmState] = useState<BgmPlayerState>(() => sound.getBgmState());
  useEffect(() => sound.subscribeBgmState(setBgmState), []);
  useEffect(() => {
    if (phase !== 'playing') {
      const hubTrack: BgmTrackId = hubModal === 'shop' ? 'poke_mart' : 'hub';
      activeBgmTrackRef.current = hubTrack;
      setActiveBgmTrack(hubTrack);
      sound.setTrack(hubTrack);
    } else if (inRunTownShopOpen || shopOpen) {
      activeBgmTrackRef.current = 'poke_mart';
      setActiveBgmTrack('poke_mart');
      sound.setTrack('poke_mart');
    }
  }, [phase, hubModal, inRunTownShopOpen, shopOpen]);

  const ensureBgmEnabledForTransport = () => {
    const isBgmConfigMuted = !save.bgmEnabled || save.muted || save.bgmVolume <= 0;
    if (isBgmConfigMuted) {
      onToggleBgm?.();
    }
  };
  const handleBgmPlayPause = () => {
    sound.unlock();
    const isBgmConfigMuted = !save.bgmEnabled || save.muted || save.bgmVolume <= 0;
    if (isBgmConfigMuted) {
      sound.setBgmPaused(false);
      onToggleBgm?.();
      return;
    }
    const nowPaused = sound.toggleBgmPause();
    sound.play(nowPaused ? 'cancel' : 'confirm');
  };
  const handleBgmPrev = () => {
    sound.unlock();
    ensureBgmEnabledForTransport();
    sound.prevBgmSong();
    sound.play('cursor');
  };
  const handleBgmNext = () => {
    sound.unlock();
    ensureBgmEnabledForTransport();
    sound.nextBgmSong();
    sound.play('cursor');
  };
  const handleBgmCycleMode = () => {
    sound.cycleBgmPlayMode();
    sound.play('cursor');
  };
  const [captureOffer, setCaptureOffer] = useState<{ species: SpeciesId; name: string; level: number } | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<RunResultSummary | null>(null);

  // Prevent stuck joystick whenever a modal/level-up/capture/pause interrupts an active touch!
  useEffect(() => {
    if (
      phase !== 'playing' ||
      externalPaused ||
      Boolean(levelChoices) ||
      shopOpen ||
      Boolean(resultSummary) ||
      Boolean(captureOffer) ||
      Boolean(captureCutscene)
    ) {
      resetVirtualPad();
      camDragPointerRef.current = null;
      camDragRef.current.active = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, externalPaused, levelChoices, shopOpen, resultSummary, captureOffer, captureCutscene]);
  const [runNonce, setRunNonce] = useState(0);
  const [pokeballShutter, setPokeballShutter] = useState<PokeballShutterState>({
    stage: 'idle',
    label: '',
  });
  const shutterBusyRef = useRef(false);
  const on3DSceneReadyRef = useRef<(() => void) | null>(null);

  /**
   * Closes the Red-and-White Poké Ball shutter at locked 60fps FIRST, runs heavy 3D scene construction
   * strictly behind the closed shutter, waits for live WebGL frames to paint, then smoothly slides open!
   */
  const runWithPokeballShutter = (label: string, performHeavyWork: () => void) => {
    if (shutterBusyRef.current) return;
    shutterBusyRef.current = true;
    setPokeballShutter({ stage: 'closing', label });

    window.setTimeout(() => {
      setPokeballShutter({ stage: 'holding', label });
      // Wait 2 paint frames so the fully closed Poké Ball is guaranteed on-screen before heavy JS runs!
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const holdStartedAt = performance.now();
          let opened = false;
          const finishOpen = () => {
            if (opened) return;
            opened = true;
            on3DSceneReadyRef.current = null;
            const elapsedHold = performance.now() - holdStartedAt;
            const remainHold = Math.max(80, 220 - elapsedHold);
            window.setTimeout(() => {
              sound.play('cursor');
              setPokeballShutter({ stage: 'opening', label });
              window.setTimeout(() => {
                shutterBusyRef.current = false;
                setPokeballShutter({ stage: 'idle', label: '' });
              }, 540);
            }, remainHold);
          };
          on3DSceneReadyRef.current = finishOpen;
          // Safety fallback in case tab is backgrounded or external overlay pauses rendering
          window.setTimeout(finishOpen, 1100);
          performHeavyWork();
        });
      });
    }, 285);
  };
  // Bidirectional exit animation flags so modals & overlays animate OUT cleanly before unmounting!
  const [closingMapSelect, setClosingMapSelect] = useState(false);
  const [closingShop, setClosingShop] = useState(false);
  const [closingCapture, setClosingCapture] = useState(false);
  const [closingLevelUp, setClosingLevelUp] = useState(false);
  const [closingResult, setClosingResult] = useState(false);
  const [mapSnapshot, setMapSnapshot] = useState<LiveMapSnapshot>({
    px: 0,
    pz: 0,
    facingAngle: 0,
    camYaw: 0,
    dots: [],
  });
  const latestMapSnapshotRef = useRef<LiveMapSnapshot>(mapSnapshot);
  latestMapSnapshotRef.current = mapSnapshot;
  const [nearbyInteract, setNearbyInteract] = useState<NearbyActionMenuState | null>(null);
  const [interactOptionIdx, setInteractOptionIdx] = useState(0);
  const interactOptionIdxRef = useRef(0);
  interactOptionIdxRef.current = interactOptionIdx;
  const interactActionCountRef = useRef(0);
  const cycleInteractOptionRef = useRef<((delta: number) => void) | null>(null);
  cycleInteractOptionRef.current = (delta: number) => {
    const count = interactActionCountRef.current;
    if (count <= 1) return;
    sound.play('cursor');
    setInteractOptionIdx((prev) => {
      const next = (((prev + delta) % count) + count) % count;
      interactOptionIdxRef.current = next;
      return next;
    });
  };
  const executeInteractActionRef = useRef<((idx: number) => void) | null>(null);
  const worldBubblesRef = useRef<LiveWorldBubble[]>([]);
  const [projectedBubbles, setProjectedBubbles] = useState<ProjectedBubble2D[]>([]);
  const [askQuickNavOpen, setAskQuickNavOpen] = useState(false);
  const lastEnteredInteriorIdRef = useRef<string | null>(null);
  const npcSocialTimerRef = useRef<number>(2.0);
  const [activeBusStopModal, setActiveBusStopModal] = useState<ActiveBusStopModalState | null>(null);
  const startStreetDuelRef = useRef<
    ((opts: { npcName: string; npcSprite: string; species: SpeciesId; x: number; z: number }) => void) | null
  >(null);
  const teleportIntraCityBusRef = useRef<((x: number, z: number, label: string) => void) | null>(null);
  const triggerInteractRef = useRef<(() => void) | null>(null);
  const nearbyKoIdRef = useRef<number | null>(null);
  const dragFollowerIdxRef = useRef<number | null>(null);
  const [dragOverFollowerIdx, setDragOverFollowerIdx] = useState<number | null>(null);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<
    (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }) | null
  >(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPwaInstallPrompt(
        e as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> },
      );
    };
    const onInstalled = () => setPwaInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const persistSimFollowersToSquad = (followers: ActiveFollower[]) => {
    if (!onUpdateMeta) return;
    const nextPetIds = followers
      .map((f) => f.sourcePetId)
      .filter((id): id is string => Boolean(id));
    if (nextPetIds.length === 0) return;
    onUpdateMeta((prev) => {
      const list = prev.squadPresets && prev.squadPresets.length > 0 ? prev.squadPresets : squadPresets;
      const idx = Math.min(list.length - 1, Math.max(0, prev.activeSquadIdx ?? activeSquadIdx));
      const nextList = list.map((pr, i) => (i === idx ? { ...pr, petIds: nextPetIds } : pr));
      return { ...prev, squadPresets: nextList, activeSquadIdx: idx };
    });
  };

  const reorderBattleFollowers = (fromIdx: number, toIdx: number) => {
    const sim = simRef.current;
    if (!sim) return;
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= sim.followers.length || toIdx >= sim.followers.length) {
      return;
    }
    const [moved] = sim.followers.splice(fromIdx, 1);
    sim.followers.splice(toIdx, 0, moved);
    // Reassign clean radial formation orbit slots matching the new tactical order
    sim.followers.forEach((f, idx) => {
      f.orbitAngle = (idx * Math.PI * 2) / Math.max(1, sim.followers.length);
    });
    sound.play('cursor');
    syncFollowersView();
    // Persist reordered petIds back into active squad preset
    persistSimFollowersToSquad(sim.followers);
  };

  const removeBattleFollower = (followerId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    const idx = sim.followers.findIndex((f) => f.id === followerId);
    if (idx === -1) return;
    if (sim.followers.length <= 1) {
      sound.play('error');
      showBanner('至少保留 1 只宝可梦在当前队伍中！');
      return;
    }
    const [removed] = sim.followers.splice(idx, 1);
    detachFollowerMeshes(removed);
    sim.followers.forEach((f, i) => {
      f.orbitAngle = (i * Math.PI * 2) / Math.max(1, sim.followers.length);
    });
    sound.play('cancel');
    syncFollowersView();
    persistSimFollowersToSquad(sim.followers);
    showBanner(`已将「${removed.name}」移出当前队伍（可在编队或精灵球盒随时重新上阵）`, 2200);
  };
  const fastTravelCityRef = useRef<(cityId: string) => void>(() => {});
  const teleportGeoSpotRef = useRef<(spot: ScenicMountainSpot) => void>(() => {});
  const teleportDirectRef = useRef<(tx: number, tz: number, label: string) => void>(() => {});
  const returnToHubCityRef = useRef<(dest: 'plaza' | 'home') => void>(() => {});
  const handleFastTravelCity = (cityId: string) => {
    fastTravelCityRef.current(cityId);
  };
  const toggleWorldMap = () => {
    sound.play('confirm');
    const curSim = simRef.current;
    const baseSnap = latestMapSnapshotRef.current;
    const liveSnap: LiveMapSnapshot = curSim
      ? {
          ...baseSnap,
          px: curSim.px,
          pz: curSim.pz,
          facingAngle: curSim.facingAngle,
          camYaw: camOrbitRef.current.yaw,
        }
      : baseSnap;
    setMapSnapshot(liveSnap);
    const curGeo = getActiveGeoTerrainOrigin();
    onSyncWorldMapData?.({
      biome: liveOverlandCityRef.current?.biome ?? selectedBiome,
      regionName: liveOverlandCityRef.current?.name ?? regionMeta.name,
      hubCityName: activeWorldRun?.cityName ?? curGeo?.startCityName ?? regionMeta.name,
      snapshot: liveSnap,
      onReturnToHubCity: (dest) => returnToHubCityRef.current(dest),
      navTargets: autoNavTargetsRef.current,
      onAutoWalkTo: (x, z, label) => startAutoNavRef.current({ label, x, z }),
      onTeleportTo: (x, z, label) => teleportDirectRef.current(x, z, label),
      onOpenGlobalWorldMap: () => setWorldMapOpen(true),
    });
    onOpenPokemonManager('map', true);
  };
  const resultModal = resultSummary?.payload ?? null;

  const closeMapSelect = () => {
    if (closingMapSelect) return;
    sound.play('cancel');
    setClosingMapSelect(true);
    window.setTimeout(() => {
      setClosingMapSelect(false);
      setPhase('hub');
    }, 175);
  };

  const tryRestorePointerLock = () => {
    if (!restorePointerLockRef.current) return;
    if (phase !== 'playing') {
      restorePointerLockRef.current = false;
      return;
    }
    const isDesktopMouse =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: fine)').matches &&
      window.innerWidth > 768 &&
      window.innerHeight > 560;
    if (!isDesktopMouse || !canvasRef.current) {
      restorePointerLockRef.current = false;
      return;
    }
    if (document.pointerLockElement === canvasRef.current) {
      restorePointerLockRef.current = false;
      return;
    }
    try {
      const maybePromise = canvasRef.current.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then(() => {
            restorePointerLockRef.current = false;
          })
          .catch(() => {
            // Keep restorePointerLockRef armed so next movement key or click restores lock seamlessly
          });
      } else {
        restorePointerLockRef.current = false;
      }
    } catch {
      // Keep armed for next gesture
    }
  };

  const closeShopModal = () => {
    if (!shopOpen || closingShop) return;
    sound.play('cancel');
    setClosingShop(true);
    if (!levelChoices) tryRestorePointerLock();
    window.setTimeout(() => {
      setClosingShop(false);
      setShopOpen(false);
      if (!levelChoices) pausedRef.current = false;
    }, 165);
  };

  // Standard PC 3D Free-Look Camera: Pointer Lock listener + Mouse Look + Auto-Unlock on Modals/Pause
  useEffect(() => {
    let wasLocked = false;
    const onLockChange = () => {
      const nowLocked = document.pointerLockElement === canvasRef.current;
      setPointerLocked(nowLocked);
      if (wasLocked && !nowLocked) {
        if (programmaticUnlockRef.current) {
          programmaticUnlockRef.current = false;
        } else if (phaseRef.current === 'playing' && !externalPausedRef.current && !worldMapOpenRef.current) {
          // User pressed ESC while in 3D pointer-lock -> immediately open Top-Right Trainer Menu & Settings!
          sound.play('cursor');
          onOpenPokemonManager('menu', true);
        }
      }
      wasLocked = nowLocked;
    };
    const onGamepadConnect = (e: GamepadEvent) => {
      showBanner(`🎮 已连接游戏手柄「${e.gamepad.id.slice(0, 26)}」！支持双摇杆与全快捷键操作`, 3200);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current) return;
      if (pausedRef.current || externalPausedRef.current) return;
      camOrbitRef.current.yaw -= e.movementX * 0.0028;
      camOrbitRef.current.pitch = Math.max(
        0.1,
        Math.min(MAX_CAM_PITCH, camOrbitRef.current.pitch + e.movementY * 0.0024),
      );
    };
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('gamepadconnected', onGamepadConnect);
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('gamepadconnected', onGamepadConnect);
    };
  }, []);

  useEffect(() => {
    const isTerminalEnd = phase !== 'playing' || Boolean(resultSummary);
    const isTempInterrupt =
      externalPaused ||
      Boolean(levelChoices && !closingLevelUp) ||
      (shopOpen && !closingShop) ||
      Boolean(captureOffer && !closingCapture);
    const shouldUnlock = isTerminalEnd || isTempInterrupt;

    if (isTerminalEnd) {
      restorePointerLockRef.current = false;
    }

    if (shouldUnlock && document.pointerLockElement === canvasRef.current) {
      if (isTempInterrupt && !isTerminalEnd) {
        restorePointerLockRef.current = true;
      }
      programmaticUnlockRef.current = true;
      try {
        document.exitPointerLock?.();
      } catch {
        // ignore
      }
    } else if (!shouldUnlock && restorePointerLockRef.current) {
      // Attempt restoration when temporary modal/handheld closes
      tryRestorePointerLock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    externalPaused,
    levelChoices,
    closingLevelUp,
    shopOpen,
    closingShop,
    resultSummary,
    captureOffer,
    closingCapture,
  ]);

  const pausedRef = useRef(!initialAutoResumePayload);
  const endedRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const jumpQueuedRef = useRef(false);
  const pointerSteerRef = useRef<{ active: boolean; nx: number; nz: number }>({
    active: false,
    nx: 0,
    nz: 0,
  });
  const bannerTimerRef = useRef<number | null>(null);

  const baseRegionMeta = MAP_REGIONS.find((m) => m.id === selectedBiome) ?? MAP_REGIONS[0];
  const regionMeta = activeWorldRun
    ? {
        ...baseRegionMeta,
        name: liveOverlandCity
          ? `${liveOverlandCity.name}`
          : activeWorldRun.isGymChallenge && activeWorldRun.gymName
            ? `${activeWorldRun.cityName} · ${activeWorldRun.gymName}`
            : `${activeWorldRun.cityName}`,
        wildPool: liveOverlandCity?.wildPool ?? activeWorldRun.wildPool,
        bossSpecies: activeWorldRun.bossSpecies ?? baseRegionMeta.bossSpecies,
        bossName: activeWorldRun.bossName ?? baseRegionMeta.bossName,
        bossTrainerKey: activeWorldRun.bossTrainerKey ?? baseRegionMeta.bossTrainerKey,
        bossTrainerName: activeWorldRun.bossTrainerName ?? baseRegionMeta.bossTrainerName,
        targetSec: activeWorldRun.isGymChallenge ? 95 : 135,
        rewardCoins: activeWorldRun.rewardCoins,
      }
    : baseRegionMeta;
  const diffMeta = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[0];

  const showBanner = (msg: string, ms = 2800) => {
    setBannerMsg(msg);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setBannerMsg(null), ms);
  };

  // Three.js + Simulation Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const texCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const simRef = useRef<{
    px: number;
    py: number;
    pz: number;
    vy: number;
    facingAngle: number;
    walkDist: number;
    hp: number;
    maxHp: number;
    invuln: number;
    xp: number;
    xpNeed: number;
    runLevel: number;
    kills: number;
    coins: number;
    totalDamage: number;
    elapsed: number;
    lastSeamlessBiome?: BiomeId;
    speedMult: number;
    pickupRadius: number;
    cdMult: number;
    atkMult: number;
    greedMult: number;
    baseAtk: number;
    salvoTimer: number;
    followers: ActiveFollower[];
    enemies: Enemy3D[];
    projectiles: Projectile3D[];
    loots: Loot3D[];
    vfxs: Vfx3D[];
    activeCaptures: ActiveCapture3D[];
    actionCds: { ball: number; heal: number; boost: number; salvo: number };
    healCharges: number;
    revivesLeft: number;
    boostTimer: number;
    timers: {
      spawn: number;
      trainer: number;
      safeHealCd: number;
      hudSync: number;
    };
    trainerWaveIdx: number;
    trainersDefeated: number;
    capturedBoss: { species: SpeciesId; name: string; level: number } | null;
    storyBossSpawned: boolean;
    endlessBossTimer: number;
    wildStaySec: number;
    wildZoneAnchorX: number;
    wildZoneAnchorZ: number;
    guardianWaveCount: number;
    nextId: number;
    dmgPops: { id: number; wx: number; wy: number; wz: number; text: string; color: string; life: number }[];
  } | null>(null);

  const buildResultSummary = (cleared: boolean, capturedOverride?: { species: SpeciesId; name: string; level: number } | null): RunResultSummary => {
    const sim = simRef.current;
    const survivedSec = Math.max(1, Math.round(sim?.elapsed ?? 1));
    const totalDamage = sim?.totalDamage ?? 0;
    const payload: SurvivorsResultPayload = {
      survivedSec,
      kills: sim?.kills ?? 0,
      runLevel: sim?.runLevel ?? 1,
      coinsCollected: sim?.coins ?? 0,
      cleared,
      remainingHpPct: sim ? Math.max(cleared ? 20 : 15, Math.round((Math.max(0, sim.hp) / sim.maxHp) * 100)) : 20,
    };
    const squadReport: FollowerReportRow[] = (sim?.followers ?? [])
      .map((f) => ({
        id: f.id,
        species: f.species,
        name: f.name,
        level: f.level,
        sprite: SPECIES_CATALOG[f.species].stageSprites[f.stage].animated,
        skills: [...f.skills] as [SurvivorSkillId, SurvivorSkillId],
        damageDealt: f.damageDealt,
        kills: f.kills,
        casts: f.casts,
      }))
      .sort((a, b) => b.damageDealt - a.damageDealt || b.kills - a.kills);
    if (cleared && activeWorldRun?.isGymChallenge && activeWorldRun.cityId && onUpdateMeta) {
      const wonCityId = activeWorldRun.cityId;
      onUpdateMeta?.((prev) => {
        const curTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
        if (curTour.clearedCityGyms.includes(wonCityId)) return prev;
        return {
          ...prev,
          worldTour: {
            ...curTour,
            clearedCityGyms: [...curTour.clearedCityGyms, wonCityId],
          },
        };
      });
    }
    return {
      payload,
      totalDamage,
      dps: Math.round(totalDamage / survivedSec),
      trainersDefeated: sim?.trainersDefeated ?? 0,
      capturedBoss: capturedOverride !== undefined ? capturedOverride : (sim?.capturedBoss ?? null),
      squadReport,
    };
  };

  const getPixelTexture = (url: string): THREE.Texture => {
    const cached = texCacheRef.current.get(url);
    if (cached) return cached;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(url);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    texCacheRef.current.set(url, tex);
    return tex;
  };

  const createSpriteEntity = (
    url: string,
    scale: number,
    animGifUrl?: string,
    isShiny = false,
  ): {
    sprite: THREE.Mesh;
    shadow: THREE.Mesh;
    animSheet?: AnimatedSpriteSheet3D;
    backAnimSheet?: AnimatedSpriteSheet3D;
    pmdSheet?: Pmd8DirSheet3D;
  } => {
    const dexId = extractDexIdFromSpriteUrl(animGifUrl ?? url);
    const pmdSheet = dexId ? getPmd8DirSheet(dexId, url, isShiny) : undefined;
    const animSheet = !pmdSheet && animGifUrl ? getAnimatedGifTextures(animGifUrl, url) : undefined;
    const backGifUrl =
      !pmdSheet && animGifUrl && animGifUrl.includes('/sprites/pokemon/')
        ? animGifUrl.replace('/sprites/pokemon/', '/sprites/pokemon/back/')
        : undefined;
    const backAnimSheet = backGifUrl ? getAnimatedGifTextures(backGifUrl, url) : undefined;
    const mat = new THREE.MeshBasicMaterial({
      map: pmdSheet ? pmdSheet.rows[0][0] : animSheet ? animSheet.frames[0] : getPixelTexture(url),
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    });
    const sprite = new THREE.Mesh(UPRIGHT_QUAD_GEO, mat);
    sprite.rotation.order = 'YXZ';
    sprite.scale.set(scale, scale, 1);
    const shadow = new THREE.Mesh(UNIT_SHADOW_GEO, SHARED_ENTITY_SHADOW_MAT);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.setScalar(scale * 0.36);
    return { sprite, shadow, animSheet, backAnimSheet, pmdSheet };
  };

  const syncFollowersView = () => {
    const sim = simRef.current;
    if (!sim) return;
    setFollowersView(
      sim.followers.map((f) => ({
        id: f.id,
        sourcePetId: f.sourcePetId,
        species: f.species,
        name: f.name,
        level: f.level,
        sprite: SPECIES_CATALOG[f.species].stageSprites[f.stage].animated,
        staticSprite: SPECIES_CATALOG[f.species].stageSprites[f.stage].static,
        skills: [...f.skills],
      })),
    );
  };

  const attachFollowerMeshes = (f: ActiveFollower) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (f.sprite) scene.remove(f.sprite);
    if (f.shadow) scene.remove(f.shadow);
    if (f.leafMeshes) f.leafMeshes.forEach((m) => scene.remove(m));

    const stageAsset = SPECIES_CATALOG[f.species].stageSprites[f.stage];
    const worldScale = getPokemonWorldScale3D(f.species, f.stage, 1.0);
    const skinDef = f.skin ? getSkinDef(f.skin) : undefined;
    const { sprite, shadow, animSheet, backAnimSheet, pmdSheet } = createSpriteEntity(
      stageAsset.static,
      worldScale,
      stageAsset.animated,
      Boolean(skinDef?.usesOfficialShiny),
    );
    if (skinDef && skinDef.id !== 'classic' && !skinDef.usesOfficialShiny) {
      (sprite.material as THREE.MeshBasicMaterial).color.setHex(skinDef.tintHex3D);
    }
    sprite.position.set(f.x, f.y - 0.04, f.z);
    shadow.position.set(f.x, f.y + 0.06, f.z);
    scene.add(sprite, shadow);
    f.sprite = sprite;
    f.shadow = shadow;
    f.animSheet = animSheet;
    f.backAnimSheet = backAnimSheet;
    f.pmdSheet = pmdSheet;
    f.leafMeshes = [];
  };

  const detachFollowerMeshes = (f: ActiveFollower) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (f.sprite) scene.remove(f.sprite);
    if (f.shadow) scene.remove(f.shadow);
    if (f.leafMeshes) f.leafMeshes.forEach((m) => scene.remove(m));
  };

  const addFollowerToRun = (
    species: SpeciesId,
    name?: string,
    stage: 'baby' | 'teen' | 'adult' = 'baby',
    sourcePetId?: string,
    skin?: PetSkinId,
  ): boolean => {
    const sim = simRef.current;
    if (!sim || sim.followers.length >= maxFollowersRef.current) return false;
    const meta = SPECIES_CATALOG[species];
    const ang = (sim.followers.length * Math.PI * 2) / Math.max(1, sim.followers.length + 1);
    const fx = sim.px + Math.cos(ang) * 2.8;
    const fz = sim.pz + Math.sin(ang) * 2.8;
    const f: ActiveFollower = {
      id: sourcePetId ? `box_${sourcePetId}` : `rec_${Date.now()}_${sim.nextId++}`,
      sourcePetId,
      species,
      name: name ?? meta.defaultName,
      stage,
      level: 1,
      skin,
      skills: getDefaultSkillsForElement(meta.element),
      x: fx,
      y: getTerrainHeight3D(fx, fz),
      z: fz,
      vx: 0,
      vz: 0,
      wanderX: Math.cos(ang) * 3.0,
      wanderZ: Math.sin(ang) * 3.0,
      wanderTimer: 0.8 + Math.random() * 1.4,
      castAnim: 0,
      animTime: Math.random() * 2,
      damageDealt: 0,
      kills: 0,
      casts: 0,
      cds: [0.25, 0.8, 1.35, 1.9],
      orbitAngle: ang,
      facingLeft: false,
    };
    sim.followers.push(f);
    attachFollowerMeshes(f);
    sound.playCry(getPokemonCryId(species, stage === 'adult' ? 20 : stage === 'teen' ? 10 : 5));
    syncFollowersView();
    return true;
  };

  const toggleFollowerInPause = (boxPet: PetRecord) => {
    const sim = simRef.current;
    if (!sim) return;
    const idx = sim.followers.findIndex((f) => f.sourcePetId === boxPet.id);
    if (idx !== -1) {
      if (sim.followers.length <= 1) {
        sound.play('error');
        showBanner('至少保留 1 只宝可梦跟随主角！');
        return;
      }
      sound.play('cancel');
      detachFollowerMeshes(sim.followers[idx]);
      sim.followers.splice(idx, 1);
      sim.followers.forEach((f, i) => {
        f.orbitAngle = (i * Math.PI * 2) / Math.max(1, sim.followers.length);
      });
      syncFollowersView();
      persistSimFollowersToSquad(sim.followers);
    } else {
      if (sim.followers.length >= maxFollowersRef.current) {
        sound.play('error');
        showBanner(`最多同时携带 ${maxFollowersRef.current} 只跟随宝可梦！`);
        return;
      }
      addFollowerToRun(
        boxPet.species,
        boxPet.name,
        getGrowthStage(boxPet.level, boxPet.species),
        boxPet.id,
        boxPet.skin,
      );
      persistSimFollowersToSquad(sim.followers);
    }
  };

  const setFollowerSkillSlot = (followerId: string, slot: number, skillId: SurvivorSkillId) => {
    const sim = simRef.current;
    if (!sim || slot < 0 || slot >= 4) return;
    const target = sim.followers.find((f) => f.id === followerId);
    if (!target) return;
    sound.play('confirm');
    const nextSkills = [...target.skills];
    while (nextSkills.length < 4) nextSkills.push('swift_volley');
    nextSkills[slot] = skillId;
    if (!nextSkills.includes('razor_leaf') && target.leafMeshes && sceneRef.current) {
      target.leafMeshes.forEach((m) => sceneRef.current?.remove(m));
      target.leafMeshes = [];
    }
    target.skills = nextSkills;
    syncFollowersView();
  };

  // Live-sync 3D combat followers whenever the user switches or edits their active Squad preset mid-battle!
  const activeSquadIdsKey = activeSquadPreset.petIds.join(',');
  useEffect(() => {
    if (phase !== 'playing') return;
    const sim = simRef.current;
    if (!sim) return;

    const desiredPets = effectiveSquadPets.slice(0, maxFollowers);
    if (desiredPets.length === 0) return;

    const desiredIds = desiredPets.map((p) => p.id);
    const currentBoxFollowers = sim.followers.filter((f) => Boolean(f.sourcePetId));
    const currentIds = currentBoxFollowers.map((f) => f.sourcePetId as string);
    if (
      currentIds.length === desiredIds.length &&
      currentIds.every((id, i) => id === desiredIds[i])
    ) {
      return;
    }

    const desiredSet = new Set(desiredIds);
    const reusedByPetId = new Map<string, ActiveFollower>();
    const keptWild: ActiveFollower[] = [];
    for (const f of sim.followers) {
      if (f.sourcePetId) {
        if (desiredSet.has(f.sourcePetId)) {
          reusedByPetId.set(f.sourcePetId, f);
        } else {
          detachFollowerMeshes(f);
        }
      } else {
        keptWild.push(f);
      }
    }

    const nextFollowers: ActiveFollower[] = [];
    desiredPets.forEach((boxPet, idx) => {
      const existing = reusedByPetId.get(boxPet.id);
      if (existing) {
        existing.name = boxPet.name;
        existing.level = Math.max(existing.level, boxPet.level);
        nextFollowers.push(existing);
      } else {
        const spMeta = SPECIES_CATALOG[boxPet.species];
        const stage = getGrowthStage(boxPet.level, boxPet.species);
        const ang = (idx * Math.PI * 2) / Math.max(1, desiredPets.length);
        const fx = sim.px + Math.cos(ang) * 2.8;
        const fz = sim.pz + Math.sin(ang) * 2.8;
        const fresh: ActiveFollower = {
          id: `box_${boxPet.id}`,
          sourcePetId: boxPet.id,
          species: boxPet.species,
          name: boxPet.name,
          stage,
          level: boxPet.level,
          skin: boxPet.skin,
          skills: getDefaultSkillsForElement(spMeta.element),
          x: fx,
          y: getTerrainHeight3D(fx, fz),
          z: fz,
          vx: 0,
          vz: 0,
          wanderX: Math.cos(ang) * 3.0,
          wanderZ: Math.sin(ang) * 3.0,
          wanderTimer: 0.8 + Math.random() * 1.4,
          castAnim: 0,
          animTime: Math.random() * 2,
          damageDealt: 0,
          kills: 0,
          casts: 0,
          cds: [0.25, 0.8, 1.35, 1.9],
          orbitAngle: ang,
          facingLeft: false,
        };
        attachFollowerMeshes(fresh);
        nextFollowers.push(fresh);
      }
    });

    // Keep wild-recruited followers only while within maxFollowers cap
    for (const wf of keptWild) {
      if (nextFollowers.length < maxFollowers) {
        nextFollowers.push(wf);
      } else {
        detachFollowerMeshes(wf);
      }
    }

    nextFollowers.forEach((f, i) => {
      f.orbitAngle = (i * Math.PI * 2) / Math.max(1, nextFollowers.length);
    });
    sim.followers = nextFollowers;
    syncFollowersView();
  }, [phase, activeSquadIdx, activeSquadIdsKey, maxFollowers, save.pets]);

  // Dynamic BGM
  useEffect(() => {
    if (phase !== 'playing') {
      sound.setTrack('town');
      return;
    }
    sound.setTrack(hud.inSafeZone ? 'safezone' : 'adventure');
  }, [phase, hud.inSafeZone]);
  // Hub announcement marquee rotation (cycles across all rolling Kanto Daily editions!)
  useEffect(() => {
    if (phase !== 'hub') return;
    const timer = window.setInterval(() => {
      setNewsTickerIdx((i) => (i + 1) % DEFAULT_ANNOUNCEMENTS.length);
    }, 4600);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Responsive Priority+ single-row Hub dock measurement (packs as many tiles as fit, overflows ONLY the rest into "More")
  useEffect(() => {
    if (phase !== 'hub') return;
    const el = dockRowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const recalc = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const TILE_MIN_W = 84;
      const GAP = 8;
      const fit = Math.max(3, Math.min(8, Math.floor((w + GAP) / (TILE_MIN_W + GAP))));
      setVisibleDockCount(fit);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // Sync Difficulty, Mode & Weather Override cleanly with Minecraft-style World Settings!
  useEffect(() => {
    const prefDiff = save.prefs?.worldDifficulty;
    if (prefDiff && prefDiff !== difficultyId) setDifficultyId(prefDiff);
  }, [save.prefs?.worldDifficulty, difficultyId]);

  // Live Real-Time Weather & Independent Temperature Sync (Open-Meteo or manual Debug/World overrides!)
  useEffect(() => {
    let cancelled = false;
    const override = save.prefs?.worldWeatherMode;
    const manualIntensity: WeatherIntensity = save.prefs?.worldWeatherIntensity ?? 'moderate';
    const tempMode = save.prefs?.worldTempMode ?? 'auto';
    const manualTempC = save.prefs?.worldTempC ?? 22;

    if (override && override !== 'auto') {
      const tempByKind: Record<WeatherKind, number> = {
        clear: 25,
        cloudy: 19,
        rain: 17,
        storm: 16,
        hail: 2,
        snow: -2,
        windy: 18,
      };
      const windByIntensity: Record<WeatherIntensity, number> = {
        light: override === 'windy' ? 28 : 8,
        moderate: override === 'windy' ? 40 : 14,
        heavy: override === 'windy' ? 56 : 24,
      };
      const finalTemp = tempMode === 'manual' ? manualTempC : tempByKind[override];
      setLiveWeather(
        buildWeatherInfo(
          override,
          finalTemp,
          windByIntensity[manualIntensity],
          'fallback',
          '世界设置指定',
          override === 'clear' ? 'moderate' : manualIntensity,
        ),
      );
      return;
    }
    const tour = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
    const curCity = tour.currentCityId ? WORLD_CITIES.find((c) => c.id === tour.currentCityId) : null;
    const defHome = getDefaultHomeByLanguage(lang);
    const lat = curCity ? curCity.lat : (tour.homeCoords?.lat ?? defHome.lat);
    const lng = curCity ? curCity.lng : (tour.homeCoords?.lng ?? defHome.lng);
    const label = curCity ? curCity.name : (tour.homeCoords?.label ?? defHome.label);
    fetchLiveWeatherAt(lat, lng, label).then((info) => {
      if (cancelled) return;
      if (tempMode === 'manual') {
        setLiveWeather(
          buildWeatherInfo(
            info.kind,
            manualTempC,
            info.windKmh,
            info.source,
            info.locationLabel,
            info.intensity,
          ),
        );
      } else {
        setLiveWeather(info);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    save.prefs?.worldWeatherMode,
    save.prefs?.worldWeatherIntensity,
    save.prefs?.worldTempMode,
    save.prefs?.worldTempC,
    meta.worldTour?.currentCityId,
    meta.worldTour?.homeCoords?.lat,
    meta.worldTour?.homeCoords?.lng,
    lang,
  ]);

  // Live Geo-Latitude Season & Climate Zone (tracks northern/southern hemisphere & tropical/temperate/polar belts!)
  const [activeSeasonLat, setActiveSeasonLat] = useState<number>(() => {
    const tour = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
    const curCity = tour.currentCityId ? WORLD_CITIES.find((c) => c.id === tour.currentCityId) : null;
    const defHome = getDefaultHomeByLanguage(lang);
    return curCity ? curCity.lat : (tour.homeCoords?.lat ?? defHome.lat);
  });
  const activeSeasonLatRef = useRef<number>(activeSeasonLat);
  activeSeasonLatRef.current = activeSeasonLat;

  useEffect(() => {
    const tour = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
    const curCity = tour.currentCityId ? WORLD_CITIES.find((c) => c.id === tour.currentCityId) : null;
    const defHome = getDefaultHomeByLanguage(lang);
    const nextLat = curCity ? curCity.lat : (tour.homeCoords?.lat ?? defHome.lat);
    setActiveSeasonLat(nextLat);
  }, [meta.worldTour?.currentCityId, meta.worldTour?.homeCoords?.lat, lang]);

  const liveGeoSeason: GeoSeasonInfo = useMemo(
    () => resolveGeoSeason(activeSeasonLat, Date.now(), save.prefs?.worldSeasonMode ?? 'auto'),
    [activeSeasonLat, save.prefs?.worldSeasonMode],
  );
  const liveGeoSeasonRef = useRef<GeoSeasonInfo>(liveGeoSeason);
  liveGeoSeasonRef.current = liveGeoSeason;

  // Procedural Non-Looping Weather & Latitude-Seasonal Wildlife Ambience Sync
  const activeInteriorAudioRef = useRef(false);
  useEffect(() => {
    const isNightNow = solarInfo.phase === 'night' || solarInfo.phase === 'dusk';
    sound.setWeatherAmbience(liveWeather.kind, {
      indoor: phase === 'hub' ? false : activeInteriorAudioRef.current,
      isNight: isNightNow,
      dayPhase: solarInfo.phase,
      intensity: liveWeather.intensity,
      season: liveGeoSeason.season,
      climateZone: liveGeoSeason.climateZone,
      seasonManual: (save.prefs?.worldSeasonMode ?? 'auto') !== 'auto',
      tempC: liveWeather.tempC,
    });
  }, [
    liveWeather.kind,
    liveWeather.intensity,
    liveWeather.tempC,
    liveGeoSeason.season,
    liveGeoSeason.climateZone,
    save.prefs?.worldSeasonMode,
    solarInfo.phase,
    phase,
  ]);

  useEffect(() => {
    return () => {
      sound.setWeatherAmbience(null);
    };
  }, []);

  // Mobile Back / Swipe-Back coordination with App.tsx
  const arenaHasCloseableLayer =
    phase !== 'hub' ||
    worldMapOpen ||
    hubModal !== 'none' ||
    profileOpen ||
    squadEditorOpen ||
    shopOpen ||
    inRunTownShopOpen;

  useEffect(() => {
    onBackLayerActiveChange?.(arenaHasCloseableLayer);
  }, [arenaHasCloseableLayer, onBackLayerActiveChange]);

  useEffect(() => {
    if (!onRegisterBackHandler) return;
    const handler = (): boolean => {
      if (timeAlmanacOpen) {
        sound.play('cancel');
        setTimeAlmanacOpen(false);
        return phase !== 'hub';
      }
      if (worldMapOpen) {
        sound.play('cancel');
        setWorldMapOpen(false);
        return phase !== 'hub';
      }
      if (inRunTownShopOpen) {
        sound.play('cancel');
        setInRunTownShopOpen(false);
        return true;
      }
      if (shopOpen) {
        closeShopModal();
        return phase !== 'hub';
      }
      if (squadEditorOpen) {
        closeSquadEditor();
        return phase !== 'hub';
      }
      if (hubModal !== 'none') {
        closeHubModal();
        return phase !== 'hub' || profileOpen;
      }
      if (profileOpen) {
        closeProfileModal();
        return phase !== 'hub';
      }
      if (phase === 'world_map') {
        sound.play('cancel');
        setPhase('hub');
        return false;
      }
      if (phase === 'map_select') {
        closeMapSelect();
        return false;
      }
      if (phase === 'playing') {
        if (resultSummary) {
          closeResultAndRun(() => {
            onFinish(pet.id, resultSummary.payload, false);
            setPhase('hub');
          });
          return false;
        }
        // In live 3D adventure, pressing mobile Back opens the Trainer Menu & Settings
        // (matching desktop ESC) instead of accidentally abandoning the run!
        sound.play('cursor');
        onOpenPokemonManager('menu', true);
        return true;
      }
      return false;
    };
    onRegisterBackHandler(handler);
    return () => onRegisterBackHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onRegisterBackHandler,
    phase,
    hubModal,
    profileOpen,
    squadEditorOpen,
    shopOpen,
    inRunTownShopOpen,
    resultSummary,
    pet.id,
  ]);

  // =========================================================================
  // HIGH-CRAFT PIXEL-TEXTURED STEPPED VOXEL-TERRACED 3D WORLD ENGINE
  // =========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const pal = BIOME_PALETTES[selectedBiome];
    const tex = getBiomeTextures(selectedBiome);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const initW = Math.max(1, container.clientWidth || window.innerWidth);
    const initH = Math.max(1, container.clientHeight || window.innerHeight);
    const maxDpr = prefsRef.current.powerSaver
      ? 1.0
      : prefsRef.current.graphicsQuality === 'low'
        ? 1.0
        : prefsRef.current.graphicsQuality === 'medium'
          ? 1.35
          : 2.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(initW, initH, false);
    const enableShadows = !prefsRef.current.powerSaver;
    renderer.shadowMap.enabled = enableShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(pal.skyHex);
    scene.fog = new THREE.Fog(pal.fogHex, 64, 720);

    const camera = new THREE.PerspectiveCamera(64, initW / initH, 0.5, 22000);
    camera.position.set(0, 4.8, 10.5);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if(w<=0||h<=0)return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);
    const canvasResizeObserver=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(onResize);
    canvasResizeObserver?.observe(container);

    // Rich HD-2D Sunlit 3D Lighting with Real-Time Directional Building & Bridge Shadows (Zero PointLight fragment overhead = locked 60fps!)
    const hemi = new THREE.HemisphereLight(pal.ambientHex, 0x3b7a42, 1.18);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(pal.sunHex, 1.24);
    sun.position.set(34, 50, 28);
    if (enableShadows) {
      const smSize = prefsRef.current.graphicsQuality === 'low' ? 1024 : 1536;
      sun.castShadow = true;
      sun.shadow.mapSize.set(smSize, smSize);
      sun.shadow.camera.near = 6;
      sun.shadow.camera.far = 165;
      sun.shadow.camera.left = -74;
      sun.shadow.camera.right = 74;
      sun.shadow.camera.top = 74;
      sun.shadow.camera.bottom = -74;
      sun.shadow.bias = -0.0008;
      sun.shadow.normalBias = 0.045;
    }
    scene.add(sun);
    scene.add(sun.target);

    // 0. 360° Sunny Sky + Pixel Clouds + Layered Distant Mountain Skyline Ring!
    const horizonBackdrop = createHorizonBackdropMesh(selectedBiome);
    scene.add(horizonBackdrop);

    // 1. 3-RING NESTED CLIPMAP TERRAIN LOD (Fine 544u + Mid 4,400u/44km + Far 18,000u/180km = grand 1:10 horizons at 60fps!)
    const TERRAIN_SIZE = 544;
    const TERRAIN_SEGS = prefsRef.current.graphicsQuality === 'low' ? 84 : 112;
    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainPosAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
    const unregisterRoadTerrainGrid=setRoadTerrainGrid({originX:terrainPosAttr.getX(0),originZ:terrainPosAttr.getZ(0),stepX:terrainPosAttr.getX(1)-terrainPosAttr.getX(0),stepZ:terrainPosAttr.getZ(TERRAIN_SEGS+1)-terrainPosAttr.getZ(0)});
    const terrainMat = createSculptedTerrainMaterial(selectedBiome, tex, WORLD_SECTOR_SIZE);
    const initAtm = getWeatherAtmosphereProfile(
      liveWeatherRef.current.kind,
      liveWeatherRef.current.intensity,
      liveWeatherRef.current.tempC,
    );
    syncTerrainGeoUniforms3D(
      terrainMat,
      adventureStyleRef.current !== 'vampire_rogue',
      initAtm.snowCover,
      {
        wetness: initAtm.wetness,
        lightScale: initAtm.groundLightScale,
        hailSpecks: initAtm.hailSpecks,
        heatDry: initAtm.heatDry,
        timeSec: 0,
      },
    );
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    const midSegs = prefsRef.current.graphicsQuality === 'low' ? 64 : 88;
    const midTerrainGeo = new THREE.PlaneGeometry(4400, 4400, midSegs, midSegs);
    midTerrainGeo.rotateX(-Math.PI / 2);
    const midTerrainMesh = new THREE.Mesh(midTerrainGeo, terrainMat);
    scene.add(midTerrainMesh);

    const farSegs = prefsRef.current.graphicsQuality === 'low' ? 72 : 96;
    const farTerrainGeo = new THREE.PlaneGeometry(18000, 18000, farSegs, farSegs);
    farTerrainGeo.rotateX(-Math.PI / 2);
    const farTerrainMesh = new THREE.Mesh(farTerrainGeo, terrainMat);
    scene.add(farTerrainMesh);

    // 1B. Terrain-Clipped Organic Water Sheet (Near 544u + Far 18,000u/180km Ocean/Lake Horizon Sheet!)
    const waterMat = createPixelWaterMaterial(selectedBiome);
    const waterPlaneGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE);
    waterPlaneGeo.rotateX(-Math.PI / 2);
    const waterPlaneMesh = new THREE.Mesh(waterPlaneGeo, waterMat);
    waterPlaneMesh.position.set(0, WATER_LEVEL_3D, 0);
    scene.add(waterPlaneMesh);

    const farWaterGeo = new THREE.PlaneGeometry(18000, 18000);
    farWaterGeo.rotateX(-Math.PI / 2);
    const farWaterPlaneMesh = new THREE.Mesh(farWaterGeo, waterMat);
    farWaterPlaneMesh.position.set(0, WATER_LEVEL_3D - 0.12, 0);
    scene.add(farWaterPlaneMesh);

    const floatingLilyPads = new Set<{ mesh: THREE.Mesh; baseY: number; phase: number }>();
    const lilyMat = createWeatherFloraMaterial3D(tex.lilyPad, 0.15);
    const lotusMat = createWeatherFloraMaterial3D(tex.lilyLotus, 0.15);
    const cattailMat = createWeatherFloraMaterial3D(tex.cattail, 0.15);
    const lilyGeo = new THREE.PlaneGeometry(1, 1);
    lilyGeo.rotateX(-Math.PI / 2);

    // Sparkling Surf Mount Aura Ring under Hero when riding a Water-type Pokémon across Rivers & Lakes!
    const surfRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.48, 24),
      new THREE.MeshBasicMaterial({
        color: 0x74c0fc,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    surfRingMesh.rotation.x = -Math.PI / 2;
    surfRingMesh.visible = false;
    scene.add(surfRingMesh);

    const chunkState = { x: 99999, z: 99999 };

    // 2. Rich Organic Pixel-Art Flora, Toadstool Mushrooms, Flowers, Bushes & Tapered Pixel Trees!
    // Uses Shared Upright Y-Billboard MeshBasicMaterials (authentic 3D top-down foreshortening!) + 2-Tier LOD Streaming + Far Culling!
    const floraGroup = new THREE.Group();
    scene.add(floraGroup);

    // 2B. Real-Earth Metropolis at Active GPS City Origin (0, 0) (or Procedural Cities fallback)!
    clearTerrainHeightCache3D();
    const townsGroup = new THREE.Group();
    scene.add(townsGroup);
    const activeGeoNow = getActiveGeoTerrainOrigin();
    let geoHighwayStreamer: ReturnType<typeof createInterCityHighwayStreamer3D> | null = null;
    if (!activeGeoNow) {
      const roadNetGroup = buildInterTownRoadNetwork3D(
        (x, z) => getTerrainHeight3D(x, z),
        (x, z) => getRawNaturalTerrainHeight3D(x, z),
      );
      townsGroup.add(roadNetGroup);
    } else {
      geoHighwayStreamer = createInterCityHighwayStreamer3D({
        scene,
        getGroundHeight: (x, z) => getTerrainHeight3D(x, z),
      });
      geoHighwayStreamer.updateAround(0, 0, true);
    }
    const mountedGeoCityIds = new Set<string>();
    const townSpecs = activeGeoNow
      ? [
          {
            id: `geo_city_${activeGeoNow.startCityId ?? 'shanghai'}`,
            name: activeGeoNow.startCityName || '上海市',
            x: 0,
            z: 0,
            seed: hashCitySeed(activeGeoNow.startCityId ?? 'shanghai'),
            plazaRadius: 185,
            plateauY: 1.65,
            landmarkCityId: activeGeoNow.startCityId ?? 'shanghai',
          },
        ]
      : WORLD_TOWNS_3D;
    if (activeGeoNow) {
      mountedGeoCityIds.add(activeGeoNow.startCityId ?? 'shanghai');
    }
    const activeTownLayoutSpecs = [...townSpecs];
    // Register active city streets & rails BEFORE building 3D meshes so terrain roadbeds grade 100% flat!
    registerActiveTownRoadLayouts3D(activeTownLayoutSpecs);
    let urbanSyncX=Infinity,urbanSyncZ=Infinity;
    const syncUrbanAt=(x:number,z:number,force=false)=>{if(!force&&Math.hypot(x-urbanSyncX,z-urbanSyncZ)<128)return;urbanSyncX=x;urbanSyncZ=z;syncUrbanTerrainUniforms3D(terrainMat,getUrbanRegions3D(),x,z)};
    syncUrbanAt(0,0,true);
    if (geoHighwayStreamer) {
      geoHighwayStreamer.updateAround(0, 0, true);
    }
    const proceduralTowns: ProceduralTownInstance[] = townSpecs.map((spec) => {
      const t = buildProceduralTown3D(
        spec.id,
        spec.x,
        spec.z,
        spec.seed,
        (x, z) => getTerrainHeight3D(x, z),
        spec.name,
        spec.plazaRadius,
        spec.landmarkCityId,
      );
      townsGroup.add(t.group);
      return t;
    });
    const syncUpperFloors = () => {
      setWalkableBuildingFloorZones3D(proceduralTowns.flatMap((t) => t.upperFloorZones));
    };
    const getBuildingPortals = (): AutoNavBuildingPortalInfo[] =>
      proceduralTowns.flatMap((t) =>
        t.interiors.map((b) => ({
          id: b.id,
          cx: b.cx,
          cz: b.cz,
          halfW: b.halfW,
          halfD: b.halfD,
          rotY: b.rotY,
          dualDoors: b.dualDoors,
        })),
      );
    syncUpperFloors();
    const activeTownIdRef = { current: null as string | null };
    const persistState = { lastAt: 0 };
    const isInsideAnyTownPlaza = (wx: number, wz: number, pad = 2.5) =>
      proceduralTowns.some((t) => Math.hypot(wx - t.centerX, wz - t.centerZ) < t.safeRadius + pad);

    // 2B-Nav. 3D Golden Breadcrumb Trail & Destination Beacon for 1-Click A* Auto-Pathfinding!
    const autoNavTrailGroup = new THREE.Group();
    autoNavTrailGroup.visible = false;
    scene.add(autoNavTrailGroup);
    const autoNavLineMat = new THREE.LineBasicMaterial({
      color: 0xffd43b,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
    const autoNavLineGeo = new THREE.BufferGeometry();
    const autoNavLine = new THREE.Line(autoNavLineGeo, autoNavLineMat);
    autoNavLine.renderOrder = 26;
    autoNavTrailGroup.add(autoNavLine);
    const autoNavBeaconRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.92, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffd43b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
      }),
    );
    autoNavBeaconRing.rotation.x = -Math.PI / 2;
    autoNavBeaconRing.renderOrder = 26;
    autoNavTrailGroup.add(autoNavBeaconRing);

    const rebuildAutoNavTrailVisuals = (fromX: number, fromZ: number, waypoints: AutoNavWaypoint[], fromIdx: number) => {
      const pts: THREE.Vector3[] = [
        new THREE.Vector3(fromX, getWalkableSurfaceHeight3D(fromX, fromZ) + 0.26, fromZ),
      ];
      for (let wi = fromIdx; wi < waypoints.length; wi++) {
        const wp = waypoints[wi];
        const prev = pts[pts.length - 1];
        const segDist = Math.hypot(wp.x - prev.x, wp.z - prev.z);
        const subSteps = Math.max(1, Math.min(24, Math.ceil(segDist / 3.5)));
        for (let s = 1; s <= subSteps; s++) {
          const t = s / subSteps;
          const ix = prev.x + (wp.x - prev.x) * t;
          const iz = prev.z + (wp.z - prev.z) * t;
          pts.push(new THREE.Vector3(ix, getWalkableSurfaceHeight3D(ix, iz) + 0.26, iz));
        }
      }
      autoNavLineGeo.setFromPoints(pts);
      const goalWp = waypoints[waypoints.length - 1];
      if (goalWp) {
        autoNavBeaconRing.position.set(
          goalWp.x,
          getWalkableSurfaceHeight3D(goalWp.x, goalWp.z) + 0.24,
          goalWp.z,
        );
      }
      autoNavTrailGroup.visible = pts.length >= 2;
    };

    const syncAutoNavTargets = () => {
      const items: AutoNavTargetItem[] = [];
      const iconByKind: Record<string, { icon: string; sub: string; order: number }> = {
        pokemon_center: { icon: '/sprites/items/potion.png', sub: '室内 · 乔伊恢复柜台', order: 1 },
        poke_mart: { icon: '/sprites/items/poke-ball.png', sub: '室内 · 四层货架超市收银台', order: 2 },
        hotel_desk: { icon: '/sprites/items/luxury-ball.png', sub: '室内 · 前台办理房卡入住', order: 3 },
        hotel_rest: { icon: '/sprites/items/luxury-ball.png', sub: '室内 · 豪华休息大厅', order: 3 },
        restaurant: { icon: '/sprites/items/sitrus-berry.png', sub: '室内 · 树果料理吧台', order: 4 },
        city_bus_stop: { icon: '/sprites/items/town-map.png', sub: '室外 · 市内公交与城际巴士站', order: 5 },
        transit_station: { icon: '/sprites/items/vs-seeker.png', sub: '城郊 · 虹桥高铁站枢纽', order: 6 },
        npc_chat: { icon: '/sprites/items/poke-radar.png', sub: '街区居民交谈点', order: 7 },
      };
      for (const town of proceduralTowns) {
        for (const pt of town.interactPoints) {
          // Skip generic NPC chat points, interactive doors & upstairs locked beds in city-wide Auto-Nav list
          if (
            pt.kind === 'npc_chat' ||
            pt.kind === 'building_door' ||
            pt.kind === 'hotel_bed' ||
            pt.id.includes('suite_bed')
          ) {
            continue;
          }
          const meta = iconByKind[pt.kind] ?? { icon: '/sprites/items/poke-ball.png', sub: town.name, order: 8 };
          items.push({
            id: pt.id,
            label: pt.label,
            subLabel: pt.kind === 'city_bus_stop' && pt.hint ? pt.hint : `${town.name} · ${meta.sub}`,
            icon: meta.icon,
            x: pt.x,
            z: pt.z,
          });
        }
        const houses = town.interiors.filter((b) => b.kind === 'house').slice(0, 3);
        houses.forEach((h, hi) => {
          const foyerX = h.cx + Math.sin(h.rotY) * (h.halfD * 0.28);
          const foyerZ = h.cz + Math.cos(h.rotY) * (h.halfD * 0.28);
          items.push({
            id: `nav_house_${town.id}_${h.id}`,
            label: `🏠 ${h.name || `${town.name}·训练家公寓 ${hi + 1}号`}`,
            subLabel: '可步入精装四区公寓室内',
            icon: '/sprites/items/soothe-bell.png',
            x: foyerX,
            z: foyerZ,
          });
        });
      }
      // Also surface active city's Outer-Ring Inter-City Highway Portals (`出城立交口`) so players can walk straight onto inter-city roads!
      const hwyNet = getCompiledInterCityNetwork();
      if (hwyNet) {
        const startId = activeGeoNow?.startCityId ?? 'shanghai';
        for (const p of hwyNet.exitPortals) {
          if (p.cityId !== startId) continue;
          items.push({
            id: `nav_${p.id}`,
            label: `🛣️ ${p.highwayLabel}出城口（往${p.destCityName}）`,
            subLabel: `顺着市内主干道直通${p.destCityName}（约 ${p.distKm}km）`,
            icon: '/sprites/items/town-map.png',
            x: p.x,
            z: p.z,
          });
        }
      }
      const priorityOf = (id: string) =>
        id.includes('center')
          ? 1
          : id.includes('mart')
            ? 2
            : id.includes('hotel')
              ? 3
              : id.includes('rest')
                ? 4
                : id.includes('house')
                  ? 5
                  : id.includes('station')
                    ? 6
                    : id.includes('plaza')
                      ? 7
                      : 8;
      items.sort((a, b) => priorityOf(a.id) - priorityOf(b.id));
      setAutoNavTargets(items);
    };
    syncAutoNavTargets();

    const formatNavMeterDist = (dM: number) =>
      dM < 1000
        ? `${Math.max(1, Math.round(dM))} m`
        : dM < 10000
          ? `${(dM / 1000).toFixed(2)} km`
          : dM < 100000
            ? `${(dM / 1000).toFixed(1)} km`
            : `${Math.round(dM / 1000)} km`;

    const getCurrentGearBaseSpeed = () => {
      const r = rideModeRef.current;
      if (r === 'jet') return 320;
      if (r === 'fly') return 115;
      if (r === 'dash') return 38;
      return keysRef.current.has('shift') ? 22 : 8.2;
    };

    stopAutoNavRef.current = (silent = false) => {
      if (autoNavRef.current) {
        autoNavRef.current = null;
        setAutoNavActiveLabel(null);
        setAutoNavDistM(null);
        setAutoNavEtaSec(null);
        autoNavTrailGroup.visible = false;
        if (!silent) {
          sound.play('cancel');
          showBanner('🧭 已停止自动寻路', 1500);
        }
      }
    };

    startAutoNavRef.current = ({ label, x, z }) => {
      const curSim = simRef.current;
      if (!curSim) return;
      const allCols = proceduralTowns.flatMap((t) => t.colliders);
      const portals = getBuildingPortals();
      const canSurf = curSim.followers.some((f) => SPECIES_CATALOG[f.species].element === 'water');
      // 1. Instant `< 0.15ms` macro-heading kickoff so protagonist starts walking on Frame 1!
      const kickoffWaypoints = computeInstantKickoffWaypoints3D(
        curSim.px,
        curSim.pz,
        x,
        z,
        allCols,
        canSurf,
        portals,
      );
      // 2. Frame-budgeted (`2.2ms/frame`) detailed A* job refines obstacles/doorways/bridges in the background!
      const planningJob = createAutoWalkPathJob3D(
        curSim.px,
        curSim.pz,
        x,
        z,
        allCols,
        canSurf,
        portals,
      );
      autoNavRef.current = {
        label,
        goalX: x,
        goalZ: z,
        waypoints: kickoffWaypoints,
        idx: 0,
        stuckTimer: 0,
        lastCheckX: curSim.px,
        lastCheckZ: curSim.pz,
        planningJob,
        hasRemainingHorizon: false,
      };
      const rawWorldDist = Math.hypot(x - curSim.px, z - curSim.pz);
      const metersPerUnit = getActiveGeoTerrainOrigin() ? 1000 / GEO_UNITS_PER_KM : 1;
      const initDistM = Math.max(1, Math.round(rawWorldDist * metersPerUnit));
      const curSpd = Math.max(1, getCurrentGearBaseSpeed() * curSim.speedMult);
      const initEtaSec = Math.max(1, Math.ceil(rawWorldDist / curSpd));
      lastNavDistSyncMsRef.current = performance.now();
      setAutoNavDistM(initDistM);
      setAutoNavEtaSec(initEtaSec);
      setAutoNavActiveLabel(`${label} · 路线规划中…`);
      rebuildAutoNavTrailVisuals(curSim.px, curSim.pz, kickoffWaypoints, 0);
      showBanner(`🧭 已出发前往「${label}」· 距目标 ${formatNavMeterDist(initDistM)}（按 WASD 可随时接管）`, 2400);
    };

    // 2C. Rich HD-2D 3D Weather Visuals (680 Slanted Rain Streaks, Ground Splashes, Snow, Bouncing Hail & Forked Storm Lightning!)
    const weatherVisuals3D = createWeatherVisuals3D(scene);
    let windClock = 0;
    const { syncFloraBillboards, worldInteractNodes, placedFloraCells, updateWorldAround, refreshUrbanFlora } = createArenaFloraStreamer3D({ chunkState, cattailMat, farTerrainGeo, farTerrainMesh, farWaterPlaneMesh, floatingLilyPads, floraGroup, isInsideAnyTownPlaza, lilyGeo, lilyMat, lotusMat, midTerrainGeo, midTerrainMesh, prefsRef, selectedBiome, terrainGeo, terrainMesh, terrainPosAttr, tex, waterPlaneMesh });
    // 4. 3D Roadside Safe Zones (Boxy placeholder buildings temporarily removed pending custom pixel-art redesign!)
    const safeZoneMeshes = new Map<string, { group: THREE.Group; ring: THREE.Mesh }>();
    const syncSafeZones3D = (_cx: number, _cz: number) => {
      void createSafeZone3DMesh;
      void safeZoneMeshes;
    };

    // 5. High-Craft 48x56 Animated 4-Direction x 5-Pose Upright Y-Billboard Hero (Switchable Red/Misty/Brock/Blue!)
    const heroFrames = getHeroSpriteFrames(metaRef.current.activeHero);
    const playerSpriteMat = new THREE.MeshBasicMaterial({
      map: heroFrames.down_idle0 ?? heroFrames.down_0,
      transparent: true,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
    });
    const playerSprite = new THREE.Mesh(UPRIGHT_QUAD_GEO, playerSpriteMat);
    playerSprite.rotation.order = 'YXZ';
    playerSprite.scale.set(2.55, 2.85, 1);
    playerSprite.position.set(0, -0.04, 0);
    scene.add(playerSprite);
    const playerShadow = new THREE.Mesh(UNIT_SHADOW_GEO, SHARED_ENTITY_SHADOW_MAT);
    playerShadow.scale.setScalar(0.66);
    playerShadow.rotation.x = -Math.PI / 2;
    scene.add(playerShadow);

    // Initialize Active Simulation State (Integrating Lab Upgrades + Active Hero + Pet Enhance/Pinned Skills!)
    const mb = metaBonusesRef.current;
    setRerollsLeft(1 + mb.rerolls);
    setBanishMode(false);
    banishedIdsRef.current.clear();

    const stats = computeBattleStats(pet);
    const petEnhMult = 1 + (pet.enhanceLevel ?? 0) * 0.08;
    const maxHp = Math.max(130, Math.round(stats.maxHp * 1.6 * petEnhMult + mb.maxHpFlat));
    const startHp = Math.max(60, Math.round((pet.health / 100) * maxHp));
    // Use the currently selected Saved Battle Squad Preset (non-sleeping Pokémon only!)
    const presetIds = activeSquadPreset.petIds;
    const presetAwake = presetIds
      .map((id) => save.pets.find((p) => p.id === id))
      .filter((p): p is PetRecord => p !== undefined && !p.isSleeping);
    const awakePets =
      presetAwake.length > 0
        ? presetAwake
        : [pet, ...save.pets.filter((p) => p.id !== pet.id)].filter((p) => !p.isSleeping);
    const squadSource = (awakePets.length > 0 ? awakePets : [pet]).slice(0, maxFollowersRef.current);
    const initialFollowers: ActiveFollower[] = [];
    squadSource.forEach((p, idx) => {
      const metaSp = SPECIES_CATALOG[p.species];
      const stage = getGrowthStage(p.level, p.species);
      const ang = (idx * Math.PI * 2) / squadSource.length + 0.5;
      const fx = Math.cos(ang) * 2.9;
      const fz = Math.sin(ang) * 2.9;
      const defaults = getDefaultSkillsForElement(metaSp.element);
      const banned = new Set(p.bannedSkills ?? []);
      const pinned = (p.pinnedSkills ?? []).filter((s): s is SurvivorSkillId => s in SURVIVOR_SKILLS);
      const fallbackPool: SurvivorSkillId[] = ['thunderbolt', 'swift_volley', 'fireball', 'water_pulse', 'heal_bell'];
      const fourSkills: SurvivorSkillId[] = [];
      for (const s of [...pinned, ...defaults, ...fallbackPool]) {
        if (fourSkills.length >= 4) break;
        if (!banned.has(s) && !fourSkills.includes(s)) fourSkills.push(s);
      }
      while (fourSkills.length < 4) fourSkills.push(defaults[fourSkills.length % defaults.length]);
      const f: ActiveFollower = {
        id: `box_${p.id}`,
        sourcePetId: p.id,
        species: p.species,
        name: p.name,
        stage,
        level: 1,
        skin: p.skin,
        skills: fourSkills,
        x: fx,
        y: getTerrainHeight3D(fx, fz),
        z: fz,
        vx: 0,
        vz: 0,
        wanderX: Math.cos(ang) * 3.1,
        wanderZ: Math.sin(ang) * 3.1,
        wanderTimer: 0.7 + idx * 0.55,
        castAnim: 0,
        animTime: idx * 0.35,
        damageDealt: 0,
        kills: 0,
        casts: 0,
        cds: [0.25 + idx * 0.1, 0.85 + idx * 0.12, 1.45 + idx * 0.12, 2.05 + idx * 0.12],
        orbitAngle: ang,
        facingLeft: false,
      };
      initialFollowers.push(f);
      attachFollowerMeshes(f);
    });

    // Resume the player's exact last saved world coordinates (`lat, lng` / `x, z`) in BOTH Hub preview AND Playing!
    let startPx = -22;
    let startPz = 12;
    let startFacing = 0;
    const hasInitialWaterSurfer = initialFollowers.some(
      (f) => SPECIES_CATALOG[f.species].element === 'water',
    );
    {
      const cp = loadWorldCheckpoint();
      const geoOrigin = getActiveGeoTerrainOrigin();
      if (cp) {
        if (geoOrigin && cp.mode === 'geo') {
          if (cp.lat !== undefined && cp.lng !== undefined) {
            prefetchGeoDetailAround(cp.lat, cp.lng);
            const wp = geoToWorld(cp.lat, cp.lng, geoOrigin);
            if (wp) {
              startPx = wp.x;
              startPz = wp.z;
              startFacing = cp.facingAngle;
            }
          } else if (cp.cityId === (geoOrigin.startCityId ?? 'shanghai')) {
            startPx = cp.x;
            startPz = cp.z;
            startFacing = cp.facingAngle;
          }
        } else if (!geoOrigin && cp.mode === 'procedural') {
          startPx = cp.x;
          startPz = cp.z;
          startFacing = cp.facingAngle;
        }
      }
    }
    // Guarantee spawn is not trapped inside a solid building wall or deep water without a Water surfer (preserves bridges, highways & hills!)
    const isSafeDrySpawn = (cxTest: number, czTest: number) => {
      const walkSurfY = getWalkableSurfaceHeight3D(cxTest, czTest);
      if (!hasInitialWaterSurfer && walkSurfY < WATER_LEVEL_3D + 0.05) return false;
      for (const t of proceduralTowns) {
        if (Math.hypot(cxTest - t.centerX, czTest - t.centerZ) > t.safeRadius + 60) continue;
        const probe = { x: cxTest, z: czTest };
        resolveTownWallCollisions(probe, 1.1, t.colliders);
        if (Math.hypot(probe.x - cxTest, probe.z - czTest) > 0.06) return false;
      }
      return true;
    };
    if (!isSafeDrySpawn(startPx, startPz)) {
      let rescued = false;
      for (let rad = 6; rad <= 120 && !rescued; rad += 8) {
        for (let ai = 0; ai < 16; ai++) {
          const ang = (ai / 16) * Math.PI * 2;
          const candX = startPx + Math.cos(ang) * rad;
          const candZ = startPz + Math.sin(ang) * rad;
          if (isSafeDrySpawn(candX, candZ)) {
            startPx = candX;
            startPz = candZ;
            rescued = true;
            break;
          }
        }
      }
    }
    const startPy = Math.max(WATER_LEVEL_3D + 0.12, getWalkableSurfaceHeight3D(startPx, startPz));
    const { emoteKinds, heroEmoteSprite, petEmoteSprite, previewSprites } = setupHubWildlifeDiorama3D({
      anchorX: startPx,
      anchorZ: startPz,
      createSpriteEntity,
      phase,
      regionMeta,
      scene,
    });
    playerSprite.position.set(startPx, startPy - 0.04, startPz);
    playerShadow.position.set(startPx, startPy + 0.06, startPz);
    camPivotRef.current.set(startPx, startPy + 1.52, startPz);
    initialFollowers.forEach((f, idx) => {
      const ang = (idx * Math.PI * 2) / Math.max(1, initialFollowers.length) + 0.6;
      f.x = startPx + Math.cos(ang) * 2.4;
      f.z = startPz + Math.sin(ang) * 2.4;
      f.y = Math.max(WATER_LEVEL_3D + 0.12, getWalkableSurfaceHeight3D(f.x, f.z));
      f.sprite?.position.set(f.x, f.y - 0.04, f.z);
      f.shadow?.position.set(f.x, f.y + 0.06, f.z);
    });
    if (phase === 'playing') {
      updatePhysicalCameraRig3D({
        camera,
        pivot: camPivotRef.current,
        orbit: camOrbitRef.current,
        smooth: camSmoothRef.current,
        mode: camFollowModeRef.current,
        px: startPx,
        py: startPy,
        pz: startPz,
        worldMx: 0,
        worldMz: 0,
        mLen: 0,
        mzInput: 0,
        isDragging: false,
        pointerLocked: false,
        autoNavActive: false,
        occludeTown: proceduralTowns[0] ?? null,
        activeInterior: null,
        shakeAmp: 0,
        dt: 0.016,
      });
    }

    simRef.current = {
      px: startPx,
      py: startPy,
      pz: startPz,
      vy: 0,
      facingAngle: startFacing,
      walkDist: 0,
      hp: startHp,
      maxHp,
      invuln: 0,
      xp: 0,
      xpNeed: 18,
      runLevel: 1,
      kills: 0,
      coins: 0,
      totalDamage: 0,
      elapsed: 0,
      speedMult: (pet.accessory === 'scarf' || pet.accessory === 'quick_claw' ? 1.15 : 1.0) * mb.speedMult,
      pickupRadius: 4.8 + mb.pickupAdd,
      cdMult: mb.cdMult,
      atkMult: (pet.accessory === 'life_orb' ? 1.25 : 1.0) * mb.dmgMult * petEnhMult,
      greedMult: (pet.accessory === 'amulet_coin' ? 1.35 : 1.0) * diffMeta.rewardMult * mb.coinMult,
      baseAtk: stats.atk,
      salvoTimer: 1.35,
      followers: initialFollowers,
      enemies: [],
      projectiles: [],
      loots: [],
      vfxs: [],
      activeCaptures: [],
      actionCds: { ball: 0, heal: 0, boost: 0, salvo: 0 },
      healCharges: 3 + mb.extraHealCharges + Math.min(3, (save.inventory?.oran_berry ?? 0) + (save.inventory?.sitrus_berry ?? 0)),
      revivesLeft: mb.revives,
      boostTimer: 0,
      timers: { spawn: 0.55, trainer: 20, safeHealCd: 0, hudSync: 0 },
      trainerWaveIdx: 0,
      trainersDefeated: 0,
      capturedBoss: null,
      storyBossSpawned: false,
      endlessBossTimer: 180,
      wildStaySec: 0,
      wildZoneAnchorX: startPx,
      wildZoneAnchorZ: startPz,
      guardianWaveCount: 0,
      nextId: 1,
      dmgPops: [],
    };
    syncFollowersView();
    updateWorldAround(startPx, startPz);
    const unregisterRenderedTerrain=setRenderedTerrainSampler(createRenderedTerrainSampler(terrainPosAttr,terrainMesh));
    geoHighwayStreamer?.updateAround(startPx, startPz, true);

    // When real-Earth NASA/SRTM DEM elevation tiles finish streaming, rebuild coast-clipped coastal city AT MOST ONCE (and never tear down all flora meshes!)
    const startCityClean = activeGeoNow?.startCityId ?? 'shanghai';
    const hadLocalDemAtBuild = activeGeoNow
      ? hasLocalDemCoverage(activeGeoNow.originLat, activeGeoNow.originLng) || startCityClean === 'shanghai'
      : true;
    let rebuiltCoastClippedTown = hadLocalDemAtBuild;
    const unsubGeoDem = subscribeGeoDemLoaded(() => {
      const needsCoastRebuild=Boolean(
        !rebuiltCoastClippedTown &&
        activeGeoNow &&
        hasLocalDemCoverage(activeGeoNow.originLat, activeGeoNow.originLng)
      );
      if(needsCoastRebuild){
        rebuiltCoastClippedTown = true;
        clearTownLayoutCache();
      }
      // Building platforms depend on local elevations, so re-evaluate their
      // mode and height when DEM data changes before rebuilding any meshes.
      const foundationsChanged=registerActiveTownRoadLayouts3D(activeTownLayoutSpecs);
      refreshUrbanFlora();
      syncUrbanAt(simRef.current?.px??0,simRef.current?.pz??0,true);
      if(needsCoastRebuild||foundationsChanged){
        for (const oldT of proceduralTowns) {
          oldT.disposeRoadKit?.();
          townsGroup.remove(oldT.group);
        }
        proceduralTowns.length = 0;
        for (const spec of activeTownLayoutSpecs) {
          const rebuilt = buildProceduralTown3D(
            spec.id,
            spec.x,
            spec.z,
            spec.seed,
            (x, z) => getTerrainHeight3D(x, z),
            spec.name,
            spec.plazaRadius,
            spec.landmarkCityId,
          );
          townsGroup.add(rebuilt.group);
          proceduralTowns.push(rebuilt);
        }
        syncUpperFloors();
        syncAutoNavTargets();
        const curSimNow = simRef.current;
        if (curSimNow && !isSafeDrySpawn(curSimNow.px, curSimNow.pz)) {
          for (let rad = 10; rad <= 120; rad += 12) {
            let escaped = false;
            for (let ai = 0; ai < 16; ai++) {
              const ang = (ai / 16) * Math.PI * 2;
              const cxCand = curSimNow.px + Math.cos(ang) * rad;
              const czCand = curSimNow.pz + Math.sin(ang) * rad;
              if (isSafeDrySpawn(cxCand, czCand)) {
                curSimNow.px = cxCand;
                curSimNow.pz = czCand;
                escaped = true;
                break;
              }
            }
            if (escaped) break;
          }
        }
      } else {
        for (const town of proceduralTowns) {
          const newBaseY=getTerrainHeight3D(town.centerX, town.centerZ);
          town.group.position.y = newBaseY;
          town.refreshRoadKit?.(newBaseY,simRef.current?.px??0,simRef.current?.pz??0);
        }
      }
      // Re-seat existing flora Y heights in ~0.2ms instead of destroying & re-creating 2,200+ flora cells!
      for (const [, entry] of placedFloraCells) {
        for (const obj of entry.objs) {
          obj.position.y = getTerrainHeight3D(obj.position.x, obj.position.z) - 0.04;
        }
      }
      const curSim = simRef.current;
      chunkState.x = 999999;
      chunkState.z = 999999;
      if (curSim) {
        updateWorldAround(curSim.px, curSim.pz);
        geoHighwayStreamer?.updateAround(curSim.px, curSim.pz, true);
        const newFloor = getWalkableSurfaceHeight3D(curSim.px, curSim.pz, curSim.py);
        curSim.py = Math.max(WATER_LEVEL_3D - 0.15, newFloor);
        curSim.followers.forEach((f) => {
          f.y = Math.max(WATER_LEVEL_3D + 0.08, getWalkableSurfaceHeight3D(f.x, f.z, f.y));
        });
      } else {
        updateWorldAround(0, 0);
        geoHighwayStreamer?.updateAround(0, 0, true);
      }
    });
    syncSafeZones3D(0, 0);

    const { vfxAtlas, spawnPixelParticles, spawnGroundDecalWave, spawnGlowFlash, spawnSpriteBurst, spawnSkillProjectile3D, damageEnemy3D, pickTargetForFollower, fireSkill, spawnEnemy3D } = createArenaCombatActions3D({ activeWorldRun, adventureStyleRef, buildResultSummary, camOrbitRef, captureFinishRef, comboRef, createSpriteEntity, diffMeta, endedRef, gameMode, getPixelTexture, liveOverlandCityRef, liveWeatherRef, metaBonusesRef, metaRef, onUpdateMeta, pausedRef, pet, prefsRef, regionMeta, save, savePetsCountRef, scene, selectedBallIdRef, setCaptureCutscene, setNearbyKoTarget, setResultSummary, shakeRef, showBanner, simRef, solarInfoRef, tacticsRef, triggerBattleActionRef });

    startStreetDuelRef.current = ({ npcName, npcSprite, species, x, z }) => {
      const curSim = simRef.current;
      if (!curSim) return;
      const ang = Math.atan2(z - curSim.pz, x - curSim.px);
      const sx = curSim.px + Math.cos(ang) * 4.2;
      const sz = curSim.pz + Math.sin(ang) * 4.2;
      const duelHp = Math.round((185 + curSim.runLevel * 45) * diffMeta.enemyHpMult);
      const duelDmg = Math.round((14 + curSim.runLevel * 2) * diffMeta.enemyDmgMult);
      spawnEnemy3D(sx, sz, species, duelHp, 5.2, duelDmg, {
        isStreetDuel: true,
        trainerName: `${npcName}的搭档`,
        trainerSprite: npcSprite,
      });
      spawnGroundDecalWave(sx, curSim.py, sz, vfxAtlas.arcaneRingDecal, 4.2, 0.45);
      showBanner(`⚔️ 「${npcName}」接受了你的切磋请求！派出搭档宝可梦上场较量！`, 3400);
    };

    teleportGeoSpotRef.current = (spot) => {
      const curSim = simRef.current;
      const curOrg = getActiveGeoTerrainOrigin();
      if (!curSim || !curOrg) return;
      stopAutoNavRef.current(true);
      worldBubblesRef.current = [];
      setProjectedBubbles([]);
      for (let ei = curSim.enemies.length - 1; ei >= 0; ei--) {
        const en = curSim.enemies[ei];
        if (!en.isBoss) {
          if (en.sprite) scene.remove(en.sprite);
          if (en.shadow) scene.remove(en.shadow);
          if (en.auraRing) scene.remove(en.auraRing);
          curSim.enemies.splice(ei, 1);
        }
      }
      prefetchGeoDetailAround(spot.lat, spot.lng);
      const wp = geoToWorld(spot.lat, spot.lng, curOrg);
      if (!wp) return;
      const destX = wp.x;
      const destZ = wp.z;
      chunkState.x = 999999;
      chunkState.z = 999999;
      updateWorldAround(destX, destZ);
      geoHighwayStreamer?.updateAround(destX, destZ, true);
      const gy = Math.max(WATER_LEVEL_3D + 0.18, getWalkableSurfaceHeight3D(destX, destZ));
      curSim.px = destX;
      curSim.pz = destZ;
      curSim.py = gy;
      curSim.vy = 0;
      const faceFwdAngle = Math.atan2(-Math.sin(spot.yaw), -Math.cos(spot.yaw));
      curSim.facingAngle = faceFwdAngle;
      camOrbitRef.current.yaw = spot.yaw;
      camOrbitRef.current.pitch = spot.pitch ?? 0.17;
      camOrbitRef.current.zoom = 1.12;
      camPivotRef.current.set(destX, gy + 1.52, destZ);
      curSim.followers.forEach((f, idx) => {
        const side = idx % 2 === 0 ? 1 : -1;
        const row = Math.floor(idx / 2) + 1;
        f.x = destX + Math.cos(spot.yaw) * side * (1.5 + row * 0.4) + Math.sin(spot.yaw) * (row * 1.4);
        f.z = destZ - Math.sin(spot.yaw) * side * (1.5 + row * 0.4) + Math.cos(spot.yaw) * (row * 1.4);
        f.y = Math.max(WATER_LEVEL_3D + 0.15, getWalkableSurfaceHeight3D(f.x, f.z));
      });
      saveWorldCheckpoint({
        mode: 'geo',
        cityId: curOrg.startCityId ?? 'shanghai',
        cityName: spot.label,
        lat: spot.lat,
        lng: spot.lng,
        x: destX,
        z: destZ,
        facingAngle: faceFwdAngle,
        updatedAt: Date.now(),
      });
      sound.play('levelup');
      showBanner(`🛠️ [调试传送] 已前往「${spot.label}」（${spot.subLabel}）`, 3200);
    };

    // Developer-only console debug teleport hook (`window.__POKE_DEBUG_TELEPORT__(lat, lng, label)`)
    const winDebug = window as unknown as Record<string, unknown>;
    winDebug.__POKE_DEBUG_TELEPORT__ = (lat: number, lng: number, label = '调试坐标', yaw = 0, pitch = 0.2) => {
      teleportGeoSpotRef.current({
        id: 'debug_spot',
        label,
        subLabel: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
        lat,
        lng,
        yaw,
        pitch,
      });
    };

    returnToHubCityRef.current = (dest: 'plaza' | 'home') => {
      const curSim = simRef.current;
      if (!curSim) return;
      const curOrg = getActiveGeoTerrainOrigin();
      const hubTown = proceduralTowns[0] ?? null;
      const hubName = activeWorldRun?.cityName ?? curOrg?.startCityName ?? hubTown?.name ?? '主城';

      stopAutoNavRef.current(true);
      rideModeRef.current = 'walk';
      setRideMode('walk');
      worldBubblesRef.current = [];
      setProjectedBubbles([]);
      for (let ei = curSim.enemies.length - 1; ei >= 0; ei--) {
        const en = curSim.enemies[ei];
        if (!en.isBoss) {
          if (en.sprite) scene.remove(en.sprite);
          if (en.shadow) scene.remove(en.shadow);
          if (en.auraRing) scene.remove(en.auraRing);
          curSim.enemies.splice(ei, 1);
        }
      }

      let destX = hubTown ? hubTown.centerX - 18 : 0;
      let destZ = hubTown ? hubTown.centerZ + 12 : 0;
      let destY = 1.8;
      let faceAngle = 0;
      let camYaw = 0;
      let camPitch = 0.24;
      let camZoom = 1.0;

      const homeInt = dest === 'home' ? hubTown?.interiors.find((b) => b.kind === 'house') : undefined;
      if (dest === 'home' && homeInt) {
        // Place player right inside the warm furnished 1F living room of their active Hub City Duplex Home!
        destX = homeInt.cx + Math.sin(homeInt.rotY) * (homeInt.halfD * 0.24);
        destZ = homeInt.cz + Math.cos(homeInt.rotY) * (homeInt.halfD * 0.24);
        destY = homeInt.baseY + 0.16;
        faceAngle = homeInt.rotY + Math.PI;
        camYaw = homeInt.rotY;
        camPitch = 0.34;
        camZoom = 0.88;
      } else {
        const baseCx = hubTown ? hubTown.centerX : 0;
        const baseCz = hubTown ? hubTown.centerZ : 0;
        let foundSafe = isSafeDrySpawn(destX, destZ);
        if (!foundSafe) {
          for (let rad = 8; rad <= 96 && !foundSafe; rad += 10) {
            for (let ai = 0; ai < 16; ai++) {
              const ang = (ai / 16) * Math.PI * 2;
              const cxCand = baseCx + Math.cos(ang) * rad;
              const czCand = baseCz + Math.sin(ang) * rad;
              if (isSafeDrySpawn(cxCand, czCand)) {
                destX = cxCand;
                destZ = czCand;
                foundSafe = true;
                break;
              }
            }
          }
        }
        chunkState.x = 999999;
        chunkState.z = 999999;
        updateWorldAround(destX, destZ);
        geoHighwayStreamer?.updateAround(destX, destZ, true);
        destY = Math.max(WATER_LEVEL_3D + 0.18, getWalkableSurfaceHeight3D(destX, destZ));
        camYaw = -1.15;
        faceAngle = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
      }

      chunkState.x = 999999;
      chunkState.z = 999999;
      updateWorldAround(destX, destZ);
      geoHighwayStreamer?.updateAround(destX, destZ, true);

      curSim.px = destX;
      curSim.pz = destZ;
      curSim.py = destY;
      curSim.vy = 0;
      curSim.facingAngle = faceAngle;
      camOrbitRef.current.yaw = camYaw;
      camOrbitRef.current.pitch = camPitch;
      camOrbitRef.current.zoom = camZoom;
      camPivotRef.current.set(destX, destY + 1.52, destZ);

      curSim.followers.forEach((f, idx) => {
        const spread = dest === 'home' ? 1.15 : 1.8;
        const ang = (idx * Math.PI * 2) / Math.max(1, curSim.followers.length) + 0.5;
        f.x = destX + Math.cos(ang) * spread;
        f.z = destZ + Math.sin(ang) * spread;
        f.y = dest === 'home' ? destY : Math.max(WATER_LEVEL_3D + 0.15, getWalkableSurfaceHeight3D(f.x, f.z));
      });

      if (curOrg) {
        const g = worldToGeo(destX, destZ, curOrg);
        overlandCityIdRef.current = curOrg.startCityId;
        const originWorldCity = WORLD_CITIES.find((c) => c.id === curOrg.startCityId) ?? null;
        liveOverlandCityRef.current = originWorldCity;
        setLiveOverlandCity(originWorldCity);
        saveWorldCheckpoint({
          mode: 'geo',
          cityId: curOrg.startCityId ?? 'shanghai',
          cityName: hubName,
          lat: g?.lat ?? curOrg.originLat,
          lng: g?.lng ?? curOrg.originLng,
          x: destX,
          z: destZ,
          facingAngle: faceAngle,
          updatedAt: Date.now(),
        });
      } else {
        saveWorldCheckpoint({
          mode: 'procedural',
          cityId: hubTown?.id ?? 'pallet',
          cityName: hubName,
          x: destX,
          z: destZ,
          facingAngle: faceAngle,
          updatedAt: Date.now(),
        });
      }

      sound.play(dest === 'home' ? 'heal_jingle' : 'confirm');
      showBanner(
        dest === 'home'
          ? `🏠 已传送回主城「${hubName}」的家中！`
          : `🏙️ 已传送回主城「${hubName}」中心广场！`,
        2800,
      );
    };

    teleportDirectRef.current = (tx, tz, label) => {
      const curSim = simRef.current;
      if (!curSim) return;
      stopAutoNavRef.current(true);
      worldBubblesRef.current = [];
      setProjectedBubbles([]);
      const destGeo = worldToGeo(tx, tz);
      if (destGeo) {
        prefetchGeoDetailAround(destGeo.lat, destGeo.lng);
      }
      chunkState.x = 999999;
      chunkState.z = 999999;
      updateWorldAround(tx, tz);
      geoHighwayStreamer?.updateAround(tx, tz, true);
      const gy = Math.max(WATER_LEVEL_3D + 0.16, getWalkableSurfaceHeight3D(tx, tz));
      curSim.px = tx;
      curSim.pz = tz;
      curSim.py = gy;
      curSim.vy = 0;
      camPivotRef.current.set(tx, gy + 1.52, tz);
      curSim.followers.forEach((f, idx) => {
        const ang = (idx * Math.PI * 2) / Math.max(1, curSim.followers.length) + 0.4;
        f.x = tx + Math.cos(ang) * 1.85;
        f.z = tz + Math.sin(ang) * 1.85;
        f.y = Math.max(WATER_LEVEL_3D + 0.14, getWalkableSurfaceHeight3D(f.x, f.z));
      });
      const curOrg = getActiveGeoTerrainOrigin();
      saveWorldCheckpoint({
        mode: curOrg ? 'geo' : 'procedural',
        cityId: curOrg?.startCityId ?? 'shanghai',
        cityName: curOrg?.startCityName,
        lat: destGeo?.lat,
        lng: destGeo?.lng,
        x: tx,
        z: tz,
        facingAngle: curSim.facingAngle,
        updatedAt: Date.now(),
      });
      sound.play('levelup');
      showBanner(`⚡ 已传送至「${label}」`, 2200);
    };

    teleportIntraCityBusRef.current = (tx, tz, label) => {
      const curSim = simRef.current;
      if (!curSim) return;
      stopAutoNavRef.current(true);
      rideModeRef.current = 'walk';
      setRideMode('walk');
      let destX = tx;
      let destZ = tz;
      // If a non-bus-stop interior point was passed, snap to its nearest physical `city_bus_stop` first so EVERY ride ends at an actual 3D Bus Stop!
      let nearestStopPt: { x: number; z: number; label: string } | null = null;
      let nearestStopDist = Infinity;
      for (const t of proceduralTowns) {
        for (const pt of t.interactPoints) {
          if (pt.kind !== 'city_bus_stop') continue;
          const d = Math.hypot(pt.x - tx, pt.z - tz);
          if (d < nearestStopDist) {
            nearestStopDist = d;
            nearestStopPt = pt;
          }
        }
      }
      let finalStopLabel = label;
      if (nearestStopPt && nearestStopDist <= 140) {
        destX = nearestStopPt.x;
        destZ = nearestStopPt.z;
        finalStopLabel = nearestStopPt.label;
      }
      chunkState.x = 999999;
      chunkState.z = 999999;
      updateWorldAround(destX, destZ);
      geoHighwayStreamer?.updateAround(destX, destZ, true);
      const gy = Math.max(WATER_LEVEL_3D + 0.16, getWalkableSurfaceHeight3D(destX, destZ));
      curSim.px = destX;
      curSim.pz = destZ;
      curSim.py = gy;
      curSim.vy = 0;
      camPivotRef.current.set(destX, gy + 1.52, destZ);
      curSim.followers.forEach((f, idx) => {
        const ang = (idx * Math.PI * 2) / Math.max(1, curSim.followers.length) + 0.4;
        f.x = destX + Math.cos(ang) * 1.85;
        f.z = destZ + Math.sin(ang) * 1.85;
        f.y = Math.max(WATER_LEVEL_3D + 0.14, getWalkableSurfaceHeight3D(f.x, f.z));
      });
      const destGeo = worldToGeo(destX, destZ);
      const curOrg = getActiveGeoTerrainOrigin();
      saveWorldCheckpoint({
        mode: curOrg ? 'geo' : 'procedural',
        cityId: curOrg?.startCityId ?? 'shanghai',
        cityName: curOrg?.startCityName,
        lat: destGeo?.lat,
        lng: destGeo?.lng,
        x: destX,
        z: destZ,
        facingAngle: curSim.facingAngle,
        updatedAt: Date.now(),
      });
      sound.play('levelup');
      showBanner(`🚌 叮咚！公交已抵达「${finalStopLabel}」候车亭，站旁可随时乘车返程或换乘其他站点！`, 3200);
    };
    const buildLevelChoices = (): LevelChoice[] => {
      const sim = simRef.current;
      if (!sim) return [];
      const pool: LevelChoice[] = [];
      const pLv = passiveLevelsRef.current;

      // 1. 升级当前出战精灵（绝不在奖励里凭空获取新精灵）
      for (const f of sim.followers) {
        pool.push({
          kind: 'upgrade_follower',
          id: `up_${f.id}`,
          title: `${f.name} 升级 Lv.${f.level + 1}`,
          desc: '4 个技能威力、范围与弹幕数量全面提升！',
          sprite: SPECIES_CATALOG[f.species].stageSprites[f.stage].static,
          badge: `Lv.${f.level}→${f.level + 1}`,
          color: SURVIVOR_SKILLS[f.skills[0]].color,
          followerId: f.id,
        });
      }

      // 2. 获取 / 提升被动（首次为「新被动」，已有则逐级提升 Lv）
      const passiveDefs: {
        id: string;
        passiveId: NonNullable<LevelChoice['passiveId']>;
        title: string;
        desc: string;
        sprite: string;
        color: string;
      }[] = [
        {
          id: 'p_atk',
          passiveId: 'atk',
          title: '力量头带',
          desc: '全体出战精灵伤害 +20%（可叠加升级）',
          sprite: '/sprites/items/life-orb.png',
          color: '#ff5924',
        },
        {
          id: 'p_haste',
          passiveId: 'haste',
          title: '疾风护符',
          desc: '全体精灵技能冷却 -12%（攻速更快）',
          sprite: '/sprites/items/light-ball.png',
          color: '#f59f00',
        },
        {
          id: 'p_spd',
          passiveId: 'speed',
          title: '迅捷之靴',
          desc: '主角移速 +14% · 战利品吸取范围 +30%',
          sprite: '/sprites/items/choice-scarf.png',
          color: '#22b8cf',
        },
        {
          id: 'p_vit',
          passiveId: 'vitality',
          title: '元气护甲',
          desc: '最大 HP +22% 并立刻回复 35% 生命值',
          sprite: '/sprites/items/sitrus-berry.png',
          color: '#51cf66',
        },
        {
          id: 'p_greed',
          passiveId: 'greed',
          title: '护符招财',
          desc: '本局金币收益 +28% · 拾取磁力 +25%',
          sprite: '/sprites/items/amulet-coin.png',
          color: '#fab005',
        },
      ];
      for (const pd of passiveDefs) {
        const cur = pLv[pd.passiveId] ?? 0;
        pool.push({
          kind: 'passive',
          id: pd.id,
          title: cur > 0 ? `${pd.title} Lv.${cur + 1}` : pd.title,
          desc: pd.desc,
          sprite: pd.sprite,
          badge: cur > 0 ? `Lv.${cur}→${cur + 1}` : '新被动',
          color: pd.color,
          passiveId: pd.passiveId,
        });
      }

      // 3. 获取实战道具补给
      pool.push(
        {
          kind: 'item',
          id: 'it_potion',
          title: '好伤药补给箱',
          desc: '获得 +2 瓶实战好伤药，并立刻回复 30% HP！',
          sprite: '/sprites/items/super-potion.png',
          badge: '道具 +2',
          color: '#20c997',
          itemId: 'super_potion',
        },
        {
          kind: 'item',
          id: 'it_candy',
          title: '能量糖果罐',
          desc: '立刻触发 10 秒全队力量强化（攻击 +55%）并刷新冷却！',
          sprite: '/sprites/items/rare-candy.png',
          badge: '强化道具',
          color: '#7950f2',
          itemId: 'rare_candy_boost',
        },
        {
          kind: 'item',
          id: 'it_salvo',
          title: '全队战术充能仪',
          desc: '立刻重置「齐射」与「投球」冷却，随时爆发！',
          sprite: '/sprites/items/vs-seeker.png',
          badge: '战术道具',
          color: '#339af0',
          itemId: 'salvo_charge',
        },
        {
          kind: 'item',
          id: 'it_coins',
          title: '宝可币锦囊',
          desc: '立刻获得 +45 宝可币，并吸取全场掉落经验与金币！',
          sprite: '/sprites/items/amulet-coin.png',
          badge: '+45 币',
          color: '#f08c00',
          itemId: 'coin_pouch',
        },
      );

      const filtered = pool.filter((item) => !banishedIdsRef.current.has(item.id));
      const finalPool = filtered.length >= 3 ? filtered : pool;
      return [...finalPool].sort(() => Math.random() - 0.5).slice(0, 3);
    };
    rebuildChoicesRef.current = buildLevelChoices;

    let rafId = 0;
    let lastTs = performance.now();
    let lastRenderTs = performance.now();
    let fpsSmooth = 60;
    let lastSolarUiSyncMs = 0;
    const projVec = new THREE.Vector3();
    const tmpSkyCol = new THREE.Color();
    const tmpMidCol = new THREE.Color();
    const tmpHorCol = new THREE.Color();
    const tmpFogCol = new THREE.Color();
    const tmpFogSrgb = { r: 0.78, g: 0.91, b: 0.98 };
    const tmpCloudLit = new THREE.Color();
    const tmpCloudShade = new THREE.Color();
    const tmpOvercastCol = new THREE.Color();
    const tmpTempTintCol = new THREE.Color();
    const tmpFloraLightCol = new THREE.Color(1, 1, 1);
    let smoothSnowCover = initAtm.snowCover;
    let smoothWetness = initAtm.wetness;
    let smoothHailSpecks = initAtm.hailSpecks;
    let smoothHeatDry = initAtm.heatDry;
    let smoothGroundLight = initAtm.groundLightScale;
    let smoothWindSway = initAtm.windSwayMult;

    const applyLiveSolarAtmosphere = (
      lat: number,
      lng: number,
      focusX: number,
      focusY: number,
      focusZ: number,
      dtSec: number,
      nowMs: number,
    ) => {
      const solar = computeSolarDayNight(
        lat,
        lng,
        nowMs,
        prefsRef.current.worldTimeMode ?? 'auto',
      );
      solarInfoRef.current = solar;
      if (nowMs - lastSolarUiSyncMs > 1800) {
        lastSolarUiSyncMs = nowMs;
        setSolarInfo(solar);
        if (Math.abs(lat - activeSeasonLatRef.current) >= 1.5) {
          setActiveSeasonLat(lat);
        }
      }

      const wNow = liveWeatherRef.current;
      const atm = getWeatherAtmosphereProfile(wNow.kind, wNow.intensity, wNow.tempC);
      const wantSunInt = solar.sunIntensity * atm.sunDim;
      const wantHemiInt = solar.hemiIntensity * atm.hemiMult;
      const kLerp = Math.min(1, dtSec * 3.2);

      sun.intensity += (wantSunInt - sun.intensity) * kLerp;
      hemi.intensity += (wantHemiInt - hemi.intensity) * kLerp;
      tmpSkyCol.setHex(solar.sunHex);
      if (atm.tempTintStrength > 0.005) {
        tmpSkyCol.lerp(tmpTempTintCol.setHex(atm.tempTintHex), atm.tempTintStrength * 0.7);
      }
      sun.color.lerp(tmpSkyCol, kLerp);
      hemi.color.lerp(tmpSkyCol.setHex(solar.hemiSkyHex), kLerp);
      hemi.groundColor.lerp(tmpSkyCol.setHex(solar.hemiGroundHex), kLerp);

      tmpSkyCol.setHex(solar.skyHex);
      tmpHorCol.setHex(solar.horizonHex);
      tmpFogCol.setHex(solar.fogHex);

      if (atm.overcastTintStrength > 0.005) {
        const overcastNightScale = 0.28 + solar.daylightFactor * 0.72;
        tmpOvercastCol.setHex(atm.overcastTintHex).multiplyScalar(overcastNightScale);
        tmpSkyCol.lerp(tmpOvercastCol, atm.overcastTintStrength);
        tmpHorCol.lerp(tmpOvercastCol, atm.overcastTintStrength * 0.88);
        tmpFogCol.lerp(tmpOvercastCol, atm.overcastTintStrength * 0.80);
      }
      if (atm.tempTintStrength > 0.005) {
        tmpTempTintCol.setHex(atm.tempTintHex);
        tmpHorCol.lerp(tmpTempTintCol, atm.tempTintStrength * (0.45 + solar.daylightFactor * 0.55));
        tmpFogCol.lerp(tmpTempTintCol, atm.tempTintStrength * 0.55);
      }
      tmpMidCol.copy(tmpHorCol).lerp(tmpSkyCol, 0.52);

      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(tmpSkyCol, kLerp);
      }
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.lerp(tmpFogCol, kLerp);
        // Sync exact sRGB-encoded mist color to custom Terrain & Water ShaderMaterials so Sky, Ground, Water & Buildings dissolve with ZERO seam!
        scene.fog.color.getRGB(tmpFogSrgb, THREE.SRGBColorSpace);
        if (terrainMat.uniforms?.uFogColor?.value instanceof THREE.Color) {
          terrainMat.uniforms.uFogColor.value.setRGB(tmpFogSrgb.r, tmpFogSrgb.g, tmpFogSrgb.b);
        }
        if (waterMat.uniforms?.uFogColor?.value instanceof THREE.Color) {
          waterMat.uniforms.uFogColor.value.setRGB(tmpFogSrgb.r, tmpFogSrgb.g, tmpFogSrgb.b);
        }
      }

      const surfLerp = Math.min(1, dtSec * 2.6);
      smoothSnowCover += (atm.snowCover - smoothSnowCover) * surfLerp;
      smoothWetness += (atm.wetness - smoothWetness) * surfLerp;
      smoothHailSpecks += (atm.hailSpecks - smoothHailSpecks) * surfLerp;
      smoothHeatDry += (atm.heatDry - smoothHeatDry) * surfLerp;
      const targetGroundLight = atm.groundLightScale * (0.48 + solar.daylightFactor * 0.52);
      smoothGroundLight += (targetGroundLight - smoothGroundLight) * surfLerp;
      smoothWindSway += (atm.windSwayMult - smoothWindSway) * surfLerp;

      const timeSec = nowMs * 0.001;
      syncTerrainGeoUniforms3D(
        terrainMat,
        adventureStyleRef.current !== 'vampire_rogue',
        smoothSnowCover,
        {
          wetness: smoothWetness,
          lightScale: smoothGroundLight,
          hailSpecks: smoothHailSpecks,
          heatDry: smoothHeatDry,
          timeSec,
        },
      );

      // Sync ALL 3D Pixel Plants (wild trees, bushes, flowers, grass, cattails, lily pads & city trees!)
      const floraBright = 0.56 + 0.44 * Math.min(1.12, smoothGroundLight);
      tmpFloraLightCol.setRGB(floraBright, floraBright, floraBright);
      if (atm.overcastTintStrength > 0.05) {
        tmpFloraLightCol.lerp(
          tmpOvercastCol.setHex(0xc8d8ee).multiplyScalar(floraBright),
          atm.overcastTintStrength * 0.28,
        );
      }
      if (atm.tempTintStrength > 0.05) {
        tmpFloraLightCol.lerp(
          tmpTempTintCol.setHex(atm.tempTintHex).multiplyScalar(floraBright),
          atm.tempTintStrength * 0.32,
        );
      }
      syncGlobalFloraWeather3D({
        snowCover: smoothSnowCover,
        wetness: smoothWetness,
        heatDry: smoothHeatDry,
        windSwayMult: smoothWindSway,
        lightTint: tmpFloraLightCol,
        fogColor: scene.fog instanceof THREE.Fog ? scene.fog.color : tmpFogCol,
        timeSec,
      });

      const skyU = horizonBackdrop.userData?.skyUniforms;
      if (skyU) {
        skyU.uZenith?.value?.lerp?.(tmpSkyCol, kLerp);
        skyU.uMid?.value?.lerp?.(tmpMidCol, kLerp);
        skyU.uHorizon?.value?.lerp?.(tmpHorCol, kLerp);
        skyU.uFogColor?.value?.lerp?.(tmpFogCol, kLerp);
        if (skyU.uCloudCover) {
          skyU.uCloudCover.value += (atm.cloudCover - skyU.uCloudCover.value) * kLerp;
        }
        if (skyU.uCloudDarkness) {
          skyU.uCloudDarkness.value += (atm.cloudDarkness - skyU.uCloudDarkness.value) * kLerp;
        }
        if (skyU.uWindStretch) {
          skyU.uWindStretch.value += (atm.windStretch - skyU.uWindStretch.value) * kLerp;
        }
        if (skyU.uCloudScroll) {
          skyU.uCloudScroll.value += dtSec * atm.cloudSpeed;
        }
        const df = solar.daylightFactor;
        const dark = atm.cloudDarkness;
        const litScale = 1.0 - dark * 0.62;
        const shadeScale = 1.0 - dark * 0.72;
        tmpCloudLit.setRGB(
          (0.28 + df * 0.72) * litScale,
          (0.32 + df * 0.67) * litScale,
          (0.46 + df * 0.54) * (litScale + dark * 0.08),
        );
        tmpCloudShade.setRGB(
          (0.16 + df * 0.58) * shadeScale,
          (0.21 + df * 0.61) * shadeScale,
          (0.34 + df * 0.58) * (shadeScale + dark * 0.08),
        );
        skyU.uCloudLit?.value?.lerp?.(tmpCloudLit, kLerp);
        skyU.uCloudShade?.value?.lerp?.(tmpCloudShade, kLerp);
      }

      // Position DirectionalLight along real solar azimuth & altitude (with crisp elevated moonlight angle at night!)
      const elevClamped = Math.max(0.42, (Math.abs(solar.solarElevationDeg) * Math.PI) / 180);
      const az = solar.solarAzimuthRad || 0.75;
      const sDist = 62;
      const sSnapX = Math.round(focusX * 0.5) * 2;
      const sSnapZ = Math.round(focusZ * 0.5) * 2;
      sun.position.set(
        sSnapX + Math.sin(az) * Math.cos(elevClamped) * sDist,
        focusY + Math.sin(elevClamped) * sDist,
        sSnapZ + Math.cos(az) * Math.cos(elevClamped) * sDist,
      );
      sun.target.position.set(sSnapX, focusY, sSnapZ);
      sun.target.updateMatrixWorld();

      // Synchronize city-wide night building windows & streetlamp halos/light pools (zero PointLight fragment cost!)
      setGlobalNightLampGlow3D(solar.lampGlow);
    };

    // Pre-compile shaders once up front behind the Poké Ball curtain so Frame 1 never stutters on shader link!
    setBootCurtainProgress(80);
    try {
      renderer.compile(scene, camera);
    } catch {
      // ignore shader precompile warning
    }
    setBootCurtainProgress(94);
    let scenePaintedFrames = 0;
    const mark3DFramePainted = () => {
      scenePaintedFrames += 1;
      if (scenePaintedFrames === 2) {
        dismissInitialBootPokeballCurtain();
        on3DSceneReadyRef.current?.();
      }
    };

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      const sim = simRef.current;

      if (sim) {
        // Safe Zones disabled in this version (clean open terraced wilderness!)
        const nearbyZones: SafeZone3D[] = [];
        const activeZone = null as SafeZone3D | null;
        const nearestZone: SafeZone3D = { id: 'none', x: 0, z: 0, radius: 0 };
        const nearestDist = 999;

        // Scenic Elevated Panoramic 3D Diorama Overlook during Hub & Map Select (Living Hero, Camera-Facing Squad, Meadow & Flying Wild Pokémon!)
        if (phase !== 'playing') {
          weatherVisuals3D.update({
            dt,
            kind: liveWeatherRef.current.kind,
            intensity: liveWeatherRef.current.intensity,
            centerX: sim.px,
            centerY: sim.py,
            centerZ: sim.pz,
            camFwdX: -Math.sin(camOrbitRef.current.yaw),
            camFwdZ: -Math.cos(camOrbitRef.current.yaw),
            isIndoor: false,
            reduceFlashes: Boolean(prefsRef.current.reduceFlashes),
            sun,
            hemi,
            scene,
            onLightningStrike: (isNear) => sound.triggerStormThunder(isNear),
          });
          renderHubDioramaFrame3D({ applyLiveSolarAtmosphere, camera, dt, emoteKinds, externalPausedRef, geoHighwayStreamer, heroEmoteSprite, heroFrames, horizonBackdrop, metaRef, now, petEmoteSprite, phase, playerShadow, playerSprite, playerSpriteMat, previewSprites, renderer, scene, sim, syncFloraBillboards, updateWorldAround, waterMat, worldMapOpenRef });
          mark3DFramePainted();
          rafId = window.requestAnimationFrame(animate);
          return;
        }
        heroEmoteSprite.visible = false;
        petEmoteSprite.visible = false;

        // Pause 3D GPU rendering when Handheld Console or Global World Map overlay covers the screen!
        if (externalPausedRef.current || worldMapOpenRef.current) {
          rafId = window.requestAnimationFrame(animate);
          return;
        }

        // Respect FPS Cap & Power Saver Mode
        const activeFpsCap = prefsRef.current.powerSaver ? 30 : prefsRef.current.fpsLimit;
        if (activeFpsCap > 0 && now - lastRenderTs < 1000 / activeFpsCap - 1) {
          rafId = window.requestAnimationFrame(animate);
          return;
        }
        const renderGap = Math.max(1, now - lastRenderTs);
        lastRenderTs = now;
        fpsSmooth = fpsSmooth * 0.88 + (1000 / renderGap) * 0.12;
        syncTerrainGeoUniforms3D(
          terrainMat,
          adventureStyleRef.current !== 'vampire_rogue',
          smoothSnowCover,
        );
        syncUrbanAt(sim.px,sim.pz);

        if (!pausedRef.current && !externalPausedRef.current && !worldMapOpenRef.current && !inRunTownShopOpenRef.current && hubModalRef.current === 'none' && !endedRef.current) {
          sim.elapsed += dt;
          if (sim.invuln > 0) sim.invuln = Math.max(0, sim.invuln - dt);
          if (sim.timers.safeHealCd > 0) sim.timers.safeHealCd = Math.max(0, sim.timers.safeHealCd - dt);
          if (comboRef.current.timer > 0) {
            comboRef.current.timer -= dt;
            if (comboRef.current.timer <= 0) comboRef.current.count = 0;
          }
          if (shakeRef.current > 0) shakeRef.current = Math.max(0, shakeRef.current - dt * 1.9);

          // 1. 360° Movement (Handheld/Virtual Analog Pad + Keyboard Diagonals + Canvas Drag)
          let mx = 0;
          let mz = 0;
          const ks = keysRef.current;
          const kb = save.keyBindings;
          const norm = (k?: string) => (k && k.length === 1 ? k.toLowerCase() : k ?? '');
          if (ks.has('ArrowLeft') || ks.has('a') || ks.has(norm(kb?.left))) mx -= 1;
          if (ks.has('ArrowRight') || ks.has('d') || ks.has(norm(kb?.right))) mx += 1;
          if (ks.has('ArrowUp') || ks.has('w') || ks.has(norm(kb?.up))) mz -= 1;
          if (ks.has('ArrowDown') || ks.has('s') || ks.has(norm(kb?.down))) mz += 1;

          const padV = analogVecRef.current;
          if (mx === 0 && mz === 0 && (Math.abs(padV.x) > 0.08 || Math.abs(padV.y) > 0.08)) {
            mx = padV.x;
            mz = padV.y;
          }
          // Native Web Gamepad API Support (Xbox / PlayStation / Switch Pro / 8BitDo — Left Stick Move, Right Stick Camera, Face/Shoulder Buttons!)
          const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
          const gp = pads ? Array.from(pads).find((g): g is Gamepad => Boolean(g && g.connected)) : undefined;
          if (gp) {
            const dead = (v: number) => (Math.abs(v) > 0.16 ? v : 0);
            const lx = dead(gp.axes[0] ?? 0);
            const ly = dead(gp.axes[1] ?? 0);
            const dpadX = (gp.buttons[15]?.pressed ? 1 : 0) - (gp.buttons[14]?.pressed ? 1 : 0);
            const dpadY = (gp.buttons[13]?.pressed ? 1 : 0) - (gp.buttons[12]?.pressed ? 1 : 0);
            if (mx === 0 && mz === 0 && (lx !== 0 || ly !== 0 || dpadX !== 0 || dpadY !== 0)) {
              mx = lx || dpadX;
              mz = ly || dpadY;
            }
            const rx = dead(gp.axes[2] ?? 0);
            const ry = dead(gp.axes[3] ?? 0);
            if (rx !== 0) camOrbitRef.current.yaw -= rx * dt * 2.4;
            if (ry !== 0) {
              camOrbitRef.current.pitch = Math.max(
                0.1,
                Math.min(MAX_CAM_PITCH, camOrbitRef.current.pitch + ry * dt * 1.8),
              );
            }
            const gpPrev = (sim as unknown as { _gpPrev?: boolean[] })._gpPrev ?? [];
            const pressedOnce = (idx: number) => Boolean(gp.buttons[idx]?.pressed) && !gpPrev[idx];
            if (pressedOnce(0)) jumpQueuedRef.current = true; // A / Cross -> Jump
            if (pressedOnce(2)) triggerBattleActionRef.current?.('ball'); // X / Square -> Throw Ball
            if (pressedOnce(1)) triggerBattleActionRef.current?.('heal'); // B / Circle -> Heal
            if (pressedOnce(3)) triggerBattleActionRef.current?.('boost'); // Y / Triangle -> Boost
            if (pressedOnce(5)) triggerBattleActionRef.current?.('salvo'); // RB / R1 -> Team Salvo
            if (pressedOnce(4)) toggleWorldMap(); // LB / L1 -> World Map
            if (pressedOnce(9)) onOpenPokemonManager('menu', true); // Start -> Menu
            if (pressedOnce(8)) camOrbitRef.current = { yaw: 0, pitch: 0.24, zoom: 1.0 }; // Select -> Reset Cam
            (sim as unknown as { _gpPrev?: boolean[] })._gpPrev = gp.buttons.map((b) => b.pressed);
          }
          if (mx === 0 && mz === 0 && pointerSteerRef.current.active) {
            mx = pointerSteerRef.current.nx;
            mz = pointerSteerRef.current.nz;
          }

          let mLen = Math.hypot(mx, mz);
          if (mLen > 1) {
            mx /= mLen;
            mz /= mLen;
            mLen = 1;
          }

          // Camera-yaw rotation keys (Z/[ left, C/] right) + align movement to active 3D camera yaw!
          if (ks.has('z') || ks.has('[')) camOrbitRef.current.yaw -= dt * 1.9;
          if (ks.has('c') || ks.has(']')) camOrbitRef.current.yaw += dt * 1.9;
          const cameraMove=cameraRelativeMovement(mx,mz,camOrbitRef.current.yaw);
          let worldMx = cameraMove.x;
          let worldMz = cameraMove.z;

          // 1B. A* Auto-Pathfinding Steering (Cancels instantly on manual input; threads cleanly through building doorways!)
          const navNow = autoNavRef.current;
          if (mLen > 0.08 && navNow) {
            autoNavRef.current = null;
            setAutoNavActiveLabel(null);
            setAutoNavDistM(null);
            setAutoNavEtaSec(null);
            autoNavTrailGroup.visible = false;
            showBanner('🕹️ 已切换为手动移动控制', 1400);
          } else if (navNow && mLen <= 0.08) {
            const airNav = rideModeRef.current === 'fly' || rideModeRef.current === 'jet';
            // Advance background time-sliced A* pathfinder (~2.2ms budget, 60fps zero-stutter!) while walking!
            if (navNow.planningJob) {
              const planned = navNow.planningJob.step(2.2);
              if (planned) {
                navNow.planningJob = null;
                navNow.waypoints = planned.waypoints;
                navNow.hasRemainingHorizon = planned.hasRemainingHorizon;
                navNow.idx = findForwardSpliceIndex3D(sim.px, sim.pz, planned.waypoints);
                setAutoNavActiveLabel(navNow.label);
                rebuildAutoNavTrailVisuals(sim.px, sim.pz, navNow.waypoints, navNow.idx);
              }
            } else if (!airNav && navNow.hasRemainingHorizon && navNow.waypoints.length >= 2) {
              // Rolling-Horizon Refresh for multi-km journeys: seamlessly plan next 500m ahead before reaching horizon end!
              const horizonWp = navNow.waypoints[navNow.waypoints.length - 2];
              const finalGoalDist = Math.hypot(navNow.goalX - sim.px, navNow.goalZ - sim.pz);
              if (horizonWp && Math.hypot(horizonWp.x - sim.px, horizonWp.z - sim.pz) < 175 && finalGoalDist > 210) {
                const allCols = proceduralTowns.flatMap((t) => t.colliders);
                const portals = getBuildingPortals();
                const canSurf = sim.followers.some((f) => SPECIES_CATALOG[f.species].element === 'water');
                navNow.planningJob = createAutoWalkPathJob3D(
                  sim.px,
                  sim.pz,
                  navNow.goalX,
                  navNow.goalZ,
                  allCols,
                  canSurf,
                  portals,
                );
              }
            }

            while (
              navNow.idx < navNow.waypoints.length - 1 &&
              Math.hypot(navNow.waypoints[navNow.idx].x - sim.px, navNow.waypoints[navNow.idx].z - sim.pz) < 1.55
            ) {
              navNow.idx += 1;
              rebuildAutoNavTrailVisuals(sim.px, sim.pz, navNow.waypoints, navNow.idx);
            }
            const curWp = navNow.waypoints[navNow.idx];
            const distToFinal = Math.hypot(navNow.goalX - sim.px, navNow.goalZ - sim.pz);
            if (now - lastNavDistSyncMsRef.current >= 120) {
              lastNavDistSyncMsRef.current = now;
              const metersPerUnit = activeGeoNow ? 1000 / GEO_UNITS_PER_KM : 1;
              const roundedDist = Math.max(0, Math.round(distToFinal * metersPerUnit));
              const effMoveSpeed = Math.max(1, getCurrentGearBaseSpeed() * sim.speedMult);
              const etaSecNow = Math.max(1, Math.ceil(distToFinal / effMoveSpeed));
              setAutoNavDistM((prev) => (prev === roundedDist ? prev : roundedDist));
              setAutoNavEtaSec((prev) => (prev === etaSecNow ? prev : etaSecNow));
            }
            const arriveRadius = airNav ? 8 : 1.45;
            if ((!airNav && !curWp) || distToFinal < arriveRadius) {
              const arrivedLabel = navNow.label;
              autoNavRef.current = null;
              setAutoNavActiveLabel(null);
              setAutoNavDistM(null);
              setAutoNavEtaSec(null);
              autoNavTrailGroup.visible = false;
              sound.play('confirm');
              showBanner(`✅ 已抵达「${arrivedLabel}」！`, 2400);
            } else {
              const steerX = airNav || !curWp ? navNow.goalX : curWp.x;
              const steerZ = airNav || !curWp ? navNow.goalZ : curWp.z;
              const ndx = steerX - sim.px;
              const ndz = steerZ - sim.pz;
              const nd = Math.hypot(ndx, ndz) || 1;
              worldMx = ndx / nd;
              worldMz = ndz / nd;
              mLen = 1.0;
              autoNavBeaconRing.scale.setScalar(0.92 + Math.sin(sim.elapsed * 6.5) * 0.14);
              navNow.stuckTimer += dt;
              if (!airNav && navNow.stuckTimer >= 0.9) {
                const moved = Math.hypot(sim.px - navNow.lastCheckX, sim.pz - navNow.lastCheckZ);
                navNow.lastCheckX = sim.px;
                navNow.lastCheckZ = sim.pz;
                navNow.stuckTimer = 0;
                if (moved < 0.25 && !navNow.planningJob) {
                  const allCols = proceduralTowns.flatMap((t) => t.colliders);
                  const portals = getBuildingPortals();
                  const canSurf = sim.followers.some((f) => SPECIES_CATALOG[f.species].element === 'water');
                  navNow.waypoints = computeInstantKickoffWaypoints3D(
                    sim.px,
                    sim.pz,
                    navNow.goalX,
                    navNow.goalZ,
                    allCols,
                    canSurf,
                    portals,
                  );
                  navNow.idx = 0;
                  navNow.planningJob = createAutoWalkPathJob3D(
                    sim.px,
                    sim.pz,
                    navNow.goalX,
                    navNow.goalZ,
                    allCols,
                    canSurf,
                    portals,
                  );
                  rebuildAutoNavTrailVisuals(sim.px, sim.pz, navNow.waypoints, 0);
                }
              }
            }
          }

          // Animate 3D pixel wave swells & sparkling crests on localized scenic lakes!
          waterMat.uniforms.uTime.value = sim.elapsed;
          if (surfWarnCdRef.current > 0) surfWarnCdRef.current = Math.max(0, surfWarnCdRef.current - dt);

          const curRide = rideModeRef.current;
          const isFlyingNow = curRide === 'fly' || curRide === 'jet';
          const isShiftSprint = ks.has('shift');
          const hasWaterSurfer = sim.followers.some(
            (f) => SPECIES_CATALOG[f.species].element === 'water',
          );
          const baseGearSpeed =
            curRide === 'jet'
              ? 320
              : curRide === 'fly'
                ? 115
                : curRide === 'dash'
                  ? 38
                  : isShiftSprint
                    ? 22
                    : 8.2;
          const moveSpeed = baseGearSpeed * sim.speedMult;
          const nextPx = sim.px + worldMx * moveSpeed * dt;
          const nextPz = sim.pz + worldMz * moveSpeed * dt;
          const nextGroundY = getWalkableSurfaceHeight3D(nextPx, nextPz, sim.py);
          const enteringDeepWater = nextGroundY < WATER_LEVEL_3D - 0.14;
          if (!isFlyingNow && enteringDeepWater && !hasWaterSurfer) {
            if (surfWarnCdRef.current <= 0 && mLen > 0.1) {
              surfWarnCdRef.current = 3.5;
              sound.play('error');
              showBanner('🌊 前方是深水！走桥梁、带水系宝可梦冲浪，或按 T 切换飞行宝可梦飞越！', 3200);
            }
          } else if (
            isFlyingNow ||
            nextGroundY <=
              sim.py +
                (curRide === 'dash' || isShiftSprint
                  ? 5.5
                  : isNearAnyRoadOrRailForFlora3D(nextPx, nextPz)
                    ? 2.4
                    : 1.85)
          ) {
            sim.px = nextPx;
            sim.pz = nextPz;
          }
          const rawGroundY = getWalkableSurfaceHeight3D(sim.px, sim.pz, sim.py);
          const surfingNow = !isFlyingNow && rawGroundY < WATER_LEVEL_3D - 0.1 && hasWaterSurfer;
          const groundY = surfingNow ? WATER_LEVEL_3D + 0.12 : rawGroundY;
          surfRingMesh.visible = surfingNow;
          if (surfingNow) {
            surfRingMesh.position.set(sim.px, WATER_LEVEL_3D + 0.09, sim.pz);
            const spPulse = 0.94 + Math.sin(sim.elapsed * 6.5) * 0.12;
            surfRingMesh.scale.setScalar(spPulse);
            if (mLen > 0.1 && Math.random() < 0.25) {
              spawnPixelParticles(sim.px, WATER_LEVEL_3D + 0.12, sim.pz, vfxAtlas.starGlint, 1, 2.2, 0.45, 2.4, 8);
            }
          }
          setIsSurfing((prev) => (prev === surfingNow ? prev : surfingNow));

          if (isFlyingNow) {
            jumpQueuedRef.current = false;
            const climbSpeed = curRide === 'jet' ? 95 : 42;
            let vertVel = 0;
            if (ks.has(' ')) vertVel += climbSpeed;
            if (ks.has('x') || ks.has('control')) vertVel -= climbSpeed;
            // Pitch-assisted glide when pressing forward (`W` / Up)
            if (mLen > 0.12 && mz < -0.1) {
              vertVel += (0.22 - camOrbitRef.current.pitch) * moveSpeed * 0.65;
            }
            sim.vy = 0;
            const minAirY = Math.max(WATER_LEVEL_3D + 2.2, groundY + 2.4);
            sim.py = Math.max(minAirY, Math.min(1250, sim.py + vertVel * dt));
            // Keep squad companions soaring gracefully beside protagonist while airborne!
            sim.followers.forEach((f, idx) => {
              const ang = sim.facingAngle + Math.PI + (idx % 2 === 0 ? 1 : -1) * (0.55 + Math.floor(idx / 2) * 0.28);
              const dist = 2.8 + Math.floor(idx / 2) * 1.6;
              f.x += (sim.px + Math.sin(ang) * dist - f.x) * Math.min(1, dt * 10);
              f.z += (sim.pz + Math.cos(ang) * dist - f.z) * Math.min(1, dt * 10);
              f.y += (sim.py - 0.35 + Math.sin(sim.elapsed * 4 + idx) * 0.28 - f.y) * Math.min(1, dt * 12);
            });
          } else {
            // 3D Ground & Jump physics
            if (jumpQueuedRef.current) {
              jumpQueuedRef.current = false;
              if (sim.py <= groundY + 0.18) {
                sim.vy = GAME_JUMP_VELOCITY;
                sound.play('jump');
              }
            }
            const jump=advanceGroundJump(sim.py-groundY,sim.vy,dt);
            sim.py=groundY+jump.height;sim.vy=jump.velocity;
          }

          if (now - lastAltSyncMsRef.current > 220) {
            lastAltSyncMsRef.current = now;
            const altMeters = activeGeoNow ? worldYToRealMeters3D(sim.py) : sim.py;
            setPlayerAltitudeM(Math.max(0, Math.round(altMeters)));
          }

          if (mLen > 0.08) {
            sim.facingAngle = Math.atan2(worldMx, worldMz);
            sim.walkDist += mLen * moveSpeed * dt;
          }

          // Camera-Relative 360° Directional Sprite Selection for Protagonist, Citizens & Trainers + Upright Y-Billboard Foreshortening!
          const camYawNow = camOrbitRef.current.yaw;
          const camPitchNow = camOrbitRef.current.pitch;
          const bbTiltX = -camPitchNow * BILLBOARD_PITCH_TILT;
          const camFwdX = -Math.sin(camYawNow);
          const camFwdZ = -Math.cos(camYawNow);
          const camRightX = Math.cos(camYawNow);
          const camRightZ = -Math.sin(camYawNow);
          windClock += dt;
          syncFloraBillboards(camYawNow, camPitchNow, windClock);
          if (geoHighwayStreamer) {
            geoHighwayStreamer.updateAround(sim.px, sim.pz);
            // Lazily mount neighboring real-world 3D cities when walking overland along an inter-city highway!
            if (Math.floor(sim.elapsed * 2) > Math.floor((sim.elapsed - dt) * 2)) {
              for (const gc of getProjectedGeoCities()) {
                if (mountedGeoCityIds.has(gc.city.id)) continue;
                if (Math.hypot(sim.px - gc.x, sim.pz - gc.z) < 3800) {
                  mountedGeoCityIds.add(gc.city.id);
                  const neighborId = `geo_city_${gc.city.id}_${Math.round(gc.x)}_${Math.round(gc.z)}`;
                  const neighborName = `${gc.city.name}市`.replace(/市市$/, '市');
                  const neighborSeed = hashCitySeed(gc.city.id);
                  activeTownLayoutSpecs.push({
                    id: neighborId,
                    name: neighborName,
                    x: gc.x,
                    z: gc.z,
                    seed: neighborSeed,
                    plazaRadius: 185,
                    plateauY: 1.65,
                    landmarkCityId: gc.city.id,
                  });
                  const existingFoundationsChanged=registerActiveTownRoadLayouts3D(activeTownLayoutSpecs);
                  refreshUrbanFlora();
                  syncUrbanAt(sim.px,sim.pz,true);
                  if(existingFoundationsChanged){
                    for(const town of proceduralTowns){town.disposeRoadKit?.();townsGroup.remove(town.group)}
                    proceduralTowns.length=0;
                    for(const spec of activeTownLayoutSpecs.slice(0,-1)){
                      const rebuilt=buildProceduralTown3D(spec.id,spec.x,spec.z,spec.seed,(x,z)=>getTerrainHeight3D(x,z),spec.name,spec.plazaRadius,spec.landmarkCityId);
                      proceduralTowns.push(rebuilt);townsGroup.add(rebuilt.group);
                    }
                  }else for(const town of proceduralTowns){const newBaseY=getTerrainHeight3D(town.centerX,town.centerZ);town.group.position.y=newBaseY;town.refreshRoadKit?.(newBaseY,sim.px,sim.pz)}
                  const neighborTown = buildProceduralTown3D(
                    neighborId,
                    gc.x,
                    gc.z,
                    neighborSeed,
                    (x, z) => getTerrainHeight3D(x, z),
                    neighborName,
                    185,
                    gc.city.id,
                  );
                  proceduralTowns.push(neighborTown);
                  townsGroup.add(neighborTown.group);
                  chunkState.x = 999999; // Refresh local terrain chunk normals & roadbed grading
                  geoHighwayStreamer.updateAround(sim.px, sim.pz, true);
                  syncUpperFloors();
                  syncAutoNavTargets();
                }
              }
            }
          }
          const { closestTownPoint, activeTownNow, activeInteriorNow, closestNode, inTownPeaceZone } = stepArenaTownAndWorldNodes3D({ activeTownIdRef, activeZone, applyLiveSolarAtmosphere, autoNavTargetsRef, bbTiltX, camFwdX, camFwdZ, camRightX, camRightZ, camYawNow, damageEnemy3D, dt, executeInteractActionRef, groundY, heroFrames, interactOptionIdxRef, lastEnteredInteriorIdRef, liveWeatherRef, mLen, metaBonusesRef, metaRef, now, npcSocialTimerRef, onHealParty, onUpdateMeta, persistState, playerShadow, playerSprite, playerSpriteMat, prefsRef, proceduralTowns, safeZoneMeshes, setActiveBusStopModal, setAskQuickNavOpen, setInRunTownShopOpen, setWorldMapOpen, showBanner, sim, spawnGroundDecalWave, spawnPixelParticles, spawnSkillProjectile3D, startStreetDuelRef, sun, surfingNow, syncSafeZones3D, teleportIntraCityBusRef, triggerInteractRef, updateWorldAround, vfxAtlas, windClock, worldBubblesRef, worldInteractNodes });
          if (activeInteriorNow && rideModeRef.current !== 'walk') {
            rideModeRef.current = 'walk';
            setRideMode('walk');
          }
          // Dynamic Zone & Walk-In Building BGM Switching (Town Day/Night, Wilderness, Pokémon Center, Poké Mart, Restaurant, Hotel, House, Boss/Duel!)
          {
            let desiredBgm: BgmTrackId = 'adventure';
            if (inRunTownShopOpenRef.current || shopOpenRef.current) {
              desiredBgm = 'poke_mart';
            } else if (
              sim.enemies.some((e) => !e.knockedOut && e.hp > 0 && (e.isBoss || e.isStreetDuel))
            ) {
              desiredBgm = 'battle';
            } else if (activeInteriorNow) {
              switch (activeInteriorNow.kind) {
                case 'pokemon_center':
                  desiredBgm = 'pokemon_center';
                  break;
                case 'poke_mart':
                  desiredBgm = 'poke_mart';
                  break;
                case 'restaurant':
                  desiredBgm = 'restaurant';
                  break;
                case 'hotel':
                  desiredBgm = 'hotel';
                  break;
                case 'house':
                default:
                  desiredBgm = 'house';
                  break;
              }
            } else if (activeTownNow || inTownPeaceZone) {
              desiredBgm = solarInfoRef.current.lampGlow > 0.45 ? 'town_night' : 'town';
            } else {
              desiredBgm = 'adventure';
            }
            if (desiredBgm !== activeBgmTrackRef.current) {
              activeBgmTrackRef.current = desiredBgm;
              const citySeedIdx =
                activeTownNow && (desiredBgm === 'town' || desiredBgm === 'town_night')
                  ? hashCitySeed(activeTownNow.id) % 3
                  : undefined;
              sound.setTrack(desiredBgm, citySeedIdx);
              setActiveBgmTrack(desiredBgm);
            }
            const isIndoorNow = Boolean(activeInteriorNow);
            if (isIndoorNow !== activeInteriorAudioRef.current) {
              activeInteriorAudioRef.current = isIndoorNow;
              sound.setWeatherAmbience(liveWeatherRef.current.kind, {
                indoor: isIndoorNow,
                isNight: solarInfoRef.current.lampGlow > 0.45,
                dayPhase: solarInfoRef.current.phase,
                intensity: liveWeatherRef.current.intensity,
                season: liveGeoSeasonRef.current.season,
                climateZone: liveGeoSeasonRef.current.climateZone,
                seasonManual: (prefsRef.current.worldSeasonMode ?? 'auto') !== 'auto',
                tempC: liveWeatherRef.current.tempC,
              });
            }
          }
          stepArenaCombatSimulation3D({ activeTownNow, activeZone, addFollowerToRun, adventureStyleRef, bbTiltX, buildLevelChoices, buildResultSummary, camFwdX, camFwdZ, camRightX, camRightZ, camYawNow, camera, damageEnemy3D, diffMeta, difficultyId, dt, endedRef, fireSkill, gameMode, groundY, inTownPeaceZone, isInsideAnyTownPlaza, liveOverlandCityRef, liveWeatherRef, mLen, maxFollowersRef, metaBonusesRef, metaRef, nearbyZones, onCaptureBoss, onHealParty, pausedRef, pet, pickTargetForFollower, prefsRef, regionMeta, scene, selectedBiome, setCaptureCutscene, setLevelChoices, setResultSummary, shakeRef, showBanner, sim, spawnEnemy3D, spawnGlowFlash, spawnGroundDecalWave, spawnPixelParticles, spawnSkillProjectile3D, spawnSpriteBurst, tacticsRef, vfxAtlas });
          // Unified Physical 3D Camera Rig (Spring-Arm Wall Zoom-In + Under-Viaduct Ducking + 1F/2F Room Zoom — ZERO Wall Piercing!)
          const occludeTown =
            activeTownNow ??
            proceduralTowns.find(
              (t) => Math.hypot(sim.px - t.centerX, sim.pz - t.centerZ) < Math.max(t.safeRadius + 60, 2100),
            ) ??
            null;
          const shakeAmp =
            prefsRef.current.screenShake && shakeRef.current > 0
              ? shakeRef.current * (prefsRef.current.shakeIntensity / 100) * 0.55
              : 0;
          updatePhysicalCameraRig3D({
            camera,
            pivot: camPivotRef.current,
            orbit: camOrbitRef.current,
            smooth: camSmoothRef.current,
            mode: camFollowModeRef.current,
            px: sim.px,
            py: sim.py,
            pz: sim.pz,
            worldMx,
            worldMz,
            mLen,
            mzInput: mz,
            isDragging: camDragRef.current.active,
            pointerLocked,
            autoNavActive: Boolean(autoNavRef.current),
            occludeTown,
            activeInterior: activeInteriorNow,
            shakeAmp,
            dt,
          });
          horizonBackdrop.position.set(camPivotRef.current.x, 0, camPivotRef.current.z);
          if (horizonBackdrop.userData?.skyUniforms?.uTime) {
            horizonBackdrop.userData.skyUniforms.uTime.value = now * 0.001;
          }

          stepArenaHudProjection3D({ activeInteriorNow, activeTownNow, activeWorldRun, activeZone, autoNavTargetsRef, camOrbitRef, camera, closestNode, closestTownPoint, comboRef, dt, externalPausedRef, fpsSmooth, gameMode, handleFastTravelCity, interactActionCountRef, interactOptionIdxRef, latestMapSnapshotRef, liveOverlandCityRef, nearbyKoIdRef, nearestDist, nearestZone, occludeTown, onSyncWorldMapData, onUpdateMeta, overlandCityIdRef, pet, phase, projVec, regionMeta, returnToHubCityRef, scene, selectedBiome, setAskQuickNavOpen, setEdgeIndicators, setFloatingTags, setHud, setInteractOptionIdx, setLiveOverlandCity, setMapSnapshot, setNearbyInteract, setNearbyKoTarget, setProjectedBubbles, setWorldMapOpen, showBanner, sim, startAutoNavRef, teleportDirectRef, terrainMat, worldBubblesRef });
        } else if (sim.activeCaptures.length > 0 && !externalPausedRef.current && !endedRef.current) {
          stepArenaCaptureCinema3D({ addFollowerToRun, buildResultSummary, camera, captureFinishRef, damageEnemy3D, diffMeta, dt, endedRef, gameMode, horizonBackdrop, maxFollowersRef, now, onCaptureBoss, onShowCaptureInHandheld, pausedRef, pet, regionMeta, save, scene, setCaptureCutscene, setResultSummary, sim, spawnGlowFlash, spawnGroundDecalWave, spawnPixelParticles, syncFloraBillboards, vfxAtlas, waterMat });
        }
        weatherVisuals3D.update({
          dt,
          kind: liveWeatherRef.current.kind,
          intensity: liveWeatherRef.current.intensity,
          centerX: sim.px,
          centerY: sim.py,
          centerZ: sim.pz,
          camFwdX: -Math.sin(camOrbitRef.current.yaw),
          camFwdZ: -Math.cos(camOrbitRef.current.yaw),
          isIndoor: activeInteriorAudioRef.current,
          reduceFlashes: Boolean(prefsRef.current.reduceFlashes),
          sun,
          hemi,
          scene,
          onLightningStrike: (isNear) => sound.triggerStormThunder(isNear),
        });
        renderer.render(scene, camera);
        mark3DFramePainted();
      }
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => {
      unsubGeoDem();
      weatherVisuals3D.dispose();
      geoHighwayStreamer?.dispose();
      setWalkableBuildingFloorZones3D([]);
      unregisterRenderedTerrain();
      unregisterRoadTerrainGrid();
      window.removeEventListener('resize', onResize);
      canvasResizeObserver?.disconnect();
      window.cancelAnimationFrame(rafId);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedBiome, gameMode, difficultyId, runNonce]);

  const flushLiveWorldCheckpointNow = () => {
    const curSim = simRef.current;
    if (!curSim || endedRef.current || curSim.hp <= 0) return;
    if (adventureStyleRef.current !== 'care_world') return;
    const curOrg = getActiveGeoTerrainOrigin();
    const curGeo = worldToGeo(curSim.px, curSim.pz);
    saveWorldCheckpoint({
      mode: curOrg ? 'geo' : 'procedural',
      cityId: curOrg?.startCityId ?? 'shanghai',
      cityName: curOrg?.startCityName,
      lat: curGeo?.lat,
      lng: curGeo?.lng,
      x: curSim.px,
      z: curSim.pz,
      facingAngle: curSim.facingAngle,
      updatedAt: Date.now(),
    });
  };

  useEffect(() => {
    const isCarePlaying = phase === 'playing' && adventureStyle === 'care_world';
    setActiveCareSessionFlag(isCarePlaying);
    if (!isCarePlaying) return;
    const onUnload = () => flushLiveWorldCheckpointNow();
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      flushLiveWorldCheckpointNow();
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, adventureStyle]);

  useEffect(() => {
    if (phase !== 'playing') {
      setLiveOverlandCity(null);
      liveOverlandCityRef.current = null;
      overlandCityIdRef.current = null;
      passiveLevelsRef.current = {};
    }
  }, [phase]);

  // 1) Default Entry「开始冒险」: Real-Earth City Care & Open Exploration Mode (养成探索模式 — resumes exact last checkpoint if alive!)
  const handleLaunchRun = () => {
    setAdventureStyle('care_world');
    adventureStyleRef.current = 'care_world';
    setWorldMapOpen(false);
    const savedCp = loadWorldCheckpoint();
    const wt = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
    const activeId = (savedCp?.mode === 'geo' && savedCp.cityId) || wt.currentCityId || 'shanghai';
    const city = WORLD_CITIES.find((c) => c.id === activeId) ?? WORLD_CITIES.find((c) => c.id === 'shanghai') ?? WORLD_CITIES[0];
    handleLaunchWorldRun(
      {
        cityId: city.id,
        cityName: `${city.name}市`.replace(/市市$/, '市'),
        gymName: city.gymName,
        gymBadgeName: city.gymBadgeName,
        biome: city.biome,
        wildPool: city.wildPool,
        bossSpecies: city.gymBossSpecies,
        bossName: city.gymBossTitle,
        bossTrainerKey: city.gymTrainerKey,
        bossTrainerName: city.gymLeaderName,
        regionalSkinId: city.regionalSkinId,
        rewardCoins: city.rewardCoins,
        originLat: city.lat,
        originLng: city.lng,
        isGymChallenge: false,
        isHomeTurf: true,
        hotelTier: wt.stayHotelTier ?? null,
      },
      false,
    );
  };

  // Show resume toast once if initial mount auto-resumed into Playing
  const didAutoResumeRef = useRef(false);
  useEffect(() => {
    if (didAutoResumeRef.current) return;
    didAutoResumeRef.current = true;
    if (initialAutoResumePayload) {
      const cp = loadWorldCheckpoint();
      if (cp?.lat !== undefined && cp?.lng !== undefined) {
        showBanner(
          `📍 已继续回到上次探索位置（${cp.lat.toFixed(2)}°N, ${cp.lng.toFixed(2)}°E）！`,
          3600,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Secondary Entry「随机冒险模式」: Classic Vampire-Survivors Roguelike Horde & 3-Choice Draft Mode!
  const handleLaunchRandomRogueRun = (explicitBiome?: BiomeId) => {
    sound.play('confirm');
    setWorldMapOpen(false);
    const pickedRegion = explicitBiome
      ? MAP_REGIONS.find((r) => r.id === explicitBiome) ?? MAP_REGIONS[0]
      : MAP_REGIONS[Math.floor(Math.random() * MAP_REGIONS.length)];
    runWithPokeballShutter(`拨开齐腰深的草丛，深入「${pickedRegion.name}」…`, () => {
      setAdventureStyle('vampire_rogue');
      adventureStyleRef.current = 'vampire_rogue';
      setActiveGeoTerrainOrigin(null);
      setActiveWorldRun(null);
      setLiveOverlandCity(null);
      liveOverlandCityRef.current = null;
      overlandCityIdRef.current = null;
      setSelectedBiome(pickedRegion.id);
      setGameMode('endless');
      pausedRef.current = false;
      endedRef.current = false;
      setRunNonce((n) => n + 1);
      setPhase('playing');
      showBanner(
        `🎲 随机冒险模式 · 已降临【${pickedRegion.name}】！迎战潮水般涌来的宝可梦群，拾取经验结晶升级进化！`,
        4200,
      );
    });
  };

  const handleLaunchWorldRun = (payload: WorldLaunchPayload, resetCheckpointToCity = false) => {
    sound.play('confirm');
    setWorldMapOpen(false);
    const shutterTitle = payload.isGymChallenge
      ? `馆主已在场内等候，步入「${payload.gymName}」…`
      : `列车缓缓进站，即将抵达「${payload.cityName}」…`;
    runWithPokeballShutter(shutterTitle, () => {
      if (resetCheckpointToCity || payload.isGymChallenge) {
        clearWorldCheckpoint();
      }
      const resumedCp = !resetCheckpointToCity && !payload.isGymChallenge ? loadWorldCheckpoint() : null;
      const nextStyle = payload.isGymChallenge ? 'vampire_rogue' : 'care_world';
      setAdventureStyle(nextStyle);
      adventureStyleRef.current = nextStyle;
      setActiveGeoTerrainOrigin({
        originLat: payload.originLat,
        originLng: payload.originLng,
        startCityId: payload.cityId,
        startCityName: payload.cityName,
        unitsPerKm: GEO_UNITS_PER_KM,
      });
      setActiveWorldRun(payload);
      setLiveOverlandCity(null);
      liveOverlandCityRef.current = null;
      overlandCityIdRef.current = payload.cityId;
      setSelectedBiome(payload.biome);
      setGameMode('story');
      pausedRef.current = false;
      endedRef.current = false;
      setRunNonce((n) => n + 1);
      setPhase('playing');
      const buffNote =
        payload.hotelTier === 'grand'
          ? ' · 五星增益生效'
          : payload.isHomeTurf
            ? ' · 主场共鸣生效'
            : '';
      showBanner(
        payload.isGymChallenge
          ? `✈ ${payload.cityName} · 挑战「${payload.gymName}」：击败 ${payload.bossName} 赢取 ${payload.gymBadgeName}！${buffNote}`
          : resumedCp?.lat !== undefined && resumedCp?.lng !== undefined
            ? `📍 已继续回到上次探索位置（${resumedCp.lat.toFixed(2)}°N, ${resumedCp.lng.toFixed(2)}°E）！${buffNote}`
            : `🌍 ${payload.cityName} 真实地形已加载：可沿主干道与丘陵探索，甚至徒步跨越邻城！${buffNote}`,
        4200,
      );
    });
  };

  fastTravelCityRef.current = (cityId: string) => {
    const city = WORLD_CITIES.find((c) => c.id === cityId);
    if (!city) return;
    clearWorldCheckpoint();
    const wt = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
    onUpdateMeta?.((prev) => {
      const prevTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
      const visited = prevTour.visitedCities.includes(city.id)
        ? prevTour.visitedCities
        : [...prevTour.visitedCities, city.id];
      return {
        ...prev,
        worldTour: {
          ...prevTour,
          currentCityId: city.id,
          visitedCities: visited,
        },
      };
    });
    handleLaunchWorldRun(
      {
        cityId: city.id,
        cityName: `${city.name}市`.replace(/市市$/, '市'),
        gymName: city.gymName,
        gymBadgeName: city.gymBadgeName,
        biome: city.biome,
        wildPool: city.wildPool,
        bossSpecies: city.gymBossSpecies,
        bossName: city.gymBossTitle,
        bossTrainerKey: city.gymTrainerKey,
        bossTrainerName: city.gymLeaderName,
        regionalSkinId: city.regionalSkinId,
        rewardCoins: city.rewardCoins,
        originLat: city.lat,
        originLng: city.lng,
        isGymChallenge: false,
        isHomeTurf: false,
        hotelTier: wt.stayHotelTier ?? null,
      },
      true,
    );
  };

  const handleChooseUpgrade = (choice: LevelChoice) => {
    const sim = simRef.current;
    if (!sim) return;
    sound.play('confirm');
    if (choice.kind === 'upgrade_follower' && choice.followerId) {
      const f = sim.followers.find((x) => x.id === choice.followerId);
      if (f) {
        const prevSlots = getUnlockedSkillSlotCount(f.level);
        f.level += 1;
        const nextSlots = getUnlockedSkillSlotCount(f.level);
        if (nextSlots > prevSlots) {
          const unlockedSkill = SURVIVOR_SKILLS[f.skills[nextSlots - 1]];
          if (unlockedSkill) {
            showBanner(`✨ ${f.name} 升至 Lv.${f.level}，激活第 ${nextSlots} 招式槽【${unlockedSkill.name}】！`, 3400);
          }
        }
        syncFollowersView();
      }
    } else if (choice.kind === 'passive' && choice.passiveId) {
      passiveLevelsRef.current[choice.passiveId] = (passiveLevelsRef.current[choice.passiveId] ?? 0) + 1;
      if (choice.passiveId === 'speed') {
        sim.speedMult += 0.14;
        sim.pickupRadius += 1.6;
      } else if (choice.passiveId === 'vitality') {
        sim.maxHp = Math.round(sim.maxHp * 1.22);
        sim.hp = Math.min(sim.maxHp, sim.hp + Math.round(sim.maxHp * 0.35));
      } else if (choice.passiveId === 'atk') {
        sim.atkMult += 0.2;
      } else if (choice.passiveId === 'haste') {
        sim.cdMult = Math.max(0.42, sim.cdMult * 0.88);
      } else if (choice.passiveId === 'greed') {
        sim.greedMult += 0.28;
        sim.pickupRadius += 1.4;
      }
    } else if (choice.kind === 'item' && choice.itemId) {
      if (choice.itemId === 'super_potion') {
        sim.healCharges += 2;
        sim.hp = Math.min(sim.maxHp, sim.hp + Math.round(sim.maxHp * 0.3));
      } else if (choice.itemId === 'rare_candy_boost') {
        sim.boostTimer = Math.max(sim.boostTimer, 10);
        sim.actionCds.boost = 0;
      } else if (choice.itemId === 'salvo_charge') {
        sim.actionCds.salvo = 0;
        sim.actionCds.ball = 0;
      } else if (choice.itemId === 'coin_pouch') {
        sim.coins += 45;
        for (const lt of sim.loots) {
          if (lt.kind === 'xp' || lt.kind === 'coin') {
            lt.x = sim.px;
            lt.z = sim.pz;
          }
        }
      }
    }
    setClosingLevelUp(true);
    tryRestorePointerLock();
    window.setTimeout(() => {
      setClosingLevelUp(false);
      setLevelChoices(null);
      pausedRef.current = false;
    }, 155);
  };

  const closeResultAndRun = (afterClose: () => void) => {
    if (closingResult) return;
    setClosingResult(true);
    window.setTimeout(() => {
      setClosingResult(false);
      setResultSummary(null);
      afterClose();
    }, 185);
  };

  const handleCaptureBossConfirm = (capture: boolean) => {
    const sim = simRef.current;
    if (!captureOffer || !sim || closingCapture) return;
    let caughtInfo: { species: SpeciesId; name: string; level: number } | null = sim.capturedBoss;
    if (capture) {
      sound.play('hatch');
      onCaptureBoss?.(captureOffer.species, captureOffer.level);
      addFollowerToRun(captureOffer.species, captureOffer.name, 'adult');
      caughtInfo = { ...captureOffer };
      sim.capturedBoss = caughtInfo;
      showBanner(`叮咚！成功收服了【${captureOffer.name}】，已加入精灵球盒与当前战队！`, 3400);
    } else {
      sound.play('cancel');
    }
    setClosingCapture(true);
    window.setTimeout(() => {
      setClosingCapture(false);
      setCaptureOffer(null);
      if (gameMode === 'story') {
        sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
        endedRef.current = true;
        pausedRef.current = true;
        setResultSummary(buildResultSummary(true, caughtInfo));
      } else {
        pausedRef.current = false;
      }
    }, 165);
  };

  const triggerSafeHeal = () => {
    const sim = simRef.current;
    if (!sim) return;
    sim.hp = sim.maxHp;
    onHealParty();
    sound.play('heal_jingle');
    showBanner('乔伊小姐：叮咚叮咚～主角与全队随从已恢复满 HP！');
  };

  const totalSpendableCoins = save.coins + hud.coins;
  const buySafeShopItem = (kind: 'potion' | 'summon' | 'tome' | 'berry', cost: number) => {
    const sim = simRef.current;
    if (!sim) return;
    if (sim.coins + save.coins < cost) {
      sound.play('error');
      return;
    }
    if (sim.coins >= cost) sim.coins -= cost;
    else {
      const rem = cost - sim.coins;
      if (!onSpendCoinsInRun(rem)) return;
      sim.coins = 0;
    }
    sound.play('coin');
    if (kind === 'potion') {
      sim.hp = Math.min(sim.maxHp, sim.hp + Math.round(sim.maxHp * 0.65));
    } else if (kind === 'summon') {
      // Strictly upgrade existing squad Pokémon instead of summoning new ones!
      sim.followers.forEach((f) => (f.level += 1));
      syncFollowersView();
    } else if (kind === 'tome') {
      sim.atkMult += 0.25;
      sim.cdMult = Math.max(0.45, sim.cdMult * 0.9);
    } else if (kind === 'berry') {
      sim.maxHp = Math.round(sim.maxHp * 1.25);
      sim.hp = Math.min(sim.maxHp, sim.hp + Math.round(sim.maxHp * 0.35));
    }
    setHud((prev) => ({ ...prev, hp: Math.ceil(sim.hp), maxHp: sim.maxHp, coins: sim.coins }));
  };

  const buildPayload = (cleared: boolean): SurvivorsResultPayload => {
    const sim = simRef.current;
    return {
      survivedSec: Math.round(sim?.elapsed ?? 0),
      kills: sim?.kills ?? 0,
      runLevel: sim?.runLevel ?? 1,
      coinsCollected: sim?.coins ?? 0,
      cleared,
      remainingHpPct: sim ? Math.round((Math.max(0, sim.hp) / sim.maxHp) * 100) : 100,
    };
  };

  // Floating Dynamic 360° Mobile Joystick handler (spawns right where the player touches on left side!)
  const startVirtualPad = (clientX: number, clientY: number, zoneRect: DOMRect) => {
    const padHalf = 46;
    const localX = Math.max(padHalf, Math.min(zoneRect.width - padHalf, clientX - zoneRect.left));
    const localY = Math.max(padHalf, Math.min(zoneRect.height - padHalf, clientY - zoneRect.top));
    vPadOriginRef.current = { x: zoneRect.left + localX, y: zoneRect.top + localY };
    analogVecRef.current = { x: 0, y: 0 };
    setVPad({ originX: localX, originY: localY, x: 0, y: 0, active: true });
  };

  const updateVirtualPad = (clientX: number, clientY: number) => {
    const origin = vPadOriginRef.current;
    const dx = clientX - origin.x;
    const dy = clientY - origin.y;
    const d = Math.hypot(dx, dy);
    if (d < 5) {
      analogVecRef.current = { x: 0, y: 0 };
      setVPad((prev) => ({ ...prev, x: 0, y: 0, active: true }));
      return;
    }
    const nx = dx / d;
    const ny = dy / d;
    const mag = Math.min(1, d / 44);
    analogVecRef.current = { x: nx * mag, y: ny * mag };
    setVPad((prev) => ({
      ...prev,
      x: Math.round(nx * Math.min(26, d * 0.55)),
      y: Math.round(ny * Math.min(26, d * 0.55)),
      active: true,
    }));
  };

  const activeRoom = ROOM_CATALOG.find((r) => r.id === pet.ballRoom) ?? ROOM_CATALOG[0];
  const petStage = getGrowthStage(pet.level, pet.species);
  const petMeta = SPECIES_CATALOG[pet.species];
  const xpPct = Math.min(100, Math.round((hud.xp / hud.xpNeed) * 100));
  const hpPct = Math.min(100, Math.round((hud.hp / hud.maxHp) * 100));
  const minStr = `${Math.floor(hud.elapsedSec / 60)}:${String(hud.elapsedSec % 60).padStart(2, '0')}`;

  // Publish live tactics bridge so the Handheld Console renders Tactics natively!
  useEffect(() => {
    if (!onSyncTacticsBridge) return;
    if (phase !== 'playing') {
      onSyncTacticsBridge(null);
      return;
    }
    onSyncTacticsBridge({
      inBattle: true,
      regionName: regionMeta.name,
      diffLabel: diffMeta.label,
      hp: hud.hp,
      maxHp: hud.maxHp,
      xp: hud.xp,
      xpNeed: hud.xpNeed,
      runLevel: hud.runLevel,
      elapsedSec: hud.elapsedSec,
      kills: hud.kills,
      totalDamage: hud.totalDamage,
      coins: hud.coins,
      baseAtk: simRef.current?.baseAtk ?? 20,
      atkMult: simRef.current?.atkMult ?? 1,
      followers: followersView,
      tactics,
      camPreset,
      onToggleFollower: (boxPetId: string) => {
        const bp = save.pets.find((p) => p.id === boxPetId);
        if (bp) toggleFollowerInPause(bp);
      },
      onSetFollowerSkill: (fid, slot, sid) => setFollowerSkillSlot(fid, slot, sid),
      onChangeTactics: (patch) => {
        sound.play('cursor');
        setTactics((t) => ({ ...t, ...patch }));
      },
      onChangeCamPreset: (preset) => {
        applyCameraFollowMode(preset === 'close' ? 'chase' : 'hd2d', true);
      },
      onResumeBattle: () => {
        pausedRef.current = false;
      },
      onSettleAndExit: () => {
        onFinish(pet.id, buildPayload(false), false);
        setPhase('hub');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hud, followersView, tactics, camPreset, regionMeta.name, diffMeta.label, save.pets]);

  useArenaKeyboardHotkeys({ CAM_MODE_META, activeBusStopModal, banishMode, banishedIdsRef, buySafeShopItem, camFollowModeRef, camOrbitRef, canvasRef, captureOffer, closeHubModal, closeMapSelect, closeProfileModal, closeResultAndRun, closeShopModal, closeSquadEditor, cycleCameraFollowMode, cycleInteractOptionRef, cycleRideMode, endedRef, externalPausedRef, handleCaptureBossConfirm, handleChooseUpgrade, handleLaunchRandomRogueRun, handleLaunchRun, hubModal, hud, inRunTownShopOpen, jumpQueuedRef, keysRef, levelChoices, nearbyKoIdRef, onFinish, onOpenPokemonManager, pausedRef, pet, phase, profileOpen, programmaticUnlockRef, rebuildChoicesRef, rerollsLeft, restorePointerLockRef, resultSummary, save, setActiveBusStopModal, setBanishMode, setClosingLevelUp, setInRunTownShopOpen, setLevelChoices, setPhase, setRerollsLeft, setRunNonce, setShopOpen, setTimeAlmanacOpen, setWorldMapOpen, shopOpen, showBanner, simRef, squadEditorOpen, timeAlmanacOpenRef, toggleWorldMap, triggerBattleActionRef, triggerInteractRef, triggerSafeHeal, tryRestorePointerLock, worldMapOpenRef });
  const bgmTrackLabel = bgmState.songTitle || '晴空微风 · 城镇漫步';
  const arenaUiCtx = { activeBgmTrack, activeBusStopModal, activeHeroDef, activeRoom, activeSquadIdx, activeSquadPreset, activeWorldRun, adventureStyle, askQuickNavOpen, autoNavActiveLabel, autoNavDistM, autoNavEtaSec, autoNavTargetsRef, banishMode, banishedIdsRef, bannerMsg, bgmState, bgmTrackLabel, bindMultiTouchAction, buySafeShopItem, captureCutscene, captureOffer, claimableBountyCount, closeHubModal, closeMapSelect, closeProfileModal, closeResultAndRun, closeShopModal, closeSquadEditor, closingCapture, closingHubModal, closingLevelUp, closingMapSelect, closingProfile, closingResult, closingShop, closingSquadEditor, cycleLanguage, cycleRideMode, diffMeta, difficultyId, dockRowRef, dragFollowerIdxRef, dragOverFollowerIdx, edgeIndicators, effectiveSquadPets, endedRef, executeInteractActionRef, externalPaused, floatingTags, followersView, gameMode, handleBgmCycleMode, handleBgmNext, handleBgmPlayPause, handleBgmPrev, handleBuyLabUpgrade, handleCaptureBossConfirm, handleChooseUpgrade, handleClaimBonusChest, handleClaimBounty, handleFastTravelCity, handleLaunchRandomRogueRun, handleLaunchRun, handleLaunchWorldRun, handleRerollBounty, handleUnlockOrSelectHero, handleUpgradeHeroSkill, hpPct, hubModal, hud, inRunTownShopOpen, interactOptionIdx, isFullscreen, isSurfing, jumpQueuedRef, labInitialTab, landRideMode, lang, levelChoices, liveOverlandCity, liveWeather, mapSnapshot, maxFollowers, meta, minStr, mobilePartyOpen, nearbyInteract, nearbyKoTarget, newsTickerIdx, onBuyAccessory, onBuyFood, onBuyPokeball, onFinish, onOpenPokemonManager, onPullGacha, onPullGachaTen, onToggleBgm, onToggleFullscreen, onUpdateMeta, onUpdatePetConfig, onUpdatePrefs, onUpdateProfile, openHeroOrBadgeOverlay, pausedRef, pet, petMeta, petStage, phase, playerAltitudeM, prefs, profileDraft, profileOpen, projectedBubbles, pwaInstallPrompt, rebuildChoicesRef, regionMeta, removeBattleFollower, reorderBattleFollowers, rerollsLeft, resetVirtualPad, resultModal, resultSummary, rideMode, save, selectSquadPreset, selectedBallId, selectedBiome, setActiveBusStopModal, setAskQuickNavOpen, setBanishMode, setClosingLevelUp, setDifficultyId, setDragOverFollowerIdx, setGameMode, setHubModal, setInRunTownShopOpen, setInteractOptionIdx, setLabInitialTab, setLevelChoices, setMobilePartyOpen, setPhase, setProfileDraft, setPwaInstallPrompt, setRerollsLeft, setRunNonce, setSelectedBallId, setSquadEditorOpen, setTimeAlmanacOpen, setWorldMapOpen, shopOpen, showBanner, simRef, solarInfo, squadEditorOpen, squadPresets, startAutoNavRef, startStreetDuelRef, startVirtualPad, stopAutoNavRef, teleportIntraCityBusRef, timeAlmanacOpen, togglePetInActiveSquad, toggleWorldMap, totalSpendableCoins, trainerProfile, triggerBattleActionRef, triggerInteractRef, tryRestorePointerLock, updateVirtualPad, vPad, vPadPointerRef, visibleDockCount, worldBubblesRef, worldMapOpen, xpPct };

  return (
    <div ref={containerRef} className="world3d-stage">
      {/* FULL-VIEWPORT LIVE 3D PIXEL-ART TERRACED WORLD CANVAS (Click-to-Pointer-Lock Mouse Look + Left/Right-Drag Orbit + Wheel Zoom!) */}
      <canvas
        ref={canvasRef}
        className={`world3d-canvas ${pointerLocked ? 'is-pointer-locked' : ''}`}
        onContextMenu={(e) => {
          if (phase === 'playing') e.preventDefault();
        }}
        onWheel={(e) => {
          // Trackpad pinch is a browser zoom gesture, not a camera wheel.
          if (e.ctrlKey || e.metaKey || phase !== 'playing' || pausedRef.current) return;
          const nextZoom = Math.max(0.58, Math.min(1.48, camOrbitRef.current.zoom + e.deltaY * 0.00085));
          camOrbitRef.current.zoom = nextZoom;
        }}
        onPointerDown={(e) => {
          if (phase !== 'playing' || pausedRef.current) return;
          if (document.pointerLockElement === canvasRef.current) return;
          // Never steal pointer while left-hand joystick owns this pointerId or camera drag is already active
          if (vPadPointerRef.current === e.pointerId || camDragPointerRef.current !== null) return;
          if (e.button === 2) e.preventDefault();
          camDragPointerRef.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          camDragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            dragged: false,
          };
        }}
        onPointerMove={(e) => {
          if (phase !== 'playing' || pausedRef.current) return;
          if (document.pointerLockElement === canvasRef.current) return;
          if (!camDragRef.current.active || camDragPointerRef.current !== e.pointerId) return;
          const dx = e.clientX - camDragRef.current.lastX;
          const dy = e.clientY - camDragRef.current.lastY;
          camDragRef.current.lastX = e.clientX;
          camDragRef.current.lastY = e.clientY;
          if (
            Math.hypot(
              e.clientX - camDragRef.current.startX,
              e.clientY - camDragRef.current.startY,
            ) > 4
          ) {
            camDragRef.current.dragged = true;
          }
          camOrbitRef.current.yaw -= dx * 0.0055;
          camOrbitRef.current.pitch = Math.max(
            0.1,
            Math.min(MAX_CAM_PITCH, camOrbitRef.current.pitch + dy * 0.0045),
          );
        }}
        onPointerUp={(e) => {
          if (camDragPointerRef.current !== e.pointerId) return;
          camDragPointerRef.current = null;
          const wasClick = camDragRef.current.active && !camDragRef.current.dragged;
          if (camDragRef.current.active) {
            camDragRef.current.active = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // already released
            }
          }
          pointerSteerRef.current.active = false;
          // Standard PC 3D Free-Look ONLY (Desktop mouse): never enter pointer-lock focus mode on touch/mobile!
          const isDesktopMouse =
            e.pointerType === 'mouse' &&
            !window.matchMedia?.('(pointer: coarse)').matches &&
            window.innerWidth > 960 &&
            window.innerHeight > 560;
          if (
            isDesktopMouse &&
            wasClick &&
            e.button === 0 &&
            phase === 'playing' &&
            !pausedRef.current &&
            !externalPausedRef.current &&
            document.pointerLockElement !== canvasRef.current
          ) {
            try {
              const plRes = canvasRef.current?.requestPointerLock?.() as unknown as Promise<void> | undefined;
              if (plRes && typeof plRes.catch === 'function') {
                plRes.catch(() => {
                  // fallback drag orbit remains active seamlessly
                });
              }
            } catch {
              // fallback drag orbit remains active seamlessly
            }
          }
        }}
        onPointerLeave={() => {
          pointerSteerRef.current.active = false;
        }}
      />

      <ArenaHubAndMapOverlay ctx={arenaUiCtx} />
      {phase === 'playing' && (
        <>
          <ArenaPlayingHudOverlay ctx={arenaUiCtx} />
          <ArenaRunModalsOverlay ctx={arenaUiCtx} />
        </>
      )}

      {/* Iconic Red-and-White Poké Ball Clasp Shutter Loading Transition! */}
      <PokeballShutterOverlay state={pokeballShutter} save={save} />
    </div>
  );
};
