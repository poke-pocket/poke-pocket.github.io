import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getNpcWalkSpriteFrames } from '../data/worldTextures3D';

export const GLTF_LOADER = new GLTFLoader();
export const TEX_LOADER = new THREE.TextureLoader();
const MODEL_PROMISE_CACHE = new Map<string, Promise<THREE.Group | null>>();
const NPC_TEX_CACHE = new Map<string, THREE.Texture>();

export const INK_LINE_MAT = new THREE.LineBasicMaterial({
  color: 0x141824,
  transparent: true,
  opacity: 0.74,
});

export function getNpcTexture(url: string): THREE.Texture {
  const cached = NPC_TEX_CACHE.get(url);
  if (cached) return cached;
  const tex = TEX_LOADER.load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  NPC_TEX_CACHE.set(url, tex);
  return tex;
}

export function createNpcBillboard(
  url: string,
  x: number,
  y: number,
  z: number,
  height = 2.48,
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
  // CRITICAL: YXZ Euler order rotates around vertical world Y FIRST, then local horizontal X —
  // guaranteeing NPCs stand 100% perpendicular to the ground from every 360° camera angle (zero sideways lean)!
  mesh.rotation.order = 'YXZ';
  mesh.position.set(x, y, z);
  mesh.userData.walkFrames = frames;
  return mesh;
}

export const TOWN_NIGHT_UNIFORM = { value: 0.0 };

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
export function getRadialGlowTex(): THREE.CanvasTexture {
  if (!SHARED_RADIAL_GLOW_TEX) SHARED_RADIAL_GLOW_TEX = createSharedRadialGlowTexture();
  return SHARED_RADIAL_GLOW_TEX;
}

export const STREET_LAMP_BULB_MAT = new THREE.MeshBasicMaterial({ color: 0xffe066 });
export const STREET_LAMP_HALO_MAT = new THREE.SpriteMaterial({
  color: 0xffdf80,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
export const STREET_LAMP_POOL_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd880,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
export const BUILDING_ENTRANCE_POOL_MAT = new THREE.MeshBasicMaterial({
  color: 0xffe39e,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

interface NightReactiveHook {
  update: (glow: number) => void;
}
const NIGHT_REACTIVE_HOOKS: NightReactiveHook[] = [];

export function registerNightReactiveHook(update: (glow: number) => void): void {
  NIGHT_REACTIVE_HOOKS.push({ update });
  update(TOWN_NIGHT_UNIFORM.value);
}

/** Synchronize all city streetlamps, building entrance light pools, CBD curtain-wall window grids, and rooftop LED strips! */
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
  for (let i = 0; i < NIGHT_REACTIVE_HOOKS.length; i++) {
    NIGHT_REACTIVE_HOOKS[i].update(g);
  }
}

/**
 * World-Space HD-2D Pixel-Art Architecture Shader Hook v4:
 * - Crisp 15cm world-space pixel running-bond brick / tile masonry on vertical walls
 * - ZERO random yellow wall blotches (`uNightGlow` wall tint completely removed — night lighting now comes strictly
 *   from discrete procedural window `emissiveMap` cells and architectural LED strips!)
 */
export function applyPixelArtArchShader(mat: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
  mat.customProgramCacheKey = () => 'pk_pixel_arch_hd2d_v4_clean';
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
  float hCoord = abs(aNorm.x) > abs(aNorm.z) ? pxCoord.z : pxCoord.x;
  float rowIdx = floor(pxCoord.y * 0.333);
  float mortarH = step(2.62, mod(pxCoord.y, 3.0));
  float brickCol = floor((hCoord + mod(rowIdx, 2.0) * 3.0) * 0.1667);
  float mortarV = step(5.55, mod(hCoord + mod(rowIdx, 2.0) * 6.0, 6.0));
  float brickVar = (archHash21(vec2(brickCol, rowIdx)) - 0.5) * 0.105;
  float mortarMask = max(mortarH, mortarV);
  float groundAo = mix(0.88, 1.0, clamp((vArchWorldPos.y - 1.4) * 0.45, 0.0, 1.0));
  grain = (1.0 + brickVar - mortarMask * 0.085) * groundAo;
} else {
  float shingleRow = step(2.45, mod(pxCoord.x + pxCoord.z, 3.0));
  float tileVar = (archHash21(pxCoord.xz * 0.5) - 0.5) * 0.095;
  grain = 1.0 + tileVar - shingleRow * 0.07;
}
float bayer = mod(pxCoord.x + pxCoord.y + pxCoord.z, 2.0) * 0.024 - 0.012;
diffuseColor.rgb *= clamp(grain + bayer, 0.80, 1.12);`,
      )
      .replace(
        '#include <dithering_fragment>',
        `float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
float qLum = floor(lum * 8.0 + 0.5) / 8.0;
gl_FragColor.rgb *= mix(1.0, qLum / max(0.05, lum), 0.32);
#include <dithering_fragment>`,
      );
  };
  return mat;
}

export function loadRawGlb(url: string): Promise<THREE.Group | null> {
  const cached = MODEL_PROMISE_CACHE.get(url);
  if (cached) return cached;
  const isPropOrFurn =
    url.includes('/furniture/') ||
    url.includes('/mini-market/') ||
    url.includes('/food/') ||
    url.includes('/modular-buildings/detail-') ||
    url.includes('/modular-buildings/window-') ||
    url.includes('/roads/') ||
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

export async function mountGlbModel(
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

  const isPropOrRoad =
    url.includes('/roads/') ||
    url.includes('/car/') ||
    url.includes('/train/') ||
    url.includes('/furniture/') ||
    url.includes('/mini-market/') ||
    url.includes('/food/');

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
  clone.position.set(-rawCenter.x * scaleX, -rawBox.min.y * scaleY - 0.04, -rawCenter.z * scaleZ);

  if (opts.tintHex !== undefined || opts.addInkEdges || opts.cloneMaterials) {
    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (opts.tintHex !== undefined || opts.cloneMaterials) {
        const tintColor = opts.tintHex !== undefined ? new THREE.Color(opts.tintHex) : null;
        const cloneMat = (mm: THREE.Material) => {
          const cloned = mm.clone() as THREE.MeshLambertMaterial;
          const out = isPropOrRoad ? cloned : applyPixelArtArchShader(cloned);
          if (tintColor && out.color) out.color.lerp(tintColor, 0.22);
          return out;
        };
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(cloneMat);
        } else if (mesh.material) {
          mesh.material = cloneMat(mesh.material);
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

  if (opts.targetWidth >= 12 && !isPropOrRoad && !url.includes('/modular-buildings/')) {
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
      if (lm) lm.opacity = 0.45 * alpha;
    }
  });
}
