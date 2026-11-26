import type { WorldTownAnchor3D } from '../data/survivorsTactics';
import {
  GEO_UNITS_PER_KM,
  PROVINCIAL_AND_WORLD_CAPITALS,
  getLocalRealHighwayAnglesForCity,
  getLocalRealRiversForCity,
  isRealUrbanDryLand,
  subscribeGeoDemLoaded,
} from '../data/geoTerrain3D';
import { WORLD_CITIES } from '../data/worldTour';
import { generateTensorCityRoads } from './tensorRoadGen';

export interface TownStreetSeg {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  /** Optional tapered start/end widths for smooth 8-lane -> 4-lane -> 2-lane transitions! */
  widthStart?: number;
  widthEnd?: number;
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

export interface TownBuildingLot {
  id: string;
  kind: TownLotKind;
  x: number; // world X
  z: number; // world Z
  rotY: number; // faces directly onto its street!
  width: number;
  depth: number;
  houseVariant: number;
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

function lookupCityLatLng(cleanId: string): { lat: number; lng: number } | null {
  const wc = WORLD_CITIES.find((c) => c.id === cleanId);
  if (wc) return { lat: wc.lat, lng: wc.lng };
  const cap = PROVINCIAL_AND_WORLD_CAPITALS.find((c) => c.id === cleanId);
  if (cap) return { lat: cap.lat, lng: cap.lng };
  return null;
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
    const realLocal = getLocalRealRiversForCity(coords.lat, coords.lng, 740);
    for (const rr of realLocal) {
      rivers.push({
        id: rr.id,
        name: rr.name,
        width: rr.width,
        points: rr.points,
      });
    }
    // For Shanghai, add Suzhou Creek joining the REAL Huangpu River cleanly at its real confluence!
    if (cleanId === 'shanghai' && rivers.length > 0) {
      const hp = rivers.find((r) => r.id === 'huangpu_macro') ?? rivers[0];
      // Find the point on the real Huangpu River closest to z = -26 (Waibaidu confluence north of Bund)
      let confPt = hp.points[Math.floor(hp.points.length * 0.5)];
      let bestD = 9999;
      for (const p of hp.points) {
        const d = Math.abs(p[1] - -26);
        if (d < bestD) {
          bestD = d;
          confPt = p;
        }
      }
      rivers.push({
        id: 'suzhou_creek',
        name: '苏州河',
        width: 14,
        points: [
          [-215, confPt[1] - 24],
          [-145, confPt[1] - 10],
          [-75, confPt[1] + 2],
          [Math.round(confPt[0] - 24), Math.round(confPt[1] - 4)],
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
    const riverOffset = (rng() > 0.5 ? 1 : -1) * (44 + rng() * 32);
    const waveAmp = 14 + rng() * 20;
    const waveFreq = 0.011 + rng() * 0.007;
    const wavePhase = rng() * Math.PI * 2;
    const mainW = 18 + Math.round(rng() * 10);
    const mainPts: [number, number][] = [];
    for (let s = -210; s <= 210; s += 42) {
      const bend = riverOffset + Math.sin(s * waveFreq + wavePhase) * waveAmp;
      mainPts.push([Math.round(dirX * s + nx * bend), Math.round(dirZ * s + nz * bend)]);
    }
    rivers.push({ id: `${cleanId}_canal`, name: `${cleanId}护城河`, width: mainW, points: mainPts });
  }

  // Generate perpendicular walkable cross-river bridges along each river spline!
  const styles: ('nanpu' | 'yangpu' | 'waibaidu')[] = ['nanpu', 'waibaidu', 'yangpu'];
  for (const riv of rivers) {
    if (riv.points.length < 2) continue;
    const fracs = riv.width >= 18 ? [0.28, 0.56, 0.80] : [0.45, 0.78];
    fracs.forEach((f, idx) => {
      const pIdx = Math.max(0, Math.min(riv.points.length - 2, Math.floor(f * (riv.points.length - 1))));
      const [ax, az] = riv.points[pIdx];
      const [bx, bz] = riv.points[pIdx + 1];
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      if (Math.hypot(mx, mz) > 158) return;
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      const halfSpan = riv.width * 0.5 + 8.5;
      const x1 = Math.round(mx - nx * halfSpan);
      const z1 = Math.round(mz - nz * halfSpan);
      const x2 = Math.round(mx + nx * halfSpan);
      const z2 = Math.round(mz + nz * halfSpan);
      if (bridges.some((b) => Math.hypot((b.x1 + b.x2) * 0.5 - mx, (b.z1 + b.z2) * 0.5 - mz) < 42)) return;
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
  const { rivers } = getCityHydrography(cityId);
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
  return minSigned;
}

export function isOnShanghaiBridgeLocal(dx: number, dz: number, cityId = 'shanghai'): boolean {
  const { bridges } = getCityHydrography(cityId);
  for (const br of bridges) {
    if (distToSeg(dx, dz, br.x1, br.z1, br.x2, br.z2) < br.width * 0.54) return true;
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
// Lazily subscribe after module init (avoids circular ESM TDZ with geoTerrain3D.ts)
// so coastline-clipped city layouts refresh once real NASA/SRTM DEM tiles finish streaming in!
let demCacheClears = 0;
let demSubscribed = false;
function ensureDemCacheSubscription() {
  if (demSubscribed || typeof window === 'undefined') return;
  demSubscribed = true;
  subscribeGeoDemLoaded(() => {
    if (demCacheClears < 6) {
      demCacheClears += 1;
      LAYOUT_CACHE.clear();
    }
  });
}

/**
 * Procedural L-System / Branching Street-Graph + Curbside Lot-Subdivision Town Generator!
 * Produces completely organic, non-circular streetscapes (arterials, curved side lanes,
 * T-junctions, alleys, tangent railway) with 14–18 street-aligned building lots!
 */
export function generateTownLayout(anchor: WorldTownAnchor3D): GeneratedTownLayout {
  ensureDemCacheSubscription();
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
  ) => {
    // Prevent non-bridge ground streets from collapsing down into carved river channels!
    if (!isBridge) {
      const mx = (x1 + x2) * 0.5 - cx;
      const mz = (z1 + z2) * 0.5 - cz;
      if (getShanghaiRiverSignedDist(mx, mz, cleanCityId) < 1.5) {
        return;
      }
    }
    streets.push({
      x1,
      z1,
      x2,
      z2,
      width: (widthStart + widthEnd) * 0.5,
      widthStart,
      widthEnd,
      kind,
      isBridge,
      bridgeStyle,
    });
  };

  const parks: TownParkZone[] = [];
  const metroLines: TownMetroLine[] = [];

  // ==================== 2D TENSOR FIELD + RK2 STREAMLINE + REAL COASTLINE BOUNDARY CITY GENERATOR ====================
  // Actual 3D & 2D roads, parks & buildings expand across the ENTIRE real dry-land metropolitan footprint (NEVER a tiny circle or ocean spill!)
  const cityCoords = lookupCityLatLng(cleanCityId);
  const realHighwayAngles = cityCoords ? getLocalRealHighwayAnglesForCity(cityCoords.lat, cityCoords.lng) : [];
  const isMegacity = ['shanghai', 'beijing', 'guangzhou', 'shenzhen', 'tokyo', 'seoul', 'hangzhou', 'chengdu', 'wuhan', 'osaka'].includes(cleanCityId);
  const cityRadius = isMegacity ? 680 : 460;
  const kmPerDegLngLocal = cityCoords ? Math.max(12, 111.32 * Math.cos((cityCoords.lat * Math.PI) / 180)) : 95;
  const isUrbanLandLocal = cityCoords
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
    );
  }
  // Ensure hydrography bridges are also present if not already bridged by tensor arterials
  for (const br of hydro.bridges) {
    const bmx = cx + (br.x1 + br.x2) * 0.5;
    const bmz = cz + (br.z1 + br.z2) * 0.5;
    const alreadyBridged = streets.some(
      (s) => s.isBridge && Math.hypot((s.x1 + s.x2) * 0.5 - bmx, (s.z1 + s.z2) * 0.5 - bmz) < 42,
    );
    if (!alreadyBridged) {
      addSeg(cx + br.x1, cz + br.z1, cx + br.x2, cz + br.z2, br.width, br.width, 'arterial', true, br.style);
    }
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

  // Place 2 lush urban parks STRICTLY INSIDE dry road-free blocks (ZERO park footpath ever extending onto an asphalt road!)
  const parkSpotClear = (wx: number, wz: number, pw: number, pd: number) => {
    const halfDiag = Math.hypot(pw * 0.5, pd * 0.5);
    if (getShanghaiRiverSignedDist(wx - cx, wz - cz, cleanCityId) < halfDiag + 8) return false;
    for (const st of streets) {
      if (distToSeg(wx, wz, st.x1, st.z1, st.x2, st.z2) < st.width * 0.5 + halfDiag + 3.5) return false;
    }
    for (const pk of parks) {
      if (Math.hypot(wx - pk.x, wz - pk.z) < 64) return false;
    }
    return true;
  };
  const parkNames =
    cleanCityId === 'shanghai'
      ? ['人民广场公园', '世纪公园']
      : [`${anchor.name}中心公园`, `${anchor.name}滨水公园`];
  for (let pi = 0; pi < 2; pi++) {
    let placed = false;
    for (const [pw, pd] of [
      [34, 30],
      [26, 24],
      [22, 20],
    ]) {
      if (placed) break;
      for (let tries = 0; tries < 60; tries++) {
        const ang = (pi === 0 ? 0.3 : 3.3) + (tries / 60) * Math.PI * 2 + (rng() - 0.5) * 0.4;
        const dist = pi === 0 ? 38 + (tries % 5) * 14 : 78 + (tries % 6) * 14;
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

  // Colored Urban Metro Lines following the city's actual tensor arterial axes!
  const metroPalette = ['#2f9e44', '#ae3ec9', '#1c7ed6', '#e8590c'];
  const mCol1 = cleanCityId === 'shanghai' ? '#2f9e44' : metroPalette[seedVal % metroPalette.length];
  const mCol2 = cleanCityId === 'shanghai' ? '#ae3ec9' : metroPalette[(seedVal + 1) % metroPalette.length];
  const cosB = Math.cos(baseGridAngle);
  const sinB = Math.sin(baseGridAngle);
  const m1Pts: [number, number][] = [-150, -75, 0, 75, 150].map((s) => [
    cx + Math.round(s * cosB),
    cz + Math.round(s * sinB),
  ]);
  const m2Pts: [number, number][] = [-145, -72, 0, 72, 145].map((s) => [
    cx + Math.round(-s * sinB),
    cz + Math.round(s * cosB),
  ]);
  metroLines.push(
    {
      id: `${cleanCityId}_m1`,
      color: mCol1,
      points: m1Pts,
      stations: [
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
        { x: m2Pts[1][0], z: m2Pts[1][1], name: cleanCityId === 'shanghai' ? '上海火车站' : `${anchor.name}北站` },
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

  // 7. Curved High-Speed Railway Corridor across North District
  const railCenterZ = cz - 146;
  let rx = cx - 156;
  let rz = railCenterZ;
  let ra = -0.015 + (rng() - 0.5) * 0.03;
  for (let i = 0; i < 6; i++) {
    const nrx = rx + Math.cos(ra) * 44;
    const nrz = rz + Math.sin(ra) * 44;
    rail.push({ x1: rx, z1: rz, x2: nrx, z2: nrz, width: 7.5, kind: 'rail' });
    rx = nrx;
    rz = nrz;
    ra += 0.008;
  }

  const midRail = rail[2];
  const stationX = (midRail.x1 + midRail.x2) * 0.5;
  const stationZ = (midRail.z1 + midRail.z2) * 0.5;
  const stationRotY = -Math.atan2(midRail.z2 - midRail.z1, midRail.x2 - midRail.x1);

  const busX = cx - 28;
  const busZ = cz + 28;
  const busRotY = 0;

  // 8. Automatic Curbside Lot Subdivision — STRICTLY avoiding THIS city's Rivers, Bridges & Parks!
  const lots: TownBuildingLot[] = [];
  const streetLamps: { x: number; z: number; rotY: number }[] = [];

  const isTooCloseToRoadOrLot = (lx: number, lz: number, halfW: number, halfD: number): boolean => {
    const radius = Math.hypot(halfW, halfD) * 0.82;
    if (getShanghaiRiverSignedDist(lx - cx, lz - cz, cleanCityId) < radius + 4.5) return true;
    for (const pk of parks) {
      if (
        Math.abs(lx - pk.x) < pk.w * 0.5 + halfW + 3.0 &&
        Math.abs(lz - pk.z) < pk.d * 0.5 + halfD + 3.0
      ) {
        return true;
      }
    }
    for (const st of streets) {
      if (distToSeg(lx, lz, st.x1, st.z1, st.x2, st.z2) < st.width * 0.5 + Math.hypot(halfW, halfD) * 0.86 + 1.4) {
        return true;
      }
    }
    for (const rl of rail) {
      if (distToSeg(lx, lz, rl.x1, rl.z1, rl.x2, rl.z2) < 6.5 + radius * 0.5) return true;
    }
    for (const ex of lots) {
      const exR = Math.hypot(ex.width * 0.5, ex.depth * 0.5) * 0.92;
      if (Math.hypot(lx - ex.x, lz - ex.z) < radius + exR + 1.8) return true;
    }
    return false;
  };

  if (cleanCityId === 'shanghai') {
    lots.push({
      id: `${anchor.id}_landmark_main`,
      kind: 'landmark',
      x: cx + 68,
      z: cz - 24,
      rotY: 0,
      width: 16,
      depth: 16,
      houseVariant: 0,
      doorX: cx + 60,
      doorZ: cz - 14,
    });
    for (const [si, sx, sz] of [
      [0, 96, -24],
      [1, 118, -8],
      [2, 84, 34],
    ] as const) {
      if (!isTooCloseToRoadOrLot(cx + sx, cz + sz, 9.5, 9.5)) {
        lots.push({
          id: `${anchor.id}_sky_${si}`,
          kind: 'skyscraper',
          x: cx + sx,
          z: cz + sz,
          rotY: Math.PI * 0.25,
          width: 18,
          depth: 16,
          houseVariant: si,
          doorX: cx + sx - 8,
          doorZ: cz + sz + 8,
        });
      }
    }
  } else if (anchor.landmarkCityId) {
    // Find a prime dry landmark spot unique to this city!
    for (let t = 0; t < 24; t++) {
      const la = rng() * Math.PI * 2;
      const ld = 36 + rng() * 44;
      const lx = Math.round(cx + Math.cos(la) * ld);
      const lz = Math.round(cz + Math.sin(la) * ld);
      if (!isTooCloseToRoadOrLot(lx, lz, 9, 9)) {
        lots.push({
          id: `${anchor.id}_landmark_main`,
          kind: 'landmark',
          x: lx,
          z: lz,
          rotY: 0,
          width: 16,
          depth: 16,
          houseVariant: 0,
          doorX: lx,
          doorZ: lz + 10,
        });
        break;
      }
    }
  }

  interface CandidateSlot {
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
    if (len < 12) continue;
    const ux = dx / len;
    const uz = dz / len;
    const nx = -uz;
    const nz = ux;

    if (si % 2 === 0) {
      const lampX = (st.x1 + st.x2) * 0.5 + nx * (st.width * 0.5 + 1.4);
      const lampZ = (st.z1 + st.z2) * 0.5 + nz * (st.width * 0.5 + 1.4);
      const clearOfOtherStreets = !streets.some(
        (other) => other !== st && distToSeg(lampX, lampZ, other.x1, other.z1, other.x2, other.z2) < other.width * 0.5 + 1.4,
      );
      const clearOfJunctions = !junctions.some(
        (jn) => Math.hypot(lampX - jn.x, lampZ - jn.z) < Math.max(jn.width, jn.depth) * 0.58 + 2.5,
      );
      const clearOfParks = !parks.some(
        (pk) => Math.abs(lampX - pk.x) < pk.w * 0.5 + 2 && Math.abs(lampZ - pk.z) < pk.d * 0.5 + 2,
      );
      if (
        clearOfOtherStreets &&
        clearOfJunctions &&
        clearOfParks &&
        getShanghaiRiverSignedDist(lampX - cx, lampZ - cz, cleanCityId) > 4
      ) {
        streetLamps.push({ x: lampX, z: lampZ, rotY: Math.atan2(nx, nz) });
      }
    }

    const stepsAlong = Math.max(1, Math.floor(len / 24.0));
    for (let k = 0; k < stepsAlong; k++) {
      const t = (k + 0.5) / stepsAlong;
      const mx = st.x1 + dx * t;
      const mz = st.z1 + dz * t;
      for (const side of [-1, 1]) {
        const setback = st.width * 0.5 + 11.5;
        const lx = mx + nx * side * setback;
        const lz = mz + nz * side * setback;
        const doorX = mx + nx * side * (st.width * 0.5 + 2.2);
        const doorZ = mz + nz * side * (st.width * 0.5 + 2.2);
        const rotY = Math.atan2(-nx * side, -nz * side);
        candidates.push({
          x: lx,
          z: lz,
          rotY,
          doorX,
          doorZ,
          distFromCenter: Math.hypot(lx - (cx - 24), lz - cz),
          isArterial: st.kind === 'arterial',
          isPudong: cleanCityId === 'shanghai' ? lx - cx > 42 : rng() < 0.25,
        });
      }
    }
  }

  candidates.sort((a, b) => a.distFromCenter - b.distFromCenter);

  const civicQueue: { kind: TownLotKind; w: number; d: number; walkable?: boolean }[] = [
    { kind: 'pokemon_center', w: 23.0, d: 19.0, walkable: true },
    { kind: 'poke_mart', w: 21.0, d: 17.5, walkable: true },
    { kind: 'hotel', w: 22.0, d: 18.0 },
    { kind: 'restaurant', w: 19.5, d: 16.0 },
  ];

  let lotCounter = 0;
  for (const cv of civicQueue) {
    for (const cand of candidates) {
      if (cleanCityId === 'shanghai' && cand.isPudong) continue;
      if (isTooCloseToRoadOrLot(cand.x, cand.z, cv.w * 0.5, cv.d * 0.5)) continue;
      lots.push({
        id: `${anchor.id}_lot_${lotCounter++}`,
        kind: cv.kind,
        x: cand.x,
        z: cand.z,
        rotY: cand.rotY,
        width: cv.w,
        depth: cv.d,
        houseVariant: lotCounter,
        walkable: cv.walkable,
        doorX: cand.doorX,
        doorZ: cand.doorZ,
      });
      break;
    }
  }

  let houseCount = 0;
  for (const cand of candidates) {
    if (houseCount >= 52) break;
    if (isUrbanLandLocal && !isUrbanLandLocal(cand.x - cx, cand.z - cz)) continue;
    const hw = 15.5 + (houseCount % 3) * 1.4;
    const hd = 13.5 + (houseCount % 2) * 1.2;
    if (isTooCloseToRoadOrLot(cand.x, cand.z, hw * 0.5, hd * 0.5)) continue;
    lots.push({
      id: `${anchor.id}_house_${houseCount}`,
      kind: cand.isPudong && houseCount % 2 === 0 ? 'skyscraper' : 'house',
      x: cand.x,
      z: cand.z,
      rotY: cand.rotY,
      width: hw,
      depth: hd,
      houseVariant: (seedVal + houseCount) % 10,
      walkable: houseCount === 0,
      doorX: cand.doorX,
      doorZ: cand.doorZ,
    });
    houseCount += 1;
  }

  let maxDist = 140;
  for (const l of lots) {
    maxDist = Math.max(maxDist, Math.hypot(l.x - cx, l.z - cz) + 18);
  }

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
