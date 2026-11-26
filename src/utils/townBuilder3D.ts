import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  BRIDGE_DECK_Y_3D,
  MOUNTAIN_TUNNEL_TRIGGER_Y,
  WATER_LEVEL_3D,
  WORLD_RAIL_SEGMENTS_3D,
  WORLD_ROAD_SEGMENTS_3D,
  WORLD_TOWNS_3D,
  type WalkableStairAndFloorZone3D,
} from '../data/survivorsTactics';
import { getBiomeTextures, getNpcWalkSpriteFrames } from '../data/worldTextures3D';
import {
  buildUnifiedWalkInBuilding3D,
  type ProximityAutoDoor3D,
} from './architecturalBuildings3D';
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
  /** Optional world-Y vertical span so 1F vs 2F furniture & partition walls collide ONLY on their own floor! */
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

/** Shared OBB + AABB wall & floor-scoped furniture collision push-out used for Player, Followers, AND Wild Pokémon! */
export function resolveTownWallCollisions(
  pos: { x: number; z: number },
  pad: number,
  colliders: TownCollider[],
  currentPy?: number,
): void {
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (currentPy !== undefined && box.minY !== undefined && box.maxY !== undefined) {
      if (currentPy + 1.55 < box.minY || currentPy + 0.25 > box.maxY) continue;
    }
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
 * Ray-marches from player's pivot (ox, oy, oz) toward desired camera (cx, cy, cz) against ALL structural walls
 * (including the current room's walls!) while ignoring low furniture (< 2.85m).
 * Smoothly pulls the camera inward in front of walls (`缩放放大`) with ZERO wall piercing and ZERO transparent buildings!
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
      if (h < 2.85) continue; // Ignore low indoor tables/shelves/chairs for camera boom!
      const wallMinY = box.minY ?? groundBaseY - 1.0;
      const wallMaxY = box.maxY ?? groundBaseY + h;
      if (py < wallMinY || py > wallMaxY) continue;
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
        return Math.max(0.24, (s - 1.15) / steps);
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
  color: 0x141824,
  transparent: true,
  opacity: 0.74,
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
  const frames = getNpcWalkSpriteFrames(url);
  const geo = new THREE.PlaneGeometry(height * 0.86, height);
  geo.translate(0, height * 0.5, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: frames.down_idle0 ?? getNpcTexture(url),
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.userData.walkFrames = frames;
  return mesh;
}

const TOWN_NIGHT_UNIFORM = { value: 0.0 };

function createSharedRadialGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255, 236, 170, 1.0)');
    g.addColorStop(0.38, 'rgba(255, 210, 110, 0.58)');
    g.addColorStop(0.72, 'rgba(255, 185, 80, 0.18)');
    g.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let SHARED_RADIAL_GLOW_TEX: THREE.CanvasTexture | null = null;
function getRadialGlowTex(): THREE.CanvasTexture {
  if (!SHARED_RADIAL_GLOW_TEX) SHARED_RADIAL_GLOW_TEX = createSharedRadialGlowTexture();
  return SHARED_RADIAL_GLOW_TEX;
}

const STREET_LAMP_BULB_MAT = new THREE.MeshBasicMaterial({ color: 0xffe066 });
const STREET_LAMP_HALO_MAT = new THREE.SpriteMaterial({
  color: 0xffdf80,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const STREET_LAMP_POOL_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd880,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const BUILDING_ENTRANCE_POOL_MAT = new THREE.MeshBasicMaterial({
  color: 0xffe39e,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const ADAPTIVE_NIGHT_WINDOW_MAT = new THREE.MeshLambertMaterial({
  color: 0xcbe8ff,
  emissive: 0xffd875,
  emissiveIntensity: 0.08,
  transparent: true,
  opacity: 0.86,
});

/** Synchronize all city streetlamps, building entrance light pools, and skyscraper/house night windows with live astronomical day/night! */
export function setGlobalNightLampGlow3D(glow: number): void {
  const g = Math.max(0, Math.min(1, glow));
  TOWN_NIGHT_UNIFORM.value = g;
  if (!STREET_LAMP_HALO_MAT.map && typeof document !== 'undefined') {
    const rTex = getRadialGlowTex();
    STREET_LAMP_HALO_MAT.map = rTex;
    STREET_LAMP_HALO_MAT.needsUpdate = true;
    STREET_LAMP_POOL_MAT.map = rTex;
    STREET_LAMP_POOL_MAT.needsUpdate = true;
    BUILDING_ENTRANCE_POOL_MAT.map = rTex;
    BUILDING_ENTRANCE_POOL_MAT.needsUpdate = true;
  }
  STREET_LAMP_BULB_MAT.color.setHex(g > 0.2 ? 0xffe066 : 0xd8eeff);
  STREET_LAMP_HALO_MAT.opacity = g * 0.85;
  STREET_LAMP_POOL_MAT.opacity = g * 0.52;
  BUILDING_ENTRANCE_POOL_MAT.opacity = g * 0.44;
  ADAPTIVE_NIGHT_WINDOW_MAT.color.setHex(g > 0.35 ? 0xffe8a3 : 0xcbe8ff);
  ADAPTIVE_NIGHT_WINDOW_MAT.emissiveIntensity = 0.08 + g * 0.88;
}

/**
 * World-Space HD-2D Pixel-Art Architecture Shader Hook v3:
 * - Crisp 15cm world-space pixel running-bond brick / tile masonry on vertical walls
 * - Automatic Nighttime Warm Household & Office Window Illumination (`uNightGlow`) on Kenney recessed glass panes!
 */
function applyPixelArtArchShader(mat: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  mat.customProgramCacheKey = () => 'pk_pixel_arch_hd2d_v3_night';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNightGlow = TOWN_NIGHT_UNIFORM;
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
uniform float uNightGlow;
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
vec3 rawArchBase = diffuseColor.rgb;
vec3 aNorm = normalize(vArchWorldNorm);
vec3 pxCoord = floor(vArchWorldPos * 6.5);
float grain = 1.0;
if (abs(aNorm.y) < 0.55) {
  float hCoord = abs(aNorm.x) > abs(aNorm.z) ? pxCoord.z : pxCoord.x;
  float rowIdx = floor(pxCoord.y * 0.333);
  float mortarH = step(2.62, mod(pxCoord.y, 3.0));
  float brickCol = floor((hCoord + mod(rowIdx, 2.0) * 3.0) * 0.1667);
  float mortarV = step(5.55, mod(hCoord + mod(rowIdx, 2.0) * 6.0, 6.0));
  float brickVar = (archHash21(vec2(brickCol, rowIdx)) - 0.5) * 0.115;
  float mortarMask = max(mortarH, mortarV);
  float groundAo = mix(0.86, 1.0, clamp((vArchWorldPos.y - 1.4) * 0.45, 0.0, 1.0));
  grain = (1.0 + brickVar - mortarMask * 0.095) * groundAo;
} else {
  float shingleRow = step(2.45, mod(pxCoord.x + pxCoord.z, 3.0));
  float tileVar = (archHash21(pxCoord.xz * 0.5) - 0.5) * 0.105;
  grain = 1.0 + tileVar - shingleRow * 0.075;
}
float bayer = mod(pxCoord.x + pxCoord.y + pxCoord.z, 2.0) * 0.028 - 0.014;
diffuseColor.rgb *= clamp(grain + bayer, 0.78, 1.14);`,
      )
      .replace(
        '#include <dithering_fragment>',
        `float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
float qLum = floor(lum * 8.0 + 0.5) / 8.0;
gl_FragColor.rgb *= mix(1.0, qLum / max(0.05, lum), 0.36);
vec3 coolShadowTint = vec3(0.92, 0.96, 1.06);
vec3 warmSunTint = vec3(1.04, 1.02, 0.96);
gl_FragColor.rgb *= mix(coolShadowTint, warmSunTint, smoothstep(0.32, 0.78, lum));
// Nighttime warm glowing apartment & office windows on vertical facades!
if (uNightGlow > 0.02 && abs(aNorm.y) < 0.42 && vArchWorldPos.y > 1.2) {
  float baseLum = dot(rawArchBase, vec3(0.299, 0.587, 0.114));
  bool isBlueGlass = rawArchBase.b > rawArchBase.r * 1.10 && rawArchBase.b > 0.18;
  bool isDarkPane = baseLum < 0.29 && rawArchBase.b >= rawArchBase.r * 0.92;
  if (isBlueGlass || isDarkPane) {
    vec3 roomCell = floor(vArchWorldPos * vec3(0.24, 0.28, 0.24));
    float rHash = archHash21(roomCell.xz + vec2(roomCell.y * 19.7, roomCell.y * 7.3));
    if (rHash > 0.26) {
      vec3 warmWin = mix(vec3(1.0, 0.82, 0.42), vec3(1.0, 0.95, 0.78), fract(rHash * 9.1));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, warmWin, uNightGlow * 0.92);
    }
  }
}
#include <dithering_fragment>`,
      );
  };
  return mat;
}

function loadRawGlb(url: string): Promise<THREE.Group | null> {
  const cached = MODEL_PROMISE_CACHE.get(url);
  if (cached) return cached;
  const isPropOrFurn =
    url.includes('/furniture/') ||
    url.includes('/mini-market/') ||
    url.includes('/food/') ||
    url.includes('/modular-buildings/detail-') ||
    url.includes('/modular-buildings/window-') ||
    url.includes('/car/') ||
    url.includes('/train/');
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
              const lambert = new THREE.MeshLambertMaterial({
                color: std.color ? std.color.clone() : new THREE.Color(0xffffff),
                map: std.map ?? null,
                side: std.side,
                transparent: std.transparent,
                opacity: std.opacity,
              });
              // Only apply brick-masonry grain to large exterior building shells (keep real 3D furniture, shelves & food crisp!)
              return isPropOrFurn ? lambert : applyPixelArtArchShader(lambert);
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
    targetDepth?: number;
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
  const scaleX = opts.targetDepth !== undefined ? opts.targetWidth / Math.max(0.01, rawSize.x) : opts.targetWidth / horizSpan;
  const scaleZ = opts.targetDepth !== undefined ? opts.targetDepth / Math.max(0.01, rawSize.z) : scaleX;
  const baseScaleY = opts.targetDepth !== undefined ? Math.min(scaleX, scaleZ) : scaleX;
  const hMult = opts.heightMult ?? 1.0;
  const scaleY = baseScaleY * hMult;

  const wrapper = new THREE.Group();
  wrapper.position.set(opts.x, opts.y, opts.z);
  wrapper.rotation.y = opts.rotY ?? 0;

  clone.scale.set(scaleX, scaleY, scaleZ);
  clone.position.set(
    -rawCenter.x * scaleX,
    -rawBox.min.y * scaleY - 0.04,
    -rawCenter.z * scaleZ,
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
        const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
        const line = new THREE.LineSegments(edges, INK_LINE_MAT.clone());
        mesh.add(line);
      }
    });
  }

  wrapper.add(clone);

  // Automatic Stone Retaining Foundation Plinth ONLY on exterior town buildings (never on indoor furniture/props!)
  if (
    opts.targetWidth >= 12 &&
    !url.includes('/furniture/') &&
    !url.includes('/mini-market/') &&
    !url.includes('/food/') &&
    !url.includes('/modular-buildings/')
  ) {
    const fW = rawSize.x * scaleX * 0.94;
    const fD = rawSize.z * scaleZ * 0.94;
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(fW, 2.8, fD),
      new THREE.MeshLambertMaterial({ color: 0x8d8f96 }),
    );
    plinth.position.set(0, -1.42, 0);
    wrapper.add(plinth);
  }

  parent.add(wrapper);
  const finalH = rawSize.y * scaleY;
  opts.onMounted?.(wrapper, finalH);
}

/** Smoothly fades an enterable building's exterior shell transparent (or hides roof completely at low alpha!) for crystal-clear interior cutaway */
export function setBuildingExteriorOpacity(exteriorGroup: THREE.Group, alpha: number) {
  const isFaded = alpha < 0.96;
  exteriorGroup.visible = alpha > 0.16;
  if (!exteriorGroup.visible) return;
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
  skyGlassTex: THREE.CanvasTexture;
  awningRed: THREE.CanvasTexture;
  awningBlue: THREE.CanvasTexture;
  awningGold: THREE.CanvasTexture;
  urbanShrubs: THREE.CanvasTexture[];
}

let CACHED_GROUND_TEX: TownGroundTex | null = null;

function getGroundTex(): TownGroundTex {
  if (CACHED_GROUND_TEX) return CACHED_GROUND_TEX;

  const makeSign = (bg: string, txt: string, fg = '#ffffff') =>
    makePixelTex(96, 28, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 96, 28);
      // Subtle top pixel bevel highlight
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(3, 3, 90, 4);
      ctx.strokeStyle = '#141926';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, 93, 25);
      ctx.fillStyle = '#141926';
      ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 49, 15.5);
      ctx.fillStyle = fg;
      ctx.fillText(txt, 48, 14.5);
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

  // 1. Grand 4-Lane City Boulevard with EXTRA-WIDE Single Lanes (~5.3m each = 2.4x Red's width!), Wide Sidewalks & Lush Central Median!
  const boulevard4Lane = makePixelTex(
    128,
    128,
    (ctx) => {
      // Wide Paved Pedestrian Sidewalks (y=0..15, y=113..128) with tactile guide strip & tile seams
      ctx.fillStyle = '#e0d8c8';
      ctx.fillRect(0, 0, 128, 16);
      ctx.fillRect(0, 112, 128, 16);
      ctx.fillStyle = '#c8bfb0';
      for (let x = 0; x < 128; x += 16) {
        ctx.fillRect(x, 0, 1, 16);
        ctx.fillRect(x, 112, 1, 16);
      }
      ctx.fillStyle = '#f2cc5a';
      ctx.fillRect(0, 7, 128, 2);
      ctx.fillRect(0, 119, 128, 2);
      // Curb stones
      ctx.fillStyle = '#8b92a0';
      ctx.fillRect(0, 15, 128, 2);
      ctx.fillRect(0, 111, 128, 2);

      // Extra-Wide 2+2 Carriageway Asphalt (y=17..111) — each single lane is 20px (~5.3m wide!)
      ctx.fillStyle = '#4a5260';
      ctx.fillRect(0, 17, 128, 94);
      // Gutter shadows
      ctx.fillStyle = '#363d48';
      ctx.fillRect(0, 17, 128, 2);
      ctx.fillRect(0, 109, 128, 2);
      // Subtle asphalt speckle
      ctx.fillStyle = '#424956';
      for (let i = 0; i < 85; i++) {
        ctx.fillRect((i * 23) % 125, 19 + ((i * 17) % 88), 2, 1);
      }
      // Crisp pixel storm-drain grates along curbs & iron manhole cover
      ctx.fillStyle = '#252a33';
      ctx.fillRect(18, 18, 7, 3);
      ctx.fillRect(86, 107, 7, 3);
      ctx.fillStyle = '#6c757d';
      ctx.fillRect(20, 18, 1, 3);
      ctx.fillRect(22, 18, 1, 3);
      ctx.fillRect(88, 107, 1, 3);
      ctx.fillRect(90, 107, 1, 3);
      ctx.fillStyle = '#2c323d';
      ctx.fillRect(62, 43, 6, 6);
      ctx.fillStyle = '#5c6473';
      ctx.fillRect(63, 44, 4, 4);
      ctx.fillStyle = '#2c323d';
      ctx.fillRect(64, 45, 2, 2);

      // Crisp white pixel lane-direction arrows centered in each wide lane
      ctx.fillStyle = 'rgba(241, 243, 245, 0.72)';
      ctx.fillRect(98, 26, 9, 2);
      ctx.fillRect(96, 25, 2, 4);
      ctx.fillRect(94, 26, 2, 2);
      ctx.fillRect(22, 99, 9, 2);
      ctx.fillRect(31, 98, 2, 4);
      ctx.fillRect(33, 99, 2, 2);

      // 2 EXTRA-WIDE Lanes each direction (1 crisp dashed white lane divider per carriageway!)
      ctx.fillStyle = '#f1f3f5';
      for (let x = 6; x < 128; x += 28) {
        ctx.fillRect(x, 36, 15, 2);
        ctx.fillRect(x, 90, 15, 2);
      }

      // Lush Central Green Median Strip (y=58..70) with clean double yellow curbs + pixel grass tufts!
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

  // 2. Wide 2-Lane Collector Street (1 Extra-Wide ~5.2m Lane Each Direction + Double Yellow Centerline + Wide Sidewalks!)
  const collector2Lane = makePixelTex(
    64,
    64,
    (ctx) => {
      // Wide Pedestrian Sidewalks
      ctx.fillStyle = '#dfd7c6';
      ctx.fillRect(0, 0, 64, 10);
      ctx.fillRect(0, 54, 64, 10);
      ctx.fillStyle = '#c8bfb0';
      for (let x = 0; x < 64; x += 16) {
        ctx.fillRect(x, 0, 1, 10);
        ctx.fillRect(x, 54, 1, 10);
      }
      // Roadside planting strip + curb
      ctx.fillStyle = '#40b058';
      ctx.fillRect(0, 9, 64, 2);
      ctx.fillRect(0, 53, 64, 2);
      ctx.fillStyle = '#8b93a1';
      ctx.fillRect(0, 11, 64, 1);
      ctx.fillRect(0, 52, 64, 1);
      // Wide 2-Lane Asphalt (y=12..52) — 19px per single lane (~5.3m wide!)
      ctx.fillStyle = '#505866';
      ctx.fillRect(0, 12, 64, 40);
      ctx.fillStyle = '#3a414d';
      ctx.fillRect(0, 12, 64, 1);
      ctx.fillRect(0, 51, 64, 1);
      ctx.fillStyle = '#474f5c';
      for (let i = 0; i < 28; i++) {
        ctx.fillRect((i * 17) % 62, 14 + ((i * 11) % 35), 2, 1);
      }
      ctx.fillStyle = '#252a33';
      ctx.fillRect(28, 13, 5, 2);
      ctx.fillRect(12, 49, 5, 2);
      // Crisp double yellow center divider (wide spacious single lane on each side!)
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

  // Crisp HD-2D Pixel-Art Glass Curtain-Wall Texture for Lujiazui / Downtown Skyscrapers!
  const skyGlassTex = makePixelTex(
    64,
    128,
    (ctx) => {
      ctx.fillStyle = '#2b5d8f';
      ctx.fillRect(0, 0, 64, 128);
      for (let y = 0; y < 128; y += 8) {
        // Horizontal steel floor slab spandrel
        ctx.fillStyle = '#1d3c5e';
        ctx.fillRect(0, y, 64, 2);
        for (let x = 0; x < 64; x += 8) {
          // Vertical mullion
          ctx.fillStyle = '#193554';
          ctx.fillRect(x, y, 1, 8);
          const hash = ((x * 37 + y * 91) >>> 0) % 13;
          // Sunlit sky-blue reflection band + occasional warm-lit office windows!
          const diagShine = (x + y) % 32 < 10;
          ctx.fillStyle =
            hash === 0 || hash === 5
              ? '#ffe066'
              : hash === 9
                ? '#ffd8a8'
                : diagShine
                  ? '#74c0fc'
                  : '#4dabf7';
          ctx.fillRect(x + 1, y + 2, 6, 5);
          // 1px specular window highlight
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x + 1, y + 2, 6, 1);
        }
      }
    },
    2,
    3,
  );

  const makeAwning = (c1: string, c2: string) =>
    makePixelTex(32, 16, (ctx) => {
      for (let x = 0; x < 32; x += 8) {
        ctx.fillStyle = (x / 8) % 2 === 0 ? c1 : c2;
        ctx.fillRect(x, 0, 8, 14);
        ctx.fillStyle = '#181c28';
        ctx.fillRect(x, 14, 8, 2);
      }
    }, 2, 1);

  // 8 Crisp Black-Outlined GBA Pixel-Art Urban Landscaping Shrubs (ZERO fallen wilderness logs!)
  // Matches the user's preferred crisp pixel bush style: Boxwood, Golden Privet, Red-Tip Photinia, Pink Azalea, Yellow Forsythia, Blue Hydrangea, Trimmed Hedge & Deep Pine Mound!
  const makeUrbanShrub = (
    dark: string,
    mid: string,
    light: string,
    hi: string,
    shape: 'round' | 'hedge' | 'wide',
    bloom?: string,
  ) =>
    makePixelTex(
      24,
      20,
      (ctx) => {
        const px = (x: number, y: number, w: number, h: number, col: string) => {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, w, h);
        };
        const fillBlob = (mask: [number, number, number, number][], col: string) => {
          ctx.fillStyle = col;
          for (const [x, y, w, h] of mask) ctx.fillRect(x, y, w, h);
        };
        if (shape === 'hedge') {
          // Crisp trimmed urban rectangular box hedge with 1px black pixel outline
          px(2, 5, 20, 14, '#141923');
          px(3, 4, 18, 15, '#141923');
          px(3, 6, 18, 12, dark);
          px(4, 5, 16, 11, mid);
          px(4, 5, 16, 5, light);
          px(6, 5, 6, 2, hi);
          px(14, 6, 4, 2, hi);
          // Leaf cluster texture accents
          px(6, 11, 3, 2, dark);
          px(13, 12, 3, 2, dark);
          px(10, 9, 2, 1, dark);
        } else if (shape === 'wide') {
          // Lush double-mound flowering city bush
          const out: [number, number, number, number][] = [
            [2, 9, 20, 9],
            [4, 6, 16, 12],
            [6, 4, 5, 4],
            [13, 5, 5, 4],
          ];
          fillBlob(out, '#141923');
          px(3, 10, 18, 7, dark);
          px(5, 7, 14, 9, mid);
          px(7, 5, 4, 4, light);
          px(13, 6, 4, 4, light);
          px(5, 8, 14, 4, light);
          px(7, 6, 3, 2, hi);
          px(14, 7, 2, 2, hi);
          px(7, 13, 3, 2, dark);
          px(14, 12, 3, 2, dark);
        } else {
          // Classic round GBA pixel bush (exact Screenshot 3 aesthetic!)
          const out: [number, number, number, number][] = [
            [4, 8, 16, 10],
            [6, 5, 12, 14],
            [8, 3, 8, 16],
          ];
          fillBlob(out, '#141923');
          px(5, 9, 14, 8, dark);
          px(7, 6, 10, 10, mid);
          px(9, 4, 6, 6, light);
          px(6, 7, 12, 4, light);
          px(8, 5, 3, 2, hi);
          px(12, 6, 2, 1, hi);
          px(8, 12, 2, 2, dark);
          px(13, 12, 2, 2, dark);
        }
        if (bloom) {
          px(6, 8, 2, 2, bloom);
          px(11, 6, 2, 2, bloom);
          px(15, 9, 2, 2, bloom);
          px(9, 11, 2, 2, bloom);
          px(14, 12, 2, 2, bloom);
          px(7, 8, 1, 1, '#ffffff');
          px(12, 6, 1, 1, '#ffffff');
        }
      },
      1,
      1,
    );

  const urbanShrubs: THREE.CanvasTexture[] = [
    makeUrbanShrub('#1c6b2d', '#2ca03c', '#59cf48', '#a3f062', 'round'),           // 1. 翠绿冬青球
    makeUrbanShrub('#5e8c1e', '#8ec42a', '#c3e848', '#ebff85', 'round'),           // 2. 金叶女贞球
    makeUrbanShrub('#5e1928', '#9c263b', '#d94854', '#ff8787', 'wide'),            // 3. 红叶石楠/红继木
    makeUrbanShrub('#1d6930', '#2e9c44', '#56c75e', '#94eb88', 'wide', '#ff6b9e'), // 4. 粉红杜鹃花丛
    makeUrbanShrub('#226b2d', '#339e3f', '#5cc954', '#9bf084', 'round', '#ffe066'),// 5. 迎春黄花灌木
    makeUrbanShrub('#1a5934', '#28854c', '#45b56c', '#82e09e', 'wide', '#74c0fc'), // 6. 蓝白绣球花丛
    makeUrbanShrub('#185c29', '#278f3c', '#4cbf52', '#8ce87c', 'hedge'),           // 7. 修剪方绿篱
    makeUrbanShrub('#14472c', '#1e7044', '#339c5f', '#66cc88', 'round'),           // 8. 深绿常青矮松
  ];

  CACHED_GROUND_TEX = {
    cobblePlaza,
    roadTile,
    boulevard4Lane,
    collector2Lane,
    alleyCobble,
    junctionAsphalt,
    highwayTile,
    crosswalk,
    martSign: makeSign('#1971c2', '友好商店'),
    hotelSign: makeSign('#e67700', '驿站酒店'),
    cafeSign: makeSign('#d9480f', '树果饭店'),
    extraSigns: [
      makeSign('#2b8a3e', '便民茶室'),
      makeSign('#c2255c', '烘焙工坊'),
      makeSign('#5f3dc4', '旧书屋'),
      makeSign('#e67700', '拉面馆'),
      makeSign('#0b7285', '花艺铺'),
      makeSign('#a61e4d', '奶茶铺'),
    ],
    busSign,
    clinicFloor,
    martFloor,
    woodFloor,
    skyGlassTex,
    awningRed: makeAwning('#e03131', '#fff5f5'),
    awningBlue: makeAwning('#1c7ed6', '#e7f5ff'),
    awningGold: makeAwning('#f08c00', '#fff9db'),
    urbanShrubs,
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
    const wallMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xfff4e6 }));
    const vermilion = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xc92a2a }));
    const slateRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x3b4252 }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    addPiece(new THREE.BoxGeometry(8.2, 1.4, 8.2), applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xced4da })), 0, 0.7, 0);
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

  if (cityId === 'hangzhou') {
    // 🏯 杭州西湖雷峰塔 (Leifeng Pagoda - 5-tier octagonal bronze-gold pagoda!)
    const stoneBase = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xadb5bd }));
    const crimsonWall = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xa61e22 }));
    const bronzeEave = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xd99b26 }));
    const goldSpire = new THREE.MeshLambertMaterial({ color: 0xffd43b, emissive: 0x5c4300 });
    addPiece(new THREE.CylinderGeometry(7.2, 8.0, 2.4, 8), stoneBase, 0, 1.2, 0);
    for (let tier = 0; tier < 5; tier++) {
      const y = 2.4 + tier * 3.6;
      const r = 5.2 - tier * 0.58;
      addPiece(new THREE.CylinderGeometry(r * 0.92, r, 2.3, 8), crimsonWall, 0, y + 1.15, 0);
      addPiece(new THREE.CylinderGeometry(r * 0.78, r * 1.38, 1.35, 8), bronzeEave, 0, y + 2.85, 0);
    }
    addPiece(new THREE.ConeGeometry(2.6, 2.4, 8), bronzeEave, 0, 21.4, 0);
    addPiece(new THREE.CylinderGeometry(0.14, 0.34, 4.4, 8), goldSpire, 0, 24.4, 0);
    return g;
  }

  if (cityId === 'shenzhen') {
    // 🏢 深圳平安金融中心 (Ping An Finance Centre - tapered steel-glass supertall spire!)
    const glassBlue = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x4dabf7 }));
    const steelTrim = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xdbe4ef }));
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x66d9e8 });
    addPiece(new THREE.BoxGeometry(8.8, 3.0, 8.8), steelTrim, 0, 1.5, 0);
    addPiece(new THREE.CylinderGeometry(3.4, 5.4, 28, 4), glassBlue, 0, 17.0, 0, 0, Math.PI / 4, 0);
    // 4 tapered corner steel ribs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      addPiece(new THREE.BoxGeometry(0.9, 30, 0.9), steelTrim, Math.cos(a) * 3.6, 17.5, Math.sin(a) * 3.6);
    }
    addPiece(new THREE.ConeGeometry(3.3, 8.5, 4), glassBlue, 0, 35.2, 0, 0, Math.PI / 4, 0);
    addPiece(new THREE.SphereGeometry(0.65, 8, 8), cyanGlow, 0, 39.8, 0);
    return g;
  }

  if (cityId === 'chengdu') {
    // 🏮 成都天府蜀韵高阁 (Sichuan Jade-and-Crimson Pavilion Tower!)
    const stone = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xdee2e6 }));
    const vermilion = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xc92a2a }));
    const jadeRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    addPiece(new THREE.BoxGeometry(9.2, 2.2, 9.2), stone, 0, 1.1, 0);
    for (let t = 0; t < 3; t++) {
      const y = 2.2 + t * 5.2;
      const w = 6.8 - t * 1.1;
      addPiece(new THREE.BoxGeometry(w, 3.4, w), vermilion, 0, y + 1.7, 0);
      const roof = new THREE.ConeGeometry(w * 0.98, 2.2, 4);
      roof.rotateY(Math.PI / 4);
      addPiece(roof, jadeRoof, 0, y + 4.3, 0);
    }
    addPiece(new THREE.SphereGeometry(0.95, 10, 8), goldMat, 0, 19.6, 0);
    return g;
  }

  if (cityId === 'harbin') {
    // ⛪ 哈尔滨圣索菲亚大教堂 (Saint Sophia Cathedral - red brick & iconic emerald onion domes!)
    const redBrick = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xb03a2e }));
    const creamTrim = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xf8f1e5 }));
    const emeraldDome = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b });
    addPiece(new THREE.BoxGeometry(10.5, 7.6, 10.5), redBrick, 0, 3.8, 0);
    addPiece(new THREE.CylinderGeometry(3.4, 3.6, 5.2, 12), creamTrim, 0, 10.2, 0);
    addPiece(new THREE.SphereGeometry(3.6, 14, 10), emeraldDome, 0, 14.2, 0);
    addPiece(new THREE.ConeGeometry(1.5, 3.4, 10), emeraldDome, 0, 18.2, 0);
    addPiece(new THREE.CylinderGeometry(0.12, 0.2, 2.8, 6), goldMat, 0, 20.8, 0);
    // 4 corner tent-roof satellite domes
    for (const [sx, sz] of [[-4.0, -4.0], [4.0, -4.0], [-4.0, 4.0], [4.0, 4.0]]) {
      addPiece(new THREE.CylinderGeometry(1.3, 1.4, 3.2, 8), creamTrim, sx, 9.2, sz);
      addPiece(new THREE.SphereGeometry(1.45, 10, 8), emeraldDome, sx, 11.4, sz);
      addPiece(new THREE.ConeGeometry(0.65, 1.8, 8), goldMat, sx, 13.4, sz);
    }
    return g;
  }

  if (cityId === 'hongkong') {
    // 🏙️ 香港中银大厦 (Bank of China Tower - iconic 4-quadrant triangular crystal prism skyscraper!)
    const crystalGlass = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x74c0fc }));
    const silverFrame = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const quadSpecs: [number, number, number][] = [
      [-1.9, -1.9, 16],
      [1.9, -1.9, 24],
      [-1.9, 1.9, 31],
      [1.9, 1.9, 38],
    ];
    for (const [qx, qz, qh] of quadSpecs) {
      addPiece(new THREE.BoxGeometry(3.7, qh, 3.7), crystalGlass, qx, qh * 0.5, qz);
      addPiece(new THREE.ConeGeometry(2.6, 4.2, 4), silverFrame, qx, qh + 2.1, qz, 0, Math.PI / 4, 0);
    }
    addPiece(new THREE.CylinderGeometry(0.12, 0.24, 9.0, 6), silverFrame, 1.9, 44.5, 1.9);
    addPiece(new THREE.CylinderGeometry(0.12, 0.24, 7.5, 6), silverFrame, -1.9, 37.0, 1.9);
    return g;
  }

  if (cityId === 'osaka') {
    // 🏯 大阪城天守阁 (Osaka Castle Keep - stone rampart + white walls + emerald roofs & gold crests!)
    const stoneWall = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x868e96 }));
    const whitePlaster = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xf8f9fa }));
    const emeraldRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x208b63 }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b });
    addPiece(new THREE.CylinderGeometry(7.0, 8.8, 4.6, 4), stoneWall, 0, 2.3, 0, 0, Math.PI / 4, 0);
    for (let t = 0; t < 4; t++) {
      const y = 4.6 + t * 3.8;
      const w = 7.4 - t * 1.15;
      addPiece(new THREE.BoxGeometry(w, 2.4, w), whitePlaster, 0, y + 1.2, 0);
      const roof = new THREE.ConeGeometry(w * 0.96, 1.7, 4);
      roof.rotateY(Math.PI / 4);
      addPiece(roof, emeraldRoof, 0, y + 3.1, 0);
    }
    addPiece(new THREE.BoxGeometry(2.8, 0.65, 0.7), goldMat, 0, 20.6, 0);
    return g;
  }

  if (cityId === 'sapporo') {
    // 🗼 札幌电视塔 (Sapporo TV Tower - red steel lattice tower with bright green digital clock!)
    const redSteel = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xe03131 }));
    const deckMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xdee2e6 }));
    const clockMat = new THREE.MeshBasicMaterial({ color: 0x51cf66 });
    addPiece(new THREE.BoxGeometry(8.2, 3.2, 8.2), deckMat, 0, 1.6, 0);
    addPiece(new THREE.CylinderGeometry(2.4, 4.8, 16, 4), redSteel, 0, 11.2, 0, 0, Math.PI / 4, 0);
    addPiece(new THREE.BoxGeometry(5.6, 3.2, 5.6), deckMat, 0, 20.4, 0);
    addPiece(new THREE.BoxGeometry(3.6, 1.5, 5.85), clockMat, 0, 17.5, 0);
    addPiece(new THREE.BoxGeometry(5.85, 1.5, 3.6), clockMat, 0, 17.5, 0);
    addPiece(new THREE.CylinderGeometry(0.18, 1.6, 12, 4), redSteel, 0, 28.0, 0, 0, Math.PI / 4, 0);
    return g;
  }

  if (cityId === 'fukuoka') {
    // 🗼 福冈海滨镜面塔 (Fukuoka Tower - triangular sapphire mirror prism!)
    const mirrorGlass = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x339af0 }));
    const silverTrim = new THREE.MeshLambertMaterial({ color: 0xe9ecef });
    addPiece(new THREE.CylinderGeometry(1.1, 5.6, 32, 3), mirrorGlass, 0, 16.0, 0);
    addPiece(new THREE.CylinderGeometry(2.8, 3.4, 2.2, 3), silverTrim, 0, 22.0, 0);
    addPiece(new THREE.CylinderGeometry(0.14, 0.55, 7.5, 6), silverTrim, 0, 35.5, 0);
    return g;
  }

  if (cityId === 'okinawa') {
    // 🏯 冲绳首里城朱红正殿 (Shuri Castle Seiden - vermilion Ryukyu palace on coral limestone terrace!)
    const coralStone = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xe9e2d0 }));
    const vermilion = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xd92626 }));
    const terraRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xb8442a }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b });
    addPiece(new THREE.BoxGeometry(12.2, 2.4, 8.6), coralStone, 0, 1.2, 0);
    addPiece(new THREE.BoxGeometry(10.0, 4.4, 6.4), vermilion, 0, 4.6, 0);
    addPiece(new THREE.BoxGeometry(11.4, 1.5, 7.6), terraRoof, 0, 7.5, 0);
    addPiece(new THREE.BoxGeometry(7.6, 3.4, 4.8), vermilion, 0, 9.9, 0);
    addPiece(new THREE.BoxGeometry(9.2, 1.6, 6.2), terraRoof, 0, 12.4, 0);
    addPiece(new THREE.BoxGeometry(7.8, 0.7, 0.65), goldMat, 0, 13.5, 0);
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

export function createPokeballBeacon(radius = 1.15): THREE.Group {
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

const DIVERSE_HOUSE_STYLES: {
  url: string;
  heightMult: number;
  isFlatUrban: boolean;
}[] = [
  // Multi-story crisp Kenney city-commercial urban buildings & apartments
  { url: '/models/city-commercial/building-a.glb', heightMult: 1.08, isFlatUrban: true },
  { url: '/models/city-commercial/building-b.glb', heightMult: 1.12, isFlatUrban: true },
  { url: '/models/city-commercial/building-c.glb', heightMult: 1.15, isFlatUrban: true },
  { url: '/models/city-commercial/building-d.glb', heightMult: 1.10, isFlatUrban: true },
  { url: '/models/city-commercial/building-f.glb', heightMult: 1.18, isFlatUrban: true },
  { url: '/models/city-commercial/building-g.glb', heightMult: 1.14, isFlatUrban: true },
  { url: '/models/city-commercial/building-h.glb', heightMult: 1.16, isFlatUrban: true },
  { url: '/models/city-commercial/building-j.glb', heightMult: 1.12, isFlatUrban: true },
  { url: '/models/city-commercial/building-l.glb', heightMult: 1.20, isFlatUrban: true },
  { url: '/models/city-commercial/building-m.glb', heightMult: 1.15, isFlatUrban: true },
  // Pitched-roof cozy cottages & suburban villas for outer residential streets
  { url: '/models/town/suburban/house-a.glb', heightMult: 1.12, isFlatUrban: false },
  { url: '/models/town/suburban/house-c.glb', heightMult: 1.16, isFlatUrban: false },
  { url: '/models/town/suburban/house-f.glb', heightMult: 1.10, isFlatUrban: false },
  { url: '/models/town/suburban/house-i.glb', heightMult: 1.18, isFlatUrban: false },
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

/** Helper: builds a crowned street ribbon mesh that samples 7 cross-sectional points so rolling hills NEVER poke through roads! */
function buildStreetRibbonMesh(
  seg: TownStreetSeg,
  baseY: number,
  originX: number,
  originZ: number,
  tex: THREE.CanvasTexture,
  getGroundHeight: (x: number, z: number) => number,
  layerLiftY = 0.14,
  polyOffsetFactor = -1,
): THREE.Mesh {
  const dist = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const steps = Math.max(5, Math.ceil(dist / 2.6));
  const dirX = (seg.x2 - seg.x1) / Math.max(0.01, dist);
  const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, dist);
  const wStart = seg.widthStart ?? seg.width;
  const wEnd = seg.widthEnd ?? seg.width;
  const endPad = Math.min(0.85, Math.max(wStart, wEnd) * 0.035);
  const sx1 = seg.x1 - dirX * endPad;
  const sz1 = seg.z1 - dirZ * endPad;
  const sx2 = seg.x2 + dirX * endPad;
  const sz2 = seg.z2 + dirZ * endPad;
  const paddedDist = dist + endPad * 2;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const sampleFracs = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const curHalfW = (wStart + (wEnd - wStart) * t) * 0.5;
    const perpX = -dirZ * curHalfW;
    const perpZ = dirX * curHalfW;
    const wx = sx1 + (sx2 - sx1) * t;
    const wz = sz1 + (sz2 - sz1) * t;
    const lx = wx - perpX;
    const lz = wz - perpZ;
    const rx = wx + perpX;
    const rz = wz + perpZ;

    // Sample 7 points across the full boulevard width and crown road surface above the highest local terrain crest!
    let maxH = WATER_LEVEL_3D + 0.12;
    for (let fi = 0; fi < sampleFracs.length; fi++) {
      const f = sampleFracs[fi];
      const h = getGroundHeight(wx + perpX * f, wz + perpZ * f);
      if (h > maxH) maxH = h;
    }
    const crownY = Math.max(WATER_LEVEL_3D + 0.24, maxH + layerLiftY + 0.14) - baseY;
    const edgeY = crownY - 0.03;

    positions.push(
      lx - originX, edgeY - 2.4, lz - originZ, // 0: left retaining curb skirt bottom
      lx - originX, edgeY, lz - originZ,       // 1: left sidewalk edge
      wx - originX, crownY, wz - originZ,      // 2: crowned road centerline
      rx - originX, edgeY, rz - originZ,       // 3: right sidewalk edge
      rx - originX, edgeY - 2.4, rz - originZ, // 4: right retaining curb skirt bottom
    );
    const u = (t * paddedDist) / (seg.kind === 'arterial' ? 16.5 : 10.5);
    uvs.push(u, 0, u, 0, u, 0.5, u, 1, u, 1);
    if (s < steps) {
      const i0 = s * 5;
      const n0 = (s + 1) * 5;
      indices.push(i0, n0, i0 + 1, i0 + 1, n0, n0 + 1);
      indices.push(i0 + 1, n0 + 1, i0 + 2, i0 + 2, n0 + 1, n0 + 2);
      indices.push(i0 + 2, n0 + 2, i0 + 3, i0 + 3, n0 + 2, n0 + 3);
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

  const spinners: THREE.Object3D[] = [];
  const fountains: THREE.Object3D[] = [];
  const billboards: THREE.Mesh[] = [];
  const vehicles: TownMovingVehicle[] = [];
  const walkers: TownStrollingCitizen[] = [];
  const interiors: EnterableBuildingInterior[] = [];
  const autoDoors: ProximityAutoDoor3D[] = [];
  const upperFloorZones: WalkableStairAndFloorZone3D[] = [];
  const viaductSpans: ViaductOverheadSpan[] = [];
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

  // 1. Wide Multi-Lane Metropolis Road Hierarchy with Dense Pixel-Art Tree + Shrub Medians & Verges!

  const distToSeg2D = (px: number, pz: number, x1: number, z1: number, x2: number, z2: number) => {
    const vx = x2 - x1;
    const vz = z2 - z1;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 0.001) return Math.hypot(px - x1, pz - z1);
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / lenSq));
    return Math.hypot(px - (x1 + t * vx), pz - (z1 + t * vz));
  };
  const isBlockedForGreenery = (wx: number, wz: number, skipSeg: TownStreetSeg) => {
    if (getGroundHeight(wx, wz) < WATER_LEVEL_3D + 0.35) return true;
    for (const other of layout.streets) {
      if (other === skipSeg) continue;
      if (distToSeg2D(wx, wz, other.x1, other.z1, other.x2, other.z2) < other.width * 0.5 + 1.6) {
        return true;
      }
    }
    return false;
  };

  for (let segIdx = 0; segIdx < layout.streets.length; segIdx++) {
    const seg = layout.streets[segIdx];
    if (seg.isBridge) {
      // REAL 3D RIVER BRIDGE (Flush onshore road connection + riveted steel Waibaidu truss on Suzhou Creek & white cable-stayed pylons on wide rivers!)
      const bLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
      const bYaw = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1);
      const bMidX = (seg.x1 + seg.x2) * 0.5 - centerX;
      const bMidZ = (seg.z1 + seg.z2) * 0.5 - centerZ;
      const endH1 = getGroundHeight(seg.x1, seg.z1);
      const endH2 = getGroundHeight(seg.x2, seg.z2);
      const deckY = Math.max(WATER_LEVEL_3D + 0.9, baseY + 0.24, Math.max(endH1, endH2) + 0.16) - baseY;
      const bridgeDeckTex = tex.collector2Lane.clone();
      bridgeDeckTex.center.set(0.5, 0.5);
      bridgeDeckTex.rotation = Math.PI / 2;
      bridgeDeckTex.repeat.set(Math.max(1, Math.round(bLen / 14)), 1);
      bridgeDeckTex.wrapS = THREE.RepeatWrapping;
      bridgeDeckTex.wrapT = THREE.RepeatWrapping;
      bridgeDeckTex.needsUpdate = true;
      const pierSideMat = new THREE.MeshLambertMaterial({ color: 0x9aa2ae });
      const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.48, bLen + 5.2), [
        pierSideMat,
        pierSideMat,
        new THREE.MeshLambertMaterial({ map: bridgeDeckTex }),
        pierSideMat,
        pierSideMat,
        pierSideMat,
      ]);
      deckMesh.position.set(bMidX, deckY - 0.22, bMidZ);
      deckMesh.rotation.y = bYaw;
      deckMesh.receiveShadow = true;
      group.add(deckMesh);

      // Authentic Shanghai bridge palettes: riveted slate-grey steel on Waibaidu Bridge; crisp architectural white-grey on Nanpu/Yangpu cable-stayed bridges!
      const railCol = seg.bridgeStyle === 'waibaidu' ? 0x525d68 : 0xdce3ea;
      const railMat = new THREE.MeshLambertMaterial({ color: railCol });
      const cableMat = new THREE.MeshBasicMaterial({ color: 0xf1f3f5 });
      const pierMat = new THREE.MeshLambertMaterial({ color: 0x868e96 });
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      const bDirX = (seg.x2 - seg.x1) / Math.max(0.01, bLen);
      const bDirZ = (seg.z2 - seg.z1) / Math.max(0.01, bLen);
      const bNx = -bDirZ;
      const bNz = bDirX;
      // Inset side railings strictly within the water span (82% of bLen) so railings NEVER jut across onshore road intersections!
      const railSpan = Math.max(6, bLen * 0.82);

      for (const side of [-1, 1]) {
        const rx = bMidX + bNx * side * (seg.width * 0.48);
        const rz = bMidZ + bNz * side * (seg.width * 0.48);
        colliders.push(makeObbCollider(centerX + rx, centerZ + rz, 0.5, railSpan * 0.5, bYaw, 3.2));
        const topBeam = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, seg.bridgeStyle === 'waibaidu' ? 0.85 : 1.05, railSpan),
          railMat,
        );
        topBeam.position.set(rx, deckY + (seg.bridgeStyle === 'waibaidu' ? 5.6 : 0.55), rz);
        topBeam.rotation.y = bYaw;
        topBeam.castShadow = true;
        group.add(topBeam);

        if (seg.bridgeStyle === 'waibaidu') {
          const lowRail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.92, railSpan), railMat);
          lowRail.position.set(rx, deckY + 0.46, rz);
          lowRail.rotation.y = bYaw;
          group.add(lowRail);
          const trussCount = Math.max(4, Math.floor(railSpan / 7.2));
          for (let ti = 0; ti <= trussCount; ti++) {
            const f = -0.48 + (ti / trussCount) * 0.96;
            const px = rx + bDirX * (railSpan * f);
            const pz = rz + bDirZ * (railSpan * f);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.6, 0.42), railMat);
            post.position.set(px, deckY + 2.8, pz);
            post.rotation.y = bYaw;
            post.castShadow = true;
            group.add(post);
          }
        }

        // Bridge deck warm streetlights along the span!
        for (const lFrac of [-0.34, 0, 0.34]) {
          const lpx = rx + bDirX * (railSpan * lFrac);
          const lpz = rz + bDirZ * (railSpan * lFrac);
          const lPost = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.2, 6), railMat);
          lPost.position.set(lpx, deckY + 2.4, lpz);
          const lBulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), STREET_LAMP_BULB_MAT);
          lBulb.position.set(lpx, deckY + 4.55, lpz);
          const lHalo = new THREE.Sprite(STREET_LAMP_HALO_MAT);
          lHalo.scale.set(3.4, 3.4, 1);
          lHalo.position.set(lpx, deckY + 4.55, lpz);
          group.add(lPost, lBulb, lHalo);
        }

        for (const frac of [-0.22, 0, 0.22]) {
          const px = rx + bDirX * (railSpan * frac);
          const pz = rz + bDirZ * (railSpan * frac);
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 5.2, 8), pierMat);
          pier.position.set(px, deckY - 2.6, pz);
          group.add(pier);
          if (seg.bridgeStyle !== 'waibaidu' && Math.abs(frac) > 0.1) {
            const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.05, 16.0, 1.05), railMat);
            pylon.position.set(px, deckY + 8.0, pz);
            pylon.castShadow = true;
            group.add(pylon);
            for (const cSpan of [-0.18, -0.10, 0.10, 0.18]) {
              const clampedFrac = Math.max(-0.46, Math.min(0.46, frac + cSpan));
              const targetX = rx + bDirX * (railSpan * clampedFrac);
              const targetZ = rz + bDirZ * (railSpan * clampedFrac);
              const dx = targetX - px;
              const dz = targetZ - pz;
              const dy = -14.2;
              const cLen = Math.hypot(dx, dy, dz);
              const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, cLen, 4), cableMat);
              cable.position.set((px + targetX) * 0.5, deckY + 14.8 + dy * 0.5, (pz + targetZ) * 0.5);
              cable.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(dx, dy, dz).normalize(),
              );
              group.add(cable);
            }
          }
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), lampMat);
          lamp.position.set(px, deckY + (seg.bridgeStyle === 'waibaidu' ? 4.0 : 1.6), pz);
          group.add(lamp);
        }
      }
      if (seg.bridgeStyle === 'waibaidu') {
        for (const f of [-0.34, 0, 0.34]) {
          const cxB = bMidX + bDirX * (railSpan * f);
          const czB = bMidZ + bDirZ * (railSpan * f);
          const cross = new THREE.Mesh(new THREE.BoxGeometry(seg.width * 0.98, 0.52, 0.52), railMat);
          cross.position.set(cxB, deckY + 5.8, czB);
          cross.rotation.y = bYaw;
          group.add(cross);
        }
      } else {
        for (const f of [-0.22, 0.22]) {
          const cxB = bMidX + bDirX * (railSpan * f);
          const czB = bMidZ + bDirZ * (railSpan * f);
          const tie = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.9, 0.9), railMat);
          tie.position.set(cxB, deckY + 14.4, czB);
          tie.rotation.y = bYaw;
          group.add(tie);
        }
      }
      continue;
    }

    const roadTex =
      seg.kind === 'arterial'
        ? tex.boulevard4Lane
        : seg.kind === 'street'
          ? tex.collector2Lane
          : tex.alleyCobble;
    const microStagger = (segIdx % 11) * 0.003;
    const liftY = (seg.kind === 'arterial' ? 0.098 : seg.kind === 'street' ? 0.072 : 0.045) + microStagger;
    const polyOff = seg.kind === 'arterial' ? -3 : seg.kind === 'street' ? -2 : -1;
    group.add(buildStreetRibbonMesh(seg, baseY, centerX, centerZ, roadTex, getGroundHeight, liftY, polyOff));

    // Lush Detailed Pixel-Art Trees + Multi-Layered Berry Bushes & Wildflowers (matching the rich pixel trees 100%!)
    const segLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const dirX = (seg.x2 - seg.x1) / Math.max(0.01, segLen);
    const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, segLen);
    const nx = -dirZ;
    const nz = dirX;
    const isNearAnyJunction = (wx: number, wz: number, rad = 20) =>
      layout.junctions.some((jn) => Math.hypot(jn.x - wx, jn.z - wz) < rad);
    const pickDetailedShrubTex = (idx: number) =>
      idx % 4 === 3
        ? floraTex.flowers[idx % floraTex.flowers.length] ?? floraTex.flower
        : floraTex.bushes[idx % floraTex.bushes.length] ?? floraTex.bush;

    if (seg.kind === 'arterial' && segLen >= 16) {
      const medianSteps = Math.max(4, Math.floor((segLen - 4) / 2.6));
      for (let mi = 0; mi < medianSteps; mi++) {
        const f = 0.06 + (medianSteps > 1 ? (mi / (medianSteps - 1)) * 0.88 : 0.44);
        const mx = seg.x1 + dirX * (segLen * f);
        const mz = seg.z1 + dirZ * (segLen * f);
        if (isNearAnyJunction(mx, mz, 18) || isBlockedForGreenery(mx, mz, seg)) continue;
        const my = localGroundY(mx, mz) + 0.16;
        if (mi % 5 === 2) {
          const treeTex = floraTex.treeSprites[(mi + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
          spawnPixelGreenery(treeTex, mx - centerX, my, mz - centerZ, 5.2, 6.2);
        } else {
          const shrubTex = pickDetailedShrubTex(mi + segIdx + styleIdx);
          spawnPixelGreenery(shrubTex, mx - centerX, my, mz - centerZ, 2.25, 1.95);
        }
      }

      const vergeOff = seg.width * 0.5 - 3.9;
      const sideSteps = Math.max(4, Math.floor((segLen - 4) / 2.8));
      for (let si = 0; si < sideSteps; si++) {
        const f = 0.06 + (sideSteps > 1 ? (si / (sideSteps - 1)) * 0.88 : 0.44);
        const sx = seg.x1 + dirX * (segLen * f);
        const sz = seg.z1 + dirZ * (segLen * f);
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 19) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.16;
          if (si % 5 === 1) {
            const treeTex = floraTex.treeSprites[(si + styleIdx + (side > 0 ? 1 : 0)) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.9, 5.9);
          } else {
            const shrubTex = pickDetailedShrubTex(si + (side > 0 ? 2 : 0) + segIdx);
            spawnPixelGreenery(shrubTex, tx - centerX, ty, tz - centerZ, 2.05, 1.8);
          }
        }
      }
    }

    if (seg.kind === 'street' && segLen >= 14) {
      const vergeOff = seg.width * 0.5 - 2.3;
      const stepCount = Math.max(4, Math.floor((segLen - 4) / 3.0));
      for (let ti = 0; ti < stepCount; ti++) {
        const tFrac = 0.08 + (stepCount > 1 ? (ti / (stepCount - 1)) * 0.84 : 0.42);
        const sx = seg.x1 + dirX * (segLen * tFrac);
        const sz = seg.z1 + dirZ * (segLen * tFrac);
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 15) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.16;
          if (ti % 5 === 0) {
            const treeTex = floraTex.treeSprites[(ti + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.5, 5.4);
          } else {
            const shrubTex = pickDetailedShrubTex(ti + (side > 0 ? 3 : 0) + segIdx);
            spawnPixelGreenery(shrubTex, tx - centerX, ty, tz - centerZ, 1.85, 1.65);
          }
        }
      }
    }
  }

  // 1A-PLUS. REAL 3D ELEVATED URBAN VIADUCT / EXPRESSWAY (城市高架快速路 — ONLY on connected continuous chains with sloped ramps & full pier support, ZERO floating dead-end slabs!)
  const landArterials = layout.streets.filter((s) => !s.isBridge && s.kind === 'arterial');
  // Find the longest connected collinear/smooth chain of arterial segments!
  let bestChain: TownStreetSeg[] = [];
  for (const startSeg of landArterials) {
    const chain: TownStreetSeg[] = [startSeg];
    const used = new Set<TownStreetSeg>([startSeg]);
    let grew = true;
    while (grew && chain.length < 10) {
      grew = false;
      const tail = chain[chain.length - 1];
      const tdx = tail.x2 - tail.x1;
      const tdz = tail.z2 - tail.z1;
      const tLen = Math.hypot(tdx, tdz) || 1;
      for (const cand of landArterials) {
        if (used.has(cand)) continue;
        if (Math.hypot(cand.x1 - tail.x2, cand.z1 - tail.z2) < 6) {
          const cdx = cand.x2 - cand.x1;
          const cdz = cand.z2 - cand.z1;
          const cLen = Math.hypot(cdx, cdz) || 1;
          if ((tdx * cdx + tdz * cdz) / (tLen * cLen) > 0.78) {
            chain.push(cand);
            used.add(cand);
            grew = true;
            break;
          }
        }
      }
    }
    if (chain.length > bestChain.length) bestChain = chain;
  }

  const bestChainLen = bestChain.reduce((acc, s) => acc + Math.hypot(s.x2 - s.x1, s.z2 - s.z1), 0);
  const bridgeSegs = layout.streets.filter((s) => s.isBridge);
  if (bestChain.length >= 4 && bestChainLen >= 100) {
    // Architectural sunlit light-grey concrete with subtle neutral emissive so HemisphereLight's green ground bounce NEVER turns viaduct undersides dark green!
    const pierConcreteMat = applyPixelArtArchShader(
      new THREE.MeshLambertMaterial({ color: 0xcfd6e0, emissive: 0x3a404a, emissiveIntensity: 0.72 }),
    );
    const viaductUnderMat = new THREE.MeshLambertMaterial({
      color: 0xb8c1ce,
      emissive: 0x454c58,
      emissiveIntensity: 0.78,
    });
    const viaductGuardMat = applyPixelArtArchShader(
      new THREE.MeshLambertMaterial({ color: 0x768294, emissive: 0x1e222a, emissiveIntensity: 0.4 }),
    );
    // Rotate road texture 90° so the double-yellow centerline & lanes run LENGTHWISE along the viaduct deck!
    const viaductDeckTex = tex.collector2Lane.clone();
    viaductDeckTex.center.set(0.5, 0.5);
    viaductDeckTex.rotation = Math.PI / 2;
    viaductDeckTex.needsUpdate = true;
    const viaductDeckMat = new THREE.MeshLambertMaterial({ map: viaductDeckTex });
    const viaductLampMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
    const VIADUCT_H = 8.4;
    const VIADUCT_W = 12.6;

    // Clean, level elevated expressway soaring overhead at y = +8.4m on concrete T-piers placed STRICTLY on boulevard medians (NEVER inside intersections or colliding with river bridges!)
    for (let ci = 0; ci < bestChain.length; ci++) {
      const vSeg = bestChain[ci];
      const vLen = Math.hypot(vSeg.x2 - vSeg.x1, vSeg.z2 - vSeg.z1);
      if (vLen < 12) continue;
      const wMidX = (vSeg.x1 + vSeg.x2) * 0.5;
      const wMidZ = (vSeg.z1 + vSeg.z2) * 0.5;
      // Never collide with river bridges / cable-stayed towers!
      if (bridgeSegs.some((br) => distToSeg2D(wMidX, wMidZ, br.x1, br.z1, br.x2, br.z2) < 28)) continue;
      const vYaw = Math.atan2(vSeg.x2 - vSeg.x1, vSeg.z2 - vSeg.z1);
      const vmX = wMidX - centerX;
      const vmZ = wMidZ - centerZ;
      const vBaseY = localGroundY(wMidX, wMidZ);

      const spanGroup = new THREE.Group();
      spanGroup.position.set(vmX, vBaseY + VIADUCT_H, vmZ);
      spanGroup.rotation.y = vYaw;

      const deckGeo = new THREE.BoxGeometry(VIADUCT_W, 0.95, vLen + 1.2);
      const deck = new THREE.Mesh(deckGeo, [
        pierConcreteMat,
        pierConcreteMat,
        viaductDeckMat,
        viaductUnderMat,
        pierConcreteMat,
        pierConcreteMat,
      ]);
      deck.castShadow = true;
      deck.receiveShadow = true;
      deck.add(new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo, 30), INK_LINE_MAT));
      spanGroup.add(deck);

      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, vLen + 1.0), viaductGuardMat);
        rail.position.set(side * (VIADUCT_W * 0.48), 0.95, 0);
        rail.castShadow = true;
        spanGroup.add(rail);
      }
      group.add(spanGroup);
      viaductSpans.push({
        group: spanGroup,
        x1: vSeg.x1,
        z1: vSeg.z1,
        x2: vSeg.x2,
        z2: vSeg.z2,
        halfWidth: VIADUCT_W * 0.5 + 3.5,
        alpha: 1,
      });

      // Place concrete T-pier cleanly at the MIDPOINT of each span (on the boulevard's green center median — NEVER inside road intersections!)
      const pierClearOfJunction = !layout.junctions.some((jn) => Math.hypot(jn.x - wMidX, jn.z - wMidZ) < 17);
      if (pierClearOfJunction && getGroundHeight(wMidX, wMidZ) > WATER_LEVEL_3D + 0.3) {
        const py = localGroundY(wMidX, wMidZ);
        const col = new THREE.Mesh(new THREE.BoxGeometry(1.9, VIADUCT_H - 0.5, 1.9), pierConcreteMat);
        col.position.set(vmX, py + (VIADUCT_H - 0.5) * 0.5, vmZ);
        col.rotation.y = vYaw;
        col.castShadow = true;
        col.receiveShadow = true;
        // Symmetrical centered crossbeam cap snugly narrower than deck width (NEVER overhangs!)
        const cap = new THREE.Mesh(new THREE.BoxGeometry(VIADUCT_W * 0.76, 0.9, 1.9), pierConcreteMat);
        cap.position.set(vmX, py + VIADUCT_H - 0.88, vmZ);
        cap.rotation.y = vYaw;
        cap.castShadow = true;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.6, 6), viaductGuardMat);
        pole.position.set(vmX, py + VIADUCT_H + 2.2, vmZ);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 6, 6), viaductLampMat);
        bulb.position.set(vmX, py + VIADUCT_H + 4.1, vmZ);
        group.add(col, cap, pole, bulb);
        colliders.push(makeObbCollider(wMidX, wMidZ, 1.1, 1.1, vYaw, VIADUCT_H));
      }
    }
  }

  // 1B. Natural Curved Road Bends + True Multi-Arm Circular Hubs & Per-Arm Aligned Zebra Crosswalks (ZERO Square Crossroad Boxes!)
  const hubAsphaltMat = new THREE.MeshLambertMaterial({
    color: 0x3b414c,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  const hubCurbMat = new THREE.MeshLambertMaterial({
    color: 0xaeb6c2,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const zebraStripeMat = new THREE.MeshLambertMaterial({
    color: 0xf1f5f9,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.18,
    polygonOffset: true,
    polygonOffsetFactor: -7,
    polygonOffsetUnits: -7,
  });
  const signalPoleMat = new THREE.MeshLambertMaterial({ color: 0x343a40 });
  const signalBoxMat = new THREE.MeshLambertMaterial({ color: 0x1b1f26 });
  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff4d4f });
  const redOffMat = new THREE.MeshBasicMaterial({ color: 0x38191b });
  const amberOffMat = new THREE.MeshBasicMaterial({ color: 0x362d16 });
  const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x51cf66 });
  const greenOffMat = new THREE.MeshBasicMaterial({ color: 0x17331e });

  // Group all dry-land street endpoints into topological road nodes (within 7m) so BOTH 2-arm curves AND >=3-arm intersections blend seamlessly!
  interface RoadArmInfo {
    ux: number;
    uz: number;
    ang: number;
    width: number;
    isArterial: boolean;
  }
  const nodeMap = new Map<string, { x: number; z: number; arms: RoadArmInfo[] }>();
  for (const seg of layout.streets) {
    if (seg.isBridge) continue;
    // Only build detailed 3D intersection meshes within 620m of city center
    if (Math.hypot(seg.x1 - centerX, seg.z1 - centerZ) > 640 && Math.hypot(seg.x2 - centerX, seg.z2 - centerZ) > 640) {
      continue;
    }
    const sLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    if (sLen < 2) continue;
    const addArm = (nx: number, nz: number, ox: number, oz: number) => {
      let target: { x: number; z: number; arms: RoadArmInfo[] } | undefined;
      for (const nd of nodeMap.values()) {
        if (Math.hypot(nd.x - nx, nd.z - nz) <= 7.0) {
          target = nd;
          break;
        }
      }
      if (!target) {
        target = { x: nx, z: nz, arms: [] };
        nodeMap.set(`${Math.round(nx)},${Math.round(nz)}`, target);
      }
      const ux = (ox - target.x) / Math.max(0.01, Math.hypot(ox - target.x, oz - target.z));
      const uz = (oz - target.z) / Math.max(0.01, Math.hypot(ox - target.x, oz - target.z));
      // Deduplicate nearly identical arm angles
      if (!target.arms.some((a) => a.ux * ux + a.uz * uz > 0.94)) {
        target.arms.push({
          ux,
          uz,
          ang: Math.atan2(ux, uz),
          width: seg.width,
          isArterial: seg.kind === 'arterial',
        });
      }
    };
    addArm(seg.x1, seg.z1, seg.x2, seg.z2);
    addArm(seg.x2, seg.z2, seg.x1, seg.z1);
  }

  let ji = 0;
  for (const nd of nodeMap.values()) {
    if (nd.arms.length < 2) continue;
    if (getGroundHeight(nd.x, nd.z) < WATER_LEVEL_3D + 0.2) continue;
    const maxW = Math.max(...nd.arms.map((a) => a.width));
    const hubY = Math.max(WATER_LEVEL_3D + 0.25 - baseY, localGroundY(nd.x, nd.z) + 0.14);

    // Seamless circular sidewalk base + circular carriageway asphalt hub (rounds curves & intersections naturally — NO square boxes!)
    const sidewalkHub = new THREE.Mesh(new THREE.CircleGeometry(maxW * 0.5 + 0.2, 22), hubCurbMat);
    sidewalkHub.rotation.x = -Math.PI / 2;
    sidewalkHub.position.set(nd.x - centerX, hubY - 0.015, nd.z - centerZ);
    sidewalkHub.receiveShadow = true;
    const roadHub = new THREE.Mesh(new THREE.CircleGeometry(maxW * 0.37, 22), hubAsphaltMat);
    roadHub.rotation.x = -Math.PI / 2;
    roadHub.position.set(nd.x - centerX, hubY + 0.01, nd.z - centerZ);
    roadHub.receiveShadow = true;
    group.add(sidewalkHub, roadHub);

    // Only real intersections (>= 3 distinct road arms!) get per-arm aligned zebra crosswalks & traffic signals!
    if (nd.arms.length >= 3) {
      nd.arms.sort((a, b) => a.ang - b.ang);
      for (let ai = 0; ai < nd.arms.length; ai++) {
        const arm = nd.arms[ai];
        const prevArm = nd.arms[(ai - 1 + nd.arms.length) % nd.arms.length];
        const nextArm = nd.arms[(ai + 1) % nd.arms.length];
        const diffPrev = Math.acos(Math.max(-1, Math.min(1, arm.ux * prevArm.ux + arm.uz * prevArm.uz)));
        const diffNext = Math.acos(Math.max(-1, Math.min(1, arm.ux * nextArm.ux + arm.uz * nextArm.uz)));
        // Skip acute Y-merge ramps (< 50° separation) so highway merges stay smooth without crooked crosswalks!
        if (diffPrev < 0.87 || diffNext < 0.87) continue;

        const cwDist = maxW * 0.42 + 2.8;
        const cwx = nd.x + arm.ux * cwDist;
        const cwz = nd.z + arm.uz * cwDist;
        if (getGroundHeight(cwx, cwz) < WATER_LEVEL_3D + 0.25) continue;
        const cwy = Math.max(hubY + 0.02, localGroundY(cwx, cwz) + 0.16);

        const cwGroup = new THREE.Group();
        cwGroup.position.set(cwx - centerX, cwy, cwz - centerZ);
        cwGroup.rotation.y = arm.ang;

        const carriagewayW = arm.width * 0.68;
        const stripeCount = Math.max(4, Math.floor(carriagewayW / 1.55));
        const spanW = carriagewayW * 0.88;
        for (let si = 0; si < stripeCount; si++) {
          const sx = -spanW * 0.5 + (stripeCount > 1 ? (si / (stripeCount - 1)) * spanW : 0);
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 2.55), zebraStripeMat);
          bar.rotation.x = -Math.PI / 2;
          bar.position.set(sx, 0, 0);
          cwGroup.add(bar);
        }
        // Crisp stop-line slightly further back along the arm
        const stopLine = new THREE.Mesh(new THREE.PlaneGeometry(carriagewayW * 0.9, 0.36), zebraStripeMat);
        stopLine.rotation.x = -Math.PI / 2;
        stopLine.position.set(0, 0, 2.05);
        cwGroup.add(stopLine);
        group.add(cwGroup);

        // Place sleek traffic signal on the right-hand sidewalk curb of arterial arms!
        if (arm.isArterial && ai < 2) {
          const rNx = -arm.uz;
          const rNz = arm.ux;
          const sigX = cwx + rNx * (arm.width * 0.44);
          const sigZ = cwz + rNz * (arm.width * 0.44);
          const isGreenPhase = (ji + ai) % 2 === 0;
          const sig = new THREE.Group();
          sig.position.set(sigX - centerX, localGroundY(sigX, sigZ) + 0.14, sigZ - centerZ);
          sig.rotation.y = Math.atan2(-rNx, -rNz);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.8, 6), signalPoleMat);
          pole.position.y = 2.9;
          const cantArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.2), signalPoleMat);
          cantArm.position.set(0, 5.6, 1.5);
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.35, 0.42), signalBoxMat);
          head.position.set(0, 5.2, 2.9);
          const rL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), isGreenPhase ? redOffMat : redLightMat);
          rL.position.set(0, 5.56, 3.12);
          const yL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), amberOffMat);
          yL.position.set(0, 5.2, 3.12);
          const gL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), isGreenPhase ? greenLightMat : greenOffMat);
          gL.position.set(0, 4.84, 3.12);
          sig.add(pole, cantArm, head, rL, yL, gL);
          group.add(sig);
        }
      }
      ji += 1;
    }
  }

  // 1C. REAL LUSH URBAN PARKS (Zero Z-fighting or disappearing stone tiles at ANY distance!)
  // Uses explicit vertical height separation + renderOrder + NO aggressive polygonOffset on lower lawn layers!
  const parkBorderMat = new THREE.MeshLambertMaterial({
    map: tex.cobblePlaza,
  });
  const parkLawnMat = new THREE.MeshLambertMaterial({
    color: 0x51b748,
  });
  const parkWalkMat = new THREE.MeshLambertMaterial({
    map: tex.cobblePlaza,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pondWaterMat = new THREE.MeshLambertMaterial({
    color: 0x339af0,
    emissive: 0x1864ab,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const benchWoodMat = new THREE.MeshLambertMaterial({ color: 0x9c6644 });

  for (const pk of layout.parks) {
    const px = pk.x - centerX;
    const pz = pk.z - centerZ;
    const py = localGroundY(pk.x, pk.z);

    // Park stone border (py + 0.05) < lush lawn (py + 0.085) < cross footpaths (py + 0.125) < central plaza (py + 0.145)
    // With clean 3.5-4cm physical elevation steps & NO polygonOffset on lawn, footpaths NEVER disappear when walking close!
    const border = new THREE.Mesh(new THREE.PlaneGeometry(pk.w + 1.6, pk.d + 1.6), parkBorderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(px, py + 0.05, pz);
    border.receiveShadow = true;
    border.renderOrder = 1;

    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(pk.w, pk.d), parkLawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(px, py + 0.085, pz);
    lawn.receiveShadow = true;
    lawn.renderOrder = 2;

    const pathEW = new THREE.Mesh(new THREE.PlaneGeometry(pk.w - 0.4, 5.0), parkWalkMat);
    pathEW.rotation.x = -Math.PI / 2;
    pathEW.position.set(px, py + 0.125, pz);
    pathEW.receiveShadow = true;
    pathEW.renderOrder = 3;

    const pathNS = new THREE.Mesh(new THREE.PlaneGeometry(5.0, pk.d - 0.4), parkWalkMat);
    pathNS.rotation.x = -Math.PI / 2;
    pathNS.position.set(px, py + 0.13, pz);
    pathNS.receiveShadow = true;
    pathNS.renderOrder = 4;
    group.add(border, lawn, pathEW, pathNS);

    // Sparkling park pond OR refined marble civic fountain in People's Square Park!
    if (pk.hasFountain) {
      const plazaPad = new THREE.Mesh(new THREE.CircleGeometry(10.5, 24), parkWalkMat);
      plazaPad.rotation.x = -Math.PI / 2;
      plazaPad.position.set(px, py + 0.145, pz);
      plazaPad.receiveShadow = true;
      plazaPad.renderOrder = 5;
      group.add(plazaPad);
      const fountain = createPlazaFountain(fountains);
      fountain.position.set(px, py + 0.145, pz);
      group.add(fountain);
      colliders.push(makeObbCollider(pk.x, pk.z, 5.2, 5.2, 0, 6.5));
    } else if (pk.hasPond) {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(11.5, 20), pondWaterMat);
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(px, py + 0.145, pz);
      pond.renderOrder = 5;
      group.add(pond);
    }

    // Wooden park benches & lush hand-drawn Pixel-Art Trees around park quadrants!
    for (let qi = 0; qi < 4; qi++) {
      const sx = qi % 2 === 0 ? -1 : 1;
      const sz = qi < 2 ? -1 : 1;
      const bx = px + sx * (pk.w * 0.24);
      const bz = pz + sz * (pk.d * 0.24);
      const bench = new THREE.Group();
      bench.position.set(bx, py + 0.13, bz);
      bench.rotation.y = Math.atan2(-sx, -sz);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.24, 1.0), benchWoodMat);
      seat.position.y = 0.52;
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.72, 0.2), benchWoodMat);
      back.position.set(0, 0.9, -0.42);
      bench.add(seat, back);
      group.add(bench);

      const tx = px + sx * (pk.w * 0.36);
      const tz = pz + sz * (pk.d * 0.34);
      const pTreeTex = floraTex.treeSprites[(qi + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
      spawnPixelGreenery(pTreeTex, tx, py + 0.14, tz, 6.4, 7.6);
      const flTex = floraTex.flowers[qi % floraTex.flowers.length] ?? floraTex.flower;
      spawnPixelGreenery(flTex, tx - sx * 2.2, py + 0.14, tz - sz * 1.4, 1.9, 1.7);
    }
  }

  // 2. Mount ALL Street-Aligned Building Lots from the Procedural Subdivision Graph!
  for (const lot of layout.lots) {
    const lx = lot.x - centerX;
    const lz = lot.z - centerZ;
    const ly = localGroundY(lot.x, lot.z);

    if (lot.kind === 'pokemon_center') {
      const intId = `${lot.id}_int`;
      const built = buildUnifiedWalkInBuilding3D({
        kind: 'pokemon_center',
        interiorId: intId,
        lotX: lot.x,
        lotZ: lot.z,
        localX: lx,
        localY: ly,
        localZ: lz,
        baseWorldY: baseY + ly,
        width: lot.width,
        depth: lot.depth,
        rotY: lot.rotY,
        floorTex: tex.clinicFloor,
        woodFloorTex: tex.woodFloor,
        onRegisterSpinner: (obj) => spinners.push(obj),
      });
      group.add(built.shellGroup);
      colliders.push(...built.colliders);
      autoDoors.push(...built.autoDoors);
      if (built.stairZone) upperFloorZones.push(built.stairZone);
      interiors.push({
        id: intId,
        name: `${townName}·宝可梦中心`,
        kind: 'pokemon_center',
        cx: lot.x,
        cz: lot.z,
        halfW: lot.width * 0.48,
        halfD: lot.depth * 0.48,
        rotY: lot.rotY,
        baseY: baseY + ly,
        stories: built.stories,
        floor1CeilingY: built.floor1CeilingY,
        floor2CeilingY: built.floor2CeilingY,
        dualDoors: built.dualDoors,
        bounds: {
          minX: lot.x - lot.width * 0.54,
          maxX: lot.x + lot.width * 0.54,
          minZ: lot.z - lot.depth * 0.54,
          maxZ: lot.z + lot.depth * 0.54,
        },
        exteriorGroup: built.shellGroup,
        interiorGroup: built.shellGroup,
        npcSprites: built.npcs,
        cutawayAlpha: 1,
      });
      interactPoints.push({
        id: `${id}_pc`,
        townName,
        kind: 'pokemon_center',
        label: `🏥 乔伊小姐 · 宝可梦中心`,
        hint: '全队免费治疗并补满伤药（可走楼梯上 2F 联机沙龙）',
        x: lot.x,
        z: lot.z,
        radius: 17.5,
      });
    } else if (lot.kind === 'poke_mart') {
      const intId = `${lot.id}_int`;
      const built = buildUnifiedWalkInBuilding3D({
        kind: 'poke_mart',
        interiorId: intId,
        lotX: lot.x,
        lotZ: lot.z,
        localX: lx,
        localY: ly,
        localZ: lz,
        baseWorldY: baseY + ly,
        width: lot.width,
        depth: lot.depth,
        rotY: lot.rotY,
        signTex: tex.martSign,
        floorTex: tex.martFloor,
        woodFloorTex: tex.woodFloor,
      });
      group.add(built.shellGroup);
      colliders.push(...built.colliders);
      autoDoors.push(...built.autoDoors);
      if (built.stairZone) upperFloorZones.push(built.stairZone);
      interiors.push({
        id: intId,
        name: `${townName}·友好百货商店`,
        kind: 'poke_mart',
        cx: lot.x,
        cz: lot.z,
        halfW: lot.width * 0.48,
        halfD: lot.depth * 0.48,
        rotY: lot.rotY,
        baseY: baseY + ly,
        stories: built.stories,
        floor1CeilingY: built.floor1CeilingY,
        floor2CeilingY: built.floor2CeilingY,
        dualDoors: built.dualDoors,
        bounds: {
          minX: lot.x - lot.width * 0.54,
          maxX: lot.x + lot.width * 0.54,
          minZ: lot.z - lot.depth * 0.54,
          maxZ: lot.z + lot.depth * 0.54,
        },
        exteriorGroup: built.shellGroup,
        interiorGroup: built.shellGroup,
        npcSprites: built.npcs,
        cutawayAlpha: 1,
      });
      interactPoints.push({
        id: `${id}_mart`,
        townName,
        kind: 'poke_mart',
        label: `🏪 友好百货店员`,
        hint: '打开精品外观与树果补给商店',
        x: lot.x,
        z: lot.z,
        radius: 17.5,
      });
    } else if (lot.kind === 'hotel') {
      const intId = `${lot.id}_int`;
      const built = buildUnifiedWalkInBuilding3D({
        kind: 'hotel',
        interiorId: intId,
        lotX: lot.x,
        lotZ: lot.z,
        localX: lx,
        localY: ly,
        localZ: lz,
        baseWorldY: baseY + ly,
        width: lot.width,
        depth: lot.depth,
        rotY: lot.rotY,
        signTex: tex.hotelSign,
        floorTex: tex.woodFloor,
        woodFloorTex: tex.woodFloor,
      });
      group.add(built.shellGroup);
      colliders.push(...built.colliders);
      autoDoors.push(...built.autoDoors);
      if (built.stairZone) upperFloorZones.push(built.stairZone);
      interiors.push({
        id: intId,
        name: `${townName}·驿站大酒店`,
        kind: 'hotel',
        cx: lot.x,
        cz: lot.z,
        halfW: lot.width * 0.48,
        halfD: lot.depth * 0.48,
        rotY: lot.rotY,
        baseY: baseY + ly,
        stories: built.stories,
        floor1CeilingY: built.floor1CeilingY,
        floor2CeilingY: built.floor2CeilingY,
        dualDoors: built.dualDoors,
        bounds: {
          minX: lot.x - lot.width * 0.54,
          maxX: lot.x + lot.width * 0.54,
          minZ: lot.z - lot.depth * 0.54,
          maxZ: lot.z + lot.depth * 0.54,
        },
        exteriorGroup: built.shellGroup,
        interiorGroup: built.shellGroup,
        npcSprites: built.npcs,
        cutawayAlpha: 1,
      });
      interactPoints.push({
        id: `${id}_hotel`,
        townName,
        kind: 'hotel_rest',
        label: `🏨 ${townName}·驿站大酒店 (1F大堂 / 2F客房)`,
        hint: '可上二楼豪华客房休整，全队体力回满并获攻击强化',
        x: lot.x,
        z: lot.z,
        radius: 19.0,
      });
    } else if (lot.kind === 'restaurant') {
      const intId = `${lot.id}_int`;
      const built = buildUnifiedWalkInBuilding3D({
        kind: 'restaurant',
        interiorId: intId,
        lotX: lot.x,
        lotZ: lot.z,
        localX: lx,
        localY: ly,
        localZ: lz,
        baseWorldY: baseY + ly,
        width: lot.width,
        depth: lot.depth,
        rotY: lot.rotY,
        signTex: tex.cafeSign,
        floorTex: tex.woodFloor,
        woodFloorTex: tex.woodFloor,
      });
      group.add(built.shellGroup);
      colliders.push(...built.colliders);
      autoDoors.push(...built.autoDoors);
      if (built.stairZone) upperFloorZones.push(built.stairZone);
      interiors.push({
        id: intId,
        name: `${townName}·树果料理餐厅`,
        kind: 'restaurant',
        cx: lot.x,
        cz: lot.z,
        halfW: lot.width * 0.48,
        halfD: lot.depth * 0.48,
        rotY: lot.rotY,
        baseY: baseY + ly,
        stories: built.stories,
        floor1CeilingY: built.floor1CeilingY,
        floor2CeilingY: built.floor2CeilingY,
        dualDoors: built.dualDoors,
        bounds: {
          minX: lot.x - lot.width * 0.54,
          maxX: lot.x + lot.width * 0.54,
          minZ: lot.z - lot.depth * 0.54,
          maxZ: lot.z + lot.depth * 0.54,
        },
        exteriorGroup: built.shellGroup,
        interiorGroup: built.shellGroup,
        npcSprites: built.npcs,
        cutawayAlpha: 1,
      });
      interactPoints.push({
        id: `${id}_cafe`,
        townName,
        kind: 'restaurant',
        label: `🍜 ${townName}·树果料理餐厅`,
        hint: '享用热腾腾的树果料理，提升全队斗志',
        x: lot.x,
        z: lot.z,
        radius: 17.0,
      });
    } else if (lot.kind === 'landmark' && anchor.landmarkCityId) {
      const lm = buildWorldLandmark3D(anchor.landmarkCityId);
      if (lm) {
        lm.position.set(lx, ly, lz);
        lm.scale.setScalar(1.58);
        group.add(lm);
        colliders.push(makeObbCollider(lot.x, lot.z, 11.2, 11.2, 0, 44));
      }
    } else if (lot.kind === 'skyscraper' || (lot.kind === 'house' && !lot.walkable && lot.shape && lot.shape !== 'rect')) {
      const isSkyTower = lot.kind === 'skyscraper';
      const bShape = lot.shape ?? 'rect';
      // Warm entrance light pool at +Z front door for every tower & corner building!
      const entPool = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 9.5), BUILDING_ENTRANCE_POOL_MAT);
      entPool.rotation.x = -Math.PI / 2;
      entPool.position.set(
        lx + Math.sin(lot.rotY) * (lot.depth * 0.48),
        ly + 0.08,
        lz + Math.cos(lot.rotY) * (lot.depth * 0.48),
      );
      group.add(entPool);

      if (bShape === 'cylinder') {
        // Modern Panoramic Cylindrical Glass Rotunda Building (`现代圆柱形全景玻璃幕墙塔楼`)!
        const rad = Math.min(lot.width, lot.depth) * 0.46;
        const storiesCnt = isSkyTower ? 10 + (lot.houseVariant % 4) * 2 : 3 + (lot.houseVariant % 3);
        const floorH = 4.1;
        const totH = storiesCnt * floorH;
        const cylGrp = new THREE.Group();
        cylGrp.position.set(lx, ly, lz);
        cylGrp.rotation.y = lot.rotY;
        const bodyMat = applyPixelArtArchShader(
          new THREE.MeshLambertMaterial({ color: isSkyTower ? 0xdbeafe : 0xf1ebe1 }),
        );
        const mulMat = new THREE.MeshLambertMaterial({ color: 0x1e2533 });
        const core = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.94, rad * 0.96, totH, 24), bodyMat);
        core.position.y = totH * 0.5;
        core.castShadow = true;
        core.receiveShadow = true;
        cylGrp.add(core);

        for (let s = 0; s < storiesCnt; s++) {
          const sy = s * floorH;
          const glassRing = new THREE.Mesh(
            new THREE.CylinderGeometry(rad, rad, floorH * 0.74, 24, 1, true),
            ADAPTIVE_NIGHT_WINDOW_MAT,
          );
          glassRing.position.y = sy + floorH * 0.52;
          const slabBand = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, 0.42, 24), mulMat);
          slabBand.position.y = sy + floorH;
          cylGrp.add(glassRing, slabBand);
        }
        for (let m = 0; m < 12; m++) {
          const ma = (m / 12) * Math.PI * 2;
          const mul = new THREE.Mesh(new THREE.BoxGeometry(0.16, totH, 0.24), mulMat);
          mul.position.set(Math.sin(ma) * rad, totH * 0.5, Math.cos(ma) * rad);
          mul.rotation.y = ma;
          cylGrp.add(mul);
        }
        if (isSkyTower) {
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4d4f }));
          beacon.position.set(0, totH + 1.2, 0);
          cylGrp.add(beacon);
        }
        group.add(cylGrp);
        colliders.push(makeObbCollider(lot.x, lot.z, rad * 0.92, rad * 0.92, lot.rotY, totH));
      } else if (bShape === 'triangle') {
        // Iconic Wukang-Mansion / Flatiron Wedge Building (`武康大楼/熨斗式三角街角全景落地窗建筑`)!
        const hw = lot.width * 0.46;
        const hd = lot.depth * 0.46;
        const tipW = hw * 0.26;
        const storiesCnt = isSkyTower ? 9 + (lot.houseVariant % 4) * 2 : 3 + (lot.houseVariant % 3);
        const floorH = 4.1;
        const totH = storiesCnt * floorH;

        const wedgeShape = new THREE.Shape();
        wedgeShape.moveTo(-hw, -hd);
        wedgeShape.lineTo(hw, -hd);
        wedgeShape.lineTo(tipW, hd);
        wedgeShape.lineTo(-tipW, hd);
        wedgeShape.closePath();

        const triGrp = new THREE.Group();
        triGrp.position.set(lx, ly, lz);
        triGrp.rotation.y = lot.rotY;

        const wallPalette = isSkyTower ? 0xe2e8f0 : [0xe8d5c4, 0xf3e8d8, 0xd8e2dc][lot.houseVariant % 3];
        const wMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: wallPalette }));
        const mulMat = new THREE.MeshLambertMaterial({ color: 0x222938 });

        for (let s = 0; s < storiesCnt; s++) {
          const sy = s * floorH;
          const spandrelGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.75, bevelEnabled: false });
          spandrelGeo.rotateX(Math.PI / 2);
          const spandrel = new THREE.Mesh(spandrelGeo, wMat);
          spandrel.position.y = sy + 0.75;
          spandrel.castShadow = true;
          spandrel.receiveShadow = true;

          const glassGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: floorH - 0.85, bevelEnabled: false });
          glassGeo.rotateX(Math.PI / 2);
          glassGeo.scale(0.985, 1, 0.985);
          const glassMesh = new THREE.Mesh(glassGeo, ADAPTIVE_NIGHT_WINDOW_MAT);
          glassMesh.position.y = sy + floorH - 0.08;

          const corniceGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 0.24, bevelEnabled: false });
          corniceGeo.rotateX(Math.PI / 2);
          corniceGeo.scale(1.02, 1, 1.02);
          const cornice = new THREE.Mesh(corniceGeo, mulMat);
          cornice.position.y = sy + floorH;
          triGrp.add(spandrel, glassMesh, cornice);
        }
        group.add(triGrp);
        colliders.push(makeObbCollider(lot.x, lot.z, hw * 0.78, hd * 0.88, lot.rotY, totH));
      } else {
        // Rectangular Real CC0 Kenney 3D Skyscrapers (`building-skyscraper-a..e.glb`) with glowing night windows!
        const skyPool = [
          '/models/city-commercial/building-skyscraper-a.glb',
          '/models/city-commercial/building-skyscraper-b.glb',
          '/models/city-commercial/building-skyscraper-c.glb',
          '/models/city-commercial/building-skyscraper-d.glb',
          '/models/city-commercial/building-skyscraper-e.glb',
        ];
        const skyUrl = skyPool[lot.houseVariant % skyPool.length];
        const skyTintList: (number | undefined)[] = [undefined, 0xe7f5ff, 0xfff3d6];
        void mountGlbModel(group, skyUrl, {
          x: lx,
          y: ly,
          z: lz,
          rotY: lot.rotY,
          targetWidth: lot.width * 0.90,
          targetDepth: lot.depth * 0.88,
          heightMult: 1.05 + (lot.houseVariant % 3) * 0.12,
          tintHex: skyTintList[lot.houseVariant % skyTintList.length],
          addInkEdges: true,
          cloneMaterials: true,
          onMounted: (wrapper, h) => {
            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4d4f }));
            beacon.position.set(0, h + 0.65, 0);
            wrapper.add(beacon);
          },
        });
        colliders.push(makeObbCollider(lot.x, lot.z, lot.width * 0.45, lot.depth * 0.44, lot.rotY, 54));
      }
    } else if (lot.kind === 'house') {
      const hHash = Math.abs(anchor.seed * 19 + lot.houseVariant * 37 + Math.round(lot.x) * 7 + Math.round(lot.z) * 13);
      const styleDef = DIVERSE_HOUSE_STYLES[hHash % DIVERSE_HOUSE_STYLES.length];
      const facadeTint = FACADE_TINT_PALETTE[(hHash >>> 3) % FACADE_TINT_PALETTE.length];
      const attachShopSign = styleDef.isFlatUrban && hHash % 3 === 0;
      const signTex = tex.extraSigns[hHash % tex.extraSigns.length];
      const varHeightMult = styleDef.heightMult * (styleDef.isFlatUrban ? 0.78 : 0.56);

      if (lot.walkable) {
        const intId = `${lot.id}_int`;
        const aptIndex = interiors.filter((b) => b.kind === 'house').length + 1;
        const built = buildUnifiedWalkInBuilding3D({
          kind: 'house',
          interiorId: intId,
          lotX: lot.x,
          lotZ: lot.z,
          localX: lx,
          localY: ly,
          localZ: lz,
          baseWorldY: baseY + ly,
          width: lot.width,
          depth: lot.depth,
          rotY: lot.rotY,
          floorTex: tex.woodFloor,
          woodFloorTex: tex.woodFloor,
        });
        group.add(built.shellGroup);
        colliders.push(...built.colliders);
        autoDoors.push(...built.autoDoors);
        if (built.stairZone) upperFloorZones.push(built.stairZone);
        interiors.push({
          id: intId,
          name: `${townName}·训练家复式公寓 ${aptIndex}号`,
          kind: 'house',
          cx: lot.x,
          cz: lot.z,
          halfW: lot.width * 0.48,
          halfD: lot.depth * 0.48,
          rotY: lot.rotY,
          baseY: baseY + ly,
          stories: built.stories,
          floor1CeilingY: built.floor1CeilingY,
          floor2CeilingY: built.floor2CeilingY,
          dualDoors: built.dualDoors,
          bounds: {
            minX: lot.x - lot.width * 0.54,
            maxX: lot.x + lot.width * 0.54,
            minZ: lot.z - lot.depth * 0.54,
            maxZ: lot.z + lot.depth * 0.54,
          },
          exteriorGroup: built.shellGroup,
          interiorGroup: built.shellGroup,
          npcSprites: built.npcs,
          cutawayAlpha: 1,
        });
        const foyerWorldX = lot.x + Math.sin(lot.rotY) * (lot.depth * 0.16);
        const foyerWorldZ = lot.z + Math.cos(lot.rotY) * (lot.depth * 0.16);
        interactPoints.push({
          id: `${lot.id}_npc`,
          townName,
          kind: 'npc_chat',
          label: `💬 与公寓居民交谈`,
          hint: '打听城市地标与周边情报（可走楼梯上 2F 卧室与书房）',
          dialogText: `🏠 城市居民：「欢迎来${townName}训练家复式公寓 ${aptIndex}号做客！走左侧楼梯可以上二楼卧室与书房看看哦！」`,
          x: foyerWorldX,
          z: foyerWorldZ,
          radius: 9.5,
        });
      } else {
        // Warm porch light pool outside every non-walkable urban house / shop!
        const porchPool = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 7.5), BUILDING_ENTRANCE_POOL_MAT);
        porchPool.rotation.x = -Math.PI / 2;
        porchPool.position.set(
          lx + Math.sin(lot.rotY) * (lot.depth * 0.48),
          ly + 0.07,
          lz + Math.cos(lot.rotY) * (lot.depth * 0.48),
        );
        group.add(porchPool);

        void mountGlbModel(group, styleDef.url, {
          x: lx,
          y: ly,
          z: lz,
          rotY: lot.rotY,
          targetWidth: lot.width * 0.92,
          targetDepth: lot.depth * 0.90,
          heightMult: varHeightMult,
          tintHex: facadeTint,
          addInkEdges: true,
          onMounted: (wrapper, h) => {
            // Warm glowing front entrance sconce lantern on every house!
            const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), STREET_LAMP_BULB_MAT);
            sconce.position.set(0, Math.min(3.4, h * 0.35), lot.depth * 0.44);
            const sconceHalo = new THREE.Sprite(STREET_LAMP_HALO_MAT);
            sconceHalo.scale.set(2.8, 2.8, 1);
            sconceHalo.position.copy(sconce.position);
            wrapper.add(sconce, sconceHalo);

            if (attachShopSign) {
              const sign = new THREE.Mesh(
                new THREE.BoxGeometry(8.8, 2.5, 0.42),
                new THREE.MeshBasicMaterial({ map: signTex }),
              );
              sign.position.set(0, h + 1.45, lot.depth * 0.30);
              const postL = new THREE.Mesh(
                new THREE.BoxGeometry(0.28, 1.4, 0.28),
                new THREE.MeshLambertMaterial({ color: 0x343a40 }),
              );
              postL.position.set(-3.2, h + 0.55, lot.depth * 0.30);
              const postR = postL.clone();
              postR.position.x = 3.2;
              wrapper.add(sign, postL, postR);
            }
          },
        });
        colliders.push(makeObbCollider(lot.x, lot.z, lot.width * 0.45, lot.depth * 0.44, lot.rotY, 16.5));
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
  const streetLampPositions: { x: number; y: number; z: number }[] = [];
  const lampPoolGeo = new THREE.PlaneGeometry(10.8, 10.8);
  lampPoolGeo.rotateX(-Math.PI / 2);
  for (const lamp of layout.streetLamps) {
    const lampBaseLocalY = localGroundY(lamp.x, lamp.z);
    const lampWorldY = baseY + lampBaseLocalY + 5.8;
    streetLampPositions.push({ x: lamp.x, y: lampWorldY, z: lamp.z });

    // Ground warm golden streetlight pool on sidewalk & asphalt!
    const pool = new THREE.Mesh(lampPoolGeo, STREET_LAMP_POOL_MAT);
    pool.position.set(
      lamp.x - centerX + Math.sin(lamp.rotY) * 1.4,
      lampBaseLocalY + 0.08,
      lamp.z - centerZ + Math.cos(lamp.rotY) * 1.4,
    );
    group.add(pool);

    void mountGlbModel(group, '/models/town/roads/lamp-curved.glb', {
      x: lamp.x - centerX,
      y: lampBaseLocalY,
      z: lamp.z - centerZ,
      rotY: lamp.rotY,
      targetWidth: 3.4,
      heightMult: 1.36,
      addInkEdges: true,
      onMounted: (wrapper, h) => {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), STREET_LAMP_BULB_MAT);
        bulb.position.set(0, h * 0.92, 0.96);
        const halo = new THREE.Sprite(STREET_LAMP_HALO_MAT);
        halo.scale.set(4.2, 4.2, 1);
        halo.position.copy(bulb.position);
        wrapper.add(bulb, halo);
      },
    });
  }

  // 5. LIVE CITY LIFE: Dynamically Routed Cruising Pixel-Shaded Taxis STRICTLY on Dry Land Avenues (NEVER submerged in rivers!)
  const carColors = [0x3bc9db, 0xffd43b, 0xfa5252, 0xf8f9fa, 0x339af0, 0x51cf66];
  const carConfigs: { axis: 'x' | 'z'; laneOffset: number; dir: 1 | -1; minC: number; maxC: number; start: number; spd: number }[] = [];
  const isRouteDryLand = (axis: 'x' | 'z', laneOff: number, minC: number, maxC: number) => {
    for (let k = 0; k <= 4; k++) {
      const c = minC + ((maxC - minC) * k) / 4;
      const wx = axis === 'x' ? centerX + c : centerX + laneOff;
      const wz = axis === 'z' ? centerZ + c : centerZ + laneOff;
      if (getGroundHeight(wx, wz) < WATER_LEVEL_3D + 0.55) return false;
    }
    return true;
  };
  for (const seg of layout.streets) {
    if (carConfigs.length >= 6) break;
    if (seg.isBridge) continue;
    const dxS = seg.x2 - seg.x1;
    const dzS = seg.z2 - seg.z1;
    const lenS = Math.hypot(dxS, dzS);
    if (lenS < 44) continue;
    const isMainNS = Math.abs(dzS) > Math.abs(dxS) * 2.2;
    const isMainEW = Math.abs(dxS) > Math.abs(dzS) * 2.2;
    if (!isMainNS && !isMainEW) continue;
    const dir: 1 | -1 = carConfigs.length % 2 === 0 ? 1 : -1;
    if (isMainNS) {
      const avgX = (seg.x1 + seg.x2) * 0.5 - centerX + dir * 3.8;
      const minZ = Math.min(seg.z1, seg.z2) - centerZ + 6;
      const maxZ = Math.max(seg.z1, seg.z2) - centerZ - 6;
      if (maxZ - minZ > 32 && isRouteDryLand('z', avgX, minZ, maxZ)) {
        carConfigs.push({
          axis: 'z',
          laneOffset: avgX,
          dir,
          minC: minZ,
          maxC: maxZ,
          start: minZ + ((carConfigs.length * 0.29 + 0.2) % 0.75) * (maxZ - minZ),
          spd: 10.4 + (carConfigs.length % 3) * 1.1,
        });
      }
    } else {
      const avgZ = (seg.z1 + seg.z2) * 0.5 - centerZ + dir * 3.6;
      const minX = Math.min(seg.x1, seg.x2) - centerX + 6;
      const maxX = Math.max(seg.x1, seg.x2) - centerX - 6;
      if (maxX - minX > 32 && isRouteDryLand('x', avgZ, minX, maxX)) {
        carConfigs.push({
          axis: 'x',
          laneOffset: avgZ,
          dir,
          minC: minX,
          maxC: maxX,
          start: minX + ((carConfigs.length * 0.31 + 0.15) % 0.75) * (maxX - minX),
          spd: 10.2 + (carConfigs.length % 3) * 1.0,
        });
      }
    }
  }
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

  // Strolling Authentic GBA FireRed 16x32 Pixel Citizens around the Grand Central Plaza & Wide Promenade Sidewalks!
  const citizenPool = [
    '/sprites/people/youngster.png',
    '/sprites/people/lass.png',
    '/sprites/people/picnicker.png',
    '/sprites/people/camper.png',
    '/sprites/people/cooltrainer_m.png',
    '/sprites/people/cooltrainer_f.png',
    '/sprites/people/woman_1.png',
    '/sprites/people/woman_2.png',
    '/sprites/people/man.png',
    '/sprites/people/gentleman.png',
    '/sprites/people/beauty.png',
    '/sprites/people/policeman.png',
    '/sprites/people/sailor.png',
  ];
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x10141c, transparent: true, opacity: 0.34, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(0.85, 12);
  shadowGeo.rotateX(-Math.PI / 2);

  // 1) Plaza strollers + 2) 32 Lively Sidewalk Pedestrians walking along downtown streets & civic storefronts!
  const pkCx = layout.plazaX - centerX;
  const pkCz = layout.plazaZ - centerZ;
  for (let wi = 0; wi < 6; wi++) {
    const spriteUrl = citizenPool[(wi + styleIdx) % citizenPool.length];
    const orbitR = 9.5 + (wi % 3) * 3.4;
    const initAng = (wi / 6) * Math.PI * 2;
    const wxCheck = centerX + pkCx + Math.cos(initAng) * orbitR;
    const wzCheck = centerZ + pkCz + Math.sin(initAng) * orbitR;
    if (getGroundHeight(wxCheck, wzCheck) < WATER_LEVEL_3D + 0.35) continue;
    const px = pkCx + Math.cos(initAng) * orbitR;
    const pz = pkCz + Math.sin(initAng) * orbitR;
    const py = localGroundY(centerX + px, centerZ + pz) + 0.16;
    const citizenMesh = createNpcBillboard(spriteUrl, px, py, pz, 2.45);
    const cShadow = new THREE.Mesh(shadowGeo, shadowMat);
    cShadow.position.set(px, py + 0.04, pz);
    group.add(citizenMesh, cShadow);
    walkers.push({
      mesh: citizenMesh,
      shadow: cShadow,
      walkFrames: getNpcWalkSpriteFrames(spriteUrl),
      mode: 'plaza_orbit',
      cx: pkCx,
      cz: pkCz,
      radius: orbitR,
      angle: initAng,
      speed: (wi % 2 === 0 ? 1 : -1) * (0.18 + (wi % 3) * 0.05),
      phase: wi * 1.3,
      baseY: py,
    });
  }

  // Spawn 32 sidewalk-patrolling citizens along dry downtown streets (closest first so spawn & shops feel bustling!)
  const patrolStreets = layout.streets
    .filter(
      (st) =>
        !st.isBridge &&
        st.kind !== 'alley' &&
        Math.hypot((st.x1 + st.x2) * 0.5 - centerX, (st.z1 + st.z2) * 0.5 - centerZ) < 340 &&
        Math.hypot(st.x2 - st.x1, st.z2 - st.z1) >= 24,
    )
    .sort(
      (a, b) =>
        Math.hypot((a.x1 + a.x2) * 0.5 - centerX, (a.z1 + a.z2) * 0.5 - centerZ) -
        Math.hypot((b.x1 + b.x2) * 0.5 - centerX, (b.z1 + b.z2) * 0.5 - centerZ),
    );
  let sidewalkCount = 0;
  for (let si = 0; si < patrolStreets.length && sidewalkCount < 32; si++) {
    const st = patrolStreets[si];
    const sdx = st.x2 - st.x1;
    const sdz = st.z2 - st.z1;
    const slen = Math.hypot(sdx, sdz);
    const ux = sdx / slen;
    const uz = sdz / slen;
    const nx = -uz;
    const nz = ux;
    const sideSign = si % 2 === 0 ? 1 : -1;
    const swOff = (st.width * 0.43) * sideSign;
    const trim = Math.min(8, slen * 0.2);
    const wx1 = st.x1 + ux * trim + nx * swOff;
    const wz1 = st.z1 + uz * trim + nz * swOff;
    const wx2 = st.x2 - ux * trim + nx * swOff;
    const wz2 = st.z2 - uz * trim + nz * swOff;
    const wMidX = (wx1 + wx2) * 0.5;
    const wMidZ = (wz1 + wz2) * 0.5;
    if (
      getGroundHeight(wx1, wz1) < WATER_LEVEL_3D + 0.4 ||
      getGroundHeight(wx2, wz2) < WATER_LEVEL_3D + 0.4 ||
      getGroundHeight(wMidX, wMidZ) < WATER_LEVEL_3D + 0.4
    ) {
      continue;
    }
    const spriteUrl = citizenPool[(sidewalkCount + styleIdx) % citizenPool.length];
    const lx1 = wx1 - centerX;
    const lz1 = wz1 - centerZ;
    const lx2 = wx2 - centerX;
    const lz2 = wz2 - centerZ;
    const initAng = (sidewalkCount * 0.77) % (Math.PI * 2);
    const t0 = 0.5 + 0.5 * Math.sin(initAng);
    const px = lx1 + (lx2 - lx1) * t0;
    const pz = lz1 + (lz2 - lz1) * t0;
    const py = localGroundY(centerX + px, centerZ + pz) + 0.16;
    const citizenMesh = createNpcBillboard(spriteUrl, px, py, pz, 2.48);
    const cShadow = new THREE.Mesh(shadowGeo, shadowMat);
    cShadow.position.set(px, py + 0.04, pz);
    group.add(citizenMesh, cShadow);
    const segSpan = Math.max(16, Math.hypot(lx2 - lx1, lz2 - lz1));
    walkers.push({
      mesh: citizenMesh,
      shadow: cShadow,
      walkFrames: getNpcWalkSpriteFrames(spriteUrl),
      mode: 'sidewalk_patrol',
      cx: (lx1 + lx2) * 0.5,
      cz: (lz1 + lz2) * 0.5,
      x1: lx1,
      z1: lz1,
      x2: lx2,
      z2: lz2,
      radius: segSpan * 0.5,
      angle: initAng,
      speed: (sidewalkCount % 2 === 0 ? 1 : -1) * (3.1 / (segSpan * 0.5)),
      phase: sidewalkCount * 0.9,
      baseY: py,
    });
    sidewalkCount += 1;
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
  const postboxMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
  const postCapMat = new THREE.MeshLambertMaterial({ color: 0x1e602c });

  // Place pixel vending machines & iconic green postal boxes safely along park entrances & sidewalks (zero road/water overlap!)
  const placedProps: { x: number; z: number }[] = [];
  for (let pi = 0; pi < layout.parks.length; pi++) {
    const pk = layout.parks[pi];
    const candidates: [number, number, number][] = [
      [pk.x - pk.w * 0.5 - 2.6, pk.z - 5, -Math.PI / 2],
      [pk.x + pk.w * 0.5 + 2.6, pk.z + 5, Math.PI / 2],
      [pk.x - 6, pk.z + pk.d * 0.5 + 2.6, 0],
    ];
    for (const [wx, wz, ry] of candidates) {
      if (getGroundHeight(wx, wz) < WATER_LEVEL_3D + 0.45) continue;
      if (layout.streets.some((s) => distToSeg2D(wx, wz, s.x1, s.z1, s.x2, s.z2) < s.width * 0.44)) continue;
      if (placedProps.some((p) => Math.hypot(p.x - wx, p.z - wz) < 8)) continue;
      placedProps.push({ x: wx, z: wz });
      if (placedProps.length % 2 === 1) {
        const vm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 1.0), vendMats);
        vm.position.set(wx - centerX, localGroundY(wx, wz) + 1.35, wz - centerZ);
        vm.rotation.y = ry;
        vm.castShadow = true;
        group.add(vm);
      } else {
        // Classic Pixel Street Postbox (邮政绿邮筒!)
        const pb = new THREE.Group();
        pb.position.set(wx - centerX, localGroundY(wx, wz) + 0.16, wz - centerZ);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, 1.65, 8), postboxMat);
        body.position.y = 0.85;
        body.castShadow = true;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.52, 0.22, 8), postCapMat);
        cap.position.y = 1.72;
        pb.add(body, cap);
        group.add(pb);
      }
    }
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
      x: layout.busX + Math.cos(layout.busRotY) * 5.2,
      z: layout.busZ - Math.sin(layout.busRotY) * 5.2,
      radius: 6.5,
    },
  );

  return {
    id,
    name: townName,
    centerX,
    centerZ,
    safeRadius: Math.max(layout.boundingRadius + 30, 340),
    group,
    interactPoints,
    colliders,
    interiors,
    autoDoors,
    upperFloorZones,
    streetLampPositions,
    viaductSpans,
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
