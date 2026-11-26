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
const DEM_Z_GLOBAL = 2;
const DEM_Z_WORLD = 3;
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

const GEO_GLOBAL_KEY = '__POKE_POCKET_GEO_STATE_V3__';
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

// Real-Earth mode is ALWAYS active (persisted across Vite HMR so the map can NEVER fall back to random procedural noise!)
let activeOrigin: GeoTerrainOrigin = PERSISTED_GEO.activeOrigin;
let demVersion = PERSISTED_GEO.demVersion;

const GLOBAL_DEM_CACHE = PERSISTED_GEO.globalCache;
const WORLD_DEM_CACHE = PERSISTED_GEO.worldCache;
const MACRO_DEM_CACHE = PERSISTED_GEO.macroCache;
const DETAIL_DEM_CACHE = PERSISTED_GEO.detailCache;
const DEM_INFLIGHT = PERSISTED_GEO.inflight;
const DEM_LISTENERS = new Set<() => void>();

let notifyQueued = false;
function notifyDemLoaded() {
  demVersion += 1;
  PERSISTED_GEO.demVersion = demVersion;
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

function prefetchRegionTiles(origin: GeoTerrainOrigin) {
  // 00. Pre-fetch ENTIRE PLANET EARTH at Z2 (only 4x4 = 16 tiny tiles!) so zooming all the way out shows North-to-South full world map immediately!
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      requestDemTile(DEM_Z_GLOBAL, tx, ty);
    }
  }

  // 0. Pre-fetch Continental Z3 3x3 tiles (~15,000km across Asia/Pacific)
  const world = latLngToTileFrac(origin.originLat, origin.originLng, DEM_Z_WORLD);
  const wcx = Math.floor(world.fx);
  const wcy = Math.floor(world.fy);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      requestDemTile(DEM_Z_WORLD, wcx + dx, wcy + dy);
    }
  }

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

export type GeoDemResolution = 'detail' | 'macro' | 'world' | 'global';

/**
 * Sample real-Earth elevation in meters with 4-tier automatic fallback (Z9 Detail -> Z5 Macro -> Z3 Continental -> Z2 Global):
 * Supports smooth zooming from street-level (100m) all the way out to the ENTIRE PLANET EARTH (North Pole -> South Pole)!
 */
export function sampleRealElevationMeters(
  lat: number,
  lng: number,
  preferMacro: boolean | GeoDemResolution = false,
): number | null {
  const res: GeoDemResolution =
    typeof preferMacro === 'string' ? preferMacro : preferMacro ? 'macro' : 'detail';
  if (res === 'detail') {
    const detail = sampleGridAt(lat, lng, DEM_Z_DETAIL, true);
    if (detail !== null) return detail;
  }
  if (res === 'detail' || res === 'macro') {
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
 * Real-Earth Geographic Biome Pixel Classifier (True Deserts, Gobi, Loess Plateau, Steppe, Subtropical Forests,
 * Forested Hills, Alpine Ridges & True Latitude-Dependent Snowlines in Real Meters!)
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

  // 2. Polar Ice Caps & High Arctic Tundra (Greenland / Antarctica / High Arctic)
  if (absLat > 70 || (lat > 62 && nLng > -55 && nLng < -15 && meters > 400) || lat < -62) {
    return hillShadeMeters < -45 ? '#d0e2f0' : '#f4f9fc';
  }

  // 3. True Latitude-Aware Permanent Snowline in REAL METERS!
  // Subtropical (<28°N e.g. Yunnan): snow only > 4800m; Mid-latitude West China (28..44°N): > 4450m;
  // Maritime Japan (lng > 128): > 3550m (so Mt. Fuji 3776m gets its white cap while Zhejiang 1200m hills stay green!).
  const isJapanMaritime = lat > 32 && lat < 45 && nLng > 128 && nLng < 147;
  const snowlineM = isJapanMaritime
    ? 3500
    : absLat < 28
      ? 4850
      : absLat < 44
        ? 4450 - (absLat - 28) * 35
        : Math.max(1500, 3890 - (absLat - 44) * 95);

  if (meters >= snowlineM) {
    return hillShadeMeters < -80 ? '#c4d8e8' : '#f2f8fc';
  }

  // 4. Sandy Beaches along real coastlines
  if (nearOcean && meters < 22) {
    return dither ? '#efe0b1' : '#e4cf94';
  }

  // 5. Real-World Deserts & Gobi Basins (Taklamakan, Gurbantünggüt, Badain Jaran/Gobi, Qaidam, Sahara, Arabia, Central Asia, Outback, SW USA)
  const inTaklamakan = lat >= 36.2 && lat <= 41.9 && nLng >= 75.5 && nLng <= 92.2 && meters < 2100;
  const inJunggarDesert = lat >= 43.8 && lat <= 46.8 && nLng >= 84.0 && nLng <= 91.5 && meters < 1200;
  const inGobiDesert = lat >= 37.6 && lat <= 45.2 && nLng >= 92.2 && nLng <= 109.5 && meters < 2100;
  const inQaidam = lat >= 35.8 && lat <= 39.2 && nLng >= 90.2 && nLng <= 98.8 && meters < 3350;
  const inSaharaArabia = lat >= 14.0 && lat <= 33.5 && nLng >= -17.0 && nLng <= 60.0 && meters < 2200;
  const inCentralAsiaDesert = lat >= 36.5 && lat <= 47.0 && nLng >= 52.0 && nLng <= 75.5 && meters < 1100;
  const inAusOutback = lat >= -31.5 && lat <= -19.0 && nLng >= 115.0 && nLng <= 142.0 && meters < 1200;
  const inUsSouthwest = lat >= 27.0 && lat <= 37.5 && nLng >= -117.5 && nLng <= -103.5 && meters < 1800;

  if (inTaklamakan || inSaharaArabia || inAusOutback) {
    // Golden sand sea dunes with subtle wind/hillshade contrast
    if (hillShadeMeters > 35) return '#f2d894';
    if (hillShadeMeters < -35) return '#cfa052';
    return dither ? '#e8c474' : '#deb462';
  }
  if (inJunggarDesert || inGobiDesert || inQaidam || inCentralAsiaDesert || inUsSouthwest) {
    // Rocky Gobi & arid gravel basin (warm tan / ochre-sand)
    if (hillShadeMeters > 45) return '#dfd09c';
    if (hillShadeMeters < -45) return '#b59a69';
    return dither ? '#d1ba82' : '#c4aa74';
  }

  // 6. Real Tibetan Plateau Alpine Steppe (28..37°N, 78..102°E, 3000..4450m) — tawny highland meadow, NOT solid snow!
  if (lat >= 27.5 && lat <= 37.5 && nLng >= 77.5 && nLng <= 102.5 && meters >= 2900) {
    if (hillShadeMeters > 80) return '#c2b982';
    if (hillShadeMeters < -80) return '#857d56';
    return dither ? '#a8a56e' : '#969660';
  }

  // 7. Loess Plateau (黄土高原) & Dry Inner Mongolia Steppe (内蒙古草原)
  const inLoessPlateau = lat >= 34.4 && lat <= 40.4 && nLng >= 103.5 && nLng <= 113.8 && meters > 650 && meters < 2400;
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

  // 10. Forested Hills & Low Mountains (320m .. 1250m — Zhejiang/Fujian hills, Hunan/Jiangxi, Sichuan rim, Japan hills)
  if (meters >= 320) {
    if (hillShadeMeters > 45) return '#4dad4e';
    if (hillShadeMeters < -45) return '#256e31';
    return dither ? '#348f3e' : '#2d8237';
  }

  // 11. Fertile Plains, River Valleys & Coastal Lowlands (0 .. 320m — Yangtze Delta, North China Plain, Sichuan Basin, Kanto Plain)
  if (hillShadeMeters > 22) return '#60c752';
  if (hillShadeMeters < -22) return '#328f39';
  return dither ? '#48b546' : '#3ea63e';
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
      // Smooth river channel carving for the active city's unique procedural river!
      const activeCityId = activeOrigin.startCityId ?? 'shanghai';
      const rivSigned = getShanghaiRiverSignedDist(wx, wz, activeCityId);
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
    widthKm: 2.0,
    points: [
      [31.02, 120.98], [30.97, 121.22], [31.01, 121.42], [31.12, 121.46],
      [31.23, 121.49], [31.38, 121.51],
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
