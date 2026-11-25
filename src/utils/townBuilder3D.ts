import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  BRIDGE_DECK_Y_3D,
  MOUNTAIN_TUNNEL_TRIGGER_Y,
  WATER_LEVEL_3D,
  WORLD_RAIL_SEGMENTS_3D,
  WORLD_ROAD_SEGMENTS_3D,
  WORLD_TOWNS_3D,
} from '../data/survivorsTactics';
import { getBiomeTextures } from '../data/worldTextures3D';
import { generateTownLayout, type TownStreetSeg } from './townStreetGen';

export type TownInteractKind = 'pokemon_center' | 'poke_mart' | 'transit_station' | 'npc_chat' | 'hotel_rest' | 'restaurant';

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
  /** Optional Oriented Bounding Box (OBB) for rotated buildings & solid doorway walls! */
  cx?: number;
  cz?: number;
  halfW?: number;
  halfD?: number;
  rotY?: number;
  /** Wall height above ground for 3D camera spring-arm wall occlusion */
  height?: number;
  /** Optional interior ID so camera inside a cutaway room ignores that room's faded exterior */
  interiorId?: string;
}

export interface EnterableBuildingInterior {
  id: string;
  name: string;
  kind: 'pokemon_center' | 'poke_mart' | 'house';
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
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
  mode: 'plaza_orbit' | 'sidewalk_patrol';
  cx: number;
  cz: number;
  radius: number;
  angle: number;
  speed: number;
  phase: number;
  baseY: number;
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
  // Three.js rotation.y transforms local (lx, lz) -> world (lx*cos + lz*sin, -lx*sin + lz*cos)
  // Inverse transforms world (dx, dz) -> local:
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) <= bInt.halfW && Math.abs(lz) <= bInt.halfD;
}

/** Helper to push an oriented box collider (for solid buildings or individual walls) */
function makeObbCollider(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rotY: number,
  height = 9.5,
  interiorId?: string,
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
  };
}

/**
 * Push 5 solid oriented perimeter walls around an enterable building:
 * Back wall, Left wall, Right wall, Front-Left wall, Front-Right wall — leaving ONLY the Front Doorway (+Z local) open!
 * Prevents walking through walls from the sides/back; players MUST enter through the front door!
 */
function pushEnterableBuildingWalls(
  colliders: TownCollider[],
  cx: number,
  cz: number,
  roomW: number,
  roomD: number,
  rotY: number,
  doorWidth = 4.2,
  wallHeight = 9.5,
  interiorId?: string,
): void {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const wallT = 0.65;
  const halfW = roomW * 0.5;
  const halfD = roomD * 0.5;

  const pushLocalWall = (lx: number, lz: number, hw: number, hd: number) => {
    const wx = cx + lx * cos + lz * sin;
    const wz = cz - lx * sin + lz * cos;
    colliders.push(makeObbCollider(wx, wz, hw, hd, rotY, wallHeight, interiorId));
  };

  // Back wall (-Z)
  pushLocalWall(0, -halfD, halfW + wallT * 0.5, wallT * 0.5);
  // Left wall (-X)
  pushLocalWall(-halfW, 0, wallT * 0.5, halfD + wallT * 0.5);
  // Right wall (+X)
  pushLocalWall(halfW, 0, wallT * 0.5, halfD + wallT * 0.5);

  // Front wall (+Z) split around a clear center doorway!
  const sideSpan = Math.max(1.2, (roomW - doorWidth) * 0.5);
  const frontSideCenter = doorWidth * 0.5 + sideSpan * 0.5;
  pushLocalWall(-frontSideCenter, halfD, sideSpan * 0.5 + 0.15, wallT * 0.5);
  pushLocalWall(frontSideCenter, halfD, sideSpan * 0.5 + 0.15, wallT * 0.5);
}

/** Shared OBB + AABB wall collision push-out used for Player, Followers, AND Wild Pokémon so nobody clips through walls! */
export function resolveTownWallCollisions(
  pos: { x: number; z: number },
  pad: number,
  colliders: TownCollider[],
): void {
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (box.cx !== undefined && box.cz !== undefined && box.halfW !== undefined && box.halfD !== undefined && box.rotY !== undefined) {
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
 * Ray-marches from player's pivot (ox, oy, oz) toward desired camera (cx, cy, cz) against town walls.
 * If a solid wall occludes the camera, pulls the camera smoothly inward right in front of the wall
 * instead of letting the lens penetrate walls or hide the player!
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
  activeInteriorId?: string | null,
): number {
  if (colliders.length === 0) return 1.0;
  const pad = 0.72;
  const steps = 14;
  for (let s = 2; s <= steps; s++) {
    const t = s / steps;
    const px = ox + (cx - ox) * t;
    const py = oy + (cy - oy) * t;
    const pz = oz + (cz - oz) * t;
    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (activeInteriorId && box.interiorId === activeInteriorId) continue;
      const wallTopY = groundBaseY + (box.height ?? 9.5);
      if (py > wallTopY) continue;
      let hit = false;
      if (box.cx !== undefined && box.cz !== undefined && box.halfW !== undefined && box.halfD !== undefined && box.rotY !== undefined) {
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
        return Math.max(0.24, (s - 1.2) / steps);
      }
    }
  }
  return 1.0;
}

const GLTF_LOADER = new GLTFLoader();
const TEX_LOADER = new THREE.TextureLoader();
const MODEL_PROMISE_CACHE = new Map<string, Promise<THREE.Group | null>>();
const NPC_TEX_CACHE = new Map<string, THREE.Texture>();
const INK_LINE_MAT = new THREE.LineBasicMaterial({
  color: 0x1a1e29,
  transparent: true,
  opacity: 0.45,
});

function getNpcTexture(url: string): THREE.Texture {
  const cached = NPC_TEX_CACHE.get(url);
  if (cached) return cached;
  const tex = TEX_LOADER.load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  NPC_TEX_CACHE.set(url, tex);
  return tex;
}

function createNpcBillboard(
  url: string,
  x: number,
  y: number,
  z: number,
  height = 2.75,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(height * 0.92, height);
  geo.translate(0, height * 0.5, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: getNpcTexture(url),
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * World-Space HD-2D Pixel-Art Architecture Shader Hook:
 * Injects crisp 16cm world-space pixel masonry/brick courses on vertical walls,
 * pixel roof shingle rows on roofs, subtle GBA Bayer dithering, and gentle 3-band HD-2D
 * cel quantization so EVERY 3D building/prop matches our chibi pixel characters & pixel trees!
 */
function applyPixelArtArchShader(mat: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  mat.customProgramCacheKey = () => 'pk_pixel_arch_hd2d_v1';
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vArchWorldPos;
varying vec3 vArchWorldNorm;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 archWp = modelMatrix * vec4(transformed, 1.0);
vArchWorldPos = archWp.xyz;
vArchWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vArchWorldPos;
varying vec3 vArchWorldNorm;
float archHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 aNorm = normalize(vArchWorldNorm);
vec3 pxCoord = floor(vArchWorldPos * 6.0);
float grain = 1.0;
if (abs(aNorm.y) < 0.55) {
  // Vertical facades: crisp pixel running-bond brick / tile courses!
  float hCoord = abs(aNorm.x) > abs(aNorm.z) ? pxCoord.z : pxCoord.x;
  float rowIdx = floor(pxCoord.y * 0.333);
  float mortarH = step(2.6, mod(pxCoord.y, 3.0));
  float brickCol = floor((hCoord + mod(rowIdx, 2.0) * 3.0) * 0.1667);
  float mortarV = step(5.5, mod(hCoord + mod(rowIdx, 2.0) * 3.0, 6.0));
  float brickVar = (archHash21(vec2(brickCol, rowIdx)) - 0.5) * 0.095;
  float mortarMask = max(mortarH, mortarV);
  grain = 1.0 + brickVar - mortarMask * 0.075;
} else {
  // Roofs & horizontal trims: crisp pixel shingle / tile rows!
  float shingleRow = step(2.5, mod(pxCoord.x + pxCoord.z, 3.0));
  float tileVar = (archHash21(pxCoord.xz * 0.5) - 0.5) * 0.085;
  grain = 1.0 + tileVar - shingleRow * 0.06;
}
// Subtle GBA 2x2 Bayer pixel dither + preserve bright glass/white highlights
float bayer = mod(pxCoord.x + pxCoord.y + pxCoord.z, 2.0) * 0.024 - 0.012;
diffuseColor.rgb *= clamp(grain + bayer, 0.84, 1.12);`,
      )
      .replace(
        '#include <dithering_fragment>',
        `// Gentle HD-2D cel-stepped tone cohesion (crisp shadow/mid/sunlight bands without crushing whites)
float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
float qLum = floor(lum * 7.5 + 0.5) / 7.5;
gl_FragColor.rgb *= mix(1.0, qLum / max(0.05, lum), 0.32);
#include <dithering_fragment>`,
      );
  };
  return mat;
}

function loadRawGlb(url: string): Promise<THREE.Group | null> {
  const cached = MODEL_PROMISE_CACHE.get(url);
  if (cached) return cached;
  const p = new Promise<THREE.Group | null>((resolve) => {
    GLTF_LOADER.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            const brightMats = mats.map((mat) => {
              const std = mat as THREE.MeshStandardMaterial;
              if (std.map) {
                std.map.magFilter = THREE.NearestFilter;
                std.map.minFilter = THREE.NearestFilter;
                std.map.colorSpace = THREE.SRGBColorSpace;
                std.map.needsUpdate = true;
              }
              return applyPixelArtArchShader(
                new THREE.MeshLambertMaterial({
                  color: std.color ? std.color.clone() : new THREE.Color(0xffffff),
                  map: std.map ?? null,
                  side: std.side,
                  transparent: std.transparent,
                  opacity: std.opacity,
                }),
              );
            });
            m.material = Array.isArray(m.material) ? brightMats : brightMats[0];
          }
        });
        resolve(root);
      },
      undefined,
      () => resolve(null),
    );
  });
  MODEL_PROMISE_CACHE.set(url, p);
  return p;
}

async function mountGlbModel(
  parent: THREE.Object3D,
  url: string,
  opts: {
    x: number;
    y: number;
    z: number;
    rotY?: number;
    targetWidth: number;
    heightMult?: number;
    addInkEdges?: boolean;
    tintHex?: number;
    cloneMaterials?: boolean;
    onMounted?: (wrapper: THREE.Group, height: number) => void;
  },
): Promise<void> {
  const raw = await loadRawGlb(url);
  if (!raw) return;

  const clone = raw.clone(true);
  clone.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(clone);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const horizSpan = Math.max(0.01, Math.max(rawSize.x, rawSize.z));
  const scale = opts.targetWidth / horizSpan;
  const hMult = opts.heightMult ?? 1.0;

  const wrapper = new THREE.Group();
  wrapper.position.set(opts.x, opts.y, opts.z);
  wrapper.rotation.y = opts.rotY ?? 0;

  clone.scale.set(scale, scale * hMult, scale);
  clone.position.set(
    -rawCenter.x * scale,
    -rawBox.min.y * scale * hMult - 0.04,
    -rawCenter.z * scale,
  );

  if (opts.tintHex !== undefined || opts.addInkEdges || opts.cloneMaterials) {
    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (opts.tintHex !== undefined || opts.cloneMaterials) {
        const tintColor = opts.tintHex !== undefined ? new THREE.Color(opts.tintHex) : null;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mm) => {
            const c = applyPixelArtArchShader(mm.clone() as THREE.MeshLambertMaterial);
            if (tintColor && c.color) c.color.lerp(tintColor, 0.2);
            return c;
          });
        } else if (mesh.material) {
          const c = applyPixelArtArchShader(mesh.material.clone() as THREE.MeshLambertMaterial);
          if (tintColor && c.color) c.color.lerp(tintColor, 0.2);
          mesh.material = c;
        }
      }
      if (opts.addInkEdges && mesh.geometry) {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 36);
        const line = new THREE.LineSegments(edges, INK_LINE_MAT.clone());
        mesh.add(line);
      }
    });
  }

  wrapper.add(clone);

  // Automatic Stone Retaining Foundation Plinth so buildings perched on hillsides sit solidly anchored into the slope (zero floating corners!)
  if (opts.targetWidth >= 10) {
    const fW = rawSize.x * scale * 0.94;
    const fD = rawSize.z * scale * 0.94;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(fW, 2.8, fD),
      new THREE.MeshLambertMaterial({ color: 0x8d8f96 }),
    );
    plinth.position.set(0, -1.42, 0);
    wrapper.add(plinth);
  }

  parent.add(wrapper);
  const finalH = rawSize.y * scale * hMult;
  opts.onMounted?.(wrapper, finalH);
}

/** Smoothly fades an enterable building's exterior shell & edges transparent for clear interior cutaway */
export function setBuildingExteriorOpacity(exteriorGroup: THREE.Group, alpha: number) {
  const isFaded = alpha < 0.96;
  exteriorGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.transparent = isFaded;
        mat.opacity = alpha;
        mat.depthWrite = !isFaded;
      }
    } else if ((obj as THREE.LineSegments).isLineSegments) {
      const lm = (obj as THREE.LineSegments).material as THREE.LineBasicMaterial;
      if (lm) {
        lm.opacity = 0.45 * alpha;
      }
    }
  });
}

function makePixelTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

interface TownGroundTex {
  cobblePlaza: THREE.CanvasTexture;
  roadTile: THREE.CanvasTexture;
  boulevard4Lane: THREE.CanvasTexture;
  collector2Lane: THREE.CanvasTexture;
  alleyCobble: THREE.CanvasTexture;
  junctionAsphalt: THREE.CanvasTexture;
  highwayTile: THREE.CanvasTexture;
  crosswalk: THREE.CanvasTexture;
  martSign: THREE.CanvasTexture;
  hotelSign: THREE.CanvasTexture;
  cafeSign: THREE.CanvasTexture;
  extraSigns: THREE.CanvasTexture[];
  busSign: THREE.CanvasTexture;
  clinicFloor: THREE.CanvasTexture;
  martFloor: THREE.CanvasTexture;
  woodFloor: THREE.CanvasTexture;
}

let CACHED_GROUND_TEX: TownGroundTex | null = null;

function getGroundTex(): TownGroundTex {
  if (CACHED_GROUND_TEX) return CACHED_GROUND_TEX;

  const makeSign = (bg: string, txt: string, fg = '#ffffff') =>
    makePixelTex(64, 24, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 64, 24);
      ctx.strokeStyle = '#141926';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, 61, 21);
      ctx.fillStyle = fg;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 32, 13);
    });

  const cobblePlaza = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#ddd3be';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#c4b89c';
      for (let y = 0; y < 32; y += 8) {
        ctx.fillRect(0, y, 32, 1);
        for (let x = (y % 16 === 0 ? 0 : 4); x < 32; x += 8) ctx.fillRect(x, y, 1, 8);
      }
      ctx.fillStyle = '#ece3d0';
      ctx.fillRect(2, 2, 5, 5);
      ctx.fillRect(18, 10, 5, 5);
      ctx.fillRect(10, 26, 5, 5);
    },
    13,
    13,
  );

  const drawRoadCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#5c6472';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#d7d0be';
    ctx.fillRect(0, 0, 32, 3);
    ctx.fillRect(0, 29, 32, 3);
    ctx.fillStyle = '#8b93a1';
    ctx.fillRect(0, 3, 32, 1);
    ctx.fillRect(0, 28, 32, 1);
    ctx.fillStyle = '#f5ecd4';
    ctx.fillRect(3, 15, 10, 2);
    ctx.fillRect(19, 15, 10, 2);
  };

  // 1. Grand 8-Lane City Boulevard with Extra-Wide Promenade Sidewalks (y=0..18, y=110..128), 4+4 Lanes & Central Green Median!
  const boulevard4Lane = makePixelTex(
    128,
    128,
    (ctx) => {
      // Extra-Wide Paved Pedestrian Promenade Sidewalks (~6.5m each side!) with tactile paving & tile seams
      ctx.fillStyle = '#e0d8c8';
      ctx.fillRect(0, 0, 128, 19);
      ctx.fillRect(0, 109, 128, 19);
      ctx.fillStyle = '#c8bfb0';
      for (let x = 0; x < 128; x += 16) {
        ctx.fillRect(x, 0, 1, 19);
        ctx.fillRect(x, 109, 1, 19);
      }
      ctx.fillStyle = '#f2cc5a'; // tactile pedestrian guide strip along wide sidewalk
      ctx.fillRect(0, 9, 128, 2);
      ctx.fillRect(0, 117, 128, 2);
      // Curb stones
      ctx.fillStyle = '#8b92a0';
      ctx.fillRect(0, 18, 128, 2);
      ctx.fillRect(0, 108, 128, 2);

      // 8-Lane Asphalt Roadbed (y=20..108)
      ctx.fillStyle = '#4a5260';
      ctx.fillRect(0, 20, 128, 88);
      ctx.fillStyle = '#424956';
      for (let i = 0; i < 85; i++) {
        ctx.fillRect((i * 23) % 125, 21 + ((i * 17) % 85), 2, 1);
      }

      // 4 Lanes each direction (dashed white dividers)
      ctx.fillStyle = '#f1f3f5';
      for (let x = 6; x < 128; x += 26) {
        ctx.fillRect(x, 29, 14, 2);
        ctx.fillRect(x, 38, 14, 2);
        ctx.fillRect(x, 47, 14, 2);
        ctx.fillRect(x, 79, 14, 2);
        ctx.fillRect(x, 88, 14, 2);
        ctx.fillRect(x, 97, 14, 2);
      }

      // Lush Central Green Median Strip (y=57..71) with clean double yellow curbs + lush pixel grass tufts!
      ctx.fillStyle = '#fcc419';
      ctx.fillRect(0, 56, 128, 2);
      ctx.fillRect(0, 70, 128, 2);
      ctx.fillStyle = '#37a84f';
      ctx.fillRect(0, 58, 128, 12);
      ctx.fillStyle = '#51cf66';
      ctx.fillRect(8, 60, 18, 3);
      ctx.fillRect(58, 64, 22, 3);
      ctx.fillRect(96, 60, 16, 3);
      ctx.fillStyle = '#2b8a3e';
      ctx.fillRect(30, 62, 10, 3);
      ctx.fillRect(84, 61, 10, 3);
    },
    1,
    1,
  );

  // 2. 4-Lane Collector Avenue with Extra-Wide Sidewalks (y=0..12, y=52..64), Green Verges, 4 Lanes & Double Yellow Center Line!
  const collector2Lane = makePixelTex(
    64,
    64,
    (ctx) => {
      // Wide Pedestrian Sidewalks (~4.5m each side!)
      ctx.fillStyle = '#dfd7c6';
      ctx.fillRect(0, 0, 64, 12);
      ctx.fillRect(0, 52, 64, 12);
      ctx.fillStyle = '#c8bfb0';
      for (let x = 0; x < 64; x += 16) {
        ctx.fillRect(x, 0, 1, 12);
        ctx.fillRect(x, 52, 1, 12);
      }
      // Roadside planting strip
      ctx.fillStyle = '#40b058';
      ctx.fillRect(0, 11, 64, 3);
      ctx.fillRect(0, 50, 64, 3);
      ctx.fillStyle = '#8b93a1';
      ctx.fillRect(0, 14, 64, 1);
      ctx.fillRect(0, 49, 64, 1);
      // 4-Lane Asphalt (y=15..49)
      ctx.fillStyle = '#505866';
      ctx.fillRect(0, 15, 64, 34);
      // Dashed white lane dividers (2 lanes each side)
      ctx.fillStyle = '#f1f3f5';
      for (let x = 4; x < 64; x += 22) {
        ctx.fillRect(x, 22, 11, 2);
        ctx.fillRect(x, 40, 11, 2);
      }
      // Crisp double yellow center divider
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(0, 30, 64, 1);
      ctx.fillRect(0, 33, 64, 1);
    },
    1,
    1,
  );

  // 3. Cozy Pedestrian Cobblestone Alley with Planter Curbs!
  const alleyCobble = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#c8beaa';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#45a858';
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillStyle = '#b4a992';
      for (let y = 4; y < 28; y += 6) {
        for (let x = (y % 12 === 4 ? 0 : 4); x < 32; x += 8) {
          ctx.fillRect(x, y, 6, 4);
        }
      }
      ctx.fillStyle = '#dfd7c6';
      for (let y = 5; y < 27; y += 6) {
        ctx.fillRect(2, y, 3, 2);
        ctx.fillRect(18, y, 3, 2);
      }
    },
    1,
    1,
  );

  // 4. Clean Asphalt Intersection Pad with Crisp White Zebra Crosswalks on all 4 Approaches (ZERO overlapping curbs!)
  const junctionAsphalt = makePixelTex(
    64,
    64,
    (ctx) => {
      ctx.fillStyle = '#4c5462';
      ctx.fillRect(0, 0, 64, 64);
      // Subtle intersection corner stone aprons
      ctx.fillStyle = '#d7d0be';
      ctx.fillRect(0, 0, 7, 7);
      ctx.fillRect(57, 0, 7, 7);
      ctx.fillRect(0, 57, 7, 7);
      ctx.fillRect(57, 57, 7, 7);
      // Crisp white zebra crosswalk stripes on North, South, East, West edges!
      ctx.fillStyle = '#f8f9fa';
      for (let i = 11; i <= 50; i += 6) {
        ctx.fillRect(i, 2, 3, 7);   // North crosswalk
        ctx.fillRect(i, 55, 3, 7);  // South crosswalk
        ctx.fillRect(2, i, 7, 3);   // West crosswalk
        ctx.fillRect(55, i, 7, 3);  // East crosswalk
      }
      // Stop lines
      ctx.fillStyle = '#dee2e6';
      ctx.fillRect(11, 11, 42, 1);
      ctx.fillRect(11, 52, 42, 1);
      ctx.fillRect(11, 11, 1, 42);
      ctx.fillRect(52, 11, 1, 42);
    },
    1,
    1,
  );

  const roadTile = makePixelTex(32, 32, drawRoadCanvas, 12, 1);
  const highwayTile = makePixelTex(32, 32, drawRoadCanvas, 1, 1);

  const crosswalk = makePixelTex(32, 32, (ctx) => {
    ctx.fillStyle = '#5c6472';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#faf6eb';
    for (let y = 4; y < 28; y += 6) ctx.fillRect(4, y, 24, 3);
  });

  const busSign = makePixelTex(32, 32, (ctx) => {
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#1b1f2a';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 29, 29);
    ctx.fillStyle = '#1b1f2a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUS', 16, 16);
  });

  const clinicFloor = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#fff5f5';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#ffe3e3';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillRect(16, 16, 16, 16);
      ctx.fillStyle = '#ffc9c9';
      ctx.fillRect(0, 15, 32, 1);
      ctx.fillRect(15, 0, 1, 32);
    },
    5,
    5,
  );

  const martFloor = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#f1f7fe';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#dbeeff';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillRect(16, 16, 16, 16);
      ctx.fillStyle = '#a5d8ff';
      ctx.fillRect(0, 15, 32, 1);
      ctx.fillRect(15, 0, 1, 32);
    },
    5,
    5,
  );

  const woodFloor = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#d4a373';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#bc8a5f';
      for (let y = 0; y < 32; y += 8) ctx.fillRect(0, y, 32, 2);
      ctx.fillStyle = '#e6ccb2';
      ctx.fillRect(2, 3, 12, 3);
      ctx.fillRect(18, 11, 12, 3);
    },
    4,
    4,
  );

  CACHED_GROUND_TEX = {
    cobblePlaza,
    roadTile,
    boulevard4Lane,
    collector2Lane,
    alleyCobble,
    junctionAsphalt,
    highwayTile,
    crosswalk,
    martSign: makeSign('#1971c2', 'MART'),
    hotelSign: makeSign('#f08c00', 'HOTEL'),
    cafeSign: makeSign('#d9480f', 'CAFE'),
    extraSigns: [
      makeSign('#2b8a3e', 'TEA'),
      makeSign('#c2255c', 'BAKERY'),
      makeSign('#5f3dc4', 'BOOKS'),
      makeSign('#e67700', 'RAMEN'),
      makeSign('#0b7285', 'FLOWER'),
      makeSign('#a61e4d', 'INN'),
    ],
    busSign,
    clinicFloor,
    martFloor,
    woodFloor,
  };
  return CACHED_GROUND_TEX;
}

/**
 * ICONIC WORLD CITY LANDMARKS (东方明珠 / 东京晴空塔 / 广州小蛮腰 / 北京祈年殿 / 京都五重塔)!
 */
export function buildWorldLandmark3D(cityId: string): THREE.Group | null {
  const g = new THREE.Group();
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x161922, side: THREE.BackSide });
  const addPiece = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    const out = new THREE.Mesh(geo, outlineMat);
    out.scale.set(1.035, 1.02, 1.035);
    m.add(out);
    return m;
  };

  if (cityId === 'shanghai') {
    // 🗼 上海东方明珠广播电视塔 (Oriental Pearl Tower)
    const silverMat = new THREE.MeshLambertMaterial({ color: 0xe9ecef });
    const pearlMat = new THREE.MeshLambertMaterial({ color: 0xf06595, emissive: 0x6b1438 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b, emissive: 0x664d00 });
    // Base pedestal
    addPiece(new THREE.CylinderGeometry(5.2, 6.2, 1.4, 12), silverMat, 0, 0.7, 0);
    // 3 slanted support legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addPiece(new THREE.CylinderGeometry(0.45, 0.7, 13, 8), silverMat, Math.cos(a) * 3.1, 6.2, Math.sin(a) * 3.1, Math.sin(a) * 0.24, 0, -Math.cos(a) * 0.24);
      addPiece(new THREE.CylinderGeometry(0.42, 0.42, 26, 8), silverMat, Math.cos(a) * 1.4, 14.0, Math.sin(a) * 1.4);
    }
    // Lower Giant Ruby-Pink Pearl Sphere
    addPiece(new THREE.SphereGeometry(4.4, 16, 12), pearlMat, 0, 12.2, 0);
    // Upper Observation Pearl Sphere
    addPiece(new THREE.SphereGeometry(3.2, 16, 12), pearlMat, 0, 26.5, 0);
    // Space Capsule & Broadcast Spire
    addPiece(new THREE.SphereGeometry(1.45, 12, 10), goldMat, 0, 34.5, 0);
    addPiece(new THREE.CylinderGeometry(0.14, 0.45, 10.5, 8), silverMat, 0, 39.8, 0);
    return g;
  }

  if (cityId === 'tokyo') {
    // 🗼 东京晴空塔 (Tokyo Skytree)
    const skyWhite = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const deckGlow = new THREE.MeshLambertMaterial({ color: 0x4dabf7, emissive: 0x1864ab });
    addPiece(new THREE.CylinderGeometry(3.8, 5.8, 12, 6), skyWhite, 0, 6.0, 0);
    addPiece(new THREE.CylinderGeometry(2.2, 3.8, 14, 8), skyWhite, 0, 19.0, 0);
    // Tembo Deck (350m ring)
    addPiece(new THREE.CylinderGeometry(3.7, 3.3, 2.6, 12), deckGlow, 0, 24.5, 0);
    addPiece(new THREE.CylinderGeometry(1.3, 2.2, 12, 10), skyWhite, 0, 31.5, 0);
    // Tembo Galleria (450m ring)
    addPiece(new THREE.CylinderGeometry(2.5, 2.3, 1.8, 12), deckGlow, 0, 34.5, 0);
    // Spire antenna
    addPiece(new THREE.CylinderGeometry(0.15, 0.75, 10.5, 8), skyWhite, 0, 41.5, 0);
    return g;
  }

  if (cityId === 'guangzhou') {
    // 🗼 广州塔·小蛮腰 (Canton Tower - iconic pinched hyperboloid waist + rainbow rings!)
    const steelMat = new THREE.MeshLambertMaterial({ color: 0xe5dbff });
    const ringColors = [0xf06595, 0x9775fa, 0x4dabf7, 0x63e6be, 0xffd43b];
    // Lower flared base cone + pinched waist + upper flared crown
    addPiece(new THREE.CylinderGeometry(1.9, 5.2, 16, 12), steelMat, 0, 8.0, 0);
    addPiece(new THREE.CylinderGeometry(3.6, 1.9, 17, 12), steelMat, 0, 24.5, 0);
    // Glowing LED waist rings
    ringColors.forEach((hex, idx) => {
      const y = 6 + idx * 6.4;
      const r = idx === 2 ? 2.15 : idx === 1 || idx === 3 ? 2.95 : 4.1;
      addPiece(
        new THREE.CylinderGeometry(r, r, 0.55, 14),
        new THREE.MeshBasicMaterial({ color: hex }),
        0,
        y,
        0,
      );
    });
    // Top antenna mast
    addPiece(new THREE.CylinderGeometry(0.14, 0.65, 11.0, 8), steelMat, 0, 38.0, 0);
    return g;
  }

  if (cityId === 'beijing') {
    // 🏯 北京祈年殿 (Temple of Heaven - 3-tier royal sapphire-blue roof on white marble terrace!)
    const marbleMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
    const crimsonMat = new THREE.MeshLambertMaterial({ color: 0xc92a2a });
    const royalBlue = new THREE.MeshLambertMaterial({ color: 0x1864ab, emissive: 0x0b2e59 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    addPiece(new THREE.CylinderGeometry(7.6, 8.2, 1.4, 16), marbleMat, 0, 0.7, 0);
    addPiece(new THREE.CylinderGeometry(6.4, 6.9, 1.2, 16), marbleMat, 0, 2.0, 0);
    addPiece(new THREE.CylinderGeometry(5.0, 5.0, 4.4, 14), crimsonMat, 0, 4.8, 0);
    addPiece(new THREE.CylinderGeometry(4.2, 6.8, 2.2, 16), royalBlue, 0, 7.8, 0);
    addPiece(new THREE.CylinderGeometry(3.6, 3.6, 2.8, 14), crimsonMat, 0, 10.0, 0);
    addPiece(new THREE.CylinderGeometry(2.8, 5.4, 2.2, 16), royalBlue, 0, 12.2, 0);
    addPiece(new THREE.CylinderGeometry(2.2, 2.2, 2.2, 14), crimsonMat, 0, 14.0, 0);
    addPiece(new THREE.ConeGeometry(4.2, 3.4, 16), royalBlue, 0, 16.7, 0);
    addPiece(new THREE.SphereGeometry(0.75, 10, 8), goldMat, 0, 18.8, 0);
    return g;
  }

  if (cityId === 'kyoto') {
    // ⛩️ 京都五重樱花古塔 (Five-Story Pagoda)
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xfff4e6 });
    const vermilion = new THREE.MeshLambertMaterial({ color: 0xc92a2a });
    const slateRoof = new THREE.MeshLambertMaterial({ color: 0x3b4252 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    addPiece(new THREE.BoxGeometry(8.2, 1.4, 8.2), new THREE.MeshLambertMaterial({ color: 0xced4da }), 0, 0.7, 0);
    for (let tier = 0; tier < 5; tier++) {
      const y = 1.4 + tier * 3.6;
      const w = 5.6 - tier * 0.65;
      addPiece(new THREE.BoxGeometry(w, 2.2, w), tier % 2 === 0 ? vermilion : wallMat, 0, y + 1.1, 0);
      const roofGeo = new THREE.ConeGeometry(w * 1.02, 1.6, 4);
      roofGeo.rotateY(Math.PI / 4);
      addPiece(roofGeo, slateRoof, 0, y + 2.9, 0);
    }
    addPiece(new THREE.CylinderGeometry(0.14, 0.28, 4.2, 8), goldMat, 0, 21.8, 0);
    return g;
  }

  return null;
}

/**
 * TERRAIN-ADAPTIVE INTER-TOWN HIGHWAY NETWORK:
 * - Over Water (< WATER_LEVEL_3D): automatically builds an elevated 3D Wooden/Stone Bridge with Guardrails, Support Piers & Lanterns!
 * - Through Tall Mountains (> MOUNTAIN_TUNNEL_TRIGGER_Y): automatically carves & arches a 3D Stone Mountain Tunnel with Portals & Glowing Lamps!
 */
export function buildInterTownRoadNetwork3D(
  getGroundHeight: (x: number, z: number) => number,
  getRawHeight?: (x: number, z: number) => number,
): THREE.Group {
  const tex = getGroundTex();
  const group = new THREE.Group();
  const roadW = 22.0;

  const railWoodMat = new THREE.MeshLambertMaterial({ color: 0x8d5b3a });
  const pierStoneMat = new THREE.MeshLambertMaterial({ color: 0x7c8594 });
  const tunnelStoneMat = new THREE.MeshLambertMaterial({ color: 0x565c69, side: THREE.DoubleSide });
  const tunnelPortalMat = new THREE.MeshLambertMaterial({ color: 0x7a7f8c });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const bridgeDeckTex = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#a47148';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#7f5539';
      for (let x = 0; x < 32; x += 6) ctx.fillRect(x, 0, 2, 32);
      ctx.fillStyle = '#c89b6e';
      ctx.fillRect(0, 2, 32, 2);
      ctx.fillRect(0, 28, 32, 2);
    },
    1,
    1,
  );
  const bridgeDeckMat = new THREE.MeshLambertMaterial({ map: bridgeDeckTex, side: THREE.DoubleSide });

  for (const [ax, az, bx, bz] of WORLD_ROAD_SEGMENTS_3D) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(10, Math.ceil(dist / 3.5));
    const stepLen = dist / steps;
    const dirX = (bx - ax) / dist;
    const dirZ = (bz - az) / dist;
    const headingYaw = Math.atan2(dirX, dirZ);
    const perpX = -dirZ * (roadW * 0.5);
    const perpZ = dirX * (roadW * 0.5);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let prevWasTunnel = false;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      const lx = cx - perpX;
      const lz = cz - perpZ;
      const rx = cx + perpX;
      const rz = cz + perpZ;
      const rawCenter = (getRawHeight ?? getGroundHeight)(cx, cz);
      const groundL = getGroundHeight(lx, lz);
      const groundR = getGroundHeight(rx, rz);
      const groundC = getGroundHeight(cx, cz);

      const isBridge = groundC < WATER_LEVEL_3D + 0.18;
      const isTunnel = rawCenter > MOUNTAIN_TUNNEL_TRIGGER_Y;

      const surfaceY = isBridge
        ? BRIDGE_DECK_Y_3D
        : Math.max(WATER_LEVEL_3D + 0.25, groundC + 0.11);

      // Build flush 3D roadbed (center-leveled top surface + solid retaining curb edges descending -1.5m into ground so ZERO floating air gaps!)
      const yL = isBridge ? surfaceY : Math.max(WATER_LEVEL_3D + 0.25, groundL + 0.11);
      const yR = isBridge ? surfaceY : Math.max(WATER_LEVEL_3D + 0.25, groundR + 0.11);
      positions.push(
        lx, yL - 1.5, lz,   // 0: left retaining base
        lx, yL, lz,         // 1: left curb top
        rx, yR, rz,         // 2: right curb top
        rx, yR - 1.5, rz,   // 3: right retaining base
      );
      const u = (t * dist) / 10.5;
      uvs.push(u, 0, u, 0, u, 1, u, 1);

      if (s < steps) {
        const i0 = s * 4;
        const n0 = (s + 1) * 4;
        // Left concrete curb skirt
        indices.push(i0, n0, i0 + 1, i0 + 1, n0, n0 + 1);
        // Main road surface
        indices.push(i0 + 1, n0 + 1, i0 + 2, i0 + 2, n0 + 1, n0 + 2);
        // Right concrete curb skirt
        indices.push(i0 + 2, n0 + 2, i0 + 3, i0 + 3, n0 + 2, n0 + 3);
      }

      // 1. REAL 3D BRIDGE STRUCTURE OVER WATER (Wooden deck overlay + Guardrails + Stone Piers + Lanterns!)
      if (isBridge && s < steps) {
        const mx = cx + dirX * stepLen * 0.5;
        const mz = cz + dirZ * stepLen * 0.5;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(roadW + 0.4, 0.34, stepLen + 0.35), bridgeDeckMat);
        deck.position.set(mx, BRIDGE_DECK_Y_3D - 0.14, mz);
        deck.rotation.y = headingYaw;
        deck.receiveShadow = true;
        group.add(deck);

        // Left & Right Guardrails
        for (const side of [-1, 1]) {
          const rxOff = -dirZ * side * (roadW * 0.5 + 0.08);
          const rzOff = dirX * side * (roadW * 0.5 + 0.08);
          const railBeam = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, stepLen + 0.2), railWoodMat);
          railBeam.position.set(mx + rxOff, BRIDGE_DECK_Y_3D + 0.95, mz + rzOff);
          railBeam.rotation.y = headingYaw;
          group.add(railBeam);

          const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.15, 0.32), railWoodMat);
          post.position.set(cx + rxOff, BRIDGE_DECK_Y_3D + 0.52, cz + rzOff);
          group.add(post);

          // Stone support piers descending into the lakebed every 2nd span
          if (s % 2 === 0) {
            const pierH = Math.max(2.2, BRIDGE_DECK_Y_3D - groundC + 1.2);
            const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.58, pierH, 8), pierStoneMat);
            pier.position.set(cx + rxOff * 0.85, BRIDGE_DECK_Y_3D - pierH * 0.5 - 0.15, cz + rzOff * 0.85);
            group.add(pier);

            const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), lampGlowMat);
            lantern.position.set(cx + rxOff, BRIDGE_DECK_Y_3D + 1.25, cz + rzOff);
            group.add(lantern);
          }
        }
      }

      // 2. REAL 3D MOUNTAIN TUNNEL ARCHES & STONE PORTALS THROUGH TALL PEAKS!
      if (isTunnel && s < steps) {
        const mx = cx + dirX * stepLen * 0.5;
        const mz = cz + dirZ * stepLen * 0.5;
        // Arched stone tunnel vault spanning overhead (high clearance so player & camera glide cleanly inside!)
        const archRadius = roadW * 0.66;
        const archGeo = new THREE.CylinderGeometry(
          archRadius,
          archRadius,
          stepLen + 0.5,
          10,
          1,
          true,
          0,
          Math.PI,
        );
        // Cylinder axis is Y -> rotate X by PI/2 to align along Z, then Z by -PI/2 so arch opens downward over road!
        archGeo.rotateZ(Math.PI / 2);
        archGeo.rotateY(Math.PI / 2);
        const vault = new THREE.Mesh(archGeo, tunnelStoneMat);
        vault.position.set(mx, surfaceY + 0.4, mz);
        vault.rotation.y = headingYaw;
        group.add(vault);

        // Heavy stone portal arch ring at tunnel entrance & interior warm ceiling lanterns!
        if (!prevWasTunnel || s % 3 === 0) {
          const ringGeo = new THREE.TorusGeometry(archRadius + 0.18, !prevWasTunnel ? 0.65 : 0.35, 6, 12, Math.PI);
          const ring = new THREE.Mesh(ringGeo, tunnelPortalMat);
          ring.position.set(cx, surfaceY + 0.4, cz);
          ring.rotation.y = headingYaw;
          group.add(ring);

          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), lampGlowMat);
          lamp.position.set(mx, surfaceY + archRadius - 0.15, mz);
          group.add(lamp);
        }
      }
      prevWasTunnel = isTunnel;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      map: tex.collector2Lane,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 3. INTER-CITY HIGH-SPEED RAIL / METRO CORRIDORS (linking Shanghai, Beijing, Guangzhou, Tokyo & Kyoto with viaduct piers over water!)
  const railTrackTex = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#737985'; // gravel ballast bed
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#5b4b3e'; // rail sleepers
      for (let x = 2; x < 32; x += 8) ctx.fillRect(x, 4, 3, 24);
      ctx.fillStyle = '#dee2e6'; // twin steel rails
      ctx.fillRect(0, 7, 32, 2);
      ctx.fillRect(0, 14, 32, 2);
      ctx.fillRect(0, 18, 32, 2);
      ctx.fillRect(0, 25, 32, 2);
    },
    1,
    1,
  );
  const railMat = new THREE.MeshLambertMaterial({ map: railTrackTex, side: THREE.DoubleSide });
  const railW = 7.4;

  for (const [ax, az, bx, bz] of WORLD_RAIL_SEGMENTS_3D) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(12, Math.ceil(dist / 6.0));
    const dirX = (bx - ax) / dist;
    const dirZ = (bz - az) / dist;
    const perpX = -dirZ * (railW * 0.5);
    const perpZ = dirX * (railW * 0.5);
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      const gC = getGroundHeight(cx, cz);
      const isViaduct = gC < WATER_LEVEL_3D + 0.35;
      const sy = isViaduct ? BRIDGE_DECK_Y_3D + 0.45 : Math.max(WATER_LEVEL_3D + 0.3, gC + 0.16);
      positions.push(cx - perpX, sy, cz - perpZ, cx + perpX, sy, cz + perpZ);
      const u = (t * dist) / 7.0;
      uvs.push(u, 0, u, 1);
      if (s < steps) {
        const i0 = s * 2;
        indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
      if (isViaduct && s % 2 === 0) {
        const pierH = Math.max(2.6, sy - gC + 1.2);
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, pierH, 8), pierStoneMat);
        pier.position.set(cx, sy - pierH * 0.5 - 0.1, cz);
        group.add(pier);
      }
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    rGeo.setIndex(indices);
    rGeo.computeVertexNormals();
    const rMesh = new THREE.Mesh(rGeo, railMat);
    rMesh.receiveShadow = true;
    group.add(rMesh);
  }

  return group;
}

function createPokeballBeacon(radius = 1.15): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: 0xfa5252 }),
  );
  const bot = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, radius * 0.18, 14),
    new THREE.MeshBasicMaterial({ color: 0x181a24 }),
  );
  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, radius * 0.24, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff9db }),
  );
  btn.rotation.x = Math.PI / 2;
  btn.position.z = radius * 0.92;
  g.add(top, bot, belt, btn);
  return g;
}

/**
 * Refined Monumental Marble Civic Fountain (tiered octagonal stone basins, turquoise shimmering water,
 * warm gold finial & graceful animated water arcs — centered in the Grand City Plaza!)
 */
function createPlazaFountain(fountains: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const marbleLight = new THREE.MeshLambertMaterial({ color: 0xf1ece1 });
  const marbleTrim = new THREE.MeshLambertMaterial({ color: 0xd8cfc0 });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419, emissive: 0x5c4300 });
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x3bc9db,
    emissive: 0x1098ad,
    transparent: true,
    opacity: 0.88,
  });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe3fafc,
    transparent: true,
    opacity: 0.85,
  });

  // Stepped octagonal outer stone coping & seating rim
  const stepBase = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.0, 0.36, 8), marbleTrim);
  stepBase.position.y = 0.18;
  stepBase.receiveShadow = true;
  const basinWall = new THREE.Mesh(new THREE.CylinderGeometry(4.95, 5.2, 0.82, 8), marbleLight);
  basinWall.position.y = 0.72;
  const poolWater = new THREE.Mesh(new THREE.CylinderGeometry(4.45, 4.45, 0.14, 16), waterMat);
  poolWater.position.y = 1.08;
  g.add(stepBase, basinWall, poolWater);

  // Sculpted central pedestal + mid tier scalloped bowl + upper golden finial
  const lowerPed = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, 1.9, 8), marbleLight);
  lowerPed.position.y = 1.95;
  const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 1.15, 0.58, 8), marbleTrim);
  midBowl.position.y = 3.05;
  const midWater = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.12, 12), waterMat);
  midWater.position.y = 3.36;
  const upperPed = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.85, 1.65, 8), marbleLight);
  upperPed.position.y = 4.15;
  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.52, 0.42, 8), marbleTrim);
  topBowl.position.y = 5.05;
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), goldMat);
  finial.position.y = 5.65;
  g.add(lowerPed, midBowl, midWater, upperPed, topBowl, finial);

  // Delicate animated sparkling water jets rising directly from the upper bowl + 4 graceful cascading arcs!
  const jetGroup = new THREE.Group();
  const innerSpray = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.34, 0.95, 8), foamMat);
  innerSpray.position.y = 5.42;
  jetGroup.add(innerSpray);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), foamMat);
    droplet.position.set(Math.cos(a) * 0.48, 5.75 + (i % 2) * 0.25, Math.sin(a) * 0.48);
    jetGroup.add(droplet);
  }
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.11, 6, 12, Math.PI * 0.65), foamMat);
    arc.position.set(Math.cos(ang) * 1.45, 2.15, Math.sin(ang) * 1.45);
    arc.rotation.y = -ang;
    arc.rotation.z = -0.3;
    jetGroup.add(arc);
  }
  g.add(jetGroup);
  fountains.push(jetGroup);

  return g;
}

function buildPokemonCenterInterior(
  tex: TownGroundTex,
  w: number,
  d: number,
): { group: THREE.Group; npcs: THREE.Mesh[] } {
  const g = new THREE.Group();
  const npcs: THREE.Mesh[] = [];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ map: tex.clinicFloor }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.13;
  floor.receiveShadow = true;
  g.add(floor);

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 16),
    new THREE.MeshBasicMaterial({ color: 0xff8787 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.15, 0.8);
  g.add(rug);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.56, 1.35, 1.45),
    new THREE.MeshLambertMaterial({ color: 0xf8f9fa }),
  );
  counter.position.set(0, 0.72, -d * 0.24);
  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.59, 0.22, 1.65),
    new THREE.MeshLambertMaterial({ color: 0xfa5252 }),
  );
  counterTop.position.set(0, 1.45, -d * 0.24);
  g.add(counter, counterTop);

  const machine = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.8, 0.9),
    new THREE.MeshLambertMaterial({ color: 0xe9ecef }),
  );
  machine.position.set(-2.3, 0.95, -d * 0.38);
  g.add(machine);
  const slotMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  for (let i = 0; i < 6; i++) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), slotMat);
    ball.position.set(-2.8 + (i % 3) * 0.5, 1.95, -d * 0.38 + (i >= 3 ? 0.22 : -0.22));
    g.add(ball);
  }

  const sofaMat = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
  for (const sx of [-w * 0.34, w * 0.34]) {
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 3.4), sofaMat);
    sofa.position.set(sx, 0.52, 1.0);
    g.add(sofa);
  }

  const nurse = createNpcBillboard('/sprites/trainers/nurse-ow.png', 0, 0.15, -d * 0.32, 2.45);
  const guest = createNpcBillboard('/sprites/trainers/lass-ow.png', w * 0.24, 0.15, 1.3, 2.35);
  g.add(nurse, guest);
  npcs.push(nurse, guest);

  // Clear glowing welcome mat marking the Front Doorway entrance!
  const matMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xff6b6b }),
  );
  matMesh.rotation.x = -Math.PI / 2;
  matMesh.position.set(0, 0.17, d * 0.5 + 0.55);
  g.add(matMesh);

  return { group: g, npcs };
}

function buildPokeMartInterior(
  tex: TownGroundTex,
  w: number,
  d: number,
): { group: THREE.Group; npcs: THREE.Mesh[] } {
  const g = new THREE.Group();
  const npcs: THREE.Mesh[] = [];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ map: tex.martFloor }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.13;
  floor.receiveShadow = true;
  g.add(floor);

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.44, 1.35, 1.35),
    new THREE.MeshLambertMaterial({ color: 0x1c7ed6 }),
  );
  counter.position.set(-w * 0.16, 0.72, -d * 0.24);
  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.47, 0.2, 1.5),
    new THREE.MeshLambertMaterial({ color: 0xf8f9fa }),
  );
  counterTop.position.set(-w * 0.16, 1.44, -d * 0.24);
  g.add(counter, counterTop);

  const shelfMat = new THREE.MeshLambertMaterial({ color: 0xe9ecef });
  const itemColors = [0xfa5252, 0x339af0, 0x51cf66, 0xfcc419];
  for (let s = 0; s < 2; s++) {
    const sx = w * 0.26;
    const sz = -1.6 + s * 3.0;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 0.9), shelfMat);
    shelf.position.set(sx, 0.95, sz);
    g.add(shelf);
    for (let k = 0; k < 4; k++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshLambertMaterial({ color: itemColors[(k + s) % itemColors.length] }),
      );
      box.position.set(sx - 1.05 + k * 0.7, 2.05, sz);
      g.add(box);
    }
  }

  const clerk = createNpcBillboard('/sprites/trainers/erika-ow.png', -w * 0.16, 0.15, -d * 0.32, 2.45);
  const shopper = createNpcBillboard('/sprites/trainers/blue-ow.png', w * 0.16, 0.15, 0.5, 2.45);
  g.add(clerk, shopper);
  npcs.push(clerk, shopper);

  const matMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x339af0 }),
  );
  matMesh.rotation.x = -Math.PI / 2;
  matMesh.position.set(0, 0.17, d * 0.5 + 0.55);
  g.add(matMesh);

  return { group: g, npcs };
}

function buildTownHouseInterior(
  tex: TownGroundTex,
  w: number,
  d: number,
): { group: THREE.Group; npcs: THREE.Mesh[] } {
  const g = new THREE.Group();
  const npcs: THREE.Mesh[] = [];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ map: tex.woodFloor }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.13;
  floor.receiveShadow = true;
  g.add(floor);

  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xf08c00 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.15, 0);
  g.add(rug);

  const table = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.0, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x8d5b4c }),
  );
  table.position.set(0, 0.55, 0.4);
  g.add(table);

  const resident = createNpcBillboard('/sprites/trainers/youngster-ow.png', 1.8, 0.15, 1.4, 2.38);
  g.add(resident);
  npcs.push(resident);

  const matMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.4),
    new THREE.MeshBasicMaterial({ color: 0xfcc419 }),
  );
  matMesh.rotation.x = -Math.PI / 2;
  matMesh.position.set(0, 0.17, d * 0.5 + 0.5);
  g.add(matMesh);

  return { group: g, npcs };
}

const DIVERSE_HOUSE_STYLES: {
  url: string;
  heightMult: number;
  isFlatUrban: boolean;
}[] = [
  // Pitched-roof cozy cottages & villas
  { url: '/models/town/suburban/house-a.glb', heightMult: 1.24, isFlatUrban: false },
  { url: '/models/town/suburban/house-c.glb', heightMult: 1.32, isFlatUrban: false },
  { url: '/models/town/suburban/house-f.glb', heightMult: 1.20, isFlatUrban: false },
  { url: '/models/town/suburban/house-i.glb', heightMult: 1.36, isFlatUrban: false },
  { url: '/models/town/suburban/house-l.glb', heightMult: 1.28, isFlatUrban: false },
  { url: '/models/town/suburban/house-o.glb', heightMult: 1.18, isFlatUrban: false },
  // Flat-roof modern townhouses, corner shops & multi-story urban apartments!
  { url: '/models/town/commercial/shop-a.glb', heightMult: 1.34, isFlatUrban: true },
  { url: '/models/town/commercial/shop-d.glb', heightMult: 1.46, isFlatUrban: true },
  { url: '/models/town/commercial/shop-g.glb', heightMult: 1.54, isFlatUrban: true },
  { url: '/models/town/commercial/mart-boutique.glb', heightMult: 1.38, isFlatUrban: true },
];

const FACADE_TINT_PALETTE: (number | undefined)[] = [
  undefined,   // crisp original palette
  0xfff3d6,    // warm sunlit cream
  0xffd8cc,    // terracotta coral
  0xd0ebff,    // coastal sky blue
  0xd3f9d8,    // sage mint green
  0xffec99,    // honey ochre
  0xfcc2d7,    // sakura rose
  0xdee2e6,    // modern slate white
];

const SHOP_POOL = [
  '/models/town/commercial/mart-boutique.glb',
  '/models/town/commercial/shop-a.glb',
  '/models/town/commercial/shop-d.glb',
  '/models/town/commercial/shop-g.glb',
];

/** Helper: builds a terrain-hugging street ribbon mesh along a single street segment with clean layered Y-offset (zero Z-fighting!) */
function buildStreetRibbonMesh(
  seg: TownStreetSeg,
  baseY: number,
  originX: number,
  originZ: number,
  tex: THREE.CanvasTexture,
  getGroundHeight: (x: number, z: number) => number,
  layerLiftY = 0.12,
  polyOffsetFactor = -1,
): THREE.Mesh {
  const dist = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const steps = Math.max(4, Math.ceil(dist / 3.2));
  const dirX = (seg.x2 - seg.x1) / Math.max(0.01, dist);
  const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, dist);
  const wStart = seg.widthStart ?? seg.width;
  const wEnd = seg.widthEnd ?? seg.width;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const curHalfW = (wStart + (wEnd - wStart) * t) * 0.5;
    const perpX = -dirZ * curHalfW;
    const perpZ = dirX * curHalfW;
    const wx = seg.x1 + (seg.x2 - seg.x1) * t;
    const wz = seg.z1 + (seg.z2 - seg.z1) * t;
    const lx = wx - perpX;
    const lz = wz - perpZ;
    const rx = wx + perpX;
    const rz = wz + perpZ;
    // Hug the exact graded terrain across left / center / right so characters ALWAYS stand squarely on asphalt (ZERO floating air gaps!)
    // plus solid -1.5m concrete curb skirts along both outer sidewalk edges!
    const yL = Math.max(WATER_LEVEL_3D + 0.2, getGroundHeight(lx, lz) + layerLiftY) - baseY;
    const yC = Math.max(WATER_LEVEL_3D + 0.2, getGroundHeight(wx, wz) + layerLiftY) - baseY;
    const yR = Math.max(WATER_LEVEL_3D + 0.2, getGroundHeight(rx, rz) + layerLiftY) - baseY;
    positions.push(
      lx - originX, yL - 1.4, lz - originZ, // 0: left curb skirt bottom
      lx - originX, yL, lz - originZ,       // 1: left sidewalk edge
      wx - originX, yC, wz - originZ,       // 2: road centerline
      rx - originX, yR, rz - originZ,       // 3: right sidewalk edge
      rx - originX, yR - 1.4, rz - originZ, // 4: right curb skirt bottom
    );
    const u = (t * dist) / (seg.kind === 'arterial' ? 16.5 : 10.5);
    uvs.push(u, 0, u, 0, u, 0.5, u, 1, u, 1);
    if (s < steps) {
      const i0 = s * 5;
      const n0 = (s + 1) * 5;
      // Left retaining curb wall
      indices.push(i0, n0, i0 + 1, i0 + 1, n0, n0 + 1);
      // Left carriageway half
      indices.push(i0 + 1, n0 + 1, i0 + 2, i0 + 2, n0 + 1, n0 + 2);
      // Right carriageway half
      indices.push(i0 + 2, n0 + 2, i0 + 3, i0 + 3, n0 + 2, n0 + 3);
      // Right retaining curb wall
      indices.push(i0 + 3, n0 + 3, i0 + 4, i0 + 4, n0 + 3, n0 + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({
      map: tex,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: polyOffsetFactor,
      polygonOffsetUnits: polyOffsetFactor,
    }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Assembles an ORGANIC STREET-GRAPH VILLAGE / TOWN (ZERO giant circular pancake!):
 * - Uses L-System branching streets, side lanes, alleys & curved railway from `generateTownLayout`
 * - Natural grass & yards flow organically between houses & parks
 * - 15–18 street-aligned CC0 GLB buildings (Walkable Pokémon Center, Walkable Poké Mart, Hotel, Restaurant, 12+ Houses, Iconic Landmark!)
 */
export function buildProceduralTown3D(
  id: string,
  centerX: number,
  centerZ: number,
  seed: number,
  getGroundHeight: (x: number, z: number) => number,
  customName?: string,
  plazaRadius = 54,
  landmarkCityId?: string,
): ProceduralTownInstance {
  const tex = getGroundTex();
  const group = new THREE.Group();
  const baseY = getGroundHeight(centerX, centerZ);
  group.position.set(centerX, baseY, centerZ);

  const anchor = WORLD_TOWNS_3D.find((t) => t.id === id) ?? {
    id,
    name: customName ?? '上海市',
    x: centerX,
    z: centerZ,
    seed,
    plazaRadius,
    plateauY: baseY,
    landmarkCityId,
  };
  const layout = generateTownLayout(anchor);
  const townName = layout.townName;
  const styleIdx = Math.abs(seed) % 4;
  const isMajorCity = styleIdx === 0 || styleIdx === 2;

  const spinners: THREE.Object3D[] = [];
  const fountains: THREE.Object3D[] = [];
  const billboards: THREE.Mesh[] = [];
  const vehicles: TownMovingVehicle[] = [];
  const walkers: TownStrollingCitizen[] = [];
  const interiors: EnterableBuildingInterior[] = [];
  const interactPoints: TownInteractPoint[] = [];
  const colliders: TownCollider[] = [];

  const localGroundY = (wx: number, wz: number) => getGroundHeight(wx, wz) - baseY;

  // Use our authentic hand-crafted Pixel-Art Trees, Bushes & Flowers for neat avenue & plaza greenery (NO blocky geometric trees!)
  const floraTex = getBiomeTextures('verdant_forest');
  const spawnPixelGreenery = (
    texMap: THREE.Texture,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h * 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({
      map: texMap,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    billboards.push(m);
  };

  // 1. Cities: Skylines Grand 8-Lane Metropolis Road Hierarchy with Neat Pixel-Art Tree Medians & Verges!
  const curbStoneMat = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 });
  const medianGrassMat = new THREE.MeshLambertMaterial({ color: 0x37a84f });

  for (const seg of layout.streets) {
    const roadTex =
      seg.kind === 'arterial'
        ? tex.boulevard4Lane
        : seg.kind === 'street'
          ? tex.collector2Lane
          : tex.alleyCobble;
    // Ultra-flush layered road elevations (+0.04 / +0.06 / +0.08) strictly BELOW intersection pads (+0.10) & Plaza (+0.13)
    // so characters walking at ground + 0.14 ALWAYS stand squarely ON TOP of every road & zero green medians poke into the plaza!
    const liftY = seg.kind === 'arterial' ? 0.08 : seg.kind === 'street' ? 0.06 : 0.04;
    const polyOff = seg.kind === 'arterial' ? -2 : seg.kind === 'street' ? -1 : 0;
    group.add(buildStreetRibbonMesh(seg, baseY, centerX, centerZ, roadTex, getGroundHeight, liftY, polyOff));

    // Neatly spaced Pixel-Art Street Trees & Bushes inside the 8-Lane Central Green Median (strictly outside plaza r >= 36m & clear of junctions!)
    const segLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const dirX = (seg.x2 - seg.x1) / Math.max(0.01, segLen);
    const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, segLen);
    const nx = -dirZ;
    const nz = dirX;
    const angle = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const midX = (seg.x1 + seg.x2) * 0.5;
    const midZ = (seg.z1 + seg.z2) * 0.5;
    const nearJunction = layout.junctions.some((jn) => Math.hypot(jn.x - midX, jn.z - midZ) < 25.0);
    const distFromPlaza = Math.hypot(midX - centerX, midZ - centerZ);

    if (seg.kind === 'arterial' && segLen >= 22 && !nearJunction && distFromPlaza >= 40) {
      const mLen = Math.max(10.0, segLen - 22.0);
      const my = localGroundY(midX, midZ) + 0.09;
      // Low neat curb border for the central green median strip
      const curbBox = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, mLen), curbStoneMat);
      curbBox.position.set(midX - centerX, my + 0.08, midZ - centerZ);
      curbBox.rotation.y = angle;
      const grassBox = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.10, mLen - 0.5), medianGrassMat);
      grassBox.position.set(midX - centerX, my + 0.17, midZ - centerZ);
      grassBox.rotation.y = angle;
      group.add(curbBox, grassBox);

      // Plant neat evenly-spaced hand-drawn Pixel-Art Trees & Bushes right down the median!
      const treeSlots = Math.max(2, Math.floor(mLen / 10));
      for (let ti = 0; ti < treeSlots; ti++) {
        const f = -0.4 + (treeSlots > 1 ? (ti / (treeSlots - 1)) * 0.8 : 0.4);
        const tx = midX + dirX * (f * mLen);
        const tz = midZ + dirZ * (f * mLen);
        if (Math.hypot(tx - centerX, tz - centerZ) < 36) continue;
        const ty = localGroundY(tx, tz) + 0.24;
        const treeTex = floraTex.treeSprites[(ti + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
        spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 5.4, 6.4);
        if (ti < treeSlots - 1) {
          const bx = tx + dirX * (mLen / (treeSlots * 2));
          const bz = tz + dirZ * (mLen / (treeSlots * 2));
          const bushTex = floraTex.bushes[ti % floraTex.bushes.length] ?? floraTex.bush;
          spawnPixelGreenery(bushTex, bx - centerX, localGroundY(bx, bz) + 0.22, bz - centerZ, 2.3, 2.0);
        }
      }
    }

    // Plant neat rows of Pixel-Art Street Trees & Bushes along both green verges of 4-lane Collector Avenues!
    if (seg.kind === 'street' && segLen >= 16) {
      const vergeOff = seg.width * 0.5 - 2.6;
      const treeCount = Math.max(2, Math.floor((segLen - 8) / 11));
      for (let ti = 0; ti < treeCount; ti++) {
        const tFrac = 0.18 + (treeCount > 1 ? (ti / (treeCount - 1)) * 0.64 : 0.32);
        const sx = seg.x1 + dirX * (segLen * tFrac);
        const sz = seg.z1 + dirZ * (segLen * tFrac);
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          const ty = localGroundY(tx, tz) + 0.14;
          const texPick =
            ti % 2 === 0
              ? floraTex.treeSprites[(ti + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite
              : floraTex.bushes[ti % floraTex.bushes.length] ?? floraTex.bush;
          const isTree = ti % 2 === 0;
          spawnPixelGreenery(texPick, tx - centerX, ty, tz - centerZ, isTree ? 4.6 : 2.2, isTree ? 5.4 : 1.9);
        }
      }
    }
  }

  // 1B. Clean Cities: Skylines Asphalt Intersection Pads with Zebra Crosswalks + Real 3D Traffic Lights (红绿灯)!
  const junctionMat = new THREE.MeshLambertMaterial({
    map: tex.junctionAsphalt,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const signalPoleMat = new THREE.MeshLambertMaterial({ color: 0x343a40 });
  const signalBoxMat = new THREE.MeshLambertMaterial({ color: 0x1b1f26 });
  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff4d4f });
  const amberLightMat = new THREE.MeshBasicMaterial({ color: 0xffd43b });
  const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x51cf66 });

  for (const jn of layout.junctions) {
    const padGeo = new THREE.PlaneGeometry(jn.width, jn.depth, 4, 4);
    padGeo.rotateX(-Math.PI / 2);
    const posAttr = padGeo.attributes.position as THREE.BufferAttribute;
    const cosR = Math.cos(jn.rotY);
    const sinR = Math.sin(jn.rotY);
    for (let vi = 0; vi < posAttr.count; vi++) {
      const vx = posAttr.getX(vi);
      const vz = posAttr.getZ(vi);
      const wx = jn.x + vx * cosR + vz * sinR;
      const wz = jn.z - vx * sinR + vz * cosR;
      posAttr.setXYZ(vi, wx - centerX, localGroundY(wx, wz) + 0.10, wz - centerZ);
    }
    padGeo.computeVertexNormals();
    const pad = new THREE.Mesh(padGeo, junctionMat);
    pad.receiveShadow = true;
    group.add(pad);

    // Mount sleek 3D Traffic Signals at corners of major 8-lane boulevard intersections!
    if (jn.width >= 40) {
      const off = jn.width * 0.47;
      for (const [cxS, czS] of [
        [-off, -off],
        [off, off],
      ]) {
        const wx = jn.x + cxS * cosR + czS * sinR;
        const wz = jn.z - cxS * sinR + czS * cosR;
        const sig = new THREE.Group();
        sig.position.set(wx - centerX, localGroundY(wx, wz) + 0.15, wz - centerZ);
        sig.rotation.y = Math.atan2(-cxS, -czS);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6.2, 6), signalPoleMat);
        pole.position.y = 3.1;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.6), signalPoleMat);
        arm.position.set(0, 6.0, 1.7);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.45, 0.45), signalBoxMat);
        head.position.set(0, 5.55, 3.2);
        const rL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), redLightMat);
        rL.position.set(0, 5.95, 3.44);
        const yL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), amberLightMat);
        yL.position.set(0, 5.55, 3.44);
        const gL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), greenLightMat);
        gL.position.set(0, 5.15, 3.44);
        sig.add(pole, arm, head, rL, yL, gL);
        group.add(sig);
      }
    }
  }

    // Grand Spacious Civic Square / Central Plaza (r = 38.5m matching the 68m-wide 8-lane grand boulevards!)
  const hubPlaza = new THREE.Mesh(
    new THREE.CircleGeometry(38.5, 40),
    new THREE.MeshLambertMaterial({
      map: tex.cobblePlaza,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    }),
  );
  hubPlaza.rotation.x = -Math.PI / 2;
  hubPlaza.position.set(0, 0.13, 0);
  hubPlaza.receiveShadow = true;
  group.add(hubPlaza);

  const plazaRim = new THREE.Mesh(
    new THREE.RingGeometry(37.0, 38.8, 40),
    new THREE.MeshLambertMaterial({
      color: 0xe6dfd1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -9,
      polygonOffsetUnits: -9,
    }),
  );
  plazaRim.rotation.x = -Math.PI / 2;
  plazaRim.position.set(0, 0.135, 0);
  group.add(plazaRim);

  const benchWoodMat = new THREE.MeshLambertMaterial({ color: 0x9c6644 });
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.cos(ang) * 16.5;
    const bz = Math.sin(ang) * 16.5;
    const bench = new THREE.Group();
    bench.position.set(bx, 0.22, bz);
    bench.rotation.y = Math.atan2(-bx, -bz);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.26, 1.1), benchWoodMat);
    seat.position.y = 0.56;
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.78, 0.22), benchWoodMat);
    back.position.set(0, 0.96, -0.45);
    bench.add(seat, back);
    group.add(bench);

    // Plaza Corner Pixel-Art Shade Trees & Flowers in stone planters!
    const px = Math.cos(ang) * 24.5;
    const pz = Math.sin(ang) * 24.5;
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.48, 8), curbStoneMat);
    bed.position.set(px, 0.42, pz);
    const bedGrass = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.14, 8), medianGrassMat);
    bedGrass.position.set(px, 0.7, pz);
    group.add(bed, bedGrass);
    const pTreeTex = floraTex.treeSprites[(i + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
    spawnPixelGreenery(pTreeTex, px, 0.74, pz, 6.2, 7.2);
    const flTex = floraTex.flowers[i % floraTex.flowers.length] ?? floraTex.flower;
    spawnPixelGreenery(flTex, px + 1.4, 0.74, pz + 1.0, 1.8, 1.6);
  }

  const fountain = createPlazaFountain(fountains);
  fountain.position.set(0, 0.2, 0);
  group.add(fountain);
  colliders.push(makeObbCollider(centerX, centerZ, 5.4, 5.4, 0, 6.5));

  // 2. Mount ALL Street-Aligned Building Lots from the Procedural Subdivision Graph!
  for (const lot of layout.lots) {
    const lx = lot.x - centerX;
    const lz = lot.z - centerZ;
    const ly = localGroundY(lot.x, lot.z);

    if (lot.kind === 'pokemon_center') {
      const pcExt = new THREE.Group();
      group.add(pcExt);
      const pcModelUrl = isMajorCity
        ? '/models/town/commercial/shop-k.glb'
        : '/models/town/commercial/center-grand.glb';
      void mountGlbModel(pcExt, pcModelUrl, {
        x: lx,
        y: ly,
        z: lz,
        rotY: lot.rotY,
        targetWidth: lot.width,
        heightMult: 1.32,
        addInkEdges: true,
        tintHex: 0xffd6d6,
        cloneMaterials: true,
        onMounted: (wrapper, h) => {
          const beacon = createPokeballBeacon(2.05);
          beacon.position.set(0, h + 1.85, 0);
          wrapper.add(beacon);
          spinners.push(beacon);
        },
      });
      const rW = lot.width * 0.82;
      const rD = lot.depth * 0.80;
      const pcInt = buildPokemonCenterInterior(tex, rW, rD);
      pcInt.group.position.set(lx, ly, lz);
      pcInt.group.rotation.y = lot.rotY;
      pcInt.group.visible = false;
      group.add(pcInt.group);

      const intId = `${lot.id}_int`;
      interiors.push({
        id: intId,
        name: `${townName}·宝可梦中心`,
        kind: 'pokemon_center',
        cx: lot.x,
        cz: lot.z,
        halfW: rW * 0.52,
        halfD: rD * 0.52,
        rotY: lot.rotY,
        bounds: {
          minX: lot.x - rW * 0.56,
          maxX: lot.x + rW * 0.56,
          minZ: lot.z - rD * 0.56,
          maxZ: lot.z + rD * 0.56,
        },
        exteriorGroup: pcExt,
        interiorGroup: pcInt.group,
        npcSprites: pcInt.npcs,
        cutawayAlpha: 1,
      });
      // Solid 4-sided perimeter walls leaving ONLY the front doorway (+Z local) open!
      pushEnterableBuildingWalls(colliders, lot.x, lot.z, rW, rD, lot.rotY, 4.4, 11.5, intId);
      interactPoints.push({
        id: `${id}_pc`,
        townName,
        kind: 'pokemon_center',
        label: `🏥 乔伊小姐 · 宝可梦中心`,
        hint: '全队免费治疗并补满伤药',
        x: lot.x,
        z: lot.z,
        radius: 7.4,
      });
    } else if (lot.kind === 'poke_mart') {
      const mExt = new THREE.Group();
      group.add(mExt);
      const martUrl = SHOP_POOL[styleIdx % SHOP_POOL.length];
      void mountGlbModel(mExt, martUrl, {
        x: lx,
        y: ly,
        z: lz,
        rotY: lot.rotY,
        targetWidth: lot.width,
        heightMult: 1.32,
        addInkEdges: true,
        cloneMaterials: true,
        onMounted: (wrapper, h) => {
          const signMesh = new THREE.Mesh(
            new THREE.BoxGeometry(5.4, 2.0, 0.45),
            new THREE.MeshBasicMaterial({ map: tex.martSign }),
          );
          signMesh.position.set(0, h + 1.15, 3.4);
          wrapper.add(signMesh);
        },
      });
      const rW = lot.width * 0.82;
      const rD = lot.depth * 0.80;
      const mInt = buildPokeMartInterior(tex, rW, rD);
      mInt.group.position.set(lx, ly, lz);
      mInt.group.rotation.y = lot.rotY;
      mInt.group.visible = false;
      group.add(mInt.group);

      const intId = `${lot.id}_int`;
      interiors.push({
        id: intId,
        name: `${townName}·友好商店`,
        kind: 'poke_mart',
        cx: lot.x,
        cz: lot.z,
        halfW: rW * 0.52,
        halfD: rD * 0.52,
        rotY: lot.rotY,
        bounds: {
          minX: lot.x - rW * 0.56,
          maxX: lot.x + rW * 0.56,
          minZ: lot.z - rD * 0.56,
          maxZ: lot.z + rD * 0.56,
        },
        exteriorGroup: mExt,
        interiorGroup: mInt.group,
        npcSprites: mInt.npcs,
        cutawayAlpha: 1,
      });
      pushEnterableBuildingWalls(colliders, lot.x, lot.z, rW, rD, lot.rotY, 4.2, 11.0, intId);
      interactPoints.push({
        id: `${id}_mart`,
        townName,
        kind: 'poke_mart',
        label: `🏪 友好商店店员`,
        hint: '打开精品外观与树果补给商店',
        x: lot.x,
        z: lot.z,
        radius: 7.0,
      });
    } else if (lot.kind === 'hotel') {
      void mountGlbModel(group, '/models/town/commercial/shop-g.glb', {
        x: lx,
        y: ly,
        z: lz,
        rotY: lot.rotY,
        targetWidth: lot.width,
        heightMult: 1.44,
        addInkEdges: true,
        tintHex: 0xfff3d6,
        onMounted: (wrapper, h) => {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(5.6, 2.0, 0.45),
            new THREE.MeshBasicMaterial({ map: tex.hotelSign }),
          );
          sign.position.set(0, h + 1.1, 3.2);
          wrapper.add(sign);
        },
      });
      colliders.push(makeObbCollider(lot.x, lot.z, lot.width * 0.45, lot.depth * 0.44, lot.rotY, 13.5));
      interactPoints.push({
        id: `${id}_hotel`,
        townName,
        kind: 'hotel_rest',
        label: `🏨 ${townName}·驿站酒店`,
        hint: '办理入住休整，全队体力回满并获攻击强化',
        x: lot.doorX,
        z: lot.doorZ,
        radius: 5.8,
      });
    } else if (lot.kind === 'restaurant') {
      void mountGlbModel(group, '/models/town/commercial/shop-d.glb', {
        x: lx,
        y: ly,
        z: lz,
        rotY: lot.rotY,
        targetWidth: lot.width,
        heightMult: 1.32,
        addInkEdges: true,
        tintHex: 0xffd8cc,
        onMounted: (wrapper, h) => {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(5.2, 1.9, 0.42),
            new THREE.MeshBasicMaterial({ map: tex.cafeSign }),
          );
          sign.position.set(0, h + 1.05, 3.0);
          wrapper.add(sign);
        },
      });
      void mountGlbModel(group, '/models/town/commercial/parasol-a.glb', {
        x: lot.doorX - centerX,
        y: localGroundY(lot.doorX, lot.doorZ),
        z: lot.doorZ - centerZ,
        targetWidth: 3.6,
        addInkEdges: true,
      });
      colliders.push(makeObbCollider(lot.x, lot.z, lot.width * 0.45, lot.depth * 0.44, lot.rotY, 12.0));
      interactPoints.push({
        id: `${id}_cafe`,
        townName,
        kind: 'restaurant',
        label: `🍜 ${townName}·树果饭店`,
        hint: '享用热腾腾的树果料理，提升全队斗志',
        x: lot.doorX,
        z: lot.doorZ,
        radius: 5.8,
      });
    } else if (lot.kind === 'landmark' && anchor.landmarkCityId) {
      const lm = buildWorldLandmark3D(anchor.landmarkCityId);
      if (lm) {
        lm.position.set(lx, ly, lz);
        group.add(lm);
        colliders.push(makeObbCollider(lot.x, lot.z, 5.4, 5.4, 0, 26));
      }
    } else if (lot.kind === 'house') {
      // Randomized Architectural Diversity: mix pitched villas, flat-roof modern townhouses, varied facade colors & street signs!
      const hHash = Math.abs(anchor.seed * 19 + lot.houseVariant * 37 + Math.round(lot.x) * 7 + Math.round(lot.z) * 13);
      const styleDef = DIVERSE_HOUSE_STYLES[hHash % DIVERSE_HOUSE_STYLES.length];
      const facadeTint = FACADE_TINT_PALETTE[(hHash >>> 3) % FACADE_TINT_PALETTE.length];
      const attachShopSign = styleDef.isFlatUrban || hHash % 5 === 0;
      const signTex = tex.extraSigns[hHash % tex.extraSigns.length];
      const varHeightMult = styleDef.heightMult * (0.94 + ((hHash % 7) / 6) * 0.16);

      if (lot.walkable) {
        const hExt = new THREE.Group();
        group.add(hExt);
        void mountGlbModel(hExt, styleDef.url, {
          x: lx,
          y: ly,
          z: lz,
          rotY: lot.rotY,
          targetWidth: lot.width,
          heightMult: varHeightMult,
          tintHex: facadeTint,
          addInkEdges: true,
          cloneMaterials: true,
        });
        const rW = lot.width * 0.82;
        const rD = lot.depth * 0.78;
        const hInt = buildTownHouseInterior(tex, rW, rD);
        hInt.group.position.set(lx, ly, lz);
        hInt.group.rotation.y = lot.rotY;
        hInt.group.visible = false;
        group.add(hInt.group);

        const intId = `${lot.id}_int`;
        interiors.push({
          id: intId,
          name: `${townName}·训练家公寓`,
          kind: 'house',
          cx: lot.x,
          cz: lot.z,
          halfW: rW * 0.52,
          halfD: rD * 0.52,
          rotY: lot.rotY,
          bounds: {
            minX: lot.x - rW * 0.56,
            maxX: lot.x + rW * 0.56,
            minZ: lot.z - rD * 0.56,
            maxZ: lot.z + rD * 0.56,
          },
          exteriorGroup: hExt,
          interiorGroup: hInt.group,
          npcSprites: hInt.npcs,
          cutawayAlpha: 1,
        });
        pushEnterableBuildingWalls(colliders, lot.x, lot.z, rW, rD, lot.rotY, 3.8, 10.5, intId);
        interactPoints.push({
          id: `${id}_house_npc`,
          townName,
          kind: 'npc_chat',
          label: `💬 与城市居民交谈`,
          hint: '打听城市地标与野外远行情报',
          dialogText: `🏠 城市居民：「欢迎来到${townName}！沿着东西南北四条大道跨过桥梁与山洞，就能一路远行到北京、广州、东京和京都，每个城市都有专属地标哦！」`,
          x: lot.x,
          z: lot.z,
          radius: 5.5,
        });
      } else {
        void mountGlbModel(group, styleDef.url, {
          x: lx,
          y: ly,
          z: lz,
          rotY: lot.rotY,
          targetWidth: lot.width,
          heightMult: varHeightMult,
          tintHex: facadeTint,
          addInkEdges: true,
          onMounted: attachShopSign
            ? (wrapper, h) => {
                const sign = new THREE.Mesh(
                  new THREE.BoxGeometry(4.4, 1.65, 0.36),
                  new THREE.MeshBasicMaterial({ map: signTex }),
                );
                sign.position.set(0, Math.min(h * 0.72, 6.2), lot.depth * 0.44);
                wrapper.add(sign);
              }
            : undefined,
        });
        colliders.push(makeObbCollider(lot.x, lot.z, lot.width * 0.44, lot.depth * 0.43, lot.rotY, 11.5));
      }
    }
  }

  // 3. Curved Railway Track Segments + Bullet Express Train!
  for (const rl of layout.rail) {
    const segLen = Math.hypot(rl.x2 - rl.x1, rl.z2 - rl.z1);
    const angle = Math.atan2(rl.z2 - rl.z1, rl.x2 - rl.x1);
    const steps = Math.max(2, Math.round(segLen / 6));
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const wx = rl.x1 + (rl.x2 - rl.x1) * t;
      const wz = rl.z1 + (rl.z2 - rl.z1) * t;
      void mountGlbModel(group, '/models/town/train/rail-straight.glb', {
        x: wx - centerX,
        y: localGroundY(wx, wz) + 0.04,
        z: wz - centerZ,
        rotY: -angle + Math.PI / 2,
        targetWidth: 6.4,
      });
    }
  }

  const trainGroup = new THREE.Group();
  trainGroup.position.set(
    layout.stationX - centerX,
    localGroundY(layout.stationX, layout.stationZ) + 0.18,
    layout.stationZ - centerZ,
  );
  trainGroup.rotation.y = layout.stationRotY;
  void mountGlbModel(trainGroup, '/models/town/train/train-bullet-a.glb', {
    x: 5.8,
    y: 0,
    z: 0,
    rotY: Math.PI / 2,
    targetWidth: 11.2,
    addInkEdges: true,
  });
  void mountGlbModel(trainGroup, '/models/town/train/train-bullet-b.glb', {
    x: -5.6,
    y: 0,
    z: 0,
    rotY: Math.PI / 2,
    targetWidth: 11.2,
    addInkEdges: true,
  });
  group.add(trainGroup);

  // 4. Modern Streetcar / Bus Stop & Streetlamps along generated streets!
  void mountGlbModel(group, '/models/town/train/tram-modern.glb', {
    x: layout.busX - centerX,
    y: localGroundY(layout.busX, layout.busZ),
    z: layout.busZ - centerZ,
    rotY: layout.busRotY + Math.PI / 2,
    targetWidth: 9.4,
    addInkEdges: true,
  });
  const streetLampBulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
  for (const lamp of layout.streetLamps) {
    void mountGlbModel(group, '/models/town/roads/lamp-curved.glb', {
      x: lamp.x - centerX,
      y: localGroundY(lamp.x, lamp.z),
      z: lamp.z - centerZ,
      rotY: lamp.rotY,
      targetWidth: 2.5,
      addInkEdges: true,
      onMounted: (wrapper, h) => {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), streetLampBulbMat);
        bulb.position.set(0, h * 0.92, 0.72);
        wrapper.add(bulb);
      },
    });
  }

  // 5. LIVE CITY LIFE: Cruising Pixel-Shaded Taxis/Cars on 8-Lane Boulevards + Strolling Chibi Pixel Citizens + Pixel Vending Machines!
  const carColors = [0x3bc9db, 0xffd43b, 0xfa5252, 0xf8f9fa, 0x339af0, 0x51cf66];
  const carConfigs: { axis: 'x' | 'z'; laneOffset: number; dir: 1 | -1; minC: number; maxC: number; start: number; spd: number }[] = [
    { axis: 'z', laneOffset: 9.5, dir: 1, minC: 35, maxC: 122, start: 54, spd: 11.5 },
    { axis: 'z', laneOffset: -9.5, dir: -1, minC: 35, maxC: 122, start: 96, spd: 13.0 },
    { axis: 'z', laneOffset: 9.5, dir: 1, minC: -122, maxC: -35, start: -88, spd: 12.2 },
    { axis: 'z', laneOffset: -9.5, dir: -1, minC: -122, maxC: -35, start: -52, spd: 10.8 },
    { axis: 'x', laneOffset: 9.5, dir: 1, minC: 35, maxC: 122, start: 68, spd: 11.8 },
    { axis: 'x', laneOffset: -9.5, dir: -1, minC: -122, maxC: -35, start: -74, spd: 12.6 },
  ];
  const headLampMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
  const tailLampMat = new THREE.MeshBasicMaterial({ color: 0xff4d4f });

  carConfigs.forEach((cc, idx) => {
    const carGrp = new THREE.Group();
    const wx = cc.axis === 'x' ? centerX + cc.start : centerX + cc.laneOffset;
    const wz = cc.axis === 'z' ? centerZ + cc.start : centerZ + cc.laneOffset;
    const baseCarY = localGroundY(wx, wz) + 0.16;
    carGrp.position.set(wx - centerX, baseCarY, wz - centerZ);
    const yaw = cc.axis === 'z' ? (cc.dir > 0 ? 0 : Math.PI) : cc.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    carGrp.rotation.y = yaw;
    void mountGlbModel(carGrp, '/models/town/car/taxi.glb', {
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      targetWidth: 4.4,
      tintHex: carColors[(idx + styleIdx) % carColors.length],
      addInkEdges: true,
      cloneMaterials: true,
      onMounted: (wrapper) => {
        for (const sx of [-0.72, 0.72]) {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.14), headLampMat);
          hl.position.set(sx, 0.72, 2.08);
          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.14), tailLampMat);
          tl.position.set(sx, 0.72, -2.08);
          wrapper.add(hl, tl);
        }
      },
    });
    group.add(carGrp);
    vehicles.push({
      group: carGrp,
      axis: cc.axis,
      laneOffset: cc.laneOffset,
      dir: cc.dir,
      minCoord: cc.minC,
      maxCoord: cc.maxC,
      coord: cc.start,
      speed: cc.spd,
      baseY: baseCarY,
    });
  });

  // Strolling Chibi Pixel Citizens around the Grand Central Plaza & Wide Promenade Sidewalks!
  const citizenPool = [
    '/sprites/trainers/youngster-ow.png',
    '/sprites/trainers/lass-ow.png',
    '/sprites/trainers/erika-ow.png',
    '/sprites/trainers/blue-ow.png',
    '/sprites/trainers/misty-ow.png',
    '/sprites/trainers/brock-ow.png',
    '/sprites/trainers/nurse-ow.png',
  ];
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x10141c, transparent: true, opacity: 0.34, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(0.85, 12);
  shadowGeo.rotateX(-Math.PI / 2);

  for (let wi = 0; wi < 7; wi++) {
    const spriteUrl = citizenPool[(wi + styleIdx) % citizenPool.length];
    const orbitR = wi < 4 ? 12.5 + wi * 3.8 : 26.5 + (wi - 4) * 1.4;
    const initAng = (wi / 7) * Math.PI * 2;
    const px = Math.cos(initAng) * orbitR;
    const pz = Math.sin(initAng) * orbitR;
    const py = localGroundY(centerX + px, centerZ + pz) + 0.22;
    const citizenMesh = createNpcBillboard(spriteUrl, px, py, pz, 2.35);
    const cShadow = new THREE.Mesh(shadowGeo, shadowMat);
    cShadow.position.set(px, py + 0.04, pz);
    group.add(citizenMesh, cShadow);
    walkers.push({
      mesh: citizenMesh,
      shadow: cShadow,
      mode: 'plaza_orbit',
      cx: 0,
      cz: 0,
      radius: orbitR,
      angle: initAng,
      speed: (wi % 2 === 0 ? 1 : -1) * (0.14 + (wi % 3) * 0.05),
      phase: wi * 1.3,
      baseY: py,
    });
  }

  // Pixel-Art Street Vending Machines (Poké-Drink!) tucked neatly along the 4 Plaza Entrance Sidewalks!
  const vendFrontTex = makePixelTex(24, 36, (ctx) => {
    ctx.fillStyle = '#e03131';
    ctx.fillRect(0, 0, 24, 36);
    ctx.fillStyle = '#181a24';
    ctx.fillRect(2, 3, 20, 16);
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(3, 4, 18, 14);
    // Tiny colorful drink bottles inside glass display
    const cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#339af0'];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = cols[(c + r) % 4];
        ctx.fillRect(5 + c * 4, 6 + r * 6, 2, 4);
      }
    }
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(4, 21, 16, 3);
    ctx.fillStyle = '#212529';
    ctx.fillRect(4, 27, 16, 6);
  });
  const vendSideMat = new THREE.MeshLambertMaterial({ color: 0xc92a2a });
  const vendFrontMat = new THREE.MeshBasicMaterial({ map: vendFrontTex });
  const vendMats = [vendSideMat, vendSideMat, vendSideMat, vendSideMat, vendFrontMat, vendSideMat];
  for (const [vx, vz, ry] of [
    [-20.5, 34.5, 0],
    [20.5, -34.5, Math.PI],
    [34.5, 20.5, -Math.PI / 2],
    [-34.5, -20.5, Math.PI / 2],
  ]) {
    const vm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 1.0), vendMats);
    vm.position.set(vx, localGroundY(centerX + vx, centerZ + vz) + 1.35, vz);
    vm.rotation.y = ry;
    vm.castShadow = true;
    group.add(vm);
  }

  interactPoints.push(
    {
      id: `${id}_station`,
      townName,
      kind: 'transit_station',
      label: `🚉 ${townName}·高速列车站`,
      hint: '乘坐列车前往世界巡礼与各城道馆',
      x: layout.stationX,
      z: layout.stationZ + 4.0,
      radius: 7.0,
    },
    {
      id: `${id}_bus`,
      townName,
      kind: 'transit_station',
      label: `🚌 ${townName}·城镇巴士站`,
      hint: '乘车前往其他城镇或世界巡礼',
      x: layout.busX,
      z: layout.busZ + 2.6,
      radius: 5.5,
    },
  );

  return {
    id,
    name: townName,
    centerX,
    centerZ,
    safeRadius: layout.boundingRadius,
    group,
    interactPoints,
    colliders,
    interiors,
    trainGroup,
    trainBaseX: trainGroup.position.x,
    animatedParts: {
      spinners,
      fountains,
      billboards,
      vehicles,
      walkers,
    },
  };
}
