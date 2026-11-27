import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { ArenaTownSocialAndBusOverlay, buildInteractActionsForTarget, type NearbyActionMenuState, type ProjectedBubble2D } from '../../../src/components/arena3d/ArenaTownSocialAndBusOverlay';
import type { TownInteractPoint } from '../../../src/world3d/townTypes';
import type { ArenaSharedCtx } from '../../../src/components/arena3d/arenaTypesAndProps';

export function createGameInteraction(viewport: HTMLElement, camera: THREE.Camera, onAction: (action: string) => void) {
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:12';
  viewport.appendChild(container);
  const root = createRoot(container);
  let selected = 0, lastTarget = '', actions: {id:string}[] = [], bubble: {text:string;until:number;position:THREE.Vector3}|null = null;
  const v = new THREE.Vector3();
  function project(p:THREE.Vector3) { v.copy(p).project(camera); return {sx:(v.x+1)*50,sy:(1-v.y)*50,inView:v.z<1&&Math.abs(v.x)<1.2&&Math.abs(v.y)<1.2}; }
  function execute(index:number) {const id=actions[index]?.id;if(id)onAction(id)}
  const api = {
    next: () => {if(actions.length)selected=(selected+1)%actions.length},
    execute: () => execute(selected),
    speak: (text:string, position:THREE.Vector3) => {bubble={text,position:position.clone(),until:Date.now()+3500}},
    update: (id:string|null, position:THREE.Vector3|null, point?:TownInteractPoint) => {
      if(id!==lastTarget){selected=0;lastTarget=id??''}
      let menu:NearbyActionMenuState|null=null;
      if(id&&position){
        const info=buildInteractActionsForTarget(point??({kind:'npc_chat',label:'附近的人',npcProfile:{name:'阿弘',role:'街头见习训练家',canBattle:false}} as TownInteractPoint),null);
        const available=info.actions.filter(a=>a.id==='chat'||a.id==='ask');actions=available;
        menu={targetId:id,speakerName:info.speakerName,wx:position.x,wy:position.y,wz:position.z,...project(position.clone().add(new THREE.Vector3(0,2.4,0))),actions:available};
      }else actions=[];
      const projectedBubbles:ProjectedBubble2D[]=bubble&&bubble.until>Date.now()?[{id:'demo-chat',speakerName:'阿弘',text:bubble.text,pageIdx:0,totalPages:1,...project(bubble.position.clone().add(new THREE.Vector3(0,3.1,0)))}]:[];
      const ctx={nearbyInteract:menu,interactOptionIdx:selected,setInteractOptionIdx:(i:number)=>{selected=i},executeInteractActionRef:{current:execute},projectedBubbles,worldBubblesRef:{current:[]},autoNavTargetsRef:{current:[]},simRef:{current:null},hubModal:'none'} as unknown as ArenaSharedCtx;
      root.render(<ArenaTownSocialAndBusOverlay ctx={ctx}/>);
    },
  };
  return api;
}
