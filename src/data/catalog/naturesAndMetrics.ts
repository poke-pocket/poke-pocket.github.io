import type {
  GrowthStage,
  IvRank,
  NatureId,
  PetIVs,
  SpeciesId,
  TalentId,
} from '../../types/pet';

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
  rattata: ['小拉达', '拉达', '小拉宝', '小拉君', '小拉酱', '小拉侠', '小拉丸', '小拉仔', '小拉客', '小拉王', '小达', '元气达', '闪亮达', '疾风达'],
  spearow: ['烈雀', '大嘴雀', '烈雀宝', '烈雀君', '烈雀酱', '烈雀侠', '烈雀丸', '烈雀仔', '烈雀客', '烈雀王', '小雀', '元气雀', '闪亮雀', '疾风雀'],
  ekans: ['阿柏蛇', '阿柏怪', '阿柏宝', '阿柏君', '阿柏酱', '阿柏侠', '阿柏丸', '阿柏仔', '阿柏客', '阿柏王', '小蛇', '元气蛇', '闪亮蛇', '疾风蛇'],
  nidoranf: ['尼多兰', '尼多后', '尼多宝', '尼多君', '尼多酱', '尼多侠', '尼多丸', '尼多仔', '尼多客', '尼多王', '小兰', '元气兰', '闪亮兰', '疾风兰'],
  zubat: ['超音蝠', '大嘴蝠', '超音宝', '超音君', '超音酱', '超音侠', '超音丸', '超音仔', '超音客', '超音王', '小蝠', '元气蝠', '闪亮蝠', '疾风蝠'],
  paras: ['派拉斯', '派拉斯特', '派拉宝', '派拉君', '派拉酱', '派拉侠', '派拉丸', '派拉仔', '派拉客', '派拉王', '小斯', '元气斯', '闪亮斯', '疾风斯'],
  venonat: ['毛球', '摩鲁蛾', '毛球宝', '毛球君', '毛球酱', '毛球侠', '毛球丸', '毛球仔', '毛球客', '毛球王', '小球', '元气球', '闪亮球', '疾风球'],
  mankey: ['猴怪', '火爆猴', '猴怪宝', '猴怪君', '猴怪酱', '猴怪侠', '猴怪丸', '猴怪仔', '猴怪客', '猴怪王', '小怪', '元气怪', '闪亮怪', '疾风怪'],
  bellsprout: ['喇叭芽', '大食花', '喇叭宝', '喇叭君', '喇叭酱', '喇叭侠', '喇叭丸', '喇叭仔', '喇叭客', '喇叭王', '小芽', '元气芽', '闪亮芽', '疾风芽'],
  tentacool: ['玛瑙水母', '毒刺水母', '玛瑙宝', '玛瑙君', '玛瑙酱', '玛瑙侠', '玛瑙丸', '玛瑙仔', '玛瑙客', '玛瑙王', '小母', '元气母', '闪亮母', '疾风母'],
  farfetchd: ['大葱鸭', '大葱宝', '大葱君', '大葱酱', '大葱侠', '大葱丸', '大葱仔', '大葱客', '大葱王', '小鸭', '元气鸭', '闪亮鸭', '疾风鸭', '幸运鸭'],
  doduo: ['嘟嘟', '嘟嘟利', '嘟嘟宝', '嘟嘟君', '嘟嘟酱', '嘟嘟侠', '嘟嘟丸', '嘟嘟仔', '嘟嘟客', '嘟嘟王', '小嘟', '元气嘟', '闪亮嘟', '疾风嘟'],
  seel: ['小海狮', '白海狮', '小海宝', '小海君', '小海酱', '小海侠', '小海丸', '小海仔', '小海客', '小海王', '小狮', '元气狮', '闪亮狮', '疾风狮'],
  grimer: ['臭泥', '臭臭泥', '臭泥宝', '臭泥君', '臭泥酱', '臭泥侠', '臭泥丸', '臭泥仔', '臭泥客', '臭泥王', '小泥', '元气泥', '闪亮泥', '疾风泥'],
  drowzee: ['催眠貘', '引梦貘人', '催眠宝', '催眠君', '催眠酱', '催眠侠', '催眠丸', '催眠仔', '催眠客', '催眠王', '小貘', '元气貘', '闪亮貘', '疾风貘'],
  krabby: ['大钳蟹', '巨钳蟹', '大钳宝', '大钳君', '大钳酱', '大钳侠', '大钳丸', '大钳仔', '大钳客', '大钳王', '小蟹', '元气蟹', '闪亮蟹', '疾风蟹'],
  voltorb: ['霹雳电球', '顽皮雷弹', '霹雳宝', '霹雳君', '霹雳酱', '霹雳侠', '霹雳丸', '霹雳仔', '霹雳客', '霹雳王', '小球', '元气球', '闪亮球', '疾风球'],
  exeggcute: ['蛋蛋', '椰蛋树', '蛋蛋宝', '蛋蛋君', '蛋蛋酱', '蛋蛋侠', '蛋蛋丸', '蛋蛋仔', '蛋蛋客', '蛋蛋王', '小蛋', '元气蛋', '闪亮蛋', '疾风蛋'],
  hitmonlee: ['飞腿郎', '飞腿宝', '飞腿君', '飞腿酱', '飞腿侠', '飞腿丸', '飞腿仔', '飞腿客', '飞腿王', '小郎', '元气郎', '闪亮郎', '疾风郎', '幸运郎'],
  hitmonchan: ['快拳郎', '快拳宝', '快拳君', '快拳酱', '快拳侠', '快拳丸', '快拳仔', '快拳客', '快拳王', '小郎', '元气郎', '闪亮郎', '疾风郎', '幸运郎'],
  lickitung: ['大舌头', '大舌宝', '大舌君', '大舌酱', '大舌侠', '大舌丸', '大舌仔', '大舌客', '大舌王', '小头', '元气头', '闪亮头', '疾风头', '幸运头'],
  koffing: ['瓦斯弹', '双弹瓦斯', '瓦斯宝', '瓦斯君', '瓦斯酱', '瓦斯侠', '瓦斯丸', '瓦斯仔', '瓦斯客', '瓦斯王', '小弹', '元气弹', '闪亮弹', '疾风弹'],
  tangela: ['蔓藤怪', '蔓藤宝', '蔓藤君', '蔓藤酱', '蔓藤侠', '蔓藤丸', '蔓藤仔', '蔓藤客', '蔓藤王', '小怪', '元气怪', '闪亮怪', '疾风怪', '幸运怪'],
  kangaskhan: ['袋兽', '袋兽宝', '袋兽君', '袋兽酱', '袋兽侠', '袋兽丸', '袋兽仔', '袋兽客', '袋兽王', '小兽', '元气兽', '闪亮兽', '疾风兽', '幸运兽'],
  goldeen: ['角金鱼', '金鱼王', '角金宝', '角金君', '角金酱', '角金侠', '角金丸', '角金仔', '角金客', '角金王', '小鱼', '元气鱼', '闪亮鱼', '疾风鱼'],
  mrmime: ['魔墙人偶', '魔墙宝', '魔墙君', '魔墙酱', '魔墙侠', '魔墙丸', '魔墙仔', '魔墙客', '魔墙王', '小偶', '元气偶', '闪亮偶', '疾风偶', '幸运偶'],
  jynx: ['迷唇姐', '迷唇宝', '迷唇君', '迷唇酱', '迷唇侠', '迷唇丸', '迷唇仔', '迷唇客', '迷唇王', '小姐', '元气姐', '闪亮姐', '疾风姐', '幸运姐'],
  pinsir: ['凯罗斯', '凯罗宝', '凯罗君', '凯罗酱', '凯罗侠', '凯罗丸', '凯罗仔', '凯罗客', '凯罗王', '小斯', '元气斯', '闪亮斯', '疾风斯', '幸运斯'],
  tauros: ['肯泰罗', '肯泰宝', '肯泰君', '肯泰酱', '肯泰侠', '肯泰丸', '肯泰仔', '肯泰客', '肯泰王', '小罗', '元气罗', '闪亮罗', '疾风罗', '幸运罗'],
  ditto: ['百变怪', '百变宝', '百变君', '百变酱', '百变侠', '百变丸', '百变仔', '百变客', '百变王', '小怪', '元气怪', '闪亮怪', '疾风怪', '幸运怪'],
  vaporeon: ['水伊布', '水伊宝', '水伊君', '水伊酱', '水伊侠', '水伊丸', '水伊仔', '水伊客', '水伊王', '小布', '元气布', '闪亮布', '疾风布', '幸运布'],
  jolteon: ['雷伊布', '雷伊宝', '雷伊君', '雷伊酱', '雷伊侠', '雷伊丸', '雷伊仔', '雷伊客', '雷伊王', '小布', '元气布', '闪亮布', '疾风布', '幸运布'],
  flareon: ['火伊布', '火伊宝', '火伊君', '火伊酱', '火伊侠', '火伊丸', '火伊仔', '火伊客', '火伊王', '小布', '元气布', '闪亮布', '疾风布', '幸运布'],
  omanyte: ['菊石兽', '多刺菊石兽', '菊石宝', '菊石君', '菊石酱', '菊石侠', '菊石丸', '菊石仔', '菊石客', '菊石王', '小兽', '元气兽', '闪亮兽', '疾风兽'],
  kabuto: ['化石盔', '镰刀盔', '化石宝', '化石君', '化石酱', '化石侠', '化石丸', '化石仔', '化石客', '化石王', '小盔', '元气盔', '闪亮盔', '疾风盔'],
  hooh: ['凤王', '七彩凤凰', '火凤', '朱雀', '虹翼', '赤霄', '丹凤', '祥瑞'],
  spinda: ['晃晃斑', '晕晕熊', '小酒窝', '团子斑', '转圈宝', '摇摇乐', '花斑熊'],
  chimchar: ['小火焰猴', '大圣', '悟空', '烈焰猴', '火眼金睛', '筋斗云', '齐天宝', '金箍猴'],
  bronzor: ['铜镜怪', '青铜钟', '古镜', '编钟宝', '铭文钟', '青铜君', '古韵'],
  tepig: ['暖暖猪', '炎武王', '红烧猪', '小火猪', '玄德宝', '翼德', '战甲猪', '暖炉猪'],
  mienfoo: ['功夫鼬', '师父鼬', '水袖侠', '白眉鼬', '咏春宝', '宗师鼬', '青衫客'],
  pancham: ['顽皮熊猫', '霸道熊猫', '滚滚', '竹叶侠', '阿宝', '胖达', '功夫熊', '花花'],
  drampa: ['老翁龙', '祥云龙', '白须公', '青龙老祖', '云游龙', '慈祥龙', '东方龙'],
  kubfu: ['熊徒弟', '武道熊师', '小师弟', '拳宗', '一击流', '连击流', '双塔侠', '少林熊'],
  wochien: ['古简蜗', '竹简灵', '墨卷', '史书蜗', '青简', '古墨'],
  chienpao: ['古剑豹', '青霜剑', '雪刃豹', '寒锋', '断剑灵', '冰魄豹'],
  tinglu: ['古鼎鹿', '青铜鼎', '镇岳鹿', '九鼎灵', '山河鼎', '玄鼎'],
  chiyu: ['古玉鱼', '赤玉锦鲤', '火玉鱼', '勾玉灵', '焚玉鲤', '朱玉'],
};

export function pickRandomPetName(species: SpeciesId, exclude: string[] = []): string {
  const pool = SPECIES_RANDOM_NAMES[species] ?? ['宝可梦'];
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
  rattata: {
    baby: { heightM: 0.3, weightKg: 3.5 },
    teen: { heightM: 0.7, weightKg: 18.5 },
    adult: { heightM: 0.7, weightKg: 18.5 },
  },
  spearow: {
    baby: { heightM: 0.3, weightKg: 2 },
    teen: { heightM: 1.2, weightKg: 38 },
    adult: { heightM: 1.2, weightKg: 38 },
  },
  ekans: {
    baby: { heightM: 2, weightKg: 6.9 },
    teen: { heightM: 3.5, weightKg: 65 },
    adult: { heightM: 3.5, weightKg: 65 },
  },
  nidoranf: {
    baby: { heightM: 0.4, weightKg: 7 },
    teen: { heightM: 0.8, weightKg: 20 },
    adult: { heightM: 1.3, weightKg: 60 },
  },
  zubat: {
    baby: { heightM: 0.8, weightKg: 7.5 },
    teen: { heightM: 1.6, weightKg: 55 },
    adult: { heightM: 1.6, weightKg: 55 },
  },
  paras: {
    baby: { heightM: 0.3, weightKg: 5.4 },
    teen: { heightM: 1, weightKg: 29.5 },
    adult: { heightM: 1, weightKg: 29.5 },
  },
  venonat: {
    baby: { heightM: 1, weightKg: 30 },
    teen: { heightM: 1.5, weightKg: 12.5 },
    adult: { heightM: 1.5, weightKg: 12.5 },
  },
  mankey: {
    baby: { heightM: 0.5, weightKg: 28 },
    teen: { heightM: 1, weightKg: 32 },
    adult: { heightM: 1, weightKg: 32 },
  },
  bellsprout: {
    baby: { heightM: 0.7, weightKg: 4 },
    teen: { heightM: 1, weightKg: 6.4 },
    adult: { heightM: 1.7, weightKg: 15.5 },
  },
  tentacool: {
    baby: { heightM: 0.9, weightKg: 45.5 },
    teen: { heightM: 1.6, weightKg: 55 },
    adult: { heightM: 1.6, weightKg: 55 },
  },
  farfetchd: {
    baby: { heightM: 0.8, weightKg: 15 },
    teen: { heightM: 0.8, weightKg: 15 },
    adult: { heightM: 0.8, weightKg: 15 },
  },
  doduo: {
    baby: { heightM: 1.4, weightKg: 39.2 },
    teen: { heightM: 1.8, weightKg: 85.2 },
    adult: { heightM: 1.8, weightKg: 85.2 },
  },
  seel: {
    baby: { heightM: 1.1, weightKg: 90 },
    teen: { heightM: 1.7, weightKg: 120 },
    adult: { heightM: 1.7, weightKg: 120 },
  },
  grimer: {
    baby: { heightM: 0.9, weightKg: 30 },
    teen: { heightM: 1.2, weightKg: 30 },
    adult: { heightM: 1.2, weightKg: 30 },
  },
  drowzee: {
    baby: { heightM: 1, weightKg: 32.4 },
    teen: { heightM: 1.6, weightKg: 75.6 },
    adult: { heightM: 1.6, weightKg: 75.6 },
  },
  krabby: {
    baby: { heightM: 0.4, weightKg: 6.5 },
    teen: { heightM: 1.3, weightKg: 60 },
    adult: { heightM: 1.3, weightKg: 60 },
  },
  voltorb: {
    baby: { heightM: 0.5, weightKg: 10.4 },
    teen: { heightM: 1.2, weightKg: 66.6 },
    adult: { heightM: 1.2, weightKg: 66.6 },
  },
  exeggcute: {
    baby: { heightM: 0.4, weightKg: 2.5 },
    teen: { heightM: 2, weightKg: 120 },
    adult: { heightM: 2, weightKg: 120 },
  },
  hitmonlee: {
    baby: { heightM: 1.5, weightKg: 49.8 },
    teen: { heightM: 1.5, weightKg: 49.8 },
    adult: { heightM: 1.5, weightKg: 49.8 },
  },
  hitmonchan: {
    baby: { heightM: 1.4, weightKg: 50.2 },
    teen: { heightM: 1.4, weightKg: 50.2 },
    adult: { heightM: 1.4, weightKg: 50.2 },
  },
  lickitung: {
    baby: { heightM: 1.2, weightKg: 65.5 },
    teen: { heightM: 1.2, weightKg: 65.5 },
    adult: { heightM: 1.2, weightKg: 65.5 },
  },
  koffing: {
    baby: { heightM: 0.6, weightKg: 1 },
    teen: { heightM: 1.2, weightKg: 9.5 },
    adult: { heightM: 1.2, weightKg: 9.5 },
  },
  tangela: {
    baby: { heightM: 1, weightKg: 35 },
    teen: { heightM: 1, weightKg: 35 },
    adult: { heightM: 1, weightKg: 35 },
  },
  kangaskhan: {
    baby: { heightM: 2.2, weightKg: 80 },
    teen: { heightM: 2.2, weightKg: 80 },
    adult: { heightM: 2.2, weightKg: 80 },
  },
  goldeen: {
    baby: { heightM: 0.6, weightKg: 15 },
    teen: { heightM: 1.3, weightKg: 39 },
    adult: { heightM: 1.3, weightKg: 39 },
  },
  mrmime: {
    baby: { heightM: 1.3, weightKg: 54.5 },
    teen: { heightM: 1.3, weightKg: 54.5 },
    adult: { heightM: 1.3, weightKg: 54.5 },
  },
  jynx: {
    baby: { heightM: 1.4, weightKg: 40.6 },
    teen: { heightM: 1.4, weightKg: 40.6 },
    adult: { heightM: 1.4, weightKg: 40.6 },
  },
  pinsir: {
    baby: { heightM: 1.5, weightKg: 55 },
    teen: { heightM: 1.5, weightKg: 55 },
    adult: { heightM: 1.5, weightKg: 55 },
  },
  tauros: {
    baby: { heightM: 1.4, weightKg: 88.4 },
    teen: { heightM: 1.4, weightKg: 88.4 },
    adult: { heightM: 1.4, weightKg: 88.4 },
  },
  ditto: {
    baby: { heightM: 0.3, weightKg: 4 },
    teen: { heightM: 0.3, weightKg: 4 },
    adult: { heightM: 0.3, weightKg: 4 },
  },
  vaporeon: {
    baby: { heightM: 1, weightKg: 29 },
    teen: { heightM: 1, weightKg: 29 },
    adult: { heightM: 1, weightKg: 29 },
  },
  jolteon: {
    baby: { heightM: 0.8, weightKg: 24.5 },
    teen: { heightM: 0.8, weightKg: 24.5 },
    adult: { heightM: 0.8, weightKg: 24.5 },
  },
  flareon: {
    baby: { heightM: 0.9, weightKg: 25 },
    teen: { heightM: 0.9, weightKg: 25 },
    adult: { heightM: 0.9, weightKg: 25 },
  },
  omanyte: {
    baby: { heightM: 0.4, weightKg: 7.5 },
    teen: { heightM: 1, weightKg: 35 },
    adult: { heightM: 1, weightKg: 35 },
  },
  kabuto: {
    baby: { heightM: 0.5, weightKg: 11.5 },
    teen: { heightM: 1.3, weightKg: 40.5 },
    adult: { heightM: 1.3, weightKg: 40.5 },
  },
  hooh: {
    baby: { heightM: 3.8, weightKg: 199.0 },
    teen: { heightM: 3.8, weightKg: 199.0 },
    adult: { heightM: 3.8, weightKg: 199.0 },
  },
  spinda: {
    baby: { heightM: 1.1, weightKg: 5.0 },
    teen: { heightM: 1.1, weightKg: 5.0 },
    adult: { heightM: 1.1, weightKg: 5.0 },
  },
  chimchar: {
    baby: { heightM: 0.5, weightKg: 6.2 },
    teen: { heightM: 0.9, weightKg: 22.0 },
    adult: { heightM: 1.2, weightKg: 55.0 },
  },
  bronzor: {
    baby: { heightM: 0.5, weightKg: 60.5 },
    teen: { heightM: 1.3, weightKg: 187.0 },
    adult: { heightM: 1.3, weightKg: 187.0 },
  },
  tepig: {
    baby: { heightM: 0.5, weightKg: 9.9 },
    teen: { heightM: 1.0, weightKg: 55.5 },
    adult: { heightM: 1.6, weightKg: 150.0 },
  },
  mienfoo: {
    baby: { heightM: 0.9, weightKg: 20.0 },
    teen: { heightM: 1.4, weightKg: 35.5 },
    adult: { heightM: 1.4, weightKg: 35.5 },
  },
  pancham: {
    baby: { heightM: 0.6, weightKg: 8.0 },
    teen: { heightM: 2.1, weightKg: 136.0 },
    adult: { heightM: 2.1, weightKg: 136.0 },
  },
  drampa: {
    baby: { heightM: 3.0, weightKg: 185.0 },
    teen: { heightM: 3.0, weightKg: 185.0 },
    adult: { heightM: 3.0, weightKg: 185.0 },
  },
  kubfu: {
    baby: { heightM: 0.6, weightKg: 12.0 },
    teen: { heightM: 1.9, weightKg: 105.0 },
    adult: { heightM: 1.9, weightKg: 105.0 },
  },
  wochien: {
    baby: { heightM: 1.5, weightKg: 74.2 },
    teen: { heightM: 1.5, weightKg: 74.2 },
    adult: { heightM: 1.5, weightKg: 74.2 },
  },
  chienpao: {
    baby: { heightM: 1.9, weightKg: 152.2 },
    teen: { heightM: 1.9, weightKg: 152.2 },
    adult: { heightM: 1.9, weightKg: 152.2 },
  },
  tinglu: {
    baby: { heightM: 2.7, weightKg: 699.7 },
    teen: { heightM: 2.7, weightKg: 699.7 },
    adult: { heightM: 2.7, weightKg: 699.7 },
  },
  chiyu: {
    baby: { heightM: 0.4, weightKg: 4.9 },
    teen: { heightM: 0.4, weightKg: 4.9 },
    adult: { heightM: 0.4, weightKg: 4.9 },
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

