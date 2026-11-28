import { SPECIES_CATALOG } from '../data/catalog';
import { WORLD_ZONES, type WorldZoneDef, type ZoneClashWeather } from '../data/worldTour';
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

// =========================================================================
// FAST CONTINUOUS 2D VALUE NOISE + DOMAIN-WARPED FBM (ZERO COPY-PASTE!)
// =========================================================================
const PERM = new Uint8Array(512);
const VAL = new Float32Array(256);
(() => {
  let s = 133791;
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    p[i] = i;
    VAL[i] = nextRand();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const X = xi & 255;
  const Y = yi & 255;
  const aa = VAL[PERM[PERM[X] + Y]];
  const ba = VAL[PERM[PERM[X + 1] + Y]];
  const ab = VAL[PERM[PERM[X] + Y + 1]];
  const bb = VAL[PERM[PERM[X + 1] + Y + 1]];
  const x1 = aa + (ba - aa) * u;
  const x2 = ab + (bb - ab) * u;
  return x1 + (x2 - x1) * v;
}

function fbm3(x: number, y: number): number {
  return vnoise(x, y) * 0.56 + vnoise(x * 2.07 + 13.4, y * 2.03 - 7.1) * 0.29 + vnoise(x * 4.21 - 5.2, y * 4.17 + 19.3) * 0.15;
}

function fbm2(x: number, y: number): number {
  return vnoise(x, y) * 0.66 + vnoise(x * 2.13 + 9.7, y * 2.09 - 4.3) * 0.34;
}

// =========================================================================
// ORGANIC GEOGRAPHIC REGION FIELD (SMOOTH SIGNED DISTANCE + FRACTAL EDGE!)
// =========================================================================
interface ZoneGeoField {
  zone: WorldZoneDef;
  poly: [number, number][];
  polarBand?: { latMin: number; latMax: number };
  crossesDateline: boolean;
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
  spanLng: number;
  spanLat: number;
  seed: number;
}

const GEO_FIELD_CACHE = new Map<string, ZoneGeoField>();

function getZoneGeoField(zone: WorldZoneDef): ZoneGeoField {
  const cached = GEO_FIELD_CACHE.get(zone.id);
  if (cached) return cached;

  if (zone.polarBand) {
    const f: ZoneGeoField = {
      zone,
      poly: [],
      polarBand: zone.polarBand,
      crossesDateline: false,
      minLng: -180,
      maxLng: 180,
      minLat: zone.polarBand.latMin,
      maxLat: zone.polarBand.latMax,
      spanLng: 360,
      spanLat: Math.max(8, zone.polarBand.latMax - zone.polarBand.latMin),
      seed: Math.abs(zone.centerLng * 0.31 + zone.centerLat * 0.73) + 17.5,
    };
    GEO_FIELD_CACHE.set(zone.id, f);
    return f;
  }

  const poly: [number, number][] =
    zone.regionPolygon && zone.regionPolygon.length >= 3
      ? zone.regionPolygon
      : [
          [zone.centerLng - 12, zone.centerLat + 8],
          [zone.centerLng + 12, zone.centerLat + 8],
          [zone.centerLng + 12, zone.centerLat - 8],
          [zone.centerLng - 12, zone.centerLat - 8],
        ];
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
  const f: ZoneGeoField = {
    zone,
    poly,
    crossesDateline: maxLng > 180,
    minLng,
    maxLng,
    minLat,
    maxLat,
    spanLng: Math.max(6, maxLng - minLng),
    spanLat: Math.max(6, maxLat - minLat),
    seed: Math.abs(zone.centerLng * 0.31 + zone.centerLat * 0.73),
  };
  GEO_FIELD_CACHE.set(zone.id, f);
  return f;
}

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

/** Distance from point (x, y) to nearest edge of polygon (in degrees) */
function distToPolyEdge(x: number, y: number, poly: [number, number][]): number {
  let bestSq = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy + 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lenSq));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const dSq = (x - px) * (x - px) + (y - py) * (y - py);
    if (dSq < bestSq) bestSq = dSq;
  }
  return Math.sqrt(bestSq);
}

/**
 * Returns a soft [0..1] organic influence mask for (lng, lat) inside a zone.
 * Uses multi-octave domain warping on the query point BEFORE testing polygon signed distance,
 * so the region boundary organically breaks into wispy tendrils & irregular weather fronts —
 * ZERO straight edges, ZERO circles!
 */
function sampleOrganicRegionMask(rawLng: number, lat: number, f: ZoneGeoField, tSec: number): number {
  // Full 360-degree polar latitude band (e.g., Antarctica & Southern Ocean roaring-forties polar vortex!)
  if (f.polarBand) {
    const radLng = (rawLng * Math.PI) / 180;
    // Periodic in longitude (uses cos/sin of longitude!) so there is ZERO seam at ±180°!
    const wave =
      (fbm2(Math.cos(radLng) * 2.4 + 11.3 + tSec * 0.04, Math.sin(radLng) * 2.4 - 7.1) - 0.5) * 12.0;
    const edgeLat = f.polarBand.latMax + wave;
    if (lat > edgeLat + 8) return 0;
    if (lat <= edgeLat - 5) return 1;
    const k = Math.max(0, Math.min(1, (edgeLat + 8 - lat) / 13));
    return k * k * (3 - 2 * k);
  }

  // Handle dateline-crossing regions (like Pacific Ocean spanning 148°E -> 284°E / 76°W) seamlessly!
  const lng = f.crossesDateline && rawLng < 0 ? rawLng + 360 : rawLng;

  const padLng = Math.min(18, f.spanLng * 0.24 + 4);
  const padLat = Math.min(14, f.spanLat * 0.24 + 4);
  if (
    lng < f.minLng - padLng ||
    lng > f.maxLng + padLng ||
    lat < f.minLat - padLat ||
    lat > f.maxLat + padLat
  ) {
    return 0;
  }

  // Domain-warp the boundary with drifting atmospheric noise (capped so large oceans don't spill into East Asia sanctuary!)
  const freq = 0.085;
  const warpAmpLng = Math.min(13, f.spanLng * 0.28);
  const warpAmpLat = Math.min(10, f.spanLat * 0.28);
  const wx = (fbm2(lng * freq + f.seed + tSec * 0.06, lat * freq - tSec * 0.03) - 0.5) * warpAmpLng;
  const wy = (fbm2(lng * freq - f.seed + 31.7, lat * freq + tSec * 0.05) - 0.5) * warpAmpLat;
  const qlng = lng + wx;
  const qlat = lat + wy;

  const inside = pointInPoly(qlng, qlat, f.poly);
  const edgeD = distToPolyEdge(qlng, qlat, f.poly);
  const feather = Math.max(3.2, Math.min(9.5, Math.min(f.spanLng, f.spanLat) * 0.28));

  if (inside) {
    return Math.min(1, 0.48 + (edgeD / feather) * 0.62);
  }
  if (edgeD < feather * 0.68) {
    const k = 1 - edgeD / (feather * 0.68);
    return k * k * 0.48;
  }
  return 0;
}

// =========================================================================
// OFFSCREEN PIXEL-ART METEOROLOGICAL RASTER BUFFER (UPDATED AT ~20FPS)
// =========================================================================
let rasterCanvas: HTMLCanvasElement | null = null;
let rasterCtx: CanvasRenderingContext2D | null = null;
let rasterImg: ImageData | null = null;
let lastRasterTs = -1;
let lastCamSig = '';

function mercXToLng(mx: number): number {
  return mx * 360 - 180;
}

function mercYToLat(my: number): number {
  const n = Math.PI - 2 * Math.PI * my;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/** Alpha-over blend of (r, g, b, a in 0..1) into RGBA ImageData pixel at offset idx */
function blendPixel(data: Uint8ClampedArray, idx: number, r: number, g: number, b: number, a: number) {
  if (a <= 0.01) return;
  const prevA = data[idx + 3] / 255;
  const outA = a + prevA * (1 - a);
  if (outA <= 0.005) return;
  const invOut = 1 / outA;
  data[idx] = clampByte((r * a + data[idx] * prevA * (1 - a)) * invOut);
  data[idx + 1] = clampByte((g * a + data[idx + 1] * prevA * (1 - a)) * invOut);
  data[idx + 2] = clampByte((b * a + data[idx + 2] * prevA * (1 - a)) * invOut);
  data[idx + 3] = clampByte(outA * 255);
}

/**
 * Evaluates true continuous, non-repeating satellite meteorological fields per pixel
 * across all visible anomaly zones in real geographic (lng, lat) space!
 */
function updateWeatherRaster(
  zones: WorldZoneDef[],
  stageW: number,
  stageH: number,
  camMx: number,
  camMy: number,
  worldPx: number,
  zoom: number,
  ts: number,
  hoveredZoneId: string | null,
  selectedZoneId: string | null,
  cardOpen: boolean,
  customGrid?: {
    rw: number;
    rh: number;
    colLng: Float32Array;
    rowLat: Float32Array;
    camSig: string;
  },
): HTMLCanvasElement {
  // Retro satellite pixel resolution: ~4px per weather texel on screen (matches GBA pixel tile grain!)
  const pixelStep = zoom < 3.5 ? 3 : 4;
  const rw = customGrid ? customGrid.rw : Math.max(80, Math.min(340, Math.ceil(stageW / pixelStep)));
  const rh = customGrid ? customGrid.rh : Math.max(50, Math.min(220, Math.ceil(stageH / pixelStep)));

  if (!rasterCanvas) {
    rasterCanvas = document.createElement('canvas');
    rasterCtx = rasterCanvas.getContext('2d')!;
  }
  if (rasterCanvas.width !== rw || rasterCanvas.height !== rh) {
    rasterCanvas.width = rw;
    rasterCanvas.height = rh;
    rasterImg = rasterCtx!.createImageData(rw, rh);
    lastRasterTs = -1;
  }

  const camSig = customGrid
    ? customGrid.camSig
    : `${camMx.toFixed(5)}_${camMy.toFixed(5)}_${zoom.toFixed(3)}_${hoveredZoneId ?? ''}_${cardOpen ? selectedZoneId ?? '' : ''}`;
  // Re-rasterize immediately on camera/hover move, or at ~18fps for silky drifting clouds & storms
  if (camSig === lastCamSig && ts - lastRasterTs < 55) {
    return rasterCanvas;
  }
  lastCamSig = camSig;
  lastRasterTs = ts;

  const img = rasterImg!;
  const data = img.data;
  data.fill(0);

  const tSec = ts * 0.001;

  // Pre-collect visible zone fields & their loose lat/lng bounds
  const activeFields: {
    f: ZoneGeoField;
    kind: string;
    flavor: ZoneClashWeather;
    spinDir: 1 | -1;
    lift: number;
    minLngPad: number;
    maxLngPad: number;
    minLatPad: number;
    maxLatPad: number;
  }[] = [];

  for (const z of zones) {
    if (z.unlocked || !z.anomaly) continue;
    const f = getZoneGeoField(z);
    const padLng = f.polarBand ? 0 : Math.min(18, f.spanLng * 0.24 + 4);
    const padLat = f.polarBand ? 12 : Math.min(14, f.spanLat * 0.24 + 4);
    const isHi = hoveredZoneId === z.id || (cardOpen && selectedZoneId === z.id);
    activeFields.push({
      f,
      kind: z.anomaly.kind,
      flavor: z.anomaly.weatherFlavor ?? 'electric_storm',
      spinDir: z.anomaly.spinDir ?? -1,
      lift: isHi ? 1.18 : 1.0,
      minLngPad: f.minLng - padLng,
      maxLngPad: f.maxLng + padLng,
      minLatPad: f.minLat - padLat,
      maxLatPad: f.maxLat + padLat,
    });
  }

  // Precompute per-column longitude & per-row latitude arrays (huge speedup!)
  let colLng: Float32Array;
  let rowLat: Float32Array;
  if (customGrid) {
    colLng = customGrid.colLng;
    rowLat = customGrid.rowLat;
  } else {
    colLng = new Float32Array(rw);
    rowLat = new Float32Array(rh);
    for (let x = 0; x < rw; x++) {
      const sx = ((x + 0.5) / rw) * stageW;
      let mx = camMx + (sx - stageW * 0.5) / worldPx;
      mx = ((mx % 1) + 1) % 1;
      colLng[x] = mercXToLng(mx);
    }
    for (let y = 0; y < rh; y++) {
      const sy = ((y + 0.5) / rh) * stageH;
      const my = Math.max(0.005, Math.min(0.995, camMy + (sy - stageH * 0.5) / worldPx));
      rowLat[y] = mercYToLat(my);
    }
  }

  // Evaluate organic domain-warped weather pixel by pixel
  for (let y = 0; y < rh; y++) {
    const lat = rowLat[y];
    const rowOff = y * rw;

    // Quick row-level filter of zones overlapping this latitude!
    const rowZones = [];
    for (let i = 0; i < activeFields.length; i++) {
      const af = activeFields[i];
      if (lat >= af.minLatPad && lat <= af.maxLatPad) rowZones.push(af);
    }
    if (rowZones.length === 0) continue;

    for (let x = 0; x < rw; x++) {
      const lng = colLng[x];
      const idx = (rowOff + x) * 4;

      for (let zi = 0; zi < rowZones.length; zi++) {
        const af = rowZones[zi];
        const testLng = af.f.crossesDateline && lng < 0 ? lng + 360 : lng;
        if (!af.f.polarBand && (testLng < af.minLngPad || testLng > af.maxLngPad)) continue;

        const mask = sampleOrganicRegionMask(lng, lat, af.f, tSec);
        if (mask <= 0.02) continue;

        const z = af.f.zone;
        const seed = af.f.seed;
        const kind = af.kind;
        const flavor = af.flavor;

        // Effective weather style (legendary clashes drive full regional weather!)
        const mode =
          kind === 'legendary_clash'
            ? flavor === 'heat_sandstorm'
              ? 'heat_sandstorm'
              : flavor === 'plateau_storm'
                ? 'plateau_storm'
                : flavor === 'rain_storm'
                  ? 'rain_storm'
                  : flavor === 'electric_storm'
                    ? 'electric_storm'
                    : flavor === 'blizzard'
                      ? 'blizzard'
                      : 'volcano_blizzard'
            : kind;

        if (mode === 'cyclone') {
          // True logarithmic-spiral domain-warped satellite typhoon!
          const dlng = (lng - z.centerLng) * Math.cos((z.centerLat * Math.PI) / 180);
          const dlat = lat - z.centerLat;
          const dist = Math.hypot(dlng, dlat);
          const coreR = Math.min(af.f.spanLng, af.f.spanLat) * 0.44;
          const nr = dist / Math.max(4, coreR);

          // Spiral twist stronger near eye, flowing organically into outer monsoon cloud shield
          const swirl = (2.9 / (nr + 0.34)) * af.spinDir - tSec * 0.65 * af.spinDir;
          const ca = Math.cos(swirl);
          const sa = Math.sin(swirl);
          const sx = dlng * ca - dlat * sa;
          const sy = dlng * sa + dlat * ca;

          const qx = fbm2(sx * 0.14 + seed, sy * 0.14 - tSec * 0.12) - 0.5;
          const qy = fbm2(sx * 0.14 - seed + 17, sy * 0.14 + tSec * 0.1) - 0.5;
          const rawCloud = fbm3(sx * 0.19 + qx * 2.1, sy * 0.19 + qy * 2.1);

          // Spiral rain-band modulation + natural calm clear eye
          const ang = Math.atan2(dlat, dlng);
          const spiralBand = 0.5 + 0.5 * Math.sin(ang * 2.0 + Math.log(nr + 0.12) * 3.8 * af.spinDir - tSec * 1.15 * af.spinDir);
          const eyeHole = nr < 0.17 ? Math.max(0, (nr - 0.05) / 0.12) : 1.0;
          const eyewallBoost = nr >= 0.14 && nr <= 0.42 ? 0.24 * (1 - Math.abs(nr - 0.26) / 0.18) : 0;

          const density = Math.max(0, (rawCloud * 0.72 + spiralBand * 0.32 + eyewallBoost - 0.34) * mask * eyeHole * 1.65);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5; // subtle 5-step retro satellite banding
            // Deep ocean-slate outer bands -> bright sunlit white eyewall tops!
            const r = (128 + qd * 124) * af.lift;
            const g = (168 + qd * 86) * af.lift;
            const b = (206 + qd * 49) * af.lift;
            blendPixel(data, idx, r, g, b, Math.min(0.92, d * 0.92));
          }
        } else if (mode === 'sandstorm' || mode === 'heat_sandstorm') {
          // High-contrast terracotta-umber haboob shadow + vivid swirling ochre-gold sand waves
          // (stands out clearly even over bright desert satellite tiles!)
          const flowX = lng * 0.08 + tSec * 0.25;
          const flowY = lat * 0.19 - tSec * 0.045;
          const warp = (fbm2(flowX * 0.9 + seed, flowY * 0.85) - 0.5) * 2.5;
          const dust = fbm3(flowX + warp * 0.75, flowY + warp * 0.48);
          const streaks = vnoise(lng * 0.13 + tSec * 0.82, lat * 0.58 + warp * 0.65);

          const density = Math.max(0, (dust * 0.8 + streaks * 0.28 - 0.25) * mask * 1.65);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5;
            // Rich burnt terracotta base -> luminous golden-ochre blowing dust crests
            let r = (138 + qd * 110) * af.lift;
            let g = (58 + qd * 124) * af.lift;
            let b = (22 + qd * 62) * af.lift;
            if (mode === 'heat_sandstorm') {
              const core = Math.max(0, 1 - Math.hypot((lng - z.centerLng) * 0.072, (lat - z.centerLat) * 0.12));
              if (core > 0.14) {
                const ember = fbm2(lng * 0.22 - tSec * 0.4, lat * 0.22 + tSec * 0.35);
                const heat = core * ember * 0.95;
                r = r * (1 - heat) + 255 * heat;
                g = g * (1 - heat) + (116 + ember * 120) * heat;
                b = b * (1 - heat) + 34 * heat;
              }
            }
            blendPixel(data, idx, r, g, b, Math.min(0.88, d * 0.88));
          }
        } else if (mode === 'plateau_storm') {
          // Northwest Plateau & Gobi: southern Kunlun/Tibetan snowy blizzard colliding with northern terracotta sandstorm!
          const flowX = lng * 0.085 - tSec * 0.19;
          const flowY = lat * 0.17 + tSec * 0.05;
          const warp = (fbm2(flowX * 0.85 + seed, flowY * 0.85) - 0.5) * 2.3;
          const cloud = fbm3(flowX + warp * 0.8, flowY + warp * 0.55);
          const split =
            (lat - 37.8) * 0.12 + (fbm2(lng * 0.11 + tSec * 0.16, lat * 0.14 - tSec * 0.1) - 0.5) * 1.6;
          const sandMix = Math.max(0, Math.min(1, 0.5 + split * 0.8));

          const density = Math.max(0, (cloud - 0.27) * mask * 1.68);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5;
            const snowR = 166 + qd * 88;
            const snowG = 212 + qd * 42;
            const snowB = 248;
            const sandR = 148 + qd * 102;
            const sandG = 72 + qd * 116;
            const sandB = 28 + qd * 60;
            const r = (snowR * (1 - sandMix) + sandR * sandMix) * af.lift;
            const g = (snowG * (1 - sandMix) + sandG * sandMix) * af.lift;
            const b = (snowB * (1 - sandMix) + sandB * sandMix) * af.lift;
            blendPixel(data, idx, r, g, b, Math.min(0.88, d * 0.88));
          }
        } else if (mode === 'ocean_maelstrom') {
          // Sweeping marine frontal cloud bands & churning storm swells over the open oceans
          const effLng = testLng;
          const jetX = effLng * 0.055 - tSec * 0.17;
          const jetY = lat * 0.11 + Math.sin(effLng * 0.05 + tSec * 0.18) * 0.7;
          const wx = (fbm2(jetX * 0.85 + seed, jetY * 0.85) - 0.5) * 2.6;
          const wy = (fbm2(jetX * 0.85 - seed + 19, jetY * 0.85 + tSec * 0.06) - 0.5) * 2.2;
          const squall = fbm3(jetX + wx * 0.8, jetY + wy * 0.8);
          const swell = vnoise(effLng * 0.18 - tSec * 0.55, lat * 0.36 + wy * 0.5);

          const density = Math.max(0, (squall * 0.78 + swell * 0.24 - 0.35) * mask * 1.55);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5;
            // Atmospheric deep storm-sea mist -> silver-white frontal wave crests
            const r = (74 + qd * 154) * af.lift;
            const g = (108 + qd * 130) * af.lift;
            const b = (144 + qd * 104) * af.lift;
            blendPixel(data, idx, r, g, b, Math.min(0.76, d * 0.76));
          }
        } else if (mode === 'polar_vortex') {
          // Seamless 360° Antarctic polar vortex blizzard + shimmering Aurora Australis!
          const radLng = (lng * Math.PI) / 180;
          const cx = Math.cos(radLng);
          const sx = Math.sin(radLng);
          const jetRot = tSec * 0.16;
          const rx = cx * Math.cos(jetRot) - sx * Math.sin(jetRot);
          const ry = cx * Math.sin(jetRot) + sx * Math.cos(jetRot);
          const latScale = (lat + 90) * 0.085;
          const warp = (fbm2(rx * 2.6 + latScale, ry * 2.6 - latScale) - 0.5) * 1.8;
          const vortex = fbm3(rx * 3.8 + warp, ry * 3.8 + latScale * 1.6 - warp * 0.6);

          const density = Math.max(0, (vortex - 0.25) * mask * 1.65);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5;
            blendPixel(
              data,
              idx,
              (158 + qd * 96) * af.lift,
              (210 + qd * 44) * af.lift,
              252,
              Math.min(0.86, d * 0.86),
            );
          }

          // Subtle shimmering Southern Aurora Australis (emerald & violet) along 60°S..74°S
          const aWave = Math.sin(radLng * 3 + tSec * 0.85 + warp * 2.2) * 3.5;
          const aBand = Math.exp(-Math.pow((lat - (-66 + aWave)) * 0.28, 2));
          const aShim = 0.5 + 0.5 * vnoise(rx * 8 + tSec * 0.9, ry * 8 - tSec * 0.7);
          const aAlpha = aBand * aShim * mask * 0.52;
          if (aAlpha > 0.04) {
            blendPixel(data, idx, 88 * af.lift, 238 * af.lift, 198 * af.lift, aAlpha);
          }
        } else if (mode === 'storm' || mode === 'monsoon' || mode === 'rain_storm') {
          // Billowing multi-cell frontal squall / monsoon thunderclouds with dark rain bases & sunlit tops
          const windX = lng * 0.11 - tSec * 0.15;
          const windY = lat * 0.14 + tSec * 0.05;
          const wx = (fbm2(windX * 0.8 + seed, windY * 0.8) - 0.5) * 2.2;
          const wy = (fbm2(windX * 0.8 + 23.1, windY * 0.8 - seed) - 0.5) * 2.2;
          const cloud = fbm3(windX + wx * 0.85, windY + wy * 0.85);
          // Slight sunlit offset to create genuine 3D cloud-top relief vs dark storm shadow base!
          const topLight = fbm2(windX + wx * 0.85 - 0.25, windY + wy * 0.85 + 0.22);

          const density = Math.max(0, (cloud - 0.31) * mask * 1.72);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const relief = Math.max(0, Math.min(1, (topLight - cloud) * 2.8 + d * 0.65));
            const qr = Math.ceil(relief * 4) / 4;
            let r: number;
            let g: number;
            let b: number;
            if (mode === 'monsoon') {
              r = (48 + qr * 142) * af.lift;
              g = (72 + qr * 138) * af.lift;
              b = (98 + qr * 132) * af.lift;
            } else if (mode === 'rain_storm') {
              // Amazon emerald-charged tropical supercell clouds
              r = (44 + qr * 124) * af.lift;
              g = (84 + qr * 134) * af.lift;
              b = (94 + qr * 120) * af.lift;
            } else {
              // Heavy dark slate thunderhead with bright anvil tops
              r = (36 + qr * 168) * af.lift;
              g = (44 + qr * 166) * af.lift;
              b = (62 + qr * 162) * af.lift;
            }
            blendPixel(data, idx, r, g, b, Math.min(0.88, d * 0.88));
          }
        } else if (mode === 'electric_storm') {
          // Swirling indigo-violet ionized storm canopy with crackling golden-purple cells
          const dlng = (lng - z.centerLng) * 0.68;
          const dlat = lat - z.centerLat;
          const dist = Math.hypot(dlng, dlat);
          const swirl = (1.6 / (dist * 0.08 + 0.45)) - tSec * 0.38;
          const sx = dlng * Math.cos(swirl) - dlat * Math.sin(swirl);
          const sy = dlng * Math.sin(swirl) + dlat * Math.cos(swirl);
          const warp = (fbm2(sx * 0.14 + seed, sy * 0.14 + tSec * 0.12) - 0.5) * 2.0;
          const cloud = fbm3(sx * 0.17 + warp, sy * 0.17 - warp * 0.8);
          const charge = vnoise(lng * 0.38 + tSec * 1.4, lat * 0.38 - tSec * 1.1);

          const density = Math.max(0, (cloud - 0.3) * mask * 1.7);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5;
            const spark = charge > 0.84 && d > 0.48 ? (charge - 0.84) * 5.0 : 0;
            const r = (46 + qd * 98 + spark * 140) * af.lift;
            const g = (38 + qd * 78 + spark * 155) * af.lift;
            const b = (92 + qd * 145 + spark * 45) * af.lift;
            blendPixel(data, idx, r, g, b, Math.min(0.88, d * 0.88));
          }
        } else if (mode === 'aurora_blizzard') {
          // Sweeping icy snow front + shimmering rippling emerald-violet aurora ribbons
          const windX = lng * 0.12 - tSec * 0.18;
          const windY = lat * 0.24 + tSec * 0.05;
          const snowCloud = fbm3(windX + seed, windY + (vnoise(windX, windY) - 0.5) * 1.5);
          const sDens = Math.max(0, (snowCloud - 0.36) * mask * 1.45);
          if (sDens > 0.04) {
            const d = Math.min(1, sDens);
            blendPixel(data, idx, (192 + d * 60) * af.lift, (226 + d * 28) * af.lift, 255, Math.min(0.76, d * 0.76));
          }

          // Continuous undulating geomagnetic aurora curtains (non-uniform waves!)
          const wave = Math.sin(lng * 0.16 + tSec * 0.9 + fbm2(lng * 0.08, lat * 0.08 + tSec * 0.2) * 3.8);
          const ribbon = Math.exp(-Math.pow((lat - (z.centerLat + wave * 3.6)) * 0.36, 2));
          const ribbon2 = Math.exp(-Math.pow((lat - (z.centerLat - 2.6 - wave * 2.8)) * 0.42, 2));
          const shimmer = 0.55 + 0.45 * vnoise(lng * 0.45 + tSec * 1.6, lat * 0.18 - tSec * 0.4);
          const a1 = ribbon * shimmer * mask * 0.72;
          const a2 = ribbon2 * shimmer * mask * 0.58;
          if (a1 > 0.04) blendPixel(data, idx, 62 * af.lift, 245 * af.lift, 178 * af.lift, a1);
          if (a2 > 0.04) blendPixel(data, idx, 168 * af.lift, 128 * af.lift, 255 * af.lift, a2);
        } else if (mode === 'blizzard') {
          // Sweeping Siberian polar jet-stream blizzard front
          const flowX = lng * 0.065 - tSec * 0.22;
          const flowY = lat * 0.16 + tSec * 0.06;
          const warp = (fbm2(flowX * 0.85 + seed, flowY * 0.85) - 0.5) * 2.4;
          const snow = fbm3(flowX + warp * 0.8, flowY + warp * 0.5);
          const gust = vnoise(lng * 0.14 - tSec * 0.65, lat * 0.45 + warp * 0.6);

          const density = Math.max(0, (snow * 0.8 + gust * 0.26 - 0.33) * mask * 1.6);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5;
            const r = (152 + qd * 102) * af.lift;
            const g = (206 + qd * 48) * af.lift;
            const b = (242 + qd * 13) * af.lift;
            blendPixel(data, idx, r, g, b, Math.min(0.86, d * 0.86));
          }
        } else if (mode === 'volcano_blizzard') {
          // Intertwining polar blizzard swirls colliding with fiery volcanic ash/ember plumes!
          const dlng = (lng - z.centerLng) * 0.48;
          const dlat = lat - z.centerLat;
          const swirl = (1.35 / (Math.hypot(dlng, dlat) * 0.08 + 0.5)) - tSec * 0.35;
          const sx = dlng * Math.cos(swirl) - dlat * Math.sin(swirl);
          const sy = dlng * Math.sin(swirl) + dlat * Math.cos(swirl);
          const warp = (fbm2(sx * 0.14 + seed, sy * 0.14 + tSec * 0.15) - 0.5) * 2.2;
          const cloud = fbm3(sx * 0.16 + warp, sy * 0.16 - warp * 0.7);
          // Organic wavy clash frontier separating icy Articuno storm & fiery Moltres storm
          const split = (lng - z.centerLng) * 0.08 + (fbm2(lng * 0.12 - tSec * 0.2, lat * 0.12 + tSec * 0.18) - 0.5) * 1.9;
          const fireMix = Math.max(0, Math.min(1, 0.5 + split * 0.85));

          const density = Math.max(0, (cloud - 0.3) * mask * 1.7);
          if (density > 0.04) {
            const d = Math.min(1, density);
            const qd = Math.ceil(d * 5) / 5;
            const iceR = 148 + qd * 104;
            const iceG = 212 + qd * 42;
            const iceB = 252;
            const fireR = 200 + qd * 55;
            const fireG = 66 + qd * 145;
            const fireB = 34 + qd * 48;
            const r = (iceR * (1 - fireMix) + fireR * fireMix) * af.lift;
            const g = (iceG * (1 - fireMix) + fireG * fireMix) * af.lift;
            const b = (iceB * (1 - fireMix) + fireB * fireMix) * af.lift;
            blendPixel(data, idx, r, g, b, Math.min(0.88, d * 0.88));
          }
        }
      }
    }
  }

  rasterCtx!.putImageData(img, 0, 0);
  return rasterCanvas;
}

// =========================================================================
// STOCHASTIC ORGANIC LIGHTNING, LEGENDARY DUELS & INTERACTION HIT-TEST
// =========================================================================
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
    ctx.lineWidth = pass === 0 ? 2.8 : 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 1; i <= segs; i++) {
      const dir = ((seed + i) % 2 === 0 ? 1 : -1) * (2.5 + ((seed * 7 + i * 5) % 4));
      x += dir;
      y += stepY;
      ctx.lineTo(Math.round(x), Math.round(y));
      if (i === 2 && pass === 0) {
        ctx.moveTo(Math.round(x), Math.round(y));
        ctx.lineTo(Math.round(x - dir * 1.5), Math.round(y + stepY * 0.9));
        ctx.moveTo(Math.round(x), Math.round(y));
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Hit-tests mouse cursor against each zone's organic geographic region mask
 * (plus its compact map pill) — ZERO circular bounds!
 */
export function hitTestAnomalyZone(
  sx: number,
  sy: number,
  zones: WorldZoneDef[],
  zoom: number,
  camMx: number,
  camMy: number,
  worldPx: number,
  stageW: number,
  stageH: number,
  project: (lng: number, lat: number) => [number, number],
): WorldZoneDef | null {
  if (zoom > 9.5) return null;

  // 1. Badge pills take priority so clicking a label always works
  const camLng = mercXToLng(camMx);
  for (const zone of zones) {
    if (zone.unlocked || !zone.anomaly) continue;
    const badgeLng = zone.polarBand ? camLng : zone.centerLng;
    const [cx, cy] = project(badgeLng, zone.centerLat);
    const by = cy + (zone.anomaly.kind === 'legendary_clash' ? 20 : 10);
    if (sx >= cx - 48 && sx <= cx + 48 && sy >= by - 2 && sy <= by + 18) {
      return zone;
    }
  }

  // 2. Organic geographic weather footprint hit-test at cursor's actual (lng, lat)!
  let mx = camMx + (sx - stageW * 0.5) / worldPx;
  mx = ((mx % 1) + 1) % 1;
  const my = Math.max(0.005, Math.min(0.995, camMy + (sy - stageH * 0.5) / worldPx));
  const lng = mercXToLng(mx);
  const lat = mercYToLat(my);
  const tSec = performance.now() * 0.001;

  for (const zone of zones) {
    if (zone.unlocked || !zone.anomaly) continue;
    const f = getZoneGeoField(zone);
    if (sampleOrganicRegionMask(lng, lat, f, tSec) > 0.22) {
      return zone;
    }
  }
  return null;
}

export function drawWorldMapAnomalies(params: {
  ctx: CanvasRenderingContext2D;
  zones: WorldZoneDef[];
  zoom: number;
  camMx: number;
  camMy: number;
  worldPx: number;
  stageW: number;
  stageH: number;
  ts: number;
  selectedZoneId: string | null;
  hoveredZoneId: string | null;
  cardOpen: boolean;
  project: (lng: number, lat: number) => [number, number];
}) {
  const {
    ctx,
    zones,
    zoom,
    camMx,
    camMy,
    worldPx,
    stageW,
    stageH,
    ts,
    selectedZoneId,
    hoveredZoneId,
    cardOpen,
    project,
  } = params;
  if (zoom > 9.5) return;

  // 1. Composite the continuous domain-warped pixel-satellite weather raster cleanly onto the globe!
  const raster = updateWeatherRaster(
    zones,
    stageW,
    stageH,
    camMx,
    camMy,
    worldPx,
    zoom,
    ts,
    hoveredZoneId,
    selectedZoneId,
    cardOpen,
  );
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(raster, 0, 0, stageW, stageH);
  ctx.restore();

  // 2. Render crisp 60fps stochastic lightning flashes, epic legendary duels & compact map badges
  const camLng = mercXToLng(camMx);
  for (const zone of zones) {
    if (zone.unlocked || !zone.anomaly) continue;
    const anomaly = zone.anomaly;
    const f = getZoneGeoField(zone);
    const badgeLng = zone.polarBand ? camLng : zone.centerLng;
    const [cx, cy] = project(badgeLng, zone.centerLat);
    if (cx < -160 || cx > stageW + 160 || cy < -140 || cy > stageH + 140) continue;

    const isSelected = cardOpen && selectedZoneId === zone.id;
    const isHovered = hoveredZoneId === zone.id;
    const seed = f.seed;

    ctx.save();

    // Stochastic organic lightning flashes popping at varied spots inside storm / monsoon / ocean squalls / electric fronts
    const hasLightning =
      anomaly.kind === 'storm' ||
      anomaly.kind === 'monsoon' ||
      anomaly.kind === 'ocean_maelstrom' ||
      (anomaly.kind === 'legendary_clash' &&
        (anomaly.weatherFlavor === 'electric_storm' || anomaly.weatherFlavor === 'rain_storm'));

    if (hasLightning) {
      const cycle = (ts * 0.0023 + seed * 1.9) % 3.1;
      if (cycle < 0.34) {
        const slot = Math.floor(ts * 0.00075 + seed * 7);
        const oLng = zone.centerLng + (vnoise(slot * 1.7, seed) - 0.5) * Math.min(40, f.spanLng * 0.5);
        const oLat = zone.centerLat + (vnoise(seed, slot * 2.1) - 0.5) * Math.min(28, f.spanLat * 0.45);
        const [bx, by] = project(oLng, oLat);
        const glow = ctx.createRadialGradient(bx, by, 2, bx, by, 22);
        glow.addColorStop(0, 'rgba(255, 248, 200, 0.55)');
        glow.addColorStop(1, 'rgba(255, 248, 200, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bx, by, 22, 0, Math.PI * 2);
        ctx.fill();
        drawForkedLightning(
          ctx,
          bx,
          by - 4,
          18 + Math.min(14, zoom * 2.2),
          slot + Math.round(seed),
          anomaly.kind === 'monsoon' || anomaly.kind === 'ocean_maelstrom' ? '#a5d8ff' : '#ffe066',
        );
      }
    }

    // Epic legendary clash sprites hovering dynamically inside the storm eye
    if (anomaly.kind === 'legendary_clash' && anomaly.duelSpecies) {
      const [leftSp, rightSp] = anomaly.duelSpecies;
      const leftImg = getZoneSpriteImg(leftSp);
      const rightImg = getZoneSpriteImg(rightSp);
      const bobL = Math.sin(ts * 0.0064 + seed) * 2.6;
      const bobR = Math.sin(ts * 0.0064 + seed + Math.PI) * 2.6;
      const lunge = Math.sin(ts * 0.0125 + seed) * 2.0;

      const beamColors: Record<ZoneClashWeather, [string, string]> = {
        electric_storm: ['#cc5de8', '#ffd43b'],
        blizzard: ['#a5d8ff', '#4dabf7'],
        volcano_blizzard: ['#74c0fc', '#ff6b35'],
        heat_sandstorm: ['#ffd43b', '#ff595e'],
        plateau_storm: ['#e8a54b', '#74c0fc'],
        rain_storm: ['#f783ac', '#51cf66'],
      };
      const [cL, cR] = beamColors[anomaly.weatherFlavor ?? 'electric_storm'];

      const beamHalf = Math.round(13 + Math.min(8, zoom * 1.1));
      ctx.fillStyle = cL;
      ctx.fillRect(Math.round(cx - beamHalf), Math.round(cy - 2), beamHalf, 4);
      ctx.fillStyle = cR;
      ctx.fillRect(Math.round(cx), Math.round(cy - 2), beamHalf, 4);
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(Math.round(cx - beamHalf + 3), Math.round(cy - 1), beamHalf * 2 - 6, 2);

      const spk = 4 + Math.round(Math.abs(Math.sin(ts * 0.017 + seed)) * 3.5);
      ctx.fillStyle = '#fff9db';
      ctx.fillRect(Math.round(cx - spk / 2), Math.round(cy - spk / 2), spk, spk);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(cx - spk), Math.round(cy - 1), spk * 2, 2);
      ctx.fillRect(Math.round(cx - 1), Math.round(cy - spk), 2, spk * 2);

      const sprSz = Math.round(26 + Math.min(12, zoom * 1.3));
      const offX = Math.round(16 + Math.min(10, zoom * 1.3));
      if (leftImg) {
        ctx.save();
        ctx.translate(Math.round(cx - offX + lunge), Math.round(cy + bobL));
        ctx.scale(-1, 1);
        ctx.drawImage(leftImg, -sprSz / 2, -sprSz / 2, sprSz, sprSz);
        ctx.restore();
      }
      if (rightImg) {
        ctx.drawImage(
          rightImg,
          Math.round(cx + offX - lunge - sprSz / 2),
          Math.round(cy + bobR - sprSz / 2),
          sprSz,
          sprSz,
        );
      }
    }

    // Sleek compact advisory badge (clean visual lift on hover/select, NO artificial border outline!)
    const badgeText = anomaly.mapBadge;
    ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", monospace';
    const bw = Math.max(66, Math.round(ctx.measureText(badgeText).width + 12));
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(cy + (anomaly.kind === 'legendary_clash' ? 20 : 10) + (isHovered ? -2 : 0));
    ctx.fillStyle = isSelected ? '#ffe066' : isHovered ? '#fff3bf' : 'rgba(16, 20, 32, 0.82)';
    ctx.fillRect(bx, by, bw, 16);
    ctx.strokeStyle = isHovered || isSelected ? '#161420' : anomaly.accentColor;
    ctx.lineWidth = isHovered || isSelected ? 2 : 1.2;
    ctx.strokeRect(bx, by, bw, 16);
    ctx.fillStyle = isSelected || isHovered ? '#161420' : '#fffdf5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(badgeText, Math.round(cx), by + 11.5);

    ctx.restore();
  }
}

export interface AnomalyHazardProfile {
  kind: 'cold' | 'heat' | 'plateau' | 'storm';
  causeLabel: string;
  shortTag: string;
  hpLossPctPerSec: number;
  colorHex: string;
}

/** Classifies a locked WorldZone's overland survival hazard profile (cold/heat/plateau/storm, 5% HP/sec). */
export function getAnomalyHazardProfile(zone: WorldZoneDef): AnomalyHazardProfile {
  const kind = zone.anomaly?.kind;
  const flavor = zone.anomaly?.weatherFlavor;
  if (
    kind === 'aurora_blizzard' ||
    kind === 'polar_vortex' ||
    flavor === 'blizzard' ||
    flavor === 'volcano_blizzard'
  ) {
    return {
      kind: 'cold',
      causeLabel: '极寒暴雪冻伤',
      shortTag: '❄️ 极寒',
      hpLossPctPerSec: 0.05,
      colorHex: '#74c0fc',
    };
  }
  if (kind === 'sandstorm' || flavor === 'heat_sandstorm') {
    return {
      kind: 'heat',
      causeLabel: '酷热沙暴灼伤',
      shortTag: '🔥 酷热',
      hpLossPctPerSec: 0.05,
      colorHex: '#ff6b35',
    };
  }
  if (flavor === 'plateau_storm') {
    return {
      kind: 'plateau',
      causeLabel: '高寒缺氧与狂沙侵蚀',
      shortTag: '🏔️ 高寒狂沙',
      hpLossPctPerSec: 0.05,
      colorHex: '#ffd43b',
    };
  }
  return {
    kind: 'storm',
    causeLabel: '极端异象风暴侵袭',
    shortTag: '⚡ 异象风暴',
    hpLossPctPerSec: 0.05,
    colorHex: '#38d9a9',
  };
}

/**
 * Checks whether a real-world `(lat, lng)` point lies inside any unopened anomaly zone
 * (reusing the exact same organic domain-warped geographic boundary as the world map!).
 */
export function findLockedAnomalyZoneAtLatLng(
  lat: number,
  lng: number,
  zones: WorldZoneDef[] = WORLD_ZONES,
): WorldZoneDef | null {
  const normLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    if (zone.unlocked || !zone.anomaly) continue;
    const f = getZoneGeoField(zone);
    if (sampleOrganicRegionMask(normLng, lat, f, 0) > 0.28) {
      return zone;
    }
  }
  return null;
}

/**
 * Renders the EXACT same 17 global weather anomaly systems, lightning strikes, legendary duels & event badges
 * onto the zoomed-out 2D Handheld World Map (`WorldMapHud.tsx`) using its local-tangent `(lat, lng)` projection!
 */
export function drawWorldMapAnomaliesGeo(params: {
  ctx: CanvasRenderingContext2D;
  zones?: WorldZoneDef[];
  stageW: number;
  stageH: number;
  ts: number;
  centerLng: number;
  unitsPerPx: number;
  screenToGeo: (sx: number, sy: number) => { lat: number; lng: number } | null;
  geoToScreen: (lat: number, lng: number) => [number, number] | null;
}) {
  const {
    ctx,
    zones = WORLD_ZONES,
    stageW,
    stageH,
    ts,
    centerLng,
    unitsPerPx,
    screenToGeo,
    geoToScreen,
  } = params;

  const rw = Math.max(72, Math.min(240, Math.ceil(stageW / 4)));
  const rh = Math.max(48, Math.min(160, Math.ceil(stageH / 4)));
  const colLng = new Float32Array(rw);
  const rowLat = new Float32Array(rh);
  const midY = stageH * 0.5;
  const midX = stageW * 0.5;
  for (let x = 0; x < rw; x++) {
    const sx = ((x + 0.5) / rw) * stageW;
    const g = screenToGeo(sx, midY);
    colLng[x] = g ? ((((g.lng + 180) % 360) + 360) % 360) - 180 : 0;
  }
  for (let y = 0; y < rh; y++) {
    const sy = ((y + 0.5) / rh) * stageH;
    const g = screenToGeo(midX, sy);
    rowLat[y] = g ? Math.max(-85, Math.min(85, g.lat)) : 0;
  }

  const camSig = `hud_${rw}_${rh}_${colLng[0].toFixed(2)}_${rowLat[0].toFixed(2)}_${unitsPerPx.toFixed(1)}`;
  const raster = updateWeatherRaster(
    zones,
    stageW,
    stageH,
    0.5,
    0.5,
    stageW,
    2.2,
    ts,
    null,
    null,
    false,
    { rw, rh, colLng, rowLat, camSig },
  );

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(raster, 0, 0, stageW, stageH);
  ctx.restore();

  const normCenterLng = ((((centerLng + 180) % 360) + 360) % 360) - 180;
  for (const zone of zones) {
    if (zone.unlocked || !zone.anomaly) continue;
    const anomaly = zone.anomaly;
    const f = getZoneGeoField(zone);
    const badgeLng = zone.polarBand ? normCenterLng : zone.centerLng;
    const pt = geoToScreen(zone.centerLat, badgeLng);
    if (!pt) continue;
    const [cx, cy] = pt;
    if (cx < -140 || cx > stageW + 140 || cy < -120 || cy > stageH + 120) continue;

    ctx.save();
    const seed = f.seed;

    const hasLightning =
      anomaly.kind === 'storm' ||
      anomaly.kind === 'monsoon' ||
      anomaly.kind === 'ocean_maelstrom' ||
      (anomaly.kind === 'legendary_clash' &&
        (anomaly.weatherFlavor === 'electric_storm' || anomaly.weatherFlavor === 'rain_storm'));

    if (hasLightning) {
      const cycle = (ts * 0.0023 + seed * 1.9) % 3.1;
      if (cycle < 0.34) {
        const slot = Math.floor(ts * 0.00075 + seed * 7);
        const oLng = zone.centerLng + (vnoise(slot * 1.7, seed) - 0.5) * Math.min(36, f.spanLng * 0.45);
        const oLat = zone.centerLat + (vnoise(seed, slot * 2.1) - 0.5) * Math.min(24, f.spanLat * 0.42);
        const bPt = geoToScreen(oLat, oLng);
        if (bPt) {
          drawForkedLightning(
            ctx,
            bPt[0],
            bPt[1] - 4,
            16,
            slot + Math.round(seed),
            anomaly.kind === 'monsoon' || anomaly.kind === 'ocean_maelstrom' ? '#a5d8ff' : '#ffe066',
          );
        }
      }
    }

    if (anomaly.kind === 'legendary_clash' && anomaly.duelSpecies) {
      const [leftSp, rightSp] = anomaly.duelSpecies;
      const leftImg = getZoneSpriteImg(leftSp);
      const rightImg = getZoneSpriteImg(rightSp);
      const bobL = Math.sin(ts * 0.0064 + seed) * 2.0;
      const bobR = Math.sin(ts * 0.0064 + seed + Math.PI) * 2.0;
      const beamHalf = 11;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(cx - beamHalf), Math.round(cy - 1.5), beamHalf * 2, 3);
      const sprSz = 22;
      const offX = 14;
      if (leftImg) {
        ctx.save();
        ctx.translate(Math.round(cx - offX), Math.round(cy + bobL));
        ctx.scale(-1, 1);
        ctx.drawImage(leftImg, -sprSz / 2, -sprSz / 2, sprSz, sprSz);
        ctx.restore();
      }
      if (rightImg) {
        ctx.drawImage(rightImg, Math.round(cx + offX - sprSz / 2), Math.round(cy + bobR - sprSz / 2), sprSz, sprSz);
      }
    }

    const badgeText = anomaly.mapBadge;
    ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
    const bw = Math.max(58, Math.round(ctx.measureText(badgeText).width + 10));
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(cy + (anomaly.kind === 'legendary_clash' ? 16 : 8));
    ctx.fillStyle = 'rgba(16, 20, 32, 0.84)';
    ctx.fillRect(bx, by, bw, 14);
    ctx.strokeStyle = anomaly.accentColor;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(bx, by, bw, 14);
    ctx.fillStyle = '#fffdf5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(badgeText, Math.round(cx), by + 10.5);

    ctx.restore();
  }
}
