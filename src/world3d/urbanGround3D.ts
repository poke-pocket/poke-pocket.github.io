export interface UrbanPark {x:number;z:number;halfW:number;halfD:number}
export interface UrbanRegion {x:number;z:number;innerRadius:number;outerRadius:number;parks:UrbanPark[]}
export interface UrbanLayout {centerX:number;centerZ:number;lots:{x:number;z:number}[];parks:{x:number;z:number;w:number;d:number}[]}
function smooth(a:number,b:number,x:number){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
/** Use the distribution of generated buildings, with a soft outer transition. */
export function buildUrbanRegion(layout:UrbanLayout,minimumRadius:number):UrbanRegion {
 const d=layout.lots.map(l=>Math.hypot(l.x-layout.centerX,l.z-layout.centerZ)).sort((a,b)=>a-b);
 const builtRadius=d.length?d[Math.floor((d.length-1)*.85)]:minimumRadius;
 const innerRadius=Math.max(minimumRadius,Math.min(1300,builtRadius+30));
 return {x:layout.centerX,z:layout.centerZ,innerRadius,outerRadius:innerRadius+Math.max(90,Math.min(240,innerRadius*.2)),parks:layout.parks.map(p=>({x:p.x,z:p.z,halfW:p.w*.5,halfD:p.d*.5}))};
}
export function urbanGroundWeight(regions:UrbanRegion[],x:number,z:number):number{
 let weight=0;for(const region of regions)weight=Math.max(weight,1-smooth(region.innerRadius,region.outerRadius,Math.hypot(x-region.x,z-region.z)));
 if(weight>0)for(const region of regions)for(const p of region.parks){const outside=Math.max(Math.abs(x-p.x)-p.halfW,Math.abs(z-p.z)-p.halfD);weight*=smooth(0,5,outside)}
 return weight;
}
/** Nearest centers bound the GPU uniform count; park areas remain green. */
export function nearestUrbanRegions(regions:UrbanRegion[],x:number,z:number,limit=8):UrbanRegion[]{return [...regions].sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z)).slice(0,limit)}
