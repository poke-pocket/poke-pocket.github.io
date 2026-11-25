import {
  ACCESSORY_CATALOG,
  ACHIEVEMENTS,
  buildAchievementContext,
  FOOD_CATALOG,
  GACHA_BOXES,
  MAX_POKEMON_LEVEL,
  NATURE_CATALOG,
  NATURE_ORDER,
  ROOM_CATALOG,
  SPECIES_CATALOG,
  TALENT_CATALOG,
  TALENT_ORDER,
  getGrowthStage,
  getIvRank,
  getPokemonStageName,
  getXpForNextLevel,
  pickRandomPetName,
} from '../data/catalog';
import type {
  AccessoryId,
  DiaryEntry,
  FoodId,
  GachaBoxId,
  GameSave,
  IvRank,
  KeyBindings,
  NatureId,
  PetIVs,
  PetMood,
  PetRecord,
  RoomThemeId,
  ShellThemeId,
  SpeciesId,
  TalentId,
} from '../types/pet';

export const SAVE_STORAGE_KEY = 'pocket_paw_save_v1';
export const MAX_PET_SLOTS = 24;
export const MAX_TRAINER_STAMINA = 20;
export const STAMINA_REGEN_MS = 60_000; // +1 trainer stamina every 60s (time-only recovery)

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  up: 'w',
  down: 's',
  left: 'a',
  right: 'd',
  confirm: 'Enter',
  cancel: 'Escape',
  menu: 'm',
  party: 'p',
};

export const STAMINA_COSTS = {
  feed: 1,
  pat: 1,
  clean: 2,
  play: 3,
  battle: 3,
} as const;

export function tickStamina(save: GameSave, now = Date.now()): GameSave {
  const maxStamina = save.maxStamina || MAX_TRAINER_STAMINA;
  const cur = typeof save.stamina === 'number' ? save.stamina : maxStamina;
  if (cur >= maxStamina) {
    if (cur === maxStamina && save.lastStaminaAt === now) return save;
    return { ...save, stamina: maxStamina, maxStamina, lastStaminaAt: now };
  }
  const lastAt = typeof save.lastStaminaAt === 'number' ? save.lastStaminaAt : now;
  const elapsed = Math.max(0, now - lastAt);
  const gained = Math.floor(elapsed / STAMINA_REGEN_MS);
  if (gained <= 0) return save;
  const nextStamina = Math.min(maxStamina, cur + gained);
  const nextLastAt =
    nextStamina >= maxStamina ? now : lastAt + gained * STAMINA_REGEN_MS;
  return {
    ...save,
    stamina: nextStamina,
    maxStamina,
    lastStaminaAt: nextLastAt,
  };
}

export function getStaminaNextRecoverySec(save: GameSave, now = Date.now()): number {
  if (save.stamina >= save.maxStamina) return 0;
  const elapsed = Math.max(0, now - save.lastStaminaAt);
  const rem = STAMINA_REGEN_MS - (elapsed % STAMINA_REGEN_MS);
  return Math.max(1, Math.ceil(rem / 1000));
}

function consumeStamina(
  save: GameSave,
  cost: number,
  now: number,
): { ok: true; save: GameSave } | { ok: false; save: GameSave; message: string } {
  const synced = tickStamina(save, now);
  if (cost <= 0) return { ok: true, save: synced };
  if (synced.stamina < cost) {
    const waitSec = getStaminaNextRecoverySec(synced, now);
    return {
      ok: false,
      save: synced,
      message: `训练家体力不足（需 ${cost}，当前 ${synced.stamina}/${synced.maxStamina}，${waitSec}秒后回复）`,
    };
  }
  const wasFull = synced.stamina >= synced.maxStamina;
  return {
    ok: true,
    save: {
      ...synced,
      stamina: synced.stamina - cost,
      lastStaminaAt: wasFull ? now : synced.lastStaminaAt,
    },
  };
}

export function spendStaminaForGame(save: GameSave, now = Date.now()): ActionOutcome {
  const res = consumeStamina(save, STAMINA_COSTS.play, now);
  if (!res.ok) return res;
  return { ok: true, save: res.save, message: `消耗 ${STAMINA_COSTS.play} 体力，开始特训！` };
}

export function spendStaminaForBattle(save: GameSave, now = Date.now()): ActionOutcome {
  const res = consumeStamina(save, STAMINA_COSTS.battle, now);
  if (!res.ok) return res;
  return { ok: true, save: res.save, message: `消耗 ${STAMINA_COSTS.battle} 体力，遭遇对战！` };
}

export interface BattleResultPayload {
  result: 'win' | 'caught' | 'lose' | 'run';
  enemySpecies: SpeciesId;
  enemyLevel: number;
  isTrainer: boolean;
  remainingHpPct: number; // 0..100
  bonusCoinsFromMoves?: number;
}

export function recordBattleOutcome(
  save: GameSave,
  petId: string,
  payload: BattleResultPayload,
  now = Date.now(),
): ActionOutcome & { caughtPet?: PetRecord } {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到出战宝可梦' };
  const enemyMeta = SPECIES_CATALOG[payload.enemySpecies];

  const baseHealth = Math.max(20, Math.min(100, Math.round(payload.remainingHpPct)));
  const isWin = payload.result === 'win' || payload.result === 'caught';
  const itemCoinMult = pet.accessory === 'amulet_coin' ? 1.3 : 1.0;
  const itemXpMult = pet.accessory === 'lucky_egg' || pet.accessory === 'exp_share' ? 1.3 : 1.0;

  let coinGain = 0;
  let xpGain = 0;
  if (isWin) {
    const rawCoins =
      (payload.isTrainer ? 42 : 24) +
      payload.enemyLevel * (payload.isTrainer ? 3 : 2) +
      (payload.bonusCoinsFromMoves ?? 0);
    const rawXp = (payload.isTrainer ? 130 : 95) + payload.enemyLevel * 12;
    coinGain = Math.round(rawCoins * itemCoinMult);
    xpGain = Math.round(rawXp * itemXpMult);
  } else if (payload.result === 'lose') {
    coinGain = 8;
    xpGain = 35;
  }

  let pets = save.pets.map((p) =>
    p.id === petId
      ? {
          ...p,
          health: payload.result === 'run' ? Math.max(25, baseHealth) : baseHealth,
          energy: clampStat(p.energy - (payload.result === 'run' ? 4 : 10)),
          hunger: clampStat(p.hunger - (payload.result === 'run' ? 2 : 6)),
          happiness: clampStat(p.happiness + (isWin ? 10 : 0)),
          totalPlays: p.totalPlays + (isWin ? 1 : 0),
          lastTickAt: now,
        }
      : p,
  );

  let caughtPet: PetRecord | undefined;
  const discovered = new Set(save.discoveredSpecies);
  if (payload.result === 'caught') {
    discovered.add(payload.enemySpecies);
    if (pets.length < MAX_PET_SLOTS) {
      const existingNames = pets.map((p) => p.name);
      const isDup = pets.some((p) => p.species === payload.enemySpecies);
      const petName = isDup
        ? pickRandomPetName(payload.enemySpecies, existingNames)
        : enemyMeta.defaultName;
      caughtPet = {
        ...createPet(payload.enemySpecies, petName, now, 'pokeball_room'),
        level: Math.max(5, Math.min(payload.enemyLevel, 50)),
      };
      pets = [...pets, caughtPet];
    }
  }

  const diaryText =
    payload.result === 'caught'
      ? `在对战中成功收服了野生 Lv.${payload.enemyLevel} ${enemyMeta.title}！`
      : payload.result === 'win'
        ? `${payload.isTrainer ? '切磋' : '草丛'}对战击败了 Lv.${payload.enemyLevel} ${enemyMeta.title}，获得 +${coinGain} 金币与 +${xpGain} EXP！`
        : payload.result === 'lose'
          ? `与 Lv.${payload.enemyLevel} ${enemyMeta.title} 激战惜败，回到球中休整。`
          : `从与 ${enemyMeta.title} 的遭遇战中安全撤退了。`;

  const diary = addDiary(save, pet, isWin ? 'sparkle' : 'pokeball', diaryText, now);
  const baseSave: GameSave = {
    ...save,
    pets,
    discoveredSpecies: Array.from(discovered),
    diary,
    miniGameWins: save.miniGameWins + (isWin ? 1 : 0),
  };

  if (xpGain > 0 || coinGain > 0) {
    const progressed = grantXpAndCoins(baseSave, petId, xpGain, coinGain, now);
    return {
      ok: true,
      ...progressed,
      caughtPet,
      coinsEarned: coinGain,
      xpEarned: xpGain,
      message:
        payload.result === 'caught'
          ? `收服成功！「${caughtPet?.name ?? enemyMeta.title}」加入球盒，获得 +${xpGain} EXP！`
          : payload.result === 'win'
            ? `对战胜利！获得 +${coinGain} 金币与 +${xpGain} EXP！`
            : `惜败休整，获得 +${xpGain} EXP，记得用伤药回复 HP 哦！`,
    };
  }

  return {
    ok: true,
    save: baseSave,
    message: '安全撤离了草丛对战！',
  };
}

export interface SurvivorsResultPayload {
  survivedSec: number;
  kills: number;
  runLevel: number;
  coinsCollected: number;
  cleared: boolean;
  remainingHpPct: number;
}

export function recordSurvivorsOutcome(
  save: GameSave,
  petId: string,
  payload: SurvivorsResultPayload,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到出战宝可梦' };

  const itemCoinMult = pet.accessory === 'amulet_coin' ? 1.3 : 1.0;
  const itemXpMult =
    pet.accessory === 'lucky_egg' || pet.accessory === 'exp_share' ? 1.3 : 1.0;

  const coinGain = Math.round(
    (payload.coinsCollected + payload.kills * 2 + (payload.cleared ? 60 : 12)) * itemCoinMult,
  );
  const xpGain = Math.round(
    (45 + payload.kills * 5 + payload.survivedSec * 2 + (payload.cleared ? 140 : 0)) *
      itemXpMult,
  );
  const nextHealth = Math.max(25, Math.min(100, Math.round(payload.remainingHpPct)));

  const pets = save.pets.map((p) =>
    p.id === petId
      ? {
          ...p,
          health: nextHealth,
          energy: clampStat(p.energy - 12),
          hunger: clampStat(p.hunger - 8),
          happiness: clampStat(p.happiness + (payload.cleared ? 16 : 8)),
          totalPlays: p.totalPlays + 1,
          lastTickAt: now,
        }
      : p,
  );

  const diary = addDiary(
    save,
    pet,
    'sparkle',
    `幸存者秘境${payload.cleared ? '通关！' : '结算：'}存活 ${payload.survivedSec}秒，击败 ${payload.kills} 只野生宝可梦，获 +${coinGain} 金币 / +${xpGain} EXP！`,
    now,
  );

  const baseSave: GameSave = {
    ...save,
    pets,
    diary,
    miniGameBestCatch: Math.max(save.miniGameBestCatch, payload.kills),
    miniGameWins: save.miniGameWins + (payload.cleared ? 1 : 0),
  };

  const progressed = grantXpAndCoins(baseSave, petId, xpGain, coinGain, now);
  return {
    ok: true,
    ...progressed,
    coinsEarned: coinGain,
    xpEarned: xpGain,
    message: payload.cleared
      ? `幸存者通关！击败 ${payload.kills} 敌，获 +${coinGain} 金币与 +${xpGain} EXP！`
      : `秘境结算：击败 ${payload.kills} 敌，获 +${coinGain} 金币与 +${xpGain} EXP！`,
  };
}

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const LEGACY_SPECIES_MAP: Record<string, SpeciesId> = {
  cat: 'pikachu',
  shiba: 'charmander',
  bunny: 'bulbasaur',
  dragon: 'squirtle',
};

const LEGACY_SHELL_MAP: Record<string, ShellThemeId> = {
  cream: 'pikachu_yellow',
  mint: 'crystal_blue',
  sakura: 'pokeball_red',
  atomic: 'gengar_purple',
};

const LEGACY_ROOM_MAP: Record<string, RoomThemeId> = {
  cozy: 'pokeball_room',
  sakura: 'greatball_room',
  beach: 'ultraball_room',
  space: 'masterball_room',
  pallet_meadow: 'pokeball_room',
  viridian_forest: 'greatball_room',
  cerulean_beach: 'ultraball_room',
  sky_pillar: 'masterball_room',
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getPetNature(pet: Pick<PetRecord, 'id' | 'species' | 'nature'>): NatureId {
  if (pet.nature && NATURE_ORDER.includes(pet.nature)) {
    return pet.nature;
  }
  return NATURE_ORDER[hashSeed(`${pet.id}:${pet.species}`) % NATURE_ORDER.length];
}

export function getPetTalent(pet: Pick<PetRecord, 'id' | 'species' | 'talent'>): TalentId {
  if (pet.talent && TALENT_ORDER.includes(pet.talent)) {
    return pet.talent;
  }
  return TALENT_ORDER[hashSeed(`talent:${pet.id}:${pet.species}`) % TALENT_ORDER.length];
}

export function getPetIVs(pet: Pick<PetRecord, 'id' | 'species' | 'ivs'>): PetIVs {
  if (
    pet.ivs &&
    typeof pet.ivs.atk === 'number' &&
    typeof pet.ivs.def === 'number' &&
    typeof pet.ivs.spd === 'number' &&
    typeof pet.ivs.charm === 'number'
  ) {
    return pet.ivs;
  }
  const h1 = hashSeed(`iv1:${pet.id}:${pet.species}`);
  const h2 = hashSeed(`iv2:${pet.id}:${pet.species}`);
  return {
    atk: 8 + (h1 % 24),
    def: 8 + ((h1 >>> 8) % 24),
    spd: 8 + (h2 % 24),
    charm: 8 + ((h2 >>> 8) % 24),
  };
}

function rollRandomIVs(rarity: 'R' | 'SR' | 'SSR'): PetIVs {
  // Higher rarity has slightly higher IV floor, while any species can still roll S/SS!
  const floor = rarity === 'SSR' ? 14 : rarity === 'SR' ? 10 : 6;
  const span = 32 - floor;
  const rollOne = () => floor + Math.floor(Math.random() * span);
  return {
    atk: rollOne(),
    def: rollOne(),
    spd: rollOne(),
    charm: rollOne(),
  };
}

export function createPet(
  species: SpeciesId,
  name: string,
  now = Date.now(),
  ballRoom: RoomThemeId = 'pokeball_room',
): PetRecord {
  const meta = SPECIES_CATALOG[species];
  const cleanName = name.trim() || meta.defaultName;
  const nature = NATURE_ORDER[Math.floor(Math.random() * NATURE_ORDER.length)];
  const talent = TALENT_ORDER[Math.floor(Math.random() * TALENT_ORDER.length)];
  const ivs = rollRandomIVs(meta.rarity);
  return {
    id: makeId('pet'),
    name: cleanName.slice(0, 12),
    species,
    nature,
    talent,
    ivs,
    createdAt: now,
    lastTickAt: now,
    hunger: 76,
    happiness: 82,
    cleanliness: 92,
    energy: 86,
    health: 100,
    xp: 0,
    level: 5,
    isSleeping: false,
    isSick: false,
    poopCount: 0,
    accessory: 'none',
    ballRoom,
    totalFeeds: 0,
    totalBaths: 0,
    totalPlays: 0,
    totalPats: 0,
    totalCleans: 0,
  };
}

function createInitialBallStock(): Record<RoomThemeId, number> {
  return {
    pokeball_room: 99,
    healball_room: 0,
    greatball_room: 0,
    nestball_room: 0,
    diveball_room: 0,
    ultraball_room: 0,
    duskball_room: 0,
    luxuryball_room: 0,
    masterball_room: 0,
  };
}

function createInitialAccessoryStock(): Record<AccessoryId, number> {
  return {
    none: 99,
    sprout: 0,
    bow: 0,
    charcoal: 0,
    mystic_water: 0,
    magnet: 0,
    silk_scarf: 0,
    scarf: 0,
    metronome: 0,
    shades: 0,
    focus_band: 0,
    quick_claw: 0,
    focus_sash: 0,
    tophat: 0,
    scope_lens: 0,
    everstone: 0,
    bright_powder: 0,
    shell_bell: 0,
    destiny_knot: 0,
    leftovers: 0,
    life_orb: 0,
    crown: 0,
    exp_share: 0,
    amulet_coin: 0,
    lucky_egg: 0,
  };
}

export function createInitialSave(now = Date.now()): GameSave {
  return {
    version: 2,
    coins: 120,
    stamina: MAX_TRAINER_STAMINA,
    maxStamina: MAX_TRAINER_STAMINA,
    lastStaminaAt: now,
    pets: [],
    activePetId: null,
    discoveredSpecies: [],
    inventory: {
      oran_berry: 99,
      pecha_berry: 2,
      cheri_berry: 1,
      chesto_berry: 1,
      sitrus_berry: 2,
      moomoo_milk: 2,
      lum_berry: 1,
      pokepuff: 1,
      casteliacone: 0,
      curry: 0,
      rage_candy: 0,
      rare_candy: 1,
    },
    unlockedAccessories: ['none'],
    accessoryStock: createInitialAccessoryStock(),
    unlockedRooms: ['pokeball_room'],
    ballStock: createInitialBallStock(),
    activeRoom: 'pokeball_room',
    shellTheme: 'pikachu_yellow',
    showShell: true,
    muted: false,
    sfxVolume: 75,
    bgmEnabled: true,
    bgmVolume: 42,
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    unlockedAchievements: [],
    diary: [],
    miniGameBestCatch: 0,
    miniGameWins: 0,
  };
}

export function loadSave(): GameSave {
  if (typeof window === 'undefined') return createInitialSave();
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createInitialSave();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const base = createInitialSave();

    const rawRoom = typeof parsed.activeRoom === 'string' ? parsed.activeRoom : '';
    const activeRoom: RoomThemeId =
      LEGACY_ROOM_MAP[rawRoom] ??
      (ROOM_CATALOG.some((r) => r.id === rawRoom)
        ? (rawRoom as RoomThemeId)
        : 'pokeball_room');

    const rawUnlockedRooms = Array.isArray(parsed.unlockedRooms)
      ? (parsed.unlockedRooms as string[]).map(
          (r) => LEGACY_ROOM_MAP[r] ?? (r as RoomThemeId),
        )
      : ['pokeball_room' as RoomThemeId];

    const unlockedRooms = Array.from(
      new Set(['pokeball_room' as RoomThemeId, ...rawUnlockedRooms]),
    );

    const rawPets = Array.isArray(parsed.pets) ? (parsed.pets as PetRecord[]) : [];
    const migratedPets: PetRecord[] = rawPets.map((p) => {
      const spRaw = p.species as string;
      const species =
        LEGACY_SPECIES_MAP[spRaw] ??
        (spRaw in SPECIES_CATALOG ? p.species : 'pikachu');
      const ballRoom =
        p.ballRoom && ROOM_CATALOG.some((r) => r.id === p.ballRoom)
          ? p.ballRoom
          : activeRoom;
      return {
        ...p,
        species,
        ballRoom,
        nature: getPetNature(p),
        talent: getPetTalent(p),
        ivs: getPetIVs(p),
      };
    });

    const rawUnlockedAccessories = Array.isArray(parsed.unlockedAccessories)
      ? Array.from(
          new Set([
            'none' as AccessoryId,
            ...(parsed.unlockedAccessories as AccessoryId[]),
          ]),
        )
      : (['none'] as AccessoryId[]);

    const rawBallStock = (parsed.ballStock ?? {}) as Partial<Record<RoomThemeId, number>>;
    const migratedBallStock = createInitialBallStock();
    for (const rm of ROOM_CATALOG) {
      if (rm.id === 'pokeball_room') {
        migratedBallStock[rm.id] = 99;
        continue;
      }
      const usedCount = migratedPets.filter((p) => p.ballRoom === rm.id).length;
      const stored = typeof rawBallStock[rm.id] === 'number' ? rawBallStock[rm.id]! : 0;
      const legacyMin = unlockedRooms.includes(rm.id) ? 1 : 0;
      migratedBallStock[rm.id] = Math.max(stored, usedCount, legacyMin);
    }

    const rawAccStock = (parsed.accessoryStock ?? {}) as Partial<Record<AccessoryId, number>>;
    const migratedAccessoryStock = createInitialAccessoryStock();
    for (const acc of ACCESSORY_CATALOG) {
      if (acc.id === 'none') {
        migratedAccessoryStock.none = 99;
        continue;
      }
      const equippedCount = migratedPets.filter((p) => p.accessory === acc.id).length;
      const stored = typeof rawAccStock[acc.id] === 'number' ? rawAccStock[acc.id]! : 0;
      const legacyMin = rawUnlockedAccessories.includes(acc.id) ? 1 : 0;
      migratedAccessoryStock[acc.id] = Math.max(stored, equippedCount, legacyMin);
    }

    const rawShell = typeof parsed.shellTheme === 'string' ? parsed.shellTheme : '';
    const shellTheme: ShellThemeId =
      LEGACY_SHELL_MAP[rawShell] ??
      (rawShell in
      {
        pikachu_yellow: 1,
        pokeball_red: 1,
        crystal_blue: 1,
        gengar_purple: 1,
      }
        ? (rawShell as ShellThemeId)
        : base.shellTheme);

    const rawInv = (parsed.inventory ?? {}) as Record<string, number>;
    const migratedInventory: Record<FoodId, number> = {
      ...base.inventory,
      oran_berry: 99,
      pecha_berry: rawInv.pecha_berry ?? base.inventory.pecha_berry,
      cheri_berry: rawInv.cheri_berry ?? base.inventory.cheri_berry,
      chesto_berry: rawInv.chesto_berry ?? base.inventory.chesto_berry,
      sitrus_berry: rawInv.sitrus_berry ?? rawInv.fish ?? base.inventory.sitrus_berry,
      moomoo_milk: rawInv.moomoo_milk ?? rawInv.energy_jelly ?? base.inventory.moomoo_milk,
      lum_berry: rawInv.lum_berry ?? base.inventory.lum_berry,
      pokepuff: rawInv.pokepuff ?? rawInv.cake ?? base.inventory.pokepuff,
      casteliacone: rawInv.casteliacone ?? base.inventory.casteliacone,
      curry: rawInv.curry ?? rawInv.bento ?? base.inventory.curry,
      rage_candy: rawInv.rage_candy ?? base.inventory.rage_candy,
      rare_candy: rawInv.rare_candy ?? base.inventory.rare_candy,
    };

    const existingDiscovered = Array.isArray(parsed.discoveredSpecies)
      ? (parsed.discoveredSpecies as SpeciesId[])
      : [];
    const discoveredSpecies = Array.from(
      new Set([
        ...existingDiscovered.filter((s) => s in SPECIES_CATALOG),
        ...migratedPets.map((p) => p.species),
      ]),
    );

    const loaded: GameSave = {
      ...base,
      coins: typeof parsed.coins === 'number' ? parsed.coins : base.coins,
      stamina:
        typeof parsed.stamina === 'number'
          ? Math.max(0, Math.min(MAX_TRAINER_STAMINA, Math.round(parsed.stamina)))
          : base.stamina,
      maxStamina: MAX_TRAINER_STAMINA,
      lastStaminaAt:
        typeof parsed.lastStaminaAt === 'number' ? parsed.lastStaminaAt : Date.now(),
      activePetId:
        typeof parsed.activePetId === 'string' ? parsed.activePetId : null,
      discoveredSpecies,
      showShell: typeof parsed.showShell === 'boolean' ? parsed.showShell : true,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.sfxVolume)))
          : base.sfxVolume,
      bgmEnabled:
        typeof parsed.bgmEnabled === 'boolean' ? parsed.bgmEnabled : base.bgmEnabled,
      bgmVolume:
        typeof parsed.bgmVolume === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.bgmVolume)))
          : base.bgmVolume,
      keyBindings: {
        ...DEFAULT_KEY_BINDINGS,
        ...((parsed.keyBindings as Partial<KeyBindings>) ?? {}),
      },
      miniGameBestCatch:
        typeof parsed.miniGameBestCatch === 'number' ? parsed.miniGameBestCatch : 0,
      miniGameWins:
        typeof parsed.miniGameWins === 'number' ? parsed.miniGameWins : 0,
      pets: migratedPets,
      shellTheme,
      activeRoom,
      inventory: migratedInventory,
      unlockedAccessories: rawUnlockedAccessories,
      accessoryStock: migratedAccessoryStock,
      unlockedRooms,
      ballStock: migratedBallStock,
      diary: Array.isArray(parsed.diary)
        ? (parsed.diary as DiaryEntry[]).slice(0, 40)
        : [],
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? (parsed.unlockedAchievements as string[])
        : [],
    };
    return tickStamina(loaded, Date.now());
  } catch {
    return createInitialSave();
  }
}

export function persistSave(save: GameSave): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function getActivePet(save: GameSave): PetRecord | null {
  if (!save.pets.length) return null;
  return save.pets.find((p) => p.id === save.activePetId) ?? save.pets[0];
}

export function getPetMood(pet: PetRecord): PetMood {
  if (pet.isSleeping) return 'sleeping';
  if (pet.isSick || pet.health < 45) return 'sick';
  if (pet.cleanliness < 30 || pet.poopCount >= 2) return 'dirty';
  if (pet.hunger < 30) return 'hungry';
  if (pet.energy < 25) return 'sleepy';
  if (
    pet.happiness >= 85 &&
    pet.hunger >= 65 &&
    pet.cleanliness >= 70 &&
    pet.energy >= 55
  ) {
    return 'ecstatic';
  }
  if (pet.happiness >= 55) return 'happy';
  return 'normal';
}

export function getMoodLabel(mood: PetMood): string {
  switch (mood) {
    case 'sleeping':
      return '熟睡中';
    case 'sick':
      return '需治疗';
    case 'dirty':
      return '求洗澡';
    case 'hungry':
      return '饿肚肚';
    case 'sleepy':
      return '好困了';
    case 'ecstatic':
      return '亲密满';
    case 'happy':
      return '好心情';
    default:
      return '散步中';
  }
}

function addDiary(
  save: GameSave,
  pet: PetRecord,
  badge: string,
  text: string,
  now: number,
): DiaryEntry[] {
  const entry: DiaryEntry = {
    id: makeId('log'),
    timestamp: now,
    petId: pet.id,
    petName: pet.name,
    badge,
    text,
  };
  return [entry, ...save.diary].slice(0, 40);
}

export function tickPet(
  pet: PetRecord,
  now = Date.now(),
): { pet: PetRecord; elapsedMinutes: number } {
  const rawSeconds = Math.max(0, (now - pet.lastTickAt) / 1000);
  const simSeconds = Math.min(rawSeconds, 4 * 3600);
  if (simSeconds < 1) {
    return { pet, elapsedMinutes: 0 };
  }

  const minutes = simSeconds / 60;
  let hunger = pet.hunger;
  let happiness = pet.happiness;
  let cleanliness = pet.cleanliness;
  let energy = pet.energy;
  let health = pet.health;
  let isSleeping = pet.isSleeping;
  let isSick = pet.isSick;
  let poopCount = pet.poopCount;

  const talent = getPetTalent(pet);
  if (isSleeping) {
    energy = energy + minutes * (talent === 'energetic' ? 14 : 11);
    hunger = hunger - minutes * 0.65;
    happiness = happiness - minutes * 0.25;
    cleanliness = cleanliness - minutes * (talent === 'clean_freak' ? 0.15 : 0.25);
    if (energy >= 100 && simSeconds > 90) {
      energy = 100;
      isSleeping = false;
    }
  } else {
    hunger = hunger - minutes * 1.35;
    const poopPenalty = poopCount * 0.55;
    happiness = happiness - minutes * (0.95 + poopPenalty);
    cleanliness =
      cleanliness -
      minutes * ((talent === 'clean_freak' ? 0.55 : 0.85) + poopCount * 0.8);
    energy = energy - minutes * (talent === 'energetic' ? 0.6 : 0.9);

    if (rawSeconds > 180) {
      hunger = Math.max(18, hunger);
      happiness = Math.max(22, happiness);
      cleanliness = Math.max(25, cleanliness);
      energy = Math.max(18, energy);
    }
  }

  if (!isSleeping && poopCount < 3 && minutes >= 2.2) {
    const chance = Math.min(0.65, minutes * 0.08);
    if (Math.random() < chance) {
      poopCount = Math.min(3, poopCount + 1);
      cleanliness -= 10;
    }
  }

  if (hunger < 18 || cleanliness < 18 || poopCount >= 3) {
    health -= minutes * 0.9;
  } else if (hunger >= 50 && cleanliness >= 55 && !isSick) {
    health += minutes * 0.6;
  }

  const nextHealth = clampStat(health);
  if (nextHealth < 42) {
    isSick = true;
  }

  return {
    elapsedMinutes: Math.round(minutes),
    pet: {
      ...pet,
      lastTickAt: now,
      hunger: clampStat(hunger),
      happiness: clampStat(happiness),
      cleanliness: clampStat(cleanliness),
      energy: clampStat(energy),
      health: nextHealth,
      isSleeping,
      isSick,
      poopCount,
    },
  };
}

function evaluateAchievements(
  save: GameSave,
  pet: PetRecord,
  now: number,
): { save: GameSave; newlyUnlocked: string[] } {
  const newlyUnlocked: string[] = [];
  let coins = save.coins;
  let diary = save.diary;
  const unlocked = new Set(save.unlockedAchievements);

  const check = (id: string, condition: boolean) => {
    if (!unlocked.has(id) && condition) {
      unlocked.add(id);
      newlyUnlocked.push(id);
      const meta = ACHIEVEMENTS.find((a) => a.id === id);
      if (meta) {
        coins += meta.rewardCoins;
        diary = [
          {
            id: makeId('ach'),
            timestamp: now,
            petId: pet.id,
            petName: pet.name,
            badge: meta.badge,
            text: `解锁成就「${meta.title}」! 获得 +${meta.rewardCoins} 金币`,
          },
          ...diary,
        ].slice(0, 40);
      }
    }
  };

  const ctx = buildAchievementContext(
    save,
    {
      getPetIVs,
      getIvRank,
      getGrowthStage,
      getElement: (sp) => SPECIES_CATALOG[sp]?.element,
      totalSpeciesCount: Object.keys(SPECIES_CATALOG).length,
    },
    unlocked.size,
  );
  // Pass 1: all gameplay/collection achievements
  for (const ach of ACHIEVEMENTS) {
    if (!ach.isMeta) {
      check(ach.id, ach.check(ctx));
    }
  }
  // Pass 2: meta achievements (unlock 30 / 60 / 100 achievements)
  ctx.unlockedCount = unlocked.size;
  for (const ach of ACHIEVEMENTS) {
    if (ach.isMeta) {
      check(ach.id, ach.check(ctx));
    }
  }

  return {
    newlyUnlocked,
    save: {
      ...save,
      coins,
      diary,
      unlockedAchievements: Array.from(unlocked),
    },
  };
}

export function syncAchievements(save: GameSave, now = Date.now()): GameSave {
  const anchorPet = getActivePet(save) ?? save.pets[0];
  if (!anchorPet) return save;
  return evaluateAchievements(save, anchorPet, now).save;
}

function grantXpAndCoins(
  save: GameSave,
  petId: string,
  xpGain: number,
  coinGain: number,
  now: number,
): {
  save: GameSave;
  leveledUp: boolean;
  evolvedTo: string | null;
  newlyUnlocked: string[];
} {
  let leveledUp = false;
  let evolvedTo: string | null = null;
  let bonusCoins = 0;
  let diary = save.diary;
  let targetPet: PetRecord | null = null;

  const pets = save.pets.map((p) => {
    if (p.id !== petId) return p;
    const talent = getPetTalent(p);
    const effectiveXpGain =
      talent === 'prodigy'
        ? Math.round(xpGain * 1.2)
        : talent === 'shiny_soul'
          ? Math.round(xpGain * 1.15)
          : xpGain;
    const prevStage = getGrowthStage(p.level, p.species);
    let xp = p.xp + effectiveXpGain;
    let level = p.level;
    while (level < MAX_POKEMON_LEVEL && xp >= getXpForNextLevel(level)) {
      xp -= getXpForNextLevel(level);
      level += 1;
      leveledUp = true;
      bonusCoins += 20;
    }
    if (level >= MAX_POKEMON_LEVEL) {
      xp = 0;
    }
    const nextStage = getGrowthStage(level, p.species);
    if (nextStage !== prevStage) {
      evolvedTo = getPokemonStageName(p.species, level);
    }
    const updated = { ...p, xp, level };
    targetPet = updated;
    if (leveledUp) {
      diary = [
        {
          id: makeId('lvl'),
          timestamp: now,
          petId: updated.id,
          petName: updated.name,
          badge: evolvedTo ? 'sparkle' : 'arrow_up',
          text: evolvedTo
            ? `恭喜！进化成了【${evolvedTo}】(Lv.${updated.level})！`
            : `升到了 Lv.${updated.level}！奖励 +${bonusCoins} 金币`,
        },
        ...diary,
      ].slice(0, 40);
    }
    return updated;
  });

  const anchorTalent = targetPet ? getPetTalent(targetPet) : null;
  const effectiveCoinGain =
    anchorTalent === 'lucky'
      ? Math.round(coinGain * 1.25)
      : anchorTalent === 'shiny_soul'
        ? Math.round(coinGain * 1.15)
        : coinGain;

  let nextSave: GameSave = {
    ...save,
    coins: save.coins + effectiveCoinGain + bonusCoins,
    pets,
    diary,
  };

  let newlyUnlocked: string[] = [];
  if (targetPet) {
    const evalRes = evaluateAchievements(nextSave, targetPet, now);
    nextSave = evalRes.save;
    newlyUnlocked = evalRes.newlyUnlocked;
  }

  return { save: nextSave, leveledUp, evolvedTo, newlyUnlocked };
}

export interface ActionOutcome {
  ok: boolean;
  save: GameSave;
  message: string;
  leveledUp?: boolean;
  evolvedTo?: string | null;
  newlyUnlocked?: string[];
  coinsEarned?: number;
  xpEarned?: number;
}

export function adoptPet(
  save: GameSave,
  species: SpeciesId,
  name: string,
  now = Date.now(),
): ActionOutcome {
  if (save.pets.length >= MAX_PET_SLOTS) {
    return {
      ok: false,
      save,
      message: `队伍栏已满（最多 ${MAX_PET_SLOTS} 只）`,
    };
  }
  const pet = createPet(species, name, now, 'pokeball_room');
  const discoveredSpecies = Array.from(new Set([...save.discoveredSpecies, species]));
  const diary = addDiary(
    save,
    pet,
    'pokeball',
    `收服了 ${SPECIES_CATALOG[species].title}「${pet.name}」！`,
    now,
  );
  const baseSave: GameSave = {
    ...save,
    pets: [...save.pets, pet],
    activePetId: pet.id,
    discoveredSpecies,
    diary,
  };
  const evalRes = evaluateAchievements(baseSave, pet, now);
  return {
    ok: true,
    save: evalRes.save,
    message: `就决定是你了！「${pet.name}」放入了你的精灵球！`,
    newlyUnlocked: evalRes.newlyUnlocked,
  };
}

export interface GachaOutcome extends ActionOutcome {
  pulledSpecies?: SpeciesId;
  pulledPet?: PetRecord;
  isNewDex?: boolean;
  isDuplicateSpecies?: boolean;
  isDuplicateBoost?: boolean;
}

export interface GachaTenEntry {
  species: SpeciesId;
  petId?: string;
  nature?: NatureId;
  talent?: TalentId;
  ivRank?: IvRank;
  isNewDex: boolean;
  isDuplicateSpecies: boolean;
  joinedParty: boolean;
}

export interface GachaTenOutcome extends ActionOutcome {
  boxId?: GachaBoxId;
  results?: GachaTenEntry[];
  newAdoptedCount?: number;
  dupCount?: number;
  totalRefundCoins?: number;
  totalBonusXp?: number;
}

export function getReleaseReward(pet: PetRecord): { coins: number; xp: number } {
  const rarity = SPECIES_CATALOG[pet.species].rarity;
  const baseCoins = rarity === 'SSR' ? 110 : rarity === 'SR' ? 65 : 35;
  const baseXp = rarity === 'SSR' ? 220 : rarity === 'SR' ? 140 : 80;
  const ivRank = getIvRank(getPetIVs(pet));
  const rankMult = ivRank === 'SS' ? 1.4 : ivRank === 'S' ? 1.2 : 1;
  const lvBonus = Math.max(0, pet.level - 5) * 6;
  return {
    coins: Math.round(baseCoins * rankMult) + lvBonus,
    xp: Math.round(baseXp * rankMult) + lvBonus * 2,
  };
}

export function releasePet(
  save: GameSave,
  petId: string,
  now = Date.now(),
): ActionOutcome {
  if (save.pets.length <= 1) {
    return { ok: false, save, message: '至少需要保留 1 只宝可梦伙伴哦！' };
  }
  const target = save.pets.find((p) => p.id === petId);
  if (!target) {
    return { ok: false, save, message: '找不到该宝可梦' };
  }
  const reward = getReleaseReward(target);
  const remaining = save.pets.filter((p) => p.id !== petId);
  const nextActive =
    save.activePetId === petId ? remaining[0] : getActivePet({ ...save, pets: remaining }) ?? remaining[0];
  const diary = addDiary(
    save,
    target,
    'sparkle',
    `温柔放生了「${target.name}」，留下 +${reward.coins} 金币与 +${reward.xp} EXP 祝福！`,
    now,
  );
  const baseSave: GameSave = {
    ...save,
    pets: remaining,
    activePetId: nextActive.id,
    activeRoom: nextActive.ballRoom,
    diary,
  };
  const progressed = grantXpAndCoins(baseSave, nextActive.id, reward.xp, reward.coins, now);
  return {
    ok: true,
    ...progressed,
    coinsEarned: reward.coins,
    xpEarned: reward.xp,
    message: `已温柔放生「${target.name}」，获得 +${reward.coins} 金币与 +${reward.xp} EXP！`,
  };
}

export function releasePetsBatch(
  save: GameSave,
  petIds: string[],
  now = Date.now(),
): ActionOutcome & { releasedCount?: number } {
  const uniqueIds = Array.from(new Set(petIds)).filter((id) => id !== save.activePetId);
  if (uniqueIds.length === 0) {
    return { ok: false, save, message: '请选择要放生的宝可梦（当前出战伙伴不可放生）' };
  }
  const idSet = new Set(uniqueIds);
  const targets = save.pets.filter((p) => idSet.has(p.id));
  if (targets.length === 0) {
    return { ok: false, save, message: '未找到选中的宝可梦' };
  }
  const remaining = save.pets.filter((p) => !idSet.has(p.id));
  if (remaining.length < 1) {
    return { ok: false, save, message: '至少需要保留 1 只宝可梦伙伴哦！' };
  }
  let totalCoins = 0;
  let totalXp = 0;
  for (const t of targets) {
    const r = getReleaseReward(t);
    totalCoins += r.coins;
    totalXp += r.xp;
  }
  const nextActive = getActivePet({ ...save, pets: remaining }) ?? remaining[0];
  const diary = addDiary(
    save,
    nextActive,
    'sparkle',
    `批量温柔放生了 ${targets.length} 只宝可梦，留下 +${totalCoins} 金币与 +${totalXp} EXP 祝福！`,
    now,
  );
  const baseSave: GameSave = {
    ...save,
    pets: remaining,
    activePetId: nextActive.id,
    activeRoom: nextActive.ballRoom,
    diary,
  };
  const progressed = grantXpAndCoins(baseSave, nextActive.id, totalXp, totalCoins, now);
  return {
    ok: true,
    ...progressed,
    releasedCount: targets.length,
    coinsEarned: totalCoins,
    xpEarned: totalXp,
    message: `已批量放生 ${targets.length} 只宝可梦，获得 +${totalCoins} 金币与 +${totalXp} EXP！`,
  };
}

function rollWeightedSpecies(pool: { species: SpeciesId; weight: number }[]): SpeciesId {
  const totalWeight = pool.reduce((s, item) => s + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item.species;
  }
  return pool[0].species;
}

export function pullGachaBox(
  save: GameSave,
  boxId: GachaBoxId,
  now = Date.now(),
): GachaOutcome {
  const box = GACHA_BOXES.find((b) => b.id === boxId);
  if (!box) return { ok: false, save, message: '盲盒不存在' };
  if (save.coins < box.price) {
    return { ok: false, save, message: `金币不足，单抽需要 ${box.price} 金币` };
  }

  const picked = rollWeightedSpecies(box.pool);
  const meta = SPECIES_CATALOG[picked];
  const paidSave: GameSave = { ...save, coins: save.coins - box.price };
  const isDuplicateSpecies = paidSave.pets.some((p) => p.species === picked);
  const isNewDex = !paidSave.discoveredSpecies.includes(picked);
  const discoveredSpecies = Array.from(new Set([...paidSave.discoveredSpecies, picked]));

  // Allow keeping duplicate species too — every Pokemon has unique Nature, Talent & IVs!
  if (paidSave.pets.length < MAX_PET_SLOTS) {
    const existingNames = paidSave.pets.map((p) => p.name);
    const petName = isDuplicateSpecies
      ? pickRandomPetName(picked, existingNames)
      : meta.defaultName;
    const newPet = createPet(picked, petName, now, 'pokeball_room');
    const natureMeta = NATURE_CATALOG[getPetNature(newPet)];
    const talentMeta = TALENT_CATALOG[getPetTalent(newPet)];
    const ivRank = getIvRank(getPetIVs(newPet));
    const diary = addDiary(
      paidSave,
      newPet,
      'gift',
      `通过【${box.name}】抽中 [${meta.rarity}] ${meta.title}（${natureMeta.name}·${talentMeta.name}·${ivRank}级）！`,
      now,
    );
    const nextSave: GameSave = {
      ...paidSave,
      pets: [...paidSave.pets, newPet],
      activePetId: newPet.id,
      activeRoom: newPet.ballRoom,
      discoveredSpecies,
      diary,
    };
    const evalRes = evaluateAchievements(nextSave, newPet, now);
    return {
      ok: true,
      save: evalRes.save,
      pulledSpecies: picked,
      pulledPet: newPet,
      isNewDex,
      isDuplicateSpecies,
      isDuplicateBoost: false,
      newlyUnlocked: evalRes.newlyUnlocked,
      message: isDuplicateSpecies
        ? `抽中同种伙伴！${natureMeta.name}性格 · 天分「${talentMeta.name}」(${ivRank}级)`
        : `抽中 [${meta.rarity}] ${meta.title}！${natureMeta.name}性格 · 天分「${talentMeta.name}」(${ivRank}级)`,
    };
  }

  // Only convert to EXP + coins when all pet slots are completely full!
  const targetPet = getActivePet(paidSave);
  if (!targetPet) {
    return { ok: false, save, message: '无法接收宝可梦' };
  }
  const refundCoins = Math.round(box.price * 0.4);
  const dupXp = 180;
  const diary = addDiary(
    paidSave,
    targetPet,
    'gift',
    `球盒已满（${MAX_PET_SLOTS}/${MAX_PET_SLOTS}），${meta.title} 转化为 +${dupXp} EXP 与 ${refundCoins} 金币！`,
    now,
  );
  const progressed = grantXpAndCoins(
    { ...paidSave, discoveredSpecies, diary },
    targetPet.id,
    dupXp,
    refundCoins,
    now,
  );

  return {
    ok: true,
    ...progressed,
    pulledSpecies: picked,
    isNewDex,
    isDuplicateSpecies,
    isDuplicateBoost: true,
    message: `球盒已满！已转化为「${targetPet.name}」+${dupXp} EXP 并返还 ${refundCoins} 金币！`,
  };
}

export function pullGachaTen(
  save: GameSave,
  boxId: GachaBoxId,
  now = Date.now(),
): GachaTenOutcome {
  const box = GACHA_BOXES.find((b) => b.id === boxId);
  if (!box) return { ok: false, save, message: '盲盒不存在' };
  if (save.coins < box.tenPrice) {
    return { ok: false, save, message: `金币不足，十连需要 ${box.tenPrice} 金币` };
  }

  const rolled: SpeciesId[] = Array.from({ length: 10 }, () =>
    rollWeightedSpecies(box.pool),
  );
  // 10-pull guarantee: ensure at least one SR or SSR across the 10 items
  const hasHighRarity = rolled.some((sp) => SPECIES_CATALOG[sp].rarity !== 'R');
  if (!hasHighRarity) {
    const highPool = box.pool.filter(
      (item) => SPECIES_CATALOG[item.species].rarity !== 'R',
    );
    rolled[9] = highPool.length > 0 ? rollWeightedSpecies(highPool) : 'pikachu';
  }

  const discovered = new Set(save.discoveredSpecies);
  const pets = [...save.pets];
  const results: GachaTenEntry[] = [];
  let newAdoptedCount = 0;
  let dupCount = 0;
  let latestNewPet: PetRecord | null = null;

  for (let i = 0; i < rolled.length; i++) {
    const sp = rolled[i];
    const meta = SPECIES_CATALOG[sp];
    const isNewDex = !discovered.has(sp);
    const isDuplicateSpecies = pets.some((p) => p.species === sp);
    discovered.add(sp);

    // Allow duplicate species to join with distinct nature/talent/IVs while slots remain!
    if (pets.length < MAX_PET_SLOTS) {
      const existingNames = pets.map((p) => p.name);
      const petName = isDuplicateSpecies
        ? pickRandomPetName(sp, existingNames)
        : meta.defaultName;
      const pet = createPet(sp, petName, now + i, 'pokeball_room');
      pets.push(pet);
      newAdoptedCount += 1;
      if (
        !latestNewPet ||
        meta.rarity === 'SSR' ||
        (meta.rarity === 'SR' && SPECIES_CATALOG[latestNewPet.species].rarity === 'R')
      ) {
        latestNewPet = pet;
      }
      results.push({
        species: sp,
        petId: pet.id,
        nature: pet.nature,
        talent: pet.talent,
        ivRank: getIvRank(getPetIVs(pet)),
        isNewDex,
        isDuplicateSpecies,
        joinedParty: true,
      });
    } else {
      dupCount += 1;
      results.push({
        species: sp,
        isNewDex,
        isDuplicateSpecies,
        joinedParty: false,
      });
    }
  }

  const dupUnitRefund = Math.round((box.tenPrice / 10) * 0.35);
  const totalBonusXp = dupCount * 180;
  const totalRefundCoins = dupCount * dupUnitRefund;

  const anchorPet = latestNewPet ?? getActivePet({ ...save, pets });
  let diary = save.diary;
  if (anchorPet) {
    diary = addDiary(
      save,
      anchorPet,
      'gift',
      `十连开启【${box.name}】！新增 ${newAdoptedCount} 位伙伴，重复转化 +${totalBonusXp} EXP / +${totalRefundCoins} 金币。`,
      now,
    );
  }

  let nextSave: GameSave = {
    ...save,
    coins: save.coins - box.tenPrice,
    pets,
    activePetId: latestNewPet ? latestNewPet.id : save.activePetId,
    discoveredSpecies: Array.from(discovered),
    diary,
  };

  let leveledUp = false;
  let evolvedTo: string | null = null;
  let newlyUnlocked: string[] = [];

  if (anchorPet && (totalBonusXp > 0 || totalRefundCoins > 0)) {
    const progressed = grantXpAndCoins(
      nextSave,
      anchorPet.id,
      totalBonusXp,
      totalRefundCoins,
      now,
    );
    nextSave = progressed.save;
    leveledUp = progressed.leveledUp;
    evolvedTo = progressed.evolvedTo;
    newlyUnlocked = progressed.newlyUnlocked;
  } else if (anchorPet) {
    const evalRes = evaluateAchievements(nextSave, anchorPet, now);
    nextSave = evalRes.save;
    newlyUnlocked = evalRes.newlyUnlocked;
  }

  const summaryParts: string[] = [];
  if (newAdoptedCount > 0) summaryParts.push(`入队 ${newAdoptedCount} 只新伙伴`);
  if (totalBonusXp > 0) summaryParts.push(`强化 +${totalBonusXp} EXP`);
  if (totalRefundCoins > 0) summaryParts.push(`返还 ${totalRefundCoins} 金币`);

  return {
    ok: true,
    save: nextSave,
    boxId,
    results,
    newAdoptedCount,
    dupCount,
    totalRefundCoins,
    totalBonusXp,
    coinsEarned: totalRefundCoins,
    xpEarned: totalBonusXp,
    leveledUp,
    evolvedTo,
    newlyUnlocked,
    message: `十连完成！${summaryParts.join(' · ')}！`,
  };
}

export function feedPet(
  save: GameSave,
  petId: string,
  foodId: FoodId,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  const food = FOOD_CATALOG.find((f) => f.id === foodId);
  if (!pet || !food) return { ok: false, save, message: '找不到宝可梦或树果' };
  if (pet.isSleeping) {
    return { ok: false, save, message: `${pet.name} 正在睡梦中，先开灯叫醒它吧～` };
  }
  const canCureNow = Boolean(food.curesSick && pet.isSick);
  const canHealNow = Boolean(food.health && pet.health < 100);
  const canLevelUp = Boolean(food.levelUp && pet.level < MAX_POKEMON_LEVEL);
  if (!canLevelUp && !canCureNow && !canHealNow && pet.hunger >= 100) {
    return { ok: false, save, message: `${pet.name} 饱食度已经满啦，等会儿再喂吧！` };
  }
  const stock = save.inventory[foodId] ?? 0;
  if (!food.unlimited && stock <= 0) {
    return { ok: false, save, message: `${food.name} 用光啦，去市场补货吧！` };
  }
  const staminaRes = consumeStamina(save, STAMINA_COSTS.feed, now);
  if (!staminaRes.ok) return staminaRes;
  save = staminaRes.save;

  const isFavorite = SPECIES_CATALOG[pet.species].favoriteFood === foodId;
  const talent = getPetTalent(pet);
  const gourmetMult = talent === 'gourmet' ? 1.2 : 1;
  const hungerGain = Math.round(food.hunger * gourmetMult);
  const happinessGain = Math.round((food.happiness + (isFavorite ? 10 : 0)) * gourmetMult);
  const xpGain = food.levelUp
    ? Math.max(1, getXpForNextLevel(pet.level) - pet.xp)
    : food.xp + (isFavorite ? 15 : 0);
  const coinGain = isFavorite ? 8 : 3;
  const shouldPoop = (pet.totalFeeds + 1) % 3 === 0 && pet.poopCount < 3;

  const pets = save.pets.map((p) => {
    if (p.id !== petId) return p;
    const nextHealth = clampStat(p.health + (food.health ?? 0));
    const cured = Boolean(food.curesSick) || (nextHealth >= 55 && Boolean(food.health));
    return {
      ...p,
      hunger: clampStat(p.hunger + hungerGain),
      happiness: clampStat(p.happiness + happinessGain),
      energy: clampStat(p.energy + food.energy),
      health: nextHealth,
      isSick: cured ? false : p.isSick,
      cleanliness: clampStat(p.cleanliness - (shouldPoop ? 8 : 3)),
      poopCount: shouldPoop ? p.poopCount + 1 : p.poopCount,
      totalFeeds: p.totalFeeds + 1,
      lastTickAt: now,
    };
  });

  const nextInventory = {
    ...save.inventory,
    [foodId]: food.unlimited ? 99 : Math.max(0, stock - 1),
  };

  const diary = addDiary(
    save,
    pet,
    'riceball',
    `享用了${food.name}${isFavorite ? '（最爱！心情+10）' : ''}`,
    now,
  );

  const progressed = grantXpAndCoins(
    { ...save, pets, inventory: nextInventory, diary },
    petId,
    xpGain,
    coinGain,
    now,
  );

  return {
    ok: true,
    ...progressed,
    coinsEarned: coinGain,
    xpEarned: xpGain,
    message: isFavorite
      ? `效果拔群！${pet.name} 超爱吃${food.name}！`
      : food.curesSick && pet.isSick
        ? `${pet.name} 吃下${food.name}，精神焕发恢复健康！`
        : `${pet.name} 吃下了${food.name}，饱食度 +${food.hunger}！`,
  };
}

export function patPet(
  save: GameSave,
  petId: string,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到宝可梦' };
  if (pet.isSleeping) {
    return { ok: false, save, message: `${pet.name} 正在呼呼大睡～` };
  }
  if (pet.happiness >= 100) {
    return { ok: false, save, message: `${pet.name} 亲密度已满格，现在超开心啦！` };
  }
  const staminaRes = consumeStamina(save, STAMINA_COSTS.pat, now);
  if (!staminaRes.ok) return staminaRes;
  save = staminaRes.save;
  const talent = getPetTalent(pet);
  const patHappy = talent === 'sweetheart' ? 12 : 8;
  const patXp = talent === 'sweetheart' ? 20 : 15;
  const pets = save.pets.map((p) =>
    p.id === petId
      ? {
          ...p,
          happiness: clampStat(p.happiness + patHappy),
          totalPats: p.totalPats + 1,
          lastTickAt: now,
        }
      : p,
  );
  const progressed = grantXpAndCoins({ ...save, pets }, petId, patXp, 3, now);
  return {
    ok: true,
    ...progressed,
    coinsEarned: 3,
    xpEarned: patXp,
    message: `抚摸了 ${pet.name}！亲密度提升了～`,
  };
}

export function bathPet(
  save: GameSave,
  petId: string,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到宝可梦' };
  if (pet.isSleeping) {
    return { ok: false, save, message: `${pet.name} 正在睡觉，醒来再洗澡吧～` };
  }
  if (pet.cleanliness >= 100 && pet.poopCount <= 0) {
    return { ok: false, save, message: `${pet.name} 清洁度已满，干干净净不需要洗澡哦！` };
  }
  const staminaRes = consumeStamina(save, STAMINA_COSTS.clean, now);
  if (!staminaRes.ok) return staminaRes;
  save = staminaRes.save;
  const hadPoop = pet.poopCount > 0;
  const bathHappy = getPetTalent(pet) === 'clean_freak' ? 20 : 12;
  const pets = save.pets.map((p) =>
    p.id === petId
      ? {
          ...p,
          cleanliness: 100,
          happiness: clampStat(p.happiness + bathHappy),
          health: clampStat(p.health + 8),
          poopCount: 0,
          totalBaths: p.totalBaths + 1,
          totalCleans: p.totalCleans + (hadPoop ? pet.poopCount : 0),
          lastTickAt: now,
        }
      : p,
  );
  const coinGain = 12 + pet.poopCount * 6;
  const diary = addDiary(save, pet, 'bubble', '洗了闪闪发亮的泡泡澡！', now);
  const progressed = grantXpAndCoins(
    { ...save, pets, diary },
    petId,
    45,
    coinGain,
    now,
  );
  return {
    ok: true,
    ...progressed,
    coinsEarned: coinGain,
    xpEarned: 45,
    message: `${pet.name} 像闪光宝可梦一样干净发亮！`,
  };
}

export function cleanPoop(
  save: GameSave,
  petId: string,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到宝可梦' };
  if (pet.poopCount <= 0) {
    return bathPet(save, petId, now);
  }
  const staminaRes = consumeStamina(save, STAMINA_COSTS.clean, now);
  if (!staminaRes.ok) return staminaRes;
  save = staminaRes.save;
  const cleared = pet.poopCount;
  const pets = save.pets.map((p) =>
    p.id === petId
      ? {
          ...p,
          poopCount: 0,
          cleanliness: clampStat(p.cleanliness + cleared * 15),
          happiness: clampStat(p.happiness + 6),
          totalCleans: p.totalCleans + cleared,
          lastTickAt: now,
        }
      : p,
  );
  const coinGain = cleared * 10;
  const progressed = grantXpAndCoins(
    { ...save, pets },
    petId,
    cleared * 30,
    coinGain,
    now,
  );
  return {
    ok: true,
    ...progressed,
    coinsEarned: coinGain,
    xpEarned: cleared * 30,
    message: `打扫干净了场地，获得 +${coinGain} 金币！`,
  };
}

export function toggleSleep(
  save: GameSave,
  petId: string,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到宝可梦' };
  const nextSleeping = !pet.isSleeping;
  if (nextSleeping && pet.energy >= 100) {
    return { ok: false, save, message: `${pet.name} 体力满格，精神充沛还不想睡哦！` };
  }
  const pets = save.pets.map((p) =>
    p.id === petId ? { ...p, isSleeping: nextSleeping, lastTickAt: now } : p,
  );
  const diary = addDiary(
    save,
    pet,
    nextSleeping ? 'moon' : 'sun',
    nextSleeping ? '关灯进入睡眠休息，恢复体力。' : '睡饱醒来，精神抖擞！',
    now,
  );
  return {
    ok: true,
    save: { ...save, pets, diary },
    message: nextSleeping
      ? `晚安～${pet.name} 进入休息状态恢复体力`
      : `早安！${pet.name} 体力满满醒来啦`,
  };
}

export function healPet(
  save: GameSave,
  petId: string,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到宝可梦' };
  if (!pet.isSick && pet.health >= 100) {
    return { ok: false, save, message: `${pet.name} HP 满格，不需要使用伤药哦！` };
  }
  const pets = save.pets.map((p) =>
    p.id === petId
      ? {
          ...p,
          isSick: false,
          health: 100,
          happiness: clampStat(p.happiness + 10),
          lastTickAt: now,
        }
      : p,
  );
  const diary = addDiary(save, pet, 'pill', '使用伤药治疗，HP 完全恢复！', now);
  const progressed = grantXpAndCoins({ ...save, pets, diary }, petId, 40, 8, now);
  return {
    ok: true,
    ...progressed,
    coinsEarned: 8,
    xpEarned: 40,
    message: `叮咚叮咚～${pet.name} 已恢复全部健康！`,
  };
}

export function healAllPets(save: GameSave, now = Date.now()): ActionOutcome {
  const needsHeal = save.pets.some((p) => p.isSick || p.health < 100);
  const pets = save.pets.map((p) => ({
    ...p,
    isSick: false,
    health: 100,
    lastTickAt: now,
  }));
  const lead = getActivePet(save);
  const diary =
    needsHeal && lead
      ? addDiary(save, lead, 'pill', '在精灵中心恢复了全队宝可梦的 HP！', now)
      : save.diary;
  return {
    ok: true,
    save: { ...save, pets, diary },
    message: needsHeal
      ? '叮咚叮咚～全队宝可梦 HP 已在精灵中心完全恢复！'
      : '全队宝可梦都已经活力满格啦！',
  };
}

export function recordMiniGameResult(
  save: GameSave,
  petId: string,
  gameLabel: string,
  score: number,
  won: boolean,
  now = Date.now(),
): ActionOutcome {
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '未找到宝可梦' };

  const coinGain = Math.max(18, Math.min(95, score * 3 + (won ? 25 : 8)));
  const xpGain = Math.max(90, Math.min(340, 80 + score * 12 + (won ? 60 : 0)));
  const moodGain = won ? 22 : 12;

  const pets = save.pets.map((p) =>
    p.id === petId
      ? {
          ...p,
          happiness: clampStat(p.happiness + moodGain),
          energy: clampStat(p.energy - 12),
          hunger: clampStat(p.hunger - 6),
          totalPlays: p.totalPlays + 1,
          lastTickAt: now,
        }
      : p,
  );

  const diary = addDiary(
    save,
    pet,
    'gamepad',
    `特训「${gameLabel}」获得 ${score} 分，赚取 +${coinGain} 金币！`,
    now,
  );

  const nextSave: GameSave = {
    ...save,
    pets,
    diary,
    miniGameBestCatch: Math.max(save.miniGameBestCatch, score),
    miniGameWins: save.miniGameWins + (won ? 1 : 0),
  };

  const progressed = grantXpAndCoins(nextSave, petId, xpGain, coinGain, now);
  return {
    ok: true,
    ...progressed,
    coinsEarned: coinGain,
    xpEarned: xpGain,
    message: `特训完成！得分 ${score}，获得 +${coinGain} 金币与 +${xpGain} EXP！`,
  };
}

export function buyFood(
  save: GameSave,
  foodId: FoodId,
  qty = 1,
): ActionOutcome {
  const food = FOOD_CATALOG.find((f) => f.id === foodId);
  if (!food || food.unlimited) {
    return { ok: false, save, message: '橙橙果无需购买，免费无限供应！' };
  }
  const cost = food.price * qty;
  if (save.coins < cost) {
    return { ok: false, save, message: `金币不足，需要 ${cost} 金币` };
  }
  return {
    ok: true,
    save: {
      ...save,
      coins: save.coins - cost,
      inventory: {
        ...save.inventory,
        [foodId]: (save.inventory[foodId] ?? 0) + qty,
      },
    },
    message: `购买了 ${food.name} ×${qty}！`,
  };
}

export function getBallAvailability(
  save: GameSave,
  roomId: RoomThemeId,
): { total: number; used: number; available: number } {
  const used = save.pets.filter((p) => (p.ballRoom ?? 'pokeball_room') === roomId).length;
  if (roomId === 'pokeball_room') {
    return { total: Infinity, used, available: Infinity };
  }
  const total = save.ballStock?.[roomId] ?? (save.unlockedRooms.includes(roomId) ? Math.max(1, used) : 0);
  return { total, used, available: Math.max(0, total - used) };
}

export function getAccessoryAvailability(
  save: GameSave,
  accId: AccessoryId,
): { total: number; used: number; available: number } {
  const used = save.pets.filter((p) => p.accessory === accId).length;
  if (accId === 'none') {
    return { total: Infinity, used, available: Infinity };
  }
  const total =
    save.accessoryStock?.[accId] ??
    (save.unlockedAccessories.includes(accId) ? Math.max(1, used) : 0);
  return { total, used, available: Math.max(0, total - used) };
}

export function buyAccessory(
  save: GameSave,
  accessoryId: AccessoryId,
  now = Date.now(),
): ActionOutcome {
  const meta = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
  const anchorPet = getActivePet(save);
  if (!meta || accessoryId === 'none') {
    return { ok: false, save, message: '道具不存在' };
  }
  if (save.coins < meta.price) {
    return { ok: false, save, message: `金币不足，购买需要 ${meta.price} 金币` };
  }
  const unlockedAccessories = save.unlockedAccessories.includes(accessoryId)
    ? save.unlockedAccessories
    : [...save.unlockedAccessories, accessoryId];
  const nextStock = {
    ...save.accessoryStock,
    [accessoryId]: (save.accessoryStock?.[accessoryId] ?? 0) + 1,
  };
  const diary = anchorPet
    ? addDiary(save, anchorPet, 'bow', `在友好商店购买了「${meta.name}」！`, now)
    : save.diary;
  const nextSave: GameSave = {
    ...save,
    coins: save.coins - meta.price,
    unlockedAccessories,
    accessoryStock: nextStock,
    diary,
  };
  const evalRes = anchorPet
    ? evaluateAchievements(nextSave, anchorPet, now)
    : { save: nextSave, newlyUnlocked: [] };
  return {
    ok: true,
    save: evalRes.save,
    newlyUnlocked: evalRes.newlyUnlocked,
    message: `购买了 ${meta.name}（存 ${nextStock[accessoryId]}）！可在背包或详情中装备。`,
  };
}

export function equipAccessory(
  save: GameSave,
  petId: string,
  accessoryId: AccessoryId,
  now = Date.now(),
): ActionOutcome {
  const meta = ACCESSORY_CATALOG.find((a) => a.id === accessoryId);
  const pet = save.pets.find((p) => p.id === petId);
  if (!meta || !pet) return { ok: false, save, message: '道具或宝可梦不存在' };
  if (pet.accessory === accessoryId) {
    return {
      ok: true,
      save,
      message:
        accessoryId === 'none'
          ? `${pet.name} 当前未携带道具`
          : `${pet.name} 已经携带着「${meta.name}」`,
    };
  }
  if (accessoryId !== 'none') {
    const avail = getAccessoryAvailability(save, accessoryId);
    if (avail.available <= 0) {
      return {
        ok: false,
        save,
        message: `「${meta.name}」剩余可用数量不足（余0），请先卸下或去市场购买！`,
      };
    }
  }
  const pets = save.pets.map((p) =>
    p.id === petId ? { ...p, accessory: accessoryId } : p,
  );
  const diary =
    accessoryId !== 'none'
      ? addDiary(save, pet, 'bow', `携带了道具「${meta.name}」！`, now)
      : save.diary;
  return {
    ok: true,
    save: { ...save, pets, diary },
    message:
      accessoryId === 'none'
        ? `已为 ${pet.name} 卸下携带道具`
        : `${pet.name} 已携带「${meta.name}」！`,
  };
}

export function buyOrEquipAccessory(
  save: GameSave,
  petId: string,
  accessoryId: AccessoryId,
  now = Date.now(),
): ActionOutcome {
  const avail = getAccessoryAvailability(save, accessoryId);
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '宝可梦不存在' };
  if (accessoryId === 'none' || pet.accessory === accessoryId || avail.available > 0) {
    return equipAccessory(save, petId, accessoryId, now);
  }
  const bought = buyAccessory(save, accessoryId, now);
  if (!bought.ok) return bought;
  return equipAccessory(bought.save, petId, accessoryId, now);
}

export function buyPokeball(
  save: GameSave,
  roomId: RoomThemeId,
  now = Date.now(),
): ActionOutcome {
  const room = ROOM_CATALOG.find((r) => r.id === roomId);
  const anchorPet = getActivePet(save);
  if (!room || room.price <= 0) {
    return { ok: false, save, message: '基础红白精灵球无限免费供应，无需购买！' };
  }
  if (save.coins < room.price) {
    return { ok: false, save, message: `金币不足，购买需要 ${room.price} 金币` };
  }
  const unlockedRooms = save.unlockedRooms.includes(roomId)
    ? save.unlockedRooms
    : [...save.unlockedRooms, roomId];
  const nextBallStock = {
    ...save.ballStock,
    [roomId]: (save.ballStock?.[roomId] ?? 0) + 1,
  };
  const diary = anchorPet
    ? addDiary(save, anchorPet, 'pokeball', `在友好商店购入了「${room.shortName}」！`, now)
    : save.diary;
  const nextSave: GameSave = {
    ...save,
    coins: save.coins - room.price,
    unlockedRooms,
    ballStock: nextBallStock,
    diary,
  };
  const evalRes = anchorPet
    ? evaluateAchievements(nextSave, anchorPet, now)
    : { save: nextSave, newlyUnlocked: [] };
  return {
    ok: true,
    save: evalRes.save,
    newlyUnlocked: evalRes.newlyUnlocked,
    message: `购买了 ${room.shortName}（存 ${nextBallStock[roomId]}）！请在「精灵详情」分配使用。`,
  };
}

export function assignPetBallRoom(
  save: GameSave,
  petId: string,
  roomId: RoomThemeId,
  now = Date.now(),
): ActionOutcome {
  const room = ROOM_CATALOG.find((r) => r.id === roomId);
  const pet = save.pets.find((p) => p.id === petId);
  if (!room || !pet) return { ok: false, save, message: '精灵球或宝可梦不存在' };
  if ((pet.ballRoom ?? 'pokeball_room') === roomId) {
    return { ok: true, save, message: `${pet.name} 当前已居住在「${room.shortName}」` };
  }
  const avail = getBallAvailability(save, roomId);
  if (avail.available <= 0) {
    return {
      ok: false,
      save,
      message: `${room.shortName} 可用数量不足（余0），请先去友好商店购买！`,
    };
  }
  const pets = save.pets.map((p) =>
    p.id === petId ? { ...p, ballRoom: roomId } : p,
  );
  const diary = addDiary(save, pet, 'pokeball', `更换球舱为「${room.name}」！`, now);
  return {
    ok: true,
    save: {
      ...save,
      activeRoom: save.activePetId === petId ? roomId : save.activeRoom,
      pets,
      diary,
    },
    message: `${pet.name} 入住了「${room.name}」！`,
  };
}

export function buyOrAssignPetRoom(
  save: GameSave,
  petId: string,
  roomId: RoomThemeId,
  now = Date.now(),
): ActionOutcome {
  const avail = getBallAvailability(save, roomId);
  const pet = save.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, save, message: '宝可梦不存在' };
  if ((pet.ballRoom ?? 'pokeball_room') === roomId || avail.available > 0) {
    return assignPetBallRoom(save, petId, roomId, now);
  }
  const bought = buyPokeball(save, roomId, now);
  if (!bought.ok) return bought;
  return assignPetBallRoom(bought.save, petId, roomId, now);
}

export function setShellTheme(save: GameSave, shellTheme: ShellThemeId): GameSave {
  return { ...save, shellTheme };
}

export function switchPet(save: GameSave, petId: string): GameSave {
  const target = save.pets.find((p) => p.id === petId);
  if (!target) return save;
  return { ...save, activePetId: petId, activeRoom: target.ballRoom };
}

/** Permanently captures a defeated 3D Survivors Boss into the player's Pokéball Box */
export function captureBossPet(
  save: GameSave,
  species: SpeciesId,
  level: number,
  now = Date.now(),
): ActionOutcome {
  if (save.pets.length >= MAX_PET_SLOTS) {
    return {
      ok: false,
      save: { ...save, coins: save.coins + 80 },
      message: '精灵球盒已满，霸主化作 +80 稀有金币奖励！',
    };
  }
  const taken = save.pets.map((p) => p.name);
  const caughtName = pickRandomPetName(species, taken);
  const newPet: PetRecord = {
    ...createPet(species, caughtName, now, 'pokeball_room'),
    level: Math.max(5, Math.min(35, Math.round(level))),
  };
  const discoveredSpecies = Array.from(new Set([...save.discoveredSpecies, species]));
  const diary = addDiary(
    save,
    newPet,
    'pokeball',
    `在 3D 野外幸存者中成功收服了霸主【${caughtName} (Lv.${newPet.level})】！`,
    now,
  );
  return {
    ok: true,
    save: {
      ...save,
      pets: [...save.pets, newPet],
      discoveredSpecies,
      diary,
    },
    message: `成功收服霸主【${caughtName} Lv.${newPet.level}】入盒！`,
  };
}
