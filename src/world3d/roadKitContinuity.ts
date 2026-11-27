import type { TownStreetSeg } from '../utils/townStreetGen';

type End = { segment:TownStreetSeg; end:'start'|'end'; dx:number; dz:number; width:number; length:number };
type Normal = { x:number; z:number };
export type RoadJoin = { start?:Normal; end?:Normal; phaseStart:number; phaseSign:number };

/** Join only matching, almost tangent, same-level roads. Junctions and bridges
 * remain owned by their existing layout, rather than welding across them. */
export function buildRoadContinuity(streets:TownStreetSeg[]):Map<TownStreetSeg,RoadJoin> {
 const nodes=new Map<string,End[]>(),result=new Map<TownStreetSeg,RoadJoin>();
 const key=(x:number,z:number)=>`${Math.round(x*50)},${Math.round(z*50)}`;
 for(const s of streets){if(s.isBridge||s.kind==='rail')continue;const dx=s.x2-s.x1,dz=s.z2-s.z1,length=Math.hypot(dx,dz);if(length<.01)continue;
  const add=(end:'start'|'end',x:number,z:number,width:number)=>{const k=key(x,z),arr=nodes.get(k)??[];arr.push({segment:s,end,dx:dx/length,dz:dz/length,width,length});nodes.set(k,arr)};
  add('start',s.x1,s.z1,s.widthStart??s.width);add('end',s.x2,s.z2,s.widthEnd??s.width);
  result.set(s,{phaseStart:0,phaseSign:1});
 }
 const links=new Map<TownStreetSeg,{other:TownStreetSeg;at:'start'|'end';otherAt:'start'|'end';len:number;otherLen:number}[]>();
 for(const entries of nodes.values()){
  if(entries.length!==2)continue;const [a,b]=entries;
  const aa=a.end==='start'?1:-1,bb=b.end==='start'?1:-1,dot=(a.dx*aa)*(b.dx*bb)+(a.dz*aa)*(b.dz*bb);
  if(a.segment.kind!==b.segment.kind||Math.abs(a.width-b.width)>.02||dot>-.9)continue;
  const add=(self:End,other:End)=>{const sign=self.dx*other.dx+self.dz*other.dz>=0?1:-1,ax=-self.dz,az=self.dx,bx=-other.dz*sign,bz=other.dx*sign,den=(ax+bx)*ax+(az+bz)*az;
   if(den<.1)return;const normal={x:(ax+bx)/den,z:(az+bz)/den};result.get(self.segment)![self.end]=normal;
   const list=links.get(self.segment)??[];list.push({other:other.segment,at:self.end,otherAt:other.end,len:self.length,otherLen:other.length});links.set(self.segment,list)};
  add(a,b);add(b,a);
 }
 // Match the dash phase across every connected chain even if individual source
 // segments were authored in opposite directions.
 const visited=new Set<TownStreetSeg>();
 for(const seed of result.keys()){if(visited.has(seed))continue;visited.add(seed);const queue=[seed];
  for(let i=0;i<queue.length;i++){const s=queue[i],current=result.get(s)!;for(const link of links.get(s)??[]){if(visited.has(link.other))continue;
   const phase=current.phaseStart+(link.at==='end'?current.phaseSign*link.len:0),sign=current.phaseSign*(link.at===link.otherAt?-1:1),next=result.get(link.other)!;
   next.phaseSign=sign;next.phaseStart=phase-(link.otherAt==='end'?sign*link.otherLen:0);visited.add(link.other);queue.push(link.other);
  }}
 }
 return result;
}
