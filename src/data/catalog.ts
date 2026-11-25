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
  caterpie: [
    '绿毛虫', '小青虫', '吐丝宝', '绿豆芽', '茧宝宝', '彩蝶', '嫩叶虫', '春风',
    '小羽蝶', '青丝', '鳞粉', '森林客', '蝴蝶结', '绿米粒', '芽虫', '晨露',
  ],
  pidgey: [
    '波波', '风羽', '小雀', '疾风', '云翼', '晴空', '比比', '金羽',
    '翔风', '轻羽', '朝霞', '风信子', '青空鸟', '乘风', '隼羽', '蓝天',
  ],
  vulpix: [
    '六尾', '赤狐', '火尾', '红枫', '九尾狐', '暖狐', '琥珀尾', '绯焰',
    '灵狐', '绯红', '霜狐', '丹桂', '星尾', '小赤丸', '霞尾', '炎舞',
  ],
  diglett: [
    '地鼠', '打洞侠', '土拨鼠', '小泥球', '潜地宝', '红鼻头', '三兄弟', '泥巴君',
    '探头鼠', '沙地客', '矿工鼠', '地心', '小土丘', '钻钻', '鼹鼠宝', '震地',
  ],
  growlithe: [
    '卡蒂狗', '烈焰犬', '小旺财', '忠犬', '赤风', '狮鬃', '暖阳犬', '护卫',
    '疾火', '风速', '小老虎', '燃燃', '大毛球', '神速犬', '烈风', '赤阳',
  ],
  abra: [
    '凯西', '念力君', '瞌睡虫', '银勺', '瞬移宝', '冥想者', '星智', '胡地大师',
    '超能客', '灵犀', '千智', '幻匙', '先知', '静心', '梦游者', '脑波',
  ],
  machop: [
    '腕力', '铁拳', '大力士', '小硬汉', '格斗家', '重拳', '四臂王', '劲力',
    '健将', '冠军腰带', '爆裂拳', '武道家', '斗志', '巨力', '铁臂', '豪侠',
  ],
  geodude: [
    '小拳石', '滚滚岩', '花岗岩', '石头人', '硬石头', '铁岩', '巨石', '山岳',
    '磐石', '矿石君', '飞石', '雷岩', '重岩', '岩铠', '石墩墩', '赤岩',
  ],
  scyther: [
    '飞天螳螂', '碧镰', '疾风刃', '翠影', '双镰', '剑圣', '青刃', '瞬斩',
    '绿刃', '螳螂侠', '斩风', '旋刃', '林中客', '锋芒', '飞镰', '利刃',
  ],
  magikarp: [
    '鲤鱼王', '咸鱼王', '跳跳鱼', '锦鲤', '跃龙门', '大红鱼', '暴龙海', '水溅跃',
    '深海霸主', '浪里白条', '金鳞', '海皇', '怒涛', '龙鱼', '大水花', '鱼跃',
  ],
  lapras: [
    '拉普拉斯', '乘龙', '海歌姬', '冰海舟', '渡海者', '碧波龙', '冰晶歌声', '蓝鲸舟',
    '温柔海', '雪海', '沧海', '潮汐', '浮冰', '极光舟', '海风', '暖海',
  ],
  mewtwo: [
    '超梦', '基因王', '逆袭', '紫电念', '零号', '终极体', '星渊', '幻域',
    '念皇', '创世影', '深紫', '超绝', '虚空', '破晓', '无双', '苍星',
  ],
  weedle: [
    '独角虫', '小黄针', '蜂宝', '毒针客', '铁壳君', '黄蜂侠', '大针蜂', '金刺',
    '疾蜂', '蜜针', '林间蜂', '尖针', '嗡嗡', '双刺', '金影', '蜂王',
  ],
  sandshrew: [
    '穿山鼠', '沙球', '小钢爪', '沙沙', '穿山侠', '滚动鼠', '黄沙宝', '土甲',
    '沙暴鼠', '利爪君', '沙丘客', '小刺球', '金沙', '沙甲', '掘沙', '岩沙',
  ],
  nidoran: [
    '尼多朗', '紫角', '霸王朗', '小紫犀', '紫针', '尼多王', '大紫角', '紫皇',
    '勇角', '紫岩', '尖角宝', '毒角', '铁角', '星紫', '猛角', '紫冠',
  ],
  clefairy: [
    '皮皮', '月光宝', '小粉星', '月见皮', '粉月亮', '星皮', '月兔', '柔光',
    '星星糖', '圆月', '小仙皮', '粉云', '月舞', '星梦', '甜月', '夜歌',
  ],
  oddish: [
    '走路草', '小草头', '夜行草', '萝卜宝', '蓝豆草', '花冠', '霸王花', '香花粉',
    '森芽', '小蓝球', '叶冠', '绿发', '花朵朵', '晨草', '夜香', '翠花',
  ],
  poliwag: [
    '蚊香蝌蚪', '漩涡宝', '小水滴', '圈圈鱼', '波纹君', '泳士', '小蓝蛙', '水拳',
    '泡泡娃', '卷卷腹', '清波', '蓝波', '浪花蛙', '旋涡侠', '泉蛙', '碧涡',
  ],
  ponyta: [
    '小火马', '赤鬃', '烈焰驹', '火马儿', '红蹄', '疾焰马', '赤兔', '火云驹',
    '飞焰', '烈蹄', '暖阳驹', '星火马', '红鬃', '风火轮', '赤霞', '奔焰',
  ],
  slowpoke: [
    '呆呆兽', '呆宝', '粉呆呆', '慢半拍', '发呆王', '尾巴钩', '呆壳', '懒懒粉',
    '云呆', '迷糊兽', '悠哉', '粉嘟嘟', '呆萌', '慢悠悠', '河岸呆', '海螺尾',
  ],
  magnemite: [
    '小磁怪', '磁铁宝', '小螺丝', '吸铁石', '电眼', '磁力球', '浮空磁', '三合一',
    '铁磁', '电波球', '嗡磁', '极磁', '钢磁', '蓝电球', '银磁', '雷磁',
  ],
  shellder: [
    '大舌贝', '紫贝壳', '吐舌贝', '珍珠贝', '冰贝', '刺甲', '海贝宝', '小黑珠',
    '寒壳', '紫壳', '深海贝', '霜贝', '硬壳君', '浪贝', '冰甲', '贝贝',
  ],
  onix: [
    '大岩蛇', '巨石链', '长岩', '山脊蛇', '岩窟王', '铁岩蛇', '石龙', '巨岩君',
    '盘岩', '青岩蛇', '深窟', '崩岩', '磐蛇', '钢岩', '巨链', '岩岳',
  ],
  cubone: [
    '卡拉卡拉', '小骨头', '骨盔宝', '孤勇者', '回旋骨', '紫苑骨', '小骨龙', '骨棒侠',
    '思念', '坚骨', '砂骨', '骨帽', '勇敢骨', '小铁盔', '月下骨', '灵骨',
  ],
  rhyhorn: [
    '独角犀牛', '铁甲犀', '岩犀', '冲撞犀', '钻角', '重甲犀', '灰岩牛', '猛犀',
    '角皇', '磐石犀', '巨犀', '钢角', '山牛', '震地犀', '铁角', '岩霸',
  ],
  chansey: [
    '吉利蛋', '幸运蛋', '粉护士', '爱心蛋', '圆蛋蛋', '幸福宝', '小天使', '暖心蛋',
    '治愈粉', '胖蛋', '好彩头', '福星蛋', '甜心蛋', '糯粉蛋', '守护蛋', '吉星',
  ],
  horsea: [
    '墨海马', '小海马', '水墨马', '卷尾鱼', '海龙宝', '喷墨君', '蓝海马', '清泉马',
    '潮马', '刺海龙', '珊瑚马', '浪马', '水箭马', '星海马', '沧海马', '碧海马',
  ],
  staryu: [
    '海星星', '红宝石', '星海宝', '海星侠', '宝石星', '闪星', '水星核', '海之星',
    '旋星', '紫星', '潮星', '星芒', '碧海星', '夜海星', '璀璨星', '灵星',
  ],
  electabuzz: [
    '电击兽', '狂雷兽', '虎纹电', '高压君', '电魔', '闪电爪', '黄黑雷', '雷霆兽',
    '伏特侠', '电弧王', '霹雳兽', '惊雷', '电拳', '磁暴兽', '暴雷', '金雷',
  ],
  magmar: [
    '鸭嘴火兽', '火山炎', '熔岩兽', '赤焰君', '火冠', '炙热兽', '炎鸭', '红莲兽',
    '爆炎', '熔核', '灼热', '炎魔', '炭火兽', '烈火君', '赤炎王', '焰心',
  ],
  porygon: [
    '多边兽', '像素鸭', '棱角宝', '数据兽', '几何鸟', '虚拟宝', '零一君', '红蓝棱',
    '代码兽', '矩阵', '多面体', '超频宝', '晶格', '赛博鸭', '位元', '星数',
  ],
  aerodactyl: [
    '化石翼龙', '太古翼', '苍穹龙', '石翼龙', '远古王', '风牙', '天翼龙', '琥珀翼',
    '翼龙皇', '岩翼', '破空龙', '云巅翼', '古空', '利齿翼', '霸空', '苍翼',
  ],
  articuno: [
    '急冻鸟', '冰霜翼', '雪凤', '寒冰鸟', '霜华', '极光翼', '冰晶凤', '凛冬',
    '雪羽', '苍冰', '霜降', '冰凰', '极寒', '晴雪', '冰川圣鸟', '冷月翼',
  ],
  zapdos: [
    '闪电鸟', '雷神翼', '金雷凤', '惊雷鸟', '霹雳羽', '苍雷', '天罚翼', '雷霆凤',
    '电芒', '金羽雷', '雷鸣', '破云雷', '闪电圣鸟', '雷暴', '逐雷', '耀雷',
  ],
  moltres: [
    '火焰鸟', '不死鸟', '炽焰凤', '烈火翼', '赤阳鸟', '凤凰羽', '焚天翼', '圣焰',
    '丹凤', '赤凰', '耀阳', '炎华', '烈日圣鸟', '浴火', '霞羽', '天火',
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
  caterpie: {
    baby: { heightM: 0.3, weightKg: 2.9 },
    teen: { heightM: 0.7, weightKg: 9.9 },
    adult: { heightM: 1.1, weightKg: 32.0 },
  },
  pidgey: {
    baby: { heightM: 0.3, weightKg: 1.8 },
    teen: { heightM: 1.1, weightKg: 30.0 },
    adult: { heightM: 1.5, weightKg: 39.5 },
  },
  vulpix: {
    baby: { heightM: 0.6, weightKg: 9.9 },
    teen: { heightM: 1.1, weightKg: 19.9 },
    adult: { heightM: 1.1, weightKg: 19.9 },
  },
  diglett: {
    baby: { heightM: 0.2, weightKg: 0.8 },
    teen: { heightM: 0.7, weightKg: 33.3 },
    adult: { heightM: 0.7, weightKg: 33.3 },
  },
  growlithe: {
    baby: { heightM: 0.7, weightKg: 19.0 },
    teen: { heightM: 1.9, weightKg: 155.0 },
    adult: { heightM: 1.9, weightKg: 155.0 },
  },
  abra: {
    baby: { heightM: 0.9, weightKg: 19.5 },
    teen: { heightM: 1.3, weightKg: 56.5 },
    adult: { heightM: 1.5, weightKg: 48.0 },
  },
  machop: {
    baby: { heightM: 0.8, weightKg: 19.5 },
    teen: { heightM: 1.5, weightKg: 70.5 },
    adult: { heightM: 1.6, weightKg: 130.0 },
  },
  geodude: {
    baby: { heightM: 0.4, weightKg: 20.0 },
    teen: { heightM: 1.0, weightKg: 105.0 },
    adult: { heightM: 1.4, weightKg: 300.0 },
  },
  scyther: {
    baby: { heightM: 1.5, weightKg: 56.0 },
    teen: { heightM: 1.5, weightKg: 56.0 },
    adult: { heightM: 1.6, weightKg: 62.0 },
  },
  magikarp: {
    baby: { heightM: 0.9, weightKg: 10.0 },
    teen: { heightM: 6.5, weightKg: 235.0 },
    adult: { heightM: 6.5, weightKg: 235.0 },
  },
  lapras: {
    baby: { heightM: 2.5, weightKg: 220.0 },
    teen: { heightM: 2.5, weightKg: 220.0 },
    adult: { heightM: 2.5, weightKg: 220.0 },
  },
  mewtwo: {
    baby: { heightM: 2.0, weightKg: 122.0 },
    teen: { heightM: 2.0, weightKg: 122.0 },
    adult: { heightM: 2.0, weightKg: 122.0 },
  },
  weedle: {
    baby: { heightM: 0.3, weightKg: 3.2 },
    teen: { heightM: 0.6, weightKg: 10.0 },
    adult: { heightM: 1.0, weightKg: 29.5 },
  },
  sandshrew: {
    baby: { heightM: 0.6, weightKg: 12.0 },
    teen: { heightM: 1.0, weightKg: 29.5 },
    adult: { heightM: 1.0, weightKg: 29.5 },
  },
  nidoran: {
    baby: { heightM: 0.5, weightKg: 9.0 },
    teen: { heightM: 0.9, weightKg: 19.5 },
    adult: { heightM: 1.4, weightKg: 62.0 },
  },
  clefairy: {
    baby: { heightM: 0.6, weightKg: 7.5 },
    teen: { heightM: 1.3, weightKg: 40.0 },
    adult: { heightM: 1.3, weightKg: 40.0 },
  },
  oddish: {
    baby: { heightM: 0.5, weightKg: 5.4 },
    teen: { heightM: 0.8, weightKg: 8.6 },
    adult: { heightM: 1.2, weightKg: 18.6 },
  },
  poliwag: {
    baby: { heightM: 0.6, weightKg: 12.4 },
    teen: { heightM: 1.0, weightKg: 20.0 },
    adult: { heightM: 1.3, weightKg: 54.0 },
  },
  ponyta: {
    baby: { heightM: 1.0, weightKg: 30.0 },
    teen: { heightM: 1.7, weightKg: 95.0 },
    adult: { heightM: 1.7, weightKg: 95.0 },
  },
  slowpoke: {
    baby: { heightM: 1.2, weightKg: 36.0 },
    teen: { heightM: 1.6, weightKg: 78.5 },
    adult: { heightM: 1.6, weightKg: 78.5 },
  },
  magnemite: {
    baby: { heightM: 0.3, weightKg: 6.0 },
    teen: { heightM: 1.0, weightKg: 60.0 },
    adult: { heightM: 1.0, weightKg: 60.0 },
  },
  shellder: {
    baby: { heightM: 0.3, weightKg: 4.0 },
    teen: { heightM: 1.5, weightKg: 132.5 },
    adult: { heightM: 1.5, weightKg: 132.5 },
  },
  onix: {
    baby: { heightM: 8.8, weightKg: 210.0 },
    teen: { heightM: 8.8, weightKg: 210.0 },
    adult: { heightM: 8.8, weightKg: 210.0 },
  },
  cubone: {
    baby: { heightM: 0.4, weightKg: 6.5 },
    teen: { heightM: 1.0, weightKg: 45.0 },
    adult: { heightM: 1.0, weightKg: 45.0 },
  },
  rhyhorn: {
    baby: { heightM: 1.0, weightKg: 115.0 },
    teen: { heightM: 1.9, weightKg: 120.0 },
    adult: { heightM: 1.9, weightKg: 120.0 },
  },
  chansey: {
    baby: { heightM: 1.1, weightKg: 34.6 },
    teen: { heightM: 1.1, weightKg: 34.6 },
    adult: { heightM: 1.1, weightKg: 34.6 },
  },
  horsea: {
    baby: { heightM: 0.4, weightKg: 8.0 },
    teen: { heightM: 1.2, weightKg: 25.0 },
    adult: { heightM: 1.2, weightKg: 25.0 },
  },
  staryu: {
    baby: { heightM: 0.8, weightKg: 34.5 },
    teen: { heightM: 1.1, weightKg: 80.0 },
    adult: { heightM: 1.1, weightKg: 80.0 },
  },
  electabuzz: {
    baby: { heightM: 1.1, weightKg: 30.0 },
    teen: { heightM: 1.2, weightKg: 34.0 },
    adult: { heightM: 1.3, weightKg: 38.0 },
  },
  magmar: {
    baby: { heightM: 1.3, weightKg: 44.5 },
    teen: { heightM: 1.35, weightKg: 46.0 },
    adult: { heightM: 1.4, weightKg: 48.0 },
  },
  porygon: {
    baby: { heightM: 0.8, weightKg: 36.5 },
    teen: { heightM: 0.85, weightKg: 36.5 },
    adult: { heightM: 0.9, weightKg: 36.5 },
  },
  aerodactyl: {
    baby: { heightM: 1.8, weightKg: 59.0 },
    teen: { heightM: 1.8, weightKg: 59.0 },
    adult: { heightM: 1.9, weightKg: 62.0 },
  },
  articuno: {
    baby: { heightM: 1.7, weightKg: 55.4 },
    teen: { heightM: 1.8, weightKg: 55.4 },
    adult: { heightM: 1.9, weightKg: 55.4 },
  },
  zapdos: {
    baby: { heightM: 1.6, weightKg: 52.6 },
    teen: { heightM: 1.7, weightKg: 52.6 },
    adult: { heightM: 1.8, weightKg: 52.6 },
  },
  moltres: {
    baby: { heightM: 2.0, weightKg: 60.0 },
    teen: { heightM: 2.0, weightKg: 60.0 },
    adult: { heightM: 2.1, weightKg: 60.0 },
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
 * - Heavyweights (Charizard 90kg, Venusaur 100kg, Dragonite 210kg, Legendary Birds): ~3.10 – 4.10m
 * - Colossal Snorlax (2.1m / 460kg), Onix (8.8m) & Gyarados (6.5m / 235kg): ~4.25m+
 */
export function getPokemonWorldScale3D(
  species: SpeciesId,
  stage: GrowthStage,
  extraMult = 1.0,
): number {
  const { heightM, weightKg } = getPokemonPhysicalMetrics(species, stage);
  // Iconic large / legendary Pokémon feel genuinely majestic!
  const isGiantDragon =
    ((species === 'charmander' || species === 'dratini') && stage === 'adult') ||
    (species === 'magikarp' && stage !== 'baby') ||
    species === 'onix' ||
    species === 'aerodactyl' ||
    species === 'articuno' ||
    species === 'zapdos' ||
    species === 'moltres';
  const effHeight = Math.min(2.6, heightM);
  const weightBoost = Math.pow(Math.max(1, weightKg), 0.25) * 0.46;
  const base = (1.05 + effHeight * 0.68 + weightBoost) * (isGiantDragon ? 1.22 : 1.0);
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
  caterpie: {
    id: 'caterpie',
    dexNo: '#010',
    title: '绿毛虫',
    english: 'CATERPIE',
    defaultName: '绿毛虫',
    rarity: 'R',
    element: 'grass',
    typeLabel: '虫系',
    typeIcon: 'leaf',
    typeColor: '#74b816',
    stageNames: { baby: '绿毛虫', teen: '铁甲蛹', adult: '巴大蝶' },
    stageDexNos: { baby: '#010', teen: '#011', adult: '#012' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/10.gif', static: '/sprites/pokemon/10.png', icon: '/sprites/pokemon/icon-10.png', portrait: '/sprites/pokemon/portrait-10.png', sleep: '/sprites/pokemon/sleep-10.gif' },
      teen: { animated: '/sprites/pokemon/11.gif', static: '/sprites/pokemon/11.png', icon: '/sprites/pokemon/icon-11.png', portrait: '/sprites/pokemon/portrait-11.png', sleep: '/sprites/pokemon/sleep-11.gif' },
      adult: { animated: '/sprites/pokemon/12.gif', static: '/sprites/pokemon/12.png', icon: '/sprites/pokemon/icon-12.png', portrait: '/sprites/pokemon/portrait-12.png', sleep: '/sprites/pokemon/sleep-12.gif' },
    },
    evoLevels: { teen: 7, adult: 10 },
    trait: '极速蜕变 · 催眠鳞粉',
    favoriteFood: 'oran_berry',
    description: '关都森林最经典的早熟伙伴！Lv.7 结茧铁甲蛹，Lv.10 破茧化作巴大蝶！',
  },
  pidgey: {
    id: 'pidgey',
    dexNo: '#016',
    title: '波波',
    english: 'PIDGEY',
    defaultName: '波波',
    rarity: 'R',
    element: 'normal',
    typeLabel: '飞行',
    typeIcon: 'star',
    typeColor: '#74c0fc',
    stageNames: { baby: '波波', teen: '比比鸟', adult: '大比鸟' },
    stageDexNos: { baby: '#016', teen: '#017', adult: '#018' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/16.gif', static: '/sprites/pokemon/16.png', icon: '/sprites/pokemon/icon-16.png', portrait: '/sprites/pokemon/portrait-16.png', sleep: '/sprites/pokemon/sleep-16.gif' },
      teen: { animated: '/sprites/pokemon/17.gif', static: '/sprites/pokemon/17.png', icon: '/sprites/pokemon/icon-17.png', portrait: '/sprites/pokemon/portrait-17.png', sleep: '/sprites/pokemon/sleep-17.gif' },
      adult: { animated: '/sprites/pokemon/18.gif', static: '/sprites/pokemon/18.png', icon: '/sprites/pokemon/icon-18.png', portrait: '/sprites/pokemon/portrait-18.png', sleep: '/sprites/pokemon/sleep-18.gif' },
    },
    evoLevels: { teen: 18, adult: 36 },
    trait: '暴风之翼 · 极速俯冲',
    favoriteFood: 'cheri_berry',
    description: '1 号道路最可靠的蓝天搭档，Lv.18 进化比比鸟，Lv.36 展翅成为大比鸟！',
  },
  vulpix: {
    id: 'vulpix',
    dexNo: '#037',
    title: '六尾',
    english: 'VULPIX',
    defaultName: '六尾',
    rarity: 'R',
    element: 'fire',
    typeLabel: '火系',
    typeIcon: 'fire',
    typeColor: '#ff6b35',
    stageNames: { baby: '六尾', teen: '九尾', adult: '九尾' },
    stageDexNos: { baby: '#037', teen: '#038', adult: '#038' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/37.gif', static: '/sprites/pokemon/37.png', icon: '/sprites/pokemon/icon-37.png', portrait: '/sprites/pokemon/portrait-37.png', sleep: '/sprites/pokemon/sleep-37.gif' },
      teen: { animated: '/sprites/pokemon/38.gif', static: '/sprites/pokemon/38.png', icon: '/sprites/pokemon/icon-38.png', portrait: '/sprites/pokemon/portrait-38.png', sleep: '/sprites/pokemon/sleep-38.gif' },
      adult: { animated: '/sprites/pokemon/38.gif', static: '/sprites/pokemon/38.png', icon: '/sprites/pokemon/icon-38.png', portrait: '/sprites/pokemon/portrait-38.png', sleep: '/sprites/pokemon/sleep-38.gif' },
    },
    evoLevels: { teen: 24, adult: 24 },
    trait: '绯红灵尾 · 幽火魅影',
    favoriteFood: 'pecha_berry',
    description: '毛色艳丽的火狐宝可梦，Lv.24 沐浴火之石共鸣进化为神圣优雅的九尾！',
  },
  diglett: {
    id: 'diglett',
    dexNo: '#050',
    title: '地鼠',
    english: 'DIGLETT',
    defaultName: '地鼠',
    rarity: 'R',
    element: 'normal',
    typeLabel: '地面',
    typeIcon: 'meat',
    typeColor: '#b08968',
    stageNames: { baby: '地鼠', teen: '三地鼠', adult: '三地鼠' },
    stageDexNos: { baby: '#050', teen: '#051', adult: '#051' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/50.gif', static: '/sprites/pokemon/50.png', icon: '/sprites/pokemon/icon-50.png', portrait: '/sprites/pokemon/portrait-50.png', sleep: '/sprites/pokemon/sleep-50.gif' },
      teen: { animated: '/sprites/pokemon/51.gif', static: '/sprites/pokemon/51.png', icon: '/sprites/pokemon/icon-51.png', portrait: '/sprites/pokemon/portrait-51.png', sleep: '/sprites/pokemon/sleep-51.gif' },
      adult: { animated: '/sprites/pokemon/51.gif', static: '/sprites/pokemon/51.png', icon: '/sprites/pokemon/icon-51.png', portrait: '/sprites/pokemon/portrait-51.png', sleep: '/sprites/pokemon/sleep-51.gif' },
    },
    evoLevels: { teen: 26, adult: 26 },
    trait: '地下神速 · 地震突袭',
    favoriteFood: 'oran_berry',
    description: '神秘潜行于大地之下，Lv.26 进化为三兄弟齐心协力的三地鼠！',
  },
  growlithe: {
    id: 'growlithe',
    dexNo: '#058',
    title: '卡蒂狗',
    english: 'GROWLITHE',
    defaultName: '卡蒂狗',
    rarity: 'SR',
    element: 'fire',
    typeLabel: '火系',
    typeIcon: 'fire',
    typeColor: '#e8590c',
    stageNames: { baby: '卡蒂狗', teen: '风速狗', adult: '风速狗' },
    stageDexNos: { baby: '#058', teen: '#059', adult: '#059' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/58.gif', static: '/sprites/pokemon/58.png', icon: '/sprites/pokemon/icon-58.png', portrait: '/sprites/pokemon/portrait-58.png', sleep: '/sprites/pokemon/sleep-58.gif' },
      teen: { animated: '/sprites/pokemon/59.gif', static: '/sprites/pokemon/59.png', icon: '/sprites/pokemon/icon-59.png', portrait: '/sprites/pokemon/portrait-59.png', sleep: '/sprites/pokemon/sleep-59.gif' },
      adult: { animated: '/sprites/pokemon/59.gif', static: '/sprites/pokemon/59.png', icon: '/sprites/pokemon/icon-59.png', portrait: '/sprites/pokemon/portrait-59.png', sleep: '/sprites/pokemon/sleep-59.gif' },
    },
    evoLevels: { teen: 28, adult: 28 },
    trait: '忠勇威吓 · 神速奔腾',
    favoriteFood: 'curry',
    description: '忠诚勇敢的小火犬，Lv.28 进化为日行万里的传说级疾驰名犬风速狗！',
  },
  abra: {
    id: 'abra',
    dexNo: '#063',
    title: '凯西',
    english: 'ABRA',
    defaultName: '凯西',
    rarity: 'SR',
    element: 'psychic',
    typeLabel: '超能力',
    typeIcon: 'psychic',
    typeColor: '#ae3ec9',
    stageNames: { baby: '凯西', teen: '勇基拉', adult: '胡地' },
    stageDexNos: { baby: '#063', teen: '#064', adult: '#065' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/63.gif', static: '/sprites/pokemon/63.png', icon: '/sprites/pokemon/icon-63.png', portrait: '/sprites/pokemon/portrait-63.png', sleep: '/sprites/pokemon/sleep-63.gif' },
      teen: { animated: '/sprites/pokemon/64.gif', static: '/sprites/pokemon/64.png', icon: '/sprites/pokemon/icon-64.png', portrait: '/sprites/pokemon/portrait-64.png', sleep: '/sprites/pokemon/sleep-64.gif' },
      adult: { animated: '/sprites/pokemon/65.gif', static: '/sprites/pokemon/65.png', icon: '/sprites/pokemon/icon-65.png', portrait: '/sprites/pokemon/portrait-65.png', sleep: '/sprites/pokemon/sleep-65.gif' },
    },
    evoLevels: { teen: 16, adult: 36 },
    trait: '瞬间移动 · 智商五千',
    favoriteFood: 'pokepuff',
    description: '每天睡 18 小时的超能奇才，Lv.16 进化勇基拉，Lv.36 成为双匙贤者胡地！',
  },
  machop: {
    id: 'machop',
    dexNo: '#066',
    title: '腕力',
    english: 'MACHOP',
    defaultName: '腕力',
    rarity: 'R',
    element: 'normal',
    typeLabel: '格斗',
    typeIcon: 'meat',
    typeColor: '#c92a2a',
    stageNames: { baby: '腕力', teen: '豪力', adult: '怪力' },
    stageDexNos: { baby: '#066', teen: '#067', adult: '#068' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/66.gif', static: '/sprites/pokemon/66.png', icon: '/sprites/pokemon/icon-66.png', portrait: '/sprites/pokemon/portrait-66.png', sleep: '/sprites/pokemon/sleep-66.gif' },
      teen: { animated: '/sprites/pokemon/67.gif', static: '/sprites/pokemon/67.png', icon: '/sprites/pokemon/icon-67.png', portrait: '/sprites/pokemon/portrait-67.png', sleep: '/sprites/pokemon/sleep-67.gif' },
      adult: { animated: '/sprites/pokemon/68.gif', static: '/sprites/pokemon/68.png', icon: '/sprites/pokemon/icon-68.png', portrait: '/sprites/pokemon/portrait-68.png', sleep: '/sprites/pokemon/sleep-68.gif' },
    },
    evoLevels: { teen: 28, adult: 42 },
    trait: '无尽锻炼 · 四臂重拳',
    favoriteFood: 'rage_candy',
    description: '热爱举重特训的格斗新星，Lv.28 进化豪力，Lv.42 觉醒四臂战神怪力！',
  },
  geodude: {
    id: 'geodude',
    dexNo: '#074',
    title: '小拳石',
    english: 'GEODUDE',
    defaultName: '小拳石',
    rarity: 'R',
    element: 'normal',
    typeLabel: '岩石',
    typeIcon: 'coin',
    typeColor: '#8d6e63',
    stageNames: { baby: '小拳石', teen: '隆隆石', adult: '隆隆岩' },
    stageDexNos: { baby: '#074', teen: '#075', adult: '#076' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/74.gif', static: '/sprites/pokemon/74.png', icon: '/sprites/pokemon/icon-74.png', portrait: '/sprites/pokemon/portrait-74.png', sleep: '/sprites/pokemon/sleep-74.gif' },
      teen: { animated: '/sprites/pokemon/75.gif', static: '/sprites/pokemon/75.png', icon: '/sprites/pokemon/icon-75.png', portrait: '/sprites/pokemon/portrait-75.png', sleep: '/sprites/pokemon/sleep-75.gif' },
      adult: { animated: '/sprites/pokemon/76.gif', static: '/sprites/pokemon/76.png', icon: '/sprites/pokemon/icon-76.png', portrait: '/sprites/pokemon/portrait-76.png', sleep: '/sprites/pokemon/sleep-76.gif' },
    },
    evoLevels: { teen: 25, adult: 40 },
    trait: '结实岩铠 · 滚石轰鸣',
    favoriteFood: 'sitrus_berry',
    description: '栖息在月见山与岩窟的坚毅岩怪，Lv.25 进化隆隆石，Lv.40 化作重甲隆隆岩！',
  },
  scyther: {
    id: 'scyther',
    dexNo: '#123',
    title: '飞天螳螂',
    english: 'SCYTHER',
    defaultName: '飞天螳螂',
    rarity: 'SR',
    element: 'grass',
    typeLabel: '虫/飞',
    typeIcon: 'leaf',
    typeColor: '#2b8a3e',
    stageNames: { baby: '飞天螳螂', teen: '飞天螳螂', adult: '飞天螳螂' },
    stageDexNos: { baby: '#123', teen: '#123', adult: '#123' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/123.gif', static: '/sprites/pokemon/123.png', icon: '/sprites/pokemon/icon-123.png', portrait: '/sprites/pokemon/portrait-123.png', sleep: '/sprites/pokemon/sleep-123.gif' },
      teen: { animated: '/sprites/pokemon/123.gif', static: '/sprites/pokemon/123.png', icon: '/sprites/pokemon/icon-123.png', portrait: '/sprites/pokemon/portrait-123.png', sleep: '/sprites/pokemon/sleep-123.gif' },
      adult: { animated: '/sprites/pokemon/123.gif', static: '/sprites/pokemon/123.png', icon: '/sprites/pokemon/icon-123.png', portrait: '/sprites/pokemon/portrait-123.png', sleep: '/sprites/pokemon/sleep-123.gif' },
    },
    evoLevels: { teen: 24, adult: 42 },
    trait: '翠绿双镰 · 忍者瞬步',
    favoriteFood: 'cheri_berry',
    description: '狩猎地带稀有的疾风剑士，高速移动留下的残影连肉眼都难以捕捉！',
  },
  magikarp: {
    id: 'magikarp',
    dexNo: '#129',
    title: '鲤鱼王',
    english: 'MAGIKARP',
    defaultName: '鲤鱼王',
    rarity: 'SR',
    element: 'water',
    typeLabel: '水系',
    typeIcon: 'water',
    typeColor: '#1971c2',
    stageNames: { baby: '鲤鱼王', teen: '暴鲤龙', adult: '暴鲤龙' },
    stageDexNos: { baby: '#129', teen: '#130', adult: '#130' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/129.gif', static: '/sprites/pokemon/129.png', icon: '/sprites/pokemon/icon-129.png', portrait: '/sprites/pokemon/portrait-129.png', sleep: '/sprites/pokemon/sleep-129.gif' },
      teen: { animated: '/sprites/pokemon/130.gif', static: '/sprites/pokemon/130.png', icon: '/sprites/pokemon/icon-130.png', portrait: '/sprites/pokemon/portrait-130.png', sleep: '/sprites/pokemon/sleep-130.gif' },
      adult: { animated: '/sprites/pokemon/130.gif', static: '/sprites/pokemon/130.png', icon: '/sprites/pokemon/icon-130.png', portrait: '/sprites/pokemon/portrait-130.png', sleep: '/sprites/pokemon/sleep-130.gif' },
    },
    evoLevels: { teen: 20, adult: 36 },
    trait: '鲤跃龙门 · 怒涛霸主',
    favoriteFood: 'moomoo_milk',
    description: '看似只会水溅跃的小红鱼，坚持培育到 Lv.20 便会一跃化龙成为暴鲤龙！',
  },
  lapras: {
    id: 'lapras',
    dexNo: '#131',
    title: '拉普拉斯',
    english: 'LAPRAS',
    defaultName: '拉普拉斯',
    rarity: 'SR',
    element: 'water',
    typeLabel: '水/冰',
    typeIcon: 'water',
    typeColor: '#15aabf',
    stageNames: { baby: '拉普拉斯', teen: '拉普拉斯', adult: '拉普拉斯' },
    stageDexNos: { baby: '#131', teen: '#131', adult: '#131' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/131.gif', static: '/sprites/pokemon/131.png', icon: '/sprites/pokemon/icon-131.png', portrait: '/sprites/pokemon/portrait-131.png', sleep: '/sprites/pokemon/sleep-131.gif' },
      teen: { animated: '/sprites/pokemon/131.gif', static: '/sprites/pokemon/131.png', icon: '/sprites/pokemon/icon-131.png', portrait: '/sprites/pokemon/portrait-131.png', sleep: '/sprites/pokemon/sleep-131.gif' },
      adult: { animated: '/sprites/pokemon/131.gif', static: '/sprites/pokemon/131.png', icon: '/sprites/pokemon/icon-131.png', portrait: '/sprites/pokemon/portrait-131.png', sleep: '/sprites/pokemon/sleep-131.gif' },
    },
    evoLevels: { teen: 28, adult: 45 },
    trait: '温柔渡海 · 绝对零度',
    favoriteFood: 'casteliacone',
    description: '智慧且温柔的乘龙宝可梦，喜欢背着训练师横渡冰海并唱起悠扬海歌。',
  },
  mewtwo: {
    id: 'mewtwo',
    dexNo: '#150',
    title: '超梦',
    english: 'MEWTWO',
    defaultName: '超梦',
    rarity: 'SSR',
    element: 'psychic',
    typeLabel: '超能力',
    typeIcon: 'psychic',
    typeColor: '#7950f2',
    stageNames: { baby: '超梦', teen: '超梦', adult: '超梦' },
    stageDexNos: { baby: '#150', teen: '#150', adult: '#150' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/150.gif', static: '/sprites/pokemon/150.png', icon: '/sprites/pokemon/icon-150.png', portrait: '/sprites/pokemon/portrait-150.png', sleep: '/sprites/pokemon/sleep-150.gif' },
      teen: { animated: '/sprites/pokemon/150.gif', static: '/sprites/pokemon/150.png', icon: '/sprites/pokemon/icon-150.png', portrait: '/sprites/pokemon/portrait-150.png', sleep: '/sprites/pokemon/sleep-150.gif' },
      adult: { animated: '/sprites/pokemon/150.gif', static: '/sprites/pokemon/150.png', icon: '/sprites/pokemon/icon-150.png', portrait: '/sprites/pokemon/portrait-150.png', sleep: '/sprites/pokemon/sleep-150.gif' },
    },
    evoLevels: { teen: 35, adult: 55 },
    trait: '传说基因 · 精神击破',
    favoriteFood: 'rare_candy',
    description: '关都最强传说级超能力宝可梦！Lv.35/55 解放究极念力压制全场！',
  },
  weedle: {
    id: 'weedle',
    dexNo: '#013',
    title: '独角虫',
    english: 'WEEDLE',
    defaultName: '独角虫',
    rarity: 'R',
    element: 'grass',
    typeLabel: '虫/毒',
    typeIcon: 'leaf',
    typeColor: '#94d82d',
    stageNames: { baby: '独角虫', teen: '铁壳蛹', adult: '大针蜂' },
    stageDexNos: { baby: '#013', teen: '#014', adult: '#015' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/13.gif', static: '/sprites/pokemon/13.png', icon: '/sprites/pokemon/icon-13.png', portrait: '/sprites/pokemon/portrait-13.png', sleep: '/sprites/pokemon/sleep-13.gif' },
      teen: { animated: '/sprites/pokemon/14.gif', static: '/sprites/pokemon/14.png', icon: '/sprites/pokemon/icon-14.png', portrait: '/sprites/pokemon/portrait-14.png', sleep: '/sprites/pokemon/sleep-14.gif' },
      adult: { animated: '/sprites/pokemon/15.gif', static: '/sprites/pokemon/15.png', icon: '/sprites/pokemon/icon-15.png', portrait: '/sprites/pokemon/portrait-15.png', sleep: '/sprites/pokemon/sleep-15.gif' },
    },
    evoLevels: { teen: 7, adult: 10 },
    trait: '极速成型 · 剧毒双针',
    favoriteFood: 'oran_berry',
    description: '常磐森林的疾速虫系伙伴，Lv.7 铁壳蛹，Lv.10 化作锐不可当的大针蜂！',
  },
  sandshrew: {
    id: 'sandshrew',
    dexNo: '#027',
    title: '穿山鼠',
    english: 'SANDSHREW',
    defaultName: '穿山鼠',
    rarity: 'R',
    element: 'normal',
    typeLabel: '地面',
    typeIcon: 'meat',
    typeColor: '#e09f3e',
    stageNames: { baby: '穿山鼠', teen: '穿山王', adult: '穿山王' },
    stageDexNos: { baby: '#027', teen: '#028', adult: '#028' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/27.gif', static: '/sprites/pokemon/27.png', icon: '/sprites/pokemon/icon-27.png', portrait: '/sprites/pokemon/portrait-27.png', sleep: '/sprites/pokemon/sleep-27.gif' },
      teen: { animated: '/sprites/pokemon/28.gif', static: '/sprites/pokemon/28.png', icon: '/sprites/pokemon/icon-28.png', portrait: '/sprites/pokemon/portrait-28.png', sleep: '/sprites/pokemon/sleep-28.gif' },
      adult: { animated: '/sprites/pokemon/28.gif', static: '/sprites/pokemon/28.png', icon: '/sprites/pokemon/icon-28.png', portrait: '/sprites/pokemon/portrait-28.png', sleep: '/sprites/pokemon/sleep-28.gif' },
    },
    evoLevels: { teen: 22, adult: 22 },
    trait: '沙漠滚球 · 锋利钢爪',
    favoriteFood: 'sitrus_berry',
    description: '干燥沙地里最坚韧的小不点，Lv.22 进化为背披尖刺钢甲的穿山王！',
  },
  nidoran: {
    id: 'nidoran',
    dexNo: '#032',
    title: '尼多朗',
    english: 'NIDORAN♂',
    defaultName: '尼多朗',
    rarity: 'SR',
    element: 'grass',
    typeLabel: '毒/地',
    typeIcon: 'sparkle',
    typeColor: '#9c36b5',
    stageNames: { baby: '尼多朗', teen: '尼多力诺', adult: '尼多王' },
    stageDexNos: { baby: '#032', teen: '#033', adult: '#034' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/32.gif', static: '/sprites/pokemon/32.png', icon: '/sprites/pokemon/icon-32.png', portrait: '/sprites/pokemon/portrait-32.png', sleep: '/sprites/pokemon/sleep-32.gif' },
      teen: { animated: '/sprites/pokemon/33.gif', static: '/sprites/pokemon/33.png', icon: '/sprites/pokemon/icon-33.png', portrait: '/sprites/pokemon/portrait-33.png', sleep: '/sprites/pokemon/sleep-33.gif' },
      adult: { animated: '/sprites/pokemon/34.gif', static: '/sprites/pokemon/34.png', icon: '/sprites/pokemon/icon-34.png', portrait: '/sprites/pokemon/portrait-34.png', sleep: '/sprites/pokemon/sleep-34.gif' },
    },
    evoLevels: { teen: 16, adult: 34 },
    trait: '关都速通王 · 霸道巨角',
    favoriteFood: 'rage_candy',
    description: '关都传奇全能战神！Lv.16 进化尼多力诺，Lv.34 登基成为霸气尼多王！',
  },
  clefairy: {
    id: 'clefairy',
    dexNo: '#035',
    title: '皮皮',
    english: 'CLEFAIRY',
    defaultName: '皮皮',
    rarity: 'R',
    element: 'fairy',
    typeLabel: '妖精',
    typeIcon: 'heart',
    typeColor: '#f783ac',
    stageNames: { baby: '皮皮', teen: '皮可西', adult: '皮可西' },
    stageDexNos: { baby: '#035', teen: '#036', adult: '#036' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/35.gif', static: '/sprites/pokemon/35.png', icon: '/sprites/pokemon/icon-35.png', portrait: '/sprites/pokemon/portrait-35.png', sleep: '/sprites/pokemon/sleep-35.gif' },
      teen: { animated: '/sprites/pokemon/36.gif', static: '/sprites/pokemon/36.png', icon: '/sprites/pokemon/icon-36.png', portrait: '/sprites/pokemon/portrait-36.png', sleep: '/sprites/pokemon/sleep-36.gif' },
      adult: { animated: '/sprites/pokemon/36.gif', static: '/sprites/pokemon/36.png', icon: '/sprites/pokemon/icon-36.png', portrait: '/sprites/pokemon/portrait-36.png', sleep: '/sprites/pokemon/sleep-36.gif' },
    },
    evoLevels: { teen: 24, adult: 24 },
    trait: '月见山舞者 · 月光魔力',
    favoriteFood: 'pokepuff',
    description: '满月之夜会在月见山起舞的神秘妖精，Lv.24 借月之石进化为皮可西！',
  },
  oddish: {
    id: 'oddish',
    dexNo: '#043',
    title: '走路草',
    english: 'ODDISH',
    defaultName: '走路草',
    rarity: 'R',
    element: 'grass',
    typeLabel: '草/毒',
    typeIcon: 'leaf',
    typeColor: '#2f9e44',
    stageNames: { baby: '走路草', teen: '臭臭花', adult: '霸王花' },
    stageDexNos: { baby: '#043', teen: '#044', adult: '#045' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/43.gif', static: '/sprites/pokemon/43.png', icon: '/sprites/pokemon/icon-43.png', portrait: '/sprites/pokemon/portrait-43.png', sleep: '/sprites/pokemon/sleep-43.gif' },
      teen: { animated: '/sprites/pokemon/44.gif', static: '/sprites/pokemon/44.png', icon: '/sprites/pokemon/icon-44.png', portrait: '/sprites/pokemon/portrait-44.png', sleep: '/sprites/pokemon/sleep-44.gif' },
      adult: { animated: '/sprites/pokemon/45.gif', static: '/sprites/pokemon/45.png', icon: '/sprites/pokemon/icon-45.png', portrait: '/sprites/pokemon/portrait-45.png', sleep: '/sprites/pokemon/sleep-45.gif' },
    },
    evoLevels: { teen: 21, adult: 36 },
    trait: '月下漫步 · 巨花孢子',
    favoriteFood: 'oran_berry',
    description: '白天埋在土里、夜晚四处散步，Lv.21 臭臭花，Lv.36 盛放为霸王花！',
  },
  poliwag: {
    id: 'poliwag',
    dexNo: '#060',
    title: '蚊香蝌蚪',
    english: 'POLIWAG',
    defaultName: '蚊香蝌蚪',
    rarity: 'R',
    element: 'water',
    typeLabel: '水/格斗',
    typeIcon: 'water',
    typeColor: '#1c7ed6',
    stageNames: { baby: '蚊香蝌蚪', teen: '蚊香君', adult: '蚊香泳士' },
    stageDexNos: { baby: '#060', teen: '#061', adult: '#062' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/60.gif', static: '/sprites/pokemon/60.png', icon: '/sprites/pokemon/icon-60.png', portrait: '/sprites/pokemon/portrait-60.png', sleep: '/sprites/pokemon/sleep-60.gif' },
      teen: { animated: '/sprites/pokemon/61.gif', static: '/sprites/pokemon/61.png', icon: '/sprites/pokemon/icon-61.png', portrait: '/sprites/pokemon/portrait-61.png', sleep: '/sprites/pokemon/sleep-61.gif' },
      adult: { animated: '/sprites/pokemon/62.gif', static: '/sprites/pokemon/62.png', icon: '/sprites/pokemon/icon-62.png', portrait: '/sprites/pokemon/portrait-62.png', sleep: '/sprites/pokemon/sleep-62.gif' },
    },
    evoLevels: { teen: 25, adult: 38 },
    trait: '漩涡肚纹 · 刚猛水拳',
    favoriteFood: 'moomoo_milk',
    description: '赤红最初的漫画搭档！Lv.25 进化蚊香君，Lv.38 成为水格双修的蚊香泳士！',
  },
  ponyta: {
    id: 'ponyta',
    dexNo: '#077',
    title: '小火马',
    english: 'PONYTA',
    defaultName: '小火马',
    rarity: 'R',
    element: 'fire',
    typeLabel: '火系',
    typeIcon: 'fire',
    typeColor: '#ff5924',
    stageNames: { baby: '小火马', teen: '烈焰马', adult: '烈焰马' },
    stageDexNos: { baby: '#077', teen: '#078', adult: '#078' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/77.gif', static: '/sprites/pokemon/77.png', icon: '/sprites/pokemon/icon-77.png', portrait: '/sprites/pokemon/portrait-77.png', sleep: '/sprites/pokemon/sleep-77.gif' },
      teen: { animated: '/sprites/pokemon/78.gif', static: '/sprites/pokemon/78.png', icon: '/sprites/pokemon/icon-78.png', portrait: '/sprites/pokemon/portrait-78.png', sleep: '/sprites/pokemon/sleep-78.gif' },
      adult: { animated: '/sprites/pokemon/78.gif', static: '/sprites/pokemon/78.png', icon: '/sprites/pokemon/icon-78.png', portrait: '/sprites/pokemon/portrait-78.png', sleep: '/sprites/pokemon/sleep-78.gif' },
    },
    evoLevels: { teen: 32, adult: 32 },
    trait: '火焰鬃毛 · 追风疾驰',
    favoriteFood: 'cheri_berry',
    description: '信赖主人便绝不会灼伤对方的骏马，Lv.32 进化为风驰电掣的烈焰马！',
  },
  slowpoke: {
    id: 'slowpoke',
    dexNo: '#079',
    title: '呆呆兽',
    english: 'SLOWPOKE',
    defaultName: '呆呆兽',
    rarity: 'R',
    element: 'water',
    typeLabel: '水/超能',
    typeIcon: 'water',
    typeColor: '#f06595',
    stageNames: { baby: '呆呆兽', teen: '呆壳兽', adult: '呆壳兽' },
    stageDexNos: { baby: '#079', teen: '#080', adult: '#080' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/79.gif', static: '/sprites/pokemon/79.png', icon: '/sprites/pokemon/icon-79.png', portrait: '/sprites/pokemon/portrait-79.png', sleep: '/sprites/pokemon/sleep-79.gif' },
      teen: { animated: '/sprites/pokemon/80.gif', static: '/sprites/pokemon/80.png', icon: '/sprites/pokemon/icon-80.png', portrait: '/sprites/pokemon/portrait-80.png', sleep: '/sprites/pokemon/sleep-80.gif' },
      adult: { animated: '/sprites/pokemon/80.gif', static: '/sprites/pokemon/80.png', icon: '/sprites/pokemon/icon-80.png', portrait: '/sprites/pokemon/portrait-80.png', sleep: '/sprites/pokemon/sleep-80.gif' },
    },
    evoLevels: { teen: 30, adult: 30 },
    trait: '佛系钓鱼 · 隐藏强念',
    favoriteFood: 'pecha_berry',
    description: '反射弧绕地球一圈的治愈系萌物，Lv.30 被大舌贝咬住尾巴进化为呆壳兽！',
  },
  magnemite: {
    id: 'magnemite',
    dexNo: '#081',
    title: '小磁怪',
    english: 'MAGNEMITE',
    defaultName: '小磁怪',
    rarity: 'R',
    element: 'electric',
    typeLabel: '电/钢',
    typeIcon: 'bolt',
    typeColor: '#fab005',
    stageNames: { baby: '小磁怪', teen: '三合一磁怪', adult: '三合一磁怪' },
    stageDexNos: { baby: '#081', teen: '#082', adult: '#082' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/81.gif', static: '/sprites/pokemon/81.png', icon: '/sprites/pokemon/icon-81.png', portrait: '/sprites/pokemon/portrait-81.png', sleep: '/sprites/pokemon/sleep-81.gif' },
      teen: { animated: '/sprites/pokemon/82.gif', static: '/sprites/pokemon/82.png', icon: '/sprites/pokemon/icon-82.png', portrait: '/sprites/pokemon/portrait-82.png', sleep: '/sprites/pokemon/sleep-82.gif' },
      adult: { animated: '/sprites/pokemon/82.gif', static: '/sprites/pokemon/82.png', icon: '/sprites/pokemon/icon-82.png', portrait: '/sprites/pokemon/portrait-82.png', sleep: '/sprites/pokemon/sleep-82.gif' },
    },
    evoLevels: { teen: 30, adult: 30 },
    trait: '反重力悬浮 · 电磁护盾',
    favoriteFood: 'sitrus_berry',
    description: '借由电磁波悬浮在空中的机械精灵，Lv.30 三体联结进化为三合一磁怪！',
  },
  shellder: {
    id: 'shellder',
    dexNo: '#090',
    title: '大舌贝',
    english: 'SHELLDER',
    defaultName: '大舌贝',
    rarity: 'R',
    element: 'water',
    typeLabel: '水/冰',
    typeIcon: 'water',
    typeColor: '#22b8cf',
    stageNames: { baby: '大舌贝', teen: '刺甲贝', adult: '刺甲贝' },
    stageDexNos: { baby: '#090', teen: '#091', adult: '#091' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/90.gif', static: '/sprites/pokemon/90.png', icon: '/sprites/pokemon/icon-90.png', portrait: '/sprites/pokemon/portrait-90.png', sleep: '/sprites/pokemon/sleep-90.gif' },
      teen: { animated: '/sprites/pokemon/91.gif', static: '/sprites/pokemon/91.png', icon: '/sprites/pokemon/icon-91.png', portrait: '/sprites/pokemon/portrait-91.png', sleep: '/sprites/pokemon/sleep-91.gif' },
      adult: { animated: '/sprites/pokemon/91.gif', static: '/sprites/pokemon/91.png', icon: '/sprites/pokemon/icon-91.png', portrait: '/sprites/pokemon/portrait-91.png', sleep: '/sprites/pokemon/sleep-91.gif' },
    },
    evoLevels: { teen: 26, adult: 26 },
    trait: '钻石硬壳 · 冰锥连射',
    favoriteFood: 'casteliacone',
    description: '平时调皮吐着粉嫩小舌头，Lv.26 进化为防御堪称铁壁的冰霜堡垒刺甲贝！',
  },
  onix: {
    id: 'onix',
    dexNo: '#095',
    title: '大岩蛇',
    english: 'ONIX',
    defaultName: '大岩蛇',
    rarity: 'SR',
    element: 'normal',
    typeLabel: '岩石/地',
    typeIcon: 'coin',
    typeColor: '#868e96',
    stageNames: { baby: '大岩蛇', teen: '大岩蛇', adult: '大岩蛇' },
    stageDexNos: { baby: '#095', teen: '#095', adult: '#095' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/95.gif', static: '/sprites/pokemon/95.png', icon: '/sprites/pokemon/icon-95.png', portrait: '/sprites/pokemon/portrait-95.png', sleep: '/sprites/pokemon/sleep-95.gif' },
      teen: { animated: '/sprites/pokemon/95.gif', static: '/sprites/pokemon/95.png', icon: '/sprites/pokemon/icon-95.png', portrait: '/sprites/pokemon/portrait-95.png', sleep: '/sprites/pokemon/sleep-95.gif' },
      adult: { animated: '/sprites/pokemon/95.gif', static: '/sprites/pokemon/95.png', icon: '/sprites/pokemon/icon-95.png', portrait: '/sprites/pokemon/portrait-95.png', sleep: '/sprites/pokemon/sleep-95.gif' },
    },
    evoLevels: { teen: 26, adult: 42 },
    trait: '九米巨岩 · 小刚王牌',
    favoriteFood: 'curry',
    description: '尼比道馆小刚的招牌王牌！近 9 米长的巨岩身躯能以时速 80 公里穿梭地底！',
  },
  cubone: {
    id: 'cubone',
    dexNo: '#104',
    title: '卡拉卡拉',
    english: 'CUBONE',
    defaultName: '卡拉卡拉',
    rarity: 'SR',
    element: 'normal',
    typeLabel: '地面',
    typeIcon: 'ghost',
    typeColor: '#c08552',
    stageNames: { baby: '卡拉卡拉', teen: '嘎啦嘎啦', adult: '嘎啦嘎啦' },
    stageDexNos: { baby: '#104', teen: '#105', adult: '#105' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/104.gif', static: '/sprites/pokemon/104.png', icon: '/sprites/pokemon/icon-104.png', portrait: '/sprites/pokemon/portrait-104.png', sleep: '/sprites/pokemon/sleep-104.gif' },
      teen: { animated: '/sprites/pokemon/105.gif', static: '/sprites/pokemon/105.png', icon: '/sprites/pokemon/icon-105.png', portrait: '/sprites/pokemon/portrait-105.png', sleep: '/sprites/pokemon/sleep-105.gif' },
      adult: { animated: '/sprites/pokemon/105.gif', static: '/sprites/pokemon/105.png', icon: '/sprites/pokemon/icon-105.png', portrait: '/sprites/pokemon/portrait-105.png', sleep: '/sprites/pokemon/sleep-105.gif' },
    },
    evoLevels: { teen: 28, adult: 28 },
    trait: '粗骨回旋 · 孤勇战士',
    favoriteFood: 'sitrus_berry',
    description: '戴着骨盔怀抱思念成长的小战士，Lv.28 克服悲伤蜕变为英勇的嘎啦嘎啦！',
  },
  rhyhorn: {
    id: 'rhyhorn',
    dexNo: '#111',
    title: '独角犀牛',
    english: 'RHYHORN',
    defaultName: '独角犀牛',
    rarity: 'SR',
    element: 'normal',
    typeLabel: '地面/岩',
    typeIcon: 'meat',
    typeColor: '#8d6e63',
    stageNames: { baby: '独角犀牛', teen: '钻角犀兽', adult: '钻角犀兽' },
    stageDexNos: { baby: '#111', teen: '#112', adult: '#112' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/111.gif', static: '/sprites/pokemon/111.png', icon: '/sprites/pokemon/icon-111.png', portrait: '/sprites/pokemon/portrait-111.png', sleep: '/sprites/pokemon/sleep-111.gif' },
      teen: { animated: '/sprites/pokemon/112.gif', static: '/sprites/pokemon/112.png', icon: '/sprites/pokemon/icon-112.png', portrait: '/sprites/pokemon/portrait-112.png', sleep: '/sprites/pokemon/sleep-112.gif' },
      adult: { animated: '/sprites/pokemon/112.gif', static: '/sprites/pokemon/112.png', icon: '/sprites/pokemon/icon-112.png', portrait: '/sprites/pokemon/portrait-112.png', sleep: '/sprites/pokemon/sleep-112.gif' },
    },
    evoLevels: { teen: 36, adult: 36 },
    trait: '重装战车 · 旋转钻角',
    favoriteFood: 'rage_candy',
    description: '第一只诞生的宝可梦原型！Lv.36 进化为双足站立、一角碎钻的钻角犀兽！',
  },
  chansey: {
    id: 'chansey',
    dexNo: '#113',
    title: '吉利蛋',
    english: 'CHANSEY',
    defaultName: '吉利蛋',
    rarity: 'SR',
    element: 'fairy',
    typeLabel: '一般/治愈',
    typeIcon: 'heart',
    typeColor: '#faa2c1',
    stageNames: { baby: '吉利蛋', teen: '吉利蛋', adult: '吉利蛋' },
    stageDexNos: { baby: '#113', teen: '#113', adult: '#113' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/113.gif', static: '/sprites/pokemon/113.png', icon: '/sprites/pokemon/icon-113.png', portrait: '/sprites/pokemon/portrait-113.png', sleep: '/sprites/pokemon/sleep-113.gif' },
      teen: { animated: '/sprites/pokemon/113.gif', static: '/sprites/pokemon/113.png', icon: '/sprites/pokemon/icon-113.png', portrait: '/sprites/pokemon/portrait-113.png', sleep: '/sprites/pokemon/sleep-113.gif' },
      adult: { animated: '/sprites/pokemon/113.gif', static: '/sprites/pokemon/113.png', icon: '/sprites/pokemon/icon-113.png', portrait: '/sprites/pokemon/portrait-113.png', sleep: '/sprites/pokemon/sleep-113.gif' },
    },
    evoLevels: { teen: 24, adult: 40 },
    trait: '幸运守护 · 宝可梦中心',
    favoriteFood: 'pokepuff',
    description: '带来幸福的稀世珍兽，总会把怀里营养满分的蛋分给受伤的伙伴！',
  },
  horsea: {
    id: 'horsea',
    dexNo: '#116',
    title: '墨海马',
    english: 'HORSEA',
    defaultName: '墨海马',
    rarity: 'R',
    element: 'water',
    typeLabel: '水系',
    typeIcon: 'water',
    typeColor: '#339af0',
    stageNames: { baby: '墨海马', teen: '海刺龙', adult: '海刺龙' },
    stageDexNos: { baby: '#116', teen: '#117', adult: '#117' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/116.gif', static: '/sprites/pokemon/116.png', icon: '/sprites/pokemon/icon-116.png', portrait: '/sprites/pokemon/portrait-116.png', sleep: '/sprites/pokemon/sleep-116.gif' },
      teen: { animated: '/sprites/pokemon/117.gif', static: '/sprites/pokemon/117.png', icon: '/sprites/pokemon/icon-117.png', portrait: '/sprites/pokemon/portrait-117.png', sleep: '/sprites/pokemon/sleep-117.gif' },
      adult: { animated: '/sprites/pokemon/117.gif', static: '/sprites/pokemon/117.png', icon: '/sprites/pokemon/icon-117.png', portrait: '/sprites/pokemon/portrait-117.png', sleep: '/sprites/pokemon/sleep-117.gif' },
    },
    evoLevels: { teen: 32, adult: 32 },
    trait: '精准水箭 · 龙卷漩涡',
    favoriteFood: 'moomoo_milk',
    description: '灵巧敏捷的珊瑚海精灵，Lv.32 进化为能掀起龙卷漩涡的优雅海刺龙！',
  },
  staryu: {
    id: 'staryu',
    dexNo: '#120',
    title: '海星星',
    english: 'STARYU',
    defaultName: '海星星',
    rarity: 'SR',
    element: 'water',
    typeLabel: '水/超能',
    typeIcon: 'star',
    typeColor: '#7950f2',
    stageNames: { baby: '海星星', teen: '宝石海星', adult: '宝石海星' },
    stageDexNos: { baby: '#120', teen: '#121', adult: '#121' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/120.gif', static: '/sprites/pokemon/120.png', icon: '/sprites/pokemon/icon-120.png', portrait: '/sprites/pokemon/portrait-120.png', sleep: '/sprites/pokemon/sleep-120.gif' },
      teen: { animated: '/sprites/pokemon/121.gif', static: '/sprites/pokemon/121.png', icon: '/sprites/pokemon/icon-121.png', portrait: '/sprites/pokemon/portrait-121.png', sleep: '/sprites/pokemon/sleep-121.gif' },
      adult: { animated: '/sprites/pokemon/121.gif', static: '/sprites/pokemon/121.png', icon: '/sprites/pokemon/icon-121.png', portrait: '/sprites/pokemon/portrait-121.png', sleep: '/sprites/pokemon/sleep-121.gif' },
    },
    evoLevels: { teen: 26, adult: 26 },
    trait: '华蓝王牌 · 璀璨星核',
    favoriteFood: 'sitrus_berry',
    description: '华蓝道馆小霞的王牌搭档！Lv.26 进化为高速全能的七彩宝石海星！',
  },
  electabuzz: {
    id: 'electabuzz',
    dexNo: '#125',
    title: '电击兽',
    english: 'ELECTABUZZ',
    defaultName: '电击兽',
    rarity: 'SR',
    element: 'electric',
    typeLabel: '电系',
    typeIcon: 'bolt',
    typeColor: '#fcc419',
    stageNames: { baby: '电击兽', teen: '电击兽', adult: '电击兽' },
    stageDexNos: { baby: '#125', teen: '#125', adult: '#125' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/125.gif', static: '/sprites/pokemon/125.png', icon: '/sprites/pokemon/icon-125.png', portrait: '/sprites/pokemon/portrait-125.png', sleep: '/sprites/pokemon/sleep-125.gif' },
      teen: { animated: '/sprites/pokemon/125.gif', static: '/sprites/pokemon/125.png', icon: '/sprites/pokemon/icon-125.png', portrait: '/sprites/pokemon/portrait-125.png', sleep: '/sprites/pokemon/sleep-125.gif' },
      adult: { animated: '/sprites/pokemon/125.gif', static: '/sprites/pokemon/125.png', icon: '/sprites/pokemon/icon-125.png', portrait: '/sprites/pokemon/portrait-125.png', sleep: '/sprites/pokemon/sleep-125.gif' },
    },
    evoLevels: { teen: 28, adult: 44 },
    trait: '高压狂雷 · 发电厂霸主',
    favoriteFood: 'cheri_berry',
    description: '喜欢在雷雨夜现身于无人发电厂的强劲电系格斗好手，双臂时刻闪耀电弧！',
  },
  magmar: {
    id: 'magmar',
    dexNo: '#126',
    title: '鸭嘴火兽',
    english: 'MAGMAR',
    defaultName: '鸭嘴火兽',
    rarity: 'SR',
    element: 'fire',
    typeLabel: '火系',
    typeIcon: 'fire',
    typeColor: '#e03131',
    stageNames: { baby: '鸭嘴火兽', teen: '鸭嘴火兽', adult: '鸭嘴火兽' },
    stageDexNos: { baby: '#126', teen: '#126', adult: '#126' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/126.gif', static: '/sprites/pokemon/126.png', icon: '/sprites/pokemon/icon-126.png', portrait: '/sprites/pokemon/portrait-126.png', sleep: '/sprites/pokemon/sleep-126.gif' },
      teen: { animated: '/sprites/pokemon/126.gif', static: '/sprites/pokemon/126.png', icon: '/sprites/pokemon/icon-126.png', portrait: '/sprites/pokemon/portrait-126.png', sleep: '/sprites/pokemon/sleep-126.gif' },
      adult: { animated: '/sprites/pokemon/126.gif', static: '/sprites/pokemon/126.png', icon: '/sprites/pokemon/icon-126.png', portrait: '/sprites/pokemon/portrait-126.png', sleep: '/sprites/pokemon/sleep-126.gif' },
    },
    evoLevels: { teen: 28, adult: 44 },
    trait: '红莲熔炎 · 炽热大字爆',
    favoriteFood: 'curry',
    description: '栖息在红莲岛火山口深处的烈焰王者，体温高达 1200 度，火光如骄阳般耀眼！',
  },
  porygon: {
    id: 'porygon',
    dexNo: '#137',
    title: '多边兽',
    english: 'PORYGON',
    defaultName: '多边兽',
    rarity: 'SR',
    element: 'psychic',
    typeLabel: '数字/一般',
    typeIcon: 'sparkle',
    typeColor: '#15aabf',
    stageNames: { baby: '多边兽', teen: '多边兽', adult: '多边兽' },
    stageDexNos: { baby: '#137', teen: '#137', adult: '#137' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/137.gif', static: '/sprites/pokemon/137.png', icon: '/sprites/pokemon/icon-137.png', portrait: '/sprites/pokemon/portrait-137.png', sleep: '/sprites/pokemon/sleep-137.gif' },
      teen: { animated: '/sprites/pokemon/137.gif', static: '/sprites/pokemon/137.png', icon: '/sprites/pokemon/icon-137.png', portrait: '/sprites/pokemon/portrait-137.png', sleep: '/sprites/pokemon/sleep-137.gif' },
      adult: { animated: '/sprites/pokemon/137.gif', static: '/sprites/pokemon/137.png', icon: '/sprites/pokemon/icon-137.png', portrait: '/sprites/pokemon/portrait-137.png', sleep: '/sprites/pokemon/sleep-137.gif' },
    },
    evoLevels: { teen: 26, adult: 42 },
    trait: '西尔佛科技 · 三重光束',
    favoriteFood: 'casteliacone',
    description: '由尖端程序编织而成的首只虚拟宝可梦，能自由穿梭于电子空间与现实世界！',
  },
  aerodactyl: {
    id: 'aerodactyl',
    dexNo: '#142',
    title: '化石翼龙',
    english: 'AERODACTYL',
    defaultName: '化石翼龙',
    rarity: 'SR',
    element: 'dragon',
    typeLabel: '岩/飞行',
    typeIcon: 'sparkle',
    typeColor: '#748ffc',
    stageNames: { baby: '化石翼龙', teen: '化石翼龙', adult: '化石翼龙' },
    stageDexNos: { baby: '#142', teen: '#142', adult: '#142' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/142.gif', static: '/sprites/pokemon/142.png', icon: '/sprites/pokemon/icon-142.png', portrait: '/sprites/pokemon/portrait-142.png', sleep: '/sprites/pokemon/sleep-142.gif' },
      teen: { animated: '/sprites/pokemon/142.gif', static: '/sprites/pokemon/142.png', icon: '/sprites/pokemon/icon-142.png', portrait: '/sprites/pokemon/portrait-142.png', sleep: '/sprites/pokemon/sleep-142.gif' },
      adult: { animated: '/sprites/pokemon/142.gif', static: '/sprites/pokemon/142.png', icon: '/sprites/pokemon/icon-142.png', portrait: '/sprites/pokemon/portrait-142.png', sleep: '/sprites/pokemon/sleep-142.gif' },
    },
    evoLevels: { teen: 30, adult: 46 },
    trait: '秘密琥珀 · 太古空霸',
    favoriteFood: 'rage_candy',
    description: '从秘密琥珀中复活的太古天空霸主，以凌厉翼刃与惊人速度统治苍穹！',
  },
  articuno: {
    id: 'articuno',
    dexNo: '#144',
    title: '急冻鸟',
    english: 'ARTICUNO',
    defaultName: '急冻鸟',
    rarity: 'SSR',
    element: 'water',
    typeLabel: '冰/飞行',
    typeIcon: 'water',
    typeColor: '#3bc9db',
    stageNames: { baby: '急冻鸟', teen: '急冻鸟', adult: '急冻鸟' },
    stageDexNos: { baby: '#144', teen: '#144', adult: '#144' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/144.gif', static: '/sprites/pokemon/144.png', icon: '/sprites/pokemon/icon-144.png', portrait: '/sprites/pokemon/portrait-144.png', sleep: '/sprites/pokemon/sleep-144.gif' },
      teen: { animated: '/sprites/pokemon/144.gif', static: '/sprites/pokemon/144.png', icon: '/sprites/pokemon/icon-144.png', portrait: '/sprites/pokemon/portrait-144.png', sleep: '/sprites/pokemon/sleep-144.gif' },
      adult: { animated: '/sprites/pokemon/144.gif', static: '/sprites/pokemon/144.png', icon: '/sprites/pokemon/icon-144.png', portrait: '/sprites/pokemon/portrait-144.png', sleep: '/sprites/pokemon/sleep-144.gif' },
    },
    evoLevels: { teen: 35, adult: 52 },
    trait: '传说三圣鸟 · 极寒霜翼',
    favoriteFood: 'rare_candy',
    description: '关都传说三圣鸟之一！双子岛深处振翅而起，所经之处皆化作晶莹雪原！',
  },
  zapdos: {
    id: 'zapdos',
    dexNo: '#145',
    title: '闪电鸟',
    english: 'ZAPDOS',
    defaultName: '闪电鸟',
    rarity: 'SSR',
    element: 'electric',
    typeLabel: '电/飞行',
    typeIcon: 'bolt',
    typeColor: '#ffd43b',
    stageNames: { baby: '闪电鸟', teen: '闪电鸟', adult: '闪电鸟' },
    stageDexNos: { baby: '#145', teen: '#145', adult: '#145' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/145.gif', static: '/sprites/pokemon/145.png', icon: '/sprites/pokemon/icon-145.png', portrait: '/sprites/pokemon/portrait-145.png', sleep: '/sprites/pokemon/sleep-145.gif' },
      teen: { animated: '/sprites/pokemon/145.gif', static: '/sprites/pokemon/145.png', icon: '/sprites/pokemon/icon-145.png', portrait: '/sprites/pokemon/portrait-145.png', sleep: '/sprites/pokemon/sleep-145.gif' },
      adult: { animated: '/sprites/pokemon/145.gif', static: '/sprites/pokemon/145.png', icon: '/sprites/pokemon/icon-145.png', portrait: '/sprites/pokemon/portrait-145.png', sleep: '/sprites/pokemon/sleep-145.gif' },
    },
    evoLevels: { teen: 35, adult: 52 },
    trait: '传说三圣鸟 · 雷暴神翼',
    favoriteFood: 'rare_candy',
    description: '关都传说三圣鸟之一！栖息在无人发电厂的雷云主宰，振翅便能唤来万丈雷霆！',
  },
  moltres: {
    id: 'moltres',
    dexNo: '#146',
    title: '火焰鸟',
    english: 'MOLTRES',
    defaultName: '火焰鸟',
    rarity: 'SSR',
    element: 'fire',
    typeLabel: '火/飞行',
    typeIcon: 'fire',
    typeColor: '#ff5924',
    stageNames: { baby: '火焰鸟', teen: '火焰鸟', adult: '火焰鸟' },
    stageDexNos: { baby: '#146', teen: '#146', adult: '#146' },
    stageSprites: {
      baby: { animated: '/sprites/pokemon/146.gif', static: '/sprites/pokemon/146.png', icon: '/sprites/pokemon/icon-146.png', portrait: '/sprites/pokemon/portrait-146.png', sleep: '/sprites/pokemon/sleep-146.gif' },
      teen: { animated: '/sprites/pokemon/146.gif', static: '/sprites/pokemon/146.png', icon: '/sprites/pokemon/icon-146.png', portrait: '/sprites/pokemon/portrait-146.png', sleep: '/sprites/pokemon/sleep-146.gif' },
      adult: { animated: '/sprites/pokemon/146.gif', static: '/sprites/pokemon/146.png', icon: '/sprites/pokemon/icon-146.png', portrait: '/sprites/pokemon/portrait-146.png', sleep: '/sprites/pokemon/sleep-146.gif' },
    },
    evoLevels: { teen: 35, adult: 52 },
    trait: '传说三圣鸟 · 不死烈焰',
    favoriteFood: 'rare_candy',
    description: '关都传说三圣鸟之一！传说它降临之地春光早至，赤焰羽翼如破晓骄阳般璀璨！',
  },
};

export const POKEDEX_ORDER: SpeciesId[] = [
  'bulbasaur',
  'charmander',
  'squirtle',
  'caterpie',
  'weedle',
  'pidgey',
  'pikachu',
  'sandshrew',
  'nidoran',
  'clefairy',
  'vulpix',
  'jigglypuff',
  'oddish',
  'diglett',
  'meowth',
  'psyduck',
  'growlithe',
  'poliwag',
  'abra',
  'machop',
  'geodude',
  'ponyta',
  'slowpoke',
  'magnemite',
  'shellder',
  'gastly',
  'onix',
  'cubone',
  'rhyhorn',
  'chansey',
  'horsea',
  'staryu',
  'scyther',
  'electabuzz',
  'magmar',
  'magikarp',
  'lapras',
  'eevee',
  'porygon',
  'aerodactyl',
  'munchlax',
  'articuno',
  'zapdos',
  'moltres',
  'dratini',
  'mewtwo',
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
    description: '高性价比关都日常盲盒，覆盖全部基础人气家族，十连9折保底 SR+！',
    pool: [
      { species: 'bulbasaur', weight: 10 },
      { species: 'charmander', weight: 10 },
      { species: 'squirtle', weight: 10 },
      { species: 'caterpie', weight: 10 },
      { species: 'weedle', weight: 10 },
      { species: 'pidgey', weight: 10 },
      { species: 'sandshrew', weight: 10 },
      { species: 'clefairy', weight: 10 },
      { species: 'vulpix', weight: 10 },
      { species: 'oddish', weight: 10 },
      { species: 'diglett', weight: 10 },
      { species: 'poliwag', weight: 10 },
      { species: 'machop', weight: 10 },
      { species: 'geodude', weight: 10 },
      { species: 'ponyta', weight: 10 },
      { species: 'slowpoke', weight: 10 },
      { species: 'magnemite', weight: 10 },
      { species: 'shellder', weight: 10 },
      { species: 'horsea', weight: 10 },
      { species: 'eevee', weight: 10 },
      { species: 'jigglypuff', weight: 9 },
      { species: 'meowth', weight: 9 },
      { species: 'psyduck', weight: 9 },
      { species: 'pikachu', weight: 5 },
      { species: 'nidoran', weight: 5 },
      { species: 'magikarp', weight: 5 },
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
    description: '大幅提升全部道馆王牌 SR（大岩蛇/宝石海星/化石翼龙/尼多王/电击兽/鸭嘴火兽等）概率！',
    pool: [
      { species: 'pikachu', weight: 10 },
      { species: 'nidoran', weight: 11 },
      { species: 'growlithe', weight: 11 },
      { species: 'abra', weight: 11 },
      { species: 'gastly', weight: 11 },
      { species: 'onix', weight: 11 },
      { species: 'cubone', weight: 10 },
      { species: 'rhyhorn', weight: 11 },
      { species: 'chansey', weight: 10 },
      { species: 'staryu', weight: 11 },
      { species: 'scyther', weight: 11 },
      { species: 'electabuzz', weight: 11 },
      { species: 'magmar', weight: 11 },
      { species: 'magikarp', weight: 11 },
      { species: 'lapras', weight: 11 },
      { species: 'porygon', weight: 10 },
      { species: 'aerodactyl', weight: 11 },
      { species: 'munchlax', weight: 10 },
      { species: 'dratini', weight: 5 },
      { species: 'articuno', weight: 3 },
      { species: 'zapdos', weight: 3 },
      { species: 'moltres', weight: 3 },
      { species: 'mewtwo', weight: 2 },
      { species: 'mew', weight: 2 },
    ],
  },
  {
    id: 'master_box',
    name: '传说大师盲盒',
    price: 240,
    tenPrice: 2160,
    ballSprite: '/sprites/items/master-ball.png',
    badge: 'SSR UP!',
    description: '高概率开出传说三圣鸟（急冻鸟/闪电鸟/火焰鸟）、超梦、梦幻与准神迷你龙！',
    pool: [
      { species: 'articuno', weight: 18 },
      { species: 'zapdos', weight: 18 },
      { species: 'moltres', weight: 18 },
      { species: 'mewtwo', weight: 18 },
      { species: 'mew', weight: 18 },
      { species: 'dratini', weight: 20 },
      { species: 'aerodactyl', weight: 12 },
      { species: 'lapras', weight: 11 },
      { species: 'scyther', weight: 10 },
      { species: 'electabuzz', weight: 10 },
      { species: 'magmar', weight: 10 },
      { species: 'porygon', weight: 10 },
      { species: 'staryu', weight: 10 },
      { species: 'onix', weight: 9 },
      { species: 'nidoran', weight: 9 },
      { species: 'abra', weight: 9 },
      { species: 'growlithe', weight: 9 },
      { species: 'magikarp', weight: 9 },
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
