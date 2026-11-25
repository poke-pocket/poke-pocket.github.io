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

/** Octagonal stone fountain centerpiece for town plazas (life-sized for trainer & squad!) */
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

  // 1. Wide life-sized cobblestone town plaza + generous 2-lane boulevard avenue!
  const plazaMesh = new THREE.Mesh(
    new THREE.CircleGeometry(plazaRadius, 24),
    new THREE.MeshLambertMaterial({ map: tex.cobblePlaza }),
  );
  plazaMesh.rotation.x = -Math.PI / 2;
  plazaMesh.position.set(0, 0.05, 0);
  plazaMesh.receiveShadow = true;
  group.add(plazaMesh);

  const roadH = new THREE.Mesh(
    new THREE.PlaneGeometry(plazaRadius * 2.05, 9.2),
    new THREE.MeshLambertMaterial({ map: tex.roadTile }),
  );
  roadH.rotation.x = -Math.PI / 2;
  roadH.position.set(0, 0.07, 5.2);
  roadH.receiveShadow = true;
  group.add(roadH);

  const cw = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 8.6),
    new THREE.MeshLambertMaterial({ map: tex.crosswalk }),
  );
  cw.rotation.x = -Math.PI / 2;
  cw.position.set(0, 0.08, 5.2);
  group.add(cw);

  // Central Town Fountain Plaza
  const fountain = createPlazaFountain(fountains);
  fountain.position.set(0, 0, -3.5);
  group.add(fountain);

  const localGroundY = (lx: number, lz: number) => getGroundHeight(centerX + lx, centerZ + lz) - baseY;

  // 2. GRAND POKÉMON CENTER (Life-sized towering landmark hall + giant rotating 3D Pokéball beacon!)
  const pcX = -15.5 * mirrorX;
  const pcZ = -12.2;
  const pcWidth = isMajorCity ? 18.0 : 14.8;
  const pcModelUrl = isMajorCity
    ? '/models/town/commercial/shop-k.glb'
    : '/models/town/commercial/center-grand.glb';
  void mountGlbModel(group, pcModelUrl, {
    x: pcX,
    y: localGroundY(pcX, pcZ),
    z: pcZ,
    rotY: mirrorX * 0.14,
    targetWidth: pcWidth,
    addInkEdges: true,
    tintHex: 0xffd6d6,
    onMounted: (wrapper, h) => {
      const beacon = createPokeballBeacon(isMajorCity ? 1.85 : 1.55);
      beacon.position.set(0, h + 1.65, 0);
      wrapper.add(beacon);
      spinners.push(beacon);
    },
  });
  const pcMat = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 16),
    new THREE.MeshBasicMaterial({ color: 0xfa5252 }),
  );
  pcMat.rotation.x = -Math.PI / 2;
  pcMat.position.set(pcX, 0.09, pcZ + 9.4);
  group.add(pcMat);

  // 3. BOUTIQUE POKÉ MART (Full-scale commercial storefront + rooftop MART sign + outdoor café parasol!)
  const martX = 16.0 * mirrorX;
  const martZ = -11.6;
  const martUrl = SHOP_POOL[styleIdx % SHOP_POOL.length];
  const martWidth = isMajorCity ? 15.2 : 13.4;
  void mountGlbModel(group, martUrl, {
    x: martX,
    y: localGroundY(martX, martZ),
    z: martZ,
    rotY: -mirrorX * 0.16,
    targetWidth: martWidth,
    addInkEdges: true,
    onMounted: (wrapper, h) => {
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 1.9, 0.45),
        new THREE.MeshBasicMaterial({ map: tex.martSign }),
      );
      signMesh.position.set(0, h + 1.1, 3.4);
      wrapper.add(signMesh);
    },
  });
  const martCarpet = new THREE.Mesh(
    new THREE.CircleGeometry(3.0, 16),
    new THREE.MeshBasicMaterial({ color: 0x228be6 }),
  );
  martCarpet.rotation.x = -Math.PI / 2;
  martCarpet.position.set(martX, 0.09, martZ + 8.4);
  group.add(martCarpet);

  // Outdoor Café Parasol beside the Mart
  void mountGlbModel(group, '/models/town/commercial/parasol-a.glb', {
    x: martX + 7.2 * mirrorX,
    y: localGroundY(martX + 7.2 * mirrorX, martZ + 6.4),
    z: martZ + 6.4,
    targetWidth: 3.8,
    addInkEdges: true,
  });

  // 4. THREE FULL-SCALE DISTINCT HANDCRAFTED SUBURBAN HOUSES ALONG SOUTH AVENUE (Human-scale doorways!)
  const houseSlots: { x: number; z: number; rotY: number; url: string; width: number }[] = [
    {
      x: -18.5,
      z: 18.2,
      rotY: Math.PI - 0.14,
      url: HOUSE_POOL[styleIdx % HOUSE_POOL.length],
      width: 12.2,
    },
    {
      x: 0.4,
      z: 19.6,
      rotY: Math.PI,
      url: HOUSE_POOL[(styleIdx + 2) % HOUSE_POOL.length],
      width: 13.2,
    },
    {
      x: 18.8,
      z: 18.0,
      rotY: Math.PI + 0.14,
      url: HOUSE_POOL[(styleIdx + 4) % HOUSE_POOL.length],
      width: 11.8,
    },
  ];

  const colliders: TownCollider[] = [
    { minX: centerX - 4.0, maxX: centerX + 4.0, minZ: centerZ - 7.5, maxZ: centerZ + 0.5 },
    { minX: centerX + pcX - pcWidth * 0.46, maxX: centerX + pcX + pcWidth * 0.46, minZ: centerZ + pcZ - pcWidth * 0.42, maxZ: centerZ + pcZ + pcWidth * 0.42 },
    { minX: centerX + martX - martWidth * 0.46, maxX: centerX + martX + martWidth * 0.46, minZ: centerZ + martZ - martWidth * 0.42, maxZ: centerZ + martZ + martWidth * 0.42 },
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
      minX: centerX + hs.x - hs.width * 0.44,
      maxX: centerX + hs.x + hs.width * 0.44,
      minZ: centerZ + hs.z - hs.width * 0.40,
      maxZ: centerZ + hs.z + hs.width * 0.40,
    });
  }

  // 5. FULL-SCALE MODERN TRAM / BUS STOP & TAXI ALONG WIDE AVENUE!
  const busX = -25.5 * mirrorX;
  const busZ = 1.6;
  void mountGlbModel(group, '/models/town/train/tram-modern.glb', {
    x: busX,
    y: localGroundY(busX, busZ),
    z: busZ,
    rotY: Math.PI / 2,
    targetWidth: 9.6,
    addInkEdges: true,
  });
  const busPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 3.8, 6),
    new THREE.MeshLambertMaterial({ color: 0x3b4252 }),
  );
  busPole.position.set(busX + 5.2 * mirrorX, 1.9, busZ + 2.4);
  const busBadge = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 1.35, 0.24),
    new THREE.MeshBasicMaterial({ map: tex.busSign }),
  );
  busBadge.position.set(busX + 5.2 * mirrorX, 4.0, busZ + 2.4);
  group.add(busPole, busBadge);

  // Life-sized city taxi parked along the opposite curb!
  void mountGlbModel(group, '/models/town/car/taxi.glb', {
    x: 24.5 * mirrorX,
    y: localGroundY(24.5 * mirrorX, 2.2),
    z: 2.2,
    rotY: -Math.PI / 2,
    targetWidth: 5.2,
    addInkEdges: true,
  });

  // 6. FULL-SCALE RAILWAY TRACKS + BULLET EXPRESS TRAIN ALONG NORTH EDGE!
  const railZ = -27.5;
  for (let rx = -30; rx <= 30; rx += 6) {
    void mountGlbModel(group, '/models/town/train/rail-straight.glb', {
      x: rx,
      y: localGroundY(rx, railZ) + 0.02,
      z: railZ,
      rotY: Math.PI / 2,
      targetWidth: 6.2,
    });
  }
  const trainGroup = new THREE.Group();
  trainGroup.position.set(-2, localGroundY(0, railZ) + 0.16, railZ);
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

  // 7. FULL-SCALE CURVED STREETLAMPS LINING THE BOULEVARD
  for (const [lx, lz, rot] of [
    [-20.5, 0.2, 0],
    [-7.5, 0.2, 0],
    [7.5, 0.2, 0],
    [20.5, 0.2, 0],
    [-10.5, 10.2, Math.PI],
    [10.5, 10.2, Math.PI],
  ] as const) {
    void mountGlbModel(group, '/models/town/roads/lamp-curved.glb', {
      x: lx,
      y: localGroundY(lx, lz),
      z: lz,
      rotY: rot,
      targetWidth: 2.6,
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
      z: centerZ + pcZ + 9.4,
      radius: 5.2,
    },
    {
      id: `${id}_mart`,
      townName,
      kind: 'poke_mart',
      label: `🏪 ${townName}·友好商店`,
      hint: '进入精品商店采购外观与补给',
      x: centerX + martX,
      z: centerZ + martZ + 8.4,
      radius: 5.0,
    },
    {
      id: `${id}_station`,
      townName,
      kind: 'transit_station',
      label: `🚉 ${townName}·高速列车站`,
      hint: '乘坐列车前往世界巡礼与各城道馆',
      x: centerX,
      z: centerZ + railZ + 4.4,
      radius: 6.2,
    },
    {
      id: `${id}_bus`,
      townName,
      kind: 'transit_station',
      label: `🚌 ${townName}·城镇巴士站`,
      hint: '乘车前往其他城镇或世界巡礼',
      x: centerX + busX,
      z: centerZ + busZ + 3.4,
      radius: 4.8,
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
