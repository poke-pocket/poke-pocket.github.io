import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CITY_BUS_SCALE } from './roadKitBusDimensions';

// Shared cache: several cities may show this bus, but load the GLB only once.
let busAsset: Promise<THREE.Group> | undefined;
export async function mountPreviewCityBus(parent:THREE.Object3D,x:number,y:number,z:number,rotY:number):Promise<void>{
  try {
    busAsset ??= new GLTFLoader().loadAsync('/models/vehicles/city-bus-voxel.glb').then(gltf => gltf.scene).catch(error=>{busAsset=undefined;throw error});
    const asset=(await busAsset).clone(true);
    // Original asset is 12.225 units long, with its centre at z=.1125.
    asset.position.z=-.1125;
    const scaled=new THREE.Group();scaled.scale.setScalar(CITY_BUS_SCALE);scaled.add(asset);
    const holder=new THREE.Group();holder.name='Preview_city_bus';holder.position.set(x,y,z);holder.rotation.y=rotY;holder.add(scaled);
    holder.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true}});
    parent.add(holder);
  } catch(error) { console.error('Could not load preview city bus',error); }
}

/** Matching the modern shelter in the road preview, long axis on local X. */
export function createPreviewBusShelter():THREE.Group {
 const root=new THREE.Group();root.name='Preview_bus_shelter';root.scale.setScalar(1.2);
 const metal=new THREE.MeshStandardMaterial({color:0x445b5e,roughness:.82,metalness:.25});
 const roof=new THREE.MeshStandardMaterial({color:0x708688,roughness:.72,metalness:.32});
 const trim=new THREE.MeshStandardMaterial({color:0xa3b1ac,roughness:.7,metalness:.35});
 const glass=new THREE.MeshStandardMaterial({color:0xb9d9d3,transparent:true,opacity:.32,roughness:.3,metalness:.05,depthWrite:false});
 const light=new THREE.MeshStandardMaterial({color:0xf8eac4,emissive:0xd8ba76,emissiveIntensity:.35});
 const box=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o)};
 for(const x of [-3.3,3.3])for(const z of [-.9,.9])box(metal,x,1.55,z,.14,3,.14);
 box(roof,0,3.14,0,7.35,.22,2.25);box(trim,0,3.28,0,6.9,.08,1.82);box(glass,0,1.7,-.91,6.4,2.35,.08);
 for(const x of [-3.28,3.28])box(glass,x,1.65,0,.07,2.1,1.65);
 for(const x of [-2.2,0,2.2]){box(trim,x,1.75,-.9,.045,2.25,.06);box(metal,x,3.02,0,.045,.09,1.8)}
 box(trim,0,3.13,.99,7.15,.11,.08);box(light,0,2.98,.70,3.8,.035,.07);
 for(const z of [-.43,-.24,-.05])box(metal,0,.91,z,3.55,.025,.025);
 box(trim,0,.83,-.25,3.8,.13,.62);for(const x of [-1.5,1.5])box(metal,x,.45,-.25,.11,.76,.48);
 box(metal,-2,2.05,-.78,1.05,1.55,.08);box(light,-2,2.05,-.72,.86,1.3,.035);
 box(metal,4.1,1.6,.8,.12,3.2,.12);box(roof,4.1,3.18,.8,.76,.55,.15);box(light,4.1,3.18,.89,.55,.32,.03);
 return root;
}
