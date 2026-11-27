import type { PokemonElement } from '../types/pet';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'hail' | 'snow' | 'windy';

export interface LiveWeatherInfo {
  kind: WeatherKind;
  label: string;
  emoji: string;
  tempC: number;
  windKmh: number;
  summary: string;
  buffText: string;
  accentColor: string;
  skyTintHex: number;
  fogTintHex: number;
  source: 'live' | 'fallback';
  fetchedAt: number;
  locationLabel?: string;
}

export interface WeatherCombatMod {
  atkMult: number;
  cdMult: number;
  critAdd: number;
  speedMult: number;
  badgeText: string | null;
}

const WEATHER_META: Record<
  WeatherKind,
  {
    label: string;
    emoji: string;
    buffText: string;
    accentColor: string;
    skyTintHex: number;
    fogTintHex: number;
  }
> = {
  clear: {
    label: '晴朗',
    emoji: '☀️',
    buffText: '火系攻 +24% · 草系攻 +18%',
    accentColor: '#f59f00',
    skyTintHex: 0x87ceeb,
    fogTintHex: 0xb8e6ff,
  },
  cloudy: {
    label: '阴天',
    emoji: '☁️',
    buffText: '幽灵/超能/妖精攻 +20%',
    accentColor: '#868e96',
    skyTintHex: 0x8d99ae,
    fogTintHex: 0xaeb7c4,
  },
  rain: {
    label: '下雨',
    emoji: '🌧️',
    buffText: '水系攻 +22% 冷却 -12% · 电系暴击 +10%',
    accentColor: '#1c7ed6',
    skyTintHex: 0x5c7cfa,
    fogTintHex: 0x748ffc,
  },
  storm: {
    label: '雷雨',
    emoji: '⛈️',
    buffText: '电系攻 +28% 冷却 -14% · 水系攻 +18%',
    accentColor: '#5f3dc4',
    skyTintHex: 0x3b3e66,
    fogTintHex: 0x4c4f7a,
  },
  hail: {
    label: '冰雹',
    emoji: '🧊',
    buffText: '水/冰系攻 +24% 暴击 +10% · 防御韧性提升',
    accentColor: '#0c8599',
    skyTintHex: 0x6c8ead,
    fogTintHex: 0x9eb8cf,
  },
  snow: {
    label: '下雪',
    emoji: '❄️',
    buffText: '水/冰系攻 +20% · 妖精/幽灵 +16%',
    accentColor: '#15aabf',
    skyTintHex: 0xc5f6fa,
    fogTintHex: 0xd9f5fa,
  },
  windy: {
    label: '强风',
    emoji: '💨',
    buffText: '龙/超能攻 +22% · 全队移速 +8%',
    accentColor: '#12b886',
    skyTintHex: 0x96f2d7,
    fogTintHex: 0xbef5e4,
  },
};

export function getWeatherMeta(kind: WeatherKind) {
  return WEATHER_META[kind];
}

export function getWeatherCombatBonus(
  kind: WeatherKind,
  element: PokemonElement,
): WeatherCombatMod {
  switch (kind) {
    case 'rain':
      if (element === 'water') {
        return { atkMult: 1.22, cdMult: 0.88, critAdd: 0.05, speedMult: 1.06, badgeText: '🌧 雨天水系 UP' };
      }
      if (element === 'electric') {
        return { atkMult: 1.08, cdMult: 0.95, critAdd: 0.1, speedMult: 1.0, badgeText: '🌧 雨天会心 UP' };
      }
      if (element === 'fire') {
        return { atkMult: 0.9, cdMult: 1.05, critAdd: 0, speedMult: 1.0, badgeText: '🌧 雨天火系稍弱' };
      }
      return { atkMult: 1.0, cdMult: 1.0, critAdd: 0, speedMult: 1.0, badgeText: null };

    case 'storm':
      if (element === 'electric') {
        return { atkMult: 1.28, cdMult: 0.86, critAdd: 0.12, speedMult: 1.06, badgeText: '⛈ 雷暴电系大增' };
      }
      if (element === 'water') {
        return { atkMult: 1.18, cdMult: 0.92, critAdd: 0.04, speedMult: 1.04, badgeText: '⛈ 雷雨激流 UP' };
      }
      if (element === 'dragon') {
        return { atkMult: 1.12, cdMult: 0.95, critAdd: 0.05, speedMult: 1.0, badgeText: '⛈ 雷暴龙威 UP' };
      }
      return { atkMult: 1.0, cdMult: 1.0, critAdd: 0, speedMult: 1.0, badgeText: null };

    case 'clear':
      if (element === 'fire') {
        return { atkMult: 1.24, cdMult: 0.9, critAdd: 0.06, speedMult: 1.04, badgeText: '☀ 晴日烈焰 UP' };
      }
      if (element === 'grass') {
        return { atkMult: 1.18, cdMult: 0.92, critAdd: 0.04, speedMult: 1.08, badgeText: '☀ 叶绿素加速' };
      }
      return { atkMult: 1.0, cdMult: 1.0, critAdd: 0, speedMult: 1.0, badgeText: null };

    case 'hail':
      if (element === 'water') {
        return { atkMult: 1.24, cdMult: 0.9, critAdd: 0.1, speedMult: 1.02, badgeText: '🧊 冰雹激寒 UP' };
      }
      if (element === 'dragon' || element === 'ghost') {
        return { atkMult: 1.14, cdMult: 0.94, critAdd: 0.06, speedMult: 1.0, badgeText: '🧊 冰雹破甲 UP' };
      }
      return { atkMult: 1.0, cdMult: 1.0, critAdd: 0.04, speedMult: 0.98, badgeText: null };

    case 'snow':
      if (element === 'water') {
        return { atkMult: 1.2, cdMult: 0.9, critAdd: 0.06, speedMult: 1.04, badgeText: '❄ 雪天冰水 UP' };
      }
      if (element === 'fairy' || element === 'ghost') {
        return { atkMult: 1.16, cdMult: 0.92, critAdd: 0.05, speedMult: 1.0, badgeText: '❄ 雪境灵力 UP' };
      }
      if (element === 'normal') {
        return { atkMult: 1.1, cdMult: 0.96, critAdd: 0, speedMult: 1.04, badgeText: '❄ 雪地适配 UP' };
      }
      return { atkMult: 1.0, cdMult: 1.0, critAdd: 0, speedMult: 1.0, badgeText: null };

    case 'cloudy':
      if (element === 'ghost' || element === 'psychic' || element === 'fairy') {
        return { atkMult: 1.2, cdMult: 0.9, critAdd: 0.08, speedMult: 1.03, badgeText: '☁ 阴天灵能 UP' };
      }
      if (element === 'normal') {
        return { atkMult: 1.08, cdMult: 0.96, critAdd: 0, speedMult: 1.02, badgeText: '☁ 沉稳发挥' };
      }
      return { atkMult: 1.0, cdMult: 1.0, critAdd: 0, speedMult: 1.0, badgeText: null };

    case 'windy':
      if (element === 'dragon' || element === 'psychic') {
        return { atkMult: 1.22, cdMult: 0.88, critAdd: 0.06, speedMult: 1.1, badgeText: '💨 强风龙念 UP' };
      }
      return { atkMult: 1.04, cdMult: 0.98, critAdd: 0, speedMult: 1.08, badgeText: '💨 顺风移速 +8%' };
  }
}

export function mapWmoCodeToWeather(code: number, windKmh: number): WeatherKind {
  if (code === 96 || code === 99 || code === 77) return 'hail';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 76) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (windKmh >= 28) return 'windy';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
  return 'clear';
}

export function buildWeatherInfo(
  kind: WeatherKind,
  tempC: number,
  windKmh: number,
  source: 'live' | 'fallback',
  locationLabel?: string,
): LiveWeatherInfo {
  const m = WEATHER_META[kind];
  return {
    kind,
    label: m.label,
    emoji: m.emoji,
    tempC: Math.round(tempC),
    windKmh: Math.round(windKmh),
    summary: `${m.emoji} ${m.label} ${Math.round(tempC)}°C`,
    buffText: m.buffText,
    accentColor: m.accentColor,
    skyTintHex: m.skyTintHex,
    fogTintHex: m.fogTintHex,
    source,
    fetchedAt: Date.now(),
    locationLabel,
  };
}

/** Deterministic fallback weather by latitude & current 2-hour window when offline */
export function buildFallbackWeather(
  lat: number,
  lng: number,
  locationLabel?: string,
): LiveWeatherInfo {
  const slot = Math.floor(Date.now() / (1000 * 60 * 120));
  const h = Math.abs(Math.round(lat * 17 + lng * 13 + slot * 7)) % 100;
  let kind: WeatherKind = 'clear';
  if (lat >= 41 && h < 42) kind = 'snow';
  else if (h < 28) kind = 'rain';
  else if (h < 40) kind = 'cloudy';
  else if (h < 48) kind = 'storm';
  else if (h < 58) kind = 'windy';
  else kind = 'clear';
  const baseTemp = Math.max(-8, Math.min(31, Math.round(28 - Math.abs(lat - 20) * 0.65)));
  const temp = kind === 'snow' ? Math.min(0, baseTemp - 8) : baseTemp;
  return buildWeatherInfo(kind, temp, kind === 'windy' ? 32 : 12, 'fallback', locationLabel);
}

const WEATHER_CACHE = new Map<string, LiveWeatherInfo>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_RETRY_TTL_MS = 60 * 1000;

/**
 * Fetches real-time weather from Open-Meteo (free, keyless, HTTPS, CORS-enabled).
 * Falls back smoothly to local deterministic weather if offline or blocked.
 */
export async function fetchLiveWeatherAt(
  lat: number,
  lng: number,
  locationLabel?: string,
): Promise<LiveWeatherInfo> {
  const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
  const cached = WEATHER_CACHE.get(key);
  const ttl = cached?.source === 'fallback' ? FALLBACK_RETRY_TTL_MS : CACHE_TTL_MS;
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return locationLabel && cached.locationLabel !== locationLabel
      ? { ...cached, locationLabel }
      : cached;
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
    const resp = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = (await resp.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };
    const cur = json?.current;
    if (cur && typeof cur.weather_code === 'number') {
      const tempC = typeof cur.temperature_2m === 'number' ? cur.temperature_2m : 20;
      const windKmh = typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : 10;
      const kind = mapWmoCodeToWeather(cur.weather_code, windKmh);
      const info = buildWeatherInfo(kind, tempC, windKmh, 'live', locationLabel);
      WEATHER_CACHE.set(key, info);
      return info;
    }
  } catch {
    // Graceful offline fallback
  }
  const fallback = buildFallbackWeather(lat, lng, locationLabel);
  WEATHER_CACHE.set(key, fallback);
  return fallback;
}
