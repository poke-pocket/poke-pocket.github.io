import type { TownStreetSeg } from '../utils/townStreetGen';

/** Split a planned road into ground and bridge spans, keeping its endpoints
 * and interpolated widths. Signed distance is negative inside the water. */
export function splitRoadAtWater(seg:TownStreetSeg,signedWaterDistance:(x:number,z:number)=>number):TownStreetSeg[]{
 if(seg.isBridge||seg.kind==='rail')return [seg];
 const dx=seg.x2-seg.x1,dz=seg.z2-seg.z1,len=Math.hypot(dx,dz);
 if(len<.01)return [seg];
 const n=Math.max(1,Math.ceil(len/3));
 const wet=(t:number)=>signedWaterDistance(seg.x1+dx*t,seg.z1+dz*t)<.5;
 const state:boolean[]=Array.from({length:n+1},(_,i)=>wet(i/n));
 const intervals:[number,number][]=[];
 for(let i=0;i<=n;){
  if(!state[i]){i++;continue}
  const a=i;while(i+1<=n&&state[i+1])i++;const b=i++;
  let lo=Math.max(0,(a-1)/n),hi=a/n;
  for(let j=0;j<8&&a>0;j++){const m=(lo+hi)/2;if(wet(m))hi=m;else lo=m}
  let begin=a===0?0:hi;
  lo=b/n;hi=Math.min(1,(b+1)/n);
  for(let j=0;j<8&&b<n;j++){const m=(lo+hi)/2;if(wet(m))lo=m;else hi=m}
  let end=b===n?1:lo;
  // Begin the bridge on the banks so the deck joins the approach smoothly.
  begin=Math.max(0,begin-5/len);end=Math.min(1,end+5/len);
  if(intervals.length&&begin<=intervals[intervals.length-1][1])intervals[intervals.length-1][1]=end;
  else intervals.push([begin,end]);
 }
 if(!intervals.length)return [seg];
 const out:TownStreetSeg[]=[];
 const append=(a:number,b:number,bridge:boolean)=>{
  if((b-a)*len<.01)return;
  const start=seg.widthStart??seg.width,end=seg.widthEnd??seg.width;
  const w0=start+(end-start)*a,w1=start+(end-start)*b;
  out.push({...seg,x1:seg.x1+dx*a,z1:seg.z1+dz*a,x2:seg.x1+dx*b,z2:seg.z1+dz*b,width:(w0+w1)/2,widthStart:w0,widthEnd:w1,isBridge:bridge,bridgeStyle:bridge?'waibaidu':undefined});
 };
 let cursor=0;for(const [a,b] of intervals){append(cursor,a,false);append(a,b,true);cursor=b}append(cursor,1,false);
 return out;
}

/** Fast world-space river lookup for clipping the edges of ground roads. */
export function createRoadRiverMask(rivers:readonly {width:number;points:[number,number][]}[]):(x:number,z:number)=>boolean{
 const size=64,bins=new Map<string,{ax:number;az:number;dx:number;dz:number;len2:number;half:number}[]>();
 for(const river of rivers)for(let i=1;i<river.points.length;i++){
  const [ax,az]=river.points[i-1],[bx,bz]=river.points[i],dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz,half=river.width*.5;
  if(len2<.001)continue;const segment={ax,az,dx,dz,len2,half};
  for(let x=Math.floor((Math.min(ax,bx)-half)/size);x<=Math.floor((Math.max(ax,bx)+half)/size);x++)for(let z=Math.floor((Math.min(az,bz)-half)/size);z<=Math.floor((Math.max(az,bz)+half)/size);z++){
   const key=`${x},${z}`,list=bins.get(key)??[];list.push(segment);bins.set(key,list);
  }
 }
 return (x,z)=>{
  const nearby=bins.get(`${Math.floor(x/size)},${Math.floor(z/size)}`);if(!nearby)return false;
  return nearby.some(s=>{const t=Math.max(0,Math.min(1,((x-s.ax)*s.dx+(z-s.az)*s.dz)/s.len2));return Math.hypot(x-s.ax-s.dx*t,z-s.az-s.dz*t)<s.half});
 };
}
