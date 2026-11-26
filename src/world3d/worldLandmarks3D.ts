import * as THREE from 'three';
import { applyPixelArtArchShader } from './townAssetLoader';

/**
 * ICONIC WORLD CITY LANDMARKS (东方明珠 / 东京晴空塔 / 广州小蛮腰 / 北京祈年殿 / 京都五重塔)!
 */
export function buildWorldLandmark3D(cityId: string): THREE.Group | null {
  const g = new THREE.Group();
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x161922, side: THREE.BackSide });
  const addPiece = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    const out = new THREE.Mesh(geo, outlineMat);
    out.scale.set(1.035, 1.02, 1.035);
    m.add(out);
    return m;
  };

  if (cityId === 'shanghai') {
    // 🗼 上海东方明珠广播电视塔 (Oriental Pearl Tower)
    const silverMat = new THREE.MeshLambertMaterial({ color: 0xe9ecef });
    const pearlMat = new THREE.MeshLambertMaterial({ color: 0xf06595, emissive: 0x6b1438 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b, emissive: 0x664d00 });
    // Base pedestal
    addPiece(new THREE.CylinderGeometry(5.2, 6.2, 1.4, 12), silverMat, 0, 0.7, 0);
    // 3 slanted support legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addPiece(new THREE.CylinderGeometry(0.45, 0.7, 13, 8), silverMat, Math.cos(a) * 3.1, 6.2, Math.sin(a) * 3.1, Math.sin(a) * 0.24, 0, -Math.cos(a) * 0.24);
      addPiece(new THREE.CylinderGeometry(0.42, 0.42, 26, 8), silverMat, Math.cos(a) * 1.4, 14.0, Math.sin(a) * 1.4);
    }
    // Lower Giant Ruby-Pink Pearl Sphere
    addPiece(new THREE.SphereGeometry(4.4, 16, 12), pearlMat, 0, 12.2, 0);
    // Upper Observation Pearl Sphere
    addPiece(new THREE.SphereGeometry(3.2, 16, 12), pearlMat, 0, 26.5, 0);
    // Space Capsule & Broadcast Spire
    addPiece(new THREE.SphereGeometry(1.45, 12, 10), goldMat, 0, 34.5, 0);
    addPiece(new THREE.CylinderGeometry(0.14, 0.45, 10.5, 8), silverMat, 0, 39.8, 0);
    return g;
  }

  if (cityId === 'tokyo') {
    // 🗼 东京晴空塔 (Tokyo Skytree)
    const skyWhite = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const deckGlow = new THREE.MeshLambertMaterial({ color: 0x4dabf7, emissive: 0x1864ab });
    addPiece(new THREE.CylinderGeometry(3.8, 5.8, 12, 6), skyWhite, 0, 6.0, 0);
    addPiece(new THREE.CylinderGeometry(2.2, 3.8, 14, 8), skyWhite, 0, 19.0, 0);
    // Tembo Deck (350m ring)
    addPiece(new THREE.CylinderGeometry(3.7, 3.3, 2.6, 12), deckGlow, 0, 24.5, 0);
    addPiece(new THREE.CylinderGeometry(1.3, 2.2, 12, 10), skyWhite, 0, 31.5, 0);
    // Tembo Galleria (450m ring)
    addPiece(new THREE.CylinderGeometry(2.5, 2.3, 1.8, 12), deckGlow, 0, 34.5, 0);
    // Spire antenna
    addPiece(new THREE.CylinderGeometry(0.15, 0.75, 10.5, 8), skyWhite, 0, 41.5, 0);
    return g;
  }

  if (cityId === 'guangzhou') {
    // 🗼 广州塔·小蛮腰 (Canton Tower - iconic pinched hyperboloid waist + rainbow rings!)
    const steelMat = new THREE.MeshLambertMaterial({ color: 0xe5dbff });
    const ringColors = [0xf06595, 0x9775fa, 0x4dabf7, 0x63e6be, 0xffd43b];
    // Lower flared base cone + pinched waist + upper flared crown
    addPiece(new THREE.CylinderGeometry(1.9, 5.2, 16, 12), steelMat, 0, 8.0, 0);
    addPiece(new THREE.CylinderGeometry(3.6, 1.9, 17, 12), steelMat, 0, 24.5, 0);
    // Glowing LED waist rings
    ringColors.forEach((hex, idx) => {
      const y = 6 + idx * 6.4;
      const r = idx === 2 ? 2.15 : idx === 1 || idx === 3 ? 2.95 : 4.1;
      addPiece(
        new THREE.CylinderGeometry(r, r, 0.55, 14),
        new THREE.MeshBasicMaterial({ color: hex }),
        0,
        y,
        0,
      );
    });
    // Top antenna mast
    addPiece(new THREE.CylinderGeometry(0.14, 0.65, 11.0, 8), steelMat, 0, 38.0, 0);
    return g;
  }

  if (cityId === 'beijing') {
    // 🏯 北京祈年殿 (Temple of Heaven - 3-tier royal sapphire-blue roof on white marble terrace!)
    const marbleMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });
    const crimsonMat = new THREE.MeshLambertMaterial({ color: 0xc92a2a });
    const royalBlue = new THREE.MeshLambertMaterial({ color: 0x1864ab, emissive: 0x0b2e59 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    addPiece(new THREE.CylinderGeometry(7.6, 8.2, 1.4, 16), marbleMat, 0, 0.7, 0);
    addPiece(new THREE.CylinderGeometry(6.4, 6.9, 1.2, 16), marbleMat, 0, 2.0, 0);
    addPiece(new THREE.CylinderGeometry(5.0, 5.0, 4.4, 14), crimsonMat, 0, 4.8, 0);
    addPiece(new THREE.CylinderGeometry(4.2, 6.8, 2.2, 16), royalBlue, 0, 7.8, 0);
    addPiece(new THREE.CylinderGeometry(3.6, 3.6, 2.8, 14), crimsonMat, 0, 10.0, 0);
    addPiece(new THREE.CylinderGeometry(2.8, 5.4, 2.2, 16), royalBlue, 0, 12.2, 0);
    addPiece(new THREE.CylinderGeometry(2.2, 2.2, 2.2, 14), crimsonMat, 0, 14.0, 0);
    addPiece(new THREE.ConeGeometry(4.2, 3.4, 16), royalBlue, 0, 16.7, 0);
    addPiece(new THREE.SphereGeometry(0.75, 10, 8), goldMat, 0, 18.8, 0);
    return g;
  }

  if (cityId === 'kyoto') {
    // ⛩️ 京都五重樱花古塔 (Five-Story Pagoda)
    const wallMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xfff4e6 }));
    const vermilion = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xc92a2a }));
    const slateRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x3b4252 }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    addPiece(new THREE.BoxGeometry(8.2, 1.4, 8.2), applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xced4da })), 0, 0.7, 0);
    for (let tier = 0; tier < 5; tier++) {
      const y = 1.4 + tier * 3.6;
      const w = 5.6 - tier * 0.65;
      addPiece(new THREE.BoxGeometry(w, 2.2, w), tier % 2 === 0 ? vermilion : wallMat, 0, y + 1.1, 0);
      const roofGeo = new THREE.ConeGeometry(w * 1.02, 1.6, 4);
      roofGeo.rotateY(Math.PI / 4);
      addPiece(roofGeo, slateRoof, 0, y + 2.9, 0);
    }
    addPiece(new THREE.CylinderGeometry(0.14, 0.28, 4.2, 8), goldMat, 0, 21.8, 0);
    return g;
  }

  if (cityId === 'hangzhou') {
    // 🏯 杭州西湖雷峰塔 (Leifeng Pagoda - 5-tier octagonal bronze-gold pagoda!)
    const stoneBase = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xadb5bd }));
    const crimsonWall = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xa61e22 }));
    const bronzeEave = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xd99b26 }));
    const goldSpire = new THREE.MeshLambertMaterial({ color: 0xffd43b, emissive: 0x5c4300 });
    addPiece(new THREE.CylinderGeometry(7.2, 8.0, 2.4, 8), stoneBase, 0, 1.2, 0);
    for (let tier = 0; tier < 5; tier++) {
      const y = 2.4 + tier * 3.6;
      const r = 5.2 - tier * 0.58;
      addPiece(new THREE.CylinderGeometry(r * 0.92, r, 2.3, 8), crimsonWall, 0, y + 1.15, 0);
      addPiece(new THREE.CylinderGeometry(r * 0.78, r * 1.38, 1.35, 8), bronzeEave, 0, y + 2.85, 0);
    }
    addPiece(new THREE.ConeGeometry(2.6, 2.4, 8), bronzeEave, 0, 21.4, 0);
    addPiece(new THREE.CylinderGeometry(0.14, 0.34, 4.4, 8), goldSpire, 0, 24.4, 0);
    return g;
  }

  if (cityId === 'shenzhen') {
    // 🏢 深圳平安金融中心 (Ping An Finance Centre - tapered steel-glass supertall spire!)
    const glassBlue = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x4dabf7 }));
    const steelTrim = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xdbe4ef }));
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x66d9e8 });
    addPiece(new THREE.BoxGeometry(8.8, 3.0, 8.8), steelTrim, 0, 1.5, 0);
    addPiece(new THREE.CylinderGeometry(3.4, 5.4, 28, 4), glassBlue, 0, 17.0, 0, 0, Math.PI / 4, 0);
    // 4 tapered corner steel ribs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      addPiece(new THREE.BoxGeometry(0.9, 30, 0.9), steelTrim, Math.cos(a) * 3.6, 17.5, Math.sin(a) * 3.6);
    }
    addPiece(new THREE.ConeGeometry(3.3, 8.5, 4), glassBlue, 0, 35.2, 0, 0, Math.PI / 4, 0);
    addPiece(new THREE.SphereGeometry(0.65, 8, 8), cyanGlow, 0, 39.8, 0);
    return g;
  }

  if (cityId === 'chengdu') {
    // 🏮 成都天府蜀韵高阁 (Sichuan Jade-and-Crimson Pavilion Tower!)
    const stone = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xdee2e6 }));
    const vermilion = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xc92a2a }));
    const jadeRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419 });
    addPiece(new THREE.BoxGeometry(9.2, 2.2, 9.2), stone, 0, 1.1, 0);
    for (let t = 0; t < 3; t++) {
      const y = 2.2 + t * 5.2;
      const w = 6.8 - t * 1.1;
      addPiece(new THREE.BoxGeometry(w, 3.4, w), vermilion, 0, y + 1.7, 0);
      const roof = new THREE.ConeGeometry(w * 0.98, 2.2, 4);
      roof.rotateY(Math.PI / 4);
      addPiece(roof, jadeRoof, 0, y + 4.3, 0);
    }
    addPiece(new THREE.SphereGeometry(0.95, 10, 8), goldMat, 0, 19.6, 0);
    return g;
  }

  if (cityId === 'harbin') {
    // ⛪ 哈尔滨圣索菲亚大教堂 (Saint Sophia Cathedral - red brick & iconic emerald onion domes!)
    const redBrick = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xb03a2e }));
    const creamTrim = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xf8f1e5 }));
    const emeraldDome = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b });
    addPiece(new THREE.BoxGeometry(10.5, 7.6, 10.5), redBrick, 0, 3.8, 0);
    addPiece(new THREE.CylinderGeometry(3.4, 3.6, 5.2, 12), creamTrim, 0, 10.2, 0);
    addPiece(new THREE.SphereGeometry(3.6, 14, 10), emeraldDome, 0, 14.2, 0);
    addPiece(new THREE.ConeGeometry(1.5, 3.4, 10), emeraldDome, 0, 18.2, 0);
    addPiece(new THREE.CylinderGeometry(0.12, 0.2, 2.8, 6), goldMat, 0, 20.8, 0);
    // 4 corner tent-roof satellite domes
    for (const [sx, sz] of [[-4.0, -4.0], [4.0, -4.0], [-4.0, 4.0], [4.0, 4.0]]) {
      addPiece(new THREE.CylinderGeometry(1.3, 1.4, 3.2, 8), creamTrim, sx, 9.2, sz);
      addPiece(new THREE.SphereGeometry(1.45, 10, 8), emeraldDome, sx, 11.4, sz);
      addPiece(new THREE.ConeGeometry(0.65, 1.8, 8), goldMat, sx, 13.4, sz);
    }
    return g;
  }

  if (cityId === 'hongkong') {
    // 🏙️ 香港中银大厦 (Bank of China Tower - iconic 4-quadrant triangular crystal prism skyscraper!)
    const crystalGlass = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x74c0fc }));
    const silverFrame = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const quadSpecs: [number, number, number][] = [
      [-1.9, -1.9, 16],
      [1.9, -1.9, 24],
      [-1.9, 1.9, 31],
      [1.9, 1.9, 38],
    ];
    for (const [qx, qz, qh] of quadSpecs) {
      addPiece(new THREE.BoxGeometry(3.7, qh, 3.7), crystalGlass, qx, qh * 0.5, qz);
      addPiece(new THREE.ConeGeometry(2.6, 4.2, 4), silverFrame, qx, qh + 2.1, qz, 0, Math.PI / 4, 0);
    }
    addPiece(new THREE.CylinderGeometry(0.12, 0.24, 9.0, 6), silverFrame, 1.9, 44.5, 1.9);
    addPiece(new THREE.CylinderGeometry(0.12, 0.24, 7.5, 6), silverFrame, -1.9, 37.0, 1.9);
    return g;
  }

  if (cityId === 'osaka') {
    // 🏯 大阪城天守阁 (Osaka Castle Keep - stone rampart + white walls + emerald roofs & gold crests!)
    const stoneWall = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x868e96 }));
    const whitePlaster = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xf8f9fa }));
    const emeraldRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x208b63 }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b });
    addPiece(new THREE.CylinderGeometry(7.0, 8.8, 4.6, 4), stoneWall, 0, 2.3, 0, 0, Math.PI / 4, 0);
    for (let t = 0; t < 4; t++) {
      const y = 4.6 + t * 3.8;
      const w = 7.4 - t * 1.15;
      addPiece(new THREE.BoxGeometry(w, 2.4, w), whitePlaster, 0, y + 1.2, 0);
      const roof = new THREE.ConeGeometry(w * 0.96, 1.7, 4);
      roof.rotateY(Math.PI / 4);
      addPiece(roof, emeraldRoof, 0, y + 3.1, 0);
    }
    addPiece(new THREE.BoxGeometry(2.8, 0.65, 0.7), goldMat, 0, 20.6, 0);
    return g;
  }

  if (cityId === 'sapporo') {
    // 🗼 札幌电视塔 (Sapporo TV Tower - red steel lattice tower with bright green digital clock!)
    const redSteel = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xe03131 }));
    const deckMat = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xdee2e6 }));
    const clockMat = new THREE.MeshBasicMaterial({ color: 0x51cf66 });
    addPiece(new THREE.BoxGeometry(8.2, 3.2, 8.2), deckMat, 0, 1.6, 0);
    addPiece(new THREE.CylinderGeometry(2.4, 4.8, 16, 4), redSteel, 0, 11.2, 0, 0, Math.PI / 4, 0);
    addPiece(new THREE.BoxGeometry(5.6, 3.2, 5.6), deckMat, 0, 20.4, 0);
    addPiece(new THREE.BoxGeometry(3.6, 1.5, 5.85), clockMat, 0, 17.5, 0);
    addPiece(new THREE.BoxGeometry(5.85, 1.5, 3.6), clockMat, 0, 17.5, 0);
    addPiece(new THREE.CylinderGeometry(0.18, 1.6, 12, 4), redSteel, 0, 28.0, 0, 0, Math.PI / 4, 0);
    return g;
  }

  if (cityId === 'fukuoka') {
    // 🗼 福冈海滨镜面塔 (Fukuoka Tower - triangular sapphire mirror prism!)
    const mirrorGlass = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0x339af0 }));
    const silverTrim = new THREE.MeshLambertMaterial({ color: 0xe9ecef });
    addPiece(new THREE.CylinderGeometry(1.1, 5.6, 32, 3), mirrorGlass, 0, 16.0, 0);
    addPiece(new THREE.CylinderGeometry(2.8, 3.4, 2.2, 3), silverTrim, 0, 22.0, 0);
    addPiece(new THREE.CylinderGeometry(0.14, 0.55, 7.5, 6), silverTrim, 0, 35.5, 0);
    return g;
  }

  if (cityId === 'okinawa') {
    // 🏯 冲绳首里城朱红正殿 (Shuri Castle Seiden - vermilion Ryukyu palace on coral limestone terrace!)
    const coralStone = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xe9e2d0 }));
    const vermilion = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xd92626 }));
    const terraRoof = applyPixelArtArchShader(new THREE.MeshLambertMaterial({ color: 0xb8442a }));
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd43b });
    addPiece(new THREE.BoxGeometry(12.2, 2.4, 8.6), coralStone, 0, 1.2, 0);
    addPiece(new THREE.BoxGeometry(10.0, 4.4, 6.4), vermilion, 0, 4.6, 0);
    addPiece(new THREE.BoxGeometry(11.4, 1.5, 7.6), terraRoof, 0, 7.5, 0);
    addPiece(new THREE.BoxGeometry(7.6, 3.4, 4.8), vermilion, 0, 9.9, 0);
    addPiece(new THREE.BoxGeometry(9.2, 1.6, 6.2), terraRoof, 0, 12.4, 0);
    addPiece(new THREE.BoxGeometry(7.8, 0.7, 0.65), goldMat, 0, 13.5, 0);
    return g;
  }

  return null;
}

export function createPokeballBeacon(radius = 1.15): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: 0xfa5252 }),
  );
  const bot = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.03, radius * 1.03, radius * 0.18, 14),
    new THREE.MeshBasicMaterial({ color: 0x181a24 }),
  );
  const btn = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, radius * 0.24, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff9db }),
  );
  btn.rotation.x = Math.PI / 2;
  btn.position.z = radius * 0.92;
  g.add(top, bot, belt, btn);
  return g;
}

/**
 * Refined Monumental Marble Civic Fountain (tiered octagonal stone basins, turquoise shimmering water,
 * warm gold finial & graceful animated water arcs — centered in the Grand City Plaza!)
 */
export function createPlazaFountain(fountains: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const marbleLight = new THREE.MeshLambertMaterial({ color: 0xf1ece1 });
  const marbleTrim = new THREE.MeshLambertMaterial({ color: 0xd8cfc0 });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xfcc419, emissive: 0x5c4300 });
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x3bc9db,
    emissive: 0x1098ad,
    transparent: true,
    opacity: 0.88,
  });
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xe3fafc,
    transparent: true,
    opacity: 0.85,
  });

  // Stepped octagonal outer stone coping & seating rim
  const stepBase = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.0, 0.36, 8), marbleTrim);
  stepBase.position.y = 0.18;
  stepBase.receiveShadow = true;
  const basinWall = new THREE.Mesh(new THREE.CylinderGeometry(4.95, 5.2, 0.82, 8), marbleLight);
  basinWall.position.y = 0.72;
  const poolWater = new THREE.Mesh(new THREE.CylinderGeometry(4.45, 4.45, 0.14, 16), waterMat);
  poolWater.position.y = 1.08;
  g.add(stepBase, basinWall, poolWater);

  // Sculpted central pedestal + mid tier scalloped bowl + upper golden finial
  const lowerPed = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, 1.9, 8), marbleLight);
  lowerPed.position.y = 1.95;
  const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 1.15, 0.58, 8), marbleTrim);
  midBowl.position.y = 3.05;
  const midWater = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.12, 12), waterMat);
  midWater.position.y = 3.36;
  const upperPed = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.85, 1.65, 8), marbleLight);
  upperPed.position.y = 4.15;
  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.52, 0.42, 8), marbleTrim);
  topBowl.position.y = 5.05;
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), goldMat);
  finial.position.y = 5.65;
  g.add(lowerPed, midBowl, midWater, upperPed, topBowl, finial);

  // Delicate animated sparkling water jets rising directly from the upper bowl + 4 graceful cascading arcs!
  const jetGroup = new THREE.Group();
  const innerSpray = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.34, 0.95, 8), foamMat);
  innerSpray.position.y = 5.42;
  jetGroup.add(innerSpray);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const droplet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), foamMat);
    droplet.position.set(Math.cos(a) * 0.48, 5.75 + (i % 2) * 0.25, Math.sin(a) * 0.48);
    jetGroup.add(droplet);
  }
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.11, 6, 12, Math.PI * 0.65), foamMat);
    arc.position.set(Math.cos(ang) * 1.45, 2.15, Math.sin(ang) * 1.45);
    arc.rotation.y = -ang;
    arc.rotation.z = -0.3;
    jetGroup.add(arc);
  }
  g.add(jetGroup);
  fountains.push(jetGroup);

  return g;
}
