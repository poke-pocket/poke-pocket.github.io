import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { getHeroSpriteFrames } from './characterSprites3D';
import {buildParametricRoad,roadPoint,lanePaths,type RoadConfig,type RoadShape} from './parametricRoad';
import {buildComplexEnvironment} from './complexEnvironment';
import {buildComplexRoadside} from './complexRoadside';
import {createDemoWorld} from './demoWorld';
import {buildArchitectureShowcase} from './architectureShowcase';
import {advanceGroundJump,GAME_JUMP_VELOCITY} from '../../../src/utils/cameraRigShared3D';

const $ = (s:string) => document.querySelector(s) as HTMLElement;
const holder = $('#canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
holder.appendChild(renderer.domElement);
const scene = new THREE.Scene();scene.background=new THREE.Color('#b9d8d2');scene.fog = new THREE.Fog('#b9d8d2',140,350);
const camera = new THREE.PerspectiveCamera(42,1,.1,700);
const controls = new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=5;controls.maxDistance=480;controls.maxPolarAngle=Math.PI*.48;controls.screenSpacePanning=false;controls.enablePan=false;
const ambient=new THREE.HemisphereLight(0xeafaff,0x7e9982,1.45);scene.add(ambient);
const sun=new THREE.DirectionalLight(0xfff5df,1.4);sun.position.set(-20,65,25);scene.add(sun);
const field=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshLambertMaterial({color:0x91b998}));field.rotation.x=-Math.PI/2;field.position.y=-.12;field.name='ground_grass';scene.add(field);
const grid=new THREE.GridHelper(700,350,0x648e81,0x7da995);grid.position.y=-.11;const gm=grid.material as THREE.Material;gm.transparent=true;gm.opacity=.18;grid.visible=false;scene.add(grid);

// The same bottom-anchored billboard, hero frames, texture filters and scale used by the game.
const frames=getHeroSpriteFrames('red');
const heroGeo=new THREE.PlaneGeometry(1,1);heroGeo.translate(0,.5,0);
const heroMat=new THREE.MeshBasicMaterial({map:frames.down_idle0??frames.down_0,transparent:true,alphaTest:.12,side:THREE.DoubleSide});
const hero=new THREE.Mesh(heroGeo,heroMat);hero.scale.set(2.55,2.85,1);hero.rotation.order='YXZ';scene.add(hero);
const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,14),new THREE.MeshBasicMaterial({color:0x101c12,transparent:true,opacity:.35,depthWrite:false}));shadow.scale.setScalar(.66);shadow.rotation.x=-Math.PI/2;scene.add(shadow);
const marker=new THREE.Mesh(new THREE.RingGeometry(.78,.88,48),new THREE.MeshBasicMaterial({color:0xfff5bf,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));marker.rotation.x=-Math.PI/2;scene.add(marker);
const loader=new GLTFLoader(), raycaster=new THREE.Raycaster();const down=new THREE.Vector3(0,-1,0);
const models:Record<string,any>={
 architecture:{name:'建筑街区',subtitle:'对比可进入商店、别墅和现代摩天大楼。',label:'游戏建筑生成器 · 比例对照',origin:[0,0,29],points:[['饭店',-92,0,25],['商店',-45,0,25],['酒店',2,0,25],['别墅',46,0,25],['摩天大楼',94,0,25]]},
 complex:{name:'综合城市路网',subtitle:'起伏地形、多个路口、高架、隧道和地下车库。',label:'固定示例 · 双向 4 车道主路',file:'complex.glb',origin:[0,0,-5],points:[['中心路口',0,0,-5],['西侧路口',-150,0,-5],['东侧路口',150,0,-5],['汇入口',-68,0,26.6],['西侧弯道',-93,0,63],['东侧弯道',93,0,63],['高架桥面',52,6,-65]]},
 parametric:{name:'可配置道路',subtitle:'切换车道数量、中央预留带、非机动车道、盲道与道路形状。',label:'参数化道路',origin:[0,0,0],points:[]},
 network:{name:'城市道路网',subtitle:'把角色放在道路上，看看车道、人行道和高架的尺度。',label:'可调车道宽度',file:'network.glb',origin:[0,0,-5],points:[['十字路口',0,0,-5],['主辅路',-19,0,8],['匝道入口',15,0,-30],['高架桥面',48,6,-30]]},
 city:{name:'城市主辅路',subtitle:'站在人行道和主路旁，对比道路、车道与路灯。',label:'可调车道宽度',file:'city.glb',origin:[0,0,7.4],points:[['人行道',0,0,11],['主路',0,0,2],['辅路',0,0,9]]},
 tower:{name:'现代玻璃大楼',subtitle:'从楼门前抬头，看看人物与一楼、入口的比例。',label:'大楼宽约 40.8 米 · 入口宽约 8 米',file:'tower.glb',origin:[3,0,21],points:[['楼门附近',3,0,21],['一层侧面',22,0,0]]},
 bridged:{name:'双塔与连廊',subtitle:'人物站在楼下，对照双塔和空中连廊。',label:'单塔宽约 25 米 · 体素边长 0.5 米',file:'bridged.glb',origin:[-15,0,20],points:[['楼前',-15,0,20],['双塔之间',0,0,10]]},
 cobblestone:{name:'乡村石板路',subtitle:'看看训练师站在石板路和树木旁的大小。',label:'道路宽约 6 单位 · 细颗粒纹理',file:'cobblestone.glb',origin:[0,0,1],points:[['路中央',0,0,0],['树旁',-6,0,5.5]]},
 dirt:{name:'乡间土路',subtitle:'走在乡间小路上，对比角色和路面宽度。',label:'道路宽约 6 单位 · 细颗粒纹理',file:'dirt.glb',origin:[0,0,1],points:[['路中央',0,0,0],['树旁',-6,0,5.5]]}
};
let model:THREE.Group|null=null, current='network', modelScale=1, laneWidth=8.775, sidewalkWidth=7.8, loadSerial=0;
const stripeWidth={value:.65},stripeGap={value:.8},crossDepth={value:3},crossWear={value:.14},lineWear={value:.10},pavingStyle={value:0};
let sidewalkMaterials:THREE.Material[]=[];let overlay:THREE.Group|null=null,vehicle:THREE.Group|null=null,vehicleTicket=0;let firstSceneLoad=true;
let parametricRoot:THREE.Group|null=null;
let cityPaths:any=null, mergeStart=performance.now(), carScale=1;
let activeRoadGraph:any=null;
let activeComplexConfig:any=null;
const vehicleSpecs=[{id:'sneznyj/Voxel_Taxi',label:'出租车',height:3.85,length:12.4335},{id:'external/city-bus-voxel',label:'公交车',height:6.6105,length:24.3735},{id:'external/touring-coach-voxel',label:'大巴',height:7.3335,length:25.8195},{id:'external/box-truck-voxel',label:'卡车',height:7.23,length:17.5575}];
let taxiWidth=6.085,vehicleWidths=[6.085,5.268,5.268,5.268];

const keys=new Set<string>();let previous=performance.now(),walkClock=0,walked=false,jumpOffset=0,jumpVelocity=0;
function jump(){if(jumpOffset<=.001&&jumpVelocity===0)jumpVelocity=GAME_JUMP_VELOCITY}
function surface(x:number,z:number,hint:number){
 raycaster.set(new THREE.Vector3(x,hint+1.05,z),down);raycaster.far=60;
 // Presentation overlays (including sprite labels) are never walkable ground.
 // Exclude them before raycasting, since sprites otherwise require a camera.
 const hits=model?raycaster.intersectObjects(model.children.filter(child=>!child.userData.noGround),true):[];
 for(const h of hits){let obj:THREE.Object3D|null=h.object;let ignored=false;while(obj){if(obj.userData.noGround){ignored=true;break}obj=obj.parent}if(ignored||(h.face && h.face.normal.y<.15))continue; if(h.point.y<=hint+1.0)return h.point.y;}
 return -.1;
}
function positionHero(x:number,y:number,z:number,reset=true){
 jumpOffset=0;jumpVelocity=0;
 const px=x*modelScale,pz=z*modelScale,py=y*modelScale;
 const actual=surface(px,pz,py);hero.position.set(px,Math.max(py,actual)+.02,pz);shadow.position.set(px,hero.position.y-.01,pz);marker.position.set(px,hero.position.y+.005,pz);
 if(reset){controls.target.set(px,hero.position.y+1.2,pz);camera.position.set(px+12,hero.position.y+12,pz+17);controls.update();}
}
const demo=createDemoWorld({scene,camera,canvas:renderer.domElement,controls,hero,sun,ambient,surface,onJump:jump});
function setButtons(spec:any){const jump=$('#jump-list');jump.innerHTML='';for(const [name,x,y,z] of spec.points){const button=document.createElement('button');button.textContent=name;button.addEventListener('click',()=>{positionHero(x,y,z);if(name==='全网总览'){controls.target.set(0,0,0);camera.position.set(210,240,250);controls.update()}if(['道路隧道','地下通道','地下车库'].includes(name)){const p=hero.position;controls.target.set(p.x+(name==='地下车库'?2:0)*modelScale,p.y+1.2*modelScale,p.z+(name==='地下车库'?3:0)*modelScale);camera.position.set(p.x+(name==='地下车库'?-8:0)*modelScale,p.y+(name==='地下车库'?2.8:1.5)*modelScale,p.z+9*modelScale);controls.update()}if(name==='汇入口'){const center=new THREE.Vector3(0,0,(2*laneWidth+.65)*modelScale);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(30,32,38).multiplyScalar(modelScale));controls.update()}});jump.appendChild(button)}}
// Subtle quantized world-space grain and paving joints: visual layer only.
function applyPixelSurface(root: THREE.Object3D){
 root.traverse(obj=>{
  const m=obj as THREE.Mesh;if(!m.isMesh)return;
  const name=m.name.toLowerCase();
  let kind=name.includes('lane_markings')||name.includes('center_lines')||name.includes('frontage_markings')||name.includes('merge_markings')||name.includes('junction_markings')?'line':name.includes('crosswalk')?'paint':name.includes('road_surface')||name.includes('ramp_surface')||name.includes('main_road')||name.includes('frontage_roads')||name.includes('non_motor_lane')||name==='reserved_median'||name==='path_base'||name==='surface_detail'?'road':name.includes('sidewalk')||name.includes('paving_joints')||name==='site'?'paving':name==='ground_grass'||name==='terrain'?'grass':'';
  if(!kind)return;
  const original=Array.isArray(m.material)?m.material:[m.material];
  const modified=original.map(mat=>{const material=mat.clone();
   if(kind==='paving' && (name.includes('sidewalk')||name.includes('paving_joints'))){(material as THREE.MeshStandardMaterial).color.set(($('#pavement-color') as HTMLInputElement).value);sidewalkMaterials.push(material)}
   material.onBeforeCompile=(shader:any)=>{
    if(kind==='paving'){shader.uniforms.uPavingStyle=pavingStyle;shader.fragmentShader='uniform float uPavingStyle;\n'+shader.fragmentShader}
    if(kind==='line'){shader.uniforms.uLineWear=lineWear;shader.fragmentShader='uniform float uLineWear;\n'+shader.fragmentShader}
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPixelWorld;')
     .replace('#include <begin_vertex>','#include <begin_vertex>\nvPixelWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vPixelWorld;
      float pixelHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`);
    const text=kind==='paving'?`
      vec2 pavementPos = vPixelWorld.xz;
      float tileSize = uPavingStyle > 1.5 ? 0.52 : 0.38;
      if (uPavingStyle > 1.5) pavementPos.x += mod(floor(pavementPos.y / tileSize), 2.0) * tileSize * 0.5;
      vec2 tiles = floor(pavementPos / tileSize);
      float grain = pixelHash(floor(vPixelWorld.xz / 0.095));
      float tileTone = pixelHash(tiles);
      float mottling = pixelHash(floor(vPixelWorld.xz / 1.52));
      float softVariation = uPavingStyle > 0.5 && uPavingStyle < 1.5 ? 0.96 + grain * 0.035 : 0.88 + tileTone * 0.16 + grain * 0.035 + mottling * 0.025;
      vec2 seam = mod(pavementPos, tileSize);
      float joint = (1.0 - step(0.025, min(seam.x, seam.y))) * (uPavingStyle > 0.5 && uPavingStyle < 1.5 ? 0.0 : 1.0);
      diffuseColor.rgb *= softVariation * (1.0 - joint * 0.17);`:kind==='grass'?`
      vec2 pixelCell = floor(vPixelWorld.xz / 0.22);
      float grain = pixelHash(pixelCell);
      float mottling = pixelHash(floor(vPixelWorld.xz / 0.88));
      float lightFleck = step(0.97, grain) * 0.055;
      diffuseColor.rgb *= 0.94 + grain * 0.035 + mottling * 0.05 + lightFleck;`:kind==='paint'?`
      vec2 pixelCell = floor(vPixelWorld.xz / 0.11);
      float grain = pixelHash(pixelCell);
      float patina = pixelHash(floor(vPixelWorld.xz / 0.44));
      float worn = step(0.91, grain) * 0.13 + step(0.90, patina) * 0.045;
      diffuseColor.rgb *= 0.94 + grain * 0.025 + patina * 0.025 - worn;`:kind==='line'?`
      float markGrain = pixelHash(floor(vPixelWorld.xz / 0.10));
      float markPatina = pixelHash(floor(vPixelWorld.xz / 0.42));
      if (markGrain < uLineWear * 0.10) discard;
      diffuseColor.rgb *= 1.0 - uLineWear * (0.08 + markPatina * 0.14);`:`
      vec2 pixelCell = floor(vPixelWorld.xz / 0.16);
      float grain = pixelHash(pixelCell);
      float mottling = pixelHash(floor(vPixelWorld.xz / 0.64));
      float fleck = step(0.975, grain) * 0.055 - step(grain, 0.025) * 0.05;
      diffuseColor.rgb *= 0.92 + mottling * 0.055 + grain * 0.035 + fleck;`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+text);
   };
   material.customProgramCacheKey=()=>`voxel-surface-${kind}-v2`;material.needsUpdate=true;return material;});
  m.material=Array.isArray(m.material)?modified:modified[0];
 });
}
// Preview crossings remain parameterized at runtime. The saved configuration can
// regenerate equivalent physical geometry through the Python model generator.
function createCrosswalks(graph:any){
 const group=new THREE.Group();group.name='Configurable_crosswalks';group.userData.noGround=true;
 graph.crosswalks.forEach((cross:any,index:number)=>{
  const a=cross.endpoints[0],b=cross.endpoints[1],dx=b.x-a.x,dz=b.z-a.z,roadWidth=Math.hypot(dx,dz),nx=-dz/roadWidth,nz=dx/roadWidth,half=cross.merged_short_link?cross.width/2:2;
  const points=[a.x-nx*half,cross.center.y+.07,a.z-nz*half,b.x-nx*half,cross.center.y+.07,b.z-nz*half,b.x+nx*half,cross.center.y+.07,b.z+nz*half,a.x+nx*half,cross.center.y+.07,a.z+nz*half];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0,0,1,0],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,2,1,0,3,2]);
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(.94,.93,.86),roughness:.95,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  mat.onBeforeCompile=(shader:any)=>{
   Object.assign(shader.uniforms,{uStripeWidth:stripeWidth,uStripeGap:stripeGap,uCrossDepth:cross.merged_short_link?{value:cross.width}:crossDepth,uCrossExtent:{value:half*2},uCrossWear:crossWear,uRoadWidth:{value:roadWidth},uPaintSeed:{value:index*23+17}});
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vCrossUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCrossUv = uv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec2 vCrossUv;
    uniform float uStripeWidth; uniform float uStripeGap; uniform float uCrossDepth; uniform float uCrossExtent; uniform float uCrossWear; uniform float uRoadWidth; uniform float uPaintSeed;
    float crossHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))+uPaintSeed)*43758.5453); }`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float across = vCrossUv.x * uRoadWidth;
    float along = (vCrossUv.y - 0.5) * uCrossExtent;
    float phase = mod(across,uStripeWidth+uStripeGap);
    if (phase >= uStripeWidth || abs(along) > uCrossDepth*0.5) discard;
    float nearEdge = 1.0 - step(0.125,min(phase,uStripeWidth-phase));
    float nearEnd = 1.0 - step(0.125,uCrossDepth*0.5-abs(along));
    float paintNoise = crossHash(floor(vec2(across,along)/0.125));
    if (paintNoise < uCrossWear*(0.08 + nearEdge*0.60 + nearEnd*0.15)) discard;
    float tone = crossHash(floor(vec2(across,along)/0.42));
    diffuseColor.rgb *= 1.0 - uCrossWear*(0.08 + tone*0.12);`);
  };mat.customProgramCacheKey=()=>`crosswalk-parametric-v2`;group.add(new THREE.Mesh(geo,mat));
 });return group;
}
// Shader discards are preview-only; exports need actual stripe geometry.
function exportCrosswalks(graph:any){
 const vertices:number[]=[],indices:number[]=[];
 for(const cross of graph.crosswalks){const a=cross.endpoints[0],b=cross.endpoints[1],dx=b.x-a.x,dz=b.z-a.z,width=Math.hypot(dx,dz),ux=dx/width,uz=dz/width,nx=-uz,nz=ux,half=(cross.merged_short_link?cross.width:crossDepth.value)/2;
  for(let t=0;t<width;t+=stripeWidth.value+stripeGap.value){const end=Math.min(width,t+stripeWidth.value),base=vertices.length/3,y=cross.center.y+.07;
   for(const [along,side] of [[t,-half],[end,-half],[end,half],[t,half]])vertices.push(a.x+ux*along+nx*side,y,a.z+uz*along+nz*side);
   indices.push(base,base+2,base+1,base,base+3,base+2);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(.94,.93,.86),roughness:.95,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,mat);mesh.name='Exported_crosswalk_stripes';return mesh;
}
const propsMaterials={trunk:new THREE.MeshStandardMaterial({color:0x6a513c}),leaf:new THREE.MeshStandardMaterial({color:0x55845a}),light:new THREE.MeshStandardMaterial({color:0x79ad73}),dark:new THREE.MeshStandardMaterial({color:0x3f6c50}),curb:new THREE.MeshStandardMaterial({color:0x9caaa6}),rail:new THREE.MeshStandardMaterial({color:0x82999d}),soil:new THREE.MeshStandardMaterial({color:0x604b38}),flower:new THREE.MeshStandardMaterial({color:0xe9b3a2}),lamp:new THREE.MeshStandardMaterial({color:0x708688,roughness:.72,metalness:.32}),lampDark:new THREE.MeshStandardMaterial({color:0x445b5e,roughness:.82,metalness:.25}),lampTrim:new THREE.MeshStandardMaterial({color:0xa3b1ac,roughness:.7,metalness:.35}),lampLight:new THREE.MeshStandardMaterial({color:0xf8eac4,emissive:0xd8ba76,emissiveIntensity:.35})};
function addBox(g:THREE.Object3D,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);g.add(m);return m;}
function addTree(g:THREE.Object3D,x:number,z:number){
 addBox(g,propsMaterials.trunk,x,1.05,z,.38,2.0,.38);
 addBox(g,propsMaterials.dark,x,2.35,z,1.45,.95,1.45);
 addBox(g,propsMaterials.leaf,x-.38,2.67,z,1.1,.8,1.35);
 addBox(g,propsMaterials.leaf,x+.38,2.67,z,1.1,.8,1.35);
 addBox(g,propsMaterials.light,x,3.15,z,1.12,.55,1.12);
}
function addBusStop(parent:THREE.Object3D,x:number,z:number,style:string){
 const stop=new THREE.Group();stop.name=`Bus_stop_${style}`;stop.position.set(x,0,z);stop.scale.setScalar(1.2);parent.add(stop);
 const metal=propsMaterials.lampDark,roof=style==='village'?propsMaterials.trunk:propsMaterials.lamp,trim=propsMaterials.lampTrim;
 const glass=new THREE.MeshStandardMaterial({color:0xb9d9d3,transparent:true,opacity:.32,roughness:.3,metalness:.05,depthWrite:false});glass.name='Shelter_glass';
 addBox(stop,propsMaterials.curb,0,.08,0,7.6,.16,2.5);
 for(const xx of [-3.3,3.3])for(const zz of [-.9,.9])addBox(stop,metal,xx,1.55,zz,.14,3,.14);
 addBox(stop,roof,0,3.14,0,7.35,.22,2.25);
 if(style==='village'){addBox(stop,propsMaterials.trunk,0,3.30,0,6.9,.16,1.75);addBox(stop,propsMaterials.trunk,0,3.44,0,6.2,.13,1.22)}
 else {addBox(stop,trim,0,3.28,0,6.9,.08,1.82);addBox(stop,style==='modern'?glass:trim,0,1.7,-.91,6.4,2.35,.08);}
 if(style==='modern')for(const xx of [-3.28,3.28])addBox(stop,glass,xx,1.65,0,.07,2.1,1.65);
 // Fine ribs, roof fascia, seat slats and lighting add detail without blocking the path.
 for(const xx of [-2.2,0,2.2]){addBox(stop,trim,xx,1.75,-.9,.045,2.25,.06);addBox(stop,metal,xx,3.02,0,.045,.09,1.8)}
 addBox(stop,trim,0,3.13,.99,7.15,.11,.08);addBox(stop,propsMaterials.lampLight,0,2.98,.70,3.8,.035,.07);
 for(const zz of [-.43,-.24,-.05])addBox(stop,style==='village'?propsMaterials.lampDark:metal,0,.91,zz,3.55,.025,.025);
 if(style==='village')addBox(stop,propsMaterials.trunk,0,1.05,-.88,6.1,.28,.12);
 addBox(stop,style==='village'?propsMaterials.trunk:trim,0,.83,-.25,3.8,.13,.62);
 for(const xx of [-1.5,1.5])addBox(stop,metal,xx,.45,-.25,.11,.76,.48);
 addBox(stop,metal,-2.0,2.05,-.78,1.05,1.55,.08);addBox(stop,propsMaterials.lampLight,-2.0,2.05,-.72,.86,1.3,.035);
 const canvas=document.createElement('canvas');canvas.width=96;canvas.height=144;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#dce9dc';ctx.fillRect(0,0,96,144);ctx.fillStyle='#27565b';ctx.fillRect(0,0,96,29);ctx.fillStyle='#f5faf0';ctx.font='bold 16px sans-serif';ctx.fillText('BUS',8,21);ctx.fillStyle='#35595a';ctx.font='bold 13px sans-serif';ctx.fillText('01   06',8,53);ctx.fillText('12   18',8,76);for(let y=90;y<130;y+=10)ctx.fillRect(8,y,78,2);const texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;const poster=new THREE.Mesh(new THREE.PlaneGeometry(.82,1.26),new THREE.MeshBasicMaterial({map:texture}));poster.name='Bus_route_sign';poster.position.set(-2,2.05,-.697);stop.add(poster);
 const post=new THREE.Group();post.name='Bus_stop_sign';post.position.set(4.1,0,.8);stop.add(post);addBox(post,metal,0,1.6,0,.12,3.2,.12);addBox(post,style==='village'?propsMaterials.trunk:propsMaterials.lamp,0,3.18,0,.76,.55,.15);addBox(post,propsMaterials.lampLight,0,3.18,.09,.55,.32,.03);
 addVehiclePixelGrain(stop);
}
function addTrafficSignal(parent:THREE.Object3D,x:number,z:number){
 const g=new THREE.Group();g.name='Traffic_signal';g.position.set(x,0,z);parent.add(g);addBox(g,propsMaterials.lampDark,0,2.3,0,.16,4.6,.16);addBox(g,propsMaterials.lampDark,0,4.2,0,.52,1.25,.35);
 for(const [i,col] of [0xb63a34,0xdca34b,0x58a873].entries()){const mat=new THREE.MeshStandardMaterial({color:col,roughness:.8});addBox(g,mat,0,4.6-i*.4,.19,.25,.25,.035)}
}
function addStreetFurniture(g:THREE.Object3D){
 const w=8.775,choice=($('#stop-style') as HTMLSelectElement).value;
 if(choice!=='none'){const kinds=choice==='all'?['modern','metal','village']:[choice,choice,choice];[-200,-60,65].forEach((x,i)=>addBusStop(g,x,-(2*w+1.7),kinds[i]))}
 if(($('#street-furniture') as HTMLInputElement).checked){
  for(const cx of [-150,0,150]){const across=(cx===0?w:2*w)+.8;for(const sx of [-1,1])for(const sz of [-1,1])addTrafficSignal(g,cx+sx*across,sz*(2*w+.8))}
  for(const x of [-195,-55,70,195]){const parking=x>=-220&&x<=-172?7:0;addBox(g,propsMaterials.lampDark,x,.48,2*w+parking+2,.48,.9,.48);addBox(g,propsMaterials.lampTrim,x,.94,2*w+parking+2,.52,.08,.52);addBox(g,propsMaterials.lampDark,x+3,1.65,2*w+parking+1,.11,3.3,.11);addBox(g,propsMaterials.lamp,x+3,3.2,2*w+parking+1,.9,.55,.12)}
 }
}
function addStreetLight(g:THREE.Object3D,x:number,z:number,inward:number,height:number,size:number,heading=0){
 const light=new THREE.Group();light.name='Streetlight';light.position.set(x,0,z);light.rotation.y=heading;g.add(light);
 addBox(light,propsMaterials.lampDark,0,.10,0,.68*size,.20,.68*size);
 addBox(light,propsMaterials.lampTrim,0,.23,0,.49*size,.12,.49*size);
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12*size,.19*size,height-.30,8),propsMaterials.lamp);pole.position.y=(height+.30)/2;light.add(pole);
 addBox(light,propsMaterials.lampDark,0,.80,.176*size,.19*size,.35,.025*size);
 for(const dx of [-.22,.22])for(const dz of [-.22,.22])addBox(light,propsMaterials.lampTrim,dx*size,.245,dz*size,.055*size,.045,.055*size);
 // A short segmented sweep keeps the arm readable as pixels while giving it a curved profile.
 const arm=2.15*size,pts=Array.from({length:7},(_,i)=>{const t=i/6;return new THREE.Vector3(0,height-.20*size+.34*size*Math.sin(t*Math.PI/2),inward*arm*t)});
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dir=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(.075*size,.09*size,dir.length()+.025,8),propsMaterials.lamp);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());light.add(mesh)}
 const end=inward*arm,top=height+.14*size;
 addBox(light,propsMaterials.lampDark,0,top-.10*size,end,.61*size,.14*size,.98*size);
 addBox(light,propsMaterials.lamp,0,top,end,.54*size,.14*size,.88*size);
 addBox(light,propsMaterials.lampTrim,0,top+.065*size,end,.38*size,.045*size,.66*size);
 addBox(light,propsMaterials.lampLight,0,top-.19*size,end,.42*size,.06*size,.72*size);
 return light;
}
function paramConfig():RoadConfig{return {shape:($('#road-shape') as HTMLSelectElement).value as RoadShape,lanesEachDirection:Number(($('#road-lanes') as HTMLSelectElement).value),laneWidth,sidewalkWidth,medianWidth:Number(($('#median-width') as HTMLInputElement).value),bikeWidth:Number(($('#bike-width') as HTMLInputElement).value),parkingWidth:Number(($('#parking-width') as HTMLInputElement).value),parkingLength:Number(($('#parking-length') as HTMLInputElement).value),tactile:($('#tactile-enabled') as HTMLInputElement).checked,tactileWidth:Number(($('#tactile-width') as HTMLInputElement).value),curbWidth:Number(($('#curb-width') as HTMLInputElement).value),edgeSetback:Number(($('#edge-setback') as HTMLInputElement).value),drainSpacing:Number(($('#drain-spacing') as HTMLInputElement).value),manholeSpacing:Number(($('#manhole-spacing') as HTMLInputElement).value),manholeStyle:($('#manhole-style') as HTMLSelectElement).value as RoadConfig['manholeStyle'],length:160,curveShift:36,rise:8}}
function syncEdgeSetback(){const slider=$('#edge-setback') as HTMLInputElement,bike=Number(($('#bike-width') as HTMLInputElement).value),parking=Number(($('#parking-width') as HTMLInputElement).value),max=Math.max(.2,Math.floor(Math.min(2.5,(parking||bike||laneWidth)-.15)*10)/10);slider.max=String(max);if(Number(slider.value)>max)slider.value=String(max);$('#edge-setback-value').textContent=Number(slider.value).toFixed(1)}
function roadOffset(){return current==='tower'?19.2+3*laneWidth+sidewalkWidth+1.5:0}
function updateRoadside(){
 if(!model)return;if(overlay){model.remove(overlay);overlay=null}
 if(!['network','city','tower','parametric','complex'].includes(current))return;
 const g=new THREE.Group();g.name='Configurable_roadside';g.userData.noGround=true;const offset=roadOffset();
 if(current==='parametric'){
  if(($('#road-lights') as HTMLInputElement).checked){const c=paramConfig(),outer=c.medianWidth/2+c.lanesEachDirection*c.laneWidth+c.bikeWidth+c.parkingWidth+.65,height=Number(($('#light-height') as HTMLInputElement).value),size=Number(($('#light-size') as HTMLInputElement).value);
   for(const x of [-60,-30,0,30,60])for(const sign of [-1,1]){const p=roadPoint(c,x,sign*outer),light=addStreetLight(g,p.x,p.z,-sign,height,size,p.heading);light.position.y=p.y}
  }
  overlay=g;model.add(g);return;
 }
 if(current==='complex'){
  if(activeComplexConfig&&activeRoadGraph)g.add(buildComplexRoadside(paramConfig(),activeComplexConfig,activeRoadGraph));
  if(($('#complex-greenery') as HTMLInputElement).checked){const green=new THREE.Group();green.name='Roadside_greenery';g.add(green);for(const [a,b,sides] of [[-210,-180,[-1,1]],[-85,-35,[-1]],[35,85,[-1]],[180,220,[-1,1]]] as [number,number,number[]][])for(const side of sides){const parking=side>0&&a===-210?7:0,z=side*(2*8.775+7.8+parking+1.15);addBox(green,propsMaterials.soil,(a+b)/2,.035,z,b-a,.10,2.15);for(let x=a+2;x<b-1;x+=3.5){addBox(green,propsMaterials.dark,x,.25,z,2.6,.38,1.65);addBox(green,propsMaterials.leaf,x+.5,.46,z-.2,1.65,.3,1.1)}for(let x=a+9;x<b-4;x+=18)addTree(green,x,z)}}
  if(($('#road-lights') as HTMLInputElement).checked){const height=Number(($('#light-height') as HTMLInputElement).value),size=Number(($('#light-size') as HTMLInputElement).value);for(const x of [-205,-110,-55,55,110,205])for(const sign of [-1,1]){const parking=sign>0&&x>=-220&&x<=-172?7:0;addStreetLight(g,x,sign*(2*8.775+parking+.65),-sign,height,size)}}
  addStreetFurniture(g);overlay=g;model.add(g);return;
 }
 if(($('#roadside-trees') as HTMLInputElement).checked){
  const outer=current==='network'?2*laneWidth+sidewalkWidth-.75:3*laneWidth+1.5+sidewalkWidth-.75;
  const xs=current==='network'?[-43,-29,29,43]:[-14,14];
  for(const x of xs)for(const sign of [-1,1])addTree(g,x,offset+sign*outer);
 }
 if(($('#road-lights') as HTMLInputElement).checked){
  const outer=current==='network'?2*laneWidth+.65:3*laneWidth+1.5+.65;
  const xs=current==='network'?[-49,-19,19,49]:[-18,0,18];
  const height=Number(($('#light-height') as HTMLInputElement).value),size=Number(($('#light-size') as HTMLInputElement).value);
  for(const x of xs)for(const sign of [-1,1])addStreetLight(g,x,offset+sign*outer,-sign,height,size);
 }
 const median=($('#median-style') as HTMLSelectElement).value;
 if(median!=='none'){
  const intervals=current==='network'?[[-50,-19],[19,50]]:[[-21,21]];
  for(const [a,b] of intervals){const len=b-a,mid=(a+b)/2;addBox(g,propsMaterials.curb,mid,.12,offset,len,.24,1.0);
   if(median==='barrier'){
    addBox(g,propsMaterials.rail,mid,.74,offset,len,.10,.12);
    for(let x=a+.7;x<b;x+=2.4)addBox(g,propsMaterials.rail,x,.48,offset,.12,.64,.12);
   }else{
    addBox(g,propsMaterials.soil,mid,.30,offset,len-.2,.12,.75);
    for(let x=a+.6;x<b-.3;x+=1.2){addBox(g,propsMaterials.leaf,x,.52,offset,.75,.35,.65);if(Math.round((x-a)/1.2)%3===0)addBox(g,propsMaterials.flower,x,.72,offset,.16,.12,.16)}
   }
  }
 }
 overlay=g;model.add(g);
}
function setJunctionVisibility(){if(!model)return;const enabled=($('#junction-markings') as HTMLInputElement).checked;model.traverse(o=>{if(o.name.toLowerCase().includes('junction_markings'))o.visible=enabled})}
function vehiclePosition(){return {x:['network','complex'].includes(current)?-30:0,z:roadOffset(),y:.09}}
function mergeFits(){return carScale/modelScale<=1.0001&&taxiWidth*carScale/modelScale<=laneWidth}
function refreshVehicleScale(){
 const carWidth=taxiWidth*carScale/modelScale;
 $('#vehicle-info').textContent=current==='city'&&carScale/modelScale>1.0001?'出租车尺寸超出演示轨迹范围，已暂停汇入演示；请缩小出租车或放大道路模型。':current==='city'&&!mergeFits()?'车道比出租车窄，已暂停汇入演示；请缩小出租车或增宽车道。':Math.max(carWidth,...vehicleWidths.slice(1).map(w=>w/modelScale))>laneWidth?'当前车道较窄，部分车辆超出车道宽度。':'出租车使用原始体素风模型，其余车辆由写实模型转换为细体素外壳。';
 if(!vehicle)return;const base=vehiclePosition();
 for(const o of vehicle.children){if(current==='city'&&!mergeFits()&&(o.userData.vehicleIndex===0||o.userData.labelIndex===0))o.visible=true;if(o.userData.vehicleIndex!==undefined){const i=o.userData.vehicleIndex;o.scale.setScalar((i===0?carScale:1)/modelScale)}if(o.userData.labelIndex!==undefined){const i=o.userData.labelIndex;o.position.y=(o.userData.roadY??base.y)+(vehicleSpecs[i].height*(i===0?carScale:1)+.75)/modelScale;o.scale.set(3.3/modelScale,.83/modelScale,1)}}
}
function addVehiclePixelGrain(root:THREE.Object3D){root.traverse(obj=>{const mesh=obj as THREE.Mesh;if(!mesh.isMesh)return;const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];const mapped=mats.map(mat=>{if(mat.transparent||/glass|window|light|lamp|chrome/i.test(mat.name))return mat;const m=mat.clone();m.onBeforeCompile=(shader:any)=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vVehiclePixel;').replace('#include <begin_vertex>','#include <begin_vertex>\nvVehiclePixel = position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vVehiclePixel;').replace('#include <color_fragment>','#include <color_fragment>\nvec3 px=floor(vVehiclePixel*7.0); float noise=fract(sin(dot(px,vec3(12.9898,78.233,37.719)))*43758.5453); diffuseColor.rgb *= mix(0.94,1.025,noise);')};return m});mesh.material=Array.isArray(mesh.material)?mapped:mapped[0]})}
function vehicleLabel(label:string){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='rgba(19,51,50,.88)';ctx.beginPath();ctx.roundRect(2,2,252,60,14);ctx.fill();ctx.fillStyle='#e6fff4';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,128,32);const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(3.3,.83,1);sprite.renderOrder=5;return sprite;
}
async function updateVehicle(jump=false){
 const ticket=++vehicleTicket;if(vehicle&&model)model.remove(vehicle);vehicle=null;
 const visible=($('#vehicles-visible') as HTMLInputElement).checked&&!['cobblestone','dirt'].includes(current);$('#goto-vehicle').hidden=!visible;
 refreshVehicleScale();
 if(!model||!visible)return;const targetModel=model;
 try{
  const gltfs=await Promise.all(vehicleSpecs.map(v=>loader.loadAsync(`./assets/vehicles/${v.id}.glb?v=movable-parts-2`)));if(ticket!==vehicleTicket||model!==targetModel)return;
  // Imported vehicles face +Z. Uniform scaling preserves each vehicle's
  // proportions and matches the previous preview's displayed lengths.
  gltfs.forEach((gltf,i)=>{const asset=gltf.scene;asset.rotation.y=Math.PI/2;asset.updateMatrixWorld(true);let bounds=new THREE.Box3().setFromObject(asset);const original=new THREE.Vector3();bounds.getSize(original);if(!original.x)throw new Error('Invalid vehicle geometry');asset.scale.setScalar(vehicleSpecs[i].length/original.x);asset.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(asset);const center=new THREE.Vector3(),size=new THREE.Vector3();bounds.getCenter(center);bounds.getSize(size);asset.position.set(-center.x,-bounds.min.y,-center.z);vehicleSpecs[i].height=size.y;vehicleWidths[i]=size.z;if(i===0)taxiWidth=size.z;else addVehiclePixelGrain(asset)});
  const group=new THREE.Group();group.name='Vehicle_comparison';group.userData.noGround=true;const p=vehiclePosition();
  gltfs.forEach((gltf,i)=>{let x=current==='city'?[-29,-12,0,12][i]:p.x+[2,10,0,-10][i],z=current==='city'?[2.5*laneWidth+1.3,-1.5*laneWidth,-.5*laneWidth,.5*laneWidth][i]:p.z+[1.5,-.5,.5,-1.5][i]*(current==='complex'?8.775:laneWidth),y=p.y,heading=0,pitch=0;
   if(current==='parametric'){const c=paramConfig(),at=[-58,-20,20,58][i],offset=i===0&&c.parkingWidth>=taxiWidth*carScale/modelScale?c.medianWidth/2+c.lanesEachDirection*c.laneWidth+c.bikeWidth+c.parkingWidth*.5:c.medianWidth/2+c.laneWidth*.5,point=roadPoint(c,at,offset),before=roadPoint(c,at-.1,offset),after=roadPoint(c,at+.1,offset);x=point.x;z=point.z;y=point.y+.09;heading=point.heading;pitch=Math.atan2(after.y-before.y,Math.hypot(after.x-before.x,after.z-before.z))}
   const v=new THREE.Group();v.userData.vehicleIndex=i;v.add(gltf.scene);v.position.set(x,y,z);v.scale.setScalar((i===0?carScale:1)/modelScale);if(current==='parametric'){v.rotation.order='YXZ';v.rotation.y=heading;v.rotation.z=pitch}else if(current==='city'?(i===1||i===2):(i===1||i===3))v.rotation.y=Math.PI;group.add(v);const label=vehicleLabel(vehicleSpecs[i].label);label.userData.labelIndex=i;label.userData.roadY=y;label.position.set(x,y+(vehicleSpecs[i].height*(i===0?carScale:1)+.75)/modelScale,z);label.scale.multiplyScalar(1/modelScale);group.add(label)});
  targetModel.add(group);vehicle=group;refreshVehicleScale();
  if(jump&&current==='parametric'){const c=paramConfig(),point=roadPoint(c,0,c.medianWidth/2+c.laneWidth*1.5);positionHero(point.x,point.y,point.z,false);controls.target.set(point.x*modelScale,(point.y+1)*modelScale,point.z*modelScale);camera.position.copy(controls.target).add(new THREE.Vector3(55,65,70).multiplyScalar(modelScale));controls.update()}
  else if(jump){positionHero(p.x+2,0,p.z+2*laneWidth+.9,false);const center=new THREE.Vector3((p.x+2)*modelScale,1.8*modelScale,p.z*modelScale);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(51,42,56).multiplyScalar(modelScale));controls.update()}
 }catch(error){$('#vehicle-info').textContent='车辆模型加载失败。';console.error(error)}
}

applyPixelSurface(field);
async function selectScene(key:string){
 current=key;const ticket=++loadSerial,spec=models[key], width=laneWidth, sidewalk=sidewalkWidth, suffix=`w${Math.round(width*10)}-s${Math.round(sidewalk*10)}`;
 (scene.fog as THREE.Fog).near=key==='complex'?400:140;(scene.fog as THREE.Fog).far=key==='complex'?900:350;
 document.querySelectorAll('.scene').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.scene===key));
 $('#scene-title').textContent=spec.name;$('#scene-subtitle').textContent=key==='tower'?'楼前铺装之外已加上独立道路；可调整车道宽度。':spec.subtitle;
 $('#model-label').textContent=['network','city','tower'].includes(key)?`每条车道 ${width.toFixed(3)} 单位 · 模型缩放 ${modelScale.toFixed(2)}×`:spec.label;
 $('#loading').classList.remove('hidden');$('#error').hidden=true;
 try{
  if(key==='architecture'){
   const root=buildArchitectureShowcase();if(model)scene.remove(model);field.visible=true;activeComplexConfig=null;activeRoadGraph=null;vehicle=null;overlay=null;cityPaths=null;sidewalkMaterials=[];model=root;root.scale.setScalar(modelScale);scene.add(root);root.updateMatrixWorld(true);setButtons(spec);positionHero(...spec.origin);firstSceneLoad=false;$('#loading').classList.add('hidden');return;
  }
  if(key==='parametric'){
   activeRoadGraph=null;const c=paramConfig(),root=new THREE.Group();parametricRoot=buildParametricRoad(c);root.add(parametricRoot);
   if(model)scene.remove(model);field.visible=true;activeComplexConfig=null;vehicle=null;overlay=null;cityPaths=null;sidewalkMaterials=[];model=root;applyPixelSurface(root);root.scale.setScalar(modelScale);scene.add(root);root.updateMatrixWorld(true);updateRoadside();firstSceneLoad=false;void updateVehicle(false);
   const laneOffset=c.medianWidth/2+c.laneWidth*.5,points=[-55,0,55].map((x,i)=>{const p=roadPoint(c,x,laneOffset);return [['起点','道路中段','终点'][i],p.x,p.y,p.z]});setButtons({...spec,points});
   const center=roadPoint(c,0,laneOffset);positionHero(center.x,center.y,center.z,false);controls.target.set(center.x*modelScale,(center.y+1)*modelScale,center.z*modelScale);camera.position.copy(controls.target).add(new THREE.Vector3(55,70,70).multiplyScalar(modelScale));controls.update();
   $('#model-label').textContent=`双向 ${2*c.lanesEachDirection} 车道 · 每条 ${c.laneWidth.toFixed(3)} 单位`;$('#loading').classList.add('hidden');return;
  }
  parametricRoot=null;
  const file=(key==='network'||key==='city')?`${key}-${suffix}.glb`:spec.file;
  const gltf=await loader.loadAsync('./assets/'+file+(['cobblestone','dirt'].includes(key)?'?v=rural-4':key==='network'?'?v=merge-curve-2':key==='complex'?'?v=complex-7':''));
  if(key==='city')gltf.scene.traverse(o=>{if(o.name.toLowerCase().includes('street_lights'))o.visible=false});
  let graph:any=null;let newCityPaths:any=null;
  if(key==='city'){const response=await fetch(`./assets/city-${suffix}-paths.json`);if(!response.ok)throw new Error('Failed to load merge paths');newCityPaths=await response.json()}
  if(key==='network'||key==='complex'){
   const graphFile=key==='complex'?'complex-lane-graph.json?v=complex-7':`network-${suffix}-lane-graph.json?v=merge-curve-2`;const response=await fetch(`./assets/${graphFile}`);if(!response.ok)throw new Error('Failed to load crossing metadata');graph=await response.json();
   gltf.scene.traverse(o=>{if(o.name.toLowerCase().includes('crosswalk'))o.visible=false});
   if(key==='complex')gltf.scene.traverse(o=>{if(o.name==='Lane_edges')o.visible=false});
  }
  let complexConfig:any=null;
  if(key==='complex'){const response=await fetch('./assets/complex-config.json?v=complex-7');if(!response.ok)throw new Error('Failed to load complex layout');complexConfig=await response.json()}
  if(key==='tower')gltf.scene.traverse(obj=>{const m=obj as THREE.Mesh;if(m.isMesh && (m.name.startsWith('Site')||m.parent?.name==='Site')){const mats=Array.isArray(m.material)?m.material:[m.material];if(mats.some(mat=>mat.name==='Opaque light'))m.visible=false;}});
  const root=new THREE.Group();root.add(gltf.scene);
  if(complexConfig)root.add(buildComplexEnvironment(complexConfig));
  if(key==='tower'){
   // The original raised plaza markers replace ground faces in the source mesh.
   // Fill their footprint after hiding them so there are no holes in the paving.
   const paving=new THREE.Mesh(new THREE.BoxGeometry(48,.025,.4),new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(58/255,74/255,85/255),roughness:.9,metalness:0}));
   paving.name='paving_joints_patch';paving.position.set(-.8,1.208,17.4);root.add(paving);
  }
  if(key==='tower'){
   const road=await loader.loadAsync(`./assets/city-${suffix}.glb`);
   road.scene.traverse(o=>{if(o.name.toLowerCase().includes('street_lights'))o.visible=false});
   road.scene.position.z=19.2+(3*width+sidewalk+1.5);root.add(road.scene);
  }
  if(ticket!==loadSerial)return;activeRoadGraph=graph;activeComplexConfig=complexConfig;field.visible=key!=='complex';
  if(model)scene.remove(model);vehicle=null;overlay=null;cityPaths=newCityPaths;mergeStart=performance.now();sidewalkMaterials=[];model=root;applyPixelSurface(model);if(graph)model.add(createCrosswalks(graph));model.scale.setScalar(modelScale);scene.add(model);model.updateMatrixWorld(true);setJunctionVisibility();updateRoadside();const showInitialVehicle=firstSceneLoad;firstSceneLoad=false;void updateVehicle(showInitialVehicle);
  let p=spec.origin,points=spec.points;
  if(key==='city'){
   const side=3*width+1.5+sidewalk/2,front=2.5*width+1.3;
   p=[3,0,side];points=[['人行道',3,0,side],['主路',0,0,2],['辅路',0,0,front],['汇入口',0,0,front]];
  }
  if(key==='network')points=[['十字路口',0,0,-5],['主辅路',-68,0,(4.5*width+2*sidewalk+2)/2],['匝道入口',20,0,-65],['高架桥面',52,6,-65]];
  if(key==='complex')points=[['全网总览',0,0,0],['中心路口',0,0,-5],['西侧路口',-150,0,-5],['东侧路口',150,0,-5],['汇入口',-68,0,26.6],['西侧弯道',-93,0,63],['东侧弯道',93,0,63],['高架桥面',52,6,-65],['玻璃站台',-200,0,-21],['金属站台',-60,0,-21],['木质站台',65,0,-21],['路边车位',-200,0,22],['道路隧道',0,-6,170],['地下通道',-115,-4,0],['地下车库',60,-4,85.025]];
  if(key==='tower')points=[['楼门附近',3,0,21],['楼前道路',0,0,19.2+3*width+sidewalk+1.5],['一层侧面',22,0,0]];
  setButtons({...spec,points});positionHero(...p);$('#loading').classList.add('hidden');
 }catch(error){if(ticket!==loadSerial)return;$('#loading').classList.add('hidden');$('#error').hidden=false;$('#error').textContent='模型加载失败，请刷新页面。';console.error(error)}
}
function resize(){const w=holder.clientWidth,h=holder.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
new ResizeObserver(resize).observe(holder);resize();
document.querySelectorAll('.scene').forEach(btn=>btn.addEventListener('click',()=>selectScene((btn as HTMLElement).dataset.scene!)));
($('#sidewalk-width') as HTMLInputElement).addEventListener('input',event=>{const v=Number((event.target as HTMLInputElement).value);$('#sidewalk-width-value').textContent=v.toFixed(2)+' 单位'});
($('#sidewalk-width') as HTMLInputElement).addEventListener('change',event=>{sidewalkWidth=Number((event.target as HTMLInputElement).value);if(['network','city','tower','parametric'].includes(current))selectScene(current)});
($('#lane-width') as HTMLInputElement).addEventListener('input',event=>{const v=Number((event.target as HTMLInputElement).value);$('#lane-width-value').textContent=v.toFixed(3)+' 单位'});
($('#lane-width') as HTMLInputElement).addEventListener('change',event=>{laneWidth=Number((event.target as HTMLInputElement).value);if(['network','city','tower','parametric'].includes(current))selectScene(current)});
for(const id of ['road-shape','road-lanes','tactile-enabled','manhole-style'])$('#'+id).addEventListener('change',()=>{if(current==='parametric')void selectScene('parametric');else if(current==='complex'&&['tactile-enabled','manhole-style'].includes(id))updateRoadside()});
for(const id of ['median-width','bike-width','parking-width','parking-length','tactile-width','curb-width','edge-setback','drain-spacing','manhole-spacing']){const el=$('#'+id) as HTMLInputElement;el.addEventListener('input',()=>{$('#'+id+'-value').textContent=Number(el.value).toFixed(1);if(id==='bike-width'||id==='parking-width')syncEdgeSetback()});el.addEventListener('change',()=>{if(current==='parametric')void selectScene('parametric');else if(current==='complex'&&['tactile-width','curb-width','edge-setback','drain-spacing','manhole-spacing'].includes(id))updateRoadside()})}
($('#scale') as HTMLInputElement).addEventListener('input',event=>{modelScale=Number((event.target as HTMLInputElement).value);$('#scale-value').textContent=modelScale.toFixed(2)+'×';if(model){model.scale.setScalar(modelScale);refreshVehicleScale();model.updateMatrixWorld(true);if(['network','city','tower'].includes(current))$('#model-label').textContent=`每条车道 ${laneWidth.toFixed(3)} 单位 · 模型缩放 ${modelScale.toFixed(2)}×`;positionHero(...models[current].origin)}});
($('#car-scale') as HTMLInputElement).addEventListener('input',event=>{carScale=Number((event.target as HTMLInputElement).value);$('#car-scale-value').textContent=carScale.toFixed(2)+'×';refreshVehicleScale()});
function bindRange(id:string,uniform:{value:number},format:(v:number)=>string,scale=1){
 const el=$('#'+id) as HTMLInputElement;el.addEventListener('input',()=>{uniform.value=Number(el.value)*scale;$('#'+id+'-value').textContent=format(uniform.value)});
}
bindRange('stripe-width',stripeWidth,v=>v.toFixed(2));
bindRange('stripe-gap',stripeGap,v=>v.toFixed(2));
bindRange('cross-depth',crossDepth,v=>v.toFixed(2));
bindRange('cross-wear',crossWear,v=>Math.round(v*100)+'%',.01);
bindRange('line-wear',lineWear,v=>Math.round(v*100)+'%',.01);
($('#pavement-color') as HTMLInputElement).addEventListener('input',event=>{const value=(event.target as HTMLInputElement).value;for(const mat of sidewalkMaterials)(mat as THREE.MeshStandardMaterial).color.set(value)});
($('#pavement-style') as HTMLSelectElement).addEventListener('change',event=>{pavingStyle.value=Number((event.target as HTMLSelectElement).value)});
$('#junction-markings').addEventListener('change',setJunctionVisibility);
$('#roadside-trees').addEventListener('change',updateRoadside);
$('#road-lights').addEventListener('change',updateRoadside);
for(const id of ['light-height','light-size'])($('#'+id) as HTMLInputElement).addEventListener('input',event=>{const v=Number((event.target as HTMLInputElement).value);$('#'+id+'-value').textContent=id==='light-height'?v.toFixed(1):v.toFixed(2)+'×';updateRoadside()});
$('#median-style').addEventListener('change',updateRoadside);
for(const id of ['stop-style','street-furniture','complex-greenery'])$('#'+id).addEventListener('change',updateRoadside);
$('#vehicles-visible').addEventListener('change',()=>{void updateVehicle(false)});
$('#door-open').addEventListener('input',()=>{$('#door-open-value').textContent=`${($('#door-open') as HTMLInputElement).value}%`});
$('#merge-demo').addEventListener('change',()=>{mergeStart=performance.now();if(vehicle)vehicle.children.forEach(o=>{if(o.userData.vehicleIndex===0||o.userData.labelIndex===0)o.visible=true})});
$('#goto-vehicle').addEventListener('click',()=>{void updateVehicle(true)});
function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function downloadParamConfig(){const config=paramConfig(),data={format:'parametric-road-v1',config,laneGraph:lanePaths(config),notes:'Reserved_median, tactile paving, drains and manholes are separate named objects; dimensions are game units.'};downloadBlob(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),'parametric-road-config.json')}
$('#export-param-config').addEventListener('click',downloadParamConfig);
$('#export-param-road').addEventListener('click',()=>{const road=buildParametricRoad(paramConfig());new GLTFExporter().parse(road,result=>{downloadBlob(new Blob([result as ArrayBuffer],{type:'model/gltf-binary'}),'parametric-road.glb')},error=>{console.error(error);window.alert('道路导出失败。')},{binary:true})});
$('#export-complex-road').addEventListener('click',async()=>{if(current!=='complex')await selectScene('complex');if(!model)return;const clone=model.clone(true);clone.scale.setScalar(1);for(const name of ['Vehicle_comparison','Configurable_crosswalks']){const child=clone.getObjectByName(name);if(child?.parent)child.parent.remove(child)}if(activeRoadGraph)clone.add(exportCrosswalks(activeRoadGraph));new GLTFExporter().parse(clone,result=>downloadBlob(new Blob([result as ArrayBuffer],{type:'model/gltf-binary'}),'complex-road-with-facilities.glb'),error=>{console.error(error);window.alert('综合路网导出失败。')},{binary:true})});
$('#download-config').addEventListener('click',async()=>{
 if(current==='parametric'){downloadParamConfig();return}
 try{const suffix=`w${Math.round(laneWidth*10)}-s${Math.round(sidewalkWidth*10)}`;const response=await fetch(current==='complex'?'./assets/complex-config.json':`./assets/network-${suffix}-config.json?v=merge-curve-2`);if(!response.ok)throw new Error('configuration unavailable');
  const data=await response.json();data.crosswalk_stripe_width_m=stripeWidth.value;data.crosswalk_stripe_gap_m=stripeGap.value;data.crosswalk_width_m=crossDepth.value;data.crosswalk_wear=crossWear.value;data.road_marking_wear=lineWear.value;data.sidewalk_color=($('#pavement-color') as HTMLInputElement).value;data.sidewalk_style=['mosaic','concrete','brick'][pavingStyle.value];data.roadside_trees=($('#roadside-trees') as HTMLInputElement).checked;data.road_lights=($('#road-lights') as HTMLInputElement).checked;data.streetlight_height=Number(($('#light-height') as HTMLInputElement).value);data.streetlight_size=Number(($('#light-size') as HTMLInputElement).value);data.median_style=($('#median-style') as HTMLSelectElement).value;data.junction_markings=($('#junction-markings') as HTMLInputElement).checked;
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='road-network-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){console.error(error);window.alert('配置下载失败，请刷新后重试。')}
});

$('#reset-view').addEventListener('click',()=>{const p=hero.position;controls.target.set(p.x,p.y+1.2,p.z);camera.position.set(p.x+12,p.y+12,p.z+17);controls.update();demo.reset()});
window.addEventListener('keydown',e=>{if(document.body.classList.contains('demo-handheld-open')){keys.clear();return}if(['w','a','s','d','z','c','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){if(e.target instanceof Element&&e.target.matches('input,select,textarea'))return;e.preventDefault();keys.add(e.key.toLowerCase())}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
window.addEventListener('keydown',e=>{if(!document.body.classList.contains('demo-handheld-open')&&e.code==='Space'&&!e.repeat&&!(e.target instanceof Element&&e.target.matches('input,select,textarea,button'))){e.preventDefault();jump()}});
document.querySelectorAll('[data-move]').forEach(el=>{const k=(el as HTMLElement).dataset.move!;el.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(k);(el as HTMLElement).setPointerCapture((e as PointerEvent).pointerId)});for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,()=>keys.delete(k))});
function animate(now:number){requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.05);previous=now;
 if(vehicle){const amount=Number(($('#door-open') as HTMLInputElement).value)/100,spin=($('#wheel-spin') as HTMLInputElement).checked;vehicle.traverse(o=>{const data=o.userData;if(data.motion==='rotate'&&spin)o.rotation.x+=dt*1.7;if(data.motion==='hinge')o.rotation.y=data.open_angle_radians*amount;if(data.motion==='slide'){if(data.closedY===undefined)data.closedY=o.position.y;o.position.y=data.closedY+data.open_distance_source_units*amount}})}
 if(current==='city'&&cityPaths&&vehicle&&mergeFits()&&($('#merge-demo') as HTMLInputElement).checked){
  const phase=(now-mergeStart)/1000, path=(Math.floor(phase/12)%2===0?cityPaths.merge_frontage_to_main:cityPaths.exit_main_to_frontage) as number[][];
  if(path?.length>1){const cycle=(phase%12)/12,t=cycle*(path.length-1),i=Math.min(Math.floor(t),path.length-2),f=t-i,a=path[i],b=path[i+1];const x=THREE.MathUtils.lerp(a[0],b[0],f),z=THREE.MathUtils.lerp(a[2],b[2],f);for(const o of vehicle.children){if(o.userData.vehicleIndex===0){o.visible=cycle>.025&&cycle<.975;o.position.set(x,.09,z);o.rotation.y=-Math.atan2(b[2]-a[2],b[0]-a[0])}if(o.userData.labelIndex===0){o.visible=cycle>.025&&cycle<.975;o.position.x=x;o.position.z=z}}}
 }
 const fw=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
 if(demo.isEnabled()){if(keys.has('z'))demo.rotate(-dt*1.9);if(keys.has('c'))demo.rotate(dt*1.9)}
 let direction={x:0,z:0};
 if((fw||side)&&model){const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();const r=new THREE.Vector3(-f.z,0,f.x);const gameMove=demo.movement(side,fw);const move=(demo.isEnabled()?new THREE.Vector3(gameMove.x,0,gameMove.z):f.multiplyScalar(fw).add(r.multiplyScalar(side))).normalize().multiplyScalar(7.6*dt);direction={x:move.x/(7.6*dt||1),z:move.z/(7.6*dt||1)};const baseY=hero.position.y-jumpOffset;let x=hero.position.x+move.x,z=hero.position.z+move.z,y=surface(x,z,baseY);if(baseY>1.2 && y<baseY-1){x=hero.position.x;z=hero.position.z;y=baseY-.02;move.set(0,0,0);direction={x:0,z:0}}const dy=y+.02-baseY;hero.position.set(x,y+.02+jumpOffset,z);if(!demo.isEnabled()){controls.target.add(new THREE.Vector3(move.x,dy,move.z));camera.position.add(new THREE.Vector3(move.x,dy,move.z))}walkClock+=dt;walked=true;
 const d=Math.abs(fw)>Math.abs(side)?(fw>0?'up':'down'):(side>0?'right':'left');heroMat.map=frames[`${d}_${Math.floor(walkClock*6)%2}`]??frames.down_0;
 }else if(walked){heroMat.map=frames.down_idle0??frames.down_0;walked=false}
 const jumpStep=advanceGroundJump(jumpOffset,jumpVelocity,dt);hero.position.y+=jumpStep.height-jumpOffset;jumpOffset=jumpStep.height;jumpVelocity=jumpStep.velocity;
 demo.tick(dt,model,current,direction);hero.rotation.y=Math.atan2(camera.position.x-hero.position.x,camera.position.z-hero.position.z);shadow.position.set(hero.position.x,hero.position.y-jumpOffset-.01,hero.position.z);marker.position.set(hero.position.x,hero.position.y-jumpOffset+.005,hero.position.z);if(!demo.isEnabled())controls.update();renderer.render(scene,camera);
}
selectScene('network');requestAnimationFrame(animate);
