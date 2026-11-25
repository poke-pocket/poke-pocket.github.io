import React, { useEffect, useRef, useState } from 'react';
import {
  ELEMENT_COLORS,
  ELEMENT_LABELS,
  computeBattleStats,
  generateWildOpponent,
  getHeldItemDamageBoost,
  getSpeciesMoves,
  getTypeMultiplier,
  type BattleMove,
  type WildEnemy,
} from '../data/battleMoves';
import {
  SPECIES_CATALOG,
  getGrowthStage,
  getPokemonCryId,
  getPokemonStageName,
  getXpForNextLevel,
} from '../data/catalog';
import type { GameSave, PetRecord } from '../types/pet';
import { MAX_PET_SLOTS, type BattleResultPayload } from '../utils/petEngine';
import { sound } from '../utils/sound';
import { BattleSkillVfx, type ActiveSkillVfx } from './BattleSkillVfx';
import { PixelItemImg, PixelPetSprite } from './PixelSprite';

interface BattleArenaProps {
  save: GameSave;
  activePet: PetRecord;
  isTrainer: boolean;
  onFinish: (activePetId: string, payload: BattleResultPayload) => void;
}

type BattleMenu = 'root' | 'moves' | 'party' | 'items';
type BattlePhase = 'player' | 'animating' | 'ended';

interface FloatingDmg {
  seq: number;
  target: 'enemy' | 'player';
  text: string;
  tone: 'normal' | 'super' | 'crit' | 'heal' | 'buff';
}

/** Rich layered 160x84 pure pixel-art GBA battlefield (Mountains, Forest / Gym Pillars, Wildflowers!) */
const PixelBattleBg: React.FC<{ isTrainer: boolean }> = ({ isTrainer }) => (
  <svg
    className="battle-bg-svg"
    viewBox="0 0 160 84"
    preserveAspectRatio="none"
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    {/* Layered Sky / Stadium Backdrop */}
    <rect x="0" y="0" width="160" height="16" fill={isTrainer ? '#4263eb' : '#74c0fc'} />
    <rect x="0" y="16" width="160" height="14" fill={isTrainer ? '#748ffc' : '#a5d8ff'} />
    <rect x="0" y="30" width="160" height="10" fill={isTrainer ? '#bac8ff' : '#d0ebff'} />

    {isTrainer ? (
      <>
        {/* Gym Stadium Columns & Hanging Banners */}
        {[8, 36, 114, 142].map((cx) => (
          <g key={cx}>
            <rect x={cx} y="4" width="10" height="36" fill="#364fc7" />
            <rect x={cx + 2} y="4" width="3" height="36" fill="#5c7cfa" />
            <rect x={cx - 1} y="4" width="12" height="3" fill="#ffd43b" />
            <rect x={cx - 1} y="37" width="12" height="3" fill="#ffd43b" />
          </g>
        ))}
        {/* Stadium Pennant */}
        <rect x="64" y="6" width="32" height="18" fill="#1c1926" />
        <rect x="65" y="7" width="30" height="16" fill="#e03131" />
        <rect x="65" y="14" width="30" height="2" fill="#1c1926" />
        <rect x="65" y="16" width="30" height="7" fill="#ffffff" />
        <rect x="78" y="13" width="4" height="4" fill="#ffe066" />
        {/* Gym Arena Floor */}
        <rect x="0" y="40" width="160" height="44" fill="#dee2e6" />
        <rect x="0" y="40" width="160" height="2" fill="#495057" />
        {/* Arena Court Stripes */}
        <rect x="0" y="59" width="160" height="2" fill="#adb5bd" />
        <rect x="76" y="42" width="8" height="42" fill="#ced4da" />
      </>
    ) : (
      <>
        {/* Stepped Pixel Clouds */}
        <rect x="12" y="5" width="18" height="4" fill="#ffffff" />
        <rect x="16" y="3" width="10" height="2" fill="#ffffff" />
        <rect x="106" y="7" width="22" height="4" fill="#ffffff" />
        <rect x="112" y="5" width="10" height="2" fill="#ffffff" />
        {/* Distant Blue-Green Mountain Ridge */}
        <rect x="20" y="24" width="26" height="12" fill="#74b816" opacity={0.45} />
        <rect x="26" y="20" width="14" height="4" fill="#74b816" opacity={0.45} />
        <rect x="96" y="22" width="32" height="14" fill="#5c940d" opacity={0.4} />
        <rect x="104" y="18" width="16" height="4" fill="#5c940d" opacity={0.4} />
        {/* Lush Pixel Forest Treeline */}
        <rect x="0" y="31" width="160" height="9" fill="#2f9e44" />
        {[0, 10, 22, 34, 48, 62, 76, 90, 104, 118, 132, 146].map((tx, i) => (
          <g key={tx}>
            <rect x={tx} y={i % 2 === 0 ? 27 : 29} width="10" height={i % 2 === 0 ? 6 : 4} fill="#37b24d" />
            <rect x={tx + 2} y={i % 2 === 0 ? 26 : 28} width="5" height="2" fill="#69db7c" />
          </g>
        ))}
        {/* Sunlit Meadow Floor + Wildflowers */}
        <rect x="0" y="40" width="160" height="44" fill="#b2f2bb" />
        <rect x="0" y="40" width="160" height="2" fill="#51cf66" />
        <rect x="0" y="56" width="160" height="14" fill="#a9ebaf" />
        {/* Wildflower & Grass Tufts */}
        {[
          [12, 47, '#ffd43b'],
          [56, 44, '#ff8787'],
          [78, 52, '#ffffff'],
          [138, 66, '#ffd43b'],
          [88, 74, '#ff8787'],
          [66, 68, '#ffffff'],
        ].map(([fx, fy, col], i) => (
          <g key={i}>
            <rect x={fx as number} y={(fy as number) + 1} width="3" height="2" fill="#40c057" />
            <rect x={(fx as number) + 1} y={fy as number} width="2" height="2" fill={col as string} />
          </g>
        ))}
      </>
    )}

    {/* Enemy Stepped Pixel Oval Platform (Top-Right) */}
    <rect x="90" y="43" width="56" height="10" fill={isTrainer ? '#868e96' : '#40c057'} />
    <rect x="95" y="41" width="46" height="14" fill={isTrainer ? '#868e96' : '#40c057'} />
    <rect x="95" y="43" width="46" height="10" fill={isTrainer ? '#ced4da' : '#69db7c'} />
    <rect x="100" y="45" width="36" height="6" fill={isTrainer ? '#f1f3f5' : '#b2f2bb'} />

    {/* Player Stepped Pixel Oval Platform (Bottom-Left) */}
    <rect x="8" y="68" width="64" height="12" fill={isTrainer ? '#868e96' : '#40c057'} />
    <rect x="14" y="66" width="52" height="16" fill={isTrainer ? '#868e96' : '#40c057'} />
    <rect x="14" y="68" width="52" height="12" fill={isTrainer ? '#ced4da' : '#69db7c'} />
    <rect x="19" y="70" width="42" height="8" fill={isTrainer ? '#f1f3f5' : '#b2f2bb'} />
  </svg>
);

export const BattleArena: React.FC<BattleArenaProps> = ({
  save,
  activePet,
  isTrainer,
  onFinish,
}) => {
  const [fighterId, setFighterId] = useState(activePet.id);
  const fighter = save.pets.find((p) => p.id === fighterId) ?? activePet;
  const fighterStats = computeBattleStats(fighter);
  const fighterMeta = SPECIES_CATALOG[fighter.species];
  const fighterStage = getGrowthStage(fighter.level, fighter.species);
  const fighterMoves = getSpeciesMoves(fighter.species);

  const [hpMap, setHpMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const p of save.pets) {
      const st = computeBattleStats(p);
      map[p.id] = Math.max(1, Math.round((p.health / 100) * st.maxHp));
    }
    return map;
  });

  const [ppMap, setPpMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const m of fighterMoves) map[m.id] = m.maxPp;
    return map;
  });

  const [enemy, setEnemy] = useState<WildEnemy>(() =>
    generateWildOpponent(activePet.level, isTrainer),
  );
  const enemyMeta = SPECIES_CATALOG[enemy.species];
  const enemyStage = getGrowthStage(enemy.level, enemy.species);
  const enemyStageName = getPokemonStageName(enemy.species, enemy.level);

  const [menu, setMenu] = useState<BattleMenu>('root');
  const [phase, setPhase] = useState<BattlePhase>('player');
  const [atkBuff, setAtkBuff] = useState(1.0);
  const [defBuff, setDefBuff] = useState(1.0);
  const [enemyAtkBuff, setEnemyAtkBuff] = useState(1.0);
  const [potionsLeft, setPotionsLeft] = useState(2);
  const [sashUsed, setSashUsed] = useState(false);
  const [bonusCoins, setBonusCoins] = useState(0);

  const [playerMotion, setPlayerMotion] = useState<'idle' | 'lunge' | 'hit'>('idle');
  const [enemyMotion, setEnemyMotion] = useState<'idle' | 'lunge' | 'hit' | 'ball'>('idle');
  const [activeVfx, setActiveVfx] = useState<ActiveSkillVfx | null>(null);
  const [floatingDmg, setFloatingDmg] = useState<FloatingDmg | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [log, setLog] = useState<string>(() =>
    isTrainer
      ? `${enemy.trainerTitle ?? '训练家'} 派出了 Lv.${enemy.level} ${enemyStageName}！`
      : `野生的 Lv.${enemy.level} ${enemyStageName} 跳出来了！`,
  );
  const [endSummary, setEndSummary] = useState<{
    result: BattleResultPayload['result'];
    text: string;
  } | null>(null);

  const timersRef = useRef<number[]>([]);
  const seqRef = useRef(0);
  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  useEffect(() => {
    // Play opponent's authentic cry when entering battle!
    const cryTimer = window.setTimeout(() => {
      sound.playCry(getPokemonCryId(enemy.species, enemy.level));
    }, 180);
    return () => {
      window.clearTimeout(cryTimer);
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerVfx = (
    element: BattleMove['element'],
    kind: BattleMove['kind'],
    target: 'enemy' | 'player',
    bonusCoinsFlag?: boolean,
  ) => {
    seqRef.current += 1;
    setActiveVfx({ seq: seqRef.current, element, kind, target, bonusCoins: bonusCoinsFlag });
    schedule(() => setActiveVfx(null), 580);
  };

  const triggerDmgPopup = (
    target: 'enemy' | 'player',
    text: string,
    tone: FloatingDmg['tone'],
  ) => {
    seqRef.current += 1;
    setFloatingDmg({ seq: seqRef.current, target, text, tone });
    schedule(() => setFloatingDmg(null), 820);
  };

  const triggerShake = () => {
    setScreenShake(true);
    schedule(() => setScreenShake(false), 320);
  };

  const curPlayerHp = hpMap[fighter.id] ?? fighterStats.maxHp;
  const playerHpPct = Math.max(0, Math.min(100, Math.round((curPlayerHp / fighterStats.maxHp) * 100)));
  const enemyHpPct = Math.max(0, Math.min(100, Math.round((enemy.hp / enemy.maxHp) * 100)));
  const xpPct = Math.min(100, Math.round((fighter.xp / getXpForNextLevel(fighter.level)) * 100));

  const hpColor = (pct: number) =>
    pct >= 55 ? '#48d167' : pct >= 25 ? '#f5c52b' : '#f04e4e';

  const finishBattle = (result: BattleResultPayload['result'], finalHp: number, text: string) => {
    setPhase('ended');
    setMenu('root');
    setLog(text);
    setEndSummary({ result, text });
    if (result === 'win' || result === 'caught') {
      sound.play('levelup');
    } else if (result === 'lose') {
      sound.play('error');
    } else {
      sound.play('cancel');
    }
    const finalPct = Math.round((finalHp / fighterStats.maxHp) * 100);
    schedule(() => {
      onFinish(fighter.id, {
        result,
        enemySpecies: enemy.species,
        enemyLevel: enemy.level,
        isTrainer,
        remainingHpPct: finalPct,
        bonusCoinsFromMoves: bonusCoins,
      });
    }, 1500);
  };

  const runEnemyTurn = (currentPlayerHp: number, currentEnemy: WildEnemy) => {
    const dmgMoves = currentEnemy.moves.filter((m) => m.kind === 'damage');
    const chosen =
      Math.random() < 0.18 && currentEnemy.moves.length >= 3
        ? currentEnemy.moves[2]
        : dmgMoves[Math.floor(Math.random() * dmgMoves.length)] ?? currentEnemy.moves[0];

    setLog(`对手的 ${enemyStageName} 使用了 ${chosen.name}！`);
    setEnemyMotion('lunge');
    sound.play('cursor');

    schedule(() => {
      setEnemyMotion('idle');
      if (chosen.kind === 'buff_atk' || chosen.kind === 'buff_def') {
        if (chosen.kind === 'buff_atk') setEnemyAtkBuff((b) => Math.min(1.6, b + 0.2));
        triggerVfx(chosen.element, chosen.kind, 'enemy');
        triggerDmgPopup('enemy', chosen.kind === 'buff_atk' ? '攻UP!' : '防UP!', 'buff');
        setLog(`对手的 ${enemyStageName} 气势提升了！`);
        schedule(() => setPhase('player'), 700);
        return;
      }
      if (chosen.kind === 'heal') {
        const healAmt = Math.round(currentEnemy.maxHp * 0.28);
        setEnemy((e) => ({ ...e, hp: Math.min(e.maxHp, e.hp + healAmt) }));
        triggerVfx(chosen.element, 'heal', 'enemy');
        triggerDmgPopup('enemy', `+${healAmt} HP`, 'heal');
        setLog(`对手的 ${enemyStageName} 回复了 ${healAmt} HP！`);
        schedule(() => setPhase('player'), 700);
        return;
      }

      const typeMult = getTypeMultiplier(chosen.element, fighterMeta.element);
      const raw =
        ((chosen.power * (currentEnemy.atk * enemyAtkBuff)) /
          Math.max(10, fighterStats.def * defBuff * 4.2)) *
        typeMult *
        (0.88 + Math.random() * 0.24);
      const dmg = Math.max(3, Math.round(raw));

      triggerVfx(chosen.element, 'damage', 'player', chosen.bonusCoins);
      setPlayerMotion('hit');
      if (typeMult > 1) triggerShake();
      sound.play('error');

      let nextHp = Math.max(0, currentPlayerHp - dmg);
      let endured = false;
      if (nextHp === 0 && fighter.accessory === 'focus_sash' && !sashUsed && currentPlayerHp > 1) {
        nextHp = 1;
        endured = true;
        setSashUsed(true);
      }

      setHpMap((prev) => ({ ...prev, [fighter.id]: nextHp }));
      triggerDmgPopup(
        'player',
        endured ? '撑住了!' : `-${dmg}`,
        typeMult > 1 ? 'super' : 'normal',
      );
      const effMsg =
        typeMult > 1 ? '效果拔群！' : typeMult < 1 ? '效果不太好…' : '';
      setLog(
        endured
          ? `${fighter.name} 靠气势披带撑住了 1 点 HP！`
          : `${fighter.name} 受到 ${dmg} 点伤害！${effMsg}`,
      );

      schedule(() => {
        setPlayerMotion('idle');
        if (nextHp <= 0) {
          finishBattle(
            'lose',
            0,
            `${fighter.name} 体力耗尽倒下了！紧急收回球中休整…`,
          );
          return;
        }
        if (fighter.accessory === 'leftovers' && nextHp < fighterStats.maxHp) {
          const regen = Math.max(2, Math.round(fighterStats.maxHp * 0.08));
          const healed = Math.min(fighterStats.maxHp, nextHp + regen);
          setHpMap((prev) => ({ ...prev, [fighter.id]: healed }));
          triggerVfx('grass', 'heal', 'player');
          triggerDmgPopup('player', `+${healed - nextHp}`, 'heal');
          setLog(`${fighter.name} 吃了一口吃剩的东西，回复 ${healed - nextHp} HP！`);
          schedule(() => setPhase('player'), 680);
        } else {
          setPhase('player');
        }
      }, 700);
    }, 400);
  };

  const handleUseMove = (move: BattleMove) => {
    if (phase !== 'player') return;
    const remPp = ppMap[move.id] ?? move.maxPp;
    if (remPp <= 0) {
      sound.play('error');
      setLog(`${move.name} 的 PP 已经用光了！`);
      return;
    }

    setMenu('root');
    setPhase('animating');
    setPpMap((prev) => ({ ...prev, [move.id]: remPp - 1 }));
    setLog(`${fighter.name} 使用了 ${move.name}！`);
    setPlayerMotion('lunge');
    sound.play('confirm');

    schedule(() => {
      setPlayerMotion('idle');

      if (move.kind === 'buff_atk' || move.kind === 'buff_def') {
        if (move.kind === 'buff_atk') setAtkBuff((b) => Math.min(1.8, b + 0.25));
        else setDefBuff((b) => Math.min(1.8, b + 0.25));
        triggerVfx(move.element, move.kind, 'player');
        triggerDmgPopup('player', move.kind === 'buff_atk' ? '攻击UP!' : '防御UP!', 'buff');
        sound.play('happy');
        setLog(`${fighter.name} 的${move.kind === 'buff_atk' ? '攻击' : '防御'}大幅提升了！`);
        schedule(() => runEnemyTurn(curPlayerHp, enemy), 700);
        return;
      }
      if (move.kind === 'heal') {
        const healAmt = Math.round(fighterStats.maxHp * 0.36);
        const nextHp = Math.min(fighterStats.maxHp, curPlayerHp + healAmt);
        setHpMap((prev) => ({ ...prev, [fighter.id]: nextHp }));
        triggerVfx(move.element, 'heal', 'player');
        triggerDmgPopup('player', `+${nextHp - curPlayerHp} HP`, 'heal');
        sound.play('bath');
        setLog(`${fighter.name} 回复了 ${nextHp - curPlayerHp} 点 HP！`);
        schedule(() => runEnemyTurn(nextHp, enemy), 700);
        return;
      }

      const stab = move.element === fighterMeta.element ? 1.15 : 1.0;
      const typeMult = getTypeMultiplier(move.element, enemyMeta.element);
      const itemBoost = getHeldItemDamageBoost(fighter, move.element);
      const critChance =
        0.08 +
        (fighter.happiness >= 85 ? 0.08 : 0) +
        (fighter.accessory === 'scope_lens' ? 0.14 : 0);
      const isCrit = Math.random() < critChance;
      const critMult = isCrit ? 1.45 : 1.0;

      const raw =
        ((move.power * (fighterStats.atk * atkBuff)) / Math.max(10, enemy.def * 4.0)) *
        stab *
        typeMult *
        itemBoost *
        critMult *
        (0.9 + Math.random() * 0.2);
      const dmg = Math.max(4, Math.round(raw));

      if (move.bonusCoins) {
        setBonusCoins((c) => c + 15);
      }

      const nextEnemyHp = Math.max(0, enemy.hp - dmg);
      const updatedEnemy = { ...enemy, hp: nextEnemyHp };
      setEnemy(updatedEnemy);
      triggerVfx(move.element, 'damage', 'enemy', move.bonusCoins);
      setEnemyMotion('hit');
      if (typeMult > 1 || isCrit) triggerShake();
      sound.play(typeMult > 1 || isCrit ? 'coin' : 'eat');

      triggerDmgPopup(
        'enemy',
        isCrit ? `要害 -${dmg}!` : typeMult > 1 ? `拔群 -${dmg}!` : `-${dmg}`,
        isCrit ? 'crit' : typeMult > 1 ? 'super' : 'normal',
      );

      let nextPlayerHp = curPlayerHp;
      if (fighter.accessory === 'shell_bell' && curPlayerHp < fighterStats.maxHp) {
        const vamp = Math.max(2, Math.round(dmg * 0.18));
        nextPlayerHp = Math.min(fighterStats.maxHp, curPlayerHp + vamp);
        setHpMap((prev) => ({ ...prev, [fighter.id]: nextPlayerHp }));
      }

      const notes = [
        isCrit ? '击中要害！' : '',
        typeMult > 1 ? '效果拔群！' : typeMult < 1 ? '效果不太好…' : '',
      ]
        .filter(Boolean)
        .join(' ');
      setLog(`造成了 ${dmg} 点伤害！${notes}`);

      schedule(() => {
        setEnemyMotion('idle');
        if (nextEnemyHp <= 0) {
          finishBattle(
            'win',
            nextPlayerHp,
            `对手的 ${enemyStageName} 倒下了！${fighter.name} 获得胜利！`,
          );
          return;
        }
        runEnemyTurn(nextPlayerHp, updatedEnemy);
      }, 700);
    }, 380);
  };

  const handleUsePotion = () => {
    if (phase !== 'player' || potionsLeft <= 0 || curPlayerHp >= fighterStats.maxHp) return;
    setMenu('root');
    setPhase('animating');
    setPotionsLeft((n) => n - 1);
    const healAmt = Math.round(fighterStats.maxHp * 0.5);
    const nextHp = Math.min(fighterStats.maxHp, curPlayerHp + healAmt);
    setHpMap((prev) => ({ ...prev, [fighter.id]: nextHp }));
    triggerVfx('grass', 'heal', 'player');
    triggerDmgPopup('player', `+${nextHp - curPlayerHp} HP`, 'heal');
    sound.play('happy');
    setLog(`使用了伤药！${fighter.name} 回复了 ${nextHp - curPlayerHp} HP！`);
    schedule(() => runEnemyTurn(nextHp, enemy), 750);
  };

  const handleThrowPokeball = () => {
    if (phase !== 'player' || isTrainer) return;
    if (save.pets.length >= MAX_PET_SLOTS) {
      sound.play('error');
      setLog(`精灵球盒已满（${MAX_PET_SLOTS}/${MAX_PET_SLOTS}），无法收服！`);
      return;
    }
    setMenu('root');
    setPhase('animating');
    setEnemyMotion('ball');
    sound.play('hatch');
    setLog(`投出了精灵球！精灵球正在剧烈摇晃…`);

    const hpRatio = enemy.hp / enemy.maxHp;
    const rarityPenalty =
      enemyMeta.rarity === 'SSR' ? 0.25 : enemyMeta.rarity === 'SR' ? 0.12 : 0;
    const catchChance = Math.max(0.18, Math.min(0.92, 0.85 - hpRatio * 0.58 - rarityPenalty));
    const caught = Math.random() < catchChance;

    schedule(() => {
      if (caught) {
        triggerVfx('fairy', 'heal', 'enemy');
        finishBattle(
          'caught',
          curPlayerHp,
          `咔哒！成功收服了野生 ${enemyStageName}！`,
        );
      } else {
        setEnemyMotion('idle');
        sound.play('cancel');
        setLog(`啊！野生 ${enemyStageName} 挣脱了精灵球！`);
        schedule(() => runEnemyTurn(curPlayerHp, enemy), 750);
      }
    }, 1150);
  };

  const handleSwitchFighter = (nextPet: PetRecord) => {
    if (phase !== 'player' || nextPet.id === fighter.id) return;
    const nextHp = hpMap[nextPet.id] ?? computeBattleStats(nextPet).maxHp;
    if (nextHp <= 0) return;
    setMenu('root');
    setPhase('animating');
    setFighterId(nextPet.id);
    setAtkBuff(1.0);
    setDefBuff(1.0);
    setSashUsed(false);
    setPpMap((prev) => {
      const next = { ...prev };
      for (const m of getSpeciesMoves(nextPet.species)) {
        if (next[m.id] === undefined) next[m.id] = m.maxPp;
      }
      return next;
    });
    sound.play('confirm');
    sound.playCry(getPokemonCryId(nextPet.species, nextPet.level));
    setLog(`回来吧 ${fighter.name}！就决定是你了，${nextPet.name}！`);
    schedule(() => runEnemyTurn(nextHp, enemy), 800);
  };

  const handleRun = () => {
    if (phase !== 'player') return;
    finishBattle('run', curPlayerHp, '顺利逃离了对战！');
  };

  return (
    <div className={`battle-screen ${screenShake ? 'is-shaking' : ''}`}>
      {/* Upper GBA Battlefield */}
      <div className="battle-stage">
        <PixelBattleBg isTrainer={isTrainer} />

        {/* Enemy Status Box + Trainer Portrait Badge (Top-Left) */}
        <div className="battle-hud enemy-hud">
          {isTrainer && enemy.trainerSprite && (
            <div className="battle-trainer-strip">
              <img
                src={enemy.trainerSprite}
                alt={enemy.trainerTitle}
                className="battle-trainer-thumb"
                draggable={false}
              />
              <span>{enemy.trainerTitle}</span>
            </div>
          )}
          <div className="battle-hud-top">
            <strong>{enemyStageName}</strong>
            <span
              className="battle-type-dot"
              style={{ backgroundColor: ELEMENT_COLORS[enemyMeta.element] }}
            >
              {ELEMENT_LABELS[enemyMeta.element]}
            </span>
            <span className="battle-lv">Lv.{enemy.level}</span>
          </div>
          <div className="gba-hp-line">
            <span className="hp-tag">HP</span>
            <div className="gba-hp-track">
              <div
                className="gba-hp-fill"
                style={{ width: `${enemyHpPct}%`, backgroundColor: hpColor(enemyHpPct) }}
              />
            </div>
          </div>
        </div>

        {/* Opponent Official Pixel Trainer Sprite standing behind enemy in Trainer/Gym duels! */}
        {isTrainer && enemy.trainerSprite && (
          <img
            src={enemy.trainerSprite}
            alt={enemy.trainerTitle}
            className="battle-enemy-trainer-full"
            draggable={false}
          />
        )}

        {/* Enemy Sprite or Shaking Capture Pokeball (Top-Right) */}
        <div className={`battle-sprite enemy-sprite motion-${enemyMotion}`}>
          {enemyMotion === 'ball' ? (
            <div className="gacha-ball-shake">
              <PixelItemImg src="/sprites/items/poke-ball.png" size={38} />
            </div>
          ) : (
            <PixelPetSprite
              species={enemy.species}
              stage={enemyStage}
              size={88}
              flipX
            />
          )}
        </div>

        {/* Player Sprite (Bottom-Left) */}
        <div className={`battle-sprite player-sprite motion-${playerMotion}`}>
          <PixelPetSprite
            species={fighter.species}
            stage={fighterStage}
            size={96}
          />
        </div>

        {/* Elemental Pixel Skill VFX Overlay */}
        {activeVfx && <BattleSkillVfx key={activeVfx.seq} vfx={activeVfx} />}

        {/* Floating Pixel Damage / Heal / Buff Popup */}
        {floatingDmg && (
          <div
            key={floatingDmg.seq}
            className={`battle-dmg-pop on-${floatingDmg.target} tone-${floatingDmg.tone}`}
          >
            {floatingDmg.text}
          </div>
        )}

        {/* Player Status Box (Bottom-Right) */}
        <div className="battle-hud player-hud">
          <div className="battle-hud-top">
            <img
              src="/sprites/trainers/red.png"
              alt="训练家"
              className="battle-trainer-thumb"
              draggable={false}
            />
            <strong>{fighter.name}</strong>
            <span
              className="battle-type-dot"
              style={{ backgroundColor: ELEMENT_COLORS[fighterMeta.element] }}
            >
              {ELEMENT_LABELS[fighterMeta.element]}
            </span>
            <span className="battle-lv">Lv.{fighter.level}</span>
          </div>
          <div className="gba-hp-line">
            <span className="hp-tag">HP</span>
            <div className="gba-hp-track">
              <div
                className="gba-hp-fill"
                style={{ width: `${playerHpPct}%`, backgroundColor: hpColor(playerHpPct) }}
              />
            </div>
          </div>
          <div className="battle-hp-nums">
            <span>
              {curPlayerHp}/{fighterStats.maxHp}
            </span>
            <div className="gba-exp-track battle-exp">
              <div className="gba-exp-fill" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Lower GBA Split Command Deck */}
      <div className="battle-deck">
        <div className="battle-log-box">
          <span>{endSummary ? endSummary.text : log}</span>
        </div>

        <div className="battle-cmd-box">
          {menu === 'root' && (
            <div className="battle-grid-2">
              <button
                type="button"
                className="battle-btn is-fight"
                disabled={phase !== 'player'}
                onClick={() => {
                  sound.play('cursor');
                  setMenu('moves');
                }}
              >
                战斗
              </button>
              <button
                type="button"
                className="battle-btn is-bag"
                disabled={phase !== 'player'}
                onClick={() => {
                  sound.play('cursor');
                  setMenu('items');
                }}
              >
                道具
              </button>
              <button
                type="button"
                className="battle-btn is-party"
                disabled={phase !== 'player' || save.pets.length <= 1}
                onClick={() => {
                  sound.play('cursor');
                  setMenu('party');
                }}
              >
                换球
              </button>
              <button
                type="button"
                className="battle-btn is-run"
                disabled={phase !== 'player'}
                onClick={handleRun}
              >
                逃跑
              </button>
            </div>
          )}

          {menu === 'moves' && (
            <div className="battle-subpanel">
              <div className="battle-grid-2">
                {fighterMoves.map((mv) => {
                  const rem = ppMap[mv.id] ?? mv.maxPp;
                  return (
                    <button
                      key={mv.id}
                      type="button"
                      disabled={phase !== 'player' || rem <= 0}
                      className="battle-move-btn"
                      onClick={() => handleUseMove(mv)}
                      title={`${mv.description}（威力 ${mv.power || '辅助'}）`}
                    >
                      <span
                        className="move-el-bar"
                        style={{ backgroundColor: ELEMENT_COLORS[mv.element] }}
                      />
                      <span className="move-name">{mv.name}</span>
                      <em className="move-pp">
                        {rem}/{mv.maxPp}
                      </em>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="battle-back-btn"
                onClick={() => setMenu('root')}
              >
                ← 返回
              </button>
            </div>
          )}

          {menu === 'items' && (
            <div className="battle-subpanel">
              <div className="battle-grid-2">
                <button
                  type="button"
                  disabled={
                    phase !== 'player' || potionsLeft <= 0 || curPlayerHp >= fighterStats.maxHp
                  }
                  className="battle-move-btn"
                  onClick={handleUsePotion}
                >
                  <PixelItemImg src="/sprites/items/potion.png" size={16} />
                  <span className="move-name">伤药 ×{potionsLeft}</span>
                </button>
                <button
                  type="button"
                  disabled={
                    phase !== 'player' || isTrainer || save.pets.length >= MAX_PET_SLOTS
                  }
                  className="battle-move-btn"
                  onClick={handleThrowPokeball}
                  title={isTrainer ? '训练家切磋中不能收服对手宝可梦' : '投掷精灵球收服野生宝可梦！'}
                >
                  <PixelItemImg src="/sprites/items/poke-ball.png" size={16} />
                  <span className="move-name">{isTrainer ? '不可收服' : '投精灵球'}</span>
                </button>
              </div>
              <button
                type="button"
                className="battle-back-btn"
                onClick={() => setMenu('root')}
              >
                ← 返回
              </button>
            </div>
          )}

          {menu === 'party' && (
            <div className="battle-subpanel">
              <div className="battle-party-strip">
                {save.pets.map((p) => {
                  const st = computeBattleStats(p);
                  const php = hpMap[p.id] ?? st.maxHp;
                  const isCur = p.id === fighter.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={phase !== 'player' || isCur || php <= 0}
                      className={`battle-party-chip ${isCur ? 'is-cur' : ''}`}
                      onClick={() => handleSwitchFighter(p)}
                    >
                      <span>{p.name}</span>
                      <em>
                        {php}/{st.maxHp}
                      </em>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="battle-back-btn"
                onClick={() => setMenu('root')}
              >
                ← 返回
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
