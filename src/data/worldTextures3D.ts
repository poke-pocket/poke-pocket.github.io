import * as THREE from 'three';
import type { FacingDir } from './overworldTiles';

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

function makePixelCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
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

function hash2(x: number, y: number): number {
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
function loadWorldPropTex(url: string): THREE.Texture {
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

const biomeCache = new Map<BiomeId, BiomeTextureSet>();

/** Generates rich nearest-neighbor 32x32 / 16x16 GBA/PokeBonk-style pixel textures for a biome */
export function getBiomeTextures(biome: BiomeId): BiomeTextureSet {
  const existing = biomeCache.get(biome);
  if (existing) return existing;
  const pal = BIOME_PALETTES[biome];

  // 1. Clean, calm PokéBonk/GBA pixel grass / sand / snow / volcanic ground (64x64 tiled!)
  // Low-contrast base with sparse crisp 'w' blade tufts & delicate micro-clovers so props & Pokémon pop!
  const ground = makePixelCanvas(64, (ctx, s) => {
    const isForest = biome === 'verdant_forest';
    const baseCol = isForest ? '#2e9045' : pal.groundColors[0];
    const softHi = isForest ? '#369d4d' : pal.groundColors[1];
    const bladeDark = isForest ? '#227236' : pal.groundColors[3];
    ctx.fillStyle = baseCol;
    ctx.fillRect(0, 0, s, s);

    // Subtle soft dappled tone patches (4x4 blocks, gentle contrast)
    for (let y = 0; y < s; y += 4) {
      for (let x = 0; x < s; x += 4) {
        if (hash2(x, y) < 230) {
          ctx.fillStyle = softHi;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Crisp sparse 'w'/'v' dark-green pixel grass blade flecks (classic GBA / PokéBonk signature!)
    for (let i = 0; i < 28; i++) {
      const gx = (hash2(i * 13 + 5, 7) % 58) + 2;
      const gy = (hash2(19, i * 17 + 3) % 58) + 2;
      ctx.fillStyle = bladeDark;
      ctx.fillRect(gx, gy, 1, 2);
      ctx.fillRect(gx + 1, gy + 1, 2, 1);
      ctx.fillRect(gx + 3, gy, 1, 2);
      if (i % 3 === 0) {
        ctx.fillRect(gx + 2, gy - 1, 1, 2);
      }
    }

    // Delicate 3x3 white & butter-yellow micro-clover flowers on emerald meadow / coast
    if (biome === 'verdant_forest' || biome === 'storm_coast') {
      const clovers: [number, number, string][] = [
        [10, 14, '#fffdf5'],
        [42, 20, '#fff3bf'],
        [24, 46, '#fffdf5'],
        [52, 52, '#fff3bf'],
      ];
      for (const [fx, fy, col] of clovers) {
        ctx.fillStyle = col;
        ctx.fillRect(fx, fy - 1, 1, 3);
        ctx.fillRect(fx - 1, fy, 3, 1);
        ctx.fillStyle = '#fcc419';
        ctx.fillRect(fx, fy, 1, 1);
      }
    }
    if (biome === 'cinnabar_isle') {
      ctx.fillStyle = '#ff5924';
      ctx.fillRect(14, 22, 8, 2);
      ctx.fillRect(20, 24, 5, 2);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(17, 22, 3, 2);
    }
  });
  ground.repeat.set(1, 1);

  // 2. Authentic Striated Pixel Terraced Cliff Wall (Matches PokeBonk's iconic layered canyon rocks!)
  const cliff = makePixelCanvas(32, (ctx, s) => {
    ctx.fillStyle = pal.cliffColors[0];
    ctx.fillRect(0, 0, s, s);
    // Horizontal strata brick courses with pixel cracks & bevel highlights
    const rows = [0, 8, 16, 24];
    rows.forEach((ry, idx) => {
      // Top bevel highlight
      ctx.fillStyle = pal.cliffColors[2];
      ctx.fillRect(0, ry, s, 2);
      // Mid body with pixel stone dither
      for (let y = ry + 2; y < ry + 7; y++) {
        for (let x = 0; x < s; x++) {
          const h = hash2(x + idx * 17, y);
          ctx.fillStyle =
            h < 220 ? pal.cliffColors[1] : h < 340 ? pal.cliffColors[2] : pal.cliffColors[0];
          ctx.fillRect(x, y, 1, 1);
        }
      }
      // Bottom dark crevice mortar line
      ctx.fillStyle = pal.cliffColors[3];
      ctx.fillRect(0, ry + 7, s, 1);
      // Staggered vertical stone joints
      const offset = (idx % 2) * 8;
      for (let vx = offset; vx < s; vx += 16) {
        ctx.fillStyle = pal.cliffColors[3];
        ctx.fillRect(vx, ry, 1, 8);
        ctx.fillStyle = pal.cliffColors[2];
        ctx.fillRect((vx + 1) % s, ry + 1, 1, 6);
      }
    });
    // Grass/moss overhang lip along the very top of the cliff wall!
    ctx.fillStyle = pal.groundColors[0];
    ctx.fillRect(0, 0, s, 3);
    for (let x = 0; x < s; x += 3) {
      const drop = (hash2(x, 99) % 3) + 1;
      ctx.fillStyle = pal.groundColors[3];
      ctx.fillRect(x, 3, 2, drop);
      ctx.fillStyle = pal.groundColors[2];
      ctx.fillRect(x, 1, 2, 1);
    }
  });

  // 3. Textured Kanto Dirt Road
  const road = makePixelCanvas(32, (ctx, s) => {
    ctx.fillStyle = pal.roadColors[0];
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const h = hash2(x + 71, y + 19);
        if (h < 180) {
          ctx.fillStyle = pal.roadColors[1];
          ctx.fillRect(x, y, 1, 1);
        } else if (h < 280) {
          ctx.fillStyle = pal.roadColors[2];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    // Crisp stone pebbles
    for (const [px, py] of [[5, 8], [19, 14], [11, 25], [26, 22]]) {
      ctx.fillStyle = pal.roadColors[1];
      ctx.fillRect(px, py, 3, 2);
      ctx.fillStyle = pal.roadColors[2];
      ctx.fillRect(px, py, 2, 1);
    }
  });

  // 4. Safe Zone Cobblestone Plaza Tile
  const plaza = makePixelCanvas(32, (ctx, s) => {
    ctx.fillStyle = '#ece4ce';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      for (let x = 0; x < s; x += 8) {
        const ox = ((y / 8) % 2) * 4;
        const tx = (x + ox) % s;
        ctx.fillStyle = '#f6f0df';
        ctx.fillRect(tx + 1, y + 1, 6, 6);
        ctx.fillStyle = '#c8bea4';
        ctx.fillRect(tx, y, 8, 1);
        ctx.fillRect(tx, y, 1, 8);
      }
    }
  });
  plaza.repeat.set(4, 4);

  // 5. Pixel Tree Canopy Foliage Texture
  const foliage = makePixelCanvas(16, (ctx, s) => {
    ctx.fillStyle = pal.foliageColors[1];
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const h = hash2(x + 33, y + 91);
        if (h < 300) {
          ctx.fillStyle = pal.foliageColors[0];
          ctx.fillRect(x, y, 2, 2);
        } else if (h < 540) {
          ctx.fillStyle = pal.foliageColors[2];
          ctx.fillRect(x, y, 2, 1);
        }
      }
    }
    // Dark pixel leaf clusters for depth
    ctx.fillStyle = pal.foliageColors[0];
    ctx.fillRect(0, s - 2, s, 2);
  });

  // 6. Pixel Bark Trunk Texture
  const trunk = makePixelCanvas(16, (ctx, s) => {
    ctx.fillStyle = pal.trunkColor;
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, 0, 1, s);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 1, 0, 1, s);
    }
  });

  // 7. Transparent Pixel Grass Tuft Billboard (16x16)
  const grassTuft = makePixelCanvas(16, (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    const drawBlade = (bx: number, h: number, lean: number) => {
      ctx.fillStyle = '#183820';
      ctx.fillRect(bx - 1, 16 - h, 4, h);
      ctx.fillStyle = pal.foliageColors[0];
      ctx.fillRect(bx, 16 - h + 2, 2, h - 2);
      ctx.fillStyle = pal.foliageColors[2];
      ctx.fillRect(bx + lean, 16 - h, 2, Math.max(2, h - 4));
    };
    drawBlade(3, 9, -1);
    drawBlade(7, 12, 0);
    drawBlade(11, 8, 1);
  });
  grassTuft.wrapS = THREE.ClampToEdgeWrapping;
  grassTuft.wrapT = THREE.ClampToEdgeWrapping;

  // Helper: 1px crisp dark pixel outline pass for high-craft GBA/SNES flora sprites
  const outlineSprite = (ctx: CanvasRenderingContext2D, s: number, hex = '#14141c') => {
    const img = ctx.getImageData(0, 0, s, s);
    const src = new Uint8ClampedArray(img.data);
    const c = new THREE.Color(hex);
    const or = Math.round(c.r * 255);
    const og = Math.round(c.g * 255);
    const ob = Math.round(c.b * 255);
    const solid = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < s && y < s && src[(y * s + x) * 4 + 3] > 90;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const i = (y * s + x) * 4;
        if (src[i + 3] > 90) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          img.data[i] = or;
          img.data[i + 1] = og;
          img.data[i + 2] = ob;
          img.data[i + 3] = 250;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  const fillDisc = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    col: string,
  ) => {
    ctx.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.0) {
          ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
        }
      }
    }
  };

  // 8. Hero 32x32 Red-and-White Spotted Toadstool Cluster (3 grouped mushrooms, 4-tone shading, crisp outline!)
  const mushroom = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const drawToad = (cx: number, botY: number, capRx: number, capRy: number, stemW: number, stemH: number) => {
      // Stout cream stem with warm shadow
      ctx.fillStyle = '#f8f0dc';
      ctx.fillRect(Math.round(cx - stemW / 2), botY - stemH, stemW, stemH);
      ctx.fillStyle = '#d9cab0';
      ctx.fillRect(Math.round(cx + stemW * 0.1), botY - stemH, Math.ceil(stemW * 0.4), stemH);
      // Gill underside
      fillDisc(ctx, cx, botY - stemH + 1, capRx - 1, Math.max(2, capRy * 0.45), '#dfd1b6');
      // Vibrant red dome cap (dark rim -> vivid red -> sunlit coral top)
      const capY = botY - stemH - Math.round(capRy * 0.45);
      fillDisc(ctx, cx, capY, capRx, capRy, '#a61e22');
      fillDisc(ctx, cx, capY - 1, capRx - 0.8, capRy - 0.8, '#e6332a');
      fillDisc(ctx, cx - 1, capY - 2, capRx * 0.7, capRy * 0.65, '#ff5947');
      // Crisp white spots
      fillDisc(ctx, cx - capRx * 0.42, capY - 1, Math.max(1.3, capRx * 0.22), Math.max(1.1, capRy * 0.24), '#ffffff');
      fillDisc(ctx, cx + capRx * 0.34, capY - 2, Math.max(1.4, capRx * 0.24), Math.max(1.2, capRy * 0.26), '#ffffff');
      if (capRx >= 7) {
        fillDisc(ctx, cx, capY + 1, 1.5, 1.2, '#fff5f5');
      }
    };
    drawToad(11, 29, 8.5, 6.2, 6, 10);
    drawToad(22, 30, 6.2, 4.6, 5, 7);
    drawToad(6, 30, 4.2, 3.2, 3, 4);
    outlineSprite(ctx, s, '#14141c');
  });
  mushroom.wrapS = THREE.ClampToEdgeWrapping;
  mushroom.wrapT = THREE.ClampToEdgeWrapping;

  // 9. Lush 32x32 Sunny Daisy & Wildflower Meadow Clump (Dense leafy rosette + bold multi-petal blooms!)
  const flower = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    // Lush sunlit emerald leaf cluster base
    fillDisc(ctx, 16, 25, 11, 5, '#1d6928');
    fillDisc(ctx, 11, 23, 6, 4, '#2f9438');
    fillDisc(ctx, 21, 23, 6, 4, '#2f9438');
    fillDisc(ctx, 16, 22, 7, 3.5, '#4ec244');
    // Stems
    ctx.fillStyle = '#20732c';
    ctx.fillRect(9, 14, 2, 10);
    ctx.fillRect(16, 11, 2, 12);
    ctx.fillRect(22, 15, 2, 9);
    const drawBloom = (cx: number, cy: number, petal: string, hi: string, core: string) => {
      fillDisc(ctx, cx - 3, cy, 2.2, 2.0, petal);
      fillDisc(ctx, cx + 3, cy, 2.2, 2.0, petal);
      fillDisc(ctx, cx, cy - 3, 2.0, 2.2, hi);
      fillDisc(ctx, cx, cy + 2.5, 2.0, 2.0, petal);
      fillDisc(ctx, cx, cy, 2.0, 1.8, core);
    };
    drawBloom(10, 14, '#ffffff', '#ffffff', '#ffd43b');
    drawBloom(17, 10, '#ffffff', '#fff9db', '#ff922b');
    drawBloom(23, 15, pal.accentFlower[0], '#ffa8a8', '#ffe066');
    drawBloom(15, 20, pal.accentFlower[1], '#fff3bf', '#f08c00');
    outlineSprite(ctx, s, '#14141c');
  });
  flower.wrapS = THREE.ClampToEdgeWrapping;
  flower.wrapT = THREE.ClampToEdgeWrapping;

  // 10. Layered 32x32 Scalloped Sunlit Berry Shrub (5-puff rich canopy + bright berries + crisp outline!)
  const bush = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    fillDisc(ctx, 16, 22, 12, 7, '#185424');
    fillDisc(ctx, 9, 20, 7, 6, pal.foliageColors[0]);
    fillDisc(ctx, 23, 20, 7, 6, pal.foliageColors[0]);
    fillDisc(ctx, 16, 16, 10, 7, pal.foliageColors[1]);
    fillDisc(ctx, 11, 14, 6, 4.5, pal.foliageColors[2]);
    fillDisc(ctx, 20, 15, 5.5, 4, pal.foliageColors[2]);
    fillDisc(ctx, 15, 11, 5, 3, '#94f06b');
    // Glossy colorful berries
    const berries = [
      [10, 19],
      [17, 21],
      [22, 18],
      [14, 15],
    ];
    for (const [bx, by] of berries) {
      fillDisc(ctx, bx, by, 1.8, 1.8, pal.accentFlower[0]);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx - 1, by - 1, 1, 1);
    }
    outlineSprite(ctx, s, '#14141c');
  });
  bush.wrapS = THREE.ClampToEdgeWrapping;
  bush.wrapT = THREE.ClampToEdgeWrapping;

  // 10B. Vibrant 32x32 Bluebell, Lavender & White Daisy Bouquet
  const flowerAlt = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    fillDisc(ctx, 16, 25, 11, 5, '#1d6928');
    fillDisc(ctx, 12, 23, 6, 3.5, '#3eab38');
    fillDisc(ctx, 20, 23, 6, 3.5, '#3eab38');
    ctx.fillStyle = '#20732c';
    ctx.fillRect(9, 15, 2, 9);
    ctx.fillRect(15, 11, 2, 13);
    ctx.fillRect(22, 14, 2, 10);
    const drawBloom = (cx: number, cy: number, p1: string, p2: string, core: string) => {
      fillDisc(ctx, cx - 2.6, cy, 2.0, 1.8, p1);
      fillDisc(ctx, cx + 2.6, cy, 2.0, 1.8, p1);
      fillDisc(ctx, cx, cy - 2.6, 1.9, 2.0, p2);
      fillDisc(ctx, cx, cy + 2.2, 1.9, 1.8, p1);
      fillDisc(ctx, cx, cy, 1.8, 1.6, core);
    };
    drawBloom(10, 15, '#339af0', '#74c0fc', '#fff3bf');
    drawBloom(16, 11, '#74c0fc', '#d0ebff', '#ffd43b');
    drawBloom(23, 15, '#cc5de8', '#eebefa', '#fff3bf');
    drawBloom(17, 20, '#ffffff', '#ffffff', '#ffd43b');
    outlineSprite(ctx, s, '#14141c');
  });
  flowerAlt.wrapS = THREE.ClampToEdgeWrapping;
  flowerAlt.wrapT = THREE.ClampToEdgeWrapping;

  // 10C. 32x32 Golden Chestnut Woodland Mushroom Trio
  const mushroomAlt = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const drawWood = (cx: number, botY: number, rx: number, ry: number, sw: number, sh: number) => {
      ctx.fillStyle = '#f3e5c8';
      ctx.fillRect(Math.round(cx - sw / 2), botY - sh, sw, sh);
      ctx.fillStyle = '#cfb997';
      ctx.fillRect(Math.round(cx + sw * 0.1), botY - sh, Math.ceil(sw * 0.4), sh);
      const cy = botY - sh - Math.round(ry * 0.4);
      fillDisc(ctx, cx, cy + 1, rx - 1, ry * 0.5, '#c9a678');
      fillDisc(ctx, cx, cy, rx, ry, '#8f5228');
      fillDisc(ctx, cx, cy - 1, rx - 0.8, ry - 0.8, '#c77a38');
      fillDisc(ctx, cx - 1, cy - 2, rx * 0.65, ry * 0.58, '#f0ae5d');
    };
    drawWood(12, 29, 7.8, 5.5, 5, 10);
    drawWood(22, 30, 5.5, 4.2, 4, 7);
    drawWood(7, 30, 3.8, 2.8, 3, 4);
    outlineSprite(ctx, s, '#14141c');
  });
  mushroomAlt.wrapS = THREE.ClampToEdgeWrapping;
  mushroomAlt.wrapT = THREE.ClampToEdgeWrapping;

  // 10D. Lush 32x32 GBA Serrated Emerald Tall Grass & Fern Clump (7 sunlit curved blades + bold outline!)
  const tallGrass = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const drawBlade = (bx: number, h: number, tilt: number, c0: string, c1: string, c2: string) => {
      for (let i = 0; i < h; i++) {
        const t = i / h;
        const px = Math.round(bx + t * t * tilt);
        const py = 29 - i;
        const w = t > 0.72 ? 1 : t > 0.35 ? 2 : 3;
        ctx.fillStyle = t > 0.62 ? c2 : t > 0.25 ? c1 : c0;
        ctx.fillRect(px, py, w, 1);
      }
    };
    drawBlade(6, 15, -5, '#195c26', pal.foliageColors[0], pal.foliageColors[1]);
    drawBlade(10, 20, -3, '#195c26', pal.foliageColors[1], '#8ce96a');
    drawBlade(14, 23, -1, pal.foliageColors[0], pal.foliageColors[1], '#9cf272');
    drawBlade(18, 22, 2, pal.foliageColors[0], pal.foliageColors[2], '#9cf272');
    drawBlade(22, 17, 5, '#195c26', pal.foliageColors[1], pal.foliageColors[2]);
    drawBlade(12, 13, 1, pal.foliageColors[1], pal.foliageColors[2], '#b2f788');
    drawBlade(20, 12, -1, pal.foliageColors[1], pal.foliageColors[2], '#b2f788');
    outlineSprite(ctx, s, '#122616');
  });
  tallGrass.wrapS = THREE.ClampToEdgeWrapping;
  tallGrass.wrapT = THREE.ClampToEdgeWrapping;

  // 10E. Mossy Stratified Pixel Boulder (24x24)
  const boulder = makePixelCanvas(24, (ctx) => {
    ctx.clearRect(0, 0, 24, 24);
    const fillOval = (cx: number, cy: number, rx: number, ry: number, col: string) => {
      ctx.fillStyle = col;
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
            ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
          }
        }
      }
    };
    fillOval(12, 15, 10, 7, '#1c1a22');
    fillOval(12, 15, 8.8, 5.8, pal.cliffColors[1]);
    fillOval(11, 13, 7.2, 4.2, pal.cliffColors[0]);
    fillOval(9, 11, 4.2, 2.2, '#e2dfd5');
    // Crack + moss cap
    ctx.fillStyle = pal.cliffColors[2];
    ctx.fillRect(13, 14, 1, 4);
    ctx.fillRect(14, 16, 2, 1);
    if (biome === 'verdant_forest' || biome === 'storm_coast') {
      fillOval(10, 10, 4.5, 1.8, pal.foliageColors[1]);
      ctx.fillStyle = pal.foliageColors[2];
      ctx.fillRect(8, 9, 3, 1);
    } else if (biome === 'sky_glacier') {
      fillOval(10, 10, 5, 2, '#eef7fc');
    }
  });
  boulder.wrapS = THREE.ClampToEdgeWrapping;
  boulder.wrapT = THREE.ClampToEdgeWrapping;

  // 10F. Classic GBA Forest Tree Stump with Wood Rings & Tiny Sprout (24x24)
  const stump = makePixelCanvas(24, (ctx) => {
    ctx.clearRect(0, 0, 24, 24);
    ctx.fillStyle = '#1b1614';
    ctx.fillRect(5, 11, 14, 10);
    ctx.fillRect(3, 18, 18, 4);
    ctx.fillStyle = pal.trunkColor;
    ctx.fillRect(6, 12, 12, 8);
    ctx.fillRect(4, 19, 16, 2);
    // Bark highlights & grooves
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.fillRect(9, 13, 1, 7);
    ctx.fillRect(14, 13, 2, 7);
    // Cut top with rings
    ctx.fillStyle = '#1b1614';
    ctx.fillRect(6, 9, 12, 4);
    ctx.fillStyle = '#e6cca0';
    ctx.fillRect(7, 10, 10, 2);
    ctx.fillStyle = '#b08968';
    ctx.fillRect(10, 10, 4, 1);
    // Cute green sprout on side
    ctx.fillStyle = '#184024';
    ctx.fillRect(16, 8, 5, 4);
    ctx.fillStyle = pal.foliageColors[2];
    ctx.fillRect(17, 9, 3, 2);
  });
  stump.wrapS = THREE.ClampToEdgeWrapping;
  stump.wrapT = THREE.ClampToEdgeWrapping;

  // 10G. Iconic Kanto Wooden Route Signpost (24x24)
  const signpost = makePixelCanvas(24, (ctx) => {
    ctx.clearRect(0, 0, 24, 24);
    // Post
    ctx.fillStyle = '#1b1614';
    ctx.fillRect(10, 12, 4, 11);
    ctx.fillStyle = '#7f5539';
    ctx.fillRect(11, 13, 2, 9);
    // Wooden signboard
    ctx.fillStyle = '#1b1614';
    ctx.fillRect(3, 3, 18, 11);
    ctx.fillStyle = '#ddb892';
    ctx.fillRect(4, 4, 16, 9);
    ctx.fillStyle = '#ede0d4';
    ctx.fillRect(4, 4, 16, 2);
    ctx.fillStyle = '#7f5539';
    ctx.fillRect(6, 7, 10, 1);
    ctx.fillRect(6, 9, 7, 1);
    ctx.fillRect(6, 11, 11, 1);
  });
  signpost.wrapS = THREE.ClampToEdgeWrapping;
  signpost.wrapT = THREE.ClampToEdgeWrapping;

  // 11. SIX NATURAL ORGANIC GBA / SNES 64x80 HAND-DITHERED PIXEL-ART TREE SPECIES!
  // 5-tone sunlit-to-deep-teal shading, irregular leafy sub-clusters, dithered leaf edges & organic curved trunks
  const makeTreeCanvas = (drawFn: (tctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 80;
    const tctx = c.getContext('2d')!;
    tctx.imageSmoothingEnabled = false;
    tctx.clearRect(0, 0, 64, 80);
    drawFn(tctx, 64, 80);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  const TREE_BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  // 5-tone warm sunlit-to-deep-teal foliage ramp: [deepShadow, shadedEmerald, midGreen, sunlitGreen, brightTip]
  const foliageRamp: [string, string, string, string, string] =
    biome === 'rocky_desert'
      ? ['#224d26', '#3a7a34', '#5ca647', '#9ad459', '#dbf078']
      : biome === 'storm_coast'
        ? ['#113c3a', '#1d695c', '#2f9679', '#62c997', '#b2f0be']
        : biome === 'sky_glacier'
          ? ['#1b4552', '#2b6b78', '#4498a3', '#9fd8e3', '#eef9ff']
          : biome === 'cinnabar_isle'
            ? ['#42161c', '#7a2523', '#bd4322', '#f07b2b', '#ffd452']
            : ['#144a2c', '#23803c', '#3eb549', '#8ee352', '#d0f24b'];

  const blossomRamp: [string, string, string, string, string] =
    biome === 'cinnabar_isle'
      ? ['#5c1218', '#9c2224', '#de4820', '#ff8c38', '#ffe375']
      : biome === 'rocky_desert'
        ? ['#8a3c00', '#c76108', '#f2931d', '#ffd052', '#fff6bd']
        : ['#8f2454', '#c43b72', '#eb6ca0', '#ffa8cc', '#fff0f7'];

  const barkRamp: [string, string, string, string] =
    biome === 'cinnabar_isle'
      ? ['#1d1519', '#2f2226', '#4a3538', '#6e4e4a']
      : biome === 'sky_glacier'
        ? ['#2d2422', '#4d3e38', '#6e5a50', '#967d6e']
        : ['#2c1a12', '#4f311e', '#7b4f2e', '#b07b4d'];

  const applyTreeOutline = (tctx: CanvasRenderingContext2D, w: number, h: number, hex = '#131f18') => {
    const img = tctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(img.data);
    const c = new THREE.Color(hex);
    const or = Math.round(c.r * 255);
    const og = Math.round(c.g * 255);
    const ob = Math.round(c.b * 255);
    const solid = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 90;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] > 90) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          img.data[i] = or;
          img.data[i + 1] = og;
          img.data[i + 2] = ob;
          img.data[i + 3] = 252;
        }
      }
    }
    tctx.putImageData(img, 0, 0);
  };

  /** Natural gently curving organic tree trunk with flared roots, mossy base shadow & warm/cool bark ridges */
  const paintOrganicTrunk = (
    tctx: CanvasRenderingContext2D,
    baseCx: number,
    topY: number,
    botY: number,
    baseHalfW: number,
    opts?: { bend?: number; lean?: number; seed?: number; branches?: [number, number, number, number, number][] },
  ) => {
    const bend = opts?.bend ?? 2.2;
    const lean = opts?.lean ?? 1.2;
    const seed = opts?.seed ?? 1;
    const spanY = Math.max(1, botY - topY);

    // Optional upper branches reaching into the canopy
    if (opts?.branches) {
      for (const [x0, y0, x1, y1, thick] of opts.branches) {
        const steps = Math.max(8, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const bx = Math.round(x0 + (x1 - x0) * u);
          const by = Math.round(y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 1.5);
          const bw = Math.max(2, Math.round(thick * (1 - u * 0.45)));
          for (let dx = -Math.floor(bw / 2); dx <= Math.floor(bw / 2); dx++) {
            const col = dx < 0 ? barkRamp[3] : dx === 0 ? barkRamp[2] : barkRamp[1];
            tctx.fillStyle = col;
            tctx.fillRect(bx + dx, by, 1, 2);
          }
        }
      }
    }

    // Main gently curving slender trunk shaft + graceful tapered root flare
    for (let y = topY; y <= botY; y++) {
      const t = (y - topY) / spanY; // 0 = top, 1 = ground base
      const spineX = baseCx + Math.sin(t * Math.PI * 1.15 + seed) * bend + (1 - t) * lean;
      const rootT = Math.max(0, (t - 0.70) / 0.30);
      const flare = rootT * rootT * (baseHalfW * 0.58 + 1.4);
      const taper = 0.68 + t * 0.32;
      const halfW = baseHalfW * taper + flare;
      const xStart = Math.round(spineX - halfW);
      const xEnd = Math.round(spineX + halfW);

      for (let x = xStart; x <= xEnd; x++) {
        if (x < 2 || x > 61 || y < 2 || y > 77) continue;
        // Subtle organic root notches at very bottom 3px
        const rel = (x - spineX) / Math.max(1, halfW);
        if (y >= botY - 2) {
          const notchA = Math.abs(rel + 0.34) < 0.14 && y >= botY - 1;
          const notchB = Math.abs(rel - 0.36) < 0.14 && y >= botY;
          if (notchA || notchB) continue;
        }
        // Bark lighting (sunlit warm left -> mid -> cool shaded right) + curving bark ridges
        const ridgeWave = Math.sin((x - spineX) * 1.55 + Math.sin(y * 0.24 + seed) * 1.1);
        const h = hash2(x + seed * 13, y);
        let col = barkRamp[2];
        if (rel < -0.45) {
          col = h < 680 ? barkRamp[3] : barkRamp[2];
        } else if (rel < 0.12) {
          col = ridgeWave < -0.58 ? barkRamp[1] : ridgeWave > 0.62 && h < 520 ? barkRamp[3] : barkRamp[2];
        } else if (rel < 0.58) {
          col = ridgeWave < -0.48 ? barkRamp[0] : barkRamp[1];
        } else {
          col = h < 580 ? barkRamp[0] : barkRamp[1];
        }
        // Deep canopy cast shadow under the crown neck
        if (y < topY + 5 && ((x + y) & 1) === 0) {
          col = barkRamp[0];
        }
        tctx.fillStyle = col;
        tctx.fillRect(x, y, 1, 1);
      }
    }

    // Soft mossy base shadow tufts hugging the slender root flare
    const mossY = botY - 2;
    for (let mx = Math.round(baseCx - baseHalfW - 3); mx <= Math.round(baseCx + baseHalfW + 3); mx++) {
      if (mx < 2 || mx > 61) continue;
      const dist = Math.abs(mx - baseCx);
      const h = hash2(mx + seed * 29, mossY);
      if (dist > baseHalfW * 0.4 && dist < baseHalfW + 2.8 && h < 480) {
        tctx.fillStyle = h < 240 ? foliageRamp[0] : foliageRamp[1];
        tctx.fillRect(mx, mossY + (h % 2), 2, 1);
        if (h < 160) {
          tctx.fillStyle = foliageRamp[2];
          tctx.fillRect(mx, mossY - 1, 1, 1);
        }
      }
    }
  };

  /**
   * Paints an organic irregular leafy sub-cluster with 5-tone warm sunlit-to-deep-teal shading,
   * ordered Bayer dithering between tones, and jagged 1-2px pixel-dithered leaf edges!
   */
  const paintOrganicCluster = (
    tctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    ramp: [string, string, string, string, string],
    seed: number,
    lightBias = 0,
  ) => {
    const padX = Math.ceil(rx * 1.28) + 2;
    const padY = Math.ceil(ry * 1.28) + 2;
    for (let dy = -padY; dy <= padY; dy++) {
      for (let dx = -padX; dx <= padX; dx++) {
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px < 2 || px > 61 || py < 2 || py > 77) continue;

        const nx = dx / rx;
        const ny = dy / ry;
        const ang = Math.atan2(ny, nx);
        // Multi-harmonic irregular botanical silhouette (breaks up smooth ellipses!)
        const wobble =
          1.0 +
          0.16 * Math.sin(ang * 3 + seed * 1.3) +
          0.11 * Math.cos(ang * 5 - seed * 2.1) +
          0.07 * Math.sin(ang * 7 + seed * 0.7);
        const rNorm = Math.hypot(nx, ny) / wobble;

        if (rNorm > 1.07) continue;

        // Pixel-dithered leafy edges (organic 1-2px leaf notches & tips)
        const h = hash2(px + seed * 37, py + seed * 17);
        if (rNorm > 0.87) {
          const edgeKeep = (1.07 - rNorm) / 0.2;
          if (h / 1000 > edgeKeep * 1.15) continue;
        }

        // Directional 5-tone lighting (warm sun from upper-left (-0.62, -0.78))
        const dirDot = -nx * 0.62 - ny * 0.78;
        // Micro leaf-tuft dimpling inside the cluster for hand-pixeled botanical depth
        const tuft = Math.sin(px * 0.68 + seed) * Math.cos(py * 0.62 - seed * 0.5) * 0.14;
        const rawLight = 0.52 + dirDot * 0.42 + lightBias + tuft - Math.max(0, rNorm - 0.68) * 0.34;
        const clamped = Math.max(0, Math.min(0.999, rawLight));

        // 5-band Bayer 4x4 dithered quantization
        const scaled = clamped * 4.0;
        const band = Math.floor(scaled);
        const frac = scaled - band;
        const thresh = (TREE_BAYER4[py & 3][px & 3] + 0.5) / 16;
        const toneIdx = Math.min(4, band + (frac > thresh ? 1 : 0));

        tctx.fillStyle = ramp[toneIdx];
        tctx.fillRect(px, py, 1, 1);
      }
    }
  };

  /** Scatters delicate 1-2px detached leaf speckles & sunlit leaf tips around a canopy */
  const scatterLeafSpeckles = (
    tctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    ramp: [string, string, string, string, string],
    count: number,
    seed: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const a = (hash2(i, seed * 11) / 1000) * Math.PI * 2;
      const dist = 0.72 + (hash2(i, seed * 23) / 1000) * 0.42;
      const lx = Math.round(cx + Math.cos(a) * rx * dist);
      const ly = Math.round(cy + Math.sin(a) * ry * dist);
      if (lx < 2 || lx > 60 || ly < 2 || ly > 75) continue;
      const isUpperLeft = lx < cx + 2 && ly < cy + 2;
      const col = isUpperLeft
        ? i % 3 === 0
          ? ramp[4]
          : ramp[3]
        : ly > cy + ry * 0.35
          ? ramp[0]
          : i % 2 === 0
            ? ramp[1]
            : ramp[2];
      tctx.fillStyle = col;
      tctx.fillRect(lx, ly, i % 3 === 0 ? 2 : 1, 1);
      if (i % 4 === 0) tctx.fillRect(lx, ly + 1, 1, 1);
    }
  };

  const treeOutlineHex = biome === 'cinnabar_isle' ? '#211214' : '#131f18';

  // TREE VARIANT 0: Lush Organic Hand-Dithered Broadleaf Oak (Slim Tapered Trunk + Fuller Multi-Cluster Canopy!)
  const treeOak = makeTreeCanvas((tctx, w, h) => {
    paintOrganicTrunk(tctx, 32, 43, 75, 3.8, {
      bend: 1.8,
      lean: -0.9,
      seed: 3,
      branches: [
        [31, 49, 22, 40, 3],
        [33, 48, 42, 40, 3],
      ],
    });
    // Back deep-shadow under-clusters (fuller canopy overhang)
    paintOrganicCluster(tctx, 17, 42, 12, 8.5, foliageRamp, 11, -0.34);
    paintOrganicCluster(tctx, 47, 43, 12, 8.5, foliageRamp, 17, -0.38);
    paintOrganicCluster(tctx, 32, 44, 15, 8.5, foliageRamp, 23, -0.32);
    // Mid-layer asymmetrical leaf mounds
    paintOrganicCluster(tctx, 16, 32, 12, 9.5, foliageRamp, 31, -0.02);
    paintOrganicCluster(tctx, 46, 34, 12, 9.5, foliageRamp, 37, -0.16);
    paintOrganicCluster(tctx, 31, 33, 15, 10.5, foliageRamp, 41, -0.04);
    // Sunlit upper-left & crown sub-clusters
    paintOrganicCluster(tctx, 22, 22, 11.5, 9, foliageRamp, 47, 0.16);
    paintOrganicCluster(tctx, 40, 23, 10.5, 8.5, foliageRamp, 53, 0.02);
    paintOrganicCluster(tctx, 30, 14, 11.5, 8, foliageRamp, 59, 0.22);
    paintOrganicCluster(tctx, 24, 16, 7.5, 5.5, foliageRamp, 67, 0.30);
    scatterLeafSpeckles(tctx, 31, 29, 25, 19, foliageRamp, 36, 71);
    applyTreeOutline(tctx, w, h, treeOutlineHex);
  });

  // TREE VARIANT 1: Organic Layered Alpine Pine (Drooping Irregular Boughs & Needle Tufts — NEVER a Rigid Triangle!)
  const treePine = makeTreeCanvas((tctx, w, h) => {
    paintOrganicTrunk(tctx, 32, 49, 76, 3.2, { bend: 1.2, lean: 0.7, seed: 5 });

    // Helper: organic drooping bough tier made of arching needle fronds + notched underside
    const paintBoughTier = (
      cy: number,
      spreadX: number,
      droopY: number,
      seed: number,
      lightBoost: number,
    ) => {
      // Deep shadow undersides tucked beneath the boughs
      paintOrganicCluster(tctx, 32 - spreadX * 0.62, cy + droopY + 2, spreadX * 0.44, 4.6, foliageRamp, seed + 1, -0.36 + lightBoost);
      paintOrganicCluster(tctx, 32 + spreadX * 0.62, cy + droopY + 2, spreadX * 0.44, 4.6, foliageRamp, seed + 2, -0.40 + lightBoost);
      paintOrganicCluster(tctx, 32, cy + droopY + 3, spreadX * 0.56, 4.8, foliageRamp, seed + 3, -0.34 + lightBoost);

      // Sweeping left/center/right feathery needle fronds
      paintOrganicCluster(tctx, 32 - spreadX * 0.68, cy + droopY - 1, spreadX * 0.42, 4.4, foliageRamp, seed + 4, 0.06 + lightBoost);
      paintOrganicCluster(tctx, 32 + spreadX * 0.66, cy + droopY, spreadX * 0.40, 4.2, foliageRamp, seed + 5, -0.14 + lightBoost);
      paintOrganicCluster(tctx, 32 - spreadX * 0.24, cy, spreadX * 0.45, 5.4, foliageRamp, seed + 6, 0.14 + lightBoost);
      paintOrganicCluster(tctx, 32 + spreadX * 0.22, cy + 1, spreadX * 0.42, 5.0, foliageRamp, seed + 7, -0.06 + lightBoost);

      // Hanging irregular needle tip sprigs along the lower edge
      const sprigCount = Math.max(4, Math.round(spreadX / 3.2));
      for (let i = 0; i < sprigCount; i++) {
        const u = (i / (sprigCount - 1)) * 2 - 1;
        const sx = Math.round(32 + u * spreadX * 0.88);
        const sy = Math.round(cy + droopY + 3 + (hash2(i, seed * 19) % 4));
        if (sx < 3 || sx > 60 || sy > 74) continue;
        const col = u < -0.2 ? foliageRamp[1] : foliageRamp[0];
        tctx.fillStyle = col;
        tctx.fillRect(sx, sy, 2, 2);
        tctx.fillRect(sx + (u < 0 ? -1 : 1), sy + 2, 1, 2);
      }
    };

    paintBoughTier(46, 22, 5, 101, -0.06);
    paintBoughTier(34, 18, 4.5, 131, 0.02);
    paintBoughTier(22, 13.5, 4, 157, 0.10);
    // Feathery asymmetrical conifer crown spire
    paintOrganicCluster(tctx, 31, 13, 8, 6.5, foliageRamp, 179, 0.18);
    paintOrganicCluster(tctx, 32, 7, 4.2, 4.5, foliageRamp, 193, 0.28);
    scatterLeafSpeckles(tctx, 32, 33, 21, 24, foliageRamp, 26, 211);
    applyTreeOutline(tctx, w, h, treeOutlineHex);
  });

  // TREE VARIANT 2: Organic Orchard Fruit Tree (Slender Trunk + Delicate Tiny 2x2 / 3x2 Sunlit Fruit Clusters!)
  const treeBerry = makeTreeCanvas((tctx, w, h) => {
    paintOrganicTrunk(tctx, 32, 43, 75, 3.8, {
      bend: -1.9,
      lean: 0.9,
      seed: 9,
      branches: [
        [31, 49, 20, 39, 3],
        [33, 48, 44, 39, 3],
      ],
    });
    paintOrganicCluster(tctx, 16, 40, 12.5, 9, foliageRamp, 223, -0.26);
    paintOrganicCluster(tctx, 48, 41, 12.5, 9, foliageRamp, 229, -0.32);
    paintOrganicCluster(tctx, 32, 42, 16, 9, foliageRamp, 233, -0.24);
    paintOrganicCluster(tctx, 18, 29, 12.5, 9.5, foliageRamp, 239, 0.04);
    paintOrganicCluster(tctx, 45, 30, 12, 9.5, foliageRamp, 241, -0.10);
    paintOrganicCluster(tctx, 32, 26, 15.5, 11, foliageRamp, 251, 0.06);
    paintOrganicCluster(tctx, 26, 17, 11.5, 8.5, foliageRamp, 257, 0.22);
    paintOrganicCluster(tctx, 39, 19, 10, 7.5, foliageRamp, 263, 0.08);
    scatterLeafSpeckles(tctx, 32, 30, 26, 18, foliageRamp, 30, 269);

    // Delicate, tiny natural 2x2 / 3x2 sunlit fruit clusters nestled softly in the leaves (NO dark boxes!)
    const paintDelicateFruit = (
      fx: number,
      fy: number,
      wide: boolean,
      hiCol: string,
      midCol: string,
      shadeCol: string,
    ) => {
      // Subtle 1px leaf-cradle shadow tucked right under the fruit
      tctx.fillStyle = foliageRamp[0];
      tctx.fillRect(fx, fy + 2, wide ? 3 : 2, 1);
      // Natural warm fruit body
      tctx.fillStyle = midCol;
      tctx.fillRect(fx, fy, wide ? 3 : 2, 2);
      // Lower-right shaded curve
      tctx.fillStyle = shadeCol;
      tctx.fillRect(fx + (wide ? 2 : 1), fy + 1, 1, 1);
      if (wide) tctx.fillRect(fx + 1, fy + 1, 1, 1);
      // Tiny sunlit upper-left specular highlight
      tctx.fillStyle = hiCol;
      tctx.fillRect(fx, fy, 1, 1);
    };

    const fruits: [number, number, boolean, 'crimson' | 'peach'][] = [
      [15, 33, true, 'crimson'],
      [18, 35, false, 'peach'],
      [26, 24, true, 'peach'],
      [29, 26, false, 'crimson'],
      [42, 30, true, 'crimson'],
      [45, 32, false, 'crimson'],
      [34, 16, false, 'peach'],
      [21, 20, false, 'crimson'],
      [48, 38, true, 'peach'],
      [14, 41, false, 'peach'],
      [36, 36, true, 'crimson'],
      [29, 34, false, 'peach'],
    ];
    for (const [fx, fy, wide, kind] of fruits) {
      if (kind === 'crimson') {
        paintDelicateFruit(fx, fy, wide, '#ffd1d4', '#e84855', '#a62634');
      } else {
        paintDelicateFruit(fx, fy, wide, '#fff3cc', '#ff9b54', '#cc6229');
      }
    }
    applyTreeOutline(tctx, w, h, treeOutlineHex);
  });

  // TREE VARIANT 3: Ancient Gnarled Forest Elder (Graceful Slim Curved Trunk + Grand Twin-Crown Canopy + Vines!)
  const treeElder = makeTreeCanvas((tctx, w, h) => {
    paintOrganicTrunk(tctx, 29, 41, 76, 4.5, {
      bend: 2.8,
      lean: -1.6,
      seed: 14,
      branches: [
        [31, 49, 47, 38, 3.5],
        [27, 46, 16, 35, 3],
      ],
    });
    // Right secondary sweeping crown
    paintOrganicCluster(tctx, 47, 41, 12.5, 8.5, foliageRamp, 307, -0.30);
    paintOrganicCluster(tctx, 46, 34, 13, 9, foliageRamp, 311, -0.06);
    paintOrganicCluster(tctx, 43, 29, 9.5, 6.5, foliageRamp, 313, 0.12);
    // Grand primary left-center crown
    paintOrganicCluster(tctx, 17, 37, 13.5, 9.5, foliageRamp, 317, -0.24);
    paintOrganicCluster(tctx, 31, 36, 13.5, 9.5, foliageRamp, 331, -0.22);
    paintOrganicCluster(tctx, 19, 26, 14, 10, foliageRamp, 337, 0.08);
    paintOrganicCluster(tctx, 33, 24, 13.5, 9.5, foliageRamp, 347, 0.02);
    paintOrganicCluster(tctx, 24, 14, 13, 8.5, foliageRamp, 349, 0.24);
    paintOrganicCluster(tctx, 18, 17, 7.5, 5.5, foliageRamp, 353, 0.32);

    // Delicate dithered mossy hanging vines
    const vines: [number, number, number][] = [
      [12, 43, 9],
      [15, 45, 6],
      [51, 46, 8],
      [47, 48, 5],
    ];
    for (const [vx, vy, vLen] of vines) {
      for (let i = 0; i < vLen; i++) {
        tctx.fillStyle = i < 2 ? foliageRamp[2] : i < vLen - 2 ? foliageRamp[1] : foliageRamp[0];
        tctx.fillRect(vx + (i % 3 === 2 ? 1 : 0), vy + i, i % 2 === 0 ? 2 : 1, 1);
      }
    }
    scatterLeafSpeckles(tctx, 31, 29, 26, 19, foliageRamp, 36, 359);
    applyTreeOutline(tctx, w, h, treeOutlineHex);
  });

  // TREE VARIANT 4: Lively Young Sapling (Graceful Slim Leaning Trunk + Airy Sunlit New-Growth Clusters!)
  const treeSapling = makeTreeCanvas((tctx, w, h) => {
    paintOrganicTrunk(tctx, 32, 50, 75, 2.7, {
      bend: -1.6,
      lean: 1.3,
      seed: 21,
      branches: [
        [31, 55, 24, 48, 2.2],
        [33, 54, 40, 47, 2.2],
      ],
    });
    paintOrganicCluster(tctx, 23, 45, 9.5, 7.5, foliageRamp, 401, -0.20);
    paintOrganicCluster(tctx, 41, 46, 9, 7, foliageRamp, 409, -0.26);
    paintOrganicCluster(tctx, 32, 43, 12, 8.5, foliageRamp, 419, -0.04);
    paintOrganicCluster(tctx, 27, 34, 10, 8, foliageRamp, 421, 0.16);
    paintOrganicCluster(tctx, 37, 35, 9, 7, foliageRamp, 431, 0.04);
    paintOrganicCluster(tctx, 31, 27, 8.5, 6.5, foliageRamp, 433, 0.28);
    scatterLeafSpeckles(tctx, 32, 39, 17, 13, foliageRamp, 22, 439);
    applyTreeOutline(tctx, w, h, treeOutlineHex);
  });

  // TREE VARIANT 5: Rich Layered Sakura / Blossom Tree (Slender Trunk + 5-Tone Pink/White Dithered Petal Clouds!)
  const treeBlossom = makeTreeCanvas((tctx, w, h) => {
    paintOrganicTrunk(tctx, 32, 44, 76, 3.8, {
      bend: 2.3,
      lean: -1.4,
      seed: 33,
      branches: [
        [30, 50, 18, 39, 3],
        [34, 49, 46, 39, 3],
        [31, 45, 34, 34, 2.5],
      ],
    });
    // Sweeping layered sakura petal clouds (back-to-front)
    paintOrganicCluster(tctx, 16, 38, 12, 8.5, blossomRamp, 503, -0.28);
    paintOrganicCluster(tctx, 48, 39, 12, 8.5, blossomRamp, 509, -0.32);
    paintOrganicCluster(tctx, 32, 40, 15, 9, blossomRamp, 521, -0.24);
    paintOrganicCluster(tctx, 18, 29, 12.5, 9.5, blossomRamp, 523, 0.06);
    paintOrganicCluster(tctx, 45, 30, 12, 9, blossomRamp, 541, -0.08);
    paintOrganicCluster(tctx, 32, 26, 15, 10.5, blossomRamp, 547, 0.08);
    paintOrganicCluster(tctx, 24, 17, 12, 8.5, blossomRamp, 557, 0.24);
    paintOrganicCluster(tctx, 39, 19, 10.5, 7.5, blossomRamp, 563, 0.12);
    paintOrganicCluster(tctx, 29, 13, 9, 6.5, blossomRamp, 569, 0.32);
    scatterLeafSpeckles(tctx, 32, 29, 25, 18, blossomRamp, 32, 571);

    // Delicate drifting blossom petals floating below the canopy
    const petals: [number, number][] = [
      [11, 51],
      [18, 56],
      [48, 53],
      [53, 60],
      [22, 62],
    ];
    for (let i = 0; i < petals.length; i++) {
      const [px, py] = petals[i];
      tctx.fillStyle = i % 2 === 0 ? blossomRamp[4] : blossomRamp[3];
      tctx.fillRect(px, py, 2, 1);
      tctx.fillStyle = blossomRamp[2];
      tctx.fillRect(px + 1, py + 1, 1, 1);
    }
    applyTreeOutline(tctx, w, h, biome === 'cinnabar_isle' ? '#241214' : '#131f18');
  });

  // BIOME-SPECIFIC SIGNATURE FLORA SILHOUETTES (Cacti, Coastal Palms, Snow Pines/Ice Spires, Volcanic Obsidian!)
  const makeDesertCactus = (variant: 0 | 1) =>
    makeTreeCanvas((tctx, w, h) => {
      const cDark = '#1a4a24';
      const cMid = '#2f8a3d';
      const cHi = '#6cd457';
      const cRib = '#1e5c2c';
      // Main ribbed saguaro column
      const cx = variant === 0 ? 31 : 33;
      const topY = variant === 0 ? 18 : 14;
      for (let y = topY; y <= 75; y++) {
        const hw = y < topY + 4 ? 4 : 5;
        for (let dx = -hw; dx <= hw; dx++) {
          const col = dx <= -3 ? cHi : dx === -1 || dx === 2 ? cRib : dx >= 3 ? cDark : cMid;
          tctx.fillStyle = col;
          tctx.fillRect(cx + dx, y, 1, 1);
        }
      }
      // Left curving arm
      const lArmY = variant === 0 ? 44 : 50;
      for (let x = cx - 15; x <= cx - 5; x++) {
        tctx.fillStyle = x < cx - 12 ? cHi : cMid;
        tctx.fillRect(x, lArmY, 1, 6);
        tctx.fillStyle = cDark;
        tctx.fillRect(x, lArmY + 4, 1, 2);
      }
      for (let y = lArmY - 17; y <= lArmY + 3; y++) {
        tctx.fillStyle = cHi;
        tctx.fillRect(cx - 17, y, 2, 1);
        tctx.fillStyle = cMid;
        tctx.fillRect(cx - 15, y, 3, 1);
        tctx.fillStyle = cDark;
        tctx.fillRect(cx - 12, y, 2, 1);
      }
      // Right curving arm
      const rArmY = variant === 0 ? 37 : 41;
      for (let x = cx + 5; x <= cx + 15; x++) {
        tctx.fillStyle = cMid;
        tctx.fillRect(x, rArmY, 1, 6);
        tctx.fillStyle = cDark;
        tctx.fillRect(x, rArmY + 4, 1, 2);
      }
      for (let y = rArmY - 15; y <= rArmY + 3; y++) {
        tctx.fillStyle = cHi;
        tctx.fillRect(cx + 12, y, 2, 1);
        tctx.fillStyle = cMid;
        tctx.fillRect(cx + 14, y, 2, 1);
        tctx.fillStyle = cDark;
        tctx.fillRect(cx + 16, y, 2, 1);
      }
      // Tiny golden desert cactus blossom on top!
      fillDisc(tctx, cx, topY - 1, 3.2, 2.4, '#ffd43b');
      fillDisc(tctx, cx - 1, topY - 2, 1.8, 1.4, '#fff9db');
      applyTreeOutline(tctx, w, h, '#1b1612');
    });

  const makeCoastalPalm = (leanDir: -1 | 1) =>
    makeTreeCanvas((tctx, w, h) => {
      // Tall gracefully curved ringed coconut palm trunk
      for (let y = 26; y <= 76; y++) {
        const t = (y - 26) / 50;
        const curve = Math.sin((1 - t) * Math.PI * 0.65) * 9 * leanDir;
        const sx = Math.round(32 + curve);
        const hw = 2.2 + t * 1.9;
        const ring = y % 4 === 0;
        for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
          tctx.fillStyle = ring ? '#5c3c24' : dx < 0 ? '#c4905c' : dx === 0 ? '#9c6b3e' : '#704929';
          tctx.fillRect(sx + dx, y, 1, 1);
        }
      }
      const crownX = Math.round(32 + Math.sin(Math.PI * 0.65) * 9 * leanDir);
      const crownY = 25;
      // Coconuts tucked under the fronds
      fillDisc(tctx, crownX - 2, crownY + 3, 2.4, 2.4, '#6b3e26');
      fillDisc(tctx, crownX + 2, crownY + 4, 2.3, 2.3, '#522e1b');
      // 7 sweeping feathered tropical palm fronds
      const fronds: [number, number, number][] = [
        [-22, 6, -4],
        [-19, -7, -6],
        [-11, -15, -5],
        [11, -15, -5],
        [20, -6, -6],
        [23, 7, -4],
        [2, 11, -2],
      ];
      for (const [fx, fy, arch] of fronds) {
        const steps = 22;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const px = Math.round(crownX + fx * u);
          const py = Math.round(crownY + fy * u + Math.sin(u * Math.PI) * arch + u * u * 7);
          const thick = Math.max(1, Math.round((1 - u * 0.65) * 3.5));
          tctx.fillStyle = u < 0.35 ? '#8ce99a' : u < 0.72 ? '#2f9e44' : '#1b6e35';
          tctx.fillRect(px - 1, py, 2, thick);
          // Drooping palm leaflets
          if (s > 3 && s % 2 === 0) {
            tctx.fillStyle = '#145228';
            tctx.fillRect(px, py + thick, 1, Math.max(1, 3 - Math.floor(u * 2)));
          }
        }
      }
      applyTreeOutline(tctx, w, h, '#10241c');
    });

  const makeIceCrystalSpire = (tall: boolean) =>
    makeTreeCanvas((tctx, w, h) => {
      const drawPrism = (cx: number, botY: number, topY: number, halfW: number) => {
        const span = Math.max(1, botY - topY);
        for (let y = topY; y <= botY; y++) {
          const t = (y - topY) / span;
          const hw = Math.max(1, Math.round(halfW * (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) * 0.15)));
          for (let dx = -hw; dx <= hw; dx++) {
            const col =
              dx < -hw * 0.35
                ? '#e7f5ff'
                : dx < hw * 0.15
                  ? '#74c0fc'
                  : dx < hw * 0.6
                    ? '#339af0'
                    : '#1c7ed6';
            tctx.fillStyle = col;
            tctx.fillRect(cx + dx, y, 1, 1);
          }
        }
      };
      drawPrism(22, 75, tall ? 34 : 42, 6);
      drawPrism(42, 75, tall ? 38 : 46, 6);
      drawPrism(32, 76, tall ? 12 : 20, 9);
      // Frost snowdrifts at base
      fillDisc(tctx, 32, 74, 15, 4, '#eef7fc');
      fillDisc(tctx, 32, 75, 13, 2.5, '#d0ebff');
      applyTreeOutline(tctx, w, h, '#16283b');
    });

  const makeVolcanicSpire = (withLava: boolean) =>
    makeTreeCanvas((tctx, w, h) => {
      const drawBasalt = (cx: number, botY: number, topY: number, halfW: number) => {
        const span = Math.max(1, botY - topY);
        for (let y = topY; y <= botY; y++) {
          const t = (y - topY) / span;
          const jag = ((y * 7) % 3) - 1;
          const hw = Math.max(1, Math.round(halfW * (0.28 + t * 0.72) + jag * 0.4));
          for (let dx = -hw; dx <= hw; dx++) {
            const isVein = withLava && Math.abs(dx - Math.round(Math.sin(y * 0.22) * 2)) <= 0 && y > topY + 8;
            tctx.fillStyle = isVein
              ? y % 3 === 0
                ? '#ffd43b'
                : '#ff6b2b'
              : dx < -hw * 0.35
                ? '#5c4b51'
                : dx < hw * 0.3
                  ? '#362b30'
                  : '#21191e';
            tctx.fillRect(cx + dx, y, 1, 1);
          }
        }
      };
      drawBasalt(21, 75, 36, 7);
      drawBasalt(44, 75, 42, 6);
      drawBasalt(32, 76, 14, 10);
      if (withLava) {
        fillDisc(tctx, 32, 74, 12, 3, '#ff6b2b');
        fillDisc(tctx, 32, 74, 7, 1.8, '#ffe066');
      }
      applyTreeOutline(tctx, w, h, '#140c10');
    });

  // Load our 4 new 80x96 high-craft pixel-art tree species (Maple, Weeping Willow, Silver Birch, Lavender Wisteria!)
  const hdMaple = loadWorldPropTex('/sprites/world/tree-maple.png');
  const hdWillow = loadWorldPropTex('/sprites/world/tree-willow.png');
  const hdBirch = loadWorldPropTex('/sprites/world/tree-birch.png');
  const hdWisteria = loadWorldPropTex('/sprites/world/tree-wisteria.png');

  const treeSprites =
    biome === 'rocky_desert'
      ? [makeDesertCactus(0), makeDesertCactus(1), hdMaple, makeDesertCactus(0), treeSapling]
      : biome === 'storm_coast'
        ? [makeCoastalPalm(1), makeCoastalPalm(-1), hdWillow, makeCoastalPalm(1), treePine, hdBirch]
        : biome === 'sky_glacier'
          ? [treePine, makeIceCrystalSpire(true), hdBirch, makeIceCrystalSpire(false), treePine, treeSapling]
          : biome === 'cinnabar_isle'
            ? [makeVolcanicSpire(true), makeVolcanicSpire(false), hdMaple, treeBlossom, makeVolcanicSpire(true)]
            : [treeOak, treePine, treeBerry, treeElder, treeSapling, treeBlossom, hdMaple, hdWillow, hdBirch, hdWisteria];

  // EXTRA NON-REPETITIVE PIXEL FLORA & GEOLOGY VARIANTS (5 Flowers, 4 Boulders, 3 Mushrooms, 3 Bushes!)
  const flowerTulip = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    fillDisc(ctx, 16, 26, 10, 4.5, '#1d6928');
    fillDisc(ctx, 11, 24, 5.5, 3, '#3eab38');
    fillDisc(ctx, 21, 24, 5.5, 3, '#3eab38');
    const drawTulip = (cx: number, topY: number, cDark: string, cMid: string, cHi: string) => {
      ctx.fillStyle = '#20732c';
      ctx.fillRect(cx, topY + 5, 2, 24 - topY);
      ctx.fillStyle = cDark;
      ctx.fillRect(cx - 2, topY + 1, 6, 5);
      ctx.fillStyle = cMid;
      ctx.fillRect(cx - 2, topY, 2, 4);
      ctx.fillRect(cx + 2, topY, 2, 4);
      ctx.fillRect(cx, topY + 1, 2, 4);
      ctx.fillStyle = cHi;
      ctx.fillRect(cx - 1, topY + 1, 2, 2);
    };
    const [t1, t2] = biome === 'sky_glacier' ? ['#74c0fc', '#a5d8ff'] : biome === 'cinnabar_isle' ? ['#ff5924', '#ffd43b'] : ['#e03131', '#ff6b6b'];
    drawTulip(9, 12, '#861919', t1, t2);
    drawTulip(16, 9, '#861919', t1, '#fff0f6');
    drawTulip(23, 14, '#861919', t1, t2);
    outlineSprite(ctx, s, '#14141c');
  });
  flowerTulip.wrapS = THREE.ClampToEdgeWrapping;
  flowerTulip.wrapT = THREE.ClampToEdgeWrapping;

  const flowerSunflower = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    fillDisc(ctx, 16, 26, 10, 4, '#1b6326');
    ctx.fillStyle = '#2b8a3e';
    ctx.fillRect(10, 14, 2, 12);
    ctx.fillRect(20, 11, 2, 15);
    const drawSun = (cx: number, cy: number, r: number) => {
      fillDisc(ctx, cx, cy, r + 1.5, r + 1.5, '#f08c00');
      fillDisc(ctx, cx, cy - 0.6, r + 0.6, r + 0.6, '#ffd43b');
      fillDisc(ctx, cx, cy, r * 0.52, r * 0.52, '#5c3416');
      ctx.fillStyle = '#a86428';
      ctx.fillRect(cx - 1, cy - 1, 1, 1);
    };
    drawSun(11, 13, 4.4);
    drawSun(21, 10, 5.2);
    fillDisc(ctx, 15, 22, 3, 2, '#fff3bf');
    outlineSprite(ctx, s, '#14141c');
  });
  flowerSunflower.wrapS = THREE.ClampToEdgeWrapping;
  flowerSunflower.wrapT = THREE.ClampToEdgeWrapping;

  const flowerClover = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    fillDisc(ctx, 16, 24, 12, 5.5, '#195c26');
    fillDisc(ctx, 10, 22, 6, 4, '#2f9e44');
    fillDisc(ctx, 22, 22, 6, 4, '#2f9e44');
    fillDisc(ctx, 16, 19, 7, 4, '#51cf66');
    const specks = [[9, 19], [14, 15], [19, 17], [23, 20], [13, 21], [20, 23]];
    for (let i = 0; i < specks.length; i++) {
      const [sx, sy] = specks[i];
      fillDisc(ctx, sx, sy, 2.0, 1.8, i % 2 === 0 ? '#f783ac' : '#ffe066');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy - 1, 1, 1);
    }
    outlineSprite(ctx, s, '#14141c');
  });
  flowerClover.wrapS = THREE.ClampToEdgeWrapping;
  flowerClover.wrapT = THREE.ClampToEdgeWrapping;

  const mushroomGlow = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const drawGlow = (cx: number, botY: number, rx: number, ry: number, sh: number) => {
      ctx.fillStyle = '#d0ebff';
      ctx.fillRect(Math.round(cx - 2), botY - sh, 4, sh);
      const cy = botY - sh - Math.round(ry * 0.35);
      fillDisc(ctx, cx, cy, rx, ry, '#5f3dc4');
      fillDisc(ctx, cx, cy - 1, rx - 0.8, ry - 0.8, '#845ef7');
      fillDisc(ctx, cx - 1, cy - 2, rx * 0.55, ry * 0.5, '#d0bfff');
      ctx.fillStyle = '#66d9e8';
      ctx.fillRect(Math.round(cx - rx * 0.3), cy, 2, 1);
      ctx.fillRect(Math.round(cx + rx * 0.2), cy - 1, 2, 1);
    };
    drawGlow(11, 29, 7.2, 5.0, 9);
    drawGlow(21, 30, 5.4, 3.8, 6);
    outlineSprite(ctx, s, '#14141c');
  });
  mushroomGlow.wrapS = THREE.ClampToEdgeWrapping;
  mushroomGlow.wrapT = THREE.ClampToEdgeWrapping;

  const boulderCrag = makePixelCanvas(24, (ctx) => {
    ctx.clearRect(0, 0, 24, 24);
    for (let y = 5; y <= 21; y++) {
      const t = (y - 5) / 16;
      const hw = Math.round(2 + t * 8.5 + Math.sin(y * 0.9) * 1.1);
      for (let dx = -hw; dx <= hw; dx++) {
        ctx.fillStyle = dx < -hw * 0.25 ? pal.cliffColors[0] : dx < hw * 0.4 ? pal.cliffColors[1] : pal.cliffColors[2];
        ctx.fillRect(12 + dx, y, 1, 1);
      }
    }
    outlineSprite(ctx, 24, '#1c1a22');
  });
  boulderCrag.wrapS = THREE.ClampToEdgeWrapping;
  boulderCrag.wrapT = THREE.ClampToEdgeWrapping;

  const boulderPebbles = makePixelCanvas(24, (ctx) => {
    ctx.clearRect(0, 0, 24, 24);
    const drawRock = (cx: number, cy: number, rx: number, ry: number) => {
      fillDisc(ctx, cx, cy, rx, ry, pal.cliffColors[2]);
      fillDisc(ctx, cx - 0.8, cy - 1, rx * 0.78, ry * 0.72, pal.cliffColors[1]);
      fillDisc(ctx, cx - 1.4, cy - 1.6, rx * 0.45, ry * 0.4, pal.cliffColors[0]);
    };
    drawRock(9, 17, 6.2, 4.4);
    drawRock(17, 18, 4.8, 3.5);
    drawRock(14, 13, 3.8, 2.8);
    outlineSprite(ctx, 24, '#1c1a22');
  });
  boulderPebbles.wrapS = THREE.ClampToEdgeWrapping;
  boulderPebbles.wrapT = THREE.ClampToEdgeWrapping;

  const boulderMineral = makePixelCanvas(24, (ctx) => {
    ctx.clearRect(0, 0, 24, 24);
    fillDisc(ctx, 12, 16, 8.8, 5.5, pal.cliffColors[2]);
    fillDisc(ctx, 11, 14, 7.2, 4.2, pal.cliffColors[1]);
    const gem = biome === 'sky_glacier' ? '#74c0fc' : biome === 'cinnabar_isle' ? '#ff6b2b' : biome === 'rocky_desert' ? '#ffd43b' : '#51cf66';
    const gemHi = biome === 'cinnabar_isle' ? '#ffe066' : '#ffffff';
    ctx.fillStyle = gem;
    ctx.fillRect(8, 9, 3, 6);
    ctx.fillRect(13, 8, 3, 7);
    ctx.fillRect(11, 11, 2, 4);
    ctx.fillStyle = gemHi;
    ctx.fillRect(9, 10, 1, 2);
    ctx.fillRect(14, 9, 1, 2);
    outlineSprite(ctx, 24, '#1c1a22');
  });
  boulderMineral.wrapS = THREE.ClampToEdgeWrapping;
  boulderMineral.wrapT = THREE.ClampToEdgeWrapping;

  const bushBlossom = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    fillDisc(ctx, 16, 22, 12, 6.5, '#174d22');
    fillDisc(ctx, 10, 19, 7, 5.5, pal.foliageColors[0]);
    fillDisc(ctx, 22, 19, 7, 5.5, pal.foliageColors[0]);
    fillDisc(ctx, 16, 15, 9.5, 6.5, pal.foliageColors[1]);
    fillDisc(ctx, 14, 12, 6, 3.8, pal.foliageColors[2]);
    const petals = [[9, 18], [15, 13], [21, 16], [13, 21], [20, 21]];
    for (const [px, py] of petals) {
      fillDisc(ctx, px, py, 2.0, 1.8, pal.accentFlower[1]);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, py - 1, 1, 1);
    }
    outlineSprite(ctx, s, '#14141c');
  });
  bushBlossom.wrapS = THREE.ClampToEdgeWrapping;
  bushBlossom.wrapT = THREE.ClampToEdgeWrapping;

  const bushFern = makePixelCanvas(32, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const fronds: [number, number][] = [[-10, -8], [-6, -13], [0, -15], [6, -13], [10, -8], [-12, -3], [12, -3]];
    for (const [fx, fy] of fronds) {
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const px = Math.round(16 + fx * u);
        const py = Math.round(28 + fy * u + u * u * 3);
        ctx.fillStyle = u < 0.35 ? pal.foliageColors[0] : u < 0.75 ? pal.foliageColors[1] : pal.foliageColors[2];
        ctx.fillRect(px - 1, py, 3 - Math.floor(u * 2), 2);
      }
    }
    outlineSprite(ctx, s, '#122616');
  });
  bushFern.wrapS = THREE.ClampToEdgeWrapping;
  bushFern.wrapT = THREE.ClampToEdgeWrapping;

  // Load our hand-crafted crisp PokéBonk/GBA 3-tone pixel-art ground prop PNGs!
  const hdMushroom = loadWorldPropTex('/sprites/world/prop-mushroom.png');
  const hdFlower = loadWorldPropTex('/sprites/world/prop-flower.png');
  const hdFlowerColor = loadWorldPropTex('/sprites/world/prop-flower-color.png');
  const hdFern = loadWorldPropTex('/sprites/world/prop-fern.png');
  const hdBush = loadWorldPropTex('/sprites/world/prop-bush.png');
  const hdLog = loadWorldPropTex('/sprites/world/prop-log.png');
  const hdBoulder = loadWorldPropTex('/sprites/world/prop-boulder.png');
  const hdCrystal = loadWorldPropTex('/sprites/world/prop-crystal.png');
  const hdStump = loadWorldPropTex('/sprites/world/prop-stump.png');
  const hdSignpost = loadWorldPropTex('/sprites/world/prop-signpost.png');

  // Crisp 24x24 pixel-art floating lily pad (荷叶)
  const lilyPad = makePixelCanvas(24, (ctx) => {
    const cx = 12, cy = 12, r = 9;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        // Classic V-notch slice on right side
        if (dx > 0 && Math.abs(dy) < dx * 0.42) continue;
        const edge = d > r - 1.4;
        const vein = Math.abs(dy) < 0.9 || Math.abs(dx) < 0.9 || Math.abs(dx + dy) < 1.1;
        ctx.fillStyle = edge ? '#2b8a3e' : vein ? '#8ce99a' : (dx + dy < 0 ? '#51cf66' : '#37b24d');
        ctx.fillRect(x, y, 1, 1);
      }
    }
    outlineSprite(ctx, 24, '#14261c');
  });
  lilyPad.wrapS = THREE.ClampToEdgeWrapping;
  lilyPad.wrapT = THREE.ClampToEdgeWrapping;

  // Crisp 24x24 pixel-art lily pad with blooming pink lotus flower (睡莲荷叶)
  const lilyLotus = makePixelCanvas(24, (ctx) => {
    const cx = 12, cy = 12, r = 9;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        if (dx > 0 && Math.abs(dy) < dx * 0.38) continue;
        ctx.fillStyle = d > r - 1.4 ? '#2b8a3e' : (dx + dy < 0 ? '#51cf66' : '#37b24d');
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Pink pixel lotus blossom at center
    ctx.fillStyle = '#e64980';
    ctx.fillRect(8, 9, 8, 6);
    ctx.fillRect(9, 8, 6, 8);
    ctx.fillStyle = '#faa2c1';
    ctx.fillRect(9, 9, 6, 5);
    ctx.fillStyle = '#fff0f6';
    ctx.fillRect(10, 10, 4, 3);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(11, 11, 2, 2);
    outlineSprite(ctx, 24, '#14261c');
  });
  lilyLotus.wrapS = THREE.ClampToEdgeWrapping;
  lilyLotus.wrapT = THREE.ClampToEdgeWrapping;

  // Crisp 28x28 upright pixel-art shoreline cattail reeds (香蒲/水草)
  const cattail = makePixelCanvas(28, (ctx) => {
    // Grass reeds blades
    const blades: [number, number, number, string][] = [
      [8, 27, 13, '#2f9e44'],
      [11, 27, 18, '#40c057'],
      [14, 27, 21, '#2b8a3e'],
      [17, 27, 17, '#51cf66'],
      [20, 27, 12, '#2f9e44'],
    ];
    for (const [bx, by, bh, col] of blades) {
      for (let i = 0; i < bh; i++) {
        const lean = Math.round(((bx - 14) * i) / 26);
        ctx.fillStyle = i > bh - 4 ? '#8ce99a' : col;
        ctx.fillRect(bx + lean, by - i, 2, 1);
      }
    }
    // Two plump warm-brown cattail heads
    ctx.fillStyle = '#5c3419';
    ctx.fillRect(10, 8, 3, 7);
    ctx.fillRect(17, 10, 3, 6);
    ctx.fillStyle = '#9c5a2c';
    ctx.fillRect(11, 9, 1, 5);
    ctx.fillRect(18, 11, 1, 4);
    outlineSprite(ctx, 28, '#141c18');
  });
  cattail.wrapS = THREE.ClampToEdgeWrapping;
  cattail.wrapT = THREE.ClampToEdgeWrapping;

  // Crisp 20x20 glowing tree berry cluster (可摇树采摘的树果簇!)
  const berryCluster = makePixelCanvas(20, (ctx) => {
    // Tiny green leaves behind berries
    ctx.fillStyle = '#2f9e44';
    ctx.fillRect(5, 4, 10, 4);
    // 3 plump glowing crimson/gold pixel berries
    const drawBerry = (bx: number, by: number, c1: string, c2: string) => {
      ctx.fillStyle = c1;
      ctx.fillRect(bx, by, 5, 5);
      ctx.fillStyle = c2;
      ctx.fillRect(bx + 1, by + 1, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + 1, by + 1, 1, 1);
    };
    drawBerry(4, 8, '#e03131', '#ff8787');
    drawBerry(11, 8, '#f08c00', '#ffe066');
    drawBerry(7, 12, '#e03131', '#ff8787');
    outlineSprite(ctx, 20, '#14141c');
  });
  berryCluster.wrapS = THREE.ClampToEdgeWrapping;
  berryCluster.wrapT = THREE.ClampToEdgeWrapping;

  const set: BiomeTextureSet = {
    ground,
    cliff,
    road,
    plaza,
    foliage,
    trunk,
    grassTuft: hdFern,
    tallGrass: hdFern,
    mushroom: hdMushroom,
    mushroomAlt,
    flower: hdFlower,
    flowerAlt,
    bush: hdBush,
    boulder: hdBoulder,
    stump: hdStump,
    signpost: hdSignpost,
    lilyPad,
    lilyLotus,
    cattail,
    berryCluster,
    treeSprite: treeOak,
    treeSprites,
    flowers: [hdFlower, hdFlowerColor, hdFlower, hdFlowerColor],
    boulders:
      biome === 'sky_glacier'
        ? [hdCrystal, hdBoulder, hdCrystal, hdBoulder]
        : [hdBoulder, hdLog, hdCrystal, hdBoulder],
    mushrooms: [hdMushroom, hdMushroom, mushroomAlt, mushroomGlow],
    bushes: [hdBush, hdFern, hdLog, hdFern],
  };
  biomeCache.set(biome, set);
  return set;
}

/** Generate a 2D pixel preview data-URL thumbnail for the top Map Carousel cards */
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
export type HeroId = 'red' | 'misty' | 'brock' | 'blue';
type HeroPoseKey = 'idle0' | 'idle1' | '0' | '1' | 'jump';

interface HeroPalette {
  skin: [string, string, string]; // [hi, mid, shadow]
  cheek: string;
  hair: [string, string, string];
  top: [string, string, string];
  topAccent: string;
  innerShirt: [string, string];
  pants: [string, string, string];
  shoe: [string, string, string]; // [hi, mid, sole]
  pack: [string, string, string];
  packStrap: string;
  eyeIris: string;
  eyeDark: string;
  cap?: [string, string, string];
  capFront?: string;
}

const HERO_PALETTES: Record<HeroId, HeroPalette> = {
  red: {
    skin: ['#ffead1', '#f6c79c', '#cc9062'],
    cheek: '#f09e84',
    hair: ['#42495e', '#242836', '#141722'],
    top: ['#ff5e5e', '#dc2626', '#941418'],
    topAccent: '#f8fafc',
    innerShirt: ['#3b4254', '#232733'],
    pants: ['#5b8ee8', '#3362bf', '#1d3c80'],
    shoe: ['#ff5959', '#cc2222', '#f8fafc'],
    pack: ['#ffe485', '#e2ae39', '#9e7018'],
    packStrap: '#593b18',
    eyeIris: '#303b59',
    eyeDark: '#141724',
    cap: ['#ff6666', '#e02424', '#991418'],
    capFront: '#ffffff',
  },
  misty: {
    skin: ['#ffeed9', '#f7cca4', '#cf966b'],
    cheek: '#ff9c9c',
    hair: ['#ffb866', '#eb7420', '#a6400e'],
    top: ['#fff380', '#f5c424', '#ba8907'],
    topAccent: '#e63333',
    innerShirt: ['#ffe659', '#d4a311'],
    pants: ['#6ba8f2', '#3a78d4', '#214d94'],
    shoe: ['#ff5959', '#cc2222', '#ffd84d'],
    pack: ['#80caff', '#339af0', '#1a61ab'],
    packStrap: '#d92b2b',
    eyeIris: '#268899',
    eyeDark: '#123e4a',
  },
  brock: {
    skin: ['#ebb98f', '#ce9363', '#996238'],
    cheek: '#bd7c52',
    hair: ['#75553d', '#4c3221', '#29190f'],
    top: ['#61b565', '#387d3f', '#1e4f25'],
    topAccent: '#ff9c54',
    innerShirt: ['#f27b35', '#bd4e17'],
    pants: ['#8b97a3', '#5c6673', '#38404a'],
    shoe: ['#9c6b42', '#6e4626', '#3d2514'],
    pack: ['#c4b082', '#917e54', '#5c4e31'],
    packStrap: '#3b2f1c',
    eyeIris: '#2b1d14',
    eyeDark: '#170f0a',
  },
  blue: {
    skin: ['#ffe9ce', '#f4c599', '#c99063'],
    cheek: '#e89d82',
    hair: ['#bf7b43', '#8c4e21', '#542a0e'],
    top: ['#8f77d4', '#5c44a3', '#36246b'],
    topAccent: '#ffd43b',
    innerShirt: ['#363b52', '#1f2233'],
    pants: ['#555f78', '#333a4f', '#1b2030'],
    shoe: ['#4a74bd', '#284782', '#f1f5f9'],
    pack: ['#707a91', '#485063', '#272c3b'],
    packStrap: '#e6b82e',
    eyeIris: '#2f6e52',
    eyeDark: '#153628',
  },
};

function applyHeroOutline(ctx: CanvasRenderingContext2D, w: number, h: number, hex = '#14141c') {
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  const c = new THREE.Color(hex);
  const or = Math.round(c.r * 255);
  const og = Math.round(c.g * 255);
  const ob = Math.round(c.b * 255);
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 90;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 90) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        img.data[i] = or;
        img.data[i + 1] = og;
        img.data[i + 2] = ob;
        img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function drawHeroPixelFrame(
  ctx: CanvasRenderingContext2D,
  heroId: HeroId,
  dir: FacingDir,
  pose: HeroPoseKey,
) {
  const pal = HERO_PALETTES[heroId];
  const W = 48;
  const H = 56;
  ctx.clearRect(0, 0, W, H);

  // Mirror cleanly for 'left' so side profile anatomy, cap brim & running stride stay razor crisp
  const flipX = dir === 'left';
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = col;
    const rx = Math.round(x);
    const rw = Math.round(w);
    const dx = flipX ? W - rx - rw : rx;
    ctx.fillRect(dx, Math.round(y), rw, Math.round(h));
  };

  // Smooth ellipse / curved pixel fill helper (for rounded anime head, curved cap dome & backpack!)
  const disc = (cx: number, cy: number, rx: number, ry: number, col: string) => {
    ctx.fillStyle = col;
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        if ((dx * dx) / (rx * rx + 0.01) + (dy * dy) / (ry * ry + 0.01) <= 1.0) {
          const sx = Math.round(cx + dx);
          const sy = Math.round(cy + dy);
          const fx = flipX ? W - sx - 1 : sx;
          ctx.fillRect(fx, sy, 1, 1);
        }
      }
    }
  };

  // Pose kinematics (grounded feet at y = 53, leaving y = 54 for crisp 1px outer contour)
  const isJump = pose === 'jump';
  const isWalk0 = pose === '0';
  const isWalk1 = pose === '1';
  const isIdle1 = pose === 'idle1';

  const bodyBounce = isJump ? -4 : isWalk0 || isWalk1 ? -1 : 0;
  const headBob = isJump ? -4 : isWalk0 || isWalk1 ? -1 : isIdle1 ? -1 : 0;
  const breathe = isIdle1 ? -1 : 0;

  const headTopY = 8 + headBob;
  const torsoY = 28 + bodyBounce + (isIdle1 ? -1 : 0);
  const hipY = 40 + bodyBounce;

  const sleeveHi = heroId === 'brock' ? pal.innerShirt[0] : heroId === 'misty' ? pal.skin[0] : pal.top[0];
  const sleeveMid = heroId === 'brock' ? pal.innerShirt[0] : heroId === 'misty' ? pal.skin[1] : pal.top[1];
  const sleeveDark = heroId === 'brock' ? pal.innerShirt[1] : heroId === 'misty' ? pal.skin[2] : pal.top[2];

  // Helper: Draw a sculpted front/back anime leg + jeans cuff + shaded white-soled sneaker
  const drawFrontLeg = (lx: number, ly: number, legH: number, lifted: boolean, isLeft: boolean) => {
    const isShorts = heroId === 'misty';
    if (isShorts) {
      // Denim shorts leg + shaded bare calf + athletic socks
      const shortH = Math.min(3, legH);
      px(lx, ly, 5, shortH, pal.pants[1]);
      px(lx, ly, 2, shortH, pal.pants[0]);
      px(lx + 4, ly, 1, shortH, pal.pants[2]);
      if (legH > shortH) {
        px(lx + 1, ly + shortH, 3, legH - shortH, pal.skin[1]);
        px(lx + 1, ly + shortH, 1, legH - shortH, pal.skin[0]);
        px(lx + 3, ly + shortH, 1, legH - shortH, pal.skin[2]);
        // Cute ankle sock
        px(lx + 1, ly + legH - 1, 3, 1, '#ffffff');
      }
    } else {
      // Shaded trousers/jeans + folded cuff hem
      px(lx, ly, 5, legH, pal.pants[1]);
      px(lx, ly, 2, Math.max(1, legH - 1), pal.pants[0]);
      px(lx + 4, ly, 1, legH, pal.pants[2]);
      // Subtle knee highlight / crease
      if (legH >= 6) {
        px(lx + 1, ly + 2, 2, 1, pal.pants[0]);
        px(lx + 2, ly + 3, 2, 1, pal.pants[2]);
      }
      // Crisp jeans cuff at ankle
      px(lx, ly + legH - 2, 5, 1, pal.pants[2]);
      px(lx + 1, ly + legH - 1, 3, 1, pal.pants[0]);
    }
    // Shaded sneaker with curved toe cap & crisp white sole!
    const sy = Math.min(50, ly + legH);
    const sx = isLeft ? lx - 1 : lx;
    if (lifted) {
      // Lifted foot (angled heel/sole visible during stride/jump)
      px(sx, sy, 6, 3, pal.shoe[1]);
      px(sx + 1, sy, 3, 1, pal.shoe[0]);
      px(sx, sy + 2, 6, 1, pal.shoe[2]);
      px(sx + 1, sy + 3, 4, 1, '#cbd5e1');
    } else {
      // Planted sneaker with white sole & tongue detail
      px(sx, sy, 6, 3, pal.shoe[1]);
      px(sx + 1, sy, 3, 2, pal.shoe[0]);
      px(sx + 2, sy, 2, 1, '#ffffff'); // laces
      px(sx, sy + 3, 6, 1, pal.shoe[2]); // crisp white sole
    }
  };

  if (dir === 'down' || dir === 'up') {
    const isBack = dir === 'up';

    // 1. LEGS & WHITE-SOLED SNEAKERS (smooth alternating knee-bend stride + dynamic jump!)
    if (isJump) {
      drawFrontLeg(17, hipY - 1, 6, true, true);
      drawFrontLeg(26, hipY + 1, 4, true, false);
    } else if (isWalk0) {
      drawFrontLeg(18, hipY + 1, 9, false, true);
      drawFrontLeg(25, hipY - 1, 6, true, false);
    } else if (isWalk1) {
      drawFrontLeg(18, hipY - 1, 6, true, true);
      drawFrontLeg(25, hipY + 1, 9, false, false);
    } else {
      drawFrontLeg(18, hipY, 10, false, true);
      drawFrontLeg(25, hipY, 10, false, false);
    }
    // Clean 1px inner leg separation shadow at hip
    px(23, hipY, 2, 2, pal.pants[2]);

    // 2. ARMS & HANDS (multi-pixel swing with cuffs & bent elbows!)
    if (isJump) {
      // Triumphant raised mid-air arms
      px(11, torsoY - 3, 4, 6, sleeveMid);
      px(11, torsoY - 3, 2, 5, sleeveHi);
      px(12, torsoY + 2, 3, 2, sleeveDark);
      px(10, torsoY - 6, 4, 3, pal.skin[1]);
      px(10, torsoY - 6, 2, 2, pal.skin[0]);

      px(33, torsoY - 3, 4, 6, sleeveMid);
      px(35, torsoY - 3, 2, 6, sleeveDark);
      px(34, torsoY - 6, 4, 3, pal.skin[1]);
      px(36, torsoY - 5, 2, 2, pal.skin[2]);
    } else {
      const lArmY = isWalk0 ? torsoY + 2 : isWalk1 ? torsoY - 1 : torsoY + 1 + breathe;
      const rArmY = isWalk0 ? torsoY - 1 : isWalk1 ? torsoY + 2 : torsoY + 1 + breathe;
      const lArmX = isWalk0 ? 12 : isWalk1 ? 13 : 13;
      const rArmX = isWalk0 ? 31 : isWalk1 ? 32 : 31;

      // Left arm (sunlit outer edge + sleeve cuff + shaded fist)
      px(lArmX, lArmY, 4, 8, sleeveMid);
      px(lArmX, lArmY, 2, 7, sleeveHi);
      px(lArmX + 3, lArmY + 1, 1, 7, sleeveDark);
      if (heroId === 'red' || heroId === 'blue') {
        px(lArmX, lArmY + 7, 4, 1, heroId === 'red' ? pal.topAccent : pal.top[2]); // cuff trim
      }
      px(lArmX, lArmY + 8, 4, 3, pal.skin[1]);
      px(lArmX, lArmY + 8, 2, 2, pal.skin[0]);
      px(lArmX + 3, lArmY + 9, 1, 2, pal.skin[2]);

      // Right arm (shaded outer edge + sleeve cuff + shaded fist)
      px(rArmX, rArmY, 4, 8, sleeveMid);
      px(rArmX, rArmY, 1, 7, sleeveHi);
      px(rArmX + 2, rArmY, 2, 8, sleeveDark);
      if (heroId === 'red' || heroId === 'blue') {
        px(rArmX, rArmY + 7, 4, 1, heroId === 'red' ? pal.topAccent : pal.top[2]);
      }
      px(rArmX, rArmY + 8, 4, 3, pal.skin[1]);
      px(rArmX, rArmY + 8, 1, 2, pal.skin[0]);
      px(rArmX + 2, rArmY + 8, 2, 3, pal.skin[2]);
    }

    // 3. TORSO, TAILORED JACKET, COLLAR & SCULPTED BACKPACK
    // Tapered shoulders -> waist silhouette
    px(16, torsoY, 16, 2, pal.top[1]);
    px(17, torsoY + 2, 14, 11, pal.top[1]);
    // 3-tone torso drapery
    px(16, torsoY, 4, 2, pal.top[0]);
    px(17, torsoY + 2, 3, 10, pal.top[0]);
    px(28, torsoY, 4, 2, pal.top[2]);
    px(28, torsoY + 2, 3, 11, pal.top[2]);

    if (!isBack) {
      if (heroId === 'red') {
        // Detailed open crimson jacket + white standing collar/lapels + inner charcoal tee + backpack straps!
        px(21, torsoY + 1, 6, 11, pal.innerShirt[0]);
        px(24, torsoY + 1, 3, 11, pal.innerShirt[1]);
        // Standing white collar & lapels
        px(19, torsoY - 1, 3, 3, pal.topAccent);
        px(26, torsoY - 1, 3, 3, pal.topAccent);
        px(20, torsoY + 2, 1, 8, '#e2e8f0'); // left lapel trim
        px(27, torsoY + 2, 1, 8, '#cbd5e1'); // right lapel trim
        // Backpack shoulder straps curving over shoulders
        px(18, torsoY, 2, 7, pal.packStrap);
        px(28, torsoY, 2, 7, pal.packStrap);
        // White jacket hem piping & pocket detail
        px(17, torsoY + 10, 4, 1, pal.topAccent);
        px(27, torsoY + 10, 4, 1, pal.topAccent);
        px(18, torsoY + 8, 2, 1, pal.top[2]);
        px(28, torsoY + 8, 2, 1, pal.top[2]);
      } else if (heroId === 'misty') {
        // Sunny yellow athletic crop top + crisp red suspenders + gold clips + denim shorts waist
        px(19, torsoY, 2, 9, pal.topAccent);
        px(27, torsoY, 2, 9, pal.topAccent);
        px(19, torsoY + 7, 2, 1, '#ffd43b'); // gold clips
        px(27, torsoY + 7, 2, 1, '#ffd43b');
        px(21, torsoY + 1, 6, 6, pal.top[0]);
        // Denim shorts waistband
        px(17, torsoY + 9, 14, 4, pal.pants[1]);
        px(17, torsoY + 9, 4, 3, pal.pants[0]);
        px(27, torsoY + 9, 4, 4, pal.pants[2]);
        px(23, torsoY + 10, 2, 1, '#ffd43b'); // shorts button
      } else if (heroId === 'brock') {
        // Forest-green utility vest + burnt-orange shirt + utility chest pockets
        px(21, torsoY, 6, 11, pal.innerShirt[0]);
        px(24, torsoY, 3, 11, pal.innerShirt[1]);
        px(19, torsoY, 2, 2, pal.top[0]); // vest lapels
        px(27, torsoY, 2, 2, pal.top[2]);
        px(18, torsoY + 6, 3, 3, pal.top[2]); // left pocket
        px(18, torsoY + 6, 3, 1, pal.top[0]);
        px(27, torsoY + 6, 3, 3, pal.top[2]); // right pocket
        px(27, torsoY + 6, 3, 1, pal.top[0]);
      } else {
        // Blue's sleek royal-indigo rival jacket + popped collar + gold amber pendant!
        px(21, torsoY + 1, 6, 10, pal.innerShirt[0]);
        px(24, torsoY + 1, 3, 10, pal.innerShirt[1]);
        px(19, torsoY - 1, 3, 3, pal.top[2]);
        px(26, torsoY - 1, 3, 3, pal.top[2]);
        // Golden pendant necklace
        px(22, torsoY + 2, 1, 2, pal.topAccent);
        px(25, torsoY + 2, 1, 2, pal.topAccent);
        px(23, torsoY + 3, 2, 2, '#ffe066');
        // Jacket seam lines
        px(20, torsoY + 2, 1, 9, pal.top[0]);
        px(27, torsoY + 2, 1, 9, pal.top[2]);
      }
      // Crisp belt & metallic buckle (except Misty's shorts waist)
      if (heroId !== 'misty') {
        px(17, torsoY + 11, 14, 2, '#1d1e29');
        px(22, torsoY + 11, 4, 2, '#cbd5e1');
        px(23, torsoY + 11, 2, 1, '#ffffff');
      }
    } else {
      // BACK ('up') VIEW: Sculpted Shaded Trainer Backpack + Buckle + Pokéball Charm!
      // Shoulder straps
      px(16, torsoY, 2, 10, pal.packStrap);
      px(30, torsoY, 2, 10, pal.packStrap);
      // Rounded 3-tone backpack body
      px(17, torsoY + 1, 14, 11, pal.pack[1]);
      px(18, torsoY, 12, 13, pal.pack[1]);
      px(17, torsoY + 1, 4, 10, pal.pack[0]); // sunlit left curve
      px(27, torsoY + 1, 4, 11, pal.pack[2]); // shaded right curve
      px(18, torsoY + 11, 12, 2, pal.pack[2]); // bottom shadow
      // Sculpted top flap + deep shadow crease
      px(17, torsoY + 1, 14, 4, pal.pack[0]);
      px(27, torsoY + 1, 4, 4, pal.pack[1]);
      px(17, torsoY + 5, 14, 1, pal.pack[2]);
      px(18, torsoY + 6, 12, 1, '#1e1b24');
      // Central metallic strap & buckle
      px(23, torsoY + 2, 2, 6, pal.packStrap);
      px(22, torsoY + 4, 4, 3, '#e2e8f0');
      px(23, torsoY + 5, 2, 1, '#475569');
      // Lower pocket stitch
      px(19, torsoY + 8, 10, 3, pal.pack[2]);
      px(20, torsoY + 8, 8, 2, pal.pack[1]);

      if (heroId === 'brock') {
        // Rolled camping bedroll strapped atop Brock's field rucksack!
        px(15, torsoY - 2, 18, 4, '#dfd0ae');
        px(16, torsoY - 2, 16, 1, '#f5ebd3');
        px(16, torsoY + 1, 16, 1, '#a8966e');
        px(19, torsoY - 2, 2, 4, pal.packStrap);
        px(27, torsoY - 2, 2, 4, pal.packStrap);
      } else if (heroId === 'misty') {
        // Cute cerulean water-drop charm on Misty's pack
        px(29, torsoY + 7, 3, 3, '#38bdf8');
        px(30, torsoY + 6, 1, 1, '#bae6fd');
        px(30, torsoY + 7, 1, 1, '#ffffff');
      } else {
        // Iconic tiny Pokéball keychain charm hanging on the right side of the pack!
        px(29, torsoY + 6, 3, 2, '#ef4444');
        px(29, torsoY + 8, 3, 1, '#1e1e26');
        px(29, torsoY + 9, 3, 1, '#ffffff');
        px(30, torsoY + 8, 1, 1, '#ffffff');
      }
    }

    // 4. SCULPTED ANIME HEAD, NECK, EARS & EXPRESSIVE EYES
    // Tapered neck with chin shadow
    px(22, headTopY + 18, 4, 3, pal.skin[1]);
    px(22, headTopY + 18, 4, 1, pal.skin[2]);
    // Ears peeking out gently on sides
    px(14, headTopY + 10, 2, 4, pal.skin[1]);
    px(14, headTopY + 11, 1, 2, pal.skin[2]);
    px(32, headTopY + 10, 2, 4, pal.skin[2]);
    // Sculpted rounded anime face (tapered chin — NOT a square!)
    disc(24, headTopY + 9, 8.6, 8.2, pal.skin[1]);
    px(18, headTopY + 16, 12, 2, pal.skin[1]);
    px(20, headTopY + 18, 8, 1, pal.skin[2]); // soft rounded anime chin!
    // Soft cheek & right-side skin shading
    disc(20, headTopY + 10, 4.2, 5.2, pal.skin[0]);
    px(29, headTopY + 8, 3, 7, pal.skin[2]);
    px(27, headTopY + 15, 4, 2, pal.skin[2]);

    if (!isBack) {
      if (heroId === 'brock') {
        // Brock's iconic serene squint eyes + bold eyebrows
        px(17, headTopY + 9, 5, 1, pal.hair[1]);
        px(26, headTopY + 9, 5, 1, pal.hair[1]);
        px(17, headTopY + 11, 5, 1, pal.eyeDark);
        px(18, headTopY + 12, 3, 1, pal.skin[2]);
        px(26, headTopY + 11, 5, 1, pal.eyeDark);
        px(27, headTopY + 12, 3, 1, pal.skin[2]);
      } else {
        // Expressive 3x4 NDS anime eyes with eyelash arch, iris, pupil & crisp 1px white catchlight!
        // Left eye
        px(18, headTopY + 9, 3, 1, pal.eyeDark); // upper lash
        px(18, headTopY + 10, 3, 3, pal.eyeIris);
        px(19, headTopY + 11, 2, 2, pal.eyeDark);
        px(18, headTopY + 10, 1, 1, '#ffffff'); // upper catchlight
        px(20, headTopY + 12, 1, 1, '#dbeafe'); // lower gleam
        // Right eye
        px(27, headTopY + 9, 3, 1, pal.eyeDark);
        px(27, headTopY + 10, 3, 3, pal.eyeIris);
        px(28, headTopY + 11, 2, 2, pal.eyeDark);
        px(27, headTopY + 10, 1, 1, '#ffffff');
        px(29, headTopY + 12, 1, 1, '#dbeafe');
        // Subtle warm blush cheeks
        px(17, headTopY + 13, 2, 1, pal.cheek);
        px(29, headTopY + 13, 2, 1, pal.cheek);
      }
      // Delicate anime nose highlight + calm confident mouth
      px(23, headTopY + 13, 1, 1, pal.skin[2]);
      px(22, headTopY + 15, 4, 1, pal.skin[2]);
      px(23, headTopY + 15, 2, 1, '#a66549');
    }

    // 5. DETAILED HAIR & CURVED CAP PER HERO (Front & Back!)
    if (heroId === 'red' && pal.cap) {
      if (!isBack) {
        // Spiky black sideburns & bangs peeking out naturally under the cap brim!
        px(14, headTopY + 6, 3, 7, pal.hair[1]);
        px(14, headTopY + 7, 1, 5, pal.hair[0]);
        px(15, headTopY + 12, 2, 2, pal.hair[2]);
        px(31, headTopY + 6, 3, 7, pal.hair[2]);
        px(31, headTopY + 7, 1, 5, pal.hair[1]);
        // Forehead bangs & subtle cap brim shadow
        px(17, headTopY + 6, 14, 2, pal.skin[2]);
        px(16, headTopY + 5, 3, 3, pal.hair[1]);
        px(19, headTopY + 6, 2, 2, pal.hair[0]);
        px(27, headTopY + 6, 2, 2, pal.hair[1]);
        px(29, headTopY + 5, 3, 3, pal.hair[2]);

        // Curved Trainer Cap Dome (3-tone shading)
        disc(24, headTopY + 3, 9.8, 6.2, pal.cap[1]);
        disc(21, headTopY + 1, 5.5, 3.6, pal.cap[0]); // sunlit crown highlight
        px(30, headTopY + 1, 4, 5, pal.cap[2]); // shaded right curve
        // Crisp curved white front panel + red Pokéball arc emblem!
        px(19, headTopY, 10, 5, pal.capFront ?? '#ffffff');
        px(20, headTopY - 1, 8, 1, pal.capFront ?? '#ffffff');
        px(21, headTopY + 1, 6, 1, pal.cap[1]); // Pokéball upper red curve
        px(20, headTopY + 2, 8, 1, pal.cap[1]);
        px(23, headTopY + 2, 2, 1, '#ffffff'); // center button gleam
        // Curved cap brim/visor sweeping across forehead!
        px(14, headTopY + 5, 20, 2, pal.cap[2]);
        px(16, headTopY + 4, 16, 2, pal.cap[1]);
        px(17, headTopY + 4, 10, 1, pal.cap[0]);
      } else {
        // Back view: layered jet-black spiky hair nape + full rounded red cap + white rear strap
        disc(24, headTopY + 10, 9.2, 7.6, pal.hair[1]);
        px(16, headTopY + 12, 4, 5, pal.hair[0]);
        px(28, headTopY + 11, 5, 6, pal.hair[2]);
        // Spiky nape tufts
        px(16, headTopY + 16, 3, 2, pal.hair[1]);
        px(21, headTopY + 17, 3, 2, pal.hair[1]);
        px(26, headTopY + 16, 3, 2, pal.hair[2]);
        // Full rounded cap dome + rear adjustment strap
        disc(24, headTopY + 4, 9.8, 6.8, pal.cap[1]);
        disc(21, headTopY + 2, 5.5, 3.8, pal.cap[0]);
        px(29, headTopY + 2, 5, 7, pal.cap[2]);
        px(15, headTopY + 8, 18, 2, pal.cap[2]);
        px(20, headTopY + 8, 8, 2, pal.capFront ?? '#ffffff'); // white back strap
        px(22, headTopY + 7, 4, 1, pal.hair[1]); // cap keyhole
      }
    } else if (heroId === 'misty') {
      // Misty's vibrant ginger bob + bouncy asymmetrical high side ponytail!
      const ponyBob = isJump ? -3 : isWalk0 ? -1 : isWalk1 ? 1 : isIdle1 ? 1 : 0;
      // High side ponytail on left with sculpted curved layers & crimson hair tie
      disc(11, headTopY + 4 + ponyBob, 4.4, 3.8, pal.hair[1]);
      disc(12, headTopY + 2 + ponyBob, 2.8, 2.2, pal.hair[0]);
      px(7, headTopY + 6 + ponyBob, 4, 4, pal.hair[2]);
      px(6, headTopY + 8 + ponyBob, 3, 3, pal.hair[1]);
      px(14, headTopY + 3 + ponyBob, 2, 3, '#e63333'); // crimson hair band

      if (!isBack) {
        disc(24, headTopY + 4, 9.6, 6.4, pal.hair[1]);
        disc(21, headTopY + 1, 5.5, 3.2, pal.hair[0]);
        px(14, headTopY + 5, 3, 10, pal.hair[1]);
        px(14, headTopY + 6, 1, 7, pal.hair[0]);
        px(31, headTopY + 5, 3, 10, pal.hair[2]);
        // Feathered anime fringe bangs
        px(16, headTopY + 5, 4, 4, pal.hair[0]);
        px(20, headTopY + 4, 4, 4, pal.hair[1]);
        px(24, headTopY + 5, 4, 4, pal.hair[1]);
        px(28, headTopY + 5, 3, 4, pal.hair[2]);
      } else {
        disc(24, headTopY + 8, 9.8, 9.2, pal.hair[1]);
        disc(21, headTopY + 3, 6.2, 4.2, pal.hair[0]);
        px(28, headTopY + 5, 6, 12, pal.hair[2]);
        px(16, headTopY + 16, 16, 2, pal.hair[2]);
      }
    } else if (heroId === 'brock') {
      // Sculpted 7-spike anime hair crown
      const drawSpikes = () => {
        const spikes: [number, number, number, number][] = [
          [12, headTopY + 3, 4, 5],
          [14, headTopY - 1, 4, 6],
          [18, headTopY - 4, 4, 7],
          [22, headTopY - 5, 4, 7],
          [26, headTopY - 4, 4, 7],
          [30, headTopY - 1, 4, 6],
          [32, headTopY + 3, 4, 5],
        ];
        for (const [sx, sy, sw, sh] of spikes) {
          px(sx, sy, sw, sh, pal.hair[1]);
          px(sx + 1, sy - 1, 2, 2, pal.hair[0]); // sharp 1-2px sunlit spike tip
          px(sx + sw - 1, sy + 1, 1, sh - 1, pal.hair[2]);
        }
      };
      if (!isBack) {
        disc(24, headTopY + 4, 9.5, 5.5, pal.hair[1]);
        drawSpikes();
        px(14, headTopY + 5, 3, 6, pal.hair[1]);
        px(31, headTopY + 5, 3, 6, pal.hair[2]);
        px(17, headTopY + 6, 14, 2, pal.hair[1]);
      } else {
        disc(24, headTopY + 9, 9.6, 8.6, pal.hair[1]);
        drawSpikes();
        px(28, headTopY + 5, 6, 12, pal.hair[2]);
      }
    } else {
      // Rival Blue: stylish windswept chestnut spiky locks!
      if (!isBack) {
        disc(24, headTopY + 4, 9.8, 6.2, pal.hair[1]);
        disc(21, headTopY + 1, 5.8, 3.2, pal.hair[0]);
        // Asymmetric windswept front spikes
        px(13, headTopY + 4, 4, 8, pal.hair[0]);
        px(12, headTopY + 7, 3, 4, pal.hair[1]);
        px(16, headTopY + 5, 4, 4, pal.hair[0]);
        px(20, headTopY + 6, 3, 3, pal.hair[1]);
        px(24, headTopY + 5, 4, 4, pal.hair[1]);
        px(28, headTopY + 4, 5, 7, pal.hair[2]);
        px(32, headTopY + 2, 4, 4, pal.hair[1]); // iconic right swoop spike
        px(34, headTopY + 1, 2, 2, pal.hair[0]);
      } else {
        disc(24, headTopY + 8, 9.8, 9.0, pal.hair[1]);
        disc(21, headTopY + 3, 6.2, 4.0, pal.hair[0]);
        px(11, headTopY + 5, 4, 5, pal.hair[0]);
        px(32, headTopY + 4, 4, 5, pal.hair[2]);
        px(28, headTopY + 5, 6, 12, pal.hair[2]);
        px(17, headTopY + 16, 4, 2, pal.hair[1]);
        px(25, headTopY + 16, 5, 2, pal.hair[2]);
      }
    }
  } else {
    // =========================================================================
    // SIDE PROFILE VIEW ('right', cleanly mirrored horizontally for 'left')
    // =========================================================================

    // 1. BACK ARM (shaded deeper behind torso for authentic 3D depth)
    if (isJump) {
      px(13, torsoY, 6, 4, sleeveDark);
      px(11, torsoY - 2, 4, 3, pal.skin[2]);
    } else if (isWalk0) {
      // Back arm swinging forward
      px(26, torsoY + 2, 5, 5, sleeveDark);
      px(30, torsoY + 5, 4, 3, pal.skin[2]);
    } else if (isWalk1) {
      // Back arm swinging backward
      px(15, torsoY + 3, 5, 5, sleeveDark);
      px(13, torsoY + 7, 3, 3, pal.skin[2]);
    }

    // 2. BACK LEG (true athletic knee-bend profile stride!)
    const drawSideLeg = (
      hipX: number,
      kneeX: number,
      footX: number,
      footY: number,
      isBackLeg: boolean,
    ) => {
      const pMain = isBackLeg ? pal.pants[2] : pal.pants[1];
      const pHi = isBackLeg ? pal.pants[1] : pal.pants[0];
      const pDark = pal.pants[2];
      const isShorts = heroId === 'misty';
      // Upper thigh (hip -> knee)
      const midY = Math.round((hipY + footY - 3) / 2);
      px(Math.min(hipX, kneeX), hipY, Math.abs(kneeX - hipX) + 5, midY - hipY + 2, pMain);
      px(Math.min(hipX, kneeX), hipY, 2, midY - hipY + 1, pHi);
      // Lower shin (knee -> ankle)
      const shinCol = isShorts ? (isBackLeg ? pal.skin[2] : pal.skin[1]) : pMain;
      const shinHi = isShorts ? pal.skin[0] : pHi;
      px(Math.min(kneeX, footX), midY, Math.abs(footX - kneeX) + 5, footY - midY, shinCol);
      px(Math.min(kneeX, footX), midY, 2, footY - midY - 1, shinHi);
      if (!isShorts) {
        px(footX, footY - 2, 5, 1, pDark); // jeans cuff
      } else {
        px(footX + 1, footY - 2, 3, 2, '#ffffff'); // athletic sock
      }
      // Shaded side-profile sneaker with curved toe & crisp white sole!
      px(footX - 1, footY, 8, 3, isBackLeg ? pal.shoe[1] : pal.shoe[1]);
      px(footX, footY, 5, 2, isBackLeg ? pal.shoe[1] : pal.shoe[0]);
      px(footX + 3, footY, 2, 1, '#ffffff'); // laces
      px(footX - 1, footY + 3, 8, 1, pal.shoe[2]); // crisp white sole
    };

    if (isJump) {
      drawSideLeg(21, 16, 13, hipY + 7, true);
    } else if (isWalk0) {
      drawSideLeg(20, 17, 14, hipY + 10, true);
    } else if (isWalk1) {
      drawSideLeg(22, 26, 28, hipY + 10, true);
    } else {
      drawSideLeg(21, 21, 21, hipY + 10, true);
    }

    // 3. SCULPTED SIDE BACKPACK (on left side when facing right)
    px(12, torsoY + 1, 7, 11, pal.pack[1]);
    px(13, torsoY, 6, 12, pal.pack[1]);
    px(12, torsoY + 1, 3, 9, pal.pack[0]);
    px(16, torsoY + 2, 3, 10, pal.pack[2]);
    px(12, torsoY + 4, 7, 1, pal.pack[2]); // flap crease
    px(13, torsoY + 6, 2, 2, '#e2e8f0'); // side buckle
    if (heroId === 'brock') {
      px(12, torsoY - 2, 6, 3, '#dfd0ae');
      px(14, torsoY - 2, 2, 3, pal.packStrap);
    } else if (heroId !== 'misty') {
      // Tiny side Pokéball charm
      px(13, torsoY + 8, 3, 1, '#ef4444');
      px(13, torsoY + 9, 3, 1, '#ffffff');
    }

    // 4. FRONT LEG
    if (isJump) {
      drawSideLeg(23, 28, 29, hipY + 5, false);
    } else if (isWalk0) {
      drawSideLeg(22, 26, 28, hipY + 10, false);
    } else if (isWalk1) {
      drawSideLeg(21, 17, 14, hipY + 10, false);
    } else {
      drawSideLeg(22, 22, 22, hipY + 10, false);
    }

    // 5. SIDE TORSO & TAILORED JACKET PROFILE
    px(18, torsoY, 12, 13, pal.top[1]);
    px(18, torsoY, 4, 12, pal.top[0]);
    px(27, torsoY + 1, 3, 12, pal.top[2]);
    if (heroId === 'red') {
      px(26, torsoY + 1, 4, 10, pal.innerShirt[0]);
      px(22, torsoY - 1, 5, 3, pal.topAccent); // collar
      px(19, torsoY + 10, 8, 1, pal.topAccent); // white hem
      px(20, torsoY, 2, 8, pal.packStrap);
    } else if (heroId === 'misty') {
      px(22, torsoY, 2, 9, pal.topAccent);
      px(18, torsoY + 9, 12, 4, pal.pants[1]);
    } else if (heroId === 'brock') {
      px(26, torsoY + 1, 4, 10, pal.innerShirt[0]);
      px(21, torsoY + 6, 4, 3, pal.top[2]);
    } else {
      px(26, torsoY + 1, 4, 10, pal.innerShirt[0]);
      px(27, torsoY + 3, 2, 2, pal.topAccent);
      px(22, torsoY - 1, 5, 2, pal.top[2]);
    }
    if (heroId !== 'misty') {
      px(18, torsoY + 11, 12, 2, '#1d1e29');
      px(27, torsoY + 11, 3, 2, '#cbd5e1');
    }

    // 6. FRONT ARM (bent elbow + swinging naturally opposite to front leg!)
    if (isJump) {
      px(23, torsoY - 2, 6, 4, sleeveMid);
      px(23, torsoY - 2, 5, 2, sleeveHi);
      px(29, torsoY - 4, 4, 3, pal.skin[1]);
      px(29, torsoY - 4, 2, 2, pal.skin[0]);
    } else if (isWalk0) {
      // Front arm swinging back
      px(17, torsoY + 2, 5, 6, sleeveMid);
      px(17, torsoY + 2, 2, 5, sleeveHi);
      px(15, torsoY + 7, 4, 3, pal.skin[1]);
      px(15, torsoY + 7, 2, 2, pal.skin[0]);
    } else if (isWalk1) {
      // Front arm pumping forward
      px(23, torsoY + 2, 6, 5, sleeveMid);
      px(23, torsoY + 2, 4, 2, sleeveHi);
      px(28, torsoY + 5, 4, 3, pal.skin[1]);
      px(28, torsoY + 5, 2, 2, pal.skin[0]);
    } else {
      px(21, torsoY + 2 + breathe, 4, 8, sleeveMid);
      px(21, torsoY + 2 + breathe, 2, 7, sleeveHi);
      px(24, torsoY + 3 + breathe, 1, 7, sleeveDark);
      px(21, torsoY + 10 + breathe, 4, 3, pal.skin[1]);
      px(21, torsoY + 10 + breathe, 2, 2, pal.skin[0]);
    }

    // 7. SIDE PROFILE HEAD, EXPRESSIVE EYE, NOSE & SCULPTED HAIR/CAP
    px(21, headTopY + 18, 5, 3, pal.skin[1]);
    px(21, headTopY + 18, 5, 1, pal.skin[2]);
    disc(24, headTopY + 9, 8.2, 8.0, pal.skin[1]);
    disc(22, headTopY + 10, 4.2, 5.0, pal.skin[0]);
    px(29, headTopY + 11, 3, 6, pal.skin[1]);
    px(21, headTopY + 17, 9, 2, pal.skin[2]); // jaw/chin shadow
    // Delicate side-profile anime nose!
    px(32, headTopY + 11, 2, 2, pal.skin[1]);
    px(32, headTopY + 11, 1, 1, pal.skin[0]);
    px(30, headTopY + 15, 2, 1, '#a66549'); // mouth

    // Profile eye
    if (heroId === 'brock') {
      px(26, headTopY + 9, 4, 1, pal.hair[1]);
      px(26, headTopY + 11, 4, 1, pal.eyeDark);
    } else {
      px(27, headTopY + 9, 3, 1, pal.eyeDark);
      px(27, headTopY + 10, 3, 3, pal.eyeIris);
      px(28, headTopY + 11, 2, 2, pal.eyeDark);
      px(27, headTopY + 10, 1, 1, '#ffffff');
      px(26, headTopY + 13, 2, 1, pal.cheek);
    }

    // Side Hair & Cap per hero
    if (heroId === 'red' && pal.cap) {
      // Layered jet-black back hair + sideburn + ear
      disc(19, headTopY + 10, 5.5, 6.2, pal.hair[1]);
      px(14, headTopY + 11, 3, 5, pal.hair[0]);
      px(22, headTopY + 8, 4, 6, pal.hair[1]);
      px(22, headTopY + 11, 2, 3, pal.skin[1]); // ear
      px(29, headTopY + 6, 3, 2, pal.hair[2]); // front bang peeking under visor
      // Sculpted red cap dome + white front arc + projecting curved visor!
      disc(23, headTopY + 3, 9.2, 6.0, pal.cap[1]);
      disc(20, headTopY + 1, 5.2, 3.2, pal.cap[0]);
      px(27, headTopY, 5, 5, pal.capFront ?? '#ffffff');
      px(29, headTopY + 2, 3, 1, pal.cap[1]);
      // Curved projecting cap brim!
      px(24, headTopY + 5, 13, 2, pal.cap[2]);
      px(25, headTopY + 4, 11, 2, pal.cap[1]);
      px(26, headTopY + 4, 8, 1, pal.cap[0]);
    } else if (heroId === 'misty') {
      const ponyBob = isJump ? -3 : isWalk0 ? -1 : isWalk1 ? 1 : isIdle1 ? 1 : 0;
      disc(11, headTopY + 5 + ponyBob, 4.6, 3.8, pal.hair[1]);
      disc(12, headTopY + 3 + ponyBob, 2.8, 2.2, pal.hair[0]);
      px(7, headTopY + 7 + ponyBob, 4, 4, pal.hair[2]);
      px(15, headTopY + 4 + ponyBob, 2, 3, '#e63333');
      disc(23, headTopY + 4, 9.0, 6.2, pal.hair[1]);
      disc(20, headTopY + 1, 5.2, 3.0, pal.hair[0]);
      px(15, headTopY + 6, 9, 10, pal.hair[1]);
      px(16, headTopY + 7, 3, 7, pal.hair[0]);
      px(28, headTopY + 4, 4, 5, pal.hair[0]); // front bangs
    } else if (heroId === 'brock') {
      disc(23, headTopY + 4, 9.0, 5.4, pal.hair[1]);
      px(14, headTopY + 4, 9, 11, pal.hair[1]);
      px(13, headTopY + 1, 4, 5, pal.hair[0]);
      px(17, headTopY - 4, 4, 7, pal.hair[0]);
      px(22, headTopY - 5, 4, 7, pal.hair[1]);
      px(27, headTopY - 3, 4, 6, pal.hair[1]);
      px(22, headTopY + 7, 4, 5, pal.hair[2]);
      px(21, headTopY + 11, 2, 3, pal.skin[1]);
    } else {
      // Blue's swept side spikes!
      disc(23, headTopY + 4, 9.2, 6.0, pal.hair[1]);
      disc(20, headTopY + 1, 5.5, 3.0, pal.hair[0]);
      px(14, headTopY + 5, 9, 10, pal.hair[1]);
      px(11, headTopY + 7, 4, 4, pal.hair[0]);
      px(12, headTopY + 11, 4, 3, pal.hair[2]);
      px(28, headTopY + 4, 6, 4, pal.hair[1]); // iconic forward swoop
      px(31, headTopY + 3, 4, 2, pal.hair[0]);
      px(21, headTopY + 11, 2, 3, pal.skin[1]);
    }
  }

  applyHeroOutline(ctx, W, H, '#14141c');
}

const heroSpriteFramesCache: Partial<Record<HeroId, Record<string, THREE.CanvasTexture>>> = {};

export function getHeroSpriteFrames(heroId: HeroId): Record<string, THREE.CanvasTexture> {
  const existing = heroSpriteFramesCache[heroId];
  if (existing) return existing;

  const out: Record<string, THREE.CanvasTexture> = {};
  const dirs: FacingDir[] = ['down', 'up', 'left', 'right'];
  const poses: HeroPoseKey[] = ['idle0', 'idle1', '0', '1', 'jump'];
  const canvases: Record<string, HTMLCanvasElement> = {};

  for (const dir of dirs) {
    for (const pose of poses) {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 56;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      drawHeroPixelFrame(ctx, heroId, dir, pose);

      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      out[`${dir}_${pose}`] = tex;
      canvases[`${dir}_${pose}`] = canvas;
    }
  }

  // Upgrade live to authentic official GBA FireRed overworld walking sprite sheet (/sprites/heroes/{heroId}-ow.png)!
  if (typeof window !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const fw = 16;
        const fh = Math.max(16, img.naturalHeight);
        const cols = Math.max(1, Math.floor(img.naturalWidth / fw));
        // FireRed 9-col layout (144x32): 0=down_idle, 1=up_idle, 2=left_idle, 3=down_0, 4=down_1, 5=up_0, 6=up_1, 7=left_0, 8=left_1
        // FireRed 3-col layout (48x32):  0=down, 1=up, 2=left
        const hasWalk = cols >= 9;
        const pickCol = (dir: FacingDir, pose: HeroPoseKey): { col: number; flipX: boolean; dy: number } => {
          const baseDir = dir === 'right' ? 'left' : dir;
          const flipX = dir === 'right';
          if (hasWalk) {
            if (baseDir === 'down') {
              if (pose === '0' || pose === 'jump') return { col: 3, flipX, dy: pose === 'jump' ? -3 : 0 };
              if (pose === '1') return { col: 4, flipX, dy: 0 };
              return { col: 0, flipX, dy: pose === 'idle1' ? 1 : 0 };
            }
            if (baseDir === 'up') {
              if (pose === '0' || pose === 'jump') return { col: 5, flipX, dy: pose === 'jump' ? -3 : 0 };
              if (pose === '1') return { col: 6, flipX, dy: 0 };
              return { col: 1, flipX, dy: pose === 'idle1' ? 1 : 0 };
            }
            // left / mirrored right
            if (pose === '0' || pose === 'jump') return { col: 7, flipX, dy: pose === 'jump' ? -3 : 0 };
            if (pose === '1') return { col: 8, flipX, dy: 0 };
            return { col: 2, flipX, dy: pose === 'idle1' ? 1 : 0 };
          }
          // 3-column sheet (Misty / Brock)
          const col = baseDir === 'down' ? 0 : baseDir === 'up' ? 1 : Math.min(2, cols - 1);
          const dy = pose === 'jump' ? -4 : pose === '0' ? -2 : pose === '1' ? 0 : pose === 'idle1' ? 1 : 0;
          return { col, flipX, dy };
        };

        // Measure tight visible height on frame 0 so bottom-anchored integer scaling looks razor crisp!
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth;
        tmp.height = fh;
        const tctx = tmp.getContext('2d')!;
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, 0, 0);
        const pxData = tctx.getImageData(0, 0, fw, fh).data;
        let minY = fh;
        let maxY = -1;
        for (let y = 0; y < fh; y++) {
          for (let x = 0; x < fw; x++) {
            if (pxData[(y * fw + x) * 4 + 3] > 20) {
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        const visH = maxY >= minY ? maxY - minY + 1 : 24;
        const srcY = maxY >= minY ? minY : 0;
        const scale = Math.min(2.4, 48 / Math.max(16, visH));
        const dw = Math.round(fw * scale);
        const dh = Math.round(visH * scale);
        const dstX = Math.round((48 - dw) / 2);
        const dstBaseY = Math.round(54 - dh);

        for (const dir of dirs) {
          for (const pose of poses) {
            const key = `${dir}_${pose}`;
            const c = canvases[key];
            const ctx = c.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, 48, 56);
            const { col, flipX, dy } = pickCol(dir, pose);
            ctx.save();
            if (flipX) {
              ctx.translate(48, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(tmp, col * fw, srcY, fw, visH, dstX, dstBaseY + dy, dw, dh);
            ctx.restore();
            out[key].needsUpdate = true;
          }
        }
      } catch {
        // Keep procedural fallback if sheet cannot be decoded
      }
    };
    img.src = `/sprites/heroes/${heroId}-ow.png`;
  }

  heroSpriteFramesCache[heroId] = out;
  return out;
}

export function getTrainerRedSpriteFrames(): Record<string, THREE.CanvasTexture> {
  return getHeroSpriteFrames('red');
}

/**
 * Normalizes a list of raw sprite frame canvases to standardized 96x96 textures using
 * their shared tight non-transparent bounding box, scaled uniformly (Math.min(72/boxH, 80/boxW)),
 * horizontally centered, and bottom-anchored at y = 92 so front & back sprites match identically!
 */
function normalizeSpriteCanvasesTo96(rawCanvases: HTMLCanvasElement[]): THREE.CanvasTexture[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;

  for (const rc of rawCanvases) {
    const rctx = rc.getContext('2d');
    if (!rctx) continue;
    const { width, height } = rc;
    const data = rctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  const hasPixels = maxX >= minX && maxY >= minY;
  const outTextures: THREE.CanvasTexture[] = [];

  for (const rc of rawCanvases) {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 96, 96);
      if (hasPixels) {
        const boxW = Math.max(1, maxX - minX + 1);
        const boxH = Math.max(1, maxY - minY + 1);
        const scale = Math.min(72 / boxH, 80 / boxW);
        const drawW = Math.max(1, Math.round(boxW * scale));
        const drawH = Math.max(1, Math.round(boxH * scale));
        const dstX = Math.round((96 - drawW) / 2);
        const dstY = Math.round(92 - drawH);
        ctx.drawImage(rc, minX, minY, boxW, boxH, dstX, dstY, drawW, drawH);
      } else {
        ctx.drawImage(rc, 0, 0, 96, 96);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    outTextures.push(tex);
  }

  return outTextures;
}

/**
 * Decodes an animated PMD/Showdown Pokémon GIF into size-normalized 96x96 NearestFilter
 * THREE.CanvasTexture frames using browser-native WebCodecs ImageDecoder
 * (and also normalizes the static fallback PNG so front & back sprites always match!).
 */
export interface AnimatedSpriteSheet3D {
  frames: THREE.Texture[];
  durations: number[]; // seconds per frame
  totalDuration: number;
}

const animatedGifCache = new Map<string, AnimatedSpriteSheet3D>();
const textureLoader3D = new THREE.TextureLoader();

export function getAnimatedGifTextures(
  gifUrl: string,
  fallbackStaticUrl: string,
): AnimatedSpriteSheet3D {
  const existing = animatedGifCache.get(gifUrl);
  if (existing) return existing;

  let animatedDecoded = false;

  const entry: AnimatedSpriteSheet3D = {
    frames: [],
    durations: [0.16],
    totalDuration: 0.16,
  };

  const fallback = textureLoader3D.load(fallbackStaticUrl, (loadedTex) => {
    if (animatedDecoded) return;
    try {
      const img = loadedTex.image as HTMLImageElement | ImageBitmap | undefined;
      if (!img) return;
      const w = Math.max(1, img.width);
      const h = Math.max(1, img.height);
      const raw = document.createElement('canvas');
      raw.width = w;
      raw.height = h;
      const rctx = raw.getContext('2d');
      if (!rctx) return;
      rctx.imageSmoothingEnabled = false;
      rctx.drawImage(img, 0, 0, w, h);
      const [normTex] = normalizeSpriteCanvasesTo96([raw]);
      if (normTex && !animatedDecoded) {
        entry.frames = [normTex];
      }
    } catch {
      // Keep raw fallback texture if image is tainted or unreadable
    }
  });
  fallback.magFilter = THREE.NearestFilter;
  fallback.minFilter = THREE.NearestFilter;
  fallback.generateMipmaps = false;
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.wrapS = THREE.ClampToEdgeWrapping;
  fallback.wrapT = THREE.ClampToEdgeWrapping;

  entry.frames = [fallback];
  animatedGifCache.set(gifUrl, entry);

  // Decode all GIF frames asynchronously using native WebCodecs ImageDecoder
  type ImageDecoderCtor = new (init: { data: ArrayBuffer | ReadableStream; type: string }) => {
    completed: Promise<void>;
    tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
    decode: (opts: { frameIndex: number }) => Promise<{
      image: {
        displayWidth: number;
        displayHeight: number;
        duration?: number | null;
        close: () => void;
      } & CanvasImageSource;
    }>;
    close: () => void;
  };
  const DecoderCtor = (globalThis as unknown as { ImageDecoder?: ImageDecoderCtor }).ImageDecoder;
  if (!DecoderCtor || !gifUrl.endsWith('.gif')) return entry;

  void (async () => {
    try {
      const resp = await fetch(gifUrl);
      if (!resp.ok) return;
      const buf = await resp.arrayBuffer();
      const decoder = new DecoderCtor({ data: buf, type: 'image/gif' });
      await decoder.tracks.ready;
      const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
      if (count < 1) {
        decoder.close();
        return;
      }

      // Pass 1: decode every frame onto raw offscreen canvases first
      const rawCanvases: HTMLCanvasElement[] = [];
      const durations: number[] = [];
      let total = 0;
      for (let i = 0; i < count; i++) {
        const res = await decoder.decode({ frameIndex: i });
        const img = res.image;
        const w = Math.max(1, img.displayWidth);
        const h = Math.max(1, img.displayHeight);
        const raw = document.createElement('canvas');
        raw.width = w;
        raw.height = h;
        const ctx = raw.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
        }
        const durSec = Math.max(0.06, Math.min(0.45, ((img.duration ?? 110000) as number) / 1_000_000));
        img.close();

        rawCanvases.push(raw);
        durations.push(durSec);
        total += durSec;
      }
      decoder.close();

      // Pass 2: compute shared tight alpha bbox across all frames & normalize to 96x96 (bottom y = 92)
      if (rawCanvases.length >= 1) {
        const normalizedFrames = normalizeSpriteCanvasesTo96(rawCanvases);
        animatedDecoded = true;
        entry.frames = normalizedFrames;
        entry.durations = durations;
        entry.totalDuration = Math.max(0.1, total);
      }
    } catch {
      // Gracefully keep normalized static fallback frame
    }
  })();

  return entry;
}

export function sampleAnimatedFrame(sheet: AnimatedSpriteSheet3D, timeSec: number): THREE.Texture {
  if (sheet.frames.length <= 1) return sheet.frames[0];
  let t = timeSec % sheet.totalDuration;
  if (t < 0) t += sheet.totalDuration;
  for (let i = 0; i < sheet.frames.length; i++) {
    t -= sheet.durations[i];
    if (t <= 0) return sheet.frames[i];
  }
  return sheet.frames[0];
}

/**
 * Custom GLSL Slope-Blended Pixel-Art Canyon ShaderMaterial (PokéBonk-grade):
 * - Rich lush emerald meadow grass with organic sunlit patches & dappled canopy shade
 * - Dramatic stratified sandstone/earth rock cliff walls with crisp horizontal strata & overhangs
 * - Organic winding sandy forest trail instead of rigid grid highways
 */
/**
 * Minecraft-style Continuous World-Space Multi-Biome Field (Temperature × Moisture × Elevation):
 * - Near spawn (r < 34m), keeps the chosen starting `baseBiome` pure.
 * - Exploring outward smoothly transitions across connected Snow Mountains, Golden Deserts,
 *   Volcanic Lava Peaks, Tropical Coasts, and Lush Forests with zero seams!
 */
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

  if (wy > 10.4 && temp < 0.68) return 'sky_glacier';
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
      uFogNear: { value: 86.0 },
      uFogFar: { value: 215.0 },
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

      void main() {
        vec3 n = normalize(vWorldNormal);

        // Preserve crisp pixel-art texel micro-detail from ground & cliff sheets
        vec2 groundUv = vWorldPos.xz * 0.24;
        vec3 baseTexCol = texture2D(uGroundTex, groundUv).rgb;
        float texLuma = clamp(dot(baseTexCol, vec3(0.3, 0.59, 0.11)) / 0.56, 0.72, 1.24);
        float meadowPatch = sin(vWorldPos.x * 0.09) * cos(vWorldPos.z * 0.09) * 0.5 + 0.5;

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

        // Gentle, wide transition bands between macro biomes (zero harsh grass->snow->lava jumps!)
        float wSnow = clamp(
          (1.0 - smoothstep(0.18, 0.34, temp)) +
          smoothstep(9.2, 12.0, vWorldPos.y) * (1.0 - smoothstep(0.62, 0.76, temp)),
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

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 24), skyMat);
  skyDome.renderOrder = -20;
  group.add(skyDome);

  // Pure open sky dome — ZERO fake surrounding mountain walls! The actual procedural 3D terrain mesh forms every hill, mountain & open plain organically.
  group.userData.skyUniforms = skyMat.uniforms;
  return group;
}
