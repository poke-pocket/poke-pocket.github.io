import * as THREE from 'three';
import type { TownStreetSeg } from '../utils/townStreetGen';
import { applyRoadKitAsphalt, applyRoadKitPaintWear, getRoadKitPavingMaterial, getRoadKitTactileMaterial, roadKitStyle, roadLaneCount, type RoadKitJunctionPlan } from './roadModelStyle3D';
import { ROAD_GRID, roadSurfaceVertexY, roadSurfaceY } from './roadKitSurface';
import { roadEdgeLineOffset, roadSidewalkOuterHalfWidth } from './roadKitDimensions';
import { buildRoadKitManholes } from './roadKitManholes3D';
import type { RoadJoin } from './roadKitContinuity';
import type { ManholeStyle } from './roadKitDetails3D';

// The preview generator rasterizes all roads first, rounds the footway mask,
// then removes all same-level road cells from it. A world-aligned grid and
// chunk halo make that operation independent of streaming boundaries.
export const NETWORK_GRID = ROAD_GRID;
const CELLS = 64;
const HALO = 8;
const CHUNK = CELLS * NETWORK_GRID;
const DISK: [number, number][] = [];
for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (x*x+z*z <= 16) DISK.push([x,z]);

type Surface = 0 | 1 | 2 | 3 | 4 | 5 | 6; // empty, road, footway, curb, tactile, tactile light, alley
interface Hit { seg: TownStreetSeg; distance: number; signed: number; t: number; rawT:number; length: number; ux: number; uz: number; width: number }
export function roadNetworkHit(x:number,z:number,seg:TownStreetSeg):Hit|null {
 const dx=seg.x2-seg.x1,dz=seg.z2-seg.z1,length=Math.hypot(dx,dz);
 if(length<.01)return null;
 const ux=dx/length,uz=dz/length,rawT=((x-seg.x1)*ux+(z-seg.z1)*uz)/length,t=Math.max(0,Math.min(1,rawT));
 const rx=x-seg.x1-t*dx,rz=z-seg.z1-t*dz;
 return {seg,distance:Math.hypot(rx,rz),signed:rx*(-uz)+rz*ux,t,rawT,length,ux,uz,width:THREE.MathUtils.lerp(seg.widthStart??seg.width,seg.widthEnd??seg.width,t)};
}

type BridgeCut={start?:boolean;end?:boolean};
/** Stop a ground road at a matching bridge endpoint instead of rounding its
 * end cap over the bridge's pavement and tactile strip. */
export function buildBridgeApproachCuts(streets:TownStreetSeg[]):Map<TownStreetSeg,BridgeCut>{
 const bridges=streets.filter(s=>s.isBridge),cuts=new Map<TownStreetSeg,BridgeCut>();
 for(const s of streets){if(s.isBridge||s.kind==='rail')continue;
  const dx=s.x2-s.x1,dz=s.z2-s.z1,len=Math.hypot(dx,dz);if(len<.01)continue;
  for(const b of bridges){const bx=b.x2-b.x1,bz=b.z2-b.z1,bl=Math.hypot(bx,bz);if(bl<.01||Math.abs((dx*bx+dz*bz)/(len*bl))<.94)continue;
   const near=(x:number,z:number)=>Math.hypot(x-b.x1,z-b.z1)<.05||Math.hypot(x-b.x2,z-b.z2)<.05;
   const start=near(s.x1,s.z1),end=near(s.x2,s.z2);if(start||end){const cut=cuts.get(s)??{};cut.start ||= start;cut.end ||= end;cuts.set(s,cut)}
  }
 }
 return cuts;
}

/** The original game stores the total ribbon width, including its two footways. */
export function classifyNetworkPoint(x:number,z:number,streets:TownStreetSeg[],nearJunction=false,bridgeCuts?:Map<TownStreetSeg,BridgeCut>):Surface {
 let road:Hit|undefined, walk:Hit|undefined;
 for(const seg of streets){
  if(seg.isBridge||seg.kind==='rail')continue;
  const p=roadNetworkHit(x,z,seg);if(!p)continue;
  const cut=bridgeCuts?.get(seg),overlap=NETWORK_GRID*.5/p.length;
  if((cut?.start&&p.rawT < -overlap)||(cut?.end&&p.rawT > 1+overlap))continue;
  const half=seg.kind==='alley'?p.width*.5:roadSidewalkOuterHalfWidth(p.width),travel=seg.kind==='alley'?half:p.width*.34375;
  if(p.distance<=travel){if(!road||p.distance/(travel||1)<road.distance/(road.width*.34375||1))road=p;}
  else if(seg.kind!=='alley'&&p.distance<=half&&(!walk||p.distance/(half||1)<walk.distance/(roadSidewalkOuterHalfWidth(walk.width)||1)))walk=p;
 }
 if(road)return road.seg.kind==='alley'?6:1;
 if(!walk)return 0;
 const travel=walk.width*.34375,half=roadSidewalkOuterHalfWidth(walk.width);
 if(walk.distance-travel<.30)return 3;
 // Tactile paving stops before a junction, just as in the preview.
 const tactile=travel+(half-travel)*.64;
 if(!nearJunction&&Math.abs(walk.distance-tactile)<.33){
  const along=(x-walk.seg.x1)*walk.ux+(z-walk.seg.z1)*walk.uz;
  return Math.floor(along/.65)%2===0?4:5;
 }
 return 2;
}

interface Options {streets:TownStreetSeg[];plans:RoadKitJunctionPlan[];centerX:number;centerZ:number;baseY:number;water:number;ground:(x:number,z:number)=>number;radius?:number;joins?:Map<TownStreetSeg,RoadJoin>;manholeStyle?:ManholeStyle;manholeSpacing?:number;isWater?:(x:number,z:number)=>boolean;bridgeCuts?:Map<TownStreetSeg,BridgeCut>}
const roadMat=new THREE.MeshLambertMaterial({color:0x718891,side:THREE.DoubleSide});
applyRoadKitAsphalt(roadMat);
const alleyMat=new THREE.MeshLambertMaterial({color:0xa9aaa0,side:THREE.DoubleSide});
applyRoadKitAsphalt(alleyMat);
const curbMat=new THREE.MeshLambertMaterial({color:0xa2b1aa,side:THREE.DoubleSide});
const whiteMat=new THREE.MeshLambertMaterial({color:0xe9e8dc,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4});
const yellowMat=new THREE.MeshLambertMaterial({color:0xe6d193,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4});
applyRoadKitPaintWear(whiteMat,roadKitStyle.lineWear);applyRoadKitPaintWear(yellowMat,roadKitStyle.lineWear);
const materialFor=(kind:Surface)=>kind===1?roadMat:kind===2?getRoadKitPavingMaterial():kind===3?curbMat:kind===4||kind===5?getRoadKitTactileMaterial():alleyMat;

export function buildNetworkChunk(opts:Options,cx:number,cz:number,streets:TownStreetSeg[]):THREE.Group {
 const root=new THREE.Group();root.name=`RoadKit_network_${cx}_${cz}`;
 if(!streets.length)return root;
 const bridgeCuts=opts.bridgeCuts??buildBridgeApproachCuts(opts.streets);
 const size=CELLS+HALO*2, masks=new Uint8Array(size*size), expanded=new Uint8Array(size*size);
 const ox=cx*CELLS-HALO,oz=cz*CELLS-HALO;
 const plans=opts.plans.filter(p=>Math.abs(p.node.x-(cx+.5)*CHUNK)<p.radius+CHUNK && Math.abs(p.node.z-(cz+.5)*CHUNK)<p.radius+CHUNK);
 const near=(x:number,z:number)=>plans.some(p=>Math.hypot(p.node.x-x,p.node.z-z)<p.radius+2);
 const cutSegments=streets.filter(s=>bridgeCuts.has(s));
 const beyondBridgeEnd=(x:number,z:number)=>cutSegments.some(s=>{const p=roadNetworkHit(x,z,s);if(!p)return false;const cut=bridgeCuts.get(s)!,overlap=NETWORK_GRID*.5/p.length;return ((cut.start&&p.rawT < -overlap)||(cut.end&&p.rawT > 1+overlap))&&p.distance<=roadSidewalkOuterHalfWidth(p.width)});
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const wx=(ox+x+.5)*NETWORK_GRID,wz=(oz+z+.5)*NETWORK_GRID;
  masks[z*size+x]=opts.isWater?.(wx,wz)?0:classifyNetworkPoint(wx,wz,streets,near(wx,wz),bridgeCuts);
 }
 // The preview adds a small quarter-circle fillet between perpendicular
 // junction arms before smoothing the pedestrian mask.
 const cornerRadius=1.3;
 for(const plan of plans){if(plan.arms.length<3)continue;
  for(let i=0;i<plan.arms.length;i++)for(let j=i+1;j<plan.arms.length;j++){
   const a=plan.arms[i],b=plan.arms[j];if(Math.abs(a.ux*b.ux+a.uz*b.uz)>.08)continue;
   const cornerX=plan.node.x+a.ux*b.width*.34375+b.ux*a.width*.34375,cornerZ=plan.node.z+a.uz*b.width*.34375+b.uz*a.width*.34375;
   const reach=cornerRadius*1.5;
   const x0=Math.max(0,Math.floor((cornerX-reach)/NETWORK_GRID)-ox),x1=Math.min(size-1,Math.ceil((cornerX+reach)/NETWORK_GRID)-ox);
   const z0=Math.max(0,Math.floor((cornerZ-reach)/NETWORK_GRID)-oz),z1=Math.min(size-1,Math.ceil((cornerZ+reach)/NETWORK_GRID)-oz);
   for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
    const dx=(ox+x+.5)*NETWORK_GRID-plan.node.x,dz=(oz+z+.5)*NETWORK_GRID-plan.node.z;
    const u=dx*a.ux+dz*a.uz-b.width*.34375,v=dx*b.ux+dz*b.uz-a.width*.34375;
   if(u>=0&&v>=0&&u<=cornerRadius&&v<=cornerRadius&&Math.hypot(cornerRadius-u,cornerRadius-v)>=cornerRadius&&!opts.isWater?.((ox+x+.5)*NETWORK_GRID,(oz+z+.5)*NETWORK_GRID))masks[z*size+x]=1;
   }
  }
 }
 // Morphological closing of the sidewalk mask, matching the preview's rounded
 // corner rule. The final subtraction gives the carriageway priority.
 for(let z=4;z<size-4;z++)for(let x=4;x<size-4;x++){
  for(const [dx,dz] of DISK){const t=masks[(z+dz)*size+x+dx];if(t>=2&&t<=5){expanded[z*size+x]=1;break}}
 }
 for(let z=HALO;z<size-HALO;z++)for(let x=HALO;x<size-HALO;x++){
  const idx=z*size+x;if(masks[idx]!==0)continue;
  const wx=(ox+x+.5)*NETWORK_GRID,wz=(oz+z+.5)*NETWORK_GRID;
  if(!opts.isWater?.(wx,wz)&&!beyondBridgeEnd(wx,wz)&&DISK.every(([dx,dz])=>expanded[(z+dz)*size+x+dx]===1))masks[idx]=2;
 }
 // Emit horizontal runs instead of one mesh per voxel. Shared world-grid
 // positions make chunk borders continuous even on sloped terrain.
 const verts:number[][]=Array.from({length:7},()=>[]), inds:number[][]=Array.from({length:7},()=>[]);
 const surfaceUV:number[][]=Array.from({length:7},()=>[]);
 const sideVerts:number[]=[],sideInds:number[]=[];
 const add=(kind:Surface,x0:number,z0:number,x1:number,z1:number)=>{
  const v=verts[kind],id=inds[kind],n=v.length/3;
  let tactileHit:Hit|undefined;
  if(kind===4||kind===5)for(const seg of streets){if(seg.isBridge||seg.kind==='rail'||seg.kind==='alley')continue;const p=roadNetworkHit((x0+x1)/2,(z0+z1)/2,seg);if(p&&p.distance>p.width*.34375&&p.distance<=roadSidewalkOuterHalfWidth(p.width)&&(!tactileHit||p.distance/roadSidewalkOuterHalfWidth(p.width)<tactileHit.distance/roadSidewalkOuterHalfWidth(tactileHit.width)))tactileHit=p}
  for(const [x,z] of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]]){
   v.push(x-opts.centerX,roadSurfaceVertexY(x,z,opts.ground,opts.water)-opts.baseY,z-opts.centerZ);
   if(kind===4||kind===5){const h=tactileHit;if(h){const side=h.signed<0?-1:1,center=h.width*.34375+(roadSidewalkOuterHalfWidth(h.width)-h.width*.34375)*.64;const along=x*h.ux+z*h.uz,across=(x-h.seg.x1)*(-h.uz)+(z-h.seg.z1)*h.ux-side*center;surfaceUV[kind].push(along/.325,across/.65+.5)}else surfaceUV[kind].push(x/.325,z/.65)}
  }
  id.push(n,n+2,n+1,n,n+3,n+2);
 };
 for(let z=HALO;z<size-HALO;z++)for(let x=HALO;x<size-HALO;){
  const kind=masks[z*size+x] as Surface;if(!kind){x++;continue}
  const x0=(ox+x)*NETWORK_GRID,z0=(oz+z)*NETWORK_GRID,x1=x0+NETWORK_GRID,z1=z0+NETWORK_GRID;
  add(kind,x0,z0,x1,z1);
  // Exposed outside edges have a shallow slab; physics follows the top face.
  const side=(ax:number,az:number,bx:number,bz:number)=>{const v=sideVerts,id=sideInds,n=v.length/3,ay=roadSurfaceVertexY(ax,az,opts.ground,opts.water)-opts.baseY,by=roadSurfaceVertexY(bx,bz,opts.ground,opts.water)-opts.baseY;v.push(ax-opts.centerX,ay,az-opts.centerZ,bx-opts.centerX,by,bz-opts.centerZ,bx-opts.centerX,by-.12,bz-opts.centerZ,ax-opts.centerX,ay-.12,az-opts.centerZ);id.push(n,n+1,n+2,n,n+2,n+3)};
  if(!masks[z*size+x-1])side(x0,z0,x0,z1);
  if(!masks[z*size+x+1])side(x1,z1,x1,z0);
  if(!masks[(z-1)*size+x])side(x1,z0,x0,z0);
  if(!masks[(z+1)*size+x])side(x0,z1,x1,z1);
  x++;
 }
 for(let kind=1;kind<=6;kind++)if(verts[kind].length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts[kind],3));if(surfaceUV[kind].length)geo.setAttribute('uv',new THREE.Float32BufferAttribute(surfaceUV[kind],2));geo.setIndex(inds[kind]);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,materialFor(kind as Surface));mesh.name=`RoadKit_network_surface_${kind}`;mesh.receiveShadow=true;root.add(mesh)}
 if(sideVerts.length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(sideVerts,3));geo.setIndex(sideInds);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,curbMat);mesh.name='RoadKit_network_sides';root.add(mesh)}
 // Center, edge and lane-divider lines follow each original road. Clip where
 // another carriageway or a junction occupies the same place.
 const paintVerts:number[][]=[[],[]],paintIndices:number[][]=[[],[]];
 const emit=(yellow:boolean,a:{x:number;z:number},b:{x:number;z:number},nx:number,nz:number)=>{
  const k=yellow?1:0,v=paintVerts[k],id=paintIndices[k],n=v.length/3,w=.075;
  for(const [x,z] of [[a.x+nx*w,a.z+nz*w],[a.x-nx*w,a.z-nz*w],[b.x-nx*w,b.z-nz*w],[b.x+nx*w,b.z+nz*w]])v.push(x-opts.centerX,roadSurfaceY(x,z,opts.ground,opts.water)+.02-opts.baseY,z-opts.centerZ);
  id.push(n,n+2,n+1,n,n+3,n+2);
 };
 for(const seg of streets){if(seg.isBridge||seg.kind==='alley'||seg.kind==='rail')continue;
  const dx=seg.x2-seg.x1,dz=seg.z2-seg.z1,len=Math.hypot(dx,dz);if(len<.01)continue;
  const ux=dx/len,uz=dz/len,nx=-uz,nz=ux,lanes=roadLaneCount(seg);
  const offsets=[{f:0,y:true,dash:false,edge:false},{f:-1,y:false,dash:false,edge:true},{f:1,y:false,dash:false,edge:true}];
  for(let lane=1;lane<lanes;lane++)if(lane!==lanes/2)offsets.push({f:1.375*(lane/lanes-.5),y:false,dash:true,edge:false});
  for(let d=0;d<len;d+=1.3){const mid=Math.min(len,d+.65),t=mid/len,width=THREE.MathUtils.lerp(seg.widthStart??seg.width,seg.widthEnd??seg.width,t);
   for(const o of offsets){const along=seg.x1*ux+seg.z1*uz+mid;if(o.dash&&((along%6+6)%6)>3.2)continue;
    const shift=o.edge?o.f*roadEdgeLineOffset(width):width*o.f*.5,x=seg.x1+ux*mid+nx*shift,z=seg.z1+uz*mid+nz*shift;
    if(Math.floor(x/CHUNK)!==cx||Math.floor(z/CHUNK)!==cz||near(x,z)||opts.isWater?.(x,z))continue;
    if(streets.some(s=>{if(s===seg||s.isBridge||s.kind==='rail')return false;const h=roadNetworkHit(x,z,s);return !!h&&Math.abs(h.ux*ux+h.uz*uz)<.9&&h.distance<h.width*.34375}))continue;
    const a={x:seg.x1+ux*d+nx*shift,z:seg.z1+uz*d+nz*shift},b={x:seg.x1+ux*Math.min(len,d+1.3)+nx*shift,z:seg.z1+uz*Math.min(len,d+1.3)+nz*shift};emit(o.y,a,b,nx,nz);
   }
  }
 }
 for(let k=0;k<2;k++)if(paintVerts[k].length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(paintVerts[k],3));geo.setIndex(paintIndices[k]);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,k?yellowMat:whiteMat);mesh.name=k?'RoadKit_network_center':'RoadKit_network_lines';root.add(mesh)}
 root.add(buildRoadKitManholes({streets,joins:opts.joins,centerX:opts.centerX,centerZ:opts.centerZ,baseY:opts.baseY,water:opts.water,ground:opts.ground,spacing:opts.manholeSpacing??roadKitStyle.manholeSpacing,style:roadKitStyle.manholeStyle==='auto'?(opts.manholeStyle??'plain'):roadKitStyle.manholeStyle,within:(x,z)=>Math.floor(x/CHUNK)===cx&&Math.floor(z/CHUNK)===cz,avoid:(x,z)=>!!opts.isWater?.(x,z)||plans.some(p=>Math.hypot(p.node.x-x,p.node.z-z)<p.radius+9)}));
 return root;
}

/** Stream the same unified masks over the live road graph without touching the
 * game layout, navigation, collision or bridge-deck generation. */
export function createRoadKitNetworkStreamer(opts:Options){
 opts={...opts,bridgeCuts:buildBridgeApproachCuts(opts.streets)};
 const group=new THREE.Group();group.name='RoadKit_unified_network';
 const bins=new Map<string,TownStreetSeg[]>(), size=CHUNK;
 for(const s of opts.streets){if(s.isBridge||s.kind==='rail'||Math.hypot((s.x1+s.x2)*.5-opts.centerX,(s.z1+s.z2)*.5-opts.centerZ)>4200)continue;const fullWidth=Math.max(s.width,s.widthStart??0,s.widthEnd??0),w=(s.kind==='alley'?fullWidth*.5:roadSidewalkOuterHalfWidth(fullWidth))+HALO*NETWORK_GRID;
  for(let x=Math.floor((Math.min(s.x1,s.x2)-w)/size);x<=Math.floor((Math.max(s.x1,s.x2)+w)/size);x++)for(let z=Math.floor((Math.min(s.z1,s.z2)-w)/size);z<=Math.floor((Math.max(s.z1,s.z2)+w)/size);z++){const key=`${x},${z}`,list=bins.get(key)??[];list.push(s);bins.set(key,list)}
 }
 const active=new Map<string,THREE.Group>(),radius=opts.radius??180;
 const release=(chunk:THREE.Group)=>{group.remove(chunk);chunk.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()})};
 const update=(x:number,z:number)=>{
  for(const [key,chunk] of active){const [cx,cz]=key.split(',').map(Number);if(Math.hypot((cx+.5)*size-x,(cz+.5)*size-z)>radius+size*2){release(chunk);active.delete(key)}}
  const wanted:{key:string;cx:number;cz:number;d:number}[]=[];
  for(let cx=Math.floor((x-radius-size)/size);cx<=Math.floor((x+radius+size)/size);cx++)for(let cz=Math.floor((z-radius-size)/size);cz<=Math.floor((z+radius+size)/size);cz++){const key=`${cx},${cz}`,d=Math.hypot((cx+.5)*size-x,(cz+.5)*size-z);if(d<=radius+size&&bins.has(key)&&!active.has(key))wanted.push({key,cx,cz,d})}
  wanted.sort((a,b)=>a.d-b.d);
  // Work is bounded per frame; nearest pavement appears first.
  for(const item of wanted.slice(0,2)){const chunk=buildNetworkChunk(opts,item.cx,item.cz,bins.get(item.key)!);active.set(item.key,chunk);group.add(chunk)}
 };
 const refreshTerrain=(baseY:number)=>{opts.baseY=baseY;for(const chunk of active.values())release(chunk);active.clear()};
 return {group,update,refreshTerrain};
}
