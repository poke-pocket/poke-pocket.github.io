import * as THREE from 'three';
import { makePixelTex } from './townGroundTextures';
import { mountVoxModel } from './voxLoader3D';
import type { TownJunctionNode, TownStreetSeg } from '../utils/townStreetGen';
import { getDetailedTactileMaterial, type ManholeStyle } from './roadKitDetails3D';
import { roadSurfaceY } from './roadKitSurface';
import { ROAD_EDGE_LINE_INSET } from './roadKitDimensions';

// Palette and fine, deterministic pixel grain are shared with the local road kit.
const asphalt = '#718891', paving = '#aebdb6', curb = '#879d99';
const white = '#e9e8dc', yellow = '#e6d193';
const textures = new Map<string, THREE.CanvasTexture>();
export type RoadLaneCount=2|4|6|8;
export function roadLaneCount(seg:Pick<TownStreetSeg,'laneCount'|'kind'>):RoadLaneCount{return seg.laneCount??(seg.kind==='arterial'?4:2)}
/** Shared model settings; changing drain spacing takes effect on town rebuild. */
export const roadKitStyle={lineWear:{value:.10},crosswalkWear:{value:.14},drainSpacing:35,manholeSpacing:65,manholeStyle:'auto' as 'auto'|ManholeStyle};

// The original road preview uses world-space, fine pixel paving. Reusing the
// same coordinates on every segment prevents texture resets at joins.
function applyWorldPixels(material:THREE.Material,kind:'paving'|'asphalt') {
 material.onBeforeCompile=(shader)=>{
  if(kind==='asphalt')shader.uniforms.uRoadKitLineWear=roadKitStyle.lineWear;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 roadKitWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nroadKitWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 roadKitWorld;
   ${kind==='asphalt'?'uniform float uRoadKitLineWear;':''}
   float roadKitHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`);
  const detail=kind==='paving'?`
   vec2 pavementPos=roadKitWorld.xz;
   vec2 tiles=floor(pavementPos / 0.32);
   float grain=roadKitHash(floor(pavementPos / 0.04));
   float tileTone=roadKitHash(tiles);
   float mottling=roadKitHash(floor(pavementPos / 1.28));
   vec2 seam=mod(pavementPos,0.32);
   float joint=1.0-step(0.012,min(seam.x,seam.y));
   float bevel=(1.0-step(0.026,min(seam.x,seam.y)))-joint;
   float worn=step(0.982,grain)*step(0.65,tileTone);
   diffuseColor.rgb *= (0.94 + tileTone*0.075 + grain*0.025 + mottling*0.015 - worn*.045) * (1.0-joint*0.23+bevel*.035);`:`
   float grain=roadKitHash(floor(roadKitWorld.xz/0.16));
   float mottling=roadKitHash(floor(roadKitWorld.xz/0.64));
   float fleck=step(0.975,grain)*0.055-step(grain,0.025)*0.05;
   float isPaint=step(0.42,max(diffuseColor.r,diffuseColor.g));
   float chips=step(grain,uRoadKitLineWear*0.45)*isPaint;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.165,0.246,0.282),chips*0.82);
   diffuseColor.rgb *= 0.92 + mottling*0.055 + grain*0.035 + fleck;`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
 };
 material.customProgramCacheKey=()=>`road-kit-${kind}-world-v2`;
}
let pavingMaterial:THREE.MeshLambertMaterial|undefined;
export function getRoadKitPavingMaterial(){
 if(!pavingMaterial){pavingMaterial=new THREE.MeshLambertMaterial({color:'#bdc9c2',side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});applyWorldPixels(pavingMaterial,'paving')}
 return pavingMaterial;
}
export function applyRoadKitAsphalt(material:THREE.Material){applyWorldPixels(material,'asphalt')}
export function applyRoadKitPaintWear(material:THREE.Material,wear=roadKitStyle.crosswalkWear){
 material.onBeforeCompile=(shader)=>{
  shader.uniforms.uRoadKitCrosswalkWear=wear;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 roadPaintWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nroadPaintWorld=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 roadPaintWorld;uniform float uRoadKitCrosswalkWear;
    float roadPaintHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`).replace('#include <color_fragment>',`#include <color_fragment>
    float grain=roadPaintHash(floor(roadPaintWorld.xz/0.11));
    float patina=roadPaintHash(floor(roadPaintWorld.xz/0.44));
    if(grain<uRoadKitCrosswalkWear*0.18)discard;
    diffuseColor.rgb*=0.94+grain*0.025+patina*0.025-step(0.90,patina)*0.045;`);
 };material.customProgramCacheKey=()=>`road-kit-paint-wear-v1`;
}
export function getRoadKitTactileMaterial(){
 return getDetailedTactileMaterial();
}

/** The caller selects the existing road class; this never changes its geometry. */
export function getRoadKitTexture(lanes: RoadLaneCount, roadWidth?:number): THREE.CanvasTexture {
  const edgePixel=roadWidth?Math.max(20,Math.min(27,Math.round(20+ROAD_EDGE_LINE_INSET/roadWidth*128))):24;
  const key=`${lanes}:${edgePixel}`;
  const cached = textures.get(key); if (cached) return cached;
  const texture = makePixelTex(256, 128, (ctx) => {
    ctx.fillStyle = paving; ctx.fillRect(0, 0,256,128);
    ctx.fillStyle = '#9facaa';
    for (let x=0;x<256;x+=12) { ctx.fillRect(x,0,1,19); ctx.fillRect(x,109,1,19); }
    for (let y=0;y<19;y+=7) { ctx.fillRect(0,y,256,1); ctx.fillRect(0,109+y,256,1); }
    ctx.fillStyle = '#c8b878';ctx.fillRect(0,8,256,2);ctx.fillRect(0,118,256,2);
    ctx.fillStyle = curb;ctx.fillRect(0,17,256,3);ctx.fillRect(0,108,256,3);
    ctx.fillStyle = asphalt;ctx.fillRect(0,20,256,88);
    // World-space grain is applied by the material so it does not restart at seams.
    // Leave a gutter between edge line and curb for the physical drain grates.
    ctx.fillStyle=white;ctx.fillRect(0,edgePixel,256,1);ctx.fillRect(0,127-edgePixel,256,1);
    ctx.fillStyle=yellow;ctx.fillRect(0,63,256,2);
    ctx.fillStyle=white;
    for(let lane=1;lane<lanes;lane++)if(lane!==lanes/2){const y=Math.round(20+88*lane/lanes);for(let x=0;x<256;x+=72)ctx.fillRect(x,y,38,1)}
    // Drains are physical, separately generated objects, not repeating texture.
  });
  textures.set(key,texture);return texture;
}

type Arm={ux:number;uz:number;width:number;length:number;kind:TownStreetSeg['kind'];laneCount:RoadLaneCount};
type Vec={x:number;z:number};
export type RoadKitCut={x:number;z:number;radius:number;step:number};
export type RoadKitJunctionPlan={node:TownJunctionNode;nearby:TownStreetSeg[];arms:Arm[];radius:number;step:number};
export type RoadKitCrossing={plan:RoadKitJunctionPlan;arm:Arm;cx:number;cz:number;wide:number;corners:Vec[]};
function projection(x:number,z:number,s:TownStreetSeg){const dx=s.x2-s.x1,dz=s.z2-s.z1,l2=dx*dx+dz*dz;if(l2<.01)return null;const t=((x-s.x1)*dx+(z-s.z1)*dz)/l2,tc=THREE.MathUtils.clamp(t,0,1);return {t,distance:Math.hypot(x-s.x1-dx*tc,z-s.z1-dz*tc),length:Math.sqrt(l2)};}
function widthAt(s:TownStreetSeg,t:number){return THREE.MathUtils.lerp(s.widthStart??s.width,s.widthEnd??s.width,THREE.MathUtils.clamp(t,0,1))}

/** The original layout coalesces intersections up to 56 units apart. Derive
 * missing same-level intersections from the actual geometry for rendering;
 * never change the layout used for navigation or gameplay. */
export function findRoadKitJunctions(streets:TownStreetSeg[],junctions:TownJunctionNode[],centerX:number,centerZ:number):TownJunctionNode[]{
 const candidates=[...junctions],buckets=new Map<string,number[]>(),seen=new Set<string>(),cellSize=128;
 for(let i=0;i<streets.length;i++){const s=streets[i];if(s.isBridge||s.kind==='rail')continue;if(Math.min(Math.hypot(s.x1-centerX,s.z1-centerZ),Math.hypot(s.x2-centerX,s.z2-centerZ))>4300)continue;
  const x0=Math.floor(Math.min(s.x1,s.x2)/cellSize),x1=Math.floor(Math.max(s.x1,s.x2)/cellSize),z0=Math.floor(Math.min(s.z1,s.z2)/cellSize),z1=Math.floor(Math.max(s.z1,s.z2)/cellSize);
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x},${z}`,list=buckets.get(key)??[];list.push(i);buckets.set(key,list)}
 }
 for(const bucket of buckets.values())for(let i=0;i<bucket.length;i++)for(let j=0;j<i;j++){
  const ai=bucket[i],bi=bucket[j],key=ai<bi?`${ai},${bi}`:`${bi},${ai}`;if(seen.has(key))continue;seen.add(key);
  const a=streets[ai],b=streets[bi],dx=a.x2-a.x1,dz=a.z2-a.z1,ex=b.x2-b.x1,ez=b.z2-b.z1,den=dx*ez-dz*ex,len=Math.hypot(dx,dz)*Math.hypot(ex,ez);
  if(len<.01||Math.abs(den)/len<.4)continue;
  const t=((b.x1-a.x1)*ez-(b.z1-a.z1)*ex)/den,u=((b.x1-a.x1)*dz-(b.z1-a.z1)*dx)/den;if(t<0||t>1||u<0||u>1)continue;
  const x=a.x1+t*dx,z=a.z1+t*dz;if(Math.hypot(x-centerX,z-centerZ)>4200)continue;
  const w=Math.max(widthAt(a,t),widthAt(b,u)),minDist=Math.max(6,w*.55);
  if(candidates.some(c=>Math.hypot(c.x-x,c.z-z)<minDist))continue;
  candidates.push({x,z,width:w,depth:w,rotY:Math.atan2(dx,dz),kind:'cross'});
 }
 return candidates;
}

export function planRoadKitJunctions(opts:{streets:TownStreetSeg[];junctions:TownJunctionNode[];centerX:number;centerZ:number;water:number;ground:(x:number,z:number)=>number}):RoadKitJunctionPlan[]{
 const {streets,junctions,centerX,centerZ,water,ground}=opts,plans:RoadKitJunctionPlan[]=[];
 for(const j of findRoadKitJunctions(streets,junctions,centerX,centerZ)){if(Math.hypot(j.x-centerX,j.z-centerZ)>=4200||ground(j.x,j.z)<water+.2)continue;
  const local=streets.filter(s=>!s.isBridge&&s.kind!=='rail'&&Math.min(s.x1,s.x2)-s.width-45<=j.x&&j.x<=Math.max(s.x1,s.x2)+s.width+45&&Math.min(s.z1,s.z2)-s.width-45<=j.z&&j.z<=Math.max(s.z1,s.z2)+s.width+45);
  const incident=local.filter(s=>{const p=projection(j.x,j.z,s);return !!p&&p.distance<2.5});
  const arms:Arm[]=[];for(const s of incident){const p=projection(j.x,j.z,s);if(!p)continue;const ux=(s.x2-s.x1)/p.length,uz=(s.z2-s.z1)/p.length;for(const sign of [-1,1]){const length=sign<0?p.t*p.length:(1-p.t)*p.length;if(length<2)continue;const ax=sign*ux,az=sign*uz;if(!arms.some(a=>a.ux*ax+a.uz*az>.94))arms.push({ux:ax,uz:az,width:widthAt(s,p.t),length,kind:s.kind,laneCount:roadLaneCount(s)})}}
  if(arms.length<2||!arms.some((a,i)=>arms.some((b,k)=>k<i&&Math.abs(a.ux*b.ux+a.uz*b.uz)<.9)))continue;
  const maxW=Math.max(...arms.map(a=>a.width)),radius=Math.min(40,maxW*.74+4);
  // Include every same-level road touching the patch, including adjacent
  // segments of a curved road, so their sidewalks cannot leak over asphalt.
  const nearby=local.filter(s=>{const p=projection(j.x,j.z,s);return !!p&&p.distance<radius+Math.max(s.widthStart??s.width,s.widthEnd??s.width)*.5+3});
  for(const arm of arms)for(let d=arm.length+1;d<radius+18;d+=1){const x=j.x+arm.ux*d,z=j.z+arm.uz*d;if(!local.some(s=>{const p=projection(x,z,s);return !!p&&p.distance<widthAt(s,p.t)*.34}))break;arm.length=d}
  plans.push({node:j,nearby,arms,radius,step:.65});
 }
 return plans;
}

/** Cut each participating ribbon at exactly the same pixel cells used for the
 * union surface. This prevents the underlying sidewalks and markings from
 * protruding through the new crossing. */
export function applyRoadKitJunctionCuts(material:THREE.Material,cuts:RoadKitCut[]){
 if(!cuts.length)return;const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{previous.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 roadCutWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nroadCutWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
  const declarations=cuts.map((_,i)=>`uniform vec4 roadCut${i};`).join('\n');
  const tests=cuts.map((_,i)=>`{ vec2 cell=(floor(roadCutWorld.xz/roadCut${i}.w)+0.5)*roadCut${i}.w; if(distance(cell,roadCut${i}.xy)<=roadCut${i}.z) discard; }`).join('\n');
  cuts.forEach((c,i)=>{shader.uniforms[`roadCut${i}`]={value:new THREE.Vector4(c.x,c.z,c.radius,c.step)}});
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 roadCutWorld;\n${declarations}`).replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\n${tests}`);
 };
 material.customProgramCacheKey=()=>`${previousKey()}-cuts-${cuts.length}`;
}

function overlaps(a:Vec[],b:Vec[]):boolean{
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],nx=q.z-p.z,nz=p.x-q.x;
  const pa=a.map(v=>v.x*nx+v.z*nz),pb=b.map(v=>v.x*nx+v.z*nz);
  if(Math.max(...pa)<=Math.min(...pb)+1e-5||Math.max(...pb)<=Math.min(...pa)+1e-5)return false;
 }
 return true;
}

/** Plan all zebra crossings together so nearby and angled arms cannot paint
 * across another crossing. A short connector keeps the first valid crossing. */
export function planRoadKitCrossings(plans:RoadKitJunctionPlan[]):RoadKitCrossing[]{
 const result:RoadKitCrossing[]=[];
 for(const plan of plans){const {node:j,arms,radius}=plan;if(arms.length<3)continue;
  for(const arm of arms){const others=arms.filter(a=>Math.abs(a.ux*arm.ux+a.uz*arm.uz)<.8);if(!others.length)continue;
   const distance=Math.min(radius-2.2,Math.max(...others.map(a=>a.width*.365))+2);
   if(distance<2||arm.length<distance+3.4)continue;
   const cx=j.x+arm.ux*distance,cz=j.z+arm.uz*distance,nx=-arm.uz,nz=arm.ux,wide=arm.width*.67;
   const point=(along:number,across:number):Vec=>({x:cx+arm.ux*along+nx*across,z:cz+arm.uz*along+nz*across});
   const corners=[point(-1.35,-wide/2),point(-1.35,wide/2),point(1.35,wide/2),point(1.35,-wide/2)];
   if(result.some(existing=>overlaps(corners,existing.corners)))continue;
   result.push({plan,arm,cx,cz,wide,corners});
  }
 }
 return result;
}

/**
 * Build pixel-paved union surfaces from the game's actual junctions and streets.
 * Bridge segments are excluded so an overpass never becomes a ground crossing.
 * One shared mesh per surface keeps draw calls bounded as cities stream in/out.
 */
export function buildRoadKitJunctions(opts:{streets:TownStreetSeg[];junctions:TownJunctionNode[];centerX:number;centerZ:number;baseY:number;water:number;ground:(x:number,z:number)=>number;plans?:RoadKitJunctionPlan[];allPlans?:RoadKitJunctionPlan[];crossings?:RoadKitCrossing[];paintOnly?:boolean}):THREE.Group {
  const {streets,junctions,centerX,centerZ,baseY,water,ground}=opts;
  const root=new THREE.Group();root.name='RoadKit_city_junctions';
  const vertices:Record<'road'|'walk'|'paint'|'marking',number[]>={road:[],walk:[],paint:[],marking:[]};
  const indices:Record<'road'|'walk'|'paint'|'marking',number[]>={road:[],walk:[],paint:[],marking:[]};
  const addQuad=(kind:'road'|'walk'|'paint'|'marking', points:Vec[],lift:number)=>{const v=vertices[kind],idx=indices[kind],start=v.length/3;for(const p of points){const y=opts.paintOnly&&(kind==='paint'||kind==='marking')?roadSurfaceY(p.x,p.z,ground,water)+.02:Math.max(water+.25,ground(p.x,p.z)+lift);v.push(p.x-centerX,y-baseY,p.z-centerZ)}idx.push(start,start+2,start+1,start,start+3,start+2)};
  const normals=(a:Arm)=>({nx:-a.uz,nz:a.ux});
  const plans=opts.plans??planRoadKitJunctions({streets,junctions,centerX,centerZ,water,ground}),allPlans=opts.allPlans??plans,crossings=opts.crossings??planRoadKitCrossings(allPlans);
  for(const plan of plans){const {node:j,nearby,arms,radius,step}=plan,ownerIndex=allPlans.indexOf(plan),priorOwners=allPlans.slice(0,Math.max(0,ownerIndex)).filter(p=>Math.hypot(j.x-p.node.x,j.z-p.node.z)<radius+p.radius);
    const minX=Math.floor((j.x-radius)/step),maxX=Math.ceil((j.x+radius)/step),minZ=Math.floor((j.z-radius)/step),maxZ=Math.ceil((j.z+radius)/step);
    if(!opts.paintOnly)for(let ix=minX;ix<maxX;ix++)for(let iz=minZ;iz<maxZ;iz++){
      const x=(ix+.5)*step,z=(iz+.5)*step;if(Math.hypot(x-j.x,z-j.z)>radius)continue;
      // Overlapping junctions use the same world grid and one owner per cell.
      // A street on either side is included when deciding road vs footway.
      if(priorOwners.some(p=>Math.hypot(x-p.node.x,z-p.node.z)<=p.radius))continue;
      let inRoad=false,inWalk=false;for(const s of nearby){const p=projection(x,z,s);if(!p)continue;const width=widthAt(s,p.t);if(p.distance<width*.34375)inRoad=true;else if(p.distance<width*.5)inWalk=true;}
      // The game places characters at roughly terrain + 0.16 on urban ground.
      // Keep the junction underneath their feet rather than burying sprites.
      if(!inRoad&&!inWalk)continue;const h=step/2;addQuad(inRoad?'road':'walk',[{x:x-h,z:z-h},{x:x+h,z:z-h},{x:x+h,z:z+h},{x:x-h,z:z+h}],.14);
    }
    if(arms.length<3)continue;
    let signalCount=0;
    for(const selected of crossings.filter(c=>c.plan===plan)){const {arm,cx,cz,wide}=selected,crossing=Math.hypot(cx-j.x,cz-j.z),nearCrossings=crossings.filter(other=>other!==selected&&Math.hypot(other.cx-cx,other.cz-cz)<(wide+other.wide)*.5+12);
      const {nx,nz}=normals(arm),bar=.65,gap=.8;
      const point=(along:number,across:number):Vec=>({x:cx+arm.ux*along+nx*across,z:cz+arm.uz*along+nz*across});
      const isRoad=(p:Vec)=>nearby.some(s=>{const proj=projection(p.x,p.z,s);return !!proj&&proj.distance<widthAt(s,proj.t)*.34});
      // Clip each piece against the union of actual carriageways; oblique or
      // curved crossings must not paint over a neighbouring footway.
      const paint=(a:number,b:number,c:number,d:number,avoidOther=false)=>{const corners=[point(a,c),point(a,d),point(b,d),point(b,c)];if(corners.every(isRoad)&&(!avoidOther||!nearCrossings.some(other=>overlaps(corners,other.corners))))addQuad(avoidOther?'marking':'paint',corners,opts.paintOnly ? .165 : .24)};
      for(let x=-wide/2;x<wide/2-.1;x+=bar+gap){const b=Math.min(x+bar,wide/2);for(let along=-1.35;along<1.35-.01;along+=.3)paint(along,Math.min(1.35,along+.3),x,b)}
      // Stop line only covers the incoming half of this two-way approach.
      for(let across=-wide/2;across<-.18;across+=.35)paint(2.0,2.18,across,Math.min(across+.35,-.18),true);
      // Direction arrows follow the existing two- or four-lane road class.
      // They are generated only when there is enough approach length.
      if(arm.length>crossing+10){const lanes=arm.laneCount/2,laneW=wide/(2*lanes);
       const stroke=(a:number,x:number,b:number,y:number)=>{const dx=b-a,dy=y-x,len=Math.hypot(dx,dy);if(!len)return;const pa=-dy/len*.14,px=dx/len*.14,quad=[point(a+pa,x+px),point(a-pa,x-px),point(b-pa,y-px),point(b+pa,y+px)];if(quad.every(isRoad)&&!nearCrossings.some(other=>overlaps(quad,other.corners)))addQuad('marking',quad,opts.paintOnly ? .165 : .24)};
       for(let lane=0;lane<lanes;lane++){const mid=-wide/2+(lane+.5)*laneW,tip=3.5,tail=7.4;stroke(tip,mid,tail,mid);stroke(tip,mid,tip+.8,mid-.5);stroke(tip,mid,tip+.8,mid+.5);
        if(lane===0||lanes===1){stroke(5.8,mid,4.8,mid-1.1);stroke(4.8,mid-1.1,4.8,mid-1.7);stroke(4.8,mid-1.7,5.3,mid-1.2)}
        if(lane===lanes-1){stroke(5.8,mid,4.8,mid+1.1);stroke(4.8,mid+1.1,4.8,mid+1.7);stroke(4.8,mid+1.7,5.3,mid+1.2)}
       }
      }
      if(signalCount<2&&arm.width>=28){const sx=cx+nx*arm.width*.43,sz=cz+nz*arm.width*.43;void mountVoxModel(root,'/models/vox/obj_trlight2.vox',{x:sx-centerX,y:ground(sx,sz)-baseY+.14,z:sz-centerZ,rotY:Math.atan2(-nx,-nz),targetHeight:5.8,emitMode:'traffic'});signalCount++}
    }
  }
  for(const kind of ['road','walk','paint','marking'] as const){if(!vertices[kind].length)continue;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices[kind],3));geo.setIndex(indices[kind]);geo.computeVertexNormals();const mat=kind==='walk'?getRoadKitPavingMaterial():new THREE.MeshLambertMaterial({color:kind==='road'?asphalt:white,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:kind==='paint'||kind==='marking'?-8:-6,polygonOffsetUnits:-6});if(kind==='road')applyRoadKitAsphalt(mat);if(kind==='paint'||kind==='marking')applyRoadKitPaintWear(mat,kind==='paint'?roadKitStyle.crosswalkWear:roadKitStyle.lineWear);const mesh=new THREE.Mesh(geo,mat);mesh.name=`RoadKit_junction_${kind}`;mesh.receiveShadow=true;root.add(mesh)}
  return root;
}

/** Keep detailed junction meshes near the player instead of generating the
 * whole city at once. Road cuts are computed for the complete road graph. */
export function createRoadKitJunctionStreamer(opts:{streets:TownStreetSeg[];junctions:TownJunctionNode[];centerX:number;centerZ:number;baseY:number;water:number;ground:(x:number,z:number)=>number;plans:RoadKitJunctionPlan[];radius?:number;paintOnly?:boolean}){
 const group=new THREE.Group();group.name='RoadKit_streamed_junctions';const active=new Map<RoadKitJunctionPlan,THREE.Group>(),radius=opts.radius??420,crossings=planRoadKitCrossings(opts.plans);let lastX=Infinity,lastZ=Infinity;
 const release=(mesh:THREE.Group)=>{group.remove(mesh);mesh.traverse(o=>{if(o instanceof THREE.Mesh&&o.name.startsWith('RoadKit_junction_')){o.geometry.dispose();const m=o.material;if(m!==pavingMaterial){if(Array.isArray(m))m.forEach(v=>v.dispose());else m.dispose()}}})};
 const update=(x:number,z:number)=>{
  if(Math.hypot(x-lastX,z-lastZ)<64)return;lastX=x;lastZ=z;
  for(const [plan,mesh] of active)if(Math.hypot(plan.node.x-x,plan.node.z-z)>radius+180){release(mesh);active.delete(plan)}
  // Preload a full junction diameter beyond the visible radius, including
  // earlier owners of shared cells at the edge of the active region.
  for(const plan of opts.plans)if(!active.has(plan)&&Math.hypot(plan.node.x-x,plan.node.z-z)<=radius+100){const mesh=buildRoadKitJunctions({...opts,plans:[plan],allPlans:opts.plans,crossings});active.set(plan,mesh);group.add(mesh)}
 };
 const refreshTerrain=(baseY:number)=>{opts.baseY=baseY;for(const mesh of active.values())release(mesh);active.clear();lastX=Infinity;lastZ=Infinity};
 return {group,update,refreshTerrain};
}

// Shared parts keep draw calls and memory reasonable when the city is streamed.
let lampParts: { pole:THREE.BufferGeometry; arm:THREE.BufferGeometry; head:THREE.BufferGeometry; base:THREE.BufferGeometry; metal:THREE.Material; lens:THREE.Material } | undefined;
export function createRoadKitStreetlight(height = 8): THREE.Group {
  if (!lampParts) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,7.75,0),new THREE.Vector3(0,7.95,.55),new THREE.Vector3(0,8.05,1.4),new THREE.Vector3(0,8.08,2.1)]);
    lampParts = { pole:new THREE.CylinderGeometry(.105,.18,7.75,8), arm:new THREE.TubeGeometry(curve,8,.075,6,false), head:new THREE.BoxGeometry(.55,.19,.92), base:new THREE.BoxGeometry(.56,.2,.56), metal:new THREE.MeshLambertMaterial({color:0x6f8586}), lens:new THREE.MeshStandardMaterial({color:0xf5e7bb,emissive:0xaa8945,emissiveIntensity:.3}) };
  }
  const group=new THREE.Group();group.name='RoadKit_streetlight';group.scale.setScalar(height/8);
  const pole=new THREE.Mesh(lampParts.pole,lampParts.metal);pole.position.y=3.975;
  const arm=new THREE.Mesh(lampParts.arm,lampParts.metal);
  const head=new THREE.Mesh(lampParts.head,lampParts.metal);head.position.set(0,8.04,2.1);
  const base=new THREE.Mesh(lampParts.base,lampParts.metal);base.position.y=.1;
  const lens=new THREE.Mesh(lampParts.head,lampParts.lens);lens.scale.set(.72,.2,.75);lens.position.set(0,7.94,2.1);
  group.add(base,pole,arm,head,lens);return group;
}
