import type { PixelIconName } from '../data/pixelIcons';

export type SpeciesId =
  | 'pikachu'
  | 'charmander'
  | 'bulbasaur'
  | 'squirtle'
  | 'eevee'
  | 'jigglypuff'
  | 'psyduck'
  | 'meowth'
  | 'gastly'
  | 'munchlax'
  | 'dratini'
  | 'mew'
  | 'caterpie'
  | 'pidgey'
  | 'vulpix'
  | 'diglett'
  | 'growlithe'
  | 'abra'
  | 'machop'
  | 'geodude'
  | 'scyther'
  | 'magikarp'
  | 'lapras'
  | 'mewtwo'
  | 'weedle'
  | 'sandshrew'
  | 'nidoran'
  | 'clefairy'
  | 'oddish'
  | 'poliwag'
  | 'ponyta'
  | 'slowpoke'
  | 'magnemite'
  | 'shellder'
  | 'onix'
  | 'cubone'
  | 'rhyhorn'
  | 'chansey'
  | 'horsea'
  | 'staryu'
  | 'electabuzz'
  | 'magmar'
  | 'porygon'
  | 'aerodactyl'
  | 'articuno'
  | 'zapdos'
  | 'moltres';

export type PokemonElement =
  | 'electric'
  | 'fire'
  | 'grass'
  | 'water'
  | 'normal'
  | 'fairy'
  | 'ghost'
  | 'dragon'
  | 'psychic';

export type RarityTier = 'R' | 'SR' | 'SSR';

export type GachaBoxId = 'normal_box' | 'great_box' | 'master_box';

export type GrowthStage = 'baby' | 'teen' | 'adult';

export type PetMood =
  | 'ecstatic'
  | 'happy'
  | 'normal'
  | 'hungry'
  | 'sleepy'
  | 'dirty'
  | 'sick'
  | 'sleeping';

export type ActionAnim =
  | 'idle'
  | 'happy'
  | 'patting'
  | 'recalling'
  | 'eating'
  | 'bathing'
  | 'playing'
  | 'sleeping'
  | 'medicine'
  | 'levelup';

export type ShellThemeId =
  | 'pikachu_yellow'
  | 'pokeball_red'
  | 'crystal_blue'
  | 'gengar_purple';

export type RoomThemeId =
  | 'pokeball_room'
  | 'healball_room'
  | 'greatball_room'
  | 'nestball_room'
  | 'diveball_room'
  | 'ultraball_room'
  | 'duskball_room'
  | 'luxuryball_room'
  | 'masterball_room';

export type AccessoryId =
  | 'none'
  | 'sprout'
  | 'bow'
  | 'charcoal'
  | 'mystic_water'
  | 'magnet'
  | 'silk_scarf'
  | 'scarf'
  | 'metronome'
  | 'shades'
  | 'focus_band'
  | 'quick_claw'
  | 'focus_sash'
  | 'tophat'
  | 'scope_lens'
  | 'everstone'
  | 'bright_powder'
  | 'shell_bell'
  | 'destiny_knot'
  | 'leftovers'
  | 'life_orb'
  | 'crown'
  | 'exp_share'
  | 'amulet_coin'
  | 'lucky_egg';

export type FoodId =
  | 'oran_berry'
  | 'pecha_berry'
  | 'cheri_berry'
  | 'chesto_berry'
  | 'sitrus_berry'
  | 'moomoo_milk'
  | 'lum_berry'
  | 'pokepuff'
  | 'casteliacone'
  | 'curry'
  | 'rage_candy'
  | 'rare_candy';

export interface CaptureRevealPayload {
  species: SpeciesId;
  name: string;
  sprite: string;
  level: number;
  isShiny: boolean;
  isNewSpecies: boolean;
  dexNo: string;
  typeLabel: string;
  typeColor: string;
  lore: string;
  heightM: number;
  weightKg: number;
  qualityLabel: string;
  qualityColor: string;
}

export type LcdMode =
  | 'home'
  | 'recalled'
  | 'battle'
  | 'survivors'
  | 'tactics'
  | 'menu'
  | 'bag'
  | 'market'
  | 'party'
  | 'squad'
  | 'party_detail'
  | 'pokedex'
  | 'pokedex_detail'
  | 'play_menu'
  | 'game_catch'
  | 'game_peekaboo'
  | 'achievements'
  | 'diary'
  | 'news'
  | 'profile'
  | 'guide'
  | 'feedback'
  | 'capture_result'
  | 'map'
  | 'settings';

export type NatureId =
  | 'adamant'
  | 'jolly'
  | 'gentle'
  | 'timid'
  | 'relaxed'
  | 'naughty'
  | 'serious'
  | 'naive';

export type TalentId =
  | 'prodigy'
  | 'lucky'
  | 'gourmet'
  | 'sweetheart'
  | 'energetic'
  | 'clean_freak'
  | 'tough'
  | 'shiny_soul';

export interface PetIVs {
  atk: number;
  def: number;
  spd: number;
  charm: number;
}

export type IvRank = 'B' | 'A' | 'S' | 'SS';

export type PetSkinId = 'classic' | 'shiny' | 'magma' | 'blue_flame' | 'sakura' | 'solar_pharaoh';

export interface PetRecord {
  id: string;
  name: string;
  species: SpeciesId;
  nature?: NatureId;
  talent?: TalentId;
  ivs?: PetIVs;
  createdAt: number;
  lastTickAt: number;
  hunger: number;
  happiness: number;
  cleanliness: number;
  energy: number;
  health: number;
  xp: number;
  level: number;
  isSleeping: boolean;
  isSick: boolean;
  poopCount: number;
  accessory: AccessoryId;
  ballRoom: RoomThemeId;
  totalFeeds: number;
  totalBaths: number;
  totalPlays: number;
  totalPats: number;
  totalCleans: number;
  /** Direct training enhancement level in Pet Detail (+6% ATK/HP per level) */
  enhanceLevel?: number;
  /** Pinned Survivor skills guaranteed in 3D runs (slots scale with Level & IV Rank) */
  pinnedSkills?: string[];
  /** Banished Survivor skills excluded from this pet's 3D skill pool (slots scale with Level & IV Rank) */
  bannedSkills?: string[];
  skin?: PetSkinId;
}

export interface DiaryEntry {
  id: string;
  timestamp: number;
  petId: string;
  petName: string;
  badge: string;
  text: string;
}

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  confirm: string;
  cancel: string;
  menu: string;
  party: string;
}

export type BossHpDisplayMode = 'hp' | 'pct';
export type GraphicsQualityMode = 'high' | 'medium' | 'low';
export type EnemyDisplayMode = 'all' | 'near' | 'very_near' | 'shadow_only';

export type AppLanguage = 'zh' | 'en' | 'ja';

export interface GamePrefs {
  language?: AppLanguage;
  // Audio extras
  masterVolume: number; // 0..100
  muteOnBlur: boolean;
  // HUD & Interface
  hudScale: number; // 75..125 (%)
  hudOpacity: number; // 40..100 (%)
  bossBarOpacity: number; // 35..100 (%)
  bossHpMode: BossHpDisplayMode;
  largeBanners: boolean;
  bossAlerts: boolean;
  showDamageNumbers: boolean;
  showComboCounter: boolean;
  // Graphics & Performance
  graphicsQuality: GraphicsQualityMode;
  powerSaver: boolean;
  fpsLimit: 0 | 30 | 60 | 90 | 120;
  screenShake: boolean;
  shakeIntensity: number; // 0..100 (%)
  vfxOpacity: number; // 20..100 (%)
  playerAttackOpacity: number; // 15..100 (%)
  hidePlayerAttacks: boolean;
  enemyDisplayMode: EnemyDisplayMode;
  reduceFlashes: boolean;
  showFps: boolean;
}

export const DEFAULT_GAME_PREFS: GamePrefs = {
  language: 'zh',
  masterVolume: 80,
  muteOnBlur: true,
  hudScale: 100,
  hudOpacity: 100,
  bossBarOpacity: 100,
  bossHpMode: 'hp',
  largeBanners: true,
  bossAlerts: true,
  showDamageNumbers: true,
  showComboCounter: true,
  graphicsQuality: 'high',
  powerSaver: false,
  fpsLimit: 0,
  screenShake: true,
  shakeIntensity: 100,
  vfxOpacity: 100,
  playerAttackOpacity: 100,
  hidePlayerAttacks: false,
  enemyDisplayMode: 'all',
  reduceFlashes: false,
  showFps: false,
};

export interface TrainerProfile {
  name: string;
  title: string;
  bio: string;
  badge: string;
}

export const DEFAULT_TRAINER_PROFILE: TrainerProfile = {
  name: '训练家赤红',
  title: '关都新锐训练家',
  bio: '带上伙伴，在阶梯原野开启像素冒险！',
  badge: 'trophy',
};

import type { MetaProgressState } from '../data/metaProgression';

export interface GameSave {
  version: 2;
  coins: number;
  stamina: number;
  maxStamina: number;
  lastStaminaAt: number;
  pets: PetRecord[];
  activePetId: string | null;
  discoveredSpecies: SpeciesId[];
  inventory: Record<FoodId, number>;
  unlockedAccessories: AccessoryId[];
  accessoryStock: Record<AccessoryId, number>;
  unlockedRooms: RoomThemeId[];
  ballStock: Record<RoomThemeId, number>;
  activeRoom: RoomThemeId;
  shellTheme: ShellThemeId;
  showShell: boolean;
  muted: boolean;
  sfxVolume: number;
  bgmEnabled: boolean;
  bgmVolume: number;
  cryEnabled?: boolean;
  cryVolume?: number;
  combatSfxEnabled?: boolean;
  prefs?: Partial<GamePrefs>;
  trainerProfile?: Partial<TrainerProfile>;
  meta?: MetaProgressState;
  keyBindings: KeyBindings;
  unlockedAchievements: string[];
  diary: DiaryEntry[];
  miniGameBestCatch: number;
  miniGameWins: number;
}

export interface FloatingEffect {
  id: string;
  kind: 'heart' | 'sparkle' | 'bubble' | 'coin' | 'xp' | 'crumb' | 'note';
  icon?: PixelIconName;
  text: string;
  x: number;
  y: number;
}
