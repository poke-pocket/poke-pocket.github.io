import { describe, expect, it } from 'vitest';
import {
  computeBattleStats,
  getTypeMultiplier,
} from '../data/battleMoves';
import { findTilePath } from '../data/overworldTiles';
import {
  ALL_SURVIVOR_SKILL_IDS,
  STORY_CHAPTERS,
  getDefaultSkillsForElement,
  getNearbySafeZones3D,
  getTerrainHeight3D,
} from '../data/survivorsTactics';
import { getNearbySafeZones } from '../components/VampireSurvivorsArena';
import {
  SPECIES_CATALOG,
  SPECIES_RANDOM_NAMES,
  getGrowthStage,
  getPokemonStageName,
  pickRandomPetName,
} from '../data/catalog';
import {
  adoptPet,
  assignPetBallRoom,
  bathPet,
  buyFood,
  buyOrAssignPetRoom,
  buyOrEquipAccessory,
  buyPokeball,
  captureBossPet,
  createInitialSave,
  feedPet,
  getBallAvailability,
  getPetIVs,
  getPetMood,
  getPetTalent,
  healAllPets,
  patPet,
  pullGachaBox,
  pullGachaTen,
  recordBattleOutcome,
  recordMiniGameResult,
  recordSurvivorsOutcome,
  releasePet,
  spendStaminaForBattle,
  spendStaminaForGame,
  STAMINA_REGEN_MS,
  tickPet,
  tickStamina,
  toggleSleep,
} from './petEngine';

describe('Pokemon pocket engine simulation', () => {
  it('adopts starter at Lv.5, grants achievement coins, and supports Rare Candy & Lum Berry', () => {
    const now = 1_700_000_000_000;
    const init = createInitialSave();
    const adopted = adoptPet(init, 'pikachu', '皮卡丘', now);
    expect(adopted.ok).toBe(true);
    expect(adopted.save.pets).toHaveLength(1);
    expect(adopted.save.pets[0].level).toBe(5);
    expect(adopted.save.coins).toBe(150);
    expect(adopted.save.discoveredSpecies).toContain('pikachu');

    const petId = adopted.save.pets[0].id;
    const fed = feedPet(adopted.save, petId, 'sitrus_berry', now + 1000);
    expect(fed.ok).toBe(true);
    expect(fed.save.inventory.sitrus_berry).toBe(1);
    expect(fed.save.pets[0].hunger).toBe(100);
    expect(fed.save.pets[0].xp).toBeGreaterThan(0);

    // Rare Candy always levels up +1 Lv. directly like original Pokemon
    const candyFed = feedPet(fed.save, petId, 'rare_candy', now + 1500);
    expect(candyFed.ok).toBe(true);
    expect(candyFed.save.pets[0].level).toBe(6);

    // Lum Berry cures sick status
    const sickSave = {
      ...candyFed.save,
      pets: [{ ...candyFed.save.pets[0], isSick: true, health: 40 }],
    };
    const healed = feedPet(sickSave, petId, 'lum_berry', now + 2000);
    expect(healed.ok).toBe(true);
    expect(healed.save.pets[0].isSick).toBe(false);
    expect(healed.save.pets[0].health).toBe(62);
  });

  it('supports gacha blind box single/ten pulls and stock-limited Pokeball assignment', () => {
    const now = 1_700_000_000_000;
    let save = adoptPet(createInitialSave(), 'charmander', '小火龙', now).save;
    save = { ...save, coins: 2000 };
    const charId = save.pets[0].id;

    // Cannot assign unowned masterball directly
    const failAssign = assignPetBallRoom(save, charId, 'masterball_room', now + 20);
    expect(failAssign.ok).toBe(false);
    expect(getBallAvailability(save, 'masterball_room').available).toBe(0);

    // Buying 1 greatball allows 1st pet to occupy it, leaving 0 spare
    const bought = buyPokeball(save, 'greatball_room', now + 40);
    expect(bought.ok).toBe(true);
    expect(getBallAvailability(bought.save, 'greatball_room').available).toBe(1);

    const assigned = buyOrAssignPetRoom(bought.save, charId, 'greatball_room', now + 50);
    expect(assigned.ok).toBe(true);
    expect(assigned.save.pets[0].ballRoom).toBe('greatball_room');
    expect(getBallAvailability(assigned.save, 'greatball_room').available).toBe(0);
    save = assigned.save;

    const pull = pullGachaBox(save, 'normal_box', now + 100);
    expect(pull.ok).toBe(true);
    expect(pull.pulledSpecies).toBeDefined();
    expect(pull.save.discoveredSpecies).toContain(pull.pulledSpecies);

    const tenPull = pullGachaTen(pull.save, 'normal_box', now + 200);
    expect(tenPull.ok).toBe(true);
    expect(tenPull.results).toHaveLength(10);
    expect(
      tenPull.results!.some((r) => SPECIES_CATALOG[r.species].rarity !== 'R'),
    ).toBe(true);
  });

  it('follows authentic canonical Pokemon evolution levels per species', () => {
    const now = 1_700_000_000_000;
    let save = adoptPet(createInitialSave(), 'squirtle', '杰尼龟', now).save;
    const petId = save.pets[0].id;

    // Should NOT evolve prematurely at low levels (Lv.5..15)
    expect(getGrowthStage(5, 'squirtle')).toBe('baby');
    expect(getGrowthStage(15, 'squirtle')).toBe('baby');
    expect(getGrowthStage(16, 'squirtle')).toBe('teen');
    expect(getPokemonStageName('squirtle', 16)).toBe('卡咪龟');
    expect(getGrowthStage(36, 'squirtle')).toBe('adult');
    expect(getPokemonStageName('squirtle', 36)).toBe('水箭龟');

    // Dratini pseudo-legendary thresholds
    expect(getGrowthStage(29, 'dratini')).toBe('baby');
    expect(getGrowthStage(30, 'dratini')).toBe('teen');
    expect(getGrowthStage(55, 'dratini')).toBe('adult');

    // Leveling via mini-games + Rare Candy unlocks teen stage at Lv.16
    save = {
      ...save,
      pets: [{ ...save.pets[0], level: 15, xp: 600 }],
    };
    const res = recordMiniGameResult(save, petId, '接树果', 20, true, now + 5000);
    expect(res.save.pets[0].level).toBe(16);
    expect(res.evolvedTo).toBe('卡咪龟');
    expect(res.save.unlockedAchievements).toContain('teen_stage');
  });

  it('recovers energy while sleeping and prevents unfair zero-out on offline gap', () => {
    const now = 1_700_000_000_000;
    const save = adoptPet(createInitialSave(), 'bulbasaur', '妙蛙种子', now).save;
    const sleepingPet = { ...save.pets[0], energy: 30, isSleeping: true };
    const afterNap = tickPet(sleepingPet, now + 5 * 60_000).pet;
    expect(afterNap.energy).toBeGreaterThan(70);

    const awakePet = { ...save.pets[0], isSleeping: false };
    const afterLongBreak = tickPet(awakePet, now + 12 * 3600_000).pet;
    expect(afterLongBreak.hunger).toBeGreaterThanOrEqual(18);
    expect(afterLongBreak.happiness).toBeGreaterThanOrEqual(22);
  });

  it('handles Poke Mart purchases, bathing, patting, and mood derivation', () => {
    const now = 1_700_000_000_000;
    let save = adoptPet(createInitialSave(), 'squirtle', '杰尼龟', now).save;
    const petId = save.pets[0].id;

    const boughtFood = buyFood(save, 'sitrus_berry', 1);
    expect(boughtFood.ok).toBe(true);
    save = boughtFood.save;

    const equipped = buyOrEquipAccessory(save, petId, 'shades', now + 100);
    expect(equipped.ok).toBe(true);
    save = equipped.save;
    expect(save.pets[0].accessory).toBe('shades');

    save = patPet(save, petId, now + 200).save;
    save = bathPet(save, petId, now + 300).save;
    expect(save.pets[0].cleanliness).toBe(100);
    expect(['happy', 'ecstatic']).toContain(getPetMood(save.pets[0]));

    // Full-stat guards prevent infinite XP farming!
    const redundantBath = bathPet(save, petId, now + 350);
    expect(redundantBath.ok).toBe(false);

    const fullSave = {
      ...save,
      pets: [{ ...save.pets[0], hunger: 100, happiness: 100, energy: 100, health: 100 }],
    };
    expect(feedPet(fullSave, petId, 'oran_berry', now + 400).ok).toBe(false);
    expect(patPet(fullSave, petId, now + 410).ok).toBe(false);
    expect(toggleSleep(fullSave, petId, now + 420).ok).toBe(false);
  });

  it('keeps duplicate gacha pulls with unique talents/IVs, supports release, and has rich random names', () => {
    const now = 1_700_000_000_000;
    let save = adoptPet(createInitialSave(), 'pikachu', '皮卡丘', now).save;
    save = { ...save, coins: 3000 };

    // Every species has >= 12 distinct random nicknames
    for (const sp of Object.keys(SPECIES_CATALOG) as (keyof typeof SPECIES_CATALOG)[]) {
      expect(SPECIES_RANDOM_NAMES[sp].length).toBeGreaterThanOrEqual(12);
      const picked = pickRandomPetName(sp, [SPECIES_CATALOG[sp].defaultName]);
      expect(picked).not.toBe(SPECIES_CATALOG[sp].defaultName);
    }

    // Pulling multiple times always keeps new unique individuals up to MAX_PET_SLOTS
    const p1 = pullGachaBox(save, 'normal_box', now + 10);
    expect(p1.ok).toBe(true);
    expect(p1.pulledPet).toBeDefined();
    expect(p1.save.pets.length).toBe(2);
    expect(getPetTalent(p1.pulledPet!)).toBeDefined();
    expect(getPetIVs(p1.pulledPet!).atk).toBeGreaterThanOrEqual(1);

    // Releasing the newly pulled pet removes it and rewards coins + XP
    const coinsBefore = p1.save.coins;
    const rel = releasePet(p1.save, p1.pulledPet!.id, now + 20);
    expect(rel.ok).toBe(true);
    expect(rel.save.pets.length).toBe(1);
    expect(rel.save.coins).toBeGreaterThan(coinsBefore);

    // Cannot release the very last partner
    const failLast = releasePet(rel.save, rel.save.pets[0].id, now + 30);
    expect(failLast.ok).toBe(false);
  });

  it('enforces trainer stamina consumption and time-only stamina recovery', () => {
    const now = 1_700_000_000_000;
    let save = adoptPet(createInitialSave(now), 'charmander', '小火龙', now).save;
    const petId = save.pets[0].id;
    expect(save.stamina).toBe(20);

    // Patting consumes 1 stamina, bathing consumes 2 stamina, mini-game consumes 3 stamina
    save = patPet(save, petId, now + 1000).save;
    expect(save.stamina).toBe(19);
    save = bathPet(save, petId, now + 2000).save;
    expect(save.stamina).toBe(17);
    const gameSpend = spendStaminaForGame(save, now + 3000);
    expect(gameSpend.ok).toBe(true);
    expect(gameSpend.save.stamina).toBe(14);

    // Depleted stamina blocks actions until time elapses
    const emptyStamina = { ...gameSpend.save, stamina: 0, lastStaminaAt: now + 3000 };
    expect(patPet(emptyStamina, petId, now + 4000).ok).toBe(false);
    expect(spendStaminaForGame(emptyStamina, now + 4000).ok).toBe(false);

    // After 2 regen intervals, +2 stamina recovers automatically
    const recovered = tickStamina(emptyStamina, now + 3000 + STAMINA_REGEN_MS * 2);
    expect(recovered.stamina).toBe(2);
  });

  it('supports overworld battles, type effectiveness, wild capture, and Poke Center healing', () => {
    const now = 1_700_000_000_000;
    let save = adoptPet(createInitialSave(now), 'pikachu', '波奇', now).save;
    const petId = save.pets[0].id;

    // Type chart checks
    expect(getTypeMultiplier('electric', 'water')).toBe(1.5);
    expect(getTypeMultiplier('fire', 'grass')).toBe(1.5);
    expect(getTypeMultiplier('water', 'grass')).toBe(0.7);

    // Battle stats scale properly
    const stats = computeBattleStats(save.pets[0]);
    expect(stats.maxHp).toBeGreaterThan(40);
    expect(stats.atk).toBeGreaterThan(15);

    // Spend stamina to start battle
    const spend = spendStaminaForBattle(save, now + 100);
    expect(spend.ok).toBe(true);
    expect(spend.save.stamina).toBe(17);
    save = spend.save;

    // Win wild battle and capture a wild Eevee
    const caught = recordBattleOutcome(
      save,
      petId,
      {
        result: 'caught',
        enemySpecies: 'eevee',
        enemyLevel: 6,
        isTrainer: false,
        remainingHpPct: 60,
      },
      now + 2000,
    );
    expect(caught.ok).toBe(true);
    expect(caught.save.pets.length).toBe(2);
    expect(caught.save.discoveredSpecies).toContain('eevee');
    expect(caught.save.pets[0].health).toBe(60);

    // Poke Center restores full party to 100% HP
    const healedAll = healAllPets(caught.save, now + 3000);
    expect(healedAll.ok).toBe(true);
    expect(healedAll.save.pets.every((p) => p.health === 100)).toBe(true);
  });

  it('settles Open-World Pokémon Survivors loot, Safe Zones lattice, and BFS click-to-walk', () => {
    const now = 1_700_000_000_000;
    const save = adoptPet(createInitialSave(now), 'pikachu', '波奇', now).save;
    expect(save.bgmEnabled).toBe(true);

    // Safe Zone generator always yields nearby outposts including initial NE Safe Zone
    const zones = getNearbySafeZones(0, 0);
    expect(zones.length).toBe(9);
    expect(zones.some((z) => z.id === 'sz_0_0' && z.radius >= 100)).toBe(true);

    // BFS tile pathfinder routes cleanly to Poke Center door
    const path = findTilePath({ x: 5, y: 6 }, { x: 3, y: 2 });
    expect(path.length).toBeGreaterThan(3);
    expect(path[path.length - 1]).toEqual({ x: 3, y: 2 });

    // Survivors settlement grants coins, XP, diary record, and updates HP
    const coinsBefore = save.coins;
    const outcome = recordSurvivorsOutcome(
      save,
      save.pets[0].id,
      {
        survivedSec: 65,
        kills: 42,
        runLevel: 5,
        coinsCollected: 38,
        cleared: false,
        remainingHpPct: 74,
      },
      now + 65_000,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.save.coins).toBeGreaterThan(coinsBefore + 38);
    expect(outcome.save.pets[0].health).toBe(74);
    expect(outcome.save.diary.some((d) => d.text.includes('42'))).toBe(true);

    // 3D Survivors World: Story chapters, 3D Safe Zones flatten terrain to y=0, skills & Boss capture!
    expect(STORY_CHAPTERS.length).toBe(3);
    expect(ALL_SURVIVOR_SKILL_IDS.length).toBeGreaterThanOrEqual(8);
    expect(getDefaultSkillsForElement('electric')[0]).toBe('thunderbolt');
    const zones3d = getNearbySafeZones3D(0, 0);
    expect(zones3d.some((z) => z.id === 'sz3d_0_0')).toBe(true);
    expect(Number.isFinite(getTerrainHeight3D(20, -16))).toBe(true);

    const captured = captureBossPet(outcome.save, 'dratini', 18, now + 70_000);
    expect(captured.ok).toBe(true);
    expect(captured.save.pets.length).toBe(2);
    expect(captured.save.discoveredSpecies).toContain('dratini');
  });
});
