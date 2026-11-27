import { describe, expect, it } from 'vitest';
import { WORLD_TOWNS_3D } from '../data/survivorsTactics';
import { generateTownLayout } from '../utils/townStreetGen';
import { CITY_BUS_HEIGHT, CITY_BUS_LENGTH, CITY_BUS_WIDTH, createCityBusCollider } from './roadKitBusDimensions';
import { roadLaneCount } from './roadModelStyle3D';
import { resolveTownWallCollisions } from './townTypes';
import { outerLaneCenterOffset, previewRoadRibbonWidth, roadEdgeLineOffset } from './roadKitDimensions';

describe('preview road and bus integration',()=>{
 it('keeps the preview lane width for 2, 4, 6 and 8 lanes',()=>{
  for(const town of WORLD_TOWNS_3D.slice(0,3))for(const road of generateTownLayout(town).streets){
   if(road.kind==='alley'||road.kind==='rail')continue;
   expect(road.width*.6875/roadLaneCount(road)).toBeGreaterThanOrEqual(8.775-1e-6);
  }
 });
 it('puts city hub buses on a carriageway with a separate adjacent shelter',()=>{
  for(const town of WORLD_TOWNS_3D.slice(0,3)){
   const layout=generateTownLayout(town),stop=layout.busStops.find(b=>b.id==='bus_hub')!;
   const matching=layout.streets.some(s=>{
    if(s.isBridge||s.kind==='alley')return false;
    const dx=s.x2-s.x1,dz=s.z2-s.z1,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((stop.busX-s.x1)*dx+(stop.busZ-s.z1)*dz)/l2));
    const dist=Math.hypot(stop.busX-s.x1-dx*t,stop.busZ-s.z1-dz*t);
    const width=(s.widthStart??s.width)+((s.widthEnd??s.width)-(s.widthStart??s.width))*t;
    return Math.abs(dist-outerLaneCenterOffset(width,roadLaneCount(s)))<.2;
   });
   expect(matching,town.id).toBe(true);
   expect(Math.hypot(stop.busX-stop.shelterX,stop.busZ-stop.shelterZ)).toBeGreaterThan(CITY_BUS_WIDTH*.5+1.4);
  }
 });
 it('fits between the outer line and the next divider for every supported lane count',()=>{
  for(const lanes of [2,4,6,8]){
   const width=previewRoadRibbonWidth(0,lanes),center=outerLaneCenterOffset(width,lanes);
   const inner=width*.34375-width*.6875/lanes;
   expect(center-CITY_BUS_WIDTH*.5-inner).toBeGreaterThan(.5);
   expect(roadEdgeLineOffset(width)-(center+CITY_BUS_WIDTH*.5)).toBeGreaterThan(.5);
  }
 });
 it('blocks walking through the full rotated bus but allows passing above it',()=>{
  const collider=createCityBusCollider(10,20,Math.PI/3,5);
  expect(collider.halfD).toBeCloseTo(CITY_BUS_LENGTH*.5);
  const atBus={x:10,z:20};resolveTownWallCollisions(atBus,.88,[collider],5);
  expect(Math.hypot(atBus.x-10,atBus.z-20)).toBeGreaterThan(CITY_BUS_WIDTH*.5);
  const above={x:10,z:20};resolveTownWallCollisions(above,.88,[collider],5+CITY_BUS_HEIGHT+2);
  expect(above).toEqual({x:10,z:20});
 });
});
