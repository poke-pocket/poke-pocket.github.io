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

/** Iconic S-curving Huangpu River (黄浦江) & Suzhou Creek (苏州河) local spline definitions! */
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

/** Signed distance to Shanghai's iconic Huangpu River & Suzhou Creek (negative = inside river water!) */
export function getShanghaiRiverSignedDist(dx: number, dz: number): number {
  let minSigned = 9999;
  for (const riv of SHANGHAI_LOCAL_RIVERS) {
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

/** Bridge corridors spanning Huangpu River & Suzhou Creek (100% walkable elevated bridge decks!) */
export const SHANGHAI_LOCAL_BRIDGES: {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  style: 'nanpu' | 'yangpu' | 'waibaidu';
}[] = [
  { x1: -12, z1: 112, x2: 96, z2: 112, width: 22, style: 'nanpu' },      // 南浦大桥
  { x1: 68, z1: -128, x2: 146, z2: -74, width: 22, style: 'yangpu' },    // 杨浦大桥
  { x1: 4, z1: -86, x2: 12, z2: -34, width: 16, style: 'waibaidu' },     // 外白渡桥
  { x1: -116, z1: -88, x2: -110, z2: -42, width: 16, style: 'waibaidu' }, // 苏州河西桥
];

export function isOnShanghaiBridgeLocal(dx: number, dz: number): boolean {
  for (const br of SHANGHAI_LOCAL_BRIDGES) {
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

  const rng = makeRng(anchor.seed * 31 + 17);
  const cx = anchor.x;
  const cz = anchor.z;

  const streets: TownStreetSeg[] = [];
  const junctions: TownJunctionNode[] = [];
  const rail: TownStreetSeg[] = [];
  const rivers: TownRiverSpline[] = SHANGHAI_LOCAL_RIVERS;

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

  // ==================== ORGANIC SHANGHAI MASTERPLAN (MODELED AFTER OUR GBA PIXEL-ART SHANGHAI MAP!) ====================
  // ZERO giant circular roundabout! Real S-curving Huangpu River + Suzhou Creek + People's Square Park + Lujiazui Century Ave!

  // 1. Lush Urban Parks (People's Square Park in Puxi + Century Park in Pudong!)
  const parks: TownParkZone[] = [
    { id: `${anchor.id}_peoples_sq`, name: '人民广场公园', x: cx - 54, z: cz + 6, w: 54, d: 44, hasPond: true, hasFountain: true },
    { id: `${anchor.id}_century_pk`, name: '世纪公园', x: cx + 138, z: cz + 46, w: 56, d: 52, hasPond: true, hasFountain: false },
  ];

  // 2. Curved Golden-Amber Arterial Boulevards (3x-character-width lanes — flowing naturally, NO rigid "+" stamp!)
  // 2A. 南北高架 / 西藏路 (Sweeping N-S Puxi Arterial passing east of People's Square)
  addPolyRoad(
    [
      [-26, -182],
      [-18, -118],
      [-14, -46],
      [-18, 12],
      [-14, 72],
      [-12, 112],
      [-2, 182],
    ],
    28,
    'arterial',
    20,
  );

  // 2B. 延安高架 / 北外滩干线 (Sweeping SW -> NE diagonal arterial curving past the river bend!)
  addPolyRoad(
    [
      [-172, 146],
      [-104, 114],
      [-14, 72],
      [-14, -46],
      [38, -104],
      [96, -158],
    ],
    26,
    'arterial',
    18,
  );

  // 2C. 世纪大道 (Iconic Pudong Lujiazui diagonal 8-lane grand boulevard radiating SE from Oriental Pearl Tower!)
  addPolyRoad(
    [
      [62, -16],
      [92, 16],
      [126, 56],
      [168, 108],
      [204, 158],
    ],
    34,
    'arterial',
    22,
  );

  // 3. Real Walkable Bridges across Huangpu River & Suzhou Creek (南浦大桥 / 杨浦大桥 / 外白渡桥 / 苏州河西桥)!
  for (const br of SHANGHAI_LOCAL_BRIDGES) {
    addSeg(cx + br.x1, cz + br.z1, cx + br.x2, cz + br.z2, br.width, br.width, 'arterial', true, br.style);
  }

  // 4. Organic Puxi Street Grid (West of Huangpu River — dense warm ivory cross-streets & alleys!)
  // Puxi E-W Streets (Nanjing Rd, Huaihai Rd, Fuxing Rd, Suzhou North Rd)
  addPolyRoad([[-168, -124], [-96, -120], [-18, -118], [58, -124]], 16, 'street');
  addPolyRoad([[-174, -22], [-110, -24], [-54, -22], [-16, -24], [6, -26]], 18, 'street');
  addPolyRoad([[-174, 34], [-110, 34], [-86, 34], [-18, 36], [8, 36]], 16, 'street');
  addPolyRoad([[-170, 86], [-110, 86], [-62, 86], [-14, 72]], 16, 'street');
  addPolyRoad([[-158, 134], [-96, 136], [-12, 112]], 15, 'street');

  // Puxi N-S Cross-Streets (offset, slightly angled around Suzhou Creek & People's Square!)
  addPolyRoad([[-144, -152], [-138, -94], [-134, -22], [-136, 48], [-140, 128]], 16, 'street');
  addPolyRoad([[-96, -156], [-104, -92], [-96, -24], [-92, 34], [-96, 98], [-98, 158]], 17, 'street');
  addPolyRoad([[-56, -148], [-58, -94]], 14, 'street');
  addPolyRoad([[-54, 34], [-54, 86], [-52, 146]], 14, 'street');

  // 外滩滨江大道 (The Bund — curved waterfront avenue hugging West bank of Huangpu River!)
  addPolyRoad([[8, -36], [4, -4], [8, 42], [18, 92], [14, 148]], 16, 'street');

  // 5. Pudong / Lujiazui Waterfront Loop & Modern District Avenues (East of Huangpu River!)
  addPolyRoad([[68, -46], [48, -6], [56, 42], [86, 94], [96, 112], [116, 162]], 18, 'street');
  addPolyRoad([[68, -46], [116, -72], [156, -98], [188, -126]], 18, 'street');
  addPolyRoad([[92, 16], [146, -24], [184, -62]], 16, 'street');
  addPolyRoad([[96, 112], [154, 108], [192, 108]], 16, 'street');

  // Cozy Neighborhood Alleys (弄堂)
  addSeg(cx - 118, cz + 6, cx - 94, cz + 6, 10, 10, 'alley');
  addSeg(cx - 74, cz + 58, cx - 54, cz + 58, 10, 10, 'alley');
  addSeg(cx - 122, cz - 142, cx - 96, cz - 140, 10, 10, 'alley');

  // 6. Colored Shanghai Metro Lines (地铁 2 号线绿线 & 地铁 1 号线紫红线) with Crisp Station Dots!
  const metroLines: TownMetroLine[] = [
    {
      id: 'metro_line2',
      color: '#2f9e44',
      points: [
        [cx - 170, cz + 4],
        [cx - 96, cz + 4],
        [cx - 54, cz + 4],
        [cx - 16, cz + 4],
        [cx + 62, cz - 12],
        [cx + 126, cz + 52],
        [cx + 188, cz + 120],
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
        [cx - 14, cz - 170],
        [cx - 16, cz - 96],
        [cx - 18, cz + 12],
        [cx - 54, cz + 36],
        [cx - 96, cz + 86],
        [cx - 156, cz + 150],
      ],
      stations: [
        { x: cx - 16, z: cz - 96, name: '上海火车站' },
        { x: cx - 96, z: cz + 86, name: '徐家汇' },
      ],
    },
  ];

  // 7. Curved High-Speed Railway Corridor across North Puxi (上海火车站)
  const railCenterZ = cz - 146;
  let rx = cx - 156;
  let rz = railCenterZ;
  let ra = -0.015;
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
  void rng();

  // 8. Automatic Curbside Lot Subdivision — STRICTLY avoiding Rivers, Bridges & Parks!
  const lots: TownBuildingLot[] = [];
  const streetLamps: { x: number; z: number; rotY: number }[] = [];

  const isTooCloseToRoadOrLot = (lx: number, lz: number, halfW: number, halfD: number): boolean => {
    const radius = Math.hypot(halfW, halfD) * 0.82;
    // Reject if inside or too close to Huangpu River / Suzhou Creek!
    if (getShanghaiRiverSignedDist(lx - cx, lz - cz) < radius + 4.5) return true;
    // Reject if overlapping People's Square Park or Century Park!
    for (const pk of parks) {
      if (
        Math.abs(lx - pk.x) < pk.w * 0.5 + halfW + 3.0 &&
        Math.abs(lz - pk.z) < pk.d * 0.5 + halfD + 3.0
      ) {
        return true;
      }
    }
    // Reject if overlapping any street centerline
    for (const st of streets) {
      if (distToSeg(lx, lz, st.x1, st.z1, st.x2, st.z2) < st.width * 0.5 + Math.min(halfW, halfD) * 0.82) {
        return true;
      }
    }
    // Reject if overlapping rail
    for (const rl of rail) {
      if (distToSeg(lx, lz, rl.x1, rl.z1, rl.x2, rl.z2) < 6.5 + radius * 0.5) return true;
    }
    // Reject if overlapping any already placed building lot
    for (const ex of lots) {
      const exR = Math.hypot(ex.width * 0.5, ex.depth * 0.5) * 0.92;
      if (Math.hypot(lx - ex.x, lz - ex.z) < radius + exR + 1.8) return true;
    }
    return false;
  };

  // Anchor Iconic Shanghai Lujiazui Skyline FIRST (Oriental Pearl Tower + 3 Tall Modern Blue-Glass Skyscrapers!)
  const landmarkCity = anchor.landmarkCityId ?? 'shanghai';
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
  // Lujiazui Trio Skyscrapers (上海中心 / 环球金融中心 / 金茂大厦 style!)
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
    if (st.isBridge) continue; // never place houses or lamps on bridge water!
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
      if (getShanghaiRiverSignedDist(lampX - cx, lampZ - cz) > 4) {
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
          isPudong: lx - cx > 42,
        });
      }
    }
  }

  candidates.sort((a, b) => a.distFromCenter - b.distFromCenter);

  // Assign Civic Flagship Lots right in downtown Puxi (near People's Square!)
  const civicQueue: { kind: TownLotKind; w: number; d: number; walkable?: boolean }[] = [
    { kind: 'pokemon_center', w: 23.0, d: 19.0, walkable: true },
    { kind: 'poke_mart', w: 21.0, d: 17.5, walkable: true },
    { kind: 'hotel', w: 22.0, d: 18.0 },
    { kind: 'restaurant', w: 19.5, d: 16.0 },
  ];

  let lotCounter = 0;
  for (const cv of civicQueue) {
    for (const cand of candidates) {
      if (cand.isPudong) continue;
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

  // Fill Puxi & Pudong blocks with rich clusters of 24 diverse townhouses, villas & modern towers!
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
      houseVariant: (anchor.seed + houseCount) % 10,
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
  void landmarkCity;

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
    plazaX: cx - 54,
    plazaZ: cz + 6,
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
