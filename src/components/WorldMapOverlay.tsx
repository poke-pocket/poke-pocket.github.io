import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIES_CATALOG } from '../data/catalog';
import type { MetaProgressState } from '../data/metaProgression';
import {
  DEFAULT_WORLD_TOUR_STATE,
  HOTEL_TIERS,
  WORLD_CITIES,
  WORLD_LAND_POLYGONS,
  WORLD_ZONES,
  calcFlightTicketCost,
  calcGeoDistanceKm,
  getLocalHomeEcology,
  type HotelTierId,
  type WorldCityDef,
  type WorldTourState,
  type WorldZoneDef,
} from '../data/worldTour';
import type { BiomeId } from '../data/worldTextures3D';
import type { SpeciesId } from '../types/pet';
import { sound } from '../utils/sound';
import { PixelIcon, PixelItemImg } from './PixelSprite';

export interface WorldLaunchPayload {
  cityId: string | null;
  cityName: string;
  biome: BiomeId;
  wildPool: SpeciesId[];
  isGymChallenge: boolean;
  gymName?: string;
  gymBadgeName?: string;
  bossSpecies?: SpeciesId;
  bossName?: string;
  bossTrainerKey?: string;
  bossTrainerName?: string;
  rewardCoins: number;
  hotelTier: HotelTierId | null;
  isHomeTurf: boolean;
}

interface WorldMapOverlayProps {
  coins: number;
  meta: MetaProgressState;
  onUpdateMeta: (updater: (prev: MetaProgressState) => MetaProgressState, coinDelta?: number) => void;
  onLaunchWorldRun: (payload: WorldLaunchPayload) => void;
  onClose: () => void;
}

// =========================================================================
// CONTINUOUS WEB MERCATOR PROJECTION (Supports z = 1.2 -> 18.5 street level!)
// =========================================================================
const MIN_ZOOM = 1.3;
const MAX_ZOOM = 18.5;
const TILE_PX = 256;

function lngToMercX(lng: number): number {
  return (lng + 180) / 360;
}

function latToMercY(lat: number): number {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
}

function mercXToLng(mx: number): number {
  const wrapped = ((mx % 1) + 1) % 1;
  return Number((wrapped * 360 - 180).toFixed(4));
}

function mercYToLat(my: number): number {
  const clamped = Math.max(0.001, Math.min(0.999, my));
  const n = Math.PI - 2 * Math.PI * clamped;
  return Number(((180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))).toFixed(4));
}

function formatRemainingStay(stayUntilTs: number | null, nowMs: number): string {
  if (!stayUntilTs) return '永久免费';
  const diff = stayUntilTs - nowMs;
  if (diff <= 0) return '已退房到期';
  const totalHrs = Math.ceil(diff / 3600_000);
  const days = Math.floor(totalHrs / 24);
  const hrs = totalHrs % 24;
  if (days > 0) return `剩余 ${days}天${hrs}时`;
  return `剩余 ${hrs}小时`;
}

function formatScaleBar(lat: number, zoom: number): { label: string; widthPx: number } {
  const metersPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const targetMeters = metersPerPx * 84;
  const steps = [
    5000000, 2000000, 1000000, 500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20,
  ];
  let chosen = steps[steps.length - 1];
  for (const s of steps) {
    if (s <= targetMeters * 1.35) {
      chosen = s;
      break;
    }
  }
  const widthPx = Math.max(36, Math.min(110, Math.round(chosen / Math.max(0.01, metersPerPx))));
  const label = chosen >= 1000 ? `${chosen / 1000} km` : `${chosen} m`;
  return { label, widthPx };
}

// =========================================================================
// GBA/DS PIXELATED TILE CACHE (Seamless Esri Real-Earth Imagery Z1 -> Z18!)
// =========================================================================
type TileLayerKind = 'earth';

interface CachedTile {
  pixelImg: HTMLCanvasElement;
  rawImg: HTMLImageElement;
}

const TILE_CACHE = new Map<string, CachedTile>();
const TILE_INFLIGHT = new Set<string>();
const MAX_TILE_CACHE = 420;

function tileUrlFor(_layer: TileLayerKind, z: number, x: number, y: number): string {
  // Esri World Imagery: authentic global terrain, mountain relief, rivers, coastlines & street blocks from Z1 to Z18!
  // Zero API key, full global coverage (including China/East Asia), CORS-enabled (`Access-Control-Allow-Origin: *`).
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

/** Downsample + GBA RGB555 vibrant pixel-art quantize a real map tile ONCE on load */
function pixelizeTileImage(img: HTMLImageElement, z: number): HTMLCanvasElement {
  // 84x84 at continental scale (~3px GBA chunks), 96x96 at city/street scale for crisp roads & roofs!
  const sz = z <= 7 ? 84 : 96;
  const c = document.createElement('canvas');
  c.width = sz;
  c.height = sz;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, sz, sz);
  try {
    const id = ctx.getImageData(0, 0, sz, sz);
    const d = id.data;
    const satBoost = z <= 7 ? 1.32 : 1.2;
    const brightLift = z <= 7 ? 1.08 : 1.05;
    const step = z <= 7 ? 20 : 18;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] * brightLift;
      let g = d[i + 1] * brightLift;
      let b = d[i + 2] * brightLift;
      // Retro vibrant GBA palette lift
      const avg = (r + g + b) / 3;
      r = Math.max(0, Math.min(255, avg + (r - avg) * satBoost));
      g = Math.max(0, Math.min(255, avg + (g - avg) * satBoost));
      b = Math.max(0, Math.min(255, avg + (b - avg) * satBoost));
      // Crisp GBA-style color quantization
      d[i] = Math.min(255, Math.round(r / step) * step);
      d[i + 1] = Math.min(255, Math.round(g / step) * step);
      d[i + 2] = Math.min(255, Math.round(b / step) * step);
    }
    ctx.putImageData(id, 0, 0);
  } catch {
    // Fallback if canvas tainted
  }
  return c;
}

function requestTile(layer: TileLayerKind, z: number, x: number, y: number) {
  const key = `${layer}/${z}/${x}/${y}`;
  if (TILE_CACHE.has(key) || TILE_INFLIGHT.has(key)) return;
  TILE_INFLIGHT.add(key);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    TILE_INFLIGHT.delete(key);
    if (TILE_CACHE.size >= MAX_TILE_CACHE) {
      const oldest = TILE_CACHE.keys().next().value;
      if (oldest) TILE_CACHE.delete(oldest);
    }
    TILE_CACHE.set(key, {
      pixelImg: pixelizeTileImage(img, z),
      rawImg: img,
    });
  };
  img.onerror = () => {
    TILE_INFLIGHT.delete(key);
  };
  img.src = tileUrlFor(layer, z, x, y);
}

export const WorldMapOverlay: React.FC<WorldMapOverlayProps> = ({
  coins,
  meta,
  onUpdateMeta,
  onLaunchWorldRun,
  onClose,
}) => {
  const tour: WorldTourState = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
  const nowMs = Date.now();
  const isStayExpired = Boolean(
    tour.currentCityId && tour.stayUntilTs && tour.stayUntilTs <= nowMs,
  );
  const currentCity = useMemo(
    () => WORLD_CITIES.find((c) => c.id === tour.currentCityId) ?? null,
    [tour.currentCityId],
  );

  const [selectedCityId, setSelectedCityId] = useState<string | null>(
    tour.currentCityId ?? 'shanghai',
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<HotelTierId>('inn');
  const [pickHomeMode, setPickHomeMode] = useState(false);
  const [pixelStyle, setPixelStyle] = useState<'pixel' | 'crisp'>('pixel');
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [flightAnim, setFlightAnim] = useState<{
    fromLng: number;
    fromLat: number;
    toLng: number;
    toLat: number;
    targetCity: WorldCityDef | null;
    hotelTier: HotelTierId | null;
    startedAt: number;
    durationMs: number;
  } | null>(null);

  // Continuous Web Mercator Camera: (mx, my) in [0..1] + zoom in [1.3 .. 18.5]
  const [cam, setCam] = useState<{ mx: number; my: number; zoom: number }>(() => {
    const focusLng = currentCity?.lng ?? tour.homeCoords?.lng ?? 118.5;
    const focusLat = currentCity?.lat ?? tour.homeCoords?.lat ?? 33.5;
    return { mx: lngToMercX(focusLng), my: latToMercY(focusLat), zoom: 4.3 };
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef(cam);
  camRef.current = cam;

  // Multi-touch pinch + mouse drag refs
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number; mx: number; my: number } | null>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    baseMx: number;
    baseMy: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, baseMx: 0, baseMy: 0 });
  const [stageSize, setStageSize] = useState({ w: 680, h: 420 });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 2800);
  };

  const originPoint = useMemo(() => {
    if (currentCity) return { lat: currentCity.lat, lng: currentCity.lng, label: currentCity.name };
    if (tour.homeCoords) return { lat: tour.homeCoords.lat, lng: tour.homeCoords.lng, label: tour.homeCoords.label };
    return { lat: 31.23, lng: 121.47, label: '默认出发点(上海)' };
  }, [currentCity, tour.homeCoords]);

  const selectedCity = useMemo(
    () => WORLD_CITIES.find((c) => c.id === selectedCityId) ?? null,
    [selectedCityId],
  );
  const selectedZone: WorldZoneDef | null = useMemo(
    () => WORLD_ZONES.find((z) => z.id === selectedZoneId) ?? null,
    [selectedZoneId],
  );

  // Measure map stage
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        setStageSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const worldPxAt = (z: number) => TILE_PX * Math.pow(2, z);

  const mercToScreen = (
    mx: number,
    my: number,
    c = camRef.current,
  ): [number, number] => {
    const wp = worldPxAt(c.zoom);
    // Shortest wrapped horizontal delta so trans-Pacific panning works smoothly!
    let dmx = mx - c.mx;
    if (dmx > 0.5) dmx -= 1;
    if (dmx < -0.5) dmx += 1;
    return [dmx * wp + stageSize.w / 2, (my - c.my) * wp + stageSize.h / 2];
  };

  const screenToMerc = (
    sx: number,
    sy: number,
    c = camRef.current,
  ): [number, number] => {
    const wp = worldPxAt(c.zoom);
    const mx = (((c.mx + (sx - stageSize.w / 2) / wp) % 1) + 1) % 1;
    const my = Math.max(0.01, Math.min(0.99, c.my + (sy - stageSize.h / 2) / wp));
    return [mx, my];
  };

  // Cursor-centered zoom helper
  const zoomAroundScreenPoint = (sx: number, sy: number, deltaZoom: number) => {
    setCam((prev) => {
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + deltaZoom));
      if (nextZoom === prev.zoom) return prev;
      const wpOld = worldPxAt(prev.zoom);
      const wpNew = worldPxAt(nextZoom);
      const anchorMx = prev.mx + (sx - stageSize.w / 2) / wpOld;
      const anchorMy = prev.my + (sy - stageSize.h / 2) / wpOld;
      const nextMx = (((anchorMx - (sx - stageSize.w / 2) / wpNew) % 1) + 1) % 1;
      const nextMy = Math.max(0.02, Math.min(0.98, anchorMy - (sy - stageSize.h / 2) / wpNew));
      return { mx: nextMx, my: nextMy, zoom: Number(nextZoom.toFixed(3)) };
    });
  };

  // Complete flight animation cleanly
  useEffect(() => {
    if (!flightAnim) return;
    const timer = window.setTimeout(() => {
      const target = flightAnim.targetCity;
      const tier = flightAnim.hotelTier;
      setFlightAnim(null);
      if (target && tier) {
        const tierMeta = HOTEL_TIERS.find((t) => t.id === tier) ?? HOTEL_TIERS[0];
        const stayUntilTs = Date.now() + tierMeta.days * 24 * 3600_000;
        onUpdateMeta((prev) => {
          const prevTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
          const visited = prevTour.visitedCities.includes(target.id)
            ? prevTour.visitedCities
            : [...prevTour.visitedCities, target.id];
          return {
            ...prev,
            worldTour: {
              ...prevTour,
              currentCityId: target.id,
              stayHotelTier: tier,
              stayUntilTs,
              visitedCities: visited,
            },
          };
        });
        setSelectedCityId(target.id);
        setSelectedZoneId(null);
        // Smoothly zoom in slightly on landing so the user sees the city's terrain!
        setCam({
          mx: lngToMercX(target.lng),
          my: latToMercY(target.lat),
          zoom: 9.5,
        });
        sound.play('levelup');
        showToast(`✈ 已抵达${target.name}，顺利入住「${target.hotelNames[tier]}」(${tierMeta.days}天)！`);
      } else {
        onUpdateMeta((prev) => ({
          ...prev,
          worldTour: {
            ...(prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE),
            currentCityId: null,
            stayHotelTier: null,
            stayUntilTs: null,
          },
        }));
        setSelectedCityId(null);
        setSelectedZoneId(null);
        sound.play('confirm');
        showToast('🏠 已乘返程航班回到你的 GPS 家乡精灵中心！');
      }
    }, flightAnim.durationMs);
    return () => window.clearTimeout(timer);
  }, [flightAnim, onUpdateMeta]);

  // Real-Time Multi-Resolution Pixelated World Map Renderer
  useEffect(() => {
    let rafId = 0;

    const render = (ts: number) => {
      const cvs = canvasRef.current;
      if (!cvs) {
        rafId = requestAnimationFrame(render);
        return;
      }
      if (cvs.width !== stageSize.w || cvs.height !== stageSize.h) {
        cvs.width = stageSize.w;
        cvs.height = stageSize.h;
      }
      const ctx = cvs.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;

      const c = camRef.current;
      const wp = worldPxAt(c.zoom);

      // 1. Deep ocean background
      ctx.fillStyle = '#184470';
      ctx.fillRect(0, 0, stageSize.w, stageSize.h);

      // 2. Instant offline/underlay vector continents (zero white flicker while tiles load!)
      ctx.fillStyle = '#4e9e4c';
      ctx.strokeStyle = '#192a38';
      ctx.lineWidth = 1.5;
      for (const poly of WORLD_LAND_POLYGONS) {
        ctx.beginPath();
        poly.forEach(([lng, lat], idx) => {
          const [sx, sy] = mercToScreen(lngToMercX(lng), latToMercY(lat), c);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // 3. Seamless Real-World Web Mercator Tile Pyramid (Esri World Imagery Z1 -> Z18!)
      const activeLayer: TileLayerKind = 'earth';
      const tileZ = Math.max(1, Math.min(18, Math.round(c.zoom)));
      const nTiles = 1 << tileZ;
      const tileScreenSz = wp / nTiles;

      const minTx = Math.floor((c.mx - stageSize.w / (2 * wp)) * nTiles);
      const maxTx = Math.floor((c.mx + stageSize.w / (2 * wp)) * nTiles);
      const minTy = Math.max(0, Math.floor((c.my - stageSize.h / (2 * wp)) * nTiles));
      const maxTy = Math.min(nTiles - 1, Math.floor((c.my + stageSize.h / (2 * wp)) * nTiles));

      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let rawTx = minTx; rawTx <= maxTx; rawTx++) {
          const tx = ((rawTx % nTiles) + nTiles) % nTiles;
          const dx = Math.floor((rawTx / nTiles - c.mx) * wp + stageSize.w / 2);
          const dy = Math.floor((ty / nTiles - c.my) * wp + stageSize.h / 2);
          const dw = Math.ceil(tileScreenSz) + 1;
          const dh = Math.ceil(tileScreenSz) + 1;

          const key = `${activeLayer}/${tileZ}/${tx}/${ty}`;
          const hit = TILE_CACHE.get(key);
          if (hit) {
            ctx.imageSmoothingEnabled = pixelStyle === 'crisp';
            ctx.drawImage(pixelStyle === 'pixel' ? hit.pixelImg : hit.rawImg, dx, dy, dw, dh);
          } else {
            // Queue tile fetch & immediately paint closest cached parent tile so zooming is 100% flicker-free!
            requestTile(activeLayer, tileZ, tx, ty);
            let drawnFallback = false;
            for (let pz = tileZ - 1; pz >= 1 && !drawnFallback; pz--) {
              const shift = tileZ - pz;
              const ptx = tx >> shift;
              const pty = ty >> shift;
              const pHit = TILE_CACHE.get(`${activeLayer}/${pz}/${ptx}/${pty}`);
              if (pHit) {
                const imgSrc = pixelStyle === 'pixel' ? pHit.pixelImg : pHit.rawImg;
                const subCount = 1 << shift;
                const subX = tx & (subCount - 1);
                const subY = ty & (subCount - 1);
                const sw = imgSrc.width / subCount;
                const sh = imgSrc.height / subCount;
                ctx.imageSmoothingEnabled = pixelStyle === 'crisp';
                ctx.drawImage(imgSrc, subX * sw, subY * sh, sw, sh, dx, dy, dw, dh);
                drawnFallback = true;
              }
            }
          }
        }
      }
      ctx.imageSmoothingEnabled = false;

      // Subtle retro pixel scanline / grid tint when zoomed out for cohesive GBA Atlas feel
      if (pixelStyle === 'pixel' && c.zoom < 10) {
        ctx.fillStyle = 'rgba(18, 28, 48, 0.08)';
        ctx.fillRect(0, 0, stageSize.w, stageSize.h);
      }

      // 4. Locked Global Regions (shown clearly at regional/global zoom z <= 6.2)
      if (c.zoom <= 6.2) {
        for (const zone of WORLD_ZONES) {
          if (zone.unlocked) continue;
          const [sx, sy] = mercToScreen(lngToMercX(zone.centerLng), latToMercY(zone.centerLat), c);
          if (sx < -120 || sx > stageSize.w + 120 || sy < -80 || sy > stageSize.h + 80) continue;
          const drift = Math.sin(ts * 0.001 + zone.centerLng) * 4;
          const cw = Math.round(76 + c.zoom * 8);
          const ch = Math.round(28 + c.zoom * 3);

          ctx.fillStyle = 'rgba(235, 241, 250, 0.72)';
          ctx.fillRect(Math.round(sx - cw / 2 + drift), Math.round(sy - ch / 2), cw, ch);
          ctx.fillRect(
            Math.round(sx - cw * 0.35 + drift),
            Math.round(sy - ch * 0.85),
            Math.round(cw * 0.7),
            Math.round(ch * 0.55),
          );

          ctx.fillStyle = 'rgba(22, 20, 32, 0.88)';
          ctx.fillRect(Math.round(sx - 46), Math.round(sy - 10), 92, 20);
          ctx.strokeStyle = '#ced4da';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(Math.round(sx - 46), Math.round(sy - 10), 92, 20);
          ctx.fillStyle = '#fffdf5';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`🔒 ${zone.name.split('·')[0].trim()}`, Math.round(sx), Math.round(sy + 4));
        }
      }

      // 5. Dashed Flight Preview Arc
      if (selectedCity && selectedCity.id !== tour.currentCityId && !flightAnim) {
        const [sx1, sy1] = mercToScreen(lngToMercX(originPoint.lng), latToMercY(originPoint.lat), c);
        const [sx2, sy2] = mercToScreen(lngToMercX(selectedCity.lng), latToMercY(selectedCity.lat), c);
        const midX = (sx1 + sx2) / 2;
        const midY = (sy1 + sy2) / 2 - Math.min(90, Math.hypot(sx2 - sx1, sy2 - sy1) * 0.25);

        ctx.save();
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -(ts * 0.03);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.quadraticCurveTo(midX, midY, sx2, sy2);
        ctx.stroke();
        ctx.restore();
      }

      // 6. Blue GPS Home Beacon
      if (tour.homeCoords) {
        const [sx, sy] = mercToScreen(lngToMercX(tour.homeCoords.lng), latToMercY(tour.homeCoords.lat), c);
        const pulse = 9 + Math.sin(ts * 0.005) * 3.5;
        ctx.strokeStyle = 'rgba(77, 171, 247, 0.92)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#1c7ed6';
        ctx.fillRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);
        ctx.strokeStyle = '#fffdf5';
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);

        ctx.fillStyle = 'rgba(18, 24, 38, 0.92)';
        ctx.fillRect(Math.round(sx - 26), Math.round(sy + 9), 52, 16);
        ctx.fillStyle = '#74c0fc';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏠 老家', Math.round(sx), Math.round(sy + 21));
      }

      // 7. Season-1 City Gym Pins
      for (const city of WORLD_CITIES) {
        const [sx, sy] = mercToScreen(lngToMercX(city.lng), latToMercY(city.lat), c);
        if (sx < -60 || sx > stageSize.w + 60 || sy < -60 || sy > stageSize.h + 60) continue;
        const isCurrent = tour.currentCityId === city.id;
        const isSelected = selectedCityId === city.id;
        const isCleared = tour.clearedCityGyms.includes(city.id);

        if (isCurrent) {
          const r = 11 + Math.sin(ts * 0.006) * 3;
          ctx.strokeStyle = '#ffe066';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        const sz = isSelected ? 14 : 11;
        ctx.fillStyle = isCleared ? '#ffd43b' : city.accentColor;
        ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);
        ctx.strokeStyle = isSelected ? '#ffffff' : '#161420';
        ctx.lineWidth = isSelected ? 2.5 : 2;
        ctx.strokeRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);

        if (isCleared) {
          ctx.fillStyle = '#ffd43b';
          ctx.fillRect(Math.round(sx + sz / 2 - 1), Math.round(sy - sz / 2 - 9), 8, 6);
          ctx.fillStyle = '#161420';
          ctx.fillRect(Math.round(sx + sz / 2 - 2), Math.round(sy - sz / 2 - 10), 2, 11);
        }

        const lbl = isCurrent ? `📍${city.name}` : city.name;
        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(lbl).width + 10;
        const lx = Math.round(sx - tw / 2);
        const ly = Math.round(sy - sz / 2 - 21);
        ctx.fillStyle = isSelected ? '#ffe066' : 'rgba(18, 22, 34, 0.9)';
        ctx.fillRect(lx, ly, tw, 16);
        ctx.strokeStyle = '#161420';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(lx, ly, tw, 16);
        ctx.fillStyle = isSelected ? '#161420' : '#fffdf5';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, Math.round(sx), ly + 12);
      }

      // 8. Animated Pixel Airplane Flight along Geodesic Arc
      if (flightAnim) {
        const elapsed = Date.now() - flightAnim.startedAt;
        const t = Math.max(0, Math.min(1, elapsed / flightAnim.durationMs));
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const [sx1, sy1] = mercToScreen(lngToMercX(flightAnim.fromLng), latToMercY(flightAnim.fromLat), c);
        const [sx2, sy2] = mercToScreen(lngToMercX(flightAnim.toLng), latToMercY(flightAnim.toLat), c);
        const midX = (sx1 + sx2) / 2;
        const midY = (sy1 + sy2) / 2 - Math.min(100, Math.hypot(sx2 - sx1, sy2 - sy1) * 0.3);

        ctx.strokeStyle = 'rgba(255, 224, 102, 0.58)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.quadraticCurveTo(midX, midY, sx2, sy2);
        ctx.stroke();

        const u = 1 - ease;
        const px = u * u * sx1 + 2 * u * ease * midX + ease * ease * sx2;
        const py = u * u * sy1 + 2 * u * ease * midY + ease * ease * sy2;
        const dx = 2 * u * (midX - sx1) + 2 * ease * (sx2 - midX);
        const dy = 2 * u * (midY - sy1) + 2 * ease * (sy2 - midY);
        const ang = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 224, 102, 0.34)';
        ctx.fill();

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.fillStyle = '#161420';
        ctx.fillRect(-10, -3, 20, 6);
        ctx.fillRect(-3, -10, 6, 20);
        ctx.fillStyle = '#fffdf5';
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillRect(-2, -8, 4, 16);
        ctx.fillStyle = '#ff6b35';
        ctx.fillRect(5, -2, 3, 4);
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [stageSize, selectedCity, selectedCityId, tour, originPoint, flightAnim, pixelStyle]);

  // Real Browser GPS Geolocation Handler (zooms smoothly right into user's real neighborhood!)
  const handleLocateGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('当前浏览器不支持 GPS，请点击「📌 点选老家」');
      return;
    }
    setGpsStatus('正在获取真实 GPS 坐标...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const eco = getLocalHomeEcology(lat, lng);
        const label =
          eco.nearestDistKm <= 80
            ? `${eco.nearestCity.name} · GPS老家`
            : `GPS (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
        onUpdateMeta((prev) => ({
          ...prev,
          worldTour: {
            ...(prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE),
            homeCoords: { lat, lng, label, isRealGps: true },
          },
        }));
        setCam({ mx: lngToMercX(lng), my: latToMercY(lat), zoom: 13.5 });
        setSelectedCityId(null);
        setSelectedZoneId(null);
        setGpsStatus(null);
        sound.play('levelup');
        showToast(`📍 GPS 重生点已锚定：${label}（可继续滚轮放大至街道级！）`);
      },
      () => {
        setGpsStatus('未授予 GPS 定位权限，可点击「📌 点选老家」在地图上自选重生点');
        sound.play('error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  // Multi-touch Pinch + Pan Pointer Handlers
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStartRef.current = { dist, zoom: camRef.current.zoom, mx: camRef.current.mx, my: camRef.current.my };
      dragRef.current.active = false;
      return;
    }

    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      baseMx: camRef.current.mx,
      baseMy: camRef.current.my,
    };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / Math.max(10, pinchStartRef.current.dist);
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartRef.current.zoom + Math.log2(ratio)));
      setCam((prev) => ({ ...prev, zoom: Number(nextZoom.toFixed(3)) }));
      return;
    }

    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    const wp = worldPxAt(camRef.current.zoom);
    setCam((prev) => ({
      ...prev,
      mx: (((d.baseMx - dx / wp) % 1) + 1) % 1,
      my: Math.max(0.02, Math.min(0.98, d.baseMy - dy / wp)),
    }));
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    const d = dragRef.current;
    const wasTap = d.active && !d.moved;
    d.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (!wasTap || flightAnim) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (pickHomeMode) {
      const [mx, my] = screenToMerc(sx, sy);
      const lat = mercYToLat(my);
      const lng = mercXToLng(mx);
      const eco = getLocalHomeEcology(lat, lng);
      const label =
        eco.nearestDistKm <= 100
          ? `${eco.nearestCity.name} · 自选老家`
          : `自选老家 (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
      onUpdateMeta((prev) => ({
        ...prev,
        worldTour: {
          ...(prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE),
          homeCoords: { lat, lng, label, isRealGps: false },
        },
      }));
      setPickHomeMode(false);
      sound.play('confirm');
      showToast(`🏠 已将重生点设为：${label}`);
      return;
    }

    // Hit-test unlocked cities
    let hitCity: WorldCityDef | null = null;
    let bestD = 26;
    for (const c of WORLD_CITIES) {
      const [px, py] = mercToScreen(lngToMercX(c.lng), latToMercY(c.lat));
      const dist = Math.hypot(sx - px, sy - py);
      if (dist < bestD) {
        bestD = dist;
        hitCity = c;
      }
    }
    if (hitCity) {
      sound.play('cursor');
      setSelectedCityId(hitCity.id);
      setSelectedZoneId(null);
      return;
    }

    // Hit-test Home Beacon
    if (tour.homeCoords) {
      const [px, py] = mercToScreen(lngToMercX(tour.homeCoords.lng), latToMercY(tour.homeCoords.lat));
      if (Math.hypot(sx - px, sy - py) < 24) {
        sound.play('cursor');
        setSelectedCityId(null);
        setSelectedZoneId(null);
        return;
      }
    }

    // Hit-test Locked Global Zones
    if (camRef.current.zoom <= 6.2) {
      for (const z of WORLD_ZONES) {
        if (z.unlocked) continue;
        const [px, py] = mercToScreen(lngToMercX(z.centerLng), latToMercY(z.centerLat));
        if (Math.hypot(sx - px, sy - py) < 52) {
          sound.play('cursor');
          setSelectedCityId(null);
          setSelectedZoneId(z.id);
          return;
        }
      }
    }
  };

  const handleBookFlightAndStay = (target: WorldCityDef) => {
    const distKm = calcGeoDistanceKm(originPoint.lat, originPoint.lng, target.lat, target.lng);
    const isRealHomeTurf = Boolean(
      tour.homeCoords?.isRealGps &&
        calcGeoDistanceKm(tour.homeCoords.lat, tour.homeCoords.lng, target.lat, target.lng) <= 80,
    );
    const ticketCost = calcFlightTicketCost(distKm, isRealHomeTurf);
    const tierMeta = HOTEL_TIERS.find((t) => t.id === selectedHotel) ?? HOTEL_TIERS[0];
    const hotelCost = isRealHomeTurf ? 0 : tierMeta.pricePerStay;
    const totalCost = ticketCost + hotelCost;

    if (coins < totalCost) {
      sound.play('error');
      showToast(`金币不足！需要 ${totalCost} 宝可币（当前 ${coins}）`);
      return;
    }
    if (totalCost > 0) {
      onUpdateMeta((prev) => prev, -totalCost);
    }
    sound.play('confirm');

    const mx1 = lngToMercX(originPoint.lng);
    const my1 = latToMercY(originPoint.lat);
    const mx2 = lngToMercX(target.lng);
    const my2 = latToMercY(target.lat);
    const span = Math.max(0.015, Math.hypot(mx2 - mx1, my2 - my1));
    const fitZoom = Math.max(2.5, Math.min(6.2, Math.log2(0.45 / span)));
    setCam({ mx: (mx1 + mx2) / 2, my: (my1 + my2) / 2, zoom: Number(fitZoom.toFixed(2)) });

    setFlightAnim({
      fromLng: originPoint.lng,
      fromLat: originPoint.lat,
      toLng: target.lng,
      toLat: target.lat,
      targetCity: target,
      hotelTier: selectedHotel,
      startedAt: Date.now(),
      durationMs: 1850,
    });
  };

  const handleExtendStay = (city: WorldCityDef, tier: HotelTierId) => {
    const tierMeta = HOTEL_TIERS.find((t) => t.id === tier) ?? HOTEL_TIERS[0];
    if (coins < tierMeta.pricePerStay) {
      sound.play('error');
      showToast(`金币不足，续住需要 ${tierMeta.pricePerStay} 宝可币`);
      return;
    }
    const baseTs = Math.max(Date.now(), tour.stayUntilTs ?? Date.now());
    const nextUntil = baseTs + tierMeta.days * 24 * 3600_000;
    onUpdateMeta(
      (prev) => ({
        ...prev,
        worldTour: {
          ...(prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE),
          stayHotelTier: tier,
          stayUntilTs: nextUntil,
        },
      }),
      -tierMeta.pricePerStay,
    );
    sound.play('levelup');
    showToast(`🏨 已续住「${city.hotelNames[tier]}」+${tierMeta.days} 天！`);
  };

  const handleFlyHome = () => {
    if (!currentCity) return;
    const homeLat = tour.homeCoords?.lat ?? 31.23;
    const homeLng = tour.homeCoords?.lng ?? 121.47;
    sound.play('confirm');
    setCam({
      mx: (lngToMercX(currentCity.lng) + lngToMercX(homeLng)) / 2,
      my: (latToMercY(currentCity.lat) + latToMercY(homeLat)) / 2,
      zoom: 4.5,
    });
    setFlightAnim({
      fromLng: currentCity.lng,
      fromLat: currentCity.lat,
      toLng: homeLng,
      toLat: homeLat,
      targetCity: null,
      hotelTier: null,
      startedAt: Date.now(),
      durationMs: 1400,
    });
  };

  const handleLaunchFromCurrent = (isGym: boolean) => {
    if (currentCity && isStayExpired) {
      sound.play('error');
      showToast('酒店住宿已到期，请先续住或免费返回家乡！');
      return;
    }
    if (currentCity) {
      const isHomeTurf = Boolean(
        tour.homeCoords?.isRealGps &&
          calcGeoDistanceKm(tour.homeCoords.lat, tour.homeCoords.lng, currentCity.lat, currentCity.lng) <= 80,
      );
      onLaunchWorldRun({
        cityId: currentCity.id,
        cityName: currentCity.name,
        biome: currentCity.biome,
        wildPool: currentCity.wildPool,
        isGymChallenge: isGym,
        gymName: currentCity.gymName,
        gymBadgeName: currentCity.gymBadgeName,
        bossSpecies: currentCity.gymBossSpecies,
        bossName: currentCity.gymBossTitle,
        bossTrainerKey: currentCity.gymTrainerKey,
        bossTrainerName: currentCity.gymLeaderName,
        rewardCoins: currentCity.rewardCoins,
        hotelTier: tour.stayHotelTier,
        isHomeTurf,
      });
      return;
    }
    const lat = tour.homeCoords?.lat ?? 31.23;
    const lng = tour.homeCoords?.lng ?? 121.47;
    const eco = getLocalHomeEcology(lat, lng);
    onLaunchWorldRun({
      cityId: null,
      cityName: tour.homeCoords?.label ?? 'GPS 家乡原野',
      biome: eco.biome,
      wildPool: eco.wildPool,
      isGymChallenge: false,
      rewardCoins: 120,
      hotelTier: null,
      isHomeTurf: true,
    });
  };

  const isViewingCurrentCity = Boolean(selectedCity && currentCity && selectedCity.id === currentCity.id);
  const isViewingHome = !selectedCity && !selectedZone;
  const centerLat = mercYToLat(cam.my);
  const centerLng = mercXToLng(cam.mx);
  const scaleInfo = formatScaleBar(centerLat, cam.zoom);
  const layerBadge =
    cam.zoom < 6 ? '全球地貌' : cam.zoom < 11 ? '区域地形' : cam.zoom < 15 ? '城市区块' : '街道实景';

  return (
    <div className="wt-overlay">
      <header className="wt-header">
        <button type="button" className="pkb-esc-btn" onClick={onClose}>
          <PixelIcon name="arrow_left" size={13} />
          <span>返回大厅</span>
        </button>

        <div className="wt-status-pill">
          <PixelItemImg src="/sprites/items/town-map.png" size={16} />
          {currentCity ? (
            <span>
              <strong>{currentCity.name}</strong>
              {' · '}
              {tour.stayHotelTier ? currentCity.hotelNames[tour.stayHotelTier] : '临时停留'}
              {' · '}
              <em className={isStayExpired ? 'is-expired' : ''}>
                {formatRemainingStay(tour.stayUntilTs, nowMs)}
              </em>
            </span>
          ) : (
            <span>
              <strong>{tour.homeCoords ? tour.homeCoords.label : '未定位老家'}</strong>
              {' · 永久免费停留'}
            </span>
          )}
        </div>

        <div className="wt-header-right">
          <button
            type="button"
            className="wt-gps-btn"
            onClick={handleLocateGps}
            title="使用浏览器真实 GPS 定位设置你的家乡重生点（仅本地运算，绝不上传）"
          >
            <span>📍 GPS老家</span>
          </button>
          <button
            type="button"
            className={`wt-gps-btn ${pickHomeMode ? 'is-armed' : ''}`}
            onClick={() => {
              sound.play('cursor');
              setPickHomeMode((v) => !v);
            }}
            title="在地图上手动点击任意地点设为家乡重生点"
          >
            <span>{pickHomeMode ? '点击地图设点…' : '📌 点选老家'}</span>
          </button>
          <div className="wt-coin-pill">
            <PixelItemImg src="/sprites/items/amulet-coin.png" size={15} />
            <strong>{coins}</strong>
          </div>
        </div>
      </header>

      <div className="wt-body">
        <div ref={stageRef} className={`wt-map-stage ${pickHomeMode ? 'is-picking' : ''}`}>
          <canvas
            ref={canvasRef}
            className="wt-map-canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onDoubleClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              zoomAroundScreenPoint(e.clientX - rect.left, e.clientY - rect.top, 1.5);
            }}
            onWheel={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const delta = -Math.sign(e.deltaY) * Math.min(1.1, Math.max(0.35, Math.abs(e.deltaY) * 0.006));
              zoomAroundScreenPoint(e.clientX - rect.left, e.clientY - rect.top, delta);
            }}
          />

          <div className="wt-map-tools">
            <button
              type="button"
              onClick={() => zoomAroundScreenPoint(stageSize.w / 2, stageSize.h / 2, 1.2)}
              aria-label="放大"
              title="放大地图（支持直达街道级 Z18）"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomAroundScreenPoint(stageSize.w / 2, stageSize.h / 2, -1.2)}
              aria-label="缩小"
              title="缩小地图"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setCam({ mx: lngToMercX(118.5), my: latToMercY(33.5), zoom: 4.3 })}
            >
              东亚
            </button>
            <button
              type="button"
              onClick={() => setCam({ mx: 0.5, my: 0.45, zoom: 1.8 })}
            >
              全球
            </button>
            <button
              type="button"
              className={pixelStyle === 'pixel' ? 'is-on' : ''}
              onClick={() => setPixelStyle((s) => (s === 'pixel' ? 'crisp' : 'pixel'))}
              title="切换复古 GBA 像素化渲染 / 高清原图渲染"
            >
              {pixelStyle === 'pixel' ? '像素风' : '高清图'}
            </button>
          </div>

          <div className="wt-map-legend">
            <span>S1 东亚巡礼</span>
            <em>道馆 {tour.clearedCityGyms.length}/{WORLD_CITIES.length}</em>
            <small>{layerBadge} · Z{cam.zoom.toFixed(1)}</small>
          </div>

          {/* Live Real-World Metric Scale Bar & Lat/Lng */}
          <div className="wt-scale-hud">
            <div className="wt-scale-bar" style={{ width: `${scaleInfo.widthPx}px` }}>
              <span>{scaleInfo.label}</span>
            </div>
            <small>
              {Math.abs(centerLat).toFixed(2)}°{centerLat >= 0 ? 'N' : 'S'}, {Math.abs(centerLng).toFixed(2)}°{centerLng >= 0 ? 'E' : 'W'}
            </small>
          </div>

          {flightAnim && (
            <div className="wt-flight-banner">
              ✈ 正在飞往 {flightAnim.targetCity ? flightAnim.targetCity.name : 'GPS 家乡'}...
            </div>
          )}

          {(toastMsg || gpsStatus) && (
            <div className="wt-toast">{toastMsg ?? gpsStatus}</div>
          )}
        </div>

        <aside className="wt-drawer scroll-y">
          <div className="wt-city-chips">
            <button
              type="button"
              className={`wt-chip ${isViewingHome ? 'active' : ''}`}
              onClick={() => {
                sound.play('cursor');
                setSelectedCityId(null);
                setSelectedZoneId(null);
                if (tour.homeCoords) {
                  setCam({
                    mx: lngToMercX(tour.homeCoords.lng),
                    my: latToMercY(tour.homeCoords.lat),
                    zoom: Math.max(cam.zoom, 11.5),
                  });
                }
              }}
            >
              🏠 老家
            </button>
            {WORLD_CITIES.map((c) => {
              const cleared = tour.clearedCityGyms.includes(c.id);
              const isHere = tour.currentCityId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`wt-chip ${selectedCityId === c.id ? 'active' : ''} ${isHere ? 'is-here' : ''}`}
                  onClick={() => {
                    sound.play('cursor');
                    setSelectedCityId(c.id);
                    setSelectedZoneId(null);
                    setCam((prev) => ({
                      mx: lngToMercX(c.lng),
                      my: latToMercY(c.lat),
                      zoom: Math.max(prev.zoom, 6.2),
                    }));
                  }}
                >
                  {isHere ? '📍' : cleared ? '👑' : ''}
                  {c.name}
                </button>
              );
            })}
          </div>

          {selectedZone && !selectedZone.unlocked && (
            <div className="wt-card">
              <div className="wt-card-head is-locked">
                <strong>🔒 {selectedZone.name}</strong>
                <span>{selectedZone.seasonTag}</span>
              </div>
              <p className="wt-desc">{selectedZone.teaserText}</p>
              <div className="wt-sec-lbl">预计栖息代表宝可梦</div>
              <div className="wt-poke-strip">
                {selectedZone.teaserSpecies.map((sp) => (
                  <div key={sp} className="wt-poke-chip">
                    <img src={SPECIES_CATALOG[sp].stageSprites.baby.icon} alt={SPECIES_CATALOG[sp].defaultName} />
                    <span>{SPECIES_CATALOG[sp].defaultName}</span>
                  </div>
                ))}
              </div>
              <div className="wt-locked-note">
                该赛区航线尚未开放，敬请期待后续赛季陆续解封！
              </div>
            </div>
          )}

          {isViewingHome && (() => {
            const lat = tour.homeCoords?.lat ?? 31.23;
            const lng = tour.homeCoords?.lng ?? 121.47;
            const eco = getLocalHomeEcology(lat, lng);
            return (
              <div className="wt-card">
                <div className="wt-card-head" style={{ backgroundColor: '#1c7ed6' }}>
                  <strong>🏠 {tour.homeCoords ? tour.homeCoords.label : '我的家乡重生点'}</strong>
                  <span>永久免费</span>
                </div>
                <p className="wt-desc">
                  当前匹配生态：<strong>{eco.regionLabel}</strong>（{lat.toFixed(3)}°, {lng.toFixed(3)}°）。滚轮或双指放大可一直下钻到你的真实街区！
                </p>
                {!tour.homeCoords && (
                  <button type="button" className="wt-secondary-btn" onClick={handleLocateGps}>
                    📍 点击获取真实 GPS 坐标设为老家
                  </button>
                )}
                <div className="wt-sec-lbl">家乡周边野生宝可梦</div>
                <div className="wt-poke-strip">
                  {eco.wildPool.slice(0, 8).map((sp) => (
                    <div key={sp} className="wt-poke-chip">
                      <img src={SPECIES_CATALOG[sp].stageSprites.baby.icon} alt={SPECIES_CATALOG[sp].defaultName} />
                      <span>{SPECIES_CATALOG[sp].defaultName}</span>
                    </div>
                  ))}
                </div>
                {currentCity ? (
                  <button type="button" className="wt-primary-btn" onClick={handleFlyHome}>
                    ✈ 免费乘机返回家乡
                  </button>
                ) : (
                  <button type="button" className="wt-primary-btn" onClick={() => handleLaunchFromCurrent(false)}>
                    🌿 在家乡原野自由探索 (3D)
                  </button>
                )}
              </div>
            );
          })()}

          {selectedCity && isViewingCurrentCity && (() => {
            const cleared = tour.clearedCityGyms.includes(selectedCity.id);
            const curTierMeta = HOTEL_TIERS.find((t) => t.id === tour.stayHotelTier) ?? HOTEL_TIERS[0];
            return (
              <div className="wt-card">
                <div className="wt-card-head" style={{ backgroundColor: selectedCity.accentColor }}>
                  <strong>📍 {selectedCity.name} · 城市据点</strong>
                  <span>{selectedCity.country}</span>
                </div>

                <div className={`wt-stay-box ${isStayExpired ? 'is-expired' : ''}`}>
                  <div>
                    <strong>🏨 {selectedCity.hotelNames[curTierMeta.id]}</strong>
                    <small>{curTierMeta.perkLabel}</small>
                  </div>
                  <em>{formatRemainingStay(tour.stayUntilTs, nowMs)}</em>
                </div>

                <p className="wt-desc">{selectedCity.fieldEffect}</p>

                <div className="wt-gym-banner">
                  <img
                    src={SPECIES_CATALOG[selectedCity.gymBossSpecies].stageSprites.adult.static}
                    alt={selectedCity.gymBossTitle}
                  />
                  <div>
                    <strong>{selectedCity.gymName} {cleared ? '👑 已征服' : ''}</strong>
                    <small>{selectedCity.gymLeaderName} · 王牌：{selectedCity.gymBossTitle}</small>
                    <em>徽章：{selectedCity.gymBadgeName}</em>
                  </div>
                </div>

                <div className="wt-sec-lbl">本地区专属野生精灵</div>
                <div className="wt-poke-strip">
                  {selectedCity.wildPool.map((sp) => (
                    <div key={sp} className="wt-poke-chip">
                      <img src={SPECIES_CATALOG[sp].stageSprites.baby.icon} alt={SPECIES_CATALOG[sp].defaultName} />
                      <span>{SPECIES_CATALOG[sp].defaultName}</span>
                    </div>
                  ))}
                </div>

                <div className="wt-action-stack">
                  <button
                    type="button"
                    className="wt-primary-btn is-gym"
                    disabled={isStayExpired}
                    onClick={() => handleLaunchFromCurrent(true)}
                  >
                    ⚔ 挑战「{selectedCity.gymName}」(3D)
                  </button>
                  <button
                    type="button"
                    className="wt-primary-btn"
                    disabled={isStayExpired}
                    onClick={() => handleLaunchFromCurrent(false)}
                  >
                    🌿 出城探索 {selectedCity.name} 野外 (3D)
                  </button>
                  <div className="wt-sub-ops">
                    <button
                      type="button"
                      className="wt-secondary-btn"
                      onClick={() => handleExtendStay(selectedCity, curTierMeta.id)}
                    >
                      🔄 续住 +{curTierMeta.days}天 ({curTierMeta.pricePerStay}币)
                    </button>
                    <button type="button" className="wt-secondary-btn" onClick={handleFlyHome}>
                      ✈ 返乡回家
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {selectedCity && !isViewingCurrentCity && (() => {
            const distKm = calcGeoDistanceKm(originPoint.lat, originPoint.lng, selectedCity.lat, selectedCity.lng);
            const isRealHomeTurf = Boolean(
              tour.homeCoords?.isRealGps &&
                calcGeoDistanceKm(tour.homeCoords.lat, tour.homeCoords.lng, selectedCity.lat, selectedCity.lng) <= 80,
            );
            const ticketCost = calcFlightTicketCost(distKm, isRealHomeTurf);
            const tierMeta = HOTEL_TIERS.find((t) => t.id === selectedHotel) ?? HOTEL_TIERS[0];
            const hotelCost = isRealHomeTurf ? 0 : tierMeta.pricePerStay;
            const totalCost = ticketCost + hotelCost;
            const cleared = tour.clearedCityGyms.includes(selectedCity.id);

            return (
              <div className="wt-card">
                <div className="wt-card-head" style={{ backgroundColor: selectedCity.accentColor }}>
                  <strong>✈ 飞往 {selectedCity.name}</strong>
                  <span>{distKm.toLocaleString()} km</span>
                </div>

                <p className="wt-desc">{selectedCity.description}</p>

                {isRealHomeTurf && (
                  <div className="wt-hometurf-pill">
                    🏠 真实 GPS 主场共鸣！免机票免住宿费 + 本地闪光 UP！
                  </div>
                )}

                <div className="wt-gym-banner">
                  <img
                    src={SPECIES_CATALOG[selectedCity.gymBossSpecies].stageSprites.adult.static}
                    alt={selectedCity.gymBossTitle}
                  />
                  <div>
                    <strong>{selectedCity.gymName} {cleared ? '👑' : ''}</strong>
                    <small>{selectedCity.gymTypeLabel} · {selectedCity.gymLeaderName}</small>
                    <em>奖励：{selectedCity.gymBadgeName} + {selectedCity.rewardCoins} 币</em>
                  </div>
                </div>

                <div className="wt-sec-lbl">当地可捕获特色精灵</div>
                <div className="wt-poke-strip">
                  {selectedCity.wildPool.map((sp) => (
                    <div key={sp} className="wt-poke-chip">
                      <img src={SPECIES_CATALOG[sp].stageSprites.baby.icon} alt={SPECIES_CATALOG[sp].defaultName} />
                      <span>{SPECIES_CATALOG[sp].defaultName}</span>
                    </div>
                  ))}
                </div>

                <div className="wt-sec-lbl">选择入住酒店与停留天数</div>
                <div className="wt-hotel-list">
                  {HOTEL_TIERS.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`wt-hotel-opt ${selectedHotel === tier.id ? 'active' : ''}`}
                      onClick={() => {
                        sound.play('cursor');
                        setSelectedHotel(tier.id);
                      }}
                    >
                      <div className="wt-hotel-top">
                        <strong>{selectedCity.hotelNames[tier.id]}</strong>
                        <span>{isRealHomeTurf ? '免费' : `${tier.pricePerStay} 币`}</span>
                      </div>
                      <small>{tier.perkLabel}</small>
                    </button>
                  ))}
                </div>

                <div className="wt-ticket-summary">
                  <span>机票 {ticketCost} 币 + 住宿 {hotelCost} 币</span>
                  <strong>合计 {totalCost} 币</strong>
                </div>

                <button
                  type="button"
                  className="wt-primary-btn is-fly"
                  disabled={Boolean(flightAnim) || coins < totalCost}
                  onClick={() => handleBookFlightAndStay(selectedCity)}
                >
                  {flightAnim
                    ? '✈ 正在飞行中...'
                    : coins < totalCost
                      ? `宝可币不足（还差 ${totalCost - coins} 币）`
                      : `✈ 购票起飞 · 入住 ${tierMeta.days} 天 (${totalCost} 币)`}
                </button>
              </div>
            );
          })()}
        </aside>
      </div>
    </div>
  );
};
