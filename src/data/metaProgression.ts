import type { BiomeId } from './worldTextures3D';
import type { DifficultyId, SurvivorSkillId } from './survivorsTactics';
import type { WorldTourState } from './worldTour';

export type LabUpgradeId =
  | 'training'
  | 'vitality'
  | 'agility'
  | 'study'
  | 'trade'
  | 'fortune'
  | 'magnet'
  | 'leftovers'
  | 'haste'
  | 'reroll'
  | 'squad_cap'
  | 'revives'
  | 'crit_rate'
  | 'armor'
  | 'catch_master'
  | 'supply_pack';

export interface LabUpgradeDef {
  id: LabUpgradeId;
  name: string;
  desc: string;
  perLevelLabel: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  icon: string;
  accent: string;
}

export const LAB_UPGRADES: LabUpgradeDef[] = [
  {
    id: 'training',
    name: '训练',
    desc: '强化主角与全队随从的基础伤害输出。',
    perLevelLabel: '每级伤害 +5%',
    maxLevel: 10,
    baseCost: 60,
    costStep: 45,
    icon: '/sprites/items/life-orb.png',
    accent: '#e03131',
  },
  {
    id: 'vitality',
    name: '韧性',
    desc: '提升主角出战时的最大生命值上限。',
    perLevelLabel: '每级最大 HP +14',
    maxLevel: 10,
    baseCost: 60,
    costStep: 45,
    icon: '/sprites/items/sitrus-berry.png',
    accent: '#2f9e44',
  },
  {
    id: 'agility',
    name: '敏捷',
    desc: '提升 3D 野外探索与走位躲弹幕的移动速度。',
    perLevelLabel: '每级移速 +2.5%',
    maxLevel: 10,
    baseCost: 70,
    costStep: 50,
    icon: '/sprites/items/choice-scarf.png',
    accent: '#22b8cf',
  },
  {
    id: 'study',
    name: '钻研',
    desc: '提升对局中获取的经验值效率，更快成型。',
    perLevelLabel: '每级经验 +6%',
    maxLevel: 10,
    baseCost: 70,
    costStep: 55,
    icon: '/sprites/items/lucky-egg.png',
    accent: '#7950f2',
  },
  {
    id: 'trade',
    name: '贸易',
    desc: '增加野外拾取与通关结算获得的宝可币。',
    perLevelLabel: '每级金币 +10%',
    maxLevel: 10,
    baseCost: 65,
    costStep: 50,
    icon: '/sprites/items/amulet-coin.png',
    accent: '#f59f00',
  },
  {
    id: 'fortune',
    name: '财运',
    desc: '提升星星沙子结算倍率与幸运暴击触发率。',
    perLevelLabel: '每级星沙 +8% / 幸运 +1.5%',
    maxLevel: 10,
    baseCost: 85,
    costStep: 65,
    icon: '/sprites/items/kings-rock.png',
    accent: '#ae3ec9',
  },
  {
    id: 'magnet',
    name: '磁力',
    desc: '大幅扩张经验水晶与金币的自动吸附半径。',
    perLevelLabel: '每级拾取范围 +0.7',
    maxLevel: 10,
    baseCost: 55,
    costStep: 42,
    icon: '/sprites/items/magnet.png',
    accent: '#1971c2',
  },
  {
    id: 'leftovers',
    name: '吃剩的东西',
    desc: '战斗中每秒持续回复主角生命值。',
    perLevelLabel: '每级再生 +0.5 HP/秒',
    maxLevel: 10,
    baseCost: 75,
    costStep: 55,
    icon: '/sprites/items/leftovers.png',
    accent: '#40c057',
  },
  {
    id: 'haste',
    name: '迅捷',
    desc: '缩短全队宝可梦招式冷却，火力更密集。',
    perLevelLabel: '每级攻速 +3%',
    maxLevel: 10,
    baseCost: 100,
    costStep: 75,
    icon: '/sprites/items/quick-claw.png',
    accent: '#fd7e14',
  },
  {
    id: 'reroll',
    name: '刷新',
    desc: '每次升级选卡时增加免费的选项刷新次数。',
    perLevelLabel: '每级刷新次数 +1',
    maxLevel: 8,
    baseCost: 90,
    costStep: 70,
    icon: '/sprites/items/vs-seeker.png',
    accent: '#3b5bdb',
  },
  {
    id: 'squad_cap',
    name: '携带上限',
    desc: '扩充 3D 野外探索时最多可同时上阵跟随的宝可梦数量。',
    perLevelLabel: '每级携带上限 +1',
    maxLevel: 4,
    baseCost: 180,
    costStep: 150,
    icon: '/sprites/items/ultra-ball.png',
    accent: '#e03131',
  },
  {
    id: 'revives',
    name: '气势披带·复活',
    desc: '主角体力归零时自动原地满血爆发震退敌群并获得短暂无敌。',
    perLevelLabel: '每级复活次数 +1',
    maxLevel: 5,
    baseCost: 180,
    costStep: 160,
    icon: '/sprites/items/focus-sash.png',
    accent: '#f08c00',
  },
  {
    id: 'crit_rate',
    name: '焦点会心',
    desc: '提升主角与全队随从所有招式触发要害暴击的概率。',
    perLevelLabel: '每级暴击率 +3.5%',
    maxLevel: 8,
    baseCost: 85,
    costStep: 60,
    icon: '/sprites/items/scope-lens.png',
    accent: '#d6336c',
  },
  {
    id: 'armor',
    name: '磐石护甲',
    desc: '强化训练师防具韧性，按百分比减免野怪碰撞与首领弹幕伤害。',
    perLevelLabel: '每级受伤减免 -4%',
    maxLevel: 8,
    baseCost: 80,
    costStep: 60,
    icon: '/sprites/items/focus-band.png',
    accent: '#495057',
  },
  {
    id: 'catch_master',
    name: '收服大师',
    desc: '提高野外投掷精灵球的收服成功率，并延长击晕精灵的留存时间。',
    perLevelLabel: '每级收服率 +4% / 留存 +20%',
    maxLevel: 8,
    baseCost: 90,
    costStep: 65,
    icon: '/sprites/items/master-ball.png',
    accent: '#7048e8',
  },
  {
    id: 'supply_pack',
    name: '冒险补给包',
    desc: '每次出发探险时额外携带伤药补给次数，续航更持久。',
    perLevelLabel: '每级初始伤药 +1',
    maxLevel: 10,
    baseCost: 65,
    costStep: 50,
    icon: '/sprites/items/super-potion.png',
    accent: '#12b886',
  },
];

export function getLabUpgradeCost(def: LabUpgradeDef, currentLv: number): number {
  const linear = def.baseCost + currentLv * def.costStep;
  const quad = Math.round(def.costStep * 0.42 * currentLv * currentLv);
  const tierMult = currentLv >= 7 ? 1.35 : currentLv >= 4 ? 1.15 : 1;
  return Math.round(((linear + quad) * tierMult) / 5) * 5;
}

export function getLabUpgradeEffectSummary(id: LabUpgradeId, lv: number): string {
  const n = Math.max(0, lv);
  switch (id) {
    case 'training':
      return `伤害 +${n * 5}%`;
    case 'vitality':
      return `最大 HP +${n * 14}`;
    case 'agility':
      return `移速 +${+(n * 2.5).toFixed(1)}%`;
    case 'study':
      return `经验 +${n * 6}%`;
    case 'trade':
      return `金币 +${n * 10}%`;
    case 'fortune':
      return `星沙 +${n * 8}% / 幸运 +${+(n * 1.5).toFixed(1)}%`;
    case 'magnet':
      return `拾取范围 +${+(n * 0.7).toFixed(1)}`;
    case 'leftovers':
      return `再生 +${+(n * 0.5).toFixed(1)} HP/秒`;
    case 'haste':
      return `攻速 +${n * 3}%`;
    case 'reroll':
      return `刷新次数 +${n}`;
    case 'squad_cap':
      return `携带上限 +${n}`;
    case 'revives':
      return `复活次数 +${n}`;
    case 'crit_rate':
      return `暴击率 +${+(n * 3.5).toFixed(1)}%`;
    case 'armor':
      return `受伤减免 -${n * 4}%`;
    case 'catch_master':
      return `收服率 +${n * 4}% / 留存 +${n * 20}%`;
    case 'supply_pack':
      return `初始伤药 +${n}`;
  }
}

export type HeroId = 'red' | 'misty' | 'brock' | 'blue';

export interface HeroExclusiveSkillDef {
  id: string;
  name: string;
  desc: string;
  evolvedName: string;
  evolvedDesc: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
  icon: string;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  bio: string;
  unlockCost: number;
  avatarSprite: string;
  tintHex: number;
  accentColor: string;
  baseHpBonus: number;
  baseSpeedBonus: number;
  baseAtkBonus: number;
  evolutionTitles: [string, string, string]; // Lv0-3, Lv4-7, Lv8-10 (Awakened!)
  skills: [HeroExclusiveSkillDef, HeroExclusiveSkillDef];
}

export const HERO_ROSTER: HeroDef[] = [
  {
    id: 'red',
    name: '赤红',
    title: '新手训练师',
    bio: '满怀热忱出发的新手训练师，擅长鼓舞全队爆发攻速与精准精灵球震荡打击。',
    unlockCost: 0,
    avatarSprite: '/sprites/heroes/hero-red-avatar.png',
    tintHex: 0xffffff,
    accentColor: '#e03131',
    baseHpBonus: 0,
    baseSpeedBonus: 0,
    baseAtkBonus: 0.05,
    evolutionTitles: ['新手训练师', '王牌指挥官', '传奇冠军形态'],
    skills: [
      {
        id: 'red_command',
        name: '王牌指挥',
        desc: '全队随从冷却缩短 4%/级，伤害 +4%/级。',
        evolvedName: '冠军领域·极',
        evolvedDesc: '满级觉醒！全队伤害额外 +18%，暴击率显著跃升！',
        maxLevel: 5,
        baseCost: 60,
        costStep: 45,
        icon: '/sprites/items/exp-share.png',
      },
      {
        id: 'red_ball_burst',
        name: '蓄力投球',
        desc: '每 5 秒自动向最近强敌投出震荡精灵球造成范围伤害。',
        evolvedName: '大师球冲击波',
        evolvedDesc: '满级觉醒！每次投掷 3 枚穿透震荡大师球并触发范围爆炸！',
        maxLevel: 5,
        baseCost: 65,
        costStep: 50,
        icon: '/sprites/items/master-ball.png',
      },
    ],
  },
  {
    id: 'misty',
    name: '小霞',
    title: '华蓝水系大师',
    bio: '灵动与续航兼备的水系馆主，持续释放潮汐护盾与治愈水幕。',
    unlockCost: 160,
    avatarSprite: '/sprites/heroes/hero-misty-avatar.png',
    tintHex: 0xd0ebff,
    accentColor: '#1c7ed6',
    baseHpBonus: 15,
    baseSpeedBonus: 0.06,
    baseAtkBonus: 0,
    evolutionTitles: ['华蓝道馆馆主', '碧海涌潮使者', '沧海圣泉觉醒'],
    skills: [
      {
        id: 'misty_tide',
        name: '激流潮汐',
        desc: '周期性释放水之环形波动，击退并重创周围敌群。',
        evolvedName: '海皇暴流',
        evolvedDesc: '满级觉醒！潮汐半径翻倍且冷却大幅缩短，清怪如潮！',
        maxLevel: 5,
        baseCost: 60,
        costStep: 45,
        icon: '/sprites/items/mystic-water.png',
      },
      {
        id: 'misty_heal',
        name: '治愈水幕',
        desc: '每 8 秒回复主角 3%/级 生命值并提升移动灵活度。',
        evolvedName: '圣泉庇护',
        evolvedDesc: '满级觉醒！回复量翻倍并永久附加额外最大生命上限！',
        maxLevel: 5,
        baseCost: 65,
        costStep: 50,
        icon: '/sprites/items/dive-ball.png',
      },
    ],
  },
  {
    id: 'brock',
    name: '小刚',
    title: '尼比磐石铁壁',
    bio: '高耐久重装指挥官，硬抗弹幕并以落地岩震碾碎包围圈。',
    unlockCost: 220,
    avatarSprite: '/sprites/heroes/hero-brock-avatar.png',
    tintHex: 0xffe8cc,
    accentColor: '#d97724',
    baseHpBonus: 45,
    baseSpeedBonus: -0.02,
    baseAtkBonus: 0.06,
    evolutionTitles: ['尼比岩石馆主', '坚岩壁垒守卫', '泰坦大地觉醒'],
    skills: [
      {
        id: 'brock_armor',
        name: '岩崩护壁',
        desc: '减免 5%/级 所受伤害，且受击无敌时间延长。',
        evolvedName: '大地壁垒',
        evolvedDesc: '满级觉醒！伤害减免达 35% 并周期性获得坚韧回血！',
        maxLevel: 5,
        baseCost: 60,
        costStep: 45,
        icon: '/sprites/items/focus-band.png',
      },
      {
        id: 'brock_quake',
        name: '重锤震地',
        desc: '每次 3D 跳跃落地时向四周震出岩石冲击波！',
        evolvedName: '泰坦裂地',
        evolvedDesc: '满级觉醒！落地触发双倍半径巨岩震荡，强力清场！',
        maxLevel: 5,
        baseCost: 65,
        costStep: 50,
        icon: '/sprites/items/everstone.png',
      },
    ],
  },
  {
    id: 'blue',
    name: '小茂',
    title: '天才劲敌战略家',
    bio: '极限输出与猎杀首领的战术大师，主打高频连携与暴击穿透。',
    unlockCost: 320,
    avatarSprite: '/sprites/heroes/hero-blue-avatar.png',
    tintHex: 0xe5dbff,
    accentColor: '#7950f2',
    baseHpBonus: 0,
    baseSpeedBonus: 0.08,
    baseAtkBonus: 0.14,
    evolutionTitles: ['关都天才劲敌', '常磐战术鬼才', '宿命终焉形态'],
    skills: [
      {
        id: 'blue_combo',
        name: '双倍连击',
        desc: '提升 6%/级 暴击连击伤害并加快随从行动节奏。',
        evolvedName: '无限连携',
        evolvedDesc: '满级觉醒！暴击倍率飙升并永久缩短全队 14% 冷却！',
        maxLevel: 5,
        baseCost: 70,
        costStep: 55,
        icon: '/sprites/items/scope-lens.png',
      },
      {
        id: 'blue_slayer',
        name: '弱点洞察',
        desc: '对训练师与区域守护者首领造成额外 10%/级 伤害。',
        evolvedName: '宿命终结',
        evolvedDesc: '满级觉醒！对首领伤害额外 +75%，击杀首领双倍星沙！',
        maxLevel: 5,
        baseCost: 75,
        costStep: 55,
        icon: '/sprites/items/black-glasses.png',
      },
    ],
  },
];

export function getHeroDef(id: HeroId): HeroDef {
  return HERO_ROSTER.find((h) => h.id === id) ?? HERO_ROSTER[0];
}

export function getHeroEvolutionStage(
  heroId: HeroId,
  heroSkillLevels: Record<string, number>,
): { tier: 0 | 1 | 2; title: string; totalSkillLv: number; maxSkillLv: number } {
  const def = getHeroDef(heroId);
  const lv0 = heroSkillLevels[def.skills[0].id] ?? 0;
  const lv1 = heroSkillLevels[def.skills[1].id] ?? 0;
  const total = lv0 + lv1;
  const tier: 0 | 1 | 2 = total >= 8 ? 2 : total >= 4 ? 1 : 0;
  return {
    tier,
    title: def.evolutionTitles[tier],
    totalSkillLv: total,
    maxSkillLv: def.skills[0].maxLevel + def.skills[1].maxLevel,
  };
}

export type BountyMetric =
  | 'kills'
  | 'bosses'
  | 'runs_cleared'
  | 'coins_earned'
  | 'damage_dealt'
  | 'upgrades_picked'
  | 'gacha_or_care';

export interface BountySlot {
  id: string;
  tier: 'easy' | 'medium' | 'hard' | 'weekly_1' | 'weekly_2' | 'weekly_3';
  tierLabel: string;
  title: string;
  desc: string;
  metric: BountyMetric;
  target: number;
  progress: number;
  rewardStardust: number;
  icon: string;
  claimed: boolean;
}

export type TrainerTagId =
  | 'rookie_trainer'
  | 'forest_ranger'
  | 'gym_challenger'
  | 'gym_leader'
  | 'elite_four'
  | 'kanto_champion';

export interface TrainerTagDef {
  id: TrainerTagId;
  name: string;
  tierLabel: string;
  color: string;
  icon: string;
  unlockText: string;
  perkText: string;
  targetElements?: string[];
  atkBonus: number;
  hpPctBonus: number;
  cdMultBonus: number;
  speedBonus: number;
  bossBonus: number;
  coinBonus: number;
}

export const TRAINER_TAG_CATALOG: TrainerTagDef[] = [
  {
    id: 'rookie_trainer',
    name: '见习训练师',
    tierLabel: 'Lv.1',
    color: '#4dabf7',
    icon: '/sprites/items/poke-ball.png',
    unlockText: '初始解锁',
    perkText: '全属性宝可梦 生命 +8%、攻击 +5%',
    atkBonus: 0.05,
    hpPctBonus: 0.08,
    cdMultBonus: 1.0,
    speedBonus: 0,
    bossBonus: 0,
    coinBonus: 0,
  },
  {
    id: 'forest_ranger',
    name: '进阶训练师',
    tierLabel: 'Lv.2',
    color: '#51cf66',
    icon: '/sprites/items/miracle-seed.png',
    unlockText: '累计击败 60 只宝可梦',
    perkText: '草 / 电 / 一般系宝可梦 攻击 +16%、移速 +6%',
    targetElements: ['grass', 'electric', 'normal'],
    atkBonus: 0.16,
    hpPctBonus: 0.05,
    cdMultBonus: 0.97,
    speedBonus: 0.06,
    bossBonus: 0,
    coinBonus: 0.05,
  },
  {
    id: 'gym_challenger',
    name: '精英训练师',
    tierLabel: 'Lv.3',
    color: '#ff922b',
    icon: '/sprites/items/great-ball.png',
    unlockText: '获得任意 1 枚道馆徽章',
    perkText: '对守护者/精英伤害 +18%、全队冷却 -6%',
    atkBonus: 0.08,
    hpPctBonus: 0.1,
    cdMultBonus: 0.94,
    speedBonus: 0.03,
    bossBonus: 0.18,
    coinBonus: 0.08,
  },
  {
    id: 'gym_leader',
    name: '王牌训练师',
    tierLabel: 'Lv.4',
    color: '#ae3ec9',
    icon: '/sprites/items/ultra-ball.png',
    unlockText: '累计获得 3 枚道馆徽章',
    perkText: '全属性宝可梦 攻击 +16%、生命 +15%、冷却 -8%',
    atkBonus: 0.16,
    hpPctBonus: 0.15,
    cdMultBonus: 0.92,
    speedBonus: 0.04,
    bossBonus: 0.12,
    coinBonus: 0.12,
  },
  {
    id: 'elite_four',
    name: '大师训练师',
    tierLabel: 'Lv.5',
    color: '#f03e3e',
    icon: '/sprites/items/kings-rock.png',
    unlockText: '累计获得 5 枚道馆徽章',
    perkText: '火 / 水 / 幽灵 / 龙系 攻击 +24%、金币 +20%',
    targetElements: ['fire', 'water', 'ghost', 'dragon', 'psychic'],
    atkBonus: 0.24,
    hpPctBonus: 0.18,
    cdMultBonus: 0.9,
    speedBonus: 0.05,
    bossBonus: 0.2,
    coinBonus: 0.2,
  },
  {
    id: 'kanto_champion',
    name: '冠军训练师',
    tierLabel: 'Lv.6',
    color: '#ffd43b',
    icon: '/sprites/items/master-ball.png',
    unlockText: '累计获得 6 枚道馆徽章',
    perkText: '全属性宝可梦 攻击 +28%、生命 +25%、冷却 -12%',
    atkBonus: 0.28,
    hpPctBonus: 0.25,
    cdMultBonus: 0.88,
    speedBonus: 0.08,
    bossBonus: 0.25,
    coinBonus: 0.25,
  },
];

export type GymBadgeCategory = 'kanto' | 'tour' | 'master';

export type GymBadgeId =
  | 'boulder_badge'
  | 'cascade_badge'
  | 'thunder_badge'
  | 'rainbow_badge'
  | 'soul_badge'
  | 'marsh_badge'
  | 'volcano_badge'
  | 'earth_badge'
  | 'shanghai_pearl_badge'
  | 'beijing_dragon_badge'
  | 'tokyo_neon_badge'
  | 'kyoto_sakura_badge'
  | 'seoul_star_badge'
  | 'taipei_cloud_badge'
  | 'shiny_hunter_badge'
  | 'dex_professor_badge'
  | 'league_champion_badge'
  | (string & {});

export const MAX_SHOWCASE_BADGES = 6;
export const DEFAULT_SHOWCASE_BADGE_IDS: GymBadgeId[] = [
  'boulder_badge',
  'cascade_badge',
  'thunder_badge',
  'rainbow_badge',
  'volcano_badge',
  'earth_badge',
];

export interface GymBadgeDef {
  id: GymBadgeId;
  category: GymBadgeCategory;
  name: string;
  gymName: string;
  leaderName: string;
  color: string;
  icon: string;
  unlockHint: string;
  perkText: string;
  elements: string[]; // 'all' or PokemonElement[]
  atkBonus: number;
  cdReduction: number;
  regenBonus?: number;
  coinBonus?: number;
}

export const GYM_BADGE_CATALOG: GymBadgeDef[] = [
  {
    id: 'boulder_badge',
    category: 'kanto',
    name: '灰色徽章',
    gymName: '尼比道馆',
    leaderName: '馆主 小刚',
    color: '#868e96',
    icon: '/sprites/items/everstone.png',
    unlockHint: '击败「馆主 小刚」或通关青翠森林',
    perkText: '一般系宝可梦 攻击 +15%、全队生命 +20',
    elements: ['normal'],
    atkBonus: 0.15,
    cdReduction: 0.03,
  },
  {
    id: 'cascade_badge',
    category: 'kanto',
    name: '蓝色徽章',
    gymName: '华蓝道馆',
    leaderName: '馆主 小霞',
    color: '#339af0',
    icon: '/sprites/items/mystic-water.png',
    unlockHint: '击败「馆主 小霞」或通关海岸峭壁',
    perkText: '水 / 妖精系宝可梦 攻击 +18%、冷却 -6%',
    elements: ['water', 'fairy'],
    atkBonus: 0.18,
    cdReduction: 0.06,
  },
  {
    id: 'thunder_badge',
    category: 'kanto',
    name: '橙色徽章',
    gymName: '枯叶道馆',
    leaderName: '馆主 马志士',
    color: '#fcc419',
    icon: '/sprites/items/magnet.png',
    unlockHint: '击败「馆主 马志士」或通关红莲火山',
    perkText: '电系宝可梦 攻击 +22%、攻速 +8%',
    elements: ['electric'],
    atkBonus: 0.22,
    cdReduction: 0.08,
  },
  {
    id: 'rainbow_badge',
    category: 'kanto',
    name: '彩虹徽章',
    gymName: '玉虹道馆',
    leaderName: '馆主 莉佳',
    color: '#40c057',
    icon: '/sprites/items/miracle-seed.png',
    unlockHint: '击败「馆主 莉佳」或累计击败 150 只',
    perkText: '草系宝可梦 攻击 +20%、每秒回复 +0.6 HP',
    elements: ['grass'],
    atkBonus: 0.2,
    cdReduction: 0.04,
    regenBonus: 0.6,
  },
  {
    id: 'soul_badge',
    category: 'kanto',
    name: '粉红徽章',
    gymName: '浅红道馆',
    leaderName: '馆主 阿桔',
    color: '#f06595',
    icon: '/sprites/items/black-sludge.png',
    unlockHint: '累计收服 12 只宝可梦或击败 200 只野怪',
    perkText: '毒 / 恶 / 妖精系 攻击 +16%、暴击 +3%',
    elements: ['poison', 'dark', 'fairy'],
    atkBonus: 0.16,
    cdReduction: 0.05,
  },
  {
    id: 'marsh_badge',
    category: 'kanto',
    name: '金色徽章',
    gymName: '金黄道馆',
    leaderName: '馆主 娜姿',
    color: '#fab005',
    icon: '/sprites/items/twisted-spoon.png',
    unlockHint: '累计解锁 20 种图鉴或完成 5 次探索',
    perkText: '超能 / 幽灵系 攻击 +18%、冷却 -5%',
    elements: ['psychic', 'ghost'],
    atkBonus: 0.18,
    cdReduction: 0.05,
  },
  {
    id: 'volcano_badge',
    category: 'kanto',
    name: '深红徽章',
    gymName: '红莲道馆',
    leaderName: '烈焰试炼',
    color: '#fa5252',
    icon: '/sprites/items/charcoal.png',
    unlockHint: '通关任意 2 次或累计击败 300 只',
    perkText: '火 / 龙系宝可梦 攻击 +20%、暴击提升',
    elements: ['fire', 'dragon'],
    atkBonus: 0.2,
    cdReduction: 0.05,
  },
  {
    id: 'earth_badge',
    category: 'kanto',
    name: '绿色徽章',
    gymName: '常磐道馆',
    leaderName: '劲敌 小茂',
    color: '#7950f2',
    icon: '/sprites/items/kings-rock.png',
    unlockHint: '击败「劲敌 小茂」或通关天空冰川',
    perkText: '幽灵 / 超能 & 全系宝可梦 攻击 +12%、金币 +15%',
    elements: ['all', 'ghost', 'psychic'],
    atkBonus: 0.12,
    cdReduction: 0.04,
    coinBonus: 0.15,
  },
  // East Asia World Tour City Gym Badges
  {
    id: 'shanghai_pearl_badge',
    category: 'tour',
    name: '申江明珠徽章',
    gymName: '魔都陆家嘴道馆',
    leaderName: '巡礼馆主 明珠',
    color: '#ff6b6b',
    icon: '/sprites/items/light-ball.png',
    unlockHint: '完成上海站巡礼道馆挑战',
    perkText: '电 / 钢系 攻击 +14%、移速 +4%',
    elements: ['electric', 'steel'],
    atkBonus: 0.14,
    cdReduction: 0.04,
  },
  {
    id: 'beijing_dragon_badge',
    category: 'tour',
    name: '京华金龙徽章',
    gymName: '紫禁太和道馆',
    leaderName: '巡礼馆主 玄武',
    color: '#e67700',
    icon: '/sprites/items/dragon-fang.png',
    unlockHint: '完成北京站巡礼道馆挑战',
    perkText: '龙 / 火系 攻击 +16%、全队生命 +15',
    elements: ['dragon', 'fire'],
    atkBonus: 0.16,
    cdReduction: 0.04,
  },
  {
    id: 'tokyo_neon_badge',
    category: 'tour',
    name: '霓虹塔尖徽章',
    gymName: '东京涩谷道馆',
    leaderName: '巡礼馆主 隼人',
    color: '#22b8cf',
    icon: '/sprites/items/choice-scarf.png',
    unlockHint: '完成东京站巡礼道馆挑战',
    perkText: '电 / 飞行系 攻速 +7%、冷却 -4%',
    elements: ['electric', 'flying'],
    atkBonus: 0.12,
    cdReduction: 0.06,
  },
  {
    id: 'kyoto_sakura_badge',
    category: 'tour',
    name: '古都落樱徽章',
    gymName: '京都岚山道馆',
    leaderName: '巡礼馆主 樱绘',
    color: '#faa2c1',
    icon: '/sprites/items/berry-pouch.png',
    unlockHint: '完成京都站巡礼道馆挑战',
    perkText: '草 / 妖精系 攻击 +15%、回复 +0.4 HP/秒',
    elements: ['grass', 'fairy'],
    atkBonus: 0.15,
    cdReduction: 0.04,
    regenBonus: 0.4,
  },
  {
    id: 'seoul_star_badge',
    category: 'tour',
    name: '汉江星耀徽章',
    gymName: '首尔南山道馆',
    leaderName: '巡礼馆主 智勋',
    color: '#5c7cfa',
    icon: '/sprites/items/scope-lens.png',
    unlockHint: '完成首尔站巡礼道馆挑战',
    perkText: '冰 / 格斗系 攻击 +16%、金币 +8%',
    elements: ['ice', 'fighting'],
    atkBonus: 0.16,
    cdReduction: 0.04,
    coinBonus: 0.08,
  },
  {
    id: 'taipei_cloud_badge',
    category: 'tour',
    name: '碧海云巅徽章',
    gymName: '台北信义道馆',
    leaderName: '巡礼馆主 岚风',
    color: '#20c997',
    icon: '/sprites/items/quick-claw.png',
    unlockHint: '完成台北站巡礼道馆挑战',
    perkText: '水 / 飞行系 攻击 +14%、移速 +5%',
    elements: ['water', 'flying'],
    atkBonus: 0.14,
    cdReduction: 0.05,
  },
  // Master / Endless Honor Badges
  {
    id: 'shiny_hunter_badge',
    category: 'master',
    name: '星闪猎手徽章',
    gymName: '异色收藏殿堂',
    leaderName: '星光认证',
    color: '#ffd43b',
    icon: '/sprites/items/bright-powder.png',
    unlockHint: '在野外成功收服任意异色宝可梦',
    perkText: '全系宝可梦 攻击 +8%、幸运与金币 +10%',
    elements: ['all'],
    atkBonus: 0.08,
    cdReduction: 0.03,
    coinBonus: 0.1,
  },
  {
    id: 'dex_professor_badge',
    category: 'master',
    name: '图鉴博士徽章',
    gymName: '大木研究所荣誉',
    leaderName: '大木博士',
    color: '#339af0',
    icon: '/sprites/items/lucky-egg.png',
    unlockHint: '宝可梦图鉴收录突破 45 种',
    perkText: '全系宝可梦 攻击 +10%、经验效率 +15%',
    elements: ['all'],
    atkBonus: 0.1,
    cdReduction: 0.04,
  },
  {
    id: 'league_champion_badge',
    category: 'master',
    name: '石英冠军徽章',
    gymName: '宝可梦联盟殿堂',
    leaderName: '联盟冠军',
    color: '#ae3ec9',
    icon: '/sprites/items/master-ball.png',
    unlockHint: '累计击败 10 位首领并通关全部关都区域',
    perkText: '全系宝可梦 攻击 +16%、冷却 -6%、金币 +12%',
    elements: ['all'],
    atkBonus: 0.16,
    cdReduction: 0.06,
    coinBonus: 0.12,
  },
];

export function getShowcaseBadgeIds(meta: MetaProgressState): GymBadgeId[] {
  const validIds = new Set(GYM_BADGE_CATALOG.map((b) => b.id));
  const raw = Array.isArray(meta.showcaseBadgeIds)
    ? meta.showcaseBadgeIds.filter((id) => validIds.has(id))
    : [];
  const base = raw.length > 0 ? raw : DEFAULT_SHOWCASE_BADGE_IDS;
  return base.slice(0, MAX_SHOWCASE_BADGES);
}

export interface SquadPreset {
  id: string;
  name: string;
  petIds: string[];
}

export interface MetaProgressState {
  stardust: number;
  labLevels: Partial<Record<LabUpgradeId, number>>;
  activeHero: HeroId;
  unlockedHeroes: HeroId[];
  heroSkillLevels: Record<string, number>;
  // Trainer Tags & Gym Badges (Unlimited catalog, pick up to 6 for HUD display / target tracking!)
  activeTrainerTag?: TrainerTagId;
  unlockedBadges?: GymBadgeId[];
  showcaseBadgeIds?: GymBadgeId[];
  unlockedSkins?: string[];
  // Saved Battle Squad Presets (Switch & Edit 3 Saved Teams!)
  squadPresets?: SquadPreset[];
  activeSquadIdx?: number;
  // Real-World GPS & Pixel World Tour Mode
  worldTour?: WorldTourState;
  // Bounties
  dailyKey: string;
  dailyStreak: number;
  dailyBounties: BountySlot[];
  dailyBonusClaimed: boolean;
  weeklyKey: string;
  weeklyBounties: BountySlot[];
  weeklyBonusClaimed: boolean;
  // Encyclopedia+ Records
  seenSkills: SurvivorSkillId[];
  maxedSkills: SurvivorSkillId[];
  clearedBiomes: BiomeId[];
  clearedDifficulties: DifficultyId[];
  totalKills: number;
  totalBossesDefeated: number;
  totalRuns: number;
  totalCoinsEarned: number;
}

const DAILY_EASY_POOL: Omit<BountySlot, 'id' | 'progress' | 'claimed'>[] = [
  {
    tier: 'easy',
    tierLabel: '简单',
    title: '原野巡逻员',
    desc: '在 3D 冒险中累计击败 60 只野生对手。',
    metric: 'kills',
    target: 60,
    rewardStardust: 60,
    icon: '/sprites/items/poke-ball.png',
  },
  {
    tier: 'easy',
    tierLabel: '简单',
    title: '寻宝猎手',
    desc: '在冒险或养成中累计获得 120 枚宝可币。',
    metric: 'coins_earned',
    target: 120,
    rewardStardust: 60,
    icon: '/sprites/items/amulet-coin.png',
  },
  {
    tier: 'easy',
    tierLabel: '简单',
    title: '贴心训练家',
    desc: '在球舱喂食、互动或抽取盲盒累计 3 次。',
    metric: 'gacha_or_care',
    target: 3,
    rewardStardust: 55,
    icon: '/sprites/items/oran-berry.png',
  },
];

const DAILY_MED_POOL: Omit<BountySlot, 'id' | 'progress' | 'claimed'>[] = [
  {
    tier: 'medium',
    tierLabel: '中等',
    title: '元素火力网',
    desc: '在 3D 对局中累计造成 8,000 点总伤害。',
    metric: 'damage_dealt',
    target: 8000,
    rewardStardust: 100,
    icon: '/sprites/items/life-orb.png',
  },
  {
    tier: 'medium',
    tierLabel: '中等',
    title: '潜能激发',
    desc: '在对局中升级选择强化卡牌累计 6 次。',
    metric: 'upgrades_picked',
    target: 6,
    rewardStardust: 95,
    icon: '/sprites/items/rare-candy.png',
  },
  {
    tier: 'medium',
    tierLabel: '中等',
    title: '精锐清扫',
    desc: '累计击败 180 只野生对手与训练师。',
    metric: 'kills',
    target: 180,
    rewardStardust: 105,
    icon: '/sprites/items/great-ball.png',
  },
];

const DAILY_HARD_POOL: Omit<BountySlot, 'id' | 'progress' | 'claimed'>[] = [
  {
    tier: 'hard',
    tierLabel: '困难',
    title: '守护者讨伐',
    desc: '成功击败 1 名区域守护者或无尽首领。',
    metric: 'bosses',
    target: 1,
    rewardStardust: 160,
    icon: '/sprites/items/ultra-ball.png',
  },
  {
    tier: 'hard',
    tierLabel: '困难',
    title: '势不可挡',
    desc: '累计击败 350 只敌方宝可梦。',
    metric: 'kills',
    target: 350,
    rewardStardust: 165,
    icon: '/sprites/items/kings-rock.png',
  },
  {
    tier: 'hard',
    tierLabel: '困难',
    title: '完美凯旋',
    desc: '完成并通关 1 局 3D 剧情区域讨伐。',
    metric: 'runs_cleared',
    target: 1,
    rewardStardust: 170,
    icon: '/sprites/items/master-ball.png',
  },
];

const WEEKLY_POOL: [
  Omit<BountySlot, 'id' | 'progress' | 'claimed'>[],
  Omit<BountySlot, 'id' | 'progress' | 'claimed'>[],
  Omit<BountySlot, 'id' | 'progress' | 'claimed'>[],
] = [
  [
    {
      tier: 'weekly_1',
      tierLabel: '坚持不懈',
      title: '连胜凯歌',
      desc: '本周累计通关 3 局 3D 区域讨伐。',
      metric: 'runs_cleared',
      target: 3,
      rewardStardust: 300,
      icon: '/sprites/items/great-ball.png',
    },
    {
      tier: 'weekly_1',
      tierLabel: '坚持不懈',
      title: '百战之师',
      desc: '本周累计击败 800 只敌方宝可梦。',
      metric: 'kills',
      target: 800,
      rewardStardust: 320,
      icon: '/sprites/items/vs-seeker.png',
    },
  ],
  [
    {
      tier: 'weekly_2',
      tierLabel: '壮举',
      title: '极限输出王',
      desc: '本周累计造成 45,000 点总伤害。',
      metric: 'damage_dealt',
      target: 45000,
      rewardStardust: 450,
      icon: '/sprites/items/choice-scarf.png',
    },
    {
      tier: 'weekly_2',
      tierLabel: '壮举',
      title: '财富大亨',
      desc: '本周累计收获 800 枚宝可币。',
      metric: 'coins_earned',
      target: 800,
      rewardStardust: 420,
      icon: '/sprites/items/amulet-coin.png',
    },
  ],
  [
    {
      tier: 'weekly_3',
      tierLabel: '挑战',
      title: '活传说猎手',
      desc: '本周累计击败 4 名区域守护者首领。',
      metric: 'bosses',
      target: 4,
      rewardStardust: 680,
      icon: '/sprites/items/master-ball.png',
    },
    {
      tier: 'weekly_3',
      tierLabel: '挑战',
      title: '终极成长者',
      desc: '本周在对局中累计完成 24 次升级强化。',
      metric: 'upgrades_picked',
      target: 24,
      rewardStardust: 620,
      icon: '/sprites/items/rare-candy.png',
    },
  ],
];

export function getUtcDayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function getUtcWeekKey(now = Date.now()): string {
  const d = new Date(now);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diffDays = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const weekNum = Math.floor((diffDays + start.getUTCDay()) / 7) + 1;
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getDailyResetCountdown(now = Date.now()): string {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
  const remMin = Math.max(1, Math.floor((next - now) / 60000));
  const h = Math.floor(remMin / 60);
  const m = remMin % 60;
  return `${h} 小时 ${m} 分钟`;
}

export function getWeeklyResetCountdown(now = Date.now()): string {
  const d = new Date(now);
  const daysToMon = (8 - d.getUTCDay()) % 7 || 7;
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToMon, 0, 0, 0);
  const remHours = Math.max(1, Math.floor((next - now) / 3600000));
  const days = Math.floor(remHours / 24);
  const hrs = remHours % 24;
  return `${days} 天 ${hrs} 小时`;
}

function pickSeeded<T>(arr: T[], seedStr: string, salt: number): T {
  let h = salt * 2654435761;
  for (let i = 0; i < seedStr.length; i++) {
    h = (Math.imul(h, 31) + seedStr.charCodeAt(i)) | 0;
  }
  return arr[Math.abs(h) % arr.length];
}

function buildDailyBounties(dayKey: string): BountySlot[] {
  const e = pickSeeded(DAILY_EASY_POOL, dayKey, 1);
  const m = pickSeeded(DAILY_MED_POOL, dayKey, 2);
  const h = pickSeeded(DAILY_HARD_POOL, dayKey, 3);
  return [
    { ...e, id: `d_${dayKey}_0`, progress: 0, claimed: false },
    { ...m, id: `d_${dayKey}_1`, progress: 0, claimed: false },
    { ...h, id: `d_${dayKey}_2`, progress: 0, claimed: false },
  ];
}

function buildWeeklyBounties(weekKey: string): BountySlot[] {
  return WEEKLY_POOL.map((pool, i) => {
    const pick = pickSeeded(pool, weekKey, 11 + i);
    return { ...pick, id: `w_${weekKey}_${i}`, progress: 0, claimed: false };
  });
}

export const ALL_PLAYABLE_HERO_IDS: HeroId[] = ['red', 'misty', 'brock', 'blue'];

export function createInitialMetaProgress(now = Date.now()): MetaProgressState {
  const dayKey = getUtcDayKey(now);
  const weekKey = getUtcWeekKey(now);
  return {
    stardust: 120, // Welcoming starter Stardust so players can immediately try Lab upgrades!
    labLevels: {},
    activeHero: 'red',
    unlockedHeroes: [...ALL_PLAYABLE_HERO_IDS],
    heroSkillLevels: {},
    dailyKey: dayKey,
    dailyStreak: 0,
    dailyBounties: buildDailyBounties(dayKey),
    dailyBonusClaimed: false,
    weeklyKey: weekKey,
    weeklyBounties: buildWeeklyBounties(weekKey),
    weeklyBonusClaimed: false,
    seenSkills: ['thunderbolt', 'fireball', 'water_pulse'],
    maxedSkills: [],
    clearedBiomes: [],
    clearedDifficulties: [],
    totalKills: 0,
    totalBossesDefeated: 0,
    totalRuns: 0,
    totalCoinsEarned: 0,
  };
}

export function ensureFreshMetaProgress(
  existing?: Partial<MetaProgressState> | null,
  now = Date.now(),
): MetaProgressState {
  const base = createInitialMetaProgress(now);
  if (!existing) return base;
  const dayKey = getUtcDayKey(now);
  const weekKey = getUtcWeekKey(now);
  const sameDay = existing.dailyKey === dayKey && Array.isArray(existing.dailyBounties) && existing.dailyBounties.length === 3;
  const sameWeek = existing.weeklyKey === weekKey && Array.isArray(existing.weeklyBounties) && existing.weeklyBounties.length === 3;
  return {
    ...base,
    ...existing,
    labLevels: existing.labLevels ?? {},
    unlockedHeroes: Array.from(
      new Set<HeroId>([...ALL_PLAYABLE_HERO_IDS, ...(existing.unlockedHeroes ?? [])]),
    ),
    heroSkillLevels: existing.heroSkillLevels ?? {},
    dailyKey: dayKey,
    dailyBounties: sameDay ? existing.dailyBounties! : buildDailyBounties(dayKey),
    dailyBonusClaimed: sameDay ? Boolean(existing.dailyBonusClaimed) : false,
    weeklyKey: weekKey,
    weeklyBounties: sameWeek ? existing.weeklyBounties! : buildWeeklyBounties(weekKey),
    weeklyBonusClaimed: sameWeek ? Boolean(existing.weeklyBonusClaimed) : false,
    seenSkills: existing.seenSkills ?? base.seenSkills,
    maxedSkills: existing.maxedSkills ?? [],
    clearedBiomes: existing.clearedBiomes ?? [],
    clearedDifficulties: existing.clearedDifficulties ?? [],
  };
}

export function rerollBountySlot(
  meta: MetaProgressState,
  kind: 'daily' | 'weekly',
  slotIdx: number,
): MetaProgressState {
  const list = kind === 'daily' ? [...meta.dailyBounties] : [...meta.weeklyBounties];
  const cur = list[slotIdx];
  if (!cur || cur.claimed) return meta;
  const pool =
    kind === 'daily'
      ? slotIdx === 0
        ? DAILY_EASY_POOL
        : slotIdx === 1
          ? DAILY_MED_POOL
          : DAILY_HARD_POOL
      : WEEKLY_POOL[slotIdx] ?? WEEKLY_POOL[0];
  const alts = pool.filter((p) => p.title !== cur.title);
  const next = alts.length > 0 ? alts[Math.floor(Math.random() * alts.length)] : pool[0];
  list[slotIdx] = {
    ...next,
    id: `${kind}_${Date.now()}_${slotIdx}`,
    progress: 0,
    claimed: false,
  };
  return kind === 'daily' ? { ...meta, dailyBounties: list } : { ...meta, weeklyBounties: list };
}

export function incrementBounties(
  meta: MetaProgressState,
  deltas: Partial<Record<BountyMetric, number>>,
): MetaProgressState {
  const applyList = (list: BountySlot[]) =>
    list.map((b) => {
      if (b.claimed) return b;
      const add = deltas[b.metric] ?? 0;
      if (add <= 0) return b;
      return { ...b, progress: Math.min(b.target, b.progress + add) };
    });
  return {
    ...meta,
    dailyBounties: applyList(meta.dailyBounties),
    weeklyBounties: applyList(meta.weeklyBounties),
  };
}

export function countClaimableBounties(meta: MetaProgressState): number {
  let n = 0;
  for (const b of meta.dailyBounties) if (!b.claimed && b.progress >= b.target) n++;
  for (const b of meta.weeklyBounties) if (!b.claimed && b.progress >= b.target) n++;
  if (!meta.dailyBonusClaimed && meta.dailyBounties.every((b) => b.claimed)) n++;
  if (!meta.weeklyBonusClaimed && meta.weeklyBounties.every((b) => b.claimed)) n++;
  return n;
}

export interface ComputedCombatBonuses {
  dmgMult: number;
  maxHpFlat: number;
  speedMult: number;
  xpMult: number;
  coinMult: number;
  stardustMult: number;
  pickupAdd: number;
  regenPerSec: number;
  cdMult: number;
  rerolls: number;
  dmgReduction: number;
  bossDmgMult: number;
  critChance: number;
  extraSquadSlots: number;
  revives: number;
  catchRateBonus: number;
  koDurationMult: number;
  extraHealCharges: number;
  // Active hero signature mechanics
  heroId: HeroId;
  heroEvoTier: 0 | 1 | 2;
  redBallLv: number;
  mistyTideLv: number;
  mistyHealLv: number;
  brockQuakeLv: number;
  blueComboLv: number;
}

export function getUnlockedTrainerTags(meta: MetaProgressState): TrainerTagId[] {
  const badges = meta.unlockedBadges ?? [];
  const out: TrainerTagId[] = ['rookie_trainer'];
  if (meta.totalKills >= 60) out.push('forest_ranger');
  if (badges.length >= 1) out.push('gym_challenger');
  if (badges.length >= 3) out.push('gym_leader');
  if (badges.length >= 5) out.push('elite_four');
  if (badges.length >= 6) out.push('kanto_champion');
  return out;
}

export interface BondMilestoneDef {
  level: number;
  bondReq: number;
  title: string;
  perkText: string;
  stardustReward: number;
  unlocksMega?: boolean;
  hpFlat?: number;
  speedBonus?: number;
  cdReduction?: number;
  dmgReduction?: number;
  critBonus?: number;
  xpBonus?: number;
  atkBonus?: number;
}

export const BOND_MILESTONES: BondMilestoneDef[] = [
  { level: 2, bondReq: 20, title: '初识伙伴', perkText: '解锁一阶进化 · 基础攻击 +4%', stardustReward: 40, atkBonus: 0.04 },
  { level: 3, bondReq: 30, title: '信赖', perkText: '解除经验折损(100%) · 最大 HP +12', stardustReward: 60, hpFlat: 12 },
  { level: 4, bondReq: 40, title: '欢快步伐', perkText: '解锁最终进化 · 移动速度 +4%', stardustReward: 80, speedBonus: 0.04 },
  {
    level: 5,
    bondReq: 50,
    title: '超进化觉醒',
    perkText: '解锁「超进化 / 超极巨形态」· 齐射时触发！',
    stardustReward: 120,
    unlocksMega: true,
    atkBonus: 0.06,
  },
  { level: 6, bondReq: 60, title: '默契连携', perkText: '养成经验 +12% · 全招式冷却 -6%', stardustReward: 140, cdReduction: 0.06 },
  { level: 7, bondReq: 70, title: '守护之心', perkText: '受到伤害减免 -4%', stardustReward: 160, dmgReduction: 0.04 },
  { level: 8, bondReq: 80, title: '心有灵犀', perkText: '要害暴击率 +6%', stardustReward: 180, critBonus: 0.06 },
  { level: 9, bondReq: 90, title: '共同成长', perkText: '养成经验 +25% · 对局经验 +8%', stardustReward: 220, xpBonus: 0.08 },
  {
    level: 10,
    bondReq: 100,
    title: '灵魂伴侣',
    perkText: '爱心徽章 · 全属性伤害 +15%',
    stardustReward: 300,
    atkBonus: 0.15,
  },
];

export interface MegaFormDef {
  formName: string;
  kind: 'mega' | 'gmax';
  badgeLabel: string;
  auraColor: string;
  auraHex: number;
  perkSummary: string;
}

export const SPECIES_MEGA_FORMS: Record<string, MegaFormDef> = {
  pikachu: {
    formName: '超极巨皮卡丘',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#ffd43b',
    auraHex: 0xffd43b,
    perkSummary: '雷电招式范围扩大，伤害 +40% · 冷却 -25%',
  },
  charmander: {
    formName: '超级喷火龙 X',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ff5924',
    auraHex: 0xff5924,
    perkSummary: '苍蓝龙炎缠绕，火焰与龙系伤害 +45%',
  },
  bulbasaur: {
    formName: '超级妙蛙花',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#40c057',
    auraHex: 0x40c057,
    perkSummary: '厚脂肪护体，伤害 +35% 并持续回复全队体力',
  },
  squirtle: {
    formName: '超级水箭龟',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#228be6',
    auraHex: 0x228be6,
    perkSummary: '超级发射器启动，水之波动与炮击伤害 +45%',
  },
  gastly: {
    formName: '超级耿鬼',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ae3ec9',
    auraHex: 0xae3ec9,
    perkSummary: '踩影领域展开，暗影暴击率与爆发 +45%',
  },
  eevee: {
    formName: '超极巨伊布',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#ff922b',
    auraHex: 0xff922b,
    perkSummary: '极巨热情鼓舞全队，移速与全队攻速大幅飙升',
  },
  dratini: {
    formName: '觉醒快龙·超极态',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#5c7cfa',
    auraHex: 0x5c7cfa,
    perkSummary: '多重鳞片护盾，龙之脉冲伤害 +45%',
  },
  munchlax: {
    formName: '超极巨卡比兽',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#20c997',
    auraHex: 0x20c997,
    perkSummary: '森林巨躯震地冲撞，体格巨化且冲撞伤害 +55%',
  },
  meowth: {
    formName: '超极巨喵喵',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#fab005',
    auraHex: 0xfab005,
    perkSummary: '超极巨特大金币雨，连击伤害 +40% · 掉落金币翻倍',
  },
  jigglypuff: {
    formName: '觉醒胖可丁·星咏',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#f06595',
    auraHex: 0xf06595,
    perkSummary: '星光魅惑之声，治疗与范围音爆 +45%',
  },
  psyduck: {
    formName: '觉醒哥达鸭·灵能',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#15aabf',
    auraHex: 0x15aabf,
    perkSummary: '超能力全面解放，全招式穿透与伤害 +42%',
  },
  togepi: {
    formName: '觉醒波克基斯·圣翼',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#fcc419',
    auraHex: 0xfcc419,
    perkSummary: '天恩幸运爆发，暴击率与回复光环大幅提升',
  },
  caterpie: {
    formName: '超极巨巴大蝶',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#82c91e',
    auraHex: 0x82c91e,
    perkSummary: '极巨蝶舞鳞粉弥漫，全范围减速且伤害 +40%',
  },
  pidgey: {
    formName: '超级大比鸟',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#4dabf7',
    auraHex: 0x4dabf7,
    perkSummary: '无防守飓风席卷，攻速飙升且必中暴击 +42%',
  },
  vulpix: {
    formName: '觉醒九尾·绯炎',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ff6b35',
    auraHex: 0xff6b35,
    perkSummary: '日照烈焰绽放，火焰范围与持续灼烧 +44%',
  },
  diglett: {
    formName: '觉醒三地鼠·震岳',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#c08552',
    auraHex: 0xc08552,
    perkSummary: '沙穴极速突袭，移速与震地伤害 +42%',
  },
  growlithe: {
    formName: '觉醒风速狗·神焰',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#fd7e14',
    auraHex: 0xfd7e14,
    perkSummary: '神速烈焰奔腾，全队移速与火系爆发 +45%',
  },
  abra: {
    formName: '超级胡地',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#be4bdb',
    auraHex: 0xbe4bdb,
    perkSummary: '五匙悬浮共鸣，超能伤害 +50% · 冷却 -30%',
  },
  machop: {
    formName: '超极巨怪力',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#e03131',
    auraHex: 0xe03131,
    perkSummary: '超极巨会心一击，暴击率翻倍且重拳伤害 +50%',
  },
  geodude: {
    formName: '觉醒隆隆岩·泰坦',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#8d6e63',
    auraHex: 0x8d6e63,
    perkSummary: '结实岩铠护体，震地冲击范围与伤害 +45%',
  },
  scyther: {
    formName: '觉醒飞天螳螂·疾镰',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#2f9e44',
    auraHex: 0x2f9e44,
    perkSummary: '技术高手双镰连斩，攻速 +35% · 伤害 +45%',
  },
  magikarp: {
    formName: '超级暴鲤龙',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#1971c2',
    auraHex: 0x1971c2,
    perkSummary: '破格怒涛狂龙，水龙双重爆发伤害 +52%',
  },
  lapras: {
    formName: '超极巨拉普拉斯',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#22b8cf',
    auraHex: 0x22b8cf,
    perkSummary: '超极巨极光旋律，全队减伤护盾与冰水伤害 +45%',
  },
  mewtwo: {
    formName: '超级超梦 Y',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#7950f2',
    auraHex: 0x7950f2,
    perkSummary: '究极精神击破觉醒，全招式伤害 +55% · 冷却 -30%',
  },
  mew: {
    formName: '觉醒梦幻·始源',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#f06595',
    auraHex: 0xf06595,
    perkSummary: '始源星辉共鸣，全属性伤害 +50% 并持续回复全队',
  },
  weedle: {
    formName: '超级大针蜂',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#fab005',
    auraHex: 0xfab005,
    perkSummary: '适应力疾风双针，攻速 +40% · 毒虫连刺伤害 +48%',
  },
  sandshrew: {
    formName: '觉醒穿山王·沙刃',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#e09f3e',
    auraHex: 0xe09f3e,
    perkSummary: '拨沙旋爪连击，移速与岩地暴击伤害 +42%',
  },
  nidoran: {
    formName: '觉醒尼多王·霸皇',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#9c36b5',
    auraHex: 0x9c36b5,
    perkSummary: '强行霸气全开，毒地重击范围与伤害 +48%',
  },
  clefairy: {
    formName: '觉醒皮可西·月神',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#f783ac',
    auraHex: 0xf783ac,
    perkSummary: '魔法防守月光加护，全队回血且妖精爆发 +42%',
  },
  oddish: {
    formName: '觉醒霸王花·毒香',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#2f9e44',
    auraHex: 0x2f9e44,
    perkSummary: '叶绿素落英绽放，大范围孢子持续伤害 +44%',
  },
  poliwag: {
    formName: '觉醒蚊香泳士·激流',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#1971c2',
    auraHex: 0x1971c2,
    perkSummary: '悠游自如水拳连打，攻速与水系冲击 +44%',
  },
  ponyta: {
    formName: '觉醒烈焰马·赤驹',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ff5924',
    auraHex: 0xff5924,
    perkSummary: '引火极速冲锋，全队移速与烈焰冲撞 +45%',
  },
  slowpoke: {
    formName: '超级呆壳兽',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#f06595',
    auraHex: 0xf06595,
    perkSummary: '硬壳盔甲无懈可击，防御护盾与水超能爆发 +46%',
  },
  magnemite: {
    formName: '觉醒自爆磁怪·超磁',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ffd43b',
    auraHex: 0xffd43b,
    perkSummary: '磁力高压电磁场，雷电连锁与拾取范围飙升',
  },
  shellder: {
    formName: '觉醒刺甲贝·连续技',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#22b8cf',
    auraHex: 0x22b8cf,
    perkSummary: '连续攻击冰锥五连发，弹幕密度与伤害 +46%',
  },
  onix: {
    formName: '超级大钢蛇·钢岩',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#868e96',
    auraHex: 0x868e96,
    perkSummary: '砂之力钢岩巨躯，体格巨化且震地伤害 +50%',
  },
  cubone: {
    formName: '觉醒嘎啦嘎啦·魂骨',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#d97724',
    auraHex: 0xd97724,
    perkSummary: '粗骨头灵魂共鸣，骨棒回旋暴击伤害翻倍',
  },
  rhyhorn: {
    formName: '觉醒超甲狂犀·岩皇',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#b08968',
    auraHex: 0xb08968,
    perkSummary: '坚硬岩石重装冲撞，减伤与巨岩轰炸 +48%',
  },
  chansey: {
    formName: '觉醒幸福蛋·圣愈',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#faa2c1',
    auraHex: 0xfaa2c1,
    perkSummary: '治愈之心持续回满全队 HP，生蛋护盾常驻',
  },
  horsea: {
    formName: '觉醒刺龙王·狙击',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#339af0',
    auraHex: 0x339af0,
    perkSummary: '狙击手要害必爆，水龙弹幕穿透伤害 +46%',
  },
  staryu: {
    formName: '觉醒宝石海星·星辉',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#7950f2',
    auraHex: 0x7950f2,
    perkSummary: '星核高速旋转，水电超能三系炮火冷却 -30%',
  },
  electabuzz: {
    formName: '觉醒电击魔兽·狂雷',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#fcc419',
    auraHex: 0xfcc419,
    perkSummary: '电气引擎提速增伤，十万伏特雷暴伤害 +48%',
  },
  magmar: {
    formName: '觉醒鸭嘴炎兽·熔核',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#e03131',
    auraHex: 0xe03131,
    perkSummary: '熔岩核心喷发，大字爆炎范围与伤害 +48%',
  },
  porygon: {
    formName: '觉醒多边兽Z·超频',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#15aabf',
    auraHex: 0x15aabf,
    perkSummary: '适应力三重攻击超频，全招式冷却 -28% · 伤害 +48%',
  },
  aerodactyl: {
    formName: '超级化石翼龙',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#748ffc',
    auraHex: 0x748ffc,
    perkSummary: '硬爪太古天翼，极速俯冲与岩崩爆发 +50%',
  },
  articuno: {
    formName: '传说急冻鸟·极寒翼',
    kind: 'mega',
    badgeLabel: '传说觉醒',
    auraColor: '#3bc9db',
    auraHex: 0x3bc9db,
    perkSummary: '绝对零度暴风雪领域，大范围冰封且伤害 +55%',
  },
  zapdos: {
    formName: '传说闪电鸟·雷神翼',
    kind: 'mega',
    badgeLabel: '传说觉醒',
    auraColor: '#ffd43b',
    auraHex: 0xffd43b,
    perkSummary: '雷神天罚落雷连锁，攻速与全屏雷电伤害 +55%',
  },
  moltres: {
    formName: '传说火焰鸟·不死焰',
    kind: 'mega',
    badgeLabel: '传说觉醒',
    auraColor: '#ff5924',
    auraHex: 0xff5924,
    perkSummary: '神圣炽焰焚天羽翼，大范围灼烧且伤害 +55%',
  },
  rattata: {
    formName: '觉醒拉达·疾牙',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#b197fc',
    auraHex: 0xb197fc,
    perkSummary: '活力疾风咬击，攻速 +35% · 伤害 +42%',
  },
  spearow: {
    formName: '觉醒大嘴雀·苍喙',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#d08c60',
    auraHex: 0xd08c60,
    perkSummary: '狙击手高空穿刺，暴击与俯冲伤害 +44%',
  },
  ekans: {
    formName: '觉醒阿柏怪·紫皇',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#9c36b5',
    auraHex: 0x9c36b5,
    perkSummary: '威吓毒纹震慑全场，剧毒连击伤害 +44%',
  },
  nidoranf: {
    formName: '觉醒尼多后·蓝皇',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#339af0',
    auraHex: 0x339af0,
    perkSummary: '强行重甲加护，减伤且大地爆发 +48%',
  },
  zubat: {
    formName: '觉醒大嘴蝠·夜翼',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#5c7cfa',
    auraHex: 0x5c7cfa,
    perkSummary: '暗夜极速掠空，移速与连击伤害 +42%',
  },
  paras: {
    formName: '觉醒派拉斯特·菌王',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#e8590c',
    auraHex: 0xe8590c,
    perkSummary: '孢子领域蔓延，吸血续航与草虫伤害 +44%',
  },
  venonat: {
    formName: '觉醒摩鲁蛾·幻鳞',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#9775fa',
    auraHex: 0x9775fa,
    perkSummary: '有色眼镜无视抗性，鳞粉伤害 +45%',
  },
  mankey: {
    formName: '觉醒火爆猴·狂拳',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#e8590c',
    auraHex: 0xe8590c,
    perkSummary: '不服输斗气全开，暴击与连拳伤害 +46%',
  },
  bellsprout: {
    formName: '觉醒大食花·翠藤',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#40c057',
    auraHex: 0x40c057,
    perkSummary: '叶绿素极速挥鞭，攻速与范围伤害 +45%',
  },
  tentacool: {
    formName: '觉醒毒刺水母·海皇',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#1c7ed6',
    auraHex: 0x1c7ed6,
    perkSummary: '净体免伤与大范围水毒弹幕 +45%',
  },
  farfetchd: {
    formName: '觉醒大葱鸭·葱游剑圣',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#74b816',
    auraHex: 0x74b816,
    perkSummary: '大葱必爆剑气，暴击率翻倍且伤害 +46%',
  },
  doduo: {
    formName: '觉醒嘟嘟利·疾风',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#c08552',
    auraHex: 0xc08552,
    perkSummary: '三头同调连击，移速与攻速飙升 +44%',
  },
  seel: {
    formName: '觉醒白海狮·冰魄',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#74c0fc',
    auraHex: 0x74c0fc,
    perkSummary: '厚脂肪冰海加护，减伤且冰水伤害 +44%',
  },
  grimer: {
    formName: '觉醒臭臭泥·毒渊',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ae3ec9',
    auraHex: 0xae3ec9,
    perkSummary: '毒手连击压制，范围毒浪伤害 +45%',
  },
  drowzee: {
    formName: '觉醒引梦貘人·金摆',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#f59f00',
    auraHex: 0xf59f00,
    perkSummary: '催眠梦境共鸣，超能伤害 +45% · 冷却 -20%',
  },
  krabby: {
    formName: '超极巨巨钳蟹',
    kind: 'gmax',
    badgeLabel: '超极巨化',
    auraColor: '#ff6b35',
    auraHex: 0xff6b35,
    perkSummary: '超极巨激泡震击，巨钳暴击伤害 +48%',
  },
  voltorb: {
    formName: '觉醒顽皮雷弹·极速',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ff5924',
    auraHex: 0xff5924,
    perkSummary: '关都第一移速，全队攻速与电爆 +46%',
  },
  exeggcute: {
    formName: '觉醒椰蛋树·巨林',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#66a80f',
    auraHex: 0x66a80f,
    perkSummary: '叶绿素草超双系齐发，范围伤害 +48%',
  },
  hitmonlee: {
    formName: '觉醒飞腿郎·腿圣',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#e03131',
    auraHex: 0xe03131,
    perkSummary: '舍身飞踢极限穿透，暴击与踢技伤害 +48%',
  },
  hitmonchan: {
    formName: '觉醒快拳郎·拳皇',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#d6336c',
    auraHex: 0xd6336c,
    perkSummary: '铁拳攻速暴涨，三色连拳伤害 +48%',
  },
  lickitung: {
    formName: '觉醒大舌舔·巨舌',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#f06595',
    auraHex: 0xf06595,
    perkSummary: '大范围长舌横扫，续航与伤害 +44%',
  },
  koffing: {
    formName: '觉醒双弹瓦斯·紫烟',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#845ef7',
    auraHex: 0x845ef7,
    perkSummary: '化学变化毒雾领域，范围毒伤 +46%',
  },
  tangela: {
    formName: '觉醒巨蔓藤·蓝林',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#228be6',
    auraHex: 0x228be6,
    perkSummary: '再生力续航不绝，蓝藤范围伤害 +45%',
  },
  kangaskhan: {
    formName: '超级袋兽',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#d97724',
    auraHex: 0xd97724,
    perkSummary: '亲子爱全招式双重连击，伤害 +52%',
  },
  goldeen: {
    formName: '觉醒金鱼王·赤潮',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ff6b6b',
    auraHex: 0xff6b6b,
    perkSummary: '避雷针吸电增幅，激流穿刺伤害 +44%',
  },
  mrmime: {
    formName: '觉醒魔墙人偶·幻幕',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#f06595',
    auraHex: 0xf06595,
    perkSummary: '过滤护盾常驻，超能妖精伤害 +46%',
  },
  jynx: {
    formName: '觉醒迷唇姐·冰姬',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#cc5de8',
    auraHex: 0xcc5de8,
    perkSummary: '冰念双系冻结范围扩大，伤害 +46%',
  },
  pinsir: {
    formName: '超级凯罗斯',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#d08c60',
    auraHex: 0xd08c60,
    perkSummary: '飞行皮肤展翼俯冲，虫飞爆发伤害 +50%',
  },
  tauros: {
    formName: '觉醒肯泰罗·狂牛',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#c08552',
    auraHex: 0xc08552,
    perkSummary: '威吓冲锋势不可挡，移速与撞击伤害 +48%',
  },
  ditto: {
    formName: '觉醒百变怪·千面',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#da77f2',
    auraHex: 0xda77f2,
    perkSummary: '变身者全能增幅，全队攻速与伤害 +45%',
  },
  vaporeon: {
    formName: '觉醒水伊布·海灵',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#228be6',
    auraHex: 0x228be6,
    perkSummary: '储水领域持续回血，水系伤害 +48%',
  },
  jolteon: {
    formName: '觉醒雷伊布·迅雷',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#fcc419',
    auraHex: 0xfcc419,
    perkSummary: '蓄电极速连射，攻速 +40% · 雷伤 +48%',
  },
  flareon: {
    formName: '觉醒火伊布·赤阳',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#ff5924',
    auraHex: 0xff5924,
    perkSummary: '引火爆发炽烈，火系暴击与伤害 +48%',
  },
  omanyte: {
    formName: '觉醒多刺菊石兽·螺旋',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#339af0',
    auraHex: 0x339af0,
    perkSummary: '悠游自如破壳爆发，攻速与水岩伤害 +48%',
  },
  kabuto: {
    formName: '觉醒镰刀盔·古镰',
    kind: 'mega',
    badgeLabel: '超级进化',
    auraColor: '#b08968',
    auraHex: 0xb08968,
    perkSummary: '悠游自如双镰连斩，暴击与水岩伤害 +48%',
  },
};

export type SkinCollectionId = 'classic' | 'mythic' | 'vanguard' | 'celestial' | 'huaxia';

export interface PokemonSkinDef {
  id: import('../types/pet').PetSkinId;
  name: string;
  rarityLabel: string;
  rarityColor: string;
  priceCoins: number;
  desc: string;
  cssFilter: string;
  tintHex3D: number;
  usesOfficialShiny?: boolean;
  /** Showcase & signature Pokémon species line for editorial organization */
  targetSpecies?: import('../types/pet').SpeciesId;
  showcaseSpecies: import('../types/pet').SpeciesId;
  showcaseStage: 'baby' | 'teen' | 'adult';
  lineLabel: string;
  collection: SkinCollectionId;
  seriesTag: string;
  backdropGradient: string;
  highlights?: string[];
}

export const POKEMON_SKIN_CATALOG: PokemonSkinDef[] = [
  {
    id: 'solar_pharaoh',
    name: '太阳法老',
    rarityLabel: '神话外观',
    rarityColor: '#f59f00',
    priceCoins: 520,
    desc: '以青金石雕成，以金丝镶嵌，配有绿松石双翼与鎏金神辉。周身流淌炽热太阳圣光！',
    cssFilter: 'hue-rotate(195deg) saturate(2.2) contrast(1.18) drop-shadow(0 0 8px #ffd43b)',
    tintHex3D: 0xffe066,
    targetSpecies: 'charmander',
    showcaseSpecies: 'charmander',
    showcaseStage: 'adult',
    lineLabel: '适用于小火龙的整个进化线',
    collection: 'mythic',
    seriesTag: '神话 · 太阳神殿',
    backdropGradient: 'radial-gradient(circle at 72% 48%, #2a3c8f 0%, #161c46 52%, #0c1029 100%)',
    highlights: [
      '青金石、黄金与绿松石的身躯',
      '流过全身的太阳鎏金光辉',
      '小火龙 / 火恐龙 / 喷火龙全线适配',
      '3D 实战自带黄金烈焰气场',
    ],
  },
  {
    id: 'blue_flame',
    name: '苍蓝圣炎',
    rarityLabel: '先锋',
    rarityColor: '#3b5bdb',
    priceCoins: 360,
    desc: '燃烧着永不熄灭的苍蓝灵焰，幽影穿梭间留下一缕深海钴蓝残光。',
    cssFilter: 'hue-rotate(175deg) saturate(1.85) brightness(1.08) drop-shadow(0 0 6px #4dabf7)',
    tintHex3D: 0x74c0fc,
    targetSpecies: 'gastly',
    showcaseSpecies: 'gastly',
    showcaseStage: 'adult',
    lineLabel: '鬼斯 · 耿鬼进化线',
    collection: 'vanguard',
    seriesTag: '先锋 · 幽焰',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #29469b 0%, #111936 72%)',
  },
  {
    id: 'magma',
    name: '黑曜熔岩',
    rarityLabel: '先锋',
    rarityColor: '#e8590c',
    priceCoins: 260,
    desc: '黑曜熔岩与炽热火纹在体表跃动，如火山奔腾般霸气灼目。',
    cssFilter: 'sepia(0.55) saturate(2.1) hue-rotate(-22deg) contrast(1.15) drop-shadow(0 0 6px #ff5924)',
    tintHex3D: 0xff8c5a,
    targetSpecies: 'growlithe',
    showcaseSpecies: 'growlithe',
    showcaseStage: 'adult',
    lineLabel: '卡蒂狗 · 风速狗进化线',
    collection: 'vanguard',
    seriesTag: '先锋 · 熔火',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #7c2d12 0%, #240f0a 72%)',
  },
  {
    id: 'ice_glaze',
    name: '冰裂釉·北境霜瓷',
    rarityLabel: '先锋',
    rarityColor: '#15aabf',
    priceCoins: 300,
    desc: '宋代冰裂青瓷与极光霜华交织，浮浪穿梭自带寒霜晶纹。',
    cssFilter: 'hue-rotate(158deg) saturate(1.35) brightness(1.16) contrast(1.05) drop-shadow(0 0 6px #66d9e8)',
    tintHex3D: 0xb8f3ff,
    targetSpecies: 'lapras',
    showcaseSpecies: 'lapras',
    showcaseStage: 'adult',
    lineLabel: '拉普拉斯 · 极光乘龙线',
    collection: 'vanguard',
    seriesTag: '先锋 · 浮冰瓷',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #115e75 0%, #0b2234 72%)',
  },
  {
    id: 'porcelain',
    name: '青花瓷·景德镇',
    rarityLabel: '先锋',
    rarityColor: '#1971c2',
    priceCoins: 280,
    desc: '釉下钴蓝与素白青花瓷韵，水炮轰鸣间宛如名窑青花流转。',
    cssFilter: 'hue-rotate(195deg) saturate(1.55) brightness(1.12) contrast(1.08) drop-shadow(0 0 6px #339af0)',
    tintHex3D: 0x99d6ff,
    targetSpecies: 'squirtle',
    showcaseSpecies: 'squirtle',
    showcaseStage: 'adult',
    lineLabel: '杰尼龟 · 水箭龟进化线',
    collection: 'vanguard',
    seriesTag: '先锋 · 青花',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #1d4ed8 0%, #101d3b 72%)',
  },
  {
    id: 'sakura',
    name: '花见·樱之灵',
    rarityLabel: '星辰收藏',
    rarityColor: '#e64980',
    priceCoins: 320,
    desc: '永恒之春的绯樱色泽与柔光花韵，漫天花瓣随轻盈身姿飘落。',
    cssFilter: 'hue-rotate(285deg) saturate(1.45) brightness(1.1) drop-shadow(0 0 6px #f783ac)',
    tintHex3D: 0xffc9e3,
    targetSpecies: 'mew',
    showcaseSpecies: 'mew',
    showcaseStage: 'baby',
    lineLabel: '梦幻 · 妖精超能系列',
    collection: 'celestial',
    seriesTag: '星辰收藏 · 花见',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #9d174d 0%, #2d1024 72%)',
  },
  {
    id: 'dunhuang_gold',
    name: '敦煌丹霞·飞天金',
    rarityLabel: '华夏典藏',
    rarityColor: '#e67700',
    priceCoins: 340,
    desc: '丝路壁画赤金流彩与南国烈阳，雷电奔袭时金光如飞天飘带！',
    cssFilter: 'sepia(0.65) saturate(2.3) hue-rotate(-6deg) brightness(1.08) drop-shadow(0 0 6px #fab005)',
    tintHex3D: 0xffd479,
    targetSpecies: 'pikachu',
    showcaseSpecies: 'pikachu',
    showcaseStage: 'baby',
    lineLabel: '皮卡丘 · 雷丘进化线',
    collection: 'huaxia',
    seriesTag: '华夏典藏 · 丝路金',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #9a4a08 0%, #2a1708 72%)',
  },
  {
    id: 'vermilion_palace',
    name: '朱砂红·紫禁琉璃',
    rarityLabel: '华夏典藏',
    rarityColor: '#c92a2a',
    priceCoins: 300,
    desc: '故宫宫墙朱砂红与鎏金祥辉，京城古都限定风雅配色！',
    cssFilter: 'sepia(0.45) saturate(2.4) hue-rotate(-35deg) contrast(1.12) drop-shadow(0 0 6px #e03131)',
    tintHex3D: 0xff7a70,
    targetSpecies: 'eevee',
    showcaseSpecies: 'eevee',
    showcaseStage: 'baby',
    lineLabel: '伊布家族全进化线',
    collection: 'huaxia',
    seriesTag: '华夏典藏 · 紫禁红',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #8c1d18 0%, #2b0c0c 72%)',
  },
  {
    id: 'jade_emerald',
    name: '翡翠青·江南玉雕',
    rarityLabel: '华夏典藏',
    rarityColor: '#0ca678',
    priceCoins: 280,
    desc: '温润翠玉碧色与西湖竹影灵光，江南水乡温雅限定配色！',
    cssFilter: 'hue-rotate(92deg) saturate(1.65) brightness(1.08) drop-shadow(0 0 6px #20c997)',
    tintHex3D: 0x7ef2c8,
    targetSpecies: 'bulbasaur',
    showcaseSpecies: 'bulbasaur',
    showcaseStage: 'adult',
    lineLabel: '妙蛙种子 · 妙蛙花进化线',
    collection: 'huaxia',
    seriesTag: '华夏典藏 · 江南玉',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #0f6b50 0%, #09261f 72%)',
  },
  {
    id: 'ink_wash',
    name: '水墨丹青·徽派',
    rarityLabel: '华夏典藏',
    rarityColor: '#495057',
    priceCoins: 320,
    desc: '淡雅宣纸黑白水墨意境，如挥毫泼墨般腾云驾雾！',
    cssFilter: 'grayscale(0.92) contrast(1.38) brightness(1.06) drop-shadow(0 0 5px #adb5bd)',
    tintHex3D: 0xd0d4dc,
    targetSpecies: 'dratini',
    showcaseSpecies: 'dratini',
    showcaseStage: 'adult',
    lineLabel: '迷你龙 · 快龙进化线',
    collection: 'huaxia',
    seriesTag: '华夏典藏 · 水墨',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #3f4652 0%, #16191f 72%)',
  },
  {
    id: 'shiny',
    name: '官方异色 ★',
    rarityLabel: '全图鉴稀有',
    rarityColor: '#228be6',
    priceCoins: 180,
    desc: '解锁全图鉴宝可梦官方异色精灵图与闪耀星芒光效！任何伙伴皆可穿戴。',
    cssFilter: 'drop-shadow(0 0 5px #ffd43b)',
    tintHex3D: 0xfff3bf,
    usesOfficialShiny: true,
    showcaseSpecies: 'mewtwo',
    showcaseStage: 'baby',
    lineLabel: '全图鉴宝可梦通用',
    collection: 'celestial',
    seriesTag: '星辰收藏 · 闪光',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #1d5ca8 0%, #0d1d38 72%)',
  },
  {
    id: 'classic',
    name: '经典原色',
    rarityLabel: '普通',
    rarityColor: '#868e96',
    priceCoins: 0,
    desc: '宝可梦一贯的经典原色。',
    cssFilter: 'none',
    tintHex3D: 0xffffff,
    showcaseSpecies: 'pikachu',
    showcaseStage: 'baby',
    lineLabel: '全图鉴默认配色',
    collection: 'classic',
    seriesTag: '经典原色',
    backdropGradient: 'radial-gradient(circle at 50% 42%, #495057 0%, #212529 72%)',
  },
];

export function getSkinDef(id?: string): PokemonSkinDef {
  return POKEMON_SKIN_CATALOG.find((s) => s.id === id) ?? POKEMON_SKIN_CATALOG[POKEMON_SKIN_CATALOG.length - 1];
}

export function getPetBondLevel(bond: number): number {
  const clamped = Math.max(0, Math.min(100, bond));
  if (clamped >= 90) return 10;
  return Math.max(1, Math.min(10, Math.floor(clamped / 10) + 1));
}

export function computePetBondBonuses(bond: number) {
  const lv = getPetBondLevel(bond);
  let hpFlat = 0;
  let speedBonus = 0;
  let cdReduction = 0;
  let dmgReduction = 0;
  let critBonus = 0;
  let xpBonus = 0;
  let atkBonus = 0;
  let megaUnlocked = false;
  for (const m of BOND_MILESTONES) {
    if (lv >= m.level) {
      if (m.hpFlat) hpFlat += m.hpFlat;
      if (m.speedBonus) speedBonus += m.speedBonus;
      if (m.cdReduction) cdReduction += m.cdReduction;
      if (m.dmgReduction) dmgReduction += m.dmgReduction;
      if (m.critBonus) critBonus += m.critBonus;
      if (m.xpBonus) xpBonus += m.xpBonus;
      if (m.atkBonus) atkBonus += m.atkBonus;
      if (m.unlocksMega) megaUnlocked = true;
    }
  }
  return { lv, hpFlat, speedBonus, cdReduction, dmgReduction, critBonus, xpBonus, atkBonus, megaUnlocked };
}

export function getActiveTrainerTagDef(meta: MetaProgressState): TrainerTagDef {
  const unlocked = getUnlockedTrainerTags(meta);
  const chosen = meta.activeTrainerTag && unlocked.includes(meta.activeTrainerTag)
    ? meta.activeTrainerTag
    : unlocked[unlocked.length - 1] ?? 'rookie_trainer';
  return TRAINER_TAG_CATALOG.find((t) => t.id === chosen) ?? TRAINER_TAG_CATALOG[0];
}

/** Computes per-Pokémon elemental synergy bonus from collected Gym Badges + active Trainer Tag! */
export function getElementalSynergyBonus(
  element: string,
  meta: MetaProgressState,
): { atkMult: number; cdMult: number } {
  let atkAdd = 0;
  let cdRed = 0;
  const tag = getActiveTrainerTagDef(meta);
  if (!tag.targetElements || tag.targetElements.includes(element)) {
    atkAdd += tag.atkBonus;
  }
  const earned = new Set(meta.unlockedBadges ?? []);
  for (const b of GYM_BADGE_CATALOG) {
    if (!earned.has(b.id)) continue;
    if (b.elements.includes('all') || b.elements.includes(element)) {
      atkAdd += b.atkBonus;
      cdRed += b.cdReduction;
    }
  }
  return {
    atkMult: 1 + atkAdd,
    cdMult: Math.max(0.68, 1 - cdRed),
  };
}

export function computeMetaCombatBonuses(meta: MetaProgressState): ComputedCombatBonuses {
  const lv = (id: LabUpgradeId) => meta.labLevels[id] ?? 0;
  const hero = getHeroDef(meta.activeHero);
  const s0 = meta.heroSkillLevels[hero.skills[0].id] ?? 0;
  const s1 = meta.heroSkillLevels[hero.skills[1].id] ?? 0;
  const evo = getHeroEvolutionStage(hero.id, meta.heroSkillLevels);
  const tag = getActiveTrainerTagDef(meta);
  const earnedBadges = new Set(meta.unlockedBadges ?? []);

  let dmgMult = 1 + lv('training') * 0.05 + hero.baseAtkBonus;
  let maxHpFlat = lv('vitality') * 14 + hero.baseHpBonus + Math.round(tag.hpPctBonus * 140);
  if (earnedBadges.has('boulder_badge')) maxHpFlat += 20;
  let speedMult = 1 + lv('agility') * 0.025 + hero.baseSpeedBonus + tag.speedBonus;
  const xpMult = 1 + lv('study') * 0.06 + (tag.id === 'rookie_trainer' ? 0.1 : 0);
  let coinMult = 1 + lv('trade') * 0.1 + tag.coinBonus;
  if (earnedBadges.has('earth_badge')) coinMult += 0.15;
  let stardustMult = 1 + lv('fortune') * 0.08;
  const pickupAdd = lv('magnet') * 0.7;
  let regenPerSec = lv('leftovers') * 0.5 + (earnedBadges.has('rainbow_badge') ? 0.6 : 0);
  let cdMult = Math.max(0.5, (1 - lv('haste') * 0.03) * tag.cdMultBonus);
  const rerolls = lv('reroll');
  const extraSquadSlots = lv('squad_cap');
  const revives = lv('revives');
  const catchRateBonus = lv('catch_master') * 0.04;
  const koDurationMult = 1 + lv('catch_master') * 0.2;
  const extraHealCharges = lv('supply_pack');
  let dmgReduction = Math.min(0.45, lv('armor') * 0.04);
  let bossDmgMult = 1.0 + tag.bossBonus;
  let critChance = Math.min(
    0.75,
    0.06 + lv('fortune') * 0.015 + lv('crit_rate') * 0.035 + (earnedBadges.has('volcano_badge') ? 0.06 : 0),
  );

  if (hero.id === 'red') {
    dmgMult += s0 * 0.04 + (s0 >= 5 ? 0.18 : 0);
    cdMult *= Math.max(0.7, 1 - s0 * 0.04);
    if (s0 >= 5) critChance += 0.12;
  } else if (hero.id === 'misty') {
    speedMult += s1 * 0.015;
    if (s1 >= 5) maxHpFlat += 40;
  } else if (hero.id === 'brock') {
    dmgReduction = Math.min(0.55, dmgReduction + s0 * 0.05 + (s0 >= 5 ? 0.1 : 0));
    if (s0 >= 5) regenPerSec += 1.2;
  } else if (hero.id === 'blue') {
    critChance += s0 * 0.035;
    if (s0 >= 5) cdMult *= 0.86;
    bossDmgMult += s1 * 0.1 + (s1 >= 5 ? 0.25 : 0);
    if (s1 >= 5) stardustMult += 0.35;
  }

  // Awakening form bonus
  if (evo.tier === 1) dmgMult += 0.06;
  if (evo.tier === 2) {
    dmgMult += 0.12;
    maxHpFlat += 25;
  }

  return {
    dmgMult,
    maxHpFlat,
    speedMult,
    xpMult,
    coinMult,
    stardustMult,
    pickupAdd,
    regenPerSec,
    cdMult,
    rerolls,
    dmgReduction,
    bossDmgMult,
    critChance,
    extraSquadSlots,
    revives,
    catchRateBonus,
    koDurationMult,
    extraHealCharges,
    heroId: hero.id,
    heroEvoTier: evo.tier,
    redBallLv: hero.id === 'red' ? s1 : 0,
    mistyTideLv: hero.id === 'misty' ? s0 : 0,
    mistyHealLv: hero.id === 'misty' ? s1 : 0,
    brockQuakeLv: hero.id === 'brock' ? s1 : 0,
    blueComboLv: hero.id === 'blue' ? s0 : 0,
  };
}
