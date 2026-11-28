import { SPECIES_CATALOG } from '../data/catalog';
import { type WorldZoneDef, type ZoneClashWeather } from '../data/worldTour';
import { type SpeciesId } from '../types/pet';

const ZONE_SPRITE_CACHE = new Map<SpeciesId, HTMLImageElement>();

export function getZoneSpriteImg(sp: SpeciesId): HTMLImageElement | null {
  const cached = ZONE_SPRITE_CACHE.get(sp);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  img.src = SPECIES_CATALOG[sp].stageSprites.adult.static;
  ZONE_SPRITE_CACHE.set(sp, img);
  return null;
}

type PuffKind =
  | 'cycloneBright'
  | 'cycloneOuter'
  | 'stormDark'
  | 'stormTop'
  | 'monsoonDark'
  | 'sandCore'
  | 'sandMist'
  | 'blizzardIce'
  | 'firePlume'
  | 'electricCore';

const PUFF_CACHE = new Map<PuffKind, HTMLCanvasElement>();

function hash2d(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Generates an offscreen pixelated meteorological cloud/dust/blizzard/energy puff stamp
 * with organic edges and stepped atmospheric alpha (soft satellite look, crisp pixel art).
 */
function getCloudPuff(kind: PuffKind): HTMLCanvasElement {
  const existing = PUFF_CACHE.get(kind);
  if (existing) return existing;

  const size = 40;
  const half = size / 2;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;

  const palettes: Record<
    PuffKind,
    {
      seed: number;
      core: [number, number, number];
      mid: [number, number, number];
      edge: [number, number, number];
      peakA: number;
    }
  > = {
    cycloneBright: { seed: 11, core: [248, 252, 255], mid: [216, 236, 250], edge: [160, 202, 235], peakA: 0.72 },
    cycloneOuter: { seed: 19, core: [222, 240, 252], mid: [172, 210, 238], edge: [115, 168, 210], peakA: 0.46 },
    stormDark: { seed: 27, core: [32, 40, 58], mid: [54, 66, 90], edge: [84, 98, 124], peakA: 0.7 },
    stormTop: { seed: 35, core: [212, 224, 240], mid: [144, 160, 186], edge: [92, 108, 134], peakA: 0.56 },
    monsoonDark: { seed: 43, core: [38, 60, 82], mid: [72, 104, 132], edge: [122, 160, 188], peakA: 0.64 },
    sandCore: { seed: 51, core: [232, 162, 68], mid: [204, 126, 46], edge: [168, 96, 36], peakA: 0.64 },
    sandMist: { seed: 59, core: [248, 206, 126], mid: [226, 166, 84], edge: [192, 130, 60], peakA: 0.42 },
    blizzardIce: { seed: 67, core: [242, 250, 255], mid: [184, 226, 252], edge: [116, 192, 252], peakA: 0.66 },
    firePlume: { seed: 73, core: [255, 196, 74], mid: [242, 98, 46], edge: [176, 38, 34], peakA: 0.62 },
    electricCore: { seed: 81, core: [177, 151, 252], mid: [103, 65, 217], edge: [48, 32, 112], peakA: 0.62 },
  };

  const p = palettes[kind];
  const step = 2;
  for (let py = 0; py < size; py += step) {
    for (let px = 0; px < size; px += step) {
      const dx = (px + step * 0.5 - half) / (half - 1);
      const dy = (py + step * 0.5 - half) / (half - 1);
      const dist = Math.hypot(dx, dy);
      const jitter =
        (hash2d(px, py, p.seed) - 0.5) * 0.28 + (hash2d(px >> 1, py >> 1, p.seed + 5) - 0.5) * 0.22;
      const d = dist + jitter;
      if (d >= 0.96) continue;

      const t = Math.max(0, 1 - d / 0.96);
      const stepped = Math.ceil(t * 4) / 4;
      const col = d < 0.34 ? p.core : d < 0.66 ? p.mid : p.edge;
      const alpha = stepped * stepped * p.peakA;
      ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${alpha.toFixed(3)})`;
      ctx.fillRect(px, py, step, step);
    }
  }

  PUFF_CACHE.set(kind, cv);
  return cv;
}

function drawPuff(
  ctx: CanvasRenderingContext2D,
  kind: PuffKind,
  cx: number,
  cy: number,
  w: number,
  h = w,
  alpha = 1,
) {
  const img = getCloudPuff(kind);
  const prevA = ctx.globalAlpha;
  if (alpha < 1) ctx.globalAlpha = prevA * alpha;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
  if (alpha < 1) ctx.globalAlpha = prevA;
}

/** Ray-casting point-in-polygon check in 2D */
function pointInPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface RegionCellSample {
  lng: number;
  lat: number;
  /** 0 near west/left edge .. 1 near east/right edge */
  u: number;
  /** 0 near north edge .. 1 near south edge */
  v: number;
  scale: number;
  seed: number;
}

const REGION_SAMPLES_CACHE = new Map<string, RegionCellSample[]>();

/**
 * Deterministically populates the full interior of a geographic region polygon
 * with staggered meteorological cloud/dust/snow cells so weather covers the ACTUAL
 * irregular territory instead of a circular sticker!
 */
function getRegionInteriorSamples(zone: WorldZoneDef): RegionCellSample[] {
  const cached = REGION_SAMPLES_CACHE.get(zone.id);
  if (cached) return cached;

  const poly = zone.regionPolygon;
  if (!poly || poly.length < 3) {
    const fallback: RegionCellSample[] = [
      { lng: zone.centerLng, lat: zone.centerLat, u: 0.5, v: 0.5, scale: 1, seed: 1 },
    ];
    REGION_SAMPLES_CACHE.set(zone.id, fallback);
    return fallback;
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of poly) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const samples: RegionCellSample[] = [];
  const cols = 7;
  const rows = 5;
  const spanLng = Math.max(2, maxLng - minLng);
  const spanLat = Math.max(2, maxLat - minLat);
  const baseSeed = Math.abs(zone.centerLng * 0.43 + zone.centerLat * 0.89);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jitterX = (hash2d(c, r, baseSeed + 1) - 0.5) * 0.65;
      const jitterY = (hash2d(c, r, baseSeed + 9) - 0.5) * 0.65;
      const u = (c + 0.5 + jitterX) / cols;
      const v = (r + 0.5 + jitterY) / rows;
      const lng = minLng + u * spanLng;
      const lat = maxLat - v * spanLat;
      if (pointInPoly(lng, lat, poly)) {
        samples.push({
          lng,
          lat,
          u,
          v,
          scale: 0.78 + hash2d(c, r, baseSeed + 23) * 0.52,
          seed: hash2d(c, r, baseSeed + 37) * 100,
        });
      }
    }
  }

  if (samples.length < 6) {
    samples.push({ lng: zone.centerLng, lat: zone.centerLat, u: 0.5, v: 0.5, scale: 1.15, seed: baseSeed });
  }
  REGION_SAMPLES_CACHE.set(zone.id, samples);
  return samples;
}

/** Traces a smooth organic closed atmospheric front curve through screen polygon points */
function traceSmoothRegionPath(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  const n = pts.length;
  if (n < 3) return;
  ctx.beginPath();
  const startMx = (pts[n - 1][0] + pts[0][0]) * 0.5;
  const startMy = (pts[n - 1][1] + pts[0][1]) * 0.5;
  ctx.moveTo(startMx, startMy);
  for (let i = 0; i < n; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const mx = (curr[0] + next[0]) * 0.5;
    const my = (curr[1] + next[1]) * 0.5;
    ctx.quadraticCurveTo(curr[0], curr[1], mx, my);
  }
  ctx.closePath();
}

function drawForkedLightning(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  len: number,
  seed: number,
  color = '#ffe066',
) {
  ctx.save();
  const segs = 4;
  const stepY = len / segs;
  for (let pass = 0; pass < 2; pass++) {
    let x = x0;
    let y = y0;
    ctx.strokeStyle = pass === 0 ? color : '#fffdf5';
    ctx.lineWidth = pass === 0 ? 3.0 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 1; i <= segs; i++) {
      const dir = ((seed + i) % 2 === 0 ? 1 : -1) * (3 + ((seed * 7 + i * 5) % 4));
      x += dir;
      y += stepY;
      ctx.lineTo(Math.round(x), Math.round(y));
      if (i === 2 && pass === 0) {
        ctx.moveTo(Math.round(x), Math.round(y));
        ctx.lineTo(Math.round(x - dir * 1.4), Math.round(y + stepY * 0.9));
        ctx.moveTo(Math.round(x), Math.round(y));
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

interface RegionScreenGeom {
  pts: [number, number][];
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  w: number;
  h: number;
  cellSz: number;
}

function unwrapX(px: number, refX: number, worldPx: number): number {
  let x = px;
  if (x - refX > worldPx * 0.5) x -= worldPx;
  else if (x - refX < -worldPx * 0.5) x += worldPx;
  return x;
}

function buildRegionGeom(
  zone: WorldZoneDef,
  project: (lng: number, lat: number) => [number, number],
  worldPx: number,
): RegionScreenGeom {
  const [cx, cy] = project(zone.centerLng, zone.centerLat);
  const poly = zone.regionPolygon;
  const pts: [number, number][] = poly
    ? poly.map(([lng, lat]) => {
        const [px, py] = project(lng, lat);
        return [unwrapX(px, cx, worldPx), py];
      })
    : [
        [cx - 48, cy - 28],
        [cx + 48, cy - 28],
        [cx + 48, cy + 28],
        [cx - 48, cy + 28],
      ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const w = Math.max(24, maxX - minX);
  const h = Math.max(24, maxY - minY);
  const cellSz = Math.max(22, Math.min(130, Math.sqrt((w * h) / 14)));
  return { pts, cx, cy, minX, maxX, minY, maxY, w, h, cellSz };
}

/**
 * True irregular polygon hit-test for hovering & clicking regional anomalies
 * (matches the actual territory footprint + badge pill, NOT a circle!).
 */
export function hitTestAnomalyZone(
  sx: number,
  sy: number,
  zones: WorldZoneDef[],
  zoom: number,
  worldPx: number,
  project: (lng: number, lat: number) => [number, number],
): WorldZoneDef | null {
  if (zoom > 9.5) return null;
  for (const zone of zones) {
    if (zone.unlocked || !zone.anomaly) continue;
    const g = buildRegionGeom(zone, project, worldPx);
    const inBadge = sx >= g.cx - 48 && sx <= g.cx + 48 && sy >= g.cy + 8 && sy <= g.cy + 42;
    if (inBadge) return zone;
    if (sx >= g.minX - 6 && sx <= g.maxX + 6 && sy >= g.minY - 6 && sy <= g.maxY + 6) {
      if (pointInPoly(sx, sy, g.pts)) return zone;
    }
  }
  return null;
}

function drawRegionalStormOrMonsoon(
  ctx: CanvasRenderingContext2D,
  samples: RegionCellSample[],
  g: RegionScreenGeom,
  ts: number,
  seed: number,
  isMonsoon: boolean,
  project: (lng: number, lat: number) => [number, number],
) {
  // 1. Soft translucent regional rain-front atmospheric veil clipped to the organic territory shape
  ctx.save();
  traceSmoothRegionPath(ctx, g.pts);
  ctx.fillStyle = isMonsoon ? 'rgba(18, 48, 78, 0.28)' : 'rgba(20, 26, 42, 0.30)';
  ctx.fill();
  ctx.clip();

  // 2. Distributed slanted rain curtains falling across the whole territory
  ctx.strokeStyle = isMonsoon ? 'rgba(165, 216, 255, 0.56)' : 'rgba(182, 206, 236, 0.45)';
  ctx.lineWidth = 1.2;
  const cols = Math.max(8, Math.min(28, Math.round(g.w / 14)));
  const rows = Math.max(3, Math.min(10, Math.round(g.h / 26)));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const phase = ((ts * 0.042 + c * 13 + r * 29 + seed * 7) % 24) / 24;
      const rx = g.minX + ((c + 0.5) / cols) * g.w - phase * 7;
      const ry = g.minY + ((r + phase) / rows) * g.h;
      ctx.beginPath();
      ctx.moveTo(Math.round(rx), Math.round(ry));
      ctx.lineTo(Math.round(rx - 3.5), Math.round(ry + 7));
      ctx.stroke();
    }
  }
  ctx.restore();

  // 3. Drifting multi-cell storm clouds covering the ENTIRE irregular region!
  const baseKind: PuffKind = isMonsoon ? 'monsoonDark' : 'stormDark';
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const [px, py] = project(s.lng, s.lat);
    const driftX = Math.sin(ts * 0.0007 + s.seed) * Math.min(12, g.w * 0.06);
    const driftY = Math.cos(ts * 0.00055 + s.seed * 1.3) * Math.min(6, g.h * 0.04);
    const sz = g.cellSz * s.scale;
    drawPuff(ctx, baseKind, px + driftX, py + driftY + sz * 0.08, sz * 1.35, sz * 0.96, 0.74);
    if (i % 2 === 0) {
      drawPuff(ctx, 'stormTop', px + driftX - sz * 0.08, py + driftY - sz * 0.14, sz * 1.05, sz * 0.78, 0.62);
    }
  }

  // 4. Multiple independent lightning bolts flickering across different cells in the front
  for (let b = 0; b < 2; b++) {
    const cycle = (ts * 0.0024 + seed * 1.7 + b * 1.85) % 3.4;
    if (cycle < 0.36 && samples.length > 0) {
      const idx = (Math.floor(ts * 0.0007 + b * 5 + seed) + b * 3) % samples.length;
      const s = samples[idx];
      const [bx, by] = project(s.lng, s.lat);
      const glowR = Math.max(18, g.cellSz * 0.65);
      const glow = ctx.createRadialGradient(bx, by, 2, bx, by, glowR);
      glow.addColorStop(0, isMonsoon ? 'rgba(186, 230, 255, 0.55)' : 'rgba(255, 244, 180, 0.55)');
      glow.addColorStop(1, 'rgba(255, 244, 180, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, glowR, 0, Math.PI * 2);
      ctx.fill();
      drawForkedLightning(
        ctx,
        bx,
        by,
        Math.max(16, Math.min(36, g.cellSz * 0.65)),
        Math.round(s.seed) + b,
        isMonsoon ? '#a5d8ff' : '#ffe066',
      );
    }
  }
}

function drawRegionalSandstorm(
  ctx: CanvasRenderingContext2D,
  samples: RegionCellSample[],
  g: RegionScreenGeom,
  ts: number,
  seed: number,
  project: (lng: number, lat: number) => [number, number],
) {
  // 1. Warm Saharan / Arabian atmospheric dust blanket shaped to the actual desert polygon
  ctx.save();
  traceSmoothRegionPath(ctx, g.pts);
  ctx.fillStyle = 'rgba(218, 144, 48, 0.28)';
  ctx.fill();
  ctx.clip();

  // 2. Flowing trade-wind dust streaks across the full width of the desert
  const streakCount = Math.max(14, Math.min(36, Math.round((g.w * g.h) / 550)));
  for (let i = 0; i < streakCount; i++) {
    const f = ((ts * 0.00085 + (i * 0.137) + seed * 0.1) % 1);
    const sx = g.minX + f * g.w;
    const sy = g.minY + hash2d(i, 3, seed) * g.h + Math.sin(f * Math.PI * 2 + i) * 3;
    const fade = Math.sin(f * Math.PI);
    ctx.fillStyle = `rgba(255, 232, 163, ${(fade * 0.72).toFixed(2)})`;
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(9 + (i % 4) * 4), 2);
  }
  ctx.restore();

  // 3. Drifting billowing sand plumes moving continuously west-to-east across the desert belt
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const [px, py] = project(s.lng, s.lat);
    const flow = Math.sin(ts * 0.00095 + s.seed) * Math.min(18, g.w * 0.08);
    const sz = g.cellSz * s.scale;
    drawPuff(ctx, i % 2 === 0 ? 'sandCore' : 'sandMist', px + flow, py, sz * 1.65, sz * 0.92, 0.68);
  }
}

function drawRegionalAuroraBlizzard(
  ctx: CanvasRenderingContext2D,
  samples: RegionCellSample[],
  g: RegionScreenGeom,
  ts: number,
  seed: number,
  project: (lng: number, lat: number) => [number, number],
) {
  // 1. Frosted arctic atmospheric veil clipped cleanly to the Nordic fjord region
  ctx.save();
  traceSmoothRegionPath(ctx, g.pts);
  ctx.fillStyle = 'rgba(22, 62, 92, 0.28)';
  ctx.fill();
  ctx.clip();

  // 2. Undulating emerald & violet aurora light ribbons sweeping across the northern sky
  const ribbonCols = Math.max(12, Math.min(34, Math.round(g.w / 7)));
  for (let band = 0; band < 2; band++) {
    const baseY = g.minY + g.h * (0.26 + band * 0.22);
    for (let i = 0; i < ribbonCols; i++) {
      const frac = i / Math.max(1, ribbonCols - 1);
      const x = g.minX + frac * g.w;
      const wave = Math.sin(ts * 0.0022 + frac * 7.5 + band * 2.2 + seed) * Math.min(14, g.h * 0.14);
      const h = Math.round(12 + Math.cos(ts * 0.003 + i * 0.6) * 5);
      const edgeFade = Math.sin(frac * Math.PI);
      ctx.fillStyle =
        band === 0
          ? `rgba(64, 240, 178, ${(0.48 * edgeFade).toFixed(2)})`
          : `rgba(177, 151, 252, ${(0.40 * edgeFade).toFixed(2)})`;
      ctx.fillRect(Math.round(x - 2), Math.round(baseY + wave - h / 2), 4, h);
    }
  }

  // 3. Sweeping diagonal snowflakes across the entire Nordic region
  ctx.fillStyle = 'rgba(240, 250, 255, 0.86)';
  const flakes = Math.max(16, Math.min(40, Math.round((g.w * g.h) / 480)));
  for (let i = 0; i < flakes; i++) {
    const f = ((ts * 0.00095 + i * 0.113 + seed) % 1);
    const fx = g.minX + f * g.w;
    const fy = g.minY + ((hash2d(i, 7, seed) + f * 0.35) % 1) * g.h;
    ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
  }
  ctx.restore();

  // 4. Drifting icy snow clouds across the whole peninsula
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const [px, py] = project(s.lng, s.lat);
    const drift = Math.sin(ts * 0.0008 + s.seed) * 9;
    const sz = g.cellSz * s.scale;
    drawPuff(ctx, 'blizzardIce', px + drift, py, sz * 1.32, sz * 0.9, 0.62);
  }
}

function drawRegionalCyclone(
  ctx: CanvasRenderingContext2D,
  samples: RegionCellSample[],
  g: RegionScreenGeom,
  ts: number,
  spinDir: 1 | -1,
  seed: number,
  project: (lng: number, lat: number) => [number, number],
) {
  // 1. Broad regional monsoon / low-pressure cloud shield across the entire archipelago / sea basin
  ctx.save();
  traceSmoothRegionPath(ctx, g.pts);
  ctx.fillStyle = 'rgba(10, 44, 74, 0.24)';
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const [px, py] = project(s.lng, s.lat);
    const dx = px - g.cx;
    const dy = py - g.cy;
    const ang = Math.atan2(dy, dx) + Math.sin(ts * 0.001 + s.seed) * 0.08 * spinDir;
    const dist = Math.hypot(dx, dy);
    const ox = g.cx + Math.cos(ang) * dist;
    const oy = g.cy + Math.sin(ang) * dist;
    const sz = g.cellSz * s.scale;
    drawPuff(ctx, 'cycloneOuter', ox, oy, sz * 1.4, sz * 1.08, 0.56);
  }

  // 2. Swirling spiral feeder bands embedded naturally inside the broader regional cloud mass
  const coreRad = Math.max(22, Math.min(g.w, g.h) * 0.44);
  const spin = ts * 0.0014 * spinDir;
  for (let arm = 0; arm < 3; arm++) {
    const armBase = spin + (arm * Math.PI * 2) / 3;
    for (let step = 1; step <= 13; step++) {
      const frac = step / 13;
      const r = 5 + Math.pow(frac, 1.05) * coreRad;
      const ang = armBase + frac * 2.75 * spinDir;
      const px = g.cx + Math.cos(ang) * r * 1.08;
      const py = g.cy + Math.sin(ang) * r * 0.86;
      const puffSz = Math.max(12, coreRad * (0.48 - frac * 0.16));
      drawPuff(
        ctx,
        step <= 6 ? 'cycloneBright' : 'cycloneOuter',
        px,
        py,
        puffSz * 1.18,
        puffSz * 0.94,
        Math.max(0.2, 0.86 - frac * 0.44),
      );
    }
  }

  // 3. Eyewall + calm cyclone eye
  const eyeR = Math.max(3.5, Math.min(11, coreRad * 0.12));
  ctx.fillStyle = 'rgba(10, 32, 54, 0.88)';
  ctx.beginPath();
  ctx.arc(g.cx, g.cy, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235, 248, 255, 0.78)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  if (Math.sin(ts * 0.009 + seed) > 0.9) {
    const flashA = spin * 2 + seed;
    ctx.fillStyle = 'rgba(255, 232, 128, 0.92)';
    ctx.fillRect(
      Math.round(g.cx + Math.cos(flashA) * (eyeR + 4)),
      Math.round(g.cy + Math.sin(flashA) * (eyeR + 4)),
      3,
      3,
    );
  }
}

function drawRegionalClashWeather(
  ctx: CanvasRenderingContext2D,
  samples: RegionCellSample[],
  g: RegionScreenGeom,
  ts: number,
  seed: number,
  flavor: ZoneClashWeather,
  project: (lng: number, lat: number) => [number, number],
) {
  if (flavor === 'heat_sandstorm') {
    drawRegionalSandstorm(ctx, samples, g, ts, seed, project);
    // Blazing thermal shimmer core over the clash area
    for (let i = 0; i < samples.length; i += 2) {
      const s = samples[i];
      if (Math.hypot(s.u - 0.5, s.v - 0.5) > 0.36) continue;
      const [px, py] = project(s.lng, s.lat);
      const sz = g.cellSz * s.scale;
      drawPuff(ctx, 'firePlume', px, py, sz * 1.15, sz * 0.9, 0.54);
    }
    return;
  }

  if (flavor === 'rain_storm') {
    drawRegionalStormOrMonsoon(ctx, samples, g, ts, seed, true, project);
    ctx.save();
    traceSmoothRegionPath(ctx, g.pts);
    ctx.fillStyle = 'rgba(43, 138, 62, 0.14)';
    ctx.fill();
    ctx.restore();
    return;
  }

  if (flavor === 'electric_storm') {
    // Full regional thunderhead canopy + electric cloud cells + multi-point lightning
    ctx.save();
    traceSmoothRegionPath(ctx, g.pts);
    ctx.fillStyle = 'rgba(38, 26, 78, 0.30)';
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const [px, py] = project(s.lng, s.lat);
      const drift = Math.sin(ts * 0.001 + s.seed) * 7;
      const sz = g.cellSz * s.scale;
      drawPuff(ctx, i % 3 === 0 ? 'electricCore' : 'stormDark', px + drift, py, sz * 1.32, sz * 0.96, 0.72);
    }
    for (let b = 0; b < 2; b++) {
      const strike = (ts * 0.0036 + seed + b * 1.4) % 2.4;
      if (strike < 0.42 && samples.length > 0) {
        const idx = (Math.floor(ts * 0.001 + b * 4 + seed) + b) % samples.length;
        const [bx, by] = project(samples[idx].lng, samples[idx].lat);
        drawForkedLightning(ctx, bx, by - 6, Math.max(18, g.cellSz * 0.65), Math.round(seed) + b, '#ffe066');
      }
    }
    return;
  }

  if (flavor === 'blizzard') {
    // Wide Siberian polar cold-front snow canopy + blowing snow across the entire region
    ctx.save();
    traceSmoothRegionPath(ctx, g.pts);
    ctx.fillStyle = 'rgba(130, 198, 248, 0.24)';
    ctx.fill();
    ctx.clip();

    ctx.fillStyle = 'rgba(242, 250, 255, 0.9)';
    const flakes = Math.max(22, Math.min(54, Math.round((g.w * g.h) / 420)));
    for (let i = 0; i < flakes; i++) {
      const f = ((ts * 0.00095 + i * 0.097 + seed) % 1);
      const fx = g.minX + f * g.w;
      const fy = g.minY + ((hash2d(i, 11, seed) + f * 0.22) % 1) * g.h;
      ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
    }
    ctx.restore();

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const [px, py] = project(s.lng, s.lat);
      const drift = Math.sin(ts * 0.0008 + s.seed) * Math.min(14, g.w * 0.06);
      const sz = g.cellSz * s.scale;
      drawPuff(ctx, 'blizzardIce', px + drift, py, sz * 1.42, sz * 0.95, 0.72);
    }
    return;
  }

  // 'volcano_blizzard' (Greenland): Western half polar ice-storm + Eastern half fiery ash/ember storm!
  ctx.save();
  traceSmoothRegionPath(ctx, g.pts);
  const splitGrad = ctx.createLinearGradient(g.minX, g.cy, g.maxX, g.cy);
  splitGrad.addColorStop(0, 'rgba(116, 192, 252, 0.28)');
  splitGrad.addColorStop(0.5, 'rgba(255, 224, 130, 0.16)');
  splitGrad.addColorStop(1, 'rgba(224, 49, 49, 0.28)');
  ctx.fillStyle = splitGrad;
  ctx.fill();
  ctx.clip();

  const parts = Math.max(16, Math.min(34, Math.round((g.w * g.h) / 480)));
  for (let i = 0; i < parts; i++) {
    const f = ((ts * 0.0011 + i * 0.13 + seed) % 1);
    const isIce = i % 2 === 0;
    const x = g.minX + (isIce ? f * 0.5 : 0.5 + f * 0.5) * g.w;
    const y = g.minY + hash2d(i, 19, seed) * g.h;
    ctx.fillStyle = isIce ? 'rgba(186, 230, 255, 0.9)' : 'rgba(255, 169, 77, 0.92)';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const [px, py] = project(s.lng, s.lat);
    const drift = Math.sin(ts * 0.0009 + s.seed) * 6;
    const sz = g.cellSz * s.scale;
    drawPuff(ctx, s.u < 0.5 ? 'blizzardIce' : 'firePlume', px + drift, py, sz * 1.35, sz * 1.0, 0.74);
  }
}

export function drawWorldMapAnomalies(params: {
  ctx: CanvasRenderingContext2D;
  zones: WorldZoneDef[];
  zoom: number;
  worldPx: number;
  stageW: number;
  stageH: number;
  ts: number;
  selectedZoneId: string | null;
  hoveredZoneId: string | null;
  cardOpen: boolean;
  project: (lng: number, lat: number) => [number, number];
}) {
  const { ctx, zones, zoom, worldPx, stageW, stageH, ts, selectedZoneId, hoveredZoneId, cardOpen, project } = params;
  if (zoom > 9.5) return;

  for (const zone of zones) {
    if (zone.unlocked || !zone.anomaly) continue;
    const anomaly = zone.anomaly;
    const g = buildRegionGeom(zone, project, worldPx);
    const localProject = (lng: number, lat: number): [number, number] => {
      const [px, py] = project(lng, lat);
      return [unwrapX(px, g.cx, worldPx), py];
    };

    // Frustum cull whole region bounding box
    if (g.maxX < -100 || g.minX > stageW + 100 || g.maxY < -100 || g.minY > stageH + 100) continue;

    const samples = getRegionInteriorSamples(zone);
    const isSelected = cardOpen && selectedZoneId === zone.id;
    const isHovered = hoveredZoneId === zone.id;
    const seed = Math.abs(zone.centerLng * 0.37 + zone.centerLat * 0.71);

    ctx.save();

    // 1. Render full geographic region weather coverage (organic irregular footprint!)
    if (anomaly.kind === 'cyclone') {
      drawRegionalCyclone(ctx, samples, g, ts, anomaly.spinDir ?? -1, seed, localProject);
    } else if (anomaly.kind === 'monsoon') {
      drawRegionalStormOrMonsoon(ctx, samples, g, ts, seed, true, localProject);
    } else if (anomaly.kind === 'storm') {
      drawRegionalStormOrMonsoon(ctx, samples, g, ts, seed, false, localProject);
    } else if (anomaly.kind === 'sandstorm') {
      drawRegionalSandstorm(ctx, samples, g, ts, seed, localProject);
    } else if (anomaly.kind === 'aurora_blizzard') {
      drawRegionalAuroraBlizzard(ctx, samples, g, ts, seed, localProject);
    } else if (anomaly.kind === 'legendary_clash' && anomaly.duelSpecies) {
      drawRegionalClashWeather(ctx, samples, g, ts, seed, anomaly.weatherFlavor ?? 'electric_storm', localProject);

      // Epic battling sprites hovering near the heart of the raging regional storm
      const [leftSp, rightSp] = anomaly.duelSpecies;
      const leftImg = getZoneSpriteImg(leftSp);
      const rightImg = getZoneSpriteImg(rightSp);
      const bobL = Math.sin(ts * 0.0068 + seed) * 2.8;
      const bobR = Math.sin(ts * 0.0068 + seed + Math.PI) * 2.8;
      const lunge = Math.sin(ts * 0.013 + seed) * 2.2;

      const beamColors: Record<ZoneClashWeather, [string, string]> = {
        electric_storm: ['#cc5de8', '#ffd43b'],
        blizzard: ['#a5d8ff', '#4dabf7'],
        volcano_blizzard: ['#74c0fc', '#ff6b35'],
        heat_sandstorm: ['#ffd43b', '#ff595e'],
        rain_storm: ['#f783ac', '#51cf66'],
      };
      const [cL, cR] = beamColors[anomaly.weatherFlavor ?? 'electric_storm'];

      const beamHalf = Math.round(14 + Math.min(8, zoom * 1.1));
      ctx.fillStyle = cL;
      ctx.fillRect(Math.round(g.cx - beamHalf), Math.round(g.cy - 2), beamHalf, 4);
      ctx.fillStyle = cR;
      ctx.fillRect(Math.round(g.cx), Math.round(g.cy - 2), beamHalf, 4);
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(Math.round(g.cx - beamHalf + 3), Math.round(g.cy - 1), beamHalf * 2 - 6, 2);

      const spk = 4 + Math.round(Math.abs(Math.sin(ts * 0.018 + seed)) * 4);
      ctx.fillStyle = '#fff9db';
      ctx.fillRect(Math.round(g.cx - spk / 2), Math.round(g.cy - spk / 2), spk, spk);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(g.cx - spk), Math.round(g.cy - 1), spk * 2, 2);
      ctx.fillRect(Math.round(g.cx - 1), Math.round(g.cy - spk), 2, spk * 2);

      const sprSz = Math.round(26 + Math.min(12, zoom * 1.35));
      const offX = Math.round(16 + Math.min(10, zoom * 1.35));
      if (leftImg) {
        ctx.save();
        ctx.translate(Math.round(g.cx - offX + lunge), Math.round(g.cy + bobL));
        ctx.scale(-1, 1);
        ctx.drawImage(leftImg, -sprSz / 2, -sprSz / 2, sprSz, sprSz);
        ctx.restore();
      }
      if (rightImg) {
        ctx.drawImage(
          rightImg,
          Math.round(g.cx + offX - lunge - sprSz / 2),
          Math.round(g.cy + bobR - sprSz / 2),
          sprSz,
          sprSz,
        );
      }
    }

    // 2. Organic territory contour highlight on hover/select (NEVER a circular ring!)
    if (isHovered || isSelected) {
      traceSmoothRegionPath(ctx, g.pts);
      ctx.strokeStyle = isSelected ? '#ffe066' : 'rgba(255, 243, 191, 0.85)';
      ctx.lineWidth = isSelected ? 2.2 : 1.7;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -(ts * 0.025);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Sleek compact advisory badge centered cleanly within the region
    const badgeText = anomaly.mapBadge;
    ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", monospace';
    const bw = Math.max(68, Math.round(ctx.measureText(badgeText).width + 12));
    const bx = Math.round(g.cx - bw / 2);
    const by = Math.round(g.cy + (anomaly.kind === 'legendary_clash' ? 20 : 12) + (isHovered ? -2 : 0));
    ctx.fillStyle = isSelected ? '#ffe066' : isHovered ? '#fff3bf' : 'rgba(16, 20, 32, 0.86)';
    ctx.fillRect(bx, by, bw, 16);
    ctx.strokeStyle = isHovered || isSelected ? '#161420' : anomaly.accentColor;
    ctx.lineWidth = isHovered || isSelected ? 2 : 1.3;
    ctx.strokeRect(bx, by, bw, 16);
    ctx.fillStyle = isSelected || isHovered ? '#161420' : '#fffdf5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(badgeText, Math.round(g.cx), by + 11.5);

    ctx.restore();
  }
}
