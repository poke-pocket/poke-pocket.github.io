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
 * World-Space HD-2D Pixel-Art Architecture Shader Hook v2:
 * - Crisp 15cm world-space pixel running-bond brick / tile masonry on vertical walls
 * - Crisp pixel shingle rows on roofs & ledges
 * - Ground-contact stone foundation AO shading so buildings sit solidly anchored on sidewalks
 * - Refined GBA 2x2 Bayer dither + HD-2D sunlit-warm / cool-shadow cel cohesion matching chibi sprites!
 */
function applyPixelArtArchShader(mat: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  mat.customProgramCacheKey = () => 'pk_pixel_arch_hd2d_v2';
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
vec3 pxCoord = floor(vArchWorldPos * 6.5);
float grain = 1.0;
if (abs(aNorm.y) < 0.55) {
  // Vertical facades: crisp pixel running-bond brick / stone courses + subtle architectural floor bands!
  float hCoord = abs(aNorm.x) > abs(aNorm.z) ? pxCoord.z : pxCoord.x;
  float rowIdx = floor(pxCoord.y * 0.333);
  float mortarH = step(2.62, mod(pxCoord.y, 3.0));
  float brickCol = floor((hCoord + mod(rowIdx, 2.0) * 3.0) * 0.1667);
  float mortarV = step(5.55, mod(hCoord + mod(rowIdx, 2.0) * 3.0, 6.0));
  float brickVar = (archHash21(vec2(brickCol, rowIdx)) - 0.5) * 0.115;
  float mortarMask = max(mortarH, mortarV);
  // Subtle stone plinth base ambient occlusion near ground level
  float groundAo = mix(0.86, 1.0, clamp((vArchWorldPos.y - 1.4) * 0.45, 0.0, 1.0));
  grain = (1.0 + brickVar - mortarMask * 0.095) * groundAo;
} else {
  // Roofs & horizontal trims: crisp pixel shingle / tile rows!
  float shingleRow = step(2.45, mod(pxCoord.x + pxCoord.z, 3.0));
  float tileVar = (archHash21(pxCoord.xz * 0.5) - 0.5) * 0.105;
  grain = 1.0 + tileVar - shingleRow * 0.075;
}
// Crisp GBA 2x2 Bayer pixel dither
float bayer = mod(pxCoord.x + pxCoord.y + pxCoord.z, 2.0) * 0.028 - 0.014;
diffuseColor.rgb *= clamp(grain + bayer, 0.78, 1.14);`,
      )
      .replace(
        '#include <dithering_fragment>',
        `// HD-2D cel-stepped tone cohesion + warm sunlight / cool-slate shadow tint
float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
float qLum = floor(lum * 8.0 + 0.5) / 8.0;
gl_FragColor.rgb *= mix(1.0, qLum / max(0.05, lum), 0.36);
vec3 coolShadowTint = vec3(0.92, 0.96, 1.06);
vec3 warmSunTint = vec3(1.04, 1.02, 0.96);
gl_FragColor.rgb *= mix(coolShadowTint, warmSunTint, smoothstep(0.32, 0.78, lum));
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
        const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
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
  const rugBand = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 0.42),
    new THREE.MeshBasicMaterial({ color: 0x1e222e }),
  );
  rugBand.rotation.x = -Math.PI / 2;
  rugBand.position.set(0, 0.155, 0.8);
  const rugCenter = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  rugCenter.rotation.x = -Math.PI / 2;
  rugCenter.position.set(0, 0.16, 0.8);
  g.add(rug, rugBand, rugCenter);

  const counterGeo = new THREE.BoxGeometry(w * 0.56, 1.35, 1.45);
  const counter = new THREE.Mesh(counterGeo, applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xf8f9fa })));
  counter.position.set(0, 0.72, -d * 0.24);
  counter.add(new THREE.LineSegments(new THREE.EdgesGeometry(counterGeo, 30), INK_LINE_MAT));
  const counterTopGeo = new THREE.BoxGeometry(w * 0.59, 0.22, 1.65);
  const counterTop = new THREE.Mesh(counterTopGeo, applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xfa5252 })));
  counterTop.position.set(0, 1.45, -d * 0.24);
  counterTop.add(new THREE.LineSegments(new THREE.EdgesGeometry(counterTopGeo, 30), INK_LINE_MAT));
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
  // Extend ribbon slightly past each endpoint to seal angled polyline miter joints (ZERO grass V-slivers at road bends!)
  const endPad = Math.min(2.6, Math.max(wStart, wEnd) * 0.12);
  const sx1 = seg.x1 - dirX * endPad;
  const sz1 = seg.z1 - dirZ * endPad;
  const sx2 = seg.x2 + dirX * endPad;
  const sz2 = seg.z2 + dirZ * endPad;
  const paddedDist = dist + endPad * 2;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

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
    const u = (t * paddedDist) / (seg.kind === 'arterial' ? 16.5 : 10.5);
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
      // REAL 3D RIVER BRIDGE (Nanpu Bridge / Yangpu Bridge / Waibaidu Red Steel Truss Bridge across Huangpu River & Suzhou Creek!)
      const bLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
      const bYaw = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1);
      const bMidX = (seg.x1 + seg.x2) * 0.5 - centerX;
      const bMidZ = (seg.z1 + seg.z2) * 0.5 - centerZ;
      const deckY = Math.max(1.8, baseY + 0.16) - baseY;
      const deckMesh = new THREE.Mesh(
        new THREE.BoxGeometry(seg.width, 0.45, bLen),
        new THREE.MeshLambertMaterial({ map: tex.collector2Lane }),
      );
      deckMesh.position.set(bMidX, deckY - 0.22, bMidZ);
      deckMesh.rotation.y = bYaw;
      deckMesh.receiveShadow = true;
      group.add(deckMesh);

      const railCol = seg.bridgeStyle === 'waibaidu' ? 0xc92a2a : 0x5c677d;
      const railMat = new THREE.MeshLambertMaterial({ color: railCol });
      const cableMat = new THREE.MeshBasicMaterial({ color: 0xe9ecef });
      const pierMat = new THREE.MeshLambertMaterial({ color: 0x868e96 });
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      const bDirX = (seg.x2 - seg.x1) / Math.max(0.01, bLen);
      const bDirZ = (seg.z2 - seg.z1) / Math.max(0.01, bLen);
      const bNx = -bDirZ;
      const bNz = bDirX;

      for (const side of [-1, 1]) {
        const rx = bMidX + bNx * side * (seg.width * 0.48);
        const rz = bMidZ + bNz * side * (seg.width * 0.48);
        const topBeam = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, seg.bridgeStyle === 'waibaidu' ? 1.1 : 1.15, bLen),
          railMat,
        );
        topBeam.position.set(rx, deckY + (seg.bridgeStyle === 'waibaidu' ? 3.2 : 0.6), rz);
        topBeam.rotation.y = bYaw;
        topBeam.castShadow = true;
        group.add(topBeam);

        // Waibaidu Bridge iconic red steel truss vertical posts + lower guard rail!
        if (seg.bridgeStyle === 'waibaidu') {
          const lowRail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.85, bLen), railMat);
          lowRail.position.set(rx, deckY + 0.45, rz);
          lowRail.rotation.y = bYaw;
          group.add(lowRail);
          const trussCount = Math.max(4, Math.floor(bLen / 7.5));
          for (let ti = 0; ti <= trussCount; ti++) {
            const f = -0.48 + (ti / trussCount) * 0.96;
            const px = rx + bDirX * (bLen * f);
            const pz = rz + bDirZ * (bLen * f);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.4, 0.42), railMat);
            post.position.set(px, deckY + 1.7, pz);
            post.rotation.y = bYaw;
            post.castShadow = true;
            group.add(post);
          }
        }

        // Bridge piers & Nanpu/Yangpu iconic cable-stayed towers + fan cables!
        for (const frac of [-0.32, 0, 0.32]) {
          const px = rx + bDirX * (bLen * frac);
          const pz = rz + bDirZ * (bLen * frac);
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 5.2, 8), pierMat);
          pier.position.set(px, deckY - 2.6, pz);
          group.add(pier);
          if (seg.bridgeStyle !== 'waibaidu' && Math.abs(frac) > 0.1) {
            const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.05, 17.5, 1.05), railMat);
            pylon.position.set(px, deckY + 8.7, pz);
            pylon.castShadow = true;
            group.add(pylon);
            // Fan stay-cables descending from pylon top to bridge deck!
            for (const cSpan of [-0.24, -0.14, 0.14, 0.24]) {
              const targetX = px + bDirX * (bLen * cSpan);
              const targetZ = pz + bDirZ * (bLen * cSpan);
              const dx = targetX - px;
              const dz = targetZ - pz;
              const dy = -15.6;
              const cLen = Math.hypot(dx, dy, dz);
              const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, cLen, 4), cableMat);
              cable.position.set((px + targetX) * 0.5, deckY + 16.4 + dy * 0.5, (pz + targetZ) * 0.5);
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
      // Overhead steel portal beams across Waibaidu Bridge & cable-stayed pylons!
      if (seg.bridgeStyle === 'waibaidu') {
        for (const f of [-0.36, 0, 0.36]) {
          const cxB = bMidX + bDirX * (bLen * f);
          const czB = bMidZ + bDirZ * (bLen * f);
          const cross = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.52, 0.52), railMat);
          cross.position.set(cxB, deckY + 3.55, czB);
          cross.rotation.y = bYaw;
          group.add(cross);
        }
      } else {
        for (const f of [-0.32, 0.32]) {
          const cxB = bMidX + bDirX * (bLen * f);
          const czB = bMidZ + bDirZ * (bLen * f);
          const tie = new THREE.Mesh(new THREE.BoxGeometry(seg.width, 0.9, 0.9), railMat);
          tie.position.set(cxB, deckY + 15.8, czB);
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
    // Crisp layered road elevations (+0.05 / +0.075 / +0.10 + micro-stagger) so intersecting segments NEVER Z-fight,
    // while characters walking at ground + 0.16 ALWAYS stand squarely ON TOP of every road & crosswalk!
    const microStagger = (segIdx % 7) * 0.002;
    const liftY = (seg.kind === 'arterial' ? 0.10 : seg.kind === 'street' ? 0.075 : 0.05) + microStagger;
    const polyOff = seg.kind === 'arterial' ? -4 : seg.kind === 'street' ? -2 : -1;
    group.add(buildStreetRibbonMesh(seg, baseY, centerX, centerZ, roadTex, getGroundHeight, liftY, polyOff));

    // Lush Dense Avenue Greenery: Tall Pixel Street Trees spaced every ~14m + Continuous Small Pixel Shrubs & Flowers in between!
    const segLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const dirX = (seg.x2 - seg.x1) / Math.max(0.01, segLen);
    const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, segLen);
    const nx = -dirZ;
    const nz = dirX;
    const isNearAnyJunction = (wx: number, wz: number, rad = 20) =>
      layout.junctions.some((jn) => Math.hypot(jn.x - wx, jn.z - wz) < rad);

    if (seg.kind === 'arterial' && segLen >= 16) {
      // A. Central Green Median: continuous tight hedge row (~2.2m spacing!) of 8 varied GBA urban shrubs + tall shade trees every ~13m!
      const medianSteps = Math.max(4, Math.floor((segLen - 4) / 2.2));
      for (let mi = 0; mi < medianSteps; mi++) {
        const f = 0.06 + (medianSteps > 1 ? (mi / (medianSteps - 1)) * 0.88 : 0.44);
        const mx = seg.x1 + dirX * (segLen * f);
        const mz = seg.z1 + dirZ * (segLen * f);
        if (isNearAnyJunction(mx, mz, 18) || isBlockedForGreenery(mx, mz, seg)) continue;
        const my = localGroundY(mx, mz) + 0.14;
        if (mi % 6 === 2) {
          const treeTex = floraTex.treeSprites[(mi + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
          spawnPixelGreenery(treeTex, mx - centerX, my, mz - centerZ, 5.2, 6.2);
        } else {
          // Rich landscaping band pattern (alternating green boxwood, red photinia, golden privet & flowering azalea!)
          const shrubIdx = (Math.floor(mi / 2) + segIdx + styleIdx) % tex.urbanShrubs.length;
          spawnPixelGreenery(tex.urbanShrubs[shrubIdx], mx - centerX, my, mz - centerZ, 2.15, 1.75);
        }
      }

      // B. BOTH Roadside Curb Verges (right along the edge between sidewalk & asphalt!): continuous tight urban shrub hedge (~2.3m) + tall shade trees (~14m)!
      const vergeOff = seg.width * 0.5 - 3.9;
      const sideSteps = Math.max(4, Math.floor((segLen - 4) / 2.3));
      for (let si = 0; si < sideSteps; si++) {
        const f = 0.06 + (sideSteps > 1 ? (si / (sideSteps - 1)) * 0.88 : 0.44);
        const sx = seg.x1 + dirX * (segLen * f);
        const sz = seg.z1 + dirZ * (segLen * f);
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 19) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.14;
          if (si % 6 === 1) {
            const treeTex = floraTex.treeSprites[(si + styleIdx + (side > 0 ? 1 : 0)) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.9, 5.9);
          } else {
            const shrubIdx = (Math.floor(si / 2) + (side > 0 ? 2 : 0) + segIdx) % tex.urbanShrubs.length;
            spawnPixelGreenery(tex.urbanShrubs[shrubIdx], tx - centerX, ty, tz - centerZ, 1.95, 1.6);
          }
        }
      }
    }

    // Collector Streets: Continuous neat urban shrub hedges (~2.5m) + spaced shade trees (~15m) on BOTH curb verges (ZERO logs!)
    if (seg.kind === 'street' && segLen >= 14) {
      const vergeOff = seg.width * 0.5 - 2.3;
      const stepCount = Math.max(4, Math.floor((segLen - 4) / 2.5));
      for (let ti = 0; ti < stepCount; ti++) {
        const tFrac = 0.08 + (stepCount > 1 ? (ti / (stepCount - 1)) * 0.84 : 0.42);
        const sx = seg.x1 + dirX * (segLen * tFrac);
        const sz = seg.z1 + dirZ * (segLen * tFrac);
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 15) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.14;
          const isTree = ti % 6 === 0;
          if (isTree) {
            const treeTex = floraTex.treeSprites[(ti + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.5, 5.4);
          } else {
            const shrubIdx = (Math.floor(ti / 2) + (side > 0 ? 3 : 0) + segIdx) % tex.urbanShrubs.length;
            spawnPixelGreenery(tex.urbanShrubs[shrubIdx], tx - centerX, ty, tz - centerZ, 1.75, 1.45);
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
  if (bestChain.length >= 4 && bestChainLen >= 90) {
    const pierConcreteMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xbec5cf }));
    const viaductGuardMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x707a8a }));
    const viaductDeckMat = new THREE.MeshLambertMaterial({ map: tex.collector2Lane });
    const viaductLampMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
    const VIADUCT_H = 7.4;
    const VIADUCT_W = 13.5;

    // First segment = sloped up-ramp (0 -> VIADUCT_H), middle segments = level elevated deck, last segment = sloped down-ramp (VIADUCT_H -> 0)!
    for (let ci = 0; ci < bestChain.length; ci++) {
      const vSeg = bestChain[ci];
      const vLen = Math.hypot(vSeg.x2 - vSeg.x1, vSeg.z2 - vSeg.z1);
      if (vLen < 10) continue;
      const vYaw = Math.atan2(vSeg.x2 - vSeg.x1, vSeg.z2 - vSeg.z1);
      const vDirX = (vSeg.x2 - vSeg.x1) / vLen;
      const vDirZ = (vSeg.z2 - vSeg.z1) / vLen;
      const vNx = -vDirZ;
      const vNz = vDirX;
      const vmX = (vSeg.x1 + vSeg.x2) * 0.5 - centerX;
      const vmZ = (vSeg.z1 + vSeg.z2) * 0.5 - centerZ;
      const vBaseY = localGroundY((vSeg.x1 + vSeg.x2) * 0.5, (vSeg.z1 + vSeg.z2) * 0.5);

      const yStart = ci === 0 ? 0.3 : VIADUCT_H;
      const yEnd = ci === bestChain.length - 1 ? 0.3 : VIADUCT_H;
      const yMid = (yStart + yEnd) * 0.5;
      const dy = yEnd - yStart;
      const slopeLen = Math.hypot(vLen, dy);
      const pitchX = -Math.atan2(dy, vLen);

      const spanGroup = new THREE.Group();
      spanGroup.position.set(vmX, vBaseY + yMid, vmZ);
      spanGroup.rotation.order = 'YXZ';
      spanGroup.rotation.y = vYaw;
      spanGroup.rotation.x = pitchX;

      const deckGeo = new THREE.BoxGeometry(VIADUCT_W, 0.95, slopeLen + 2.4);
      const deck = new THREE.Mesh(deckGeo, [
        pierConcreteMat,
        pierConcreteMat,
        viaductDeckMat,
        pierConcreteMat,
        pierConcreteMat,
        pierConcreteMat,
      ]);
      deck.castShadow = true;
      deck.receiveShadow = true;
      deck.add(new THREE.LineSegments(new THREE.EdgesGeometry(deckGeo, 30), INK_LINE_MAT));
      spanGroup.add(deck);

      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, slopeLen + 2.0), viaductGuardMat);
        rail.position.set(side * (VIADUCT_W * 0.48), 0.95, 0);
        rail.castShadow = true;
        spanGroup.add(rail);
      }
      group.add(spanGroup);

      // Guaranteed vertical concrete support pier under EVERY elevated joint so NO slab EVER floats unsupported!
      if (ci > 0) {
        const pwx = vSeg.x1;
        const pwz = vSeg.z1;
        const py = localGroundY(pwx, pwz);
        const pxL = pwx - centerX;
        const pzL = pwz - centerZ;
        const col = new THREE.Mesh(new THREE.BoxGeometry(2.1, VIADUCT_H - 0.4, 2.1), pierConcreteMat);
        col.position.set(pxL, py + (VIADUCT_H - 0.4) * 0.5, pzL);
        col.rotation.y = vYaw;
        col.castShadow = true;
        col.receiveShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(VIADUCT_W * 0.82, 1.0, 2.5), pierConcreteMat);
        cap.position.set(pxL, py + VIADUCT_H - 0.8, pzL);
        cap.rotation.y = vYaw;
        cap.castShadow = true;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.0, 6), viaductGuardMat);
        pole.position.set(pxL, py + VIADUCT_H + 2.4, pzL);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), viaductLampMat);
        bulb.position.set(pxL, py + VIADUCT_H + 4.5, pzL);
        group.add(col, cap, pole, bulb);
        if (!layout.junctions.some((jn) => Math.hypot(jn.x - pwx, jn.z - pwz) < 16)) {
          colliders.push(makeObbCollider(pwx, pwz, 1.15, 1.15, vYaw, VIADUCT_H));
        }
      }
      // Solid concrete abutment block underneath ramp touch-down ends!
      if (ci === 0 || ci === bestChain.length - 1) {
        const ex = ci === 0 ? vSeg.x1 + vDirX * (vLen * 0.35) : vSeg.x2 - vDirX * (vLen * 0.35);
        const ez = ci === 0 ? vSeg.z1 + vDirZ * (vLen * 0.35) : vSeg.z2 - vDirZ * (vLen * 0.35);
        const abutment = new THREE.Mesh(new THREE.BoxGeometry(VIADUCT_W * 0.92, 2.8, vLen * 0.45), pierConcreteMat);
        abutment.position.set(ex - centerX, localGroundY(ex, ez) + 1.2, ez - centerZ);
        abutment.rotation.y = vYaw;
        group.add(abutment);
      }
      void vNx;
      void vNz;
    }
  }

  // 1B. Clean Cities: Skylines Asphalt Intersection Pads with Zebra Crosswalks + Real 3D Traffic Lights (红绿灯)!
  const junctionMat = new THREE.MeshLambertMaterial({
    map: tex.junctionAsphalt,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
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
      posAttr.setXYZ(vi, wx - centerX, localGroundY(wx, wz) + 0.135, wz - centerZ);
    }
    padGeo.computeVertexNormals();
    const pad = new THREE.Mesh(padGeo, junctionMat);
    pad.receiveShadow = true;
    pad.renderOrder = 6;
    group.add(pad);

    // Mount sleek 3D Traffic Signals at corners of major arterial intersections!
    if (jn.width >= 32) {
      const off = jn.width * 0.46;
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
          const awn = new THREE.Mesh(
            new THREE.BoxGeometry(lot.width * 0.56, 0.32, 2.2),
            new THREE.MeshLambertMaterial({ map: tex.awningRed }),
          );
          awn.position.set(0, 3.65, lot.depth * 0.48);
          awn.rotation.x = 0.28;
          awn.castShadow = true;
          wrapper.add(awn);
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
            new THREE.BoxGeometry(5.8, 2.0, 0.45),
            new THREE.MeshBasicMaterial({ map: tex.martSign }),
          );
          signMesh.position.set(0, h + 1.15, 3.4);
          wrapper.add(signMesh);
          const awn = new THREE.Mesh(
            new THREE.BoxGeometry(lot.width * 0.54, 0.32, 2.1),
            new THREE.MeshLambertMaterial({ map: tex.awningBlue }),
          );
          awn.position.set(0, 3.6, lot.depth * 0.48);
          awn.rotation.x = 0.28;
          awn.castShadow = true;
          wrapper.add(awn);
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
    } else if (lot.kind === 'skyscraper') {
      // Dedicated Crisp HD-2D Pixel-Art Glass Curtain-Wall Skyscrapers (Lujiazui Pudong / Downtown Core!)
      const skyGrp = new THREE.Group();
      skyGrp.position.set(lx, ly, lz);
      skyGrp.rotation.y = lot.rotY;
      const baseH = 26 + (lot.houseVariant % 3) * 8;
      const skyW = lot.width * 0.88;
      const skyD = lot.depth * 0.86;
      const skyTintList = [0xffffff, 0xd0ebff, 0xffe8cc];
      const glassMat = new THREE.MeshLambertMaterial({
        map: tex.skyGlassTex,
        color: skyTintList[lot.houseVariant % skyTintList.length],
      });
      const trimMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x3b495c }));
      const lobbyMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xced4da }));

      // Ground stone lobby podium
      const podium = new THREE.Mesh(new THREE.BoxGeometry(skyW * 1.06, 4.2, skyD * 1.06), lobbyMat);
      podium.position.y = 2.1;
      podium.castShadow = true;
      podium.receiveShadow = true;
      // Main pixel glass tower shaft + crisp ink edges
      const shaftGeo = new THREE.BoxGeometry(skyW, baseH, skyD);
      const shaft = new THREE.Mesh(shaftGeo, glassMat);
      shaft.position.y = 4.2 + baseH * 0.5;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      shaft.add(new THREE.LineSegments(new THREE.EdgesGeometry(shaftGeo, 30), INK_LINE_MAT));
      // Stepped architectural crown + mechanical penthouse + glowing red aviation spire!
      const crownGeo = new THREE.BoxGeometry(skyW * 0.72, 6.2, skyD * 0.72);
      const crown = new THREE.Mesh(crownGeo, glassMat);
      crown.position.y = 4.2 + baseH + 3.1;
      crown.castShadow = true;
      crown.add(new THREE.LineSegments(new THREE.EdgesGeometry(crownGeo, 30), INK_LINE_MAT));
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(skyW * 0.78, 0.9, skyD * 0.78), trimMat);
      parapet.position.y = 4.2 + baseH + 6.4;
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.36, 7.5, 6), trimMat);
      spire.position.y = 4.2 + baseH + 10.2;
      const beaconRed = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff4d4f }),
      );
      beaconRed.position.y = 4.2 + baseH + 14.1;
      // Ground-floor retaining plinth
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(skyW * 1.02, 2.6, skyD * 1.02), trimMat);
      plinth.position.y = -1.3;
      skyGrp.add(plinth, podium, shaft, crown, parapet, spire, beaconRed);
      group.add(skyGrp);
      colliders.push(makeObbCollider(lot.x, lot.z, lot.width * 0.46, lot.depth * 0.45, lot.rotY, baseH + 10));
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
                  new THREE.BoxGeometry(4.8, 1.7, 0.36),
                  new THREE.MeshBasicMaterial({ map: signTex }),
                );
                sign.position.set(0, Math.min(h * 0.72, 6.2), lot.depth * 0.44);
                wrapper.add(sign);
                // Striped pixel cloth storefront awning + flat-roof AC compressor unit!
                const awnTex = [tex.awningRed, tex.awningBlue, tex.awningGold][hHash % 3];
                const awn = new THREE.Mesh(
                  new THREE.BoxGeometry(lot.width * 0.52, 0.28, 1.85),
                  new THREE.MeshLambertMaterial({ map: awnTex }),
                );
                awn.position.set(0, 3.25, lot.depth * 0.48);
                awn.rotation.x = 0.28;
                awn.castShadow = true;
                wrapper.add(awn);
                if (styleDef.isFlatUrban) {
                  const acMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xb0b8c4 }));
                  const acUnit = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.4), acMat);
                  acUnit.position.set(lot.width * 0.18, h + 0.55, -lot.depth * 0.14);
                  acUnit.castShadow = true;
                  wrapper.add(acUnit);
                }
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

  // 5. LIVE CITY LIFE: Dynamically Routed Cruising Pixel-Shaded Taxis on THIS City's Real Dry Avenues & Bridges!
  const carColors = [0x3bc9db, 0xffd43b, 0xfa5252, 0xf8f9fa, 0x339af0, 0x51cf66];
  const carConfigs: { axis: 'x' | 'z'; laneOffset: number; dir: 1 | -1; minC: number; maxC: number; start: number; spd: number }[] = [];
  for (const seg of layout.streets) {
    if (carConfigs.length >= 6) break;
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
      if (maxZ - minZ > 32) {
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
      if (maxX - minX > 32) {
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

  const pkCx = layout.plazaX - centerX;
  const pkCz = layout.plazaZ - centerZ;
  for (let wi = 0; wi < 7; wi++) {
    const spriteUrl = citizenPool[(wi + styleIdx) % citizenPool.length];
    const orbitR = 9.5 + (wi % 4) * 3.2;
    const initAng = (wi / 7) * Math.PI * 2;
    const px = pkCx + Math.cos(initAng) * orbitR;
    const pz = pkCz + Math.sin(initAng) * orbitR;
    const py = localGroundY(centerX + px, centerZ + pz) + 0.16;
    const citizenMesh = createNpcBillboard(spriteUrl, px, py, pz, 2.35);
    const cShadow = new THREE.Mesh(shadowGeo, shadowMat);
    cShadow.position.set(px, py + 0.04, pz);
    group.add(citizenMesh, cShadow);
    walkers.push({
      mesh: citizenMesh,
      shadow: cShadow,
      mode: 'plaza_orbit',
      cx: pkCx,
      cz: pkCz,
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
