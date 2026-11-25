import type { WorldTownAnchor3D } from '../data/survivorsTactics';

export interface TownStreetSeg {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
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

  // 1. Cities: Skylines Grand Metropolis Road Hierarchy (proportionally scaled to 8-Lane Boulevards!):
  // - Main 8-Lane Grand Boulevards with Central Green Median & Wide Sidewalks (width = 24.0m)
  // - Secondary 4-Lane Collector Avenues with Sidewalks & Tree Verges (width = 14.0m)
  // - Cozy Pedestrian Cobblestone Alleys (width = 7.6m)
  const addChain = (
    sx: number,
    sz: number,
    angle: number,
    steps: number,
    segLen: number,
    bendPerStep: number,
    width: number,
    kind: TownStreetSeg['kind'],
  ): { x: number; z: number; angle: number }[] => {
    let x = sx;
    let z = sz;
    let a = angle;
    const nodes: { x: number; z: number; angle: number }[] = [{ x, z, angle: a }];
    for (let i = 0; i < steps; i++) {
      const nx = x + Math.cos(a) * segLen;
      const nz = z + Math.sin(a) * segLen;
      // Keep every street strictly inside the city's expansive plateau (r <= 96m, well inside plazaRadius 112m!)
      if (Math.hypot(nx - cx, nz - cz) > 96) break;
      streets.push({ x1: x, z1: z, x2: nx, z2: nz, width, kind });
      x = nx;
      z = nz;
      a += bendPerStep;
      nodes.push({ x, z, angle: a });
    }
    return nodes;
  };

  // Straight 8-Lane Cardinal Boulevards radiating cleanly from the Grand Central Plaza edge (r = 22m -> 94m)!
  const eastNodes = addChain(cx + 22, cz, 0, 2, 36, 0, 24.0, 'arterial');
  const westNodes = addChain(cx - 22, cz, Math.PI, 2, 36, 0, 24.0, 'arterial');
  const southNodes = addChain(cx, cz + 22, Math.PI * 0.5, 2, 36, 0, 24.0, 'arterial');
  const northNodes = addChain(cx, cz - 22, -Math.PI * 0.5, 2, 36, 0, 24.0, 'arterial');

  // 2. Branching Secondary 4-Lane Collector Avenues & Pedestrian Alleys (strictly orthogonal 90° T-junctions -> clean Skylines connections!)
  const branchAnchors = [
    { node: eastNodes[1], dir: 1 },
    { node: eastNodes[1], dir: -1 },
    { node: westNodes[1], dir: -1 },
    { node: westNodes[1], dir: 1 },
    { node: southNodes[1], dir: 1 },
    { node: southNodes[1], dir: -1 },
    { node: northNodes[1], dir: -1 },
    { node: northNodes[1], dir: 1 },
  ];

  const addedJunctionKeys = new Set<string>();
  for (let bi = 0; bi < branchAnchors.length; bi++) {
    const entry = branchAnchors[bi];
    if (!entry.node) continue;
    const { node, dir } = entry;
    const turnAng = node.angle + dir * (Math.PI * 0.5);
    const len = 30 + Math.round(rng() * 8);
    const isAlley = bi % 3 === 2;
    const roadW = isAlley ? 7.6 : 14.0;
    // Start the side road right outside the 8-lane boulevard curb edge (12.0m) so the T-junction pad joins them with ZERO overlap!
    const startOff = 12.0;
    const sx = node.x + Math.cos(turnAng) * startOff;
    const sz = node.z + Math.sin(turnAng) * startOff;
    addChain(
      sx,
      sz,
      turnAng,
      1,
      len,
      0,
      roadW,
      isAlley ? 'alley' : 'street',
    );
    const jKey = `${Math.round(node.x)}_${Math.round(node.z)}`;
    if (!addedJunctionKeys.has(jKey)) {
      addedJunctionKeys.add(jKey);
      junctions.push({
        x: node.x,
        z: node.z,
        width: 24.4,
        depth: 24.4,
        rotY: -node.angle,
        kind: 'tee',
      });
    }
  }

  // 3. Gently Curved High-Speed Railway Corridor inside the northern district (z = cz - 72, span ±64m -> max r ≈ 96m < plazaRadius 112m!)
  const railCenterZ = cz - 72;
  let rx = cx - 64;
  let rz = railCenterZ;
  let ra = -0.05;
  for (let i = 0; i < 6; i++) {
    const nrx = rx + Math.cos(ra) * 21.5;
    const nrz = rz + Math.sin(ra) * 21.5;
    rail.push({ x1: rx, z1: rz, x2: nrx, z2: nrz, width: 5.5, kind: 'rail' });
    rx = nrx;
    rz = nrz;
    ra += 0.02;
  }

  // Station sits neatly beside the middle of the rail line
  const midRail = rail[2];
  const stationX = (midRail.x1 + midRail.x2) * 0.5;
  const stationZ = (midRail.z1 + midRail.z2) * 0.5;
  const stationRotY = -Math.atan2(midRail.z2 - midRail.z1, midRail.x2 - midRail.x1);

  // Bus/Tram stop along the West boulevard curb
  const busSeg = westNodes[1];
  const busX = busSeg.x;
  const busZ = busSeg.z + 13.5;
  const busRotY = -busSeg.angle;

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
    // Reject if overlapping the Grand Central Civic Plaza (r = 23m)
    if (Math.hypot(lx - cx, lz - cz) < 24.5 + radius * 0.5) return true;
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

    const stepsAlong = Math.max(1, Math.floor(len / 15.5));
    for (let k = 0; k < stepsAlong; k++) {
      const t = (k + 0.5) / stepsAlong;
      const mx = st.x1 + dx * t;
      const mz = st.z1 + dz * t;
      for (const side of [-1, 1]) {
        const setback = st.width * 0.5 + 9.2;
        const lx = mx + nx * side * setback;
        const lz = mz + nz * side * setback;
        const doorX = mx + nx * side * (st.width * 0.5 + 2.0);
        const doorZ = mz + nz * side * (st.width * 0.5 + 2.0);
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

  // Assign Grand Human-Scale Civic Flagship Lots first (Pokémon Center, Poké Mart, Hotel, Restaurant, Iconic Landmark!)
  const civicQueue: { kind: TownLotKind; w: number; d: number; walkable?: boolean }[] = [
    { kind: 'pokemon_center', w: 19.6, d: 16.0, walkable: true },
    { kind: 'poke_mart', w: 18.2, d: 14.8, walkable: true },
    { kind: 'hotel', w: 18.0, d: 14.6 },
    { kind: 'restaurant', w: 16.6, d: 13.6 },
    ...(anchor.landmarkCityId ? [{ kind: 'landmark' as TownLotKind, w: 13.0, d: 13.0 }] : []),
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

  // Fill remaining organic street-side slots with spacious Residential Houses!
  let houseCount = 0;
  for (const cand of candidates) {
    if (houseCount >= 12) break;
    const hw = 13.8 + (houseCount % 3) * 1.1;
    const hd = 11.8 + (houseCount % 2) * 0.9;
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
