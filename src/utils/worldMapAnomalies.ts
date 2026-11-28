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
 * Generates an offscreen pixelated meteorological cloud/mist/vortex puff stamp.
 * Uses 2px quantized steps + organic irregular silhouette + stepped atmospheric alpha
 * so clouds look soft, voluminous, and satellite-authentic while staying crisp pixel art.
 */
function getCloudPuff(kind: PuffKind): HTMLCanvasElement {
  const existing = PUFF_CACHE.get(kind);
  if (existing) return existing;

  const size = 36;
  const half = size / 2;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;

  const palettes: Record<
    PuffKind,
    { seed: number; core: [number, number, number]; mid: [number, number, number]; edge: [number, number, number]; peakA: number }
  > = {
    cycloneBright: { seed: 11, core: [248, 252, 255], mid: [218, 236, 250], edge: [165, 205, 236], peakA: 0.72 },
    cycloneOuter: { seed: 19, core: [224, 240, 252], mid: [176, 212, 238], edge: [118, 170, 212], peakA: 0.48 },
    stormDark: { seed: 27, core: [36, 44, 62], mid: [58, 70, 94], edge: [88, 102, 128], peakA: 0.74 },
    stormTop: { seed: 35, core: [212, 222, 238], mid: [148, 162, 186], edge: [96, 110, 136], peakA: 0.62 },
    monsoonDark: { seed: 43, core: [42, 62, 84], mid: [78, 106, 132], edge: [128, 162, 188], peakA: 0.68 },
    sandCore: { seed: 51, core: [232, 164, 72], mid: [204, 128, 48], edge: [168, 98, 36], peakA: 0.68 },
    sandMist: { seed: 59, core: [248, 206, 128], mid: [226, 166, 86], edge: [194, 132, 62], peakA: 0.44 },
    blizzardIce: { seed: 67, core: [242, 250, 255], mid: [184, 226, 252], edge: [116, 192, 252], peakA: 0.68 },
    firePlume: { seed: 73, core: [255, 196, 74], mid: [244, 102, 48], edge: [176, 38, 34], peakA: 0.64 },
    electricCore: { seed: 81, core: [177, 151, 252], mid: [103, 65, 217], edge: [48, 32, 112], peakA: 0.66 },
  };

  const p = palettes[kind];
  const step = 2;
  for (let py = 0; py < size; py += step) {
    for (let px = 0; px < size; px += step) {
      const dx = (px + step * 0.5 - half) / (half - 1);
      const dy = (py + step * 0.5 - half) / (half - 1);
      const dist = Math.hypot(dx, dy);
      const jitter = (hash2d(px, py, p.seed) - 0.5) * 0.28 + (hash2d(px >> 1, py >> 1, p.seed + 5) - 0.5) * 0.22;
      const d = dist + jitter;
      if (d >= 0.96) continue;

      const t = Math.max(0, 1 - d / 0.96);
      // 4 crisp atmospheric alpha steps for refined pixel-art softness
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

function drawForkedLightning(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  len: number,
  seed: number,
  color = '#ffe066',
) {
  ctx.save();
  let x = x0;
  let y = y0;
  const segs = 4;
  const stepY = len / segs;

  // Outer glow pass + bright inner core pass
  for (let pass = 0; pass < 2; pass++) {
    x = x0;
    y = y0;
    ctx.strokeStyle = pass === 0 ? color : '#fffdf5';
    ctx.lineWidth = pass === 0 ? 3.2 : 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 1; i <= segs; i++) {
      const dir = ((seed + i) % 2 === 0 ? 1 : -1) * (3 + ((seed * 7 + i * 5) % 4));
      x += dir;
      y += stepY;
      ctx.lineTo(Math.round(x), Math.round(y));
      if (i === 2 && pass === 0) {
        // Fork branch
        ctx.moveTo(Math.round(x), Math.round(y));
        ctx.lineTo(Math.round(x - dir * 1.4), Math.round(y + stepY * 0.95));
        ctx.moveTo(Math.round(x), Math.round(y));
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCycloneSystem(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  rad: number,
  ts: number,
  spinDir: 1 | -1,
  seed: number,
  accentTint: 'tropical' | 'oceanic',
) {
  const spin = ts * 0.00145 * spinDir;

  // Subtle low-pressure shadow beneath the cyclone
  const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad * 1.25);
  grad.addColorStop(0, accentTint === 'tropical' ? 'rgba(9, 42, 68, 0.42)' : 'rgba(12, 52, 92, 0.38)');
  grad.addColorStop(0.65, 'rgba(14, 48, 78, 0.16)');
  grad.addColorStop(1, 'rgba(14, 48, 78, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(sx, sy, rad * 1.25, 0, Math.PI * 2);
  ctx.fill();

  // 3 lush satellite-style logarithmic spiral cloud feeder bands
  for (let arm = 0; arm < 3; arm++) {
    const armBase = spin + (arm * Math.PI * 2) / 3;
    for (let step = 1; step <= 14; step++) {
      const frac = step / 14;
      const r = 6 + Math.pow(frac, 1.05) * (rad * 0.96);
      const ang = armBase + frac * 2.85 * spinDir;
      const px = sx + Math.cos(ang) * r;
      const py = sy + Math.sin(ang) * r * 0.86;
      const puffSz = Math.max(10, rad * (0.44 - frac * 0.16));
      const kind: PuffKind = step <= 6 ? 'cycloneBright' : 'cycloneOuter';
      const alpha = step <= 5 ? 0.86 : 0.82 - frac * 0.42;
      drawPuff(ctx, kind, px, py, puffSz * 1.15, puffSz * 0.92, Math.max(0.18, alpha));
    }
  }

  // Dense swirling inner eyewall ring
  for (let i = 0; i < 8; i++) {
    const a = -spin * 1.4 + (i * Math.PI * 2) / 8;
    const r = Math.max(5.5, rad * 0.18);
    drawPuff(ctx, 'cycloneBright', sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.88, rad * 0.34, rad * 0.3, 0.85);
  }

  // Crisp dark typhoon eye center
  const eyeR = Math.max(3.5, rad * 0.11);
  ctx.fillStyle = 'rgba(10, 32, 54, 0.88)';
  ctx.beginPath();
  ctx.arc(sx, sy, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235, 248, 255, 0.72)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Rare warm electrical glimmer inside the eyewall
  if (Math.sin(ts * 0.009 + seed) > 0.9) {
    const flashA = spin * 2 + seed;
    ctx.fillStyle = 'rgba(255, 232, 128, 0.92)';
    ctx.fillRect(Math.round(sx + Math.cos(flashA) * (eyeR + 4)), Math.round(sy + Math.sin(flashA) * (eyeR + 4)), 3, 3);
  }
}

function drawStormOrMonsoonSystem(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  rad: number,
  ts: number,
  seed: number,
  isMonsoon: boolean,
) {
  const driftX = Math.sin(ts * 0.0009 + seed) * 6;
  const driftY = Math.cos(ts * 0.0007 + seed) * 2.5;
  const cx = sx + driftX;
  const cy = sy + driftY;

  // Soft storm rain-shadow footprint on the land below
  const shadow = ctx.createRadialGradient(cx, cy + 4, 4, cx, cy + 4, rad * 1.2);
  shadow.addColorStop(0, isMonsoon ? 'rgba(18, 42, 68, 0.42)' : 'rgba(20, 24, 38, 0.46)');
  shadow.addColorStop(1, 'rgba(20, 24, 38, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, rad * 1.25, rad * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  // Slanted animated pixel rain sheets beneath the storm front
  ctx.save();
  ctx.strokeStyle = isMonsoon ? 'rgba(165, 216, 255, 0.65)' : 'rgba(180, 204, 232, 0.52)';
  ctx.lineWidth = 1.2;
  const rainCount = isMonsoon ? 16 : 10;
  for (let i = 0; i < rainCount; i++) {
    const phase = ((ts * 0.045 + i * 17 + seed * 11) % 24) / 24;
    const rx = cx + ((i - rainCount / 2) / (rainCount / 2)) * rad * 0.72 - phase * 6;
    const ry = cy + 2 + phase * (rad * 0.52);
    ctx.beginPath();
    ctx.moveTo(Math.round(rx), Math.round(ry));
    ctx.lineTo(Math.round(rx - 3), Math.round(ry + 6));
    ctx.stroke();
  }
  ctx.restore();

  // Organic multi-cell dark storm base + billowing sunlit anvil cloud tops
  const baseKind: PuffKind = isMonsoon ? 'monsoonDark' : 'stormDark';
  const puffs = [
    [-0.58, 0.08, 0.68, baseKind, 0.85],
    [-0.22, 0.12, 0.78, baseKind, 0.92],
    [0.24, 0.1, 0.76, baseKind, 0.92],
    [0.58, 0.06, 0.64, baseKind, 0.82],
    [-0.36, -0.18, 0.66, 'stormTop', 0.86],
    [0.02, -0.24, 0.76, 'stormTop', 0.92],
    [0.38, -0.16, 0.62, 'stormTop', 0.84],
    [-0.08, -0.34, 0.52, 'cycloneBright', 0.58],
    [0.22, -0.3, 0.44, 'cycloneBright', 0.52],
  ] as const;

  for (let i = 0; i < puffs.length; i++) {
    const [ox, oy, sc, kind, a] = puffs[i];
    const bob = Math.sin(ts * 0.0018 + i * 1.3 + seed) * 1.8;
    drawPuff(ctx, kind, cx + ox * rad, cy + oy * rad + bob, rad * sc * 1.12, rad * sc * 0.84, a);
  }

  // Brief cloud-illuminating internal flash + forked lightning bolt
  const cycle = (ts * 0.0026 + seed * 1.7) % 3.4;
  if (cycle < 0.42) {
    const boltIdx = Math.floor((ts * 0.0008 + seed) % 3);
    const bx = cx + (boltIdx - 1) * rad * 0.34;
    const by = cy + rad * 0.04;
    // Soft internal cloud glow during lightning strike
    const glow = ctx.createRadialGradient(bx, cy - rad * 0.08, 2, bx, cy - rad * 0.08, rad * 0.55);
    glow.addColorStop(0, 'rgba(255, 245, 190, 0.55)');
    glow.addColorStop(1, 'rgba(255, 245, 190, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bx, cy - rad * 0.08, rad * 0.55, 0, Math.PI * 2);
    ctx.fill();
    drawForkedLightning(ctx, bx, by, Math.max(18, rad * 0.56), Math.round(seed) + boltIdx, isMonsoon ? '#a5d8ff' : '#ffe066');
  }
}

function drawSandstormSystem(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  rad: number,
  ts: number,
  seed: number,
) {
  // Warm hazy Saharan/Arabian dust dome
  const haze = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad * 1.3);
  haze.addColorStop(0, 'rgba(217, 138, 43, 0.45)');
  haze.addColorStop(0.65, 'rgba(232, 168, 76, 0.22)');
  haze.addColorStop(1, 'rgba(232, 168, 76, 0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rad * 1.35, rad * 0.9, -0.18, 0, Math.PI * 2);
  ctx.fill();

  // Flowing dust plumes streaming along prevailing trade wind
  for (let i = 0; i < 11; i++) {
    const flow = ((ts * 0.00055 + i / 11 + seed * 0.13) % 1);
    const x = sx + (flow - 0.5) * rad * 1.95;
    const bandY = ((i % 3) - 1) * rad * 0.28 + Math.sin(flow * Math.PI * 2 + i) * 5;
    const fade = Math.sin(flow * Math.PI);
    const sz = rad * (0.48 + (i % 3) * 0.12);
    drawPuff(ctx, i % 2 === 0 ? 'sandCore' : 'sandMist', x, sy + bandY, sz * 1.45, sz * 0.78, fade * 0.85);
  }

  // Crisp windblown golden sand streaks
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const f = ((ts * 0.0012 + i * 0.17 + seed) % 1);
    const x = sx + (f - 0.5) * rad * 1.85;
    const y = sy + (((i * 29) % 100) / 100 - 0.5) * rad * 1.1;
    const fade = Math.sin(f * Math.PI);
    ctx.fillStyle = `rgba(255, 232, 163, ${(fade * 0.78).toFixed(2)})`;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(8 + (i % 4) * 3), 2);
  }
  ctx.restore();
}

function drawAuroraBlizzardSystem(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  rad: number,
  ts: number,
  seed: number,
) {
  // Shimmering emerald & violet polar aurora curtains waving overhead
  ctx.save();
  for (let band = 0; band < 2; band++) {
    const baseOffY = -rad * (0.28 + band * 0.2);
    for (let i = -8; i <= 8; i++) {
      const frac = i / 8;
      const x = sx + frac * rad * 1.05;
      const wave = Math.sin(ts * 0.0024 + i * 0.55 + band * 2.1 + seed) * 6;
      const h = Math.round(12 + Math.cos(ts * 0.003 + i * 0.7) * 5);
      const edgeFade = 1 - Math.abs(frac) * 0.8;
      ctx.fillStyle =
        band === 0
          ? `rgba(64, 240, 178, ${(0.44 * edgeFade).toFixed(2)})`
          : `rgba(177, 151, 252, ${(0.38 * edgeFade).toFixed(2)})`;
      ctx.fillRect(Math.round(x - 2), Math.round(sy + baseOffY + wave - h / 2), 4, h);
    }
  }
  ctx.restore();

  // Swirling polar blizzard snow clouds below
  const spin = ts * 0.0011;
  for (let i = 0; i < 9; i++) {
    const a = spin + (i * Math.PI * 2) / 9;
    const r = rad * (0.22 + (i % 3) * 0.22);
    drawPuff(ctx, 'blizzardIce', sx + Math.cos(a) * r * 1.2, sy + 6 + Math.sin(a) * r * 0.65, rad * 0.55, rad * 0.42, 0.74);
  }

  // Sweeping pixel snow crystals
  ctx.fillStyle = 'rgba(240, 250, 255, 0.88)';
  for (let i = 0; i < 14; i++) {
    const f = ((ts * 0.0011 + i * 0.13 + seed) % 1);
    const fx = sx + (f - 0.5) * rad * 1.65;
    const fy = sy - rad * 0.2 + ((i * 23) % 100) / 100 * rad * 0.95 + Math.sin(f * 6 + i) * 3;
    ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
  }
}

function drawClashWeatherBackdrop(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  rad: number,
  ts: number,
  seed: number,
  flavor: ZoneClashWeather,
) {
  if (flavor === 'electric_storm') {
    const spin = ts * 0.0016;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad * 1.3);
    glow.addColorStop(0, 'rgba(121, 80, 242, 0.45)');
    glow.addColorStop(0.55, 'rgba(34, 32, 68, 0.36)');
    glow.addColorStop(1, 'rgba(34, 32, 68, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 1.3, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 10; i++) {
      const a = spin + (i * Math.PI * 2) / 10;
      const r = rad * (0.48 + (i % 2) * 0.24);
      drawPuff(
        ctx,
        i % 3 === 0 ? 'electricCore' : 'stormDark',
        sx + Math.cos(a) * r * 1.15,
        sy + Math.sin(a) * r * 0.85,
        rad * 0.62,
        rad * 0.48,
        0.78,
      );
    }
    const strike = (ts * 0.0042 + seed) % 2.1;
    if (strike < 0.45) {
      drawForkedLightning(ctx, sx + (strike < 0.22 ? -rad * 0.36 : rad * 0.36), sy - rad * 0.25, rad * 0.72, Math.round(seed) + 3, '#ffe066');
    }
  } else if (flavor === 'blizzard') {
    const spin = -ts * 0.0017;
    const chill = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad * 1.35);
    chill.addColorStop(0, 'rgba(116, 192, 252, 0.46)');
    chill.addColorStop(0.6, 'rgba(208, 235, 255, 0.24)');
    chill.addColorStop(1, 'rgba(208, 235, 255, 0)');
    ctx.fillStyle = chill;
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 1.35, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const a = spin + (i * Math.PI * 2) / 12;
      const r = rad * (0.36 + (i % 3) * 0.22);
      drawPuff(ctx, 'blizzardIce', sx + Math.cos(a) * r * 1.18, sy + Math.sin(a) * r * 0.88, rad * 0.56, rad * 0.46, 0.82);
    }
    ctx.fillStyle = 'rgba(240, 250, 255, 0.92)';
    for (let i = 0; i < 16; i++) {
      const a = spin * 2.2 + i * 0.4;
      const r = rad * (0.2 + ((i * 19 + ts * 0.025) % 85) / 100);
      ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * 0.82), 2, 2);
    }
  } else if (flavor === 'volcano_blizzard') {
    // Split polar ice storm on left + volcanic ember plume on right!
    const spin = ts * 0.0015;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.55 + (i / 6) * Math.PI * 0.9 + Math.sin(spin + i) * 0.14;
      const r = rad * (0.42 + (i % 2) * 0.24);
      drawPuff(ctx, 'blizzardIce', sx + Math.cos(a) * r * 1.15, sy + Math.sin(a) * r * 0.88, rad * 0.6, rad * 0.5, 0.82);
    }
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.45 + (i / 6) * Math.PI * 0.9 + Math.cos(spin + i) * 0.14;
      const r = rad * (0.42 + (i % 2) * 0.24);
      drawPuff(ctx, 'firePlume', sx + Math.cos(a) * r * 1.15, sy + Math.sin(a) * r * 0.88, rad * 0.6, rad * 0.5, 0.8);
    }
    // Floating ice + ember particles
    for (let i = 0; i < 12; i++) {
      const f = ((ts * 0.0014 + i * 0.17) % 1);
      const isIce = i % 2 === 0;
      const x = sx + (isIce ? -1 : 1) * (8 + f * rad * 0.82);
      const y = sy + Math.sin(f * 5 + i) * rad * 0.45 - f * 8;
      ctx.fillStyle = isIce ? 'rgba(165, 216, 255, 0.9)' : 'rgba(255, 169, 77, 0.92)';
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  } else if (flavor === 'heat_sandstorm') {
    // Scorching desert solar vortex + sandstorm plumes
    drawSandstormSystem(ctx, sx, sy, rad * 1.05, ts, seed);
    const sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad * 0.95);
    sun.addColorStop(0, 'rgba(255, 212, 59, 0.48)');
    sun.addColorStop(0.55, 'rgba(240, 62, 62, 0.24)');
    sun.addColorStop(1, 'rgba(240, 62, 62, 0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 0.95, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = ts * 0.0018 + (i * Math.PI * 2) / 6;
      drawPuff(ctx, 'firePlume', sx + Math.cos(a) * rad * 0.42, sy + Math.sin(a) * rad * 0.34, rad * 0.48, rad * 0.4, 0.64);
    }
  } else {
    // 'rain_storm': Tropical emerald-blue supercell cyclone rainstorm
    drawStormOrMonsoonSystem(ctx, sx, sy, rad * 1.05, ts, seed, true);
    const aura = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad * 0.9);
    aura.addColorStop(0, 'rgba(56, 217, 169, 0.34)');
    aura.addColorStop(1, 'rgba(56, 217, 169, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawWorldMapAnomalies(params: {
  ctx: CanvasRenderingContext2D;
  zones: WorldZoneDef[];
  zoom: number;
  stageW: number;
  stageH: number;
  ts: number;
  selectedZoneId: string | null;
  hoveredZoneId: string | null;
  cardOpen: boolean;
  project: (lng: number, lat: number) => [number, number];
}) {
  const { ctx, zones, zoom, stageW, stageH, ts, selectedZoneId, hoveredZoneId, cardOpen, project } = params;
  if (zoom > 9.5) return;

  for (const zone of zones) {
    if (zone.unlocked) continue;
    const [sx, sy] = project(zone.centerLng, zone.centerLat);
    if (sx < -190 || sx > stageW + 190 || sy < -160 || sy > stageH + 160) continue;

    const anomaly = zone.anomaly;
    if (!anomaly) continue;

    const isSelected = cardOpen && selectedZoneId === zone.id;
    const isHovered = hoveredZoneId === zone.id;
    const rad = Math.round(24 + zoom * 6.8);
    const seed = Math.abs(zone.centerLng * 0.37 + zone.centerLat * 0.71);

    ctx.save();

    // 1. Render realistic layered pixel-satellite meteorological phenomenon
    if (anomaly.kind === 'cyclone') {
      drawCycloneSystem(
        ctx,
        sx,
        sy,
        rad,
        ts,
        anomaly.spinDir ?? -1,
        seed,
        zone.id === 'oceania' ? 'oceanic' : 'tropical',
      );
    } else if (anomaly.kind === 'monsoon') {
      drawStormOrMonsoonSystem(ctx, sx, sy, rad, ts, seed, true);
    } else if (anomaly.kind === 'storm') {
      drawStormOrMonsoonSystem(ctx, sx, sy, rad, ts, seed, false);
    } else if (anomaly.kind === 'sandstorm') {
      drawSandstormSystem(ctx, sx, sy, rad, ts, seed);
    } else if (anomaly.kind === 'aurora_blizzard') {
      drawAuroraBlizzardSystem(ctx, sx, sy, rad, ts, seed);
    } else if (anomaly.kind === 'legendary_clash' && anomaly.duelSpecies) {
      // ALWAYS render dramatic weather phenomenon underneath the epic duel!
      drawClashWeatherBackdrop(ctx, sx, sy, rad, ts, seed, anomaly.weatherFlavor ?? 'electric_storm');

      const [leftSp, rightSp] = anomaly.duelSpecies;
      const leftImg = getZoneSpriteImg(leftSp);
      const rightImg = getZoneSpriteImg(rightSp);
      const clashPulse = (ts * 0.028) % Math.max(22, rad * 0.92);
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

      // Expanding translucent shockwave ring
      const ringAlpha = Math.max(0.08, 0.58 * (1 - clashPulse / Math.max(22, rad * 0.92)));
      ctx.strokeStyle = `rgba(255, 240, 150, ${ringAlpha.toFixed(2)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, clashPulse + 7, 0, Math.PI * 2);
      ctx.stroke();

      // Dual energy beams colliding at center
      const beamHalf = Math.round(14 + Math.min(8, zoom * 1.1));
      ctx.fillStyle = cL;
      ctx.fillRect(Math.round(sx - beamHalf), Math.round(sy - 2), beamHalf, 4);
      ctx.fillStyle = cR;
      ctx.fillRect(Math.round(sx), Math.round(sy - 2), beamHalf, 4);
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(Math.round(sx - beamHalf + 3), Math.round(sy - 1), beamHalf * 2 - 6, 2);

      // Center impact star spark
      const spk = 4 + Math.round(Math.abs(Math.sin(ts * 0.018 + seed)) * 4);
      ctx.fillStyle = '#fff9db';
      ctx.fillRect(Math.round(sx - spk / 2), Math.round(sy - spk / 2), spk, spk);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(sx - spk), Math.round(sy - 1), spk * 2, 2);
      ctx.fillRect(Math.round(sx - 1), Math.round(sy - spk), 2, spk * 2);

      // Facing legendary pixel sprites
      const sprSz = Math.round(26 + Math.min(12, zoom * 1.35));
      const offX = Math.round(16 + Math.min(10, zoom * 1.35));
      if (leftImg) {
        ctx.save();
        ctx.translate(Math.round(sx - offX + lunge), Math.round(sy + bobL));
        ctx.scale(-1, 1);
        ctx.drawImage(leftImg, -sprSz / 2, -sprSz / 2, sprSz, sprSz);
        ctx.restore();
      }
      if (rightImg) {
        ctx.drawImage(
          rightImg,
          Math.round(sx + offX - lunge - sprSz / 2),
          Math.round(sy + bobR - sprSz / 2),
          sprSz,
          sprSz,
        );
      }
    }

    // 2. Subtle hover/selected halo (NO permanent ugly harsh circle when idle!)
    if (isHovered || isSelected) {
      ctx.strokeStyle = isSelected ? '#ffe066' : 'rgba(255, 243, 191, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -(ts * 0.025);
      ctx.beginPath();
      ctx.arc(sx, sy, rad + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Compact, high-contrast anomaly pill right below the phenomenon
    const badgeText = anomaly.mapBadge;
    ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", monospace';
    const bw = Math.max(68, Math.round(ctx.measureText(badgeText).width + 12));
    const bx = Math.round(sx - bw / 2);
    const by = Math.round(sy + Math.min(34, rad * 0.62) + (isHovered ? -2 : 0));
    ctx.fillStyle = isSelected ? '#ffe066' : isHovered ? '#fff3bf' : 'rgba(16, 20, 32, 0.86)';
    ctx.fillRect(bx, by, bw, 16);
    ctx.strokeStyle = isHovered || isSelected ? '#161420' : anomaly.accentColor;
    ctx.lineWidth = isHovered || isSelected ? 2 : 1.3;
    ctx.strokeRect(bx, by, bw, 16);
    ctx.fillStyle = isSelected || isHovered ? '#161420' : '#fffdf5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(badgeText, Math.round(sx), by + 11.5);

    ctx.restore();
  }
}
