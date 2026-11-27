import {describe,expect,it} from 'vitest';
import type {TownStreetSeg} from '../utils/townStreetGen';
import {createRoadRiverMask,splitRoadAtWater} from './roadWaterCrossing3D';
const road:TownStreetSeg={x1:-50,z1:0,x2:50,z2:0,width:32,widthStart:24,widthEnd:40,kind:'street'};
describe('road water crossing',()=>{
 it('detects a river away from the midpoint and connects the bridge to both approaches',()=>{
  const pieces=splitRoadAtWater(road,(x)=>Math.abs(x-25)-8);
  expect(pieces.map(p=>!!p.isBridge)).toEqual([false,true,false]);
  expect(pieces[0].x1).toBe(-50);expect(pieces[2].x2).toBe(50);
  expect(pieces[0].x2).toBeCloseTo(pieces[1].x1);expect(pieces[1].x2).toBeCloseTo(pieces[2].x1);
  expect(pieces[1].x1).toBeLessThan(17);expect(pieces[1].x2).toBeGreaterThan(33);
  expect(pieces[0].widthEnd).toBeCloseTo(pieces[1].widthStart!);
 });
 it('leaves dry roads and explicitly planned bridges unchanged',()=>{
  expect(splitRoadAtWater(road,()=>10)).toEqual([road]);
  const bridge={...road,isBridge:true,bridgeStyle:'nanpu' as const};expect(splitRoadAtWater(bridge,()=>-10)).toEqual([bridge]);
 });
 it('clips a road edge against curved river segments without masking dry banks',()=>{
  const inside=createRoadRiverMask([{width:10,points:[[-20,0],[0,0],[20,10]]}]);
  expect(inside(-10,0)).toBe(true);expect(inside(10,5)).toBe(true);
  expect(inside(-10,6)).toBe(false);expect(inside(100,100)).toBe(false);
 });
});
