import * as THREE from 'three';
import { TOWN_NIGHT_UNIFORM } from './townAssetLoader';

/**
 * High-Speed MagicaVoxel 3D Grid + Face-Culled Greedy Mesher with Baked Voxel Ambient Occlusion (`体素网格构建器`):
 * - Builds true 3D block-by-block MagicaVoxel architecture (recessed windows, protruding mullions, balconies,
 *   stepped roofs, rooftop HVAC units, water tanks, neon signs, and LED light strips).
 * - Uses 2D Greedy Meshing per slice + baked corner Voxel AO + per-vertex `aNightEmit` attribute so an entire
 *   40-story MagicaVoxel skyscraper renders in **1 single draw call** with crisp 3D depth and discrete night windows!
 */

let SHARED_VOXEL_ARCH_MAT: THREE.MeshLambertMaterial | null = null;

export function getSharedVoxelArchMaterial(): THREE.MeshLambertMaterial {
  if (SHARED_VOXEL_ARCH_MAT) return SHARED_VOXEL_ARCH_MAT;
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
  });
  mat.customProgramCacheKey = () => 'pk_magicavoxel_ao_night_v1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNightGlow = TOWN_NIGHT_UNIFORM;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aNightEmit;
varying vec3 vNightEmit;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vNightEmit = aNightEmit;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNightGlow;
varying vec3 vNightEmit;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `if (uNightGlow > 0.01 && (vNightEmit.r + vNightEmit.g + vNightEmit.b) > 0.02) {
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vNightEmit, clamp(uNightGlow * 0.96, 0.0, 1.0));
}
#include <dithering_fragment>`,
      );
  };
  SHARED_VOXEL_ARCH_MAT = mat;
  return mat;
}

export class VoxelGrid3D {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  /** 24-bit RGB (`0xRRGGBB`), `-1` = empty air */
  readonly color: Int32Array;
  /** 24-bit Night Emissive RGB (`0` = non-emissive solid wall/trim; `>0` = lit window or LED strip!) */
  readonly emit: Int32Array;

  constructor(nx: number, ny: number, nz: number) {
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    const len = nx * ny * nz;
    this.color = new Int32Array(len).fill(-1);
    this.emit = new Int32Array(len);
  }

  idx(x: number, y: number, z: number): number {
    return x + this.nx * (z + this.nz * y);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.nx && y >= 0 && y < this.ny && z >= 0 && z < this.nz;
  }

  isSolid(x: number, y: number, z: number): boolean {
    if (y < 0) return true; // Ground plane counts as solid for clean base AO!
    if (x < 0 || x >= this.nx || y >= this.ny || z < 0 || z >= this.nz) return false;
    return this.color[this.idx(x, y, z)] >= 0;
  }

  set(x: number, y: number, z: number, rgb: number, emitRgb = 0): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.idx(x, y, z);
    this.color[i] = rgb;
    this.emit[i] = emitRgb;
  }

  clear(x: number, y: number, z: number): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.idx(x, y, z);
    this.color[i] = -1;
    this.emit[i] = 0;
  }

  fillBox(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    rgb: number,
    emitRgb = 0,
  ): void {
    const ax0 = Math.max(0, Math.min(x0, x1));
    const ax1 = Math.min(this.nx - 1, Math.max(x0, x1));
    const ay0 = Math.max(0, Math.min(y0, y1));
    const ay1 = Math.min(this.ny - 1, Math.max(y0, y1));
    const az0 = Math.max(0, Math.min(z0, z1));
    const az1 = Math.min(this.nz - 1, Math.max(z0, z1));
    for (let y = ay0; y <= ay1; y++) {
      for (let z = az0; z <= az1; z++) {
        let idx = this.idx(ax0, y, z);
        for (let x = ax0; x <= ax1; x++, idx++) {
          this.color[idx] = rgb;
          this.emit[idx] = emitRgb;
        }
      }
    }
  }

  carveBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const ax0 = Math.max(0, Math.min(x0, x1));
    const ax1 = Math.min(this.nx - 1, Math.max(x0, x1));
    const ay0 = Math.max(0, Math.min(y0, y1));
    const ay1 = Math.min(this.ny - 1, Math.max(y0, y1));
    const az0 = Math.max(0, Math.min(z0, z1));
    const az1 = Math.min(this.nz - 1, Math.max(z0, z1));
    for (let y = ay0; y <= ay1; y++) {
      for (let z = az0; z <= az1; z++) {
        let idx = this.idx(ax0, y, z);
        for (let x = ax0; x <= ax1; x++, idx++) {
          this.color[idx] = -1;
          this.emit[idx] = 0;
        }
      }
    }
  }

  /**
   * Greedy-meshes all exposed voxel faces into a single compact `THREE.BufferGeometry`
   * centered on X & Z (`[-nx*vs/2 .. +nx*vs/2]`) and bottom-anchored on Y (`[0 .. ny*vs]`),
   * with real MagicaVoxel crease Ambient Occlusion!
   */
  toGreedyGeometry(voxelSizeX: number, voxelSizeY = voxelSizeX, voxelSizeZ = voxelSizeX): THREE.BufferGeometry {
    const { nx, ny, nz } = this;
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const emits: number[] = [];
    const indices: number[] = [];

    const offX = -nx * voxelSizeX * 0.5;
    const offZ = -nz * voxelSizeZ * 0.5;

    const dims = [nx, ny, nz];

    // 6 cardinal face directions: (axis d=0..2, sign s=-1|+1)
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const du = dims[u];
      const dv = dims[v];
      const maskCol = new Int32Array(du * dv);
      const maskEmit = new Int32Array(du * dv);
      const maskAoKey = new Int32Array(du * dv);

      for (const backFace of [false, true]) {
        const stepD = backFace ? -1 : 1;
        const norm = [0, 0, 0];
        norm[d] = stepD;

        for (let slice = 0; slice < dims[d]; slice++) {
          maskCol.fill(-1);
          const p = [0, 0, 0];
          p[d] = slice;

          // Populate 2D face visibility + MagicaVoxel 4-corner crease AO mask for this slice
          for (let j = 0; j < dv; j++) {
            p[v] = j;
            for (let i = 0; i < du; i++) {
              p[u] = i;
              const c = this.color[this.idx(p[0], p[1], p[2])];
              if (c < 0) continue;
              const np = [p[0], p[1], p[2]];
              np[d] += stepD;
              if (this.isSolid(np[0], np[1], np[2])) continue;

              const em = this.emit[this.idx(p[0], p[1], p[2])];
              // Compute 4 corner AO levels (0..3 occluders each) in the plane just outside this face
              let aoPacked = 0;
              if (em === 0) {
                for (let cv = 0; cv < 2; cv++) {
                  for (let cu = 0; cu < 2; cu++) {
                    const su = cu === 0 ? -1 : 1;
                    const sv = cv === 0 ? -1 : 1;
                    const s1 = [np[0], np[1], np[2]];
                    s1[u] += su;
                    const s2 = [np[0], np[1], np[2]];
                    s2[v] += sv;
                    const sc = [np[0], np[1], np[2]];
                    sc[u] += su;
                    sc[v] += sv;
                    const b1 = this.isSolid(s1[0], s1[1], s1[2]) ? 1 : 0;
                    const b2 = this.isSolid(s2[0], s2[1], s2[2]) ? 1 : 0;
                    const bc = this.isSolid(sc[0], sc[1], sc[2]) ? 1 : 0;
                    const occ = b1 && b2 ? 3 : b1 + b2 + bc;
                    aoPacked = (aoPacked << 2) | occ;
                  }
                }
              }
              const mIdx = i + j * du;
              // Add subtle per-voxel micro-variation ONLY when non-emissive so flat walls still show crisp voxel grain!
              const vHash = ((p[0] * 73856093) ^ (p[1] * 19349663) ^ (p[2] * 83492791)) & 3;
              maskCol[mIdx] = c | (vHash << 24);
              maskEmit[mIdx] = em;
              maskAoKey[mIdx] = aoPacked;
            }
          }

          // 2D Greedy Merge identical (color + variation + emit + AO) quads
          for (let j = 0; j < dv; j++) {
            for (let i = 0; i < du; ) {
              const mIdx = i + j * du;
              const cKey = maskCol[mIdx];
              if (cKey < 0) {
                i++;
                continue;
              }
              const em = maskEmit[mIdx];
              const ao = maskAoKey[mIdx];

              let w = 1;
              while (
                i + w < du &&
                maskCol[mIdx + w] === cKey &&
                maskEmit[mIdx + w] === em &&
                maskAoKey[mIdx + w] === ao
              ) {
                w++;
              }
              let h = 1;
              outer: while (j + h < dv) {
                for (let k = 0; k < w; k++) {
                  const idx2 = i + k + (j + h) * du;
                  if (maskCol[idx2] !== cKey || maskEmit[idx2] !== em || maskAoKey[idx2] !== ao) {
                    break outer;
                  }
                }
                h++;
              }

              for (let dy = 0; dy < h; dy++) {
                for (let dx = 0; dx < w; dx++) {
                  maskCol[i + dx + (j + dy) * du] = -1;
                }
              }

              const rgb = cKey & 0xffffff;
              const micro = ((cKey >>> 24) & 3) * 0.016 - 0.024;
              // Slight directional face shade so voxel steps pop crisply even under ambient sky light
              const dirShade = d === 1 ? (backFace ? 0.82 : 1.05) : d === 0 ? 0.94 : 0.98;
              const baseR = (((rgb >> 16) & 255) / 255) * dirShade + micro;
              const baseG = (((rgb >> 8) & 255) / 255) * dirShade + micro;
              const baseB = ((rgb & 255) / 255) * dirShade + micro;

              const emR = ((em >> 16) & 255) / 255;
              const emG = ((em >> 8) & 255) / 255;
              const emB = (em & 255) / 255;

              // Unpack 4 corner AO multipliers: c00 (u0,v0), c10 (u1,v0), c01 (u0,v1), c11 (u1,v1)
              const ao00 = 1.0 - ((ao >> 6) & 3) * 0.095;
              const ao10 = 1.0 - ((ao >> 4) & 3) * 0.095;
              const ao01 = 1.0 - ((ao >> 2) & 3) * 0.095;
              const ao11 = 1.0 - (ao & 3) * 0.095;

              const faceCoord = backFace ? slice : slice + 1;
              const corners: [number, number, number, number][] = [
                [i, j, ao00, 0],
                [i + w, j, ao10, 1],
                [i + w, j + h, ao11, 2],
                [i, j + h, ao01, 3],
              ];

              const vBase = positions.length / 3;
              for (const [cu, cv, aoMul] of corners) {
                const coord = [0, 0, 0];
                coord[d] = faceCoord;
                coord[u] = cu;
                coord[v] = cv;
                positions.push(
                  offX + coord[0] * voxelSizeX,
                  coord[1] * voxelSizeY,
                  offZ + coord[2] * voxelSizeZ,
                );
                normals.push(norm[0], norm[1], norm[2]);
                colors.push(
                  Math.max(0, Math.min(1, baseR * aoMul)),
                  Math.max(0, Math.min(1, baseG * aoMul)),
                  Math.max(0, Math.min(1, baseB * aoMul)),
                );
                emits.push(emR, emG, emB);
              }

              if (!backFace) {
                indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
              } else {
                indices.push(vBase, vBase + 2, vBase + 1, vBase, vBase + 3, vBase + 2);
              }

              i += w;
            }
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('aNightEmit', new THREE.Float32BufferAttribute(emits, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }
}
