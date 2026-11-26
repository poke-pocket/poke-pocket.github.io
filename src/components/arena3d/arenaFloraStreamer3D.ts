import type { ArenaSharedCtx } from './arenaTypesAndProps';
import * as THREE from 'three';
import { getBiomeTextures, getSeamlessBiomeAt3D } from '../../data/worldTextures3D';
import {
  createVoxelBoulder3D,
  createVoxelRoadSupply3D,
  createVoxelSignpost3D,
} from '../../world3d/voxelNatureAndCivic3D';
import {
  TERRACE_CELL,
  WATER_LEVEL_3D,
  WORLD_SECTOR_SIZE,
  getTerrainHeight3D,
  getWalkableSurfaceHeight3D,
  isNearAnyRoadOrRailForFlora3D,
} from '../../data/survivorsTactics';
import { HIGHWAY_ROAD_WIDTH_3D, getNearestGeoHighwayProjection3D } from '../../utils/interCityHighwayGraph';
import { BILLBOARD_PITCH_TILT, UPRIGHT_QUAD_GEO, createLushTreeSprite3D } from './arenaTypesAndProps';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function createArenaFloraStreamer3D(rawCtx: Record<string, any>) {
  const {
    chunkState,
    cattailMat,
    floatingLilyPads,
    floraGroup,
    isInsideAnyTownPlaza,
    lilyGeo,
    lilyMat,
    lotusMat,
    prefsRef,
    selectedBiome,
    terrainGeo,
    terrainMesh,
    terrainPosAttr,
    tex,
    waterPlaneMesh,
  } = rawCtx as ArenaSharedCtx;

  const sharedFloraMatCache = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
  const getSharedFloraMat = (t: THREE.Texture, alphaTest = 0.15) => {
    let m = sharedFloraMatCache.get(t);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        alphaTest,
        side: THREE.DoubleSide,
      });
      sharedFloraMatCache.set(t, m);
    }
    return m;
  };
  const floraBillboards = new Set<THREE.Mesh>();
  let lastBbYaw = 999;
  let lastBbPitch = 999;
  const windClock = 0;
  const syncFloraBillboards = (yaw: number, pitch: number, windT = windClock) => {
    lastBbYaw = yaw;
    lastBbPitch = pitch;
    const tiltX = -pitch * BILLBOARD_PITCH_TILT;
    for (const bb of floraBillboards) {
      const amp = bb.userData.swayAmp as number | undefined;
      let swayZ = 0;
      if (amp) {
        const freq = (bb.userData.swayFreq as number | undefined) ?? 2.1;
        const phase = (bb.userData.swayPhase as number | undefined) ?? 0;
        const shake = (bb.userData.shakeTimer as number | undefined) ?? 0;
        const shakeOffset = shake > 0 ? Math.sin(windT * 42) * 0.16 * shake : 0;
        swayZ = Math.sin(windT * freq + phase) * amp + shakeOffset;
      }
      bb.rotation.set(tiltX, yaw, swayZ, 'YXZ');
    }
    for (const lp of floatingLilyPads) {
      lp.mesh.position.y = lp.baseY + Math.sin(windT * 1.9 + lp.phase) * 0.022;
    }
  };
  const makeUprightProp = (
    t: THREE.Texture,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    alphaTest = 0.15,
    swayAmp = 0,
    swayFreq = 2.2,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(UPRIGHT_QUAD_GEO, getSharedFloraMat(t, alphaTest));
    m.rotation.order = 'YXZ';
    m.rotation.set(
      lastBbPitch < 100 ? -lastBbPitch * BILLBOARD_PITCH_TILT : -0.24 * BILLBOARD_PITCH_TILT,
      lastBbYaw < 100 ? lastBbYaw : 0,
      0,
    );
    m.scale.set(w, h, 1);
    m.position.set(x, y - 0.04, z);
    if (swayAmp > 0) {
      m.userData.swayAmp = swayAmp;
      m.userData.swayFreq = swayFreq;
      m.userData.swayPhase = x * 0.24 + z * 0.16;
    }
    floraGroup.add(m);
    floraBillboards.add(m);
    return m;
  };

  interface WorldInteractNode {
    id: string;
    kind: 'mushroom' | 'berry_tree' | 'ore_rock' | 'signpost' | 'road_supply';
    x: number;
    y: number;
    z: number;
    mesh: THREE.Mesh;
    extraMesh?: THREE.Mesh;
    baseScaleX: number;
    baseScaleY: number;
    hp: number;
    maxHp: number;
    cooldown: number;
    label: string;
    icon: string;
  }
  const worldInteractNodes = new Map<string, WorldInteractNode>();
  const placedFloraCells = new Map<
    string,
    {
      gx: number;
      gz: number;
      tier: 'far' | 'full';
      objs: THREE.Object3D[];
      bbs: THREE.Mesh[];
      nodeIds: string[];
      lilies?: { mesh: THREE.Mesh; baseY: number; phase: number }[];
    }
  >();

  let floraSnapGx = 999999;
  let floraSnapGz = 999999;
  let floraPendingPass = true;
  const terrainNormAttr = terrainGeo.attributes.normal as THREE.BufferAttribute;
  const gridSide = Math.round(Math.sqrt(terrainPosAttr.count));
  const cellSpacing = gridSide > 1 ? Math.abs(terrainPosAttr.getX(1) - terrainPosAttr.getX(0)) : 2.5;
  const twoSpacing = cellSpacing * 2;

  const updateWorldAround = (cx: number, cz: number) => {
    // 1. Snap 288m terrain mesh every 16m + ultra-fast O(N) heightfield central-difference normals (0.3ms, zero GC!)
    const snapX = Math.round(cx / 16) * 16;
    const snapZ = Math.round(cz / 16) * 16;
    if (snapX !== chunkState.x || snapZ !== chunkState.z) {
      chunkState.x = snapX;
      chunkState.z = snapZ;
      terrainMesh.position.set(snapX, 0, snapZ);
      waterPlaneMesh.position.set(snapX, WATER_LEVEL_3D, snapZ);

      const posArr = terrainPosAttr.array as Float32Array;
      const count = terrainPosAttr.count;
      for (let i = 0, p = 0; i < count; i++, p += 3) {
        posArr[p + 1] = getTerrainHeight3D(posArr[p] + snapX, posArr[p + 2] + snapZ);
      }
      terrainPosAttr.needsUpdate = true;

      if (terrainNormAttr && gridSide * gridSide === count) {
        const normArr = terrainNormAttr.array as Float32Array;
        for (let rz = 0; rz < gridSide; rz++) {
          const rPrev = Math.max(0, rz - 1) * gridSide;
          const rCur = rz * gridSide;
          const rNext = Math.min(gridSide - 1, rz + 1) * gridSide;
          for (let rx = 0; rx < gridSide; rx++) {
            const i = rCur + rx;
            const p = i * 3;
            const hL = posArr[(rCur + Math.max(0, rx - 1)) * 3 + 1];
            const hR = posArr[(rCur + Math.min(gridSide - 1, rx + 1)) * 3 + 1];
            const hU = posArr[(rPrev + rx) * 3 + 1];
            const hD = posArr[(rNext + rx) * 3 + 1];
            const nx = hL - hR;
            const nz = hU - hD;
            const invLen = 1 / Math.hypot(nx, twoSpacing, nz);
            normArr[p] = nx * invLen;
            normArr[p + 1] = twoSpacing * invLen;
            normArr[p + 2] = nz * invLen;
          }
        }
        terrainNormAttr.needsUpdate = true;
      } else {
        terrainGeo.computeVertexNormals();
      }
    }

    // 2. Time-sliced 2-Tier Flora LOD Streaming (50%+ lighter density, natural grove clustering, zero wild props on roads!)
    const gx0 = Math.round(cx / TERRACE_CELL);
    const gz0 = Math.round(cz / TERRACE_CELL);
    if (Math.abs(gx0 - floraSnapGx) < 2 && Math.abs(gz0 - floraSnapGz) < 2 && !floraPendingPass) {
      return;
    }
    const isInitialBurst =
      !Number.isFinite(floraSnapGx) || Math.abs(gx0 - floraSnapGx) > 12 || Math.abs(gz0 - floraSnapGz) > 12;
    floraSnapGx = gx0;
    floraSnapGz = gz0;
    floraPendingPass = false;
    const cellBudget = isInitialBurst ? 9999 : 22;
    let spawnedThisFrame = 0;

    const NEAR_R = prefsRef.current.graphicsQuality === 'low' ? 9 : 12;
    const FAR_R = prefsRef.current.graphicsQuality === 'low' ? 18 : 23;
    const CULL_R = FAR_R + 3;

    for (const [key, entry] of placedFloraCells) {
      if (Math.abs(entry.gx - gx0) > CULL_R || Math.abs(entry.gz - gz0) > CULL_R) {
        for (const obj of entry.objs) floraGroup.remove(obj);
        for (const bb of entry.bbs) floraBillboards.delete(bb);
        for (const nid of entry.nodeIds) worldInteractNodes.delete(nid);
        if (entry.lilies) {
          for (const lp of entry.lilies) floatingLilyPads.delete(lp);
        }
        placedFloraCells.delete(key);
      }
    }

    const hwyHalfW = HIGHWAY_ROAD_WIDTH_3D * 0.5;

    for (let dz = -FAR_R; dz <= FAR_R; dz++) {
      for (let dx = -FAR_R; dx <= FAR_R; dx++) {
        const distCell = Math.max(Math.abs(dx), Math.abs(dz));
        const wantTier: 'far' | 'full' = distCell <= NEAR_R ? 'full' : 'far';
        const gx = gx0 + dx;
        const gz = gz0 + dz;
        const key = `${gx},${gz}`;
        const existing = placedFloraCells.get(key);
        if (existing && (existing.tier === 'full' || wantTier === 'far')) continue;
        if (spawnedThisFrame >= cellBudget) {
          floraPendingPass = true;
          return;
        }

        const wx = gx * TERRACE_CELL;
        const wz = gz * TERRACE_CELL;
        const h = Math.abs(Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663)) % 100;
        const h2 = Math.abs(Math.imul(gx + 37, 2654435761) ^ Math.imul(gz - 19, 2246822519)) % 100;

        // Inside downtown safe radius or spawn point: keep wild flora completely out
        if (Math.hypot(wx, wz) < 6.0 || isInsideAnyTownPlaza(wx, wz, 3.0)) {
          if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
          else existing.tier = wantTier;
          continue;
        }

        // Strict Road, Highway, Bridge & Rail Exclusion!
        // Wild trees, rocks, bushes & mushrooms NEVER spawn on or right beside roads;
        // ONLY road-exclusive special items (`公路补给箱` / `路边指路木牌`) may appear neatly along outer highway shoulders!
        if (isNearAnyRoadOrRailForFlora3D(wx, wz, 0.5)) {
          if (!existing && wantTier === 'full') {
            const objsRoad: THREE.Object3D[] = [];
            const nodeIdsRoad: string[] = [];
            const hwyProj = getNearestGeoHighwayProjection3D(wx, wz);

            // Sparse roadside-only props every ~160-200m along dry inter-city highway shoulders (NEVER in driving lanes!)
            if (
              hwyProj &&
              hwyProj.dist >= hwyHalfW - 1.2 &&
              hwyProj.dist <= hwyHalfW + 3.2 &&
              gx % 9 === 0 &&
              gz % 7 === 0 &&
              h < 34
            ) {
              const cGround = getTerrainHeight3D(hwyProj.qx, hwyProj.qz);
              if (cGround > WATER_LEVEL_3D + 0.42) {
                const perpX = -hwyProj.dirZ;
                const perpZ = hwyProj.dirX;
                const side = (wx - hwyProj.qx) * perpX + (wz - hwyProj.qz) * perpZ >= 0 ? 1 : -1;

                if (h < 22) {
                  // Road-exclusive Poké-Supply Crate neatly tucked on the outer emergency shoulder!
                  const sx = hwyProj.qx + perpX * side * (hwyHalfW - 0.95);
                  const sz = hwyProj.qz + perpZ * side * (hwyHalfW - 0.95);
                  const sy = getWalkableSurfaceHeight3D(sx, sz);
                  const variant = h2 % 2;
                  const crate = createVoxelRoadSupply3D(variant, 1.05);
                  crate.position.set(sx, sy - 0.02, sz);
                  crate.rotation.y = Math.atan2(-perpX * side, -perpZ * side);
                  floraGroup.add(crate);
                  objsRoad.push(crate);

                  const nid = `road_supply_${gx}_${gz}`;
                  worldInteractNodes.set(nid, {
                    id: nid,
                    kind: 'road_supply',
                    x: sx,
                    y: sy,
                    z: sz,
                    mesh: crate,
                    baseScaleX: crate.scale.x,
                    baseScaleY: crate.scale.y,
                    hp: 1,
                    maxHp: 1,
                    cooldown: 0,
                    label: variant === 0 ? '开启公路训练家补给箱' : '拾取遗失的超级补给箱',
                    icon: variant === 0 ? '/sprites/items/poke-ball.png' : '/sprites/items/great-ball.png',
                  });
                  nodeIdsRoad.push(nid);
                  spawnedThisFrame += 1;
                } else {
                  // Trail signpost standing OUTSIDE the asphalt shoulder (`halfW + 2.4m`) facing the road!
                  const sx = hwyProj.qx + perpX * side * (hwyHalfW + 2.4);
                  const sz = hwyProj.qz + perpZ * side * (hwyHalfW + 2.4);
                  const sy = getTerrainHeight3D(sx, sz);
                  if (sy > WATER_LEVEL_3D + 0.35) {
                    const sg = createVoxelSignpost3D(1.05);
                    sg.position.set(sx, sy - 0.04, sz);
                    sg.rotation.y = Math.atan2(-perpX * side, -perpZ * side);
                    floraGroup.add(sg);
                    objsRoad.push(sg);
                    const nid = `sign_${gx}_${gz}`;
                    worldInteractNodes.set(nid, {
                      id: nid,
                      kind: 'signpost',
                      x: sx,
                      y: sy,
                      z: sz,
                      mesh: sg,
                      baseScaleX: sg.scale.x,
                      baseScaleY: sg.scale.y,
                      hp: 1,
                      maxHp: 1,
                      cooldown: 0,
                      label: '阅读公路里程木牌',
                      icon: '/sprites/items/poke-radar.png',
                    });
                    nodeIdsRoad.push(nid);
                    spawnedThisFrame += 1;
                  }
                }
              }
            }
            placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: objsRoad, bbs: [], nodeIds: nodeIdsRoad });
          } else if (!existing) {
            placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
          } else {
            existing.tier = wantTier;
          }
          continue;
        }

        const modX = ((wx % WORLD_SECTOR_SIZE) + WORLD_SECTOR_SIZE) % WORLD_SECTOR_SIZE;
        const modZ = ((wz % WORLD_SECTOR_SIZE) + WORLD_SECTOR_SIZE) % WORLD_SECTOR_SIZE;
        if (modX < 4.5 || modX > WORLD_SECTOR_SIZE - 4.5 || modZ < 4.5 || modZ > WORLD_SECTOR_SIZE - 4.5) {
          if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
          else existing.tier = wantTier;
          continue;
        }

        const gy = getTerrainHeight3D(wx, wz);
        // Shallow organic lake/river shoreline: gentle floating lily pads, lotus & swaying cattail reeds (50% lighter density!)
        if (gy < WATER_LEVEL_3D + 0.16) {
          if (!existing && wantTier === 'full') {
            const objsW: THREE.Object3D[] = [];
            const bbsW: THREE.Mesh[] = [];
            const liliesW: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
            const nearShore =
              getTerrainHeight3D(wx + 4.0, wz) > WATER_LEVEL_3D + 0.04 ||
              getTerrainHeight3D(wx - 4.0, wz) > WATER_LEVEL_3D + 0.04 ||
              getTerrainHeight3D(wx, wz + 4.0) > WATER_LEVEL_3D + 0.04 ||
              getTerrainHeight3D(wx, wz - 4.0) > WATER_LEVEL_3D + 0.04;
            if (nearShore && gy < WATER_LEVEL_3D - 0.05 && h < 20) {
              const isLotus = h % 3 === 0;
              const padMesh = new THREE.Mesh(lilyGeo, isLotus ? lotusMat : lilyMat);
              const sz = (isLotus ? 1.45 : 1.25) + (h % 3) * 0.22;
              padMesh.scale.set(sz, 1, sz);
              padMesh.rotation.y = (h * 1.37) % (Math.PI * 2);
              const baseY = WATER_LEVEL_3D + 0.045;
              padMesh.position.set(wx + ((h % 3) - 1) * 0.55, baseY, wz + (((h >> 2) % 3) - 1) * 0.55);
              floraGroup.add(padMesh);
              objsW.push(padMesh);
              const lpObj = { mesh: padMesh, baseY, phase: wx * 0.32 + wz * 0.24 };
              floatingLilyPads.add(lpObj);
              liliesW.push(lpObj);
            } else if (nearShore && gy >= WATER_LEVEL_3D - 0.16 && h >= 20 && h < 36) {
              const reedMesh = new THREE.Mesh(UPRIGHT_QUAD_GEO, cattailMat);
              reedMesh.rotation.order = 'YXZ';
              const rs = 1.6 + (h % 3) * 0.24;
              reedMesh.scale.set((h & 1) === 1 ? -rs : rs, rs * 1.12, 1);
              reedMesh.position.set(wx, Math.max(WATER_LEVEL_3D - 0.1, gy) - 0.04, wz);
              reedMesh.userData.swayAmp = 0.075;
              reedMesh.userData.swayFreq = 2.4;
              reedMesh.userData.swayPhase = wx * 0.25 + wz * 0.18;
              floraGroup.add(reedMesh);
              floraBillboards.add(reedMesh);
              objsW.push(reedMesh);
              bbsW.push(reedMesh);
            }
            placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: objsW, bbs: bbsW, nodeIds: [], lilies: liliesW });
          } else if (!existing) {
            placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
          } else {
            existing.tier = wantTier;
          }
          continue;
        }

        const slope = Math.max(
          Math.abs(getTerrainHeight3D(wx + 1.2, wz) - gy),
          Math.abs(getTerrainHeight3D(wx, wz + 1.2) - gy),
        );
        if (slope > 0.62) {
          if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
          else existing.tier = wantTier;
          continue;
        }

        // Smooth macro-habitat noise fields (creates natural woods, open grassy glades, rocky hillsides & wildflower meadows
        // at ~45% of the previous overall density so landscapes look authentic & breathable!)
        const groveNoise = Math.sin(wx * 0.048 + wz * 0.036) + Math.cos(wx * 0.029 - wz * 0.052);
        const speciesPatch =
          Math.sin(wx * 0.019 - wz * 0.014 + 1.3) * 0.65 + Math.cos(wx * 0.012 + wz * 0.021 - 0.7) * 0.35;
        const rockPatch = Math.sin(wx * 0.041 - wz * 0.047 + 4.2) + Math.cos(wx * 0.033 + wz * 0.028);
        const flowerMeadow = Math.sin(wx * 0.065 - wz * 0.055 + 2.1);

        const objs = existing ? existing.objs : [];
        const bbs = existing ? existing.bbs : [];
        const nodeIds = existing ? existing.nodeIds : [];
        const isUpgradeFromFar = Boolean(existing);

        const localBiomeCell = getSeamlessBiomeAt3D(wx, wz, gy, selectedBiome);
        const localTexCell = getBiomeTextures(localBiomeCell);

        // 1. NATURAL WOODLAND GROVES (~9.5% of cells vs ~23% previously, with coherent grove tree species!)
        const isTreeCell =
          ((groveNoise > 0.45 && h < 16) || (groveNoise > -0.15 && h < 5)) &&
          (gy > 0.42 || Math.hypot(wx, wz) > 10.5);

        if (isTreeCell) {
          const tx = wx + ((h % 3) - 1) * 0.55;
          const tz = wz + (((h >> 2) % 3) - 1) * 0.55;
          if (!isNearAnyRoadOrRailForFlora3D(tx, tz, 1.5)) {
            if (!isUpgradeFromFar) {
              const spriteCount = localTexCell.treeSprites.length;
              const domIdx =
                Math.floor(((speciesPatch + 1.0) * 0.5) * spriteCount * 1.99) % Math.max(1, spriteCount);
              // 85% cohesive grove species, 15% natural neighbor variation!
              const vIdx = h2 < 85 ? domIdx : (domIdx + 1) % Math.max(1, spriteCount);
              const { group: tree, billboard: treeBb } = createLushTreeSprite3D(
                getSharedFloraMat(localTexCell.treeSprites[vIdx], 0.12),
                vIdx,
                (h2 & 1) === 1,
              );
              treeBb.rotation.set(
                lastBbPitch < 100 ? -lastBbPitch * BILLBOARD_PITCH_TILT : -0.24 * BILLBOARD_PITCH_TILT,
                lastBbYaw < 100 ? lastBbYaw : 0,
                0,
              );
              treeBb.userData.swayAmp = 0.026;
              treeBb.userData.swayFreq = 1.65 + (h2 % 4) * 0.15;
              treeBb.userData.swayPhase = tx * 0.22 + tz * 0.16;
              const treeScale = 0.86 + (h2 % 4) * 0.1;
              tree.position.set(tx, gy - 0.04, tz);
              tree.scale.setScalar(treeScale);
              floraGroup.add(tree);
              floraBillboards.add(treeBb);
              objs.push(tree);
              bbs.push(treeBb);

              if (h2 % 4 === 0) {
                const berryMesh = makeUprightProp(
                  tex.berryCluster,
                  1.12,
                  1.12,
                  tx + 0.15,
                  gy + 2.4 * treeScale,
                  tz + 0.28,
                  0.12,
                  0.045,
                  1.9,
                );
                objs.push(berryMesh);
                bbs.push(berryMesh);
                const nid = `berry_${gx}_${gz}`;
                worldInteractNodes.set(nid, {
                  id: nid,
                  kind: 'berry_tree',
                  x: tx,
                  y: gy,
                  z: tz,
                  mesh: treeBb,
                  extraMesh: berryMesh,
                  baseScaleX: treeBb.scale.x,
                  baseScaleY: treeBb.scale.y,
                  hp: 1,
                  maxHp: 1,
                  cooldown: 0,
                  label: '摇树摘取树果',
                  icon: '/sprites/items/oran-berry.png',
                });
                nodeIds.push(nid);
              }
            }
            // Subtle understory mushroom (only ~20% of trees instead of 50% × 2!)
            if (wantTier === 'full' && h2 % 5 === 1) {
              const ma = h2 * 0.7;
              const mx = tx + Math.cos(ma) * 1.5;
              const mz = tz + Math.sin(ma) * 1.5;
              if (!isNearAnyRoadOrRailForFlora3D(mx, mz, 1.0)) {
                const my = getTerrainHeight3D(mx, mz);
                const mTex = tex.mushrooms[h2 % tex.mushrooms.length];
                const mScale = 1.48;
                const ms = makeUprightProp(
                  mTex,
                  (h2 & 1) === 1 ? -mScale : mScale,
                  mScale,
                  mx,
                  my,
                  mz,
                  0.15,
                  0.022,
                  2.3,
                );
                objs.push(ms);
                bbs.push(ms);
                const nid = `mush_${gx}_${gz}`;
                worldInteractNodes.set(nid, {
                  id: nid,
                  kind: 'mushroom',
                  x: mx,
                  y: my,
                  z: mz,
                  mesh: ms,
                  baseScaleX: ms.scale.x,
                  baseScaleY: ms.scale.y,
                  hp: 1,
                  maxHp: 1,
                  cooldown: 0,
                  label: '采摘野生蘑菇',
                  icon: '/sprites/items/oran-berry.png',
                });
                nodeIds.push(nid);
              }
            }
          }
        } else if ((rockPatch > 0.68 || slope > 0.24) && h >= 20 && h < 24) {
          // 2. ROCKY OUTCROP CLUSTERS (~1.6% overall, strictly on slopes & rocky ridges instead of random flat grass!)
          if (!isUpgradeFromFar) {
            const rs = 0.85 + (h2 % 3) * 0.15;
            const bIdx = h2 % 4;
            const isMineable = bIdx === 2 || h2 % 3 === 0;
            const rx = wx + 0.25;
            const rz = wz - 0.2;
            const rk = createVoxelBoulder3D(bIdx, isMineable, rs);
            rk.position.set(rx, gy - 0.06, rz);
            rk.rotation.y = ((h2 % 4) * Math.PI) / 2;
            floraGroup.add(rk);
            objs.push(rk);
            if (isMineable) {
              const nid = `ore_${gx}_${gz}`;
              worldInteractNodes.set(nid, {
                id: nid,
                kind: 'ore_rock',
                x: rx,
                y: gy,
                z: rz,
                mesh: rk,
                baseScaleX: rk.scale.x,
                baseScaleY: rk.scale.y,
                hp: 3,
                maxHp: 3,
                cooldown: 0,
                label: bIdx === 2 ? '敲碎体素晶簇矿石' : '凿碎苔藓体素矿岩',
                icon: '/sprites/items/bright-powder.png',
              });
              nodeIds.push(nid);
            }
          }
        } else if (groveNoise > 0.15 && h >= 24 && h < 28) {
          // 3. SHRUBS ALONG WOODLAND EDGES (~2.5% vs 8% previously)
          if (!isUpgradeFromFar) {
            const bushTex = tex.bushes[h2 % tex.bushes.length];
            const bScale = 1.75 + (h2 % 3) * 0.18;
            const bs = makeUprightProp(
              bushTex,
              (h2 & 1) === 1 ? -bScale : bScale,
              bScale * 0.88,
              wx,
              gy,
              wz,
              0.15,
              0.048,
              2.2,
            );
            objs.push(bs);
            bbs.push(bs);
          }
        } else if (wantTier === 'full') {
          // 4. BREATHABLE MEADOW DETAILS (Cut by >50% so ~64% of cells remain clean natural grass/earth!)
          if (groveNoise > 0.35 && h === 29) {
            const st = makeUprightProp(tex.stump, 1.5, 1.4, wx - 0.2, gy, wz + 0.2, 0.14);
            objs.push(st);
            bbs.push(st);
          } else if (h >= 31 && h < 36) {
            const gCount = 1 + (h2 % 2);
            for (let gi = 0; gi < gCount; gi++) {
              const gxOff = (gi - 0.3) * 0.85;
              const gzOff = ((gi % 2) - 0.3) * 0.65;
              if (isNearAnyRoadOrRailForFlora3D(wx + gxOff, wz + gzOff, 0.5)) continue;
              const ts = 1.5 + ((h2 + gi) % 3) * 0.18;
              const tg = makeUprightProp(
                tex.tallGrass,
                ((h2 + gi) & 1) === 1 ? -ts : ts,
                ts * 0.9,
                wx + gxOff,
                getTerrainHeight3D(wx + gxOff, wz + gzOff),
                wz + gzOff,
                0.14,
                0.072,
                2.7 + (gi % 2) * 0.35,
              );
              objs.push(tg);
              bbs.push(tg);
            }
          } else if (flowerMeadow > 0.42 && h >= 36 && h < 45) {
            const flCount = 1 + (h2 % 2);
            for (let fi = 0; fi < flCount; fi++) {
              const fa = (fi * Math.PI * 2) / flCount + h2;
              const fx = wx + Math.cos(fa) * 0.68;
              const fz = wz + Math.sin(fa) * 0.68;
              if (isNearAnyRoadOrRailForFlora3D(fx, fz, 0.5)) continue;
              const fTex = tex.flowers[(h2 + fi) % tex.flowers.length];
              const fScale = 1.48 + ((h2 + fi) % 3) * 0.16;
              const fl = makeUprightProp(
                fTex,
                ((h2 + fi) & 1) === 1 ? -fScale : fScale,
                fScale * 0.78,
                fx,
                getTerrainHeight3D(fx, fz),
                fz,
                0.15,
                0.056,
                2.5,
              );
              objs.push(fl);
              bbs.push(fl);
            }
          } else if (groveNoise > 0.25 && h >= 45 && h < 47) {
            const mScale = 1.48 + (h2 % 2) * 0.18;
            const mx = wx + 0.2;
            const mz = wz + 0.2;
            const ms = makeUprightProp(
              tex.mushrooms[h2 % tex.mushrooms.length],
              (h2 & 1) === 1 ? -mScale : mScale,
              mScale,
              mx,
              gy,
              mz,
              0.15,
              0.025,
              2.3,
            );
            objs.push(ms);
            bbs.push(ms);
            const nid = `mush_open_${gx}_${gz}`;
            worldInteractNodes.set(nid, {
              id: nid,
              kind: 'mushroom',
              x: mx,
              y: gy,
              z: mz,
              mesh: ms,
              baseScaleX: ms.scale.x,
              baseScaleY: ms.scale.y,
              hp: 1,
              maxHp: 1,
              cooldown: 0,
              label: '采摘野生蘑菇',
              icon: '/sprites/items/oran-berry.png',
            });
            nodeIds.push(nid);
          } else if (h >= 47 && h < 50) {
            const gt = makeUprightProp(tex.grassTuft, 1.2, 1.05, wx + 0.2, gy, wz + 0.2, 0.15, 0.068, 2.8);
            objs.push(gt);
            bbs.push(gt);
          }
        }

        if (existing) {
          existing.tier = wantTier;
        } else {
          placedFloraCells.set(key, { gx, gz, tier: wantTier, objs, bbs, nodeIds });
        }
        if (objs.length > 0) spawnedThisFrame += 1;
      }
    }
  };

  return { floraBillboards, syncFloraBillboards, worldInteractNodes, placedFloraCells, updateWorldAround };
}
