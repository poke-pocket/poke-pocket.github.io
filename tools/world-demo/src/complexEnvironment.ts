import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
type P={x:number;y:number;z:number};
type Edge={id:string;from:string;to:string;forward_lanes:number;reverse_lanes:number;lane_width_m:number;sidewalk_lanes?:number;start_offset_z?:number;end_offset_z?:number;via?:P[]};
type Config={nodes:Record<string,P>;edges:Edge[];default_sidewalk_lanes:number;sidewalk_lane_width_m:number;parking_bays?:{start:number;end:number;side:number;width:number;taper:number;road_half_width:number;sidewalk_width:number}[]};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));const ease=(x:number)=>{const t=clamp(x);return t*t*(3-2*t)};
export function buildComplexEnvironment(c:Config){
 const root=new THREE.Group();root.name='Complex_environment';
 const segments:{id:string;a:P;b:P;half:number}[]=[];
 for(const e of c.edges){const pts=[{...c.nodes[e.from]},...(e.via??[]).map(p=>({...p})),{...c.nodes[e.to]}];pts[0].z+=e.start_offset_z??0;pts[pts.length-1].z+=e.end_offset_z??0;const half=(e.forward_lanes+e.reverse_lanes)*e.lane_width_m/2+(e.sidewalk_lanes??c.default_sidewalk_lanes)*c.sidewalk_lane_width_m;for(let i=1;i<pts.length;i++)segments.push({id:e.id,a:pts[i-1],b:pts[i],half})}
 const project=(x:number,z:number,s:typeof segments[number])=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,raw=((x-s.a.x)*dx+(z-s.a.z)*dz)/(dx*dx+dz*dz),t=clamp(raw);return {distance:Math.hypot(x-s.a.x-t*dx,z-s.a.z-t*dz),height:s.a.y+(s.b.y-s.a.y)*t,raw}};
 const clearance=(x:number,z:number)=>{let d=Math.min(...segments.filter(s=>!['tunnel_level','garage_floor'].includes(s.id)).map(s=>project(x,z,s).distance-s.half));for(const bay of c.parking_bays??[]){if(x<bay.start||x>bay.end||z*bay.side<0)continue;const t=ease(Math.min((x-bay.start)/bay.taper,(bay.end-x)/bay.taper));d=Math.min(d,z*bay.side-(bay.road_half_width+bay.width*t+bay.sidewalk_width))}return d};
 const plots:[number,number,number,number,number][]=[[-205,-42,12,11,17],[-187,-91,12,11,24],[-115,100,12,11,18],[-70,-45,13,10,21],[-40,-45,10,10,16],[40,-105,13,12,20],[110,105,12,10,19],[190,95,14,12,25],[207,-45,12,10,17],[-190,120,11,10,14]];
 function natural(x:number,z:number){const hills=[[235,-180,32,105],[-200,-185,27,95],[190,210,30,110],[-230,210,24,95],[0,270,20,100]];let v=0;for(const [hx,hz,h,r] of hills)v+=h*Math.exp(-((x-hx)**2+(z-hz)**2)/(r*r));return v+2.3*(Math.sin(x*.025)*Math.cos(z*.021)+1)}
 function height(x:number,z:number){let h=-.18+natural(x,z)*ease(clearance(x,z)/35);for(const s of segments){if(!['tunnel_down','tunnel_up','garage_ramp'].includes(s.id))continue;const p=project(x,z,s),dist=p.distance-s.half;if(p.raw>=0&&p.raw<=1&&dist<14){const t=ease(dist/14);h=Math.min(h,(p.height-.18)*(1-t)+h*t)}}
  if(z>=150&&z<=190&&Math.abs(x)<18.7){const arch=-1.9+4.74*Math.sqrt(Math.max(0,1-(x/18.7)**2));h=Math.max(h,arch+.6)}
  // Terrain immediately outside underground entrances slopes down into each cut.
  if(Math.abs(x+115)<5&&Math.abs(z)>=23&&Math.abs(z)<=34){const t=clamp((Math.abs(z)-24)/8),depth=-4*(1-t)-.18;h=Math.min(h,depth)}
  return h;
 }
 const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1});material.name='Terrain_grass';const size=700,count=140,step=size/count,positions:number[]=[],colors:number[]=[],indices:number[]=[],base=new THREE.Color('#91b998');
 for(let j=0;j<=count;j++)for(let i=0;i<=count;i++){const x=-size/2+i*step,z=-size/2+j*step,y=height(x,z),tone=.94+.055*((Math.sin(x*.083)*Math.cos(z*.072)+1)/2)+Math.min(.035,Math.max(0,y)*.002);positions.push(x,y,z);colors.push(base.r*tone,base.g*tone,base.b*tone)}
 for(let j=0;j<count;j++)for(let i=0;i<count;i++){const x=-size/2+(i+.5)*step,z=-size/2+(j+.5)*step;
  // Portal and garage cuts expose the lower road instead of covering it with grass.
  const roadPortal=Math.abs(x)<20&&(z>145&&z<155||z>185&&z<195),garageCut=x>=50&&x<75&&Math.abs(z-85.025)<20,underpassCut=Math.abs(x+115)<5&&Math.abs(z)<34;
  if(roadPortal||garageCut||underpassCut)continue;const a=j*(count+1)+i,b=a+count+1;indices.push(a,b,a+1,a+1,b,b+1)
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const terrain=new THREE.Mesh(geo,material);terrain.name='Terrain';root.add(terrain);
 const wood=new THREE.MeshStandardMaterial({color:0x67503d,roughness:1}),leaf=new THREE.MeshStandardMaterial({color:0x5f8d69,roughness:1}),stone=new THREE.MeshStandardMaterial({color:0x869b98,roughness:.95}),glass=new THREE.MeshStandardMaterial({color:0x5d8790,metalness:.15,roughness:.45}),dark=new THREE.MeshStandardMaterial({color:0x344b52,roughness:.9}),yellow=new THREE.MeshStandardMaterial({color:0xe0c778,roughness:.95});
 function box(name:string,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,parent:THREE.Object3D=root){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);parent.add(m);return m}
 // Voxel-like distant trees: merged geometry limits draw calls while keeping varied silhouettes.
 const trunks:THREE.BufferGeometry[]=[],leaves:THREE.BufferGeometry[]=[];let seed=22107;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 for(let i=0;i<310;i++){const x=(random()-.5)*650,z=(random()-.5)*650;if(clearance(x,z)<12||plots.some(p=>Math.hypot(x-p[0],z-p[1])<15)||x>25&&x<85&&Math.abs(z-85)<20)continue;const y=height(x,z),s=.75+random()*.85;const trunk=new THREE.BoxGeometry(.48*s,2.4*s,.48*s);trunk.translate(x,y+1.2*s,z);trunks.push(trunk);for(const [dx,dz,dy,w] of [[0,0,3.1,2.7],[-.7,.2,3.7,1.5],[.6,-.3,3.9,1.6],[0,0,4.5,1.35]]){const g=new THREE.BoxGeometry(w*s,1.25*s,w*s);g.translate(x+dx*s,y+dy*s,z+dz*s);leaves.push(g)}}
 for(const [name,list,mat] of [['Terrain_tree_trunks',trunks,wood],['Terrain_tree_crowns',leaves,leaf]] as const)if(list.length){const g=mergeGeometries(list);list.forEach(x=>x.dispose());const m=new THREE.Mesh(g,mat);m.name=name;m.userData.noGround=true;root.add(m)}
 // Background buildings are visual shells; plot locations avoid roadway corridors.
 for(let i=0;i<plots.length;i++){const [x,z,w,d,h]=plots[i],y=height(x,z),district=new THREE.Group();district.name=`District_building_${i+1}`;district.position.set(x,y-.3,z);root.add(district);box('Building_shell',i%3===0?glass:stone,0,h/2,0,w,h,d,district);box('Building_roof',dark,0,h+.18,0,w+.3,.36,d+.3,district);box('Roof_equipment',stone,0,h+.75,0,w*.28,1.1,d*.28,district);
  const windows:THREE.BufferGeometry[]=[];for(let fy=2;fy<h-1;fy+=2.1){for(let xx=-w/2+1.1;xx<w/2-.5;xx+=1.5){const g=new THREE.BoxGeometry(.9,1.15,.04);g.translate(xx,fy,d/2+.025);windows.push(g)}for(let zz=-d/2+1.1;zz<d/2-.5;zz+=1.5){const g=new THREE.BoxGeometry(.04,1.15,.9);g.translate(w/2+.025,fy,zz);windows.push(g)}}if(windows.length){const m=new THREE.Mesh(mergeGeometries(windows),glass);windows.forEach(g=>g.dispose());m.name='Building_windows';district.add(m)}
 }
 // Road tunnel shell with openings at both ends. Road itself comes from the lane graph.
 const tunnel=new THREE.Group();tunnel.name='Road_tunnel_portals_and_shell';root.add(tunnel);
 // A shallow elliptical arch leaves clearance for the full road and footways.
 // The faceted profile retains the pixel-world appearance without a flat roof.
 function arch(name:string,z0:number,z1:number,outer:number,inner:number){const vertices:number[]=[],indices:number[]=[],steps=28;
  for(let i=0;i<=steps;i++){const t=Math.PI*i/steps;for(const z of [z0,z1])for(const r of [inner,outer])vertices.push(r*Math.cos(t),-1.9+(r/18)*4.5*Math.sin(t),z)}
  for(let i=0;i<steps;i++){const a=i*4,b=a+4;for(const [p,q,r,s] of [[a,b,b+2,a+2],[a+1,a+3,b+3,b+1],[a,a+1,b+1,b],[a+2,b+2,b+3,a+3]])indices.push(p,q,r,p,r,s)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x869b98,roughness:.95,side:THREE.DoubleSide}));m.name=name;tunnel.add(m)}
 arch('Tunnel_arched_lining',150,190,18.3,17.6);for(const z of [150,190]){arch('Tunnel_arched_portal',z-.7,z+.7,18.8,17.6);for(const side of [-1,1])box('Tunnel_portal_pier',stone,side*18.2,-3.95,z,1.2,4.1,1.4,tunnel)}
 for(const side of [-1,1]){box('Tunnel_wall',stone,side*18,-3.95,170,.8,4.1,40,tunnel);box('Tunnel_wall_band',yellow,side*17.54,-3.25,170,.06,.15,39,tunnel)}for(let z=153;z<190;z+=6)for(const x of [-8,8])box('Tunnel_lamp',yellow,x,1.7,z,1.2,.06,.45,tunnel);
 // Simple cutaway garage, aligned with the generated two-way sloping access road.
 const garage=new THREE.Group();garage.name='Underground_garage';root.add(garage);box('Garage_roof',stone,62.5,.3,85.025,27,.6,42,garage);for(const z of [66.5,103.5])box('Garage_wall',stone,62,-1.9,z,25,4,.7,garage);box('Garage_rear',stone,74,-1.9,85.025,.7,4,38,garage);for(const z of [74.7,95.3])box('Garage_portal_post',stone,50,-1.5,z,1,5,1,garage);box('Garage_portal_beam',stone,50,.7,85,1,1,21,garage);box('Garage_parking_sign',glass,50.6,1.5,85,.12,1.2,2.4,garage);
 for(const side of [-1,1]){const z=85+side*11.5;box('Garage_parking_floor',stone,62,-4.05,z,24,.08,13,garage);for(const x of [50.2,58,65.8,73.8])box('Garage_parking_marking',yellow,x,-3.998,z,.13,.025,12.6,garage);for(const x of [55,69])box('Garage_pillar',stone,x,-1.95,85+side*17,.65,4,.65,garage);for(const x of [55,64,71])box('Garage_ceiling_light',yellow,x,-.06,85+side*12,2,.04,.4,garage)}
 // Walkable pedestrian underpass: open ramps outside the sidewalks, covered path below the road.
 const walk=new THREE.Group();walk.name='Pedestrian_underpass';walk.userData.pedestrianPath=[[-115,0,-32],[-115,-4,-24],[-115,-4,24],[-115,0,32]];root.add(walk);
 function floor(z0:number,z1:number,y0:number,y1:number){const v=[-117,y0,z0,-113,y0,z0,-117,y1,z1,-113,y1,z1],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex([0,2,1,1,2,3]);g.computeVertexNormals();const m=new THREE.Mesh(g,stone);m.name='Underpass_walkway';walk.add(m)}
 floor(-32,-24,.04,-3.96);floor(-24,24,-3.96,-3.96);floor(24,32,-3.96,.04);
 for(const x of [-117.2,-112.8]){box('Underpass_wall',stone,x,-2,0,.35,4,48,walk);for(const side of [-1,1])box('Underpass_entrance_rail',dark,x,-1.2,side*28,.12,2.5,8,walk)}
 box('Underpass_roof',stone,-115,-.26,0,4.8,.4,48,walk);for(let z=-21;z<=21;z+=6)box('Underpass_ceiling_light',yellow,-115,-.49,z,1.2,.06,.45,walk);for(const z of [-31,31])box('Underpass_entrance_sign',yellow,-115,.7,z,4.2,.2,.18,walk).userData.noGround=true;
 root.userData.terrainVariation=true;return root;
}
