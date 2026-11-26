import { WORLD_CITIES, calcGeoDistanceKm, type WorldCityDef } from './worldTour';
import { getShanghaiRiverSignedDist } from '../utils/townStreetGen';

/**
 * Dual-Resolution Real-Earth 3D Geographic Terrain Engine (NASA SRTM / AWS Mapzen Terrarium DEM)
 *
 * - Macro Layer (Z5, ~1200km/tile): Permanently caches all of East Asia in 9 tiles so zooming far out
 *   shows clean, continuous real coastlines, seas, plains & mountain ranges with ZERO tile eviction!
 * - Detail Layer (Z9, ~78km/tile, ~300m/px): Crisp local bays, islands, foothills & mountain ridges
 *   for 3D exploration & overland cross-city walking (e.g. Shenzhen -> Hong Kong in ~50s!).
 *
 * Coordinate convention: +X = East, -Z = North, +Z = South, -X = West
 */

export const GEO_UNITS_PER_KM = 100;
/** 1:10 Real-Earth Metropolitan Scale (`1 km = 100 units` — cities & districts align 1:1 with real coastlines & rivers!) */
export const CITY_STREET_PLAN_SCALE = GEO_UNITS_PER_KM;
const KM_PER_DEG_LAT = 111.32;
const DEM_Z_GLOBAL = 2;
const DEM_Z_WORLD = 3;
const DEM_Z_MACRO = 5;
const DEM_Z_MID = 9;
const DEM_Z_DETAIL = 11;
const MAX_DETAIL_CACHE = 240;

/**
 * Converts real SRTM elevation meters into 1:10 3D world Y height:
 * - Low hills (50–120m, e.g. 99m Shanghai Sheshan -> ~21u tall) stand out clearly with gentle ~8° walkable slopes!
 * - Major peaks (1,545m Taishan -> ~213u, 1,865m Huangshan -> ~254u, 3,776m Mt. Fuji -> ~503u) tower 70–170 stories high
 *   while maintaining natural 14°–28° walkable mountain slopes!
 */
export function realMetersToWorldY3D(realM: number): number {
  if (realM <= 0) return realM * 0.13;
  return realM * 0.13 + Math.min(realM, 140) * 0.085;
}

/** Inverse mapping from 1:10 3D world Y back to authentic real-world elevation meters for HUD altitude display */
export function worldYToRealMeters3D(worldY: number): number {
  if (worldY <= 0) return worldY / 0.13;
  const kneeY = 140 * 0.215; // 30.1u corresponds to 140m real elevation
  if (worldY <= kneeY) return worldY / 0.215;
  return 140 + (worldY - kneeY) / 0.13;
}

export interface GeoTerrainOrigin {
  originLat: number;
  originLng: number;
  startCityId: string | null;
  startCityName: string;
  unitsPerKm: number;
}

export const DEFAULT_GEO_ORIGIN: GeoTerrainOrigin = {
  originLat: 31.23,
  originLng: 121.47,
  startCityId: 'shanghai',
  startCityName: '上海市',
  unitsPerKm: GEO_UNITS_PER_KM,
};

interface PersistedGeoState {
  activeOrigin: GeoTerrainOrigin;
  demVersion: number;
  globalCache: Map<string, Float32Array>;
  worldCache: Map<string, Float32Array>;
  macroCache: Map<string, Float32Array>;
  detailCache: Map<string, Float32Array>;
  inflight: Set<string>;
}

const GEO_GLOBAL_KEY = '__POKE_POCKET_GEO_STATE_V4__';
const gAny = globalThis as unknown as Record<string, PersistedGeoState | undefined>;
const PERSISTED_GEO: PersistedGeoState =
  gAny[GEO_GLOBAL_KEY] ??
  (gAny[GEO_GLOBAL_KEY] = {
    activeOrigin: { ...DEFAULT_GEO_ORIGIN },
    demVersion: 0,
    globalCache: new Map<string, Float32Array>(),
    worldCache: new Map<string, Float32Array>(),
    macroCache: new Map<string, Float32Array>(),
    detailCache: new Map<string, Float32Array>(),
    inflight: new Set<string>(),
  });
PERSISTED_GEO.activeOrigin.unitsPerKm = GEO_UNITS_PER_KM;

// Real-Earth mode is ALWAYS active (persisted across Vite HMR so the map can NEVER fall back to random procedural noise!)
let activeOrigin: GeoTerrainOrigin = PERSISTED_GEO.activeOrigin;
let demVersion = PERSISTED_GEO.demVersion;

const GLOBAL_DEM_CACHE = PERSISTED_GEO.globalCache;
const WORLD_DEM_CACHE = PERSISTED_GEO.worldCache;
const MACRO_DEM_CACHE = PERSISTED_GEO.macroCache;
const DETAIL_DEM_CACHE = PERSISTED_GEO.detailCache;
const DEM_INFLIGHT = PERSISTED_GEO.inflight;
let demListenersSet: Set<() => void> | null = null;
function getDemListeners(): Set<() => void> {
  if (!demListenersSet) demListenersSet = new Set<() => void>();
  return demListenersSet;
}

let notifyTimer: number | null = null;
let notifyFirstQueuedMs = 0;
function notifyDemLoaded() {
  demVersion += 1;
  PERSISTED_GEO.demVersion = demVersion;
  if (typeof window === 'undefined') {
    for (const fn of getDemListeners()) {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    }
    return;
  }
  const now = performance.now();
  if (notifyTimer === null) {
    notifyFirstQueuedMs = now;
  } else if (now - notifyFirstQueuedMs < 650) {
    window.clearTimeout(notifyTimer);
  } else {
    // Already waiting near max cap; let current timer flush cleanly
    return;
  }
  // Coalesce burst of 27–52 parallel DEM tile completions into 1–2 quiet updates instead of 20+ back-to-back 30k-vertex rebuilds!
  const delayMs = DEM_INFLIGHT.size === 0 ? 40 : 240;
  notifyTimer = window.setTimeout(() => {
    notifyTimer = null;
    notifyFirstQueuedMs = 0;
    for (const fn of getDemListeners()) {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    }
  }, delayMs);
}

export function subscribeGeoDemLoaded(cb: () => void): () => void {
  const listeners = getDemListeners();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getGeoDemVersion(): number {
  return demVersion;
}

export function getActiveGeoTerrainOrigin(): GeoTerrainOrigin {
  return activeOrigin;
}

export function worldToGeo(wx: number, wz: number, origin = activeOrigin): { lat: number; lng: number } | null {
  if (!origin) return null;
  const kmPerDegLng = Math.max(12, KM_PER_DEG_LAT * Math.cos((origin.originLat * Math.PI) / 180));
  const lat = origin.originLat - wz / (origin.unitsPerKm * KM_PER_DEG_LAT);
  const lng = origin.originLng + wx / (origin.unitsPerKm * kmPerDegLng);
  return { lat, lng };
}

export function geoToWorld(lat: number, lng: number, origin = activeOrigin): { x: number; z: number } | null {
  if (!origin) return null;
  const kmPerDegLng = Math.max(12, KM_PER_DEG_LAT * Math.cos((origin.originLat * Math.PI) / 180));
  const x = (lng - origin.originLng) * kmPerDegLng * origin.unitsPerKm;
  const z = -(lat - origin.originLat) * KM_PER_DEG_LAT * origin.unitsPerKm;
  return { x, z };
}

function latLngToTileFrac(lat: number, lng: number, z: number): { fx: number; fy: number } {
  const n = 1 << z;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clampedLat * Math.PI) / 180;
  const fx = ((lng + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { fx, fy };
}

function requestDemTile(z: number, tx: number, ty: number) {
  const n = 1 << z;
  const wrappedTx = ((tx % n) + n) % n;
  if (ty < 0 || ty >= n) return;
  const key = `${z}/${wrappedTx}/${ty}`;
  const cache =
    z <= DEM_Z_GLOBAL
      ? GLOBAL_DEM_CACHE
      : z <= DEM_Z_WORLD
        ? WORLD_DEM_CACHE
        : z <= DEM_Z_MACRO
          ? MACRO_DEM_CACHE
          : DETAIL_DEM_CACHE;
  if (cache.has(key) || DEM_INFLIGHT.has(key)) return;
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;

  DEM_INFLIGHT.add(key);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    DEM_INFLIGHT.delete(key);
    try {
      const cvs = document.createElement('canvas');
      cvs.width = 256;
      cvs.height = 256;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 256, 256);
      const data = ctx.getImageData(0, 0, 256, 256).data;
      const elev = new Float32Array(256 * 256);
      for (let i = 0, p = 0; i < elev.length; i++, p += 4) {
        // AWS Mapzen Terrarium encoding: meters = (R * 256 + G + B / 256) - 32768
        elev[i] = data[p] * 256 + data[p + 1] + data[p + 2] / 256 - 32768;
      }
      if (z > DEM_Z_MACRO && cache.size >= MAX_DETAIL_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, elev);
      notifyDemLoaded();
    } catch {
      // Ignore canvas security fallback
    }
  };
  img.onerror = () => {
    DEM_INFLIGHT.delete(key);
  };
  img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${wrappedTx}/${ty}.png`;
}

let deferredGlobalPrefetchTimer: number | null = null;

function prefetchRegionTiles(origin: GeoTerrainOrigin) {
  // 1. PRIORITY FIRST: Fetch High-Res Z11 (~58km) + Mid Z9 (~230km) + Macro Z5 (~3600km) around the active city FIRST
  //    so local 3D terrain & coastline finish immediately without competing with 25 planetary map tiles!
  const detail = latLngToTileFrac(origin.originLat, origin.originLng, DEM_Z_DETAIL);
  const dcx = Math.floor(detail.fx);
  const dcy = Math.floor(detail.fy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      requestDemTile(DEM_Z_DETAIL, dcx + dx, dcy + dy);
    }
  }
  const mid = latLngToTileFrac(origin.originLat, origin.originLng, DEM_Z_MID);
  const m9x = Math.floor(mid.fx);
  const m9y = Math.floor(mid.fy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      requestDemTile(DEM_Z_MID, m9x + dx, m9y + dy);
    }
  }
  const macro = latLngToTileFrac(origin.originLat, origin.originLng, DEM_Z_MACRO);
  const mcx = Math.floor(macro.fx);
  const mcy = Math.floor(macro.fy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      requestDemTile(DEM_Z_MACRO, mcx + dx, mcy + dy);
    }
  }

  // 2. Defer Continental Z3 + Planetary Z2 (25 tiles ONLY used when zooming the 2D World Map all the way out) until after launch!
  if (typeof window !== 'undefined' && deferredGlobalPrefetchTimer === null) {
    deferredGlobalPrefetchTimer = window.setTimeout(() => {
      deferredGlobalPrefetchTimer = null;
      const world = latLngToTileFrac(origin.originLat, origin.originLng, DEM_Z_WORLD);
      const wcx = Math.floor(world.fx);
      const wcy = Math.floor(world.fy);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          requestDemTile(DEM_Z_WORLD, wcx + dx, wcy + dy);
        }
      }
      for (let ty = 0; ty < 4; ty++) {
        for (let tx = 0; tx < 4; tx++) {
          requestDemTile(DEM_Z_GLOBAL, tx, ty);
        }
      }
    }, 3200);
  }
}

export function hasLocalDemCoverage(lat: number, lng: number): boolean {
  for (const z of [DEM_Z_DETAIL, DEM_Z_MID]) {
    const { fx, fy } = latLngToTileFrac(lat, lng, z);
    const n = 1 << z;
    const tx = ((Math.floor(fx) % n) + n) % n;
    const ty = Math.floor(fy);
    if (DETAIL_DEM_CACHE.has(`${z}/${tx}/${ty}`)) return true;
  }
  return false;
}

export function prefetchGeoDetailAround(lat: number, lng: number): void {
  const detail = latLngToTileFrac(lat, lng, DEM_Z_DETAIL);
  const dcx = Math.floor(detail.fx);
  const dcy = Math.floor(detail.fy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      requestDemTile(DEM_Z_DETAIL, dcx + dx, dcy + dy);
    }
  }
  const mid = latLngToTileFrac(lat, lng, DEM_Z_MID);
  const m9x = Math.floor(mid.fx);
  const m9y = Math.floor(mid.fy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      requestDemTile(DEM_Z_MID, m9x + dx, m9y + dy);
    }
  }
  const macro = latLngToTileFrac(lat, lng, DEM_Z_MACRO);
  const mcx = Math.floor(macro.fx);
  const mcy = Math.floor(macro.fy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      requestDemTile(DEM_Z_MACRO, mcx + dx, mcy + dy);
    }
  }
}

export function setActiveGeoTerrainOrigin(origin: GeoTerrainOrigin | null) {
  activeOrigin = origin ? { ...origin } : { ...DEFAULT_GEO_ORIGIN };
  PERSISTED_GEO.activeOrigin = activeOrigin;
  prefetchRegionTiles(activeOrigin);
  notifyDemLoaded();
}

// Kick off Real-Earth DEM pre-fetch immediately on module load so even an already-open tab has real coastlines instantly!
if (typeof window !== 'undefined') {
  prefetchRegionTiles(activeOrigin);
}

function sampleGridAt(lat: number, lng: number, z: number, queueIfMissing: boolean): number | null {
  const { fx, fy } = latLngToTileFrac(lat, lng, z);
  const n = 1 << z;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  const wrappedTx = ((tx % n) + n) % n;
  const key = `${z}/${wrappedTx}/${ty}`;
  const cache =
    z <= DEM_Z_GLOBAL
      ? GLOBAL_DEM_CACHE
      : z <= DEM_Z_WORLD
        ? WORLD_DEM_CACHE
        : z <= DEM_Z_MACRO
          ? MACRO_DEM_CACHE
          : DETAIL_DEM_CACHE;
  const grid = cache.get(key);
  if (!grid) {
    if (queueIfMissing) requestDemTile(z, wrappedTx, ty);
    return null;
  }
  const u = (fx - tx) * 255;
  const v = (fy - ty) * 255;
  const x0 = Math.max(0, Math.min(255, Math.floor(u)));
  const y0 = Math.max(0, Math.min(255, Math.floor(v)));
  const x1 = Math.min(255, x0 + 1);
  const y1 = Math.min(255, y0 + 1);
  const sx = u - x0;
  const sy = v - y0;

  const h00 = grid[y0 * 256 + x0];
  const h10 = grid[y0 * 256 + x1];
  const h01 = grid[y1 * 256 + x0];
  const h11 = grid[y1 * 256 + x1];
  const top = h00 + (h10 - h00) * sx;
  const bot = h01 + (h11 - h01) * sx;
  return top + (bot - top) * sy;
}

export type GeoDemResolution = 'detail' | 'mid' | 'macro' | 'world' | 'global';

/**
 * Sample real-Earth elevation in meters with 5-tier automatic fallback (Z11 Detail -> Z9 Mid -> Z5 Macro -> Z3 Continental -> Z2 Global):
 * - `'detail'` (Z11 ~76m/px): Crisp alpine ridges & canyons in wilderness
 * - `'mid'` (Z9 ~305m/px): True geological hills & mountain-city slopes WITHOUT 76m skyscraper radar spikes!
 */
export function sampleRealElevationMeters(
  lat: number,
  lng: number,
  preferMacro: boolean | GeoDemResolution = false,
): number | null {
  const res: GeoDemResolution =
    typeof preferMacro === 'string' ? preferMacro : preferMacro ? 'macro' : 'detail';
  if (res === 'detail') {
    const detail11 = sampleGridAt(lat, lng, DEM_Z_DETAIL, true);
    if (detail11 !== null) return detail11;
  }
  if (res === 'detail' || res === 'mid') {
    const mid9 = sampleGridAt(lat, lng, DEM_Z_MID, true);
    if (mid9 !== null) return mid9;
  }
  if (res === 'detail' || res === 'mid' || res === 'macro') {
    const macro = sampleGridAt(lat, lng, DEM_Z_MACRO, true);
    if (macro !== null) return macro;
  }
  if (res !== 'global') {
    const world = sampleGridAt(lat, lng, DEM_Z_WORLD, true);
    if (world !== null) return world;
  }
  return sampleGridAt(lat, lng, DEM_Z_GLOBAL, true);
}

/**
 * Real-World Metropolitan Built-Up Urban Agglomeration Clusters (lat, lng, radiusKm, weight):
 * Painted ONLY on real dry land (meters > 0.6) so metropolitan footprints like Greater Shanghai / Yangtze Delta,
 * Beijing-Tianjin, Pearl River Delta, Chengdu-Chongqing & Greater Tokyo naturally hug real coastlines, bays & lakes!
 */
const REAL_URBAN_CORES: [number, number, number][] = [
  // 长三角大上海都市圈 (覆盖上海全域浦西+浦东川沙/祝桥/临港+宝山+嘉定+闵行+松江+青浦+奉贤 + 昆山/苏州/杭州/南京)
  [31.23, 121.47, 30], // 上海中心城 (浦西 + 陆家嘴)
  [31.21, 121.66, 26], // 浦东新区 / 张江 / 川沙 / 曹路
  [31.08, 121.74, 22], // 祝桥 / 惠南 / 浦东东海沿岸
  [31.39, 121.46, 20], // 宝山 / 吴淞 / 罗店
  [31.38, 121.26, 19], // 嘉定 / 安亭
  [31.05, 121.42, 22], // 闵行 / 三林 / 周浦 / 奉贤
  [31.04, 121.22, 18], // 松江 / 青浦
  [31.38, 120.98, 15], // 昆山
  [31.30, 120.60, 21], // 苏州
  [31.56, 120.30, 17], // 无锡
  [31.81, 119.97, 15], // 常州
  [32.01, 120.89, 15], // 南通
  [30.75, 120.75, 14], // 嘉兴
  [30.27, 120.16, 22], // 杭州主城 + 萧山/余杭
  [29.87, 121.55, 17], // 宁波
  [32.06, 118.80, 22], // 南京
  [31.82, 117.23, 18], // 合肥
  // 京津冀都市圈
  [39.90, 116.40, 30], // 北京主城五环/六环
  [39.13, 117.20, 22], // 天津主城 + 滨海
  [38.98, 117.68, 14], // 天津滨海新区
  [39.53, 116.70, 12], // 廊坊
  [38.04, 114.51, 16], // 石家庄
  // 粤港澳大湾区都市圈
  [23.13, 113.26, 25], // 广州
  [23.02, 113.12, 17], // 佛山
  [22.92, 113.75, 18], // 东莞
  [22.55, 114.06, 21], // 深圳
  [22.32, 114.17, 14], // 香港
  [22.27, 113.57, 12], // 珠海/澳门
  // 中西部与东北核心都市区
  [30.57, 104.07, 24], // 成都
  [29.56, 106.55, 22], // 重庆
  [30.59, 114.31, 23], // 武汉
  [28.23, 112.94, 18], // 长沙
  [28.68, 115.86, 15], // 南昌
  [34.75, 113.62, 20], // 郑州
  [34.34, 108.94, 20], // 西安
  [36.65, 117.12, 18], // 济南
  [36.07, 120.38, 18], // 青岛
  [41.81, 123.43, 20], // 沈阳
  [43.82, 125.32, 17], // 长春
  [45.80, 126.53, 18], // 哈尔滨
  [26.07, 119.30, 15], // 福州
  [24.48, 118.09, 14], // 厦门
  [25.04, 102.72, 16], // 昆明
  [26.65, 106.63, 14], // 贵阳
  [22.82, 108.37, 15], // 南宁
  [36.06, 103.83, 13], // 兰州
  [43.83, 87.62, 15],  // 乌鲁木齐
  [25.03, 121.56, 16], // 台北
  // 东亚都市圈 (东京圈 / 京阪神 / 首尔首都圈)
  [35.68, 139.69, 30], // 东京 + 横滨 + 埼玉 + 千叶
  [35.44, 139.64, 18], // 横滨
  [34.69, 135.50, 22], // 大阪
  [35.01, 135.77, 14], // 京都
  [35.18, 136.91, 18], // 名古屋
  [33.59, 130.40, 15], // 福冈
  [43.06, 141.35, 15], // 札幌
  [37.57, 126.98, 25], // 首尔首都圈
];

/** Returns 0..1 urban built-up density on dry land at real (lat, lng) for realistic metropolitan cluster rendering! */
export function sampleUrbanClusterDensity(lat: number, lng: number): number {
  let maxD = 0;
  // Slight organic pixel-sprawl wobble so metropolitan footprints look organic (like real suburbs along roads!)
  const wobble = 1 + Math.sin(lat * 42 + lng * 31) * 0.14 + Math.cos(lat * 27 - lng * 48) * 0.12;
  for (let i = 0; i < REAL_URBAN_CORES.length; i++) {
    const [cLat, cLng, radKm] = REAL_URBAN_CORES[i];
    const dLat = Math.abs(lat - cLat);
    if (dLat > 0.65) continue;
    const dLng = Math.abs(lng - cLng);
    if (dLng > 0.8) continue;
    const kmLat = dLat * KM_PER_DEG_LAT;
    const kmLng = dLng * KM_PER_DEG_LAT * Math.cos((cLat * Math.PI) / 180);
    const distKm = Math.hypot(kmLat, kmLng);
    const effRad = radKm * wobble;
    if (distKm < effRad) {
      const dens = 1 - distKm / effRad;
      if (dens > maxD) maxD = dens;
    }
  }
  return maxD;
}

/** True if real Earth (lat, lng) is buildable dry urban landmass (strictly inland from ocean/estuary coastlines so ZERO roads ever spill into water!) */
export function isRealUrbanDryLand(lat: number, lng: number): boolean {
  const dens = sampleUrbanClusterDensity(lat, lng);
  if (dens < 0.12) return false;
  const m = sampleRealElevationMeters(lat, lng, 'detail') ?? sampleRealElevationMeters(lat, lng, 'macro');
  if (m === null) return dens > 0.25;
  if (m <= 0.65) return false;
  const buf = 0.007;
  const mN = sampleRealElevationMeters(lat + buf, lng, 'detail') ?? sampleRealElevationMeters(lat + buf, lng, 'macro');
  const mS = sampleRealElevationMeters(lat - buf, lng, 'detail') ?? sampleRealElevationMeters(lat - buf, lng, 'macro');
  const mE = sampleRealElevationMeters(lat, lng + buf, 'detail') ?? sampleRealElevationMeters(lat, lng + buf, 'macro');
  const mW = sampleRealElevationMeters(lat, lng - buf, 'detail') ?? sampleRealElevationMeters(lat, lng - buf, 'macro');
  if ((mN !== null && mN <= 0.5) || (mS !== null && mS <= 0.5) || (mE !== null && mE <= 0.5) || (mW !== null && mW <= 0.5)) {
    return false;
  }
  return true;
}

/**
 * Real-Earth Geographic Biome Pixel Classifier (True Deserts, Gobi, Loess Plateau, Steppe, Subtropical Forests,
 * Metropolitan Urban Clusters on Dry Land, Forested Hills, Alpine Ridges & True Relief-Aware Snowlines!)
 */
export function classifyRealEarthPixelColor(
  lat: number,
  lng: number,
  meters: number,
  hillShadeMeters: number,
  nearOcean: boolean,
  dither: boolean,
): string {
  // Wrap longitude to [-180, 180] for global biome lookup
  const nLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  const absLat = Math.abs(lat);

  // 1. Real Oceans, Seas & Coastal Pixel Wave Foam
  if (meters <= 0.6) {
    if (nearOcean) return dither ? '#d0ebff' : '#99d6ff';
    if (meters < -2800) return dither ? '#155494' : '#1864ab';
    if (meters < -400) return '#1c7ed6';
    if (meters < -60) return '#228be6';
    return dither ? '#74c0fc' : '#4dabf7';
  }

  // 1B. Real-Scale Metropolitan Urban Built-Up Footprint (ONLY on dry lowland/plain land — automatically hugs real coastlines, rivers & lakes!)
  if (meters > 0.6 && meters < 650 && absLat < 55) {
    const uDens = sampleUrbanClusterDensity(lat, nLng);
    if (uDens > 0.36) {
      // Dense metropolitan core: warm GBA parchment city blocks with crisp pixel street-grid dither!
      const blockHash = (Math.floor(lat * 240) + Math.floor(nLng * 240)) % 3 === 0;
      return dither ? (blockHash ? '#dfd0a8' : '#ede0bc') : '#e5d6ae';
    }
    if (uDens > 0.12) {
      // Suburban urban-fringe transition (warm sage-parchment satellite towns & industrial parks!)
      return dither ? '#d4d49c' : '#a8c27a';
    }
  }

  // 2. Polar Ice Caps & High Arctic Tundra (Greenland / Antarctica / High Arctic)
  if (absLat > 70 || (lat > 62 && nLng > -55 && nLng < -15 && meters > 400) || lat < -62) {
    return hillShadeMeters < -45 ? '#d0e2f0' : '#f4f9fc';
  }

  // Smooth organic regional boundary perturbation (eliminates straight vertical/horizontal biome seams!)
  const bWarp = Math.sin(lat * 0.65 + nLng * 0.45) * 0.9 + Math.cos(nLng * 0.72 - lat * 0.5) * 0.6;
  const ridgeRelief = Math.abs(hillShadeMeters);

  // 3. True Relief-Aware Snow-Capped Mountain Ranges!
  // - Flat Tibetan Plateau grasslands (4,200-4,900m flat!) stay lush green/golden alpine grassland.
  // - Steep high peaks & iconic snow-capped mountain chains (West Sichuan Gongga/Siguniang/Hengduan, NW Yunnan Yulong/Meili,
  //   Himalayas, Nyenchen Tanglha, Kunlun, Tianshan, Qilian & Mt. Fuji!) light up as crisp white snow ridges!
  const inTibetanPlateau =
    lat >= 27.2 + bWarp * 0.35 &&
    lat <= 38.2 + bWarp * 0.35 &&
    nLng >= 77.0 + bWarp * 0.4 &&
    nLng <= 103.6 + bWarp * 0.65;
  const inSichuanYunnanAlps =
    lat >= 26.2 + bWarp * 0.3 &&
    lat <= 33.8 + bWarp * 0.3 &&
    nLng >= 97.5 + bWarp * 0.4 &&
    nLng <= 104.2 + bWarp * 0.4;
  const isJapanMaritime = lat > 32 && lat < 45 && nLng > 128 && nLng < 147;

  const isSnowPeak =
    // Extreme Himalayan / Kunlun / Karakoram / Tanggula glacier peaks (>5050m anywhere)
    meters >= 5050 ||
    // Steep alpine mountain ridges on the Tibetan Plateau & Kunlun/Himalayas (>4350m with real mountain relief -> keeps flat grasslands green!)
    (inTibetanPlateau && meters >= 4350 && ridgeRelief >= 115) ||
    // Iconic West Sichuan & NW Yunnan snow mountains (贡嘎/四姑娘山/稻城/玉龙雪山/梅里雪山/哈巴雪山: >3750m with ridge relief or >4250m)
    (inSichuanYunnanAlps && (meters >= 4250 || (meters >= 3750 && ridgeRelief >= 95))) ||
    // Tianshan / Altai / Qilian / Northern Xinjiang linear snow peaks (>3400m with mountain relief or >3950m)
    (lat >= 38.0 && lat <= 50.0 && nLng >= 72.0 && nLng <= 103.0 && (meters >= 3950 || (meters >= 3350 && ridgeRelief >= 90))) ||
    // Mt. Fuji & Japanese Alps (>3200m in maritime Japan)
    (isJapanMaritime && meters >= 3200) ||
    // High-latitude sub-arctic mountain snowlines
    (absLat >= 45 && meters >= Math.max(1650, 4050 - (absLat - 45) * 95));

  if (isSnowPeak) {
    return hillShadeMeters < -75 ? '#c4d8e8' : '#f2f8fc';
  }

  // 4. Sandy Beaches along real coastlines
  if (nearOcean && meters < 22) {
    return dither ? '#efe0b1' : '#e4cf94';
  }

  // 5. Real-World Deserts & Gobi Basins (with organic wavy edges!)
  const inTaklamakan = lat >= 36.2 && lat <= 41.9 && nLng >= 75.5 && nLng <= 92.2 + bWarp * 0.5 && meters < 2100;
  const inJunggarDesert = lat >= 43.8 && lat <= 46.8 && nLng >= 84.0 && nLng <= 91.5 + bWarp * 0.5 && meters < 1200;
  const inGobiDesert = lat >= 37.6 + bWarp * 0.4 && lat <= 45.2 && nLng >= 92.2 + bWarp * 0.5 && nLng <= 109.5 + bWarp * 0.6 && meters < 2100;
  const inQaidam = lat >= 35.8 && lat <= 39.2 && nLng >= 90.2 && nLng <= 98.8 + bWarp * 0.4 && meters < 3350;
  const inSaharaArabia = lat >= 14.0 && lat <= 33.5 && nLng >= -17.0 && nLng <= 60.0 && meters < 2200;
  const inCentralAsiaDesert = lat >= 36.5 && lat <= 47.0 && nLng >= 52.0 && nLng <= 75.5 && meters < 1100;
  const inAusOutback = lat >= -31.5 && lat <= -19.0 && nLng >= 115.0 && nLng <= 142.0 && meters < 1200;
  const inUsSouthwest = lat >= 27.0 && lat <= 37.5 && nLng >= -117.5 && nLng <= -103.5 && meters < 1800;

  if (inTaklamakan || inSaharaArabia || inAusOutback) {
    if (hillShadeMeters > 35) return '#f2d894';
    if (hillShadeMeters < -35) return '#cfa052';
    return dither ? '#e8c474' : '#deb462';
  }
  if (inJunggarDesert || inGobiDesert || inQaidam || inCentralAsiaDesert || inUsSouthwest) {
    if (hillShadeMeters > 45) return '#dfd09c';
    if (hillShadeMeters < -45) return '#b59a69';
    return dither ? '#d1ba82' : '#c4aa74';
  }

  // 6. Real Qinghai-Tibet Plateau Biomes (Lush Grasslands across flat basins, rocky ridges on steep slopes!)
  if (inTibetanPlateau && meters >= 2600) {
    if (meters < 4150) {
      if (hillShadeMeters > 75) return '#84c462';
      if (hillShadeMeters < -75) return '#4b823f';
      return dither ? '#6eb054' : '#60a34a';
    }
    if (meters < 4850) {
      if (hillShadeMeters > 80) return '#a9bf6b';
      if (hillShadeMeters < -80) return '#6c8044';
      return dither ? '#8ea858' : '#7f994d';
    }
    if (hillShadeMeters > 85) return '#b8ab86';
    if (hillShadeMeters < -85) return '#6b6352';
    return dither ? '#998e70' : '#877e63';
  }

  // 7. Loess Plateau (黄土高原 — organic boundary!) & Dry Inner Mongolia Steppe (内蒙古草原)
  const inLoessPlateau =
    lat >= 34.4 + bWarp * 0.4 &&
    lat <= 40.4 + bWarp * 0.4 &&
    nLng >= 103.6 + bWarp * 0.65 &&
    nLng <= 113.8 + bWarp * 0.6 &&
    meters > 650 &&
    meters < 2400;
  const inSteppe =
    (lat >= 40.4 && lat <= 49.5 && nLng >= 108.5 && nLng <= 121.0) ||
    (lat >= 45.0 && lat <= 54.0 && nLng >= 45.0 && nLng <= 108.5 && meters < 1400);
  if (inLoessPlateau) {
    if (hillShadeMeters > 55) return '#d4c37b';
    if (hillShadeMeters < -55) return '#9c8a50';
    return dither ? '#c2b068' : '#b3a05d';
  }
  if (inSteppe) {
    if (hillShadeMeters > 45) return '#9ec267';
    if (hillShadeMeters < -45) return '#6d8c45';
    return dither ? '#8ab056' : '#7ea34d';
  }

  // 8. High Alpine Mountains (2600m .. snowline) — warm rocky umber / high mountain ridges
  if (meters >= 2600) {
    if (hillShadeMeters > 85) return '#b59e78';
    if (hillShadeMeters < -85) return '#6b5a44';
    return dither ? '#968260' : '#857354';
  }

  // 9. Medium Forested Mountains (1250m .. 2600m — Yunnan Plateau, Western Sichuan foothills, Qinling, Taihang)
  if (meters >= 1250) {
    if (hillShadeMeters > 70) return '#75a653';
    if (hillShadeMeters < -70) return '#3a6634';
    return dither ? '#568742' : '#4a7a3b';
  }

  // 10. Forested Hills & Low Mountains (260m .. 1250m — Zhejiang/Fujian hills, Hunan/Jiangxi, Sichuan rim, Japan hills)
  if (meters >= 260) {
    if (hillShadeMeters > 28) return '#54b54f';
    if (hillShadeMeters < -28) return '#22692e';
    return dither ? '#348f3e' : '#2d8237';
  }

  // 10B. Jiangnan / Coastal Rolling Foothills & Knolls (55m .. 260m — Sheshan, Suzhou/Wuxi hills, Hangzhou hills, Nanjing Purple Mt.)
  if (meters >= 55) {
    if (hillShadeMeters > 12) return '#66c954';
    if (hillShadeMeters < -12) return '#2b7d34';
    return dither ? '#429e42' : '#38913b';
  }

  // 11. Alluvial Plains, River Valleys & Rolling Lowland Swells (0 .. 55m — Yangtze Delta, North China Plain, Kanto Plain)
  // Combine fine SRTM micro-slope shading with natural geological rolling hillock swells so plains NEVER look dead-flat!
  const hillockWave =
    Math.sin(lat * 85.0 + nLng * 68.0) * 0.55 +
    Math.cos(lat * 142.0 - nLng * 118.0) * 0.45 +
    Math.sin((lat + nLng) * 230.0) * 0.25;
  const localRelief = hillShadeMeters + hillockWave * 5.2;
  if (meters >= 18 || hillockWave > 0.52) {
    if (localRelief > 4.2) return '#6ad158';
    if (localRelief < -4.2) return '#2f8737';
    return dither ? '#42ab43' : '#399c3c';
  }
  if (localRelief > 4.5) return '#63cc54';
  if (localRelief < -4.5) return '#338f3a';
  return dither ? '#48b546' : '#3ea63e';
}

/**
 * Iconic Real-World Local Hills, Volcanic Knolls & Scenic Peaks (`真实著名丘陵与山峰地标`)
 * Restores famous sub-2km local hills (like Shanghai's Songjiang Nine Peaks 松江九峰：佘山、天马山、辰山、小昆山!)
 * that coarse 300m Z9 DEM tiles otherwise blur out, while enhancing famous urban-fringe peaks across East Asia!
 * Format: [lat, lng, radiusKm, peakLiftUnits]
 */
/**
 * Real-World Peak Meter Floors (`1 单位 = 1 真实米`!)
 * Guarantees narrow sub-kilometer hills (like Shanghai's 99m Sheshan!) and famous summits
 * reach their exact real-world meter elevation even while coarse Z5/Z9 tiles are still streaming in!
 * Format: [lat, lng, radiusKm, realPeakMeters]
 */
const REAL_REGIONAL_HILLS: [number, number, number, number][] = [
  // 上海松江九峰 (真实海拔米数！1:1 比例下 99m 高、底宽 2.8km，坡度自然平缓可徒步登顶！)
  [31.096, 121.196, 1.5, 99.0],   // 西佘山 & 东佘山 (99m)
  [31.076, 121.152, 1.4, 98.2],   // 天马山 (98.2m)
  [31.082, 121.182, 1.1, 71.4],   // 辰山 (71.4m)
  [31.042, 121.118, 1.2, 54.3],   // 小昆山 (54.3m)
  [31.112, 121.162, 1.0, 52.0],   // 凤凰山 (52m)
  [30.735, 121.345, 1.1, 103.7],  // 大金山岛 (103.7m)
  // 苏锡常与杭嘉湖江南名山 (真实海拔米数)
  [31.392, 120.952, 1.4, 84.0],   // 昆山玉峰山 (84m)
  [31.265, 120.495, 3.2, 341.7],  // 苏州穹窿山・天平山 (341.7m)
  [31.338, 120.575, 0.9, 34.3],   // 苏州虎丘山 (34.3m)
  [31.542, 120.218, 2.8, 328.9],  // 无锡惠山 (328.9m)
  [30.618, 119.865, 5.8, 719.0],  // 莫干山脉 (719m)
  [30.340, 119.430, 8.5, 1506.0], // 天目山脉 (1506m)
  [30.245, 120.102, 3.2, 314.0],  // 杭州北高峰 (314m)
  [32.068, 118.852, 4.2, 448.9],  // 南京紫金山 (448.9m)
  // 全国与东亚著名高山 (真实海拔米数)
  [36.256, 117.101, 9.5, 1545.0], // 泰山玉皇顶 (1545m)
  [30.133, 118.165, 10.5, 1864.8], // 黄山莲花峰・光明顶 (1864.8m)
  [29.558, 115.988, 8.5, 1474.0], // 庐山汉阳峰 (1474m)
  [36.185, 120.625, 7.2, 1132.7], // 青岛崂山 (1132.7m)
  [26.062, 119.395, 5.2, 925.0],  // 福州鼓山 (925m)
  [29.545, 106.605, 4.5, 681.5],  // 重庆南山 (681.5m)
  [39.992, 116.188, 4.8, 575.0],  // 北京香山鬼见愁 (575m)
  [23.182, 113.298, 4.2, 382.0],  // 广州白云山摩星岭 (382m)
  [22.576, 114.215, 5.2, 943.7],  // 深圳梧桐山 (943.7m)
  [22.502, 113.918, 2.4, 336.0],  // 深圳大南山 (336m)
  [22.275, 114.145, 2.8, 552.0],  // 香港太平山 (552m)
  [22.352, 114.188, 2.6, 495.0],  // 香港狮子山 (495m)
  [25.170, 121.555, 6.2, 1120.0], // 台北阳明山七星山 (1120m)
  [35.065, 135.838, 5.0, 848.0],  // 京都比叡山 (848m)
  [35.361, 138.727, 13.5, 3776.0], // 富士山主峰 (3776m)
];

function sampleRegionalHillLift3D(lat: number, lng: number): number {
  let lift = 0;
  for (let i = 0; i < REAL_REGIONAL_HILLS.length; i++) {
    const [hLat, hLng, radKm, peakU] = REAL_REGIONAL_HILLS[i];
    const dLat = Math.abs(lat - hLat);
    if (dLat > 0.14) continue;
    const dLng = Math.abs(lng - hLng);
    if (dLng > 0.16) continue;
    const kmLat = dLat * KM_PER_DEG_LAT;
    const kmLng = dLng * KM_PER_DEG_LAT * Math.cos((hLat * Math.PI) / 180);
    const dKm = Math.hypot(kmLat, kmLng);
    if (dKm < radKm) {
      const t = 1 - dKm / radKm;
      // Natural ridge-and-shoulder bell profile with subtle rocky spur ridges!
      const ang = Math.atan2(kmLat, kmLng);
      const spur = 1 + 0.14 * Math.sin(ang * 3 + i * 1.7) + 0.08 * Math.cos(ang * 5 - i);
      const h = peakU * Math.pow(t, 1.55) * (0.35 + 0.65 * (3 * t * t - 2 * t * t * t)) * spur;
      if (h > lift) lift = h;
    }
  }
  return lift;
}

/**
 * Multi-scale 3D countryside landform sculptor (`真实坡度感丘陵、岗地、台地与山谷起伏`):
 * Produces clearly visible, walkable 8°–26° grassy slopes, undulating ridges, and stepped knolls
 * across rural forests & plains while staying strictly >= 0 on low plains so dry land NEVER floods!
 */
/**
 * Subtle 1:1 meter-scale natural meadow & hillside micro-topography (`0 .. +3.6m` gentle swells over 120–260m):
 * Adds pleasant real-world grassy hillocks on plains while preserving 100% walkable `< 4°` natural grades!
 */
function sculptCountrysideRelief3D(wx: number, wz: number): number {
  const broadA = Math.sin(wx * 0.014 + wz * 0.011 + 0.8);
  const broadB = Math.cos(wx * 0.0095 - wz * 0.015 + 2.1);
  const broadWave = (broadA * 0.55 + broadB * 0.45) * 0.5 + 0.5;
  const rollingMeadow = Math.pow(broadWave, 1.45) * 1.85;
  const localGrade =
    (Math.sin(wx * 0.042 + wz * 0.031) * 0.5 + Math.cos(wx * 0.028 - wz * 0.045) * 0.5 + 1.0) * 0.32;
  return rollingMeadow + localGrade;
}

/** Gentle 1:10 scale mountain rock detail (`0..+2.2u`) so Z11 DEM peaks have natural crags while staying 100% walkable */
function sculptAlpineMountainRidges3D(wx: number, wz: number, meters: number): number {
  if (meters <= 80) return 0;
  const strength = smoothstepLocal(80, 900, meters);
  const s1 = Math.sin(wx * 0.024 + wz * 0.019 + 0.9) * 0.5 + 0.5;
  const s2 = Math.cos(wx * 0.042 - wz * 0.036 + 1.7) * 0.5 + 0.5;
  return (s1 * 1.45 + s2 * 0.75) * strength;
}

function microSculpt(wx: number, wz: number): number {
  const rollingHills =
    Math.sin(wx * 0.014 + wz * 0.011) * 1.2 +
    Math.cos(wx * 0.021 - wz * 0.017 + 1.4) * 0.85;
  const micro =
    Math.sin(wx * 0.065 + wz * 0.048) * 0.32 +
    Math.cos(wx * 0.042 - wz * 0.072) * 0.24;
  return rollingHills + micro;
}

function smoothstepLocal(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-4, e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Checks if (lat, lng) lies inside a real inland lake (Taihu, West Lake, Poyang, etc.) — returns 0..1 depth factor */
function sampleInlandLakeFactor(lat: number, lng: number): number {
  const nLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  const ripple =
    Math.sin(lat * 190 + nLng * 230) * 0.13 +
    Math.cos(lat * 370 - nLng * 290) * 0.08 +
    Math.sin(lat * 680 + nLng * 510) * 0.05;
  for (let li = 0; li < REAL_INLAND_LAKES.length; li++) {
    const lk = REAL_INLAND_LAKES[li];
    if (Math.abs(lat - lk.lat) > lk.ryDeg * 1.45 || Math.abs(nLng - lk.lng) > lk.rxDeg * 1.45) continue;
    const dx = nLng - lk.lng;
    const dy = lat - lk.lat;
    const c = Math.cos(lk.rotRad ?? 0);
    const s = Math.sin(lk.rotRad ?? 0);
    const rx = dx * c + dy * s;
    const ry = -dx * s + dy * c;
    const normR = Math.hypot(rx / lk.rxDeg, ry / lk.ryDeg) + ripple;
    if (normR < 0.98) {
      return Math.min(1, (0.98 - normR) / 0.26);
    }
  }
  return 0;
}

/** Checks if (lat, lng) lies inside a major continental river channel from REAL_WORLD_RIVERS — returns 0..1 depth factor */
function sampleContinentalRiverFactor(lat: number, lng: number): number {
  const nLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  const warpScale = 0.0068;
  const wLat =
    lat +
    Math.sin(nLng * 28.5 + lat * 19.2) * warpScale +
    Math.cos(nLng * 67.0 - lat * 53.0) * (warpScale * 0.38);
  const wLng =
    nLng +
    Math.cos(lat * 26.8 - nLng * 21.4) * warpScale +
    Math.sin(lat * 61.0 + nLng * 49.0) * (warpScale * 0.38);
  const cosLat = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  const segs = getCompiledHydroSegs();

  let bestRatio = 999;
  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    if (wLat < sg.minLat || wLat > sg.maxLat || wLng < sg.minLng || wLng > sg.maxLng) continue;
    const vx = (sg.lng2 - sg.lng1) * cosLat * KM_PER_DEG_LAT;
    const vz = (sg.lat2 - sg.lat1) * KM_PER_DEG_LAT;
    const px = (wLng - sg.lng1) * cosLat * KM_PER_DEG_LAT;
    const pz = (wLat - sg.lat1) * KM_PER_DEG_LAT;
    const lenSq = vx * vx + vz * vz;
    const t = lenSq > 0.0001 ? Math.max(0, Math.min(1, (px * vx + pz * vz) / lenSq)) : 0;
    const distKm = Math.hypot(px - vx * t, pz - vz * t);
    const ratio = distKm / Math.max(0.12, sg.halfWidthKm);
    if (ratio < bestRatio) bestRatio = ratio;
  }
  if (bestRatio >= 1.0) return 0;
  return Math.min(1, (1.0 - bestRatio) / 0.38);
}

/**
 * Sample real-Earth geographic 3D terrain height when in World Tour mode.
 * STRICT 1:1 LAND/WATER CONSISTENCY WITH 2D MAP:
 * - Dry plains & forests (`meters > 0.6` or inland polders where `macroM > 2.0`) NEVER drop below `WATER_LEVEL_3D` (`-0.35m`),
 *   fixing the bug where negative `microSculpt` waves submerged green Yangtze/plain forests (`e.g. 31.08°N, 121.08°E`) under fake ocean water!
 * - Real oceans, real inland lakes (`太湖`, `西湖`, etc.), and real river channels (`黄浦江`, `长江`, etc.) carve cleanly below `-0.35m`!
 */
export function sampleGeoTerrainHeight3D(
  wx: number,
  wz: number,
  preferMacro = false,
): number | null {
  if (!activeOrigin) return null;
  const geo = worldToGeo(wx, wz, activeOrigin);
  if (!geo) return null;
  const meters = sampleRealElevationMeters(geo.lat, geo.lng, preferMacro);
  const midM = preferMacro ? meters : sampleRealElevationMeters(geo.lat, geo.lng, 'mid');
  const macroM = preferMacro ? meters : sampleRealElevationMeters(geo.lat, geo.lng, 'macro');
  const micro = preferMacro ? 0 : microSculpt(wx, wz);
  const uDens = sampleUrbanClusterDensity(geo.lat, geo.lng);
  // Attenuate small high-frequency bumps inside dense downtown streets (`uDens > 0.24`), keep full 3D rolling slopes in suburbs, hills & countryside!
  const ruralFactor = preferMacro ? 0 : 1 - smoothstepLocal(0.16, 0.38, uDens);
  const countrysideRelief = preferMacro ? 0 : sculptCountrysideRelief3D(wx, wz) * ruralFactor;
  const namedHillLift = preferMacro ? 0 : sampleRegionalHillLift3D(geo.lat, geo.lng);

  // True ocean/sea check: prevents noisy 0m inland SRTM polders (like Qingpu/Kunshan 40km inland where macroM > 2.2m) from becoming fake seas!
  const isTrueOcean =
    meters !== null &&
    meters <= 0.6 &&
    (macroM === null || macroM <= 2.2 || meters <= -2.0);

  let elev: number;
  if (meters === null) {
    elev = Math.max(1.45 + countrysideRelief, realMetersToWorldY3D(namedHillLift));
  } else if (isTrueOcean) {
    // Real Ocean / Sea / Bay / Estuary
    elev = Math.max(-3.2, -0.58 + Math.min(0, meters) * 0.06) + micro * 0.04;
    if (elev > -0.42) elev = -0.45;
  } else {
    // Suppress ONLY 76m single-block Z11 skyscraper radar spikes inside built-up areas using Z9 (`~305m` geological hill resolution),
    // so 100% of real hills, mountain cities (Chongqing/HK/Qingdao) & wilderness peaks stay completely intact!
    const filteredUrbanM =
      uDens > 0.2 && midM !== null
        ? midM + Math.max(-3.5, Math.min(4.0, (meters - midM) * 0.18))
        : meters;
    const realMeters = Math.max(3.5, filteredUrbanM, namedHillLift);
    const baseY = Math.max(0.95, realMetersToWorldY3D(realMeters));
    const ridgeDetail = preferMacro ? 0 : sculptAlpineMountainRidges3D(wx, wz, realMeters) * (0.35 + 0.65 * ruralFactor);
    elev = baseY + countrysideRelief + ridgeDetail + (realMeters > 80 ? micro * 0.22 * (0.3 + 0.7 * ruralFactor) : 0);
  }

  // Carve real inland lakes (e.g. Taihu Lake 太湖, West Lake 西湖) & major continental rivers outside downtown so 2D & 3D water match 1:1!
  if (!preferMacro && !isTrueOcean) {
    const lakeDepth = sampleInlandLakeFactor(geo.lat, geo.lng);
    if (lakeDepth > 0) {
      const targetLakeY = -0.55 - lakeDepth * 1.65;
      elev = elev * (1 - lakeDepth) + targetLakeY * lakeDepth;
    } else if (Math.hypot(wx, wz) > 2250) {
      const rivDepth = sampleContinentalRiverFactor(geo.lat, geo.lng);
      if (rivDepth > 0) {
        const targetRivY = -0.55 - rivDepth * 1.35;
        elev = elev * (1 - rivDepth) + targetRivY * rivDepth;
      }
    }
  }

  // Civil-Engineered 3D Urban Plain & Hillside Grading within ±2,250u (`±22.5km`):
  // - Flat alluvial cities (`localHillM < 22m`, e.g. Shanghai downtown) get smooth avenues with gentle multi-km contour + crisp riverbanks.
  // - Real hills >= 22m (`虎丘 34m`, `辰山 71m`, `佘山 99m`, `西湖群山`, `紫金山`, `太平山`) and mountain-city slopes (`重庆`/`香港`/`青岛`)
  //   smoothly retain 100% of their true Z9 geological slopes & peaks!
  if (!preferMacro) {
    const distFromOrigin = Math.hypot(wx, wz);
    const localMidM = Math.max(4.0, midM ?? macroM ?? 5.0);
    const localHillM = Math.max(localMidM, namedHillLift);
    if (distFromOrigin < 2250 && !isTrueOcean) {
      const activeCityId = activeOrigin.startCityId ?? 'shanghai';
      const rivSigned = getShanghaiRiverSignedDist(wx, wz, activeCityId);
      const riverElev = -1.65;
      const originBaseM = Math.max(
        4.0,
        sampleRealElevationMeters(activeOrigin.originLat, activeOrigin.originLng, 'mid') ?? 5.0,
      );
      const relReliefM = localHillM - originBaseM;
      // Only apply flat-plain smoothing where terrain is genuinely flat alluvial plain (`relReliefM < 18m` & `namedHillLift < 20m`);
      // any real hill, ridge, or sloped mountain-city district (`relReliefM >= 18m` or `namedHillLift >= 20m`) keeps its full natural slope!
      const plainMask =
        (1 - smoothstepLocal(1850, 2250, distFromOrigin)) *
        (distFromOrigin < 145 ? 1 : 1 - smoothstepLocal(16, 36, Math.max(relReliefM, namedHillLift - 6)));
      if (plainMask > 0.001 || rivSigned < 2.8) {
        const gentlePlainM = originBaseM + Math.max(-3.0, Math.min(12.0, relReliefM * 0.35));
        const basePlainY = Math.max(1.65, realMetersToWorldY3D(gentlePlainM));
        const broadDistrictContour =
          smoothstepLocal(150, 760, distFromOrigin) *
          (Math.sin(wx * 0.0015 + wz * 0.0012) * 0.52 + Math.cos(wx * 0.0023 - wz * 0.0019) * 0.30);
        const dryCityY = basePlainY + broadDistrictContour;
        if (rivSigned < 0) {
          return riverElev;
        }
        if (rivSigned < 2.8) {
          const bankT = rivSigned / 2.8;
          const smoothBank = bankT * bankT * (3 - 2 * bankT);
          const shoreTopY = Math.max(0.95, elev) * (1 - plainMask) + dryCityY * plainMask;
          return riverElev * (1 - smoothBank) + shoreTopY * smoothBank;
        }
        elev = Math.max(0.95, elev) * (1 - plainMask) + dryCityY * plainMask;
      }
    }
  }

  return elev;
}

export interface RealWorldCorridor {
  id: string;
  label: string;
  kind: 'highway' | 'rail' | 'ferry';
  /** Authentic real-Earth GPS [lat, lng] waypoints curving along valleys, plains & coastlines */
  points: [number, number][];
}

/**
 * Real-World East Asia Inter-City Highway, High-Speed Rail / Shinkansen & Maritime Corridors!
 * Projected dynamically onto real Earth coordinates via geoToWorld(lat, lng).
 */
export const REAL_WORLD_CORRIDORS: RealWorldCorridor[] = [
  // G2 京沪高速 & G1 京哈高速 (全线陆地走向，绕开太湖与渤海湾，在各城外环立交与市内主干道无缝衔接!)
  {
    id: 'g2_jinghu',
    label: 'G2 京沪高速',
    kind: 'highway',
    points: [
      [31.23, 121.47], // 上海 (外环西/嘉定安亭立交接入)
      [31.30, 120.59], // 苏州
      [31.57, 120.30], // 无锡 (太湖北岸陆地走廊)
      [31.81, 119.97], // 常州
      [32.06, 118.80], // 南京
      [34.21, 117.28], // 徐州
      [36.65, 117.12], // 济南
      [39.13, 117.20], // 天津
      [39.90, 116.40], // 北京
      [39.94, 119.60], // 秦皇岛 (山海关陆路走廊)
      [41.80, 123.43], // 沈阳
      [43.82, 125.32], // 长春
      [45.80, 126.53], // 哈尔滨
    ],
  },
  // 京沪-京哈高铁 (接入各城城郊高铁站枢纽，绝不穿入市中心!)
  {
    id: 'hsr_jinghu',
    label: '京沪高铁',
    kind: 'rail',
    points: [
      [31.195, 121.318], // 上海虹桥高铁站
      [31.32, 120.62],   // 苏州北
      [31.49, 120.31],   // 无锡东
      [32.00, 118.80],   // 南京南
      [32.94, 117.39],   // 蚌埠南
      [34.27, 117.19],   // 徐州东
      [36.67, 116.90],   // 济南西
      [39.06, 117.07],   // 天津南
      [39.86, 116.38],   // 北京南
      [41.80, 123.43],
      [45.80, 126.53],
    ],
  },
  // G60 沪昆高速 — G15 东南沿海高速 (经松江—嘉兴—杭州—绍兴—宁波全陆地走廊，绝不横穿杭州湾海面!)
  {
    id: 'g15_coastal',
    label: 'G60/G15 沪杭沈海高速',
    kind: 'highway',
    points: [
      [31.23, 121.47], // 上海 (外环西南莘庄/松江立交接入)
      [30.76, 120.75], // 嘉兴
      [30.27, 120.15], // 杭州
      [30.00, 120.58], // 绍兴
      [29.87, 121.55], // 宁波
      [28.66, 121.42], // 台州
      [28.00, 120.70], // 温州
      [26.07, 119.30], // 福州
      [24.87, 118.67], // 泉州
      [24.48, 118.09], // 厦门
      [23.35, 116.68], // 汕头
      [23.11, 114.42], // 惠州
      [22.54, 114.06], // 深圳
      [22.32, 114.17], // 香港
    ],
  },
  // G4 京港澳高速 (纵贯南北内陆核心大都市圈：北京 -> 石家庄 -> 郑州 -> 武汉 -> 长沙 -> 广州 -> 东莞 -> 深圳 -> 香港)
  {
    id: 'g4_guangshen',
    label: 'G4 京港澳高速',
    kind: 'highway',
    points: [
      [39.90, 116.40], // 北京
      [38.04, 114.51], // 石家庄
      [34.75, 113.62], // 郑州
      [30.59, 114.31], // 武汉
      [28.23, 112.94], // 长沙
      [23.13, 113.26], // 广州
      [22.92, 113.75], // 东莞
      [22.54, 114.06], // 深圳
      [22.32, 114.17], // 香港
    ],
  },
  // 沪昆-京广高铁 (由城西上海虹桥高铁站引出，经松江南连杭州东、长沙南、广州南、西九龙)
  {
    id: 'hsr_coastal',
    label: '沪广高铁',
    kind: 'rail',
    points: [
      [31.195, 121.318], // 上海虹桥高铁站
      [30.98, 121.20],   // 松江南
      [30.29, 120.21],   // 杭州东
      [28.68, 115.86],   // 南昌西
      [28.15, 113.06],   // 长沙南
      [22.99, 113.27],   // 广州南
      [22.61, 114.03],   // 深圳北
      [22.30, 114.16],   // 香港西九龙
    ],
  },
  // G42 沪蓉高速 (南京 -> 合肥 -> 武汉 -> 宜昌 -> 重庆 -> 成都)
  {
    id: 'g42_hurong',
    label: 'G42 沪蓉高速',
    kind: 'highway',
    points: [
      [32.06, 118.80], // 南京
      [31.82, 117.23], // 合肥
      [30.59, 114.31], // 武汉
      [30.69, 111.29], // 宜昌
      [29.56, 106.55], // 重庆
      [30.57, 104.06], // 成都
    ],
  },
  // G30 连霍 — G5 京昆高速 (郑州 -> 西安 -> 汉中 -> 成都 -> 昆明)
  {
    id: 'g5_jingkun',
    label: 'G5 西成昆高速',
    kind: 'highway',
    points: [
      [34.75, 113.62], // 郑州
      [34.34, 108.94], // 西安
      [33.07, 107.03], // 汉中
      [30.57, 104.06], // 成都
      [28.87, 104.62], // 宜宾
      [25.04, 102.72], // 昆明
    ],
  },
  // 日本东海道・山阳・东北新干线
  {
    id: 'jp_shinkansen',
    label: '东海道新干线',
    kind: 'rail',
    points: [
      [33.59, 130.40], // 福冈
      [34.39, 132.46], // 广岛
      [34.73, 135.50], // 新大阪
      [34.98, 135.76], // 京都站
      [35.17, 136.88], // 名古屋
      [35.68, 139.76], // 东京站
      [38.26, 140.88], // 仙台
      [40.82, 140.74], // 新青森
      [43.06, 141.35], // 札幌
    ],
  },
  // 日本东名・名神・山阳・东北自动车道 (陆路走廊，绕开骏河湾与伊势湾海面)
  {
    id: 'jp_tomei',
    label: '东名高速',
    kind: 'highway',
    points: [
      [33.59, 130.40], // 福冈
      [34.39, 132.46], // 广岛
      [34.69, 135.50], // 大阪
      [35.01, 135.77], // 京都
      [35.18, 136.91], // 名古屋
      [34.98, 138.38], // 静冈
      [35.68, 139.69], // 东京
      [38.27, 140.87], // 仙台
    ],
  },
  // 东海跨海航线 (上海外高桥/吴淞口 <-> 福冈 / 冲绳)
  {
    id: 'ferry_sh_jp',
    label: '东海航线',
    kind: 'ferry',
    points: [
      [31.36, 121.62], // 上海外高桥港
      [32.60, 126.20],
      [33.59, 130.40], // 福冈博多港
    ],
  },
  {
    id: 'ferry_sh_ok',
    label: '沪冲航线',
    kind: 'ferry',
    points: [
      [31.36, 121.62], // 上海外高桥港
      [28.70, 124.90],
      [26.21, 127.68], // 冲绳那霸港
    ],
  },
];

export interface RealWorldRiver {
  id: string;
  name: string;
  widthKm: number;
  points: [number, number][]; // [lat, lng] upstream source -> wide river mouth
}

/**
 * Dense Geographically Accurate Real-World River Courses (rendered via Catmull-Rom smooth curves
 * with progressive upstream-to-estuary width tapering — ZERO jagged V polylines!).
 */
export const REAL_WORLD_RIVERS: RealWorldRiver[] = [
  {
    id: 'yangtze',
    name: '长江',
    widthKm: 7.8,
    points: [
      [34.10, 92.40], [33.00, 96.95], [30.00, 99.10], [27.55, 99.75], [26.85, 100.35],
      [26.58, 101.72], [27.20, 102.95], [28.15, 103.85], [28.76, 104.64], [28.89, 105.44],
      [29.22, 106.25], [29.56, 106.58], [29.71, 107.39], [30.30, 108.05], [30.81, 108.41],
      [31.02, 109.47], [31.07, 109.88], [30.83, 110.98], [30.69, 111.29], [30.32, 111.55],
      [30.33, 112.24], [29.72, 112.42], [29.82, 112.90], [29.43, 113.12], [29.95, 113.78],
      [30.56, 114.30], [30.40, 114.89], [30.21, 115.05], [29.86, 115.55], [29.73, 116.00],
      [29.82, 116.22], [30.15, 116.65], [30.51, 117.06], [30.67, 117.48], [30.94, 117.81],
      [31.34, 118.36], [31.68, 118.49], [32.06, 118.75], [32.22, 119.44], [32.24, 119.86],
      [31.92, 120.26], [31.98, 120.86], [31.76, 121.25], [31.42, 121.65], [31.32, 122.05],
    ],
  },
  {
    id: 'yellow_river',
    name: '黄河',
    widthKm: 6.2,
    points: [
      [34.90, 96.40], [34.50, 99.50], [33.40, 102.45], [35.25, 101.85], [35.95, 103.30],
      [36.06, 103.83], [36.55, 104.65], [37.51, 105.19], [37.98, 106.10], [38.48, 106.35],
      [39.65, 106.78], [40.76, 107.42], [40.65, 109.84], [40.25, 111.18], [39.10, 111.08],
      [37.52, 110.75], [36.14, 110.44], [35.48, 110.45], [34.62, 110.28], [34.78, 111.20],
      [34.92, 112.45], [34.91, 113.65], [34.88, 114.35], [35.38, 115.20], [36.18, 116.25],
      [36.73, 117.02], [37.18, 117.75], [37.58, 118.52], [37.78, 119.18],
    ],
  },
  {
    id: 'pearl_river',
    name: '珠江',
    widthKm: 5.4,
    points: [
      [25.20, 104.20], [24.90, 105.60], [24.55, 106.95], [23.75, 109.25], [23.38, 110.08],
      [23.48, 111.28], [23.15, 111.82], [23.05, 112.46], [23.14, 112.88], [23.12, 113.26],
      [22.78, 113.62], [22.35, 113.78],
    ],
  },
  {
    id: 'han_river',
    name: '汉江',
    widthKm: 3.4,
    points: [
      [33.07, 107.03], [32.69, 109.02], [32.65, 110.78], [32.02, 112.14],
      [31.18, 112.58], [30.65, 113.45], [30.56, 114.28],
    ],
  },
  {
    id: 'huai_river',
    name: '淮河',
    widthKm: 3.6,
    points: [
      [32.35, 113.40], [32.16, 114.35], [32.42, 115.65], [32.65, 116.80],
      [32.94, 117.39], [33.15, 118.55], [33.65, 119.45], [34.10, 120.25],
    ],
  },
  {
    id: 'qiantang',
    name: '钱塘江',
    widthKm: 4.2,
    points: [
      [29.15, 118.45], [29.47, 119.28], [29.80, 119.68], [30.05, 119.96],
      [30.20, 120.19], [30.31, 120.42], [30.36, 120.88],
    ],
  },
  {
    id: 'huangpu_macro',
    name: '黄浦江',
    widthKm: 0.95,
    points: [
      [30.965, 121.185],
      [30.985, 121.345],
      [31.012, 121.432], // 闵行第一湾
      [31.078, 121.458], // 徐浦大桥段
      [31.148, 121.464], // 前滩段
      [31.182, 121.456], // 徐汇滨江
      [31.192, 121.482], // 卢浦大桥 / 世博弯
      [31.208, 121.501], // 南浦大桥
      [31.224, 121.496], // 十六铺
      [31.239, 121.493], // 外滩—陆家嘴标志性大弯道西侧!
      [31.245, 121.499], // 外白渡桥 / 苏州河口
      [31.248, 121.522], // 北外滩—陆家嘴北滨江
      [31.258, 121.554], // 杨浦大桥
      [31.292, 121.564], // 复兴岛 / 军工路
      [31.344, 121.542], // 高桥段
      [31.398, 121.506], // 宝山吴淞口汇入长江口!
      [31.425, 121.502],
    ],
  },
  {
    id: 'suzhou_macro',
    name: '苏州河',
    widthKm: 0.44,
    points: [
      [31.265, 121.185],
      [31.242, 121.295],
      [31.228, 121.372], // 长宁/普陀湾
      [31.246, 121.418], // 普陀十八湾
      [31.243, 121.456], // 静安/闸北四行仓库段
      [31.245, 121.496], // 外白渡桥汇入黄浦江!
    ],
  },
  {
    id: 'songhua',
    name: '松花江',
    widthKm: 4.8,
    points: [
      [42.25, 127.60], [43.84, 126.55], [44.95, 125.35], [45.40, 124.82],
      [45.80, 126.53], [46.15, 128.40], [46.82, 130.36], [47.68, 132.50],
    ],
  },
  {
    id: 'yarlung_tsangpo',
    name: '雅鲁藏布江',
    widthKm: 4.0,
    points: [
      [29.80, 84.10], [29.32, 87.60], [29.30, 88.90], [29.26, 91.77],
      [29.20, 93.80], [29.70, 95.10], [28.40, 95.30],
    ],
  },
  {
    id: 'tarim_river',
    name: '塔里木河',
    widthKm: 2.8,
    points: [
      [40.50, 80.50], [41.15, 82.95], [41.22, 84.55], [41.02, 86.25], [40.15, 87.85],
    ],
  },
  {
    id: 'tone_river',
    name: '利根川',
    widthKm: 2.8,
    points: [
      [36.80, 139.02], [36.38, 139.06], [36.18, 139.68], [35.92, 140.15], [35.74, 140.86],
    ],
  },
  {
    id: 'yodo_river',
    name: '淀川',
    widthKm: 2.4,
    points: [
      [35.02, 135.90], [34.89, 135.70], [34.78, 135.60], [34.70, 135.42],
    ],
  },
];

export interface MapCapitalCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tier: 'national' | 'provincial' | 'world';
}

/** All 34 Chinese Provincial Capitals / Municipalities / SARs + Major World Cities */
export const PROVINCIAL_AND_WORLD_CAPITALS: MapCapitalCity[] = [
  { id: 'beijing', name: '北京', lat: 39.9042, lng: 116.4074, tier: 'national' },
  { id: 'shanghai', name: '上海', lat: 31.2304, lng: 121.4737, tier: 'national' },
  { id: 'tianjin', name: '天津', lat: 39.1256, lng: 117.1902, tier: 'provincial' },
  { id: 'chongqing', name: '重庆', lat: 29.5630, lng: 106.5516, tier: 'provincial' },
  { id: 'shijiazhuang', name: '石家庄', lat: 38.0428, lng: 114.5149, tier: 'provincial' },
  { id: 'taiyuan', name: '太原', lat: 37.8706, lng: 112.5489, tier: 'provincial' },
  { id: 'hohhot', name: '呼和浩特', lat: 40.8426, lng: 111.7492, tier: 'provincial' },
  { id: 'shenyang', name: '沈阳', lat: 41.8057, lng: 123.4315, tier: 'provincial' },
  { id: 'changchun', name: '长春', lat: 43.8171, lng: 125.3235, tier: 'provincial' },
  { id: 'harbin', name: '哈尔滨', lat: 45.8038, lng: 126.5349, tier: 'provincial' },
  { id: 'nanjing', name: '南京', lat: 32.0603, lng: 118.7969, tier: 'provincial' },
  { id: 'hangzhou', name: '杭州', lat: 30.2741, lng: 120.1551, tier: 'provincial' },
  { id: 'hefei', name: '合肥', lat: 31.8206, lng: 117.2272, tier: 'provincial' },
  { id: 'fuzhou', name: '福州', lat: 26.0745, lng: 119.2965, tier: 'provincial' },
  { id: 'nanchang', name: '南昌', lat: 28.6829, lng: 115.8582, tier: 'provincial' },
  { id: 'jinan', name: '济南', lat: 36.6512, lng: 117.1201, tier: 'provincial' },
  { id: 'zhengzhou', name: '郑州', lat: 34.7466, lng: 113.6254, tier: 'provincial' },
  { id: 'wuhan', name: '武汉', lat: 30.5928, lng: 114.3055, tier: 'provincial' },
  { id: 'changsha', name: '长沙', lat: 28.2282, lng: 112.9388, tier: 'provincial' },
  { id: 'guangzhou', name: '广州', lat: 23.1291, lng: 113.2644, tier: 'provincial' },
  { id: 'nanning', name: '南宁', lat: 22.8170, lng: 108.3665, tier: 'provincial' },
  { id: 'haikou', name: '海口', lat: 20.0440, lng: 110.1983, tier: 'provincial' },
  { id: 'chengdu', name: '成都', lat: 30.5728, lng: 104.0668, tier: 'provincial' },
  { id: 'guiyang', name: '贵阳', lat: 26.6470, lng: 106.6302, tier: 'provincial' },
  { id: 'kunming', name: '昆明', lat: 25.0389, lng: 102.7183, tier: 'provincial' },
  { id: 'lhasa', name: '拉萨', lat: 29.6525, lng: 91.1721, tier: 'provincial' },
  { id: 'xian', name: '西安', lat: 34.3416, lng: 108.9398, tier: 'provincial' },
  { id: 'lanzhou', name: '兰州', lat: 36.0611, lng: 103.8343, tier: 'provincial' },
  { id: 'xining', name: '西宁', lat: 36.6171, lng: 101.7782, tier: 'provincial' },
  { id: 'yinchuan', name: '银川', lat: 38.4872, lng: 106.2309, tier: 'provincial' },
  { id: 'urumqi', name: '乌鲁木齐', lat: 43.8256, lng: 87.6168, tier: 'provincial' },
  { id: 'hongkong', name: '香港', lat: 22.3193, lng: 114.1694, tier: 'provincial' },
  { id: 'macau', name: '澳门', lat: 22.1987, lng: 113.5439, tier: 'provincial' },
  { id: 'taipei', name: '台北', lat: 25.0330, lng: 121.5654, tier: 'provincial' },
  { id: 'seoul', name: '首尔', lat: 37.5665, lng: 126.9780, tier: 'world' },
  { id: 'tokyo', name: '东京', lat: 35.6762, lng: 139.6503, tier: 'world' },
  { id: 'osaka', name: '大阪', lat: 34.6937, lng: 135.5023, tier: 'world' },
  { id: 'ulaanbaatar', name: '乌兰巴托', lat: 47.8864, lng: 106.9057, tier: 'world' },
  { id: 'bangkok', name: '曼谷', lat: 13.7563, lng: 100.5018, tier: 'world' },
  { id: 'singapore', name: '新加坡', lat: 1.3521, lng: 103.8198, tier: 'world' },
  { id: 'delhi', name: '新德里', lat: 28.6139, lng: 77.2090, tier: 'world' },
  { id: 'moscow', name: '莫斯科', lat: 55.7558, lng: 37.6173, tier: 'world' },
  { id: 'london', name: '伦敦', lat: 51.5074, lng: -0.1278, tier: 'world' },
  { id: 'paris', name: '巴黎', lat: 48.8566, lng: 2.3522, tier: 'world' },
  { id: 'cairo', name: '开罗', lat: 30.0444, lng: 31.2357, tier: 'world' },
  { id: 'newyork', name: '纽约', lat: 40.7128, lng: -74.0060, tier: 'world' },
  { id: 'losangeles', name: '洛杉矶', lat: 34.0522, lng: -118.2437, tier: 'world' },
  { id: 'sydney', name: '悉尼', lat: -33.8688, lng: 151.2093, tier: 'world' },
];

/**
 * Extract the ACTUAL real-world river segments (from REAL_WORLD_RIVERS) passing through or near a city,
 * projected into local (dx, dz) world coordinates around (cityLat, cityLng) so the 3D city river
 * and the 2D real-Earth map river are 100% ONE SINGLE ALIGNED WATERWAY!
 */
export function getLocalRealRiversForCity(
  cityLat: number,
  cityLng: number,
  maxRadius = 2800,
): { id: string; name: string; width: number; points: [number, number][] }[] {
  const kmPerDegLng = Math.max(12, KM_PER_DEG_LAT * Math.cos((cityLat * Math.PI) / 180));
  const toLocal = (lat: number, lng: number): [number, number] => [
    (lng - cityLng) * kmPerDegLng * CITY_STREET_PLAN_SCALE,
    -(lat - cityLat) * KM_PER_DEG_LAT * CITY_STREET_PLAN_SCALE,
  ];
  const results: { id: string; name: string; width: number; points: [number, number][] }[] = [];

  for (const riv of REAL_WORLD_RIVERS) {
    // Skip Yangtze mega-estuary inside Shanghai's local urban canal carving (it's a 12km-wide estuary north of Shanghai, not a 34m city creek!)
    if (riv.id === 'yangtze' && Math.abs(cityLat - 31.23) < 0.35 && Math.abs(cityLng - 121.47) < 0.45) {
      continue;
    }
    // Subdivide raw GPS waypoints into fine ~20m local samples and keep ONLY dry-land / inland river stretches (ZERO lines shooting into the open sea!)
    const localRaw = riv.points.map(([lat, lng]) => ({ lat, lng, pt: toLocal(lat, lng) }));
    const dense: [number, number][] = [];
    for (let i = 0; i < localRaw.length - 1; i++) {
      const a = localRaw[i];
      const b = localRaw[i + 1];
      const [ax, az] = a.pt;
      const [bx, bz] = b.pt;
      // Quick bounding box rejection
      if (
        Math.min(ax, bx) > maxRadius + 80 ||
        Math.max(ax, bx) < -(maxRadius + 80) ||
        Math.min(az, bz) > maxRadius + 80 ||
        Math.max(az, bz) < -(maxRadius + 80)
      ) {
        continue;
      }
      const segLen = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(2, Math.ceil(segLen / 24));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        const sLat = a.lat + (b.lat - a.lat) * t;
        const sLng = a.lng + (b.lng - a.lng) * t;
        const elevM = sampleRealElevationMeters(sLat, sLng, 'macro');
        if (elevM !== null && elevM <= 0.6) continue;
        if (Math.hypot(px, pz) <= maxRadius) {
          if (dense.length === 0 || Math.hypot(px - dense[dense.length - 1][0], pz - dense[dense.length - 1][1]) > 22) {
            dense.push([Math.round(px), Math.round(pz)]);
          }
        }
      }
    }
    if (dense.length >= 2) {
      const riverWidth = Math.max(24, Math.min(48, Math.round(riv.widthKm * 18 + 18)));
      results.push({ id: riv.id, name: riv.name, width: riverWidth, points: dense });
    }
  }
  return results;
}

/** Extract real incoming inter-city highway directions (radians) near a city to guide its Tensor Field! */
export function getLocalRealHighwayAnglesForCity(cityLat: number, cityLng: number): number[] {
  const kmPerDegLng = Math.max(12, KM_PER_DEG_LAT * Math.cos((cityLat * Math.PI) / 180));
  const toLocal = (lat: number, lng: number): [number, number] => [
    (lng - cityLng) * kmPerDegLng * CITY_STREET_PLAN_SCALE,
    -(lat - cityLat) * KM_PER_DEG_LAT * CITY_STREET_PLAN_SCALE,
  ];
  const angles: number[] = [];
  for (const cor of REAL_WORLD_CORRIDORS) {
    if (cor.kind === 'ferry') continue;
    const pts = cor.points.map(([lat, lng]) => toLocal(lat, lng));
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(pts[i][0], pts[i][1]) < 2100) {
        if (i > 0) angles.push(Math.atan2(pts[i - 1][1] - pts[i][1], pts[i - 1][0] - pts[i][0]));
        if (i < pts.length - 1) angles.push(Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]));
      }
    }
  }
  return angles;
}

/** Project all Season-1 cities into the current 3D geo world coordinate space for minimap & overland travel! */
export function getProjectedGeoCities(): {
  city: WorldCityDef;
  x: number;
  z: number;
  distKmFromOrigin: number;
}[] {
  if (!activeOrigin) return [];
  return WORLD_CITIES.map((city) => {
    const pos = geoToWorld(city.lat, city.lng, activeOrigin)!;
    const distKmFromOrigin = calcGeoDistanceKm(
      activeOrigin!.originLat,
      activeOrigin!.originLng,
      city.lat,
      city.lng,
    );
    return { city, x: pos.x, z: pos.z, distKmFromOrigin };
  });
}

/** Detect which real-world city territory the player is currently standing in while walking overland! */
export function detectOverlandCityAt(
  wx: number,
  wz: number,
): { city: WorldCityDef; distKm: number; lat: number; lng: number } | null {
  const geo = worldToGeo(wx, wz);
  if (!geo) return null;
  let best: WorldCityDef = WORLD_CITIES[0];
  let bestDist = Infinity;
  for (const c of WORLD_CITIES) {
    const d = calcGeoDistanceKm(geo.lat, geo.lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return { city: best, distKm: bestDist, lat: geo.lat, lng: geo.lng };
}

/* =========================================================================
   REAL TOPOGRAPHIC PIXEL HYDROGRAPHY (Meandering River Valleys, Sandbars,
   Incised Gorges & Real Famous Lakes — ZERO Drawn Vector Lines!)
   ========================================================================= */
export interface RealInlandLake {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rxDeg: number; // East-West half-axis in degrees
  ryDeg: number; // North-South half-axis in degrees
  rotRad?: number;
}

export const REAL_INLAND_LAKES: RealInlandLake[] = [
  { id: 'taihu', name: '太湖', lat: 31.22, lng: 120.22, rxDeg: 0.30, ryDeg: 0.25, rotRad: 0.3 },
  { id: 'west_lake', name: '西湖', lat: 30.236, lng: 120.118, rxDeg: 0.032, ryDeg: 0.034, rotRad: 0.12 },
  { id: 'poyang', name: '鄱阳湖', lat: 29.08, lng: 116.28, rxDeg: 0.24, ryDeg: 0.48, rotRad: 0.22 },
  { id: 'dongting', name: '洞庭湖', lat: 29.18, lng: 112.85, rxDeg: 0.36, ryDeg: 0.24, rotRad: -0.25 },
  { id: 'qinghai_lake', name: '青海湖', lat: 36.88, lng: 100.18, rxDeg: 0.46, ryDeg: 0.27, rotRad: -0.32 },
  { id: 'namtso', name: '纳木错', lat: 30.72, lng: 90.62, rxDeg: 0.32, ryDeg: 0.16, rotRad: -0.2 },
  { id: 'dianchi', name: '滇池', lat: 24.82, lng: 102.68, rxDeg: 0.09, ryDeg: 0.19, rotRad: 0.15 },
  { id: 'erhai', name: '洱海', lat: 25.78, lng: 100.19, rxDeg: 0.06, ryDeg: 0.18, rotRad: -0.15 },
  { id: 'hulun', name: '呼伦湖', lat: 48.96, lng: 117.42, rxDeg: 0.28, ryDeg: 0.38, rotRad: 0.4 },
  { id: 'biwa', name: '琵琶湖', lat: 35.26, lng: 136.08, rxDeg: 0.11, ryDeg: 0.26, rotRad: 0.25 },
];

interface CompiledHydroSeg {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  halfWidthKm: number;
  prog: number; // 0 = headwaters -> 1 = mouth
}

let compiledHydroSegs: CompiledHydroSeg[] | null = null;
function getCompiledHydroSegs(): CompiledHydroSeg[] {
  if (compiledHydroSegs) return compiledHydroSegs;
  const segs: CompiledHydroSeg[] = [];
  for (const riv of REAL_WORLD_RIVERS) {
    const pts = riv.points;
    if (pts.length < 2) continue;
    // Catmull-Rom smooth subdivision so real river valleys bend organically without sharp polygonal kinks
    const smooth: [number, number][] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < 4; s++) {
        const t = s / 4;
        const t2 = t * t;
        const t3 = t2 * t;
        const lat =
          0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const lng =
          0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        smooth.push([lat, lng]);
      }
    }
    smooth.push(pts[pts.length - 1]);

    const total = Math.max(1, smooth.length - 1);
    for (let i = 0; i < total; i++) {
      const [lat1, lng1] = smooth[i];
      const [lat2, lng2] = smooth[i + 1];
      const prog = (i + 0.5) / total;
      // Progressive real hydrological widening from alpine headwater stream (0.22x) to broad alluvial lower reach (1.35x)
      const halfWidthKm = riv.widthKm * 0.34 * (0.22 + 1.15 * Math.pow(prog, 1.15));
      const padDeg = Math.max(0.18, (halfWidthKm / 85) * 4.5);
      segs.push({
        lat1,
        lng1,
        lat2,
        lng2,
        minLat: Math.min(lat1, lat2) - padDeg,
        maxLat: Math.max(lat1, lat2) + padDeg,
        minLng: Math.min(lng1, lng2) - padDeg,
        maxLng: Math.max(lng1, lng2) + padDeg,
        halfWidthKm,
        prog,
      });
    }
  }
  compiledHydroSegs = segs;
  return segs;
}

/**
 * Evaluates genuine pixel-terrain hydrography at (lat, lng) / (wx, wz):
 * - Carves real meandering rivers, shallow shoals, alluvial sandbars, canyon shadows & famous lakes
 *   DIRECTLY into the 2D topographic pixel grid (100% consistent with ocean coastline & DEM relief — ZERO vector lines!).
 * - Returns null when the cell is ordinary dry terrain (so classifyRealEarthPixelColor handles it normally).
 */
export function sampleRealHydrographyPixelColor(
  lat: number,
  lng: number,
  wx: number,
  wz: number,
  unitsPerPx: number,
  stepPx: number,
  demMeters: number,
  hillShadeMeters: number,
  dither: boolean,
): string | null {
  // Never overwrite open ocean/estuary (already rendered by real DEM <= 0.6m!)
  if (demMeters <= 0.6) return null;

  const nLng = ((((lng + 180) % 360) + 360) % 360) - 180;

  // 1. Famous Real Inland Lakes (West Lake, Taihu, Poyang, Dongting, Qinghai Lake, Namtso, Dianchi, Erhai, Biwa...)
  const lakeRipple =
    Math.sin(lat * 190 + nLng * 230) * 0.13 +
    Math.cos(lat * 370 - nLng * 290) * 0.08 +
    Math.sin(lat * 680 + nLng * 510) * 0.05;
  for (let li = 0; li < REAL_INLAND_LAKES.length; li++) {
    const lk = REAL_INLAND_LAKES[li];
    if (Math.abs(lat - lk.lat) > lk.ryDeg * 1.45 || Math.abs(nLng - lk.lng) > lk.rxDeg * 1.45) continue;
    const dx = nLng - lk.lng;
    const dy = lat - lk.lat;
    const c = Math.cos(lk.rotRad ?? 0);
    const s = Math.sin(lk.rotRad ?? 0);
    const rx = dx * c + dy * s;
    const ry = -dx * s + dy * c;
    const normR = Math.hypot(rx / lk.rxDeg, ry / lk.ryDeg) + lakeRipple;
    if (normR < 0.72) {
      return demMeters > 2200 ? (dither ? '#1c88b8' : '#2496c7') : dither ? '#1f7ae0' : '#2886eb';
    }
    if (normR < 0.98) {
      return dither ? '#56aef2' : '#74c0fc';
    }
    if (normR < 1.14) {
      return demMeters > 2200 ? '#d8c998' : dither ? '#e8d7a6' : '#6ec25a';
    }
  }

  // 2. Active City High-Detail Local Waterways (e.g. Suzhou Creek & metropolitan Huangpu bends across the 1:10 city!)
  if (unitsPerPx < 16 && Math.hypot(wx, wz) < 2450) {
    const activeCityId = activeOrigin?.startCityId ?? 'shanghai';
    const rivSigned = getShanghaiRiverSignedDist(wx, wz, activeCityId);
    const pxWorldSize = Math.max(2.2, unitsPerPx * stepPx * 0.75);
    if (rivSigned < 0) {
      if (rivSigned > -Math.max(3.5, pxWorldSize * 0.65)) {
        return hillShadeMeters < -4 ? '#1b64b8' : dither ? '#4dabf7' : '#66bcfa';
      }
      return dither ? '#1f7ae0' : '#2986eb';
    }
    if (rivSigned < Math.max(3.2, pxWorldSize * 0.55)) {
      return dither ? '#6ec258' : '#dcd2ac';
    }
  }

  // 3. Real Continental & Regional River Valleys (Organic fractal meanders + pixel-grid adaptive channel width!)
  const cellKm = (unitsPerPx * stepPx) / GEO_UNITS_PER_KM;
  // Subtle multi-scale geological meander warp so river channels follow natural valley wiggles instead of ruler-straight segments
  const warpScale = Math.min(0.045, 0.006 + cellKm * 0.0018);
  const wLat =
    lat +
    Math.sin(nLng * 28.5 + lat * 19.2) * warpScale +
    Math.cos(nLng * 67.0 - lat * 53.0) * (warpScale * 0.38);
  const wLng =
    nLng +
    Math.cos(lat * 26.8 - nLng * 21.4) * warpScale +
    Math.sin(lat * 61.0 + nLng * 49.0) * (warpScale * 0.38);

  const cosLat = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
  const segs = getCompiledHydroSegs();
  const extraSearchDeg = Math.min(1.4, (cellKm * 2.1) / KM_PER_DEG_LAT);

  let bestRatio = 999;
  let bestProg = 0;

  for (let i = 0; i < segs.length; i++) {
    const sg = segs[i];
    if (
      wLat < sg.minLat - extraSearchDeg ||
      wLat > sg.maxLat + extraSearchDeg ||
      wLng < sg.minLng - extraSearchDeg ||
      wLng > sg.maxLng + extraSearchDeg
    ) {
      continue;
    }
    const vx = (sg.lng2 - sg.lng1) * cosLat * KM_PER_DEG_LAT;
    const vz = (sg.lat2 - sg.lat1) * KM_PER_DEG_LAT;
    const px = (wLng - sg.lng1) * cosLat * KM_PER_DEG_LAT;
    const pz = (wLat - sg.lat1) * KM_PER_DEG_LAT;
    const lenSq = vx * vx + vz * vz;
    const t = lenSq > 0.0001 ? Math.max(0, Math.min(1, (px * vx + pz * vz) / lenSq)) : 0;
    const distKm = Math.hypot(px - vx * t, pz - vz * t);

    // Effective channel half-width: true physical km at close zoom, gently floored to ~0.72..1.35 pixel cells at continent zoom
    // so main rivers remain continuous 1-3px topographic pixel channels without looking like thick marker strokes!
    const minVisKm = cellKm * (0.58 + 0.72 * sg.prog);
    const bankJitter = 1.0 + Math.sin(lat * 310 + nLng * 270) * 0.16;
    const effHalfKm = Math.max(sg.halfWidthKm, minVisKm) * bankJitter;
    const ratio = distKm / Math.max(0.08, effHalfKm);
    if (ratio < bestRatio) {
      bestRatio = ratio;
      bestProg = sg.prog;
    }
  }

  if (bestRatio >= 1.68) return null;

  // Core deep water pixel channel
  if (bestRatio < 0.62) {
    if (demMeters > 2600) {
      return dither ? '#208ab8' : '#299bd0'; // Alpine glacial river (Yarlung Tsangpo / upper Yangtze & Yellow!)
    }
    return dither ? '#1d75db' : '#2784eb';
  }

  // Shallow shoal / incised canyon shadow edge
  if (bestRatio < 1.02) {
    if (hillShadeMeters < -35) return '#155196'; // NW-sun incised river gorge shadow!
    return dither ? '#4da8f0' : '#70befa';
  }

  // Natural riverbank: incised rocky gorge in steep mountains, sandy point-bars & lush alluvial floodplains on plains!
  if (bestRatio < 1.58 && cellKm < 18) {
    if (demMeters > 1600 && Math.abs(hillShadeMeters) > 55) {
      return dither ? '#7d7058' : '#6b5e49'; // Steep river gorge rock wall
    }
    const isSandbar = Math.sin(lat * 420 - nLng * 390) > 0.35 && bestProg > 0.35 && demMeters < 450;
    if (isSandbar) {
      return dither ? '#e6d39c' : '#d9c286'; // Natural alluvial sandbar pixel!
    }
    if (demMeters < 950) {
      return dither ? '#54bd4e' : '#47ab42'; // Fertile green riparian valley floor!
    }
  }

  return null;
}
