import type { FacingDir } from '../../data/overworldTiles';
import type { ArenaSharedCtx } from './arenaTypesAndProps';
import * as THREE from 'three';
import { sampleHumanWalkFrame } from '../../data/worldTextures3D';
import { LAKE_BASINS_3D, WATER_LEVEL_3D, getTerrainHeight3D, getWalkableSurfaceHeight3D } from '../../data/survivorsTactics';
import { getActiveGeoTerrainOrigin, worldToGeo } from '../../data/geoTerrain3D';
import type { SpeciesId } from '../../types/pet';
import { orientDoorSwingAwayFromActor, updateProximityAutoDoors3D } from '../../utils/architecturalBuildings3D';
import { isInsideBuildingInterior, resolveTownWallCollisions, type EnterableBuildingInterior, type ProceduralTownInstance, type TownInteractPoint, type TownStrollingCitizen } from '../../utils/townBuilder3D';
import { getHeldHotelKeycard, setHeldHotelKeycard } from '../../world3d/townTypes';
import { sound } from '../../utils/sound';
import { buildInteractActionsForTarget, pushWorldSpeechBubble, type LiveWorldBubble } from './ArenaTownSocialAndBusOverlay';

const NPC_CHAT_GIFTED = new Set<string>();
const NPC_CHAT_TURN_MAP = new Map<string, number>();

const STREET_PAIR_BANTER: [
  { text: string; emote: 'happy' | 'music' | 'exclaim' | 'question' | 'sparkle' | 'heart' },
  { text: string; emote: 'happy' | 'music' | 'exclaim' | 'question' | 'sparkle' | 'heart' },
][] = [
  [
    { emote: 'happy', text: '早呀！今天天气真适合带宝可梦出门散步！' },
    { emote: 'music', text: '是呀，刚去中心公园看体素喷泉回来呢～' },
  ],
  [
    { emote: 'exclaim', text: '你看街对面那家树果饭店，晚上亮灯超温馨！' },
    { emote: 'heart', text: '走呀！待会儿一起去点两碗招牌热汤拉面！' },
  ],
  [
    { emote: 'sparkle', text: '我的皮卡丘今天刚学会新招式，干劲十足！' },
    { emote: 'happy', text: '太酷了吧！改天咱们在广场切磋一局！' },
  ],
  [
    { emote: 'question', text: '请问去城郊虹桥高铁站坐哪路车最快呀？' },
    { emote: 'exclaim', text: '前头大马路边就有市内公交站，免费直达哦！' },
  ],
  [
    { emote: 'music', text: '友好百货今天新到了一批超级球和树果礼盒！' },
    { emote: 'sparkle', text: '真的吗？我正好要去补给几瓶伤药呢！' },
  ],
];

const SOLO_AMBIENT_MUSINGS: { emote: 'music' | 'heart' | 'sparkle' | 'happy'; text: string }[] = [
  { emote: 'music', text: '哼哼～今天的微风吹得真舒服♪' },
  { emote: 'heart', text: '有宝可梦陪在身边，走多远都不觉得累～' },
  { emote: 'sparkle', text: '这座体素城市的街景越看越精致呢！' },
  { emote: 'happy', text: '去宝可梦中心找乔伊小姐充个电吧！' },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
export function stepArenaTownAndWorldNodes3D(rawCtx: Record<string, any>) {
  const {
    WEATHER_PARTICLE_COUNT,
    activeTownIdRef,
    applyLiveSolarAtmosphere,
    autoNavTargetsRef,
    bbTiltX,
    camFwdX,
    camFwdZ,
    camRightX,
    camRightZ,
    camYawNow,
    damageEnemy3D,
    dt,
    executeInteractActionRef,
    groundY,
    heroFrames,
    interactOptionIdxRef,
    lastEnteredInteriorIdRef,
    liveWeatherRef,
    mLen,
    metaBonusesRef,
    metaRef,
    now,
    npcSocialTimerRef,
    onHealParty,
    onUpdateMeta,
    persistState,
    playerShadow,
    playerSprite,
    playerSpriteMat,
    prefsRef,
    proceduralTowns,
    setActiveBusStopModal,
    setAskQuickNavOpen,
    setInRunTownShopOpen,
    setWorldMapOpen,
    showBanner,
    sim,
    spawnGroundDecalWave,
    spawnPixelParticles,
    startStreetDuelRef,
    sun,
    surfingNow,
    teleportIntraCityBusRef,
    triggerInteractRef,
    updateWorldAround,
    vfxAtlas,
    weatherGeo,
    weatherMat,
    weatherPoints,
    windClock,
    worldBubblesRef,
    worldInteractNodes,
  } = rawCtx as ArenaSharedCtx;

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

  // Stream & re-center the 288m heightfield terrain & water sheets dynamically around the player so ground NEVER ends past ±144m!
  updateWorldAround(sim.px, sim.pz);

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
  const nearPlayerWalkers: { walker: TownStrollingCitizen; wyWorld: number }[] = [];

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

      for (const w of town.animatedParts.walkers) {
        if ((w.pauseTimer ?? 0) > 0) {
          w.pauseTimer = Math.max(0, (w.pauseTimer ?? 0) - dt);
        }
        const prevWx = w.worldX ?? town.centerX + w.cx;
        const prevWz = w.worldZ ?? town.centerZ + w.cz;
        const distPlayerToWalker = Math.hypot(prevWx - sim.px, prevWz - sim.pz);
        const isTalkingProximity =
          distPlayerToWalker < 3.25 && Math.abs(town.group.position.y + w.baseY - sim.py) < 2.2;
        const isPaused = isTalkingProximity || (w.pauseTimer ?? 0) > 0;
        if (!isPaused) {
          w.angle += w.speed * dt;
          w.phase += dt * 6.4;
        }
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
        w.worldX = town.centerX + wxLocal;
        w.worldZ = town.centerZ + wzLocal;
        const wyWorld = getTerrainHeight3D(w.worldX, w.worldZ) + 0.22;
        const wy = wyWorld - town.group.position.y;

        if (distPlayerToWalker < 28) {
          nearPlayerWalkers.push({ walker: w, wyWorld });
        }

        if (isTalkingProximity) {
          const toPx = sim.px - w.worldX;
          const toPz = sim.pz - w.worldZ;
          const toLen = Math.hypot(toPx, toPz) || 1;
          wDirX = toPx / toLen;
          wDirZ = toPz / toLen;
          const dNow = Math.hypot(w.worldX - sim.px, w.worldZ - sim.pz);
          if (dNow < closestTownDist) {
            closestTownDist = dNow;
            closestTownPoint = {
              id: w.id,
              townName: town.name,
              kind: 'npc_chat',
              label: `💬 ${w.npcProfile.name}`,
              hint: '沟通 / 询问指路 / 切磋对战',
              npcProfile: w.npcProfile,
              x: w.worldX,
              y: wyWorld,
              z: w.worldZ,
              radius: 3.25,
            };
          }
        }
        const wRelFwd = wDirX * camFwdX + wDirZ * camFwdZ;
        const wRelRight = wDirX * camRightX + wDirZ * camRightZ;
        if (w.walkFrames) {
          (w.mesh.material as THREE.MeshBasicMaterial).map = sampleHumanWalkFrame(
            w.walkFrames,
            wRelFwd,
            wRelRight,
            w.phase,
            !isPaused && Math.abs(w.speed) > 0.005,
          );
        }
        w.mesh.position.set(wxLocal, wy, wzLocal);
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
      const pPos = { x: sim.px, z: sim.pz };
      resolveTownWallCollisions(pPos, 0.88, town.colliders, sim.py);
      sim.px = pPos.x;
      sim.pz = pPos.z;
      const postColFloorY = getWalkableSurfaceHeight3D(sim.px, sim.pz, sim.py);
      if (!surfingNow && sim.vy <= 0 && Math.abs(postColFloorY - sim.py) < 0.85) {
        sim.py = postColFloorY;
      }

      const doorActors: { x: number; y: number; z: number }[] = [{ x: sim.px, y: sim.py, z: sim.pz }];
      if (sim.followers[0]) {
        doorActors.push({ x: sim.followers[0].x, y: sim.followers[0].y, z: sim.followers[0].z });
      }
      updateProximityAutoDoors3D(town.autoDoors, doorActors, dt);

      for (const bInt of town.interiors) {
        const inside = isInsideBuildingInterior(sim.px, sim.pz, bInt);
        if (inside) activeInteriorNow = bInt;
        bInt.exteriorGroup.visible = true;
        bInt.interiorGroup.visible = true;
        for (let ni = 0; ni < bInt.npcSprites.length; ni++) {
          const npc = bInt.npcSprites[ni];
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

      for (const en of sim.enemies) {
        if (en.hp <= 0) continue;
        const ePos = { x: en.x, z: en.z };
        resolveTownWallCollisions(ePos, en.radius + 0.5, town.colliders);
        en.x = ePos.x;
        en.z = ePos.z;
        if (!en.isBoss && !en.isStreetDuel && Math.hypot(en.x - town.centerX, en.z - town.centerZ) < town.safeRadius + 2) {
          en.aggroed = false;
        }
      }
      for (const pt of town.interactPoints) {
        if (pt.y !== undefined && Math.abs(sim.py - pt.y) > 2.25) continue;
        const d = Math.hypot(pt.x - sim.px, pt.z - sim.pz);
        if (d < pt.radius && d < closestTownDist) {
          closestTownDist = d;
          closestTownPoint = pt;
        }
      }
    }
  }

  // ==================== LIVING WORLD BUBBLES A: SHOPKEEPER DOORWAY WELCOME GREETING ====================
  const bubblesList: LiveWorldBubble[] = worldBubblesRef?.current ?? [];
  const curIntId = activeInteriorNow?.id ?? null;
  if (lastEnteredInteriorIdRef && curIntId !== lastEnteredInteriorIdRef.current) {
    lastEnteredInteriorIdRef.current = curIntId;
    if (activeInteriorNow && activeInteriorNow.npcSprites.length > 0) {
      const hostMesh = activeInteriorNow.npcSprites[0];
      const cosR = Math.cos(activeInteriorNow.rotY);
      const sinR = Math.sin(activeInteriorNow.rotY);
      const hostWx = activeInteriorNow.cx + hostMesh.position.x * cosR + hostMesh.position.z * sinR;
      const hostWz = activeInteriorNow.cz - hostMesh.position.x * sinR + hostMesh.position.z * cosR;
      const hostWy = activeInteriorNow.baseY + hostMesh.position.y + 2.75;

      const greetSpec =
        activeInteriorNow.kind === 'pokemon_center'
          ? { name: '乔伊小姐', emote: 'heart' as const, text: '欢迎光临宝可梦中心！需要恢复体力请到柜台前找我哦～' }
          : activeInteriorNow.kind === 'restaurant'
            ? { name: '饭店店员', emote: 'music' as const, text: '欢迎光临树果饭店！热腾腾的高汤拉面刚出锅呢！' }
            : activeInteriorNow.kind === 'poke_mart'
              ? { name: '百货店员', emote: 'sparkle' as const, text: '欢迎光临友好百货！精灵球与树果补给今天货源充足！' }
              : activeInteriorNow.kind === 'hotel'
                ? { name: '大堂总管', emote: 'happy' as const, text: '欢迎下榻驿站大酒店！请先来一楼前台办理入住领房卡，再去二楼刷卡进房休息哦！' }
                : { name: '公寓主人', emote: 'happy' as const, text: '呀，有训练家来串门做客啦，快请进！' };

      pushWorldSpeechBubble(bubblesList, {
        speakerId: `greet_${activeInteriorNow.id}`,
        speakerName: greetSpec.name,
        emote: greetSpec.emote,
        text: greetSpec.text,
        wx: hostWx,
        wy: hostWy,
        wz: hostWz,
      });
    }
  }

  // ==================== LIVING WORLD BUBBLES B: SPONTANEOUS NPC-TO-NPC STREET BANTER & EMOTES ====================
  if (npcSocialTimerRef && !activeInteriorNow) {
    npcSocialTimerRef.current -= dt;
    if (npcSocialTimerRef.current <= 0) {
      npcSocialTimerRef.current = 4.6 + Math.random() * 3.2;
      let paired = false;
      for (let i = 0; i < nearPlayerWalkers.length && !paired; i++) {
        for (let j = i + 1; j < nearPlayerWalkers.length; j++) {
          const a = nearPlayerWalkers[i];
          const b = nearPlayerWalkers[j];
          const ax = a.walker.worldX ?? 0;
          const az = a.walker.worldZ ?? 0;
          const bx = b.walker.worldX ?? 0;
          const bz = b.walker.worldZ ?? 0;
          const dPair = Math.hypot(ax - bx, az - bz);
          if (dPair > 1.6 && dPair < 6.4) {
            a.walker.pauseTimer = 3.8;
            b.walker.pauseTimer = 4.2;
            const script = STREET_PAIR_BANTER[Math.floor(Math.random() * STREET_PAIR_BANTER.length)];
            pushWorldSpeechBubble(bubblesList, {
              speakerId: a.walker.id,
              speakerName: a.walker.npcProfile.name.split(' ')[0],
              emote: script[0].emote,
              text: script[0].text,
              wx: ax,
              wy: a.wyWorld + 2.65,
              wz: az,
            });
            pushWorldSpeechBubble(bubblesList, {
              speakerId: b.walker.id,
              speakerName: b.walker.npcProfile.name.split(' ')[0],
              emote: script[1].emote,
              text: script[1].text,
              wx: bx,
              wy: b.wyWorld + 2.65,
              wz: bz,
              delayMs: 1350,
            });
            paired = true;
            break;
          }
        }
      }
      if (!paired && nearPlayerWalkers.length > 0 && Math.random() < 0.65) {
        const solo = nearPlayerWalkers[Math.floor(Math.random() * nearPlayerWalkers.length)];
        const m = SOLO_AMBIENT_MUSINGS[Math.floor(Math.random() * SOLO_AMBIENT_MUSINGS.length)];
        pushWorldSpeechBubble(bubblesList, {
          speakerId: solo.walker.id,
          speakerName: solo.walker.npcProfile.name.split(' ')[0],
          emote: m.emote,
          text: m.text,
          wx: solo.walker.worldX ?? sim.px,
          wy: solo.wyWorld + 2.65,
          wz: solo.walker.worldZ ?? sim.pz,
        });
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

  // ==================== MULTI-OPTION BESIDE-CHARACTER ACTION DISPATCHER (`Tab` + `E` / Click) ====================
  const runActionAtIndex = (overrideIdx?: number) => {
    const { actions } = buildInteractActionsForTarget(closestTownPoint, closestNode);
    if (actions.length === 0) return;
    const rawIdx = overrideIdx !== undefined ? overrideIdx : (interactOptionIdxRef?.current ?? 0);
    const chosen = actions[((rawIdx % actions.length) + actions.length) % actions.length];

    if (closestTownPoint) {
      const tp = closestTownPoint;
      const bubbleY = (tp.y ?? sim.py) + 2.75;
      const shortSpeaker = (tp.npcProfile?.name ?? tp.label.replace(/^[^\s]+\s*/, '')).split('·')[0].trim();

      if (chosen.id === 'heal') {
        sim.hp = sim.maxHp;
        sim.healCharges = Math.max(sim.healCharges, 4);
        onHealParty();
        sound.play('levelup');
        spawnPixelParticles(sim.px, sim.py + 1.2, sim.pz, vfxAtlas.starGlint, 16, 3.6, 0.85, 5.2, 6.2);
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: '乔伊小姐',
          emote: 'heart',
          text: '久等啦！你的宝可梦已经全部恢复饱满活力，伤药也为你补满咯！祝旅途顺利～',
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'dine') {
        sim.hp = Math.min(sim.maxHp, sim.hp + Math.round(sim.maxHp * 0.45));
        sim.boostTimer = Math.max(sim.boostTimer, 28);
        sound.play('happy');
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: '树果饭店店员',
          emote: 'music',
          text: '招牌慢熬树果叉烧拉面上桌咯！趁热享用，全队斗志强化 28 秒！',
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'shop') {
        if (document.pointerLockElement) {
          try { document.exitPointerLock(); } catch {}
        }
        sound.play('confirm');
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: '百货收银员',
          emote: 'sparkle',
          text: '欢迎选购！精灵球与树果补给一应俱全哦！',
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        setInRunTownShopOpen(true);
        return;
      }
      if (chosen.id === 'hotel_checkin' && tp.hotelId) {
        const curCard = getHeldHotelKeycard(tp.hotelId);
        const rooms = ['201', '202', '203'];
        const nextRoom = curCard ? rooms[(rooms.indexOf(curCard) + 1) % rooms.length] : '201';
        if (!curCard) {
          const roomFee = 60;
          const paidCoins = sim.coins >= roomFee;
          if (paidCoins) {
            sim.coins -= roomFee;
          }
          setHeldHotelKeycard(tp.hotelId, nextRoom);
          sound.play('coin');
          showBanner(
            paidCoins
              ? `🪪 已支付 ¥${roomFee} 办理入住，获得【${nextRoom} 号豪华客房房卡】！`
              : `🪪 联盟新人礼遇免房费，获得【${nextRoom} 号豪华客房房卡】！`,
            3200,
          );
          pushWorldSpeechBubble(bubblesList, {
            speakerId: tp.id,
            speakerName: '大堂总管',
            emote: 'sparkle',
            text: `入住登记完成！这是您的【${nextRoom} 号客房房卡】，请从左侧楼梯上二楼，在 ${nextRoom} 房门前刷卡进屋睡觉吧！`,
            wx: tp.x,
            wy: bubbleY,
            wz: tp.z,
            isPlayerDialog: true,
          });
        } else {
          setHeldHotelKeycard(tp.hotelId, nextRoom);
          sound.play('confirm');
          showBanner(`🪪 已为您免费调换至【${nextRoom} 号豪华客房房卡】！`, 2600);
          pushWorldSpeechBubble(bubblesList, {
            speakerId: tp.id,
            speakerName: '大堂总管',
            emote: 'happy',
            text: `没问题！已为您更换为二楼【${nextRoom} 号客房房卡】，祝您入住愉快！`,
            wx: tp.x,
            wy: bubbleY,
            wz: tp.z,
            isPlayerDialog: true,
          });
        }
        return;
      }
      if (chosen.id === 'hotel_checkout' && tp.hotelId) {
        const prevCard = getHeldHotelKeycard(tp.hotelId);
        setHeldHotelKeycard(tp.hotelId, null);
        for (const t of proceduralTowns) {
          for (const d of t.autoDoors) {
            if (d.hotelId === tp.hotelId) d.isOpen = false;
          }
        }
        sound.play('cancel');
        showBanner(`🔑 已归还【${prevCard ?? '客房'}】房卡并完成退房！`, 2400);
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: '大堂总管',
          emote: 'heart',
          text: '房卡已收回，退房手续办妥啦！欢迎下次旅途再来下榻驿站大酒店～',
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'door_inspect' && tp.doorRef) {
        const d = tp.doorRef;
        sound.play('cursor');
        const heldCard = getHeldHotelKeycard(d.hotelId);
        const statusSuffix =
          d.mode === 'hotel_keycard'
            ? heldCard === d.roomNumber
              ? `您持有匹配的【${heldCard} 房卡】，可随时刷卡开门！`
              : heldCard
                ? `您当前持有的是【${heldCard} 房卡】，与这间房号不匹配。`
                : '您尚未持有房卡，需先到一楼前台办理入住。'
            : d.isOpen
              ? '当前门处于敞开状态。'
              : '当前门处于关闭状态，可按 E 手动推开。';
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: d.label?.replace(/^[🔒🚪]\s*/, '') ?? '门禁检查',
          emote: 'question',
          text: `${d.inspectNote ?? '一扇结实的体素门。'}${statusSuffix}`,
          wx: tp.x,
          wy: (tp.y ?? sim.py) + 2.35,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'door_toggle' && tp.doorRef) {
        const d = tp.doorRef;
        if (d.mode === 'hotel_keycard' && !d.isOpen) {
          const heldCard = getHeldHotelKeycard(d.hotelId);
          if (!heldCard) {
            sound.play('error');
            showBanner('🔒 客房门已锁！请先前往一楼前台办理入住领取房卡！', 2800);
            pushWorldSpeechBubble(bubblesList, {
              speakerId: tp.id,
              speakerName: `${d.roomNumber ?? ''} 电子门禁`,
              emote: 'exclaim',
              text: `嘀——门禁红灯闪烁！${d.roomNumber ?? ''} 号豪华客房已上锁，请先到一楼前台总管处领取房卡后再来刷卡进入！`,
              wx: tp.x,
              wy: (tp.y ?? sim.py) + 2.35,
              wz: tp.z,
              isPlayerDialog: true,
            });
            return;
          }
          if (heldCard !== d.roomNumber) {
            sound.play('error');
            showBanner(`🔒 房卡不匹配！您持有的是【${heldCard} 房卡】，无法打开 ${d.roomNumber} 号房！`, 2800);
            pushWorldSpeechBubble(bubblesList, {
              speakerId: tp.id,
              speakerName: `${d.roomNumber ?? ''} 电子门禁`,
              emote: 'exclaim',
              text: `嘀——房号不符！这里是 ${d.roomNumber} 号客房，请前往二楼【${heldCard} 号客房】刷卡开门哦！`,
              wx: tp.x,
              wy: (tp.y ?? sim.py) + 2.35,
              wz: tp.z,
              isPlayerDialog: true,
            });
            return;
          }
          orientDoorSwingAwayFromActor(d, sim.px, sim.pz);
          d.isOpen = true;
          if (d.collider) d.collider.disabled = true;
          sound.play('confirm');
          showBanner(`🔓 嘀♪【${heldCard} 房卡】验证通过，客房门已向内推开！`, 2400);
          pushWorldSpeechBubble(bubblesList, {
            speakerId: tp.id,
            speakerName: `${d.roomNumber} 电子门禁`,
            emote: 'sparkle',
            text: `嘀♪ 房卡验证通过！欢迎入住 ${d.roomNumber} 号豪华客房，快进屋在柔软大床上睡一觉吧！`,
            wx: tp.x,
            wy: (tp.y ?? sim.py) + 2.35,
            wz: tp.z,
            isPlayerDialog: true,
          });
          return;
        }
        const willOpen = !d.isOpen;
        if (willOpen) {
          orientDoorSwingAwayFromActor(d, sim.px, sim.pz);
        }
        d.isOpen = willOpen;
        if (d.collider) d.collider.disabled = d.isOpen;
        sound.play(d.isOpen ? 'confirm' : 'cancel');
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: d.label?.replace(/^[🔒🚪]\s*/, '') ?? '房门',
          emote: 'happy',
          text: d.isOpen ? '咔嗒——推开了门！' : '咔嗒——随手关上了门。',
          wx: tp.x,
          wy: (tp.y ?? sim.py) + 2.25,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'rest') {
        if (tp.hotelId && tp.roomNumber) {
          const heldCard = getHeldHotelKeycard(tp.hotelId);
          if (heldCard !== tp.roomNumber) {
            sound.play('error');
            pushWorldSpeechBubble(bubblesList, {
              speakerId: tp.id,
              speakerName: tp.label.replace(/^🛏️\s*/, ''),
              emote: 'exclaim',
              text: '您还没有办理这间客房的入住登记哦！请先去一楼前台领取房卡。',
              wx: tp.x,
              wy: bubbleY,
              wz: tp.z,
              isPlayerDialog: true,
            });
            return;
          }
        }
        sim.hp = sim.maxHp;
        sim.healCharges = Math.max(sim.healCharges, 4);
        sim.boostTimer = Math.max(sim.boostTimer, 35);
        onHealParty();
        sound.play('heal_jingle');
        spawnPixelParticles(sim.px, sim.py + 1.1, sim.pz, vfxAtlas.starGlint, 16, 3.6, 0.85, 5.0, 6.0);
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: shortSpeaker,
          emote: 'heart',
          text: '盖上松软被子美美地睡了一觉！全队体力与伤药已完全恢复，并获得 35 秒充沛斗志加成！',
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'hsr_map') {
        if (document.pointerLockElement) {
          try { document.exitPointerLock(); } catch {}
        }
        sound.play('confirm');
        setWorldMapOpen(true);
        return;
      }
      if (chosen.id === 'bus_hsr' || chosen.id === 'bus_pc') {
        const navs: { id: string; label: string; x: number; z: number }[] = autoNavTargetsRef?.current ?? [];
        const match =
          chosen.id === 'bus_hsr'
            ? navs.find((n) => n.id.includes('station'))
            : navs.find((n) => n.id.includes('nurse') || n.id.includes('pc'));
        if (match) {
          teleportIntraCityBusRef?.current?.(match.x, match.z, match.label);
        }
        return;
      }
      if (chosen.id === 'bus_board') {
        if (document.pointerLockElement) {
          try { document.exitPointerLock(); } catch {}
        }
        sound.play('confirm');
        setActiveBusStopModal?.({ townName: tp.townName, busX: tp.x, busZ: tp.z });
        return;
      }
      if (chosen.id === 'chat') {
        sound.play('cursor');
        const turn = NPC_CHAT_TURN_MAP.get(tp.id) ?? 0;
        NPC_CHAT_TURN_MAP.set(tp.id, turn + 1);
        const lines = tp.npcProfile
          ? [tp.npcProfile.greeting, ...tp.npcProfile.chatLines]
          : tp.kind === 'pokemon_center'
            ? ['无论白天还是深夜，宝可梦中心的温暖灯光都会一直为训练家点亮！', '走左边楼梯上二楼就是联机沙龙，随时去坐坐吧～']
            : tp.kind === 'restaurant'
              ? ['我们的后厨是独立封闭式净厨，主厨铁平正在里面小火熬制树果高汤呢！', '夜里逛街饿了，随时来喝碗热汤暖暖身子！']
              : tp.kind === 'poke_mart'
                ? ['货架上的每一瓶伤药和精灵球都是体素精工陈列的哦！', '想去火车站的话，门口大马路边就能坐市内公交直达！']
                : ['二楼有三间精装体素大床房，走楼梯上去靠近床边就能休息！'];
        const picked = lines[turn % lines.length];
        if (!NPC_CHAT_GIFTED.has(tp.id)) {
          NPC_CHAT_GIFTED.add(tp.id);
          sim.coins += 18;
          showBanner(`🎁 与「${shortSpeaker}」相谈甚欢，获赠友好纪念 +18 金币！`, 2400);
        }
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: shortSpeaker,
          emote: 'happy',
          text: picked,
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'ask') {
        sound.play('confirm');
        setAskQuickNavOpen?.(true);
        const navs: { id: string; label: string; x: number; z: number }[] = (autoNavTargetsRef?.current ?? []).filter(
          (n: { id: string }) => !n.id.includes('suite_bed'),
        );
        const nearestFacility = navs
          .filter((n) => Math.hypot(n.x - sim.px, n.z - sim.pz) > 8)
          .sort((a, b) => Math.hypot(a.x - sim.px, a.z - sim.pz) - Math.hypot(b.x - sim.px, b.z - sim.pz))[0];
        const tipText = nearestFacility
          ? `离这儿最近的是「${nearestFacility.label}」，大约 ${Math.round(Math.hypot(nearestFacility.x - sim.px, nearestFacility.z - sim.pz))} 米远！点右侧菜单里的地点就能自动带路过去哦！`
          : `想找城里的设施或去城郊高铁站？直接在右侧列表点选就能自动寻路啦！`;
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: shortSpeaker,
          emote: 'question',
          text: tipText,
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        return;
      }
      if (chosen.id === 'battle' && tp.npcProfile) {
        sound.play('confirm');
        pushWorldSpeechBubble(bubblesList, {
          speakerId: tp.id,
          speakerName: tp.npcProfile.name,
          emote: 'exclaim',
          text: '正合我意！来一场堂堂正正的街头宝可梦切磋吧，去吧搭档！',
          wx: tp.x,
          wy: bubbleY,
          wz: tp.z,
          isPlayerDialog: true,
        });
        startStreetDuelRef?.current?.({
          npcName: tp.npcProfile.name,
          npcSprite: tp.npcProfile.sprite,
          species: (tp.npcProfile.battleSpecies || 'pikachu') as SpeciesId,
          x: tp.x,
          z: tp.z,
        });
        return;
      }
    }

    if (closestNode) {
      const target = closestNode;
      if (target.cooldown > 0) return;
      if (target.kind === 'signpost') {
        sound.play('cursor');
        let bestLk = LAKE_BASINS_3D[0];
        let bestD = 1e9;
        for (const lk of LAKE_BASINS_3D) {
          const d = Math.hypot(lk.cx - target.x, lk.cz - target.z);
          if (d < bestD) {
            bestD = d;
            bestLk = lk;
          }
        }
        const dxL = bestLk.cx - target.x;
        const dzL = bestLk.cz - target.z;
        const dirTxt = `${dzL < -6 ? '北' : dzL > 6 ? '南' : ''}${dxL > 6 ? '东' : dxL < -6 ? '西' : ''}` || '前方';
        pushWorldSpeechBubble(bubblesList, {
          speakerId: target.id,
          speakerName: '木制路牌',
          emote: 'sparkle',
          text: `向${dirTxt} ${Math.round(bestD)}m 处有清澈湖泊！按 M 或 ~ 键可随时打开掌机地形地图哦！`,
          wx: target.x,
          wy: target.y + 2.2,
          wz: target.z,
          isPlayerDialog: true,
        });
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
          target.mesh.scale.setScalar(target.baseScaleX * shrink);
          sim.dmgPops.push({
            id: sim.nextId++,
            wx: target.x,
            wy: target.y + 1.3,
            wz: target.z,
            text: `敲击体素矿石 (${target.hp}/${target.maxHp})`,
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
          showBanner('⛏️ 敲碎体素晶簇矿石！收获 星星沙子 +10、金币 +55！', 2400);
        }
      }
    }
  };

  if (executeInteractActionRef) {
    executeInteractActionRef.current = (idx: number) => runActionAtIndex(idx);
  }
  triggerInteractRef.current = closestTownPoint || closestNode ? () => runActionAtIndex() : null;

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
  if (playerShadow) {
    playerShadow.position.set(sim.px, groundY + 0.04, sim.pz);
  }

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

  if (sun.castShadow) {
    const sSnapX = Math.round(sim.px / 8) * 8;
    const sSnapZ = Math.round(sim.pz / 8) * 8;
    if (sun.target.position.x !== sSnapX || sun.target.position.z !== sSnapZ) {
      sun.position.set(sSnapX + 34, sim.py + 50, sSnapZ + 28);
      sun.target.position.set(sSnapX, sim.py, sSnapZ);
      sun.target.updateMatrixWorld();
    }
  }

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
        damageEnemy3D(en, dmg, '#4dabf7');
      }
    }
  }
  return { closestTownPoint, activeTownNow, activeInteriorNow, closestNode, inTownPeaceZone };
}
