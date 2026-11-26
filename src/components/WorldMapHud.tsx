import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GEO_UNITS_PER_KM,
  PROVINCIAL_AND_WORLD_CAPITALS,
  REAL_INLAND_LAKES,
  REAL_WORLD_CORRIDORS,
  REAL_WORLD_RIVERS,
  classifyRealEarthPixelColor,
  geoToWorld,
  getActiveGeoTerrainOrigin,
  getProjectedGeoCities,
  sampleRealElevationMeters,
  sampleRealHydrographyPixelColor,
  subscribeGeoDemLoaded,
  worldToGeo,
  type GeoDemResolution,
} from '../data/geoTerrain3D';
import {
  getTerrainHeight3D,
  LAKE_BASINS_3D,
  WATER_LEVEL_3D,
  WORLD_RAIL_SEGMENTS_3D,
  WORLD_ROAD_SEGMENTS_3D,
  WORLD_TOWNS_3D,
} from '../data/survivorsTactics';
import { generateTownLayout, hashCitySeed } from '../utils/townStreetGen';
import { SHANGHAI_DISTRICT_LABELS } from '../data/shanghaiMasterplan';
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
  type: 'town' | 'altar' | 'shrine' | 'berry' | 'boulder' | 'chest' | 'lake';
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

export interface WorldMapNavTarget {
  id: string;
  label: string;
  subLabel: string;
  icon: string;
  x: number;
  z: number;
}

export interface WorldMapData {
  biome: BiomeId;
  regionName: string;
  snapshot: LiveMapSnapshot;
  onFastTravelCity?: (cityId: string) => void;
  navTargets?: WorldMapNavTarget[];
  onAutoWalkTo?: (x: number, z: number, label: string) => void;
  onOpenGlobalWorldMap?: () => void;
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
  town: { label: '村庄城镇', color: '#f08c00', sprite: '/sprites/items/poke-ball.png' },
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
  const townPois: WorldPoi[] = WORLD_TOWNS_3D.map((t) => ({
    id: t.id,
    x: t.x,
    z: t.z,
    type: 'town',
    label: t.name,
    color: '#f08c00',
  }));
  const specs: { type: Exclude<WorldPoi['type'], 'lake' | 'town'>; angle: number; dist: number }[] = [
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
  return [...townPois, ...basePois, ...lakePois];
}

/** Real-World Web Mercator Map Tile Cache (Carto Voyager — real streets, rivers, parks, railways & continents!) */
const REAL_MAP_TILE_CACHE = new Map<string, HTMLImageElement | 'loading' | 'err'>();
const MAX_REAL_TILE_CACHE = 260;

function tileFracToLatLng(fx: number, fy: number, z: number): { lat: number; lng: number } {
  const n = 1 << z;
  const lng = (fx / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * fy) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

function latLngToTileFracMap(lat: number, lng: number, z: number): { fx: number; fy: number } {
  const n = 1 << z;
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  return {
    fx: ((lng + 180) / 360) * n,
    fy: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/**
 * Renders genuine Real-World Map Tiles (Carto Voyager / OpenStreetMap) aligned 1:1 with the live 3D GPS coordinate space!
 * Zoomed in: real Shanghai People's Square, Huangpu River, Nanjing Rd, Lujiazui, metro lines & blocks.
 * Zoomed out: real China, Yangtze Estuary, Hangzhou Bay, East China Sea, Korea & Japan.
 * Returns true if Real-Earth Geo mode is active.
 */
function paintRealWorldMapTiles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  centerX: number,
  centerZ: number,
  unitsPerPx: number,
  toScreen: (wx: number, wz: number) => { sx: number; sy: number },
  onTileReady: () => void,
): boolean {
  const origin = getActiveGeoTerrainOrigin();
  if (!origin) return false;

  const centerGeo = worldToGeo(centerX, centerZ, origin);
  if (!centerGeo) return false;

  // Match slippy-map zoom level z (3..17) directly to current screen meters-per-pixel!
  const metersPerPx = (unitsPerPx / origin.unitsPerKm) * 1000;
  const cosLat = Math.max(0.2, Math.cos((centerGeo.lat * Math.PI) / 180));
  const rawZ = Math.log2((156543.03392 * cosLat) / Math.max(0.25, metersPerPx));
  const z = Math.max(3, Math.min(17, Math.round(rawZ)));
  const n = 1 << z;

  const tlGeo = worldToGeo(centerX - (w / 2) * unitsPerPx, centerZ - (h / 2) * unitsPerPx, origin);
  const brGeo = worldToGeo(centerX + (w / 2) * unitsPerPx, centerZ + (h / 2) * unitsPerPx, origin);
  if (!tlGeo || !brGeo) return false;

  const tlFrac = latLngToTileFracMap(tlGeo.lat, tlGeo.lng, z);
  const brFrac = latLngToTileFracMap(brGeo.lat, brGeo.lng, z);

  const txMin = Math.floor(Math.min(tlFrac.fx, brFrac.fx));
  const txMax = Math.ceil(Math.max(tlFrac.fx, brFrac.fx));
  const tyMin = Math.max(0, Math.floor(Math.min(tlFrac.fy, brFrac.fy)));
  const tyMax = Math.min(n - 1, Math.ceil(Math.max(tlFrac.fy, brFrac.fy)));

  // Safety cap so extreme pan never floods tile requests (fall back cleanly to pixel topography instead of blanking out!)
  const totalTiles = (txMax - txMin + 1) * (tyMax - tyMin + 1);
  if (totalTiles > 42 || totalTiles <= 0) return false;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  let drawnTiles = 0;

  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let txRaw = txMin; txRaw <= txMax; txRaw++) {
      const tx = ((txRaw % n) + n) % n;
      const key = `${z}/${tx}/${ty}`;
      const cached = REAL_MAP_TILE_CACHE.get(key);

      if (cached && cached !== 'loading' && cached !== 'err') {
        const nw = tileFracToLatLng(txRaw, ty, z);
        const se = tileFracToLatLng(txRaw + 1, ty + 1, z);
        const nwW = geoToWorld(nw.lat, nw.lng, origin);
        const seW = geoToWorld(se.lat, se.lng, origin);
        if (nwW && seW) {
          const p0 = toScreen(nwW.x, nwW.z);
          const p1 = toScreen(seW.x, seW.z);
          ctx.drawImage(
            cached,
            Math.floor(p0.sx),
            Math.floor(p0.sy),
            Math.ceil(p1.sx - p0.sx) + 1,
            Math.ceil(p1.sy - p0.sy) + 1,
          );
          drawnTiles += 1;
        }
      } else if (!cached) {
        if (REAL_MAP_TILE_CACHE.size >= MAX_REAL_TILE_CACHE) {
          const oldest = REAL_MAP_TILE_CACHE.keys().next().value;
          if (oldest) REAL_MAP_TILE_CACHE.delete(oldest);
        }
        REAL_MAP_TILE_CACHE.set(key, 'loading');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          REAL_MAP_TILE_CACHE.set(key, img);
          onTileReady();
        };
        img.onerror = () => {
          REAL_MAP_TILE_CACHE.set(key, 'err');
        };
        // Esri ArcGIS World Street Map (free public CORS-enabled real world street/highway/river map with Chinese/English labels, z/y/x order!)
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${ty}/${tx}`;
      }
    }
  }
  ctx.restore();
  // Only suppress pixel roads/rivers AFTER real street tiles have genuinely loaded onto screen (ZERO blank beige screen!)
  return drawnTiles > 0 && drawnTiles >= Math.ceil(totalTiles * 0.5);
}

/** Helper: draw a tapered road trapezoid polygon from (x1,z1,wStart) to (x2,z2,wEnd) in map screen space! */
function traceTaperedRoadPoly(
  ctx: CanvasRenderingContext2D,
  a: { sx: number; sy: number },
  b: { sx: number; sy: number },
  wStartPx: number,
  wEndPx: number,
) {
  const dx = b.sx - a.sx;
  const dy = b.sy - a.sy;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const nx = -dy / len;
  const ny = dx / len;
  const hs = wStartPx * 0.5;
  const he = wEndPx * 0.5;
  ctx.beginPath();
  ctx.moveTo(a.sx + nx * hs, a.sy + ny * hs);
  ctx.lineTo(b.sx + nx * he, b.sy + ny * he);
  ctx.lineTo(b.sx - nx * he, b.sy - ny * he);
  ctx.lineTo(a.sx - nx * hs, a.sy - ny * hs);
  ctx.closePath();
}

/**
 * REALISTIC TWO-PASS VECTOR CARTOGRAPHY (Google Maps / 高德地图 style!):
 * - Pass 1 draws ALL dark road & plaza casings first (ZERO ugly black semicircular seams cutting across intersections!)
 * - Pass 2 draws merged asphalt/boulevard fills, exact tapered lane transitions (widthStart -> widthEnd), green central medians, circular Grand Plazas & fountains
 * - Pass 3 draws Inter-City High-Speed Rail / Metro corridors + Station Nodes + Expressway Route Shields
 * - Pass 4 draws 2.5D shaded rotated building footprints + crisp POI badges (🏥🏪🏨🍜🗼)
 */
function paintRoadsAndTownsOnMap(
  ctx: CanvasRenderingContext2D,
  toScreen: (wx: number, wz: number) => { sx: number; sy: number },
  unitsPerPx: number,
  detailed: boolean,
  skipPixelRoadOverlay = false,
) {
  const activeGeo = getActiveGeoTerrainOrigin();
  const invScale = 1 / Math.max(0.1, unitsPerPx);
  const casingExtra = detailed ? 2.4 : 1.2;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ==================== REAL-EARTH GEO MODE: PIXEL-ART REAL CHINA/JAPAN CORRIDORS + ASYMMETRIC DOWNTOWN STREETS! ====================
  if (activeGeo) {
    if (skipPixelRoadOverlay) {
      // Live ArcGIS real street layer is active: only draw subtle ocean routes when zoomed far out
      if (detailed && unitsPerPx > 3.5) {
        for (const cor of REAL_WORLD_CORRIDORS) {
          if (cor.kind !== 'ferry') continue;
          const pts: { sx: number; sy: number }[] = [];
          for (const [lat, lng] of cor.points) {
            const wp = geoToWorld(lat, lng, activeGeo);
            if (wp) pts.push(toScreen(wp.x, wp.z));
          }
          if (pts.length < 2) continue;
          ctx.strokeStyle = 'rgba(25, 113, 194, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(pts[0].sx, pts[0].sy);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
      return;
    }

    // Pre-collect visible city screen positions so river, lake & highway labels NEVER overlap city names!
    const cityPinScreenBoxes: { sx: number; sy: number }[] = [];
    for (const gc of getProjectedGeoCities()) {
      const p = toScreen(gc.x, gc.z);
      cityPinScreenBoxes.push({ sx: p.sx, sy: p.sy - 8 });
    }
    if (unitsPerPx > 1.2) {
      for (const cap of PROVINCIAL_AND_WORLD_CAPITALS) {
        if (cap.tier === 'provincial' && unitsPerPx > 260) continue;
        const wp = geoToWorld(cap.lat, cap.lng, activeGeo);
        if (wp) {
          const p = toScreen(wp.x, wp.z);
          cityPinScreenBoxes.push({ sx: p.sx, sy: p.sy - 8 });
        }
      }
    }
    const placedGeoLabels: { sx: number; sy: number; w: number; h: number }[] = [];
    const canPlaceGeoLabel = (sx: number, sy: number, w: number, h = 14): boolean => {
      for (const cp of cityPinScreenBoxes) {
        if (Math.abs(sx - cp.sx) < w * 0.5 + 34 && Math.abs(sy - cp.sy) < h * 0.5 + 16) return false;
      }
      for (const pl of placedGeoLabels) {
        if (Math.abs(sx - pl.sx) < (w + pl.w) * 0.5 + 8 && Math.abs(sy - pl.sy) < (h + pl.h) * 0.5 + 6) {
          return false;
        }
      }
      placedGeoLabels.push({ sx, sy, w, h });
      return true;
    };

    // 0. Real-World River & Lake Labels ONLY (actual river channels, shoals, sandbars & lakes are carved directly into the pixel terrain raster — ZERO vector lines!)
    for (const riv of REAL_WORLD_RIVERS) {
      if (!detailed || unitsPerPx <= 2.2 || unitsPerPx >= 160) continue;
      ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
      const rw = ctx.measureText(riv.name).width + 8;
      for (const frac of [0.55, 0.36, 0.72, 0.24]) {
        const idx = Math.min(riv.points.length - 1, Math.max(0, Math.floor(riv.points.length * frac)));
        const [mLat, mLng] = riv.points[idx];
        const elev = sampleRealElevationMeters(mLat, mLng, 'macro');
        if (elev !== null && elev <= 0.6) continue;
        const wp = geoToWorld(mLat, mLng, activeGeo);
        if (!wp) continue;
        const mid = toScreen(wp.x, wp.z);
        if (!canPlaceGeoLabel(mid.sx, mid.sy, rw, 14)) continue;
        ctx.fillStyle = '#0b3d66';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(riv.name, mid.sx + 1, mid.sy + 1);
        ctx.fillStyle = '#d0ebff';
        ctx.fillText(riv.name, mid.sx, mid.sy);
        break;
      }
    }
    if (detailed && unitsPerPx > 0.35 && unitsPerPx < 14) {
      for (const dl of SHANGHAI_DISTRICT_LABELS) {
        if (dl.tier === 'city' && unitsPerPx < 1.3) continue;
        if (dl.tier === 'town' && unitsPerPx > 4.6) continue;
        const wp = geoToWorld(dl.lat, dl.lng, activeGeo);
        if (!wp) continue;
        const lp = toScreen(wp.x, wp.z);
        if (lp.sx < 18 || lp.sx > ctx.canvas.width - 18 || lp.sy < 18 || lp.sy > ctx.canvas.height - 18) continue;
        ctx.font =
          dl.tier === 'city'
            ? 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif'
            : 'bold 9px "PingFang SC", "Microsoft YaHei", sans-serif';
        const lw = ctx.measureText(dl.name).width + 8;
        if (!canPlaceGeoLabel(lp.sx, lp.sy, lw, 14)) continue;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = dl.tier === 'island' ? 'rgba(15, 45, 75, 0.85)' : 'rgba(255, 252, 245, 0.82)';
        ctx.fillText(dl.name, lp.sx + 1, lp.sy + 1);
        ctx.fillStyle = dl.tier === 'city' ? '#1e293b' : dl.tier === 'island' ? '#e7f5ff' : '#334155';
        ctx.fillText(dl.name, lp.sx, lp.sy);
      }
    }
    if (detailed && unitsPerPx > 0.22 && unitsPerPx < 85) {
      for (const lk of REAL_INLAND_LAKES) {
        if (lk.rxDeg < 0.08 && unitsPerPx > 6) continue;
        const wp = geoToWorld(lk.lat, lk.lng, activeGeo);
        if (!wp) continue;
        const lp = toScreen(wp.x, wp.z);
        ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
        const lw = ctx.measureText(lk.name).width + 8;
        if (!canPlaceGeoLabel(lp.sx, lp.sy, lw, 14)) continue;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0b3d66';
        ctx.fillText(lk.name, lp.sx + 1, lp.sy + 1);
        ctx.fillStyle = '#e7f5ff';
        ctx.fillText(lk.name, lp.sx, lp.sy);
      }
    }

    // 1. Real-Geography Curved Inter-City Highways, High-Speed Rail / Shinkansen & Ocean Routes (matching GBA pixel-art map palette!)
    for (const cor of REAL_WORLD_CORRIDORS) {
      const pts: { sx: number; sy: number }[] = [];
      for (const [lat, lng] of cor.points) {
        const wp = geoToWorld(lat, lng, activeGeo);
        if (wp) pts.push(toScreen(wp.x, wp.z));
      }
      if (pts.length < 2) continue;

      if (cor.kind === 'ferry') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
        ctx.lineWidth = detailed ? 1.6 : 1.0;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pts[0].sx, pts[0].sy);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      if (cor.kind === 'highway') {
        const w = detailed ? Math.max(2.6, Math.min(7, 18 * invScale)) : 1.8;
        ctx.strokeStyle = '#3b4252';
        ctx.lineWidth = w + 1.8;
        ctx.beginPath();
        ctx.moveTo(pts[0].sx, pts[0].sy);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
        ctx.stroke();

        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(pts[0].sx, pts[0].sy);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
        ctx.stroke();

        if (detailed && unitsPerPx > 1.8) {
          ctx.font = 'bold 8px monospace';
          const tw = ctx.measureText(cor.label).width + 6;
          for (const frac of [0.5, 0.33, 0.67]) {
            const mid = pts[Math.min(pts.length - 1, Math.floor(pts.length * frac))];
            if (!canPlaceGeoLabel(mid.sx, mid.sy, tw + 4, 14)) continue;
            ctx.fillStyle = '#2b8a3e';
            ctx.fillRect(Math.round(mid.sx - tw / 2), Math.round(mid.sy - 6), tw, 12);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.9;
            ctx.strokeRect(Math.round(mid.sx - tw / 2), Math.round(mid.sy - 6), tw, 12);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cor.label, mid.sx, mid.sy + 0.5);
            break;
          }
        }
      } else if (cor.kind === 'rail') {
        ctx.strokeStyle = '#1e2430';
        ctx.lineWidth = detailed ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(pts[0].sx, pts[0].sy);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
        ctx.stroke();

        ctx.strokeStyle = '#f8f9fa';
        ctx.lineWidth = detailed ? 1.1 : 0.7;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pts[0].sx, pts[0].sy);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 2. EVERY Visible Real-Earth City's UNIQUE Tensor-Field GBA Pixel-Art Masterplan
    // Visible seamlessly up to regional zoom (unitsPerPx < 9.5) right on top of the real-scale metropolitan built-up footprint!
    if (unitsPerPx < 9.5) {
      const projected = getProjectedGeoCities();
      const citiesToRender: { id: string; name: string; x: number; z: number }[] = [];
      const activeId = activeGeo.startCityId ?? 'shanghai';
      citiesToRender.push({ id: activeId, name: activeGeo.startCityName, x: 0, z: 0 });
      for (const gc of projected) {
        if (gc.city.id === activeId && Math.hypot(gc.x, gc.z) < 40) continue;
        citiesToRender.push({ id: gc.city.id, name: gc.city.name, x: gc.x, z: gc.z });
      }

      const viewW = Math.max(ctx.canvas.width, 1200);
      const viewH = Math.max(ctx.canvas.height, 900);
      const urbanR = Math.max(24, 720 * invScale);
      for (const rc of citiesToRender) {
        const cOrigin = toScreen(rc.x, rc.z);
        if (
          cOrigin.sx + urbanR * 1.2 < 0 ||
          cOrigin.sx - urbanR * 1.2 > viewW ||
          cOrigin.sy + urbanR * 1.2 < 0 ||
          cOrigin.sy - urbanR * 1.2 > viewH
        ) {
          continue;
        }

        const cityAnchor = {
          id: `geo_city_${rc.id}_${Math.round(rc.x)}_${Math.round(rc.z)}`,
          name: rc.name,
          x: rc.x,
          z: rc.z,
          seed: hashCitySeed(rc.id),
          plazaRadius: 680,
          plateauY: 1.65,
          landmarkCityId: rc.id,
        };
        const layout = generateTownLayout(cityAnchor);
        // NO fake circular urban parchment blob! The real coastline-accurate dry-land urban landmass
        // is already painted cleanly by paintTopographicMap (zero ocean bleed-over!).

        // 2B. Lush Green Urban Parks with blue ponds & pixel tree dots
        for (const pk of layout.parks) {
          const pp = toScreen(pk.x, pk.z);
          const pw = pk.w * invScale;
          const pd = pk.d * invScale;
          ctx.fillStyle = '#67b84e';
          ctx.strokeStyle = '#3f7d2e';
          ctx.lineWidth = detailed ? 1.4 : 0.8;
          ctx.fillRect(pp.sx - pw * 0.5, pp.sy - pd * 0.5, pw, pd);
          ctx.strokeRect(pp.sx - pw * 0.5, pp.sy - pd * 0.5, pw, pd);

          if (pk.hasPond && pw >= 10) {
            ctx.fillStyle = '#2f80ed';
            ctx.beginPath();
            ctx.ellipse(pp.sx, pp.sy, pw * 0.22, pd * 0.2, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#90e0ef';
            ctx.fillRect(pp.sx - pw * 0.08, pp.sy - pd * 0.05, Math.max(2, pw * 0.07), 1.5);
          }
          if (detailed && pw >= 16) {
            ctx.fillStyle = '#2b7a2b';
            for (const [ox, oy] of [[-0.32, -0.3], [0.32, -0.28], [-0.3, 0.3], [0.3, 0.3]]) {
              ctx.beginPath();
              ctx.arc(pp.sx + ox * pw, pp.sy + oy * pd, Math.max(2, pw * 0.07), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // 2C. Crisp GBA Urban River Name Tags ONLY (water channel & banks are rendered directly by the pixel terrain engine!)
        for (const riv of layout.rivers) {
          if (detailed && unitsPerPx < 2.2 && riv.points.length >= 2 && riv.name) {
            const mIdx = Math.floor(riv.points.length * 0.5);
            const [rx, rz] = riv.points[mIdx];
            const rp = toScreen(rx, rz);
            ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0b3d66';
            ctx.fillText(riv.name, rp.sx + 1, rp.sy + 1);
            ctx.fillStyle = '#e7f5ff';
            ctx.fillText(riv.name, rp.sx, rp.sy);
          }
        }

        // 2D. Two-Pass Organic City Streets (Crisp real-map highway & white urban street hierarchy across the full metropolitan landmass!)
        const landStreets = layout.streets.filter((s) => !s.isBridge);
        const bridgeStreets = layout.streets.filter((s) => s.isBridge);
        const roadScaleW = (stW: number, isArt: boolean) => {
          const raw = stW * invScale;
          if (unitsPerPx > 6.5) {
            return Math.max(isArt ? 1.25 : 0.65, Math.min(isArt ? 2.6 : 1.25, raw * 0.44));
          }
          if (unitsPerPx > 1.8) {
            return Math.max(isArt ? 1.6 : 0.85, Math.min(isArt ? 3.2 : 1.65, raw * 0.52));
          }
          return Math.max(detailed ? 1.8 : 1.0, raw * 0.82);
        };

        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const inSegView = (a: { sx: number; sy: number }, b: { sx: number; sy: number }) =>
          !(
            (a.sx < -24 && b.sx < -24) ||
            (a.sx > cw + 24 && b.sx > cw + 24) ||
            (a.sy < -24 && b.sy < -24) ||
            (a.sy > ch + 24 && b.sy > ch + 24)
          );

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#64748b';
        ctx.fillStyle = '#64748b';
        for (const st of landStreets) {
          const a = toScreen(st.x1, st.z1);
          const b = toScreen(st.x2, st.z2);
          if (!inSegView(a, b)) continue;
          const w = roadScaleW(st.width, st.kind === 'arterial');
          ctx.lineWidth = w + (detailed ? (unitsPerPx > 2 ? 0.9 : 1.5) : 0.7);
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }

        for (const st of [...landStreets.filter((s) => s.kind !== 'arterial'), ...landStreets.filter((s) => s.kind === 'arterial')]) {
          const a = toScreen(st.x1, st.z1);
          const b = toScreen(st.x2, st.z2);
          if (!inSegView(a, b)) continue;
          const w = roadScaleW(st.width, st.kind === 'arterial');
          ctx.strokeStyle = st.kind === 'arterial' ? '#f6b93b' : '#ffffff';
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }

        ctx.lineCap = 'butt';
        for (const br of bridgeStreets) {
          const a = toScreen(br.x1, br.z1);
          const b = toScreen(br.x2, br.z2);
          const w = Math.max(detailed ? 3.2 : 1.8, br.width * invScale);
          ctx.strokeStyle = br.bridgeStyle === 'waibaidu' ? '#c92a2a' : '#3b4252';
          ctx.lineWidth = w + (detailed ? 3.2 : 1.6);
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();

          ctx.strokeStyle = '#d8dee9';
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }

        // 2E. Colored Urban Metro Lines + White Station Dots
        ctx.lineCap = 'round';
        for (const ml of layout.metroLines) {
          const pts = ml.points.map(([mx, mz]) => toScreen(mx, mz));
          ctx.strokeStyle = ml.color;
          ctx.lineWidth = detailed ? 2.0 : 1.1;
          ctx.beginPath();
          ctx.moveTo(pts[0].sx, pts[0].sy);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
          ctx.stroke();

          if (detailed) {
            for (const st of ml.stations) {
              const sp = toScreen(st.x, st.z);
              ctx.fillStyle = '#ffffff';
              ctx.strokeStyle = ml.color;
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.arc(sp.sx, sp.sy, 3.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              if (unitsPerPx < 1.35 && st.name) {
                ctx.font = 'bold 8px "PingFang SC", "Microsoft YaHei", monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(255, 252, 240, 0.86)';
                const tw = ctx.measureText(st.name).width + 4;
                ctx.fillRect(sp.sx + 5, sp.sy - 5, tw, 10);
                ctx.fillStyle = '#1b202c';
                ctx.fillText(st.name, sp.sx + 7, sp.sy + 0.5);
              }
            }
          }
        }

        // 2F. Dense Urban Buildings, Skyscrapers & Landmarks (Exact Rect / Cylinder / Flatiron-Triangle Footprints!)
        for (const lot of layout.lots) {
          const lp = toScreen(lot.x, lot.z);
          if (lp.sx < -36 || lp.sx > cw + 36 || lp.sy < -36 || lp.sy > ch + 36) continue;
          const bw = Math.max(2.0, lot.width * invScale);
          const bd = Math.max(2.0, lot.depth * invScale);
          const lShape = lot.shape ?? 'rect';
          const traceLotPath = (ox: number, oy: number) => {
            ctx.beginPath();
            if (lShape === 'cylinder') {
              ctx.arc(ox, oy, Math.min(bw, bd) * 0.5, 0, Math.PI * 2);
            } else if (lShape === 'triangle') {
              const tipW = bw * 0.13;
              ctx.moveTo(ox - bw / 2, oy + bd / 2);
              ctx.lineTo(ox + bw / 2, oy + bd / 2);
              ctx.lineTo(ox + tipW, oy - bd / 2);
              ctx.lineTo(ox - tipW, oy - bd / 2);
              ctx.closePath();
            } else {
              ctx.rect(ox - bw / 2, oy - bd / 2, bw, bd);
            }
          };
          ctx.save();
          ctx.translate(lp.sx, lp.sy);
          ctx.rotate(-lot.rotY);
          if (detailed && bw >= 4.5) {
            ctx.fillStyle = 'rgba(38, 28, 20, 0.3)';
            traceLotPath(2, 2);
            ctx.fill();
          }
          ctx.fillStyle =
            lot.kind === 'pokemon_center'
              ? '#fa5252'
              : lot.kind === 'poke_mart'
                ? '#228be6'
                : lot.kind === 'hotel'
                  ? '#e67700'
                  : lot.kind === 'restaurant'
                    ? '#fd7e14'
                    : lot.kind === 'landmark'
                      ? '#e64980'
                      : lot.kind === 'skyscraper'
                        ? '#5aa9e6'
                        : '#b86b52';
          ctx.strokeStyle = '#3b2d22';
          ctx.lineWidth = detailed ? 1.0 : 0.5;
          traceLotPath(0, 0);
          ctx.fill();
          ctx.stroke();
          if (detailed && bw >= 7 && lShape === 'rect') {
            ctx.fillStyle = lot.kind === 'skyscraper' ? 'rgba(220,245,255,0.4)' : 'rgba(255,235,210,0.28)';
            ctx.fillRect(-bw / 2 + 1.2, -bd / 2 + 1.2, bw - 2.4, Math.max(1.8, bd * 0.34));
          }
          ctx.restore();

          if (detailed && bw >= 10 && lot.kind !== 'house' && lot.kind !== 'skyscraper') {
            const sym =
              lot.kind === 'pokemon_center'
                ? '🏥'
                : lot.kind === 'poke_mart'
                  ? '🏪'
                  : lot.kind === 'hotel'
                    ? '🏨'
                    : lot.kind === 'restaurant'
                      ? '🍜'
                      : '🗼';
            ctx.font = `${Math.min(13, Math.max(9, Math.round(bw * 0.5)))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sym, lp.sx, lp.sy);
          }
        }
      }
    }

    ctx.restore();
    return;
  }

  const layouts = WORLD_TOWNS_3D.map((t) => ({ town: t, layout: generateTownLayout(t) }));
  ctx.lineCap = 'butt';

  // ==================== PASS 1: UNIFIED DARK ROAD & PLAZA CASINGS (Zero internal intersection lines!) ====================
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#475569';

  // 1A. Inter-City Expressways casing
  const hwyW = Math.max(detailed ? 4.5 : 2.6, 22.0 * invScale);
  for (const [ax, az, bx, bz] of WORLD_ROAD_SEGMENTS_3D) {
    const a = toScreen(ax, az);
    const b = toScreen(bx, bz);
    traceTaperedRoadPoly(ctx, a, b, hwyW + casingExtra, hwyW + casingExtra);
    ctx.fill();
  }

  // 1B. City Streets (exact tapered trapezoids!), Junction Pads & Grand Central Plazas casing
  for (const { town, layout } of layouts) {
    for (const st of layout.streets) {
      const a = toScreen(st.x1, st.z1);
      const b = toScreen(st.x2, st.z2);
      const ws = Math.max(detailed ? 2.4 : 1.4, (st.widthStart ?? st.width) * invScale);
      const we = Math.max(detailed ? 2.4 : 1.4, (st.widthEnd ?? st.width) * invScale);
      traceTaperedRoadPoly(ctx, a, b, ws + casingExtra, we + casingExtra);
      ctx.fill();
    }
    for (const jn of layout.junctions) {
      const jp = toScreen(jn.x, jn.z);
      const jw = Math.max(detailed ? 3.5 : 2.0, jn.width * invScale) + casingExtra;
      if (jn.width >= 40) {
        ctx.save();
        ctx.translate(jp.sx, jp.sy);
        ctx.rotate(-jn.rotY);
        ctx.fillRect(-jw * 0.5, -jw * 0.5, jw, jw);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(jp.sx, jp.sy, jw * 0.54, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Grand Central Circular Plaza casing (r = 32.5m)
    const c = toScreen(town.x, town.z);
    const pR = Math.max(detailed ? 6 : 3.5, 32.5 * invScale) + casingExtra * 0.6;
    ctx.beginPath();
    ctx.arc(c.sx, c.sy, pR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ==================== PASS 2: MERGED ROAD FILLS, TAPERS, GREEN MEDIANS & PLAZAS ====================
  // 2A. Inter-City Expressways (Golden-amber Google Maps highway style + crisp center lane dashes!)
  for (const [ax, az, bx, bz] of WORLD_ROAD_SEGMENTS_3D) {
    const a = toScreen(ax, az);
    const b = toScreen(bx, bz);
    ctx.fillStyle = '#ffcb57';
    traceTaperedRoadPoly(ctx, a, b, hwyW, hwyW);
    ctx.fill();

    if (detailed && hwyW >= 5) {
      ctx.strokeStyle = '#fff9db';
      ctx.lineWidth = Math.max(1, hwyW * 0.08);
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 2B. City Street Network (All fills merge seamlessly with ZERO black end-cap seams!)
  for (const { town, layout } of layouts) {
    // Draw Alleys -> Collector Streets -> 8-Lane Boulevards -> Junction Pads -> Central Plaza in clean hierarchy order
    const orderedStreets = [
      ...layout.streets.filter((s) => s.kind === 'alley'),
      ...layout.streets.filter((s) => s.kind === 'street'),
      ...layout.streets.filter((s) => s.kind === 'arterial'),
    ];
    for (const st of orderedStreets) {
      const a = toScreen(st.x1, st.z1);
      const b = toScreen(st.x2, st.z2);
      const ws = Math.max(detailed ? 2.4 : 1.4, (st.widthStart ?? st.width) * invScale);
      const we = Math.max(detailed ? 2.4 : 1.4, (st.widthEnd ?? st.width) * invScale);

      // Wide sidewalk shoulder tint on boulevards & collectors when zoomed in
      if (detailed && st.kind !== 'alley' && ws >= 8) {
        ctx.fillStyle = '#e8e2d5';
        traceTaperedRoadPoly(ctx, a, b, ws, we);
        ctx.fill();
        ctx.fillStyle = st.kind === 'arterial' ? '#ffd97d' : '#f8f5ec';
        traceTaperedRoadPoly(ctx, a, b, ws * 0.78, we * 0.78);
        ctx.fill();
      } else {
        ctx.fillStyle =
          st.kind === 'arterial' ? '#ffd97d' : st.kind === 'street' ? '#f8f5ec' : '#e5dfd2';
        traceTaperedRoadPoly(ctx, a, b, ws, we);
        ctx.fill();
      }

      // Lush Green Central Median Strip down 8-Lane Boulevards!
      if (st.kind === 'arterial' && ws >= 9) {
        ctx.fillStyle = '#40c057';
        traceTaperedRoadPoly(ctx, a, b, Math.max(1.6, ws * 0.12), Math.max(1.6, we * 0.12));
        ctx.fill();
      }
    }

    // Seamless Junction Fill Pads (smooth circular fillets on ring/fork nodes + merged square hubs on 8-lane crossroads!)
    for (const jn of layout.junctions) {
      const jp = toScreen(jn.x, jn.z);
      const jw = Math.max(detailed ? 3.5 : 2.0, jn.width * invScale);
      if (jn.width >= 40) {
        ctx.save();
        ctx.translate(jp.sx, jp.sy);
        ctx.rotate(-jn.rotY);
        ctx.fillStyle = '#ffd97d';
        ctx.fillRect(-jw * 0.5, -jw * 0.5, jw, jw);
        ctx.restore();
      } else {
        ctx.fillStyle = '#f8f5ec';
        ctx.beginPath();
        ctx.arc(jp.sx, jp.sy, jw * 0.54, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Grand Central Circular Plaza (Stone terrace + green park ring + shimmering blue fountain dot!)
    const c = toScreen(town.x, town.z);
    const pR = Math.max(detailed ? 6 : 3.5, 32.5 * invScale);
    ctx.fillStyle = '#efeae0';
    ctx.beginPath();
    ctx.arc(c.sx, c.sy, pR, 0, Math.PI * 2);
    ctx.fill();

    if (pR >= 7) {
      ctx.strokeStyle = '#d4cbb8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, pR * 0.78, 0, Math.PI * 2);
      ctx.stroke();

      // Central marble fountain turquoise water icon!
      ctx.fillStyle = '#3bc9db';
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, Math.max(2.2, pR * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ==================== PASS 3: INTER-CITY & URBAN HIGH-SPEED RAIL / METRO NETWORK ====================
  const drawRailLine = (x1: number, z1: number, x2: number, z2: number, wBase: number) => {
    const a = toScreen(x1, z1);
    const b = toScreen(x2, z2);
    ctx.strokeStyle = '#2b303a';
    ctx.lineWidth = Math.max(2.2, wBase * invScale);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();

    ctx.strokeStyle = '#f8f9fa';
    ctx.lineWidth = Math.max(1.1, wBase * 0.48 * invScale);
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  for (const [ax, az, bx, bz] of WORLD_RAIL_SEGMENTS_3D) {
    drawRailLine(ax, az, bx, bz, 5.2);
  }
  for (const { layout } of layouts) {
    for (const rl of layout.rail) {
      drawRailLine(rl.x1, rl.z1, rl.x2, rl.z2, 4.6);
    }
  }

  // ==================== PASS 4: 2.5D SHADED BUILDING FOOTPRINTS & FACILITY ICONS ====================
  for (const { town, layout } of layouts) {
    for (const lot of layout.lots) {
      const lp = toScreen(lot.x, lot.z);
      const bw = Math.max(2.0, lot.width * invScale);
      const bd = Math.max(2.0, lot.depth * invScale);
      const lShape = lot.shape ?? 'rect';
      const traceLotPath = (ox: number, oy: number) => {
        ctx.beginPath();
        if (lShape === 'cylinder') {
          ctx.arc(ox, oy, Math.min(bw, bd) * 0.5, 0, Math.PI * 2);
        } else if (lShape === 'triangle') {
          const tipW = bw * 0.13;
          ctx.moveTo(ox - bw / 2, oy + bd / 2);
          ctx.lineTo(ox + bw / 2, oy + bd / 2);
          ctx.lineTo(ox + tipW, oy - bd / 2);
          ctx.lineTo(ox - tipW, oy - bd / 2);
          ctx.closePath();
        } else {
          ctx.rect(ox - bw / 2, oy - bd / 2, bw, bd);
        }
      };
      ctx.save();
      ctx.translate(lp.sx, lp.sy);
      ctx.rotate(-lot.rotY);

      if (detailed && bw >= 5) {
        ctx.fillStyle = 'rgba(22, 26, 36, 0.28)';
        traceLotPath(2.2, 2.2);
        ctx.fill();
      }

      ctx.fillStyle =
        lot.kind === 'pokemon_center'
          ? '#ff6b6b'
          : lot.kind === 'poke_mart'
            ? '#339af0'
            : lot.kind === 'hotel'
              ? '#f59f00'
              : lot.kind === 'restaurant'
                ? '#ff922b'
                : lot.kind === 'landmark'
                  ? '#be4bdb'
                  : lot.kind === 'skyscraper'
                    ? '#5aa9e6'
                    : '#d8c5b0';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = detailed ? 1.0 : 0.6;
      traceLotPath(0, 0);
      ctx.fill();
      ctx.stroke();

      if (detailed && bw >= 9 && lShape === 'rect') {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(-bw / 2 + 1.5, -bd / 2 + 1.5, bw - 3, Math.max(2, bd * 0.35));
      }
      ctx.restore();

      // Tiny crisp facility badge on flagship buildings when zoomed in!
      if (detailed && bw >= 11 && lot.kind !== 'house') {
        const sym =
          lot.kind === 'pokemon_center'
            ? '🏥'
            : lot.kind === 'poke_mart'
              ? '🏪'
              : lot.kind === 'hotel'
                ? '🏨'
                : lot.kind === 'restaurant'
                  ? '🍜'
                  : '🗼';
        ctx.font = `${Math.min(13, Math.max(9, Math.round(bw * 0.45)))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym, lp.sx, lp.sy);
      }
    }

    // High-Speed Rail Station Badge
    if (detailed) {
      const stP = toScreen(layout.stationX, layout.stationZ);
      ctx.fillStyle = '#1864ab';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(stP.sx, stP.sy, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crisp City Name Banner right above Central Plaza!
      const c = toScreen(town.x, town.z);
      ctx.font = 'bold 11px monospace';
      const label = `🏙️ ${town.name}`;
      const tw = ctx.measureText(label).width + 12;
      const lx = Math.round(c.sx - tw / 2);
      const ly = Math.round(c.sy - 28);
      ctx.fillStyle = 'rgba(18, 22, 34, 0.92)';
      ctx.fillRect(lx, ly, tw, 17);
      ctx.strokeStyle = '#ffd43b';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(lx, ly, tw, 17);
      ctx.fillStyle = '#fff9db';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, c.sx, ly + 8.8);
    }
  }

  // ==================== PASS 5: EXPRESSWAY ROUTE SHIELDS (G2 京沪 / G15 沪广 / 沪东 / 沪西) ====================
  if (detailed) {
    const shields: { x: number; z: number; code: string }[] = [
      { x: 0, z: -485, code: 'G2 京沪高速' },
      { x: 0, z: 145, code: 'G15 沪广高速' },
      { x: 310, z: -210, code: 'G40 沪东跨海' },
      { x: -310, z: -210, code: 'G50 沪京西线' },
    ];
    ctx.font = 'bold 9px monospace';
    for (const sh of shields) {
      const sp = toScreen(sh.x, sh.z);
      const tw = ctx.measureText(sh.code).width + 8;
      ctx.fillStyle = '#2b8a3e';
      ctx.fillRect(Math.round(sp.sx - tw / 2), Math.round(sp.sy - 7), tw, 14);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sp.sx - tw / 2), Math.round(sp.sy - 7), tw, 14);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sh.code, sp.sx, sp.sy + 0.5);
    }
  }

  ctx.restore();
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
  ctx.fillStyle = '#1864ab';
  ctx.fillRect(0, 0, w, h);

  const minDim = Math.max(1, Math.min(w, h));
  const unitsPerPx = worldSpanMinAxis / minDim;
  const sampleStep = Math.max(1.2, unitsPerPx * stepPx * 0.9);
  const halfW = w / 2;
  const halfH = h / 2;
  const activeGeo = getActiveGeoTerrainOrigin();

  // Use Z9 ('detail', ~300m/px) across the entire metropolitan zoom (unitsPerPx <= 10.5) so Changxing, Hengsha, Chongming & Pudong coastlines stay razor-sharp!
  const demRes: GeoDemResolution =
    unitsPerPx > 95 ? 'global' : unitsPerPx > 24 ? 'world' : unitsPerPx > 10.5 ? 'macro' : 'detail';

  for (let py = 0; py < h; py += stepPx) {
    const wz = centerZ + (py - halfH) * unitsPerPx;
    const cellY = Math.floor(py / stepPx);
    for (let px = 0; px < w; px += stepPx) {
      const wx = centerX + (px - halfW) * unitsPerPx;
      const cellX = Math.floor(px / stepPx);
      const dither = (cellX + cellY) % 2 === 0;

      if (activeGeo) {
        const geo = worldToGeo(wx, wz, activeGeo);
        if (!geo || geo.lat > 85.05 || geo.lat < -85.05) {
          // Clean polar ocean edge past Top (85°N) and Bottom (-85°S) of the world map
          ctx.fillStyle = dither ? '#0f3d6e' : '#13467d';
          ctx.fillRect(px, py, stepPx, stepPx);
          continue;
        }
        const m =
          sampleRealElevationMeters(geo.lat, geo.lng, demRes) ??
          sampleRealElevationMeters(geo.lat, geo.lng, 'macro') ??
          12;
        const geoE = worldToGeo(wx + sampleStep, wz, activeGeo)!;
        const geoS = worldToGeo(wx, wz + sampleStep, activeGeo)!;
        const geoW = worldToGeo(wx - sampleStep, wz, activeGeo)!;
        const geoN = worldToGeo(wx, wz - sampleStep, activeGeo)!;
        const mE = sampleRealElevationMeters(geoE.lat, geoE.lng, demRes) ?? m;
        const mS = sampleRealElevationMeters(geoS.lat, geoS.lng, demRes) ?? m;
        const mW = sampleRealElevationMeters(geoW.lat, geoW.lng, demRes) ?? m;
        const mN = sampleRealElevationMeters(geoN.lat, geoN.lng, demRes) ?? m;
        const hillShadeM = (m - mE) * 0.7 + (m - mS) * 0.7;
        const nearOcean =
          m <= 0.6
            ? mE > 0.6 || mS > 0.6 || mW > 0.6 || mN > 0.6
            : mE <= 0.6 || mS <= 0.6 || mW <= 0.6 || mN <= 0.6;
        const hydroColor = sampleRealHydrographyPixelColor(
          geo.lat,
          geo.lng,
          wx,
          wz,
          unitsPerPx,
          stepPx,
          m,
          hillShadeM,
          dither,
        );
        ctx.fillStyle = hydroColor ?? classifyRealEarthPixelColor(geo.lat, geo.lng, m, hillShadeM, nearOcean, dither);
        ctx.fillRect(px, py, stepPx, stepPx);
        continue;
      }

      const elev = getTerrainHeight3D(wx, wz);
      const ex = getTerrainHeight3D(wx + sampleStep, wz);
      const ez = getTerrainHeight3D(wx, wz + sampleStep);
      const hillShade = (elev - ex) * 0.8 + (elev - ez) * 0.8;
      let col: string;
      if (elev < WATER_LEVEL_3D) {
        col = elev < WATER_LEVEL_3D - 0.8 ? '#1971c2' : '#339af0';
      } else if (elev > 4.2) {
        col = hillShade > 0.1 ? '#70c457' : pal.groundColors[0];
      } else {
        col = dither ? pal.groundColors[1] : pal.groundColors[3];
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
  const bgCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    cx: number;
    cz: number;
    span: number;
    biome: BiomeId;
    demTick: number;
  } | null>(null);
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

    const toScreen = (wx: number, wz: number) => ({
      sx: ((wx - snapshot.px) / span + 0.5) * W,
      sy: ((wz - snapshot.pz) / span + 0.5) * H,
    });

    // Offscreen 2.4x Static Tile Buffer: eliminates 99% of walking stutter by blitting via GPU drawImage instead of re-rasterizing terrain/roads every step!
    const cacheMult = 2.4;
    const cacheSpan = span * cacheMult;
    const cacheW = Math.round(W * cacheMult);
    const cacheH = Math.round(H * cacheMult);
    let cache = bgCacheRef.current;
    const needRebuild =
      !cache ||
      cache.biome !== biome ||
      cache.demTick !== demTick ||
      cache.span !== cacheSpan ||
      Math.abs(snapshot.px - cache.cx) > span * 0.58 ||
      Math.abs(snapshot.pz - cache.cz) > span * 0.58;

    if (needRebuild) {
      const offCanvas = cache?.canvas ?? document.createElement('canvas');
      offCanvas.width = cacheW;
      offCanvas.height = cacheH;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        const cx = snapshot.px;
        const cz = snapshot.pz;
        const toCacheScreen = (wx: number, wz: number) => ({
          sx: ((wx - cx) / cacheSpan + 0.5) * cacheW,
          sy: ((wz - cz) / cacheSpan + 0.5) * cacheH,
        });
        paintTopographicMap(offCtx, cacheW, cacheH, cx, cz, cacheSpan, biome, 4);
        paintRoadsAndTownsOnMap(offCtx, toCacheScreen, cacheSpan / Math.max(1, cacheW), false, false);
        cache = { canvas: offCanvas, cx, cz, span: cacheSpan, biome, demTick };
        bgCacheRef.current = cache;
      }
    }

    if (cache) {
      const srcX = ((snapshot.px - cache.cx) / cache.span + 0.5) * cache.canvas.width - W * 0.5;
      const srcY = ((snapshot.pz - cache.cz) / cache.span + 0.5) * cache.canvas.height - H * 0.5;
      ctx.drawImage(cache.canvas, srcX, srcY, W, H, 0, 0, W, H);
    }

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
  const [showLiveStreetTiles, setShowLiveStreetTiles] = useState(false);
  const geoOrigin = getActiveGeoTerrainOrigin();
  const [zoom, setZoom] = useState(geoOrigin ? 0.25 : 1.0);
  const [pan, setPan] = useState({ x: 0, z: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [, setIconTick] = useState(0);
  const [demTick, setDemTick] = useState(0);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const rafMoveRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    dist: number;
    zoom: number;
    anchorWx: number;
    anchorWz: number;
  } | null>(null);

  const scheduleCameraSync = (coarse = true) => {
    if (coarse && !isInteracting) setIsInteracting(true);
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      setIsInteracting(false);
    }, 140);
    if (rafMoveRef.current !== null) return;
    rafMoveRef.current = window.requestAnimationFrame(() => {
      rafMoveRef.current = null;
      setZoom(zoomRef.current);
      setPan({ ...panRef.current });
    });
  };

  useEffect(() => {
    const unsub = subscribeGeoDemLoaded(() => setDemTick((t) => t + 1));
    return () => {
      unsub();
      if (rafMoveRef.current !== null) window.cancelAnimationFrame(rafMoveRef.current);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, []);
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
      setZoom((z) => Math.max(0.00036, Math.min(20, Number((z * factor).toFixed(6)))));
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

    const toScreen = (wx: number, wz: number) => ({
      sx: (wx - cx) / unitsPerPx + W / 2,
      sy: (wz - cz) / unitsPerPx + H / 2,
    });

    const onIconReady = () => setIconTick((t) => t + 1);

    // Default: crisp Pixel-Art Real-Earth NASA Topography + Real Curved China/Japan Highways & Exact 1:1 Downtown Streets!
    // Optional 1-click toggle: live ArcGIS Real Street Map tiles!
    paintTopographicMap(ctx, W, H, cx, cz, spanMin, biome, isInteracting ? 7 : 4);
    const hasRealMapTiles = showLiveStreetTiles
      ? paintRealWorldMapTiles(ctx, W, H, cx, cz, unitsPerPx, toScreen, onIconReady)
      : false;

    // Subtle world-grid lines ONLY in pixel map mode
    if (!hasRealMapTiles) {
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
    }

    paintRoadsAndTownsOnMap(ctx, toScreen, unitsPerPx, true, hasRealMapTiles);

    ctx.imageSmoothingEnabled = false;

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

    // Real-World Flagship Cities + All 34 Chinese Provincial Capitals & World Hubs (Collision-Free Labels!)
    const activeGeo = getActiveGeoTerrainOrigin();
    if (activeGeo) {
      const geoCities = getProjectedGeoCities();
      const flagshipIds = new Set(geoCities.map((g) => g.city.id));
      const placedLabels: { x: number; y: number; w: number; h: number }[] = [];
      const overlapsLabel = (x: number, y: number, w: number, h: number) =>
        placedLabels.some(
          (b) => Math.abs(b.x - x) < (b.w + w) * 0.52 && Math.abs(b.y - y) < (b.h + h) * 0.55,
        );

      for (const gc of geoCities) {
        const { sx, sy } = toScreen(gc.x, gc.z);
        if (sx < -40 || sx > W + 40 || sy < -30 || sy > H + 30) continue;
        const distKm = Math.round(Math.hypot(gc.x - snapshot.px, gc.z - snapshot.pz) / GEO_UNITS_PER_KM);
        const cxPin = Math.round(sx);
        const cyPin = Math.round(sy);
        ctx.fillStyle = '#161420';
        ctx.fillRect(cxPin - 5, cyPin - 5, 10, 10);
        ctx.fillStyle = gc.city.accentColor;
        ctx.fillRect(cxPin - 3.5, cyPin - 3.5, 7, 7);
        ctx.fillStyle = '#fffdf5';
        ctx.fillRect(cxPin - 1, cyPin - 1, 2, 2);

        const cityTag =
          unitsPerPx > 90
            ? gc.city.name
            : distKm <= 2
              ? `📍${gc.city.name}`
              : `${gc.city.name} ${distKm}km`;
        ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
        const tw = ctx.measureText(cityTag).width + 8;
        if (!overlapsLabel(cxPin, cyPin - 13, tw, 13)) {
          placedLabels.push({ x: cxPin, y: cyPin - 13, w: tw, h: 13 });
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

      // Provincial Capitals (all 34 Chinese capitals/municipalities/SARs) + Major World Cities!
      if (unitsPerPx > 1.2) {
        for (const cap of PROVINCIAL_AND_WORLD_CAPITALS) {
          if (flagshipIds.has(cap.id)) continue;
          if (cap.tier === 'provincial' && unitsPerPx > 260) continue;
          const wp = geoToWorld(cap.lat, cap.lng, activeGeo);
          if (!wp) continue;
          const { sx, sy } = toScreen(wp.x, wp.z);
          if (sx < -30 || sx > W + 30 || sy < -20 || sy > H + 20) continue;
          const cxPin = Math.round(sx);
          const cyPin = Math.round(sy);
          // Crisp pixel square capital marker (red-gold for Chinese provincial capitals, ivory-blue for world hubs)
          ctx.fillStyle = '#161420';
          ctx.fillRect(cxPin - 3.5, cyPin - 3.5, 7, 7);
          ctx.fillStyle = cap.tier === 'world' ? '#74c0fc' : '#ff6b6b';
          ctx.fillRect(cxPin - 2.5, cyPin - 2.5, 5, 5);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cxPin - 0.5, cyPin - 0.5, 1.5, 1.5);

          ctx.font = 'bold 8.5px "PingFang SC", "Microsoft YaHei", monospace';
          const tw = ctx.measureText(cap.name).width + 6;
          if (!overlapsLabel(cxPin, cyPin - 11, tw, 12)) {
            placedLabels.push({ x: cxPin, y: cyPin - 11, w: tw, h: 12 });
            ctx.fillStyle = 'rgba(20, 24, 36, 0.82)';
            ctx.fillRect(Math.round(cxPin - tw / 2), cyPin - 17, tw, 11);
            ctx.strokeStyle = cap.tier === 'world' ? '#a5d8ff' : '#ffd8a8';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(Math.round(cxPin - tw / 2), cyPin - 17, tw, 11);
            ctx.fillStyle = '#fff9db';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cap.name, cxPin, cyPin - 11.2);
          }
        }
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
  }, [biome, snapshot, pois, pins, highlightType, focusedPoiId, zoom, pan, canvasSize, demTick, isInteracting, showLiveStreetTiles]);

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
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {}
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pointersRef.current.size === 2) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pts = Array.from(pointersRef.current.values());
              const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
              const minDim = Math.max(1, Math.min(rect.width, rect.height));
              const unitsPerPx = (150 / zoomRef.current) / minDim;
              const midSx = (pts[0].x + pts[1].x) / 2 - rect.left;
              const midSy = (pts[0].y + pts[1].y) / 2 - rect.top;
              pinchRef.current = {
                dist: Math.max(12, dist),
                zoom: zoomRef.current,
                anchorWx: snapshot.px + panRef.current.x + (midSx - rect.width / 2) * unitsPerPx,
                anchorWz: snapshot.pz + panRef.current.z + (midSy - rect.height / 2) * unitsPerPx,
              };
              dragRef.current.active = false;
              dragRef.current.dragged = true;
              setIsInteracting(true);
              return;
            }

            if (pointersRef.current.size === 1) {
              dragRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                lastX: e.clientX,
                lastY: e.clientY,
                dragged: false,
              };
            }
          }}
          onPointerMove={(e) => {
            if (!pointersRef.current.has(e.pointerId)) return;
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (pointersRef.current.size === 2 && pinchRef.current) {
              const rect = e.currentTarget.getBoundingClientRect();
              const pts = Array.from(pointersRef.current.values());
              const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
              const ratio = dist / Math.max(12, pinchRef.current.dist);
              const nextZoom = Math.max(0.00036, Math.min(20, Number((pinchRef.current.zoom * ratio).toFixed(6))));
              const minDim = Math.max(1, Math.min(rect.width, rect.height));
              const unitsPerPxNew = (150 / nextZoom) / minDim;
              const midSx = (pts[0].x + pts[1].x) / 2 - rect.left;
              const midSy = (pts[0].y + pts[1].y) / 2 - rect.top;
              zoomRef.current = nextZoom;
              panRef.current = {
                x: pinchRef.current.anchorWx - snapshot.px - (midSx - rect.width / 2) * unitsPerPxNew,
                z: pinchRef.current.anchorWz - snapshot.pz - (midSy - rect.height / 2) * unitsPerPxNew,
              };
              scheduleCameraSync(true);
              return;
            }

            if (!dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;
            if (Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) > 4) {
              dragRef.current.dragged = true;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const unitsPerPx = (150 / zoomRef.current) / Math.max(1, Math.min(rect.width, rect.height));
            panRef.current = {
              x: panRef.current.x - dx * unitsPerPx,
              z: panRef.current.z - dy * unitsPerPx,
            };
            scheduleCameraSync(true);
          }}
          onPointerUp={(e) => {
            pointersRef.current.delete(e.pointerId);
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}
            if (pointersRef.current.size === 1 && pinchRef.current) {
              pinchRef.current = null;
              const rem = Array.from(pointersRef.current.values())[0];
              dragRef.current = {
                active: true,
                startX: rem.x,
                startY: rem.y,
                lastX: rem.x,
                lastY: rem.y,
                dragged: true,
              };
              return;
            }
            if (pointersRef.current.size < 2) {
              pinchRef.current = null;
            }
            dragRef.current.active = false;
            setIsInteracting(false);
            setZoom(zoomRef.current);
            setPan({ ...panRef.current });
          }}
          onPointerCancel={(e) => {
            pointersRef.current.delete(e.pointerId);
            if (pointersRef.current.size < 2) pinchRef.current = null;
            if (pointersRef.current.size === 0) {
              dragRef.current.active = false;
              setIsInteracting(false);
            }
          }}
          onClick={handleCanvasClick}
        />

        {/* Top-Left Floating Region / City & Coords Chip */}
        <div className="lcd-map-float-tl">
          <PixelItemImg src="/sprites/items/poke-radar.png" size={14} />
          <strong>
            {getActiveGeoTerrainOrigin()?.startCityName ??
              WORLD_TOWNS_3D.find(
                (t) => Math.hypot(snapshot.px - t.x, snapshot.pz - t.z) < t.plazaRadius + 10,
              )?.name ??
              regionName}
          </strong>
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

        {/* Top-Right Floating Drawer Toggle, Map Layer Switch & Close Controls */}
        <div className="lcd-map-float-tr">
          {data.onOpenGlobalWorldMap && (
            <button
              type="button"
              className="lcd-map-float-btn"
              onClick={() => {
                sound.play('confirm');
                onClose?.();
                data.onOpenGlobalWorldMap?.();
              }}
              title="打开全球航线与道馆巡礼大地图（关闭后返回当前游戏）"
            >
              全球地图
            </button>
          )}
          {getActiveGeoTerrainOrigin() && (
            <button
              type="button"
              className={`lcd-map-float-btn ${showLiveStreetTiles ? 'is-active' : ''}`}
              onClick={() => {
                sound.play('cursor');
                setShowLiveStreetTiles((v) => !v);
              }}
              title="切换像素地球地图 / 真实街景底图"
            >
              {showLiveStreetTiles ? '像素地图' : '实景底图'}
            </button>
          )}
          <button
            type="button"
            className={`lcd-map-float-btn ${drawerOpen ? 'is-active' : ''}`}
            onClick={() => {
              sound.play('cursor');
              setDrawerOpen((v) => !v);
            }}
          >
            {drawerOpen ? '收起寻路' : '寻路/导航'}
          </button>
          {onClose && (
            <button type="button" className="lcd-map-float-btn is-close" onClick={onClose}>
              {closeLabel}
            </button>
          )}
        </div>

        {/* Quick 1-Click Auto-Walk to Latest Custom Map Pin! */}
        {pins.length > 0 && data.onAutoWalkTo && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 10,
              transform: 'translateX(-50%)',
              zIndex: 18,
              display: 'flex',
              gap: 6,
            }}
          >
            <button
              type="button"
              className="lcd-map-float-btn is-active"
              style={{
                background: '#ffd43b',
                color: '#161420',
                fontWeight: 900,
                padding: '5px 12px',
              }}
              onClick={() => {
                const targetPin = pins[pins.length - 1];
                sound.play('confirm');
                data.onAutoWalkTo?.(targetPin.x, targetPin.z, `地图标点 (${Math.round(targetPin.x)}, ${Math.round(targetPin.z)})`);
                onClose?.();
              }}
            >
              🧭 自动寻路至最新标点
            </button>
          </div>
        )}

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
            ×{zoom >= 10 ? zoom.toFixed(0) : zoom < 0.01 ? zoom.toFixed(4).replace(/\.?0+$/, '') : zoom.toFixed(2).replace(/\.?0+$/, '')}
          </span>
        </div>

        {/* Bottom-Right Free Zoom + Locate Hero Controls */}
        <div className="wm-zoom-bar is-lcd">
          <button
            type="button"
            title="放大地图"
            onClick={() => {
              sound.play('cursor');
              setZoom((z) => Math.min(20, Number((z * 1.45).toFixed(6))));
            }}
          >
            +
          </button>
          <button
            type="button"
            title="缩小地图"
            onClick={() => {
              sound.play('cursor');
              setZoom((z) => Math.max(0.00036, Number((z / 1.45).toFixed(6))));
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

        {/* Collapsible Floating POI Navigation & Auto-Pathfinding Drawer */}
        {drawerOpen && (
          <aside className="lcd-map-drawer scroll-y">
            {data.navTargets && data.navTargets.length > 0 && data.onAutoWalkTo && (
              <>
                <div className="lcd-map-side-head">🧭 城市设施自动寻路 (A* 避障直达门内)</div>
                <div className="lcd-map-poi-list">
                  {data.navTargets.map((item) => {
                    const distM = Math.round(Math.hypot(item.x - snapshot.px, item.z - snapshot.pz));
                    return (
                      <div
                        key={item.id}
                        style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}
                      >
                        <button
                          type="button"
                          className="lcd-map-poi-btn"
                          style={{ flex: 1, minWidth: 0 }}
                          onClick={() => {
                            sound.play('cursor');
                            setPan({ x: item.x - snapshot.px, z: item.z - snapshot.pz });
                            setZoom(Math.max(zoom, 1.35));
                            setDrawerOpen(false);
                          }}
                          title={`${item.subLabel}（点击在地图上预览位置）`}
                        >
                          <span className="lcd-map-poi-ico">
                            <PixelItemImg src={item.icon} size={13} />
                          </span>
                          <span className="lcd-map-poi-lbl">{item.label}</span>
                          <em>{distM}m</em>
                        </button>
                        <button
                          type="button"
                          className="lcd-map-poi-btn"
                          style={{
                            width: 'auto',
                            flex: '0 0 auto',
                            flexShrink: 0,
                            justifyContent: 'center',
                            padding: '0 8px',
                            background: '#ffd43b',
                            color: '#161420',
                            fontWeight: 900,
                          }}
                          title={`自动寻路前往${item.label}`}
                          onClick={() => {
                            sound.play('confirm');
                            data.onAutoWalkTo?.(item.x, item.z, item.label);
                            onClose?.();
                          }}
                        >
                          寻路
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {geoOrigin && (
              <>
                <div className="lcd-map-side-head">真实城市 (点击预览 / 飞往探索)</div>
                <div className="lcd-map-poi-list">
                  {getProjectedGeoCities()
                    .sort(
                      (a, b) =>
                        Math.hypot(a.x - snapshot.px, a.z - snapshot.pz) -
                        Math.hypot(b.x - snapshot.px, b.z - snapshot.pz),
                    )
                    .map((gc) => {
                      const dKm = Math.round(
                        Math.hypot(gc.x - snapshot.px, gc.z - snapshot.pz) / GEO_UNITS_PER_KM,
                      );
                      const isCurrent = gc.city.id === (geoOrigin.startCityId ?? 'shanghai');
                      return (
                        <div
                          key={gc.city.id}
                          style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}
                        >
                          <button
                            type="button"
                            className={`lcd-map-poi-btn ${isCurrent ? 'is-active' : ''}`}
                            style={{ flex: 1, minWidth: 0 }}
                            onClick={() => {
                              sound.play('confirm');
                              setPan({ x: gc.x - snapshot.px, z: gc.z - snapshot.pz });
                              setZoom(0.28);
                              setDrawerOpen(false);
                            }}
                          >
                            <span className="lcd-map-poi-ico" style={{ borderColor: gc.city.accentColor }}>
                              <PixelItemImg src="/sprites/items/town-map.png" size={13} />
                            </span>
                            <span className="lcd-map-poi-lbl">{gc.city.name}</span>
                            <em>{isCurrent ? '当前' : `${dKm}km`}</em>
                          </button>
                          {data.onFastTravelCity && !isCurrent && (
                            <button
                              type="button"
                              className="lcd-map-poi-btn"
                              style={{
                                width: 'auto',
                                flex: '0 0 auto',
                                flexShrink: 0,
                                justifyContent: 'center',
                                padding: '0 8px',
                                background: '#fff3bf',
                                color: '#212529',
                                fontWeight: 700,
                              }}
                              title={`直飞前往${gc.city.name}探索3D城景`}
                              onClick={() => {
                                sound.play('confirm');
                                data.onFastTravelCity?.(gc.city.id);
                                onClose?.();
                              }}
                            >
                              ✈
                            </button>
                          )}
                        </div>
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
