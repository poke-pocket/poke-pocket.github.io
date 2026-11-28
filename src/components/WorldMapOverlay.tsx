import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SPECIES_CATALOG } from '../data/catalog';
import type { AppLang } from '../data/i18n';
import { getSkinDef, type MetaProgressState } from '../data/metaProgression';
import {
  DEFAULT_WORLD_TOUR_STATE,
  HOTEL_TIERS,
  WORLD_CITIES,
  WORLD_LAND_POLYGONS,
  WORLD_ZONES,
  calcFlightTicketCost,
  calcGeoDistanceKm,
  getDefaultHomeByLanguage,
  getLocalHomeEcology,
  type HotelTierId,
  type WorldCityDef,
  type WorldTourState,
  type WorldZoneDef,
} from '../data/worldTour';
import {
  PROVINCIAL_AND_WORLD_CAPITALS,
  REAL_WORLD_CORRIDORS,
  REAL_WORLD_RIVERS,
} from '../data/geoTerrain3D';
import type { BiomeId } from '../data/worldTextures3D';
import type { PetSkinId, SpeciesId } from '../types/pet';
import { sound } from '../utils/sound';
import { fetchLiveWeatherAt, type LiveWeatherInfo } from '../utils/weatherSystem';
import { drawWorldMapAnomalies, hitTestAnomalyZone } from '../utils/worldMapAnomalies';
import { PixelIcon, PixelItemImg } from './PixelSprite';

export interface WorldLaunchPayload {
  cityId: string | null;
  cityName: string;
  originLat: number;
  originLng: number;
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
  regionalSkinId?: PetSkinId;
}

interface WorldMapOverlayProps {
  coins: number;
  lang: AppLang;
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

const PLAYABLE_CITY_NAMES = new Set(WORLD_CITIES.map((c) => c.name));
const REFERENCE_CITIES = PROVINCIAL_AND_WORLD_CAPITALS.filter(
  (cap) => !PLAYABLE_CITY_NAMES.has(cap.name),
);

type MapHoverTarget =
  | { kind: 'city'; id: string }
  | { kind: 'home' }
  | { kind: 'zone'; id: string }
  | null;

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
  lang,
  meta,
  onUpdateMeta,
  onLaunchWorldRun,
  onClose,
}) => {
  const tour: WorldTourState = meta.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
  const settledIds = tour.settledCityIds ?? [];
  const defaultHome = useMemo(() => getDefaultHomeByLanguage(lang), [lang]);
  const effectiveHome = tour.homeCoords ?? defaultHome;
  const nowMs = Date.now();
  const isStayExpired = Boolean(
    tour.currentCityId && tour.stayUntilTs && tour.stayUntilTs <= nowMs,
  );
  const currentCity = useMemo(
    () => WORLD_CITIES.find((c) => c.id === tour.currentCityId) ?? null,
    [tour.currentCityId],
  );
  const homeMatchedCity = useMemo(() => {
    const eco = getLocalHomeEcology(effectiveHome.lat, effectiveHome.lng);
    return eco.nearestDistKm <= 80 ? eco.nearestCity : null;
  }, [effectiveHome.lat, effectiveHome.lng]);
  const activeHereCity = currentCity ?? homeMatchedCity;
  const isAtHomeCity = !currentCity && Boolean(homeMatchedCity);

  const [selectedCityId, setSelectedCityId] = useState<string | null>(
    tour.currentCityId ?? defaultHome.defaultCityId,
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [gymDetailOpen, setGymDetailOpen] = useState(false);
  const [gymConfirmOpen, setGymConfirmOpen] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<HotelTierId>('inn');
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewedWeather, setViewedWeather] = useState<LiveWeatherInfo | null>(null);

  const cityClickCounts = tour.cityClickCounts ?? {};
  const sortedCities = useMemo(() => {
    return [...WORLD_CITIES].sort((a, b) => {
      const ca = cityClickCounts[a.id] ?? 0;
      const cb = cityClickCounts[b.id] ?? 0;
      if (cb !== ca) return cb - ca;
      return WORLD_CITIES.indexOf(a) - WORLD_CITIES.indexOf(b);
    });
  }, [cityClickCounts]);

  const settledCities = useMemo(
    () => sortedCities.filter((c) => settledIds.includes(c.id)),
    [sortedCities, settledIds],
  );

  const recordCityClick = (cityId: string) => {
    onUpdateMeta((prev) => {
      const prevTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
      const prevCounts = prevTour.cityClickCounts ?? {};
      return {
        ...prev,
        worldTour: {
          ...prevTour,
          cityClickCounts: {
            ...prevCounts,
            [cityId]: (prevCounts[cityId] ?? 0) + 1,
          },
        },
      };
    });
  };

  // Fetch real-time weather for the currently viewed location (GPS Home or selected city)
  useEffect(() => {
    let cancelled = false;
    const city = selectedCityId ? WORLD_CITIES.find((c) => c.id === selectedCityId) : null;
    const lat = city ? city.lat : effectiveHome.lat;
    const lng = city ? city.lng : effectiveHome.lng;
    const lbl = city ? city.name : effectiveHome.label;
    fetchLiveWeatherAt(lat, lng, lbl).then((info) => {
      if (!cancelled) setViewedWeather(info);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCityId, effectiveHome.lat, effectiveHome.lng, effectiveHome.label]);

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
  const [cam, setCamState] = useState<{ mx: number; my: number; zoom: number }>(() => {
    const focusLng = currentCity?.lng ?? tour.homeCoords?.lng ?? (lang === 'ja' ? 132.0 : 118.5);
    const focusLat = currentCity?.lat ?? tour.homeCoords?.lat ?? 33.5;
    return { mx: lngToMercX(focusLng), my: latToMercY(focusLat), zoom: 4.3 };
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const anchorGeoRef = useRef<{ mx: number; my: number } | null>(null);
  const hoveredTargetRef = useRef<MapHoverTarget>(null);
  const camRef = useRef(cam);
  const setCam = (
    updater:
      | { mx: number; my: number; zoom: number }
      | ((prev: { mx: number; my: number; zoom: number }) => { mx: number; my: number; zoom: number }),
  ) => {
    const next = typeof updater === 'function' ? updater(camRef.current) : updater;
    camRef.current = next;
    setCamState(next);
  };

  // Multi-touch pinch + mouse drag refs (zero React re-renders during drag/pinch for silky 60fps on mobile!)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    anchorMx: number;
    anchorMy: number;
  } | null>(null);
  const hudSyncTimerRef = useRef<number | null>(null);
  const syncCamHudThrottled = () => {
    if (hudSyncTimerRef.current !== null) return;
    hudSyncTimerRef.current = window.setTimeout(() => {
      hudSyncTimerRef.current = null;
      setCamState({ ...camRef.current });
    }, 80);
  };
  useEffect(
    () => () => {
      if (hudSyncTimerRef.current !== null) window.clearTimeout(hudSyncTimerRef.current);
    },
    [],
  );
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    baseMx: number;
    baseMy: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, baseMx: 0, baseMy: 0 });
  const [stageSize, setStageSize] = useState({ w: 680, h: 420 });
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 2800);
  };

  const originPoint = useMemo(() => {
    if (currentCity) return { lat: currentCity.lat, lng: currentCity.lng, label: currentCity.name };
    return { lat: effectiveHome.lat, lng: effectiveHome.lng, label: effectiveHome.label };
  }, [currentCity, effectiveHome]);

  const selectedCity = useMemo(
    () => WORLD_CITIES.find((c) => c.id === selectedCityId) ?? null,
    [selectedCityId],
  );
  const selectedZone: WorldZoneDef | null = useMemo(
    () => WORLD_ZONES.find((z) => z.id === selectedZoneId) ?? null,
    [selectedZoneId],
  );
  const showPopover = cardOpen && !flightAnim;
  if (!showPopover) {
    anchorGeoRef.current = null;
  } else if (selectedCity) {
    anchorGeoRef.current = { mx: lngToMercX(selectedCity.lng), my: latToMercY(selectedCity.lat) };
  } else if (selectedZone && !selectedZone.unlocked) {
    anchorGeoRef.current = {
      mx: lngToMercX(selectedZone.centerLng),
      my: latToMercY(selectedZone.centerLat),
    };
  } else {
    anchorGeoRef.current = {
      mx: lngToMercX(effectiveHome.lng),
      my: latToMercY(effectiveHome.lat),
    };
  }

  // Position floating location card beside its map anchor at 60fps without React re-renders
  const positionPopover = () => {
    const pop = popoverRef.current;
    const anchor = anchorGeoRef.current;
    if (!pop || !anchor) return;
    const { w: stageW, h: stageH } = stageSizeRef.current;
    const arrow = arrowRef.current;

    if (stageW <= 680) {
      pop.dataset.side = 'mobile';
      pop.style.transform = '';
      if (arrow) arrow.style.display = 'none';
      return;
    }

    const c = camRef.current;
    const wp = worldPxAt(c.zoom);
    let dmx = anchor.mx - c.mx;
    if (dmx > 0.5) dmx -= 1;
    if (dmx < -0.5) dmx += 1;
    const px = dmx * wp + stageW / 2;
    const py = (anchor.my - c.my) * wp + stageH / 2;

    const cardW = pop.offsetWidth || 336;
    const cardH = pop.offsetHeight || 360;
    const margin = 12;
    const gap = 22;
    const pinVisible = px >= -12 && px <= stageW + 12 && py >= -12 && py <= stageH + 12;

    let side: 'right' | 'left' | 'float' = 'right';
    let x = px + gap;
    if (x + cardW + margin > stageW) {
      const leftX = px - gap - cardW;
      if (leftX >= margin) {
        side = 'left';
        x = leftX;
      } else {
        side = 'float';
        x = Math.max(margin, Math.min(stageW - cardW - margin, px + gap));
      }
    } else if (x < margin) {
      side = 'float';
      x = margin;
    }

    const targetY = py - Math.min(76, cardH * 0.28);
    const y = Math.max(margin, Math.min(stageH - cardH - margin, targetY));

    pop.dataset.side = side;
    pop.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;

    if (arrow) {
      const showArrow =
        pinVisible && (side === 'right' || side === 'left') && py >= y + 12 && py <= y + cardH - 14;
      if (showArrow) {
        arrow.style.display = 'block';
        arrow.style.top = `${Math.round(Math.max(46, Math.min(cardH - 22, py - y)))}px`;
      } else {
        arrow.style.display = 'none';
      }
    }
  };

  useEffect(() => {
    setGymDetailOpen(false);
    setGymConfirmOpen(false);
  }, [selectedCityId, cardOpen]);

  useLayoutEffect(() => {
    if (showPopover) positionPopover();
  }, [
    showPopover,
    selectedCityId,
    selectedZoneId,
    gymDetailOpen,
    gymConfirmOpen,
    stageSize,
    viewedWeather,
    selectedHotel,
    effectiveHome.lat,
    effectiveHome.lng,
  ]);

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

  // Cursor-centered zoom helper (operates directly on camRef for silky 60fps trackpad/wheel zooming)
  const zoomAroundScreenPoint = (sx: number, sy: number, deltaZoom: number, immediate = true) => {
    const prev = camRef.current;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + deltaZoom));
    if (Math.abs(nextZoom - prev.zoom) < 1e-5) return;
    const { w, h } = stageSizeRef.current;
    const wpOld = worldPxAt(prev.zoom);
    const wpNew = worldPxAt(nextZoom);
    const anchorMx = prev.mx + (sx - w / 2) / wpOld;
    const anchorMy = prev.my + (sy - h / 2) / wpOld;
    const nextMx = (((anchorMx - (sx - w / 2) / wpNew) % 1) + 1) % 1;
    const nextMy = Math.max(0.02, Math.min(0.98, anchorMy - (sy - h / 2) / wpNew));
    const next = { mx: nextMx, my: nextMy, zoom: Number(nextZoom.toFixed(4)) };
    camRef.current = next;
    if (immediate) {
      setCamState(next);
    } else {
      syncCamHudThrottled();
    }
  };

  // Native non-passive wheel listener: smoothly normalizes trackpad scroll, trackpad pinch (ctrlKey),
  // and notched mouse wheels without abrupt jumps or browser page zoom.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      let pxDelta = e.deltaY;
      if (e.deltaMode === 1) pxDelta *= 32; // DOM_DELTA_LINE
      else if (e.deltaMode === 2) pxDelta *= 360; // DOM_DELTA_PAGE
      if (pxDelta === 0) return;

      const deltaZoom = e.ctrlKey
        ? Math.max(-0.22, Math.min(0.22, -pxDelta * 0.007))
        : Math.max(-0.28, Math.min(0.28, -pxDelta * 0.0016));

      const rect = cv.getBoundingClientRect();
      zoomAroundScreenPoint(e.clientX - rect.left, e.clientY - rect.top, deltaZoom, false);
    };
    cv.addEventListener('wheel', onWheelNative, { passive: false });
    return () => cv.removeEventListener('wheel', onWheelNative);
  }, []);

  // Complete flight animation cleanly
  useEffect(() => {
    if (!flightAnim) return;
    const timer = window.setTimeout(() => {
      const target = flightAnim.targetCity;
      const tier = flightAnim.hotelTier;
      setFlightAnim(null);
      if (target && tier) {
        const tierMeta = HOTEL_TIERS.find((t) => t.id === tier) ?? HOTEL_TIERS[0];
        const isSettledTarget = (tour.settledCityIds ?? []).includes(target.id);
        const stayUntilTs = isSettledTarget ? null : Date.now() + tierMeta.days * 24 * 3600_000;
        onUpdateMeta((prev) => {
          const prevTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
          const visited = prevTour.visitedCities.includes(target.id)
            ? prevTour.visitedCities
            : [...prevTour.visitedCities, target.id];
          const settledHere = (prevTour.settledCityIds ?? []).includes(target.id);
          return {
            ...prev,
            worldTour: {
              ...prevTour,
              currentCityId: target.id,
              stayHotelTier: settledHere ? 'grand' : tier,
              stayUntilTs: settledHere ? null : stayUntilTs,
              visitedCities: visited,
            },
          };
        });
        setSelectedCityId(target.id);
        setSelectedZoneId(null);
        setCardOpen(true);
        // Smoothly zoom in slightly on landing so the user sees the city's terrain!
        setCam({
          mx: lngToMercX(target.lng),
          my: latToMercY(target.lat),
          zoom: 9.5,
        });
        sound.play('levelup');
        showToast(
          isSettledTarget
            ? `🏡 已飞抵你的定居城市「${target.name}」，永久免费入住自有房产！`
            : `✈ 已抵达${target.name}，顺利入住「${target.hotelNames[tier]}」(${tierMeta.days}天)！`,
        );
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
        setCardOpen(true);
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
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(hit.pixelImg, dx, dy, dw, dh);
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
                const imgSrc = pHit.pixelImg;
                const subCount = 1 << shift;
                const subX = tx & (subCount - 1);
                const subY = ty & (subCount - 1);
                const sw = imgSrc.width / subCount;
                const sh = imgSrc.height / subCount;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(imgSrc, subX * sw, subY * sh, sw, sh, dx, dy, dw, dh);
                drawnFallback = true;
              }
            }
          }
        }
      }
      ctx.imageSmoothingEnabled = false;

      // Subtle retro pixel scanline / grid tint when zoomed out for cohesive GBA Atlas feel
      if (c.zoom < 10) {
        ctx.fillStyle = 'rgba(18, 28, 48, 0.08)';
        ctx.fillRect(0, 0, stageSize.w, stageSize.h);
      }

      // 3.5 Complete Real-World Atlas Layer: Curved Inter-City Highways, HSR, Maritime Routes, Rivers & Reference Cities!
      const placedAtlasBoxes: { sx: number; sy: number; w: number; h: number }[] = [];
      for (const city of WORLD_CITIES) {
        const [csx, csy] = mercToScreen(lngToMercX(city.lng), latToMercY(city.lat), c);
        placedAtlasBoxes.push({ sx: csx, sy: csy - 14, w: 54, h: 24 });
      }
      if (c.zoom <= 9.5) {
        for (const z of WORLD_ZONES) {
          if (z.unlocked) continue;
          const [zsx, zsy] = mercToScreen(lngToMercX(z.centerLng), latToMercY(z.centerLat), c);
          placedAtlasBoxes.push({ sx: zsx, sy: zsy + 14, w: 96, h: 52 });
        }
      }
      const canPlaceAtlasLabel = (sx: number, sy: number, w: number, h = 14): boolean => {
        if (sx < 22 || sx > stageSize.w - 22 || sy < 18 || sy > stageSize.h - 22) return false;
        for (const box of placedAtlasBoxes) {
          if (Math.abs(sx - box.sx) < (w + box.w) * 0.5 + 4 && Math.abs(sy - box.sy) < (h + box.h) * 0.5 + 3) {
            return false;
          }
        }
        placedAtlasBoxes.push({ sx, sy, w, h });
        return true;
      };

      if (c.zoom >= 3.2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const roadAlpha = Math.min(1, (c.zoom - 3.0) / 1.4);
        const hwyW = Math.max(1.3, Math.min(3.2, 0.95 + (c.zoom - 3.0) * 0.36));

        // 3.5A Maritime Ferry Corridors (sky-blue dashed arcs)
        if (c.zoom >= 3.4) {
          ctx.strokeStyle = `rgba(186, 230, 253, ${(0.76 * roadAlpha).toFixed(2)})`;
          ctx.lineWidth = Math.max(1.1, Math.min(1.8, hwyW * 0.65));
          ctx.setLineDash([5, 5]);
          for (const cor of REAL_WORLD_CORRIDORS) {
            if (cor.kind !== 'ferry' || cor.points.length < 2) continue;
            ctx.beginPath();
            cor.points.forEach(([lat, lng], i) => {
              const [px, py] = mercToScreen(lngToMercX(lng), latToMercY(lat), c);
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        // 3.5B Inter-City Highways (dark slate casing + golden arterial fill + green route shields)
        const highwayCorridors = REAL_WORLD_CORRIDORS.filter((cor) => cor.kind === 'highway' && cor.points.length >= 2);
        ctx.strokeStyle = `rgba(42, 52, 70, ${(0.86 * roadAlpha).toFixed(2)})`;
        ctx.lineWidth = hwyW + 1.4;
        for (const cor of highwayCorridors) {
          ctx.beginPath();
          cor.points.forEach(([lat, lng], i) => {
            const [px, py] = mercToScreen(lngToMercX(lng), latToMercY(lat), c);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(246, 185, 59, ${(0.92 * roadAlpha).toFixed(2)})`;
        ctx.lineWidth = hwyW;
        for (const cor of highwayCorridors) {
          ctx.beginPath();
          cor.points.forEach(([lat, lng], i) => {
            const [px, py] = mercToScreen(lngToMercX(lng), latToMercY(lat), c);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        }

        // Green Highway Route Shields (G2 / G4 / G60/G15 / G50...)
        if (c.zoom >= 4.7) {
          ctx.font = 'bold 8px "PingFang SC", monospace';
          for (const cor of highwayCorridors) {
            const midPt = cor.points[Math.floor(cor.points.length * 0.5)];
            const [mx, my] = mercToScreen(lngToMercX(midPt[1]), latToMercY(midPt[0]), c);
            const code = cor.label.split(' ')[0] || cor.label;
            const badge = c.zoom >= 6.4 ? cor.label : code;
            const tw = Math.round(ctx.measureText(badge).width + 8);
            if (!canPlaceAtlasLabel(mx, my, tw + 4, 13)) continue;
            ctx.fillStyle = '#1b7a38';
            ctx.fillRect(Math.round(mx - tw / 2), Math.round(my - 6), tw, 12);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.9;
            ctx.strokeRect(Math.round(mx - tw / 2), Math.round(my - 6), tw, 12);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badge, Math.round(mx), Math.round(my + 0.5));
          }
        }

        // 3.5C High-Speed Rail / Shinkansen Tracks (black track + crisp dashed white sleepers)
        if (c.zoom >= 4.2) {
          const railAlpha = Math.min(1, (c.zoom - 4.0) / 1.2);
          const railCorridors = REAL_WORLD_CORRIDORS.filter((cor) => cor.kind === 'rail' && cor.points.length >= 2);
          ctx.strokeStyle = `rgba(30, 36, 48, ${(0.88 * railAlpha).toFixed(2)})`;
          ctx.lineWidth = Math.max(1.5, Math.min(2.4, hwyW * 0.85));
          for (const cor of railCorridors) {
            ctx.beginPath();
            cor.points.forEach(([lat, lng], i) => {
              const [px, py] = mercToScreen(lngToMercX(lng), latToMercY(lat), c);
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
          }
          ctx.strokeStyle = `rgba(248, 249, 250, ${(0.9 * railAlpha).toFixed(2)})`;
          ctx.lineWidth = Math.max(0.8, Math.min(1.2, hwyW * 0.45));
          ctx.setLineDash([4, 4]);
          for (const cor of railCorridors) {
            ctx.beginPath();
            cor.points.forEach(([lat, lng], i) => {
              const [px, py] = mercToScreen(lngToMercX(lng), latToMercY(lat), c);
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        // 3.5D Major Rivers labels (长江 / 黄河 / 汉江 / 珠江...)
        if (c.zoom >= 4.6) {
          ctx.font = 'bold 9px "PingFang SC", "Microsoft YaHei", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (const riv of REAL_WORLD_RIVERS) {
            if (riv.points.length < 2) continue;
            const rw = Math.round(ctx.measureText(riv.name).width + 8);
            for (const frac of [0.52, 0.35, 0.7]) {
              const idx = Math.min(riv.points.length - 1, Math.floor(riv.points.length * frac));
              const [rLat, rLng] = riv.points[idx];
              const [rx, ry] = mercToScreen(lngToMercX(rLng), latToMercY(rLat), c);
              if (!canPlaceAtlasLabel(rx, ry, rw, 13)) continue;
              ctx.fillStyle = '#0b3d66';
              ctx.fillText(riv.name, Math.round(rx + 1), Math.round(ry + 1));
              ctx.fillStyle = '#c5e8ff';
              ctx.fillText(riv.name, Math.round(rx), Math.round(ry));
              break;
            }
          }
        }

        // 3.5E Regional & World Reference Cities (南京/武汉/长沙/重庆/西安/首尔/曼谷/伦敦/纽约/悉尼...)
        ctx.font = 'bold 9.5px "PingFang SC", "Microsoft YaHei", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        for (const cap of REFERENCE_CITIES) {
          if (cap.tier === 'provincial' && c.zoom < 4.0) continue;
          const [cx, cy] = mercToScreen(lngToMercX(cap.lng), latToMercY(cap.lat), c);
          if (cx < -30 || cx > stageSize.w + 30 || cy < -30 || cy > stageSize.h + 30) continue;
          const tw = Math.round(ctx.measureText(cap.name).width + 8);
          if (!canPlaceAtlasLabel(cx, cy - 11, tw, 15)) continue;

          // Subtle square town dot
          const dotSz = cap.tier === 'world' ? 6 : 5;
          ctx.fillStyle = cap.tier === 'world' ? '#4dabf7' : '#ff6b6b';
          ctx.fillRect(Math.round(cx - dotSz / 2), Math.round(cy - dotSz / 2), dotSz, dotSz);
          ctx.strokeStyle = '#161420';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(Math.round(cx - dotSz / 2), Math.round(cy - dotSz / 2), dotSz, dotSz);

          // Compact readable city name plate
          const lx = Math.round(cx - tw / 2);
          const ly = Math.round(cy - dotSz / 2 - 15);
          ctx.fillStyle = 'rgba(16, 20, 32, 0.78)';
          ctx.fillRect(lx, ly, tw, 13);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
          ctx.lineWidth = 1;
          ctx.strokeRect(lx, ly, tw, 13);
          ctx.fillStyle = '#e9ecef';
          ctx.fillText(cap.name, Math.round(cx), ly + 10);
        }
        ctx.restore();
      }

      // 4. Immersive Layered Weather Disasters & Legendary Battles Across All Global Regions
      const hovered = hoveredTargetRef.current;
      drawWorldMapAnomalies({
        ctx,
        zones: WORLD_ZONES,
        zoom: c.zoom,
        camMx: c.mx,
        camMy: c.my,
        worldPx: wp,
        stageW: stageSize.w,
        stageH: stageSize.h,
        ts,
        selectedZoneId,
        hoveredZoneId: hovered?.kind === 'zone' ? hovered.id : null,
        cardOpen,
        project: (lng, lat) => mercToScreen(lngToMercX(lng), latToMercY(lat), c),
      });

      // 5. Dashed Flight Preview Arc
      if (selectedCity && selectedCity.id !== activeHereCity?.id && !flightAnim) {
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
        const isHomeHovered = hovered?.kind === 'home';
        const pulse = (isHomeHovered ? 12 : 9) + Math.sin(ts * 0.005) * 3.5;
        ctx.strokeStyle = isHomeHovered ? '#ffe066' : 'rgba(77, 171, 247, 0.92)';
        ctx.lineWidth = isHomeHovered ? 3 : 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
        ctx.stroke();

        const hs = isHomeHovered ? 14 : 12;
        ctx.fillStyle = '#1c7ed6';
        ctx.fillRect(Math.round(sx - hs / 2), Math.round(sy - hs / 2), hs, hs);
        ctx.strokeStyle = isHomeHovered ? '#ffe066' : '#fffdf5';
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(sx - hs / 2), Math.round(sy - hs / 2), hs, hs);

        ctx.fillStyle = isHomeHovered ? '#ffe066' : 'rgba(18, 24, 38, 0.92)';
        ctx.fillRect(Math.round(sx - 26), Math.round(sy + 9), 52, 16);
        if (isHomeHovered) {
          ctx.strokeStyle = '#161420';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(Math.round(sx - 26), Math.round(sy + 9), 52, 16);
        }
        ctx.fillStyle = isHomeHovered ? '#161420' : '#74c0fc';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏠 老家', Math.round(sx), Math.round(sy + 21));
      }

      // 7. City Gym Pins (with crisp hover glow & lifted label feedback)
      for (const city of WORLD_CITIES) {
        const [sx, sy] = mercToScreen(lngToMercX(city.lng), latToMercY(city.lat), c);
        if (sx < -60 || sx > stageSize.w + 60 || sy < -60 || sy > stageSize.h + 60) continue;
        const isCurrent = activeHereCity?.id === city.id;
        const isSelected = cardOpen && selectedCityId === city.id;
        const isHovered = hovered?.kind === 'city' && hovered.id === city.id;
        const isCleared = tour.clearedCityGyms.includes(city.id);

        if (isCurrent || isHovered) {
          const r = (isHovered ? 13 : 11) + Math.sin(ts * 0.006) * 2.5;
          ctx.strokeStyle = isHovered ? '#ffffff' : '#ffe066';
          ctx.lineWidth = isHovered ? 2.5 : 2;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        const sz = isSelected || isHovered ? 14 : 11;
        ctx.fillStyle = isCleared ? '#ffd43b' : city.accentColor;
        ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);
        ctx.strokeStyle = isSelected || isHovered ? '#ffffff' : '#161420';
        ctx.lineWidth = isSelected || isHovered ? 2.5 : 2;
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
        const ly = Math.round(sy - sz / 2 - (isHovered ? 23 : 21));
        ctx.fillStyle = isSelected ? '#ffe066' : isHovered ? '#fff3bf' : 'rgba(18, 22, 34, 0.9)';
        ctx.fillRect(lx, ly, tw, 16);
        ctx.strokeStyle = isHovered && !isSelected ? '#ffe066' : '#161420';
        ctx.lineWidth = isHovered ? 2 : 1.5;
        ctx.strokeRect(lx, ly, tw, 16);
        ctx.fillStyle = isSelected || isHovered ? '#161420' : '#fffdf5';
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

      positionPopover();
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [stageSize, selectedCity, selectedCityId, selectedZoneId, cardOpen, tour, originPoint, flightAnim, activeHereCity]);

  // Real Browser GPS Geolocation Handler (3-stage waterfall: OS cached/network -> Hardware GNSS -> HTTPS IP fallback)
  const handleLocateGps = async () => {
    const applyLocatedCoords = (
      rawLat: number,
      rawLng: number,
      isRealGps: boolean,
      cityHint?: string,
    ) => {
      const lat = Number(rawLat.toFixed(5));
      const lng = Number(rawLng.toFixed(5));
      const eco = getLocalHomeEcology(lat, lng);
      const label = isRealGps
        ? eco.nearestDistKm <= 80
          ? `${eco.nearestCity.name} · GPS老家`
          : `GPS (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`
        : cityHint
          ? `${cityHint} · 网络定位`
          : eco.nearestDistKm <= 120
            ? `${eco.nearestCity.name} · 网络定位`
            : `网络定位 (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
      onUpdateMeta((prev) => ({
        ...prev,
        worldTour: {
          ...(prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE),
          homeCoords: { lat, lng, label, isRealGps },
        },
      }));
      setCam({ mx: lngToMercX(lng), my: latToMercY(lat), zoom: isRealGps ? 13.5 : 11.2 });
      setSelectedCityId(null);
      setSelectedZoneId(null);
      setCardOpen(true);
      setGpsStatus(null);
      sound.play('levelup');
      showToast(
        isRealGps
          ? `📍 GPS 重生点已锚定：${label}（可双指放大至街道级！）`
          : `📡 室内卫星信号较弱，已通过网络定位锚定：${label}`,
      );
    };

    const requestGeo = (opts: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });

    const tryIpFallback = async (): Promise<{ lat: number; lng: number; city?: string } | null> => {
      const endpoints: Array<{
        url: string;
        parse: (d: Record<string, unknown>) => { lat: number; lng: number; city?: string } | null;
      }> = [
        {
          url: 'https://get.geojs.io/v1/ip/geo.json',
          parse: (d) => {
            const lat = Number(d.latitude);
            const lng = Number(d.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return { lat, lng, city: typeof d.city === 'string' && d.city ? d.city : undefined };
          },
        },
        {
          url: 'https://ipwho.is/',
          parse: (d) => {
            if (d.success === false) return null;
            const lat = Number(d.latitude);
            const lng = Number(d.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return { lat, lng, city: typeof d.city === 'string' && d.city ? d.city : undefined };
          },
        },
      ];
      for (const ep of endpoints) {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 4500);
        try {
          const res = await fetch(ep.url, { signal: ctrl.signal });
          window.clearTimeout(timer);
          if (!res.ok) continue;
          const json = (await res.json()) as Record<string, unknown>;
          const parsed = ep.parse(json);
          if (parsed) return parsed;
        } catch {
          window.clearTimeout(timer);
        }
      }
      return null;
    };

    if (!('geolocation' in navigator)) {
      setGpsStatus('当前浏览器不支持原生 GPS，正在尝试网络定位...');
      const ipLoc = await tryIpFallback();
      if (ipLoc) {
        applyLocatedCoords(ipLoc.lat, ipLoc.lng, false, ipLoc.city);
      } else {
        setGpsStatus('当前浏览器不支持 GPS，将按语言使用默认出生点，也可花钱在任意城市定居');
        sound.play('error');
      }
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setGpsStatus('非 HTTPS 安全环境无法调用原生 GPS，正在尝试网络定位...');
      const ipLoc = await tryIpFallback();
      if (ipLoc) {
        applyLocatedCoords(ipLoc.lat, ipLoc.lng, false, ipLoc.city);
      } else {
        setGpsStatus('浏览器要求通过 HTTPS 或 localhost 访问才可启用 GPS 定位');
        sound.play('error');
      }
      return;
    }

    setGpsStatus('正在获取定位（快速模式）...');
    let lastCode = 0;

    // Stage 1: Fast OS-cached or Wi-Fi/Cell fix (instant if OS already has a fix!)
    try {
      const pos = await requestGeo({
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 600000,
      });
      applyLocatedCoords(pos.coords.latitude, pos.coords.longitude, true);
      return;
    } catch (err) {
      lastCode = (err as GeolocationPositionError)?.code ?? 0;
    }

    // Stage 2: Direct hardware GNSS (GPS / BeiDou) — works in China even without Google Location Services!
    if (lastCode !== 1) {
      setGpsStatus('正在连接手机 GPS / 北斗卫星定位（室内可能需要几秒）...');
      try {
        const pos = await requestGeo({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 300000,
        });
        applyLocatedCoords(pos.coords.latitude, pos.coords.longitude, true);
        return;
      } catch (err) {
        lastCode = (err as GeolocationPositionError)?.code ?? lastCode;
      }
    }

    // Stage 3: Indoors / GMS-blocked fallback -> HTTPS IP city geolocation so mobile users aren't stuck!
    if (lastCode !== 1) {
      setGpsStatus('室内 GPS 卫星信号较弱，正在自动切换网络定位...');
      const ipLoc = await tryIpFallback();
      if (ipLoc) {
        applyLocatedCoords(ipLoc.lat, ipLoc.lng, false, ipLoc.city);
        return;
      }
    }

    if (lastCode === 1) {
      setGpsStatus(
        '定位权限被系统拦截：请检查 ① 手机顶部「定位/GPS」总开关已开启 ② 系统设置已允许浏览器获取位置 ③ 网页已允许定位',
      );
    } else if (lastCode === 3) {
      setGpsStatus('GPS 搜星超时（室内信号较弱）且网络定位失败，请移至窗边重试或直接在地图选城');
    } else {
      setGpsStatus('手机当前无法获取位置信号（室内无卫星信号或系统定位服务未就绪），请稍后重试');
    }
    sound.play('error');
  };

  // Shared hit-tester for BOTH hover cursor/highlight and tap selection
  const hitTestMapTarget = (sx: number, sy: number): MapHoverTarget => {
    // 1. Unlocked cities (both marker square & name pill above it!)
    let bestCity: WorldCityDef | null = null;
    let bestD = 26;
    for (const c of WORLD_CITIES) {
      const [px, py] = mercToScreen(lngToMercX(c.lng), latToMercY(c.lat));
      const inLabel = sx >= px - 34 && sx <= px + 34 && sy >= py - 32 && sy <= py - 6;
      const dist = inLabel ? 0 : Math.hypot(sx - px, sy - py);
      if (dist < bestD) {
        bestD = dist;
        bestCity = c;
      }
    }
    if (bestCity) return { kind: 'city', id: bestCity.id };

    // 2. Home Beacon (pin + '🏠 老家' label)
    if (tour.homeCoords) {
      const [px, py] = mercToScreen(lngToMercX(tour.homeCoords.lng), latToMercY(tour.homeCoords.lat));
      const inHomeLbl = sx >= px - 28 && sx <= px + 28 && sy >= py + 6 && sy <= py + 28;
      if (inHomeLbl || Math.hypot(sx - px, sy - py) < 22) {
        return { kind: 'home' };
      }
    }

    // 3. Unreachable Regional Anomaly Footprints (organic fluid weather field hit-test!)
    const hitZone = hitTestAnomalyZone(
      sx,
      sy,
      WORLD_ZONES,
      camRef.current.zoom,
      camRef.current.mx,
      camRef.current.my,
      worldPxAt(camRef.current.zoom),
      stageSizeRef.current.w,
      stageSizeRef.current.h,
      (lng, lat) => mercToScreen(lngToMercX(lng), latToMercY(lat)),
    );
    if (hitZone) {
      return { kind: 'zone', id: hitZone.id };
    }
    return null;
  };

  // 60FPS Zero-Jank Multi-Touch Pinch + Pan + Hover Pointer Handlers
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midSx = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midSy = (pts[0].y + pts[1].y) / 2 - rect.top;
      const wp = worldPxAt(camRef.current.zoom);
      pinchStartRef.current = {
        dist: Math.max(12, dist),
        zoom: camRef.current.zoom,
        anchorMx: camRef.current.mx + (midSx - stageSize.w / 2) / wp,
        anchorMy: camRef.current.my + (midSy - stageSize.h / 2) / wp,
      };
      dragRef.current.active = false;
      return;
    }

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseMx: camRef.current.mx,
        baseMy: camRef.current.my,
      };
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Passive hover hit-testing when not actively dragging or pinching
    if (!pointersRef.current.has(e.pointerId)) {
      if (!dragRef.current.active && !pinchStartRef.current && !flightAnim) {
        const rect = e.currentTarget.getBoundingClientRect();
        const hit = hitTestMapTarget(e.clientX - rect.left, e.clientY - rect.top);
        hoveredTargetRef.current = hit;
        e.currentTarget.style.cursor = hit ? 'pointer' : 'grab';
      }
      return;
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midSx = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midSy = (pts[0].y + pts[1].y) / 2 - rect.top;
      const ratio = dist / Math.max(12, pinchStartRef.current.dist);
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, pinchStartRef.current.zoom + Math.log2(Math.max(0.05, ratio))),
      );
      const wpNew = worldPxAt(nextZoom);
      const nextMx = (((pinchStartRef.current.anchorMx - (midSx - stageSize.w / 2) / wpNew) % 1) + 1) % 1;
      const nextMy = Math.max(
        0.02,
        Math.min(0.98, pinchStartRef.current.anchorMy - (midSy - stageSize.h / 2) / wpNew),
      );
      camRef.current = { mx: nextMx, my: nextMy, zoom: Number(nextZoom.toFixed(3)) };
      syncCamHudThrottled();
      return;
    }

    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 5) {
      d.moved = true;
      e.currentTarget.style.cursor = 'grabbing';
    }
    const wp = worldPxAt(camRef.current.zoom);
    camRef.current = {
      ...camRef.current,
      mx: (((d.baseMx - dx / wp) % 1) + 1) % 1,
      my: Math.max(0.02, Math.min(0.98, d.baseMy - dy / wp)),
    };
    syncCamHudThrottled();
  };

  const handleCanvasPointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    hoveredTargetRef.current = null;
    e.currentTarget.style.cursor = 'grab';
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    // Smoothly hand off from 2-finger pinch back to 1-finger pan without any camera jump!
    if (pointersRef.current.size === 1 && pinchStartRef.current) {
      pinchStartRef.current = null;
      const rem = Array.from(pointersRef.current.values())[0];
      dragRef.current = {
        active: true,
        moved: true,
        startX: rem.x,
        startY: rem.y,
        baseMx: camRef.current.mx,
        baseMy: camRef.current.my,
      };
      setCam({ ...camRef.current });
      return;
    }

    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    const d = dragRef.current;
    const wasTap = d.active && !d.moved;
    d.active = false;
    setCam({ ...camRef.current });

    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const hit = hitTestMapTarget(sx, sy);
    hoveredTargetRef.current = hit;
    e.currentTarget.style.cursor = hit ? 'pointer' : 'grab';

    if (!wasTap || flightAnim) return;

    if (hit?.kind === 'city') {
      sound.play('cursor');
      recordCityClick(hit.id);
      setSelectedCityId(hit.id);
      setSelectedZoneId(null);
      setCardOpen(true);
      return;
    }

    if (hit?.kind === 'home') {
      sound.play('cursor');
      setSelectedCityId(null);
      setSelectedZoneId(null);
      setCardOpen(true);
      return;
    }

    if (hit?.kind === 'zone') {
      sound.play('cursor');
      setSelectedCityId(null);
      setSelectedZoneId(hit.id);
      setCardOpen(true);
      return;
    }

    // Tapping empty map space dismisses the floating location card
    if (cardOpen) {
      setCardOpen(false);
    }
  };

  const handleBookFlightAndStay = (target: WorldCityDef) => {
    const distKm = calcGeoDistanceKm(originPoint.lat, originPoint.lng, target.lat, target.lng);
    const isRealHomeTurf = Boolean(
      tour.homeCoords?.isRealGps &&
        calcGeoDistanceKm(tour.homeCoords.lat, tour.homeCoords.lng, target.lat, target.lng) <= 80,
    );
    const isSettled = settledIds.includes(target.id);
    // Visiting / travelling ALWAYS requires a round-trip ticket (one-way is only for settling/buying a house!)
    const ticketCost = calcFlightTicketCost(distKm, isRealHomeTurf, 'round_trip');
    const tierMeta = HOTEL_TIERS.find((t) => t.id === selectedHotel) ?? HOTEL_TIERS[0];
    const hotelCost = isRealHomeTurf || isSettled ? 0 : tierMeta.pricePerStay;
    const totalCost = ticketCost + hotelCost;

    if (coins < totalCost) {
      sound.play('error');
      showToast(`金币不足！需要 ${totalCost.toLocaleString()} 宝可币（当前 ${coins.toLocaleString()}）`);
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
      hotelTier: isSettled ? 'grand' : selectedHotel,
      startedAt: Date.now(),
      durationMs: 1850,
    });
  };

  const handleSettleInCity = (city: WorldCityDef) => {
    const alreadySettled = settledIds.includes(city.id);
    const isAlreadyHere = Boolean(activeHereCity && activeHereCity.id === city.id);
    const distKm = calcGeoDistanceKm(originPoint.lat, originPoint.lng, city.lat, city.lng);
    const isLocalWalk = isAlreadyHere || distKm <= 80;
    // Only settling (buying a house) allows purchasing a one-way relocation ticket!
    const oneWayCost = alreadySettled || isLocalWalk ? 0 : calcFlightTicketCost(distKm, false, 'one_way');
    const totalSettleCost = (alreadySettled ? 0 : city.settleCost) + oneWayCost;

    if (coins < totalSettleCost) {
      sound.play('error');
      showToast(
        oneWayCost > 0
          ? `金币不足！在${city.name}买房定居 + 单程机票共需 ${totalSettleCost.toLocaleString()} 宝可币（当前 ${coins.toLocaleString()}）`
          : `金币不足！在${city.name}买房定居需要 ${totalSettleCost.toLocaleString()} 宝可币（当前 ${coins.toLocaleString()}）`,
      );
      return;
    }
    onUpdateMeta(
      (prev) => {
        const prevTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
        const prevSettled = prevTour.settledCityIds ?? [];
        const nextSettled = prevSettled.includes(city.id) ? prevSettled : [...prevSettled, city.id];
        const nextVisited = prevTour.visitedCities.includes(city.id)
          ? prevTour.visitedCities
          : [...prevTour.visitedCities, city.id];
        return {
          ...prev,
          worldTour: {
            ...prevTour,
            homeCoords: {
              lat: city.lat,
              lng: city.lng,
              label: `定居 · ${city.name}`,
              isRealGps: false,
            },
            currentCityId: city.id,
            stayHotelTier: 'grand',
            stayUntilTs: null,
            visitedCities: nextVisited,
            settledCityIds: nextSettled,
          },
        };
      },
      -totalSettleCost,
    );
    setSelectedCityId(city.id);
    setSelectedZoneId(null);
    setCardOpen(true);
    setCam({
      mx: lngToMercX(city.lng),
      my: latToMercY(city.lat),
      zoom: Math.max(camRef.current.zoom, 10.5),
    });
    sound.play('levelup');
    showToast(
      alreadySettled
        ? `🏡 已将常驻私宅切换至「${city.name}」`
        : oneWayCost > 0
          ? `🏡 已购单程机票迁居并在${city.name}买房定居！以后再来只需买机票，永久免住酒店！`
          : `🏡 恭喜在${city.name}买房定居！以后再来只需买机票，永久免住酒店并享全队增益！`,
    );
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
    const homeLat = effectiveHome.lat;
    const homeLng = effectiveHome.lng;
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
    const targetHere = activeHereCity;
    const isSettledHere = Boolean(targetHere && settledIds.includes(targetHere.id));
    if (currentCity && !isSettledHere && isStayExpired) {
      sound.play('error');
      showToast('酒店住宿已到期，请先续住或免费返回家乡！');
      return;
    }
    if (targetHere) {
      const isHomeTurf =
        isAtHomeCity ||
        isSettledHere ||
        Boolean(
          tour.homeCoords?.isRealGps &&
            calcGeoDistanceKm(tour.homeCoords.lat, tour.homeCoords.lng, targetHere.lat, targetHere.lng) <= 80,
        );
      onLaunchWorldRun({
        cityId: targetHere.id,
        cityName: targetHere.name,
        originLat: targetHere.lat,
        originLng: targetHere.lng,
        biome: targetHere.biome,
        wildPool: targetHere.wildPool,
        isGymChallenge: isGym,
        gymName: targetHere.gymName,
        gymBadgeName: targetHere.gymBadgeName,
        bossSpecies: targetHere.gymBossSpecies,
        bossName: targetHere.gymBossTitle,
        bossTrainerKey: targetHere.gymTrainerKey,
        bossTrainerName: targetHere.gymLeaderName,
        rewardCoins: targetHere.rewardCoins,
        hotelTier: isSettledHere ? 'grand' : tour.stayHotelTier,
        isHomeTurf,
        regionalSkinId: targetHere.regionalSkinId,
      });
      return;
    }
    const lat = effectiveHome.lat;
    const lng = effectiveHome.lng;
    const eco = getLocalHomeEcology(lat, lng);
    onLaunchWorldRun({
      cityId: null,
      cityName: effectiveHome.label,
      originLat: lat,
      originLng: lng,
      biome: eco.biome,
      wildPool: eco.wildPool,
      isGymChallenge: false,
      rewardCoins: 120,
      hotelTier: null,
      isHomeTurf: true,
    });
  };

  const isViewingCurrentCity = Boolean(selectedCity && activeHereCity && selectedCity.id === activeHereCity.id);
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
          <span>返回</span>
        </button>

        <div className="wt-city-chips" title="老家与已买房定居的城市快捷传送栏">
          <button
            type="button"
            className={`wt-chip ${cardOpen && isViewingHome ? 'active' : ''}`}
            onClick={() => {
              sound.play('cursor');
              setSelectedCityId(null);
              setSelectedZoneId(null);
              setCardOpen(true);
              setCam({
                mx: lngToMercX(effectiveHome.lng),
                my: latToMercY(effectiveHome.lat),
                zoom: Math.max(camRef.current.zoom, 11.5),
              });
            }}
          >
            🏠 老家
          </button>
          {settledCities.map((c) => {
            const isHere = activeHereCity?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`wt-chip is-settled ${cardOpen && selectedCityId === c.id ? 'active' : ''} ${isHere ? 'is-here' : ''}`}
                onClick={() => {
                  sound.play('cursor');
                  recordCityClick(c.id);
                  setSelectedCityId(c.id);
                  setSelectedZoneId(null);
                  setCardOpen(true);
                  setCam((prev) => ({
                    mx: lngToMercX(c.lng),
                    my: latToMercY(c.lat),
                    zoom: Math.max(prev.zoom, 6.2),
                  }));
                }}
              >
                🏡 {c.name}
              </button>
            );
          })}
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
          <div className="wt-coin-pill">
            <PixelItemImg src="/sprites/items/amulet-coin.png" size={15} />
            <strong>{coins}</strong>
          </div>
        </div>
      </header>

      <div className="wt-body">
        <div ref={stageRef} className="wt-map-stage">
          <canvas
            ref={canvasRef}
            className="wt-map-canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerLeave}
            onDoubleClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              zoomAroundScreenPoint(e.clientX - rect.left, e.clientY - rect.top, 1.0);
            }}
          />

          <div className="wt-map-tools">
            <button
              type="button"
              onClick={() => zoomAroundScreenPoint(stageSize.w / 2, stageSize.h / 2, 0.75)}
              aria-label="放大"
              title="放大地图（支持直达街道级 Z18）"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomAroundScreenPoint(stageSize.w / 2, stageSize.h / 2, -0.75)}
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
          </div>

          <div className="wt-map-legend">
            <span>S1 城市巡礼</span>
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

          {showPopover && (
            <div
              ref={popoverRef}
              className="wt-popover"
              data-side="right"
              onPointerDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <div ref={arrowRef} className="wt-popover-arrow" />

              {selectedZone && !selectedZone.unlocked && (() => {
                const anomaly = selectedZone.anomaly;
                const badgeIcon = anomaly ? anomaly.mapBadge.split(' ')[0] : '⚠';
                return (
                  <div className="wt-card">
                    <div
                      className="wt-card-head is-locked"
                      style={anomaly ? { backgroundColor: anomaly.accentColor } : undefined}
                    >
                      <strong>{badgeIcon} {selectedZone.name}</strong>
                      <div className="wt-card-head-right">
                        <span>{anomaly?.alertTag ?? selectedZone.seasonTag}</span>
                        <button
                          type="button"
                          className="wt-card-close"
                          aria-label="关闭卡片"
                          onClick={() => {
                            sound.play('cancel');
                            setCardOpen(false);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="wt-card-body scroll-y">
                      {anomaly && (
                        <div className="wt-anomaly-alert" style={{ borderColor: anomaly.accentColor }}>
                          <div className="wt-anomaly-title">
                            <strong>{anomaly.title}</strong>
                            <small className="wt-anomaly-weather">气象：{anomaly.weatherLabel}</small>
                          </div>
                          <div className="wt-anomaly-pills">
                            {anomaly.blockedTransports.map((t) => (
                              <span key={t} className="wt-anomaly-pill">{t}</span>
                            ))}
                          </div>
                          <p className="wt-anomaly-reason">{anomaly.travelBlockReason}</p>
                        </div>
                      )}

                      {anomaly?.kind === 'legendary_clash' && anomaly.duelSpecies && (
                        <div className="wt-duel-showcase">
                          <div className="wt-duel-fighter">
                            <img
                              src={SPECIES_CATALOG[anomaly.duelSpecies[0]].stageSprites.adult.static}
                              alt={SPECIES_CATALOG[anomaly.duelSpecies[0]].defaultName}
                            />
                            <span>{SPECIES_CATALOG[anomaly.duelSpecies[0]].defaultName}</span>
                          </div>
                          <em className="wt-duel-vs">VS</em>
                          <div className="wt-duel-fighter">
                            <img
                              src={SPECIES_CATALOG[anomaly.duelSpecies[1]].stageSprites.adult.static}
                              alt={SPECIES_CATALOG[anomaly.duelSpecies[1]].defaultName}
                            />
                            <span>{SPECIES_CATALOG[anomaly.duelSpecies[1]].defaultName}</span>
                          </div>
                        </div>
                      )}

                      <p className="wt-desc">{selectedZone.teaserText}</p>
                      <div className="wt-sec-lbl">卫星侦测到的野生精灵</div>
                      <div className="wt-poke-strip">
                        {selectedZone.teaserSpecies.map((sp) => (
                          <img
                            key={sp}
                            className="wt-poke-avatar"
                            src={SPECIES_CATALOG[sp].stageSprites.baby.icon}
                            alt={SPECIES_CATALOG[sp].defaultName}
                            title={SPECIES_CATALOG[sp].defaultName}
                          />
                        ))}
                      </div>
                      <div className="wt-locked-note">
                        📡 气象中心与航管局正持续监测，异象平息后将恢复航班与铁路通航。
                      </div>
                    </div>
                  </div>
                );
              })()}

          {isViewingHome && (() => {
            const lat = effectiveHome.lat;
            const lng = effectiveHome.lng;
            const eco = getLocalHomeEcology(lat, lng);
            return (
              <div className="wt-card">
                <div className="wt-card-head" style={{ backgroundColor: '#1c7ed6' }}>
                  <strong>🏠 {effectiveHome.label}</strong>
                  <div className="wt-card-head-right">
                    <span>永久免费</span>
                    <button
                      type="button"
                      className="wt-card-close"
                      aria-label="关闭卡片"
                      onClick={() => {
                        sound.play('cancel');
                        setCardOpen(false);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="wt-card-body scroll-y">
                  {viewedWeather && (
                    <div
                      className="wt-weather-bar"
                      style={{ borderColor: viewedWeather.accentColor }}
                    >
                      <span className="wt-weather-main">
                        {viewedWeather.emoji} <strong>{viewedWeather.label}</strong> {viewedWeather.tempC}°C
                        <em>{viewedWeather.source === 'live' ? '实时气象' : '本地推演'}</em>
                      </span>
                      <small>{viewedWeather.buffText}</small>
                    </div>
                  )}
                  <p className="wt-desc">
                    当前匹配生态：<strong>{eco.regionLabel}</strong>（{lat.toFixed(3)}°, {lng.toFixed(3)}°）。
                    {!tour.homeCoords && '未开启 GPS 时自动按界面语言定位（中文默认上海 / 日语默认东京），也可花钱在任意城市置业定居！'}
                  </p>
                  {!tour.homeCoords?.isRealGps && (
                    <button type="button" className="wt-secondary-btn" onClick={handleLocateGps}>
                      📍 获取真实 GPS 坐标设为家乡
                    </button>
                  )}
                  <div className="wt-sec-lbl">家乡周边野生宝可梦</div>
                  <div className="wt-poke-strip">
                    {eco.wildPool.slice(0, 8).map((sp) => (
                      <img
                        key={sp}
                        className="wt-poke-avatar"
                        src={SPECIES_CATALOG[sp].stageSprites.baby.icon}
                        alt={SPECIES_CATALOG[sp].defaultName}
                        title={SPECIES_CATALOG[sp].defaultName}
                      />
                    ))}
                  </div>
                </div>
                <div className="wt-card-footer">
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
              </div>
            );
          })()}

          {selectedCity && isViewingCurrentCity && (() => {
            const cleared = tour.clearedCityGyms.includes(selectedCity.id);
            const isSettled = settledIds.includes(selectedCity.id);
            const isFreeHomeStay = isSettled || isAtHomeCity;
            const curTierMeta = HOTEL_TIERS.find((t) => t.id === tour.stayHotelTier) ?? HOTEL_TIERS[0];
            return (
              <div className="wt-card">
                <div className="wt-card-head" style={{ backgroundColor: selectedCity.accentColor }}>
                  <strong
                    title={
                      isSettled
                        ? `${selectedCity.name}自有定居房产 · 永久免住宿费 · 异色概率 UP · 全队攻击 +12%`
                        : isAtHomeCity
                          ? '当前身处本城，免机票免房费，可直接挑战道馆或出城探索'
                          : `${selectedCity.hotelNames[curTierMeta.id]} · ${curTierMeta.perkLabel}`
                    }
                  >
                    {isSettled ? '🏡' : '📍'} {selectedCity.name}
                  </strong>
                  <div className="wt-card-head-right">
                    <span
                      className={isFreeHomeStay ? 'is-home-tag' : isStayExpired ? 'is-expired-tag' : ''}
                      title={
                        isSettled
                          ? '永久免住宿费 · 异色概率 UP · 全队攻击 +12%'
                          : isAtHomeCity
                            ? '当前身处本城，免机票免房费'
                            : `${selectedCity.hotelNames[curTierMeta.id]} · ${curTierMeta.perkLabel}`
                      }
                    >
                      {isSettled
                        ? '永久定居'
                        : isAtHomeCity
                          ? '本城常驻'
                          : `🏨 ${formatRemainingStay(tour.stayUntilTs, nowMs)}`}
                    </span>
                    <button
                      type="button"
                      className="wt-card-close"
                      aria-label="关闭卡片"
                      onClick={() => {
                        sound.play('cancel');
                        setCardOpen(false);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="wt-card-body scroll-y">
                  {viewedWeather && (
                    <div
                      className="wt-weather-bar"
                      style={{ borderColor: viewedWeather.accentColor }}
                    >
                      <span className="wt-weather-main">
                        {viewedWeather.emoji} <strong>{viewedWeather.label}</strong> {viewedWeather.tempC}°C
                        <em>{viewedWeather.source === 'live' ? '实时气象' : '本地推演'}</em>
                      </span>
                      <small>{viewedWeather.buffText}</small>
                    </div>
                  )}

                  <p className="wt-desc">{selectedCity.fieldEffect}</p>

                  <div
                    className={`wt-gym-card ${gymDetailOpen ? 'is-expanded' : ''} ${gymConfirmOpen ? 'is-confirming' : ''}`}
                  >
                    <div className="wt-gym-banner">
                      <button
                        type="button"
                        className="wt-gym-info-btn"
                        title="点击查看或收起道馆详情"
                        onClick={() => {
                          sound.play('cursor');
                          setGymConfirmOpen(false);
                          setGymDetailOpen((v) => !v);
                        }}
                      >
                        <img
                          src={SPECIES_CATALOG[selectedCity.gymBossSpecies].stageSprites.adult.static}
                          alt={selectedCity.gymBossTitle}
                        />
                        <div className="wt-gym-text">
                          <strong>
                            {selectedCity.gymName} {cleared ? '👑' : ''}
                            <i className="wt-gym-chevron">{gymDetailOpen ? '▴' : '▾'}</i>
                          </strong>
                          <small>{selectedCity.gymLeaderName} · 王牌：{selectedCity.gymBossTitle}</small>
                          <em>徽章：{selectedCity.gymBadgeName}</em>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`wt-gym-challenge-btn ${gymConfirmOpen ? 'is-armed' : ''}`}
                        disabled={!isFreeHomeStay && isStayExpired}
                        title={
                          !isFreeHomeStay && isStayExpired
                            ? '酒店住宿已到期，请先续住或返回家乡'
                            : `挑战「${selectedCity.gymName}」`
                        }
                        aria-label={`挑战${selectedCity.gymName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isFreeHomeStay && isStayExpired) {
                            sound.play('error');
                            return;
                          }
                          sound.play('cursor');
                          setGymDetailOpen(false);
                          setGymConfirmOpen((v) => !v);
                        }}
                      >
                        ⚔
                      </button>
                    </div>

                    {gymDetailOpen && (
                      <div className="wt-gym-detail">
                        <div className="wt-gym-detail-row">
                          <span>馆主专精</span>
                          <strong>
                            {selectedCity.gymLeaderName} · {selectedCity.gymTypeLabel}
                          </strong>
                        </div>
                        <div className="wt-gym-detail-row">
                          <span>王牌宝可梦</span>
                          <strong>{selectedCity.gymBossTitle}</strong>
                        </div>
                        <div className="wt-gym-detail-row">
                          <span>胜利奖励</span>
                          <strong>
                            {selectedCity.gymBadgeName} + {selectedCity.rewardCoins} 币
                            {cleared ? '（已征服）' : ''}
                          </strong>
                        </div>
                        <p className="wt-gym-detail-note">{selectedCity.description}</p>
                      </div>
                    )}

                    {gymConfirmOpen && (
                      <div className="wt-gym-confirm">
                        <span>确认挑战「{selectedCity.gymName}」(3D)？</span>
                        <div className="wt-gym-confirm-ops">
                          <button
                            type="button"
                            className="wt-gym-cancel-btn"
                            onClick={() => {
                              sound.play('cancel');
                              setGymConfirmOpen(false);
                            }}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="wt-gym-go-btn"
                            onClick={() => {
                              setGymConfirmOpen(false);
                              handleLaunchFromCurrent(true);
                            }}
                          >
                            ⚔ 确认挑战
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="wt-sec-lbl">
                    本城野生精灵
                    {selectedCity.regionalSkinId && (
                      <em style={{ marginLeft: 6, fontStyle: 'normal', color: getSkinDef(selectedCity.regionalSkinId).rarityColor }}>
                        · 🏮限定色：{getSkinDef(selectedCity.regionalSkinId).name}
                      </em>
                    )}
                  </div>
                  <div className="wt-poke-strip">
                    {selectedCity.wildPool.map((sp) => (
                      <img
                        key={sp}
                        className="wt-poke-avatar"
                        src={SPECIES_CATALOG[sp].stageSprites.baby.icon}
                        alt={SPECIES_CATALOG[sp].defaultName}
                        title={SPECIES_CATALOG[sp].defaultName}
                      />
                    ))}
                  </div>
                </div>

                <div className="wt-card-footer">
                  <button
                    type="button"
                    className="wt-primary-btn"
                    disabled={!isFreeHomeStay && isStayExpired}
                    onClick={() => handleLaunchFromCurrent(false)}
                  >
                    🌿 出城探索 {selectedCity.name} 野外 (3D)
                  </button>
                  {isAtHomeCity ? (
                    !isSettled && (
                      <button
                        type="button"
                        className="wt-secondary-btn is-settle"
                        disabled={coins < selectedCity.settleCost}
                        onClick={() => handleSettleInCity(selectedCity)}
                      >
                        🏡 在{selectedCity.name}买房定居 ({selectedCity.settleCost.toLocaleString()} 币 · 以后免酒店+全队攻+12%)
                      </button>
                    )
                  ) : !isSettled ? (
                    <div className="wt-sub-ops">
                      <button
                        type="button"
                        className="wt-secondary-btn is-settle"
                        disabled={coins < selectedCity.settleCost}
                        onClick={() => handleSettleInCity(selectedCity)}
                      >
                        🏡 买房定居 ({selectedCity.settleCost.toLocaleString()}币)
                      </button>
                      <button
                        type="button"
                        className="wt-secondary-btn"
                        onClick={() => handleExtendStay(selectedCity, curTierMeta.id)}
                      >
                        🔄 续住 +{curTierMeta.days}天 ({curTierMeta.pricePerStay}币)
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="wt-secondary-btn" onClick={handleFlyHome}>
                      ✈ 持返程机票返回老家
                    </button>
                  )}
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
            const isSettled = settledIds.includes(selectedCity.id);
            const roundTripTicketCost = calcFlightTicketCost(distKm, isRealHomeTurf, 'round_trip');
            const oneWayTicketCost = calcFlightTicketCost(distKm, isRealHomeTurf, 'one_way');
            const tierMeta = HOTEL_TIERS.find((t) => t.id === selectedHotel) ?? HOTEL_TIERS[0];
            const hotelCost = isRealHomeTurf || isSettled ? 0 : tierMeta.pricePerStay;
            const totalCost = roundTripTicketCost + hotelCost;
            const totalSettleCost = selectedCity.settleCost + oneWayTicketCost;
            const cleared = tour.clearedCityGyms.includes(selectedCity.id);

            return (
              <div className="wt-card">
                <div className="wt-card-head" style={{ backgroundColor: selectedCity.accentColor }}>
                  <strong>{isSettled ? '🏡' : '✈'} 飞往 {selectedCity.name}</strong>
                  <div className="wt-card-head-right">
                    <span>{distKm.toLocaleString()} km</span>
                    <button
                      type="button"
                      className="wt-card-close"
                      aria-label="关闭卡片"
                      onClick={() => {
                        sound.play('cancel');
                        setCardOpen(false);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="wt-card-body scroll-y">
                  <p className="wt-desc">{selectedCity.description}</p>

                  {isSettled && (
                    <div className="wt-hometurf-pill">
                      🏡 已在{selectedCity.name}买房定居！无需花钱住酒店，只需支付往返机票即可入住自有私宅！
                    </div>
                  )}

                  {isRealHomeTurf && !isSettled && (
                    <div className="wt-hometurf-pill">
                      🏠 真实 GPS 主场共鸣！免机票免住宿费 + 本地闪光 UP！
                    </div>
                  )}

                  <div className={`wt-gym-card ${gymDetailOpen ? 'is-expanded' : ''}`}>
                    <div className="wt-gym-banner">
                      <button
                        type="button"
                        className="wt-gym-info-btn"
                        title="点击查看或收起道馆详情"
                        onClick={() => {
                          sound.play('cursor');
                          setGymDetailOpen((v) => !v);
                        }}
                      >
                        <img
                          src={SPECIES_CATALOG[selectedCity.gymBossSpecies].stageSprites.adult.static}
                          alt={selectedCity.gymBossTitle}
                        />
                        <div className="wt-gym-text">
                          <strong>
                            {selectedCity.gymName} {cleared ? '👑' : ''}
                            <i className="wt-gym-chevron">{gymDetailOpen ? '▴' : '▾'}</i>
                          </strong>
                          <small>{selectedCity.gymTypeLabel} · {selectedCity.gymLeaderName}</small>
                          <em>奖励：{selectedCity.gymBadgeName} + {selectedCity.rewardCoins} 币</em>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="wt-gym-challenge-btn is-remote"
                        title="飞抵该城市后可挑战道馆"
                        aria-label="飞抵后可挑战道馆"
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.play('error');
                          showToast(`请先飞抵「${selectedCity.name}」后再挑战道馆！`);
                        }}
                      >
                        ⚔
                      </button>
                    </div>

                    {gymDetailOpen && (
                      <div className="wt-gym-detail">
                        <div className="wt-gym-detail-row">
                          <span>王牌宝可梦</span>
                          <strong>{selectedCity.gymBossTitle}</strong>
                        </div>
                        <div className="wt-gym-detail-row">
                          <span>场地效果</span>
                          <strong>{selectedCity.fieldEffect}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="wt-sec-lbl">
                    本城野生精灵
                    {selectedCity.regionalSkinId && (
                      <em style={{ marginLeft: 6, fontStyle: 'normal', color: getSkinDef(selectedCity.regionalSkinId).rarityColor }}>
                        · 🏮限定色：{getSkinDef(selectedCity.regionalSkinId).name}
                      </em>
                    )}
                  </div>
                  <div className="wt-poke-strip">
                    {selectedCity.wildPool.map((sp) => (
                      <img
                        key={sp}
                        className="wt-poke-avatar"
                        src={SPECIES_CATALOG[sp].stageSprites.baby.icon}
                        alt={SPECIES_CATALOG[sp].defaultName}
                        title={SPECIES_CATALOG[sp].defaultName}
                      />
                    ))}
                  </div>

                  {!isSettled && (
                    <>
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
                    </>
                  )}
                </div>

                <div className="wt-card-footer">
                  <div className="wt-ticket-summary">
                    <span>
                      往返机票 {roundTripTicketCost.toLocaleString()} 币 +{' '}
                      {isSettled ? '自有私宅 0 币' : `酒店 ${hotelCost.toLocaleString()} 币`}
                    </span>
                    <strong>合计 {totalCost.toLocaleString()} 币</strong>
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
                        ? `宝可币不足（还差 ${(totalCost - coins).toLocaleString()} 币）`
                        : isSettled
                          ? `✈ 买往返机票入住私宅 (${totalCost.toLocaleString()} 币)`
                          : `✈ 买往返机票+酒店${tierMeta.days}天 (${totalCost.toLocaleString()} 币)`}
                  </button>

                  {!isSettled && (
                    <button
                      type="button"
                      className="wt-secondary-btn is-settle"
                      disabled={Boolean(flightAnim) || coins < totalSettleCost}
                      onClick={() => handleSettleInCity(selectedCity)}
                    >
                      {coins < totalSettleCost
                        ? `🏡 买房定居(${selectedCity.settleCost.toLocaleString()}) + 单程票(${oneWayTicketCost.toLocaleString()}) · 差 ${(totalSettleCost - coins).toLocaleString()} 币`
                        : `🏡 单程迁居买房定居 (${totalSettleCost.toLocaleString()} 币 · 以后免酒店)`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
