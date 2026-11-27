/** Terrain grading chosen from footprint slope and the extent of connected high ground. */
export type FoundationMode='auto'|'level'|'raised';
export interface FoundationSettings {mode?:FoundationMode;targetHeight?:number;padding?:number;transition?:number}
export interface FoundationLot {id:string;x:number;z:number;width:number;depth:number;rotY:number;foundation?:FoundationSettings}
export interface FoundationPlan {
 id:string;x:number;z:number;halfW:number;halfD:number;cos:number;sin:number;
 mode:'level'|'raised';target:number;padding:number;transition:number;
 relief:number;slope:number;highFraction:number;footprintHighFraction:number;connectedFraction:number;
}
export const foundationAutoThresholds={minRelief:.75,minSlope:.025,minFootprintHighFraction:.16,minSurroundingHighFraction:.24,minConnectedFraction:.6};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function percentile(a:number[],p:number){const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return a[lo]+(a[hi]-a[lo])*(i-lo)}
/** Sample a 5×5 footprint plus a one-cell surrounding ring. */
export function planBuildingFoundation(lot:FoundationLot,ground:(x:number,z:number)=>number):FoundationPlan {
 const N=7,cos=Math.cos(lot.rotY),sin=Math.sin(lot.rotY),values:number[]=[],footprint:number[]=[];
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const lx=((x-1)/4-.5)*lot.width,lz=((z-1)/4-.5)*lot.depth;
  const y=ground(lot.x+lx*cos+lz*sin,lot.z-lx*sin+lz*cos);values.push(y);
  if(x>=1&&x<=5&&z>=1&&z<=5)footprint.push(y);
 }
 const sorted=[...footprint].sort((a,b)=>a-b),low=percentile(sorted,.10),high=percentile(sorted,.90),relief=Math.max(0,high-low);
 const slope=relief/Math.max(1,Math.min(lot.width,lot.depth)*.8),threshold=low+relief*.65;
 const highCells=values.map(y=>relief>.001&&y>=threshold),highCount=highCells.filter(Boolean).length;
 let largest=0;const visited=new Set<number>();
 for(let i=0;i<highCells.length;i++)if(highCells[i]&&!visited.has(i)){
  let count=0,touchesFootprint=false;const queue=[i];visited.add(i);
  for(let j=0;j<queue.length;j++){const k=queue[j],x=k%N,z=Math.floor(k/N);count++;if(x>=1&&x<=5&&z>=1&&z<=5)touchesFootprint=true;
   for(const [xx,zz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){if(xx<0||xx>=N||zz<0||zz>=N)continue;const n=zz*N+xx;if(highCells[n]&&!visited.has(n)){visited.add(n);queue.push(n)}}
  }
  if(touchesFootprint)largest=Math.max(largest,count);
 }
 const highFraction=highCount/values.length,footprintHighFraction=footprint.filter(y=>relief>.001&&y>=threshold).length/footprint.length,connectedFraction=highCount?largest/highCount:0,t=foundationAutoThresholds;
 const autoRaised=relief>=t.minRelief&&slope>=t.minSlope&&footprintHighFraction>=t.minFootprintHighFraction&&highFraction>=t.minSurroundingHighFraction&&connectedFraction>=t.minConnectedFraction;
 const mode=lot.foundation?.mode==='level'?'level':lot.foundation?.mode==='raised'?'raised':autoRaised?'raised':'level';
 const override=lot.foundation?.targetHeight;
 const target=Number.isFinite(override)?override!:percentile(sorted,mode==='raised'?.82:.5);
 const padding=clamp(lot.foundation?.padding??6,0,20);
 const delta=Math.max(Math.abs(target-low),Math.abs(high-target));
 const transition=clamp(lot.foundation?.transition??Math.max(10,delta*10),4,60);
 return {id:lot.id,x:lot.x,z:lot.z,halfW:lot.width*.5,halfD:lot.depth*.5,cos,sin,mode,target,padding,transition,relief,slope,highFraction,footprintHighFraction,connectedFraction};
}
export function foundationDistance(plan:FoundationPlan,x:number,z:number):number{
 const dx=x-plan.x,dz=z-plan.z,lx=dx*plan.cos-dz*plan.sin,lz=dx*plan.sin+dz*plan.cos;
 const outsideX=Math.max(0,Math.abs(lx)-plan.halfW-plan.padding),outsideZ=Math.max(0,Math.abs(lz)-plan.halfD-plan.padding);
 return Math.hypot(outsideX,outsideZ);
}
export function foundationWeight(plan:FoundationPlan,x:number,z:number):number{
 const t=clamp(foundationDistance(plan,x,z)/plan.transition,0,1);return 1-t*t*(3-2*t);
}
/** The strongest nearby pad owns the point; road and water protection remain external constraints. */
export function gradeFoundationHeight(elevation:number,x:number,z:number,plans:readonly FoundationPlan[],roadWeight=1):number{
 let chosen:FoundationPlan|undefined,best=0;
 for(const plan of plans){const weight=foundationWeight(plan,x,z)*clamp(roadWeight,0,1);if(weight>best){best=weight;chosen=plan}}
 return chosen?elevation+(chosen.target-elevation)*best:elevation;
}
