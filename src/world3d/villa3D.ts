import * as THREE from 'three';

/** A detached suburban house. Dimensions are local to the lot; the game supplies collision. */
export function buildVilla3D(width:number, depth:number, variant:number): {group:THREE.Group;totalHeight:number} {
  const group=new THREE.Group();
  const w=width*.84,d=depth*.82,h=10.8;
  const wall=new THREE.MeshLambertMaterial({color:variant%2?0xe3dbca:0xdce4e0});
  const roof=new THREE.MeshLambertMaterial({color:variant%2?0x704c41:0x455761});
  const frame=new THREE.MeshLambertMaterial({color:0x333c42});
  const glass=new THREE.MeshLambertMaterial({color:0x8db7be,transparent:true,opacity:.65,depthWrite:false});
  const wood=new THREE.MeshLambertMaterial({color:0x80624d});
  const box=(x:number,y:number,z:number,bw:number,bh:number,bd:number,mat:THREE.Material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m};
  box(0,h*.5,0,w,h,d,wall);
  // Two pitched roof planes and a projecting porch distinguish the silhouette.
  const rise=3.1, slope=Math.hypot(d*.5,rise),angle=Math.atan2(rise,d*.5);
  for(const side of [-1,1]){const slab=box(0,h+rise*.5,side*d*.25,w+1.5,.5,slope+.6,roof);slab.rotation.x=side*angle}
  box(-w*.22,5.5,d*.5+1,w*.38,.38,2.8,roof);
  for(const x of [-w*.37,-w*.07])box(x,2.7,d*.5+2,.25,5.4,.25,wood);
  box(-w*.22,2.55,d*.5+.08,2.4,5.1,.18,wood);
  const panes=(y:number,z:number)=>{for(const x of [-w*.30,0,w*.30]){if(y<5&&x<0)continue;box(x,y,z,w*.19,2.4,.16,frame);box(x,y,z+.10,w*.19-.24,2.16,.08,glass);box(x,y,z+.16,.1,2.2,.09,frame);box(x,y-.04,z+.16,w*.19,.1,.09,frame)}};
  panes(3,d*.5+.08);panes(8,d*.5+.08);
  box(w*.23,5.85,d*.5+1.1,w*.32,.3,2.1,roof);
  for(const x of [w*.08,w*.38])box(x,6.45,d*.5+2.05,.12,1.2,.12,frame);
  box(w*.23,7.05,d*.5+2.05,w*.31,.12,.12,frame);
  return {group,totalHeight:h+rise+.5};
}
