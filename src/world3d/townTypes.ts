import * as THREE from 'three';
import type { WalkableStairAndFloorZone3D } from '../data/survivorsTactics';

export interface ProximityAutoDoor3D {
  worldX: number;
  worldY: number;
  worldZ: number;
  triggerRadius: number;
  openT: number;
  applyOpenT: (t: number) => void;
}

export type TownInteractKind =
  | 'pokemon_center'
  | 'poke_mart'
  | 'transit_station'
  | 'npc_chat'
  | 'hotel_rest'
  | 'restaurant';

export interface TownInteractPoint {
  id: string;
  townName: string;
  kind: TownInteractKind;
  label: string;
  hint: string;
  dialogText?: string;
  x: number;
  z: number;
  radius: number;
}

export interface TownCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Optional Oriented Bounding Box (OBB) for rotated buildings & solid doorway walls */
  cx?: number;
  cz?: number;
  halfW?: number;
  halfD?: number;
  rotY?: number;
  /** Wall height above ground for 3D camera spring-arm wall occlusion */
  height?: number;
  /** Optional world-Y vertical span so 1F vs 2F furniture & partition walls collide ONLY on their own floor */
  minY?: number;
  maxY?: number;
  /** Optional interior ID */
  interiorId?: string;
}

export interface EnterableBuildingInterior {
  id: string;
  name: string;
  kind: 'pokemon_center' | 'poke_mart' | 'hotel' | 'restaurant' | 'house';
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
  baseY: number;
  stories: 1 | 2;
  floor1CeilingY: number;
  floor2CeilingY: number;
  dualDoors?: boolean;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  exteriorGroup: THREE.Group;
  interiorGroup: THREE.Group;
  npcSprites: THREE.Mesh[];
  cutawayAlpha: number;
}

export interface TownMovingVehicle {
  group: THREE.Group;
  axis: 'x' | 'z';
  laneOffset: number;
  dir: 1 | -1;
  minCoord: number;
  maxCoord: number;
  coord: number;
  speed: number;
  baseY: number;
}

export interface TownStrollingCitizen {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  walkFrames: Record<string, THREE.CanvasTexture>;
  mode: 'plaza_orbit' | 'sidewalk_patrol';
  cx: number;
  cz: number;
  x1?: number;
  z1?: number;
  x2?: number;
  z2?: number;
  radius: number;
  angle: number;
  speed: number;
  phase: number;
  baseY: number;
}

export interface ViaductOverheadSpan {
  group: THREE.Group;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  halfWidth: number;
  alpha: number;
}

export interface ProceduralTownInstance {
  id: string;
  name: string;
  centerX: number;
  centerZ: number;
  safeRadius: number;
  group: THREE.Group;
  interactPoints: TownInteractPoint[];
  colliders: TownCollider[];
  interiors: EnterableBuildingInterior[];
  autoDoors: ProximityAutoDoor3D[];
  upperFloorZones: WalkableStairAndFloorZone3D[];
  streetLampPositions?: { x: number; y: number; z: number }[];
  viaductSpans?: ViaductOverheadSpan[];
  trainGroup?: THREE.Group;
  trainBaseX?: number;
  animatedParts?: {
    spinners: THREE.Object3D[];
    fountains: THREE.Object3D[];
    billboards: THREE.Mesh[];
    vehicles: TownMovingVehicle[];
    walkers: TownStrollingCitizen[];
  };
}

/** Check if world point (px, pz) is inside a rotated EnterableBuildingInterior */
export function isInsideBuildingInterior(px: number, pz: number, bInt: EnterableBuildingInterior): boolean {
  const dx = px - bInt.cx;
  const dz = pz - bInt.cz;
  const cos = Math.cos(bInt.rotY);
  const sin = Math.sin(bInt.rotY);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= bInt.halfW && Math.abs(lz) <= bInt.halfD;
}

/** Helper to push an oriented box collider (for solid buildings, walls, or voxel furniture) */
export function makeObbCollider(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rotY: number,
  height = 9.5,
  interiorId?: string,
  minY?: number,
  maxY?: number,
): TownCollider {
  const r = Math.hypot(halfW, halfD);
  return {
    minX: cx - r,
    maxX: cx + r,
    minZ: cz - r,
    maxZ: cz + r,
    cx,
    cz,
    halfW,
    halfD,
    rotY,
    height,
    interiorId,
    minY,
    maxY,
  };
}

/** Shared OBB + AABB wall & floor-scoped furniture collision push-out used for Player, Followers, AND Wild Pokémon! */
export function resolveTownWallCollisions(
  pos: { x: number; z: number },
  pad: number,
  colliders: TownCollider[],
  currentPy?: number,
): void {
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    // Fast AABB pre-rejection BEFORE any Math.cos/Math.sin OBB trig (skips >99% of city colliders in 2 float checks!)
    if (
      pos.x <= box.minX - pad ||
      pos.x >= box.maxX + pad ||
      pos.z <= box.minZ - pad ||
      pos.z >= box.maxZ + pad
    ) {
      continue;
    }
    if (currentPy !== undefined && box.minY !== undefined && box.maxY !== undefined) {
      if (currentPy + 1.55 < box.minY || currentPy + 0.25 > box.maxY) continue;
    }
    if (
      box.cx !== undefined &&
      box.cz !== undefined &&
      box.halfW !== undefined &&
      box.halfD !== undefined &&
      box.rotY !== undefined
    ) {
      const dx = pos.x - box.cx;
      const dz = pos.z - box.cz;
      const cos = Math.cos(box.rotY);
      const sin = Math.sin(box.rotY);
      let lx = dx * cos - dz * sin;
      let lz = dx * sin + dz * cos;
      const ew = box.halfW + pad;
      const ed = box.halfD + pad;
      if (Math.abs(lx) < ew && Math.abs(lz) < ed) {
        const penX = ew - Math.abs(lx);
        const penZ = ed - Math.abs(lz);
        if (penX < penZ) {
          lx = lx >= 0 ? ew : -ew;
        } else {
          lz = lz >= 0 ? ed : -ed;
        }
        pos.x = box.cx + lx * cos + lz * sin;
        pos.z = box.cz - lx * sin + lz * cos;
      }
      continue;
    }

    if (
      pos.x > box.minX - pad &&
      pos.x < box.maxX + pad &&
      pos.z > box.minZ - pad &&
      pos.z < box.maxZ + pad
    ) {
      const dxL = Math.abs(pos.x - (box.minX - pad));
      const dxR = Math.abs(box.maxX + pad - pos.x);
      const dzT = Math.abs(pos.z - (box.minZ - pad));
      const dzB = Math.abs(box.maxZ + pad - pos.z);
      const m = Math.min(dxL, dxR, dzT, dzB);
      if (m === dxL) pos.x = box.minX - pad;
      else if (m === dxR) pos.x = box.maxX + pad;
      else if (m === dzT) pos.z = box.minZ - pad;
      else pos.z = box.maxZ + pad;
    }
  }
}

/**
 * 3D Spring-Arm Camera Wall-Occlusion Solver:
 * Ray-marches from player's pivot (ox, oy, oz) toward desired camera (cx, cy, cz) against ALL structural walls
 * while ignoring low furniture (< 2.85m).
 */
export function computeCameraWallClipT(
  ox: number,
  oy: number,
  oz: number,
  cx: number,
  cy: number,
  cz: number,
  groundBaseY: number,
  colliders: TownCollider[],
  _activeInteriorId?: string | null,
): number {
  if (colliders.length === 0) return 1.0;
  const pad = 0.72;
  const steps = 20;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const px = ox + (cx - ox) * t;
    const py = oy + (cy - oy) * t;
    const pz = oz + (cz - oz) * t;
    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      const h = box.height ?? 9.5;
      if (h < 2.85) continue;
      const wallMinY = box.minY ?? groundBaseY - 1.0;
      const wallMaxY = box.maxY ?? groundBaseY + h;
      if (py < wallMinY || py > wallMaxY) continue;
      if (px <= box.minX - pad || px >= box.maxX + pad || pz <= box.minZ - pad || pz >= box.maxZ + pad) continue;
      let hit = false;
      if (
        box.cx !== undefined &&
        box.cz !== undefined &&
        box.halfW !== undefined &&
        box.halfD !== undefined &&
        box.rotY !== undefined
      ) {
        const dx = px - box.cx;
        const dz = pz - box.cz;
        const cos = Math.cos(box.rotY);
        const sin = Math.sin(box.rotY);
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        hit = Math.abs(lx) < box.halfW + pad && Math.abs(lz) < box.halfD + pad;
      } else {
        hit = px > box.minX - pad && px < box.maxX + pad && pz > box.minZ - pad && pz < box.maxZ + pad;
      }
      if (hit) {
        return Math.max(0.24, (s - 1.15) / steps);
      }
    }
  }
  return 1.0;
}
