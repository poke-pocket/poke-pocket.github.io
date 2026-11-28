import { describe, expect, it } from 'vitest';
import {
  buildWeatherInfo,
  getTemperatureBand,
  getWeatherAtmosphereProfile,
  getWeatherCombatBonus,
  getWeatherDisplayLabel,
  getWeatherIntensityOptions,
  hasWeatherIntensity,
  inferWeatherIntensityFromWmo,
  resolveGeoSeason,
} from './weatherSystem';

describe('weatherSystem intensity & independent temperature', () => {
  it('has no intensity tiers for clear weather and 3 descriptive tiers for all other weathers', () => {
    expect(hasWeatherIntensity('clear')).toBe(false);
    expect(getWeatherIntensityOptions('clear')).toHaveLength(0);
    expect(getWeatherDisplayLabel('clear', 'heavy')).toBe('晴朗');

    expect(hasWeatherIntensity('rain')).toBe(true);
    expect(getWeatherDisplayLabel('rain', 'light')).toBe('小雨');
    expect(getWeatherDisplayLabel('rain', 'moderate')).toBe('中雨');
    expect(getWeatherDisplayLabel('rain', 'heavy')).toBe('暴雨');

    expect(hasWeatherIntensity('cloudy')).toBe(true);
    expect(getWeatherDisplayLabel('cloudy', 'light')).toBe('多云');
    expect(getWeatherDisplayLabel('cloudy', 'moderate')).toBe('阴天');
    expect(getWeatherDisplayLabel('cloudy', 'heavy')).toBe('乌云密布');
  });

  it('scales 3D atmosphere cloud cover, darkness, and freezing frost monotonically', () => {
    const partlyCloudy = getWeatherAtmosphereProfile('cloudy', 'light', 20);
    const overcast = getWeatherAtmosphereProfile('cloudy', 'moderate', 20);
    const darkClouds = getWeatherAtmosphereProfile('cloudy', 'heavy', 20);

    expect(partlyCloudy.cloudCover).toBeLessThan(overcast.cloudCover);
    expect(overcast.cloudCover).toBeLessThan(darkClouds.cloudCover);
    expect(partlyCloudy.cloudDarkness).toBeLessThan(overcast.cloudDarkness);
    expect(overcast.cloudDarkness).toBeLessThan(darkClouds.cloudDarkness);
    expect(darkClouds.sunDim).toBeLessThan(partlyCloudy.sunDim);

    const freezingClear = getWeatherAtmosphereProfile('clear', 'moderate', -12);
    const hotClear = getWeatherAtmosphereProfile('clear', 'moderate', 38);
    expect(freezingClear.snowCover).toBeGreaterThan(0);
    expect(hotClear.snowCover).toBe(0);
    expect(hotClear.sunDim).toBeGreaterThan(1);
    expect(hotClear.heatDry).toBeGreaterThan(0.4);

    const lightRain = getWeatherAtmosphereProfile('rain', 'light', 18);
    const heavyRain = getWeatherAtmosphereProfile('rain', 'heavy', 18);
    expect(heavyRain.wetness).toBeGreaterThan(lightRain.wetness);
    expect(heavyRain.groundLightScale).toBeLessThan(lightRain.groundLightScale);

    const strongWind = getWeatherAtmosphereProfile('windy', 'heavy', 18);
    expect(strongWind.windSwayMult).toBeGreaterThan(3.5);
    expect(strongWind.windStretch).toBeGreaterThan(0.7);

    const heavyHail = getWeatherAtmosphereProfile('hail', 'heavy', 1);
    expect(heavyHail.hailSpecks).toBe(1);
    expect(heavyHail.snowCover).toBeGreaterThan(0.3);
  });

  it('applies intensity scaling and independent extreme temperature combat bonuses', () => {
    const lightRainWater = getWeatherCombatBonus('rain', 'water', 'light', 20);
    const heavyRainWater = getWeatherCombatBonus('rain', 'water', 'heavy', 20);
    expect(heavyRainWater.atkMult).toBeGreaterThan(lightRainWater.atkMult);

    const mildClearFire = getWeatherCombatBonus('clear', 'fire', 'moderate', 20);
    const scorchingClearFire = getWeatherCombatBonus('clear', 'fire', 'moderate', 38);
    expect(scorchingClearFire.atkMult).toBeGreaterThan(mildClearFire.atkMult);

    const info = buildWeatherInfo('rain', -12, 20, 'fallback', '测试', 'heavy');
    expect(info.label).toBe('暴雨');
    expect(info.tempBandLabel).toBe('极寒');
    expect(getTemperatureBand(-12).buffHint).toContain('极寒');
  });

  it('infers weather intensity cleanly from Open-Meteo WMO code & cloud cover', () => {
    expect(inferWeatherIntensityFromWmo('rain', 61, 10)).toBe('light');
    expect(inferWeatherIntensityFromWmo('rain', 63, 14)).toBe('moderate');
    expect(inferWeatherIntensityFromWmo('rain', 65, 22)).toBe('heavy');
    expect(inferWeatherIntensityFromWmo('cloudy', 2, 10, 45)).toBe('light');
    expect(inferWeatherIntensityFromWmo('cloudy', 3, 10, 80)).toBe('moderate');
    expect(inferWeatherIntensityFromWmo('cloudy', 3, 10, 96)).toBe('heavy');
  });

  it('resolves latitude-accurate Northern/Southern hemisphere seasons and climate zones', () => {
    const julyMs = Date.UTC(2026, 6, 15, 12, 0, 0); // July 15
    const shanghaiJuly = resolveGeoSeason(31.23, julyMs, 'auto');
    const sydneyJuly = resolveGeoSeason(-33.87, julyMs, 'auto');
    const singaporeJuly = resolveGeoSeason(1.35, julyMs, 'auto');
    const reykjavikJuly = resolveGeoSeason(64.15, julyMs, 'auto');

    expect(shanghaiJuly.season).toBe('summer');
    expect(shanghaiJuly.hemisphere).toBe('north');
    expect(shanghaiJuly.climateZone).toBe('temperate');

    expect(sydneyJuly.season).toBe('winter');
    expect(sydneyJuly.hemisphere).toBe('south');
    expect(sydneyJuly.climateZone).toBe('temperate');

    expect(singaporeJuly.climateZone).toBe('tropical');
    expect(singaporeJuly.soundscapeSummary).toContain('热带');

    expect(reykjavikJuly.climateZone).toBe('polar');
    expect(reykjavikJuly.season).toBe('summer');

    const manualSummer = resolveGeoSeason(31.23, Date.UTC(2026, 0, 15), 'summer');
    expect(manualSummer.season).toBe('summer');
    expect(manualSummer.soundscapeSummary).toContain('蝉鸣');
  });
});
