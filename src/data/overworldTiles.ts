/**
 * Authentic GBA FireRed / Emerald 16x16 pixel-art overworld tileset,
 * 16x22 chibi overworld Trainer/NPC sprites, Kanto Route 1 (15x10) map,
 * and BFS click-to-walk pathfinder.
 */

export const TILE_SIZE = 16;
export const MAP_COLS = 15;
export const MAP_ROWS = 10;
export const CANVAS_W = MAP_COLS * TILE_SIZE; // 240px (exact GBA native width!)
export const CANVAS_H = MAP_ROWS * TILE_SIZE; // 160px (exact GBA native height!)

// Tile legend (15 cols x 10 rows):
// T = Lush Oak Tree (blocked)
// . = Meadow Grass (walkable)
// F = Animated Wildflowers (walkable)
// G = Tall Wild Grass (walkable, triggers wild encounter!)
// P = Autotiled Dirt Road (walkable)
// W = Shimmering Water Pond (blocked)
// S = Wooden Route Signpost (interactive)
// H = Fence (blocked)
// c = Poke Center Wall/Roof (blocked, rendered as 4x3 multi-tile building at x=2..5, y=0..2)
// C = Poke Center Door (walkable/interactive -> heal full team!)
// m = Poke Mart Wall/Roof (blocked, rendered as 3x3 multi-tile building at x=10..12, y=0..2)
// M = Poke Mart Door (walkable/interactive -> open market!)
// R = Rival Blue NPC (interactive -> Trainer/Gym Battle!)
// L = Gym Leader Misty NPC (interactive -> Gym Battle!)
export const ROUTE_MAP: string[] = [
  'TTcccc..TTmmmTT',
  'TTcccc.F..mmmTT',
  'TTcCcc.P..mMmTT',
  'T..PPPPP...P.FT',
  'TGGP.S.PPPPPGGT',
  'TGGP..F..P.RGGT',
  'TGGPPP...P..GGT',
  'TWW..P.L.PPPGGT',
  'TWW.FPPPP..F..T',
  'TTTTTTTTTTTTTTT',
];

export type FacingDir = 'down' | 'up' | 'left' | 'right';

export interface TilePoint {
  x: number;
  y: number;
}

export function getTileAt(x: number, y: number): string {
  if (y < 0 || y >= MAP_ROWS || x < 0 || x >= MAP_COLS) return 'T';
  return ROUTE_MAP[y][x];
}

export function isTileWalkable(x: number, y: number): boolean {
  const t = getTileAt(x, y);
  return t === '.' || t === 'F' || t === 'G' || t === 'P' || t === 'C' || t === 'M';
}

export function isTileInteractive(x: number, y: number): boolean {
  const t = getTileAt(x, y);
  return t === 'C' || t === 'M' || t === 'R' || t === 'L' || t === 'S';
}

/**
 * BFS shortest path from `start` to `goal`.
 * If `goal` is an interactive blocked tile (R, L, S), paths to the closest walkable adjacent tile!
 */
export function findTilePath(start: TilePoint, goal: TilePoint): TilePoint[] {
  if (start.x === goal.x && start.y === goal.y) return [];
  const goalTile = getTileAt(goal.x, goal.y);
  const stopAdjacent = goalTile === 'R' || goalTile === 'L' || goalTile === 'S';

  // If clicking a non-walkable, non-interactive tile (like a tree), try clicking the PokeCenter/Mart building roof -> redirect to its door!
  let target = goal;
  if (goalTile === 'c') target = { x: 3, y: 2 };
  else if (goalTile === 'm') target = { x: 11, y: 2 };
  else if (!isTileWalkable(goal.x, goal.y) && !stopAdjacent) return [];

  const key = (p: TilePoint) => `${p.x},${p.y}`;
  const queue: TilePoint[] = [start];
  const parent = new Map<string, TilePoint | null>();
  parent.set(key(start), null);

  let found: TilePoint | null = null;
  const dirs = [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (stopAdjacent) {
      if (Math.abs(cur.x - target.x) + Math.abs(cur.y - target.y) === 1) {
        found = cur;
        break;
      }
    } else if (cur.x === target.x && cur.y === target.y) {
      found = cur;
      break;
    }

    for (const d of dirs) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const nk = `${nx},${ny}`;
      if (parent.has(nk)) continue;
      if (!isTileWalkable(nx, ny)) continue;
      parent.set(nk, cur);
      queue.push({ x: nx, y: ny });
    }
  }

  if (!found) return [];
  const path: TilePoint[] = [];
  let node: TilePoint | null = found;
  while (node && !(node.x === start.x && node.y === start.y)) {
    path.push(node);
    node = parent.get(key(node)) ?? null;
  }
  path.reverse();
  return path;
}

// =====================================================================
// AUTHENTIC 16x16 FIRERED / EMERALD CANVAS TILE PAINTERS
// =====================================================================

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function drawMeadowBase(ctx: CanvasRenderingContext2D, ox: number, oy: number, tx: number, ty: number) {
  px(ctx, ox, oy, 16, 16, '#78d868');
  // Subtle GBA grass texture pixels (deterministic per tile)
  const seed = (tx * 7 + ty * 13) % 5;
  px(ctx, ox + 2 + seed, oy + 3, 2, 1, '#60c050');
  px(ctx, ox + 3 + seed, oy + 2, 1, 1, '#98e878');
  px(ctx, ox + 10 - (seed % 3), oy + 11, 2, 1, '#60c050');
  px(ctx, ox + 11 - (seed % 3), oy + 10, 1, 1, '#98e878');
  if ((tx + ty) % 2 === 0) {
    px(ctx, ox + 4, oy + 13, 1, 1, '#60c050');
  }
}

function drawAutotiledRoad(ctx: CanvasRenderingContext2D, ox: number, oy: number, tx: number, ty: number) {
  const isRoad = (x: number, y: number) => {
    const t = getTileAt(x, y);
    return t === 'P' || t === 'C' || t === 'M';
  };
  const n = isRoad(tx, ty - 1);
  const s = isRoad(tx, ty + 1);
  const w = isRoad(tx - 1, ty);
  const e = isRoad(tx + 1, ty);

  // Fill meadow underneath rounded corners
  drawMeadowBase(ctx, ox, oy, tx, ty);

  // Main warm Kanto sand path
  const x0 = w ? ox : ox + 2;
  const x1 = e ? ox + 16 : ox + 14;
  const y0 = n ? oy : oy + 2;
  const y1 = s ? oy + 16 : oy + 14;
  px(ctx, x0, y0, x1 - x0, y1 - y0, '#e8d498');

  // Stepped dark-earth & light-highlight borders on exposed edges (authentic FireRed!)
  if (!n) {
    px(ctx, x0, y0 - 1, x1 - x0, 1, '#9c7c48');
    px(ctx, x0, y0, x1 - x0, 1, '#f4e8be');
  }
  if (!s) {
    px(ctx, x0, y1 - 1, x1 - x0, 1, '#c4a668');
    px(ctx, x0, y1, x1 - x0, 1, '#7c5e34');
  }
  if (!w) {
    px(ctx, x0 - 1, y0, 1, y1 - y0, '#9c7c48');
    px(ctx, x0, y0, 1, y1 - y0, '#f4e8be');
  }
  if (!e) {
    px(ctx, x1 - 1, y0, 1, y1 - y0, '#c4a668');
    px(ctx, x1, y0, 1, y1 - y0, '#7c5e34');
  }

  // Subtle pebbles
  if ((tx * 3 + ty * 5) % 2 === 0) {
    px(ctx, ox + 5, oy + 6, 2, 1, '#d2b478');
    px(ctx, ox + 6, oy + 5, 1, 1, '#f4e8be');
  } else {
    px(ctx, ox + 9, oy + 10, 2, 1, '#d2b478');
  }
}

export function drawTallGrass(ctx: CanvasRenderingContext2D, ox: number, oy: number, frame: number) {
  // Deep shaded grass patch base
  px(ctx, ox, oy, 16, 16, '#389848');
  px(ctx, ox, oy, 16, 1, '#287838');
  px(ctx, ox, oy + 15, 16, 1, '#206030');

  const sway = frame % 2 === 0 ? 0 : 1;
  // Classic FireRed 2-row serrated tall grass blades
  const blades = [
    [1, 2],
    [6, 2],
    [11, 2],
    [2, 9],
    [7, 9],
    [12, 9],
  ];
  for (const [bx, by] of blades) {
    // Dark outline shadow
    px(ctx, ox + bx, oy + by + 4, 4, 2, '#184828');
    // Mid-dark blade
    px(ctx, ox + bx + sway, oy + by + 1, 3, 4, '#287838');
    // Bright emerald blade tip
    px(ctx, ox + bx + sway, oy + by, 2, 3, '#58c058');
    px(ctx, ox + bx + sway, oy + by, 1, 1, '#a0f080');
  }
}

export function drawWildflowers(ctx: CanvasRenderingContext2D, ox: number, oy: number, frame: number) {
  drawMeadowBase(ctx, ox, oy, ox, oy);
  const shift = frame % 2;
  const spots = [
    { x: 2, y: 3, c: '#ff5858', mid: '#ffe066' },
    { x: 9, y: 2, c: '#ffe066', mid: '#ff7848' },
    { x: 4, y: 10, c: '#ffffff', mid: '#ffd43b' },
    { x: 11, y: 9, c: '#ff78a8', mid: '#fff3bf' },
  ];
  for (const f of spots) {
    // Leaf stem
    px(ctx, ox + f.x + 1, oy + f.y + 3, 2, 1, '#288040');
    // 4 petals
    px(ctx, ox + f.x + shift, oy + f.y + 1, 3, 2, f.c);
    px(ctx, ox + f.x + 1 + shift, oy + f.y, 1, 4, f.c);
    // Center pollen
    px(ctx, ox + f.x + 1 + shift, oy + f.y + 1, 1, 1, f.mid);
  }
}

function drawPondWater(ctx: CanvasRenderingContext2D, ox: number, oy: number, tx: number, ty: number, frame: number) {
  const isW = (x: number, y: number) => getTileAt(x, y) === 'W';
  px(ctx, ox, oy, 16, 16, '#3898e8');

  // Shoreline banks on exposed sides
  if (!isW(tx, ty - 1)) {
    px(ctx, ox, oy, 16, 2, '#60a850');
    px(ctx, ox, oy + 2, 16, 2, '#2068b8');
    px(ctx, ox, oy + 4, 16, 1, '#88d8ff');
  }
  if (!isW(tx, ty + 1)) {
    px(ctx, ox, oy + 14, 16, 2, '#9c7c48');
    px(ctx, ox, oy + 13, 16, 1, '#2068b8');
  }
  if (!isW(tx - 1, ty)) {
    px(ctx, ox, oy, 2, 16, '#2068b8');
  }
  if (!isW(tx + 1, ty)) {
    px(ctx, ox + 14, oy, 2, 16, '#2068b8');
  }

  // Animated GBA water wave glints
  const shift = (frame % 4) * 2;
  px(ctx, ox + 3 + (shift % 4), oy + 6, 4, 1, '#a8e4ff');
  px(ctx, ox + 8 - (shift % 4), oy + 10, 4, 1, '#78c8ff');
}

export function drawOakTree(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  drawMeadowBase(ctx, ox, oy, ox, oy);
  // Ground cast shadow
  px(ctx, ox + 2, oy + 13, 12, 3, '#388840');
  // Trunk
  px(ctx, ox + 5, oy + 11, 6, 4, '#241c18');
  px(ctx, ox + 6, oy + 11, 4, 3, '#885830');
  px(ctx, ox + 7, oy + 11, 2, 3, '#a87040');
  // Rounded multi-layered FireRed oak canopy
  px(ctx, ox + 2, oy + 0, 12, 12, '#183828');
  px(ctx, ox + 0, oy + 2, 16, 9, '#183828');
  // Deep shadow tier
  px(ctx, ox + 1, oy + 3, 14, 7, '#206838');
  px(ctx, ox + 3, oy + 1, 10, 10, '#206838');
  // Mid canopy foliage
  px(ctx, ox + 2, oy + 2, 12, 7, '#389848');
  px(ctx, ox + 3, oy + 1, 10, 6, '#389848');
  // Sunlit top crown highlights
  px(ctx, ox + 3, oy + 2, 9, 4, '#58c058');
  px(ctx, ox + 5, oy + 1, 6, 2, '#88e068');
  px(ctx, ox + 3, oy + 5, 3, 2, '#58c058');
  px(ctx, ox + 10, oy + 5, 3, 2, '#58c058');
  // Leaf notch shadows
  px(ctx, ox + 7, oy + 5, 2, 2, '#206838');
}

function drawSignpost(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  drawMeadowBase(ctx, ox, oy, ox, oy);
  px(ctx, ox + 4, oy + 13, 8, 2, '#409040');
  // Post
  px(ctx, ox + 6, oy + 9, 4, 5, '#241c18');
  px(ctx, ox + 7, oy + 9, 2, 4, '#8c5a32');
  // Wooden sign board
  px(ctx, ox + 2, oy + 2, 12, 8, '#241c18');
  px(ctx, ox + 3, oy + 3, 10, 6, '#d8a868');
  px(ctx, ox + 3, oy + 3, 10, 1, '#f0cc90');
  // Pixel writing lines on sign
  px(ctx, ox + 4, oy + 5, 8, 1, '#684420');
  px(ctx, ox + 4, oy + 7, 6, 1, '#684420');
}

/** Multi-tile 4x3 (64x48px) Authentic GBA Pokémon Center Building at tile (2, 0) */
export function drawPokeCenterBuilding(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  // Drop shadow on ground
  px(ctx, ox + 2, oy + 46, 60, 2, '#387838');
  // Main building outline
  px(ctx, ox + 2, oy + 2, 60, 44, '#1c1926');
  // Stepped FireRed crimson curved roof
  px(ctx, ox + 4, oy + 3, 56, 4, '#b82028');
  px(ctx, ox + 3, oy + 7, 58, 13, '#e04048');
  px(ctx, ox + 5, oy + 6, 54, 3, '#ff7878');
  // Roof shingle vertical grooves
  for (let rx = 8; rx < 58; rx += 6) {
    px(ctx, ox + rx, oy + 9, 1, 11, '#b82028');
  }
  // White roof eaves trim
  px(ctx, ox + 3, oy + 20, 58, 2, '#1c1926');
  px(ctx, ox + 3, oy + 22, 58, 2, '#dce6f2');
  // Cream-white clinic wall
  px(ctx, ox + 3, oy + 24, 58, 21, '#f8f8f0');
  px(ctx, ox + 3, oy + 42, 58, 3, '#c8d0dc');

  // Iconic Centered Pokéball Roof Emblem Sign
  px(ctx, ox + 24, oy + 8, 16, 14, '#1c1926');
  px(ctx, ox + 25, oy + 9, 14, 12, '#ffffff');
  px(ctx, ox + 28, oy + 11, 8, 4, '#e03131');
  px(ctx, ox + 28, oy + 15, 8, 1, '#1c1926');
  px(ctx, ox + 28, oy + 16, 8, 3, '#f1f3f5');
  px(ctx, ox + 31, oy + 14, 2, 2, '#ffffff');

  // Left & Right Tinted Clinic Glass Windows
  for (const wx of [7, 41]) {
    px(ctx, ox + wx, oy + 28, 16, 11, '#1c1926');
    px(ctx, ox + wx + 1, oy + 29, 14, 9, '#58b0f0');
    px(ctx, ox + wx + 2, oy + 30, 5, 3, '#b8e8ff');
    px(ctx, ox + wx + 8, oy + 29, 1, 9, '#1c1926');
  }

  // Sliding Glass Entrance Door (aligned to tile x=3, y=2 -> ox+16..32!)
  px(ctx, ox + 25, oy + 29, 14, 16, '#1c1926');
  px(ctx, ox + 26, oy + 30, 12, 15, '#3888d8');
  px(ctx, ox + 27, oy + 31, 4, 13, '#78c8ff');
  px(ctx, ox + 32, oy + 30, 1, 15, '#1c1926');
  // Red welcome mat
  px(ctx, ox + 26, oy + 45, 12, 2, '#e03131');
}

/** Multi-tile 3x3 (48x48px) Authentic GBA Poké Mart Building at tile (10, 0) */
export function drawPokeMartBuilding(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  px(ctx, ox + 2, oy + 46, 44, 2, '#387838');
  px(ctx, ox + 2, oy + 3, 44, 43, '#1c1926');
  // Cobalt blue tiled roof
  px(ctx, ox + 4, oy + 4, 40, 4, '#1850a8');
  px(ctx, ox + 3, oy + 8, 42, 12, '#2878e0');
  px(ctx, ox + 5, oy + 7, 38, 3, '#68b0ff');
  for (let rx = 8; rx < 42; rx += 6) {
    px(ctx, ox + rx, oy + 10, 1, 10, '#1850a8');
  }
  px(ctx, ox + 3, oy + 20, 42, 2, '#1c1926');
  px(ctx, ox + 3, oy + 22, 42, 2, '#d0e4f8');
  // Wall
  px(ctx, ox + 3, oy + 24, 42, 21, '#f4f8fc');
  px(ctx, ox + 3, oy + 42, 42, 3, '#bcc8d8');

  // Blue MART Roof Sign with crisp pixel 'M'
  px(ctx, ox + 17, oy + 8, 14, 13, '#1c1926');
  px(ctx, ox + 18, oy + 9, 12, 11, '#ffffff');
  px(ctx, ox + 20, oy + 11, 2, 7, '#228be6');
  px(ctx, ox + 26, oy + 11, 2, 7, '#228be6');
  px(ctx, ox + 22, oy + 12, 1, 3, '#228be6');
  px(ctx, ox + 25, oy + 12, 1, 3, '#228be6');
  px(ctx, ox + 23, oy + 14, 2, 2, '#228be6');

  // Shop Display Window (Left)
  px(ctx, ox + 6, oy + 29, 10, 10, '#1c1926');
  px(ctx, ox + 7, oy + 30, 8, 8, '#74c0fc');
  px(ctx, ox + 8, oy + 31, 3, 2, '#ffffff');
  // Shop Door (Center, aligned to tile x=11, y=2 -> ox+16..32!)
  px(ctx, ox + 18, oy + 29, 12, 16, '#1c1926');
  px(ctx, ox + 19, oy + 30, 10, 15, '#3b5bdb');
  px(ctx, ox + 20, oy + 31, 4, 13, '#74c0fc');
  px(ctx, ox + 24, oy + 30, 1, 15, '#1c1926');
  // Right shop display window
  px(ctx, ox + 32, oy + 29, 10, 10, '#1c1926');
  px(ctx, ox + 33, oy + 30, 8, 8, '#74c0fc');
  px(ctx, ox + 34, oy + 34, 6, 3, '#ffd43b');
  // Blue mat
  px(ctx, ox + 19, oy + 45, 10, 2, '#228be6');
}

/**
 * Draws an authentic 16x20 GBA FireRed chibi overworld character (Red / Blue / Misty)
 * centered on tile (pxCenter, pyBottom) with 2-frame leg stride & shadow!
 */
export function drawOverworldChar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  by: number,
  variant: 'red' | 'blue' | 'misty',
  facing: FacingDir,
  stepPhase: number,
) {
  const ox = Math.round(cx - 8);
  const oy = Math.round(by - 20);
  const stride = stepPhase % 2;

  const palettes = {
    red: { hat: '#e03131', hatTrim: '#ffffff', hair: '#1c1926', coat: '#e03131', shirt: '#ffffff', pants: '#2868c8', skin: '#ffd8a8' },
    blue: { hat: '#9c5a2c', hatTrim: '#c87e42', hair: '#9c5a2c', coat: '#2b2838', coatHi: '#49445c', shirt: '#7950f2', pants: '#3b4252', skin: '#ffd8a8' },
    misty: { hat: '#ff922b', hatTrim: '#ffd43b', hair: '#ff922b', coat: '#ffd43b', shirt: '#ff6b6b', pants: '#228be6', skin: '#ffe0bd' },
  };
  const p = palettes[variant];

  // Oval pixel shadow beneath feet
  px(ctx, ox + 3, oy + 18, 10, 2, 'rgba(20, 32, 20, 0.38)');

  // Head / Cap (crisp GBA chibi proportions: big expressive head!)
  px(ctx, ox + 3, oy + 1, 10, 10, '#1c1926');
  px(ctx, ox + 2, oy + 3, 12, 7, '#1c1926');
  if (variant === 'red') {
    // Classic Red Cap with white front panel
    px(ctx, ox + 4, oy + 2, 8, 4, p.hat);
    px(ctx, ox + 3, oy + 4, 10, 2, p.hat);
    if (facing !== 'up') {
      px(ctx, ox + 6, oy + 3, 4, 2, p.hatTrim);
    }
    // Hair sideburns
    px(ctx, ox + 3, oy + 6, 2, 3, p.hair);
    px(ctx, ox + 11, oy + 6, 2, 3, p.hair);
  } else {
    // Spiky hair (Blue) / Ponytail (Misty)
    px(ctx, ox + 4, oy + 2, 8, 4, p.hair);
    px(ctx, ox + 3, oy + 4, 10, 3, p.hair);
    px(ctx, ox + 5, oy + 2, 4, 2, p.hatTrim);
    if (variant === 'misty') {
      px(ctx, ox + 12, oy + 3, 3, 4, '#1c1926');
      px(ctx, ox + 12, oy + 4, 2, 2, p.hair);
    }
  }

  // Face / Eyes (when not facing up)
  if (facing === 'up') {
    px(ctx, ox + 4, oy + 6, 8, 4, p.hair);
  } else {
    px(ctx, ox + 4, oy + 6, 8, 4, p.skin);
    if (facing === 'down') {
      px(ctx, ox + 5, oy + 7, 1, 2, '#1c1926');
      px(ctx, ox + 10, oy + 7, 1, 2, '#1c1926');
    } else if (facing === 'left') {
      px(ctx, ox + 5, oy + 7, 1, 2, '#1c1926');
      px(ctx, ox + 8, oy + 7, 1, 2, '#1c1926');
    } else {
      px(ctx, ox + 7, oy + 7, 1, 2, '#1c1926');
      px(ctx, ox + 10, oy + 7, 1, 2, '#1c1926');
    }
  }

  // Torso / Jacket
  px(ctx, ox + 3, oy + 10, 10, 6, '#1c1926');
  px(ctx, ox + 4, oy + 11, 8, 4, p.coat);
  if (facing !== 'up') {
    px(ctx, ox + 7, oy + 11, 2, 4, p.shirt);
  } else if (variant === 'red') {
    // Yellow adventure backpack when walking up!
    px(ctx, ox + 5, oy + 11, 6, 4, '#f5b700');
  }

  // Arms swinging slightly
  px(ctx, ox + 2, oy + 11 + stride, 2, 4, '#1c1926');
  px(ctx, ox + 3, oy + 12 + stride, 1, 2, p.skin);
  px(ctx, ox + 12, oy + 12 - stride, 2, 4, '#1c1926');
  px(ctx, ox + 12, oy + 13 - stride, 1, 2, p.skin);

  // Legs / Shoes with 2-frame walking stride
  const leftLegY = oy + 15 + (stride === 0 ? 0 : 1);
  const rightLegY = oy + 15 + (stride === 1 ? 0 : 1);
  px(ctx, ox + 4, leftLegY, 3, 4, '#1c1926');
  px(ctx, ox + 5, leftLegY, 2, 2, p.pants);
  px(ctx, ox + 5, leftLegY + 2, 2, 1, '#f8f9fa');
  px(ctx, ox + 9, rightLegY, 3, 4, '#1c1926');
  px(ctx, ox + 9, rightLegY, 2, 2, p.pants);
  px(ctx, ox + 9, rightLegY + 2, 2, 1, '#f8f9fa');
}

/** Render the entire 240x160 FireRed Kanto Route 1 scene onto a 2D canvas */
export function renderOverworldCanvas(
  ctx: CanvasRenderingContext2D,
  animFrame: number,
  playerPx: { x: number; y: number },
  playerFacing: FacingDir,
  playerStep: number,
  targetTile: TilePoint | null,
) {
  ctx.imageSmoothingEnabled = false;

  // 1. Ground & terrain tiles
  for (let ty = 0; ty < MAP_ROWS; ty++) {
    for (let tx = 0; tx < MAP_COLS; tx++) {
      const tile = ROUTE_MAP[ty][tx];
      const ox = tx * TILE_SIZE;
      const oy = ty * TILE_SIZE;

      if (tile === 'P' || tile === 'C' || tile === 'M') {
        drawAutotiledRoad(ctx, ox, oy, tx, ty);
      } else if (tile === 'G') {
        drawTallGrass(ctx, ox, oy, animFrame);
      } else if (tile === 'F') {
        drawWildflowers(ctx, ox, oy, animFrame);
      } else if (tile === 'W') {
        drawPondWater(ctx, ox, oy, tx, ty, animFrame);
      } else if (tile === 'S') {
        drawSignpost(ctx, ox, oy);
      } else if (tile === 'T') {
        drawOakTree(ctx, ox, oy);
      } else {
        drawMeadowBase(ctx, ox, oy, tx, ty);
      }
    }
  }

  // 2. Multi-tile Buildings (Poke Center at (2,0), Poke Mart at (10,0))
  drawPokeCenterBuilding(ctx, 2 * TILE_SIZE, 0);
  drawPokeMartBuilding(ctx, 10 * TILE_SIZE, 0);

  // 3. Click-to-walk pulsing pixel destination reticle
  if (targetTile) {
    const rx = targetTile.x * TILE_SIZE;
    const ry = targetTile.y * TILE_SIZE;
    const pulse = animFrame % 2 === 0 ? '#ffe066' : '#ffffff';
    px(ctx, rx + 1, ry + 1, 4, 1, pulse);
    px(ctx, rx + 1, ry + 1, 1, 4, pulse);
    px(ctx, rx + 11, ry + 1, 4, 1, pulse);
    px(ctx, rx + 14, ry + 1, 1, 4, pulse);
    px(ctx, rx + 1, ry + 14, 4, 1, pulse);
    px(ctx, rx + 1, ry + 11, 1, 4, pulse);
    px(ctx, rx + 11, ry + 14, 4, 1, pulse);
    px(ctx, rx + 14, ry + 11, 1, 4, pulse);
  }

  // 4. Y-sorted Overworld Characters (Rival Blue at (11,5), Gym Leader Misty at (7,7), Player Red)
  const chars: { y: number; draw: () => void }[] = [
    {
      y: 5 * TILE_SIZE + 15,
      draw: () => drawOverworldChar(ctx, 11 * TILE_SIZE + 8, 5 * TILE_SIZE + 15, 'blue', 'left', 0),
    },
    {
      y: 7 * TILE_SIZE + 15,
      draw: () => drawOverworldChar(ctx, 7 * TILE_SIZE + 8, 7 * TILE_SIZE + 15, 'misty', 'down', 0),
    },
    {
      y: playerPx.y,
      draw: () => drawOverworldChar(ctx, playerPx.x, playerPx.y, 'red', playerFacing, playerStep),
    },
  ];
  chars.sort((a, b) => a.y - b.y);
  for (const c of chars) c.draw();
}
