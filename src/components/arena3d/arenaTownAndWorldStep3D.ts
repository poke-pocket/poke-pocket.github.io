import type { FacingDir } from '../../data/overworldTiles';
import type { ArenaSharedCtx } from './arenaTypesAndProps';
import * as THREE from 'three';
import { sampleHumanWalkFrame } from '../../data/worldTextures3D';
import { LAKE_BASINS_3D, WATER_LEVEL_3D, getTerrainHeight3D, getWalkableSurfaceHeight3D } from '../../data/survivorsTactics';
import { getActiveGeoTerrainOrigin, worldToGeo } from '../../data/geoTerrain3D';
import { updateProximityAutoDoors3D } from '../../utils/architecturalBuildings3D';
import { isInsideBuildingInterior, resolveTownWallCollisions, type EnterableBuildingInterior, type ProceduralTownInstance, type TownInteractPoint } from '../../utils/townBuilder3D';
import { sound } from '../../utils/sound';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function stepArenaTownAndWorldNodes3D(rawCtx: Record<string, any>) {
  const { WEATHER_PARTICLE_COUNT, activeTownIdRef, activeZone, applyLiveSolarAtmosphere, bbTiltX, camFwdX, camFwdZ, camRightX, camRightZ, camYawNow, damageEnemy3D, dt, groundY, heroFrames, liveWeatherRef, mLen, metaBonusesRef, metaRef, now, onHealParty, onUpdateMeta, persistState, playerShadow, playerSprite, playerSpriteMat, prefsRef, proceduralTowns, safeZoneMeshes, setInRunTownShopOpen, setWorldMapOpen, showBanner, sim, spawnGroundDecalWave, spawnPixelParticles, spawnSkillProjectile3D, sun, surfingNow, syncSafeZones3D, triggerInteractRef, updateWorldAround, vfxAtlas, weatherGeo, weatherMat, weatherPoints, windClock, worldInteractNodes } = rawCtx as ArenaSharedCtx;
          // Animate live 3D Weather Particles (Rain / Storm / Snow) + Procedural Town Trains + Town Colliders!
          const curWeatherKind = liveWeatherRef.current.kind;
          const isPrecip = curWeatherKind === 'rain' || curWeatherKind === 'storm' || curWeatherKind === 'snow';
          weatherPoints.visible = isPrecip;
          if (isPrecip) {
            weatherMat.color.setHex(
              curWeatherKind === 'snow' ? 0xffffff : curWeatherKind === 'storm' ? 0x748ffc : 0xa5d8ff,
            );
            weatherMat.size = curWeatherKind === 'snow' ? 0.36 : 0.28;
            const posAttr = weatherGeo.getAttribute('position') as THREE.BufferAttribute;
            const fallSpeed = curWeatherKind === 'snow' ? 3.2 : curWeatherKind === 'storm' ? 24 : 18;
            const driftX = curWeatherKind === 'snow' ? Math.sin(windClock * 1.4) * 1.6 : curWeatherKind === 'storm' ? 4.5 : 1.8;
            for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
              let px = posAttr.getX(i) + driftX * dt;
              let py = posAttr.getY(i) - fallSpeed * dt;
              let pz = posAttr.getZ(i);
              if (py < 0.2) {
                py = 16 + Math.random() * 6;
                px = (Math.random() - 0.5) * 44;
                pz = (Math.random() - 0.5) * 44;
              }
              posAttr.setXYZ(i, px, py, pz);
            }
            posAttr.needsUpdate = true;
            weatherPoints.position.set(sim.px, sim.py, sim.pz);
          }
          // Real Astronomical Lat/Lng Day-Night & Sunrise-Sunset Lighting + Weather Adaptation!
          const liveGeo = worldToGeo(sim.px, sim.pz);
          const tourCoords = metaRef.current.worldTour?.homeCoords;
          applyLiveSolarAtmosphere(
            liveGeo?.lat ?? tourCoords?.lat ?? 31.23,
            liveGeo?.lng ?? tourCoords?.lng ?? 121.47,
            sim.px,
            sim.py,
            sim.pz,
            dt,
            Date.now(),
          );

          // Periodically save player world coordinates so re-entering resumes at last exit spot!
          if (!getActiveGeoTerrainOrigin() && now - persistState.lastAt > 2000) {
            persistState.lastAt = now;
            try {
              window.localStorage.setItem(
                'pocket_paw_last_world_pos_v1',
                JSON.stringify({ x: Number(sim.px.toFixed(1)), z: Number(sim.pz.toFixed(1)) }),
              );
            } catch {
              // ignore
            }
          }

          let closestTownPoint: TownInteractPoint | null = null;
          let closestTownDist = 999;
          let activeTownNow: ProceduralTownInstance | null = null;
          let activeInteriorNow: EnterableBuildingInterior | null = null;
          for (const town of proceduralTowns) {
            if (town.trainGroup && town.trainBaseX !== undefined) {
              town.trainGroup.position.x = town.trainBaseX + Math.sin(windClock * 0.28) * 6.5;
            }
            if (town.animatedParts) {
              for (const sp of town.animatedParts.spinners) {
                sp.rotation.y = windClock * 1.1;
              }
              for (const ft of town.animatedParts.fountains) {
                ft.scale.y = 0.85 + Math.sin(windClock * 5.2) * 0.22;
              }
              for (const bb of town.animatedParts.billboards) {
                bb.rotation.set(bbTiltX, camYawNow, 0, 'YXZ');
              }
              // Live boulevard pixel traffic!
              for (const v of town.animatedParts.vehicles) {
                v.coord += v.dir * v.speed * dt;
                if (v.dir > 0 && v.coord > v.maxCoord) v.coord = v.minCoord;
                else if (v.dir < 0 && v.coord < v.minCoord) v.coord = v.maxCoord;
                if (v.axis === 'z') {
                  v.group.position.x = v.laneOffset;
                  v.group.position.z = v.coord;
                } else {
                  v.group.position.x = v.coord;
                  v.group.position.z = v.laneOffset;
                }
                const wy = getTerrainHeight3D(town.centerX + v.group.position.x, town.centerZ + v.group.position.z);
                v.group.position.y = wy - town.group.position.y + 0.16;
              }
              // Strolling GBA chibi pixel citizens (Plaza & Sidewalk Pedestrians!) with authentic 4-direction leg stride animations
              for (const w of town.animatedParts.walkers) {
                w.angle += w.speed * dt;
                w.phase += dt * 6.4;
                let wxLocal: number;
                let wzLocal: number;
                let wDirX: number;
                let wDirZ: number;
                if (
                  w.mode === 'sidewalk_patrol' &&
                  w.x1 !== undefined &&
                  w.z1 !== undefined &&
                  w.x2 !== undefined &&
                  w.z2 !== undefined
                ) {
                  const t = 0.5 + 0.5 * Math.sin(w.angle);
                  wxLocal = w.x1 + (w.x2 - w.x1) * t;
                  wzLocal = w.z1 + (w.z2 - w.z1) * t;
                  const dirSign = Math.cos(w.angle) * w.speed >= 0 ? 1 : -1;
                  const segDx = w.x2 - w.x1;
                  const segDz = w.z2 - w.z1;
                  const segLen = Math.hypot(segDx, segDz) || 1;
                  wDirX = (segDx / segLen) * dirSign;
                  wDirZ = (segDz / segLen) * dirSign;
                } else {
                  wxLocal = w.cx + Math.cos(w.angle) * w.radius;
                  wzLocal = w.cz + Math.sin(w.angle) * w.radius;
                  const sgn = w.speed >= 0 ? 1 : -1;
                  wDirX = -Math.sin(w.angle) * sgn;
                  wDirZ = Math.cos(w.angle) * sgn;
                }
                const wy = getTerrainHeight3D(town.centerX + wxLocal, town.centerZ + wzLocal) - town.group.position.y + 0.22;
                const wRelFwd = wDirX * camFwdX + wDirZ * camFwdZ;
                const wRelRight = wDirX * camRightX + wDirZ * camRightZ;
                if (w.walkFrames) {
                  (w.mesh.material as THREE.MeshBasicMaterial).map = sampleHumanWalkFrame(
                    w.walkFrames,
                    wRelFwd,
                    wRelRight,
                    w.phase,
                    Math.abs(w.speed) > 0.005,
                  );
                }
                w.mesh.position.set(wxLocal, wy, wzLocal);
                // YXZ Euler order + upright human pitch keeps citizens 100% vertical to the ground from every 360° angle!
                w.mesh.rotation.set(bbTiltX * 0.22, camYawNow, 0, 'YXZ');
                w.shadow.position.set(wxLocal, wy + 0.04, wzLocal);
              }
            }
            const distToTown = Math.hypot(sim.px - town.centerX, sim.pz - town.centerZ);
            const collisionRadius = Math.max(town.safeRadius + 60, 740);
            if (distToTown < town.safeRadius) {
              activeTownNow = town;
            }
            if (distToTown < collisionRadius) {
              // Player floor-aware wall & solid 3D furniture collision across 1F & 2F!
              const pPos = { x: sim.px, z: sim.pz };
              resolveTownWallCollisions(pPos, 0.88, town.colliders, sim.py);
              sim.px = pPos.x;
              sim.pz = pPos.z;
              // Re-sample walkable floor/stair height after collision push-out so 2F stairs & slabs stay rock-solid
              const postColFloorY = getWalkableSurfaceHeight3D(sim.px, sim.pz, sim.py);
              if (!surfingNow && sim.vy <= 0 && Math.abs(postColFloorY - sim.py) < 0.85) {
                sim.py = postColFloorY;
              }

              // Proximity-activated 1F & 2F doors: default CLOSED, smoothly slide/swing OPEN when Red or Pikachu walks up!
              const doorActors: { x: number; y: number; z: number }[] = [{ x: sim.px, y: sim.py, z: sim.pz }];
              if (sim.followers[0]) {
                doorActors.push({ x: sim.followers[0].x, y: sim.followers[0].y, z: sim.followers[0].z });
              }
              updateProximityAutoDoors3D(town.autoDoors, doorActors, dt);

              // Keep ALL buildings & elevated viaducts 100% SOLID & OPAQUE (cameraRig3D zooms smoothly inside rooms & under viaducts!)
              for (const bInt of town.interiors) {
                const inside = isInsideBuildingInterior(sim.px, sim.pz, bInt);
                if (inside) activeInteriorNow = bInt;
                bInt.exteriorGroup.visible = true;
                bInt.interiorGroup.visible = true;
                for (let ni = 0; ni < bInt.npcSprites.length; ni++) {
                  const npc = bInt.npcSprites[ni];
                  // Indoor NPCs live inside rotated `shellGroup`: subtract `bInt.rotY` with `'YXZ'` order so they stand 100% vertical!
                  npc.rotation.set(bbTiltX * 0.22, camYawNow - bInt.rotY, 0, 'YXZ');
                  if (npc.userData?.walkFrames) {
                    if (ni > 0) {
                      if (npc.userData.baseX === undefined) {
                        npc.userData.baseX = npc.position.x;
                        npc.userData.baseZ = npc.position.z;
                      }
                      const sAng = windClock * 0.95 + ni * 2.1;
                      const offsetX = Math.sin(sAng) * 1.45;
                      const velSign = Math.cos(sAng) >= 0 ? 1 : -1;
                      npc.position.x = (npc.userData.baseX as number) + offsetX;
                      const wDirX = Math.cos(bInt.rotY) * velSign;
                      const wDirZ = -Math.sin(bInt.rotY) * velSign;
                      const nRelFwd = wDirX * camFwdX + wDirZ * camFwdZ;
                      const nRelRight = wDirX * camRightX + wDirZ * camRightZ;
                      (npc.material as THREE.MeshBasicMaterial).map = sampleHumanWalkFrame(
                        npc.userData.walkFrames as Record<string, THREE.CanvasTexture>,
                        nRelFwd,
                        nRelRight,
                        windClock * 5.8 + ni,
                        true,
                      );
                    } else {
                      (npc.material as THREE.MeshBasicMaterial).map = sampleHumanWalkFrame(
                        npc.userData.walkFrames as Record<string, THREE.CanvasTexture>,
                        camFwdZ,
                        camRightZ,
                        windClock * 1.5,
                        false,
                      );
                    }
                  }
                }
              }

              // Wild Pokémon inside/near town stay completely peaceful & never clip through walls!
              for (const en of sim.enemies) {
                if (en.hp <= 0) continue;
                const ePos = { x: en.x, z: en.z };
                resolveTownWallCollisions(ePos, en.radius + 0.5, town.colliders);
                en.x = ePos.x;
                en.z = ePos.z;
                if (!en.isBoss && Math.hypot(en.x - town.centerX, en.z - town.centerZ) < town.safeRadius + 2) {
                  en.aggroed = false;
                }
              }
              for (const pt of town.interactPoints) {
                const d = Math.hypot(pt.x - sim.px, pt.z - sim.pz);
                if (d < pt.radius && d < closestTownDist) {
                  closestTownDist = d;
                  closestTownPoint = pt;
                }
              }
            }
          }

          const inTownPeaceZone = Boolean(activeTownNow && (prefsRef.current.townPeaceMode ?? true));
          if ((activeTownNow?.id ?? null) !== activeTownIdRef.current) {
            const prevTown = activeTownIdRef.current;
            activeTownIdRef.current = activeTownNow?.id ?? null;
            if (activeTownNow && (prefsRef.current.townPeaceMode ?? true)) {
              showBanner(
                `🏘️ 进入「${activeTownNow.name}」和平区 · 随从已暂收球中，仅领队同行（全员停火）`,
                3000,
              );
            } else if (prevTown && !activeTownNow) {
              showBanner('🌿 已离开城镇 · 全队随从展开出战阵型！', 2200);
            }
          }

          // Tick interactive world nodes (regrow cooldowns & hit-shake timers) + detect closest interactable!
          let closestNode: any = null;
          let closestNodeDist = 4.1;
          for (const node of worldInteractNodes.values()) {
            const st = (node.mesh.userData.shakeTimer as number | undefined) ?? 0;
            if (st > 0) node.mesh.userData.shakeTimer = Math.max(0, st - dt * 2.8);
            if (node.cooldown > 0) {
              node.cooldown = Math.max(0, node.cooldown - dt);
              if (node.cooldown <= 0) {
                node.hp = node.maxHp;
                if (node.kind === 'berry_tree' && node.extraMesh) {
                  node.extraMesh.visible = true;
                } else {
                  node.mesh.visible = true;
                  node.mesh.scale.set(node.baseScaleX, node.baseScaleY, 1);
                }
              }
              continue;
            }
            const nd = Math.hypot(node.x - sim.px, node.z - sim.pz);
            if (nd < closestNodeDist) {
              closestNodeDist = nd;
              closestNode = node;
            }
          }
          triggerInteractRef.current = closestTownPoint
            ? () => {
                const tp = closestTownPoint!;
                if (tp.kind === 'pokemon_center') {
                  sim.hp = sim.maxHp;
                  sim.healCharges = Math.max(sim.healCharges, 4);
                  onHealParty();
                  sound.play('levelup');
                  spawnPixelParticles(sim.px, sim.py + 1.2, sim.pz, vfxAtlas.starGlint, 16, 3.6, 0.85, 5.2, 6.2);
                  showBanner(`🏥 「${tp.townName}」宝可梦中心治疗完毕！全队体力已完全恢复并补满伤药！`, 3200);
                  return;
                }
                if (tp.kind === 'poke_mart') {
                  if (document.pointerLockElement) {
                    try { document.exitPointerLock(); } catch {}
                  }
                  sound.play('confirm');
                  setInRunTownShopOpen(true);
                  return;
                }
                if (tp.kind === 'transit_station') {
                  if (document.pointerLockElement) {
                    try { document.exitPointerLock(); } catch {}
                  }
                  sound.play('confirm');
                  setWorldMapOpen(true);
                  return;
                }
                if (tp.kind === 'hotel_rest') {
                  sim.hp = sim.maxHp;
                  sim.boostTimer = Math.max(sim.boostTimer, 24);
                  onHealParty();
                  sound.play('levelup');
                  showBanner(`🏨 已在「${tp.townName}」驿站酒店休整！全队满血并获 24 秒斗志强化！`, 3200);
                  return;
                }
                if (tp.kind === 'restaurant') {
                  sim.hp = Math.min(sim.maxHp, sim.hp + Math.round(sim.maxHp * 0.45));
                  sim.boostTimer = Math.max(sim.boostTimer, 28);
                  sound.play('happy');
                  showBanner(`🍜 享用了「${tp.townName}」招牌树果料理！全队士气大振（强化 28 秒）！`, 3000);
                  return;
                }
                if (tp.kind === 'npc_chat') {
                  sound.play('cursor');
                  showBanner(tp.dialogText ?? `💬 欢迎来到「${tp.townName}」！`, 4200);
                  return;
                }
              }
            : closestNode
            ? () => {
                const target = closestNode!;
                if (target.cooldown > 0) return;
                if (target.kind === 'signpost') {
                  sound.play('cursor');
                  // Compute live compass direction & distance to nearest Lake!
                  let bestLk = LAKE_BASINS_3D[0];
                  let bestD = 1e9;
                  for (const lk of LAKE_BASINS_3D) {
                    const d = Math.hypot(lk.cx - target.x, lk.cz - target.z);
                    if (d < bestD) { bestD = d; bestLk = lk; }
                  }
                  const dxL = bestLk.cx - target.x;
                  const dzL = bestLk.cz - target.z;
                  const dirTxt = `${dzL < -6 ? '北' : dzL > 6 ? '南' : ''}${dxL > 6 ? '东' : dxL < -6 ? '西' : ''}` || '前方';
                  showBanner(`🪵 路牌指引：向${dirTxt} ${Math.round(bestD)}m 处有清澈湖泊（携带水系可冲浪）；按 TAB 可打开掌机地形地图！`, 3400);
                  return;
                }
                if (target.kind === 'mushroom') {
                  target.cooldown = 38;
                  target.mesh.visible = false;
                  const healAmt = Math.min(Math.round(sim.maxHp - sim.hp), Math.round(sim.maxHp * 0.14));
                  if (healAmt > 0) sim.hp = Math.min(sim.maxHp, sim.hp + healAmt);
                  sim.coins += 22;
                  sim.xp += 20;
                  sound.play('confirm');
                  spawnPixelParticles(target.x, target.y + 0.4, target.z, vfxAtlas.starGlint, 8, 2.4, 0.55, 4.2, 5.0);
                  sim.dmgPops.push({
                    id: sim.nextId++,
                    wx: target.x,
                    wy: target.y + 1.4,
                    wz: target.z,
                    text: healAmt > 0 ? `+22G +${healAmt}HP` : '+22G +20EXP',
                    color: '#ffe066',
                    life: 0.85,
                  });
                  showBanner('🍄 采摘了新鲜野生蘑菇！获得 +22 金币与活力补给！', 2000);
                  return;
                }
                if (target.kind === 'berry_tree') {
                  target.cooldown = 48;
                  target.mesh.userData.shakeTimer = 1.0;
                  if (target.extraMesh) target.extraMesh.visible = false;
                  sim.healCharges = Math.min(9, sim.healCharges + 1);
                  sim.coins += 26;
                  sim.xp += 28;
                  sound.play('happy');
                  spawnPixelParticles(target.x, target.y + 2.1, target.z, vfxAtlas.starGlint, 10, 3.0, 0.72, 4.5, 6.2);
                  sim.dmgPops.push({
                    id: sim.nextId++,
                    wx: target.x,
                    wy: target.y + 2.2,
                    wz: target.z,
                    text: '+1 树果伤药 +26G',
                    color: '#69db7c',
                    life: 0.9,
                  });
                  showBanner('🍎 摇落树上树果！伤药补给 +1，金币 +26！', 2200);
                  return;
                }
                if (target.kind === 'ore_rock') {
                  target.hp -= 1;
                  target.mesh.userData.shakeTimer = 1.0;
                  sound.play('hit');
                  spawnPixelParticles(target.x, target.y + 0.6, target.z, vfxAtlas.starGlint, 7, 2.6, 0.5, 4.8, 6.0);
                  if (target.hp > 0) {
                    const shrink = 0.82 + (target.hp / target.maxHp) * 0.18;
                    target.mesh.scale.set(target.baseScaleX * shrink, target.baseScaleY * shrink, 1);
                    sim.dmgPops.push({
                      id: sim.nextId++,
                      wx: target.x,
                      wy: target.y + 1.3,
                      wz: target.z,
                      text: `敲击矿石 (${target.hp}/${target.maxHp})`,
                      color: '#74c0fc',
                      life: 0.65,
                    });
                  } else {
                    target.cooldown = 65;
                    target.mesh.visible = false;
                    sim.coins += 55;
                    sim.xp += 42;
                    onUpdateMeta?.((prev) => ({ ...prev, stardust: prev.stardust + 10 }));
                    sound.play('levelup');
                    spawnPixelParticles(target.x, target.y + 0.7, target.z, vfxAtlas.starGlint, 14, 3.8, 0.75, 5.8, 7.0);
                    sim.dmgPops.push({
                      id: sim.nextId++,
                      wx: target.x,
                      wy: target.y + 1.6,
                      wz: target.z,
                      text: '+10 星沙 +55G!',
                      color: '#ffe066',
                      life: 0.95,
                    });
                    showBanner('⛏️ 敲碎结晶矿石！收获 星星沙子 +10、金币 +55！', 2400);
                  }
                }
              }
            : null;
          const pFaceX = Math.sin(sim.facingAngle);
          const pFaceZ = Math.cos(sim.facingAngle);
          const pRelFwd = pFaceX * camFwdX + pFaceZ * camFwdZ;
          const pRelRight = pFaceX * camRightX + pFaceZ * camRightZ;
          const dirKey: FacingDir =
            Math.abs(pRelRight) > Math.abs(pRelFwd)
              ? pRelRight >= 0
                ? 'right'
                : 'left'
              : pRelFwd >= 0
                ? 'up'
                : 'down';
          const strideFrame = Math.floor(sim.walkDist * 1.6) % 2;
          const idleFrame = Math.floor(sim.elapsed * 2.2) % 2;
          const isAirborne = sim.py > groundY + 0.22;
          const frameKey = isAirborne
            ? `${dirKey}_jump`
            : mLen > 0.08
              ? `${dirKey}_${strideFrame}`
              : `${dirKey}_idle${idleFrame}`;
          playerSpriteMat.map = heroFrames[frameKey] ?? heroFrames[`${dirKey}_0`] ?? heroFrames.down_idle0;
          const walkBob = mLen > 0.08 && !isAirborne ? Math.abs(Math.sin(sim.walkDist * 2.8)) * 0.16 : 0;
          const walkTiltZ = mLen > 0.08 && !isAirborne ? Math.sin(sim.walkDist * 2.8) * 0.042 : 0;
          playerSprite.position.set(sim.px, sim.py + walkBob + 0.02, sim.pz);
          playerSprite.rotation.set(bbTiltX * 0.35, camYawNow, walkTiltZ, 'YXZ');
          // Crisp pixel footstep dust puffs on avenues/meadows & water ripple splashes when surfing/wading!
          if (mLen > 0.12 && !isAirborne) {
            const prevStepIdx = Math.floor((sim.walkDist - mLen) * 0.42);
            const curStepIdx = Math.floor(sim.walkDist * 0.42);
            if (curStepIdx > prevStepIdx) {
              const terrainBelow = getTerrainHeight3D(sim.px, sim.pz);
              if (terrainBelow < WATER_LEVEL_3D + 0.06 && sim.py <= WATER_LEVEL_3D + 0.6) {
                spawnPixelParticles(sim.px, sim.py - 0.55, sim.pz, vfxAtlas.waterDrop, 3, 2.2, 0.42, 1.8, 9.5);
                spawnGroundDecalWave(sim.px, Math.max(WATER_LEVEL_3D + 0.04, sim.py), sim.pz, vfxAtlas.waterWaveDecal, 2.1, 0.34);
              } else {
                spawnPixelParticles(sim.px, sim.py - 0.62, sim.pz, vfxAtlas.koPuff, 2, 1.35, 0.36, 0.9, 4.2);
              }
            }
          }
          // Keep real-time sun shadow frustum smoothly centered on the player (snapped to 8m grid to prevent frequent shadow-map re-projection spikes!)
          if (sun.castShadow) {
            const sSnapX = Math.round(sim.px / 8) * 8;
            const sSnapZ = Math.round(sim.pz / 8) * 8;
            if (sun.target.position.x !== sSnapX || sun.target.position.z !== sSnapZ) {
              sun.position.set(sSnapX + 34, sim.py + 50, sSnapZ + 28);
              sun.target.position.set(sSnapX, sim.py, sSnapZ);
              sun.target.updateMatrixWorld();
            }
          }
          // Lab Passive HP Regen + Hero Exclusive Periodic Signatures (Red Ball Burst / Misty Tide & Heal / Brock Quake!)
          const cb = metaBonusesRef.current;
          if (cb.regenPerSec > 0 && sim.hp > 0 && sim.hp < sim.maxHp) {
            sim.hp = Math.min(sim.maxHp, sim.hp + cb.regenPerSec * dt);
          }
          if (cb.mistyHealLv > 0 && sim.hp > 0 && sim.hp < sim.maxHp && Math.floor(sim.elapsed / 8) > Math.floor((sim.elapsed - dt) / 8)) {
            const healAmt = Math.round(sim.maxHp * (cb.mistyHealLv * 0.03 * (cb.mistyHealLv >= 5 ? 2 : 1)));
            sim.hp = Math.min(sim.maxHp, sim.hp + healAmt);
            spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.healCircleDecal, 3.6, 0.5);
          }
          if (!inTownPeaceZone && cb.mistyTideLv > 0 && Math.floor(sim.elapsed / (cb.mistyTideLv >= 5 ? 4.2 : 6.0)) > Math.floor((sim.elapsed - dt) / (cb.mistyTideLv >= 5 ? 4.2 : 6.0))) {
            const rad = cb.mistyTideLv >= 5 ? 8.2 : 5.2;
            const dmg = Math.round((40 + cb.mistyTideLv * 18) * sim.atkMult);
            spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.waterWaveDecal, rad * 1.4, 0.45);
            sound.play('water');
            for (const en of sim.enemies) {
              if (en.hp > 0 && Math.hypot(en.x - sim.px, en.z - sim.pz) < rad) {
                damageEnemy3D(en, dmg, '#339af0');
              }
            }
          }
          if (!inTownPeaceZone && cb.redBallLv > 0 && sim.enemies.length > 0 && Math.floor(sim.elapsed / 5.0) > Math.floor((sim.elapsed - dt) / 5.0)) {
            const shots = cb.redBallLv >= 5 ? 3 : 1;
            const near = [...sim.enemies].filter((e) => e.hp > 0).sort((a, b) => Math.hypot(a.x - sim.px, a.z - sim.pz) - Math.hypot(b.x - sim.px, b.z - sim.pz));
            for (let si = 0; si < Math.min(shots, near.length); si++) {
              const t = near[si];
              const a = Math.atan2(t.z - sim.pz, t.x - sim.px);
              spawnSkillProjectile3D({
                x: sim.px,
                y: sim.py + 1.15,
                z: sim.pz,
                vx: Math.cos(a) * 18,
                vz: Math.sin(a) * 18,
                dmg: Math.round((48 + cb.redBallLv * 22) * sim.atkMult),
                radius: 0.7,
                pierce: cb.redBallLv >= 5 ? 4 : 2,
                life: 1.5,
                colorHex: 0xe03131,
                scale: 1.55,
                frames: vfxAtlas.fireball,
              });
            }
            sound.play('pokeball');
          }
          playerSprite.visible = !(sim.invuln > 0 && Math.floor(sim.invuln * 16) % 2 === 0);

          const jumpHeight = Math.max(0, sim.py - groundY);
          playerShadow.position.set(sim.px, groundY + 0.05, sim.pz);
          playerShadow.scale.setScalar(Math.max(0.45, 1 - jumpHeight * 0.14));

          updateWorldAround(sim.px, sim.pz);
          syncSafeZones3D(sim.px, sim.pz);

          for (const entry of safeZoneMeshes.values()) {
            const mat = entry.ring.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.65 + Math.sin(sim.elapsed * 4.5) * 0.25;
          }

          // Auto-heal when walking up to Safe Zone Pokémon Center
          if (activeZone && sim.timers.safeHealCd <= 0 && sim.hp < sim.maxHp) {
            if (Math.hypot(sim.px - (activeZone.x - 4), sim.pz - (activeZone.z - 1)) < 3.4) {
              sim.hp = sim.maxHp;
              sim.timers.safeHealCd = 3.5;
              onHealParty();
              sound.play('heal_jingle');
              showBanner('乔伊小姐：叮咚叮咚～主角与全体随从已恢复满血！');
            }
          }
  return { closestTownPoint, activeTownNow, activeInteriorNow, closestNode, inTownPeaceZone };
}
