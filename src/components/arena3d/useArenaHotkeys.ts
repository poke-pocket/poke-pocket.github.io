import type { ArenaSharedCtx } from './arenaTypesAndProps';
import { useEffect } from 'react';
import { sound } from '../../utils/sound';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useArenaKeyboardHotkeys(rawCtx: Record<string, any>) {
  const { CAM_MODE_META, banishMode, banishedIdsRef, buySafeShopItem, camFollowModeRef, camOrbitRef, canvasRef, captureOffer, closeHubModal, closeMapSelect, closeProfileModal, closeResultAndRun, closeShopModal, cycleCameraFollowMode, cycleInteractOptionRef, endedRef, externalPausedRef, handleCaptureBossConfirm, handleChooseUpgrade, handleLaunchRandomRogueRun, handleLaunchRun, hubModal, hud, jumpQueuedRef, keysRef, levelChoices, nearbyKoIdRef, onFinish, onOpenPokemonManager, pausedRef, pet, phase, profileOpen, rebuildChoicesRef, rerollsLeft, restorePointerLockRef, resultSummary, save, setBanishMode, setClosingLevelUp, setLevelChoices, setPhase, setRerollsLeft, setRunNonce, setShopOpen, setTimeAlmanacOpen, setWorldMapOpen, shopOpen, showBanner, simRef, squadEditorOpen, timeAlmanacOpenRef, toggleWorldMap, triggerBattleActionRef, triggerInteractRef, triggerSafeHeal, tryRestorePointerLock, worldMapOpenRef } = rawCtx as ArenaSharedCtx;
  // Comprehensive Arcade Keyboard Hotkeys (WASD/Arrows + Space + 1/2/3/4 Events + Q/E/M + Enter/Esc!)
  useEffect(() => {
    const kb = save.keyBindings;
    const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (externalPausedRef.current) return;
      if (timeAlmanacOpenRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          sound.play('cancel');
          setTimeAlmanacOpen(false);
        }
        return;
      }
      if (worldMapOpenRef.current) {
        if (
          e.key === 'Escape' ||
          e.code === 'KeyM' ||
          e.key.toLowerCase() === 'm' ||
          e.code === 'Backquote' ||
          e.key === '`' ||
          e.key === '~'
        ) {
          e.preventDefault();
          sound.play('cancel');
          setWorldMapOpen(false);
        }
        return;
      }

      if (phase === 'hub') {
        if (hubModal !== 'none') {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeHubModal();
          }
          return;
        }
        if (profileOpen) {
          if (e.key === 'Escape') {
            e.preventDefault();
            closeProfileModal();
          }
          return;
        }
        if (e.key === '1' || e.key === 'Enter') {
          e.preventDefault();
          handleLaunchRun();
        } else if (e.key === '2') {
          e.preventDefault();
          handleLaunchRandomRogueRun();
        } else if (e.key === '3') {
          e.preventDefault();
          sound.play('confirm');
          onOpenPokemonManager('home', false);
        }
        return;
      }

      if (phase === 'map_select') {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeMapSelect();
        } else if (e.key === 'Enter' || e.key === '1') {
          e.preventDefault();
          handleLaunchRun();
        }
        return;
      }
      if (phase !== 'playing') return;
      // Map Hotkeys: `M` (industry-standard RPG map key) OR `` ` `` / `~` (key right above Tab)!
      if (e.code === 'KeyM' || e.key.toLowerCase() === 'm' || e.code === 'Backquote' || e.key === '`' || e.key === '~') {
        e.preventDefault();
        toggleWorldMap();
        return;
      }
      // `Tab` cycles the beside-character multi-action menu (`沟通` / `询问` / `治疗` / `切磋`...)!
      if (e.key === 'Tab') {
        e.preventDefault();
        cycleInteractOptionRef?.current?.(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key.toLowerCase() === 'e') {
        if (nearbyKoIdRef.current !== null) {
          e.preventDefault();
          triggerBattleActionRef.current?.('capture_ko', nearbyKoIdRef.current);
          return;
        }
        if (triggerInteractRef.current) {
          e.preventDefault();
          triggerInteractRef.current();
          return;
        }
      }
      if (e.key === 'Alt' && document.pointerLockElement === canvasRef.current) {
        try {
          document.exitPointerLock?.();
        } catch {
          // ignore
        }
        return;
      }
      const k = norm(e.key);

      // 1. Fullscreen Settlement Hotkeys (1: Replay, 2/Enter: Hub, 3: Manager)
      if (resultSummary) {
        if (k === '1') {
          e.preventDefault();
          closeResultAndRun(() => {
            onFinish(pet.id, resultSummary.payload, false);
            endedRef.current = false;
            pausedRef.current = false;
            setRunNonce((n) => n + 1);
          });
        } else if (k === '2' || e.key === 'Enter') {
          e.preventDefault();
          closeResultAndRun(() => {
            onFinish(pet.id, resultSummary.payload, false);
            setPhase('hub');
          });
        } else if (k === '3') {
          e.preventDefault();
          closeResultAndRun(() => {
            onFinish(pet.id, resultSummary.payload, true);
          });
        }
        return;
      }

      // 2. Boss Capture Hotkeys (1/Enter: Catch, 2/Esc: Skip)
      if (captureOffer) {
        if (k === '1' || e.key === 'Enter') {
          e.preventDefault();
          handleCaptureBossConfirm(true);
        } else if (k === '2' || e.key === 'Escape') {
          e.preventDefault();
          handleCaptureBossConfirm(false);
        }
        return;
      }

      // 3. Level-Up 3-Choice Horizontal Draft Hotkeys (1/2/3 Pick, F Reroll, X Skip, Z Banish)
      if (levelChoices) {
        const idx = k === '1' ? 0 : k === '2' ? 1 : k === '3' ? 2 : -1;
        if (idx >= 0 && levelChoices[idx]) {
          e.preventDefault();
          if (banishMode) {
            banishedIdsRef.current.add(levelChoices[idx].id);
            setBanishMode(false);
            sound.play('cancel');
            if (rebuildChoicesRef.current) setLevelChoices(rebuildChoicesRef.current());
          } else {
            handleChooseUpgrade(levelChoices[idx]);
          }
        } else if (k === 'f' && rerollsLeft > 0 && rebuildChoicesRef.current) {
          e.preventDefault();
          sound.play('confirm');
          setRerollsLeft((r) => Math.max(0, r - 1));
          setLevelChoices(rebuildChoicesRef.current());
        } else if (k === 'x') {
          e.preventDefault();
          sound.play('coin');
          if (simRef.current) simRef.current.coins += 15;
          setClosingLevelUp(true);
          tryRestorePointerLock();
          window.setTimeout(() => {
            setClosingLevelUp(false);
            setLevelChoices(null);
            pausedRef.current = false;
          }, 155);
        } else if (k === 'z') {
          e.preventDefault();
          sound.play('cursor');
          setBanishMode((b) => !b);
        }
        return;
      }

      // 4. Safe Zone Poké Mart Hotkeys (1-4 Buy, Esc Close)
      if (shopOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeShopModal();
        } else if (k === '1') {
          e.preventDefault();
          if (hud.hp < hud.maxHp) buySafeShopItem('potion', 15);
        } else if (k === '2') {
          e.preventDefault();
          buySafeShopItem('summon', 35);
        } else if (k === '3') {
          e.preventDefault();
          buySafeShopItem('tome', 30);
        } else if (k === '4') {
          e.preventDefault();
          buySafeShopItem('berry', 25);
        }
        return;
      }

      // 5. Live 3D Combat Quick Event Hotkeys
      if (k === '1' && hud.inSafeZone) {
        e.preventDefault();
        triggerSafeHeal();
        return;
      }
      if (k === '2' && hud.inSafeZone) {
        e.preventDefault();
        pausedRef.current = true;
        sound.play('confirm');
        setShopOpen(true);
        return;
      }
      if (k === 'Escape' || k === 'p' || k === 'q') {
        e.preventDefault();
        sound.play('cursor');
        onOpenPokemonManager('tactics', true);
        return;
      }
      if (k === 'f') {
        e.preventDefault();
        sound.play('cursor');
        onOpenPokemonManager('home', true);
        return;
      }
      if (k === 'b') {
        e.preventDefault();
        sound.play('cursor');
        onOpenPokemonManager('menu', true);
        return;
      }
      if (k === 'r') {
        e.preventDefault();
        const curMeta = CAM_MODE_META[camFollowModeRef.current];
        camOrbitRef.current = { yaw: 0, pitch: curMeta.pitch, zoom: 1.0 };
        showBanner(`🎥 3D 视角已复位（${curMeta.label}）`, 1400);
        return;
      }
      if (k === 'g') {
        e.preventDefault();
        cycleCameraFollowMode();
        return;
      }
      if (k === 'n') {
        e.preventDefault();
        toggleWorldMap();
        return;
      }
      if (k === 'z' || k === '[' || k === 'c' || k === ']') {
        e.preventDefault();
        keysRef.current.add(k);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        if (!pausedRef.current) jumpQueuedRef.current = true;
        return;
      }
      if (!pausedRef.current) {
        if (k === 'c') {
          e.preventDefault();
          triggerBattleActionRef.current?.('ball');
          return;
        }
        if (k === 'v') {
          e.preventDefault();
          triggerBattleActionRef.current?.('heal');
          return;
        }
        if (k === 'b') {
          e.preventDefault();
          triggerBattleActionRef.current?.('boost');
          return;
        }
        if (k === 'g') {
          e.preventDefault();
          triggerBattleActionRef.current?.('salvo');
          return;
        }
      }
      if (
        k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' ||
        k === 'w' || k === 'a' || k === 's' || k === 'd' ||
        (kb && [norm(kb.up), norm(kb.down), norm(kb.left), norm(kb.right)].includes(k))
      ) {
        e.preventDefault();
        keysRef.current.add(k);
        if (restorePointerLockRef.current && !pausedRef.current && !externalPausedRef.current) {
          tryRestorePointerLock();
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hubModal, profileOpen, squadEditorOpen, save.keyBindings, levelChoices, shopOpen, resultSummary, captureOffer, hud.inSafeZone, hud.hp, hud.maxHp]);

}
