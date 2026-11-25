import * as THREE from 'three';

/**
 * Procedural HD-2D Pixel-Art Skill VFX Texture Library (NearestFilter CanvasTextures).
 * Replaces raw untextured 3D geometry primitives with crisp, outlined, multi-frame
 * pixel-art sprites, ground shockwave decals, impact bursts, and additive glow halos
 * that blend seamlessly with PMD Pokémon sprites and our pixel-art 3D canyon!
 */

function makePixelCanvas(w: number, h: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  return { canvas, ctx };
}

function toPixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function drawOutlinedPixels(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  outlineColor: string,
  paintFn: () => void,
) {
  paintFn();
  // Generate crisp 1px dark outline around non-transparent silhouette pixels
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  const oc = new THREE.Color(outlineColor);
  const or = Math.round(oc.r * 255);
  const og = Math.round(oc.g * 255);
  const ob = Math.round(oc.b * 255);

  const isSolid = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return src[(y * w + x) * 4 + 3] > 80;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (src[idx + 3] > 80) continue;
      if (isSolid(x - 1, y) || isSolid(x + 1, y) || isSolid(x, y - 1) || isSolid(x, y + 1)) {
        img.data[idx] = or;
        img.data[idx + 1] = og;
        img.data[idx + 2] = ob;
        img.data[idx + 3] = 245;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function pxCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function pxRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  color: string,
) {
  ctx.fillStyle = color;
  const ro2 = rOuter * rOuter;
  const ri2 = rInner * rInner;
  for (let y = Math.floor(cy - rOuter); y <= Math.ceil(cy + rOuter); y++) {
    for (let x = Math.floor(cx - rOuter); x <= Math.ceil(cx + rOuter); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= ro2 && d2 >= ri2) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

export interface SkillVfxAtlas {
  // Multi-frame animated projectile / skill sprites
  fireball: THREE.CanvasTexture[]; // 3 frames 32x32
  thunderbolt: THREE.CanvasTexture[]; // 3 frames 36x96
  razorLeaf: THREE.CanvasTexture[]; // 2 frames 24x24
  shadowStar: THREE.CanvasTexture[]; // 3 frames 32x32
  dragonPulse: THREE.CanvasTexture[]; // 3 frames 44x44
  swiftStar: THREE.CanvasTexture[]; // 2 frames 24x24
  healBell: THREE.CanvasTexture[]; // 2 frames 28x28
  enemyOrb: THREE.CanvasTexture[]; // 2 frames 24x24

  // Ground decals & rings (64x64)
  waterWaveDecal: THREE.CanvasTexture;
  electricRingDecal: THREE.CanvasTexture;
  fireBlastDecal: THREE.CanvasTexture;
  healCircleDecal: THREE.CanvasTexture;
  arcaneRingDecal: THREE.CanvasTexture;
  softGlow: THREE.CanvasTexture;

  // Impact & particle pixel sprites (24x24 / 32x32)
  explosionBurst: THREE.CanvasTexture[]; // 4 frames 32x32
  slashSpark: THREE.CanvasTexture[]; // 2 frames 28x28
  electricSpark: THREE.CanvasTexture;
  waterDrop: THREE.CanvasTexture;
  emberPuff: THREE.CanvasTexture;
  shadowWisp: THREE.CanvasTexture;
  healPlus: THREE.CanvasTexture;
  starGlint: THREE.CanvasTexture;
  koPuff: THREE.CanvasTexture;
}

let cachedAtlas: SkillVfxAtlas | null = null;

export function getSkillVfxAtlas(): SkillVfxAtlas {
  if (cachedAtlas) return cachedAtlas;

  // 1. FIREBALL (3-frame 32x32 blazing cartoon pixel fireball with dark crimson outline!)
  const fireball: THREE.CanvasTexture[] = [0, 1, 2].map((f) => {
    const { canvas, ctx } = makePixelCanvas(32, 32);
    drawOutlinedPixels(ctx, 32, 32, '#4a0e0e', () => {
      // Flickering flame tongues around core
      const tongues = [
        [8 + f, 10, 4],
        [22 - f, 9, 4],
        [7, 19 - f, 3.5],
        [23, 20 + (f % 2), 3.5],
        [15 + (f - 1), 6, 4.2],
        [16 - (f - 1), 24, 3.8],
      ];
      for (const [tx, ty, tr] of tongues) {
        pxCircle(ctx, tx, ty, tr, '#e03131');
      }
      pxCircle(ctx, 16, 16, 9.2, '#f76707');
      pxCircle(ctx, 16 + (f - 1) * 0.6, 16, 6.8, '#ffa94d');
      pxCircle(ctx, 16, 16, 4.4, '#fff3bf');
      pxCircle(ctx, 15, 15, 2.2, '#ffffff');
    });
    return toPixelTexture(canvas);
  });

  // 2. THUNDERBOLT (3-frame 36x96 dramatic jagged pixel lightning bolt with branching arcs!)
  const thunderbolt: THREE.CanvasTexture[] = [0, 1, 2].map((f) => {
    const { canvas, ctx } = makePixelCanvas(36, 96);
    const drawSeg = (x0: number, y0: number, x1: number, y1: number, thick: number, color: string) => {
      ctx.fillStyle = color;
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const px = Math.round(x0 + (x1 - x0) * t);
        const py = Math.round(y0 + (y1 - y0) * t);
        ctx.fillRect(px - Math.floor(thick / 2), py, thick, 2);
      }
    };
    const zigSets: [number, number][][] = [
      [[18, 2], [11, 22], [23, 38], [13, 60], [22, 78], [17, 93]],
      [[19, 2], [25, 20], [12, 42], [24, 62], [14, 80], [18, 93]],
      [[17, 2], [14, 18], [24, 34], [11, 56], [21, 74], [18, 93]],
    ];
    const pts = zigSets[f];
    drawOutlinedPixels(ctx, 36, 96, '#5c3c00', () => {
      // Outer amber lightning body
      for (let i = 0; i < pts.length - 1; i++) {
        drawSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 6, '#fab005');
      }
      // Side branches
      drawSeg(pts[1][0], pts[1][1], pts[1][0] + (f % 2 === 0 ? -7 : 7), pts[1][1] + 15, 2, '#ffd43b');
      drawSeg(pts[3][0], pts[3][1], pts[3][0] + (f % 2 === 0 ? 8 : -8), pts[3][1] + 14, 2, '#ffd43b');
      // Bright yellow inner lightning
      for (let i = 0; i < pts.length - 1; i++) {
        drawSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 4, '#ffe066');
      }
      // Sizzling pure white core
      for (let i = 0; i < pts.length - 1; i++) {
        drawSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2, '#ffffff');
      }
      // Impact starburst base
      pxCircle(ctx, 18, 90, 5, '#ffe066');
      pxCircle(ctx, 18, 90, 2.5, '#ffffff');
    });
    return toPixelTexture(canvas);
  });

  // 3. RAZOR LEAF (2-frame 24x24 curved emerald pixel leaf blade!)
  const razorLeaf: THREE.CanvasTexture[] = [0, 1].map((f) => {
    const { canvas, ctx } = makePixelCanvas(24, 24);
    drawOutlinedPixels(ctx, 24, 24, '#11381b', () => {
      for (let i = 0; i < 16; i++) {
        const x = 4 + i;
        const y = f === 0 ? Math.round(16 - i * 0.55) : Math.round(8 + i * 0.55);
        const w = Math.max(1, Math.round(Math.sin((i / 15) * Math.PI) * 5));
        ctx.fillStyle = '#2f9e44';
        ctx.fillRect(x, y - w, 2, w * 2 + 1);
        ctx.fillStyle = '#69db7c';
        ctx.fillRect(x, y - Math.max(0, w - 1), 1, Math.max(1, w));
        ctx.fillStyle = '#d3f9d8';
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return toPixelTexture(canvas);
  });

  // 4. SHADOW STAR / SHADOW BALL (3-frame 32x32 swirling dark-void orb with violet flames!)
  const shadowStar: THREE.CanvasTexture[] = [0, 1, 2].map((f) => {
    const { canvas, ctx } = makePixelCanvas(32, 32);
    drawOutlinedPixels(ctx, 32, 32, '#1b0729', () => {
      // Swirling outer phantom wisps
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + f * 0.7;
        pxCircle(ctx, 16 + Math.cos(a) * 9.5, 16 + Math.sin(a) * 9.5, 2.8, '#ae3ec9');
      }
      pxCircle(ctx, 16, 16, 8.8, '#7950f2');
      pxCircle(ctx, 16, 16, 6.8, '#3b1557');
      pxCircle(ctx, 16, 16, 4.4, '#1b0729');
      // Bright spectral crescent glint
      pxRing(ctx, 15, 15, 7.2, 5.8, '#e599f7');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(11 + f, 10, 2, 2);
      ctx.fillRect(20 - f, 20, 2, 2);
    });
    return toPixelTexture(canvas);
  });

  // 5. DRAGON PULSE (3-frame 44x44 colossal draconic cyan/indigo energy blast!)
  const dragonPulse: THREE.CanvasTexture[] = [0, 1, 2].map((f) => {
    const { canvas, ctx } = makePixelCanvas(44, 44);
    drawOutlinedPixels(ctx, 44, 44, '#101b42', () => {
      // Roaring draconic energy spikes
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + f * 0.45;
        pxCircle(ctx, 22 + Math.cos(a) * 14, 22 + Math.sin(a) * 14, 4.5, '#5c7cfa');
        pxCircle(ctx, 22 + Math.cos(a) * 11, 22 + Math.sin(a) * 11, 3.5, '#3bc9db');
      }
      pxCircle(ctx, 22, 22, 13.5, '#364fc7');
      pxCircle(ctx, 22, 22, 10.5, '#22b8cf');
      pxCircle(ctx, 22, 22, 7.2, '#99e9f2');
      pxCircle(ctx, 22, 22, 4.2, '#ffffff');
    });
    return toPixelTexture(canvas);
  });

  // 6. SWIFT STAR (2-frame 24x24 iconic golden Pokémon Swift Star!)
  const swiftStar: THREE.CanvasTexture[] = [0, 1].map((f) => {
    const { canvas, ctx } = makePixelCanvas(24, 24);
    drawOutlinedPixels(ctx, 24, 24, '#663c00', () => {
      const cx = 12;
      const cy = 12;
      const rot = f * 0.35;
      for (let y = 2; y < 22; y++) {
        for (let x = 2; x < 22; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx) + rot;
          const starR = 5.4 + Math.cos(ang * 5) * 4.0;
          if (dist <= starR) {
            ctx.fillStyle = dist < 3.2 ? '#ffffff' : dist < 5.6 ? '#fff3bf' : '#ffd43b';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
    return toPixelTexture(canvas);
  });

  // 7. HEAL BELL (2-frame 28x28 golden pixel bell + musical note shimmer!)
  const healBell: THREE.CanvasTexture[] = [0, 1].map((f) => {
    const { canvas, ctx } = makePixelCanvas(28, 28);
    const tilt = f === 0 ? -1 : 1;
    drawOutlinedPixels(ctx, 28, 28, '#4d3300', () => {
      pxCircle(ctx, 14, 6, 2.2, '#ffd43b');
      // Bell dome
      for (let y = 7; y <= 19; y++) {
        const half = Math.round(3 + ((y - 7) / 12) * 6);
        ctx.fillStyle = '#fcc419';
        ctx.fillRect(14 + tilt - half, y, half * 2, 1);
        ctx.fillStyle = '#fff3bf';
        ctx.fillRect(14 + tilt - half + 2, y, 2, 1);
      }
      ctx.fillStyle = '#f08c00';
      ctx.fillRect(14 + tilt - 9, 19, 18, 2);
      pxCircle(ctx, 14 - tilt, 22, 2.2, '#ffe066');
      // Emerald sparkle accents
      ctx.fillStyle = '#69db7c';
      ctx.fillRect(3, 8 + f * 2, 2, 2);
      ctx.fillRect(23, 10 - f * 2, 2, 2);
    });
    return toPixelTexture(canvas);
  });

  // 8. ENEMY HAZARD ORB (2-frame 24x24 crimson danger orb!)
  const enemyOrb: THREE.CanvasTexture[] = [0, 1].map((f) => {
    const { canvas, ctx } = makePixelCanvas(24, 24);
    drawOutlinedPixels(ctx, 24, 24, '#2b0505', () => {
      pxCircle(ctx, 12, 12, 7.2 + f * 0.6, '#e03131');
      pxCircle(ctx, 12, 12, 4.6, '#ff8787');
      pxCircle(ctx, 11, 11, 2.2, '#ffffff');
    });
    return toPixelTexture(canvas);
  });

  // 9. GROUND SHOCKWAVE & RUNE DECALS (64x64 crisp pixel rings!)
  const makePixelWaveDecal = (
    outerCol: string,
    midCol: string,
    innerCol: string,
    speckleCol: string,
    spokes = 0,
  ): THREE.CanvasTexture => {
    const { canvas, ctx } = makePixelCanvas(64, 64);
    pxRing(ctx, 32, 32, 30, 25, outerCol);
    pxRing(ctx, 32, 32, 26, 21, midCol);
    pxRing(ctx, 32, 32, 22, 19, innerCol);
    // Pixel froth / spark speckles along rim
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const r = 24 + (i % 3) * 2;
      ctx.fillStyle = speckleCol;
      ctx.fillRect(Math.round(32 + Math.cos(a) * r), Math.round(32 + Math.sin(a) * r), 2, 2);
    }
    if (spokes > 0) {
      ctx.fillStyle = innerCol;
      for (let i = 0; i < spokes; i++) {
        const a = (i * Math.PI * 2) / spokes;
        for (let r = 10; r < 27; r += 2) {
          ctx.fillRect(Math.round(32 + Math.cos(a) * r), Math.round(32 + Math.sin(a) * r), 2, 2);
        }
      }
    }
    return toPixelTexture(canvas);
  };

  const waterWaveDecal = makePixelWaveDecal('#1864ab', '#339af0', '#a5d8ff', '#ffffff', 0);
  const electricRingDecal = makePixelWaveDecal('#e67700', '#ffd43b', '#ffffff', '#fff3bf', 8);
  const fireBlastDecal = makePixelWaveDecal('#c92a2a', '#fd7e14', '#ffe066', '#ffffff', 6);
  const healCircleDecal = makePixelWaveDecal('#2b8a3e', '#51cf66', '#d3f9d8', '#ffe066', 4);
  const arcaneRingDecal = makePixelWaveDecal('#5f3dc4', '#ae3ec9', '#eebefa', '#ffffff', 6);

  // Soft radial additive glow texture (used for ground lighting & halo bloom!)
  const softGlow = (() => {
    const { canvas, ctx } = makePixelCanvas(32, 32);
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return toPixelTexture(canvas);
  })();

  // 10. IMPACT BURST SPRITES (4-frame 32x32 pixel explosion / hit nova!)
  const explosionBurst: THREE.CanvasTexture[] = [0, 1, 2, 3].map((f) => {
    const { canvas, ctx } = makePixelCanvas(32, 32);
    drawOutlinedPixels(ctx, 32, 32, '#3d1008', () => {
      if (f === 0) {
        pxCircle(ctx, 16, 16, 8, '#ffffff');
        pxCircle(ctx, 16, 16, 5, '#ffe066');
      } else if (f === 1) {
        pxCircle(ctx, 16, 16, 12, '#ff922b');
        pxCircle(ctx, 16, 16, 8, '#ffe066');
        pxCircle(ctx, 16, 16, 4.5, '#ffffff');
      } else if (f === 2) {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          pxCircle(ctx, 16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 5, '#e8590c');
          pxCircle(ctx, 16 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 3, '#ffd43b');
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 + 0.4;
          pxCircle(ctx, 16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10, 3.2, '#adb5bd');
        }
      }
    });
    return toPixelTexture(canvas);
  });

  // 11. SLASH SPARK (2-frame 28x28 crisp anime pixel diagonal slash arc!)
  const slashSpark: THREE.CanvasTexture[] = [0, 1].map((f) => {
    const { canvas, ctx } = makePixelCanvas(28, 28);
    drawOutlinedPixels(ctx, 28, 28, '#164a22', () => {
      for (let i = 0; i < 20; i++) {
        const x = 4 + i;
        const y = f === 0 ? 23 - i : 4 + i;
        const t = Math.max(1, Math.round(Math.sin((i / 19) * Math.PI) * 4));
        ctx.fillStyle = '#51cf66';
        ctx.fillRect(x, y - t, 2, t * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, 2, 1);
      }
    });
    return toPixelTexture(canvas);
  });

  // 12. MICRO PIXEL PARTICLE SPRITES (16x16)
  const makeMicroSprite = (outline: string, paint: (ctx: CanvasRenderingContext2D) => void) => {
    const { canvas, ctx } = makePixelCanvas(16, 16);
    drawOutlinedPixels(ctx, 16, 16, outline, () => paint(ctx));
    return toPixelTexture(canvas);
  };

  const electricSpark = makeMicroSprite('#5c3c00', (ctx) => {
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(7, 2, 2, 12);
    ctx.fillRect(2, 7, 12, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(6, 6, 4, 4);
  });

  const waterDrop = makeMicroSprite('#184070', (ctx) => {
    pxCircle(ctx, 8, 10, 3.6, '#339af0');
    ctx.fillStyle = '#339af0';
    ctx.fillRect(7, 4, 2, 4);
    ctx.fillStyle = '#d0ebff';
    ctx.fillRect(6, 9, 2, 2);
  });

  const emberPuff = makeMicroSprite('#5c1408', (ctx) => {
    pxCircle(ctx, 8, 8, 4, '#fd7e14');
    pxCircle(ctx, 8, 8, 2.2, '#fff3bf');
  });

  const shadowWisp = makeMicroSprite('#1b0729', (ctx) => {
    pxCircle(ctx, 8, 8, 4.2, '#9c36b5');
    pxCircle(ctx, 8, 8, 2, '#eebefa');
  });

  const healPlus = makeMicroSprite('#145224', (ctx) => {
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(6, 3, 4, 10);
    ctx.fillRect(3, 6, 10, 4);
    ctx.fillStyle = '#d3f9d8';
    ctx.fillRect(7, 4, 2, 8);
  });

  const starGlint = makeMicroSprite('#5c3c00', (ctx) => {
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(7, 2, 2, 12);
    ctx.fillRect(2, 7, 12, 2);
    ctx.fillRect(5, 5, 6, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 7, 2, 2);
  });

  const koPuff = makeMicroSprite('#343a40', (ctx) => {
    pxCircle(ctx, 6, 9, 3.4, '#e9ecef');
    pxCircle(ctx, 10, 8, 3.8, '#ffffff');
    pxCircle(ctx, 8, 6, 3, '#f8f9fa');
  });

  cachedAtlas = {
    fireball,
    thunderbolt,
    razorLeaf,
    shadowStar,
    dragonPulse,
    swiftStar,
    healBell,
    enemyOrb,
    waterWaveDecal,
    electricRingDecal,
    fireBlastDecal,
    healCircleDecal,
    arcaneRingDecal,
    softGlow,
    explosionBurst,
    slashSpark,
    electricSpark,
    waterDrop,
    emberPuff,
    shadowWisp,
    healPlus,
    starGlint,
    koPuff,
  };
  return cachedAtlas;
}
