import * as THREE from 'three';
import { buildUnifiedWalkInBuilding3D, type WalkInBuildingKind } from '../../../src/utils/architecturalBuildings3D';
import { getGroundTex } from '../../../src/world3d/townGroundTextures';
import { buildModernCbdOfficeTower3D } from '../../../src/world3d/cbdCurtainWall3D';
import { buildVilla3D } from '../../../src/world3d/villa3D';

/** The actual game generators, arranged as a small walkable comparison street. */
export function buildArchitectureShowcase(): THREE.Group {
 const group=new THREE.Group(),tex=getGroundTex();
 group.userData.demoDoors=[];group.userData.demoInteractables=[];group.userData.demoNpcs=[];
 const ground=new THREE.Mesh(new THREE.BoxGeometry(260,.24,100),new THREE.MeshLambertMaterial({color:0xb8c1b9}));ground.position.set(0,-.12,0);group.add(ground);
 const shops:{kind:WalkInBuildingKind;x:number;name:string}[]=[{kind:'restaurant',x:-92,name:'饭店'},{kind:'poke_mart',x:-45,name:'商店'},{kind:'hotel',x:2,name:'酒店'}];
 for(const s of shops){const built=buildUnifiedWalkInBuilding3D({kind:s.kind,interiorId:`demo-${s.kind}`,townName:'Demo',lotX:s.x,lotZ:0,localX:s.x,localY:0,localZ:0,baseWorldY:0,rotY:0,width:40,depth:32,floorTex:tex.woodFloor,woodFloorTex:tex.woodFloor,signTex:s.kind==='restaurant'?tex.cafeSign:s.kind==='hotel'?tex.hotelSign:tex.martSign});built.shellGroup.name=s.name;group.add(built.shellGroup);group.userData.demoDoors.push(...built.autoDoors);group.userData.demoInteractables.push(...built.interactPoints);group.userData.demoNpcs.push(...built.npcs)}
 const villa=buildVilla3D(32,30,1);villa.group.position.x=46;villa.group.name='别墅';group.add(villa.group);
 const tower=buildModernCbdOfficeTower3D({width:35,depth:32,shape:'cylinder',isSupertall:true,variant:2});tower.group.position.x=94;tower.group.name='摩天大楼';group.add(tower.group);
 return group;
}
