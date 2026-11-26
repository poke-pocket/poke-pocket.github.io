import * as THREE from 'three';
import {
  BIOME_PALETTES,
  hash2,
  loadWorldPropTex,
  makePixelCanvas,
  type BiomeId,
  type BiomeTextureSet,
} from './biomePalettesAndWater';

const biomeCache = new Map<BiomeId, BiomeTextureSet>();

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
