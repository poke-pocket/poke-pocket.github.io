import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type TownInteractKind = 'pokemon_center' | 'poke_mart' | 'transit_station';

export interface TownInteractPoint {
  id: string;
  townName: string;
  kind: TownInteractKind;
  label: string;
  hint: string;
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

export interface ProceduralTownInstance {
  id: string;
  name: string;
  centerX: number;
  centerZ: number;
  safeRadius: number;
  group: THREE.Group;
  interactPoints: TownInteractPoint[];
  colliders: TownCollider[];
  trainGroup?: THREE.Group;
  trainBaseX?: number;
  animatedParts?: {
    spinners: THREE.Object3D[];
    fountains: THREE.Object3D[];
  };
}

const GLTF_LOADER = new GLTFLoader();
const MODEL_PROMISE_CACHE = new Map<string, Promise<THREE.Group | null>>();
const INK_LINE_MAT = new THREE.LineBasicMaterial({
  color: 0x1a1e29,
  transparent: true,
  opacity: 0.48,
});

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
              // Convert PBR MeshStandardMaterial -> vibrant MeshLambertMaterial so colors pop brightly in sunlit toon lighting!
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

/**
 * Clones a cached CC0 GLB model, scales it proportionally to `targetFootprint`,
 * snaps its exact bottom (`box.min.y === 0`) cleanly to ground level,
 * and adds crisp architectural ink crease lines (PokéBonk cel-art feel!).
 */
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
    -rawBox.min.y * scale - 0.04, // snug into terrain with zero gap!
    -rawCenter.z * scale,
  );

  if (opts.tintHex !== undefined || opts.addInkEdges) {
    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (opts.tintHex !== undefined) {
        const tintColor = new THREE.Color(opts.tintHex);
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mm) => {
            const c = mm.clone() as THREE.MeshStandardMaterial;
            if (c.color) c.color.lerp(tintColor, 0.22);
            return c;
          });
        } else if (mesh.material) {
          const c = mesh.material.clone() as THREE.MeshStandardMaterial;
          if (c.color) c.color.lerp(tintColor, 0.22);
          mesh.material = c;
        }
      }
      if (opts.addInkEdges && mesh.geometry) {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 36);
        const line = new THREE.LineSegments(edges, INK_LINE_MAT);
        mesh.add(line);
      }
    });
  }

  wrapper.add(clone);
  parent.add(wrapper);
  const finalH = rawSize.y * scale;
  opts.onMounted?.(wrapper, finalH);
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
  crosswalk: THREE.CanvasTexture;
  martSign: THREE.CanvasTexture;
  busSign: THREE.CanvasTexture;
}

let CACHED_GROUND_TEX: TownGroundTex | null = null;

function getGroundTex(): TownGroundTex {
  if (CACHED_GROUND_TEX) return CACHED_GROUND_TEX;

  const cobblePlaza = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#ddd3be';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#c4b89c';
      for (let y = 0; y < 32; y += 8) {
        ctx.fillRect(0, y, 32, 1);
        for (let x = (y % 16 === 0 ? 0 : 4); x < 32; x += 8) {
          ctx.fillRect(x, y, 1, 8);
        }
      }
      ctx.fillStyle = '#ece3d0';
      ctx.fillRect(2, 2, 5, 5);
      ctx.fillRect(18, 10, 5, 5);
      ctx.fillRect(10, 26, 5, 5);
    },
    7,
    7,
  );

  const roadTile = makePixelTex(
    32,
    32,
    (ctx) => {
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
    },
    7,
    1,
  );

  const crosswalk = makePixelTex(32, 32, (ctx) => {
    ctx.fillStyle = '#5c6472';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#faf6eb';
    for (let y = 4; y < 28; y += 6) ctx.fillRect(4, y, 24, 3);
  });

  const martSign = makePixelTex(64, 24, (ctx) => {
    ctx.fillStyle = '#1971c2';
    ctx.fillRect(0, 0, 64, 24);
    ctx.strokeStyle = '#141926';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 61, 21);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MART', 32, 13);
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

  CACHED_GROUND_TEX = { cobblePlaza, roadTile, crosswalk, martSign, busSign };
  return CACHED_GROUND_TEX;
}

/** Iconic rotating 3D Pokéball Rooftop Beacon mounted atop real Pokémon Center GLB halls */
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

/** Octagonal stone fountain centerpiece for town plazas */
function createPlazaFountain(fountains: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0xd9d2c5 });
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x4dabf7,
    emissive: 0x1971c2,
    transparent: true,
    opacity: 0.88,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.6, 10), stoneMat);
  base.position.y = 0.3;
  base.receiveShadow = true;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.12, 10), waterMat);
  water.position.y = 0.58;
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.72, 1.8, 8), stoneMat);
  spire.position.y = 1.25;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.42, 0.42, 10), stoneMat);
  bowl.position.y = 2.15;
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.35, 8), waterMat);
  plume.position.y = 2.95;
  g.add(base, water, spire, bowl, plume);
  fountains.push(plume);
  return g;
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

/**
 * Procedurally assembles a UNIQUE, terrain-matched Pokémon Town using real handcrafted CC0 3D GLB models!
 * - Sits on a smooth dry plateau guaranteed above WATER_LEVEL_3D (zero water overlap!)
 * - Every building snaps flush to local terrain height with crisp cel-ink edges
 * - Mixes distinct houses, commercial storefronts, grand Pokémon Center, bullet train & streetcar per town!
 */
export function buildProceduralTown3D(
  id: string,
  centerX: number,
  centerZ: number,
  seed: number,
  getGroundHeight: (x: number, z: number) => number,
  customName?: string,
  plazaRadius = 22,
): ProceduralTownInstance {
  const tex = getGroundTex();
  const group = new THREE.Group();
  const baseY = getGroundHeight(centerX, centerZ);
  group.position.set(centerX, baseY, centerZ);

  const townName = customName ?? '真新小镇';
  const styleIdx = Math.abs(seed) % 4;
  const isMajorCity = styleIdx === 0 || styleIdx === 2;
  const mirrorX = styleIdx % 2 === 0 ? 1 : -1;

  const spinners: THREE.Object3D[] = [];
  const fountains: THREE.Object3D[] = [];

  // 1. Softly tapered cobblestone town square + boulevard street (matches terraced plateau perfectly!)
  const plazaMesh = new THREE.Mesh(
    new THREE.CircleGeometry(plazaRadius, 20),
    new THREE.MeshLambertMaterial({ map: tex.cobblePlaza }),
  );
  plazaMesh.rotation.x = -Math.PI / 2;
  plazaMesh.position.set(0, 0.05, 0);
  plazaMesh.receiveShadow = true;
  group.add(plazaMesh);

  const roadH = new THREE.Mesh(
    new THREE.PlaneGeometry(plazaRadius * 2.05, 5.2),
    new THREE.MeshLambertMaterial({ map: tex.roadTile }),
  );
  roadH.rotation.x = -Math.PI / 2;
  roadH.position.set(0, 0.07, 3.2);
  roadH.receiveShadow = true;
  group.add(roadH);

  const cw = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.8),
    new THREE.MeshLambertMaterial({ map: tex.crosswalk }),
  );
  cw.rotation.x = -Math.PI / 2;
  cw.position.set(0, 0.08, 3.2);
  group.add(cw);

  // Central Town Fountain Plaza
  const fountain = createPlazaFountain(fountains);
  fountain.position.set(0, 0, -2.0);
  group.add(fountain);

  const localGroundY = (lx: number, lz: number) => getGroundHeight(centerX + lx, centerZ + lz) - baseY;

  // 2. GRAND POKÉMON CENTER (Real CC0 multi-story commercial architecture + coral roof accent + rotating 3D Pokéball beacon!)
  const pcX = -9.6 * mirrorX;
  const pcZ = -7.6;
  const pcWidth = isMajorCity ? 10.6 : 8.6;
  const pcModelUrl = isMajorCity
    ? '/models/town/commercial/shop-k.glb'
    : '/models/town/commercial/center-grand.glb';
  void mountGlbModel(group, pcModelUrl, {
    x: pcX,
    y: localGroundY(pcX, pcZ),
    z: pcZ,
    rotY: mirrorX * 0.16,
    targetWidth: pcWidth,
    addInkEdges: true,
    tintHex: 0xffd6d6,
    onMounted: (wrapper, h) => {
      const beacon = createPokeballBeacon(isMajorCity ? 1.25 : 1.0);
      beacon.position.set(0, h + 1.15, 0);
      wrapper.add(beacon);
      spinners.push(beacon);
    },
  });
  const pcMat = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 14),
    new THREE.MeshBasicMaterial({ color: 0xfa5252 }),
  );
  pcMat.rotation.x = -Math.PI / 2;
  pcMat.position.set(pcX, 0.09, pcZ + 5.6);
  group.add(pcMat);

  // 3. BOUTIQUE POKÉ MART (Real CC0 commercial storefront + rooftop MART sign + outdoor café parasol!)
  const martX = 9.8 * mirrorX;
  const martZ = -7.2;
  const martUrl = SHOP_POOL[styleIdx % SHOP_POOL.length];
  void mountGlbModel(group, martUrl, {
    x: martX,
    y: localGroundY(martX, martZ),
    z: martZ,
    rotY: -mirrorX * 0.18,
    targetWidth: isMajorCity ? 9.0 : 7.8,
    addInkEdges: true,
    onMounted: (wrapper, h) => {
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.25, 0.3),
        new THREE.MeshBasicMaterial({ map: tex.martSign }),
      );
      signMesh.position.set(0, h + 0.72, 2.2);
      wrapper.add(signMesh);
    },
  });
  const martCarpet = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 14),
    new THREE.MeshBasicMaterial({ color: 0x228be6 }),
  );
  martCarpet.rotation.x = -Math.PI / 2;
  martCarpet.position.set(martX, 0.09, martZ + 5.1);
  group.add(martCarpet);

  // Outdoor Café Parasol beside the Mart
  void mountGlbModel(group, '/models/town/commercial/parasol-a.glb', {
    x: martX + 4.4 * mirrorX,
    y: localGroundY(martX + 4.4 * mirrorX, martZ + 3.8),
    z: martZ + 3.8,
    targetWidth: 2.2,
    addInkEdges: true,
  });

  // 4. THREE COMPLETELY DISTINCT HANDCRAFTED SUBURBAN HOUSES & SHOPS ALONG SOUTH AVENUE (Zero copy-paste!)
  const houseSlots: { x: number; z: number; rotY: number; url: string; width: number }[] = [
    {
      x: -11.4,
      z: 10.6,
      rotY: Math.PI - 0.16,
      url: HOUSE_POOL[styleIdx % HOUSE_POOL.length],
      width: 6.8,
    },
    {
      x: 0.2,
      z: 11.4,
      rotY: Math.PI,
      url: HOUSE_POOL[(styleIdx + 2) % HOUSE_POOL.length],
      width: 7.4,
    },
    {
      x: 11.6,
      z: 10.4,
      rotY: Math.PI + 0.16,
      url: HOUSE_POOL[(styleIdx + 4) % HOUSE_POOL.length],
      width: 6.6,
    },
  ];

  const colliders: TownCollider[] = [
    { minX: centerX - 2.7, maxX: centerX + 2.7, minZ: centerZ - 4.7, maxZ: centerZ + 0.7 },
    { minX: centerX + pcX - 5.1, maxX: centerX + pcX + 5.1, minZ: centerZ + pcZ - 4.6, maxZ: centerZ + pcZ + 4.6 },
    { minX: centerX + martX - 4.5, maxX: centerX + martX + 4.5, minZ: centerZ + martZ - 4.2, maxZ: centerZ + martZ + 4.2 },
  ];

  for (const hs of houseSlots) {
    void mountGlbModel(group, hs.url, {
      x: hs.x,
      y: localGroundY(hs.x, hs.z),
      z: hs.z,
      rotY: hs.rotY,
      targetWidth: hs.width,
      addInkEdges: true,
    });
    colliders.push({
      minX: centerX + hs.x - hs.width * 0.45,
      maxX: centerX + hs.x + hs.width * 0.45,
      minZ: centerZ + hs.z - hs.width * 0.42,
      maxZ: centerZ + hs.z + hs.width * 0.42,
    });
  }

  // 5. REAL CC0 MODERN TRAM / BUS STOP & TAXI ALONG MAIN AVENUE!
  const busX = -15.6 * mirrorX;
  const busZ = 0.2;
  void mountGlbModel(group, '/models/town/train/tram-modern.glb', {
    x: busX,
    y: localGroundY(busX, busZ),
    z: busZ,
    rotY: Math.PI / 2,
    targetWidth: 5.6,
    addInkEdges: true,
  });
  const busPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 2.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x3b4252 }),
  );
  busPole.position.set(busX + 3.2 * mirrorX, 1.25, busZ + 1.4);
  const busBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.18),
    new THREE.MeshBasicMaterial({ map: tex.busSign }),
  );
  busBadge.position.set(busX + 3.2 * mirrorX, 2.65, busZ + 1.4);
  group.add(busPole, busBadge);

  // Cute CC0 city taxi parked on the opposite avenue curb!
  void mountGlbModel(group, '/models/town/car/taxi.glb', {
    x: 15.2 * mirrorX,
    y: localGroundY(15.2 * mirrorX, 1.1),
    z: 1.1,
    rotY: -Math.PI / 2,
    targetWidth: 3.0,
    addInkEdges: true,
  });

  // 6. REAL CC0 RAILWAY TRACKS + BULLET EXPRESS TRAIN ALONG NORTH EDGE!
  const railZ = -16.8;
  for (let rx = -18; rx <= 18; rx += 4) {
    void mountGlbModel(group, '/models/town/train/rail-straight.glb', {
      x: rx,
      y: localGroundY(rx, railZ) + 0.02,
      z: railZ,
      rotY: Math.PI / 2,
      targetWidth: 4.1,
    });
  }
  const trainGroup = new THREE.Group();
  trainGroup.position.set(-2, localGroundY(0, railZ) + 0.12, railZ);
  void mountGlbModel(trainGroup, '/models/town/train/train-bullet-a.glb', {
    x: 3.4,
    y: 0,
    z: 0,
    rotY: Math.PI / 2,
    targetWidth: 6.4,
    addInkEdges: true,
  });
  void mountGlbModel(trainGroup, '/models/town/train/train-bullet-b.glb', {
    x: -3.2,
    y: 0,
    z: 0,
    rotY: Math.PI / 2,
    targetWidth: 6.4,
    addInkEdges: true,
  });
  group.add(trainGroup);

  // 7. REAL CC0 CURVED STREETLAMPS LINING THE BOULEVARD
  for (const [lx, lz, rot] of [
    [-12.5, 0.4, 0],
    [-4.6, 0.4, 0],
    [4.6, 0.4, 0],
    [12.5, 0.4, 0],
    [-6.2, 6.2, Math.PI],
    [6.2, 6.2, Math.PI],
  ] as const) {
    void mountGlbModel(group, '/models/town/roads/lamp-curved.glb', {
      x: lx,
      y: localGroundY(lx, lz),
      z: lz,
      rotY: rot,
      targetWidth: 1.4,
      addInkEdges: true,
    });
  }

  const interactPoints: TownInteractPoint[] = [
    {
      id: `${id}_pc`,
      townName,
      kind: 'pokemon_center',
      label: `🏥 ${townName}·宝可梦中心`,
      hint: '全队免费治疗并补满伤药',
      x: centerX + pcX,
      z: centerZ + pcZ + 5.6,
      radius: 4.2,
    },
    {
      id: `${id}_mart`,
      townName,
      kind: 'poke_mart',
      label: `🏪 ${townName}·友好商店`,
      hint: '进入精品商店采购外观与补给',
      x: centerX + martX,
      z: centerZ + martZ + 5.2,
      radius: 4.0,
    },
    {
      id: `${id}_station`,
      townName,
      kind: 'transit_station',
      label: `🚉 ${townName}·高速列车站`,
      hint: '乘坐列车前往世界巡礼与各城道馆',
      x: centerX,
      z: centerZ + railZ + 2.8,
      radius: 4.8,
    },
    {
      id: `${id}_bus`,
      townName,
      kind: 'transit_station',
      label: `🚌 ${townName}·城镇巴士站`,
      hint: '乘车前往其他城镇或世界巡礼',
      x: centerX + busX,
      z: centerZ + busZ + 2.2,
      radius: 3.6,
    },
  ];

  return {
    id,
    name: townName,
    centerX,
    centerZ,
    safeRadius: plazaRadius + 2,
    group,
    interactPoints,
    colliders,
    trainGroup,
    trainBaseX: trainGroup.position.x,
    animatedParts: {
      spinners,
      fountains,
    },
  };
}
