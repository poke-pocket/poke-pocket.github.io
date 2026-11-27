import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { foundationWeight, gradeFoundationHeight, planBuildingFoundation, type FoundationLot } from './buildingFoundation3D';
import { createBuildingFoundationFloor } from './buildingFoundationVisual3D';
import { buildUrbanRegion, urbanGroundWeight } from './urbanGround3D';
import { createSculptedTerrainMaterial, syncUrbanTerrainUniforms3D } from '../data/textures3d/terrainShader3D';
import type { BiomeTextureSet } from '../data/textures3d/biomePalettesAndWater';
import { getBuildingFoundationPlan3D, getTerrainBeforeFoundation3D, getTerrainHeight3D, registerActiveTownRoadLayouts3D, WORLD_TOWNS_3D } from '../data/survivorsTactics';
import { generateTownLayout } from '../utils/townStreetGen';

const lot:FoundationLot={id:'test',x:0,z:0,width:40,depth:40,rotY:0};

describe('building terrain grading',()=>{
 it('levels flat land and ignores an isolated high point',()=>{
  const flat=planBuildingFoundation(lot,()=>4);expect(flat.mode).toBe('level');expect(flat.target).toBe(4);
  const spike=planBuildingFoundation(lot,(x,z)=>x>19&&z>19?12:4);
  expect(spike.mode).toBe('level');expect(spike.target).toBe(4);
 });
 it('chooses the higher platform for a broad connected slope',()=>{
  const plan=planBuildingFoundation(lot,(x)=>5+x*.12);
  expect(plan.mode).toBe('raised');expect(plan.slope).toBeGreaterThan(.025);
  expect(plan.highFraction).toBeGreaterThanOrEqual(.24);expect(plan.connectedFraction).toBeGreaterThanOrEqual(.6);
  expect(plan.target).toBeGreaterThan(5);
  const inner=lot.width*.5+plan.padding,mid=inner+plan.transition*.5;
  expect(foundationWeight(plan,inner,0)).toBeCloseTo(1);
  expect(foundationWeight(plan,mid,0)).toBeCloseTo(.5);
  expect(foundationWeight(plan,inner+plan.transition,0)).toBeCloseTo(0);
  expect(gradeFoundationHeight(1,mid,0,[plan])).toBeGreaterThan(1);
  expect(gradeFoundationHeight(1,mid,0,[plan],0)).toBe(1);
 });
 it('considers a high area that continues beyond the building footprint',()=>{
  const plan=planBuildingFoundation(lot,x=>x>=20?8:5);
  expect(plan.footprintHighFraction).toBeCloseTo(.2);
  expect(plan.highFraction).toBeGreaterThan(.24);
  expect(plan.mode).toBe('raised');expect(plan.target).toBeGreaterThan(5);
 });
 it('does not mistake scattered high cells for a usable high plateau and accepts explicit overrides',()=>{
  const checker=planBuildingFoundation(lot,(x,z)=>(Math.round((x+20)/10)+Math.round((z+20)/10))%2?10:2);
  expect(checker.highFraction).toBeGreaterThan(.24);expect(checker.connectedFraction).toBeLessThan(.6);expect(checker.mode).toBe('level');
  const forced=planBuildingFoundation({...lot,foundation:{mode:'raised',targetHeight:9,transition:20}},()=>4);
  expect(forced.mode).toBe('raised');expect(forced.target).toBe(9);expect(forced.transition).toBe(20);
 });
 it('registers real city lots against the same heightfield used for placement',()=>{
  const town=WORLD_TOWNS_3D[0],layout=generateTownLayout(town);registerActiveTownRoadLayouts3D([town]);
  const matches=layout.lots.filter(l=>{const p=getBuildingFoundationPlan3D(l.id);return !!p&&Math.abs(getTerrainHeight3D(l.x,l.z)-p.target)<.1});
  expect(matches.length).toBeGreaterThan(layout.lots.length*.7);
  expect(registerActiveTownRoadLayouts3D([town])).toBe(false);
 });
 it('does not alter existing city road centerlines while grading nearby lots',()=>{
  const town=WORLD_TOWNS_3D[0],layout=generateTownLayout(town);registerActiveTownRoadLayouts3D([town]);let checked=0;
  for(const seg of layout.streets){if(seg.isBridge||seg.kind==='rail')continue;
   const x=Math.round((seg.x1+seg.x2))*.5,z=Math.round((seg.z1+seg.z2))*.5;
   expect(getTerrainHeight3D(x,z)).toBeCloseTo(getTerrainBeforeFoundation3D(x,z),4);
   if(++checked>=20)break;
  }
  expect(checked).toBe(20);
 });
 it('adds a floor that follows the building footprint and orientation',()=>{
  const rect={...lot,kind:'house' as const,houseVariant:0,doorX:0,doorZ:0,rotY:Math.PI/4};
  const floor=createBuildingFoundationFloor(rect,3,5,7);
  expect(floor.name).toBe('Building_foundation_floor');expect(floor.position.y).toBeCloseTo(5.055);expect(floor.rotation.y).toBeCloseTo(Math.PI/4);
  const triangle=createBuildingFoundationFloor({...rect,shape:'triangle'},0,0,0);
  triangle.geometry.computeBoundingBox();expect(triangle.geometry.boundingBox!.max.x).toBeCloseTo(rect.width*.465);
 });
});

describe('urban ground transition',()=>{
 it('covers the built area, fades outward and keeps parks green',()=>{
  const region=buildUrbanRegion({centerX:0,centerZ:0,lots:[{x:100,z:0},{x:160,z:0}],parks:[{x:30,z:0,w:20,d:20}]},100);
  expect(urbanGroundWeight([region],0,0)).toBe(1);
  expect(urbanGroundWeight([region],30,0)).toBe(0);
  expect(urbanGroundWeight([region],region.outerRadius+1,0)).toBe(0);
  expect(urbanGroundWeight([region],(region.innerRadius+region.outerRadius)*.5,0)).toBeCloseTo(.5);
 });
 it('passes city and park regions to the terrain shader',()=>{
  const tex=new THREE.Texture(),set={ground:tex,cliff:tex,road:tex} as BiomeTextureSet;
  const mat=createSculptedTerrainMaterial('verdant_forest',set,100);
  const region=buildUrbanRegion({centerX:20,centerZ:30,lots:[{x:120,z:30}],parks:[{x:40,z:50,w:20,d:30}]},100);
  syncUrbanTerrainUniforms3D(mat,[region],0,0);
  expect(mat.uniforms.uUrbanZones.value[0].toArray()).toEqual([20,30,region.innerRadius,region.outerRadius]);
  expect(mat.uniforms.uUrbanParks.value[0].toArray()).toEqual([40,50,10,15]);
  expect(mat.fragmentShader).toContain('uUrbanZones');
 });
});
