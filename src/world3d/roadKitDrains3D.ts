import * as THREE from 'three';
import type { TownStreetSeg } from '../utils/townStreetGen';
import type { RoadJoin } from './roadKitContinuity';
import { roadKitStyle, type RoadKitCut } from './roadModelStyle3D';
import { roadSurfaceY } from './roadKitSurface';

/** Grates follow the same road-width, grade and junction exclusions as the
 * terrain-adaptive ribbon. Spacing is measured along connected road chains. */
export function buildRoadKitDrains(opts:{streets:TownStreetSeg[];joins:Map<TownStreetSeg,RoadJoin>;cuts:Map<TownStreetSeg,RoadKitCut[]>;centerX:number;centerZ:number;baseY:number;water:number;ground:(x:number,z:number)=>number;spacing?:number}):THREE.Group{
 const {streets,joins,cuts,centerX,centerZ,baseY,water,ground}=opts,spacing=opts.spacing??roadKitStyle.drainSpacing,root=new THREE.Group();root.name='RoadKit_drains';if(spacing<=0)return root;
 const plates:number[]=[],slats:number[]=[],plateIndices:number[]=[],slatIndices:number[]=[];
 const quad=(vertices:number[],indices:number[],points:number[][])=>{const i=vertices.length/3;for(const p of points)vertices.push(...p);indices.push(i,i+2,i+1,i,i+3,i+2)};
 const insideCut=(x:number,z:number,c:RoadKitCut)=>{const cx=(Math.floor(x/c.step)+.5)*c.step,cz=(Math.floor(z/c.step)+.5)*c.step;return Math.hypot(cx-c.x,cz-c.z)<=c.radius};
 for(const seg of streets){if(seg.isBridge||seg.kind==='alley'||seg.kind==='rail')continue;const dx=seg.x2-seg.x1,dz=seg.z2-seg.z1,len=Math.hypot(dx,dz);if(len<1)continue;
  const dirX=dx/len,dirZ=dz/len,join=joins.get(seg),phase=join?.phaseStart??0,sign=join?.phaseSign??1,p0=phase,p1=phase+sign*len,low=Math.min(p0,p1),high=Math.max(p0,p1),first=Math.ceil((low-spacing/2)/spacing)*spacing+spacing/2;
  for(let at=first;at<high;at+=spacing){const distance=(at-phase)/sign;if(distance<.65||distance>len-.65)continue;const t=distance/len,width=(seg.widthStart??seg.width)+((seg.widthEnd??seg.width)-(seg.widthStart??seg.width))*t,baseX=seg.x1+dx*t,baseZ=seg.z1+dz*t;
   let nx=-dirZ,nz=dirX;const a=join?.start?Math.max(0,1-distance/4):0,b=join?.end?Math.max(0,1-(len-distance)/4):0;if(join?.start){nx+=(join.start.x+dirZ)*a;nz+=(join.start.z-dirX)*a}if(join?.end){nx+=(join.end.x+dirZ)*b;nz+=(join.end.z-dirX)*b}
   const halfWidth=Math.min(.24,width*.0135);
   for(const side of [-1,1]){const x=baseX+nx*side*width*.328125,z=baseZ+nz*side*width*.328125;if((cuts.get(seg)??[]).some(c=>insideCut(x,z,c)))continue;
    const point=(along:number,across:number,dy:number)=>{const px=x+dirX*along+nx*across,pz=z+dirZ*along+nz*across;return [px-centerX,roadSurfaceY(px,pz,ground,water)+.018+dy-baseY,pz-centerZ]};
    quad(plates,plateIndices,[point(-.45,-halfWidth,0),point(.45,-halfWidth,0),point(.45,halfWidth,0),point(-.45,halfWidth,0)]);
    for(let k=-2;k<=2;k++){const offset=k*.16;quad(slats,slatIndices,[point(offset-.025,-halfWidth+.04,.007),point(offset+.025,-halfWidth+.04,.007),point(offset+.025,halfWidth-.04,.007),point(offset-.025,halfWidth-.04,.007)])}
   }
  }
 }
 for(const [name,vertices,indices,color] of [['RoadKit_drain_bases',plates,plateIndices,0x4b5b5d],['RoadKit_drain_slots',slats,slatIndices,0x788982]] as const){if(!vertices.length)continue;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const linear=new THREE.Color().setRGB(((color>>16)&255)/255,((color>>8)&255)/255,(color&255)/255);const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:linear,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));mesh.name=name;root.add(mesh)}
 return root;
}
