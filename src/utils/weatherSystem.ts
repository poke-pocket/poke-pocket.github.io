import type { PokemonElement } from '../types/pet';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'hail' | 'snow' | 'windy';
export type WeatherIntensity = 'light' | 'moderate' | 'heavy';

export interface WeatherIntensityOption {
  id: WeatherIntensity;
  label: string;
  hint: string;
}

export interface LiveWeatherInfo {
  kind: WeatherKind;
  intensity: WeatherIntensity;
  label: string;
  emoji: string;
  tempC: number;
  tempBandLabel: string;
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

export interface WeatherAtmosphereProfile {
  sunDim: number;
  hemiMult: number;
  cloudCover: number;
  cloudDarkness: number;
  cloudSpeed: number;
  overcastTintHex: number;
  overcastTintStrength: number;
  snowCover: number;
  tempTintHex: number;
  tempTintStrength: number;
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

export const WEATHER_INTENSITY_OPTIONS: Record<WeatherKind, WeatherIntensityOption[]> = {
  clear: [],
  cloudy: [
    { id: 'light', label: '多云', hint: '散云飘浮，间有阳光' },
    { id: 'moderate', label: '阴天', hint: '云层满布，天色偏暗' },
    { id: 'heavy', label: '乌云密布', hint: '厚重乌云，山雨欲来' },
  ],
  rain: [
    { id: 'light', label: '小雨', hint: '细雨淅沥，稀疏水滴' },
    { id: 'moderate', label: '中雨', hint: '持续降雨，水花四溅' },
    { id: 'heavy', label: '暴雨', hint: '倾盆大雨，密集雨幕' },
  ],
  storm: [
    { id: 'light', label: '弱雷雨', hint: '偶有远雷与阵雨' },
    { id: 'moderate', label: '雷阵雨', hint: '雷电交加，雨势急骤' },
    { id: 'heavy', label: '强雷暴', hint: '高频闪电，狂风暴雨' },
  ],
  hail: [
    { id: 'light', label: '小冰雹', hint: '零星冰粒稀疏敲落' },
    { id: 'moderate', label: '中冰雹', hint: '冰雹连落砸地弹跳' },
    { id: 'heavy', label: '强冰雹', hint: '密集冰雹咚咚倾泻' },
  ],
  snow: [
    { id: 'light', label: '小雪', hint: '细雪轻飘，薄霜微覆' },
    { id: 'moderate', label: '中雪', hint: '雪花纷飞，地面覆雪' },
    { id: 'heavy', label: '暴雪', hint: '风雪漫天，银装素裹' },
  ],
  windy: [
    { id: 'light', label: '清风', hint: '轻风拂过，流云缓行' },
    { id: 'moderate', label: '强风', hint: '阵风呼啸，气流起伏' },
    { id: 'heavy', label: '狂风', hint: '疾风劲吹，飞云奔涌' },
  ],
};

export function hasWeatherIntensity(kind: WeatherKind): boolean {
  return WEATHER_INTENSITY_OPTIONS[kind].length > 0;
}

export function getWeatherIntensityOptions(kind: WeatherKind): WeatherIntensityOption[] {
  return WEATHER_INTENSITY_OPTIONS[kind];
}

export function getWeatherDisplayLabel(
  kind: WeatherKind,
  intensity: WeatherIntensity = 'moderate',
): string {
  const opts = WEATHER_INTENSITY_OPTIONS[kind];
  if (opts.length === 0) return WEATHER_META[kind].label;
  return opts.find((o) => o.id === intensity)?.label ?? WEATHER_META[kind].label;
}

export function getTemperatureBand(tempC: number): {
  label: string;
  color: string;
  buffHint: string | null;
} {
  if (tempC <= -10) return { label: '极寒', color: '#22b8cf', buffHint: '极寒：水/冰系攻 +10%' };
  if (tempC <= 0) return { label: '严寒', color: '#339af0', buffHint: '严寒：水/冰系攻 +6%' };
  if (tempC <= 10) return { label: '微寒', color: '#74c0fc', buffHint: null };
  if (tempC <= 18) return { label: '凉爽', color: '#20c997', buffHint: null };
  if (tempC <= 26) return { label: '舒适', color: '#51cf66', buffHint: null };
  if (tempC <= 33) return { label: '炎热', color: '#fd7e14', buffHint: '炎热：火系攻 +6%' };
  return { label: '酷暑', color: '#fa5252', buffHint: '酷暑：火系攻 +10%' };
}

export function getWeatherMeta(kind: WeatherKind) {
  return WEATHER_META[kind];
}

export function getWeatherAtmosphereProfile(
  kind: WeatherKind,
  intensity: WeatherIntensity = 'moderate',
  tempC = 22,
): WeatherAtmosphereProfile {
  const lvl = kind === 'clear' ? 1 : intensity === 'light' ? 0 : intensity === 'heavy' ? 2 : 1;

  // Per-weather cloud cover, darkness, wind speed, sunlight dimming & ground snow/frost
  let sunDim = 1.0;
  let hemiMult = 1.0;
  let cloudCover = 0.22;
  let cloudDarkness = 0.0;
  let cloudSpeed = 1.0;
  let overcastTintHex = 0x8d99ae;
  let overcastTintStrength = 0.0;
  let snowCover = 0.0;

  switch (kind) {
    case 'clear':
      sunDim = 1.0;
      cloudCover = 0.22;
      cloudDarkness = 0.0;
      cloudSpeed = 0.85;
      break;
    case 'cloudy':
      sunDim = [0.92, 0.80, 0.60][lvl];
      hemiMult = [1.0, 0.94, 0.82][lvl];
      cloudCover = [0.58, 0.85, 0.98][lvl];
      cloudDarkness = [0.16, 0.44, 0.80][lvl];
      cloudSpeed = [1.0, 1.15, 1.35][lvl];
      overcastTintHex = [0x99a6b8, 0x7e8a9c, 0x454e63][lvl];
      overcastTintStrength = [0.14, 0.34, 0.58][lvl];
      break;
    case 'rain':
      sunDim = [0.85, 0.74, 0.58][lvl];
      hemiMult = [0.95, 0.88, 0.78][lvl];
      cloudCover = [0.76, 0.89, 0.97][lvl];
      cloudDarkness = [0.35, 0.58, 0.78][lvl];
      cloudSpeed = [1.15, 1.45, 1.95][lvl];
      overcastTintHex = [0x6f82a3, 0x57698c, 0x3b4969][lvl];
      overcastTintStrength = [0.24, 0.42, 0.58][lvl];
      break;
    case 'storm':
      sunDim = [0.68, 0.58, 0.46][lvl];
      hemiMult = [0.86, 0.78, 0.68][lvl];
      cloudCover = [0.88, 0.96, 1.0][lvl];
      cloudDarkness = [0.64, 0.82, 0.94][lvl];
      cloudSpeed = [1.6, 2.2, 2.9][lvl];
      overcastTintHex = [0x464d73, 0x333959, 0x222640][lvl];
      overcastTintStrength = [0.44, 0.60, 0.74][lvl];
      break;
    case 'hail':
      sunDim = [0.80, 0.70, 0.56][lvl];
      hemiMult = [0.94, 0.88, 0.78][lvl];
      cloudCover = [0.80, 0.91, 0.98][lvl];
      cloudDarkness = [0.46, 0.66, 0.84][lvl];
      cloudSpeed = [1.35, 1.8, 2.35][lvl];
      overcastTintHex = [0x6c87a3, 0x536f8c, 0x3d5570][lvl];
      overcastTintStrength = [0.30, 0.46, 0.62][lvl];
      snowCover = [0.16, 0.30, 0.48][lvl];
      break;
    case 'snow':
      sunDim = [0.94, 0.87, 0.76][lvl];
      hemiMult = [1.05, 1.12, 1.16][lvl];
      cloudCover = [0.72, 0.86, 0.96][lvl];
      cloudDarkness = [0.12, 0.24, 0.40][lvl];
      cloudSpeed = [0.9, 1.25, 2.1][lvl];
      overcastTintHex = [0xb9d8e6, 0xa8cadc, 0x92b4c9][lvl];
      overcastTintStrength = [0.18, 0.32, 0.48][lvl];
      snowCover = [0.42, 0.78, 1.0][lvl];
      break;
    case 'windy':
      sunDim = [0.98, 0.94, 0.88][lvl];
      hemiMult = 1.0;
      cloudCover = [0.40, 0.54, 0.70][lvl];
      cloudDarkness = [0.08, 0.18, 0.32][lvl];
      cloudSpeed = [1.75, 2.8, 4.2][lvl];
      overcastTintHex = [0x90b5ba, 0x7da4ad, 0x678d99][lvl];
      overcastTintStrength = [0.08, 0.16, 0.28][lvl];
      break;
  }

  // Independent temperature atmospheric tinting & sub-zero frost cover
  let tempTintHex = 0xffffff;
  let tempTintStrength = 0.0;
  if (tempC >= 29) {
    const hotFactor = Math.max(0, Math.min(1, (tempC - 28) / 15));
    tempTintHex = 0xffc078;
    tempTintStrength = hotFactor * 0.26;
    sunDim = Math.min(1.16, sunDim * (1 + hotFactor * 0.14));
  } else if (tempC <= 5) {
    const coldFactor = Math.max(0, Math.min(1, (6 - tempC) / 24));
    tempTintHex = 0x99d6ff;
    tempTintStrength = coldFactor * 0.26;
    if (tempC <= -2) {
      const frostCover = Math.min(0.55, ((-tempC - 1) / 20) * 0.55);
      snowCover = Math.max(snowCover, frostCover);
    }
  }

  return {
    sunDim,
    hemiMult,
    cloudCover,
    cloudDarkness,
    cloudSpeed,
    overcastTintHex,
    overcastTintStrength,
    snowCover,
    tempTintHex,
    tempTintStrength,
  };
}

function scaleBonusMod(mod: WeatherCombatMod, intensityScale: number): WeatherCombatMod {
  if (intensityScale === 1) return mod;
  return {
    atkMult: Number((1 + (mod.atkMult - 1) * intensityScale).toFixed(3)),
    cdMult: Number((1 + (mod.cdMult - 1) * intensityScale).toFixed(3)),
    critAdd: Number((mod.critAdd * intensityScale).toFixed(3)),
    speedMult: Number((1 + (mod.speedMult - 1) * intensityScale).toFixed(3)),
    badgeText: mod.badgeText,
  };
}

export function getWeatherCombatBonus(
  kind: WeatherKind,
  element: PokemonElement,
  intensity: WeatherIntensity = 'moderate',
  tempC?: number,
): WeatherCombatMod {
  let base: WeatherCombatMod = { atkMult: 1.0, cdMult: 1.0, critAdd: 0, speedMult: 1.0, badgeText: null };

  switch (kind) {
    case 'rain':
      if (element === 'water') {
        base = { atkMult: 1.22, cdMult: 0.88, critAdd: 0.05, speedMult: 1.06, badgeText: '🌧 雨天水系 UP' };
      } else if (element === 'electric') {
        base = { atkMult: 1.08, cdMult: 0.95, critAdd: 0.1, speedMult: 1.0, badgeText: '🌧 雨天会心 UP' };
      } else if (element === 'fire') {
        base = { atkMult: 0.9, cdMult: 1.05, critAdd: 0, speedMult: 1.0, badgeText: '🌧 雨天火系稍弱' };
      }
      break;

    case 'storm':
      if (element === 'electric') {
        base = { atkMult: 1.28, cdMult: 0.86, critAdd: 0.12, speedMult: 1.06, badgeText: '⛈ 雷暴电系大增' };
      } else if (element === 'water') {
        base = { atkMult: 1.18, cdMult: 0.92, critAdd: 0.04, speedMult: 1.04, badgeText: '⛈ 雷雨激流 UP' };
      } else if (element === 'dragon') {
        base = { atkMult: 1.12, cdMult: 0.95, critAdd: 0.05, speedMult: 1.0, badgeText: '⛈ 雷暴龙威 UP' };
      }
      break;

    case 'clear':
      if (element === 'fire') {
        base = { atkMult: 1.24, cdMult: 0.9, critAdd: 0.06, speedMult: 1.04, badgeText: '☀ 晴日烈焰 UP' };
      } else if (element === 'grass') {
        base = { atkMult: 1.18, cdMult: 0.92, critAdd: 0.04, speedMult: 1.08, badgeText: '☀ 叶绿素加速' };
      }
      break;

    case 'hail':
      if (element === 'water') {
        base = { atkMult: 1.24, cdMult: 0.9, critAdd: 0.1, speedMult: 1.02, badgeText: '🧊 冰雹激寒 UP' };
      } else if (element === 'dragon' || element === 'ghost') {
        base = { atkMult: 1.14, cdMult: 0.94, critAdd: 0.06, speedMult: 1.0, badgeText: '🧊 冰雹破甲 UP' };
      } else {
        base = { atkMult: 1.0, cdMult: 1.0, critAdd: 0.04, speedMult: 0.98, badgeText: null };
      }
      break;

    case 'snow':
      if (element === 'water') {
        base = { atkMult: 1.2, cdMult: 0.9, critAdd: 0.06, speedMult: 1.04, badgeText: '❄ 雪天冰水 UP' };
      } else if (element === 'fairy' || element === 'ghost') {
        base = { atkMult: 1.16, cdMult: 0.92, critAdd: 0.05, speedMult: 1.0, badgeText: '❄ 雪境灵力 UP' };
      } else if (element === 'normal') {
        base = { atkMult: 1.1, cdMult: 0.96, critAdd: 0, speedMult: 1.04, badgeText: '❄ 雪地适配 UP' };
      }
      break;

    case 'cloudy':
      if (element === 'ghost' || element === 'psychic' || element === 'fairy') {
        base = { atkMult: 1.2, cdMult: 0.9, critAdd: 0.08, speedMult: 1.03, badgeText: '☁ 阴天灵能 UP' };
      } else if (element === 'normal') {
        base = { atkMult: 1.08, cdMult: 0.96, critAdd: 0, speedMult: 1.02, badgeText: '☁ 沉稳发挥' };
      }
      break;

    case 'windy':
      if (element === 'dragon' || element === 'psychic') {
        base = { atkMult: 1.22, cdMult: 0.88, critAdd: 0.06, speedMult: 1.1, badgeText: '💨 强风龙念 UP' };
      } else {
        base = { atkMult: 1.04, cdMult: 0.98, critAdd: 0, speedMult: 1.08, badgeText: '💨 顺风移速 +8%' };
      }
      break;
  }

  const intensityScale =
    kind === 'clear' ? 1.0 : intensity === 'light' ? 0.72 : intensity === 'heavy' ? 1.24 : 1.0;
  const scaled = scaleBonusMod(base, intensityScale);

  // Extreme temperature bonus overlay (independent from weather kind!)
  if (typeof tempC === 'number') {
    if (tempC >= 34 && element === 'fire') {
      scaled.atkMult = Number((scaled.atkMult * 1.1).toFixed(3));
      if (!scaled.badgeText) scaled.badgeText = '🌡 酷暑火系 UP';
    } else if (tempC >= 27 && element === 'fire') {
      scaled.atkMult = Number((scaled.atkMult * 1.06).toFixed(3));
    } else if (tempC <= -10 && element === 'water') {
      scaled.atkMult = Number((scaled.atkMult * 1.1).toFixed(3));
      if (!scaled.badgeText) scaled.badgeText = '🌡 极寒水冰 UP';
    } else if (tempC <= 0 && element === 'water') {
      scaled.atkMult = Number((scaled.atkMult * 1.06).toFixed(3));
    }
  }

  return scaled;
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

export function inferWeatherIntensityFromWmo(
  kind: WeatherKind,
  code: number,
  windKmh: number,
  cloudCover?: number,
): WeatherIntensity {
  switch (kind) {
    case 'clear':
      return 'moderate';
    case 'rain':
      if (code === 51 || code === 53 || code === 56 || code === 61 || code === 66 || code === 80) {
        return 'light';
      }
      if (code === 65 || code === 67 || code === 82) return 'heavy';
      return 'moderate';
    case 'storm':
      if (code === 99 || windKmh >= 38) return 'heavy';
      if (windKmh < 16) return 'light';
      return 'moderate';
    case 'hail':
      if (code === 99) return 'heavy';
      if (code === 77) return 'light';
      return 'moderate';
    case 'snow':
      if (code === 71 || code === 85) return 'light';
      if (code === 75 || code === 86) return 'heavy';
      return 'moderate';
    case 'cloudy':
      if (code === 45 || code === 48 || (typeof cloudCover === 'number' && cloudCover >= 92)) {
        return 'heavy';
      }
      if (code === 2 || (typeof cloudCover === 'number' && cloudCover < 65)) return 'light';
      return 'moderate';
    case 'windy':
      if (windKmh >= 50) return 'heavy';
      if (windKmh < 35) return 'light';
      return 'moderate';
  }
}

export function buildWeatherInfo(
  kind: WeatherKind,
  tempC: number,
  windKmh: number,
  source: 'live' | 'fallback',
  locationLabel?: string,
  intensity: WeatherIntensity = 'moderate',
): LiveWeatherInfo {
  const m = WEATHER_META[kind];
  const resolvedIntensity: WeatherIntensity = kind === 'clear' ? 'moderate' : intensity;
  const displayLabel = getWeatherDisplayLabel(kind, resolvedIntensity);
  const roundedTemp = Math.round(tempC);
  const tempBand = getTemperatureBand(roundedTemp);
  const buffText = tempBand.buffHint ? `${m.buffText} · ${tempBand.buffHint}` : m.buffText;
  return {
    kind,
    intensity: resolvedIntensity,
    label: displayLabel,
    emoji: m.emoji,
    tempC: roundedTemp,
    tempBandLabel: tempBand.label,
    windKmh: Math.round(windKmh),
    summary: `${m.emoji} ${displayLabel} ${roundedTemp}°C`,
    buffText,
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
  const intensities: WeatherIntensity[] = ['light', 'moderate', 'heavy'];
  const intensity = kind === 'clear' ? 'moderate' : intensities[h % 3];
  const baseTemp = Math.max(-8, Math.min(31, Math.round(28 - Math.abs(lat - 20) * 0.65)));
  const temp = kind === 'snow' ? Math.min(0, baseTemp - 8) : baseTemp;
  return buildWeatherInfo(
    kind,
    temp,
    kind === 'windy' ? (intensity === 'heavy' ? 52 : intensity === 'light' ? 28 : 38) : 12,
    'fallback',
    locationLabel,
    intensity,
  );
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,cloud_cover&timezone=auto`;
    const resp = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = (await resp.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        cloud_cover?: number;
      };
    };
    const cur = json?.current;
    if (cur && typeof cur.weather_code === 'number') {
      const tempC = typeof cur.temperature_2m === 'number' ? cur.temperature_2m : 20;
      const windKmh = typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : 10;
      const kind = mapWmoCodeToWeather(cur.weather_code, windKmh);
      const intensity = inferWeatherIntensityFromWmo(kind, cur.weather_code, windKmh, cur.cloud_cover);
      const info = buildWeatherInfo(kind, tempC, windKmh, 'live', locationLabel, intensity);
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
