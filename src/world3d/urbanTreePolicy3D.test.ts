import {describe,expect,it} from 'vitest';
import {buildUrbanRegion,isUrbanWildTreeExcluded,urbanGroundWeight} from './urbanGround3D';
import {buildRoadContinuity,roadsidePlantingStations} from './roadKitContinuity';
import type {TownStreetSeg} from '../utils/townStreetGen';

describe('planned city greenery',()=>{
 it('excludes wild trees across the whole city, including parks and outlying lots',()=>{
  const region=buildUrbanRegion({centerX:0,centerZ:0,lots:[{x:20,z:0},{x:40,z:0},{x:400,z:0}],parks:[{x:30,z:0,w:20,d:20}]},60);
  expect(urbanGroundWeight([region],30,0)).toBe(0);
  expect(isUrbanWildTreeExcluded([region],30,0)).toBe(true);
  expect(isUrbanWildTreeExcluded([region],400,0)).toBe(true);
  expect(isUrbanWildTreeExcluded([region],region.treeExclusionRadius+1,0)).toBe(false);
 });
 it('keeps fixed planting intervals through joined road segments without duplicate join points',()=>{
  const a:TownStreetSeg={x1:0,z1:0,x2:38,z2:0,width:32,kind:'arterial'};
  const b:TownStreetSeg={...a,x1:38,x2:90};
  const joins=buildRoadContinuity([a,b]);
  const positions=[...roadsidePlantingStations(38,19,joins.get(a)).map(s=>s.distance),...roadsidePlantingStations(52,19,joins.get(b)).map(s=>38+s.distance)];
  expect(positions).toEqual([0,19,38,57,76]);
 });
});
