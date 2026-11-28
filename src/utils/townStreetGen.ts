import type { WorldTownAnchor3D } from '../data/survivorsTactics';
import {
  GEO_UNITS_PER_KM,
  PROVINCIAL_AND_WORLD_CAPITALS,
  REAL_INLAND_LAKES,
  getLocalRealHighwayAnglesForCity,
  getLocalRealRiversForCity,
  isRealUrbanDryLand,
} from '../data/geoTerrain3D';
import { WORLD_CITIES } from '../data/worldTour';
import { buildShanghaiRealRoadNetwork } from '../data/shanghaiMasterplan';
import { generateTensorCityRoads } from './tensorRoadGen';
import type { FoundationSettings } from '../world3d/buildingFoundation3D';
import { outerLaneCenterOffset, previewRoadRibbonWidth, roadSidewalkOuterHalfWidth } from '../world3d/roadKitDimensions';
import { splitRoadAtWater } from '../world3d/roadWaterCrossing3D';

export interface TownStreetSeg {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  /** Optional tapered start/end widths for smooth 8-lane -> 4-lane -> 2-lane transitions! */
  widthStart?: number;
  widthEnd?: number;
  /** Total lanes in both directions. Absent values retain the legacy road-class default. */
  laneCount?: 2 | 4 | 6 | 8;
  kind: 'arterial' | 'street' | 'alley' | 'rail';
  isBridge?: boolean;
  bridgeStyle?: 'nanpu' | 'yangpu' | 'waibaidu';
}

export interface TownRiverSpline {
  id: string;
  name: string;
  width: number;
  points: [number, number][]; // offsets relative to city center (cx, cz)
}

export interface TownParkZone {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  hasPond: boolean;
  hasFountain?: boolean;
}

export interface TownMetroLine {
  id: string;
  color: string;
  points: [number, number][]; // world coords
  stations: { x: number; z: number; name: string }[];
}

export type TownLotKind =
  | 'pokemon_center'
  | 'poke_mart'
  | 'hotel'
  | 'restaurant'
  | 'landmark'
  | 'skyscraper'
  | 'house';

export type BuildingFootprintShape = 'rect' | 'cylinder' | 'triangle';

export interface TownBuildingLot {
  id: string;
  kind: TownLotKind;
  x: number; // world X
  z: number; // world Z
  rotY: number; // faces directly onto its street!
  width: number;
  depth: number;
  /** Block-adaptive architectural geometry: rectangular, panoramic cylinder rotunda, or Flatiron triangular wedge! */
  shape?: BuildingFootprintShape;
  houseVariant: number;
  /** Optional override; otherwise slope and the size of high ground choose automatically. */
  foundation?: FoundationSettings;
  walkable?: boolean;
  /** Front curb point right outside the doorway */
  doorX: number;
  doorZ: number;
}

export interface TownJunctionNode {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotY: number;
  kind: 'cross' | 'tee';
}

export interface TownBusStopDef {
  id: string;
  name: string;
  servesLabel: string;
  busX: number;
  busZ: number;
  rotY: number;
  shelterX: number;
  shelterZ: number;
  dropoffX: number;
  dropoffZ: number;
  hasParkedBus?: boolean;
}

export interface GeneratedTownLayout {
  townId: string;
  townName: string;
  centerX: number;
  centerZ: number;
  streets: TownStreetSeg[];
  junctions: TownJunctionNode[];
  rivers: TownRiverSpline[];
  parks: TownParkZone[];
  metroLines: TownMetroLine[];
  rail: TownStreetSeg[];
  lots: TownBuildingLot[];
  busStops: TownBusStopDef[];
  plazaX: number;
  plazaZ: number;
  busX: number;
  busZ: number;
  busRotY: number;
  stationX: number;
  stationZ: number;
  stationRotY: number;
  streetLamps: { x: number; z: number; rotY: number }[];
  boundingRadius: number;
}

/** Deterministic string hash so EVERY real-world city gets its own unique procedural seed! */
export function hashCitySeed(cityId: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < cityId.length; i++) {
    h ^= cityId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 90000) + 101;
}

/** Iconic S-curving Huangpu River (黄浦江) & Suzhou Creek (苏州河) for Shanghai! */
export const SHANGHAI_LOCAL_RIVERS: TownRiverSpline[] = [
  {
    id: 'huangpu',
    name: '黄浦江',
    width: 34,
    points: [
      [18, 220],
      [42, 152],
      [44, 104],
      [26, 48],
      [22, -6],
      [34, -52],
      [88, -84],
      [142, -134],
      [188, -210],
    ],
  },
  {
    id: 'suzhou_creek',
    name: '苏州河',
    width: 15,
    points: [
      [-210, -82],
      [-146, -68],
      [-82, -56],
      [-28, -68],
      [24, -50],
    ],
  },
];

export interface CityBridgeDef {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  style: 'nanpu' | 'yangpu' | 'waibaidu';
}

export const SHANGHAI_LOCAL_BRIDGES: CityBridgeDef[] = [
  { x1: -12, z1: 112, x2: 96, z2: 112, width: 22, style: 'nanpu' },
  { x1: 68, z1: -128, x2: 146, z2: -74, width: 22, style: 'yangpu' },
  { x1: 4, z1: -86, x2: 12, z2: -34, width: 16, style: 'waibaidu' },
  { x1: -116, z1: -88, x2: -110, z2: -42, width: 16, style: 'waibaidu' },
];

const CITY_HYDRO_CACHE = new Map<string, { rivers: TownRiverSpline[]; bridges: CityBridgeDef[] }>();
const CITY_LATLNG_CACHE = new Map<string, { lat: number; lng: number } | null>();

function lookupCityLatLng(cleanId: string): { lat: number; lng: number } | null {
  if (CITY_LATLNG_CACHE.has(cleanId)) return CITY_LATLNG_CACHE.get(cleanId)!;
  const wc = WORLD_CITIES.find((c) => c.id === cleanId);
  if (wc) {
    const v = { lat: wc.lat, lng: wc.lng };
    CITY_LATLNG_CACHE.set(cleanId, v);
    return v;
  }
  const cap = PROVINCIAL_AND_WORLD_CAPITALS.find((c) => c.id === cleanId);
  const res = cap ? { lat: cap.lat, lng: cap.lng } : null;
  CITY_LATLNG_CACHE.set(cleanId, res);
  return res;
}

/**
 * Per-city real-geography aligned hydrography!
 * 1. First queries REAL_WORLD_RIVERS projected at the city's actual GPS (lat, lng), so the 3D city river
 *    and the 2D real-Earth map river are ONE SINGLE CONTINUOUS ALIGNED WATERWAY (zero duplicate rivers!).
 * 2. Adds Shanghai's iconic Suzhou Creek tributary joining the real Huangpu River at Waibaidu confluence.
 * 3. Only if a city has no major river in REAL_WORLD_RIVERS within 260m (e.g. inland city), generates a
 *    modest local urban canal/river consistent with its unique city seed.
 */
export function getCityHydrography(cityId: string): { rivers: TownRiverSpline[]; bridges: CityBridgeDef[] } {
  const cleanId = cityId.replace(/^geo_city_/, '').replace(/^city_/, '');
  const cached = CITY_HYDRO_CACHE.get(cleanId);
  if (cached) return cached;

  const rivers: TownRiverSpline[] = [];
  const bridges: CityBridgeDef[] = [];
  const coords = lookupCityLatLng(cleanId);

  if (coords) {
    const realLocal = getLocalRealRiversForCity(coords.lat, coords.lng, 2850);
    for (const rr of realLocal) {
      rivers.push({
        id: rr.id,
        name: rr.name,
        width: rr.width,
        points: rr.points,
      });
    }
    // For Shanghai, add 1:10 Suzhou Creek joining the REAL Huangpu River cleanly at Waibaidu Bridge (~31.244°N -> z ≈ -155)!
    if (cleanId === 'shanghai' && rivers.length > 0 && !rivers.some((r) => r.id === 'suzhou_macro')) {
      const hp = rivers.find((r) => r.id === 'huangpu_macro') ?? rivers[0];
      let confPt = hp.points[Math.floor(hp.points.length * 0.5)];
      let bestD = 9999;
      for (const p of hp.points) {
        const d = Math.abs(p[1] - -150);
        if (d < bestD) {
          bestD = d;
          confPt = p;
        }
      }
      rivers.push({
        id: 'suzhou_creek',
        name: '苏州河',
        width: 18,
        points: [
          [-1580, confPt[1] - 95],
          [-1080, confPt[1] - 42],
          [-640, confPt[1] - 12],
          [-310, confPt[1] + 18],
          [Math.round(confPt[0] - 58), Math.round(confPt[1] - 8)],
          [confPt[0], confPt[1]],
        ],
      });
    }
  }

  // Fallback ONLY for cities far from any major river in REAL_WORLD_RIVERS (gentle local urban canal)
  if (rivers.length === 0) {
    const rng = makeRng(hashCitySeed(cleanId) * 41 + 9);
    const axisAng = rng() * Math.PI;
    const dirX = Math.cos(axisAng);
    const dirZ = Math.sin(axisAng);
    const nx = -dirZ;
    const nz = dirX;
    const riverOffset = (rng() > 0.5 ? 1 : -1) * (110 + rng() * 85);
    const waveAmp = 35 + rng() * 45;
    const waveFreq = 0.0045 + rng() * 0.003;
    const wavePhase = rng() * Math.PI * 2;
    const mainW = 22 + Math.round(rng() * 12);
    const mainPts: [number, number][] = [];
    for (let s = -960; s <= 960; s += 96) {
      const bend = riverOffset + Math.sin(s * waveFreq + wavePhase) * waveAmp;
      mainPts.push([Math.round(dirX * s + nx * bend), Math.round(dirZ * s + nz * bend)]);
    }
    rivers.push({ id: `${cleanId}_canal`, name: `${cleanId}护城河`, width: mainW, points: mainPts });
  }

  // Generate perpendicular walkable cross-river bridges along each river spline!
  const styles: ('nanpu' | 'yangpu' | 'waibaidu')[] = ['nanpu', 'waibaidu', 'yangpu'];
  for (const riv of rivers) {
    if (riv.points.length < 2) continue;
    const fracs = riv.width >= 18 ? [0.24, 0.44, 0.62, 0.80] : [0.38, 0.72];
    fracs.forEach((f, idx) => {
      const pIdx = Math.max(0, Math.min(riv.points.length - 2, Math.floor(f * (riv.points.length - 1))));
      const [ax, az] = riv.points[pIdx];
      const [bx, bz] = riv.points[pIdx + 1];
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      if (Math.hypot(mx, mz) > 880) return;
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      const halfSpan = riv.width * 0.5 + 10.5;
      const x1 = Math.round(mx - nx * halfSpan);
      const z1 = Math.round(mz - nz * halfSpan);
      const x2 = Math.round(mx + nx * halfSpan);
      const z2 = Math.round(mz + nz * halfSpan);
      if (bridges.some((b) => Math.hypot((b.x1 + b.x2) * 0.5 - mx, (b.z1 + b.z2) * 0.5 - mz) < 95)) return;
      bridges.push({
        x1,
        z1,
        x2,
        z2,
        width: riv.width >= 18 ? 22 : 16,
        style: riv.width < 18 ? 'waibaidu' : styles[idx % styles.length],
      });
    });
  }

  const res = { rivers, bridges };
  CITY_HYDRO_CACHE.set(cleanId, res);
  return res;
}

/** Signed distance to ANY city's unique procedural river network (negative = inside river water!) */
export function getShanghaiRiverSignedDist(dx: number, dz: number, cityId = 'shanghai'): number {
  const cleanId = cityId.replace(/^geo_city_/, '').replace(/^city_/, '');
  const { rivers } = getCityHydrography(cleanId);
  let minSigned = 9999;
  for (const riv of rivers) {
    const halfW = riv.width * 0.5;
    for (let i = 0; i < riv.points.length - 1; i++) {
      const [ax, az] = riv.points[i];
      const [bx, bz] = riv.points[i + 1];
      const d = distToSeg(dx, dz, ax, az, bx, bz) - halfW;
      if (d < minSigned) minSigned = d;
    }
  }
  // Only check inland urban lakes (e.g. Hangzhou West Lake, Kunming Dianchi) on lake cities — skip in Shanghai for ultra-fast 60fps queries!
  if (cleanId !== 'shanghai') {
    const cityGeo = lookupCityLatLng(cleanId);
    if (cityGeo && Math.hypot(dx, dz) > 26) {
      const kmPerDegLng = Math.max(12, 111.32 * Math.cos((cityGeo.lat * Math.PI) / 180));
      const ptLng = cityGeo.lng + dx / (kmPerDegLng * GEO_UNITS_PER_KM);
      const ptLat = cityGeo.lat - dz / (111.32 * GEO_UNITS_PER_KM);
      const ripple =
        Math.sin(ptLat * 190 + ptLng * 230) * 0.13 +
        Math.cos(ptLat * 370 - ptLng * 290) * 0.08;
      for (const lk of REAL_INLAND_LAKES) {
        if (Math.abs(ptLat - lk.lat) > lk.ryDeg * 1.6 || Math.abs(ptLng - lk.lng) > lk.rxDeg * 1.6) continue;
        const ldx = ptLng - lk.lng;
        const ldy = ptLat - lk.lat;
        const c = Math.cos(lk.rotRad ?? 0);
        const s = Math.sin(lk.rotRad ?? 0);
        const rx = ldx * c + ldy * s;
        const ry = -ldx * s + ldy * c;
        const normR = Math.hypot(rx / lk.rxDeg, ry / lk.ryDeg) + ripple;
        const avgRadiusUnits = ((lk.rxDeg * kmPerDegLng + lk.ryDeg * 111.32) * 0.5) * GEO_UNITS_PER_KM;
        const lakeSigned = (normR - 0.98) * avgRadiusUnits;
        if (lakeSigned < minSigned) minSigned = lakeSigned;
      }
    }
  }
  return minSigned;
}

const LAYOUT_BRIDGES_CACHE = new Map<string, TownStreetSeg[]>();

export function isOnShanghaiBridgeLocal(dx: number, dz: number, cityId = 'shanghai'): boolean {
  const cleanId = cityId.replace(/^geo_city_/, '').replace(/^city_/, '');
  for (const [idKey, lay] of LAYOUT_CACHE) {
    const layClean = lay.townId.replace(/^geo_city_/, '').replace(/^city_/, '');
    if (layClean !== cleanId) continue;
    let brList = LAYOUT_BRIDGES_CACHE.get(idKey);
    if (!brList) {
      brList = lay.streets.filter((s) => s.isBridge);
      LAYOUT_BRIDGES_CACHE.set(idKey, brList);
    }
    const wx = lay.centerX + dx;
    const wz = lay.centerZ + dz;
    for (let i = 0; i < brList.length; i++) {
      const st = brList[i];
      if (distToSeg(wx, wz, st.x1, st.z1, st.x2, st.z2) < st.width * 0.58 + 1.5) {
        return true;
      }
    }
  }
  // 2. Fallback hydrography bridge check before layout is first generated
  const { bridges } = getCityHydrography(cleanId);
  for (const br of bridges) {
    if (distToSeg(dx, dz, br.x1, br.z1, br.x2, br.z2) < br.width * 0.58 + 1.5) return true;
  }
  return false;
}

function makeRng(seed: number) {
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function distToSeg(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 0.001) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / lenSq));
  return Math.hypot(px - (x1 + t * vx), pz - (z1 + t * vz));
}

const LAYOUT_CACHE = new Map<string, GeneratedTownLayout>();

/** Explicitly clear cached layouts ONLY when the 3D town scene also rebuilds (guarantees 100% 1:1 sync between 3D buildings & 2D minimap!) */
export function clearTownLayoutCache(): void {
  LAYOUT_CACHE.clear();
}

/**
 * Procedural L-System / Branching Street-Graph + Curbside Lot-Subdivision Town Generator!
 * Produces completely organic, non-circular streetscapes (arterials, curved side lanes,
 * T-junctions, alleys, tangent railway) with street-aligned 10x-area building lots!
 */
export function generateTownLayout(anchor: WorldTownAnchor3D): GeneratedTownLayout {
  const cached = LAYOUT_CACHE.get(anchor.id);
  if (cached) return cached;

  const cleanCityId = (anchor.landmarkCityId ?? anchor.id).replace(/^geo_city_/, '').replace(/^city_/, '');
  const seedVal = hashCitySeed(cleanCityId) + anchor.seed;
  const rng = makeRng(seedVal * 31 + 17);
  const cx = anchor.x;
  const cz = anchor.z;

  const streets: TownStreetSeg[] = [];
  const junctions: TownJunctionNode[] = [];
  const rail: TownStreetSeg[] = [];
  const hydro = getCityHydrography(cleanCityId);
  const rivers: TownRiverSpline[] = hydro.rivers.map((rv) => ({
    ...rv,
    points: rv.points.map(([rx, rz]) => [cx + rx, cz + rz] as [number, number]),
  }));

  const addSeg = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    widthStart: number,
    widthEnd: number,
    kind: TownStreetSeg['kind'],
    isBridge = false,
    bridgeStyle?: 'nanpu' | 'yangpu' | 'waibaidu',
    laneCount?: TownStreetSeg['laneCount'],
  ) => {
    // Scale road widths to authentic wide urban proportions so cars, voxel city buses & sidewalks fit spaciously!
    const widthMult = isBridge
      ? 1.28
      : kind === 'arterial'
        ? 1.52
        : kind === 'street'
          ? 1.42
          : 1.24;
    const minW = isBridge ? 22 : kind === 'arterial' ? 30.0 : kind === 'street' ? 21.5 : 13.0;
    const laneTotal = laneCount ?? (kind === 'arterial' ? 4 : 2);
    const normalizeWidth = (width:number) => kind === 'alley' || kind === 'rail' ? width : previewRoadRibbonWidth(width,laneTotal);
    const w0 = normalizeWidth(Math.max(minW, Math.round(widthStart * widthMult * 10) / 10));
    const w1 = normalizeWidth(Math.max(minW, Math.round(widthEnd * widthMult * 10) / 10));
    const segment:TownStreetSeg = {
      x1,
      z1,
      x2,
      z2,
      width: (w0 + w1) * 0.5,
      widthStart: w0,
      widthEnd: w1,
      kind,
      isBridge,
      bridgeStyle,
      laneCount,
    };
    streets.push(...splitRoadAtWater(segment,(x,z)=>getShanghaiRiverSignedDist(x-cx,z-cz,cleanCityId)));
  };

  const parks: TownParkZone[] = [];
  const metroLines: TownMetroLine[] = [];

  // ==================== 2D TENSOR FIELD + RK2 STREAMLINE + REAL COASTLINE BOUNDARY CITY GENERATOR ====================
  // Actual 3D & 2D roads, parks & buildings expand across the ENTIRE real dry-land metropolitan footprint (NEVER a tiny circle or ocean spill!)
  const cityCoords = lookupCityLatLng(cleanCityId);
  const realHighwayAngles = cityCoords ? getLocalRealHighwayAnglesForCity(cityCoords.lat, cityCoords.lng) : [];
  const isMegacity = [
    'shanghai',
    'beijing',
    'guangzhou',
    'shenzhen',
    'tokyo',
    'seoul',
    'hangzhou',
    'chengdu',
    'wuhan',
    'osaka',
    'chongqing',
    'nanjing',
    'tianjin',
    'suzhou',
    'xian',
  ].includes(cleanCityId);
  const cityRadius = isMegacity ? 1850 : 1250;
  const kmPerDegLngLocal = cityCoords ? Math.max(12, 111.32 * Math.cos((cityCoords.lat * Math.PI) / 180)) : 95;
  const isUrbanLandLocal =
    cityCoords && isRealUrbanDryLand(cityCoords.lat, cityCoords.lng)
      ? (lx: number, lz: number) => {
          const lat = cityCoords.lat - lz / (GEO_UNITS_PER_KM * 111.32);
          const lng = cityCoords.lng + lx / (GEO_UNITS_PER_KM * kmPerDegLngLocal);
          return isRealUrbanDryLand(lat, lng);
        }
      : undefined;

  const baseGridAngle =
    cleanCityId === 'beijing'
      ? 0
      : cleanCityId === 'shanghai'
        ? -0.05
        : (rng() - 0.5) * 0.42;

  if (cleanCityId === 'shanghai') {
    const shEdges = buildShanghaiRealRoadNetwork((lx, lz) => getShanghaiRiverSignedDist(lx, lz, 'shanghai'));
    for (const e of shEdges) {
      addSeg(
        cx + e.x1,
        cz + e.z1,
        cx + e.x2,
        cz + e.z2,
        e.width,
        e.width,
        e.kind,
        Boolean(e.isBridge),
        e.bridgeStyle,
        e.laneCount,
      );
    }
  } else {
    const tensorGraph = generateTensorCityRoads({
      cityId: cleanCityId,
      seed: seedVal,
      radius: cityRadius,
      baseGridAngle,
      rivers: hydro.rivers,
      highwayAngles: realHighwayAngles,
      riverSignedDist: (lx, lz) => getShanghaiRiverSignedDist(lx, lz, cleanCityId),
      isUrbanLand: isUrbanLandLocal,
    });

    for (const e of tensorGraph.edges) {
      addSeg(
        cx + e.x1,
        cz + e.z1,
        cx + e.x2,
        cz + e.z2,
        e.width,
        e.width,
        e.kind,
        Boolean(e.isBridge),
        e.bridgeStyle,
        e.laneCount,
      );
    }
    for (const jn of tensorGraph.junctions) {
      junctions.push({
        x: cx + jn.x,
        z: cz + jn.z,
        width: jn.width,
        depth: jn.depth,
        rotY: jn.rotY,
        kind: jn.kind,
      });
    }
  }

  // Place 2 lush urban parks STRICTLY INSIDE dry road-free blocks (ZERO park footpath ever extending onto an asphalt road!)
  const parkSpotClear = (wx: number, wz: number, pw: number, pd: number) => {
    const halfDiag = Math.hypot(pw * 0.5, pd * 0.5);
    if (getShanghaiRiverSignedDist(wx - cx, wz - cz, cleanCityId) < halfDiag + 8) return false;
    for (const st of streets) {
      if (distToSeg(wx, wz, st.x1, st.z1, st.x2, st.z2) < roadSidewalkOuterHalfWidth(st.width) + halfDiag + 3.5) return false;
    }
    for (const pk of parks) {
      if (Math.hypot(wx - pk.x, wz - pk.z) < 64) return false;
    }
    return true;
  };
  const parkNames =
    cleanCityId === 'shanghai'
      ? ['人民广场公园', '世纪公园', '静安雕塑公园', '徐家汇公园']
      : [`${anchor.name}中心公园`, `${anchor.name}滨水公园`, `${anchor.name}森林公园`, `${anchor.name}市民广场`];
  for (let pi = 0; pi < 4; pi++) {
    let placed = false;
    for (const [pw, pd] of [
      [44, 38],
      [34, 30],
      [26, 24],
    ]) {
      if (placed) break;
      for (let tries = 0; tries < 60; tries++) {
        const ang = (pi * Math.PI * 0.5 + 0.3) + (tries / 60) * Math.PI * 2 + (rng() - 0.5) * 0.4;
        const dist = pi === 0 ? 45 + (tries % 5) * 18 : 180 + pi * 135 + (tries % 6) * 28;
        const wx = Math.round(cx + Math.cos(ang) * dist);
        const wz = Math.round(cz + Math.sin(ang) * dist);
        if (parkSpotClear(wx, wz, pw, pd)) {
          parks.push({
            id: `${anchor.id}_park_${pi}`,
            name: parkNames[pi],
            x: wx,
            z: wz,
            w: pw,
            d: pd,
            hasPond: true,
            hasFountain: pi === 0,
          });
          placed = true;
          break;
        }
      }
    }
  }

  // Colored Urban Metro Lines: Line 2 links 1:10 Suburban HSR Hub (虹桥火车站 31.195°N, 121.318°E ≈ cx-1447, cz+389) straight through Jing'an, People's Square, Lujiazui & Zhangjiang!
  const metroPalette = ['#2f9e44', '#ae3ec9', '#1c7ed6', '#e8590c'];
  const mCol1 = cleanCityId === 'shanghai' ? '#2f9e44' : metroPalette[seedVal % metroPalette.length];
  const mCol2 = cleanCityId === 'shanghai' ? '#ae3ec9' : metroPalette[(seedVal + 1) % metroPalette.length];
  const cosB = Math.cos(baseGridAngle);
  const sinB = Math.sin(baseGridAngle);
  const hsrHubX = cleanCityId === 'shanghai' ? cx - 1447 : cx - Math.round(cityRadius * 0.68);
  const hsrHubZ = cleanCityId === 'shanghai' ? cz + 389 : cz - 80;

  const m1Pts: [number, number][] =
    cleanCityId === 'shanghai'
      ? [
          [hsrHubX, hsrHubZ],
          [cx - 320, cz - 85],
          [cx, cz],
          [cx + 365, cz - 88],
          [cx + 1280, cz + 340],
        ]
      : [
          [hsrHubX, hsrHubZ],
          [cx + Math.round(-420 * cosB), cz + Math.round(-420 * sinB)],
          [cx, cz],
          [cx + Math.round(380 * cosB), cz + Math.round(380 * sinB)],
          [cx + Math.round(820 * cosB), cz + Math.round(820 * sinB)],
        ];
  const m2Pts: [number, number][] = [-860, -380, 0, 420, 920].map((s) => [
    cx + Math.round(-s * sinB),
    cz + Math.round(s * cosB),
  ]);
  metroLines.push(
    {
      id: `${cleanCityId}_m1`,
      color: mCol1,
      points: m1Pts,
      stations: [
        { x: m1Pts[0][0], z: m1Pts[0][1], name: cleanCityId === 'shanghai' ? '虹桥火车站' : `${anchor.name}高铁站` },
        { x: m1Pts[1][0], z: m1Pts[1][1], name: cleanCityId === 'shanghai' ? '静安寺' : `${anchor.name}西站` },
        { x: m1Pts[2][0], z: m1Pts[2][1], name: cleanCityId === 'shanghai' ? '人民广场' : `${anchor.name}中心` },
        { x: m1Pts[3][0], z: m1Pts[3][1], name: cleanCityId === 'shanghai' ? '陆家嘴' : `${anchor.name}东站` },
      ],
    },
    {
      id: `${cleanCityId}_m2`,
      color: mCol2,
      points: m2Pts,
      stations: [
        { x: m2Pts[1][0], z: m2Pts[1][1], name: cleanCityId === 'shanghai' ? '汉中路' : `${anchor.name}北站` },
        { x: m2Pts[3][0], z: m2Pts[3][1], name: cleanCityId === 'shanghai' ? '徐家汇' : `${anchor.name}南站` },
      ],
    },
  );

  // 6B. Auto-Detect Clean Road Intersections (Crossroads & Major Junctions) so EVERY crossing gets a crisp zebra-crosswalk pad & traffic signals!
  const segIntersect = (
    a: TownStreetSeg,
    b: TownStreetSeg,
  ): { x: number; z: number } | null => {
    const dx1 = a.x2 - a.x1;
    const dz1 = a.z2 - a.z1;
    const dx2 = b.x2 - b.x1;
    const dz2 = b.z2 - b.z1;
    const denom = dx1 * dz2 - dz1 * dx2;
    if (Math.abs(denom) < 1e-3) return null;
    const t = ((b.x1 - a.x1) * dz2 - (b.z1 - a.z1) * dx2) / denom;
    const u = ((b.x1 - a.x1) * dz1 - (b.z1 - a.z1) * dx1) / denom;
    if (t >= -0.04 && t <= 1.04 && u >= -0.04 && u <= 1.04) {
      return { x: a.x1 + t * dx1, z: a.z1 + t * dz1 };
    }
    return null;
  };
  const landOnlyStreets = streets.filter((s) => !s.isBridge && s.kind !== 'alley');
  for (let i = 0; i < landOnlyStreets.length; i++) {
    for (let j = i + 1; j < landOnlyStreets.length; j++) {
      const a = landOnlyStreets[i];
      const b = landOnlyStreets[j];
      // Skip consecutive segments of the same gentle polyline
      const aDirX = a.x2 - a.x1;
      const aDirZ = a.z2 - a.z1;
      const bDirX = b.x2 - b.x1;
      const bDirZ = b.z2 - b.z1;
      const aLen = Math.hypot(aDirX, aDirZ) || 1;
      const bLen = Math.hypot(bDirX, bDirZ) || 1;
      const cosAng = Math.abs((aDirX * bDirX + aDirZ * bDirZ) / (aLen * bLen));
      if (cosAng > 0.86) continue;
      const hit = segIntersect(a, b);
      if (!hit) continue;
      if (getShanghaiRiverSignedDist(hit.x - cx, hit.z - cz, cleanCityId) < 12) continue;
      if (parks.some((pk) => Math.abs(hit.x - pk.x) < pk.w * 0.45 && Math.abs(hit.z - pk.z) < pk.d * 0.45)) continue;
      if (junctions.some((ex) => Math.hypot(ex.x - hit.x, ex.z - hit.z) < 56)) continue;
      const isMajor = a.kind === 'arterial' || b.kind === 'arterial';
      const padW = isMajor ? 36 : 22;
      const primary = a.kind === 'arterial' ? a : b;
      const rotY = Math.atan2(primary.x2 - primary.x1, primary.z2 - primary.z1);
      junctions.push({ x: hit.x, z: hit.z, width: padW, depth: padW, rotY, kind: 'cross' });
    }
  }

  // 7. Suburban High-Speed Railway Hub & Tracks OUTSIDE Downtown (e.g. 上海虹桥高铁站 on West Outer Ring — NEVER cutting through downtown!)
  let rx = hsrHubX - 18;
  let rz = hsrHubZ - 132;
  let ra = Math.PI * 0.52;
  for (let i = 0; i < 6; i++) {
    const nrx = rx + Math.cos(ra) * 44;
    const nrz = rz + Math.sin(ra) * 44;
    rail.push({ x1: rx, z1: rz, x2: nrx, z2: nrz, width: 7.5, kind: 'rail' });
    rx = nrx;
    rz = nrz;
    ra -= 0.012;
  }

  const midRail = rail[2];
  const stationX = (midRail.x1 + midRail.x2) * 0.5;
  const stationZ = (midRail.z1 + midRail.z2) * 0.5;
  const stationRotY = -Math.atan2(midRail.z2 - midRail.z1, midRail.x2 - midRail.x1);

  // Snap transit tram stop cleanly onto a straight mid-block arterial curbside (STRICTLY away from intersections!)
  let busX = cx - 28;
  let busZ = cz + 28;
  let busRotY = 0;
  for (const st of streets) {
    if (st.isBridge || st.kind !== 'arterial') continue;
    const sLen = Math.hypot(st.x2 - st.x1, st.z2 - st.z1);
    if (sLen < 42) continue;
    const mx = (st.x1 + st.x2) * 0.5;
    const mz = (st.z1 + st.z2) * 0.5;
    const dCenter = Math.hypot(mx - cx, mz - cz);
    const farFromJunction = !junctions.some((jn) => Math.hypot(jn.x - mx, jn.z - mz) < 28);
    if (dCenter > 26 && dCenter < 165 && farFromJunction && getShanghaiRiverSignedDist(mx - cx, mz - cz, cleanCityId) > 16) {
      const ux = (st.x2 - st.x1) / sLen;
      const uz = (st.z2 - st.z1) / sLen;
      const nx = -uz;
      const nz = ux;
      // Place Bus Stop right along the outer curbside lane (parallel to road!) with sidewalk shelter beside it!
      busX = mx + nx * (st.width * 0.34);
      busZ = mz + nz * (st.width * 0.34);
      busRotY = Math.atan2(ux, uz);
      break;
    }
  }

  // 8. Block-Adaptive Curbside Lot Subdivision — O(1) Spatial-Bucketed Street & Lot Clearance (~20x faster city generation!)
  const lots: TownBuildingLot[] = [];
  const streetLamps: { x: number; z: number; rotY: number }[] = [];

  const GEN_STREET_CELL = 64;
  const genStreetBuckets = new Map<string, TownStreetSeg[]>();
  for (const st of streets) {
    const pad = roadSidewalkOuterHalfWidth(st.width) + 8.0;
    const gx0 = Math.floor((Math.min(st.x1, st.x2) - pad) / GEN_STREET_CELL);
    const gx1 = Math.floor((Math.max(st.x1, st.x2) + pad) / GEN_STREET_CELL);
    const gz0 = Math.floor((Math.min(st.z1, st.z2) - pad) / GEN_STREET_CELL);
    const gz1 = Math.floor((Math.max(st.z1, st.z2) + pad) / GEN_STREET_CELL);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const k = `${gx},${gz}`;
        let arr = genStreetBuckets.get(k);
        if (!arr) {
          arr = [];
          genStreetBuckets.set(k, arr);
        }
        arr.push(st);
      }
    }
  }
  const isNearAnyStreetFast = (px: number, pz: number, extraPad: number, skipSt?: TownStreetSeg): boolean => {
    const bucket = genStreetBuckets.get(`${Math.floor(px / GEN_STREET_CELL)},${Math.floor(pz / GEN_STREET_CELL)}`);
    if (!bucket) return false;
    for (let i = 0; i < bucket.length; i++) {
      const st = bucket[i];
      if (st === skipSt) continue;
      if (distToSeg(px, pz, st.x1, st.z1, st.x2, st.z2) < roadSidewalkOuterHalfWidth(st.width) + extraPad) return true;
    }
    return false;
  };

  // Sample exact world-space perimeter + interior points for a rotated rect / cylinder / Flatiron-triangle building
  const sampleFootprintWorldPts = (
    lx: number,
    lz: number,
    rotY: number,
    w: number,
    d: number,
    shape: BuildingFootprintShape = 'rect',
  ): [number, number][] => {
    const hw = w * 0.5;
    const hd = d * 0.5;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const toW = (px: number, pz: number): [number, number] => [
      lx + px * cos + pz * sin,
      lz - px * sin + pz * cos,
    ];
    if (shape === 'cylinder') {
      const r = Math.min(hw, hd);
      const pts: [number, number][] = [[lx, lz]];
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        pts.push(toW(Math.cos(a) * r, Math.sin(a) * r));
      }
      return pts;
    }
    if (shape === 'triangle') {
      // Flatiron / Wukang-Mansion wedge: wide streetfront (+hd) tapering to a sleek rounded/chamfered apex at (-hd)!
      const tipW = hw * 0.26;
      return [
        [lx, lz],
        toW(-hw, hd),
        toW(0, hd),
        toW(hw, hd),
        toW(-tipW, -hd),
        toW(tipW, -hd),
        toW(-(hw + tipW) * 0.5, 0),
        toW((hw + tipW) * 0.5, 0),
        toW(0, -hd),
      ];
    }
    return [
      [lx, lz],
      toW(-hw, -hd),
      toW(hw, -hd),
      toW(hw, hd),
      toW(-hw, hd),
      toW(0, hd),
      toW(0, -hd),
      toW(-hw, 0),
      toW(hw, 0),
    ];
  };

  const isFootprintClear = (
    lx: number,
    lz: number,
    rotY: number,
    w: number,
    d: number,
    shape: BuildingFootprintShape = 'rect',
  ): boolean => {
    const hw = w * 0.5;
    const hd = d * 0.5;
    const pts = sampleFootprintWorldPts(lx, lz, rotY, w, d, shape);

    // Every single corner & edge midpoint MUST stay clear of rivers, parks, rails, and ALL road edges!
    for (const [px, pz] of pts) {
      if (getShanghaiRiverSignedDist(px - cx, pz - cz, cleanCityId) < 4.5) return false;
      for (const pk of parks) {
        if (Math.abs(px - pk.x) < pk.w * 0.5 + 3.2 && Math.abs(pz - pk.z) < pk.d * 0.5 + 3.2) {
          return false;
        }
      }
      if (isNearAnyStreetFast(px, pz, 2.2)) return false;
      for (const rl of rail) {
        if (distToSeg(px, pz, rl.x1, rl.z1, rl.x2, rl.z2) < 8.5) return false;
      }
    }

    // Check against already-placed building footprints (with O(1) AABB pre-reject so 97% skip trig!)
    const maxNewSpan = Math.max(w, d) * 0.72;
    for (const ex of lots) {
      const maxPairDist = maxNewSpan + Math.max(ex.width, ex.depth) * 0.72 + 4.0;
      if (Math.abs(lx - ex.x) > maxPairDist || Math.abs(lz - ex.z) > maxPairDist) continue;
      const eCos = Math.cos(ex.rotY);
      const eSin = Math.sin(ex.rotY);
      const eHw = ex.width * 0.5 + 2.8;
      const eHd = ex.depth * 0.5 + 2.8;
      for (const [px, pz] of pts) {
        const dx = px - ex.x;
        const dz = pz - ex.z;
        const elx = dx * eCos - dz * eSin;
        const elz = dx * eSin + dz * eCos;
        if (ex.shape === 'cylinder') {
          if (Math.hypot(elx, elz) < Math.min(ex.width, ex.depth) * 0.5 + 2.8) return false;
        } else if (Math.abs(elx) < eHw && Math.abs(elz) < eHd) {
          return false;
        }
      }
      // Also check existing lot's center/corners against our new box
      const nCos = Math.cos(rotY);
      const nSin = Math.sin(rotY);
      for (const [epx, epz] of sampleFootprintWorldPts(ex.x, ex.z, ex.rotY, ex.width, ex.depth, ex.shape ?? 'rect')) {
        const dx = epx - lx;
        const dz = epz - lz;
        const nlx = dx * nCos - dz * nSin;
        const nlz = dx * nSin + dz * nCos;
        if (shape === 'cylinder') {
          if (Math.hypot(nlx, nlz) < Math.min(hw, hd) + 2.6) return false;
        } else if (Math.abs(nlx) < hw + 2.6 && Math.abs(nlz) < hd + 2.6) {
          return false;
        }
      }
    }
    return true;
  };

  const isTooCloseToRoadOrLot = (lx: number, lz: number, halfW: number, halfD: number): boolean =>
    !isFootprintClear(lx, lz, 0, halfW * 2, halfD * 2, 'cylinder');

  if (cleanCityId === 'shanghai') {
    // Anchor Oriental Pearl Tower (东方明珠) prominently on Pudong Lujiazui's east riverbank!
    let hpRiverX = 36;
    const hpRiv = hydro.rivers.find((r) => r.id === 'huangpu_macro') ?? hydro.rivers[0];
    if (hpRiv && hpRiv.points.length > 0) {
      let bestDz = 9999;
      for (const [px, pz] of hpRiv.points) {
        const dz = Math.abs(pz - -22);
        if (dz < bestDz) {
          bestDz = dz;
          hpRiverX = px;
        }
      }
    }
    let pearlPlaced = false;
    for (let offX = 48; offX <= 128; offX += 14) {
      for (const offZ of [-22, -48, 8, -72, 34]) {
        const tx = cx + hpRiverX + offX;
        const tz = cz + offZ;
        if (!isTooCloseToRoadOrLot(tx, tz, 14, 14)) {
          lots.push({
            id: `${anchor.id}_landmark_main`,
            kind: 'landmark',
            x: tx,
            z: tz,
            rotY: 0,
            width: 28,
            depth: 28,
            houseVariant: 0,
            doorX: tx - 14,
            doorZ: tz + 14,
          });
          pearlPlaced = true;
          break;
        }
      }
      if (pearlPlaced) break;
    }
    if (!pearlPlaced) {
      lots.push({
        id: `${anchor.id}_landmark_main`,
        kind: 'landmark',
        x: cx + hpRiverX + 58,
        z: cz - 24,
        rotY: 0,
        width: 28,
        depth: 28,
        houseVariant: 0,
        doorX: cx + hpRiverX + 44,
        doorZ: cz - 10,
      });
    }
    // Lujiazui Monumental Skyscraper Trio ("厨房三件套" scale!)
    for (const [si, sx, sz] of [
      [0, hpRiverX + 104, -36],
      [1, hpRiverX + 142, 12],
      [2, hpRiverX + 96, 56],
    ] as const) {
      if (!isTooCloseToRoadOrLot(cx + sx, cz + sz, 24, 22)) {
        lots.push({
          id: `${anchor.id}_sky_${si}`,
          kind: 'skyscraper',
          x: cx + sx,
          z: cz + sz,
          rotY: Math.PI * 0.25,
          width: 52,
          depth: 46,
          houseVariant: si,
          doorX: cx + sx - 24,
          doorZ: cz + sz + 24,
        });
      }
    }
  } else if (anchor.landmarkCityId) {
    // Find a prime dry landmark spot unique to this city!
    for (let t = 0; t < 36; t++) {
      const la = (t / 36) * Math.PI * 2 + rng() * 0.25;
      const ld = 48 + (t % 4) * 24;
      const lx = Math.round(cx + Math.cos(la) * ld);
      const lz = Math.round(cz + Math.sin(la) * ld);
      if (!isTooCloseToRoadOrLot(lx, lz, 14, 14)) {
        lots.push({
          id: `${anchor.id}_landmark_main`,
          kind: 'landmark',
          x: lx,
          z: lz,
          rotY: 0,
          width: 28,
          depth: 28,
          houseVariant: 0,
          doorX: lx,
          doorZ: lz + 16,
        });
        break;
      }
    }
  }

  interface CandidateSlot {
    mx: number;
    mz: number;
    nx: number;
    nz: number;
    side: 1 | -1;
    streetHalfW: number;
    x: number;
    z: number;
    rotY: number;
    doorX: number;
    doorZ: number;
    distFromCenter: number;
    isArterial: boolean;
    isPudong: boolean;
  }
  const candidates: CandidateSlot[] = [];

  for (let si = 0; si < streets.length; si++) {
    const st = streets[si];
    if (st.isBridge) continue;
    const dx = st.x2 - st.x1;
    const dz = st.z2 - st.z1;
    const len = Math.hypot(dx, dz);
    if (len < 24) continue;
    const ux = dx / len;
    const uz = dz / len;
    const nx = -uz;
    const nz = ux;

    const segDistCenter = Math.hypot((st.x1 + st.x2) * 0.5 - cx, (st.z1 + st.z2) * 0.5 - cz);
    if (segDistCenter > 2350) continue;

    // Dense urban boulevard streetlamps along sidewalks (every ~42m across inner & middle rings!)
    const lampCount = segDistCenter < 980 && streetLamps.length < 220 ? Math.max(1, Math.floor(len / 42)) : 0;
    for (let li = 0; li < lampCount; li++) {
      const lt = (li + 0.5) / lampCount;
      const lSides = st.kind === 'arterial' ? ([-1, 1] as const) : ([li % 2 === 0 ? 1 : -1] as const);
      for (const lSide of lSides) {
        const lampX = st.x1 + dx * lt + nx * lSide * (st.width * 0.365);
        const lampZ = st.z1 + dz * lt + nz * lSide * (st.width * 0.365);
        const clearOfOtherStreets = !isNearAnyStreetFast(lampX, lampZ, 1.2, st);
        const clearOfJunctions = !junctions.some(
          (jn) => Math.hypot(lampX - jn.x, lampZ - jn.z) < Math.max(jn.width, jn.depth) * 0.54 + 2.0,
        );
        const clearOfParks = !parks.some(
          (pk) => Math.abs(lampX - pk.x) < pk.w * 0.5 + 1.8 && Math.abs(lampZ - pk.z) < pk.d * 0.5 + 1.8,
        );
        const clearOfOtherLamps = !streetLamps.some((prev) => Math.hypot(prev.x - lampX, prev.z - lampZ) < 16);
        if (
          clearOfOtherStreets &&
          clearOfJunctions &&
          clearOfParks &&
          clearOfOtherLamps &&
          getShanghaiRiverSignedDist(lampX - cx, lampZ - cz, cleanCityId) > 4
        ) {
          streetLamps.push({ x: lampX, z: lampZ, rotY: Math.atan2(-nx * lSide, -nz * lSide) });
        }
      }
    }

    // Curbside lot cadence (tighter in downtown, spacious in outer suburban rings so buildings span the whole 1:10 metropolis!)
    const lotSpacing = segDistCenter < 750 ? 52.0 : 128.0;
    const stepsAlong = Math.max(1, Math.floor(len / lotSpacing));
    for (let k = 0; k < stepsAlong; k++) {
      const t = (k + 0.5) / stepsAlong;
      const mx = st.x1 + dx * t;
      const mz = st.z1 + dz * t;
      for (const side of [-1, 1] as const) {
        const setback = roadSidewalkOuterHalfWidth(st.width) + 22.0;
        const lx = mx + nx * side * setback;
        const lz = mz + nz * side * setback;
        const doorX = mx + nx * side * (roadSidewalkOuterHalfWidth(st.width) + 3.0);
        const doorZ = mz + nz * side * (roadSidewalkOuterHalfWidth(st.width) + 3.0);
        const rotY = Math.atan2(-nx * side, -nz * side);
        candidates.push({
          mx,
          mz,
          nx,
          nz,
          side,
          streetHalfW: roadSidewalkOuterHalfWidth(st.width),
          x: lx,
          z: lz,
          rotY,
          doorX,
          doorZ,
          distFromCenter: Math.hypot(lx - (cx - 24), lz - cz),
          isArterial: st.kind === 'arterial',
          isPudong: cleanCityId === 'shanghai' ? lx - cx > 180 : rng() < 0.25,
        });
      }
    }
  }

  candidates.sort((a, b) => a.distFromCenter - b.distFromCenter);

  // Adaptive Block-Fitting Solver: adjusts setback, building dimensions & shape ('rect' / 'triangle' / 'cylinder') so ZERO corners EVER touch a road!
  const tryFitLotAtCandidate = (
    cand: CandidateSlot,
    baseW: number,
    baseD: number,
    allowSpecialShapes: boolean,
    preferShape: BuildingFootprintShape = 'rect',
    minScale = 0.72,
  ): { x: number; z: number; w: number; d: number; shape: BuildingFootprintShape } | null => {
    const scales = [1.0, 0.90, 0.80, 0.72, 0.62, 0.52].filter((s) => s >= minScale - 0.001);
    const shapeOrder: BuildingFootprintShape[] = allowSpecialShapes
      ? preferShape === 'cylinder'
        ? ['cylinder', 'triangle', 'rect']
        : preferShape === 'triangle'
          ? ['triangle', 'cylinder', 'rect']
          : ['rect', 'triangle', 'cylinder']
      : ['rect'];

    for (const sc of scales) {
      const wTry = Math.round(baseW * sc * 10) / 10;
      const dTry = Math.round(baseD * sc * 10) / 10;
      for (const sh of shapeOrder) {
        const effW = sh === 'cylinder' ? Math.min(wTry, dTry * 1.08) : wTry;
        const effD = sh === 'cylinder' ? effW : dTry;
        const cSetback = cand.streetHalfW + effD * 0.5 + 3.4;
        const clx = cand.mx + cand.nx * cand.side * cSetback;
        const clz = cand.mz + cand.nz * cand.side * cSetback;
        if (isFootprintClear(clx, clz, cand.rotY, effW, effD, sh)) {
          return { x: clx, z: clz, w: effW, d: effD, shape: sh };
        }
      }
    }
    return null;
  };

  // Flagship Civic Buildings — ALL 4 Enterable with Rich Furnished Interiors (adaptively sized so 0 road overlap!)
  const civicQueue: { kind: TownLotKind; w: number; d: number; walkable?: boolean }[] = [
    { kind: 'pokemon_center', w: 50.0, d: 40.0, walkable: true },
    { kind: 'poke_mart', w: 48.0, d: 39.0, walkable: true },
    { kind: 'hotel', w: 50.0, d: 40.0, walkable: true },
    { kind: 'restaurant', w: 44.0, d: 36.0, walkable: true },
  ];

  let lotCounter = 0;
  for (const cv of civicQueue) {
    for (const cand of candidates) {
      if (cleanCityId === 'shanghai' && cand.isPudong) continue;
      const fit = tryFitLotAtCandidate(cand, cv.w, cv.d, false, 'rect', 0.74);
      if (!fit) continue;
      lots.push({
        id: `${anchor.id}_lot_${lotCounter++}`,
        kind: cv.kind,
        x: fit.x,
        z: fit.z,
        rotY: cand.rotY,
        width: fit.w,
        depth: fit.d,
        shape: 'rect',
        houseVariant: lotCounter,
        walkable: cv.walkable,
        doorX: cand.doorX,
        doorZ: cand.doorZ,
      });
      break;
    }
  }

  let houseCount = 0;
  const targetHouseMax = cleanCityId === 'shanghai' ? 220 : isMegacity ? 145 : 95;
  for (const cand of candidates) {
    if (houseCount >= targetHouseMax) break;
    if (isUrbanLandLocal && !isUrbanLandLocal(cand.x - cx, cand.z - cz)) continue;
    const isSky = cand.isPudong && houseCount % 2 === 0;
    const wantWalkable = !isSky && houseCount < 6;
    const hw = isSky ? 46 + (houseCount % 3) * 3.5 : 40.0 + (houseCount % 3) * 3.0;
    const hd = isSky ? 42 + (houseCount % 2) * 3.5 : 34.0 + (houseCount % 2) * 2.5;
    // Architectural diversity + automatic wedge/rotunda adaptation in triangular & curved blocks!
    const preferredShape: BuildingFootprintShape = wantWalkable
      ? 'rect'
      : houseCount % 7 === 3
        ? 'cylinder'
        : houseCount % 9 === 5
          ? 'triangle'
          : 'rect';
    const fit = tryFitLotAtCandidate(cand, hw, hd, !wantWalkable, preferredShape, wantWalkable ? 0.78 : 0.50);
    if (!fit) continue;
    lots.push({
      id: `${anchor.id}_house_${houseCount}`,
      kind: isSky ? 'skyscraper' : 'house',
      x: fit.x,
      z: fit.z,
      rotY: cand.rotY,
      width: fit.w,
      depth: fit.d,
      shape: fit.shape,
      houseVariant: (seedVal + houseCount) % 10,
      walkable: wantWalkable,
      doorX: cand.doorX,
      doorZ: cand.doorZ,
    });
    houseCount += 1;
  }

  // Block-Interior Courtyard Infill Pass: populates inner urban blocks (residential compounds, courtyards & towers)
  // so cities NEVER look like hollow shells lining only road edges — even offline without real OSM tiles!
  const nonBridgeStreets = streets.filter((s) => !s.isBridge);
  const interiorMax = cleanCityId === 'shanghai' ? 72 : isMegacity ? 54 : 34;
  let interiorPlaced = 0;
  const infillSpan = isMegacity ? 520 : 340;
  const infillStep = 46;
  const interiorCandidates: { ix: number; iz: number; rotY: number; dist: number; isCore: boolean }[] = [];

  for (let row = 0, gz = -infillSpan; gz <= infillSpan; gz += infillStep, row++) {
    const rowOff = (row % 2) * (infillStep * 0.5);
    for (let gx = -infillSpan + rowOff; gx <= infillSpan; gx += infillStep) {
      const ix = cx + gx + (rng() - 0.5) * 8;
      const iz = cz + gz + (rng() - 0.5) * 8;
      if (isUrbanLandLocal && !isUrbanLandLocal(ix - cx, iz - cz)) continue;
      if (isNearAnyStreetFast(ix, iz, 9.0)) continue;

      let bestStreetDist = Infinity;
      let bestStreetRot = 0;
      for (let si = 0; si < nonBridgeStreets.length; si++) {
        const st = nonBridgeStreets[si];
        const d = distToSeg(ix, iz, st.x1, st.z1, st.x2, st.z2);
        if (d < bestStreetDist) {
          bestStreetDist = d;
          const sdx = st.x2 - st.x1;
          const sdz = st.z2 - st.z1;
          const slen = Math.hypot(sdx, sdz) || 1;
          bestStreetRot = Math.atan2(sdz / slen, -sdx / slen);
        }
      }
      // Strictly inside enclosed city blocks (clear of roadbeds, yet within urban block interiors)
      if (bestStreetDist < 26 || bestStreetDist > 175) continue;
      const dist = Math.hypot(ix - cx, iz - cz);
      interiorCandidates.push({ ix, iz, rotY: bestStreetRot, dist, isCore: dist < 240 });
    }
  }

  interiorCandidates.sort((a, b) => a.dist - b.dist);
  for (const ic of interiorCandidates) {
    if (interiorPlaced >= interiorMax) break;
    const isSky = ic.isCore && interiorPlaced % 4 === 1;
    const baseW = isSky ? 34 + (interiorPlaced % 3) * 3 : 28 + (interiorPlaced % 4) * 3.5;
    const baseD = isSky ? 30 + (interiorPlaced % 2) * 3 : 24 + (interiorPlaced % 3) * 3.0;
    const shape: BuildingFootprintShape =
      interiorPlaced % 8 === 3 ? 'cylinder' : 'rect';
    let placedFit: { w: number; d: number } | null = null;
    for (const sc of [1.0, 0.85, 0.72]) {
      const wTry = Math.round(baseW * sc * 10) / 10;
      const dTry = Math.round(baseD * sc * 10) / 10;
      const effW = shape === 'cylinder' ? Math.min(wTry, dTry) : wTry;
      const effD = shape === 'cylinder' ? effW : dTry;
      if (isFootprintClear(ic.ix, ic.iz, ic.rotY, effW, effD, shape)) {
        placedFit = { w: effW, d: effD };
        break;
      }
    }
    if (!placedFit) continue;
    lots.push({
      id: `${anchor.id}_infill_${interiorPlaced}`,
      kind: isSky ? 'skyscraper' : 'house',
      x: ic.ix,
      z: ic.iz,
      rotY: ic.rotY,
      width: placedFit.w,
      depth: placedFit.d,
      shape,
      houseVariant: (seedVal + houseCount + interiorPlaced) % 10,
      walkable: false,
      doorX: ic.ix,
      doorZ: ic.iz + placedFit.d * 0.5 + 2,
    });
    interiorPlaced += 1;
  }

  let maxDist = 140;
  for (const l of lots) {
    maxDist = Math.max(maxDist, Math.hypot(l.x - cx, l.z - cz) + 18);
  }

  // Build a complete, two-way Physical 3D Intra-City Bus Stop Network (`layout.busStops`):
  // Every destination listed on the city bus board HAS its own real 3D curbside Bus Shelter (`obj_busstop.vox`) & route board!
  const busStops: TownBusStopDef[] = [];

  const tryFindCurbsideBusStopNear = (
    targetX: number,
    targetZ: number,
    maxDistFromTarget: number,
    preferArterialOnly = false,
    relaxed = false,
  ): {
    busX: number;
    busZ: number;
    rotY: number;
    shelterX: number;
    shelterZ: number;
    dropoffX: number;
    dropoffZ: number;
  } | null => {
    let bestScore = -1e9;
    let bestHit: {
      busX: number;
      busZ: number;
      rotY: number;
      shelterX: number;
      shelterZ: number;
      dropoffX: number;
      dropoffZ: number;
    } | null = null;

    for (const st of streets) {
      if (st.isBridge || st.kind === 'alley') continue;
      if (preferArterialOnly && st.kind !== 'arterial') continue;
      const sLen = Math.hypot(st.x2 - st.x1, st.z2 - st.z1);
      if (sLen < 34) continue;
      const midX = (st.x1 + st.x2) * 0.5;
      const midZ = (st.z1 + st.z2) * 0.5;
      if (Math.hypot(midX - targetX, midZ - targetZ) > maxDistFromTarget + sLen * 0.6) continue;

      const ux = (st.x2 - st.x1) / sLen;
      const uz = (st.z2 - st.z1) / sLen;
      const nx = -uz;
      const nz = ux;

      for (const frac of [0.24, 0.38, 0.5, 0.62, 0.76]) {
        const px = st.x1 + (st.x2 - st.x1) * frac;
        const pz = st.z1 + (st.z2 - st.z1) * frac;
        const distTarget = Math.hypot(px - targetX, pz - targetZ);
        if (distTarget > maxDistFromTarget) continue;
        if (getShanghaiRiverSignedDist(px - cx, pz - cz, cleanCityId) < 16) continue;
        if (junctions.some((jn) => Math.hypot(jn.x - px, jn.z - pz) < 22)) continue;

        for (const side of [1, -1] as const) {
          const localWidth=(st.widthStart??st.width)+((st.widthEnd??st.width)-(st.widthStart??st.width))*frac;
          const roadEdge=localWidth*.34375;
          const shX = px + nx * side * (roadEdge + 1.7);
          const shZ = pz + nz * side * (roadEdge + 1.7);
          const busOffset=outerLaneCenterOffset(localWidth,st.laneCount??(st.kind==='arterial'?4:2));
          const candBusX = px + nx * side * busOffset;
          const candBusZ = pz + nz * side * busOffset;
          const dropX = px + nx * side * (roadEdge + 3.8);
          const dropZ = pz + nz * side * (roadEdge + 3.8);

          if (!relaxed && isNearAnyStreetFast(shX, shZ, 1.8, st)) continue;
          if (busStops.some((bs) => Math.hypot(bs.shelterX - shX, bs.shelterZ - shZ) < 64)) continue;
          if (!relaxed && parks.some((pk) => Math.abs(shX - pk.x) < pk.w * 0.5 + 1.6 && Math.abs(shZ - pk.z) < pk.d * 0.5 + 1.6)) {
            continue;
          }

          let blockedByLot = false;
          let minDoorDist = 999;
          for (const l of lots) {
            const dd = Math.hypot(shX - l.doorX, shZ - l.doorZ);
            if (dd < minDoorDist) minDoorDist = dd;
            if (dd < 14.0) {
              blockedByLot = true;
              break;
            }
            const maxSpan = Math.max(l.width, l.depth) * 0.72 + 5.0;
            if (Math.abs(shX - l.x) > maxSpan || Math.abs(shZ - l.z) > maxSpan) continue;
            const cosL = Math.cos(l.rotY);
            const sinL = Math.sin(l.rotY);
            const dxL = shX - l.x;
            const dzL = shZ - l.z;
            const localX = Math.abs(dxL * cosL - dzL * sinL);
            const localZ = Math.abs(dxL * sinL + dzL * cosL);
            if (localX < l.width * 0.5 + 4.0 && localZ < l.depth * 0.5 + 4.0) {
              blockedByLot = true;
              break;
            }
          }
          if (blockedByLot && !relaxed) continue;

          const sameSideDot = (targetX - px) * (nx * side) + (targetZ - pz) * (nz * side);
          const nearPark = parks.some(
            (pk) => Math.hypot(shX - pk.x, shZ - pk.z) < Math.hypot(pk.w * 0.5, pk.d * 0.5) + 12,
          );
          const score =
            -distTarget * 1.15 +
            (sameSideDot >= 0 ? 22 : 0) +
            (st.kind === 'arterial' ? 14 : 0) +
            (nearPark ? 24 : 0) +
            Math.min(24, minDoorDist) - (blockedByLot ? 400 : 0);

          if (score > bestScore) {
            bestScore = score;
            bestHit = {
              busX: candBusX,
              busZ: candBusZ,
              rotY: side > 0 ? Math.atan2(ux, uz) : Math.atan2(-ux, -uz),
              shelterX: shX,
              shelterZ: shZ,
              dropoffX: dropX,
              dropoffZ: dropZ,
            };
          }
        }
      }
    }
    return bestHit;
  };

  // 1) Central Plaza Hub Bus Terminal (`中心广场总站` / `人民广场总站`)
  const primaryParkForBus = parks[0];
  const hubTargetX = primaryParkForBus?.x ?? cx - 28;
  const hubTargetZ = primaryParkForBus?.z ?? cz + 18;
  const hubFound =
    tryFindCurbsideBusStopNear(hubTargetX, hubTargetZ, 185, true) ??
    tryFindCurbsideBusStopNear(cx, cz, 220, false) ??
    tryFindCurbsideBusStopNear(cx, cz, 600, false) ??
    tryFindCurbsideBusStopNear(cx, cz, 1000, false, true);
  if (hubFound) {
    busX = hubFound.busX;
    busZ = hubFound.busZ;
    busRotY = hubFound.rotY;
    busStops.push({
      id: 'bus_hub',
      name: cleanCityId === 'shanghai' ? '人民广场总站' : `${anchor.name.replace(/市$/, '')}中心总站`,
      servesLabel: `${primaryParkForBus?.name ?? '中心广场'} · 市内环线总站`,
      ...hubFound,
      hasParkedBus: true,
    });
  } else {
    const bFwdX0 = Math.sin(busRotY);
    const bFwdZ0 = Math.cos(busRotY);
    const shX0 = busX - bFwdZ0 * 4.4;
    const shZ0 = busZ + bFwdX0 * 4.4;
    busStops.push({
      id: 'bus_hub',
      name: cleanCityId === 'shanghai' ? '人民广场总站' : `${anchor.name.replace(/市$/, '')}中心总站`,
      servesLabel: '市中心广场换乘总站',
      busX,
      busZ,
      rotY: busRotY,
      shelterX: shX0,
      shelterZ: shZ0,
      dropoffX: (busX + shX0) * 0.5,
      dropoffZ: (busZ + shZ0) * 0.5,
      hasParkedBus: true,
    });
  }

  // 2) Dedicated Curbside Bus Stops for Flagship Facilities (or shared stop when two buildings sit on the same block < 72m!)
  const facilityStopSpecs: {
    kind: TownLotKind;
    stopId: string;
    stopName: string;
    facilityShort: string;
  }[] = [
    { kind: 'pokemon_center', stopId: 'bus_pc', stopName: '宝可梦中心站', facilityShort: '宝可梦中心' },
    { kind: 'poke_mart', stopId: 'bus_mart', stopName: '友好百货站', facilityShort: '友好百货' },
    { kind: 'hotel', stopId: 'bus_hotel', stopName: '驿站大酒店站', facilityShort: '驿站大酒店' },
    { kind: 'restaurant', stopId: 'bus_rest', stopName: '树果饭店站', facilityShort: '树果料理餐厅' },
    {
      kind: 'landmark',
      stopId: 'bus_landmark',
      stopName: cleanCityId === 'shanghai' ? '陆家嘴明珠站' : '城市地标站',
      facilityShort: cleanCityId === 'shanghai' ? '东方明珠塔' : '城市地标',
    },
  ];
  for (const fSpec of facilityStopSpecs) {
    const lot = lots.find((l) => l.kind === fSpec.kind);
    if (!lot) continue;
    const existingNear = busStops.find((bs) => Math.hypot(bs.dropoffX - lot.doorX, bs.dropoffZ - lot.doorZ) < 72);
    if (existingNear) {
      if (!existingNear.servesLabel.includes(fSpec.facilityShort)) {
        existingNear.servesLabel = `${existingNear.servesLabel} · ${fSpec.facilityShort}`;
      }
      if (fSpec.kind === 'pokemon_center' && existingNear.id !== 'bus_hub') {
        existingNear.id = 'bus_pc';
      }
      continue;
    }
    const placedStop =
      tryFindCurbsideBusStopNear(lot.doorX, lot.doorZ, 165, false) ??
      tryFindCurbsideBusStopNear(lot.x, lot.z, 210, false);
    if (placedStop) {
      busStops.push({
        id: fSpec.stopId,
        name: fSpec.stopName,
        servesLabel: `下车即达${fSpec.facilityShort}`,
        ...placedStop,
      });
    }
  }

  // 3) Outer Scenic Park Bus Stop (e.g. 世纪公园站 / 滨水公园站) so outer districts also have two-way transit!
  if (parks.length >= 2) {
    const outerPark = parks[1];
    if (!busStops.some((bs) => Math.hypot(bs.dropoffX - outerPark.x, bs.dropoffZ - outerPark.z) < 88)) {
      const pkStop = tryFindCurbsideBusStopNear(outerPark.x, outerPark.z, 150, false);
      if (pkStop) {
        busStops.push({
          id: 'bus_park',
          name: `${outerPark.name}站`,
          servesLabel: `下车即达${outerPark.name}`,
          ...pkStop,
        });
      }
    }
  }

  // 4) Suburban High-Speed Rail Hub Bus Terminal (`虹桥高铁站公交站` / `城郊高铁站公交站`) right in the HSR station forecourt!
  {
    const cosSt = Math.cos(stationRotY);
    const sinSt = Math.sin(stationRotY);
    // Forecourt local coords: platform spans z=[2.3..8.5], canopy ends z=9.5 -> place shelter cleanly at (x=-15.5, z=13.2) & shuttle bus at (x=-15.5, z=17.6)!
    const toStationWorld = (lx: number, lz: number): [number, number] => [
      stationX + lx * cosSt + lz * sinSt,
      stationZ - lx * sinSt + lz * cosSt,
    ];
    const [hsrShX, hsrShZ] = toStationWorld(-15.5, 13.2);
    const [hsrBusX, hsrBusZ] = toStationWorld(-15.5, 18.9);
    const [hsrDropX, hsrDropZ] = toStationWorld(-15.5, 14.8);
    // `busOut` points from `hsrBus` toward `hsrSh` (`local -Z` -> `(-sinSt, -cosSt)` -> `rotY = stationRotY - Math.PI / 2`)
    const hsrBusRotY = stationRotY - Math.PI / 2;
    busStops.push({
      id: 'bus_hsr',
      name: cleanCityId === 'shanghai' ? '虹桥高铁站公交站' : `${anchor.name.replace(/市$/, '')}高铁站公交站`,
      servesLabel: '零距离换乘城郊高铁站（跨省高铁 / 国际航班）',
      busX: hsrBusX,
      busZ: hsrBusZ,
      rotY: hsrBusRotY,
      shelterX: hsrShX,
      shelterZ: hsrShZ,
      dropoffX: hsrDropX,
      dropoffZ: hsrDropZ,
      hasParkedBus: true,
    });
  }

  // Prune any streetlamp that would pierce ANY Bus Shelter roof OR stand directly in front of a shop doorway!
  const filteredLamps = streetLamps.filter((lm) => {
    for (const bs of busStops) {
      if (Math.hypot(lm.x - bs.busX, lm.z - bs.busZ) < 9.5) return false;
      if (Math.hypot(lm.x - bs.shelterX, lm.z - bs.shelterZ) < 8.0) return false;
    }
    if (lots.some((l) => l.walkable && Math.hypot(lm.x - l.doorX, lm.z - l.doorZ) < 6.2)) return false;
    return true;
  });
  streetLamps.length = 0;
  streetLamps.push(...filteredLamps);

  const primaryPark = parks[0];
  const layout: GeneratedTownLayout = {
    townId: anchor.id,
    townName: anchor.name,
    centerX: cx,
    centerZ: cz,
    streets,
    junctions,
    rivers,
    parks,
    metroLines,
    rail,
    lots,
    busStops,
    plazaX: primaryPark?.x ?? cx - 42,
    plazaZ: primaryPark?.z ?? cz + 8,
    busX,
    busZ,
    busRotY,
    stationX,
    stationZ,
    stationRotY,
    streetLamps,
    boundingRadius: maxDist,
  };
  LAYOUT_CACHE.set(anchor.id, layout);
  return layout;
}
