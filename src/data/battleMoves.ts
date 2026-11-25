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
  { title: '劲敌 小茂', sprite: '/sprites/trainers/blue.png', roster: ['eevee', 'charmander', 'squirtle', 'dratini'] },
  { title: '尼比道馆 小刚', sprite: '/sprites/trainers/brock.png', roster: ['munchlax', 'charmander', 'bulbasaur'] },
  { title: '华蓝道馆 小霞', sprite: '/sprites/trainers/misty.png', roster: ['psyduck', 'squirtle'] },
  { title: '枯叶道馆 马志士', sprite: '/sprites/trainers/ltsurge.png', roster: ['pikachu', 'meowth'] },
  { title: '玉虹道馆 莉佳', sprite: '/sprites/trainers/erika.png', roster: ['bulbasaur', 'jigglypuff', 'eevee'] },
  { title: '短裤小子 小明', sprite: '/sprites/trainers/youngster.png', roster: ['meowth', 'pikachu', 'gastly'] },
  { title: '迷你裙 芽衣', sprite: '/sprites/trainers/lass.png', roster: ['jigglypuff', 'eevee', 'mew'] },
];

const WILD_POOL: SpeciesId[] = [
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
