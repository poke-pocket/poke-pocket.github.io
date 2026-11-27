import * as THREE from 'three';
import {
  getActiveGeoTerrainOrigin,
  worldToGeo,
  worldYToRealMeters3D,
} from '../geoTerrain3D';
import { BIOME_PALETTES, type BiomeId, type BiomeTextureSet } from './biomePalettesAndWater';
import { nearestUrbanRegions, type UrbanRegion } from '../../world3d/urbanGround3D';

export const BIOME_ORDER_LIST: BiomeId[] = [
  'verdant_forest',
  'rocky_desert',
  'storm_coast',
  'sky_glacier',
  'cinnabar_isle',
];

let realEarthBiomeModeActive = true;
let liveSnowWeatherWeight = 0.0;

/** Keep the closest city footprints and their parks in the terrain shader. */
export function syncUrbanTerrainUniforms3D(material:THREE.ShaderMaterial,regions:readonly UrbanRegion[],x:number,z:number):void{
 const cities=nearestUrbanRegions([...regions],x,z),zones=material.uniforms.uUrbanZones.value as THREE.Vector4[],parks=material.uniforms.uUrbanParks.value as THREE.Vector4[];
 for(const v of zones)v.set(0,0,0,0);for(const v of parks)v.set(0,0,0,0);
 let parkIndex=0;
 for(let i=0;i<cities.length&&i<zones.length;i++){
  const c=cities[i];zones[i].set(c.x,c.z,c.innerRadius,c.outerRadius);
  for(const p of c.parks){if(parkIndex>=parks.length)break;parks[parkIndex++].set(p.x,p.z,p.halfW,p.halfD)}
 }
}

/** Keeps CPU flora/spawn biome queries and GPU terrain shader uniforms synced with Real-Earth vs Rogue mode & live snow weather */
export function syncTerrainGeoUniforms3D(
  terrainMat: THREE.ShaderMaterial | null | undefined,
  isRealEarthMode: boolean,
  snowWeatherFactor = 0,
): void {
  realEarthBiomeModeActive = isRealEarthMode;
  liveSnowWeatherWeight = Math.max(0, Math.min(1, snowWeatherFactor));
  if (!terrainMat?.uniforms) return;
  const origin = getActiveGeoTerrainOrigin();
  if (origin && terrainMat.uniforms.uGeoOrigin?.value instanceof THREE.Vector4) {
    const kmPerDegLng = Math.max(12, 111.32 * Math.cos((origin.originLat * Math.PI) / 180));
    const degLatPerUnit = 1 / (origin.unitsPerKm * 111.32);
    const degLngPerUnit = 1 / (origin.unitsPerKm * kmPerDegLng);
    terrainMat.uniforms.uGeoOrigin.value.set(
      origin.originLat,
      origin.originLng,
      degLatPerUnit,
      degLngPerUnit,
    );
  }
  if (terrainMat.uniforms.uRealEarthParams?.value instanceof THREE.Vector2) {
    terrainMat.uniforms.uRealEarthParams.value.set(
      isRealEarthMode && Boolean(origin) ? 1.0 : 0.0,
      liveSnowWeatherWeight,
    );
  }
}

function buildInitialGeoOriginVec4(): THREE.Vector4 {
  const origin = getActiveGeoTerrainOrigin();
  if (!origin) return new THREE.Vector4(31.23, 121.47, 1 / (100 * 111.32), 1 / (100 * 95.18));
  const kmPerDegLng = Math.max(12, 111.32 * Math.cos((origin.originLat * Math.PI) / 180));
  return new THREE.Vector4(
    origin.originLat,
    origin.originLng,
    1 / (origin.unitsPerKm * 111.32),
    1 / (origin.unitsPerKm * kmPerDegLng),
  );
}

function biomeClimateTargets(biome: BiomeId): [number, number] {
  switch (biome) {
    case 'sky_glacier':
      return [0.12, 0.55];
    case 'rocky_desert':
      return [0.85, 0.16];
    case 'cinnabar_isle':
      return [0.92, 0.72];
    case 'storm_coast':
      return [0.48, 0.88];
    default:
      return [0.46, 0.48];
  }
}

function computeRealEarthSnowlineMeters(lat: number, nLng: number, bWarp: number): number {
  const absLat = Math.abs(lat);
  const inTibetanOrHengduan =
    lat >= 26.2 + bWarp * 0.3 &&
    lat <= 38.5 + bWarp * 0.35 &&
    nLng >= 77.0 + bWarp * 0.4 &&
    nLng <= 104.5 + bWarp * 0.5;
  if (inTibetanOrHengduan) return 4050;
  const inTianshanQilian =
    lat >= 36.0 && lat <= 50.0 && nLng >= 72.0 && nLng <= 103.0;
  if (inTianshanQilian) return 3450;
  const isJapanMaritime = lat > 32 && lat < 45 && nLng > 128 && nLng < 147;
  if (isJapanMaritime) return 2900;
  return Math.max(1450, 3750 - Math.max(0, absLat - 33) * 110);
}

export function getSeamlessBiomeAt3D(
  wx: number,
  wz: number,
  wy: number,
  baseBiome: BiomeId,
): BiomeId {
  // 1. REAL-EARTH GEOGRAPHIC BIOME CLASSIFICATION (Matches 2D Topographic Map 1:1 — zero random snow/lava on plains!)
  const origin = realEarthBiomeModeActive ? getActiveGeoTerrainOrigin() : null;
  if (origin) {
    const geo = worldToGeo(wx, wz, origin);
    if (geo) {
      const lat = geo.lat;
      const nLng = ((((geo.lng + 180) % 360) + 360) % 360) - 180;
      const absLat = Math.abs(lat);
      const realElevM = Math.max(0, worldYToRealMeters3D(wy));
      const bWarp =
        Math.sin(lat * 0.65 + nLng * 0.45) * 0.9 +
        Math.cos(nLng * 0.72 - lat * 0.5) * 0.6;

      // Active volcanic craters ONLY (Sakurajima, Mt. Aso, Kilauea, Etna — ~2.4km crater rim)
      const dVolc = Math.min(
        Math.hypot(lat - 31.585, (nLng - 130.657) * 0.85),
        Math.hypot(lat - 32.884, (nLng - 131.084) * 0.84),
        Math.hypot(lat - 19.406, (nLng + 155.283) * 0.94),
        Math.hypot(lat - 37.751, (nLng - 14.993) * 0.79),
      );
      if (dVolc < 0.022 && realElevM > 180) {
        return 'cinnabar_isle';
      }

      // True high-altitude snowlines, polar latitudes, or active snowfall weather
      const snowLineM = computeRealEarthSnowlineMeters(lat, nLng, bWarp);
      if (realElevM >= snowLineM || absLat >= 58 || liveSnowWeatherWeight >= 0.6) {
        return 'sky_glacier';
      }

      // Real-world arid desert & Gobi basins (Taklamakan, Junggar, Gobi, Qaidam, Sahara/Arabia, Central Asia, Outback, US SW)
      const inTaklamakan = lat >= 36.2 && lat <= 41.9 && nLng >= 75.5 && nLng <= 92.2 + bWarp * 0.5 && realElevM < 2200;
      const inJunggar = lat >= 43.8 && lat <= 46.8 && nLng >= 84.0 && nLng <= 91.5 + bWarp * 0.5 && realElevM < 1300;
      const inGobi = lat >= 37.6 + bWarp * 0.4 && lat <= 45.2 && nLng >= 92.2 + bWarp * 0.5 && nLng <= 109.5 + bWarp * 0.6 && realElevM < 2200;
      const inQaidam = lat >= 35.8 && lat <= 39.2 && nLng >= 90.2 && nLng <= 98.8 + bWarp * 0.4 && realElevM < 3350;
      const inSaharaArabia = lat >= 14.0 && lat <= 33.5 && nLng >= -17.0 && nLng <= 60.0 && realElevM < 2200;
      const inCentralAsia = lat >= 36.5 && lat <= 47.0 && nLng >= 52.0 && nLng <= 75.5 && realElevM < 1200;
      const inAusOutback = lat >= -31.5 && lat <= -19.0 && nLng >= 115.0 && nLng <= 142.0 && realElevM < 1200;
      const inUsSouthwest = lat >= 27.0 && lat <= 37.5 && nLng >= -117.5 && nLng <= -103.5 && realElevM < 1900;
      if (
        inTaklamakan ||
        inJunggar ||
        inGobi ||
        inQaidam ||
        inSaharaArabia ||
        inCentralAsia ||
        inAusOutback ||
        inUsSouthwest
      ) {
        return 'rocky_desert';
      }

      // Low-lying sandy beach margin right beside sea/water level
      if (wy > -0.38 && wy < 0.68) {
        return 'storm_coast';
      }

      return 'verdant_forest';
    }
  }

  // 2. FANTASY SECRET REALM FALLBACK (`vampire_rogue` mode only!)
  const dist = Math.hypot(wx, wz);
  const spawnBlend = Math.max(0, Math.min(1, (dist - 140) / 150));
  const [baseT, baseM] = biomeClimateTargets(baseBiome);

  const rawT =
    0.5 +
    0.34 * Math.sin(wx * 0.0040 + wz * 0.0026 + 0.6) +
    0.22 * Math.cos(wx * 0.0021 - wz * 0.0044 + 1.4);
  const rawM =
    0.5 +
    0.34 * Math.cos(wx * 0.0036 - wz * 0.0030 + 2.1) +
    0.22 * Math.sin(wx * 0.0024 + wz * 0.0042 - 0.8);

  const temp = baseT * (1 - spawnBlend) + Math.max(0, Math.min(1, rawT)) * spawnBlend;
  const moist = baseM * (1 - spawnBlend) + Math.max(0, Math.min(1, rawM)) * spawnBlend;

  if (wy > 305.0 && temp < 0.68) return 'sky_glacier';
  if (temp < 0.25) return 'sky_glacier';
  if (temp > 0.77 && moist >= 0.48) return 'cinnabar_isle';
  if (temp > 0.71 && moist < 0.48) return 'rocky_desert';
  if (moist > 0.73 && wy < 2.2) return 'storm_coast';
  return 'verdant_forest';
}

export function createSculptedTerrainMaterial(
  biome: BiomeId,
  texSet: BiomeTextureSet,
  sectorSize: number,
): THREE.ShaderMaterial {
  const pal = BIOME_PALETTES[biome];
  const [baseT, baseM] = biomeClimateTargets(biome);
  const hasGeo = Boolean(getActiveGeoTerrainOrigin()) && realEarthBiomeModeActive;
  const initFogSrgb = new THREE.Color();
  new THREE.Color(pal.fogHex).getRGB(initFogSrgb, THREE.SRGBColorSpace);
  return new THREE.ShaderMaterial({
    uniforms: {
      uGroundTex: { value: texSet.ground },
      uCliffTex: { value: texSet.cliff },
      uRoadTex: { value: texSet.road },
      uFogColor: { value: new THREE.Color().setRGB(initFogSrgb.r, initFogSrgb.g, initFogSrgb.b) },
      uGrassLipColor: { value: new THREE.Color(pal.groundColors[2]) },
      uBaseClimate: { value: new THREE.Vector2(baseT, baseM) },
      uGeoOrigin: { value: buildInitialGeoOriginVec4() },
      uRealEarthParams: { value: new THREE.Vector2(hasGeo ? 1.0 : 0.0, liveSnowWeatherWeight) },
      uFogNear: { value: 56.0 },
      uFogFar: { value: 3800.0 },
      uSectorSize: { value: sectorSize },
      uSunDir: { value: new THREE.Vector3(0.54, 0.78, 0.44).normalize() },
      uUrbanZones: { value: Array.from({length:8},()=>new THREE.Vector4()) },
      uUrbanParks: { value: Array.from({length:16},()=>new THREE.Vector4()) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vFogDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mv = viewMatrix * wp;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uGroundTex;
      uniform sampler2D uCliffTex;
      uniform sampler2D uRoadTex;
      uniform vec3 uFogColor;
      uniform vec3 uGrassLipColor;
      uniform vec2 uBaseClimate;
      uniform vec4 uGeoOrigin;
      uniform vec2 uRealEarthParams;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uSectorSize;
      uniform vec3 uSunDir;
      uniform vec4 uUrbanZones[8];
      uniform vec4 uUrbanParks[16];

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vFogDepth;

      vec2 groundHash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453123);
      }

      float geoBoxMask(float lat, float lng, float lat0, float lat1, float lng0, float lng1, float feather) {
        float wLat = smoothstep(lat0 - feather, lat0 + feather, lat) * (1.0 - smoothstep(lat1 - feather, lat1 + feather, lat));
        float wLng = smoothstep(lng0 - feather, lng0 + feather, lng) * (1.0 - smoothstep(lng1 - feather, lng1 + feather, lng));
        return wLat * wLng;
      }

      void main() {
        vec3 n = normalize(vWorldNormal);

        // Non-repeating stochastic per-tile pixel UV rotation (0/90/180/270 deg) + organic flower clumping mask
        // so grass blades & wildflowers NEVER show periodic grid repetition!
        vec2 scaledPos = vWorldPos.xz * 0.21;
        vec2 cellId = floor(scaledPos);
        vec2 localUv = fract(scaledPos) - 0.5;
        vec2 rnd = groundHash22(cellId);
        float rotIdx = floor(rnd.x * 4.0);
        if (rotIdx < 0.5) localUv = vec2(localUv.x, localUv.y);
        else if (rotIdx < 1.5) localUv = vec2(-localUv.y, localUv.x);
        else if (rotIdx < 2.5) localUv = vec2(-localUv.x, -localUv.y);
        else localUv = vec2(localUv.y, -localUv.x);
        // Snap offset to 1/64th texel grid so pixels remain 100% razor-sharp!
        vec2 pxShift = floor(rnd * 16.0) / 16.0;
        vec2 groundUv = fract(localUv + 0.5 + pxShift);
        vec3 baseTexCol = texture2D(uGroundTex, groundUv).rgb;
        // Organic meadow flower-cluster mask: suppress white flower dots outside natural blooming patches!
        float flowerMask = smoothstep(
          0.42,
          0.68,
          0.5 + 0.32 * sin(vWorldPos.x * 0.065 + vWorldPos.z * 0.048) + 0.25 * cos(vWorldPos.x * 0.041 - vWorldPos.z * 0.073)
        );
        float rawLum = dot(baseTexCol, vec3(0.3, 0.59, 0.11));
        if (rawLum > 0.68 && rnd.y > flowerMask * 0.65) {
          rawLum = 0.54;
        }
        // Smoothly fade high-frequency pixel-tile contrast beyond 54u -> 150u so mid/far ground never looks like a tiled floor texture!
        float detailFade = 1.0 - smoothstep(54.0, 150.0, vFogDepth);
        float texLuma = mix(1.0, clamp(rawLum / 0.56, 0.76, 1.22), detailFade);
        float meadowPatch = mix(0.5, sin(vWorldPos.x * 0.055 + 1.3) * cos(vWorldPos.z * 0.062 - 0.7) * 0.5 + 0.5, detailFade);

        float distSpawn = length(vWorldPos.xz);
        float realElevM = vWorldPos.y <= 30.1
          ? max(0.0, vWorldPos.y / 0.215)
          : 140.0 + (vWorldPos.y - 30.1) / 0.13;

        float wSnow = 0.0;
        float wVolcano = 0.0;
        float wDesert = 0.0;
        float wCoast = 0.0;
        float wForest = 1.0;
        float wSteppe = 0.0;
        float graniteMountainMask = 0.0;

        if (uRealEarthParams.x > 0.5) {
          // === TRUE REAL-EARTH GEOGRAPHIC CLIMATE, ALTITUDE & LATITUDE ENGINE ===
          float lat = uGeoOrigin.x - vWorldPos.z * uGeoOrigin.z;
          float rawLng = uGeoOrigin.y + vWorldPos.x * uGeoOrigin.w;
          float nLng = mod(mod(rawLng + 180.0, 360.0) + 360.0, 360.0) - 180.0;
          float absLat = abs(lat);
          float bWarp = sin(lat * 0.65 + nLng * 0.45) * 0.9 + cos(nLng * 0.72 - lat * 0.5) * 0.6;

          // 1. Real Snowlines (Tibet/Hengduan ~4050m, Tianshan ~3450m, Mt. Fuji/Japan ~2850m, Polar > 56 deg) + Live Snowfall Weather!
          float inTibetHengduan = geoBoxMask(lat, nLng, 26.2 + bWarp * 0.3, 38.5 + bWarp * 0.35, 77.0 + bWarp * 0.4, 104.5 + bWarp * 0.5, 0.8);
          float inTianshan = geoBoxMask(lat, nLng, 36.0, 50.0, 72.0, 103.0, 0.8);
          float inJapan = geoBoxMask(lat, nLng, 32.0, 45.0, 128.0, 147.0, 0.6);
          float baseSnowLineM = max(1450.0, 3750.0 - max(0.0, absLat - 33.0) * 110.0);
          float snowLineM = mix(baseSnowLineM, 2850.0, inJapan);
          snowLineM = mix(snowLineM, 3450.0, inTianshan);
          snowLineM = mix(snowLineM, 4050.0, inTibetHengduan);

          float altSnow = smoothstep(snowLineM - 160.0, snowLineM + 320.0, realElevM);
          float polarSnow = smoothstep(56.0, 64.0, absLat);
          float weatherSnow = uRealEarthParams.y * smoothstep(0.05, 0.85, vWorldPos.y);
          wSnow = clamp(max(max(altSnow, polarSnow), weatherSnow), 0.0, 1.0);

          // 2. Real Active Volcanic Craters ONLY (Sakurajima, Mt. Aso, Kilauea, Etna — zero lava in cities/plains!)
          float dVolc = min(
            min(length(vec2(lat - 31.585, (nLng - 130.657) * 0.85)), length(vec2(lat - 32.884, (nLng - 131.084) * 0.84))),
            min(length(vec2(lat - 19.406, (nLng + 155.283) * 0.94)), length(vec2(lat - 37.751, (nLng - 14.993) * 0.79)))
          );
          wVolcano = (1.0 - smoothstep(0.012, 0.024, dVolc)) * smoothstep(180.0, 420.0, realElevM) * (1.0 - wSnow);

          // 3. Real World Deserts & Gobi Basins (Taklamakan, Junggar, Gobi, Qaidam, Sahara/Arabia, Central Asia, Outback, US SW)
          float dTaklamakan = geoBoxMask(lat, nLng, 36.2, 41.9, 75.5, 92.2 + bWarp * 0.5, 1.1) * (1.0 - smoothstep(1950.0, 2350.0, realElevM));
          float dJunggar = geoBoxMask(lat, nLng, 43.8, 46.8, 84.0, 91.5 + bWarp * 0.5, 1.0) * (1.0 - smoothstep(1150.0, 1450.0, realElevM));
          float dGobi = geoBoxMask(lat, nLng, 37.6 + bWarp * 0.4, 45.2, 92.2 + bWarp * 0.5, 109.5 + bWarp * 0.6, 1.3) * (1.0 - smoothstep(1950.0, 2350.0, realElevM));
          float dQaidam = geoBoxMask(lat, nLng, 35.8, 39.2, 90.2, 98.8 + bWarp * 0.4, 0.9) * (1.0 - smoothstep(3150.0, 3500.0, realElevM));
          float dSahara = geoBoxMask(lat, nLng, 14.0, 33.5, -17.0, 60.0, 1.5) * (1.0 - smoothstep(2000.0, 2400.0, realElevM));
          float dCentralAsia = geoBoxMask(lat, nLng, 36.5, 47.0, 52.0, 75.5, 1.3) * (1.0 - smoothstep(1050.0, 1350.0, realElevM));
          float dOutback = geoBoxMask(lat, nLng, -31.5, -19.0, 115.0, 142.0, 1.4) * (1.0 - smoothstep(1050.0, 1350.0, realElevM));
          float dUsSw = geoBoxMask(lat, nLng, 27.0, 37.5, -117.5, -103.5, 1.2) * (1.0 - smoothstep(1700.0, 2050.0, realElevM));
          wDesert = clamp(max(max(max(dTaklamakan, dJunggar), max(dGobi, dQaidam)), max(max(dSahara, dCentralAsia), max(dOutback, dUsSw))), 0.0, 1.0) * (1.0 - wSnow) * (1.0 - wVolcano);

          // Semi-arid Loess Plateau & Inner Mongolia Steppe transition belt
          wSteppe = geoBoxMask(lat, nLng, 34.5 + bWarp * 0.3, 45.5, 103.0, 115.0 + bWarp * 0.4, 1.8) * (1.0 - wDesert) * (1.0 - wSnow);

          // 4. Natural Shoreline Sand Margin right along sea/lake/river water edge (< ~4m real elevation)
          wCoast = (1.0 - smoothstep(0.22, 0.92, vWorldPos.y)) * (1.0 - wSnow) * (1.0 - wVolcano) * (1.0 - wDesert) * 0.78;

          wForest = max(0.02, 1.0 - clamp(wSnow + wVolcano + wDesert + wCoast, 0.0, 1.0));
          float wSum = wForest + wDesert + wSnow + wVolcano + wCoast;
          wForest /= wSum; wDesert /= wSum; wSnow /= wSum; wVolcano /= wSum; wCoast /= wSum;
          graniteMountainMask = smoothstep(550.0, 1750.0, realElevM) * (1.0 - wSnow) * (1.0 - wDesert);
        } else {
          // Fantasy Secret Realm Mode (vampire_rogue only)
          float spawnBlend = smoothstep(140.0, 290.0, distSpawn);
          float rawT = clamp(
            0.5 +
            0.34 * sin(vWorldPos.x * 0.0040 + vWorldPos.z * 0.0026 + 0.6) +
            0.22 * cos(vWorldPos.x * 0.0021 - vWorldPos.z * 0.0044 + 1.4),
            0.0, 1.0
          );
          float rawM = clamp(
            0.5 +
            0.34 * cos(vWorldPos.x * 0.0036 - vWorldPos.z * 0.0030 + 2.1) +
            0.22 * sin(vWorldPos.x * 0.0024 + vWorldPos.z * 0.0042 - 0.8),
            0.0, 1.0
          );
          float temp = mix(uBaseClimate.x, rawT, spawnBlend);
          float moist = mix(uBaseClimate.y, rawM, spawnBlend);

          wSnow = clamp(
            (1.0 - smoothstep(0.18, 0.34, temp)) +
            smoothstep(305.0, 415.0, vWorldPos.y) * (1.0 - smoothstep(0.62, 0.76, temp)),
            0.0, 1.0
          );
          wVolcano = smoothstep(0.72, 0.86, temp) * smoothstep(0.44, 0.58, moist);
          wDesert = smoothstep(0.66, 0.80, temp) * (1.0 - smoothstep(0.42, 0.56, moist));
          wCoast = smoothstep(0.66, 0.82, moist) * (1.0 - smoothstep(1.0, 2.8, vWorldPos.y)) * (1.0 - wSnow) * (1.0 - wVolcano);
          wForest = max(0.08, 1.0 - clamp(wSnow + wVolcano + wDesert + wCoast, 0.0, 1.0));
          float wSum = wForest + wDesert + wSnow + wVolcano + wCoast;
          wForest /= wSum; wDesert /= wSum; wSnow /= wSum; wVolcano /= wSum; wCoast /= wSum;
        }

        // Natural elevation-layered forest & meadow palette (Lush lowland emerald -> Deep montane pine -> Alpine granite/meadow!)
        vec3 lowlandMeadow = vec3(0.40, 0.77, 0.34) * texLuma * mix(0.92, 1.12, meadowPatch);
        vec3 montanePine   = vec3(0.28, 0.62, 0.29) * texLuma * mix(0.93, 1.08, meadowPatch);
        vec3 alpineTundra  = vec3(0.56, 0.63, 0.44) * texLuma;
        vec3 steppeGrass   = vec3(0.68, 0.73, 0.40) * texLuma * mix(0.94, 1.08, meadowPatch);
        float montaneBlend = smoothstep(160.0, 950.0, realElevM);
        float alpineBlend  = smoothstep(1650.0, 2650.0, realElevM);
        vec3 naturalGreen  = mix(lowlandMeadow, montanePine, montaneBlend);
        naturalGreen       = mix(naturalGreen, alpineTundra, alpineBlend);
        vec3 forestGround  = mix(naturalGreen, steppeGrass, wSteppe * 0.75);

        vec3 desertGround = vec3(0.90, 0.77, 0.46) * texLuma * mix(0.94, 1.08, meadowPatch);
        vec3 snowGround   = vec3(0.93, 0.97, 1.00) * mix(0.92, 1.06, texLuma);
        vec3 coastGround  = vec3(0.89, 0.83, 0.57) * texLuma;
        // Glowing molten magma veins ONLY inside real active volcanic craters (or rogue mode)!
        float lavaNoise = sin(vWorldPos.x * 0.45 + sin(vWorldPos.z * 0.38) * 1.4) * cos(vWorldPos.z * 0.42);
        float lavaCrack = smoothstep(0.76, 0.94, abs(lavaNoise));
        vec3 volcanoGround = mix(vec3(0.20, 0.17, 0.21) * texLuma, vec3(1.0, 0.36, 0.08), lavaCrack * 0.92);

        vec3 grassCol =
          forestGround * wForest +
          desertGround * wDesert +
          snowGround * wSnow +
          volcanoGround * wVolcano +
          coastGround * wCoast;

        if (uRealEarthParams.x < 0.5) {
          grassCol = mix(baseTexCol * mix(0.92, 1.12, meadowPatch), grassCol, smoothstep(90.0, 180.0, distSpawn));
        }

        vec3 roadCol = texture2D(uRoadTex, vWorldPos.xz * 0.26).rgb;

        // Crisp triplanar stratified cliff walls tinted per local biome!
        vec2 cliffUvX = vec2(vWorldPos.z * 0.28, vWorldPos.y * 0.58);
        vec2 cliffUvZ = vec2(vWorldPos.x * 0.28, vWorldPos.y * 0.58);
        float blendX = abs(n.x) / (abs(n.x) + abs(n.z) + 0.0001);
        vec3 rawCliff = mix(
          texture2D(uCliffTex, cliffUvZ).rgb,
          texture2D(uCliffTex, cliffUvX).rgb,
          blendX
        );
        float cliffLuma = clamp(dot(rawCliff, vec3(0.3, 0.59, 0.11)) / 0.46, 0.65, 1.25);
        vec3 forestCliffCol = mix(vec3(0.68, 0.50, 0.34), vec3(0.58, 0.60, 0.63), graniteMountainMask * 0.85) * cliffLuma;
        vec3 biomeCliff =
          forestCliffCol * wForest +
          vec3(0.78, 0.48, 0.28) * cliffLuma * wDesert +
          vec3(0.62, 0.74, 0.88) * cliffLuma * wSnow +
          mix(vec3(0.22, 0.18, 0.23) * cliffLuma, vec3(1.0, 0.34, 0.06), lavaCrack * 0.75) * wVolcano +
          vec3(0.74, 0.66, 0.48) * cliffLuma * wCoast;
        vec3 cliffCol = uRealEarthParams.x > 0.5 ? biomeCliff : mix(rawCliff, biomeCliff, smoothstep(18.0, 44.0, distSpawn));

        // Emphasize horizontal terrace strata bands (2.1m per stacked cliff tier)
        float strataBand = fract((vWorldPos.y - 1.8) / 2.1);
        float strataShadow = mix(0.84, 1.10, smoothstep(0.08, 0.78, strataBand));
        cliffCol *= strataShadow;

        // Subtle organic sandy footpath following low meadows
        float trailX = sin(vWorldPos.z * 0.042) * 8.5;
        float trailZ = cos(vWorldPos.x * 0.042) * 8.5;
        float dTrail = min(abs(vWorldPos.x - trailX), abs(vWorldPos.z - trailZ));
        float roadMask = (1.0 - smoothstep(1.5, 2.7, dTrail)) * smoothstep(2.0, 0.2, abs(vWorldPos.y));
        vec3 flatCol = mix(grassCol, roadCol, roadMask * 0.82);

        // Built-up areas use fine pixel concrete and gradually return to the
        // natural biome beyond the city; designated parks remain vegetation.
        float urban=0.0;
        for(int i=0;i<8;i++){
          vec4 zone=uUrbanZones[i];
          if(zone.w>zone.z+1.0) urban=max(urban,1.0-smoothstep(zone.z,zone.w,length(vWorldPos.xz-zone.xy)));
        }
        if(urban>0.001){
          for(int i=0;i<16;i++){
            vec4 park=uUrbanParks[i];
            if(park.z>0.0&&park.w>0.0){vec2 edge=abs(vWorldPos.xz-park.xy)-park.zw;float outside=max(edge.x,edge.y);urban*=smoothstep(0.0,5.0,outside);}
          }
          float fine=groundHash22(floor(vWorldPos.xz/.08)).x;
          float colorVariation=groundHash22(floor(vWorldPos.xz/.28)).y;
          float aggregate=step(.975,groundHash22(floor(vWorldPos.xz/.12)+19.3).x);
          vec3 concrete=vec3(.43,.46,.45)*(0.95+fine*.045+colorVariation*.045-aggregate*.055);
          urban*=smoothstep(.04,.23,vWorldPos.y);
          flatCol=mix(flatCol,concrete,urban);
        }

        // Crisp cliff reveal on stepped risers + biome-tinted top overhang rim!
        float cliffMask = 1.0 - smoothstep(0.68, 0.88, n.y);
        float rimLip = smoothstep(0.68, 0.82, n.y) * (1.0 - smoothstep(0.84, 0.94, n.y));
        vec3 albedo = mix(flatCol, cliffCol, cliffMask);
        vec3 lipCol = mix(uGrassLipColor, grassCol, smoothstep(18.0, 44.0, distSpawn));
        albedo = mix(albedo, lipCol * 1.05, rimLip * 0.62);

        // Pixel-Art Stone Riverbank / Seawall Embankment & Wet Coastal Sand right along water level (-0.35m)!
        vec2 pxWorld = floor(vWorldPos.xz * 7.5);
        float bayer2 = mod(pxWorld.x + pxWorld.y, 2.0) * 0.032 - 0.016;
        float shoreBand = 1.0 - smoothstep(-0.22, 0.48, vWorldPos.y);
        float wetStoneMask = shoreBand * (1.0 - smoothstep(0.55, 0.88, n.y));
        float bankSandMask = shoreBand * smoothstep(0.55, 0.88, n.y);
        // Pixel stone masonry courses on steep river embankments
        float bankRow = step(2.5, mod(floor(vWorldPos.y * 6.5), 3.0));
        float bankCol = step(5.4, mod(pxWorld.x + pxWorld.y + floor(vWorldPos.y * 2.2) * 3.0, 6.0));
        vec3 seawallCol = vec3(0.56, 0.59, 0.63) * (1.0 - max(bankRow, bankCol) * 0.14);
        vec3 sandyBankCol = vec3(0.86, 0.79, 0.58) * (0.94 + bayer2 * 2.0);
        albedo = mix(albedo, seawallCol, wetStoneMask * 0.86);
        albedo = mix(albedo, sandyBankCol, bankSandMask * 0.68);

        // Procedural Distant Forest Canopy Macro-Texture STRICTLY on Elevated Hills & Mountains (y > 6u, NEVER blotchy stains on flat 0m plains!)
        float hillSlopeMask = smoothstep(6.0, 24.0, vWorldPos.y);
        float farCanopyFade =
          smoothstep(75.0, 190.0, vFogDepth) *
          hillSlopeMask *
          wForest *
          (1.0 - smoothstep(2350.0, 2750.0, realElevM)) *
          smoothstep(0.58, 0.86, n.y) *
          (1.0 - roadMask);
        if (farCanopyFade > 0.005) {
          vec2 crownP = vWorldPos.xz * 0.12;
          float c1 = sin(crownP.x * 1.7 + sin(crownP.y * 1.4)) * cos(crownP.y * 1.6 - cos(crownP.x * 1.3));
          float c2 = sin(crownP.x * 3.4 - crownP.y * 2.8 + 1.7) * 0.5 + cos(crownP.x * 2.5 + crownP.y * 3.6) * 0.5;
          float crownHeight = clamp((c1 * 0.62 + c2 * 0.38) * 0.5 + 0.5, 0.0, 1.0);
          vec3 deepCanopy = vec3(0.20, 0.46, 0.24);
          vec3 litCanopy  = vec3(0.32, 0.64, 0.30);
          vec3 canopyTex  = mix(deepCanopy, litCanopy, smoothstep(0.24, 0.76, crownHeight));
          albedo = mix(albedo, canopyTex, farCanopyFade * 0.58);
        }

        albedo *= (1.0 + bayer2 * detailFade);

        // Bright HD-2D sunlit shading with warm sunlight / cool-slate hillshade contrast + cel micro-steps!
        float ndl = max(dot(n, uSunDir), 0.0);
        float qNdl = mix(ndl, floor(ndl * 6.0 + 0.5) / 6.0, 0.35);
        float elevLift = mix(0.88, 1.12, clamp((vWorldPos.y + 4.0) / 16.0, 0.0, 1.0));
        vec3 sunTint = mix(vec3(0.91, 0.96, 1.06), vec3(1.05, 1.02, 0.94), qNdl);
        vec3 lit = albedo * (0.74 + 0.38 * qNdl) * elevLift * sunTint;
        lit += vec3(0.32, 0.09, 0.01) * lavaCrack * wVolcano;

        // Dreamy Height-Layered Atmospheric Mist Veil:
        // - Low flat plains & riverbanks (y < 12u) wrap quickly in thick dreamy mist starting right at 54u (before 3D trees cull at ~88u!)
        //   and dissolve 100% into uFogColor by 520u — ZERO flat bare grass texture or sharp horizon seam!
        // - High mountains (y > 22u..500u) keep soft ink-wash silhouettes floating above the sea of mist out to 3,800u!
        float mountainPeek = smoothstep(14.0, 95.0, vWorldPos.y);
        float plainMist = clamp(
          smoothstep(54.0, 175.0, vFogDepth) * 0.64 +
          smoothstep(145.0, 340.0, vFogDepth) * 0.26 +
          smoothstep(290.0, 520.0, vFogDepth) * 0.10,
          0.0,
          1.0
        );
        float alpineMist = clamp(
          smoothstep(85.0, 480.0, vFogDepth) * 0.62 +
          smoothstep(420.0, 1750.0, vFogDepth) * 0.28 +
          smoothstep(1500.0, 3900.0, vFogDepth) * 0.10,
          0.0,
          1.0
        );
        float mistFactor = mix(plainMist, alpineMist, mountainPeek);

        // Soft drifting foothill & meadow mist wisps around 65u..360u
        float mistSwirl = 0.5 + 0.5 * sin(vWorldPos.x * 0.011 + cos(vWorldPos.z * 0.009) * 1.6);
        float lowMistWisp =
          smoothstep(58.0, 145.0, vFogDepth) *
          (1.0 - smoothstep(320.0, 520.0, vFogDepth)) *
          (1.0 - smoothstep(4.0, 32.0, vWorldPos.y));
        mistFactor = clamp(mistFactor + lowMistWisp * mistSwirl * 0.18, 0.0, 1.0);

        vec3 finalCol = mix(lit, uFogColor, mistFactor);
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
}

/**
 * 360° Live-Animated 16-Bit Pixel-Art Sky Shader & Stationary Mountain Panorama Ring:
 * - Pixel-snapped (420x128) 5-band ordered Bayer 4x4 dithered sunny sky
 * - Live drifting & gently morphing 2-octave seamless periodic FBM cumulus clouds (driven by uTime)
 *   with flat windswept bottoms, directional up-right sunlight, pure white tops, soft cream mids,
 *   and cool periwinkle-lavender Bayer-dithered undersides
 * - Stationary 3-layer atmospheric pixel mountain & caldera volcano skyline + Bayer horizon mist
 * - Exposes `mesh.userData.skyUniforms = mat.uniforms` (with `uTime`) for smooth per-frame animation
 */
export function createHorizonBackdropMesh(biome: BiomeId): THREE.Group {
  const pal = BIOME_PALETTES[biome];
  const group = new THREE.Group();

  // 1. SMOOTH ATMOSPHERIC SKY DOME WITH TRUE LINEAR WORLD-SPACE WIND-PLANE CUMULUS CLOUDS (Zero circular lampshade spin!)
  const skyZenith =
    biome === 'cinnabar_isle'
      ? '#240f1e'
      : biome === 'rocky_desert'
        ? '#cf743a'
        : biome === 'storm_coast'
          ? '#3574bd'
          : biome === 'sky_glacier'
            ? '#4794e0'
            : '#4693f2';
  const skyMid =
    biome === 'cinnabar_isle'
      ? '#6b2938'
      : biome === 'rocky_desert'
        ? '#f0ac65'
        : biome === 'storm_coast'
          ? '#6aa8e3'
          : biome === 'sky_glacier'
            ? '#84c5f7'
            : '#7cc0ff';
  const skyHorizon =
    biome === 'cinnabar_isle'
      ? '#b85346'
      : biome === 'rocky_desert'
        ? '#ffe5bd'
        : biome === 'storm_coast'
          ? '#bddff7'
          : biome === 'sky_glacier'
            ? '#d9f2ff'
            : '#cfeaff';

  const cloudLit = biome === 'cinnabar_isle' ? '#ffdcc2' : '#ffffff';
  const cloudShade =
    biome === 'cinnabar_isle'
      ? '#b8685c'
      : biome === 'rocky_desert'
        ? '#edd0b2'
        : '#c9dff7';

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color(skyZenith) },
      uMid: { value: new THREE.Color(skyMid) },
      uHorizon: { value: new THREE.Color(skyHorizon) },
      uCloudLit: { value: new THREE.Color(cloudLit) },
      uCloudShade: { value: new THREE.Color(cloudShade) },
      uFogColor: { value: new THREE.Color(pal.fogHex) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudShade;
      uniform vec3 uFogColor;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Organic multi-puff cumulus FBM on a real flat overhead sky plane
      float cloudFbm(vec2 p) {
        float v = 0.0;
        v += vnoise(p * 1.0) * 0.56;
        v += vnoise(p * 2.15 + vec2(4.3, -2.7)) * 0.28;
        v += vnoise(p * 4.4 + vec2(-1.9, 6.1)) * 0.16;
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float elev = clamp(d.y, 0.0, 1.0);

        // Smooth sunlit anime sky gradient + unified misty horizon band so sky & ground melt together seamlessly!
        vec3 col = mix(uHorizon, uMid, smoothstep(0.05, 0.36, elev));
        col = mix(col, uZenith, smoothstep(0.30, 0.86, elev));
        col = mix(uFogColor, col, smoothstep(0.012, 0.115, elev));

        vec3 sunDirSky = normalize(vec3(0.54, 0.62, 0.44));
        float sunDot = dot(d, sunDirSky);
        if (sunDot > 0.85) {
          float halo = smoothstep(0.85, 0.992, sunDot) * smoothstep(0.02, 0.14, elev);
          col = mix(col, vec3(1.0, 0.96, 0.82), halo * 0.48);
          if (sunDot > 0.9965 && elev > 0.06) {
            col = vec3(1.0, 0.99, 0.90);
          }
        }

        // Real planar overhead projection: CRISP sharp-edged cel-shaded anime cumulus clouds drifting linearly West -> East!
        if (d.y > 0.075) {
          float projScale = 1.0 / (d.y + 0.16);
          vec2 skyPlane = d.xz * projScale;
          vec2 wind = vec2(uTime * 0.042, uTime * 0.014);
          // Fine crisp pixel-snapped cloud grid (no blurry soft edges!)
          vec2 qPlane = floor((skyPlane * 0.52 + wind) * 58.0) / 58.0;

          float baseDens = cloudFbm(qPlane);
          float detailDens = cloudFbm(qPlane * 2.1 + vec2(uTime * 0.008, -uTime * 0.005));
          float dens = baseDens * 0.74 + detailDens * 0.26;

          float horizonFade = smoothstep(0.085, 0.20, d.y) * smoothstep(0.96, 0.50, d.y);
          float cutoff = 0.565 + (1.0 - horizonFade) * 0.24;

          // Razor-sharp crisp cel-shaded anime cloud silhouette!
          if (dens > cutoff) {
            float sunSample = cloudFbm(qPlane + vec2(-0.065, -0.055));
            float lit = clamp(0.52 + (dens - sunSample) * 4.6 + (d.y - 0.12) * 0.55, 0.0, 1.0);
            // Clean 3-tone hard-stepped anime cumulus volume (pure white top, soft cream mid, cool sky-blue base)
            vec3 cMid = mix(uCloudShade, uCloudLit, 0.62);
            vec3 cCol = lit > 0.62 ? uCloudLit : lit > 0.42 ? cMid : uCloudShade;
            col = mix(col, cCol, horizonFade);
          }
        }

        // Seamless lower-hemisphere mist lock
        if (d.y <= 0.012) {
          col = uFogColor;
        }

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(18500, 32, 24), skyMat);
  skyDome.renderOrder = -20;
  group.add(skyDome);

  // Pure open sky dome — ZERO fake surrounding mountain walls! The actual procedural 3D terrain mesh forms every hill, mountain & open plain organically.
  group.userData.skyUniforms = skyMat.uniforms;
  return group;
}

