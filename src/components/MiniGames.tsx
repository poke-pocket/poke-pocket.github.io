import React, { useEffect, useRef, useState } from 'react';
import { getGrowthStage } from '../data/catalog';
import type { PetRecord } from '../types/pet';
import { sound } from '../utils/sound';
import { PixelIcon, PixelItemImg, PixelPetSprite } from './PixelSprite';

interface CatchItem {
  id: number;
  x: number;
  y: number;
  kind: 'treat' | 'star' | 'boot';
  speed: number;
}

interface CatchTreatsGameProps {
  pet: PetRecord;
  controlSignal: { seq: number; dir: 'left' | 'right' | 'confirm' | 'cancel' | null };
  onComplete: (score: number, won: boolean) => void;
  onExit: () => void;
}

export const CatchTreatsGame: React.FC<CatchTreatsGameProps> = ({
  pet,
  controlSignal,
  onComplete,
  onExit,
}) => {
  const [playerX, setPlayerX] = useState(50);
  const [flipX, setFlipX] = useState(false);
  const [items, setItems] = useState<CatchItem[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(20);
  const [finished, setFinished] = useState(false);

  const playerXRef = useRef(50);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const finishedRef = useRef(false);
  const nextIdRef = useRef(1);
  const lastSeqRef = useRef(controlSignal.seq);

  const moveBy = (delta: number) => {
    if (finishedRef.current) return;
    setFlipX(delta > 0);
    setPlayerX((prev) => {
      const next = Math.max(12, Math.min(88, prev + delta));
      playerXRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (controlSignal.seq === lastSeqRef.current) return;
    lastSeqRef.current = controlSignal.seq;
    if (!controlSignal.dir) return;
    if (controlSignal.dir === 'left') moveBy(-16);
    if (controlSignal.dir === 'right') moveBy(16);
    if (controlSignal.dir === 'cancel') onExit();
  }, [controlSignal.seq, controlSignal.dir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveBy(-14);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveBy(14);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const tickTimer = window.setInterval(() => {
      if (finishedRef.current) return;
      setItems((prev) => {
        const remaining: CatchItem[] = [];
        for (const item of prev) {
          const ny = item.y + item.speed;
          const caught =
            ny >= 72 && ny <= 90 && Math.abs(item.x - playerXRef.current) < 15;
          if (caught) {
            if (item.kind === 'boot') {
              sound.play('error');
              livesRef.current = Math.max(0, livesRef.current - 1);
              setLives(livesRef.current);
              if (livesRef.current <= 0) {
                finishedRef.current = true;
                setFinished(true);
              }
            } else {
              const pts = item.kind === 'star' ? 20 : 10;
              sound.play('coin');
              scoreRef.current += pts;
              setScore(scoreRef.current);
            }
          } else if (ny < 98) {
            remaining.push({ ...item, y: ny });
          }
        }
        return remaining;
      });
    }, 55);

    const spawnTimer = window.setInterval(() => {
      if (finishedRef.current) return;
      const roll = Math.random();
      const kind: CatchItem['kind'] =
        roll < 0.22 ? 'boot' : roll < 0.42 ? 'star' : 'treat';
      setItems((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          x: 14 + Math.random() * 72,
          y: 8,
          kind,
          speed: 3.1 + Math.random() * 1.8,
        },
      ]);
    }, 620);

    const clockTimer = window.setInterval(() => {
      if (finishedRef.current) return;
      setTimeLeft((t) => {
        if (t <= 1) {
          finishedRef.current = true;
          setFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(tickTimer);
      window.clearInterval(spawnTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => {
      onComplete(scoreRef.current, scoreRef.current >= 40 && livesRef.current > 0);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [finished, onComplete]);

  const stage = getGrowthStage(pet.level, pet.species);

  return (
    <div className="lcd-minigame">
      <div className="lcd-minigame-hud">
        <span>SCORE {String(score).padStart(3, '0')}</span>
        <span className="hud-lives">
          {[0, 1, 2].map((i) => (
            <PixelIcon key={i} name={i < lives ? 'heart' : 'heart_empty'} size={13} />
          ))}
        </span>
        <span>{timeLeft}s</span>
      </div>

      <div
        className="lcd-minigame-arena"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * 100;
          moveBy(rel < playerXRef.current ? -18 : 18);
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="falling-item"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            {item.kind === 'treat' && (
              <PixelItemImg src="/sprites/items/oran-berry.png" size={22} />
            )}
            {item.kind === 'star' && <PixelIcon name="star" size={20} />}
            {item.kind === 'boot' && <PixelIcon name="bomb" size={20} />}
          </div>
        ))}

        <div className="minigame-player" style={{ left: `${playerX}%` }}>
          <PixelPetSprite
            species={pet.species}
            pose={finished ? 'happy' : 'idle0'}
            stage={stage}
            size={64}
            flipX={flipX}
          />
        </div>

        {finished && (
          <div className="lcd-minigame-banner">
            <strong>{lives > 0 ? 'TIME UP!' : 'OOPS!'}</strong>
            <span>得分 {score}</span>
          </div>
        )}
      </div>

      <div className="lcd-minigame-hint">←/→ 或点击屏幕左右接树果，躲避炸弹</div>
    </div>
  );
};

interface PeekabooGameProps {
  pet: PetRecord;
  controlSignal: { seq: number; dir: 'left' | 'right' | 'confirm' | 'cancel' | null };
  onComplete: (score: number, won: boolean) => void;
  onExit: () => void;
}

export const PeekabooGame: React.FC<PeekabooGameProps> = ({
  pet,
  controlSignal,
  onComplete,
  onExit,
}) => {
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [petDir, setPetDir] = useState<'left' | 'right' | null>(null);
  const [guess, setGuess] = useState<'left' | 'right' | null>(null);
  const [locked, setLocked] = useState(false);
  const lastSeqRef = useRef(controlSignal.seq);

  const stage = getGrowthStage(pet.level, pet.species);

  const handleGuess = (dir: 'left' | 'right') => {
    if (locked) return;
    setLocked(true);
    const actual: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
    setGuess(dir);
    setPetDir(actual);
    const hit = dir === actual;
    sound.play(hit ? 'happy' : 'cancel');
    const nextWins = hit ? wins + 1 : wins;
    if (hit) setWins(nextWins);

    window.setTimeout(() => {
      if (round >= 5) {
        onComplete(nextWins * 20, nextWins >= 3);
      } else {
        setRound((r) => r + 1);
        setPetDir(null);
        setGuess(null);
        setLocked(false);
      }
    }, 900);
  };

  useEffect(() => {
    if (controlSignal.seq === lastSeqRef.current) return;
    lastSeqRef.current = controlSignal.seq;
    if (!controlSignal.dir) return;
    if (controlSignal.dir === 'left') handleGuess('left');
    if (controlSignal.dir === 'right') handleGuess('right');
    if (controlSignal.dir === 'cancel') onExit();
  }, [controlSignal.seq, controlSignal.dir]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lcd-minigame">
      <div className="lcd-minigame-hud">
        <span>ROUND {round}/5</span>
        <span>猜中 {wins}</span>
      </div>

      <div className="lcd-peekaboo-stage">
        <div
          className={`peekaboo-pet ${petDir === 'left' ? 'look-left' : petDir === 'right' ? 'look-right' : ''}`}
        >
          <PixelPetSprite
            species={pet.species}
            pose={petDir ? (guess === petDir ? 'happy' : 'idle0') : 'idle0'}
            stage={stage}
            size={84}
            flipX={petDir === 'right'}
          />
        </div>
        <div className="peekaboo-prompt">
          {petDir
            ? guess === petDir
              ? '猜对啦！'
              : `它跳向了${petDir === 'left' ? '左边' : '右边'}！`
            : `${pet.name} 等下会跳向哪边？`}
        </div>
        <div className="peekaboo-actions">
          <button
            type="button"
            className="lcd-btn"
            disabled={locked}
            onClick={() => handleGuess('left')}
          >
            ← 左边
          </button>
          <button
            type="button"
            className="lcd-btn"
            disabled={locked}
            onClick={() => handleGuess('right')}
          >
            右边 →
          </button>
        </div>
      </div>
    </div>
  );
};
