import type { ArenaSharedCtx } from './arenaTypesAndProps';
import * as THREE from 'three';
import { SPECIES_CATALOG, getPokemonPhysicalMetrics, getPokemonWorldScale3D } from '../../data/catalog';
import { SURVIVOR_SKILLS, getTerrainHeight3D, type SurvivorSkillId, type TargetPriority } from '../../data/survivorsTactics';
import { MAX_PET_SLOTS } from '../../utils/petEngine';
import { getSkillVfxAtlas } from '../../data/skillVfx3D';
import { type PetSkinId, type SpeciesId } from '../../types/pet';
import { GYM_BADGE_CATALOG, getElementalSynergyBonus, getSkinDef, type GymBadgeId } from '../../data/metaProgression';
import { sound } from '../../utils/sound';
import { getSolarEcologicalSpeciesPool } from '../TimeEcologyModal';
import { getWeatherCombatBonus } from '../../utils/weatherSystem';
import { BILLBOARD_PITCH_TILT, SHARED_ENTITY_SHADOW_MAT, UNIT_SHADOW_GEO, rollMonsterQuality, MONSTER_QUALITY_META, type ActiveFollower, type MonsterQuality, type Enemy3D, type Loot3D } from './arenaTypesAndProps';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function createArenaCombatActions3D(rawCtx: Record<string, any>) {
  const { activeWorldRun, adventureStyleRef, buildResultSummary, camOrbitRef, captureFinishRef, comboRef, createSpriteEntity, diffMeta, endedRef, gameMode, getPixelTexture, liveOverlandCityRef, liveWeatherRef, metaBonusesRef, metaRef, onUpdateMeta, pausedRef, pet, prefsRef, regionMeta, save, savePetsCountRef, scene, setCaptureCutscene, setNearbyKoTarget, setResultSummary, shakeRef, showBanner, simRef, solarInfoRef, tacticsRef, triggerBattleActionRef } = rawCtx as ArenaSharedCtx;
    const spawnLoot3D = (x: number, z: number, kind: Loot3D['kind'], value: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const geo =
        kind === 'xp'
          ? new THREE.OctahedronGeometry(0.3)
          : kind === 'coin'
            ? new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8)
            : kind === 'berry'
              ? new THREE.DodecahedronGeometry(0.34)
              : new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const color =
        kind === 'xp'
          ? value >= 20
            ? 0xae3ec9
            : 0x339af0
          : kind === 'coin'
            ? 0xffd43b
            : kind === 'berry'
              ? 0xff6b6b
              : 0x4dabf7;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.38 }),
      );
      mesh.position.set(x, getTerrainHeight3D(x, z) + 0.5, z);
      scene.add(mesh);
      sim.loots.push({ x, z, kind, value, phase: Math.random() * 6, mesh });
    };

    // Procedural HD-2D Pixel-Art Skill VFX Texture Atlas (Zero raw untextured primitives!)
    const vfxAtlas = getSkillVfxAtlas();
    const decalPlaneGeo = new THREE.PlaneGeometry(2, 2);

    const spawnPixelParticles = (
      x: number,
      y: number,
      z: number,
      tex: THREE.CanvasTexture,
      count = 6,
      speed = 4.6,
      scale = 0.72,
      rise = 3.2,
      gravity = 11.5,
    ) => {
      const sim = simRef.current;
      if (!sim || sim.vfxs.length > 150) return;
      for (let i = 0; i < count; i++) {
        const ang = (i * Math.PI * 2) / Math.max(1, count) + (Math.random() - 0.5) * 0.65;
        const spd = speed * (0.45 + Math.random() * 0.75);
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            opacity: 0.96,
            depthWrite: false,
          }),
        );
        const s = scale * (0.75 + Math.random() * 0.45);
        sp.scale.set(s, s, 1);
        sp.position.set(x, y + 0.75, z);
        scene.add(sp);
        const life = 0.28 + Math.random() * 0.24;
        sim.vfxs.push({
          kind: 'particle',
          life,
          maxLife: life,
          baseScale: s,
          vx: Math.cos(ang) * spd,
          vy: rise * (0.65 + Math.random() * 0.7),
          vz: Math.sin(ang) * spd,
          gravity,
          mesh: sp,
        });
      }
    };

    const spawnGroundDecalWave = (
      x: number,
      y: number,
      z: number,
      tex: THREE.CanvasTexture,
      maxRadius: number,
      maxLife: number,
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const m = new THREE.Mesh(
        decalPlaneGeo,
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y + 0.16, z);
      m.scale.setScalar(0.35);
      scene.add(m);
      sim.vfxs.push({ kind: 'decal_wave', life: maxLife, maxLife, maxRadius, mesh: m });
    };

    const spawnGlowFlash = (
      x: number,
      y: number,
      z: number,
      hex: number,
      maxRadius: number,
      maxLife: number,
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const m = new THREE.Mesh(
        decalPlaneGeo,
        new THREE.MeshBasicMaterial({
          map: vfxAtlas.softGlow,
          color: hex,
          transparent: true,
          opacity: 0.82,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y + 0.14, z);
      m.scale.setScalar(maxRadius * 0.6);
      scene.add(m);
      sim.vfxs.push({ kind: 'glow_flash', life: maxLife, maxLife, maxRadius, mesh: m });
    };

    const spawnSpriteBurst = (
      x: number,
      y: number,
      z: number,
      frames: THREE.CanvasTexture[],
      scale: number,
      maxLife: number,
      riseSpeed = 0,
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: frames[0],
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      sp.scale.set(scale, scale, 1);
      sp.position.set(x, y, z);
      scene.add(sp);
      sim.vfxs.push({
        kind: 'sprite_burst',
        life: maxLife,
        maxLife,
        baseScale: scale,
        vy: riseSpeed,
        frames,
        mesh: sp,
      });
    };

    const spawnLightningBolt3D = (x: number, y: number, z: number, hex: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: vfxAtlas.thunderbolt[0],
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      sp.scale.set(3.2, 8.6, 1);
      sp.position.set(x, y + 4.2, z);
      scene.add(sp);
      sim.vfxs.push({
        kind: 'lightning',
        life: 0.34,
        maxLife: 0.34,
        frames: vfxAtlas.thunderbolt,
        mesh: sp,
      });
      spawnGroundDecalWave(x, y, z, vfxAtlas.electricRingDecal, 2.7, 0.34);
      spawnGlowFlash(x, y, z, hex, 2.8, 0.28);
      spawnPixelParticles(x, y, z, vfxAtlas.electricSpark, 6, 5.4, 0.85, 4.2, 12);
    };

    const spawnSkillProjectile3D = (opts: {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy?: number;
      vz: number;
      dmg: number;
      radius: number;
      pierce: number;
      life: number;
      colorHex: number;
      scale: number;
      frames: THREE.CanvasTexture[];
      ownerId?: string;
      skillId?: SurvivorSkillId;
      fromEnemy?: boolean;
    }) => {
      const sim = simRef.current;
      if (!sim) return;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: opts.frames[0],
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      sprite.scale.set(opts.scale, opts.scale, 1);
      sprite.position.set(opts.x, opts.y, opts.z);

      // Additive ground light pool gliding under every flying skill!
      const glow = new THREE.Mesh(
        decalPlaneGeo,
        new THREE.MeshBasicMaterial({
          map: vfxAtlas.softGlow,
          color: opts.colorHex,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.scale.setScalar(opts.scale * 0.72);
      glow.position.set(opts.x, getTerrainHeight3D(opts.x, opts.z) + 0.14, opts.z);

      scene.add(sprite, glow);
      sim.projectiles.push({
        x: opts.x,
        y: opts.y,
        z: opts.z,
        vx: opts.vx,
        vy: opts.vy ?? 0,
        vz: opts.vz,
        dmg: opts.dmg,
        radius: opts.radius,
        pierce: opts.pierce,
        life: opts.life,
        animTime: Math.random() * 0.5,
        fromEnemy: opts.fromEnemy,
        ownerId: opts.ownerId,
        skillId: opts.skillId,
        colorHex: opts.colorHex,
        trailTimer: 0.04,
        frames: opts.frames,
        sprite,
        glow,
      });
    };

    const damageEnemy3D = (
      en: Enemy3D,
      amount: number,
      color = '#ffe066',
      sourceFollowerId?: string,
    ) => {
      const sim = simRef.current;
      if (!sim || en.hp <= 0) return;
      const actualDmg = Math.min(en.hp, amount);
      en.hp -= amount;
      en.aggroed = true;
      sim.totalDamage += actualDmg;
      const srcFollower = sourceFollowerId
        ? sim.followers.find((f) => f.id === sourceFollowerId)
        : undefined;
      if (srcFollower) {
        srcFollower.damageDealt += actualDmg;
      }
      en.hitFlash = 0.14;
      sound.play('impact');
      if (prefsRef.current.showDamageNumbers) {
        sim.dmgPops.push({
          id: sim.nextId++,
          wx: en.x + (Math.random() - 0.5) * 0.6,
          wy: en.y + (en.isBoss ? 2.7 : 1.8),
          wz: en.z,
          text: `-${amount}`,
          color,
          life: 0.55,
        });
      }

      if (en.hp <= 0) {
        sim.kills += 1;
        comboRef.current.count += 1;
        comboRef.current.timer = 4.2;
        if (en.isBoss && prefsRef.current.screenShake) {
          shakeRef.current = Math.max(shakeRef.current, 0.55);
        }
        if (srcFollower) srcFollower.kills += 1;
        if (en.isTrainer) sim.trainersDefeated += 1;

        const qMeta = MONSTER_QUALITY_META[en.quality];
        const lootMult = qMeta.lootMult * (en.isShiny ? 2.2 : 1.0);
        spawnSpriteBurst(
          en.x,
          en.y + en.worldScale * 0.55,
          en.z,
          vfxAtlas.explosionBurst,
          en.isBoss ? 4.2 : Math.max(1.9, en.worldScale * 0.95),
          0.32,
          0.6,
        );
        spawnPixelParticles(
          en.x,
          en.y,
          en.z,
          en.isBoss || en.isShiny || en.quality === 'epic' ? vfxAtlas.starGlint : vfxAtlas.koPuff,
          en.isBoss ? 12 : en.isShiny ? 10 : 5,
          en.isBoss ? 6.2 : 3.8,
          en.isBoss ? 1.1 : 0.8,
          3.4,
          7.5,
        );
        spawnLoot3D(
          en.x,
          en.z,
          'xp',
          Math.round((en.isBoss ? 58 : en.isTrainer ? 26 : 6 + Math.floor(sim.elapsed / 25) * 2) * lootMult),
        );
        if (en.isBoss || en.isTrainer || en.quality !== 'normal' || en.isShiny || Math.random() < 0.36) {
          spawnLoot3D(
            en.x + 0.6,
            en.z + 0.4,
            'coin',
            Math.round(
              (en.isBoss
                ? 36 * diffMeta.rewardMult
                : en.isTrainer
                  ? 15 * sim.greedMult
                  : Math.max(2, 3 * sim.greedMult)) * lootMult,
            ),
          );
        }
        if (en.isTrainer) {
          sound.play('ko');
          spawnLoot3D(en.x - 0.6, en.z, 'berry', 30);
          // Award corresponding Kanto Gym Badge when defeating a Gym Leader!
          const leaderToBadge: Record<string, GymBadgeId> = {
            '馆主 小刚': 'boulder_badge',
            '馆主 小霞': 'cascade_badge',
            '馆主 马志士': 'thunder_badge',
            '馆主 莉佳': 'rainbow_badge',
            '劲敌 小茂': 'earth_badge',
          };
          const wonBadgeId = en.trainerName ? leaderToBadge[en.trainerName] : undefined;
          const alreadyOwned = wonBadgeId ? (metaRef.current.unlockedBadges ?? []).includes(wonBadgeId) : true;
          if (wonBadgeId && !alreadyOwned) {
            const bDef = GYM_BADGE_CATALOG.find((b) => b.id === wonBadgeId);
            onUpdateMeta?.((prev) => ({
              ...prev,
              unlockedBadges: Array.from(new Set([...(prev.unlockedBadges ?? []), wonBadgeId])),
            }));
            sound.play('levelup');
            showBanner(`🏅 击败「${en.trainerName}」获得【${bDef?.name}】！${bDef?.perkText}！`, 4200);
          } else {
            showBanner(`击败敌方训练师「${en.trainerName}」！爆出丰厚金币与树果！`);
          }
        } else if (en.quality === 'epic' || en.quality === 'elite' || Math.random() < 0.05) {
          spawnLoot3D(en.x - 0.5, en.z, 'berry', 28);
        } else if (Math.random() < 0.025) {
          spawnLoot3D(en.x - 0.5, en.z, 'magnet', 1);
        }

        // Defeated Boss / Shiny / Regional-Skin / Elite / Epic Pokémon fall knocked-out on the grass (capped at 2 simultaneous non-Boss catchables so encounters stay special!)
        const activeKoNonBoss = sim.enemies.filter((e) => e.knockedOut && !e.isBoss).length;
        const isCatchableKo =
          !en.isTrainer &&
          (en.isBoss ||
            (activeKoNonBoss < 2 &&
              (en.isShiny || Boolean(en.regionalSkin) || en.quality === 'elite' || en.quality === 'epic')));
        if (isCatchableKo) {
          en.knockedOut = true;
          const koMult = metaBonusesRef.current.koDurationMult;
          en.koTimer = en.isBoss
            ? 999999
            : Math.round(
                (en.isShiny ? 45 : en.regionalSkin ? 38 : en.quality === 'epic' ? 32 : 18) * koMult,
              );
          en.hp = 0;
          if (en.sprite) {
            en.sprite.rotation.z = Math.PI * 0.45; // lying knocked-out on its side on the grass!
            (en.sprite.material as THREE.MeshBasicMaterial).color.setHex(0xd0d6e6);
          }
          if (!en.auraRing) {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(en.worldScale * 0.34, en.worldScale * 0.5, 24),
              new THREE.MeshBasicMaterial({
                color: 0xffe066,
                transparent: true,
                opacity: 0.82,
                side: THREE.DoubleSide,
                depthWrite: false,
              }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(en.x, en.y + 0.1, en.z);
            scene.add(ring);
            en.auraRing = ring;
          } else {
            (en.auraRing.material as THREE.MeshBasicMaterial).color.setHex(0xffe066);
          }
          sound.play(en.isBoss ? 'levelup' : 'ko');
          const spTitle = SPECIES_CATALOG[en.species].stageNames[en.stage] ?? SPECIES_CATALOG[en.species].defaultName;
          const rSkinTag = en.regionalSkin ? `🏮[${getSkinDef(en.regionalSkin).name}] ` : '';
          const tagPrefix = en.isShiny ? '★异色 ' : rSkinTag || (qMeta.label ? `[${qMeta.label}] ` : '');
          showBanner(`✨ ${tagPrefix}${spTitle} 倒地昏迷！走近它即可投掷精灵球收服！`, 3600);
        } else {
          if (en.sprite) scene.remove(en.sprite);
          if (en.shadow) scene.remove(en.shadow);
          if (en.auraRing) scene.remove(en.auraRing);
        }
      }
    };

    const pickTargetForFollower = (f: ActiveFollower, enemies: Enemy3D[], priority: TargetPriority): Enemy3D[] => {
      const alive = enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - f.x, e.z - f.z) < 23);
      if (alive.length === 0) return [];
      if (priority === 'highest_hp') {
        return [...alive].sort((a, b) => (b.isBoss ? 99999 : b.hp) - (a.isBoss ? 99999 : a.hp));
      }
      if (priority === 'lowest_hp') return [...alive].sort((a, b) => a.hp - b.hp);
      if (priority === 'random') return [...alive].sort(() => Math.random() - 0.5);
      return [...alive].sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z));
    };

    const fireSkill = (f: ActiveFollower, skillId: SurvivorSkillId, salvoBonus: boolean) => {
      const sim = simRef.current;
      if (!sim) return;
      const meta = SURVIVOR_SKILLS[skillId];
      const tac = tacticsRef.current;
      const modeMult =
        (tac.castMode === 'charged' ? 1.42 : salvoBonus && tac.castMode === 'salvo' ? 1.28 : 1.0) *
        (sim.boostTimer > 0 ? 1.55 : 1.0);
      const syn = getElementalSynergyBonus(SPECIES_CATALOG[f.species].element, metaRef.current);
      const wMod = getWeatherCombatBonus(liveWeatherRef.current.kind, SPECIES_CATALOG[f.species].element);
      const dmg = Math.round(
        sim.baseAtk * sim.atkMult * syn.atkMult * wMod.atkMult * meta.powerMult * (0.9 + f.level * 0.25) * modeMult,
      );
      const targets = pickTargetForFollower(f, sim.enemies, tac.targetPriority);

      if (skillId === 'heal_bell') {
        const missingHp = Math.max(0, Math.round(sim.maxHp - sim.hp));
        const rad = 4.8 + f.level * 0.65;
        const nearbyEnemies = sim.enemies.filter((en) => en.hp > 0 && Math.hypot(en.x - sim.px, en.z - sim.pz) < rad);
        // Never spam bell icon / green +++ / fake +HP text when already at full HP and no enemy is in range!
        if (missingHp <= 0 && nearbyEnemies.length === 0) {
          return;
        }
        const rawHeal = Math.round(sim.maxHp * (0.08 + f.level * 0.02));
        const actualHeal = Math.min(missingHp, rawHeal);
        if (actualHeal > 0) {
          sim.hp = Math.min(sim.maxHp, sim.hp + actualHeal);
        }
        f.casts += 1;
        f.castAnim = 0.28;
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.healCircleDecal, rad, 0.5);
        spawnGlowFlash(sim.px, sim.py, sim.pz, 0x69db7c, rad * 0.62, 0.38);
        if (actualHeal > 0) {
          spawnSpriteBurst(sim.px, sim.py + 2.75, sim.pz, vfxAtlas.healBell, 0.72, 0.42, 0.85);
          spawnPixelParticles(sim.px, sim.py + 0.5, sim.pz, vfxAtlas.healPlus, 5, 2.2, 0.65, 4.4, 3.8);
          sim.dmgPops.push({
            id: sim.nextId++,
            wx: sim.px,
            wy: sim.py + 2.6,
            wz: sim.pz,
            text: `+${actualHeal} HP`,
            color: '#69db7c',
            life: 0.72,
          });
          sound.play('happy');
        }
        for (const en of nearbyEnemies) {
          const d = Math.hypot(en.x - sim.px, en.z - sim.pz);
          damageEnemy3D(en, dmg, meta.color, f.id);
          if (!en.isBoss && d > 0.1) {
            en.x += ((en.x - sim.px) / d) * 2.4;
            en.z += ((en.z - sim.pz) / d) * 2.4;
          }
        }
        return;
      }

      if (targets.length === 0) return;

      // Face primary target & trigger lively cast bounce!
      f.facingLeft = targets[0].x < f.x;
      f.castAnim = 0.24;
      f.casts += 1;

      if (skillId === 'thunderbolt') {
        const count = Math.min(targets.length, f.level + (tac.castMode === 'charged' ? 2 : 1));
        for (let i = 0; i < count; i++) {
          const t = targets[i];
          spawnLightningBolt3D(t.x, t.y, t.z, meta.hex);
          damageEnemy3D(t, dmg, meta.color, f.id);
        }
        sound.play('thunder');
      } else if (skillId === 'water_pulse') {
        const rad = (5.4 + f.level * 0.85) * (tac.castMode === 'charged' ? 1.25 : 1.0);
        spawnGroundDecalWave(f.x, f.y, f.z, vfxAtlas.waterWaveDecal, rad, 0.46);
        spawnGroundDecalWave(f.x, f.y + 0.08, f.z, vfxAtlas.waterWaveDecal, rad * 0.72, 0.34);
        spawnGlowFlash(f.x, f.y, f.z, 0x339af0, rad * 0.68, 0.38);
        spawnPixelParticles(f.x, f.y, f.z, vfxAtlas.waterDrop, 10, 6.2, 0.82, 4.8, 12.5);
        for (const en of sim.enemies) {
          const d = Math.hypot(en.x - f.x, en.z - f.z);
          if (d < rad && en.hp > 0) {
            damageEnemy3D(en, dmg, meta.color, f.id);
            if (!en.isBoss && d > 0.1) {
              en.x += ((en.x - f.x) / d) * 2.6;
              en.z += ((en.z - f.z) / d) * 2.6;
            }
          }
        }
        sound.play('water');
      } else if (skillId === 'shadow_star') {
        const rays = 4 + f.level * 2;
        const sc = tac.castMode === 'charged' ? 1.85 : 1.45;
        spawnGroundDecalWave(f.x, f.y, f.z, vfxAtlas.arcaneRingDecal, 2.3, 0.32);
        for (let i = 0; i < rays; i++) {
          const a = (i * Math.PI * 2) / rays + sim.elapsed;
          spawnSkillProjectile3D({
            x: f.x,
            y: f.y + 1.05,
            z: f.z,
            vx: Math.cos(a) * 14.2,
            vz: Math.sin(a) * 14.2,
            dmg,
            radius: tac.castMode === 'charged' ? 0.72 : 0.56,
            pierce: 3,
            life: 1.25,
            colorHex: meta.hex,
            scale: sc,
            frames: vfxAtlas.shadowStar,
            ownerId: f.id,
            skillId: 'shadow_star',
          });
        }
        sound.play('water');
      } else if (skillId === 'earthquake') {
        const rad = (6.0 + f.level * 0.9) * (tac.castMode === 'charged' ? 1.25 : 1.0);
        spawnGroundDecalWave(f.x, f.y, f.z, vfxAtlas.waterWaveDecal, rad, 0.5);
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, rad * 0.65, 0.4);
        spawnPixelParticles(f.x, f.y + 0.3, f.z, vfxAtlas.electricSpark, 12, 6.8, 0.72, 5.2, 13.5);
        for (const en of sim.enemies) {
          const d = Math.hypot(en.x - f.x, en.z - f.z);
          if (d < rad && en.hp > 0) {
            damageEnemy3D(en, dmg, meta.color, f.id);
            if (!en.isBoss && d > 0.1) {
              en.x += ((en.x - f.x) / d) * 3.1;
              en.z += ((en.z - f.z) / d) * 3.1;
            }
          }
        }
        sound.play('hit');
      } else if (skillId === 'sacred_fire') {
        const count = Math.min(targets.length, 1 + Math.floor((f.level + 1) / 2));
        for (let i = 0; i < count; i++) {
          const t = targets[i];
          spawnLightningBolt3D(t.x, t.y, t.z, 0xff6b6b);
          spawnGlowFlash(t.x, t.y, t.z, 0xff922b, 3.6, 0.42);
          spawnPixelParticles(t.x, t.y + 0.6, t.z, vfxAtlas.electricSpark, 10, 5.5, 0.75, 4.8, 9.0);
          for (const en of sim.enemies) {
            if (en.hp > 0 && Math.hypot(en.x - t.x, en.z - t.z) < 3.4) {
              damageEnemy3D(en, en === t ? dmg : Math.round(dmg * 0.62), meta.color, f.id);
            }
          }
        }
        sound.play('fireball');
      } else if (skillId === 'dark_ruin' || skillId === 'psychic_nova') {
        const t = targets[0];
        const baseAng = Math.atan2(t.z - f.z, t.x - f.x);
        const rays = skillId === 'dark_ruin' ? 3 + Math.floor(f.level / 2) : 4 + Math.floor(f.level / 2);
        const spread = skillId === 'dark_ruin' ? 0.24 : 0.2;
        const sc = (skillId === 'dark_ruin' ? 1.9 : 1.65) * (tac.castMode === 'charged' ? 1.25 : 1.0);
        for (let i = 0; i < rays; i++) {
          const offset = (i - (rays - 1) / 2) * spread;
          const a = baseAng + offset;
          spawnSkillProjectile3D({
            x: f.x,
            y: f.y + 1.05,
            z: f.z,
            vx: Math.cos(a) * 16.5,
            vz: Math.sin(a) * 16.5,
            dmg,
            radius: sc * 0.42,
            pierce: 4,
            life: 1.35,
            colorHex: meta.hex,
            scale: sc,
            frames: vfxAtlas.shadowStar,
            ownerId: f.id,
            skillId,
          });
        }
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, 1.8, 0.24);
        sound.play('thunder');
      } else if (skillId === 'moonblast') {
        const t = targets[0];
        const dx = t.x - f.x;
        const dy = t.y - f.y;
        const dz = t.z - f.z;
        const d3 = Math.hypot(dx, dy, dz) || 1;
        spawnSkillProjectile3D({
          x: f.x,
          y: f.y + 1.15,
          z: f.z,
          vx: (dx / d3) * 15.5,
          vy: (dy / d3) * 15.5,
          vz: (dz / d3) * 15.5,
          dmg,
          radius: 1.05,
          pierce: 2,
          life: 1.45,
          colorHex: meta.hex,
          scale: 2.15,
          frames: vfxAtlas.swiftStar,
          ownerId: f.id,
          skillId,
        });
        if (sim.hp < sim.maxHp) {
          sim.hp = Math.min(sim.maxHp, sim.hp + Math.max(2, Math.round(sim.maxHp * 0.025)));
        }
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, 1.7, 0.26);
        sound.play('happy');
      } else {
        const count =
          skillId === 'swift_volley'
            ? Math.min(targets.length, 2 + Math.floor(f.level / 2))
            : Math.min(targets.length, 1 + Math.floor((f.level + 1) / 2));
        const speed =
          skillId === 'swift_volley' || skillId === 'solar_beam'
            ? 21.0
            : skillId === 'ice_beam' || skillId === 'aura_sphere'
              ? 18.0
              : skillId === 'dragon_pulse'
                ? 14.2
                : 16.2;
        const sc =
          (skillId === 'dragon_pulse' || skillId === 'solar_beam'
            ? 2.45
            : skillId === 'aura_sphere' || skillId === 'ice_beam'
              ? 1.95
              : skillId === 'fireball'
                ? 1.7
                : 1.35) * (tac.castMode === 'charged' ? 1.28 : 1.0);
        const frames =
          skillId === 'dragon_pulse' || skillId === 'solar_beam' || skillId === 'ice_beam'
            ? vfxAtlas.dragonPulse
            : skillId === 'fireball'
              ? vfxAtlas.fireball
              : vfxAtlas.swiftStar;
        for (let i = 0; i < count; i++) {
          const t = targets[i];
          const dx = t.x - f.x;
          const dy = t.y - f.y;
          const dz = t.z - f.z;
          const d3 = Math.hypot(dx, dy, dz) || 1;
          spawnSkillProjectile3D({
            x: f.x,
            y: f.y + 1.05,
            z: f.z,
            vx: (dx / d3) * speed,
            vy: (dy / d3) * speed,
            vz: (dz / d3) * speed,
            dmg,
            radius: sc * 0.42,
            pierce:
              skillId === 'dragon_pulse' || skillId === 'solar_beam' || skillId === 'ice_beam'
                ? 5
                : f.level >= 3
                  ? 2
                  : 1,
            life: 1.45,
            colorHex: meta.hex,
            scale: sc,
            frames,
            ownerId: f.id,
            skillId,
          });
        }
        spawnGlowFlash(f.x, f.y, f.z, meta.hex, 1.4, 0.2);
        sound.play(skillId === 'ice_beam' ? 'water' : 'fireball');
      }
    };

    const spawnEnemy3D = (
      x: number,
      z: number,
      rawSpecies: SpeciesId,
      hp: number,
      speed: number,
      dmg: number,
      opts?: { isBoss?: boolean; isTrainer?: boolean; trainerSprite?: string; trainerName?: string; isAquatic?: boolean },
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      const isBoss = Boolean(opts?.isBoss);
      const isTrainer = Boolean(opts?.isTrainer);
      const isAquatic = Boolean(opts?.isAquatic);
      let species: SpeciesId = rawSpecies;
      if (!isBoss && !isTrainer && !isAquatic && adventureStyleRef.current === 'care_world' && Math.random() < 0.62) {
        const ecoPool = getSolarEcologicalSpeciesPool(solarInfoRef.current.phase);
        if (ecoPool.length > 0) {
          species = ecoPool[Math.floor(Math.random() * ecoPool.length)];
        }
      }
      const rawQ: MonsterQuality = isBoss
        ? 'epic'
        : isTrainer
          ? 'elite'
          : rollMonsterQuality(sim.elapsed);
      // Keep Elite/Epic genuinely special & rare!
      const quality: MonsterQuality =
        !isBoss && !isTrainer && (rawQ === 'elite' || rawQ === 'epic') && Math.random() < 0.55
          ? 'normal'
          : rawQ;
      const isShiny = !isTrainer && Math.random() < (isBoss ? 0.06 : 0.02);
      const cityRegionalSkin =
        !isTrainer && !isShiny && activeWorldRun
          ? (liveOverlandCityRef.current?.regionalSkinId ?? activeWorldRun.regionalSkinId)
          : undefined;
      const regionalSkin: PetSkinId | undefined =
        cityRegionalSkin && Math.random() < (isBoss ? 0.5 : 0.3) ? cityRegionalSkin : undefined;
      const regionalSkinDef = regionalSkin ? getSkinDef(regionalSkin) : undefined;
      const docileSpecies = new Set<SpeciesId>(['munchlax', 'jigglypuff', 'mew', 'psyduck', 'eevee']);
      const territorialSpecies = new Set<SpeciesId>(['bulbasaur', 'squirtle', 'pikachu', 'meowth']);
      const temperament: 'docile' | 'territorial' | 'aggressive' =
        isBoss || isTrainer
          ? 'aggressive'
          : docileSpecies.has(species)
            ? 'docile'
            : territorialSpecies.has(species)
              ? 'territorial'
              : 'aggressive';
      const qMeta = MONSTER_QUALITY_META[quality];
      const stage: 'baby' | 'teen' | 'adult' = isBoss
        ? 'adult'
        : quality === 'epic'
          ? 'adult'
          : quality === 'elite'
            ? 'teen'
            : 'baby';
      const stageAsset = SPECIES_CATALOG[species].stageSprites[stage];
      const url = isTrainer ? opts!.trainerSprite! : stageAsset.static;
      const animGif = isTrainer ? undefined : stageAsset.animated;
      const worldScale = isTrainer
        ? 2.35
        : getPokemonWorldScale3D(species, stage, qMeta.scaleMult * (isBoss ? 1.2 : 1.0));
      const { sprite, shadow, animSheet, backAnimSheet, pmdSheet } = createSpriteEntity(
        url,
        worldScale,
        animGif,
        isShiny,
      );
      if (regionalSkinDef && regionalSkinDef.id !== 'classic') {
        (sprite.material as THREE.MeshBasicMaterial).color.setHex(regionalSkinDef.tintHex3D);
      }
      const gy = getTerrainHeight3D(x, z);
      sprite.position.set(x, gy - 0.04, z);
      sprite.rotation.set(-camOrbitRef.current.pitch * BILLBOARD_PITCH_TILT, camOrbitRef.current.yaw, 0);
      shadow.position.set(x, gy + 0.06, z);
      scene.add(sprite, shadow);

      let auraRing: THREE.Mesh | undefined;
      if (!isTrainer && (quality !== 'normal' || isShiny || isBoss || Boolean(regionalSkinDef))) {
        const ringColor = isShiny
          ? 0xffe066
          : regionalSkinDef
            ? regionalSkinDef.tintHex3D
            : qMeta.hex;
        auraRing = new THREE.Mesh(
          new THREE.RingGeometry(worldScale * 0.34, worldScale * 0.48, 22),
          new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: isShiny || isBoss ? 0.78 : regionalSkinDef ? 0.68 : 0.56,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        auraRing.rotation.x = -Math.PI / 2;
        auraRing.position.set(x, gy + 0.09, z);
        scene.add(auraRing);
      }

      const finalHp = Math.round(hp * (isBoss || isTrainer ? 1 : qMeta.hpMult) * (isShiny ? 1.25 : 1));
      const finalDmg = Math.round(dmg * (isBoss || isTrainer ? 1 : qMeta.dmgMult));
      if (isShiny && !isBoss) {
        sound.play('levelup');
        showBanner(
          `✨ 发现【★异色】${SPECIES_CATALOG[species].stageNames[stage] ?? SPECIES_CATALOG[species].defaultName}！削弱或击败后可靠近投球收服！`,
          3400,
        );
      }
      sim.enemies.push({
        id: sim.nextId++,
        x,
        y: gy,
        z,
        hp: finalHp,
        maxHp: finalHp,
        speed,
        radius: Math.max(0.82, worldScale * 0.38),
        species,
        stage,
        worldScale,
        quality,
        isShiny,
        regionalSkin,
        isBoss,
        isTrainer,
        trainerSprite: opts?.trainerSprite,
        trainerName: opts?.trainerName,
        shootCd: 1.8,
        hitFlash: 0,
        dmg: finalDmg,
        hopPhase: Math.random() * 6,
        animTime: Math.random() * 2,
        animSheet,
        backAnimSheet,
        pmdSheet,
        sprite,
        shadow,
        auraRing,
        shinyTimer: 0.35,
        temperament,
        aggroed: isBoss || isTrainer,
        homeX: x,
        homeZ: z,
        isAquatic,
        waterJumpTimer: isAquatic ? 1.2 + Math.random() * 2.5 : undefined,
      });
    };

    // Launch real-time 3D Cinematic Poké Ball Capture Animation (Arc -> Crimson Absorb -> 3 Wobbles -> Starburst!)
    const startCaptureAnim3D = (target: Enemy3D) => {
      const sim = simRef.current;
      if (!sim || target.beingCaptured) return;
      if (savePetsCountRef.current >= MAX_PET_SLOTS) {
        sound.play('error');
        showBanner(
          `📦 精灵球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})，无法继续捕捉！请先放生多余精灵，或结束本局战斗后寄存到大木博士处！`,
          4000,
        );
        return;
      }
      target.beingCaptured = true;
      const ballUrl = target.isBoss
        ? '/sprites/items/master-ball.png'
        : target.isShiny || target.quality === 'epic'
          ? '/sprites/items/ultra-ball.png'
          : target.quality === 'elite'
            ? '/sprites/items/great-ball.png'
            : '/sprites/items/poke-ball.png';
      const ballSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getPixelTexture(ballUrl),
          transparent: true,
          alphaTest: 0.1,
        }),
      );
      ballSprite.scale.set(1.2, 1.2, 1);
      ballSprite.position.set(sim.px, sim.py + 1.6, sim.pz);
      const ballShadow = new THREE.Mesh(UNIT_SHADOW_GEO, SHARED_ENTITY_SHADOW_MAT);
      ballShadow.rotation.x = -Math.PI / 2;
      ballShadow.scale.setScalar(0.45);
      ballShadow.position.set(sim.px, sim.py + 0.06, sim.pz);
      scene.add(ballSprite, ballShadow);

      const hpFrac = Math.max(0, target.hp) / Math.max(1, target.maxHp);
      const catchBonus = metaBonusesRef.current.catchRateBonus;
      const willCatch =
        Boolean(target.knockedOut) ||
        Math.random() < Math.min(0.98, 0.92 - hpFrac * 0.48 + catchBonus);
      const phys = getPokemonPhysicalMetrics(target.species, target.stage);
      const spMeta = SPECIES_CATALOG[target.species];
      const spName = spMeta.stageNames[target.stage] ?? spMeta.defaultName;
      const catchLv = target.isBoss
        ? Math.min(32, pet.level + 4)
        : Math.min(28, Math.max(4, pet.level + (target.quality === 'epic' ? 2 : target.isShiny ? 2 : 0)));
      const isNewSpecies = !save.discoveredSpecies.includes(target.species);

      // REAL 3D CLOSE-UP CINEMATIC CAPTURE (Pauses combat enemies while Three.js camera tracks the real flying 3D Poké Ball -> impact -> 3 wobbles -> Handheld Pokédex Reveal!)
      pausedRef.current = true;
      sound.play('pokeball');
      const gyStart = getTerrainHeight3D(sim.px, sim.pz);
      const gyTarget = getTerrainHeight3D(target.x, target.z);
      ballSprite.position.set(sim.px, Math.max(sim.py, gyStart) + 1.5, sim.pz);
      ballSprite.scale.set(1.35, 1.35, 1);
      sim.activeCaptures = [
        {
          id: sim.nextId++,
          enemy: target,
          startX: sim.px,
          startY: Math.max(sim.py, gyStart) + 1.55,
          startZ: sim.pz,
          targetX: target.x,
          targetY: Math.max(target.y, gyTarget) + Math.min(1.5, target.worldScale * 0.45),
          targetZ: target.z,
          t: 0,
          willCatch,
          wobbleClicks: 0,
          absorbed: false,
          resolved: false,
          ballSprite,
          ballShadow,
        },
      ];
      setCaptureCutscene({
        species: target.species,
        name: spName,
        sprite: spMeta.stageSprites[target.stage].animated,
        ballSprite: ballUrl,
        level: catchLv,
        isShiny: target.isShiny,
        isNewSpecies,
        dexNo: spMeta.dexNo,
        typeLabel: spMeta.typeLabel,
        typeColor: spMeta.typeColor,
        lore: spMeta.description,
        quality: target.quality,
        heightM: phys.heightM,
        weightKg: phys.weightKg,
        phase: 'throw',
        wobbleCount: 0,
      });

      const finishCaptureModal = () => {
        for (const c of sim.activeCaptures) {
          scene.remove(c.ballSprite, c.ballShadow);
        }
        sim.activeCaptures = [];
        setCaptureCutscene(null);
        captureFinishRef.current = null;
        if (willCatch && target.isBoss && gameMode === 'story' && !endedRef.current) {
          sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
          endedRef.current = true;
          pausedRef.current = true;
          setResultSummary(buildResultSummary(true, sim.capturedBoss));
        } else {
          pausedRef.current = false;
        }
      };
      captureFinishRef.current = finishCaptureModal;
    };

    // Wire Active Combat Commands (Throw Ball / Heal Potion / Boost Candy / Team Salvo / Proximity Capture!)
    triggerBattleActionRef.current = (kind, enemyId) => {
      const sim = simRef.current;
      if (!sim || pausedRef.current || endedRef.current) return;

      if (kind === 'dismiss_ko') {
        const idx = sim.enemies.findIndex((e) => e.id === enemyId && e.knockedOut);
        if (idx !== -1) {
          const en = sim.enemies[idx];
          if (en.sprite) scene.remove(en.sprite);
          if (en.shadow) scene.remove(en.shadow);
          if (en.auraRing) scene.remove(en.auraRing);
          sim.enemies.splice(idx, 1);
          setNearbyKoTarget(null);
          sound.play('cancel');
          if (en.isBoss && gameMode === 'story') {
            sim.coins += Math.round(regionMeta.rewardCoins * diffMeta.rewardMult);
            endedRef.current = true;
            pausedRef.current = true;
            setResultSummary(buildResultSummary(true, sim.capturedBoss));
          }
        }
        return;
      }

      if (kind === 'capture_ko') {
        if (savePetsCountRef.current >= MAX_PET_SLOTS) {
          sound.play('error');
          showBanner(
            `📦 精灵球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})，无法捕捉！请先放生精灵，或结束战斗后再寄存！`,
            4000,
          );
          return;
        }
        const en = sim.enemies.find((e) => e.id === enemyId && e.knockedOut && !e.beingCaptured);
        if (en) {
          setNearbyKoTarget(null);
          startCaptureAnim3D(en);
        }
        return;
      }

      if (kind === 'ball') {
        if (savePetsCountRef.current >= MAX_PET_SLOTS) {
          sound.play('error');
          showBanner(
            `📦 精灵球盒已满 (${MAX_PET_SLOTS}/${MAX_PET_SLOTS})，无法投球捕捉！请先放生多余精灵，或结束战斗后寄存！`,
            4000,
          );
          return;
        }
        if (sim.actionCds.ball > 0) {
          sound.play('error');
          return;
        }
        // Prioritize knocked-out Pokémon first, then Shiny/Epic/Elite/weakened wild Pokémon within 18m!
        const ko = sim.enemies
          .filter((e) => e.knockedOut && !e.beingCaptured && Math.hypot(e.x - sim.px, e.z - sim.pz) < 16)
          .sort((a, b) => Math.hypot(a.x - sim.px, a.z - sim.pz) - Math.hypot(b.x - sim.px, b.z - sim.pz))[0];
        const liveWild = sim.enemies
          .filter((e) => !e.isTrainer && !e.isBoss && !e.knockedOut && !e.beingCaptured && e.hp > 0 && Math.hypot(e.x - sim.px, e.z - sim.pz) < 18)
          .sort((a, b) => {
            const score = (e: Enemy3D) =>
              (e.isShiny ? 200 : 0) +
              (e.quality === 'epic' ? 120 : e.quality === 'elite' ? 80 : e.quality === 'uncommon' ? 30 : 0) +
              (1 - e.hp / Math.max(1, e.maxHp)) * 90 -
              Math.hypot(e.x - sim.px, e.z - sim.pz) * 2;
            return score(b) - score(a);
          })[0];
        const chosen = ko ?? liveWild;
        if (!chosen) {
          sound.play('error');
          showBanner('附近没有可投球捕捉的野生宝可梦！', 1800);
          return;
        }
        sim.actionCds.ball = ko ? 2.5 : 5.5;
        setNearbyKoTarget(null);
        startCaptureAnim3D(chosen);
        return;
      }

      if (kind === 'heal') {
        if (sim.actionCds.heal > 0 || sim.healCharges <= 0) {
          sound.play('error');
          return;
        }
        sim.healCharges -= 1;
        sim.actionCds.heal = 10;
        const healAmt = Math.round(sim.maxHp * 0.45);
        sim.hp = Math.min(sim.maxHp, sim.hp + healAmt);
        sound.play('heal_jingle');
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.healCircleDecal, 5.2, 0.55);
        spawnGlowFlash(sim.px, sim.py, sim.pz, 0x51cf66, 4.2, 0.42);
        spawnPixelParticles(sim.px, sim.py + 0.5, sim.pz, vfxAtlas.healPlus, 10, 3.2, 0.82, 5.2, 4.2);
        sim.dmgPops.push({
          id: sim.nextId++,
          wx: sim.px,
          wy: sim.py + 2.7,
          wz: sim.pz,
          text: `+${healAmt} HP`,
          color: '#69db7c',
          life: 0.78,
        });
        showBanner(`使用好伤药！全队恢复 +${healAmt} HP（剩余 ${sim.healCharges} 瓶）`, 2000);
        return;
      }

      if (kind === 'boost') {
        if (sim.actionCds.boost > 0) {
          sound.play('error');
          return;
        }
        sim.actionCds.boost = 20;
        sim.boostTimer = 8.0;
        sound.play('levelup');
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.electricRingDecal, 5.6, 0.52);
        spawnGlowFlash(sim.px, sim.py, sim.pz, 0xffd43b, 4.6, 0.46);
        spawnPixelParticles(sim.px, sim.py + 0.8, sim.pz, vfxAtlas.starGlint, 12, 5.4, 0.88, 5.0, 6.0);
        showBanner('力量强化激活！8秒内全队攻击 +55%、技能充能大幅加速！', 2600);
        return;
      }

      if (kind === 'salvo') {
        if (sim.actionCds.salvo > 0) {
          sound.play('error');
          return;
        }
        sim.actionCds.salvo = 14;
        sim.boostTimer = Math.max(sim.boostTimer, 10.0); // Triggers 10s Mega / Gigantamax Surge!
        sound.play('levelup');
        spawnGroundDecalWave(sim.px, sim.py, sim.pz, vfxAtlas.arcaneRingDecal, 6.8, 0.56);
        spawnPixelParticles(sim.px, sim.py + 1.0, sim.pz, vfxAtlas.starGlint, 16, 6.4, 0.9, 5.2, 8.0);
        for (const f of sim.followers) {
          f.cds = f.cds.map(() => 0);
          fireSkill(f, f.skills[0], true);
          if (f.sprite) {
            const megaSc = getPokemonWorldScale3D(f.species, f.stage) * 1.38;
            f.sprite.scale.set(megaSc, megaSc, 1);
          }
        }
        showBanner('✨ 超进化 / 极巨齐射爆发！全队进入 10 秒巨化高能形态并释放招牌绝招！', 2800);
      }
    };

  return { vfxAtlas, spawnLoot3D, spawnPixelParticles, spawnGroundDecalWave, spawnGlowFlash, spawnSpriteBurst, spawnLightningBolt3D, spawnSkillProjectile3D, damageEnemy3D, pickTargetForFollower, fireSkill, spawnEnemy3D, startCaptureAnim3D };
}
