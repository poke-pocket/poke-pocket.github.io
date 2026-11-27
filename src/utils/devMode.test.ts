import { describe, expect, it } from 'vitest';
import { ACCESSORY_CATALOG, FOOD_CATALOG, POKEDEX_ORDER, ROOM_CATALOG } from '../data/catalog';
import { GYM_BADGE_CATALOG, HERO_ROSTER, LAB_UPGRADES } from '../data/metaProgression';
import {
  DEV_GRANT_FILL_COUNT,
  DEV_INFINITE_CURRENCY_DISPLAY,
  applyDevGrantsOverlay,
  isDevVirtualPetId,
  sanitizeRealSaveAfterDevRollback,
  type DevGrantsState,
} from './devMode';
import { adoptPet, captureBossPet, createInitialSave } from './petEngine';

const ALL_OFF: DevGrantsState = {
  allPets: false,
  allPokedex: false,
  allItems: false,
  allPokeballs: false,
  allLabUpgrades: false,
  allBadges: false,
  infiniteStardust: false,
  infiniteCoins: false,
  mapTeleport: false,
};

describe('devMode reversible grants & rollback safety', () => {
  it('unlocks all Pokédex entries as a temporary condition and keeps naturally caught species on rollback', () => {
    const base = adoptPet(createInitialSave(), 'pikachu', '皮卡丘').save;
    expect(base.discoveredSpecies).toEqual(['pikachu']);

    const withAllDex = applyDevGrantsOverlay(base, true, { ...ALL_OFF, allPokedex: true });
    expect(withAllDex.discoveredSpecies.length).toBe(POKEDEX_ORDER.length);
    expect(withAllDex.discoveredSpecies).toContain('mew');

    // Player legitimately catches Eevee while debug Pokédex unlock is active
    const afterRealCatch = captureBossPet(base, 'eevee', 10).save;
    expect(afterRealCatch.discoveredSpecies).toContain('eevee');

    // Turning OFF allPokedex restores exact real discovered species (keeping both Pikachu & newly caught Eevee!)
    const afterOff = applyDevGrantsOverlay(afterRealCatch, true, ALL_OFF);
    expect(afterOff.discoveredSpecies).toEqual(['pikachu', 'eevee']);
    expect(afterOff.discoveredSpecies).not.toContain('mew');
  });

  it('fills items and Poké Balls to 99 without capping stocks above 99, and rolls back cleanly', () => {
    const base = adoptPet(createInitialSave(), 'pikachu', '皮卡丘').save;
    base.inventory.sitrus_berry = 135;
    base.ballStock.ultraball_room = 120;

    const granted = applyDevGrantsOverlay(base, true, {
      ...ALL_OFF,
      allItems: true,
      allPokeballs: true,
    });
    for (const f of FOOD_CATALOG) {
      expect(granted.inventory[f.id]).toBeGreaterThanOrEqual(DEV_GRANT_FILL_COUNT);
    }
    expect(granted.inventory.sitrus_berry).toBe(135);
    for (const a of ACCESSORY_CATALOG) {
      if (a.id !== 'none') {
        expect(granted.accessoryStock[a.id]).toBeGreaterThanOrEqual(DEV_GRANT_FILL_COUNT);
      }
    }
    for (const rm of ROOM_CATALOG) {
      if (rm.id !== 'pokeball_room') {
        expect(granted.ballStock[rm.id]).toBeGreaterThanOrEqual(DEV_GRANT_FILL_COUNT);
      }
    }
    expect(granted.ballStock.ultraball_room).toBe(120);

    // Turning OFF reverts to real save
    const reverted = applyDevGrantsOverlay(base, true, ALL_OFF);
    expect(reverted.ballStock.masterball_room ?? 0).toBe(0);
    expect(reverted.inventory.sitrus_berry).toBe(135);
  });

  it('grants all species with virtual IDs and sanitizes virtual squad/gear/ball references on rollback', () => {
    const base = adoptPet(createInitialSave(), 'pikachu', '皮卡丘').save;
    const withAllPets = applyDevGrantsOverlay(base, true, { ...ALL_OFF, allPets: true });
    expect(withAllPets.pets.length).toBe(POKEDEX_ORDER.length);
    const virtualMew = withAllPets.pets.find((p) => p.species === 'mew');
    expect(virtualMew).toBeDefined();
    expect(isDevVirtualPetId(virtualMew?.id)).toBe(true);

    const sampleAcc = ACCESSORY_CATALOG.find((a) => a.id !== 'none')!.id;
    // Simulate equipping a debug-only accessory/ball on real Pikachu and adding virtual Mew to squad preset
    const pollutedReal = {
      ...base,
      pets: base.pets.map((p) => ({
        ...p,
        accessory: sampleAcc,
        ballRoom: 'masterball_room' as const,
      })),
      meta: {
        ...base.meta!,
        squadPresets: [
          { id: 'sq_1', name: '队伍 1', petIds: [base.pets[0].id, virtualMew!.id] },
        ],
      },
    };

    const sanitized = sanitizeRealSaveAfterDevRollback(pollutedReal, ALL_OFF, true);
    expect(sanitized.pets[0].accessory).toBe('none');
    expect(sanitized.pets[0].ballRoom).toBe('pokeball_room');
    expect(sanitized.meta?.squadPresets?.[0].petIds).toEqual([base.pets[0].id]);
  });

  it('supports reversible allLabUpgrades, allBadges, infiniteStardust, infiniteCoins and activeHero rollback', () => {
    const base = adoptPet(createInitialSave(), 'pikachu', '皮卡丘').save;
    base.coins = 250;
    base.meta = {
      ...base.meta!,
      stardust: 80,
      unlockedBadges: ['boulder_badge'],
      unlockedHeroes: ['red'],
      activeHero: 'red',
    };

    const granted = applyDevGrantsOverlay(base, true, {
      ...ALL_OFF,
      allLabUpgrades: true,
      allBadges: true,
      infiniteStardust: true,
      infiniteCoins: true,
    });

    expect(granted.coins).toBe(DEV_INFINITE_CURRENCY_DISPLAY);
    expect(granted.meta?.stardust).toBe(DEV_INFINITE_CURRENCY_DISPLAY);
    expect(granted.meta?.unlockedBadges?.length).toBe(GYM_BADGE_CATALOG.length);
    expect(granted.meta?.unlockedHeroes).toEqual(HERO_ROSTER.map((h) => h.id));
    for (const u of LAB_UPGRADES) {
      expect(granted.meta?.labLevels[u.id]).toBe(u.maxLevel);
    }
    for (const h of HERO_ROSTER) {
      for (const sk of h.skills) {
        expect(granted.meta?.heroSkillLevels[sk.id]).toBe(sk.maxLevel);
      }
    }

    // Turning OFF restores exact real balances & earned badges
    const reverted = applyDevGrantsOverlay(base, true, ALL_OFF);
    expect(reverted.coins).toBe(250);
    expect(reverted.meta?.stardust).toBe(80);
    expect(reverted.meta?.unlockedBadges).toEqual(['boulder_badge']);

    // If user switched to a debug-unlocked hero while allLabUpgrades was ON, rollback resets activeHero
    const pollutedHeroSave = {
      ...base,
      meta: {
        ...base.meta!,
        activeHero: 'blue' as const,
      },
    };
    const sanitized = sanitizeRealSaveAfterDevRollback(pollutedHeroSave, ALL_OFF, true);
    expect(sanitized.meta?.activeHero).toBe('red');
  });
});
