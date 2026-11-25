import type { PixelIconName } from './pixelIcons';
import type {
  AccessoryId,
  FoodId,
  GachaBoxId,
  GrowthStage,
  IvRank,
  NatureId,
  PetIVs,
  PokemonElement,
  RarityTier,
  RoomThemeId,
  ShellThemeId,
  SpeciesId,
  TalentId,
} from '../types/pet';

export interface NatureMeta {
  id: NatureId;
  name: string;
  perk: string;
}

export const NATURE_CATALOG: Record<NatureId, NatureMeta> = {
  adamant: { id: 'adamant', name: '固执', perk: '意志坚定 · 活力充沛' },
  jolly: { id: 'jolly', name: '爽朗', perk: '阳光开朗 · 热爱冒险' },
  gentle: { id: 'gentle', name: '温顺', perk: '温柔粘人 · 亲密易升' },
  timid: { id: 'timid', name: '胆小', perk: '敏锐细腻 · 需要轻柔呵护' },
  relaxed: { id: 'relaxed', name: '悠闲', perk: '从容惬意 · 睡得香甜' },
  naughty: { id: 'naughty', name: '调皮', perk: '元气满满 · 好奇心爆棚' },
  serious: { id: 'serious', name: '认真', perk: '踏实专注 · 努力特训' },
  naive: { id: 'naive', name: '天真', perk: '纯真贪吃 · 喜欢甜果' },
};

export const NATURE_ORDER: NatureId[] = [
  'adamant',
  'jolly',
  'gentle',
  'timid',
  'relaxed',
  'naughty',
  'serious',
  'naive',
];

export interface TalentMeta {
  id: TalentId;
  name: string;
  perk: string;
  color: string;
}

export const TALENT_CATALOG: Record<TalentId, TalentMeta> = {
  prodigy: { id: 'prodigy', name: '特训奇才', perk: '获得 EXP +20%', color: '#228be6' },
  lucky: { id: 'lucky', name: '招财福星', perk: '获得金币 +25%', color: '#e67700' },
  gourmet: { id: 'gourmet', name: '元气吃货', perk: '喂食饱食与心情 +20%', color: '#d9480f' },
  sweetheart: { id: 'sweetheart', name: '粘人甜心', perk: '抚摸亲密与EXP额外提升', color: '#d6336c' },
  energetic: { id: 'energetic', name: '活力永动', perk: '体力回复加快 · 精力充沛', color: '#fab005' },
  clean_freak: { id: 'clean_freak', name: '洁癖爱美', perk: '不易弄脏 · 洗澡心情加倍', color: '#1098ad' },
  tough: { id: 'tough', name: '铁壁体质', perk: '健康稳固 · 不易生病', color: '#2f9e44' },
  shiny_soul: { id: 'shiny_soul', name: '闪耀潜能', perk: '全能天分 · EXP与金币 +15%', color: '#7950f2' },
};

export const TALENT_ORDER: TalentId[] = [
  'prodigy',
  'lucky',
  'gourmet',
  'sweetheart',
  'energetic',
  'clean_freak',
  'tough',
  'shiny_soul',
];

export function getIvRank(ivs: PetIVs): IvRank {
  const sum = ivs.atk + ivs.def + ivs.spd + ivs.charm;
  if (sum >= 108) return 'SS';
  if (sum >= 90) return 'S';
  if (sum >= 68) return 'A';
  return 'B';
}

export const SPECIES_RANDOM_NAMES: Record<SpeciesId, string[]> = {
  pikachu: [
    '皮卡丘', '皮卡皮', '闪电酱', '波奇', '雷雷', '皮卡布', '奶糖', '电火花',
    '小伏特', '噼啪', '柠檬电', '雷鸣丸', '十万伏', '小皮', '金闪闪', '放电宝',
  ],
  charmander: [
    '小火龙', '焰尾', '火球', '赤炎', '小炭', '火花儿', '暖炉', '红莲',
    '爆米花', '烈焰崽', '椒椒', '小火柴', '炽炽', '火龙果', '熔岩豆', '赤丸',
  ],
  bulbasaur: [
    '妙蛙种子', '青芽', '蒜头宝', '绿叶', '森森', '小嫩芽', '抹茶团', '豆苗',
    '青蛙崽', '花苞', '草帽', '向阳叶', '翠翠', '小绿豆', '藤蔓酱', '芽芽',
  ],
  squirtle: [
    '杰尼龟', '水波', '墨镜侠', '泡泡', '阿尼', '小浪花', '蓝莓壳', '水枪手',
    '清泉', '波波球', '龟龟侠', '碧波', '雨滴', '小漩涡', '海盐', '杰尼酱',
  ],
  eevee: [
    '伊布', '小布', '毛球', '奶茶', '焦糖布丁', '绒绒', '蓬蓬尾', '栗子',
    '咖啡豆', '松果', '奶油卷', '布布', '小狐狸', '曲奇', '暖绒', '甜筒',
  ],
  jigglypuff: [
    '胖丁', '粉团子', '棉花糖', '歌姬', '泡泡糖', '小汤圆', '草莓球', '麦克风',
    '圆滚滚', '甜心球', '嘟嘟', '催眠曲', '桃桃丸', '软绵绵', '糯米糍', '叮当',
  ],
  psyduck: [
    '可达鸭', '呆呆鸭', '头疼宝', '黄鸭鸭', '憨憨', '鸭梨', '念力鸭', '小呆瓜',
    '嘎嘎', '蛋黄派', '抱头鸭', '迷糊蛋', '小黄豆', '发呆君', '鸭鸭酱', '懵懵',
  ],
  meowth: [
    '喵喵', '招财猫', '金币喵', '小橘', '聚宝盆', '咪咪', '铜钱儿', '喵老板',
    '猫老大预备', '金元宝', '发财', '夜行喵', '铃铛喵', '闪亮喵', '喵呜', '钱多多',
  ],
  gastly: [
    '小耿鬼', '暗影球', '紫烟', '鬼鬼', '调皮影', '幽幽', '迷雾团', '小淘气',
    '黑糖球', '夜猫子', '幻影', '哈哈鬼', '紫葡萄', '烟圈儿', '影子宝', '咧嘴笑',
  ],
  munchlax: [
    '卡比', '饭团子', '大胃王', '贪吃鬼', '小胖墩', '肉包', '圆肚肚', '睡神',
    '满汉全席', '吃货宝', '糯米团', '懒洋洋', '饱饱', '点心桶', '干饭王', '呼噜',
  ],
  dratini: [
    '迷你龙', '小青龙', '蓝丝带', '云龙', '龙珠', '小锦鲤', '星辰龙', '碧鳞',
    '风铃龙', '小海龙', '青云', '灵龙', '浪龙儿', '天际', '瑞龙', '苍穹',
  ],
  mew: [
    '梦幻', '小粉幻', '星尘', '奇迹', '梦梦', '幻影星', '樱花灵', '起源',
    '月光泡', '星之子', '云端猫', '粉水晶', '许愿星', '梦境', '光羽', '小精灵',
  ],
};

export function pickRandomPetName(species: SpeciesId, exclude: string[] = []): string {
  const pool = SPECIES_RANDOM_NAMES[species] ?? [SPECIES_CATALOG[species].defaultName];
  const excludeSet = new Set(exclude.map((n) => n.trim()).filter(Boolean));
  const candidates = pool.filter((n) => !excludeSet.has(n));
  const list = candidates.length > 0 ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export interface PokemonPhysicalMetrics {
  heightM: number;
  weightKg: number;
}

/**
 * Official Pokédex physical height (m) & weight (kg) per species evolution stage.
 * Drives realistic 3D overworld proportions (e.g., 460kg Snorlax & 210kg Dragonite tower over 6kg Pikachu!).
 */
export const POKEMON_STAGE_METRICS: Record<SpeciesId, Record<GrowthStage, PokemonPhysicalMetrics>> = {
  bulbasaur: {
    baby: { heightM: 0.7, weightKg: 6.9 },
    teen: { heightM: 1.0, weightKg: 13.0 },
    adult: { heightM: 2.0, weightKg: 100.0 },
  },
  charmander: {
    baby: { heightM: 0.6, weightKg: 8.5 },
    teen: { heightM: 1.1, weightKg: 19.0 },
    adult: { heightM: 1.7, weightKg: 90.5 },
  },
  squirtle: {
    baby: { heightM: 0.5, weightKg: 9.0 },
    teen: { heightM: 1.0, weightKg: 22.5 },
    adult: { heightM: 1.6, weightKg: 85.5 },
  },
  pikachu: {
    baby: { heightM: 0.4, weightKg: 6.0 },
    teen: { heightM: 0.5, weightKg: 8.0 },
    adult: { heightM: 0.8, weightKg: 30.0 },
  },
  eevee: {
    baby: { heightM: 0.3, weightKg: 6.5 },
    teen: { heightM: 0.9, weightKg: 26.5 },
    adult: { heightM: 1.0, weightKg: 27.0 },
  },
  jigglypuff: {
    baby: { heightM: 0.5, weightKg: 5.5 },
    teen: { heightM: 0.6, weightKg: 7.5 },
    adult: { heightM: 1.0, weightKg: 12.0 },
  },
  psyduck: {
    baby: { heightM: 0.8, weightKg: 19.6 },
    teen: { heightM: 1.1, weightKg: 38.0 },
    adult: { heightM: 1.7, weightKg: 76.6 },
  },
  meowth: {
    baby: { heightM: 0.4, weightKg: 4.2 },
    teen: { heightM: 0.7, weightKg: 14.0 },
    adult: { heightM: 1.0, weightKg: 32.0 },
  },
  gastly: {
    baby: { heightM: 1.3, weightKg: 0.1 },
    teen: { heightM: 1.6, weightKg: 0.1 },
    adult: { heightM: 1.5, weightKg: 40.5 },
  },
  munchlax: {
    baby: { heightM: 0.6, weightKg: 105.0 },
    teen: { heightM: 1.2, weightKg: 210.0 },
    adult: { heightM: 2.1, weightKg: 460.0 },
  },
  dratini: {
    baby: { heightM: 1.8, weightKg: 3.3 },
    teen: { heightM: 4.0, weightKg: 16.5 },
    adult: { heightM: 2.2, weightKg: 210.0 },
  },
  mew: {
    baby: { heightM: 0.4, weightKg: 4.0 },
    teen: { heightM: 0.45, weightKg: 4.0 },
    adult: { heightM: 0.5, weightKg: 4.0 },
  },
};

export function getPokemonPhysicalMetrics(
  species: SpeciesId,
  stage: GrowthStage,
): PokemonPhysicalMetrics {
  return POKEMON_STAGE_METRICS[species]?.[stage] ?? { heightM: 0.6, weightKg: 10.0 };
}

/**
 * Maps official Pokédex height (m) & weight (kg) into crisp, readable 3D world scale:
 * - Small 0.3–0.6m Pokémon (Pikachu, Eevee, Jigglypuff): ~1.72 – 1.92m
 * - Mid 1.0–1.5m Pokémon (Raichu, Gengar, Charmeleon): ~2.35 – 2.85m
 * - Heavyweights (Charizard 90kg, Venusaur 100kg, Dragonite 210kg): ~3.10 – 3.70m
 * - Colossal Snorlax (2.1m / 460kg): ~4.25m (and Boss Snorlax ~5.1m!)
 */
export function getPokemonWorldScale3D(
  species: SpeciesId,
  stage: GrowthStage,
  extraMult = 1.0,
): number {
  const { heightM, weightKg } = getPokemonPhysicalMetrics(species, stage);
  // Iconic large fully-evolved Pokémon (Charizard, Dragonite, Snorlax, Venusaur, Blastoise) feel genuinely majestic!
  const isGiantDragon = (species === 'charmander' || species === 'dratini') && stage === 'adult';
  const effHeight = Math.min(2.6, heightM);
  const weightBoost = Math.pow(Math.max(1, weightKg), 0.25) * 0.46;
  const base = (1.05 + effHeight * 0.68 + weightBoost) * (isGiantDragon ? 1.24 : 1.0);
  return Number((Math.max(1.68, Math.min(5.6, base)) * extraMult).toFixed(2));
}

export interface SpeciesMeta {
  id: SpeciesId;
  dexNo: string;
  title: string;
  english: string;
  defaultName: string;
  rarity: RarityTier;
  starter?: boolean;
  element: PokemonElement;
  typeLabel: string;
  typeIcon: PixelIconName;
  typeColor: string;
  stageNames: Record<GrowthStage, string>;
  stageDexNos: Record<GrowthStage, string>;
  stageSprites: Record<
    GrowthStage,
    { animated: string; static: string; icon: string; portrait: string; sleep: string }
  >;
  evoLevels: { teen: number; adult: number };
  trait: string;
  favoriteFood: FoodId;
  description: string;
}

export const SPECIES_CATALOG: Record<SpeciesId, SpeciesMeta> = {
  bulbasaur: {
    id: 'bulbasaur',
    dexNo: '#001',
    title: '妙蛙种子',
    english: 'BULBASAUR',
    defaultName: '妙蛙种子',
    rarity: 'R',
    starter: true,
    element: 'grass',
    typeLabel: '草系',
    typeIcon: 'leaf',
    typeColor: '#40c057',
    stageNames: { baby: '妙蛙种子', teen: '妙蛙草', adult: '妙蛙花' },
    stageDexNos: { baby: '#001', teen: '#002', adult: '#003' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/1.gif', static: '/sprites/pokemon/1.png', icon: '/sprites/pokemon/icon-1.png', portrait: '/sprites/pokemon/portrait-1.png', sleep: '/sprites/pokemon/sleep-1.gif' },
      teen: { animated: '/sprites/pokemon/2.gif', static: '/sprites/pokemon/2.png', icon: '/sprites/pokemon/icon-2.png', portrait: '/sprites/pokemon/portrait-2.png', sleep: '/sprites/pokemon/sleep-2.gif' },
      adult: { animated: '/sprites/pokemon/3.gif', static: '/sprites/pokemon/3.png', icon: '/sprites/pokemon/icon-3.png', portrait: '/sprites/pokemon/portrait-3.png', sleep: '/sprites/pokemon/sleep-3.gif' },
    },
    evoLevels: { teen: 16, adult: 32 },
    trait: '背生种子 · 爱晒日光',
    favoriteFood: 'oran_berry',
    description: '背上的神奇种子伴随成长在 Lv.16 萌芽，Lv.32 绽放为妙蛙花。',
  },
  charmander: {
    id: 'charmander',
    dexNo: '#004',
    title: '小火龙',
    english: 'CHARMANDER',
    defaultName: '小火龙',
    rarity: 'R',
    starter: true,
    element: 'fire',
    typeLabel: '火系',
    typeIcon: 'fire',
    typeColor: '#ff5924',
    stageNames: { baby: '小火龙', teen: '火恐龙', adult: '喷火龙' },
    stageDexNos: { baby: '#004', teen: '#005', adult: '#006' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/4.gif', static: '/sprites/pokemon/4.png', icon: '/sprites/pokemon/icon-4.png', portrait: '/sprites/pokemon/portrait-4.png', sleep: '/sprites/pokemon/sleep-4.gif' },
      teen: { animated: '/sprites/pokemon/5.gif', static: '/sprites/pokemon/5.png', icon: '/sprites/pokemon/icon-5.png', portrait: '/sprites/pokemon/portrait-5.png', sleep: '/sprites/pokemon/sleep-5.gif' },
      adult: { animated: '/sprites/pokemon/6.gif', static: '/sprites/pokemon/6.png', icon: '/sprites/pokemon/icon-6.png', portrait: '/sprites/pokemon/portrait-6.png', sleep: '/sprites/pokemon/sleep-6.gif' },
    },
    evoLevels: { teen: 16, adult: 36 },
    trait: '尾焰永燃 · 热血开朗',
    favoriteFood: 'curry',
    description: 'Lv.16 进化为火恐龙，历练至 Lv.36 便能展翼化作喷火龙！',
  },
  squirtle: {
    id: 'squirtle',
    dexNo: '#007',
    title: '杰尼龟',
    english: 'SQUIRTLE',
    defaultName: '杰尼龟',
    rarity: 'R',
    starter: true,
    element: 'water',
    typeLabel: '水系',
    typeIcon: 'water',
    typeColor: '#339af0',
    stageNames: { baby: '杰尼龟', teen: '卡咪龟', adult: '水箭龟' },
    stageDexNos: { baby: '#007', teen: '#008', adult: '#009' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/7.gif', static: '/sprites/pokemon/7.png', icon: '/sprites/pokemon/icon-7.png', portrait: '/sprites/pokemon/portrait-7.png', sleep: '/sprites/pokemon/sleep-7.gif' },
      teen: { animated: '/sprites/pokemon/8.gif', static: '/sprites/pokemon/8.png', icon: '/sprites/pokemon/icon-8.png', portrait: '/sprites/pokemon/portrait-8.png', sleep: '/sprites/pokemon/sleep-8.gif' },
      adult: { animated: '/sprites/pokemon/9.gif', static: '/sprites/pokemon/9.png', icon: '/sprites/pokemon/icon-9.png', portrait: '/sprites/pokemon/portrait-9.png', sleep: '/sprites/pokemon/sleep-9.gif' },
    },
    evoLevels: { teen: 16, adult: 36 },
    trait: '水枪戏水 · 墨镜控',
    favoriteFood: 'moomoo_milk',
    description: 'Lv.16 成长为卡咪龟，Lv.36 解锁高压水炮形态水箭龟！',
  },
  pikachu: {
    id: 'pikachu',
    dexNo: '#025',
    title: '皮卡丘',
    english: 'PIKACHU',
    defaultName: '皮卡丘',
    rarity: 'SR',
    starter: true,
    element: 'electric',
    typeLabel: '电系',
    typeIcon: 'bolt',
    typeColor: '#f5b700',
    stageNames: { baby: '皮卡丘', teen: '雷丘', adult: '闪光雷丘' },
    stageDexNos: { baby: '#025', teen: '#026', adult: '#026' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/25.gif', static: '/sprites/pokemon/25.png', icon: '/sprites/pokemon/icon-25.png', portrait: '/sprites/pokemon/portrait-25.png', sleep: '/sprites/pokemon/sleep-25.gif' },
      teen: { animated: '/sprites/pokemon/26.gif', static: '/sprites/pokemon/26.png', icon: '/sprites/pokemon/icon-26.png', portrait: '/sprites/pokemon/portrait-26.png', sleep: '/sprites/pokemon/sleep-26.gif' },
      adult: { animated: '/sprites/pokemon/26-shiny.gif', static: '/sprites/pokemon/26.png', icon: '/sprites/pokemon/icon-26.png', portrait: '/sprites/pokemon/portrait-26.png', sleep: '/sprites/pokemon/sleep-26-shiny.gif' },
    },
    evoLevels: { teen: 22, adult: 36 },
    trait: '十万伏特 · 脸颊蓄电',
    favoriteFood: 'sitrus_berry',
    description: '高人气电系搭档，Lv.22 进化雷丘，Lv.36 觉醒稀有闪光形态！',
  },
  jigglypuff: {
    id: 'jigglypuff',
    dexNo: '#039',
    title: '胖丁',
    english: 'JIGGLYPUFF',
    defaultName: '胖丁',
    rarity: 'R',
    element: 'fairy',
    typeLabel: '妖精',
    typeIcon: 'heart',
    typeColor: '#f06595',
    stageNames: { baby: '胖丁', teen: '胖可丁', adult: '胖可丁' },
    stageDexNos: { baby: '#039', teen: '#040', adult: '#040' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/39.gif', static: '/sprites/pokemon/39.png', icon: '/sprites/pokemon/icon-39.png', portrait: '/sprites/pokemon/portrait-39.png', sleep: '/sprites/pokemon/sleep-39.gif' },
      teen: { animated: '/sprites/pokemon/40.gif', static: '/sprites/pokemon/40.png', icon: '/sprites/pokemon/icon-40.png', portrait: '/sprites/pokemon/portrait-40.png', sleep: '/sprites/pokemon/sleep-40.gif' },
      adult: { animated: '/sprites/pokemon/40.gif', static: '/sprites/pokemon/40.png', icon: '/sprites/pokemon/icon-40.png', portrait: '/sprites/pokemon/portrait-40.png', sleep: '/sprites/pokemon/sleep-40.gif' },
    },
    evoLevels: { teen: 22, adult: 22 },
    trait: '治愈歌声 · 圆滚滚',
    favoriteFood: 'pokepuff',
    description: 'Lv.22 月之共鸣进化为胖可丁，柔软如棉花糖的气球宝可梦。',
  },
  meowth: {
    id: 'meowth',
    dexNo: '#052',
    title: '喵喵',
    english: 'MEOWTH',
    defaultName: '喵喵',
    rarity: 'R',
    element: 'normal',
    typeLabel: '一般',
    typeIcon: 'coin',
    typeColor: '#8d8b7e',
    stageNames: { baby: '喵喵', teen: '猫老大', adult: '猫老大' },
    stageDexNos: { baby: '#052', teen: '#053', adult: '#053' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/52.gif', static: '/sprites/pokemon/52.png', icon: '/sprites/pokemon/icon-52.png', portrait: '/sprites/pokemon/portrait-52.png', sleep: '/sprites/pokemon/sleep-52.gif' },
      teen: { animated: '/sprites/pokemon/53.gif', static: '/sprites/pokemon/53.png', icon: '/sprites/pokemon/icon-53.png', portrait: '/sprites/pokemon/portrait-53.png', sleep: '/sprites/pokemon/sleep-53.gif' },
      adult: { animated: '/sprites/pokemon/53.gif', static: '/sprites/pokemon/53.png', icon: '/sprites/pokemon/icon-53.png', portrait: '/sprites/pokemon/portrait-53.png', sleep: '/sprites/pokemon/sleep-53.gif' },
    },
    evoLevels: { teen: 28, adult: 28 },
    trait: '聚宝功 · 爱闪亮金币',
    favoriteFood: 'sitrus_berry',
    description: '对金币毫无抵抗力，升到 Lv.28 后进化为优雅的猫老大！',
  },
  psyduck: {
    id: 'psyduck',
    dexNo: '#054',
    title: '可达鸭',
    english: 'PSYDUCK',
    defaultName: '可达鸭',
    rarity: 'R',
    element: 'water',
    typeLabel: '水系',
    typeIcon: 'water',
    typeColor: '#339af0',
    stageNames: { baby: '可达鸭', teen: '哥达鸭', adult: '哥达鸭' },
    stageDexNos: { baby: '#054', teen: '#055', adult: '#055' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/54.gif', static: '/sprites/pokemon/54.png', icon: '/sprites/pokemon/icon-54.png', portrait: '/sprites/pokemon/portrait-54.png', sleep: '/sprites/pokemon/sleep-54.gif' },
      teen: { animated: '/sprites/pokemon/55.gif', static: '/sprites/pokemon/55.png', icon: '/sprites/pokemon/icon-55.png', portrait: '/sprites/pokemon/portrait-55.png', sleep: '/sprites/pokemon/sleep-55.gif' },
      adult: { animated: '/sprites/pokemon/55.gif', static: '/sprites/pokemon/55.png', icon: '/sprites/pokemon/icon-55.png', portrait: '/sprites/pokemon/portrait-55.png', sleep: '/sprites/pokemon/sleep-55.gif' },
    },
    evoLevels: { teen: 33, adult: 33 },
    trait: '抱头呆萌 · 隐藏念力',
    favoriteFood: 'moomoo_milk',
    description: '平时抱着脑袋呆呆傻傻，Lv.33 念力爆发进化为迅捷的哥达鸭！',
  },
  gastly: {
    id: 'gastly',
    dexNo: '#092',
    title: '鬼斯',
    english: 'GASTLY',
    defaultName: '小耿鬼',
    rarity: 'SR',
    element: 'ghost',
    typeLabel: '幽灵',
    typeIcon: 'ghost',
    typeColor: '#7950f2',
    stageNames: { baby: '鬼斯', teen: '鬼斯通', adult: '耿鬼' },
    stageDexNos: { baby: '#092', teen: '#093', adult: '#094' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/92.gif', static: '/sprites/pokemon/92.png', icon: '/sprites/pokemon/icon-92.png', portrait: '/sprites/pokemon/portrait-92.png', sleep: '/sprites/pokemon/sleep-92.gif' },
      teen: { animated: '/sprites/pokemon/93.gif', static: '/sprites/pokemon/93.png', icon: '/sprites/pokemon/icon-93.png', portrait: '/sprites/pokemon/portrait-93.png', sleep: '/sprites/pokemon/sleep-93.gif' },
      adult: { animated: '/sprites/pokemon/94.gif', static: '/sprites/pokemon/94.png', icon: '/sprites/pokemon/icon-94.png', portrait: '/sprites/pokemon/portrait-94.png', sleep: '/sprites/pokemon/sleep-94.gif' },
    },
    evoLevels: { teen: 25, adult: 42 },
    trait: '调皮吐舌 · 暗影伙伴',
    favoriteFood: 'curry',
    description: 'Lv.25 进化成鬼斯通，继续培育至 Lv.42 成为人气王耿鬼！',
  },
  eevee: {
    id: 'eevee',
    dexNo: '#133',
    title: '伊布',
    english: 'EEVEE',
    defaultName: '伊布',
    rarity: 'R',
    element: 'normal',
    typeLabel: '一般',
    typeIcon: 'star',
    typeColor: '#c08552',
    stageNames: { baby: '伊布', teen: '太阳伊布', adult: '月亮伊布' },
    stageDexNos: { baby: '#133', teen: '#196', adult: '#197' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/133.gif', static: '/sprites/pokemon/133.png', icon: '/sprites/pokemon/icon-133.png', portrait: '/sprites/pokemon/portrait-133.png', sleep: '/sprites/pokemon/sleep-133.gif' },
      teen: { animated: '/sprites/pokemon/196.gif', static: '/sprites/pokemon/196.png', icon: '/sprites/pokemon/icon-196.png', portrait: '/sprites/pokemon/portrait-196.png', sleep: '/sprites/pokemon/sleep-196.gif' },
      adult: { animated: '/sprites/pokemon/197.gif', static: '/sprites/pokemon/197.png', icon: '/sprites/pokemon/icon-197.png', portrait: '/sprites/pokemon/portrait-197.png', sleep: '/sprites/pokemon/sleep-197.gif' },
    },
    evoLevels: { teen: 20, adult: 36 },
    trait: '无限进化 · 蓬松围脖',
    favoriteFood: 'pokepuff',
    description: '亲密培养至 Lv.20/36 可在太阳伊布与月亮伊布形态间蜕变！',
  },
  munchlax: {
    id: 'munchlax',
    dexNo: '#446',
    title: '小卡比兽',
    english: 'MUNCHLAX',
    defaultName: '卡比',
    rarity: 'SR',
    element: 'normal',
    typeLabel: '一般',
    typeIcon: 'meat',
    typeColor: '#2f728f',
    stageNames: { baby: '小卡比兽', teen: '卡比兽', adult: '卡比兽' },
    stageDexNos: { baby: '#446', teen: '#143', adult: '#143' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/446.gif', static: '/sprites/pokemon/446.png', icon: '/sprites/pokemon/icon-446.png', portrait: '/sprites/pokemon/portrait-446.png', sleep: '/sprites/pokemon/sleep-446.gif' },
      teen: { animated: '/sprites/pokemon/143.gif', static: '/sprites/pokemon/143.png', icon: '/sprites/pokemon/icon-143.png', portrait: '/sprites/pokemon/portrait-143.png', sleep: '/sprites/pokemon/sleep-143.gif' },
      adult: { animated: '/sprites/pokemon/143.gif', static: '/sprites/pokemon/143.png', icon: '/sprites/pokemon/icon-143.png', portrait: '/sprites/pokemon/portrait-143.png', sleep: '/sprites/pokemon/sleep-143.gif' },
    },
    evoLevels: { teen: 24, adult: 24 },
    trait: '超级吃货 · 懒洋洋',
    favoriteFood: 'curry',
    description: '吃饱喝足成长至 Lv.24，就会进化成慵懒软绵的大卡比兽！',
  },
  dratini: {
    id: 'dratini',
    dexNo: '#147',
    title: '迷你龙',
    english: 'DRATINI',
    defaultName: '迷你龙',
    rarity: 'SSR',
    element: 'dragon',
    typeLabel: '龙系',
    typeIcon: 'sparkle',
    typeColor: '#5c7cfa',
    stageNames: { baby: '迷你龙', teen: '哈克龙', adult: '快龙' },
    stageDexNos: { baby: '#147', teen: '#148', adult: '#149' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/147.gif', static: '/sprites/pokemon/147.png', icon: '/sprites/pokemon/icon-147.png', portrait: '/sprites/pokemon/portrait-147.png', sleep: '/sprites/pokemon/sleep-147.gif' },
      teen: { animated: '/sprites/pokemon/148.gif', static: '/sprites/pokemon/148.png', icon: '/sprites/pokemon/icon-148.png', portrait: '/sprites/pokemon/portrait-148.png', sleep: '/sprites/pokemon/sleep-148.gif' },
      adult: { animated: '/sprites/pokemon/149.gif', static: '/sprites/pokemon/149.png', icon: '/sprites/pokemon/icon-149.png', portrait: '/sprites/pokemon/portrait-149.png', sleep: '/sprites/pokemon/sleep-149.gif' },
    },
    evoLevels: { teen: 30, adult: 55 },
    trait: '龙系准神 · 温柔守护',
    favoriteFood: 'rare_candy',
    description: '大器晚成的龙系准神！Lv.30 进化哈克龙，Lv.55 化作快龙！',
  },
  mew: {
    id: 'mew',
    dexNo: '#151',
    title: '梦幻',
    english: 'MEW',
    defaultName: '梦幻',
    rarity: 'SSR',
    element: 'psychic',
    typeLabel: '超能力',
    typeIcon: 'psychic',
    typeColor: '#e64980',
    stageNames: { baby: '梦幻', teen: '梦幻', adult: '梦幻' },
    stageDexNos: { baby: '#151', teen: '#151', adult: '#151' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/151.gif', static: '/sprites/pokemon/151.png', icon: '/sprites/pokemon/icon-151.png', portrait: '/sprites/pokemon/portrait-151.png', sleep: '/sprites/pokemon/sleep-151.gif' },
      teen: { animated: '/sprites/pokemon/151.gif', static: '/sprites/pokemon/151.png', icon: '/sprites/pokemon/icon-151.png', portrait: '/sprites/pokemon/portrait-151.png', sleep: '/sprites/pokemon/sleep-151.gif' },
      adult: { animated: '/sprites/pokemon/151.gif', static: '/sprites/pokemon/151.png', icon: '/sprites/pokemon/icon-151.png', portrait: '/sprites/pokemon/portrait-151.png', sleep: '/sprites/pokemon/sleep-151.gif' },
    },
    evoLevels: { teen: 30, adult: 50 },
    trait: '幻之宝可梦 · 纯真好奇',
    favoriteFood: 'rare_candy',
    description: '无需进化的幻之宝可梦，蕴含全部基因，Lv.30/50 解锁高阶共鸣！',
  },
};

export const POKEDEX_ORDER: SpeciesId[] = [
  'bulbasaur',
  'charmander',
  'squirtle',
  'pikachu',
  'jigglypuff',
  'meowth',
  'psyduck',
  'gastly',
  'eevee',
  'munchlax',
  'dratini',
  'mew',
];

export interface GachaBoxMeta {
  id: GachaBoxId;
  name: string;
  price: number;
  tenPrice: number;
  ballSprite: string;
  badge: string;
  description: string;
  pool: { species: SpeciesId; weight: number }[];
}

export const GACHA_BOXES: GachaBoxMeta[] = [
  {
    id: 'normal_box',
    name: '普通精灵盲盒',
    price: 75,
    tenPrice: 675,
    ballSprite: '/sprites/items/poke-ball.png',
    badge: 'R / SR',
    description: '高性价比日常盲盒，十连9折且必出 SR 及以上！',
    pool: [
      { species: 'bulbasaur', weight: 16 },
      { species: 'charmander', weight: 16 },
      { species: 'squirtle', weight: 16 },
      { species: 'eevee', weight: 16 },
      { species: 'jigglypuff', weight: 14 },
      { species: 'meowth', weight: 14 },
      { species: 'psyduck', weight: 14 },
      { species: 'pikachu', weight: 7 },
      { species: 'gastly', weight: 4 },
    ],
  },
  {
    id: 'great_box',
    name: '高级特训盲盒',
    price: 145,
    tenPrice: 1300,
    ballSprite: '/sprites/items/great-ball.png',
    badge: 'SR UP',
    description: '大幅提升 SR 概率，十连享优惠并保底 SR/SSR！',
    pool: [
      { species: 'pikachu', weight: 22 },
      { species: 'gastly', weight: 20 },
      { species: 'munchlax', weight: 20 },
      { species: 'eevee', weight: 16 },
      { species: 'charmander', weight: 10 },
      { species: 'dratini', weight: 7 },
      { species: 'mew', weight: 3 },
    ],
  },
  {
    id: 'master_box',
    name: '传说大师盲盒',
    price: 240,
    tenPrice: 2160,
    ballSprite: '/sprites/items/master-ball.png',
    badge: 'SSR UP!',
    description: '高概率开出准神迷你龙与幻之宝可梦「梦幻」！',
    pool: [
      { species: 'mew', weight: 26 },
      { species: 'dratini', weight: 28 },
      { species: 'pikachu', weight: 18 },
      { species: 'gastly', weight: 16 },
      { species: 'munchlax', weight: 14 },
    ],
  },
];

export interface FoodMeta {
  id: FoodId;
  name: string;
  price: number;
  unlimited?: boolean;
  hunger: number;
  happiness: number;
  energy: number;
  health?: number;
  curesSick?: boolean;
  levelUp?: boolean;
  xp: number;
  itemSprite: string;
  description: string;
}

export const FOOD_CATALOG: FoodMeta[] = [
  {
    id: 'oran_berry',
    name: '橙橙果',
    price: 0,
    unlimited: true,
    hunger: 22,
    happiness: 6,
    energy: 4,
    xp: 28,
    itemSprite: '/sprites/items/oran-berry.png',
    description: '真新镇随处可见的蓝色基础树果，免费无限供应。',
  },
  {
    id: 'pecha_berry',
    name: '桃桃果',
    price: 10,
    hunger: 18,
    happiness: 18,
    energy: 6,
    xp: 42,
    itemSprite: '/sprites/items/pecha-berry.png',
    description: '粉嫩清甜的桃桃果，深受可爱宝可梦喜爱！',
  },
  {
    id: 'cheri_berry',
    name: '樱子果',
    price: 12,
    hunger: 16,
    happiness: 12,
    energy: 18,
    xp: 48,
    itemSprite: '/sprites/items/cheri-berry.png',
    description: '鲜红带甜辣味的樱子果，吃一口精神抖擞！',
  },
  {
    id: 'chesto_berry',
    name: '零余果',
    price: 14,
    hunger: 14,
    happiness: 8,
    energy: 28,
    xp: 55,
    itemSprite: '/sprites/items/chesto-berry.png',
    description: '微涩爽脆的零余果，迅速驱散疲惫与困意！',
  },
  {
    id: 'sitrus_berry',
    name: '文柚果',
    price: 15,
    hunger: 36,
    happiness: 18,
    energy: 8,
    health: 10,
    xp: 65,
    itemSprite: '/sprites/items/sitrus-berry.png',
    description: '酸甜多汁的金黄树果，回复饱食与少量健康值！',
  },
  {
    id: 'moomoo_milk',
    name: '哞哞鲜奶',
    price: 22,
    hunger: 24,
    happiness: 16,
    energy: 36,
    health: 8,
    xp: 85,
    itemSprite: '/sprites/items/moomoo-milk.png',
    description: '大奶罐牧场直供浓醇鲜奶，快速补充精力！',
  },
  {
    id: 'lum_berry',
    name: '木子果',
    price: 28,
    hunger: 20,
    happiness: 18,
    energy: 18,
    health: 22,
    curesSick: true,
    xp: 110,
    itemSprite: '/sprites/items/lum-berry.png',
    description: '缓解百病的奇迹碧绿树果，回复健康并治愈生病状态！',
  },
  {
    id: 'pokepuff',
    name: '心形甜点',
    price: 32,
    hunger: 28,
    happiness: 42,
    energy: 12,
    xp: 125,
    itemSprite: '/sprites/items/sweet-heart.png',
    description: '甜蜜满分的宝可梦点心，亲密度瞬间飙升！',
  },
  {
    id: 'casteliacone',
    name: '飞云冰淇淋',
    price: 35,
    hunger: 26,
    happiness: 46,
    energy: 20,
    xp: 140,
    itemSprite: '/sprites/items/casteliacone.png',
    description: '飞云市排队才买得到的招牌双球冰激凌，幸福满分！',
  },
  {
    id: 'curry',
    name: '釜炎仙贝',
    price: 38,
    hunger: 60,
    happiness: 24,
    energy: 14,
    xp: 160,
    itemSprite: '/sprites/items/lava-cookie.png',
    description: '釜炎镇名产香酥特制点心，大胃王的最爱！',
  },
  {
    id: 'rage_candy',
    name: '愤怒馒头',
    price: 48,
    hunger: 42,
    happiness: 30,
    energy: 32,
    health: 16,
    xp: 220,
    itemSprite: '/sprites/items/rage-candy-bar.png',
    description: '卡吉镇名产特制营养点心，大幅补充饱食、精力与经验！',
  },
  {
    id: 'rare_candy',
    name: '神奇糖果',
    price: 120,
    hunger: 12,
    happiness: 25,
    energy: 20,
    levelUp: true,
    xp: 0,
    itemSprite: '/sprites/items/rare-candy.png',
    description: '蕴含神秘能量的珍稀糖果，服用后等级直接 +1 Lv.！',
  },
];

export interface AccessoryMeta {
  id: AccessoryId;
  name: string;
  price: number;
  itemSprite: string;
  description: string;
}

export const ACCESSORY_CATALOG: AccessoryMeta[] = [
  {
    id: 'none',
    name: '无道具',
    price: 0,
    itemSprite: '/sprites/items/poke-ball.png',
    description: '卸下当前携带的道具。',
  },
  {
    id: 'sprout',
    name: '奇迹种子',
    price: 40,
    itemSprite: '/sprites/items/miracle-seed.png',
    description: '蕴含草木生机的奇迹种子。',
  },
  {
    id: 'bow',
    name: '心形饰品',
    price: 55,
    itemSprite: '/sprites/items/sweet-heart.png',
    description: '华丽大赛魅力搭档甜心饰品！',
  },
  {
    id: 'charcoal',
    name: '木炭',
    price: 60,
    itemSprite: '/sprites/items/charcoal.png',
    description: '温暖微烫的火系特训木炭，元气加倍！',
  },
  {
    id: 'mystic_water',
    name: '神秘水滴',
    price: 60,
    itemSprite: '/sprites/items/mystic-water.png',
    description: '澄澈透亮的水滴吊坠，清凉舒心。',
  },
  {
    id: 'magnet',
    name: '磁铁',
    price: 65,
    itemSprite: '/sprites/items/magnet.png',
    description: '滋滋带电的马蹄形磁铁，电系宝可梦最爱！',
  },
  {
    id: 'silk_scarf',
    name: '丝绸围巾',
    price: 65,
    itemSprite: '/sprites/items/silk-scarf.png',
    description: '柔滑细腻的银白丝绸围巾，百搭优雅！',
  },
  {
    id: 'scarf',
    name: '讲究围巾',
    price: 70,
    itemSprite: '/sprites/items/choice-scarf.png',
    description: '帅气蓝红围巾，探险气势瞬间提升。',
  },
  {
    id: 'metronome',
    name: '节拍器',
    price: 80,
    itemSprite: '/sprites/items/metronome.png',
    description: '滴答摇摆的节奏摆钟，特训节奏更顺畅！',
  },
  {
    id: 'shades',
    name: '黑色眼镜',
    price: 90,
    itemSprite: '/sprites/items/black-glasses.png',
    description: '杰尼消防队同款酷炫黑超墨镜！',
  },
  {
    id: 'focus_band',
    name: '气势头带',
    price: 100,
    itemSprite: '/sprites/items/focus-band.png',
    description: '系上后斗志满满的炽红训练头带！',
  },
  {
    id: 'quick_claw',
    name: '先制之爪',
    price: 105,
    itemSprite: '/sprites/items/quick-claw.png',
    description: '轻盈迅捷的黄金钩爪饰品，身手敏捷！',
  },
  {
    id: 'focus_sash',
    name: '气势披带',
    price: 115,
    itemSprite: '/sprites/items/focus-sash.png',
    description: '守护意志的红白披带，永不言弃！',
  },
  {
    id: 'tophat',
    name: '安抚之铃',
    price: 120,
    itemSprite: '/sprites/items/soothe-bell.png',
    description: '清脆悦耳，快速增进亲密羁绊。',
  },
  {
    id: 'scope_lens',
    name: '焦点镜',
    price: 125,
    itemSprite: '/sprites/items/scope-lens.png',
    description: '能看透细微弱点的特制侦查镜片！',
  },
  {
    id: 'everstone',
    name: '不变之石',
    price: 135,
    itemSprite: '/sprites/items/everstone.png',
    description: '圆润温和的神秘矿石，守护当下纯真模样。',
  },
  {
    id: 'bright_powder',
    name: '光粉',
    price: 140,
    itemSprite: '/sprites/items/bright-powder.png',
    description: '在阳光下闪烁微光的梦幻星粉袋！',
  },
  {
    id: 'shell_bell',
    name: '贝壳之铃',
    price: 150,
    itemSprite: '/sprites/items/shell-bell.png',
    description: '海潮余韵萦绕的清透贝铃，陪伴心情舒畅。',
  },
  {
    id: 'destiny_knot',
    name: '红线',
    price: 155,
    itemSprite: '/sprites/items/destiny-knot.png',
    description: '系结羁绊的绯红丝线，浪漫又温暖！',
  },
  {
    id: 'leftovers',
    name: '吃剩的东西',
    price: 165,
    itemSprite: '/sprites/items/leftovers.png',
    description: '吃货搭档的随身零食小罐，安全感满满！',
  },
  {
    id: 'life_orb',
    name: '生命宝珠',
    price: 175,
    itemSprite: '/sprites/items/life-orb.png',
    description: '蕴藏澎湃潜能的绯红晶体宝珠！',
  },
  {
    id: 'crown',
    name: '王者之证',
    price: 180,
    itemSprite: '/sprites/items/kings-rock.png',
    description: '联盟冠军黄金王冠，闪耀全场！',
  },
  {
    id: 'exp_share',
    name: '学习装置',
    price: 195,
    itemSprite: '/sprites/items/exp-share.png',
    description: '关都科技出品的特训仪，助力快乐成长！',
  },
  {
    id: 'amulet_coin',
    name: '护符金币',
    price: 210,
    itemSprite: '/sprites/items/amulet-coin.png',
    description: '象征丰收好运的金光护符！',
  },
  {
    id: 'lucky_egg',
    name: '幸运蛋',
    price: 240,
    itemSprite: '/sprites/items/lucky-egg.png',
    description: '带来祝福与丰厚成长运势的洁白幸运蛋！',
  },
];

export interface RoomMeta {
  id: RoomThemeId;
  tierLabel: string;
  name: string;
  shortName: string;
  price: number;
  ballSprite: string;
  daySky: string;
  nightSky: string;
  floorColor: string;
  description: string;
}

export const ROOM_CATALOG: RoomMeta[] = [
  {
    id: 'pokeball_room',
    tierLabel: '经典球',
    name: '红白精灵球 · 温馨小屋',
    shortName: '精灵球',
    price: 0,
    ballSprite: '/sprites/items/poke-ball.png',
    daySky: '#f5f2ea',
    nightSky: '#1c2333',
    floorColor: '#e4dfd3',
    description: '经典红白穹顶、原木书架、暖光台灯与编织地毯。',
  },
  {
    id: 'healball_room',
    tierLabel: '甜美球',
    name: '治愈球 · 樱粉甜品屋',
    shortName: '治愈球',
    price: 85,
    ballSprite: '/sprites/items/heal-ball.png',
    daySky: '#fff0f6',
    nightSky: '#2c192b',
    floorColor: '#f8d7e8',
    description: '樱粉薄荷配色、爱心抱枕、糖果架与樱花窗景。',
  },
  {
    id: 'greatball_room',
    tierLabel: '进阶球',
    name: '超级球 · 蓝调水族房',
    shortName: '超级球',
    price: 95,
    ballSprite: '/sprites/items/great-ball.png',
    daySky: '#e3f1ff',
    nightSky: '#15223d',
    floorColor: '#c7dff7',
    description: '蓝红穹顶配像素鱼缸、复古电视与树果盆栽。',
  },
  {
    id: 'nestball_room',
    tierLabel: '自然球',
    name: '巢穴球 · 森林树屋舱',
    shortName: '巢穴球',
    price: 110,
    ballSprite: '/sprites/items/nest-ball.png',
    daySky: '#e6f5d6',
    nightSky: '#16291c',
    floorColor: '#cfe5b4',
    description: '青翠树荫穹顶、木屋原木壁、树果篮与绿草绒垫。',
  },
  {
    id: 'diveball_room',
    tierLabel: '海洋球',
    name: '潜水球 · 珊瑚海底舱',
    shortName: '潜水球',
    price: 120,
    ballSprite: '/sprites/items/dive-ball.png',
    daySky: '#d2f4ff',
    nightSky: '#0c2238',
    floorColor: '#a6e1fa',
    description: '深海潜艇舷窗、五彩珊瑚礁、贝壳夜灯与波浪地砖。',
  },
  {
    id: 'ultraball_room',
    tierLabel: '奢华球',
    name: '高级球 · 黑金壁炉房',
    shortName: '高级球',
    price: 145,
    ballSprite: '/sprites/items/ultra-ball.png',
    daySky: '#2e2b38',
    nightSky: '#15141c',
    floorColor: '#453d38',
    description: '黑金尊享架构、红绒沙发、像素暖炉与冠军奖杯柜。',
  },
  {
    id: 'duskball_room',
    tierLabel: '暗夜球',
    name: '黑暗球 · 幽灵古堡阁',
    shortName: '黑暗球',
    price: 165,
    ballSprite: '/sprites/items/dusk-ball.png',
    daySky: '#1a2420',
    nightSky: '#0e1412',
    floorColor: '#25332d',
    description: '墨绿神秘穹顶、满月尖拱窗、幽火烛台与药水书架。',
  },
  {
    id: 'luxuryball_room',
    tierLabel: '尊贵球',
    name: '豪华球 · 皇冠金碧殿',
    shortName: '豪华球',
    price: 195,
    ballSprite: '/sprites/items/luxury-ball.png',
    daySky: '#3b1c24',
    nightSky: '#1f0d12',
    floorColor: '#592832',
    description: '黑红金皇家垂幔、水晶吊灯、红毯与金冠徽章地毯。',
  },
  {
    id: 'masterball_room',
    tierLabel: '殿堂球',
    name: '大师球 · 紫金星云殿',
    shortName: '大师球',
    price: 220,
    ballSprite: '/sprites/items/master-ball.png',
    daySky: '#3b245c',
    nightSky: '#1a0f2e',
    floorColor: '#56377a',
    description: '星云观星窗、悬浮紫晶柱与皇家紫金红毯行宫。',
  },
];

export interface ShellThemeMeta {
  id: ShellThemeId;
  name: string;
  body: string;
  bodyShadow: string;
  bodyHighlight: string;
  bezel: string;
  accentBtn: string;
  dpad: string;
}

export const SHELL_THEMES: Record<ShellThemeId, ShellThemeMeta> = {
  pikachu_yellow: {
    id: 'pikachu_yellow',
    name: '皮卡丘限定黄',
    body: '#ffd84d',
    bodyShadow: '#d99e16',
    bodyHighlight: '#fff199',
    bezel: '#343642',
    accentBtn: '#e63946',
    dpad: '#2d303b',
  },
  pokeball_red: {
    id: 'pokeball_red',
    name: '精灵球经典红',
    body: '#f26a6a',
    bodyShadow: '#b83737',
    bodyHighlight: '#ffabab',
    bezel: '#2e313d',
    accentBtn: '#ffd43b',
    dpad: '#252730',
  },
  crystal_blue: {
    id: 'crystal_blue',
    name: '水晶版冰透蓝',
    body: '#88d8f7',
    bodyShadow: '#459ac4',
    bodyHighlight: '#c9f0ff',
    bezel: '#293b4d',
    accentBtn: '#ff7096',
    dpad: '#223140',
  },
  gengar_purple: {
    id: 'gengar_purple',
    name: '耿鬼暗影紫',
    body: '#9a7ee0',
    bodyShadow: '#5e42a6',
    bodyHighlight: '#c7b5f7',
    bezel: '#242038',
    accentBtn: '#ff5d8f',
    dpad: '#1d192e',
  },
};

export interface AchievementMeta {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  badge: string;
}

export const ACHIEVEMENTS: AchievementMeta[] = [
  {
    id: 'first_pet',
    title: '真新镇启程',
    description: '收服并唤醒第一只搭档宝可梦',
    rewardCoins: 30,
    badge: 'pokeball',
  },
  {
    id: 'feeder_5',
    title: '树果美食家',
    description: '累计喂食宝可梦树果/零食达到 5 次',
    rewardCoins: 25,
    badge: 'riceball',
  },
  {
    id: 'cleaner_5',
    title: '闪亮训练家',
    description: '累计洗澡或清理达到 5 次',
    rewardCoins: 30,
    badge: 'bubble',
  },
  {
    id: 'pat_10',
    title: '亲密羁绊',
    description: '抚摸宝可梦伙伴达到 10 次',
    rewardCoins: 25,
    badge: 'heart',
  },
  {
    id: 'teen_stage',
    title: '初次进化！',
    description: '任意宝可梦达到经典等级并完成一阶进化',
    rewardCoins: 60,
    badge: 'sprout',
  },
  {
    id: 'adult_stage',
    title: '最终进化形态',
    description: '任意宝可梦达到最终进化形态 (如 Lv.32~55)',
    rewardCoins: 150,
    badge: 'crown',
  },
  {
    id: 'fashion_3',
    title: '豪华精灵球藏家',
    description: '解锁至少 3 件道具或高级精灵球房间',
    rewardCoins: 45,
    badge: 'bow',
  },
  {
    id: 'arcade_pro',
    title: '游戏城大师',
    description: '在迷你游戏中累计获胜 3 次',
    rewardCoins: 60,
    badge: 'gamepad',
  },
];

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
