import * as THREE from 'three';

export type TownInteractKind = 'pokemon_center' | 'poke_mart' | 'transit_station';

export interface TownInteractPoint {
  id: string;
  townName: string;
  kind: TownInteractKind;
  label: string;
  hint: string;
  x: number;
  z: number;
  radius: number;
}

export interface TownCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ProceduralTownInstance {
  id: string;
  name: string;
  centerX: number;
  centerZ: number;
  safeRadius: number;
  group: THREE.Group;
  interactPoints: TownInteractPoint[];
  colliders: TownCollider[];
  trainGroup?: THREE.Group;
  trainBaseX?: number;
}

const OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: 0x161922,
  side: THREE.BackSide,
});

function makePixelTex(
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

/** Adds a mesh with PokéBonk-style crisp black ink cel-outline shell (inverted hull) */
function addOutlinedMesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  outlineScale = 0.055,
  rotY = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  if (outlineScale > 0) {
    const out = new THREE.Mesh(geo, OUTLINE_MAT);
    out.scale.set(1 + outlineScale, 1 + outlineScale * 0.9, 1 + outlineScale);
    mesh.add(out);
  }
  return mesh;
}

interface TownTexPalette {
  road: THREE.CanvasTexture;
  crosswalk: THREE.CanvasTexture;
  plaza: THREE.CanvasTexture;
  centerWall: THREE.CanvasTexture;
  centerRoof: THREE.CanvasTexture;
  martWall: THREE.CanvasTexture;
  martRoof: THREE.CanvasTexture;
  houseWalls: THREE.CanvasTexture[];
  houseRoofs: THREE.CanvasTexture[];
  stationRoof: THREE.CanvasTexture;
  trainSide: THREE.CanvasTexture;
  railTrack: THREE.CanvasTexture;
  pokeballSign: THREE.CanvasTexture;
  martSign: THREE.CanvasTexture;
  busSign: THREE.CanvasTexture;
}

let CACHED_PALETTE: TownTexPalette | null = null;

function getTownTextures(): TownTexPalette {
  if (CACHED_PALETTE) return CACHED_PALETTE;

  // Cobblestone & pixel asphalt street texture
  const road = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#5c6473';
      ctx.fillRect(0, 0, 32, 32);
      // Side curb trims
      ctx.fillStyle = '#c8c4b8';
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillStyle = '#8b93a1';
      ctx.fillRect(0, 3, 32, 1);
      ctx.fillRect(0, 28, 32, 1);
      // Dashed lane center line
      ctx.fillStyle = '#f2e8cf';
      ctx.fillRect(4, 15, 10, 2);
      ctx.fillRect(20, 15, 8, 2);
      // Subtle pixel stone speckles
      ctx.fillStyle = '#4e5563';
      for (let i = 0; i < 22; i++) {
        ctx.fillRect((i * 7 + 3) % 30, 5 + ((i * 11) % 21), 2, 1);
      }
    },
    1,
    1,
  );

  const crosswalk = makePixelTex(32, 32, (ctx) => {
    ctx.fillStyle = '#5c6473';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#f5f1e6';
    for (let y = 4; y < 28; y += 6) {
      ctx.fillRect(4, y, 24, 3);
    }
  });

  const plaza = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#ded4bc';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#cbbda0';
      for (let y = 0; y < 32; y += 8) {
        ctx.fillRect(0, y, 32, 1);
        for (let x = (y % 16 === 0 ? 0 : 4); x < 32; x += 8) {
          ctx.fillRect(x, y, 1, 8);
        }
      }
      ctx.fillStyle = '#ede5d2';
      ctx.fillRect(2, 2, 5, 5);
      ctx.fillRect(18, 10, 5, 5);
      ctx.fillRect(10, 26, 5, 5);
    },
    4,
    4,
  );

  // Pokémon Center warm ivory wall with glowing cyan clinic windows & sliding doors
  const centerWall = makePixelTex(64, 32, (ctx) => {
    ctx.fillStyle = '#f7f3e8';
    ctx.fillRect(0, 0, 64, 32);
    // Stone plinth
    ctx.fillStyle = '#b9b4a8';
    ctx.fillRect(0, 26, 64, 6);
    ctx.fillStyle = '#e04f47';
    ctx.fillRect(0, 0, 64, 4);
    // Windows left & right
    const drawWin = (wx: number) => {
      ctx.fillStyle = '#252a38';
      ctx.fillRect(wx, 9, 14, 12);
      ctx.fillStyle = '#74c0fc';
      ctx.fillRect(wx + 2, 11, 10, 8);
      ctx.fillStyle = '#d0ebff';
      ctx.fillRect(wx + 3, 12, 3, 3);
    };
    drawWin(5);
    drawWin(45);
    // Center glass sliding doors
    ctx.fillStyle = '#252a38';
    ctx.fillRect(24, 10, 16, 22);
    ctx.fillStyle = '#63e6be';
    ctx.fillRect(26, 12, 5, 19);
    ctx.fillRect(33, 12, 5, 19);
    ctx.fillStyle = '#e6fcf5';
    ctx.fillRect(27, 14, 2, 6);
    ctx.fillRect(34, 14, 2, 6);
  });

  // Coral-red curved tile roof for Pokémon Center
  const centerRoof = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#d9383a';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#b62427';
      for (let y = 0; y < 32; y += 6) {
        ctx.fillRect(0, y, 32, 2);
      }
      ctx.fillStyle = '#f0655b';
      for (let y = 2; y < 32; y += 6) {
        for (let x = (y % 12 === 2 ? 0 : 4); x < 32; x += 8) {
          ctx.fillRect(x, y, 6, 2);
        }
      }
    },
    2,
    2,
  );

  // Poké Mart wall with striped blue awning & lit merchandise window
  const martWall = makePixelTex(64, 32, (ctx) => {
    ctx.fillStyle = '#f4f6fa';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#9aa5b5';
    ctx.fillRect(0, 27, 64, 5);
    // Blue-white striped shop awning
    for (let x = 0; x < 64; x += 8) {
      ctx.fillStyle = (x / 8) % 2 === 0 ? '#1c7ed6' : '#ffffff';
      ctx.fillRect(x, 4, 8, 6);
    }
    // Display window
    ctx.fillStyle = '#1e2536';
    ctx.fillRect(6, 12, 22, 13);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(8, 14, 18, 9);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(10, 17, 4, 4);
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(16, 17, 4, 4);
    ctx.fillStyle = '#339af0';
    ctx.fillRect(21, 16, 3, 5);
    // Door
    ctx.fillStyle = '#1e2536';
    ctx.fillRect(38, 12, 16, 20);
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(40, 14, 12, 16);
    ctx.fillStyle = '#d0ebff';
    ctx.fillRect(42, 16, 3, 8);
  });

  const martRoof = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#1971c2';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#145594';
      for (let y = 0; y < 32; y += 6) ctx.fillRect(0, y, 32, 2);
      ctx.fillStyle = '#4dabf7';
      for (let y = 2; y < 32; y += 6) {
        for (let x = (y % 12 === 2 ? 0 : 4); x < 32; x += 8) {
          ctx.fillRect(x, y, 6, 2);
        }
      }
    },
    2,
    2,
  );

  // 3 distinct cozy residential town house walls (timber cream, warm terracotta brick, sage cottage)
  const makeHouseWall = (base: string, trim: string, door: string) =>
    makePixelTex(48, 32, (ctx) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 48, 32);
      // Timber beams / brick lines
      ctx.fillStyle = trim;
      ctx.fillRect(0, 0, 48, 3);
      ctx.fillRect(0, 27, 48, 5);
      ctx.fillRect(0, 0, 3, 32);
      ctx.fillRect(45, 0, 3, 32);
      // Warm glowing pixel windows
      const drawW = (x: number) => {
        ctx.fillStyle = '#2b241d';
        ctx.fillRect(x, 8, 10, 10);
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(x + 2, 10, 6, 6);
        ctx.fillStyle = '#2b241d';
        ctx.fillRect(x + 4, 10, 2, 6);
        ctx.fillRect(x + 2, 12, 6, 2);
        // Flower box
        ctx.fillStyle = '#2f9e44';
        ctx.fillRect(x, 18, 10, 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(x + 2, 17, 2, 2);
        ctx.fillRect(x + 6, 17, 2, 2);
      };
      drawW(6);
      drawW(32);
      // Wooden door
      ctx.fillStyle = '#2b241d';
      ctx.fillRect(19, 13, 10, 19);
      ctx.fillStyle = door;
      ctx.fillRect(21, 15, 6, 17);
      ctx.fillStyle = '#ffd43b';
      ctx.fillRect(25, 23, 2, 2);
    });

  const makeShingleRoof = (main: string, dark: string, hi: string) =>
    makePixelTex(
      32,
      32,
      (ctx) => {
        ctx.fillStyle = main;
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = dark;
        for (let y = 0; y < 32; y += 6) ctx.fillRect(0, y, 32, 2);
        ctx.fillStyle = hi;
        for (let y = 2; y < 32; y += 6) {
          for (let x = (y % 12 === 2 ? 1 : 5); x < 32; x += 8) {
            ctx.fillRect(x, y, 5, 2);
          }
        }
      },
      2,
      2,
    );

  const houseWalls = [
    makeHouseWall('#f4ead5', '#8d6e4e', '#a35d32'),
    makeHouseWall('#ebd6c3', '#9c523b', '#6b4226'),
    makeHouseWall('#dfebd8', '#52734d', '#7c5534'),
  ];
  const houseRoofs = [
    makeShingleRoof('#b85d3b', '#873d23', '#d97a54'),
    makeShingleRoof('#4f6d52', '#344c37', '#6f9473'),
    makeShingleRoof('#5c5470', '#3d374d', '#7d7396'),
  ];

  const stationRoof = makeShingleRoof('#38598b', '#223a5e', '#587eb5');

  // Cute pixel-art Pokémon Express Train side texture
  const trainSide = makePixelTex(64, 32, (ctx) => {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#e03131';
    ctx.fillRect(0, 0, 64, 6);
    ctx.fillRect(0, 20, 64, 6);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(0, 18, 64, 2);
    ctx.fillStyle = '#343a40';
    ctx.fillRect(0, 26, 64, 6);
    // Train windows
    for (let x = 6; x < 56; x += 14) {
      ctx.fillStyle = '#1d2433';
      ctx.fillRect(x, 8, 10, 9);
      ctx.fillStyle = '#a5d8ff';
      ctx.fillRect(x + 2, 10, 6, 5);
    }
  });

  // Railway tracks with wooden sleepers & steel rails
  const railTrack = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#8b8378';
      ctx.fillRect(0, 0, 32, 32);
      // Gravel speckles
      ctx.fillStyle = '#736b61';
      for (let i = 0; i < 18; i++) {
        ctx.fillRect((i * 9) % 30, (i * 7) % 30, 2, 2);
      }
      // Wooden sleepers
      ctx.fillStyle = '#5c4028';
      for (let x = 2; x < 32; x += 8) {
        ctx.fillRect(x, 4, 4, 24);
      }
      // Steel rails
      ctx.fillStyle = '#ced4da';
      ctx.fillRect(0, 7, 32, 3);
      ctx.fillRect(0, 22, 32, 3);
      ctx.fillStyle = '#495057';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 25, 32, 1);
    },
    10,
    1,
  );

  // Pokéball Rooftop Sign
  const pokeballSign = makePixelTex(32, 32, (ctx) => {
    ctx.fillStyle = '#fff9db';
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#1b1f2a';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 29, 29);
    // Pokéball icon
    ctx.fillStyle = '#e03131';
    ctx.beginPath();
    ctx.arc(16, 16, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(16, 16, 10, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#1b1f2a';
    ctx.fillRect(6, 14, 20, 4);
    ctx.beginPath();
    ctx.arc(16, 16, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(16, 16, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // MART Rooftop Sign
  const martSign = makePixelTex(48, 24, (ctx) => {
    ctx.fillStyle = '#1c7ed6';
    ctx.fillRect(0, 0, 48, 24);
    ctx.strokeStyle = '#141926';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 45, 21);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MART', 24, 13);
  });

  // Bus Stop Sign
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

  CACHED_PALETTE = {
    road,
    crosswalk,
    plaza,
    centerWall,
    centerRoof,
    martWall,
    martRoof,
    houseWalls,
    houseRoofs,
    stationRoof,
    trainSide,
    railTrack,
    pokeballSign,
    martSign,
    busSign,
  };
  return CACHED_PALETTE;
}

function buildPokemonCenterMesh(tex: TownTexPalette): THREE.Group {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ map: tex.centerWall });
  const sideWallMat = new THREE.MeshLambertMaterial({ color: 0xf4efe2 });
  const roofMat = new THREE.MeshLambertMaterial({ map: tex.centerRoof });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x3b4252 });
  const signMat = new THREE.MeshBasicMaterial({ map: tex.pokeballSign });

  // Foundation plinth
  addOutlinedMesh(g, new THREE.BoxGeometry(8.8, 0.5, 6.4), trimMat, 0, 0.25, 0, 0.025);
  // Main building body (textured front on +Z)
  const bodyMats = [sideWallMat, sideWallMat, sideWallMat, sideWallMat, wallMat, sideWallMat];
  const body = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.6, 5.6), bodyMats);
  body.position.set(0, 2.3, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const bodyOut = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.6, 5.6), OUTLINE_MAT);
  bodyOut.scale.set(1.03, 1.03, 1.03);
  body.add(bodyOut);

  // Iconic stepped coral-red curved Pokémon Center roof
  addOutlinedMesh(g, new THREE.BoxGeometry(9.0, 1.05, 6.3), roofMat, 0, 4.6, 0, 0.032);
  addOutlinedMesh(g, new THREE.BoxGeometry(7.2, 0.9, 4.7), roofMat, 0, 5.5, 0, 0.038);
  // Rooftop Pokéball Emblem Sign
  addOutlinedMesh(g, new THREE.BoxGeometry(2.0, 2.0, 0.45), signMat, 0, 6.75, 1.75, 0.06);
  // Entrance canopy awning
  addOutlinedMesh(g, new THREE.BoxGeometry(3.2, 0.32, 1.5), roofMat, 0, 3.1, 3.3, 0.05);
  // Warm welcome mat
  const matMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.4),
    new THREE.MeshBasicMaterial({ color: 0xfa5252 }),
  );
  matMesh.rotation.x = -Math.PI / 2;
  matMesh.position.set(0, 0.06, 3.7);
  g.add(matMesh);

  return g;
}

function buildPokeMartMesh(tex: TownTexPalette): THREE.Group {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ map: tex.martWall });
  const sideWallMat = new THREE.MeshLambertMaterial({ color: 0xedf2f7 });
  const roofMat = new THREE.MeshLambertMaterial({ map: tex.martRoof });
  const plinthMat = new THREE.MeshLambertMaterial({ color: 0x495057 });
  const signMat = new THREE.MeshBasicMaterial({ map: tex.martSign });

  addOutlinedMesh(g, new THREE.BoxGeometry(7.4, 0.45, 5.8), plinthMat, 0, 0.22, 0, 0.025);
  const bodyMats = [sideWallMat, sideWallMat, sideWallMat, sideWallMat, wallMat, sideWallMat];
  const body = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.4, 5.2), bodyMats);
  body.position.set(0, 2.15, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const bodyOut = new THREE.Mesh(new THREE.BoxGeometry(6.8, 3.4, 5.2), OUTLINE_MAT);
  bodyOut.scale.set(1.032, 1.032, 1.032);
  body.add(bodyOut);

  // Blue tiled sloped roof
  addOutlinedMesh(g, new THREE.BoxGeometry(7.6, 0.95, 5.9), roofMat, 0, 4.3, 0, 0.032);
  addOutlinedMesh(g, new THREE.BoxGeometry(5.6, 0.7, 4.2), roofMat, 0, 5.05, 0, 0.04);
  // MART sign board
  addOutlinedMesh(g, new THREE.BoxGeometry(2.8, 1.35, 0.36), signMat, 0, 5.95, 2.15, 0.06);
  // Entrance mat
  const matMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.3),
    new THREE.MeshBasicMaterial({ color: 0x228be6 }),
  );
  matMesh.rotation.x = -Math.PI / 2;
  matMesh.position.set(0, 0.06, 3.4);
  g.add(matMesh);

  return g;
}

function buildTownHouseMesh(tex: TownTexPalette, variantIdx: number): THREE.Group {
  const g = new THREE.Group();
  const wTex = tex.houseWalls[variantIdx % tex.houseWalls.length];
  const rTex = tex.houseRoofs[variantIdx % tex.houseRoofs.length];
  const wallMat = new THREE.MeshLambertMaterial({ map: wTex });
  const sideMat = new THREE.MeshLambertMaterial({ color: variantIdx % 2 === 0 ? 0xefe3cb : 0xdbe7d4 });
  const roofMat = new THREE.MeshLambertMaterial({ map: rTex });
  const chimMat = new THREE.MeshLambertMaterial({ color: 0x8d5b4c });

  const bodyMats = [sideMat, sideMat, sideMat, sideMat, wallMat, sideMat];
  const body = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.1, 4.6), bodyMats);
  body.position.set(0, 1.55, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const bodyOut = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.1, 4.6), OUTLINE_MAT);
  bodyOut.scale.set(1.038, 1.038, 1.038);
  body.add(bodyOut);

  // Pitched prism roof (4-sided pyramid/gable)
  const roofGeo = new THREE.ConeGeometry(4.35, 2.25, 4);
  roofGeo.rotateY(Math.PI / 4);
  addOutlinedMesh(g, roofGeo, roofMat, 0, 4.18, 0, 0.045);

  // Pixel brick chimney
  addOutlinedMesh(g, new THREE.BoxGeometry(0.85, 1.6, 0.85), chimMat, 1.4, 4.5, -0.9, 0.07);

  return g;
}

function buildBusStopMesh(tex: TownTexPalette): THREE.Group {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x495057 });
  const roofMat = new THREE.MeshLambertMaterial({ map: tex.stationRoof });
  const benchMat = new THREE.MeshLambertMaterial({ color: 0xb07d4f });
  const signMat = new THREE.MeshBasicMaterial({ map: tex.busSign });

  // Shelter pillars
  addOutlinedMesh(g, new THREE.BoxGeometry(0.24, 2.4, 0.24), metalMat, -1.7, 1.2, -0.7, 0.14);
  addOutlinedMesh(g, new THREE.BoxGeometry(0.24, 2.4, 0.24), metalMat, 1.7, 1.2, -0.7, 0.14);
  // Shelter canopy
  addOutlinedMesh(g, new THREE.BoxGeometry(4.2, 0.3, 2.0), roofMat, 0, 2.5, 0, 0.05);
  // Wooden waiting bench
  addOutlinedMesh(g, new THREE.BoxGeometry(2.6, 0.24, 0.72), benchMat, 0, 0.65, -0.25, 0.06);
  // Standing BUS sign pole
  addOutlinedMesh(g, new THREE.BoxGeometry(0.18, 2.5, 0.18), metalMat, 2.6, 1.25, 0.5, 0.15);
  addOutlinedMesh(g, new THREE.BoxGeometry(0.95, 0.95, 0.18), signMat, 2.6, 2.6, 0.5, 0.08);
  return g;
}

function buildTrainStationAndExpress(tex: TownTexPalette): { group: THREE.Group; train: THREE.Group } {
  const g = new THREE.Group();
  const platformMat = new THREE.MeshLambertMaterial({ color: 0xc8c3b8 });
  const yellowTrimMat = new THREE.MeshBasicMaterial({ color: 0xfcc419 });
  const roofMat = new THREE.MeshLambertMaterial({ map: tex.stationRoof });
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x3b4252 });
  const trainMat = new THREE.MeshLambertMaterial({ map: tex.trainSide });
  const trainFrontMat = new THREE.MeshLambertMaterial({ color: 0xe03131 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x212529 });

  // Rail track bed spanning 36 units along X
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 3.2),
    new THREE.MeshLambertMaterial({ map: tex.railTrack }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.05, -2.5);
  g.add(track);

  // Raised station platform
  addOutlinedMesh(g, new THREE.BoxGeometry(14, 0.55, 3.4), platformMat, 0, 0.28, 1.1, 0.02);
  // Safety yellow platform line
  const line = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 0.26), yellowTrimMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.58, -0.35);
  g.add(line);

  // Station awning pillars & canopy
  for (const px of [-5.2, 0, 5.2]) {
    addOutlinedMesh(g, new THREE.BoxGeometry(0.32, 3.1, 0.32), pillarMat, px, 2.0, 1.5, 0.12);
  }
  addOutlinedMesh(g, new THREE.BoxGeometry(13.4, 0.45, 3.6), roofMat, 0, 3.65, 1.1, 0.025);

  // Cute 2-car Pixel Express Train on the rails!
  const train = new THREE.Group();
  train.position.set(-2, 0.2, -2.5);
  for (const carX of [-4.4, 4.4]) {
    const carMats = [trainFrontMat, trainFrontMat, trainFrontMat, wheelMat, trainMat, trainMat];
    const car = new THREE.Mesh(new THREE.BoxGeometry(7.8, 2.4, 2.4), carMats);
    car.position.set(carX, 1.55, 0);
    car.castShadow = true;
    train.add(car);
    const carOut = new THREE.Mesh(new THREE.BoxGeometry(7.8, 2.4, 2.4), OUTLINE_MAT);
    carOut.scale.set(1.03, 1.04, 1.05);
    car.add(carOut);
    // Wheels
    for (const wx of [-2.4, 2.4]) {
      addOutlinedMesh(train, new THREE.BoxGeometry(0.9, 0.6, 2.55), wheelMat, carX + wx, 0.45, 0, 0.08);
    }
  }
  // Coupler between cars
  addOutlinedMesh(train, new THREE.BoxGeometry(1.4, 0.6, 1.1), wheelMat, 0, 1.1, 0, 0.08);
  g.add(train);

  return { group: g, train };
}

function buildStreetLamp(): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b303a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
  addOutlinedMesh(g, new THREE.BoxGeometry(0.22, 3.2, 0.22), poleMat, 0, 1.6, 0, 0.14);
  addOutlinedMesh(g, new THREE.BoxGeometry(0.75, 0.55, 0.75), bulbMat, 0, 3.35, 0, 0.09);
  return g;
}

const TOWN_NAMES = [
  '真新小镇',
  '常磐镇',
  '尼比市集',
  '华蓝水岸',
  '枯叶港镇',
  '玉虹花都',
  '浅红林镇',
  '双叶风谷',
];

/**
 * Procedurally assembles a complete Pokémon Town at (centerX, centerZ) with:
 * - Cobblestone plaza + crossroad streets + crosswalks + streetlamps
 * - Pokémon Center (interactive healing)
 * - Poké Mart (interactive boutique shop)
 * - 3 randomized town houses
 * - Bus Stop Shelter + Rail Station with Pixel Express Train (interactive fast travel / world tour)
 */
export function buildProceduralTown3D(
  id: string,
  centerX: number,
  centerZ: number,
  seed: number,
  getGroundHeight: (x: number, z: number) => number,
  customName?: string,
): ProceduralTownInstance {
  const tex = getTownTextures();
  const group = new THREE.Group();
  const baseY = getGroundHeight(centerX, centerZ);
  group.position.set(centerX, baseY, centerZ);

  const townName = customName ?? TOWN_NAMES[Math.abs(seed) % TOWN_NAMES.length];
  const mirrorX = seed % 2 === 0 ? 1 : -1;

  // 1. Paved Town Plaza & Main Street Grid
  const plazaMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 28),
    new THREE.MeshLambertMaterial({ map: tex.plaza }),
  );
  plazaMesh.rotation.x = -Math.PI / 2;
  plazaMesh.position.set(0, 0.04, 0);
  plazaMesh.receiveShadow = true;
  group.add(plazaMesh);

  // Horizontal Main Avenue
  const roadMat = new THREE.MeshLambertMaterial({ map: tex.road });
  const roadH = new THREE.Mesh(new THREE.PlaneGeometry(38, 5.2), roadMat);
  roadH.rotation.x = -Math.PI / 2;
  roadH.position.set(0, 0.06, 2.2);
  roadH.receiveShadow = true;
  group.add(roadH);

  // Crosswalk stripes at intersection
  const cw = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.8),
    new THREE.MeshLambertMaterial({ map: tex.crosswalk }),
  );
  cw.rotation.x = -Math.PI / 2;
  cw.position.set(0, 0.07, 2.2);
  group.add(cw);

  // 2. Pokémon Center (North-West or North-East by seed)
  const pcX = -6.8 * mirrorX;
  const pcZ = -5.8;
  const pcMesh = buildPokemonCenterMesh(tex);
  pcMesh.position.set(pcX, 0, pcZ);
  group.add(pcMesh);

  // 3. Poké Mart (opposite side of main avenue)
  const martX = 6.8 * mirrorX;
  const martZ = -5.6;
  const martMesh = buildPokeMartMesh(tex);
  martMesh.position.set(martX, 0, martZ);
  group.add(martMesh);

  // 4. Three cozy randomized Town Houses along the South block
  const houseSlots: [number, number, number][] = [
    [-10.2, 8.8, Math.PI],
    [0.0, 9.2, Math.PI],
    [10.2, 8.8, Math.PI],
  ];
  const colliders: TownCollider[] = [
    { minX: centerX + pcX - 4.4, maxX: centerX + pcX + 4.4, minZ: centerZ + pcZ - 3.1, maxZ: centerZ + pcZ + 3.1 },
    { minX: centerX + martX - 3.7, maxX: centerX + martX + 3.7, minZ: centerZ + martZ - 2.9, maxZ: centerZ + martZ + 2.9 },
  ];

  houseSlots.forEach(([hx, hz, rotY], idx) => {
    const hMesh = buildTownHouseMesh(tex, Math.abs(seed) + idx);
    hMesh.position.set(hx, 0, hz);
    hMesh.rotation.y = rotY;
    group.add(hMesh);
    colliders.push({
      minX: centerX + hx - 2.8,
      maxX: centerX + hx + 2.8,
      minZ: centerZ + hz - 2.4,
      maxZ: centerZ + hz + 2.4,
    });
  });

  // 5. Bus Stop Shelter along the curb
  const busX = -14.0 * mirrorX;
  const busZ = -1.2;
  const busMesh = buildBusStopMesh(tex);
  busMesh.position.set(busX, 0, busZ);
  group.add(busMesh);

  // 6. Railway Station & Pixel Express Train along North edge
  const stationZ = -13.6;
  const { group: stationGroup, train } = buildTrainStationAndExpress(tex);
  stationGroup.position.set(0, 0, stationZ);
  group.add(stationGroup);

  // 7. Cozy Streetlamps lining the main avenue
  for (const [lx, lz] of [
    [-11.5, -0.8],
    [0, -0.8],
    [11.5, -0.8],
    [-6.5, 5.2],
    [6.5, 5.2],
  ]) {
    const lamp = buildStreetLamp();
    lamp.position.set(lx, 0, lz);
    group.add(lamp);
  }

  const interactPoints: TownInteractPoint[] = [
    {
      id: `${id}_pc`,
      townName,
      kind: 'pokemon_center',
      label: '🏥 宝可梦中心',
      hint: '全队免费治疗并恢复满血',
      x: centerX + pcX,
      z: centerZ + pcZ + 4.0,
      radius: 3.4,
    },
    {
      id: `${id}_mart`,
      townName,
      kind: 'poke_mart',
      label: '🏪 友好商店',
      hint: '打开精品外观与补给商店',
      x: centerX + martX,
      z: centerZ + martZ + 3.8,
      radius: 3.4,
    },
    {
      id: `${id}_station`,
      townName,
      kind: 'transit_station',
      label: '🚉 城镇车站',
      hint: '乘坐列车 / 公交前往世界巡礼',
      x: centerX,
      z: centerZ + stationZ + 2.6,
      radius: 4.2,
    },
    {
      id: `${id}_bus`,
      townName,
      kind: 'transit_station',
      label: '🚌 公交车站',
      hint: '乘车前往其他城镇或世界巡礼',
      x: centerX + busX,
      z: centerZ + busZ + 2.0,
      radius: 3.2,
    },
  ];

  return {
    id,
    name: townName,
    centerX,
    centerZ,
    safeRadius: 21,
    group,
    interactPoints,
    colliders,
    trainGroup: train,
    trainBaseX: train.position.x,
  };
}
