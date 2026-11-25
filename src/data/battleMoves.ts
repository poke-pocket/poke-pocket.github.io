import type { PetRecord, PokemonElement, SpeciesId } from '../types/pet';
import { SPECIES_CATALOG, getGrowthStage } from './catalog';
import { getPetIVs, getPetNature, getPetTalent } from '../utils/petEngine';

export interface BattleMove {
  id: string;
  name: string;
  element: PokemonElement;
  power: number; // 0 for status/heal moves
  maxPp: number;
  kind: 'damage' | 'buff_atk' | 'buff_def' | 'heal';
  bonusCoins?: boolean;
  description: string;
}

export interface BattleStats {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface WildEnemy {
  species: SpeciesId;
  level: number;
  isTrainer: boolean;
  trainerTitle?: string;
  trainerSprite?: string;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  moves: BattleMove[];
}

export const ELEMENT_COLORS: Record<PokemonElement, string> = {
  electric: '#f5b700',
  fire: '#ff5924',
  grass: '#40c057',
  water: '#339af0',
  normal: '#8d8b7e',
  fairy: '#f06595',
  ghost: '#7950f2',
  dragon: '#5c7cfa',
  psychic: '#e64980',
};

export const ELEMENT_LABELS: Record<PokemonElement, string> = {
  electric: '电',
  fire: '火',
  grass: '草',
  water: '水',
  normal: '一般',
  fairy: '妖精',
  ghost: '幽灵',
  dragon: '龙',
  psychic: '超能',
};

const SUPER_EFFECTIVE: Partial<Record<PokemonElement, PokemonElement[]>> = {
  fire: ['grass'],
  water: ['fire'],
  grass: ['water'],
  electric: ['water'],
  ghost: ['psychic', 'ghost'],
  dragon: ['dragon'],
  fairy: ['dragon'],
};

const NOT_VERY_EFFECTIVE: Partial<Record<PokemonElement, PokemonElement[]>> = {
  fire: ['water', 'fire', 'dragon'],
  water: ['grass', 'water', 'dragon'],
  grass: ['fire', 'grass', 'dragon'],
  electric: ['grass', 'electric', 'dragon'],
  normal: ['ghost'],
  psychic: ['psychic'],
  fairy: ['fire'],
};

export function getTypeMultiplier(
  moveElement: PokemonElement,
  defenderElement: PokemonElement,
): number {
  if (SUPER_EFFECTIVE[moveElement]?.includes(defenderElement)) return 1.5;
  if (NOT_VERY_EFFECTIVE[moveElement]?.includes(defenderElement)) return 0.7;
  return 1.0;
}

const SPECIES_MOVES: Record<SpeciesId, BattleMove[]> = {
  pikachu: [
    { id: 'tbolt', name: '十万伏特', element: 'electric', power: 62, maxPp: 10, kind: 'damage', description: '释放强力电流攻击对手' },
    { id: 'quick_atk', name: '电光一闪', element: 'normal', power: 40, maxPp: 20, kind: 'damage', description: '高速冲撞造成稳定伤害' },
    { id: 'charge', name: '充电蓄势', element: 'electric', power: 0, maxPp: 8, kind: 'buff_atk', description: '蓄积电能，大幅提升攻击' },
    { id: 'volt_tackle', name: '伏特攻击', element: 'electric', power: 84, maxPp: 4, kind: 'damage', description: '全身缠绕雷电的必杀一击' },
  ],
  charmander: [
    { id: 'flamethrower', name: '喷射火焰', element: 'fire', power: 62, maxPp: 10, kind: 'damage', description: '吐出炙热火焰灼烧对手' },
    { id: 'scratch', name: '抓击', element: 'normal', power: 40, maxPp: 20, kind: 'damage', description: '利爪快速挥击对手' },
    { id: 'dragon_dance', name: '热血咆哮', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '燃起斗志，提升攻击力' },
    { id: 'fire_blast', name: '大字爆炎', element: 'fire', power: 84, maxPp: 4, kind: 'damage', description: '释放大字形烈焰轰击' },
  ],
  bulbasaur: [
    { id: 'razor_leaf', name: '飞叶快刀', element: 'grass', power: 60, maxPp: 10, kind: 'damage', description: '甩出锋利叶片斩击对手' },
    { id: 'vine_whip', name: '藤鞭', element: 'normal', power: 40, maxPp: 20, kind: 'damage', description: '柔软藤蔓抽打对手' },
    { id: 'synthesis', name: '光合作用', element: 'grass', power: 0, maxPp: 5, kind: 'heal', description: '沐浴阳光回复自身 HP' },
    { id: 'solar_beam', name: '日光束', element: 'grass', power: 84, maxPp: 4, kind: 'damage', description: '汇聚日光发射草系终极技' },
  ],
  squirtle: [
    { id: 'water_pulse', name: '水之波动', element: 'water', power: 60, maxPp: 10, kind: 'damage', description: '发射震荡水环冲击对手' },
    { id: 'tackle', name: '撞击', element: 'normal', power: 40, maxPp: 20, kind: 'damage', description: '勇往直前撞向对手' },
    { id: 'withdraw', name: '缩入壳中', element: 'water', power: 0, maxPp: 8, kind: 'buff_def', description: '坚固甲壳大幅提升防御' },
    { id: 'hydro_pump', name: '水炮', element: 'water', power: 84, maxPp: 4, kind: 'damage', description: '喷射高压激流重创对手' },
  ],
  jigglypuff: [
    { id: 'disarm_voice', name: '魅惑之声', element: 'fairy', power: 58, maxPp: 10, kind: 'damage', description: '清甜歌声穿透防线' },
    { id: 'pound', name: '拍击', element: 'normal', power: 40, maxPp: 20, kind: 'damage', description: '软绵小手连续拍打' },
    { id: 'rest_song', name: '治愈摇篮', element: 'fairy', power: 0, maxPp: 5, kind: 'heal', description: '哼唱治愈旋律回复 HP' },
    { id: 'moonblast', name: '月亮之力', element: 'fairy', power: 82, maxPp: 4, kind: 'damage', description: '借用月光能量强力轰击' },
  ],
  meowth: [
    { id: 'pay_day', name: '聚宝功', element: 'normal', power: 56, maxPp: 12, kind: 'damage', bonusCoins: true, description: '投掷金币攻击，战后额外得金币！' },
    { id: 'fury_swipes', name: '乱抓', element: 'normal', power: 44, maxPp: 20, kind: 'damage', description: '敏捷猫爪快速连击' },
    { id: 'hone_claws', name: '磨爪', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '磨利爪子提升攻击力' },
    { id: 'slash', name: '劈开', element: 'normal', power: 78, maxPp: 5, kind: 'damage', description: '锐利一斩造成高额伤害' },
  ],
  psyduck: [
    { id: 'water_gun', name: '水枪连射', element: 'water', power: 58, maxPp: 12, kind: 'damage', description: '精准发射强力水流' },
    { id: 'confusion', name: '念力冲击', element: 'psychic', power: 52, maxPp: 15, kind: 'damage', description: '爆发隐藏超能力震慑对手' },
    { id: 'calm_head', name: '冥想蓄能', element: 'psychic', power: 0, maxPp: 6, kind: 'buff_atk', description: '缓解头疼，激发出惊人力量' },
    { id: 'zen_wave', name: '冲浪念波', element: 'water', power: 82, maxPp: 4, kind: 'damage', description: '念力卷起巨浪拍击对手' },
  ],
  gastly: [
    { id: 'shadow_ball', name: '暗影球', element: 'ghost', power: 64, maxPp: 10, kind: 'damage', description: '凝聚暗影能量砸向对手' },
    { id: 'lick', name: '舌舔', element: 'ghost', power: 42, maxPp: 20, kind: 'damage', description: '调皮突袭造成幽灵伤害' },
    { id: 'curse_guard', name: '暗影护幕', element: 'ghost', power: 0, maxPp: 8, kind: 'buff_def', description: '隐入暗影大幅提升防御' },
    { id: 'nightmare', name: '暗夜漩涡', element: 'ghost', power: 86, maxPp: 4, kind: 'damage', description: '释放幽冥飓风席卷全场' },
  ],
  eevee: [
    { id: 'swift', name: '高速星星', element: 'normal', power: 58, maxPp: 12, kind: 'damage', description: '发射闪耀星芒必中攻击' },
    { id: 'bite', name: '咬住', element: 'normal', power: 44, maxPp: 18, kind: 'damage', description: '敏捷扑咬对手' },
    { id: 'wish_heal', name: '祈愿星光', element: 'fairy', power: 0, maxPp: 5, kind: 'heal', description: '许下心愿回复自身 HP' },
    { id: 'last_resort', name: '珍藏一击', element: 'normal', power: 82, maxPp: 4, kind: 'damage', description: '全力以赴的终极突击' },
  ],
  munchlax: [
    { id: 'body_slam', name: '泰山压顶', element: 'normal', power: 64, maxPp: 10, kind: 'damage', description: '用沉甸甸的身躯震撼对手' },
    { id: 'tackle_belly', name: '肚皮冲撞', element: 'normal', power: 44, maxPp: 18, kind: 'damage', description: '弹力十足的正面冲撞' },
    { id: 'snack_heal', name: '偷吃零食', element: 'normal', power: 0, maxPp: 5, kind: 'heal', description: '掏出珍藏零食回复 HP' },
    { id: 'giga_impact', name: '终极冲击', element: 'normal', power: 88, maxPp: 4, kind: 'damage', description: '势不可挡的全力飞扑' },
  ],
  dratini: [
    { id: 'dragon_pulse', name: '龙之波动', element: 'dragon', power: 66, maxPp: 10, kind: 'damage', description: '释放璀璨龙系冲击波' },
    { id: 'aqua_tail', name: '水流尾', element: 'water', power: 52, maxPp: 15, kind: 'damage', description: '甩动波涛般的长尾横扫' },
    { id: 'dragon_focus', name: '龙之舞', element: 'dragon', power: 0, maxPp: 8, kind: 'buff_atk', description: '神秘古龙之舞大幅提攻' },
    { id: 'draco_meteor', name: '流星群', element: 'dragon', power: 92, maxPp: 4, kind: 'damage', description: '召唤星辰陨落重创对手' },
  ],
  mew: [
    { id: 'psychic', name: '精神强念', element: 'psychic', power: 68, maxPp: 10, kind: 'damage', description: '纯净幻兽念波震撼全场' },
    { id: 'aura_sphere', name: '波导弹', element: 'fairy', power: 56, maxPp: 15, kind: 'damage', description: '追踪光球精准打击' },
    { id: 'recover', name: '自我再生', element: 'psychic', power: 0, maxPp: 5, kind: 'heal', description: '释放幻之光回复大量 HP' },
    { id: 'genesis', name: '起源超新星', element: 'psychic', power: 95, maxPp: 4, kind: 'damage', description: '幻之宝可梦的究极星光' },
  ],
  caterpie: [
    { id: 'bug_bite', name: '虫咬', element: 'grass', power: 54, maxPp: 14, kind: 'damage', description: '敏捷啃咬并汲取活力' },
    { id: 'string_shot', name: '吐丝', element: 'normal', power: 38, maxPp: 20, kind: 'damage', description: '喷射黏丝束缚对手' },
    { id: 'quiver_dance', name: '蝶舞', element: 'grass', power: 0, maxPp: 8, kind: 'buff_atk', description: '轻盈起舞全面提升威力' },
    { id: 'bug_buzz', name: '虫鸣风暴', element: 'grass', power: 80, maxPp: 5, kind: 'damage', description: '振翅发出强力声波冲击' },
  ],
  pidgey: [
    { id: 'gust', name: '起风', element: 'normal', power: 56, maxPp: 14, kind: 'damage', description: '扇动双翼卷起锐利旋风' },
    { id: 'quick_wing', name: '电光疾冲', element: 'normal', power: 44, maxPp: 20, kind: 'damage', description: '高速俯冲精准打击' },
    { id: 'feather_dance', name: '羽毛舞', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '漫天羽翼守护自身防御' },
    { id: 'hurricane', name: '暴风俯冲', element: 'normal', power: 86, maxPp: 4, kind: 'damage', description: '召唤烈风从高空猛烈俯冲' },
  ],
  vulpix: [
    { id: 'ember_fox', name: '狐火连弹', element: 'fire', power: 60, maxPp: 12, kind: 'damage', description: '优雅释放鬼魅狐火灼烧对手' },
    { id: 'quick_fox', name: '电光一闪', element: 'normal', power: 42, maxPp: 20, kind: 'damage', description: '灵巧身姿疾速突击' },
    { id: 'nasty_plot', name: '灵狐冥想', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '凝聚九尾灵力大幅提攻' },
    { id: 'inferno_fox', name: '炼狱九焰', element: 'fire', power: 86, maxPp: 4, kind: 'damage', description: '九条尾焰化作烈火风暴' },
  ],
  diglett: [
    { id: 'mud_slap', name: '掷泥突袭', element: 'normal', power: 56, maxPp: 14, kind: 'damage', description: '潜入地底掀翻泥土攻击' },
    { id: 'dig_strike', name: '挖洞突刺', element: 'normal', power: 48, maxPp: 16, kind: 'damage', description: '从脚下猛然钻出突袭' },
    { id: 'sand_guard', name: '流沙护体', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '卷起沙尘提升自身防御' },
    { id: 'earthquake_dig', name: '大地裂震', element: 'normal', power: 86, maxPp: 4, kind: 'damage', description: '引发剧烈地动震裂全场' },
  ],
  growlithe: [
    { id: 'flame_wheel', name: '火焰轮', element: 'fire', power: 62, maxPp: 12, kind: 'damage', description: '浑身燃火高速滚撞对手' },
    { id: 'bite_dog', name: '咬碎', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '强力咬合撕裂敌阵' },
    { id: 'howl_fire', name: '长嚎鼓舞', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '激昂嚎叫唤醒烈焰战意' },
    { id: 'flare_blitz', name: '闪焰冲锋', element: 'fire', power: 90, maxPp: 4, kind: 'damage', description: '化作烈日流星全力冲锋' },
  ],
  abra: [
    { id: 'psybeam', name: '幻象光线', element: 'psychic', power: 64, maxPp: 12, kind: 'damage', description: '射出七彩念力光束贯通对手' },
    { id: 'confusion_abra', name: '念力波', element: 'psychic', power: 46, maxPp: 18, kind: 'damage', description: '凝神释放精准念波' },
    { id: 'calm_mind', name: '冥想', element: 'psychic', power: 0, maxPp: 8, kind: 'buff_atk', description: '静心冥想极大增强超能' },
    { id: 'future_sight', name: '预知未来', element: 'psychic', power: 90, maxPp: 4, kind: 'damage', description: '扭曲时空降下毁灭念击' },
  ],
  machop: [
    { id: 'karate_chop', name: '空手劈', element: 'normal', power: 62, maxPp: 12, kind: 'damage', description: '凌厉手刀精准击中要害' },
    { id: 'low_kick', name: '踢倒', element: 'normal', power: 46, maxPp: 18, kind: 'damage', description: '沉稳下盘横扫击退对手' },
    { id: 'bulk_up', name: '健美', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '紧绷肌肉大幅强化攻防' },
    { id: 'dynamic_punch', name: '爆裂拳', element: 'normal', power: 90, maxPp: 4, kind: 'damage', description: '四臂齐出轰出震天重拳' },
  ],
  geodude: [
    { id: 'rock_throw', name: '落岩', element: 'normal', power: 60, maxPp: 12, kind: 'damage', description: '投掷巨石猛砸对手' },
    { id: 'rollout', name: '滚动撞击', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '化作岩石炮弹高速碾压' },
    { id: 'iron_defense', name: '变圆硬化', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '岩石外壳硬化大幅增防' },
    { id: 'stone_edge', name: '尖石攻击', element: 'normal', power: 88, maxPp: 4, kind: 'damage', description: '从地底刺出锋利岩峰' },
  ],
  scyther: [
    { id: 'x_scissor', name: '十字剪', element: 'grass', power: 66, maxPp: 10, kind: 'damage', description: '双镰交叉高速斩裂对手' },
    { id: 'air_slash', name: '空气斩', element: 'normal', power: 50, maxPp: 16, kind: 'damage', description: '挥出真空风刃远程切击' },
    { id: 'swords_dance', name: '剑舞', element: 'grass', power: 0, maxPp: 8, kind: 'buff_atk', description: '极速剑舞大幅提升斩击力' },
    { id: 'fury_cutter', name: '疾风连斩', element: 'grass', power: 88, maxPp: 4, kind: 'damage', description: '化作翠绿残影连续斩击' },
  ],
  magikarp: [
    { id: 'aqua_fang', name: '水流裂破', element: 'water', power: 64, maxPp: 12, kind: 'damage', description: '跃出激流撕咬冲击对手' },
    { id: 'splash_tackle', name: '跃起撞击', element: 'normal', power: 42, maxPp: 20, kind: 'damage', description: '奋力弹跳扑向对手' },
    { id: 'dragon_rage_buf', name: '龙威鼓舞', element: 'dragon', power: 0, maxPp: 8, kind: 'buff_atk', description: '觉醒暴鲤龙之怒大幅提攻' },
    { id: 'hydro_tail', name: '怒海狂涛', element: 'water', power: 92, maxPp: 4, kind: 'damage', description: '掀起滔天巨浪席卷战场' },
  ],
  lapras: [
    { id: 'ice_beam', name: '冰冻光束', element: 'water', power: 66, maxPp: 10, kind: 'damage', description: '发射极寒冰线冻结对手' },
    { id: 'surf_wave', name: '乘浪冲击', element: 'water', power: 52, maxPp: 16, kind: 'damage', description: '驾驭海潮稳健席卷前方' },
    { id: 'sing_heal', name: '海之咏叹', element: 'water', power: 0, maxPp: 5, kind: 'heal', description: '温柔海歌抚慰伤痛回复 HP' },
    { id: 'blizzard_sea', name: '极地暴风雪', element: 'water', power: 90, maxPp: 4, kind: 'damage', description: '召唤凛冽暴雪冰封全域' },
  ],
  mewtwo: [
    { id: 'psystrike', name: '精神击破', element: 'psychic', power: 74, maxPp: 10, kind: 'damage', description: '将念力实体化粉碎对手防线' },
    { id: 'shadow_nova', name: '暗影冲击', element: 'ghost', power: 58, maxPp: 15, kind: 'damage', description: '释放深邃暗影能量轰击' },
    { id: 'recover_mt', name: '超能再生', element: 'psychic', power: 0, maxPp: 5, kind: 'heal', description: '瞬间重构细胞回复大量 HP' },
    { id: 'psystrike_ex', name: '究极念力风暴', element: 'psychic', power: 98, maxPp: 4, kind: 'damage', description: '传说级最强超能力毁灭打击' },
  ],
  weedle: [
    { id: 'poison_sting', name: '毒针连射', element: 'grass', power: 54, maxPp: 15, kind: 'damage', description: '发射锋利毒针连续扎击对手' },
    { id: 'twineedle', name: '双针突刺', element: 'grass', power: 48, maxPp: 18, kind: 'damage', description: '高速冲刺双针连击' },
    { id: 'focus_bee', name: '聚气振翅', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '高频振翅大幅提升穿刺力' },
    { id: 'fell_stinger', name: '致命针刺', element: 'grass', power: 84, maxPp: 5, kind: 'damage', description: '俯冲刺出致命剧毒双针' },
  ],
  sandshrew: [
    { id: 'slash_sand', name: '沙爪撕裂', element: 'normal', power: 58, maxPp: 14, kind: 'damage', description: '锋利钢爪伴随流沙横扫' },
    { id: 'sand_roll', name: '滚沙突击', element: 'normal', power: 46, maxPp: 18, kind: 'damage', description: '蜷成沙球高速撞击对手' },
    { id: 'sand_armor', name: '沙甲蜷缩', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '硬甲紧缩抵御猛烈攻势' },
    { id: 'sand_quake', name: '裂沙震击', element: 'normal', power: 86, maxPp: 4, kind: 'damage', description: '掀翻沙丘引发剧烈震荡' },
  ],
  nidoran: [
    { id: 'poison_jab', name: '毒击冲锋', element: 'grass', power: 64, maxPp: 12, kind: 'damage', description: '紫毒锐角全力突刺对手' },
    { id: 'earth_horn', name: '大地之角', element: 'normal', power: 52, maxPp: 16, kind: 'damage', description: '引动地脉之力重锤敌阵' },
    { id: 'king_roar', name: '霸王咆哮', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '尼多王威严怒吼大幅提攻' },
    { id: 'megahorn', name: '超级角击', element: 'grass', power: 92, maxPp: 4, kind: 'damage', description: '全力贯穿战场的终极角突' },
  ],
  clefairy: [
    { id: 'moonblast', name: '月亮之力', element: 'fairy', power: 64, maxPp: 12, kind: 'damage', description: '借用月光魔力轰击对手' },
    { id: 'metronome_star', name: '星光挥指', element: 'fairy', power: 48, maxPp: 18, kind: 'damage', description: '唤出神秘月星光弹打击' },
    { id: 'moonlight_heal', name: '月光治愈', element: 'fairy', power: 0, maxPp: 5, kind: 'heal', description: '沐浴清辉回复大量体力' },
    { id: 'dazzling_gleam', name: '魔法闪耀', element: 'fairy', power: 86, maxPp: 4, kind: 'damage', description: '绽放耀眼月华震慑全场' },
  ],
  oddish: [
    { id: 'petal_dance', name: '花瓣舞', element: 'grass', power: 62, maxPp: 12, kind: 'damage', description: '漫天绯红花瓣卷起风暴' },
    { id: 'acid_leaf', name: '溶解飞叶', element: 'grass', power: 46, maxPp: 18, kind: 'damage', description: '洒出酸香花粉侵蚀对手' },
    { id: 'synthesis_bloom', name: '光合绽放', element: 'grass', power: 0, maxPp: 5, kind: 'heal', description: '吸收阳光舒展花冠回复 HP' },
    { id: 'solar_petal', name: '烈日毒莲', element: 'grass', power: 88, maxPp: 4, kind: 'damage', description: '巨花怒放释放灼热孢子炮' },
  ],
  poliwag: [
    { id: 'bubble_beam', name: '泡沫光线', element: 'water', power: 60, maxPp: 14, kind: 'damage', description: '高速喷射连串高压水泡' },
    { id: 'aqua_punch', name: '水流重拳', element: 'water', power: 50, maxPp: 16, kind: 'damage', description: '裹挟激流挥出刚猛直拳' },
    { id: 'belly_focus', name: '腹鼓气势', element: 'water', power: 0, maxPp: 8, kind: 'buff_atk', description: '拍打漩涡腹部唤醒澎湃战力' },
    { id: 'hydro_fist', name: '激流爆裂拳', element: 'water', power: 88, maxPp: 4, kind: 'damage', description: '以排山倒海之势轰碎敌阵' },
  ],
  ponyta: [
    { id: 'flame_charge', name: '蓄能焰袭', element: 'fire', power: 62, maxPp: 12, kind: 'damage', description: '烈焰鬃毛燃烧疾驰冲撞' },
    { id: 'stomp_fire', name: '烈蹄踏击', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '炽热马蹄迅猛践踏对手' },
    { id: 'agility_flame', name: '疾火奔腾', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '点燃全速斗志大幅提攻' },
    { id: 'fire_gallop', name: '赤焰流星驰', element: 'fire', power: 88, maxPp: 4, kind: 'damage', description: '化作赤红烈驹撕裂长空' },
  ],
  slowpoke: [
    { id: 'water_pulse_sp', name: '慵懒水波', element: 'water', power: 60, maxPp: 14, kind: 'damage', description: '悠然放出震荡涟漪冲击' },
    { id: 'psy_yawn', name: '念力头锤', element: 'psychic', power: 50, maxPp: 16, kind: 'damage', description: '以不可思议的念波撞击' },
    { id: 'slack_off', name: '偷懒小憩', element: 'water', power: 0, maxPp: 5, kind: 'heal', description: '发呆打盹悠闲回复大量 HP' },
    { id: 'shell_psychic', name: '贝壳强念炮', element: 'psychic', power: 88, maxPp: 4, kind: 'damage', description: '大舌贝共鸣轰出强念巨浪' },
  ],
  magnemite: [
    { id: 'spark_mag', name: '电磁火花', element: 'electric', power: 60, maxPp: 14, kind: 'damage', description: '发射高能电磁脉冲电击' },
    { id: 'flash_cannon', name: '加农光炮', element: 'normal', power: 52, maxPp: 16, kind: 'damage', description: '凝聚金属光芒直线轰射' },
    { id: 'magnet_rise', name: '电磁浮游', element: 'electric', power: 0, maxPp: 8, kind: 'buff_def', description: '展开强力磁盾稳固防御' },
    { id: 'zap_cannon', name: '电磁炮', element: 'electric', power: 90, maxPp: 4, kind: 'damage', description: '发射超高电压电磁光球' },
  ],
  shellder: [
    { id: 'icicle_spear', name: '冰锥连射', element: 'water', power: 62, maxPp: 12, kind: 'damage', description: '连续射出晶莹锋利冰锥' },
    { id: 'clamp_water', name: '贝壳夹击', element: 'water', power: 48, maxPp: 18, kind: 'damage', description: '以坚硬贝壳强力钳制' },
    { id: 'shell_smash', name: '破壳觉醒', element: 'water', power: 0, maxPp: 8, kind: 'buff_atk', description: '解放硬壳束缚爆发攻势' },
    { id: 'hydro_icicle', name: '极寒刺甲炮', element: 'water', power: 90, maxPp: 4, kind: 'damage', description: '狂风骤雨般的极寒冰锥阵' },
  ],
  onix: [
    { id: 'rock_slide', name: '岩崩', element: 'normal', power: 64, maxPp: 12, kind: 'damage', description: '召唤连绵巨岩滚落压制' },
    { id: 'iron_tail_ox', name: '铁尾横扫', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '摆动十米岩尾猛烈横扫' },
    { id: 'coil_rock', name: '磐岩盘蜷', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '巨岩身躯盘绕防御倍增' },
    { id: 'canyon_crush', name: '山崩地裂', element: 'normal', power: 90, maxPp: 4, kind: 'damage', description: '撼动整片峡谷的巨岩冲击' },
  ],
  cubone: [
    { id: 'bonemerang', name: '骨头回力镖', element: 'normal', power: 64, maxPp: 12, kind: 'damage', description: '投出回旋骨棒往返双连击' },
    { id: 'bone_club', name: '骨棒猛击', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '挥舞粗骨棒迅猛敲击' },
    { id: 'bone_spirit', name: '思念之魂', element: 'ghost', power: 0, maxPp: 8, kind: 'buff_atk', description: '唤醒先祖护佑大幅提攻' },
    { id: 'shadow_bone', name: '暗影之骨', element: 'ghost', power: 88, maxPp: 4, kind: 'damage', description: '缠绕灵火的骨棒重创敌手' },
  ],
  rhyhorn: [
    { id: 'horn_drill_rh', name: '钻角冲锋', element: 'normal', power: 64, maxPp: 12, kind: 'damage', description: '高速旋转巨角猛烈穿刺' },
    { id: 'rock_blast', name: '岩石爆击', element: 'normal', power: 52, maxPp: 16, kind: 'damage', description: '连续轰出高密度岩弹' },
    { id: 'rock_polish', name: '岩石打磨', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '打磨重甲提升抗打击力' },
    { id: 'rock_wrecker', name: '岩石炮', element: 'normal', power: 92, maxPp: 4, kind: 'damage', description: '发射毁天灭地的巨岩陨炮' },
  ],
  chansey: [
    { id: 'egg_bomb', name: '炸蛋冲击', element: 'fairy', power: 56, maxPp: 14, kind: 'damage', description: '投出圆滚滚能量蛋爆破' },
    { id: 'pound_ch', name: '温柔连拍', element: 'normal', power: 44, maxPp: 20, kind: 'damage', description: '圆润双掌连续轻快拍击' },
    { id: 'soft_boiled', name: '生蛋治愈', element: 'fairy', power: 0, maxPp: 6, kind: 'heal', description: '分享幸福营养蛋大量回血' },
    { id: 'hyper_egg', name: '幸福星辉波', element: 'fairy', power: 84, maxPp: 4, kind: 'damage', description: '释放满满治愈能量冲击波' },
  ],
  horsea: [
    { id: 'water_gun_hs', name: '墨水激流', element: 'water', power: 60, maxPp: 14, kind: 'damage', description: '精准喷射高压水流与墨雾' },
    { id: 'dragon_breath_hs', name: '龙息吐息', element: 'dragon', power: 52, maxPp: 16, kind: 'damage', description: '吐出蔚蓝龙息冲击对手' },
    { id: 'focus_sea', name: '深海聚气', element: 'water', power: 0, maxPp: 8, kind: 'buff_atk', description: '凝神狙击大幅提高威力' },
    { id: 'hydro_vortex', name: '龙卷漩涡炮', element: 'water', power: 88, maxPp: 4, kind: 'damage', description: '掀起高速海龙卷席卷前方' },
  ],
  staryu: [
    { id: 'swift_star', name: '高速星星', element: 'water', power: 62, maxPp: 14, kind: 'damage', description: '宝石核心齐射璀璨星芒' },
    { id: 'psy_wave_st', name: '星核念波', element: 'psychic', power: 52, maxPp: 16, kind: 'damage', description: '闪烁红宝石放出奇异念波' },
    { id: 'recover_star', name: '星核再生', element: 'psychic', power: 0, maxPp: 5, kind: 'heal', description: '核心脉动快速回复体力' },
    { id: 'cosmic_hydro', name: '星耀高压水炮', element: 'water', power: 92, maxPp: 4, kind: 'damage', description: '高速自转喷射星辉巨浪' },
  ],
  electabuzz: [
    { id: 'thunder_punch', name: '雷电拳', element: 'electric', power: 66, maxPp: 12, kind: 'damage', description: '双臂缠绕高压电流重击' },
    { id: 'discharge', name: '疯狂放电', element: 'electric', power: 52, maxPp: 16, kind: 'damage', description: '向四周释放耀眼电弧冲击' },
    { id: 'charge_buzz', name: '高压蓄电', element: 'electric', power: 0, maxPp: 8, kind: 'buff_atk', description: '全身高压充电大幅提攻' },
    { id: 'thunder_storm', name: '狂雷轰顶', element: 'electric', power: 92, maxPp: 4, kind: 'damage', description: '引动滚滚惊雷猛劈全场' },
  ],
  magmar: [
    { id: 'fire_punch_mg', name: '火焰拳', element: 'fire', power: 66, maxPp: 12, kind: 'damage', description: '滚烫熔岩之拳炽烈轰击' },
    { id: 'lava_plume', name: '喷烟烈焰', element: 'fire', power: 52, maxPp: 16, kind: 'damage', description: '喷出炙热火山烟尘灼烧' },
    { id: 'magma_focus', name: '熔核沸腾', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '引燃火山熔心大幅提攻' },
    { id: 'fire_blast_mg', name: '大字爆炎', element: 'fire', power: 92, maxPp: 4, kind: 'damage', description: '释放巨大的大字烈焰吞没对手' },
  ],
  porygon: [
    { id: 'tri_attack', name: '三重攻击', element: 'psychic', power: 64, maxPp: 12, kind: 'damage', description: '火冰电三色光束同步齐射' },
    { id: 'psybeam_pg', name: '数据光线', element: 'psychic', power: 50, maxPp: 16, kind: 'damage', description: '射出几何像素能量光束' },
    { id: 'recover_pg', name: '数据修复', element: 'psychic', power: 0, maxPp: 5, kind: 'heal', description: '执行自我校验快速回复 HP' },
    { id: 'hyper_pixel', name: '超频毁灭射线', element: 'psychic', power: 90, maxPp: 4, kind: 'damage', description: '系统超频释放全功率激光' },
  ],
  aerodactyl: [
    { id: 'ancient_power', name: '原始之力', element: 'dragon', power: 66, maxPp: 12, kind: 'damage', description: '唤起太古巨岩与风暴轰击' },
    { id: 'wing_fang', name: '天空利牙', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '从高空极速俯冲撕咬' },
    { id: 'sky_roar', name: '太古龙啸', element: 'dragon', power: 0, maxPp: 8, kind: 'buff_atk', description: '震彻云霄的太古咆哮提攻' },
    { id: 'sky_drop_rock', name: '太古天翼岩崩', element: 'dragon', power: 92, maxPp: 4, kind: 'damage', description: '撕裂苍穹的陨岩俯冲突袭' },
  ],
  articuno: [
    { id: 'freeze_dry', name: '冷冻干燥', element: 'water', power: 72, maxPp: 10, kind: 'damage', description: '挥动冰晶羽翼瞬间冻结对手' },
    { id: 'icy_wind', name: '冰冻之风', element: 'water', power: 56, maxPp: 16, kind: 'damage', description: '席卷凛冽寒风穿透敌阵' },
    { id: 'roost_ice', name: '霜翼栖息', element: 'water', power: 0, maxPp: 5, kind: 'heal', description: '凝聚极光冰晶回复大量 HP' },
    { id: 'sheer_cold', name: '绝对零度暴雪', element: 'water', power: 96, maxPp: 4, kind: 'damage', description: '传说冰鸟降下极寒终焉暴雪' },
  ],
  zapdos: [
    { id: 'discharge_zp', name: '雷神落雷', element: 'electric', power: 72, maxPp: 10, kind: 'damage', description: '振翅召唤万钧雷霆贯通战场' },
    { id: 'drill_peck', name: '啄钻疾电', element: 'electric', power: 56, maxPp: 16, kind: 'damage', description: '化作金雷闪电高速穿刺' },
    { id: 'roost_zap', name: '雷云蓄能', element: 'electric', power: 0, maxPp: 5, kind: 'heal', description: '汲取雷暴能量回复大量 HP' },
    { id: 'zap_tempest', name: '传说雷霆风暴', element: 'electric', power: 96, maxPp: 4, kind: 'damage', description: '传说雷鸟引爆遮天蔽日雷暴' },
  ],
  moltres: [
    { id: 'heat_wave', name: '热风焚翼', element: 'fire', power: 72, maxPp: 10, kind: 'damage', description: '挥洒金红火焰羽毛席卷全场' },
    { id: 'air_flame', name: '烈焰空斩', element: 'fire', power: 56, maxPp: 16, kind: 'damage', description: '煽动炽热风刃灼烧敌阵' },
    { id: 'roost_flame', name: '不死鸟浴火', element: 'fire', power: 0, maxPp: 5, kind: 'heal', description: '沐浴神圣火焰回复大量 HP' },
    { id: 'sky_burn', name: '传说神鸟烈焰', element: 'fire', power: 96, maxPp: 4, kind: 'damage', description: '传说火鸟化作耀阳焚尽苍穹' },
  ],
  rattata: [
    { id: 'hyper_fang', name: '必杀门牙', element: 'normal', power: 62, maxPp: 14, kind: 'damage', description: '锋利门牙高速啃咬重创对手' },
    { id: 'quick_bite', name: '电光咬住', element: 'normal', power: 46, maxPp: 20, kind: 'damage', description: '迅捷扑击连续咬击' },
    { id: 'focus_rat', name: '磨牙聚气', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '磨砺门牙大幅提升威力' },
    { id: 'super_fang', name: '愤怒门牙', element: 'normal', power: 86, maxPp: 4, kind: 'damage', description: '全力啃噬撕裂对手防线' },
  ],
  spearow: [
    { id: 'drill_peck_sp', name: '啄钻', element: 'normal', power: 64, maxPp: 14, kind: 'damage', description: '旋转长喙高速贯穿对手' },
    { id: 'aerial_ace', name: '燕返', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '敏捷回旋必定命中斩击' },
    { id: 'sky_focus', name: '锐利目光', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '锁定目标大幅提升威力' },
    { id: 'sky_attack_sp', name: '神鸟猛击', element: 'normal', power: 88, maxPp: 4, kind: 'damage', description: '化作苍穹流光俯冲强袭' },
  ],
  ekans: [
    { id: 'poison_fang', name: '剧毒牙', element: 'grass', power: 62, maxPp: 14, kind: 'damage', description: '挥动紫毒尖牙猛烈撕咬' },
    { id: 'acid_spray', name: '溶解液', element: 'grass', power: 46, maxPp: 18, kind: 'damage', description: '喷射强酸腐蚀对手护甲' },
    { id: 'coil_ek', name: '盘蜷', element: 'grass', power: 0, maxPp: 8, kind: 'buff_atk', description: '盘起身躯同时提升攻防' },
    { id: 'gunk_shot', name: '垃圾射击', element: 'grass', power: 88, maxPp: 4, kind: 'damage', description: '猛烈喷射剧毒巨弹重创对手' },
  ],
  nidoranf: [
    { id: 'earth_power_nq', name: '大地之力', element: 'normal', power: 64, maxPp: 12, kind: 'damage', description: '引爆脚下地脉重击对手' },
    { id: 'sludge_wave_nq', name: '污泥波', element: 'grass', power: 54, maxPp: 16, kind: 'damage', description: '释放紫蓝毒浪横扫前方' },
    { id: 'queen_guard', name: '女皇鳞甲', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '坚硬蓝鳞护体防御大增' },
    { id: 'queen_quake', name: '女皇裂地崩', element: 'normal', power: 92, maxPp: 4, kind: 'damage', description: '尼多后的最强地震冲击' },
  ],
  zubat: [
    { id: 'air_cutter_zb', name: '空气利刃', element: 'normal', power: 58, maxPp: 14, kind: 'damage', description: '扇动蝠翼斩出锐利风刃' },
    { id: 'leech_fang', name: '吸血毒牙', element: 'ghost', power: 48, maxPp: 18, kind: 'damage', description: '暗夜奇袭汲取对手活力' },
    { id: 'supersonic_ev', name: '超声干扰', element: 'ghost', power: 0, maxPp: 8, kind: 'buff_atk', description: '锁定声波回响提升威力' },
    { id: 'cross_poison_zb', name: '十字毒刃', element: 'ghost', power: 86, maxPp: 4, kind: 'damage', description: '极速俯冲斩出剧毒十字' },
  ],
  paras: [
    { id: 'x_scissor_pr', name: '菌镰十字斩', element: 'grass', power: 60, maxPp: 14, kind: 'damage', description: '挥动双钳斩出凌厉十字' },
    { id: 'giga_drain_pr', name: '终极吸取', element: 'grass', power: 48, maxPp: 16, kind: 'damage', description: '释放菌丝汲取自然能量' },
    { id: 'spore_heal', name: '孢子复苏', element: 'grass', power: 0, maxPp: 5, kind: 'heal', description: '散播治愈孢子回复体力' },
    { id: 'spore_burst', name: '巨伞孢子暴', element: 'grass', power: 86, maxPp: 4, kind: 'damage', description: '引爆满天蘑菇孢子席卷全场' },
  ],
  venonat: [
    { id: 'silver_wind', name: '银色旋风', element: 'grass', power: 62, maxPp: 12, kind: 'damage', description: '挥洒闪亮鳞粉掀起旋风' },
    { id: 'psybeam_vn', name: '复眼幻光', element: 'psychic', power: 50, maxPp: 16, kind: 'damage', description: '复眼射出七彩念力光线' },
    { id: 'quiver_vn', name: '月影蝶舞', element: 'grass', power: 0, maxPp: 8, kind: 'buff_atk', description: '优雅蝶舞全面强化魔力' },
    { id: 'venom_storm', name: '幻彩毒麟暴', element: 'grass', power: 88, maxPp: 4, kind: 'damage', description: '漫天紫鳞引发剧毒念波' },
  ],
  mankey: [
    { id: 'cross_chop', name: '十字劈', element: 'normal', power: 66, maxPp: 12, kind: 'damage', description: '双拳交叉爆裂击中要害' },
    { id: 'low_sweep_mk', name: '下盘踢', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '凌厉回旋踢击退敌人' },
    { id: 'anger_point', name: '愤怒穴位', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '引燃战意攻击力飙升' },
    { id: 'close_combat_mk', name: '近身战', element: 'normal', power: 92, maxPp: 4, kind: 'damage', description: '不顾一切的狂风暴雨连打' },
  ],
  bellsprout: [
    { id: 'leaf_blade_bs', name: '叶刃斩', element: 'grass', power: 64, maxPp: 12, kind: 'damage', description: '挥动锋利翠叶迅猛斩击' },
    { id: 'vine_whip_bs', name: '藤鞭连打', element: 'grass', power: 48, maxPp: 18, kind: 'damage', description: '灵巧藤蔓连续抽击对手' },
    { id: 'growth_bs', name: '阳光生长', element: 'grass', power: 0, maxPp: 8, kind: 'buff_atk', description: '吸收日光强化草毒威力' },
    { id: 'power_whip_bs', name: '强力鞭打', element: 'grass', power: 90, maxPp: 4, kind: 'damage', description: '巨藤轰击横扫整片战场' },
  ],
  tentacool: [
    { id: 'scald_tc', name: '热水冲击', element: 'water', power: 62, maxPp: 14, kind: 'damage', description: '喷射滚烫高压海浪灼伤对手' },
    { id: 'sludge_tc', name: '毒液触手', element: 'grass', power: 50, maxPp: 16, kind: 'damage', description: '伸缩触手发射剧毒水弹' },
    { id: 'barrier_tc', name: '海晶屏障', element: 'water', power: 0, maxPp: 8, kind: 'buff_def', description: '红水晶展开水幕大幅增防' },
    { id: 'hydro_tentacle', name: '深海狂澜', element: 'water', power: 90, maxPp: 4, kind: 'damage', description: '八十触手卷起剧毒巨浪' },
  ],
  farfetchd: [
    { id: 'leaf_blade_ff', name: '大葱居合斩', element: 'grass', power: 66, maxPp: 12, kind: 'damage', description: '挥舞大葱宝剑斩出必爆剑气' },
    { id: 'air_slash_ff', name: '疾风斩', element: 'normal', power: 50, maxPp: 16, kind: 'damage', description: '振翅劈出锐利真空刃' },
    { id: 'swords_ff', name: '葱剑起势', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '高举大葱凝神提攻' },
    { id: 'brave_leek', name: '勇鸟葱剑舞', element: 'normal', power: 90, maxPp: 4, kind: 'damage', description: '人葱合一化作绝世剑光' },
  ],
  doduo: [
    { id: 'tri_peck', name: '三重猛啄', element: 'normal', power: 64, maxPp: 12, kind: 'damage', description: '三头齐下高速连环啄击' },
    { id: 'jump_kick_dd', name: '飞膝疾踢', element: 'normal', power: 52, maxPp: 16, kind: 'damage', description: '借高速奔跑飞跃猛踢' },
    { id: 'agility_dd', name: '高速移动', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '步频暴涨威力倍增' },
    { id: 'brave_bird_dd', name: '疾风勇鸟冲', element: 'normal', power: 90, maxPp: 4, kind: 'damage', description: '如草原飓风般贯通敌阵' },
  ],
  seel: [
    { id: 'aurora_beam', name: '极光束', element: 'water', power: 62, maxPp: 14, kind: 'damage', description: '射出七彩极寒光束冻结对手' },
    { id: 'aqua_jet_sl', name: '水流喷射', element: 'water', power: 48, maxPp: 18, kind: 'damage', description: '裹挟浪花高速突刺' },
    { id: 'rest_ice', name: '冰海小憩', element: 'water', power: 0, maxPp: 5, kind: 'heal', description: '潜入清凉冰海回复 HP' },
    { id: 'sheer_ice_sl', name: '冰海极光暴', element: 'water', power: 88, maxPp: 4, kind: 'damage', description: '召唤极地寒潮席卷全场' },
  ],
  grimer: [
    { id: 'sludge_bomb_gr', name: '污泥炸弹', element: 'ghost', power: 64, maxPp: 12, kind: 'damage', description: '投掷浓稠紫泥炸弹轰击' },
    { id: 'shadow_sneak_gr', name: '暗影泥掌', element: 'ghost', power: 48, maxPp: 18, kind: 'damage', description: '伸出暗紫泥手猛拍对手' },
    { id: 'acid_armor', name: '溶化护甲', element: 'ghost', power: 0, maxPp: 8, kind: 'buff_def', description: '液化防御大幅降低受伤' },
    { id: 'gunk_wave_gr', name: '毒泥海啸', element: 'ghost', power: 90, maxPp: 4, kind: 'damage', description: '掀起铺天盖地紫泥浪潮' },
  ],
  drowzee: [
    { id: 'dream_eater', name: '食梦念波', element: 'psychic', power: 64, maxPp: 12, kind: 'damage', description: '借梦境之力发出强念打击' },
    { id: 'psyshock_dr', name: '精神冲击', element: 'psychic', power: 50, maxPp: 16, kind: 'damage', description: '摆动金锤射出实体念波' },
    { id: 'nasty_dream', name: '梦境冥想', element: 'psychic', power: 0, maxPp: 8, kind: 'buff_atk', description: '凝聚梦境能量大幅提攻' },
    { id: 'hypno_nova', name: '幻梦终焉波', element: 'psychic', power: 88, maxPp: 4, kind: 'damage', description: '展开金色梦境漩涡席卷全场' },
  ],
  krabby: [
    { id: 'crabhammer', name: '蟹钳锤', element: 'water', power: 68, maxPp: 12, kind: 'damage', description: '挥动万钧巨钳砸出惊涛' },
    { id: 'vice_grip', name: '铁钳猛夹', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '坚固巨钳强力夹击对手' },
    { id: 'iron_shell_kr', name: '硬壳架势', element: 'water', power: 0, maxPp: 8, kind: 'buff_def', description: '举起巨钳稳固防线' },
    { id: 'guillotine_wave', name: '超极巨泡影', element: 'water', power: 92, maxPp: 4, kind: 'damage', description: '巨钳轰出排山倒海怒涛' },
  ],
  voltorb: [
    { id: 'electro_ball', name: '电球疾射', element: 'electric', power: 64, maxPp: 12, kind: 'damage', description: '以极速凝聚高压电球砸击' },
    { id: 'spark_roll', name: '电光滚撞', element: 'electric', power: 48, maxPp: 18, kind: 'damage', description: '高速翻滚释放耀眼火花' },
    { id: 'charge_vt', name: '极速充能', element: 'electric', power: 0, maxPp: 8, kind: 'buff_atk', description: '电流超载爆发超高威力' },
    { id: 'volt_nova', name: '雷弹大爆发', element: 'electric', power: 92, maxPp: 4, kind: 'damage', description: '引爆全身高压电能席卷全场' },
  ],
  exeggcute: [
    { id: 'seed_bomb_ex', name: '种子炸弹', element: 'grass', power: 64, maxPp: 12, kind: 'damage', description: '连续抛射爆裂椰蛋轰击' },
    { id: 'psyshock_ex', name: '三头念波', element: 'psychic', power: 54, maxPp: 16, kind: 'damage', description: '三颗头齐射强力超能光波' },
    { id: 'sunny_heal', name: '热带光合', element: 'grass', power: 0, maxPp: 5, kind: 'heal', description: '沐浴南国暖阳回复大量 HP' },
    { id: 'leaf_storm_ex', name: '飞叶风暴', element: 'grass', power: 92, maxPp: 4, kind: 'damage', description: '召唤漫天巨叶龙卷重创敌阵' },
  ],
  hitmonlee: [
    { id: 'high_jump_kick', name: '飞膝踢', element: 'normal', power: 70, maxPp: 10, kind: 'damage', description: '腾空跃起轰出毁灭性膝击' },
    { id: 'blaze_kick', name: '火焰踢', element: 'fire', power: 56, maxPp: 15, kind: 'damage', description: '缠绕烈焰的回旋连环踢' },
    { id: 'focus_kick', name: '武道聚气', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '调整呼吸蓄满必杀踢力' },
    { id: 'mega_kick_hl', name: '究极旋风腿', element: 'normal', power: 92, maxPp: 4, kind: 'damage', description: '踢技之鬼的终极狂风连踢' },
  ],
  hitmonchan: [
    { id: 'tri_punch', name: '三色元素拳', element: 'fire', power: 68, maxPp: 12, kind: 'damage', description: '冰火雷三色铁拳瞬间连打' },
    { id: 'mach_punch', name: '音速拳', element: 'normal', power: 54, maxPp: 18, kind: 'damage', description: '以肉眼难辨的速度先制直拳' },
    { id: 'iron_fist_buf', name: '铁拳战姿', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '紧握拳套大幅增强拳威' },
    { id: 'sky_uppercut', name: '冲天拳', element: 'normal', power: 92, maxPp: 4, kind: 'damage', description: '贯穿云霄的冠军上勾重拳' },
  ],
  lickitung: [
    { id: 'power_lick', name: '重磅舔击', element: 'normal', power: 60, maxPp: 14, kind: 'damage', description: '甩出长舌横扫击晕对手' },
    { id: 'rollout_lk', name: '圆滚冲撞', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '胖乎乎身躯高速翻滚撞击' },
    { id: 'belly_heal', name: '大快朵颐', element: 'normal', power: 0, maxPp: 5, kind: 'heal', description: '品尝甜果开心回复 HP' },
    { id: 'giga_stomp_lk', name: '巨力泰山压', element: 'normal', power: 88, maxPp: 4, kind: 'damage', description: '全力跃起砸下震撼冲击波' },
  ],
  koffing: [
    { id: 'sludge_kf', name: '浓烟毒弹', element: 'ghost', power: 64, maxPp: 12, kind: 'damage', description: '喷射高浓度紫色毒烟爆弹' },
    { id: 'clear_smog', name: '清除之烟', element: 'ghost', power: 48, maxPp: 18, kind: 'damage', description: '放出奇异烟雾净化并打击' },
    { id: 'smokescreen_kf', name: '烟幕护盾', element: 'ghost', power: 0, maxPp: 8, kind: 'buff_def', description: '浓郁烟雾笼罩提升防御' },
    { id: 'gas_nova', name: '双弹毒爆', element: 'ghost', power: 90, maxPp: 4, kind: 'damage', description: '双核齐发引爆紫色毒雾风暴' },
  ],
  tangela: [
    { id: 'power_vine_tg', name: '蓝藤绞杀', element: 'grass', power: 62, maxPp: 14, kind: 'damage', description: '无数蓝藤齐发强力抽击' },
    { id: 'mega_drain_tg', name: '超级吸取', element: 'grass', power: 48, maxPp: 18, kind: 'damage', description: '缠绕吸取对手自然生命力' },
    { id: 'vine_regen', name: '再生蓝藤', element: 'grass', power: 0, maxPp: 5, kind: 'heal', description: '再生藤蔓快速恢复体力' },
    { id: 'ancient_vine', name: '太古万藤阵', element: 'grass', power: 88, maxPp: 4, kind: 'damage', description: '唤醒远古蓝藤风暴席卷全场' },
  ],
  kangaskhan: [
    { id: 'dizzy_punch', name: '迷昏拳', element: 'normal', power: 66, maxPp: 12, kind: 'damage', description: '迅猛连拳重击令对手眩晕' },
    { id: 'crunch_kg', name: '亲子合击', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '母子同心发动双重连打' },
    { id: 'mother_guard', name: '守护之姿', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '坚定守卫同伴防御大增' },
    { id: 'giga_impact_kg', name: '亲子究极冲击', element: 'normal', power: 94, maxPp: 4, kind: 'damage', description: '亲子爱全面爆发的毁灭冲撞' },
  ],
  goldeen: [
    { id: 'waterfall_gd', name: '攀瀑冲刺', element: 'water', power: 62, maxPp: 14, kind: 'damage', description: '驾驭瀑布激流猛冲撞击' },
    { id: 'horn_attack_gd', name: '钻角水刺', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '旋转玉角迅猛突刺' },
    { id: 'aqua_ring_gd', name: '水流环', element: 'water', power: 0, maxPp: 5, kind: 'heal', description: '清泉水环包裹回复体力' },
    { id: 'megahorn_gd', name: '激流钻角冲', element: 'water', power: 88, maxPp: 4, kind: 'damage', description: '激流旋涡裹挟巨角直贯对手' },
  ],
  mrmime: [
    { id: 'psychic_mm', name: '魔墙念力', element: 'psychic', power: 64, maxPp: 12, kind: 'damage', description: '挥手凝结隐形念壁挤压对手' },
    { id: 'dazzle_mm', name: '妖精舞台光', element: 'fairy', power: 52, maxPp: 16, kind: 'damage', description: '绽放璀璨聚光灯冲击' },
    { id: 'light_screen_mm', name: '双重光墙', element: 'psychic', power: 0, maxPp: 8, kind: 'buff_def', description: '张开透明魔墙大幅减伤' },
    { id: 'mime_finale', name: '幻境哑剧终章', element: 'psychic', power: 90, maxPp: 4, kind: 'damage', description: '多重魔墙共振引爆绚丽念波' },
  ],
  jynx: [
    { id: 'ice_punch_jx', name: '极寒冰舞', element: 'water', power: 66, maxPp: 12, kind: 'damage', description: '起舞释放刺骨冰晶席卷对手' },
    { id: 'psy_kiss', name: '念力咏叹', element: 'psychic', power: 52, maxPp: 16, kind: 'damage', description: '柔美歌声化作强力念波' },
    { id: 'calm_jynx', name: '冰雪凝神', element: 'psychic', power: 0, maxPp: 8, kind: 'buff_atk', description: '寒气环绕大幅提升魔力' },
    { id: 'blizzard_jynx', name: '极寒歌剧暴雪', element: 'water', power: 92, maxPp: 4, kind: 'damage', description: '冰霜与超能交织的终极暴雪' },
  ],
  pinsir: [
    { id: 'x_scissor_ps', name: '巨角十字剪', element: 'grass', power: 68, maxPp: 12, kind: 'damage', description: '双角合拢猛烈夹断对手防线' },
    { id: 'brick_break_ps', name: '劈瓦重击', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '刚猛臂力击碎一切护盾' },
    { id: 'swords_ps', name: '巨角剑舞', element: 'grass', power: 0, maxPp: 8, kind: 'buff_atk', description: '振臂咆哮攻击力暴涨' },
    { id: 'guillotine_ps', name: '断头剪极斩', element: 'grass', power: 94, maxPp: 4, kind: 'damage', description: '全力发动震撼森林的必杀夹击' },
  ],
  tauros: [
    { id: 'body_slam_tr', name: '泰山猛撞', element: 'normal', power: 68, maxPp: 12, kind: 'damage', description: '全力奔腾撞翻前方敌群' },
    { id: 'zen_headbutt_tr', name: '铁角突刺', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '低头挥角高速穿刺' },
    { id: 'work_up_tr', name: '三尾蓄势', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '甩动三尾唤醒野性战意' },
    { id: 'hyper_beam_tr', name: '初代破坏光线', element: 'normal', power: 94, maxPp: 4, kind: 'damage', description: '关都霸主标志性的终极光束' },
  ],
  ditto: [
    { id: 'transform_copy', name: '镜像模仿波', element: 'psychic', power: 62, maxPp: 14, kind: 'damage', description: '瞬间复刻对手招式全力回击' },
    { id: 'jelly_bounce', name: '软弹撞击', element: 'normal', power: 48, maxPp: 18, kind: 'damage', description: '化作弹性果冻高速弹射' },
    { id: 'cell_recover', name: '细胞重组', element: 'normal', power: 0, maxPp: 5, kind: 'heal', description: '重组身体结构快速回复 HP' },
    { id: 'prism_morph', name: '百变万象击', element: 'fairy', power: 90, maxPp: 4, kind: 'damage', description: '幻化万千强敌虚影同时猛攻' },
  ],
  vaporeon: [
    { id: 'scald_vp', name: '碧波冲击', element: 'water', power: 66, maxPp: 12, kind: 'damage', description: '舞动人鱼尾掀动清澈巨浪' },
    { id: 'aurora_vp', name: '冰水极光', element: 'water', power: 54, maxPp: 16, kind: 'damage', description: '射出晶莹寒水流光' },
    { id: 'aqua_heal_vp', name: '融水再生', element: 'water', power: 0, maxPp: 5, kind: 'heal', description: '吸收水元素回复大量 HP' },
    { id: 'hydro_vp', name: '沧海高压水炮', element: 'water', power: 92, maxPp: 4, kind: 'damage', description: '释放排山倒海的蔚蓝水柱' },
  ],
  jolteon: [
    { id: 'thunderbolt_jt', name: '疾雷十万伏', element: 'electric', power: 68, maxPp: 12, kind: 'damage', description: '瞬间闪现劈出金黄雷柱' },
    { id: 'pin_bolt', name: '雷针飞弹', element: 'electric', power: 54, maxPp: 16, kind: 'damage', description: '齐射带电金针穿透敌阵' },
    { id: 'volt_charge_jt', name: '蓄电提速', element: 'electric', power: 0, maxPp: 8, kind: 'buff_atk', description: '全身电流疾走攻击暴涨' },
    { id: 'thunder_jt', name: '迅雷天降', element: 'electric', power: 94, maxPp: 4, kind: 'damage', description: '召唤密集闪电风暴瞬间清场' },
  ],
  flareon: [
    { id: 'flare_blitz_fl', name: '赤焰猛冲', element: 'fire', power: 68, maxPp: 12, kind: 'damage', description: '周身燃起金红烈焰全力冲锋' },
    { id: 'lava_fang_fl', name: '火焰牙', element: 'fire', power: 54, maxPp: 16, kind: 'damage', description: '炽热火牙猛烈咬击对手' },
    { id: 'flame_warm_fl', name: '引火蓄焰', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '炎袋沸腾大幅提升火威' },
    { id: 'overheat_fl', name: '过热红莲爆', element: 'fire', power: 94, maxPp: 4, kind: 'damage', description: '倾尽千度烈焰绽放炽热火海' },
  ],
  omanyte: [
    { id: 'ancient_water', name: '远古岩潮', element: 'water', power: 66, maxPp: 12, kind: 'damage', description: '召唤太古海浪与岩弹齐射' },
    { id: 'brine_om', name: '螺旋水枪', element: 'water', power: 52, maxPp: 16, kind: 'damage', description: '螺旋外壳喷出高压水流' },
    { id: 'shell_smash_om', name: '螺旋破壳', element: 'water', power: 0, maxPp: 8, kind: 'buff_atk', description: '释放远古神力攻击暴涨' },
    { id: 'hydro_helix', name: '螺旋神谕水炮', element: 'water', power: 92, maxPp: 4, kind: 'damage', description: '远古巨浪席卷整片海岸' },
  ],
  kabuto: [
    { id: 'razor_shell_kb', name: '双镰水斩', element: 'water', power: 66, maxPp: 12, kind: 'damage', description: '以锋利海镰交叉斩裂对手' },
    { id: 'rock_slash_kb', name: '岩刃突刺', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '高速潜行挥出锐利石刃' },
    { id: 'swords_kb', name: '太古镰舞', element: 'water', power: 0, maxPp: 8, kind: 'buff_atk', description: '磨砺双镰战意飙升' },
    { id: 'stone_aqua_kb', name: '太古水镰风暴', element: 'water', power: 92, maxPp: 4, kind: 'damage', description: '掀起怒涛与岩刃的终极斩击' },
  ],
  hooh: [
    { id: 'sacred_fire', name: '神圣之火', element: 'fire', power: 76, maxPp: 10, kind: 'damage', description: '降下七彩圣炎净化敌阵' },
    { id: 'sky_phoenix', name: '虹翼掠空', element: 'fire', power: 60, maxPp: 15, kind: 'damage', description: '挥动七彩羽翼高速俯冲' },
    { id: 'recover_hooh', name: '凤凰涅槃', element: 'fire', power: 0, maxPp: 5, kind: 'heal', description: '沐浴七彩圣光回复大量 HP' },
    { id: 'phoenix_nova', name: '七彩凤凰天翔', element: 'fire', power: 102, maxPp: 4, kind: 'damage', description: '传说神鸟展翼释放炽热虹焰风暴' },
  ],
  spinda: [
    { id: 'dizzy_punch', name: '迷昏醉拳', element: 'normal', power: 54, maxPp: 15, kind: 'damage', description: '摇摇晃晃打出出其不意的醉拳' },
    { id: 'teeter_step', name: '晃晃步法', element: 'normal', power: 44, maxPp: 20, kind: 'damage', description: '令人眼花缭乱的连续拍击' },
    { id: 'calm_spin', name: '转圈蓄力', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '越转越精神，攻击力提升' },
    { id: 'panda_whirl', name: '醉影旋风踢', element: 'normal', power: 78, maxPp: 5, kind: 'damage', description: '化作高速旋风连续撞击' },
  ],
  chimchar: [
    { id: 'flame_wheel_ch', name: '火焰轮', element: 'fire', power: 64, maxPp: 12, kind: 'damage', description: '化作金色火轮高速滚冲' },
    { id: 'mach_punch_ch', name: '音速猴拳', element: 'normal', power: 52, maxPp: 18, kind: 'damage', description: '快如闪电的先制连环拳' },
    { id: 'monkey_dance', name: '大圣斗志', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '头顶金焰暴涨，大幅提升攻击' },
    { id: 'flare_monkey', name: '齐天闪焰冲锋', element: 'fire', power: 94, maxPp: 4, kind: 'damage', description: '身披烈火金箍轰出毁天灭地的一击' },
  ],
  bronzor: [
    { id: 'extrasensory_br', name: '神通念波', element: 'psychic', power: 64, maxPp: 12, kind: 'damage', description: '古镜折射出强力超能光波' },
    { id: 'gyro_bell', name: '青铜回旋', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '厚重青铜机身旋转撞击' },
    { id: 'iron_bell_def', name: '编钟护体', element: 'psychic', power: 0, maxPp: 8, kind: 'buff_def', description: '鸣响古钟大幅强化防御' },
    { id: 'ancient_chime', name: '太古编钟镇魂', element: 'psychic', power: 90, maxPp: 4, kind: 'damage', description: '悠远钟声引动时空念力重压' },
  ],
  tepig: [
    { id: 'heat_crash_tp', name: '高温重压', element: 'fire', power: 66, maxPp: 12, kind: 'damage', description: '炽热战甲跃起全力泰山压顶' },
    { id: 'arm_thrust_tp', name: '猛推铁掌', element: 'normal', power: 52, maxPp: 18, kind: 'damage', description: '威猛双掌连续击退敌人' },
    { id: 'warrior_roar', name: '炎武战吼', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '燃起胡须烈焰，攻击大幅提升' },
    { id: 'blast_emboar', name: '霸王炎武爆', element: 'fire', power: 94, maxPp: 4, kind: 'damage', description: '双拳燃爆赤红火浪横扫千军' },
  ],
  mienfoo: [
    { id: 'aura_palm', name: '波导流水掌', element: 'normal', power: 64, maxPp: 12, kind: 'damage', description: '行云流水般挥出劲气掌风' },
    { id: 'sleeve_whip', name: '长袖连打', element: 'normal', power: 52, maxPp: 18, kind: 'damage', description: '飘逸水袖如长鞭连环抽击' },
    { id: 'meditate_mf', name: '吐纳调息', element: 'normal', power: 0, maxPp: 6, kind: 'heal', description: '运功调息回复自身体力' },
    { id: 'high_jump_mf', name: '飞燕回旋踢', element: 'normal', power: 92, maxPp: 4, kind: 'damage', description: '腾空施展凌厉宗师级绝杀踢' },
  ],
  pancham: [
    { id: 'bamboo_chop', name: '竹影手刀', element: 'normal', power: 64, maxPp: 12, kind: 'damage', description: '嘴叼竹叶劈出刚猛功夫手刀' },
    { id: 'panda_throw', name: '熊猫过肩摔', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '沉稳下盘发力震飞对手' },
    { id: 'bamboo_stance', name: '扎马蓄劲', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '摆出功夫架势大幅提升攻击' },
    { id: 'pangoro_hammer', name: '霸道重臂锤', element: 'normal', power: 94, maxPp: 4, kind: 'damage', description: '雷霆万钧的宗师级双拳轰击' },
  ],
  drampa: [
    { id: 'dragon_breath_dp', name: '祥云龙息', element: 'dragon', power: 68, maxPp: 12, kind: 'damage', description: '喷吐碧翠祥云龙息横扫前方' },
    { id: 'cloud_pulse', name: '云海波动', element: 'normal', power: 54, maxPp: 16, kind: 'damage', description: '长须轻拂掀起柔和却强力的气浪' },
    { id: 'elder_calm', name: '古龙护佑', element: 'dragon', power: 0, maxPp: 6, kind: 'heal', description: '以仁慈古龙之力回复体力' },
    { id: 'draco_elder', name: '东方青龙怒', element: 'dragon', power: 96, maxPp: 4, kind: 'damage', description: '守护伙伴之怒唤醒震天龙星群' },
  ],
  kubfu: [
    { id: 'wicked_strike', name: '暗冥破空拳', element: 'normal', power: 72, maxPp: 10, kind: 'damage', description: '双拳塔秘传一击必杀重拳' },
    { id: 'surging_combo', name: '水流连打', element: 'water', power: 62, maxPp: 14, kind: 'damage', description: '如疾风骤雨般的连击流拳法' },
    { id: 'master_focus', name: '宗师聚气', element: 'normal', power: 0, maxPp: 8, kind: 'buff_atk', description: '凝神聚气进入无我宗师境' },
    { id: 'urshifu_finisher', name: '双拳塔终极奥义', element: 'normal', power: 100, maxPp: 4, kind: 'damage', description: '融合刚柔两派绝学的传奇终结技' },
  ],
  wochien: [
    { id: 'ruin_vine', name: '古简藤蔓', element: 'grass', power: 72, maxPp: 10, kind: 'damage', description: '竹简绽放墨绿古藤缠绕重击' },
    { id: 'tablet_drain', name: '吸取古韵', element: 'grass', power: 56, maxPp: 14, kind: 'damage', description: '汲取大地草木灵气冲击对手' },
    { id: 'tablet_ruin', name: '灾祸之简', element: 'grass', power: 0, maxPp: 6, kind: 'heal', description: '以千年竹简灵力自我修复' },
    { id: 'ruination_wc', name: '大灾难·古简破', element: 'grass', power: 98, maxPp: 4, kind: 'damage', description: '释放尘封千年的东方灾兽草系秘力' },
  ],
  chienpao: [
    { id: 'icicle_sword', name: '古剑冰柱坠', element: 'water', power: 74, maxPp: 10, kind: 'damage', description: '以青铜断剑化作霜刃瞬间斩击' },
    { id: 'snow_slash', name: '雪豹疾袭', element: 'water', power: 58, maxPp: 15, kind: 'damage', description: '如暴雪幻影般极速穿梭劈砍' },
    { id: 'sword_of_ruin', name: '灾祸之剑', element: 'water', power: 0, maxPp: 8, kind: 'buff_atk', description: '双剑寒芒大盛，攻击力飙升' },
    { id: 'ruination_cp', name: '大灾难·断剑冰暴', element: 'water', power: 100, maxPp: 4, kind: 'damage', description: '卷起百米霜剑暴雪席卷全场' },
  ],
  tinglu: [
    { id: 'vessel_quake', name: '古鼎裂地', element: 'normal', power: 74, maxPp: 10, kind: 'damage', description: '以商周青铜鼎之重震撼大地' },
    { id: 'bronze_ram', name: '青铜重撞', element: 'normal', power: 58, maxPp: 15, kind: 'damage', description: '低头挥动巨鼎角猛力冲撞' },
    { id: 'vessel_of_ruin', name: '灾祸之鼎', element: 'normal', power: 0, maxPp: 8, kind: 'buff_def', description: '青铜巨鼎镇守，防御坚不可摧' },
    { id: 'ruination_tl', name: '大灾难·山河震鼎', element: 'normal', power: 100, maxPp: 4, kind: 'damage', description: '引发裂谷级大地冲击波震碎防线' },
  ],
  chiyu: [
    { id: 'jade_flames', name: '古玉幽炎', element: 'fire', power: 76, maxPp: 10, kind: 'damage', description: '勾玉燃起三千度赤金流火灼烧' },
    { id: 'ember_swim', name: '火鱼游焰', element: 'fire', power: 58, maxPp: 15, kind: 'damage', description: '灵巧游弋洒出漫天火花弹幕' },
    { id: 'beads_of_ruin', name: '灾祸之玉', element: 'fire', power: 0, maxPp: 8, kind: 'buff_atk', description: '四枚古玉共鸣，火系特攻暴涨' },
    { id: 'ruination_cy', name: '大灾难·焚玉熔海', element: 'fire', power: 102, maxPp: 4, kind: 'damage', description: '化身耀眼火玉锦鲤引爆炽热熔岩海' },
  ],
};

export function getSpeciesMoves(species: SpeciesId): BattleMove[] {
  return SPECIES_MOVES[species] ?? SPECIES_MOVES.pikachu;
}

export function computeBattleStats(pet: PetRecord): BattleStats {
  const meta = SPECIES_CATALOG[pet.species];
  const stage = getGrowthStage(pet.level, pet.species);
  const ivs = getPetIVs(pet);
  const nature = getPetNature(pet);
  const talent = getPetTalent(pet);

  const stageBonus = stage === 'adult' ? 1.24 : stage === 'teen' ? 1.12 : 1.0;
  const rarityBase = meta.rarity === 'SSR' ? 1.14 : meta.rarity === 'SR' ? 1.06 : 1.0;
  const lv = pet.level;

  let maxHp = Math.round((36 + lv * 3.8 + ivs.def * 0.45) * stageBonus * rarityBase);
  let atk = Math.round((14 + lv * 1.9 + ivs.atk * 0.55) * stageBonus * rarityBase);
  let def = Math.round((12 + lv * 1.6 + ivs.def * 0.5) * stageBonus * rarityBase);
  let spd = Math.round((12 + lv * 1.6 + ivs.spd * 0.55) * stageBonus * rarityBase);

  // Nature modifiers
  if (nature === 'adamant' || nature === 'naughty') atk = Math.round(atk * 1.1);
  if (nature === 'jolly' || nature === 'timid') spd = Math.round(spd * 1.1);
  if (nature === 'relaxed' || nature === 'serious') def = Math.round(def * 1.1);
  if (nature === 'gentle' || nature === 'naive') maxHp = Math.round(maxHp * 1.08);

  // Talent modifiers
  if (talent === 'tough') {
    maxHp = Math.round(maxHp * 1.12);
    def = Math.round(def * 1.08);
  } else if (talent === 'shiny_soul') {
    atk = Math.round(atk * 1.06);
    def = Math.round(def * 1.06);
    spd = Math.round(spd * 1.06);
  }

  // Held Item modifiers
  if (pet.accessory === 'scarf' || pet.accessory === 'quick_claw') spd = Math.round(spd * 1.15);
  if (pet.accessory === 'focus_band' || pet.accessory === 'crown') def = Math.round(def * 1.12);
  if (pet.accessory === 'life_orb') atk = Math.round(atk * 1.18);

  return { maxHp, atk, def, spd };
}

export function getHeldItemDamageBoost(
  pet: PetRecord,
  moveElement: PokemonElement,
): number {
  if (pet.accessory === 'charcoal' && moveElement === 'fire') return 1.18;
  if (pet.accessory === 'mystic_water' && moveElement === 'water') return 1.18;
  if (pet.accessory === 'magnet' && moveElement === 'electric') return 1.18;
  if (pet.accessory === 'sprout' && moveElement === 'grass') return 1.18;
  if (pet.accessory === 'silk_scarf' && moveElement === 'normal') return 1.18;
  if (pet.accessory === 'shades' && moveElement === 'ghost') return 1.18;
  if (pet.accessory === 'life_orb') return 1.22;
  return 1.0;
}

interface TrainerProfile {
  title: string;
  sprite: string;
  roster: SpeciesId[];
}

const TRAINER_PROFILES: TrainerProfile[] = [
  { title: '劲敌 小茂', sprite: '/sprites/trainers/blue.png', roster: ['pidgey', 'abra', 'growlithe', 'rhyhorn', 'magikarp', 'eevee', 'dratini'] },
  { title: '尼比道馆 小刚', sprite: '/sprites/trainers/brock.png', roster: ['geodude', 'onix', 'rhyhorn', 'sandshrew'] },
  { title: '华蓝道馆 小霞', sprite: '/sprites/trainers/misty.png', roster: ['staryu', 'psyduck', 'squirtle', 'horsea', 'poliwag'] },
  { title: '枯叶道馆 马志士', sprite: '/sprites/trainers/ltsurge.png', roster: ['pikachu', 'magnemite', 'electabuzz'] },
  { title: '玉虹道馆 莉佳', sprite: '/sprites/trainers/erika.png', roster: ['oddish', 'bulbasaur', 'caterpie', 'scyther'] },
  { title: '短裤小子 小明', sprite: '/sprites/trainers/youngster.png', roster: ['weedle', 'pidgey', 'diglett', 'meowth', 'machop'] },
  { title: '迷你裙 芽衣', sprite: '/sprites/trainers/lass.png', roster: ['clefairy', 'jigglypuff', 'vulpix', 'chansey', 'eevee'] },
];

const WILD_POOL: SpeciesId[] = [
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
  'dratini',
  'rattata',
  'spearow',
  'ekans',
  'nidoranf',
  'zubat',
  'paras',
  'venonat',
  'mankey',
  'bellsprout',
  'tentacool',
  'farfetchd',
  'doduo',
  'seel',
  'grimer',
  'drowzee',
  'krabby',
  'voltorb',
  'exeggcute',
  'hitmonlee',
  'hitmonchan',
  'lickitung',
  'koffing',
  'tangela',
  'kangaskhan',
  'goldeen',
  'mrmime',
  'jynx',
  'pinsir',
  'tauros',
  'ditto',
  'vaporeon',
  'jolteon',
  'flareon',
  'omanyte',
  'kabuto',
  'spinda',
  'chimchar',
  'bronzor',
  'tepig',
  'mienfoo',
  'pancham',
  'drampa',
  'kubfu',
];

export function generateWildOpponent(
  playerLevel: number,
  isTrainer: boolean,
): WildEnemy {
  const trainer = isTrainer
    ? TRAINER_PROFILES[Math.floor(Math.random() * TRAINER_PROFILES.length)]
    : null;
  const species = trainer
    ? trainer.roster[Math.floor(Math.random() * trainer.roster.length)]
    : WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)];
  const lvOffset = isTrainer
    ? Math.floor(Math.random() * 3) // +0..+2
    : Math.floor(Math.random() * 3) - 1; // -1..+1
  const level = Math.max(3, Math.min(99, playerLevel + lvOffset));
  const stage = getGrowthStage(level, species);
  const stageScale = stage === 'adult' ? 1.2 : stage === 'teen' ? 1.1 : 1.0;
  const trainerScale = isTrainer ? 1.08 : 0.94;

  const maxHp = Math.round((34 + level * 3.6) * stageScale * trainerScale);
  const atk = Math.round((13 + level * 1.75) * stageScale * trainerScale);
  const def = Math.round((12 + level * 1.5) * stageScale * trainerScale);
  const spd = Math.round((11 + level * 1.55) * stageScale * trainerScale);

  return {
    species,
    level,
    isTrainer,
    trainerTitle: trainer?.title,
    trainerSprite: trainer?.sprite,
    maxHp,
    hp: maxHp,
    atk,
    def,
    spd,
    moves: getSpeciesMoves(species),
  };
}
