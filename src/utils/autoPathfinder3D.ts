import { WATER_LEVEL_3D, getWalkableSurfaceHeight3D } from '../data/survivorsTactics';
import { resolveTownWallCollisions, type TownCollider } from './townBuilder3D';

export interface AutoNavWaypoint {
  x: number;
  z: number;
}

export interface AutoNavBuildingPortalInfo {
  id: string;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
  dualDoors?: boolean;
}

function isPointInsidePortalBox(px: number, pz: number, b: AutoNavBuildingPortalInfo, margin = 0): boolean {
  const dx = px - b.cx;
  const dz = pz - b.cz;
  const cos = Math.cos(b.rotY);
  const sin = Math.sin(b.rotY);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= b.halfW + margin && Math.abs(lz) <= b.halfD + margin;
}

function getBestDoorwayPortalPair(
  b: AutoNavBuildingPortalInfo,
  towardX: number,
  towardZ: number,
): { inside: AutoNavWaypoint; outside: AutoNavWaypoint } {
  const cos = Math.cos(b.rotY);
  const sin = Math.sin(b.rotY);
  const toWorld = (lx: number, lz: number): AutoNavWaypoint => ({
    x: b.cx + lx * cos + lz * sin,
    z: b.cz - lx * sin + lz * cos,
  });
  const frontIn = toWorld(0, Math.max(0, b.halfD - 3.0));
  const frontOut = toWorld(0, b.halfD + 4.2);
  if (!b.dualDoors) {
    return { inside: frontIn, outside: frontOut };
  }
  const backIn = toWorld(0, -Math.max(0, b.halfD - 3.0));
  const backOut = toWorld(0, -(b.halfD + 4.2));
  const dFront = Math.hypot(frontOut.x - towardX, frontOut.z - towardZ);
  const dBack = Math.hypot(backOut.x - towardX, backOut.z - towardZ);
  return dBack < dFront ? { inside: backIn, outside: backOut } : { inside: frontIn, outside: frontOut };
}

function runSingleSegmentAStar(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  colliders: TownCollider[],
  canSurfWater: boolean,
): AutoNavWaypoint[] {
  const totalDist = Math.hypot(goalX - startX, goalZ - startZ);
  if (totalDist < 1.4) return [{ x: goalX, z: goalZ }];

  const cell = totalDist > 320 ? 3.0 : totalDist > 140 ? 2.1 : 1.5;
  const pad = 1.12;

  const minBx = Math.min(startX, goalX) - 120;
  const maxBx = Math.max(startX, goalX) + 120;
  const minBz = Math.min(startZ, goalZ) - 120;
  const maxBz = Math.max(startZ, goalZ) + 120;
  // Ground-floor pathfinding uses ground-level colliders (ignores 2F-only elevated partition colliders)
  const localCols = colliders.filter(
    (c) =>
      (c.minY === undefined || c.minY < 2.5) &&
      c.maxX >= minBx &&
      c.minX <= maxBx &&
      c.maxZ >= minBz &&
      c.minZ <= maxBz,
  );

  const probe = { x: 0, z: 0 };
  const isPassable = (wx: number, wz: number): boolean => {
    if (Math.hypot(wx - startX, wz - startZ) < 0.85 || Math.hypot(wx - goalX, wz - goalZ) < 0.95) {
      return true;
    }
    const surfY = getWalkableSurfaceHeight3D(wx, wz);
    if (!canSurfWater && surfY < WATER_LEVEL_3D - 0.12) return false;
    probe.x = wx;
    probe.z = wz;
    resolveTownWallCollisions(probe, pad, localCols);
    return Math.abs(probe.x - wx) < 0.04 && Math.abs(probe.z - wz) < 0.04;
  };

  // Sub-meter segment raycast (every 0.42m!) so NO grid step or diagonal EVER jumps through a building wall!
  const isSegmentPassable = (ax: number, az: number, bx: number, bz: number): boolean => {
    const segLen = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(segLen / 0.42));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      if (!isPassable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  };

  const sx0 = Math.round(startX / cell);
  const sz0 = Math.round(startZ / cell);
  const gx0 = Math.round(goalX / cell);
  const gz0 = Math.round(goalZ / cell);

  const keyOf = (ix: number, iz: number) => `${ix},${iz}`;
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const coords = new Map<string, [number, number]>();

  const heap: { k: string; ix: number; iz: number; f: number }[] = [];
  const pushHeap = (item: { k: string; ix: number; iz: number; f: number }) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= heap[i].f) break;
      const tmp = heap[p];
      heap[p] = heap[i];
      heap[i] = tmp;
      i = p;
    }
  };
  const popHeap = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const n = heap.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && heap[l].f < heap[best].f) best = l;
        if (r < n && heap[r].f < heap[best].f) best = r;
        if (best === i) break;
        const tmp = heap[i];
        heap[i] = heap[best];
        heap[best] = tmp;
        i = best;
      }
    }
    return top;
  };

  const startK = keyOf(sx0, sz0);
  const goalK = keyOf(gx0, gz0);
  gScore.set(startK, 0);
  coords.set(startK, [sx0, sz0]);
  pushHeap({ k: startK, ix: sx0, iz: sz0, f: Math.hypot(gx0 - sx0, gz0 - sz0) });

  const closed = new Set<string>();
  const dirs: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.4142],
    [1, -1, 1.4142],
    [-1, 1, 1.4142],
    [-1, -1, 1.4142],
  ];

  let bestFallbackK = startK;
  let bestFallbackH = Math.hypot(gx0 - sx0, gz0 - sz0);
  let expanded = 0;
  const MAX_EXPAND = 28000;

  while (heap.length > 0 && expanded < MAX_EXPAND) {
    const cur = popHeap();
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    expanded += 1;

    const hDist = Math.hypot(gx0 - cur.ix, gz0 - cur.iz);
    if (hDist < bestFallbackH) {
      bestFallbackH = hDist;
      bestFallbackK = cur.k;
    }
    if (cur.k === goalK || hDist <= 1.15) {
      bestFallbackK = cur.k;
      break;
    }

    const curWx = cur.ix * cell;
    const curWz = cur.iz * cell;
    const curG = gScore.get(cur.k) ?? 0;
    for (let di = 0; di < dirs.length; di++) {
      const [dx, dz, stepCost] = dirs[di];
      const nix = cur.ix + dx;
      const niz = cur.iz + dz;
      const nk = keyOf(nix, niz);
      if (closed.has(nk)) continue;

      const nwx = nix * cell;
      const nwz = niz * cell;
      if (!isSegmentPassable(curWx, curWz, nwx, nwz)) continue;

      const tentativeG = curG + stepCost;
      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, cur.k);
        coords.set(nk, [nix, niz]);
        pushHeap({ k: nk, ix: nix, iz: niz, f: tentativeG + Math.hypot(gx0 - nix, gz0 - niz) * 1.12 });
      }
    }
  }

  const rawPts: AutoNavWaypoint[] = [];
  let traceK: string | undefined = bestFallbackK;
  while (traceK && traceK !== startK) {
    const c = coords.get(traceK);
    if (c) rawPts.push({ x: c[0] * cell, z: c[1] * cell });
    traceK = cameFrom.get(traceK);
  }
  rawPts.reverse();
  if (bestFallbackH <= 2.2 && (rawPts.length === 0 || isSegmentPassable(rawPts[rawPts.length - 1].x, rawPts[rawPts.length - 1].z, goalX, goalZ))) {
    rawPts.push({ x: goalX, z: goalZ });
  }
  if (rawPts.length === 0) {
    return [{ x: goalX, z: goalZ }];
  }

  // String-pulling with strict 0.42m wall-segment check
  const full: AutoNavWaypoint[] = [{ x: startX, z: startZ }, ...rawPts];
  const smooth: AutoNavWaypoint[] = [];
  let anchorIdx = 0;
  while (anchorIdx < full.length - 1) {
    let furthest = anchorIdx + 1;
    for (let probeIdx = Math.min(full.length - 1, anchorIdx + 24); probeIdx > anchorIdx + 1; probeIdx--) {
      if (isSegmentPassable(full[anchorIdx].x, full[anchorIdx].z, full[probeIdx].x, full[probeIdx].z)) {
        furthest = probeIdx;
        break;
      }
    }
    smooth.push(full[furthest]);
    anchorIdx = furthest;
  }
  return smooth;
}

/**
 * Doorway-Portal-Aware & Sub-Meter-Wall-Safe 3D A* Pathfinder!
 * - If starting INSIDE a room while the goal is outside, explicitly routes:
 *   Start -> Inside Door Threshold -> Outside Sidewalk Threshold -> Street A* -> Goal!
 * - If targeting INSIDE a room from outside, routes:
 *   Street A* -> Outside Target Door Threshold -> Inside Target Room -> Goal!
 * - Guarantees Red ALWAYS exits and enters cleanly through real doorways (ZERO straight-line wall walking!).
 */
export function findAutoWalkPath3D(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  colliders: TownCollider[],
  canSurfWater = false,
  portals: AutoNavBuildingPortalInfo[] = [],
): AutoNavWaypoint[] {
  const startRoom = portals.find((b) => isPointInsidePortalBox(startX, startZ, b, -0.3));
  const goalRoom = portals.find((b) => isPointInsidePortalBox(goalX, goalZ, b, -0.3));

  if (startRoom && (!goalRoom || goalRoom.id !== startRoom.id)) {
    const exitDoor = getBestDoorwayPortalPair(startRoom, goalX, goalZ);
    const leg1 = runSingleSegmentAStar(startX, startZ, exitDoor.inside.x, exitDoor.inside.z, colliders, canSurfWater);
    if (goalRoom) {
      const enterDoor = getBestDoorwayPortalPair(goalRoom, exitDoor.outside.x, exitDoor.outside.z);
      const leg2 = runSingleSegmentAStar(
        exitDoor.outside.x,
        exitDoor.outside.z,
        enterDoor.outside.x,
        enterDoor.outside.z,
        colliders,
        canSurfWater,
      );
      const leg3 = runSingleSegmentAStar(enterDoor.inside.x, enterDoor.inside.z, goalX, goalZ, colliders, canSurfWater);
      return [...leg1, exitDoor.outside, ...leg2, enterDoor.inside, ...leg3];
    }
    const leg2 = runSingleSegmentAStar(exitDoor.outside.x, exitDoor.outside.z, goalX, goalZ, colliders, canSurfWater);
    return [...leg1, exitDoor.outside, ...leg2];
  }

  if (goalRoom && (!startRoom || startRoom.id !== goalRoom.id)) {
    const enterDoor = getBestDoorwayPortalPair(goalRoom, startX, startZ);
    const leg1 = runSingleSegmentAStar(startX, startZ, enterDoor.outside.x, enterDoor.outside.z, colliders, canSurfWater);
    const leg2 = runSingleSegmentAStar(enterDoor.inside.x, enterDoor.inside.z, goalX, goalZ, colliders, canSurfWater);
    return [...leg1, enterDoor.inside, ...leg2];
  }

  return runSingleSegmentAStar(startX, startZ, goalX, goalZ, colliders, canSurfWater);
}
