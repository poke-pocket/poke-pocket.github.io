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
}

export type TownLotKind =
  | 'pokemon_center'
  | 'poke_mart'
  | 'hotel'
  | 'restaurant'
  | 'landmark'
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

  // 1. REAL-WORLD ASYMMETRIC METROPOLIS STREET GRID (NO symmetrical radial snowflake stamps!!):
  // Modeled after real East Asia urban fabric (e.g. Shanghai Puxi/Lujiazui irregular blocks, offset parallel avenues,
  // angled waterfront diagonal boulevard, cross-streets & cobblestone back-alleys — every city has its own authentic urban geometry!)
  const addSeg = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    widthStart: number,
    widthEnd: number,
    kind: TownStreetSeg['kind'],
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
    });
  };

  const addedJunctionKeys = new Set<string>();
  const addJunction = (jx: number, jz: number, size: number, rotY = 0, kind: 'cross' | 'tee' = 'tee') => {
    const key = `${Math.round(jx / 4)}_${Math.round(jz / 4)}`;
    if (addedJunctionKeys.has(key)) return;
    addedJunctionKeys.add(key);
    junctions.push({ x: jx, z: jz, width: size, depth: size, rotY, kind });
  };

  // Primary 8-Lane Urban Axes — TRUE 3x-CHARACTER-WIDTH LANES (~6.0m per lane -> 68m wide 8-lane boulevard, 36m wide 4-lane avenue!)
  // Grand Central Plaza r = 38m, Main Boulevards = 68m wide (half = 34m), Cross-Avenues = 36m wide (half = 18m)!
  // South Grand Avenue (Plaza r=33 -> South Junction r=104 -> Tapered Exit Ramp r=138..172)
  addSeg(cx, cz + 33, cx, cz + 70, 68, 68, 'arterial');
  addJunction(cx, cz + 104, 68.4, 0, 'cross');
  addSeg(cx, cz + 138, cx, cz + 174, 68, 36, 'street'); // smooth tapered 8->4 lane exit!

  // North Grand Avenue (Plaza r=-33 -> North Junction r=-100 -> Tapered Exit Ramp)
  addSeg(cx, cz - 33, cx, cz - 66, 68, 68, 'arterial');
  addJunction(cx, cz - 100, 68.4, 0, 'cross');
  addSeg(cx, cz - 134, cx, cz - 168, 68, 36, 'street');

  // East Boulevard (Century Ave / Pudong financial axis — extended east!)
  addSeg(cx + 33, cz, cx + 74, cz, 68, 68, 'arterial');
  addJunction(cx + 108, cz, 68.4, 0, 'cross');
  addSeg(cx + 142, cz, cx + 180, cz, 68, 36, 'street');

  // West Boulevard (Nanjing West Rd commercial corridor)
  addSeg(cx - 33, cz, cx - 66, cz, 68, 68, 'arterial');
  addJunction(cx - 100, cz, 68.4, 0, 'cross');
  addSeg(cx - 134, cz, cx - 170, cz, 68, 36, 'street');

  // 2. Asymmetric Urban City Blocks, Parallel 4-Lane Collector Avenues (36m wide!) & Cozy Back-Alleys (18m wide)!
  // South Commercial Cross-Avenue at z = cz + 104
  addSeg(cx - 148, cz + 104, cx - 34, cz + 104, 36, 36, 'street');
  addSeg(cx + 34, cz + 104, cx + 150, cz + 104, 36, 36, 'street');

  // North Station Cross-Avenue at z = cz - 100
  addSeg(cx - 142, cz - 100, cx - 34, cz - 100, 36, 36, 'street');
  addSeg(cx + 34, cz - 100, cx + 156, cz - 100, 36, 36, 'street');

  // West Parallel North-South Avenue at x = cx - 100
  addSeg(cx - 100, cz - 100, cx - 100, cz - 34, 36, 36, 'street');
  addSeg(cx - 100, cz + 34, cx - 100, cz + 104, 36, 36, 'street');
  addSeg(cx - 100, cz + 104, cx - 100, cz + 154, 36, 22, 'street');
  addJunction(cx - 100, cz + 104, 36.6, 0, 'cross');
  addJunction(cx - 100, cz - 100, 36.6, 0, 'cross');

  // East Waterfront Parallel Avenue at x = cx + 108
  addSeg(cx + 108, cz - 100, cx + 108, cz - 34, 36, 36, 'street');
  addSeg(cx + 108, cz + 34, cx + 108, cz + 104, 36, 36, 'street');
  addJunction(cx + 108, cz + 104, 36.6, 0, 'cross');
  addJunction(cx + 108, cz - 100, 36.6, 0, 'cross');

  // Organic Diagonal Branching Avenues & Neighborhood Cobblestone Alleys (18m wide!)
  addSeg(cx + 108, cz + 104, cx + 156, cz + 146, 32, 20, 'street');
  addSeg(cx - 100, cz - 100, cx - 144, cz - 136, 30, 20, 'street');
  addSeg(cx - 52, cz + 104, cx - 52, cz + 150, 18, 16, 'alley');
  addSeg(cx + 60, cz - 100, cx + 60, cz - 144, 18, 16, 'alley');
  addSeg(cx - 100, cz + 58, cx - 148, cz + 58, 18, 16, 'alley');
  addSeg(cx + 108, cz - 56, cx + 156, cz - 56, 18, 16, 'alley');

  // 3. Gently Curved High-Speed Railway / Metro Corridor skirting the northern edge of the urban district!
  const railCenterZ = cz - 142;
  let rx = cx - 144;
  let rz = railCenterZ;
  let ra = -0.02;
  for (let i = 0; i < 6; i++) {
    const nrx = rx + Math.cos(ra) * 48;
    const nrz = rz + Math.sin(ra) * 48;
    rail.push({ x1: rx, z1: rz, x2: nrx, z2: nrz, width: 8.4, kind: 'rail' });
    rx = nrx;
    rz = nrz;
    ra += 0.008;
  }

  // Station sits neatly beside the middle of the rail line
  const midRail = rail[2];
  const stationX = (midRail.x1 + midRail.x2) * 0.5;
  const stationZ = (midRail.z1 + midRail.z2) * 0.5;
  const stationRotY = -Math.atan2(midRail.z2 - midRail.z1, midRail.x2 - midRail.x1);

  // Bus/Tram stop along the West boulevard wide sidewalk!
  const busX = cx - 52;
  const busZ = cz + 35.5;
  const busRotY = 0;
  // Consume rng slightly for deterministic architectural variety
  void rng();

  // 4. Automatic Curbside Lot Subdivision (walks both curbs of every street, rejects overlaps!)
  const lots: TownBuildingLot[] = [];
  const streetLamps: { x: number; z: number; rotY: number }[] = [];

  const isTooCloseToRoadOrLot = (lx: number, lz: number, halfW: number, halfD: number): boolean => {
    const radius = Math.hypot(halfW, halfD) * 0.78;
    // Reject if overlapping any street centerline too closely
    for (const st of streets) {
      if (distToSeg(lx, lz, st.x1, st.z1, st.x2, st.z2) < st.width * 0.5 + Math.min(halfW, halfD) * 0.78) {
        return true;
      }
    }
    // Reject if overlapping rail
    for (const rl of rail) {
      if (distToSeg(lx, lz, rl.x1, rl.z1, rl.x2, rl.z2) < 6.5 + radius * 0.5) return true;
    }
    // Reject if overlapping the Grand Central Civic Plaza (r = 39m)
    if (Math.hypot(lx - cx, lz - cz) < 40.5 + radius * 0.5) return true;
    // Reject if overlapping any already placed building lot
    for (const ex of lots) {
      const exR = Math.hypot(ex.width * 0.5, ex.depth * 0.5) * 0.88;
      if (Math.hypot(lx - ex.x, lz - ex.z) < radius + exR + 1.8) return true;
    }
    return false;
  };

  // Candidate slots sorted by distance from town center (so prime civic buildings get downtown main-street lots!)
  interface CandidateSlot {
    x: number;
    z: number;
    rotY: number;
    doorX: number;
    doorZ: number;
    distFromCenter: number;
    isArterial: boolean;
  }
  const candidates: CandidateSlot[] = [];

  for (let si = 0; si < streets.length; si++) {
    const st = streets[si];
    const dx = st.x2 - st.x1;
    const dz = st.z2 - st.z1;
    const len = Math.hypot(dx, dz);
    if (len < 10) continue;
    const ux = dx / len;
    const uz = dz / len;
    // Normal pointing left/right of street
    const nx = -uz;
    const nz = ux;

    // Streetlamps at midpoints
    if (si % 2 === 0) {
      streetLamps.push({
        x: (st.x1 + st.x2) * 0.5 + nx * (st.width * 0.5 + 1.1),
        z: (st.z1 + st.z2) * 0.5 + nz * (st.width * 0.5 + 1.1),
        rotY: Math.atan2(nx, nz),
      });
    }

    const stepsAlong = Math.max(1, Math.floor(len / 22.0));
    for (let k = 0; k < stepsAlong; k++) {
      const t = (k + 0.5) / stepsAlong;
      const mx = st.x1 + dx * t;
      const mz = st.z1 + dz * t;
      for (const side of [-1, 1]) {
        const setback = st.width * 0.5 + 12.5;
        const lx = mx + nx * side * setback;
        const lz = mz + nz * side * setback;
        const doorX = mx + nx * side * (st.width * 0.5 + 2.4);
        const doorZ = mz + nz * side * (st.width * 0.5 + 2.4);
        // Face toward the street! (Three.js +Z forward faces (-nx*side, -nz*side))
        const rotY = Math.atan2(-nx * side, -nz * side);
        candidates.push({
          x: lx,
          z: lz,
          rotY,
          doorX,
          doorZ,
          distFromCenter: Math.hypot(lx - cx, lz - cz),
          isArterial: st.kind === 'arterial',
        });
      }
    }
  }

  candidates.sort((a, b) => a.distFromCenter - b.distFromCenter);

  // Assign Grand Metropolis-Scale Civic Flagship Lots first (matching 8-Lane Boulevards!)
  const civicQueue: { kind: TownLotKind; w: number; d: number; walkable?: boolean }[] = [
    { kind: 'pokemon_center', w: 25.0, d: 20.5, walkable: true },
    { kind: 'poke_mart', w: 23.0, d: 19.0, walkable: true },
    { kind: 'hotel', w: 24.0, d: 19.5 },
    { kind: 'restaurant', w: 21.5, d: 17.5 },
    ...(anchor.landmarkCityId ? [{ kind: 'landmark' as TownLotKind, w: 16.0, d: 16.0 }] : []),
  ];

  let lotCounter = 0;
  for (const cv of civicQueue) {
    for (const cand of candidates) {
      if (cv.kind !== 'landmark' && !cand.isArterial) continue;
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

  // Fill remaining organic street-side slots with spacious Metropolis Townhouses & Villas!
  let houseCount = 0;
  for (const cand of candidates) {
    if (houseCount >= 14) break;
    const hw = 17.5 + (houseCount % 3) * 1.4;
    const hd = 14.8 + (houseCount % 2) * 1.1;
    if (isTooCloseToRoadOrLot(cand.x, cand.z, hw * 0.5, hd * 0.5)) continue;
    lots.push({
      id: `${anchor.id}_house_${houseCount}`,
      kind: 'house',
      x: cand.x,
      z: cand.z,
      rotY: cand.rotY,
      width: hw,
      depth: hd,
      houseVariant: (anchor.seed + houseCount) % 6,
      walkable: houseCount === 0,
      doorX: cand.doorX,
      doorZ: cand.doorZ,
    });
    houseCount += 1;
  }

  let maxDist = 48;
  for (const l of lots) {
    maxDist = Math.max(maxDist, Math.hypot(l.x - cx, l.z - cz) + 12);
  }

  const layout: GeneratedTownLayout = {
    townId: anchor.id,
    townName: anchor.name,
    centerX: cx,
    centerZ: cz,
    streets,
    junctions,
    rail,
    lots,
    plazaX: cx,
    plazaZ: cz,
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
