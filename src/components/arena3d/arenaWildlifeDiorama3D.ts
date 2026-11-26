import type { ArenaSharedCtx } from './arenaTypesAndProps';
import * as THREE from 'three';
import { SPECIES_CATALOG, getPokemonWorldScale3D } from '../../data/catalog';
import { LAKE_BASINS_3D, WATER_LEVEL_3D, getTerrainHeight3D } from '../../data/survivorsTactics';
import { getPixelEmoteTexture, type AnimatedSpriteSheet3D } from '../../data/worldTextures3D';
import { type Pmd8DirSheet3D } from '../../data/pmdSprites3D';
import { type SpeciesId } from '../../types/pet';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function setupHubWildlifeDiorama3D(rawCtx: Record<string, any>) {
  const { createSpriteEntity, phase, regionMeta, scene } = rawCtx as ArenaSharedCtx;
    // 6. Living Kanto Wildlife Diorama (Hub / Map Select):
    //    - Majestic linear sky flybys (HUGE Charizard & Dragonite crossing the horizon — NO overhead circling!)
    //    - Wild Pokémon strolling along the actual dirt roads
    //    - Magikarp & HUGE Gyarados leaping out of organic lakes + Lapras swimming smoothly
    //    - Diglett & Dugtrio popping up from the soil and burrowing back down!
    const previewSprites: {
      sprite: THREE.Mesh;
      shadow: THREE.Mesh;
      animSheet?: AnimatedSpriteSheet3D;
      pmdSheet?: Pmd8DirSheet3D;
      kind: 'flyby' | 'road_stroll' | 'water_leap' | 'water_swim' | 'burrow' | 'meadow_graze';
      baseX: number;
      baseZ: number;
      phase: number;
      scale: number;
      dirX?: number;
      dirZ?: number;
      span?: number;
      speed?: number;
      altitude?: number;
      jumpH?: number;
    }[] = [];
    // Floating 3D Pixel Emote Bubble for living Hub protagonist & companions!
    const emoteKinds: ('heart' | 'music' | 'sparkle' | 'exclaim')[] = ['heart', 'music', 'sparkle', 'exclaim'];
    const heroEmoteSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getPixelEmoteTexture('heart'),
        transparent: true,
        alphaTest: 0.1,
      }),
    );
    heroEmoteSprite.scale.set(1.35, 1.2, 1);
    heroEmoteSprite.visible = false;
    scene.add(heroEmoteSprite);

    const petEmoteSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getPixelEmoteTexture('music'),
        transparent: true,
        alphaTest: 0.1,
      }),
    );
    petEmoteSprite.scale.set(1.2, 1.08, 1);
    petEmoteSprite.visible = false;
    scene.add(petEmoteSprite);

    if (phase !== 'playing') {
      const showcaseSpecies = regionMeta.wildPool;

      // A. 8 Wild Pokémon strolling naturally along the real North-South & East-West dirt roads!
      for (let i = 0; i < 8; i++) {
        const sp = showcaseSpecies[i % showcaseSpecies.length];
        const stg: 'baby' | 'teen' | 'adult' = i % 4 === 0 ? 'adult' : i % 2 === 0 ? 'teen' : 'baby';
        const asset = SPECIES_CATALOG[sp].stageSprites[stg];
        const sc = getPokemonWorldScale3D(sp, stg) * 0.92;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(asset.static, sc, asset.animated);
        const onEastWest = i % 2 === 0;
        const laneOffset = (i % 4 < 2 ? -1.9 : 1.9);
        const bx = onEastWest ? 0 : laneOffset;
        const bz = onEastWest ? laneOffset : 0;
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'road_stroll',
          baseX: bx,
          baseZ: bz,
          dirX: onEastWest ? 1 : 0,
          dirZ: onEastWest ? 0 : 1,
          span: 24 + (i % 3) * 8,
          speed: 0.11 + (i % 3) * 0.03,
          phase: i * 1.15,
          scale: sc,
        });
      }

      // B. 6 Peaceful Meadow-Grazing Wild Pokémon on dry sunlit rolling slopes
      for (let i = 0; i < 6; i++) {
        const sp = showcaseSpecies[(i + 3) % showcaseSpecies.length];
        const ang = (i * Math.PI * 2) / 6 + 0.45;
        const rad = 8.5 + (i % 3) * 4.5;
        const bx = Math.cos(ang) * rad;
        const bz = Math.sin(ang) * rad;
        if (getTerrainHeight3D(bx, bz) < WATER_LEVEL_3D + 0.25) continue;
        const stg: 'baby' | 'teen' | 'adult' = i % 3 === 0 ? 'teen' : 'baby';
        const asset = SPECIES_CATALOG[sp].stageSprites[stg];
        const sc = getPokemonWorldScale3D(sp, stg) * 0.9;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(asset.static, sc, asset.animated);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'meadow_graze',
          baseX: bx,
          baseZ: bz,
          phase: i * 1.4,
          scale: sc,
        });
      }

      // C. 5 Burrowing Diglett (#50) & Dugtrio (#51) popping up from the ground & ducking back down!
      const burrowSpots: { x: number; z: number; dex: '50' | '51'; sc: number }[] = [
        { x: -6.5, z: -5.2, dex: '50', sc: 1.65 },
        { x: 7.4, z: -6.8, dex: '51', sc: 2.25 },
        { x: -9.8, z: 6.4, dex: '50', sc: 1.65 },
        { x: 9.2, z: 5.5, dex: '50', sc: 1.65 },
        { x: -4.2, z: -13.5, dex: '51', sc: 2.25 },
      ];
      burrowSpots.forEach((bs, bi) => {
        if (getTerrainHeight3D(bs.x, bs.z) < WATER_LEVEL_3D + 0.3) return;
        const url = `/sprites/pokemon/${bs.dex}.png`;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(url, bs.sc);
        shadow.scale.setScalar(bs.sc * 0.42);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'burrow',
          baseX: bs.x,
          baseZ: bs.z,
          phase: bi * 1.7,
          scale: bs.sc,
        });
      });

      // D. Aquatic Wildlife Leaping & Swimming in Real Organic Lakes (Magikarp #129, HUGE Gyarados #130, Lapras #131)!
      const lakeWaterSpots: { x: number; z: number }[] = [];
      for (const lk of LAKE_BASINS_3D) {
        if (getTerrainHeight3D(lk.cx, lk.cz) < WATER_LEVEL_3D - 0.25) {
          lakeWaterSpots.push({ x: lk.cx, z: lk.cz });
        }
      }
      // Also scan near-horizon organic lakes within 55m so leaping water Pokémon are clearly visible!
      for (let gz = -48; gz <= 48; gz += 6) {
        for (let gx = -48; gx <= 48; gx += 6) {
          if (getTerrainHeight3D(gx, gz) < WATER_LEVEL_3D - 0.35) {
            if (lakeWaterSpots.every((s) => Math.hypot(s.x - gx, s.z - gz) > 10)) {
              lakeWaterSpots.push({ x: gx, z: gz });
            }
          }
        }
      }
      lakeWaterSpots.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
      const aquaSpecs: { dex: '129' | '130' | '131'; kind: 'water_leap' | 'water_swim'; sc: number; jumpH: number }[] = [
        { dex: '129', kind: 'water_leap', sc: 2.25, jumpH: 3.4 }, // Magikarp leaping high!
        { dex: '130', kind: 'water_leap', sc: 5.5, jumpH: 4.4 },  // HUGE Gyarados breaching!
        { dex: '131', kind: 'water_swim', sc: 3.8, jumpH: 0 },    // Lapras gliding on the water!
        { dex: '129', kind: 'water_leap', sc: 2.1, jumpH: 3.1 },  // 2nd Magikarp splashing!
      ];
      aquaSpecs.forEach((aq, ai) => {
        const spot = lakeWaterSpots[ai % Math.max(1, lakeWaterSpots.length)];
        if (!spot) return;
        const url = `/sprites/pokemon/${aq.dex}.png`;
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(url, aq.sc);
        shadow.scale.setScalar(aq.sc * 0.35);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: aq.kind,
          baseX: spot.x,
          baseZ: spot.z,
          phase: ai * 2.1,
          scale: aq.sc,
          jumpH: aq.jumpH,
        });
      });

      // E. Majestic Straight-Line Sky Flybys (HUGE Charizard & HUGE Dragonite crossing the horizon — NO overhead circling!)
      const flybyPool: {
        sp: SpeciesId;
        stg: 'baby' | 'teen' | 'adult';
        sc: number;
        laneZ: number;
        dirX: number;
        dirZ: number;
        alt: number;
        spd: number;
      }[] = [
        { sp: 'charmander', stg: 'adult', sc: 5.1, laneZ: -20, dirX: 0.96, dirZ: 0.28, alt: 10.5, spd: 5.8 }, // Giant Charizard flying East-Southeast across horizon!
        { sp: 'dratini', stg: 'adult', sc: 5.6, laneZ: -30, dirX: -0.94, dirZ: 0.34, alt: 13.0, spd: 6.4 },   // Giant Dragonite sweeping West across mountain ridge!
        { sp: 'mew', stg: 'baby', sc: 2.3, laneZ: -12, dirX: 0.88, dirZ: -0.47, alt: 8.2, spd: 4.9 },         // Playful Mew gliding diagonally across the valley!
      ];
      flybyPool.forEach((fl, fi) => {
        const asset = SPECIES_CATALOG[fl.sp].stageSprites[fl.stg];
        const { sprite, shadow, animSheet, pmdSheet } = createSpriteEntity(asset.static, fl.sc, asset.animated);
        shadow.scale.setScalar(fl.sc * 0.28);
        scene.add(sprite, shadow);
        previewSprites.push({
          sprite,
          shadow,
          animSheet,
          pmdSheet,
          kind: 'flyby',
          baseX: 0,
          baseZ: fl.laneZ,
          dirX: fl.dirX,
          dirZ: fl.dirZ,
          span: 74,
          speed: fl.spd,
          altitude: fl.alt,
          phase: fi * 11.5,
          scale: fl.sc,
        });
      });
    }

  return { emoteKinds, heroEmoteSprite, petEmoteSprite, previewSprites };
}
