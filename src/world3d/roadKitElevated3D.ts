import * as THREE from 'three';
import { getRoadKitPavingMaterial, getRoadKitTactileMaterial } from './roadModelStyle3D';
import { roadSidewalkOuterHalfWidth } from './roadKitDimensions';

/** A bridge or ramp keeps its game-authored deck heights, but uses the same
 * paved sidewalk proportions and world-space mosaic material as the city. */
export interface RoadDeckStation { x:number; z:number; y:number; halfWidth:number; leftY?:number; rightY?:number; nx?:number; nz?:number; along?:number; heightAt?:(x:number,z:number)=>number }
const deckEdgeMat=new THREE.MeshLambertMaterial({color:0x9caaa6,side:THREE.DoubleSide});
export function createRoadDeckWalkways(stations:RoadDeckStation[],originX=0,originZ=0,baseY=0):THREE.Group {
 const group=new THREE.Group();group.name='RoadKit_deck_walkways';if(stations.length<2)return group;
 const pos:number[]=[],idx:number[]=[],tactilePos:number[]=[],tactileUV:number[]=[],tactileIdx:number[]=[],edgePos:number[]=[],edgeIdx:number[]=[];
 let cumulative=0;
 const pushStrip=(v:number[],indices:number[],points:[number,number,number][])=>{const n=v.length/3;for(const [x,y,z] of points)v.push(x-originX,y-baseY,z-originZ);indices.push(n,n+2,n+1,n+1,n+2,n+3)};
 for(let i=0;i<stations.length-1;i++){
  const a=stations[i],b=stations[i+1],len=Math.hypot(b.x-a.x,b.z-a.z);if(len<.001)continue;
  const nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;
  for(const sign of [-1,1]){
   const raised=(s:RoadDeckStation,f:number,lift:number):[number,number,number]=>{const edge=(sign<0?s.leftY:s.rightY)??s.y,x=s.x+(s.nx??nx)*s.halfWidth*f*sign,z=s.z+(s.nz??nz)*s.halfWidth*f*sign;return [x,(s.heightAt?.(x,z)??(s.y+(edge-s.y)*Math.min(1,f)))+lift,z]};
   const outer=(s:RoadDeckStation)=>roadSidewalkOuterHalfWidth(s.halfWidth*2)/s.halfWidth;
   const tactile=(s:RoadDeckStation)=>.69+(outer(s)-.69)*.64;
   const edgeA=raised(a,outer(a),.02),edgeB=raised(b,outer(b),.02);
   pushStrip(pos,idx,[raised(a,.69,.02),edgeA,raised(b,.69,.02),edgeB]);
   pushStrip(tactilePos,tactileIdx,[raised(a,tactile(a)-.33/a.halfWidth,.025),raised(a,tactile(a)+.33/a.halfWidth,.025),raised(b,tactile(b)-.33/b.halfWidth,.025),raised(b,tactile(b)+.33/b.halfWidth,.025)]);
   const ua=(a.along??cumulative)/.325,ub=(b.along??(cumulative+len))/.325;tactileUV.push(ua,0,ua,1,ub,0,ub,1);
   pushStrip(edgePos,edgeIdx,[edgeA,[edgeA[0],edgeA[1]-.12,edgeA[2]],edgeB,[edgeB[0],edgeB[1]-.12,edgeB[2]]]);
  }
  cumulative+=len;
 }
 const make=(v:number[],indices:number[],material:THREE.Material,name:string,uv?:number[])=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));if(uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh)};
 make(pos,idx,getRoadKitPavingMaterial(),'RoadKit_deck_pavement');
 make(tactilePos,tactileIdx,getRoadKitTactileMaterial(),'RoadKit_deck_tactile',tactileUV);
 make(edgePos,edgeIdx,deckEdgeMat,'RoadKit_deck_edge');
 return group;
}
