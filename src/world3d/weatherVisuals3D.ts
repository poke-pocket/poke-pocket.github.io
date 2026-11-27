import * as THREE from 'three';
import type { WeatherIntensity, WeatherKind } from '../utils/weatherSystem';

export interface WeatherVisuals3DController {
  update: (params: {
    dt: number;
    kind: WeatherKind;
    intensity?: WeatherIntensity;
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

const RAIN_STREAK_COUNT = 1050;
const POINT_PARTICLE_COUNT = 820;
const BOLT_MAX_SEGMENTS = 48; // Main jagged trunk + branching forks

/**
 * Rich HD-2D 3D Weather Visuals Controller (Intensity-Aware!):
 * - `rain` / `storm`: 210..1050 slanted luminous 3D rain streaks (`THREE.LineSegments`) + 65..420 ground splash specks
 * - `storm`: Real forked 3D lightning bolts in the player's forward sky + 2-pulse electric sky/light flash (rate scales with intensity)
 * - `hail`: 160..780 bright icy hailstones slamming down at high speed and visibly bouncing off the ground
 * - `snow`: 180..820 gently swirling -> wind-driven bright snowflakes
 * - `windy`: 55..230 fast horizontally streaking sunlit air/leaf motes
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

  // 2. Point Particles (Snowflakes, Bouncing Hailstones, Rain Ground Splashes, or Wind Motes!)
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
  let nextBoltTimer = 1.4;
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
      intensity = 'moderate',
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
      const lvl = intensity === 'light' ? 0 : intensity === 'heavy' ? 2 : 1;

      if (kind !== lastKind) {
        lastKind = kind;
        if (kind === 'storm') {
          nextBoltTimer = [1.4, 0.9, 0.5][lvl] + Math.random() * 0.7;
        }
        for (let i = 0; i < POINT_PARTICLE_COUNT; i++) {
          ptPositions[i * 3] = (Math.random() - 0.5) * 32;
          ptPositions[i * 3 + 1] =
            kind === 'rain' || kind === 'storm'
              ? Math.random() * 0.55
              : kind === 'windy'
                ? 0.8 + Math.random() * 11
                : Math.random() * 18;
          ptPositions[i * 3 + 2] = (Math.random() - 0.5) * 32;
          ptVelY[i] = kind === 'hail' ? -(24 + Math.random() * 8) : -1;
        }
      }

      const isRainy = !isIndoor && (kind === 'rain' || kind === 'storm');
      const isSnowOrHail = !isIndoor && (kind === 'snow' || kind === 'hail');
      const isWindy = !isIndoor && kind === 'windy';

      // --- 1. Slanted 3D Rain Streaks (`rain` & `storm`, density/speed/slant scale strongly with intensity!) ---
      rainLines.visible = isRainy;
      if (isRainy) {
        const isStorm = kind === 'storm';
        const activeCount = isStorm
          ? [480, 780, RAIN_STREAK_COUNT][lvl]
          : [210, 560, 1020][lvl];
        rainGeo.setDrawRange(0, activeCount * 2);
        rainMat.color.setHex(isStorm ? 0xdbeeff : lvl === 0 ? 0xd8eeff : 0xc5e6ff);
        rainMat.opacity = isStorm ? [0.68, 0.84, 0.94][lvl] : [0.48, 0.72, 0.90][lvl];

        const baseFall = isStorm ? [25, 32, 39][lvl] : [17.5, 24, 34][lvl];
        const windX = isStorm
          ? [4.2, 7.2, 10.4][lvl] + Math.sin(windClock * 1.9) * [1.3, 2.4, 3.6][lvl]
          : [1.1, 2.5, 6.4][lvl] + Math.sin(windClock * 1.1) * [0.4, 0.8, 2.0][lvl];
        const windZ = isStorm
          ? [1.4, 2.6, 4.0][lvl] + Math.cos(windClock * 1.5) * 1.3
          : [0.3, 0.7, 1.8][lvl];
        const streakSec = isStorm ? [0.044, 0.052, 0.062][lvl] : [0.032, 0.045, 0.058][lvl];

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

      // --- 2. Points: Snowflakes / Bouncing Hailstones / Rain Ground Splashes / Wind Motes ---
      weatherPoints.visible = isSnowOrHail || isRainy || isWindy;
      if (isSnowOrHail) {
        const isHail = kind === 'hail';
        const activePts = isHail ? [160, 440, 780][lvl] : [180, 480, POINT_PARTICLE_COUNT][lvl];
        ptGeo.setDrawRange(0, activePts);
        ptMat.color.setHex(isHail ? 0xebf8ff : 0xffffff);
        ptMat.size = isHail ? [0.42, 0.54, 0.66][lvl] : [0.38, 0.48, 0.56][lvl];
        ptMat.opacity = isHail ? [0.84, 0.92, 0.98][lvl] : [0.72, 0.88, 0.96][lvl];

        const hailFallBase = [20, 26, 33][lvl];
        const hailBounceChance = [0.48, 0.64, 0.78][lvl];
        const snowWindX = [0.4, 1.0, 4.8][lvl];
        const snowFallBase = [1.9, 2.8, 4.1][lvl];

        for (let i = 0; i < activePts; i++) {
          const i3 = i * 3;
          let x = ptPositions[i3];
          let y = ptPositions[i3 + 1];
          let z = ptPositions[i3 + 2];

          if (isHail) {
            let vy = ptVelY[i];
            if (vy > 0) {
              y += vy * dt;
              vy -= 26 * dt;
              x += (1.2 + lvl * 0.9) * dt;
              if (y <= 0.12 && vy < 0) {
                y = 16 + Math.random() * 6;
                x = (Math.random() - 0.5) * 30;
                z = (Math.random() - 0.5) * 30;
                vy = -(hailFallBase + Math.random() * 9);
              }
              ptVelY[i] = vy;
            } else {
              x += (2.4 + lvl * 1.6) * dt;
              y += vy * dt;
              if (y <= 0.16) {
                y = 0.16;
                if (Math.random() < hailBounceChance) {
                  ptVelY[i] = 3.8 + lvl * 1.1 + Math.random() * 4.2;
                } else {
                  y = 16 + Math.random() * 6;
                  x = (Math.random() - 0.5) * 30;
                  z = (Math.random() - 0.5) * 30;
                  ptVelY[i] = -(hailFallBase + Math.random() * 9);
                }
              }
            }
          } else {
            const ph = ptPhase[i];
            x += (Math.sin(windClock * 1.5 + ph) * (1.3 + lvl * 0.55) + snowWindX) * dt;
            z += Math.cos(windClock * 1.2 + ph * 1.3) * (0.9 + lvl * 0.4) * dt;
            y -= (snowFallBase + (ph % 1.4)) * dt;
            if (y < 0.1 || Math.abs(x) > 19) {
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
        const isStorm = kind === 'storm';
        const splashCount = isStorm ? [170, 290, 420][lvl] : [65, 180, 380][lvl];
        ptGeo.setDrawRange(0, splashCount);
        ptMat.color.setHex(0xe7f5ff);
        ptMat.size = isStorm ? [0.28, 0.34, 0.40][lvl] : [0.22, 0.28, 0.35][lvl];
        ptMat.opacity = isStorm ? [0.56, 0.72, 0.84][lvl] : [0.42, 0.58, 0.76][lvl];

        for (let i = 0; i < splashCount; i++) {
          const i3 = i * 3;
          let y = ptPositions[i3 + 1] + (2.0 + lvl * 0.6) * dt;
          if (y > 0.58 || Math.random() < dt * (3.6 + lvl * 1.6)) {
            ptPositions[i3] = (Math.random() - 0.5) * 26;
            y = 0.06 + Math.random() * 0.14;
            ptPositions[i3 + 2] = (Math.random() - 0.5) * 26;
          }
          ptPositions[i3 + 1] = y;
        }
        ptPosAttr.needsUpdate = true;
        weatherPoints.position.set(centerX, centerY, centerZ);
      } else if (isWindy) {
        const windPts = [55, 130, 240][lvl];
        const windSpeed = [8.5, 15.5, 25.0][lvl];
        ptGeo.setDrawRange(0, windPts);
        ptMat.color.setHex(lvl === 2 ? 0xd3f9d8 : 0xe6fcf5);
        ptMat.size = [0.24, 0.30, 0.36][lvl];
        ptMat.opacity = [0.46, 0.62, 0.78][lvl];

        for (let i = 0; i < windPts; i++) {
          const i3 = i * 3;
          const ph = ptPhase[i];
          let x = ptPositions[i3] + (windSpeed + Math.sin(windClock * 1.8 + ph) * 2.6) * dt;
          let y = ptPositions[i3 + 1] + Math.sin(windClock * 2.4 + ph) * (0.9 + lvl * 0.5) * dt;
          let z = ptPositions[i3 + 2] + (windSpeed * 0.24 + Math.cos(windClock * 1.4 + ph) * 1.4) * dt;
          if (x > 18 || Math.abs(z) > 18 || y < 0.3 || y > 14) {
            x = -16 - Math.random() * 4;
            y = 0.6 + Math.random() * 10.5;
            z = (Math.random() - 0.5) * 28;
          }
          ptPositions[i3] = x;
          ptPositions[i3 + 1] = y;
          ptPositions[i3 + 2] = z;
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
          nextBoltTimer =
            [7.5, 3.6, 1.7][lvl] + Math.random() * [5.5, 4.2, 2.5][lvl];
          onLightningStrike?.(isNear);
        }

        if (boltAge < boltDuration) {
          boltAge += dt;
          const t = boltAge / boltDuration;
          let pulse = 0;
          if (t < 0.16) pulse = 1.0;
          else if (t < 0.3) pulse = 0.22;
          else if (t < 0.52) pulse = 0.92;
          else pulse = Math.max(0, (1 - t) / 0.48);

          const flashScale = (reduceFlashes ? 0.28 : 1.0) * [0.76, 1.0, 1.18][lvl];
          const indoorScale = isIndoor ? 0.32 : 1.0;
          const intensityNow = pulse * flashScale * indoorScale;

          boltCoreLine.visible = !isIndoor && pulse > 0.04;
          boltGlowLine.visible = !isIndoor && pulse > 0.04;
          boltCoreMat.opacity = Math.min(1, pulse * 1.1);
          boltGlowMat.opacity = Math.min(0.85, pulse * 0.75);

          flashLight.intensity = intensityNow * 3.8;
          if (!isIndoor && intensityNow > 0.05) {
            sun.intensity = Math.max(sun.intensity, 1.3 + intensityNow * 1.8);
            hemi.intensity = Math.max(hemi.intensity, 0.9 + intensityNow * 1.4);
            if (activeScene.background instanceof THREE.Color) {
              activeScene.background.lerp(tmpFlashSky, Math.min(0.65, intensityNow * 0.58));
            }
            if (activeScene.fog instanceof THREE.Fog) {
              activeScene.fog.color.lerp(tmpFlashSky, Math.min(0.55, intensityNow * 0.48));
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
