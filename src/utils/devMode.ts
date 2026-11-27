import { useEffect, useState } from 'react';
import {
  ACCESSORY_CATALOG,
  FOOD_CATALOG,
  POKEDEX_ORDER,
  ROOM_CATALOG,
  SPECIES_CATALOG,
} from '../data/catalog';
import type {
  AccessoryId,
  FoodId,
  GameSave,
  PetRecord,
  RoomThemeId,
  SpeciesId,
} from '../types/pet';

const DEV_MODE_STORAGE_KEY = 'poke_pocket_dev_mode';
const DEV_GRANTS_STORAGE_KEY = 'poke_pocket_dev_grants';
export const DEV_VIRTUAL_PET_PREFIX = 'devpet_';
export const DEV_GRANT_FILL_COUNT = 99;

export interface DevGrantsState {
  allPets: boolean;
  allPokedex: boolean;
  allItems: boolean;
  allPokeballs: boolean;
}

const DEFAULT_DEV_GRANTS: DevGrantsState = {
  allPets: false,
  allPokedex: false,
  allItems: false,
  allPokeballs: false,
};

type DevModeListener = (enabled: boolean) => void;
type DevGrantsListener = (grants: DevGrantsState) => void;
const listeners = new Set<DevModeListener>();
const grantsListeners = new Set<DevGrantsListener>();

// Ephemeral in-memory state for debug-only edits/bonuses (never written to real save!)
let devActiveVirtualPetId: string | null = null;
const devVirtualPetPatches = new Map<string, Partial<PetRecord>>();
const devFoodUsedCounts = new Map<FoodId, number>();

export function isDevVirtualPetId(petId: string | null | undefined): boolean {
  return Boolean(petId && petId.startsWith(DEV_VIRTUAL_PET_PREFIX));
}

function computeInitialDevMode(): boolean {
  const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  if (metaEnv?.VITE_DEBUG_MODE === '1') {
    return true;
  }
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('debug') ?? params.get('dev');
      if (q === '1' || q === 'true') {
        window.localStorage.setItem(DEV_MODE_STORAGE_KEY, '1');
        return true;
      }
      if (q === '0' || q === 'false') {
        window.localStorage.removeItem(DEV_MODE_STORAGE_KEY);
        return false;
      }
      return window.localStorage.getItem(DEV_MODE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
  return false;
}

function loadInitialDevGrants(): DevGrantsState {
  if (typeof window === 'undefined') return { ...DEFAULT_DEV_GRANTS };
  try {
    const raw = window.localStorage.getItem(DEV_GRANTS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DEV_GRANTS };
    const parsed = JSON.parse(raw) as Partial<DevGrantsState>;
    return {
      allPets: Boolean(parsed.allPets),
      allPokedex: Boolean(parsed.allPokedex),
      allItems: Boolean(parsed.allItems),
      allPokeballs: Boolean(parsed.allPokeballs),
    };
  } catch {
    return { ...DEFAULT_DEV_GRANTS };
  }
}

let devModeState = computeInitialDevMode();
let devGrantsState: DevGrantsState = loadInitialDevGrants();
let devOverlayVersion = 0;

function notifyListeners() {
  listeners.forEach((fn) => fn(devModeState));
}

function notifyGrantsListeners() {
  const snap = { ...devGrantsState };
  grantsListeners.forEach((fn) => fn(snap));
}

function persistDevGrants() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEV_GRANTS_STORAGE_KEY, JSON.stringify(devGrantsState));
  } catch {
    // ignore storage failures
  }
}

export function isDevModeEnabled(): boolean {
  return devModeState;
}

export function setDevModeEnabled(next: boolean): boolean {
  devModeState = Boolean(next);
  if (!devModeState) {
    // Turning off developer mode cleanly drops ephemeral debug session overrides
    devActiveVirtualPetId = null;
    devVirtualPetPatches.clear();
    devFoodUsedCounts.clear();
  }
  if (typeof window !== 'undefined') {
    try {
      if (devModeState) window.localStorage.setItem(DEV_MODE_STORAGE_KEY, '1');
      else window.localStorage.removeItem(DEV_MODE_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }
  notifyListeners();
  notifyGrantsListeners();
  return devModeState;
}

export function toggleDevMode(): boolean {
  return setDevModeEnabled(!devModeState);
}

export function useDevMode(): [boolean, (next: boolean) => boolean] {
  const [enabled, setEnabled] = useState<boolean>(() => devModeState);
  useEffect(() => {
    const onChange: DevModeListener = (val) => setEnabled(val);
    listeners.add(onChange);
    setEnabled(devModeState);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return [enabled, setDevModeEnabled];
}

export function getDevGrants(): DevGrantsState {
  return { ...devGrantsState };
}

export function setDevGrants(patch: Partial<DevGrantsState>): DevGrantsState {
  const prev = devGrantsState;
  devGrantsState = { ...devGrantsState, ...patch };
  if (prev.allPets && !devGrantsState.allPets) {
    devActiveVirtualPetId = null;
    devVirtualPetPatches.clear();
  }
  if (!prev.allItems && devGrantsState.allItems) {
    devFoodUsedCounts.clear();
  }
  if (prev.allItems && !devGrantsState.allItems) {
    devFoodUsedCounts.clear();
  }
  devOverlayVersion += 1;
  persistDevGrants();
  notifyGrantsListeners();
  return { ...devGrantsState };
}

export function resetDevGrants(): DevGrantsState {
  return setDevGrants({ ...DEFAULT_DEV_GRANTS });
}

export function setDevActiveVirtualPetId(petId: string | null) {
  devActiveVirtualPetId = petId && isDevVirtualPetId(petId) ? petId : null;
  devOverlayVersion += 1;
  notifyGrantsListeners();
}

export function patchDevVirtualPet(petId: string, patch: Partial<PetRecord>) {
  if (!isDevVirtualPetId(petId)) return;
  const cur = devVirtualPetPatches.get(petId) ?? {};
  devVirtualPetPatches.set(petId, { ...cur, ...patch });
  devOverlayVersion += 1;
  notifyGrantsListeners();
}

export function consumeDevVirtualFood(foodId: FoodId): boolean {
  if (!devModeState || !devGrantsState.allItems) return false;
  const used = devFoodUsedCounts.get(foodId) ?? 0;
  if (used >= DEV_GRANT_FILL_COUNT) return false;
  devFoodUsedCounts.set(foodId, used + 1);
  devOverlayVersion += 1;
  notifyGrantsListeners();
  return true;
}

export function getDevFoodRemaining(foodId: FoodId, realStock: number): number {
  if (!devModeState || !devGrantsState.allItems) return realStock;
  const used = devFoodUsedCounts.get(foodId) ?? 0;
  const virtualMin = Math.max(0, DEV_GRANT_FILL_COUNT - used);
  return Math.max(realStock, virtualMin);
}

export function useDevGrants(): [DevGrantsState, number] {
  const [state, setState] = useState<{ grants: DevGrantsState; ver: number }>(() => ({
    grants: { ...devGrantsState },
    ver: devOverlayVersion,
  }));
  useEffect(() => {
    const onChange: DevGrantsListener = (next) => {
      setState({ grants: { ...next }, ver: devOverlayVersion });
    };
    grantsListeners.add(onChange);
    setState({ grants: { ...devGrantsState }, ver: devOverlayVersion });
    return () => {
      grantsListeners.delete(onChange);
    };
  }, []);
  return [state.grants, state.ver];
}

function buildVirtualDebugPet(species: SpeciesId, idx: number, baseLevel: number): PetRecord {
  const meta = SPECIES_CATALOG[species];
  const id = `${DEV_VIRTUAL_PET_PREFIX}${species}`;
  const patch = devVirtualPetPatches.get(id);
  const level = Math.max(12, Math.min(50, baseLevel));
  const base: PetRecord = {
    id,
    species,
    name: meta.defaultName,
    createdAt: 1700000000000 + idx * 1000,
    lastTickAt: Date.now(),
    level,
    xp: 0,
    hunger: 92,
    happiness: 94,
    cleanliness: 95,
    energy: 96,
    health: 100,
    poopCount: 0,
    isSleeping: false,
    isSick: false,
    accessory: 'none',
    ballRoom: 'pokeball_room',
    nature: 'adamant',
    talent: 'prodigy',
    ivs: { atk: 29, def: 27, spd: 28, charm: 28 },
    bondExp: 160,
    totalFeeds: 0,
    totalPats: 0,
    totalBaths: 0,
    totalPlays: 0,
    totalCleans: 0,
    enhanceLevel: 0,
  };
  return patch ? { ...base, ...patch } : base;
}

/**
 * Pure non-destructive overlay applied on top of real `save` for UI and gameplay.
 * Real `save` in React state & localStorage is NEVER polluted by temporary debug grants:
 * - Turning OFF any grant immediately restores the exact real state.
 * - Any Pokémon, item, or Poké Ball legitimately acquired while grants are ON
 *   continues to be persisted in real `save` and remains unlocked after turning OFF!
 */
export function applyDevGrantsOverlay(
  realSave: GameSave,
  devEnabled: boolean,
  grants: DevGrantsState,
): GameSave {
  if (!devEnabled) return realSave;
  if (!grants.allPets && !grants.allPokedex && !grants.allItems && !grants.allPokeballs) {
    return realSave;
  }

  let pets = realSave.pets;
  let activePetId = realSave.activePetId;
  let discoveredSpecies = realSave.discoveredSpecies;
  let inventory = realSave.inventory;
  let unlockedAccessories = realSave.unlockedAccessories;
  let accessoryStock = realSave.accessoryStock;
  let unlockedRooms = realSave.unlockedRooms;
  let ballStock = realSave.ballStock;

  if (grants.allPets) {
    const ownedSpecies = new Set<SpeciesId>(realSave.pets.map((p) => p.species));
    const avgLv =
      realSave.pets.length > 0
        ? Math.round(realSave.pets.reduce((acc, p) => acc + p.level, 0) / realSave.pets.length)
        : 20;
    const virtualPets: PetRecord[] = [];
    POKEDEX_ORDER.forEach((sp, idx) => {
      if (!ownedSpecies.has(sp)) {
        virtualPets.push(buildVirtualDebugPet(sp, idx, avgLv));
      }
    });
    pets = [...realSave.pets, ...virtualPets];
    if (devActiveVirtualPetId && pets.some((p) => p.id === devActiveVirtualPetId)) {
      activePetId = devActiveVirtualPetId;
    }
  }

  if (grants.allPokedex || grants.allPets) {
    discoveredSpecies = Array.from(new Set([...realSave.discoveredSpecies, ...POKEDEX_ORDER]));
  }

  if (grants.allItems) {
    const nextInv = { ...realSave.inventory };
    for (const food of FOOD_CATALOG) {
      if (food.unlimited) {
        nextInv[food.id] = Math.max(DEV_GRANT_FILL_COUNT, nextInv[food.id] ?? DEV_GRANT_FILL_COUNT);
      } else {
        const used = devFoodUsedCounts.get(food.id) ?? 0;
        const virtualMin = Math.max(0, DEV_GRANT_FILL_COUNT - used);
        nextInv[food.id] = Math.max(nextInv[food.id] ?? 0, virtualMin);
      }
    }
    inventory = nextInv;

    const nextAccStock = { ...realSave.accessoryStock };
    const allAccIds: AccessoryId[] = [];
    for (const acc of ACCESSORY_CATALOG) {
      allAccIds.push(acc.id);
      if (acc.id !== 'none') {
        nextAccStock[acc.id] = Math.max(nextAccStock[acc.id] ?? 0, DEV_GRANT_FILL_COUNT);
      }
    }
    accessoryStock = nextAccStock;
    unlockedAccessories = Array.from(new Set([...realSave.unlockedAccessories, ...allAccIds]));
  }

  if (grants.allPokeballs) {
    const nextBallStock = { ...realSave.ballStock };
    const allRoomIds: RoomThemeId[] = [];
    for (const rm of ROOM_CATALOG) {
      allRoomIds.push(rm.id);
      if (rm.id !== 'pokeball_room') {
        nextBallStock[rm.id] = Math.max(nextBallStock[rm.id] ?? 0, DEV_GRANT_FILL_COUNT);
      }
    }
    ballStock = nextBallStock;
    unlockedRooms = Array.from(new Set([...realSave.unlockedRooms, ...allRoomIds]));
  }

  return {
    ...realSave,
    pets,
    activePetId,
    discoveredSpecies,
    inventory,
    unlockedAccessories,
    accessoryStock,
    unlockedRooms,
    ballStock,
  };
}

/**
 * Cleanly sanitizes real `save` whenever debug grants are turned OFF or debug mode is exited:
 * - Drops any leftover virtual pet IDs from `meta.squadPresets`
 * - Unequips any accessory beyond real owned `accessoryStock`
 * - Resets any `ballRoom` beyond real owned `ballStock`
 * Never deletes real pets, real discoveredSpecies, or real purchased items!
 */
export function sanitizeRealSaveAfterDevRollback(
  realSave: GameSave,
  activeGrants: DevGrantsState,
  devEnabled: boolean,
): GameSave {
  const allowPets = devEnabled && activeGrants.allPets;
  const allowItems = devEnabled && activeGrants.allItems;
  const allowBalls = devEnabled && activeGrants.allPokeballs;

  let changed = false;
  let nextPets = realSave.pets;
  let nextMeta = realSave.meta;

  if (!allowItems) {
    const usedAcc: Partial<Record<AccessoryId, number>> = {};
    nextPets = nextPets.map((p) => {
      if (!p.accessory || p.accessory === 'none') return p;
      const owned = realSave.accessoryStock?.[p.accessory] ?? 0;
      const used = usedAcc[p.accessory] ?? 0;
      if (used < owned) {
        usedAcc[p.accessory] = used + 1;
        return p;
      }
      changed = true;
      return { ...p, accessory: 'none' };
    });
  }

  if (!allowBalls) {
    const usedBall: Partial<Record<RoomThemeId, number>> = {};
    nextPets = nextPets.map((p) => {
      const rm = p.ballRoom ?? 'pokeball_room';
      if (rm === 'pokeball_room') return p;
      const owned = realSave.ballStock?.[rm] ?? 0;
      const used = usedBall[rm] ?? 0;
      if (used < owned) {
        usedBall[rm] = used + 1;
        return p;
      }
      changed = true;
      return { ...p, ballRoom: 'pokeball_room' };
    });
  }

  if (!allowPets && realSave.meta?.squadPresets) {
    const hasVirtual = realSave.meta.squadPresets.some((pr) =>
      pr.petIds.some((id) => isDevVirtualPetId(id)),
    );
    if (hasVirtual) {
      changed = true;
      nextMeta = {
        ...realSave.meta,
        squadPresets: realSave.meta.squadPresets.map((pr) => ({
          ...pr,
          petIds: pr.petIds.filter((id) => !isDevVirtualPetId(id)),
        })),
      };
    }
  }

  if (!changed) return realSave;
  return {
    ...realSave,
    pets: nextPets,
    meta: nextMeta,
  };
}

// Expose scriptable global hook for AI / developer verification tools
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__POKE_POCKET_DEBUG__ = {
    enable: () => setDevModeEnabled(true),
    disable: () => setDevModeEnabled(false),
    toggle: () => toggleDevMode(),
    isEnabled: () => isDevModeEnabled(),
    getGrants: () => getDevGrants(),
    setGrants: (patch: Partial<DevGrantsState>) => setDevGrants(patch),
    resetGrants: () => resetDevGrants(),
  };
}
