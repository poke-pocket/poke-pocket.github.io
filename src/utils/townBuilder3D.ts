import * as THREE from 'three';
import {
  WATER_LEVEL_3D,
  WORLD_TOWNS_3D,
  type WalkableStairAndFloorZone3D,
} from '../data/survivorsTactics';
import { getBiomeTextures, getNpcWalkSpriteFrames } from '../data/worldTextures3D';
import { getActiveGeoTerrainOrigin } from '../data/geoTerrain3D';
import {
  buildCleanUrbanApartment3D,
  buildModernCbdOfficeTower3D,
} from '../world3d/cbdCurtainWall3D';
import {
  buildInterTownRoadNetwork3D,
  buildModernCityBridge3D,
  buildSuburbanHsrStation3D,
} from '../world3d/interTownNetwork3D';
import {
  BUILDING_ENTRANCE_POOL_MAT,
  createNpcBillboard,
  setBuildingExteriorOpacity,
  setGlobalNightLampGlow3D,
  STREET_LAMP_HALO_MAT,
  STREET_LAMP_POOL_MAT,
} from '../world3d/townAssetLoader';
import { getGroundTex } from '../world3d/townGroundTextures';
import { createRoadKitJunctionStreamer, createRoadKitStreetlight, getRoadKitTexture, planRoadKitJunctions, roadLaneCount, type RoadKitCut } from '../world3d/roadModelStyle3D';
import { buildRoadContinuity, roadsidePlantingStations } from '../world3d/roadKitContinuity';
import { buildRoadKitDrains } from '../world3d/roadKitDrains3D';
import { createRoadKitNetworkStreamer } from '../world3d/roadKitNetwork3D';
import { roadSidewalkOuterHalfWidth } from '../world3d/roadKitDimensions';
import { createBuildingFoundationFloor } from '../world3d/buildingFoundationVisual3D';
import { createRoadRiverMask } from '../world3d/roadWaterCrossing3D';
import { CITY_BUS_LENGTH, createCityBusCollider } from '../world3d/roadKitBusDimensions';
import { createPreviewBusShelter, mountPreviewCityBus } from '../world3d/roadKitBusStop3D';
import { roadSurfaceY } from '../world3d/roadKitSurface';
import {
  computeCameraWallClipT,
  isInsideBuildingInterior,
  makeObbCollider,
  resolveTownWallCollisions,
  type EnterableBuildingInterior,
  type NpcSocialProfile,
  type ProceduralTownInstance,
  type ProximityAutoDoor3D,
  type TownCollider,
  type TownInteractKind,
  type TownInteractPoint,
  type TownMovingVehicle,
  type TownStrollingCitizen,
  type ViaductOverheadSpan,
} from '../world3d/townTypes';
import {
  createVoxelParkPond3D,
  createVoxelVendingMachine3D,
  spawnVoxStreetPropCluster,
} from '../world3d/voxelNatureAndCivic3D';
import { mountVoxModel } from '../world3d/voxLoader3D';
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

  const TB_STREET_CELL = 64;
  const tbStreetBuckets = new Map<string, TownStreetSeg[]>();
  for (const st of layout.streets) {
    const pad = st.width * 0.5 + 4.0;
    const gx0 = Math.floor((Math.min(st.x1, st.x2) - pad) / TB_STREET_CELL);
    const gx1 = Math.floor((Math.max(st.x1, st.x2) + pad) / TB_STREET_CELL);
    const gz0 = Math.floor((Math.min(st.z1, st.z2) - pad) / TB_STREET_CELL);
    const gz1 = Math.floor((Math.max(st.z1, st.z2) + pad) / TB_STREET_CELL);
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const k = `${gx},${gz}`;
        let arr = tbStreetBuckets.get(k);
        if (!arr) {
          arr = [];
          tbStreetBuckets.set(k, arr);
        }
        arr.push(st);
      }
    }
  }

  const isBlockedForGreenery = (wx: number, wz: number, skipSeg: TownStreetSeg) => {
    if (getGroundHeight(wx, wz) < WATER_LEVEL_3D + 0.35) return true;
    if (
      layout.busStops.some(
        (bs) => Math.hypot(wx - bs.shelterX, wz - bs.shelterZ) < 9.5 || Math.hypot(wx - bs.busX, wz - bs.busZ) < 9.5,
      )
    ) {
      return true;
    }
    if (layout.lots.some((l) => l.walkable && Math.hypot(wx - l.doorX, wz - l.doorZ) < 7.5)) return true;
    const nearStreets = tbStreetBuckets.get(`${Math.floor(wx / TB_STREET_CELL)},${Math.floor(wz / TB_STREET_CELL)}`);
    if (nearStreets) {
      for (let i = 0; i < nearStreets.length; i++) {
        const other = nearStreets[i];
        if (other === skipSeg) continue;
        if (distToSeg2D(wx, wz, other.x1, other.z1, other.x2, other.z2) < roadSidewalkOuterHalfWidth(other.width) + 1.6) {
          return true;
        }
      }
    }
    return false;
  };

  // ==================== 1. STREETS, SLEEK MODERN BRIDGES & BOULEVARD GREENERY ====================
  const roadJoins=buildRoadContinuity(layout.streets);
  const roadJunctions=planRoadKitJunctions({streets:layout.streets,junctions:layout.junctions,centerX,centerZ,water:WATER_LEVEL_3D,ground:getGroundHeight});
  const junctionCuts=new Map<TownStreetSeg,RoadKitCut[]>();
  for(const p of roadJunctions)for(const seg of p.nearby){const cuts=junctionCuts.get(seg)??[];cuts.push({x:p.node.x,z:p.node.z,radius:p.radius,step:p.step});junctionCuts.set(seg,cuts)}
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
        deckRoadTex: getRoadKitTexture(roadLaneCount(seg),seg.width),
        getGroundHeight,
      });
      continue;
    }

    const segMidDist = Math.hypot((seg.x1 + seg.x2) * 0.5 - centerX, (seg.z1 + seg.z2) * 0.5 - centerZ);
    if (segMidDist > 4200) continue;

    if (segMidDist > 680) continue;

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

    if (seg.kind === 'arterial') {
      // Keep asphalt lanes & center median 100% unobstructed — plant street trees ONLY along outer sidewalks at spacious 19m intervals!
      const vergeOff = roadSidewalkOuterHalfWidth(seg.width) + 1.15;
      for (const station of roadsidePlantingStations(segLen,19,roadJoins.get(seg))) {
        const si=station.slot;
        const sx = seg.x1 + dirX * station.distance;
        const sz = seg.z1 + dirZ * station.distance;
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 20) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.16;
          if ((si + (side > 0 ? 1 : 0)) % 2 === 0) {
            const treeTex = floraTex.treeSprites[(si + styleIdx + (side > 0 ? 1 : 0)) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.6, 5.6);
          } else {
            spawnPixelGreenery(pickDetailedShrubTex(si + (side > 0 ? 2 : 0) + segIdx), tx - centerX, ty, tz - centerZ, 1.85, 1.65);
          }
        }
      }
    }

    if (seg.kind === 'street') {
      const vergeOff = roadSidewalkOuterHalfWidth(seg.width) + 0.95;
      for (const station of roadsidePlantingStations(segLen,21,roadJoins.get(seg))) {
        const ti=station.slot;
        const sx = seg.x1 + dirX * station.distance;
        const sz = seg.z1 + dirZ * station.distance;
        for (const side of [-1, 1]) {
          const tx = sx + nx * side * vergeOff;
          const tz = sz + nz * side * vergeOff;
          if (isNearAnyJunction(tx, tz, 17) || isBlockedForGreenery(tx, tz, seg)) continue;
          const ty = localGroundY(tx, tz) + 0.16;
          if (ti % 2 === 0) {
            const treeTex = floraTex.treeSprites[(ti + styleIdx) % floraTex.treeSprites.length] ?? floraTex.treeSprite;
            spawnPixelGreenery(treeTex, tx - centerX, ty, tz - centerZ, 4.2, 5.1);
          } else {
            spawnPixelGreenery(pickDetailedShrubTex(ti + (side > 0 ? 3 : 0) + segIdx), tx - centerX, ty, tz - centerZ, 1.7, 1.5);
          }
        }
      }
    }
  }

  // Ground roads use one world-aligned network mask, following the preview's
  // road/sidewalk union and rounding rules. Bridges keep their original decks.
  const hubAsphaltMat = new THREE.MeshLambertMaterial({ color: 0x718891, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const roadCity=(landmarkCityId??anchor.landmarkCityId??id).toLowerCase();
  const coverStyle=roadCity.includes('shanghai')?'shanghai':roadCity.includes('shenzhen')?'shenzhen':'plain';
  const riverMask=getActiveGeoTerrainOrigin()?createRoadRiverMask(layout.rivers):undefined;
  const networkStreamer=createRoadKitNetworkStreamer({streets:layout.streets,centerX,centerZ,baseY,water:WATER_LEVEL_3D,ground:getGroundHeight,plans:roadJunctions,joins:roadJoins,manholeStyle:coverStyle,isWater:riverMask});
  networkStreamer.update(centerX,centerZ);group.add(networkStreamer.group);
  const junctionStreamer=createRoadKitJunctionStreamer({streets:layout.streets,junctions:layout.junctions,centerX,centerZ,baseY,water:WATER_LEVEL_3D,ground:getGroundHeight,plans:roadJunctions,paintOnly:true});
  junctionStreamer.update(centerX,centerZ);group.add(junctionStreamer.group);
  const makeDrains=(localBaseY:number)=>buildRoadKitDrains({streets:layout.streets,joins:roadJoins,cuts:junctionCuts,centerX,centerZ,baseY:localBaseY,water:WATER_LEVEL_3D,ground:getGroundHeight});
  let drainGroup=makeDrains(baseY);group.add(drainGroup);
  const releaseDrains=()=>{group.remove(drainGroup);drainGroup.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})};

  // ==================== 1C. URBAN PARKS, STEPPED VOXEL FOUNTAINS, PONDS & .VOX BENCHES/TRASHCANS ====================
  const parkBorderMat = new THREE.MeshLambertMaterial({ map: tex.cobblePlaza });
  const parkLawnMat = new THREE.MeshLambertMaterial({ color: 0x51b748 });
  const parkWalkMat = new THREE.MeshLambertMaterial({
    map: tex.cobblePlaza,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

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
      const plazaPad = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 14.5), parkWalkMat);
      plazaPad.rotation.x = -Math.PI / 2;
      plazaPad.position.set(px, py + 0.14, pz);
      plazaPad.receiveShadow = true;
      plazaPad.renderOrder = 5;
      group.add(plazaPad);
      const fountain = createPlazaFountain(fountains);
      fountain.position.set(px, py + 0.145, pz);
      group.add(fountain);
      colliders.push(makeObbCollider(pk.x, pk.z, 5.2, 5.2, 0, 6.5));
    } else if (pk.hasPond) {
      const pond = createVoxelParkPond3D(21);
      pond.position.set(px, py + 0.13, pz);
      group.add(pond);
    }

    for (let qi = 0; qi < 4; qi++) {
      const sx = qi % 2 === 0 ? -1 : 1;
      const sz = qi < 2 ? -1 : 1;
      const bx = px + sx * (pk.w * 0.24);
      const bz = pz + sz * (pk.d * 0.24);
      const bRot = Math.atan2(-sx, -sz);
      spawnVoxStreetPropCluster(group, 'bench', bx, py + 0.14, bz, bRot, qi + styleIdx);
      spawnVoxStreetPropCluster(
        group,
        qi % 2 === 0 ? 'trashcan' : 'planter',
        bx + sx * 2.1,
        py + 0.14,
        bz,
        bRot,
        qi + seed,
      );

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
      townName,
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
    interactPoints.push(...built.interactPoints);
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
      registerWalkIn(lot, 'pokemon_center', `${townName}·宝可梦中心`, tex.clinicFloor, tex.pcSign, true);
    } else if (lot.kind === 'poke_mart') {
      registerWalkIn(lot, 'poke_mart', `${townName}·友好百货商店`, tex.martFloor, tex.martSign);
    } else if (lot.kind === 'hotel') {
      registerWalkIn(lot, 'hotel', `${townName}·驿站大酒店`, tex.woodFloor, tex.hotelSign);
    } else if (lot.kind === 'restaurant') {
      registerWalkIn(lot, 'restaurant', `${townName}·树果料理餐厅`, tex.woodFloor, tex.cafeSign);
    } else if (lot.kind === 'landmark' && anchor.landmarkCityId) {
      const lm = buildWorldLandmark3D(anchor.landmarkCityId);
      if (lm) {
        lm.position.set(lx, ly, lz);
        lm.scale.setScalar(1.42);
        group.add(lm);
        colliders.push(makeObbCollider(lot.x, lot.z, 10.5, 10.5, 0, 44));
      }
    } else if (lot.kind === 'house' && lot.walkable) {
      const aptIndex = interiors.filter((b) => b.kind === 'house').length + 1;
      registerWalkIn(lot, 'house', `${townName}·训练家复式公寓 ${aptIndex}号`, tex.woodFloor);
    } else {
      // Non-walkable urban lots: Mix of Modern MagicaVoxel All-Glass Curtain-Wall CBD Office Towers (~52%)
      // and MagicaVoxel Urban Balcony Residential Apartments (~48%)!
      const hHash = Math.abs(anchor.seed * 19 + lot.houseVariant * 37 + Math.round(lot.x) * 7 + Math.round(lot.z) * 13);
      const distCenter = Math.hypot(lx, lz);
      const isCbdOffice =
        lot.kind === 'skyscraper' ||
        (lot.shape && lot.shape !== 'rect') ||
        (distCenter < 220 ? hHash % 10 < 6 : hHash % 10 < 4);
      group.add(createBuildingFoundationFloor(lot,lx,ly,lz));

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

  // ==================== 4. FULL-CITY 3D BUS STOP NETWORK (EVERY DESTINATION HAS A REAL 3D SHELTER & SIGN!) ====================
  layout.busStops.forEach((bs, bsIdx) => {
    const bFwdX = Math.sin(bs.rotY);
    const bFwdZ = Math.cos(bs.rotY);
    const shelterY = localGroundY(bs.shelterX, bs.shelterZ) + 0.16;

    const shelter=createPreviewBusShelter();
    shelter.position.set(bs.shelterX-centerX,shelterY,bs.shelterZ-centerZ);
    shelter.rotation.y=Math.atan2(bs.busX-bs.shelterX,bs.busZ-bs.shelterZ);
    group.add(shelter);
    spawnVoxStreetPropCluster(
      group,
      'trashcan',
      bs.shelterX - centerX + bFwdX * 6.3,
      shelterY,
      bs.shelterZ - centerZ + bFwdZ * 6.3,
      bs.rotY,
      seed + 3 + bsIdx,
    );

    if (bs.hasParkedBus) {
      const busGroundY = bs.id==='bus_hsr' ? localGroundY(bs.busX,bs.busZ)+.16 : roadSurfaceY(bs.busX,bs.busZ,getGroundHeight,WATER_LEVEL_3D)-baseY+.06;
      if (bs.id === 'bus_hsr') {
        // Paved forecourt shuttle-bus bay right outside the Suburban HSR Terminal!
        const forecourtRoad = new THREE.Mesh(
          new THREE.PlaneGeometry(9.6, 27),
          hubAsphaltMat,
        );
        forecourtRoad.rotation.x = -Math.PI / 2;
        forecourtRoad.rotation.z = -bs.rotY;
        forecourtRoad.position.set(bs.busX - centerX, busGroundY - 0.05, bs.busZ - centerZ);
        forecourtRoad.receiveShadow = true;
        group.add(forecourtRoad);
      }
      void mountPreviewCityBus(group,bs.busX-centerX,busGroundY,bs.busZ-centerZ,bs.rotY);
      colliders.push(createCityBusCollider(bs.busX,bs.busZ,bs.rotY,baseY+busGroundY));
    }
  });

  const streetLampPositions: { x: number; y: number; z: number }[] = [];
  const lampPoolGeo = new THREE.PlaneGeometry(10.8, 10.8);
  lampPoolGeo.rotateX(-Math.PI / 2);
  for (let li = 0; li < layout.streetLamps.length; li++) {
    const lamp = layout.streetLamps[li];
    const lampBaseLocalY = localGroundY(lamp.x, lamp.z);
    streetLampPositions.push({ x: lamp.x, y: baseY + lampBaseLocalY + 8.0, z: lamp.z });

    const pool = new THREE.Mesh(lampPoolGeo, STREET_LAMP_POOL_MAT);
    pool.position.set(
      lamp.x - centerX + Math.sin(lamp.rotY) * 1.4,
      lampBaseLocalY + 0.08,
      lamp.z - centerZ + Math.cos(lamp.rotY) * 1.4,
    );
    group.add(pool);

    // Same shaped streetlight used by the road kit; the game still owns its
    // placement, night-time pools and proximity-light bookkeeping.
    const roadLamp = createRoadKitStreetlight(8);
    roadLamp.position.set(lamp.x - centerX, lampBaseLocalY + .12, lamp.z - centerZ);
    roadLamp.rotation.y = lamp.rotY;
    group.add(roadLamp);
    const halo = new THREE.Sprite(STREET_LAMP_HALO_MAT);
    halo.scale.set(4, 4, 1);
    halo.position.set(lamp.x-centerX+Math.sin(lamp.rotY)*2.1,lampBaseLocalY+8.05,lamp.z-centerZ+Math.cos(lamp.rotY)*2.1);
    group.add(halo);
    // Pair every 4th streetlamp with a curbside MagicaVoxel trash can or fire hydrant!
    if (li % 4 === 1) {
      spawnVoxStreetPropCluster(
        group,
        li % 8 === 1 ? 'trashcan' : 'hydrant',
        lamp.x - centerX - Math.cos(lamp.rotY) * 1.3,
        lampBaseLocalY + 0.12,
        lamp.z - centerZ + Math.sin(lamp.rotY) * 1.3,
        lamp.rotY,
        li + seed,
      );
    }
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
  const voxVehicleUrls = [
    '/models/vox/veh_cab1.vox',
    '/models/vox/veh_car1.vox',
    '/models/vox/veh_suv1.vox',
    '/models/vox/veh_car2.vox',
    '/models/vox/veh_lunch1.vox',
    '/models/vox/veh_cab1.vox',
  ];

  carConfigs.forEach((cc, idx) => {
    const carGrp = new THREE.Group();
    const wx = cc.axis === 'x' ? centerX + cc.start : centerX + cc.laneOffset;
    const wz = cc.axis === 'z' ? centerZ + cc.start : centerZ + cc.laneOffset;
    const baseCarY = localGroundY(wx, wz) + 0.16;
    carGrp.position.set(wx - centerX, baseCarY, wz - centerZ);
    carGrp.rotation.y = cc.axis === 'z' ? (cc.dir > 0 ? 0 : Math.PI) : cc.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const vUrl = voxVehicleUrls[idx % voxVehicleUrls.length];
    void mountVoxModel(carGrp, vUrl, {
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      targetSpan: vUrl.includes('lunch') ? 5.2 : 4.6,
      tintHex: vUrl.includes('car1') ? carColors[(idx + styleIdx) % carColors.length] : undefined,
      emitMode: 'vehicle',
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

  const citizenRoster: {
    sprite: string;
    name: string;
    role: string;
    greeting: string;
    chat: string[];
    species: string;
  }[] = [
    {
      sprite: '/sprites/people/youngster.png',
      name: '短裤小子 阿弘',
      role: '街头见习训练家',
      greeting: '嘿！我刚给搭档喂了新鲜树果，要不要在宽敞的大街上来一场切磋？',
      chat: ['穿短裤在体素城市里跑步最凉快啦！', '想去火车站的话，去大马路边的市内公交站坐巴士直达最快！'],
      species: 'pikachu',
    },
    {
      sprite: '/sprites/people/lass.png',
      name: '迷你裙少女 小奈',
      role: '学院派训练家',
      greeting: '你好呀！夜晚亮灯后的宝可梦中心和树果饭店超有氛围感对吧？',
      chat: ['我刚从友好百货买了精灵球，准备去郊外收服新伙伴！', '来试试我的宝可梦特训成果吧！'],
      species: 'jigglypuff',
    },
    {
      sprite: '/sprites/people/picnicker.png',
      name: '野餐少女 晴子',
      role: '公园散步达人',
      greeting: '中心公园的体素喷泉和荷花池好漂亮呀，你也来散步吗？',
      chat: ['累了可以去树果饭店吃碗拉面，或者去酒店二楼睡一觉！', '随时欢迎友好对战哦！'],
      species: 'bulbasaur',
    },
    {
      sprite: '/sprites/people/camper.png',
      name: '露营少年 小拓',
      role: '野外勘探员',
      greeting: '嗨！城外的体素矿石敲碎后能掉星星沙子和金币哦！',
      chat: ['不知道宝可梦中心在哪？点「询问打听」我直接给你指路导航！', '我的小火龙今天状态超棒！'],
      species: 'charmander',
    },
    {
      sprite: '/sprites/people/cooltrainer_m.png',
      name: '精英训练家 龙崎',
      role: '道馆挑战者',
      greeting: '眼神不错嘛！看得出你和身边的伙伴很有默契，来切磋一局如何？',
      chat: ['真正的强者既懂得在城镇休整，也敢随时迎接路边挑战！', '城郊虹桥高铁站可以乘车前往世界各地的名城道馆！'],
      species: 'dratini',
    },
    {
      sprite: '/sprites/people/cooltrainer_f.png',
      name: '精英训练家 绯月',
      role: '战术研究家',
      greeting: '嗨，旅行者！需要打听附近的设施，还是想实战检验一下阵容？',
      chat: ['水系伙伴在河道与海湾还能直接冲浪滑行呢！', '全力以赴来一场街头友谊赛吧！'],
      species: 'squirtle',
    },
    {
      sprite: '/sprites/people/policeman.png',
      name: '巡逻警官 佐藤',
      role: '城市治安巡警',
      greeting: `向你致敬！${townName}市内秩序井然，迷路了随时向我问路！`,
      chat: ['市内严禁野生宝可梦主动伤人，但训练家之间礼貌切磋完全没问题！', '需要去火车站或宝可梦中心的话，我可以立刻为你标注路线！'],
      species: 'eevee',
    },
    {
      sprite: '/sprites/people/sailor.png',
      name: '远航水手 大海',
      role: '港口水手训练家',
      greeting: '哟吼！吹着江风散步真痛快，来场水花四溅的对战吗？',
      chat: ['跨江大桥夜景超美，连桥上的路灯都是体素风格！', '我的杰尼龟可不会轻易认输！'],
      species: 'psyduck',
    },
    {
      sprite: '/sprites/people/gentleman.png',
      name: '绅士 阿尔弗雷德',
      role: '资深宝可梦学者',
      greeting: '日安，年轻的训练家。旅行途中多与路人交流，往往能收获意外惊喜。',
      chat: ['乘坐市内公交可以在本城各大站点与城郊火车站之间轻松往返。', '若不嫌弃，老夫也愿陪你切磋一局！'],
      species: 'gastly',
    },
    {
      sprite: '/sprites/people/beauty.png',
      name: '模特 薇薇安',
      role: '都市街拍达人',
      greeting: '嗨～你的宝可梦好上镜呀！要不要聊聊天或者比试一场？',
      chat: ['商业街的霓虹招牌一到晚上就会亮起温暖的灯光！', '赢了我的话有零花钱奖励哦！'],
      species: 'meowth',
    },
  ];
  const makeCitizenProfile = (idx: number, keySuffix: string): NpcSocialProfile => {
    const tpl = citizenRoster[(idx + styleIdx) % citizenRoster.length];
    return {
      id: `${id}_citizen_${keySuffix}`,
      name: tpl.name,
      role: tpl.role,
      sprite: tpl.sprite,
      greeting: tpl.greeting,
      chatLines: tpl.chat,
      battleSpecies: tpl.species,
      canBattle: true,
    };
  };
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x10141c, transparent: true, opacity: 0.34, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(0.85, 12);
  shadowGeo.rotateX(-Math.PI / 2);

  const pkCx = layout.plazaX - centerX;
  const pkCz = layout.plazaZ - centerZ;
  for (let wi = 0; wi < 6; wi++) {
    const prof = makeCitizenProfile(wi, `plaza_${wi}`);
    const spriteUrl = prof.sprite;
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
      id: prof.id,
      npcProfile: prof,
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
      worldX: centerX + px,
      worldZ: centerZ + pz,
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
    const prof = makeCitizenProfile(sidewalkCount + 3, `sw_${sidewalkCount}`);
    const spriteUrl = prof.sprite;
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
      id: prof.id,
      npcProfile: prof,
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
      worldX: centerX + px,
      worldZ: centerZ + pz,
    });
    sidewalkCount += 1;
  }

  // Sidewalk Pure MagicaVoxel Vending Machines, `.vox` Postboxes & `.vox` Newsboxes!
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
      const pyProp = localGroundY(wx, wz) + 0.16;
      if (placedProps.length % 3 === 1) {
        const vm = createVoxelVendingMachine3D(placedProps.length);
        vm.position.set(wx - centerX, pyProp, wz - centerZ);
        vm.rotation.y = ry;
        group.add(vm);
      } else if (placedProps.length % 3 === 2) {
        spawnVoxStreetPropCluster(group, 'mailbox', wx - centerX, pyProp, wz - centerZ, ry, placedProps.length);
      } else {
        spawnVoxStreetPropCluster(group, 'newsbox', wx - centerX, pyProp, wz - centerZ, ry, placedProps.length);
      }
    }
  }

  interactPoints.push({
    id: `${id}_station`,
    townName,
    kind: 'transit_station',
    label: `🚄 ${townName}·城郊虹桥高铁站`,
    hint: '乘坐高铁或航班前往全国/世界其他城市',
    x: layout.stationX,
    z: layout.stationZ + 4.5,
    radius: 6.5,
  });
  for (const bs of layout.busStops) {
    interactPoints.push({
      id: `${id}_${bs.id}`,
      townName,
      kind: 'city_bus_stop',
      label: `🚏 ${bs.name}`,
      hint: bs.servesLabel,
      x: bs.dropoffX,
      z: bs.dropoffZ,
      radius: 5.6,
    });
  }

  return {
    id,
    name: townName,
    centerX,
    centerZ,
    safeRadius: Math.max(layout.boundingRadius + 30, 340),
    collisionRadius: Math.max(layout.boundingRadius+90,740,...layout.busStops.filter(b=>b.hasParkedBus).map(b=>Math.hypot(b.busX-centerX,b.busZ-centerZ)+CITY_BUS_LENGTH)),
    group,
    interactPoints,
    colliders,
    interiors,
    autoDoors,
    upperFloorZones,
    streetLampPositions,
    viaductSpans,
    updateRoadKit: (x,z)=>{networkStreamer.update(x,z);junctionStreamer.update(x,z)},
    refreshRoadKit: (localBaseY,x,z)=>{
      networkStreamer.refreshTerrain(localBaseY);junctionStreamer.refreshTerrain(localBaseY);
      releaseDrains();
      drainGroup=makeDrains(localBaseY);group.add(drainGroup);
      networkStreamer.update(x,z);junctionStreamer.update(x,z);
    },
    disposeRoadKit: ()=>{networkStreamer.refreshTerrain(group.position.y);junctionStreamer.refreshTerrain(group.position.y);releaseDrains();group.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='Building_foundation_floor')o.geometry.dispose()})},
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
