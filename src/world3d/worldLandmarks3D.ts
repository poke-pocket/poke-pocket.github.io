import * as THREE from 'three';
import { VoxelGrid3D, getSharedVoxelArchMaterial } from './voxelMesher3D';
import { createVoxelPlazaFountain3D } from './voxelNatureAndCivic3D';
import { createVoxelPokeball3D } from './voxelProps3D';

/**
 * Pure MagicaVoxel World City Landmarks (`世界名城纯体素地标塔楼`):
 * - ZERO smooth `SphereGeometry`, `CylinderGeometry`, or `ConeGeometry`!
 * - Every sphere (e.g. Shanghai Oriental Pearl), pagoda roof (Kyoto, Hangzhou, Beijing), onion dome (Harbin),
 *   and prism spire (Hong Kong, Tokyo, Guangzhou, Shenzhen) is rasterized onto an integer `VoxelGrid3D`
 *   so curves and roofs exhibit genuine stepped MagicaVoxel blocks, Ambient Occlusion, and discrete night LEDs!
 */

const LANDMARK_GEO_CACHE = new Map<string, THREE.BufferGeometry>();

function buildLandmarkVoxelMesh(
  key: string,
  nx: number,
  ny: number,
  nz: number,
  vs: number,
  sculpt: (g: VoxelGrid3D) => void,
): THREE.Group {
  let geo = LANDMARK_GEO_CACHE.get(key);
  if (!geo) {
    const grid = new VoxelGrid3D(nx, ny, nz);
    sculpt(grid);
    geo = grid.toGreedyGeometry(vs);
    LANDMARK_GEO_CACHE.set(key, geo);
  }
  const mesh = new THREE.Mesh(geo, getSharedVoxelArchMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const grp = new THREE.Group();
  grp.add(mesh);
  return grp;
}

function fillSphereVox(g: VoxelGrid3D, cx: number, cy: number, cz: number, r: number, rgb: number, emit = 0): void {
  const r0 = Math.ceil(r);
  for (let y = Math.max(0, Math.floor(cy - r0)); y <= Math.min(g.ny - 1, Math.ceil(cy + r0)); y++) {
    for (let z = Math.max(0, Math.floor(cz - r0)); z <= Math.min(g.nz - 1, Math.ceil(cz + r0)); z++) {
      for (let x = Math.max(0, Math.floor(cx - r0)); x <= Math.min(g.nx - 1, Math.ceil(cx + r0)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r) {
          g.set(x, y, z, rgb, emit);
        }
      }
    }
  }
}

function fillDiscVox(g: VoxelGrid3D, cx: number, y0: number, y1: number, cz: number, r: number, rgb: number, emit = 0): void {
  const r0 = Math.ceil(r);
  for (let y = Math.max(0, y0); y <= Math.min(g.ny - 1, y1); y++) {
    for (let z = Math.max(0, Math.floor(cz - r0)); z <= Math.min(g.nz - 1, Math.ceil(cz + r0)); z++) {
      for (let x = Math.max(0, Math.floor(cx - r0)); x <= Math.min(g.nx - 1, Math.ceil(cx + r0)); x++) {
        if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) {
          g.set(x, y, z, rgb, emit);
        }
      }
    }
  }
}

export function buildWorldLandmark3D(cityId: string): THREE.Group | null {
  if (cityId === 'shanghai') {
    // 🗼 上海东方明珠 (Stepped Voxel Ruby Spheres + Tripod Voxel Struts + Broadcast Spire!)
    return buildLandmarkVoxelMesh('lm_vox_shanghai', 34, 96, 34, 0.46, (g) => {
      const c = 16.5;
      fillDiscVox(g, c, 0, 3, c, 13.5, 0xdee2e6);
      fillDiscVox(g, c, 4, 5, c, 10.5, 0xf1f5f9);
      // 3 stepped diagonal voxel support legs + 3 central elevator shafts
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        for (let y = 5; y <= 24; y++) {
          const t = (y - 5) / 19;
          const rad = 10.2 * (1 - t) + 3.2 * t;
          const lx = Math.round(c + Math.cos(a) * rad);
          const lz = Math.round(c + Math.sin(a) * rad);
          g.fillBox(lx - 1, y, lz - 1, lx + 1, y, lz + 1, 0xe9ecef);
        }
        const sx = Math.round(c + Math.cos(a) * 2.8);
        const sz = Math.round(c + Math.sin(a) * 2.8);
        g.fillBox(sx, 6, sz, sx + 1, 62, sz + 1, 0xdbe4ef);
      }
      // Lower Giant Stepped Voxel Ruby Pearl (`y = 26`) + glowing equatorial observation window band!
      fillSphereVox(g, c, 26, c, 9.2, 0xe64980, 0xa61e4d);
      fillDiscVox(g, c, 26, 27, c, 9.5, 0xffe066, 0xffd43b);
      // Upper Stepped Voxel Pearl (`y = 58`) + Space Capsule (`y = 76`) + Antenna Mast (`y = 80..95`)
      fillSphereVox(g, c, 58, c, 6.8, 0xf06595, 0xc2255c);
      fillDiscVox(g, c, 58, 58, c, 7.1, 0x74c0fc, 0x4dabf7);
      g.fillBox(15, 64, 15, 18, 75, 18, 0xe9ecef);
      fillSphereVox(g, c, 76, c, 3.4, 0xffd43b, 0xfcc419);
      g.fillBox(16, 80, 16, 17, 94, 17, 0xf8f9fa);
      g.set(16, 95, 16, 0xff4d4f, 0xff4d4f);
    });
  }

  if (cityId === 'tokyo') {
    // 🗼 东京晴空塔 (Stepped Voxel Lattice Tower + Glowing Cyan Tembo Decks!)
    return buildLandmarkVoxelMesh('lm_vox_tokyo', 32, 94, 32, 0.46, (g) => {
      const c = 15.5;
      for (let y = 0; y < 78; y++) {
        const r = 11.5 * Math.pow(1 - y / 92, 0.72) + 1.8;
        fillDiscVox(g, c, y, y, c, r, y % 4 === 0 ? 0xcfd8e3 : 0xf1f5f9);
      }
      fillDiscVox(g, c, 50, 54, c, 7.6, 0x3bc9db, 0x22b8cf);
      fillDiscVox(g, c, 70, 73, c, 5.4, 0x74c0fc, 0x4dabf7);
      g.fillBox(15, 78, 15, 16, 93, 16, 0xf8f9fa);
    });
  }

  if (cityId === 'guangzhou') {
    // 🗼 广州塔·小蛮腰 (Hyperboloid Stepped Voxel Waist + Rainbow Emissive Voxel Rings!)
    return buildLandmarkVoxelMesh('lm_vox_guangzhou', 32, 92, 32, 0.45, (g) => {
      const c = 15.5;
      const rainbow = [0xf06595, 0x9775fa, 0x4dabf7, 0x63e6be, 0xffd43b];
      for (let y = 0; y < 74; y++) {
        const u = (y - 42) / 42;
        const r = 3.8 + u * u * 7.2;
        const isRing = y >= 10 && (y - 10) % 13 === 0;
        const ringCol = rainbow[Math.floor((y - 10) / 13) % rainbow.length];
        fillDiscVox(g, c, y, y, c, r, isRing ? ringCol : 0xe5dbff, isRing ? ringCol : 0);
      }
      g.fillBox(15, 74, 15, 16, 91, 16, 0xf1f5f9);
    });
  }

  if (cityId === 'beijing') {
    // 🏯 北京祈年殿 (3-Tier Stepped Marble Terrace + Royal Sapphire Voxel Conical Roofs!)
    return buildLandmarkVoxelMesh('lm_vox_beijing', 40, 48, 40, 0.44, (g) => {
      const c = 19.5;
      fillDiscVox(g, c, 0, 2, c, 18.5, 0xf8f9fa);
      fillDiscVox(g, c, 3, 5, c, 15.5, 0xedf2f7);
      fillDiscVox(g, c, 6, 14, c, 11.2, 0xc92a2a);
      for (let s = 0; s < 5; s++) fillDiscVox(g, c, 15 + s, 15 + s, c, 14.8 - s * 1.1, 0x1864ab);
      fillDiscVox(g, c, 20, 25, c, 8.6, 0xc92a2a);
      for (let s = 0; s < 5; s++) fillDiscVox(g, c, 26 + s, 26 + s, c, 11.8 - s * 1.0, 0x1864ab);
      fillDiscVox(g, c, 31, 35, c, 5.8, 0xc92a2a);
      for (let s = 0; s < 8; s++) fillDiscVox(g, c, 36 + s, 36 + s, c, 9.2 - s * 1.05, 0x1971c2);
      fillSphereVox(g, c, 45, c, 1.9, 0xfcc419, 0xf59f00);
    });
  }

  if (cityId === 'kyoto' || cityId === 'hangzhou' || cityId === 'chengdu' || cityId === 'osaka' || cityId === 'okinawa') {
    // 🏯 东方古建五重塔/天守阁/楼阁 (Stepped MagicaVoxel Pagoda Tiers with Upturned Voxel Corner Eaves!)
    const roofCol =
      cityId === 'hangzhou'
        ? 0xd99b26
        : cityId === 'chengdu' || cityId === 'osaka'
          ? 0x208b63
          : cityId === 'okinawa'
            ? 0xb8442a
            : 0x3b4252;
    const wallCol = cityId === 'osaka' ? 0xf8f9fa : 0xc92a2a;
    const tiers = cityId === 'okinawa' ? 2 : cityId === 'chengdu' ? 3 : 5;
    return buildLandmarkVoxelMesh(`lm_vox_pagoda_${cityId}`, 38, 56, 38, 0.44, (g) => {
      g.fillBox(4, 0, 4, 33, 6, 33, 0xadb5bd);
      for (let t = 0; t < tiers; t++) {
        const y0 = 7 + t * 9;
        const half = Math.max(4, 11 - t * 2);
        g.fillBox(19 - half, y0, 19 - half, 19 + half, y0 + 4, 19 + half, wallCol);
        // Stepped MagicaVoxel pagoda roof + upturned corner finials!
        for (let rs = 0; rs < 4; rs++) {
          const rh = half + 4 - rs * 2;
          g.fillBox(19 - rh, y0 + 5 + rs, 19 - rh, 19 + rh, y0 + 5 + rs, 19 + rh, roofCol);
          if (rs === 0) {
            for (const cx of [19 - rh, 19 + rh]) {
              for (const cz of [19 - rh, 19 + rh]) g.set(cx, y0 + 6, cz, 0xfcc419, 0xf59f00);
            }
          }
        }
      }
      const topY = 7 + tiers * 9;
      g.fillBox(18, topY, 18, 19, Math.min(55, topY + 8), 19, 0xfcc419, 0xf59f00);
    });
  }

  // Modern Voxel Crystal Skyscraper Landmark (`shenzhen` / `hongkong` / `harbin` / `sapporo` / `fukuoka`)
  return buildLandmarkVoxelMesh(`lm_vox_modern_${cityId}`, 34, 88, 34, 0.45, (g) => {
    const primary =
      cityId === 'harbin'
        ? 0xb03a2e
        : cityId === 'sapporo'
          ? 0xe03131
          : cityId === 'hongkong'
            ? 0x74c0fc
            : 0x339af0;
    g.fillBox(5, 0, 5, 28, 7, 28, 0xdbe4ef);
    for (let y = 8; y < 74; y++) {
      const shrink = Math.floor(((y - 8) / 66) * 6);
      const x0 = 7 + shrink;
      const x1 = 26 - shrink;
      const isLit = y % 4 === 2;
      g.fillBox(x0, y, x0, x1, y, x1, primary, isLit ? 0x99e9f2 : 0);
      // Corner silver mullions
      for (const cx of [x0, x1]) {
        for (const cz of [x0, x1]) g.set(cx, y, cz, 0xf8f9fa);
      }
    }
    if (cityId === 'harbin') {
      fillSphereVox(g, 16.5, 76, 16.5, 6.5, 0x2b8a3e);
    }
    g.fillBox(16, 74, 16, 17, 87, 17, 0xfcc419, 0xffe066);
  });
}

export function createPokeballBeacon(radius = 1.15): THREE.Group {
  return createVoxelPokeball3D(radius * 2);
}

export function createPlazaFountain(fountains: THREE.Object3D[]): THREE.Group {
  return createVoxelPlazaFountain3D(fountains);
}
