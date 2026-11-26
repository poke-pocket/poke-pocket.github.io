import type { LiveMapSnapshot } from '../WorldMapHud';
import { DEFAULT_WORLD_TOUR_STATE } from '../../data/worldTour';
import { SAFE_ZONE_3D_RADIUS, SURVIVOR_SKILLS } from '../../data/survivorsTactics';
import type { ArenaSharedCtx } from './arenaTypesAndProps';
import type { PetSkinId } from '../../types/pet';
import * as THREE from 'three';
import { BIOME_PALETTES, getSeamlessBiomeAt3D, type BiomeId } from '../../data/worldTextures3D';
import { SPECIES_CATALOG, getPokemonCryId, getPokemonPhysicalMetrics } from '../../data/catalog';
import { getTerrainHeight3D } from '../../data/survivorsTactics';
import { detectOverlandCityAt } from '../../data/geoTerrain3D';
import { getSkinDef } from '../../data/metaProgression';
import { computeCameraWallClipT } from '../../utils/townBuilder3D';
import { sound } from '../../utils/sound';
import {
  buildInteractActionsForTarget,
  type LiveWorldBubble,
  type NearbyActionMenuState,
  type ProjectedBubble2D,
} from './ArenaTownSocialAndBusOverlay';
import { MONSTER_QUALITY_META, type FloatingTag2D } from './arenaTypesAndProps';

/* eslint-disable @typescript-eslint/no-explicit-any */
const _tmpFogColor = new THREE.Color();

export function stepArenaHudProjection3D(rawCtx: Record<string, any>): void {
  const { activeInteriorNow, activeTownNow, activeWorldRun, activeZone, camOrbitRef, camera, closestNode, closestTownPoint, comboRef, dt, externalPausedRef, fpsSmooth, gameMode, handleFastTravelCity, interactActionCountRef, interactOptionIdxRef, latestMapSnapshotRef, liveOverlandCityRef, nearbyKoIdRef, nearestDist, nearestZone, occludeTown, onSyncWorldMapData, onUpdateMeta, overlandCityIdRef, pet, phase, projVec, regionMeta, scene, selectedBiome, setAskQuickNavOpen, setEdgeIndicators, setFloatingTags, setHud, setInteractOptionIdx, setLiveOverlandCity, setMapSnapshot, setNearbyInteract, setNearbyKoTarget, setProjectedBubbles, showBanner, sim, terrainMat, worldBubblesRef } = rawCtx as ArenaSharedCtx;
          // Smooth Minecraft-style live biome atmosphere transition (fog color + exploration toast!)
          const curBiomeAtPlayer = getSeamlessBiomeAt3D(sim.px, sim.pz, sim.py, selectedBiome);
          _tmpFogColor.setHex(BIOME_PALETTES[curBiomeAtPlayer].fogHex);
          if (scene.fog instanceof THREE.Fog) {
            scene.fog.color.lerp(_tmpFogColor, Math.min(1, dt * 1.4));
          }
          if (terrainMat.uniforms?.uFogColor?.value) {
            (terrainMat.uniforms.uFogColor.value as THREE.Color).lerp(_tmpFogColor, Math.min(1, dt * 1.4));
          }
          if (sim.lastSeamlessBiome !== curBiomeAtPlayer) {
            const prevBiome = sim.lastSeamlessBiome;
            sim.lastSeamlessBiome = curBiomeAtPlayer;
            // Suppress rural wilderness biome toasts while walking inside a city!
            if (prevBiome && phase === 'playing' && !activeTownNow && !occludeTown) {
              const biomeAnnounce: Record<BiomeId, string> = {
                verdant_forest: '🌲 踏入「青翠森林 · 阳光原野」地带',
                rocky_desert: '🏜️ 踏入「岩石沙漠 · 金沙峡谷」地带',
                storm_coast: '🌴 踏入「风暴海岸 · 椰林海湾」地带',
                sky_glacier: '🏔️ 踏入「天空冰川 · 雪山之巅」地带',
                cinnabar_isle: '🌋 踏入「红莲火山 · 熔岩裂谷」地带',
              };
              showBanner(biomeAnnounce[curBiomeAtPlayer], 2800);
            }
          }

          sim.timers.hudSync -= dt;
          if (sim.timers.hudSync <= 0) {
            sim.timers.hudSync = 0.16;
            const zAng = Math.atan2(nearestZone.z - sim.pz, nearestZone.x - sim.px);
            const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
            const aIdx = Math.round((((zAng / (Math.PI * 2)) + 1) % 1) * 8) % 8;
            const activeBoss = sim.enemies.find((e) => e.isBoss && e.hp > 0);
            const squadHpRatio = Math.max(0, Math.min(1, sim.hp / Math.max(1, sim.maxHp)));
            const followerVitals: Record<string, { hp: number; maxHp: number; mp: number; maxMp: number }> = {};
            for (const f of sim.followers) {
              const fMaxHp = Math.round(95 + f.level * 28);
              const fHp = Math.max(1, Math.round(fMaxHp * squadHpRatio));
              const skMeta = SURVIVOR_SKILLS[f.skills[0]];
              const maxCd = Math.max(0.25, (skMeta?.baseCd ?? 1.4) * sim.cdMult);
              const mpRatio = Math.max(0, Math.min(1, 1 - Math.max(0, f.cds[0] ?? 0) / maxCd));
              const fMaxMp = 100;
              followerVitals[f.id] = {
                hp: fHp,
                maxHp: fMaxHp,
                mp: Math.round(mpRatio * fMaxMp),
                maxMp: fMaxMp,
              };
            }

            const nextHud = {
              hp: Math.ceil(sim.hp),
              maxHp: sim.maxHp,
              xp: sim.xp,
              xpNeed: sim.xpNeed,
              runLevel: sim.runLevel,
              kills: sim.kills,
              coins: sim.coins,
              totalDamage: sim.totalDamage,
              elapsedSec: Math.floor(sim.elapsed),
              inSafeZone: Boolean(activeZone),
              safeDirArrow: arrows[aIdx],
              safeDistM: Math.max(0, Math.round((nearestDist - SAFE_ZONE_3D_RADIUS) * 2.5)),
              bossAliveName: activeBoss
                ? gameMode === 'story'
                  ? regionMeta.bossName
                  : `守护者 ${SPECIES_CATALOG[activeBoss.species].defaultName}`
                : '',
              bossHpPct: activeBoss ? Math.max(0, Math.round((activeBoss.hp / activeBoss.maxHp) * 100)) : 0,
              bossHp: activeBoss ? Math.max(0, Math.ceil(activeBoss.hp)) : 0,
              bossMaxHp: activeBoss ? Math.ceil(activeBoss.maxHp) : 0,
              fps: Math.max(1, Math.round(fpsSmooth)),
              combo: comboRef.current.count,
              followerVitals,
              actionCds: {
                ball: Number(sim.actionCds.ball.toFixed(1)),
                heal: Number(sim.actionCds.heal.toFixed(1)),
                boost: Number(sim.actionCds.boost.toFixed(1)),
                salvo: Number(sim.actionCds.salvo.toFixed(1)),
              },
              healCharges: sim.healCharges,
              boostLeft: Number(sim.boostTimer.toFixed(1)),
            };
            setHud((prev: any) => {
              if (
                prev &&
                prev.hp === nextHud.hp &&
                prev.maxHp === nextHud.maxHp &&
                prev.xp === nextHud.xp &&
                prev.runLevel === nextHud.runLevel &&
                prev.kills === nextHud.kills &&
                prev.coins === nextHud.coins &&
                prev.elapsedSec === nextHud.elapsedSec &&
                prev.inSafeZone === nextHud.inSafeZone &&
                prev.safeDirArrow === nextHud.safeDirArrow &&
                Math.abs(prev.safeDistM - nextHud.safeDistM) <= 2 &&
                prev.bossAliveName === nextHud.bossAliveName &&
                prev.bossHp === nextHud.bossHp &&
                prev.combo === nextHud.combo &&
                prev.healCharges === nextHud.healCharges &&
                prev.boostLeft === nextHud.boostLeft &&
                prev.actionCds.ball === nextHud.actionCds.ball &&
                prev.actionCds.heal === nextHud.actionCds.heal &&
                prev.actionCds.boost === nextHud.actionCds.boost &&
                prev.actionCds.salvo === nextHud.actionCds.salvo
              ) {
                return prev;
              }
              return nextHud;
            });

            // Detect nearest knocked-out catchable Pokémon within proximity range (5.8m)
            const nearKo = sim.enemies
              .filter((e) => e.knockedOut && !e.beingCaptured && Math.hypot(e.x - sim.px, e.z - sim.pz) < 5.8)
              .sort((a, b) => Math.hypot(a.x - sim.px, a.z - sim.pz) - Math.hypot(b.x - sim.px, b.z - sim.pz))[0];
            if (nearKo) {
              const phys = getPokemonPhysicalMetrics(nearKo.species, nearKo.stage);
              const spMeta = SPECIES_CATALOG[nearKo.species];
              const lv = nearKo.isBoss
                ? Math.min(32, pet.level + 4)
                : Math.min(28, Math.max(4, pet.level + (nearKo.quality === 'epic' ? 2 : nearKo.isShiny ? 2 : 0)));
              nearbyKoIdRef.current = nearKo.id;
              const nextKo = {
                enemyId: nearKo.id,
                species: nearKo.species,
                name: spMeta.stageNames[nearKo.stage] ?? spMeta.defaultName,
                stage: nearKo.stage,
                level: lv,
                isBoss: nearKo.isBoss,
                isShiny: nearKo.isShiny,
                quality: nearKo.quality,
                heightM: phys.heightM,
                weightKg: phys.weightKg,
                sprite: spMeta.stageSprites[nearKo.stage].animated,
              };
              setNearbyKoTarget((prev: any) =>
                prev && prev.enemyId === nextKo.enemyId && prev.level === nextKo.level ? prev : nextKo,
              );
            } else {
              nearbyKoIdRef.current = null;
              setNearbyKoTarget((prev: any) => (prev === null ? prev : null));
            }
            // Project 3D Beside-Character Multi-Option Action Menu (`Tab` cycles, `E` activates!)
            if (closestTownPoint || closestNode) {
              const targetId = closestTownPoint ? closestTownPoint.id : closestNode.id;
              const wx = closestTownPoint ? closestTownPoint.x : closestNode.x;
              const wy = closestTownPoint ? (closestTownPoint.y ?? sim.py) + 1.45 : closestNode.y + 1.25;
              const wz = closestTownPoint ? closestTownPoint.z : closestNode.z;
              projVec.set(wx, wy, wz).project(camera);
              const inView = projVec.z < 1 && Math.abs(projVec.x) <= 0.96 && Math.abs(projVec.y) <= 0.94;
              const sx = ((projVec.x + 1) / 2) * 100;
              const sy = ((-projVec.y + 1) / 2) * 100;
              const { speakerName, actions } = buildInteractActionsForTarget(closestTownPoint, closestNode);
              if (interactActionCountRef) interactActionCountRef.current = actions.length;
              const nextMenu: NearbyActionMenuState = {
                targetId,
                speakerName,
                wx,
                wy,
                wz,
                sx,
                sy,
                inView,
                actions,
              };
              setNearbyInteract((prev: NearbyActionMenuState | null) => {
                if (!prev || prev.targetId !== targetId) {
                  if (interactOptionIdxRef) interactOptionIdxRef.current = 0;
                  setInteractOptionIdx?.(0);
                  setAskQuickNavOpen?.(false);
                  return nextMenu;
                }
                if (
                  Math.abs(prev.sx - sx) < 0.4 &&
                  Math.abs(prev.sy - sy) < 0.4 &&
                  prev.inView === inView &&
                  prev.actions.length === actions.length &&
                  prev.actions[0]?.label === actions[0]?.label
                ) {
                  return prev;
                }
                return nextMenu;
              });
            } else {
              if (interactActionCountRef) interactActionCountRef.current = 0;
              setNearbyInteract((prev: any) => {
                if (prev !== null) setAskQuickNavOpen?.(false);
                return prev === null ? prev : null;
              });
            }

            // Advance & 3D-Project Sequential Overhead Pixel Speech & Emote Bubbles (`一个气泡接着一个气泡展示`!)
            if (worldBubblesRef && setProjectedBubbles) {
              const nowMs = performance.now();
              const list: LiveWorldBubble[] = worldBubblesRef.current;
              const outBubbles: ProjectedBubble2D[] = [];
              for (let bi = list.length - 1; bi >= 0; bi--) {
                const b = list[bi];
                if (nowMs < b.startAtMs) continue;
                if (nowMs >= b.nextAtMs) {
                  if (b.pageIdx + 1 < b.pages.length) {
                    b.pageIdx += 1;
                    const nextText = b.pages[b.pageIdx] ?? '';
                    b.nextAtMs = nowMs + Math.max(2050, Math.min(3500, 1150 + nextText.length * 110));
                    if (b.isPlayerDialog) sound.play('cursor');
                  } else {
                    list.splice(bi, 1);
                    continue;
                  }
                }
                if (Math.hypot(b.wx - sim.px, b.wz - sim.pz) > 36) continue;
                projVec.set(b.wx, b.wy, b.wz).project(camera);
                if (projVec.z >= 1 || Math.abs(projVec.x) > 0.94 || Math.abs(projVec.y) > 0.92) continue;
                outBubbles.push({
                  id: b.id,
                  speakerName: b.speakerName,
                  emote: b.pageIdx === 0 ? b.emote : undefined,
                  text: b.pages[b.pageIdx] ?? '',
                  pageIdx: b.pageIdx,
                  totalPages: b.pages.length,
                  sx: ((projVec.x + 1) / 2) * 100,
                  sy: ((-projVec.y + 1) / 2) * 100,
                  isPlayerDialog: b.isPlayerDialog,
                });
              }
              setProjectedBubbles((prev: ProjectedBubble2D[]) =>
                prev.length === 0 && outBubbles.length === 0 ? prev : outBubbles,
              );
            }
            const nextMapSnap: LiveMapSnapshot = {
              px: sim.px,
              pz: sim.pz,
              facingAngle: sim.facingAngle,
              camYaw: camOrbitRef.current.yaw,
              dots: [
                ...sim.followers.map((f) => ({ x: f.x, z: f.z, kind: 'follower' as const })),
                ...sim.enemies
                  .filter((en) => en.hp > 0 || en.knockedOut)
                  .slice(0, 60)
                  .map((en) => ({
                    x: en.x,
                    z: en.z,
                    kind: (en.isBoss || en.knockedOut || en.isShiny ? 'boss' : en.isTrainer || en.quality === 'epic' ? 'trainer' : 'enemy') as
                      | 'boss'
                      | 'trainer'
                      | 'enemy',
                  })),
              ],
            };
            // Seamless Real-World Overland Cross-City Detection (e.g. walking from Shenzhen -> Hong Kong!)
            if (activeWorldRun) {
              const overland = detectOverlandCityAt(sim.px, sim.pz);
              if (
                overland &&
                overland.distKm <= 16 &&
                overland.city.id !== overlandCityIdRef.current
              ) {
                overlandCityIdRef.current = overland.city.id;
                liveOverlandCityRef.current = overland.city;
                setLiveOverlandCity(overland.city);
                sound.play('levelup');
                showBanner(
                  `🧭 徒步跨城：已抵达【${overland.city.name}】！当地生态与野生精灵已无缝切换！`,
                  4600,
                );
                onUpdateMeta?.((prev) => {
                  const prevTour = prev.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
                  const visited = prevTour.visitedCities.includes(overland.city.id)
                    ? prevTour.visitedCities
                    : [...prevTour.visitedCities, overland.city.id];
                  return {
                    ...prev,
                    worldTour: {
                      ...prevTour,
                      visitedCities: visited,
                    },
                  };
                });
              }
            }

            latestMapSnapshotRef.current = nextMapSnap;
            setMapSnapshot((prev: LiveMapSnapshot) => {
              if (
                prev &&
                Math.hypot(nextMapSnap.px - prev.px, nextMapSnap.pz - prev.pz) < 0.45 &&
                Math.abs(nextMapSnap.facingAngle - prev.facingAngle) < 0.06 &&
                Math.abs(nextMapSnap.camYaw - prev.camYaw) < 0.06 &&
                nextMapSnap.dots.length === prev.dots.length
              ) {
                return prev;
              }
              return nextMapSnap;
            });
            // Only sync full WorldMapData up to parent <App /> when handheld overlay is actually open (avoids full-app React re-render every 160ms while walking!)
            if (externalPausedRef.current) {
              onSyncWorldMapData?.({
                biome: liveOverlandCityRef.current?.biome ?? selectedBiome,
                regionName: liveOverlandCityRef.current?.name ?? regionMeta.name,
                snapshot: nextMapSnap,
                onFastTravelCity: handleFastTravelCity,
              });
            }

            const tags: FloatingTag2D[] = [];
            const edges: {
              id: number;
              sx: number;
              sy: number;
              angleDeg: number;
              label: string;
              distM: number;
              kind: 'boss' | 'shiny' | 'ko' | 'trainer';
              icon: string;
            }[] = [];
            for (const pop of sim.dmgPops.slice(-10)) {
              projVec.set(pop.wx, pop.wy, pop.wz).project(camera);
              if (projVec.z < 1) {
                tags.push({
                  id: pop.id,
                  sx: ((projVec.x + 1) / 2) * 100,
                  sy: ((-projVec.y + 1) / 2) * 100,
                  text: pop.text,
                  color: pop.color,
                });
              }
            }
            for (const en of sim.enemies) {
              if (en.beingCaptured) continue;
              const showSpecialTag =
                en.isTrainer || en.knockedOut || en.isShiny || en.quality === 'elite' || en.quality === 'epic';
              if (!showSpecialTag || (en.hp <= 0 && !en.knockedOut)) continue;
              projVec.set(en.x, en.y + Math.max(2.2, en.worldScale * 0.95), en.z).project(camera);
              const inView = projVec.z < 1 && Math.abs(projVec.x) <= 0.92 && Math.abs(projVec.y) <= 0.9;
              const spName = SPECIES_CATALOG[en.species].stageNames[en.stage] ?? SPECIES_CATALOG[en.species].defaultName;
              const qMeta = MONSTER_QUALITY_META[en.quality];
              if (inView) {
                // Hide floating nameplates when occluded behind solid town buildings or walls!
                const occludedByWall =
                  occludeTown &&
                  computeCameraWallClipT(
                    camera.position.x,
                    camera.position.y,
                    camera.position.z,
                    en.x,
                    en.y + 1.8,
                    en.z,
                    occludeTown.group.position.y,
                    occludeTown.colliders,
                    activeInteriorNow?.id,
                  ) < 0.92;
                if (occludedByWall) continue;
                const koCountdown =
                  en.knockedOut && !en.isBoss && en.koTimer !== undefined
                    ? ` (${Math.ceil(en.koTimer)}s)`
                    : '';
                const label = en.knockedOut
                  ? `✨ ${en.isShiny ? '★异色 ' : ''}${spName} · 可收服${koCountdown}`
                  : en.isTrainer
                    ? (en.trainerName ?? '训练师')
                    : `${en.isShiny ? '★异色 ' : ''}${qMeta.label ? `[${qMeta.label}] ` : ''}${spName}`;
                tags.push({
                  id: 900000 + en.id,
                  sx: ((projVec.x + 1) / 2) * 100,
                  sy: ((-projVec.y + 1) / 2) * 100,
                  text: label,
                  color: en.knockedOut || en.isShiny ? '#ffe066' : en.isTrainer ? '#ff6b6b' : qMeta.color,
                  isHpBar: !en.knockedOut,
                  hpPct: Math.round((Math.max(0, en.hp) / Math.max(1, en.maxHp)) * 100),
                });
              } else if (en.isBoss || en.knockedOut || en.isShiny || en.isTrainer) {
                // Screen-perimeter directional arrow pointing toward off-screen priority targets!
                let nx = projVec.x;
                let ny = projVec.y;
                if (projVec.z >= 1) {
                  nx = -nx;
                  ny = -ny;
                }
                const maxAxis = Math.max(Math.abs(nx), Math.abs(ny), 0.001);
                const clampX = (nx / maxAxis) * 0.88;
                const clampY = (ny / maxAxis) * 0.74;
                // Keep clear of Left Squad List (~240px + tag half-width) & Bottom-Right Action Cluster!
                const sx = Math.max(30, Math.min(91, ((clampX + 1) / 2) * 100));
                const sy = Math.max(15, Math.min(76, ((-clampY + 1) / 2) * 100));
                const angleDeg = (Math.atan2(-ny, nx) * 180) / Math.PI;
                const distM = Math.max(1, Math.round(Math.hypot(en.x - sim.px, en.z - sim.pz)));
                if (edges.length < 3) {
                  edges.push({
                    id: en.id,
                    sx,
                    sy,
                  angleDeg,
                  distM,
                  kind: en.knockedOut ? 'ko' : en.isBoss ? 'boss' : en.isShiny ? 'shiny' : 'trainer',
                  label: en.knockedOut
                    ? `可收服 ${spName}`
                    : en.isBoss
                      ? `守护者 ${spName}`
                      : en.isShiny
                        ? `★异色 ${spName}`
                        : (en.trainerName ?? '训练师'),
                  icon: en.knockedOut
                    ? '/sprites/items/poke-ball.png'
                    : en.isBoss
                      ? '/sprites/items/master-ball.png'
                      : en.isShiny
                        ? '/sprites/items/bright-powder.png'
                        : '/sprites/items/vs-seeker.png',
                  });
                }
              }
            }
            setFloatingTags((prev: FloatingTag2D[]) => (prev.length === 0 && tags.length === 0 ? prev : tags));
            // De-overlap offscreen perimeter indicators vertically so trainer distance tags NEVER stack on top of each other!
            const topEdges = edges.slice(0, 3).sort((a, b) => a.sy - b.sy);
            for (let ei = 1; ei < topEdges.length; ei++) {
              if (Math.abs(topEdges[ei].sx - topEdges[ei - 1].sx) < 18 && topEdges[ei].sy - topEdges[ei - 1].sy < 5.6) {
                topEdges[ei].sy = Math.min(79, topEdges[ei - 1].sy + 5.6);
              }
            }
            setEdgeIndicators((prev: any[]) => (prev.length === 0 && topEdges.length === 0 ? prev : topEdges));
          }
}

export function stepArenaCaptureCinema3D(rawCtx: Record<string, any>): void {
  const { addFollowerToRun, buildResultSummary, camera, captureFinishRef, damageEnemy3D, diffMeta, dt, endedRef, gameMode, horizonBackdrop, maxFollowersRef, now, onCaptureBoss, onShowCaptureInHandheld, pausedRef, pet, regionMeta, save, scene, setCaptureCutscene, setResultSummary, sim, spawnGlowFlash, spawnGroundDecalWave, spawnPixelParticles, syncFloraBillboards, vfxAtlas, waterMat } = rawCtx as ArenaSharedCtx;
          // REAL 3D CLOSE-UP CINEMATIC CAPTURE CAMERA (Enemies frozen while Three.js camera tracks the real flying Poké Ball -> impact -> 3 wobbles!)
          waterMat.uniforms.uTime.value = now * 0.001;
          if (horizonBackdrop.userData?.skyUniforms?.uTime) {
            horizonBackdrop.userData.skyUniforms.uTime.value = now * 0.001;
          }
          const cap = sim.activeCaptures[0];
          cap.t += dt;
          const en = cap.enemy;
          const gyT = getTerrainHeight3D(cap.targetX, cap.targetZ);
          const camDirX = cap.targetX - cap.startX;
          const camDirZ = cap.targetZ - cap.startZ;
          const baseYaw = Math.atan2(camDirX, camDirZ);

          if (cap.t < 0.62) {
            // ACT 1: High-speed 3D Poké Ball flight arc tracked closely by the 3D camera!
            const u = cap.t / 0.62;
            const bx = cap.startX + (cap.targetX - cap.startX) * u;
            const bz = cap.startZ + (cap.targetZ - cap.startZ) * u;
            const by = cap.startY + (cap.targetY - cap.startY) * u + Math.sin(u * Math.PI) * 3.6;
            cap.ballSprite.position.set(bx, by, bz);
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation -= dt * 18;
            cap.ballShadow.position.set(bx, getTerrainHeight3D(bx, bz) + 0.06, bz);
            const sideAng = baseYaw + Math.PI * 0.42;
            const trackX = bx + Math.sin(sideAng) * 5.2 - Math.sin(baseYaw) * 2.0;
            const trackZ = bz + Math.cos(sideAng) * 5.2 - Math.cos(baseYaw) * 2.0;
            const trackY = Math.max(getTerrainHeight3D(trackX, trackZ) + 1.4, by + 1.35);
            camera.position.lerp(new THREE.Vector3(trackX, trackY, trackZ), Math.min(1, dt * 12));
            camera.lookAt(bx * 0.65 + cap.targetX * 0.35, by * 0.6 + cap.targetY * 0.4, bz * 0.65 + cap.targetZ * 0.35);
          } else if (cap.t < 1.12) {
            // ACT 2: IMPACT! Crimson 3D capture laser ring + target digitizing into hovering Poké Ball!
            const u = (cap.t - 0.62) / 0.5;
            if (!cap.absorbed) {
              cap.absorbed = true;
              sound.play('pokeball');
              setCaptureCutscene((prev: any) => (prev ? { ...prev, phase: 'absorb' } : null));
              spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff3b3b, Math.max(3.4, en.worldScale * 1.2), 0.45);
              spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.fireBlastDecal, Math.max(3.0, en.worldScale), 0.42);
              spawnPixelParticles(cap.targetX, gyT + 0.8, cap.targetZ, vfxAtlas.starGlint, 10, 4.8, 0.85, 4.2, 5.5);
            }
            const hoverY = gyT + 1.85 + Math.sin(u * Math.PI) * 0.55;
            cap.ballSprite.position.set(cap.targetX, hoverY, cap.targetZ);
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation = Math.sin(u * Math.PI * 3) * 0.25;
            cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
            if (en.sprite) {
              const shrink = Math.max(0.05, 1 - u);
              en.sprite.scale.set(en.worldScale * shrink, en.worldScale * shrink, 1);
              en.sprite.position.set(cap.targetX, gyT + u * 1.7, cap.targetZ);
              (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(0xff5252);
            }
            const orbAng = baseYaw + 0.65 + u * 0.45;
            const cx = cap.targetX + Math.sin(orbAng) * 4.8;
            const cz = cap.targetZ + Math.cos(orbAng) * 4.8;
            camera.position.lerp(new THREE.Vector3(cx, Math.max(getTerrainHeight3D(cx, cz) + 1.3, gyT + 2.3), cz), Math.min(1, dt * 10));
            camera.lookAt(cap.targetX, gyT + 1.15, cap.targetZ);
          } else if (cap.t < 2.65) {
            // ACT 3: Close-up 3D orbit around the Poké Ball wobbling 3 suspenseful times on the grass!
            if (en.sprite) en.sprite.visible = false;
            if (en.shadow) en.shadow.visible = false;
            const u = cap.t - 1.12;
            const dropBounce = u < 0.24 ? Math.abs(Math.sin((u / 0.24) * Math.PI)) * 0.8 : 0;
            const wobbleIdx = Math.floor((u - 0.24) / 0.42);
            if (u >= 0.24 && wobbleIdx >= 0 && wobbleIdx < 3 && wobbleIdx >= cap.wobbleClicks) {
              cap.wobbleClicks = wobbleIdx + 1;
              sound.play('pokeball');
              setCaptureCutscene((prev: any) => (prev ? { ...prev, phase: 'wobble', wobbleCount: wobbleIdx + 1 } : null));
              spawnPixelParticles(cap.targetX, gyT + 0.6, cap.targetZ, vfxAtlas.electricSpark, 4, 2.4, 0.55, 2.4, 7.0);
            }
            const wobbleAngle =
              u >= 0.24 && u < 1.48
                ? Math.sin((((u - 0.24) % 0.42) / 0.42) * Math.PI * 2) * 0.58 * (wobbleIdx % 2 === 0 ? 1 : -1)
                : 0;
            cap.ballSprite.position.set(cap.targetX, gyT + 0.56 + dropBounce, cap.targetZ);
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation = wobbleAngle;
            cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
            const orbAng = baseYaw + 1.1 + u * 0.55;
            const cx = cap.targetX + Math.sin(orbAng) * 4.3;
            const cz = cap.targetZ + Math.cos(orbAng) * 4.3;
            camera.position.lerp(new THREE.Vector3(cx, Math.max(getTerrainHeight3D(cx, cz) + 1.2, gyT + 1.85), cz), Math.min(1, dt * 8));
            camera.lookAt(cap.targetX, gyT + 0.65, cap.targetZ);
          } else if (!cap.resolved) {
            // ACT 4: Resolution — Golden 3D Starburst + Handheld Console Pokédex Reveal OR Break-Free!
            cap.resolved = true;
            (cap.ballSprite.material as THREE.SpriteMaterial).rotation = 0;
            if (cap.willCatch) {
              const catchLv = en.isBoss
                ? Math.min(32, pet.level + 4)
                : Math.min(28, Math.max(4, pet.level + (en.quality === 'epic' ? 2 : en.isShiny ? 2 : 0)));
              const spMeta = SPECIES_CATALOG[en.species];
              const spName = spMeta.stageNames[en.stage] ?? spMeta.defaultName;
              const phys = getPokemonPhysicalMetrics(en.species, en.stage);
              const isNewSp = !save.discoveredSpecies.includes(en.species);
              sound.play('hatch');
              window.setTimeout(() => sound.play('levelup'), 220);
              window.setTimeout(() => sound.playCry(getPokemonCryId(en.species, catchLv)), 360);
              spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.healCircleDecal, 4.6, 0.62);
              spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xffe066, 4.4, 0.55);
              spawnPixelParticles(cap.targetX, gyT + 0.9, cap.targetZ, vfxAtlas.starGlint, 16, 6.2, 1.05, 5.8, 5.5);
              const caughtSkin: PetSkinId | undefined = en.isShiny ? 'shiny' : en.regionalSkin;
              onCaptureBoss?.(en.species, catchLv, caughtSkin);
              if (sim.followers.length < maxFollowersRef.current) {
                addFollowerToRun(en.species, `${en.isShiny ? '★' : ''}${spName}`, en.stage, undefined, caughtSkin);
              }
              if (en.isBoss) {
                sim.capturedBoss = { species: en.species, name: spName, level: catchLv };
              }
              if (en.sprite) scene.remove(en.sprite);
              if (en.shadow) scene.remove(en.shadow);
              if (en.auraRing) scene.remove(en.auraRing);
              const eIdx = sim.enemies.indexOf(en);
              if (eIdx !== -1) sim.enemies.splice(eIdx, 1);

              // Brief 650ms 3D golden starburst celebration, then pull up our REAL MAIN HandheldConsole!
              setCaptureCutscene((prev: any) => (prev ? { ...prev, phase: 'caught' } : null));
              window.setTimeout(() => {
                for (const c of sim.activeCaptures) {
                  scene.remove(c.ballSprite, c.ballShadow);
                }
                sim.activeCaptures = [];
                setCaptureCutscene(null);
                if (onShowCaptureInHandheld) {
                  onShowCaptureInHandheld(
                    {
                      species: en.species,
                      name: en.regionalSkin ? `${spName}·${getSkinDef(en.regionalSkin).name.split('·')[0]}` : spName,
                      sprite: spMeta.stageSprites[en.stage].animated,
                      level: catchLv,
                      isShiny: en.isShiny,
                      isNewSpecies: isNewSp,
                      dexNo: spMeta.dexNo,
                      typeLabel: spMeta.typeLabel,
                      typeColor: spMeta.typeColor,
                      lore: spMeta.description,
                      heightM: phys.heightM,
                      weightKg: phys.weightKg,
                      qualityLabel: en.regionalSkin
                        ? `🏮${getSkinDef(en.regionalSkin).name}`
                        : MONSTER_QUALITY_META[en.quality].label,
                      qualityColor: en.regionalSkin
                        ? getSkinDef(en.regionalSkin).rarityColor
                        : MONSTER_QUALITY_META[en.quality].color,
                    },
                    () => {
                      if (en.isBoss && gameMode === 'story' && !endedRef.current) {
                        sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
                        endedRef.current = true;
                        pausedRef.current = true;
                        setResultSummary(buildResultSummary(true, sim.capturedBoss));
                      } else {
                        pausedRef.current = false;
                      }
                    },
                  );
                } else {
                  captureFinishRef.current?.();
                }
              }, 680);
            } else {
              sound.play('hit');
              spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff6b6b, 3.2, 0.35);
              en.beingCaptured = false;
              if (en.sprite) {
                en.sprite.visible = true;
                en.sprite.scale.set(en.worldScale, en.worldScale, 1);
                const baseTint = en.regionalSkin ? getSkinDef(en.regionalSkin).tintHex3D : 0xffffff;
                (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(baseTint);
              }
              if (en.shadow) en.shadow.visible = true;
              damageEnemy3D(en, Math.round(en.maxHp * 0.25), '#ff922b');
              setCaptureCutscene((prev: any) => (prev ? { ...prev, phase: 'escaped' } : null));
              window.setTimeout(() => {
                captureFinishRef.current?.();
              }, 1050);
            }
          }
          // Still advance VFX particles smoothly during 3D capture close-up!
          for (let i = sim.vfxs.length - 1; i >= 0; i--) {
            const v = sim.vfxs[i];
            v.life -= dt;
            if (v.life <= 0) {
              scene.remove(v.mesh);
              sim.vfxs.splice(i, 1);
            } else if (v.kind === 'particle') {
              const sp = v.mesh as THREE.Sprite;
              sp.position.x += (v.vx ?? 0) * dt;
              sp.position.y += (v.vy ?? 0) * dt;
              sp.position.z += (v.vz ?? 0) * dt;
              v.vy = (v.vy ?? 0) - (v.gravity ?? 10) * dt;
            }
          }
          // Face all sprites toward the close-up cinema camera
          const cYaw = Math.atan2(camera.position.x - cap.targetX, camera.position.z - cap.targetZ);
          syncFloraBillboards(cYaw, 0.25);
        }
