import * as THREE from 'three';

export type ManholeStyle='plain'|'shanghai'|'shenzhen';
let tactile:THREE.MeshLambertMaterial|undefined;
const covers=new Map<ManholeStyle,THREE.MeshLambertMaterial>();
function texture(size:number,pixel:(x:number,y:number)=>[number,number,number,number]):THREE.DataTexture{
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const c=pixel(x,y),i=(y*size+x)*4;data.set(c,i)}
 const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.needsUpdate=true;return tex;
}
/** Fine pixel texture: six longitudinal ridges and individual tile seams. */
export function getDetailedTactileMaterial():THREE.MeshLambertMaterial{
 if(tactile)return tactile;
 const map=texture(64,(x,y)=>{
  const seam=x<2||x>61||y<1||y>62,slot=(y*6)%64,ridge=slot>=10&&slot<38&&x>4&&x<59;
  const shade=seam?-25:ridge?(slot<16?24:slot>31?5:15):0;
  const grain=((x*17+y*29+x*y)%19===0)?-6:((x*7+y*11)%37===0?5:0);
  return [Math.max(0,190+shade+grain),Math.max(0,169+shade+grain),Math.max(0,100+shade+grain),255];
 });
 tactile=new THREE.MeshLambertMaterial({map,color:0xffffff,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6});tactile.name='RoadKit_tactile_detailed';return tactile;
}
/** Pixel-art cast-iron covers. City styles are abstract patterns, not official emblems. */
export function getManholeMaterial(style:ManholeStyle):THREE.MeshLambertMaterial{
 const old=covers.get(style);if(old)return old;
 const map=texture(64,(x,y)=>{
  const dx=x-31.5,dy=y-31.5,r=Math.hypot(dx,dy);if(r>29)return [0,0,0,0];
  let value=r>26?46:r>23?119:r>21?54:79;
  if(r<20){const grid=(x%8<2||y%8<2);if(grid)value=100;if(r<17&&r>15)value=116;
   if(style==='shanghai'&&Math.abs(dx)<9&&Math.abs(dy)<10&&((x+2)%5<2))value=137;
   if(style==='shenzhen'&&Math.abs(dx)<11&&Math.abs(dy)<11&&(Math.abs(dx)<2||Math.abs(dy)<2))value=140;
   if(style==='plain'&&Math.abs(dy)<2&&Math.abs(dx)<10)value=126;
  }
  const grain=((x*13+y*19+x*y)%41===0)?-16:((x*11+y*5)%53===0?10:0);value=Math.max(0,Math.min(255,value+grain));
  return [value,Math.round(value*1.08),Math.round(value*1.06),255];
 });
 const mat=new THREE.MeshLambertMaterial({map,color:0xffffff,side:THREE.DoubleSide,transparent:true,alphaTest:.5,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});mat.name=`RoadKit_manhole_${style}`;covers.set(style,mat);return mat;
}
