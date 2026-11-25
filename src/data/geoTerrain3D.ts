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

export const GEO_UNITS_PER_KM = 20;
const KM_PER_DEG_LAT = 111.32;
const DEM_Z_MACRO = 5;
const DEM_Z_DETAIL = 9;
const MAX_DETAIL_CACHE = 180;

export interface GeoTerrainOrigin {
  originLat: number;
  originLng: number;
  startCityId: string | null;
  startCityName: string;
  unitsPerKm: number;
}

let activeOrigin: GeoTerrainOrigin | null = null;
let demVersion = 0;

const MACRO_DEM_CACHE = new Map<string, Float32Array>();
const DETAIL_DEM_CACHE = new Map<string, Float32Array>();
const DEM_INFLIGHT = new Set<string>();
const DEM_LISTENERS = new Set<() => void>();

let notifyQueued = false;
function notifyDemLoaded() {
  demVersion += 1;
  if (notifyQueued) return;
  notifyQueued = true;
  // Batch rapid parallel tile completions into one clean repaint frame
  const flush = () => {
    notifyQueued = false;
    for (const fn of DEM_LISTENERS) {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    }
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(flush);
  } else {
    flush();
  }
}

export function subscribeGeoDemLoaded(cb: () => void): () => void {
  DEM_LISTENERS.add(cb);
  return () => {
    DEM_LISTENERS.delete(cb);
  };
}

export function getGeoDemVersion(): number {
  return demVersion;
}

export function getActiveGeoTerrainOrigin(): GeoTerrainOrigin | null {
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
  const cache = z <= DEM_Z_MACRO ? MACRO_DEM_CACHE : DETAIL_DEM_CACHE;
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

export function setActiveGeoTerrainOrigin(origin: GeoTerrainOrigin | null) {
  activeOrigin = origin;
  if (origin) {
    // 1. Pre-fetch Macro Z5 3x3 grid (~3600km x 3600km) so zoomed-out coastlines NEVER show missing squares!
    const macro = latLngToTileFrac(origin.originLat, origin.originLng, DEM_Z_MACRO);
    const mcx = Math.floor(macro.fx);
    const mcy = Math.floor(macro.fy);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        requestDemTile(DEM_Z_MACRO, mcx + dx, mcy + dy);
      }
    }

    // 2. Pre-fetch Detail Z9 3x3 grid (~230km x 230km) around starting city for crisp local coastlines & hills!
    const detail = latLngToTileFrac(origin.originLat, origin.originLng, DEM_Z_DETAIL);
    const dcx = Math.floor(detail.fx);
    const dcy = Math.floor(detail.fy);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        requestDemTile(DEM_Z_DETAIL, dcx + dx, dcy + dy);
      }
    }
  }
  notifyDemLoaded();
}

function sampleGridAt(lat: number, lng: number, z: number, queueIfMissing: boolean): number | null {
  const { fx, fy } = latLngToTileFrac(lat, lng, z);
  const n = 1 << z;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  const wrappedTx = ((tx % n) + n) % n;
  const key = `${z}/${wrappedTx}/${ty}`;
  const cache = z <= DEM_Z_MACRO ? MACRO_DEM_CACHE : DETAIL_DEM_CACHE;
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

/**
 * Sample real-Earth elevation in meters with automatic Macro (Z5) fallback:
 * - When `preferMacro` is true (zoomed-out overview map), reads Z5 directly so cache never thrashes.
 * - Otherwise prefers Z9 detail tile and seamlessly falls back to Z5 macro tile while Z9 streams in.
 */
export function sampleRealElevationMeters(
  lat: number,
  lng: number,
  preferMacro = false,
): number | null {
  if (!preferMacro) {
    const detail = sampleGridAt(lat, lng, DEM_Z_DETAIL, true);
    if (detail !== null) return detail;
  }
  return sampleGridAt(lat, lng, DEM_Z_MACRO, true);
}

/** Deterministic subtle micro-ripple so real plains & foothills stay sculpted & lively at close 3D range */
function microSculpt(wx: number, wz: number): number {
  return (
    Math.sin(wx * 0.085 + wz * 0.042) * 0.22 +
    Math.cos(wx * 0.037 - wz * 0.091) * 0.18 +
    Math.sin((wx + wz) * 0.16) * 0.08
  );
}

/**
 * Sample real-Earth geographic 3D terrain height when in World Tour mode.
 * Returns null ONLY when geo mode is inactive.
 * While tiles are still streaming on the very first 100ms, returns a calm neutral plain (never random Perlin lakes!).
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
  const micro = preferMacro ? 0 : microSculpt(wx, wz);

  let elev: number;
  if (meters === null) {
    // Calm neutral plain placeholder for the ~150ms before Z5 tile resolves — NEVER return early before city grading!
    elev = 1.65 + micro * 0.25;
  } else if (meters <= 0.6) {
    // Real Ocean / Sea / Bay / Estuary (shallow sandy shoreline -> deep sea)
    elev = Math.max(-2.45, -0.22 + Math.min(0, meters) * 0.055) + micro * 0.12;
    if (elev > -0.05) elev = -0.08;
  } else if (meters <= 65) {
    // Real Coastal Plains & River Valleys (e.g. Shanghai, Pearl River Delta, Kanto Plain, North China Plain)
    elev = 0.55 + (meters / 65) * 1.95 + micro * 0.65;
  } else if (meters <= 420) {
    // Real Foothills & Low Mountains (e.g. Shenzhen/HK hills, Taihang foothills)
    elev = 2.5 + ((meters - 65) / 355) * 4.6 + micro * 0.85;
  } else {
    // Real Major Mountain Ranges (e.g. Wutong Peak, Yan Mountains, Mount Fuji)
    elev = 7.1 + Math.min(6.4, Math.log1p((meters - 420) / 260) * 3.05) + micro;
  }

  // Deterministic Urban Core Elevation (identical at t=0ms AND after NASA DEM loads -> ZERO road/character height desync!):
  // Carves the real S-curving Huangpu River & Suzhou Creek water channel cleanly through downtown Shanghai!
  if (!preferMacro) {
    const cityDist = Math.hypot(wx, wz);
    if (cityDist < 224) {
      // Smooth river channel carving for Huangpu River & Suzhou Creek!
      const rivSigned = getShanghaiRiverSignedDist(wx, wz);
      const riverElev = -1.65;
      const dryCityY = 1.65;
      let cityTargetY = dryCityY;
      if (rivSigned < 0) {
        cityTargetY = riverElev;
      } else if (rivSigned < 7.5) {
        const bankT = rivSigned / 7.5;
        const smoothBank = bankT * bankT * (3 - 2 * bankT);
        cityTargetY = riverElev * (1 - smoothBank) + dryCityY * smoothBank;
      }
      if (cityDist <= 184) {
        return cityTargetY;
      }
      const outerT = (cityDist - 184) / 40;
      const smoothOuter = outerT * outerT * (3 - 2 * outerT);
      elev = cityTargetY * (1 - smoothOuter) + elev * smoothOuter;
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
  // G2 京沪高速 & 京哈高速 (上海 -> 苏州 -> 南京 -> 徐州 -> 济南 -> 天津 -> 北京 -> 沈阳 -> 长春 -> 哈尔滨)
  {
    id: 'g2_jinghu',
    label: 'G2 京沪高速',
    kind: 'highway',
    points: [
      [31.23, 121.47], // 上海
      [31.30, 120.59], // 苏州
      [32.06, 118.80], // 南京
      [34.21, 117.28], // 徐州
      [36.65, 117.12], // 济南
      [39.13, 117.20], // 天津
      [39.90, 116.40], // 北京
      [41.80, 123.43], // 沈阳
      [43.82, 125.32], // 长春
      [45.80, 126.53], // 哈尔滨
    ],
  },
  // 京沪-京哈高铁 (Parallel slightly offset for crisp railway clarity on map!)
  {
    id: 'hsr_jinghu',
    label: '京沪高铁',
    kind: 'rail',
    points: [
      [31.23, 121.47],
      [31.49, 120.31], // 无锡
      [32.06, 118.80], // 南京
      [32.94, 117.39], // 蚌埠
      [34.27, 117.19], // 徐州东
      [36.67, 116.90], // 济南西
      [39.06, 117.07], // 天津南
      [39.90, 116.40], // 北京
      [41.80, 123.43],
      [45.80, 126.53],
    ],
  },
  // G15/G60 东南沿海高速 (上海 -> 杭州 -> 温州 -> 福州 -> 厦门 -> 深圳 -> 香港 & 广州)
  {
    id: 'g15_coastal',
    label: 'G15 沈海高速',
    kind: 'highway',
    points: [
      [31.23, 121.47], // 上海
      [30.27, 120.15], // 杭州
      [29.87, 121.55], // 宁波
      [28.00, 120.70], // 温州
      [26.07, 119.30], // 福州
      [24.48, 118.09], // 厦门
      [23.35, 116.68], // 汕头
      [22.54, 114.06], // 深圳
      [22.32, 114.17], // 香港
    ],
  },
  {
    id: 'g4_guangshen',
    label: 'G4 广深高速',
    kind: 'highway',
    points: [
      [23.13, 113.26], // 广州
      [22.82, 113.75], // 东莞
      [22.54, 114.06], // 深圳
    ],
  },
  // 沪昆-东南沿海高铁
  {
    id: 'hsr_coastal',
    label: '沪广高铁',
    kind: 'rail',
    points: [
      [31.23, 121.47],
      [30.27, 120.15], // 杭州
      [28.68, 115.86], // 南昌
      [28.23, 112.94], // 长沙
      [23.13, 113.26], // 广州
      [22.54, 114.06], // 深圳
      [22.32, 114.17], // 香港
    ],
  },
  // G42 沪蓉高速 (上海 -> 南京 -> 合肥 -> 武汉 -> 重庆 -> 成都)
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
  // 日本东海道・山阳・东北新干线 (福冈 -> 广岛 -> 大阪 -> 京都 -> 名古屋 -> 东京 -> 仙台 -> 青森 -> 札幌)
  {
    id: 'jp_shinkansen',
    label: '东海道新干线',
    kind: 'rail',
    points: [
      [33.59, 130.40], // 福冈
      [34.39, 132.46], // 广岛
      [34.69, 135.50], // 大阪
      [35.01, 135.77], // 京都
      [35.18, 136.91], // 名古屋
      [35.68, 139.65], // 东京
      [38.27, 140.87], // 仙台
      [40.82, 140.74], // 青森
      [43.06, 141.35], // 札幌
    ],
  },
  // 日本东名/名神高速
  {
    id: 'jp_tomei',
    label: '东名高速',
    kind: 'highway',
    points: [
      [33.59, 130.40],
      [34.69, 135.50],
      [35.01, 135.77],
      [35.18, 136.91],
      [35.68, 139.65],
    ],
  },
  // 东海跨海航线 (上海 <-> 福冈 / 大阪 / 冲绳)
  {
    id: 'ferry_sh_jp',
    label: '东海航线',
    kind: 'ferry',
    points: [
      [31.23, 121.47], // 上海
      [32.60, 126.20],
      [33.59, 130.40], // 福冈
    ],
  },
  {
    id: 'ferry_sh_ok',
    label: '沪冲航线',
    kind: 'ferry',
    points: [
      [31.23, 121.47], // 上海
      [28.70, 124.90],
      [26.21, 127.68], // 冲绳
    ],
  },
];

export interface RealWorldRiver {
  id: string;
  name: string;
  widthKm: number;
  points: [number, number][]; // [lat, lng] upstream -> mouth
}

/** Major Real-World East Asia River Systems rendered on the topographic map (underneath highways & rail bridges!) */
export const REAL_WORLD_RIVERS: RealWorldRiver[] = [
  {
    id: 'yangtze',
    name: '长江',
    widthKm: 7.5,
    points: [
      [28.75, 104.63], // 宜宾
      [29.56, 106.55], // 重庆
      [30.82, 108.40], // 万州
      [30.69, 111.29], // 宜昌
      [29.42, 113.12], // 岳阳
      [30.59, 114.31], // 武汉
      [29.71, 115.99], // 九江
      [30.53, 117.05], // 安庆
      [31.33, 118.38], // 芜湖
      [32.06, 118.80], // 南京
      [32.20, 119.45], // 镇江
      [31.98, 120.89], // 南通
      [31.48, 121.90], // 长江入海口
    ],
  },
  {
    id: 'yellow_river',
    name: '黄河',
    widthKm: 6.0,
    points: [
      [36.06, 103.83], // 兰州
      [38.48, 106.23], // 银川
      [40.65, 109.84], // 包头
      [39.90, 111.15], // 托克托
      [34.62, 110.28], // 潼关
      [34.91, 113.65], // 郑州
      [36.68, 117.00], // 济南
      [37.75, 119.15], // 渤海入海口
    ],
  },
  {
    id: 'pearl_river',
    name: '珠江',
    widthKm: 5.5,
    points: [
      [23.48, 111.28], // 梧州
      [23.05, 112.46], // 肇庆
      [23.12, 113.26], // 广州
      [22.78, 113.62], // 虎门
      [22.42, 113.78], // 珠江口
    ],
  },
  {
    id: 'qiantang',
    name: '钱塘江',
    widthKm: 4.5,
    points: [
      [29.10, 119.15], // 建德
      [29.80, 119.95], // 富阳
      [30.20, 120.20], // 杭州
      [30.35, 120.80], // 杭州湾口
    ],
  },
  {
    id: 'huangpu_macro',
    name: '黄浦江',
    widthKm: 2.2,
    points: [
      [30.98, 121.02], // 淀山湖/太湖水系
      [31.02, 121.38], // 闵行弯
      [31.23, 121.49], // 陆家嘴/外滩
      [31.38, 121.52], // 吴淞口入长江
    ],
  },
  {
    id: 'songhua',
    name: '松花江',
    widthKm: 5.0,
    points: [
      [43.84, 126.55], // 吉林
      [45.40, 124.82], // 松原
      [45.80, 126.53], // 哈尔滨
      [46.82, 130.36], // 佳木斯
    ],
  },
  {
    id: 'tone_river',
    name: '利根川',
    widthKm: 3.2,
    points: [
      [36.40, 139.06], // 前桥
      [36.12, 139.72], // 关东平原
      [35.74, 140.85], // 铫子入海口
    ],
  },
  {
    id: 'yodo_river',
    name: '淀川',
    widthKm: 2.8,
    points: [
      [35.15, 135.95], // 琵琶湖
      [34.95, 135.75], // 京都南
      [34.69, 135.42], // 大阪湾
    ],
  },
];

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
