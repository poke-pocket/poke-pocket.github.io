import * as THREE from 'three';
import { VoxelGrid3D, getSharedVoxelArchMaterial } from './voxelMesher3D';

/**
 * Native MagicaVoxel `.vox` Binary Parser & Greedy-Meshed Loader (`原生 MagicaVoxel .vox 加载器`):
 * - Parses authentic artist-crafted `.vox` files (RIFF `VOX ` v150 `SIZE` + `XYZI` + `RGBA`).
 * - Crops tight occupied voxel bounds so every model sits flush on `y = 0` and centered on `(x = 0, z = 0)`.
 * - Converts MagicaVoxel `Z-up` (`x, y, z`) to Three.js `Y-up` (`x, z, y`) cleanly.
 * - Automatically detects luminous bulb/signal/headlight voxels for `aNightEmit` nighttime glow,
 *   supports body-color re-tinting (e.g. varied cars, benches, newsboxes), and compiles each `.vox` file
 *   into a single cached `BufferGeometry` with baked 4-corner MagicaVoxel Ambient Occlusion!
 */

// Compact 256-entry MagicaVoxel official default palette fallback (used only when a `.vox` omits an `RGBA` chunk)
const DEFAULT_VOX_PALETTE: Uint32Array = (() => {
  const p = new Uint32Array(256);
  let idx = 0;
  const levels = [0xff, 0xcc, 0x99, 0x66, 0x33, 0x00];
  for (let r = 0; r < 6 && idx < 216; r++) {
    for (let g = 0; g < 6 && idx < 216; g++) {
      for (let b = 0; b < 6 && idx < 216; b++) {
        p[idx++] = (levels[r] << 16) | (levels[g] << 8) | levels[b];
      }
    }
  }
  while (idx < 256) {
    const v = Math.max(8, Math.round(((255 - idx) / 40) * 240));
    p[idx++] = (v << 16) | (v << 8) | v;
  }
  return p;
})();

export interface ParsedVoxData {
  nx: number;
  ny: number; // Three.js height (MagicaVoxel Z)
  nz: number; // Three.js depth (MagicaVoxel Y)
  voxels: { x: number; y: number; z: number; rgb: number; emit: number }[];
  dominantBodyRgb: number;
}

const PARSED_VOX_CACHE = new Map<string, Promise<ParsedVoxData | null>>();
const BUILT_VOX_GEO_CACHE = new Map<string, THREE.BufferGeometry>();

function detectAutoNightEmit(rgb: number, mode: 'none' | 'lamp' | 'vehicle' | 'traffic'): number {
  if (mode === 'none') return 0;
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  if (mode === 'lamp') {
    // Warm yellow/cream MagicaVoxel lantern filaments (`#fccc64`, `#cccc98`, `#fcfc30`)
    if (r >= 195 && g >= 185 && b <= 165 && r >= b + 30) {
      return 0xffe066;
    }
  } else if (mode === 'traffic') {
    if (g >= 210 && r <= 80) return 0x51cf66;
    if (r >= 210 && g <= 80) return 0xff4d4f;
    if (r >= 195 && g >= 185 && b <= 160) return 0xffd43b;
  } else if (mode === 'vehicle') {
    // Bright headlights / roof taxi sign / red taillights
    if (r >= 240 && g >= 200 && b <= 60) return 0xffe066;
    if (r >= 220 && g <= 55 && b <= 55) return 0xff4d4f;
  }
  return 0;
}

export function parseVoxBinary(buffer: ArrayBuffer): ParsedVoxData | null {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20) return null;
  const magic =
    String.fromCharCode(view.getUint8(0)) +
    String.fromCharCode(view.getUint8(1)) +
    String.fromCharCode(view.getUint8(2)) +
    String.fromCharCode(view.getUint8(3));
  if (magic !== 'VOX ') return null;

  const rawPts: { x: number; y: number; z: number; c: number }[] = [];
  let palette: Uint32Array | null = null;

  const walkChunks = (offset: number, end: number) => {
    while (offset + 12 <= end) {
      const cid =
        String.fromCharCode(view.getUint8(offset)) +
        String.fromCharCode(view.getUint8(offset + 1)) +
        String.fromCharCode(view.getUint8(offset + 2)) +
        String.fromCharCode(view.getUint8(offset + 3));
      const contentBytes = view.getUint32(offset + 4, true);
      const childrenBytes = view.getUint32(offset + 8, true);
      const contentStart = offset + 12;

      if (cid === 'XYZI' && rawPts.length === 0 && contentStart + 4 <= end) {
        const numVoxels = view.getUint32(contentStart, true);
        const maxSafe = Math.min(numVoxels, Math.floor((end - (contentStart + 4)) / 4));
        for (let i = 0; i < maxSafe; i++) {
          const base = contentStart + 4 + i * 4;
          rawPts.push({
            x: view.getUint8(base),
            y: view.getUint8(base + 1),
            z: view.getUint8(base + 2),
            c: view.getUint8(base + 3),
          });
        }
      } else if (cid === 'RGBA' && contentStart + 1024 <= end) {
        palette = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          const bOff = contentStart + i * 4;
          const r = view.getUint8(bOff);
          const g = view.getUint8(bOff + 1);
          const b = view.getUint8(bOff + 2);
          palette[i] = (r << 16) | (g << 8) | b;
        }
      }

      if (childrenBytes > 0) {
        walkChunks(contentStart + contentBytes, Math.min(end, contentStart + contentBytes + childrenBytes));
      }
      offset = contentStart + contentBytes + childrenBytes;
    }
  };

  walkChunks(8, buffer.byteLength);
  if (rawPts.length === 0) return null;

  const pal = palette ?? DEFAULT_VOX_PALETTE;
  let minX = 9999;
  let maxX = -9999;
  let minY = 9999;
  let maxY = -9999;
  let minZ = 9999;
  let maxZ = -9999;
  const colorCounts = new Map<number, number>();

  for (let i = 0; i < rawPts.length; i++) {
    const p = rawPts[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
    const rgb = pal[Math.max(0, Math.min(255, p.c - 1))];
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    // Track dominant chromatic/light body color (ignoring dark tires/asphalt `#202020..#545454`)
    const maxCh = Math.max(r, g, b);
    const minCh = Math.min(r, g, b);
    if (maxCh > 95 && (maxCh - minCh > 24 || maxCh > 190)) {
      colorCounts.set(rgb, (colorCounts.get(rgb) ?? 0) + 1);
    }
  }

  let dominantBodyRgb = 0x3098cc;
  let bestCnt = 0;
  for (const [rgb, cnt] of colorCounts) {
    if (cnt > bestCnt) {
      bestCnt = cnt;
      dominantBodyRgb = rgb;
    }
  }

  const nx = maxX - minX + 1;
  const ny = maxZ - minZ + 1; // MagicaVoxel Z -> Three.js Y (up)
  const nz = maxY - minY + 1; // MagicaVoxel Y -> Three.js Z (forward)

  const voxels = rawPts.map((p) => ({
    x: p.x - minX,
    y: p.z - minZ,
    z: p.y - minY,
    rgb: pal[Math.max(0, Math.min(255, p.c - 1))],
    emit: 0,
  }));

  return { nx, ny, nz, voxels, dominantBodyRgb };
}

export function loadParsedVox(url: string): Promise<ParsedVoxData | null> {
  const cached = PARSED_VOX_CACHE.get(url);
  if (cached) return cached;
  const p = fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .then((buf) => (buf ? parseVoxBinary(buf) : null))
    .catch(() => null);
  PARSED_VOX_CACHE.set(url, p);
  return p;
}

function blendTintRgb(origRgb: number, targetRgb: number, strength: number): number {
  const r0 = (origRgb >> 16) & 255;
  const g0 = (origRgb >> 8) & 255;
  const b0 = origRgb & 255;
  const r1 = (targetRgb >> 16) & 255;
  const g1 = (targetRgb >> 8) & 255;
  const b1 = targetRgb & 255;
  const r = Math.round(r0 + (r1 - r0) * strength);
  const g = Math.round(g0 + (g1 - g0) * strength);
  const b = Math.round(b0 + (b1 - b0) * strength);
  return (r << 16) | (g << 8) | b;
}

export interface MountVoxOptions {
  x?: number;
  y?: number;
  z?: number;
  rotY?: number;
  /** Scale uniformly so longest horizontal span (`max(nx, nz)`) equals `targetSpan` world units */
  targetSpan?: number;
  /** Or scale uniformly so total height (`ny`) equals `targetHeight` world units */
  targetHeight?: number;
  /** Explicit world size of 1 voxel cube (overrides `targetSpan`/`targetHeight` if provided) */
  voxelSize?: number;
  /** Optional primary body re-tint color (`0xRRGGBB`) */
  tintHex?: number;
  /** Optional automatic night-emissive detection mode */
  emitMode?: 'none' | 'lamp' | 'vehicle' | 'traffic';
  onMounted?: (mesh: THREE.Mesh, size: { w: number; h: number; d: number }) => void;
}

export async function mountVoxModel(
  parent: THREE.Object3D,
  url: string,
  opts: MountVoxOptions = {},
): Promise<THREE.Mesh | null> {
  const parsed = await loadParsedVox(url);
  if (!parsed) return null;

  const emitMode = opts.emitMode ?? 'none';
  const vs =
    opts.voxelSize ??
    (opts.targetHeight !== undefined
      ? opts.targetHeight / Math.max(1, parsed.ny)
      : (opts.targetSpan ?? 2.0) / Math.max(1, Math.max(parsed.nx, parsed.nz)));

  const cacheKey = `${url}|vs=${vs.toFixed(4)}|tint=${opts.tintHex ?? -1}|em=${emitMode}`;
  let geo = BUILT_VOX_GEO_CACHE.get(cacheKey);
  if (!geo) {
    const grid = new VoxelGrid3D(parsed.nx, parsed.ny, parsed.nz);
    for (let i = 0; i < parsed.voxels.length; i++) {
      const v = parsed.voxels[i];
      let rgb = v.rgb;
      if (opts.tintHex !== undefined && v.rgb === parsed.dominantBodyRgb) {
        rgb = blendTintRgb(v.rgb, opts.tintHex, 0.82);
      }
      const emit = detectAutoNightEmit(v.rgb, emitMode);
      grid.set(v.x, v.y, v.z, rgb, emit);
    }
    geo = grid.toGreedyGeometry(vs);
    BUILT_VOX_GEO_CACHE.set(cacheKey, geo);
  }

  const mesh = new THREE.Mesh(geo, getSharedVoxelArchMaterial());
  mesh.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  mesh.rotation.y = opts.rotY ?? 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  opts.onMounted?.(mesh, {
    w: parsed.nx * vs,
    h: parsed.ny * vs,
    d: parsed.nz * vs,
  });
  return mesh;
}
