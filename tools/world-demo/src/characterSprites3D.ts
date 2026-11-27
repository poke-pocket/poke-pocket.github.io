import * as THREE from 'three';
import type { FacingDir } from '../overworldTiles';

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
  customPal?: (typeof HERO_PALETTES)[HeroId],
) {
  const pal = customPal ?? HERO_PALETTES[heroId];
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

const npcWalkFramesCache: Record<string, Record<string, THREE.CanvasTexture>> = {};

const GBA_PEOPLE_SHEET_MAP: Record<string, string> = {
  red: '/sprites/people/red_normal.png',
  green: '/sprites/people/green_normal.png',
  blue: '/sprites/people/blue.png',
  youngster: '/sprites/people/youngster.png',
  lass: '/sprites/people/lass.png',
  boy: '/sprites/people/boy.png',
  picnicker: '/sprites/people/picnicker.png',
  camper: '/sprites/people/camper.png',
  cooltrainer_m: '/sprites/people/cooltrainer_m.png',
  cooltrainer_f: '/sprites/people/cooltrainer_f.png',
  woman_1: '/sprites/people/woman_1.png',
  woman_2: '/sprites/people/woman_2.png',
  man: '/sprites/people/man.png',
  gentleman: '/sprites/people/gentleman.png',
  beauty: '/sprites/people/beauty.png',
  policeman: '/sprites/people/policeman.png',
  sailor: '/sprites/people/sailor.png',
  hiker: '/sprites/people/hiker.png',
  scientist: '/sprites/people/scientist.png',
  nurse: '/sprites/people/nurse.png',
  clerk: '/sprites/people/clerk.png',
  chef: '/sprites/people/chef.png',
  brock: '/sprites/people/brock.png',
  misty: '/sprites/people/misty.png',
  ltsurge: '/sprites/people/lt_surge.png',
  erika: '/sprites/people/erika.png',
};

/**
 * Loads 100% authentic GBA Pokémon FireRed/LeafGreen 16x32 pixel-art character sprite sheets
 * (matching Protagonist Red & Blue pixel-for-pixel in outline, head proportion, and texel size!).
 * - 9/10-frame sheets (144x32 / 160x32): uses native GBA 4-dir walking frames directly!
 * - 3/4-frame sheets (48x32 / 64x32, e.g. Gym Leaders & Nurse Joy): synthesizes crisp 1-GBA-pixel
 *   alternating foot strides directly on the native 16x32 pixel grid before 2.4x nearest-neighbor scaling!
 */
export function getNpcWalkSpriteFrames(spriteUrlOrKey: string): Record<string, THREE.CanvasTexture> {
  const lower = spriteUrlOrKey.toLowerCase();
  let key = 'youngster';
  if (lower.includes('blue')) return getHeroSpriteFrames('blue');
  if (lower.includes('red')) return getHeroSpriteFrames('red');
  for (const cand of Object.keys(GBA_PEOPLE_SHEET_MAP)) {
    if (lower.includes(cand)) {
      key = cand;
      break;
    }
  }
  if (lower.includes('surge')) key = 'ltsurge';

  if (npcWalkFramesCache[key]) return npcWalkFramesCache[key];

  const dirs: FacingDir[] = ['down', 'up', 'left', 'right'];
  const poses: HeroPoseKey[] = ['idle0', 'idle1', '0', '1', 'jump'];
  const out: Record<string, THREE.CanvasTexture> = {};
  const canvases: Record<string, HTMLCanvasElement> = {};

  // Clean transparent placeholder until the tiny <1KB local PNG decodes in ~1ms
  for (const dir of dirs) {
    for (const pose of poses) {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 56;
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      const k = `${dir}_${pose}`;
      canvases[k] = c;
      out[k] = tex;
    }
  }

  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const fh = img.naturalHeight || 32;
        const fw = 16;
        const nCols = Math.max(1, Math.floor(img.naturalWidth / fw));
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = img.naturalWidth;
        sheetCanvas.height = fh;
        const sctx = sheetCanvas.getContext('2d')!;
        sctx.imageSmoothingEnabled = false;
        sctx.drawImage(img, 0, 0);

        // Measure visible vertical bounds on col 0 so every GBA sprite stands at identical scale & baseline as Red!
        const f0 = sctx.getImageData(0, 0, fw, fh).data;
        let minY = fh;
        let maxY = -1;
        for (let y = 0; y < fh; y++) {
          for (let x = 0; x < fw; x++) {
            if (f0[(y * fw + x) * 4 + 3] > 20) {
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        const visH = maxY >= minY ? maxY - minY + 1 : 22;
        const srcY = maxY >= minY ? minY : 0;
        const scale = Math.min(2.4, 48 / Math.max(16, visH));
        const dw = Math.round(fw * scale);
        const dh = Math.round(visH * scale);
        const dstX = Math.round((48 - dw) / 2);
        const dstBaseY = Math.round(54 - dh);

        // Scratch 16x32 native GBA frame composer for 3/4-col sheets that lack built-in walk columns
        const nativeTile = document.createElement('canvas');
        nativeTile.width = fw;
        nativeTile.height = fh;
        const nctx = nativeTile.getContext('2d')!;
        nctx.imageSmoothingEnabled = false;

        for (const dir of dirs) {
          for (const pose of poses) {
            const k = `${dir}_${pose}`;
            const ctx = canvases[k].getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, 48, 56);

            let flipX = dir === 'right';
            let dy = pose === 'jump' ? -3 : 0;

            if (nCols >= 9) {
              // Full 9/10-frame GBA FireRed walking sheet!
              // Cols: 0=down, 1=up, 2=left, 3=down_w0, 4=down_w1, 5=up_w0, 6=up_w1, 7=left_w0, 8=left_w1
              let col = 0;
              if (dir === 'down') {
                col = pose === '0' ? 3 : pose === '1' || pose === 'jump' ? 4 : 0;
              } else if (dir === 'up') {
                col = pose === '0' ? 5 : pose === '1' || pose === 'jump' ? 6 : 1;
              } else {
                col = pose === '0' ? 7 : pose === '1' || pose === 'jump' ? 8 : 2;
              }
              ctx.save();
              if (flipX) {
                ctx.translate(48, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(sheetCanvas, col * fw, srcY, fw, visH, dstX, dstBaseY + dy, dw, dh);
              ctx.restore();
            } else {
              // 3/4-col GBA sheet (0=down, 1=up, 2=left): compose crisp 1px native GBA leg-stride on 16x32 grid!
              const baseCol = dir === 'down' ? 0 : dir === 'up' ? 1 : Math.min(2, nCols - 1);
              nctx.clearRect(0, 0, fw, fh);
              const splitY = Math.max(0, maxY - 5); // bottom 6 native GBA pixels = legs/shoes
              const isWalk0 = pose === '0';
              const isWalk1 = pose === '1' || pose === 'jump';
              const headBob = isWalk0 || isWalk1 ? -1 : 0;
              // Upper head + torso
              nctx.drawImage(sheetCanvas, baseCol * fw, 0, fw, splitY, 0, headBob, fw, splitY);
              if (!isWalk0 && !isWalk1) {
                nctx.drawImage(sheetCanvas, baseCol * fw, splitY, fw, fh - splitY, 0, 0, fw, fh - splitY);
              } else if (dir === 'down' || dir === 'up') {
                // Alternating left/right foot lift by 1 native GBA pixel!
                const lLift = isWalk0 ? -1 : 0;
                const rLift = isWalk1 ? -1 : 0;
                nctx.drawImage(sheetCanvas, baseCol * fw, splitY, 8, fh - splitY, 0, splitY + lLift, 8, fh - splitY);
                nctx.drawImage(sheetCanvas, baseCol * fw + 8, splitY, 8, fh - splitY, 8, splitY + rLift, 8, fh - splitY);
              } else {
                // Side stride: split legs slightly fore & aft by 1 native GBA pixel!
                const stepShift = isWalk0 ? -1 : 1;
                nctx.drawImage(sheetCanvas, baseCol * fw, splitY, fw, 3, 0, splitY - 1, fw, 3);
                nctx.drawImage(sheetCanvas, baseCol * fw, splitY + 2, fw, fh - splitY - 2, stepShift, splitY + 2, fw, fh - splitY - 2);
              }
              ctx.save();
              if (flipX) {
                ctx.translate(48, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(nativeTile, 0, srcY, fw, visH, dstX, dstBaseY + dy, dw, dh);
              ctx.restore();
            }
            out[k].needsUpdate = true;
          }
        }
      } catch {
        // ignore decode error
      }
    };
    img.src = GBA_PEOPLE_SHEET_MAP[key] ?? GBA_PEOPLE_SHEET_MAP.youngster;
  }

  npcWalkFramesCache[key] = out;
  return out;
}

/**
 * Picks the exact camera-relative 4-direction GBA stride texture ('down' | 'up' | 'left' | 'right' x 'idle0' | '0' | '1')
 * so citizens & trainers genuinely walk with alternating legs & swinging arms (and stand still calmly when idle!).
 */
export function sampleHumanWalkFrame(
  frames: Record<string, THREE.CanvasTexture>,
  relFwd: number,
  relRight: number,
  walkPhase: number,
  isMoving: boolean,
): THREE.CanvasTexture {
  let dir: FacingDir = 'down';
  if (Math.abs(relFwd) >= Math.abs(relRight)) {
    dir = relFwd > 0.15 ? 'up' : 'down';
  } else {
    dir = relRight > 0 ? 'right' : 'left';
  }
  if (!isMoving) {
    const breathePose: HeroPoseKey = Math.floor(walkPhase * 1.4) % 2 === 0 ? 'idle0' : 'idle1';
    return frames[`${dir}_${breathePose}`] ?? frames.down_idle0;
  }
  // Classic 4-step GBA walk cycle: idle0 -> step0 (left leg) -> idle0 -> step1 (right leg)
  const stepIdx = ((Math.floor(walkPhase) % 4) + 4) % 4;
  const pose: HeroPoseKey = stepIdx === 1 ? '0' : stepIdx === 3 ? '1' : 'idle0';
  return frames[`${dir}_${pose}`] ?? frames.down_idle0;
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
