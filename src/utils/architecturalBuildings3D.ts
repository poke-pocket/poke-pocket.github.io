import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { WalkableStairAndFloorZone3D } from '../data/survivorsTactics';
import { getNpcWalkSpriteFrames } from '../data/worldTextures3D';

export interface ArchBuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx?: number;
  cz?: number;
  halfW?: number;
  halfD?: number;
  rotY?: number;
  height?: number;
  minY?: number;
  maxY?: number;
  interiorId?: string;
}

export type WalkInBuildingKind = 'pokemon_center' | 'poke_mart' | 'hotel' | 'restaurant' | 'house';

export interface ProximityAutoDoor3D {
  worldX: number;
  worldY: number;
  worldZ: number;
  triggerRadius: number;
  openT: number;
  applyOpenT: (t: number) => void;
}

export function updateProximityAutoDoors3D(
  doors: ProximityAutoDoor3D[],
  actors: { x: number; y: number; z: number }[],
  dt: number,
): void {
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    let shouldOpen = false;
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
    const target = shouldOpen ? 1.0 : 0.0;
    if (Math.abs(d.openT - target) > 0.004) {
      const speed = shouldOpen ? 7.8 : 4.6;
      d.openT += (target - d.openT) * Math.min(1, dt * speed);
      if (Math.abs(d.openT - target) <= 0.006) d.openT = target;
      // Smooth cubic ease-out
      const eased = 1 - Math.pow(1 - d.openT, 2.2);
      d.applyOpenT(eased);
    }
  }
}

export interface BuiltUnifiedBuildingResult {
  shellGroup: THREE.Group;
  npcs: THREE.Mesh[];
  colliders: ArchBuildingCollider[];
  autoDoors: ProximityAutoDoor3D[];
  stairZone?: WalkableStairAndFloorZone3D;
  stories: 1 | 2;
  floor1CeilingY: number;
  floor2CeilingY: number;
  dualDoors: boolean;
}

const ARCH_GLTF_LOADER = new GLTFLoader();
const ARCH_MODEL_CACHE = new Map<string, Promise<THREE.Group | null>>();
const ARCH_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0x181c28,
  transparent: true,
  opacity: 0.55,
});

function loadArchGlb(url: string): Promise<THREE.Group | null> {
  const hit = ARCH_MODEL_CACHE.get(url);
  if (hit) return hit;
  const p = new Promise<THREE.Group | null>((resolve) => {
    ARCH_GLTF_LOADER.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            const cleanMats = mats.map((mat) => {
              const std = mat as THREE.MeshStandardMaterial;
              if (std.map) {
                std.map.magFilter = THREE.NearestFilter;
                std.map.minFilter = THREE.NearestFilter;
                std.map.colorSpace = THREE.SRGBColorSpace;
                std.map.needsUpdate = true;
              }
              return new THREE.MeshLambertMaterial({
                color: std.color ? std.color.clone() : new THREE.Color(0xffffff),
                map: std.map ?? null,
                side: std.side,
                transparent: std.transparent,
                opacity: std.opacity,
              });
            });
            m.material = Array.isArray(m.material) ? cleanMats : cleanMats[0];
          }
        });
        resolve(root);
      },
      undefined,
      () => resolve(null),
    );
  });
  ARCH_MODEL_CACHE.set(url, p);
  return p;
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

function spawnGbaNpc(key: string, x: number, y: number, z: number, height = 2.65): THREE.Mesh {
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
  mesh.position.set(x, y, z);
  mesh.userData.walkFrames = frames;
  return mesh;
}

/**
 * Builds a 100% Unified Inside-and-Outside 1-Story or 2-Story Architectural Building:
 * - Exterior & interior share the EXACT SAME physical walls & open doorways (ZERO fake yellow boards, ZERO transparency swaps!).
 * - Furnished exclusively with real CC0 Kenney 3D `.glb` models (`furniture`, `mini-market`, `food`, `modular-buildings`, `city-commercial`)!
 * - Every floor-standing furniture piece automatically registers a solid floor-scoped OBB collider (ZERO pass-through furniture!).
 * - 2-Story buildings (`hotel`, `house`, `pokemon_center`) include a real walkable 3D staircase (`1F` <-> `2F` at +5.16m) + separate `2F` rooms with real open doorways!
 */
export function buildUnifiedWalkInBuilding3D(opts: {
  kind: WalkInBuildingKind;
  interiorId: string;
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
  const stories: 1 | 2 = kind === 'hotel' || kind === 'house' || kind === 'pokemon_center' ? 2 : 1;
  const dualDoors = kind !== 'house';
  const H1 = stories === 2 ? 5.0 : 5.8;
  const H2 = stories === 2 ? 4.85 : 0;
  const totalWallH = H1 + H2;
  const floor1Y = 0.16;
  const floor2Y = floor1Y + H1; // 5.16m

  const shellGroup = new THREE.Group();
  shellGroup.position.set(localX, localY, localZ);
  shellGroup.rotation.y = rotY;

  const npcs: THREE.Mesh[] = [];
  const colliders: ArchBuildingCollider[] = [];
  const autoDoors: ProximityAutoDoor3D[] = [];
  const cosLot = Math.cos(rotY);
  const sinLot = Math.sin(rotY);
  const localToWorldXZ = (lxP: number, lzP: number) => ({
    wx: lotX + lxP * cosLot + lzP * sinLot,
    wz: lotZ - lxP * sinLot + lzP * cosLot,
  });

  // Palette per building type
  const palette =
    kind === 'pokemon_center'
      ? { ext: 0xf8f9fa, trim: 0xe03131, inner: 0xfff9f5, roof: 0xd9480f }
      : kind === 'poke_mart'
        ? { ext: 0xf1f5f9, trim: 0x1c7ed6, inner: 0xf8fafc, roof: 0x1971c2 }
        : kind === 'hotel'
          ? { ext: 0xfff3d6, trim: 0xd97706, inner: 0xfdf8ee, roof: 0xb45309 }
          : kind === 'restaurant'
            ? { ext: 0xffe8d6, trim: 0xd9480f, inner: 0xfff4e6, roof: 0xc92a2a }
            : { ext: 0xf3e8d8, trim: 0x6f4e37, inner: 0xfaf3e8, roof: 0x5c3d2e };

  const extWallMat = new THREE.MeshLambertMaterial({ color: palette.ext });
  // Warm, brightly-lit indoor surfaces so shops, clinics, hotels, cafés & apartments glow cozily day & night!
  const innerWallMat = new THREE.MeshLambertMaterial({
    color: palette.inner,
    emissive: 0xffebd0,
    emissiveIntensity: 0.42,
  });
  const trimMat = new THREE.MeshLambertMaterial({ color: palette.trim });
  const roofMat = new THREE.MeshLambertMaterial({ color: palette.roof });
  const ceilingMat = new THREE.MeshLambertMaterial({
    color: 0xf8f9fa,
    emissive: 0xfff4dc,
    emissiveIntensity: 0.48,
  });
  const plinthMat = new THREE.MeshLambertMaterial({ color: 0x868e96 });

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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (edge) {
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), ARCH_EDGE_MAT));
    }
    shellGroup.add(mesh);
    return mesh;
  };

  /**
   * Mounts a real Kenney 3D `.glb` furniture/market/food/architectural asset AND
   * automatically registers its exact floor-scoped solid OBB collider when `solid !== false`!
   * Indoor props automatically receive warm ceiling illumination so shops/rooms stay bright at night!
   */
  const placeGlb = (
    url: string,
    pOpts: {
      x: number;
      y: number;
      z: number;
      rotY?: number;
      targetW: number;
      targetD?: number;
      heightMult?: number;
      solid?: boolean;
      floor?: 1 | 2;
      colliderHeight?: number;
      outdoor?: boolean;
    },
  ) => {
    const floorIdx = pOpts.floor ?? 1;
    const isSolid = pOpts.solid !== false;
    const isOutdoor = Boolean(pOpts.outdoor) || Math.abs(pOpts.z) > d * 0.49 || pOpts.y > floor1Y + totalWallH - 0.1;
    if (isSolid) {
      const colW = pOpts.targetW * 0.44;
      const colD = (pOpts.targetD ?? pOpts.targetW) * 0.44;
      const minY = floorIdx === 2 ? baseWorldY + floor2Y - 0.3 : baseWorldY - 0.5;
      const maxY = floorIdx === 2 ? baseWorldY + floor2Y + 3.4 : baseWorldY + floor1Y + 3.4;
      colliders.push(
        makeLocalObb(
          lotX,
          lotZ,
          rotY,
          pOpts.x,
          pOpts.z,
          colW,
          colD,
          pOpts.rotY ?? 0,
          pOpts.colliderHeight ?? 1.6,
          interiorId,
          minY,
          maxY,
        ),
      );
    }

    void loadArchGlb(url).then((raw) => {
      if (!raw) return;
      const clone = raw.clone(true);
      if (!isOutdoor) {
        clone.traverse((ch) => {
          if ((ch as THREE.Mesh).isMesh) {
            const mesh = ch as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const litMats = mats.map((mt) => {
              const cloned = mt.clone() as THREE.MeshLambertMaterial;
              if ('emissive' in cloned && cloned.emissive) {
                cloned.emissive.setHex(0xffefd2);
                cloned.emissiveIntensity = 0.40;
              }
              return cloned;
            });
            mesh.material = Array.isArray(mesh.material) ? litMats : litMats[0];
          }
        });
      }
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      const sz = new THREE.Vector3();
      const ctr = new THREE.Vector3();
      box.getSize(sz);
      box.getCenter(ctr);

      const sx = pOpts.targetD !== undefined ? pOpts.targetW / Math.max(0.01, sz.x) : pOpts.targetW / Math.max(0.01, Math.max(sz.x, sz.z));
      const szScale = pOpts.targetD !== undefined ? pOpts.targetD / Math.max(0.01, sz.z) : sx;
      const sy = Math.min(sx, szScale) * (pOpts.heightMult ?? 1.0);

      const wrap = new THREE.Group();
      wrap.position.set(pOpts.x, pOpts.y, pOpts.z);
      wrap.rotation.y = pOpts.rotY ?? 0;
      clone.scale.set(sx, sy, szScale);
      clone.position.set(-ctr.x * sx, -box.min.y * sy, -ctr.z * szScale);
      wrap.add(clone);
      shellGroup.add(wrap);
    });
  };

  // ==================== 1. FOUNDATION PLINTH & WARMLY LIT 1F TILED FLOOR + SIDEWALK LIGHT SPILL ====================
  addBox(w + 1.2, 2.4, d + 1.2, plinthMat, 0, -1.08, 0, false);

  const f1Tex = floorTex.clone();
  f1Tex.repeat.set(Math.max(4, Math.round(w / 5.5)), Math.max(4, Math.round(d / 5.5)));
  f1Tex.wrapS = THREE.RepeatWrapping;
  f1Tex.wrapT = THREE.RepeatWrapping;
  f1Tex.needsUpdate = true;
  const f1Mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ map: f1Tex, emissive: 0xffeed4, emissiveIntensity: 0.38 }),
  );
  f1Mesh.rotation.x = -Math.PI / 2;
  f1Mesh.position.y = floor1Y;
  f1Mesh.receiveShadow = true;
  shellGroup.add(f1Mesh);

  // Warm golden storefront light spilling out onto the surrounding sidewalk at night!
  {
    const spillCanvas = document.createElement('canvas');
    spillCanvas.width = 64;
    spillCanvas.height = 64;
    const sCtx = spillCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(32, 32, 6, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 232, 168, 0.85)');
      grad.addColorStop(0.55, 'rgba(255, 212, 128, 0.36)');
      grad.addColorStop(1, 'rgba(255, 196, 96, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 64, 64);
    }
    const spillTex = new THREE.CanvasTexture(spillCanvas);
    const spillMat = new THREE.MeshBasicMaterial({
      map: spillTex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spillMesh = new THREE.Mesh(new THREE.PlaneGeometry(w + 10.5, d + 12.5), spillMat);
    spillMesh.rotation.x = -Math.PI / 2;
    spillMesh.position.set(0, 0.06, 1.4);
    shellGroup.add(spillMesh);
  }

  // ==================== 2. MODERN FLOOR-TO-CEILING GLASS CURTAIN WALLS (现代感全景落地窗) & SLEEK AUTO GLASS DOORS ====================
  const wallT = 0.85;
  const doorW = 6.6;
  const doorH = 3.95;
  const lintelH = totalWallH - doorH;
  const segW = Math.max(2.0, (w - doorW) * 0.5);
  const segOffX = doorW * 0.5 + segW * 0.5;

  // Sleek anodized dark-charcoal aluminum curtain-wall mullions & brushed steel safety rails
  const mullionMat = new THREE.MeshLambertMaterial({
    color: 0x1e2533,
    emissive: 0x0f172a,
    emissiveIntensity: 0.25,
  });
  const brushedRailMat = new THREE.MeshLambertMaterial({
    color: 0xcbd5e1,
    emissive: 0x64748b,
    emissiveIntensity: 0.25,
  });
  const clearGlassMat = new THREE.MeshLambertMaterial({
    color: 0xdcf4ff,
    emissive: 0x56ccf2,
    emissiveIntensity: 0.12,
    transparent: true,
    opacity: 0.19,
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

  // Helper: Modern Panoramic Floor-to-Ceiling Glass Curtain Wall (`现代感全景落地玻璃幕墙`) on 1F & 2F!
  const buildWindowedWallSpan = (
    axis: 'x' | 'z',
    cxSpan: number,
    czSpan: number,
    spanLen: number,
    _isStorefrontDisplay: boolean,
  ) => {
    const addSpanBox = (alongLen: number, bh: number, thick: number, mat: THREE.Material, alongOff: number, by: number, cast = true) => {
      if (alongLen <= 0.04 || bh <= 0.04) return null;
      const bw = axis === 'x' ? alongLen : thick;
      const bd = axis === 'x' ? thick : alongLen;
      const bx = axis === 'x' ? cxSpan + alongOff : cxSpan;
      const bz = axis === 'x' ? czSpan : czSpan + alongOff;
      return addBox(bw, bh, bd, mat, bx, by, bz, cast);
    };

    const cornerColW = Math.min(1.15, Math.max(0.75, spanLen * 0.065));
    const glassSpan = spanLen - cornerColW * 2;

    for (let s = 1; s <= stories; s++) {
      const yBase = s === 1 ? floor1Y : floor2Y;
      const storyH = s === 1 ? H1 : H2;
      // True floor-to-ceiling glazing: slim 14cm floor track up to 3.95m (1F) / 3.72m (2F)!
      const curbH = 0.14;
      const headY = s === 1 ? 3.95 : 3.72;
      const winH = headY - curbH;
      const spandrelH = storyH - headY;
      const winMidY = yBase + curbH + winH * 0.5;

      // Clean architectural spandrel fascia above the floor-to-ceiling glass
      addSpanBox(spanLen, spandrelH, wallT, extWallMat, 0, yBase + headY + spandrelH * 0.5);

      if (glassSpan < 2.2) {
        addSpanBox(spanLen, headY, wallT, extWallMat, 0, yBase + headY * 0.5);
        continue;
      }

      // Slim structural corner columns at the two outer ends ONLY (zero bulky brick piers in the middle!)
      addSpanBox(cornerColW, headY, wallT, extWallMat, -spanLen * 0.5 + cornerColW * 0.5, yBase + headY * 0.5);
      addSpanBox(cornerColW, headY, wallT, extWallMat, spanLen * 0.5 - cornerColW * 0.5, yBase + headY * 0.5);

      // Sleek dark-aluminum floor sill track & top header track spanning the full panoramic glass curtain
      addSpanBox(glassSpan, curbH, wallT * 0.72, mullionMat, 0, yBase + curbH * 0.5, false);
      addSpanBox(glassSpan, 0.12, wallT * 0.72, mullionMat, 0, yBase + headY - 0.06, false);
      // Modern high transom bar near ceiling (82% height)
      addSpanBox(glassSpan, 0.07, 0.16, mullionMat, 0, yBase + curbH + winH * 0.82, false);
      // On 2F floor-to-ceiling glass: sleek brushed-steel minimalist interior safety guardrail bar at 1.02m!
      if (s === 2) {
        addSpanBox(glassSpan - 0.1, 0.06, 0.12, brushedRailMat, 0, yBase + 1.02, false);
      }

      // Continuous crystal-clear panoramic floor-to-ceiling glass sheet!
      const pane = addSpanBox(glassSpan - 0.08, winH - 0.12, 0.06, clearGlassMat, 0, winMidY, false);
      if (pane) pane.renderOrder = 4;

      // Ultra-slim vertical dark-aluminum curtain-wall mullions every ~4.5m + subtle glass reflection glints
      const numBays = Math.max(2, Math.round(glassSpan / 4.5));
      const bayW = glassSpan / numBays;
      for (let bi = 0; bi <= numBays; bi++) {
        const mx = -glassSpan * 0.5 + bi * bayW;
        addSpanBox(0.09, winH, 0.20, mullionMat, mx, winMidY, false);
        if (bi < numBays && bi % 2 === 0) {
          const glint = addSpanBox(0.24, winH * 0.68, 0.08, glassGlintMat, mx + bayW * 0.36, winMidY + 0.05, false);
          if (glint) {
            glint.renderOrder = 5;
            if (axis === 'x') glint.rotation.z = -0.28;
            else glint.rotation.x = -0.28;
          }
        }
      }
    }
    // Crisp modern inter-story architectural fascia band
    addSpanBox(spanLen + 0.2, 0.32, wallT + 0.22, trimMat, 0, floor1Y + H1, false);
  };

  // Helper to build a doorway-split facade (+Z front, and -Z back when dualDoors)
  const buildPortalFacade = (zSign: 1 | -1) => {
    const fz = zSign * (d * 0.5);
    for (const sx of [-1, 1]) {
      buildWindowedWallSpan('x', sx * segOffX, fz, segW, true);
    }
    // Over-door facade: on 2-story buildings, give 2F above the main entrance a matching floor-to-ceiling glass gallery bay!
    if (stories === 2) {
      const f1LintelH = H1 - doorH;
      addBox(doorW + 0.2, f1LintelH, wallT, extWallMat, 0, floor1Y + doorH + f1LintelH * 0.5, fz);
      const uCurb = 0.14;
      const uHead = 3.72;
      const uWinH = uHead - uCurb;
      const uWinMid = floor2Y + uCurb + uWinH * 0.5;
      addBox(doorW + 0.2, H2 - uHead, wallT, extWallMat, 0, floor2Y + uHead + (H2 - uHead) * 0.5, fz);
      addBox(doorW, uCurb, wallT * 0.72, mullionMat, 0, floor2Y + uCurb * 0.5, fz, false);
      addBox(doorW, 0.12, wallT * 0.72, mullionMat, 0, floor2Y + uHead - 0.06, fz, false);
      addBox(doorW - 0.2, 0.06, 0.12, brushedRailMat, 0, floor2Y + 1.02, fz, false);
      addBox(0.09, uWinH, 0.20, mullionMat, 0, uWinMid, fz, false);
      const uGlass = addBox(doorW - 0.2, uWinH - 0.12, 0.06, clearGlassMat, 0, uWinMid, fz, false);
      uGlass.renderOrder = 4;
    } else {
      addBox(doorW + 0.2, lintelH, wallT, extWallMat, 0, floor1Y + doorH + lintelH * 0.5, fz);
    }
    // Sleek portal jambs & header
    addBox(0.28, doorH, wallT + 0.14, mullionMat, -doorW * 0.5, floor1Y + doorH * 0.5, fz, false);
    addBox(0.28, doorH, wallT + 0.14, mullionMat, doorW * 0.5, floor1Y + doorH * 0.5, fz, false);
    addBox(doorW + 0.4, 0.26, wallT + 0.18, trimMat, 0, floor1Y + doorH, fz, false);

    // Default-CLOSED Modern Frameless / Slim-Profile Automatic Glass Doors!
    const isSlidingStorefront = kind !== 'house';
    const leafW = doorW * 0.496;
    const leafH = doorH - 0.06;
    const handleMat = new THREE.MeshLambertMaterial({ color: 0xfcc419, emissive: 0xf59f00, emissiveIntensity: 0.25 });

    const buildDoorLeafVisual = (hingeAtOuterEdge: -1 | 0 | 1): THREE.Group => {
      const gLeaf = new THREE.Group();
      const cxShift = hingeAtOuterEdge === 0 ? 0 : -hingeAtOuterEdge * (leafW * 0.5);
      const mkPart = (
        pw: number,
        ph: number,
        pd: number,
        mat: THREE.Material,
        px: number,
        py: number,
        pz = 0,
        cast = true,
      ) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mat);
        m.position.set(cxShift + px, py, pz);
        m.castShadow = cast;
        gLeaf.add(m);
        return m;
      };
      // Minimalist 12cm bottom shoe rail & 12cm top rail + ultra-slim 9cm stiles = true floor-to-ceiling modern glass door!
      const shoeH = 0.12;
      mkPart(leafW, shoeH, 0.13, mullionMat, 0, shoeH * 0.5);
      mkPart(leafW, 0.12, 0.13, mullionMat, 0, leafH - 0.06);
      mkPart(0.09, leafH, 0.13, mullionMat, -leafW * 0.5 + 0.045, leafH * 0.5);
      mkPart(0.09, leafH, 0.13, mullionMat, leafW * 0.5 - 0.045, leafH * 0.5);
      const glassH = leafH - shoeH - 0.12;
      const glassY = shoeH + glassH * 0.5;
      const dGlass = mkPart(leafW - 0.16, glassH, 0.06, clearGlassMat, 0, glassY, 0, false);
      dGlass.renderOrder = 4;
      const dGlint = mkPart(0.20, glassH * 0.66, 0.08, glassGlintMat, -leafW * 0.12, glassY + 0.04, 0, false);
      dGlint.rotation.z = -0.28;
      dGlint.renderOrder = 5;
      const handleX = hingeAtOuterEdge === -1 ? leafW * 0.36 : hingeAtOuterEdge === 1 ? -leafW * 0.36 : 0;
      mkPart(0.09, 0.72, 0.24, handleMat, handleX, 1.32);
      return gLeaf;
    };

    const dWorld = localToWorldXZ(0, fz);
    if (isSlidingStorefront) {
      addBox(1.8, 0.20, 0.32, mullionMat, 0, floor1Y + doorH + 0.12, fz + zSign * (wallT * 0.55), false);
      const leftSlide = buildDoorLeafVisual(0);
      const rightSlide = buildDoorLeafVisual(0);
      const slideZ = fz + zSign * 0.06;
      leftSlide.position.set(-doorW * 0.25, floor1Y, slideZ);
      rightSlide.position.set(doorW * 0.25, floor1Y, slideZ);
      shellGroup.add(leftSlide, rightSlide);
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
    } else {
      const leftHinge = buildDoorLeafVisual(-1);
      const rightHinge = buildDoorLeafVisual(1);
      leftHinge.position.set(-doorW * 0.5 + 0.08, floor1Y, fz);
      rightHinge.position.set(doorW * 0.5 - 0.08, floor1Y, fz);
      shellGroup.add(leftHinge, rightHinge);
      const maxSwing = 1.42 * zSign;
      autoDoors.push({
        worldX: dWorld.wx,
        worldY: baseWorldY + floor1Y,
        worldZ: dWorld.wz,
        triggerRadius: 5.2,
        openT: 0,
        applyOpenT: (t) => {
          leftHinge.rotation.y = maxSwing * t;
          rightHinge.rotation.y = -maxSwing * t;
        },
      });
    }

    placeGlb('/models/furniture/rugDoormat.glb', {
      x: 0,
      y: floor1Y + 0.02,
      z: fz - zSign * 1.5,
      targetW: 4.2,
      targetD: 2.2,
      solid: false,
    });
    placeGlb('/models/city-commercial/detail-awning-wide.glb', {
      x: 0,
      y: floor1Y + doorH + 0.18,
      z: fz + zSign * 0.55,
      rotY: zSign > 0 ? 0 : Math.PI,
      targetW: doorW + 2.6,
      targetD: 2.2,
      solid: false,
      outdoor: true,
    });
  };

  buildPortalFacade(1);
  if (dualDoors) {
    buildPortalFacade(-1);
  } else {
    buildWindowedWallSpan('x', 0, -d * 0.5, w + wallT, true);
  }

  // Left (-X) & Right (+X) Modern Panoramic Floor-to-Ceiling Curtain Walls!
  for (const sx of [-1, 1]) {
    buildWindowedWallSpan('z', sx * (w * 0.5), 0, d + wallT, true);
  }

  // Solid Perimeter Wall Colliders (1F + 2F full height, leaving ONLY the open doorway(s) passable!)
  const wallMaxY = baseWorldY + floor1Y + totalWallH + 1.0;
  if (dualDoors) {
    colliders.push(makeLocalObb(lotX, lotZ, rotY, -segOffX, -d * 0.5, segW * 0.5 + 0.15, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
    colliders.push(makeLocalObb(lotX, lotZ, rotY, segOffX, -d * 0.5, segW * 0.5 + 0.15, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  } else {
    colliders.push(makeLocalObb(lotX, lotZ, rotY, 0, -d * 0.5, w * 0.5 + 0.5, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  }
  colliders.push(makeLocalObb(lotX, lotZ, rotY, -w * 0.5, 0, 0.6, d * 0.5 + 0.5, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  colliders.push(makeLocalObb(lotX, lotZ, rotY, w * 0.5, 0, 0.6, d * 0.5 + 0.5, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  colliders.push(makeLocalObb(lotX, lotZ, rotY, -segOffX, d * 0.5, segW * 0.5 + 0.15, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));
  colliders.push(makeLocalObb(lotX, lotZ, rotY, segOffX, d * 0.5, segW * 0.5 + 0.15, 0.6, 0, totalWallH, interiorId, baseWorldY - 1, wallMaxY));

  // ==================== 3. ROOF SLAB, PARAPET CORNICE, ROOFTOP AC & CLEAN ROOFTOP SIGN ====================
  const roofY = floor1Y + totalWallH;
  addBox(w + wallT * 1.3, 0.48, d + wallT * 1.3, ceilingMat, 0, roofY + 0.24, 0);
  addBox(w + wallT * 1.6, 0.85, 0.7, roofMat, 0, roofY + 0.85, d * 0.5 + 0.1);
  addBox(w + wallT * 1.6, 0.85, 0.7, roofMat, 0, roofY + 0.85, -d * 0.5 - 0.1);
  addBox(0.7, 0.85, d + wallT * 1.6, roofMat, -w * 0.5 - 0.1, roofY + 0.85, 0);
  addBox(0.7, 0.85, d + wallT * 1.6, roofMat, w * 0.5 + 0.1, roofY + 0.85, 0);

  placeGlb('/models/modular-buildings/detail-ac-a.glb', {
    x: w * 0.28,
    y: roofY + 0.48,
    z: -d * 0.22,
    targetW: 2.8,
    solid: false,
  });

  if (signTex) {
    const signGeo = new THREE.BoxGeometry(11.0, 3.1, 0.55);
    const signMesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTex }));
    signMesh.position.set(0, roofY + 2.55, d * 0.5 + 0.15);
    shellGroup.add(signMesh);
  }
  if (kind === 'pokemon_center') {
    const beacon = new THREE.Group();
    const bTop = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshLambertMaterial({ color: 0xfa5252 }),
    );
    const bBot = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf8f9fa }),
    );
    const bRing = new THREE.Mesh(
      new THREE.CylinderGeometry(2.26, 2.26, 0.34, 16),
      new THREE.MeshBasicMaterial({ color: 0x1e222e }),
    );
    beacon.add(bTop, bBot, bRing);
    beacon.position.set(0, roofY + 3.1, 0);
    shellGroup.add(beacon);
    onRegisterSpinner?.(beacon);
  }

  // Warm interior ceiling light fixtures + soft golden ceiling glow halos on 1F (and 2F)
  const lightPanelMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
  const ceilHaloMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const lxP of [-w * 0.24, 0, w * 0.24]) {
    for (const lzP of [-d * 0.22, d * 0.22]) {
      const lp1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.1), lightPanelMat);
      lp1.position.set(lxP, floor1Y + H1 - 0.12, lzP);
      const halo1 = new THREE.Mesh(new THREE.CircleGeometry(2.6, 14), ceilHaloMat);
      halo1.rotation.x = Math.PI / 2;
      halo1.position.set(lxP, floor1Y + H1 - 0.16, lzP);
      shellGroup.add(lp1, halo1);
      if (stories === 2) {
        const lp2 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.1), lightPanelMat);
        lp2.position.set(lxP, roofY - 0.12, lzP);
        const halo2 = new THREE.Mesh(new THREE.CircleGeometry(2.6, 14), ceilHaloMat);
        halo2.rotation.x = Math.PI / 2;
        halo2.position.set(lxP, roofY - 0.16, lzP);
        shellGroup.add(lp2, halo2);
      }
    }
  }

  // ==================== 4. WALKABLE 3D STAIRCASE + 2F FLOOR SLAB WITH STAIRWELL OPENING ====================
  let stairZone: WalkableStairAndFloorZone3D | undefined;
  if (stories === 2) {
    const stMinX = -w * 0.44;
    const stMaxX = stMinX + 4.4;
    const stCx = (stMinX + stMaxX) * 0.5;
    const stBotZ = 5.6;   // Enter stairs on 1F heading North (-Z)
    const stTopZ = -5.6;  // Arrive on 2F landing at lz = -5.6
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

    // Build 2F Floor Slab cleanly in 4 solid pieces around `[openMinX..openMaxX] × [openMinZ..openMaxZ]`!
    const f2Tex = woodFloorTex.clone();
    f2Tex.repeat.set(Math.max(4, Math.round(w / 5)), Math.max(4, Math.round(d / 5)));
    f2Tex.wrapS = THREE.RepeatWrapping;
    f2Tex.wrapT = THREE.RepeatWrapping;
    f2Tex.needsUpdate = true;
    const slabTopMat = new THREE.MeshLambertMaterial({
      map: f2Tex,
      emissive: 0xffe8c8,
      emissiveIntensity: 0.38,
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
    addSlabRect(-w * 0.5, openMinX, -d * 0.5, d * 0.5); // West strip
    addSlabRect(openMaxX, w * 0.5, -d * 0.5, d * 0.5);  // East main 2F floor
    addSlabRect(openMinX, openMaxX, -d * 0.5, openMinZ); // North landing at top of stairs!
    addSlabRect(openMinX, openMaxX, openMaxZ, d * 0.5);  // South strip

    // Sculpted 16-step solid wooden staircase + dual handrails from (stBotZ, floor1Y) up to (stTopZ, floor2Y)!
    const stepMat = new THREE.MeshLambertMaterial({ color: 0x9c6644 });
    const railWoodMat = new THREE.MeshLambertMaterial({ color: 0x5c3d2e });
    const numSteps = 16;
    const stepSpanZ = (stBotZ - stTopZ) / numSteps;
    const stepRiseY = (floor2Y - floor1Y) / numSteps;
    for (let s = 0; s < numSteps; s++) {
      const sz = stBotZ - (s + 0.5) * stepSpanZ;
      const syTop = floor1Y + (s + 1) * stepRiseY;
      const stepH = Math.max(0.32, syTop - floor1Y);
      addBox(4.2, stepH, stepSpanZ + 0.08, stepMat, stCx, floor1Y + stepH * 0.5, sz, false);
    }
    // Sloped staircase side stringers / handrails + 1F side guard colliders so players walk smoothly straight up the steps!
    const stairLen = Math.hypot(stBotZ - stTopZ, floor2Y - floor1Y);
    const stairPitch = Math.atan2(floor2Y - floor1Y, stBotZ - stTopZ);
    for (const rSide of [-1, 1]) {
      const rx = stCx + rSide * 2.15;
      const rGeo = new THREE.BoxGeometry(0.18, 0.18, stairLen);
      const rMesh = new THREE.Mesh(rGeo, railWoodMat);
      rMesh.position.set(rx, (floor1Y + floor2Y) * 0.5 + 0.95, (stBotZ + stTopZ) * 0.5);
      rMesh.rotation.x = stairPitch;
      shellGroup.add(rMesh);
      colliders.push(
        makeLocalObb(lotX, lotZ, rotY, rx, (stBotZ + stTopZ) * 0.5, 0.22, (stBotZ - stTopZ) * 0.48, 0, 2.2, interiorId, baseWorldY, baseWorldY + floor2Y + 1.5),
      );
    }
    // 2F Stairwell safety balustrade around East & South edges of stairwell hole (leaving North top landing open!)
    const f2MinY = baseWorldY + floor2Y - 0.3;
    const f2MaxY = baseWorldY + roofY;
    addBox(0.22, 1.15, openMaxZ - openMinZ, railWoodMat, openMaxX + 0.1, floor2Y + 0.58, (openMinZ + openMaxZ) * 0.5, false);
    colliders.push(makeLocalObb(lotX, lotZ, rotY, openMaxX + 0.1, (openMinZ + openMaxZ) * 0.5, 0.25, (openMaxZ - openMinZ) * 0.5, 0, 1.5, interiorId, f2MinY, f2MaxY));
    addBox(openMaxX - openMinX, 1.15, 0.22, railWoodMat, stCx, floor2Y + 0.58, openMaxZ + 0.1, false);
    colliders.push(makeLocalObb(lotX, lotZ, rotY, stCx, openMaxZ + 0.1, (openMaxX - openMinX) * 0.5, 0.25, 0, 1.5, interiorId, f2MinY, f2MaxY));
  }

  // Helper to add a full-height interior partition wall WITH a real open doorway on 1F or 2F!
  const addInteriorWallWithDoor = (
    floorIdx: 1 | 2,
    axis: 'x' | 'z',
    fixedCoord: number,
    spanStart: number,
    spanEnd: number,
    doorCenter: number,
    doorWidth = 3.4,
  ) => {
    const baseY = floorIdx === 2 ? floor2Y : floor1Y;
    const h = floorIdx === 2 ? H2 : H1;
    const minY = baseWorldY + baseY - 0.2;
    const maxY = baseWorldY + baseY + h;
    const leftLen = Math.max(0, doorCenter - doorWidth * 0.5 - spanStart);
    const rightLen = Math.max(0, spanEnd - (doorCenter + doorWidth * 0.5));
    const dH = 3.2;

    if (axis === 'x') {
      // Wall runs East-West along Z = fixedCoord
      if (leftLen > 0.2) {
        const cxW = spanStart + leftLen * 0.5;
        addBox(leftLen, h, 0.42, innerWallMat, cxW, baseY + h * 0.5, fixedCoord);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, cxW, fixedCoord, leftLen * 0.5, 0.3, 0, h, interiorId, minY, maxY));
      }
      if (rightLen > 0.2) {
        const cxW = spanEnd - rightLen * 0.5;
        addBox(rightLen, h, 0.42, innerWallMat, cxW, baseY + h * 0.5, fixedCoord);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, cxW, fixedCoord, rightLen * 0.5, 0.3, 0, h, interiorId, minY, maxY));
      }
      addBox(doorWidth, h - dH, 0.42, innerWallMat, doorCenter, baseY + dH + (h - dH) * 0.5, fixedCoord, false);
      placeGlb('/models/furniture/doorwayOpen.glb', {
        x: doorCenter,
        y: baseY,
        z: fixedCoord,
        rotY: 0,
        targetW: doorWidth,
        heightMult: 0.95,
        solid: false,
      });
      // Default-CLOSED Hinged Interior Wood Room Door (swings open smoothly when player walks up to room!)
      {
        const rw = doorWidth - 0.24;
        const rh = dH - 0.12;
        const rPivot = new THREE.Group();
        rPivot.position.set(doorCenter - rw * 0.5, baseY, fixedCoord);
        const woodPanel = new THREE.Mesh(
          new THREE.BoxGeometry(rw, rh, 0.14),
          new THREE.MeshLambertMaterial({ color: 0x8d5b4c }),
        );
        woodPanel.position.set(rw * 0.5, rh * 0.5, 0);
        woodPanel.castShadow = true;
        const knob = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.16, 0.30),
          new THREE.MeshLambertMaterial({ color: 0xfcc419 }),
        );
        knob.position.set(rw - 0.32, 1.32, 0);
        rPivot.add(woodPanel, knob);
        shellGroup.add(rPivot);
        const rWorld = localToWorldXZ(doorCenter, fixedCoord);
        autoDoors.push({
          worldX: rWorld.wx,
          worldY: baseWorldY + baseY,
          worldZ: rWorld.wz,
          triggerRadius: 4.1,
          openT: 0,
          applyOpenT: (t) => {
            rPivot.rotation.y = -1.42 * t;
          },
        });
      }
    } else {
      // Wall runs North-South along X = fixedCoord
      if (leftLen > 0.2) {
        const czW = spanStart + leftLen * 0.5;
        addBox(0.42, h, leftLen, innerWallMat, fixedCoord, baseY + h * 0.5, czW);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, fixedCoord, czW, 0.3, leftLen * 0.5, 0, h, interiorId, minY, maxY));
      }
      if (rightLen > 0.2) {
        const czW = spanEnd - rightLen * 0.5;
        addBox(0.42, h, rightLen, innerWallMat, fixedCoord, baseY + h * 0.5, czW);
        colliders.push(makeLocalObb(lotX, lotZ, rotY, fixedCoord, czW, 0.3, rightLen * 0.5, 0, h, interiorId, minY, maxY));
      }
      addBox(0.42, h - dH, doorWidth, innerWallMat, fixedCoord, baseY + dH + (h - dH) * 0.5, doorCenter, false);
      placeGlb('/models/furniture/doorwayOpen.glb', {
        x: fixedCoord,
        y: baseY,
        z: doorCenter,
        rotY: Math.PI / 2,
        targetW: doorWidth,
        heightMult: 0.95,
        solid: false,
      });
      {
        const rw = doorWidth - 0.24;
        const rh = dH - 0.12;
        const rPivot = new THREE.Group();
        rPivot.position.set(fixedCoord, baseY, doorCenter - rw * 0.5);
        const woodPanel = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, rh, rw),
          new THREE.MeshLambertMaterial({ color: 0x8d5b4c }),
        );
        woodPanel.position.set(0, rh * 0.5, rw * 0.5);
        woodPanel.castShadow = true;
        const knob = new THREE.Mesh(
          new THREE.BoxGeometry(0.30, 0.16, 0.16),
          new THREE.MeshLambertMaterial({ color: 0xfcc419 }),
        );
        knob.position.set(0, 1.32, rw - 0.32);
        rPivot.add(woodPanel, knob);
        shellGroup.add(rPivot);
        const rWorld = localToWorldXZ(fixedCoord, doorCenter);
        autoDoors.push({
          worldX: rWorld.wx,
          worldY: baseWorldY + baseY,
          worldZ: rWorld.wz,
          triggerRadius: 4.1,
          openT: 0,
          applyOpenT: (t) => {
            rPivot.rotation.y = 1.42 * t;
          },
        });
      }
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
      addBox(len, h, 0.42, innerWallMat, mid, baseY + h * 0.5, fixedCoord);
      colliders.push(makeLocalObb(lotX, lotZ, rotY, mid, fixedCoord, len * 0.5, 0.3, 0, h, interiorId, minY, maxY));
    } else {
      addBox(0.42, h, len, innerWallMat, fixedCoord, baseY + h * 0.5, mid);
      colliders.push(makeLocalObb(lotX, lotZ, rotY, fixedCoord, mid, 0.3, len * 0.5, 0, h, interiorId, minY, maxY));
    }
  };

  // ==================== 5. REAL KENNEY 3D FURNISHING PER BUILDING ARCHETYPE ====================
  if (kind === 'poke_mart') {
    // 1F SUPERMARKET: Real Kenney Mini-Market Shelves, Standing Freezers, Fruit/Bakery Islands, Cash Registers & Shopping Carts!
    // Checkout zone on West-North
    for (let ci = 0; ci < 2; ci++) {
      const cxPos = -w * 0.28 + ci * 7.5;
      placeGlb('/models/mini-market/cash-register.glb', {
        x: cxPos,
        y: floor1Y,
        z: -d * 0.24,
        targetW: 3.6,
        targetD: 3.2,
      });
    }
    placeGlb('/models/mini-market/shopping-cart.glb', { x: -w * 0.34, y: floor1Y, z: d * 0.28, rotY: 0.4, targetW: 1.9, targetD: 2.4 });
    placeGlb('/models/mini-market/shopping-cart.glb', { x: -w * 0.27, y: floor1Y, z: d * 0.30, rotY: 0.2, targetW: 1.9, targetD: 2.4 });
    placeGlb('/models/mini-market/shopping-basket.glb', { x: -w * 0.20, y: floor1Y, z: d * 0.31, targetW: 1.3, targetD: 1.0 });
    placeGlb('/models/mini-market/bottle-return.glb', { x: -w * 0.42, y: floor1Y, z: 0, rotY: Math.PI / 2, targetW: 2.6, targetD: 2.2 });

    // Fresh Produce & Bakery Display Islands (West-Center) topped with 3D fruit & bread!
    placeGlb('/models/mini-market/display-fruit.glb', { x: -w * 0.24, y: floor1Y, z: 2.5, targetW: 4.2, targetD: 3.6 });
    placeGlb('/models/food/apple.glb', { x: -w * 0.26, y: floor1Y + 1.85, z: 2.3, targetW: 0.65, solid: false });
    placeGlb('/models/food/orange.glb', { x: -w * 0.22, y: floor1Y + 1.85, z: 2.7, targetW: 0.65, solid: false });
    placeGlb('/models/food/banana.glb', { x: -w * 0.24, y: floor1Y + 1.88, z: 2.0, targetW: 0.75, solid: false });

    placeGlb('/models/mini-market/display-bread.glb', { x: -w * 0.24, y: floor1Y, z: 9.2, targetW: 4.2, targetD: 3.6 });
    placeGlb('/models/food/croissant.glb', { x: -w * 0.26, y: floor1Y + 1.85, z: 9.0, targetW: 0.75, solid: false });
    placeGlb('/models/food/loaf-baguette.glb', { x: -w * 0.22, y: floor1Y + 1.85, z: 9.4, targetW: 0.95, solid: false });

    // 6 Stocked Gondola Supermarket Aisles on East Half (`shelf-boxes.glb` + `shelf-bags.glb` + `shelf-end.glb`)!
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 3; row++) {
        const gx = w * 0.08 + col * (w * 0.22);
        const gz = -d * 0.24 + row * (d * 0.24);
        const shelfModel = (col + row) % 2 === 0 ? '/models/mini-market/shelf-boxes.glb' : '/models/mini-market/shelf-bags.glb';
        placeGlb(shelfModel, {
          x: gx,
          y: floor1Y,
          z: gz,
          rotY: Math.PI / 2,
          targetW: 5.8,
          targetD: 2.5,
          heightMult: 1.08,
        });
      }
    }

    // Back-East Cold Beverage Freezers along East Wall!
    for (let fi = 0; fi < 4; fi++) {
      placeGlb('/models/mini-market/freezers-standing.glb', {
        x: w * 0.43,
        y: floor1Y,
        z: -d * 0.30 + fi * 5.6,
        rotY: -Math.PI / 2,
        targetW: 4.6,
        targetD: 2.2,
      });
    }
    placeGlb('/models/furniture/pottedPlant.glb', { x: -doorW * 0.68, y: floor1Y, z: d * 0.42, targetW: 1.8 });
    placeGlb('/models/furniture/pottedPlant.glb', { x: doorW * 0.68, y: floor1Y, z: d * 0.42, targetW: 1.8 });

    const clerk = spawnGbaNpc('clerk', -w * 0.28, floor1Y, -d * 0.24 - 2.4, 2.65);
    const shopper = spawnGbaNpc('lass', w * 0.19, floor1Y, 0.5, 2.6);
    shellGroup.add(clerk, shopper);
    npcs.push(clerk, shopper);
  } else if (kind === 'hotel') {
    // 2-STORY GRAND HOTEL:
    // 1F = Pure Reception Lobby, Concierge Bar, Sofa Lounge & Walkable Stairs (ZERO beds on 1F!)
    // 2F = Carpeted Upstairs Corridor + 3 Private Opaque Guest Suites (201, 202, 203) with Real Open Doorways & Double Beds!
    placeGlb('/models/furniture/rugRectangle.glb', { x: 2.5, y: floor1Y + 0.02, z: 2.5, targetW: 11.0, targetD: 8.0, solid: false });
    for (let bi = 0; bi < 3; bi++) {
      placeGlb('/models/furniture/kitchenBar.glb', {
        x: -2.0 + bi * 3.6,
        y: floor1Y,
        z: -d * 0.28,
        targetW: 3.6,
        targetD: 1.9,
      });
    }
    placeGlb('/models/furniture/computerScreen.glb', { x: 1.6, y: floor1Y + 1.75, z: -d * 0.28, targetW: 1.4, solid: false });
    placeGlb('/models/furniture/loungeDesignSofa.glb', { x: w * 0.26, y: floor1Y, z: 4.5, rotY: -Math.PI / 2, targetW: 5.4, targetD: 2.3 });
    placeGlb('/models/furniture/loungeChair.glb', { x: w * 0.14, y: floor1Y, z: 1.6, rotY: 0.6, targetW: 2.4, targetD: 2.2 });
    placeGlb('/models/furniture/loungeChair.glb', { x: w * 0.14, y: floor1Y, z: 7.4, rotY: 2.5, targetW: 2.4, targetD: 2.2 });
    placeGlb('/models/furniture/tableCoffeeGlass.glb', { x: w * 0.20, y: floor1Y, z: 4.5, targetW: 3.2, targetD: 2.0 });
    placeGlb('/models/furniture/coatRackStanding.glb', { x: w * 0.38, y: floor1Y, z: d * 0.34, targetW: 1.5 });
    placeGlb('/models/mini-market/freezers-standing.glb', { x: w * 0.42, y: floor1Y, z: -d * 0.16, rotY: -Math.PI / 2, targetW: 4.0, targetD: 2.0 });
    placeGlb('/models/furniture/pottedPlant.glb', { x: -doorW * 0.68, y: floor1Y, z: d * 0.41, targetW: 1.9 });
    placeGlb('/models/furniture/pottedPlant.glb', { x: doorW * 0.68, y: floor1Y, z: d * 0.41, targetW: 1.9 });

    const concierge = spawnGbaNpc('gentleman', 1.6, floor1Y, -d * 0.28 - 2.1, 2.65);
    const guest1F = spawnGbaNpc('beauty', 3.2, floor1Y, 4.0, 2.6);
    shellGroup.add(concierge, guest1F);
    npcs.push(concierge, guest1F);

    // 2F UPSTAIRS: Corridor on South (`z = +4.2..+d*0.48`), 3 Private Guest Suites along North (`z = -d*0.48..+3.2`)!
    const corrZ = 3.2;
    const eastSpanStart = -w * 0.44 + 5.2; // clear of stairwell on West!
    const suiteSpan = (w * 0.48 - eastSpanStart) / 3;
    for (let si = 0; si < 3; si++) {
      const sx0 = eastSpanStart + si * suiteSpan;
      const sx1 = sx0 + suiteSpan;
      const scx = (sx0 + sx1) * 0.5;
      addInteriorWallWithDoor(2, 'x', corrZ, sx0, sx1, scx, 3.3);
      if (si > 0) {
        addSolidPartition(2, 'z', sx0, -d * 0.49, corrZ);
      } else {
        addSolidPartition(2, 'z', sx0, -d * 0.22, corrZ);
      }

      // Furnish each private 2F Guest Suite with real Kenney 3D bed, nightstand, lamp, TV, desk & bath!
      placeGlb('/models/furniture/rugRound.glb', { x: scx, y: floor2Y + 0.03, z: -3.5, targetW: 5.5, targetD: 5.5, solid: false, floor: 2 });
      placeGlb('/models/furniture/bedDouble.glb', { x: scx - 1.2, y: floor2Y, z: -d * 0.31, targetW: 4.4, targetD: 5.2, floor: 2 });
      placeGlb('/models/furniture/cabinetBedDrawerTable.glb', { x: scx - 4.0, y: floor2Y, z: -d * 0.39, targetW: 1.4, targetD: 1.3, floor: 2 });
      placeGlb('/models/furniture/lampRoundTable.glb', { x: scx - 4.0, y: floor2Y + 1.25, z: -d * 0.39, targetW: 0.85, solid: false, floor: 2 });
      placeGlb('/models/furniture/desk.glb', { x: scx + 3.2, y: floor2Y, z: -d * 0.36, targetW: 2.8, targetD: 1.6, floor: 2 });
      placeGlb('/models/furniture/televisionModern.glb', { x: scx + 3.2, y: floor2Y + 1.42, z: -d * 0.38, targetW: 1.9, solid: false, floor: 2 });
      placeGlb('/models/furniture/chairModernCushion.glb', { x: scx + 3.2, y: floor2Y, z: -d * 0.22, rotY: Math.PI, targetW: 1.4, targetD: 1.4, floor: 2 });
      placeGlb('/models/furniture/bathroomSink.glb', { x: scx + 3.6, y: floor2Y, z: 0.6, rotY: -Math.PI / 2, targetW: 1.6, targetD: 1.2, floor: 2 });
    }
    placeGlb('/models/furniture/benchCushion.glb', { x: 2.0, y: floor2Y, z: d * 0.36, rotY: Math.PI, targetW: 3.8, targetD: 1.5, floor: 2 });
    placeGlb('/models/furniture/pottedPlant.glb', { x: w * 0.40, y: floor2Y, z: d * 0.36, targetW: 1.7, floor: 2 });
  } else if (kind === 'house') {
    // 2-STORY WALKABLE DUPLEX VILLA / APARTMENT:
    // 1F = Living Room + Kitchen & Dining + Walkable Stairs to 2F
    // 2F = Master Bedroom Suite + Study/Bathroom separated by solid walls & open doorways!
    placeGlb('/models/furniture/rugRectangle.glb', { x: -2.0, y: floor1Y + 0.02, z: 4.5, targetW: 9.0, targetD: 6.6, solid: false });
    placeGlb('/models/furniture/loungeSofaLong.glb', { x: -2.0, y: floor1Y, z: 7.4, rotY: Math.PI, targetW: 5.6, targetD: 2.2 });
    placeGlb('/models/furniture/loungeChairRelax.glb', { x: -6.2, y: floor1Y, z: 4.5, rotY: Math.PI / 2, targetW: 2.3, targetD: 2.2 });
    placeGlb('/models/furniture/tableCoffee.glb', { x: -2.0, y: floor1Y, z: 4.6, targetW: 3.2, targetD: 1.8 });
    placeGlb('/models/furniture/cabinetTelevisionDoors.glb', { x: -2.0, y: floor1Y, z: 1.4, targetW: 4.4, targetD: 1.4 });
    placeGlb('/models/furniture/televisionModern.glb', { x: -2.0, y: floor1Y + 1.45, z: 1.4, targetW: 2.6, solid: false });

    // 1F Kitchen & Family Dining on East/North-East
    placeGlb('/models/furniture/kitchenFridgeLarge.glb', { x: w * 0.12, y: floor1Y, z: -d * 0.39, targetW: 2.2, targetD: 1.9 });
    placeGlb('/models/furniture/kitchenSink.glb', { x: w * 0.21, y: floor1Y, z: -d * 0.39, targetW: 2.6, targetD: 1.8 });
    placeGlb('/models/furniture/kitchenStove.glb', { x: w * 0.30, y: floor1Y, z: -d * 0.39, targetW: 2.4, targetD: 1.8 });
    placeGlb('/models/furniture/hoodModern.glb', { x: w * 0.30, y: floor1Y + 2.8, z: -d * 0.40, targetW: 2.4, solid: false });
    placeGlb('/models/furniture/kitchenCabinet.glb', { x: w * 0.39, y: floor1Y, z: -d * 0.39, targetW: 2.6, targetD: 1.8 });
    placeGlb('/models/furniture/kitchenCoffeeMachine.glb', { x: w * 0.39, y: floor1Y + 1.65, z: -d * 0.39, targetW: 0.85, solid: false });

    placeGlb('/models/furniture/tableCrossCloth.glb', { x: w * 0.26, y: floor1Y, z: 2.2, targetW: 4.4, targetD: 2.8 });
    placeGlb('/models/food/plate-dinner.glb', { x: w * 0.23, y: floor1Y + 1.55, z: 2.0, targetW: 0.85, solid: false });
    placeGlb('/models/food/cake.glb', { x: w * 0.29, y: floor1Y + 1.55, z: 2.3, targetW: 0.85, solid: false });
    placeGlb('/models/furniture/chairCushion.glb', { x: w * 0.16, y: floor1Y, z: 2.2, rotY: Math.PI / 2, targetW: 1.3, targetD: 1.3 });
    placeGlb('/models/furniture/chairCushion.glb', { x: w * 0.36, y: floor1Y, z: 2.2, rotY: -Math.PI / 2, targetW: 1.3, targetD: 1.3 });
    placeGlb('/models/furniture/pottedPlant.glb', { x: w * 0.41, y: floor1Y, z: d * 0.38, targetW: 1.8 });

    const res1 = spawnGbaNpc('woman_1', 1.8, floor1Y, 6.2, 2.6);
    const res2 = spawnGbaNpc('boy', w * 0.22, floor1Y, 5.4, 2.55);
    shellGroup.add(res1, res2);
    npcs.push(res1, res2);

    // 2F UPSTAIRS: Master Bedroom (North-East) + Trainer Study & Bath (South-East) with solid walls & open doors!
    const roomX0 = -w * 0.44 + 5.2;
    addInteriorWallWithDoor(2, 'z', roomX0, -d * 0.49, d * 0.49, -2.5, 3.4);
    addInteriorWallWithDoor(2, 'x', 1.2, roomX0, w * 0.49, (roomX0 + w * 0.49) * 0.5, 3.3);

    // Master Bedroom (North-East 2F)
    const mbX = (roomX0 + w * 0.48) * 0.5;
    placeGlb('/models/furniture/rugRound.glb', { x: mbX, y: floor2Y + 0.03, z: -d * 0.22, targetW: 6.2, targetD: 6.2, solid: false, floor: 2 });
    placeGlb('/models/furniture/bedDouble.glb', { x: mbX, y: floor2Y, z: -d * 0.30, targetW: 4.8, targetD: 5.5, floor: 2 });
    placeGlb('/models/furniture/cabinetBedDrawer.glb', { x: mbX - 3.4, y: floor2Y, z: -d * 0.38, targetW: 1.5, targetD: 1.3, floor: 2 });
    placeGlb('/models/furniture/lampRoundTable.glb', { x: mbX - 3.4, y: floor2Y + 1.25, z: -d * 0.38, targetW: 0.9, solid: false, floor: 2 });
    placeGlb('/models/furniture/bookcaseClosedWide.glb', { x: w * 0.41, y: floor2Y, z: -d * 0.24, rotY: -Math.PI / 2, targetW: 3.6, targetD: 1.4, floor: 2 });
    placeGlb('/models/furniture/bear.glb', { x: mbX + 3.4, y: floor2Y, z: -d * 0.36, rotY: -0.5, targetW: 1.3, floor: 2 });

    // Study & Bath (South-East 2F)
    placeGlb('/models/furniture/desk.glb', { x: mbX - 2.5, y: floor2Y, z: d * 0.34, rotY: Math.PI, targetW: 3.4, targetD: 1.8, floor: 2 });
    placeGlb('/models/furniture/computerScreen.glb', { x: mbX - 2.5, y: floor2Y + 1.45, z: d * 0.36, rotY: Math.PI, targetW: 1.5, solid: false, floor: 2 });
    placeGlb('/models/furniture/chairDesk.glb', { x: mbX - 2.5, y: floor2Y, z: d * 0.20, targetW: 1.4, targetD: 1.4, floor: 2 });
    placeGlb('/models/furniture/bookcaseOpen.glb', { x: mbX + 2.2, y: floor2Y, z: d * 0.38, rotY: Math.PI, targetW: 2.8, targetD: 1.3, floor: 2 });
    placeGlb('/models/furniture/bathtub.glb', { x: w * 0.39, y: floor2Y, z: d * 0.24, rotY: -Math.PI / 2, targetW: 3.6, targetD: 1.9, floor: 2 });
  } else if (kind === 'restaurant') {
    // 1F RESTAURANT: Real Kenney Open Kitchen Bar, Barstools, Stoves, Pots & 4 Side Dining Booths with 3D Ramen/Sushi!
    const kZ = -d * 0.26;
    for (let bi = -2; bi <= 2; bi++) {
      placeGlb('/models/furniture/kitchenBar.glb', { x: bi * 3.5, y: floor1Y, z: kZ, targetW: 3.5, targetD: 1.9 });
      placeGlb('/models/furniture/stoolBar.glb', { x: bi * 3.5, y: floor1Y, z: kZ + 2.0, targetW: 1.1, targetD: 1.1 });
    }
    placeGlb('/models/furniture/kitchenStove.glb', { x: -3.2, y: floor1Y, z: -d * 0.40, targetW: 2.6, targetD: 1.8 });
    placeGlb('/models/furniture/kitchenStove.glb', { x: 3.2, y: floor1Y, z: -d * 0.40, targetW: 2.6, targetD: 1.8 });
    placeGlb('/models/furniture/hoodModern.glb', { x: -3.2, y: floor1Y + 2.9, z: -d * 0.41, targetW: 2.6, solid: false });
    placeGlb('/models/furniture/hoodModern.glb', { x: 3.2, y: floor1Y + 2.9, z: -d * 0.41, targetW: 2.6, solid: false });
    placeGlb('/models/food/pot-stew.glb', { x: -3.2, y: floor1Y + 1.65, z: -d * 0.40, targetW: 1.0, solid: false });
    placeGlb('/models/furniture/kitchenFridgeLarge.glb', { x: -8.2, y: floor1Y, z: -d * 0.40, targetW: 2.3, targetD: 1.9 });

    // 4 Side Dining Tables (leaving wide central walkway straight to Chef!)
    const dishes = ['/models/food/bowl-soup.glb', '/models/food/maki-salmon.glb', '/models/food/chinese.glb', '/models/food/cup-coffee.glb'];
    for (let r = 0; r < 2; r++) {
      for (const side of [-1, 1]) {
        const tx = side * (w * 0.27);
        const tz = 1.5 + r * 7.8;
        placeGlb('/models/furniture/tableCrossCloth.glb', { x: tx, y: floor1Y, z: tz, targetW: 4.3, targetD: 2.9 });
        placeGlb(dishes[(r * 2 + (side > 0 ? 1 : 0)) % dishes.length], { x: tx - 0.8, y: floor1Y + 1.55, z: tz - 0.3, targetW: 0.85, solid: false });
        placeGlb(dishes[(r * 2 + (side > 0 ? 2 : 3)) % dishes.length], { x: tx + 0.8, y: floor1Y + 1.55, z: tz + 0.3, targetW: 0.85, solid: false });
        placeGlb('/models/furniture/chairModernCushion.glb', { x: tx - 2.7, y: floor1Y, z: tz, rotY: Math.PI / 2, targetW: 1.35, targetD: 1.35 });
        placeGlb('/models/furniture/chairModernCushion.glb', { x: tx + 2.7, y: floor1Y, z: tz, rotY: -Math.PI / 2, targetW: 1.35, targetD: 1.35 });
      }
    }
    placeGlb('/models/furniture/pottedPlant.glb', { x: -w * 0.41, y: floor1Y, z: d * 0.36, targetW: 1.8 });
    placeGlb('/models/furniture/pottedPlant.glb', { x: w * 0.41, y: floor1Y, z: d * 0.36, targetW: 1.8 });

    const chef = spawnGbaNpc('chef', 0, floor1Y, kZ - 1.9, 2.65);
    const diner1 = spawnGbaNpc('youngster', -w * 0.27, floor1Y, 4.6, 2.55);
    const diner2 = spawnGbaNpc('picnicker', w * 0.27, floor1Y, 4.6, 2.55);
    shellGroup.add(chef, diner1, diner2);
    npcs.push(chef, diner1, diner2);
  } else {
    // 2-STORY POKÉMON CENTER:
    // 1F = Pokéball Emblem, Nurse Joy Healing Desk, Waiting Sofas & Walkable Stairs to 2F
    // 2F = Trainer Trade & PC Lounge Mezzanine!
    const rugR = Math.min(w, d) * 0.14;
    const rugTop = new THREE.Mesh(new THREE.CircleGeometry(rugR, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xff6b6b }));
    rugTop.rotation.x = -Math.PI / 2;
    rugTop.rotation.z = Math.PI;
    rugTop.position.set(2.0, floor1Y + 0.02, 2.2);
    const rugBot = new THREE.Mesh(new THREE.CircleGeometry(rugR, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xf8f9fa }));
    rugBot.rotation.x = -Math.PI / 2;
    rugBot.position.set(2.0, floor1Y + 0.02, 2.2);
    const rugCenter = new THREE.Mesh(new THREE.CircleGeometry(rugR * 0.28, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    rugCenter.rotation.x = -Math.PI / 2;
    rugCenter.position.set(2.0, floor1Y + 0.03, 2.2);
    shellGroup.add(rugTop, rugBot, rugCenter);

    const cZ = -d * 0.24;
    for (let bi = -1; bi <= 2; bi++) {
      placeGlb('/models/furniture/kitchenBar.glb', { x: bi * 3.6, y: floor1Y, z: cZ, targetW: 3.6, targetD: 2.0 });
    }
    placeGlb('/models/furniture/computerScreen.glb', { x: -1.5, y: floor1Y + 1.75, z: cZ, targetW: 1.5, solid: false });
    placeGlb('/models/furniture/computerScreen.glb', { x: 5.5, y: floor1Y + 1.75, z: cZ, targetW: 1.5, solid: false });
    placeGlb('/models/furniture/loungeDesignSofa.glb', { x: w * 0.28, y: floor1Y, z: 4.5, rotY: -Math.PI / 2, targetW: 5.2, targetD: 2.2 });
    placeGlb('/models/furniture/tableCoffeeGlass.glb', { x: w * 0.18, y: floor1Y, z: 4.5, targetW: 3.0, targetD: 1.8 });
    placeGlb('/models/furniture/bookcaseOpen.glb', { x: w * 0.41, y: floor1Y, z: -2.0, rotY: -Math.PI / 2, targetW: 3.0, targetD: 1.3 });
    placeGlb('/models/furniture/pottedPlant.glb', { x: w * 0.41, y: floor1Y, z: d * 0.36, targetW: 1.9 });

    const nurse = spawnGbaNpc('nurse', 2.0, floor1Y, cZ - 2.0, 2.65);
    const trainer1 = spawnGbaNpc('cooltrainer_m', w * 0.16, floor1Y, 7.2, 2.6);
    shellGroup.add(nurse, trainer1);
    npcs.push(nurse, trainer1);

    // 2F Trainer PC & Cafe Lounge
    for (let ti = 0; ti < 2; ti++) {
      const tx = 1.5 + ti * 8.5;
      placeGlb('/models/furniture/desk.glb', { x: tx, y: floor2Y, z: -d * 0.34, targetW: 3.2, targetD: 1.7, floor: 2 });
      placeGlb('/models/furniture/computerScreen.glb', { x: tx, y: floor2Y + 1.45, z: -d * 0.36, targetW: 1.5, solid: false, floor: 2 });
      placeGlb('/models/furniture/chairDesk.glb', { x: tx, y: floor2Y, z: -d * 0.20, rotY: Math.PI, targetW: 1.4, targetD: 1.4, floor: 2 });
      placeGlb('/models/furniture/tableRound.glb', { x: tx, y: floor2Y, z: 4.5, targetW: 3.2, targetD: 3.2, floor: 2 });
      placeGlb('/models/food/cup-coffee.glb', { x: tx, y: floor2Y + 1.45, z: 4.5, targetW: 0.65, solid: false, floor: 2 });
      placeGlb('/models/furniture/chairRounded.glb', { x: tx - 2.2, y: floor2Y, z: 4.5, rotY: Math.PI / 2, targetW: 1.3, targetD: 1.3, floor: 2 });
      placeGlb('/models/furniture/chairRounded.glb', { x: tx + 2.2, y: floor2Y, z: 4.5, rotY: -Math.PI / 2, targetW: 1.3, targetD: 1.3, floor: 2 });
    }
    placeGlb('/models/mini-market/freezers-standing.glb', { x: w * 0.41, y: floor2Y, z: 0, rotY: -Math.PI / 2, targetW: 4.2, targetD: 2.0, floor: 2 });
  }

  return {
    shellGroup,
    npcs,
    colliders,
    autoDoors,
    stairZone,
    stories,
    floor1CeilingY: baseWorldY + floor1Y + H1,
    floor2CeilingY: baseWorldY + roofY,
    dualDoors,
  };
}
