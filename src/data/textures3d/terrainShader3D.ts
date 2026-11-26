import * as THREE from 'three';
import { BIOME_PALETTES, type BiomeId, type BiomeTextureSet } from './biomePalettesAndWater';

export const BIOME_ORDER_LIST: BiomeId[] = [
  'verdant_forest',
  'rocky_desert',
  'storm_coast',
  'sky_glacier',
  'cinnabar_isle',
];

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

export function getSeamlessBiomeAt3D(
  wx: number,
  wz: number,
  wy: number,
  baseBiome: BiomeId,
): BiomeId {
  // Vast Minecraft-style macro regions (~700-950m continental biomes, wide gentle transitions!)
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

  if (wy > 155.0 && temp < 0.68) return 'sky_glacier';
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
  return new THREE.ShaderMaterial({
    uniforms: {
      uGroundTex: { value: texSet.ground },
      uCliffTex: { value: texSet.cliff },
      uRoadTex: { value: texSet.road },
      uFogColor: { value: new THREE.Color(pal.fogHex) },
      uGrassLipColor: { value: new THREE.Color(pal.groundColors[2]) },
      uBaseClimate: { value: new THREE.Vector2(baseT, baseM) },
      uFogNear: { value: 175.0 },
      uFogFar: { value: 510.0 },
      uSectorSize: { value: sectorSize },
      uSunDir: { value: new THREE.Vector3(0.54, 0.78, 0.44).normalize() },
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
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uSectorSize;
      uniform vec3 uSunDir;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vFogDepth;

      vec2 groundHash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453123);
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
        float texLuma = clamp(rawLum / 0.56, 0.76, 1.22);
        float meadowPatch = sin(vWorldPos.x * 0.055 + 1.3) * cos(vWorldPos.z * 0.062 - 0.7) * 0.5 + 0.5;

        // Vast Minecraft-style continental Temperature × Moisture × Elevation biome blending (~750m+ macro regions!)
        float distSpawn = length(vWorldPos.xz);
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

        // Gentle, wide transition bands between macro biomes (true high-alpine snowline >145u so forested hills stay lush green!)
        float wSnow = clamp(
          (1.0 - smoothstep(0.18, 0.34, temp)) +
          smoothstep(145.0, 195.0, vWorldPos.y) * (1.0 - smoothstep(0.62, 0.76, temp)),
          0.0, 1.0
        );
        float wVolcano = smoothstep(0.72, 0.86, temp) * smoothstep(0.44, 0.58, moist);
        float wDesert = smoothstep(0.66, 0.80, temp) * (1.0 - smoothstep(0.42, 0.56, moist));
        float wCoast = smoothstep(0.66, 0.82, moist) * (1.0 - smoothstep(1.0, 2.8, vWorldPos.y)) * (1.0 - wSnow) * (1.0 - wVolcano);
        float wForest = max(0.08, 1.0 - clamp(wSnow + wVolcano + wDesert + wCoast, 0.0, 1.0));
        float wSum = wForest + wDesert + wSnow + wVolcano + wCoast;
        wForest /= wSum; wDesert /= wSum; wSnow /= wSum; wVolcano /= wSum; wCoast /= wSum;

        // Distinct stylized pixel palettes for each interconnected biome!
        vec3 forestGround = vec3(0.40, 0.77, 0.34) * texLuma * mix(0.92, 1.12, meadowPatch);
        vec3 desertGround = vec3(0.92, 0.78, 0.45) * texLuma * mix(0.94, 1.08, meadowPatch);
        vec3 snowGround   = vec3(0.92, 0.96, 1.00) * mix(0.92, 1.06, texLuma);
        vec3 coastGround  = vec3(0.90, 0.84, 0.56) * texLuma;
        // Glowing molten magma veins inside dark obsidian volcanic ground!
        float lavaNoise = sin(vWorldPos.x * 0.45 + sin(vWorldPos.z * 0.38) * 1.4) * cos(vWorldPos.z * 0.42);
        float lavaCrack = smoothstep(0.76, 0.94, abs(lavaNoise));
        vec3 volcanoGround = mix(vec3(0.20, 0.17, 0.21) * texLuma, vec3(1.0, 0.36, 0.08), lavaCrack * 0.92);

        vec3 grassCol =
          forestGround * wForest +
          desertGround * wDesert +
          snowGround * wSnow +
          volcanoGround * wVolcano +
          coastGround * wCoast;

        // Keep vast emerald heartland coherent around starting area & Pallet Village
        grassCol = mix(baseTexCol * mix(0.92, 1.12, meadowPatch), grassCol, smoothstep(90.0, 180.0, distSpawn));

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
        vec3 biomeCliff =
          vec3(0.68, 0.50, 0.34) * cliffLuma * wForest +
          vec3(0.78, 0.46, 0.26) * cliffLuma * wDesert +
          vec3(0.56, 0.70, 0.85) * cliffLuma * wSnow +
          mix(vec3(0.22, 0.18, 0.23) * cliffLuma, vec3(1.0, 0.34, 0.06), lavaCrack * 0.75) * wVolcano +
          vec3(0.74, 0.66, 0.48) * cliffLuma * wCoast;
        vec3 cliffCol = mix(rawCliff, biomeCliff, smoothstep(18.0, 44.0, distSpawn));

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
        albedo *= (1.0 + bayer2);

        // Bright HD-2D sunlit shading with warm sunlight / cool-slate hillshade contrast + cel micro-steps!
        float ndl = max(dot(n, uSunDir), 0.0);
        float qNdl = mix(ndl, floor(ndl * 6.0 + 0.5) / 6.0, 0.35);
        float elevLift = mix(0.88, 1.12, clamp((vWorldPos.y + 4.0) / 16.0, 0.0, 1.0));
        vec3 sunTint = mix(vec3(0.91, 0.96, 1.06), vec3(1.05, 1.02, 0.94), qNdl);
        vec3 lit = albedo * (0.74 + 0.38 * qNdl) * elevLift * sunTint;
        lit += vec3(0.32, 0.09, 0.01) * lavaCrack * wVolcano;

        float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
        vec3 finalCol = mix(lit, uFogColor, fogFactor);
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

        // Smooth sunlit anime sky gradient + warm pixel-art Sun Disc & Corona Halo!
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.34, elev));
        col = mix(col, uZenith, smoothstep(0.28, 0.85, elev));

        vec3 sunDirSky = normalize(vec3(0.54, 0.62, 0.44));
        float sunDot = dot(d, sunDirSky);
        if (sunDot > 0.85) {
          float halo = smoothstep(0.85, 0.992, sunDot);
          col = mix(col, vec3(1.0, 0.96, 0.82), halo * 0.48);
          if (sunDot > 0.9965) {
            col = vec3(1.0, 0.99, 0.90);
          }
        }

        // Real planar overhead projection: CRISP sharp-edged cel-shaded anime cumulus clouds drifting linearly West -> East!
        if (d.y > 0.03) {
          float projScale = 1.0 / (d.y + 0.16);
          vec2 skyPlane = d.xz * projScale;
          vec2 wind = vec2(uTime * 0.042, uTime * 0.014);
          // Fine crisp pixel-snapped cloud grid (no blurry soft edges!)
          vec2 qPlane = floor((skyPlane * 0.52 + wind) * 58.0) / 58.0;

          float baseDens = cloudFbm(qPlane);
          float detailDens = cloudFbm(qPlane * 2.1 + vec2(uTime * 0.008, -uTime * 0.005));
          float dens = baseDens * 0.74 + detailDens * 0.26;

          float horizonFade = smoothstep(0.05, 0.16, d.y) * smoothstep(0.96, 0.50, d.y);
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

        // Seamless lower-hemisphere blend
        if (d.y < 0.02) {
          col = mix(uHorizon, uFogColor, smoothstep(0.02, -0.08, d.y));
        }

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(680, 32, 24), skyMat);
  skyDome.renderOrder = -20;
  group.add(skyDome);

  // Pure open sky dome — ZERO fake surrounding mountain walls! The actual procedural 3D terrain mesh forms every hill, mountain & open plain organically.
  group.userData.skyUniforms = skyMat.uniforms;
  return group;
}

