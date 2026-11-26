import * as THREE from 'three';

export type BiomeId =
  | 'verdant_forest'
  | 'rocky_desert'
  | 'storm_coast'
  | 'sky_glacier'
  | 'cinnabar_isle';

export interface BiomePalette {
  skyHex: number;
  fogHex: number;
  groundColors: [string, string, string, string];
  cliffColors: [string, string, string, string];
  roadColors: [string, string, string];
  foliageColors: [string, string, string];
  trunkColor: string;
  accentFlower: [string, string];
  ambientHex: number;
  sunHex: number;
}

export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  verdant_forest: {
    skyHex: 0x7bc2f5,
    fogHex: 0xb7dff8,
    groundColors: ['#4cc044', '#3eab38', '#64d654', '#2f8c32'],
    cliffColors: ['#d8b98a', '#be9764', '#ead0a4', '#85623f'],
    roadColors: ['#e8d49c', '#d5bc80', '#f4e4b8'],
    foliageColors: ['#27883a', '#3eb04c', '#6ad864'],
    trunkColor: '#754b2a',
    accentFlower: ['#ff5959', '#ffe066'],
    ambientHex: 0xfffce8,
    sunHex: 0xfff6d1,
  },
  rocky_desert: {
    skyHex: 0xffc67d,
    fogHex: 0xffd79e,
    groundColors: ['#d8a962', '#ca9852', '#e4ba76', '#b88542'],
    cliffColors: ['#a65e3e', '#8c4b30', '#bf7452', '#703a24'],
    roadColors: ['#ead2a2', '#d6b882', '#f5e2ba'],
    foliageColors: ['#4d9c45', '#68b856', '#86d26c'],
    trunkColor: '#7a5232',
    accentFlower: ['#ff7b3b', '#ffe066'],
    ambientHex: 0xffefd6,
    sunHex: 0xffe4aa,
  },
  storm_coast: {
    skyHex: 0x5c96cc,
    fogHex: 0x7db2e0,
    groundColors: ['#46a87a', '#3a946a', '#58ba8c', '#2e7e5a'],
    cliffColors: ['#5b6c7d', '#485766', '#728596', '#374452'],
    roadColors: ['#e0cfa0', '#ccba8a', '#efe2bc'],
    foliageColors: ['#227a62', '#329678', '#4eb896'],
    trunkColor: '#634832',
    accentFlower: ['#74c0fc', '#ffffff'],
    ambientHex: 0xdceeff,
    sunHex: 0xe6f4ff,
  },
  sky_glacier: {
    skyHex: 0x99d6ff,
    fogHex: 0xc2e8ff,
    groundColors: ['#dceef8', '#c6e2f2', '#eef7fc', '#b0d2e8'],
    cliffColors: ['#5e9cc4', '#4882ab', '#7cb6db', '#36688f'],
    roadColors: ['#c2d4e0', '#aebfcd', '#d8e6f0'],
    foliageColors: ['#2d757a', '#42969c', '#a8e0e6'],
    trunkColor: '#5c4b42',
    accentFlower: ['#74c0fc', '#b197fc'],
    ambientHex: 0xe8f7ff,
    sunHex: 0xffffff,
  },
  cinnabar_isle: {
    skyHex: 0x4a2433,
    fogHex: 0x6e3138,
    groundColors: ['#4c444d', '#3e3740', '#5c525e', '#322c34'],
    cliffColors: ['#362830', '#261b22', '#523438', '#ff5924'],
    roadColors: ['#6e5652', '#584340', '#856a64'],
    foliageColors: ['#a63228', '#d9480f', '#ff922b'],
    trunkColor: '#2d2326',
    accentFlower: ['#ff5924', '#ffd43b'],
    ambientHex: 0xffc4a8,
    sunHex: 0xff9d66,
  },
};

export function makePixelCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function hash2(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) % 1000;
}

export interface BiomeTextureSet {
  ground: THREE.CanvasTexture;
  cliff: THREE.CanvasTexture;
  road: THREE.CanvasTexture;
  plaza: THREE.CanvasTexture;
  foliage: THREE.CanvasTexture;
  trunk: THREE.CanvasTexture;
  grassTuft: THREE.Texture;
  tallGrass: THREE.Texture;
  mushroom: THREE.Texture;
  mushroomAlt: THREE.Texture;
  flower: THREE.Texture;
  flowerAlt: THREE.Texture;
  bush: THREE.Texture;
  boulder: THREE.Texture;
  stump: THREE.Texture;
  signpost: THREE.Texture;
  lilyPad: THREE.Texture;
  lilyLotus: THREE.Texture;
  cattail: THREE.Texture;
  berryCluster: THREE.Texture;
  treeSprite: THREE.Texture;
  treeSprites: THREE.Texture[];
  flowers: THREE.Texture[];
  boulders: THREE.Texture[];
  mushrooms: THREE.Texture[];
  bushes: THREE.Texture[];
}

/** Custom 3D Pixel-Art Animated Wave & Shoreline Foam Water ShaderMaterial (GBA/HD-2D waves, not a flat sliding tile!) */
export function createPixelWaterMaterial(biome: BiomeId): THREE.ShaderMaterial {
  const isLava = biome === 'cinnabar_isle';
  const isIce = biome === 'sky_glacier';
  const deepCol = new THREE.Color(isLava ? '#9c1d10' : isIce ? '#228be6' : '#1864ab');
  const midCol = new THREE.Color(isLava ? '#d9480f' : isIce ? '#4dabf7' : '#1c7ed6');
  const shallowCol = new THREE.Color(isLava ? '#ff922b' : isIce ? '#74c0fc' : '#3bc9db');
  const foamCol = new THREE.Color(isLava ? '#ffe066' : '#e7f5ff');

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: deepCol },
      uMid: { value: midCol },
      uShallow: { value: shallowCol },
      uFoam: { value: foamCol },
      uOpacity: { value: isLava ? 0.94 : 0.86 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWaveH;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w1 = sin(wp.x * 0.55 + uTime * 2.1 + cos(wp.z * 0.38)) * 0.085;
        float w2 = cos(wp.z * 0.62 - uTime * 1.7 + wp.x * 0.22) * 0.065;
        float w3 = sin((wp.x - wp.z) * 0.85 + uTime * 2.8) * 0.035;
        float wave = w1 + w2 + w3;
        wp.y += wave;
        vWorldPos = wp.xyz;
        vWaveH = wave;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uMid;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform float uOpacity;
      varying vec3 vWorldPos;
      varying float vWaveH;

      float wHash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float wNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x),
          mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      float wFbm(vec2 p) {
        return wNoise(p) * 0.58 + wNoise(p * 2.13 + vec2(3.7, -1.9)) * 0.28 + wNoise(p * 4.31 + vec2(-2.1, 5.4)) * 0.14;
      }

      void main() {
        // Ultra-fine crisp 11px/m world-space pixelation with NON-REPEATING domain-warped FBM ripples!
        vec2 p = floor(vWorldPos.xz * 11.0) / 11.0;
        vec2 warp = vec2(
          wNoise(p * 0.42 + vec2(uTime * 0.24, -uTime * 0.12)),
          wNoise(p * 0.42 + vec2(-uTime * 0.16, uTime * 0.21) + 7.3)
        );
        float swell = wFbm(p * 0.34 + warp * 0.85 + vec2(uTime * 0.28, uTime * 0.11));
        float fineRipple = wFbm(vec2(p.x * 0.95, p.y * 1.95) - warp * 0.4 + vec2(-uTime * 0.36, uTime * 0.18));
        float h = swell * 0.65 + fineRipple * 0.35 + vWaveH * 1.4;

        // Subtle, refined 4-tone watercolor-pixel lake palette (zero chunky polka-dots!)
        vec3 col = uDeep;
        if (h > 0.44) col = uMid;
        if (h > 0.59) col = uShallow;
        // Delicate 1px horizontal sunlit sparkle glints on fine ripple crests
        float sparkle = wNoise(vec2(p.x * 1.6, p.y * 5.5) + vec2(uTime * 0.6, -uTime * 0.25));
        if (h > 0.72 && sparkle > 0.66) {
          col = uFoam;
        }
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });
}

const waterTexCache = new Map<string, THREE.CanvasTexture>();

/** Shimmering 32x32 nearest-neighbor pixel-art River & Lake Water tile texture per biome! */
export function getPixelWaterTexture(biome: BiomeId): THREE.CanvasTexture {
  const cached = waterTexCache.get(biome);
  if (cached) return cached;
  const isLava = biome === 'cinnabar_isle';
  const isIce = biome === 'sky_glacier';
  const c0 = isLava ? '#b82514' : isIce ? '#339af0' : '#1c7ed6';
  const c1 = isLava ? '#e8590c' : isIce ? '#4dabf7' : '#228be6';
  const c2 = isLava ? '#ff922b' : isIce ? '#a5d8ff' : '#4dabf7';
  const hi = isLava ? '#ffe066' : '#e7f5ff';
  const tex = makePixelCanvas(32, (ctx, s) => {
    ctx.fillStyle = c0;
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const wave = Math.sin(x * 0.42 + y * 0.25) + Math.cos(y * 0.55 - x * 0.18);
        if (wave > 0.35) {
          ctx.fillStyle = c1;
          ctx.fillRect(x, y, 1, 1);
        }
        if (wave > 1.05) {
          ctx.fillStyle = c2;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    // Crisp horizontal GBA pixel water shimmer streaks
    const ripples = [
      [3, 5, 6], [17, 8, 7], [9, 14, 5], [22, 18, 6], [4, 24, 7], [16, 28, 6],
    ];
    for (const [rx, ry, rw] of ripples) {
      ctx.fillStyle = c2;
      ctx.fillRect(rx, ry, rw, 1);
      ctx.fillStyle = hi;
      ctx.fillRect(rx + 1, ry, Math.max(2, rw - 3), 1);
    }
  });
  tex.repeat.set(22, 22);
  waterTexCache.set(biome, tex);
  return tex;
}

const emoteTexCache = new Map<string, THREE.CanvasTexture>();

/** Crisp 20x18 pixel-art speech bubble emote for living Hub & Map-Select protagonist + Pokémon! */
export function getPixelEmoteTexture(kind: 'heart' | 'music' | 'sparkle' | 'exclaim'): THREE.CanvasTexture {
  const cached = emoteTexCache.get(kind);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 20;
  c.height = 18;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // White pixel speech bubble with dark ink border & tail
  ctx.fillStyle = '#161420';
  ctx.fillRect(2, 1, 16, 13);
  ctx.fillRect(1, 2, 18, 11);
  ctx.fillRect(8, 14, 4, 2);
  ctx.fillRect(9, 16, 2, 1);
  ctx.fillStyle = '#fffdf5';
  ctx.fillRect(2, 2, 16, 11);
  ctx.fillRect(9, 13, 2, 2);
  if (kind === 'heart') {
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(6, 4, 3, 3);
    ctx.fillRect(11, 4, 3, 3);
    ctx.fillRect(7, 5, 6, 4);
    ctx.fillRect(8, 9, 4, 2);
    ctx.fillRect(9, 11, 2, 1);
    ctx.fillStyle = '#ffc9c9';
    ctx.fillRect(7, 5, 1, 1);
  } else if (kind === 'music') {
    ctx.fillStyle = '#339af0';
    ctx.fillRect(8, 4, 6, 2);
    ctx.fillRect(8, 6, 2, 5);
    ctx.fillRect(13, 6, 2, 4);
    ctx.fillRect(6, 9, 3, 2);
    ctx.fillRect(11, 8, 3, 2);
  } else if (kind === 'sparkle') {
    ctx.fillStyle = '#f59f00';
    ctx.fillRect(9, 3, 2, 9);
    ctx.fillRect(5, 7, 10, 2);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(8, 6, 4, 3);
  } else {
    ctx.fillStyle = '#e03131';
    ctx.fillRect(9, 3, 2, 5);
    ctx.fillRect(9, 9, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  emoteTexCache.set(kind, tex);
  return tex;
}

const worldPropTexCache = new Map<string, THREE.Texture>();
const worldPropLoader = new THREE.TextureLoader();

/** Loads a crisp 64x64 nearest-neighbor transparent PNG world prop texture with instant caching! */
export function loadWorldPropTex(url: string): THREE.Texture {
  const cached = worldPropTexCache.get(url);
  if (cached) return cached;
  const tex = worldPropLoader.load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  worldPropTexCache.set(url, tex);
  return tex;
}



/** Generates rich nearest-neighbor 32x32 / 16x16 GBA/PokeBonk-style pixel textures for a biome */

export function getBiomePreviewStyle(biome: BiomeId): string {
  const p = BIOME_PALETTES[biome];
  return `linear-gradient(180deg, #${p.skyHex.toString(16).padStart(6, '0')} 0%, #${p.skyHex.toString(16).padStart(6, '0')} 36%, ${p.cliffColors[0]} 36%, ${p.cliffColors[1]} 62%, ${p.groundColors[0]} 62%, ${p.groundColors[1]} 100%)`;
}

/**
 * High-Craft 48x56 Fine 1px NDS HGSS/BW Overworld Pixel Protagonist Sprites!
 * Supports 'red' | 'misty' | 'brock' | 'blue' across 4 directions x 5 frames (idle0, idle1, 0, 1, jump)
 * with sculpted anime chibi proportions, expressive shaded eyes, detailed jackets/backpacks,
 * white-soled sneakers, knee-bend stride kinematics, and crisp 1px #14141c outer contour outline.
 */
