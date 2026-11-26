import * as THREE from 'three';

export type DayNightPhase = 'day' | 'dawn' | 'dusk' | 'night';
export type WorldTimeOverride = 'auto' | 'day' | 'dusk' | 'night';

export interface SolarDayNightState {
  phase: DayNightPhase;
  phaseLabel: string;
  phaseEmoji: string;
  localTimeStr: string;
  sunriseStr: string;
  sunsetStr: string;
  solarElevationDeg: number;
  solarAzimuthRad: number;
  daylightFactor: number; // 0 = deep night, 0.5 = horizon civil twilight, 1 = full sun
  skyHex: number;
  horizonHex: number;
  fogHex: number;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  lampGlow: number; // 0 in daytime, 1 at night
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatMinutesHHMM(totalMin: number): string {
  const wrapped = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Estimate civil timezone offset (hours from UTC) from (lat, lng):
 * - Mainland China / HK / Taiwan (18°N..54°N, 73°E..135°E): unified UTC+8
 * - Japan / Korea (24°N..46°N, 125°E..146°E): UTC+9
 * - Elsewhere: standard 15°-longitude zone `Math.round(lng / 15)`
 */
export function estimateCivilTimezoneHours(lat: number, lng: number): number {
  if (lat >= 24 && lat <= 46 && lng >= 126 && lng <= 146) return 9;
  if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) return 8;
  return clamp(Math.round(lng / 15), -12, 14);
}

/**
 * Computes astronomical sunrise, sunset, local civil clock, solar elevation & 3D lighting palette
 * directly from real geographic `(lat, lng)` and current UTC timestamp (`nowMs`).
 */
export function computeSolarDayNight(
  lat: number,
  lng: number,
  nowMs = Date.now(),
  override: WorldTimeOverride = 'auto',
): SolarDayNightState {
  const d = new Date(nowMs);
  const startOfYearUtc = Date.UTC(d.getUTCFullYear(), 0, 1, 0, 0, 0);
  const dayOfYear = Math.floor((nowMs - startOfYearUtc) / 86400000) + 1;
  const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;

  // Fractional year (radians) — NOAA solar position equations
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcMinutes / 60 - 12) / 24);

  // Equation of time (minutes)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Solar declination (radians)
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latRad = (clamp(lat, -85, 85) * Math.PI) / 180;
  const tzHours = estimateCivilTimezoneHours(lat, lng);
  const localMinutes = ((utcMinutes + tzHours * 60) % 1440 + 1440) % 1440;

  // Sunrise / Sunset hour angle (zenith 90.833° accounting for atmospheric refraction & solar disc)
  const zenithRad = (90.833 * Math.PI) / 180;
  const cosHaSunrise =
    (Math.cos(zenithRad) - Math.sin(latRad) * Math.sin(decl)) /
    Math.max(1e-5, Math.cos(latRad) * Math.cos(decl));
  const clampedCosHa = clamp(cosHaSunrise, -1, 1);
  const haSunriseDeg = (Math.acos(clampedCosHa) * 180) / Math.PI;

  const solarNoonUtcMin = 720 - 4 * lng - eqTime;
  const sunriseLocalMin = solarNoonUtcMin - haSunriseDeg * 4 + tzHours * 60;
  const sunsetLocalMin = solarNoonUtcMin + haSunriseDeg * 4 + tzHours * 60;

  // True solar time & instantaneous solar elevation / azimuth
  let evalLocalMinutes = localMinutes;
  if (override === 'day') {
    evalLocalMinutes = (sunriseLocalMin + sunsetLocalMin) * 0.5;
  } else if (override === 'dusk') {
    evalLocalMinutes = sunsetLocalMin - 6;
  } else if (override === 'night') {
    evalLocalMinutes = (sunsetLocalMin + 300) % 1440;
  }
  const evalUtcMinutes = evalLocalMinutes - tzHours * 60;
  const trueSolarMin = ((evalUtcMinutes + eqTime + 4 * lng) % 1440 + 1440) % 1440;
  const hourAngleDeg = trueSolarMin / 4 - 180;
  const hourAngleRad = (hourAngleDeg * Math.PI) / 180;

  const sinElev =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngleRad);
  const elevRad = Math.asin(clamp(sinElev, -1, 1));
  const elevDeg = (elevRad * 180) / Math.PI;

  const cosZenith = sinElev;
  const sinZenith = Math.sqrt(Math.max(0, 1 - cosZenith * cosZenith));
  let azimuthRad = 0;
  if (sinZenith > 1e-4) {
    const cosAz = clamp(
      (Math.sin(decl) - Math.sin(latRad) * cosZenith) / (Math.cos(latRad) * sinZenith),
      -1,
      1,
    );
    azimuthRad = Math.acos(cosAz);
    if (hourAngleDeg > 0) azimuthRad = Math.PI * 2 - azimuthRad;
  }

  // Smooth daylight blend: -8° (astronomical twilight/night) -> +14° (full bright day)
  const daylightFactor = clamp((elevDeg + 8) / 22, 0, 1);
  const isMorning = trueSolarMin < 720;

  let phase: DayNightPhase = 'day';
  let phaseLabel = '白天';
  let phaseEmoji = '☀️';
  if (elevDeg < -4.5) {
    phase = 'night';
    phaseLabel = '夜晚';
    phaseEmoji = '🌙';
  } else if (elevDeg < 7.5) {
    if (isMorning) {
      phase = 'dawn';
      phaseLabel = '日出';
      phaseEmoji = '🌅';
    } else {
      phase = 'dusk';
      phaseLabel = '黄昏';
      phaseEmoji = '🌇';
    }
  }

  // Blend 3-stop HD-2D atmospheric colors: Night -> Golden Twilight -> Crisp Daytime
  const nightSky = new THREE.Color(0x131d36);
  const duskSky = new THREE.Color(0x524878);
  const daySky = new THREE.Color(0x74c0fc);

  const nightHorizon = new THREE.Color(0x1f2f54);
  const duskHorizon = new THREE.Color(0xf08c4b);
  const dayHorizon = new THREE.Color(0xc5ecff);

  const nightSun = new THREE.Color(0x8bb8ff); // Crisp silver-blue moonlight
  const duskSun = new THREE.Color(0xff9e5e);  // Warm golden-amber sunset/sunrise
  const daySun = new THREE.Color(0xfff6dd);   // Warm sunlit noon

  const nightHemiSky = new THREE.Color(0x4a669c);
  const duskHemiSky = new THREE.Color(0xd98a6c);
  const dayHemiSky = new THREE.Color(0xd8f0ff);

  const nightHemiGnd = new THREE.Color(0x233044);
  const duskHemiGnd = new THREE.Color(0x4c4238);
  const dayHemiGnd = new THREE.Color(0x3b7a42);

  const skyCol = new THREE.Color();
  const horCol = new THREE.Color();
  const sunCol = new THREE.Color();
  const hSkyCol = new THREE.Color();
  const hGndCol = new THREE.Color();

  if (daylightFactor < 0.45) {
    const k = daylightFactor / 0.45;
    skyCol.copy(nightSky).lerp(duskSky, k);
    horCol.copy(nightHorizon).lerp(duskHorizon, k);
    sunCol.copy(nightSun).lerp(duskSun, k);
    hSkyCol.copy(nightHemiSky).lerp(duskHemiSky, k);
    hGndCol.copy(nightHemiGnd).lerp(duskHemiGnd, k);
  } else {
    const k = (daylightFactor - 0.45) / 0.55;
    skyCol.copy(duskSky).lerp(daySky, k);
    horCol.copy(duskHorizon).lerp(dayHorizon, k);
    sunCol.copy(duskSun).lerp(daySun, k);
    hSkyCol.copy(duskHemiSky).lerp(dayHemiSky, k);
    hGndCol.copy(duskHemiGnd).lerp(dayHemiGnd, k);
  }

  // Keep night well-lit by moonlight (0.66 sun + 0.82 hemi) so pixel sprites & 3D buildings stay crystal-clear!
  const sunIntensity = 0.66 + daylightFactor * 0.62;
  const hemiIntensity = 0.82 + daylightFactor * 0.38;
  const lampGlow = clamp(1 - (daylightFactor - 0.18) / 0.45, 0, 1);

  return {
    phase,
    phaseLabel,
    phaseEmoji,
    localTimeStr: formatMinutesHHMM(evalLocalMinutes),
    sunriseStr: formatMinutesHHMM(sunriseLocalMin),
    sunsetStr: formatMinutesHHMM(sunsetLocalMin),
    solarElevationDeg: Number(elevDeg.toFixed(1)),
    solarAzimuthRad: azimuthRad,
    daylightFactor,
    skyHex: skyCol.getHex(),
    horizonHex: horCol.getHex(),
    fogHex: horCol.clone().lerp(skyCol, 0.35).getHex(),
    sunHex: sunCol.getHex(),
    sunIntensity,
    hemiSkyHex: hSkyCol.getHex(),
    hemiGroundHex: hGndCol.getHex(),
    hemiIntensity,
    lampGlow,
  };
}
