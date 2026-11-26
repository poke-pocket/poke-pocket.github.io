import { MONSTER_QUALITY_META, type ArenaSharedCtx, type Enemy3D } from './arenaTypesAndProps';
import * as THREE from 'three';
import { SPECIES_CATALOG, getPokemonCryId, getPokemonWorldScale3D } from '../../data/catalog';
import { ENEMY_TRAINER_ROSTER, MAP_REGIONS, SURVIVOR_SKILLS, WATER_LEVEL_3D, getTerrainHeight3D, getUnlockedSkillSlotCount, getWalkableSurfaceHeight3D, type SurvivorSkillId } from '../../data/survivorsTactics';
import { getNpcWalkSpriteFrames, getSeamlessBiomeAt3D, sampleAnimatedFrame, sampleHumanWalkFrame } from '../../data/worldTextures3D';
import { pickPmdDirIndex, samplePmd8DirFrame } from '../../data/pmdSprites3D';
import { type PetSkinId, type SpeciesId } from '../../types/pet';
import { getElementalSynergyBonus, getSkinDef } from '../../data/metaProgression';
import { sound } from '../../utils/sound';
import { resolveTownWallCollisions } from '../../utils/townBuilder3D';
import { getWeatherCombatBonus } from '../../utils/weatherSystem';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function stepArenaCombatSimulation3D(rawCtx: Record<string, any>): void {
  const { activeTownNow, activeZone, addFollowerToRun, adventureStyleRef, bbTiltX, buildLevelChoices, buildResultSummary, camFwdX, camFwdZ, camRightX, camRightZ, camYawNow, camera, damageEnemy3D, diffMeta, difficultyId, dt, endedRef, fireSkill, gameMode, groundY, inTownPeaceZone, isInsideAnyTownPlaza, liveOverlandCityRef, liveWeatherRef, mLen, maxFollowersRef, metaBonusesRef, metaRef, nearbyZones, onCaptureBoss, onHealParty, pausedRef, pet, pickTargetForFollower, prefsRef, regionMeta, scene, selectedBiome, setCaptureCutscene, setLevelChoices, setResultSummary, shakeRef, showBanner, sim, spawnEnemy3D, spawnGlowFlash, spawnGroundDecalWave, spawnPixelParticles, spawnSkillProjectile3D, spawnSpriteBurst, tacticsRef, vfxAtlas } = rawCtx as ArenaSharedCtx;
          // 2. Mode-Specific Spawning:
          //    - 'vampire_rogue' (随机冒险模式): Classic Vampire-Survivors monster waves, ring surges, XP gem rain & fast Bosses!
          //    - 'care_world' (默认开始冒险 · 养成实景模式): Peaceful cities + calm, sparse natural wild encounters outside town!
          const isRogueMode = adventureStyleRef.current === 'vampire_rogue';
          const regionIdx = Math.max(0, MAP_REGIONS.findIndex((r) => r.id === selectedBiome));
          const regionMult = 1 + regionIdx * 0.2;
          sim.timers.spawn -= dt;
          const spawnRate = isRogueMode
            ? Math.max(
                0.42,
                (0.95 - sim.elapsed * 0.004) /
                  (difficultyId === 'nightmare' ? 1.35 : difficultyId === 'hard' ? 1.18 : 1),
              )
            : 4.2;
          const maxWildCap = isRogueMode ? 42 : 6;
          const activeWildCount = sim.enemies.filter((e) => !e.knockedOut && !e.isBoss).length;
          if (sim.timers.spawn <= 0 && activeWildCount < maxWildCap) {
            sim.timers.spawn = spawnRate;
            const isRogueSurge = isRogueMode && sim.elapsed > 18 && Math.floor(sim.elapsed) % 25 === 0;
            const batch = isRogueSurge ? 6 : isRogueMode ? (sim.elapsed > 40 ? 3 : 2) : 1;
            for (let b = 0; b < batch; b++) {
              const ang = isRogueSurge ? (b / batch) * Math.PI * 2 + Math.random() * 0.3 : Math.random() * Math.PI * 2;
              const dist = isRogueMode ? 14 + Math.random() * 7 : 18 + Math.random() * 9;
              const ex = sim.px + Math.cos(ang) * dist;
              const ez = sim.pz + Math.sin(ang) * dist;
              if (
                nearbyZones.some((z) => Math.hypot(ex - z.x, ez - z.z) < z.radius + 1.5) ||
                (!isRogueMode && isInsideAnyTownPlaza(ex, ez, 8))
              ) {
                continue;
              }
              const gSpawn = getTerrainHeight3D(ex, ez);
              const inWater = gSpawn < WATER_LEVEL_3D - 0.1;
              const waterPool: SpeciesId[] = ['squirtle', 'psyduck'];
              const activeWildPool = liveOverlandCityRef.current?.wildPool ?? regionMeta.wildPool;
              const sp = inWater
                ? waterPool[Math.floor(Math.random() * waterPool.length)]
                : activeWildPool[Math.floor(Math.random() * activeWildPool.length)];
              const hpScale = (1 + sim.elapsed / (isRogueMode ? 40 : 50)) * regionMult * diffMeta.enemyHpMult;
              spawnEnemy3D(
                ex,
                ez,
                sp,
                Math.round((isRogueMode ? 78 : 120) * hpScale),
                isRogueMode ? 3.45 + Math.min(1.8, sim.elapsed * 0.015) : 2.35,
                Math.round((isRogueMode ? 8 + Math.floor(sim.elapsed / 28) * 2 : 6) * regionMult * diffMeta.enemyDmgMult),
                { isAquatic: inWater },
              );
              if (isRogueMode && sim.enemies.length > 0) {
                sim.enemies[sim.enemies.length - 1].aggroed = true;
              }
            }
          }

          // 2B. Spawn Enemy Trainers (Active in Vampire-Rogue mode, or far out in deep wilderness in Care mode!)
          if (isRogueMode || !inTownPeaceZone) {
            sim.timers.trainer -= dt * (isRogueMode ? 1.45 : 0.45);
          }
          if (sim.timers.trainer <= 0 && (isRogueMode || !inTownPeaceZone)) {
            sim.timers.trainer = isRogueMode ? (difficultyId === 'nightmare' ? 22 : 28) : 75;
            const tr = ENEMY_TRAINER_ROSTER[sim.trainerWaveIdx % ENEMY_TRAINER_ROSTER.length];
            sim.trainerWaveIdx += 1;
            let tx = 0;
            let tz = 0;
            let foundDrySpot = false;
            const baseAng = Math.random() * Math.PI * 2;
            for (let attempt = 0; attempt < 10; attempt++) {
              const ang = baseAng + (attempt * Math.PI * 2) / 10;
              const candX = sim.px + Math.cos(ang) * (20 + (attempt % 2) * 6);
              const candZ = sim.pz + Math.sin(ang) * (20 + (attempt % 2) * 6);
              const gy = getTerrainHeight3D(candX, candZ);
              const gyGuard = getTerrainHeight3D(candX + 2.2, candZ + 1.4);
              if (
                gy >= WATER_LEVEL_3D + 0.45 &&
                gyGuard >= WATER_LEVEL_3D + 0.45 &&
                !nearbyZones.some((z) => Math.hypot(candX - z.x, candZ - z.z) < z.radius + 2)
              ) {
                tx = candX;
                tz = candZ;
                foundDrySpot = true;
                break;
              }
            }
            if (foundDrySpot) {
              const guardHp = Math.round((190 + sim.elapsed * 2.8) * regionMult * diffMeta.enemyHpMult);
              spawnEnemy3D(
                tx,
                tz,
                tr.guardSpecies,
                Math.round((460 + sim.elapsed * 5.5) * regionMult * diffMeta.enemyHpMult),
                3.2,
                Math.round(13 * regionMult * diffMeta.enemyDmgMult),
                { isTrainer: true, trainerSprite: tr.sprite, trainerName: tr.name },
              );
              spawnEnemy3D(tx + 2.2, tz + 1.4, tr.guardSpecies, guardHp, 3.4, Math.round(10 * diffMeta.enemyDmgMult));
              sound.play('confirm');
              showBanner(`！敌方训练师「${tr.name}」出现在附近原野！`);
            }
          }

          // 2C. Wilderness Zone-Stay Escalating Guardians!
          // Zero guardians in peaceful cities; staying in a wilderness area long enough summons progressively stronger guardians
          // on an escalating interval schedule: 3 min -> 6 min -> 9 min -> 15 min -> 22 min -> 30 min -> 40 min -> 50 min -> 60 min!
          const GUARDIAN_WAIT_SCHEDULE_SEC = [180, 360, 540, 900, 1320, 1800, 2400, 3000, 3600];
          if (inTownPeaceZone) {
            // In peaceful city: cool down wilderness stay timer & reset anchor
            sim.wildStaySec = Math.max(0, sim.wildStaySec - dt * 1.5);
            sim.wildZoneAnchorX = sim.px;
            sim.wildZoneAnchorZ = sim.pz;
          } else {
            const driftFromAnchor = Math.hypot(sim.px - sim.wildZoneAnchorX, sim.pz - sim.wildZoneAnchorZ);
            if (driftFromAnchor > 72) {
              // Moved into a brand-new wilderness area: re-anchor local zone stay!
              sim.wildZoneAnchorX = sim.px;
              sim.wildZoneAnchorZ = sim.pz;
              sim.wildStaySec = Math.max(0, sim.wildStaySec * 0.35);
            } else {
              sim.wildStaySec += dt;
            }
            const nextWaitSec =
              GUARDIAN_WAIT_SCHEDULE_SEC[Math.min(sim.guardianWaveCount, GUARDIAN_WAIT_SCHEDULE_SEC.length - 1)];
            if (sim.wildStaySec >= nextWaitSec) {
              sim.wildStaySec = 0;
              sim.guardianWaveCount += 1;
              const tier = sim.guardianWaveCount;
              const curBiomeNow = getSeamlessBiomeAt3D(sim.px, sim.pz, sim.py, selectedBiome);
              const curBiomeMeta = MAP_REGIONS.find((r) => r.id === curBiomeNow) ?? regionMeta;
              const pool: SpeciesId[] = [...curBiomeMeta.guardians, curBiomeMeta.bossSpecies];
              const bossSp = pool[(tier - 1) % pool.length];
              const tierScale = 1 + (tier - 1) * 0.55;
              sound.playCry(getPokemonCryId(bossSp, 25));
              if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.5);
              const spawnAng = Math.random() * Math.PI * 2;
              const bx = sim.px + Math.cos(spawnAng) * 18;
              const bz = sim.pz + Math.sin(spawnAng) * 18;
              const guardianHp = Math.round(
                (2600 + sim.baseAtk * 16 + sim.followers.length * 420) * tierScale * regionMult * diffMeta.enemyHpMult,
              );
              spawnEnemy3D(
                bx,
                bz,
                bossSp,
                guardianHp,
                Math.min(5.6, 4.2 + tier * 0.14),
                Math.round(24 * (1 + (tier - 1) * 0.3) * regionMult * diffMeta.enemyDmgMult),
                { isBoss: true },
              );
              const trInfo = ENEMY_TRAINER_ROSTER[tier % ENEMY_TRAINER_ROSTER.length];
              if (trInfo) {
                spawnEnemy3D(
                  bx + 2.8,
                  bz + 2.2,
                  bossSp,
                  Math.round((680 + tier * 240) * regionMult * diffMeta.enemyHpMult),
                  4.0,
                  Math.round(18 * regionMult * diffMeta.enemyDmgMult),
                  {
                    isTrainer: true,
                    trainerSprite: trInfo.sprite,
                    trainerName: trInfo.name,
                  },
                );
              }
              const nextMins = Math.round(
                GUARDIAN_WAIT_SCHEDULE_SEC[Math.min(tier, GUARDIAN_WAIT_SCHEDULE_SEC.length - 1)] / 60,
              );
              if (prefsRef.current.bossAlerts) {
                showBanner(
                  `⚠️ 野外深度停留触发 · 第 ${tier} 阶守护者【${SPECIES_CATALOG[bossSp].defaultName}】现身！（击败可收服，下一阶间隔 ${nextMins} 分钟）`,
                  4500,
                );
              }
            }
          }

          // 3. Update Following Pokémon Squad + Active Battle Action Cooldowns & Team Boost!
          sim.actionCds.ball = Math.max(0, sim.actionCds.ball - dt);
          sim.actionCds.heal = Math.max(0, sim.actionCds.heal - dt);
          sim.actionCds.boost = Math.max(0, sim.actionCds.boost - dt);
          sim.actionCds.salvo = Math.max(0, sim.actionCds.salvo - dt);
          if (sim.boostTimer > 0) sim.boostTimer = Math.max(0, sim.boostTimer - dt);
          const tac = tacticsRef.current;
          const cdFactor =
            sim.cdMult *
            (tac.castMode === 'charged' ? 1.3 : 1.0) *
            (sim.boostTimer > 0 ? 0.65 : 1.0);
          let triggerSalvo = false;
          if (tac.castMode === 'salvo') {
            sim.salvoTimer -= dt;
            if (sim.salvoTimer <= 0 && sim.enemies.length > 0) {
              sim.salvoTimer = Math.max(0.95, 1.75 * sim.cdMult);
              triggerSalvo = true;
            }
          }

          const fCount = sim.followers.length;
          for (let i = 0; i < fCount; i++) {
            const f = sim.followers[i];
            if (f.castAnim > 0) f.castAnim = Math.max(0, f.castAnim - dt);

            // Peaceful Town Mode: recall extra followers (i > 0) cleanly into Pokéballs, keeping ONLY lead partner!
            if (inTownPeaceZone && i > 0) {
              if (f.sprite) f.sprite.visible = false;
              if (f.shadow) f.shadow.visible = false;
              if (f.leafMeshes) {
                for (const bm of f.leafMeshes) bm.visible = false;
              }
              f.x = sim.px;
              f.z = sim.pz;
              continue;
            }
            if (f.sprite) f.sprite.visible = true;
            if (f.shadow) f.shadow.visible = true;
            if (f.leafMeshes) {
              for (const bm of f.leafMeshes) bm.visible = !inTownPeaceZone;
            }

            const hasCloseSkill = f.skills.some((s) => s === 'razor_leaf' || s === 'water_pulse');

            // Authentic Natural AI + Physical Contact Charge/Tackle Attacks (No nervous pacing around Hero!)
            const isMeleeCharger =
              f.species === 'munchlax' ||
              f.species === 'eevee' ||
              f.species === 'meowth' ||
              f.species === 'squirtle' ||
              f.species === 'bulbasaur' ||
              f.species === 'dratini' ||
              hasCloseSkill;
            f.dashCd = Math.max(0, (f.dashCd ?? 1.5) - dt);
            const leashMax = tac.formation === 'hunt' ? 14.5 : tac.formation === 'vanguard' ? 11.5 : 10.5;
            const engageRadius = tac.formation === 'hunt' ? 16.5 : tac.formation === 'vanguard' ? 13.0 : 12.0;
            const distToRed = Math.hypot(f.x - sim.px, f.z - sim.pz);

            // Pick nearest / priority enemy inside engagement range around Hero (NEVER engages inside peaceful towns!)
            const candidates = inTownPeaceZone ? [] : pickTargetForFollower(f, sim.enemies, tac.targetPriority);
            const engageTarget = inTownPeaceZone
              ? undefined
              : candidates.find((en: Enemy3D) => Math.hypot(en.x - sim.px, en.z - sim.pz) < engageRadius);

            // Trigger real physical Contact Charge / Body Slam lunge for melee/bruiser Pokémon!
            if (
              isMeleeCharger &&
              (f.dashTimer ?? 0) <= 0 &&
              (f.dashCd ?? 0) <= 0 &&
              engageTarget &&
              distToRed < leashMax
            ) {
              const dEn = Math.hypot(engageTarget.x - f.x, engageTarget.z - f.z);
              if (dEn > 1.2 && dEn < 9.5) {
                const lungeSpd = f.species === 'munchlax' ? 16.5 : 20.5;
                f.dashVx = ((engageTarget.x - f.x) / dEn) * lungeSpd;
                f.dashVz = ((engageTarget.z - f.z) / dEn) * lungeSpd;
                f.dashTimer = 0.28;
                f.dashCd = f.species === 'munchlax' ? 3.4 : 3.8;
                f.dashHitIds = new Set<number>();
                f.castAnim = 0.26;
                spawnPixelParticles(f.x, f.y + 0.3, f.z, vfxAtlas.koPuff, 4, 3.2, 0.72, 1.8, 6.0);
              }
            }

            if ((f.dashTimer ?? 0) > 0) {
              // Active physical contact tackle/charge straight through enemies!
              f.dashTimer = Math.max(0, (f.dashTimer ?? 0) - dt);
              f.vx = f.dashVx ?? 0;
              f.vz = f.dashVz ?? 0;
              // Water-loving / Flying companions glide over rivers & lakes freely; Land companions DISLIKE water (steer toward dry shore unless actively forced across, and wade slower if in water!)
              const isWaterOrFly =
                SPECIES_CATALOG[f.species].element === 'water' ||
                f.species === 'gastly' ||
                f.species === 'dratini' ||
                (f.species === 'charmander' && f.stage === 'adult');
              const candFx = f.x + f.vx * dt;
              const candFz = f.z + f.vz * dt;
              const candFy = getWalkableSurfaceHeight3D(candFx, candFz);
              const inWaterNow = getWalkableSurfaceHeight3D(f.x, f.z) < WATER_LEVEL_3D - 0.08;
              const candInWater = candFy < WATER_LEVEL_3D - 0.08;
              if (!isWaterOrFly && candInWater && !inWaterNow && distToRed < leashMax * 0.85) {
                // Land Pokémon prefers to stay dry along the bank instead of casually stepping into the lake!
                f.vx *= 0.22;
                f.vz *= 0.22;
              } else {
                const wadeMult = !isWaterOrFly && (inWaterNow || candInWater) ? 0.56 : 1.0;
                f.x += f.vx * dt * wadeMult;
                f.z += f.vz * dt * wadeMult;
              }
              // Keep followers from clipping through town walls & buildings!
              if (activeTownNow) {
                const fPos = { x: f.x, z: f.z };
                resolveTownWallCollisions(fPos, 0.72, activeTownNow.colliders, f.y);
                f.x = fPos.x;
                f.z = fPos.z;
              }
              const rawFy = getWalkableSurfaceHeight3D(f.x, f.z, f.y);
              f.y =
                rawFy < WATER_LEVEL_3D - 0.05
                  ? isWaterOrFly
                    ? WATER_LEVEL_3D + 0.14
                    : WATER_LEVEL_3D - 0.08
                  : rawFy;
              const contactR = Math.max(1.25, getPokemonWorldScale3D(f.species, f.stage, 1.0) * 0.48);
              for (const en of sim.enemies) {
                if (en.hp > 0 && !f.dashHitIds?.has(en.id) && Math.hypot(en.x - f.x, en.z - f.z) < en.radius + contactR) {
                  f.dashHitIds?.add(en.id);
                  const syn = getElementalSynergyBonus(SPECIES_CATALOG[f.species].element, metaRef.current);
                  const wMod = getWeatherCombatBonus(liveWeatherRef.current.kind, SPECIES_CATALOG[f.species].element);
                  const slamDmg = Math.round(
                    sim.baseAtk * sim.atkMult * syn.atkMult * wMod.atkMult * (f.species === 'munchlax' ? 1.55 : 1.15) * (0.9 + f.level * 0.25),
                  );
                  damageEnemy3D(en, slamDmg, f.species === 'munchlax' ? '#ffd43b' : '#ffa94d', f.id);
                  spawnSpriteBurst(en.x, en.y + 1.0, en.z, vfxAtlas.explosionBurst, f.species === 'munchlax' ? 2.4 : 1.65, 0.26);
                  if (f.species === 'munchlax') {
                    spawnGroundDecalWave(en.x, en.y, en.z, vfxAtlas.fireBlastDecal, 3.2, 0.34);
                    if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.16);
                  }
                  if (!en.isBoss) {
                    const kd = Math.hypot(en.x - f.x, en.z - f.z) || 1;
                    en.x += ((en.x - f.x) / kd) * (f.species === 'munchlax' ? 2.8 : 1.8);
                    en.z += ((en.z - f.z) / kd) * (f.species === 'munchlax' ? 2.8 : 1.8);
                  }
                }
              }
            } else {
              // Natural calm escort formation + purposeful combat positioning (Zero frantic pacing!)
              const slotAng = sim.facingAngle + Math.PI + ((i - (fCount - 1) / 2) * 0.65);
              const escortR = 2.6 + (i % 2) * 1.15;
              let goalX = sim.px + Math.sin(slotAng) * escortR + f.wanderX * 0.35;
              let goalZ = sim.pz + Math.cos(slotAng) * escortR + f.wanderZ * 0.35;
              let maxSpd = 7.4 * sim.speedMult;

              if (distToRed > leashMax) {
                const backAng = Math.atan2(f.z - sim.pz, f.x - sim.px);
                goalX = sim.px + Math.cos(backAng) * 3.4;
                goalZ = sim.pz + Math.sin(backAng) * 3.4;
                maxSpd = 10.8 * sim.speedMult;
              } else if (engageTarget) {
                const idealDist = isMeleeCharger ? 2.2 : tac.formation === 'hunt' ? 5.0 : 6.4;
                const toEnX = engageTarget.x - f.x;
                const toEnZ = engageTarget.z - f.z;
                const dEn = Math.hypot(toEnX, toEnZ) || 1;
                if (dEn > idealDist + 1.4) {
                  // Purposefully advance toward enemy
                  goalX = engageTarget.x - (toEnX / dEn) * idealDist;
                  goalZ = engageTarget.z - (toEnZ / dEn) * idealDist;
                  maxSpd = 8.6 * sim.speedMult;
                } else if (dEn < idealDist - 1.5 && !isMeleeCharger) {
                  // Ranged caster steps back smoothly out of melee reach
                  goalX = f.x - (toEnX / dEn) * 2.2;
                  goalZ = f.z - (toEnZ / dEn) * 2.2;
                  maxSpd = 5.8 * sim.speedMult;
                } else {
                  // Hold steady tactical firing stance facing the enemy (no jittery side-to-side pacing!)
                  goalX = f.x;
                  goalZ = f.z;
                  f.faceX = toEnX / dEn;
                  f.faceZ = toEnZ / dEn;
                  maxSpd = 0;
                }
                const gDx = goalX - sim.px;
                const gDz = goalZ - sim.pz;
                const gDist = Math.hypot(gDx, gDz);
                if (gDist > leashMax - 0.6) {
                  goalX = sim.px + (gDx / gDist) * (leashMax - 0.6);
                  goalZ = sim.pz + (gDz / gDist) * (leashMax - 0.6);
                }
              } else {
                // Out of combat: calmly follow Hero when moving, rest quietly when Hero stops (occasional relaxed 5-8s shift)
                f.wanderTimer -= dt;
                if (f.wanderTimer <= 0) {
                  f.wanderTimer = 4.8 + Math.random() * 3.6;
                  const a = Math.random() * Math.PI * 2;
                  f.wanderX = Math.cos(a) * 1.6;
                  f.wanderZ = Math.sin(a) * 1.6;
                }
                if (mLen < 0.08 && Math.hypot(goalX - f.x, goalZ - f.z) < 2.2) {
                  goalX = f.x;
                  goalZ = f.z;
                }
                maxSpd = 6.2 * sim.speedMult;
              }

              // Gentle separation between companion Pokémon
              let sepX = 0;
              let sepZ = 0;
              for (let j = 0; j < fCount; j++) {
                if (i === j) continue;
                const o = sim.followers[j];
                const sdx = f.x - o.x;
                const sdz = f.z - o.z;
                const sd = Math.hypot(sdx, sdz);
                if (sd > 0.01 && sd < 2.1) {
                  const push = (2.1 - sd) * 1.9;
                  sepX += (sdx / sd) * push;
                  sepZ += (sdz / sd) * push;
                }
              }

              const toGX = goalX - f.x + sepX;
              const toGZ = goalZ - f.z + sepZ;
              const toGDist = Math.hypot(toGX, toGZ);
              const desiredVx = toGDist > 0.55 && maxSpd > 0 ? (toGX / toGDist) * Math.min(maxSpd, toGDist * 3.2) : 0;
              const desiredVz = toGDist > 0.55 && maxSpd > 0 ? (toGZ / toGDist) * Math.min(maxSpd, toGDist * 3.2) : 0;
              f.vx += (desiredVx - f.vx) * Math.min(1, dt * 8.0);
              f.vz += (desiredVz - f.vz) * Math.min(1, dt * 8.0);
              if (desiredVx === 0 && desiredVz === 0 && Math.hypot(f.vx, f.vz) < 0.45) {
                f.vx = 0;
                f.vz = 0;
              }

              // Water-loving / Flying companions glide over rivers & lakes freely; Land companions DISLIKE water (steer toward dry shore unless actively forced across, and wade slower if in water!)
              const isWaterOrFly =
                SPECIES_CATALOG[f.species].element === 'water' ||
                f.species === 'gastly' ||
                f.species === 'dratini' ||
                (f.species === 'charmander' && f.stage === 'adult');
              const candFx = f.x + f.vx * dt;
              const candFz = f.z + f.vz * dt;
              const candFy = getWalkableSurfaceHeight3D(candFx, candFz);
              const inWaterNow = getWalkableSurfaceHeight3D(f.x, f.z) < WATER_LEVEL_3D - 0.08;
              const candInWater = candFy < WATER_LEVEL_3D - 0.08;
              if (!isWaterOrFly && candInWater && !inWaterNow && distToRed < leashMax * 0.85) {
                // Land Pokémon prefers to stay dry along the bank instead of casually stepping into the lake!
                f.vx *= 0.22;
                f.vz *= 0.22;
              } else {
                const wadeMult = !isWaterOrFly && (inWaterNow || candInWater) ? 0.56 : 1.0;
                f.x += f.vx * dt * wadeMult;
                f.z += f.vz * dt * wadeMult;
              }
              // Keep followers from clipping through town walls & buildings!
              if (activeTownNow) {
                const fPos = { x: f.x, z: f.z };
                resolveTownWallCollisions(fPos, 0.72, activeTownNow.colliders, f.y);
                f.x = fPos.x;
                f.z = fPos.z;
              }
              const rawFy = getWalkableSurfaceHeight3D(f.x, f.z, f.y);
              f.y =
                rawFy < WATER_LEVEL_3D - 0.05
                  ? isWaterOrFly
                    ? WATER_LEVEL_3D + 0.14
                    : WATER_LEVEL_3D - 0.08
                  : rawFy;
            }

            const spdNow = Math.hypot(f.vx, f.vz);
            if (spdNow > 0.38) {
              f.faceX = f.vx / spdNow;
              f.faceZ = f.vz / spdNow;
            }
            const castJump = f.castAnim > 0 ? Math.sin((f.castAnim / 0.24) * Math.PI) * 0.42 : 0;
            const isFlightForm =
              (f.species === 'charmander' && f.stage === 'adult') ||
              (f.species === 'dratini' && f.stage === 'adult') ||
              f.species === 'gastly' ||
              f.species === 'mew';
            const isFollowerWalking = spdNow > 0.45;
            if (isFollowerWalking || f.castAnim > 0 || isFlightForm) {
              f.animTime += dt;
            }
            const stepBob = isFlightForm
              ? 0.78 + Math.sin(f.animTime * 4.8) * 0.2
              : isFollowerWalking
                ? Math.abs(Math.sin(f.animTime * 9)) * 0.14
                : 0;
            if (f.sprite) {
              // Authentic 8-Direction PMD Overworld / Flight Sprite (Hold neutral standing frame 0 when idle — NEVER walk in place!)
              const fxDir = f.faceX ?? Math.sin(sim.facingAngle);
              const fzDir = f.faceZ ?? Math.cos(sim.facingAngle);
              const fRelFwd = fxDir * camFwdX + fzDir * camFwdZ;
              const fRelRight = fxDir * camRightX + fzDir * camRightZ;
              const stretch = f.castAnim > 0 ? 1.12 : 1.0;
              const fScale = getPokemonWorldScale3D(f.species, f.stage, 1.0);
              const flightBank = isFlightForm ? Math.max(-0.14, Math.min(0.14, -fRelRight * 0.12)) : 0;
              f.sprite.position.set(f.x, f.y + stepBob + castJump + 0.02, f.z);
              f.sprite.rotation.set(bbTiltX * 0.45, camYawNow, flightBank, 'YXZ');
              if (f.pmdSheet?.ready) {
                const dirIdx = pickPmdDirIndex(fRelFwd, fRelRight);
                const walkAnimT =
                  isFollowerWalking || f.castAnim > 0 || isFlightForm
                    ? f.animTime * (spdNow > 1.0 || f.castAnim > 0 ? 1.35 : 0.95)
                    : 0;
                (f.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
                  f.pmdSheet,
                  dirIdx,
                  walkAnimT,
                );
                f.sprite.scale.set(
                  fScale * stretch,
                  fScale * (f.castAnim > 0 ? 1.1 : 1.0),
                  1,
                );
              } else {
                const useBack = fRelFwd > 0.25 && Boolean(f.backAnimSheet);
                const activeSheet = useBack ? f.backAnimSheet : f.animSheet;
                if (activeSheet) {
                  const walkAnimT =
                    isFollowerWalking || f.castAnim > 0 || isFlightForm
                      ? f.animTime * (spdNow > 1.2 || f.castAnim > 0 ? 1.25 : 0.9)
                      : 0;
                  (f.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
                    activeSheet,
                    walkAnimT,
                  );
                }
                if (Math.abs(fRelRight) > 0.12) {
                  f.facingLeft = useBack ? fRelRight < 0 : fRelRight > 0;
                }
                f.sprite.scale.set(
                  (f.facingLeft ? -fScale : fScale) * stretch,
                  fScale * (f.castAnim > 0 ? 1.1 : 1.0),
                  1,
                );
              }
            }
            if (f.shadow) f.shadow.position.set(f.x, f.y + 0.06, f.z);

            const hasLeaf = f.skills.includes('razor_leaf');
            if (hasLeaf) {
              const bladeCount = 3 + f.level;
              if (!f.leafMeshes) f.leafMeshes = [];
              while (f.leafMeshes.length < bladeCount) {
                const blade = new THREE.Sprite(
                  new THREE.SpriteMaterial({
                    map: vfxAtlas.razorLeaf[0],
                    transparent: true,
                    depthWrite: false,
                  }),
                );
                blade.scale.set(1.25, 1.25, 1);
                scene.add(blade);
                f.leafMeshes.push(blade);
              }
              f.orbitAngle += dt * (3.8 + f.level * 0.45);
              const orbitR = 3.1 + Math.min(1.8, f.level * 0.35);
              const leafFrame = vfxAtlas.razorLeaf[Math.floor(sim.elapsed * 10) % vfxAtlas.razorLeaf.length];
              for (let b = 0; b < f.leafMeshes.length; b++) {
                const a = f.orbitAngle + (b * Math.PI * 2) / f.leafMeshes.length;
                const bx = f.x + Math.cos(a) * orbitR;
                const bz = f.z + Math.sin(a) * orbitR;
                const blade = f.leafMeshes[b];
                blade.position.set(bx, getTerrainHeight3D(bx, bz) + 0.95, bz);
                (blade.material as THREE.SpriteMaterial).map = leafFrame;
                (blade.material as THREE.SpriteMaterial).rotation = -a;
                for (const en of sim.enemies) {
                  if (en.hp > 0 && en.hitFlash <= 0 && Math.hypot(en.x - bx, en.z - bz) < en.radius + 0.78) {
                    damageEnemy3D(
                      en,
                      Math.round(sim.baseAtk * sim.atkMult * (0.68 + f.level * 0.2)),
                      '#69db7c',
                      f.id,
                    );
                    spawnSpriteBurst(en.x, en.y + 1.0, en.z, vfxAtlas.slashSpark, 1.55, 0.22);
                  }
                }
              }
            }

            const activeSlotCount = Math.min(f.skills.length, getUnlockedSkillSlotCount(f.level));
            if (inTownPeaceZone) {
              // Complete ceasefire inside peaceful towns!
            } else if (tac.castMode === 'salvo') {
              if (triggerSalvo) {
                const fired = new Set<SurvivorSkillId>();
                for (let sIdx = 0; sIdx < activeSlotCount; sIdx++) {
                  const sk = f.skills[sIdx];
                  if (sk && !fired.has(sk)) {
                    fired.add(sk);
                    fireSkill(f, sk, true);
                  }
                }
              }
            } else {
              for (let sIdx = 0; sIdx < activeSlotCount; sIdx++) {
                const sid = f.skills[sIdx];
                f.cds[sIdx] = (f.cds[sIdx] ?? 0.5) - dt;
                if (f.cds[sIdx] <= 0) {
                  const slotPace = 1 + sIdx * 0.14;
                  const wModCd = getWeatherCombatBonus(liveWeatherRef.current.kind, SPECIES_CATALOG[f.species].element).cdMult;
                  f.cds[sIdx] = Math.max(
                    0.42,
                    SURVIVOR_SKILLS[sid].baseCd * cdFactor * wModCd * slotPace * Math.max(0.6, 1 - f.level * 0.05),
                  );
                  fireSkill(f, sid, false);
                }
              }
            }
          }

          // 4. HD-2D Pixel-Art Projectiles (True 3D straight-line air ballistics + ground glow + pixel trails!)
          for (let i = sim.projectiles.length - 1; i >= 0; i--) {
            const p = sim.projectiles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.life -= dt;
            p.animTime += dt;
            const gyP = getTerrainHeight3D(p.x, p.z);
            const py = Math.max(p.y, gyP + 0.45);
            p.sprite.position.set(p.x, py, p.z);
            const pCamDist = p.sprite.position.distanceTo(camera.position);
            const baseNear = pCamDist < 3.6 ? Math.max(0, (pCamDist - 1.8) / 1.8) : 1;
            const hidePlayer = !p.fromEnemy && prefsRef.current.hidePlayerAttacks;
            const projAlpha = p.fromEnemy
              ? prefsRef.current.vfxOpacity / 100
              : prefsRef.current.playerAttackOpacity / 100;
            p.sprite.visible = !hidePlayer;
            p.glow.visible = !hidePlayer;
            (p.sprite.material as THREE.SpriteMaterial).opacity = baseNear * projAlpha;
            p.glow.position.set(p.x, gyP + 0.14, p.z);
            if (p.frames.length > 1) {
              const fIdx = Math.floor(p.animTime * 11) % p.frames.length;
              (p.sprite.material as THREE.SpriteMaterial).map = p.frames[fIdx];
            }
            if (p.skillId === 'swift_volley' || p.skillId === 'shadow_star') {
              (p.sprite.material as THREE.SpriteMaterial).rotation += dt * 7;
            }
            // Crisp elemental pixel trail puffs behind flying skills
            if (!p.fromEnemy) {
              p.trailTimer -= dt;
              if (p.trailTimer <= 0) {
                p.trailTimer = p.skillId === 'dragon_pulse' ? 0.045 : 0.065;
                const trailTex =
                  p.skillId === 'fireball'
                    ? vfxAtlas.emberPuff
                    : p.skillId === 'shadow_star'
                      ? vfxAtlas.shadowWisp
                      : p.skillId === 'dragon_pulse'
                        ? vfxAtlas.electricSpark
                        : vfxAtlas.starGlint;
                spawnPixelParticles(p.x, py - 0.55, p.z, trailTex, 1, 0.8, 0.62, 1.0, 2.5);
              }
            }
            const removeProj = () => {
              scene.remove(p.sprite);
              scene.remove(p.glow);
              sim.projectiles.splice(i, 1);
            };
            if (p.life <= 0) {
              removeProj();
              continue;
            }
            if (p.fromEnemy) {
              if (inTownPeaceZone || nearbyZones.some((z) => Math.hypot(p.x - z.x, p.z - z.z) < z.radius)) {
                removeProj();
                continue;
              }
              if (sim.py - groundY < 1.15 && Math.hypot(p.x - sim.px, p.z - sim.pz) < p.radius + 0.65 && sim.invuln <= 0) {
                const takenDmg = Math.max(1, Math.round(p.dmg * (1 - metaBonusesRef.current.dmgReduction)));
                sim.hp = Math.max(0, sim.hp - takenDmg);
                sim.invuln = 0.55;
                sound.play('hit');
                sim.dmgPops.push({ id: sim.nextId++, wx: sim.px, wy: sim.py + 2.3, wz: sim.pz, text: `-${takenDmg}`, color: '#ff6b6b', life: 0.55 });
                removeProj();
                if (sim.hp <= 0) {
                  if (sim.revivesLeft > 0) {
                    sim.revivesLeft -= 1;
                    sim.hp = Math.round(sim.maxHp * 0.65);
                    sim.invuln = 2.6;
                    sound.play('levelup');
                    spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.arcaneRingDecal, 7.0, 0.55);
                    spawnPixelParticles(sim.px, sim.py + 1.0, sim.pz, vfxAtlas.starGlint, 16, 7.5, 0.9, 4.5, 9);
                    for (const e2 of sim.enemies) {
                      const d2 = Math.hypot(e2.x - sim.px, e2.z - sim.pz);
                      if (d2 < 8.0 && d2 > 0.1) {
                        e2.x += ((e2.x - sim.px) / d2) * 5.2;
                        e2.z += ((e2.z - sim.pz) / d2) * 5.2;
                      }
                    }
                    showBanner(`⚡ 气势披带发动！原地复活（剩余 ${sim.revivesLeft} 次）！`, 3400);
                  } else if (gameMode === 'story') {
                    // Open-World Survival Respawn: automatically escort back to Home Spawn with full HP!
                    sim.px = 0;
                    sim.pz = 0;
                    sim.py = getTerrainHeight3D(0, 0);
                    sim.hp = sim.maxHp;
                    sim.invuln = 3.0;
                    onHealParty();
                    sound.play('levelup');
                    try { window.localStorage.setItem('pocket_paw_last_world_pos_v1', JSON.stringify({ x: 0, z: 0 })); } catch {}
                    showBanner('🏥 体力与血量耗尽！已紧急护送回出生点休整，全队恢复满血！', 3800);
                  } else {
                    endedRef.current = true;
                    pausedRef.current = true;
                    setResultSummary(buildResultSummary(false));
                  }
                }
              }
            } else {
              for (const en of sim.enemies) {
                if (en.hp > 0 && Math.hypot(en.x - p.x, en.z - p.z) < en.radius + p.radius) {
                  const skColor = p.skillId ? SURVIVOR_SKILLS[p.skillId].color : '#ffe066';
                  damageEnemy3D(en, p.dmg, skColor, p.ownerId);
                  if (p.skillId === 'fireball') {
                    spawnSpriteBurst(en.x, en.y + 1.1, en.z, vfxAtlas.explosionBurst, 2.3, 0.3, 0.5);
                    spawnGroundDecalWave(en.x, en.y, en.z, vfxAtlas.fireBlastDecal, 2.3, 0.3);
                    spawnGlowFlash(en.x, en.y, en.z, 0xff6b2b, 2.2, 0.24);
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.emberPuff, 5, 4.8, 0.72, 3.6, 10);
                  } else if (p.skillId === 'dragon_pulse') {
                    spawnSpriteBurst(en.x, en.y + 1.2, en.z, vfxAtlas.explosionBurst, 2.9, 0.34, 0.4);
                    spawnGroundDecalWave(en.x, en.y, en.z, vfxAtlas.arcaneRingDecal, 3.1, 0.34);
                    spawnGlowFlash(en.x, en.y, en.z, 0x3bc9db, 3.0, 0.28);
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.electricSpark, 6, 5.4, 0.85, 4.0, 11);
                  } else if (p.skillId === 'shadow_star') {
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.shadowWisp, 4, 4.0, 0.72, 2.8, 7);
                  } else {
                    spawnPixelParticles(en.x, en.y, en.z, vfxAtlas.starGlint, 4, 4.2, 0.68, 3.0, 9);
                  }
                  p.pierce -= 1;
                  if (p.pierce <= 0) {
                    removeProj();
                    break;
                  }
                }
              }
            }
          }

          // 5. Enemies + Knocked-Out Catchables + Quality/Shiny Auras + Real-Time 3D Capture Sequence!
          for (let i = sim.enemies.length - 1; i >= 0; i--) {
            const en = sim.enemies[i];
            if (en.beingCaptured) continue;
            if (en.knockedOut) {
              en.animTime += dt;
              if (!en.isBoss) {
                en.koTimer = (en.koTimer ?? 18) - dt;
                if (en.koTimer <= 0) {
                  if (en.sprite) scene.remove(en.sprite);
                  if (en.shadow) scene.remove(en.shadow);
                  if (en.auraRing) scene.remove(en.auraRing);
                  sim.enemies.splice(i, 1);
                  continue;
                }
              }
              if (en.sprite) {
                en.sprite.position.set(en.x, en.y + 0.12, en.z);
                en.sprite.rotation.set(bbTiltX * 0.45, camYawNow, Math.PI * 0.44, 'YXZ');
                // Blink warning in final 3.5s before uncaptured wild Pokémon slips away!
                en.sprite.visible = en.isBoss || (en.koTimer ?? 10) > 3.5 || Math.floor((en.koTimer ?? 0) * 8) % 2 === 0;
              }
              if (en.auraRing) {
                const pulse = 0.92 + Math.sin(en.animTime * 6) * 0.14;
                en.auraRing.scale.setScalar(pulse);
                en.auraRing.position.set(en.x, en.y + 0.1, en.z);
              }
              en.shinyTimer = (en.shinyTimer ?? 0.5) - dt;
              if (en.shinyTimer <= 0) {
                en.shinyTimer = 0.55;
                spawnPixelParticles(en.x, en.y + 0.5, en.z, vfxAtlas.starGlint, 2, 1.5, 0.65, 2.4, 3.0);
              }
              continue;
            }
            if (en.hp <= 0) {
              if (en.auraRing) scene.remove(en.auraRing);
              sim.enemies.splice(i, 1);
              continue;
            }
            en.animTime += dt;
            if (en.hitFlash > 0) {
              en.hitFlash -= dt;
              if (en.sprite) {
                const baseTint = en.regionalSkin ? getSkinDef(en.regionalSkin).tintHex3D : 0xffffff;
                (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(en.hitFlash > 0 ? 0xff9999 : baseTint);
              }
            }
            const dx = sim.px - en.x;
            const dz = sim.pz - en.z;
            const dist = Math.hypot(dx, dz) || 1;
            // Species Temperament AI: Docile/Territorial wild Pokémon rest or patrol peacefully until approached or provoked!
            const aggroRange =
              en.temperament === 'docile'
                ? 4.8
                : en.temperament === 'territorial'
                  ? 11.5
                  : 26.0;
            if (!en.aggroed && !inTownPeaceZone && dist < aggroRange) {
              en.aggroed = true;
            }
            if (inTownPeaceZone && !en.isBoss) {
              en.aggroed = false;
            }
            const prevEnX = en.x;
            const prevEnZ = en.z;
            if (en.isAquatic) {
              // Amphibious Water Pokémon (Squirtle/Blastoise, Psyduck) thrive BOTH in lakes AND freely walk on dry land!
              const enRawY = getWalkableSurfaceHeight3D(en.x, en.z);
              const currentlyInWater = enRawY < WATER_LEVEL_3D + 0.05;
              if (currentlyInWater) {
                en.waterJumpTimer = (en.waterJumpTimer ?? 2.2) - dt;
                if (en.waterJumpTimer <= 0) {
                  en.waterJumpTimer = 2.6 + Math.random() * 2.2;
                  spawnPixelParticles(en.x, WATER_LEVEL_3D + 0.15, en.z, vfxAtlas.starGlint, 5, 3.6, 0.55, 4.2, 10);
                }
              }
              const swimSpeed = en.aggroed ? en.speed * 0.96 : en.speed * 0.48;
              const targetX = en.aggroed ? sim.px : (en.homeX ?? en.x) + Math.sin(en.animTime * 0.7) * 4.0;
              const targetZ = en.aggroed ? sim.pz : (en.homeZ ?? en.z) + Math.cos(en.animTime * 0.6) * 4.0;
              const sdx = targetX - en.x;
              const sdz = targetZ - en.z;
              const sDist = Math.hypot(sdx, sdz) || 1;
              if (sDist > 0.2) {
                en.x += (sdx / sDist) * swimSpeed * dt;
                en.z += (sdz / sDist) * swimSpeed * dt;
              }
            } else if (en.aggroed) {
              const candX = en.x + (dx / dist) * en.speed * dt;
              const candZ = en.z + (dz / dist) * en.speed * dt;
              const candY = getWalkableSurfaceHeight3D(candX, candZ);
              const isWaterOrFlyEn =
                SPECIES_CATALOG[en.species].element === 'water' ||
                en.species === 'gastly' ||
                en.species === 'dratini' ||
                (en.species === 'charmander' && en.stage === 'adult');
              // Land wild Pokémon dislike wading into water (reluctantly slow down in water & prefer dry banks unless chasing closely!)
              const wadeFactor = !isWaterOrFlyEn && candY < WATER_LEVEL_3D - 0.08 ? 0.45 : 1.0;
              if (isWaterOrFlyEn || en.isBoss || candY >= WATER_LEVEL_3D - 0.08 || dist < 7.5) {
                en.x += (dx / dist) * en.speed * wadeFactor * dt;
                en.z += (dz / dist) * en.speed * wadeFactor * dt;
              }
            } else if (en.isTrainer || en.temperament === 'territorial') {
              // Trainers & territorial Pokémon stroll naturally along their patrol route (avoids water & buildings!)
              const patrolR = en.isTrainer ? 5.8 : 2.6;
              const patrolSpd = en.isTrainer ? 0.52 : 0.35;
              const pxT = (en.homeX ?? en.x) + Math.sin(en.animTime * 0.52 + en.id) * patrolR;
              const pzT = (en.homeZ ?? en.z) + Math.cos(en.animTime * 0.44 + en.id) * patrolR;
              const pdx = pxT - en.x;
              const pdz = pzT - en.z;
              const pDist = Math.hypot(pdx, pdz) || 1;
              if (pDist > 0.25) {
                const nX = en.x + (pdx / pDist) * en.speed * patrolSpd * dt;
                const nZ = en.z + (pdz / pDist) * en.speed * patrolSpd * dt;
                if (getWalkableSurfaceHeight3D(nX, nZ) >= WATER_LEVEL_3D + 0.06) {
                  const posObj = { x: nX, z: nZ };
                  if (activeTownNow) {
                    resolveTownWallCollisions(posObj, 0.85, activeTownNow.colliders);
                  }
                  en.x = posObj.x;
                  en.z = posObj.z;
                }
              }
            }

            for (const z of nearbyZones) {
              const zd = Math.hypot(en.x - z.x, en.z - z.z);
              const minR = z.radius + en.radius + 0.25;
              if (zd < minR) {
                const a = zd > 0.05 ? Math.atan2(en.z - z.z, en.x - z.x) : Math.random() * Math.PI * 2;
                en.x = z.x + Math.cos(a) * minR;
                en.z = z.z + Math.sin(a) * minR;
              }
            }

            const rawEnY = getWalkableSurfaceHeight3D(en.x, en.z);
            const enInLake = rawEnY < WATER_LEVEL_3D + 0.05;
            const jumpArc =
              en.isAquatic && enInLake && (en.waterJumpTimer ?? 3) > 2.0
                ? Math.sin(((en.waterJumpTimer! - 2.0) / 0.85) * Math.PI) * 2.15
                : 0;
            en.y = en.isAquatic && enInLake ? WATER_LEVEL_3D + 0.08 + Math.max(0, jumpArc) : rawEnY;
            const enStepDist = Math.hypot(en.x - prevEnX, en.z - prevEnZ);
            const enMoving = enStepDist > dt * 0.35;
            if (enMoving) {
              en.faceX = (en.x - prevEnX) / (enStepDist || 1);
              en.faceZ = (en.z - prevEnZ) / (enStepDist || 1);
              en.hopPhase += dt * 7;
            }
            const hop = en.isTrainer
              ? 0
              : enMoving || en.isAquatic
                ? Math.abs(Math.sin(en.hopPhase)) * 0.11
                : 0;
            const sc = en.worldScale;
            if (en.sprite) {
              const edm = prefsRef.current.enemyDisplayMode;
              const showSprite =
                en.isBoss ||
                en.isShiny ||
                en.quality !== 'normal' ||
                edm === 'all' ||
                (edm === 'near' && dist < 24) ||
                (edm === 'very_near' && dist < 14);
              en.sprite.visible = showSprite;
              const eFaceX = enMoving && en.faceX !== undefined ? en.faceX : dx / dist;
              const eFaceZ = enMoving && en.faceZ !== undefined ? en.faceZ : dz / dist;
              const eRelFwd = eFaceX * camFwdX + eFaceZ * camFwdZ;
              const eRelRight = eFaceX * camRightX + eFaceZ * camRightZ;
              en.sprite.position.set(en.x, en.y + hop + 0.02, en.z);
              en.sprite.rotation.set(en.isTrainer ? bbTiltX * 0.22 : bbTiltX * 0.45, camYawNow, 0, 'YXZ');
              if (en.isTrainer) {
                if (showSprite) {
                  en.trainerWalkFrames ??= getNpcWalkSpriteFrames(en.trainerSprite ?? 'youngster');
                  (en.sprite.material as THREE.MeshBasicMaterial).map = sampleHumanWalkFrame(
                    en.trainerWalkFrames,
                    eRelFwd,
                    eRelRight,
                    en.animTime * 6.0,
                    enMoving,
                  );
                }
                en.sprite.scale.set(sc, sc, 1);
              } else if (en.pmdSheet?.ready) {
                if (showSprite) {
                  const dirIdx = pickPmdDirIndex(eRelFwd, eRelRight);
                  const enAnimT = enMoving || en.isAquatic ? en.animTime * 1.15 : 0;
                  (en.sprite.material as THREE.MeshBasicMaterial).map = samplePmd8DirFrame(
                    en.pmdSheet,
                    dirIdx,
                    enAnimT,
                  );
                }
                en.sprite.scale.set(sc, sc, 1);
              } else {
                const useBack = eRelFwd > 0.28 && Boolean(en.backAnimSheet);
                const activeSheet = useBack ? en.backAnimSheet : en.animSheet;
                if (showSprite && activeSheet) {
                  const enAnimT = enMoving || en.isAquatic ? en.animTime * 1.15 : 0;
                  (en.sprite.material as THREE.MeshBasicMaterial).map = sampleAnimatedFrame(
                    activeSheet,
                    enAnimT,
                  );
                }
                const flipX = useBack ? eRelRight < 0 : eRelRight > 0;
                en.sprite.scale.set(flipX ? -sc : sc, sc, 1);
              }
            }
            if (en.shadow) en.shadow.position.set(en.x, en.y + 0.06, en.z);
            if (en.auraRing) {
              const pulse = 0.94 + Math.sin(en.animTime * (en.isShiny ? 7 : 4)) * 0.1;
              en.auraRing.scale.setScalar(pulse);
              en.auraRing.position.set(en.x, en.y + 0.09, en.z);
            }
            if (en.isShiny) {
              en.shinyTimer = (en.shinyTimer ?? 0.35) - dt;
              if (en.shinyTimer <= 0) {
                en.shinyTimer = 0.42;
                spawnPixelParticles(en.x, en.y + sc * 0.4, en.z, vfxAtlas.starGlint, 2, 2.2, 0.72, 2.8, 3.5);
              }
            }

            // Boss Phase 2 Enrage Trigger (HP <= 50%)!
            if (en.isBoss && !en.bossPhase2 && en.hp <= en.maxHp * 0.5) {
              en.bossPhase2 = true;
              en.speed *= 1.24;
              sound.playCry(getPokemonCryId(en.species, 25));
              if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.48);
              if (prefsRef.current.bossAlerts) {
                showBanner('！守护者进入狂暴二阶段！全向螺旋弹幕开启！', 3200);
              }
              // Call 2 wild reinforcements once
              for (let ri = 0; ri < 2; ri++) {
                const ra = ri * Math.PI + Math.random();
                const sp = regionMeta.wildPool[Math.floor(Math.random() * regionMeta.wildPool.length)];
                spawnEnemy3D(
                  en.x + Math.cos(ra) * 3.5,
                  en.z + Math.sin(ra) * 3.5,
                  sp,
                  Math.round(80 * diffMeta.enemyHpMult),
                  4.5,
                  Math.round(14 * diffMeta.enemyDmgMult),
                );
              }
            }

            if ((en.isTrainer || en.isBoss) && !activeZone && !inTownPeaceZone) {
              en.shootCd -= dt;
              if (en.shootCd <= 0 && dist < 22) {
                const baseAng = Math.atan2(sim.pz - en.z, sim.px - en.x);
                en.attackCount = (en.attackCount ?? 0) + 1;
                if (en.isBoss) {
                  const p2 = Boolean(en.bossPhase2);
                  en.shootCd = p2 ? 1.28 : 1.75;
                  if (en.attackCount % 2 === 1) {
                    // Pattern A: Aimed Multi-Orb Fan Spread (5 orbs P1 / 7 orbs P2)
                    const count = p2 ? 7 : 5;
                    const spread = p2 ? 0.2 : 0.22;
                    for (let k = 0; k < count; k++) {
                      const a = baseAng + (k - (count - 1) / 2) * spread;
                      spawnSkillProjectile3D({
                        x: en.x,
                        y: en.y + 1.15,
                        z: en.z,
                        vx: Math.cos(a) * (p2 ? 11.4 : 10.0),
                        vz: Math.sin(a) * (p2 ? 11.4 : 10.0),
                        dmg: en.dmg,
                        radius: 0.5,
                        pierce: 1,
                        life: 2.5,
                        colorHex: p2 ? 0xae3ec9 : 0xe03131,
                        scale: p2 ? 1.5 : 1.38,
                        frames: vfxAtlas.enemyOrb,
                        fromEnemy: true,
                      });
                    }
                  } else {
                    // Pattern B: 360° Ring Nova (10 orbs P1 / 14 spiral orbs P2)
                    const count = p2 ? 14 : 10;
                    const offset = (en.attackCount * 0.35) % (Math.PI * 2);
                    for (let k = 0; k < count; k++) {
                      const a = offset + (k * Math.PI * 2) / count;
                      spawnSkillProjectile3D({
                        x: en.x,
                        y: en.y + 1.15,
                        z: en.z,
                        vx: Math.cos(a) * (p2 ? 9.6 : 8.4),
                        vz: Math.sin(a) * (p2 ? 9.6 : 8.4),
                        dmg: Math.round(en.dmg * 0.9),
                        radius: 0.48,
                        pierce: 1,
                        life: 2.6,
                        colorHex: 0xf76707,
                        scale: 1.36,
                        frames: vfxAtlas.enemyOrb,
                        fromEnemy: true,
                      });
                    }
                  }
                } else {
                  // Enemy Trainer: 3-orb tactical spread volley
                  en.shootCd = 2.25;
                  for (let k = -1; k <= 1; k++) {
                    const a = baseAng + k * 0.24;
                    spawnSkillProjectile3D({
                      x: en.x,
                      y: en.y + 1.05,
                      z: en.z,
                      vx: Math.cos(a) * 9.8,
                      vz: Math.sin(a) * 9.8,
                      dmg: en.dmg,
                      radius: 0.46,
                      pierce: 1,
                      life: 2.2,
                      colorHex: 0xe03131,
                      scale: 1.3,
                      frames: vfxAtlas.enemyOrb,
                      fromEnemy: true,
                    });
                  }
                }
              }
            }

            if (!activeZone && !inTownPeaceZone && dist < en.radius + 0.65 && sim.py - groundY < 1.15 && sim.invuln <= 0) {
              const takenDmg = Math.max(1, Math.round(en.dmg * (1 - metaBonusesRef.current.dmgReduction)));
              sim.hp = Math.max(0, sim.hp - takenDmg);
              sim.invuln = 0.55;
              if (prefsRef.current.screenShake) shakeRef.current = Math.max(shakeRef.current, 0.32);
              sound.play('hit');
              if (prefsRef.current.showDamageNumbers) {
                sim.dmgPops.push({ id: sim.nextId++, wx: sim.px, wy: sim.py + 2.3, wz: sim.pz, text: `-${takenDmg}`, color: '#ff6b6b', life: 0.55 });
              }
              if (sim.hp <= 0) {
                if (sim.revivesLeft > 0) {
                  sim.revivesLeft -= 1;
                  sim.hp = Math.round(sim.maxHp * 0.65);
                  sim.invuln = 2.6;
                  sound.play('levelup');
                  spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.arcaneRingDecal, 7.0, 0.55);
                  spawnPixelParticles(sim.px, sim.py + 1.0, sim.pz, vfxAtlas.starGlint, 16, 7.5, 0.9, 4.5, 9);
                  for (const e2 of sim.enemies) {
                    const d2 = Math.hypot(e2.x - sim.px, e2.z - sim.pz);
                    if (d2 < 8.0 && d2 > 0.1) {
                      e2.x += ((e2.x - sim.px) / d2) * 5.2;
                      e2.z += ((e2.z - sim.pz) / d2) * 5.2;
                    }
                  }
                  showBanner(`⚡ 气势披带发动！原地复活（剩余 ${sim.revivesLeft} 次）！`, 3400);
                } else if (gameMode === 'story') {
                  sim.px = 0;
                  sim.pz = 0;
                  sim.py = getTerrainHeight3D(0, 0);
                  sim.hp = sim.maxHp;
                  sim.invuln = 3.0;
                  onHealParty();
                  sound.play('levelup');
                  try { window.localStorage.setItem('pocket_paw_last_world_pos_v1', JSON.stringify({ x: 0, z: 0 })); } catch {}
                  showBanner('🏥 体力与血量耗尽！已紧急护送回出生点休整，全队恢复满血！', 3800);
                  break;
                } else {
                  endedRef.current = true;
                  pausedRef.current = true;
                  setResultSummary(buildResultSummary(false));
                  break;
                }
              }
            }
          }

          // 5B. Real-Time 3D Cinematic Poké Ball Capture Animation (Arc -> Crimson Absorb -> 3 Wobbles -> Golden Starburst!)
          for (let ci = sim.activeCaptures.length - 1; ci >= 0; ci--) {
            const cap = sim.activeCaptures[ci];
            cap.t += dt;
            const en = cap.enemy;
            const gyT = getTerrainHeight3D(cap.targetX, cap.targetZ);
            if (cap.t < 0.46) {
              // Phase 1: High spinning 3D parabolic throw arc
              const u = cap.t / 0.46;
              const bx = cap.startX + (cap.targetX - cap.startX) * u;
              const bz = cap.startZ + (cap.targetZ - cap.startZ) * u;
              const by = cap.startY + (cap.targetY - cap.startY) * u + Math.sin(u * Math.PI) * 3.8;
              cap.ballSprite.position.set(bx, by, bz);
              (cap.ballSprite.material as THREE.SpriteMaterial).rotation -= dt * 16;
              cap.ballShadow.position.set(bx, getTerrainHeight3D(bx, bz) + 0.06, bz);
              if (Math.random() < 0.45) {
                spawnPixelParticles(bx, by - 0.3, bz, vfxAtlas.starGlint, 1, 0.9, 0.55, 0.8, 2.5);
              }
            } else if (cap.t < 0.92) {
              // Phase 2: Crimson digitizing laser absorb flash!
              const u = (cap.t - 0.46) / 0.46;
              if (!cap.absorbed) {
                cap.absorbed = true;
                sound.play('pokeball');
                setCaptureCutscene((prev: any) => (prev ? { ...prev, phase: 'absorb' } : null));
                spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff3b3b, Math.max(3.2, en.worldScale * 1.15), 0.48);
                spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.fireBlastDecal, Math.max(2.8, en.worldScale), 0.42);
                spawnPixelParticles(cap.targetX, gyT + 0.8, cap.targetZ, vfxAtlas.starGlint, 8, 4.8, 0.85, 4.0, 5.5);
              }
              const hoverY = gyT + 1.9 + Math.sin(u * Math.PI) * 0.65;
              cap.ballSprite.position.set(cap.targetX, hoverY, cap.targetZ);
              (cap.ballSprite.material as THREE.SpriteMaterial).rotation = Math.sin(u * Math.PI * 3) * 0.25;
              cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
              if (en.sprite) {
                const shrink = Math.max(0.05, 1 - u);
                en.sprite.scale.set(en.worldScale * shrink, en.worldScale * shrink, 1);
                en.sprite.position.set(cap.targetX, gyT + u * 1.75, cap.targetZ);
                (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(0xff5252);
              }
            } else if (cap.t < 2.25) {
              // Phase 3: Ball bounces onto grass & performs 3 suspenseful wobbles!
              if (en.sprite) en.sprite.visible = false;
              if (en.shadow) en.shadow.visible = false;
              const u = cap.t - 0.92; // 0..1.33s
              const dropBounce = u < 0.22 ? Math.abs(Math.sin((u / 0.22) * Math.PI)) * 0.75 : 0;
              const wobbleIdx = Math.floor((u - 0.22) / 0.36);
              if (u >= 0.22 && wobbleIdx >= 0 && wobbleIdx < 3 && wobbleIdx >= cap.wobbleClicks) {
                cap.wobbleClicks = wobbleIdx + 1;
                sound.play('pokeball');
                setCaptureCutscene((prev: any) =>
                  prev ? { ...prev, phase: 'wobble', wobbleCount: wobbleIdx + 1 } : null,
                );
                spawnPixelParticles(cap.targetX, gyT + 0.6, cap.targetZ, vfxAtlas.electricSpark, 3, 2.2, 0.55, 2.4, 7.0);
              }
              const wobbleAngle =
                u >= 0.22 && u < 1.28
                  ? Math.sin(((u - 0.22) % 0.36) / 0.36 * Math.PI * 2) * 0.55 * (wobbleIdx % 2 === 0 ? 1 : -1)
                  : 0;
              cap.ballSprite.position.set(cap.targetX, gyT + 0.56 + dropBounce, cap.targetZ);
              (cap.ballSprite.material as THREE.SpriteMaterial).rotation = wobbleAngle;
              cap.ballShadow.position.set(cap.targetX, gyT + 0.06, cap.targetZ);
            } else {
              // Phase 4: Resolution — CLICK! Golden Starburst Catch OR Break-Free!
              if (!cap.resolved) {
                cap.resolved = true;
                (cap.ballSprite.material as THREE.SpriteMaterial).rotation = 0;
                if (cap.willCatch) {
                  setCaptureCutscene((prev: any) => (prev ? { ...prev, phase: 'caught' } : null));
                  sound.play('hatch');
                  window.setTimeout(() => sound.play('levelup'), 220);
                  spawnGroundDecalWave(cap.targetX, gyT, cap.targetZ, vfxAtlas.healCircleDecal, 4.6, 0.62);
                  spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xffe066, 4.4, 0.55);
                  spawnPixelParticles(cap.targetX, gyT + 0.9, cap.targetZ, vfxAtlas.starGlint, 16, 6.2, 1.05, 5.8, 5.5);
                  const catchLv = en.isBoss
                    ? Math.min(32, pet.level + 4)
                    : Math.min(28, Math.max(4, pet.level + (en.quality === 'epic' ? 2 : en.isShiny ? 2 : 0)));
                  const spName = SPECIES_CATALOG[en.species].stageNames[en.stage] ?? SPECIES_CATALOG[en.species].defaultName;
                  const rSkinLabel = en.regionalSkin ? `🏮[${getSkinDef(en.regionalSkin).name}] ` : '';
                  const tagTxt = en.isShiny ? '★异色 ' : rSkinLabel || (MONSTER_QUALITY_META[en.quality].label ? `[${MONSTER_QUALITY_META[en.quality].label}] ` : '');
                  const caughtSkin: PetSkinId | undefined = en.isShiny ? 'shiny' : en.regionalSkin;
                  onCaptureBoss?.(en.species, catchLv, caughtSkin);
                  if (sim.followers.length < maxFollowersRef.current) {
                    addFollowerToRun(en.species, `${en.isShiny ? '★' : ''}${spName}`, en.stage, undefined, caughtSkin);
                  }
                  if (en.isBoss) {
                    sim.capturedBoss = { species: en.species, name: spName, level: catchLv };
                  }
                  showBanner(`叮咚！成功收服了 ${tagTxt}${spName} (Lv.${catchLv})！已加入精灵球盒！`, 3800);
                  if (en.sprite) scene.remove(en.sprite);
                  if (en.shadow) scene.remove(en.shadow);
                  if (en.auraRing) scene.remove(en.auraRing);
                  const eIdx = sim.enemies.indexOf(en);
                  if (eIdx !== -1) sim.enemies.splice(eIdx, 1);
                } else {
                  setCaptureCutscene((prev: any) => (prev ? { ...prev, phase: 'escaped' } : null));
                  // Live wild Pokémon broke free — pops back out with burst & chunk of damage!
                  sound.play('hit');
                  spawnGlowFlash(cap.targetX, gyT, cap.targetZ, 0xff6b6b, 3.0, 0.35);
                  en.beingCaptured = false;
                  if (en.sprite) {
                    en.sprite.visible = true;
                    en.sprite.scale.set(en.worldScale, en.worldScale, 1);
                    const baseTint = en.regionalSkin ? getSkinDef(en.regionalSkin).tintHex3D : 0xffffff;
                    (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(baseTint);
                  }
                  if (en.shadow) en.shadow.visible = true;
                  damageEnemy3D(en, Math.round(en.maxHp * 0.28), '#ff922b');
                  showBanner('哎呀！野生宝可梦挣脱了精灵球！先削弱它再投球吧！', 2200);
                }
              }
              if (cap.t >= 3.25) {
                scene.remove(cap.ballSprite, cap.ballShadow);
                sim.activeCaptures.splice(ci, 1);
                setCaptureCutscene(null);
                if (cap.willCatch && en.isBoss && gameMode === 'story' && !endedRef.current) {
                  sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
                  endedRef.current = true;
                  pausedRef.current = true;
                  setResultSummary(buildResultSummary(true, sim.capturedBoss));
                }
              }
            }
          }

          // 6. Magnetic Loot
          for (let i = sim.loots.length - 1; i >= 0; i--) {
            const g = sim.loots[i];
            g.phase += dt * 4;
            const dx = sim.px - g.x;
            const dz = sim.pz - g.z;
            const dist = Math.hypot(dx, dz) || 1;
            if (dist < sim.pickupRadius) {
              g.x += (dx / dist) * 16 * dt;
              g.z += (dz / dist) * 16 * dt;
            }
            g.mesh.position.set(g.x, getTerrainHeight3D(g.x, g.z) + 0.48 + Math.sin(g.phase) * 0.14, g.z);
            g.mesh.rotation.y += dt * 3.5;

            if (dist < 1.1) {
              if (g.kind === 'xp') {
                sim.xp += g.value;
                if (sim.xp >= sim.xpNeed) {
                  sim.xp -= sim.xpNeed;
                  sim.runLevel += 1;
                  sim.xpNeed = Math.round(sim.xpNeed * 1.36 + 8);
                  pausedRef.current = true;
                  sound.play('levelup');
                  setLevelChoices(buildLevelChoices());
                }
              } else if (g.kind === 'coin') {
                sim.coins += g.value;
                sound.play('coin');
              } else if (g.kind === 'berry') {
                sim.hp = Math.min(sim.maxHp, sim.hp + g.value);
                sound.play('eat');
              } else if (g.kind === 'magnet') {
                for (const o of sim.loots) {
                  if (o.kind === 'xp' || o.kind === 'coin') {
                    o.x = sim.px + (Math.random() - 0.5) * 1.2;
                    o.z = sim.pz + (Math.random() - 0.5) * 1.2;
                  }
                }
                sound.play('happy');
              }
              scene.remove(g.mesh);
              sim.loots.splice(i, 1);
            }
          }

          // 7. HD-2D Pixel-Art 3D VFX Loop (Animated pixel sprites, painted ground waves & additive glows!)
          for (let i = sim.vfxs.length - 1; i >= 0; i--) {
            const v = sim.vfxs[i];
            v.life -= dt;
            if (v.life <= 0) {
              scene.remove(v.mesh);
              sim.vfxs.splice(i, 1);
            } else {
              const ratio = Math.max(0, v.life / v.maxLife);
              const prog = 1 - ratio;
              if (v.kind === 'decal_wave') {
                const eased = 1 - Math.pow(1 - prog, 2.2);
                const s = Math.max(0.3, eased * (v.maxRadius ?? 5));
                v.mesh.scale.set(s, s, 1);
                const m = (v.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
                m.opacity = ratio * 0.92;
              } else if (v.kind === 'glow_flash') {
                const s = (0.55 + prog * 0.7) * (v.maxRadius ?? 2.4);
                v.mesh.scale.set(s, s, 1);
                const m = (v.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
                m.opacity = ratio * 0.78;
              } else if (v.kind === 'lightning') {
                const sp = v.mesh as THREE.Sprite;
                if (v.frames && v.frames.length > 0) {
                  const fIdx = Math.min(v.frames.length - 1, Math.floor(prog * v.frames.length * 2) % v.frames.length);
                  (sp.material as THREE.SpriteMaterial).map = v.frames[fIdx];
                }
                (sp.material as THREE.SpriteMaterial).opacity = ratio > 0.25 ? 1 : ratio * 4;
              } else if (v.kind === 'sprite_burst') {
                const sp = v.mesh as THREE.Sprite;
                if (v.vy) sp.position.y += v.vy * dt;
                if (v.frames && v.frames.length > 0) {
                  const fIdx = Math.min(v.frames.length - 1, Math.floor(prog * v.frames.length));
                  (sp.material as THREE.SpriteMaterial).map = v.frames[fIdx];
                }
                const s = (v.baseScale ?? 1.8) * (0.85 + prog * 0.4);
                sp.scale.set(s, s, 1);
                (sp.material as THREE.SpriteMaterial).opacity = ratio > 0.2 ? 1 : ratio * 5;
              } else if (v.kind === 'particle') {
                const sp = v.mesh as THREE.Sprite;
                sp.position.x += (v.vx ?? 0) * dt;
                sp.position.y += (v.vy ?? 0) * dt;
                sp.position.z += (v.vz ?? 0) * dt;
                v.vy = (v.vy ?? 0) - (v.gravity ?? 10) * dt;
                const s = (v.baseScale ?? 0.7) * Math.max(0.25, ratio);
                sp.scale.set(s, s, 1);
                const camDist = sp.position.distanceTo(camera.position);
                const nearFade = camDist < 6 ? Math.max(0, (camDist - 3.5) / 2.5) : 1;
                const vfxAlpha = prefsRef.current.vfxOpacity / 100;
                (sp.material as THREE.SpriteMaterial).opacity = Math.min(1, ratio * 1.4) * nearFade * vfxAlpha;
              }
            }
          }

          for (let i = sim.dmgPops.length - 1; i >= 0; i--) {
            sim.dmgPops[i].life -= dt;
            sim.dmgPops[i].wy += dt * 1.6;
            if (sim.dmgPops[i].life <= 0) sim.dmgPops.splice(i, 1);
          }

}
