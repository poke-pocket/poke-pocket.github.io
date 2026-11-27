import React, { useRef, useState } from 'react';
import { SHELL_THEMES } from '../data/catalog';
import type {
  AccessoryId,
  ActionAnim,
  FloatingEffect,
  FoodId,
  GachaBoxId,
  GamePrefs,
  GameSave,
  KeyBindings,
  LcdMode,
  PetRecord,
  RoomThemeId,
  ShellThemeId,
  SpeciesId,
  TrainerProfile,
} from '../types/pet';
import type {
  BattleResultPayload,
  GachaOutcome,
  GachaTenOutcome,
  SurvivorsResultPayload,
} from '../utils/petEngine';
import type { LiveRunTacticsBridge } from '../data/survivorsTactics';
import { LcdScreen, type HomeIconActionId } from './LcdScreen';
import { PixelIcon } from './PixelSprite';
import { sound } from '../utils/sound';
import { toggleDevMode, useDevMode } from '../utils/devMode';

export interface AppSettingsPatch {
  muted?: boolean;
  sfxVolume?: number;
  bgmEnabled?: boolean;
  bgmVolume?: number;
  cryEnabled?: boolean;
  cryVolume?: number;
  combatSfxEnabled?: boolean;
  prefs?: Partial<GamePrefs>;
  trainerProfile?: Partial<TrainerProfile>;
  shellTheme?: ShellThemeId;
  showShell?: boolean;
  keyBindings?: KeyBindings;
}

interface HandheldConsoleProps {
  save: GameSave;
  pet: PetRecord;
  mode: LcdMode;
  battleIsTrainer: boolean;
  actionAnim: ActionAnim;
  patSeq: number;
  activeFood: FoodId | null;
  speech: string | null;
  effects: FloatingEffect[];
  bezelIndex: number;
  menuCursor: number;
  controlSignal: {
    seq: number;
    dir: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | null;
  };
  analogVecRef: React.MutableRefObject<{ x: number; y: number }>;
  onNavigateMode: (next: LcdMode) => void;
  onHomeIconClick: (action: HomeIconActionId, idx: number) => void;
  onDpad: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onButtonA: () => void;
  onButtonB: () => void;
  onSelectButton: () => void;
  onStartButton: () => void;
  onPatPet: () => void;
  onCleanPoop: () => void;
  onHealPet: () => void;
  onHealParty: () => void;
  onFeedSquad?: (petIds: string[]) => { ok: boolean; message: string };
  onQuickCarePet?: (
    petId: string,
    action: 'feed' | 'heal' | 'bath' | 'pat',
    foodId?: FoodId,
  ) => { ok: boolean; message: string };
  onDevGrantItems99?: () => void;
  onDevGrantPokeballs99?: () => void;
  onReleaseBallToRoom: () => void;
  onStartBattle: (isTrainer: boolean) => void;
  onFinishBattle: (fighterId: string, payload: BattleResultPayload) => void;
  onFinishSurvivors: (petId: string, payload: SurvivorsResultPayload, returnToRoom?: boolean) => void;
  onSpendCoinsInRun: (cost: number) => boolean;
  onCaptureBoss: (species: SpeciesId, level: number) => void;
  onSelectFood: (foodId: FoodId) => void;
  onBuyFood: (foodId: FoodId) => void;
  onStartGame: (game: 'game_catch' | 'game_peekaboo') => void;
  onFinishGame: (gameLabel: string, score: number, won: boolean) => void;
  onBuyAccessory: (id: AccessoryId) => void;
  onEquipAccessory: (petId: string, id: AccessoryId) => void;
  onBuyPokeball: (roomId: RoomThemeId) => void;
  onAssignPetRoom: (petId: string, roomId: RoomThemeId) => void;
  onPullGacha: (boxId: GachaBoxId) => GachaOutcome;
  onPullGachaTen: (boxId: GachaBoxId) => GachaTenOutcome;
  onReleasePet: (petId: string) => boolean;
  onReleasePetsBatch?: (petIds: string[]) => { ok: boolean; count: number; coins: number; xp: number; message: string };
  onReleaseStoredPet?: (petId: string) => boolean;
  onReleaseStoredPetsBatch?: (petIds: string[]) => { ok: boolean; count: number; coins: number; xp: number; message: string };
  onDepositPet?: (petId: string) => boolean;
  onDepositPetsBatch?: (petIds: string[]) => { ok: boolean; count: number; message: string };
  onWithdrawPet?: (petId: string) => boolean;
  onWithdrawPetsBatch?: (petIds: string[]) => { ok: boolean; count: number; message: string };
  onSwitchPet: (petId: string) => void;
  onUpdatePetConfig?: (
    petId: string,
    patch: {
      enhanceCost?: number;
      enhanceDelta?: number;
      pinnedSkills?: string[];
      bannedSkills?: string[];
      skin?: import('../types/pet').PetSkinId;
      skinCost?: number;
      unlockSkin?: string;
    },
  ) => boolean;
  onUpdateSettings: (patch: AppSettingsPatch) => void;
  onUpdateMeta?: (updater: (prev: import('../data/metaProgression').MetaProgressState) => import('../data/metaProgression').MetaProgressState, coinDelta?: number) => void;
  onResetSave: () => void;
  onExitMode: () => void;
  tacticsBridge?: LiveRunTacticsBridge | null;
  onCloseHandheldTo3D?: () => void;
  openedFromBattle?: boolean;
  openedEntryMode?: LcdMode | null;
  focusedDetailPetId?: string | null;
  captureReveal?: import('../types/pet').CaptureRevealPayload | null;
  worldMapData?: import('./WorldMapHud').WorldMapData | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const HandheldConsole: React.FC<HandheldConsoleProps> = ({
  save,
  pet,
  mode,
  battleIsTrainer,
  actionAnim,
  patSeq,
  activeFood,
  speech,
  effects,
  bezelIndex,
  menuCursor,
  controlSignal,
  analogVecRef,
  onNavigateMode,
  onHomeIconClick,
  onDpad,
  onButtonA,
  onButtonB,
  onSelectButton,
  onStartButton,
  onPatPet,
  onCleanPoop,
  onHealPet,
  onHealParty,
  onFeedSquad,
  onQuickCarePet,
  onDevGrantItems99,
  onDevGrantPokeballs99,
  onReleaseBallToRoom,
  onStartBattle,
  onFinishBattle,
  onFinishSurvivors,
  onSpendCoinsInRun,
  onCaptureBoss,
  onSelectFood,
  onBuyFood,
  onStartGame,
  onFinishGame,
  onBuyAccessory,
  onEquipAccessory,
  onBuyPokeball,
  onAssignPetRoom,
  onPullGacha,
  onPullGachaTen,
  onReleasePet,
  onReleasePetsBatch,
  onReleaseStoredPet,
  onReleaseStoredPetsBatch,
  onDepositPet,
  onDepositPetsBatch,
  onWithdrawPet,
  onWithdrawPetsBatch,
  onSwitchPet,
  onUpdatePetConfig,
  onUpdateSettings,
  onUpdateMeta,
  onResetSave,
  onExitMode,
  tacticsBridge,
  onCloseHandheldTo3D,
  openedFromBattle,
  openedEntryMode,
  focusedDetailPetId,
  captureReveal,
  worldMapData,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const theme = SHELL_THEMES[save.shellTheme];

  const [padTilt, setPadTilt] = useState({ x: 0, y: 0, active: false });
  const FLAT_3D = { rx: 0, ry: 0, glareX: 30, glareY: 20, charmLag: 0 };
  const [shell3d, setShell3d] = useState(FLAT_3D);
  const [draggingShell, setDraggingShell] = useState(false);
  const shellDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseRx: number;
    baseRy: number;
  } | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);
  const padPointerIdRef = useRef<number | null>(null);
  const [devMode] = useDevMode();
  const [devVibrating, setDevVibrating] = useState(false);
  const [devToast, setDevToast] = useState<string | null>(null);
  const powerTapRef = useRef<{ count: number; lastMs: number }>({ count: 0, lastMs: 0 });
  const devToastTimerRef = useRef<number | null>(null);
  const devVibeTimerRef = useRef<number | null>(null);

  const handlePowerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - powerTapRef.current.lastMs > 2600) {
      powerTapRef.current.count = 0;
    }
    powerTapRef.current.lastMs = now;
    powerTapRef.current.count += 1;

    if (powerTapRef.current.count >= 10) {
      powerTapRef.current.count = 0;
      const nextEnabled = toggleDevMode();
      sound.play(nextEnabled ? 'levelup' : 'cancel');
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([45, 25, 75]);
        } catch {
          // ignore
        }
      }
      setDevVibrating(false);
      window.requestAnimationFrame(() => setDevVibrating(true));
      if (devVibeTimerRef.current) window.clearTimeout(devVibeTimerRef.current);
      devVibeTimerRef.current = window.setTimeout(() => setDevVibrating(false), 460);

      setDevToast(
        nextEnabled
          ? '开发者调试模式已开启（系统设置中已解锁「调试」面板）'
          : '开发者调试模式已关闭',
      );
      if (devToastTimerRef.current) window.clearTimeout(devToastTimerRef.current);
      devToastTimerRef.current = window.setTimeout(() => setDevToast(null), 2600);
    } else if (powerTapRef.current.count >= 6) {
      sound.play('cursor');
    }
  };

  const isShellInteractiveTarget = (target: HTMLElement | null) =>
    !target ||
    Boolean(target.closest('button, a, input, select, textarea, .lcd-glass, .lcd-viewport, .omni-pad, .shell-side-charm-anchor'));

  const handleShellPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (isShellInteractiveTarget(target)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    shellDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseRx: shell3d.rx,
      baseRy: shell3d.ry,
    };
    setDraggingShell(true);
  };

  const handleShellPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = shellDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const nextRx = Math.max(-18, Math.min(18, drag.baseRx - dy * 0.12));
    const nextRy = Math.max(-22, Math.min(22, drag.baseRy + dx * 0.14));
    setShell3d({
      rx: Number(nextRx.toFixed(2)),
      ry: Number(nextRy.toFixed(2)),
      glareX: Math.round(30 - nextRy * 1.6),
      glareY: Math.round(20 + nextRx * 1.4),
      charmLag: Number((-nextRy * 0.65).toFixed(2)),
    });
  };

  const releaseShellDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const drag = shellDragRef.current;
    if (!drag) return;
    if (e && drag.pointerId === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    }
    shellDragRef.current = null;
    setDraggingShell(false);
    // Keep the user's tilted 3D angle! Double-click chassis plastic to flatten back to 0°!
  };

  const handleShellDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (isShellInteractiveTarget(target)) return;
    setShell3d(FLAT_3D);
  };

  const updateOmniVector = (clientX: number, clientY: number, emitDiscrete: boolean) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      analogVecRef.current = { x: 0, y: 0 };
      setPadTilt({ x: 0, y: 0, active: true });
      return;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const mag = Math.min(1, dist / maxR);
    analogVecRef.current = { x: nx * mag, y: ny * mag };
    setPadTilt({
      x: Math.round(nx * Math.min(18, dist * 0.45)),
      y: Math.round(ny * Math.min(18, dist * 0.45)),
      active: true,
    });
    if (emitDiscrete) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        onDpad(dx < 0 ? 'left' : 'right');
      } else {
        onDpad(dy < 0 ? 'up' : 'down');
      }
    }
  };

  const releaseOmniPad = () => {
    padPointerIdRef.current = null;
    analogVecRef.current = { x: 0, y: 0 };
    setPadTilt({ x: 0, y: 0, active: false });
  };

  const lcdNode = (
    <LcdScreen
      save={save}
      pet={pet}
      mode={mode}
      battleIsTrainer={battleIsTrainer}
      actionAnim={actionAnim}
      patSeq={patSeq}
      activeFood={activeFood}
      speech={speech}
      effects={effects}
      bezelIndex={bezelIndex}
      menuCursor={menuCursor}
      controlSignal={controlSignal}
      analogVecRef={analogVecRef}
      onNavigateMode={onNavigateMode}
      onHomeIconClick={onHomeIconClick}
      onPatPet={onPatPet}
      onCleanPoop={onCleanPoop}
      onHealPet={onHealPet}
      onHealParty={onHealParty}
      onFeedSquad={onFeedSquad}
      onQuickCarePet={onQuickCarePet}
      onDevGrantItems99={onDevGrantItems99}
      onDevGrantPokeballs99={onDevGrantPokeballs99}
      onReleaseBallToRoom={onReleaseBallToRoom}
      onStartBattle={onStartBattle}
      onFinishBattle={onFinishBattle}
      onFinishSurvivors={onFinishSurvivors}
      onSpendCoinsInRun={onSpendCoinsInRun}
      onCaptureBoss={onCaptureBoss}
      onSelectFood={onSelectFood}
      onBuyFood={onBuyFood}
      onStartGame={onStartGame}
      onFinishGame={onFinishGame}
      onBuyAccessory={onBuyAccessory}
      onEquipAccessory={onEquipAccessory}
      onBuyPokeball={onBuyPokeball}
      onAssignPetRoom={onAssignPetRoom}
      onPullGacha={onPullGacha}
      onPullGachaTen={onPullGachaTen}
      onReleasePet={onReleasePet}
      onReleasePetsBatch={onReleasePetsBatch}
      onReleaseStoredPet={onReleaseStoredPet}
      onReleaseStoredPetsBatch={onReleaseStoredPetsBatch}
      onDepositPet={onDepositPet}
      onDepositPetsBatch={onDepositPetsBatch}
      onWithdrawPet={onWithdrawPet}
      onWithdrawPetsBatch={onWithdrawPetsBatch}
      onSwitchPet={onSwitchPet}
      onUpdatePetConfig={onUpdatePetConfig}
      onUpdateSettings={onUpdateSettings}
      onUpdateMeta={onUpdateMeta}
      onResetSave={onResetSave}
      onExitMode={onExitMode}
      tacticsBridge={tacticsBridge}
      onCloseHandheldTo3D={onCloseHandheldTo3D}
      openedFromBattle={openedFromBattle}
      openedEntryMode={openedEntryMode}
      focusedDetailPetId={focusedDetailPetId}
      captureReveal={captureReveal}
      worldMapData={worldMapData}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
    />
  );

  if (!save.showShell) {
    return (
      <div className="fullscreen-lcd-wrap">
        <div className="fullscreen-lcd-stage">{lcdNode}</div>
      </div>
    );
  }

  return (
    <div
      className="console-column handheld-3d-stage"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCloseHandheldTo3D) {
          onCloseHandheldTo3D();
        }
      }}
    >
      <div
        ref={shellRef}
        className={`handheld-shell is-3d-chassis ${draggingShell ? 'is-dragging-3d' : ''} ${devVibrating ? 'is-dev-vibrate' : ''}`}
        onPointerDown={handleShellPointerDown}
        onPointerMove={handleShellPointerMove}
        onPointerUp={releaseShellDrag}
        onPointerCancel={releaseShellDrag}
        onDoubleClick={handleShellDoubleClick}
        style={
          {
            '--shell-body': theme.body,
            '--shell-shadow': theme.bodyShadow,
            '--shell-hi': theme.bodyHighlight,
            '--shell-bezel': theme.bezel,
            '--shell-accent': theme.accentBtn,
            '--shell-dpad': theme.dpad,
            '--tilt-rx': `${shell3d.rx}deg`,
            '--tilt-ry': `${shell3d.ry}deg`,
            '--glare-x': `${shell3d.glareX}%`,
            '--glare-y': `${shell3d.glareY}%`,
            '--charm-lag': `${shell3d.charmLag}deg`,
          } as React.CSSProperties
        }
      >
        {/* Physical 3D Side Hardware Details: Left Volume Dial + Right Power Slider */}
        <span className="shell-hw-vol" aria-hidden="true" />
        <span className="shell-hw-pwr" aria-hidden="true" />
        <span className="shell-hw-grip-l" aria-hidden="true" />
        <span className="shell-hw-grip-r" aria-hidden="true" />

        <div className="screen-bezel">
          <div className="bezel-glass-glint" aria-hidden="true" />
          <div className="lens-layout">
            <button
              type="button"
              className={`battery-column ${devMode ? 'is-dev-active' : ''}`}
              onClick={handlePowerClick}
              aria-label="电源指示灯"
            >
              <span className={`led-dot ${devMode ? 'is-dev-on' : ''}`} />
              <span className="battery-txt">POWER</span>
            </button>

            {lcdNode}
          </div>

          {devToast && (
            <div className="dev-mode-bezel-toast" role="status" aria-live="polite">
              {devToast}
            </div>
          )}

          <div className="bezel-brand-footer">
            <span className="gb-logo">POKé POCKET</span>
            <span className="gbc-word">
              <i style={{ color: '#ff4757' }}>C</i>
              <i style={{ color: '#a29bfe' }}>O</i>
              <i style={{ color: '#2ed573' }}>L</i>
              <i style={{ color: '#ffa502' }}>O</i>
              <i style={{ color: '#1e90ff' }}>R</i>
            </span>
          </div>
        </div>

        {/* Side-Mounted Collectible 3D Pokémon Strap Keychain Charm (Clicking expands Fullscreen!) */}
        <div className="shell-side-charm-anchor">
          <span className="shell-side-lug" aria-hidden="true" />
          <div className="shell-side-pendulum">
            <svg className="shell-side-cord" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">
              {/* Braided strap loop emerging from the side eyelet */}
              <path
                d="M 2 4 C 16 4, 21 14, 18 28"
                fill="none"
                stroke="#161420"
                strokeWidth="4.2"
                strokeLinecap="round"
              />
              <path
                d="M 2 4 C 16 4, 21 14, 18 28"
                fill="none"
                stroke="#ffd43b"
                strokeWidth="1.8"
                strokeDasharray="3 2"
                strokeLinecap="round"
              />
              {/* Metallic golden jump ring */}
              <circle cx="18" cy="30" r="4" fill="none" stroke="#161420" strokeWidth="2.8" />
              <circle cx="18" cy="30" r="4" fill="none" stroke="#ffe066" strokeWidth="1.4" />
            </svg>
            <button
              type="button"
              className="shell-side-charm-card"
              onClick={() => onUpdateSettings({ showShell: false })}
              title="点击侧边挂坠：展开全屏像素掌机屏幕"
              aria-label="全屏展开"
            >
              <span className="charm-acrylic-sheen" aria-hidden="true" />
              <span className="charm-pin-hole" aria-hidden="true" />
              <PixelIcon name="fullscreen" size={16} />
              <span className="charm-fs-label">全屏</span>
            </button>
          </div>
        </div>

        <div className="shell-embossed-logo" aria-hidden="true">
          POCKET MONSTER
        </div>

        <div className="controls-deck">
          <div className="dpad-well">
            <div
              ref={padRef}
              className={`omni-pad ${padTilt.active ? 'is-active' : ''}`}
              role="group"
              aria-label="方向键"
              title="360° 全向方向盘：支持点击或拖拽任意方向（含斜向 ↖↗↙↘）移动！"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                padPointerIdRef.current = e.pointerId;
                updateOmniVector(e.clientX, e.clientY, true);
              }}
              onPointerMove={(e) => {
                if (padPointerIdRef.current === e.pointerId) {
                  updateOmniVector(e.clientX, e.clientY, false);
                }
              }}
              onPointerUp={(e) => {
                if (padPointerIdRef.current === e.pointerId) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  releaseOmniPad();
                }
              }}
              onPointerCancel={releaseOmniPad}
            >
              {/* Raised 8-direction cross + diagonal pips */}
              <span className="omni-cross-v" aria-hidden="true" />
              <span className="omni-cross-h" aria-hidden="true" />
              <span className="omni-arrow omni-up" aria-hidden="true">▲</span>
              <span className="omni-arrow omni-down" aria-hidden="true">▼</span>
              <span className="omni-arrow omni-left" aria-hidden="true">◀</span>
              <span className="omni-arrow omni-right" aria-hidden="true">▶</span>
              <span className="omni-diag omni-ul" aria-hidden="true" />
              <span className="omni-diag omni-ur" aria-hidden="true" />
              <span className="omni-diag omni-dl" aria-hidden="true" />
              <span className="omni-diag omni-dr" aria-hidden="true" />
              {/* Tactile 360° sliding thumb puck */}
              <div
                className="omni-puck"
                style={{
                  transform: `translate(${padTilt.x}px, ${padTilt.y}px)`,
                }}
              >
                <span className="omni-puck-dimple" />
              </div>
            </div>
          </div>

          <div className="ab-cluster">
            <div className="ab-pair">
              <div className="round-btn-wrap btn-b-wrap">
                <div className="btn-socket">
                  <button
                    type="button"
                    className="round-btn"
                    onClick={onButtonB}
                    title="B键: 返回 / 抚摸"
                    aria-label="B 返回"
                  />
                </div>
                <span className="silkscreen-lbl">B</span>
              </div>
              <div className="round-btn-wrap btn-a-wrap">
                <div className="btn-socket">
                  <button
                    type="button"
                    className="round-btn"
                    onClick={onButtonA}
                    title="A键: 确认 / 执行"
                    aria-label="A 确认"
                  />
                </div>
                <span className="silkscreen-lbl">A</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lower-deck">
          <div className="rubber-pills-row">
            <button
              type="button"
              className="rubber-pill-btn"
              onClick={onSelectButton}
              title="打开同行宝可梦队伍"
            >
              <span className="rubber-cap" />
              <span className="rubber-lbl">SELECT</span>
            </button>
            <button
              type="button"
              className="rubber-pill-btn"
              onClick={onStartButton}
              title="打开训练家主菜单"
            >
              <span className="rubber-cap" />
              <span className="rubber-lbl">START</span>
            </button>
          </div>

          <div className="speaker-matrix" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className="spk-hole" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
