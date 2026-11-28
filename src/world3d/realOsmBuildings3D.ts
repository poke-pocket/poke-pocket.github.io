import * as THREE from 'three';
import {
  WATER_LEVEL_3D,
  getTerrainHeight3D,
  isNearAnyRoadOrRailForFlora3D,
} from '../data/survivorsTactics';
import {
  geoToWorld,
  getActiveGeoTerrainOrigin,
  worldToGeo,
} from '../data/geoTerrain3D';
import {
  getCachedRealBuildingTile,
  latLngToTileZ14,
  prefetchRealBuildingsAround,
  subscribeRealBuildingsLoaded,
  type RealOsmBuilding,
} from '../utils/realBuildingsMvt';
import type { TownBuildingLot } from '../utils/townStreetGen';

export interface OsmBuildingCollider {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  height: number;
}

interface BuiltTileEntry {
  key: string;
  mesh: THREE.Mesh;
  colliders: OsmBuildingCollider[];
}

// =========================================================================
// SHARED PIXEL-ART ARCHITECTURAL FACADE TEXTURE (1 DRAW CALL PER Z14 TILE!)
// =========================================================================
let sharedFacadeMat: THREE.MeshLambertMaterial | null = null;

function getSharedOsmFacadeMaterial(): THREE.MeshLambertMaterial {
  if (sharedFacadeMat) return sharedFacadeMat;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d')!;
  // Crisp neutral pixel-art glass/concrete facade modulated by per-building vertex colors!
  ctx.fillStyle = '#e6ebf0';
  ctx.fillRect(0, 0, 64, 64);

  // Horizontal slab floor lines
  ctx.fillStyle = '#c5ced8';
  for (let y = 0; y < 64; y += 16) {
    ctx.fillRect(0, y, 64, 3);
  }
  // Pixelated window bays (warm/cool glass panes)
  for (let row = 0; row < 4; row++) {
    const wy = row * 16 + 5;
    for (let col = 0; col < 4; col++) {
      const wx = col * 16 + 3;
      ctx.fillStyle = '#6b8199';
      ctx.fillRect(wx, wy, 10, 9);
      ctx.fillStyle = (row + col) % 3 === 0 ? '#a8d4f0' : '#85a9c9';
      ctx.fillRect(wx + 1, wy + 1, 8, 7);
      // Specular pixel glint
      ctx.fillStyle = '#dceeff';
      ctx.fillRect(wx + 1, wy + 1, 3, 2);
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;

  sharedFacadeMat = new THREE.MeshLambertMaterial({
    map: tex,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  return sharedFacadeMat;
}

// =========================================================================
// FAST EAR-CLIPPING TRIANGULATOR FOR CONCAVE REAL OSM BUILDING ROOFS
// =========================================================================
function cross2(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}

function pointInTri(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): boolean {
  const c1 = cross2(ax, az, bx, bz, px, pz);
  const c2 = cross2(bx, bz, cx, cz, px, pz);
  const c3 = cross2(cx, cz, ax, az, px, pz);
  return (c1 >= 0 && c2 >= 0 && c3 >= 0) || (c1 <= 0 && c2 <= 0 && c3 <= 0);
}

function triangulatePolygonXZ(pts: [number, number][]): number[] {
  const n = pts.length;
  if (n < 3) return [];
  if (n === 3) return [0, 1, 2];

  // Ensure consistent winding (positive signed area)
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % n];
    area2 += x1 * z2 - x2 * z1;
  }
  const idx = Array.from({ length: n }, (_, i) => (area2 >= 0 ? i : n - 1 - i));
  const tris: number[] = [];
  let guard = n * n;

  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const iPrev = idx[(i - 1 + idx.length) % idx.length];
      const iCurr = idx[i];
      const iNext = idx[(i + 1) % idx.length];
      const [ax, az] = pts[iPrev];
      const [bx, bz] = pts[iCurr];
      const [cx, cz] = pts[iNext];
      if (cross2(ax, az, bx, bz, cx, cz) <= 1e-5) continue;

      let containsOther = false;
      for (let j = 0; j < idx.length; j++) {
        const k = idx[j];
        if (k === iPrev || k === iCurr || k === iNext) continue;
        if (pointInTri(pts[k][0], pts[k][1], ax, az, bx, bz, cx, cz)) {
          containsOther = true;
          break;
        }
      }
      if (containsOther) continue;
      tris.push(iPrev, iCurr, iNext);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  return tris;
}

function parseHexRgb(hex?: string): [number, number, number] | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function pickBuildingRgb(b: RealOsmBuilding): { wall: [number, number, number]; roof: [number, number, number] } {
  const h = b.heightM;
  const hash = Math.abs(Math.round(b.centerLat * 10000) * 13 + Math.round(b.centerLng * 10000) * 7) % 5;
  const customRgb = parseHexRgb(b.colour);
  const tint = (base: [number, number, number]): [number, number, number] =>
    customRgb
      ? [
          base[0] * 0.55 + customRgb[0] * 0.45,
          base[1] * 0.55 + customRgb[1] * 0.45,
          base[2] * 0.55 + customRgb[2] * 0.45,
        ]
      : base;

  if (h >= 160) {
    // Supertall iconic glass tower (Ping An 600m / Shanghai Tower 632m / IFC2 416m!)
    return { wall: tint([0.58, 0.80, 0.96]), roof: [0.76, 0.90, 1.0] };
  }
  if (h >= 55) {
    // Modern high-rise glass/steel office tower
    const blues: [number, number, number][] = [
      [0.64, 0.78, 0.92],
      [0.72, 0.82, 0.88],
      [0.60, 0.74, 0.86],
      [0.76, 0.82, 0.86],
      [0.66, 0.80, 0.90],
    ];
    const w = tint(blues[hash]);
    return { wall: w, roof: [w[0] * 0.92, w[1] * 0.94, Math.min(1, w[2] * 1.02)] };
  }
  if (h >= 20) {
    // Urban residential compound mid-rise
    const warms: [number, number, number][] = [
      [0.92, 0.86, 0.78],
      [0.88, 0.78, 0.68],
      [0.90, 0.84, 0.76],
      [0.86, 0.82, 0.78],
      [0.94, 0.88, 0.80],
    ];
    const w = tint(warms[hash]);
    return { wall: w, roof: [0.68, 0.66, 0.64] };
  }
  // Low-rise neighborhood building / terracotta roof
  const lowWalls: [number, number, number][] = [
    [0.94, 0.89, 0.80],
    [0.90, 0.83, 0.74],
    [0.88, 0.86, 0.82],
    [0.95, 0.90, 0.82],
    [0.89, 0.82, 0.76],
  ];
  const lowRoofs: [number, number, number][] = [
    [0.78, 0.50, 0.40],
    [0.72, 0.52, 0.44],
    [0.66, 0.64, 0.62],
    [0.80, 0.56, 0.42],
    [0.62, 0.54, 0.50],
  ];
  return { wall: tint(lowWalls[hash]), roof: lowRoofs[hash] };
}

export interface ProtectedOsmAreas3D {
  lots: TownBuildingLot[];
  parks: { x: number; z: number; w: number; d: number }[];
  centers: { x: number; z: number }[];
}

/**
 * Streams real OpenFreeMap/OSM Z14 building footprints around the player in 3D,
 * merging each Z14 tile into ONE single low-draw-call `THREE.Mesh` while avoiding
 * procedural roads, parks, central spawn fountains, water, and enterable game buildings!
 */
export function createRealOsmBuildingStreamer3D(params: {
  scene: THREE.Scene;
  getProtectedAreas: () => ProtectedOsmAreas3D;
}) {
  const { scene, getProtectedAreas } = params;
  const group = new THREE.Group();
  group.name = 'RealOsmBuildings3D';
  scene.add(group);

  const builtTiles = new Map<string, BuiltTileEntry>();
  let lastCenterKey = '';

  const buildTileMesh = (tx: number, ty: number, key: string, buildings: RealOsmBuilding[]) => {
    const origin = getActiveGeoTerrainOrigin();
    if (!origin || buildings.length === 0) return;

    const { lots: protectedLots, parks: protectedParks, centers: protectedCenters } = getProtectedAreas();
    const pos: number[] = [];
    const norm: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const tileColliders: OsmBuildingCollider[] = [];

    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];
      const centerW = geoToWorld(b.centerLat, b.centerLng, origin);
      if (!centerW) continue;
      const bx = centerW.x;
      const bz = centerW.z;

      // Skip buildings sitting in water, on roads/rails, inside parks, central spawn plaza, or colliding with enterable game buildings
      const groundY = getTerrainHeight3D(bx, bz);
      if (groundY <= WATER_LEVEL_3D + 0.25) continue;
      if (isNearAnyRoadOrRailForFlora3D(bx, bz, 4.5)) continue;

      let blocked = false;
      for (let ci = 0; ci < protectedCenters.length; ci++) {
        if (Math.hypot(bx - protectedCenters[ci].x, bz - protectedCenters[ci].z) < 26) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (let pi = 0; pi < protectedParks.length; pi++) {
        const pk = protectedParks[pi];
        if (Math.abs(bx - pk.x) < pk.w * 0.5 + 3.5 && Math.abs(bz - pk.z) < pk.d * 0.5 + 3.5) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (let li = 0; li < protectedLots.length; li++) {
        const lot = protectedLots[li];
        const margin = Math.max(lot.width, lot.depth) * 0.56 + 3.5;
        if (Math.abs(bx - lot.x) < margin && Math.abs(bz - lot.z) < margin) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      // Project footprint vertices to 3D world XZ (deduping consecutive near-identical verts)
      const pts: [number, number][] = [];
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < b.ring.length; i++) {
        const w = geoToWorld(b.ring[i][0], b.ring[i][1], origin);
        if (!w) continue;
        if (pts.length > 0 && Math.hypot(w.x - pts[pts.length - 1][0], w.z - pts[pts.length - 1][1]) < 0.35) {
          continue;
        }
        pts.push([w.x, w.z]);
        if (w.x < minX) minX = w.x;
        if (w.x > maxX) maxX = w.x;
        if (w.z < minZ) minZ = w.z;
        if (w.z > maxZ) maxZ = w.z;
      }
      if (pts.length >= 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.35) {
        pts.pop();
      }
      if (pts.length < 3) continue;

      const spanX = maxX - minX;
      const spanZ = maxZ - minZ;
      if (spanX < 1.2 || spanZ < 1.2 || spanX > 120 || spanZ > 120) continue;

      // Ensure NO vertex intrudes onto a procedural street
      let hitsRoad = false;
      for (let i = 0; i < pts.length; i++) {
        if (isNearAnyRoadOrRailForFlora3D(pts[i][0], pts[i][1], 2.5)) {
          hitsRoad = true;
          break;
        }
      }
      if (hitsRoad) continue;

      // Realistic playable 3D height scaled from real OSM meters (600m Ping An -> 60u skyline tower!)
      const h3d = Math.max(3.4, Math.min(60, b.heightM * 0.145 + 1.4));
      const baseY = groundY - 0.6; // slight skirt embedded into slope so zero floating walls!
      const topY = groundY + h3d;
      const { wall, roof } = pickBuildingRgb(b);

      // 1) Extrude vertical wall quads with UV tiled per floor (~3.2u per floor repeat)
      for (let i = 0; i < pts.length; i++) {
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[(i + 1) % pts.length];
        const edgeLen = Math.hypot(x2 - x1, z2 - z1);
        if (edgeLen < 0.2) continue;
        const nx = (z2 - z1) / edgeLen;
        const nz = -(x2 - x1) / edgeLen;
        // Directional shading lift so orthogonal facades read crisply like voxel architecture
        const shade = 0.86 + Math.max(0, nx * 0.65 + nz * 0.75) * 0.16;
        const wr = Math.min(1, wall[0] * shade);
        const wg = Math.min(1, wall[1] * shade);
        const wb = Math.min(1, wall[2] * shade);

        const uSpan = Math.max(0.5, edgeLen / 5.5);
        const vSpan = Math.max(0.5, (topY - baseY) / 5.5);

        // Tri 1: (x1,base), (x2,base), (x2,top)
        pos.push(x1, baseY, z1, x2, baseY, z2, x2, topY, z2);
        norm.push(nx, 0, nz, nx, 0, nz, nx, 0, nz);
        uv.push(0, 0, uSpan, 0, uSpan, vSpan);
        col.push(wr, wg, wb, wr, wg, wb, wr, wg, wb);

        // Tri 2: (x1,base), (x2,top), (x1,top)
        pos.push(x1, baseY, z1, x2, topY, z2, x1, topY, z1);
        norm.push(nx, 0, nz, nx, 0, nz, nx, 0, nz);
        uv.push(0, 0, uSpan, vSpan, 0, vSpan);
        col.push(wr, wg, wb, wr, wg, wb, wr, wg, wb);
      }

      // 2) Triangulate exact concave/convex roof cap
      const roofTris = triangulatePolygonXZ(pts);
      for (let t = 0; t < roofTris.length; t += 3) {
        const pA = pts[roofTris[t]];
        const pB = pts[roofTris[t + 1]];
        const pC = pts[roofTris[t + 2]];
        pos.push(pA[0], topY, pA[1], pB[0], topY, pB[1], pC[0], topY, pC[1]);
        norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        // Sample clean solid neutral corner of facade texture so roof has zero window tiles!
        uv.push(0.02, 0.02, 0.02, 0.02, 0.02, 0.02);
        col.push(roof[0], roof[1], roof[2], roof[0], roof[1], roof[2], roof[0], roof[1], roof[2]);
      }

      tileColliders.push({
        x: (minX + maxX) * 0.5,
        z: (minZ + maxZ) * 0.5,
        halfW: spanX * 0.45,
        halfD: spanZ * 0.45,
        height: h3d,
      });
    }

    if (pos.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, getSharedOsmFacadeMaterial());
    mesh.name = `OsmTile_${tx}_${ty}`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);

    const prev = builtTiles.get(key);
    if (prev) {
      group.remove(prev.mesh);
      prev.mesh.geometry.dispose();
    }
    builtTiles.set(key, { key, mesh, colliders: tileColliders });
  };

  let lastPx = 0;
  let lastPz = 0;
  let disposed = false;
  const pendingBuildQueue: { tx: number; ty: number; key: string }[] = [];
  let buildRafId: number | null = null;

  const pumpPendingBuilds = () => {
    buildRafId = null;
    if (disposed || pendingBuildQueue.length === 0) return;
    // Build at most ONE Z14 OSM tile mesh per animation frame so streaming NEVER stalls 3D FPS or WebAudio!
    const next = pendingBuildQueue.shift()!;
    const cached = getCachedRealBuildingTile(next.tx, next.ty);
    if (cached) {
      buildTileMesh(next.tx, next.ty, next.key, cached);
    }
    if (pendingBuildQueue.length > 0 && typeof window !== 'undefined') {
      buildRafId = window.requestAnimationFrame(pumpPendingBuilds);
    }
  };

  const enqueueTileBuild = (tx: number, ty: number, key: string) => {
    if (pendingBuildQueue.some((q) => q.key === key)) return;
    pendingBuildQueue.push({ tx, ty, key });
    if (buildRafId === null && typeof window !== 'undefined') {
      buildRafId = window.requestAnimationFrame(pumpPendingBuilds);
    }
  };

  const updateAround = (px: number, pz: number, force = false, buildMissingOnly = false) => {
    if (disposed) return;
    lastPx = px;
    lastPz = pz;
    const origin = getActiveGeoTerrainOrigin();
    if (!origin) return;
    const geo = worldToGeo(px, pz, origin);
    if (!geo) return;

    const { tx, ty } = latLngToTileZ14(geo.lat, geo.lng);
    const cKey = `${tx}_${ty}`;
    if (!force && !buildMissingOnly && cKey === lastCenterKey) return;
    lastCenterKey = cKey;

    prefetchRealBuildingsAround(geo.lat, geo.lng, 1);

    const wanted = new Set<string>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        const key = `14/${nx}/${ny}`;
        wanted.add(key);
        if (!builtTiles.has(key) || (force && !buildMissingOnly)) {
          const cached = getCachedRealBuildingTile(nx, ny);
          if (cached) enqueueTileBuild(nx, ny, key);
        }
      }
    }

    // Evict distant tiles cleanly to keep GPU memory tight
    for (const [key, entry] of builtTiles.entries()) {
      if (!wanted.has(key)) {
        group.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        builtTiles.delete(key);
      }
    }
  };

  const unsub = subscribeRealBuildingsLoaded(() => {
    updateAround(lastPx, lastPz, false, true);
  });

  const dispose = () => {
    disposed = true;
    unsub();
    if (buildRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(buildRafId);
      buildRafId = null;
    }
    pendingBuildQueue.length = 0;
    for (const entry of builtTiles.values()) {
      group.remove(entry.mesh);
      entry.mesh.geometry.dispose();
    }
    builtTiles.clear();
    scene.remove(group);
  };

  return { group, updateAround, dispose };
}
