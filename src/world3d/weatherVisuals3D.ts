import * as THREE from 'three';
import type { WeatherKind } from '../utils/weatherSystem';

export interface WeatherVisuals3DController {
  update: (params: {
    dt: number;
    kind: WeatherKind;
    centerX: number;
    centerY: number;
    centerZ: number;
    camFwdX: number;
    camFwdZ: number;
    isIndoor: boolean;
    reduceFlashes: boolean;
    sun: THREE.DirectionalLight;
    hemi: THREE.HemisphereLight;
    scene: THREE.Scene;
    onLightningStrike?: (isNear: boolean) => void;
  }) => void;
  dispose: () => void;
}

const RAIN_STREAK_COUNT = 680;
const POINT_PARTICLE_COUNT = 520;
const BOLT_MAX_SEGMENTS = 48; // Main jagged trunk + branching forks

/**
 * Rich HD-2D 3D Weather Visuals Controller:
 * - `rain` / `storm`: 680 slanted luminous 3D rain streaks (`THREE.LineSegments`) + 260 ground splash specks
 * - `storm`: Real forked 3D lightning bolts in the player's forward sky + 2-pulse electric sky/light flash
 * - `hail`: 480 bright icy hailstones slamming down at high speed and visibly bouncing off the ground
 * - `snow`: 520 gently swirling bright snowflakes
 * - Automatically hides outdoor precipitation inside buildings (`isIndoor === true`)
 */
export function createWeatherVisuals3D(scene: THREE.Scene): WeatherVisuals3DController {
  // 1. Slanted 3D Rain Streaks (LineSegments: 2 vertices per raindrop!)
  const rainHeads = new Float32Array(RAIN_STREAK_COUNT * 3);
  const rainSpeedJitter = new Float32Array(RAIN_STREAK_COUNT);
  const rainLineVerts = new Float32Array(RAIN_STREAK_COUNT * 6);
  for (let i = 0; i < RAIN_STREAK_COUNT; i++) {
    const isNearLayer = i < RAIN_STREAK_COUNT * 0.35;
    const spread = isNearLayer ? 18 : 34;
    rainHeads[i * 3] = (Math.random() - 0.5) * spread;
    rainHeads[i * 3 + 1] = Math.random() * 19;
    rainHeads[i * 3 + 2] = (Math.random() - 0.5) * spread;
    rainSpeedJitter[i] = 0.85 + Math.random() * 0.35;
  }
  const rainGeo = new THREE.BufferGeometry();
  const rainPosAttr = new THREE.BufferAttribute(rainLineVerts, 3);
  rainGeo.setAttribute('position', rainPosAttr);
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xd0ebff,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.visible = false;
  rainLines.frustumCulled = false;
  rainLines.renderOrder = 6;
  scene.add(rainLines);

  // 2. Point Particles (Snowflakes, Bouncing Hailstones, or Rain Ground Splashes!)
  const ptPositions = new Float32Array(POINT_PARTICLE_COUNT * 3);
  const ptVelY = new Float32Array(POINT_PARTICLE_COUNT);
  const ptPhase = new Float32Array(POINT_PARTICLE_COUNT);
  for (let i = 0; i < POINT_PARTICLE_COUNT; i++) {
    ptPositions[i * 3] = (Math.random() - 0.5) * 32;
    ptPositions[i * 3 + 1] = Math.random() * 18;
    ptPositions[i * 3 + 2] = (Math.random() - 0.5) * 32;
    ptVelY[i] = -1;
    ptPhase[i] = Math.random() * Math.PI * 2;
  }
  const ptGeo = new THREE.BufferGeometry();
  const ptPosAttr = new THREE.BufferAttribute(ptPositions, 3);
  ptGeo.setAttribute('position', ptPosAttr);
  const ptMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.48,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const weatherPoints = new THREE.Points(ptGeo, ptMat);
  weatherPoints.visible = false;
  weatherPoints.frustumCulled = false;
  weatherPoints.renderOrder = 6;
  scene.add(weatherPoints);

  // 3. Forked 3D Storm Lightning Bolt (Core White Bolt + Electric Cyan Outer Halo + Flash Light!)
  const boltVerts = new Float32Array(BOLT_MAX_SEGMENTS * 6);
  const boltGeo = new THREE.BufferGeometry();
  const boltPosAttr = new THREE.BufferAttribute(boltVerts, 3);
  boltGeo.setAttribute('position', boltPosAttr);

  const boltCoreMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const boltCoreLine = new THREE.LineSegments(boltGeo, boltCoreMat);
  boltCoreLine.visible = false;
  boltCoreLine.frustumCulled = false;
  boltCoreLine.renderOrder = 14;
  scene.add(boltCoreLine);

  const boltGlowVerts = new Float32Array(BOLT_MAX_SEGMENTS * 6);
  const boltGlowGeo = new THREE.BufferGeometry();
  const boltGlowAttr = new THREE.BufferAttribute(boltGlowVerts, 3);
  boltGlowGeo.setAttribute('position', boltGlowAttr);
  const boltGlowMat = new THREE.LineBasicMaterial({
    color: 0x74c0fc,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const boltGlowLine = new THREE.LineSegments(boltGlowGeo, boltGlowMat);
  boltGlowLine.visible = false;
  boltGlowLine.frustumCulled = false;
  boltGlowLine.renderOrder = 13;
  scene.add(boltGlowLine);

  const flashLight = new THREE.DirectionalLight(0xcce8ff, 0);
  flashLight.position.set(18, 42, 16);
  scene.add(flashLight);

  // Runtime state
  let windClock = 0;
  let lastKind: WeatherKind | null = null;
  let nextBoltTimer = 1.4; // Fast first strike when switching to storm!
  let boltAge = 99;
  let boltDuration = 0.42;
  let boltActiveSegs = 0;
  const tmpFlashSky = new THREE.Color(0xd8ecff);

  const buildLightningBolt = (
    cx: number,
    cy: number,
    cz: number,
    fwdX: number,
    fwdZ: number,
  ): boolean => {
    const fLen = Math.hypot(fwdX, fwdZ);
    const nx = fLen > 0.01 ? fwdX / fLen : 0;
    const nz = fLen > 0.01 ? fwdZ / fLen : -1;
    // Strike visibly inside the player's forward ±52° view cone (18m..38m away!)
    const angleOff = (Math.random() - 0.5) * 1.75;
    const cosA = Math.cos(angleOff);
    const sinA = Math.sin(angleOff);
    const dirX = nx * cosA - nz * sinA;
    const dirZ = nx * sinA + nz * cosA;
    const dist = 17 + Math.random() * 21;
    const isNear = dist < 26;

    const topY = cy + 36 + Math.random() * 10;
    const botY = cy - 1.5;
    let curX = cx + dirX * dist + (Math.random() - 0.5) * 4;
    let curZ = cz + dirZ * dist + (Math.random() - 0.5) * 4;
    let curY = topY;

    const trunkSteps = 13;
    let segIdx = 0;
    const pushSeg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      if (segIdx >= BOLT_MAX_SEGMENTS) return;
      const o = segIdx * 6;
      boltVerts[o] = ax;
      boltVerts[o + 1] = ay;
      boltVerts[o + 2] = az;
      boltVerts[o + 3] = bx;
      boltVerts[o + 4] = by;
      boltVerts[o + 5] = bz;
      // Slightly offset secondary halo stroke for visible crisp thickness across WebGL
      const j = 0.24;
      boltGlowVerts[o] = ax + j;
      boltGlowVerts[o + 1] = ay;
      boltGlowVerts[o + 2] = az - j;
      boltGlowVerts[o + 3] = bx + j;
      boltGlowVerts[o + 4] = by;
      boltGlowVerts[o + 5] = bz - j;
      segIdx += 1;
    };

    for (let s = 1; s <= trunkSteps; s++) {
      const frac = s / trunkSteps;
      const nextY = topY + (botY - topY) * frac;
      const jitter = s < trunkSteps ? 2.4 : 0.6;
      const nextX = curX + (Math.random() - 0.5) * jitter * 2;
      const nextZ = curZ + (Math.random() - 0.5) * jitter * 2;
      pushSeg(curX, curY, curZ, nextX, nextY, nextZ);

      // Spawn dramatic forked side branches on upper-mid trunk segments
      if (s >= 3 && s <= 9 && Math.random() < 0.48) {
        let fx = nextX;
        let fy = nextY;
        let fz = nextZ;
        const branchDirX = (Math.random() - 0.5) * 3.6;
        const branchDirZ = (Math.random() - 0.5) * 3.6;
        const bSteps = 3 + Math.floor(Math.random() * 2);
        for (let b = 0; b < bSteps; b++) {
          const nfx = fx + branchDirX + (Math.random() - 0.5) * 1.6;
          const nfy = fy - (2.4 + Math.random() * 2.1);
          const nfz = fz + branchDirZ + (Math.random() - 0.5) * 1.6;
          pushSeg(fx, fy, fz, nfx, nfy, nfz);
          fx = nfx;
          fy = nfy;
          fz = nfz;
        }
      }

      curX = nextX;
      curY = nextY;
      curZ = nextZ;
    }

    boltActiveSegs = segIdx;
    boltGeo.setDrawRange(0, boltActiveSegs * 2);
    boltGlowGeo.setDrawRange(0, boltActiveSegs * 2);
    boltPosAttr.needsUpdate = true;
    boltGlowAttr.needsUpdate = true;
    flashLight.position.set(curX, topY, curZ);
    return isNear;
  };

  return {
    update({
      dt,
      kind,
      centerX,
      centerY,
      centerZ,
      camFwdX,
      camFwdZ,
      isIndoor,
      reduceFlashes,
      sun,
      hemi,
      scene: activeScene,
      onLightningStrike,
    }) {
      windClock += dt;

      if (kind !== lastKind) {
        lastKind = kind;
        if (kind === 'storm') {
          // Trigger an early dramatic bolt (~1.0s) so players immediately see storm lightning!
          nextBoltTimer = 0.8 + Math.random() * 0.9;
        }
        // Reset point particles when switching weather mode so snow/hail/splashes start fresh
        for (let i = 0; i < POINT_PARTICLE_COUNT; i++) {
          ptPositions[i * 3] = (Math.random() - 0.5) * 32;
          ptPositions[i * 3 + 1] = kind === 'rain' || kind === 'storm' ? Math.random() * 0.55 : Math.random() * 18;
          ptPositions[i * 3 + 2] = (Math.random() - 0.5) * 32;
          ptVelY[i] = kind === 'hail' ? -(24 + Math.random() * 8) : -1;
        }
      }

      const isRainy = !isIndoor && (kind === 'rain' || kind === 'storm');
      const isSnowOrHail = !isIndoor && (kind === 'snow' || kind === 'hail');

      // --- 1. Slanted 3D Rain Streaks (`rain` & `storm`) ---
      rainLines.visible = isRainy;
      if (isRainy) {
        const isStorm = kind === 'storm';
        const activeCount = isStorm ? RAIN_STREAK_COUNT : Math.floor(RAIN_STREAK_COUNT * 0.68);
        rainGeo.setDrawRange(0, activeCount * 2);
        rainMat.color.setHex(isStorm ? 0xdbeeff : 0xc5e6ff);
        rainMat.opacity = isStorm ? 0.88 : 0.72;

        const baseFall = isStorm ? 32 : 23;
        const windX = isStorm
          ? 7.2 + Math.sin(windClock * 1.9) * 2.4
          : 2.4 + Math.sin(windClock * 1.1) * 0.8;
        const windZ = isStorm ? 2.6 + Math.cos(windClock * 1.5) * 1.4 : 0.7;
        const streakSec = isStorm ? 0.052 : 0.045; // 1.1m..1.65m visible slanted streak!

        for (let i = 0; i < activeCount; i++) {
          const i3 = i * 3;
          const spd = baseFall * rainSpeedJitter[i];
          let x = rainHeads[i3] + windX * dt;
          let y = rainHeads[i3 + 1] - spd * dt;
          let z = rainHeads[i3 + 2] + windZ * dt;
          if (y < 0.05) {
            const isNearLayer = i < activeCount * 0.35;
            const spread = isNearLayer ? 18 : 34;
            y = 15 + Math.random() * 6;
            x = (Math.random() - 0.5) * spread;
            z = (Math.random() - 0.5) * spread;
          }
          rainHeads[i3] = x;
          rainHeads[i3 + 1] = y;
          rainHeads[i3 + 2] = z;

          const o = i * 6;
          rainLineVerts[o] = x;
          rainLineVerts[o + 1] = y;
          rainLineVerts[o + 2] = z;
          rainLineVerts[o + 3] = x - windX * streakSec;
          rainLineVerts[o + 4] = y + spd * streakSec;
          rainLineVerts[o + 5] = z - windZ * streakSec;
        }
        rainPosAttr.needsUpdate = true;
        rainLines.position.set(centerX, centerY, centerZ);
      }

      // --- 2. Points: Snowflakes / Bouncing Hailstones / Ground Rain Splashes ---
      weatherPoints.visible = isSnowOrHail || isRainy;
      if (isSnowOrHail) {
        const isHail = kind === 'hail';
        const activePts = isHail ? 480 : POINT_PARTICLE_COUNT;
        ptGeo.setDrawRange(0, activePts);
        ptMat.color.setHex(isHail ? 0xebf8ff : 0xffffff);
        ptMat.size = isHail ? 0.56 : 0.48;
        ptMat.opacity = isHail ? 0.94 : 0.88;

        for (let i = 0; i < activePts; i++) {
          const i3 = i * 3;
          let x = ptPositions[i3];
          let y = ptPositions[i3 + 1];
          let z = ptPositions[i3 + 2];

          if (isHail) {
            // Fast hailstones slamming down & visibly bouncing off the ground!
            let vy = ptVelY[i];
            if (vy > 0) {
              // Currently bouncing upward after hitting the ground
              y += vy * dt;
              vy -= 26 * dt;
              x += 1.6 * dt;
              if (y <= 0.12 && vy < 0) {
                y = 16 + Math.random() * 6;
                x = (Math.random() - 0.5) * 30;
                z = (Math.random() - 0.5) * 30;
                vy = -(26 + Math.random() * 9);
              }
              ptVelY[i] = vy;
            } else {
              x += 3.4 * dt;
              y += vy * dt;
              if (y <= 0.16) {
                y = 0.16;
                // 65% visibly pop upward like bouncing ice pellets!
                if (Math.random() < 0.65) {
                  ptVelY[i] = 4.5 + Math.random() * 4.5;
                } else {
                  y = 16 + Math.random() * 6;
                  x = (Math.random() - 0.5) * 30;
                  z = (Math.random() - 0.5) * 30;
                  ptVelY[i] = -(26 + Math.random() * 9);
                }
              }
            }
          } else {
            // Drifting winter snowflakes
            const ph = ptPhase[i];
            x += (Math.sin(windClock * 1.5 + ph) * 1.7 + 0.6) * dt;
            z += Math.cos(windClock * 1.2 + ph * 1.3) * 1.1 * dt;
            y -= (2.8 + (ph % 1.4)) * dt;
            if (y < 0.1) {
              y = 15 + Math.random() * 5;
              x = (Math.random() - 0.5) * 32;
              z = (Math.random() - 0.5) * 32;
            }
          }

          ptPositions[i3] = x;
          ptPositions[i3 + 1] = y;
          ptPositions[i3 + 2] = z;
        }
        ptPosAttr.needsUpdate = true;
        weatherPoints.position.set(centerX, centerY, centerZ);
      } else if (isRainy) {
        // Ground rain splash sparkles dancing around the player!
        const splashCount = kind === 'storm' ? 280 : 180;
        ptGeo.setDrawRange(0, splashCount);
        ptMat.color.setHex(0xe7f5ff);
        ptMat.size = kind === 'storm' ? 0.34 : 0.28;
        ptMat.opacity = kind === 'storm' ? 0.72 : 0.58;

        for (let i = 0; i < splashCount; i++) {
          const i3 = i * 3;
          let y = ptPositions[i3 + 1] + 2.4 * dt;
          if (y > 0.58 || Math.random() < dt * 4.5) {
            ptPositions[i3] = (Math.random() - 0.5) * 26;
            y = 0.06 + Math.random() * 0.14;
            ptPositions[i3 + 2] = (Math.random() - 0.5) * 26;
          }
          ptPositions[i3 + 1] = y;
        }
        ptPosAttr.needsUpdate = true;
        weatherPoints.position.set(centerX, centerY, centerZ);
      }

      // --- 3. Real 3D Storm Forked Lightning Bolts + Electric Sky/Scene Flash ---
      if (kind === 'storm') {
        nextBoltTimer -= dt;
        if (nextBoltTimer <= 0) {
          const isNear = buildLightningBolt(centerX, centerY, centerZ, camFwdX, camFwdZ);
          boltAge = 0;
          boltDuration = 0.38 + Math.random() * 0.18;
          nextBoltTimer = 3.2 + Math.random() * 5.8;
          onLightningStrike?.(isNear);
        }

        if (boltAge < boltDuration) {
          boltAge += dt;
          const t = boltAge / boltDuration;
          // Cinematic double-flicker lightning envelope: peak -> dip -> bright re-strike -> decay
          let pulse = 0;
          if (t < 0.16) pulse = 1.0;
          else if (t < 0.3) pulse = 0.22;
          else if (t < 0.52) pulse = 0.92;
          else pulse = Math.max(0, (1 - t) / 0.48);

          const flashScale = reduceFlashes ? 0.28 : 1.0;
          const indoorScale = isIndoor ? 0.32 : 1.0;
          const intensity = pulse * flashScale * indoorScale;

          boltCoreLine.visible = !isIndoor && pulse > 0.04;
          boltGlowLine.visible = !isIndoor && pulse > 0.04;
          boltCoreMat.opacity = Math.min(1, pulse * 1.1);
          boltGlowMat.opacity = Math.min(0.85, pulse * 0.75);

          flashLight.intensity = intensity * 3.8;
          if (!isIndoor && intensity > 0.05) {
            // Brief electric illumination of sky & fog (smoothly restored next frame by applyLiveSolarAtmosphere!)
            sun.intensity = Math.max(sun.intensity, 1.3 + intensity * 1.8);
            hemi.intensity = Math.max(hemi.intensity, 0.9 + intensity * 1.4);
            if (activeScene.background instanceof THREE.Color) {
              activeScene.background.lerp(tmpFlashSky, Math.min(0.65, intensity * 0.58));
            }
            if (activeScene.fog instanceof THREE.Fog) {
              activeScene.fog.color.lerp(tmpFlashSky, Math.min(0.55, intensity * 0.48));
            }
          }
        } else {
          boltCoreLine.visible = false;
          boltGlowLine.visible = false;
          flashLight.intensity = 0;
        }
      } else {
        boltAge = 99;
        boltCoreLine.visible = false;
        boltGlowLine.visible = false;
        flashLight.intensity = 0;
      }
    },

    dispose() {
      scene.remove(rainLines);
      scene.remove(weatherPoints);
      scene.remove(boltCoreLine);
      scene.remove(boltGlowLine);
      scene.remove(flashLight);
      rainGeo.dispose();
      rainMat.dispose();
      ptGeo.dispose();
      ptMat.dispose();
      boltGeo.dispose();
      boltCoreMat.dispose();
      boltGlowGeo.dispose();
      boltGlowMat.dispose();
    },
  };
}
