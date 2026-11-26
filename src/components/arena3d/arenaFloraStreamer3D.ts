import type { ArenaSharedCtx } from './arenaTypesAndProps';
import * as THREE from 'three';
import { getBiomeTextures, getSeamlessBiomeAt3D } from '../../data/worldTextures3D';
import { TERRACE_CELL, WATER_LEVEL_3D, WORLD_SECTOR_SIZE, getTerrainHeight3D, isOnInterTownRoad3D } from '../../data/survivorsTactics';
import { BILLBOARD_PITCH_TILT, UPRIGHT_QUAD_GEO, createLushTreeSprite3D } from './arenaTypesAndProps';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function createArenaFloraStreamer3D(rawCtx: Record<string, any>) {
  const { chunkState, cattailMat, floatingLilyPads, floraGroup, isInsideAnyTownPlaza, lilyGeo, lilyMat, lotusMat, prefsRef, selectedBiome, terrainGeo, terrainMesh, terrainPosAttr, tex, waterPlaneMesh } = rawCtx as ArenaSharedCtx;
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
    let windClock = 0;
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
      kind: 'mushroom' | 'berry_tree' | 'ore_rock' | 'signpost';
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

    const updateWorldAround = (cx: number, cz: number) => {
      const snapX = Math.round(cx / 4) * 4;
      const snapZ = Math.round(cz / 4) * 4;
      if (snapX === chunkState.x && snapZ === chunkState.z) return;
      chunkState.x = snapX;
      chunkState.z = snapZ;

      terrainMesh.position.set(snapX, 0, snapZ);
      waterPlaneMesh.position.set(snapX, WATER_LEVEL_3D, snapZ);
      for (let i = 0; i < terrainPosAttr.count; i++) {
        const wx = terrainPosAttr.getX(i) + snapX;
        const wz = terrainPosAttr.getZ(i) + snapZ;
        terrainPosAttr.setY(i, getTerrainHeight3D(wx, wz));
      }
      terrainPosAttr.needsUpdate = true;
      terrainGeo.computeVertexNormals();

      // 2-Tier LOD Streaming across the ENTIRE 148x148m visible terrain (zero bare distant hills!):
      // - Near Ring (<= 12 cells / ~38m): full trees + boulders + bushes + mushrooms + wildflowers + tall grass + stumps
      // - Far Ring (13..23 cells / 38..74m): ALL trees + boulders + bushes so distant hills stay lushly forested!
      // - Cull Ring (> 26 cells / >83m): recycle cells behind player for rock-solid 60 FPS!
      const gx0 = Math.round(cx / TERRACE_CELL);
      const gz0 = Math.round(cz / TERRACE_CELL);
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

      for (let dz = -FAR_R; dz <= FAR_R; dz++) {
        for (let dx = -FAR_R; dx <= FAR_R; dx++) {
          const distCell = Math.max(Math.abs(dx), Math.abs(dz));
          const wantTier: 'far' | 'full' = distCell <= NEAR_R ? 'full' : 'far';
          const gx = gx0 + dx;
          const gz = gz0 + dz;
          const key = `${gx},${gz}`;
          const existing = placedFloraCells.get(key);
          if (existing && (existing.tier === 'full' || wantTier === 'far')) continue;

          const wx = gx * TERRACE_CELL;
          const wz = gz * TERRACE_CELL;
          if (Math.hypot(wx, wz) < 5.5 || isInsideAnyTownPlaza(wx, wz, 2.5) || isOnInterTownRoad3D(wx, wz, 5.4)) {
            if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
            else existing.tier = wantTier;
            continue;
          }
          const modX = ((wx % WORLD_SECTOR_SIZE) + WORLD_SECTOR_SIZE) % WORLD_SECTOR_SIZE;
          const modZ = ((wz % WORLD_SECTOR_SIZE) + WORLD_SECTOR_SIZE) % WORLD_SECTOR_SIZE;
          if (modX < 4.5 || modX > WORLD_SECTOR_SIZE - 4.5 || modZ < 4.5 || modZ > WORLD_SECTOR_SIZE - 4.5) {
            if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
            else existing.tier = wantTier;
            continue;
          }

          const h = Math.abs(Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663)) % 100;
          const gy = getTerrainHeight3D(wx, wz);
          // Shallow organic lake/river shoreline: dynamically spawn floating pixel lily pads, pink lotus & swaying cattail reeds!
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
              if (nearShore && gy < WATER_LEVEL_3D - 0.05 && h < 42) {
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
              } else if (nearShore && gy >= WATER_LEVEL_3D - 0.16 && h >= 42 && h < 74) {
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
          if (slope > 0.55) {
            if (!existing) placedFloraCells.set(key, { gx, gz, tier: wantTier, objs: [], bbs: [], nodeIds: [] });
            else existing.tier = wantTier;
            continue;
          }

          const h2 = Math.abs(Math.imul(gx + 37, 2654435761) ^ Math.imul(gz - 19, 2246822519)) % 100;
          const groveNoise = Math.sin(wx * 0.08 + wz * 0.05) + Math.cos(wx * 0.04 - wz * 0.09);
          const flowerMeadow = Math.sin(wx * 0.11 - wz * 0.08 + 2.1);

          const objs = existing ? existing.objs : [];
          const bbs = existing ? existing.bbs : [];
          const nodeIds = existing ? existing.nodeIds : [];
          const isUpgradeFromFar = Boolean(existing);

          // MACRO LANDMARKS (Minecraft-style local biome props: snowy pines, desert cacti, volcanic rocks, coastal palms, lush oaks!)
          const localBiomeCell = getSeamlessBiomeAt3D(wx, wz, gy, selectedBiome);
          const localTexCell = getBiomeTextures(localBiomeCell);
          const isTreeCell = (h < 15 || (groveNoise > 0.65 && h < 26)) && (gy > 0.45 || Math.hypot(wx, wz) > 9.5);
          if (isTreeCell) {
            const tx = wx + ((h % 3) - 1) * 0.55;
            const tz = wz + (((h >> 2) % 3) - 1) * 0.55;
            if (!isUpgradeFromFar) {
              const vIdx = h2 % localTexCell.treeSprites.length;
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
              // Gentle organic breeze canopy sway!
              treeBb.userData.swayAmp = 0.026;
              treeBb.userData.swayFreq = 1.65 + (h2 % 4) * 0.15;
              treeBb.userData.swayPhase = tx * 0.22 + tz * 0.16;
              const treeScale = 0.84 + (h2 % 5) * 0.11;
              tree.position.set(tx, gy - 0.04, tz);
              tree.scale.setScalar(treeScale);
              floraGroup.add(tree);
              floraBillboards.add(treeBb);
              objs.push(tree);
              bbs.push(treeBb);

              // Every 3rd tree bears glowing pickable berries hanging in the canopy!
              if (h2 % 3 === 0) {
                const berryMesh = makeUprightProp(
                  tex.berryCluster,
                  1.15,
                  1.15,
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
            // Understory interactive mushroom cluster only added in Near ('full') ring!
            if (wantTier === 'full' && h2 % 2 === 0) {
              const mCount = 1 + (h2 % 2);
              for (let mi = 0; mi < mCount; mi++) {
                const ma = mi * 2.4 + h2;
                const mx = tx + Math.cos(ma) * (1.45 + mi * 0.55);
                const mz = tz + Math.sin(ma) * (1.45 + mi * 0.55);
                const my = getTerrainHeight3D(mx, mz);
                const mTex = tex.mushrooms[(h2 + mi) % tex.mushrooms.length];
                const mScale = 1.5 + (mi % 2) * 0.3;
                const ms = makeUprightProp(
                  mTex,
                  ((h2 + mi) & 1) === 1 ? -mScale : mScale,
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
                if (mi === 0) {
                  const nid = `mush_${gx}_${gz}_${mi}`;
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
          } else if (h >= 26 && h < 33) {
            if (!isUpgradeFromFar) {
              const rs = 1.7 + (h2 % 4) * 0.28;
              const bIdx = h2 % tex.boulders.length;
              const bTex = tex.boulders[bIdx];
              const rx = wx + 0.3;
              const rz = wz - 0.2;
              const rk = makeUprightProp(
                bTex,
                (h2 & 1) === 1 ? -rs : rs,
                rs * 0.86,
                rx,
                gy,
                rz,
                0.14,
              );
              objs.push(rk);
              bbs.push(rk);
              // Crystal/ore boulders (or every 2nd rock) are interactive mineable ore veins!
              if (bIdx === 2 || h2 % 2 === 0) {
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
                  label: bIdx === 2 ? '敲碎结晶矿石' : '凿碎苔藓矿岩',
                  icon: '/sprites/items/bright-powder.png',
                });
                nodeIds.push(nid);
              }
            }
          } else if (h >= 74 && h < 82) {
            if (!isUpgradeFromFar) {
              const bushTex = tex.bushes[h2 % tex.bushes.length];
              const bScale = 1.82 + (h2 % 3) * 0.22;
              const bs = makeUprightProp(bushTex, (h2 & 1) === 1 ? -bScale : bScale, bScale * 0.88, wx, gy, wz, 0.15, 0.048, 2.2);
              objs.push(bs);
              bbs.push(bs);
            }
          } else if (wantTier === 'full') {
            // MICRO GROUND DETAILS (Stumps, Interactive Wooden Signposts, Swaying Ferns, Wildflowers, Pickable Mushrooms!)
            if (h >= 33 && h < 38) {
              const st = makeUprightProp(tex.stump, 1.58, 1.48, wx - 0.2, gy, wz + 0.2, 0.14);
              objs.push(st);
              bbs.push(st);
            } else if (h >= 38 && h < 41) {
              const sg = makeUprightProp(tex.signpost, 1.85, 2.0, wx, gy, wz, 0.14);
              objs.push(sg);
              bbs.push(sg);
              const nid = `sign_${gx}_${gz}`;
              worldInteractNodes.set(nid, {
                id: nid,
                kind: 'signpost',
                x: wx,
                y: gy,
                z: wz,
                mesh: sg,
                baseScaleX: sg.scale.x,
                baseScaleY: sg.scale.y,
                hp: 1,
                maxHp: 1,
                cooldown: 0,
                label: '阅读木质路牌',
                icon: '/sprites/items/poke-radar.png',
              });
              nodeIds.push(nid);
            } else if (h >= 41 && h < 53) {
              const gCount = 2 + (h2 % 2);
              for (let gi = 0; gi < gCount; gi++) {
                const gxOff = (gi - 0.5) * 0.95;
                const gzOff = ((gi % 2) - 0.5) * 0.72;
                const ts = 1.56 + ((h2 + gi) % 3) * 0.22;
                const tg = makeUprightProp(
                  tex.tallGrass,
                  ((h2 + gi) & 1) === 1 ? -ts : ts,
                  ts * 0.92,
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
            } else if (flowerMeadow > 0.25 && h >= 53 && h < 74) {
              const flCount = 2 + (h2 % 2);
              for (let fi = 0; fi < flCount; fi++) {
                const fa = (fi * Math.PI * 2) / flCount + h2;
                const fx = wx + Math.cos(fa) * (0.75 + (fi % 2) * 0.6);
                const fz = wz + Math.sin(fa) * (0.75 + (fi % 2) * 0.6);
                const fTex = tex.flowers[(h2 + fi * 2) % tex.flowers.length];
                const fScale = 1.56 + ((h2 + fi) % 3) * 0.2;
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
            } else if (h >= 82 && h < 90) {
              const mScale = 1.52 + (h2 % 3) * 0.2;
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
            } else if (h >= 90 && h < 96) {
              const gt = makeUprightProp(tex.grassTuft, 1.25, 1.1, wx + 0.2, gy, wz + 0.2, 0.15, 0.068, 2.8);
              objs.push(gt);
              bbs.push(gt);
            }
          }

          if (existing) {
            existing.tier = wantTier;
          } else {
            placedFloraCells.set(key, { gx, gz, tier: wantTier, objs, bbs, nodeIds });
          }
        }
      }
    };

  return { floraBillboards, syncFloraBillboards, worldInteractNodes, placedFloraCells, updateWorldAround };
}
