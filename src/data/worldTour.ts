import type { PetSkinId, SpeciesId } from '../types/pet';
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

export type ZoneAnomalyKind = 'cyclone' | 'storm' | 'legendary_clash';

export interface ZoneBlockAnomaly {
  kind: ZoneAnomalyKind;
  mapBadge: string;
  alertTag: string;
  accentColor: string;
  title: string;
  travelBlockReason: string;
  blockedTransports: string[];
  duelSpecies?: [SpeciesId, SpeciesId];
  spinDir?: 1 | -1;
}

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
  anomaly?: ZoneBlockAnomaly;
}

export const WORLD_ZONES: WorldZoneDef[] = [
  {
    id: 'east_asia',
    name: '东亚 · 华夏与日本赛区',
    subtitle: '第 1 赛季已全面开放 · 14 座地标道馆',
    unlocked: true,
    centerLat: 33.5,
    centerLng: 122.0,
    seasonTag: 'S1 已开放',
    teaserText: '横跨北京、上海、杭州、广州、深圳、成都、哈尔滨、香港，以及日本东京、京都、大阪、札幌、福冈与冲绳 14 座道馆！',
    teaserSpecies: ['pikachu', 'charmander', 'hooh', 'dratini', 'mewtwo'],
  },
  {
    id: 'southeast_asia',
    name: '翡翠雨林群岛',
    subtitle: '超级气旋盘踞中',
    unlocked: false,
    centerLat: 10.5,
    centerLng: 105.5,
    seasonTag: '气旋封锁',
    teaserText: '热带雨林与珊瑚群岛密布，草、毒与虫系宝可梦栖息于此。',
    teaserSpecies: ['scyther', 'pinsir', 'exeggcute', 'oddish'],
    anomaly: {
      kind: 'cyclone',
      mapBadge: '🌀 超级气旋',
      alertTag: '红色气象预警',
      accentColor: '#0c8599',
      title: '超级热带气旋「翡翠风暴眼」',
      travelBlockReason:
        '强热带气旋持续盘踞在热带海域与雨林上空，强侧风与暴雨导致所有航班禁飞，跨区域铁路线也因路基积水全线临时停运。',
      blockedTransports: ['✈ 民航禁飞', '🚄 铁路停运'],
      spinDir: -1,
    },
  },
  {
    id: 'europe',
    name: '古堡机械都市带',
    subtitle: '传说精灵高空对峙中',
    unlocked: false,
    centerLat: 49.0,
    centerLng: 10.0,
    seasonTag: '传说激战',
    teaserText: '时钟钢塔、妖精沙龙与高山冰峰交织的古老城市带。',
    teaserSpecies: ['clefairy', 'mrmime', 'magnemite', 'porygon'],
    anomaly: {
      kind: 'legendary_clash',
      mapBadge: '⚡ 史诗对决',
      alertTag: '高能禁飞区',
      accentColor: '#6741d9',
      title: '史诗宝可梦激战：超梦 VS 闪电鸟',
      travelBlockReason:
        '雷达侦测到「超梦」与「闪电鸟」正在高空爆发超能与雷电对撞，强烈电磁乱流彻底屏蔽导航信号，航线与跨洲列车均被迫紧急折返。',
      blockedTransports: ['✈ 雷达失灵禁飞', '🚄 跨洲列车中断'],
      duelSpecies: ['mewtwo', 'zapdos'],
    },
  },
  {
    id: 'north_america',
    name: '摩天峡谷都市带',
    subtitle: '特大雷暴带阻断中',
    unlocked: false,
    centerLat: 39.5,
    centerLng: -98.0,
    seasonTag: '雷暴封锁',
    teaserText: '摩天都会、大峡谷太古化石遗址与广袤荒野草原。',
    teaserSpecies: ['tauros', 'aerodactyl', 'electabuzz', 'rhyhorn'],
    anomaly: {
      kind: 'storm',
      mapBadge: '⛈ 超级雷暴',
      alertTag: '强雷暴管制',
      accentColor: '#d9480f',
      title: '特大超级雷暴带「雷鸣裂谷」',
      travelBlockReason:
        '罕见的超级单体雷暴群横亘内陆上空，持续强风切变与密集落雷覆盖高空走廊，越洋客机与大陆干线列车目前无法安全通行。',
      blockedTransports: ['✈ 航线停飞', '🚄 干线铁路封闭'],
    },
  },
  {
    id: 'nordic_volcano',
    name: '极光熔岩冰原',
    subtitle: '双圣鸟冰火交锋中',
    unlocked: false,
    centerLat: 64.9,
    centerLng: -19.0,
    seasonTag: '圣鸟激战',
    teaserText: '冰川与活火山并存的传说秘境，罕见冰系与火系栖息地。',
    teaserSpecies: ['articuno', 'moltres', 'lapras', 'magmar'],
    anomaly: {
      kind: 'legendary_clash',
      mapBadge: '🔥 圣鸟激战',
      alertTag: '极地封航',
      accentColor: '#c92a2a',
      title: '双圣鸟激战：急冻鸟 VS 火焰鸟',
      travelBlockReason:
        '「急冻鸟」与「火焰鸟」正在极光火山带展开冰火对决，高空火山灰云柱叠加暴风雪迫使所有极地航班停飞、港口临时封航。',
      blockedTransports: ['✈ 火山灰禁飞', '🚢 极地港口封航'],
      duelSpecies: ['articuno', 'moltres'],
    },
  },
  {
    id: 'oceania',
    name: '珊瑚海湾群岛',
    subtitle: '双核海洋气旋肆虐中',
    unlocked: false,
    centerLat: -25.0,
    centerLng: 135.0,
    seasonTag: '巨浪气旋',
    teaserText: '碧海白沙与红土草原相连，栖息着独特的南半球精灵生态。',
    teaserSpecies: ['kangaskhan', 'horsea', 'staryu', 'vaporeon'],
    anomaly: {
      kind: 'cyclone',
      mapBadge: '🌊 巨浪气旋',
      alertTag: '海洋风暴预警',
      accentColor: '#1971c2',
      title: '南太平洋双核气旋「珊瑚狂涛」',
      travelBlockReason:
        '南半球双核海洋气旋正卷起十米巨浪与持续烈风，跨洋民航与远洋渡轮已全部暂停前往该海域的班次。',
      blockedTransports: ['✈ 跨洋航班停飞', '🚢 远洋渡轮停航'],
      spinDir: 1,
    },
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
  regionalSkinId?: PetSkinId;
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
    settleCost: 250000,
    regionalSkinId: 'vermilion_palace',
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
    settleCost: 260000,
    regionalSkinId: 'porcelain',
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
    settleCost: 175000,
    regionalSkinId: 'jade_emerald',
  },
  {
    id: 'guangzhou',
    zoneId: 'east_asia',
    name: '广州',
    country: '中国 · 华南',
    lat: 23.13,
    lng: 113.26,
    biome: 'storm_coast',
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
    settleCost: 185000,
    regionalSkinId: 'dunhuang_gold',
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
    settleCost: 230000,
    regionalSkinId: 'porcelain',
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
    settleCost: 135000,
    regionalSkinId: 'ink_wash',
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
    settleCost: 108000,
    regionalSkinId: 'ice_glaze',
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
    settleCost: 320000,
    regionalSkinId: 'dunhuang_gold',
  },
  {
    id: 'tokyo',
    zoneId: 'east_asia',
    name: '东京',
    country: '日本 · 关东原型',
    lat: 35.68,
    lng: 139.65,
    biome: 'verdant_forest',
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
    settleCost: 280000,
    regionalSkinId: 'sakura',
  },
  {
    id: 'kyoto',
    zoneId: 'east_asia',
    name: '京都',
    country: '日本 · 关西 / 城都原型',
    lat: 35.0116,
    lng: 135.7681,
    biome: 'verdant_forest',
    accentColor: '#e64980',
    gymName: '圆朱凤王古殿',
    gymBadgeName: '铃铛古都徽章',
    gymTypeLabel: '幽灵 / 传说 / 火',
    gymLeaderName: '馆主 松叶',
    gymTrainerKey: 'tr_erika',
    gymBossSpecies: 'hooh',
    gymBossTitle: '虹色圣翼·凤王',
    fieldEffect: '千年古刹：樱雨飘落与幽灵灵脉共鸣，传闻铃铛塔顶有传说凤王栖息！',
    hotelNames: {
      hostel: '祇园町屋青旅',
      inn: '清水坂精灵驿站',
      grand: '岚山樱庭温泉酒店',
    },
    specialtyName: '宇治抹茶和菓子',
    description: '城都圆朱市原型古都，朱红鸟居与古刹枫林间出没着幽灵系、六尾与七彩凤王。',
    wildPool: ['hooh', 'vulpix', 'gastly', 'abra', 'clefairy', 'eevee', 'pikachu', 'bulbasaur', 'growlithe'],
    signatureSpecies: ['hooh', 'gastly', 'vulpix'],
    rewardCoins: 260,
    settleCost: 168000,
    regionalSkinId: 'sakura',
  },
  {
    id: 'osaka',
    zoneId: 'east_asia',
    name: '大阪',
    country: '日本 · 关西商都',
    lat: 34.6937,
    lng: 135.5023,
    biome: 'storm_coast',
    accentColor: '#f76707',
    gymName: '通天阁雷炎道馆',
    gymBadgeName: '浪速爆炎徽章',
    gymTypeLabel: '电 / 格斗 / 火',
    gymLeaderName: '馆主 烈堂',
    gymTrainerKey: 'tr_ltsurge',
    gymBossSpecies: 'hitmonlee',
    gymBossTitle: '浪速拳圣·飞腿郎',
    fieldEffect: '道顿堀狂热：攻速与暴击双提升，繁华霓虹街头聚集喵喵、电击兽与格斗名家！',
    hotelNames: {
      hostel: '难波胶囊青旅',
      inn: '梅田商业精灵驿站',
      grand: '大阪城天守观景酒店',
    },
    specialtyName: '章鱼烧能量丸子',
    description: '烟火气与霓虹招牌交织的关西不夜城，豪爽的格斗系与电火系宝可梦在此切磋。',
    wildPool: ['pikachu', 'charmander', 'meowth', 'electabuzz', 'hitmonlee', 'hitmonchan', 'magnemite', 'magmar', 'growlithe'],
    signatureSpecies: ['electabuzz', 'meowth', 'hitmonlee'],
    rewardCoins: 210,
    settleCost: 158000,
    regionalSkinId: 'magma',
  },
  {
    id: 'sapporo',
    zoneId: 'east_asia',
    name: '札幌',
    country: '日本 · 北海道 / 神奥原型',
    lat: 43.0618,
    lng: 141.3545,
    biome: 'sky_glacier',
    accentColor: '#339af0',
    gymName: '雪峰极寒道馆',
    gymBadgeName: '北国冰晶徽章',
    gymTypeLabel: '冰 / 水 / 龙',
    gymLeaderName: '馆主 铃奈',
    gymTrainerKey: 'tr_misty',
    gymBossSpecies: 'lapras',
    gymBossTitle: '北海霜翼·拉普拉斯',
    fieldEffect: '北海道粉雪：冰霜招式范围扩大，雪原湖畔常现拉普拉斯、迷唇姐与急冻鸟！',
    hotelNames: {
      hostel: '薄野雪屋青旅',
      inn: '大通公园精灵驿站',
      grand: '小樽雪景温泉酒店',
    },
    specialtyName: '北海道浓郁鲜奶布丁',
    description: '神奥地区原型雪国之都，皑皑粉雪与温泉海岸孕育出优雅强大的冰系精灵。',
    wildPool: ['lapras', 'articuno', 'vulpix', 'seel', 'shellder', 'jynx', 'dratini', 'eevee', 'squirtle'],
    signatureSpecies: ['lapras', 'articuno', 'jynx'],
    rewardCoins: 250,
    settleCost: 115000,
    regionalSkinId: 'ice_glaze',
  },
  {
    id: 'fukuoka',
    zoneId: 'east_asia',
    name: '福冈',
    country: '日本 · 九州 / 丰缘原型',
    lat: 33.5902,
    lng: 130.4017,
    biome: 'rocky_desert',
    accentColor: '#2f9e44',
    gymName: '博多火山岩道馆',
    gymBadgeName: '九州炽岩徽章',
    gymTypeLabel: '火 / 岩石 / 化石',
    gymLeaderName: '馆主 亚莎影',
    gymTrainerKey: 'tr_brock',
    gymBossSpecies: 'magmar',
    gymBossTitle: '阿苏炽核·鸭嘴火兽',
    fieldEffect: '九州地热：火山温泉能量涌动，高概率偶遇鸭嘴火兽、化石翼龙与迷你龙！',
    hotelNames: {
      hostel: '中洲屋台青旅',
      inn: '天神海风精灵驿站',
      grand: '博多湾温泉度假酒店',
    },
    specialtyName: '博多豚骨拉面补给',
    description: '丰缘地区原型九州门户，活火山温泉与玄界滩海岸汇聚着炽热与太古化石强者。',
    wildPool: ['charmander', 'growlithe', 'magmar', 'rhyhorn', 'onix', 'aerodactyl', 'dratini', 'vulpix', 'pidgey'],
    signatureSpecies: ['magmar', 'aerodactyl', 'dratini'],
    rewardCoins: 220,
    settleCost: 122000,
    regionalSkinId: 'solar_pharaoh',
  },
  {
    id: 'okinawa',
    zoneId: 'east_asia',
    name: '冲绳',
    country: '日本 · 琉球海岛',
    lat: 26.2124,
    lng: 127.6809,
    biome: 'storm_coast',
    accentColor: '#15aabf',
    gymName: '琉球珊瑚碧海道馆',
    gymBadgeName: '碧海珊瑚徽章',
    gymTypeLabel: '水 / 龙 / 妖精',
    gymLeaderName: '馆主 沧海',
    gymTrainerKey: 'tr_misty',
    gymBossSpecies: 'dratini',
    gymBossTitle: '琉球海龙·快龙',
    fieldEffect: '碧海珊瑚潮：水系与龙系速度加成，清澈海岛盛产水伊布、宝石海星与迷你龙！',
    hotelNames: {
      hostel: '国际通海风青旅',
      inn: '美丽海珊瑚驿站',
      grand: '琉球蔚蓝海景度假村',
    },
    specialtyName: '冲绳黑糖海盐冰沙',
    description: '碧海蓝天与珊瑚礁环绕的南国海岛，温暖黑潮吸引着海洋水系与传说龙族栖息。',
    wildPool: ['squirtle', 'staryu', 'horsea', 'magikarp', 'vaporeon', 'lapras', 'dratini', 'psyduck', 'jigglypuff'],
    signatureSpecies: ['dratini', 'vaporeon', 'staryu'],
    rewardCoins: 240,
    settleCost: 130000,
    regionalSkinId: 'blue_flame',
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
  /** Per-city click counts so the World Map city list sorts by click frequency */
  cityClickCounts?: Record<string, number>;
}

export const DEFAULT_WORLD_TOUR_STATE: WorldTourState = {
  homeCoords: null,
  currentCityId: null,
  stayHotelTier: null,
  stayUntilTs: null,
  clearedCityGyms: [],
  visitedCities: [],
  settledCityIds: [],
  cityClickCounts: {},
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

/**
 * Flight ticket cost scales noticeably with real Earth distance:
 * - Same-metro / local GPS home turf (<= 80 km): 0 coins
 * - One-way ticket (ONLY allowed when buying a house to settle!): starts at 1,500 + 1.45/km
 * - Round-trip ticket (required for normal travel & visiting settled houses!): >= 3,000 coins (= 2 × one-way)
 */
export function calcOneWayTicketCost(distanceKm: number, isHomeTurf: boolean): number {
  if (isHomeTurf || distanceKm <= 80) return 0;
  return Math.max(1500, Math.round((1500 + distanceKm * 1.45) / 10) * 10);
}

export function calcFlightTicketCost(
  distanceKm: number,
  isHomeTurf: boolean,
  tripType: 'round_trip' | 'one_way' = 'round_trip',
): number {
  if (isHomeTurf || distanceKm <= 80) return 0;
  const oneWay = calcOneWayTicketCost(distanceKm, isHomeTurf);
  if (tripType === 'one_way') return oneWay;
  return Math.max(3000, oneWay * 2);
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
