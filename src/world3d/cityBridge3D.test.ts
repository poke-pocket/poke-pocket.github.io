import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {buildModernCityBridge3D} from './interTownNetwork3D';
import {roadSidewalkOuterHalfWidth} from './roadKitDimensions';
import type {TownStreetSeg} from '../utils/townStreetGen';

function build(){
 const seg:TownStreetSeg={x1:0,z1:0,x2:80,z2:0,width:40,kind:'arterial',laneCount:4,isBridge:true};
 const group=new THREE.Group();
 buildModernCityBridge3D({seg,centerX:0,centerZ:0,baseY:4,group,colliders:[],deckRoadTex:new THREE.Texture() as THREE.CanvasTexture,getGroundHeight:()=>4});
 return {group,seg};
}
describe('city bridge surface and lighting',()=>{
 it('keeps the girder below the road and gives the sidewalk a separate surface',()=>{
  const {group,seg}=build(),road=group.getObjectByName('RoadKit_bridge_asphalt') as THREE.Mesh,girder=group.getObjectByName('RoadKit_bridge_girder') as THREE.Mesh;
  const rp=road.geometry.getAttribute('position'),gp=girder.geometry.getAttribute('position'),gi=girder.geometry.getIndex()!;
  for(let i=0;i<rp.count;i++)expect(Math.abs(rp.getZ(i))).toBeCloseTo(seg.width*.34375,4);
  // For flat endpoints the girder consists of side/bottom faces, never a
  // coplanar top face spanning across the visible road or sidewalk.
  for(let i=0;i<gi.count;i+=3){const ids=[gi.getX(i),gi.getX(i+1),gi.getX(i+2)];expect(ids.every(id=>id%4===1||id%4===2)).toBe(false)}
  expect(gp.count).toBeGreaterThan(0);expect(group.getObjectByName('RoadKit_deck_pavement')).toBeTruthy();expect(group.getObjectByName('RoadKit_deck_tactile')).toBeTruthy();
 });
 it('places lamps beside the carriageway, aimed at it, with glow on the lamp head',()=>{
  const {group,seg}=build(),lamps=group.children.filter(o=>o.name==='RoadKit_streetlight'),halos=group.children.filter(o=>o.name==='RoadKit_bridge_lamp_halo'),pools=group.children.filter(o=>o.name==='RoadKit_bridge_lamp_pool');
  expect(lamps).toHaveLength(6);expect(halos).toHaveLength(6);expect(pools).toHaveLength(6);
  for(const lamp of lamps){
   expect(Math.abs(lamp.position.z)).toBeCloseTo(seg.width*.34375+.8);
   expect(Math.abs(lamp.position.z)).toBeLessThan(roadSidewalkOuterHalfWidth(seg.width)-1);
   expect(Math.cos(lamp.rotation.y)*lamp.position.z).toBeLessThan(0);
   const hx=lamp.position.x+Math.sin(lamp.rotation.y)*2.1,hz=lamp.position.z+Math.cos(lamp.rotation.y)*2.1;
   expect(halos.some(h=>Math.hypot(h.position.x-hx,h.position.z-hz)<.001&&Math.abs(h.position.y-lamp.position.y-7.94)<.001)).toBe(true);
  }
 });
});
