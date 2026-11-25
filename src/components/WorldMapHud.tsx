import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GEO_UNITS_PER_KM,
  getActiveGeoTerrainOrigin,
  getProjectedGeoCities,
  sampleGeoTerrainHeight3D,
  subscribeGeoDemLoaded,
  worldToGeo,
} from '../data/geoTerrain3D';
import { getTerrainHeight3D, LAKE_BASINS_3D, WATER_LEVEL_3D } from '../data/survivorsTactics';
import { BIOME_PALETTES, type BiomeId } from '../data/worldTextures3D';
import { sound } from '../utils/sound';
import { PixelItemImg } from './PixelSprite';

export interface MapMarkerDot {
  x: number;
  z: number;
  kind: 'follower' | 'enemy' | 'trainer' | 'boss';
  label?: string;
}

export interface WorldPoi {
  id: string;
  x: number;
  z: number;
  type: 'altar' | 'shrine' | 'berry' | 'boulder' | 'chest' | 'lake';
  label: string;
  color: string;
}

export interface LiveMapSnapshot {
  px: number;
  pz: number;
  facingAngle: number;
  camYaw: number;
  dots: MapMarkerDot[];
}

export interface WorldMapData {
  biome: BiomeId;
  regionName: string;
  snapshot: LiveMapSnapshot;
}

export interface MapPin {
  id: string;
  x: number;
  z: number;
}

interface WorldMapHudProps {
  biome: BiomeId;
  regionName: string;
  snapshot: LiveMapSnapshot;
  onToggleExpand: () => void;
}

const POI_META: Record<WorldPoi['type'], { label: string; color: string; sprite: string }> = {
  altar: { label: '守护者祭坛', color: '#e03131', sprite: '/sprites/items/master-ball.png' },
  shrine: { label: '祝福图腾', color: '#22b8cf', sprite: '/sprites/items/kings-rock.png' },
  berry: { label: '野生树果林', color: '#40c057', sprite: '/sprites/items/oran-berry.png' },
  boulder: { label: '黄金矿岩', color: '#f59f00', sprite: '/sprites/items/amulet-coin.png' },
  chest: { label: '神秘精灵球', color: '#7950f2', sprite: '/sprites/items/great-ball.png' },
  lake: { label: '湖泊水域', color: '#339af0', sprite: '/sprites/items/mystic-water.png' },
};

const iconImgCache = new Map<string, HTMLImageElement>();
function getCachedMapIcon(url: string, onLoad?: () => void): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  let img = iconImgCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    if (onLoad) img.onload = onLoad;
    iconImgCache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function generateRegionalPois(): WorldPoi[] {
  const specs: { type: Exclude<WorldPoi['type'], 'lake'>; angle: number; dist: number }[] = [
    { type: 'altar', angle: 0.72, dist: 46 },
    { type: 'shrine', angle: 2.35, dist: 34 },
    { type: 'shrine', angle: -1.15, dist: 52 },
    { type: 'berry', angle: -2.5, dist: 28 },
    { type: 'berry', angle: 1.45, dist: 40 },
    { type: 'boulder', angle: -0.45, dist: 36 },
    { type: 'chest', angle: 3.05, dist: 44 },
    { type: 'chest', angle: -1.85, dist: 48 },
  ];
  const basePois: WorldPoi[] = specs.map((s, idx) => ({
    id: `poi_${idx}`,
    x: Math.round(Math.cos(s.angle) * s.dist),
    z: Math.round(Math.sin(s.angle) * s.dist),
    type: s.type,
    label: POI_META[s.type].label,
    color: POI_META[s.type].color,
  }));
  const lakePois: WorldPoi[] = LAKE_BASINS_3D.map((lk, idx) => ({
    id: `lake_${idx}`,
    x: lk.cx,
    z: lk.cz,
    type: 'lake',
    label: POI_META.lake.label,
    color: POI_META.lake.color,
  }));
  return [...basePois, ...lakePois];
}

/** Sample a crisp 1:1 isotropic pixel-shaded topographic heightmap tile (zero aspect distortion!) */
function paintTopographicMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  centerX: number,
  centerZ: number,
  worldSpanMinAxis: number,
  biome: BiomeId,
  stepPx: number,
) {
  const pal = BIOME_PALETTES[biome];
  ctx.fillStyle = pal.groundColors[1];
  ctx.fillRect(0, 0, w, h);

  const minDim = Math.max(1, Math.min(w, h));
  const unitsPerPx = worldSpanMinAxis / minDim;
  const sampleStep = Math.max(1.2, unitsPerPx * stepPx * 0.9);
  const halfW = w / 2;
  const halfH = h / 2;
  // When zoomed far out in Real-Earth Geo mode (e.g. viewing 250km+ region), sample the Z5 Macro DEM
  // directly so zooming way out renders crisp continuous seas/plains/mountains with ZERO tile eviction!
  const useGeoMacro = Boolean(getActiveGeoTerrainOrigin()) && unitsPerPx > 2.2;
  const sampleElev = (wx: number, wz: number) =>
    useGeoMacro ? (sampleGeoTerrainHeight3D(wx, wz, true) ?? 1.35) : getTerrainHeight3D(wx, wz);
  for (let py = 0; py < h; py += stepPx) {
    const wz = centerZ + (py - halfH) * unitsPerPx;
    for (let px = 0; px < w; px += stepPx) {
      const wx = centerX + (px - halfW) * unitsPerPx;
      const elev = sampleElev(wx, wz);
      const ex = sampleElev(wx + sampleStep, wz);
      const ez = sampleElev(wx, wz + sampleStep);
      const slope = Math.hypot(ex - elev, ez - elev) / sampleStep;

      let col: string;
      if (elev < WATER_LEVEL_3D) {
        if (elev < WATER_LEVEL_3D - 0.95) {
          col = '#1971c2';
        } else if (elev < WATER_LEVEL_3D - 0.35) {
          col = '#339af0';
        } else {
          col = ((px + py) / stepPx) % 3 === 0 ? '#a5d8ff' : '#74c0fc';
        }
      } else if (
        elev < WATER_LEVEL_3D + 0.48 &&
        (ex < WATER_LEVEL_3D ||
          ez < WATER_LEVEL_3D ||
          sampleElev(wx - sampleStep, wz) < WATER_LEVEL_3D ||
          sampleElev(wx, wz - sampleStep) < WATER_LEVEL_3D)
      ) {
        col = '#e9d8a6';
      } else if (slope > 0.36) {
        col = ex < elev ? pal.cliffColors[3] : pal.cliffColors[0];
      } else if (elev > 7.2) {
        col = pal.groundColors[2];
      } else if (elev > 4.2) {
        col = pal.groundColors[0];
      } else if (elev > 1.9) {
        col = pal.groundColors[1];
      } else {
        col = pal.groundColors[3];
      }
      ctx.fillStyle = col;
      ctx.fillRect(px, py, stepPx, stepPx);
    }
  }
}

/* =========================================================================
   1. SLEEK TOP-RIGHT CORNER MINIMAP BUTTON (Opens Handheld Town Map on Click/Tab)
   ========================================================================= */
export const WorldMapHud: React.FC<WorldMapHudProps> = ({
  biome,
  snapshot,
  onToggleExpand,
}) => {
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pois = useMemo(() => generateRegionalPois(), []);
  const [demTick, setDemTick] = useState(0);

  useEffect(() => subscribeGeoDemLoaded(() => setDemTick((t) => t + 1)), []);

  useEffect(() => {
    const canvas = miniCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const geoOrigin = getActiveGeoTerrainOrigin();
    const span = geoOrigin ? 180 : 84;

    paintTopographicMap(ctx, W, H, snapshot.px, snapshot.pz, span, biome, 4);

    const toScreen = (wx: number, wz: number) => ({
      sx: ((wx - snapshot.px) / span + 0.5) * W,
      sy: ((wz - snapshot.pz) / span + 0.5) * H,
    });

    if (geoOrigin) {
      for (const gc of getProjectedGeoCities()) {
        const { sx, sy } = toScreen(gc.x, gc.z);
        if (sx < 4 || sx > W - 4 || sy < 4 || sy > H - 4) continue;
        ctx.fillStyle = '#161420';
        ctx.fillRect(Math.round(sx - 4), Math.round(sy - 4), 8, 8);
        ctx.fillStyle = gc.city.accentColor;
        ctx.fillRect(Math.round(sx - 3), Math.round(sy - 3), 6, 6);
      }
    }

    for (const poi of pois) {
      if (poi.type === 'lake') continue;
      const { sx, sy } = toScreen(poi.x, poi.z);
      if (sx < 4 || sx > W - 4 || sy < 4 || sy > H - 4) continue;
      ctx.fillStyle = '#161420';
      ctx.fillRect(sx - 4, sy - 4, 8, 8);
      ctx.fillStyle = poi.color;
      ctx.fillRect(sx - 3, sy - 3, 6, 6);
    }

    for (const d of snapshot.dots) {
      const { sx, sy } = toScreen(d.x, d.z);
      if (sx < 2 || sx > W - 2 || sy < 2 || sy > H - 2) continue;
      if (d.kind === 'boss') {
        ctx.fillStyle = '#161420';
        ctx.fillRect(sx - 5, sy - 5, 10, 10);
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(sx - 4, sy - 4, 8, 8);
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      } else if (d.kind === 'trainer') {
        ctx.fillStyle = '#161420';
        ctx.fillRect(sx - 3.5, sy - 3.5, 7, 7);
        ctx.fillStyle = '#ffa94d';
        ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
      } else if (d.kind === 'follower') {
        ctx.fillStyle = '#161420';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
        ctx.fillStyle = '#74c0fc';
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      } else {
        ctx.fillStyle = '#fa5252';
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    }

    // Player Center Directional Arrow
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.atan2(Math.sin(snapshot.facingAngle), -Math.cos(snapshot.facingAngle)));
    ctx.fillStyle = '#161420';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [biome, snapshot, pois, demTick]);

  return (
    <button
      type="button"
      className="surv-minimap-box"
      onClick={onToggleExpand}
      title="点击或按 Tab 在掌机中打开交互式地形地图"
    >
      <span className="mm-cardinal is-n">北</span>
      <canvas ref={miniCanvasRef} width={116} height={116} className="surv-minimap-canvas" />
      <span className="mm-tab-chip">TAB 掌机地图</span>
    </button>
  );
};

/* =========================================================================
   2. FULL-BLEED HANDHELD CONSOLE TOWN MAP VIEW (Floating Collapsible Drawer!)
   ========================================================================= */
interface HandheldWorldMapViewProps {
  data: WorldMapData;
  onClose?: () => void;
  closeLabel?: string;
}

export const HandheldWorldMapView: React.FC<HandheldWorldMapViewProps> = ({
  data,
  onClose,
  closeLabel = '关闭',
}) => {
  const { biome, regionName, snapshot } = data;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 480, h: 430 });
  const pois = useMemo(() => generateRegionalPois(), []);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [highlightType, setHighlightType] = useState<WorldPoi['type'] | null>(null);
  const [focusedPoiId, setFocusedPoiId] = useState<string | null>(null);
  const [poiCycleIdx, setPoiCycleIdx] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const geoOrigin = getActiveGeoTerrainOrigin();
  const [zoom, setZoom] = useState(geoOrigin ? 0.25 : 1.0);
  const [pan, setPan] = useState({ x: 0, z: 0 });
  const [, setIconTick] = useState(0);
  const [demTick, setDemTick] = useState(0);

  useEffect(() => subscribeGeoDemLoaded(() => setDemTick((t) => t + 1)), []);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    dragged: false,
  });

  // Match canvas internal resolution 1:1 with stage box so pixels & circles are NEVER stretched!
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      const nw = Math.max(120, Math.round(r.width));
      const nh = Math.max(120, Math.round(r.height));
      setCanvasSize((prev) => (prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Native non-passive wheel listener for smooth, glitch-free free zoom!
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const clampedDelta = Math.max(-180, Math.min(180, e.deltaY));
      const factor = Math.exp(-clampedDelta * 0.0022);
      setZoom((z) => Math.max(0.015, Number((z * factor).toFixed(4))));
    };
    cv.addEventListener('wheel', onWheelNative, { passive: false });
    return () => cv.removeEventListener('wheel', onWheelNative);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const spanMin = 150 / zoom;
    const minDim = Math.max(1, Math.min(W, H));
    const unitsPerPx = spanMin / minDim;
    const cx = snapshot.px + pan.x;
    const cz = snapshot.pz + pan.z;

    paintTopographicMap(ctx, W, H, cx, cz, spanMin, biome, 3);

    // Subtle crisp square world-grid lines (every 30m world units, scaling naturally with zoom!)
    const gridWorldStep = zoom < 0.35 ? 100 : zoom < 0.85 ? 50 : zoom > 3 ? 10 : 25;
    ctx.strokeStyle = 'rgba(22, 20, 32, 0.14)';
    ctx.lineWidth = 1;
    const minWx = cx - (W / 2) * unitsPerPx;
    const maxWx = cx + (W / 2) * unitsPerPx;
    const minWz = cz - (H / 2) * unitsPerPx;
    const maxWz = cz + (H / 2) * unitsPerPx;
    for (let gx = Math.floor(minWx / gridWorldStep) * gridWorldStep; gx <= maxWx; gx += gridWorldStep) {
      const sx = (gx - cx) / unitsPerPx + W / 2;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
      ctx.stroke();
    }
    for (let gz = Math.floor(minWz / gridWorldStep) * gridWorldStep; gz <= maxWz; gz += gridWorldStep) {
      const sy = (gz - cz) / unitsPerPx + H / 2;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
    }

    const toScreen = (wx: number, wz: number) => ({
      sx: (wx - cx) / unitsPerPx + W / 2,
      sy: (wz - cz) / unitsPerPx + H / 2,
    });

    ctx.imageSmoothingEnabled = false;
    const onIconReady = () => setIconTick((t) => t + 1);

    // Regional POIs — icon-only, fixed screen-pixel size (never scales with zoom, no square frame!)
    const ICON_PX = 18;
    const ICON_HALF = ICON_PX / 2;
    for (const poi of pois) {
      const { sx, sy } = toScreen(poi.x, poi.z);
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      const isHi = highlightType === poi.type;
      const isFocused = focusedPoiId === poi.id;
      if (poi.type === 'lake' && !isHi && !isFocused) continue;
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      if (isHi || isFocused) {
        ctx.fillStyle = isFocused ? 'rgba(255, 224, 102, 0.72)' : 'rgba(255, 224, 102, 0.4)';
        ctx.beginPath();
        ctx.arc(ix, iy, isFocused ? 13 : 11, 0, Math.PI * 2);
        ctx.fill();
      }
      // Subtle grounded pixel shadow directly under icon
      ctx.fillStyle = 'rgba(22, 20, 32, 0.42)';
      ctx.fillRect(ix - 5, iy + 7, 10, 3);
      const ico = getCachedMapIcon(POI_META[poi.type].sprite, onIconReady);
      if (ico) {
        ctx.drawImage(ico, ix - ICON_HALF, iy - ICON_HALF, ICON_PX, ICON_PX);
      }
    }

    // Unlimited User-Placed Custom Pins — crisp standalone pixel pushpin icon only (fixed screen size, tip anchored at sx/sy!)
    pins.forEach((pin) => {
      const { sx, sy } = toScreen(pin.x, pin.z);
      if (sx < -16 || sx > W + 16 || sy < -20 || sy > H + 16) return;
      const px = Math.round(sx);
      const py = Math.round(sy);
      // Ground shadow dot at pin tip
      ctx.fillStyle = 'rgba(22, 20, 32, 0.45)';
      ctx.fillRect(px - 3, py - 1, 6, 3);
      // Dark outline silhouette for crisp pixel pushpin
      ctx.fillStyle = '#161420';
      ctx.fillRect(px - 1, py - 8, 3, 9);       // needle + stem outline
      ctx.fillRect(px - 5, py - 15, 11, 8);    // pin head outline
      ctx.fillRect(px - 4, py - 16, 9, 10);    // rounded top/bottom outline
      // Metallic needle
      ctx.fillStyle = '#dee2e6';
      ctx.fillRect(px, py - 7, 1, 6);
      // Vibrant crimson pixel pin head
      ctx.fillStyle = '#e03131';
      ctx.fillRect(px - 4, py - 14, 9, 6);
      ctx.fillRect(px - 3, py - 15, 7, 8);
      // Bright pixel specular highlight
      ctx.fillStyle = '#ffc9c9';
      ctx.fillRect(px - 3, py - 14, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 3, py - 14, 1, 1);
    });

    // Live Entities (icon-only for Boss, crisp fixed-size pixel dots for followers/trainers/wild)
    for (const d of snapshot.dots) {
      const { sx, sy } = toScreen(d.x, d.z);
      if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
      if (d.kind === 'boss') {
        const bx = Math.round(sx);
        const by = Math.round(sy);
        ctx.fillStyle = 'rgba(22, 20, 32, 0.42)';
        ctx.fillRect(bx - 5, by + 7, 10, 3);
        const bossIco = getCachedMapIcon('/sprites/items/ultra-ball.png', onIconReady);
        if (bossIco) ctx.drawImage(bossIco, bx - ICON_HALF, by - ICON_HALF, ICON_PX, ICON_PX);
      } else if (d.kind === 'trainer') {
        ctx.fillStyle = '#161420';
        ctx.fillRect(Math.round(sx - 4), Math.round(sy - 4), 8, 8);
        ctx.fillStyle = '#ffa94d';
        ctx.fillRect(Math.round(sx - 3), Math.round(sy - 3), 6, 6);
      } else if (d.kind === 'follower') {
        ctx.fillStyle = '#161420';
        ctx.fillRect(Math.round(sx - 3), Math.round(sy - 3), 6, 6);
        ctx.fillStyle = '#74c0fc';
        ctx.fillRect(Math.round(sx - 2), Math.round(sy - 2), 4, 4);
      } else {
        ctx.fillStyle = '#fa5252';
        ctx.fillRect(Math.round(sx - 1.5), Math.round(sy - 1.5), 3, 3);
      }
    }

    // Real-World Neighbor Cities Overlay (when in World Tour Geo-DEM mode, e.g. Shenzhen <-> Hong Kong!)
    const activeGeo = getActiveGeoTerrainOrigin();
    if (activeGeo) {
      const geoCities = getProjectedGeoCities();
      for (const gc of geoCities) {
        const { sx, sy } = toScreen(gc.x, gc.z);
        if (sx < -40 || sx > W + 40 || sy < -30 || sy > H + 30) continue;
        const distKm = Math.round(Math.hypot(gc.x - snapshot.px, gc.z - snapshot.pz) / GEO_UNITS_PER_KM);
        const cxPin = Math.round(sx);
        const cyPin = Math.round(sy);
        ctx.fillStyle = '#161420';
        ctx.fillRect(cxPin - 6, cyPin - 6, 12, 12);
        ctx.fillStyle = gc.city.accentColor;
        ctx.fillRect(cxPin - 4, cyPin - 4, 8, 8);
        ctx.fillStyle = '#fffdf5';
        ctx.fillRect(cxPin - 1, cyPin - 1, 2, 2);

        const cityTag = distKm <= 2 ? `📍${gc.city.name}` : `${gc.city.name} ${distKm}km`;
        ctx.font = 'bold 9px monospace';
        const tw = ctx.measureText(cityTag).width + 8;
        ctx.fillStyle = 'rgba(22, 20, 32, 0.9)';
        ctx.fillRect(Math.round(cxPin - tw / 2), cyPin - 20, tw, 13);
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(cxPin - tw / 2), cyPin - 20, tw, 13);
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cityTag, cxPin, cyPin - 13);
      }
    }

    // High-Visibility Hero Marker (clean directional arrow icon only, fixed screen size!)
    const pPos = toScreen(snapshot.px, snapshot.pz);
    const heroOnScreen = pPos.sx >= 12 && pPos.sx <= W - 12 && pPos.sy >= 12 && pPos.sy <= H - 12;
    if (heroOnScreen) {
      ctx.save();
      ctx.translate(pPos.sx, pPos.sy);
      ctx.rotate(Math.atan2(Math.sin(snapshot.facingAngle), -Math.cos(snapshot.facingAngle)));
      ctx.fillStyle = '#161420';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(8, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5.5, 5.5);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-5.5, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#161420';
      ctx.fillRect(Math.round(pPos.sx - 13), Math.round(pPos.sy + 11), 26, 12);
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('主角', pPos.sx, pPos.sy + 17);
    } else {
      const dxH = pPos.sx - W / 2;
      const dyH = pPos.sy - H / 2;
      const ang = Math.atan2(dyH, dxH);
      const pad = 20;
      const scaleEdge = Math.min(
        Math.abs(dxH) > 0.01 ? (W / 2 - pad) / Math.abs(dxH) : 1e6,
        Math.abs(dyH) > 0.01 ? (H / 2 - pad) / Math.abs(dyH) : 1e6,
      );
      const ex = W / 2 + dxH * scaleEdge;
      const ey = H / 2 + dyH * scaleEdge;
      const distM = Math.round(Math.hypot(pan.x, pan.z));

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = '#161420';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(4.8, 4.2);
      ctx.lineTo(0, 1.8);
      ctx.lineTo(-4.8, 4.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#161420';
      ctx.fillRect(Math.round(ex - 22), Math.round(ey + 9), 44, 12);
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`主角 ${distM}m`, ex, ey + 15);
    }
  }, [biome, snapshot, pois, pins, highlightType, focusedPoiId, zoom, pan, canvasSize, demTick]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current.dragged) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const minDim = Math.max(1, Math.min(rect.width, rect.height));
    const unitsPerPx = (150 / zoom) / minDim;
    const wx = snapshot.px + pan.x + (e.clientX - rect.left - rect.width / 2) * unitsPerPx;
    const wz = snapshot.pz + pan.z + (e.clientY - rect.top - rect.height / 2) * unitsPerPx;

    const nearIdx = pins.findIndex((p) => Math.hypot(p.x - wx, p.z - wz) < unitsPerPx * 14);
    if (nearIdx >= 0) {
      sound.play('cancel');
      setPins((prev) => prev.filter((_, i) => i !== nearIdx));
      return;
    }
    sound.play('confirm');
    setPins((prev) => [...prev, { id: `pin_${Date.now()}_${Math.random()}`, x: wx, z: wz }]);
  };

  const handleFocusPoiType = (type: WorldPoi['type']) => {
    const matches = pois.filter((p) => p.type === type);
    if (matches.length === 0) return;
    sound.play('confirm');
    const prevIdx = highlightType === type ? (poiCycleIdx[type] ?? 0) : -1;
    const nextIdx = (prevIdx + 1) % matches.length;
    const target = matches[nextIdx];
    setHighlightType(type);
    setFocusedPoiId(target.id);
    setPoiCycleIdx((prev) => ({ ...prev, [type]: nextIdx }));
    // Smoothly auto-pan directly onto the chosen POI!
    setPan({ x: target.x - snapshot.px, z: target.z - snapshot.pz });
  };

  const poiTypes = (Object.keys(POI_META) as WorldPoi['type'][]).map((type) => ({
    type,
    ...POI_META[type],
    count: pois.filter((p) => p.type === type).length,
  }));

  return (
    <div className="lcd-map-fullbleed">
      <div className="lcd-map-stage is-fullbleed" ref={stageRef}>
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className="lcd-map-canvas"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              lastX: e.clientX,
              lastY: e.clientY,
              dragged: false,
            };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;
            if (Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) > 4) {
              dragRef.current.dragged = true;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const unitsPerPx = (150 / zoom) / Math.max(1, Math.min(rect.width, rect.height));
            setPan((p) => ({
              x: p.x - dx * unitsPerPx,
              z: p.z - dy * unitsPerPx,
            }));
          }}
          onPointerUp={(e) => {
            dragRef.current.active = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // ignore
            }
          }}
          onClick={handleCanvasClick}
        />

        {/* Top-Left Floating Region & Coords Chip */}
        <div className="lcd-map-float-tl">
          <PixelItemImg src="/sprites/items/poke-radar.png" size={14} />
          <strong>{regionName}</strong>
          {(() => {
            const g = worldToGeo(snapshot.px, snapshot.pz);
            if (g) {
              return (
                <span>
                  {Math.abs(g.lat).toFixed(2)}°{g.lat >= 0 ? 'N' : 'S'}, {Math.abs(g.lng).toFixed(2)}°{g.lng >= 0 ? 'E' : 'W'}
                </span>
              );
            }
            return (
              <span>
                ({Math.round(snapshot.px)}, {Math.round(snapshot.pz)})
              </span>
            );
          })()}
        </div>

        {/* Top-Right Floating Drawer Toggle & Close Controls */}
        <div className="lcd-map-float-tr">
          <button
            type="button"
            className={`lcd-map-float-btn ${drawerOpen ? 'is-active' : ''}`}
            onClick={() => {
              sound.play('cursor');
              setDrawerOpen((v) => !v);
            }}
          >
            {drawerOpen ? '收起地点' : '地点导航'}
          </button>
          {onClose && (
            <button type="button" className="lcd-map-float-btn is-close" onClick={onClose}>
              {closeLabel}
            </button>
          )}
        </div>

        {/* Bottom-Left Retro Pixel Compass Rose + Live Zoom Scale */}
        <div className="wm-compass-rose is-lcd" aria-label="指南针">
          <svg viewBox="0 0 40 40" width="38" height="38" shapeRendering="crispEdges">
            <rect x="2" y="2" width="36" height="36" fill="#fffdf4" stroke="#161420" strokeWidth="2.5" />
            <rect x="5" y="5" width="30" height="30" fill="#f1ece0" stroke="#c8bfa8" strokeWidth="1" />
            <polygon points="20,8 23,20 17,20" fill="#e03131" stroke="#161420" strokeWidth="1" />
            <polygon points="20,32 23,20 17,20" fill="#adb5bd" stroke="#161420" strokeWidth="1" />
            <rect x="18.5" y="18.5" width="3" height="3" fill="#ffe066" stroke="#161420" strokeWidth="1" />
          </svg>
          <span className="wm-rose-lbl is-n">N</span>
          <span className="wm-rose-lbl is-s">S</span>
          <span className="wm-rose-lbl is-w">W</span>
          <span className="wm-rose-lbl is-e">E</span>
          <span className="wm-rose-zoom">
            ×{zoom >= 10 ? zoom.toFixed(0) : zoom.toFixed(2).replace(/\.?0+$/, '')}
          </span>
        </div>

        {/* Bottom-Right Free Zoom + Locate Hero Controls */}
        <div className="wm-zoom-bar is-lcd">
          <button
            type="button"
            title="放大地图"
            onClick={() => {
              sound.play('cursor');
              setZoom((z) => Number((z * 1.35).toFixed(4)));
            }}
          >
            +
          </button>
          <button
            type="button"
            title="缩小地图"
            onClick={() => {
              sound.play('cursor');
              setZoom((z) => Math.max(0.015, Number((z / 1.35).toFixed(4))));
            }}
          >
            −
          </button>
          <button
            type="button"
            className="wm-locate-btn"
            title="快速回到主角位置"
            onClick={() => {
              sound.play('confirm');
              setFocusedPoiId(null);
              setPan({ x: 0, z: 0 });
            }}
          >
            定位
          </button>
          <button
            type="button"
            title="重置 1:1 比例并回到主角"
            onClick={() => {
              sound.play('cursor');
              setFocusedPoiId(null);
              setZoom(1.0);
              setPan({ x: 0, z: 0 });
            }}
          >
            1:1
          </button>
        </div>

        {/* Collapsible Floating POI Navigation Overlay Drawer (Default HIDDEN — never squeezes map layout!) */}
        {drawerOpen && (
          <aside className="lcd-map-drawer scroll-y">
            {geoOrigin && (
              <>
                <div className="lcd-map-side-head">周边真实城市 (可徒步跨城)</div>
                <div className="lcd-map-poi-list">
                  {getProjectedGeoCities()
                    .sort(
                      (a, b) =>
                        Math.hypot(a.x - snapshot.px, a.z - snapshot.pz) -
                        Math.hypot(b.x - snapshot.px, b.z - snapshot.pz),
                    )
                    .slice(0, 5)
                    .map((gc) => {
                      const dKm = Math.round(
                        Math.hypot(gc.x - snapshot.px, gc.z - snapshot.pz) / GEO_UNITS_PER_KM,
                      );
                      return (
                        <button
                          key={gc.city.id}
                          type="button"
                          className="lcd-map-poi-btn"
                          onClick={() => {
                            sound.play('confirm');
                            setPan({ x: gc.x - snapshot.px, z: gc.z - snapshot.pz });
                            setZoom((z) => Math.min(z, 0.18));
                          }}
                        >
                          <span className="lcd-map-poi-ico" style={{ borderColor: gc.city.accentColor }}>
                            <PixelItemImg src="/sprites/items/town-map.png" size={13} />
                          </span>
                          <span className="lcd-map-poi-lbl">{gc.city.name}</span>
                          <em>{dKm}km</em>
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            <div className="lcd-map-side-head">地点导航 (点击定位)</div>
            <div className="lcd-map-poi-list">
              {poiTypes.map((it) => {
                const active = highlightType === it.type;
                return (
                  <button
                    key={it.type}
                    type="button"
                    className={`lcd-map-poi-btn ${active ? 'is-active' : ''}`}
                    onClick={() => handleFocusPoiType(it.type)}
                  >
                    <span className="lcd-map-poi-ico" style={{ borderColor: it.color }}>
                      <PixelItemImg src={it.sprite} size={13} />
                    </span>
                    <span className="lcd-map-poi-lbl">{it.label}</span>
                    <em>×{it.count}</em>
                  </button>
                );
              })}
            </div>

            <div className="lcd-map-pin-bar">
              <strong>自定义标记 ({pins.length})</strong>
              {pins.length > 0 && (
                <button
                  type="button"
                  className="wm-clear-btn"
                  onClick={() => {
                    sound.play('cancel');
                    setPins([]);
                  }}
                >
                  清空
                </button>
              )}
            </div>

            <p className="lcd-map-hint">
              拖拽平移 · 滚轮自由缩放 · 点击地图放置/移除无限标记
            </p>
          </aside>
        )}
      </div>
    </div>
  );
};
