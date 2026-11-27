import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createRenderedTerrainSampler } from './renderedTerrain3D';
import { ROAD_SURFACE_LIFT, roadSurfaceVertexY, roadSurfaceY, setRoadTerrainGrid } from './roadKitSurface';
import { buildNetworkChunk, createRoadKitNetworkStreamer } from './roadKitNetwork3D';
import { buildRoadKitDrains } from './roadKitDrains3D';
import { buildRoadContinuity } from './roadKitContinuity';
import type { TownStreetSeg } from '../utils/townStreetGen';

const ground=(x:number,z:number)=>4+Math.sin(x*.16)*1.3+Math.cos(z*.13)*.9;
const road:TownStreetSeg={x1:-20,z1:0,x2:100,z2:0,width:20,kind:'street'};

describe('road and displayed terrain alignment',()=>{
 it('keeps terrain and road heights aligned when the terrain window snaps',()=>{
  const geo=new THREE.PlaneGeometry(40,40,8,8);geo.rotateX(-Math.PI/2);
  const p=geo.getAttribute('position') as THREE.BufferAttribute,mesh=new THREE.Mesh(geo);
  const cleanup=setRoadTerrainGrid({originX:p.getX(0),originZ:p.getZ(0),stepX:p.getX(1)-p.getX(0),stepZ:p.getZ(9)-p.getZ(0)});
  const displayed=createRenderedTerrainSampler(p,mesh);
  try{
   for(const [sx,sz] of [[0,0],[15,-15]]){
    mesh.position.set(sx,0,sz);
    for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i)+sx,p.getZ(i)+sz));p.needsUpdate=true;
    for(const [x,z] of [[1.1,-3.1],[4.95,2.3],[9.7,3.8],[18.1,-1.2]]){
     const y=displayed(x,z);expect(y).toBeDefined();
     expect(roadSurfaceVertexY(x,z,ground,0)).toBeCloseTo(y!+ROAD_SURFACE_LIFT,5);
     expect(roadSurfaceY(x,z,ground,0)-y!).toBeGreaterThan(.12);
    }
   }
  }finally{cleanup()}
 });
 it('follows the actual 84- and 112-segment terrain grids across long-distance snaps',()=>{
  const quantized=(x:number,z:number)=>ground(Math.round(x*2)/2,Math.round(z*2)/2);
  for(const segments of [84,112]){
   const geo=new THREE.PlaneGeometry(544,544,segments,segments);geo.rotateX(-Math.PI/2);
   const p=geo.getAttribute('position') as THREE.BufferAttribute,mesh=new THREE.Mesh(geo),side=segments+1;
   const dx=p.getX(1)-p.getX(0),dz=p.getZ(side)-p.getZ(0),cleanup=setRoadTerrainGrid({originX:p.getX(0),originZ:p.getZ(0),stepX:dx,stepZ:dz});
   try{
    for(const [sx,sz] of [[0,0],[dx*3*67,-dz*3*41]]){
     mesh.position.set(sx,0,sz);for(let i=0;i<p.count;i++)p.setY(i,quantized(p.getX(i)+sx,p.getZ(i)+sz));p.needsUpdate=true;
     const displayed=createRenderedTerrainSampler(p,mesh);
     for(const [ox,oz] of [[.3,-1.6],[8.1,9.3],[-43.2,32.4],[121.5,-116.9]]){
      const x=sx+ox,z=sz+oz,y=displayed(x,z);expect(y).toBeDefined();
      expect(Math.abs(roadSurfaceVertexY(x,z,quantized,0)-y!-ROAD_SURFACE_LIFT)).toBeLessThan(.015);
     }
    }
   }finally{cleanup()}
  }
 });
 it('places lane lines and drains just above the same sloped road surface',()=>{
  const cleanup=setRoadTerrainGrid({originX:-20,originZ:-20,stepX:5,stepZ:5});
  try{
   const opts={streets:[road],plans:[],centerX:0,centerZ:0,baseY:0,water:0,ground,manholeSpacing:0};
   const chunk=buildNetworkChunk(opts,1,0,[road]),line=chunk.getObjectByName('RoadKit_network_center') as THREE.Mesh;
   const points=line.geometry.getAttribute('position');expect(points.count).toBeGreaterThan(0);
   for(let i=0;i<Math.min(points.count,32);i++)expect(points.getY(i)).toBeCloseTo(roadSurfaceY(points.getX(i),points.getZ(i),ground,0)+.02,5);
   const drains=buildRoadKitDrains({...opts,joins:buildRoadContinuity([road]),cuts:new Map(),spacing:35});
   const drain=drains.getObjectByName('RoadKit_drain_bases') as THREE.Mesh,p=drain.geometry.getAttribute('position');expect(p.count).toBeGreaterThan(0);
   for(let i=0;i<Math.min(p.count,16);i++)expect(p.getY(i)).toBeCloseTo(roadSurfaceY(p.getX(i),p.getZ(i),ground,0)+.018,5);
  }finally{cleanup()}
 });
 it('rebuilds streamed roads with the new terrain and town origin after a height update',()=>{
  let height=1;const getGround=()=>height;
  const stream=createRoadKitNetworkStreamer({streets:[road],plans:[],centerX:0,centerZ:0,baseY:0,water:0,ground:getGround,radius:5,manholeSpacing:0});
  stream.update(0,0);
  const before=stream.group.getObjectByName('RoadKit_network_surface_1') as THREE.Mesh;
  expect(before).toBeTruthy();expect(before.geometry.getAttribute('position').getY(0)).toBeCloseTo(1+ROAD_SURFACE_LIFT);
  height=3;stream.refreshTerrain(2);expect(stream.group.children).toHaveLength(0);stream.update(0,0);
  const after=stream.group.getObjectByName('RoadKit_network_surface_1') as THREE.Mesh;
  expect(after).toBeTruthy();expect(after).not.toBe(before);
  expect(after.geometry.getAttribute('position').getY(0)+2).toBeCloseTo(3+ROAD_SURFACE_LIFT);
 });
});
