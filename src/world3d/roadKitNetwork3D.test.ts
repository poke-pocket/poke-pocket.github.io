import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { generateTownLayout, type TownStreetSeg } from '../utils/townStreetGen';
import { WORLD_TOWNS_3D, WATER_LEVEL_3D, computeCityBridgeSurfaceWorldY3D, getTerrainHeight3D, getWalkableSurfaceHeight3D, registerActiveTownRoadLayouts3D } from '../data/survivorsTactics';
import { buildBridgeApproachCuts, buildNetworkChunk, classifyNetworkPoint, createRoadKitNetworkStreamer, NETWORK_GRID } from './roadKitNetwork3D';
import { planRoadKitJunctions } from './roadModelStyle3D';
import { roadSurfaceY, ROAD_WALK_CLEARANCE } from './roadKitSurface';
import { createRoadDeckWalkways } from './roadKitElevated3D';
import { highwayJointMiter } from '../utils/interCityHighwayGraph';
import { roadSidewalkOuterHalfWidth,roadSidewalkExtra } from './roadKitDimensions';

const street=(x1:number,z1:number,x2:number,z2:number,width=20,isBridge=false):TownStreetSeg=>({x1,z1,x2,z2,width,isBridge,kind:'street'});
const ground=(x:number,z:number)=>2+x*.001+z*.002;
const roads=[street(-90,0,90,0),street(0,-90,0,90)];
const options={streets:roads,plans:[],centerX:0,centerZ:0,baseY:0,water:0,ground};

function cells(group:THREE.Group,kind:number){
 const mesh=group.getObjectByName(`RoadKit_network_surface_${kind}`) as THREE.Mesh|undefined;
 if(!mesh)return [];
 const p=mesh.geometry.getAttribute('position');const result:{x:number;z:number}[]=[];
 for(let i=0;i<p.count;i+=4){
  const min=p.getX(i),max=p.getX(i+1),z=(p.getZ(i)+p.getZ(i+2))/2;
  for(let x=min+NETWORK_GRID/2;x<max-.001;x+=NETWORK_GRID)result.push({x,z});
 }
 return result;
}

describe('unified preview-style network',()=>{
 it('gives the carriageway priority over every sidewalk at a crossing',()=>{
  expect(classifyNetworkPoint(0,8,[roads[0]])).not.toBe(1);
  expect(classifyNetworkPoint(0,8,roads)).toBe(1);
  const group=buildNetworkChunk(options,0,0,roads);
  const walk=[2,3,4,5].flatMap(k=>cells(group,k));expect(walk.length).toBeGreaterThan(0);
  for(const p of walk)expect(Math.min(Math.abs(p.x),Math.abs(p.z))).toBeGreaterThan(20*.34375-.001);
 });
 it('preserves original widths, tapered widths, and bridge separation',()=>{
  const tapered={...street(0,0,100,0),widthStart:20,widthEnd:40};
  expect(classifyNetworkPoint(1,8,[tapered])).not.toBe(1);
  expect(classifyNetworkPoint(99,8,[tapered])).toBe(1);
  expect(classifyNetworkPoint(0,0,[street(-20,0,20,0,20,true)])).toBe(0);
 });
 it('widens pavement outward without moving the travel-lane boundary',()=>{
  const seg=street(-60,0,60,0,20);
  expect(classifyNetworkPoint(0,6.7,[seg])).toBe(1);
  expect(classifyNetworkPoint(0,7.2,[seg])).not.toBe(1);
  expect(classifyNetworkPoint(0,10.8,[seg])).not.toBe(0);
  expect(classifyNetworkPoint(0,roadSidewalkOuterHalfWidth(20)+.1,[seg])).toBe(0);
  expect(roadSidewalkExtra(20)).toBeCloseTo(1.5625);
  expect(roadSidewalkExtra(80)).toBe(2);
 });
 it('shares cell and terrain heights across streamed chunk boundaries',()=>{
  const long=street(-100,20,100,20),opts={...options,streets:[long]},left=buildNetworkChunk(opts,-1,0,[long]),right=buildNetworkChunk(opts,0,0,[long]);
  const nearEdge=(g:THREE.Group,which:number)=>{
   const mesh=g.getObjectByName('RoadKit_network_surface_1') as THREE.Mesh,p=mesh.geometry.getAttribute('position'),result=new Map<string,number>();
   for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-which)<.0001)result.set(p.getZ(i).toFixed(3),p.getY(i));
   return result;
  };
  const a=nearEdge(left,0),b=nearEdge(right,0);expect(a.size).toBeGreaterThan(0);
  for(const [z,y] of a)expect(b.get(z)).toBeCloseTo(y,5);
 });
 it('streams from existing streets without changing their metadata or adding bridge surfaces',()=>{
  const bridge=street(0,-80,0,80,20,true),streets=[roads[0],bridge],before=JSON.stringify(streets),stream=createRoadKitNetworkStreamer({...options,streets,radius:20});
  for(let i=0;i<12;i++)stream.update(0,0);
  expect(stream.group.children.length).toBeGreaterThan(0);expect(JSON.stringify(streets)).toBe(before);
  expect(classifyNetworkPoint(0,18,streets)).toBe(0);
 });
 it('suppresses painted approach lines inside junctions and emits lane lines outside them',()=>{
  const plans=planRoadKitJunctions({...options,junctions:[]}),opts={...options,plans};
  expect(plans.length).toBeGreaterThan(0);
  const chunk=buildNetworkChunk(opts,1,0,roads),line=chunk.getObjectByName('RoadKit_network_center') as THREE.Mesh;
  expect(line).toBeTruthy();const p=line.geometry.getAttribute('position');
  for(let i=0;i<p.count;i+=4){let x=0,z=0;for(let j=0;j<4;j++){x+=p.getX(i+j)/4;z+=p.getZ(i+j)/4}expect(Math.hypot(x,z)).toBeGreaterThanOrEqual(plans[0].radius+1.9)}
 });
 it('builds a chunk from the real Shanghai layout without changing its roads or bridges',()=>{
  registerActiveTownRoadLayouts3D([WORLD_TOWNS_3D[0]]);
  const layout=generateTownLayout(WORLD_TOWNS_3D[0]);
  const snapshot=JSON.stringify(layout.streets),seg=layout.streets.find(s=>!s.isBridge&&s.kind==='arterial')!;
  const cx=Math.floor(((seg.x1+seg.x2)/2)/(64*NETWORK_GRID)),cz=Math.floor(((seg.z1+seg.z2)/2)/(64*NETWORK_GRID));
  const size=64*NETWORK_GRID,x=cx*size,z=cz*size;
  const nearby=layout.streets.filter(s=>!s.isBridge&&Math.min(s.x1,s.x2)-s.width<=x+size&&Math.max(s.x1,s.x2)+s.width>=x&&Math.min(s.z1,s.z2)-s.width<=z+size&&Math.max(s.z1,s.z2)+s.width>=z);
  const opts={...options,streets:layout.streets,centerX:WORLD_TOWNS_3D[0].x,centerZ:WORLD_TOWNS_3D[0].z,water:WATER_LEVEL_3D,ground:getTerrainHeight3D};
  const group=buildNetworkChunk(opts,cx,cz,nearby);
  expect(group.getObjectByName('RoadKit_network_surface_1')).toBeTruthy();
  expect(JSON.stringify(layout.streets)).toBe(snapshot);
 });
 it('uses exactly the rendered triangle height for a character on uneven ground',()=>{
  const uneven=(x:number,z:number)=>2+Math.sin(x*.8)*.37+Math.cos(z*.7)*.42;
  const seg=street(-20,10,30,10),g=buildNetworkChunk({...options,ground:uneven,streets:[seg]},0,0,[seg]);
  const road=g.getObjectByName('RoadKit_network_surface_1') as THREE.Mesh;road.updateMatrixWorld(true);
  for(const [x,z] of [[2.18,9.71],[4.13,10.28],[11.7,12.1]]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));
   const hit=ray.intersectObject(road)[0];expect(hit).toBeTruthy();
   expect(hit.point.y).toBeCloseTo(roadSurfaceY(x,z,uneven,0),5);
   expect(roadSurfaceY(x,z,uneven,0)+ROAD_WALK_CLEARANCE).toBeGreaterThan(hit.point.y);
  }
  const edgeChunk=buildNetworkChunk({...options,ground:uneven,streets:[seg]},0,1,[seg]);
  expect(edgeChunk.getObjectByName('RoadKit_network_sides')).toBeTruthy();
 });
 it('uses that same surface for game walking in an ordinary registered town',()=>{
  const anchor=WORLD_TOWNS_3D[0];registerActiveTownRoadLayouts3D([anchor]);
  const seg=generateTownLayout(anchor).streets.find(s=>!s.isBridge&&s.kind==='street'&&Math.hypot((s.x1+s.x2)/2-anchor.x,(s.z1+s.z2)/2-anchor.z)<200)!;
  const x=(seg.x1+seg.x2)/2,z=(seg.z1+seg.z2)/2;
  expect(getWalkableSurfaceHeight3D(x,z)).toBeCloseTo(roadSurfaceY(x,z,getTerrainHeight3D,WATER_LEVEL_3D)+ROAD_WALK_CLEARANCE,5);
 });
 it('honors six and eight lanes for both long-road dividers and junction approaches',()=>{
  for(const lanes of [6,8] as const){
   const seg={...street(-80,10,80,10,20),kind:'arterial' as const,laneCount:lanes};
   const group=buildNetworkChunk({...options,streets:[seg]},0,0,[seg]);
   const mesh=group.getObjectByName('RoadKit_network_lines') as THREE.Mesh,p=mesh.geometry.getAttribute('position'),offsets=new Set<number>();
   for(let i=0;i<p.count;i+=4){let z=0;for(let j=0;j<4;j++)z+=p.getZ(i+j)/4;offsets.add(Math.round(z*100)/100)}
   expect(offsets.size).toBe(lanes); // two edge lines plus laneCount - 2 dividers
   const cross={...street(0,-80,0,80,40),laneCount:lanes};
   const plans=planRoadKitJunctions({...options,streets:[seg,cross],junctions:[]});
   expect(plans.some(plan=>plan.arms.some(arm=>arm.laneCount===lanes))).toBe(true);
  }
 });
 it('keeps walkways on the original ramp heights',()=>{
  const g=createRoadDeckWalkways([{x:0,z:0,y:4,halfWidth:10},{x:30,z:0,y:8,halfWidth:10}]);
  const pavement=g.getObjectByName('RoadKit_deck_pavement') as THREE.Mesh,p=pavement.geometry.getAttribute('position');
  expect(p.getY(0)).toBeCloseTo(4.02);expect(p.getY(2)).toBeCloseTo(8.02);
  expect(Math.abs(p.getZ(1))).toBeCloseTo(roadSidewalkOuterHalfWidth(20));
 });
 it('does not extend the ground pavement into the matching bridge',()=>{
  const approach=street(-80,0,0,0,40),bridge=street(0,0,60,0,40,true),cuts=buildBridgeApproachCuts([approach,bridge]);
  expect(classifyNetworkPoint(-1,16,[approach],false,cuts)).not.toBe(0);
  expect(classifyNetworkPoint(2,16,[approach],false,cuts)).toBe(0);
  expect(classifyNetworkPoint(2,16,[approach])).not.toBe(0);
 });
 it('matches the whole road width at bridge ends, even on sloped ground',()=>{
  const bridge=street(0,0,80,0,40,true),slope=(x:number,z:number)=>4+x*.01+z*.06;
  for(const z of [-16,-7,0,7,16]){
   expect(computeCityBridgeSurfaceWorldY3D(bridge,4,0,0,z,slope)).toBeCloseTo(roadSurfaceY(0,z,slope,0),5);
   expect(computeCityBridgeSurfaceWorldY3D(bridge,4,1,80,z,slope)).toBeCloseTo(roadSurfaceY(80,z,slope,0),5);
  }
 });
 it('keeps bridge tactile paving above its pavement with world-aligned texture phase',()=>{
  const g=createRoadDeckWalkways([{x:100,z:0,y:4,halfWidth:10,along:100},{x:130,z:0,y:5,halfWidth:10,along:130}]);
  const pavement=g.getObjectByName('RoadKit_deck_pavement') as THREE.Mesh,p=pavement.geometry.getAttribute('position');
  const tactile=g.getObjectByName('RoadKit_deck_tactile') as THREE.Mesh,t=tactile.geometry.getAttribute('position'),uv=tactile.geometry.getAttribute('uv');
  expect(t.getY(0)).toBeGreaterThan(p.getY(0));expect(uv.getX(0)).toBeCloseTo(100/.325,3);
  expect((tactile.material as THREE.Material).polygonOffsetFactor).toBeLessThan((pavement.material as THREE.Material).polygonOffsetFactor);
 });
 it('uses a bounded shared edge at a highway bend',()=>{
  const path:[number,number][]=[[0,0],[40,0],[70,20]],m=highwayJointMiter(path,1);
  expect(m[1]).toBeCloseTo(1,4);
  const tangent=[30/Math.hypot(30,20),20/Math.hypot(30,20)];
  expect(m[0]*(-tangent[1])+m[1]*tangent[0]).toBeCloseTo(1,4);
  expect(Math.hypot(...m)).toBeLessThanOrEqual(1.4);
  const first=createRoadDeckWalkways([{x:0,z:0,y:3,halfWidth:10},{x:40,z:0,y:4,halfWidth:10,nx:m[0],nz:m[1]}]);
  const second=createRoadDeckWalkways([{x:40,z:0,y:4,halfWidth:10,nx:m[0],nz:m[1]},{x:70,z:20,y:5,halfWidth:10}]);
  const a=(first.getObjectByName('RoadKit_deck_pavement') as THREE.Mesh).geometry.getAttribute('position'),b=(second.getObjectByName('RoadKit_deck_pavement') as THREE.Mesh).geometry.getAttribute('position');
  for(let i=0;i<2;i++){expect(a.getX(i+2)).toBeCloseTo(b.getX(i));expect(a.getY(i+2)).toBeCloseTo(b.getY(i));expect(a.getZ(i+2)).toBeCloseTo(b.getZ(i))}
 });
});
