import * as THREE from 'three';

/**
 * Global GPU Uniform Bundle shared by ALL 3D Pixel-Art Flora Materials
 * (wild trees, bushes, flowers, tall grass, mushrooms, cattails, lily pads, AND city boulevard/park trees!).
 * Updating these uniforms once per frame instantaneously transforms every plant in the world:
 * - Snow & Sub-zero Frost: crisp pixel-art top-edge snow caps + 3x3 cross snowflake patterns + icy blue rim
 * - Rain & Storm Wetness: deeper rain-soaked emerald saturation + glistening raindrop rim glints
 * - Scorching Heat: sun-warmed golden-olive foliage warmth
 * - Atmospheric Daylight / Overcast Dimming & Fog Veil matching the terrain and sky dome
 */
export const GLOBAL_FLORA_WEATHER_UNIFORMS = {
  uSnowCover: { value: 0.0 },
  uWetness: { value: 0.0 },
  uHeatDry: { value: 0.0 },
  uWindSway: { value: 1.0 },
  uTime: { value: 0.0 },
  uLightTint: { value: new THREE.Color(1, 1, 1) },
  uFogColor: { value: new THREE.Color(0xb7dff8) },
};

const floraMatCache = new WeakMap<THREE.Texture, Map<string, THREE.ShaderMaterial>>();

export function syncGlobalFloraWeather3D(params: {
  snowCover: number;
  wetness: number;
  heatDry: number;
  windSwayMult?: number;
  lightTint: THREE.Color;
  fogColor: THREE.Color;
  timeSec: number;
}): void {
  GLOBAL_FLORA_WEATHER_UNIFORMS.uSnowCover.value = Math.max(0, Math.min(1, params.snowCover));
  GLOBAL_FLORA_WEATHER_UNIFORMS.uWetness.value = Math.max(0, Math.min(1, params.wetness));
  GLOBAL_FLORA_WEATHER_UNIFORMS.uHeatDry.value = Math.max(0, Math.min(1, params.heatDry));
  if (params.windSwayMult !== undefined) {
    GLOBAL_FLORA_WEATHER_UNIFORMS.uWindSway.value = Math.max(0.5, Math.min(6, params.windSwayMult));
  }
  GLOBAL_FLORA_WEATHER_UNIFORMS.uLightTint.value.copy(params.lightTint);
  GLOBAL_FLORA_WEATHER_UNIFORMS.uFogColor.value.copy(params.fogColor);
  GLOBAL_FLORA_WEATHER_UNIFORMS.uTime.value = params.timeSec;
}

function getTexPixelDims(tex: THREE.Texture): [number, number] {
  const img = tex.image as { width?: number; height?: number } | undefined;
  const w = img && typeof img.width === 'number' && img.width > 0 ? img.width : 48;
  const h = img && typeof img.height === 'number' && img.height > 0 ? img.height : 48;
  return [Math.max(16, Math.min(128, w)), Math.max(16, Math.min(128, h))];
}

/**
 * Creates (or retrieves cached) a Weather-Reactive HD-2D Pixel-Art Flora Material.
 * Preserves sharp NearestFilter pixel art & dark outlines while layering dynamic snow caps,
 * crisp pixel snowflake patterns, rain sheen, and overcast/day-night shading directly on the GPU.
 */
export function createWeatherFloraMaterial3D(
  tex: THREE.Texture,
  alphaTest = 0.15,
): THREE.ShaderMaterial {
  let byAlpha = floraMatCache.get(tex);
  if (!byAlpha) {
    byAlpha = new Map();
    floraMatCache.set(tex, byAlpha);
  }
  const key = alphaTest.toFixed(2);
  const existing = byAlpha.get(key);
  if (existing) return existing;

  const [tw, th] = getTexPixelDims(tex);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uAlphaTest: { value: alphaTest },
      uTexSize: { value: new THREE.Vector2(tw, th) },
      uSnowCover: GLOBAL_FLORA_WEATHER_UNIFORMS.uSnowCover,
      uWetness: GLOBAL_FLORA_WEATHER_UNIFORMS.uWetness,
      uHeatDry: GLOBAL_FLORA_WEATHER_UNIFORMS.uHeatDry,
      uTime: GLOBAL_FLORA_WEATHER_UNIFORMS.uTime,
      uLightTint: GLOBAL_FLORA_WEATHER_UNIFORMS.uLightTint,
      uFogColor: GLOBAL_FLORA_WEATHER_UNIFORMS.uFogColor,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFogDepth;
      varying float vWorldHash;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // Stable per-plant seed from mesh world origin so each tree's snowflake pattern is unique
        vec3 originW = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
        vWorldHash = fract(sin(dot(originW.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vec4 mv = viewMatrix * wp;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uAlphaTest;
      uniform vec2 uTexSize;
      uniform float uSnowCover;
      uniform float uWetness;
      uniform float uHeatDry;
      uniform float uTime;
      uniform vec3 uLightTint;
      uniform vec3 uFogColor;

      varying vec2 vUv;
      varying float vFogDepth;
      varying float vWorldHash;

      float pxHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float sampleAlphaUp(vec2 uv, float dy) {
        float ny = uv.y + dy;
        if (ny >= 0.998) return 0.0;
        return texture2D(uMap, vec2(uv.x, ny)).a;
      }

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        if (texel.a < uAlphaTest) discard;

        vec3 col = texel.rgb;
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        bool isOutline = lum < 0.032;

        // Quantized pixel coordinate on this sprite's native pixel-art grid
        vec2 pxCoord = floor(vUv * uTexSize);
        float pxY = 1.0 / max(16.0, uTexSize.y);

        // 1. RAIN & STORM WETNESS: deeper rain-soaked foliage + crisp sparkling top-edge raindrop glints
        if (uWetness > 0.01) {
          float w = uWetness;
          if (!isOutline) {
            // Deepen & enrich wet leaf colors naturally
            float satBoost = mix(1.0, 1.12, w);
            vec3 grey = vec3(lum);
            col = mix(grey, col, satBoost) * mix(1.0, 0.76, w);
            // Tiny animated pixel raindrop glint along exposed upper leaf edges
            float aUp = sampleAlphaUp(vUv, pxY * 1.1);
            if (aUp < 0.35 && vUv.y > 0.22) {
              float dropTick = floor(uTime * 5.0 + vWorldHash * 17.0);
              float glint = step(0.84 - w * 0.14, pxHash(pxCoord + vec2(dropTick * 0.37, 0.0)));
              col = mix(col, vec3(0.76, 0.89, 1.0), glint * w * 0.55);
            }
          }
        }

        // 2. SCORCHING HEAT DRYNESS (>= 31°C): warm sun-baked olive-gold tone on foliage
        if (uHeatDry > 0.01 && !isOutline) {
          float isLeafy = smoothstep(0.02, 0.14, col.g - col.b * 0.75);
          vec3 dryWarm = col * vec3(1.14, 1.01, 0.72);
          col = mix(col, dryWarm, uHeatDry * 0.42 * isLeafy);
        }

        // 3. SNOW & FROST ON PLANTS: Top-edge snow caps + inner canopy drifts + crisp pixel snowflake patterns!
        if (uSnowCover > 0.01) {
          float s = uSnowCover;
          float aUp1 = sampleAlphaUp(vUv, pxY * 1.15);
          float aUp2 = sampleAlphaUp(vUv, pxY * 2.4);
          float aUp3 = sampleAlphaUp(vUv, pxY * 3.8);

          // Snow settles heavily on exposed upper silhouette edges & upper foliage puffs (less on low dark trunks)
          float heightBias = smoothstep(0.14, 0.42, vUv.y);
          float isLeafOrBlossom = smoothstep(0.01, 0.08, max(col.g - col.r * 0.45, lum - 0.12));
          float topCap1 = step(aUp1, 0.35);
          float topCap2 = step(aUp2, 0.35) * smoothstep(0.28, 0.65, s);
          float topCap3 = step(aUp3, 0.35) * smoothstep(0.62, 0.96, s);

          // Organic jagged pixel snow-cap overhang so snow caps look hand-pixeled (not straight flat bars!)
          float edgeJagged = pxHash(vec2(pxCoord.x + floor(vWorldHash * 29.0), 3.0));
          float capMask = max(
            topCap1 * step(0.18 * (1.0 - s), edgeJagged),
            max(
              topCap2 * step(0.32 - s * 0.26, edgeJagged),
              topCap3 * step(0.48 - s * 0.36, edgeJagged)
            )
          ) * smoothstep(0.08, 0.25, vUv.y);

          // Inner foliage snow pockets (clinging to sunlit upper canopy lobes!)
          float puffNoise = pxHash(floor(pxCoord * 0.5) + vec2(floor(vWorldHash * 19.0), 7.0));
          float innerPuff =
            heightBias *
            isLeafOrBlossom *
            smoothstep(0.16, 0.48, lum) *
            step(1.06 - s * 0.72, puffNoise);

          // Crisp 3x3 pixel-art "+" snowflake motifs & 1px snow flecks stamped across the canopy!
          vec2 tile = floor((pxCoord + vec2(floor(vWorldHash * 13.0), floor(vWorldHash * 17.0))) / 5.0);
          vec2 loc = mod(pxCoord + vec2(floor(vWorldHash * 13.0), floor(vWorldHash * 17.0)), 5.0);
          float hasFlake = step(1.02 - s * 0.68, pxHash(tile + vec2(11.3, 5.7)));
          // Classic pixel '+' cross snowflake at local cell center (2,2)
          float isCrossFlake =
            hasFlake *
            ((abs(loc.x - 2.0) < 0.5 && abs(loc.y - 2.0) <= 1.1) ||
             (abs(loc.y - 2.0) < 0.5 && abs(loc.x - 2.0) <= 1.1) ? 1.0 : 0.0);
          float isSnowSpeck = step(0.95 - s * 0.16, pxHash(pxCoord + vec2(floor(vWorldHash * 31.0), 2.0)));
          float flakePattern = max(isCrossFlake, isSnowSpeck) * heightBias * (isLeafOrBlossom * 0.85 + 0.15);

          float snowMix = clamp(max(capMask, max(innerPuff * 0.88, flakePattern)), 0.0, 1.0);

          // Subtle animated icy crystal twinkle on settled snow
          float twinkle = step(0.975, pxHash(pxCoord + vec2(floor(uTime * 2.2), 9.0))) * s;
          vec3 snowBright = vec3(0.96, 0.99, 1.0);
          vec3 snowShade  = vec3(0.64, 0.80, 0.96);
          // Topmost snow lip is crisp white; lower overhanging rim has cool anime ice-blue shading
          vec3 snowCol = mix(snowShade, snowBright, clamp(topCap1 * 0.85 + isCrossFlake * 0.9 + twinkle + vUv.y * 0.35, 0.0, 1.0));

          if (isOutline) {
            // Keep pixel-art outlines crisp, gently cooling dark black -> frosty slate-navy in heavy snow
            col = mix(col, vec3(0.05, 0.09, 0.16), s * 0.72);
          } else {
            // Gently frost underlying leaves toward cool winter evergreen before layering snow & snowflakes
            vec3 frostedLeaf = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2)) * vec3(0.76, 0.90, 1.02)), s * 0.36);
            col = mix(frostedLeaf, snowCol, snowMix);
          }
        }

        // 4. ATMOSPHERIC DAYLIGHT / OVERCAST / TEMPERATURE LIGHTING (keeps dark outlines sharp)
        col *= uLightTint;

        // 5. MATCHING DISTANCE MIST VEIL (blends smoothly with terrain fog)
        float mist = clamp(
          smoothstep(54.0, 175.0, vFogDepth) * 0.64 +
          smoothstep(145.0, 340.0, vFogDepth) * 0.26,
          0.0,
          0.95
        );
        col = mix(col, uFogColor, mist);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: false,
    side: THREE.DoubleSide,
  });

  byAlpha.set(key, mat);
  return mat;
}
