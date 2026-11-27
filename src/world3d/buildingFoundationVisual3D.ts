import * as THREE from 'three';
import type { TownBuildingLot } from '../utils/townStreetGen';

const foundationConcrete=new THREE.MeshLambertMaterial({color:0x6b7370,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
foundationConcrete.onBeforeCompile=(shader)=>{
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 foundationWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nfoundationWorld=(modelMatrix*vec4(position,1.0)).xyz;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 foundationWorld;\nfloat foundationHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}').replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=foundationHash(floor(foundationWorld.xz/.08));\nfloat tone=foundationHash(floor(foundationWorld.xz/.28));\ndiffuseColor.rgb*=.95+grain*.045+tone*.045;');
};
foundationConcrete.customProgramCacheKey=()=> 'foundation-concrete-grain-v1';

/** A ground floor under hollow voxel façades, following the building footprint. */
export function createBuildingFoundationFloor(lot:TownBuildingLot,localX:number,localY:number,localZ:number):THREE.Mesh{
 const hw=lot.width*.465,hd=lot.depth*.465;
 let geometry:THREE.BufferGeometry;
 if(lot.shape==='cylinder'){
  geometry=new THREE.CircleGeometry(1,32);geometry.scale(hw,hd,1);
 }else if(lot.shape==='triangle'){
  const s=new THREE.Shape();s.moveTo(-hw,hd);s.lineTo(hw,hd);s.lineTo(hw*.32,-hd);s.lineTo(-hw*.32,-hd);s.closePath();geometry=new THREE.ShapeGeometry(s);
 }else geometry=new THREE.PlaneGeometry(hw*2,hd*2);
 const floor=new THREE.Mesh(geometry,foundationConcrete);floor.name='Building_foundation_floor';
 floor.rotation.order='YXZ';floor.rotation.set(-Math.PI/2,lot.rotY,0,'YXZ');floor.position.set(localX,localY+.055,localZ);floor.receiveShadow=true;floor.userData.lotId=lot.id;
 return floor;
}
