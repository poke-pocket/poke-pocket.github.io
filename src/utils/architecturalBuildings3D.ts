import * as THREE from 'three';
import type { WalkableStairAndFloorZone3D } from '../data/survivorsTactics';
import { getNpcWalkSpriteFrames } from '../data/worldTextures3D';
import {
  furnishWalkInInterior3D,
  type WalkInBuildingKind,
} from '../world3d/interiors/interiorFurnishings3D';
import { registerNightReactiveHook } from '../world3d/townAssetLoader';
import type { ProximityAutoDoor3D, TownCollider, TownInteractPoint } from '../world3d/townTypes';
import { VoxelGrid3D, getSharedIndoorLitVoxelMaterial, getSharedVoxelArchMaterial } from '../world3d/voxelMesher3D';
import { addVoxelBox, createVoxelPokeball3D } from '../world3d/voxelProps3D';

export type { WalkInBuildingKind, ProximityAutoDoor3D };
export type ArchBuildingCollider = TownCollider;

export function updateProximityAutoDoors3D(
  doors: ProximityAutoDoor3D[],
  actors: { x: number; y: number; z: number }[],
  dt: number,
): void {
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    const mode = d.mode ?? 'auto';
    let shouldOpen = false;

    if (mode === 'auto') {
      const closeRadius = d.triggerRadius + 0.75;
      const thresh = d.openT > 0.2 ? closeRadius : d.triggerRadius;
      for (let a = 0; a < actors.length; a++) {
        const act = actors[a];
        if (Math.abs(act.y - d.worldY) > 2.65) continue;
        if (Math.hypot(act.x - d.worldX, act.z - d.worldZ) <= thresh) {
          shouldOpen = true;
          break;
        }
      }
    } else {
      // Manual & Hotel Keycard doors NEVER auto-open on approach!
      // Once explicitly opened by the player, gently close back after all actors walk far away (> 10.5m).
      if (d.isOpen) {
        let anyoneNearby = false;
        for (let a = 0; a < actors.length; a++) {
          const act = actors[a];
          if (Math.abs(act.y - d.worldY) <= 3.2 && Math.hypot(act.x - d.worldX, act.z - d.worldZ) <= 10.5) {
            anyoneNearby = true;
            break;
          }
        }
        if (!anyoneNearby) {
          d.isOpen = false;
        }
      }
      shouldOpen = Boolean(d.isOpen);
    }

    const target = shouldOpen ? 1.0 : 0.0;
    if (Math.abs(d.openT - target) > 0.004) {
      const speed = shouldOpen ? 7.8 : 4.6;
      d.openT += (target - d.openT) * Math.min(1, dt * speed);
      if (Math.abs(d.openT - target) <= 0.006) d.openT = target;
      const eased = 1 - Math.pow(1 - d.openT, 2.2);
      d.applyOpenT(eased, d.swingDir ?? 1);
    }
    if (d.collider) {
      d.collider.disabled = d.openT > 0.42;
    }
  }
}

/** Sets `door.swingDir` based on which side of the door plane `(actorX, actorZ)` stands on so the leaf ALWAYS swings AWAY! */
export function orientDoorSwingAwayFromActor(
  door: ProximityAutoDoor3D,
  actorX: number,
  actorZ: number,
): void {
  if (door.openT > 0.08) return;
  if (door.normalX === undefined || door.normalZ === undefined) {
    door.swingDir = 1;
    return;
  }
  const dot = (actorX - door.worldX) * door.normalX + (actorZ - door.worldZ) * door.normalZ;
  door.swingDir = dot >= 0 ? 1 : -1;
}

export interface BuiltUnifiedBuildingResult {
  shellGroup: THREE.Group;
  npcs: THREE.Mesh[];
  colliders: ArchBuildingCollider[];
  autoDoors: ProximityAutoDoor3D[];
  interactPoints: TownInteractPoint[];
  stairZone?: WalkableStairAndFloorZone3D;
  stories: 1 | 2;
  floor1CeilingY: number;
  floor2CeilingY: number;
  dualDoors: boolean;
}

const ARCH_VOX_CACHE = new Map<string, THREE.BufferGeometry>();
function getCachedCeilingChandelierGeo(): THREE.BufferGeometry {
  const key = 'vox_ceiling_chandelier_v1';
  let geo = ARCH_VOX_CACHE.get(key);
  if (!geo) {
    const g = new VoxelGrid3D(14, 6, 14);
    g.fillBox(5, 4, 5, 8, 5, 8, 0xcbd5e1);
    g.fillBox(2, 2, 2, 11, 3, 11, 0xffe066, 0xffe066);
    g.fillBox(4, 0, 4, 9, 1, 9, 0xfff9db, 0xfff3bf);
    geo = g.toGreedyGeometry(0.14);
    ARCH_VOX_CACHE.set(key, geo);
  }
  return geo;
}

function getCachedDoorLanternGeo(): THREE.BufferGeometry {
  const key = 'vox_door_sconce_lantern_v1';
  let geo = ARCH_VOX_CACHE.get(key);
  if (!geo) {
    const g = new VoxelGrid3D(6, 10, 6);
    g.fillBox(1, 8, 0, 4, 9, 4, 0x2b3040);
    g.fillBox(0, 7, 0, 5, 7, 5, 0x3b4254);
    g.fillBox(1, 2, 1, 4, 6, 4, 0xffe066, 0xffe066);
    g.fillBox(1, 0, 1, 4, 1, 4, 0x2b3040);
    geo = g.toGreedyGeometry(0.11);
    ARCH_VOX_CACHE.set(key, geo);
  }
  return geo;
}

let SHARED_SPILL_MAT: THREE.MeshBasicMaterial | null = null;
function getSharedStorefrontSpillMat(): THREE.MeshBasicMaterial {
  if (SHARED_SPILL_MAT) return SHARED_SPILL_MAT;
  const spillCanvas = document.createElement('canvas');
  spillCanvas.width = 64;
  spillCanvas.height = 64;
  const sCtx = spillCanvas.getContext('2d');
  if (sCtx) {
    const grad = sCtx.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 236, 172, 0.92)');
    grad.addColorStop(0.52, 'rgba(255, 214, 128, 0.42)');
    grad.addColorStop(1, 'rgba(255, 196, 96, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);
  }
  const spillTex = new THREE.CanvasTexture(spillCanvas);
  SHARED_SPILL_MAT = new THREE.MeshBasicMaterial({
    map: spillTex,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  registerNightReactiveHook((glow) => {
    if (SHARED_SPILL_MAT) {
      SHARED_SPILL_MAT.opacity = 0.20 + glow * 0.68;
    }
  });
  return SHARED_SPILL_MAT;
}

function makeLocalObb(
  lotX: number,
  lotZ: number,
  lotRotY: number,
  lx: number,
  lz: number,
  hw: number,
  hd: number,
  localRotY: number,
  height: number,
  interiorId: string,
  minY?: number,
  maxY?: number,
): ArchBuildingCollider {
  const cos = Math.cos(lotRotY);
  const sin = Math.sin(lotRotY);
  const wx = lotX + lx * cos + lz * sin;
  const wz = lotZ - lx * sin + lz * cos;
  const r = Math.hypot(hw, hd);
  return {
    minX: wx - r,
    maxX: wx + r,
    minZ: wz - r,
    maxZ: wz + r,
    cx: wx,
    cz: wz,
    halfW: hw,
    halfD: hd,
    rotY: lotRotY + localRotY,
    height,
    minY,
    maxY,
    interiorId,
  };
}

function spawnGbaNpc(key: string, x: number, y: number, z: number, height = 2.48): THREE.Mesh {
  const frames = getNpcWalkSpriteFrames(key);
  const geo = new THREE.PlaneGeometry(height * 0.86, height);
  geo.translate(0, height * 0.5, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: frames.down_idle0,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // CRITICAL: YXZ rotation order keeps indoor NPCs 100% vertical to the floor from every camera angle!
  mesh.rotation.order = 'YXZ';
  mesh.position.set(x, y, z);
  mesh.userData.walkFrames = frames;
  return mesh;
}

/**
 * Builds a Unified MagicaVoxel + Modern Street-Storefront Walk-In Building:
 * - Street-facing front (`+Z`) ONLY has panoramic floor-to-ceiling storefront glass & auto-opening doors!
 * - Non-street sides (`±X`) are solid stepped voxel masonry walls with warm RSE amber/cream interior wainscoting!
 * - Rear (`-Z`) is a solid masonry wall with a default-closed proximity auto-opening rear service/back door (`后门`)!
 * - Topped with stepped MagicaVoxel roofs, voxel HVAC greebles & 3D Voxel Pokéball beacon!
 */
export function getWalkInStoreyDimensions(kind:WalkInBuildingKind){
  const stories:1|2=kind==='hotel'||kind==='house'||kind==='pokemon_center'?2:1;
  // Use one shared storey size for the playable shops and houses. The
  // number of storeys stays specific to the building's original design.
  const heightScale=1.5;
  const first=7.5;
  return {stories,heightScale,first,second:stories===2?7.5:0,entryDoor:3.85,rearDoor:3.25};
}

export function buildUnifiedWalkInBuilding3D(opts: {
  kind: WalkInBuildingKind;
  interiorId: string;
  townName: string;
  lotX: number;
  lotZ: number;
  baseWorldY: number;
  localX: number;
  localY: number;
  localZ: number;
  rotY: number;
  width: number;
  depth: number;
  floorTex: THREE.CanvasTexture;
  woodFloorTex: THREE.CanvasTexture;
  signTex?: THREE.CanvasTexture;
  onRegisterSpinner?: (obj: THREE.Object3D) => void;
}): BuiltUnifiedBuildingResult {
  const {
    kind,
    interiorId,
    townName,
    lotX,
    lotZ,
    baseWorldY,
    localX,
    localY,
    localZ,
    rotY,
    width,
    depth,
    floorTex,
    woodFloorTex,
    signTex,
    onRegisterSpinner,
  } = opts;

  const w = width * 0.94;
  const d = depth * 0.94;
  const {stories,heightScale,first:H1,second:H2,entryDoor,rearDoor}=getWalkInStoreyDimensions(kind);
  const dualDoors = false;
  // Storey heights drive both the shell and the walkable upper floor.
  const totalWallH = H1 + H2;
  const floor1Y = 0.16;
  const floor2Y = floor1Y + H1;

  const shellGroup = new THREE.Group();
  shellGroup.position.set(localX, localY, localZ);
  shellGroup.rotation.y = rotY;

  const npcs: THREE.Mesh[] = [];
  const colliders: ArchBuildingCollider[] = [];
  const autoDoors: ProximityAutoDoor3D[] = [];
  const interactPoints: TownInteractPoint[] = [];
  const cosLot = Math.cos(rotY);
  const sinLot = Math.sin(rotY);
  const localToWorldXZ = (lxP: number, lzP: number) => ({
    wx: lotX + lxP * cosLot + lzP * sinLot,
    wz: lotZ - lxP * sinLot + lzP * cosLot,
  });

  const palette =
    kind === 'pokemon_center'
      ? { ext: 0xf8f9fa, trim: 0xe03131, inner: 0xd99b52, wainscot: 0xf4eed7, roof: 0xd93829 }
      : kind === 'poke_mart'
        ? { ext: 0xf1f5f9, trim: 0x1c7ed6, inner: 0xe2e8f0, wainscot: 0xf8fafc, roof: 0x1971c2 }
        : kind === 'hotel'
          ? { ext: 0xfef3c7, trim: 0xd97706, inner: 0xeed9b7, wainscot: 0xfdf8ee, roof: 0xb45309 }
          : kind === 'restaurant'
            ? { ext: 0xffe8d6, trim: 0xd9480f, inner: 0xe8b88a, wainscot: 0xfff4e6, roof: 0xc92a2a }
            : { ext: 0xf3e8d8, trim: 0x6f4e37, inner: 0xe9dac4, wainscot: 0xfaf3e8, roof: 0x5c3d2e };

  const extWallMat = new THREE.MeshLambertMaterial({ color: palette.ext });
  const innerWallMat = new THREE.MeshLambertMaterial({
    color: palette.inner,
    emissive: palette.inner,
    emissiveIntensity: 0.28,
  });
  const wainscotMat = new THREE.MeshLambertMaterial({
    color: palette.wainscot,
    emissive: palette.wainscot,
    emissiveIntensity: 0.30,
  });
  const trimMat = new THREE.MeshLambertMaterial({ color: palette.trim });
  const roofMat = new THREE.MeshLambertMaterial({ color: palette.roof });
  const ceilingMat = new THREE.MeshLambertMaterial({
    color: 0xfff6e5,
    emissive: 0xffe8bd,
    emissiveIntensity: 0.36,
  });
  const plinthMat = new THREE.MeshLambertMaterial({ color: 0x7c8594 });

  const addBox = (
    bw: number,
    bh: number,
    bd: number,
    mat: THREE.Material,
    bx: number,
    by: number,
    bz: number,
    edge = true,
  ) => {
    const geo = new THREE.BoxGeometry(bw, bh, bd);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(bx, by, bz);
    mesh.castShadow = edge;
    mesh.receiveShadow = true;
    shellGroup.add(mesh);
    return mesh;
  };

  // ==================== 1. FOUNDATION PLINTH & WARMLY LIT 1F TILED FLOOR ====================
  addBox(w + 1.2, 2.4, d + 1.2, plinthMat, 0, -1.08, 0, false);

  const f1Tex = floorTex.clone();
  f1Tex.repeat.set(Math.max(4, Math.round(w / 5.5)), Math.max(4, Math.round(d / 5.5)));
  f1Tex.wrapS = THREE.RepeatWrapping;
  f1Tex.wrapT = THREE.RepeatWrapping;
  f1Tex.needsUpdate = true;
  const f1FloorMat = new THREE.MeshLambertMaterial({
    map: f1Tex,
    emissive: 0xfff4dc,
    emissiveMap: f1Tex,
    emissiveIntensity: 0.38,
  });
  registerNightReactiveHook((glow) => {
    innerWallMat.emissiveIntensity = 0.24 + glow * 0.44;
    wainscotMat.emissiveIntensity = 0.26 + glow * 0.46;
    ceilingMat.emissiveIntensity = 0.32 + glow * 0.48;
    f1FloorMat.emissiveIntensity = 0.34 + glow * 0.48;
  });
  const f1Mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), f1FloorMat);
  f1Mesh.rotation.x = -Math.PI / 2;
  f1Mesh.position.y = floor1Y;
  f1Mesh.receiveShadow = true;
  shellGroup.add(f1Mesh);

  const spillMesh = new THREE.Mesh(new THREE.PlaneGeometry(w + 8.5, 9.5), getSharedStorefrontSpillMat());
  spillMesh.rotation.x = -Math.PI / 2;
  spillMesh.position.set(0, 0.06, d * 0.5 + 3.2);
  shellGroup.add(spillMesh);

  // ==================== 2. STREET-FACING (+Z) STOREFRONT GLASS ONLY + SOLID SIDE/REAR VOXEL WALLS ====================
  const wallT = 0.85;
  const doorW = 6.2;
  const doorH = entryDoor;
  const lintelH = totalWallH - doorH;
  const segW = Math.max(2.0, (w - doorW) * 0.5);
  const segOffX = doorW * 0.5 + segW * 0.5;

  const mullionMat = new THREE.MeshLambertMaterial({ color: 0x1e2533 });
  const brushedRailMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
  const clearGlassMat = new THREE.MeshLambertMaterial({
    color: 0xdcf4ff,
    emissive: 0x56ccf2,
    emissiveIntensity: 0.10,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glassGlintMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Street-facing +Z glazed span helper
  const buildFrontGlazedWing = (cxSpan: number, fz: number, spanLen: number) => {
    const cornerColW = Math.min(1.15, Math.max(0.8, spanLen * 0.09));
    const glassSpan = spanLen - cornerColW * 2;
    for (let s = 1; s <= stories; s++) {
      const yBase = s === 1 ? floor1Y : floor2Y;
      const storyH = s === 1 ? H1 : H2;
      const curbH = 0.22;
      const headY = (s === 1 ? 3.85 : 3.65) * heightScale;
      const winH = headY - curbH;
      const spandrelH = storyH - headY;
      const winMidY = yBase + curbH + winH * 0.5;

      addBox(spanLen, spandrelH, wallT, extWallMat, cxSpan, yBase + headY + spandrelH * 0.5, fz);
      if (glassSpan < 1.8) {
        addBox(spanLen, headY, wallT, extWallMat, cxSpan, yBase + headY * 0.5, fz);
        continue;
      }
      addBox(cornerColW, headY, wallT, extWallMat, cxSpan - spanLen * 0.5 + cornerColW * 0.5, yBase + headY * 0.5, fz);
      addBox(cornerColW, headY, wallT, extWallMat, cxSpan + spanLen * 0.5 - cornerColW * 0.5, yBase + headY * 0.5, fz);
      addBox(glassSpan, curbH, wallT * 0.75, mullionMat, cxSpan, yBase + curbH * 0.5, fz, false);
      addBox(glassSpan, 0.14, wallT * 0.75, mullionMat, cxSpan, yBase + headY - 0.07, fz, false);
      if (s === 2) {
        addBox(glassSpan - 0.1, 0.08, 0.14, brushedRailMat, cxSpan, yBase + 1.02, fz, false);
      }
      const pane = addBox(glassSpan - 0.08, winH - 0.12, 0.08, clearGlassMat, cxSpan, winMidY, fz, false);
      pane.renderOrder = 4;

      const numBays = Math.max(2, Math.round(glassSpan / 4.2));
      const bayW = glassSpan / numBays;
      for (let bi = 0; bi <= numBays; bi++) {
        const mx = cxSpan - glassSpan * 0.5 + bi * bayW;
        addBox(0.12, winH, 0.22, mullionMat, mx, winMidY, fz, false);
        if (bi < numBays && bi % 2 === 0) {
          const glint = addBox(0.24, winH * 0.65, 0.08, glassGlintMat, mx + bayW * 0.36, winMidY, fz, false);
          glint.rotation.z = -0.28;
          glint.renderOrder = 5;
        }
      }
    }
    addBox(spanLen + 0.2, 0.36, wallT + 0.24, trimMat, cxSpan, floor1Y + H1, fz);
  };

  // 1) STREET-FACING FRONT (+Z): Storefront Glass + Stepped Voxel Entrance Awning + Auto-Opening Glass Doors!
  {
    const fz = d * 0.5;
    buildFrontGlazedWing(-segOffX, fz, segW);
    buildFrontGlazedWing(segOffX, fz, segW);
    if (stories === 2) {
      const f1LintelH = H1 - doorH;
      addBox(doorW + 0.2, f1LintelH, wallT, extWallMat, 0, floor1Y + doorH + f1LintelH * 0.5, fz);
      addBox(doorW + 0.2, H2, wallT, extWallMat, 0, floor2Y + H2 * 0.5, fz);
    } else {
      addBox(doorW + 0.2, lintelH, wallT, extWallMat, 0, floor1Y + doorH + lintelH * 0.5, fz);
    }
    addBox(0.28, doorH, wallT + 0.16, mullionMat, -doorW * 0.5, floor1Y + doorH * 0.5, fz, false);
    addBox(0.28, doorH, wallT + 0.16, mullionMat, doorW * 0.5, floor1Y + doorH * 0.5, fz, false);
    addBox(doorW + 0.4, 0.28, wallT + 0.22, trimMat, 0, floor1Y + doorH, fz, false);

    // Stepped Striped MagicaVoxel Entrance Awning + Twin Warm Voxel Doorway Lanterns!
    const awningTotalW = kind==='restaurant' ? Math.max(doorW+3,w*.55) : doorW+3;
    if(kind==='restaurant'){
      const stripeCount=13,stripeW=awningTotalW/stripeCount;
      const whiteStripeMat=new THREE.MeshLambertMaterial({color:0xfff9f0});
      for(let si=0;si<stripeCount;si++){
        const sx=-awningTotalW*.5+(si+.5)*stripeW,sMat=si%2===0?roofMat:whiteStripeMat;
        addVoxelBox(shellGroup,stripeW+.02,.34,2.5,sMat,sx,floor1Y+doorH+.14,fz+1.15);
        addVoxelBox(shellGroup,stripeW+.02,.28,1.5,sMat,sx,floor1Y+doorH+.48,fz+.65);
      }
    }else{
      // A flat entrance canopy for the modern shop, hotel and clinic.
      const canopyDepth=kind==='hotel'?3.2:2.35;
      addVoxelBox(shellGroup,awningTotalW,.4,canopyDepth,kind==='hotel'?mullionMat:roofMat,0,floor1Y+doorH+.14,fz+canopyDepth*.46);
      addVoxelBox(shellGroup,awningTotalW,.12,.12,brushedRailMat,0,floor1Y+doorH+.20,fz+canopyDepth*.93,false);
    }
    const lanternGeo = getCachedDoorLanternGeo();
    for (const side of [-1, 1]) {
      const lantern = new THREE.Mesh(lanternGeo, getSharedVoxelArchMaterial());
      lantern.position.set(side * (doorW * 0.5 + 0.85), floor1Y + 2.35, fz + 0.48);
      shellGroup.add(lantern);
    }

    const leafW = doorW * 0.495;
    const leafH = doorH - 0.06;
    const handleMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    const buildDoorLeaf = (): THREE.Group => {
      const gLeaf = new THREE.Group();
      addVoxelBox(gLeaf, leafW, 0.14, 0.14, mullionMat, 0, 0, 0, false);
      addVoxelBox(gLeaf, leafW, 0.14, 0.14, mullionMat, 0, leafH - 0.14, 0, false);
      addVoxelBox(gLeaf, 0.10, leafH, 0.14, mullionMat, -leafW * 0.5 + 0.05, 0, 0, false);
      addVoxelBox(gLeaf, 0.10, leafH, 0.14, mullionMat, leafW * 0.5 - 0.05, 0, 0, false);
      const dg = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.18, leafH - 0.28, 0.06), clearGlassMat);
      dg.position.set(0, leafH * 0.5, 0);
      dg.renderOrder = 4;
      gLeaf.add(dg);
      addVoxelBox(gLeaf, 0.10, 0.68, 0.24, handleMat, 0, 1.05, 0, false);
      return gLeaf;
    };

    const leftSlide = buildDoorLeaf();
    const rightSlide = buildDoorLeaf();
    leftSlide.position.set(-doorW * 0.25, floor1Y, fz + 0.06);
    rightSlide.position.set(doorW * 0.25, floor1Y, fz + 0.06);
    shellGroup.add(leftSlide, rightSlide);
    const dWorld = localToWorldXZ(0, fz);
    const slideSpan = leafW * 0.92;
    autoDoors.push({
      worldX: dWorld.wx,
      worldY: baseWorldY + floor1Y,
      worldZ: dWorld.wz,
      triggerRadius: 5.4,
      openT: 0,
      applyOpenT: (t) => {
        leftSlide.position.x = -doorW * 0.25 - slideSpan * t;
        rightSlide.position.x = doorW * 0.25 + slideSpan * t;
      },
    });
  }

  // 2) NON-STREET BACK WALL (-Z): Solid Voxel-Pilaster Masonry Wall + Default-Closed Rear Service Door (`后门`)!
  const backDoorW = 3.4;
  const backDoorH = rearDoor;
  const backDoorCenterX = kind === 'restaurant' ? w * 0.26 : 0;
  {
    const bz = -d * 0.5;
    const leftSpanW = Math.max(0.5, backDoorCenterX - backDoorW * 0.5 - -w * 0.5);
    const rightSpanW = Math.max(0.5, w * 0.5 - (backDoorCenterX + backDoorW * 0.5));
    addBox(leftSpanW, totalWallH, wallT, extWallMat, -w * 0.5 + leftSpanW * 0.5, floor1Y + totalWallH * 0.5, bz);
    addBox(rightSpanW, totalWallH, wallT, extWallMat, w * 0.5 - rightSpanW * 0.5, floor1Y + totalWallH * 0.5, bz);
    addBox(backDoorW + 0.1, totalWallH - backDoorH, wallT, extWallMat, backDoorCenterX, floor1Y + backDoorH + (totalWallH - backDoorH) * 0.5, bz);
    // Warm RSE interior wall lining & cream wainscot on the inside face of back wall!
    addBox(leftSpanW - 0.2, H1 - 1.2, 0.12, innerWallMat, -w * 0.5 + leftSpanW * 0.5, floor1Y + 1.1 + (H1 - 1.2) * 0.5, bz + wallT * 0.52, false);
    addBox(leftSpanW - 0.2, 1.1, 0.14, wainscotMat, -w * 0.5 + leftSpanW * 0.5, floor1Y + 0.55, bz + wallT * 0.53, false);
    addBox(rightSpanW - 0.2, H1 - 1.2, 0.12, innerWallMat, w * 0.5 - rightSpanW * 0.5, floor1Y + 1.1 + (H1 - 1.2) * 0.5, bz + wallT * 0.52, false);
    addBox(rightSpanW - 0.2, 1.1, 0.14, wainscotMat, w * 0.5 - rightSpanW * 0.5, floor1Y + 0.55, bz + wallT * 0.53, false);

    addBox(w + wallT + 0.2, 0.36, wallT + 0.24, trimMat, 0, floor1Y + H1, bz);
    addBox(0.24, backDoorH, wallT + 0.14, mullionMat, backDoorCenterX - backDoorW * 0.5, floor1Y + backDoorH * 0.5, bz, false);
    addBox(0.24, backDoorH, wallT + 0.14, mullionMat, backDoorCenterX + backDoorW * 0.5, floor1Y + backDoorH * 0.5, bz, false);
    addBox(backDoorW + 0.36, 0.26, wallT + 0.20, trimMat, backDoorCenterX, floor1Y + backDoorH, bz);

    const rearPivot = new THREE.Group();
    const rw = backDoorW - 0.18;
    const rh = backDoorH - 0.08;
    rearPivot.position.set(backDoorCenterX - rw * 0.5, floor1Y, bz);
    addVoxelBox(rearPivot, rw, rh, 0.16, new THREE.MeshLambertMaterial({ color: 0x5c677d }), rw * 0.5, 0, 0);
    addVoxelBox(rearPivot, 0.14, 0.44, 0.28, new THREE.MeshLambertMaterial({ color: 0xfcc419 }), rw - 0.32, 1.15, 0, false);
    shellGroup.add(rearPivot);

    const bWorld = localToWorldXZ(backDoorCenterX, bz);
    const wallMaxYB = baseWorldY + floor1Y + totalWallH + 1.0;
    const backDoorCol = makeLocalObb(
      lotX,
      lotZ,
      rotY,
      backDoorCenterX,
      bz,
      backDoorW * 0.5,
      0.45,
      0,
      2.6,
      interiorId,
      baseWorldY - 0.5,
      baseWorldY + floor1Y + backDoorH,
    );
    const backDoorNote =
      kind === 'pokemon_center'
        ? '【应急安全后门】通往宝可梦中心后巷，平时保持闭合，需手动推拉开启。'
        : kind === 'poke_mart'
          ? '【百货卸货后门】贴着「随手关门 · 货物通道」标识，可手动推门出入。'
          : kind === 'restaurant'
            ? '【后厨通道后门】贴着「净厨通道 · 进出请随手关门」，里面飘来浓郁高汤香气！'
            : kind === 'hotel'
              ? '【酒店后勤通道门】厚重的防风金属门，需手动推门开启。'
              : '【公寓后院小门】配有黄铜门锁的后门，需手动转动把手开启。';
    const backDoorEntry: ProximityAutoDoor3D = {
      id: `${interiorId}_back_door`,
      mode: 'manual',
      label: '🚪 建筑后门',
      worldX: bWorld.wx,
      worldY: baseWorldY + floor1Y,
      worldZ: bWorld.wz,
      triggerRadius: 3.2,
      openT: 0,
      isOpen: false,
      swingDir: 1,
      normalX: sinLot,
      normalZ: cosLot,
      inspectNote: backDoorNote,
      collider: backDoorCol,
      applyOpenT: (t, dir) => {
        rearPivot.rotation.y = 1.42 * dir * t;
      },
    };
    autoDoors.push(backDoorEntry);
    interactPoints.push({
      id: `${interiorId}_back_door_pt`,
      townName,
      kind: 'building_door',
      label: '🚪 建筑后门',
      hint: '手动推开/关上后门，或检查门牌标识',
      doorRef: backDoorEntry,
      x: bWorld.wx,
      y: baseWorldY + floor1Y,
      z: bWorld.wz,
      radius: 2.9,
    });

    colliders.push(
      backDoorCol,
      makeLocalObb(lotX, lotZ, rotY, -w * 0.5 + leftSpanW * 0.5, bz, leftSpanW * 0.5 + 0.1, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxYB),
      makeLocalObb(lotX, lotZ, rotY, w * 0.5 - rightSpanW * 0.5, bz, rightSpanW * 0.5 + 0.1, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxYB),
    );
  }

  // 3) NON-STREET LEFT (-X) & RIGHT (+X) SIDE WALLS: Solid Stepped Voxel Pilaster Walls + RSE Interior Wainscoting!
  for (const sx of [-1, 1]) {
    const wx = sx * (w * 0.5);
    addBox(wallT, totalWallH, d + wallT, extWallMat, wx, floor1Y + totalWallH * 0.5, 0);
    addBox(wallT + 0.24, 0.36, d + wallT + 0.2, trimMat, wx, floor1Y + H1, 0);
    // Exterior MagicaVoxel Vertical Pilaster Ribs along non-street side walls!
    for (const pz of [-d * 0.32, 0, d * 0.32]) {
      addVoxelBox(shellGroup, 0.36, totalWallH, 0.95, trimMat, wx + sx * (wallT * 0.5 + 0.14), floor1Y, pz);
    }
    // Interior RSE Warm Paneling & Cream Lower Wainscot
    addBox(0.12, H1 - 1.2, d - 0.8, innerWallMat, wx - sx * (wallT * 0.52), floor1Y + 1.1 + (H1 - 1.2) * 0.5, 0, false);
    addBox(0.14, 1.1, d - 0.8, wainscotMat, wx - sx * (wallT * 0.53), floor1Y + 0.55, 0, false);
  }

  const wallMaxY = baseWorldY + floor1Y + totalWallH + 1.0;
  colliders.push(makeLocalObb(lotX, lotZ, rotY, -w * 0.5, 0, 0.6, d * 0.5 + 0.5, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  colliders.push(makeLocalObb(lotX, lotZ, rotY, w * 0.5, 0, 0.6, d * 0.5 + 0.5, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  colliders.push(makeLocalObb(lotX, lotZ, rotY, -segOffX, d * 0.5, segW * 0.5 + 0.15, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  colliders.push(makeLocalObb(lotX, lotZ, rotY, segOffX, d * 0.5, segW * 0.5 + 0.15, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));

  // ==================== 3. STEPPED MAGICAVOXEL ROOF TIERS, VOXEL HVAC & SIGNAGE ====================
  const roofY = floor1Y + totalWallH;
  addBox(w + wallT * 1.4, 0.45, d + wallT * 1.4, ceilingMat, 0, roofY + 0.22, 0);
  // Different building functions have distinct rooflines, keeping the interior shell intact.
  addVoxelBox(shellGroup, w + wallT * 1.8, 0.68, d + wallT * 1.8, roofMat, 0, roofY + 0.45, 0);
  if(kind==='restaurant'){
    // Deep tiled eaves and a raised asymmetric roof ridge.
    addVoxelBox(shellGroup,w*.72,1.0,d*.70,roofMat,-w*.08,roofY+1.10,-d*.03);
    addVoxelBox(shellGroup,w*.46,.7,d*.45,roofMat,-w*.13,roofY+2.10,-d*.05);
    for(let x=-w*.43;x<w*.44;x+=2.4)addVoxelBox(shellGroup,.18,.22,1.0,trimMat,x,roofY+.20,d*.5+.55,false);
  }else if(kind==='poke_mart'){
    // Flat parapet and vertical blue fascia frame a modern glazed storefront.
    addVoxelBox(shellGroup,w*.96,.75,.35,trimMat,0,roofY+1.13,d*.48);
    for(const side of [-1,1]) addVoxelBox(shellGroup,.55,totalWallH*.74,.4,trimMat,side*w*.46,floor1Y+H1*.13,d*.5+.50,false);
  }else if(kind==='hotel'){
    addVoxelBox(shellGroup,w*.82,.5,d*.76,extWallMat,0,roofY+1.13,0);
    addVoxelBox(shellGroup,w*.36,1.35,d*.3,roofMat,0,roofY+1.63,-d*.15);
  }else{
    addVoxelBox(shellGroup, w * 0.90, 0.62, d * 0.90, roofMat, 0, roofY + 1.13, 0);
    addVoxelBox(shellGroup, w * 0.78, 0.48, d * 0.78, extWallMat, 0, roofY + 1.75, 0);
  }

  // Rooftop Voxel HVAC Cooling Unit!
  addVoxelBox(shellGroup, 2.4, 1.15, 1.65, new THREE.MeshLambertMaterial({ color: 0xcbd5e1 }), w * 0.26, roofY + 2.23, -d * 0.20);
  addVoxelBox(shellGroup, 0.95, 0.18, 0.95, mullionMat, w * 0.26, roofY + 3.38, -d * 0.20, false);

  if (signTex) {
    // Illuminated Backlit Storefront Voxel Signboard (shines crisply day AND night!)
    const signBack = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 3.3, 0.52),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }),
    );
    signBack.position.set(0, roofY + 2.55, d * 0.5 + 0.22);
    const signGeo = new THREE.BoxGeometry(10.8, 2.9, 0.56);
    const signMesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTex }));
    signMesh.position.set(0, roofY + 2.55, d * 0.5 + 0.32);
    shellGroup.add(signBack, signMesh);
  }
  if (kind === 'pokemon_center') {
    const beacon = createVoxelPokeball3D(3.4);
    beacon.position.set(0, roofY + 2.25, 0);
    shellGroup.add(beacon);
    onRegisterSpinner?.(beacon);
  }

  // 3D MagicaVoxel Warm Ceiling Chandeliers on 1F & 2F (clearly visible glowing through windows at night!)
  const chandelierGeo = getCachedCeilingChandelierGeo();
  for (const lxP of [-w * 0.24, 0, w * 0.24]) {
    for (const lzP of [-d * 0.20, d * 0.22]) {
      const ch1 = new THREE.Mesh(chandelierGeo, getSharedIndoorLitVoxelMaterial());
      ch1.position.set(lxP, floor1Y + H1 - 0.85, lzP);
      shellGroup.add(ch1);
      if (stories === 2) {
        const ch2 = new THREE.Mesh(chandelierGeo, getSharedIndoorLitVoxelMaterial());
        ch2.position.set(lxP, roofY - 0.85, lzP);
        shellGroup.add(ch2);
      }
    }
  }

  // ==================== 4. WALKABLE 3D RSE ESCALATOR / VOXEL STAIRCASE + 2F FLOOR SLAB ====================
  let stairZone: WalkableStairAndFloorZone3D | undefined;
  if (stories === 2) {
    const stMinX = -w * 0.44;
    const stMaxX = stMinX + 4.4;
    const stCx = (stMinX + stMaxX) * 0.5;
    const stairHalfLength = Math.min(d*.5-1.2, H1/4.6*5.6);
    const stBotZ = stairHalfLength;
    const stTopZ = -stairHalfLength;
    const openMinX = stMinX - 0.2;
    const openMaxX = stMaxX + 0.2;
    const openMinZ = stTopZ - 0.3;
    const openMaxZ = stBotZ + 0.4;

    stairZone = {
      cx: lotX,
      cz: lotZ,
      rotY,
      baseY: baseWorldY,
      halfW: w * 0.5,
      halfD: d * 0.5,
      upperFloorOffsetY: floor2Y,
      stairMinX: stMinX,
      stairMaxX: stMaxX,
      stairBottomZ: stBotZ,
      stairTopZ: stTopZ,
      openingMinX: openMinX,
      openingMaxX: openMaxX,
      openingMinZ: openMinZ,
      openingMaxZ: openMaxZ,
    };

    const f2Tex = woodFloorTex.clone();
    f2Tex.repeat.set(Math.max(4, Math.round(w / 5)), Math.max(4, Math.round(d / 5)));
    f2Tex.wrapS = THREE.RepeatWrapping;
    f2Tex.wrapT = THREE.RepeatWrapping;
    f2Tex.needsUpdate = true;
    const slabTopMat = new THREE.MeshLambertMaterial({
      map: f2Tex,
      emissive: 0xffffff,
      emissiveMap: f2Tex,
      emissiveIntensity: 0.24,
    });
    const slabMat = [ceilingMat, ceilingMat, slabTopMat, ceilingMat, ceilingMat, ceilingMat];
    const addSlabRect = (x0: number, x1: number, z0: number, z1: number) => {
      const rw = x1 - x0;
      const rd = z1 - z0;
      if (rw <= 0.1 || rd <= 0.1) return;
      const g = new THREE.BoxGeometry(rw, 0.26, rd);
      const m = new THREE.Mesh(g, slabMat);
      m.position.set((x0 + x1) * 0.5, floor2Y - 0.13, (z0 + z1) * 0.5);
      m.receiveShadow = true;
      m.castShadow = true;
      shellGroup.add(m);
    };
    addSlabRect(-w * 0.5, openMinX, -d * 0.5, d * 0.5);
    addSlabRect(openMaxX, w * 0.5, -d * 0.5, d * 0.5);
    addSlabRect(openMinX, openMaxX, -d * 0.5, openMinZ);
    addSlabRect(openMinX, openMaxX, openMaxZ, d * 0.5);

    // RSE Escalator-styled blue-slate treads on Pokémon Center; warm oak voxel steps on Hotel/House!
    const stepMat = new THREE.MeshLambertMaterial({
      color: kind === 'pokemon_center' ? 0x5c6f91 : 0x9c6644,
    });
    const railSideMat = new THREE.MeshLambertMaterial({
      color: kind === 'pokemon_center' ? 0xe87352 : 0x5c3d2e,
    });
    const numSteps = Math.max(16,Math.ceil((floor2Y-floor1Y)/.3));
    const stepSpanZ = (stBotZ - stTopZ) / numSteps;
    const stepRiseY = (floor2Y - floor1Y) / numSteps;
    for (let s = 0; s < numSteps; s++) {
      const sz = stBotZ - (s + 0.5) * stepSpanZ;
      const syTop = floor1Y + (s + 1) * stepRiseY;
      const stepH = Math.max(0.32, syTop - floor1Y);
      addBox(4.1, stepH, stepSpanZ + 0.06, stepMat, stCx, floor1Y + stepH * 0.5, sz, true);
    }
    const stairLen = Math.hypot(stBotZ - stTopZ, floor2Y - floor1Y);
    const stairPitch = Math.atan2(floor2Y - floor1Y, stBotZ - stTopZ);
    for (const rSide of [-1, 1]) {
      const rx = stCx + rSide * 2.12;
      const rMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, stairLen), railSideMat);
      rMesh.position.set(rx, (floor1Y + floor2Y) * 0.5 + 0.88, (stBotZ + stTopZ) * 0.5);
      rMesh.rotation.x = stairPitch;
      shellGroup.add(rMesh);
      colliders.push(
        makeLocalObb(lotX, lotZ, rotY, rx, (stBotZ + stTopZ) * 0.5, 0.24, (stBotZ - stTopZ) * 0.48, 0, 2.2, interiorId, baseWorldY, baseWorldY + floor2Y + 1.5),
      );
    }
    const f2MinY = baseWorldY + floor2Y - 0.3;
    const f2MaxY = baseWorldY + roofY;
    addBox(0.24, 1.08, openMaxZ - openMinZ, railSideMat, openMaxX + 0.1, floor2Y + 0.54, (openMinZ + openMaxZ) * 0.5, true);
    colliders.push(makeLocalObb(lotX, lotZ, rotY, openMaxX + 0.1, (openMinZ + openMaxZ) * 0.5, 0.25, (openMaxZ - openMinZ) * 0.5, 0, 1.5, interiorId, f2MinY, f2MaxY));
    addBox(openMaxX - openMinX, 1.08, 0.24, railSideMat, stCx, floor2Y + 0.54, openMaxZ + 0.1, true);
    colliders.push(makeLocalObb(lotX, lotZ, rotY, stCx, openMaxZ + 0.1, (openMaxX - openMinX) * 0.5, 0.25, 0, 1.5, interiorId, f2MinY, f2MaxY));
  }

  // Interior partition wall helpers (used by Enclosed Restaurant Kitchen & 2F Suites!)
  let interiorDoorCounter = 0;
  const addInteriorWallWithDoor = (
    floorIdx: 1 | 2,
    axis: 'x' | 'z',
    fixedCoord: number,
    spanStart: number,
    spanEnd: number,
    doorCenter: number,
    doorWidth = 3.2,
    doorOpts?: {
      id?: string;
      mode?: 'manual' | 'hotel_keycard';
      label?: string;
      hotelId?: string;
      roomNumber?: string;
      inspectNote?: string;
    },
  ) => {
    const baseY = floorIdx === 2 ? floor2Y : floor1Y;
    const h = floorIdx === 2 ? H2 : H1;
    const minY = baseWorldY + baseY - 0.2;
    const maxY = baseWorldY + baseY + h;
    const leftLen = Math.max(0, doorCenter - doorWidth * 0.5 - spanStart);
    const rightLen = Math.max(0, spanEnd - (doorCenter + doorWidth * 0.5));
    const dH = 3.15;
    const doorMode = doorOpts?.mode ?? 'manual';
    const doorId = doorOpts?.id ?? `${interiorId}_room_door_${interiorDoorCounter++}`;
    const doorLabel = doorOpts?.label ?? '🚪 房间木门';
    const doorNote =
      doorOpts?.inspectNote ?? '精巧的室内体素木门，转动黄铜把手即可打开或关上。';

    if (axis === 'x') {
      if (leftLen > 0.2) {
        const cxW = spanStart + leftLen * 0.5;
        addBox(leftLen, h, 0.42, wainscotMat, cxW, baseY + h * 0.5, fixedCoord);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, cxW, fixedCoord, leftLen * 0.5, 0.3, 0, h, interiorId, minY, maxY));
      }
      if (rightLen > 0.2) {
        const cxW = spanEnd - rightLen * 0.5;
        addBox(rightLen, h, 0.42, wainscotMat, cxW, baseY + h * 0.5, fixedCoord);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, cxW, fixedCoord, rightLen * 0.5, 0.3, 0, h, interiorId, minY, maxY));
      }
      addBox(doorWidth, h - dH, 0.42, wainscotMat, doorCenter, baseY + dH + (h - dH) * 0.5, fixedCoord);
      addBox(doorWidth + 0.3, 0.22, 0.52, trimMat, doorCenter, baseY + dH, fixedCoord, false);

      // Hotel electronic keycard reader & brass room plaque beside hotel suite doors!
      if (doorMode === 'hotel_keycard') {
        addVoxelBox(
          shellGroup,
          0.32,
          0.46,
          0.14,
          new THREE.MeshLambertMaterial({ color: 0x1e293b }),
          doorCenter + doorWidth * 0.5 + 0.38,
          baseY + 1.35,
          fixedCoord + 0.24,
          false,
        );
        addVoxelBox(
          shellGroup,
          0.16,
          0.12,
          0.16,
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
          doorCenter + doorWidth * 0.5 + 0.38,
          baseY + 1.62,
          fixedCoord + 0.25,
          false,
        );
      }

      const rw = doorWidth - 0.22;
      const rh = dH - 0.10;
      const rPivot = new THREE.Group();
      rPivot.position.set(doorCenter - rw * 0.5, baseY, fixedCoord);
      addVoxelBox(rPivot, rw, rh, 0.15, new THREE.MeshLambertMaterial({ color: 0x8d5b4c }), rw * 0.5, 0, 0);
      addVoxelBox(rPivot, 0.16, 0.16, 0.30, new THREE.MeshLambertMaterial({ color: 0xfcc419 }), rw - 0.32, 1.25, 0, false);
      shellGroup.add(rPivot);
      const rWorld = localToWorldXZ(doorCenter, fixedCoord);
      const doorCol = makeLocalObb(lotX, lotZ, rotY, doorCenter, fixedCoord, doorWidth * 0.5, 0.35, 0, 2.55, interiorId, minY, baseWorldY + baseY + dH);
      colliders.push(doorCol);
      const dEntry: ProximityAutoDoor3D = {
        id: doorId,
        mode: doorMode,
        label: doorLabel,
        worldX: rWorld.wx,
        worldY: baseWorldY + baseY,
        worldZ: rWorld.wz,
        triggerRadius: 2.9,
        openT: 0,
        isOpen: false,
        swingDir: 1,
        normalX: sinLot,
        normalZ: cosLot,
        hotelId: doorOpts?.hotelId,
        roomNumber: doorOpts?.roomNumber,
        inspectNote: doorNote,
        collider: doorCol,
        applyOpenT: (t, dir) => {
          rPivot.rotation.y = 1.42 * dir * t;
        },
      };
      autoDoors.push(dEntry);
      interactPoints.push({
        id: `${doorId}_pt`,
        townName,
        kind: 'building_door',
        label: doorLabel,
        hint: doorMode === 'hotel_keycard' ? '需刷对应房卡开门 / 检查门牌' : '手动开关房门 / 检查房门',
        doorRef: dEntry,
        hotelId: doorOpts?.hotelId,
        roomNumber: doorOpts?.roomNumber,
        x: rWorld.wx,
        y: baseWorldY + baseY,
        z: rWorld.wz,
        radius: 2.75,
      });
    } else {
      if (leftLen > 0.2) {
        const czW = spanStart + leftLen * 0.5;
        addBox(0.42, h, leftLen, wainscotMat, fixedCoord, baseY + h * 0.5, czW);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, fixedCoord, czW, 0.3, leftLen * 0.5, 0, h, interiorId, minY, maxY));
      }
      if (rightLen > 0.2) {
        const czW = spanEnd - rightLen * 0.5;
        addBox(0.42, h, rightLen, wainscotMat, fixedCoord, baseY + h * 0.5, czW);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, fixedCoord, czW, 0.3, rightLen * 0.5, 0, h, interiorId, minY, maxY));
      }
      addBox(0.42, h - dH, doorWidth, wainscotMat, fixedCoord, baseY + dH + (h - dH) * 0.5, doorCenter);

      const rw = doorWidth - 0.22;
      const rh = dH - 0.10;
      const rPivot = new THREE.Group();
      rPivot.position.set(fixedCoord, baseY, doorCenter - rw * 0.5);
      addVoxelBox(rPivot, 0.15, rh, rw, new THREE.MeshLambertMaterial({ color: 0x8d5b4c }), 0, 0, rw * 0.5);
      addVoxelBox(rPivot, 0.30, 0.16, 0.16, new THREE.MeshLambertMaterial({ color: 0xfcc419 }), 0, 1.25, rw - 0.32, false);
      shellGroup.add(rPivot);
      const rWorld = localToWorldXZ(fixedCoord, doorCenter);
      const doorCol = makeLocalObb(lotX, lotZ, rotY, fixedCoord, doorCenter, 0.35, doorWidth * 0.5, 0, 2.55, interiorId, minY, baseWorldY + baseY + dH);
      colliders.push(doorCol);
      const dEntry: ProximityAutoDoor3D = {
        id: doorId,
        mode: doorMode,
        label: doorLabel,
        worldX: rWorld.wx,
        worldY: baseWorldY + baseY,
        worldZ: rWorld.wz,
        triggerRadius: 2.9,
        openT: 0,
        isOpen: false,
        swingDir: 1,
        normalX: cosLot,
        normalZ: -sinLot,
        hotelId: doorOpts?.hotelId,
        roomNumber: doorOpts?.roomNumber,
        inspectNote: doorNote,
        collider: doorCol,
        applyOpenT: (t, dir) => {
          rPivot.rotation.y = -1.42 * dir * t;
        },
      };
      autoDoors.push(dEntry);
      interactPoints.push({
        id: `${doorId}_pt`,
        townName,
        kind: 'building_door',
        label: doorLabel,
        hint: doorMode === 'hotel_keycard' ? '需刷对应房卡开门 / 检查门牌' : '手动开关房门 / 检查房门',
        doorRef: dEntry,
        hotelId: doorOpts?.hotelId,
        roomNumber: doorOpts?.roomNumber,
        x: rWorld.wx,
        y: baseWorldY + baseY,
        z: rWorld.wz,
        radius: 2.75,
      });
    }
  };

  const addSolidPartition = (floorIdx: 1 | 2, axis: 'x' | 'z', fixedCoord: number, s0: number, s1: number) => {
    const baseY = floorIdx === 2 ? floor2Y : floor1Y;
    const h = floorIdx === 2 ? H2 : H1;
    const minY = baseWorldY + baseY - 0.2;
    const maxY = baseWorldY + baseY + h;
    const len = Math.abs(s1 - s0);
    const mid = (s0 + s1) * 0.5;
    if (axis === 'x') {
      addBox(len, h, 0.42, wainscotMat, mid, baseY + h * 0.5, fixedCoord);
      colliders.push(makeLocalObb(lotX, lotZ, rotY, mid, fixedCoord, len * 0.5, 0.3, 0, h, interiorId, minY, maxY));
    } else {
      addBox(0.42, h, len, wainscotMat, fixedCoord, baseY + h * 0.5, mid);
      colliders.push(makeLocalObb(lotX, lotZ, rotY, fixedCoord, mid, 0.3, len * 0.5, 0, h, interiorId, minY, maxY));
    }
  };

  // ==================== 5. FURNISH INTERIOR WITH CHIBI-ERGONOMIC VOXEL-PIXEL MODELS ====================
  furnishWalkInInterior3D({
    kind,
    interiorId,
    townName,
    shellGroup,
    npcs,
    colliders,
    autoDoors,
    interactPoints,
    lotX,
    lotZ,
    rotY,
    baseWorldY,
    w,
    d,
    doorW,
    floor1Y,
    floor2Y,
    H1,
    H2,
    localToWorldXZ,
    spawnGbaNpc,
    makeLocalObb: (lx, lz, hw, hd, lRot, height, minY, maxY) =>
      makeLocalObb(lotX, lotZ, rotY, lx, lz, hw, hd, lRot, height, interiorId, minY, maxY),
    addInteriorWallWithDoor,
    addSolidPartition,
  });

  return {
    shellGroup,
    npcs,
    colliders,
    autoDoors,
    interactPoints,
    stairZone,
    stories,
    floor1CeilingY: baseWorldY + floor1Y + H1,
    floor2CeilingY: baseWorldY + roofY,
    dualDoors,
  };
}
