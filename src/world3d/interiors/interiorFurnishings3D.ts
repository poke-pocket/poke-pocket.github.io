import * as THREE from 'three';
import type { TownCollider, ProximityAutoDoor3D } from '../townTypes';
import {
  addVoxelBox,
  createVoxelBookshelf,
  createVoxelCushionStool,
  createVoxelDiningSet,
  createVoxelDoubleBed,
  createVoxelGlassFreezer,
  createVoxelHealingMachine,
  createVoxelKitchenRangeUnit,
  createVoxelLoungeSofa,
  createVoxelMartCheckoutCounter,
  createVoxelMartGondola,
  createVoxelNightstandWithLamp,
  createVoxelPottedPlant,
  createVoxelRegionMapPoster,
  createVoxelRsePcKiosk,
  createVoxelRseReceptionCounter,
  createVoxelStudyDeskSet,
  createVoxelTealGlassTable,
  createVoxelWallMonitor,
} from '../voxelProps3D';

export type WalkInBuildingKind = 'pokemon_center' | 'poke_mart' | 'hotel' | 'restaurant' | 'house';

export interface InteriorFurnishContext {
  kind: WalkInBuildingKind;
  interiorId: string;
  shellGroup: THREE.Group;
  npcs: THREE.Mesh[];
  colliders: TownCollider[];
  autoDoors: ProximityAutoDoor3D[];
  lotX: number;
  lotZ: number;
  rotY: number;
  baseWorldY: number;
  w: number;
  d: number;
  doorW: number;
  floor1Y: number;
  floor2Y: number;
  H1: number;
  H2: number;
  spawnGbaNpc: (key: string, x: number, y: number, z: number, height?: number) => THREE.Mesh;
  makeLocalObb: (
    lx: number,
    lz: number,
    hw: number,
    hd: number,
    localRotY: number,
    height: number,
    minY: number,
    maxY: number,
  ) => TownCollider;
  addInteriorWallWithDoor: (
    floorIdx: 1 | 2,
    axis: 'x' | 'z',
    fixedCoord: number,
    spanStart: number,
    spanEnd: number,
    doorCenter: number,
    doorWidth?: number,
  ) => void;
  addSolidPartition: (floorIdx: 1 | 2, axis: 'x' | 'z', fixedCoord: number, s0: number, s1: number) => void;
}

let CACHED_RSE_POKECENTER_FLOOR_TEX: THREE.CanvasTexture | null = null;
function getRsePokecenterFloorTex(): THREE.CanvasTexture {
  if (CACHED_RSE_POKECENTER_FLOOR_TEX) return CACHED_RSE_POKECENTER_FLOOR_TEX;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // Warm cream/ivory RSE base floor (`#eae4c5`) + rounded peach-orange pixel tiles (`#df9b6e`)!
  ctx.fillStyle = '#ece6c8';
  ctx.fillRect(0, 0, 64, 64);
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const ox = tx * 32 + 4;
      const oy = ty * 32 + 4;
      ctx.fillStyle = '#e5a87e';
      ctx.fillRect(ox + 2, oy, 20, 24);
      ctx.fillRect(ox, oy + 2, 24, 20);
      ctx.fillStyle = '#f0be99';
      ctx.fillRect(ox + 3, oy + 2, 18, 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  CACHED_RSE_POKECENTER_FLOOR_TEX = tex;
  return tex;
}

/**
 * Furnishes all 5 Walk-In Building Archetypes exclusively with Chibi-Ergonomic 3D Voxel-Pixel Models:
 * - Zero oversized CAD furniture; every chair, bed, table, and counter matches Red (`CHAR_H = 2.40`)!
 * - Pokémon Center directly channels Wesai's RSE Voxel Pokémon Center Diorama (waist-high U-counter, 6-Pokéball
 *   Healing Machine, GBA PC Kiosk, colorful 2-tier Bookshelf, Potted Plant, Teal Table & Cushioned Stools)!
 * - Restaurant separates its Back Kitchen behind a full-height solid partition wall + default-closed swinging door!
 */
export function furnishWalkInInterior3D(ctx: InteriorFurnishContext): void {
  const {
    kind,
    shellGroup,
    npcs,
    colliders,
    baseWorldY,
    w,
    d,
    doorW,
    floor1Y,
    floor2Y,
    H1,
    H2,
    spawnGbaNpc,
    makeLocalObb,
    addInteriorWallWithDoor,
    addSolidPartition,
  } = ctx;

  const placeVoxel = (
    obj: THREE.Object3D,
    opts: {
      x: number;
      y: number;
      z: number;
      rotY?: number;
      halfW?: number;
      halfD?: number;
      colH?: number;
      floor?: 1 | 2;
      solid?: boolean;
    },
  ) => {
    obj.position.set(opts.x, opts.y, opts.z);
    obj.rotation.y = opts.rotY ?? 0;
    shellGroup.add(obj);
    if (opts.solid !== false && opts.halfW && opts.halfD) {
      const fIdx = opts.floor ?? 1;
      const minY = baseWorldY + (fIdx === 2 ? floor2Y : floor1Y) - 0.2;
      const maxY = minY + (fIdx === 2 ? H2 : H1);
      colliders.push(
        makeLocalObb(opts.x, opts.z, opts.halfW, opts.halfD, opts.rotY ?? 0, opts.colH ?? 1.2, minY, maxY),
      );
    }
  };

  if (kind === 'pokemon_center') {
    // ==================== RSE VOXEL POKÉMON CENTER DIORAMA ====================
    // 1. RSE Cream-and-Peach Rounded-Tile Floor Carpet + Pixel Pokéball Emblem + Entrance Doormat!
    const rseFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.8, d - 0.8),
      new THREE.MeshLambertMaterial({ map: getRsePokecenterFloorTex() }),
    );
    rseFloor.rotation.x = -Math.PI / 2;
    rseFloor.position.set(0, floor1Y + 0.015, 0);
    rseFloor.receiveShadow = true;
    shellGroup.add(rseFloor);

    // Pixelated Golden-Orange Pokéball Floor Mosaic right in front of Nurse Joy's counter
    const emblemMat = new THREE.MeshLambertMaterial({ color: 0xe8985e });
    addVoxelBox(shellGroup, 4.6, 0.02, 1.4, emblemMat, 1.8, floor1Y + 0.016, 1.8, false);
    addVoxelBox(shellGroup, 1.4, 0.02, 4.6, emblemMat, 1.8, floor1Y + 0.016, 1.8, false);
    addVoxelBox(shellGroup, 1.5, 0.025, 1.5, new THREE.MeshLambertMaterial({ color: 0xf8f4df }), 1.8, floor1Y + 0.018, 1.8, false);

    // Recessed Orange-Brown RSE Entrance Doormat at Front Door (+Z)
    addVoxelBox(
      shellGroup,
      doorW * 0.86,
      0.04,
      2.2,
      new THREE.MeshLambertMaterial({ color: 0xd98245 }),
      0,
      floor1Y + 0.015,
      d * 0.41,
      false,
    );

    // 2. Waist-High U-Shaped RSE Reception Counter (`1.04u` tall!) + Nurse Joy clearly visible inside!
    const cX = 1.8;
    const cZ = -d * 0.16;
    const counterSpanW = 11.2;
    placeVoxel(createVoxelRseReceptionCounter(counterSpanW, 4.0), {
      x: cX,
      y: floor1Y,
      z: cZ,
      halfW: counterSpanW * 0.5,
      halfD: 0.72,
      colH: 1.05,
    });
    // Side wing colliders of the U-counter
    colliders.push(
      makeLocalObb(cX - counterSpanW * 0.5 + 0.65, cZ - 2.0, 0.68, 2.0, 0, 1.05, baseWorldY + floor1Y - 0.2, baseWorldY + floor1Y + H1),
      makeLocalObb(cX + counterSpanW * 0.5 - 0.65, cZ - 2.0, 0.68, 2.0, 0, 1.05, baseWorldY + floor1Y - 0.2, baseWorldY + floor1Y + H1),
    );

    // 3. 6-Pokéball Healing Machine & Wall Monitor behind Nurse Joy!
    placeVoxel(createVoxelHealingMachine(), {
      x: cX - 2.1,
      y: floor1Y,
      z: cZ - 2.6,
      halfW: 1.4,
      halfD: 0.9,
      colH: 1.4,
    });
    placeVoxel(createVoxelWallMonitor(3.0, 1.65), {
      x: cX + 2.4,
      y: floor1Y + 2.05,
      z: -d * 0.46,
      solid: false,
    });

    // 4. Right of Counter: Iconic GBA Pokémon Storage PC Kiosk + Framed Region Map on East Wall!
    placeVoxel(createVoxelRsePcKiosk(), {
      x: cX + counterSpanW * 0.5 + 1.35,
      y: floor1Y,
      z: -d * 0.38,
      halfW: 0.75,
      halfD: 0.75,
      colH: 2.05,
    });
    placeVoxel(createVoxelRegionMapPoster(2.8, 1.75), {
      x: w * 0.46,
      y: floor1Y + 1.95,
      z: 0.8,
      rotY: -Math.PI / 2,
      solid: false,
    });

    // 5. Left of Counter (clear of stairwell): 2-Tier Colorful Pixel Bookshelf + Voxel Potted Plant + 2 Cushioned Stools!
    placeVoxel(createVoxelBookshelf(3.4), {
      x: cX - counterSpanW * 0.5 - 2.3,
      y: floor1Y,
      z: -d * 0.41,
      halfW: 1.7,
      halfD: 0.6,
      colH: 1.95,
    });
    placeVoxel(createVoxelPottedPlant(), {
      x: cX - counterSpanW * 0.5 - 4.7,
      y: floor1Y,
      z: -d * 0.40,
      halfW: 0.6,
      halfD: 0.6,
      colH: 1.85,
    });
    placeVoxel(createVoxelCushionStool('coral'), {
      x: cX - counterSpanW * 0.5 - 3.6,
      y: floor1Y,
      z: -d * 0.16,
      halfW: 0.58,
      halfD: 0.58,
      colH: 0.64,
    });
    placeVoxel(createVoxelCushionStool('yellow'), {
      x: cX - counterSpanW * 0.5 - 1.9,
      y: floor1Y,
      z: -d * 0.14,
      halfW: 0.58,
      halfD: 0.58,
      colH: 0.64,
    });

    // 6. Front-Right Lounge: Teal Pixel-Shine Glass Table + 4 Coral/Yellow Rounded Voxel Stools!
    const loungeX = w * 0.27;
    const loungeZ = d * 0.20;
    placeVoxel(createVoxelTealGlassTable(3.2, 2.4), {
      x: loungeX,
      y: floor1Y,
      z: loungeZ,
      halfW: 1.6,
      halfD: 1.2,
      colH: 0.82,
    });
    placeVoxel(createVoxelCushionStool('yellow'), { x: loungeX - 2.2, y: floor1Y, z: loungeZ - 0.75, halfW: 0.58, halfD: 0.58, colH: 0.64 });
    placeVoxel(createVoxelCushionStool('coral'), { x: loungeX - 2.2, y: floor1Y, z: loungeZ + 0.75, halfW: 0.58, halfD: 0.58, colH: 0.64 });
    placeVoxel(createVoxelCushionStool('coral'), { x: loungeX, y: floor1Y, z: loungeZ + 1.85, halfW: 0.58, halfD: 0.58, colH: 0.64 });
    placeVoxel(createVoxelCushionStool('yellow'), { x: loungeX + 2.1, y: floor1Y, z: loungeZ, halfW: 0.58, halfD: 0.58, colH: 0.64 });

    // Nurse Joy stands right behind the 1.04u waist-high counter (`cZ - 1.15`) so 65%+ of her full sprite is clearly visible!
    const nurse = spawnGbaNpc('nurse', cX, floor1Y, cZ - 1.15, 2.52);
    const trainer1 = spawnGbaNpc('cooltrainer_m', w * 0.12, floor1Y, d * 0.18, 2.46);
    shellGroup.add(nurse, trainer1);
    npcs.push(nurse, trainer1);

    // 2F Union Room & Trade Lounge
    placeVoxel(createVoxelRsePcKiosk(), { x: 0.5, y: floor2Y, z: -d * 0.38, halfW: 0.75, halfD: 0.75, colH: 2.05, floor: 2 });
    placeVoxel(createVoxelRsePcKiosk(), { x: 6.5, y: floor2Y, z: -d * 0.38, halfW: 0.75, halfD: 0.75, colH: 2.05, floor: 2 });
    placeVoxel(createVoxelLoungeSofa(4.6, '#3b5bdb'), { x: w * 0.26, y: floor2Y, z: -d * 0.26, halfW: 2.3, halfD: 0.9, colH: 1.18, floor: 2 });
    placeVoxel(createVoxelTealGlassTable(3.2, 2.2), { x: w * 0.26, y: floor2Y, z: 1.2, halfW: 1.6, halfD: 1.1, colH: 0.82, floor: 2 });
    placeVoxel(createVoxelCushionStool('blue'), { x: w * 0.26 - 2.2, y: floor2Y, z: 1.2, halfW: 0.58, halfD: 0.58, colH: 0.64, floor: 2 });
    placeVoxel(createVoxelCushionStool('mint'), { x: w * 0.26 + 2.2, y: floor2Y, z: 1.2, halfW: 0.58, halfD: 0.58, colH: 0.64, floor: 2 });
    placeVoxel(createVoxelPottedPlant(), { x: w * 0.40, y: floor2Y, z: d * 0.36, halfW: 0.6, halfD: 0.6, colH: 1.85, floor: 2 });
    return;
  }

  if (kind === 'poke_mart') {
    // ==================== RSE VOXEL POKÉ MART SUPERMARKET ====================
    placeVoxel(createVoxelMartCheckoutCounter(), {
      x: -w * 0.24,
      y: floor1Y,
      z: -d * 0.18,
      halfW: 1.88,
      halfD: 0.75,
      colH: 1.05,
    });
    placeVoxel(createVoxelRsePcKiosk(), {
      x: -w * 0.39,
      y: floor1Y,
      z: -d * 0.38,
      halfW: 0.72,
      halfD: 0.72,
      colH: 2.05,
    });
    // 4 Stocked Voxel Supermarket Gondolas with wide walkable aisles!
    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 2; row++) {
        const gx = w * 0.08 + col * (w * 0.23);
        const gz = -d * 0.18 + row * (d * 0.34);
        placeVoxel(createVoxelMartGondola(4.8, col + row), {
          x: gx,
          y: floor1Y,
          z: gz,
          rotY: Math.PI / 2,
          halfW: 2.4,
          halfD: 0.78,
          colH: 1.94,
        });
      }
    }
    // Cold Beverage Voxel Freezers along East Wall
    for (let fi = 0; fi < 2; fi++) {
      placeVoxel(createVoxelGlassFreezer(3.8), {
        x: w * 0.43,
        y: floor1Y,
        z: -d * 0.22 + fi * 6.4,
        rotY: -Math.PI / 2,
        halfW: 1.9,
        halfD: 0.62,
        colH: 2.15,
      });
    }
    placeVoxel(createVoxelPottedPlant(), { x: -doorW * 0.72, y: floor1Y, z: d * 0.40, halfW: 0.6, halfD: 0.6, colH: 1.85 });
    placeVoxel(createVoxelPottedPlant(), { x: doorW * 0.72, y: floor1Y, z: d * 0.40, halfW: 0.6, halfD: 0.6, colH: 1.85 });

    const clerk = spawnGbaNpc('clerk', -w * 0.24, floor1Y, -d * 0.18 - 1.35, 2.50);
    const shopper = spawnGbaNpc('lass', -w * 0.06, floor1Y, d * 0.12, 2.44);
    shellGroup.add(clerk, shopper);
    npcs.push(clerk, shopper);
    return;
  }

  if (kind === 'restaurant') {
    // ==================== BERRY RESTAURANT WITH ENCLOSED NON-OPEN BACK KITCHEN ====================
    // Full-height solid interior partition wall separating Back Kitchen (`z < -d*0.14`) from Front Dining Hall (`z > -d*0.14`)
    // with a default-CLOSED proximity auto-swinging kitchen service door on the East side (`x = w * 0.26`)!
    const partZ = -d * 0.14;
    addInteriorWallWithDoor(1, 'x', partZ, -w * 0.49, w * 0.49, w * 0.26, 3.2);

    // Inside Enclosed Back Kitchen (`z = -d*0.48 .. partZ`): Twin Voxel Stoves + Hoods + Beverage Cooler + Chef!
    placeVoxel(createVoxelKitchenRangeUnit(), { x: -4.2, y: floor1Y, z: -d * 0.39, halfW: 1.25, halfD: 0.78, colH: 2.1 });
    placeVoxel(createVoxelKitchenRangeUnit(), { x: 0.2, y: floor1Y, z: -d * 0.39, halfW: 1.25, halfD: 0.78, colH: 2.1 });
    placeVoxel(createVoxelGlassFreezer(3.2), { x: -w * 0.38, y: floor1Y, z: -d * 0.30, rotY: Math.PI / 2, halfW: 1.6, halfD: 0.6, colH: 2.15 });

    // Front Dining Hall (`z > partZ`): Waist-high Cashier Host Desk + 4 Voxel Dining Tables with Ramen/Sushi & Ergonomic Chairs!
    placeVoxel(createVoxelMartCheckoutCounter(), {
      x: -2.4,
      y: floor1Y,
      z: partZ + 1.55,
      halfW: 1.85,
      halfD: 0.75,
      colH: 1.05,
    });
    for (let r = 0; r < 2; r++) {
      for (const side of [-1, 1]) {
        const tx = side * (w * 0.27);
        const tz = 2.2 + r * 6.8;
        placeVoxel(createVoxelDiningSet(r + (side > 0 ? 1 : 0)), {
          x: tx,
          y: floor1Y,
          z: tz,
          halfW: 2.1,
          halfD: 1.15,
          colH: 0.96,
        });
      }
    }
    placeVoxel(createVoxelPottedPlant(), { x: -w * 0.41, y: floor1Y, z: d * 0.38, halfW: 0.6, halfD: 0.6, colH: 1.85 });
    placeVoxel(createVoxelPottedPlant(), { x: w * 0.41, y: floor1Y, z: d * 0.38, halfW: 0.6, halfD: 0.6, colH: 1.85 });

    const host = spawnGbaNpc('clerk', -2.4, floor1Y, partZ + 0.55, 2.48);
    const chef = spawnGbaNpc('chef', -1.8, floor1Y, -d * 0.28, 2.50);
    const diner = spawnGbaNpc('picnicker', w * 0.10, floor1Y, 4.8, 2.44);
    shellGroup.add(host, chef, diner);
    npcs.push(host, chef, diner);
    return;
  }

  if (kind === 'hotel') {
    // ==================== 2-STORY GRAND HOTEL (1F Concierge & Lounge + 2F 3 Private Guest Suites) ====================
    placeVoxel(createVoxelRseReceptionCounter(9.2, 3.0), {
      x: 2.0,
      y: floor1Y,
      z: -d * 0.22,
      halfW: 4.6,
      halfD: 0.72,
      colH: 1.05,
    });
    placeVoxel(createVoxelLoungeSofa(4.8, '#ae3ec9'), {
      x: w * 0.28,
      y: floor1Y,
      z: 4.2,
      rotY: -Math.PI / 2,
      halfW: 2.4,
      halfD: 0.9,
      colH: 1.18,
    });
    placeVoxel(createVoxelTealGlassTable(3.0, 2.2), {
      x: w * 0.15,
      y: floor1Y,
      z: 4.2,
      halfW: 1.5,
      halfD: 1.1,
      colH: 0.82,
    });
    placeVoxel(createVoxelCushionStool('yellow'), { x: w * 0.15, y: floor1Y, z: 1.8, halfW: 0.58, halfD: 0.58, colH: 0.64 });
    placeVoxel(createVoxelCushionStool('coral'), { x: w * 0.15, y: floor1Y, z: 6.6, halfW: 0.58, halfD: 0.58, colH: 0.64 });
    placeVoxel(createVoxelBookshelf(3.4), { x: w * 0.34, y: floor1Y, z: -d * 0.41, halfW: 1.7, halfD: 0.6, colH: 1.95 });
    placeVoxel(createVoxelPottedPlant(), { x: -doorW * 0.72, y: floor1Y, z: d * 0.40, halfW: 0.6, halfD: 0.6, colH: 1.85 });
    placeVoxel(createVoxelPottedPlant(), { x: doorW * 0.72, y: floor1Y, z: d * 0.40, halfW: 0.6, halfD: 0.6, colH: 1.85 });

    const concierge = spawnGbaNpc('gentleman', 2.0, floor1Y, -d * 0.22 - 1.15, 2.50);
    const guest1F = spawnGbaNpc('beauty', 2.8, floor1Y, 4.2, 2.46);
    shellGroup.add(concierge, guest1F);
    npcs.push(concierge, guest1F);

    // 2F 3 Private Suites with Solid Walls, Default-Closed Swinging Doors & Chibi-Scaled Voxel Double Beds!
    const corrZ = 3.2;
    const eastSpanStart = -w * 0.44 + 5.2;
    const suiteSpan = (w * 0.48 - eastSpanStart) / 3;
    const quiltColors: ('berry' | 'azure' | 'mint')[] = ['berry', 'azure', 'mint'];
    for (let si = 0; si < 3; si++) {
      const sx0 = eastSpanStart + si * suiteSpan;
      const sx1 = sx0 + suiteSpan;
      const scx = (sx0 + sx1) * 0.5;
      addInteriorWallWithDoor(2, 'x', corrZ, sx0, sx1, scx, 3.3);
      if (si > 0) addSolidPartition(2, 'z', sx0, -d * 0.49, corrZ);
      else addSolidPartition(2, 'z', sx0, -d * 0.22, corrZ);

      placeVoxel(createVoxelDoubleBed(quiltColors[si]), {
        x: scx - 0.9,
        y: floor2Y,
        z: -d * 0.28,
        halfW: 1.9,
        halfD: 2.2,
        colH: 0.95,
        floor: 2,
      });
      placeVoxel(createVoxelNightstandWithLamp(), {
        x: scx - 3.3,
        y: floor2Y,
        z: -d * 0.38,
        halfW: 0.6,
        halfD: 0.55,
        colH: 1.2,
        floor: 2,
      });
      placeVoxel(createVoxelStudyDeskSet(), {
        x: scx + 2.6,
        y: floor2Y,
        z: -d * 0.36,
        halfW: 1.45,
        halfD: 0.8,
        colH: 1.2,
        floor: 2,
      });
    }
    return;
  }

  // ==================== 2-STORY DUPLEX TRAINER APARTMENT (`house`) ====================
  placeVoxel(createVoxelLoungeSofa(4.6, '#3b5bdb'), {
    x: -1.6,
    y: floor1Y,
    z: 6.8,
    rotY: Math.PI,
    halfW: 2.3,
    halfD: 0.9,
    colH: 1.18,
  });
  placeVoxel(createVoxelTealGlassTable(3.0, 2.0), { x: -1.6, y: floor1Y, z: 4.0, halfW: 1.5, halfD: 1.0, colH: 0.82 });
  placeVoxel(createVoxelWallMonitor(2.8, 1.5), { x: -1.6, y: floor1Y + 1.6, z: -d * 0.45, solid: false });
  placeVoxel(createVoxelKitchenRangeUnit(), { x: w * 0.28, y: floor1Y, z: -d * 0.38, halfW: 1.25, halfD: 0.78, colH: 2.1 });
  placeVoxel(createVoxelDiningSet(1), { x: w * 0.24, y: floor1Y, z: 2.4, halfW: 2.1, halfD: 1.15, colH: 0.96 });
  placeVoxel(createVoxelBookshelf(3.2), { x: w * 0.41, y: floor1Y, z: -1.2, rotY: -Math.PI / 2, halfW: 1.6, halfD: 0.6, colH: 1.95 });
  placeVoxel(createVoxelPottedPlant(), { x: w * 0.40, y: floor1Y, z: d * 0.38, halfW: 0.6, halfD: 0.6, colH: 1.85 });

  const res1 = spawnGbaNpc('woman_1', 1.6, floor1Y, 5.4, 2.46);
  const res2 = spawnGbaNpc('boy', w * 0.14, floor1Y, 5.0, 2.38);
  shellGroup.add(res1, res2);
  npcs.push(res1, res2);

  // 2F Master Bedroom + Study separated by solid walls & swinging doors
  const roomX0 = -w * 0.44 + 5.2;
  addInteriorWallWithDoor(2, 'z', roomX0, -d * 0.49, d * 0.49, -2.5, 3.4);
  addInteriorWallWithDoor(2, 'x', 1.2, roomX0, w * 0.49, (roomX0 + w * 0.49) * 0.5, 3.3);
  const mbX = (roomX0 + w * 0.48) * 0.5;
  placeVoxel(createVoxelDoubleBed('berry'), { x: mbX, y: floor2Y, z: -d * 0.28, halfW: 1.9, halfD: 2.2, colH: 0.95, floor: 2 });
  placeVoxel(createVoxelNightstandWithLamp(), { x: mbX - 2.8, y: floor2Y, z: -d * 0.38, halfW: 0.6, halfD: 0.55, colH: 1.2, floor: 2 });
  placeVoxel(createVoxelStudyDeskSet(), { x: mbX - 1.8, y: floor2Y, z: d * 0.34, rotY: Math.PI, halfW: 1.45, halfD: 0.8, colH: 1.2, floor: 2 });
  placeVoxel(createVoxelCushionStool('blue'), { x: mbX - 1.8, y: floor2Y, z: d * 0.18, halfW: 0.58, halfD: 0.58, colH: 0.64, floor: 2 });
  placeVoxel(createVoxelBookshelf(3.0), { x: mbX + 2.2, y: floor2Y, z: d * 0.38, rotY: Math.PI, halfW: 1.5, halfD: 0.6, colH: 1.95, floor: 2 });
}
