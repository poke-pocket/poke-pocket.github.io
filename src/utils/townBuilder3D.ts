import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  WATER_LEVEL_3D,
  WORLD_ROAD_SEGMENTS_3D,
  WORLD_TOWNS_3D,
} from '../data/survivorsTactics';
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
}

export interface EnterableBuildingInterior {
  id: string;
  name: string;
  kind: 'pokemon_center' | 'poke_mart' | 'house';
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  exteriorGroup: THREE.Group;
  interiorGroup: THREE.Group;
  npcSprites: THREE.Mesh[];
  cutawayAlpha: number;
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
  };
}

/** Shared AABB wall collision push-out used for Player, Followers, AND Wild Pokémon so nobody clips through buildings! */
export function resolveTownWallCollisions(
  pos: { x: number; z: number },
  pad: number,
  colliders: TownCollider[],
): void {
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
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
              return new THREE.MeshLambertMaterial({
                color: std.color ? std.color.clone() : new THREE.Color(0xffffff),
                map: std.map ?? null,
                side: std.side,
                transparent: std.transparent,
                opacity: std.opacity,
              });
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

  const wrapper = new THREE.Group();
  wrapper.position.set(opts.x, opts.y, opts.z);
  wrapper.rotation.y = opts.rotY ?? 0;

  clone.scale.setScalar(scale);
  clone.position.set(
    -rawCenter.x * scale,
    -rawBox.min.y * scale - 0.04,
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
            const c = mm.clone() as THREE.MeshLambertMaterial;
            if (tintColor && c.color) c.color.lerp(tintColor, 0.2);
            return c;
          });
        } else if (mesh.material) {
          const c = mesh.material.clone() as THREE.MeshLambertMaterial;
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
  parent.add(wrapper);
  const finalH = rawSize.y * scale;
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
  highwayTile: THREE.CanvasTexture;
  crosswalk: THREE.CanvasTexture;
  martSign: THREE.CanvasTexture;
  hotelSign: THREE.CanvasTexture;
  cafeSign: THREE.CanvasTexture;
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
    highwayTile,
    crosswalk,
    martSign: makeSign('#1971c2', 'MART'),
    hotelSign: makeSign('#f08c00', 'HOTEL'),
    cafeSign: makeSign('#d9480f', 'CAFE'),
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
 * TERRAIN-CONFORMING INTER-TOWN HIGHWAY ROAD NETWORK (Connects Spawn + All 5 Villages/Towns + Bridges over Water!)
 */
export function buildInterTownRoadNetwork3D(
  getGroundHeight: (x: number, z: number) => number,
): THREE.Group {
  const tex = getGroundTex();
  const group = new THREE.Group();
  const roadW = 7.4;

  for (const [ax, az, bx, bz] of WORLD_ROAD_SEGMENTS_3D) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(8, Math.ceil(dist / 3.5));
    const dirX = (bx - ax) / dist;
    const dirZ = (bz - az) / dist;
    const perpX = -dirZ * (roadW * 0.5);
    const perpZ = dirX * (roadW * 0.5);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      const lx = cx - perpX;
      const lz = cz - perpZ;
      const rx = cx + perpX;
      const rz = cz + perpZ;
      const ly = Math.max(WATER_LEVEL_3D + 0.22, getGroundHeight(lx, lz) + 0.14);
      const ry = Math.max(WATER_LEVEL_3D + 0.22, getGroundHeight(rx, rz) + 0.14);
      const cy = Math.max(ly, ry);
      positions.push(lx, cy, lz, rx, cy, rz);
      const u = (t * dist) / 7.5;
      uvs.push(u, 0, u, 1);

      if (s < steps) {
        const i0 = s * 2;
        indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      map: tex.highwayTile,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
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

function createPlazaFountain(fountains: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xd9d2c5 });
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x4dabf7,
    emissive: 0x1971c2,
    transparent: true,
    opacity: 0.88,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.3, 0.9, 10), stoneMat);
  base.position.y = 0.45;
  base.receiveShadow = true;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.35, 0.16, 10), waterMat);
  water.position.y = 0.86;
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 1.05, 2.7, 8), stoneMat);
  spire.position.y = 1.85;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 0.65, 0.65, 10), stoneMat);
  bowl.position.y = 3.2;
  const plume = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.1, 8), waterMat);
  plume.position.y = 4.4;
  g.add(base, water, spire, bowl, plume);
  fountains.push(plume);
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

  const nurse = createNpcBillboard('/sprites/trainers/nurse.png', 0, 0.15, -d * 0.34, 2.85);
  const guest = createNpcBillboard('/sprites/trainers/lass.png', w * 0.25, 0.15, 1.2, 2.65);
  g.add(nurse, guest);
  npcs.push(nurse, guest);

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

  const clerk = createNpcBillboard('/sprites/trainers/erika.png', -w * 0.16, 0.15, -d * 0.34, 2.75);
  const shopper = createNpcBillboard('/sprites/trainers/blue.png', w * 0.16, 0.15, 0.4, 2.75);
  g.add(clerk, shopper);
  npcs.push(clerk, shopper);

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

  const resident = createNpcBillboard('/sprites/trainers/youngster.png', 1.8, 0.15, 1.4, 2.65);
  g.add(resident);
  npcs.push(resident);

  return { group: g, npcs };
}

const HOUSE_POOL = [
  '/models/town/suburban/house-a.glb',
  '/models/town/suburban/house-c.glb',
  '/models/town/suburban/house-f.glb',
  '/models/town/suburban/house-i.glb',
  '/models/town/suburban/house-l.glb',
  '/models/town/suburban/house-o.glb',
];

const SHOP_POOL = [
  '/models/town/commercial/mart-boutique.glb',
  '/models/town/commercial/shop-a.glb',
  '/models/town/commercial/shop-d.glb',
  '/models/town/commercial/shop-g.glb',
];

/** Helper: builds a terrain-hugging street ribbon mesh along a single street segment */
function buildStreetRibbonMesh(
  seg: TownStreetSeg,
  baseY: number,
  originX: number,
  originZ: number,
  tex: THREE.CanvasTexture,
  getGroundHeight: (x: number, z: number) => number,
): THREE.Mesh {
  const dist = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const steps = Math.max(4, Math.ceil(dist / 3.2));
  const dirX = (seg.x2 - seg.x1) / Math.max(0.01, dist);
  const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, dist);
  const perpX = -dirZ * (seg.width * 0.5);
  const perpZ = dirX * (seg.width * 0.5);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const wx = seg.x1 + (seg.x2 - seg.x1) * t;
    const wz = seg.z1 + (seg.z2 - seg.z1) * t;
    const lx = wx - perpX;
    const lz = wz - perpZ;
    const rx = wx + perpX;
    const rz = wz + perpZ;
    const y = Math.max(WATER_LEVEL_3D + 0.2, Math.max(getGroundHeight(lx, lz), getGroundHeight(rx, rz)) + 0.12) - baseY;
    positions.push(lx - originX, y, lz - originZ, rx - originX, y, rz - originZ);
    const u = (t * dist) / 7.5;
    uvs.push(u, 0, u, 1);
    if (s < steps) {
      const i0 = s * 2;
      indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }),
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
    name: customName ?? '真新村镇',
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
  const interiors: EnterableBuildingInterior[] = [];
  const interactPoints: TownInteractPoint[] = [];
  const colliders: TownCollider[] = [];

  const localGroundY = (wx: number, wz: number) => getGroundHeight(wx, wz) - baseY;

  // 1. Organic Branching Streets & Side Alleys (Natural green grass remains between yards — NO circular disc!)
  for (const seg of layout.streets) {
    const roadTex = seg.kind === 'alley' ? tex.cobblePlaza : tex.highwayTile;
    group.add(buildStreetRibbonMesh(seg, baseY, centerX, centerZ, roadTex, getGroundHeight));
  }

  // Cozy small stone plaza ONLY right around the central junction fountain (r = 8m!)
  const hubPlaza = new THREE.Mesh(
    new THREE.CircleGeometry(8.2, 16),
    new THREE.MeshLambertMaterial({ map: tex.cobblePlaza }),
  );
  hubPlaza.rotation.x = -Math.PI / 2;
  hubPlaza.position.set(0, 0.08, 0);
  hubPlaza.receiveShadow = true;
  group.add(hubPlaza);

  const fountain = createPlazaFountain(fountains);
  fountain.position.set(0, 0, 0);
  group.add(fountain);
  colliders.push({ minX: centerX - 3.9, maxX: centerX + 3.9, minZ: centerZ - 3.9, maxZ: centerZ + 3.9 });

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
        addInkEdges: true,
        tintHex: 0xffd6d6,
        cloneMaterials: true,
        onMounted: (wrapper, h) => {
          const beacon = createPokeballBeacon(1.85);
          beacon.position.set(0, h + 1.65, 0);
          wrapper.add(beacon);
          spinners.push(beacon);
        },
      });
      const rW = lot.width * 0.78;
      const rD = lot.depth * 0.78;
      const pcInt = buildPokemonCenterInterior(tex, rW, rD);
      pcInt.group.position.set(lx, ly, lz);
      pcInt.group.rotation.y = lot.rotY;
      pcInt.group.visible = false;
      group.add(pcInt.group);

      interiors.push({
        id: `${lot.id}_int`,
        name: `${townName}·宝可梦中心`,
        kind: 'pokemon_center',
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
      // Open doorway facing street (simple low-friction corner pillars instead of blocking entrance!)
      const cornerOffX = rW * 0.45;
      const cornerOffZ = rD * 0.45;
      colliders.push(
        { minX: lot.x - cornerOffX - 0.6, maxX: lot.x - cornerOffX + 0.6, minZ: lot.z - cornerOffZ - 0.6, maxZ: lot.z - cornerOffZ + 0.6 },
        { minX: lot.x + cornerOffX - 0.6, maxX: lot.x + cornerOffX + 0.6, minZ: lot.z - cornerOffZ - 0.6, maxZ: lot.z - cornerOffZ + 0.6 },
        { minX: lot.x - cornerOffX - 0.6, maxX: lot.x - cornerOffX + 0.6, minZ: lot.z + cornerOffZ - 0.6, maxZ: lot.z + cornerOffZ + 0.6 },
        { minX: lot.x + cornerOffX - 0.6, maxX: lot.x + cornerOffX + 0.6, minZ: lot.z + cornerOffZ - 0.6, maxZ: lot.z + cornerOffZ + 0.6 },
      );
      interactPoints.push({
        id: `${id}_pc`,
        townName,
        kind: 'pokemon_center',
        label: `🏥 乔伊小姐 · 宝可梦中心`,
        hint: '全队免费治疗并补满伤药',
        x: lot.x,
        z: lot.z,
        radius: 6.8,
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
        addInkEdges: true,
        cloneMaterials: true,
        onMounted: (wrapper, h) => {
          const signMesh = new THREE.Mesh(
            new THREE.BoxGeometry(5.0, 1.9, 0.45),
            new THREE.MeshBasicMaterial({ map: tex.martSign }),
          );
          signMesh.position.set(0, h + 1.1, 3.2);
          wrapper.add(signMesh);
        },
      });
      const rW = lot.width * 0.78;
      const rD = lot.depth * 0.78;
      const mInt = buildPokeMartInterior(tex, rW, rD);
      mInt.group.position.set(lx, ly, lz);
      mInt.group.rotation.y = lot.rotY;
      mInt.group.visible = false;
      group.add(mInt.group);

      interiors.push({
        id: `${lot.id}_int`,
        name: `${townName}·友好商店`,
        kind: 'poke_mart',
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
      interactPoints.push({
        id: `${id}_mart`,
        townName,
        kind: 'poke_mart',
        label: `🏪 友好商店店员`,
        hint: '打开精品外观与树果补给商店',
        x: lot.x,
        z: lot.z,
        radius: 6.4,
      });
    } else if (lot.kind === 'hotel') {
      void mountGlbModel(group, '/models/town/commercial/shop-g.glb', {
        x: lx,
        y: ly,
        z: lz,
        rotY: lot.rotY,
        targetWidth: lot.width,
        addInkEdges: true,
        onMounted: (wrapper, h) => {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(5.2, 1.9, 0.45),
            new THREE.MeshBasicMaterial({ map: tex.hotelSign }),
          );
          sign.position.set(0, h + 1.0, 3.0);
          wrapper.add(sign);
        },
      });
      colliders.push({
        minX: lot.x - lot.width * 0.44,
        maxX: lot.x + lot.width * 0.44,
        minZ: lot.z - lot.depth * 0.44,
        maxZ: lot.z + lot.depth * 0.44,
      });
      interactPoints.push({
        id: `${id}_hotel`,
        townName,
        kind: 'hotel_rest',
        label: `🏨 ${townName}·驿站酒店`,
        hint: '办理入住休整，全队体力回满并获攻击强化',
        x: lot.doorX,
        z: lot.doorZ,
        radius: 5.5,
      });
    } else if (lot.kind === 'restaurant') {
      void mountGlbModel(group, '/models/town/commercial/shop-d.glb', {
        x: lx,
        y: ly,
        z: lz,
        rotY: lot.rotY,
        targetWidth: lot.width,
        addInkEdges: true,
        onMounted: (wrapper, h) => {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(4.8, 1.8, 0.42),
            new THREE.MeshBasicMaterial({ map: tex.cafeSign }),
          );
          sign.position.set(0, h + 1.0, 2.8);
          wrapper.add(sign);
        },
      });
      void mountGlbModel(group, '/models/town/commercial/parasol-a.glb', {
        x: lot.doorX - centerX,
        y: localGroundY(lot.doorX, lot.doorZ),
        z: lot.doorZ - centerZ,
        targetWidth: 3.4,
        addInkEdges: true,
      });
      colliders.push({
        minX: lot.x - lot.width * 0.44,
        maxX: lot.x + lot.width * 0.44,
        minZ: lot.z - lot.depth * 0.44,
        maxZ: lot.z + lot.depth * 0.44,
      });
      interactPoints.push({
        id: `${id}_cafe`,
        townName,
        kind: 'restaurant',
        label: `🍜 ${townName}·树果饭店`,
        hint: '享用热腾腾的树果料理，提升全队斗志',
        x: lot.doorX,
        z: lot.doorZ,
        radius: 5.5,
      });
    } else if (lot.kind === 'landmark' && anchor.landmarkCityId) {
      const lm = buildWorldLandmark3D(anchor.landmarkCityId);
      if (lm) {
        lm.position.set(lx, ly, lz);
        group.add(lm);
        colliders.push({
          minX: lot.x - 5.2,
          maxX: lot.x + 5.2,
          minZ: lot.z - 5.2,
          maxZ: lot.z + 5.2,
        });
      }
    } else if (lot.kind === 'house') {
      const url = HOUSE_POOL[lot.houseVariant % HOUSE_POOL.length];
      if (lot.walkable) {
        const hExt = new THREE.Group();
        group.add(hExt);
        void mountGlbModel(hExt, url, {
          x: lx,
          y: ly,
          z: lz,
          rotY: lot.rotY,
          targetWidth: lot.width,
          addInkEdges: true,
          cloneMaterials: true,
        });
        const rW = lot.width * 0.76;
        const rD = lot.depth * 0.74;
        const hInt = buildTownHouseInterior(tex, rW, rD);
        hInt.group.position.set(lx, ly, lz);
        hInt.group.rotation.y = lot.rotY;
        hInt.group.visible = false;
        group.add(hInt.group);
        interiors.push({
          id: `${lot.id}_int`,
          name: `${townName}·训练家民宅`,
          kind: 'house',
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
        interactPoints.push({
          id: `${id}_house_npc`,
          townName,
          kind: 'npc_chat',
          label: `💬 与小镇训练家交谈`,
          hint: '打听城镇路网与地标建筑',
          dialogText: `🏠 小镇训练家：「欢迎来到${townName}！顺着镇外的大路可以直接走到其他城镇，镇里还开着宝可梦中心、商店、酒店和饭店哦！」`,
          x: lot.x,
          z: lot.z,
          radius: 5.0,
        });
      } else {
        void mountGlbModel(group, url, {
          x: lx,
          y: ly,
          z: lz,
          rotY: lot.rotY,
          targetWidth: lot.width,
          addInkEdges: true,
        });
        colliders.push({
          minX: lot.x - lot.width * 0.43,
          maxX: lot.x + lot.width * 0.43,
          minZ: lot.z - lot.depth * 0.42,
          maxZ: lot.z + lot.depth * 0.42,
        });
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
  for (const lamp of layout.streetLamps) {
    void mountGlbModel(group, '/models/town/roads/lamp-curved.glb', {
      x: lamp.x - centerX,
      y: localGroundY(lamp.x, lamp.z),
      z: lamp.z - centerZ,
      rotY: lamp.rotY,
      targetWidth: 2.5,
      addInkEdges: true,
    });
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
    },
  };
}
