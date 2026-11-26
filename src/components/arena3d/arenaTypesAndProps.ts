import React from 'react';
import * as THREE from 'three';
import type { AppLang } from '../../data/i18n';
import type { MetaProgressState } from '../../data/metaProgression';
import type { Pmd8DirSheet3D } from '../../data/pmdSprites3D';
import type { LiveRunTacticsBridge, SafeZone3D, SurvivorSkillId } from '../../data/survivorsTactics';
import type { AnimatedSpriteSheet3D, BiomeId } from '../../data/worldTextures3D';
import type { AccessoryId, FoodId, GachaBoxId, GamePrefs, GameSave, LcdMode, PetRecord, PetSkinId, RoomThemeId, SpeciesId, TrainerProfile } from '../../types/pet';
import type { GachaOutcome, GachaTenOutcome, SurvivorsResultPayload } from '../../utils/petEngine';
import type { WorldMapData } from '../WorldMapHud';

// Shared bottom-anchored unit quad (y: 0 -> 1) so EVERY standing character, Pokémon, tree & flora prop
// stands upright as a cylindrical Y-billboard with authentic 3D top-down foreshortening (压缩感) and feet locked to the ground!
export const UPRIGHT_QUAD_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0, 0.5, 0);
  return g;
})();
export const UNIT_SHADOW_GEO = new THREE.CircleGeometry(1, 14);
export const SHARED_TREE_SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x0e1c10,
  transparent: true,
  opacity: 0.36,
});
export const SHARED_ENTITY_SHADOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x101c12,
  transparent: true,
  opacity: 0.45,
});
export const MAX_CAM_PITCH = 1.48; // ~84.8° (near top-down, strictly < 90° so view compresses naturally without flipping!)
export const BILLBOARD_PITCH_TILT = 0.18; // Gentle 18% tilt so 85° top-down yields crisp ~65% vertical compression without disappearing!

export type MonsterQuality = 'normal' | 'uncommon' | 'elite' | 'epic';
export const MONSTER_QUALITY_META: Record<
  MonsterQuality,
  { label: string; color: string; hex: number; hpMult: number; dmgMult: number; scaleMult: number; lootMult: number }
> = {
  normal: { label: '', color: '#ffffff', hex: 0xffffff, hpMult: 1.0, dmgMult: 1.0, scaleMult: 1.0, lootMult: 1.0 },
  uncommon: { label: '精良', color: '#51cf66', hex: 0x51cf66, hpMult: 1.55, dmgMult: 1.15, scaleMult: 1.12, lootMult: 1.8 },
  elite: { label: '稀有', color: '#748ffc', hex: 0x748ffc, hpMult: 2.55, dmgMult: 1.32, scaleMult: 1.24, lootMult: 3.0 },
  epic: { label: '史诗', color: '#ffd43b', hex: 0xffd43b, hpMult: 4.1, dmgMult: 1.48, scaleMult: 1.38, lootMult: 5.0 },
};

export function rollMonsterQuality(elapsedSec: number): MonsterQuality {
  const r = Math.random();
  const epicChance = Math.min(0.055, 0.02 + elapsedSec * 0.00018);
  const eliteChance = Math.min(0.14, 0.075 + elapsedSec * 0.00035);
  const uncommonChance = 0.17;
  if (r < epicChance) return 'epic';
  if (r < epicChance + eliteChance) return 'elite';
  if (r < epicChance + eliteChance + uncommonChance) return 'uncommon';
  return 'normal';
}

export interface Survivors3DArenaProps {
  save: GameSave;
  pet: PetRecord;
  analogVecRef: React.MutableRefObject<{ x: number; y: number }>;
  externalPaused?: boolean;
  onFinish: (petId: string, payload: SurvivorsResultPayload, returnToRoom?: boolean) => void;
  onHealParty: () => void;
  onSpendCoinsInRun: (cost: number) => boolean;
  onCaptureBoss?: (species: SpeciesId, level: number, skin?: PetSkinId) => void;
  onShowCaptureInHandheld?: (
    info: import('../../types/pet').CaptureRevealPayload,
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
  onToggleBgm?: () => void;
}

export interface ActiveFollower {
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

export interface Enemy3D {
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
  isStreetDuel?: boolean;
  trainerSprite?: string;
  trainerName?: string;
  trainerWalkFrames?: Record<string, THREE.CanvasTexture>;
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

export interface ActiveCapture3D {
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

export interface Projectile3D {
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

export interface Loot3D {
  x: number;
  z: number;
  kind: 'xp' | 'coin' | 'berry' | 'magnet';
  value: number;
  phase: number;
  mesh: THREE.Mesh;
}

export interface Vfx3D {
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

export interface FollowerReportRow {
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

export interface RunResultSummary {
  payload: SurvivorsResultPayload;
  totalDamage: number;
  dps: number;
  trainersDefeated: number;
  capturedBoss: { species: SpeciesId; name: string; level: number } | null;
  squadReport: FollowerReportRow[];
}

export interface FloatingTag2D {
  id: number;
  sx: number;
  sy: number;
  text: string;
  color: string;
  isHpBar?: boolean;
  hpPct?: number;
}

export interface LevelChoice {
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

export type ArenaScreenPhase = 'hub' | 'map_select' | 'world_map' | 'playing';

export const MAX_FOLLOWERS = 6;

/** Builds a textured 3D Roadside Safe Zone (Pixel Cobblestone Plaza + Emerald Barrier + PokeCenter + PokeMart) */
export function createSafeZone3DMesh(zone: SafeZone3D, plazaTex: THREE.CanvasTexture): {
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
export function createLushTreeSprite3D(
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


/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ArenaSimState3D {
  px: number;
  py: number;
  pz: number;
  vy: number;
  hp: number;
  maxHp: number;
  elapsed: number;
  invuln: number;
  facingAngle: number;
  walkDist: number;
  enemies: Enemy3D[];
  followers: ActiveFollower[];
  projectiles: Projectile3D[];
  loots: Loot3D[];
  vfxs: Vfx3D[];
  activeCaptures: ActiveCapture3D[];
  dmgPops: { id: number; wx: number; wy: number; wz: number; text: string; color: string; life: number }[];
  timers: Record<string, number>;
  lastSeamlessBiome?: BiomeId;
  [key: string]: any;
}

export interface ArenaSharedCtx {
  save: GameSave;
  pet: PetRecord;
  prefs: GamePrefs;
  meta: MetaProgressState;
  trainerProfile: TrainerProfile;
  profileDraft: TrainerProfile;
  lang: AppLang;
  selectedBiome: BiomeId;
  sim: ArenaSimState3D;
  simRef: { current: ArenaSimState3D | null };
  effectiveSquadPets: PetRecord[];
  squadPresets: { id: string; name: string; petIds: string[] }[];
  followersView: {
    id: string;
    name: string;
    species: SpeciesId;
    level: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    skills: SurvivorSkillId[];
    skin?: PetSkinId;
    isShiny?: boolean;
    [key: string]: any;
  }[];
  nearbyZones: SafeZone3D[];
  floatingTags: FloatingTag2D[];
  levelChoices: LevelChoice[] | null;
  resultSummary: RunResultSummary | null;
  onUpdateMeta?: (updater: (prev: MetaProgressState) => MetaProgressState, coinDelta?: number) => void;
  setProfileDraft: (updater: TrainerProfile | ((prev: TrainerProfile) => TrainerProfile)) => void;
  triggerBattleActionRef: { current: ((kind: "ball" | "heal" | "boost" | "salvo" | "capture_ko" | "dismiss_ko", enemyId?: number) => void) | null };
  hudSyncState: { acc: number };
  edgeIndicators: { id: number; sx: number; sy: number; angleDeg: number; label: string; distM: number; kind: "boss" | "shiny" | "ko" | "trainer"; icon: string }[];
  regionMeta: { id: BiomeId; name: string; subtitle: string; wildPool: SpeciesId[]; guardians: SpeciesId[]; bossSpecies: SpeciesId; [k: string]: any };
  nearbyKoTarget: { id: number; name: string; species: SpeciesId; quality: MonsterQuality; isShiny?: boolean; [k: string]: any } | null;
  captureOffer: { species: SpeciesId; name: string; level: number; [k: string]: any } | null;
  setMobilePartyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRerollsLeft: React.Dispatch<React.SetStateAction<number>>;
  setBanishMode: React.Dispatch<React.SetStateAction<boolean>>;
  setRunNonce: React.Dispatch<React.SetStateAction<number>>;
  pickTargetForFollower: (f: ActiveFollower, enemies: Enemy3D[], priority: any) => Enemy3D[];
  setHud: (updater: any) => void;
  setCaptureCutscene: (updater: any) => void;
  closeHubModal: () => void;
  [key: string]: any;
}
