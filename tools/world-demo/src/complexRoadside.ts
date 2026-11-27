import * as THREE from 'three';
import {buildParametricRoad,type RoadConfig} from './parametricRoad';

type P={x:number;y:number;z:number};
type Edge={id:string;from:string;to:string;forward_lanes:number;reverse_lanes:number;lane_width_m:number;start_offset_z?:number;end_offset_z?:number;via?:P[]};
type Config={nodes:Record<string,P>;edges:Edge[];default_sidewalk_lanes:number;sidewalk_lane_width_m:number;parking_bays?:{start:number;end:number;side:number;width:number;taper:number;road_half_width:number}[]};
export function buildComplexRoadside(settings:RoadConfig,config:Config,graph:any){
 const group=new THREE.Group();group.name='Shared_roadside_features';group.userData.noGround=true;
 // These spans avoid junctions and branch openings; the two central spans use
 // only the north side because the frontage merge occupies the south side.
 const spans:{from:number;to:number;both:boolean;parkingWidth:number;vertical?:boolean;fixed?:number;lanes?:number}[]=[{from:-230,to:-220,both:true,parkingWidth:0},{from:-212,to:-180,both:true,parkingWidth:7},{from:-125,to:-107,both:true,parkingWidth:0},{from:-80,to:-28,both:false,parkingWidth:0},{from:28,to:80,both:false,parkingWidth:0},{from:107,to:125,both:true,parkingWidth:0},{from:175,to:230,both:true,parkingWidth:0},...[-150,150].flatMap(fixed=>[{from:-75,to:-28,both:true,parkingWidth:0,vertical:true,fixed,lanes:2},{from:68,to:125,both:true,parkingWidth:0,vertical:true,fixed,lanes:2}]),{from:-50,to:-27,both:true,parkingWidth:0,vertical:true,fixed:0,lanes:1}];
 for(const {from,to,both,parkingWidth,vertical,fixed,lanes} of spans){const c={...settings,shape:'straight' as const,lanesEachDirection:lanes??2,laneWidth:8.775,sidewalkWidth:config.default_sidewalk_lanes*config.sidewalk_lane_width_m,medianWidth:0,bikeWidth:0,parkingWidth,length:to-from,rise:0,curveShift:0},road=buildParametricRoad(c),holder=new THREE.Group();holder.name='Shared_roadside_span';if(vertical){holder.position.set(fixed??0,0,(from+to)/2);holder.rotation.y=-Math.PI/2}else holder.position.x=(from+to)/2;
  for(const child of [...road.children]){const name=child.name,keep=/^(Curb_|Tactile_|Drain_|Manhole_)/.test(name);const south=/(_right|_1)$/.test(name);if(keep&&(both||!south)){road.remove(child);holder.add(child)}}group.add(holder);
 }
 const segments:{id:string;a:P;b:P;width:number;na:[number,number];nb:[number,number]}[]=[];
 for(const e of config.edges){const pts=[{...config.nodes[e.from]},...(e.via??[]).map(p=>({...p})),{...config.nodes[e.to]}];pts[0].z+=e.start_offset_z??0;pts[pts.length-1].z+=e.end_offset_z??0;const width=(e.forward_lanes+e.reverse_lanes)*e.lane_width_m;
  const normals:[number,number][]=[];for(let i=1;i<pts.length;i++){const dx=pts[i].x-pts[i-1].x,dz=pts[i].z-pts[i-1].z,len=Math.hypot(dx,dz);normals.push([-dz/len,dx/len])}
  function joint(i:number):[number,number]{if(i===0)return normals[0];if(i===pts.length-1)return normals[normals.length-1];const a=normals[i-1],b=normals[i],sum:[number,number]=[a[0]+b[0],a[1]+b[1]],den=sum[0]*b[0]+sum[1]*b[1];return den>.1?[sum[0]/den,sum[1]/den]:b}
  for(let i=1;i<pts.length;i++)segments.push({id:e.id,a:pts[i-1],b:pts[i],width,na:joint(i-1),nb:joint(i)})}
 function insideOther(x:number,y:number,z:number,current:string){for(const s of segments){if(s.id===current)continue;const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,den=dx*dx+dz*dz;if(!den)continue;const t=Math.max(0,Math.min(1,((x-s.a.x)*dx+(z-s.a.z)*dz)/den));if(Math.abs((s.a.y+(s.b.y-s.a.y)*t)-y)>.4)continue;if(Math.hypot(x-s.a.x-t*dx,z-s.a.z-t*dz)<s.width/2-.05)return true}return false}
 function crosses(x:number,z:number,y:number){for(const cross of graph.crosswalks){if(Math.abs(cross.center.y-y)>.4)continue;const a=cross.endpoints[0],b=cross.endpoints[1],dx=b.x-a.x,dz=b.z-a.z,w=Math.hypot(dx,dz),ux=dx/w,uz=dz/w,across=(x-a.x)*ux+(z-a.z)*uz,along=-(x-a.x)*uz+(z-a.z)*ux;if(across>-.6&&across<w+.6&&Math.abs(along)<cross.width/2+.5)return true}return false}
 const vertices:number[]=[],indices:number[]=[];
 function add(a:P,b:P,normal:[number,number],offset:number){const start=vertices.length/3,half=.07;for(const [p,o] of [[a,offset-half],[a,offset+half],[b,offset-half],[b,offset+half]] as [P,number][])vertices.push(p.x+normal[0]*o,p.y+.04,p.z+normal[1]*o);indices.push(start,start+1,start+2,start+1,start+3,start+2)}
 for(const s of segments){if(graph.crosswalks.some((cross:any)=>cross.merged_short_link&&cross.edge===s.id))continue;const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,len=Math.hypot(dx,dz);if(len<.01)continue;const right:[number,number]=[-dz/len,dx/len];for(const side of [-1,1]){const offset=side*(s.width/2-Math.min(settings.edgeSetback,s.width*.2)),count=Math.ceil(len/.8);let runStart=-1;
   function point(t:number,off=0):P{const nx=s.na[0]+(s.nb[0]-s.na[0])*t,nz=s.na[1]+(s.nb[1]-s.na[1])*t;return {x:s.a.x+dx*t+nx*off,y:s.a.y+(s.b.y-s.a.y)*t,z:s.a.z+dz*t+nz*off}}
   for(let i=0;i<=count;i++){const t=Math.min(1,(i+.5)/count),p=point(t),outer=point(t,side*(s.width/2+.55)),line=point(t,offset),outx=outer.x,outz=outer.z,lineX=line.x,lineZ=line.z;
    const isBay=(config.parking_bays??[]).some(b=>side===b.side&&p.x>=b.start&&p.x<=b.end&&Math.abs(p.z)<.1&&s.width/2===b.road_half_width);
    const visible=i<count&&!isBay&&!insideOther(outx,p.y,outz,s.id)&&!crosses(lineX,lineZ,p.y);
    if(visible&&runStart<0)runStart=i;if(!visible&&runStart>=0){add(point(runStart/count,offset),point(i/count,offset),right,0);runStart=-1}
   }
  }}
 // Follow the curved outer edge of each actual lay-by instead of crossing it.
 for(const bay of config.parking_bays??[]){const n=Math.ceil((bay.end-bay.start)/.8),points:P[]=[];for(let i=0;i<=n;i++){const x=bay.start+(bay.end-bay.start)*i/n,q=Math.max(0,Math.min(1,(x-bay.start)/bay.taper,(bay.end-x)/bay.taper)),t=q*q*(3-2*q);points.push({x,y:0,z:bay.side*(bay.road_half_width+bay.width*t-settings.edgeSetback)})}for(let i=1;i<points.length;i++)add(points[i-1],points[i],[0,1],0)}
 if(vertices.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(245/255,239/255,219/255),roughness:.95,side:THREE.DoubleSide});const m=new THREE.Mesh(geometry,material);m.name='Lane_edges_dynamic';group.add(m)}
 return group;
}
