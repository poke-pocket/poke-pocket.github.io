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

  // 1. Real-World Megacity Road Network Templates (each city reflects its iconic real urban plan + tapered lane transitions + branching Y-forks!):
  // - Main 8-Lane Grand Boulevards with Wide Sidewalks & Tree Median (46m -> smoothly tapers to 22m at outer city gates!)
  // - Secondary 4-Lane Collector Avenues & Ring Roads (26m -> tapers cleanly into 14m neighborhood roads!)
  // - Cozy Cobblestone Pedestrian Alleys / Hutongs / Machiya Lanes (12.5m)
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

  // Core 8-Lane Cardinal Grand Boulevards radiating seamlessly from UNDER the Grand Civic Plaza rim (r = 27m -> 57m, then 103m -> 124m)
  // Trimmed cleanly at each 46m intersection pad edge (r = 80 ± 23m) so ZERO curb-skirt triangles ever clip across crosswalks!
  // PLUS Smooth 26m Tapered Gateway Transitions (r = 124m -> 150m: 46m 8-lane -> 22m 4-lane expressway!)
  const cardinals: { dx: number; dz: number; ang: number }[] = [
    { dx: 1, dz: 0, ang: 0 },
    { dx: -1, dz: 0, ang: Math.PI },
    { dx: 0, dz: 1, ang: Math.PI * 0.5 },
    { dx: 0, dz: -1, ang: -Math.PI * 0.5 },
  ];
  const midNodes: { x: number; z: number; ang: number }[] = [];
  for (const c of cardinals) {
    // Inner 8-lane boulevard (starts at r=27 tucked neatly beneath the r=32.5m circular stone plaza, ends flush at intersection edge r=57!)
    addSeg(cx + c.dx * 27, cz + c.dz * 27, cx + c.dx * 57, cz + c.dz * 57, 46, 46, 'arterial');
    midNodes.push({ x: cx + c.dx * 80, z: cz + c.dz * 80, ang: c.ang });
    // Outer 8-lane boulevard (starts flush at outer intersection edge r=103 -> r=124!)
    addSeg(cx + c.dx * 103, cz + c.dz * 103, cx + c.dx * 124, cz + c.dz * 124, 46, 46, 'arterial');
    // Smooth Tapered Gateway Transition (124 -> 150: smoothly narrows 46m 8-lane -> 22m 4-lane expressway!)
    addSeg(cx + c.dx * 124, cz + c.dz * 124, cx + c.dx * 150, cz + c.dz * 150, 46, 22, 'street');
    addJunction(cx + c.dx * 80, cz + c.dz * 80, 46.2, -c.ang, 'cross');
  }

  // 2. Real-World City-Specific Secondary Road Networks, Ring Roads & Angled Y-Forks!
  const cityStyle = anchor.landmarkCityId ?? 'shanghai';
  if (cityStyle === 'beijing' || cityStyle === 'kyoto') {
    // 🏯 Beijing (Ring Road + Axial Grid) & ⛩️ Kyoto (Heian-kyo Grid): Clean Rectangular Ring Loop connecting all 4 avenues at r=80m!
    const ringPts = [
      { x: cx + 80, z: cz },
      { x: cx + 80, z: cz + 80 },
      { x: cx, z: cz + 80 },
      { x: cx - 80, z: cz + 80 },
      { x: cx - 80, z: cz },
      { x: cx - 80, z: cz - 80 },
      { x: cx, z: cz - 80 },
      { x: cx + 80, z: cz - 80 },
    ];
    for (let i = 0; i < ringPts.length; i++) {
      const a = ringPts[i];
      const b = ringPts[(i + 1) % ringPts.length];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const len = Math.hypot(vx, vz);
      // Trim 22m at cardinal boulevard intersections so ZERO overlapping curbs!
      const trimA = i % 2 === 0 ? 22 : 12;
      const trimB = i % 2 === 1 ? 22 : 12;
      if (len > trimA + trimB + 4) {
        addSeg(
          a.x + (vx / len) * trimA,
          a.z + (vz / len) * trimA,
          b.x - (vx / len) * trimB,
          b.z - (vz / len) * trimB,
          26,
          26,
          'street',
        );
      }
      if (i % 2 === 1) {
        addJunction(a.x, a.z, 26.4, 0, 'tee');
        // Branching Hutong / Machiya cobblestone fork off each ring corner!
        const outAng = Math.atan2(a.z - cz, a.x - cx);
        addSeg(
          a.x + Math.cos(outAng) * 13,
          a.z + Math.sin(outAng) * 13,
          a.x + Math.cos(outAng) * 44,
          a.z + Math.sin(outAng) * 44,
          16,
          12,
          'alley',
        );
      }
    }
  } else {
    // 🗼 Shanghai (Lujiazui Radial Ring + Diagonal Y-Forks), Tokyo (Yamanote Orbital Loop + Spokes), Guangzhou (Sweeping Waterfront Forks)!
    // Octagonal Urban Ring Road connecting all 4 Boulevards at r=80m with smooth diagonal diagonals!
    const octR = 80;
    const diagR = cityStyle === 'tokyo' ? 84 : 88;
    const loopNodes = [
      { x: cx + octR, z: cz, isMain: true },
      { x: cx + diagR * 0.707, z: cz + diagR * 0.707, isMain: false },
      { x: cx, z: cz + octR, isMain: true },
      { x: cx - diagR * 0.707, z: cz + diagR * 0.707, isMain: false },
      { x: cx - octR, z: cz, isMain: true },
      { x: cx - diagR * 0.707, z: cz - diagR * 0.707, isMain: false },
      { x: cx, z: cz - octR, isMain: true },
      { x: cx + diagR * 0.707, z: cz - diagR * 0.707, isMain: false },
    ];
    for (let i = 0; i < loopNodes.length; i++) {
      const a = loopNodes[i];
      const b = loopNodes[(i + 1) % loopNodes.length];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const len = Math.hypot(vx, vz);
      const trimA = a.isMain ? 16 : 9;
      const trimB = b.isMain ? 16 : 9;
      if (len > trimA + trimB + 4) {
        addSeg(
          a.x + (vx / len) * trimA,
          a.z + (vz / len) * trimA,
          b.x - (vx / len) * trimB,
          b.z - (vz / len) * trimB,
          26,
          26,
          'street',
        );
      }
      // At every diagonal ring node, create an organic Y-Fork (one radial 4-lane avenue + one tapered neighborhood alley!)
      if (!a.isMain) {
        const ang = Math.atan2(a.z - cz, a.x - cx);
        addJunction(a.x, a.z, 26.4, -ang, 'tee');
        // Fork Arm A: Tapered Collector Avenue (26m -> 18m)
        const forkA = ang + (cityStyle === 'guangzhou' ? 0.34 : 0.28);
        addSeg(
          a.x + Math.cos(forkA) * 13,
          a.z + Math.sin(forkA) * 13,
          a.x + Math.cos(forkA) * (42 + Math.round(rng() * 8)),
          a.z + Math.sin(forkA) * (42 + Math.round(rng() * 8)),
          24,
          16,
          'street',
        );
        // Fork Arm B: Tapered Pedestrian / Neighborhood Alley (16m -> 12m)
        const forkB = ang - 0.36;
        addSeg(
          a.x + Math.cos(forkB) * 13,
          a.z + Math.sin(forkB) * 13,
          a.x + Math.cos(forkB) * (36 + Math.round(rng() * 8)),
          a.z + Math.sin(forkB) * (36 + Math.round(rng() * 8)),
          16,
          12,
          'alley',
        );
      }
    }
  }

  // 3. Gently Curved High-Speed Railway / Metro Corridor connecting seamlessly to Inter-City Rail (z = cz - 108 -> east/west gates!)
  const railCenterZ = cz - 108;
  let rx = cx - 108;
  let rz = railCenterZ;
  let ra = -0.025;
  for (let i = 0; i < 6; i++) {
    const nrx = rx + Math.cos(ra) * 36;
    const nrz = rz + Math.sin(ra) * 36;
    rail.push({ x1: rx, z1: rz, x2: nrx, z2: nrz, width: 7.2, kind: 'rail' });
    rx = nrx;
    rz = nrz;
    ra += 0.01;
  }

  // Station sits neatly beside the middle of the rail line
  const midRail = rail[2];
  const stationX = (midRail.x1 + midRail.x2) * 0.5;
  const stationZ = (midRail.z1 + midRail.z2) * 0.5;
  const stationRotY = -Math.atan2(midRail.z2 - midRail.z1, midRail.x2 - midRail.x1);

  // Bus/Tram stop along the West boulevard wide sidewalk!
  const busNode = midNodes[1];
  const busX = busNode.x;
  const busZ = busNode.z + 24.5;
  const busRotY = -busNode.ang;

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
    // Reject if overlapping the Grand Central Civic Plaza (r = 33m)
    if (Math.hypot(lx - cx, lz - cz) < 34.5 + radius * 0.5) return true;
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
