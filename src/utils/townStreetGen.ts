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
    // For Shanghai, add Suzhou Creek joining the REAL Huangpu River cleanly if not already in REAL_WORLD_RIVERS!
    if (cleanId === 'shanghai' && rivers.length > 0 && !rivers.some((r) => r.id === 'suzhou_macro')) {
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
  // Also respect real famous urban lakes (e.g. Hangzhou's West Lake 西湖, Kunming's Dianchi 滇池) so streets/buildings NEVER pave over the lake!
  const cityGeo = lookupCityLatLng(cleanId);
  if (cityGeo) {
    const kmPerDegLng = Math.max(12, 111.32 * Math.cos((cityGeo.lat * Math.PI) / 180));
    const ptLng = cityGeo.lng + dx / (kmPerDegLng * GEO_UNITS_PER_KM);
    const ptLat = cityGeo.lat - dz / (111.32 * GEO_UNITS_PER_KM);
    // Keep exact city spawn plaza (0,0) dry within 26m
    if (Math.hypot(dx, dz) > 26) {
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

export function isOnShanghaiBridgeLocal(dx: number, dz: number, cityId = 'shanghai'): boolean {
  const cleanId = cityId.replace(/^geo_city_/, '').replace(/^city_/, '');
  // 1. Check all Tensor-generated + hydrography bridges in cached town layout (includes +4m bank approach aprons!)
  for (const [, lay] of LAYOUT_CACHE) {
    const layClean = lay.townId.replace(/^geo_city_/, '').replace(/^city_/, '');
    if (layClean !== cleanId) continue;
    for (const st of lay.streets) {
      if (!st.isBridge) continue;
      if (distToSeg(lay.centerX + dx, lay.centerZ + dz, st.x1, st.z1, st.x2, st.z2) < st.width * 0.58 + 1.5) {
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
      busX = mx + nx * (st.width * 0.34);
      busZ = mz + nz * (st.width * 0.34);
      busRotY = Math.atan2(ux, uz);
      break;
    }
  }

  // 8. Block-Adaptive Curbside Lot Subdivision — Exact Polygon-vs-Road Clearance + Rect / Cylinder / Flatiron Triangle Shapes!
  const lots: TownBuildingLot[] = [];
  const streetLamps: { x: number; z: number; rotY: number }[] = [];

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
      for (const st of streets) {
        if (distToSeg(px, pz, st.x1, st.z1, st.x2, st.z2) < st.width * 0.5 + 2.2) {
          return false;
        }
      }
      for (const rl of rail) {
        if (distToSeg(px, pz, rl.x1, rl.z1, rl.x2, rl.z2) < 8.5) return false;
      }
    }

    // Check against already-placed building footprints (accurate OBB / circle separation so buildings never overlap!)
    for (const ex of lots) {
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
    if (segDistCenter > 760) continue;

    // Dense urban boulevard streetlamps along sidewalks (every ~38m, curving inward over the roadway!)
    const lampCount = segDistCenter < 480 && streetLamps.length < 150 ? Math.max(1, Math.floor(len / 38)) : 0;
    for (let li = 0; li < lampCount; li++) {
      const lt = (li + 0.5) / lampCount;
      const lSides = st.kind === 'arterial' ? ([-1, 1] as const) : ([li % 2 === 0 ? 1 : -1] as const);
      for (const lSide of lSides) {
        const lampX = st.x1 + dx * lt + nx * lSide * (st.width * 0.5 + 1.35);
        const lampZ = st.z1 + dz * lt + nz * lSide * (st.width * 0.5 + 1.35);
        const clearOfOtherStreets = !streets.some(
          (other) => other !== st && distToSeg(lampX, lampZ, other.x1, other.z1, other.x2, other.z2) < other.width * 0.5 + 1.2,
        );
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

    // 46m curbside lot cadence — exact setback & shape will adapt dynamically to each block's geometry!
    const stepsAlong = Math.max(1, Math.floor(len / 46.0));
    for (let k = 0; k < stepsAlong; k++) {
      const t = (k + 0.5) / stepsAlong;
      const mx = st.x1 + dx * t;
      const mz = st.z1 + dz * t;
      for (const side of [-1, 1] as const) {
        const setback = st.width * 0.5 + 22.0;
        const lx = mx + nx * side * setback;
        const lz = mz + nz * side * setback;
        const doorX = mx + nx * side * (st.width * 0.5 + 3.0);
        const doorZ = mz + nz * side * (st.width * 0.5 + 3.0);
        const rotY = Math.atan2(-nx * side, -nz * side);
        candidates.push({
          mx,
          mz,
          nx,
          nz,
          side,
          streetHalfW: st.width * 0.5,
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
  const targetHouseMax = cleanCityId === 'shanghai' ? 96 : 52;
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
