import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { computeBattleStats } from '../data/battleMoves';
import {
  ACHIEVEMENTS,
  POKEDEX_ORDER,
  ROOM_CATALOG,
  SPECIES_CATALOG,
  getGrowthStage,
  getPokemonCryId,
  getPokemonPhysicalMetrics,
  getPokemonWorldScale3D,
} from '../data/catalog';
import {
  DEFAULT_TACTICAL_CONFIG,
  DIFFICULTIES,
  ENEMY_TRAINER_ROSTER,
  LAKE_BASINS_3D,
  MAP_REGIONS,
  SAFE_ZONE_3D_RADIUS,
  SURVIVOR_SKILLS,
  TERRACE_CELL,
  WATER_LEVEL_3D,
  WORLD_SECTOR_SIZE,
  WORLD_TOWNS_3D,
  getDefaultSkillsForElement,
  getRawNaturalTerrainHeight3D,
  getTerrainHeight3D,
  getUnlockedSkillSlotCount,
  getWalkableSurfaceHeight3D,
  isOnInterTownRoad3D,
  type DifficultyId,
  type LiveRunTacticsBridge,
  type SafeZone3D,
  type SurvivorSkillId,
  type SurvivorsGameMode,
  type TacticalConfig,
  type TargetPriority,
} from '../data/survivorsTactics';
import {
  BIOME_PALETTES,
  createHorizonBackdropMesh,
  createPixelWaterMaterial,
  createSculptedTerrainMaterial,
  getAnimatedGifTextures,
  getBiomeTextures,
  getHeroSpriteFrames,
  getPixelEmoteTexture,
  getSeamlessBiomeAt3D,
  sampleAnimatedFrame,
  type AnimatedSpriteSheet3D,
  type BiomeId,
} from '../data/worldTextures3D';
import { MAX_PET_SLOTS } from '../utils/petEngine';
import { getSkillVfxAtlas } from '../data/skillVfx3D';
import {
  extractDexIdFromSpriteUrl,
  getPmd8DirSheet,
  pickPmdDirIndex,
  samplePmd8DirFrame,
  type Pmd8DirSheet3D,
} from '../data/pmdSprites3D';
import type { FacingDir } from '../data/overworldTiles';
import {
  GEO_UNITS_PER_KM,
  detectOverlandCityAt,
  getActiveGeoTerrainOrigin,
  setActiveGeoTerrainOrigin,
  subscribeGeoDemLoaded,
} from '../data/geoTerrain3D';
import {
  DEFAULT_WORLD_TOUR_STATE,
  WORLD_CITIES,
  getDefaultHomeByLanguage,
  type WorldCityDef,
} from '../data/worldTour';
import { WorldMapOverlay, type WorldLaunchPayload } from './WorldMapOverlay';
import {
  DEFAULT_GAME_PREFS,
  DEFAULT_TRAINER_PROFILE,
  type GamePrefs,
  type GameSave,
  type LcdMode,
  type PetRecord,
  type PetSkinId,
  type SpeciesId,
  type TrainerProfile,
} from '../types/pet';
import {
  GYM_BADGE_CATALOG,
  HERO_ROSTER,
  LAB_UPGRADES,
  computeMetaCombatBonuses,
  countClaimableBounties,
  ensureFreshMetaProgress,
  getActiveTrainerTagDef,
  getElementalSynergyBonus,
  getHeroDef,
  getLabUpgradeCost,
  getSkinDef,
  rerollBountySlot,
  type GymBadgeId,
  type HeroId,
  type LabUpgradeId,
  type MetaProgressState,
  type TrainerTagId,
} from '../data/metaProgression';
import { LANG_LABELS, tr, type AppLang } from '../data/i18n';
import { BountiesOverlay, DEFAULT_ANNOUNCEMENTS, HubInfoModal, LabOverlay } from './MetaOverlays';
import { ShopOverlay } from './ShopOverlay';
import { WorldMapHud, type LiveMapSnapshot, type WorldMapData } from './WorldMapHud';
import type { GachaOutcome, GachaTenOutcome, SurvivorsResultPayload } from '../utils/petEngine';
import type { AccessoryId, FoodId, GachaBoxId, RoomThemeId } from '../types/pet';
import { sound } from '../utils/sound';
import { hashCitySeed } from '../utils/townStreetGen';
import {
  buildInterTownRoadNetwork3D,
  buildProceduralTown3D,
  computeCameraWallClipT,
  isInsideBuildingInterior,
  resolveTownWallCollisions,
  setBuildingExteriorOpacity,
  type ProceduralTownInstance,
  type TownInteractPoint,
} from '../utils/townBuilder3D';
import {
  buildFallbackWeather,
  buildWeatherInfo,
  fetchLiveWeatherAt,
  getWeatherCombatBonus,
  type LiveWeatherInfo,
  type WeatherKind,
} from '../utils/weatherSystem';
import { PixelIcon, PixelItemImg } from './PixelSprite';
import { TrimmedSpriteImg } from './TrimmedSpriteImg';

// Shared bottom-anchored unit quad (y: 0 -> 1) so EVERY standing character, Pokémon, tree & flora prop
// stands upright as a cylindrical Y-billboard with authentic 3D top-down foreshortening (压缩感) and feet locked to the ground!
const UPRIGHT_QUAD_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0, 0.5, 0);
  return g;
})();
const UNIT_SHADOW_GEO = new THREE.CircleGeometry(1, 14);
const SHARED_TREE_SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x0e1c10,
  transparent: true,
  opacity: 0.36,
});
const SHARED_ENTITY_SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x101c12,
  transparent: true,
  opacity: 0.45,
});
const MAX_CAM_PITCH = 1.48; // ~84.8° (near top-down, strictly < 90° so view compresses naturally without flipping!)
const BILLBOARD_PITCH_TILT = 0.18; // Gentle 18% tilt so 85° top-down yields crisp ~65% vertical compression without disappearing!

type MonsterQuality = 'normal' | 'uncommon' | 'elite' | 'epic';
const MONSTER_QUALITY_META: Record<
  MonsterQuality,
  { label: string; color: string; hex: number; hpMult: number; dmgMult: number; scaleMult: number; lootMult: number }
> = {
  normal: { label: '', color: '#ffffff', hex: 0xffffff, hpMult: 1.0, dmgMult: 1.0, scaleMult: 1.0, lootMult: 1.0 },
  uncommon: { label: '精良', color: '#51cf66', hex: 0x51cf66, hpMult: 1.55, dmgMult: 1.15, scaleMult: 1.12, lootMult: 1.8 },
  elite: { label: '稀有', color: '#748ffc', hex: 0x748ffc, hpMult: 2.55, dmgMult: 1.32, scaleMult: 1.24, lootMult: 3.0 },
  epic: { label: '史诗', color: '#ffd43b', hex: 0xffd43b, hpMult: 4.1, dmgMult: 1.48, scaleMult: 1.38, lootMult: 5.0 },
};

function rollMonsterQuality(elapsedSec: number): MonsterQuality {
  const r = Math.random();
  const epicChance = Math.min(0.055, 0.02 + elapsedSec * 0.00018);
  const eliteChance = Math.min(0.14, 0.075 + elapsedSec * 0.00035);
  const uncommonChance = 0.17;
  if (r < epicChance) return 'epic';
  if (r < epicChance + eliteChance) return 'elite';
  if (r < epicChance + eliteChance + uncommonChance) return 'uncommon';
  return 'normal';
}

interface Survivors3DArenaProps {
  save: GameSave;
  pet: PetRecord;
  analogVecRef: React.MutableRefObject<{ x: number; y: number }>;
  externalPaused?: boolean;
  onFinish: (petId: string, payload: SurvivorsResultPayload, returnToRoom?: boolean) => void;
  onHealParty: () => void;
  onSpendCoinsInRun: (cost: number) => boolean;
  onCaptureBoss?: (species: SpeciesId, level: number, skin?: PetSkinId) => void;
  onShowCaptureInHandheld?: (
    info: import('../types/pet').CaptureRevealPayload,
    onClosed?: () => void,
  ) => void;
  onSyncWorldMapData?: (data: WorldMapData | null) => void;
  onOpenPokemonManager: (subMode?: LcdMode, fromBattle?: boolean, focusPetId?: string) => void;
  onSyncTacticsBridge?: (bridge: LiveRunTacticsBridge | null) => void;
  onUpdateProfile?: (patch: Partial<TrainerProfile>) => void;
  onUpdatePrefs?: (patch: Partial<GamePrefs>) => void;
  onUpdateMeta?: (updater: (prev: MetaProgressState) => MetaProgressState, coinDelta?: number) => void;
  onBuyFood?: (foodId: FoodId) => void;
  onBuyAccessory?: (id: AccessoryId) => void;
  onBuyPokeball?: (roomId: RoomThemeId) => void;
  onPullGacha?: (boxId: GachaBoxId) => GachaOutcome;
  onPullGachaTen?: (boxId: GachaBoxId) => GachaTenOutcome;
  onUpdatePetConfig?: (
    petId: string,
    patch: {
      skin?: PetSkinId;
      skinCost?: number;
      unlockSkin?: string;
    },
  ) => boolean;
  onBackLayerActiveChange?: (active: boolean) => void;
  onRegisterBackHandler?: (handler: (() => boolean) | null) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface ActiveFollower {
  id: string;
  sourcePetId?: string;
  species: SpeciesId;
  name: string;
  stage: 'baby' | 'teen' | 'adult';
  level: number;
  skin?: PetSkinId;
  skills: SurvivorSkillId[];
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  wanderX: number;
  wanderZ: number;
  wanderTimer: number;
  castAnim: number;
  animTime: number;
  animSheet?: AnimatedSpriteSheet3D;
  backAnimSheet?: AnimatedSpriteSheet3D;
  pmdSheet?: Pmd8DirSheet3D;
  faceX?: number;
  faceZ?: number;
  damageDealt: number;
  kills: number;
  casts: number;
  cds: number[];
  orbitAngle: number;
  facingLeft: boolean;
  dashTimer?: number;
  dashCd?: number;
  dashVx?: number;
  dashVz?: number;
  dashHitIds?: Set<number>;
  sprite?: THREE.Mesh;
  shadow?: THREE.Mesh;
  leafMeshes?: THREE.Sprite[];
}

interface Enemy3D {
  id: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  species: SpeciesId;
  stage: 'baby' | 'teen' | 'adult';
  worldScale: number;
  quality: MonsterQuality;
  isShiny: boolean;
  regionalSkin?: PetSkinId;
  isBoss: boolean;
  isTrainer: boolean;
  trainerSprite?: string;
  trainerName?: string;
  shootCd: number;
  hitFlash: number;
  dmg: number;
  hopPhase: number;
  animTime: number;
  animSheet?: AnimatedSpriteSheet3D;
  backAnimSheet?: AnimatedSpriteSheet3D;
  pmdSheet?: Pmd8DirSheet3D;
  faceX?: number;
  faceZ?: number;
  sprite?: THREE.Mesh;
  shadow?: THREE.Mesh;
  auraRing?: THREE.Mesh;
  shinyTimer?: number;
  knockedOut?: boolean;
  koTimer?: number;
  beingCaptured?: boolean;
  bossPhase2?: boolean;
  attackCount?: number;
  temperament?: 'docile' | 'territorial' | 'aggressive';
  aggroed?: boolean;
  homeX?: number;
  homeZ?: number;
  isAquatic?: boolean;
  waterJumpTimer?: number;
}

interface ActiveCapture3D {
  id: number;
  enemy: Enemy3D;
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  t: number;
  willCatch: boolean;
  wobbleClicks: number;
  absorbed: boolean;
  resolved: boolean;
  ballSprite: THREE.Sprite;
  ballShadow: THREE.Mesh;
}

interface Projectile3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  dmg: number;
  radius: number;
  pierce: number;
  life: number;
  animTime: number;
  fromEnemy?: boolean;
  ownerId?: string;
  skillId?: SurvivorSkillId;
  colorHex: number;
  trailTimer: number;
  frames: THREE.CanvasTexture[];
  sprite: THREE.Sprite;
  glow: THREE.Mesh;
}

interface Loot3D {
  x: number;
  z: number;
  kind: 'xp' | 'coin' | 'berry' | 'magnet';
  value: number;
  phase: number;
  mesh: THREE.Mesh;
}

interface Vfx3D {
  kind: 'decal_wave' | 'sprite_burst' | 'particle' | 'lightning' | 'glow_flash';
  life: number;
  maxLife: number;
  maxRadius?: number;
  baseScale?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  gravity?: number;
  frames?: THREE.CanvasTexture[];
  mesh: THREE.Object3D;
}

interface FollowerReportRow {
  id: string;
  species: SpeciesId;
  name: string;
  level: number;
  sprite: string;
  skills: [SurvivorSkillId, SurvivorSkillId];
  damageDealt: number;
  kills: number;
  casts: number;
}

interface RunResultSummary {
  payload: SurvivorsResultPayload;
  totalDamage: number;
  dps: number;
  trainersDefeated: number;
  capturedBoss: { species: SpeciesId; name: string; level: number } | null;
  squadReport: FollowerReportRow[];
}

interface FloatingTag2D {
  id: number;
  sx: number;
  sy: number;
  text: string;
  color: string;
  isHpBar?: boolean;
  hpPct?: number;
}

interface LevelChoice {
  kind: 'upgrade_follower' | 'passive' | 'item';
  id: string;
  title: string;
  desc: string;
  sprite: string;
  badge: string;
  color: string;
  followerId?: string;
  passiveId?: 'speed' | 'vitality' | 'atk' | 'haste' | 'greed';
  itemId?: 'super_potion' | 'rare_candy_boost' | 'salvo_charge' | 'coin_pouch';
}

type ArenaScreenPhase = 'hub' | 'map_select' | 'world_map' | 'playing';

const MAX_FOLLOWERS = 6;

/** Builds a textured 3D Roadside Safe Zone (Pixel Cobblestone Plaza + Emerald Barrier + PokeCenter + PokeMart) */
function createSafeZone3DMesh(zone: SafeZone3D, plazaTex: THREE.CanvasTexture): {
  group: THREE.Group;
  ring: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.position.set(zone.x, 0, zone.z);
  const mat = (hex: number, emissive = 0x000000) =>
    new THREE.MeshLambertMaterial({ color: hex, emissive });

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(zone.radius - 0.2, zone.radius, 0.22, 32),
    new THREE.MeshLambertMaterial({ map: plazaTex }),
  );
  plaza.position.y = 0.05;
  group.add(plaza);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(zone.radius - 0.45, zone.radius + 0.12, 40),
    new THREE.MeshBasicMaterial({
      color: 0x40c057,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  group.add(ring);

  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.8, 8), mat(0x2b8a3e, 0x164a22));
    pylon.position.set(Math.cos(a) * (zone.radius - 0.4), 0.9, Math.sin(a) * (zone.radius - 0.4));
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42),
      new THREE.MeshBasicMaterial({ color: 0x8ce99a }),
    );
    crystal.position.set(pylon.position.x, 2.15, pylon.position.z);
    group.add(pylon, crystal);
  }

  // Sculpted 3D Red-Roofed Pokémon Center (Rounded Dome Roof + Clean Facade)
  const pc = new THREE.Group();
  pc.position.set(-4.1, 0.16, -3.5);
  const pcWall = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.5, 3.6), mat(0xf8f8f0));
  pcWall.position.y = 1.25;
  const pcRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.6, 1.5, 4),
    mat(0xe03131),
  );
  pcRoof.rotation.y = Math.PI / 4;
  pcRoof.scale.set(1.25, 1, 0.92);
  pcRoof.position.y = 3.2;
  const pcSign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.05, 0.24), mat(0xffffff, 0x222222));
  pcSign.position.set(0, 3.1, 2.02);
  const pcBallTop = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.38, 0.26), mat(0xe03131));
  pcBallTop.position.set(0, 3.28, 2.05);
  const pcDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.65, 0.14), mat(0x3888d8, 0x0d3666));
  pcDoor.position.set(0, 0.82, 1.82);
  const pcWinL = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.14), mat(0x74c0fc, 0x164a78));
  pcWinL.position.set(-1.68, 1.32, 1.82);
  const pcWinR = pcWinL.clone();
  pcWinR.position.x = 1.68;
  pc.add(pcWall, pcRoof, pcSign, pcBallTop, pcDoor, pcWinL, pcWinR);
  group.add(pc);

  // Sculpted 3D Blue-Roofed Poké Mart
  const mart = new THREE.Group();
  mart.position.set(4.1, 0.16, -3.5);
  const mWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.35, 3.5), mat(0xf4f8fc));
  mWall.position.y = 1.18;
  const mRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.1, 1.4, 4),
    mat(0x228be6),
  );
  mRoof.rotation.y = Math.PI / 4;
  mRoof.scale.set(1.2, 1, 0.92);
  mRoof.position.y = 3.0;
  const mSign = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.98, 0.24), mat(0xffffff, 0x222222));
  mSign.position.set(0, 2.95, 1.92);
  const mBadge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.58, 0.26), mat(0x228be6));
  mBadge.position.set(0, 2.95, 1.95);
  const mDoor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.14), mat(0x3b5bdb, 0x102266));
  mDoor.position.set(0, 0.8, 1.76);
  mart.add(mWall, mRoof, mSign, mBadge, mDoor);
  group.add(mart);

  return { group, ring };
}

/** Builds an upright Y-billboard HD-2D pixel-art tree with shared geometry/material & grounded shadow */
function createLushTreeSprite3D(
  treeMat: THREE.MeshBasicMaterial,
  variantIdx: number,
  flipX: boolean,
): { group: THREE.Group; billboard: THREE.Mesh } {
  const g = new THREE.Group();
  const billboard = new THREE.Mesh(UPRIGHT_QUAD_GEO, treeMat);
  billboard.rotation.order = 'YXZ';
  // Distinct proportions per tree species (Oak, Tall Pine, Berry Canopy, Wide Elder, Compact Sapling, Cherry Blossom)
  const dims: [number, number][] = [
    [5.0, 6.2], // Oak
    [4.4, 6.8], // Tall Pine
    [5.3, 6.2], // Berry Tree
    [5.6, 6.4], // Wide Twin Elder
    [3.8, 4.7], // Compact Sapling
    [5.2, 6.1], // Cherry Blossom
    [5.4, 6.4], // Autumn Maple
    [5.5, 6.5], // Weeping Willow
    [4.2, 6.9], // Tall Silver Birch
    [5.6, 6.3], // Lavender Wisteria
  ];
  const [w, h] = dims[variantIdx % dims.length];
  billboard.scale.set(flipX ? -w : w, h, 1);
  billboard.position.y = -0.06;
  const shadow = new THREE.Mesh(UNIT_SHADOW_GEO, SHARED_TREE_SHADOW_MAT);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.setScalar(w * 0.34);
  shadow.position.y = 0.06;
  g.add(shadow, billboard);
  return { group: g, billboard };
}

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
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const meta = ensureFreshMetaProgress(save.meta);
  const metaRef = useRef<MetaProgressState>(meta);
  metaRef.current = meta;
  const savePetsCountRef = useRef(save.pets.length);
  savePetsCountRef.current = save.pets.length;
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
    if (meta.stardust < cost) {
      sound.play('error');
      return;
    }
    sound.play('levelup');
    onUpdateMeta?.((prev) => ({
      ...prev,
      stardust: Math.max(0, prev.stardust - cost),
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
    if (meta.stardust < def.unlockCost) {
      sound.play('error');
      return;
    }
    sound.play('hatch');
    onUpdateMeta?.((prev) => ({
      ...prev,
      stardust: Math.max(0, prev.stardust - def.unlockCost),
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
    if (meta.stardust < cost) {
      sound.play('error');
      return;
    }
    sound.play(curLv + 1 >= sk.maxLevel ? 'hatch' : 'levelup');
    onUpdateMeta?.((prev) => ({
      ...prev,
      stardust: Math.max(0, prev.stardust - cost),
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

  // Multi-Layer Flow: Main Hub -> Map Select / World Map Tour -> Live 3D Playing
  const [phase, setPhase] = useState<ArenaScreenPhase>('hub');
  const [activeWorldRun, setActiveWorldRun] = useState<WorldLaunchPayload | null>(null);
  const [liveOverlandCity, setLiveOverlandCity] = useState<WorldCityDef | null>(null);
  const liveOverlandCityRef = useRef<WorldCityDef | null>(null);
  const overlandCityIdRef = useRef<string | null>(null);
  const [selectedBiome, setSelectedBiome] = useState<BiomeId>('verdant_forest');
  const [gameMode, setGameMode] = useState<SurvivorsGameMode>('story');
  const [difficultyId, setDifficultyId] = useState<DifficultyId>('normal');
  const [camPreset, setCamPreset] = useState<'wide' | 'close'>('wide');
  const camPresetRef = useRef<'wide' | 'close'>('wide');
  // Standard PC 3D Third-Person Camera (Click-to-Pointer-Lock Mouse Look + Left/Right-Drag Orbit Fallback + Wheel Zoom + Terrain Clamp!)
  const [pointerLocked, setPointerLocked] = useState(false);
  const restorePointerLockRef = useRef(false);
  const camOrbitRef = useRef({ yaw: 0, pitch: 0.24, zoom: 1.0 });
  const camPivotRef = useRef(new THREE.Vector3(0, 1.55, 0));
  const camSmoothZoomRef = useRef(1.0);
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
  const [launchFlashSeq, setLaunchFlashSeq] = useState(0);
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
  const [nearbyInteract, setNearbyInteract] = useState<{
    id: string;
    kind:
      | 'mushroom'
      | 'berry_tree'
      | 'ore_rock'
      | 'signpost'
      | 'pokemon_center'
      | 'poke_mart'
      | 'transit_station'
      | 'npc_chat'
      | 'hotel_rest'
      | 'restaurant';
    label: string;
    hp: number;
    maxHp: number;
    icon: string;
  } | null>(null);
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
    const nextPetIds = sim.followers
      .map((f) => f.sourcePetId)
      .filter((id): id is string => Boolean(id));
    if (nextPetIds.length > 0 && onUpdateMeta) {
      onUpdateMeta((prev) => {
        const list = prev.squadPresets && prev.squadPresets.length > 0 ? prev.squadPresets : squadPresets;
        const idx = Math.min(list.length - 1, Math.max(0, prev.activeSquadIdx ?? activeSquadIdx));
        const nextList = list.map((pr, i) => (i === idx ? { ...pr, petIds: nextPetIds } : pr));
        return { ...prev, squadPresets: nextList, activeSquadIdx: idx };
      });
    }
  };
  const toggleWorldMap = () => {
    sound.play('confirm');
    onSyncWorldMapData?.({
      biome: selectedBiome,
      regionName: regionMeta.name,
      snapshot: mapSnapshot,
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
    const onLockChange = () => {
      setPointerLocked(document.pointerLockElement === canvasRef.current);
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

  const pausedRef = useRef(true);
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
      onUpdateMeta((prev) => {
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
      syncFollowersView();
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

  // Comprehensive Arcade Keyboard Hotkeys (WASD/Arrows + Space + 1/2/3/4 Events + Q/E/M + Enter/Esc!)
  useEffect(() => {
    const kb = save.keyBindings;
    const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (externalPausedRef.current) return;

      if (phase === 'hub') {
        if (hubModal !== 'none') {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeHubModal();
          }
          return;
        }
        if (profileOpen) {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeProfileModal();
          }
          return;
        }
        if (e.key === '1' || e.key === 'Enter') {
          e.preventDefault();
          sound.play('confirm');
          setGameMode('story');
          setPhase('map_select');
        } else if (e.key === '2') {
          e.preventDefault();
          sound.play('confirm');
          setGameMode('endless');
          setPhase('map_select');
        } else if (e.key === '3') {
          e.preventDefault();
          sound.play('confirm');
          onOpenPokemonManager('home', false);
        }
        return;
      }

      if (phase === 'map_select') {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeMapSelect();
        } else if (e.key === 'Enter' || e.key === '1') {
          e.preventDefault();
          handleLaunchRun();
        }
        return;
      }
      if (phase !== 'playing') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        toggleWorldMap();
        return;
      }
      if (e.key.toLowerCase() === 'e') {
        if (nearbyKoIdRef.current !== null) {
          e.preventDefault();
          triggerBattleActionRef.current?.('capture_ko', nearbyKoIdRef.current);
          return;
        }
        if (triggerInteractRef.current) {
          e.preventDefault();
          triggerInteractRef.current();
          return;
        }
      }
      if (e.key === 'Alt' && document.pointerLockElement === canvasRef.current) {
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore
        }
        return;
      }
      const k = norm(e.key);

      // 1. Fullscreen Settlement Hotkeys (1: Replay, 2/Enter: Hub, 3: Manager)
      if (resultSummary) {
        if (k === '1') {
          e.preventDefault();
          closeResultAndRun(() => {
            onFinish(pet.id, resultSummary.payload, false);
            endedRef.current = false;
            pausedRef.current = false;
            setRunNonce((n) => n + 1);
          });
        } else if (k === '2' || e.key === 'Enter') {
          e.preventDefault();
          closeResultAndRun(() => {
            onFinish(pet.id, resultSummary.payload, false);
            setPhase('hub');
          });
        } else if (k === '3') {
          e.preventDefault();
          closeResultAndRun(() => {
            onFinish(pet.id, resultSummary.payload, true);
          });
        }
        return;
      }

      // 2. Boss Capture Hotkeys (1/Enter: Catch, 2/Esc: Skip)
      if (captureOffer) {
        if (k === '1' || e.key === 'Enter') {
          e.preventDefault();
          handleCaptureBossConfirm(true);
        } else if (k === '2' || e.key === 'Escape') {
          e.preventDefault();
          handleCaptureBossConfirm(false);
        }
        return;
      }

      // 3. Level-Up 3-Choice Horizontal Draft Hotkeys (1/2/3 Pick, F Reroll, X Skip, Z Banish)
      if (levelChoices) {
        const idx = k === '1' ? 0 : k === '2' ? 1 : k === '3' ? 2 : -1;
        if (idx >= 0 && levelChoices[idx]) {
          e.preventDefault();
          if (banishMode) {
            banishedIdsRef.current.add(levelChoices[idx].id);
            setBanishMode(false);
            sound.play('cancel');
            if (rebuildChoicesRef.current) setLevelChoices(rebuildChoicesRef.current());
          } else {
            handleChooseUpgrade(levelChoices[idx]);
          }
        } else if (k === 'f' && rerollsLeft > 0 && rebuildChoicesRef.current) {
          e.preventDefault();
          sound.play('confirm');
          setRerollsLeft((r) => Math.max(0, r - 1));
          setLevelChoices(rebuildChoicesRef.current());
        } else if (k === 'x') {
          e.preventDefault();
          sound.play('coin');
          if (simRef.current) simRef.current.coins += 15;
          setClosingLevelUp(true);
          tryRestorePointerLock();
          window.setTimeout(() => {
            setClosingLevelUp(false);
            setLevelChoices(null);
            pausedRef.current = false;
          }, 155);
        } else if (k === 'z') {
          e.preventDefault();
          sound.play('cursor');
          setBanishMode((b) => !b);
        }
        return;
      }

      // 4. Safe Zone Poké Mart Hotkeys (1-4 Buy, Esc Close)
      if (shopOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeShopModal();
        } else if (k === '1') {
          e.preventDefault();
          if (hud.hp < hud.maxHp) buySafeShopItem('potion', 15);
        } else if (k === '2') {
          e.preventDefault();
          buySafeShopItem('summon', 35);
        } else if (k === '3') {
          e.preventDefault();
          buySafeShopItem('tome', 30);
        } else if (k === '4') {
          e.preventDefault();
          buySafeShopItem('berry', 25);
        }
        return;
      }

      // 5. Live 3D Combat Quick Event Hotkeys
      if (k === '1' && hud.inSafeZone) {
        e.preventDefault();
        triggerSafeHeal();
        return;
      }
      if (k === '2' && hud.inSafeZone) {
        e.preventDefault();
        pausedRef.current = true;
        sound.play('confirm');
        setShopOpen(true);
        return;
      }
      if (k === 'Escape' || k === 'p' || k === 'q') {
        e.preventDefault();
        sound.play('cursor');
        onOpenPokemonManager('tactics', true);
        return;
      }
      if (k === 'f') {
        e.preventDefault();
        sound.play('cursor');
        onOpenPokemonManager('home', true);
        return;
      }
      if (k === 'm') {
        e.preventDefault();
        sound.play('cursor');
        onOpenPokemonManager('menu', true);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        toggleWorldMap();
        return;
      }
      if (k === 'r') {
        e.preventDefault();
        camOrbitRef.current = { yaw: 0, pitch: 0.24, zoom: 1.0 };
        showBanner('3D 视角已复位', 1200);
        return;
      }
      if (k === 'z' || k === '[' || k === 'c' || k === ']') {
        e.preventDefault();
        keysRef.current.add(k);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (!pausedRef.current) jumpQueuedRef.current = true;
        return;
      }
      if (!pausedRef.current) {
        if (k === 'c') {
          e.preventDefault();
          triggerBattleActionRef.current?.('ball');
          return;
        }
        if (k === 'v') {
          e.preventDefault();
          triggerBattleActionRef.current?.('heal');
          return;
        }
        if (k === 'b') {
          e.preventDefault();
          triggerBattleActionRef.current?.('boost');
          return;
        }
        if (k === 'g') {
          e.preventDefault();
          triggerBattleActionRef.current?.('salvo');
          return;
        }
      }
      if (
        k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' ||
        k === 'w' || k === 'a' || k === 's' || k === 'd' ||
        (kb && [norm(kb.up), norm(kb.down), norm(kb.left), norm(kb.right)].includes(k))
      ) {
        e.preventDefault();
        keysRef.current.add(k);
        if (restorePointerLockRef.current && !pausedRef.current && !externalPausedRef.current) {
          tryRestorePointerLock();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(norm(e.key));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hubModal, profileOpen, squadEditorOpen, save.keyBindings, levelChoices, shopOpen, resultSummary, captureOffer, hud.inSafeZone, hud.hp, hud.maxHp]);

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

  useEffect(() => {
    const prefMode = save.prefs?.worldGameMode;
    if (prefMode && phase === 'hub' && prefMode !== gameMode) setGameMode(prefMode);
  }, [save.prefs?.worldGameMode, phase, gameMode]);

  // Live Real-Time Weather Sync (uses GPS Home / active World Tour city via Open-Meteo, or manual World Settings override!)
  useEffect(() => {
    let cancelled = false;
    const override = save.prefs?.worldWeatherMode;
    if (override && override !== 'auto') {
      const tempByKind: Record<WeatherKind, number> = {
        clear: 25,
        cloudy: 19,
        rain: 17,
        storm: 16,
        snow: -2,
        windy: 18,
      };
      setLiveWeather(
        buildWeatherInfo(
          override,
          tempByKind[override],
          override === 'windy' ? 34 : 12,
          'fallback',
          '世界设置指定',
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
      if (!cancelled) setLiveWeather(info);
    });
    return () => {
      cancelled = true;
    };
  }, [
    save.prefs?.worldWeatherMode,
    meta.worldTour?.currentCityId,
    meta.worldTour?.homeCoords?.lat,
    meta.worldTour?.homeCoords?.lng,
    lang,
  ]);

  // Mobile Back / Swipe-Back coordination with App.tsx
  const arenaHasCloseableLayer =
    phase !== 'hub' || hubModal !== 'none' || profileOpen || squadEditorOpen || shopOpen || inRunTownShopOpen;

  useEffect(() => {
    onBackLayerActiveChange?.(arenaHasCloseableLayer);
  }, [arenaHasCloseableLayer, onBackLayerActiveChange]);

  useEffect(() => {
    if (!onRegisterBackHandler) return;
    const handler = (): boolean => {
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
        // In live 3D adventure, pressing mobile Back opens the Handheld Tactics/Pause console
        // (matching desktop ESC) instead of accidentally abandoning the run!
        sound.play('cursor');
        onOpenPokemonManager('tactics', true);
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
    const initW = Math.max(462, container.clientWidth || window.innerWidth);
    const initH = Math.max(380, container.clientHeight || window.innerHeight);
    const maxDpr = prefsRef.current.powerSaver
      ? 1.0
      : prefsRef.current.graphicsQuality === 'low'
        ? 1.0
        : prefsRef.current.graphicsQuality === 'medium'
          ? 1.35
          : 2.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(initW, initH, false);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(pal.skyHex);
    scene.fog = new THREE.Fog(pal.fogHex, 82, 205);

    const camera = new THREE.PerspectiveCamera(64, initW / initH, 0.35, 250);
    camera.position.set(0, 4.8, 10.5);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(462, container.clientWidth || window.innerWidth);
      const h = Math.max(380, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);

    // Rich sunlit 3D Lighting
    const hemi = new THREE.HemisphereLight(pal.ambientHex, 0x3b7a42, 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(pal.sunHex, 1.08);
    sun.position.set(26, 38, 22);
    scene.add(sun);

    // 0. 360° Sunny Sky + Pixel Clouds + Layered Distant Mountain Skyline Ring!
    const horizonBackdrop = createHorizonBackdropMesh(selectedBiome);
    scene.add(horizonBackdrop);

    // 1. GRAND CONTINUOUS TOPOGRAPHIC HILLS, OPEN PLAINS & REAL DISTANT MOUNTAINS (196m real procedural terrain!)
    const TERRAIN_SIZE = 196;
    const TERRAIN_SEGS = prefsRef.current.graphicsQuality === 'low' ? 96 : 136;
    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainPosAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
    const terrainMat = createSculptedTerrainMaterial(selectedBiome, tex, WORLD_SECTOR_SIZE);
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrainMesh);

    // 1B. Terrain-Clipped Organic Water Sheet (Automatically conforms to EVERY natural FBM lake, bay, peninsula & winding river — ZERO circular discs!)
    const waterMat = createPixelWaterMaterial(selectedBiome);
    const waterPlaneGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE);
    waterPlaneGeo.rotateX(-Math.PI / 2);
    const waterPlaneMesh = new THREE.Mesh(waterPlaneGeo, waterMat);
    waterPlaneMesh.position.set(0, WATER_LEVEL_3D, 0);
    scene.add(waterPlaneMesh);

    const floatingLilyPads = new Set<{ mesh: THREE.Mesh; baseY: number; phase: number }>();
    const lilyMat = new THREE.MeshBasicMaterial({
      map: tex.lilyPad,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    });
    const lotusMat = new THREE.MeshBasicMaterial({
      map: tex.lilyLotus,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    });
    const cattailMat = new THREE.MeshBasicMaterial({
      map: tex.cattail,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide,
    });
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

    let lastChunkX = 99999;
    let lastChunkZ = 99999;

    // 2. Rich Organic Pixel-Art Flora, Toadstool Mushrooms, Flowers, Bushes & Tapered Pixel Trees!
    // Uses Shared Upright Y-Billboard MeshBasicMaterials (authentic 3D top-down foreshortening!) + 2-Tier LOD Streaming + Far Culling!
    const floraGroup = new THREE.Group();
    scene.add(floraGroup);

    // 2B. Real-Earth Metropolis at Active GPS City Origin (0, 0) (or Procedural Cities fallback)!
    const townsGroup = new THREE.Group();
    scene.add(townsGroup);
    const activeGeoNow = getActiveGeoTerrainOrigin();
    if (!activeGeoNow) {
      const roadNetGroup = buildInterTownRoadNetwork3D(
        (x, z) => getTerrainHeight3D(x, z),
        (x, z) => getRawNaturalTerrainHeight3D(x, z),
      );
      townsGroup.add(roadNetGroup);
    }
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
    const activeTownIdRef = { current: null as string | null };
    let lastPosPersistAt = 0;
    const isInsideAnyTownPlaza = (wx: number, wz: number, pad = 2.5) =>
      proceduralTowns.some((t) => Math.hypot(wx - t.centerX, wz - t.centerZ) < t.safeRadius + pad);

    // 2C. Live 3D Weather Particle System (Rain Streaks / Falling Snowflakes synced to real GPS/city weather!)
    const WEATHER_PARTICLE_COUNT = 180;
    const weatherPositions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
      weatherPositions[i * 3] = (Math.random() - 0.5) * 44;
      weatherPositions[i * 3 + 1] = Math.random() * 20;
      weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const weatherGeo = new THREE.BufferGeometry();
    weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPositions, 3));
    const weatherMat = new THREE.PointsMaterial({
      color: 0xa5d8ff,
      size: 0.34,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const weatherPoints = new THREE.Points(weatherGeo, weatherMat);
    weatherPoints.visible = false;
    scene.add(weatherPoints);
    const sharedFloraMatCache = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
    const getSharedFloraMat = (t: THREE.Texture, alphaTest = 0.15) => {
      let m = sharedFloraMatCache.get(t);
      if (!m) {
        m = new THREE.MeshBasicMaterial({
          map: t,
          transparent: true,
          alphaTest,
          side: THREE.DoubleSide,
        });
        sharedFloraMatCache.set(t, m);
      }
      return m;
    };
    const floraBillboards = new Set<THREE.Mesh>();
    let lastBbYaw = 999;
    let lastBbPitch = 999;
    let windClock = 0;
    const syncFloraBillboards = (yaw: number, pitch: number, windT = windClock) => {
      lastBbYaw = yaw;
      lastBbPitch = pitch;
      const tiltX = -pitch * BILLBOARD_PITCH_TILT;
      for (const bb of floraBillboards) {
        bb.rotation.x = tiltX;
        bb.rotation.y = yaw;
        const amp = bb.userData.swayAmp as number | undefined;
        if (amp) {
          const freq = (bb.userData.swayFreq as number | undefined) ?? 2.1;
          const phase = (bb.userData.swayPhase as number | undefined) ?? 0;
          const shake = (bb.userData.shakeTimer as number | undefined) ?? 0;
          const shakeOffset = shake > 0 ? Math.sin(windT * 42) * 0.16 * shake : 0;
          bb.rotation.z = Math.sin(windT * freq + phase) * amp + shakeOffset;
        }
      }
      for (const lp of floatingLilyPads) {
        lp.mesh.position.y = lp.baseY + Math.sin(windT * 1.9 + lp.phase) * 0.022;
      }
    };
    const makeUprightProp = (
      t: THREE.Texture,
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      alphaTest = 0.15,
      swayAmp = 0,
      swayFreq = 2.2,
    ): THREE.Mesh => {
      const m = new THREE.Mesh(UPRIGHT_QUAD_GEO, getSharedFloraMat(t, alphaTest));
      m.rotation.order = 'YXZ';
      m.rotation.set(
        lastBbPitch < 100 ? -lastBbPitch * BILLBOARD_PITCH_TILT : -0.24 * BILLBOARD_PITCH_TILT,
        lastBbYaw < 100 ? lastBbYaw : 0,
        0,
      );
      m.scale.set(w, h, 1);
      m.position.set(x, y - 0.04, z);
      if (swayAmp > 0) {
        m.userData.swayAmp = swayAmp;
        m.userData.swayFreq = swayFreq;
        m.userData.swayPhase = x * 0.24 + z * 0.16;
      }
      floraGroup.add(m);
      floraBillboards.add(m);
      return m;
    };

    interface WorldInteractNode {
      id: string;
      kind: 'mushroom' | 'berry_tree' | 'ore_rock' | 'signpost';
      x: number;
      y: number;
      z: number;
      mesh: THREE.Mesh;
      extraMesh?: THREE.Mesh;
      baseScaleX: number;
      baseScaleY: number;
      hp: number;
      maxHp: number;
      cooldown: number;
      label: string;
      icon: string;
    }
    const worldInteractNodes = new Map<string, WorldInteractNode>();
    const placedFloraCells = new Map<
      string,
      {
        gx: number;
        gz: number;
        tier: 'far' | 'full';
        objs: THREE.Object3D[];
        bbs: THREE.Mesh[];
        nodeIds: string[];
        lilies?: { mesh: THREE.Mesh; baseY: number; phase: number }[];
      }
    >();

    const updateWorldAround = (cx: number, cz: number) => {
      const snapX = Math.round(cx / 4) * 4;
      const snapZ = Math.round(cz / 4) * 4;
      if (snapX === lastChunkX && snapZ === lastChunkZ) return;
      lastChunkX = snapX;
      lastChunkZ = snapZ;

      terrainMesh.position.set(snapX, 0, snapZ);
      waterPlaneMesh.position.set(snapX, WATER_LEVEL_3D, snapZ);
      for (let i = 0; i < terrainPosAttr.count; i++) {
        const wx = terrainPosAttr.getX(i) + snapX;
        const wz = terrainPosAttr.getZ(i) + snapZ;
        terrainPosAttr.setY(i, getTerrainHeight3D(wx, wz));
      }
      terrainPosAttr.needsUpdate = true;
      terrainGeo.computeVertexNormals();

      // 2-Tier LOD Streaming across the ENTIRE 148x148m visible terrain (zero bare distant hills!):
      // - Near Ring (<= 12 cells / ~38m): full trees + boulders + bushes + mushrooms + wildflowers + tall grass + stumps
      // - Far Ring (13..23 cells / 38..74m): ALL trees + boulders + bushes so distant hills stay lushly forested!
      // - Cull Ring (> 26 cells / >83m): recycle cells behind player for rock-solid 60 FPS!
      const gx0 = Math.round(cx / TERRACE_CELL);
      const gz0 = Math.round(cz / TERRACE_CELL);
      const NEAR_R = prefsRef.current.graphicsQuality === 'low' ? 9 : 12;
      const FAR_R = prefsRef.current.graphicsQuality === 'low' ? 18 : 23;
      const CULL_R = FAR_R + 3;

      for (const [key, entry] of placedFloraCells) {
        if (Math.abs(entry.gx - gx0) > CULL_R || Math.abs(entry.gz - gz0) > CULL_R) {
          for (const obj of entry.objs) floraGroup.remove(obj);
          for (const bb of entry.bbs) floraBillboards.delete(bb);
          for (const nid of entry.nodeIds) worldInteractNodes.delete(nid);
          if (entry.lilies) {
            for (const lp of entry.lilies) floatingLilyPads.delete(lp);
          }
          placedFloraCells.delete(key);
        }
      }

      for (let dz = -FAR_R; dz <= FAR_R; dz++) {
        for (let dx = -FAR_R; dx <= FAR_R; dx++) {
          const distCell = Math.max(Math.abs(dx), Math.abs(dz));
          const wantTier: 'far' | 'full' = distCell <= NEAR_R ? 'full' : 'far';
          const gx = gx0 + dx;
          const gz = gz0 + dz;
          const key = `${gx},${gz}`;
          const existing = placedFloraCells.get(key);
          if (existing && (existing.tier === 'full' || wantTier === 'far')) continue;

          const wx = gx * TERRACE_CELL;
          const wz = gz * TERRACE_CELL;
          if (Math.hypot(wx, wz) < 5.5 || isInsideAnyTownPlaza(wx, wz, 2.5) || isOnInterTownRoad3D(wx, wz, 5.4)) {
            if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
            else existing.tier = wantTier;
            continue;
          }
          const modX = ((wx % WORLD_SECTOR_SIZE) + WORLD_SECTOR_SIZE) % WORLD_SECTOR_SIZE;
          const modZ = ((wz % WORLD_SECTOR_SIZE) + WORLD_SECTOR_SIZE) % WORLD_SECTOR_SIZE;
          if (modX < 4.5 || modX > WORLD_SECTOR_SIZE - 4.5 || modZ < 4.5 || modZ > WORLD_SECTOR_SIZE - 4.5) {
            if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
            else existing.tier = wantTier;
            continue;
          }

          const h = Math.abs(Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663)) % 100;
          const gy = getTerrainHeight3D(wx, wz);
          // Shallow organic lake/river shoreline: dynamically spawn floating pixel lily pads, pink lotus & swaying cattail reeds!
          if (gy < WATER_LEVEL_3D + 0.16) {
            if (!existing && wantTier === 'full') {
              const objsW: THREE.Object3D[] = [];
              const bbsW: THREE.Mesh[] = [];
              const liliesW: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
              const nearShore =
                getTerrainHeight3D(wx + 4.0, wz) > WATER_LEVEL_3D + 0.04 ||
                getTerrainHeight3D(wx - 4.0, wz) > WATER_LEVEL_3D + 0.04 ||
                getTerrainHeight3D(wx, wz + 4.0) > WATER_LEVEL_3D + 0.04 ||
                getTerrainHeight3D(wx, wz - 4.0) > WATER_LEVEL_3D + 0.04;
              if (nearShore && gy < WATER_LEVEL_3D - 0.05 && h < 42) {
                const isLotus = h % 3 === 0;
                const padMesh = new THREE.Mesh(lilyGeo, isLotus ? lotusMat : lilyMat);
                const sz = (isLotus ? 1.45 : 1.25) + (h % 3) * 0.22;
                padMesh.scale.set(sz, 1, sz);
                padMesh.rotation.y = (h * 1.37) % (Math.PI * 2);
                const baseY = WATER_LEVEL_3D + 0.045;
                padMesh.position.set(wx + ((h % 3) - 1) * 0.55, baseY, wz + (((h >> 2) % 3) - 1) * 0.55);
                floraGroup.add(padMesh);
                objsW.push(padMesh);
                const lpObj = { mesh: padMesh, baseY, phase: wx * 0.32 + wz * 0.24 };
                floatingLilyPads.add(lpObj);
                liliesW.push(lpObj);
              } else if (nearShore && gy >= WATER_LEVEL_3D - 0.16 && h >= 42 && h < 74) {
                const reedMesh = new THREE.Mesh(UPRIGHT_QUAD_GEO, cattailMat);
                reedMesh.rotation.order = 'YXZ';
                const rs = 1.6 + (h % 3) * 0.24;
                reedMesh.scale.set((h & 1) === 1 ? -rs : rs, rs * 1.12, 1);
                reedMesh.position.set(wx, Math.max(WATER_LEVEL_3D - 0.1, gy) - 0.04, wz);
                reedMesh.userData.swayAmp = 0.075;
                reedMesh.userData.swayFreq = 2.4;
                reedMesh.userData.swayPhase = wx * 0.25 + wz * 0.18;
                floraGroup.add(reedMesh);
                floraBillboards.add(reedMesh);
                objsW.push(reedMesh);
                bbsW.push(reedMesh);
              }
              placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: objsW, bbs: bbsW, nodeIds: [], lilies: liliesW });
            } else if (!existing) {
              placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
            } else {
              existing.tier = wantTier;
            }
            continue;
          }
          const slope = Math.max(
            Math.abs(getTerrainHeight3D(wx + 1.2, wz) - gy),
            Math.abs(getTerrainHeight3D(wx, wz + 1.2) - gy),
          );
          if (slope > 0.55) {
            if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
            else existing.tier = wantTier;
            continue;
          }

          const h2 = Math.abs(Math.imul(gx + 37, 2654435761) ^ Math.imul(gz - 19, 2246822519)) % 100;
          const groveNoise = Math.sin(wx * 0.08 + wz * 0.05) + Math.cos(wx * 0.04 - wz * 0.09);
          const flowerMeadow = Math.sin(wx * 0.11 - wz * 0.08 + 2.1);

          const objs = existing ? existing.objs : [];
          const bbs = existing ? existing.bbs : [];
          const nodeIds = existing ? existing.nodeIds : [];
          const isUpgradeFromFar = Boolean(existing);

          // MACRO LANDMARKS (Minecraft-style local biome props: snowy pines, desert cacti, volcanic rocks, coastal palms, lush oaks!)
          const localBiomeCell = getSeamlessBiomeAt3D(wx, wz, gy, selectedBiome);
          const localTexCell = getBiomeTextures(localBiomeCell);
          const isTreeCell = (h < 15 || (groveNoise > 0.65 && h < 26)) && (gy > 0.45 || Math.hypot(wx, wz) > 9.5);
          if (isTreeCell) {
            const tx = wx + ((h % 3) - 1) * 0.55;
            const tz = wz + (((h >> 2) % 3) - 1) * 0.55;
            if (!isUpgradeFromFar) {
              const vIdx = h2 % localTexCell.treeSprites.length;
              const { group: tree, billboard: treeBb } = createLushTreeSprite3D(
                getSharedFloraMat(localTexCell.treeSprites[vIdx], 0.12),
                vIdx,
                (h2 & 1) === 1,
              );
              treeBb.rotation.set(
                lastBbPitch < 100 ? -lastBbPitch * BILLBOARD_PITCH_TILT : -0.24 * BILLBOARD_PITCH_TILT,
                lastBbYaw < 100 ? lastBbYaw : 0,
                0,
              );
              // Gentle organic breeze canopy sway!
              treeBb.userData.swayAmp = 0.026;
              treeBb.userData.swayFreq = 1.65 + (h2 % 4) * 0.15;
              treeBb.userData.swayPhase = tx * 0.22 + tz * 0.16;
              const treeScale = 0.84 + (h2 % 5) * 0.11;
              tree.position.set(tx, gy - 0.04, tz);
              tree.scale.setScalar(treeScale);
              floraGroup.add(tree);
              floraBillboards.add(treeBb);
              objs.push(tree);
              bbs.push(treeBb);

              // Every 3rd tree bears glowing pickable berries hanging in the canopy!
              if (h2 % 3 === 0) {
                const berryMesh = makeUprightProp(
                  tex.berryCluster,
                  1.15,
                  1.15,
                  tx + 0.15,
                  gy + 2.4 * treeScale,
                  tz + 0.28,
                  0.12,
                  0.045,
                  1.9,
                );
                objs.push(berryMesh);
                bbs.push(berryMesh);
                const nid = `berry_${gx}_${gz}`;
                worldInteractNodes.set(nid, {
                  id: nid,
                  kind: 'berry_tree',
                  x: tx,
                  y: gy,
                  z: tz,
                  mesh: treeBb,
                  extraMesh: berryMesh,
                  baseScaleX: treeBb.scale.x,
                  baseScaleY: treeBb.scale.y,
                  hp: 1,
                  maxHp: 1,
                  cooldown: 0,
                  label: '摇树摘取树果',
                  icon: '/sprites/items/oran-berry.png',
                });
                nodeIds.push(nid);
              }
            }
            // Understory interactive mushroom cluster only added in Near ('full') ring!
            if (wantTier === 'full' && h2 % 2 === 0) {
              const mCount = 1 + (h2 % 2);
              for (let mi = 0; mi < mCount; mi++) {
                const ma = mi * 2.4 + h2;
                const mx = tx + Math.cos(ma) * (1.45 + mi * 0.55);
                const mz = tz + Math.sin(ma) * (1.45 + mi * 0.55);
                const my = getTerrainHeight3D(mx, mz);
                const mTex = tex.mushrooms[(h2 + mi) % tex.mushrooms.length];
                const mScale = 1.5 + (mi % 2) * 0.3;
                const ms = makeUprightProp(
                  mTex,
                  ((h2 + mi) & 1) === 1 ? -mScale : mScale,
                  mScale,
                  mx,
                  my,
                  mz,
                  0.15,
                  0.022,
                  2.3,
                );
                objs.push(ms);
                bbs.push(ms);
                if (mi === 0) {
                  const nid = `mush_${gx}_${gz}_${mi}`;
                  worldInteractNodes.set(nid, {
                    id: nid,
                    kind: 'mushroom',
                    x: mx,
                    y: my,
                    z: mz,
                    mesh: ms,
                    baseScaleX: ms.scale.x,
                    baseScaleY: ms.scale.y,
                    hp: 1,
                    maxHp: 1,
                    cooldown: 0,
                    label: '采摘野生蘑菇',
                    icon: '/sprites/items/oran-berry.png',
                  });
                  nodeIds.push(nid);
                }
              }
            }
          } else if (h >= 26 && h < 33) {
            if (!isUpgradeFromFar) {
              const rs = 1.7 + (h2 % 4) * 0.28;
              const bIdx = h2 % tex.boulders.length;
              const bTex = tex.boulders[bIdx];
              const rx = wx + 0.3;
              const rz = wz - 0.2;
              const rk = makeUprightProp(
                bTex,
                (h2 & 1) === 1 ? -rs : rs,
                rs * 0.86,
                rx,
                gy,
                rz,
                0.14,
              );
              objs.push(rk);
              bbs.push(rk);
              // Crystal/ore boulders (or every 2nd rock) are interactive mineable ore veins!
              if (bIdx === 2 || h2 % 2 === 0) {
                const nid = `ore_${gx}_${gz}`;
                worldInteractNodes.set(nid, {
                  id: nid,
                  kind: 'ore_rock',
                  x: rx,
                  y: gy,
                  z: rz,
                  mesh: rk,
                  baseScaleX: rk.scale.x,
                  baseScaleY: rk.scale.y,
                  hp: 3,
                  maxHp: 3,
                  cooldown: 0,
                  label: bIdx === 2 ? '敲碎结晶矿石' : '凿碎苔藓矿岩',
                  icon: '/sprites/items/bright-powder.png',
                });
                nodeIds.push(nid);
              }
            }
          } else if (h >= 74 && h < 82) {
            if (!isUpgradeFromFar) {
              const bushTex = tex.bushes[h2 % tex.bushes.length];
              const bScale = 1.82 + (h2 % 3) * 0.22;
              const bs = makeUprightProp(bushTex, (h2 & 1) === 1 ? -bScale : bScale, bScale * 0.88, wx, gy, wz, 0.15, 0.048, 2.2);
              objs.push(bs);
              bbs.push(bs);
            }
          } else if (wantTier === 'full') {
            // MICRO GROUND DETAILS (Stumps, Interactive Wooden Signposts, Swaying Ferns, Wildflowers, Pickable Mushrooms!)
            if (h >= 33 && h < 38) {
              const st = makeUprightProp(tex.stump, 1.58, 1.48, wx - 0.2, gy, wz + 0.2, 0.14);
              objs.push(st);
              bbs.push(st);
            } else if (h >= 38 && h < 41) {
              const sg = makeUprightProp(tex.signpost, 1.85, 2.0, wx, gy, wz, 0.14);
              objs.push(sg);
              bbs.push(sg);
              const nid = `sign_${gx}_${gz}`;
              worldInteractNodes.set(nid, {
                id: nid,
                kind: 'signpost',
                x: wx,
                y: gy,
                z: wz,
                mesh: sg,
                baseScaleX: sg.scale.x,
                baseScaleY: sg.scale.y,
                hp: 1,
                maxHp: 1,
                cooldown: 0,
                label: '阅读木质路牌',
                icon: '/sprites/items/poke-radar.png',
              });
              nodeIds.push(nid);
            } else if (h >= 41 && h < 53) {
              const gCount = 2 + (h2 % 2);
              for (let gi = 0; gi < gCount; gi++) {
                const gxOff = (gi - 0.5) * 0.95;
                const gzOff = ((gi % 2) - 0.5) * 0.72;
                const ts = 1.56 + ((h2 + gi) % 3) * 0.22;
                const tg = makeUprightProp(
                  tex.tallGrass,
                  ((h2 + gi) & 1) === 1 ? -ts : ts,
                  ts * 0.92,
                  wx + gxOff,
                  getTerrainHeight3D(wx + gxOff, wz + gzOff),
                  wz + gzOff,
                  0.14,
                  0.072,
                  2.7 + (gi % 2) * 0.35,
                );
                objs.push(tg);
                bbs.push(tg);
              }
            } else if (flowerMeadow > 0.25 && h >= 53 && h < 74) {
              const flCount = 2 + (h2 % 2);
              for (let fi = 0; fi < flCount; fi++) {
                const fa = (fi * Math.PI * 2) / flCount + h2;
                const fx = wx + Math.cos(fa) * (0.75 + (fi % 2) * 0.6);
                const fz = wz + Math.sin(fa) * (0.75 + (fi % 2) * 0.6);
                const fTex = tex.flowers[(h2 + fi * 2) % tex.flowers.length];
                const fScale = 1.56 + ((h2 + fi) % 3) * 0.2;
                const fl = makeUprightProp(
                  fTex,
                  ((h2 + fi) & 1) === 1 ? -fScale : fScale,
                  fScale * 0.78,
                  fx,
                  getTerrainHeight3D(fx, fz),
                  fz,
                  0.15,
                  0.056,
                  2.5,
                );
                objs.push(fl);
                bbs.push(fl);
              }
            } else if (h >= 82 && h < 90) {
              const mScale = 1.52 + (h2 % 3) * 0.2;
              const mx = wx + 0.2;
              const mz = wz + 0.2;
              const ms = makeUprightProp(
                tex.mushrooms[h2 % tex.mushrooms.length],
                (h2 & 1) === 1 ? -mScale : mScale,
                mScale,
                mx,
                gy,
                mz,
                0.15,
                0.025,
                2.3,
              );
              objs.push(ms);
              bbs.push(ms);
              const nid = `mush_open_${gx}_${gz}`;
              worldInteractNodes.set(nid, {
                id: nid,
                kind: 'mushroom',
                x: mx,
                y: gy,
                z: mz,
                mesh: ms,
                baseScaleX: ms.scale.x,
                baseScaleY: ms.scale.y,
                hp: 1,
                maxHp: 1,
                cooldown: 0,
                label: '采摘野生蘑菇',
                icon: '/sprites/items/oran-berry.png',
              });
              nodeIds.push(nid);
            } else if (h >= 90 && h < 96) {
              const gt = makeUprightProp(tex.grassTuft, 1.25, 1.1, wx + 0.2, gy, wz + 0.2, 0.15, 0.068, 2.8);
              objs.push(gt);
              bbs.push(gt);
            }
          }

          if (existing) {
            existing.tier = wantTier;
          } else {
            placedFloraCells.set(key, { gx, gz, tier: wantTier, objs, bbs, nodeIds });
          }
        }
      }
    };

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

    // 6. Living Kanto Wildlife Diorama (Hub / Map Select):
    //    - Majestic linear sky flybys (HUGE Charizard & Dragonite crossing the horizon — NO overhead circling!)
    //    - Wild Pokémon strolling along the actual dirt roads
    //    - Magikarp & HUGE Gyarados leaping out of organic lakes + Lapras swimming smoothly
    //    - Diglett & Dugtrio popping up from the soil and burrowing back down!
    const previewSprites: {
      sprite: THREE.Mesh;
      shadow: THREE.Mesh;
      animSheet?: AnimatedSpriteSheet3D;
      pmdSheet?: Pmd8DirSheet3D;
      kind: 'flyby' | 'road_stroll' | 'water_leap' | 'water_swim' | 'burrow' | 'meadow_graze';
      baseX: number;
      baseZ: number;
      phase: number;
      scale: number;
      dirX?: number;
      dirZ?: number;
      span?: number;
      speed?: number;
      altitude?: number;
      jumpH?: number;
    }[] = [];
    // Floating 3D Pixel Emote Bubble for living Hub protagonist & companions!
    const emoteKinds: ('heart' | 'music' | 'sparkle' | 'exclaim')[] = ['heart', 'music', 'sparkle', 'exclaim'];
    const heroEmoteSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getPixelEmoteTexture('heart'),
        transparent: true,
        alphaTest: 0.1,
      }),
    );
    heroEmoteSprite.scale.set(1.35, 1.2, 1);
    heroEmoteSprite.visible = false;
    scene.add(heroEmoteSprite);

    const petEmoteSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getPixelEmoteTexture('music'),
        transparent: true,
        alphaTest: 0.1,
      }),
    );
    petEmoteSprite.scale.set(1.2, 1.08, 1);
    petEmoteSprite.visible = false;
    scene.add(petEmoteSprite);

    if (phase !== 'playing') {
      const showcaseSpecies = regionMeta.wildPool;

      // A. 8 Wild Pokémon strolling naturally along the real North-South & East-West dirt roads!
      for (let i = 0; i < 8; i++) {
        const sp = showcaseSpecies[i % showcaseSpecies.length];
        const stg: 'baby' | 'teen' | 'adult' = i % 4 === 0 ? 'adult' : i % 2 === 0 ? 'teen' : 'baby';
        const asset = SPECIES_CATALOG[sp].stageSprites[stg];
        const sc = getPokemonWorldScale3D(sp, stg) * 0.92;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(asset.static, sc, asset.animated);
        const onEastWest = i % 2 === 0;
        const laneOffset = (i % 4 < 2 ? -1.9 : 1.9);
        const bx = onEastWest ? 0 : laneOffset;
        const bz = onEastWest ? laneOffset : 0;
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'road_stroll',
          baseX: bx,
          baseZ: bz,
          dirX: onEastWest ? 1 : 0,
          dirZ: onEastWest ? 0 : 1,
          span: 24 + (i % 3) * 8,
          speed: 0.11 + (i % 3) * 0.03,
          phase: i * 1.15,
          scale: sc,
        });
      }

      // B. 6 Peaceful Meadow-Grazing Wild Pokémon on dry sunlit rolling slopes
      for (let i = 0; i < 6; i++) {
        const sp = showcaseSpecies[(i + 3) % showcaseSpecies.length];
        const ang = (i * Math.PI * 2) / 6 + 0.45;
        const rad = 8.5 + (i % 3) * 4.5;
        const bx = Math.cos(ang) * rad;
        const bz = Math.sin(ang) * rad;
        if (getTerrainHeight3D(bx, bz) < WATER_LEVEL_3D + 0.25) continue;
        const stg: 'baby' | 'teen' | 'adult' = i % 3 === 0 ? 'teen' : 'baby';
        const asset = SPECIES_CATALOG[sp].stageSprites[stg];
        const sc = getPokemonWorldScale3D(sp, stg) * 0.9;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(asset.static, sc, asset.animated);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'meadow_graze',
          baseX: bx,
          baseZ: bz,
          phase: i * 1.4,
          scale: sc,
        });
      }

      // C. 5 Burrowing Diglett (#50) & Dugtrio (#51) popping up from the ground & ducking back down!
      const burrowSpots: { x: number; z: number; dex: '50' | '51'; sc: number }[] = [
        { x: -6.5, z: -5.2, dex: '50', sc: 1.65 },
        { x: 7.4, z: -6.8, dex: '51', sc: 2.25 },
        { x: -9.8, z: 6.4, dex: '50', sc: 1.65 },
        { x: 9.2, z: 5.5, dex: '50', sc: 1.65 },
        { x: -4.2, z: -13.5, dex: '51', sc: 2.25 },
      ];
      burrowSpots.forEach((bs, bi) => {
        if (getTerrainHeight3D(bs.x, bs.z) < WATER_LEVEL_3D + 0.3) return;
        const url = `/sprites/pokemon/${bs.dex}.png`;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(url, bs.sc);
        shadow.scale.setScalar(bs.sc * 0.42);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'burrow',
          baseX: bs.x,
          baseZ: bs.z,
          phase: bi * 1.7,
          scale: bs.sc,
        });
      });

      // D. Aquatic Wildlife Leaping & Swimming in Real Organic Lakes (Magikarp #129, HUGE Gyarados #130, Lapras #131)!
      const lakeWaterSpots: { x: number; z: number }[] = [];
      for (const lk of LAKE_BASINS_3D) {
        if (getTerrainHeight3D(lk.cx, lk.cz) < WATER_LEVEL_3D - 0.25) {
          lakeWaterSpots.push({ x: lk.cx, z: lk.cz });
        }
      }
      // Also scan near-horizon organic lakes within 55m so leaping water Pokémon are clearly visible!
      for (let gz = -48; gz <= 48; gz += 6) {
        for (let gx = -48; gx <= 48; gx += 6) {
          if (getTerrainHeight3D(gx, gz) < WATER_LEVEL_3D - 0.35) {
            if (lakeWaterSpots.every((s) => Math.hypot(s.x - gx, s.z - gz) > 10)) {
              lakeWaterSpots.push({ x: gx, z: gz });
            }
          }
        }
      }
      lakeWaterSpots.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
      const aquaSpecs: { dex: '129' | '130' | '131'; kind: 'water_leap' | 'water_swim'; sc: number; jumpH: number }[] = [
        { dex: '129', kind: 'water_leap', sc: 2.25, jumpH: 3.4 }, // Magikarp leaping high!
        { dex: '130', kind: 'water_leap', sc: 5.5, jumpH: 4.4 },  // HUGE Gyarados breaching!
        { dex: '131', kind: 'water_swim', sc: 3.8, jumpH: 0 },    // Lapras gliding on the water!
        { dex: '129', kind: 'water_leap', sc: 2.1, jumpH: 3.1 },  // 2nd Magikarp splashing!
      ];
      aquaSpecs.forEach((aq, ai) => {
        const spot = lakeWaterSpots[ai % Math.max(1, lakeWaterSpots.length)];
        if (!spot) return;
        const url = `/sprites/pokemon/${aq.dex}.png`;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(url, aq.sc);
        shadow.scale.setScalar(aq.sc * 0.35);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: aq.kind,
          baseX: spot.x,
          baseZ: spot.z,
          phase: ai * 2.1,
          scale: aq.sc,
          jumpH: aq.jumpH,
        });
      });

      // E. Majestic Straight-Line Sky Flybys (HUGE Charizard & HUGE Dragonite crossing the horizon — NO overhead circling!)
      const flybyPool: {
        sp: SpeciesId;
        stg: 'baby' | 'teen' | 'adult';
        sc: number;
        laneZ: number;
        dirX: number;
        dirZ: number;
        alt: number;
        spd: number;
      }[] = [
        { sp: 'charmander', stg: 'adult', sc: 5.1, laneZ: -20, dirX: 0.96, dirZ: 0.28, alt: 10.5, spd: 5.8 }, // Giant Charizard flying East-Southeast across horizon!
        { sp: 'dratini', stg: 'adult', sc: 5.6, laneZ: -30, dirX: -0.94, dirZ: 0.34, alt: 13.0, spd: 6.4 },   // Giant Dragonite sweeping West across mountain ridge!
        { sp: 'mew', stg: 'baby', sc: 2.3, laneZ: -12, dirX: 0.88, dirZ: -0.47, alt: 8.2, spd: 4.9 },         // Playful Mew gliding diagonally across the valley!
      ];
      flybyPool.forEach((fl, fi) => {
        const asset = SPECIES_CATALOG[fl.sp].stageSprites[fl.stg];
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(asset.static, fl.sc, asset.animated);
        shadow.scale.setScalar(fl.sc * 0.28);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'flyby',
          baseX: 0,
          baseZ: fl.laneZ,
          dirX: fl.dirX,
          dirZ: fl.dirZ,
          span: 74,
          speed: fl.spd,
          altitude: fl.alt,
          phase: fi * 11.5,
          scale: fl.sc,
        });
      });
    }

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

    // Start cleanly on the sunlit Puxi Promenade beside People's Square Park (dry land, looking across Huangpu River toward Oriental Pearl Tower!),
    // or resume the player's last saved position in that city!
    let startPx = -22;
    let startPz = 12;
    if (phase === 'playing') {
      try {
        const geoOrigin = getActiveGeoTerrainOrigin();
        const posKey = geoOrigin ? `pocket_paw_geo_pos_${geoOrigin.startCityId ?? 'shanghai'}_v1` : 'pocket_paw_last_world_pos_v1';
        const rawPos = window.localStorage.getItem(posKey);
        if (rawPos) {
          const parsed = JSON.parse(rawPos) as { x?: number; z?: number };
          if (typeof parsed.x === 'number' && typeof parsed.z === 'number' && Number.isFinite(parsed.x) && Number.isFinite(parsed.z)) {
            startPx = parsed.x;
            startPz = parsed.z;
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    const startPy = getTerrainHeight3D(startPx, startPz);
    initialFollowers.forEach((f, idx) => {
      const ang = (idx * Math.PI * 2) / Math.max(1, initialFollowers.length) + 0.6;
      f.x = startPx + Math.cos(ang) * 2.4;
      f.z = startPz + Math.sin(ang) * 2.4;
      f.y = getTerrainHeight3D(f.x, f.z);
    });

    simRef.current = {
      px: startPx,
      py: startPy,
      pz: startPz,
      vy: 0,
      facingAngle: 0,
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
    updateWorldAround(0, 0);

    // When real-Earth NASA/SRTM DEM elevation tiles finish streaming, rebuild terrain, flora AND re-snap city height!
    const unsubGeoDem = subscribeGeoDemLoaded(() => {
      lastChunkX = NaN;
      lastChunkZ = NaN;
      for (const town of proceduralTowns) {
        town.group.position.y = getTerrainHeight3D(town.centerX, town.centerZ);
      }
      for (const [, entry] of placedFloraCells) {
        for (const obj of entry.objs) floraGroup.remove(obj);
        for (const bb of entry.bbs) floraBillboards.delete(bb);
        for (const nid of entry.nodeIds) worldInteractNodes.delete(nid);
        if (entry.lilies) {
          for (const lp of entry.lilies) floatingLilyPads.delete(lp);
        }
      }
      placedFloraCells.clear();
      const curSim = simRef.current;
      if (curSim) {
        updateWorldAround(curSim.px, curSim.pz);
        const newFloor = getTerrainHeight3D(curSim.px, curSim.pz);
        curSim.py = Math.max(WATER_LEVEL_3D - 0.15, newFloor);
      } else {
        updateWorldAround(0, 0);
      }
    });
    syncSafeZones3D(0, 0);

    const spawnLoot3D = (x: number, z: number, kind: Loot3D['kind'], value: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const geo =
        kind === 'xp'
          ? new THREE.OctahedronGeometry(0.3)
          : kind === 'coin'
            ? new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8)
            : kind === 'berry'
              ? new THREE.DodecahedronGeometry(0.34)
              : new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const color =
        kind === 'xp'
          ? value >= 20
            ? 0xae3ec9
            : 0x339af0
          : kind === 'coin'
            ? 0xffd43b
            : kind === 'berry'
              ? 0xff6b6b
              : 0x4dabf7;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.38 }),
      );
      mesh.position.set(x, getTerrainHeight3D(x, z) + 0.5, z);
      scene.add(mesh);
      sim.loots.push({ x, z, kind, value, phase: Math.random() * 6, mesh });
    };

    // Procedural HD-2D Pixel-Art Skill VFX Texture Atlas (Zero raw untextured primitives!)
    const vfxAtlas = getSkillVfxAtlas();
    const decalPlaneGeo = new THREE.PlaneGeometry(2, 2);

    const spawnPixelParticles = (
      x: number,
      y: number,
      z: number,
      tex: THREE.CanvasTexture,
      count = 6,
      speed = 4.6,
      scale = 0.72,
      rise = 3.2,
      gravity = 11.5,
    ) => {
      const sim = simRef.current;
      if (!sim || sim.vfxs.length > 150) return;
      for (let i = 0; i < count; i++) {
        const ang = (i * Math.PI * 2) / Math.max(1, count) + (Math.random() - 0.5) * 0.65;
        const spd = speed * (0.45 + Math.random() * 0.75);
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            opacity: 0.96,
            depthWrite: false,
          }),
        );
        const s = scale * (0.75 + Math.random() * 0.45);
        sp.scale.set(s, s, 1);
        sp.position.set(x, y + 0.75, z);
        scene.add(sp);
        const life = 0.28 + Math.random() * 0.24;
        sim.vfxs.push({
          kind: 'particle',
          life,
          maxLife: life,
          baseScale: s,
          vx: Math.cos(ang) * spd,
          vy: rise * (0.65 + Math.random() * 0.7),
          vz: Math.sin(ang) * spd,
          gravity,
          mesh: sp,
        });
      }
    };

    const spawnGroundDecalWave = (
      x: number,
      y: number,
      z: number,
      tex: THREE.CanvasTexture,
      maxRadius: number,
      maxLife: number,
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const m = new THREE.Mesh(
        decalPlaneGeo,
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y + 0.16, z);
      m.scale.setScalar(0.35);
      scene.add(m);
      sim.vfxs.push({ kind: 'decal_wave', life: maxLife, maxLife, maxRadius, mesh: m });
    };

    const spawnGlowFlash = (
      x: number,
      y: number,
      z: number,
      hex: number,
      maxRadius: number,
      maxLife: number,
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const m = new THREE.Mesh(
        decalPlaneGeo,
        new THREE.MeshBasicMaterial({
          map: vfxAtlas.softGlow,
          color: hex,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y + 0.14, z);
      m.scale.setScalar(maxRadius * 0.6);
      scene.add(m);
      sim.vfxs.push({ kind: 'glow_flash', life: maxLife, maxLife, maxRadius, mesh: m });
    };

    const spawnSpriteBurst = (
      x: number,
      y: number,
      z: number,
      frames: THREE.CanvasTexture[],
      scale: number,
      maxLife: number,
      riseSpeed = 0,
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: frames[0],
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      sp.scale.set(scale, scale, 1);
      sp.position.set(x, y, z);
      scene.add(sp);
      sim.vfxs.push({
        kind: 'sprite_burst',
        life: maxLife,
        maxLife,
        baseScale: scale,
        vy: riseSpeed,
        frames,
        mesh: sp,
      });
    };

    const spawnLightningBolt3D = (x: number, y: number, z: number, hex: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: vfxAtlas.thunderbolt[0],
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      sp.scale.set(3.2, 8.6, 1);
      sp.position.set(x, y + 4.2, z);
      scene.add(sp);
      sim.vfxs.push({
        kind: 'lightning',
        life: 0.34,
        maxLife: 0.34,
        frames: vfxAtlas.thunderbolt,
        mesh: sp,
      });
      spawnGroundDecalWave(x, y, z, vfxAtlas.electricRingDecal, 2.7, 0.34);
      spawnGlowFlash(x, y, z, hex, 2.8, 0.28);
      spawnPixelParticles(x, y, z, vfxAtlas.electricSpark, 6, 5.4, 0.85, 4.2, 12);
    };

    const spawnSkillProjectile3D = (opts: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy?: number;
      vz: number;
      dmg: number;
      radius: number;
      pierce: number;
      life: number;
      colorHex: number;
      scale: number;
      frames: THREE.CanvasTexture[];
      ownerId?: string;
      skillId?: SurvivorSkillId;
      fromEnemy?: boolean;
    }) => {
      const sim = simRef.current;
      if (!sim) return;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: opts.frames[0],
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      sprite.scale.set(opts.scale, opts.scale, 1);
      sprite.position.set(opts.x, opts.y, opts.z);

      // Additive ground light pool gliding under every flying skill!
      const glow = new THREE.Mesh(
        decalPlaneGeo,
        new THREE.MeshBasicMaterial({
          map: vfxAtlas.softGlow,
          color: opts.colorHex,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.scale.setScalar(opts.scale * 0.72);
      glow.position.set(opts.x, getTerrainHeight3D(opts.x, opts.z) + 0.14, opts.z);

      scene.add(sprite, glow);
      sim.projectiles.push({
        x: opts.x,
        y: opts.y,
        z: opts.z,
        vx: opts.vx,
        vy: opts.vy ?? 0,
        vz: opts.vz,
        dmg: opts.dmg,
        radius: opts.radius,
        pierce: opts.pierce,
        life: opts.life,
        animTime: Math.random() * 0.5,
        fromEnemy: opts.fromEnemy,
        ownerId: opts.ownerId,
        skillId: opts.skillId,
        colorHex: opts.colorHex,
        trailTimer: 0.04,
        frames: opts.frames,
        sprite,
        glow,
      });
    };

    const damageEnemy3D = (
      en: Enemy3D,
      amount: number,
      color = '#ffe066',
      sourceFollowerId?: string,
    ) => {
      const sim = simRef.current;
      if (!sim || en.hp <= 0) return;
      const actualDmg = Math.min(en.hp, amount);
      en.hp -= amount;
      en.aggroed = true;
      sim.totalDamage += actualDmg;
      const srcFollower = sourceFollowerId
        ? sim.followers.find((f) => f.id === sourceFollowerId)
        : undefined;
      if (srcFollower) {
        srcFollower.damageDealt += actualDmg;
      }
      en.hitFlash = 0.14;
      sound.play('impact');
      if (prefsRef.current.showDamageNumbers) {
        sim.dmgPops.push({
          id: sim.nextId++,
          wx: en.x + (Math.random() - 0.5) * 0.6,
          wy: en.y + (en.isBoss ? 2.7 : 1.8),
          wz: en.z,
          text: `-${amount}`,
          color,
          life: 0.55,
        });
      }

      if (en.hp <= 0) {
        sim.kills += 1;
        comboRef.current.count += 1;
        comboRef.current.timer = 4.2;
        if (en.isBoss && prefsRef.current.screenShake) {
          shakeRef.current = Math.max(shakeRef.current, 0.55);
        }
        if (srcFollower) srcFollower.kills += 1;
        if (en.isTrainer) sim.trainersDefeated += 1;

        const qMeta = MONSTER_QUALITY_META[en.quality];
        const lootMult = qMeta.lootMult * (en.isShiny ? 2.2 : 1.0);
        spawnSpriteBurst(
          en.x,
          en.y + en.worldScale * 0.55,
          en.z,
          vfxAtlas.explosionBurst,
          en.isBoss ? 4.2 : Math.max(1.9, en.worldScale * 0.95),
          0.32,
          0.6,
        );
        spawnPixelParticles(
          en.x,
          en.y,
          en.z,
          en.isBoss || en.isShiny || en.quality === 'epic' ? vfxAtlas.starGlint : vfxAtlas.koPuff,
          en.isBoss ? 12 : en.isShiny ? 10 : 5,
          en.isBoss ? 6.2 : 3.8,
          en.isBoss ? 1.1 : 0.8,
          3.4,
          7.5,
        );
        spawnLoot3D(
          en.x,
          en.z,
          'xp',
          Math.round((en.isBoss ? 58 : en.isTrainer ? 26 : 6 + Math.floor(sim.elapsed / 25) * 2) * lootMult),
        );
        if (en.isBoss || en.isTrainer || en.quality !== 'normal' || en.isShiny || Math.random() < 0.36) {
          spawnLoot3D(
            en.x + 0.6,
            en.z + 0.4,
            'coin',
            Math.round(
              (en.isBoss
                ? 36 * diffMeta.rewardMult
                : en.isTrainer
                  ? 15 * sim.greedMult
                  : Math.max(2, 3 * sim.greedMult)) * lootMult,
            ),
          );
        }
        if (en.isTrainer) {
          sound.play('ko');
          spawnLoot3D(en.x - 0.6, en.z, 'berry', 30);
          // Award corresponding Kanto Gym Badge when defeating a Gym Leader!
          const leaderToBadge: Record<string, GymBadgeId> = {
            '馆主 小刚': 'boulder_badge',
            '馆主 小霞': 'cascade_badge',
            '馆主 马志士': 'thunder_badge',
            '馆主 莉佳': 'rainbow_badge',
            '劲敌 小茂': 'earth_badge',
          };
          const wonBadgeId = en.trainerName ? leaderToBadge[en.trainerName] : undefined;
          const alreadyOwned = wonBadgeId ? (metaRef.current.unlockedBadges ?? []).includes(wonBadgeId) : true;
          if (wonBadgeId && !alreadyOwned) {
            const bDef = GYM_BADGE_CATALOG.find((b) => b.id === wonBadgeId);
            onUpdateMeta?.((prev) => ({
              ...prev,
              unlockedBadges: Array.from(new Set([...(prev.unlockedBadges ?? []), wonBadgeId])),
            }));
            sound.play('levelup');
            showBanner(`🏅 击败「${en.trainerName}」获得【${bDef?.name}】！${bDef?.perkText}！`, 4200);
          } else {
            showBanner(`击败敌方训练师「${en.trainerName}」！爆出丰厚金币与树果！`);
          }
        } else if (en.quality === 'epic' || en.quality === 'elite' || Math.random() < 0.05) {
          spawnLoot3D(en.x - 0.5, en.z, 'berry', 28);
        } else if (Math.random() < 0.025) {
          spawnLoot3D(en.x - 0.5, en.z, 'magnet', 1);
        }

        // Defeated Boss / Shiny / Regional-Skin / Elite / Epic Pokémon fall knocked-out on the grass (capped at 2 simultaneous non-Boss catchables so encounters stay special!)
        const activeKoNonBoss = sim.enemies.filter((e) => e.knockedOut && !e.isBoss).length;
        const isCatchableKo =
          !en.isTrainer &&
          (en.isBoss ||
            (activeKoNonBoss < 2 &&
              (en.isShiny || Boolean(en.regionalSkin) || en.quality === 'elite' || en.quality === 'epic')));
        if (isCatchableKo) {
          en.knockedOut = true;
          const koMult = metaBonusesRef.current.koDurationMult;
          en.koTimer = en.isBoss
            ? 999999
            : Math.round(
                (en.isShiny ? 45 : en.regionalSkin ? 38 : en.quality === 'epic' ? 32 : 18) * koMult,
              );
          en.hp = 0;
          if (en.sprite) {
            en.sprite.rotation.z = Math.PI * 0.45; // lying knocked-out on its side on the grass!
            (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(0xd0d6e6);
          }
          if (!en.auraRing) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(en.worldScale * 0.34, en.worldScale * 0.5, 24),
              new THREE.MeshBasicMaterial({
                color: 0xffe066,
                transparent: true,
                opacity: 0.82,
                side: THREE.DoubleSide,
                depthWrite: false,
              }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(en.x, en.y + 0.1, en.z);
            scene.add(ring);
            en.auraRing = ring;
          } else {
            (en.auraRing.material as THREE.MeshBasicMaterial).color.setHex(0xffe066);
          }
          sound.play(en.isBoss ? 'levelup' : 'ko');
          const spTitle = SPECIES_CATALOG[en.species].stageNames[en.stage] ?? SPECIES_CATALOG[en.species].defaultName;
          const rSkinTag = en.regionalSkin ? `🏮[${getSkinDef(en.regionalSkin).name}] ` : '';
          const tagPrefix = en.isShiny ? '★异色 ' : rSkinTag || (qMeta.label ? `[${qMeta.label}] ` : '');
          showBanner(`✨ ${tagPrefix}${spTitle} 倒地昏迷！走近它即可投掷精灵球收服！`, 3600);
        } else {
          if (en.sprite) scene.remove(en.sprite);
          if (en.shadow) scene.remove(en.shadow);
          if (en.auraRing) scene.remove(en.auraRing);
        }
      }
    };

    const pickTargetForFollower = (f: ActiveFollower, enemies: Enemy3D[], priority: TargetPriority): Enemy3D[] => {
      const alive = enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - f.x, e.z - f.z) < 23);
      if (alive.length === 0) return [];
      if (priority === 'highest_hp') {
        return [...alive].sort((a, b) => (b.isBoss ? 99999 : b.hp) - (a.isBoss ? 99999 : a.hp));
      }
      if (priority === 'lowest_hp') return [...alive].sort((a, b) => a.hp - b.hp);
      if (priority === 'random') return [...alive].sort(() => Math.random() - 0.5);
      return [...alive].sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z));
    };

    const fireSkill = (f: ActiveFollower, skillId: SurvivorSkillId, salvoBonus: boolean) => {
      const sim = simRef.current;
      if (!sim) return;
      const meta = SURVIVOR_SKILLS[skillId];
      const tac = tacticsRef.current;
      const modeMult =
        (tac.castMode === 'charged' ? 1.42 : salvoBonus && tac.castMode === 'salvo' ? 1.28 : 1.0) *
        (sim.boostTimer > 0 ? 1.55 : 1.0);
      const syn = getElementalSynergyBonus(SPECIES_CATALOG[f.species].element, metaRef.current);
      const wMod = getWeatherCombatBonus(liveWeatherRef.current.kind, SPECIES_CATALOG[f.species].element);
      const dmg = Math.round(
        sim.baseAtk * sim.atkMult * syn.atkMult * wMod.atkMult * meta.powerMult * (0.9 + f.level * 0.25) * modeMult,
      );
      const targets = pickTargetForFollower(f, sim.enemies, tac.targetPriority);

      if (skillId === 'heal_bell') {
        const missingHp = Math.max(0, Math.round(sim.maxHp - sim.hp));
        const rad = 4.8 + f.level * 0.65;
        const nearbyEnemies = sim.enemies.filter((en) => en.hp > 0 && Math.hypot(en.x - sim.px, en.z - sim.pz) < rad);
        // Never spam bell icon / green +++ / fake +HP text when already at full HP and no enemy is in range!
        if (missingHp <= 0 && nearbyEnemies.length === 0) {
          return;
        }
        const rawHeal = Math.round(sim.maxHp * (0.08 + f.level * 0.02));
        const actualHeal = Math.min(missingHp, rawHeal);
        if (actualHeal > 0) {
          sim.hp = Math.min(sim.maxHp, sim.hp + actualHeal);
        }
        f.casts += 1;
        f.castAnim = 0.28;
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.healCircleDecal, rad, 0.5);
        spawnGlowFlash(sim.px, sim.py, sim.pz, 0x69db7c, rad * 0.62, 0.38);
        if (actualHeal > 0) {
          spawnSpriteBurst(sim.px, sim.py + 2.75, sim.pz, vfxAtlas.healBell, 0.72, 0.42, 0.85);
          spawnPixelParticles(sim.px, sim.py + 0.5, sim.pz, vfxAtlas.healPlus, 5, 2.2, 0.65, 4.4, 3.8);
          sim.dmgPops.push({
            id: sim.nextId++,
            wx: sim.px,
            wy: sim.py + 2.6,
            wz: sim.pz,
            text: `+${actualHeal} HP`,
            color: '#69db7c',
            life: 0.72,
          });
          sound.play('happy');
        }
        for (const en of nearbyEnemies) {
          const d = Math.hypot(en.x - sim.px, en.z - sim.pz);
          damageEnemy3D(en, dmg, meta.color, f.id);
          if (!en.isBoss && d > 0.1) {
            en.x += ((en.x - sim.px) / d) * 2.4;
            en.z += ((en.z - sim.pz) / d) * 2.4;
          }
        }
        return;
      }

      if (targets.length === 0) return;

      // Face primary target & trigger lively cast bounce!
      f.facingLeft = targets[0].x < f.x;
      f.castAnim = 0.24;
      f.casts += 1;

      if (skillId === 'thunderbolt') {
        const count = Math.min(targets.length, f.level + (tac.castMode === 'charged' ? 2 : 1));
        for (let i = 0; i < count; i++) {
          const t = targets[i];
          spawnLightningBolt3D(t.x, t.y, t.z, meta.hex);
          damageEnemy3D(t, dmg, meta.color, f.id);
        }
        sound.play('thunder');
      } else if (skillId === 'water_pulse') {
        const rad = (5.4 + f.level * 0.85) * (tac.castMode === 'charged' ? 1.25 : 1.0);
        spawnGroundDecalWave(f.x, f.y, f.z, vfxAtlas.waterWaveDecal, rad, 0.46);
        spawnGroundDecalWave(f.x, f.y + 0.08, f.z, vfxAtlas.waterWaveDecal, rad * 0.72, 0.34);
        spawnGlowFlash(f.x, f.y, f.z, 0x339af0, rad * 0.68, 0.38);
        spawnPixelParticles(f.x, f.y, f.z, vfxAtlas.waterDrop, 10, 6.2, 0.82, 4.8, 12.5);
        for (const en of sim.enemies) {
          const d = Math.hypot(en.x - f.x, en.z - f.z);
          if (d < rad && en.hp > 0) {
            damageEnemy3D(en, dmg, meta.color, f.id);
            if (!en.isBoss && d > 0.1) {
              en.x += ((en.x - f.x) / d) * 2.6;
              en.z += ((en.z - f.z) / d) * 2.6;
            }
          }
        }
        sound.play('water');
      } else if (skillId === 'shadow_star') {
        const rays = 4 + f.level * 2;
        const sc = tac.castMode === 'charged' ? 1.85 : 1.45;
        spawnGroundDecalWave(f.x, f.y, f.z, vfxAtlas.arcaneRingDecal, 2.3, 0.32);
        for (let i = 0; i < rays; i++) {
          const a = (i * Math.PI * 2) / rays + sim.elapsed;
          spawnSkillProjectile3D({
            x: f.x,
            y: f.y + 1.05,
            z: f.z,
            vx: Math.cos(a) * 14.2,
            vz: Math.sin(a) * 14.2,
            dmg,
            radius: tac.castMode === 'charged' ? 0.72 : 0.56,
            pierce: 3,
            life: 1.25,
            colorHex: meta.hex,
            scale: sc,
            frames: vfxAtlas.shadowStar,
            ownerId: f.id,
            skillId: 'shadow_star',
          });
        }
        sound.play('water');
      } else if (skillId === 'earthquake') {
        const rad = (6.0 + f.level * 0.9) * (tac.castMode === 'charged' ? 1.25 : 1.0);
        spawnGroundDecalWave(f.x, f.y, f.z, vfxAtlas.waterWaveDecal, rad, 0.5);
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, rad * 0.65, 0.4);
        spawnPixelParticles(f.x, f.y + 0.3, f.z, vfxAtlas.electricSpark, 12, 6.8, 0.72, 5.2, 13.5);
        for (const en of sim.enemies) {
          const d = Math.hypot(en.x - f.x, en.z - f.z);
          if (d < rad && en.hp > 0) {
            damageEnemy3D(en, dmg, meta.color, f.id);
            if (!en.isBoss && d > 0.1) {
              en.x += ((en.x - f.x) / d) * 3.1;
              en.z += ((en.z - f.z) / d) * 3.1;
            }
          }
        }
        sound.play('hit');
      } else if (skillId === 'sacred_fire') {
        const count = Math.min(targets.length, 1 + Math.floor((f.level + 1) / 2));
        for (let i = 0; i < count; i++) {
          const t = targets[i];
          spawnLightningBolt3D(t.x, t.y, t.z, 0xff6b6b);
          spawnGlowFlash(t.x, t.y, t.z, 0xff922b, 3.6, 0.42);
          spawnPixelParticles(t.x, t.y + 0.6, t.z, vfxAtlas.electricSpark, 10, 5.5, 0.75, 4.8, 9.0);
          for (const en of sim.enemies) {
            if (en.hp > 0 && Math.hypot(en.x - t.x, en.z - t.z) < 3.4) {
              damageEnemy3D(en, en === t ? dmg : Math.round(dmg * 0.62), meta.color, f.id);
            }
          }
        }
        sound.play('fireball');
      } else if (skillId === 'dark_ruin' || skillId === 'psychic_nova') {
        const t = targets[0];
        const baseAng = Math.atan2(t.z - f.z, t.x - f.x);
        const rays = skillId === 'dark_ruin' ? 3 + Math.floor(f.level / 2) : 4 + Math.floor(f.level / 2);
        const spread = skillId === 'dark_ruin' ? 0.24 : 0.2;
        const sc = (skillId === 'dark_ruin' ? 1.9 : 1.65) * (tac.castMode === 'charged' ? 1.25 : 1.0);
        for (let i = 0; i < rays; i++) {
          const offset = (i - (rays - 1) / 2) * spread;
          const a = baseAng + offset;
          spawnSkillProjectile3D({
            x: f.x,
            y: f.y + 1.05,
            z: f.z,
            vx: Math.cos(a) * 16.5,
            vz: Math.sin(a) * 16.5,
            dmg,
            radius: sc * 0.42,
            pierce: 4,
            life: 1.35,
            colorHex: meta.hex,
            scale: sc,
            frames: vfxAtlas.shadowStar,
            ownerId: f.id,
            skillId,
          });
        }
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, 1.8, 0.24);
        sound.play('thunder');
      } else if (skillId === 'moonblast') {
        const t = targets[0];
        const dx = t.x - f.x;
        const dy = t.y - f.y;
        const dz = t.z - f.z;
        const d3 = Math.hypot(dx, dy, dz) || 1;
        spawnSkillProjectile3D({
          x: f.x,
          y: f.y + 1.15,
          z: f.z,
          vx: (dx / d3) * 15.5,
          vy: (dy / d3) * 15.5,
          vz: (dz / d3) * 15.5,
          dmg,
          radius: 1.05,
          pierce: 2,
          life: 1.45,
          colorHex: meta.hex,
          scale: 2.15,
          frames: vfxAtlas.swiftStar,
          ownerId: f.id,
          skillId,
        });
        if (sim.hp < sim.maxHp) {
          sim.hp = Math.min(sim.maxHp, sim.hp + Math.max(2, Math.round(sim.maxHp * 0.025)));
        }
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, 1.7, 0.26);
        sound.play('happy');
      } else {
        const count =
          skillId === 'swift_volley'
            ? Math.min(targets.length, 2 + Math.floor(f.level / 2))
            : Math.min(targets.length, 1 + Math.floor((f.level + 1) / 2));
        const speed =
          skillId === 'swift_volley' || skillId === 'solar_beam'
            ? 21.0
            : skillId === 'ice_beam' || skillId === 'aura_sphere'
              ? 18.0
              : skillId === 'dragon_pulse'
                ? 14.2
                : 16.2;
        const sc =
          (skillId === 'dragon_pulse' || skillId === 'solar_beam'
            ? 2.45
            : skillId === 'aura_sphere' || skillId === 'ice_beam'
              ? 1.95
              : skillId === 'fireball'
                ? 1.7
                : 1.35) * (tac.castMode === 'charged' ? 1.28 : 1.0);
        const frames =
          skillId === 'dragon_pulse' || skillId === 'solar_beam' || skillId === 'ice_beam'
            ? vfxAtlas.dragonPulse
            : skillId === 'fireball'
              ? vfxAtlas.fireball
              : vfxAtlas.swiftStar;
        for (let i = 0; i < count; i++) {
          const t = targets[i];
          const dx = t.x - f.x;
          const dy = t.y - f.y;
          const dz = t.z - f.z;
          const d3 = Math.hypot(dx, dy, dz) || 1;
          spawnSkillProjectile3D({
            x: f.x,
            y: f.y + 1.05,
            z: f.z,
            vx: (dx / d3) * speed,
            vy: (dy / d3) * speed,
            vz: (dz / d3) * speed,
            dmg,
            radius: sc * 0.42,
            pierce:
              skillId === 'dragon_pulse' || skillId === 'solar_beam' || skillId === 'ice_beam'
                ? 5
                : f.level >= 3
                  ? 2
                  : 1,
            life: 1.45,
            colorHex: meta.hex,
            scale: sc,
            frames,
            ownerId: f.id,
            skillId,
          });
        }
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, 1.4, 0.2);
        sound.play(skillId === 'ice_beam' ? 'water' : 'fireball');
      }
    };

    const spawnEnemy3D = (
      x: number,
      z: number,
      species: SpeciesId,
      hp: number,
      speed: number,
      dmg: number,
      opts?: { isBoss?: boolean; isTrainer?: boolean; trainerSprite?: string; trainerName?: string; isAquatic?: boolean },
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const isBoss = Boolean(opts?.isBoss);
      const isTrainer = Boolean(opts?.isTrainer);
      const isAquatic = Boolean(opts?.isAquatic);
      const rawQ: MonsterQuality = isBoss
        ? 'epic'
        : isTrainer
          ? 'elite'
          : rollMonsterQuality(sim.elapsed);
      // Keep Elite/Epic genuinely special & rare!
      const quality: MonsterQuality =
        !isBoss && !isTrainer && (rawQ === 'elite' || rawQ === 'epic') && Math.random() < 0.55
          ? 'normal'
          : rawQ;
      const isShiny = !isTrainer && Math.random() < (isBoss ? 0.06 : 0.02);
      const cityRegionalSkin =
        !isTrainer && !isShiny && activeWorldRun
          ? (liveOverlandCityRef.current?.regionalSkinId ?? activeWorldRun.regionalSkinId)
          : undefined;
      const regionalSkin: PetSkinId | undefined =
        cityRegionalSkin && Math.random() < (isBoss ? 0.5 : 0.3) ? cityRegionalSkin : undefined;
      const regionalSkinDef = regionalSkin ? getSkinDef(regionalSkin) : undefined;
      const docileSpecies = new Set<SpeciesId>(['munchlax', 'jigglypuff', 'mew', 'psyduck', 'eevee']);
      const territorialSpecies = new Set<SpeciesId>(['bulbasaur', 'squirtle', 'pikachu', 'meowth']);
      const temperament: 'docile' | 'territorial' | 'aggressive' =
        isBoss || isTrainer
          ? 'aggressive'
          : docileSpecies.has(species)
            ? 'docile'
            : territorialSpecies.has(species)
              ? 'territorial'
              : 'aggressive';
      const qMeta = MONSTER_QUALITY_META[quality];
      const stage: 'baby' | 'teen' | 'adult' = isBoss
        ? 'adult'
        : quality === 'epic'
          ? 'adult'
          : quality === 'elite'
            ? 'teen'
            : 'baby';
      const stageAsset = SPECIES_CATALOG[species].stageSprites[stage];
      const url = isTrainer ? opts!.trainerSprite! : stageAsset.static;
      const animGif = isTrainer ? undefined : stageAsset.animated;
      const worldScale = isTrainer
        ? 2.35
        : getPokemonWorldScale3D(species, stage, qMeta.scaleMult * (isBoss ? 1.2 : 1.0));
      const { sprite, shadow, animSheet, backAnimSheet, pmdSheet } = createSpriteEntity(
        url,
        worldScale,
        animGif,
        isShiny,
      );
      if (regionalSkinDef && regionalSkinDef.id !== 'classic') {
        (sprite.material as THREE.MeshBasicMaterial).color.setHex(regionalSkinDef.tintHex3D);
      }
      const gy = getTerrainHeight3D(x, z);
      sprite.position.set(x, gy - 0.04, z);
      sprite.rotation.set(-camOrbitRef.current.pitch * BILLBOARD_PITCH_TILT, camOrbitRef.current.yaw, 0);
      shadow.position.set(x, gy + 0.06, z);
      scene.add(sprite, shadow);

      let auraRing: THREE.Mesh | undefined;
      if (!isTrainer && (quality !== 'normal' || isShiny || isBoss || Boolean(regionalSkinDef))) {
        const ringColor = isShiny
          ? 0xffe066
          : regionalSkinDef
            ? regionalSkinDef.tintHex3D
            : qMeta.hex;
        auraRing = new THREE.Mesh(
          new THREE.RingGeometry(worldScale * 0.34, worldScale * 0.48, 22),
          new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: isShiny || isBoss ? 0.78 : regionalSkinDef ? 0.68 : 0.56,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        auraRing.rotation.x = -Math.PI / 2;
        auraRing.position.set(x, gy + 0.09, z);
        scene.add(auraRing);
      }

      const finalHp = Math.round(hp * (isBoss || isTrainer ? 1 : qMeta.hpMult) * (isShiny ? 1.25 : 1));
      const finalDmg = Math.round(dmg * (isBoss || isTrainer ? 1 : qMeta.dmgMult));
      if (isShiny && !isBoss) {
        sound.play('levelup');
        showBanner(
          `✨ 发现【★异色】${SPECIES_CATALOG[species].stageNames[stage] ?? SPECIES_CATALOG[species].defaultName}！削弱或击败后可靠近投球收服！`,
          3400,
        );
      }
      sim.enemies.push({
        id: sim.nextId++,
        x,
        y: gy,
        z,
        hp: finalHp,
        maxHp: finalHp,
        speed,
        radius: Math.max(0.82, worldScale * 0.38),
        species,
        stage,
        worldScale,
        quality,
        isShiny,
        regionalSkin,
        isBoss,
        isTrainer,
        trainerSprite: opts?.trainerSprite,
        trainerName: opts?.trainerName,
        shootCd: 1.8,
        hitFlash: 0,
        dmg: finalDmg,
        hopPhase: Math.random() * 6,
        animTime: Math.random() * 2,
        animSheet,
        backAnimSheet,
        pmdSheet,
        sprite,
        shadow,
        auraRing,
        shinyTimer: 0.35,
        temperament,
        aggroed: isBoss || isTrainer,
        homeX: x,
        homeZ: z,
        isAquatic,
        waterJumpTimer: isAquatic ? 1.2 + Math.random() * 2.5 : undefined,
      });
    };

    // Launch real-time 3D Cinematic Poké Ball Capture Animation (Arc -> Crimson Absorb -> 3 Wobbles -> Starburst!)
    const startCaptureAnim3D = (target: Enemy3D) => {
      const sim = simRef.current;
      if (!sim || target.beingCaptured) return;
      if (savePetsCountRef.current >= MAX_PET_SLOTS) {
        sound.play('error');
        showBanner(
          `📦 精灵球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})，无法继续捕捉！请先放生多余精灵，或结束本局战斗后寄存到大木博士处！`,
          4000,
        );
        return;
      }
      target.beingCaptured = true;
      const ballUrl = target.isBoss
        ? '/sprites/items/master-ball.png'
        : target.isShiny || target.quality === 'epic'
          ? '/sprites/items/ultra-ball.png'
          : target.quality === 'elite'
            ? '/sprites/items/great-ball.png'
            : '/sprites/items/poke-ball.png';
      const ballSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getPixelTexture(ballUrl),
          transparent: true,
          alphaTest: 0.1,
        }),
      );
      ballSprite.scale.set(1.2, 1.2, 1);
      ballSprite.position.set(sim.px, sim.py + 1.6, sim.pz);
      const ballShadow = new THREE.Mesh(UNIT_SHADOW_GEO, SHARED_ENTITY_SHADOW_MAT);
      ballShadow.rotation.x = -Math.PI / 2;
      ballShadow.scale.setScalar(0.45);
      ballShadow.position.set(sim.px, sim.py + 0.06, sim.pz);
      scene.add(ballSprite, ballShadow);

      const hpFrac = Math.max(0, target.hp) / Math.max(1, target.maxHp);
      const catchBonus = metaBonusesRef.current.catchRateBonus;
      const willCatch =
        Boolean(target.knockedOut) ||
        Math.random() < Math.min(0.98, 0.92 - hpFrac * 0.48 + catchBonus);
      const phys = getPokemonPhysicalMetrics(target.species, target.stage);
      const spMeta = SPECIES_CATALOG[target.species];
      const spName = spMeta.stageNames[target.stage] ?? spMeta.defaultName;
      const catchLv = target.isBoss
        ? Math.min(32, pet.level + 4)
        : Math.min(28, Math.max(4, pet.level + (target.quality === 'epic' ? 2 : target.isShiny ? 2 : 0)));
      const isNewSpecies = !save.discoveredSpecies.includes(target.species);

      // REAL 3D CLOSE-UP CINEMATIC CAPTURE (Pauses combat enemies while Three.js camera tracks the real flying 3D Poké Ball -> impact -> 3 wobbles -> Handheld Pokédex Reveal!)
      pausedRef.current = true;
      sound.play('pokeball');
      const gyStart = getTerrainHeight3D(sim.px, sim.pz);
      const gyTarget = getTerrainHeight3D(target.x, target.z);
      ballSprite.position.set(sim.px, Math.max(sim.py, gyStart) + 1.5, sim.pz);
      ballSprite.scale.set(1.35, 1.35, 1);
      sim.activeCaptures = [
        {
          id: sim.nextId++,
          enemy: target,
          startX: sim.px,
          startY: Math.max(sim.py, gyStart) + 1.55,
          startZ: sim.pz,
          targetX: target.x,
          targetY: Math.max(target.y, gyTarget) + Math.min(1.5, target.worldScale * 0.45),
          targetZ: target.z,
          t: 0,
          willCatch,
          wobbleClicks: 0,
          absorbed: false,
          resolved: false,
          ballSprite,
          ballShadow,
        },
      ];
      setCaptureCutscene({
        species: target.species,
        name: spName,
        sprite: spMeta.stageSprites[target.stage].animated,
        ballSprite: ballUrl,
        level: catchLv,
        isShiny: target.isShiny,
        isNewSpecies,
        dexNo: spMeta.dexNo,
        typeLabel: spMeta.typeLabel,
        typeColor: spMeta.typeColor,
        lore: spMeta.description,
        quality: target.quality,
        heightM: phys.heightM,
        weightKg: phys.weightKg,
        phase: 'throw',
        wobbleCount: 0,
      });

      const finishCaptureModal = () => {
        for (const c of sim.activeCaptures) {
          scene.remove(c.ballSprite, c.ballShadow);
        }
        sim.activeCaptures = [];
        setCaptureCutscene(null);
        captureFinishRef.current = null;
        if (willCatch && target.isBoss && gameMode === 'story' && !endedRef.current) {
          sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
          endedRef.current = true;
          pausedRef.current = true;
          setResultSummary(buildResultSummary(true, sim.capturedBoss));
        } else {
          pausedRef.current = false;
        }
      };
      captureFinishRef.current = finishCaptureModal;
    };

    // Wire Active Combat Commands (Throw Ball / Heal Potion / Boost Candy / Team Salvo / Proximity Capture!)
    triggerBattleActionRef.current = (kind, enemyId) => {
      const sim = simRef.current;
      if (!sim || pausedRef.current || endedRef.current) return;

      if (kind === 'dismiss_ko') {
        const idx = sim.enemies.findIndex((e) => e.id === enemyId && e.knockedOut);
        if (idx !== -1) {
          const en = sim.enemies[idx];
          if (en.sprite) scene.remove(en.sprite);
          if (en.shadow) scene.remove(en.shadow);
          if (en.auraRing) scene.remove(en.auraRing);
          sim.enemies.splice(idx, 1);
          setNearbyKoTarget(null);
          sound.play('cancel');
          if (en.isBoss && gameMode === 'story') {
            sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
            endedRef.current = true;
            pausedRef.current = true;
            setResultSummary(buildResultSummary(true, sim.capturedBoss));
          }
        }
        return;
      }

      if (kind === 'capture_ko') {
        if (savePetsCountRef.current >= MAX_PET_SLOTS) {
          sound.play('error');
          showBanner(
            `📦 精灵球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})，无法捕捉！请先放生精灵，或结束战斗后再寄存！`,
            4000,
          );
          return;
        }
        const en = sim.enemies.find((e) => e.id === enemyId && e.knockedOut && !e.beingCaptured);
        if (en) {
          setNearbyKoTarget(null);
          startCaptureAnim3D(en);
        }
        return;
      }

      if (kind === 'ball') {
        if (savePetsCountRef.current >= MAX_PET_SLOTS) {
          sound.play('error');
          showBanner(
            `📦 精灵球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})，无法投球捕捉！请先放生多余精灵，或结束战斗后寄存！`,
            4000,
          );
          return;
        }
        if (sim.actionCds.ball > 0) {
          sound.play('error');
          return;
        }
        // Prioritize knocked-out Pokémon first, then Shiny/Epic/Elite/weakened wild Pokémon within 18m!
        const ko = sim.enemies
          .filter((e) => e.knockedOut && !e.beingCaptured && Math.hypot(e.x - sim.px, e.z - sim.pz) < 16)
          .sort((a, b) => Math.hypot(a.x - sim.px, a.z - sim.pz) - Math.hypot(b.x - sim.px, b.z - sim.pz))[0];
        const liveWild = sim.enemies
          .filter((e) => !e.isTrainer && !e.isBoss && !e.knockedOut && !e.beingCaptured && e.hp > 0 && Math.hypot(e.x - sim.px, e.z - sim.pz) < 18)
          .sort((a, b) => {
            const score = (e: Enemy3D) =>
              (e.isShiny ? 200 : 0) +
              (e.quality === 'epic' ? 120 : e.quality === 'elite' ? 80 : e.quality === 'uncommon' ? 30 : 0) +
              (1 - e.hp / Math.max(1, e.maxHp)) * 90 -
              Math.hypot(e.x - sim.px, e.z - sim.pz) * 2;
            return score(b) - score(a);
          })[0];
        const chosen = ko ?? liveWild;
        if (!chosen) {
          sound.play('error');
          showBanner('附近没有可投球捕捉的野生宝可梦！', 1800);
          return;
        }
        sim.actionCds.ball = ko ? 2.5 : 5.5;
        setNearbyKoTarget(null);
        startCaptureAnim3D(chosen);
        return;
      }

      if (kind === 'heal') {
        if (sim.actionCds.heal > 0 || sim.healCharges <= 0) {
          sound.play('error');
          return;
        }
        sim.healCharges -= 1;
        sim.actionCds.heal = 10;
        const healAmt = Math.round(sim.maxHp * 0.45);
        sim.hp = Math.min(sim.maxHp, sim.hp + healAmt);
        sound.play('heal_jingle');
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.healCircleDecal, 5.2, 0.55);
        spawnGlowFlash(sim.px, sim.py, sim.pz, 0x51cf66, 4.2, 0.42);
        spawnPixelParticles(sim.px, sim.py + 0.5, sim.pz, vfxAtlas.healPlus, 10, 3.2, 0.82, 5.2, 4.2);
        sim.dmgPops.push({
          id: sim.nextId++,
          wx: sim.px,
          wy: sim.py + 2.7,
          wz: sim.pz,
          text: `+${healAmt} HP`,
          color: '#69db7c',
          life: 0.78,
        });
        showBanner(`使用好伤药！全队恢复 +${healAmt} HP（剩余 ${sim.healCharges} 瓶）`, 2000);
        return;
      }

      if (kind === 'boost') {
        if (sim.actionCds.boost > 0) {
          sound.play('error');
          return;
        }
        sim.actionCds.boost = 20;
        sim.boostTimer = 8.0;
        sound.play('levelup');
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.electricRingDecal, 5.6, 0.52);
        spawnGlowFlash(sim.px, sim.py, sim.pz, 0xffd43b, 4.6, 0.46);
        spawnPixelParticles(sim.px, sim.py + 0.8, sim.pz, vfxAtlas.starGlint, 12, 5.4, 0.88, 5.0, 6.0);
        showBanner('力量强化激活！8秒内全队攻击 +55%、技能充能大幅加速！', 2600);
        return;
      }

      if (kind === 'salvo') {
        if (sim.actionCds.salvo > 0) {
          sound.play('error');
          return;
        }
        sim.actionCds.salvo = 14;
        sim.boostTimer = Math.max(sim.boostTimer, 10.0); // Triggers 10s Mega / Gigantamax Surge!
        sound.play('levelup');
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.arcaneRingDecal, 6.8, 0.56);
        spawnPixelParticles(sim.px, sim.py + 1.0, sim.pz, vfxAtlas.starGlint, 16, 6.4, 0.9, 5.2, 8.0);
        for (const f of sim.followers) {
          f.cds = f.cds.map(() => 0);
          fireSkill(f, f.skills[0], true);
          if (f.sprite) {
            const megaSc = getPokemonWorldScale3D(f.species, f.stage) * 1.38;
            f.sprite.scale.set(megaSc, megaSc, 1);
          }
        }
        showBanner('✨ 超进化 / 极巨齐射爆发！全队进入 10 秒巨化高能形态并释放招牌绝招！', 2800);
      }
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
    const projVec = new THREE.Vector3();

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
          // Completely pause WebGL 3D rendering while the Handheld Console / Manager modal covers the screen!
          if (externalPausedRef.current) {
            rafId = window.requestAnimationFrame(animate);
            return;
          }
          const t = now * 0.001;
          const isMapPreview = phase === 'map_select';
          const orbit = t * 0.085 + 0.42;
          const camRad = isMapPreview ? 24.5 : 19.5;
          const cx = Math.sin(orbit) * camRad;
          const cz = Math.cos(orbit) * camRad - 2.2;
          const camFloor = getTerrainHeight3D(cx, cz);
          const camY = Math.max(camFloor + (isMapPreview ? 11.8 : 8.8), isMapPreview ? 15.6 : 11.6);
          const lookY = isMapPreview ? 1.3 : 1.7;
          const lookZ = -2.4;
          const pCamFwdX = -cx;
          const pCamFwdZ = lookZ - cz;
          const pCamLen = Math.hypot(pCamFwdX, pCamFwdZ) || 1;
          const cfX = pCamFwdX / pCamLen;
          const cfZ = pCamFwdZ / pCamLen;
          const crX = -cfZ;
          const crZ = cfX;
          const prevYaw = Math.atan2(cx, cz - lookZ);
          const prevPitch = Math.atan2(Math.max(0.1, camY - lookY), pCamLen);
          const tiltX = -prevPitch * BILLBOARD_PITCH_TILT;
          syncFloraBillboards(prevYaw, prevPitch, t);

          // Living Protagonist: periodic joyful hop, looking around at companions & floating pixel emote bubble!
          const heroCycle = t % 6.2;
          const heroHop = heroCycle > 1.2 && heroCycle < 1.9 ? Math.abs(Math.sin(((heroCycle - 1.2) / 0.7) * Math.PI * 2)) * 0.48 : 0;
          const heroY0 = getTerrainHeight3D(0, 0);
          playerSprite.position.set(0, heroY0 + heroHop - 0.04, 0);
          playerSprite.rotation.set(tiltX, prevYaw, 0);
          playerShadow.position.set(0, heroY0 + 0.06, 0);
          const heroFrame =
            heroHop > 0.08
              ? heroFrames.down_1
              : heroCycle > 3.0 && heroCycle < 4.1
                ? heroFrames.left_0
                : heroCycle > 4.4 && heroCycle < 5.4
                  ? heroFrames.right_0
                  : Math.floor(t * 2.2) % 2 === 0
                    ? heroFrames.down_idle0 ?? heroFrames.down_0
                    : heroFrames.down_idle1 ?? heroFrames.down_0;
          if (playerSpriteMat.map !== heroFrame) {
            playerSpriteMat.map = heroFrame;
            playerSpriteMat.needsUpdate = true;
          }
          const showHeroEmote = heroCycle > 1.0 && heroCycle < 2.9;
          heroEmoteSprite.visible = showHeroEmote;
          if (showHeroEmote) {
            const eIdx = Math.floor(t / 6.2) % emoteKinds.length;
            const eTex = getPixelEmoteTexture(emoteKinds[eIdx]);
            if (heroEmoteSprite.material.map !== eTex) {
              heroEmoteSprite.material.map = eTex;
              heroEmoteSprite.material.needsUpdate = true;
            }
            heroEmoteSprite.position.set(0.2, heroY0 + 3.45 + heroHop + Math.sin(t * 5) * 0.14, 0);
          }

          // ALL Squad Followers ALWAYS face the rotating camera, hop playfully, and pop cute pixel emotes!
          const emoteFollowerIdx = Math.floor(t / 4.8) % Math.max(1, sim.followers.length);
          const petEmotePhase = t % 4.8;
          let petEmotePlaced = false;
          sim.followers.forEach((f, idx) => {
            const baseAng = (idx * Math.PI * 2) / Math.max(1, sim.followers.length) + 0.65;
            const rad = 3.2 + (idx % 2) * 1.15;
            const fx = Math.cos(baseAng + Math.sin(t * 0.35 + idx) * 0.12) * rad;
            const fz = Math.sin(baseAng + Math.cos(t * 0.32 + idx) * 0.12) * rad;
            const gy = getTerrainHeight3D(fx, fz);
            const cheer = (t + idx * 1.35) % 4.2;
            const hop = cheer < 0.65 ? Math.abs(Math.sin((cheer / 0.65) * Math.PI * 2)) * 0.38 : Math.abs(Math.sin(t * 3.4 + idx)) * 0.08;
            const sc = getPokemonWorldScale3D(f.species, f.stage);
            if (f.sprite) {
              f.sprite.position.set(fx, gy + hop - 0.04, fz);
              f.sprite.rotation.set(tiltX, prevYaw, 0);
              if (f.pmdSheet?.ready) {
                // Face gently toward camera / hero so every companion looks expressive from any orbit angle!
                const lookDirX = Math.sin(t * 0.55 + idx * 1.4);
                const lookDirZ = Math.cos(t * 0.55 + idx * 1.4);
                const relFwd = lookDirX * cfX + lookDirZ * cfZ;
                const relRight = lookDirX * crX + lookDirZ * crZ;
                const dirIdx = pickPmdDirIndex(relFwd, relRight);
                (f.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
                  f.pmdSheet,
                  dirIdx,
                  t * 1.1 + idx * 0.5,
                );
                f.sprite.scale.set(sc, sc, 1);
              } else if (f.animSheet) {
                (f.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
                  f.animSheet,
                  t * 1.15 + idx * 0.4,
                );
                f.sprite.scale.set(sc, sc, 1);
              }
            }
            if (f.shadow) {
              f.shadow.position.set(fx, gy + 0.06, fz);
            }
            if (idx === emoteFollowerIdx && petEmotePhase > 1.2 && petEmotePhase < 3.1) {
              petEmotePlaced = true;
              const peTex = getPixelEmoteTexture(emoteKinds[(idx + 1) % emoteKinds.length]);
              if (petEmoteSprite.material.map !== peTex) {
                petEmoteSprite.material.map = peTex;
                petEmoteSprite.material.needsUpdate = true;
              }
              petEmoteSprite.position.set(fx, gy + sc + 0.75 + hop + Math.sin(t * 5.2) * 0.12, fz);
            }
          });
          petEmoteSprite.visible = petEmotePlaced;

          // Living Kanto Wildlife Diorama Update (Flybys, Road Strollers, Leaping Lake Fish/Dragons & Burrowing Diglett!)
          for (const ps of previewSprites) {
            if (ps.kind === 'flyby') {
              // Straight-line majestic sky crossing across the distant horizon (never circles over the hero!)
              const span = ps.span ?? 74;
              const spd = ps.speed ?? 6.0;
              const prog = (((t * spd + ps.phase * 6) % (span * 2)) + span * 2) % (span * 2) - span;
              const dx = ps.dirX ?? 1;
              const dz = ps.dirZ ?? 0;
              const wx = ps.baseX + dx * prog;
              const wz = ps.baseZ + dz * prog;
              const gy = getTerrainHeight3D(wx, wz);
              const flyY = Math.max(gy + 5.5, (ps.altitude ?? 11) + Math.sin(t * 1.9 + ps.phase) * 0.75);
              const relFwd = dx * cfX + dz * cfZ;
              const relRight = dx * crX + dz * crZ;
              const bankZ = Math.max(-0.14, Math.min(0.14, -relRight * 0.1));
              ps.sprite.visible = true;
              ps.shadow.visible = true;
              ps.sprite.position.set(wx, flyY, wz);
              ps.sprite.rotation.set(tiltX, prevYaw, bankZ);
              ps.shadow.position.set(wx, Math.max(WATER_LEVEL_3D, gy) + 0.08, wz);
              if (ps.pmdSheet?.ready) {
                const dirIdx = pickPmdDirIndex(relFwd, relRight);
                (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(ps.pmdSheet, dirIdx, t * 1.55 + ps.phase);
              } else if (ps.animSheet) {
                (ps.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(ps.animSheet, t * 1.3 + ps.phase);
              }
              continue;
            }

            if (ps.kind === 'road_stroll') {
              // Leisurely strolling back and forth along the real dirt roads!
              const span = ps.span ?? 28;
              const ang = t * (ps.speed ?? 0.12) + ps.phase;
              const sPos = Math.sin(ang) * span;
              const sVel = Math.cos(ang);
              const dx = (ps.dirX ?? 1) * (sVel >= 0 ? 1 : -1);
              const dz = (ps.dirZ ?? 0) * (sVel >= 0 ? 1 : -1);
              const wx = ps.baseX + (ps.dirX ?? 1) * sPos;
              const wz = ps.baseZ + (ps.dirZ ?? 0) * sPos;
              const gy = Math.max(WATER_LEVEL_3D + 0.05, getTerrainHeight3D(wx, wz));
              const hop = Math.abs(Math.sin(t * 6.2 + ps.phase)) * 0.14;
              ps.sprite.position.set(wx, gy + hop - 0.04, wz);
              ps.sprite.rotation.set(tiltX, prevYaw, 0);
              ps.shadow.position.set(wx, gy + 0.06, wz);
              if (ps.pmdSheet?.ready) {
                const relFwd = dx * cfX + dz * cfZ;
                const relRight = dx * crX + dz * crZ;
                const dirIdx = pickPmdDirIndex(relFwd, relRight);
                (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(ps.pmdSheet, dirIdx, t * 1.25 + ps.phase);
              } else if (ps.animSheet) {
                (ps.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(ps.animSheet, t + ps.phase);
              }
              continue;
            }

            if (ps.kind === 'water_leap') {
              // Magikarp & HUGE Gyarados dramatically leaping out of organic lakes in parabolic splash arcs!
              const cycle = ((t * 0.42 + ps.phase) % 3.2);
              const isAirborne = cycle < 1.35;
              if (!isAirborne) {
                ps.sprite.visible = false;
                ps.shadow.visible = false;
                continue;
              }
              const u = cycle / 1.35; // 0..1 across jump arc
              const arc = Math.sin(u * Math.PI);
              const drift = (u - 0.5) * 4.4;
              const dirAng = Math.floor((t * 0.42 + ps.phase) / 3.2) * 1.9 + ps.phase;
              const dx = Math.cos(dirAng);
              const dz = Math.sin(dirAng);
              const wx = ps.baseX + dx * drift;
              const wz = ps.baseZ + dz * drift;
              const y = WATER_LEVEL_3D - 0.65 + arc * (ps.jumpH ?? 3.6);
              const tiltArc = (0.5 - u) * 0.48;
              ps.sprite.visible = true;
              ps.shadow.visible = true;
              ps.sprite.position.set(wx, y, wz);
              ps.sprite.rotation.set(tiltX, prevYaw, tiltArc);
              ps.shadow.position.set(wx, WATER_LEVEL_3D + 0.05, wz);
              if (ps.pmdSheet?.ready) {
                const relFwd = dx * cfX + dz * cfZ;
                const relRight = dx * crX + dz * crZ;
                const dirIdx = pickPmdDirIndex(relFwd, relRight);
                (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(ps.pmdSheet, dirIdx, t * 2.2 + ps.phase);
              }
              continue;
            }

            if (ps.kind === 'water_swim') {
              // Lapras serenely swimming across the lake surface!
              const a = t * 0.28 + ps.phase;
              const wx = ps.baseX + Math.cos(a) * 4.2;
              const wz = ps.baseZ + Math.sin(a * 0.8) * 3.4;
              const vx = -Math.sin(a) * 4.2;
              const vz = Math.cos(a * 0.8) * 3.4 * 0.8;
              const vLen = Math.hypot(vx, vz) || 1;
              const bob = Math.sin(t * 2.5 + ps.phase) * 0.1;
              ps.sprite.position.set(wx, WATER_LEVEL_3D + 0.02 + bob, wz);
              ps.sprite.rotation.set(tiltX, prevYaw, 0);
              ps.shadow.position.set(wx, WATER_LEVEL_3D + 0.03, wz);
              if (ps.pmdSheet?.ready) {
                const relFwd = (vx / vLen) * cfX + (vz / vLen) * cfZ;
                const relRight = (vx / vLen) * crX + (vz / vLen) * crZ;
                const dirIdx = pickPmdDirIndex(relFwd, relRight);
                (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(ps.pmdSheet, dirIdx, t * 1.1 + ps.phase);
              }
              continue;
            }

            if (ps.kind === 'burrow') {
              // Diglett & Dugtrio popping smoothly up out of the earth, peeking around, then burrowing back down!
              const cycle = (t * 0.55 + ps.phase) % 4.0;
              const holeIdx = Math.floor((t * 0.55 + ps.phase) / 4.0);
              const ox = Math.sin(holeIdx * 2.3 + ps.phase) * 2.2;
              const oz = Math.cos(holeIdx * 1.9 + ps.phase) * 2.2;
              const wx = ps.baseX + ox;
              const wz = ps.baseZ + oz;
              const gy = getTerrainHeight3D(wx, wz);
              let emerge = 0;
              if (cycle < 0.35) emerge = cycle / 0.35;
              else if (cycle < 2.25) emerge = 1.0;
              else if (cycle < 2.65) emerge = 1.0 - (cycle - 2.25) / 0.4;
              else emerge = 0;

              if (emerge <= 0.02 || gy < WATER_LEVEL_3D + 0.15) {
                ps.sprite.visible = false;
                ps.shadow.visible = false;
                continue;
              }
              ps.sprite.visible = true;
              ps.shadow.visible = true;
              ps.sprite.scale.set(ps.scale, ps.scale * emerge, 1);
              ps.sprite.position.set(wx, gy - 0.06, wz);
              ps.sprite.rotation.set(tiltX, prevYaw, 0);
              ps.shadow.position.set(wx, gy + 0.05, wz);
              if (ps.pmdSheet?.ready) {
                const peekAng = Math.sin(t * 2.0 + ps.phase) * 1.3;
                const dirIdx = pickPmdDirIndex(-Math.cos(peekAng), Math.sin(peekAng));
                (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(ps.pmdSheet, dirIdx, t * 0.9 + ps.phase);
              }
              continue;
            }

            // Default: peaceful meadow grazing wild Pokémon
            const hop = Math.abs(Math.sin(t * 4.2 + ps.phase)) * 0.14;
            const wx = ps.baseX + Math.sin(t * 0.42 + ps.phase) * 1.6;
            const wz = ps.baseZ + Math.cos(t * 0.36 + ps.phase) * 1.6;
            const vx = Math.cos(t * 0.42 + ps.phase) * 0.67;
            const vz = -Math.sin(t * 0.36 + ps.phase) * 0.58;
            const vLen = Math.hypot(vx, vz) || 1;
            const gy = getTerrainHeight3D(wx, wz);
            ps.sprite.position.set(wx, gy + hop - 0.04, wz);
            ps.sprite.rotation.set(tiltX, prevYaw, 0);
            ps.shadow.position.set(wx, gy + 0.06, wz);
            if (ps.pmdSheet?.ready) {
              const relFwd = (vx / vLen) * cfX + (vz / vLen) * cfZ;
              const relRight = (vx / vLen) * crX + (vz / vLen) * crZ;
              const dirIdx = pickPmdDirIndex(relFwd, relRight);
              (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
                ps.pmdSheet,
                dirIdx,
                t + ps.phase,
              );
            } else if (ps.animSheet) {
              (ps.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
                ps.animSheet,
                t + ps.phase,
              );
            }
          }
          // Wide elevated diorama overlook camera with rich stepped terrain depth!
          camera.position.set(cx, camY, cz);
          camera.lookAt(0, lookY, lookZ);
          horizonBackdrop.position.set(cx, 0, cz);
          waterMat.uniforms.uTime.value = t;
          if (horizonBackdrop.userData?.skyUniforms?.uTime) {
            horizonBackdrop.userData.skyUniforms.uTime.value = t;
          }
          renderer.render(scene, camera);
          rafId = window.requestAnimationFrame(animate);
          return;
        }
        heroEmoteSprite.visible = false;
        petEmoteSprite.visible = false;

        // Pause 3D GPU rendering when Handheld Console / Manager overlay is open on top of combat!
        if (externalPausedRef.current) {
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

        if (!pausedRef.current && !externalPausedRef.current && !inRunTownShopOpenRef.current && !endedRef.current) {
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

          const mLen = Math.hypot(mx, mz);
          if (mLen > 1) {
            mx /= mLen;
            mz /= mLen;
          }

          // Camera-yaw rotation keys (Z/[ left, C/] right) + align movement to active 3D camera yaw!
          if (ks.has('z') || ks.has('[')) camOrbitRef.current.yaw -= dt * 1.9;
          if (ks.has('c') || ks.has(']')) camOrbitRef.current.yaw += dt * 1.9;
          const cy = Math.cos(camOrbitRef.current.yaw);
          const sy = Math.sin(camOrbitRef.current.yaw);
          const worldMx = mx * cy + mz * sy;
          const worldMz = -mx * sy + mz * cy;

          // Animate 3D pixel wave swells & sparkling crests on localized scenic lakes!
          waterMat.uniforms.uTime.value = sim.elapsed;
          if (surfWarnCdRef.current > 0) surfWarnCdRef.current = Math.max(0, surfWarnCdRef.current - dt);

          const hasWaterSurfer = sim.followers.some(
            (f) => SPECIES_CATALOG[f.species].element === 'water',
          );
          const moveSpeed = 7.6 * sim.speedMult;
          const nextPx = sim.px + worldMx * moveSpeed * dt;
          const nextPz = sim.pz + worldMz * moveSpeed * dt;
          const nextGroundY = getWalkableSurfaceHeight3D(nextPx, nextPz);
          const enteringDeepWater = nextGroundY < WATER_LEVEL_3D - 0.14;
          if (enteringDeepWater && !hasWaterSurfer) {
            if (surfWarnCdRef.current <= 0 && mLen > 0.1) {
              surfWarnCdRef.current = 3.5;
              sound.play('error');
              showBanner('🌊 前方是深水湖泊！走桥梁可自由通行，或携带水系宝可梦冲浪渡水！', 3200);
            }
          } else if (nextGroundY <= sim.py + 1.45) {
            sim.px = nextPx;
            sim.pz = nextPz;
          }
          const rawGroundY = getWalkableSurfaceHeight3D(sim.px, sim.pz);
          const surfingNow = rawGroundY < WATER_LEVEL_3D - 0.1 && hasWaterSurfer;
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

          // 3D Jump physics (High enough to scale 2.0m stone terrace ledges cleanly!)
          if (jumpQueuedRef.current) {
            jumpQueuedRef.current = false;
            if (sim.py <= groundY + 0.14) {
              sim.vy = 11.2;
              sound.play('jump');
            }
          }
          sim.vy -= 23 * dt;
          sim.py += sim.vy * dt;
          if (sim.py < groundY) {
            sim.py = groundY;
            sim.vy = 0;
          }

          if (mLen > 0.08) {
            sim.facingAngle = Math.atan2(worldMx, worldMz);
            sim.walkDist += mLen * moveSpeed * dt;
          }

          // Camera-Relative 360° Directional Sprite Selection for Protagonist + Upright Y-Billboard Foreshortening!
          const camYawNow = camOrbitRef.current.yaw;
          const camPitchNow = camOrbitRef.current.pitch;
          const bbTiltX = -camPitchNow * BILLBOARD_PITCH_TILT;
          windClock += dt;
          syncFloraBillboards(camYawNow, camPitchNow, windClock);
          // Animate live 3D Weather Particles (Rain / Storm / Snow) + Procedural Town Trains + Town Colliders!
          const curWeatherKind = liveWeatherRef.current.kind;
          const isPrecip = curWeatherKind === 'rain' || curWeatherKind === 'storm' || curWeatherKind === 'snow';
          weatherPoints.visible = isPrecip;
          if (isPrecip) {
            weatherMat.color.setHex(
              curWeatherKind === 'snow' ? 0xffffff : curWeatherKind === 'storm' ? 0x748ffc : 0xa5d8ff,
            );
            weatherMat.size = curWeatherKind === 'snow' ? 0.36 : 0.28;
            const posAttr = weatherGeo.getAttribute('position') as THREE.BufferAttribute;
            const fallSpeed = curWeatherKind === 'snow' ? 3.2 : curWeatherKind === 'storm' ? 24 : 18;
            const driftX = curWeatherKind === 'snow' ? Math.sin(windClock * 1.4) * 1.6 : curWeatherKind === 'storm' ? 4.5 : 1.8;
            for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
              let px = posAttr.getX(i) + driftX * dt;
              let py = posAttr.getY(i) - fallSpeed * dt;
              let pz = posAttr.getZ(i);
              if (py < 0.2) {
                py = 16 + Math.random() * 6;
                px = (Math.random() - 0.5) * 44;
                pz = (Math.random() - 0.5) * 44;
              }
              posAttr.setXYZ(i, px, py, pz);
            }
            posAttr.needsUpdate = true;
            weatherPoints.position.set(sim.px, sim.py, sim.pz);
          }

          // Periodically save player world coordinates so re-entering resumes at last exit spot!
          if (!getActiveGeoTerrainOrigin() && now - lastPosPersistAt > 2000) {
            lastPosPersistAt = now;
            try {
              window.localStorage.setItem(
                'pocket_paw_last_world_pos_v1',
                JSON.stringify({ x: Number(sim.px.toFixed(1)), z: Number(sim.pz.toFixed(1)) }),
              );
            } catch {
              // ignore
            }
          }

          let closestTownPoint: TownInteractPoint | null = null;
          let closestTownDist = 999;
          let activeTownNow: ProceduralTownInstance | null = null;
          let activeInteriorIdNow: string | null = null;
          for (const town of proceduralTowns) {
            if (town.trainGroup && town.trainBaseX !== undefined) {
              town.trainGroup.position.x = town.trainBaseX + Math.sin(windClock * 0.28) * 6.5;
            }
            if (town.animatedParts) {
              for (const sp of town.animatedParts.spinners) {
                sp.rotation.y = windClock * 1.1;
              }
              for (const ft of town.animatedParts.fountains) {
                ft.scale.y = 0.85 + Math.sin(windClock * 5.2) * 0.22;
              }
              for (const bb of town.animatedParts.billboards) {
                bb.rotation.set(bbTiltX, camYawNow, 0);
              }
              // Live boulevard pixel traffic!
              for (const v of town.animatedParts.vehicles) {
                v.coord += v.dir * v.speed * dt;
                if (v.dir > 0 && v.coord > v.maxCoord) v.coord = v.minCoord;
                else if (v.dir < 0 && v.coord < v.minCoord) v.coord = v.maxCoord;
                if (v.axis === 'z') {
                  v.group.position.x = v.laneOffset;
                  v.group.position.z = v.coord;
                } else {
                  v.group.position.x = v.coord;
                  v.group.position.z = v.laneOffset;
                }
                const wy = getTerrainHeight3D(town.centerX + v.group.position.x, town.centerZ + v.group.position.z);
                v.group.position.y = wy - town.group.position.y + 0.16;
              }
              // Strolling GBA chibi pixel citizens around the Grand Plaza!
              for (const w of town.animatedParts.walkers) {
                w.angle += w.speed * dt;
                w.phase += dt * 7.5;
                const wxLocal = w.cx + Math.cos(w.angle) * w.radius;
                const wzLocal = w.cz + Math.sin(w.angle) * w.radius;
                const wy = getTerrainHeight3D(town.centerX + wxLocal, town.centerZ + wzLocal) - town.group.position.y + 0.22;
                const hop = Math.abs(Math.sin(w.phase)) * 0.15;
                w.mesh.position.set(wxLocal, wy + hop, wzLocal);
                w.mesh.rotation.set(bbTiltX, camYawNow, 0);
                w.shadow.position.set(wxLocal, wy + 0.04, wzLocal);
              }
            }
            const distToTown = Math.hypot(sim.px - town.centerX, sim.pz - town.centerZ);
            if (distToTown < town.safeRadius) {
              activeTownNow = town;
            }
            if (distToTown < town.safeRadius + 10) {
              // Player wall collision (solid 4-sided walls, enter strictly through the Front Doorway!)
              const pPos = { x: sim.px, z: sim.pz };
              resolveTownWallCollisions(pPos, 0.85, town.colliders);
              sim.px = pPos.x;
              sim.pz = pPos.z;

              // Walkable Building Interiors: Smooth cutaway transparent roof ONLY when player walks inside via the doorway!
              for (const bInt of town.interiors) {
                const inside = isInsideBuildingInterior(sim.px, sim.pz, bInt);
                if (inside) activeInteriorIdNow = bInt.id;
                const targetAlpha = inside ? 0.14 : 1.0;
                if (Math.abs(bInt.cutawayAlpha - targetAlpha) > 0.015) {
                  bInt.cutawayAlpha += (targetAlpha - bInt.cutawayAlpha) * Math.min(1, dt * 10);
                  if (Math.abs(bInt.cutawayAlpha - targetAlpha) <= 0.02) bInt.cutawayAlpha = targetAlpha;
                  setBuildingExteriorOpacity(bInt.exteriorGroup, bInt.cutawayAlpha);
                }
                bInt.interiorGroup.visible = bInt.cutawayAlpha < 0.95;
                if (bInt.interiorGroup.visible) {
                  for (const npc of bInt.npcSprites) {
                    npc.rotation.set(bbTiltX, camYawNow, 0);
                  }
                }
              }

              // Wild Pokémon inside/near town stay completely peaceful & never clip through walls!
              for (const en of sim.enemies) {
                if (en.hp <= 0) continue;
                const ePos = { x: en.x, z: en.z };
                resolveTownWallCollisions(ePos, en.radius + 0.5, town.colliders);
                en.x = ePos.x;
                en.z = ePos.z;
                if (!en.isBoss && Math.hypot(en.x - town.centerX, en.z - town.centerZ) < town.safeRadius + 2) {
                  en.aggroed = false;
                }
              }
              for (const pt of town.interactPoints) {
                const d = Math.hypot(pt.x - sim.px, pt.z - sim.pz);
                if (d < pt.radius && d < closestTownDist) {
                  closestTownDist = d;
                  closestTownPoint = pt;
                }
              }
            }
          }

          const inTownPeaceZone = Boolean(activeTownNow && (prefsRef.current.townPeaceMode ?? true));
          if ((activeTownNow?.id ?? null) !== activeTownIdRef.current) {
            const prevTown = activeTownIdRef.current;
            activeTownIdRef.current = activeTownNow?.id ?? null;
            if (activeTownNow && (prefsRef.current.townPeaceMode ?? true)) {
              showBanner(
                `🏘️ 进入「${activeTownNow.name}」和平区 · 随从已暂收球中，仅领队同行（全员停火）`,
                3000,
              );
            } else if (prevTown && !activeTownNow) {
              showBanner('🌿 已离开城镇 · 全队随从展开出战阵型！', 2200);
            }
          }

          // Tick interactive world nodes (regrow cooldowns & hit-shake timers) + detect closest interactable!
          let closestNode: WorldInteractNode | null = null;
          let closestNodeDist = 4.1;
          for (const node of worldInteractNodes.values()) {
            const st = (node.mesh.userData.shakeTimer as number | undefined) ?? 0;
            if (st > 0) node.mesh.userData.shakeTimer = Math.max(0, st - dt * 2.8);
            if (node.cooldown > 0) {
              node.cooldown = Math.max(0, node.cooldown - dt);
              if (node.cooldown <= 0) {
                node.hp = node.maxHp;
                if (node.kind === 'berry_tree' && node.extraMesh) {
                  node.extraMesh.visible = true;
                } else {
                  node.mesh.visible = true;
                  node.mesh.scale.set(node.baseScaleX, node.baseScaleY, 1);
                }
              }
              continue;
            }
            const nd = Math.hypot(node.x - sim.px, node.z - sim.pz);
            if (nd < closestNodeDist) {
              closestNodeDist = nd;
              closestNode = node;
            }
          }
          triggerInteractRef.current = closestTownPoint
            ? () => {
                const tp = closestTownPoint!;
                if (tp.kind === 'pokemon_center') {
                  sim.hp = sim.maxHp;
                  sim.healCharges = Math.max(sim.healCharges, 4);
                  onHealParty();
                  sound.play('levelup');
                  spawnPixelParticles(sim.px, sim.py + 1.2, sim.pz, vfxAtlas.starGlint, 16, 3.6, 0.85, 5.2, 6.2);
                  showBanner(`🏥 「${tp.townName}」宝可梦中心治疗完毕！全队体力已完全恢复并补满伤药！`, 3200);
                  return;
                }
                if (tp.kind === 'poke_mart') {
                  if (document.pointerLockElement) {
                    try { document.exitPointerLock(); } catch {}
                  }
                  sound.play('confirm');
                  setInRunTownShopOpen(true);
                  return;
                }
                if (tp.kind === 'transit_station') {
                  if (document.pointerLockElement) {
                    try { document.exitPointerLock(); } catch {}
                  }
                  sound.play('confirm');
                  setPhase('world_map');
                  return;
                }
                if (tp.kind === 'hotel_rest') {
                  sim.hp = sim.maxHp;
                  sim.boostTimer = Math.max(sim.boostTimer, 24);
                  onHealParty();
                  sound.play('levelup');
                  showBanner(`🏨 已在「${tp.townName}」驿站酒店休整！全队满血并获 24 秒斗志强化！`, 3200);
                  return;
                }
                if (tp.kind === 'restaurant') {
                  sim.hp = Math.min(sim.maxHp, sim.hp + Math.round(sim.maxHp * 0.45));
                  sim.boostTimer = Math.max(sim.boostTimer, 28);
                  sound.play('happy');
                  showBanner(`🍜 享用了「${tp.townName}」招牌树果料理！全队士气大振（强化 28 秒）！`, 3000);
                  return;
                }
                if (tp.kind === 'npc_chat') {
                  sound.play('cursor');
                  showBanner(tp.dialogText ?? `💬 欢迎来到「${tp.townName}」！`, 4200);
                  return;
                }
              }
            : closestNode
            ? () => {
                const target = closestNode!;
                if (target.cooldown > 0) return;
                if (target.kind === 'signpost') {
                  sound.play('cursor');
                  // Compute live compass direction & distance to nearest Lake!
                  let bestLk = LAKE_BASINS_3D[0];
                  let bestD = 1e9;
                  for (const lk of LAKE_BASINS_3D) {
                    const d = Math.hypot(lk.cx - target.x, lk.cz - target.z);
                    if (d < bestD) { bestD = d; bestLk = lk; }
                  }
                  const dxL = bestLk.cx - target.x;
                  const dzL = bestLk.cz - target.z;
                  const dirTxt = `${dzL < -6 ? '北' : dzL > 6 ? '南' : ''}${dxL > 6 ? '东' : dxL < -6 ? '西' : ''}` || '前方';
                  showBanner(`🪵 路牌指引：向${dirTxt} ${Math.round(bestD)}m 处有清澈湖泊（携带水系可冲浪）；按 TAB 可打开掌机地形地图！`, 3400);
                  return;
                }
                if (target.kind === 'mushroom') {
                  target.cooldown = 38;
                  target.mesh.visible = false;
                  const healAmt = Math.min(Math.round(sim.maxHp - sim.hp), Math.round(sim.maxHp * 0.14));
                  if (healAmt > 0) sim.hp = Math.min(sim.maxHp, sim.hp + healAmt);
                  sim.coins += 22;
                  sim.xp += 20;
                  sound.play('confirm');
                  spawnPixelParticles(target.x, target.y + 0.4, target.z, vfxAtlas.starGlint, 8, 2.4, 0.55, 4.2, 5.0);
                  sim.dmgPops.push({
                    id: sim.nextId++,
                    wx: target.x,
                    wy: target.y + 1.4,
                    wz: target.z,
                    text: healAmt > 0 ? `+22G +${healAmt}HP` : '+22G +20EXP',
                    color: '#ffe066',
                    life: 0.85,
                  });
                  showBanner('🍄 采摘了新鲜野生蘑菇！获得 +22 金币与活力补给！', 2000);
                  return;
                }
                if (target.kind === 'berry_tree') {
                  target.cooldown = 48;
                  target.mesh.userData.shakeTimer = 1.0;
                  if (target.extraMesh) target.extraMesh.visible = false;
                  sim.healCharges = Math.min(9, sim.healCharges + 1);
                  sim.coins += 26;
                  sim.xp += 28;
                  sound.play('happy');
                  spawnPixelParticles(target.x, target.y + 2.1, target.z, vfxAtlas.starGlint, 10, 3.0, 0.72, 4.5, 6.2);
                  sim.dmgPops.push({
                    id: sim.nextId++,
                    wx: target.x,
                    wy: target.y + 2.2,
                    wz: target.z,
                    text: '+1 树果伤药 +26G',
                    color: '#69db7c',
                    life: 0.9,
                  });
                  showBanner('🍎 摇落树上树果！伤药补给 +1，金币 +26！', 2200);
                  return;
                }
                if (target.kind === 'ore_rock') {
                  target.hp -= 1;
                  target.mesh.userData.shakeTimer = 1.0;
                  sound.play('hit');
                  spawnPixelParticles(target.x, target.y + 0.6, target.z, vfxAtlas.starGlint, 7, 2.6, 0.5, 4.8, 6.0);
                  if (target.hp > 0) {
                    const shrink = 0.82 + (target.hp / target.maxHp) * 0.18;
                    target.mesh.scale.set(target.baseScaleX * shrink, target.baseScaleY * shrink, 1);
                    sim.dmgPops.push({
                      id: sim.nextId++,
                      wx: target.x,
                      wy: target.y + 1.3,
                      wz: target.z,
                      text: `敲击矿石 (${target.hp}/${target.maxHp})`,
                      color: '#74c0fc',
                      life: 0.65,
                    });
                  } else {
                    target.cooldown = 65;
                    target.mesh.visible = false;
                    sim.coins += 55;
                    sim.xp += 42;
                    onUpdateMeta?.((prev) => ({ ...prev, stardust: prev.stardust + 10 }));
                    sound.play('levelup');
                    spawnPixelParticles(target.x, target.y + 0.7, target.z, vfxAtlas.starGlint, 14, 3.8, 0.75, 5.8, 7.0);
                    sim.dmgPops.push({
                      id: sim.nextId++,
                      wx: target.x,
                      wy: target.y + 1.6,
                      wz: target.z,
                      text: '+10 星沙 +55G!',
                      color: '#ffe066',
                      life: 0.95,
                    });
                    showBanner('⛏️ 敲碎结晶矿石！收获 星星沙子 +10、金币 +55！', 2400);
                  }
                }
              }
            : null;
          const camFwdX = -Math.sin(camYawNow);
          const camFwdZ = -Math.cos(camYawNow);
          const camRightX = Math.cos(camYawNow);
          const camRightZ = -Math.sin(camYawNow);
          const pFaceX = Math.sin(sim.facingAngle);
          const pFaceZ = Math.cos(sim.facingAngle);
          const pRelFwd = pFaceX * camFwdX + pFaceZ * camFwdZ;
          const pRelRight = pFaceX * camRightX + pFaceZ * camRightZ;
          const dirKey: FacingDir =
            Math.abs(pRelRight) > Math.abs(pRelFwd)
              ? pRelRight >= 0
                ? 'right'
                : 'left'
              : pRelFwd >= 0
                ? 'up'
                : 'down';
          const strideFrame = Math.floor(sim.walkDist * 1.6) % 2;
          const idleFrame = Math.floor(sim.elapsed * 2.2) % 2;
          const isAirborne = sim.py > groundY + 0.22;
          const frameKey = isAirborne
            ? `${dirKey}_jump`
            : mLen > 0.08
              ? `${dirKey}_${strideFrame}`
              : `${dirKey}_idle${idleFrame}`;
          playerSpriteMat.map = heroFrames[frameKey] ?? heroFrames[`${dirKey}_0`] ?? heroFrames.down_idle0;
          const walkBob = mLen > 0.08 && !isAirborne ? Math.abs(Math.sin(sim.walkDist * 2.8)) * 0.16 : 0;
          playerSprite.position.set(sim.px, sim.py + walkBob + 0.02, sim.pz);
          playerSprite.rotation.set(bbTiltX, camYawNow, 0);
          // Lab Passive HP Regen + Hero Exclusive Periodic Signatures (Red Ball Burst / Misty Tide & Heal / Brock Quake!)
          const cb = metaBonusesRef.current;
          if (cb.regenPerSec > 0 && sim.hp > 0 && sim.hp < sim.maxHp) {
            sim.hp = Math.min(sim.maxHp, sim.hp + cb.regenPerSec * dt);
          }
          if (cb.mistyHealLv > 0 && sim.hp > 0 && sim.hp < sim.maxHp && Math.floor(sim.elapsed / 8) > Math.floor((sim.elapsed - dt) / 8)) {
            const healAmt = Math.round(sim.maxHp * (cb.mistyHealLv * 0.03 * (cb.mistyHealLv >= 5 ? 2 : 1)));
            sim.hp = Math.min(sim.maxHp, sim.hp + healAmt);
            spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.healCircleDecal, 3.6, 0.5);
          }
          if (!inTownPeaceZone && cb.mistyTideLv > 0 && Math.floor(sim.elapsed / (cb.mistyTideLv >= 5 ? 4.2 : 6.0)) > Math.floor((sim.elapsed - dt) / (cb.mistyTideLv >= 5 ? 4.2 : 6.0))) {
            const rad = cb.mistyTideLv >= 5 ? 8.2 : 5.2;
            const dmg = Math.round((40 + cb.mistyTideLv * 18) * sim.atkMult);
            spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.waterWaveDecal, rad * 1.4, 0.45);
            sound.play('water');
            for (const en of sim.enemies) {
              if (en.hp > 0 && Math.hypot(en.x - sim.px, en.z - sim.pz) < rad) {
                damageEnemy3D(en, dmg, '#339af0');
              }
            }
          }
          if (!inTownPeaceZone && cb.redBallLv > 0 && sim.enemies.length > 0 && Math.floor(sim.elapsed / 5.0) > Math.floor((sim.elapsed - dt) / 5.0)) {
            const shots = cb.redBallLv >= 5 ? 3 : 1;
            const near = [...sim.enemies].filter((e) => e.hp > 0).sort((a, b) => Math.hypot(a.x - sim.px, a.z - sim.pz) - Math.hypot(b.x - sim.px, b.z - sim.pz));
            for (let si = 0; si < Math.min(shots, near.length); si++) {
              const t = near[si];
              const a = Math.atan2(t.z - sim.pz, t.x - sim.px);
              spawnSkillProjectile3D({
                x: sim.px,
                y: sim.py + 1.15,
                z: sim.pz,
                vx: Math.cos(a) * 18,
                vz: Math.sin(a) * 18,
                dmg: Math.round((48 + cb.redBallLv * 22) * sim.atkMult),
                radius: 0.7,
                pierce: cb.redBallLv >= 5 ? 4 : 2,
                life: 1.5,
                colorHex: 0xe03131,
                scale: 1.55,
                frames: vfxAtlas.fireball,
              });
            }
            sound.play('pokeball');
          }
          playerSprite.visible = !(sim.invuln > 0 && Math.floor(sim.invuln * 16) % 2 === 0);

          const jumpHeight = Math.max(0, sim.py - groundY);
          playerShadow.position.set(sim.px, groundY + 0.05, sim.pz);
          playerShadow.scale.setScalar(Math.max(0.45, 1 - jumpHeight * 0.14));

          updateWorldAround(sim.px, sim.pz);
          syncSafeZones3D(sim.px, sim.pz);

          for (const entry of safeZoneMeshes.values()) {
            const mat = entry.ring.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.65 + Math.sin(sim.elapsed * 4.5) * 0.25;
          }

          // Auto-heal when walking up to Safe Zone Pokémon Center
          if (activeZone && sim.timers.safeHealCd <= 0 && sim.hp < sim.maxHp) {
            if (Math.hypot(sim.px - (activeZone.x - 4), sim.pz - (activeZone.z - 1)) < 3.4) {
              sim.hp = sim.maxHp;
              sim.timers.safeHealCd = 3.5;
              onHealParty();
              sound.play('heal_jingle');
              showBanner('乔伊小姐：叮咚叮咚～主角与全体随从已恢复满血！');
            }
          }

          // 2. Calm, Tactical Region Wild Pokémon Spawns (Tankier HP, Lower Density, Plus Leaping River/Lake Aquatic Spawns!)
          const regionIdx = Math.max(0, MAP_REGIONS.findIndex((r) => r.id === selectedBiome));
          const regionMult = 1 + regionIdx * 0.2;
          sim.timers.spawn -= dt;
          const spawnRate = Math.max(
            1.15,
            (2.15 - sim.elapsed * 0.005) / (difficultyId === 'nightmare' ? 1.25 : difficultyId === 'hard' ? 1.12 : 1),
          );
          const activeWildCount = sim.enemies.filter((e) => !e.knockedOut && !e.isBoss).length;
          if (sim.timers.spawn <= 0 && activeWildCount < 16) {
            sim.timers.spawn = spawnRate;
            const batch = sim.elapsed > 75 ? 2 : 1;
            for (let b = 0; b < batch; b++) {
              const ang = Math.random() * Math.PI * 2;
              const dist = 16 + Math.random() * 8;
              const ex = sim.px + Math.cos(ang) * dist;
              const ez = sim.pz + Math.sin(ang) * dist;
              if (
                nearbyZones.some((z) => Math.hypot(ex - z.x, ez - z.z) < z.radius + 1.5) ||
                isInsideAnyTownPlaza(ex, ez, 4)
              ) {
                continue;
              }
              const gSpawn = getTerrainHeight3D(ex, ez);
              const inWater = gSpawn < WATER_LEVEL_3D - 0.1;
              const waterPool: SpeciesId[] = ['squirtle', 'psyduck'];
              const activeWildPool = liveOverlandCityRef.current?.wildPool ?? regionMeta.wildPool;
              const sp = inWater
                ? waterPool[Math.floor(Math.random() * waterPool.length)]
                : activeWildPool[Math.floor(Math.random() * activeWildPool.length)];
              const hpScale = (1 + sim.elapsed / 32) * regionMult * diffMeta.enemyHpMult;
              spawnEnemy3D(
                ex,
                ez,
                sp,
                Math.round(135 * hpScale),
                2.75 + Math.min(1.4, sim.elapsed * 0.012),
                Math.round((9 + Math.floor(sim.elapsed / 30) * 2) * regionMult * diffMeta.enemyDmgMult),
                { isAquatic: inWater },
              );
            }
          }

          // 2B. Spawn Enemy Trainers (Calmer spacing + 1 elite guard!)
          sim.timers.trainer -= dt;
          if (sim.timers.trainer <= 0) {
            sim.timers.trainer = difficultyId === 'nightmare' ? 32 : 44;
            const tr = ENEMY_TRAINER_ROSTER[sim.trainerWaveIdx % ENEMY_TRAINER_ROSTER.length];
            sim.trainerWaveIdx += 1;
            const ang = Math.random() * Math.PI * 2;
            const tx = sim.px + Math.cos(ang) * 20;
            const tz = sim.pz + Math.sin(ang) * 20;
            if (!nearbyZones.some((z) => Math.hypot(tx - z.x, tz - z.z) < z.radius + 2)) {
              const guardHp = Math.round((190 + sim.elapsed * 2.8) * regionMult * diffMeta.enemyHpMult);
              spawnEnemy3D(
                tx,
                tz,
                tr.guardSpecies,
                Math.round((460 + sim.elapsed * 5.5) * regionMult * diffMeta.enemyHpMult),
                3.2,
                Math.round(13 * regionMult * diffMeta.enemyDmgMult),
                { isTrainer: true, trainerSprite: tr.sprite, trainerName: tr.name },
              );
              spawnEnemy3D(tx + 2.2, tz + 1.4, tr.guardSpecies, guardHp, 3.4, Math.round(10 * diffMeta.enemyDmgMult));
              sound.play('confirm');
              showBanner(`！敌方训练师「${tr.name}」出现在附近原野！`);
            }
          }

          // 2C. Wilderness Zone-Stay Escalating Guardians!
          // Zero guardians in peaceful cities; staying in a wilderness area long enough summons progressively stronger guardians
          // on an escalating interval schedule: 3 min -> 6 min -> 9 min -> 15 min -> 22 min -> 30 min -> 40 min -> 50 min -> 60 min!
          const GUARDIAN_WAIT_SCHEDULE_SEC = [180, 360, 540, 900, 1320, 1800, 2400, 3000, 3600];
          if (inTownPeaceZone) {
            // In peaceful city: cool down wilderness stay timer & reset anchor
            sim.wildStaySec = Math.max(0, sim.wildStaySec - dt * 1.5);
            sim.wildZoneAnchorX = sim.px;
            sim.wildZoneAnchorZ = sim.pz;
          } else {
            const driftFromAnchor = Math.hypot(sim.px - sim.wildZoneAnchorX, sim.pz - sim.wildZoneAnchorZ);
            if (driftFromAnchor > 72) {
              // Moved into a brand-new wilderness area: re-anchor local zone stay!
              sim.wildZoneAnchorX = sim.px;
              sim.wildZoneAnchorZ = sim.pz;
              sim.wildStaySec = Math.max(0, sim.wildStaySec * 0.35);
            } else {
              sim.wildStaySec += dt;
            }
            const nextWaitSec =
              GUARDIAN_WAIT_SCHEDULE_SEC[Math.min(sim.guardianWaveCount, GUARDIAN_WAIT_SCHEDULE_SEC.length - 1)];
            if (sim.wildStaySec >= nextWaitSec) {
              sim.wildStaySec = 0;
              sim.guardianWaveCount += 1;
              const tier = sim.guardianWaveCount;
              const curBiomeNow = getSeamlessBiomeAt3D(sim.px, sim.pz, sim.py, selectedBiome);
              const curBiomeMeta = MAP_REGIONS.find((r) => r.id === curBiomeNow) ?? regionMeta;
              const pool: SpeciesId[] = [...curBiomeMeta.guardians, curBiomeMeta.bossSpecies];
              const bossSp = pool[(tier - 1) % pool.length];
              const tierScale = 1 + (tier - 1) * 0.55;
              sound.playCry(getPokemonCryId(bossSp, 25));
              if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.5);
              const spawnAng = Math.random() * Math.PI * 2;
              const bx = sim.px + Math.cos(spawnAng) * 18;
              const bz = sim.pz + Math.sin(spawnAng) * 18;
              const guardianHp = Math.round(
                (2600 + sim.baseAtk * 16 + sim.followers.length * 420) * tierScale * regionMult * diffMeta.enemyHpMult,
              );
              spawnEnemy3D(
                bx,
                bz,
                bossSp,
                guardianHp,
                Math.min(5.6, 4.2 + tier * 0.14),
                Math.round(24 * (1 + (tier - 1) * 0.3) * regionMult * diffMeta.enemyDmgMult),
                { isBoss: true },
              );
              const trInfo = ENEMY_TRAINER_ROSTER[tier % ENEMY_TRAINER_ROSTER.length];
              if (trInfo) {
                spawnEnemy3D(
                  bx + 2.8,
                  bz + 2.2,
                  bossSp,
                  Math.round((680 + tier * 240) * regionMult * diffMeta.enemyHpMult),
                  4.0,
                  Math.round(18 * regionMult * diffMeta.enemyDmgMult),
                  {
                    isTrainer: true,
                    trainerSprite: trInfo.sprite,
                    trainerName: trInfo.name,
                  },
                );
              }
              const nextMins = Math.round(
                GUARDIAN_WAIT_SCHEDULE_SEC[Math.min(tier, GUARDIAN_WAIT_SCHEDULE_SEC.length - 1)] / 60,
              );
              if (prefsRef.current.bossAlerts) {
                showBanner(
                  `⚠️ 野外深度停留触发 · 第 ${tier} 阶守护者【${SPECIES_CATALOG[bossSp].defaultName}】现身！（击败可收服，下一阶间隔 ${nextMins} 分钟）`,
                  4500,
                );
              }
            }
          }

          // 3. Update Following Pokémon Squad + Active Battle Action Cooldowns & Team Boost!
          sim.actionCds.ball = Math.max(0, sim.actionCds.ball - dt);
          sim.actionCds.heal = Math.max(0, sim.actionCds.heal - dt);
          sim.actionCds.boost = Math.max(0, sim.actionCds.boost - dt);
          sim.actionCds.salvo = Math.max(0, sim.actionCds.salvo - dt);
          if (sim.boostTimer > 0) sim.boostTimer = Math.max(0, sim.boostTimer - dt);
          const tac = tacticsRef.current;
          const cdFactor =
            sim.cdMult *
            (tac.castMode === 'charged' ? 1.3 : 1.0) *
            (sim.boostTimer > 0 ? 0.65 : 1.0);
          let triggerSalvo = false;
          if (tac.castMode === 'salvo') {
            sim.salvoTimer -= dt;
            if (sim.salvoTimer <= 0 && sim.enemies.length > 0) {
              sim.salvoTimer = Math.max(0.95, 1.75 * sim.cdMult);
              triggerSalvo = true;
            }
          }

          const fCount = sim.followers.length;
          for (let i = 0; i < fCount; i++) {
            const f = sim.followers[i];
            f.animTime += dt;
            if (f.castAnim > 0) f.castAnim = Math.max(0, f.castAnim - dt);

            // Peaceful Town Mode: recall extra followers (i > 0) cleanly into Pokéballs, keeping ONLY lead partner!
            if (inTownPeaceZone && i > 0) {
              if (f.sprite) f.sprite.visible = false;
              if (f.shadow) f.shadow.visible = false;
              if (f.leafMeshes) {
                for (const bm of f.leafMeshes) bm.visible = false;
              }
              f.x = sim.px;
              f.z = sim.pz;
              continue;
            }
            if (f.sprite) f.sprite.visible = true;
            if (f.shadow) f.shadow.visible = true;
            if (f.leafMeshes) {
              for (const bm of f.leafMeshes) bm.visible = !inTownPeaceZone;
            }

            const hasCloseSkill = f.skills.some((s) => s === 'razor_leaf' || s === 'water_pulse');

            // Authentic Natural AI + Physical Contact Charge/Tackle Attacks (No nervous pacing around Hero!)
            const isMeleeCharger =
              f.species === 'munchlax' ||
              f.species === 'eevee' ||
              f.species === 'meowth' ||
              f.species === 'squirtle' ||
              f.species === 'bulbasaur' ||
              f.species === 'dratini' ||
              hasCloseSkill;
            f.dashCd = Math.max(0, (f.dashCd ?? 1.5) - dt);
            const leashMax = tac.formation === 'hunt' ? 14.5 : tac.formation === 'vanguard' ? 11.5 : 10.5;
            const engageRadius = tac.formation === 'hunt' ? 16.5 : tac.formation === 'vanguard' ? 13.0 : 12.0;
            const distToRed = Math.hypot(f.x - sim.px, f.z - sim.pz);

            // Pick nearest / priority enemy inside engagement range around Hero (NEVER engages inside peaceful towns!)
            const candidates = inTownPeaceZone ? [] : pickTargetForFollower(f, sim.enemies, tac.targetPriority);
            const engageTarget = inTownPeaceZone
              ? undefined
              : candidates.find((en) => Math.hypot(en.x - sim.px, en.z - sim.pz) < engageRadius);

            // Trigger real physical Contact Charge / Body Slam lunge for melee/bruiser Pokémon!
            if (
              isMeleeCharger &&
              (f.dashTimer ?? 0) <= 0 &&
              (f.dashCd ?? 0) <= 0 &&
              engageTarget &&
              distToRed < leashMax
            ) {
              const dEn = Math.hypot(engageTarget.x - f.x, engageTarget.z - f.z);
              if (dEn > 1.2 && dEn < 9.5) {
                const lungeSpd = f.species === 'munchlax' ? 16.5 : 20.5;
                f.dashVx = ((engageTarget.x - f.x) / dEn) * lungeSpd;
                f.dashVz = ((engageTarget.z - f.z) / dEn) * lungeSpd;
                f.dashTimer = 0.28;
                f.dashCd = f.species === 'munchlax' ? 3.4 : 3.8;
                f.dashHitIds = new Set<number>();
                f.castAnim = 0.26;
                spawnPixelParticles(f.x, f.y + 0.3, f.z, vfxAtlas.koPuff, 4, 3.2, 0.72, 1.8, 6.0);
              }
            }

            if ((f.dashTimer ?? 0) > 0) {
              // Active physical contact tackle/charge straight through enemies!
              f.dashTimer = Math.max(0, (f.dashTimer ?? 0) - dt);
              f.vx = f.dashVx ?? 0;
              f.vz = f.dashVz ?? 0;
              // Water-loving / Flying companions glide over rivers & lakes freely; Land companions DISLIKE water (steer toward dry shore unless actively forced across, and wade slower if in water!)
              const isWaterOrFly =
                SPECIES_CATALOG[f.species].element === 'water' ||
                f.species === 'gastly' ||
                f.species === 'dratini' ||
                (f.species === 'charmander' && f.stage === 'adult');
              const candFx = f.x + f.vx * dt;
              const candFz = f.z + f.vz * dt;
              const candFy = getWalkableSurfaceHeight3D(candFx, candFz);
              const inWaterNow = getWalkableSurfaceHeight3D(f.x, f.z) < WATER_LEVEL_3D - 0.08;
              const candInWater = candFy < WATER_LEVEL_3D - 0.08;
              if (!isWaterOrFly && candInWater && !inWaterNow && distToRed < leashMax * 0.85) {
                // Land Pokémon prefers to stay dry along the bank instead of casually stepping into the lake!
                f.vx *= 0.22;
                f.vz *= 0.22;
              } else {
                const wadeMult = !isWaterOrFly && (inWaterNow || candInWater) ? 0.56 : 1.0;
                f.x += f.vx * dt * wadeMult;
                f.z += f.vz * dt * wadeMult;
              }
              // Keep followers from clipping through town walls & buildings!
              if (activeTownNow) {
                const fPos = { x: f.x, z: f.z };
                resolveTownWallCollisions(fPos, 0.75, activeTownNow.colliders);
                f.x = fPos.x;
                f.z = fPos.z;
              }
              const rawFy = getWalkableSurfaceHeight3D(f.x, f.z);
              f.y =
                rawFy < WATER_LEVEL_3D - 0.05
                  ? isWaterOrFly
                    ? WATER_LEVEL_3D + 0.14
                    : WATER_LEVEL_3D - 0.08
                  : rawFy;
              const contactR = Math.max(1.25, getPokemonWorldScale3D(f.species, f.stage, 1.0) * 0.48);
              for (const en of sim.enemies) {
                if (en.hp > 0 && !f.dashHitIds?.has(en.id) && Math.hypot(en.x - f.x, en.z - f.z) < en.radius + contactR) {
                  f.dashHitIds?.add(en.id);
                  const syn = getElementalSynergyBonus(SPECIES_CATALOG[f.species].element, metaRef.current);
                  const wMod = getWeatherCombatBonus(liveWeatherRef.current.kind, SPECIES_CATALOG[f.species].element);
                  const slamDmg = Math.round(
                    sim.baseAtk * sim.atkMult * syn.atkMult * wMod.atkMult * (f.species === 'munchlax' ? 1.55 : 1.15) * (0.9 + f.level * 0.25),
                  );
                  damageEnemy3D(en, slamDmg, f.species === 'munchlax' ? '#ffd43b' : '#ffa94d', f.id);
                  spawnSpriteBurst(en.x, en.y + 1.0, en.z, vfxAtlas.explosionBurst, f.species === 'munchlax' ? 2.4 : 1.65, 0.26);
                  if (f.species === 'munchlax') {
                    spawnGroundDecalWave(en.x, en.y, en.z, vfxAtlas.fireBlastDecal, 3.2, 0.34);
                    if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.16);
                  }
                  if (!en.isBoss) {
                    const kd = Math.hypot(en.x - f.x, en.z - f.z) || 1;
                    en.x += ((en.x - f.x) / kd) * (f.species === 'munchlax' ? 2.8 : 1.8);
                    en.z += ((en.z - f.z) / kd) * (f.species === 'munchlax' ? 2.8 : 1.8);
                  }
                }
              }
            } else {
              // Natural calm escort formation + purposeful combat positioning (Zero frantic pacing!)
              const slotAng = sim.facingAngle + Math.PI + ((i - (fCount - 1) / 2) * 0.65);
              const escortR = 2.6 + (i % 2) * 1.15;
              let goalX = sim.px + Math.sin(slotAng) * escortR + f.wanderX * 0.35;
              let goalZ = sim.pz + Math.cos(slotAng) * escortR + f.wanderZ * 0.35;
              let maxSpd = 7.4 * sim.speedMult;

              if (distToRed > leashMax) {
                const backAng = Math.atan2(f.z - sim.pz, f.x - sim.px);
                goalX = sim.px + Math.cos(backAng) * 3.4;
                goalZ = sim.pz + Math.sin(backAng) * 3.4;
                maxSpd = 10.8 * sim.speedMult;
              } else if (engageTarget) {
                const idealDist = isMeleeCharger ? 2.2 : tac.formation === 'hunt' ? 5.0 : 6.4;
                const toEnX = engageTarget.x - f.x;
                const toEnZ = engageTarget.z - f.z;
                const dEn = Math.hypot(toEnX, toEnZ) || 1;
                if (dEn > idealDist + 1.4) {
                  // Purposefully advance toward enemy
                  goalX = engageTarget.x - (toEnX / dEn) * idealDist;
                  goalZ = engageTarget.z - (toEnZ / dEn) * idealDist;
                  maxSpd = 8.6 * sim.speedMult;
                } else if (dEn < idealDist - 1.5 && !isMeleeCharger) {
                  // Ranged caster steps back smoothly out of melee reach
                  goalX = f.x - (toEnX / dEn) * 2.2;
                  goalZ = f.z - (toEnZ / dEn) * 2.2;
                  maxSpd = 5.8 * sim.speedMult;
                } else {
                  // Hold steady tactical firing stance facing the enemy (no jittery side-to-side pacing!)
                  goalX = f.x;
                  goalZ = f.z;
                  f.faceX = toEnX / dEn;
                  f.faceZ = toEnZ / dEn;
                  maxSpd = 0;
                }
                const gDx = goalX - sim.px;
                const gDz = goalZ - sim.pz;
                const gDist = Math.hypot(gDx, gDz);
                if (gDist > leashMax - 0.6) {
                  goalX = sim.px + (gDx / gDist) * (leashMax - 0.6);
                  goalZ = sim.pz + (gDz / gDist) * (leashMax - 0.6);
                }
              } else {
                // Out of combat: calmly follow Hero when moving, rest quietly when Hero stops (occasional relaxed 5-8s shift)
                f.wanderTimer -= dt;
                if (f.wanderTimer <= 0) {
                  f.wanderTimer = 4.8 + Math.random() * 3.6;
                  const a = Math.random() * Math.PI * 2;
                  f.wanderX = Math.cos(a) * 1.6;
                  f.wanderZ = Math.sin(a) * 1.6;
                }
                if (mLen < 0.08 && Math.hypot(goalX - f.x, goalZ - f.z) < 2.2) {
                  goalX = f.x;
                  goalZ = f.z;
                }
                maxSpd = 6.2 * sim.speedMult;
              }

              // Gentle separation between companion Pokémon
              let sepX = 0;
              let sepZ = 0;
              for (let j = 0; j < fCount; j++) {
                if (i === j) continue;
                const o = sim.followers[j];
                const sdx = f.x - o.x;
                const sdz = f.z - o.z;
                const sd = Math.hypot(sdx, sdz);
                if (sd > 0.01 && sd < 2.1) {
                  const push = (2.1 - sd) * 1.9;
                  sepX += (sdx / sd) * push;
                  sepZ += (sdz / sd) * push;
                }
              }

              const toGX = goalX - f.x + sepX;
              const toGZ = goalZ - f.z + sepZ;
              const toGDist = Math.hypot(toGX, toGZ);
              const desiredVx = toGDist > 0.55 && maxSpd > 0 ? (toGX / toGDist) * Math.min(maxSpd, toGDist * 3.2) : 0;
              const desiredVz = toGDist > 0.55 && maxSpd > 0 ? (toGZ / toGDist) * Math.min(maxSpd, toGDist * 3.2) : 0;
              f.vx += (desiredVx - f.vx) * Math.min(1, dt * 8.0);
              f.vz += (desiredVz - f.vz) * Math.min(1, dt * 8.0);

              // Water-loving / Flying companions glide over rivers & lakes freely; Land companions DISLIKE water (steer toward dry shore unless actively forced across, and wade slower if in water!)
              const isWaterOrFly =
                SPECIES_CATALOG[f.species].element === 'water' ||
                f.species === 'gastly' ||
                f.species === 'dratini' ||
                (f.species === 'charmander' && f.stage === 'adult');
              const candFx = f.x + f.vx * dt;
              const candFz = f.z + f.vz * dt;
              const candFy = getWalkableSurfaceHeight3D(candFx, candFz);
              const inWaterNow = getWalkableSurfaceHeight3D(f.x, f.z) < WATER_LEVEL_3D - 0.08;
              const candInWater = candFy < WATER_LEVEL_3D - 0.08;
              if (!isWaterOrFly && candInWater && !inWaterNow && distToRed < leashMax * 0.85) {
                // Land Pokémon prefers to stay dry along the bank instead of casually stepping into the lake!
                f.vx *= 0.22;
                f.vz *= 0.22;
              } else {
                const wadeMult = !isWaterOrFly && (inWaterNow || candInWater) ? 0.56 : 1.0;
                f.x += f.vx * dt * wadeMult;
                f.z += f.vz * dt * wadeMult;
              }
              // Keep followers from clipping through town walls & buildings!
              if (activeTownNow) {
                const fPos = { x: f.x, z: f.z };
                resolveTownWallCollisions(fPos, 0.75, activeTownNow.colliders);
                f.x = fPos.x;
                f.z = fPos.z;
              }
              const rawFy = getWalkableSurfaceHeight3D(f.x, f.z);
              f.y =
                rawFy < WATER_LEVEL_3D - 0.05
                  ? isWaterOrFly
                    ? WATER_LEVEL_3D + 0.14
                    : WATER_LEVEL_3D - 0.08
                  : rawFy;
            }

            const spdNow = Math.hypot(f.vx, f.vz);
            if (spdNow > 0.35) {
              f.faceX = f.vx / spdNow;
              f.faceZ = f.vz / spdNow;
            }
            const castJump = f.castAnim > 0 ? Math.sin((f.castAnim / 0.24) * Math.PI) * 0.42 : 0;
            const isFlightForm =
              (f.species === 'charmander' && f.stage === 'adult') ||
              (f.species === 'dratini' && f.stage === 'adult') ||
              f.species === 'gastly' ||
              f.species === 'mew';
            const stepBob = isFlightForm
              ? 0.78 + Math.sin(f.animTime * 4.8) * 0.2
              : spdNow > 0.6
                ? Math.abs(Math.sin(f.animTime * 9)) * 0.14
                : 0;
            if (f.sprite) {
              // Authentic 8-Direction PMD Overworld / Flight Sprite (S/SE/E/NE/N/NW/W/SW — 100% cohesive scale & style across 360°!)
              const fxDir = f.faceX ?? Math.sin(sim.facingAngle);
              const fzDir = f.faceZ ?? Math.cos(sim.facingAngle);
              const fRelFwd = fxDir * camFwdX + fzDir * camFwdZ;
              const fRelRight = fxDir * camRightX + fzDir * camRightZ;
              const stretch = f.castAnim > 0 ? 1.12 : 1.0;
              const fScale = getPokemonWorldScale3D(f.species, f.stage, 1.0);
              const flightBank = isFlightForm ? Math.max(-0.14, Math.min(0.14, -fRelRight * 0.12)) : 0;
              f.sprite.position.set(f.x, f.y + stepBob + castJump + 0.02, f.z);
              f.sprite.rotation.set(bbTiltX, camYawNow, flightBank);
              if (f.pmdSheet?.ready) {
                const dirIdx = pickPmdDirIndex(fRelFwd, fRelRight);
                const animSpeed = spdNow > 1.0 || f.castAnim > 0 ? 1.35 : 0.72;
                (f.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
                  f.pmdSheet,
                  dirIdx,
                  f.animTime * animSpeed,
                );
                f.sprite.scale.set(
                  fScale * stretch,
                  fScale * (f.castAnim > 0 ? 1.1 : 1.0),
                  1,
                );
              } else {
                const useBack = fRelFwd > 0.25 && Boolean(f.backAnimSheet);
                const activeSheet = useBack ? f.backAnimSheet : f.animSheet;
                if (activeSheet) {
                  const animSpeed = spdNow > 1.2 || f.castAnim > 0 ? 1.25 : 0.85;
                  (f.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
                    activeSheet,
                    f.animTime * animSpeed,
                  );
                }
                if (Math.abs(fRelRight) > 0.12) {
                  f.facingLeft = useBack ? fRelRight < 0 : fRelRight > 0;
                }
                f.sprite.scale.set(
                  (f.facingLeft ? -fScale : fScale) * stretch,
                  fScale * (f.castAnim > 0 ? 1.1 : 1.0),
                  1,
                );
              }
            }
            if (f.shadow) f.shadow.position.set(f.x, f.y + 0.06, f.z);

            const hasLeaf = f.skills.includes('razor_leaf');
            if (hasLeaf) {
              const bladeCount = 3 + f.level;
              if (!f.leafMeshes) f.leafMeshes = [];
              while (f.leafMeshes.length < bladeCount) {
                const blade = new THREE.Sprite(
                  new THREE.SpriteMaterial({
                    map: vfxAtlas.razorLeaf[0],
                    transparent: true,
                    depthWrite: false,
                  }),
                );
                blade.scale.set(1.25, 1.25, 1);
                scene.add(blade);
                f.leafMeshes.push(blade);
              }
              f.orbitAngle += dt * (3.8 + f.level * 0.45);
              const orbitR = 3.1 + Math.min(1.8, f.level * 0.35);
              const leafFrame = vfxAtlas.razorLeaf[Math.floor(sim.elapsed * 10) % vfxAtlas.razorLeaf.length];
              for (let b = 0; b < f.leafMeshes.length; b++) {
                const a = f.orbitAngle + (b * Math.PI * 2) / f.leafMeshes.length;
                const bx = f.x + Math.cos(a) * orbitR;
                const bz = f.z + Math.sin(a) * orbitR;
                const blade = f.leafMeshes[b];
                blade.position.set(bx, getTerrainHeight3D(bx, bz) + 0.95, bz);
                (blade.material as THREE.SpriteMaterial).map = leafFrame;
                (blade.material as THREE.SpriteMaterial).rotation = -a;
                for (const en of sim.enemies) {
                  if (en.hp > 0 && en.hitFlash <= 0 && Math.hypot(en.x - bx, en.z - bz) < en.radius + 0.78) {
                    damageEnemy3D(
                      en,
                      Math.round(sim.baseAtk * sim.atkMult * (0.68 + f.level * 0.2)),
                      '#69db7c',
                      f.id,
                    );
                    spawnSpriteBurst(en.x, en.y + 1.0, en.z, vfxAtlas.slashSpark, 1.55, 0.22);
                  }
                }
              }
            }

            const activeSlotCount = Math.min(f.skills.length, getUnlockedSkillSlotCount(f.level));
            if (inTownPeaceZone) {
              // Complete ceasefire inside peaceful towns!
            } else if (tac.castMode === 'salvo') {
              if (triggerSalvo) {
                const fired = new Set<SurvivorSkillId>();
                for (let sIdx = 0; sIdx < activeSlotCount; sIdx++) {
                  const sk = f.skills[sIdx];
                  if (sk && !fired.has(sk)) {
                    fired.add(sk);
                    fireSkill(f, sk, true);
                  }
                }
              }
            } else {
              for (let sIdx = 0; sIdx < activeSlotCount; sIdx++) {
                const sid = f.skills[sIdx];
                f.cds[sIdx] = (f.cds[sIdx] ?? 0.5) - dt;
                if (f.cds[sIdx] <= 0) {
                  const slotPace = 1 + sIdx * 0.14;
                  const wModCd = getWeatherCombatBonus(liveWeatherRef.current.kind, SPECIES_CATALOG[f.species].element).cdMult;
                  f.cds[sIdx] = Math.max(
                    0.42,
                    SURVIVOR_SKILLS[sid].baseCd * cdFactor * wModCd * slotPace * Math.max(0.6, 1 - f.level * 0.05),
                  );
                  fireSkill(f, sid, false);
                }
              }
            }
          }

          // 4. HD-2D Pixel-Art Projectiles (True 3D straight-line air ballistics + ground glow + pixel trails!)
          for (let i = sim.projectiles.length - 1; i >= 0; i--) {
            const p = sim.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.life -= dt;
            p.animTime += dt;
            const gyP = getTerrainHeight3D(p.x, p.z);
            const py = Math.max(p.y, gyP + 0.45);
            p.sprite.position.set(p.x, py, p.z);
            const pCamDist = p.sprite.position.distanceTo(camera.position);
            const baseNear = pCamDist < 3.6 ? Math.max(0, (pCamDist - 1.8) / 1.8) : 1;
            const hidePlayer = !p.fromEnemy && prefsRef.current.hidePlayerAttacks;
            const projAlpha = p.fromEnemy
              ? prefsRef.current.vfxOpacity / 100
              : prefsRef.current.playerAttackOpacity / 100;
            p.sprite.visible = !hidePlayer;
            p.glow.visible = !hidePlayer;
            (p.sprite.material as THREE.SpriteMaterial).opacity = baseNear * projAlpha;
            p.glow.position.set(p.x, gyP + 0.14, p.z);
            if (p.frames.length > 1) {
              const fIdx = Math.floor(p.animTime * 11) % p.frames.length;
              (p.sprite.material as THREE.SpriteMaterial).map = p.frames[fIdx];
            }
            if (p.skillId === 'swift_volley' || p.skillId === 'shadow_star') {
              (p.sprite.material as THREE.SpriteMaterial).rotation += dt * 7;
            }
            // Crisp elemental pixel trail puffs behind flying skills
            if (!p.fromEnemy) {
              p.trailTimer -= dt;
              if (p.trailTimer <= 0) {
                p.trailTimer = p.skillId === 'dragon_pulse' ? 0.045 : 0.065;
                const trailTex =
                  p.skillId === 'fireball'
                    ? vfxAtlas.emberPuff
                    : p.skillId === 'shadow_star'
                      ? vfxAtlas.shadowWisp
                      : p.skillId === 'dragon_pulse'
                        ? vfxAtlas.electricSpark
                        : vfxAtlas.starGlint;
                spawnPixelParticles(p.x, py - 0.55, p.z, trailTex, 1, 0.8, 0.62, 1.0, 2.5);
              }
            }
            const removeProj = () => {
              scene.remove(p.sprite);
              scene.remove(p.glow);
              sim.projectiles.splice(i, 1);
            };
            if (p.life <= 0) {
              removeProj();
              continue;
            }
            if (p.fromEnemy) {
              if (inTownPeaceZone || nearbyZones.some((z) => Math.hypot(p.x - z.x, p.z - z.z) < z.radius)) {
                removeProj();
                continue;
              }
              if (sim.py - groundY < 1.15 && Math.hypot(p.x - sim.px, p.z - sim.pz) < p.radius + 0.65 && sim.invuln <= 0) {
                const takenDmg = Math.max(1, Math.round(p.dmg * (1 - metaBonusesRef.current.dmgReduction)));
                sim.hp = Math.max(0, sim.hp - takenDmg);
                sim.invuln = 0.55;
                sound.play('hit');
                sim.dmgPops.push({ id: sim.nextId++, wx: sim.px, wy: sim.py + 2.3, wz: sim.pz, text: `-${takenDmg}`, color: '#ff6b6b', life: 0.55 });
                removeProj();
                if (sim.hp <= 0) {
                  if (sim.revivesLeft > 0) {
                    sim.revivesLeft -= 1;
                    sim.hp = Math.round(sim.maxHp * 0.65);
                    sim.invuln = 2.6;
                    sound.play('levelup');
                    spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.arcaneRingDecal, 7.0, 0.55);
                    spawnPixelParticles(sim.px, sim.py + 1.0, sim.pz, vfxAtlas.starGlint, 16, 7.5, 0.9, 4.5, 9);
                    for (const e2 of sim.enemies) {
                      const d2 = Math.hypot(e2.x - sim.px, e2.z - sim.pz);
                      if (d2 < 8.0 && d2 > 0.1) {
                        e2.x += ((e2.x - sim.px) / d2) * 5.2;
                        e2.z += ((e2.z - sim.pz) / d2) * 5.2;
                      }
                    }
                    showBanner(`⚡ 气势披带发动！原地复活（剩余 ${sim.revivesLeft} 次）！`, 3400);
                  } else if (gameMode === 'story') {
                    // Open-World Survival Respawn: automatically escort back to Home Spawn with full HP!
                    sim.px = 0;
                    sim.pz = 0;
                    sim.py = getTerrainHeight3D(0, 0);
                    sim.hp = sim.maxHp;
                    sim.invuln = 3.0;
                    onHealParty();
                    sound.play('levelup');
                    try { window.localStorage.setItem('pocket_paw_last_world_pos_v1', JSON.stringify({ x: 0, z: 0 })); } catch {}
                    showBanner('🏥 体力与血量耗尽！已紧急护送回出生点休整，全队恢复满血！', 3800);
                  } else {
                    endedRef.current = true;
                    pausedRef.current = true;
                    setResultSummary(buildResultSummary(false));
                  }
                }
              }
            } else {
              for (const en of sim.enemies) {
                if (en.hp > 0 && Math.hypot(en.x - p.x, en.z - p.z) < en.radius + p.radius) {
                  const skColor = p.skillId ? SURVIVOR_SKILLS[p.skillId].color : '#ffe066';
                  damageEnemy3D(en, p.dmg, skColor, p.ownerId);
                  if (p.skillId === 'fireball') {
                    spawnSpriteBurst(en.x, en.y + 1.1, en.z, vfxAtlas.explosionBurst, 2.3, 0.3, 0.5);
                    spawnGroundDecalWave(en.x, en.y, en.z, vfxAtlas.fireBlastDecal, 2.3, 0.3);
                    spawnGlowFlash(en.x, en.y, en.z, 0xff6b2b, 2.2, 0.24);
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.emberPuff, 5, 4.8, 0.72, 3.6, 10);
                  } else if (p.skillId === 'dragon_pulse') {
                    spawnSpriteBurst(en.x, en.y + 1.2, en.z, vfxAtlas.explosionBurst, 2.9, 0.34, 0.4);
                    spawnGroundDecalWave(en.x, en.y, en.z, vfxAtlas.arcaneRingDecal, 3.1, 0.34);
                    spawnGlowFlash(en.x, en.y, en.z, 0x3bc9db, 3.0, 0.28);
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.electricSpark, 6, 5.4, 0.85, 4.0, 11);
                  } else if (p.skillId === 'shadow_star') {
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.shadowWisp, 4, 4.0, 0.72, 2.8, 7);
                  } else {
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.starGlint, 4, 4.2, 0.68, 3.0, 9);
                  }
                  p.pierce -= 1;
                  if (p.pierce <= 0) {
                    removeProj();
                    break;
                  }
                }
              }
            }
          }

          // 5. Enemies + Knocked-Out Catchables + Quality/Shiny Auras + Real-Time 3D Capture Sequence!
          for (let i = sim.enemies.length - 1; i >= 0; i--) {
            const en = sim.enemies[i];
            if (en.beingCaptured) continue;
            if (en.knockedOut) {
              en.animTime += dt;
              if (!en.isBoss) {
                en.koTimer = (en.koTimer ?? 18) - dt;
                if (en.koTimer <= 0) {
                  if (en.sprite) scene.remove(en.sprite);
                  if (en.shadow) scene.remove(en.shadow);
                  if (en.auraRing) scene.remove(en.auraRing);
                  sim.enemies.splice(i, 1);
                  continue;
                }
              }
              if (en.sprite) {
                en.sprite.position.set(en.x, en.y + 0.12, en.z);
                en.sprite.rotation.set(bbTiltX, camYawNow, Math.PI * 0.44);
                // Blink warning in final 3.5s before uncaptured wild Pokémon slips away!
                en.sprite.visible = en.isBoss || (en.koTimer ?? 10) > 3.5 || Math.floor((en.koTimer ?? 0) * 8) % 2 === 0;
              }
              if (en.auraRing) {
                const pulse = 0.92 + Math.sin(en.animTime * 6) * 0.14;
                en.auraRing.scale.setScalar(pulse);
                en.auraRing.position.set(en.x, en.y + 0.1, en.z);
              }
              en.shinyTimer = (en.shinyTimer ?? 0.5) - dt;
              if (en.shinyTimer <= 0) {
                en.shinyTimer = 0.55;
                spawnPixelParticles(en.x, en.y + 0.5, en.z, vfxAtlas.starGlint, 2, 1.5, 0.65, 2.4, 3.0);
              }
              continue;
            }
            if (en.hp <= 0) {
              if (en.auraRing) scene.remove(en.auraRing);
              sim.enemies.splice(i, 1);
              continue;
            }
            en.animTime += dt;
            if (en.hitFlash > 0) {
              en.hitFlash -= dt;
              if (en.sprite) {
                const baseTint = en.regionalSkin ? getSkinDef(en.regionalSkin).tintHex3D : 0xffffff;
                (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(en.hitFlash > 0 ? 0xff9999 : baseTint);
              }
            }
            const dx = sim.px - en.x;
            const dz = sim.pz - en.z;
            const dist = Math.hypot(dx, dz) || 1;
            // Species Temperament AI: Docile/Territorial wild Pokémon rest or patrol peacefully until approached or provoked!
            const aggroRange =
              en.temperament === 'docile'
                ? 4.8
                : en.temperament === 'territorial'
                  ? 11.5
                  : 26.0;
            if (!en.aggroed && !inTownPeaceZone && dist < aggroRange) {
              en.aggroed = true;
            }
            if (inTownPeaceZone && !en.isBoss) {
              en.aggroed = false;
            }
            if (en.isAquatic) {
              // Amphibious Water Pokémon (Squirtle/Blastoise, Psyduck) thrive BOTH in lakes AND freely walk on dry land!
              const enRawY = getWalkableSurfaceHeight3D(en.x, en.z);
              const currentlyInWater = enRawY < WATER_LEVEL_3D + 0.05;
              if (currentlyInWater) {
                en.waterJumpTimer = (en.waterJumpTimer ?? 2.2) - dt;
                if (en.waterJumpTimer <= 0) {
                  en.waterJumpTimer = 2.6 + Math.random() * 2.2;
                  spawnPixelParticles(en.x, WATER_LEVEL_3D + 0.15, en.z, vfxAtlas.starGlint, 5, 3.6, 0.55, 4.2, 10);
                }
              }
              const swimSpeed = en.aggroed ? en.speed * 0.96 : en.speed * 0.48;
              const targetX = en.aggroed ? sim.px : (en.homeX ?? en.x) + Math.sin(en.animTime * 0.7) * 4.0;
              const targetZ = en.aggroed ? sim.pz : (en.homeZ ?? en.z) + Math.cos(en.animTime * 0.6) * 4.0;
              const sdx = targetX - en.x;
              const sdz = targetZ - en.z;
              const sDist = Math.hypot(sdx, sdz) || 1;
              if (sDist > 0.2) {
                en.x += (sdx / sDist) * swimSpeed * dt;
                en.z += (sdz / sDist) * swimSpeed * dt;
              }
            } else if (en.aggroed) {
              const candX = en.x + (dx / dist) * en.speed * dt;
              const candZ = en.z + (dz / dist) * en.speed * dt;
              const candY = getWalkableSurfaceHeight3D(candX, candZ);
              const isWaterOrFlyEn =
                SPECIES_CATALOG[en.species].element === 'water' ||
                en.species === 'gastly' ||
                en.species === 'dratini' ||
                (en.species === 'charmander' && en.stage === 'adult');
              // Land wild Pokémon dislike wading into water (reluctantly slow down in water & prefer dry banks unless chasing closely!)
              const wadeFactor = !isWaterOrFlyEn && candY < WATER_LEVEL_3D - 0.08 ? 0.45 : 1.0;
              if (isWaterOrFlyEn || en.isBoss || candY >= WATER_LEVEL_3D - 0.08 || dist < 7.5) {
                en.x += (dx / dist) * en.speed * wadeFactor * dt;
                en.z += (dz / dist) * en.speed * wadeFactor * dt;
              }
            } else if (en.temperament === 'territorial') {
              // Calm territorial stroll near home slope (avoids wandering into lakes!)
              const pxT = (en.homeX ?? en.x) + Math.sin(en.animTime * 0.45 + en.id) * 2.6;
              const pzT = (en.homeZ ?? en.z) + Math.cos(en.animTime * 0.4 + en.id) * 2.6;
              const pdx = pxT - en.x;
              const pdz = pzT - en.z;
              const pDist = Math.hypot(pdx, pdz) || 1;
              if (pDist > 0.25) {
                const nX = en.x + (pdx / pDist) * en.speed * 0.35 * dt;
                const nZ = en.z + (pdz / pDist) * en.speed * 0.35 * dt;
                if (getWalkableSurfaceHeight3D(nX, nZ) >= WATER_LEVEL_3D + 0.06) {
                  en.x = nX;
                  en.z = nZ;
                }
              }
            }

            for (const z of nearbyZones) {
              const zd = Math.hypot(en.x - z.x, en.z - z.z);
              const minR = z.radius + en.radius + 0.25;
              if (zd < minR) {
                const a = zd > 0.05 ? Math.atan2(en.z - z.z, en.x - z.x) : Math.random() * Math.PI * 2;
                en.x = z.x + Math.cos(a) * minR;
                en.z = z.z + Math.sin(a) * minR;
              }
            }

            const rawEnY = getWalkableSurfaceHeight3D(en.x, en.z);
            const enInLake = rawEnY < WATER_LEVEL_3D + 0.05;
            const jumpArc =
              en.isAquatic && enInLake && (en.waterJumpTimer ?? 3) > 2.0
                ? Math.sin(((en.waterJumpTimer! - 2.0) / 0.85) * Math.PI) * 2.15
                : 0;
            en.y = en.isAquatic && enInLake ? WATER_LEVEL_3D + 0.08 + Math.max(0, jumpArc) : rawEnY;
            en.hopPhase += dt * 7;
            const hop = Math.abs(Math.sin(en.hopPhase)) * 0.12;
            const sc = en.worldScale;
            if (en.sprite) {
              const edm = prefsRef.current.enemyDisplayMode;
              const showSprite =
                en.isBoss ||
                en.isShiny ||
                en.quality !== 'normal' ||
                edm === 'all' ||
                (edm === 'near' && dist < 24) ||
                (edm === 'very_near' && dist < 14);
              en.sprite.visible = showSprite;
              const eFaceX = dx / dist;
              const eFaceZ = dz / dist;
              const eRelFwd = eFaceX * camFwdX + eFaceZ * camFwdZ;
              const eRelRight = eFaceX * camRightX + eFaceZ * camRightZ;
              en.sprite.position.set(en.x, en.y + hop + 0.02, en.z);
              en.sprite.rotation.set(bbTiltX, camYawNow, 0);
              if (!en.isTrainer && en.pmdSheet?.ready) {
                if (showSprite) {
                  const dirIdx = pickPmdDirIndex(eRelFwd, eRelRight);
                  (en.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
                    en.pmdSheet,
                    dirIdx,
                    en.animTime * 1.15,
                  );
                }
                en.sprite.scale.set(sc, sc, 1);
              } else {
                const useBack = !en.isTrainer && eRelFwd > 0.28 && Boolean(en.backAnimSheet);
                const activeSheet = useBack ? en.backAnimSheet : en.animSheet;
                if (showSprite && activeSheet) {
                  (en.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
                    activeSheet,
                    en.animTime * 1.15,
                  );
                }
                if (!en.isTrainer) {
                  const flipX = useBack ? eRelRight < 0 : eRelRight > 0;
                  en.sprite.scale.set(flipX ? -sc : sc, sc, 1);
                }
              }
            }
            if (en.shadow) en.shadow.position.set(en.x, en.y + 0.06, en.z);
            if (en.auraRing) {
              const pulse = 0.94 + Math.sin(en.animTime * (en.isShiny ? 7 : 4)) * 0.1;
              en.auraRing.scale.setScalar(pulse);
              en.auraRing.position.set(en.x, en.y + 0.09, en.z);
            }
            if (en.isShiny) {
              en.shinyTimer = (en.shinyTimer ?? 0.35) - dt;
              if (en.shinyTimer <= 0) {
                en.shinyTimer = 0.42;
                spawnPixelParticles(en.x, en.y + sc * 0.4, en.z, vfxAtlas.starGlint, 2, 2.2, 0.72, 2.8, 3.5);
              }
            }

            // Boss Phase 2 Enrage Trigger (HP <= 50%)!
            if (en.isBoss && !en.bossPhase2 && en.hp <= en.maxHp * 0.5) {
              en.bossPhase2 = true;
              en.speed *= 1.24;
              sound.playCry(getPokemonCryId(en.species, 25));
              if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.48);
              if (prefsRef.current.bossAlerts) {
                showBanner('！守护者进入狂暴二阶段！全向螺旋弹幕开启！', 3200);
              }
              // Call 2 wild reinforcements once
              for (let ri = 0; ri < 2; ri++) {
                const ra = ri * Math.PI + Math.random();
                const sp = regionMeta.wildPool[Math.floor(Math.random() * regionMeta.wildPool.length)];
                spawnEnemy3D(
                  en.x + Math.cos(ra) * 3.5,
                  en.z + Math.sin(ra) * 3.5,
                  sp,
                  Math.round(80 * diffMeta.enemyHpMult),
                  4.5,
                  Math.round(14 * diffMeta.enemyDmgMult),
                );
              }
            }

            if ((en.isTrainer || en.isBoss) && !activeZone && !inTownPeaceZone) {
              en.shootCd -= dt;
              if (en.shootCd <= 0 && dist < 22) {
                const baseAng = Math.atan2(sim.pz - en.z, sim.px - en.x);
                en.attackCount = (en.attackCount ?? 0) + 1;
                if (en.isBoss) {
                  const p2 = Boolean(en.bossPhase2);
                  en.shootCd = p2 ? 1.28 : 1.75;
                  if (en.attackCount % 2 === 1) {
                    // Pattern A: Aimed Multi-Orb Fan Spread (5 orbs P1 / 7 orbs P2)
                    const count = p2 ? 7 : 5;
                    const spread = p2 ? 0.2 : 0.22;
                    for (let k = 0; k < count; k++) {
                      const a = baseAng + (k - (count - 1) / 2) * spread;
                      spawnSkillProjectile3D({
                        x: en.x,
                        y: en.y + 1.15,
                        z: en.z,
                        vx: Math.cos(a) * (p2 ? 11.4 : 10.0),
                        vz: Math.sin(a) * (p2 ? 11.4 : 10.0),
                        dmg: en.dmg,
                        radius: 0.5,
                        pierce: 1,
                        life: 2.5,
                        colorHex: p2 ? 0xae3ec9 : 0xe03131,
                        scale: p2 ? 1.5 : 1.38,
                        frames: vfxAtlas.enemyOrb,
                        fromEnemy: true,
                      });
                    }
                  } else {
                    // Pattern B: 360° Ring Nova (10 orbs P1 / 14 spiral orbs P2)
                    const count = p2 ? 14 : 10;
                    const offset = (en.attackCount * 0.35) % (Math.PI * 2);
                    for (let k = 0; k < count; k++) {
                      const a = offset + (k * Math.PI * 2) / count;
                      spawnSkillProjectile3D({
                        x: en.x,
                        y: en.y + 1.15,
                        z: en.z,
                        vx: Math.cos(a) * (p2 ? 9.6 : 8.4),
                        vz: Math.sin(a) * (p2 ? 9.6 : 8.4),
                        dmg: Math.round(en.dmg * 0.9),
                        radius: 0.48,
                        pierce: 1,
                        life: 2.6,
                        colorHex: 0xf76707,
                        scale: 1.36,
                        frames: vfxAtlas.enemyOrb,
                        fromEnemy: true,
                      });
                    }
                  }
                } else {
                  // Enemy Trainer: 3-orb tactical spread volley
                  en.shootCd = 2.25;
                  for (let k = -1; k <= 1; k++) {
                    const a = baseAng + k * 0.24;
                    spawnSkillProjectile3D({
                      x: en.x,
                      y: en.y + 1.05,
                      z: en.z,
                      vx: Math.cos(a) * 9.8,
                      vz: Math.sin(a) * 9.8,
                      dmg: en.dmg,
                      radius: 0.46,
                      pierce: 1,
                      life: 2.2,
                      colorHex: 0xe03131,
                      scale: 1.3,
                      frames: vfxAtlas.enemyOrb,
                      fromEnemy: true,
                    });
                  }
                }
              }
            }

            if (!activeZone && !inTownPeaceZone && dist < en.radius + 0.65 && sim.py - groundY < 1.15 && sim.invuln <= 0) {
              const takenDmg = Math.max(1, Math.round(en.dmg * (1 - metaBonusesRef.current.dmgReduction)));
              sim.hp = Math.max(0, sim.hp - takenDmg);
              sim.invuln = 0.55;
              if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.32);
              sound.play('hit');
              if (prefsRef.current.showDamageNumbers) {
                sim.dmgPops.push({ id: sim.nextId++, wx: sim.px, wy: sim.py + 2.3, wz: sim.pz, text: `-${takenDmg}`, color: '#ff6b6b', life: 0.55 });
              }
              if (sim.hp <= 0) {
                if (sim.revivesLeft > 0) {
                  sim.revivesLeft -= 1;
                  sim.hp = Math.round(sim.maxHp * 0.65);
                  sim.invuln = 2.6;
                  sound.play('levelup');
                  spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.arcaneRingDecal, 7.0, 0.55);
                  spawnPixelParticles(sim.px, sim.py + 1.0, sim.pz, vfxAtlas.starGlint, 16, 7.5, 0.9, 4.5, 9);
                  for (const e2 of sim.enemies) {
                    const d2 = Math.hypot(e2.x - sim.px, e2.z - sim.pz);
                    if (d2 < 8.0 && d2 > 0.1) {
                      e2.x += ((e2.x - sim.px) / d2) * 5.2;
                      e2.z += ((e2.z - sim.pz) / d2) * 5.2;
                    }
                  }
                  showBanner(`⚡ 气势披带发动！原地复活（剩余 ${sim.revivesLeft} 次）！`, 3400);
                } else if (gameMode === 'story') {
                  sim.px = 0;
                  sim.pz = 0;
                  sim.py = getTerrainHeight3D(0, 0);
                  sim.hp = sim.maxHp;
                  sim.invuln = 3.0;
                  onHealParty();
                  sound.play('levelup');
                  try { window.localStorage.setItem('pocket_paw_last_world_pos_v1', JSON.stringify({ x: 0, z: 0 })); } catch {}
                  showBanner('🏥 体力与血量耗尽！已紧急护送回出生点休整，全队恢复满血！', 3800);
                  break;
                } else {
                  endedRef.current = true;
                  pausedRef.current = true;
                  setResultSummary(buildResultSummary(false));
                  break;
                }
              }
            }
          }

          // 5B. Real-Time 3D Cinematic Poké Ball Capture Animation (Arc -> Crimson Absorb -> 3 Wobbles -> Golden Starburst!)
          for (let ci = sim.activeCaptures.length - 1; ci >= 0; ci--) {
            const cap = sim.activeCaptures[ci];
            cap.t += dt;
            const en = cap.enemy;
            const gyT = getTerrainHeight3D(cap.targetX, cap.targetZ);
            if (cap.t < 0.46) {
              // Phase 1: High spinning 3D parabolic throw arc
              const u = cap.t / 0.46;
              const bx = cap.startX + (cap.targetX - cap.startX) * u;
              const bz = cap.startZ + (cap.targetZ - cap.startZ) * u;
              const by = cap.startY + (cap.targetY - cap.startY) * u + Math.sin(u * Math.PI) * 3.8;
              cap.ballSprite.position.set(bx, by, bz);
              (cap.ballSprite.material as THREE.SpriteMaterial).rotation -= dt * 16;
              cap.ballShadow.position.set(bx, getTerrainHeight3D(bx, bz) + 0.06, bz);
              if (Math.random() < 0.45) {
                spawnPixelParticles(bx, by - 0.3, bz, vfxAtlas.starGlint, 1, 0.9, 0.55, 0.8, 2.5);
              }
            } else if (cap.t < 0.92) {
              // Phase 2: Crimson digitizing laser absorb flash!
              const u = (cap.t - 0.46) / 0.46;
              if (!cap.absorbed) {
                cap.absorbed = true;
                sound.play('pokeball');
                setCaptureCutscene((prev) => (prev ? { ...prev, phase: 'absorb' } : null));
                spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff3b3b, Math.max(3.2, en.worldScale * 1.15), 0.48);
                spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.fireBlastDecal, Math.max(2.8, en.worldScale), 0.42);
                spawnPixelParticles(cap.targetX, gyT + 0.8, cap.targetZ, vfxAtlas.starGlint, 8, 4.8, 0.85, 4.0, 5.5);
              }
              const hoverY = gyT + 1.9 + Math.sin(u * Math.PI) * 0.65;
              cap.ballSprite.position.set(cap.targetX, hoverY, cap.targetZ);
              (cap.ballSprite.material as THREE.SpriteMaterial).rotation = Math.sin(u * Math.PI * 3) * 0.25;
              cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
              if (en.sprite) {
                const shrink = Math.max(0.05, 1 - u);
                en.sprite.scale.set(en.worldScale * shrink, en.worldScale * shrink, 1);
                en.sprite.position.set(cap.targetX, gyT + u * 1.75, cap.targetZ);
                (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(0xff5252);
              }
            } else if (cap.t < 2.25) {
              // Phase 3: Ball bounces onto grass & performs 3 suspenseful wobbles!
              if (en.sprite) en.sprite.visible = false;
              if (en.shadow) en.shadow.visible = false;
              const u = cap.t - 0.92; // 0..1.33s
              const dropBounce = u < 0.22 ? Math.abs(Math.sin((u / 0.22) * Math.PI)) * 0.75 : 0;
              const wobbleIdx = Math.floor((u - 0.22) / 0.36);
              if (u >= 0.22 && wobbleIdx >= 0 && wobbleIdx < 3 && wobbleIdx >= cap.wobbleClicks) {
                cap.wobbleClicks = wobbleIdx + 1;
                sound.play('pokeball');
                setCaptureCutscene((prev) =>
                  prev ? { ...prev, phase: 'wobble', wobbleCount: wobbleIdx + 1 } : null,
                );
                spawnPixelParticles(cap.targetX, gyT + 0.6, cap.targetZ, vfxAtlas.electricSpark, 3, 2.2, 0.55, 2.4, 7.0);
              }
              const wobbleAngle =
                u >= 0.22 && u < 1.28
                  ? Math.sin(((u - 0.22) % 0.36) / 0.36 * Math.PI * 2) * 0.55 * (wobbleIdx % 2 === 0 ? 1 : -1)
                  : 0;
              cap.ballSprite.position.set(cap.targetX, gyT + 0.56 + dropBounce, cap.targetZ);
              (cap.ballSprite.material as THREE.SpriteMaterial).rotation = wobbleAngle;
              cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
            } else {
              // Phase 4: Resolution — CLICK! Golden Starburst Catch OR Break-Free!
              if (!cap.resolved) {
                cap.resolved = true;
                (cap.ballSprite.material as THREE.SpriteMaterial).rotation = 0;
                if (cap.willCatch) {
                  setCaptureCutscene((prev) => (prev ? { ...prev, phase: 'caught' } : null));
                  sound.play('hatch');
                  window.setTimeout(() => sound.play('levelup'), 220);
                  spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.healCircleDecal, 4.6, 0.62);
                  spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xffe066, 4.4, 0.55);
                  spawnPixelParticles(cap.targetX, gyT + 0.9, cap.targetZ, vfxAtlas.starGlint, 16, 6.2, 1.05, 5.8, 5.5);
                  const catchLv = en.isBoss
                    ? Math.min(32, pet.level + 4)
                    : Math.min(28, Math.max(4, pet.level + (en.quality === 'epic' ? 2 : en.isShiny ? 2 : 0)));
                  const spName = SPECIES_CATALOG[en.species].stageNames[en.stage] ?? SPECIES_CATALOG[en.species].defaultName;
                  const rSkinLabel = en.regionalSkin ? `🏮[${getSkinDef(en.regionalSkin).name}] ` : '';
                  const tagTxt = en.isShiny ? '★异色 ' : rSkinLabel || (MONSTER_QUALITY_META[en.quality].label ? `[${MONSTER_QUALITY_META[en.quality].label}] ` : '');
                  const caughtSkin: PetSkinId | undefined = en.isShiny ? 'shiny' : en.regionalSkin;
                  onCaptureBoss?.(en.species, catchLv, caughtSkin);
                  if (sim.followers.length < maxFollowersRef.current) {
                    addFollowerToRun(en.species, `${en.isShiny ? '★' : ''}${spName}`, en.stage, undefined, caughtSkin);
                  }
                  if (en.isBoss) {
                    sim.capturedBoss = { species: en.species, name: spName, level: catchLv };
                  }
                  showBanner(`叮咚！成功收服了 ${tagTxt}${spName} (Lv.${catchLv})！已加入精灵球盒！`, 3800);
                  if (en.sprite) scene.remove(en.sprite);
                  if (en.shadow) scene.remove(en.shadow);
                  if (en.auraRing) scene.remove(en.auraRing);
                  const eIdx = sim.enemies.indexOf(en);
                  if (eIdx !== -1) sim.enemies.splice(eIdx, 1);
                } else {
                  setCaptureCutscene((prev) => (prev ? { ...prev, phase: 'escaped' } : null));
                  // Live wild Pokémon broke free — pops back out with burst & chunk of damage!
                  sound.play('hit');
                  spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff6b6b, 3.0, 0.35);
                  en.beingCaptured = false;
                  if (en.sprite) {
                    en.sprite.visible = true;
                    en.sprite.scale.set(en.worldScale, en.worldScale, 1);
                    const baseTint = en.regionalSkin ? getSkinDef(en.regionalSkin).tintHex3D : 0xffffff;
                    (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(baseTint);
                  }
                  if (en.shadow) en.shadow.visible = true;
                  damageEnemy3D(en, Math.round(en.maxHp * 0.28), '#ff922b');
                  showBanner('哎呀！野生宝可梦挣脱了精灵球！先削弱它再投球吧！', 2200);
                }
              }
              if (cap.t >= 3.25) {
                scene.remove(cap.ballSprite, cap.ballShadow);
                sim.activeCaptures.splice(ci, 1);
                setCaptureCutscene(null);
                if (cap.willCatch && en.isBoss && gameMode === 'story' && !endedRef.current) {
                  sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
                  endedRef.current = true;
                  pausedRef.current = true;
                  setResultSummary(buildResultSummary(true, sim.capturedBoss));
                }
              }
            }
          }

          // 6. Magnetic Loot
          for (let i = sim.loots.length - 1; i >= 0; i--) {
            const g = sim.loots[i];
            g.phase += dt * 4;
            const dx = sim.px - g.x;
            const dz = sim.pz - g.z;
            const dist = Math.hypot(dx, dz) || 1;
            if (dist < sim.pickupRadius) {
              g.x += (dx / dist) * 16 * dt;
              g.z += (dz / dist) * 16 * dt;
            }
            g.mesh.position.set(g.x, getTerrainHeight3D(g.x, g.z) + 0.48 + Math.sin(g.phase) * 0.14, g.z);
            g.mesh.rotation.y += dt * 3.5;

            if (dist < 1.1) {
              if (g.kind === 'xp') {
                sim.xp += g.value;
                if (sim.xp >= sim.xpNeed) {
                  sim.xp -= sim.xpNeed;
                  sim.runLevel += 1;
                  sim.xpNeed = Math.round(sim.xpNeed * 1.36 + 8);
                  pausedRef.current = true;
                  sound.play('levelup');
                  setLevelChoices(buildLevelChoices());
                }
              } else if (g.kind === 'coin') {
                sim.coins += g.value;
                sound.play('coin');
              } else if (g.kind === 'berry') {
                sim.hp = Math.min(sim.maxHp, sim.hp + g.value);
                sound.play('eat');
              } else if (g.kind === 'magnet') {
                for (const o of sim.loots) {
                  if (o.kind === 'xp' || o.kind === 'coin') {
                    o.x = sim.px + (Math.random() - 0.5) * 1.2;
                    o.z = sim.pz + (Math.random() - 0.5) * 1.2;
                  }
                }
                sound.play('happy');
              }
              scene.remove(g.mesh);
              sim.loots.splice(i, 1);
            }
          }

          // 7. HD-2D Pixel-Art 3D VFX Loop (Animated pixel sprites, painted ground waves & additive glows!)
          for (let i = sim.vfxs.length - 1; i >= 0; i--) {
            const v = sim.vfxs[i];
            v.life -= dt;
            if (v.life <= 0) {
              scene.remove(v.mesh);
              sim.vfxs.splice(i, 1);
            } else {
              const ratio = Math.max(0, v.life / v.maxLife);
              const prog = 1 - ratio;
              if (v.kind === 'decal_wave') {
                const eased = 1 - Math.pow(1 - prog, 2.2);
                const s = Math.max(0.3, eased * (v.maxRadius ?? 5));
                v.mesh.scale.set(s, s, 1);
                const m = (v.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
                m.opacity = ratio * 0.92;
              } else if (v.kind === 'glow_flash') {
                const s = (0.55 + prog * 0.7) * (v.maxRadius ?? 2.4);
                v.mesh.scale.set(s, s, 1);
                const m = (v.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
                m.opacity = ratio * 0.78;
              } else if (v.kind === 'lightning') {
                const sp = v.mesh as THREE.Sprite;
                if (v.frames && v.frames.length > 0) {
                  const fIdx = Math.min(v.frames.length - 1, Math.floor(prog * v.frames.length * 2) % v.frames.length);
                  (sp.material as THREE.SpriteMaterial).map = v.frames[fIdx];
                }
                (sp.material as THREE.SpriteMaterial).opacity = ratio > 0.25 ? 1 : ratio * 4;
              } else if (v.kind === 'sprite_burst') {
                const sp = v.mesh as THREE.Sprite;
                if (v.vy) sp.position.y += v.vy * dt;
                if (v.frames && v.frames.length > 0) {
                  const fIdx = Math.min(v.frames.length - 1, Math.floor(prog * v.frames.length));
                  (sp.material as THREE.SpriteMaterial).map = v.frames[fIdx];
                }
                const s = (v.baseScale ?? 1.8) * (0.85 + prog * 0.4);
                sp.scale.set(s, s, 1);
                (sp.material as THREE.SpriteMaterial).opacity = ratio > 0.2 ? 1 : ratio * 5;
              } else if (v.kind === 'particle') {
                const sp = v.mesh as THREE.Sprite;
                sp.position.x += (v.vx ?? 0) * dt;
                sp.position.y += (v.vy ?? 0) * dt;
                sp.position.z += (v.vz ?? 0) * dt;
                v.vy = (v.vy ?? 0) - (v.gravity ?? 10) * dt;
                const s = (v.baseScale ?? 0.7) * Math.max(0.25, ratio);
                sp.scale.set(s, s, 1);
                const camDist = sp.position.distanceTo(camera.position);
                const nearFade = camDist < 6 ? Math.max(0, (camDist - 3.5) / 2.5) : 1;
                const vfxAlpha = prefsRef.current.vfxOpacity / 100;
                (sp.material as THREE.SpriteMaterial).opacity = Math.min(1, ratio * 1.4) * nearFade * vfxAlpha;
              }
            }
          }

          for (let i = sim.dmgPops.length - 1; i >= 0; i--) {
            sim.dmgPops[i].life -= dt;
            sim.dmgPops[i].wy += dt * 1.6;
            if (sim.dmgPops[i].life <= 0) sim.dmgPops.splice(i, 1);
          }

          // Standard PC 3D Wide-Angle Perspective Camera (Strong 近大远小 depth + 1:1 Orbit + Solid Wall Spring-Arm Occlusion!)
          camPivotRef.current.lerp(
            new THREE.Vector3(sim.px, sim.py + 1.55, sim.pz),
            Math.min(1, dt * 14),
          );
          camSmoothZoomRef.current +=
            (camOrbitRef.current.zoom - camSmoothZoomRef.current) * Math.min(1, dt * 12);
          const interiorZoomFactor = activeInteriorIdNow ? 0.72 : 1.0;
          const baseDist = (camPresetRef.current === 'close' ? 7.8 : 10.4) * camSmoothZoomRef.current * interiorZoomFactor;
          const yaw = camOrbitRef.current.yaw;
          const pitch = camOrbitRef.current.pitch;
          const horiz = Math.cos(pitch) * baseDist;
          const rawCamX = camPivotRef.current.x + Math.sin(yaw) * horiz;
          const rawCamZ = camPivotRef.current.z + Math.cos(yaw) * horiz;
          const rawCamY = camPivotRef.current.y + Math.sin(pitch) * baseDist;

          // Spring-Arm Wall Occlusion: if a solid town wall sits between player and camera, pull camera lens inward cleanly!
          const wallClipT = activeTownNow
            ? computeCameraWallClipT(
                camPivotRef.current.x,
                camPivotRef.current.y,
                camPivotRef.current.z,
                rawCamX,
                rawCamY,
                rawCamZ,
                activeTownNow.group.position.y,
                activeTownNow.colliders,
                activeInteriorIdNow,
              )
            : 1.0;
          const camX = camPivotRef.current.x + (rawCamX - camPivotRef.current.x) * wallClipT;
          const camZ = camPivotRef.current.z + (rawCamZ - camPivotRef.current.z) * wallClipT;
          const desiredCamY = camPivotRef.current.y + (rawCamY - camPivotRef.current.y) * wallClipT;
          const groundUnderCam = getWalkableSurfaceHeight3D(camX, camZ);
          const shakeAmp =
            prefsRef.current.screenShake && shakeRef.current > 0
              ? shakeRef.current * (prefsRef.current.shakeIntensity / 100) * 0.55
              : 0;
          const sxOff = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp : 0;
          const syOff = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp : 0;
          camera.position.set(camX + sxOff, Math.max(desiredCamY, groundUnderCam + 1.25) + syOff, camZ);
          camera.lookAt(camPivotRef.current.x, camPivotRef.current.y + 0.95, camPivotRef.current.z);
          horizonBackdrop.position.set(camPivotRef.current.x, 0, camPivotRef.current.z);
          if (horizonBackdrop.userData?.skyUniforms?.uTime) {
            horizonBackdrop.userData.skyUniforms.uTime.value = now * 0.001;
          }

          // Smooth Minecraft-style live biome atmosphere transition (fog color + exploration toast!)
          const curBiomeAtPlayer = getSeamlessBiomeAt3D(sim.px, sim.pz, sim.py, selectedBiome);
          const targetFogCol = new THREE.Color(BIOME_PALETTES[curBiomeAtPlayer].fogHex);
          if (scene.fog instanceof THREE.Fog) {
            scene.fog.color.lerp(targetFogCol, Math.min(1, dt * 1.4));
          }
          if (terrainMat.uniforms?.uFogColor?.value) {
            (terrainMat.uniforms.uFogColor.value as THREE.Color).lerp(targetFogCol, Math.min(1, dt * 1.4));
          }
          if (sim.lastSeamlessBiome !== curBiomeAtPlayer) {
            const prevBiome = sim.lastSeamlessBiome;
            sim.lastSeamlessBiome = curBiomeAtPlayer;
            if (prevBiome && phase === 'playing') {
              const biomeAnnounce: Record<BiomeId, string> = {
                verdant_forest: '🌲 踏入「青翠森林 · 阳光原野」地带',
                rocky_desert: '🏜️ 踏入「岩石沙漠 · 金沙峡谷」地带',
                storm_coast: '🌴 踏入「风暴海岸 · 椰林海湾」地带',
                sky_glacier: '🏔️ 踏入「天空冰川 · 雪山之巅」地带',
                cinnabar_isle: '🌋 踏入「红莲火山 · 熔岩裂谷」地带',
              };
              showBanner(biomeAnnounce[curBiomeAtPlayer], 2800);
            }
          }

          sim.timers.hudSync -= dt;
          if (sim.timers.hudSync <= 0) {
            sim.timers.hudSync = 0.085;
            const zAng = Math.atan2(nearestZone.z - sim.pz, nearestZone.x - sim.px);
            const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
            const aIdx = Math.round((((zAng / (Math.PI * 2)) + 1) % 1) * 8) % 8;
            const activeBoss = sim.enemies.find((e) => e.isBoss && e.hp > 0);
            const squadHpRatio = Math.max(0, Math.min(1, sim.hp / Math.max(1, sim.maxHp)));
            const followerVitals: Record<string, { hp: number; maxHp: number; mp: number; maxMp: number }> = {};
            for (const f of sim.followers) {
              const fMaxHp = Math.round(95 + f.level * 28);
              const fHp = Math.max(1, Math.round(fMaxHp * squadHpRatio));
              const skMeta = SURVIVOR_SKILLS[f.skills[0]];
              const maxCd = Math.max(0.25, (skMeta?.baseCd ?? 1.4) * sim.cdMult);
              const mpRatio = Math.max(0, Math.min(1, 1 - Math.max(0, f.cds[0] ?? 0) / maxCd));
              const fMaxMp = 100;
              followerVitals[f.id] = {
                hp: fHp,
                maxHp: fMaxHp,
                mp: Math.round(mpRatio * fMaxMp),
                maxMp: fMaxMp,
              };
            }

            setHud({
              hp: Math.ceil(sim.hp),
              maxHp: sim.maxHp,
              xp: sim.xp,
              xpNeed: sim.xpNeed,
              runLevel: sim.runLevel,
              kills: sim.kills,
              coins: sim.coins,
              totalDamage: sim.totalDamage,
              elapsedSec: Math.floor(sim.elapsed),
              inSafeZone: Boolean(activeZone),
              safeDirArrow: arrows[aIdx],
              safeDistM: Math.max(0, Math.round((nearestDist - SAFE_ZONE_3D_RADIUS) * 2.5)),
              bossAliveName: activeBoss
                ? gameMode === 'story'
                  ? regionMeta.bossName
                  : `守护者 ${SPECIES_CATALOG[activeBoss.species].defaultName}`
                : '',
              bossHpPct: activeBoss ? Math.max(0, Math.round((activeBoss.hp / activeBoss.maxHp) * 100)) : 0,
              bossHp: activeBoss ? Math.max(0, Math.ceil(activeBoss.hp)) : 0,
              bossMaxHp: activeBoss ? Math.ceil(activeBoss.maxHp) : 0,
              fps: Math.max(1, Math.round(fpsSmooth)),
              combo: comboRef.current.count,
              followerVitals,
              actionCds: {
                ball: Number(sim.actionCds.ball.toFixed(1)),
                heal: Number(sim.actionCds.heal.toFixed(1)),
                boost: Number(sim.actionCds.boost.toFixed(1)),
                salvo: Number(sim.actionCds.salvo.toFixed(1)),
              },
              healCharges: sim.healCharges,
              boostLeft: Number(sim.boostTimer.toFixed(1)),
            });

            // Detect nearest knocked-out catchable Pokémon within proximity range (5.8m)
            const nearKo = sim.enemies
              .filter((e) => e.knockedOut && !e.beingCaptured && Math.hypot(e.x - sim.px, e.z - sim.pz) < 5.8)
              .sort((a, b) => Math.hypot(a.x - sim.px, a.z - sim.pz) - Math.hypot(b.x - sim.px, b.z - sim.pz))[0];
            if (nearKo) {
              const phys = getPokemonPhysicalMetrics(nearKo.species, nearKo.stage);
              const spMeta = SPECIES_CATALOG[nearKo.species];
              const lv = nearKo.isBoss
                ? Math.min(32, pet.level + 4)
                : Math.min(28, Math.max(4, pet.level + (nearKo.quality === 'epic' ? 2 : nearKo.isShiny ? 2 : 0)));
              nearbyKoIdRef.current = nearKo.id;
              setNearbyKoTarget({
                enemyId: nearKo.id,
                species: nearKo.species,
                name: spMeta.stageNames[nearKo.stage] ?? spMeta.defaultName,
                stage: nearKo.stage,
                level: lv,
                isBoss: nearKo.isBoss,
                isShiny: nearKo.isShiny,
                quality: nearKo.quality,
                heightM: phys.heightM,
                weightKg: phys.weightKg,
                sprite: spMeta.stageSprites[nearKo.stage].animated,
              });
            } else {
              nearbyKoIdRef.current = null;
              setNearbyKoTarget(null);
            }
            // Sync nearby interactive town building OR foraging / mining / signpost prompt
            if (closestTownPoint) {
              setNearbyInteract({
                id: closestTownPoint.id,
                kind: closestTownPoint.kind,
                label: `${closestTownPoint.label} · ${closestTownPoint.hint}`,
                hp: 1,
                maxHp: 1,
                icon:
                  closestTownPoint.kind === 'pokemon_center'
                    ? '/sprites/items/potion.png'
                    : closestTownPoint.kind === 'poke_mart'
                      ? '/sprites/items/amulet-coin.png'
                      : '/sprites/items/town-map.png',
              });
            } else if (closestNode) {
              setNearbyInteract({
                id: closestNode.id,
                kind: closestNode.kind,
                label: closestNode.label,
                hp: closestNode.hp,
                maxHp: closestNode.maxHp,
                icon: closestNode.icon,
              });
            } else {
              setNearbyInteract(null);
            }
            const nextMapSnap: LiveMapSnapshot = {
              px: sim.px,
              pz: sim.pz,
              facingAngle: sim.facingAngle,
              camYaw: camOrbitRef.current.yaw,
              dots: [
                ...sim.followers.map((f) => ({ x: f.x, z: f.z, kind: 'follower' as const })),
                ...sim.enemies
                  .filter((en) => en.hp > 0 || en.knockedOut)
                  .slice(0, 60)
                  .map((en) => ({
                    x: en.x,
                    z: en.z,
                    kind: (en.isBoss || en.knockedOut || en.isShiny ? 'boss' : en.isTrainer || en.quality === 'epic' ? 'trainer' : 'enemy') as
                      | 'boss'
                      | 'trainer'
                      | 'enemy',
                  })),
              ],
            };
            // Seamless Real-World Overland Cross-City Detection (e.g. walking from Shenzhen -> Hong Kong!)
            if (activeWorldRun) {
              const overland = detectOverlandCityAt(sim.px, sim.pz);
              if (
                overland &&
                overland.distKm <= 16 &&
                overland.city.id !== overlandCityIdRef.current
              ) {
                overlandCityIdRef.current = overland.city.id;
                liveOverlandCityRef.current = overland.city;
                setLiveOverlandCity(overland.city);
                sound.play('levelup');
                showBanner(
                  `🧭 徒步跨城：已抵达【${overland.city.name}】！当地生态与野生精灵已无缝切换！`,
                  4600,
                );
                onUpdateMeta?.((prev) => {
                  const prevTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
                  const visited = prevTour.visitedCities.includes(overland.city.id)
                    ? prevTour.visitedCities
                    : [...prevTour.visitedCities, overland.city.id];
                  return {
                    ...prev,
                    worldTour: {
                      ...prevTour,
                      visitedCities: visited,
                    },
                  };
                });
              }
            }

            setMapSnapshot(nextMapSnap);
            onSyncWorldMapData?.({
              biome: liveOverlandCityRef.current?.biome ?? selectedBiome,
              regionName: liveOverlandCityRef.current?.name ?? regionMeta.name,
              snapshot: nextMapSnap,
            });

            const tags: FloatingTag2D[] = [];
            const edges: {
              id: number;
              sx: number;
              sy: number;
              angleDeg: number;
              label: string;
              distM: number;
              kind: 'boss' | 'shiny' | 'ko' | 'trainer';
              icon: string;
            }[] = [];
            for (const pop of sim.dmgPops.slice(-10)) {
              projVec.set(pop.wx, pop.wy, pop.wz).project(camera);
              if (projVec.z < 1) {
                tags.push({
                  id: pop.id,
                  sx: ((projVec.x + 1) / 2) * 100,
                  sy: ((-projVec.y + 1) / 2) * 100,
                  text: pop.text,
                  color: pop.color,
                });
              }
            }
            for (const en of sim.enemies) {
              if (en.beingCaptured) continue;
              const showSpecialTag =
                en.isTrainer || en.knockedOut || en.isShiny || en.quality === 'elite' || en.quality === 'epic';
              if (!showSpecialTag || (en.hp <= 0 && !en.knockedOut)) continue;
              projVec.set(en.x, en.y + Math.max(2.2, en.worldScale * 0.95), en.z).project(camera);
              const inView = projVec.z < 1 && Math.abs(projVec.x) <= 0.92 && Math.abs(projVec.y) <= 0.9;
              const spName = SPECIES_CATALOG[en.species].stageNames[en.stage] ?? SPECIES_CATALOG[en.species].defaultName;
              const qMeta = MONSTER_QUALITY_META[en.quality];
              if (inView) {
                const koCountdown =
                  en.knockedOut && !en.isBoss && en.koTimer !== undefined
                    ? ` (${Math.ceil(en.koTimer)}s)`
                    : '';
                const label = en.knockedOut
                  ? `✨ ${en.isShiny ? '★异色 ' : ''}${spName} · 可收服${koCountdown}`
                  : en.isTrainer
                    ? (en.trainerName ?? '训练师')
                    : `${en.isShiny ? '★异色 ' : ''}${qMeta.label ? `[${qMeta.label}] ` : ''}${spName}`;
                tags.push({
                  id: 900000 + en.id,
                  sx: ((projVec.x + 1) / 2) * 100,
                  sy: ((-projVec.y + 1) / 2) * 100,
                  text: label,
                  color: en.knockedOut || en.isShiny ? '#ffe066' : en.isTrainer ? '#ff6b6b' : qMeta.color,
                  isHpBar: !en.knockedOut,
                  hpPct: Math.round((Math.max(0, en.hp) / Math.max(1, en.maxHp)) * 100),
                });
              } else if (en.isBoss || en.knockedOut || en.isShiny || en.isTrainer) {
                // Screen-perimeter directional arrow pointing toward off-screen priority targets!
                let nx = projVec.x;
                let ny = projVec.y;
                if (projVec.z >= 1) {
                  nx = -nx;
                  ny = -ny;
                }
                const maxAxis = Math.max(Math.abs(nx), Math.abs(ny), 0.001);
                const clampX = (nx / maxAxis) * 0.88;
                const clampY = (ny / maxAxis) * 0.74;
                // Keep clear of Left Squad List (168px) & Bottom-Left D-Pad!
                const sx = Math.max(16, Math.min(93, ((clampX + 1) / 2) * 100));
                const sy = Math.max(15, Math.min(76, ((-clampY + 1) / 2) * 100));
                const angleDeg = (Math.atan2(-ny, nx) * 180) / Math.PI;
                const distM = Math.max(1, Math.round(Math.hypot(en.x - sim.px, en.z - sim.pz)));
                if (edges.length < 3) {
                  edges.push({
                    id: en.id,
                    sx,
                    sy,
                  angleDeg,
                  distM,
                  kind: en.knockedOut ? 'ko' : en.isBoss ? 'boss' : en.isShiny ? 'shiny' : 'trainer',
                  label: en.knockedOut
                    ? `可收服 ${spName}`
                    : en.isBoss
                      ? `守护者 ${spName}`
                      : en.isShiny
                        ? `★异色 ${spName}`
                        : (en.trainerName ?? '训练师'),
                  icon: en.knockedOut
                    ? '/sprites/items/poke-ball.png'
                    : en.isBoss
                      ? '/sprites/items/master-ball.png'
                      : en.isShiny
                        ? '/sprites/items/bright-powder.png'
                        : '/sprites/items/vs-seeker.png',
                  });
                }
              }
            }
            setFloatingTags(tags);
            setEdgeIndicators(edges.slice(0, 3));
          }
        } else if (sim.activeCaptures.length > 0 && !externalPausedRef.current && !endedRef.current) {
          // REAL 3D CLOSE-UP CINEMATIC CAPTURE CAMERA (Enemies frozen while Three.js camera tracks the real flying Poké Ball -> impact -> 3 wobbles!)
          waterMat.uniforms.uTime.value = now * 0.001;
          if (horizonBackdrop.userData?.skyUniforms?.uTime) {
            horizonBackdrop.userData.skyUniforms.uTime.value = now * 0.001;
          }
          const cap = sim.activeCaptures[0];
          cap.t += dt;
          const en = cap.enemy;
          const gyT = getTerrainHeight3D(cap.targetX, cap.targetZ);
          const camDirX = cap.targetX - cap.startX;
          const camDirZ = cap.targetZ - cap.startZ;
          const baseYaw = Math.atan2(camDirX, camDirZ);

          if (cap.t < 0.62) {
            // ACT 1: High-speed 3D Poké Ball flight arc tracked closely by the 3D camera!
            const u = cap.t / 0.62;
            const bx = cap.startX + (cap.targetX - cap.startX) * u;
            const bz = cap.startZ + (cap.targetZ - cap.startZ) * u;
            const by = cap.startY + (cap.targetY - cap.startY) * u + Math.sin(u * Math.PI) * 3.6;
            cap.ballSprite.position.set(bx, by, bz);
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation -= dt * 18;
            cap.ballShadow.position.set(bx, getTerrainHeight3D(bx, bz) + 0.06, bz);
            const sideAng = baseYaw + Math.PI * 0.42;
            const trackX = bx + Math.sin(sideAng) * 5.2 - Math.sin(baseYaw) * 2.0;
            const trackZ = bz + Math.cos(sideAng) * 5.2 - Math.cos(baseYaw) * 2.0;
            const trackY = Math.max(getTerrainHeight3D(trackX, trackZ) + 1.4, by + 1.35);
            camera.position.lerp(new THREE.Vector3(trackX, trackY, trackZ), Math.min(1, dt * 12));
            camera.lookAt(bx * 0.65 + cap.targetX * 0.35, by * 0.6 + cap.targetY * 0.4, bz * 0.65 + cap.targetZ * 0.35);
          } else if (cap.t < 1.12) {
            // ACT 2: IMPACT! Crimson 3D capture laser ring + target digitizing into hovering Poké Ball!
            const u = (cap.t - 0.62) / 0.5;
            if (!cap.absorbed) {
              cap.absorbed = true;
              sound.play('pokeball');
              setCaptureCutscene((prev) => (prev ? { ...prev, phase: 'absorb' } : null));
              spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff3b3b, Math.max(3.4, en.worldScale * 1.2), 0.45);
              spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.fireBlastDecal, Math.max(3.0, en.worldScale), 0.42);
              spawnPixelParticles(cap.targetX, gyT + 0.8, cap.targetZ, vfxAtlas.starGlint, 10, 4.8, 0.85, 4.2, 5.5);
            }
            const hoverY = gyT + 1.85 + Math.sin(u * Math.PI) * 0.55;
            cap.ballSprite.position.set(cap.targetX, hoverY, cap.targetZ);
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation = Math.sin(u * Math.PI * 3) * 0.25;
            cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
            if (en.sprite) {
              const shrink = Math.max(0.05, 1 - u);
              en.sprite.scale.set(en.worldScale * shrink, en.worldScale * shrink, 1);
              en.sprite.position.set(cap.targetX, gyT + u * 1.7, cap.targetZ);
              (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(0xff5252);
            }
            const orbAng = baseYaw + 0.65 + u * 0.45;
            const cx = cap.targetX + Math.sin(orbAng) * 4.8;
            const cz = cap.targetZ + Math.cos(orbAng) * 4.8;
            camera.position.lerp(new THREE.Vector3(cx, Math.max(getTerrainHeight3D(cx, cz) + 1.3, gyT + 2.3), cz), Math.min(1, dt * 10));
            camera.lookAt(cap.targetX, gyT + 1.15, cap.targetZ);
          } else if (cap.t < 2.65) {
            // ACT 3: Close-up 3D orbit around the Poké Ball wobbling 3 suspenseful times on the grass!
            if (en.sprite) en.sprite.visible = false;
            if (en.shadow) en.shadow.visible = false;
            const u = cap.t - 1.12;
            const dropBounce = u < 0.24 ? Math.abs(Math.sin((u / 0.24) * Math.PI)) * 0.8 : 0;
            const wobbleIdx = Math.floor((u - 0.24) / 0.42);
            if (u >= 0.24 && wobbleIdx >= 0 && wobbleIdx < 3 && wobbleIdx >= cap.wobbleClicks) {
              cap.wobbleClicks = wobbleIdx + 1;
              sound.play('pokeball');
              setCaptureCutscene((prev) => (prev ? { ...prev, phase: 'wobble', wobbleCount: wobbleIdx + 1 } : null));
              spawnPixelParticles(cap.targetX, gyT + 0.6, cap.targetZ, vfxAtlas.electricSpark, 4, 2.4, 0.55, 2.4, 7.0);
            }
            const wobbleAngle =
              u >= 0.24 && u < 1.48
                ? Math.sin((((u - 0.24) % 0.42) / 0.42) * Math.PI * 2) * 0.58 * (wobbleIdx % 2 === 0 ? 1 : -1)
                : 0;
            cap.ballSprite.position.set(cap.targetX, gyT + 0.56 + dropBounce, cap.targetZ);
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation = wobbleAngle;
            cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
            const orbAng = baseYaw + 1.1 + u * 0.55;
            const cx = cap.targetX + Math.sin(orbAng) * 4.3;
            const cz = cap.targetZ + Math.cos(orbAng) * 4.3;
            camera.position.lerp(new THREE.Vector3(cx, Math.max(getTerrainHeight3D(cx, cz) + 1.2, gyT + 1.85), cz), Math.min(1, dt * 8));
            camera.lookAt(cap.targetX, gyT + 0.65, cap.targetZ);
          } else if (!cap.resolved) {
            // ACT 4: Resolution — Golden 3D Starburst + Handheld Console Pokédex Reveal OR Break-Free!
            cap.resolved = true;
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation = 0;
            if (cap.willCatch) {
              const catchLv = en.isBoss
                ? Math.min(32, pet.level + 4)
                : Math.min(28, Math.max(4, pet.level + (en.quality === 'epic' ? 2 : en.isShiny ? 2 : 0)));
              const spMeta = SPECIES_CATALOG[en.species];
              const spName = spMeta.stageNames[en.stage] ?? spMeta.defaultName;
              const phys = getPokemonPhysicalMetrics(en.species, en.stage);
              const isNewSp = !save.discoveredSpecies.includes(en.species);
              sound.play('hatch');
              window.setTimeout(() => sound.play('levelup'), 220);
              window.setTimeout(() => sound.playCry(getPokemonCryId(en.species, catchLv)), 360);
              spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.healCircleDecal, 4.6, 0.62);
              spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xffe066, 4.4, 0.55);
              spawnPixelParticles(cap.targetX, gyT + 0.9, cap.targetZ, vfxAtlas.starGlint, 16, 6.2, 1.05, 5.8, 5.5);
              const caughtSkin: PetSkinId | undefined = en.isShiny ? 'shiny' : en.regionalSkin;
              onCaptureBoss?.(en.species, catchLv, caughtSkin);
              if (sim.followers.length < maxFollowersRef.current) {
                addFollowerToRun(en.species, `${en.isShiny ? '★' : ''}${spName}`, en.stage, undefined, caughtSkin);
              }
              if (en.isBoss) {
                sim.capturedBoss = { species: en.species, name: spName, level: catchLv };
              }
              if (en.sprite) scene.remove(en.sprite);
              if (en.shadow) scene.remove(en.shadow);
              if (en.auraRing) scene.remove(en.auraRing);
              const eIdx = sim.enemies.indexOf(en);
              if (eIdx !== -1) sim.enemies.splice(eIdx, 1);

              // Brief 650ms 3D golden starburst celebration, then pull up our REAL MAIN HandheldConsole!
              setCaptureCutscene((prev) => (prev ? { ...prev, phase: 'caught' } : null));
              window.setTimeout(() => {
                for (const c of sim.activeCaptures) {
                  scene.remove(c.ballSprite, c.ballShadow);
                }
                sim.activeCaptures = [];
                setCaptureCutscene(null);
                if (onShowCaptureInHandheld) {
                  onShowCaptureInHandheld(
                    {
                      species: en.species,
                      name: en.regionalSkin ? `${spName}·${getSkinDef(en.regionalSkin).name.split('·')[0]}` : spName,
                      sprite: spMeta.stageSprites[en.stage].animated,
                      level: catchLv,
                      isShiny: en.isShiny,
                      isNewSpecies: isNewSp,
                      dexNo: spMeta.dexNo,
                      typeLabel: spMeta.typeLabel,
                      typeColor: spMeta.typeColor,
                      lore: spMeta.description,
                      heightM: phys.heightM,
                      weightKg: phys.weightKg,
                      qualityLabel: en.regionalSkin
                        ? `🏮${getSkinDef(en.regionalSkin).name}`
                        : MONSTER_QUALITY_META[en.quality].label,
                      qualityColor: en.regionalSkin
                        ? getSkinDef(en.regionalSkin).rarityColor
                        : MONSTER_QUALITY_META[en.quality].color,
                    },
                    () => {
                      if (en.isBoss && gameMode === 'story' && !endedRef.current) {
                        sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
                        endedRef.current = true;
                        pausedRef.current = true;
                        setResultSummary(buildResultSummary(true, sim.capturedBoss));
                      } else {
                        pausedRef.current = false;
                      }
                    },
                  );
                } else {
                  captureFinishRef.current?.();
                }
              }, 680);
            } else {
              sound.play('hit');
              spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff6b6b, 3.2, 0.35);
              en.beingCaptured = false;
              if (en.sprite) {
                en.sprite.visible = true;
                en.sprite.scale.set(en.worldScale, en.worldScale, 1);
                const baseTint = en.regionalSkin ? getSkinDef(en.regionalSkin).tintHex3D : 0xffffff;
                (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(baseTint);
              }
              if (en.shadow) en.shadow.visible = true;
              damageEnemy3D(en, Math.round(en.maxHp * 0.25), '#ff922b');
              setCaptureCutscene((prev) => (prev ? { ...prev, phase: 'escaped' } : null));
              window.setTimeout(() => {
                captureFinishRef.current?.();
              }, 1050);
            }
          }
          // Still advance VFX particles smoothly during 3D capture close-up!
          for (let i = sim.vfxs.length - 1; i >= 0; i--) {
            const v = sim.vfxs[i];
            v.life -= dt;
            if (v.life <= 0) {
              scene.remove(v.mesh);
              sim.vfxs.splice(i, 1);
            } else if (v.kind === 'particle') {
              const sp = v.mesh as THREE.Sprite;
              sp.position.x += (v.vx ?? 0) * dt;
              sp.position.y += (v.vy ?? 0) * dt;
              sp.position.z += (v.vz ?? 0) * dt;
              v.vy = (v.vy ?? 0) - (v.gravity ?? 10) * dt;
            }
          }
          // Face all sprites toward the close-up cinema camera
          const cYaw = Math.atan2(camera.position.x - cap.targetX, camera.position.z - cap.targetZ);
          syncFloraBillboards(cYaw, 0.25);
        }

        renderer.render(scene, camera);
      }
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => {
      unsubGeoDem();
      window.removeEventListener('resize', onResize);
      window.cancelAnimationFrame(rafId);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedBiome, gameMode, difficultyId, runNonce]);

  // Clear real-Earth geo projection when returning to Hub or non-playing screens
  useEffect(() => {
    if (phase !== 'playing') {
      setActiveGeoTerrainOrigin(null);
      setLiveOverlandCity(null);
      liveOverlandCityRef.current = null;
      overlandCityIdRef.current = null;
      passiveLevelsRef.current = {};
    }
  }, [phase]);

  // Unified Single Real-Earth Entry! Clicking「开始冒险」launches directly into REAL EARTH (default: 上海市 31.23°N, 121.47°E)!
  const handleLaunchRun = () => {
    const wt = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
    const activeId = wt.currentCityId || 'shanghai';
    const city = WORLD_CITIES.find((c) => c.id === activeId) ?? WORLD_CITIES.find((c) => c.id === 'shanghai') ?? WORLD_CITIES[0];
    handleLaunchWorldRun({
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
    });
  };

  const handleLaunchWorldRun = (payload: WorldLaunchPayload) => {
    sound.play('confirm');
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
    setGameMode(payload.isGymChallenge ? 'story' : 'endless');
    pausedRef.current = false;
    endedRef.current = false;
    setRunNonce((n) => n + 1);
    setLaunchFlashSeq((s) => s + 1);
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
        : `🌍 ${payload.cityName} 真实地形已加载：可沿海岸与平原探索，甚至徒步跨越邻城！${buffNote}`,
      4200,
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
        sound.play('cursor');
        setCamPreset(preset);
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
          if (phase !== 'playing' || pausedRef.current) return;
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
              canvasRef.current?.requestPointerLock?.();
            } catch {
              // fallback drag orbit remains active seamlessly
            }
          }
        }}
        onPointerLeave={() => {
          pointerSteerRef.current.active = false;
        }}
      />

      {/* =====================================================================
          LAYER 1: POKEBONK-STYLE PIXEL MAIN HUB (Top-Left Squad Avatars + Top-Right Trainer/Settings + Open 3D Vista!)
         ===================================================================== */}
      {phase === 'hub' && (
        <div className="pkb-hub-overlay">
          {/* Top Status Ribbon: Wide Desktop shows full 6-avatar squad strip; Mobile/Compact converges into Squad entry pill! */}
          <header className="pkb-topbar">
            <div className="pkb-top-squad" title={`当前出战队伍：${activeSquadPreset.name} · 点击管理当前队伍`}>
              {/* Wide-screen full squad avatar strip */}
              <div className="pkb-top-squad-wide">
                {effectiveSquadPets.slice(0, 6).map((p) => {
                  const stg = getGrowthStage(p.level, p.species);
                  const spMeta = SPECIES_CATALOG[p.species];
                  const isLead = p.id === pet.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pkb-top-avatar-btn ${isLead ? 'is-lead' : ''}`}
                      onClick={() => onOpenPokemonManager('squad', false)}
                      title={`${p.name} (${spMeta.typeLabel}) · Lv.${p.level} · 点击管理当前队伍`}
                    >
                      <TrimmedSpriteImg
                        src={spMeta.stageSprites[stg].animated}
                        alt={p.name}
                        size={36}
                        fillRatio={0.86}
                      />
                      <em>{p.level}</em>
                    </button>
                  );
                })}
                {save.pets.length < 6 && (
                  <button
                    type="button"
                    className="pkb-top-avatar-btn is-add"
                    onClick={() => {
                      sound.play('confirm');
                      setHubModal('shop');
                    }}
                    title="打开精品商店与精灵盲盒"
                  >
                    <span>+</span>
                  </button>
                )}
              </div>

              {/* Compact / mobile converged Squad entry pill */}
              <button
                type="button"
                className="pkb-squad-entry-btn"
                onClick={() => onOpenPokemonManager('squad', false)}
                title={`管理出战队伍（${activeSquadPreset.name} · ${effectiveSquadPets.length}/${maxFollowers}）`}
              >
                <span className="pkb-squad-entry-ava">
                  <TrimmedSpriteImg
                    src={petMeta.stageSprites[petStage].static}
                    alt={pet.name}
                    size={26}
                    fillRatio={0.86}
                  />
                </span>
                <strong>{tr(lang, 'squadBtn')}</strong>
                <em className="pkb-squad-entry-count">{effectiveSquadPets.length}/{maxFollowers}</em>
              </button>
            </div>

            <div className="pkb-top-right">
              <button
                type="button"
                className="pkb-weather-pill"
                style={{ borderColor: liveWeather.accentColor }}
                onClick={() => {
                  sound.play('confirm');
                  setPhase('world_map');
                }}
                title={`${liveWeather.locationLabel ?? '当地'} ${liveWeather.summary}（${liveWeather.source === 'live' ? '实时气象' : '本地推演'}）\n${liveWeather.buffText}\n点击查看世界地图与 GPS 定位`}
              >
                <span>{liveWeather.emoji}</span>
                <strong>{liveWeather.label} {liveWeather.tempC}°C</strong>
              </button>

              <button
                type="button"
                className="pkb-profile-pill is-clickable"
                onClick={() => onOpenPokemonManager('profile', false)}
                title="点击在掌机中查看与编辑训练家名片"
              >
                <img
                  src={petMeta.stageSprites[petStage].static}
                  alt={pet.name}
                  className="pkb-avatar"
                  draggable={false}
                />
                <div className="pkb-trainer-meta">
                  <span className="pkb-trainer-name">{trainerProfile.name}</span>
                  <small className="pkb-trainer-sub">{trainerProfile.title}</small>
                </div>
              </button>

              <button
                type="button"
                className="pkb-coin-standalone"
                onClick={() => {
                  sound.play('confirm');
                  setHubModal('shop');
                }}
                title="当前持有金币 · 点击打开宝可梦精品商店"
              >
                <PixelItemImg src="/sprites/items/amulet-coin.png" size={18} />
                <span>{save.coins}</span>
              </button>

              <button
                type="button"
                className="pkb-icon-btn is-icon-only"
                onClick={() => onOpenPokemonManager('settings', false)}
                title="系统设置（分轨音频 / 界面 / 画面性能 / 外观 / 按键）"
                aria-label="系统设置"
              >
                <PixelItemImg src="/sprites/items/exp-share.png" size={24} />
              </button>
            </div>
          </header>

          {/* Trainer Profile Social Card Modal (Bidirectional Open + Close Animation!) */}
          {profileOpen && (
            <div
              className={`surv-modal-backdrop ${closingProfile ? 'is-closing' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeProfileModal();
              }}
            >
              <div className="surv-upgrade-box pkb-profile-modal">
                <div className="surv-upgrade-head shop-head-row">
                  <span className="inline-icon-row">
                    <PixelIcon name="crown" size={15} />
                    <span>训练家详情与名片设置</span>
                  </span>
                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={closeProfileModal}
                  >
                    关闭
                  </button>
                </div>
                <div className="pkb-prof-body">
                  <div className="pkb-prof-preview">
                    <div className="pkb-prof-avatar-lg">
                      <img
                        src={petMeta.stageSprites[petStage].animated}
                        alt={pet.name}
                        draggable={false}
                      />
                    </div>
                    <div className="pkb-prof-stats">
                      <strong>{profileDraft.name.trim() || DEFAULT_TRAINER_PROFILE.name}</strong>
                      <span className="pkb-prof-title-badge">{profileDraft.title.trim() || DEFAULT_TRAINER_PROFILE.title}</span>
                      <p>{profileDraft.bio.trim() || DEFAULT_TRAINER_PROFILE.bio}</p>
                      <div className="pkb-prof-kpis">
                        <span>图鉴 {save.discoveredSpecies.length}/{POKEDEX_ORDER.length}</span>
                        <span>伙伴 {save.pets.length} 只</span>
                        <span>徽章 {save.unlockedAchievements.length} 枚</span>
                      </div>
                    </div>
                  </div>

                  <div className="pkb-prof-form">
                    <label>
                      <span>训练家昵称</span>
                      <input
                        type="text"
                        maxLength={14}
                        value={profileDraft.name}
                        onChange={(e) => setProfileDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="输入你的训练家昵称"
                      />
                    </label>
                    <label>
                      <span>展示称号</span>
                      <input
                        type="text"
                        maxLength={16}
                        value={profileDraft.title}
                        onChange={(e) => setProfileDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="例如：关都新锐训练家 / 森林守护者"
                      />
                    </label>
                    <label>
                      <span>个人展示签名</span>
                      <input
                        type="text"
                        maxLength={40}
                        value={profileDraft.bio}
                        onChange={(e) => setProfileDraft((d) => ({ ...d, bio: e.target.value }))}
                        placeholder="向其他训练家展示你的冒险宣言..."
                      />
                    </label>
                  </div>

                  <div className="pkb-prof-actions">
                    <button
                      type="button"
                      className="lcd-inline-cta full"
                      onClick={() => {
                        sound.play('confirm');
                        onUpdateProfile?.({
                          name: profileDraft.name.trim() || DEFAULT_TRAINER_PROFILE.name,
                          title: profileDraft.title.trim() || DEFAULT_TRAINER_PROFILE.title,
                          bio: profileDraft.bio.trim() || DEFAULT_TRAINER_PROFILE.bio,
                        });
                        closeProfileModal();
                      }}
                    >
                      保存训练家名片
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Center-Left Hero Launch Deck (Clean Title + Co-Linear 60° Slanted Parallelogram Cards!) */}
          <div className="pkb-hub-body">
            <div className="pkb-hub-left">
              <div className="pkb-title-block">
                <h1>
                  POKé POCKET <span className="pkb-3d-tag">3D</span>
                </h1>
              </div>

              {/* Primary Co-Linear Slanted Parallelogram Arcade Mode Cards */}
              <div className="pkb-hero-grid is-slanted-deck">
                <button
                  type="button"
                  className="pkb-hero-cta is-story"
                  onClick={() => {
                    const nextMode = save.prefs?.worldGameMode ?? 'story';
                    const nextDiff = save.prefs?.worldDifficulty ?? 'normal';
                    setGameMode(nextMode);
                    setDifficultyId(nextDiff);
                    handleLaunchRun();
                  }}
                >
                  <div className="pkb-unskew-inner">
                    <div className="pkb-hero-ico-box is-lg">
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={58} />
                    </div>
                    <div className="pkb-cta-txt">
                      <strong>{tr(lang, 'startAdventure')}</strong>
                      <small>{tr(lang, 'startAdventureSub')}</small>
                    </div>
                  </div>
                  <kbd className="px-keycap on-hero">1</kbd>
                </button>

                <div className="pkb-hero-subcol">
                  <button
                    type="button"
                    className="pkb-sub-cta is-world"
                    onClick={() => {
                      sound.play('confirm');
                      setPhase('world_map');
                    }}
                  >
                    <div className="pkb-unskew-inner">
                      <div className="pkb-hero-ico-box">
                        <PixelItemImg src="/sprites/items/town-map.png" size={44} />
                      </div>
                      <div>
                        <strong>世界巡礼</strong>
                        <small>GPS老家 · 航线住宿 · 全球道馆</small>
                      </div>
                    </div>
                    <kbd className="px-keycap on-hero">2</kbd>
                  </button>
                  <button
                    type="button"
                    className="pkb-sub-cta is-care"
                    onClick={() => {
                      sound.play('confirm');
                      onOpenPokemonManager('home', false);
                    }}
                  >
                    <div className="pkb-unskew-inner">
                      <div className="pkb-hero-ico-box">
                        <PixelItemImg src="/sprites/items/soothe-bell.png" size={44} />
                      </div>
                      <div>
                        <strong>{tr(lang, 'pokemonManager')}</strong>
                        <small>{tr(lang, 'pokemonManagerSub')}</small>
                      </div>
                    </div>
                    <kbd className="px-keycap on-hero">3</kbd>
                  </button>
                </div>
              </div>

              {/* True Responsive Priority+ Single-Row Hub Dock: packs as many tiles as fit in 1 row, overflows ONLY the rest into "More"! */}
              {(() => {
                const allDockItems: {
                  id: string;
                  label: string;
                  icon: string;
                  title: string;
                  badge?: string | number;
                  badgeClass?: string;
                  onClick: () => void;
                }[] = [
                  {
                    id: 'box',
                    label: tr(lang, 'dockBox'),
                    icon: '/sprites/items/great-ball.png',
                    title: `精灵球盒 · 共 ${save.pets.length}/${MAX_PET_SLOTS} 只伙伴`,
                    badge: save.pets.length,
                    onClick: () => onOpenPokemonManager('party', false),
                  },
                  {
                    id: 'bag',
                    label: tr(lang, 'dockBag'),
                    icon: '/sprites/items/berry-pouch.png',
                    title: '训练家背包 · 树果补给与携带道具',
                    onClick: () => onOpenPokemonManager('bag', false),
                  },
                  {
                    id: 'dex',
                    label: tr(lang, 'dockDex'),
                    icon: '/sprites/items/town-map.png',
                    title: `宝可梦图鉴+ · 已收录 ${save.discoveredSpecies.length}/${POKEDEX_ORDER.length}`,
                    badge: `${save.discoveredSpecies.length}/${POKEDEX_ORDER.length}`,
                    badgeClass: 'is-blue',
                    onClick: () => onOpenPokemonManager('pokedex', false),
                  },
                  {
                    id: 'lab',
                    label: tr(lang, 'dockLab'),
                    icon: '/sprites/items/bright-powder.png',
                    title: `研究所 · 星星沙子 ${meta.stardust} · 永久强化与切换主角 (${activeHeroDef.name})`,
                    badge: meta.stardust,
                    badgeClass: 'is-purple',
                    onClick: () => {
                      sound.play('confirm');
                      setHubModal('lab');
                    },
                  },
                  {
                    id: 'bounties',
                    label: tr(lang, 'dockBounties'),
                    icon: '/sprites/items/vs-seeker.png',
                    title: '每日 & 每周任务委托 · 赚取星星沙子',
                    badge: claimableBountyCount > 0 ? claimableBountyCount : undefined,
                    onClick: () => {
                      sound.play('confirm');
                      setHubModal('bounties');
                    },
                  },
                  {
                    id: 'shop',
                    label: tr(lang, 'dockShop'),
                    icon: '/sprites/items/amulet-coin.png',
                    title: '宝可梦精品商店 · 专属外观 / 盲盒 / 补给',
                    badge: '精品',
                    badgeClass: 'is-gold',
                    onClick: () => {
                      sound.play('confirm');
                      setHubModal('shop');
                    },
                  },
                  {
                    id: 'achieve',
                    label: tr(lang, 'dockAchieve'),
                    icon: '/sprites/items/kings-rock.png',
                    title: `成就徽章 · 已解锁 ${save.unlockedAchievements.length}/${ACHIEVEMENTS.length} 枚`,
                    badge: save.unlockedAchievements.length,
                    badgeClass: 'is-green',
                    onClick: () => onOpenPokemonManager('achievements', false),
                  },
                  {
                    id: 'diary',
                    label: tr(lang, 'dockDiary'),
                    icon: '/sprites/items/poke-radar.png',
                    title: '冒险日记 · 成长与战绩',
                    onClick: () => onOpenPokemonManager('diary', false),
                  },
                ];
                const visibleItems = allDockItems.slice(0, visibleDockCount);
                const overflowCount = Math.max(0, allDockItems.length - visibleItems.length);
                return (
                  <>
                    <div
                      ref={dockRowRef}
                      className="pkb-dock-row is-single-row"
                      style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
                    >
                      {visibleItems.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          className="pkb-dock-tile"
                          onClick={it.onClick}
                          title={it.title}
                        >
                          {it.badge !== undefined && (
                            <em className={`pkb-dock-badge ${it.badgeClass ?? ''}`}>{it.badge}</em>
                          )}
                          <PixelItemImg src={it.icon} size={38} />
                          <strong>{it.label}</strong>
                        </button>
                      ))}
                    </div>

                    {/* Bottom Action Bar: Rolling Announcement Ticker + Adaptive "More" Button (shown only when items overflow or on compact screens!) */}
                    <div className="pkb-hub-bar">
                      <button
                        type="button"
                        className="pkb-news-ticker"
                        onClick={() => onOpenPokemonManager('news', false)}
                        title="点击在掌机中查看《关都日报》"
                      >
                        <PixelItemImg src="/sprites/items/poke-radar.png" size={16} />
                        <span className="pkb-news-pill">
                          {lang === 'zh'
                            ? DEFAULT_ANNOUNCEMENTS[newsTickerIdx % DEFAULT_ANNOUNCEMENTS.length]?.tag ?? tr(lang, 'newsTag')
                            : tr(lang, 'newsTag')}
                        </span>
                        <span className="pkb-news-text">
                          {lang === 'zh'
                            ? `${DEFAULT_ANNOUNCEMENTS[newsTickerIdx % DEFAULT_ANNOUNCEMENTS.length]?.title ?? tr(lang, 'newsHeadline')}`
                            : tr(lang, 'newsHeadline')}
                        </span>
                        <em>→</em>
                      </button>

                      {overflowCount > 0 && (
                        <button
                          type="button"
                          className="pkb-more-btn is-always-visible"
                          onClick={() => {
                            sound.play('confirm');
                            setHubModal('more');
                          }}
                          title="展开剩余功能"
                        >
                          <em className="pkb-dock-badge">{overflowCount}</em>
                          <PixelItemImg src="/sprites/items/town-map.png" size={18} />
                          <strong>{tr(lang, 'moreBtn')}</strong>
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Corner Footer (Desktop shows Guide/Feedback/PWA/Lang; Mobile folds Guide/Feedback into More!) */}
          <footer className="pkb-hub-footer">
            <button
              type="button"
              className="pkb-util-btn pkb-wide-footer-item"
              onClick={() => onOpenPokemonManager('guide', false)}
              title={tr(lang, 'guideBtn')}
            >
              <PixelItemImg src="/sprites/items/light-ball.png" size={15} />
              <span>{tr(lang, 'guideBtn')}</span>
            </button>
            <button
              type="button"
              className="pkb-util-btn pkb-wide-footer-item"
              onClick={() => onOpenPokemonManager('feedback', false)}
              title={tr(lang, 'feedbackBtn')}
            >
              <PixelItemImg src="/sprites/items/potion.png" size={15} />
              <span>{tr(lang, 'feedbackBtn')}</span>
            </button>
            {pwaInstallPrompt && (
              <button
                type="button"
                className="pkb-util-btn is-pwa"
                title="将 POKé POCKET 安装为桌面/手机独立应用 (PWA)"
                onClick={async () => {
                  sound.play('confirm');
                  await pwaInstallPrompt.prompt();
                  const choice = await pwaInstallPrompt.userChoice;
                  if (choice.outcome === 'accepted') {
                    setPwaInstallPrompt(null);
                  }
                }}
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={15} />
                <span>安装应用</span>
              </button>
            )}
            <button
              type="button"
              className="pkb-util-btn is-lang"
              onClick={cycleLanguage}
              aria-label="语言"
              title="切换界面语言 (中文 / English / 日本語)"
            >
              <PixelItemImg src="/sprites/items/town-map.png" size={15} />
              <span>{LANG_LABELS[lang]}</span>
            </button>
            {onToggleFullscreen && (
              <button
                type="button"
                className={`pkb-util-btn is-fs ${isFullscreen ? 'is-active' : ''}`}
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? tr(lang, 'exitFullscreenBtn') : tr(lang, 'fullscreenBtn')}
                title={isFullscreen ? '退出浏览器全屏' : '开启浏览器全屏模式'}
              >
                <PixelIcon name={isFullscreen ? 'shrink' : 'fullscreen'} size={13} />
                <span>{isFullscreen ? tr(lang, 'exitFullscreenBtn') : tr(lang, 'fullscreenBtn')}</span>
              </button>
            )}
          </footer>

          {/* Clean "More" Hub Drawer Modal (All 7 Secondary Features + Guide/Feedback) */}
          {hubModal === 'more' && (
            <div
              className={`surv-modal-backdrop ${closingHubModal ? 'is-closing' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeHubModal();
              }}
            >
              <div className="surv-upgrade-box pkb-more-modal">
                <div className="surv-upgrade-head shop-head-row">
                  <span className="inline-icon-row">
                    <PixelItemImg src="/sprites/items/town-map.png" size={18} />
                    <span>更多功能</span>
                  </span>
                  <button
                    type="button"
                    className="lcd-mini-close"
                    onClick={closeHubModal}
                  >
                    {tr(lang, 'close')}
                  </button>
                </div>

                <div className="pkb-more-grid">
                  {([
                    {
                      id: 'box',
                      label: tr(lang, 'dockBox'),
                      icon: '/sprites/items/great-ball.png',
                      badge: save.pets.length,
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('party', false);
                      },
                    },
                    {
                      id: 'bag',
                      label: tr(lang, 'dockBag'),
                      icon: '/sprites/items/berry-pouch.png',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('bag', false);
                      },
                    },
                    {
                      id: 'dex',
                      label: tr(lang, 'dockDex'),
                      icon: '/sprites/items/town-map.png',
                      badge: `${save.discoveredSpecies.length}/${POKEDEX_ORDER.length}`,
                      badgeClass: 'is-blue',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('pokedex', false);
                      },
                    },
                    {
                      id: 'lab',
                      label: tr(lang, 'dockLab'),
                      icon: '/sprites/items/bright-powder.png',
                      badge: meta.stardust,
                      badgeClass: 'is-purple',
                      onClick: () => {
                        sound.play('confirm');
                        setHubModal('lab');
                      },
                    },
                    {
                      id: 'bounties',
                      label: tr(lang, 'dockBounties'),
                      icon: '/sprites/items/vs-seeker.png',
                      badge: claimableBountyCount > 0 ? claimableBountyCount : undefined,
                      onClick: () => {
                        sound.play('confirm');
                        setHubModal('bounties');
                      },
                    },
                    {
                      id: 'shop',
                      label: tr(lang, 'dockShop'),
                      icon: '/sprites/items/amulet-coin.png',
                      badge: '精品',
                      badgeClass: 'is-gold',
                      onClick: () => {
                        sound.play('confirm');
                        setHubModal('shop');
                      },
                    },
                    {
                      id: 'achieve',
                      label: tr(lang, 'dockAchieve'),
                      icon: '/sprites/items/kings-rock.png',
                      badge: save.unlockedAchievements.length,
                      badgeClass: 'is-green',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('achievements', false);
                      },
                    },
                    {
                      id: 'diary',
                      label: tr(lang, 'dockDiary'),
                      icon: '/sprites/items/poke-radar.png',
                      onClick: () => {
                        setHubModal('none');
                        onOpenPokemonManager('diary', false);
                      },
                    },
                  ] as const)
                    .slice(visibleDockCount)
                    .map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className="pkb-dock-tile"
                        onClick={it.onClick}
                      >
                        {'badge' in it && it.badge !== undefined && (
                          <em className={`pkb-dock-badge ${'badgeClass' in it && it.badgeClass ? it.badgeClass : ''}`}>
                            {it.badge}
                          </em>
                        )}
                        <PixelItemImg src={it.icon} size={34} />
                        <strong>{it.label}</strong>
                      </button>
                    ))}
                </div>

                <div className="pkb-more-footer">
                  <button
                    type="button"
                    className="pkb-util-btn"
                    onClick={() => {
                      setHubModal('none');
                      onOpenPokemonManager('guide', false);
                    }}
                  >
                    <PixelItemImg src="/sprites/items/light-ball.png" size={15} />
                    <span>{tr(lang, 'guideBtn')}</span>
                  </button>
                  <button
                    type="button"
                    className="pkb-util-btn"
                    onClick={() => {
                      setHubModal('none');
                      onOpenPokemonManager('feedback', false);
                    }}
                  >
                    <PixelItemImg src="/sprites/items/potion.png" size={15} />
                    <span>{tr(lang, 'feedbackBtn')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Shop, Lab, Bounties & Info Modals */}
          {hubModal === 'shop' && (
            <ShopOverlay
              save={save}
              pet={pet}
              closing={closingHubModal}
              onClose={closeHubModal}
              onBuyFood={(fid) => onBuyFood?.(fid)}
              onBuyAccessory={(aid) => onBuyAccessory?.(aid)}
              onBuyPokeball={(rid) => onBuyPokeball?.(rid)}
              onPullGacha={(bid) =>
                onPullGacha?.(bid) ?? { ok: false, save, message: '暂不可用' }
              }
              onPullGachaTen={(bid) =>
                onPullGachaTen?.(bid) ?? { ok: false, save, results: [], message: '暂不可用' }
              }
              onUpdatePetConfig={onUpdatePetConfig}
            />
          )}
          {hubModal === 'lab' && (
            <LabOverlay
              meta={meta}
              closing={closingHubModal}
              onClose={closeHubModal}
              onBuyLabUpgrade={handleBuyLabUpgrade}
              onUnlockOrSelectHero={handleUnlockOrSelectHero}
              onUpgradeHeroSkill={handleUpgradeHeroSkill}
              onSelectTrainerTag={(tagId: TrainerTagId) => {
                onUpdateMeta?.((prev) => ({ ...prev, activeTrainerTag: tagId }));
              }}
            />
          )}
          {hubModal === 'bounties' && (
            <BountiesOverlay
              meta={meta}
              closing={closingHubModal}
              onClose={closeHubModal}
              onClaimBounty={handleClaimBounty}
              onRerollBounty={handleRerollBounty}
              onClaimBonusChest={handleClaimBonusChest}
            />
          )}
          {(hubModal === 'news' || hubModal === 'guide' || hubModal === 'feedback') && (
            <HubInfoModal
              kind={hubModal}
              closing={closingHubModal}
              onClose={closeHubModal}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          LAYER 1.5: PIXELATED REAL WORLD MAP & GPS TOUR OVERLAY
         ===================================================================== */}
      {phase === 'world_map' && (
        <WorldMapOverlay
          coins={save.coins}
          lang={lang}
          meta={meta}
          onUpdateMeta={(updater, coinDelta) => onUpdateMeta?.(updater, coinDelta)}
          onLaunchWorldRun={handleLaunchWorldRun}
          onClose={() => {
            sound.play('cancel');
            setPhase('hub');
          }}
        />
      )}

      {/* =====================================================================
          LAYER 2: POKEBONK-STYLE 2-COLUMN MAP SELECT & READY SCREEN
         ===================================================================== */}
      {phase === 'map_select' && (
        <div className={`pkb-mapselect-overlay ${closingMapSelect ? 'is-closing' : ''}`}>
          {/* Top Navigation Bar */}
          <div className="pkb-ms-header">
            <button
              type="button"
              className="pkb-esc-btn"
              onClick={closeMapSelect}
            >
              <PixelIcon name="arrow_left" size={13} />
              <span>返回</span>
            </button>
            <div className="pkb-ms-ribbon">冒险准备 · 无限大世界</div>
            <div className="pkb-gen-pill">
              <span>{liveWeather.emoji}</span>
              <span>{liveWeather.label} {liveWeather.tempC}°C</span>
            </div>
          </div>

          {/* Main 2-Column Split: Left Live 3D Infinite World Showcase + Right Ready Panel */}
          <div className="pkb-ms-split">
            {/* LEFT: Transparent Frame Exposing the LIVE 3D Seamless Multi-Biome World! */}
            <div className="pkb-ms-showcase">
              <div className="pkb-ms-showcase-top">
                <div className="pkb-ms-title-card">
                  <small>无界探索 · 剧情冒险</small>
                  <h2>关都无限大世界</h2>
                  <div className="pkb-type-row">
                    <span className="pkb-type-pill" style={{ backgroundColor: '#2f9e44' }}>森林</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#d97724' }}>沙漠</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#1971c2' }}>海岸</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#15aabf' }}>冰川</span>
                    <span className="pkb-type-pill" style={{ backgroundColor: '#c92a2a' }}>火山</span>
                  </div>
                  <p>
                    单一连续的无限大世界：默认出发点位于「上海市」南郊，向北即入上海市中心（含东方明珠、宝可梦中心、友好商店与高铁站），沿四方公路可跨桥穿洞远行至北京、广州、东京、京都。当前天气：{liveWeather.summary}（{liveWeather.buffText}）。
                  </p>
                </div>

                {/* Compact Vertically Stacked Squad Presets (Avatars Only!) */}
                <div className="pkb-squad-stack">
                  {squadPresets.map((sq, idx) => {
                    const isSelected = idx === activeSquadIdx;
                    const rowPets = sq.petIds
                      .map((id) => save.pets.find((p) => p.id === id))
                      .filter((p): p is PetRecord => p !== undefined && !p.isSleeping);
                    const shownPets =
                      rowPets.length > 0
                        ? rowPets.slice(0, maxFollowers)
                        : save.pets.filter((p) => !p.isSleeping).slice(0, Math.min(3, maxFollowers));
                    return (
                      <div
                        key={sq.id}
                        role="button"
                        tabIndex={0}
                        className={`pkb-squad-row ${isSelected ? 'is-active' : ''}`}
                        onClick={() => selectSquadPreset(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectSquadPreset(idx);
                          }
                        }}
                      >
                        <span className="pkb-squad-row-label">{sq.name}</span>
                        <div className="pkb-squad-row-avatars">
                          <span className="pkb-squad-mini-ava is-hero" title={activeHeroDef.name}>
                            <PixelItemImg src={activeHeroDef.avatarSprite} size={20} />
                          </span>
                          {shownPets.map((p) => {
                            const stg = getGrowthStage(p.level, p.species);
                            return (
                              <span key={p.id} className="pkb-squad-mini-ava" title={p.name}>
                                <TrimmedSpriteImg
                                  src={SPECIES_CATALOG[p.species].stageSprites[stg].static}
                                  alt={p.name}
                                  size={22}
                                  fillRatio={0.86}
                                />
                              </span>
                            );
                          })}
                        </div>
                        {isSelected && (
                          <button
                            type="button"
                            className="pkb-squad-edit-mini"
                            onClick={(e) => {
                              e.stopPropagation();
                              sound.play('confirm');
                              setSquadEditorOpen(true);
                            }}
                          >
                            编辑
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Inline Saved Squad Editor Modal */}
                {squadEditorOpen && (
                  <div
                    className={`surv-modal-backdrop ${closingSquadEditor ? 'is-closing' : ''}`}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) closeSquadEditor();
                    }}
                  >
                    <div className="surv-upgrade-box pkb-squad-editor-modal">
                      <div className="surv-upgrade-head shop-head-row">
                        <span>配置出战阵容 · {activeSquadPreset.name} ({effectiveSquadPets.length}/{maxFollowers})</span>
                        <button type="button" className="lcd-mini-close" onClick={closeSquadEditor}>
                          完成
                        </button>
                      </div>
                      <div className="squad-editor-grid scroll-y">
                        {save.pets.map((p) => {
                          const stg = getGrowthStage(p.level, p.species);
                          const inTeam = activeSquadPreset.petIds.includes(p.id) && !p.isSleeping;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={p.isSleeping}
                              className={`sq-edit-tile ${inTeam ? 'is-in' : ''} ${p.isSleeping ? 'is-sleep' : ''}`}
                              onClick={() => togglePetInActiveSquad(p.id)}
                            >
                              <img
                                src={SPECIES_CATALOG[p.species].stageSprites[stg].static}
                                alt={p.name}
                                draggable={false}
                              />
                              <strong>{p.name}</strong>
                              <small>{p.isSleeping ? '休眠中(不可出战)' : inTeam ? '✓ 已编入' : `Lv.${p.level}`}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Guardians Preview Bar (Crisp single-row square backpack-style tiles, zero wrapping!) */}
              <div className="pkb-guardians-bar">
                <div className="pkb-guard-head">区域守护者与安全圣地</div>
                <div className="pkb-guard-chain">
                  {regionMeta.guardians.map((sp, i) => (
                    <React.Fragment key={`${sp}_${i}`}>
                      <div
                        className="pkb-guard-tile"
                        title={`区域 ${i + 1} · ${SPECIES_CATALOG[sp].defaultName}`}
                      >
                        <img
                          src={SPECIES_CATALOG[sp].stageSprites.adult.static}
                          alt={SPECIES_CATALOG[sp].defaultName}
                          className="pkb-guard-tile-img"
                          draggable={false}
                        />
                        <span className="pkb-guard-tile-name">{SPECIES_CATALOG[sp].defaultName}</span>
                      </div>
                      {i < 2 && <em className="pkb-guard-arrow">→</em>}
                    </React.Fragment>
                  ))}
                  <div
                    className="pkb-guard-tile is-sanctuary"
                    title="安全区圣地 · 精灵中心 + 商店"
                  >
                    <PixelItemImg src="/sprites/items/potion.png" size={26} />
                    <span className="pkb-guard-tile-name">安全区</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Ready Panel (准备游戏 · 模式 · 难度 · 出发!) */}
            <aside className="pkb-ready-panel">
              <div
                className="pkb-ready-head"
                style={{ backgroundColor: regionMeta.headerColor }}
              >
                <strong>准备游戏</strong>
                <span>{regionMeta.name}</span>
              </div>

              <div className="pkb-ready-body">
                <div className="pkb-sec-lbl">模式</div>
                <div className="pkb-mode-pair">
                  <button
                    type="button"
                    className={`pkb-mode-card ${gameMode === 'story' ? 'is-story-on' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      setGameMode('story');
                    }}
                  >
                    <PixelItemImg src="/sprites/items/poke-ball.png" size={18} />
                    <div>
                      <strong>剧情模式</strong>
                      <small>区域、守护者与圣地</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`pkb-mode-card ${gameMode === 'endless' ? 'is-endless-on' : ''}`}
                    onClick={() => {
                      sound.play('cursor');
                      setGameMode('endless');
                    }}
                  >
                    <PixelItemImg src="/sprites/items/vs-seeker.png" size={18} />
                    <div>
                      <strong>无尽模式</strong>
                      <small>无限宝可梦群与里程碑</small>
                    </div>
                  </button>
                </div>

                <div className="pkb-sec-lbl">难度</div>
                <div className="pkb-diff-list">
                  {DIFFICULTIES.map((d) => {
                    const active = d.id === difficultyId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`pkb-diff-btn ${active ? `is-on diff-${d.id}` : ''}`}
                        onClick={() => {
                          sound.play('cursor');
                          setDifficultyId(d.id);
                        }}
                      >
                        <strong>{d.label}</strong>
                        <small className="pkb-diff-full-desc">{d.badgeText} · {d.desc}</small>
                        <small className="pkb-diff-compact-badge">{d.badgeText}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="pkb-diff-compact-note">
                  {diffMeta.badgeText} · {diffMeta.desc}
                </div>

                <div className="pkb-record-box">
                  <div className="pkb-record-row">
                    <span>当前随从出战</span>
                    <strong>{Math.min(save.pets.length, 3)} 只（局内可随时暂停调整）</strong>
                  </div>
                  <div className="pkb-record-row">
                    <span>通关守护者奖励</span>
                    <strong className="is-gold">+{Math.round(regionMeta.rewardCoins * diffMeta.rewardMult)} 金币 + Boss收服</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="pkb-launch-cta"
                onClick={handleLaunchRun}
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={20} />
                <span>出发！</span>
                <em>回车</em>
              </button>
            </aside>
          </div>
        </div>
      )}

      {/* =====================================================================
          LAYER 3: LIVE 3D COMBAT PIXEL-ART HUD + VIRTUAL 360° JOYSTICK + PAUSE
         ===================================================================== */}
      {phase === 'playing' && (
        <>
          {/* 2D Projected Floating Damage & Enemy Trainer Nameplates */}
          <div className="surv-tags-layer">
            {floatingTags.map((t) => (
              <div
                key={t.id}
                className={`surv-float-tag ${t.isHpBar ? 'is-trainer-tag' : ''}`}
                style={{ left: `${t.sx}%`, top: `${t.sy}%`, color: t.color }}
              >
                <span>{t.text}</span>
                {t.isHpBar && (
                  <div className="tag-hp-track">
                    <div className="tag-hp-fill" style={{ width: `${t.hpPct ?? 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Screen-Perimeter Directional Arrows for Off-Screen Priority Targets (Boss / Knocked-Out Catchable / ★Shiny / Gym Leader!) */}
          {!resultModal && edgeIndicators.length > 0 && (
            <div className="surv-edge-layer" aria-hidden="true">
              {edgeIndicators.map((ind) => (
                <div
                  key={ind.id}
                  className={`surv-edge-pill is-${ind.kind}`}
                  style={{ left: `${ind.sx}%`, top: `${ind.sy}%` }}
                >
                  <span
                    className="edge-arrow"
                    style={{ transform: `rotate(${ind.angleDeg.toFixed(1)}deg)` }}
                  >
                    ▶
                  </span>
                  <PixelItemImg src={ind.icon} size={15} />
                  <strong>{ind.label}</strong>
                  <em>{ind.distM}m</em>
                </div>
              ))}
            </div>
          )}

          {/* Clean Sleek Combat Top HUD (EXP Bar integrated directly into Top-Left Hero Card!) */}
          <div
            className="surv-hud-row is-wide is-no-top-xp"
            style={{
              opacity: prefs.hudOpacity / 100,
              transform: prefs.hudScale !== 100 ? `scale(${prefs.hudScale / 100})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            {/* Top-Left: Protagonist Avatar Card + Full-Width HP Bar + Integrated EXP Bar */}
            <div className="hud-col-left">
              <div className="surv-hero-card">
                <div className="surv-hero-avatar">
                  <img
                    src={activeHeroDef.avatarSprite}
                    alt={activeHeroDef.name}
                    draggable={false}
                  />
                  <em>LV.{hud.runLevel}</em>
                </div>
                <div className="surv-hero-info">
                  <div className="surv-hero-top">
                    <strong>{activeHeroDef.name}</strong>
                    {isSurfing ? (
                      <span className="surv-surf-pill">🌊 水系冲浪</span>
                    ) : hud.boostLeft > 0 ? (
                      <span className="surv-boost-pill">强化 {Math.ceil(hud.boostLeft)}s</span>
                    ) : (
                      <span className="surv-hero-hp-num">{hud.hp}/{hud.maxHp}</span>
                    )}
                  </div>
                  <div className="surv-hero-hp-track">
                    <div
                      className="surv-hero-hp-fill"
                      style={{
                        width: `${hpPct}%`,
                        backgroundColor: hpPct > 35 ? '#48d167' : '#ff4d4d',
                      }}
                    />
                  </div>
                  <div className="surv-hero-xp-track" title={`经验 ${hud.xp}/${hud.xpNeed}`}>
                    <div className="surv-hero-xp-fill" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Top-Center: Rich Neo-Brutalist Pixel Battle Status Deck (Region + Clock + Trainer Tag + Gym Badges!) */}
            <div className="hud-col-center">
              {(() => {
                const activeTag = getActiveTrainerTagDef(meta);
                const badgeCount = (meta.unlockedBadges ?? []).length;
                return (
                  <div className="surv-top-status-deck">
                    <div className="top-deck-wing is-left">
                      <strong>真实地球</strong>
                      <div className="top-deck-sub">
                        <span
                          className="top-weather-chip"
                          style={{ backgroundColor: liveWeather.accentColor }}
                          title={`${liveWeather.summary} · ${liveWeather.buffText}`}
                        >
                          {liveWeather.emoji} {liveWeather.label} {liveWeather.tempC}°C
                        </span>
                        <span className={`top-diff-tag is-${difficultyId}`}>{diffMeta.label}</span>
                      </div>
                    </div>
                    <div className="top-deck-center">
                      <PixelItemImg src="/sprites/items/poke-ball.png" size={16} />
                      <strong>{minStr}</strong>
                      <small>
                        {liveOverlandCity?.name ??
                          activeWorldRun?.cityName ??
                          WORLD_TOWNS_3D.find(
                            (t) => Math.hypot(mapSnapshot.px - t.x, mapSnapshot.pz - t.z) < t.plazaRadius + 6,
                          )?.name ??
                          '野外探索'}
                      </small>
                    </div>
                    <div className="top-deck-wing is-right">
                      <span className="top-trainer-tag" style={{ borderColor: activeTag.color, color: activeTag.color }}>
                        {activeTag.name}
                      </span>
                      <div className="top-badge-mini" title={`已收集 ${badgeCount}/${GYM_BADGE_CATALOG.length} 枚关都道馆徽章`}>
                        <PixelItemImg src="/sprites/items/kings-rock.png" size={12} />
                        <span>徽章 {badgeCount}/{GYM_BADGE_CATALOG.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Top-Right: Clean Icon-Left Pull-Out Handheld Console Buttons */}
            <div className="hud-col-right">
              <div className="surv-right-stats">
                <button
                  type="button"
                  className="surv-top-btn is-lg is-tactics"
                  onClick={() => onOpenPokemonManager('tactics', true)}
                  title="战术终端（可在菜单-设置中查看快捷键）"
                >
                  <PixelItemImg src="/sprites/items/vs-seeker.png" size={15} />
                  <span>战术</span>
                </button>
                <button
                  type="button"
                  className="surv-top-btn is-lg is-care-btn"
                  onClick={() => onOpenPokemonManager('home', true)}
                  title="宝可梦球舱与球盒管理"
                >
                  <PixelItemImg src={activeRoom.ballSprite} size={15} />
                  <span>掌机</span>
                </button>
                <button
                  type="button"
                  className="surv-top-btn is-lg is-gear-btn"
                  onClick={() => onOpenPokemonManager('menu', true)}
                  title="训练家主菜单与按键设置"
                >
                  <PixelItemImg src="/sprites/items/poke-radar.png" size={15} />
                  <span>菜单</span>
                </button>
              </div>
            </div>
          </div>

          {/* Left-Edge RPG Party Status List (Collapsible toggle pill on mobile so 3D viewport stays wide open!) */}
          {!resultModal && (
            <div
              className={`surv-party-list is-centered ${mobilePartyOpen ? 'is-mobile-open' : 'is-mobile-collapsed'}`}
              title="拖拽或点击上下箭头调整出战顺序；点击卡片查看详情"
            >
              <button
                type="button"
                className="surv-party-mobile-toggle"
                onClick={() => setMobilePartyOpen((v) => !v)}
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={14} />
                <span>队伍 {followersView.length}</span>
                <em>{mobilePartyOpen ? '▲' : '▼'}</em>
              </button>
              <div className="surv-party-cards-wrap">
              {followersView.map((f, fIdx) => {
                const vitals = hud.followerVitals[f.id] ?? {
                  hp: Math.round((95 + f.level * 28) * (hpPct / 100)),
                  maxHp: 95 + f.level * 28,
                  mp: 100,
                  maxMp: 100,
                };
                const fHpPct = Math.max(0, Math.min(100, Math.round((vitals.hp / Math.max(1, vitals.maxHp)) * 100)));
                const fMpPct = Math.max(0, Math.min(100, Math.round((vitals.mp / Math.max(1, vitals.maxMp)) * 100)));
                const uniqueSkills = Array.from(new Set(f.skills)).slice(0, 4);
                const accentCol = SURVIVOR_SKILLS[f.skills[0]]?.color ?? '#ffe066';
                return (
                  <div
                    key={f.id}
                    draggable
                    onDragStart={(e) => {
                      dragFollowerIdxRef.current = fIdx;
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverFollowerIdx !== fIdx) setDragOverFollowerIdx(fIdx);
                    }}
                    onDragLeave={() => {
                      if (dragOverFollowerIdx === fIdx) setDragOverFollowerIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragFollowerIdxRef.current;
                      dragFollowerIdxRef.current = null;
                      setDragOverFollowerIdx(null);
                      if (from !== null && from !== fIdx) {
                        reorderBattleFollowers(from, fIdx);
                      }
                    }}
                    onDragEnd={() => {
                      dragFollowerIdxRef.current = null;
                      setDragOverFollowerIdx(null);
                    }}
                    className={`surv-party-card ${dragOverFollowerIdx === fIdx ? 'is-drag-over' : ''}`}
                    style={{ '--unit-accent': accentCol } as React.CSSProperties}
                    title={`${f.name} Lv.${f.level} · HP ${vitals.hp}/${vitals.maxHp} · 拖拽或点右侧箭头调序`}
                    onClick={() => {
                      if (f.sourcePetId) {
                        onOpenPokemonManager('party_detail', true, f.sourcePetId);
                      } else {
                        onOpenPokemonManager('tactics', true);
                      }
                    }}
                  >
                    <div className="party-portrait">
                      <TrimmedSpriteImg
                        src={f.sprite}
                        alt={f.name}
                        size={38}
                        fillRatio={0.86}
                      />
                      <em className="party-lv-tag">Lv.{f.level}</em>
                    </div>
                    <div className="party-info">
                      <div className="party-head-line">
                        <strong>{f.name}</strong>
                        <div className="party-skill-icons">
                          {uniqueSkills.map((sid) => {
                            const sk = SURVIVOR_SKILLS[sid];
                            return (
                              <span key={sid} className="party-sk-dot" title={sk.name}>
                                <PixelItemImg src={sk.sprite} size={12} />
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="party-bar-track is-hp">
                        <div
                          className="party-bar-fill is-hp"
                          style={{
                            width: `${fHpPct}%`,
                            backgroundColor: fHpPct > 40 ? '#48d167' : fHpPct > 20 ? '#fcc419' : '#ff5c5c',
                          }}
                        />
                      </div>
                      <div className="party-bar-track is-mp">
                        <div
                          className={`party-bar-fill is-mp ${fMpPct >= 96 ? 'is-ready' : ''}`}
                          style={{ width: `${fMpPct}%` }}
                        />
                      </div>
                    </div>
                    {followersView.length > 1 && (
                      <div className="party-reorder-col" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="party-reorder-btn"
                          disabled={fIdx === 0}
                          aria-label="上移出战顺序"
                          title="上移顺序"
                          onClick={() => reorderBattleFollowers(fIdx, fIdx - 1)}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="party-reorder-btn"
                          disabled={fIdx === followersView.length - 1}
                          aria-label="下移出战顺序"
                          title="下移顺序"
                          onClick={() => reorderBattleFollowers(fIdx, fIdx + 1)}
                        >
                          ▼
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Boss HP Bar (Respects Boss Bar Opacity + Remaining HP vs Percentage Preference!) */}
          {hud.bossAliveName && (
            <div
              className="surv-boss-bar is-wide"
              style={{ opacity: prefs.bossBarOpacity / 100 }}
            >
              <div className="surv-boss-bar-head">
                <span>{hud.bossAliveName}</span>
                <em>
                  {prefs.bossHpMode === 'hp'
                    ? `${hud.bossHp.toLocaleString()} / ${hud.bossMaxHp.toLocaleString()}`
                    : `${hud.bossHpPct}%`}
                </em>
              </div>
              <div className="boss-hp-track">
                <div className="boss-hp-fill" style={{ width: `${hud.bossHpPct}%` }} />
              </div>
            </div>
          )}

          {/* In-Run Town Poké Mart Full-Screen Boutique Shop Overlay */}
          {inRunTownShopOpen && (
            <ShopOverlay
              save={save}
              pet={pet}
              closing={false}
              onClose={() => {
                sound.play('cancel');
                setInRunTownShopOpen(false);
                tryRestorePointerLock();
              }}
              onBuyFood={(fid) => onBuyFood?.(fid)}
              onBuyAccessory={(aid) => onBuyAccessory?.(aid)}
              onBuyPokeball={(rid) => onBuyPokeball?.(rid)}
              onPullGacha={(bid) =>
                onPullGacha?.(bid) ?? { ok: false, save, message: '暂不可用' }
              }
              onPullGachaTen={(bid) =>
                onPullGachaTen?.(bid) ?? { ok: false, save, results: [], message: '暂不可用' }
              }
              onUpdatePetConfig={onUpdatePetConfig}
            />
          )}

          {/* Optional Live FPS Counter & Kill Combo Streak Badges + Neo-Brutalist Pixel Minimap & Big World Map */}
          {prefs.showFps && (
            <div className="surv-fps-badge">{hud.fps} FPS</div>
          )}
          {prefs.showComboCounter && hud.combo >= 1 && (
            <div className="surv-combo-badge">
              <em>连续击败数</em>
              <strong>×{hud.combo}</strong>
            </div>
          )}
          {!resultModal && (
            <WorldMapHud
              biome={selectedBiome}
              regionName={regionMeta.name}
              snapshot={mapSnapshot}
              onToggleExpand={toggleWorldMap}
            />
          )}

          {/* Interactive World Foraging / Mining / Signpost Prompt Pill */}
          {nearbyInteract && !nearbyKoTarget && !externalPaused && !levelChoices && !shopOpen && !resultModal && (
            <button
              type="button"
              className="surv-interact-pill"
              {...bindMultiTouchAction(() => triggerInteractRef.current?.())}
            >
              <PixelItemImg src={nearbyInteract.icon} size={20} />
              <span>
                {nearbyInteract.label}
                {nearbyInteract.maxHp > 1 ? ` (${nearbyInteract.hp}/${nearbyInteract.maxHp})` : ''}
              </span>
              <span className="surv-interact-key">E</span>
            </button>
          )}

          {/* Mobile-Only Floating Dynamic Left-Area 360° Joystick (Hidden when idle & hidden on Desktop!) */}
          {!externalPaused && !levelChoices && !shopOpen && !resultModal && !captureOffer && (
            <div
              className="vpad-touch-zone"
              aria-label="左侧触控移动区域"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (vPadPointerRef.current !== null) return;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                vPadPointerRef.current = e.pointerId;
                startVirtualPad(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
              }}
              onPointerMove={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  e.stopPropagation();
                  updateVirtualPad(e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  e.stopPropagation();
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {}
                  resetVirtualPad();
                }
              }}
              onPointerCancel={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  resetVirtualPad();
                }
              }}
              onLostPointerCapture={(e) => {
                if (vPadPointerRef.current === e.pointerId) {
                  resetVirtualPad();
                }
              }}
            >
              {vPad.active && (
                <div
                  className="vpad-360 is-active is-floating"
                  style={{
                    left: `${vPad.originX}px`,
                    top: `${vPad.originY}px`,
                  }}
                >
                  <span className="omni-cross-v" aria-hidden="true" />
                  <span className="omni-cross-h" aria-hidden="true" />
                  <span className="omni-diag omni-ul" aria-hidden="true" />
                  <span className="omni-diag omni-ur" aria-hidden="true" />
                  <span className="omni-diag omni-dl" aria-hidden="true" />
                  <span className="omni-diag omni-dr" aria-hidden="true" />
                  <div
                    className="omni-puck"
                    style={{ transform: `translate(${vPad.x}px, ${vPad.y}px)` }}
                  >
                    <span className="omni-puck-dimple" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proximity Knocked-Out Monster Capture Bar (Walk near downed Boss / Rare / Shiny on the grass!) */}
          {nearbyKoTarget && !externalPaused && !levelChoices && !shopOpen && !resultModal && (
            <div className="surv-ko-prompt">
              <div className="ko-prompt-left">
                <div className="ko-prompt-thumb">
                  <TrimmedSpriteImg src={nearbyKoTarget.sprite} alt={nearbyKoTarget.name} size={46} fillRatio={0.86} />
                </div>
                <div className="ko-prompt-meta">
                  <div className="ko-prompt-title">
                    {nearbyKoTarget.isShiny && <span className="ko-badge is-shiny">★异色</span>}
                    {MONSTER_QUALITY_META[nearbyKoTarget.quality].label && (
                      <span
                        className="ko-badge"
                        style={{ backgroundColor: MONSTER_QUALITY_META[nearbyKoTarget.quality].color }}
                      >
                        {MONSTER_QUALITY_META[nearbyKoTarget.quality].label}
                      </span>
                    )}
                    <strong>{nearbyKoTarget.name}</strong>
                    <em>Lv.{nearbyKoTarget.level}</em>
                  </div>
                  <small>
                    倒地昏迷 · 身高 {nearbyKoTarget.heightM}m · 体重 {nearbyKoTarget.weightKg}kg
                  </small>
                </div>
              </div>
              <div className="ko-prompt-actions">
                <button
                  type="button"
                  className="ko-btn is-catch"
                  {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('capture_ko', nearbyKoTarget.enemyId))}
                >
                  <PixelItemImg
                    src={nearbyKoTarget.isBoss ? '/sprites/items/master-ball.png' : '/sprites/items/ultra-ball.png'}
                    size={18}
                  />
                  <span>投球收服</span>
                  <span className="surv-interact-key">E</span>
                </button>
                <button
                  type="button"
                  className="ko-btn is-pass"
                  {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('dismiss_ko', nearbyKoTarget.enemyId))}
                >
                  <PixelIcon name="paw" size={12} />
                  <span>放走</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom-Right MOBA-Style Radial Action Wheel (True Multi-Touch: Works simultaneously with Left Joystick!) */}
          {!externalPaused && !levelChoices && !shopOpen && !resultModal && !captureOffer && (
            <div className="surv-moba-wheel">
              {/* Outer Left Satellite (58x58): Full-MP Team Salvo */}
              <button
                type="button"
                className={`moba-btn is-aux-jump is-salvo ${hud.actionCds.salvo > 0 ? 'is-cd' : ''}`}
                disabled={hud.actionCds.salvo > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('salvo'), hud.actionCds.salvo > 0)}
                title="全队瞬间满蓝，同步齐射招牌绝招！"
              >
                <PixelItemImg src="/sprites/items/vs-seeker.png" size={26} />
                <span>齐射</span>
                {hud.actionCds.salvo > 0 && (
                  <em className="moba-badge">{Math.ceil(hud.actionCds.salvo)}s</em>
                )}
              </button>

              {/* Arc Satellite 1 (0° Left): Throw Poké Ball */}
              <button
                type="button"
                className={`moba-btn is-sat is-sat-0 is-ball ${hud.actionCds.ball > 0 ? 'is-cd' : ''} ${nearbyKoTarget ? 'is-pulse' : ''}`}
                disabled={hud.actionCds.ball > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('ball'), hud.actionCds.ball > 0)}
                title="向附近倒地/残血/异色野生宝可梦投掷精灵球收服！"
              >
                <PixelItemImg src="/sprites/items/poke-ball.png" size={26} />
                <span>投球</span>
                {hud.actionCds.ball > 0 && (
                  <em className="moba-badge">{Math.ceil(hud.actionCds.ball)}s</em>
                )}
              </button>

              {/* Arc Satellite 2 (45° Upper-Left): Heal Potion */}
              <button
                type="button"
                className={`moba-btn is-sat is-sat-45 is-heal ${hud.actionCds.heal > 0 || hud.healCharges <= 0 ? 'is-cd' : ''}`}
                disabled={hud.actionCds.heal > 0 || hud.healCharges <= 0}
                {...bindMultiTouchAction(
                  () => triggerBattleActionRef.current?.('heal'),
                  hud.actionCds.heal > 0 || hud.healCharges <= 0,
                )}
                title="使用好伤药立即回复全队 45% 生命值"
              >
                <PixelItemImg src="/sprites/items/super-potion.png" size={26} />
                <span>伤药</span>
                <em className="moba-badge">
                  {hud.actionCds.heal > 0 ? `${Math.ceil(hud.actionCds.heal)}s` : `×${hud.healCharges}`}
                </em>
              </button>

              {/* Arc Satellite 3 (90° Top): Team Overdrive Boost */}
              <button
                type="button"
                className={`moba-btn is-sat is-sat-90 is-boost ${hud.actionCds.boost > 0 ? 'is-cd' : ''} ${hud.boostLeft > 0 ? 'is-active' : ''}`}
                disabled={hud.actionCds.boost > 0}
                {...bindMultiTouchAction(() => triggerBattleActionRef.current?.('boost'), hud.actionCds.boost > 0)}
                title="激活 8 秒力量强化：全队攻击 +55%、技能充能大幅加速"
              >
                <PixelItemImg src="/sprites/items/rare-candy.png" size={26} />
                <span>强化</span>
                {(hud.boostLeft > 0 || hud.actionCds.boost > 0) && (
                  <em className="moba-badge">
                    {hud.boostLeft > 0 ? `${Math.ceil(hud.boostLeft)}s` : `${Math.ceil(hud.actionCds.boost)}s`}
                  </em>
                )}
              </button>

              {/* Primary Corner Main Button (80x80): 3D Jump */}
              <button
                type="button"
                className="moba-btn is-primary is-jump-main"
                {...bindMultiTouchAction(() => {
                  jumpQueuedRef.current = true;
                })}
                title="3D 跳跃：翻越阶梯崖壁或躲避弹幕"
              >
                <PixelIcon name="arrow_up" size={28} />
                <span>跳跃</span>
              </button>
            </div>
          )}

          {/* Cinematic Close-Up Poké Ball Capture Cutscene Overlay (Throw -> Crimson Absorb -> 3 Wobbles -> Starburst!) */}
          {/* Pure 3D Close-Up Capture Cinema Bars (Zero popup box! After 3D ball catches, opens our REAL MAIN HandheldConsole!) */}
          {captureCutscene && !resultModal && (
            <div className={`surv-capture-cutscene is-phase-${captureCutscene.phase}`}>
              <div className="cap-letterbox is-top" />
              <div className="cap-cinema-subtitle">
                {captureCutscene.phase === 'throw' && `去吧！精灵球！瞄准 ${captureCutscene.name}！`}
                {captureCutscene.phase === 'absorb' && `命中！正在将 ${captureCutscene.name} 收入球中...`}
                {captureCutscene.phase === 'wobble' &&
                  `摇晃中 ${'● '.repeat(Math.max(1, captureCutscene.wobbleCount))}${'○ '.repeat(Math.max(0, 3 - captureCutscene.wobbleCount))}`}
                {captureCutscene.phase === 'caught' && `★ 叮咚！成功收服了 ${captureCutscene.name}！正在同步图鉴...`}
                {captureCutscene.phase === 'escaped' && '糟糕！野生宝可梦挣脱了精灵球！'}
              </div>
              <div className="cap-letterbox is-bottom" />
            </div>
          )}

          {/* Event Toast Banner — Positioned cleanly at TOP below Status Deck (Zero bottom clutter!) */}
          {bannerMsg && !externalPaused && !levelChoices && !shopOpen && !resultModal && !captureOffer && (
            <div className={`surv-event-banner is-wide is-top-banner ${!prefs.largeBanners ? 'is-compact' : ''}`}>
              {bannerMsg}
            </div>
          )}

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
      )}

      {/* Arcade Diagonal Shutter Transition Flash when Launching 3D Adventure! */}
      {launchFlashSeq > 0 && (
        <div key={launchFlashSeq} className="world3d-launch-wipe" aria-hidden="true" />
      )}
    </div>
  );
};
