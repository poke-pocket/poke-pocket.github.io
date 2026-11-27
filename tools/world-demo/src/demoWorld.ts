import * as THREE from 'three';
import {cameraOrbitPosition,cameraRelativeMovement,SHARED_CAMERA_MODES,type SharedCameraMode} from '../../../src/utils/cameraRigShared3D';
import {sound,BGM_TRACK_LABELS,type BgmTrackId} from '../../../src/utils/sound';
import {computeSolarDayNight} from '../../../src/utils/solarDayNight3D';
import type {WeatherKind} from '../../../src/utils/weatherSystem';
import {createNpcBillboard} from '../../../src/world3d/townAssetLoader';
import {createGameConsole} from './gameConsole';
import {createGameInteraction} from './gameInteraction';
import {updateProximityAutoDoors3D} from '../../../src/utils/architecturalBuildings3D';
import type {TownInteractPoint} from '../../../src/world3d/townTypes';

type DemoEvent={type:string;scene:string;position:{x:number;y:number;z:number};detail?:unknown};
type Interactable={id:string;type:string;label:string;position:THREE.Vector3;radius:number;detail?:unknown;point?:TownInteractPoint};

/** Standalone event and camera adapter; world content can register its own events. */
export function createDemoWorld(opts:{scene:THREE.Scene;camera:THREE.PerspectiveCamera;canvas:HTMLCanvasElement;controls:{enabled:boolean};hero:THREE.Object3D;sun:THREE.DirectionalLight;ambient:THREE.HemisphereLight;surface:(x:number,z:number,hint:number)=>number;onJump:()=>void}){
 const panel=document.createElement('div');panel.className='demo-panel';panel.innerHTML='<div class="demo-heading"><strong>互动 Demo</strong><label><input id="demo-enabled" type="checkbox" checked> 游戏视角</label></div><div class="demo-row"><label for="demo-camera">镜头</label><select id="demo-camera"><option value="hd2d">HD-2D 俯视</option><option value="chase">跟随</option><option value="free">自由环绕</option><option value="overhead">高空鸟瞰</option></select></div><p id="demo-prompt">靠近 NPC，按 E 交互</p><button id="demo-interact" type="button" disabled>交互 · E</button><div id="demo-log" aria-live="polite">事件：等待触发</div>';
 const viewport=document.querySelector('.viewport') as HTMLElement,drawer=document.querySelector('.panel') as HTMLElement;
 drawer.prepend(panel);
 const closeDrawer=document.createElement('button');closeDrawer.className='side-action';closeDrawer.textContent='返回世界';closeDrawer.addEventListener('click',()=>drawer.classList.remove('demo-settings-open'));drawer.prepend(closeDrawer);
 drawer.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>drawer.classList.remove('demo-settings-open')));
 panel.appendChild(document.querySelector('#reset-view')!);
 const settingsButton=document.createElement('button');settingsButton.className='demo-settings-toggle';settingsButton.type='button';settingsButton.textContent='⚙ 设置';settingsButton.setAttribute('aria-expanded','false');viewport.appendChild(settingsButton);
 settingsButton.addEventListener('click',()=>{gameConsole.open();settingsButton.setAttribute('aria-expanded','true')});
 const hud=document.createElement('div');hud.className='demo-status';hud.innerHTML='<div><small>天气</small><strong id="demo-weather-status">晴天</strong></div><button id="demo-music-toggle" type="button"><small>♪ 音乐</small><strong id="demo-track-status">已关闭</strong></button><div><small>时间</small><strong id="demo-time-status">12:00</strong></div>';viewport.appendChild(hud);
 const action=document.createElement('div');action.className='demo-action';action.innerHTML='<button id="demo-jump" type="button">跳跃</button>';viewport.appendChild(action);action.querySelector('button')!.addEventListener('click',opts.onJump);
 const eventPanel=document.createElement('div');eventPanel.hidden=true;viewport.appendChild(eventPanel);
 for(const selector of ['#demo-prompt','#demo-interact','#demo-log'])eventPanel.appendChild(panel.querySelector(selector)!);
 const env=document.createElement('section');env.className='settings demo-environment';env.innerHTML='<strong>环境预览</strong><div class="setting-row"><label for="demo-weather">天气</label><select id="demo-weather"><option value="clear">晴天</option><option value="cloudy">多云</option><option value="rain">雨天</option><option value="storm">雷雨</option><option value="hail">冰雹</option><option value="snow">下雪</option><option value="windy">大风</option></select></div><div class="setting-row"><label for="demo-time">时间</label><input id="demo-time" type="time" value="12:00"></div><div class="setting-row"><label for="demo-track">背景音乐</label><select id="demo-track"><option value="town">城镇漫步</option><option value="town_night">都市晚风</option><option value="adventure">郊外远征</option><option value="restaurant">餐厅</option><option value="house">居民住宅</option></select></div>';
 drawer.insertBefore(env,panel.nextSibling);drawer.querySelectorAll('details').forEach(d=>d.open=false);
 const weatherSelect=env.querySelector('#demo-weather') as HTMLSelectElement,timeInput=env.querySelector('#demo-time') as HTMLInputElement,trackSelect=env.querySelector('#demo-track') as HTMLSelectElement;
 const weatherStatus=hud.querySelector('#demo-weather-status') as HTMLElement,timeStatus=hud.querySelector('#demo-time-status') as HTMLElement,trackStatus=hud.querySelector('#demo-track-status') as HTMLElement,musicToggle=hud.querySelector('#demo-music-toggle') as HTMLButtonElement;
 const weatherNames:Record<WeatherKind,string>={clear:'晴天',cloudy:'多云',rain:'雨天',storm:'雷雨',hail:'冰雹',snow:'下雪',windy:'大风'};
 const particlesGeo=new THREE.BufferGeometry(),particlePositions=new Float32Array(700*3);
 for(let i=0;i<700;i++){particlePositions[i*3]=(Math.random()-.5)*60;particlePositions[i*3+1]=Math.random()*22;particlePositions[i*3+2]=(Math.random()-.5)*60}
 particlesGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));const particleMat=new THREE.PointsMaterial({color:0xbadfff,size:.22,transparent:true,opacity:.7,depthWrite:false});const particles=new THREE.Points(particlesGeo,particleMat);particles.name='Demo_weather';particles.frustumCulled=false;particles.visible=false;opts.scene.add(particles);
 let weather:WeatherKind='clear',audioEnabled=false;
 sound.setBgm(false,42);sound.setAmbient(false,55);sound.setTrack('town');
 const applyEnvironment=()=>{
  weather=weatherSelect.value as WeatherKind;const [hh,mm]=timeInput.value.split(':').map(Number),now=new Date(),timestamp=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),(Number.isFinite(hh)?hh:12)-8,Number.isFinite(mm)?mm:0);
  const solar=computeSolarDayNight(31.23,121.47,timestamp),cloud=weather==='storm'?.56:weather==='rain'?.72:weather==='cloudy'?.84:1;
  opts.scene.background=new THREE.Color(solar.skyHex);if(opts.scene.fog instanceof THREE.Fog)opts.scene.fog.color.setHex(solar.fogHex);
  opts.sun.color.setHex(solar.sunHex);opts.sun.intensity=solar.sunIntensity*cloud;opts.ambient.color.setHex(solar.hemiSkyHex);opts.ambient.groundColor.setHex(solar.hemiGroundHex);opts.ambient.intensity=solar.hemiIntensity*cloud;
  particles.visible=['rain','storm','hail','snow'].includes(weather);particleMat.color.setHex(weather==='snow'||weather==='hail'?0xf1f7ff:0x9dc8e8);particleMat.size=weather==='snow'?.34:weather==='hail'?.4:.17;
  weatherStatus.textContent=weatherNames[weather];timeStatus.textContent=timeInput.value||'12:00';sound.setWeatherAmbience(weather,{indoor:false,isNight:solar.phase==='night'});
 };
 weatherSelect.addEventListener('change',()=>{applyEnvironment();dispatch('weather.change',{weather})});timeInput.addEventListener('change',()=>{applyEnvironment();dispatch('time.change',{time:timeInput.value})});
 const gameConsole=createGameConsole(patch=>{const p=patch.prefs;if(p?.worldWeatherMode){weatherSelect.value=p.worldWeatherMode==='auto'?'clear':p.worldWeatherMode;weatherSelect.dispatchEvent(new Event('change'))}if(p?.worldTimeMode){timeInput.value=({auto:'12:00',day:'12:00',dusk:'18:00',night:'22:00'} as const)[p.worldTimeMode];timeInput.dispatchEvent(new Event('change'))}if(patch.bgmEnabled!==undefined){audioEnabled=patch.bgmEnabled;sound.unlock();sound.setBgm(audioEnabled,patch.bgmVolume??42);trackStatus.textContent=audioEnabled?BGM_TRACK_LABELS[trackSelect.value as BgmTrackId]:'已关闭'}},()=>drawer.classList.add('demo-settings-open'));
 trackSelect.addEventListener('change',()=>{sound.setTrack(trackSelect.value as BgmTrackId);if(audioEnabled)trackStatus.textContent=BGM_TRACK_LABELS[trackSelect.value as BgmTrackId];dispatch('music.track',{track:trackSelect.value})});
 musicToggle.addEventListener('click',()=>{audioEnabled=!audioEnabled;sound.unlock();sound.setBgm(audioEnabled,42);sound.setAmbient(audioEnabled,55);applyEnvironment();trackStatus.textContent=audioEnabled?BGM_TRACK_LABELS[trackSelect.value as BgmTrackId]:'已关闭';dispatch('audio.toggle',{enabled:audioEnabled})});
 applyEnvironment();
 const enabled=panel.querySelector('#demo-enabled') as HTMLInputElement,select=panel.querySelector('#demo-camera') as HTMLSelectElement,prompt=eventPanel.querySelector('#demo-prompt') as HTMLElement,button=eventPanel.querySelector('#demo-interact') as HTMLButtonElement,log=eventPanel.querySelector('#demo-log') as HTMLElement;
 const content=new THREE.Group();content.name='Demo_world_interactions';content.userData.noGround=true;opts.scene.add(content);
 let currentModel:THREE.Object3D|null=null,currentScene='',items:Interactable[]=[],nearest:Interactable|undefined,insideZone=false,messageUntil=0,message='';
 let mode:SharedCameraMode='hd2d',yaw=0,pitch=SHARED_CAMERA_MODES.hd2d.pitch,zoom=1,smoothedDist=SHARED_CAMERA_MODES.hd2d.dist,smoothedPitch=pitch,dragging=false,lastX=0,lastY=0;
 const pivot=new THREE.Vector3(),listeners=new Set<(e:DemoEvent)=>void>();
 const dispatch=(type:string,detail?:unknown)=>{const p=opts.hero.position,e:DemoEvent={type,scene:currentScene,position:{x:p.x,y:p.y,z:p.z},detail};log.textContent='事件：'+type;for(const fn of listeners)fn(e);window.dispatchEvent(new CustomEvent('pixel-world:event',{detail:e}));return e};
 const interaction=createGameInteraction(viewport,opts.camera,action=>{if(!nearest)return;dispatch(nearest.type,{id:nearest.id,action,...(nearest.detail as object??{})});interaction.speak(action==='chat'?'你好！这片街区正在建设中。':'沿着道路走，可以看看附近的建筑。',nearest.position)});
 const setScene=(model:THREE.Object3D|null,id:string)=>{
  if(model===currentModel&&id===currentScene)return;
  currentModel=model;currentScene=id;items=[];nearest=undefined;insideZone=false;
  while(content.children.length){const child=content.children[0];content.remove(child);child.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}})}
  if(!model)return;
  const p=opts.hero.position,ix=p.x+3.2,iz=p.z-2.0,iy=opts.surface(ix,iz,p.y)+.02;
  const npc=createNpcBillboard('/sprites/people/youngster.png',ix,iy,iz,2.45);npc.name='Demo_NPC';content.add(npc);
  items.push({id:'demo-npc',type:'npc.interact',label:'与示例 NPC 交谈',position:new THREE.Vector3(ix,iy,iz),radius:2.4,detail:{npcId:'demo-npc'}});
  const zx=p.x-4,zz=p.z-2,zy=opts.surface(zx,zz,p.y)+.02;
  items.push({id:'demo-zone',type:id==='tower'?'building.inspect':'road.inspect',label:id==='tower'?'检查建筑入口':'检查道路',position:new THREE.Vector3(zx,zy,zz),radius:2.1,detail:{sample:true}});
  for(const point of (model.userData.demoInteractables??[]) as TownInteractPoint[])items.push({id:point.id,type:'building.interact',label:point.label,position:new THREE.Vector3(point.x,point.y,point.z),radius:point.radius,point});
  pivot.set(p.x,p.y+1.52,p.z);dispatch('scene.ready');
 };
 const interact=()=>{if(!enabled.checked||!nearest)return;interaction.execute()};
 button.addEventListener('click',interact);
 window.addEventListener('keydown',e=>{const target=e.target;if(document.body.classList.contains('demo-handheld-open')||(target instanceof Element&&target.matches('input,select,textarea'))||e.repeat)return;if(e.key.toLowerCase()==='e'){e.preventDefault();interact()}else if(e.key==='Tab'&&nearest){e.preventDefault();interaction.next()}});
 enabled.addEventListener('change',()=>{opts.controls.enabled=!enabled.checked;content.visible=enabled.checked;dispatch(enabled.checked?'demo.enabled':'demo.disabled')});
 select.addEventListener('change',()=>{mode=select.value as SharedCameraMode;pitch=SHARED_CAMERA_MODES[mode].pitch;dispatch('camera.mode',{mode})});
 opts.canvas.addEventListener('pointerdown',e=>{if(!enabled.checked||e.button!==0)return;dragging=true;lastX=e.clientX;lastY=e.clientY;opts.canvas.setPointerCapture(e.pointerId)});
 opts.canvas.addEventListener('pointermove',e=>{if(!enabled.checked||!dragging)return;yaw-=(e.clientX-lastX)*.006;pitch=Math.max(-.16,Math.min(1.35,pitch+(e.clientY-lastY)*.005));lastX=e.clientX;lastY=e.clientY});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])opts.canvas.addEventListener(type,()=>{dragging=false});
 opts.canvas.addEventListener('wheel',e=>{if(!enabled.checked||e.ctrlKey||e.metaKey)return;e.preventDefault();zoom=Math.max(.58,Math.min(1.48,zoom+e.deltaY*.00085))},{passive:false});
 const reset=()=>{yaw=0;pitch=SHARED_CAMERA_MODES[mode].pitch;zoom=1;const p=opts.hero.position;pivot.set(p.x,p.y+1.52,p.z)};
 const movement=(side:number,forward:number)=>cameraRelativeMovement(side,-forward,yaw);
 const tick=(dt:number,model:THREE.Object3D|null,id:string,move:{x:number;z:number})=>{
  if(particles.visible){particles.position.set(opts.hero.position.x,opts.hero.position.y,opts.hero.position.z);for(let i=0;i<700;i++){const k=i*3+1;particlePositions[k]-=dt*(weather==='snow'?3:weather==='hail'?22:16);if(particlePositions[k]<0)particlePositions[k]+=22}(particlesGeo.attributes.position as THREE.BufferAttribute).needsUpdate=true}
  setScene(model,id);if(!enabled.checked)return;
  const p=opts.hero.position;
  if(model?.userData.demoDoors)updateProximityAutoDoors3D(model.userData.demoDoors,[{x:p.x,y:p.y,z:p.z}],dt);
  for(const mesh of model?.userData.demoNpcs??[])mesh.rotation.y=opts.camera.rotation.y;
  const npc=content.getObjectByName('Demo_NPC');if(npc)npc.rotation.y=opts.camera.rotation.y;
  nearest=items.filter(item=>item.id!=='demo-zone'&&Math.hypot(p.x-item.position.x,p.z-item.position.z)<=item.radius&&Math.abs(p.y-item.position.y)<2.5).sort((a,b)=>Math.hypot(p.x-a.position.x,p.z-a.position.z)-Math.hypot(p.x-b.position.x,p.z-b.position.z))[0];
  interaction.update(nearest?.id??null,nearest?.position??null,nearest?.point);
  button.disabled=!nearest;prompt.textContent=Date.now()<messageUntil?message:nearest?'按 E：'+nearest.label:'靠近 NPC 或标记，按 E 交互';
  const inZone=items.some(item=>item.id==='demo-zone'&&Math.hypot(p.x-item.position.x,p.z-item.position.z)<1.15);
  if(inZone&&!insideZone)dispatch('zone.enter',{id:'demo-zone'});insideZone=inZone;
  pivot.lerp(new THREE.Vector3(p.x,p.y+1.52,p.z),Math.min(1,dt*14));
  if(mode==='chase'&&!dragging&&Math.hypot(move.x,move.z)>.12){const desired=Math.atan2(-move.x,-move.z);let diff=desired-yaw;while(diff>Math.PI)diff-=Math.PI*2;while(diff< -Math.PI)diff+=Math.PI*2;yaw+=diff*Math.min(1,dt*2.6)}
  const spec=SHARED_CAMERA_MODES[mode],damp=Math.min(1,dt*8.5);smoothedDist+=(spec.dist*zoom-smoothedDist)*damp;smoothedPitch+=(pitch-smoothedPitch)*damp;
  const pos=cameraOrbitPosition(pivot,yaw,smoothedPitch,smoothedDist);const floor=opts.surface(pos.x,pos.z,p.y);opts.camera.position.set(pos.x,Math.max(pos.y,floor+1.05),pos.z);
  const sky=Math.max(0,(.24-smoothedPitch)*8.5);opts.camera.lookAt(pivot.x,pivot.y+.68+sky,pivot.z);
 };
 const api={on:(fn:(e:DemoEvent)=>void)=>{listeners.add(fn);return()=>listeners.delete(fn)},emit:dispatch,addInteractable:(item:{id:string;type:string;label:string;x:number;y:number;z:number;radius?:number;detail?:unknown})=>{items.push({id:item.id,type:item.type,label:item.label,position:new THREE.Vector3(item.x,item.y,item.z),radius:item.radius??2.5,detail:item.detail})},getState:()=>({enabled:enabled.checked,scene:currentScene,mode,nearby:nearest?.id??null,position:opts.hero.position.toArray()})};
 (window as typeof window & {pixelWorldDemo?:typeof api}).pixelWorldDemo=api;
 opts.controls.enabled=false;
 return {tick,movement,reset,rotate:(delta:number)=>{yaw+=delta},isEnabled:()=>enabled.checked};
}
