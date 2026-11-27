import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { generateTownLayout, type TownStreetSeg } from '../utils/townStreetGen';
import { WORLD_TOWNS_3D } from '../data/survivorsTactics';
import { buildRoadContinuity } from './roadKitContinuity';
import { getDetailedTactileMaterial, getManholeMaterial } from './roadKitDetails3D';
import { buildRoadKitManholes } from './roadKitManholes3D';
import { buildNetworkChunk } from './roadKitNetwork3D';
import { createRoadDeckWalkways } from './roadKitElevated3D';
import { planRoadKitJunctions } from './roadModelStyle3D';

const road=(x1:number,z1:number,x2:number,z2:number):TownStreetSeg=>({x1,z1,x2,z2,width:20,kind:'street'});
const opts={centerX:0,centerZ:0,baseY:0,water:0,ground:()=>1};

describe('sidewalk and road surface details',()=>{
 it('uses a fine directional tactile texture on flat and elevated paths',()=>{
  const material=getDetailedTactileMaterial(),map=material.map as THREE.DataTexture,data=map.image.data!;
  expect(map.image.width).toBe(64);expect(map.magFilter).toBe(THREE.NearestFilter);
  const colors=new Set<number>();for(let y=4;y<60;y++)colors.add(data[(y*64+32)*4]);expect(colors.size).toBeGreaterThan(3);
  const h=road(-80,5,80,5),v=road(5,-80,5,80);
  for(const seg of [h,v]){
   const g=buildNetworkChunk({...opts,streets:[seg],plans:[],manholeSpacing:0},0,0,[seg]);
   const mesh=(g.getObjectByName('RoadKit_network_surface_4')??g.getObjectByName('RoadKit_network_surface_5')) as THREE.Mesh;
   const pos=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');expect(uv.count).toBe(pos.count);
   const duX=Math.abs(uv.getX(1)-uv.getX(0)),duZ=Math.abs(uv.getX(3)-uv.getX(0));
   if(seg===h)expect(duX).toBeGreaterThan(duZ+0.5);else expect(duZ).toBeGreaterThan(duX+0.5);
  }
  const deck=createRoadDeckWalkways([{x:0,z:0,y:2,halfWidth:10},{x:20,z:0,y:3,halfWidth:10}]);
  const mesh=deck.getObjectByName('RoadKit_deck_tactile') as THREE.Mesh;
  expect(mesh.material).toBe(material);expect(mesh.geometry.getAttribute('uv').count).toBe(mesh.geometry.getAttribute('position').count);
 });
 it('places separate patterned manhole covers at the requested spacing and avoids junctions',()=>{
  const a=road(0,0,70,0),b=road(70,0,140,0),streets=[a,b],joins=buildRoadContinuity(streets);
  const settings={...opts,streets,joins,spacing:40,style:'shanghai' as const,within:()=>true,avoid:(x:number)=>Math.abs(x-60)<3};
  const group=buildRoadKitManholes(settings),mesh=group.getObjectByName('RoadKit_manhole_shanghai') as THREE.Mesh;
  const centers=mesh.userData.centers as {x:number;z:number}[];
  expect(centers.map(c=>Math.round(c.x))).toEqual([20,100]);
  expect(centers.every(c=>Math.abs(c.z)<20*.34375)).toBe(true);
  expect(mesh.userData.spacing).toBe(40);expect(mesh.material).toBe(getManholeMaterial('shanghai'));
  expect(buildRoadKitManholes({...settings,spacing:0}).children).toHaveLength(0);
  expect(getManholeMaterial('shanghai')).not.toBe(getManholeMaterial('shenzhen'));
  const coverMap=getManholeMaterial('shanghai').map as THREE.DataTexture;
  expect(coverMap.image.data![3]).toBe(0);expect(coverMap.image.data![(32*64+32)*4+3]).toBe(255);
  const single=road(0,0,140,0),chunk=buildNetworkChunk({...opts,streets:[single],plans:[],joins:buildRoadContinuity([single]),manholeStyle:'shenzhen',manholeSpacing:40},0,0,[single]);
  const actual=chunk.getObjectByName('RoadKit_manhole_shenzhen') as THREE.Mesh;
  expect(actual).toBeTruthy();expect(actual.geometry.getAttribute('position').count).toBe(81);
 });
 it('places covers on the real city network outside its junctions',()=>{
  const town=WORLD_TOWNS_3D[0],layout=generateTownLayout(town),ground=()=>2;
  const plans=planRoadKitJunctions({streets:layout.streets,junctions:layout.junctions,centerX:town.x,centerZ:town.z,water:0,ground});
  const group=buildRoadKitManholes({streets:layout.streets,joins:buildRoadContinuity(layout.streets),centerX:town.x,centerZ:town.z,baseY:0,water:0,ground,spacing:65,style:'shanghai',within:(x,z)=>Math.hypot(x-town.x,z-town.z)<500,avoid:(x,z)=>plans.some(p=>Math.hypot(x-p.node.x,z-p.node.z)<p.radius+9)});
  const mesh=group.getObjectByName('RoadKit_manhole_shanghai') as THREE.Mesh;
  expect(mesh).toBeTruthy();expect(mesh.userData.centers.length).toBeGreaterThan(0);
 });
});
