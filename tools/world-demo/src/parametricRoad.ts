import * as THREE from 'three';

export type RoadShape='straight'|'curve'|'slope'|'curve-slope';
export type RoadConfig={shape:RoadShape;lanesEachDirection:number;laneWidth:number;sidewalkWidth:number;medianWidth:number;bikeWidth:number;parkingWidth:number;parkingLength:number;tactile:boolean;tactileWidth:number;curbWidth:number;edgeSetback:number;drainSpacing:number;manholeSpacing:number;manholeStyle:'plain'|'shanghai'|'shenzhen';length:number;curveShift:number;rise:number};
const smooth=(t:number)=>{const q=THREE.MathUtils.clamp(t,0,1);return q*q*(3-2*q)};
export function roadPoint(c:RoadConfig,x:number,offset=0){
 const t=(x+c.length*.375)/(c.length*.75),curve=c.shape==='curve'||c.shape==='curve-slope',slope=c.shape==='slope'||c.shape==='curve-slope';
 const q=THREE.MathUtils.clamp(t,0,1),z=curve?c.curveShift*smooth(t):0,y=slope?c.rise*smooth(t):0;
 const dz=curve&&t>0&&t<1?c.curveShift*6*q*(1-q)/(c.length*.75):0,inv=1/Math.hypot(1,dz);
 return {x:x-offset*dz*inv,y,z:z+offset*inv,heading:-Math.atan(dz)};
}
export function lanePaths(c:RoadConfig){
 const paths:any[]=[];
 for(const side of [-1,1])for(let j=0;j<c.lanesEachDirection;j++){
  const offset=side*(c.medianWidth/2+(j+.5)*c.laneWidth),points=[];
  for(let i=0;i<=64;i++){const p=roadPoint(c,-c.length/2+c.length*i/64,offset);points.push([p.x,p.y+.025,p.z])}
  if(side<0)points.reverse();paths.push({id:`motor_${side<0?'reverse':'forward'}_${j+1}`,type:'motor',direction:side<0?'reverse':'forward',width:c.laneWidth,points});
 }
 if(c.bikeWidth>0)for(const side of [-1,1]){
  const offset=side*(c.medianWidth/2+c.lanesEachDirection*c.laneWidth+c.bikeWidth/2),points=[];
  for(let i=0;i<=64;i++){const p=roadPoint(c,-c.length/2+c.length*i/64,offset);points.push([p.x,p.y+.03,p.z])}
  if(side<0)points.reverse();paths.push({id:`non_motor_${side<0?'reverse':'forward'}`,type:'non_motor',direction:side<0?'reverse':'forward',width:c.bikeWidth,points});
 }
 return {units:'game-units',axes:'Y-up',paths};
}
export function buildParametricRoad(c:RoadConfig){
 if(!Number.isInteger(c.lanesEachDirection)||c.lanesEachDirection<1||c.lanesEachDirection>4||c.laneWidth<=0||c.sidewalkWidth<=0||c.medianWidth<0||c.bikeWidth<0)throw Error('Invalid road dimensions');
 const group=new THREE.Group();group.name='Parametric_road';group.userData.config=c;
 let grain:THREE.CanvasTexture|undefined;
 if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d')!,img=ctx.createImageData(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){let h=(Math.imul(x,73856093)^Math.imul(y,19349663)^12345)>>>0;h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;const value=247+((h>>>0)%9),i=(y*128+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=value;img.data[i+3]=255}ctx.putImageData(img,0,0);grain=new THREE.CanvasTexture(canvas);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.magFilter=THREE.NearestFilter;grain.minFilter=THREE.NearestMipmapNearestFilter;grain.colorSpace=THREE.SRGBColorSpace;grain.needsUpdate=true}
 // The existing GLB palette stores linear base-color factors; use the same
 // factors here instead of treating its hexadecimal values as sRGB colours.
 const mat=(name:string,color:number,textured=false)=>{const linear=new THREE.Color().setRGB(((color>>16)&255)/255,((color>>8)&255)/255,(color&255)/255);const m=new THREE.MeshStandardMaterial({color:linear,roughness:.95,map:textured?(grain??null):null});m.name=name;return m};
 const asphalt=mat('Asphalt',0x3b4c5a,true),bike=mat('Non_motor_lane',0x465a5f,true),pave=mat('Sidewalk',0x9dadA9,true),median=mat('Reserved_median_soil',0x716b59,true),curb=mat('Curb',0x9caaa6),white=mat('White_paint',0xf5efdb),yellow=mat('Yellow_paint',0xf6c654),tactile=mat('Tactile_paving',0xc1a153),ridge=mat('Tactile_ridges',0xe0ca85),metal=mat('Drain_and_manhole',0x4b5b5d),detail=mat('Manhole_details',0x788982);
 type Strip={lo:number;hi:number;start:number;end:number;y:number};
 function mesh(name:string,material:THREE.Material,strips:Strip[],step=1){
  const verts:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(const s of strips){const count=Math.max(1,Math.ceil((s.end-s.start)/step)),start=verts.length/3;
   for(let i=0;i<=count;i++){const x=THREE.MathUtils.lerp(s.start,s.end,i/count);for(const offset of [s.lo,s.hi]){const p=roadPoint(c,x,offset);verts.push(p.x,p.y+s.y,p.z);uvs.push(x/8,offset/8)}}
   for(let i=0;i<count;i++){const a=start+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}
  }
  if(!verts.length)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();const object=new THREE.Mesh(geometry,material);object.name=name;group.add(object);
 }
 function curbFace(name:string,offset:number,sign:number){const vertices:number[]=[],index:number[]=[];const count=Math.ceil(c.length);for(let i=0;i<=count;i++){const x=-c.length/2+c.length*i/count,p=roadPoint(c,x,offset);vertices.push(p.x,p.y+.015,p.z,p.x,p.y+.17,p.z)}for(let i=0;i<count;i++){const k=i*2;index.push(k,k+1,k+2,k+1,k+3,k+2)}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(index);geometry.computeVertexNormals();const m=curb.clone();m.side=THREE.DoubleSide;const obj=new THREE.Mesh(geometry,m);obj.name=name;group.add(obj)}
 const start=-c.length/2,end=c.length/2,all=(lo:number,hi:number,y:number):Strip=>({lo,hi,start,end,y});
 const halfMedian=c.medianWidth/2,roadOuter=halfMedian+c.lanesEachDirection*c.laneWidth,bikeOuter=roadOuter+c.bikeWidth,parkingOuter=bikeOuter+c.parkingWidth;
 for(const side of [-1,1]){
  const interval=(a:number,b:number)=>side<0?[-b,-a]:[a,b];
  let [a,b]=interval(halfMedian,roadOuter);mesh(`Road_surface_${side<0?'left':'right'}`,asphalt,[all(a,b,0)]);
  if(c.bikeWidth>0){[a,b]=interval(roadOuter,bikeOuter);mesh(`Non_motor_lane_${side<0?'left':'right'}`,bike,[all(a,b,.008)])}
  if(c.parkingWidth>0){[a,b]=interval(bikeOuter,parkingOuter);mesh(`Roadside_parking_${side<0?'left':'right'}`,asphalt,[all(a,b,.008)]);const stalls:Strip[]=[];[a,b]=interval(bikeOuter+.12,parkingOuter-.12);for(let x=start+c.parkingLength;x<end;x+=c.parkingLength)stalls.push({lo:a,hi:b,start:x-.06,end:x+.06,y:.03});mesh(`Parking_bay_markings_${side}`,white,stalls,.15)}
  [a,b]=interval(parkingOuter,parkingOuter+c.sidewalkWidth);mesh(`Sidewalk_${side<0?'left':'right'}`,pave,[all(a,b,.14)]);
  [a,b]=interval(parkingOuter,parkingOuter+Math.min(c.curbWidth,c.sidewalkWidth*.4));mesh(`Curb_${side<0?'left':'right'}`,curb,[all(a,b,.17)]);curbFace(`Curb_face_${side}`,side*parkingOuter,side);
  if(c.tactile){const center=parkingOuter+c.sidewalkWidth*.52,halfTactile=Math.min(c.tactileWidth,c.sidewalkWidth*.7)/2;[a,b]=interval(center-halfTactile,center+halfTactile);mesh(`Tactile_paving_${side<0?'left':'right'}`,tactile,[all(a,b,.153)]);
   const ribs:Strip[]=[];for(let x=start;x<end;x+=.42)ribs.push({lo:a,hi:b,start:x,end:Math.min(x+.13,end),y:.163});mesh(`Tactile_ridges_${side<0?'left':'right'}`,ridge,ribs,.25)
  }
  const inset=Math.min(c.edgeSetback,(c.parkingWidth||c.bikeWidth||c.laneWidth)-.15);const solid:Strip[]=[];const edgeOffsets=[c.bikeWidth>0||c.parkingWidth>0?roadOuter-.14:roadOuter-inset];if(c.medianWidth>0)edgeOffsets.push(halfMedian+.13);if(c.bikeWidth>0&&c.parkingWidth>0)edgeOffsets.push(bikeOuter-.14);if(c.bikeWidth>0||c.parkingWidth>0)edgeOffsets.push(parkingOuter-inset);
  for(const off of edgeOffsets){[a,b]=interval(off-.065,off+.065);solid.push(all(a,b,.027))}
  mesh(`Lane_markings_edge_${side}`,white,solid);
  const dashed:Strip[]=[];
  for(let lane=1;lane<c.lanesEachDirection;lane++){const off=halfMedian+lane*c.laneWidth;[a,b]=interval(off-.07,off+.07);for(let x=start;x<end;x+=7)dashed.push({lo:a,hi:b,start:x,end:Math.min(x+3.5,end),y:.029})}
  mesh(`Lane_markings_dashed_${side}`,white,dashed);
  if(c.drainSpacing>0){const drains:Strip[]=[],slots:Strip[]=[],off=parkingOuter-Math.min(inset*.5,.55);[a,b]=interval(off-.24,off+.24);for(let x=start+c.drainSpacing/2;x<end;x+=c.drainSpacing){drains.push({lo:a,hi:b,start:x-.45,end:x+.45,y:.038});for(let k=-2;k<=2;k++)slots.push({lo:a+.05,hi:b-.05,start:x+k*.16-.025,end:x+k*.16+.025,y:.044})}mesh(`Drain_grates_${side}`,metal,drains,.25);mesh(`Drain_slots_${side}`,detail,slots,.12)}
 }
 if(c.medianWidth>0){mesh('Reserved_median',median,[all(-halfMedian,halfMedian,.12)]);const rim=Math.min(.17,halfMedian/3);mesh('Reserved_median_curb',curb,[all(-halfMedian,-halfMedian+rim,.18),all(halfMedian-rim,halfMedian,.18)])}
 else mesh('Lane_markings_center',yellow,[all(-.07,.07,.03)]);
 if(c.manholeSpacing>0)for(let x=start+c.manholeSpacing/2;x<end;x+=c.manholeSpacing){
  const p=roadPoint(c,x,halfMedian+c.laneWidth*.72),a=roadPoint(c,x-.05,halfMedian+c.laneWidth*.72),b=roadPoint(c,x+.05,halfMedian+c.laneWidth*.72),along=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).normalize(),across=new THREE.Vector3(Math.sin(p.heading),0,Math.cos(p.heading)),normal=new THREE.Vector3().crossVectors(across,along).normalize(),lid=new THREE.Group();lid.name=`Manhole_${c.manholeStyle}_${Math.round(x+c.length/2)}`;lid.position.set(p.x,p.y+.045,p.z);lid.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);group.add(lid);
  const disk=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.035,16),metal);lid.add(disk);const ring=new THREE.Mesh(new THREE.RingGeometry(.40,.45,16),detail);ring.rotation.x=-Math.PI/2;ring.position.y=.022;lid.add(ring);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(c.manholeStyle==='shanghai'?.52:.78,.015,.055),detail);bar.position.y=.027;lid.add(bar);if(c.manholeStyle==='shenzhen'){const second=bar.clone();second.rotation.y=Math.PI/2;lid.add(second)}
  lid.userData={style:c.manholeStyle,spacing:c.manholeSpacing,customizable:true};
 }
 return group;
}
