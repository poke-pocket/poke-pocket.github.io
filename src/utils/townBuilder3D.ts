import * as THREE from 'three';
import {
  WATER_LEVEL_3D,
  WORLD_TOWNS_3D,
  type WalkableStairAndFloorZone3D,
} from '../data/survivorsTactics';
import { getBiomeTextures, getNpcWalkSpriteFrames } from '../data/worldTextures3D';
import {
  buildCleanUrbanApartment3D,
  buildModernCbdOfficeTower3D,
} from '../world3d/cbdCurtainWall3D';
import {
  buildInterTownRoadNetwork3D,
  buildModernCityBridge3D,
  buildStreetRibbonMesh,
  buildSuburbanHsrStation3D,
} from '../world3d/interTownNetwork3D';
import {
  BUILDING_ENTRANCE_POOL_MAT,
  createNpcBillboard,
  mountGlbModel,
  setBuildingExteriorOpacity,
  setGlobalNightLampGlow3D,
  STREET_LAMP_BULB_MAT,
  STREET_LAMP_HALO_MAT,
  STREET_LAMP_POOL_MAT,
} from '../world3d/townAssetLoader';
import { getGroundTex, makePixelTex } from '../world3d/townGroundTextures';
import {
  computeCameraWallClipT,
  isInsideBuildingInterior,
  makeObbCollider,
  resolveTownWallCollisions,
  type EnterableBuildingInterior,
  type ProceduralTownInstance,
  type ProximityAutoDoor3D,
  type TownCollider,
  type TownInteractKind,
  type TownInteractPoint,
  type TownMovingVehicle,
  type TownStrollingCitizen,
  type ViaductOverheadSpan,
} from '../world3d/townTypes';
import { addVoxelBox } from '../world3d/voxelProps3D';
import {
  buildWorldLandmark3D,
  createPlazaFountain,
  createPokeballBeacon,
} from '../world3d/worldLandmarks3D';
import { buildUnifiedWalkInBuilding3D } from './architecturalBuildings3D';
import { generateTownLayout, type TownStreetSeg } from './townStreetGen';

export {
  buildInterTownRoadNetwork3D,
  buildWorldLandmark3D,
  computeCameraWallClipT,
  createPokeballBeacon,
  isInsideBuildingInterior,
  resolveTownWallCollisions,
  setBuildingExteriorOpacity,
  setGlobalNightLampGlow3D,
  type EnterableBuildingInterior,
  type ProceduralTownInstance,
  type TownCollider,
  type TownInteractKind,
  type TownInteractPoint,
  type TownMovingVehicle,
  type TownStrollingCitizen,
  type ViaductOverheadSpan,
};

/**
 * Assembles a Real-World Metropolitan / Organic MagicaVoxel 3D City:
 * - Multi-lane boulevards, sleek low-parapet bridges (zero overlapping or clunky overhead cages), and lush parks
 * - MagicaVoxel Modern All-Glass Curtain-Wall CBD Office Towers (with discrete lit office floors & rooftop/corner LED strips)
 * - MagicaVoxel Urban Residential Apartments (with 3D recessed windows, balconies, rooftop water tanks & warm household windows)
 * - Walk-In RSE Voxel Pokémon Center, Poké Mart, Enclosed-Kitchen Restaurant, Grand Hotel & Duplex Villa
 * - Suburban High-Speed Rail Hub Station (`城郊高铁站枢纽`) outside downtown connected via Metro!
 */
export function buildProceduralTown3D(
  id: string,
  centerX: number,
  centerZ: number,
  seed: number,
  getGroundHeight: (x: number, z: number) => number,
  customName?: string,
  plazaRadius = 54,
  landmarkCityId?: string,
): ProceduralTownInstance {
  const tex = getGroundTex();
  const group = new THREE.Group();
  const baseY = getGroundHeight(centerX, centerZ);
  group.position.set(centerX, baseY, centerZ);

  const anchor = WORLD_TOWNS_3D.find((t) => t.id === id) ?? {
    id,
    name: customName ?? '上海市',
    x: centerX,
    z: centerZ,
    seed,
    plazaRadius,
    plateauY: baseY,
    landmarkCityId,
  };
  const layout = generateTownLayout(anchor);
  const townName = layout.townName;
  const styleIdx = Math.abs(seed) % 4;

  const spinners: THREE.Object3D[] = [];
  const fountains: THREE.Object3D[] = [];
  const billboards: THREE.Mesh[] = [];
  const vehicles: TownMovingVehicle[] = [];
  const walkers: TownStrollingCitizen[] = [];
  const interiors: EnterableBuildingInterior[] = [];
  const autoDoors: ProximityAutoDoor3D[] = [];
  const upperFloorZones: WalkableStairAndFloorZone3D[] = [];
  const viaductSpans: ViaductOverheadSpan[] = [];
  const interactPoints: TownInteractPoint[] = [];
  const colliders: TownCollider[] = [];

  const localGroundY = (wx: number, wz: number) => getGroundHeight(wx, wz) - baseY;
  const floraTex = getBiomeTextures('verdant_forest');

  const spawnPixelGreenery = (
    texMap: THREE.Texture,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(0, h * 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({
      map: texMap,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.order = 'YXZ';
    m.position.set(x, y, z);
    group.add(m);
    billboards.push(m);
  };

  const distToSeg2D = (px: number, pz: number, x1: number, z1: number, x2: number, z2: number) => {
    const vx = x2 - x1;
    const vz = z2 - z1;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 0.001) return Math.hypot(px - x1, pz - z1);
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / lenSq));
    return Math.hypot(px - (x1 + t * vx), pz - (z1 + t * vz));
  };

  const isBlockedForGreenery = (wx: number, wz: number, skipSeg: TownStreetSeg) => {
    if (getGroundHeight(wx, wz) < WATER_LEVEL_3D + 0.35) return true;
    for (const other of layout.streets) {
      if (other === skipSeg) continue;
      if (distToSeg2D(wx, wz, other.x1, other.z1, other.x2, other.z2) < other.width * 0.5 + 1.6) {
        return true;
      }
    }
    return false;
  };

  // ==================== 1. STREETS, SLEEK MODERN BRIDGES & BOULEVARD GREENERY ====================
  for (let segIdx = 0; segIdx < layout.streets.length; segIdx++) {
    const seg = layout.streets[segIdx];
    if (seg.isBridge) {
      buildModernCityBridge3D({
        seg,
        centerX,
        centerZ,
        baseY,
        group,
        colliders,
        deckRoadTex: tex.collector2Lane,
      });
      continue;
    }

    const segMidDist = Math.hypot((seg.x1 + seg.x2) * 0.5 - centerX, (seg.z1 + seg.z2) * 0.5 - centerZ);
    if (segMidDist > 720) continue;

    const roadTex =
      seg.kind === 'arterial'
        ? tex.boulevard4Lane
        : seg.kind === 'street'
          ? tex.collector2Lane
          : tex.alleyCobble;
    const microStagger = (segIdx % 11) * 0.003;
    const liftY = (seg.kind === 'arterial' ? 0.098 : seg.kind === 'street' ? 0.072 : 0.045) + microStagger;
    const polyOff = seg.kind === 'arterial' ? -3 : seg.kind === 'street' ? -2 : -1;
    group.add(buildStreetRibbonMesh(seg, baseY, centerX, centerZ, roadTex, getGroundHeight, liftY, polyOff));

    if (segMidDist > 340) continue;

    const segLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    const dirX = (seg.x2 - seg.x1) / Math.max(0.01, segLen);
    const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, segLen);
    const nx = -dirZ;
    const nz = dirX;
    const isNearAnyJunction = (wx: number, wz: number, rad = 20) =>
      layout.junctions.some((jn) => Math.hypot(jn.x - wx, jn.z - wz) < rad);
    const pickDetailedShrubTex = (idx: number) =>
      idx % 4 === 3
        ? floraTex.flowers[idx % floraTex.flowers.length] ?? floraTex.flower
        : floraTex.bushes[idx % floraTex.bushes.length] ?? floraTex.bush;

    if (seg.kind === 'arterial' && segLen >= 18) {
      const medianSteps = Math.max(2, Math.floor((segLen - 4) / 7.5));
      for (let mi = 0; mi < medianSteps; mi++) {
        const f = 0.08 + (medianSteps > 1 ? (mi / (medianSteps - 1)) * 0.84 : 0.42);
        const mx = seg.x1 + dirX * (segLen * f);
        const mz = seg.z1 + dirZ * (segLen * f);
        if (isNearAnyJunction(mx, mz, 18) || isBlockedForGreenery(mx, mz, seg)) continue;
        const my = localGroundY(mx, mz) + 0.16;
        if (mi % 2 === 1) {
          const treeTex = floraTex.treeSprites[(mi + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
          spawnPixelGreenery(treeTex, mx - centerX, my, mz - centerZ, 5.2, 6.2);
        } else {
          spawnPixelGreenery(pickDetailedShrubTex(mi + segIdx + styleIdx), mx - centerX, my, mz - centerZ, 2.25, 1.95);
        }
      }

      const vergeOff = seg.width * 0.5 - 3.9;
      const sideSteps = Math.max(2, Math.floor((segLen - 4) / 8.5));
      for (let si = 0; si < sideSteps; si++) {
        const f = 0.08 + (sideSteps > 1 ? (si / (sideSteps - 1)) * 0.84 : 0.42);
        const sx = seg.x1 + dirX * (segLen * f);
        const sz = seg.z1 + dirZ * (segLen * f);
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 19) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.16;
          if (si % 2 === 0) {
            const treeTex = floraTex.treeSprites[(si + styleIdx + (side > 0 ? 1 : 0)) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.9, 5.9);
          } else {
            spawnPixelGreenery(pickDetailedShrubTex(si + (side > 0 ? 2 : 0) + segIdx), tx - centerX, ty, tz - centerZ, 2.05, 1.8);
          }
        }
      }
    }

    if (seg.kind === 'street' && segLen >= 18) {
      const vergeOff = seg.width * 0.5 - 2.3;
      const stepCount = Math.max(2, Math.floor((segLen - 4) / 9.5));
      for (let ti = 0; ti < stepCount; ti++) {
        const tFrac = 0.1 + (stepCount > 1 ? (ti / (stepCount - 1)) * 0.8 : 0.4);
        const sx = seg.x1 + dirX * (segLen * tFrac);
        const sz = seg.z1 + dirZ * (segLen * tFrac);
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 15) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.16;
          if (ti % 2 === 0) {
            const treeTex = floraTex.treeSprites[(ti + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.5, 5.4);
          } else {
            spawnPixelGreenery(pickDetailedShrubTex(ti + (side > 0 ? 3 : 0) + segIdx), tx - centerX, ty, tz - centerZ, 1.85, 1.65);
          }
        }
      }
    }
  }

  // ==================== 1B. CIRCULAR ROAD INTERSECTION HUBS, CROSSWALKS & TRAFFIC SIGNALS ====================
  const hubAsphaltMat = new THREE.MeshLambertMaterial({
    color: 0x3b414c,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  const hubCurbMat = new THREE.MeshLambertMaterial({
    color: 0xaeb6c2,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const zebraStripeMat = new THREE.MeshLambertMaterial({
    color: 0xf1f5f9,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.18,
    polygonOffset: true,
    polygonOffsetFactor: -7,
    polygonOffsetUnits: -7,
  });
  const signalPoleMat = new THREE.MeshLambertMaterial({ color: 0x343a40 });
  const signalBoxMat = new THREE.MeshLambertMaterial({ color: 0x1b1f26 });
  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff4d4f });
  const redOffMat = new THREE.MeshBasicMaterial({ color: 0x38191b });
  const amberOffMat = new THREE.MeshBasicMaterial({ color: 0x362d16 });
  const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x51cf66 });
  const greenOffMat = new THREE.MeshBasicMaterial({ color: 0x17331e });

  interface RoadArmInfo {
    ux: number;
    uz: number;
    ang: number;
    width: number;
    isArterial: boolean;
  }
  const nodeMap = new Map<string, { x: number; z: number; arms: RoadArmInfo[] }>();
  for (const seg of layout.streets) {
    if (seg.isBridge) continue;
    if (Math.hypot(seg.x1 - centerX, seg.z1 - centerZ) > 420 && Math.hypot(seg.x2 - centerX, seg.z2 - centerZ) > 420) {
      continue;
    }
    const sLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    if (sLen < 2) continue;
    const addArm = (nx: number, nz: number, ox: number, oz: number) => {
      let target: { x: number; z: number; arms: RoadArmInfo[] } | undefined;
      for (const nd of nodeMap.values()) {
        if (Math.hypot(nd.x - nx, nd.z - nz) <= 7.0) {
          target = nd;
          break;
        }
      }
      if (!target) {
        target = { x: nx, z: nz, arms: [] };
        nodeMap.set(`${Math.round(nx)},${Math.round(nz)}`, target);
      }
      const dArm = Math.max(0.01, Math.hypot(ox - target.x, oz - target.z));
      const ux = (ox - target.x) / dArm;
      const uz = (oz - target.z) / dArm;
      if (!target.arms.some((a) => a.ux * ux + a.uz * uz > 0.94)) {
        target.arms.push({ ux, uz, ang: Math.atan2(ux, uz), width: seg.width, isArterial: seg.kind === 'arterial' });
      }
    };
    addArm(seg.x1, seg.z1, seg.x2, seg.z2);
    addArm(seg.x2, seg.z2, seg.x1, seg.z1);
  }

  let ji = 0;
  for (const nd of nodeMap.values()) {
    if (nd.arms.length < 2 || getGroundHeight(nd.x, nd.z) < WATER_LEVEL_3D + 0.2) continue;
    const maxW = Math.max(...nd.arms.map((a) => a.width));
    const hubY = Math.max(WATER_LEVEL_3D + 0.25 - baseY, localGroundY(nd.x, nd.z) + 0.14);

    const sidewalkHub = new THREE.Mesh(new THREE.CircleGeometry(maxW * 0.5 + 0.2, 22), hubCurbMat);
    sidewalkHub.rotation.x = -Math.PI / 2;
    sidewalkHub.position.set(nd.x - centerX, hubY - 0.015, nd.z - centerZ);
    sidewalkHub.receiveShadow = true;
    const roadHub = new THREE.Mesh(new THREE.CircleGeometry(maxW * 0.37, 22), hubAsphaltMat);
    roadHub.rotation.x = -Math.PI / 2;
    roadHub.position.set(nd.x - centerX, hubY + 0.01, nd.z - centerZ);
    roadHub.receiveShadow = true;
    group.add(sidewalkHub, roadHub);

    if (nd.arms.length >= 3) {
      nd.arms.sort((a, b) => a.ang - b.ang);
      for (let ai = 0; ai < nd.arms.length; ai++) {
        const arm = nd.arms[ai];
        const prevArm = nd.arms[(ai - 1 + nd.arms.length) % nd.arms.length];
        const nextArm = nd.arms[(ai + 1) % nd.arms.length];
        const diffPrev = Math.acos(Math.max(-1, Math.min(1, arm.ux * prevArm.ux + arm.uz * prevArm.uz)));
        const diffNext = Math.acos(Math.max(-1, Math.min(1, arm.ux * nextArm.ux + arm.uz * nextArm.uz)));
        if (diffPrev < 0.87 || diffNext < 0.87) continue;

        const cwDist = maxW * 0.42 + 2.8;
        const cwx = nd.x + arm.ux * cwDist;
        const cwz = nd.z + arm.uz * cwDist;
        if (getGroundHeight(cwx, cwz) < WATER_LEVEL_3D + 0.25) continue;
        const cwy = Math.max(hubY + 0.02, localGroundY(cwx, cwz) + 0.16);

        const cwGroup = new THREE.Group();
        cwGroup.position.set(cwx - centerX, cwy, cwz - centerZ);
        cwGroup.rotation.y = arm.ang;

        const carriagewayW = arm.width * 0.68;
        const stripeCount = Math.max(4, Math.floor(carriagewayW / 1.55));
        const spanW = carriagewayW * 0.88;
        for (let si = 0; si < stripeCount; si++) {
          const sx = -spanW * 0.5 + (stripeCount > 1 ? (si / (stripeCount - 1)) * spanW : 0);
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 2.55), zebraStripeMat);
          bar.rotation.x = -Math.PI / 2;
          bar.position.set(sx, 0, 0);
          cwGroup.add(bar);
        }
        const stopLine = new THREE.Mesh(new THREE.PlaneGeometry(carriagewayW * 0.9, 0.36), zebraStripeMat);
        stopLine.rotation.x = -Math.PI / 2;
        stopLine.position.set(0, 0, 2.05);
        cwGroup.add(stopLine);
        group.add(cwGroup);

        if (arm.isArterial && ai < 2) {
          const rNx = -arm.uz;
          const rNz = arm.ux;
          const sigX = cwx + rNx * (arm.width * 0.44);
          const sigZ = cwz + rNz * (arm.width * 0.44);
          const isGreenPhase = (ji + ai) % 2 === 0;
          const sig = new THREE.Group();
          sig.position.set(sigX - centerX, localGroundY(sigX, sigZ) + 0.14, sigZ - centerZ);
          sig.rotation.y = Math.atan2(-rNx, -rNz);
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.8, 6), signalPoleMat);
          pole.position.y = 2.9;
          const cantArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.2), signalPoleMat);
          cantArm.position.set(0, 5.6, 1.5);
          const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.35, 0.42), signalBoxMat);
          head.position.set(0, 5.2, 2.9);
          const rL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), isGreenPhase ? redOffMat : redLightMat);
          rL.position.set(0, 5.56, 3.12);
          const yL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), amberOffMat);
          yL.position.set(0, 5.2, 3.12);
          const gL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), isGreenPhase ? greenLightMat : greenOffMat);
          gL.position.set(0, 4.84, 3.12);
          sig.add(pole, cantArm, head, rL, yL, gL);
          group.add(sig);
        }
      }
      ji += 1;
    }
  }

  // ==================== 1C. URBAN PARKS & VOXEL PARK BENCHES ====================
  const parkBorderMat = new THREE.MeshLambertMaterial({ map: tex.cobblePlaza });
  const parkLawnMat = new THREE.MeshLambertMaterial({ color: 0x51b748 });
  const parkWalkMat = new THREE.MeshLambertMaterial({
    map: tex.cobblePlaza,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pondWaterMat = new THREE.MeshLambertMaterial({
    color: 0x339af0,
    emissive: 0x1864ab,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const benchWoodMat = new THREE.MeshLambertMaterial({ color: 0x9c6644 });

  for (const pk of layout.parks) {
    const px = pk.x - centerX;
    const pz = pk.z - centerZ;
    const py = localGroundY(pk.x, pk.z);

    const border = new THREE.Mesh(new THREE.PlaneGeometry(pk.w + 1.6, pk.d + 1.6), parkBorderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(px, py + 0.05, pz);
    border.receiveShadow = true;
    border.renderOrder = 1;

    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(pk.w, pk.d), parkLawnMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(px, py + 0.085, pz);
    lawn.receiveShadow = true;
    lawn.renderOrder = 2;

    const pathEW = new THREE.Mesh(new THREE.PlaneGeometry(pk.w - 0.4, 5.0), parkWalkMat);
    pathEW.rotation.x = -Math.PI / 2;
    pathEW.position.set(px, py + 0.125, pz);
    pathEW.receiveShadow = true;
    pathEW.renderOrder = 3;

    const pathNS = new THREE.Mesh(new THREE.PlaneGeometry(5.0, pk.d - 0.4), parkWalkMat);
    pathNS.rotation.x = -Math.PI / 2;
    pathNS.position.set(px, py + 0.13, pz);
    pathNS.receiveShadow = true;
    pathNS.renderOrder = 4;
    group.add(border, lawn, pathEW, pathNS);

    if (pk.hasFountain) {
      const plazaPad = new THREE.Mesh(new THREE.CircleGeometry(10.5, 24), parkWalkMat);
      plazaPad.rotation.x = -Math.PI / 2;
      plazaPad.position.set(px, py + 0.145, pz);
      plazaPad.receiveShadow = true;
      plazaPad.renderOrder = 5;
      group.add(plazaPad);
      const fountain = createPlazaFountain(fountains);
      fountain.position.set(px, py + 0.145, pz);
      group.add(fountain);
      colliders.push(makeObbCollider(pk.x, pk.z, 5.2, 5.2, 0, 6.5));
    } else if (pk.hasPond) {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(11.5, 20), pondWaterMat);
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(px, py + 0.145, pz);
      pond.renderOrder = 5;
      group.add(pond);
    }

    for (let qi = 0; qi < 4; qi++) {
      const sx = qi % 2 === 0 ? -1 : 1;
      const sz = qi < 2 ? -1 : 1;
      const bx = px + sx * (pk.w * 0.24);
      const bz = pz + sz * (pk.d * 0.24);
      const bench = new THREE.Group();
      bench.position.set(bx, py + 0.13, bz);
      bench.rotation.y = Math.atan2(-sx, -sz);
      // Ergonomic chibi-scaled voxel park bench (`seat = 0.50u`, `back = 0.96u`)
      addVoxelBox(bench, 3.0, 0.22, 0.9, benchWoodMat, 0, 0.28, 0);
      addVoxelBox(bench, 3.0, 0.48, 0.18, benchWoodMat, 0, 0.50, -0.36);
      group.add(bench);

      const tx = px + sx * (pk.w * 0.36);
      const tz = pz + sz * (pk.d * 0.34);
      const pTreeTex = floraTex.treeSprites[(qi + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
      spawnPixelGreenery(pTreeTex, tx, py + 0.14, tz, 6.4, 7.6);
      const flTex = floraTex.flowers[qi % floraTex.flowers.length] ?? floraTex.flower;
      spawnPixelGreenery(flTex, tx - sx * 2.2, py + 0.14, tz - sz * 1.4, 1.9, 1.7);
    }
  }

  // ==================== 2. MAGICAVOXEL WALK-IN SHOPS, CBD GLASS TOWERS & URBAN APARTMENTS ====================
  const registerWalkIn = (
    lot: (typeof layout.lots)[number],
    kind: EnterableBuildingInterior['kind'],
    name: string,
    floorTex: THREE.CanvasTexture,
    signTex?: THREE.CanvasTexture,
    withSpinner?: boolean,
  ) => {
    const lx = lot.x - centerX;
    const lz = lot.z - centerZ;
    const ly = localGroundY(lot.x, lot.z);
    const intId = `${lot.id}_int`;
    const built = buildUnifiedWalkInBuilding3D({
      kind,
      interiorId: intId,
      lotX: lot.x,
      lotZ: lot.z,
      localX: lx,
      localY: ly,
      localZ: lz,
      baseWorldY: baseY + ly,
      width: lot.width,
      depth: lot.depth,
      rotY: lot.rotY,
      signTex,
      floorTex,
      woodFloorTex: tex.woodFloor,
      onRegisterSpinner: withSpinner ? (obj) => spinners.push(obj) : undefined,
    });
    group.add(built.shellGroup);
    colliders.push(...built.colliders);
    autoDoors.push(...built.autoDoors);
    if (built.stairZone) upperFloorZones.push(built.stairZone);
    interiors.push({
      id: intId,
      name,
      kind,
      cx: lot.x,
      cz: lot.z,
      halfW: lot.width * 0.48,
      halfD: lot.depth * 0.48,
      rotY: lot.rotY,
      baseY: baseY + ly,
      stories: built.stories,
      floor1CeilingY: built.floor1CeilingY,
      floor2CeilingY: built.floor2CeilingY,
      dualDoors: built.dualDoors,
      bounds: {
        minX: lot.x - lot.width * 0.54,
        maxX: lot.x + lot.width * 0.54,
        minZ: lot.z - lot.depth * 0.54,
        maxZ: lot.z + lot.depth * 0.54,
      },
      exteriorGroup: built.shellGroup,
      interiorGroup: built.shellGroup,
      npcSprites: built.npcs,
      cutawayAlpha: 1,
    });
  };

  for (const lot of layout.lots) {
    const lx = lot.x - centerX;
    const lz = lot.z - centerZ;
    const ly = localGroundY(lot.x, lot.z);

    if (lot.kind === 'pokemon_center') {
      registerWalkIn(lot, 'pokemon_center', `${townName}·宝可梦中心`, tex.clinicFloor, undefined, true);
      interactPoints.push({
        id: `${id}_pc`,
        townName,
        kind: 'pokemon_center',
        label: `🏥 乔伊小姐 · 宝可梦中心`,
        hint: '全队免费治疗并补满伤药（可走楼梯上 2F 联机沙龙）',
        x: lot.x,
        z: lot.z,
        radius: 17.5,
      });
    } else if (lot.kind === 'poke_mart') {
      registerWalkIn(lot, 'poke_mart', `${townName}·友好百货商店`, tex.martFloor, tex.martSign);
      interactPoints.push({
        id: `${id}_mart`,
        townName,
        kind: 'poke_mart',
        label: `🏪 友好百货店员`,
        hint: '打开精品外观与树果补给商店',
        x: lot.x,
        z: lot.z,
        radius: 17.5,
      });
    } else if (lot.kind === 'hotel') {
      registerWalkIn(lot, 'hotel', `${townName}·驿站大酒店`, tex.woodFloor, tex.hotelSign);
      interactPoints.push({
        id: `${id}_hotel`,
        townName,
        kind: 'hotel_rest',
        label: `🏨 ${townName}·驿站大酒店 (1F大堂 / 2F客房)`,
        hint: '可上二楼豪华客房休整，全队体力回满并获攻击强化',
        x: lot.x,
        z: lot.z,
        radius: 19.0,
      });
    } else if (lot.kind === 'restaurant') {
      registerWalkIn(lot, 'restaurant', `${townName}·树果料理餐厅`, tex.woodFloor, tex.cafeSign);
      interactPoints.push({
        id: `${id}_cafe`,
        townName,
        kind: 'restaurant',
        label: `🍜 ${townName}·树果料理餐厅`,
        hint: '享用热腾腾的树果料理，提升全队斗志',
        x: lot.x,
        z: lot.z,
        radius: 17.0,
      });
    } else if (lot.kind === 'landmark' && anchor.landmarkCityId) {
      const lm = buildWorldLandmark3D(anchor.landmarkCityId);
      if (lm) {
        lm.position.set(lx, ly, lz);
        lm.scale.setScalar(1.58);
        group.add(lm);
        colliders.push(makeObbCollider(lot.x, lot.z, 11.2, 11.2, 0, 44));
      }
    } else if (lot.kind === 'house' && lot.walkable) {
      const aptIndex = interiors.filter((b) => b.kind === 'house').length + 1;
      registerWalkIn(lot, 'house', `${townName}·训练家复式公寓 ${aptIndex}号`, tex.woodFloor);
      const foyerWorldX = lot.x + Math.sin(lot.rotY) * (lot.depth * 0.16);
      const foyerWorldZ = lot.z + Math.cos(lot.rotY) * (lot.depth * 0.16);
      interactPoints.push({
        id: `${lot.id}_npc`,
        townName,
        kind: 'npc_chat',
        label: `💬 与公寓居民交谈`,
        hint: '打听城市地标与周边情报（可走楼梯上 2F 卧室与书房）',
        dialogText: `🏠 城市居民：「欢迎来${townName}训练家复式公寓 ${aptIndex}号做客！走左侧楼梯可以上二楼卧室与书房看看哦！」`,
        x: foyerWorldX,
        z: foyerWorldZ,
        radius: 9.5,
      });
    } else {
      // Non-walkable urban lots: Mix of Modern MagicaVoxel All-Glass Curtain-Wall CBD Office Towers (~52%)
      // and MagicaVoxel Urban Balcony Residential Apartments (~48%)!
      const hHash = Math.abs(anchor.seed * 19 + lot.houseVariant * 37 + Math.round(lot.x) * 7 + Math.round(lot.z) * 13);
      const distCenter = Math.hypot(lx, lz);
      const isCbdOffice =
        lot.kind === 'skyscraper' ||
        (lot.shape && lot.shape !== 'rect') ||
        (distCenter < 220 ? hHash % 10 < 6 : hHash % 10 < 4);

      const entPool = new THREE.Mesh(new THREE.PlaneGeometry(10.0, 8.0), BUILDING_ENTRANCE_POOL_MAT);
      entPool.rotation.x = -Math.PI / 2;
      entPool.position.set(
        lx + Math.sin(lot.rotY) * (lot.depth * 0.48),
        ly + 0.07,
        lz + Math.cos(lot.rotY) * (lot.depth * 0.48),
      );
      group.add(entPool);

      if (isCbdOffice) {
        const builtCbd = buildModernCbdOfficeTower3D({
          width: lot.width,
          depth: lot.depth,
          shape: lot.shape ?? 'rect',
          isSupertall: lot.kind === 'skyscraper',
          variant: hHash,
        });
        builtCbd.group.position.set(lx, ly, lz);
        builtCbd.group.rotation.y = lot.rotY;
        group.add(builtCbd.group);
        colliders.push(
          makeObbCollider(lot.x, lot.z, lot.width * 0.44, lot.depth * 0.43, lot.rotY, builtCbd.totalHeight),
        );
      } else {
        const builtApt = buildCleanUrbanApartment3D({
          width: lot.width,
          depth: lot.depth,
          variant: hHash,
        });
        builtApt.group.position.set(lx, ly, lz);
        builtApt.group.rotation.y = lot.rotY;
        if (hHash % 3 === 0) {
          const signTex = tex.extraSigns[hHash % tex.extraSigns.length];
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(8.2, 2.2, 0.45),
            new THREE.MeshBasicMaterial({ map: signTex }),
          );
          sign.position.set(0, 4.2, lot.depth * 0.44);
          builtApt.group.add(sign);
        }
        group.add(builtApt.group);
        colliders.push(
          makeObbCollider(lot.x, lot.z, lot.width * 0.43, lot.depth * 0.42, lot.rotY, builtApt.totalHeight),
        );
      }
    }
  }

  // ==================== 3. SUBURBAN HIGH-SPEED RAIL HUB TERMINAL & BULLET TRAIN ====================
  const trainGroup = buildSuburbanHsrStation3D({
    group,
    rail: layout.rail,
    stationX: layout.stationX,
    stationZ: layout.stationZ,
    stationRotY: layout.stationRotY,
    centerX,
    centerZ,
    townName,
    localGroundY,
  });

  // ==================== 4. CITY BUS STOP & NIGHT STREETLAMPS ====================
  void mountGlbModel(group, '/models/town/train/tram-modern.glb', {
    x: layout.busX - centerX,
    y: localGroundY(layout.busX, layout.busZ),
    z: layout.busZ - centerZ,
    rotY: layout.busRotY + Math.PI / 2,
    targetWidth: 9.4,
    addInkEdges: true,
  });

  const streetLampPositions: { x: number; y: number; z: number }[] = [];
  const lampPoolGeo = new THREE.PlaneGeometry(10.8, 10.8);
  lampPoolGeo.rotateX(-Math.PI / 2);
  for (const lamp of layout.streetLamps) {
    const lampBaseLocalY = localGroundY(lamp.x, lamp.z);
    streetLampPositions.push({ x: lamp.x, y: baseY + lampBaseLocalY + 5.8, z: lamp.z });

    const pool = new THREE.Mesh(lampPoolGeo, STREET_LAMP_POOL_MAT);
    pool.position.set(
      lamp.x - centerX + Math.sin(lamp.rotY) * 1.4,
      lampBaseLocalY + 0.08,
      lamp.z - centerZ + Math.cos(lamp.rotY) * 1.4,
    );
    group.add(pool);

    void mountGlbModel(group, '/models/town/roads/lamp-curved.glb', {
      x: lamp.x - centerX,
      y: lampBaseLocalY,
      z: lamp.z - centerZ,
      rotY: lamp.rotY,
      targetWidth: 3.4,
      heightMult: 1.36,
      addInkEdges: true,
      onMounted: (wrapper, h) => {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), STREET_LAMP_BULB_MAT);
        bulb.position.set(0, h * 0.92, 0.96);
        const halo = new THREE.Sprite(STREET_LAMP_HALO_MAT);
        halo.scale.set(4.2, 4.2, 1);
        halo.position.copy(bulb.position);
        wrapper.add(bulb, halo);
      },
    });
  }

  // ==================== 5. LIVE TRAFFIC TAXIS & UPRIGHT GBA CITIZENS ====================
  const carColors = [0x3bc9db, 0xffd43b, 0xfa5252, 0xf8f9fa, 0x339af0, 0x51cf66];
  const carConfigs: { axis: 'x' | 'z'; laneOffset: number; dir: 1 | -1; minC: number; maxC: number; start: number; spd: number }[] = [];
  const isRouteDryLand = (axis: 'x' | 'z', laneOff: number, minC: number, maxC: number) => {
    for (let k = 0; k <= 4; k++) {
      const c = minC + ((maxC - minC) * k) / 4;
      const wx = axis === 'x' ? centerX + c : centerX + laneOff;
      const wz = axis === 'z' ? centerZ + c : centerZ + laneOff;
      if (getGroundHeight(wx, wz) < WATER_LEVEL_3D + 0.55) return false;
    }
    return true;
  };
  for (const seg of layout.streets) {
    if (carConfigs.length >= 6) break;
    if (seg.isBridge) continue;
    const dxS = seg.x2 - seg.x1;
    const dzS = seg.z2 - seg.z1;
    const lenS = Math.hypot(dxS, dzS);
    if (lenS < 44) continue;
    const isMainNS = Math.abs(dzS) > Math.abs(dxS) * 2.2;
    const isMainEW = Math.abs(dxS) > Math.abs(dzS) * 2.2;
    if (!isMainNS && !isMainEW) continue;
    const dir: 1 | -1 = carConfigs.length % 2 === 0 ? 1 : -1;
    if (isMainNS) {
      const avgX = (seg.x1 + seg.x2) * 0.5 - centerX + dir * 3.8;
      const minZ = Math.min(seg.z1, seg.z2) - centerZ + 6;
      const maxZ = Math.max(seg.z1, seg.z2) - centerZ - 6;
      if (maxZ - minZ > 32 && isRouteDryLand('z', avgX, minZ, maxZ)) {
        carConfigs.push({
          axis: 'z',
          laneOffset: avgX,
          dir,
          minC: minZ,
          maxC: maxZ,
          start: minZ + ((carConfigs.length * 0.29 + 0.2) % 0.75) * (maxZ - minZ),
          spd: 10.4 + (carConfigs.length % 3) * 1.1,
        });
      }
    } else {
      const avgZ = (seg.z1 + seg.z2) * 0.5 - centerZ + dir * 3.6;
      const minX = Math.min(seg.x1, seg.x2) - centerX + 6;
      const maxX = Math.max(seg.x1, seg.x2) - centerX - 6;
      if (maxX - minX > 32 && isRouteDryLand('x', avgZ, minX, maxX)) {
        carConfigs.push({
          axis: 'x',
          laneOffset: avgZ,
          dir,
          minC: minX,
          maxC: maxX,
          start: minX + ((carConfigs.length * 0.31 + 0.15) % 0.75) * (maxX - minX),
          spd: 10.2 + (carConfigs.length % 3) * 1.0,
        });
      }
    }
  }
  const headLampMat = new THREE.MeshBasicMaterial({ color: 0xfff3bf });
  const tailLampMat = new THREE.MeshBasicMaterial({ color: 0xff4d4f });

  carConfigs.forEach((cc, idx) => {
    const carGrp = new THREE.Group();
    const wx = cc.axis === 'x' ? centerX + cc.start : centerX + cc.laneOffset;
    const wz = cc.axis === 'z' ? centerZ + cc.start : centerZ + cc.laneOffset;
    const baseCarY = localGroundY(wx, wz) + 0.16;
    carGrp.position.set(wx - centerX, baseCarY, wz - centerZ);
    carGrp.rotation.y = cc.axis === 'z' ? (cc.dir > 0 ? 0 : Math.PI) : cc.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    void mountGlbModel(carGrp, '/models/town/car/taxi.glb', {
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      targetWidth: 4.4,
      tintHex: carColors[(idx + styleIdx) % carColors.length],
      addInkEdges: true,
      cloneMaterials: true,
      onMounted: (wrapper) => {
        for (const sx of [-0.72, 0.72]) {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.14), headLampMat);
          hl.position.set(sx, 0.72, 2.08);
          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.14), tailLampMat);
          tl.position.set(sx, 0.72, -2.08);
          wrapper.add(hl, tl);
        }
      },
    });
    group.add(carGrp);
    vehicles.push({
      group: carGrp,
      axis: cc.axis,
      laneOffset: cc.laneOffset,
      dir: cc.dir,
      minCoord: cc.minC,
      maxCoord: cc.maxC,
      coord: cc.start,
      speed: cc.spd,
      baseY: baseCarY,
    });
  });

  const citizenPool = [
    '/sprites/people/youngster.png',
    '/sprites/people/lass.png',
    '/sprites/people/picnicker.png',
    '/sprites/people/camper.png',
    '/sprites/people/cooltrainer_m.png',
    '/sprites/people/cooltrainer_f.png',
    '/sprites/people/woman_1.png',
    '/sprites/people/woman_2.png',
    '/sprites/people/man.png',
    '/sprites/people/gentleman.png',
    '/sprites/people/beauty.png',
    '/sprites/people/policeman.png',
    '/sprites/people/sailor.png',
  ];
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x10141c, transparent: true, opacity: 0.34, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(0.85, 12);
  shadowGeo.rotateX(-Math.PI / 2);

  const pkCx = layout.plazaX - centerX;
  const pkCz = layout.plazaZ - centerZ;
  for (let wi = 0; wi < 6; wi++) {
    const spriteUrl = citizenPool[(wi + styleIdx) % citizenPool.length];
    const orbitR = 9.5 + (wi % 3) * 3.4;
    const initAng = (wi / 6) * Math.PI * 2;
    const wxCheck = centerX + pkCx + Math.cos(initAng) * orbitR;
    const wzCheck = centerZ + pkCz + Math.sin(initAng) * orbitR;
    if (getGroundHeight(wxCheck, wzCheck) < WATER_LEVEL_3D + 0.35) continue;
    const px = pkCx + Math.cos(initAng) * orbitR;
    const pz = pkCz + Math.sin(initAng) * orbitR;
    const py = localGroundY(centerX + px, centerZ + pz) + 0.16;
    const citizenMesh = createNpcBillboard(spriteUrl, px, py, pz, 2.45);
    const cShadow = new THREE.Mesh(shadowGeo, shadowMat);
    cShadow.position.set(px, py + 0.04, pz);
    group.add(citizenMesh, cShadow);
    walkers.push({
      mesh: citizenMesh,
      shadow: cShadow,
      walkFrames: getNpcWalkSpriteFrames(spriteUrl),
      mode: 'plaza_orbit',
      cx: pkCx,
      cz: pkCz,
      radius: orbitR,
      angle: initAng,
      speed: (wi % 2 === 0 ? 1 : -1) * (0.18 + (wi % 3) * 0.05),
      phase: wi * 1.3,
      baseY: py,
    });
  }

  const patrolStreets = layout.streets
    .filter(
      (st) =>
        !st.isBridge &&
        st.kind !== 'alley' &&
        Math.hypot((st.x1 + st.x2) * 0.5 - centerX, (st.z1 + st.z2) * 0.5 - centerZ) < 340 &&
        Math.hypot(st.x2 - st.x1, st.z2 - st.z1) >= 24,
    )
    .sort(
      (a, b) =>
        Math.hypot((a.x1 + a.x2) * 0.5 - centerX, (a.z1 + a.z2) * 0.5 - centerZ) -
        Math.hypot((b.x1 + b.x2) * 0.5 - centerX, (b.z1 + b.z2) * 0.5 - centerZ),
    );
  let sidewalkCount = 0;
  for (let si = 0; si < patrolStreets.length && sidewalkCount < 32; si++) {
    const st = patrolStreets[si];
    const sdx = st.x2 - st.x1;
    const sdz = st.z2 - st.z1;
    const slen = Math.hypot(sdx, sdz);
    const ux = sdx / slen;
    const uz = sdz / slen;
    const nx = -uz;
    const nz = ux;
    const sideSign = si % 2 === 0 ? 1 : -1;
    const swOff = st.width * 0.43 * sideSign;
    const trim = Math.min(8, slen * 0.2);
    const wx1 = st.x1 + ux * trim + nx * swOff;
    const wz1 = st.z1 + uz * trim + nz * swOff;
    const wx2 = st.x2 - ux * trim + nx * swOff;
    const wz2 = st.z2 - uz * trim + nz * swOff;
    if (
      getGroundHeight(wx1, wz1) < WATER_LEVEL_3D + 0.4 ||
      getGroundHeight(wx2, wz2) < WATER_LEVEL_3D + 0.4 ||
      getGroundHeight((wx1 + wx2) * 0.5, (wz1 + wz2) * 0.5) < WATER_LEVEL_3D + 0.4
    ) {
      continue;
    }
    const spriteUrl = citizenPool[(sidewalkCount + styleIdx) % citizenPool.length];
    const lx1 = wx1 - centerX;
    const lz1 = wz1 - centerZ;
    const lx2 = wx2 - centerX;
    const lz2 = wz2 - centerZ;
    const initAng = (sidewalkCount * 0.77) % (Math.PI * 2);
    const t0 = 0.5 + 0.5 * Math.sin(initAng);
    const px = lx1 + (lx2 - lx1) * t0;
    const pz = lz1 + (lz2 - lz1) * t0;
    const py = localGroundY(centerX + px, centerZ + pz) + 0.16;
    const citizenMesh = createNpcBillboard(spriteUrl, px, py, pz, 2.45);
    const cShadow = new THREE.Mesh(shadowGeo, shadowMat);
    cShadow.position.set(px, py + 0.04, pz);
    group.add(citizenMesh, cShadow);
    const segSpan = Math.max(16, Math.hypot(lx2 - lx1, lz2 - lz1));
    walkers.push({
      mesh: citizenMesh,
      shadow: cShadow,
      walkFrames: getNpcWalkSpriteFrames(spriteUrl),
      mode: 'sidewalk_patrol',
      cx: (lx1 + lx2) * 0.5,
      cz: (lz1 + lz2) * 0.5,
      x1: lx1,
      z1: lz1,
      x2: lx2,
      z2: lz2,
      radius: segSpan * 0.5,
      angle: initAng,
      speed: (sidewalkCount % 2 === 0 ? 1 : -1) * (3.1 / (segSpan * 0.5)),
      phase: sidewalkCount * 0.9,
      baseY: py,
    });
    sidewalkCount += 1;
  }

  // Sidewalk Voxel Vending Machines & Green Postboxes
  const vendFrontTex = makePixelTex(24, 36, (ctx) => {
    ctx.fillStyle = '#e03131';
    ctx.fillRect(0, 0, 24, 36);
    ctx.fillStyle = '#181a24';
    ctx.fillRect(2, 3, 20, 16);
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(3, 4, 18, 14);
    const cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#339af0'];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = cols[(c + r) % 4];
        ctx.fillRect(5 + c * 4, 6 + r * 6, 2, 4);
      }
    }
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(4, 21, 16, 3);
    ctx.fillStyle = '#212529';
    ctx.fillRect(4, 27, 16, 6);
  });
  const vendSideMat = new THREE.MeshLambertMaterial({ color: 0xc92a2a });
  const vendFrontMat = new THREE.MeshBasicMaterial({ map: vendFrontTex });
  const vendMats = [vendSideMat, vendSideMat, vendSideMat, vendSideMat, vendFrontMat, vendSideMat];
  const postboxMat = new THREE.MeshLambertMaterial({ color: 0x2b8a3e });
  const postCapMat = new THREE.MeshLambertMaterial({ color: 0x1e602c });

  const placedProps: { x: number; z: number }[] = [];
  for (const pk of layout.parks) {
    const candidates: [number, number, number][] = [
      [pk.x - pk.w * 0.5 - 2.6, pk.z - 5, -Math.PI / 2],
      [pk.x + pk.w * 0.5 + 2.6, pk.z + 5, Math.PI / 2],
      [pk.x - 6, pk.z + pk.d * 0.5 + 2.6, 0],
    ];
    for (const [wx, wz, ry] of candidates) {
      if (getGroundHeight(wx, wz) < WATER_LEVEL_3D + 0.45) continue;
      if (layout.streets.some((s) => distToSeg2D(wx, wz, s.x1, s.z1, s.x2, s.z2) < s.width * 0.44)) continue;
      if (placedProps.some((p) => Math.hypot(p.x - wx, p.z - wz) < 8)) continue;
      placedProps.push({ x: wx, z: wz });
      if (placedProps.length % 2 === 1) {
        const vm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.95), vendMats);
        vm.position.set(wx - centerX, localGroundY(wx, wz) + 1.25, wz - centerZ);
        vm.rotation.y = ry;
        vm.castShadow = true;
        group.add(vm);
      } else {
        const pb = new THREE.Group();
        pb.position.set(wx - centerX, localGroundY(wx, wz) + 0.16, wz - centerZ);
        addVoxelBox(pb, 0.85, 1.45, 0.85, postboxMat, 0, 0, 0);
        addVoxelBox(pb, 0.98, 0.22, 0.98, postCapMat, 0, 1.45, 0);
        group.add(pb);
      }
    }
  }

  interactPoints.push(
    {
      id: `${id}_station`,
      townName,
      kind: 'transit_station',
      label: `🚄 ${townName}·城郊虹桥高铁站`,
      hint: '乘坐城际高铁前往其他城市（可乘地铁1/2号线直通市中心）',
      x: layout.stationX,
      z: layout.stationZ + 4.5,
      radius: 9.5,
    },
    {
      id: `${id}_bus`,
      townName,
      kind: 'transit_station',
      label: `🚌 ${townName}·城镇巴士站`,
      hint: '乘车前往其他城镇或世界巡礼',
      x: layout.busX + Math.cos(layout.busRotY) * 5.2,
      z: layout.busZ - Math.sin(layout.busRotY) * 5.2,
      radius: 6.5,
    },
  );

  return {
    id,
    name: townName,
    centerX,
    centerZ,
    safeRadius: Math.max(layout.boundingRadius + 30, 340),
    group,
    interactPoints,
    colliders,
    interiors,
    autoDoors,
    upperFloorZones,
    streetLampPositions,
    viaductSpans,
    trainGroup,
    trainBaseX: trainGroup.position.x,
    animatedParts: {
      spinners,
      fountains,
      billboards,
      vehicles,
      walkers,
    },
  };
}
