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

const MAP_W = 360;
const MAP_H = 180;

function lngLatToPixel(lng: number, lat: number): [number, number] {
  const x = ((lng + 180) / 360) * MAP_W;
  const y = ((90 - lat) / 180) * MAP_H;
  return [x, y];
}

function pixelToLngLat(px: number, py: number): { lng: number; lat: number } {
  const lng = Math.max(-180, Math.min(180, (px / MAP_W) * 360 - 180));
  const lat = Math.max(-82, Math.min(82, 90 - (py / MAP_H) * 180));
  return { lng: Number(lng.toFixed(2)), lat: Number(lat.toFixed(2)) };
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

/** Build the crisp 360×180 GBA/DS pixelated Earth raster once offscreen */
function buildPixelEarthCanvas(): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = MAP_W;
  off.height = MAP_H;
  const ctx = off.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // 1. Deep & mid ocean latitude gradient (banded pixel palette)
  for (let y = 0; y < MAP_H; y++) {
    const absLat = Math.abs(90 - (y / MAP_H) * 180);
    let col = '#1d4f82';
    if (absLat < 24) col = '#23629c';
    else if (absLat > 66) col = '#265378';
    ctx.fillStyle = col;
    ctx.fillRect(0, y, MAP_W, 1);
  }

  // Subtle retro pixel lat/lng graticule (every 30 deg)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let lng = -150; lng <= 150; lng += 30) {
    const [x] = lngLatToPixel(lng, 0);
    ctx.fillRect(Math.round(x), 0, 1, MAP_H);
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const [, y] = lngLatToPixel(0, lat);
    ctx.fillRect(0, Math.round(y), MAP_W, 1);
  }

  // 2. Rasterize landmass mask into offscreen binary buffer
  const maskC = document.createElement('canvas');
  maskC.width = MAP_W;
  maskC.height = MAP_H;
  const mctx = maskC.getContext('2d')!;
  mctx.fillStyle = '#ffffff';
  for (const poly of WORLD_LAND_POLYGONS) {
    mctx.beginPath();
    poly.forEach(([lng, lat], idx) => {
      const [px, py] = lngLatToPixel(lng, lat);
      if (idx === 0) mctx.moveTo(px, py);
      else mctx.lineTo(px, py);
    });
    mctx.closePath();
    mctx.fill();
  }
  const maskData = mctx.getImageData(0, 0, MAP_W, MAP_H).data;
  const isLand = (x: number, y: number) => {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
    return maskData[(y * MAP_W + x) * 4 + 3] > 90;
  };

  // 3. Draw shallow turquoise coastal waters + crisp 1px dark coastline + biome-tinted pixel terrain!
  for (let y = 0; y < MAP_H; y++) {
    const lat = 90 - (y / MAP_H) * 180;
    const absLat = Math.abs(lat);
    for (let x = 0; x < MAP_W; x++) {
      const lng = (x / MAP_W) * 360 - 180;
      if (isLand(x, y)) {
        const edge =
          !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1);
        if (edge) {
          ctx.fillStyle = '#182430';
        } else {
          // Subtle checkerboard & biome tinting by real geography
          const checker = (x + y) % 2 === 0;
          if (absLat > 65) {
            ctx.fillStyle = checker ? '#edf2f7' : '#dbe7f0'; // polar snow
          } else if (
            (lat > 14 && lat < 33 && lng > -16 && lng < 60) || // Sahara + Arabia
            (lat > -31 && lat < -17 && lng > 116 && lng < 144) || // Australia outback
            (lat > 35 && lat < 46 && lng > 75 && lng < 108) // Gobi / NW desert
          ) {
            ctx.fillStyle = checker ? '#d9b56c' : '#cca45a';
          } else if (absLat > 47) {
            ctx.fillStyle = checker ? '#4b8f55' : '#407e4a'; // boreal taiga
          } else if (absLat < 16) {
            ctx.fillStyle = checker ? '#3ea047' : '#358d3e'; // tropical jungle
          } else {
            ctx.fillStyle = checker ? '#62b856' : '#55a64b'; // temperate lush green
          }
        }
        ctx.fillRect(x, y, 1, 1);
      } else {
        // 2px shallow reef water glow near coasts
        const near1 =
          isLand(x - 1, y) || isLand(x + 1, y) || isLand(x, y - 1) || isLand(x, y + 1);
        const near2 =
          !near1 &&
          (isLand(x - 2, y) || isLand(x + 2, y) || isLand(x, y - 2) || isLand(x, y + 2));
        if (near1) {
          ctx.fillStyle = '#53bce0';
          ctx.fillRect(x, y, 1, 1);
        } else if (near2) {
          ctx.fillStyle = '#3384b8';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  return off;
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

  // Selected target on map (city OR locked zone OR 'home')
  const [selectedCityId, setSelectedCityId] = useState<string | null>(
    tour.currentCityId ?? 'shanghai',
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<HotelTierId>('inn');
  const [pickHomeMode, setPickHomeMode] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Flight animation state (2s curved geodesic arc flight!)
  const [flightAnim, setFlightAnim] = useState<{
    fromLng: number;
    fromLat: number;
    toLng: number;
    toLat: number;
    targetCity: WorldCityDef | null; // null = flying back home!
    hotelTier: HotelTierId | null;
    startedAt: number;
    durationMs: number;
  } | null>(null);

  // Interactive camera (pan + zoom over 360×180 pixel Earth; starts focused nicely on East Asia!)
  const [cam, setCam] = useState<{ cx: number; cy: number; zoom: number }>(() => {
    const focusLng = currentCity?.lng ?? tour.homeCoords?.lng ?? 118.5;
    const focusLat = currentCity?.lat ?? tour.homeCoords?.lat ?? 33.5;
    const [px, py] = lngLatToPixel(focusLng, focusLat);
    return { cx: px, cy: py, zoom: 3.1 };
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const earthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    baseCx: number;
    baseCy: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, baseCx: 0, baseCy: 0 });
  const [stageSize, setStageSize] = useState({ w: 680, h: 420 });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 2800);
  };

  // Current origin coordinates (Current city -> Home GPS -> default Shanghai)
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

  // Measure map stage container cleanly with ResizeObserver
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

  // Build crisp pixel Earth bitmap once
  useEffect(() => {
    earthCanvasRef.current = buildPixelEarthCanvas();
  }, []);

  // Coordinate transforms between map pixel space (360×180) and screen canvas space
  const getScale = () => {
    const fitScale = Math.max(stageSize.w / MAP_W, stageSize.h / MAP_H);
    return fitScale * cam.zoom;
  };

  const mapToScreen = (mx: number, my: number): [number, number] => {
    const s = getScale();
    return [(mx - cam.cx) * s + stageSize.w / 2, (my - cam.cy) * s + stageSize.h / 2];
  };

  const screenToMap = (sx: number, sy: number): [number, number] => {
    const s = getScale();
    return [(sx - stageSize.w / 2) / s + cam.cx, (sy - stageSize.h / 2) / s + cam.cy];
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
        sound.play('levelup');
        showToast(`✈ 已抵达${target.name}，顺利入住「${target.hotelNames[tier]}」(${tierMeta.days}天)！`);
      } else {
        // Returned home
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

  // Real-time Pixel World Map Canvas Renderer (60fps during flight, gentle cloud/wave animation otherwise)
  useEffect(() => {
    let rafId = 0;
    const render = (ts: number) => {
      const cvs = canvasRef.current;
      const earth = earthCanvasRef.current;
      if (!cvs || !earth) {
        rafId = requestAnimationFrame(render);
        return;
      }
      if (cvs.width !== stageSize.w || cvs.height !== stageSize.h) {
        cvs.width = stageSize.w;
        cvs.height = stageSize.h;
      }
      const ctx = cvs.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;

      // Deep pixel ocean backdrop
      ctx.fillStyle = '#153a61';
      ctx.fillRect(0, 0, stageSize.w, stageSize.h);

      const s = getScale();
      const [ox, oy] = mapToScreen(0, 0);
      ctx.drawImage(earth, Math.round(ox), Math.round(oy), Math.round(MAP_W * s), Math.round(MAP_H * s));

      // Locked Global Regions: animated pixel fog clusters + lock badges
      for (const zone of WORLD_ZONES) {
        if (zone.unlocked) continue;
        const [zx, zy] = lngLatToPixel(zone.centerLng, zone.centerLat);
        const [sx, sy] = mapToScreen(zx, zy);
        const drift = Math.sin(ts * 0.001 + zx) * 4;

        // Soft pixel fog cloud blocks
        ctx.fillStyle = 'rgba(235, 241, 250, 0.72)';
        const cw = Math.max(46, Math.round(18 * s));
        const ch = Math.max(22, Math.round(8 * s));
        ctx.fillRect(Math.round(sx - cw / 2 + drift), Math.round(sy - ch / 2), cw, ch);
        ctx.fillRect(Math.round(sx - cw * 0.35 + drift), Math.round(sy - ch * 0.85), Math.round(cw * 0.7), Math.round(ch * 0.6));

        // Pixel border tag
        ctx.fillStyle = 'rgba(22, 20, 32, 0.86)';
        ctx.fillRect(Math.round(sx - 44), Math.round(sy - 10), 88, 20);
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(Math.round(sx - 44), Math.round(sy - 10), 88, 20);
        ctx.fillStyle = '#f8f9fa';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`🔒 ${zone.name.split('·')[0].trim()}`, Math.round(sx), Math.round(sy + 4));
      }

      // Draw dashed flight preview arc from origin -> selectedCity
      if (selectedCity && selectedCity.id !== tour.currentCityId && !flightAnim) {
        const [fx, fy] = lngLatToPixel(originPoint.lng, originPoint.lat);
        const [tx, ty] = lngLatToPixel(selectedCity.lng, selectedCity.lat);
        const [sx1, sy1] = mapToScreen(fx, fy);
        const [sx2, sy2] = mapToScreen(tx, ty);
        const midX = (sx1 + sx2) / 2;
        const midY = (sy1 + sy2) / 2 - Math.min(80, Math.hypot(sx2 - sx1, sy2 - sy1) * 0.28);

        ctx.save();
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -(ts * 0.025);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.quadraticCurveTo(midX, midY, sx2, sy2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Blue GPS Home Beacon
      if (tour.homeCoords) {
        const [hx, hy] = lngLatToPixel(tour.homeCoords.lng, tour.homeCoords.lat);
        const [sx, sy] = mapToScreen(hx, hy);
        const pulse = 8 + Math.sin(ts * 0.005) * 3;
        ctx.strokeStyle = 'rgba(77, 171, 247, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#1c7ed6';
        ctx.fillRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);
        ctx.strokeStyle = '#fffdf5';
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(sx - 6), Math.round(sy - 6), 12, 12);

        ctx.fillStyle = 'rgba(18, 24, 38, 0.9)';
        ctx.fillRect(Math.round(sx - 24), Math.round(sy + 9), 48, 15);
        ctx.fillStyle = '#74c0fc';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏠 老家', Math.round(sx), Math.round(sy + 20));
      }

      // Draw Unlocked Season-1 City Gym Pins
      for (const city of WORLD_CITIES) {
        const [cx, cy] = lngLatToPixel(city.lng, city.lat);
        const [sx, sy] = mapToScreen(cx, cy);
        const isCurrent = tour.currentCityId === city.id;
        const isSelected = selectedCityId === city.id;
        const isCleared = tour.clearedCityGyms.includes(city.id);

        if (isCurrent) {
          const r = 10 + Math.sin(ts * 0.006) * 3;
          ctx.strokeStyle = '#ffe066';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Pixel square pin
        const sz = isSelected ? 14 : 11;
        ctx.fillStyle = isCleared ? '#ffd43b' : city.accentColor;
        ctx.fillRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);
        ctx.strokeStyle = isSelected ? '#ffffff' : '#161420';
        ctx.lineWidth = isSelected ? 2.5 : 2;
        ctx.strokeRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);

        // Golden victory flag pole if cleared!
        if (isCleared) {
          ctx.fillStyle = '#ffd43b';
          ctx.fillRect(Math.round(sx + sz / 2 - 1), Math.round(sy - sz / 2 - 9), 8, 6);
          ctx.fillStyle = '#161420';
          ctx.fillRect(Math.round(sx + sz / 2 - 2), Math.round(sy - sz / 2 - 10), 2, 11);
        }

        // Crisp City Label Pill
        const lbl = isCurrent ? `📍${city.name}` : city.name;
        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(lbl).width + 10;
        const lx = Math.round(sx - tw / 2);
        const ly = Math.round(sy - sz / 2 - 21);
        ctx.fillStyle = isSelected ? '#ffe066' : 'rgba(18, 22, 34, 0.88)';
        ctx.fillRect(lx, ly, tw, 16);
        ctx.strokeStyle = '#161420';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(lx, ly, tw, 16);
        ctx.fillStyle = isSelected ? '#161420' : '#fffdf5';
        ctx.textAlign = 'center';
        ctx.fillText(lbl, Math.round(sx), ly + 12);
      }

      // Active Animated Pixel Plane Flight!
      if (flightAnim) {
        const elapsed = Date.now() - flightAnim.startedAt;
        const t = Math.max(0, Math.min(1, elapsed / flightAnim.durationMs));
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const [fx, fy] = lngLatToPixel(flightAnim.fromLng, flightAnim.fromLat);
        const [tx, ty] = lngLatToPixel(flightAnim.toLng, flightAnim.toLat);
        const [sx1, sy1] = mapToScreen(fx, fy);
        const [sx2, sy2] = mapToScreen(tx, ty);
        const midX = (sx1 + sx2) / 2;
        const midY = (sy1 + sy2) / 2 - Math.min(95, Math.hypot(sx2 - sx1, sy2 - sy1) * 0.32);

        // Full golden arc
        ctx.strokeStyle = 'rgba(255, 224, 102, 0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.quadraticCurveTo(midX, midY, sx2, sy2);
        ctx.stroke();

        // Current plane position along quadratic Bezier
        const u = 1 - ease;
        const px = u * u * sx1 + 2 * u * ease * midX + ease * ease * sx2;
        const py = u * u * sy1 + 2 * u * ease * midY + ease * ease * sy2;
        // Tangent angle
        const dx = 2 * u * (midX - sx1) + 2 * ease * (sx2 - midX);
        const dy = 2 * u * (midY - sy1) + 2 * ease * (sy2 - midY);
        const ang = Math.atan2(dy, dx);

        // Glowing contrail dot
        ctx.fillStyle = '#fff9db';
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 224, 102, 0.32)';
        ctx.fill();

        // Crisp pixel airplane sprite rotated toward destination
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
  }, [cam, stageSize, selectedCity, selectedCityId, tour, originPoint, flightAnim]);

  // Real Browser GPS Geolocation Handler
  const handleLocateGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('当前浏览器不支持 GPS，请点击「地图选点设老家」');
      return;
    }
    setGpsStatus('正在获取真实 GPS 坐标...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        const eco = getLocalHomeEcology(lat, lng);
        const label =
          eco.nearestDistKm <= 80
            ? `${eco.nearestCity.name} · GPS老家`
            : `GPS (${lat.toFixed(1)}°, ${lng.toFixed(1)}°)`;
        onUpdateMeta((prev) => ({
          ...prev,
          worldTour: {
            ...(prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE),
            homeCoords: { lat, lng, label, isRealGps: true },
          },
        }));
        const [px, py] = lngLatToPixel(lng, lat);
        setCam({ cx: px, cy: py, zoom: 3.4 });
        setGpsStatus(null);
        sound.play('levelup');
        showToast(`📍 GPS 重生点已锚定：${label}（${eco.regionLabel}）`);
      },
      () => {
        setGpsStatus('未授予 GPS 定位权限，可点击「点选老家」在地图上自选重生点');
        sound.play('error');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      baseCx: cam.cx,
      baseCy: cam.cy,
    };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    const s = getScale();
    setCam((prev) => ({
      ...prev,
      cx: Math.max(20, Math.min(MAP_W - 20, d.baseCx - dx / s)),
      cy: Math.max(15, Math.min(MAP_H - 15, d.baseCy - dy / s)),
    }));
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    d.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (d.moved || flightAnim) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Pick-Home-on-Map Mode
    if (pickHomeMode) {
      const [mx, my] = screenToMap(sx, sy);
      const { lat, lng } = pixelToLngLat(mx, my);
      const eco = getLocalHomeEcology(lat, lng);
      const label =
        eco.nearestDistKm <= 100
          ? `${eco.nearestCity.name} · 自选老家`
          : `自选老家 (${lat.toFixed(1)}°, ${lng.toFixed(1)}°)`;
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

    // Hit-test unlocked cities first
    let hitCity: WorldCityDef | null = null;
    let bestD = 26;
    for (const c of WORLD_CITIES) {
      const [cx, cy] = lngLatToPixel(c.lng, c.lat);
      const [px, py] = mapToScreen(cx, cy);
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
      const [hx, hy] = lngLatToPixel(tour.homeCoords.lng, tour.homeCoords.lat);
      const [px, py] = mapToScreen(hx, hy);
      if (Math.hypot(sx - px, sy - py) < 24) {
        sound.play('cursor');
        setSelectedCityId(null);
        setSelectedZoneId(null);
        return;
      }
    }

    // Hit-test Locked Global Zones
    for (const z of WORLD_ZONES) {
      if (z.unlocked) continue;
      const [zx, zy] = lngLatToPixel(z.centerLng, z.centerLat);
      const [px, py] = mapToScreen(zx, zy);
      if (Math.hypot(sx - px, sy - py) < 52) {
        sound.play('cursor');
        setSelectedCityId(null);
        setSelectedZoneId(z.id);
        return;
      }
    }
  };

  // Book flight + hotel stay and launch animated pixel plane!
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

    // Zoom camera nicely to frame both departure and destination!
    const [fx, fy] = lngLatToPixel(originPoint.lng, originPoint.lat);
    const [tx, ty] = lngLatToPixel(target.lng, target.lat);
    setCam({
      cx: (fx + tx) / 2,
      cy: (fy + ty) / 2,
      zoom: Math.max(1.8, Math.min(3.4, 180 / Math.max(40, Math.hypot(tx - fx, ty - fy) * 1.4))),
    });
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

  // Extend stay in current city
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

  // Free return flight back to GPS Home
  const handleFlyHome = () => {
    if (!currentCity) return;
    const homeLat = tour.homeCoords?.lat ?? 31.23;
    const homeLng = tour.homeCoords?.lng ?? 121.47;
    sound.play('confirm');
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

  // Launch 3D exploration or Gym Battle from current city or Home GPS!
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

    // Launching from GPS Home Spawn!
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

  // Render right panel content
  const isViewingCurrentCity = Boolean(selectedCity && currentCity && selectedCity.id === currentCity.id);
  const isViewingHome = !selectedCity && !selectedZone;

  return (
    <div className="wt-overlay">
      {/* Top World Navigation Ribbon */}
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
            title="在像素世界地图上手动点击任意地点设为家乡重生点"
          >
            <span>{pickHomeMode ? '点击地图设点…' : '📌 点选老家'}</span>
          </button>
          <div className="wt-coin-pill">
            <PixelItemImg src="/sprites/items/amulet-coin.png" size={15} />
            <strong>{coins}</strong>
          </div>
        </div>
      </header>

      {/* Main Split: Pixelated Real World Map + City Hub / Boarding Pass Drawer */}
      <div className="wt-body">
        <div
          ref={stageRef}
          className={`wt-map-stage ${pickHomeMode ? 'is-picking' : ''}`}
        >
          <canvas
            ref={canvasRef}
            className="wt-map-canvas"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onWheel={(e) => {
              e.preventDefault();
              setCam((prev) => ({
                ...prev,
                zoom: Math.max(1.0, Math.min(5.5, Number((prev.zoom - e.deltaY * 0.002).toFixed(2)))),
              }));
            }}
          />

          {/* Floating Map Zoom & Region Focus Controls */}
          <div className="wt-map-tools">
            <button
              type="button"
              onClick={() => setCam((c) => ({ ...c, zoom: Math.min(5.5, Number((c.zoom + 0.6).toFixed(2))) }))}
              aria-label="放大"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setCam((c) => ({ ...c, zoom: Math.max(1.0, Number((c.zoom - 0.6).toFixed(2))) }))}
              aria-label="缩小"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => {
                const [px, py] = lngLatToPixel(118.5, 33.5);
                setCam({ cx: px, cy: py, zoom: 3.1 });
              }}
            >
              东亚
            </button>
            <button
              type="button"
              onClick={() => setCam({ cx: MAP_W / 2, cy: MAP_H / 2, zoom: 1.0 })}
            >
              全球
            </button>
          </div>

          {/* Season Badge + Gym Progress Strip */}
          <div className="wt-map-legend">
            <span>S1 东亚巡礼已开放</span>
            <em>道馆征服 {tour.clearedCityGyms.length}/{WORLD_CITIES.length}</em>
          </div>

          {/* Flight Banner */}
          {flightAnim && (
            <div className="wt-flight-banner">
              ✈ 正在飞往 {flightAnim.targetCity ? flightAnim.targetCity.name : 'GPS 家乡'}...
            </div>
          )}

          {/* Toast / GPS Feedback */}
          {(toastMsg || gpsStatus) && (
            <div className="wt-toast">{toastMsg ?? gpsStatus}</div>
          )}
        </div>

        {/* RIGHT / BOTTOM INSPECTOR DRAWER */}
        <aside className="wt-drawer scroll-y">
          {/* Quick City Strip for easy tapping on mobile */}
          <div className="wt-city-chips">
            <button
              type="button"
              className={`wt-chip ${isViewingHome ? 'active' : ''}`}
              onClick={() => {
                sound.play('cursor');
                setSelectedCityId(null);
                setSelectedZoneId(null);
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
                    const [px, py] = lngLatToPixel(c.lng, c.lat);
                    setCam((prev) => ({ ...prev, cx: px, cy: py }));
                  }}
                >
                  {isHere ? '📍' : cleared ? '👑' : ''}
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* CASE A: Locked Future Global Region Teaser */}
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

          {/* CASE B: GPS Home Spawn Hub */}
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
                  当前匹配生态：<strong>{eco.regionLabel}</strong>（经纬度 {lat.toFixed(2)}°, {lng.toFixed(2)}°）。在家乡周边可无限免费探索与免费回血！
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

          {/* CASE C: Currently Staying in Selected City -> CITY HUB */}
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

          {/* CASE D: Viewing Another Unlocked City -> AIRPORT BOARDING PASS + HOTEL BOOKING */}
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
