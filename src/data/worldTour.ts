import type { SpeciesId } from '../types/pet';
import type { AppLang } from './i18n';
import type { BiomeId } from './worldTextures3D';

export type HotelTierId = 'hostel' | 'inn' | 'grand';

export interface HotelTierMeta {
  id: HotelTierId;
  name: string;
  days: number;
  pricePerStay: number;
  perkLabel: string;
  badgeColor: string;
}

export const HOTEL_TIERS: HotelTierMeta[] = [
  {
    id: 'hostel',
    name: '训练家青旅',
    days: 1,
    pricePerStay: 40,
    perkLabel: '停留 1 天 · 免费基础回血',
    badgeColor: '#40c057',
  },
  {
    id: 'inn',
    name: '宝可梦驿站',
    days: 3,
    pricePerStay: 100,
    perkLabel: '停留 3 天 · 经验 +15% · 每日树果补给',
    badgeColor: '#228be6',
  },
  {
    id: 'grand',
    name: '地标五星酒店',
    days: 7,
    pricePerStay: 220,
    perkLabel: '停留 7 天 · 异色概率 UP · 全队攻击 +12%',
    badgeColor: '#f59f00',
  },
];

export interface WorldZoneDef {
  id: string;
  name: string;
  subtitle: string;
  unlocked: boolean;
  centerLat: number;
  centerLng: number;
  seasonTag: string;
  teaserText: string;
  teaserSpecies: SpeciesId[];
}

export const WORLD_ZONES: WorldZoneDef[] = [
  {
    id: 'east_asia',
    name: '东亚 · 华夏与关东赛区',
    subtitle: '第 1 赛季已全面开放 · 9 座地标道馆',
    unlocked: true,
    centerLat: 33.5,
    centerLng: 118.5,
    seasonTag: 'S1 已开放',
    teaserText: '横跨燕京、魔都、江南、岭南、鹏城、巴蜀、冰城、维港与东京关东圣殿！',
    teaserSpecies: ['pikachu', 'charmander', 'lapras', 'dratini', 'mewtwo'],
  },
  {
    id: 'southeast_asia',
    name: '东南亚 · 翡翠雨林赛区',
    subtitle: '第 2 赛季筹备中',
    unlocked: false,
    centerLat: 8.0,
    centerLng: 104.0,
    seasonTag: '即将开放',
    teaserText: '热带雨林与珊瑚群岛，草/毒/虫系生态秘境即将解封！',
    teaserSpecies: ['scyther', 'pinsir', 'exeggcute', 'oddish'],
  },
  {
    id: 'europe',
    name: '欧洲 · 古堡机械赛区',
    subtitle: '第 2 赛季筹备中',
    unlocked: false,
    centerLat: 49.0,
    centerLng: 10.0,
    seasonTag: '即将开放',
    teaserText: '伦敦时钟钢塔、巴黎妖精沙龙、阿尔卑斯冰峰道馆筹建中！',
    teaserSpecies: ['clefairy', 'mrmime', 'magnemite', 'porygon'],
  },
  {
    id: 'north_america',
    name: '北美 · 摩天峡谷赛区',
    subtitle: '第 3 赛季筹备中',
    unlocked: false,
    centerLat: 39.5,
    centerLng: -98.0,
    seasonTag: '敬请期待',
    teaserText: '纽约雷霆都会、大峡谷太古化石遗址与牛仔荒野赛区！',
    teaserSpecies: ['tauros', 'aerodactyl', 'electabuzz', 'rhyhorn'],
  },
  {
    id: 'nordic_volcano',
    name: '冰岛与极地 · 极光熔岩区',
    subtitle: '第 3 赛季筹备中',
    unlocked: false,
    centerLat: 64.9,
    centerLng: -19.0,
    seasonTag: '敬请期待',
    teaserText: '冰火交织的传说圣地，急冻鸟与火焰鸟双圣鸟栖息带！',
    teaserSpecies: ['articuno', 'moltres', 'lapras', 'magmar'],
  },
  {
    id: 'oceania',
    name: '大洋洲 · 珊瑚海湾赛区',
    subtitle: '第 4 赛季筹备中',
    unlocked: false,
    centerLat: -25.0,
    centerLng: 135.0,
    seasonTag: '敬请期待',
    teaserText: '碧海白沙与袋兽草原，南半球专属生态圈！',
    teaserSpecies: ['kangaskhan', 'horsea', 'staryu', 'vaporeon'],
  },
];

export interface WorldCityDef {
  id: string;
  zoneId: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  biome: BiomeId;
  accentColor: string;
  gymName: string;
  gymBadgeName: string;
  gymTypeLabel: string;
  gymLeaderName: string;
  gymTrainerKey: string;
  gymBossSpecies: SpeciesId;
  gymBossTitle: string;
  fieldEffect: string;
  hotelNames: Record<HotelTierId, string>;
  specialtyName: string;
  description: string;
  wildPool: SpeciesId[];
  signatureSpecies: SpeciesId[];
  rewardCoins: number;
  settleCost: number;
}

export const WORLD_CITIES: WorldCityDef[] = [
  {
    id: 'beijing',
    zoneId: 'east_asia',
    name: '北京',
    country: '中国 · 华北',
    lat: 39.9,
    lng: 116.4,
    biome: 'rocky_desert',
    accentColor: '#d97724',
    gymName: '紫禁磐石道馆',
    gymBadgeName: '长城磐石徽章',
    gymTypeLabel: '岩石 / 地面',
    gymLeaderName: '馆主 岳刚',
    gymTrainerKey: 'tr_brock',
    gymBossSpecies: 'onix',
    gymBossTitle: '紫禁守护者·大岩蛇',
    fieldEffect: '燕山沙暴：岩/地系威力提升，野区高概率出没大岩蛇与钻角犀兽',
    hotelNames: {
      hostel: '胡同旅舍',
      inn: '前门宝可梦驿站',
      grand: '紫禁观景大酒店',
    },
    specialtyName: '京味糖葫芦树果',
    description: '红墙青瓦与太行山麓交汇的古都，磐石与地面系宝可梦在此历练体魄。',
    wildPool: ['tinglu', 'bronzor', 'kubfu', 'onix', 'rhyhorn', 'geodude', 'growlithe', 'charmander', 'pidgey'],
    signatureSpecies: ['tinglu', 'kubfu', 'onix'],
    rewardCoins: 160,
    settleCost: 1500,
  },
  {
    id: 'shanghai',
    zoneId: 'east_asia',
    name: '上海',
    country: '中国 · 华东',
    lat: 31.23,
    lng: 121.47,
    biome: 'storm_coast',
    accentColor: '#f59f00',
    gymName: '霓虹电塔道馆',
    gymBadgeName: '魔都霓虹徽章',
    gymTypeLabel: '电 / 数字',
    gymLeaderName: '馆主 霆锋',
    gymTrainerKey: 'tr_ltsurge',
    gymBossSpecies: 'electabuzz',
    gymBossTitle: '东方雷核·电击兽',
    fieldEffect: '霓虹超频：城市电网充能，高概率偶遇皮卡丘、小磁怪与多边兽',
    hotelNames: {
      hostel: '外滩青旅',
      inn: '陆家嘴精灵驿站',
      grand: '云端霓虹五星酒店',
    },
    specialtyName: '魔都生煎能量包',
    description: '霓虹璀璨的东海大都会，高压电系与赛博数字宝可梦聚集于此。',
    wildPool: ['pikachu', 'charmander', 'squirtle', 'chimchar', 'bronzor', 'magnemite', 'electabuzz', 'porygon', 'eevee'],
    signatureSpecies: ['pikachu', 'chimchar', 'porygon'],
    rewardCoins: 180,
    settleCost: 1800,
  },
  {
    id: 'hangzhou',
    zoneId: 'east_asia',
    name: '杭州',
    country: '中国 · 江南',
    lat: 30.27,
    lng: 120.15,
    biome: 'storm_coast',
    accentColor: '#228be6',
    gymName: '烟雨碧波道馆',
    gymBadgeName: '西湖涟漪徽章',
    gymTypeLabel: '水 / 妖精',
    gymLeaderName: '馆主 溪澄',
    gymTrainerKey: 'tr_misty',
    gymBossSpecies: 'staryu',
    gymBossTitle: '烟雨星核·宝石海星',
    fieldEffect: '江南细雨：水系冲浪与回复增强，湖畔盛产宝石海星与暴鲤龙',
    hotelNames: {
      hostel: '断桥画舫青旅',
      inn: '灵隐雅居驿站',
      grand: '西子湖畔度假酒店',
    },
    specialtyName: '龙井清露鲜奶',
    description: '烟雨朦胧的江南水乡，清澈湖畔是水系与治愈系宝可梦的乐土。',
    wildPool: ['chiyu', 'drampa', 'squirtle', 'bulbasaur', 'staryu', 'magikarp', 'vaporeon', 'psyduck', 'jigglypuff'],
    signatureSpecies: ['chiyu', 'drampa', 'staryu'],
    rewardCoins: 170,
    settleCost: 1200,
  },
  {
    id: 'guangzhou',
    zoneId: 'east_asia',
    name: '广州',
    country: '中国 · 华南',
    lat: 23.13,
    lng: 113.26,
    biome: 'cinnabar_isle',
    accentColor: '#e03131',
    gymName: '岭南烈阳道馆',
    gymBadgeName: '南国炽焰徽章',
    gymTypeLabel: '火 / 格斗',
    gymLeaderName: '馆主 炎武',
    gymTrainerKey: 'tr_blue',
    gymBossSpecies: 'growlithe',
    gymBossTitle: '岭南烈焰·风速狗',
    fieldEffect: '南国晴日：火焰与格斗暴击提升，热土盛产卡蒂狗、火伊布与快拳郎',
    hotelNames: {
      hostel: '骑楼茶居青旅',
      inn: '珠江畔精灵驿站',
      grand: '小蛮腰云景大酒店',
    },
    specialtyName: '广式早茶甜点拼盘',
    description: '热力四射的岭南商都与功夫之乡，烈焰与武道强者云集。',
    wildPool: ['chimchar', 'tepig', 'mienfoo', 'charmander', 'growlithe', 'vulpix', 'flareon', 'hitmonlee', 'hitmonchan'],
    signatureSpecies: ['chimchar', 'mienfoo', 'tepig'],
    rewardCoins: 190,
    settleCost: 1500,
  },
  {
    id: 'shenzhen',
    zoneId: 'east_asia',
    name: '深圳',
    country: '中国 · 粤港澳',
    lat: 22.5431,
    lng: 114.0579,
    biome: 'storm_coast',
    accentColor: '#0ca678',
    gymName: '湾区硅谷道馆',
    gymBadgeName: '鹏城光核徽章',
    gymTypeLabel: '超能 / 钢 / 电',
    gymLeaderName: '馆主 智芯',
    gymTrainerKey: 'tr_ltsurge',
    gymBossSpecies: 'porygon',
    gymBossTitle: '湾芯智核·多边兽',
    fieldEffect: '科创海风：芯片与超能波频共鸣，高概率偶遇多边兽、凯西、小磁怪与皮卡丘',
    hotelNames: {
      hostel: '华强北极客青旅',
      inn: '南山科技园驿站',
      grand: '深圳湾云端大酒店',
    },
    specialtyName: '鹏城椰子鸡能量锅',
    description: '南海之滨的赛博创新之都，摩天科技园与红树林海岸吸引着超能、电系与数字宝可梦。',
    wildPool: ['wochien', 'kubfu', 'porygon', 'pikachu', 'charmander', 'abra', 'magnemite', 'jolteon', 'eevee'],
    signatureSpecies: ['wochien', 'kubfu', 'porygon'],
    rewardCoins: 200,
    settleCost: 1600,
  },
  {
    id: 'chengdu',
    zoneId: 'east_asia',
    name: '成都',
    country: '中国 · 西南',
    lat: 30.57,
    lng: 104.06,
    biome: 'verdant_forest',
    accentColor: '#37b24d',
    gymName: '云海竹林道馆',
    gymBadgeName: '蜀山青翠徽章',
    gymTypeLabel: '草 / 虫 / 悠闲',
    gymLeaderName: '馆主 竹韵',
    gymTrainerKey: 'tr_erika',
    gymBossSpecies: 'munchlax',
    gymBossTitle: '竹海睡神·卡比兽',
    fieldEffect: '巴蜀竹海：偶有树果空投，盛产卡比兽、妙蛙种子、飞天螳螂与凯罗斯',
    hotelNames: {
      hostel: '宽窄竹院青旅',
      inn: '青城山雾驿站',
      grand: '天府竹海温泉酒店',
    },
    specialtyName: '蜀香釜炎仙贝',
    description: '烟火巴适的竹海天府，最适合带着贪吃的宝可梦悠闲修行。',
    wildPool: ['pancham', 'spinda', 'munchlax', 'bulbasaur', 'drampa', 'scyther', 'pinsir', 'eevee', 'farfetchd'],
    signatureSpecies: ['pancham', 'munchlax', 'spinda'],
    rewardCoins: 170,
    settleCost: 1200,
  },
  {
    id: 'harbin',
    zoneId: 'east_asia',
    name: '哈尔滨',
    country: '中国 · 东北',
    lat: 45.8,
    lng: 126.53,
    biome: 'sky_glacier',
    accentColor: '#15aabf',
    gymName: '北境极光道馆',
    gymBadgeName: '冰城霜华徽章',
    gymTypeLabel: '冰 / 传说',
    gymLeaderName: '馆主 霜华',
    gymTrainerKey: 'tr_misty',
    gymBossSpecies: 'articuno',
    gymBossTitle: '北境圣翼·急冻鸟',
    fieldEffect: '极寒飞雪：冰系宝可梦高概率现身，传闻暴雪夜会出现传说急冻鸟！',
    hotelNames: {
      hostel: '雪屋暖炕青旅',
      inn: '中央大街精灵驿站',
      grand: '冰雪城堡大酒店',
    },
    specialtyName: '马迭尔飞云冰淇淋',
    description: '银装素裹的北国冰城，冰霜与极光孕育出最优雅的冰海精灵。',
    wildPool: ['chienpao', 'articuno', 'lapras', 'seel', 'shellder', 'jynx', 'vulpix', 'clefairy', 'dratini'],
    signatureSpecies: ['chienpao', 'lapras', 'articuno'],
    rewardCoins: 240,
    settleCost: 1400,
  },
  {
    id: 'hongkong',
    zoneId: 'east_asia',
    name: '香港',
    country: '中国 · 粤港澳',
    lat: 22.32,
    lng: 114.17,
    biome: 'storm_coast',
    accentColor: '#7950f2',
    gymName: '维港风暴道馆',
    gymBadgeName: '维港雷翼徽章',
    gymTypeLabel: '飞行 / 电 / 化石',
    gymLeaderName: '馆主 苍岚',
    gymTrainerKey: 'tr_ltsurge',
    gymBossSpecies: 'zapdos',
    gymBossTitle: '维港雷神·闪电鸟',
    fieldEffect: '海湾季风：天空与海港精英集结，高概率遭遇化石翼龙、暴鲤龙与闪电鸟！',
    hotelNames: {
      hostel: '尖沙咀胶囊青旅',
      inn: '太平山海景驿站',
      grand: '维多利亚港皇冠酒店',
    },
    specialtyName: '港式丝袜哞哞奶',
    description: '山海交映的国际海港之都，海风与雷云引来无数稀有的飞行与海洋强者。',
    wildPool: ['hooh', 'drampa', 'zapdos', 'aerodactyl', 'magikarp', 'horsea', 'kabuto', 'electabuzz', 'pikachu'],
    signatureSpecies: ['hooh', 'drampa', 'zapdos'],
    rewardCoins: 240,
    settleCost: 1800,
  },
  {
    id: 'tokyo',
    zoneId: 'east_asia',
    name: '东京',
    country: '日本 · 关东原型',
    lat: 35.68,
    lng: 139.65,
    biome: 'cinnabar_isle',
    accentColor: '#ae3ec9',
    gymName: '关东石英圣殿',
    gymBadgeName: '石英冠军徽章',
    gymTypeLabel: '关东殿堂 · 终极',
    gymLeaderName: '冠军 赤红影',
    gymTrainerKey: 'tr_blue',
    gymBossSpecies: 'mewtwo',
    gymBossTitle: '石英终极传说·超梦',
    fieldEffect: '关东圣地：全关东人气王牌与传说精灵汇聚，迎战最终传说超梦！',
    hotelNames: {
      hostel: '浅草像素胶囊馆',
      inn: '新宿宝可梦中心驿站',
      grand: '彩虹市石英大酒店',
    },
    specialtyName: '关东限定神奇糖果',
    description: '关都地区现实原型所在！汇聚全关东最强训练家、三圣鸟与传说超梦的终极殿堂。',
    wildPool: ['pikachu', 'charmander', 'bulbasaur', 'squirtle', 'gastly', 'abra', 'dratini', 'moltres', 'mewtwo', 'mew'],
    signatureSpecies: ['mewtwo', 'mew', 'dratini'],
    rewardCoins: 360,
    settleCost: 2200,
  },
];

export interface HomeCoords {
  lat: number;
  lng: number;
  label: string;
  isRealGps: boolean;
}

export interface WorldTourState {
  homeCoords: HomeCoords | null;
  currentCityId: string | null; // null = at GPS Home!
  stayHotelTier: HotelTierId | null;
  stayUntilTs: number | null;
  clearedCityGyms: string[];
  visitedCities: string[];
  settledCityIds?: string[];
}

export const DEFAULT_WORLD_TOUR_STATE: WorldTourState = {
  homeCoords: null,
  currentCityId: null,
  stayHotelTier: null,
  stayUntilTs: null,
  clearedCityGyms: [],
  visitedCities: [],
  settledCityIds: [],
};

/**
 * Default spawn point when the user has not set GPS or manual home coords:
 * - Japanese (`ja`) -> Tokyo
 * - Chinese (Simplified / Traditional) & default -> Shanghai
 */
export function getDefaultHomeByLanguage(lang: AppLang): HomeCoords & { defaultCityId: string } {
  if (lang === 'ja') {
    return {
      lat: 35.6762,
      lng: 139.6503,
      label: '默认重生点 · 东京',
      isRealGps: false,
      defaultCityId: 'tokyo',
    };
  }
  return {
    lat: 31.2304,
    lng: 121.4737,
    label: '默认重生点 · 上海',
    isRealGps: false,
    defaultCityId: 'shanghai',
  };
}

/** Great-circle Haversine distance in kilometers */
export function calcGeoDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Flight ticket cost scales cleanly with real Earth distance (0 if local GPS home turf <= 80km!) */
export function calcFlightTicketCost(distanceKm: number, isHomeTurf: boolean): number {
  if (isHomeTurf || distanceKm <= 80) return 0;
  return Math.max(25, Math.min(180, Math.round(20 + distanceKm * 0.045)));
}

/** Match any real-world GPS coordinate to the closest local biome & wild pool for Home exploration */
export function getLocalHomeEcology(lat: number, lng: number): {
  biome: BiomeId;
  regionLabel: string;
  wildPool: SpeciesId[];
  nearestCity: WorldCityDef;
  nearestDistKm: number;
} {
  let nearestCity = WORLD_CITIES[0];
  let bestDist = Infinity;
  for (const c of WORLD_CITIES) {
    const d = calcGeoDistanceKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      nearestCity = c;
    }
  }
  if (bestDist <= 380) {
    return {
      biome: nearestCity.biome,
      regionLabel: `${nearestCity.name}周边生态圈`,
      wildPool: nearestCity.wildPool,
      nearestCity,
      nearestDistKm: bestDist,
    };
  }
  // Global climate fallback by real latitude!
  const absLat = Math.abs(lat);
  if (absLat >= 52) {
    return {
      biome: 'sky_glacier',
      regionLabel: '高纬寒带冰原生态',
      wildPool: ['seel', 'shellder', 'lapras', 'jynx', 'vulpix', 'clefairy', 'dratini'],
      nearestCity,
      nearestDistKm: bestDist,
    };
  }
  if (absLat <= 23.5) {
    return {
      biome: 'storm_coast',
      regionLabel: '热带海湾季风生态',
      wildPool: ['squirtle', 'magikarp', 'horsea', 'staryu', 'krabby', 'exeggcute', 'growlithe', 'pikachu'],
      nearestCity,
      nearestDistKm: bestDist,
    };
  }
  return {
    biome: 'verdant_forest',
    regionLabel: '温带原野生态圈',
    wildPool: ['bulbasaur', 'charmander', 'squirtle', 'pikachu', 'pidgey', 'caterpie', 'eevee', 'oddish', 'growlithe'],
    nearestCity,
    nearestDistKm: bestDist,
  };
}

/**
 * Simplified authentic Earth continent & major island polygons ([lng, lat][])
 * Rasterized cleanly onto a crisp low-resolution pixel canvas for authentic GBA/DS pixel-art world geography!
 */
export const WORLD_LAND_POLYGONS: [number, number][][] = [
  // Eurasia (simplified recognizable coastline from Iberia -> Europe -> Russia -> Siberia -> China -> SE Asia -> India -> Arabia -> Med)
  [
    [-9, 37], [-9, 43], [-2, 43], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 61],
    [14, 68], [28, 71], [42, 68], [60, 70], [74, 73], [104, 77], [136, 72],
    [170, 67], [176, 63], [162, 59], [156, 51], [141, 53], [136, 44], [129, 35],
    [126, 38], [122, 40], [118, 39], [122, 37], [120, 34], [122, 31], [120, 26],
    [114, 22], [108, 21], [109, 12], [103, 1], [100, 7], [98, 16], [90, 22],
    [80, 8], [72, 20], [67, 25], [56, 26], [59, 22], [44, 13], [35, 29],
    [35, 36], [26, 39], [23, 37], [18, 40], [12, 44], [5, 43], [-5, 36],
  ],
  // Japan Archipelago
  [[130, 31], [132, 33], [136, 34], [141, 36], [141, 41], [145, 43], [141, 45], [139, 41], [137, 37], [131, 34]],
  // UK & Ireland
  [[-6, 50], [-5, 58], [-2, 58], [2, 52], [-1, 50]],
  // Iceland
  [[-24, 64], [-22, 66], [-14, 66], [-14, 64]],
  // Taiwan & Hainan
  [[120, 22], [122, 25], [121, 25], [120, 23]],
  // Philippines
  [[120, 14], [122, 18], [126, 10], [123, 7]],
  // Indonesia (Sumatra/Java/Borneo)
  [[95, 5], [105, -6], [115, -8], [104, -2]],
  [[109, 1], [118, 5], [117, -3], [111, -3]],
  // Africa
  [
    [-17, 15], [-13, 28], [-6, 36], [10, 37], [11, 33], [25, 32], [33, 31],
    [43, 12], [51, 11], [41, -2], [39, -15], [33, -26], [20, -35], [15, -26],
    [12, -12], [9, 4], [-8, 5], [-17, 15],
  ],
  // Madagascar
  [[44, -25], [49, -13], [50, -16], [47, -25]],
  // North America
  [
    [-166, 65], [-156, 71], [-130, 70], [-95, 68], [-78, 63], [-64, 58],
    [-55, 52], [-66, 44], [-75, 36], [-81, 25], [-83, 30], [-97, 26],
    [-97, 19], [-88, 21], [-83, 10], [-78, 8], [-86, 11], [-105, 20],
    [-112, 24], [-117, 32], [-124, 42], [-125, 49], [-138, 58], [-152, 60], [-164, 56],
  ],
  // Greenland
  [[-52, 60], [-42, 60], [-20, 70], [-22, 82], [-56, 81], [-66, 76], [-54, 68]],
  // South America
  [
    [-78, 9], [-62, 10], [-50, 1], [-35, -6], [-39, -18], [-48, -26],
    [-58, -38], [-67, -54], [-74, -52], [-72, -36], [-71, -18], [-81, -5], [-78, 2],
  ],
  // Australia
  [
    [114, -22], [129, -14], [142, -11], [153, -27], [149, -37],
    [138, -35], [129, -32], [115, -34], [113, -26],
  ],
  // New Zealand
  [[167, -46], [174, -41], [178, -37], [173, -35], [170, -43]],
  // Antarctica strip
  [[-180, -72], [-120, -73], [-60, -66], [0, -70], [60, -68], [120, -67], [180, -72], [180, -85], [-180, -85]],
];
