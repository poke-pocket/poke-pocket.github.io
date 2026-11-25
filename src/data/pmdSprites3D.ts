import * as THREE from 'three';
import { PMD_WALK_MANIFEST } from './pmdManifest';

/**
 * Authentic 8-Direction Pokémon Mystery Dungeon (PMD SpriteCollab) Sprite Sheet Loader:
 * - Row 0=S (front), 1=SE, 2=E (right), 3=NE, 4=N (back), 5=NW, 6=W (left), 7=SW
 * - Normalizes every frame across all 8 angles with ONE shared tight bounding box onto a 64x64 canvas
 *   bottom-anchored at y=60, guaranteeing 100% identical visual scale across all 360° camera angles!
 */
export interface Pmd8DirSheet3D {
  /** rows[dirIdx][frameIdx] where dirIdx is 0..7 (S, SE, E, NE, N, NW, W, SW) */
  rows: THREE.Texture[][];
  durations: number[]; // seconds per frame
  totalDuration: number;
  ready: boolean;
}

const pmdCache = new Map<string, Pmd8DirSheet3D>();

function makeFallbackTexture(url: string): THREE.Texture {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function extractDexIdFromSpriteUrl(url: string): string | null {
  const m = url.match(/\/sprites\/pokemon\/(\d+)\.(?:png|gif)/);
  return m ? m[1] : null;
}

function applyShinyHueShift(ctx: CanvasRenderingContext2D, w: number, h: number, dexId: string) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // Deterministic vibrant shiny hue rotation per species (never washes out dark outlines or pure white eyes!)
  const idNum = Number(dexId) || 25;
  const hueDeg = ((idNum * 73 + 115) % 220) + 65; // distinct 65°..285° shift
  const rad = (hueDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const m00 = 0.213 + cosA * 0.787 - sinA * 0.213;
  const m01 = 0.715 - cosA * 0.715 - sinA * 0.715;
  const m02 = 0.072 - cosA * 0.072 + sinA * 0.928;
  const m10 = 0.213 - cosA * 0.213 + sinA * 0.143;
  const m11 = 0.715 + cosA * 0.285 + sinA * 0.140;
  const m12 = 0.072 - cosA * 0.072 - sinA * 0.283;
  const m20 = 0.213 - cosA * 0.213 - sinA * 0.787;
  const m21 = 0.715 - cosA * 0.715 + sinA * 0.715;
  const m22 = 0.072 + cosA * 0.928 + sinA * 0.072;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 20) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    // Preserve crisp dark pixel outlines & pure white highlights
    if (maxC < 44 || (maxC - minC < 18 && maxC > 210)) continue;
    const nr = Math.min(255, Math.max(0, Math.round(r * m00 + g * m01 + b * m02)));
    const ng = Math.min(255, Math.max(0, Math.round(r * m10 + g * m11 + b * m12)));
    const nb = Math.min(255, Math.max(0, Math.round(r * m20 + g * m21 + b * m22)));
    // Slight vibrant boost so Shiny stands out immediately in sunlight
    d[i] = Math.min(255, Math.round(nr * 1.06));
    d[i + 1] = Math.min(255, Math.round(ng * 1.06));
    d[i + 2] = Math.min(255, Math.round(nb * 1.06));
  }
  ctx.putImageData(img, 0, 0);
}

/** Authentic 8-direction mid-air flying/gliding sheets for winged flyers (no air-walking!) */
const PMD_FLIGHT_MANIFEST: Record<string, { fw: number; fh: number; durs: number[]; file: string }> = {
  '6': { fw: 48, fh: 48, durs: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], file: '/sprites/pmd/6-fly.png' }, // Charizard soaring flight
  '149': { fw: 48, fh: 56, durs: [5, 5, 5, 5, 5, 5], file: '/sprites/pmd/149-fly.png' }, // Dragonite wing-flap flight
};

export function getPmd8DirSheet(
  dexId: string,
  fallbackStaticUrl: string,
  isShiny = false,
): Pmd8DirSheet3D | undefined {
  const flightMeta = PMD_FLIGHT_MANIFEST[dexId];
  const meta = flightMeta ?? PMD_WALK_MANIFEST[dexId];
  if (!meta) return undefined;
  const spriteUrl = flightMeta ? flightMeta.file : `/sprites/pmd/${dexId}-walk.png`;
  const cacheKey = isShiny ? `${dexId}_shiny` : dexId;
  const cached = pmdCache.get(cacheKey);
  if (cached) return cached;

  const fallbackTex = makeFallbackTexture(fallbackStaticUrl);
  // 60fps PMD frame durations -> seconds (typically ~0.12s - 0.16s per walk frame)
  const durations = meta.durs.length > 0 ? meta.durs.map((d) => Math.max(0.07, d / 54)) : [0.14];
  const totalDuration = durations.reduce((a, b) => a + b, 0);

  const sheet: Pmd8DirSheet3D = {
    rows: Array.from({ length: 8 }, () => [fallbackTex]),
    durations,
    totalDuration,
    ready: false,
  };
  pmdCache.set(cacheKey, sheet);

  if (typeof window !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const fw = meta.fw;
        const fh = meta.fh;
        const cols = Math.max(1, Math.floor(img.naturalWidth / fw));
        const availRows = Math.max(1, Math.floor(img.naturalHeight / fh));

        // 1. Draw full sheet to offscreen canvas once and compute ONE unified tight bounding box
        //    across ALL cells so every single angle has 100% consistent visual size!
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.naturalWidth;
        srcCanvas.height = img.naturalHeight;
        const sctx = srcCanvas.getContext('2d')!;
        sctx.imageSmoothingEnabled = false;
        sctx.drawImage(img, 0, 0);
        if (isShiny) {
          applyShinyHueShift(sctx, srcCanvas.width, srcCanvas.height, dexId);
        }
        const fullImg = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;

        let maxVisW = 12;
        let maxVisH = 12;
        const cellBoxes: { minX: number; minY: number; maxX: number; maxY: number }[][] = [];
        for (let r = 0; r < availRows; r++) {
          const rowBoxes: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
          for (let c = 0; c < cols; c++) {
            let minX = fw;
            let minY = fh;
            let maxX = -1;
            let maxY = -1;
            const ox = c * fw;
            const oy = r * fh;
            for (let y = 0; y < fh; y++) {
              const rowOff = (oy + y) * srcCanvas.width;
              for (let x = 0; x < fw; x++) {
                if (fullImg[(rowOff + ox + x) * 4 + 3] > 20) {
                  if (x < minX) minX = x;
                  if (y < minY) minY = y;
                  if (x > maxX) maxX = x;
                  if (y > maxY) maxY = y;
                }
              }
            }
            if (maxX >= minX && maxY >= minY) {
              const vw = maxX - minX + 1;
              const vh = maxY - minY + 1;
              if (vw > maxVisW) maxVisW = vw;
              if (vh > maxVisH) maxVisH = vh;
              rowBoxes.push({ minX, minY, maxX, maxY });
            } else {
              rowBoxes.push({ minX: 0, minY: 0, maxX: fw - 1, maxY: fh - 1 });
            }
          }
          cellBoxes.push(rowBoxes);
        }

        // Uniform integer-friendly scale into 64x64 normalized canvas (bottom-anchored at y=60!)
        const OUT = 64;
        const scale = Math.min(48 / maxVisH, 52 / maxVisW);

        const nextRows: THREE.Texture[][] = [];
        for (let dir = 0; dir < 8; dir++) {
          const rIdx = Math.min(dir, availRows - 1);
          const rowTexs: THREE.Texture[] = [];
          for (let c = 0; c < cols; c++) {
            const box = cellBoxes[rIdx][c];
            const vw = box.maxX - box.minX + 1;
            const vh = box.maxY - box.minY + 1;
            const dw = Math.max(1, Math.round(vw * scale));
            const dh = Math.max(1, Math.round(vh * scale));
            const dx = Math.round((OUT - dw) / 2);
            const dy = Math.max(2, Math.round(60 - dh));

            const outC = document.createElement('canvas');
            outC.width = OUT;
            outC.height = OUT;
            const octx = outC.getContext('2d')!;
            octx.imageSmoothingEnabled = false;
            octx.drawImage(
              srcCanvas,
              c * fw + box.minX,
              rIdx * fh + box.minY,
              vw,
              vh,
              dx,
              dy,
              dw,
              dh,
            );
            const tex = new THREE.CanvasTexture(outC);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            tex.colorSpace = THREE.SRGBColorSpace;
            rowTexs.push(tex);
          }
          nextRows.push(rowTexs);
        }

        sheet.rows = nextRows;
        sheet.ready = true;
      } catch {
        // fallback stays active gracefully
      }
    };
    img.src = spriteUrl;
  }

  return sheet;
}

/**
 * Maps an entity's camera-relative facing vector (relFwd, relRight) to the exact PMD 8-direction row:
 * 0=S (front), 1=SE, 2=E (right), 3=NE, 4=N (back), 5=NW, 6=W (left), 7=SW
 */
export function pickPmdDirIndex(relFwd: number, relRight: number): number {
  const ang = Math.atan2(relRight, -relFwd);
  return ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
}

export function samplePmd8DirFrame(
  sheet: Pmd8DirSheet3D,
  dirIdx: number,
  timeSec: number,
): THREE.Texture {
  const row = sheet.rows[dirIdx] ?? sheet.rows[0];
  if (row.length <= 1) return row[0];
  let t = ((timeSec % sheet.totalDuration) + sheet.totalDuration) % sheet.totalDuration;
  for (let i = 0; i < row.length; i++) {
    const dur = sheet.durations[i] ?? 0.14;
    if (t < dur) return row[i];
    t -= dur;
  }
  return row[0];
}
