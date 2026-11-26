import type { ArenaSharedCtx } from './arenaTypesAndProps';
import { DEFAULT_WORLD_TOUR_STATE, WORLD_CITIES } from '../../data/worldTour';
import { getPixelEmoteTexture, sampleAnimatedFrame } from '../../data/worldTextures3D';
import * as THREE from 'three';
import { getPokemonWorldScale3D } from '../../data/catalog';
import { WATER_LEVEL_3D, getTerrainHeight3D, getWalkableSurfaceHeight3D } from '../../data/survivorsTactics';
import { worldToGeo } from '../../data/geoTerrain3D';
import { pickPmdDirIndex, samplePmd8DirFrame } from '../../data/pmdSprites3D';
import { BILLBOARD_PITCH_TILT } from './arenaTypesAndProps';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function renderHubDioramaFrame3D(rawCtx: Record<string, any>) {
  const {
    applyLiveSolarAtmosphere,
    camera,
    dt,
    emoteKinds,
    externalPausedRef,
    geoHighwayStreamer,
    heroEmoteSprite,
    heroFrames,
    horizonBackdrop,
    metaRef,
    now,
    petEmoteSprite,
    phase,
    playerShadow,
    playerSprite,
    playerSpriteMat,
    previewSprites,
    renderer,
    scene,
    sim,
    syncFloraBillboards,
    updateWorldAround,
    waterMat,
    worldMapOpenRef,
  } = rawCtx as ArenaSharedCtx;

  // Completely pause WebGL 3D rendering while the Handheld Console or World Map covers the screen!
  if (externalPausedRef.current || worldMapOpenRef.current) {
    return;
  }

  // Render live 3D environment centered on the player's EXACT saved world checkpoint `(sim.px, sim.pz)`!
  const ax = sim.px;
  const az = sim.pz;
  updateWorldAround?.(ax, az);
  geoHighwayStreamer?.updateAround?.(ax, az);

  const tourNow = metaRef.current.worldTour ?? DEFAULT_WORLD_TOUR_STATE;
  const hubCity =
    (tourNow.currentCityId ? WORLD_CITIES.find((c: { id: string }) => c.id === tourNow.currentCityId) : null) ??
    WORLD_CITIES[0];
  const liveGeo = worldToGeo(ax, az);
  const heroY0 = Math.max(WATER_LEVEL_3D + 0.12, getWalkableSurfaceHeight3D(ax, az, sim.py));
  applyLiveSolarAtmosphere(
    liveGeo?.lat ?? tourNow.homeCoords?.lat ?? hubCity.lat,
    liveGeo?.lng ?? tourNow.homeCoords?.lng ?? hubCity.lng,
    ax,
    heroY0,
    az,
    dt,
    Date.now(),
  );

  const t = now * 0.001;
  const isMapPreview = phase === 'map_select';
  const orbit = t * 0.085 + 0.42;
  const camRad = isMapPreview ? 24.5 : 19.5;
  const cx = ax + Math.sin(orbit) * camRad;
  const cz = az + Math.cos(orbit) * camRad - 2.2;
  const camFloor = getWalkableSurfaceHeight3D(cx, cz);
  const camY = Math.max(camFloor + (isMapPreview ? 10.5 : 7.8), heroY0 + (isMapPreview ? 13.8 : 9.8));
  const lookY = heroY0 + (isMapPreview ? 1.3 : 1.7);
  const lookZ = az - 2.4;
  const pCamFwdX = ax - cx;
  const pCamFwdZ = lookZ - cz;
  const pCamLen = Math.hypot(pCamFwdX, pCamFwdZ) || 1;
  const cfX = pCamFwdX / pCamLen;
  const cfZ = pCamFwdZ / pCamLen;
  const crX = -cfZ;
  const crZ = cfX;
  const prevYaw = Math.atan2(cx - ax, cz - lookZ);
  const prevPitch = Math.atan2(Math.max(0.1, camY - lookY), pCamLen);
  const tiltX = -prevPitch * BILLBOARD_PITCH_TILT;
  syncFloraBillboards(prevYaw, prevPitch, t);

  // Living Protagonist at their real saved location `(ax, heroY0, az)`
  const heroCycle = t % 6.2;
  const heroHop =
    heroCycle > 1.2 && heroCycle < 1.9
      ? Math.abs(Math.sin(((heroCycle - 1.2) / 0.7) * Math.PI * 2)) * 0.48
      : 0;
  playerSprite.position.set(ax, heroY0 + heroHop - 0.04, az);
  playerSprite.rotation.set(tiltX * 0.35, prevYaw, 0, 'YXZ');
  playerShadow.position.set(ax, heroY0 + 0.06, az);
  const heroFrame =
    heroHop > 0.08
      ? heroFrames.down_1
      : heroCycle > 3.0 && heroCycle < 4.1
        ? heroFrames.left_0
        : heroCycle > 4.4 && heroCycle < 5.4
          ? heroFrames.right_0
          : Math.floor(t * 2.2) % 2 === 0
            ? heroFrames.down_idle0 ?? heroFrames.down_0
            : heroFrames.down_idle1 ?? heroFrames.down_0;
  if (playerSpriteMat.map !== heroFrame) {
    playerSpriteMat.map = heroFrame;
    playerSpriteMat.needsUpdate = true;
  }
  const showHeroEmote = heroCycle > 1.0 && heroCycle < 2.9;
  heroEmoteSprite.visible = showHeroEmote;
  if (showHeroEmote) {
    const eIdx = Math.floor(t / 6.2) % emoteKinds.length;
    const eTex = getPixelEmoteTexture(emoteKinds[eIdx]);
    if (heroEmoteSprite.material.map !== eTex) {
      heroEmoteSprite.material.map = eTex;
      heroEmoteSprite.needsUpdate = true;
    }
    heroEmoteSprite.position.set(ax + 0.2, heroY0 + 3.45 + heroHop + Math.sin(t * 5) * 0.14, az);
  }

  // ALL Squad Followers orbit around `(ax, az)`, face the rotating camera, hop playfully, and pop cute pixel emotes!
  const emoteFollowerIdx = Math.floor(t / 4.8) % Math.max(1, sim.followers.length);
  const petEmotePhase = t % 4.8;
  let petEmotePlaced = false;
  sim.followers.forEach((f, idx) => {
    const baseAng = (idx * Math.PI * 2) / Math.max(1, sim.followers.length) + 0.65;
    const rad = 3.2 + (idx % 2) * 1.15;
    const fx = ax + Math.cos(baseAng + Math.sin(t * 0.35 + idx) * 0.12) * rad;
    const fz = az + Math.sin(baseAng + Math.cos(t * 0.32 + idx) * 0.12) * rad;
    const gy = Math.max(WATER_LEVEL_3D + 0.1, getWalkableSurfaceHeight3D(fx, fz));
    const cheer = (t + idx * 1.35) % 4.2;
    const isCheering = cheer < 0.62;
    const isHubFlightForm =
      (f.species === 'charmander' && f.stage === 'adult') ||
      (f.species === 'dratini' && f.stage === 'adult') ||
      f.species === 'gastly' ||
      f.species === 'mew';
    const hop = isHubFlightForm
      ? 0.65 + Math.sin(t * 3.8 + idx) * 0.18
      : isCheering
        ? Math.abs(Math.sin((cheer / 0.62) * Math.PI * 2)) * 0.36
        : 0;
    const sc = getPokemonWorldScale3D(f.species, f.stage);
    if (f.sprite) {
      f.sprite.position.set(fx, gy + hop - 0.04, fz);
      f.sprite.rotation.set(tiltX, prevYaw, 0);
      if (f.pmdSheet?.ready) {
        const lookDirX = Math.sin(t * 0.25 + idx * 1.4);
        const lookDirZ = Math.cos(t * 0.25 + idx * 1.4);
        const relFwd = lookDirX * cfX + lookDirZ * cfZ;
        const relRight = lookDirX * crX + lookDirZ * crZ;
        const dirIdx = pickPmdDirIndex(relFwd, relRight);
        const hubAnimT = isHubFlightForm || isCheering ? t * 1.1 + idx * 0.5 : 0;
        (f.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
          f.pmdSheet,
          dirIdx,
          hubAnimT,
        );
        f.sprite.scale.set(sc, sc, 1);
      } else if (f.animSheet) {
        const hubAnimT = isHubFlightForm || isCheering ? t * 1.15 + idx * 0.4 : 0;
        (f.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
          f.animSheet,
          hubAnimT,
        );
        f.sprite.scale.set(sc, sc, 1);
      }
    }
    if (f.shadow) {
      f.shadow.position.set(fx, gy + 0.06, fz);
    }
    if (idx === emoteFollowerIdx && petEmotePhase > 1.2 && petEmotePhase < 3.1) {
      petEmotePlaced = true;
      const peTex = getPixelEmoteTexture(emoteKinds[(idx + 1) % emoteKinds.length]);
      if (petEmoteSprite.material.map !== peTex) {
        petEmoteSprite.material.map = peTex;
        petEmoteSprite.material.needsUpdate = true;
      }
      petEmoteSprite.position.set(fx, gy + sc + 0.75 + hop + Math.sin(t * 5.2) * 0.12, fz);
    }
  });
  petEmoteSprite.visible = petEmotePlaced;

  // Living Wildlife Diorama Update around `(ax, az)`
  for (const ps of previewSprites) {
    if (ps.kind === 'flyby') {
      const span = ps.span ?? 74;
      const spd = ps.speed ?? 6.0;
      const prog = (((t * spd + ps.phase * 6) % (span * 2)) + span * 2) % (span * 2) - span;
      const dx = ps.dirX ?? 1;
      const dz = ps.dirZ ?? 0;
      const wx = ps.baseX + dx * prog;
      const wz = ps.baseZ + dz * prog;
      const gy = getTerrainHeight3D(wx, wz);
      const flyY = Math.max(gy + 5.5, heroY0 + (ps.altitude ?? 11) + Math.sin(t * 1.9 + ps.phase) * 0.75);
      const relFwd = dx * cfX + dz * cfZ;
      const relRight = dx * crX + dz * crZ;
      const bankZ = Math.max(-0.14, Math.min(0.14, -relRight * 0.1));
      ps.sprite.visible = true;
      ps.shadow.visible = true;
      ps.sprite.position.set(wx, flyY, wz);
      ps.sprite.rotation.set(tiltX, prevYaw, bankZ);
      ps.shadow.position.set(wx, Math.max(WATER_LEVEL_3D, gy) + 0.08, wz);
      if (ps.pmdSheet?.ready) {
        const dirIdx = pickPmdDirIndex(relFwd, relRight);
        (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
          ps.pmdSheet,
          dirIdx,
          t * 1.55 + ps.phase,
        );
      } else if (ps.animSheet) {
        (ps.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
          ps.animSheet,
          t * 1.3 + ps.phase,
        );
      }
      continue;
    }

    if (ps.kind === 'road_stroll') {
      const span = ps.span ?? 28;
      const ang = t * (ps.speed ?? 0.12) + ps.phase;
      const sPos = Math.sin(ang) * span;
      const sVel = Math.cos(ang);
      const dx = (ps.dirX ?? 1) * (sVel >= 0 ? 1 : -1);
      const dz = (ps.dirZ ?? 0) * (sVel >= 0 ? 1 : -1);
      const wx = ps.baseX + (ps.dirX ?? 1) * sPos;
      const wz = ps.baseZ + (ps.dirZ ?? 0) * sPos;
      const gy = Math.max(WATER_LEVEL_3D + 0.05, getWalkableSurfaceHeight3D(wx, wz));
      const hop = Math.abs(Math.sin(t * 6.2 + ps.phase)) * 0.14;
      ps.sprite.position.set(wx, gy + hop - 0.04, wz);
      ps.sprite.rotation.set(tiltX * 0.45, prevYaw, 0, 'YXZ');
      ps.shadow.position.set(wx, gy + 0.06, wz);
      if (ps.pmdSheet?.ready) {
        const relFwd = dx * cfX + dz * cfZ;
        const relRight = dx * crX + dz * crZ;
        const dirIdx = pickPmdDirIndex(relFwd, relRight);
        (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
          ps.pmdSheet,
          dirIdx,
          t * 1.25 + ps.phase,
        );
      } else if (ps.animSheet) {
        (ps.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(ps.animSheet, t + ps.phase);
      }
      continue;
    }

    if (ps.kind === 'water_leap') {
      const cycle = (t * 0.42 + ps.phase) % 3.2;
      const isAirborne = cycle < 1.35;
      if (!isAirborne) {
        ps.sprite.visible = false;
        ps.shadow.visible = false;
        continue;
      }
      const u = cycle / 1.35;
      const arc = Math.sin(u * Math.PI);
      const drift = (u - 0.5) * 4.4;
      const dirAng = Math.floor((t * 0.42 + ps.phase) / 3.2) * 1.9 + ps.phase;
      const dx = Math.cos(dirAng);
      const dz = Math.sin(dirAng);
      const wx = ps.baseX + dx * drift;
      const wz = ps.baseZ + dz * drift;
      const y = WATER_LEVEL_3D - 0.65 + arc * (ps.jumpH ?? 3.6);
      const tiltArc = (0.5 - u) * 0.48;
      ps.sprite.visible = true;
      ps.shadow.visible = true;
      ps.sprite.position.set(wx, y, wz);
      ps.sprite.rotation.set(tiltX, prevYaw, tiltArc);
      ps.shadow.position.set(wx, WATER_LEVEL_3D + 0.05, wz);
      if (ps.pmdSheet?.ready) {
        const relFwd = dx * cfX + dz * cfZ;
        const relRight = dx * crX + dz * crZ;
        const dirIdx = pickPmdDirIndex(relFwd, relRight);
        (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
          ps.pmdSheet,
          dirIdx,
          t * 2.2 + ps.phase,
        );
      }
      continue;
    }

    if (ps.kind === 'water_swim') {
      const a = t * 0.28 + ps.phase;
      const wx = ps.baseX + Math.cos(a) * 4.2;
      const wz = ps.baseZ + Math.sin(a * 0.8) * 3.4;
      const vx = -Math.sin(a) * 4.2;
      const vz = Math.cos(a * 0.8) * 3.4 * 0.8;
      const vLen = Math.hypot(vx, vz) || 1;
      const bob = Math.sin(t * 2.5 + ps.phase) * 0.1;
      ps.sprite.position.set(wx, WATER_LEVEL_3D + 0.02 + bob, wz);
      ps.sprite.rotation.set(tiltX, prevYaw, 0);
      ps.shadow.position.set(wx, WATER_LEVEL_3D + 0.03, wz);
      if (ps.pmdSheet?.ready) {
        const relFwd = (vx / vLen) * cfX + (vz / vLen) * cfZ;
        const relRight = (vx / vLen) * crX + (vz / vLen) * crZ;
        const dirIdx = pickPmdDirIndex(relFwd, relRight);
        (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
          ps.pmdSheet,
          dirIdx,
          t * 1.1 + ps.phase,
        );
      }
      continue;
    }

    if (ps.kind === 'burrow') {
      const cycle = (t * 0.55 + ps.phase) % 4.0;
      const holeIdx = Math.floor((t * 0.55 + ps.phase) / 4.0);
      const ox = Math.sin(holeIdx * 2.3 + ps.phase) * 2.2;
      const oz = Math.cos(holeIdx * 1.9 + ps.phase) * 2.2;
      const wx = ps.baseX + ox;
      const wz = ps.baseZ + oz;
      const gy = getTerrainHeight3D(wx, wz);
      let emerge = 0;
      if (cycle < 0.35) emerge = cycle / 0.35;
      else if (cycle < 2.25) emerge = 1.0;
      else if (cycle < 2.65) emerge = 1.0 - (cycle - 2.25) / 0.4;
      else emerge = 0;

      if (emerge <= 0.02 || gy < WATER_LEVEL_3D + 0.15) {
        ps.sprite.visible = false;
        ps.shadow.visible = false;
        continue;
      }
      ps.sprite.visible = true;
      ps.shadow.visible = true;
      ps.sprite.scale.set(ps.scale, ps.scale * emerge, 1);
      ps.sprite.position.set(wx, gy - 0.06, wz);
      ps.sprite.rotation.set(tiltX, prevYaw, 0);
      ps.shadow.position.set(wx, gy + 0.05, wz);
      if (ps.pmdSheet?.ready) {
        const peekAng = Math.sin(t * 2.0 + ps.phase) * 1.3;
        const dirIdx = pickPmdDirIndex(-Math.cos(peekAng), Math.sin(peekAng));
        (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
          ps.pmdSheet,
          dirIdx,
          t * 0.9 + ps.phase,
        );
      }
      continue;
    }

    // Default: peaceful meadow grazing wild Pokémon
    const hop = Math.abs(Math.sin(t * 4.2 + ps.phase)) * 0.14;
    const wx = ps.baseX + Math.sin(t * 0.42 + ps.phase) * 1.6;
    const wz = ps.baseZ + Math.cos(t * 0.36 + ps.phase) * 1.6;
    const vx = Math.cos(t * 0.42 + ps.phase) * 0.67;
    const vz = -Math.sin(t * 0.36 + ps.phase) * 0.58;
    const vLen = Math.hypot(vx, vz) || 1;
    const gy = getWalkableSurfaceHeight3D(wx, wz);
    ps.sprite.position.set(wx, gy + hop - 0.04, wz);
    ps.sprite.rotation.set(tiltX, prevYaw, 0);
    ps.shadow.position.set(wx, gy + 0.06, wz);
    if (ps.pmdSheet?.ready) {
      const relFwd = (vx / vLen) * cfX + (vz / vLen) * cfZ;
      const relRight = (vx / vLen) * crX + (vz / vLen) * crZ;
      const dirIdx = pickPmdDirIndex(relFwd, relRight);
      (ps.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
        ps.pmdSheet,
        dirIdx,
        t + ps.phase,
      );
    } else if (ps.animSheet) {
      (ps.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(ps.animSheet, t + ps.phase);
    }
  }

  // Wide elevated diorama overlook camera centered on player's live saved location `(ax, lookY, lookZ)`!
  camera.position.set(cx, camY, cz);
  camera.lookAt(ax, lookY, lookZ);
  horizonBackdrop.position.set(cx, 0, cz);
  waterMat.uniforms.uTime.value = t;
  if (horizonBackdrop.userData?.skyUniforms?.uTime) {
    horizonBackdrop.userData.skyUniforms.uTime.value = t;
  }
  renderer.render(scene, camera);
}
