import * as THREE from 'three';
import type { TownStreetSeg } from '../utils/townStreetGen';
import type { RoadJoin } from './roadKitContinuity';
import { roadSurfaceY } from './roadKitSurface';
import { getManholeMaterial, type ManholeStyle } from './roadKitDetails3D';

interface Options{
 streets:TownStreetSeg[];joins?:Map<TownStreetSeg,RoadJoin>;centerX:number;centerZ:number;baseY:number;
 water:number;ground:(x:number,z:number)=>number;spacing:number;style:ManholeStyle;
 within:(x:number,z:number)=>boolean;avoid:(x:number,z:number)=>boolean;
}
/** Flush, pixel-detailed covers follow connected-road phase; no collider is added. */
export function buildRoadKitManholes(opts:Options):THREE.Group{
 const root=new THREE.Group();root.name='RoadKit_manholes';if(!Number.isFinite(opts.spacing)||opts.spacing<=0)return root;
 const vertices:number[]=[],uvs:number[]=[],indices:number[]=[],centers:{x:number;z:number}[]=[];
 for(const seg of opts.streets){
  if(seg.isBridge||seg.kind==='alley'||seg.kind==='rail')continue;
  const dx=seg.x2-seg.x1,dz=seg.z2-seg.z1,len=Math.hypot(dx,dz);if(len<1)continue;
  const ux=dx/len,uz=dz/len,nx=-uz,nz=ux,join=opts.joins?.get(seg),phase=join?.phaseStart??0,sign=join?.phaseSign??1;
  const end=phase+sign*len,low=Math.min(phase,end),high=Math.max(phase,end),spacing=opts.spacing;
  const first=Math.ceil((low-spacing/2)/spacing)*spacing+spacing/2;
  for(let at=first;at<high;at+=spacing){
   const d=(at-phase)/sign;if(d<1||d>len-1)continue;
   const t=d/len,width=THREE.MathUtils.lerp(seg.widthStart??seg.width,seg.widthEnd??seg.width,t),lanes=seg.laneCount??(seg.kind==='arterial'?4:2);
   if(width*.6875/lanes<1.45)continue;
   const phaseIndex=Math.round((at-spacing/2)/spacing),side=Math.abs(phaseIndex)%2===0?1:-1;
   const offset=side*width*.34375/lanes,x=seg.x1+dx*t+nx*offset,z=seg.z1+dz*t+nz*offset;
   if(!opts.within(x,z)||opts.avoid(x,z)||centers.some(c=>Math.hypot(c.x-x,c.z-z)<1.5))continue;
   // Subdivide so the cover conforms to slopes instead of cutting through
   // the underlying terrain-following road tile.
   const start=vertices.length/3,subdivisions=8;
   for(let iz=0;iz<=subdivisions;iz++)for(let ix=0;ix<=subdivisions;ix++){
    const u=ix/subdivisions,v=iz/subdivisions,px=x+(u-.5)*1.24,pz=z+(v-.5)*1.24;
    vertices.push(px-opts.centerX,roadSurfaceY(px,pz,opts.ground,opts.water)+.018-opts.baseY,pz-opts.centerZ);uvs.push(u,v);
    if(ix<subdivisions&&iz<subdivisions){const a=start+iz*(subdivisions+1)+ix,b=a+1,c=a+subdivisions+1,d=c+1;indices.push(a,d,b,a,c,d)}
   }
   centers.push({x,z});
  }
 }
 if(vertices.length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,getManholeMaterial(opts.style));mesh.name=`RoadKit_manhole_${opts.style}`;mesh.userData={style:opts.style,spacing:opts.spacing,centers};root.add(mesh)}
 return root;
}
