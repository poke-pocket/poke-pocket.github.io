import * as THREE from 'three';
import { VoxelGrid3D, getSharedIndoorLitVoxelMaterial, getSharedVoxelArchMaterial } from './voxelMesher3D';

/**
 * Pure Discrete MagicaVoxel 3D Prop & Furniture Engine (`纯离散体素室内外家具与商业道具引擎`):
 * - ZERO smooth CAD `BoxGeometry` wireframe slabs, `SphereGeometry`, or `CylinderGeometry`!
 * - Every bed, cashier counter, shop shelf, chair, stool, sofa, table, PC kiosk, healing machine,
 *   potted plant, and Pokéball is sculpted voxel-by-voxel inside `VoxelGrid3D` (`1 voxel = 0.075m–0.09m`)
 *   with stepped bevel corners, 3-tone pixel shading, physical 3D shelf recesses, and MagicaVoxel Crease AO!
 * - Every prop geometry is cached and rendered in **1 single draw call** via `getSharedVoxelArchMaterial()`.
 */

const PROP_GEO_CACHE = new Map<string, THREE.BufferGeometry>();

function buildCachedVoxelMesh(
  key: string,
  nx: number,
  ny: number,
  nz: number,
  voxelSize: number,
  sculpt: (g: VoxelGrid3D) => void,
  indoorLit = true,
): THREE.Mesh {
  let geo = PROP_GEO_CACHE.get(key);
  if (!geo) {
    const grid = new VoxelGrid3D(nx, ny, nz);
    sculpt(grid);
    geo = grid.toGreedyGeometry(voxelSize);
    PROP_GEO_CACHE.set(key, geo);
  }
  const mesh = new THREE.Mesh(geo, indoorLit ? getSharedIndoorLitVoxelMaterial() : getSharedVoxelArchMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Helper: fill a horizontal rounded-corner voxel rectangle (clips the 4 extreme corner voxels for authentic MagicaVoxel bevel!) */
function fillBevelLayer(
  g: VoxelGrid3D,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  rgb: number,
  bevel = 1,
  emit = 0,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      const dz = Math.min(z - z0, z1 - z);
      for (let x = x0; x <= x1; x++) {
        const dx = Math.min(x - x0, x1 - x);
        if (dx + dz < bevel) continue;
        g.set(x, y, z, rgb, emit);
      }
    }
  }
}

/** Helper: fill a discrete 3D voxel ellipsoid (`((x-cx)/rx)^2 + ((y-cy)/ry)^2 + ((z-cz)/rz)^2 <= 1`) */
function fillVoxelEllipsoid(
  g: VoxelGrid3D,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  colorFn: (x: number, y: number, z: number) => { rgb: number; emit?: number } | null,
): void {
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const x1 = Math.min(g.nx - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1));
  const y1 = Math.min(g.ny - 1, Math.ceil(cy + ry + 1));
  const z0 = Math.max(0, Math.floor(cz - rz - 1));
  const z1 = Math.min(g.nz - 1, Math.ceil(cz + rz + 1));
  for (let y = y0; y <= y1; y++) {
    const ny = (y - cy) / Math.max(0.5, ry);
    for (let z = z0; z <= z1; z++) {
      const nz = (z - cz) / Math.max(0.5, rz);
      for (let x = x0; x <= x1; x++) {
        const nx = (x - cx) / Math.max(0.5, rx);
        if (nx * nx + ny * ny + nz * nz <= 1.02) {
          const c = colorFn(x, y, z);
          if (c) g.set(x, y, z, c.rgb, c.emit ?? 0);
        }
      }
    }
  }
}

/**
 * Clean MagicaVoxel block helper (replaces legacy wireframe CAD `BoxGeometry` with crisp AO-shaded voxel blocks)
 */
export function addVoxelBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material | THREE.Material[],
  x: number,
  yBottom: number,
  z: number,
  _withOutline = false,
): THREE.Mesh {
  // Extract base hex color if single MeshLambertMaterial/MeshBasicMaterial so small blocks use true voxel shading
  const singleMat = Array.isArray(mat) ? null : (mat as THREE.MeshLambertMaterial);
  if (singleMat && !singleMat.map && singleMat.color && w <= 6 && h <= 6 && d <= 6) {
    const vs = Math.max(0.08, Math.min(0.18, Math.min(w, Math.max(0.12, h), d) * 0.5));
    const nx = Math.max(1, Math.round(w / vs));
    const ny = Math.max(1, Math.round(h / vs));
    const nz = Math.max(1, Math.round(d / vs));
    const hex = singleMat.color.getHex();
    const key = `vbox_${nx}_${ny}_${nz}_${vs.toFixed(3)}_${hex}`;
    let geo = PROP_GEO_CACHE.get(key);
    if (!geo) {
      const grid = new VoxelGrid3D(nx, ny, nz);
      grid.fillBox(0, 0, 0, nx - 1, ny - 1, nz - 1, hex);
      geo = grid.toGreedyGeometry(w / nx, h / ny, d / nz);
      PROP_GEO_CACHE.set(key, geo);
    }
    const mesh = new THREE.Mesh(geo, getSharedVoxelArchMaterial());
    mesh.position.set(x, yBottom, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, yBottom + h * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * 1. Authentic 3D Stepped Voxel Pokéball (`13×13×13` integer sphere — real MagicaVoxel staircase curves!)
 */
export function createVoxelPokeball3D(size = 0.65): THREE.Group {
  const g = new THREE.Group();
  const N = 13;
  const vs = size / N;
  const mesh = buildCachedVoxelMesh(`pokeball_vox_${size.toFixed(3)}`, N, N, N, vs, (v) => {
    const c = (N - 1) * 0.5;
    const r = N * 0.48;
    fillVoxelEllipsoid(v, c, c, c, r, r, r, (_x, y, _z) => {
      if (y === Math.round(c)) return { rgb: 0x1e2230 }; // Black belt equator
      if (y > c) return { rgb: y >= N - 3 ? 0xff6b6b : 0xe03131 }; // Top red dome + crown highlight
      return { rgb: y <= 2 ? 0xdce3ee : 0xf8f9fa }; // Bottom white dome + base shade
    });
    // Protruding 3D pixel clasp button on +Z front!
    v.fillBox(5, 5, N - 2, 7, 7, N - 1, 0x1e2230);
    v.set(6, 6, N - 1, 0xffffff, 0xfff9db);
  });
  g.add(mesh);
  return g;
}

/**
 * 2. RSE Pokémon Center U-Shaped Waist-High Voxel Counter (`1.04u` tall = Nurse Joy 65%+ visible!)
 *    Built on an integer `0.08m` MagicaVoxel grid with stepped moldings, recessed front bays & 3D Voxel Pokéballs!
 */
export function createVoxelRseReceptionCounter(spanW = 11.2, wingD = 3.6): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(40, Math.round(spanW / vs));
  const ny = 13; // 13 * 0.08 = 1.04u waist height!
  const nz = Math.max(24, Math.round(wingD / vs));
  const deckVoxD = 16; // 1.28u bar depth

  const counterMesh = buildCachedVoxelMesh(`rse_ucounter_${nx}_${nz}`, nx, ny, nz, vs, (v) => {
    const frontZ0 = nz - deckVoxD;
    const frontZ1 = nz - 1;
    // Kickplate (y=0..1), Slate-blue body (y=2..10), Stepped cream top overhang (y=11..12)
    v.fillBox(2, 0, frontZ0 + 1, nx - 3, 1, frontZ1 - 1, 0x2b3348);
    fillBevelLayer(v, 1, nx - 2, 2, 10, frontZ0, frontZ1, 0x64769c, 2);
    // Carve 3 recessed front decorative pixel panels on +Z face!
    const bayCount = 3;
    const baySpan = Math.floor((nx - 14) / bayCount);
    for (let b = 0; b < bayCount; b++) {
      const bx0 = 7 + b * baySpan;
      const bx1 = bx0 + baySpan - 4;
      v.fillBox(bx0, 4, frontZ1, bx1, 8, frontZ1, 0xdce5f7);
      v.fillBox(bx0 + 1, 5, frontZ1, bx1 - 1, 7, frontZ1, 0x4c5c80);
    }
    // Left & right U-wings extending toward -Z
    for (const isRight of [false, true]) {
      const wx0 = isRight ? nx - 1 - deckVoxD : 1;
      const wx1 = isRight ? nx - 2 : deckVoxD;
      v.fillBox(wx0 + 1, 0, 1, wx1 - 1, 1, frontZ0, 0x2b3348);
      v.fillBox(wx0, 2, 0, wx1, 10, frontZ0 + 2, 0x64769c);
      fillBevelLayer(v, Math.max(0, wx0 - 1), Math.min(nx - 1, wx1 + 1), 11, 12, 0, frontZ0 + 3, 0xf3eed2, 1);
    }
    // Overhanging beveled cream countertop across front bar
    fillBevelLayer(v, 0, nx - 1, 11, 12, frontZ0 - 1, frontZ1, 0xf3eed2, 2);
    // Top rim highlight & central white PokéCenter service mat + Nurse Joy's mini keyboard
    const midX = Math.floor(nx * 0.5);
    v.fillBox(midX - 15, 12, frontZ0 + 3, midX + 15, 12, frontZ1 - 3, 0xffffff);
    v.fillBox(midX - 13, 12, frontZ0 + 5, midX + 13, 12, frontZ1 - 5, 0xff8787);
    v.fillBox(midX - 6, 12, frontZ0 + 1, midX + 6, 12, frontZ0 + 3, 0x3b4254);
  });
  // Shift Z so front bar aligns cleanly with caller's `(x=0, z=0)` anchor!
  const totalD = nz * vs;
  const deckD = deckVoxD * vs;
  counterMesh.position.set(0, 0, -(totalD * 0.5 - deckD * 0.5));
  g.add(counterMesh);

  // Twin 3D Voxel Sphere Pokéballs on the front corners!
  for (const s of [-1, 1]) {
    const orb = createVoxelPokeball3D(0.74);
    orb.position.set(s * (spanW * 0.5 - deckD * 0.5), ny * vs, 0);
    g.add(orb);
  }
  return g;
}

/**
 * 3. RSE 6-Pokéball Voxel Healing Machine (`36×20×24` voxels @ `0.08m`)
 */
export function createVoxelHealingMachine(): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const mesh = buildCachedVoxelMesh('rse_heal_machine_v2', 36, 20, 24, vs, (v) => {
    // Base cabinet with beveled corners
    fillBevelLayer(v, 2, 33, 0, 11, 2, 21, 0xe9eef7, 2);
    v.fillBox(3, 0, 3, 32, 1, 20, 0x8d99ae);
    // Stepped slate-blue side fenders
    v.fillBox(0, 0, 2, 5, 14, 21, 0x64769c);
    v.fillBox(30, 0, 2, 35, 14, 21, 0x64769c);
    v.fillBox(1, 14, 4, 4, 15, 19, 0x8899bd);
    v.fillBox(31, 14, 4, 34, 15, 19, 0x8899bd);
    // Voxel Red Medical Cross inlaid on front skirt (+Z = 21)
    v.fillBox(16, 3, 21, 19, 9, 21, 0xf06543);
    v.fillBox(14, 5, 21, 21, 7, 21, 0xf06543);
    // Dark recessed 6-Pokéball cradle tray
    v.fillBox(7, 11, 5, 28, 12, 19, 0x22283a);
    // Rear diagnostic arch + glowing emerald-cyan heart monitor!
    fillBevelLayer(v, 5, 30, 12, 19, 1, 6, 0x64769c, 1);
    v.fillBox(8, 14, 6, 27, 17, 6, 0x1b2838);
    v.fillBox(9, 15, 6, 26, 16, 6, 0x63e6be, 0x38d9a9);
  });
  g.add(mesh);

  for (let col = -1; col <= 1; col += 2) {
    for (let row = -1; row <= 1; row++) {
      const pb = createVoxelPokeball3D(0.34);
      pb.position.set(col * 0.44, 12 * vs, 0.04 + row * 0.36);
      g.add(pb);
    }
  }
  return g;
}

/**
 * 4. GBA Voxel Storage PC Terminal (`18×25×18` voxels @ `0.08m`)
 */
export function createVoxelRsePcKiosk(): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  g.add(
    buildCachedVoxelMesh('rse_pc_kiosk_v2', 18, 25, 18, vs, (v) => {
      // Base CPU tower
      fillBevelLayer(v, 2, 15, 0, 12, 2, 14, 0x9aa5be, 1);
      v.fillBox(4, 4, 14, 13, 5, 14, 0x2b3245); // Floppy slot
      v.fillBox(4, 8, 14, 13, 9, 14, 0x2b3245);
      // Protruding stepped keyboard shelf with individual voxel keycaps!
      fillBevelLayer(v, 1, 16, 12, 13, 2, 17, 0xbcc6de, 1);
      for (let kx = 3; kx <= 14; kx += 2) {
        v.set(kx, 14, 14, 0xf8f9fa);
        v.set(kx, 14, 16, 0xe9ecef);
      }
      // Stepped CRT monitor shell + glowing cyan-blue screen + green power LED
      fillBevelLayer(v, 2, 15, 14, 24, 1, 12, 0x9aa5be, 1);
      v.fillBox(3, 15, 3, 14, 23, 13, 0xbcc6de);
      v.fillBox(4, 16, 13, 13, 22, 13, 0x3bc9db, 0x22b8cf);
      v.fillBox(5, 20, 13, 10, 21, 13, 0xa5f3fc, 0x99e9f2);
      v.set(13, 15, 13, 0x51cf66, 0x51cf66);
    }),
  );
  return g;
}

/**
 * 5. Wall Voxel Monitor & 3D Relief Voxel Region Map
 */
export function createVoxelWallMonitor(w = 2.8, h = 1.55): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(12, Math.round(w / vs));
  const ny = Math.max(10, Math.round(h / vs));
  g.add(
    buildCachedVoxelMesh(`wall_mon_${nx}_${ny}`, nx, ny, 4, vs, (v) => {
      fillBevelLayer(v, 0, nx - 1, 0, ny - 1, 0, 2, 0x9ea8bd, 1);
      v.fillBox(2, 2, 2, nx - 3, ny - 3, 3, 0x22b8cf, 0x15aabf);
      v.fillBox(4, ny - 6, 3, Math.min(nx - 5, 14), ny - 5, 3, 0xe3fafc, 0x99e9f2);
      v.set(nx - 3, 1, 3, 0x51cf66, 0x51cf66);
    }),
  );
  return g;
}

export function createVoxelRegionMapPoster(w = 2.5, h = 1.65): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(16, Math.round(w / vs));
  const ny = Math.max(12, Math.round(h / vs));
  g.add(
    buildCachedVoxelMesh(`map_poster_${nx}_${ny}`, nx, ny, 3, vs, (v) => {
      v.fillBox(0, 0, 0, nx - 1, ny - 1, 1, 0x8d5b3c); // Wooden voxel picture frame
      v.fillBox(2, 2, 1, nx - 3, ny - 3, 2, 0x4dabf7); // Ocean
      // Raised 3D green voxel islands & red/gold route towns!
      v.fillBox(5, 5, 2, Math.floor(nx * 0.55), ny - 5, 2, 0x51cf66);
      v.fillBox(Math.floor(nx * 0.52), 4, 2, nx - 6, Math.floor(ny * 0.65), 2, 0x69db7c);
      v.fillBox(8, Math.floor(ny * 0.5), 2, nx - 8, Math.floor(ny * 0.5), 2, 0xffd43b);
      v.fillBox(10, Math.floor(ny * 0.5) - 1, 2, 11, Math.floor(ny * 0.5) + 1, 2, 0xfa5252);
      v.fillBox(nx - 10, 7, 2, nx - 9, 8, 2, 0xfa5252);
    }),
  );
  return g;
}

/**
 * 6. True 3D Recessed Voxel Bookshelf (`spanW` wide — individual 3D colorful voxel books standing inside!)
 */
export function createVoxelBookshelf(spanW = 3.2): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(24, Math.round(spanW / vs));
  const ny = 24; // 1.92u tall
  const nz = 13;
  const bookPalette = [0x51cf66, 0xff6b6b, 0x339af0, 0xfcc419, 0xcc5de8, 0xff922b, 0x20c997, 0x748ffc];
  g.add(
    buildCachedVoxelMesh(`vox_bookshelf_${nx}`, nx, ny, nz, vs, (v) => {
      // Outer wooden/cream bookcase frame with recessed hollow front (`z = 0..12`, cavity `z = 3..12`)
      v.fillBox(0, 0, 0, nx - 1, ny - 1, nz - 1, 0xcfd6e6);
      v.fillBox(1, ny - 2, 0, nx - 2, ny - 1, nz - 1, 0xeef2fa); // Top crown
      // Carve 3 recessed shelf bays & populate 3D individual voxel books!
      const shelfYs = [2, 9, 16];
      for (let tier = 0; tier < shelfYs.length; tier++) {
        const y0 = shelfYs[tier];
        const y1 = y0 + 5;
        v.carveBox(2, y0, 3, nx - 3, y1, nz - 1);
        v.fillBox(2, y0, 2, nx - 3, y1, 2, 0x3b4254); // Dark backplane for rich AO!
        let bx = 3;
        let idx = tier * 5;
        while (bx < nx - 4) {
          const bw = 1 + (idx % 2);
          const bh = 4 + (idx % 2);
          const depthFront = nz - 2 - (idx % 2);
          const col = bookPalette[idx % bookPalette.length];
          v.fillBox(bx, y0, 3, Math.min(nx - 4, bx + bw - 1), y0 + bh, depthFront, col);
          // Tiny white pixel label on book spine
          v.set(bx, y0 + 2, depthFront, 0xf8f9fa);
          bx += bw + ((idx % 4 === 3) ? 1 : 0);
          idx++;
        }
      }
    }),
  );
  return g;
}

/**
 * 7. Lush Stepped MagicaVoxel Potted Plant (`19×23×19` voxels @ `0.08m`)
 */
export function createVoxelPottedPlant(): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  g.add(
    buildCachedVoxelMesh('vox_potted_plant_v2', 19, 23, 19, vs, (v) => {
      const c = 9;
      // Stepped octagonal planter pot (`y = 0..8`)
      fillVoxelEllipsoid(v, c, 4, c, 5.2, 5.5, 5.2, (_x, y) => (y <= 7 ? { rgb: y >= 6 ? 0xd97706 : 0xb45309 } : null));
      fillBevelLayer(v, 4, 14, 7, 8, 4, 14, 0xd97706, 2); // Terracotta pot rim
      fillBevelLayer(v, 5, 13, 8, 8, 5, 13, 0x4a3525, 2); // Dark soil
      // Woody voxel stem
      v.fillBox(8, 8, 8, 10, 14, 10, 0x6f4528);
      // 4 organic stepped MagicaVoxel leaf clusters with 3-shade emerald lighting!
      const leafColor = (_x: number, y: number) => ({
        rgb: y >= 19 ? 0x8ce99a : y >= 15 ? 0x51cf66 : 0x2f9e44,
      });
      fillVoxelEllipsoid(v, c, 16, c, 6.2, 4.8, 6.2, leafColor);
      fillVoxelEllipsoid(v, c - 3, 14, c + 2, 4.2, 3.2, 4.2, leafColor);
      fillVoxelEllipsoid(v, c + 3, 15, c - 2, 4.2, 3.4, 4.2, leafColor);
      fillVoxelEllipsoid(v, c, 20, c, 3.6, 2.4, 3.6, leafColor);
    }),
  );
  return g;
}

/**
 * 8. Stepped Round Voxel Cushioned Stool (`15×8×15` voxels @ `0.08m` = `0.64u` knee height!)
 */
export function createVoxelCushionStool(kind: 'coral' | 'yellow' | 'blue' | 'mint' = 'coral'): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const pal = {
    coral: [0xd9653b, 0xf08c65, 0xffb599],
    yellow: [0xd9b32b, 0xf5d04c, 0xffe885],
    blue: [0x3b7dd9, 0x5ea2f5, 0x99c9ff],
    mint: [0x2ea37e, 0x4fd1a8, 0x8ce9c9],
  }[kind];
  g.add(
    buildCachedVoxelMesh(`vox_stool_${kind}`, 15, 8, 15, vs, (v) => {
      // 4 sturdy voxel legs + cross-brace
      for (const lx of [3, 10]) {
        for (const lz of [3, 10]) {
          v.fillBox(lx, 0, lz, lx + 1, 3, lz + 1, 0x3b4254);
        }
      }
      v.fillBox(4, 2, 6, 10, 2, 8, 0x4c566a);
      v.fillBox(6, 2, 4, 8, 2, 10, 0x4c566a);
      // Stepped circular voxel cushion (`y = 3..7`)
      fillVoxelEllipsoid(v, 7, 5, 7, 6.6, 2.7, 6.6, (_x, y) => {
        if (y < 3) return null;
        return { rgb: y >= 7 ? pal[2] : y >= 5 ? pal[1] : pal[0] };
      });
    }),
  );
  return g;
}

/**
 * 9. Stepped Voxel Teal Glass Coffee Table (`0.80u` tall)
 */
export function createVoxelTealGlassTable(w = 3.0, d = 2.3): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(20, Math.round(w / vs));
  const nz = Math.max(16, Math.round(d / vs));
  g.add(
    buildCachedVoxelMesh(`vox_teal_tbl_${nx}_${nz}`, nx, 10, nz, vs, (v) => {
      // 4 voxel legs (`3x3` cubes)
      for (const lx of [2, nx - 5]) {
        for (const lz of [2, nz - 5]) {
          v.fillBox(lx, 0, lz, lx + 2, 7, lz + 2, 0x4c566a);
        }
      }
      // Lower stretcher shelf
      fillBevelLayer(v, 4, nx - 5, 3, 3, 4, nz - 5, 0x64748b, 1);
      // Beveled silver-teal rim + inlaid diagonal pixel-shine glass top!
      fillBevelLayer(v, 0, nx - 1, 8, 9, 0, nz - 1, 0xcbd5e1, 2);
      fillBevelLayer(v, 2, nx - 3, 9, 9, 2, nz - 3, 0x4ea8a2, 1);
      for (let x = 4; x < nx - 4; x++) {
        for (let z = 4; z < nz - 4; z++) {
          const diag = (x + z) % 11;
          if (diag === 0 || diag === 1) v.set(x, 9, z, 0xdcfcf7);
          else if (diag === 5) v.set(x, 9, z, 0x74cfc8);
        }
      }
    }),
  );
  return g;
}

/**
 * 10. Poké Mart 3D Stocked Voxel Gondola Shelf & Voxel Cashier Checkout Counter (`收银柜台`!)
 */
export function createVoxelMartGondola(spanW = 4.8, variant = 0): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(30, Math.round(spanW / vs));
  const ny = 24; // 1.92u
  const nz = 18; // 1.44u double-sided supermarket aisle shelf!
  const capHex = [0x228be6, 0x40c057, 0xf76707][variant % 3];
  const itemPal =
    variant % 3 === 0
      ? [0xfa5252, 0xf8f9fa, 0x339af0, 0xfcc419]
      : variant % 3 === 1
        ? [0xae3ec9, 0xfcc419, 0x51cf66, 0xff922b]
        : [0xff6b6b, 0x69db7c, 0xffd43b, 0x4dabf7];

  g.add(
    buildCachedVoxelMesh(`vox_gondola_${nx}_${variant % 3}`, nx, ny, nz, vs, (v) => {
      // Central spine wall + end-cap uprights + 3 stepped horizontal shelf ledges on BOTH sides!
      v.fillBox(1, 0, 7, nx - 2, ny - 2, 10, 0xdbe4f0);
      v.fillBox(0, 0, 1, 1, ny - 2, nz - 2, 0xe9eef7);
      v.fillBox(nx - 2, 0, 1, nx - 1, ny - 2, nz - 2, 0xe9eef7);
      fillBevelLayer(v, 0, nx - 1, ny - 2, ny - 1, 1, nz - 2, capHex, 1);

      for (const shelfY of [1, 8, 15]) {
        v.fillBox(1, shelfY, 1, nx - 2, shelfY + 1, nz - 2, 0xf1f5f9);
        // Populate 3D discrete voxel merchandise boxes/bottles on both -Z and +Z aisles!
        for (let bx = 3; bx < nx - 4; bx += 4) {
          const c1 = itemPal[(bx + shelfY) % itemPal.length];
          const c2 = itemPal[(bx + shelfY + 2) % itemPal.length];
          const hItem = 3 + ((bx + shelfY) % 2);
          // Front side (+Z)
          v.fillBox(bx, shelfY + 2, 12, bx + 2, shelfY + 1 + hItem, 15, c1);
          v.set(bx + 1, shelfY + 3, 15, 0xffffff);
          // Back side (-Z)
          v.fillBox(bx, shelfY + 2, 2, bx + 2, shelfY + 1 + hItem, 5, c2);
          v.set(bx + 1, shelfY + 3, 2, 0xffffff);
        }
      }
    }),
  );
  return g;
}

export function createVoxelMartCheckoutCounter(): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  // 46 x 20 x 19 voxels (`3.68u` wide, counter deck at `y = 12 * 0.08 = 0.96u` + register up to `1.52u`)
  g.add(
    buildCachedVoxelMesh('vox_mart_checkout_v2', 46, 20, 19, vs, (v) => {
      // Kickplate + vibrant blue beveled shop cabinet + recessed front pixel stripes
      v.fillBox(2, 0, 2, 43, 1, 16, 0x1e293b);
      fillBevelLayer(v, 1, 44, 2, 10, 1, 17, 0x228be6, 2);
      v.fillBox(4, 5, 17, 41, 7, 17, 0x74c0fc);
      v.fillBox(4, 6, 17, 41, 6, 17, 0xf8f9fa);
      // Overhanging white beveled countertop (`y = 11..12`)
      fillBevelLayer(v, 0, 45, 11, 12, 0, 18, 0xf1f5f9, 2);
      // Black pixel conveyor belt on left (`x = 4..24`) + yellow divider bar
      v.fillBox(4, 13, 4, 24, 13, 14, 0x2b3040);
      v.fillBox(14, 13, 4, 14, 13, 14, 0xfcc419);
      // Blue voxel shopping basket on the counter (`x = 5..11`)
      v.fillBox(5, 14, 6, 11, 16, 12, 0x339af0);
      v.carveBox(6, 15, 7, 10, 16, 11);
      // 3D Voxel Cash Register (`x = 29..39`) with angled pixel keypad, receipt roll & glowing green price display!
      fillBevelLayer(v, 29, 39, 13, 16, 4, 14, 0xe2e8f0, 1);
      for (let kx = 31; kx <= 37; kx += 2) {
        v.set(kx, 17, 11, 0x475569);
        v.set(kx, 17, 13, 0xfa5252);
      }
      v.fillBox(31, 17, 5, 37, 19, 7, 0x334155);
      v.fillBox(32, 18, 7, 36, 18, 7, 0x69db7c, 0x51cf66);
      v.fillBox(38, 17, 8, 39, 18, 10, 0xffffff); // White paper receipt roll!
    }),
  );
  return g;
}

export function createVoxelGlassFreezer(spanW = 3.4): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(24, Math.round(spanW / vs));
  const ny = 27; // 2.16u
  const nz = 15;
  const drinkCols = [0xfa5252, 0xfcc419, 0x51cf66, 0x339af0, 0xff922b];
  g.add(
    buildCachedVoxelMesh(`vox_freezer_${nx}`, nx, ny, nz, vs, (v) => {
      fillBevelLayer(v, 0, nx - 1, 0, ny - 1, 0, nz - 1, 0xdbe4f0, 1);
      v.fillBox(2, ny - 3, 2, nx - 3, ny - 2, nz - 1, 0x339af0, 0x1c7ed6); // Illuminated freezer header
      // Carve interior chilled showcase & place 3D voxel beverage cans!
      v.carveBox(2, 3, 3, nx - 3, ny - 5, nz - 1);
      v.fillBox(2, 3, 3, nx - 3, ny - 5, 3, 0xa5d8ff, 0x3bc9db); // Glowing ice-blue backwall
      for (const sy of [3, 10, 17]) {
        v.fillBox(2, sy, 4, nx - 3, sy, nz - 3, 0xe2e8f0);
        for (let cx = 4; cx < nx - 4; cx += 3) {
          v.fillBox(cx, sy + 1, 7, cx + 1, sy + 4, 9, drinkCols[(cx + sy) % drinkCols.length]);
          v.set(cx, sy + 4, 8, 0xf8f9fa);
        }
      }
      // Center door mullion + chrome handles
      const midX = Math.floor(nx * 0.5);
      v.fillBox(midX, 3, nz - 2, midX, ny - 5, nz - 1, 0x94a3b8);
      v.fillBox(midX - 2, 11, nz - 1, midX - 2, 15, nz - 1, 0xf8f9fa);
      v.fillBox(midX + 2, 11, nz - 1, midX + 2, 15, nz - 1, 0xf8f9fa);
    }),
  );
  return g;
}

/**
 * 11. Restaurant Voxel Dining Table, Stepped Chairs, 3D Voxel Ramen Bowls & Kitchen Stoves
 */
export function createVoxelDiningSet(dishVariant = 0): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  // Unified 60 x 16 x 28 voxel diorama (`4.8u x 1.28u x 2.24u`): Table + Checkered Runner + 2 Voxel Ramen Bowls + 2 Voxel Chairs!
  g.add(
    buildCachedVoxelMesh(`vox_dining_set_${dishVariant % 2}`, 60, 16, 28, vs, (v) => {
      // Table legs (`x = 14..45, z = 3..24`)
      for (const lx of [15, 42]) {
        for (const lz of [4, 21]) {
          v.fillBox(lx, 0, lz, lx + 2, 9, lz + 2, 0x6c462f);
        }
      }
      // Beveled oak tabletop + cream tablecloth + red pixel runner border (`y = 10..11`)
      fillBevelLayer(v, 12, 47, 10, 11, 2, 25, 0xfdf8f2, 2);
      v.fillBox(14, 11, 4, 45, 11, 5, 0xfa5252);
      v.fillBox(14, 11, 22, 45, 11, 23, 0xfa5252);

      // Two 3D Stepped Voxel Ramen / Berry Dishes on tabletop (`y = 12..14`)
      const bowlHex = dishVariant % 2 === 0 ? 0xe03131 : 0x1098ad;
      for (const bx of [22, 37]) {
        fillVoxelEllipsoid(v, bx, 13, 13.5, 3.2, 1.8, 3.2, (_x, y) =>
          y === 14 ? { rgb: 0xffd43b } : { rgb: bowlHex },
        );
        v.set(bx, 14, 13, 0xffffff); // Voxel naruto / egg topping!
        v.fillBox(bx - 2, 12, 18, bx + 2, 12, 18, 0x8d5b3c); // Wooden voxel chopsticks!
      }

      // Left (`x = 1..10`) & Right (`x = 49..58`) Ergonomic Voxel Chairs (`seat = 0.56u`, `back = 1.20u`)
      for (const isRight of [false, true]) {
        const cx0 = isRight ? 49 : 1;
        const cx1 = cx0 + 9;
        for (const lx of [cx0 + 1, cx1 - 2]) {
          for (const lz of [9, 17]) {
            v.fillBox(lx, 0, lz, lx + 1, 5, lz + 1, 0x6c462f);
          }
        }
        fillBevelLayer(v, cx0, cx1, 6, 6, 8, 19, 0x8d5b3c, 1);
        fillBevelLayer(v, cx0 + 1, cx1 - 1, 7, 7, 9, 18, 0xf76707, 1); // Warm orange seat cushion
        const backX = isRight ? cx1 - 1 : cx0;
        v.fillBox(backX, 7, 9, backX + (isRight ? 1 : 1), 14, 10, 0x8d5b3c);
        v.fillBox(backX, 7, 17, backX + 1, 14, 18, 0x8d5b3c);
        v.fillBox(backX, 11, 9, backX + 1, 14, 18, 0xa47148);
      }
    }),
  );
  return g;
}

export function createVoxelKitchenRangeUnit(): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  g.add(
    buildCachedVoxelMesh('vox_kitchen_range_v2', 30, 38, 19, vs, (v) => {
      // Stainless stove cabinet (`y = 0..12` = 1.04u) + dark oven window + red knobs
      fillBevelLayer(v, 0, 29, 0, 12, 1, 17, 0xced4da, 1);
      v.fillBox(4, 2, 17, 25, 8, 17, 0x2b3040);
      for (let kx = 5; kx <= 24; kx += 4) v.set(kx, 10, 17, 0xfa5252);
      // Glowing voxel gas burners + 3D stepped copper stew pot!
      fillBevelLayer(v, 4, 11, 13, 13, 6, 13, 0xff6b35, 2, 0xff6b35);
      fillBevelLayer(v, 18, 25, 13, 13, 6, 13, 0xff6b35, 2, 0xff6b35);
      fillVoxelEllipsoid(v, 7.5, 16, 9.5, 4.2, 3.0, 4.2, (_x, y) =>
        y >= 18 ? { rgb: 0xffe066 } : { rgb: 0xd9480f },
      );
      // Stepped pyramid range hood (`y = 29..37`)
      fillBevelLayer(v, 0, 29, 29, 31, 0, 18, 0xdee2e6, 1);
      fillBevelLayer(v, 4, 25, 32, 33, 2, 14, 0xcbd5e1, 1);
      v.fillBox(10, 34, 3, 19, 37, 10, 0xadb5bd);
    }),
  );
  return g;
}

/**
 * 12. True MagicaVoxel Double Bed (`床` — `48×17×56` voxels @ `0.08m`!)
 *     Carved wooden corner posts, slatted headboard, stepped white mattress, overhanging pixel-folded quilt & puffy pillows!
 */
export function createVoxelDoubleBed(blanketColor: 'berry' | 'azure' | 'mint' = 'azure'): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const pal = {
    berry: [0xc2255c, 0xe64980, 0xff8787],
    azure: [0x1971c2, 0x339af0, 0x74c0fc],
    mint: [0x0ca678, 0x20c997, 0x63e6be],
  }[blanketColor];

  g.add(
    buildCachedVoxelMesh(`vox_double_bed_${blanketColor}`, 48, 17, 56, vs, (v) => {
      // 4 chunky 4x4 wooden corner bedposts + side rails (`y = 0..5`)
      v.fillBox(1, 0, 1, 4, 16, 4, 0x6f4528);
      v.fillBox(43, 0, 1, 46, 16, 4, 0x6f4528);
      v.fillBox(1, 0, 51, 4, 7, 54, 0x6f4528);
      v.fillBox(43, 0, 51, 46, 7, 54, 0x6f4528);
      // Slatted carved wooden headboard (`z = 1..3, y = 4..15`)
      v.fillBox(5, 3, 2, 42, 14, 3, 0x8c583a);
      v.fillBox(4, 14, 1, 43, 15, 4, 0xa47148);
      for (let sx = 8; sx <= 39; sx += 5) {
        v.fillBox(sx, 6, 3, sx + 2, 12, 3, 0x6f4528);
      }
      // Wooden bed frame platform (`y = 2..4`)
      v.fillBox(2, 2, 3, 45, 4, 53, 0x8c583a);
      // Stepped white cotton mattress (`y = 5..8`, `0.64u` total bed height!)
      fillBevelLayer(v, 4, 43, 5, 8, 4, 51, 0xf8f9fa, 2);
      // Overhanging cozy voxel quilt (`z = 19..52`) with white folded sheet cuff & pixel stripe pattern!
      fillBevelLayer(v, 3, 44, 5, 9, 19, 52, pal[1], 2);
      fillBevelLayer(v, 3, 44, 9, 9, 19, 23, 0xffffff, 1); // Folded top sheet cuff!
      for (let z = 28; z <= 46; z += 6) {
        v.fillBox(6, 9, z, 41, 9, z + 1, pal[2]);
      }
      // Twin puffy stepped MagicaVoxel pillows (`z = 6..15, y = 9..11`)!
      fillBevelLayer(v, 7, 21, 9, 10, 6, 15, 0xffffff, 2);
      fillBevelLayer(v, 9, 19, 11, 11, 8, 13, 0xf1f5f9, 1);
      fillBevelLayer(v, 26, 40, 9, 10, 6, 15, 0xffffff, 2);
      fillBevelLayer(v, 28, 38, 11, 11, 8, 13, 0xf1f5f9, 1);
    }),
  );
  return g;
}

export function createVoxelNightstandWithLamp(): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  g.add(
    buildCachedVoxelMesh('vox_nightstand_lamp_v2', 15, 19, 14, vs, (v) => {
      // Wooden nightstand with 2 recessed drawers & gold pixel knobs
      fillBevelLayer(v, 1, 13, 0, 9, 1, 12, 0x8c583a, 1);
      v.fillBox(0, 9, 0, 14, 9, 13, 0xa47148);
      v.fillBox(3, 2, 12, 11, 4, 12, 0x6f4528);
      v.fillBox(3, 6, 12, 11, 8, 12, 0x6f4528);
      v.set(7, 3, 12, 0xfcc419);
      v.set(7, 7, 12, 0xfcc419);
      // Voxel bedside lamp with stepped warm-glowing shade (`aNightEmit`)!
      v.fillBox(6, 10, 5, 8, 12, 7, 0xd97706);
      fillBevelLayer(v, 3, 11, 13, 15, 2, 10, 0xffe066, 2, 0xffd43b);
      fillBevelLayer(v, 4, 10, 16, 18, 3, 9, 0xfff3bf, 2, 0xffe066);
    }),
  );
  return g;
}

export function createVoxelLoungeSofa(spanW = 4.4, hex = '#4263eb'): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  const nx = Math.max(28, Math.round(spanW / vs));
  const baseCol = new THREE.Color(hex);
  const mainRgb = baseCol.getHex();
  const hiRgb = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.25).getHex();
  const darkRgb = baseCol.clone().lerp(new THREE.Color(0x101420), 0.28).getHex();

  g.add(
    buildCachedVoxelMesh(`vox_sofa_${nx}_${hex}`, nx, 16, 22, vs, (v) => {
      // Wooden stub feet
      for (const lx of [2, nx - 5]) {
        for (const lz of [2, 17]) v.fillBox(lx, 0, lz, lx + 2, 1, lz + 2, 0x4a3525);
      }
      // Base seat deck (`y = 2..6` = `0.56u` ergonomic seat!)
      fillBevelLayer(v, 1, nx - 2, 2, 5, 1, 20, darkRgb, 2);
      // Individual tufted seat cushions (`y = 6..7`)
      const mid = Math.floor(nx * 0.5);
      fillBevelLayer(v, 5, mid - 1, 6, 7, 5, 19, mainRgb, 1);
      fillBevelLayer(v, mid + 1, nx - 6, 6, 7, 5, 19, mainRgb, 1);
      // Rolled stepped voxel armrests (`y = 6..10`)
      fillBevelLayer(v, 0, 4, 5, 10, 2, 19, hiRgb, 1);
      fillBevelLayer(v, nx - 5, nx - 1, 5, 10, 2, 19, hiRgb, 1);
      // Puffy stepped backrest (`y = 6..15, z = 1..5`)
      fillBevelLayer(v, 2, nx - 3, 6, 14, 1, 5, mainRgb, 2);
      fillBevelLayer(v, 4, nx - 5, 15, 15, 2, 4, hiRgb, 1);
    }),
  );
  return g;
}

export function createVoxelStudyDeskSet(): THREE.Group {
  const g = new THREE.Group();
  const vs = 0.08;
  g.add(
    buildCachedVoxelMesh('vox_study_desk_v2', 38, 22, 26, vs, (v) => {
      // Left legs + right drawer pedestal + beveled oak desktop (`y = 10..11` = `0.92u`)
      v.fillBox(2, 0, 2, 4, 9, 4, 0x7f5539);
      v.fillBox(2, 0, 15, 4, 9, 17, 0x7f5539);
      fillBevelLayer(v, 25, 35, 0, 9, 2, 17, 0x8c583a, 1);
      v.set(30, 4, 17, 0xfcc419);
      v.set(30, 7, 17, 0xfcc419);
      fillBevelLayer(v, 0, 37, 10, 11, 1, 18, 0xb07d56, 2);
      // Voxel Widescreen Monitor + Stand + Pixel Keyboard + Mouse!
      v.fillBox(13, 12, 4, 16, 13, 6, 0x334155);
      fillBevelLayer(v, 7, 22, 14, 21, 4, 5, 0x1e293b, 1);
      v.fillBox(8, 15, 5, 21, 20, 5, 0x339af0, 0x228be6);
      v.fillBox(9, 12, 11, 19, 12, 14, 0xe2e8f0);
      v.fillBox(22, 12, 12, 23, 12, 14, 0xf8f9fa);
      // Matching Voxel Swivel Study Chair tucked in front (`z = 17..25`)
      v.fillBox(13, 0, 20, 15, 4, 22, 0x334155);
      v.fillBox(11, 0, 21, 17, 0, 21, 0x475569);
      v.fillBox(14, 0, 18, 14, 0, 24, 0x475569);
      fillBevelLayer(v, 10, 18, 5, 6, 17, 24, 0x3b82f6, 1);
      fillBevelLayer(v, 10, 18, 7, 13, 23, 25, 0x2563eb, 1);
    }),
  );
  return g;
}
