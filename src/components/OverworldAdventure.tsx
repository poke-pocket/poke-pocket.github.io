import React, { useEffect, useRef, useState } from 'react';
import { ROOM_CATALOG, getGrowthStage } from '../data/catalog';
import {
  CANVAS_H,
  CANVAS_W,
  MAP_COLS,
  MAP_ROWS,
  TILE_SIZE,
  findTilePath,
  getTileAt,
  isTileWalkable,
  renderOverworldCanvas,
  type FacingDir,
  type TilePoint,
} from '../data/overworldTiles';
import type { GameSave, PetRecord } from '../types/pet';
import { STAMINA_COSTS } from '../utils/petEngine';
import { sound } from '../utils/sound';
import { PixelIcon, PixelItemImg, PixelPetSprite } from './PixelSprite';

interface OverworldAdventureProps {
  save: GameSave;
  pet: PetRecord;
  controlSignal: {
    seq: number;
    dir: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | null;
  };
  onReleaseBallToRoom: () => void;
  onStartBattle: (isTrainer: boolean) => void;
  onHealParty: () => void;
  onSwitchPet: (petId: string) => void;
  onOpenMenu: () => void;
  onOpenMarket: () => void;
}

interface DialogueOverlay {
  speaker?: string;
  portrait?: string;
  text: string;
}

export const OverworldAdventure: React.FC<OverworldAdventureProps> = ({
  save,
  pet,
  controlSignal,
  onReleaseBallToRoom,
  onStartBattle,
  onHealParty,
  onSwitchPet,
  onOpenMenu,
  onOpenMarket,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pos, setPos] = useState<TilePoint>({ x: 5, y: 6 });
  const [followerPos, setFollowerPos] = useState<TilePoint>({ x: 4, y: 6 });
  const [facing, setFacing] = useState<FacingDir>('down');
  const [stepCount, setStepCount] = useState(0);
  const [animFrame, setAnimFrame] = useState(0);
  const [walkQueue, setWalkQueue] = useState<TilePoint[]>([]);
  const [pendingAction, setPendingAction] = useState<'none' | 'rival' | 'misty' | 'sign' | 'wild'>('none');
  const [targetTile, setTargetTile] = useState<TilePoint | null>(null);
  const [alertBang, setAlertBang] = useState(false);
  const [dialogue, setDialogue] = useState<DialogueOverlay | null>(null);

  const activeRoom = ROOM_CATALOG.find((r) => r.id === pet.ballRoom) ?? ROOM_CATALOG[0];
  const petStage = getGrowthStage(pet.level, pet.species);

  // Ambient GBA tile animation (water glints, flowers & tall grass swaying every 420ms)
  useEffect(() => {
    const t = window.setInterval(() => setAnimFrame((f) => (f + 1) % 4), 420);
    return () => window.clearInterval(t);
  }, []);

  // Re-render 240x160 authentic FireRed pixel-art canvas whenever state updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderOverworldCanvas(
      ctx,
      animFrame,
      { x: pos.x * TILE_SIZE + 8, y: pos.y * TILE_SIZE + 15 },
      facing,
      stepCount,
      targetTile,
    );
  }, [animFrame, pos, facing, stepCount, targetTile]);

  const triggerBattle = (isTrainer: boolean, introSpeaker?: string, introPortrait?: string) => {
    if (save.stamina < STAMINA_COSTS.battle) {
      sound.play('error');
      setDialogue({
        speaker: '提示',
        text: `训练家体力不足（对战需要 ${STAMINA_COSTS.battle} 体力，请等待时间恢复）。`,
      });
      return;
    }
    if (pet.health <= 20) {
      sound.play('error');
      setDialogue({
        speaker: '乔伊小姐',
        portrait: '/sprites/trainers/nurse.png',
        text: `${pet.name} 体力过低，先点击红顶「精灵中心」免费回复全队 HP 吧！`,
      });
      return;
    }
    setWalkQueue([]);
    setTargetTile(null);
    setAlertBang(true);
    sound.play('confirm');
    setDialogue({
      speaker: introSpeaker,
      portrait: introPortrait,
      text: isTrainer
        ? `${introSpeaker ?? '道馆训练家'}：目光交汇了！来一场堂堂正正的宝可梦对战吧！`
        : '！茂密草丛沙沙作响，野生的宝可梦跳出来了！',
    });
    window.setTimeout(() => {
      setAlertBang(false);
      setDialogue(null);
      onStartBattle(isTrainer);
    }, 620);
  };

  const handleTileArrival = (nx: number, ny: number, fromClick = false) => {
    const tile = getTileAt(nx, ny);
    if (tile === 'C') {
      onHealParty();
      setWalkQueue([]);
      setTargetTile(null);
      setDialogue({
        speaker: '乔伊小姐',
        portrait: '/sprites/trainers/nurse.png',
        text: '欢迎来到精灵中心！叮咚叮咚～全队宝可梦的 HP 已完全恢复！',
      });
      return true;
    }
    if (tile === 'M') {
      sound.play('confirm');
      setWalkQueue([]);
      setTargetTile(null);
      onOpenMarket();
      return true;
    }
    if (tile === 'G') {
      // Higher encounter chance if player explicitly clicked a grass patch to hunt!
      const chance = fromClick ? 0.55 : 0.34;
      if (Math.random() < chance) {
        triggerBattle(false);
        return true;
      }
    }
    return false;
  };

  const stepOne = (dx: number, dy: number, fromClick = false) => {
    if (alertBang) return false;
    const nextFacing: FacingDir =
      dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
    setFacing(nextFacing);

    const nx = pos.x + dx;
    const ny = pos.y + dy;
    const tile = getTileAt(nx, ny);

    if (tile === 'R') {
      triggerBattle(true, '劲敌 小茂', '/sprites/trainers/blue.png');
      return false;
    }
    if (tile === 'L') {
      triggerBattle(true, '华蓝道馆 小霞', '/sprites/trainers/misty.png');
      return false;
    }
    if (tile === 'S') {
      sound.play('cursor');
      setDialogue({
        speaker: '道路路牌',
        text: '【关都 1 号道路】西北：精灵中心｜东北：友好商店｜草丛可收服野生宝可梦！',
      });
      return false;
    }
    if (!isTileWalkable(nx, ny)) {
      sound.play('error');
      return false;
    }

    sound.play('cursor');
    setDialogue(null);
    setFollowerPos(pos);
    setPos({ x: nx, y: ny });
    setStepCount((s) => s + 1);
    handleTileArrival(nx, ny, fromClick);
    return true;
  };

  // Smooth step-by-step auto-walk along BFS path when user clicks anywhere on the map!
  useEffect(() => {
    if (alertBang) return;
    if (walkQueue.length === 0) {
      if (pendingAction !== 'none') {
        const act = pendingAction;
        setPendingAction('none');
        setTargetTile(null);
        if (act === 'rival') triggerBattle(true, '劲敌 小茂', '/sprites/trainers/blue.png');
        else if (act === 'misty') triggerBattle(true, '华蓝道馆 小霞', '/sprites/trainers/misty.png');
        else if (act === 'sign') {
          sound.play('cursor');
          setDialogue({
            speaker: '道路路牌',
            text: '【关都 1 号道路】西北：精灵中心｜东北：友好商店｜草丛可收服野生宝可梦！',
          });
        } else if (act === 'wild') {
          triggerBattle(false);
        }
      }
      return;
    }

    const timer = window.setTimeout(() => {
      const [nextStep, ...rest] = walkQueue;
      const dx = nextStep.x - pos.x;
      const dy = nextStep.y - pos.y;
      setWalkQueue(rest);
      if (rest.length === 0) setTargetTile(null);
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        stepOne(dx, dy, true);
      }
    }, 145);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkQueue, pos, pendingAction, alertBang]);

  // Keyboard & Hardware D-pad controls
  useEffect(() => {
    if (!controlSignal.seq || !controlSignal.dir) return;
    if (dialogue && (controlSignal.dir === 'confirm' || controlSignal.dir === 'cancel')) {
      setDialogue(null);
      sound.play('cursor');
      return;
    }
    setWalkQueue([]);
    setTargetTile(null);
    setPendingAction('none');
    if (controlSignal.dir === 'left') stepOne(-1, 0);
    else if (controlSignal.dir === 'right') stepOne(1, 0);
    else if (controlSignal.dir === 'up') stepOne(0, -1);
    else if (controlSignal.dir === 'down') stepOne(0, 1);
    else if (controlSignal.dir === 'confirm') {
      const d =
        facing === 'left'
          ? { x: -1, y: 0 }
          : facing === 'right'
            ? { x: 1, y: 0 }
            : facing === 'up'
              ? { x: 0, y: -1 }
              : { x: 0, y: 1 };
      const frontTile = getTileAt(pos.x + d.x, pos.y + d.y);
      if (frontTile === 'R') triggerBattle(true, '劲敌 小茂', '/sprites/trainers/blue.png');
      else if (frontTile === 'L') triggerBattle(true, '华蓝道馆 小霞', '/sprites/trainers/misty.png');
      else if (frontTile === 'S') {
        setDialogue({
          speaker: '道路路牌',
          text: '【关都 1 号道路】西北：精灵中心｜东北：友好商店｜草丛可收服野生宝可梦！',
        });
      } else if (getTileAt(pos.x, pos.y) === 'G') {
        triggerBattle(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlSignal.seq]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (alertBang) return;
    if (dialogue) {
      setDialogue(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - rect.left) / rect.width) * MAP_COLS);
    const ty = Math.floor(((e.clientY - rect.top) / rect.height) * MAP_ROWS);
    if (tx < 0 || tx >= MAP_COLS || ty < 0 || ty >= MAP_ROWS) return;

    const clickedTile = getTileAt(tx, ty);
    // Already standing on grass and clicked same tile -> hunt immediately!
    if (tx === pos.x && ty === pos.y && clickedTile === 'G') {
      triggerBattle(false);
      return;
    }

    const path = findTilePath(pos, { x: tx, y: ty });
    if (path.length === 0) {
      // Adjacent to an interactive NPC/sign? Interact immediately!
      if (Math.abs(tx - pos.x) + Math.abs(ty - pos.y) === 1) {
        if (clickedTile === 'R') triggerBattle(true, '劲敌 小茂', '/sprites/trainers/blue.png');
        else if (clickedTile === 'L') triggerBattle(true, '华蓝道馆 小霞', '/sprites/trainers/misty.png');
        else if (clickedTile === 'S') {
          setDialogue({
            speaker: '道路路牌',
            text: '【关都 1 号道路】西北：精灵中心｜东北：友好商店｜草丛可收服野生宝可梦！',
          });
        }
      }
      return;
    }

    sound.play('cursor');
    setTargetTile(path[path.length - 1]);
    setWalkQueue(path);
    if (clickedTile === 'R') setPendingAction('rival');
    else if (clickedTile === 'L') setPendingAction('misty');
    else if (clickedTile === 'S') setPendingAction('sign');
    else if (clickedTile === 'G') setPendingAction('wild');
    else setPendingAction('none');
  };

  return (
    <div className="overworld-full">
      {/* Full-Screen 240x160 Authentic GBA FireRed Tilemap Canvas (Click ANY tile to walk!) */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="overworld-canvas"
        onClick={handleMapClick}
        title="直接点击地图任意位置行走、进草丛遇敌、找训练家对战或进精灵中心！"
      />

      {/* Animated PMD Partner Pokémon Following Right Behind Red (HGSS style!) */}
      <div
        className="ow-canvas-follower"
        style={{
          left: `${((followerPos.x + 0.5) / MAP_COLS) * 100}%`,
          top: `${((followerPos.y + 0.5) / MAP_ROWS) * 100}%`,
        }}
      >
        <PixelPetSprite
          species={pet.species}
          stage={petStage}
          size={36}
          flipX={followerPos.x > pos.x}
        />
      </div>

      {/* Classic GBA Encounter Exclamation Mark above Player */}
      {alertBang && (
        <div
          className="ow-canvas-bang"
          style={{
            left: `${((pos.x + 0.5) / MAP_COLS) * 100}%`,
            top: `${(pos.y / MAP_ROWS) * 100}%`,
          }}
        >
          !
        </div>
      )}

      {/* Floating Authentic FireRed Location Plaque (Top-Left Corner) */}
      <div className="ow-float-plaque">
        <span className="plaque-dot" />
        <span>关都 1 号道路</span>
      </div>

      {/* Compact Uniform Floating Corner Controls (Top-Right — NO full-width bar!) */}
      <div className="ow-float-top-right">
        <span className="ow-hud-pill" title={`训练家体力 ${save.stamina}/${save.maxStamina}`}>
          <PixelIcon name="bolt" size={11} />
          <strong>
            {save.stamina}/{save.maxStamina}
          </strong>
        </span>
        <button
          type="button"
          className="ow-hud-btn is-ball"
          onClick={onReleaseBallToRoom}
          title={`放出「${pet.name}」，回到精灵球室内养成`}
        >
          <PixelItemImg src={activeRoom.ballSprite} size={16} />
          <span>放出</span>
        </button>
        <button
          type="button"
          className="ow-hud-btn"
          onClick={onOpenMenu}
          title="打开菜单与设置"
        >
          <PixelItemImg src="/sprites/items/poke-radar.png" size={16} />
        </button>
      </div>

      {/* Floating Compact Party Belt (Bottom-Left — Click any ball to swap lead/follower!) */}
      {!dialogue && (
        <div className="ow-float-belt" title="点击切换首发与跟随宝可梦">
          {save.pets.slice(0, 6).map((p) => {
            const rm = ROOM_CATALOG.find((r) => r.id === p.ballRoom) ?? ROOM_CATALOG[0];
            const isLead = p.id === pet.id;
            const hpDot = p.health >= 55 ? '#51cf66' : p.health >= 25 ? '#fcc419' : '#ff6b6b';
            return (
              <button
                key={p.id}
                type="button"
                className={`ow-belt-slot ${isLead ? 'is-lead' : ''}`}
                onClick={() => onSwitchPet(p.id)}
                title={`${p.name} Lv.${p.level} (HP ${p.health}%)`}
              >
                <PixelItemImg src={rm.ballSprite} size={16} />
                <span className="ow-belt-hp" style={{ backgroundColor: hpDot }} />
              </button>
            );
          })}
        </div>
      )}

      {/* Classic FireRed Double-Bordered RPG Dialogue Box (Only shown on NPC/Sign/Encounter!) */}
      {dialogue && (
        <button
          type="button"
          className="ow-rpg-dialogue"
          onClick={() => setDialogue(null)}
        >
          {dialogue.portrait && (
            <img
              src={dialogue.portrait}
              alt={dialogue.speaker ?? ''}
              className="ow-rpg-portrait"
              draggable={false}
            />
          )}
          <div className="ow-rpg-text-col">
            {dialogue.speaker && <strong>{dialogue.speaker}</strong>}
            <span>{dialogue.text}</span>
          </div>
          <em className="gba-caret">▼</em>
        </button>
      )}
    </div>
  );
};
