import * as THREE from 'three';
import {
  BRIDGE_DECK_Y_3D,
  MOUNTAIN_TUNNEL_TRIGGER_Y,
  WATER_LEVEL_3D,
  WORLD_RAIL_SEGMENTS_3D,
  WORLD_ROAD_SEGMENTS_3D,
} from '../data/survivorsTactics';
import type { TownStreetSeg } from '../utils/townStreetGen';
import {
  mountGlbModel,
  STREET_LAMP_HALO_MAT,
} from './townAssetLoader';
import { getGroundTex, makePixelTex } from './townGroundTextures';
import { makeObbCollider, type TownCollider } from './townTypes';
import { mountVoxModel } from './voxLoader3D';

/**
 * Builds a sleek, modern, low-parapet architectural river bridge (`现代低护栏景观跨江大桥`):
 * - Replaces ugly 16m black pylon/cable cages completely!
 * - Clean stone/concrete river piers + sculpted low architectural parapets (`1.05u` tall) + warm avenue streetlights.
 */
export function buildModernCityBridge3D(opts: {
  seg: TownStreetSeg;
  centerX: number;
  centerZ: number;
  baseY: number;
  group: THREE.Group;
  colliders: TownCollider[];
  deckRoadTex: THREE.CanvasTexture;
  getGroundHeight: (x: number, z: number) => number;
}): void {
  const { seg, centerX, centerZ, baseY, group, colliders, deckRoadTex, getGroundHeight } = opts;
  const bLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const bMidX = (seg.x1 + seg.x2) * 0.5 - centerX;
  const bMidZ = (seg.z1 + seg.z2) * 0.5 - centerZ;
  const bYaw = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const endH = Math.max(getGroundHeight(seg.x1, seg.z1), getGroundHeight(seg.x2, seg.z2));
  const deckY = Math.max(WATER_LEVEL_3D + 0.9, baseY + 0.24, endH + 0.16) - baseY;

  // Sleek chamfered concrete girder & asphalt deck flush with onshore avenues
  const girderMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
  const parapetMat = new THREE.MeshLambertMaterial({
    color: seg.bridgeStyle === 'waibaidu' ? 0x64748b : 0xe2e8f0,
  });
  const capRailMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });

  const girderMesh = new THREE.Mesh(new THREE.BoxGeometry(seg.width + 0.4, 0.52, bLen + 4.2), girderMat);
  girderMesh.position.set(bMidX, deckY - 0.26, bMidZ);
  girderMesh.rotation.y = bYaw;
  girderMesh.castShadow = true;
  girderMesh.receiveShadow = true;
  group.add(girderMesh);

  const deckTex = deckRoadTex.clone();
  deckTex.center.set(0.5, 0.5);
  deckTex.rotation = Math.PI / 2;
  deckTex.repeat.set(Math.max(1, Math.round(bLen / 14)), 1);
  deckTex.wrapS = THREE.RepeatWrapping;
  deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.needsUpdate = true;
  const deckMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(seg.width, bLen + 4.0),
    new THREE.MeshLambertMaterial({
      map: deckTex,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
  );
  deckMesh.rotation.order = 'YXZ';
  deckMesh.rotation.y = bYaw;
  deckMesh.rotation.x = -Math.PI / 2;
  deckMesh.position.set(bMidX, deckY + 0.02, bMidZ);
  deckMesh.receiveShadow = true;
  group.add(deckMesh);

  const bDirX = (seg.x2 - seg.x1) / Math.max(0.01, bLen);
  const bDirZ = (seg.z2 - seg.z1) / Math.max(0.01, bLen);
  const bNx = -bDirZ;
  const bNz = bDirX;
  // Inset parapets to 80% of span so onshore road intersections stay 100% open & unobstructed
  const railSpan = Math.max(6, bLen * 0.80);

  for (const side of [-1, 1]) {
    const rx = bMidX + bNx * side * (seg.width * 0.48);
    const rz = bMidZ + bNz * side * (seg.width * 0.48);
    colliders.push(makeObbCollider(centerX + rx, centerZ + rz, 0.45, railSpan * 0.5, bYaw, 2.4));

    // Low 1.05m sculpted stone/steel parapet wall + sleek dark handrail cap (completely open sky view!)
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.92, railSpan), parapetMat);
    parapet.position.set(rx, deckY + 0.46, rz);
    parapet.rotation.y = bYaw;
    parapet.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, railSpan + 0.2), capRailMat);
    cap.position.set(rx, deckY + 0.98, rz);
    cap.rotation.y = bYaw;
    group.add(parapet, cap);

    // Stepped voxel river piers underneath the bridge deck + MagicaVoxel `.vox` promenade lamp posts!
    for (const frac of [-0.28, 0, 0.28]) {
      const px = rx + bDirX * (railSpan * frac);
      const pz = rz + bDirZ * (railSpan * frac);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.35, 5.4, 1.35), pierMat);
      pier.position.set(px * 0.92 + bMidX * 0.08, deckY - 3.1, pz * 0.92 + bMidZ * 0.08);
      pier.rotation.y = bYaw;
      group.add(pier);

      void mountVoxModel(group, '/models/vox/obj_stlight2.vox', {
        x: px,
        y: deckY + 0.95,
        z: pz,
        rotY: bYaw + (side > 0 ? Math.PI : 0),
        targetHeight: 4.4,
        emitMode: 'lamp',
      });
      const halo = new THREE.Sprite(STREET_LAMP_HALO_MAT);
      halo.scale.set(3.2, 3.2, 1);
      halo.position.set(px, deckY + 4.9, pz);
      group.add(halo);
    }
  }
}

/**
 * Builds the Suburban High-Speed Rail Hub Terminal (`城郊高铁站枢纽`, e.g. Shanghai Hongqiao HSR Station):
 * - Sleek silver-and-glass wave canopy, elevated stone passenger platform, illuminated `高铁站` sign,
 *   suburban railway tracks, and CRH bullet express train!
 */
export function buildSuburbanHsrStation3D(opts: {
  group: THREE.Group;
  rail: { x1: number; z1: number; x2: number; z2: number }[];
  stationX: number;
  stationZ: number;
  stationRotY: number;
  centerX: number;
  centerZ: number;
  townName: string;
  localGroundY: (wx: number, wz: number) => number;
}): THREE.Group {
  const { group, rail, stationX, stationZ, stationRotY, centerX, centerZ, townName, localGroundY } = opts;

  for (const rl of rail) {
    const segLen = Math.hypot(rl.x2 - rl.x1, rl.z2 - rl.z1);
    const angle = Math.atan2(rl.z2 - rl.z1, rl.x2 - rl.x1);
    const steps = Math.max(2, Math.round(segLen / 6));
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const wx = rl.x1 + (rl.x2 - rl.x1) * t;
      const wz = rl.z1 + (rl.z2 - rl.z1) * t;
      void mountGlbModel(group, '/models/town/train/rail-straight.glb', {
        x: wx - centerX,
        y: localGroundY(wx, wz) + 0.04,
        z: wz - centerZ,
        rotY: -angle + Math.PI / 2,
        targetWidth: 6.4,
      });
    }
  }

  // Suburban HSR Passenger Platform & Modern Silver-Glass Terminal Canopy
  const stBaseY = localGroundY(stationX, stationZ);
  const hubGroup = new THREE.Group();
  hubGroup.position.set(stationX - centerX, stBaseY, stationZ - centerZ);
  hubGroup.rotation.y = stationRotY;

  const platMat = new THREE.MeshLambertMaterial({ color: 0xdbe2ec });
  const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfcc419 });
  const silverRoofMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
  const glassCanopyMat = new THREE.MeshLambertMaterial({
    color: 0x74c0fc,
    transparent: true,
    opacity: 0.78,
  });
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x475569 });

  const platform = new THREE.Mesh(new THREE.BoxGeometry(28, 0.65, 6.2), platMat);
  platform.position.set(0, 0.32, 5.4);
  platform.receiveShadow = true;
  const safetyLine = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.04, 0.28), yellowLineMat);
  safetyLine.position.set(0, 0.66, 2.75);
  hubGroup.add(platform, safetyLine);

  for (const px of [-9.5, 0, 9.5]) {
    const colBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), pillarMat);
    colBase.position.set(px, 0.75, 6.2);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.68, 6.2, 0.68), pillarMat);
    col.position.set(px, 3.4, 6.2);
    hubGroup.add(colBase, col);
  }
  const canopyMain = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 11.5), silverRoofMat);
  canopyMain.position.set(0, 6.5, 3.8);
  canopyMain.castShadow = true;
  const skylight = new THREE.Mesh(new THREE.BoxGeometry(22, 0.62, 4.4), glassCanopyMat);
  skylight.position.set(0, 6.55, 3.8);
  hubGroup.add(canopyMain, skylight);

  const signTex = makePixelTex(128, 32, (ctx) => {
    ctx.fillStyle = '#183153';
    ctx.fillRect(0, 0, 128, 32);
    ctx.strokeStyle = '#74c0fc';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 29);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🚄 ${townName.replace(/市$/, '')}虹桥高铁站`, 64, 16);
  });
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 2.4, 0.45),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  signBoard.position.set(0, 8.0, 8.8);
  hubGroup.add(signBoard);
  group.add(hubGroup);

  // Express MagicaVoxel High-Speed Train (`veh_train.vox`) on the Suburban HSR Track!
  const trainGroup = new THREE.Group();
  trainGroup.position.set(stationX - centerX, stBaseY + 0.22, stationZ - centerZ);
  trainGroup.rotation.y = stationRotY;
  void mountVoxModel(trainGroup, '/models/vox/veh_train.vox', {
    x: 6.2,
    y: 0,
    z: 0,
    rotY: Math.PI / 2,
    targetSpan: 11.6,
    emitMode: 'vehicle',
  });
  void mountVoxModel(trainGroup, '/models/vox/veh_train.vox', {
    x: -6.2,
    y: 0,
    z: 0,
    rotY: -Math.PI / 2,
    targetSpan: 11.6,
    emitMode: 'vehicle',
  });
  group.add(trainGroup);
  return trainGroup;
}

/** Crowned street ribbon mesh that samples 7 cross-sectional points so rolling terrain never pokes through roads */
export function buildStreetRibbonMesh(
  seg: TownStreetSeg,
  baseY: number,
  originX: number,
  originZ: number,
  tex: THREE.CanvasTexture,
  getGroundHeight: (x: number, z: number) => number,
  layerLiftY = 0.14,
  polyOffsetFactor = -1,
): THREE.Mesh {
  const dist = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const steps = Math.max(5, Math.ceil(dist / 2.6));
  const dirX = (seg.x2 - seg.x1) / Math.max(0.01, dist);
  const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, dist);
  const wStart = seg.widthStart ?? seg.width;
  const wEnd = seg.widthEnd ?? seg.width;
  const endPad = Math.min(0.85, Math.max(wStart, wEnd) * 0.035);
  const sx1 = seg.x1 - dirX * endPad;
  const sz1 = seg.z1 - dirZ * endPad;
  const sx2 = seg.x2 + dirX * endPad;
  const sz2 = seg.z2 + dirZ * endPad;
  const paddedDist = dist + endPad * 2;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const sampleFracs = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const curHalfW = (wStart + (wEnd - wStart) * t) * 0.5;
    const perpX = -dirZ * curHalfW;
    const perpZ = dirX * curHalfW;
    const wx = sx1 + (sx2 - sx1) * t;
    const wz = sz1 + (sz2 - sz1) * t;
    const lx = wx - perpX;
    const lz = wz - perpZ;
    const rx = wx + perpX;
    const rz = wz + perpZ;

    const hCenter = getGroundHeight(wx, wz);
    let maxLeftH = WATER_LEVEL_3D + 0.12;
    let maxRightH = WATER_LEVEL_3D + 0.12;
    for (let fi = 0; fi < sampleFracs.length; fi++) {
      const frac = sampleFracs[fi];
      const h = getGroundHeight(wx + perpX * frac, wz + perpZ * frac);
      if (frac <= 0 && h > maxLeftH) maxLeftH = h;
      if (frac >= 0 && h > maxRightH) maxRightH = h;
    }
    const edgeLY = Math.max(WATER_LEVEL_3D + 0.22, Math.max(maxLeftH, hCenter - 0.16) + layerLiftY + 0.08) - baseY;
    const edgeRY = Math.max(WATER_LEVEL_3D + 0.22, Math.max(maxRightH, hCenter - 0.16) + layerLiftY + 0.08) - baseY;
    const crownY = Math.max(edgeLY, edgeRY) + 0.035;

    positions.push(
      lx - originX, edgeLY - 2.4, lz - originZ,
      lx - originX, edgeLY, lz - originZ,
      wx - originX, crownY, wz - originZ,
      rx - originX, edgeRY, rz - originZ,
      rx - originX, edgeRY - 2.4, rz - originZ,
    );
    const u = (t * paddedDist) / (seg.kind === 'arterial' ? 16.5 : 10.5);
    uvs.push(u, 0, u, 0, u, 0.5, u, 1, u, 1);
    if (s < steps) {
      const i0 = s * 5;
      const n0 = (s + 1) * 5;
      indices.push(i0, n0, i0 + 1, i0 + 1, n0, n0 + 1);
      indices.push(i0 + 1, n0 + 1, i0 + 2, i0 + 2, n0 + 1, n0 + 2);
      indices.push(i0 + 2, n0 + 2, i0 + 3, i0 + 3, n0 + 2, n0 + 3);
      indices.push(i0 + 3, n0 + 3, i0 + 4, i0 + 4, n0 + 3, n0 + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({
      map: tex,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: polyOffsetFactor,
      polygonOffsetUnits: polyOffsetFactor,
    }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

/** Terrain-adaptive Inter-Town Highway, Tunnel & High-Speed Rail Corridor Network */
export function buildInterTownRoadNetwork3D(
  getGroundHeight: (x: number, z: number) => number,
  getRawHeight?: (x: number, z: number) => number,
): THREE.Group {
  const tex = getGroundTex();
  const group = new THREE.Group();
  const roadW = 22.0;

  const railStoneMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
  const pierStoneMat = new THREE.MeshLambertMaterial({ color: 0x7c8594 });
  const tunnelStoneMat = new THREE.MeshLambertMaterial({ color: 0x565c69, side: THREE.DoubleSide });
  const tunnelPortalMat = new THREE.MeshLambertMaterial({ color: 0x7a7f8c });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

  for (const [ax, az, bx, bz] of WORLD_ROAD_SEGMENTS_3D) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(10, Math.ceil(dist / 3.5));
    const stepLen = dist / steps;
    const dirX = (bx - ax) / dist;
    const dirZ = (bz - az) / dist;
    const headingYaw = Math.atan2(dirX, dirZ);
    const perpX = -dirZ * (roadW * 0.5);
    const perpZ = dirX * (roadW * 0.5);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let prevWasTunnel = false;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      const lx = cx - perpX;
      const lz = cz - perpZ;
      const rx = cx + perpX;
      const rz = cz + perpZ;
      const rawCenter = (getRawHeight ?? getGroundHeight)(cx, cz);
      const groundL = getGroundHeight(lx, lz);
      const groundR = getGroundHeight(rx, rz);
      const groundC = getGroundHeight(cx, cz);

      const isBridge = groundC < WATER_LEVEL_3D + 0.18;
      const isTunnel = rawCenter > MOUNTAIN_TUNNEL_TRIGGER_Y;
      const surfaceY = isBridge ? BRIDGE_DECK_Y_3D : Math.max(WATER_LEVEL_3D + 0.25, groundC + 0.11);
      const yL = isBridge ? surfaceY : Math.max(WATER_LEVEL_3D + 0.25, groundL + 0.11);
      const yR = isBridge ? surfaceY : Math.max(WATER_LEVEL_3D + 0.25, groundR + 0.11);

      positions.push(lx, yL - 1.5, lz, lx, yL, lz, rx, yR, rz, rx, yR - 1.5, rz);
      const u = (t * dist) / 10.5;
      uvs.push(u, 0, u, 0, u, 1, u, 1);

      if (s < steps) {
        const i0 = s * 4;
        const n0 = (s + 1) * 4;
        indices.push(i0, n0, i0 + 1, i0 + 1, n0, n0 + 1);
        indices.push(i0 + 1, n0 + 1, i0 + 2, i0 + 2, n0 + 1, n0 + 2);
        indices.push(i0 + 2, n0 + 2, i0 + 3, i0 + 3, n0 + 2, n0 + 3);
      }

      if (isBridge && s < steps) {
        const mx = cx + dirX * stepLen * 0.5;
        const mz = cz + dirZ * stepLen * 0.5;
        for (const side of [-1, 1]) {
          const rxOff = -dirZ * side * (roadW * 0.5 + 0.08);
          const rzOff = dirX * side * (roadW * 0.5 + 0.08);
          const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, stepLen + 0.25), railStoneMat);
          parapet.position.set(mx + rxOff, BRIDGE_DECK_Y_3D + 0.42, mz + rzOff);
          parapet.rotation.y = headingYaw;
          group.add(parapet);

          if (s % 3 === 0) {
            const pierH = Math.max(2.2, BRIDGE_DECK_Y_3D - groundC + 1.2);
            const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, pierH, 8), pierStoneMat);
            pier.position.set(cx + rxOff * 0.85, BRIDGE_DECK_Y_3D - pierH * 0.5 - 0.15, cz + rzOff * 0.85);
            const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), lampGlowMat);
            lantern.position.set(cx + rxOff, BRIDGE_DECK_Y_3D + 1.15, cz + rzOff);
            group.add(pier, lantern);
          }
        }
      }

      if (isTunnel && s < steps) {
        const mx = cx + dirX * stepLen * 0.5;
        const mz = cz + dirZ * stepLen * 0.5;
        const archRadius = roadW * 0.66;
        const archGeo = new THREE.CylinderGeometry(archRadius, archRadius, stepLen + 0.5, 10, 1, true, 0, Math.PI);
        archGeo.rotateZ(Math.PI / 2);
        archGeo.rotateY(Math.PI / 2);
        const vault = new THREE.Mesh(archGeo, tunnelStoneMat);
        vault.position.set(mx, surfaceY + 0.4, mz);
        vault.rotation.y = headingYaw;
        group.add(vault);

        if (!prevWasTunnel || s % 3 === 0) {
          const ringGeo = new THREE.TorusGeometry(archRadius + 0.18, !prevWasTunnel ? 0.65 : 0.35, 6, 12, Math.PI);
          const ring = new THREE.Mesh(ringGeo, tunnelPortalMat);
          ring.position.set(cx, surfaceY + 0.4, cz);
          ring.rotation.y = headingYaw;
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), lampGlowMat);
          lamp.position.set(mx, surfaceY + archRadius - 0.15, mz);
          group.add(ring, lamp);
        }
      }
      prevWasTunnel = isTunnel;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex.collector2Lane, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Inter-City High-Speed Rail Corridors (connecting outer suburban HSR hubs, never downtown!)
  const railTrackTex = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#737985';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#5b4b3e';
      for (let x = 2; x < 32; x += 8) ctx.fillRect(x, 4, 3, 24);
      ctx.fillStyle = '#dee2e6';
      ctx.fillRect(0, 7, 32, 2);
      ctx.fillRect(0, 14, 32, 2);
      ctx.fillRect(0, 18, 32, 2);
      ctx.fillRect(0, 25, 32, 2);
    },
    1,
    1,
  );
  const railMat = new THREE.MeshLambertMaterial({ map: railTrackTex, side: THREE.DoubleSide });
  const railW = 7.4;

  for (const [ax, az, bx, bz] of WORLD_RAIL_SEGMENTS_3D) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(12, Math.ceil(dist / 6.0));
    const dirX = (bx - ax) / dist;
    const dirZ = (bz - az) / dist;
    const perpX = -dirZ * (railW * 0.5);
    const perpZ = dirX * (railW * 0.5);
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      const gC = getGroundHeight(cx, cz);
      const isViaduct = gC < WATER_LEVEL_3D + 0.35;
      const sy = isViaduct ? BRIDGE_DECK_Y_3D + 0.45 : Math.max(WATER_LEVEL_3D + 0.3, gC + 0.16);
      positions.push(cx - perpX, sy, cz - perpZ, cx + perpX, sy, cz + perpZ);
      const u = (t * dist) / 7.0;
      uvs.push(u, 0, u, 1);
      if (s < steps) {
        const i0 = s * 2;
        indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
      if (isViaduct && s % 2 === 0) {
        const pierH = Math.max(2.6, sy - gC + 1.2);
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, pierH, 8), pierStoneMat);
        pier.position.set(cx, sy - pierH * 0.5 - 0.1, cz);
        group.add(pier);
      }
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    rGeo.setIndex(indices);
    rGeo.computeVertexNormals();
    const rMesh = new THREE.Mesh(rGeo, railMat);
    rMesh.receiveShadow = true;
    group.add(rMesh);
  }

  return group;
}
