import * as THREE from 'three';
import { VoxelGrid3D, getSharedVoxelArchMaterial } from './voxelMesher3D';
import { mountVoxModel } from './voxLoader3D';

/**
 * Outdoor MagicaVoxel Nature & Civic Architecture Module (`户外自然与市政纯体素模块`):
 * - Rocks & Mineable Crystal Ore Boulders (`石头` / `矿岩`)
 * - Monumental Stepped Voxel Octagonal Fountain (`广场体素喷泉`)
 * - Stepped Voxel-Rimmed Park Pond & Road Intersection Plazas (`体素池塘与路口广场`)
 * - Voxel Vending Machines, Wooden Signposts & Street Planters
 */

const NATURE_GEO_CACHE = new Map<string, THREE.BufferGeometry>();

function getCachedGridGeo(
  key: string,
  nx: number,
  ny: number,
  nz: number,
  vs: number,
  sculpt: (g: VoxelGrid3D) => void,
): THREE.BufferGeometry {
  let geo = NATURE_GEO_CACHE.get(key);
  if (!geo) {
    const grid = new VoxelGrid3D(nx, ny, nz);
    sculpt(grid);
    geo = grid.toGreedyGeometry(vs);
    NATURE_GEO_CACHE.set(key, geo);
  }
  return geo;
}

/**
 * 1. Authentic 3D MagicaVoxel Boulder & Crystal Ore Vein (`石头` — replaces flat 2D rock planes!)
 *    Follows real MagicaVoxel rock workflow: clustered asymmetric ellipsoids + corner facet carving +
 *    4-tone top-lit granite/moss shading + scattered base pebbles + glowing crystal voxels on `isOre`!
 */
export function createVoxelBoulder3D(variant = 0, isOre = false, scale = 1.0): THREE.Mesh {
  const vIdx = Math.abs(variant) % 4;
  const key = `vox_boulder_${vIdx}_${isOre ? 'ore' : 'std'}`;
  const geo = getCachedGridGeo(key, 20, 15, 20, 0.12, (g) => {
    const pal =
      vIdx === 1
        ? [0x495057, 0x6c757d, 0x868e96, 0x52b788] // Mossy granite!
        : vIdx === 2
          ? [0x5c5346, 0x7d7160, 0x9c8e7b, 0xb5a792] // Warm sandstone crag!
          : [0x4a525d, 0x687280, 0x8b95a5, 0xaab4c2]; // Classic slate boulder!

    const lobes: [number, number, number, number, number, number][] = [
      [10, 4.5, 10, 6.8, 5.8, 6.4],
      [6.5 + (vIdx % 2) * 2, 3.2, 8.0, 4.8, 4.2, 4.6],
      [13.2, 3.5, 12.2 - (vIdx % 2) * 2, 4.6, 4.5, 4.4],
      [9.5, 8.2, 9.5 + (vIdx % 3) - 1, 4.4, 4.2, 4.2],
    ];

    for (let y = 0; y < 14; y++) {
      for (let z = 1; z < 19; z++) {
        for (let x = 1; x < 19; x++) {
          let dMin = 99;
          for (let li = 0; li < lobes.length; li++) {
            const [cx, cy, cz, rx, ry, rz] = lobes[li];
            const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
            if (d < dMin) dMin = d;
          }
          // Deterministic angular facet carve so rock looks ruggedly blocky, never smooth!
          const facetNoise = (((x * 17 + z * 31 + y * 13 + vIdx * 7) % 11) - 5) * 0.038;
          if (dMin + facetNoise <= 1.0) {
            let rgb = y >= 9 ? pal[3] : y >= 6 ? pal[2] : y >= 3 ? pal[1] : pal[0];
            if (vIdx === 1 && y >= 8 && (x + z) % 3 !== 0) rgb = pal[3]; // Lush pixel moss cap
            g.set(x, y, z, rgb);
          }
        }
      }
    }

    // Scatter tiny 1-2 voxel pebbles around base to anchor the boulder into the terrain
    for (const [px, pz] of [
      [2, 9],
      [17, 7],
      [8, 17],
      [15, 16],
    ]) {
      g.fillBox(px, 0, pz, px + 1, 0, pz + 1, pal[1]);
    }

    // Protruding luminous MagicaVoxel Crystal Shards for mineable `ore_rock` veins!
    if (isOre) {
      const crys = vIdx % 2 === 0 ? 0x3bc9db : 0xfcc419;
      const crysHi = vIdx % 2 === 0 ? 0x99e9f2 : 0xfff3bf;
      g.fillBox(12, 8, 6, 13, 12, 7, crys, crys);
      g.set(12, 13, 6, crysHi, crysHi);
      g.fillBox(6, 7, 12, 7, 11, 13, crys, crys);
      g.set(6, 12, 12, crysHi, crysHi);
      g.fillBox(9, 10, 9, 10, 14, 10, crysHi, crys);
    }
  });

  const mesh = new THREE.Mesh(geo, getSharedVoxelArchMaterial());
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 2. 3D Voxel Wooden Trail Signpost (`路牌` — replaces flat 2D signpost sprite!)
 */
export function createVoxelSignpost3D(scale = 1.0): THREE.Mesh {
  const geo = getCachedGridGeo('vox_signpost_v1', 16, 20, 8, 0.11, (g) => {
    // Stone base pebbles + timber post
    g.fillBox(6, 0, 2, 9, 1, 5, 0x868e96);
    g.fillBox(7, 0, 3, 8, 18, 4, 0x6f4528);
    g.set(7, 19, 3, 0x8c583a);
    // Pointed arrow wooden sign board (`y = 11..16`) with white pixel text lines!
    g.fillBox(2, 11, 4, 12, 16, 5, 0xa47148);
    g.fillBox(13, 12, 4, 13, 15, 5, 0xa47148);
    g.fillBox(14, 13, 4, 14, 14, 5, 0xa47148);
    g.fillBox(4, 14, 5, 10, 14, 5, 0xfff9db);
    g.fillBox(4, 12, 5, 8, 12, 5, 0xffe066);
  });
  const mesh = new THREE.Mesh(geo, getSharedVoxelArchMaterial());
  mesh.scale.setScalar(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 3. Monumental Stepped MagicaVoxel Civic Fountain (`喷泉` — ZERO CylinderGeometry / SphereGeometry / TorusGeometry!)
 *    Combines a `60×34×60` stepped voxel marble basin + turquoise pixel water + animated voxel water-cube jets!
 */
export function createVoxelPlazaFountain3D(fountains: THREE.Object3D[]): THREE.Group {
  const group = new THREE.Group();
  const vs = 0.18;

  const basinGeo = getCachedGridGeo('vox_plaza_fountain_basin_v2', 60, 32, 60, vs, (g) => {
    const c = 29.5;
    for (let z = 0; z < 60; z++) {
      for (let x = 0; x < 60; x++) {
        const dx = Math.abs(x - c);
        const dz = Math.abs(z - c);
        // True MagicaVoxel stepped octagonal metric (`max(dx, dz) + 0.42 * min(dx, dz)`)!
        const octR = Math.max(dx, dz) + 0.42 * Math.min(dx, dz);

        // Outer stepped stone terrace (`octR <= 28.5`)
        if (octR <= 28.5) g.fillBox(x, 0, z, x, 1, z, 0xd0c7b7);
        // Sculpted stone basin coping wall (`23.5 <= octR <= 26.8`)
        if (octR <= 26.8 && octR >= 23.2) {
          g.fillBox(x, 2, z, x, 5, z, 0xeae3d5);
          g.set(x, 6, z, 0xf8f4ec); // Bright seating rim!
        }
        // Lower pool floor & glowing turquoise voxel water (`octR < 23.2`)
        if (octR < 23.3) {
          g.set(x, 1, z, 0x1971c2);
          const isFoam = Math.abs(octR - 22.2) < 0.8 || Math.abs(octR - 10.5) < 0.7 || (x + z) % 13 === 0;
          g.fillBox(x, 2, z, x, 4, z, isFoam ? 0x99e9f2 : 0x22b8cf, isFoam ? 0x66d9e8 : 0x15aabf);
        }
        // Central tiered stone pedestal & mid bowl (`y = 5..28`)
        if (octR <= 7.2) g.fillBox(x, 5, z, x, 13, z, 0xeae3d5);
        if (octR <= 12.6 && octR >= 9.8) {
          g.fillBox(x, 14, z, x, 16, z, 0xd8cfc0);
          g.set(x, 17, z, 0xf8f4ec);
        }
        if (octR < 10.0) {
          g.set(x, 13, z, 0xd8cfc0);
          g.fillBox(x, 14, z, x, 16, z, (x + z) % 5 === 0 ? 0xa5f3fc : 0x3bc9db, 0x22b8cf);
        }
        if (octR <= 4.2) g.fillBox(x, 17, z, x, 24, z, 0xeae3d5);
        if (octR <= 6.8) g.fillBox(x, 25, z, x, 26, z, 0xf8f4ec);
        if (octR <= 2.4) g.fillBox(x, 27, z, x, 30, z, 0xfcc419, 0xf59f00); // Golden voxel finial!
      }
    }
  });

  const basinMesh = new THREE.Mesh(basinGeo, getSharedVoxelArchMaterial());
  basinMesh.castShadow = true;
  basinMesh.receiveShadow = true;
  group.add(basinMesh);

  // Animated Pure-Voxel Water Spray & Cascading Droplet Arcs (built on `VoxelGrid3D` — pulsing via `fountains`!)
  const jetGeo = getCachedGridGeo('vox_plaza_fountain_jets_v2', 36, 26, 36, vs, (g) => {
    const c = 17.5;
    // Upper crown plume (`y = 18..25`)
    for (let y = 18; y <= 25; y++) {
      const spread = Math.max(1, Math.floor((25 - y) * 0.45));
      g.fillBox(Math.round(c) - spread, y, Math.round(c) - spread, Math.round(c) + spread, y, Math.round(c) + spread, 0xe3fafc, 0x99e9f2);
    }
    // 8 stepped voxel parabolic water streams cascading from mid-bowl into main pool!
    for (let dir = 0; dir < 8; dir++) {
      const ang = (dir / 8) * Math.PI * 2;
      for (let step = 0; step < 10; step++) {
        const rad = 6.5 + step * 1.05;
        const vy = Math.round(16 - (step * step) * 0.14);
        if (vy < 4) continue;
        const vx = Math.round(c + Math.cos(ang) * rad);
        const vz = Math.round(c + Math.sin(ang) * rad);
        g.set(vx, vy, vz, step % 2 === 0 ? 0xe3fafc : 0x66d9e8, 0x66d9e8);
      }
    }
  });
  const jetMesh = new THREE.Mesh(jetGeo, getSharedVoxelArchMaterial());
  jetMesh.position.y = 0.55;
  group.add(jetMesh);
  fountains.push(jetMesh);

  return group;
}

/**
 * 4. Stepped MagicaVoxel Park Pond (`体素景观池塘` — replaces smooth CircleGeometry!)
 */
export function createVoxelParkPond3D(diameter = 22): THREE.Mesh {
  const nx = 44;
  const nz = 44;
  const vs = diameter / nx;
  const geo = getCachedGridGeo(`vox_park_pond_${diameter}`, nx, 4, nz, vs, (g) => {
    const c = (nx - 1) * 0.5;
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        // Slightly organic asymmetric pond contour in integer voxels
        const ang = Math.atan2(z - c, x - c);
        const wobble = Math.sin(ang * 3 + 0.7) * 1.6 + Math.cos(ang * 2 - 0.5) * 1.2;
        const r = Math.hypot(x - c, z - c) + wobble;
        if (r <= 19.8 && r >= 17.2) {
          // Stepped cobblestone rim (`2–3` voxels tall!)
          const h = (x * 7 + z * 13) % 3 === 0 ? 2 : 1;
          g.fillBox(x, 0, z, x, h, z, (x + z) % 2 === 0 ? 0xadb5bd : 0x868e96);
        } else if (r < 17.2) {
          const isLily = (Math.hypot(x - 14, z - 16) < 2.1 || Math.hypot(x - 28, z - 26) < 2.2);
          if (isLily) {
            g.fillBox(x, 0, z, x, 1, z, 0x40c057);
            if (Math.hypot(x - 14, z - 16) < 0.9) g.set(x, 2, z, 0xff8787); // Voxel lotus blossom!
          } else {
            const col = r > 14.5 ? 0x4dabf7 : (x + z) % 9 === 0 ? 0x74c0fc : 0x228be6;
            g.set(x, 0, z, col, 0x1864ab);
          }
        }
      }
    }
  });
  const m = new THREE.Mesh(geo, getSharedVoxelArchMaterial());
  m.receiveShadow = true;
  return m;
}

/**
 * 5. Sidewalk Voxel Vending Machine (`自动贩卖机`) & Mounted Open-Source `.vox` Street Props!
 */
export function createVoxelVendingMachine3D(variant = 0): THREE.Mesh {
  const bodyHex = variant % 2 === 0 ? 0xe03131 : 0x1c7ed6;
  const geo = getCachedGridGeo(`vox_vending_${variant % 2}`, 16, 26, 12, 0.088, (g) => {
    g.fillBox(0, 0, 0, 15, 25, 11, bodyHex);
    g.fillBox(1, 24, 0, 14, 25, 11, 0xf8f9fa);
    // Recessed lit drink display window (`z = 10..11`)
    g.carveBox(2, 11, 10, 13, 22, 11);
    g.fillBox(2, 11, 9, 13, 22, 9, 0xe3fafc, 0x74c0fc);
    const cans = [0xff6b6b, 0xffd43b, 0x51cf66, 0x339af0];
    for (const sy of [12, 17]) {
      g.fillBox(2, sy, 10, 13, sy, 10, 0xcbd5e1);
      for (let cx = 3; cx <= 11; cx += 3) {
        g.fillBox(cx, sy + 1, 10, cx + 1, sy + 3, 10, cans[(cx + sy) % 4], cans[(cx + sy) % 4]);
      }
    }
    // Coin slot + glowing button pad + dark pickup chute!
    g.fillBox(11, 7, 11, 13, 9, 11, 0xf8f9fa, 0xffe066);
    g.fillBox(3, 2, 10, 12, 5, 11, 0x1e2230);
  });
  const m = new THREE.Mesh(geo, getSharedVoxelArchMaterial());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Helper to place real artist-authored `.vox` sidewalk street furniture sets (trash cans, benches, planters, hydrants, postboxes) */
export function spawnVoxStreetPropCluster(
  parent: THREE.Object3D,
  kind: 'bench' | 'trashcan' | 'planter' | 'mailbox' | 'newsbox' | 'hydrant',
  x: number,
  y: number,
  z: number,
  rotY: number,
  seed = 0,
): void {
  const s = Math.abs(seed);
  if (kind === 'bench') {
    const benchUrl = s % 2 === 0 ? '/models/vox/obj_bench1.vox' : '/models/vox/obj_bench2.vox';
    void mountVoxModel(parent, benchUrl, {
      x,
      y,
      z,
      rotY,
      targetSpan: 3.1,
      tintHex: s % 3 === 0 ? 0x9c6644 : s % 3 === 1 ? 0x2b8a3e : undefined,
    });
  } else if (kind === 'trashcan') {
    const urls = ['/models/vox/obj_trashcan1.vox', '/models/vox/obj_trashcan2.vox', '/models/vox/obj_trashcan3.vox'];
    void mountVoxModel(parent, urls[s % urls.length], {
      x,
      y,
      z,
      rotY,
      targetHeight: s % 3 === 1 ? 1.32 : 1.08,
    });
  } else if (kind === 'planter') {
    const urls = ['/models/vox/obj_planter1.vox', '/models/vox/obj_planter2.vox', '/models/vox/obj_planter3a.vox'];
    void mountVoxModel(parent, urls[s % urls.length], {
      x,
      y,
      z,
      rotY,
      targetHeight: s % 3 === 2 ? 1.05 : 1.85,
    });
  } else if (kind === 'mailbox') {
    void mountVoxModel(parent, '/models/vox/obj_mailbox.vox', {
      x,
      y,
      z,
      rotY,
      targetHeight: 1.55,
      tintHex: s % 2 === 0 ? 0x2b8a3e : 0x1c7ed6,
    });
  } else if (kind === 'newsbox') {
    void mountVoxModel(parent, s % 2 === 0 ? '/models/vox/obj_newsbox1.vox' : '/models/vox/obj_newsbox2.vox', {
      x,
      y,
      z,
      rotY,
      targetHeight: 1.48,
    });
  } else if (kind === 'hydrant') {
    void mountVoxModel(parent, '/models/vox/obj_hydrant.vox', {
      x,
      y,
      z,
      rotY,
      targetHeight: 0.98,
    });
  }
}
