import type { GrowthStage, SpeciesId } from '../types/pet';
import { SPECIES_CATALOG_PART1, type SpeciesMeta } from './catalog/speciesKanto';
import { SPECIES_CATALOG_PART2, POKEDEX_ORDER } from './catalog/speciesRegional';

export * from './catalog/naturesAndMetrics';
export type { SpeciesMeta };
export { POKEDEX_ORDER };
export const SPECIES_CATALOG = {
  ...SPECIES_CATALOG_PART1,
  ...SPECIES_CATALOG_PART2,
} as Record<SpeciesId, SpeciesMeta>;
export * from './catalog/itemsAndThemes';

export {
  ACHIEVEMENTS,
  buildAchievementContext,
  type AchievementCategory,
  type AchievementEvalContext,
  type AchievementMeta,
} from './achievements';

export const MAX_POKEMON_LEVEL = 100;

export function getGrowthStage(level: number, species?: SpeciesId): GrowthStage {
  const levels = species ? SPECIES_CATALOG[species].evoLevels : { teen: 16, adult: 36 };
  if (level >= levels.adult) return 'adult';
  if (level >= levels.teen) return 'teen';
  return 'baby';
}

export function getPokemonStageName(species: SpeciesId, level: number): string {
  const stage = getGrowthStage(level, species);
  return SPECIES_CATALOG[species].stageNames[stage];
}

export function getPokemonDexNo(species: SpeciesId, level: number): string {
  const stage = getGrowthStage(level, species);
  return SPECIES_CATALOG[species].stageDexNos[stage];
}

export function getPokemonCryId(species: SpeciesId, level = 5): number {
  const dexStr = getPokemonDexNo(species, level).replace('#', '');
  return Number.parseInt(dexStr, 10) || 25;
}

export function getNextEvolutionHint(species: SpeciesId, level: number): string {
  const meta = SPECIES_CATALOG[species];
  const stage = getGrowthStage(level, species);
  if (species === 'mew') return '幻之宝可梦';
  if (stage === 'baby') {
    return `Lv.${meta.evoLevels.teen} 进化为${meta.stageNames.teen}`;
  }
  if (stage === 'teen' && meta.evoLevels.adult > meta.evoLevels.teen) {
    return `Lv.${meta.evoLevels.adult} 进化为${meta.stageNames.adult}`;
  }
  return '最终进化';
}

export function getStageLabel(stage: GrowthStage): string {
  if (stage === 'adult') return '最终形态';
  if (stage === 'teen') return '一阶进化';
  return '初始形态';
}

export function getXpForNextLevel(level: number): number {
  if (level >= MAX_POKEMON_LEVEL) return 999999;
  return 80 + level * 22 + Math.round(level * level * 1.2);
}

