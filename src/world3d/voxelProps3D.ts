import * as THREE from 'three';

/**
 * GBA / Pokémon RSE Voxel & Pixel-Art 3D Furniture & Prop Engine (`体素与像素贴图 3D 家具引擎`):
 * - Inspired directly by GBA Ruby/Sapphire/Emerald 3D Voxel-Pixel Dioramas (e.g. Wesai's RSE Pokémon Center).
 * - Every prop is constructed from crisp voxel cuboids + nearest-neighbor pixel-art textures with dark `#1b1f2e`
 *   ink borders and calibrated ergonomically against Protagonist Red's height (`CHAR_H = 2.40` world units):
 *     * Cushioned Stools / Chair Seats: `0.58–0.64u` (knee height)
 *     * Coffee Tables / Beds: `0.62–0.82u`
 *     * Dining Tables / Desks: `0.94u`
 *     * Reception Counters / Bars: `1.04u` (waist height — Nurse Joy & Clerks are 65%+ visible, never cut in half!)
 *     * Bookshelves / Fridges / Gondolas: `1.88–2.05u`
 */

const VOXEL_TEX_CACHE = new Map<string, THREE.CanvasTexture>();
const VOXEL_INK_EDGE_MAT = new THREE.LineBasicMaterial({
  color: 0x181c2b,
  transparent: true,
  opacity: 0.78,
});

function getVoxelPixelTex(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const cached = VOXEL_TEX_CACHE.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  VOXEL_TEX_CACHE.set(key, tex);
  return tex;
}

function makeFramedVoxelFaceMat(
  key: string,
  fillHex: string,
  highlightHex: string,
  shadowHex: string,
  innerDetail?: (ctx: CanvasRenderingContext2D) => void,
  emissiveHex?: number,
): THREE.MeshLambertMaterial {
  const tex = getVoxelPixelTex(key, 32, 32, (ctx) => {
    ctx.fillStyle = fillHex;
    ctx.fillRect(0, 0, 32, 32);
    // Top/left pixel highlight & bottom/right pixel shade (RSE sprite bevel!)
    ctx.fillStyle = highlightHex;
    ctx.fillRect(1, 1, 30, 2);
    ctx.fillRect(1, 1, 2, 30);
    ctx.fillStyle = shadowHex;
    ctx.fillRect(1, 29, 30, 2);
    ctx.fillRect(29, 1, 2, 30);
    // Crisp 1px dark pixel-art ink border
    ctx.fillStyle = '#1b1f2e';
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 31, 32, 1);
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillRect(31, 0, 1, 32);
    innerDetail?.(ctx);
  });
  return new THREE.MeshLambertMaterial({
    map: tex,
    emissive: emissiveHex !== undefined ? new THREE.Color(emissiveHex) : undefined,
    emissiveIntensity: emissiveHex !== undefined ? 0.35 : 0,
  });
}

/** Bottom-anchored voxel block (`y` = bottom face of block) with crisp pixel-art ink edge lines */
export function addVoxelBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material | THREE.Material[],
  x: number,
  yBottom: number,
  z: number,
  withOutline = true,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, yBottom + h * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (withOutline) {
    const edges = new THREE.EdgesGeometry(geo, 35);
    mesh.add(new THREE.LineSegments(edges, VOXEL_INK_EDGE_MAT));
  }
  parent.add(mesh);
  return mesh;
}

/** 3D Stacked Voxel Pokéball Ornament (like the twin corner Pokéballs on the RSE PokéCenter counter!) */
export function createVoxelPokeball3D(size = 0.62): THREE.Group {
  const g = new THREE.Group();
  const redMat = new THREE.MeshLambertMaterial({ color: 0xe84545 });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2030 });
  const btnMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // Tiered voxel sphere (bottom white cap + dark belt + red upper dome + top voxel crown)
  addVoxelBox(g, size * 0.72, size * 0.14, size * 0.72, whiteMat, 0, 0, 0);
  addVoxelBox(g, size * 0.96, size * 0.28, size * 0.96, whiteMat, 0, size * 0.14, 0);
  addVoxelBox(g, size * 1.0, size * 0.14, size * 1.0, darkMat, 0, size * 0.42, 0, false);
  addVoxelBox(g, size * 0.96, size * 0.28, size * 0.96, redMat, 0, size * 0.56, 0);
  addVoxelBox(g, size * 0.72, size * 0.16, size * 0.72, redMat, 0, size * 0.84, 0);
  // Front pixel clasp button
  addVoxelBox(g, size * 0.28, size * 0.26, size * 0.12, darkMat, 0, size * 0.36, size * 0.49, false);
  addVoxelBox(g, size * 0.16, size * 0.14, size * 0.14, btnMat, 0, size * 0.42, size * 0.50, false);
  return g;
}

/**
 * 1. RSE Pokémon Center U-Shaped Waist-High Reception Counter (`1.04u` tall = 43% of CHAR_H!)
 *    - Cream pixel-bordered countertop (`#f5f0d5`), slate-blue recessed front panels (`#627296`),
 *      central white service mat, and twin 3D Voxel Pokéball ornaments on the front corners!
 */
export function createVoxelRseReceptionCounter(spanW = 11.2, wingD = 3.6): THREE.Group {
  const g = new THREE.Group();
  const H = 1.04; // Ergonomic waist-height! Nurse Joy (2.52u) is 60%+ visible above the counter!
  const deckD = 1.32;
  const kickMat = new THREE.MeshLambertMaterial({ color: 0x2a3045 });
  const bodyMat = makeFramedVoxelFaceMat('rse_cnt_body', '#68789c', '#8899bd', '#4c5978', (ctx) => {
    ctx.fillStyle = '#dce4f5';
    ctx.fillRect(4, 7, 24, 16);
    ctx.fillStyle = '#536285';
    ctx.fillRect(6, 9, 20, 12);
  });
  const topMat = makeFramedVoxelFaceMat('rse_cnt_top', '#f4efd2', '#fffdf0', '#d6cca8');
  const matPad = makeFramedVoxelFaceMat('rse_cnt_pad', '#ffffff', '#ffffff', '#cfd8e8');

  // Front main bar (at +Z facing incoming player)
  addVoxelBox(g, spanW - 0.18, 0.18, deckD - 0.16, kickMat, 0, 0, 0);
  addVoxelBox(g, spanW, H - 0.34, deckD, bodyMat, 0, 0.18, 0);
  addVoxelBox(g, spanW + 0.22, 0.18, deckD + 0.22, topMat, 0, H - 0.16, 0);
  // Central white trainer service pad on countertop
  addVoxelBox(g, 2.6, 0.05, 0.86, matPad, 0, H + 0.02, 0.06);

  // Left & Right U-wings extending back (-Z) toward the back wall
  const sideLen = Math.max(1.6, wingD - deckD * 0.5);
  for (const s of [-1, 1]) {
    const sx = s * (spanW * 0.5 - deckD * 0.5);
    const sz = -deckD * 0.5 - sideLen * 0.5;
    addVoxelBox(g, deckD - 0.16, 0.18, sideLen, kickMat, sx, 0, sz);
    addVoxelBox(g, deckD, H - 0.34, sideLen, bodyMat, sx, 0.18, sz);
    addVoxelBox(g, deckD + 0.18, 0.18, sideLen + 0.14, topMat, sx, H - 0.16, sz);

    // Iconic RSE Corner Voxel Pokéball Ornament!
    const orb = createVoxelPokeball3D(0.76);
    orb.position.set(sx, H + 0.02, 0);
    g.add(orb);
  }
  return g;
}

/** 2. RSE 6-Pokéball Healing Machine (`宝可梦恢复装置` — white/slate console + medical cross + 2x3 Pokéball tray) */
export function createVoxelHealingMachine(): THREE.Group {
  const g = new THREE.Group();
  const baseMat = makeFramedVoxelFaceMat('heal_base', '#e9eef7', '#ffffff', '#bcc7db', (ctx) => {
    // Red/orange RSE medical pixel cross on front skirt
    ctx.fillStyle = '#f06543';
    ctx.fillRect(14, 9, 4, 14);
    ctx.fillRect(9, 14, 14, 4);
  });
  const sideWingMat = makeFramedVoxelFaceMat('heal_wing', '#6c7da3', '#8fa0c7', '#4b597a');
  const trayMat = new THREE.MeshLambertMaterial({ color: 0x252b3d });
  const screenGlow = new THREE.MeshBasicMaterial({ color: 0x74f2ce });

  addVoxelBox(g, 2.85, 0.96, 1.85, baseMat, 0, 0, 0);
  addVoxelBox(g, 0.42, 1.24, 1.75, sideWingMat, -1.25, 0, -0.04);
  addVoxelBox(g, 0.42, 1.24, 1.75, sideWingMat, 1.25, 0, -0.04);
  addVoxelBox(g, 2.02, 0.16, 1.38, trayMat, 0, 0.96, 0.06);
  // Back status arch & glowing heart-rate monitor strip
  addVoxelBox(g, 2.4, 0.56, 0.44, sideWingMat, 0, 0.96, -0.68);
  addVoxelBox(g, 1.55, 0.28, 0.08, screenGlow, 0, 1.12, -0.44, false);

  // 6 Miniature Voxel Pokéballs (2 cols x 3 rows) nestled in the healing sockets!
  for (let col = -1; col <= 1; col += 2) {
    for (let row = -1; row <= 1; row++) {
      const pb = createVoxelPokeball3D(0.32);
      pb.position.set(col * 0.46, 1.08, 0.08 + row * 0.36);
      g.add(pb);
    }
  }
  return g;
}

/** 3. RSE Lavender-Slate GBA PC Terminal (`宝可梦传送系统 PC`) */
export function createVoxelRsePcKiosk(): THREE.Group {
  const g = new THREE.Group();
  const towerMat = makeFramedVoxelFaceMat('pc_tower', '#9aa5be', '#bcc6de', '#6e7891', (ctx) => {
    ctx.fillStyle = '#2b3245';
    ctx.fillRect(6, 8, 20, 3);
    ctx.fillRect(6, 14, 20, 3);
    ctx.fillRect(6, 22, 12, 4);
  });
  const crtMat = makeFramedVoxelFaceMat(
    'pc_crt',
    '#2a3652',
    '#4dabf7',
    '#1b2336',
    (ctx) => {
      ctx.fillStyle = '#4dabf7';
      ctx.fillRect(4, 4, 24, 20);
      ctx.fillStyle = '#a5d8ff';
      ctx.fillRect(6, 6, 12, 3);
      ctx.fillRect(6, 12, 18, 2);
      ctx.fillStyle = '#51cf66';
      ctx.fillRect(24, 26, 4, 3);
    },
    0x1c7ed6,
  );
  addVoxelBox(g, 1.35, 1.02, 1.25, towerMat, 0, 0, 0);
  // Keyboard lip
  addVoxelBox(g, 1.42, 0.16, 1.44, towerMat, 0, 1.02, 0.12);
  // CRT Monitor housing
  addVoxelBox(g, 1.28, 0.92, 1.05, towerMat, 0, 1.18, -0.06);
  addVoxelBox(g, 1.04, 0.72, 0.08, crtMat, 0, 1.28, 0.46, false);
  return g;
}

/** 4. Wall Monitor TV & Framed Hoenn/Shanghai Pixel Region Map */
export function createVoxelWallMonitor(w = 2.8, h = 1.55): THREE.Group {
  const g = new THREE.Group();
  const bezel = makeFramedVoxelFaceMat('wall_tv_bezel', '#aeb8cc', '#dce3f0', '#737d94');
  const screen = makeFramedVoxelFaceMat(
    'wall_tv_scr',
    '#2d3d59',
    '#4c6ef5',
    '#1d283b',
    (ctx) => {
      ctx.fillStyle = '#3bc9db';
      ctx.fillRect(3, 3, 26, 26);
      ctx.fillStyle = '#99e9f2';
      ctx.fillRect(5, 5, 10, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(19, 19, 8, 6);
    },
    0x1098ad,
  );
  addVoxelBox(g, w, h, 0.22, bezel, 0, 0, 0);
  addVoxelBox(g, w - 0.34, h - 0.34, 0.08, screen, 0, 0.17, 0.11, false);
  return g;
}

export function createVoxelRegionMapPoster(w = 2.5, h = 1.65): THREE.Group {
  const g = new THREE.Group();
  const frameMat = makeFramedVoxelFaceMat('map_frame', '#d8dee9', '#ffffff', '#9aa5b8');
  const mapMat = makeFramedVoxelFaceMat('map_art', '#74c0fc', '#a5d8ff', '#339af0', (ctx) => {
    ctx.fillStyle = '#69db7c';
    ctx.fillRect(3, 5, 15, 18);
    ctx.fillRect(16, 10, 11, 14);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(8, 12, 14, 2);
    ctx.fillRect(13, 7, 2, 15);
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(12, 11, 4, 4);
    ctx.fillRect(21, 15, 3, 3);
  });
  addVoxelBox(g, w, h, 0.14, frameMat, 0, 0, 0);
  addVoxelBox(g, w - 0.28, h - 0.28, 0.06, mapMat, 0, 0.14, 0.07, false);
  return g;
}

/** 5. RSE 2-Tier Pixel Bookshelf filled with colorful pixel book spines (`1.92u` tall) */
export function createVoxelBookshelf(spanW = 3.2): THREE.Group {
  const g = new THREE.Group();
  const shellMat = makeFramedVoxelFaceMat('bk_shell', '#cfd6e6', '#eef2fa', '#99a3ba');
  const booksTex = getVoxelPixelTex('bk_spines_v1', 64, 32, (ctx) => {
    ctx.fillStyle = '#2b3042';
    ctx.fillRect(0, 0, 64, 32);
    const colors = ['#51cf66', '#ff6b6b', '#339af0', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#748ffc'];
    for (let tier = 0; tier < 2; tier++) {
      const y0 = tier * 16 + 2;
      ctx.fillStyle = '#99a3ba';
      ctx.fillRect(0, y0 + 12, 64, 2);
      let x = 2;
      let ci = tier * 3;
      while (x < 60) {
        const bw = 4 + (ci % 3);
        const bh = 10 + (ci % 2);
        ctx.fillStyle = colors[ci % colors.length];
        ctx.fillRect(x, y0 + (12 - bh), bw, bh);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y0 + 4, Math.max(1, bw - 2), 2);
        x += bw + 1;
        ci++;
      }
    }
  });
  const booksMat = new THREE.MeshLambertMaterial({ map: booksTex });
  addVoxelBox(g, spanW, 1.92, 1.08, [shellMat, shellMat, shellMat, shellMat, booksMat, shellMat], 0, 0, 0);
  return g;
}

/** 6. Voxel Broad-Leaf Potted Plant in Faceted Slate Planter (`1.85u` tall) */
export function createVoxelPottedPlant(): THREE.Group {
  const g = new THREE.Group();
  const potMat = makeFramedVoxelFaceMat('vox_pot', '#7a8499', '#9ea8bd', '#555d70');
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x7f5539 });
  const leafDark = makeFramedVoxelFaceMat('vox_leaf_d', '#40a850', '#69db7c', '#2b7a38');
  const leafBright = makeFramedVoxelFaceMat('vox_leaf_b', '#69db7c', '#96f2a4', '#37b24d');

  addVoxelBox(g, 1.05, 0.56, 1.05, potMat, 0, 0, 0);
  addVoxelBox(g, 1.18, 0.14, 1.18, potMat, 0, 0.56, 0);
  addVoxelBox(g, 0.92, 0.08, 0.92, soilMat, 0, 0.66, 0, false);
  addVoxelBox(g, 0.26, 0.65, 0.26, stemMat, 0, 0.70, 0);
  // Layered voxel leaf clusters
  addVoxelBox(g, 1.42, 0.36, 0.68, leafDark, 0, 1.12, 0);
  addVoxelBox(g, 0.68, 0.36, 1.42, leafDark, 0, 1.16, 0);
  addVoxelBox(g, 1.12, 0.42, 1.12, leafBright, 0, 1.38, 0);
  addVoxelBox(g, 0.64, 0.22, 0.64, leafBright, 0, 1.78, 0);
  return g;
}

/** 7. RSE Rounded-Voxel Cushioned Stool (`0.62u` tall — ergonomic knee-height for Red!) */
export function createVoxelCushionStool(kind: 'coral' | 'yellow' | 'blue' | 'mint' = 'coral'): THREE.Group {
  const g = new THREE.Group();
  const palette = {
    coral: ['#eb8258', '#ffa882', '#c45d38'],
    yellow: ['#ebd058', '#ffe885', '#c4a835'],
    blue: ['#6aa9e8', '#99c9ff', '#4882bd'],
    mint: ['#58c9a5', '#88edd0', '#389e7d'],
  }[kind];
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x3b4254 });
  const cushMat = makeFramedVoxelFaceMat(`stool_${kind}`, palette[0], palette[1], palette[2]);
  addVoxelBox(g, 0.88, 0.18, 0.88, baseMat, 0, 0, 0);
  addVoxelBox(g, 1.16, 0.38, 1.16, cushMat, 0, 0.18, 0);
  addVoxelBox(g, 0.96, 0.08, 0.96, cushMat, 0, 0.56, 0);
  return g;
}

/** 8. RSE Teal Pixel-Reflection Coffee Table (`0.80u` tall) */
export function createVoxelTealGlassTable(w = 3.0, d = 2.3): THREE.Group {
  const g = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x4c566a });
  const rimMat = makeFramedVoxelFaceMat('teal_rim', '#8fbcbb', '#d8dee9', '#5e8180');
  const glassMat = makeFramedVoxelFaceMat('teal_top', '#689d99', '#a3d9d3', '#497572', (ctx) => {
    // Crisp white pixel reflection band across glass top (just like Wesai's RSE table!)
    ctx.fillStyle = '#e6fcf5';
    for (let i = 4; i < 24; i += 2) {
      ctx.fillRect(i, 26 - Math.floor(i * 0.5), 4, 2);
    }
  });
  for (const [lx, lz] of [
    [-w * 0.36, -d * 0.34],
    [w * 0.36, -d * 0.34],
    [-w * 0.36, d * 0.34],
    [w * 0.36, d * 0.34],
  ]) {
    addVoxelBox(g, 0.28, 0.62, 0.28, legMat, lx, 0, lz);
  }
  addVoxelBox(g, w * 0.82, 0.16, d * 0.82, rimMat, 0, 0.48, 0);
  addVoxelBox(g, w, 0.18, d, [rimMat, rimMat, glassMat, rimMat, rimMat, rimMat], 0, 0.62, 0);
  return g;
}

/** 9. Poké Mart Stocked Voxel Gondola Shelf (`1.92u` tall) & Cash Register Counter (`1.02u` tall) */
export function createVoxelMartGondola(spanW = 4.8, variant = 0): THREE.Group {
  const g = new THREE.Group();
  const frameMat = makeFramedVoxelFaceMat('mart_frame', '#e9eef7', '#ffffff', '#adb8cc');
  const headerColors = ['#339af0', '#51cf66', '#ff922b'];
  const capMat = makeFramedVoxelFaceMat(
    `mart_cap_${variant % 3}`,
    headerColors[variant % 3],
    '#a5d8ff',
    '#1971c2',
  );
  const goodsTex = getVoxelPixelTex(`mart_goods_${variant % 3}`, 64, 32, (ctx) => {
    ctx.fillStyle = '#31394d';
    ctx.fillRect(0, 0, 64, 32);
    const palette =
      variant % 3 === 0
        ? ['#fa5252', '#ffffff', '#339af0', '#fcc419'] // Pokéballs & Great Balls
        : variant % 3 === 1
          ? ['#be4bdb', '#fcc419', '#51cf66', '#ff922b'] // Potions & Paralyze Heals
          : ['#ff6b6b', '#69db7c', '#ffd43b', '#4dabf7']; // Berry Snacks
    for (let row = 0; row < 3; row++) {
      const y = 3 + row * 10;
      ctx.fillStyle = '#dce3f0';
      ctx.fillRect(0, y + 7, 64, 2);
      for (let x = 3; x < 60; x += 6) {
        ctx.fillStyle = palette[(x + row) % palette.length];
        ctx.fillRect(x, y + 1, 4, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y + 2, 2, 2);
      }
    }
  });
  const goodsMat = new THREE.MeshLambertMaterial({ map: goodsTex });
  addVoxelBox(g, spanW, 1.72, 1.45, [frameMat, frameMat, frameMat, frameMat, goodsMat, goodsMat], 0, 0, 0);
  addVoxelBox(g, spanW + 0.12, 0.22, 1.55, capMat, 0, 1.72, 0);
  return g;
}

export function createVoxelMartCheckoutCounter(): THREE.Group {
  const g = new THREE.Group();
  const body = makeFramedVoxelFaceMat('mart_chk_b', '#339af0', '#74c0fc', '#1c7ed6');
  const top = makeFramedVoxelFaceMat('mart_chk_t', '#f1f5f9', '#ffffff', '#cbd5e1');
  const belt = new THREE.MeshLambertMaterial({ color: 0x2b3040 });
  const regMat = makeFramedVoxelFaceMat('mart_reg', '#e2e8f0', '#ffffff', '#94a3b8');
  addVoxelBox(g, 3.6, 0.88, 1.35, body, 0, 0, 0);
  addVoxelBox(g, 3.76, 0.14, 1.5, top, 0, 0.88, 0);
  addVoxelBox(g, 1.75, 0.05, 0.85, belt, -0.7, 1.02, 0);
  // Voxel Cash Register
  addVoxelBox(g, 0.82, 0.42, 0.72, regMat, 0.95, 1.02, -0.05);
  addVoxelBox(g, 0.56, 0.34, 0.14, new THREE.MeshBasicMaterial({ color: 0x69db7c }), 0.95, 1.44, -0.15);
  return g;
}

export function createVoxelGlassFreezer(spanW = 3.4): THREE.Group {
  const g = new THREE.Group();
  const shell = makeFramedVoxelFaceMat('frz_shell', '#dbe4f0', '#ffffff', '#94a3b8');
  const glassTex = getVoxelPixelTex('frz_glass', 48, 48, (ctx) => {
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, 48, 48);
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(3, 3, 19, 42);
    ctx.fillRect(26, 3, 19, 42);
    const cols = ['#ef4444', '#f59e0b', '#10b981', '#6366f1'];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = cols[(r + c) % 4];
        ctx.fillRect(5 + c * 6 + (c >= 3 ? 4 : 0), 8 + r * 12, 4, 8);
      }
    }
  });
  const glassMat = new THREE.MeshLambertMaterial({ map: glassTex, emissive: new THREE.Color(0x1d4ed8), emissiveIntensity: 0.22 });
  addVoxelBox(g, spanW, 2.15, 1.15, [shell, shell, shell, shell, glassMat, shell], 0, 0, 0);
  return g;
}

/** 10. Restaurant Voxel Dining Table + Pixel Dishes (`0.92u` tall), Chair (`0.56u` seat / `1.12u` back) & Kitchen Stoves */
export function createVoxelDiningSet(dishVariant = 0): THREE.Group {
  const g = new THREE.Group();
  const woodLeg = new THREE.MeshLambertMaterial({ color: 0x6c462f });
  const clothTop = makeFramedVoxelFaceMat('rest_cloth', '#fff5eb', '#ffffff', '#e6ccb2', (ctx) => {
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(3, 3, 26, 2);
    ctx.fillRect(3, 27, 26, 2);
  });
  const chairWood = makeFramedVoxelFaceMat('rest_chair_w', '#8d5b3c', '#b07a57', '#5e3a24');
  const chairPad = makeFramedVoxelFaceMat('rest_chair_p', '#e8590c', '#ff922b', '#b84307');

  // Table (3.2 x 2.2, H = 0.92u)
  addVoxelBox(g, 0.34, 0.78, 0.34, woodLeg, -1.15, 0, -0.72);
  addVoxelBox(g, 0.34, 0.78, 0.34, woodLeg, 1.15, 0, -0.72);
  addVoxelBox(g, 0.34, 0.78, 0.34, woodLeg, -1.15, 0, 0.72);
  addVoxelBox(g, 0.34, 0.78, 0.34, woodLeg, 1.15, 0, 0.72);
  addVoxelBox(g, 3.1, 0.16, 2.15, clothTop, 0, 0.78, 0);

  // Two Pixel Ramen / Berry Dishes on the tabletop (`y = 0.94u`)
  const bowlMat = new THREE.MeshLambertMaterial({ color: dishVariant % 2 === 0 ? 0xfa5252 : 0x3bc9db });
  const brothMat = new THREE.MeshLambertMaterial({ color: 0xffd43b });
  for (const dx of [-0.68, 0.68]) {
    addVoxelBox(g, 0.52, 0.16, 0.52, bowlMat, dx, 0.94, 0);
    addVoxelBox(g, 0.38, 0.06, 0.38, brothMat, dx, 1.10, 0, false);
  }

  // Left & Right Ergonomic Chibi Dining Chairs (`seat = 0.54u`, `backrest = 1.14u`)
  for (const s of [-1, 1]) {
    const cx = s * 1.95;
    addVoxelBox(g, 0.92, 0.44, 0.92, chairWood, cx, 0, 0);
    addVoxelBox(g, 0.98, 0.12, 0.98, chairPad, cx, 0.44, 0);
    addVoxelBox(g, 0.16, 0.58, 0.94, chairWood, cx + s * 0.41, 0.56, 0);
  }
  return g;
}

export function createVoxelKitchenRangeUnit(): THREE.Group {
  const g = new THREE.Group();
  const steel = makeFramedVoxelFaceMat('k_steel', '#ced4da', '#f8f9fa', '#868e96');
  const burner = new THREE.MeshBasicMaterial({ color: 0xff6b35 });
  const potMat = makeFramedVoxelFaceMat('k_pot', '#d9480f', '#ff922b', '#9c360b');
  // Stove cabinet (`1.04u` tall)
  addVoxelBox(g, 2.4, 1.04, 1.45, steel, 0, 0, 0);
  addVoxelBox(g, 0.52, 0.06, 0.52, burner, -0.56, 1.04, 0, false);
  addVoxelBox(g, 0.52, 0.06, 0.52, burner, 0.56, 1.04, 0, false);
  // Simmering Voxel Stew Pot
  addVoxelBox(g, 0.68, 0.46, 0.68, potMat, -0.56, 1.08, 0);
  // Overhead Stainless Range Hood (`y = 2.45..3.15u`)
  addVoxelBox(g, 2.5, 0.36, 1.5, steel, 0, 2.45, 0);
  addVoxelBox(g, 0.75, 0.95, 0.65, steel, 0, 2.81, -0.25);
  return g;
}

/** 11. Hotel & Duplex Villa Chibi-Scaled Voxel Bed, Sofa, Nightstand & Study Desk */
export function createVoxelDoubleBed(blanketColor: 'berry' | 'azure' | 'mint' = 'azure'): THREE.Group {
  const g = new THREE.Group();
  const wood = makeFramedVoxelFaceMat('bed_wood', '#8c583a', '#b57b58', '#5e3822');
  const sheet = makeFramedVoxelFaceMat('bed_sheet', '#f8f9fa', '#ffffff', '#dee2e6');
  const cols = {
    berry: ['#e64980', '#ff8787', '#a61e4d'],
    azure: ['#339af0', '#74c0fc', '#1971c2'],
    mint: ['#20c997', '#63e6be', '#0ca678'],
  }[blanketColor];
  const quilt = makeFramedVoxelFaceMat(`bed_quilt_${blanketColor}`, cols[0], cols[1], cols[2]);

  // Frame (`0.38u`), Mattress (`0.64u` total height — Red can sit/sleep naturally!), Headboard (`1.24u`)
  addVoxelBox(g, 3.8, 0.36, 4.4, wood, 0, 0, 0);
  addVoxelBox(g, 3.9, 1.26, 0.28, wood, 0, 0, -2.12);
  addVoxelBox(g, 3.56, 0.28, 4.12, sheet, 0, 0.36, 0.05);
  addVoxelBox(g, 3.62, 0.30, 2.85, quilt, 0, 0.37, 0.68);
  // Twin Voxel Pillows
  addVoxelBox(g, 1.32, 0.16, 0.78, sheet, -0.85, 0.64, -1.42);
  addVoxelBox(g, 1.32, 0.16, 0.78, sheet, 0.85, 0.64, -1.42);
  return g;
}

export function createVoxelNightstandWithLamp(): THREE.Group {
  const g = new THREE.Group();
  const wood = makeFramedVoxelFaceMat('ns_wood', '#8c583a', '#b57b58', '#5e3822');
  const shade = makeFramedVoxelFaceMat('ns_shade', '#ffe066', '#fff9db', '#f59f00', undefined, 0xf59f00);
  addVoxelBox(g, 1.15, 0.74, 1.05, wood, 0, 0, 0);
  addVoxelBox(g, 0.22, 0.26, 0.22, wood, 0, 0.74, 0);
  addVoxelBox(g, 0.68, 0.44, 0.68, shade, 0, 0.98, 0);
  return g;
}

export function createVoxelLoungeSofa(spanW = 4.4, hex = '#4263eb'): THREE.Group {
  const g = new THREE.Group();
  const fabric = makeFramedVoxelFaceMat(`sofa_${hex}`, hex, '#91a7ff', '#2b44b8');
  const leg = new THREE.MeshLambertMaterial({ color: 0x3b4252 });
  addVoxelBox(g, spanW - 0.2, 0.16, 1.65, leg, 0, 0, 0);
  // Seat (`0.56u` tall!) + Armrests (`0.84u`) + Backrest (`1.18u` tall!)
  addVoxelBox(g, spanW, 0.42, 1.75, fabric, 0, 0.16, 0);
  addVoxelBox(g, 0.42, 0.32, 1.75, fabric, -spanW * 0.5 + 0.21, 0.58, 0);
  addVoxelBox(g, 0.42, 0.32, 1.75, fabric, spanW * 0.5 - 0.21, 0.58, 0);
  addVoxelBox(g, spanW, 0.62, 0.44, fabric, 0, 0.58, -0.66);
  return g;
}

export function createVoxelStudyDeskSet(): THREE.Group {
  const g = new THREE.Group();
  const wood = makeFramedVoxelFaceMat('desk_wood', '#9c6644', '#c48f6c', '#6f4528');
  const scr = createVoxelWallMonitor(1.35, 0.88);
  addVoxelBox(g, 0.26, 0.82, 1.45, wood, -1.25, 0, 0);
  addVoxelBox(g, 0.92, 0.82, 1.45, wood, 0.95, 0, 0);
  addVoxelBox(g, 2.95, 0.14, 1.58, wood, 0, 0.82, 0);
  scr.position.set(-0.35, 0.96, -0.35);
  g.add(scr);
  return g;
}
