import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GEO_UNITS_PER_KM,
  REAL_WORLD_CORRIDORS,
  geoToWorld,
  getActiveGeoTerrainOrigin,
  getProjectedGeoCities,
  sampleGeoTerrainHeight3D,
  subscribeGeoDemLoaded,
  worldToGeo,
} from '../data/geoTerrain3D';
import {
  getTerrainHeight3D,
  LAKE_BASINS_3D,
  WATER_LEVEL_3D,
  WORLD_RAIL_SEGMENTS_3D,
  WORLD_ROAD_SEGMENTS_3D,
  WORLD_TOWNS_3D,
} from '../data/survivorsTactics';
import { generateTownLayout } from '../utils/townStreetGen';
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
  const txMax = Math.floor(Math.max(tlFrac.fx, brFrac.fx));
  const tyMin = Math.max(0, Math.floor(Math.min(tlFrac.fy, brFrac.fy)));
  const tyMax = Math.min(n - 1, Math.floor(Math.max(tlFrac.fy, brFrac.fy)));

  // Safety cap so extreme pan never floods tile requests
  if ((txMax - txMin + 1) * (tyMax - tyMin + 1) > 42) return true;

  ctx.save();
  ctx.imageSmoothingEnabled = true;

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
        }
      } else if (!cached) {
        if (REAL_MAP_TILE_CACHE.size >= MAX_REAL_TILE_CACHE) {
          const oldest = REAL_MAP_TILE_CACHE.keys().next().value;
          if (oldest) REAL_MAP_TILE_CACHE.delete(oldest);
        }
        REAL_MAP_TILE_CACHE.set(key, 'loading');
        const sub = ['a', 'b', 'c'][(tx + ty) % 3];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          REAL_MAP_TILE_CACHE.set(key, img);
          onTileReady();
        };
        img.onerror = () => {
          REAL_MAP_TILE_CACHE.set(key, 'err');
        };
        img.src = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${tx}/${ty}.png`;
      }
    }
  }
  ctx.restore();
  return true;
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
) {
  const activeGeo = getActiveGeoTerrainOrigin();
  const invScale = 1 / Math.max(0.1, unitsPerPx);
  const casingExtra = detailed ? 2.4 : 1.2;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ==================== REAL-EARTH GEO MODE: REAL WORLD MAP TILES ALREADY RENDER REAL STREETS, RIVERS & HIGHWAYS! ====================
  if (activeGeo) {
    // Only overlay subtle trans-ocean routes when zoomed far out; never stamp fake cartoon roads over real Shanghai streets!
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
      const bw = Math.max(detailed ? 4 : 2.4, lot.width * invScale);
      const bd = Math.max(detailed ? 3.5 : 2.1, lot.depth * invScale);
      ctx.save();
      ctx.translate(lp.sx, lp.sy);
      ctx.rotate(-lot.rotY);

      // Soft 2.5D southeast architectural cast shadow (Apple Maps / 高德地图 style!)
      if (detailed && bw >= 5) {
        ctx.fillStyle = 'rgba(22, 26, 36, 0.28)';
        ctx.fillRect(-bw / 2 + 2.2, -bd / 2 + 2.2, bw, bd);
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
                  : '#d8c5b0';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = detailed ? 1.0 : 0.6;
      ctx.fillRect(-bw / 2, -bd / 2, bw, bd);
      ctx.strokeRect(-bw / 2, -bd / 2, bw, bd);

      // Subtle inner roof highlight bevel
      if (detailed && bw >= 9) {
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

    const toScreen = (wx: number, wz: number) => ({
      sx: ((wx - snapshot.px) / span + 0.5) * W,
      sy: ((wz - snapshot.pz) / span + 0.5) * H,
    });

    paintTopographicMap(ctx, W, H, snapshot.px, snapshot.pz, span, biome, 4);
    paintRealWorldMapTiles(
      ctx,
      W,
      H,
      snapshot.px,
      snapshot.pz,
      span / Math.max(1, W),
      toScreen,
      () => setDemTick((t) => t + 1),
    );
    paintRoadsAndTownsOnMap(ctx, toScreen, span / Math.max(1, W), false);

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

    const toScreen = (wx: number, wz: number) => ({
      sx: (wx - cx) / unitsPerPx + W / 2,
      sy: (wz - cz) / unitsPerPx + H / 2,
    });

    const onIconReady = () => setIconTick((t) => t + 1);

    // Base map: genuine Real-World Carto Voyager Map Tiles (real Shanghai / China / Japan streets, rivers & highways!)
    // with NASA/SRTM topographic elevation seamlessly underneath while tiles stream in!
    paintTopographicMap(ctx, W, H, cx, cz, spanMin, biome, isInteracting ? 7 : 4);
    const hasRealMapTiles = paintRealWorldMapTiles(ctx, W, H, cx, cz, unitsPerPx, toScreen, onIconReady);

    // Subtle world-grid lines ONLY in fallback procedural mode (never clutter real Carto street map!)
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

    paintRoadsAndTownsOnMap(ctx, toScreen, unitsPerPx, true);

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
  }, [biome, snapshot, pois, pins, highlightType, focusedPoiId, zoom, pan, canvasSize, demTick, isInteracting]);

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
              const nextZoom = Math.max(0.015, Math.min(8, Number((pinchRef.current.zoom * ratio).toFixed(4))));
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
