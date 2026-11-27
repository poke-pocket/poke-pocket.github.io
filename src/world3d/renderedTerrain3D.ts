import type * as THREE from 'three';

/** The terrain renderer uses a coarser mesh than the underlying heightfield.
 * Sample its actual two triangles, including its current streaming offset. */
export function createRenderedTerrainSampler(position:THREE.BufferAttribute,mesh:THREE.Mesh){
 const side=Math.round(Math.sqrt(position.count));
 const x0=position.getX(0),z0=position.getZ(0);
 const stepX=position.getX(1)-x0,stepZ=position.getZ(side)-z0;
 return (wx:number,wz:number):number|undefined=>{
  if(side<2||stepX<=0||stepZ<=0)return undefined;
  const x=(wx-mesh.position.x-x0)/stepX,z=(wz-mesh.position.z-z0)/stepZ;
  if(x<0||z<0||x>=side-1||z>=side-1)return undefined;
  const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz;
  const a=position.getY(iz*side+ix),b=position.getY(iz*side+ix+1),c=position.getY((iz+1)*side+ix),d=position.getY((iz+1)*side+ix+1);
  // PlaneGeometry uses the b--c diagonal, unlike the road tile diagonal.
  return mesh.position.y+(u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v));
 };
}
type TerrainSampler=(x:number,z:number)=>number|undefined;
let activeSampler:TerrainSampler|undefined;
export function setRenderedTerrainSampler(sampler:TerrainSampler):()=>void{
 activeSampler=sampler;
 return ()=>{if(activeSampler===sampler)activeSampler=undefined};
}
export function renderedTerrainHeight(x:number,z:number):number|undefined{return activeSampler?.(x,z)}
