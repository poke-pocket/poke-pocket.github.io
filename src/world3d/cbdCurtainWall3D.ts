import * as THREE from 'three';
import { VoxelGrid3D, getSharedVoxelArchMaterial } from './voxelMesher3D';

/**
 * True MagicaVoxel 3D City Architecture Kit (`现代都市体素高楼 / CBD玻璃幕墙大厦 / 体素公寓套件`):
 * - Inspired directly by `MagicaVoxel City Kitbash Set` & `Voxel City`:
 *   Every building is constructed out of real 3D voxels with:
 *   1) Physically recessed 3D glass window bays & protruding 3D aluminum mullions / spandrel ledges!
 *   2) Stepped voxel setbacks, 3D rooftop HVAC units, cooling fans, water tanks, elevator penthouses,
 *      helipads (`H`), and 3D protruding illuminated neon/LED signboards!
 *   3) Discrete lit office floors/windows & crisp 3D voxel rooftop/corner LED light strips (`灯带`) at night —
 *      ZERO glowing concrete walls or weird yellow blotches, rendered in 1 draw call per building via cached greedy meshes!
 */

interface CachedVoxelTower {
  geo: THREE.BufferGeometry;
  baseNx: number;
  baseNy: number;
  baseNz: number;
}

const VOXEL_BUILDING_CACHE = new Map<string, CachedVoxelTower>();

function vHash(a: number, b: number, seed: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Adds authentic MagicaVoxel rooftop mechanical greebles (HVAC units, elevator room, water tank, or helipad + spire!) */
function populateVoxelRooftopGreebles(
  grid: VoxelGrid3D,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  roofY: number,
  isCbd: boolean,
  ledEmit: number,
  variant: number,
): void {
  const w = x1 - x0;
  const d = z1 - z0;
  if (w < 8 || d < 8 || roofY + 6 >= grid.ny) return;

  // 1. Stepped Voxel Rooftop Parapet Rim (`女儿墙`) + Glowing 3D Voxel LED Crown Strip on CBD Towers!
  const parapetCol = isCbd ? 0xcbd5e1 : 0x64748b;
  for (let x = x0; x <= x1; x++) {
    grid.set(x, roofY, z0, parapetCol);
    grid.set(x, roofY, z1, parapetCol);
    if (isCbd) {
      grid.set(x, roofY + 1, z0, 0xe2e8f0, ledEmit);
      grid.set(x, roofY + 1, z1, 0xe2e8f0, ledEmit);
    }
  }
  for (let z = z0; z <= z1; z++) {
    grid.set(x0, roofY, z, parapetCol);
    grid.set(x1, roofY, z, parapetCol);
    if (isCbd) {
      grid.set(x0, roofY + 1, z, 0xe2e8f0, ledEmit);
      grid.set(x1, roofY + 1, z, 0xe2e8f0, ledEmit);
    }
  }

  const cx = Math.floor((x0 + x1) * 0.5);
  const cz = Math.floor((z0 + z1) * 0.5);

  if (isCbd && variant % 3 === 0 && w >= 12 && d >= 12) {
    // Supertall CBD Rooftop Helipad (`H`) + Aviation Warning Beacons!
    grid.fillBox(cx - 4, roofY, cz - 4, cx + 4, roofY, cz + 4, 0x334155);
    grid.fillBox(cx - 2, roofY, cz - 2, cx - 2, roofY, cz + 2, 0xfacc15, 0xfacc15);
    grid.fillBox(cx + 2, roofY, cz - 2, cx + 2, roofY, cz + 2, 0xfacc15, 0xfacc15);
    grid.fillBox(cx - 2, roofY, cz, cx + 2, roofY, cz, 0xfacc15, 0xfacc15);
    grid.set(cx - 4, roofY + 1, cz - 4, 0xff4d4f, 0xff4d4f);
    grid.set(cx + 4, roofY + 1, cz + 4, 0xff4d4f, 0xff4d4f);
  } else {
    // Elevator Penthouse Box + Twin Voxel HVAC Cooling Units!
    const phX = Math.max(x0 + 2, cx - 3);
    const phZ = Math.max(z0 + 2, cz - 3);
    grid.fillBox(phX, roofY, phZ, Math.min(x1 - 2, phX + 4), roofY + 3, Math.min(z1 - 2, phZ + 4), 0x94a3b8);
    grid.fillBox(phX, roofY + 4, phZ, Math.min(x1 - 2, phX + 4), roofY + 4, Math.min(z1 - 2, phZ + 4), 0x475569);

    // Twin Voxel HVAC Air-Conditioning Units with dark fan vents
    if (cx + 2 <= x1 - 3 && cz + 1 <= z1 - 3) {
      grid.fillBox(cx + 2, roofY, cz - 1, cx + 4, roofY + 1, cz + 1, 0xdbe4ef);
      grid.set(cx + 3, roofY + 2, cz, 0x1e293b);
    }

    if (!isCbd && x0 + 5 < cx && z0 + 5 < z1 - 2) {
      // Classic Residential Rooftop Cylindrical Voxel Water Tank on 4 legs!
      grid.set(x0 + 2, roofY, z0 + 2, 0x475569);
      grid.set(x0 + 4, roofY, z0 + 2, 0x475569);
      grid.set(x0 + 2, roofY, z0 + 4, 0x475569);
      grid.set(x0 + 4, roofY, z0 + 4, 0x475569);
      grid.fillBox(x0 + 2, roofY + 1, z0 + 2, x0 + 4, roofY + 3, z0 + 4, 0x60a5fa);
    }
  }

  // Broadcast Spire Mast on CBD Towers
  if (isCbd && roofY + 8 < grid.ny) {
    const sx = Math.min(x1 - 3, cx + 2);
    const sz = Math.max(z0 + 3, cz - 2);
    grid.fillBox(sx, roofY, sz, sx, roofY + 6, sz, 0xe2e8f0);
    grid.set(sx, roofY + 7, sz, 0xff4d4f, 0xff4d4f);
  }
}

/**
 * Builds a Cached MagicaVoxel Modern All-Glass Curtain-Wall CBD Office Tower (`现代体素全玻璃幕墙 CBD 写字楼/摩天楼`):
 * - Supports `rect` (stepped glass curtain-wall tower), `cylinder` (voxel cylindrical glass rotunda),
 *   and `triangle` (voxel Flatiron glass wedge)!
 */
export function buildModernCbdOfficeTower3D(opts: {
  width: number;
  depth: number;
  shape: 'rect' | 'cylinder' | 'triangle';
  isSupertall: boolean;
  variant: number;
}): { group: THREE.Group; totalHeight: number } {
  const shapeKey = opts.shape;
  const vIdx = Math.abs(opts.variant) % 6;
  const cacheKey = `cbd_${shapeKey}_${opts.isSupertall ? 'super' : 'mid'}_${vIdx}`;

  let cached = VOXEL_BUILDING_CACHE.get(cacheKey);
  if (!cached) {
    const nx = 30;
    const nz = 28;
    const stories = opts.isSupertall ? 12 + (vIdx % 4) * 2 : 7 + (vIdx % 3);
    const vPerFloor = 4; // 1 spandrel slab + 3 tall curtain-wall glass voxels per story
    const bodyNy = stories * vPerFloor;
    const ny = bodyNy + 10;
    const grid = new VoxelGrid3D(nx, ny, nz);

    const mullionPal = [0x1e293b, 0x283548, 0xcbd5e1][vIdx % 3];
    const spandrelPal = [0x0f172a, 0x1e293b, 0x334155][vIdx % 3];
    const glassDayPal = [0x2b6cb0, 0x1d7a8c, 0x3b82f6, 0x0ea5e9, 0x366296, 0x28849e][vIdx];
    const glassSheenPal = [0x63b3ed, 0x4fd1c5, 0x93c5fd, 0x7dd3fc, 0x74a9e8, 0x67e8f9][vIdx];
    const ledEmit = [0x38bdf8, 0xfacc15, 0xe0f2fe, 0x2dd4bf, 0x60a5fa, 0xfde047][vIdx];

    const cx = (nx - 1) * 0.5;
    const cz = (nz - 1) * 0.5;
    // The curtain wall remains continuous instead of narrowing abruptly into a tower.
    const setbackFloor = stories + 1;

    for (let s = 0; s < stories; s++) {
      const isUpper = s >= setbackFloor;
      const shrink = isUpper ? 3 : 1;
      const y0 = s * vPerFloor;
      const floorLit = vHash(s, 5, vIdx * 17 + 3) > 0.42;

      for (let z = shrink; z < nz - shrink; z++) {
        for (let x = shrink; x < nx - shrink; x++) {
          let inside = false;
          let onBoundary = false;

          if (shapeKey === 'cylinder') {
            const rx = nx * 0.5 - shrink;
            const rz = nz * 0.5 - shrink;
            const nd = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2;
            inside = nd <= 1.0;
            const ndInner = ((x - cx) / (rx - 1.35)) ** 2 + ((z - cz) / (rz - 1.35)) ** 2;
            onBoundary = inside && ndInner > 1.0;
          } else if (shapeKey === 'triangle') {
            const zFrac = (z - shrink) / Math.max(1, nz - 1 - shrink * 2); // 0 at back (-Z), 1 at front tip (+Z)
            const halfSpan = (nx * 0.5 - shrink) * (1.0 - zFrac * 0.68);
            const dx = Math.abs(x - cx);
            inside = dx <= halfSpan;
            onBoundary =
              inside &&
              (dx >= halfSpan - 1.25 || z === shrink || z === nz - 1 - shrink);
          } else {
            inside = true;
            onBoundary =
              x === shrink ||
              x === nx - 1 - shrink ||
              z === shrink ||
              z === nz - 1 - shrink;
          }

          if (!inside) continue;

          // Only fill perimeter ring (2 voxels thick) + top roof cap to keep interior hollow & greedy mesh ultra-lean!
          const isInnerCore = !onBoundary;
          if (isInnerCore) {
            if (s === stories - 1 || s === setbackFloor - 1) {
              grid.set(x, y0 + vPerFloor - 1, z, spandrelPal);
            }
            continue;
          }

          // Determine if this perimeter voxel is a 3D protruding structural mullion, corner LED fin, or recessed glass bay!
          const isCorner =
            shapeKey === 'rect' &&
            (x === shrink || x === nx - 1 - shrink) &&
            (z === shrink || z === nz - 1 - shrink);
          const isMullionCol = (x + z) % 3 === 0;

          if (isCorner) {
            // Vertical 3D Voxel Corner Pilaster + Glowing Vertical LED Light Strip (`转角竖向灯带`)!
            for (let dy = 0; dy < vPerFloor; dy++) {
              grid.set(x, y0 + dy, z, 0xe2e8f0, ledEmit);
            }
          } else if (s === 0 && z >= nz - shrink - 1 && Math.abs(x - cx) < 5) {
            // Grand Ground-Floor Glass Lobby Entrance on +Z!
            for (let dy = 0; dy < vPerFloor; dy++) {
              grid.set(x, y0 + dy, z, 0x93c5fd, 0xfff3bf);
            }
          } else {
            // Horizontal spandrel ledge on `dy = 0` (protruding outer voxel!)
            grid.set(x, y0, z, spandrelPal);

            if (isMullionCol) {
              // Protruding 3D vertical curtain-wall mullion rib!
              for (let dy = 1; dy < vPerFloor; dy++) {
                grid.set(x, y0 + dy, z, mullionPal);
              }
            } else {
              // Physically RECESSED 1-voxel 3D Curtain-Wall Glass Window Bay!
              const rxIn = x === shrink ? x + 1 : x === nx - 1 - shrink ? x - 1 : x;
              const rzIn = z === shrink ? z + 1 : z === nz - 1 - shrink ? z - 1 : z;
              const isWarmOffice = vHash(11, s + 3, vIdx) > 0.62;
              const emitHex = floorLit ? (isWarmOffice ? 0xffe099 : 0xe6f4ff) : 0;
              for (let dy = 1; dy < vPerFloor; dy++) {
                const gCol = dy === vPerFloor - 1 ? glassSheenPal : glassDayPal;
                grid.set(rxIn, y0 + dy, rzIn, gCol, emitHex);
              }
            }
          }
        }
      }

      // Mid-tower setback LED belt
      if (s === setbackFloor - 1 && shapeKey === 'rect') {
        for (let x = 1; x < nx - 1; x++) {
          grid.set(x, y0 + vPerFloor, 1, 0xe2e8f0, ledEmit);
          grid.set(x, y0 + vPerFloor, nz - 2, 0xe2e8f0, ledEmit);
        }
        for (let z = 1; z < nz - 1; z++) {
          grid.set(1, y0 + vPerFloor, z, 0xe2e8f0, ledEmit);
          grid.set(nx - 2, y0 + vPerFloor, z, 0xe2e8f0, ledEmit);
        }
      }
    }

    // Protruding Ground-Floor Voxel Glass Canopy + Corporate Neon Signboard on +Z Front!
    if (shapeKey === 'rect') {
      const cHalf = 5;
      grid.fillBox(Math.floor(cx - cHalf), 4, nz - 1, Math.floor(cx + cHalf), 4, nz - 1, 0xe2e8f0, ledEmit);
      // Rooftop mechanical greebles, helipad, HVAC & LED crown!
      const topShrink = 1;
      populateVoxelRooftopGreebles(
        grid,
        topShrink,
        topShrink,
        nx - 1 - topShrink,
        nz - 1 - topShrink,
        bodyNy,
        true,
        ledEmit,
        vIdx,
      );
    } else {
      // Rooftop crown beacon for cylindrical / wedge glass towers
      const topY = bodyNy;
      grid.fillBox(Math.floor(cx - 2), topY, Math.floor(cz - 2), Math.floor(cx + 2), topY + 2, Math.floor(cz + 2), 0xe2e8f0, ledEmit);
    }

    const geo = grid.toGreedyGeometry(1, 1, 1);
    cached = { geo, baseNx: nx, baseNy: bodyNy + 4, baseNz: nz };
    VOXEL_BUILDING_CACHE.set(cacheKey, cached);
  }

  const targetW = opts.width * 0.90;
  const targetD = opts.depth * 0.88;
  const scaleX = targetW / cached.baseNx;
  const scaleZ = targetD / cached.baseNz;
  const scaleY = 0.96; // 1 voxel Y = ~0.96m (4 voxels = 3.84m story height!)

  const mesh = new THREE.Mesh(cached.geo, getSharedVoxelArchMaterial());
  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  // A recessed lobby canopy and slender entrance posts give the base a human scale.
  const metal=new THREE.MeshLambertMaterial({color:0x485b65});
  const canopyDepth=Math.max(.6,Math.min(2,(opts.depth-targetD)*.5+.35));
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(targetW*.35,.35,canopyDepth),metal);
  canopy.position.set(0,4.8,targetD*.5+canopyDepth*.5-.4);canopy.castShadow=true;group.add(canopy);
  for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.24,4.8,.24),metal);post.position.set(side*targetW*.16,2.4,targetD*.5+canopyDepth-.58);group.add(post)}
  return { group, totalHeight: cached.baseNy * scaleY };
}

/**
 * Builds a Cached MagicaVoxel Urban Residential Apartment / Mixed-Use Building (`现代体素住宅公寓楼`):
 * - 3D recessed casement windows, protruding 3D voxel balconies & window sills, wall AC units,
 *   rooftop water tank & HVAC, and discrete warm-glowing household windows at night!
 */
export function buildCleanUrbanApartment3D(opts: {
  width: number;
  depth: number;
  variant: number;
}): { group: THREE.Group; totalHeight: number } {
  const vIdx = Math.abs(opts.variant) % 5;
  const cacheKey = `vox_apt_${vIdx}`;

  let cached = VOXEL_BUILDING_CACHE.get(cacheKey);
  if (!cached) {
    const nx = 26;
    const nz = 22;
    const stories = 4 + (vIdx % 3); // 4–6 stories
    const vPerFloor = 4;
    const bodyNy = stories * vPerFloor;
    const ny = bodyNy + 8;
    const grid = new VoxelGrid3D(nx, ny, nz);

    const wallPals = [0xefe5d4, 0xe6cfc2, 0xdce4ee, 0xf2e8cf, 0xd8e2dc];
    const trimPals = [0xc9bba3, 0xbfa090, 0x9fb0c4, 0xd4c39b, 0xa8bab0];
    const roofPals = [0x475569, 0x9c4221, 0x334155, 0x7c2d12, 0x2c5282];
    const wallCol = wallPals[vIdx];
    const trimCol = trimPals[vIdx];
    const roofCol = roofPals[vIdx];

    for (let s = 0; s < stories; s++) {
      const y0 = s * vPerFloor;
      // Solid outer voxel wall ring (inset by 1 voxel so balconies & sills can protrude to 0 / nz-1!)
      for (let z = 1; z < nz - 1; z++) {
        for (let x = 1; x < nx - 1; x++) {
          const isEdge = x === 1 || x === nx - 2 || z === 1 || z === nz - 2;
          if (!isEdge) {
            if (s === stories - 1) grid.set(x, y0 + vPerFloor - 1, z, roofCol);
            continue;
          }
          const isSlab = false;
          grid.set(x, y0, z, isSlab ? trimCol : trimCol);
          for (let dy = 1; dy < vPerFloor; dy++) {
            grid.set(x, y0 + dy, z, wallCol);
          }
        }
      }

      // Carve 3D Recessed Apartment Windows + Protruding Voxel Window Sills & Balconies on Front/Back/Sides!
      for (const faceZ of [1, nz - 2]) {
        const outZ = faceZ === 1 ? 0 : nz - 1;
        const inZ = faceZ === 1 ? 2 : nz - 3;
        for (let b = 0; b < 4; b++) {
          const wx = 4 + b * 5;
          if (s === 0 && faceZ === nz - 2 && b === 1) {
            // Warm Apartment Lobby Entrance Doorway on +Z!
            grid.carveBox(wx, y0 + 1, faceZ, wx + 3, y0 + 3, faceZ);
            grid.fillBox(wx, y0 + 1, inZ, wx + 3, y0 + 3, inZ, 0x7c4d34, 0xffdfa0);
            grid.fillBox(wx - 1, y0 + 3, outZ, wx + 4, y0 + 3, outZ, roofCol);
            continue;
          }
          const lit = vHash(b + faceZ, s, vIdx * 19 + 5) < 0.44;
          const emitCol = lit ? (vHash(b, s + 9, vIdx) > 0.35 ? 0xffd678 : 0xfff0c2) : 0;
          // Carve outer wall & place recessed glass 1 voxel inward (`inZ`)!
          grid.carveBox(wx, y0 + 1, faceZ, wx + 2, y0 + 2, faceZ);
          grid.fillBox(wx, y0 + 1, inZ, wx + 2, y0 + 2, inZ, 0x4a6fa5, emitCol);
          // Protruding 3D Voxel Window Sill / Balcony on `outZ`!
          if (faceZ === nz - 2 && s > 0 && b % 2 === 1) {
            grid.fillBox(wx - 1, y0, outZ, wx + 3, y0 + 1, outZ, trimCol);
          } else {
            grid.fillBox(wx, y0, outZ, wx + 2, y0, outZ, trimCol);
          }
        }
      }

      // Side windows on ±X walls
      for (const faceX of [1, nx - 2]) {
        const inX = faceX === 1 ? 2 : nx - 3;
        for (let b = 0; b < 3; b++) {
          const wz = 4 + b * 5;
          const lit = vHash(b + faceX, s + 3, vIdx * 23) < 0.38;
          grid.carveBox(faceX, y0 + 1, wz, faceX, y0 + 2, wz + 2);
          grid.fillBox(inX, y0 + 1, wz, inX, y0 + 2, wz + 2, 0x4a6fa5, lit ? 0xffdc8a : 0);
        }
      }
    }

    // Stepped Voxel Roof Cornice + Rooftop Water Tank & HVAC Greebles!
    grid.fillBox(0, bodyNy, 0, nx - 1, bodyNy, nz - 1, roofCol);
    populateVoxelRooftopGreebles(grid, 1, 1, nx - 2, nz - 2, bodyNy + 1, false, 0, vIdx);

    const geo = grid.toGreedyGeometry(1, 1, 1);
    cached = { geo, baseNx: nx, baseNy: bodyNy + 3, baseNz: nz };
    VOXEL_BUILDING_CACHE.set(cacheKey, cached);
  }

  const scaleX = (opts.width * 0.88) / cached.baseNx;
  const scaleZ = (opts.depth * 0.86) / cached.baseNz;
  const scaleY = 0.88;

  const mesh = new THREE.Mesh(cached.geo, getSharedVoxelArchMaterial());
  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  return { group, totalHeight: cached.baseNy * scaleY };
}
