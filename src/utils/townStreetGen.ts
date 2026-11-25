import type { WorldTownAnchor3D } from '../data/survivorsTactics';

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

/**
 * Per-city deterministic procedural river & bridge hydrography!
 * - Shanghai uses its signature S-curving Huangpu River + Suzhou Creek.
 * - Every other city (Beijing, Guangzhou, Hangzhou, Tokyo, Kyoto, Osaka, etc.) generates its OWN unique
 *   winding river angle, curvature, optional tributary creek & matching cross-river bridges!
 */
export function getCityHydrography(cityId: string): { rivers: TownRiverSpline[]; bridges: CityBridgeDef[] } {
  const cleanId = cityId.replace(/^geo_city_/, '').replace(/^city_/, '');
  const cached = CITY_HYDRO_CACHE.get(cleanId);
  if (cached) return cached;

  if (cleanId === 'shanghai') {
    const res = { rivers: SHANGHAI_LOCAL_RIVERS, bridges: SHANGHAI_LOCAL_BRIDGES };
    CITY_HYDRO_CACHE.set(cleanId, res);
    return res;
  }

  const rng = makeRng(hashCitySeed(cleanId) * 41 + 9);
  const rivers: TownRiverSpline[] = [];
  const bridges: CityBridgeDef[] = [];

  // Choose unique river axis, offset, S-curve wave amplitude & width for this city!
  const axisAng = rng() * Math.PI;
  const dirX = Math.cos(axisAng);
  const dirZ = Math.sin(axisAng);
  const nx = -dirZ;
  const nz = dirX;
  const riverOffset = (rng() > 0.5 ? 1 : -1) * (34 + rng() * 34);
  const waveAmp = 18 + rng() * 26;
  const waveFreq = 0.011 + rng() * 0.008;
  const wavePhase = rng() * Math.PI * 2;
  const mainW = 22 + Math.round(rng() * 14);

  const mainPts: [number, number][] = [];
  for (let s = -220; s <= 220; s += 44) {
    const bend = riverOffset + Math.sin(s * waveFreq + wavePhase) * waveAmp;
    mainPts.push([Math.round(dirX * s + nx * bend), Math.round(dirZ * s + nz * bend)]);
  }
  rivers.push({ id: `${cleanId}_main_riv`, name: `${cleanId}主河`, width: mainW, points: mainPts });

  // Place 2-3 unique walkable bridges crossing this city's river cleanly!
  const bridgeFracs = [-88, 12, 108];
  const styles: ('nanpu' | 'yangpu' | 'waibaidu')[] = ['nanpu', 'waibaidu', 'yangpu'];
  bridgeFracs.forEach((s, idx) => {
    if (idx === 2 && rng() < 0.35) return;
    const bend = riverOffset + Math.sin(s * waveFreq + wavePhase) * waveAmp;
    const mx = dirX * s + nx * bend;
    const mz = dirZ * s + nz * bend;
    const halfSpan = mainW * 0.85 + 20;
    bridges.push({
      x1: Math.round(mx - nx * halfSpan),
      z1: Math.round(mz - nz * halfSpan),
      x2: Math.round(mx + nx * halfSpan),
      z2: Math.round(mz + nz * halfSpan),
      width: idx === 1 ? 20 : 18,
      style: styles[(idx + Math.floor(rng() * 3)) % 3],
    });
  });

  // 65% of cities also get a winding tributary canal/creek branching off the main river!
  if (rng() < 0.65) {
    const branchSide = rng() > 0.5 ? 1 : -1;
    const branchS = (rng() - 0.5) * 90;
    const bend0 = riverOffset + Math.sin(branchS * waveFreq + wavePhase) * waveAmp;
    const sx = dirX * branchS + nx * bend0;
    const sz = dirZ * branchS + nz * bend0;
    const tribPts: [number, number][] = [[Math.round(sx), Math.round(sz)]];
    for (let k = 1; k <= 4; k++) {
      const dist = k * 48;
      const sway = Math.sin(k * 1.1 + wavePhase) * 18;
      tribPts.push([
        Math.round(sx + nx * branchSide * dist + dirX * sway),
        Math.round(sz + nz * branchSide * dist + dirZ * sway),
      ]);
    }
    rivers.push({ id: `${cleanId}_trib`, name: `${cleanId}支流`, width: 14, points: tribPts });
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

/**
 * Procedural L-System / Branching Street-Graph + Curbside Lot-Subdivision Town Generator!
 * Produces completely organic, non-circular streetscapes (arterials, curved side lanes,
 * T-junctions, alleys, tangent railway) with 14–18 street-aligned building lots!
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

  const addPolyRoad = (
    pts: [number, number][],
    width: number,
    kind: TownStreetSeg['kind'],
    taperEndWidth?: number,
  ) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const isLast = i === pts.length - 2;
      addSeg(cx + ax, cz + az, cx + bx, cz + bz, width, isLast && taperEndWidth ? taperEndWidth : width, kind);
    }
  };

  const parks: TownParkZone[] = [];
  const metroLines: TownMetroLine[] = [];

  if (cleanCityId === 'shanghai') {
    // ==================== SIGNATURE SHANGHAI MASTERPLAN (Huangpu River + Suzhou Creek + People's Square + Lujiazui!) ====================
    parks.push(
      { id: `${anchor.id}_peoples_sq`, name: '人民广场公园', x: cx - 54, z: cz + 6, w: 54, d: 44, hasPond: true, hasFountain: true },
      { id: `${anchor.id}_century_pk`, name: '世纪公园', x: cx + 138, z: cz + 46, w: 56, d: 52, hasPond: true, hasFountain: false },
    );

    addPolyRoad([[-26, -182], [-18, -118], [-14, -46], [-18, 12], [-14, 72], [-12, 112], [-2, 182]], 28, 'arterial', 20);
    // Split SW & NE diagonal arterial branches so they meet the N-S arterial cleanly with ZERO overlapping road meshes!
    addPolyRoad([[-172, 146], [-104, 114], [-14, 72]], 26, 'arterial', 22);
    addPolyRoad([[-14, -46], [38, -104], [96, -158]], 26, 'arterial', 18);
    addPolyRoad([[62, -16], [92, 16], [126, 56], [168, 108], [204, 158]], 34, 'arterial', 22);

    for (const br of hydro.bridges) {
      addSeg(cx + br.x1, cz + br.z1, cx + br.x2, cz + br.z2, br.width, br.width, 'arterial', true, br.style);
    }

    addPolyRoad([[-168, -124], [-96, -120], [-18, -118], [58, -124]], 16, 'street');
    addPolyRoad([[-174, -22], [-110, -24], [-54, -22], [-16, -24], [6, -26]], 18, 'street');
    addPolyRoad([[-174, 34], [-110, 34], [-86, 34], [-18, 36], [8, 36]], 16, 'street');
    addPolyRoad([[-170, 86], [-110, 86], [-62, 86], [-14, 72]], 16, 'street');
    addPolyRoad([[-158, 134], [-96, 136], [-12, 112]], 15, 'street');

    addPolyRoad([[-144, -152], [-138, -94], [-134, -22], [-136, 48], [-140, 128]], 16, 'street');
    addPolyRoad([[-96, -156], [-104, -92], [-96, -24], [-92, 34], [-96, 98], [-98, 158]], 17, 'street');
    addPolyRoad([[-56, -148], [-58, -94]], 14, 'street');
    addPolyRoad([[-54, 34], [-54, 86], [-52, 146]], 14, 'street');
    addPolyRoad([[8, -36], [4, -4], [8, 42], [18, 92], [14, 148]], 16, 'street');

    addPolyRoad([[68, -46], [48, -6], [56, 42], [86, 94], [96, 112], [116, 162]], 18, 'street');
    addPolyRoad([[68, -46], [116, -72], [156, -98], [188, -126]], 18, 'street');
    addPolyRoad([[92, 16], [146, -24], [184, -62]], 16, 'street');
    addPolyRoad([[96, 112], [154, 108], [192, 108]], 16, 'street');

    addSeg(cx - 118, cz + 6, cx - 94, cz + 6, 10, 10, 'alley');
    addSeg(cx - 74, cz + 58, cx - 54, cz + 58, 10, 10, 'alley');
    addSeg(cx - 122, cz - 142, cx - 96, cz - 140, 10, 10, 'alley');

    metroLines.push(
      {
        id: 'metro_line2',
        color: '#2f9e44',
        points: [
          [cx - 170, cz + 4], [cx - 96, cz + 4], [cx - 54, cz + 4],
          [cx - 16, cz + 4], [cx + 62, cz - 12], [cx + 126, cz + 52], [cx + 188, cz + 120],
        ],
        stations: [
          { x: cx - 134, z: cz + 4, name: '静安寺' },
          { x: cx - 54, z: cz + 4, name: '人民广场' },
          { x: cx + 62, z: cz - 12, name: '陆家嘴' },
          { x: cx + 126, z: cz + 52, name: '世纪大道' },
        ],
      },
      {
        id: 'metro_line1',
        color: '#ae3ec9',
        points: [
          [cx - 14, cz - 170], [cx - 16, cz - 96], [cx - 18, cz + 12],
          [cx - 54, cz + 36], [cx - 96, cz + 86], [cx - 156, cz + 150],
        ],
        stations: [
          { x: cx - 16, z: cz - 96, name: '上海火车站' },
          { x: cx - 96, z: cz + 86, name: '徐家汇' },
        ],
      },
    );
  } else {
    // ==================== PROCEDURAL UNIQUE CITY GENERATOR FOR EVERY OTHER REAL CITY ON EARTH! ====================
    // Random urban orientation, curved golden arterials, irregular organic block grid, unique river bridges, parks & metro lines!
    const gridTilt = (rng() - 0.5) * 0.55;
    const cosG = Math.cos(gridTilt);
    const sinG = Math.sin(gridTilt);
    const rotPt = (lx: number, lz: number): [number, number] => [
      Math.round(lx * cosG - lz * sinG),
      Math.round(lx * sinG + lz * cosG),
    ];

    // 1. Place 2 unique lush parks on guaranteed dry land away from this city's river!
    for (let pi = 0; pi < 2; pi++) {
      for (let tries = 0; tries < 24; tries++) {
        const ang = (pi === 0 ? 0.4 : 3.4) + (rng() - 0.5) * 1.4;
        const dist = pi === 0 ? 32 + rng() * 28 : 96 + rng() * 44;
        const px = Math.round(Math.cos(ang) * dist);
        const pz = Math.round(Math.sin(ang) * dist);
        if (getShanghaiRiverSignedDist(px, pz, cleanCityId) > 30) {
          parks.push({
            id: `${anchor.id}_park_${pi}`,
            name: pi === 0 ? `${anchor.name}中心公园` : `${anchor.name}滨水绿地`,
            x: cx + px,
            z: cz + pz,
            w: 44 + Math.round(rng() * 18),
            d: 38 + Math.round(rng() * 16),
            hasPond: true,
            hasFountain: pi === 0,
          });
          break;
        }
      }
    }
    if (parks.length === 0) {
      parks.push({ id: `${anchor.id}_park_0`, name: `${anchor.name}中心公园`, x: cx - 42, z: cz + 12, w: 46, d: 40, hasPond: true, hasFountain: true });
    }

    // 2. Two sweeping curved golden arterial boulevards + a diagonal bypass unique to this city!
    const bend1 = (rng() - 0.5) * 28;
    const bend2 = (rng() - 0.5) * 32;
    const art1: [number, number][] = [];
    const art2: [number, number][] = [];
    for (let s = -170; s <= 170; s += 56) {
      art1.push(rotPt(-12 + Math.sin(s * 0.012) * bend1, s));
      art2.push(rotPt(s, -8 + Math.cos(s * 0.013) * bend2));
    }
    addPolyRoad(art1, 28, 'arterial', 20);
    addPolyRoad(art2, 26, 'arterial', 18);
    // Diagonal grand avenue unique to this city
    const diagSign = rng() > 0.5 ? 1 : -1;
    addPolyRoad(
      [
        rotPt(-140 * diagSign, -110),
        rotPt(-55 * diagSign, -35),
        rotPt(45 * diagSign, 45),
        rotPt(155 * diagSign, 130),
      ],
      24,
      'arterial',
      16,
    );

    // 3. Add this city's unique cross-river bridges!
    for (const br of hydro.bridges) {
      addSeg(cx + br.x1, cz + br.z1, cx + br.x2, cz + br.z2, br.width, br.width, 'arterial', true, br.style);
    }

    // 4. Irregular organic neighborhood street grid (varied spacing per city, avoiding river water!)
    const colOffsets = [-136, -86 + Math.round((rng() - 0.5) * 18), 46 + Math.round((rng() - 0.5) * 18), 108 + Math.round((rng() - 0.5) * 16)];
    const rowOffsets = [-126, -68 + Math.round((rng() - 0.5) * 18), 54 + Math.round((rng() - 0.5) * 18), 116 + Math.round((rng() - 0.5) * 16)];
    for (const ox of colOffsets) {
      const pts: [number, number][] = [];
      for (let z = -150; z <= 150; z += 50) {
        const p = rotPt(ox + Math.round((rng() - 0.5) * 10), z);
        if (getShanghaiRiverSignedDist(p[0], p[1], cleanCityId) > 6) pts.push(p);
        else if (pts.length >= 2) {
          addPolyRoad(pts, 15, 'street');
          pts.length = 0;
        } else pts.length = 0;
      }
      if (pts.length >= 2) addPolyRoad(pts, 15, 'street');
    }
    for (const oz of rowOffsets) {
      const pts: [number, number][] = [];
      for (let x = -150; x <= 150; x += 50) {
        const p = rotPt(x, oz + Math.round((rng() - 0.5) * 10));
        if (getShanghaiRiverSignedDist(p[0], p[1], cleanCityId) > 6) pts.push(p);
        else if (pts.length >= 2) {
          addPolyRoad(pts, 15, 'street');
          pts.length = 0;
        } else pts.length = 0;
      }
      if (pts.length >= 2) addPolyRoad(pts, 15, 'street');
    }

    // 5. Unique colored metro lines for this city!
    const metroPalette = ['#2f9e44', '#ae3ec9', '#1c7ed6', '#e8590c'];
    const cA = metroPalette[Math.floor(rng() * metroPalette.length)];
    const cB = metroPalette[(Math.floor(rng() * 3) + 1) % metroPalette.length];
    const mPts1 = art1.map(([x, z]) => [cx + x, cz + z] as [number, number]);
    const mPts2 = art2.map(([x, z]) => [cx + x, cz + z] as [number, number]);
    metroLines.push(
      {
        id: `${cleanCityId}_m1`,
        color: cA,
        points: mPts1,
        stations: [
          { x: mPts1[1][0], z: mPts1[1][1], name: `${anchor.name}北站` },
          { x: mPts1[3][0], z: mPts1[3][1], name: `${anchor.name}中心` },
          { x: mPts1[5][0], z: mPts1[5][1], name: `${anchor.name}南站` },
        ],
      },
      {
        id: `${cleanCityId}_m2`,
        color: cB,
        points: mPts2,
        stations: [
          { x: mPts2[2][0], z: mPts2[2][1], name: `${anchor.name}西站` },
          { x: mPts2[4][0], z: mPts2[4][1], name: `${anchor.name}东站` },
        ],
      },
    );
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
      const lampX = (st.x1 + st.x2) * 0.5 + nx * (st.width * 0.5 + 1.2);
      const lampZ = (st.z1 + st.z2) * 0.5 + nz * (st.width * 0.5 + 1.2);
      if (getShanghaiRiverSignedDist(lampX - cx, lampZ - cz, cleanCityId) > 4) {
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
    if (houseCount >= 24) break;
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
