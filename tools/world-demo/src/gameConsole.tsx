import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HandheldConsole, type AppSettingsPatch } from '../../../src/components/HandheldConsole';
import { createInitialSave, createPet } from '../../../src/utils/petEngine';
import { DEFAULT_GAME_PREFS } from '../../../src/types/pet';
import { setDevModeEnabled } from '../../../src/utils/devMode';
import gameStyles from '../../../src/index.css?inline';

export function createGameConsole(onEnvironment: (patch: AppSettingsPatch) => void, onSceneSettings: () => void) {
  const host = document.createElement('div');
  host.id = 'demo-game-console';
  host.style.cssText = 'position:fixed;inset:0;z-index:100;display:none';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = gameStyles + '\n:host{font-family:"Fusion Pixel",monospace}.demo-console-backdrop{position:fixed;inset:0;background:rgba(5,8,16,.72);display:flex;justify-content:center;align-items:center}.demo-scene-settings{position:fixed;right:20px;top:20px;z-index:101;padding:9px;background:#ffe066;border:3px solid #181c2b;color:#181c2b;font-weight:bold}';
  shadow.appendChild(style);
  const mount = document.createElement('div'); shadow.appendChild(mount);
  // This world has no combat or companions; hide their controls in the reused settings view.
  new MutationObserver(() => {for(const card of shadow.querySelectorAll('.settings-card')){if(/宝可梦叫声|战斗技能音效/.test(card.textContent ?? ''))(card as HTMLElement).style.display='none'}}).observe(mount,{childList:true,subtree:true});
  const root = createRoot(mount);
  const close = () => { host.style.display = 'none'; document.body.classList.remove('demo-handheld-open'); };
  function Console() {
    const [save, setSave] = useState(() => ({...createInitialSave(), prefs: {...DEFAULT_GAME_PREFS}, showShell: true}));
    const pet = useRef(createPet('pikachu', 'Demo')).current;
    const analog = useRef({x:0,y:0});
    const update = (patch: AppSettingsPatch) => {
      setSave(s => ({...s,...patch,prefs:{...s.prefs,...patch.prefs}}));
      onEnvironment(patch);
    };
    const noop = () => {};
    const inert = Object.fromEntries(['onHomeIconClick','onDpad','onButtonA','onSelectButton','onStartButton','onPatPet','onCleanPoop','onHealPet','onHealParty','onReleaseBallToRoom','onStartBattle','onFinishBattle','onFinishSurvivors','onSpendCoinsInRun','onCaptureBoss','onSelectFood','onBuyFood','onStartGame','onFinishGame','onBuyAccessory','onEquipAccessory','onBuyPokeball','onAssignPetRoom','onPullGacha','onPullGachaTen','onReleasePet','onSwitchPet','onResetSave'].map(name=>[name,noop]));
    return <div className="demo-console-backdrop" onClick={e => {if(e.target===e.currentTarget)close()}}>
      <button className="demo-scene-settings" onClick={() => {close();onSceneSettings()}}>场景与道路配置</button>
      <HandheldConsole {...inert as React.ComponentProps<typeof HandheldConsole>}
        save={save} pet={pet} mode="settings" battleIsTrainer={false} actionAnim="idle" patSeq={0}
        activeFood={null} speech={null} effects={[]} bezelIndex={0} menuCursor={0}
        controlSignal={{seq:0,dir:null}} analogVecRef={analog} openedEntryMode="settings"
        onUpdateSettings={update} onCloseHandheldTo3D={close} onExitMode={close}
        onNavigateMode={close} onButtonB={close} />
    </div>;
  }
  root.render(<Console />);
  return { open: () => {setDevModeEnabled(true);host.style.display='block';document.body.classList.add('demo-handheld-open')}, close };
}
