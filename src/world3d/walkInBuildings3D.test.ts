import {describe,expect,it} from 'vitest';
import type * as THREE from 'three';
import {getWalkInStoreyDimensions} from '../utils/architecturalBuildings3D';
import {entranceFacingRelative} from '../components/arena3d/arenaNpcFacing3D';
import {sampleHumanWalkFrame} from '../data/textures3d/characterSprites3D';

describe('walk-in building proportions and host direction',()=>{
 it('gives all walk-in buildings the same per-storey height and retains their floor counts',()=>{
  for(const kind of ['house','pokemon_center','hotel','poke_mart','restaurant'] as const){const d=getWalkInStoreyDimensions(kind);expect(d.first).toBe(7.5);expect(d.second).toBe(d.stories===2?7.5:0);expect(d.entryDoor).toBeGreaterThan(2.52);expect(d.entryDoor).toBeLessThan(d.first);expect(d.rearDoor).toBeLessThan(d.first)}
  expect(getWalkInStoreyDimensions('house').stories).toBe(2);
  expect(getWalkInStoreyDimensions('restaurant').stories).toBe(1);
 });
 it('faces the entrance for buildings rotated in any direction',()=>{
  const frames=Object.fromEntries(['down','up','left','right'].flatMap(dir=>[[`${dir}_idle0`,dir],[`${dir}_idle1`,dir]])) as unknown as Record<string,THREE.CanvasTexture>;
  for(const rot of [0,Math.PI/2,Math.PI,-Math.PI/2]){
   const fx=Math.sin(rot),fz=Math.cos(rot);
   const [forward,right]=entranceFacingRelative(rot,-fx,-fz,fz,-fx);
   expect(sampleHumanWalkFrame(frames,forward,right,0,false)).toBe('down');
  }
 });
});
