import type { PokemonElement, SpeciesId } from '../types/pet';
import { getActiveGeoTerrainOrigin, sampleGeoTerrainHeight3D, subscribeGeoDemLoaded } from './geoTerrain3D';
import {
  HIGHWAY_ROAD_WIDTH_3D,
  getNearestGeoHighwayDist3D,
  getNearestGeoHighwayProjection3D,
} from '../utils/interCityHighwayGraph';
import { generateTownLayout, isOnShanghaiBridgeLocal, type TownStreetSeg } from '../utils/townStreetGen';
import type { BiomeId } from './worldTextures3D';

export type SurvivorSkillId =
  | 'thunderbolt'
  | 'fireball'
  | 'razor_leaf'
  | 'water_pulse'
  | 'shadow_star'
  | 'dragon_pulse'
  | 'swift_volley'
  | 'heal_bell'
  | 'ice_beam'
  | 'aura_sphere'
  | 'sacred_fire'
  | 'earthquake'
  | 'psychic_nova'
  | 'moonblast'
  | 'dark_ruin'
  | 'solar_beam';

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
  ice_beam: {
    id: 'ice_beam',
    name: '急冻光线',
    tag: '冰霜',
    desc: '发射极寒贯穿冰晶射线重创直线敌群并减速',
    color: '#15aabf',
    hex: 0x74c0fc,
    sprite: '/sprites/items/casteliacone.png',
    baseCd: 1.5,
    powerMult: 1.28,
  },
  aura_sphere: {
    id: 'aura_sphere',
    name: '波导功夫弹',
    tag: '格斗',
    desc: '凝聚气功波导弹必中强敌并引发震荡气浪',
    color: '#228be6',
    hex: 0x4dabf7,
    sprite: '/sprites/items/focus-band.png',
    baseCd: 1.32,
    powerMult: 1.38,
  },
  sacred_fire: {
    id: 'sacred_fire',
    name: '神圣之火',
    tag: '圣焰',
    desc: '召唤七彩圣焰天降轰击目标引发范围灼烧',
    color: '#e03131',
    hex: 0xff6b6b,
    sprite: '/sprites/items/charcoal.png',
    baseCd: 1.85,
    powerMult: 1.56,
  },
  earthquake: {
    id: 'earthquake',
    name: '大地岩震',
    tag: '震击',
    desc: '重踏大地掀起 360° 岩石冲击波击退四周敌人',
    color: '#d97724',
    hex: 0xf08c00,
    sprite: '/sprites/items/everstone.png',
    baseCd: 2.15,
    powerMult: 1.35,
  },
  psychic_nova: {
    id: 'psychic_nova',
    name: '精神强念',
    tag: '超能',
    desc: '释放多道粉色念力脉冲穿透敌阵打击高危目标',
    color: '#e64980',
    hex: 0xf783ac,
    sprite: '/sprites/items/scope-lens.png',
    baseCd: 1.6,
    powerMult: 1.24,
  },
  moonblast: {
    id: 'moonblast',
    name: '月亮之力',
    tag: '妖精',
    desc: '召唤月华星辰爆弹重创强敌并微幅回复体力',
    color: '#cc5de8',
    hex: 0xe599f7,
    sprite: '/sprites/items/sweet-heart.png',
    baseCd: 1.55,
    powerMult: 1.26,
  },
  dark_ruin: {
    id: 'dark_ruin',
    name: '灾厄暗斩',
    tag: '恶系',
    desc: '扇形挥出三道穿透暗黑裂空斩撕裂前排敌群',
    color: '#495057',
    hex: 0x862e9c,
    sprite: '/sprites/items/black-glasses.png',
    baseCd: 1.68,
    powerMult: 1.44,
  },
  solar_beam: {
    id: 'solar_beam',
    name: '日光束',
    tag: '蓄能',
    desc: '汇聚耀眼翠绿太阳光柱直线贯通全场超高爆发',
    color: '#2f9e44',
    hex: 0x8ce99a,
    sprite: '/sprites/items/miracle-seed.png',
    baseCd: 1.92,
    powerMult: 1.52,
  },
};

export const ALL_SURVIVOR_SKILL_IDS = Object.keys(SURVIVOR_SKILLS) as SurvivorSkillId[];

/**
 * Progressive skill-slot unlock curve per follower level during a 3D run:
 * Lv.1 -> 1 active skill (balanced early game!)
 * Lv.2 -> 2 active skills
 * Lv.4 -> 3 active skills
 * Lv.6+ -> 4 active skills (full build!)
 */
export function getUnlockedSkillSlotCount(followerRunLevel: number): number {
  if (followerRunLevel >= 6) return 4;
  if (followerRunLevel >= 4) return 3;
  if (followerRunLevel >= 2) return 2;
  return 1;
}

export function getRequiredLevelForSkillSlot(slotIdx: number): number {
  if (slotIdx <= 0) return 1;
  if (slotIdx === 1) return 2;
  if (slotIdx === 2) return 4;
  return 6;
}

export function getDefaultSkillsForElement(
  element: PokemonElement,
): [SurvivorSkillId, SurvivorSkillId, SurvivorSkillId, SurvivorSkillId] {
  switch (element) {
    case 'electric':
      return ['thunderbolt', 'swift_volley', 'aura_sphere', 'heal_bell'];
    case 'fire':
      return ['fireball', 'sacred_fire', 'dragon_pulse', 'earthquake'];
    case 'grass':
      return ['razor_leaf', 'solar_beam', 'heal_bell', 'earthquake'];
    case 'water':
      return ['water_pulse', 'ice_beam', 'swift_volley', 'heal_bell'];
    case 'ghost':
      return ['shadow_star', 'dark_ruin', 'psychic_nova', 'moonblast'];
    case 'psychic':
      return ['psychic_nova', 'aura_sphere', 'moonblast', 'thunderbolt'];
    case 'fairy':
      return ['moonblast', 'heal_bell', 'psychic_nova', 'swift_volley'];
    case 'dragon':
      return ['dragon_pulse', 'sacred_fire', 'ice_beam', 'earthquake'];
    default:
      return ['aura_sphere', 'swift_volley', 'earthquake', 'heal_bell'];
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

export interface WorldTownAnchor3D {
  id: string;
  name: string;
  x: number;
  z: number;
  seed: number;
  plazaRadius: number;
  plateauY: number;
  landmarkCityId?: string;
}

/**
 * Iconic real-world cities anchored far apart across the infinite seamless 3D world.
 * Default starting city right north of spawn is 上海市 (with 东方明珠)!
 * getTerrainHeight3D smoothly levels a wide terraced dry plateau (plazaRadius + 18m)
 * around each city so ZERO buildings, streets, or railway tracks ever dangle into lakes!
 */
export const WORLD_TOWNS_3D: WorldTownAnchor3D[] = [
  { id: 'city_shanghai', name: '上海市', x: 0, z: -210, seed: 101, plazaRadius: 162, plateauY: 1.95, landmarkCityId: 'shanghai' },
  { id: 'city_beijing', name: '北京市', x: 0, z: -760, seed: 202, plazaRadius: 162, plateauY: 2.65, landmarkCityId: 'beijing' },
  { id: 'city_guangzhou', name: '广州市', x: 0, z: 420, seed: 303, plazaRadius: 162, plateauY: 1.95, landmarkCityId: 'guangzhou' },
  { id: 'city_tokyo', name: '东京市', x: 620, z: -210, seed: 404, plazaRadius: 162, plateauY: 2.15, landmarkCityId: 'tokyo' },
  { id: 'city_kyoto', name: '京都市', x: -620, z: -210, seed: 505, plazaRadius: 162, plateauY: 2.25, landmarkCityId: 'kyoto' },
];

/** Clean cardinal 4-lane expressways plugging directly into each city's tapered 8->4 lane outer portals (±150m) */
export const WORLD_ROAD_SEGMENTS_3D: [number, number, number, number][] = [
  [0, 14, 0, -60],            // 出发点南郊 -> 上海市南门渐变衔接段
  [0, -360, 0, -610],         // 上海市北门 <-> 北京市南门
  [0, 14, 0, 270],            // 出发点南郊 <-> 广州市北门
  [150, -210, 470, -210],     // 上海市东门 <-> 东京市西门
  [-150, -210, -470, -210],   // 上海市西门 <-> 京都市东门
];

/** Continuous Inter-City High-Speed Rail & Metro Network linking all 5 Major World Cities! */
export const WORLD_RAIL_SEGMENTS_3D: [number, number, number, number][] = [
  [-28, -320, -28, -640],     // 京沪高铁 (上海市 <-> 北京市)
  [-28, -100, -28, 310],      // 沪广高铁 (上海市 <-> 广州市)
  [110, -242, 510, -242],     // 沪东跨海地铁快线 (上海市 <-> 东京市)
  [-110, -242, -510, -242],   // 沪京西快线 (上海市 <-> 京都市)
];

/** Nearest point + perpendicular distance from (px, pz) to segment (ax, az)-(bx, bz) */
function nearestPointOnSeg2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { dist: number; qx: number; qz: number } {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 0.001) return { dist: Math.hypot(px - ax, pz - az), qx: ax, qz: az };
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
  const qx = ax + t * vx;
  const qz = az + t * vz;
  return { dist: Math.hypot(px - qx, pz - qz), qx, qz };
}

function getNearestRoadProjection3D(wx: number, wz: number): { dist: number; qx: number; qz: number } {
  let best = { dist: 9999, qx: wx, qz: wz };
  for (let i = 0; i < WORLD_ROAD_SEGMENTS_3D.length; i++) {
    const [ax, az, bx, bz] = WORLD_ROAD_SEGMENTS_3D[i];
    const p = nearestPointOnSeg2D(wx, wz, ax, az, bx, bz);
    if (p.dist < best.dist) best = p;
  }
  return best;
}

export function getNearestRoadDist3D(wx: number, wz: number): number {
  return getNearestRoadProjection3D(wx, wz).dist;
}

export function isOnInterTownRoad3D(wx: number, wz: number, halfWidth = 12.2): boolean {
  return getNearestRoadDist3D(wx, wz) < halfWidth;
}

export const BRIDGE_DECK_Y_3D = WATER_LEVEL_3D + 0.92;
export const MOUNTAIN_TUNNEL_TRIGGER_Y = 5.2;
export const MOUNTAIN_TUNNEL_FLOOR_Y = 4.35;

/** Natural procedural terrain height BEFORE carving mountain tunnel passes (used to detect where tunnels arch over roads!) */
export function getRawNaturalTerrainHeight3D(wx: number, wz: number): number {
  const geoElev = sampleGeoTerrainHeight3D(wx, wz);
  if (geoElev !== null) return geoElev;

  // Gentle, broad continental landforms (smoother transitions so hills roll naturally!)
  const qx = fbm2D(wx * 0.0075 + 3.1, wz * 0.0075 - 2.4, 3) * 28.0;
  const qz = fbm2D(wx * 0.0075 - 7.8, wz * 0.0075 + 5.2, 3) * 28.0;
  const sx = wx + qx;
  const sz = wz + qz;

  const cont = fbm2D(sx * 0.009 + 12.4, sz * 0.009 - 8.7, 4) * 2.0;
  const hills = fbm2D(sx * 0.018 - 4.3, sz * 0.018 + 19.1, 3) * 1.35;
  const ridge = ridgedFbm2D(sx * 0.011 + 23.0, sz * 0.011 - 14.5, 4);

  const spawnDist = Math.hypot(wx, wz);
  const spawnDry = 1.0 - smoothstep(14.0, 32.0, spawnDist);

  const lakeMask = 1.0 - smoothstep(-0.68, -0.32, cont);
  const mountainMask = smoothstep(0.26, 0.76, cont);

  let elev =
    1.65 +
    cont * 2.45 +
    hills * 0.85 +
    mountainMask * (ridge * 6.6 + 1.2) -
    lakeMask * 2.4;

  if (elev < 0) elev = Math.max(-2.5, elev * 0.65);

  if (spawnDry > 0) {
    const gentleMeadow = 1.2 + hills * 0.35;
    elev = elev * (1.0 - spawnDry) + Math.max(elev, gentleMeadow) * spawnDry;
  }

  for (let i = 0; i < WORLD_TOWNS_3D.length; i++) {
    const t = WORLD_TOWNS_3D[i];
    const d = Math.hypot(wx - t.x, wz - t.z);
    if (d <= 38) {
      return t.plateauY;
    }
    const outerR = t.plazaRadius + 24;
    if (d < outerR) {
      const zoneMask = 1.0 - smoothstep(t.plazaRadius - 6, outerR, d);
      const gentleCitySlope =
        t.plateauY +
        Math.sin((wx - t.x) * 0.0085 + t.seed) * 0.65 +
        Math.cos((wz - t.z) * 0.0085 - t.seed) * 0.65;
      const plazaFlat = 1.0 - smoothstep(38, 56, d);
      const cityTargetY = gentleCitySlope * (1.0 - plazaFlat) + t.plateauY * plazaFlat;
      const dryElev = Math.max(elev, WATER_LEVEL_3D + 0.95);
      const safeElev = elev * (1.0 - zoneMask) + dryElev * zoneMask;
      elev = safeElev * (1.0 - zoneMask * 0.88) + cityTargetY * (zoneMask * 0.88);
    }
  }
  return elev;
}

// ============================================================================
// ACTIVE TOWN STREET, BRIDGE & RAIL SPATIAL INDEX (O(1) 32m Bucket Grid)
// Unifies roadbed terrain grading, 1:1 walkable asphalt/bridge deck height,
// and strict exclusion of wild trees/rocks/signposts from ALL paved roads!
// ============================================================================
interface IndexedTownStreetEntry {
  seg: TownStreetSeg;
  halfW: number;
  townCenterX: number;
  townCenterZ: number;
}

interface IndexedRailEntry {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

const TOWN_STREET_GRID_CELL = 32;
const activeStreetBuckets = new Map<string, IndexedTownStreetEntry[]>();
const activeRailBuckets = new Map<string, IndexedRailEntry[]>();

export function registerActiveTownRoadLayouts3D(
  specs: {
    id: string;
    name: string;
    x: number;
    z: number;
    seed: number;
    plazaRadius: number;
    plateauY?: number;
    landmarkCityId?: string;
  }[],
): void {
  activeStreetBuckets.clear();
  activeRailBuckets.clear();

  for (const spec of specs) {
    const layout = generateTownLayout({
      id: spec.id,
      name: spec.name,
      x: spec.x,
      z: spec.z,
      seed: spec.seed,
      plazaRadius: spec.plazaRadius,
      plateauY: spec.plateauY ?? 1.65,
      landmarkCityId: spec.landmarkCityId,
    });

    for (const seg of layout.streets) {
      const midDist = Math.hypot((seg.x1 + seg.x2) * 0.5 - spec.x, (seg.z1 + seg.z2) * 0.5 - spec.z);
      if (!seg.isBridge && midDist > 720) continue;
      const halfW = Math.max(seg.width, seg.widthStart ?? seg.width, seg.widthEnd ?? seg.width) * 0.5;
      const pad = halfW + 10.0;
      const gx0 = Math.floor((Math.min(seg.x1, seg.x2) - pad) / TOWN_STREET_GRID_CELL);
      const gx1 = Math.floor((Math.max(seg.x1, seg.x2) + pad) / TOWN_STREET_GRID_CELL);
      const gz0 = Math.floor((Math.min(seg.z1, seg.z2) - pad) / TOWN_STREET_GRID_CELL);
      const gz1 = Math.floor((Math.max(seg.z1, seg.z2) + pad) / TOWN_STREET_GRID_CELL);
      const entry: IndexedTownStreetEntry = {
        seg,
        halfW,
        townCenterX: spec.x,
        townCenterZ: spec.z,
      };
      for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const k = `${gx},${gz}`;
          let arr = activeStreetBuckets.get(k);
          if (!arr) {
            arr = [];
            activeStreetBuckets.set(k, arr);
          }
          arr.push(entry);
        }
      }
    }

    for (const rl of layout.rail) {
      const pad = 10.0;
      const gx0 = Math.floor((Math.min(rl.x1, rl.x2) - pad) / TOWN_STREET_GRID_CELL);
      const gx1 = Math.floor((Math.max(rl.x1, rl.x2) + pad) / TOWN_STREET_GRID_CELL);
      const gz0 = Math.floor((Math.min(rl.z1, rl.z2) - pad) / TOWN_STREET_GRID_CELL);
      const gz1 = Math.floor((Math.max(rl.z1, rl.z2) + pad) / TOWN_STREET_GRID_CELL);
      for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const k = `${gx},${gz}`;
          let arr = activeRailBuckets.get(k);
          if (!arr) {
            arr = [];
            activeRailBuckets.set(k, arr);
          }
          arr.push(rl);
        }
      }
    }
  }

  clearTerrainHeightCache3D();
}

function getNearestTownStreetHit3D(
  wx: number,
  wz: number,
  includeBridges: boolean,
): { entry: IndexedTownStreetEntry; dist: number; qx: number; qz: number; t: number } | null {
  const gx = Math.floor(wx / TOWN_STREET_GRID_CELL);
  const gz = Math.floor(wz / TOWN_STREET_GRID_CELL);
  const bucket = activeStreetBuckets.get(`${gx},${gz}`);
  if (!bucket || bucket.length === 0) return null;

  let best: { entry: IndexedTownStreetEntry; dist: number; qx: number; qz: number; t: number } | null = null;
  let bestClearance = 9999;

  for (let i = 0; i < bucket.length; i++) {
    const e = bucket[i];
    if (!includeBridges && e.seg.isBridge) continue;
    const vx = e.seg.x2 - e.seg.x1;
    const vz = e.seg.z2 - e.seg.z1;
    const lenSq = vx * vx + vz * vz;
    const t = lenSq > 1e-4 ? Math.max(0, Math.min(1, ((wx - e.seg.x1) * vx + (wz - e.seg.z1) * vz) / lenSq)) : 0;
    const qx = e.seg.x1 + vx * t;
    const qz = e.seg.z1 + vz * t;
    const dist = Math.hypot(wx - qx, wz - qz);
    const clearance = dist - e.halfW;
    if (clearance < bestClearance) {
      bestClearance = clearance;
      best = { entry: e, dist, qx, qz, t };
    }
  }
  return best;
}

/**
 * Returns `true` if `(wx, wz)` falls on or beside ANY paved road, highway, bridge, or railway track
 * — preventing wild trees, rocks, bushes, flowers, mushrooms & random signposts from EVER spawning on roads!
 */
export function isNearAnyRoadOrRailForFlora3D(wx: number, wz: number, extraPad = 0): boolean {
  if (getActiveGeoTerrainOrigin() !== null) {
    if (getNearestGeoHighwayDist3D(wx, wz) < HIGHWAY_ROAD_WIDTH_3D * 0.5 + 6.8 + extraPad) {
      return true;
    }
  } else {
    if (isOnInterTownRoad3D(wx, wz, 15.5 + extraPad)) {
      return true;
    }
    for (let i = 0; i < WORLD_RAIL_SEGMENTS_3D.length; i++) {
      const [ax, az, bx, bz] = WORLD_RAIL_SEGMENTS_3D[i];
      if (nearestPointOnSeg2D(wx, wz, ax, az, bx, bz).dist < 7.5 + extraPad) return true;
    }
  }

  const stHit = getNearestTownStreetHit3D(wx, wz, true);
  if (stHit && stHit.dist < stHit.entry.halfW + 5.6 + extraPad) {
    return true;
  }

  const gx = Math.floor(wx / TOWN_STREET_GRID_CELL);
  const gz = Math.floor(wz / TOWN_STREET_GRID_CELL);
  const rails = activeRailBuckets.get(`${gx},${gz}`);
  if (rails) {
    for (let i = 0; i < rails.length; i++) {
      const r = rails[i];
      if (nearestPointOnSeg2D(wx, wz, r.x1, r.z1, r.x2, r.z2).dist < 7.5 + extraPad) return true;
    }
  }
  return false;
}

// Zero-allocation 131,072-entry direct-mapped spatial height cache (0.5m resolution) — eliminates 37,000+ redundant DEM/river evaluations when shifting terrain chunks!
const TERRAIN_CACHE_MASK = (1 << 17) - 1;
const TERRAIN_CACHE_KX = new Int32Array(1 << 17).fill(0x7fffffff);
const TERRAIN_CACHE_KZ = new Int32Array(1 << 17).fill(0x7fffffff);
const TERRAIN_CACHE_VAL = new Float32Array(1 << 17);

export function clearTerrainHeightCache3D(): void {
  TERRAIN_CACHE_KX.fill(0x7fffffff);
}
subscribeGeoDemLoaded(clearTerrainHeightCache3D);

export function getTerrainHeight3D(wx: number, wz: number): number {
  const qxInt = Math.round(wx * 2);
  const qzInt = Math.round(wz * 2);
  const slot = (Math.imul(qxInt, 73856093) ^ Math.imul(qzInt, 19349663)) & TERRAIN_CACHE_MASK;
  if (TERRAIN_CACHE_KX[slot] === qxInt && TERRAIN_CACHE_KZ[slot] === qzInt) {
    return TERRAIN_CACHE_VAL[slot];
  }

  const sx = qxInt * 0.5;
  const sz = qzInt * 0.5;
  let elev = getRawNaturalTerrainHeight3D(sx, sz);

  if (getActiveGeoTerrainOrigin() === null) {
    const proj = getNearestRoadProjection3D(sx, sz);
    if (proj.dist < 22.0) {
      let centerElev = getRawNaturalTerrainHeight3D(proj.qx, proj.qz);
      if (centerElev > MOUNTAIN_TUNNEL_FLOOR_Y + 0.35) {
        centerElev = MOUNTAIN_TUNNEL_FLOOR_Y;
      }
      if (centerElev > WATER_LEVEL_3D + 0.15) {
        const gradeBlend = 1.0 - smoothstep(11.6, 22.0, proj.dist);
        elev = elev * (1.0 - gradeBlend) + centerElev * gradeBlend;
      } else if (elev > MOUNTAIN_TUNNEL_FLOOR_Y + 0.35 && proj.dist < 16.5) {
        const cut = 1.0 - smoothstep(10.5, 16.5, proj.dist);
        elev = elev * (1.0 - cut) + MOUNTAIN_TUNNEL_FLOOR_Y * cut;
      }
    }
  } else {
    // 1. Grade Real-Earth Inter-City Highway roadbeds flat side-to-side (so slopes never bury half the road or player!)
    const hwyHalfW = HIGHWAY_ROAD_WIDTH_3D * 0.5;
    const hwyProj = getNearestGeoHighwayProjection3D(sx, sz);
    if (hwyProj && hwyProj.dist < hwyHalfW + 8.5) {
      const centerElev = getRawNaturalTerrainHeight3D(hwyProj.qx, hwyProj.qz);
      if (centerElev > WATER_LEVEL_3D + 0.22) {
        const gradeBlend = 1.0 - smoothstep(hwyHalfW + 1.4, hwyHalfW + 8.5, hwyProj.dist);
        elev = elev * (1.0 - gradeBlend) + centerElev * gradeBlend;
      }
    }
    // 2. Grade Mounted City Street roadbeds flat side-to-side across hills & gentle slopes!
    const stHit = getNearestTownStreetHit3D(sx, sz, false);
    if (stHit && stHit.dist < stHit.entry.halfW + 5.5) {
      const centerElev = getRawNaturalTerrainHeight3D(stHit.qx, stHit.qz);
      if (centerElev > WATER_LEVEL_3D + 0.18) {
        const gradeBlend = 1.0 - smoothstep(stHit.entry.halfW + 0.9, stHit.entry.halfW + 5.5, stHit.dist);
        elev = elev * (1.0 - gradeBlend) + centerElev * gradeBlend;
      }
    }
  }

  TERRAIN_CACHE_KX[slot] = qxInt;
  TERRAIN_CACHE_KZ[slot] = qzInt;
  TERRAIN_CACHE_VAL[slot] = elev;
  return elev;
}

/**
 * Shared 1:1 Exact Surface Height for 3D Inter-City Highways & Highway Water Bridges!
 * Used identically by `interCityHighway3D.ts` mesh vertices AND `getWalkableSurfaceHeight3D`
 * so the player NEVER sinks underneath a highway or hits a sudden bridge cliff!
 */
export function getExactHighwayStationDeckY3D(
  centerQx: number,
  centerQz: number,
  dirX: number,
  dirZ: number,
  lateralFrac01: number,
  getGround: (x: number, z: number) => number = getTerrainHeight3D,
): { deckY: number; bridgeBlend: number } {
  const g0 = getGround(centerQx, centerQz);
  const gM14 = getGround(centerQx - dirX * 14.0, centerQz - dirZ * 14.0);
  const gM7 = getGround(centerQx - dirX * 7.0, centerQz - dirZ * 7.0);
  const gP7 = getGround(centerQx + dirX * 7.0, centerQz + dirZ * 7.0);
  const gP14 = getGround(centerQx + dirX * 14.0, centerQz + dirZ * 14.0);
  const minAlong = Math.min(g0, gM14, gM7, gP7, gP14);

  // Smooth 14m approach ramp up onto river/lake highway bridges (zero sudden step!)
  const bridgeBlend = 1.0 - smoothstep(WATER_LEVEL_3D + 0.16, WATER_LEVEL_3D + 0.92, minAlong);
  const onshoreEdgeY = Math.max(WATER_LEVEL_3D + 0.26, g0 + 0.16);
  const bridgeDeckY = Math.max(BRIDGE_DECK_Y_3D, 1.92, onshoreEdgeY);
  const edgeY = onshoreEdgeY + (bridgeDeckY - onshoreEdgeY) * bridgeBlend;
  const crownOffset = 0.035 * (1.0 - Math.max(0, Math.min(1, lateralFrac01)));
  return { deckY: edgeY + crownOffset, bridgeBlend };
}

/**
 * Shared 1:1 Exact Surface Height for City Bridges (`buildModernCityBridge3D`)!
 * Smoothly arches from exact onshore street elevation at `t=0` and `t=1` up to `midDeckY` over the river.
 */
export function computeCityBridgeDeckWorldY3D(
  seg: TownStreetSeg,
  baseY: number,
  tClamped: number,
  getGround: (x: number, z: number) => number = getTerrainHeight3D,
): number {
  const end1Y = Math.max(WATER_LEVEL_3D + 0.24, getGround(seg.x1, seg.z1) + 0.15);
  const end2Y = Math.max(WATER_LEVEL_3D + 0.24, getGround(seg.x2, seg.z2) + 0.15);
  const linearEndY = end1Y + (end2Y - end1Y) * tClamped;
  const peakDeckY = Math.max(WATER_LEVEL_3D + 0.95, baseY + 0.24, Math.max(end1Y, end2Y) + 0.28);
  const arch = smoothstep(0.0, 0.22, tClamped) * smoothstep(0.0, 0.22, 1.0 - tClamped);
  return linearEndY + (peakDeckY - linearEndY) * arch;
}

export interface WalkableStairAndFloorZone3D {
  cx: number;
  cz: number;
  rotY: number;
  baseY: number;
  halfW: number;
  halfD: number;
  upperFloorOffsetY: number; // e.g. 5.0m above baseY
  stairMinX: number;
  stairMaxX: number;
  stairBottomZ: number; // local Z at bottom of stairs (1F)
  stairTopZ: number;    // local Z at top of stairs (2F)
  openingMinX: number;
  openingMaxX: number;
  openingMinZ: number;
  openingMaxZ: number;
}

let activeBuildingFloorZones3D: WalkableStairAndFloorZone3D[] = [];
export function setWalkableBuildingFloorZones3D(zones: WalkableStairAndFloorZone3D[]): void {
  activeBuildingFloorZones3D = zones;
}

/**
 * Walkable surface height for Player, Followers & Enemies:
 * - Supports REAL 2-Story Walkable Staircases & 2nd-Floor Slabs when `currentPy` is supplied!
 * - Elevates smoothly onto Bridge Decks over rivers & lakes
 * - Matches paved urban road/plaza thickness so characters ALWAYS stand ON TOP of asphalt & floors!
 */
export function getWalkableSurfaceHeight3D(wx: number, wz: number, currentPy?: number): number {
  // Check 2-Story Building Staircases & 2F Floor Slabs first when entity height `currentPy` is known!
  if (currentPy !== undefined && activeBuildingFloorZones3D.length > 0) {
    for (let i = 0; i < activeBuildingFloorZones3D.length; i++) {
      const z = activeBuildingFloorZones3D[i];
      const dx = wx - z.cx;
      const dz = wz - z.cz;
      if (Math.abs(dx) > z.halfW + 6 && Math.abs(dz) > z.halfD + 6) continue;
      const cos = Math.cos(z.rotY);
      const sin = Math.sin(z.rotY);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) > z.halfW || Math.abs(lz) > z.halfD) continue;

      const floor1Y = z.baseY + 0.18;
      const floor2Y = z.baseY + z.upperFloorOffsetY;

      // 1. On the 3D Staircase Ramp? Smoothly climb/descend between 1F and 2F!
      const zLo = Math.min(z.stairBottomZ, z.stairTopZ);
      const zHi = Math.max(z.stairBottomZ, z.stairTopZ);
      if (lx >= z.stairMinX && lx <= z.stairMaxX && lz >= zLo - 0.8 && lz <= zHi + 0.8) {
        const span = z.stairTopZ - z.stairBottomZ || 1;
        const t = Math.max(0, Math.min(1, (lz - z.stairBottomZ) / span));
        const rampY = floor1Y + (floor2Y - floor1Y) * t;
        // Engage staircase if entity is within vertical reach of the ramp (so walking *under* high stairs on 1F stays on 1F!)
        if (currentPy >= rampY - 1.35 && currentPy <= floor2Y + 2.5) {
          return rampY;
        }
      }

      // 2. On the 2nd-Floor Slab (excluding the stairwell opening)?
      const inOpening =
        lx > z.openingMinX &&
        lx < z.openingMaxX &&
        lz > z.openingMinZ &&
        lz < z.openingMaxZ;
      if (!inOpening && currentPy >= floor2Y - 1.45) {
        return floor2Y;
      }
      return floor1Y;
    }
  }

  const ground = getTerrainHeight3D(wx, wz);
  const activeGeo = getActiveGeoTerrainOrigin();
  if (!activeGeo) {
    const roadDist = getNearestRoadDist3D(wx, wz);
    if (roadDist < 12.2 && ground < BRIDGE_DECK_Y_3D) {
      if (ground <= WATER_LEVEL_3D + 0.25) {
        return BRIDGE_DECK_Y_3D + 0.06;
      }
      const rampT = 1.0 - smoothstep(WATER_LEVEL_3D + 0.25, BRIDGE_DECK_Y_3D, ground);
      return ground * (1 - rampT) + (BRIDGE_DECK_Y_3D + 0.06) * rampT;
    }
    if (roadDist < 12.2) {
      return ground + 0.10;
    }
    for (let i = 0; i < WORLD_TOWNS_3D.length; i++) {
      const t = WORLD_TOWNS_3D[i];
      if (Math.hypot(wx - t.x, wz - t.z) < t.plazaRadius) {
        return ground + 0.14;
      }
    }
  } else {
    // Active Real-Earth Cities + Walkable Inter-City Highway Network (1:1 unified surface height!):
    const stHit = getNearestTownStreetHit3D(wx, wz, true);
    if (stHit && stHit.dist <= stHit.entry.halfW + 0.75) {
      if (stHit.entry.seg.isBridge) {
        const baseY = getTerrainHeight3D(stHit.entry.townCenterX, stHit.entry.townCenterZ);
        return computeCityBridgeDeckWorldY3D(stHit.entry.seg, baseY, stHit.t, getTerrainHeight3D) + 0.03;
      }
      const segKind = stHit.entry.seg.kind;
      const liftY = segKind === 'arterial' ? 0.098 : segKind === 'street' ? 0.072 : 0.045;
      const centerG = getTerrainHeight3D(stHit.qx, stHit.qz);
      const latFrac = Math.min(1, stHit.dist / Math.max(0.5, stHit.entry.halfW));
      const streetDeckY = Math.max(WATER_LEVEL_3D + 0.24, centerG + liftY + 0.08 + 0.035 * (1 - latFrac));
      return Math.max(ground + 0.16, streetDeckY);
    }

    const geoCityId = activeGeo.startCityId ?? 'shanghai';
    if (isOnShanghaiBridgeLocal(wx, wz, geoCityId)) {
      return Math.max(ground + 0.16, 1.92);
    }

    const hwyHalfW = HIGHWAY_ROAD_WIDTH_3D * 0.5;
    const hwyProj = getNearestGeoHighwayProjection3D(wx, wz);
    if (hwyProj && hwyProj.dist <= hwyHalfW + 0.85) {
      const latFrac = Math.min(1, hwyProj.dist / hwyHalfW);
      const { deckY } = getExactHighwayStationDeckY3D(
        hwyProj.qx,
        hwyProj.qz,
        hwyProj.dirX,
        hwyProj.dirZ,
        latFrac,
        getTerrainHeight3D,
      );
      return Math.max(deckY + 0.02, ground >= WATER_LEVEL_3D ? ground + 0.16 : deckY + 0.02);
    }

    // Dry paved city plazas & parks sit flush at ground + 0.16 across dry landmass!
    if (Math.hypot(wx, wz) < 860 && ground >= WATER_LEVEL_3D) {
      return ground + 0.16;
    }
  }
  return ground;
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
  { key: 'tr_youngster', name: '短裤小子', sprite: '/sprites/trainers/youngster-ow.png', guardSpecies: 'meowth' },
  { key: 'tr_lass', name: '迷你裙少女', sprite: '/sprites/trainers/lass-ow.png', guardSpecies: 'jigglypuff' },
  { key: 'tr_brock', name: '馆主 小刚', sprite: '/sprites/trainers/brock-ow.png', guardSpecies: 'munchlax' },
  { key: 'tr_misty', name: '馆主 小霞', sprite: '/sprites/trainers/misty-ow.png', guardSpecies: 'psyduck' },
  { key: 'tr_blue', name: '劲敌 小茂', sprite: '/sprites/trainers/blue-ow.png', guardSpecies: 'eevee' },
  { key: 'tr_ltsurge', name: '馆主 马志士', sprite: '/sprites/trainers/ltsurge-ow.png', guardSpecies: 'pikachu' },
  { key: 'tr_erika', name: '馆主 莉佳', sprite: '/sprites/trainers/erika-ow.png', guardSpecies: 'bulbasaur' },
];
