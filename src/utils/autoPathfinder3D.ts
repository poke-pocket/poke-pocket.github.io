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

/** O(1) spatial hash over local ground-level TownColliders so each raycast sample checks 0-4 nearby boxes instead of 400+! */
class ColliderSpatialGrid2D {
  private buckets = new Map<string, TownCollider[]>();
  private readonly cellSize = 16;

  constructor(colliders: TownCollider[], minBx: number, maxBx: number, minBz: number, maxBz: number) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.minY !== undefined && c.minY >= 2.5) continue;
      if (c.maxX < minBx || c.minX > maxBx || c.maxZ < minBz || c.minZ > maxBz) continue;
      const gx0 = Math.floor((c.minX - 1.5) / this.cellSize);
      const gx1 = Math.floor((c.maxX + 1.5) / this.cellSize);
      const gz0 = Math.floor((c.minZ - 1.5) / this.cellSize);
      const gz1 = Math.floor((c.maxZ + 1.5) / this.cellSize);
      for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const k = `${gx},${gz}`;
          let arr = this.buckets.get(k);
          if (!arr) {
            arr = [];
            this.buckets.set(k, arr);
          }
          arr.push(c);
        }
      }
    }
  }

  getAt(wx: number, wz: number): TownCollider[] | undefined {
    const gx = Math.floor(wx / this.cellSize);
    const gz = Math.floor(wz / this.cellSize);
    return this.buckets.get(`${gx},${gz}`);
  }
}

/**
 * Ultra-fast (`< 0.15ms`) Instant Kickoff Waypoints:
 * Lets the protagonist start walking in the general direction ON FRAME 1 right after closing the map,
 * while the detailed multi-block A* path computes incrementally in the background!
 */
export function computeInstantKickoffWaypoints3D(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  colliders: TownCollider[],
  canSurfWater = false,
  portals: AutoNavBuildingPortalInfo[] = [],
): AutoNavWaypoint[] {
  const totalDist = Math.hypot(goalX - startX, goalZ - startZ);
  if (totalDist < 1.5) return [{ x: goalX, z: goalZ }];

  const startRoom = portals.find((b) => isPointInsidePortalBox(startX, startZ, b, -0.3));
  const goalRoom = portals.find((b) => isPointInsidePortalBox(goalX, goalZ, b, -0.3));
  if (startRoom && (!goalRoom || goalRoom.id !== startRoom.id)) {
    const exitDoor = getBestDoorwayPortalPair(startRoom, goalX, goalZ);
    return [exitDoor.inside, exitDoor.outside, { x: goalX, z: goalZ }];
  }

  const nearCols = colliders.filter(
    (c) =>
      (c.minY === undefined || c.minY < 2.5) &&
      c.maxX >= startX - 28 &&
      c.minX <= startX + 28 &&
      c.maxZ >= startZ - 28 &&
      c.minZ <= startZ + 28,
  );
  const probe = { x: 0, z: 0 };
  const isClear = (wx: number, wz: number): boolean => {
    const surfY = getWalkableSurfaceHeight3D(wx, wz);
    if (!canSurfWater && surfY < WATER_LEVEL_3D - 0.12) return false;
    if (nearCols.length === 0) return true;
    probe.x = wx;
    probe.z = wz;
    resolveTownWallCollisions(probe, 1.05, nearCols);
    return Math.abs(probe.x - wx) < 0.05 && Math.abs(probe.z - wz) < 0.05;
  };

  const baseAng = Math.atan2(goalZ - startZ, goalX - startX);
  const lookDist = Math.min(totalDist, 18.0);
  const angleOffsets = [0, 0.32, -0.32, 0.64, -0.64, 0.96, -0.96, 1.28, -1.28, 1.58, -1.58];

  for (let i = 0; i < angleOffsets.length; i++) {
    const ang = baseAng + angleOffsets[i];
    const ux = Math.cos(ang);
    const uz = Math.sin(ang);
    let ok = true;
    for (const d of [3.2, 6.8, 11.0, Math.min(lookDist, 16.0)]) {
      if (d > totalDist) break;
      if (!isClear(startX + ux * d, startZ + uz * d)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      if (Math.abs(angleOffsets[i]) < 0.01 || totalDist <= lookDist + 1.0) {
        return [{ x: goalX, z: goalZ }];
      }
      return [
        { x: startX + ux * lookDist, z: startZ + uz * lookDist },
        { x: goalX, z: goalZ },
      ];
    }
  }

  return [{ x: goalX, z: goalZ }];
}

const HORIZON_TRIGGER_DIST = 680;
const HORIZON_PLAN_DIST = 500;

/** Finds a dry, collision-free intermediate horizon target `~500m` toward a multi-kilometer destination */
function pickWalkableHorizonTarget(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  colliders: TownCollider[],
  canSurfWater: boolean,
): AutoNavWaypoint {
  const baseAng = Math.atan2(goalZ - startZ, goalX - startX);
  const probe = { x: 0, z: 0 };
  const angleTries = [0, 0.14, -0.14, 0.28, -0.28, 0.45, -0.45, 0.68, -0.68];
  const distTries = [HORIZON_PLAN_DIST, HORIZON_PLAN_DIST * 0.82, HORIZON_PLAN_DIST * 1.12];

  for (const dist of distTries) {
    for (const da of angleTries) {
      const tx = startX + Math.cos(baseAng + da) * dist;
      const tz = startZ + Math.sin(baseAng + da) * dist;
      const surfY = getWalkableSurfaceHeight3D(tx, tz);
      if (!canSurfWater && surfY < WATER_LEVEL_3D - 0.08) continue;
      probe.x = tx;
      probe.z = tz;
      resolveTownWallCollisions(probe, 1.2, colliders);
      if (Math.abs(probe.x - tx) < 0.06 && Math.abs(probe.z - tz) < 0.06) {
        return { x: tx, z: tz };
      }
    }
  }
  return {
    x: startX + Math.cos(baseAng) * HORIZON_PLAN_DIST,
    z: startZ + Math.sin(baseAng) * HORIZON_PLAN_DIST,
  };
}

class SingleLegIncrementalAStar {
  private readonly startX: number;
  private readonly startZ: number;
  private readonly goalX: number;
  private readonly goalZ: number;
  private readonly cell: number;
  private readonly pad = 1.12;
  private readonly canSurfWater: boolean;
  private readonly colGrid: ColliderSpatialGrid2D;
  private readonly probe = { x: 0, z: 0 };
  private readonly nodeCache = new Map<string, { ok: boolean; surfY: number; nearCols: boolean }>();

  private readonly sx0: number;
  private readonly sz0: number;
  private readonly gx0: number;
  private readonly gz0: number;
  private readonly startK: string;
  private readonly goalK: string;

  private readonly gScore = new Map<string, number>();
  private readonly cameFrom = new Map<string, string>();
  private readonly coords = new Map<string, [number, number]>();
  private readonly closed = new Set<string>();
  private readonly heap: { k: string; ix: number; iz: number; f: number }[] = [];

  private bestFallbackK: string;
  private bestFallbackH: number;
  private expanded = 0;
  private readonly maxExpand: number;
  private finished = false;
  private result: AutoNavWaypoint[] | null = null;

  private static readonly DIRS: [number, number, number][] = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.4142],
    [1, -1, 1.4142],
    [-1, 1, 1.4142],
    [-1, -1, 1.4142],
  ];

  constructor(
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number,
    colliders: TownCollider[],
    canSurfWater: boolean,
  ) {
    this.startX = startX;
    this.startZ = startZ;
    this.goalX = goalX;
    this.goalZ = goalZ;
    this.canSurfWater = canSurfWater;

    const totalDist = Math.hypot(goalX - startX, goalZ - startZ);
    this.cell = totalDist > 300 ? 2.8 : totalDist > 130 ? 2.0 : 1.5;
    this.maxExpand = totalDist > 300 ? 16000 : 12000;

    const minBx = Math.min(startX, goalX) - 130;
    const maxBx = Math.max(startX, goalX) + 130;
    const minBz = Math.min(startZ, goalZ) - 130;
    const maxBz = Math.max(startZ, goalZ) + 130;
    this.colGrid = new ColliderSpatialGrid2D(colliders, minBx, maxBx, minBz, maxBz);

    this.sx0 = Math.round(startX / this.cell);
    this.sz0 = Math.round(startZ / this.cell);
    this.gx0 = Math.round(goalX / this.cell);
    this.gz0 = Math.round(goalZ / this.cell);
    this.startK = `${this.sx0},${this.sz0}`;
    this.goalK = `${this.gx0},${this.gz0}`;
    this.bestFallbackK = this.startK;
    this.bestFallbackH = Math.hypot(this.gx0 - this.sx0, this.gz0 - this.sz0);

    if (totalDist < 1.4) {
      this.finished = true;
      this.result = [{ x: goalX, z: goalZ }];
      return;
    }

    this.gScore.set(this.startK, 0);
    this.coords.set(this.startK, [this.sx0, this.sz0]);
    this.pushHeap({ k: this.startK, ix: this.sx0, iz: this.sz0, f: this.bestFallbackH });
  }

  private pushHeap(item: { k: string; ix: number; iz: number; f: number }): void {
    this.heap.push(item);
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].f <= this.heap[i].f) break;
      const tmp = this.heap[p];
      this.heap[p] = this.heap[i];
      this.heap[i] = tmp;
      i = p;
    }
  }

  private popHeap() {
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      const n = this.heap.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && this.heap[l].f < this.heap[best].f) best = l;
        if (r < n && this.heap[r].f < this.heap[best].f) best = r;
        if (best === i) break;
        const tmp = this.heap[i];
        this.heap[i] = this.heap[best];
        this.heap[best] = tmp;
        i = best;
      }
    }
    return top;
  }

  private isPointPassable(wx: number, wz: number): boolean {
    if (Math.hypot(wx - this.startX, wz - this.startZ) < 0.85 || Math.hypot(wx - this.goalX, wz - this.goalZ) < 0.95) {
      return true;
    }
    const surfY = getWalkableSurfaceHeight3D(wx, wz);
    if (!this.canSurfWater && surfY < WATER_LEVEL_3D - 0.12) return false;
    const bucket = this.colGrid.getAt(wx, wz);
    if (!bucket || bucket.length === 0) return true;
    this.probe.x = wx;
    this.probe.z = wz;
    resolveTownWallCollisions(this.probe, this.pad, bucket);
    return Math.abs(this.probe.x - wx) < 0.04 && Math.abs(this.probe.z - wz) < 0.04;
  }

  private evalGridNode(ix: number, iz: number, key: string) {
    let cached = this.nodeCache.get(key);
    if (cached) return cached;
    const wx = ix * this.cell;
    const wz = iz * this.cell;
    const bucket = this.colGrid.getAt(wx, wz);
    const nearCols = Boolean(bucket && bucket.length > 0);
    if (Math.hypot(wx - this.startX, wz - this.startZ) < 0.85 || Math.hypot(wx - this.goalX, wz - this.goalZ) < 0.95) {
      cached = { ok: true, surfY: 1.0, nearCols };
      this.nodeCache.set(key, cached);
      return cached;
    }
    const surfY = getWalkableSurfaceHeight3D(wx, wz);
    if (!this.canSurfWater && surfY < WATER_LEVEL_3D - 0.12) {
      cached = { ok: false, surfY, nearCols };
      this.nodeCache.set(key, cached);
      return cached;
    }
    let ok = true;
    if (nearCols && bucket) {
      this.probe.x = wx;
      this.probe.z = wz;
      resolveTownWallCollisions(this.probe, this.pad, bucket);
      ok = Math.abs(this.probe.x - wx) < 0.04 && Math.abs(this.probe.z - wz) < 0.04;
    }
    cached = { ok, surfY, nearCols };
    this.nodeCache.set(key, cached);
    return cached;
  }

  private isSegmentPassable(ax: number, az: number, bx: number, bz: number, fastOpenHint = false): boolean {
    const segLen = Math.hypot(bx - ax, bz - az);
    if (fastOpenHint && segLen <= 4.5) {
      return this.isPointPassable((ax + bx) * 0.5, (az + bz) * 0.5);
    }
    const step = fastOpenHint ? 0.95 : 0.45;
    const n = Math.max(2, Math.ceil(segLen / step));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      if (!this.isPointPassable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /** Advances A* up to `deadlineMs` (`performance.now()`); returns waypoints once done or `null` if still in progress */
  stepUntil(deadlineMs: number): AutoNavWaypoint[] | null {
    if (this.finished) return this.result;

    while (this.heap.length > 0 && this.expanded < this.maxExpand) {
      const cur = this.popHeap();
      if (this.closed.has(cur.k)) continue;
      this.closed.add(cur.k);
      this.expanded += 1;

      const hDist = Math.hypot(this.gx0 - cur.ix, this.gz0 - cur.iz);
      if (hDist < this.bestFallbackH) {
        this.bestFallbackH = hDist;
        this.bestFallbackK = cur.k;
      }
      if (cur.k === this.goalK || hDist <= 1.15) {
        this.bestFallbackK = cur.k;
        return this.finalize();
      }

      const curNode = this.evalGridNode(cur.ix, cur.iz, cur.k);
      const curWx = cur.ix * this.cell;
      const curWz = cur.iz * this.cell;
      const curG = this.gScore.get(cur.k) ?? 0;

      for (let di = 0; di < SingleLegIncrementalAStar.DIRS.length; di++) {
        const [dx, dz, stepCost] = SingleLegIncrementalAStar.DIRS[di];
        const nix = cur.ix + dx;
        const niz = cur.iz + dz;
        const nk = `${nix},${niz}`;
        if (this.closed.has(nk)) continue;

        const nextNode = this.evalGridNode(nix, niz, nk);
        if (!nextNode.ok) continue;

        const openDry =
          !curNode.nearCols &&
          !nextNode.nearCols &&
          curNode.surfY > WATER_LEVEL_3D + 0.55 &&
          nextNode.surfY > WATER_LEVEL_3D + 0.55;
        const nwx = nix * this.cell;
        const nwz = niz * this.cell;
        if (!this.isSegmentPassable(curWx, curWz, nwx, nwz, openDry)) continue;

        const tentativeG = curG + stepCost;
        if (tentativeG < (this.gScore.get(nk) ?? Infinity)) {
          this.gScore.set(nk, tentativeG);
          this.cameFrom.set(nk, cur.k);
          this.coords.set(nk, [nix, niz]);
          this.pushHeap({ k: nk, ix: nix, iz: niz, f: tentativeG + Math.hypot(this.gx0 - nix, this.gz0 - niz) * 1.14 });
        }
      }

      if ((this.expanded & 31) === 0 && performance.now() >= deadlineMs) {
        return null;
      }
    }

    return this.finalize();
  }

  private finalize(): AutoNavWaypoint[] {
    this.finished = true;
    const rawPts: AutoNavWaypoint[] = [];
    let traceK: string | undefined = this.bestFallbackK;
    while (traceK && traceK !== this.startK) {
      const c = this.coords.get(traceK);
      if (c) rawPts.push({ x: c[0] * this.cell, z: c[1] * this.cell });
      traceK = this.cameFrom.get(traceK);
    }
    rawPts.reverse();
    if (
      this.bestFallbackH <= 2.2 &&
      (rawPts.length === 0 ||
        this.isSegmentPassable(rawPts[rawPts.length - 1].x, rawPts[rawPts.length - 1].z, this.goalX, this.goalZ))
    ) {
      rawPts.push({ x: this.goalX, z: this.goalZ });
    }
    if (rawPts.length === 0) {
      this.result = [{ x: this.goalX, z: this.goalZ }];
      return this.result;
    }

    const full: AutoNavWaypoint[] = [{ x: this.startX, z: this.startZ }, ...rawPts];
    const smooth: AutoNavWaypoint[] = [];
    let anchorIdx = 0;
    while (anchorIdx < full.length - 1) {
      let furthest = anchorIdx + 1;
      for (let probeIdx = Math.min(full.length - 1, anchorIdx + 22); probeIdx > anchorIdx + 1; probeIdx--) {
        if (this.isSegmentPassable(full[anchorIdx].x, full[anchorIdx].z, full[probeIdx].x, full[probeIdx].z)) {
          furthest = probeIdx;
          break;
        }
      }
      smooth.push(full[furthest]);
      anchorIdx = furthest;
    }
    this.result = smooth;
    return smooth;
  }
}

export interface AutoWalkPathJobResult {
  waypoints: AutoNavWaypoint[];
  hasRemainingHorizon: boolean;
}

export interface IncrementalAutoPathJob3D {
  step: (budgetMs?: number) => AutoWalkPathJobResult | null;
}

/**
 * Creates a non-blocking, frame-budgeted (`~2.2ms/frame`) A* pathfinding job:
 * - Threads cleanly through building doorway portals (`startRoom` -> street -> `goalRoom`).
 * - For multi-kilometer overland targets (`> 680m`), plans an obstacle- & bridge-safe `500m` rolling horizon
 *   that refreshes seamlessly in the background while the player walks!
 */
export function createAutoWalkPathJob3D(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  colliders: TownCollider[],
  canSurfWater = false,
  portals: AutoNavBuildingPortalInfo[] = [],
): IncrementalAutoPathJob3D {
  const startRoom = portals.find((b) => isPointInsidePortalBox(startX, startZ, b, -0.3));
  const goalRoom = portals.find((b) => isPointInsidePortalBox(goalX, goalZ, b, -0.3));

  type TaskSpec =
    | { kind: 'fixed'; wp: AutoNavWaypoint }
    | { kind: 'astar'; ax: number; az: number; bx: number; bz: number };

  const tasks: TaskSpec[] = [];
  let hasRemainingHorizon = false;

  const pushStreetLeg = (ax: number, az: number, bx: number, bz: number, allowHorizon: boolean) => {
    const d = Math.hypot(bx - ax, bz - az);
    if (allowHorizon && d > HORIZON_TRIGGER_DIST) {
      const hz = pickWalkableHorizonTarget(ax, az, bx, bz, colliders, canSurfWater);
      tasks.push({ kind: 'astar', ax, az, bx: hz.x, bz: hz.z });
      tasks.push({ kind: 'fixed', wp: { x: bx, z: bz } });
      hasRemainingHorizon = true;
    } else {
      tasks.push({ kind: 'astar', ax, az, bx, bz });
    }
  };

  if (startRoom && (!goalRoom || goalRoom.id !== startRoom.id)) {
    const exitDoor = getBestDoorwayPortalPair(startRoom, goalX, goalZ);
    tasks.push({ kind: 'astar', ax: startX, az: startZ, bx: exitDoor.inside.x, bz: exitDoor.inside.z });
    tasks.push({ kind: 'fixed', wp: exitDoor.outside });
    if (goalRoom) {
      const enterDoor = getBestDoorwayPortalPair(goalRoom, exitDoor.outside.x, exitDoor.outside.z);
      pushStreetLeg(exitDoor.outside.x, exitDoor.outside.z, enterDoor.outside.x, enterDoor.outside.z, true);
      if (!hasRemainingHorizon) {
        tasks.push({ kind: 'fixed', wp: enterDoor.inside });
        tasks.push({ kind: 'astar', ax: enterDoor.inside.x, az: enterDoor.inside.z, bx: goalX, bz: goalZ });
      }
    } else {
      pushStreetLeg(exitDoor.outside.x, exitDoor.outside.z, goalX, goalZ, true);
    }
  } else if (goalRoom && (!startRoom || startRoom.id !== goalRoom.id)) {
    const enterDoor = getBestDoorwayPortalPair(goalRoom, startX, startZ);
    pushStreetLeg(startX, startZ, enterDoor.outside.x, enterDoor.outside.z, true);
    if (!hasRemainingHorizon) {
      tasks.push({ kind: 'fixed', wp: enterDoor.inside });
      tasks.push({ kind: 'astar', ax: enterDoor.inside.x, az: enterDoor.inside.z, bx: goalX, bz: goalZ });
    }
  } else {
    pushStreetLeg(startX, startZ, goalX, goalZ, true);
  }

  let taskIdx = 0;
  let activeLeg: SingleLegIncrementalAStar | null = null;
  const collected: AutoNavWaypoint[] = [];

  return {
    step(budgetMs = 2.2): AutoWalkPathJobResult | null {
      const deadline = performance.now() + Math.max(0.5, budgetMs);
      while (taskIdx < tasks.length) {
        const t = tasks[taskIdx];
        if (t.kind === 'fixed') {
          collected.push(t.wp);
          taskIdx += 1;
          continue;
        }
        if (!activeLeg) {
          activeLeg = new SingleLegIncrementalAStar(t.ax, t.az, t.bx, t.bz, colliders, canSurfWater);
        }
        const legPts = activeLeg.stepUntil(deadline);
        if (!legPts) {
          return null;
        }
        collected.push(...legPts);
        activeLeg = null;
        taskIdx += 1;
        if (performance.now() >= deadline && taskIdx < tasks.length) {
          return null;
        }
      }
      return {
        waypoints: collected.length > 0 ? collected : [{ x: goalX, z: goalZ }],
        hasRemainingHorizon,
      };
    },
  };
}

/**
 * Smoothly splices a newly finished async A* route onto a player who has ALREADY walked forward
 * during the few frames A* was computing — preventing any momentary turn-back!
 */
export function findForwardSpliceIndex3D(
  px: number,
  pz: number,
  waypoints: AutoNavWaypoint[],
): number {
  if (waypoints.length <= 1) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  const maxScan = Math.min(waypoints.length - 1, 10);
  for (let i = 0; i <= maxScan; i++) {
    const d = Math.hypot(waypoints[i].x - px, waypoints[i].z - pz);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (bestIdx < waypoints.length - 1) {
    const cur = waypoints[bestIdx];
    const nxt = waypoints[bestIdx + 1];
    const segDx = nxt.x - cur.x;
    const segDz = nxt.z - cur.z;
    const toCurDx = cur.x - px;
    const toCurDz = cur.z - pz;
    // If `cur` is behind us relative to `cur -> nxt` or right under our feet, aim straight at `nxt`!
    if (Math.hypot(toCurDx, toCurDz) < 1.8 || toCurDx * segDx + toCurDz * segDz < 0) {
      return bestIdx + 1;
    }
  }
  return bestIdx;
}

/** Synchronous compatibility wrapper (runs job to completion when needed) */
export function findAutoWalkPath3D(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  colliders: TownCollider[],
  canSurfWater = false,
  portals: AutoNavBuildingPortalInfo[] = [],
): AutoNavWaypoint[] {
  const job = createAutoWalkPathJob3D(startX, startZ, goalX, goalZ, colliders, canSurfWater, portals);
  let res: AutoWalkPathJobResult | null = null;
  while (!res) {
    res = job.step(50);
  }
  return res.waypoints;
}
