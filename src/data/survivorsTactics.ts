import type { PokemonElement, SpeciesId } from '../types/pet';
import type { BiomeId } from './worldTextures3D';

export type SurvivorSkillId =
  | 'thunderbolt'
  | 'fireball'
  | 'razor_leaf'
  | 'water_pulse'
  | 'shadow_star'
  | 'dragon_pulse'
  | 'swift_volley'
  | 'heal_bell';

export interface SurvivorSkillMeta {
  id: SurvivorSkillId;
  name: string;
  tag: string;
  desc: string;
  color: string;
  hex: number;
  sprite: string;
  baseCd: number;
  powerMult: number;
}

export const SURVIVOR_SKILLS: Record<SurvivorSkillId, SurvivorSkillMeta> = {
  thunderbolt: {
    id: 'thunderbolt',
    name: '十万伏特',
    tag: '落雷',
    desc: '召唤天降金色落雷精准轰击目标',
    color: '#f5b700',
    hex: 0xffe066,
    sprite: '/sprites/skills/thunderbolt.png',
    baseCd: 1.55,
    powerMult: 1.32,
  },
  fireball: {
    id: 'fireball',
    name: '追踪火球',
    tag: '追踪',
    desc: '齐射高速穿透火球轰击敌群',
    color: '#ff5924',
    hex: 0xff5924,
    sprite: '/sprites/skills/fireball.png',
    baseCd: 1.0,
    powerMult: 1.05,
  },
  razor_leaf: {
    id: 'razor_leaf',
    name: '飞叶护盾',
    tag: '环绕',
    desc: '生成 3D 旋转飞叶刀阵护体切割近敌',
    color: '#40c057',
    hex: 0x40c057,
    sprite: '/sprites/skills/razor_leaf.png',
    baseCd: 1.4,
    powerMult: 0.85,
  },
  water_pulse: {
    id: 'water_pulse',
    name: '水之波动',
    tag: '击退',
    desc: '释放 360° 蓝色冲击水环清场并击退敌人',
    color: '#339af0',
    hex: 0x4dabf7,
    sprite: '/sprites/skills/water_pulse.png',
    baseCd: 2.05,
    powerMult: 1.0,
  },
  shadow_star: {
    id: 'shadow_star',
    name: '暗影星芒',
    tag: '散射',
    desc: '向四周发射多向穿透幽灵星弹幕',
    color: '#ae3ec9',
    hex: 0xda77f2,
    sprite: '/sprites/skills/shadow_star.png',
    baseCd: 1.45,
    powerMult: 0.82,
  },
  dragon_pulse: {
    id: 'dragon_pulse',
    name: '龙之脉冲',
    tag: '重炮',
    desc: '发射巨型穿透龙息弹重创 Boss 与训练师',
    color: '#5c7cfa',
    hex: 0x5c7cfa,
    sprite: '/sprites/skills/dragon_pulse.png',
    baseCd: 1.65,
    powerMult: 1.48,
  },
  swift_volley: {
    id: 'swift_volley',
    name: '电光连射',
    tag: '速射',
    desc: '极速冷却双发星弹持续压制火力',
    color: '#ff922b',
    hex: 0xffa94d,
    sprite: '/sprites/skills/swift_volley.png',
    baseCd: 0.68,
    powerMult: 0.72,
  },
  heal_bell: {
    id: 'heal_bell',
    name: '治愈铃声',
    tag: '辅助',
    desc: '周期回复主角血量并释放翠绿震退光环',
    color: '#20c997',
    hex: 0x63e6be,
    sprite: '/sprites/skills/heal_bell.png',
    baseCd: 3.4,
    powerMult: 0.65,
  },
};

export const ALL_SURVIVOR_SKILL_IDS = Object.keys(SURVIVOR_SKILLS) as SurvivorSkillId[];

export function getDefaultSkillsForElement(
  element: PokemonElement,
): [SurvivorSkillId, SurvivorSkillId, SurvivorSkillId, SurvivorSkillId] {
  switch (element) {
    case 'electric':
      return ['thunderbolt', 'swift_volley', 'dragon_pulse', 'heal_bell'];
    case 'fire':
      return ['fireball', 'dragon_pulse', 'swift_volley', 'shadow_star'];
    case 'grass':
      return ['razor_leaf', 'heal_bell', 'water_pulse', 'swift_volley'];
    case 'water':
      return ['water_pulse', 'swift_volley', 'heal_bell', 'dragon_pulse'];
    case 'ghost':
    case 'psychic':
      return ['shadow_star', 'thunderbolt', 'dragon_pulse', 'heal_bell'];
    case 'fairy':
      return ['heal_bell', 'shadow_star', 'swift_volley', 'thunderbolt'];
    case 'dragon':
      return ['dragon_pulse', 'fireball', 'thunderbolt', 'swift_volley'];
    default:
      return ['swift_volley', 'water_pulse', 'fireball', 'heal_bell'];
  }
}

export type TargetPriority = 'nearest' | 'highest_hp' | 'lowest_hp' | 'random';
export type FollowerFormation = 'guard' | 'hunt' | 'vanguard';
export type CastCadenceMode = 'auto' | 'salvo' | 'charged';

export interface TacticalConfig {
  targetPriority: TargetPriority;
  formation: FollowerFormation;
  castMode: CastCadenceMode;
}

export const DEFAULT_TACTICAL_CONFIG: TacticalConfig = {
  targetPriority: 'nearest',
  formation: 'guard',
  castMode: 'auto',
};

export const TARGET_PRIORITY_OPTIONS: { id: TargetPriority; label: string; desc: string }[] = [
  { id: 'nearest', label: '就近索敌', desc: '优先攻击离主角最近的威胁' },
  { id: 'highest_hp', label: '集火精英', desc: '优先锁定 Boss 与敌方训练师' },
  { id: 'lowest_hp', label: '残血收割', desc: '优先补刀低血量目标快速爆经验' },
  { id: 'random', label: '全图压制', desc: '随机覆盖周围敌群扩大清怪面' },
];

export const FORMATION_OPTIONS: { id: FollowerFormation; label: string; desc: string }[] = [
  { id: 'guard', label: '自由随行', desc: '在主角周围自由活动，遇敌自主走位迎战' },
  { id: 'hunt', label: '自主追击', desc: '大范围主动巡猎敌群，激进追击与拉扯' },
  { id: 'vanguard', label: '先锋开路', desc: '在主角前方巡逻并主动拦截迎面敌人' },
];

export const CAST_MODE_OPTIONS: { id: CastCadenceMode; label: string; desc: string }[] = [
  { id: 'auto', label: '自动连发', desc: '各自冷却好即刻施放，火力连绵不绝' },
  { id: 'salvo', label: '齐射爆发', desc: '全队同步齐射，连携伤害 +28%！' },
  { id: 'charged', label: '蓄力重炮', desc: '冷却 +30%，弹幕更大且威力 +42%！' },
];

// =========================================================================
// 3D WORLD SECTOR SAFE ZONES & ROLLING KANTO TERRAIN HEIGHT (Shared + Pure)
// =========================================================================
export const WORLD_SECTOR_SIZE = 76;
export const SAFE_ZONE_3D_RADIUS = 10.5;

export interface SafeZone3D {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export function getSafeZone3DForSector(sx: number, sz: number): SafeZone3D {
  // Initial welcoming 3D Safe Zone visible ahead-right from spawn (0, 0) at (20, -16)!
  if (sx === 0 && sz === 0) {
    return { id: 'sz3d_0_0', x: 20, z: -16, radius: SAFE_ZONE_3D_RADIUS };
  }
  const hash = Math.abs(sx * 92821 + sz * 68917);
  const ox = ((hash % 24) - 12);
  const oz = (((hash >> 4) % 24) - 12);
  return {
    id: `sz3d_${sx}_${sz}`,
    x: sx * WORLD_SECTOR_SIZE + ox,
    z: sz * WORLD_SECTOR_SIZE + oz,
    radius: SAFE_ZONE_3D_RADIUS,
  };
}

export function getNearbySafeZones3D(wx: number, wz: number): SafeZone3D[] {
  const csx = Math.round(wx / WORLD_SECTOR_SIZE);
  const csz = Math.round(wz / WORLD_SECTOR_SIZE);
  const out: SafeZone3D[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      out.push(getSafeZone3DForSector(csx + dx, csz + dz));
    }
  }
  return out;
}

export const TERRACE_CELL = 3.2;
export const TERRACE_STEP_H = 2.0;

/** Smoothly curved organic terraced elevation (broad grand hillsides!) */
export function getTerraceTier3D(wx: number, wz: number): number {
  const h = getTerrainHeight3D(wx, wz);
  return Math.round(h / TERRACE_STEP_H);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2D(ix: number, iz: number): number {
  // True 32-bit Murmur-style integer hash via Math.imul (strictly uniform [0, 1) — zero float overflow!)
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  // C2-continuous quintic interpolation (eliminates ridge creases & lumpy grid artifacts!)
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/**
 * Dramatic Undulating Rolling Hills & Sweeping Sandstone Terraces:
 * - Rich medium-broad C2-continuous rolling hills (31m primary hills + 16m sunlit knolls + rhythmic ridge waves)
 * - Unmistakable vertical elevation relief right from spawn (-4.6m lush valleys to +12.0m terraced hilltops!)
 * - Upper hillsides slice into crisp 2.0m horizontal sandstone cliff ledges you can scale with Jump
 */
/**
 * Multi-Channel Organic Procedural Geography (Minecraft 1.18+ Continentalness + Ridged Mountains + Domain-Warped Basins):
 * - Rotated 4-octave C2-continuous FBM with Inigo Quilez domain warping -> ZERO circular discs, ZERO grid artifacts!
 * - Organic irregular lakes, coves, peninsulas & winding bays (~16% water)
 * - Gentle rolling plains & gradual hills (~60% traversable meadow/hills)
 * - Sweeping mountain ranges & highland ridges (~24% scenic mountains up to +13.5m)
 */
export const WATER_LEVEL_3D = 0.0;

// Rotated octave matrix (cos/sin of ~37 deg) eliminates all axis-aligned noise artifacts
const OCT_COS = 0.8;
const OCT_SIN = 0.6;

function fbm2D(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = x;
  let pz = z;
  for (let i = 0; i < octaves; i++) {
    sum += (valueNoise2D(px, pz) * 2.0 - 1.0) * amp; // zero-centered [-1, 1]
    norm += amp;
    const nx = (px * OCT_COS - pz * OCT_SIN) * 2.03 + 11.7;
    const nz = (px * OCT_SIN + pz * OCT_COS) * 2.03 - 7.3;
    px = nx;
    pz = nz;
    amp *= 0.5;
  }
  return sum / norm;
}

function ridgedFbm2D(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.55;
  let norm = 0;
  let px = x;
  let pz = z;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(px, pz) * 2.0 - 1.0; // [-1, 1]
    const ridge = 1.0 - Math.abs(n); // [0, 1], sharp along zero-crossings
    sum += ridge * ridge * amp;
    norm += amp;
    const nx = (px * OCT_COS - pz * OCT_SIN) * 2.05 - 5.1;
    const nz = (px * OCT_SIN + pz * OCT_COS) * 2.05 + 13.4;
    px = nx;
    pz = nz;
    amp *= 0.48;
  }
  return sum / norm; // [0, 1]
}

export function getTerrainHeight3D(wx: number, wz: number): number {
  // 1. Inigo Quilez organic domain warping so shorelines, valleys & ridges curve naturally!
  const qx = fbm2D(wx * 0.011 + 3.1, wz * 0.011 - 2.4, 3) * 26.0;
  const qz = fbm2D(wx * 0.011 - 7.8, wz * 0.011 + 5.2, 3) * 26.0;
  const sx = wx + qx;
  const sz = wz + qz;

  // 2. Channel A: Macro Continentalness (organic lake basins -> plains -> highlands)
  const cont = fbm2D(sx * 0.013 + 12.4, sz * 0.013 - 8.7, 4) * 2.1;

  // 3. Channel B: Gentle Rolling Hills & Micro Undulation
  const hills = fbm2D(sx * 0.025 - 4.3, sz * 0.025 + 19.1, 3) * 1.6;

  // 4. Channel C: Ridged Mountain Chains (only rises smoothly in mountain belts!)
  const ridge = ridgedFbm2D(sx * 0.014 + 23.0, sz * 0.014 - 14.5, 4);

  // Smooth spawn sanctuary (radius ~22m around origin stays dry welcoming rolling meadow)
  const spawnDist = Math.hypot(wx, wz);
  const spawnDry = 1.0 - smoothstep(10.0, 24.0, spawnDist);

  // Calibrated natural geographic distribution:
  // ~17% organic irregular lakes, coves & bays (-2.5m .. 0.0m)
  // ~49% gentle walkable emerald plains & gradual hills (+0.2m .. +5.2m)
  // ~34% scenic sweeping mountain ranges & ridges (+5.2m .. +13.2m)
  const lakeMask = 1.0 - smoothstep(-0.68, -0.32, cont);
  const mountainMask = smoothstep(0.22, 0.72, cont);

  let elev =
    1.65 +
    cont * 2.6 +
    hills * 0.95 +
    mountainMask * (ridge * 6.8 + 1.2) -
    lakeMask * 2.4;

  // Softly floor lakebed depth around -2.5m so shorelines stay natural & gradual
  if (elev < 0) elev = Math.max(-2.5, elev * 0.65);

  if (spawnDry > 0) {
    const gentleMeadow = 1.15 + hills * 0.42;
    elev = elev * (1.0 - spawnDry) + Math.max(elev, gentleMeadow) * spawnDry;
  }

  return elev;
}

/** Deterministically discover distinct organic lake centers from the live procedural heightfield! */
function discoverOrganicLakes3D(): { cx: number; cz: number; radius: number }[] {
  const found: { cx: number; cz: number; radius: number }[] = [];
  const step = 12;
  for (let gz = -96; gz <= 96; gz += step) {
    for (let gx = -96; gx <= 96; gx += step) {
      if (Math.hypot(gx, gz) < 22) continue;
      if (getTerrainHeight3D(gx, gz) < WATER_LEVEL_3D - 0.55) {
        if (found.every((f) => Math.hypot(f.cx - gx, f.cz - gz) > 38)) {
          found.push({ cx: gx, cz: gz, radius: 14 });
          if (found.length >= 6) return found;
        }
      }
    }
  }
  return found.length > 0 ? found : [{ cx: -42, cz: -36, radius: 14 }];
}

export const LAKE_BASINS_3D: { cx: number; cz: number; radius: number }[] = discoverOrganicLakes3D();

/** Checks if a world point lies inside natural procedural lake/river water */
export function isInsideLake3D(wx: number, wz: number): boolean {
  return getTerrainHeight3D(wx, wz) < WATER_LEVEL_3D;
}

export type SurvivorsGameMode = 'story' | 'endless';
export type DifficultyId = 'normal' | 'hard' | 'nightmare';

export interface DifficultyMeta {
  id: DifficultyId;
  label: string;
  rewardMult: number;
  enemyHpMult: number;
  enemyDmgMult: number;
  desc: string;
  badgeText: string;
}

export const DIFFICULTIES: DifficultyMeta[] = [
  {
    id: 'normal',
    label: '普通',
    rewardMult: 1.0,
    enemyHpMult: 1.0,
    enemyDmgMult: 1.0,
    desc: '标准讨伐节奏 · 2分钟起迎战守护者',
    badgeText: '金币经验 ×1',
  },
  {
    id: 'hard',
    label: '困难',
    rewardMult: 1.75,
    enemyHpMult: 1.85,
    enemyDmgMult: 1.45,
    desc: '敌人血量 +85% · 精英与弹幕更密集',
    badgeText: '金币经验 ×1.75',
  },
  {
    id: 'nightmare',
    label: '噩梦',
    rewardMult: 2.5,
    enemyHpMult: 3.0,
    enemyDmgMult: 1.95,
    desc: '敌人血量 +200% · 极限高压试炼',
    badgeText: '金币经验 ×2.5',
  },
];

export interface MapRegionMeta {
  id: BiomeId;
  name: string;
  types: { label: string; color: string }[];
  desc: string;
  headerColor: string;
  targetSec: number;
  wildPool: SpeciesId[];
  guardians: [SpeciesId, SpeciesId, SpeciesId];
  bossSpecies: SpeciesId;
  bossName: string;
  bossTrainerKey: string;
  bossTrainerName: string;
  rewardCoins: number;
}

export const MAP_REGIONS: MapRegionMeta[] = [
  {
    id: 'verdant_forest',
    name: '青翠森林',
    types: [
      { label: '草', color: '#40c057' },
      { label: '虫', color: '#82c91e' },
      { label: '一般', color: '#adb5bd' },
      { label: '飞行', color: '#74c0fc' },
    ],
    desc: '一片生机盎然的茂密阶梯峡谷森林，盘踞着守护森林圣地的野生宝可梦。',
    headerColor: '#37a84f',
    targetSec: 120,
    wildPool: ['bulbasaur', 'caterpie', 'weedle', 'oddish', 'pidgey', 'clefairy', 'scyther', 'meowth', 'eevee', 'jigglypuff', 'pikachu', 'rattata', 'spearow', 'nidoranf', 'paras', 'venonat', 'bellsprout', 'farfetchd', 'exeggcute', 'lickitung', 'tangela', 'pinsir'],
    guardians: ['bulbasaur', 'oddish', 'scyther'],
    bossSpecies: 'munchlax',
    bossName: '森林守护者·卡比兽',
    bossTrainerKey: 'tr_erika',
    bossTrainerName: '馆主 莉佳',
    rewardCoins: 100,
  },
  {
    id: 'rocky_desert',
    name: '岩石沙漠',
    types: [
      { label: '岩石', color: '#b08968' },
      { label: '地面', color: '#e09f3e' },
      { label: '火', color: '#f76707' },
    ],
    desc: '层叠红岩台地与炙热沙丘，馆主小刚与强韧的沙暴宝可梦在此布阵。',
    headerColor: '#d97724',
    targetSec: 150,
    wildPool: ['geodude', 'sandshrew', 'diglett', 'onix', 'cubone', 'rhyhorn', 'ponyta', 'machop', 'growlithe', 'vulpix', 'charmander', 'ekans', 'mankey', 'doduo', 'hitmonlee', 'hitmonchan', 'kangaskhan', 'tauros'],
    guardians: ['onix', 'rhyhorn', 'aerodactyl'],
    bossSpecies: 'charmander',
    bossName: '沙丘守护者·喷火龙',
    bossTrainerKey: 'tr_brock',
    bossTrainerName: '馆主 小刚',
    rewardCoins: 140,
  },
  {
    id: 'storm_coast',
    name: '风暴海岸',
    types: [
      { label: '水', color: '#228be6' },
      { label: '电', color: '#f5b700' },
      { label: '飞行', color: '#74c0fc' },
    ],
    desc: '浪潮拍打的海崖与雷暴草坡，水系与电系精英在此轮番突袭。',
    headerColor: '#228be6',
    targetSec: 180,
    wildPool: ['magikarp', 'poliwag', 'slowpoke', 'shellder', 'horsea', 'staryu', 'lapras', 'magnemite', 'electabuzz', 'psyduck', 'squirtle', 'pidgey', 'pikachu', 'tentacool', 'krabby', 'voltorb', 'goldeen', 'vaporeon', 'jolteon', 'omanyte', 'kabuto'],
    guardians: ['staryu', 'electabuzz', 'zapdos'],
    bossSpecies: 'squirtle',
    bossName: '海崖守护者·水箭龟',
    bossTrainerKey: 'tr_misty',
    bossTrainerName: '馆主 小霞',
    rewardCoins: 180,
  },
  {
    id: 'sky_glacier',
    name: '天空冰川',
    types: [
      { label: '冰', color: '#3bc9db' },
      { label: '龙', color: '#5c7cfa' },
      { label: '超能', color: '#ae3ec9' },
    ],
    desc: '高耸冰岩阶梯与皑皑雪原，传说冰鸟、龙系与超能强者守护着冰封圣地。',
    headerColor: '#1098ad',
    targetSec: 210,
    wildPool: ['lapras', 'shellder', 'slowpoke', 'abra', 'clefairy', 'chansey', 'porygon', 'aerodactyl', 'dratini', 'gastly', 'vulpix', 'zubat', 'seel', 'drowzee', 'mrmime', 'jynx', 'ditto'],
    guardians: ['lapras', 'aerodactyl', 'articuno'],
    bossSpecies: 'dratini',
    bossName: '冰川守护者·快龙',
    bossTrainerKey: 'tr_blue',
    bossTrainerName: '劲敌 小茂',
    rewardCoins: 240,
  },
  {
    id: 'cinnabar_isle',
    name: '红莲火山',
    types: [
      { label: '火', color: '#e03131' },
      { label: '幽灵', color: '#7950f2' },
      { label: '超能', color: '#ae3ec9' },
    ],
    desc: '黑曜石熔岩裂谷与赤红天空，传说火焰鸟、超梦与关都顶尖强者的终极试炼场。',
    headerColor: '#c92a2a',
    targetSec: 240,
    wildPool: ['vulpix', 'growlithe', 'ponyta', 'magmar', 'nidoran', 'rhyhorn', 'electabuzz', 'porygon', 'abra', 'machop', 'gastly', 'charmander', 'magikarp', 'dratini', 'grimer', 'koffing', 'flareon'],
    guardians: ['magmar', 'moltres', 'mewtwo'],
    bossSpecies: 'mewtwo',
    bossName: '火山终极首领·超梦',
    bossTrainerKey: 'tr_ltsurge',
    bossTrainerName: '馆主 马志士',
    rewardCoins: 300,
  },
];

// Keep STORY_CHAPTERS alias for backwards compatibility with tests
export const STORY_CHAPTERS = MAP_REGIONS.slice(0, 3).map((r, i) => ({
  id: i + 1,
  title: `第${i + 1}章 · ${r.name}`,
  subtitle: r.desc,
  targetSec: r.targetSec,
  bossSpecies: r.bossSpecies,
  bossName: r.bossName,
  bossTrainerKey: r.bossTrainerKey,
  bossTrainerName: r.bossTrainerName,
  rewardCoins: r.rewardCoins,
}));

export interface LiveFollowerSummary {
  id: string;
  sourcePetId?: string;
  species: SpeciesId;
  name: string;
  level: number;
  sprite: string;
  skills: SurvivorSkillId[];
}

export interface LiveRunTacticsBridge {
  inBattle: boolean;
  regionName: string;
  diffLabel: string;
  hp: number;
  maxHp: number;
  xp: number;
  xpNeed: number;
  runLevel: number;
  elapsedSec: number;
  kills: number;
  totalDamage: number;
  coins: number;
  baseAtk: number;
  atkMult: number;
  followers: LiveFollowerSummary[];
  tactics: TacticalConfig;
  camPreset: 'wide' | 'close';
  onToggleFollower: (boxPetId: string) => void;
  onSetFollowerSkill: (followerId: string, slot: number, skillId: SurvivorSkillId) => void;
  onChangeTactics: (patch: Partial<TacticalConfig>) => void;
  onChangeCamPreset: (preset: 'wide' | 'close') => void;
  onResumeBattle: () => void;
  onSettleAndExit: () => void;
}

export const ENEMY_TRAINER_ROSTER: {
  key: string;
  name: string;
  sprite: string;
  guardSpecies: SpeciesId;
}[] = [
  { key: 'tr_youngster', name: '短裤小子', sprite: '/sprites/trainers/youngster.png', guardSpecies: 'meowth' },
  { key: 'tr_lass', name: '迷你裙少女', sprite: '/sprites/trainers/lass.png', guardSpecies: 'jigglypuff' },
  { key: 'tr_brock', name: '馆主 小刚', sprite: '/sprites/trainers/brock.png', guardSpecies: 'munchlax' },
  { key: 'tr_misty', name: '馆主 小霞', sprite: '/sprites/trainers/misty.png', guardSpecies: 'psyduck' },
  { key: 'tr_blue', name: '劲敌 小茂', sprite: '/sprites/trainers/blue.png', guardSpecies: 'eevee' },
  { key: 'tr_ltsurge', name: '馆主 马志士', sprite: '/sprites/trainers/ltsurge.png', guardSpecies: 'pikachu' },
  { key: 'tr_erika', name: '馆主 莉佳', sprite: '/sprites/trainers/erika.png', guardSpecies: 'bulbasaur' },
];
