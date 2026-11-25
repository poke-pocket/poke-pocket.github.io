import React, { useEffect, useRef, useState } from 'react';
import { computeBattleStats } from '../data/battleMoves';
import {
  ROOM_CATALOG,
  SPECIES_CATALOG,
  getGrowthStage,
  getPokemonCryId,
} from '../data/catalog';
import {
  drawOakTree,
  drawOverworldChar,
  drawPokeCenterBuilding,
  drawPokeMartBuilding,
  drawTallGrass,
  drawWildflowers,
  type FacingDir,
} from '../data/overworldTiles';
import type { GameSave, PetRecord, PokemonElement, SpeciesId } from '../types/pet';
import type { SurvivorsResultPayload } from '../utils/petEngine';
import { sound } from '../utils/sound';
import { PixelItemImg } from './PixelSprite';

interface VampireSurvivorsArenaProps {
  save: GameSave;
  pet: PetRecord;
  analogVecRef: React.MutableRefObject<{ x: number; y: number }>;
  onFinish: (petId: string, payload: SurvivorsResultPayload, returnToRoom?: boolean) => void;
  onHealParty: () => void;
  onSpendCoinsInRun: (cost: number) => boolean;
  onOpenMenu: () => void;
}

type PassiveUpgradeId = 'speed' | 'heal' | 'greed' | 'atk_up';

interface MinionEntity {
  id: string;
  species: SpeciesId;
  name: string;
  element: PokemonElement;
  skillName: string;
  level: number;
  x: number;
  y: number;
  cd: number;
  orbitAngle: number;
  facingLeft: boolean;
  spriteKey: string;
}

interface EnemyEntity {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  species: SpeciesId;
  isBoss: boolean;
  isTrainer: boolean;
  trainerSprite?: string;
  trainerName?: string;
  shootCd: number;
  hitFlash: number;
  dmg: number;
}

interface BulletEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  color: string;
  core: string;
  radius: number;
  pierce: number;
  life: number;
  fromEnemy?: boolean;
}

interface GemEntity {
  x: number;
  y: number;
  kind: 'xp' | 'coin' | 'berry' | 'magnet';
  value: number;
}

interface VfxEntity {
  kind: 'lightning' | 'wave' | 'burst' | 'dmg' | 'heal';
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius?: number;
  text?: string;
  color: string;
}

interface SafeZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  healCooldown: number;
}

interface LevelChoice {
  kind: 'summon' | 'upgrade_minion' | 'passive';
  id: string;
  title: string;
  desc: string;
  sprite: string;
  badge: string;
  color: string;
  species?: SpeciesId;
  minionId?: string;
  passiveId?: PassiveUpgradeId;
}

const VIEW_W = 462;
const VIEW_H = 380;
const SAFE_ZONE_RADIUS = 112;
const SECTOR_SIZE = 740;
const MAX_MINIONS = 6;

const WILD_ENEMY_SPECIES: SpeciesId[] = [
  'meowth',
  'gastly',
  'psyduck',
  'bulbasaur',
  'charmander',
  'eevee',
  'jigglypuff',
];

const SUMMON_CANDIDATES: {
  species: SpeciesId;
  name: string;
  skill: string;
  color: string;
}[] = [
  { species: 'pikachu', name: '皮卡丘', skill: '十万伏特 · 天降连锁落雷', color: '#f5b700' },
  { species: 'charmander', name: '小火龙', skill: '追踪火球 · 齐射穿透烈焰', color: '#ff5924' },
  { species: 'bulbasaur', name: '妙蛙种子', skill: '飞叶护盾 · 环绕高速切割', color: '#40c057' },
  { species: 'squirtle', name: '杰尼龟', skill: '水之波动 · 360°击退水环', color: '#339af0' },
  { species: 'gastly', name: '鬼斯', skill: '暗影星芒 · 多向穿透弹幕', color: '#ae3ec9' },
  { species: 'eevee', name: '伊布', skill: '高速星星 · 双发连射星弹', color: '#e67700' },
  { species: 'dratini', name: '迷你龙', skill: '龙之波动 · 高伤重炮击退', color: '#5c7cfa' },
  { species: 'jigglypuff', name: '胖丁', skill: '魅惑之声 · 广域震荡星波', color: '#f06595' },
];

const ENEMY_TRAINERS: {
  key: string;
  name: string;
  sprite: string;
  guardSpecies: SpeciesId;
}[] = [
  { key: 'tr_youngster', name: '短裤小子', sprite: '/sprites/trainers/youngster.png', guardSpecies: 'meowth' },
  { key: 'tr_lass', name: '迷你裙少女', sprite: '/sprites/trainers/lass.png', guardSpecies: 'jigglypuff' },
  { key: 'tr_brock', name: '馆主 小刚', sprite: '/sprites/trainers/brock.png', guardSpecies: 'munchlax' },
  { key: 'tr_misty', name: '馆主 小霞', sprite: '/sprites/trainers/misty.png', guardSpecies: 'psyduck' },
  { key: 'tr_blue', name: '劲敌 小茂', sprite: '/sprites/trainers/blue.png', guardSpecies: 'eevee' },
  { key: 'tr_ltsurge', name: '馆主 马志士', sprite: '/sprites/trainers/ltsurge.png', guardSpecies: 'pikachu' },
  { key: 'tr_erika', name: '馆主 莉佳', sprite: '/sprites/trainers/erika.png', guardSpecies: 'bulbasaur' },
];

function getSkillMeta(element: PokemonElement): { name: string; color: string } {
  switch (element) {
    case 'electric':
      return { name: '十万伏特', color: '#f5b700' };
    case 'fire':
      return { name: '喷射火球', color: '#ff5924' };
    case 'grass':
      return { name: '环绕飞叶', color: '#40c057' };
    case 'water':
      return { name: '水之波动', color: '#339af0' };
    case 'ghost':
    case 'psychic':
    case 'fairy':
      return { name: '暗影星芒', color: '#ae3ec9' };
    default:
      return { name: '高速星星', color: '#ff922b' };
  }
}

/** Deterministic roadside Safe Zones placed on a repeating Kanto sector grid */
export function getSafeZoneForSector(sx: number, sy: number): SafeZone {
  // Sector (0,0) has a welcoming Safe Zone nearby NE at (260, -145) so players discover it quickly!
  if (sx === 0 && sy === 0) {
    return { id: 'sz_0_0', x: 260, y: -145, radius: SAFE_ZONE_RADIUS, healCooldown: 0 };
  }
  const hash = Math.abs(sx * 92821 + sy * 68917);
  const ox = ((hash % 240) - 120);
  const oy = (((hash >> 4) % 240) - 120);
  return {
    id: `sz_${sx}_${sy}`,
    x: sx * SECTOR_SIZE + ox,
    y: sy * SECTOR_SIZE + oy,
    radius: SAFE_ZONE_RADIUS,
    healCooldown: 0,
  };
}

export function getNearbySafeZones(px: number, py: number): SafeZone[] {
  const csx = Math.round(px / SECTOR_SIZE);
  const csy = Math.round(py / SECTOR_SIZE);
  const list: SafeZone[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      list.push(getSafeZoneForSector(csx + dx, csy + dy));
    }
  }
  return list;
}

export const VampireSurvivorsArena: React.FC<VampireSurvivorsArenaProps> = ({
  save,
  pet,
  analogVecRef,
  onFinish,
  onHealParty,
  onSpendCoinsInRun,
  onOpenMenu,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState({
    hp: 120,
    maxHp: 120,
    xp: 0,
    xpNeed: 18,
    runLevel: 1,
    kills: 0,
    coins: 0,
    elapsedSec: 0,
    inSafeZone: false,
    nearestZoneDir: { angle: 0, distM: 25 },
  });
  const [minionsView, setMinionsView] = useState<
    { id: string; species: SpeciesId; name: string; level: number; sprite: string }[]
  >([]);
  const [levelChoices, setLevelChoices] = useState<LevelChoice[] | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(
    '野外冒险开始！召唤宝可梦随从迎击野生群与敌方训练师，右上方向有安全区！',
  );
  const [resultModal, setResultModal] = useState<SurvivorsResultPayload | null>(null);

  const pausedRef = useRef(false);
  const endedRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const pointerRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: VIEW_W / 2,
    y: VIEW_H / 2,
  });
  const clickTargetRef = useRef<{ x: number; y: number } | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

  const showBanner = (msg: string, duration = 2600) => {
    setBannerMsg(msg);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setBannerMsg(null), duration);
  };

  // Preload crisp static PNG sprites for minions, wild enemies, & official enemy trainers!
  const spriteImgsRef = useRef<Record<string, HTMLImageElement>>({});

  const ensureSpeciesSprite = (species: SpeciesId, stage: 'baby' | 'teen' | 'adult' = 'baby'): string => {
    const key = `${species}_${stage}`;
    if (!spriteImgsRef.current[key]) {
      const img = new Image();
      img.src = SPECIES_CATALOG[species].stageSprites[stage].static;
      spriteImgsRef.current[key] = img;
    }
    return key;
  };

  useEffect(() => {
    const activeStage = getGrowthStage(pet.level, pet.species);
    ensureSpeciesSprite(pet.species, activeStage);
    for (const p of save.pets) {
      ensureSpeciesSprite(p.species, getGrowthStage(p.level, p.species));
    }
    for (const sp of WILD_ENEMY_SPECIES) {
      ensureSpeciesSprite(sp, 'baby');
    }
    for (const c of SUMMON_CANDIDATES) {
      ensureSpeciesSprite(c.species, 'baby');
    }
    ensureSpeciesSprite('dratini', 'adult');
    ensureSpeciesSprite('munchlax', 'adult');
    for (const tr of ENEMY_TRAINERS) {
      const img = new Image();
      img.src = tr.sprite;
      spriteImgsRef.current[tr.key] = img;
    }
    const nurse = new Image();
    nurse.src = '/sprites/trainers/nurse.png';
    spriteImgsRef.current.nurse = nurse;

    sound.playCry(getPokemonCryId(pet.species, pet.level));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.species, pet.level]);

  // Mutable 60fps simulation state
  const stateRef = useRef<{
    px: number;
    py: number;
    facing: FacingDir;
    stepDist: number;
    stepPhase: number;
    animTick: number;
    hp: number;
    maxHp: number;
    invuln: number;
    xp: number;
    xpNeed: number;
    runLevel: number;
    kills: number;
    coins: number;
    elapsed: number;
    speedMult: number;
    pickupRadius: number;
    cdMult: number;
    atkMult: number;
    greedMult: number;
    baseAtk: number;
    minions: MinionEntity[];
    timers: {
      spawn: number;
      trainer: number;
      regen: number;
      hudSync: number;
      safeHealCd: number;
    };
    trainerWaveIdx: number;
    bossSpawned: boolean;
    nextId: number;
    enemies: EnemyEntity[];
    bullets: BulletEntity[];
    gems: GemEntity[];
    vfxs: VfxEntity[];
  } | null>(null);

  const syncMinionsView = () => {
    const st = stateRef.current;
    if (!st) return;
    setMinionsView(
      st.minions.map((m) => ({
        id: m.id,
        species: m.species,
        name: m.name,
        level: m.level,
        sprite: SPECIES_CATALOG[m.species].stageSprites[
          (m.spriteKey.split('_')[1] as 'baby' | 'teen' | 'adult') || 'baby'
        ].static,
      })),
    );
  };

  // Initialize run state (Trainer Red + Lead Pet summoned as first Minion!)
  useEffect(() => {
    const stats = computeBattleStats(pet);
    const maxHp = Math.max(110, Math.round(stats.maxHp * 1.55));
    const startHp = Math.max(45, Math.round((pet.health / 100) * maxHp));
    const leadStage = getGrowthStage(pet.level, pet.species);
    const leadSpriteKey = ensureSpeciesSprite(pet.species, leadStage);
    const leadMeta = SPECIES_CATALOG[pet.species];
    const skillMeta = getSkillMeta(leadMeta.element);

    const initialMinions: MinionEntity[] = [
      {
        id: `min_lead_${pet.id}`,
        species: pet.species,
        name: pet.name,
        element: leadMeta.element,
        skillName: skillMeta.name,
        level: 1,
        x: -26,
        y: 8,
        cd: 0.25,
        orbitAngle: 0,
        facingLeft: false,
        spriteKey: leadSpriteKey,
      },
    ];

    stateRef.current = {
      px: 0,
      py: 0,
      facing: 'down',
      stepDist: 0,
      stepPhase: 0,
      animTick: 0,
      hp: startHp,
      maxHp,
      invuln: 0,
      xp: 0,
      xpNeed: 16,
      runLevel: 1,
      kills: 0,
      coins: 0,
      elapsed: 0,
      speedMult: pet.accessory === 'scarf' || pet.accessory === 'quick_claw' ? 1.15 : 1.0,
      pickupRadius: 62,
      cdMult: 1.0,
      atkMult: pet.accessory === 'life_orb' ? 1.25 : 1.0,
      greedMult: pet.accessory === 'amulet_coin' ? 1.35 : 1.0,
      baseAtk: stats.atk,
      minions: initialMinions,
      timers: {
        spawn: 0.45,
        trainer: 18,
        regen: 2.5,
        hudSync: 0,
        safeHealCd: 0,
      },
      trainerWaveIdx: 0,
      bossSpawned: false,
      nextId: 1,
      enemies: [],
      bullets: [],
      gems: [],
      vfxs: [],
    };
    endedRef.current = false;
    pausedRef.current = false;
    syncMinionsView();
    setHud({
      hp: startHp,
      maxHp,
      xp: 0,
      xpNeed: 16,
      runLevel: 1,
      kills: 0,
      coins: 0,
      elapsedSec: 0,
      inSafeZone: false,
      nearestZoneDir: { angle: Math.atan2(-145, 260), distM: 30 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.id]);

  useEffect(() => {
    // Switch BGM dynamically when stepping in/out of Roadside Safe Zones!
    sound.setTrack(hud.inSafeZone ? 'safezone' : 'adventure');
  }, [hud.inSafeZone]);

  // Continuous 360° Keyboard Listener (supports simultaneous diagonal keys like W+D!)
  useEffect(() => {
    const kb = save.keyBindings;
    const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const down = (e: KeyboardEvent) => {
      const k = norm(e.key);
      if (
        k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' ||
        k === 'w' || k === 'a' || k === 's' || k === 'd' ||
        (kb && [norm(kb.up), norm(kb.down), norm(kb.left), norm(kb.right)].includes(k))
      ) {
        e.preventDefault();
        keysRef.current.add(k);
        clickTargetRef.current = null;
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(norm(e.key));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [save.keyBindings]);

  const summonMinion = (species: SpeciesId, customName?: string, stage: 'baby' | 'teen' | 'adult' = 'baby') => {
    const st = stateRef.current;
    if (!st || st.minions.length >= MAX_MINIONS) return false;
    const spMeta = SPECIES_CATALOG[species];
    const skillMeta = getSkillMeta(spMeta.element);
    const spriteKey = ensureSpeciesSprite(species, stage);
    const ang = (st.minions.length * Math.PI * 2) / Math.max(1, st.minions.length + 1);
    st.minions.push({
      id: `min_${Date.now()}_${st.nextId++}`,
      species,
      name: customName ?? spMeta.defaultName,
      element: spMeta.element,
      skillName: skillMeta.name,
      level: 1,
      x: st.px + Math.cos(ang) * 34,
      y: st.py + Math.sin(ang) * 34,
      cd: 0.3,
      orbitAngle: ang,
      facingLeft: false,
      spriteKey,
    });
    sound.playCry(getPokemonCryId(species, stage === 'adult' ? 20 : stage === 'teen' ? 10 : 5));
    syncMinionsView();
    return true;
  };

  const buildLevelChoices = (): LevelChoice[] => {
    const st = stateRef.current;
    if (!st) return [];
    const pool: LevelChoice[] = [];

    // 1. Summon new minion (prioritize user's other owned box pets first, then Kanto partners!)
    if (st.minions.length < MAX_MINIONS) {
      const ownedUnused = save.pets.filter(
        (p) => !st.minions.some((m) => m.name === p.name && m.species === p.species),
      );
      if (ownedUnused.length > 0) {
        const pick = ownedUnused[Math.floor(Math.random() * ownedUnused.length)];
        const spMeta = SPECIES_CATALOG[pick.species];
        const skill = getSkillMeta(spMeta.element);
        const stage = getGrowthStage(pick.level, pick.species);
        pool.push({
          kind: 'summon',
          id: `summon_box_${pick.id}`,
          title: `召唤伙伴·${pick.name}`,
          desc: `从精灵球盒出战！自动释放【${skill.name}】`,
          sprite: spMeta.stageSprites[stage].static,
          badge: '新随从!',
          color: skill.color,
          species: pick.species,
        });
      }
      const unownedCandidates = SUMMON_CANDIDATES.filter(
        (c) => !st.minions.some((m) => m.species === c.species),
      );
      const cand =
        unownedCandidates[Math.floor(Math.random() * unownedCandidates.length)] ??
        SUMMON_CANDIDATES[Math.floor(Math.random() * SUMMON_CANDIDATES.length)];
      pool.push({
        kind: 'summon',
        id: `summon_${cand.species}`,
        title: `召唤随从·${cand.name}`,
        desc: cand.skill,
        sprite: SPECIES_CATALOG[cand.species].stageSprites.baby.static,
        badge: '召唤!',
        color: cand.color,
        species: cand.species,
      });
    }

    // 2. Upgrade existing summoned minions
    for (const m of st.minions) {
      const skill = getSkillMeta(m.element);
      const stage = (m.spriteKey.split('_')[1] as 'baby' | 'teen' | 'adult') || 'baby';
      pool.push({
        kind: 'upgrade_minion',
        id: `up_${m.id}`,
        title: `${m.name} · ${m.skillName}`,
        desc: '随从招式伤害与弹幕数量提升，释放冷却更短',
        sprite: SPECIES_CATALOG[m.species].stageSprites[stage].static,
        badge: `Lv.${m.level} → ${m.level + 1}`,
        color: skill.color,
        minionId: m.id,
      });
    }

    // 3. Trainer passive upgrades
    pool.push(
      {
        kind: 'passive',
        id: 'p_speed',
        title: '迅捷之靴',
        desc: '主角移速 +15% · 经验与金币磁力范围 +32%',
        sprite: '/sprites/items/choice-scarf.png',
        badge: '被动',
        color: '#22b8cf',
        passiveId: 'speed',
      },
      {
        kind: 'passive',
        id: 'p_heal',
        title: '元气树果',
        desc: '主角最大 HP +22% 并立刻回复 45% 血量',
        sprite: '/sprites/items/sitrus-berry.png',
        badge: '恢复',
        color: '#51cf66',
        passiveId: 'heal',
      },
      {
        kind: 'passive',
        id: 'p_greed',
        title: '护符加速',
        desc: '全随从技能冷却 -12% · 金币掉落 +35%',
        sprite: '/sprites/items/amulet-coin.png',
        badge: '增益',
        color: '#fab005',
        passiveId: 'greed',
      },
      {
        kind: 'passive',
        id: 'p_atk',
        title: '力量头带',
        desc: '全队宝可梦随从攻击威力永久 +22%',
        sprite: '/sprites/items/life-orb.png',
        badge: '强攻',
        color: '#ff5924',
        passiveId: 'atk_up',
      },
    );

    // Shuffle and guarantee at least 1 summon option early when player has < 3 minions!
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    if (st.minions.length < 3) {
      const summonOpt = shuffled.find((x) => x.kind === 'summon');
      if (summonOpt) {
        const rest = shuffled.filter((x) => x.id !== summonOpt.id);
        return [summonOpt, ...rest.slice(0, 2)];
      }
    }
    return shuffled.slice(0, 3);
  };

  const handleChooseUpgrade = (choice: LevelChoice) => {
    const st = stateRef.current;
    if (!st) return;
    sound.play('confirm');
    if (choice.kind === 'summon' && choice.species) {
      const boxMatch = save.pets.find(
        (p) => p.species === choice.species && !st.minions.some((m) => m.name === p.name),
      );
      summonMinion(
        choice.species,
        boxMatch?.name,
        boxMatch ? getGrowthStage(boxMatch.level, boxMatch.species) : 'baby',
      );
      showBanner(`成功召唤【${boxMatch?.name ?? SPECIES_CATALOG[choice.species].defaultName}】加入随从团！`);
    } else if (choice.kind === 'upgrade_minion' && choice.minionId) {
      const target = st.minions.find((m) => m.id === choice.minionId);
      if (target) {
        target.level += 1;
        syncMinionsView();
        showBanner(`${target.name} 的「${target.skillName}」升至 Lv.${target.level}！`);
      }
    } else if (choice.kind === 'passive') {
      if (choice.passiveId === 'speed') {
        st.speedMult += 0.15;
        st.pickupRadius += 20;
      } else if (choice.passiveId === 'heal') {
        st.maxHp = Math.round(st.maxHp * 1.22);
        st.hp = Math.min(st.maxHp, st.hp + Math.round(st.maxHp * 0.45));
      } else if (choice.passiveId === 'greed') {
        st.cdMult = Math.max(0.42, st.cdMult * 0.88);
        st.greedMult += 0.35;
      } else if (choice.passiveId === 'atk_up') {
        st.atkMult += 0.22;
      }
    }
    setLevelChoices(null);
    pausedRef.current = false;
  };

  const triggerSafeZoneHeal = () => {
    const st = stateRef.current;
    if (!st) return;
    st.hp = st.maxHp;
    st.timers.safeHealCd = 3.5;
    onHealParty();
    sound.play('heal_jingle');
    st.vfxs.push({
      kind: 'heal',
      x: st.px,
      y: st.py - 18,
      life: 0.9,
      maxLife: 0.9,
      text: 'HP 全满!',
      color: '#51cf66',
    });
    showBanner('乔伊小姐：叮咚叮咚～主角与全体宝可梦随从已恢复满血！');
  };

  const totalSpendableCoins = save.coins + hud.coins;

  const buySafeShopItem = (
    item: 'potion' | 'summon' | 'tome' | 'berry' | 'magnet',
    cost: number,
  ) => {
    const st = stateRef.current;
    if (!st) return;
    if (st.coins + save.coins < cost) {
      sound.play('error');
      showBanner('金币不足！多击败野生宝可梦和敌方训练师赚取金币吧～');
      return;
    }
    // Spend run coins first, then save coins
    if (st.coins >= cost) {
      st.coins -= cost;
    } else {
      const rem = cost - st.coins;
      if (!onSpendCoinsInRun(rem)) {
        sound.play('error');
        return;
      }
      st.coins = 0;
    }

    sound.play('coin');
    if (item === 'potion') {
      st.hp = Math.min(st.maxHp, st.hp + Math.round(st.maxHp * 0.65));
      showBanner('使用超级伤药，回复了大量 HP！');
    } else if (item === 'summon') {
      if (st.minions.length >= MAX_MINIONS) {
        // Boost all minions instead if full!
        for (const m of st.minions) m.level += 1;
        syncMinionsView();
        showBanner('随从位已满，全体随从技能 +1 级！');
      } else {
        const unused = SUMMON_CANDIDATES.filter(
          (c) => !st.minions.some((m) => m.species === c.species),
        );
        const pick =
          unused[Math.floor(Math.random() * unused.length)] ??
          SUMMON_CANDIDATES[Math.floor(Math.random() * SUMMON_CANDIDATES.length)];
        summonMinion(pick.species);
        showBanner(`在安全区招募了【${pick.name}】加入随从战队！`);
      }
    } else if (item === 'tome') {
      st.atkMult += 0.25;
      st.cdMult = Math.max(0.4, st.cdMult * 0.9);
      showBanner('研读招式特训书：全队伤害 +25% · 冷却 -10%！');
    } else if (item === 'berry') {
      st.maxHp = Math.round(st.maxHp * 1.25);
      st.hp = Math.min(st.maxHp, st.hp + Math.round(st.maxHp * 0.35));
      showBanner('食用元气树果：生命上限 +25% 并恢复生命！');
    } else if (item === 'magnet') {
      st.pickupRadius += 24;
      st.speedMult += 0.12;
      for (const g of st.gems) {
        g.x = st.px + (Math.random() - 0.5) * 16;
        g.y = st.py + (Math.random() - 0.5) * 16;
      }
      showBanner('激活极速磁铁：全图战利品吸入并提升移速！');
    }
    setHud((prev) => ({
      ...prev,
      hp: Math.ceil(st.hp),
      maxHp: st.maxHp,
      coins: st.coins,
    }));
  };

  const openSafeShop = () => {
    pausedRef.current = true;
    clickTargetRef.current = null;
    sound.play('confirm');
    setShopOpen(true);
  };

  const closeSafeShop = () => {
    sound.play('cancel');
    setShopOpen(false);
    if (!levelChoices && !resultModal) {
      pausedRef.current = false;
    }
  };

  const buildPayload = (cleared: boolean): SurvivorsResultPayload => {
    const st = stateRef.current;
    return {
      survivedSec: Math.round(st?.elapsed ?? 0),
      kills: st?.kills ?? 0,
      runLevel: st?.runLevel ?? 1,
      coinsCollected: st?.coins ?? 0,
      cleared,
      remainingHpPct: st ? Math.round((Math.max(0, st.hp) / st.maxHp) * 100) : 100,
    };
  };

  const finishRun = (cleared: boolean) => {
    const st = stateRef.current;
    if (!st || endedRef.current) return;
    endedRef.current = true;
    pausedRef.current = true;
    sound.play(cleared ? 'levelup' : 'cancel');
    setResultModal(buildPayload(cleared));
  };

  // Main 60fps Open-World Pokémon Survivors Loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const triggerLevelUp = () => {
      pausedRef.current = true;
      clickTargetRef.current = null;
      sound.play('levelup');
      setLevelChoices(buildLevelChoices());
    };

    const damageEnemy = (enemy: EnemyEntity, amount: number, color = '#ffe066') => {
      const st = stateRef.current;
      if (!st || enemy.hp <= 0) return;
      enemy.hp -= amount;
      enemy.hitFlash = 0.12;
      st.vfxs.push({
        kind: 'dmg',
        x: enemy.x + (Math.random() - 0.5) * 10,
        y: enemy.y - 12,
        life: 0.45,
        maxLife: 0.45,
        text: `-${amount}`,
        color,
      });
      if (enemy.hp <= 0) {
        st.kills += 1;
        if (enemy.isTrainer || enemy.isBoss) sound.play('ko');
        st.vfxs.push({
          kind: 'burst',
          x: enemy.x,
          y: enemy.y,
          life: 0.25,
          maxLife: 0.25,
          radius: enemy.isBoss || enemy.isTrainer ? 26 : 14,
          color: enemy.isTrainer ? '#ff922b' : enemy.isBoss ? '#ffd43b' : '#ffffff',
        });
        st.gems.push({
          x: enemy.x,
          y: enemy.y,
          kind: 'xp',
          value: enemy.isBoss ? 48 : enemy.isTrainer ? 26 : 6 + Math.floor(st.elapsed / 25) * 2,
        });
        if (enemy.isBoss || enemy.isTrainer || Math.random() < 0.34) {
          st.gems.push({
            x: enemy.x + 8,
            y: enemy.y + 4,
            kind: 'coin',
            value: enemy.isBoss
              ? 35
              : enemy.isTrainer
                ? Math.round(14 * st.greedMult)
                : Math.max(2, Math.round(3 * st.greedMult)),
          });
        }
        if (enemy.isTrainer) {
          st.gems.push({ x: enemy.x - 10, y: enemy.y + 4, kind: 'berry', value: 30 });
          showBanner(`击败了敌方训练师「${enemy.trainerName}」！爆出大量金币与树果！`);
        } else if (Math.random() < 0.045) {
          st.gems.push({ x: enemy.x - 8, y: enemy.y, kind: 'berry', value: 25 });
        } else if (Math.random() < 0.025) {
          st.gems.push({ x: enemy.x - 8, y: enemy.y, kind: 'magnet', value: 1 });
        }
        if (enemy.isBoss) {
          showBanner('击败了精英头目「快龙」！大世界探索继续，可随时前往安全区补给或结算！', 3400);
        }
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      const st = stateRef.current;
      const canvas = canvasRef.current;

      if (st && canvas) {
        st.animTick += dt;
        const nearbyZones = getNearbySafeZones(st.px, st.py);
        let activeZone: SafeZone | null = null;
        let nearestZone = nearbyZones[0];
        let nearestDist = Infinity;
        for (const z of nearbyZones) {
          const d = Math.hypot(st.px - z.x, st.py - z.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestZone = z;
          }
          if (d < z.radius - 6) {
            activeZone = z;
          }
        }

        if (!pausedRef.current && !endedRef.current) {
          st.elapsed += dt;
          if (st.invuln > 0) st.invuln = Math.max(0, st.invuln - dt);
          if (st.timers.safeHealCd > 0) st.timers.safeHealCd = Math.max(0, st.timers.safeHealCd - dt);

          // 1. Unified 360° Protagonist Movement (Handheld 360° Pad + Keyboard Diagonals + Map Click/Drag!)
          let mx = 0;
          let my = 0;
          const ks = keysRef.current;
          const kb = save.keyBindings;
          const norm = (k?: string) => (k && k.length === 1 ? k.toLowerCase() : k ?? '');
          if (ks.has('ArrowLeft') || ks.has('a') || ks.has(norm(kb?.left))) mx -= 1;
          if (ks.has('ArrowRight') || ks.has('d') || ks.has(norm(kb?.right))) mx += 1;
          if (ks.has('ArrowUp') || ks.has('w') || ks.has(norm(kb?.up))) my -= 1;
          if (ks.has('ArrowDown') || ks.has('s') || ks.has(norm(kb?.down))) my += 1;

          // Handheld 360° Omnidirectional Thumbpad vector
          const padV = analogVecRef.current;
          if (mx === 0 && my === 0 && (Math.abs(padV.x) > 0.08 || Math.abs(padV.y) > 0.08)) {
            mx = padV.x;
            my = padV.y;
            clickTargetRef.current = null;
          }

          // Pointer hold-drag steering
          if (mx === 0 && my === 0 && pointerRef.current.active) {
            const dx = pointerRef.current.x - VIEW_W / 2;
            const dy = pointerRef.current.y - VIEW_H / 2;
            const d = Math.hypot(dx, dy);
            if (d > 10) {
              mx = dx / d;
              my = dy / d;
            }
          }

          // Click-to-walk destination target
          if (mx === 0 && my === 0 && clickTargetRef.current) {
            const dx = clickTargetRef.current.x - st.px;
            const dy = clickTargetRef.current.y - st.py;
            const d = Math.hypot(dx, dy);
            if (d <= 8) {
              clickTargetRef.current = null;
            } else {
              mx = dx / d;
              my = dy / d;
            }
          }

          const moveLen = Math.hypot(mx, my);
          if (moveLen > 1) {
            mx /= moveLen;
            my /= moveLen;
          }

          const moveSpeed = 112 * st.speedMult;
          const stepX = mx * moveSpeed * dt;
          const stepY = my * moveSpeed * dt;
          st.px += stepX;
          st.py += stepY;

          if (moveLen > 0.08) {
            st.stepDist += Math.hypot(stepX, stepY);
            if (st.stepDist >= 12) {
              st.stepDist = 0;
              st.stepPhase = (st.stepPhase + 1) % 2;
            }
            if (Math.abs(mx) >= Math.abs(my)) {
              st.facing = mx < 0 ? 'left' : 'right';
            } else {
              st.facing = my < 0 ? 'up' : 'down';
            }
          }

          // Safe Zone Auto-Heal when walking right up to the Red Pokémon Center!
          if (activeZone && st.timers.safeHealCd <= 0 && st.hp < st.maxHp) {
            const pcDoorX = activeZone.x - 42;
            const pcDoorY = activeZone.y - 10;
            if (Math.hypot(st.px - pcDoorX, st.py - pcDoorY) < 42) {
              triggerSafeZoneHeal();
            }
          }

          // Leftovers passive regen
          if (pet.accessory === 'leftovers') {
            st.timers.regen -= dt;
            if (st.timers.regen <= 0 && st.hp < st.maxHp) {
              st.timers.regen = 3.0;
              st.hp = Math.min(st.maxHp, st.hp + 4);
            }
          }

          // 2. Spawn Wild Pokémon Hordes (outside Safe Zones!)
          st.timers.spawn -= dt;
          const spawnInterval = Math.max(0.32, 1.05 - st.elapsed * 0.0075);
          if (st.timers.spawn <= 0 && st.enemies.length < 52) {
            st.timers.spawn = spawnInterval;
            const batch = st.elapsed > 45 ? 3 : st.elapsed > 18 ? 2 : 1;
            for (let b = 0; b < batch; b++) {
              const ang = Math.random() * Math.PI * 2;
              const dist = 250 + Math.random() * 55;
              const sx = st.px + Math.cos(ang) * dist;
              const sy = st.py + Math.sin(ang) * dist;
              // Never spawn inside any Safe Zone!
              if (nearbyZones.some((z) => Math.hypot(sx - z.x, sy - z.y) < z.radius + 16)) {
                continue;
              }
              const sp = WILD_ENEMY_SPECIES[Math.floor(Math.random() * WILD_ENEMY_SPECIES.length)];
              const hpScale = 1 + st.elapsed / 42;
              st.enemies.push({
                id: st.nextId++,
                x: sx,
                y: sy,
                hp: Math.round(22 * hpScale),
                maxHp: Math.round(22 * hpScale),
                speed: 44 + Math.min(34, st.elapsed * 0.3) + Math.random() * 12,
                radius: 13,
                species: sp,
                isBoss: false,
                isTrainer: false,
                shootCd: 99,
                hitFlash: 0,
                dmg: 9 + Math.floor(st.elapsed / 28) * 3,
              });
            }
          }

          // 2B. Spawn Enemy Trainers every ~22s (throwing projectiles & leading elite Pokémon!)
          st.timers.trainer -= dt;
          if (st.timers.trainer <= 0) {
            st.timers.trainer = 22;
            const tr = ENEMY_TRAINERS[st.trainerWaveIdx % ENEMY_TRAINERS.length];
            st.trainerWaveIdx += 1;
            const ang = Math.random() * Math.PI * 2;
            const tx = st.px + Math.cos(ang) * 255;
            const ty = st.py + Math.sin(ang) * 255;
            if (!nearbyZones.some((z) => Math.hypot(tx - z.x, ty - z.y) < z.radius + 16)) {
              const trHp = Math.round(115 + st.elapsed * 2.4);
              st.enemies.push({
                id: st.nextId++,
                x: tx,
                y: ty,
                hp: trHp,
                maxHp: trHp,
                speed: 48,
                radius: 17,
                species: tr.guardSpecies,
                isBoss: false,
                isTrainer: true,
                trainerSprite: tr.key,
                trainerName: tr.name,
                shootCd: 1.8,
                hitFlash: 0,
                dmg: 14,
              });
              // Trainer brings 2 guard Pokémon!
              for (let g = 0; g < 2; g++) {
                st.enemies.push({
                  id: st.nextId++,
                  x: tx + (g === 0 ? -24 : 24),
                  y: ty + 16,
                  hp: Math.round(38 + st.elapsed * 0.7),
                  maxHp: Math.round(38 + st.elapsed * 0.7),
                  speed: 58,
                  radius: 13,
                  species: tr.guardSpecies,
                  isBoss: false,
                  isTrainer: false,
                  shootCd: 99,
                  hitFlash: 0,
                  dmg: 11,
                });
              }
              sound.play('confirm');
              showBanner(`！敌方训练师「${tr.name}」带着宝可梦发起伏击！`);
            }
          }

          // 2C. Spawn Elite Boss Dragonite at 75s
          if (!st.bossSpawned && st.elapsed >= 75) {
            st.bossSpawned = true;
            sound.playCry(149);
            showBanner('！霸主野生「快龙」降临大世界！小心迎战！', 3200);
            st.enemies.push({
              id: st.nextId++,
              x: st.px + 240,
              y: st.py - 120,
              hp: 420 + st.baseAtk * 5,
              maxHp: 420 + st.baseAtk * 5,
              speed: 54,
              radius: 22,
              species: 'dratini',
              isBoss: true,
              isTrainer: false,
              shootCd: 2.4,
              hitFlash: 0,
              dmg: 20,
            });
          }

          // 3. Update Summoned Pokémon Minions (Formation Follow + Auto-Cast Elemental Skills!)
          const minionCount = st.minions.length;
          for (let i = 0; i < minionCount; i++) {
            const m = st.minions[i];
            const formAngle = (i * Math.PI * 2) / minionCount + st.elapsed * 0.65;
            const formR = minionCount === 1 ? 30 : 38;
            const tx = st.px + Math.cos(formAngle) * formR;
            const ty = st.py + Math.sin(formAngle) * formR;
            const dx = tx - m.x;
            const dy = ty - m.y;
            m.x += dx * Math.min(1, dt * 7.5);
            m.y += dy * Math.min(1, dt * 7.5);
            if (Math.abs(dx) > 0.5) m.facingLeft = dx < 0;

            const atkPower = Math.round(st.baseAtk * st.atkMult * (0.88 + m.level * 0.28));

            // Grass Minions continuously spin Razor Leaf blades around themselves & Trainer!
            if (m.element === 'grass') {
              m.orbitAngle += dt * (3.2 + m.level * 0.45);
              const blades = 2 + m.level;
              const orbitR = 48 + Math.min(20, m.level * 5);
              for (let b = 0; b < blades; b++) {
                const a = m.orbitAngle + (b * Math.PI * 2) / blades;
                const bx = st.px + Math.cos(a) * orbitR;
                const by = st.py + Math.sin(a) * orbitR;
                for (const en of st.enemies) {
                  if (en.hp > 0 && en.hitFlash <= 0 && Math.hypot(en.x - bx, en.y - by) < en.radius + 9) {
                    damageEnemy(en, Math.round(atkPower * 0.72), '#69db7c');
                  }
                }
              }
            }

            // Cooldown-based elemental skill casting from minion position!
            m.cd -= dt;
            if (m.cd <= 0 && st.enemies.length > 0) {
              // Find closest visible enemies
              const inRange = st.enemies
                .filter((e) => e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < 280)
                .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y));
              if (inRange.length === 0) {
                m.cd = 0.2;
                continue;
              }

              if (m.element === 'electric') {
                m.cd = Math.max(0.65, (1.65 - m.level * 0.14) * st.cdMult);
                const strikes = Math.min(inRange.length, m.level + 1);
                for (let k = 0; k < strikes; k++) {
                  const target = inRange[k];
                  st.vfxs.push({
                    kind: 'lightning',
                    x: target.x,
                    y: target.y,
                    life: 0.26,
                    maxLife: 0.26,
                    color: '#ffe066',
                  });
                  damageEnemy(target, Math.round(atkPower * 1.25), '#ffe066');
                }
                sound.play('thunder');
              } else if (m.element === 'water') {
                m.cd = Math.max(1.0, (2.2 - m.level * 0.16) * st.cdMult);
                const rad = 76 + m.level * 18;
                st.vfxs.push({
                  kind: 'wave',
                  x: m.x,
                  y: m.y,
                  life: 0.34,
                  maxLife: 0.34,
                  radius: rad,
                  color: '#74c0fc',
                });
                for (const en of st.enemies) {
                  const d = Math.hypot(en.x - m.x, en.y - m.y);
                  if (d < rad) {
                    damageEnemy(en, Math.round(atkPower * 0.95), '#74c0fc');
                    if (!en.isBoss && d > 1) {
                      en.x += ((en.x - m.x) / d) * 24;
                      en.y += ((en.y - m.y) / d) * 24;
                    }
                  }
                }
                sound.play('water');
              } else if (m.element === 'ghost' || m.element === 'psychic' || m.element === 'fairy') {
                m.cd = Math.max(0.6, (1.5 - m.level * 0.12) * st.cdMult);
                const rays = 4 + m.level * 2;
                for (let k = 0; k < rays; k++) {
                  const a = (k * Math.PI * 2) / rays + st.elapsed;
                  st.bullets.push({
                    x: m.x,
                    y: m.y,
                    vx: Math.cos(a) * 205,
                    vy: Math.sin(a) * 205,
                    dmg: Math.round(atkPower * 0.78),
                    color: '#ae3ec9',
                    core: '#ffffff',
                    radius: 4,
                    pierce: 3,
                    life: 1.15,
                  });
                }
              } else if (m.element === 'grass') {
                // Grass also tosses quick seed shots while blades orbit!
                m.cd = Math.max(0.7, (1.45 - m.level * 0.1) * st.cdMult);
                const target = inRange[0];
                const ang = Math.atan2(target.y - m.y, target.x - m.x);
                st.bullets.push({
                  x: m.x,
                  y: m.y,
                  vx: Math.cos(ang) * 215,
                  vy: Math.sin(ang) * 215,
                  dmg: Math.round(atkPower * 0.8),
                  color: '#40c057',
                  core: '#d3f9d8',
                  radius: 4,
                  pierce: 2,
                  life: 1.2,
                });
              } else {
                // Fire / Normal / Dragon homing volley
                m.cd = Math.max(0.35, (1.05 - m.level * 0.08) * st.cdMult);
                const count = Math.min(inRange.length, 1 + Math.floor((m.level + 1) / 2));
                const isFire = m.element === 'fire';
                for (let k = 0; k < count; k++) {
                  const target = inRange[k];
                  const ang = Math.atan2(target.y - m.y, target.x - m.x);
                  st.bullets.push({
                    x: m.x,
                    y: m.y,
                    vx: Math.cos(ang) * 235,
                    vy: Math.sin(ang) * 235,
                    dmg: Math.round(atkPower * 1.0),
                    color: isFire ? '#ff5924' : '#ff922b',
                    core: '#ffe066',
                    radius: 5,
                    pierce: m.level >= 3 ? 2 : 1,
                    life: 1.35,
                  });
                }
                sound.play('fireball');
              }
            }
          }

          // 4. Update Projectiles (Player Minions + Enemy Trainer Pokéball Projectiles!)
          for (let i = st.bullets.length - 1; i >= 0; i--) {
            const b = st.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            if (b.life <= 0) {
              st.bullets.splice(i, 1);
              continue;
            }
            if (b.fromEnemy) {
              // Safe Zone barrier blocks all enemy projectiles!
              if (nearbyZones.some((z) => Math.hypot(b.x - z.x, b.y - z.y) < z.radius)) {
                st.bullets.splice(i, 1);
                continue;
              }
              if (Math.hypot(b.x - st.px, b.y - st.py) < b.radius + 11 && st.invuln <= 0) {
                st.hp = Math.max(0, st.hp - b.dmg);
                st.invuln = 0.55;
                sound.play('hit');
                st.vfxs.push({
                  kind: 'dmg',
                  x: st.px,
                  y: st.py - 18,
                  life: 0.5,
                  maxLife: 0.5,
                  text: `-${b.dmg}`,
                  color: '#ff6b6b',
                });
                st.bullets.splice(i, 1);
                if (st.hp <= 0) finishRun(false);
              }
            } else {
              for (const en of st.enemies) {
                if (en.hp > 0 && Math.hypot(en.x - b.x, en.y - b.y) < en.radius + b.radius) {
                  damageEnemy(en, b.dmg, b.core);
                  b.pierce -= 1;
                  if (b.pierce <= 0) {
                    st.bullets.splice(i, 1);
                    break;
                  }
                }
              }
            }
          }

          // 5. Update Enemies & Safe Zone Barrier Physics!
          for (let i = st.enemies.length - 1; i >= 0; i--) {
            const en = st.enemies[i];
            if (en.hp <= 0) {
              st.enemies.splice(i, 1);
              continue;
            }
            if (en.hitFlash > 0) en.hitFlash -= dt;

            const dx = st.px - en.x;
            const dy = st.py - en.y;
            const dist = Math.hypot(dx, dy) || 1;
            en.x += (dx / dist) * en.speed * dt;
            en.y += (dy / dist) * en.speed * dt;

            // Safe Zone Barrier repels all enemies outside the emerald ring!
            for (const z of nearbyZones) {
              const zd = Math.hypot(en.x - z.x, en.y - z.y);
              const minR = z.radius + en.radius + 2;
              if (zd < minR) {
                const ang = zd > 0.1 ? Math.atan2(en.y - z.y, en.x - z.x) : Math.random() * Math.PI * 2;
                en.x = z.x + Math.cos(ang) * minR;
                en.y = z.y + Math.sin(ang) * minR;
              }
            }

            // Enemy Trainers & Bosses throw ranged energy projectiles at Red when outside Safe Zone!
            if ((en.isTrainer || en.isBoss) && !activeZone) {
              en.shootCd -= dt;
              if (en.shootCd <= 0 && dist < 240) {
                en.shootCd = en.isBoss ? 2.2 : 2.6;
                const ang = Math.atan2(st.py - en.y, st.px - en.x);
                st.bullets.push({
                  x: en.x,
                  y: en.y,
                  vx: Math.cos(ang) * 145,
                  vy: Math.sin(ang) * 145,
                  dmg: en.dmg,
                  color: '#e03131',
                  core: '#ffffff',
                  radius: 5,
                  pierce: 1,
                  life: 2.0,
                  fromEnemy: true,
                });
              }
            }

            if (!activeZone && dist < en.radius + 11 && st.invuln <= 0) {
              st.hp = Math.max(0, st.hp - en.dmg);
              st.invuln = 0.55;
              sound.play('hit');
              st.vfxs.push({
                kind: 'dmg',
                x: st.px,
                y: st.py - 18,
                life: 0.5,
                maxLife: 0.5,
                text: `-${en.dmg}`,
                color: '#ff6b6b',
              });
              if (st.hp <= 0) {
                finishRun(false);
                break;
              }
            }
          }

          // 6. Magnetic XP Gems / Coins / Berries Pickup
          for (let i = st.gems.length - 1; i >= 0; i--) {
            const g = st.gems[i];
            const dx = st.px - g.x;
            const dy = st.py - g.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < st.pickupRadius) {
              g.x += (dx / dist) * 250 * dt;
              g.y += (dy / dist) * 250 * dt;
            }
            if (dist < 15) {
              if (g.kind === 'xp') {
                st.xp += g.value;
                if (st.xp >= st.xpNeed) {
                  st.xp -= st.xpNeed;
                  st.runLevel += 1;
                  st.xpNeed = Math.round(st.xpNeed * 1.36 + 8);
                  triggerLevelUp();
                }
              } else if (g.kind === 'coin') {
                st.coins += g.value;
                sound.play('coin');
              } else if (g.kind === 'berry') {
                st.hp = Math.min(st.maxHp, st.hp + g.value);
                sound.play('eat');
              } else if (g.kind === 'magnet') {
                for (const other of st.gems) {
                  if (other.kind === 'xp' || other.kind === 'coin') {
                    other.x = st.px + (Math.random() - 0.5) * 16;
                    other.y = st.py + (Math.random() - 0.5) * 16;
                  }
                }
                sound.play('happy');
              }
              st.gems.splice(i, 1);
            }
          }

          // 7. Update VFX
          for (let i = st.vfxs.length - 1; i >= 0; i--) {
            st.vfxs[i].life -= dt;
            if (st.vfxs[i].life <= 0) st.vfxs.splice(i, 1);
          }

          // Sync lightweight React HUD at ~10fps
          st.timers.hudSync -= dt;
          if (st.timers.hudSync <= 0) {
            st.timers.hudSync = 0.1;
            const zAng = Math.atan2(nearestZone.y - st.py, nearestZone.x - st.px);
            setHud({
              hp: Math.ceil(st.hp),
              maxHp: st.maxHp,
              xp: st.xp,
              xpNeed: st.xpNeed,
              runLevel: st.runLevel,
              kills: st.kills,
              coins: st.coins,
              elapsedSec: Math.floor(st.elapsed),
              inSafeZone: Boolean(activeZone),
              nearestZoneDir: {
                angle: zAng,
                distM: Math.max(0, Math.round((nearestDist - SAFE_ZONE_RADIUS) / 8)),
              },
            });
          }
        }

        // ===== RENDER 60FPS AUTHENTIC GBA FIRERED OPEN-WORLD CANVAS =====
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const camX = st.px - VIEW_W / 2;
          const camY = st.py - VIEW_H / 2;
          const animFrame = Math.floor(st.animTick * 2.4) % 4;

          // 1. FireRed Grass / Road / Tall Grass / Wildflowers Tile Grid (scaled 2x -> 32px per 16px GBA tile!)
          ctx.fillStyle = '#78d868';
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);

          const tilePx = 32;
          const startCol = Math.floor(camX / tilePx) - 1;
          const startRow = Math.floor(camY / tilePx) - 1;
          const endCol = startCol + Math.ceil(VIEW_W / tilePx) + 3;
          const endRow = startRow + Math.ceil(VIEW_H / tilePx) + 3;

          ctx.save();
          ctx.scale(2, 2); // Paint authentic 16x16 GBA tiles at crisp 2x scale!
          const halfCamX = Math.round(camX / 2);
          const halfCamY = Math.round(camY / 2);

          for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
              const ox = c * 16 - halfCamX;
              const oy = r * 16 - halfCamY;
              const wx = c * 32 + 16;
              const wy = r * 32 + 16;

              // Kanto dirt road corridors every SECTOR_SIZE!
              const modX = ((wx % SECTOR_SIZE) + SECTOR_SIZE) % SECTOR_SIZE;
              const modY = ((wy % SECTOR_SIZE) + SECTOR_SIZE) % SECTOR_SIZE;
              const onRoad = modX < 64 || modX > SECTOR_SIZE - 64 || modY < 64 || modY > SECTOR_SIZE - 64;

              const h = Math.abs((c * 73 + r * 37) % 19);
              if (onRoad) {
                ctx.fillStyle = '#e8d498';
                ctx.fillRect(ox, oy, 16, 16);
                if (h % 3 === 0) {
                  ctx.fillStyle = '#d2b478';
                  ctx.fillRect(ox + 5, oy + 6, 2, 1);
                }
              } else if (h < 3) {
                drawTallGrass(ctx, ox, oy, animFrame);
              } else if (h === 5) {
                drawWildflowers(ctx, ox, oy, animFrame);
              } else {
                // Fast clean meadow tile
                ctx.fillStyle = '#78d868';
                ctx.fillRect(ox, oy, 16, 16);
                const seed = Math.abs(c * 7 + r * 13) % 5;
                ctx.fillStyle = '#60c050';
                ctx.fillRect(ox + 2 + seed, oy + 4, 2, 1);
                ctx.fillStyle = '#98e878';
                ctx.fillRect(ox + 3 + seed, oy + 3, 1, 1);
                if (h === 12) {
                  drawOakTree(ctx, ox, oy);
                }
              }
            }
          }

          // 2. Render Visible Roadside Safe Zones (Paved Plaza + Emerald Barrier + Poke Center + Poke Mart!)
          for (const z of nearbyZones) {
            const zcx = Math.round(z.x / 2 - halfCamX);
            const zcy = Math.round(z.y / 2 - halfCamY);
            const zr = Math.round(z.radius / 2);
            if (zcx < -zr - 50 || zcx > VIEW_W / 2 + zr + 50 || zcy < -zr - 50 || zcy > VIEW_H / 2 + zr + 50) {
              continue;
            }
            // Paved cobblestone plaza
            ctx.fillStyle = '#e6dec8';
            ctx.fillRect(zcx - zr + 6, zcy - zr + 6, (zr - 6) * 2, (zr - 6) * 2);
            ctx.fillStyle = '#d4cab0';
            for (let py = zcy - zr + 10; py < zcy + zr - 10; py += 8) {
              for (let px = zcx - zr + 10; px < zcx + zr - 10; px += 8) {
                ctx.fillRect(px, py, 7, 1);
                ctx.fillRect(px, py, 1, 7);
              }
            }
            // Pulsing pixel Emerald Safe Zone Barrier Perimeter!
            const ringColor = animFrame % 2 === 0 ? '#40c057' : '#8ce99a';
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(zcx - zr, zcy - zr, zr * 2, zr * 2);
            ctx.strokeStyle = '#1c1926';
            ctx.lineWidth = 1;
            ctx.strokeRect(zcx - zr - 1, zcy - zr - 1, zr * 2 + 2, zr * 2 + 2);

            // Authentic FireRed Pokémon Center (Left) & Poké Mart (Right) inside Safe Zone!
            drawPokeCenterBuilding(ctx, zcx - 56, zcy - 44);
            drawPokeMartBuilding(ctx, zcx + 8, zcy - 44);
          }

          ctx.restore();

          // Safe Zone Crisp Pixel Labels
          for (const z of nearbyZones) {
            const zsx = Math.round(z.x - camX);
            const zsy = Math.round(z.y - camY);
            if (zsx < -160 || zsx > VIEW_W + 160 || zsy < -160 || zsy > VIEW_H + 160) continue;
            ctx.font = 'bold 10px "Fusion Pixel", monospace';
            ctx.fillStyle = '#1c1926';
            ctx.fillRect(zsx - 32, zsy + SAFE_ZONE_RADIUS - 18, 64, 15);
            ctx.fillStyle = '#40c057';
            ctx.fillRect(zsx - 31, zsy + SAFE_ZONE_RADIUS - 17, 62, 13);
            ctx.fillStyle = '#ffffff';
            ctx.fillText('安全区营地', zsx - 25, zsy + SAFE_ZONE_RADIUS - 7);
          }

          // Click-to-walk destination reticle
          if (clickTargetRef.current) {
            const rx = Math.round(clickTargetRef.current.x - camX);
            const ry = Math.round(clickTargetRef.current.y - camY);
            const pulse = animFrame % 2 === 0 ? '#ffe066' : '#ffffff';
            ctx.fillStyle = pulse;
            ctx.fillRect(rx - 8, ry - 8, 5, 2);
            ctx.fillRect(rx - 8, ry - 8, 2, 5);
            ctx.fillRect(rx + 3, ry - 8, 5, 2);
            ctx.fillRect(rx + 6, ry - 8, 2, 5);
            ctx.fillRect(rx - 8, ry + 6, 5, 2);
            ctx.fillRect(rx - 8, ry + 3, 2, 5);
            ctx.fillRect(rx + 3, ry + 6, 5, 2);
            ctx.fillRect(rx + 6, ry + 3, 2, 5);
          }

          // 3. Render Gems & Loot Drops
          for (const g of st.gems) {
            const gx = Math.round(g.x - camX);
            const gy = Math.round(g.y - camY);
            if (gx < -12 || gx > VIEW_W + 12 || gy < -12 || gy > VIEW_H + 12) continue;
            if (g.kind === 'xp') {
              ctx.fillStyle = '#1c1926';
              ctx.fillRect(gx - 3, gy - 4, 6, 8);
              ctx.fillStyle = g.value >= 20 ? '#ae3ec9' : '#339af0';
              ctx.fillRect(gx - 2, gy - 3, 4, 6);
              ctx.fillStyle = '#d0ebff';
              ctx.fillRect(gx - 1, gy - 2, 2, 2);
            } else if (g.kind === 'coin') {
              ctx.fillStyle = '#1c1926';
              ctx.fillRect(gx - 4, gy - 4, 8, 8);
              ctx.fillStyle = '#ffd43b';
              ctx.fillRect(gx - 3, gy - 3, 6, 6);
              ctx.fillStyle = '#fff9db';
              ctx.fillRect(gx - 2, gy - 2, 2, 2);
            } else if (g.kind === 'berry') {
              ctx.fillStyle = '#1c1926';
              ctx.fillRect(gx - 4, gy - 4, 8, 8);
              ctx.fillStyle = '#ff6b6b';
              ctx.fillRect(gx - 3, gy - 3, 6, 6);
              ctx.fillStyle = '#69db7c';
              ctx.fillRect(gx - 1, gy - 5, 3, 2);
            } else {
              ctx.fillStyle = '#1c1926';
              ctx.fillRect(gx - 5, gy - 5, 10, 10);
              ctx.fillStyle = '#e03131';
              ctx.fillRect(gx - 4, gy - 4, 4, 8);
              ctx.fillStyle = '#339af0';
              ctx.fillRect(gx, gy - 4, 4, 8);
            }
          }

          // 4. Hydro Waves (under sprites)
          for (const v of st.vfxs) {
            if (v.kind === 'wave') {
              const prog = 1 - v.life / v.maxLife;
              const r = Math.round((v.radius ?? 80) * prog);
              const vx = Math.round(v.x - camX);
              const vy = Math.round(v.y - camY);
              ctx.strokeStyle = v.color;
              ctx.lineWidth = 4;
              ctx.strokeRect(vx - r, vy - r, r * 2, r * 2);
            }
          }

          // 5. Render Wild Enemies & Official Enemy Trainers!
          for (const en of st.enemies) {
            const ex = Math.round(en.x - camX);
            const ey = Math.round(en.y - camY);
            if (ex < -48 || ex > VIEW_W + 48 || ey < -48 || ey > VIEW_H + 48) continue;

            ctx.fillStyle = 'rgba(18, 28, 18, 0.35)';
            ctx.fillRect(ex - en.radius + 2, ey + en.radius - 3, (en.radius - 2) * 2, 4);

            const imgKey = en.isTrainer
              ? en.trainerSprite!
              : en.isBoss
                ? 'dratini_adult'
                : `${en.species}_baby`;
            const img = spriteImgsRef.current[imgKey];
            const sz = en.isBoss ? 64 : en.isTrainer ? 46 : 38;
            if (img && img.complete && img.naturalWidth > 0) {
              ctx.save();
              if (en.hitFlash > 0) ctx.filter = 'brightness(2.4)';
              if (en.x > st.px && !en.isTrainer) {
                ctx.translate(ex, ey);
                ctx.scale(-1, 1);
                ctx.drawImage(img, -sz / 2, -sz / 2 - 4, sz, sz);
              } else {
                ctx.drawImage(img, ex - sz / 2, ey - sz / 2 - 4, sz, sz);
              }
              ctx.restore();
            } else {
              ctx.fillStyle = en.isTrainer ? '#e03131' : '#7950f2';
              ctx.fillRect(ex - 10, ey - 10, 20, 20);
            }

            if (en.isBoss || en.isTrainer) {
              const bw = en.isBoss ? 48 : 38;
              ctx.fillStyle = '#1c1926';
              ctx.fillRect(ex - bw / 2 - 1, ey - 30, bw + 2, 6);
              ctx.fillStyle = '#e03131';
              ctx.fillRect(ex - bw / 2, ey - 29, Math.round(bw * Math.max(0, en.hp / en.maxHp)), 4);
              if (en.trainerName) {
                ctx.font = 'bold 9px "Fusion Pixel", monospace';
                ctx.fillStyle = '#1c1926';
                ctx.fillRect(ex - 26, ey - 43, 52, 12);
                ctx.fillStyle = '#ff6b6b';
                ctx.fillText(en.trainerName, ex - 23, ey - 34);
              }
            }
          }

          // 6. Render Summoned Pokémon Minions & Orbiting Grass Blades!
          for (const m of st.minions) {
            const mx = Math.round(m.x - camX);
            const my = Math.round(m.y - camY);
            ctx.fillStyle = 'rgba(20, 32, 20, 0.3)';
            ctx.fillRect(mx - 11, my + 10, 22, 4);

            const mImg = spriteImgsRef.current[m.spriteKey];
            if (mImg && mImg.complete && mImg.naturalWidth > 0) {
              ctx.save();
              if (m.facingLeft) {
                ctx.translate(mx, my);
                ctx.scale(-1, 1);
                ctx.drawImage(mImg, -20, -24, 40, 40);
              } else {
                ctx.drawImage(mImg, mx - 20, my - 24, 40, 40);
              }
              ctx.restore();
            }

            // Orbiting Razor Leaves for Grass minions
            if (m.element === 'grass') {
              const blades = 2 + m.level;
              const orbitR = 48 + Math.min(20, m.level * 5);
              for (let b = 0; b < blades; b++) {
                const a = m.orbitAngle + (b * Math.PI * 2) / blades;
                const bx = Math.round(VIEW_W / 2 + Math.cos(a) * orbitR);
                const by = Math.round(VIEW_H / 2 + Math.sin(a) * orbitR);
                ctx.fillStyle = '#1c1926';
                ctx.fillRect(bx - 6, by - 4, 12, 8);
                ctx.fillStyle = '#40c057';
                ctx.fillRect(bx - 5, by - 3, 10, 6);
                ctx.fillStyle = '#b2f2bb';
                ctx.fillRect(bx - 3, by - 2, 4, 2);
              }
            }
          }

          // 7. Render Protagonist Trainer Red at Center of Camera (2x Authentic GBA Chibi!)
          const pcx = Math.round(VIEW_W / 2);
          const pcy = Math.round(VIEW_H / 2);
          ctx.save();
          if (st.invuln > 0 && Math.floor(st.invuln * 16) % 2 === 0) {
            ctx.globalAlpha = 0.45;
          }
          ctx.scale(2, 2);
          drawOverworldChar(ctx, Math.round(pcx / 2), Math.round(pcy / 2) + 8, 'red', st.facing, st.stepPhase);
          ctx.restore();

          // Protagonist Underfoot HP Bar
          const hpW = 36;
          ctx.fillStyle = '#1c1926';
          ctx.fillRect(pcx - hpW / 2 - 1, pcy + 19, hpW + 2, 6);
          ctx.fillStyle = '#3b1c22';
          ctx.fillRect(pcx - hpW / 2, pcy + 20, hpW, 4);
          ctx.fillStyle = st.hp / st.maxHp > 0.35 ? '#48d167' : '#ff4d4d';
          ctx.fillRect(pcx - hpW / 2, pcy + 20, Math.round(hpW * (st.hp / st.maxHp)), 4);

          // 8. Render Projectiles (Minion Skills + Enemy Pokéballs!)
          for (const b of st.bullets) {
            const bx = Math.round(b.x - camX);
            const by = Math.round(b.y - camY);
            ctx.fillStyle = '#1c1926';
            ctx.fillRect(bx - b.radius - 1, by - b.radius - 1, b.radius * 2 + 2, b.radius * 2 + 2);
            if (b.fromEnemy) {
              // Red/White Pokéball enemy projectile!
              ctx.fillStyle = '#e03131';
              ctx.fillRect(bx - b.radius, by - b.radius, b.radius * 2, b.radius);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(bx - b.radius, by, b.radius * 2, b.radius);
              ctx.fillStyle = '#1c1926';
              ctx.fillRect(bx - b.radius, by - 1, b.radius * 2, 2);
            } else {
              ctx.fillStyle = b.color;
              ctx.fillRect(bx - b.radius, by - b.radius, b.radius * 2, b.radius * 2);
              ctx.fillStyle = b.core;
              ctx.fillRect(bx - 2, by - 2, 4, 4);
            }
          }

          // 9. Lightning, Bursts & Floating Damage / Heal Numbers
          for (const v of st.vfxs) {
            const vx = Math.round(v.x - camX);
            const vy = Math.round(v.y - camY);
            if (v.kind === 'lightning') {
              ctx.fillStyle = '#ffd43b';
              ctx.fillRect(vx - 3, 0, 6, vy);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(vx - 1, 0, 2, vy);
              ctx.fillStyle = '#ffe066';
              ctx.fillRect(vx - 10, vy - 6, 20, 12);
            } else if (v.kind === 'burst') {
              const r = v.radius ?? 14;
              ctx.fillStyle = v.color;
              ctx.fillRect(vx - r / 2, vy - r / 2, r, r);
            } else if ((v.kind === 'dmg' || v.kind === 'heal') && v.text) {
              const rise = (1 - v.life / v.maxLife) * 18;
              ctx.font = 'bold 11px "Fusion Pixel", monospace';
              ctx.fillStyle = '#1c1926';
              ctx.fillText(v.text, vx - 13, vy - rise + 1);
              ctx.fillStyle = v.color;
              ctx.fillText(v.text, vx - 14, vy - rise);
            }
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.id, save.keyBindings]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    if (!st || pausedRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const cy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const worldX = st.px + (cx - VIEW_W / 2);
    const worldY = st.py + (cy - VIEW_H / 2);

    // Clicking directly on a Safe Zone's Poké Center or Mart while nearby triggers it immediately!
    const zones = getNearbySafeZones(st.px, st.py);
    for (const z of zones) {
      if (Math.hypot(st.px - z.x, st.py - z.y) < z.radius + 40) {
        const pcX = z.x - 48;
        const pcY = z.y - 36;
        const martX = z.x + 62;
        const martY = z.y - 36;
        if (Math.hypot(worldX - pcX, worldY - pcY) < 58) {
          triggerSafeZoneHeal();
          return;
        }
        if (Math.hypot(worldX - martX, worldY - martY) < 52) {
          openSafeShop();
          return;
        }
      }
    }

    pointerRef.current = { active: true, x: cx, y: cy };
    clickTargetRef.current = { x: worldX, y: worldY };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      active: true,
      x: ((e.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((e.clientY - rect.top) / rect.height) * VIEW_H,
    };
    clickTargetRef.current = null;
  };

  const activeRoom = ROOM_CATALOG.find((r) => r.id === pet.ballRoom) ?? ROOM_CATALOG[0];
  const minStr = `${Math.floor(hud.elapsedSec / 60)}:${String(hud.elapsedSec % 60).padStart(2, '0')}`;
  const xpPct = Math.min(100, Math.round((hud.xp / hud.xpNeed) * 100));

  // Compass directional arrow glyph toward nearest Safe Zone
  const dirs = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  const dirIdx = Math.round((((hud.nearestZoneDir.angle / (Math.PI * 2)) + 1) % 1) * 8) % 8;
  const safeArrow = dirs[dirIdx];

  return (
    <div className="survivors-screen">
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        className="survivors-canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={() => {
          pointerRef.current.active = false;
        }}
        onPointerLeave={() => {
          pointerRef.current.active = false;
        }}
      />

      {/* Full-Width Top Vampire Survivors XP Bar */}
      <div className="surv-xp-bar">
        <div className="surv-xp-fill" style={{ width: `${xpPct}%` }} />
        <span className="surv-lv-tag">LV.{hud.runLevel}</span>
      </div>

      {/* Compact Floating HUD Row (No bulky white web header!) */}
      <div className="surv-hud-row">
        <div className="surv-weapons-bar" title="当前已召唤出战的宝可梦随从">
          {minionsView.map((m) => (
            <span key={m.id} className="surv-wep-chip" title={`${m.name} Lv.${m.level}`}>
              <img src={m.sprite} alt={m.name} className="surv-minion-ico" draggable={false} />
              <em>{m.level}</em>
            </span>
          ))}
        </div>

        <div className={`surv-clock ${hud.inSafeZone ? 'is-safe' : ''}`}>
          {hud.inSafeZone ? '安全区' : minStr}
        </div>

        <div className="surv-right-stats">
          <span className="surv-stat-pill">击败 {hud.kills}</span>
          <span className="surv-stat-pill is-coin">+{hud.coins}</span>
          <button
            type="button"
            className="surv-top-btn is-ball"
            onClick={() => onFinish(pet.id, buildPayload(false), true)}
            title="结算战利品并放出宝可梦回到球舱养成"
          >
            <PixelItemImg src={activeRoom.ballSprite} size={14} />
            <span>回舱</span>
          </button>
          <button
            type="button"
            className="surv-top-btn"
            onClick={onOpenMenu}
            title="打开训练家菜单"
          >
            <PixelItemImg src="/sprites/items/poke-radar.png" size={14} />
          </button>
        </div>
      </div>

      {/* Roadside Safe Zone Radar Compass (when outside Safe Zone) */}
      {!hud.inSafeZone && !levelChoices && !shopOpen && !resultModal && (
        <div className="surv-compass-pill" title="沿着方向可找到安全区：免费回血与购买强化">
          <span>安全区 {safeArrow} {hud.nearestZoneDir.distM}m</span>
        </div>
      )}

      {/* Safe Zone Interactive Quick Action Bar (when standing inside Safe Zone!) */}
      {hud.inSafeZone && !levelChoices && !shopOpen && !resultModal && (
        <div className="surv-safe-actions">
          <button
            type="button"
            className="surv-safe-btn is-heal"
            onClick={triggerSafeZoneHeal}
          >
            <PixelItemImg src="/sprites/items/potion.png" size={15} />
            <span>精灵中心 · 免费回满血</span>
          </button>
          <button
            type="button"
            className="surv-safe-btn is-shop"
            onClick={openSafeShop}
          >
            <PixelItemImg src="/sprites/items/amulet-coin.png" size={15} />
            <span>友好商店 ({totalSpendableCoins})</span>
          </button>
        </div>
      )}

      {/* Compact Event Toast Banner */}
      {bannerMsg && !levelChoices && !shopOpen && !resultModal && (
        <div className="surv-event-banner">{bannerMsg}</div>
      )}

      {/* 3-Choice Level Up Modal: Summon Minions / Upgrade Skills / Passives */}
      {levelChoices && !resultModal && (
        <div className="surv-modal-backdrop">
          <div className="surv-upgrade-box">
            <div className="surv-upgrade-head">
              LEVEL UP! 召唤新随从或强化招式 ({minionsView.length}/{MAX_MINIONS} 随从)
            </div>
            <div className="surv-choice-list">
              {levelChoices.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="surv-choice-card"
                  onClick={() => handleChooseUpgrade(opt)}
                >
                  <div className="surv-choice-icon" style={{ borderColor: opt.color }}>
                    <img src={opt.sprite} alt={opt.title} className="surv-choice-img" draggable={false} />
                  </div>
                  <div className="surv-choice-info">
                    <div className="inline-icon-row">
                      <strong>{opt.title}</strong>
                      <span className="surv-lv-badge" style={{ backgroundColor: opt.color }}>
                        {opt.badge}
                      </span>
                    </div>
                    <small>{opt.desc}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Safe Zone Roadside Poké Mart Modal */}
      {shopOpen && !resultModal && (
        <div className="surv-modal-backdrop">
          <div className="surv-upgrade-box is-shop-modal">
            <div className="surv-upgrade-head shop-head-row">
              <span>安全区友好商店</span>
              <span className="shop-coin-badge">可用金币：{totalSpendableCoins}</span>
              <button type="button" className="lcd-mini-close" onClick={closeSafeShop}>
                继续冒险
              </button>
            </div>
            <div className="surv-choice-list">
              <button
                type="button"
                className="surv-choice-card"
                disabled={totalSpendableCoins < 15 || hud.hp >= hud.maxHp}
                onClick={() => buySafeShopItem('potion', 15)}
              >
                <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/potion.png" size={22} /></div>
                <div className="surv-choice-info">
                  <div className="inline-icon-row"><strong>超级伤药</strong><span className="surv-price-tag">15 金币</span></div>
                  <small>立刻回复主角 65% HP（当前 {hud.hp}/{hud.maxHp}）</small>
                </div>
              </button>
              <button
                type="button"
                className="surv-choice-card"
                disabled={totalSpendableCoins < 35}
                onClick={() => buySafeShopItem('summon', 35)}
              >
                <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/great-ball.png" size={22} /></div>
                <div className="surv-choice-info">
                  <div className="inline-icon-row">
                    <strong>{minionsView.length < MAX_MINIONS ? '招募增援宝可梦随从' : '全体随从等级 +1'}</strong>
                    <span className="surv-price-tag">35 金币</span>
                  </div>
                  <small>当前出战 {minionsView.length}/{MAX_MINIONS} 只随从，自动释放属性招式</small>
                </div>
              </button>
              <button
                type="button"
                className="surv-choice-card"
                disabled={totalSpendableCoins < 30}
                onClick={() => buySafeShopItem('tome', 30)}
              >
                <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/exp-share.png" size={22} /></div>
                <div className="surv-choice-info">
                  <div className="inline-icon-row"><strong>招式特训秘籍</strong><span className="surv-price-tag">30 金币</span></div>
                  <small>全员随从技能威力 +25% · 技能冷却 -10%</small>
                </div>
              </button>
              <button
                type="button"
                className="surv-choice-card"
                disabled={totalSpendableCoins < 25}
                onClick={() => buySafeShopItem('berry', 25)}
              >
                <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/sitrus-berry.png" size={22} /></div>
                <div className="surv-choice-info">
                  <div className="inline-icon-row"><strong>元气树果补给</strong><span className="surv-price-tag">25 金币</span></div>
                  <small>主角最大 HP 上限 +25% 并回复 35% 血量</small>
                </div>
              </button>
              <button
                type="button"
                className="surv-choice-card"
                disabled={totalSpendableCoins < 20}
                onClick={() => buySafeShopItem('magnet', 20)}
              >
                <div className="surv-choice-icon"><PixelItemImg src="/sprites/items/magnet.png" size={22} /></div>
                <div className="surv-choice-info">
                  <div className="inline-icon-row"><strong>极速磁力护符</strong><span className="surv-price-tag">20 金币</span></div>
                  <small>立刻吸取全图经验与金币 + 永久提升移速与吸取范围</small>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Defeat / Settlement Summary Modal */}
      {resultModal && (
        <div className="surv-modal-backdrop">
          <div className="surv-upgrade-box is-result">
            <div className="surv-upgrade-head">
              {resultModal.cleared ? '野外幸存者 · 大获全胜！' : '野外冒险 · 战利品结算'}
            </div>
            <div className="surv-result-stats">
              <div>探索时长：<strong>{resultModal.survivedSec} 秒</strong></div>
              <div>击败对手：<strong>{resultModal.kills} 名</strong></div>
              <div>随从阵容：<strong>{minionsView.length} 只</strong></div>
              <div>拾取金币：<strong>+{resultModal.coinsCollected}</strong></div>
            </div>
            <button
              type="button"
              className="lcd-inline-cta full"
              onClick={() => onFinish(pet.id, resultModal, true)}
            >
              领取奖励并回到精灵球舱
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
