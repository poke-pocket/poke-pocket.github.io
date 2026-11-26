import * as THREE from 'three';

export function makePixelTex(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export interface TownGroundTex {
  cobblePlaza: THREE.CanvasTexture;
  roadTile: THREE.CanvasTexture;
  boulevard4Lane: THREE.CanvasTexture;
  collector2Lane: THREE.CanvasTexture;
  alleyCobble: THREE.CanvasTexture;
  junctionAsphalt: THREE.CanvasTexture;
  highwayTile: THREE.CanvasTexture;
  crosswalk: THREE.CanvasTexture;
  pcSign: THREE.CanvasTexture;
  martSign: THREE.CanvasTexture;
  hotelSign: THREE.CanvasTexture;
  cafeSign: THREE.CanvasTexture;
  extraSigns: THREE.CanvasTexture[];
  busSign: THREE.CanvasTexture;
  clinicFloor: THREE.CanvasTexture;
  martFloor: THREE.CanvasTexture;
  woodFloor: THREE.CanvasTexture;
  skyGlassTex: THREE.CanvasTexture;
  awningRed: THREE.CanvasTexture;
  awningBlue: THREE.CanvasTexture;
  awningGold: THREE.CanvasTexture;
  urbanShrubs: THREE.CanvasTexture[];
}

let CACHED_GROUND_TEX: TownGroundTex | null = null;

export function getGroundTex(): TownGroundTex {
  if (CACHED_GROUND_TEX) return CACHED_GROUND_TEX;

  const makeSign = (bg: string, txt: string, fg = '#ffffff') =>
    makePixelTex(96, 28, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 96, 28);
      // Subtle top pixel bevel highlight
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(3, 3, 90, 4);
      ctx.strokeStyle = '#141926';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, 93, 25);
      ctx.fillStyle = '#141926';
      ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 49, 15.5);
      ctx.fillStyle = fg;
      ctx.fillText(txt, 48, 14.5);
    });

  const cobblePlaza = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#ddd3be';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#c4b89c';
      for (let y = 0; y < 32; y += 8) {
        ctx.fillRect(0, y, 32, 1);
        for (let x = (y % 16 === 0 ? 0 : 4); x < 32; x += 8) ctx.fillRect(x, y, 1, 8);
      }
      ctx.fillStyle = '#ece3d0';
      ctx.fillRect(2, 2, 5, 5);
      ctx.fillRect(18, 10, 5, 5);
      ctx.fillRect(10, 26, 5, 5);
    },
    13,
    13,
  );

  const drawRoadCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#5c6472';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#d7d0be';
    ctx.fillRect(0, 0, 32, 3);
    ctx.fillRect(0, 29, 32, 3);
    ctx.fillStyle = '#8b93a1';
    ctx.fillRect(0, 3, 32, 1);
    ctx.fillRect(0, 28, 32, 1);
    ctx.fillStyle = '#f5ecd4';
    ctx.fillRect(3, 15, 10, 2);
    ctx.fillRect(19, 15, 10, 2);
  };

  // 1. Grand 4-Lane City Boulevard with EXTRA-WIDE Single Lanes (~5.3m each = 2.4x Red's width!), Wide Sidewalks & Lush Central Median!
  const boulevard4Lane = makePixelTex(
    128,
    128,
    (ctx) => {
      // Wide Paved Pedestrian Sidewalks (y=0..15, y=113..128) with tactile guide strip & tile seams
      ctx.fillStyle = '#e0d8c8';
      ctx.fillRect(0, 0, 128, 16);
      ctx.fillRect(0, 112, 128, 16);
      ctx.fillStyle = '#c8bfb0';
      for (let x = 0; x < 128; x += 16) {
        ctx.fillRect(x, 0, 1, 16);
        ctx.fillRect(x, 112, 1, 16);
      }
      ctx.fillStyle = '#f2cc5a';
      ctx.fillRect(0, 7, 128, 2);
      ctx.fillRect(0, 119, 128, 2);
      // Curb stones
      ctx.fillStyle = '#8b92a0';
      ctx.fillRect(0, 15, 128, 2);
      ctx.fillRect(0, 111, 128, 2);

      // Extra-Wide 2+2 Carriageway Asphalt (y=17..111) — each single lane is 20px (~5.3m wide!)
      ctx.fillStyle = '#4a5260';
      ctx.fillRect(0, 17, 128, 94);
      // Gutter shadows
      ctx.fillStyle = '#363d48';
      ctx.fillRect(0, 17, 128, 2);
      ctx.fillRect(0, 109, 128, 2);
      // Subtle asphalt speckle
      ctx.fillStyle = '#424956';
      for (let i = 0; i < 85; i++) {
        ctx.fillRect((i * 23) % 125, 19 + ((i * 17) % 88), 2, 1);
      }
      // Crisp pixel storm-drain grates along curbs & iron manhole cover
      ctx.fillStyle = '#252a33';
      ctx.fillRect(18, 18, 7, 3);
      ctx.fillRect(86, 107, 7, 3);
      ctx.fillStyle = '#6c757d';
      ctx.fillRect(20, 18, 1, 3);
      ctx.fillRect(22, 18, 1, 3);
      ctx.fillRect(88, 107, 1, 3);
      ctx.fillRect(90, 107, 1, 3);
      ctx.fillStyle = '#2c323d';
      ctx.fillRect(62, 43, 6, 6);
      ctx.fillStyle = '#5c6473';
      ctx.fillRect(63, 44, 4, 4);
      ctx.fillStyle = '#2c323d';
      ctx.fillRect(64, 45, 2, 2);

      // Crisp white pixel lane-direction arrows centered in each wide lane
      ctx.fillStyle = 'rgba(241, 243, 245, 0.72)';
      ctx.fillRect(98, 26, 9, 2);
      ctx.fillRect(96, 25, 2, 4);
      ctx.fillRect(94, 26, 2, 2);
      ctx.fillRect(22, 99, 9, 2);
      ctx.fillRect(31, 98, 2, 4);
      ctx.fillRect(33, 99, 2, 2);

      // 2 EXTRA-WIDE Lanes each direction (1 crisp dashed white lane divider per carriageway!)
      ctx.fillStyle = '#f1f3f5';
      for (let x = 6; x < 128; x += 28) {
        ctx.fillRect(x, 36, 15, 2);
        ctx.fillRect(x, 90, 15, 2);
      }

      // Lush Central Green Median Strip (y=58..70) with clean double yellow curbs + pixel grass tufts!
      ctx.fillStyle = '#fcc419';
      ctx.fillRect(0, 56, 128, 2);
      ctx.fillRect(0, 70, 128, 2);
      ctx.fillStyle = '#37a84f';
      ctx.fillRect(0, 58, 128, 12);
      ctx.fillStyle = '#51cf66';
      ctx.fillRect(8, 60, 18, 3);
      ctx.fillRect(58, 64, 22, 3);
      ctx.fillRect(96, 60, 16, 3);
      ctx.fillStyle = '#2b8a3e';
      ctx.fillRect(30, 62, 10, 3);
      ctx.fillRect(84, 61, 10, 3);
    },
    1,
    1,
  );

  // 2. Wide 2-Lane Collector Street (1 Extra-Wide ~5.2m Lane Each Direction + Double Yellow Centerline + Wide Sidewalks!)
  const collector2Lane = makePixelTex(
    64,
    64,
    (ctx) => {
      // Wide Pedestrian Sidewalks
      ctx.fillStyle = '#dfd7c6';
      ctx.fillRect(0, 0, 64, 10);
      ctx.fillRect(0, 54, 64, 10);
      ctx.fillStyle = '#c8bfb0';
      for (let x = 0; x < 64; x += 16) {
        ctx.fillRect(x, 0, 1, 10);
        ctx.fillRect(x, 54, 1, 10);
      }
      // Roadside planting strip + curb
      ctx.fillStyle = '#40b058';
      ctx.fillRect(0, 9, 64, 2);
      ctx.fillRect(0, 53, 64, 2);
      ctx.fillStyle = '#8b93a1';
      ctx.fillRect(0, 11, 64, 1);
      ctx.fillRect(0, 52, 64, 1);
      // Wide 2-Lane Asphalt (y=12..52) — 19px per single lane (~5.3m wide!)
      ctx.fillStyle = '#505866';
      ctx.fillRect(0, 12, 64, 40);
      ctx.fillStyle = '#3a414d';
      ctx.fillRect(0, 12, 64, 1);
      ctx.fillRect(0, 51, 64, 1);
      ctx.fillStyle = '#474f5c';
      for (let i = 0; i < 28; i++) {
        ctx.fillRect((i * 17) % 62, 14 + ((i * 11) % 35), 2, 1);
      }
      ctx.fillStyle = '#252a33';
      ctx.fillRect(28, 13, 5, 2);
      ctx.fillRect(12, 49, 5, 2);
      // Crisp double yellow center divider (wide spacious single lane on each side!)
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(0, 30, 64, 1);
      ctx.fillRect(0, 33, 64, 1);
    },
    1,
    1,
  );

  // 3. Cozy Pedestrian Cobblestone Alley with Planter Curbs!
  const alleyCobble = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#c8beaa';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#45a858';
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillStyle = '#b4a992';
      for (let y = 4; y < 28; y += 6) {
        for (let x = (y % 12 === 4 ? 0 : 4); x < 32; x += 8) {
          ctx.fillRect(x, y, 6, 4);
        }
      }
      ctx.fillStyle = '#dfd7c6';
      for (let y = 5; y < 27; y += 6) {
        ctx.fillRect(2, y, 3, 2);
        ctx.fillRect(18, y, 3, 2);
      }
    },
    1,
    1,
  );

  // 4. Clean Asphalt Intersection Pad with Crisp White Zebra Crosswalks on all 4 Approaches (ZERO overlapping curbs!)
  const junctionAsphalt = makePixelTex(
    64,
    64,
    (ctx) => {
      ctx.fillStyle = '#4c5462';
      ctx.fillRect(0, 0, 64, 64);
      // Subtle intersection corner stone aprons
      ctx.fillStyle = '#d7d0be';
      ctx.fillRect(0, 0, 7, 7);
      ctx.fillRect(57, 0, 7, 7);
      ctx.fillRect(0, 57, 7, 7);
      ctx.fillRect(57, 57, 7, 7);
      // Crisp white zebra crosswalk stripes on North, South, East, West edges!
      ctx.fillStyle = '#f8f9fa';
      for (let i = 11; i <= 50; i += 6) {
        ctx.fillRect(i, 2, 3, 7);   // North crosswalk
        ctx.fillRect(i, 55, 3, 7);  // South crosswalk
        ctx.fillRect(2, i, 7, 3);   // West crosswalk
        ctx.fillRect(55, i, 7, 3);  // East crosswalk
      }
      // Stop lines
      ctx.fillStyle = '#dee2e6';
      ctx.fillRect(11, 11, 42, 1);
      ctx.fillRect(11, 52, 42, 1);
      ctx.fillRect(11, 11, 1, 42);
      ctx.fillRect(52, 11, 1, 42);
    },
    1,
    1,
  );

  const roadTile = makePixelTex(32, 32, drawRoadCanvas, 12, 1);
  const highwayTile = makePixelTex(32, 32, drawRoadCanvas, 1, 1);

  const crosswalk = makePixelTex(32, 32, (ctx) => {
    ctx.fillStyle = '#5c6472';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#faf6eb';
    for (let y = 4; y < 28; y += 6) ctx.fillRect(4, y, 24, 3);
  });

  const busSign = makePixelTex(32, 32, (ctx) => {
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#1b1f2a';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 29, 29);
    ctx.fillStyle = '#1b1f2a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BUS', 16, 16);
  });

  const clinicFloor = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#fff5f5';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#ffe3e3';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillRect(16, 16, 16, 16);
      ctx.fillStyle = '#ffc9c9';
      ctx.fillRect(0, 15, 32, 1);
      ctx.fillRect(15, 0, 1, 32);
    },
    5,
    5,
  );

  const martFloor = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#f1f7fe';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#dbeeff';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillRect(16, 16, 16, 16);
      ctx.fillStyle = '#a5d8ff';
      ctx.fillRect(0, 15, 32, 1);
      ctx.fillRect(15, 0, 1, 32);
    },
    5,
    5,
  );

  const woodFloor = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#d4a373';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#bc8a5f';
      for (let y = 0; y < 32; y += 8) ctx.fillRect(0, y, 32, 2);
      ctx.fillStyle = '#e6ccb2';
      ctx.fillRect(2, 3, 12, 3);
      ctx.fillRect(18, 11, 12, 3);
    },
    4,
    4,
  );

  // Crisp HD-2D Pixel-Art Glass Curtain-Wall Texture for Lujiazui / Downtown Skyscrapers!
  const skyGlassTex = makePixelTex(
    64,
    128,
    (ctx) => {
      ctx.fillStyle = '#2b5d8f';
      ctx.fillRect(0, 0, 64, 128);
      for (let y = 0; y < 128; y += 8) {
        // Horizontal steel floor slab spandrel
        ctx.fillStyle = '#1d3c5e';
        ctx.fillRect(0, y, 64, 2);
        for (let x = 0; x < 64; x += 8) {
          // Vertical mullion
          ctx.fillStyle = '#193554';
          ctx.fillRect(x, y, 1, 8);
          const hash = ((x * 37 + y * 91) >>> 0) % 13;
          // Sunlit sky-blue reflection band + occasional warm-lit office windows!
          const diagShine = (x + y) % 32 < 10;
          ctx.fillStyle =
            hash === 0 || hash === 5
              ? '#ffe066'
              : hash === 9
                ? '#ffd8a8'
                : diagShine
                  ? '#74c0fc'
                  : '#4dabf7';
          ctx.fillRect(x + 1, y + 2, 6, 5);
          // 1px specular window highlight
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x + 1, y + 2, 6, 1);
        }
      }
    },
    2,
    3,
  );

  const makeAwning = (c1: string, c2: string) =>
    makePixelTex(32, 16, (ctx) => {
      for (let x = 0; x < 32; x += 8) {
        ctx.fillStyle = (x / 8) % 2 === 0 ? c1 : c2;
        ctx.fillRect(x, 0, 8, 14);
        ctx.fillStyle = '#181c28';
        ctx.fillRect(x, 14, 8, 2);
      }
    }, 2, 1);

  // 8 Crisp Black-Outlined GBA Pixel-Art Urban Landscaping Shrubs (ZERO fallen wilderness logs!)
  // Matches the user's preferred crisp pixel bush style: Boxwood, Golden Privet, Red-Tip Photinia, Pink Azalea, Yellow Forsythia, Blue Hydrangea, Trimmed Hedge & Deep Pine Mound!
  const makeUrbanShrub = (
    dark: string,
    mid: string,
    light: string,
    hi: string,
    shape: 'round' | 'hedge' | 'wide',
    bloom?: string,
  ) =>
    makePixelTex(
      24,
      20,
      (ctx) => {
        const px = (x: number, y: number, w: number, h: number, col: string) => {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, w, h);
        };
        const fillBlob = (mask: [number, number, number, number][], col: string) => {
          ctx.fillStyle = col;
          for (const [x, y, w, h] of mask) ctx.fillRect(x, y, w, h);
        };
        if (shape === 'hedge') {
          // Crisp trimmed urban rectangular box hedge with 1px black pixel outline
          px(2, 5, 20, 14, '#141923');
          px(3, 4, 18, 15, '#141923');
          px(3, 6, 18, 12, dark);
          px(4, 5, 16, 11, mid);
          px(4, 5, 16, 5, light);
          px(6, 5, 6, 2, hi);
          px(14, 6, 4, 2, hi);
          // Leaf cluster texture accents
          px(6, 11, 3, 2, dark);
          px(13, 12, 3, 2, dark);
          px(10, 9, 2, 1, dark);
        } else if (shape === 'wide') {
          // Lush double-mound flowering city bush
          const out: [number, number, number, number][] = [
            [2, 9, 20, 9],
            [4, 6, 16, 12],
            [6, 4, 5, 4],
            [13, 5, 5, 4],
          ];
          fillBlob(out, '#141923');
          px(3, 10, 18, 7, dark);
          px(5, 7, 14, 9, mid);
          px(7, 5, 4, 4, light);
          px(13, 6, 4, 4, light);
          px(5, 8, 14, 4, light);
          px(7, 6, 3, 2, hi);
          px(14, 7, 2, 2, hi);
          px(7, 13, 3, 2, dark);
          px(14, 12, 3, 2, dark);
        } else {
          // Classic round GBA pixel bush (exact Screenshot 3 aesthetic!)
          const out: [number, number, number, number][] = [
            [4, 8, 16, 10],
            [6, 5, 12, 14],
            [8, 3, 8, 16],
          ];
          fillBlob(out, '#141923');
          px(5, 9, 14, 8, dark);
          px(7, 6, 10, 10, mid);
          px(9, 4, 6, 6, light);
          px(6, 7, 12, 4, light);
          px(8, 5, 3, 2, hi);
          px(12, 6, 2, 1, hi);
          px(8, 12, 2, 2, dark);
          px(13, 12, 2, 2, dark);
        }
        if (bloom) {
          px(6, 8, 2, 2, bloom);
          px(11, 6, 2, 2, bloom);
          px(15, 9, 2, 2, bloom);
          px(9, 11, 2, 2, bloom);
          px(14, 12, 2, 2, bloom);
          px(7, 8, 1, 1, '#ffffff');
          px(12, 6, 1, 1, '#ffffff');
        }
      },
      1,
      1,
    );

  const urbanShrubs: THREE.CanvasTexture[] = [
    makeUrbanShrub('#1c6b2d', '#2ca03c', '#59cf48', '#a3f062', 'round'),           // 1. 翠绿冬青球
    makeUrbanShrub('#5e8c1e', '#8ec42a', '#c3e848', '#ebff85', 'round'),           // 2. 金叶女贞球
    makeUrbanShrub('#5e1928', '#9c263b', '#d94854', '#ff8787', 'wide'),            // 3. 红叶石楠/红继木
    makeUrbanShrub('#1d6930', '#2e9c44', '#56c75e', '#94eb88', 'wide', '#ff6b9e'), // 4. 粉红杜鹃花丛
    makeUrbanShrub('#226b2d', '#339e3f', '#5cc954', '#9bf084', 'round', '#ffe066'),// 5. 迎春黄花灌木
    makeUrbanShrub('#1a5934', '#28854c', '#45b56c', '#82e09e', 'wide', '#74c0fc'), // 6. 蓝白绣球花丛
    makeUrbanShrub('#185c29', '#278f3c', '#4cbf52', '#8ce87c', 'hedge'),           // 7. 修剪方绿篱
    makeUrbanShrub('#14472c', '#1e7044', '#339c5f', '#66cc88', 'round'),           // 8. 深绿常青矮松
  ];

  CACHED_GROUND_TEX = {
    cobblePlaza,
    roadTile,
    boulevard4Lane,
    collector2Lane,
    alleyCobble,
    junctionAsphalt,
    highwayTile,
    crosswalk,
    pcSign: makeSign('#e03131', '宝可梦中心'),
    martSign: makeSign('#1971c2', '友好商店'),
    hotelSign: makeSign('#e67700', '驿站酒店'),
    cafeSign: makeSign('#d9480f', '树果饭店'),
    extraSigns: [
      makeSign('#2b8a3e', '便民茶室'),
      makeSign('#c2255c', '烘焙工坊'),
      makeSign('#5f3dc4', '旧书屋'),
      makeSign('#e67700', '拉面馆'),
      makeSign('#0b7285', '花艺铺'),
      makeSign('#a61e4d', '奶茶铺'),
    ],
    busSign,
    clinicFloor,
    martFloor,
    woodFloor,
    skyGlassTex,
    awningRed: makeAwning('#e03131', '#fff5f5'),
    awningBlue: makeAwning('#1c7ed6', '#e7f5ff'),
    awningGold: makeAwning('#f08c00', '#fff9db'),
    urbanShrubs,
  };
  return CACHED_GROUND_TEX;
}

