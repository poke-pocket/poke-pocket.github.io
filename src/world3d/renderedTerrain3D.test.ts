import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createRenderedTerrainSampler, setRenderedTerrainSampler } from './renderedTerrain3D';
import { generateTownLayout } from '../utils/townStreetGen';
import { getWalkableSurfaceHeight3D, registerActiveTownRoadLayouts3D, WORLD_TOWNS_3D } from '../data/survivorsTactics';
import { ROAD_WALK_CLEARANCE } from './roadKitSurface';

describe('rendered terrain and character ground height',()=>{
 it('samples the actual rendered triangle at either side of its diagonal',()=>{
  const geo=new THREE.PlaneGeometry(8,8,2,2);geo.rotateX(-Math.PI/2);
  const p=geo.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<p.count;i++)p.setY(i,Math.sin(i*1.37)*3);
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.set(48,3,-32);mesh.updateMatrixWorld(true);
  const sample=createRenderedTerrainSampler(p,mesh);p.needsUpdate=true;
  for(const [x,z] of [[44.4,-35.6],[46.9,-33.2],[48.2,-31.7],[51.1,-28.9]]){
   const hit=new THREE.Raycaster(new THREE.Vector3(x,50,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
   expect(hit).toBeTruthy();expect(sample(x,z)).toBeCloseTo(hit.point.y,5);
  }
  expect(sample(90,90)).toBeUndefined();
 });
 it('keeps the shared player, follower and NPC ground height above visible city terrain',()=>{
  const town=WORLD_TOWNS_3D[0];registerActiveTownRoadLayouts3D([town]);
  const seg=generateTownLayout(town).streets.find(s=>!s.isBridge&&s.kind==='street'&&Math.hypot((s.x1+s.x2)/2-town.x,(s.z1+s.z2)/2-town.z)<200)!;
  const x=(seg.x1+seg.x2)/2,z=(seg.z1+seg.z2)/2,original=getWalkableSurfaceHeight3D(x,z),visible=original+1.25;
  const dispose=setRenderedTerrainSampler(()=>visible);
  try{expect(getWalkableSurfaceHeight3D(x,z,original)).toBeCloseTo(visible+ROAD_WALK_CLEARANCE,5)}finally{dispose()}
  expect(getWalkableSurfaceHeight3D(x,z)).toBeCloseTo(original,5);
 });
});
