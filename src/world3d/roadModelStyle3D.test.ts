import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildRoadKitJunctions, createRoadKitJunctionStreamer, planRoadKitCrossings, planRoadKitJunctions, roadKitStyle, type RoadKitCut } from './roadModelStyle3D';
import { buildRoadContinuity } from './roadKitContinuity';
import { buildRoadKitDrains } from './roadKitDrains3D';
import { buildStreetRibbonMesh } from './interTownNetwork3D';
import type { TownStreetSeg } from '../utils/townStreetGen';

const street=(x1:number,z1:number,x2:number,z2:number,isBridge=false):TownStreetSeg=>({x1,z1,x2,z2,width:20,kind:'street',isBridge});
const crossings=[street(-60,0,60,0),street(0,-60,0,60)];
const junctions=[{x:0,z:0,width:20,depth:20,rotY:0,kind:'cross' as const}];
const make=(streets:TownStreetSeg[])=>buildRoadKitJunctions({streets,junctions,centerX:0,centerZ:0,baseY:1,water:0,ground:()=>1});

describe('road kit geometry',()=>{
  it('constructs an asphalt junction and crossing for actual intersecting streets without changing their data',()=>{
    const snapshot=JSON.stringify(crossings),group=make(crossings);
    expect(group.getObjectByName('RoadKit_junction_road')).toBeTruthy();
    expect(group.getObjectByName('RoadKit_junction_walk')).toBeTruthy();
    expect(group.getObjectByName('RoadKit_junction_paint')).toBeTruthy();
    expect(JSON.stringify(crossings)).toBe(snapshot);
  });
  it('keeps crosswalk paint within the carriageway at the intersection',()=>{
    const group=make(crossings),paint=group.getObjectByName('RoadKit_junction_paint') as THREE.Mesh;
    const p=paint.geometry.getAttribute('position');expect(p.count).toBeGreaterThan(0);
    for(let i=0;i<p.count;i++) expect(Math.min(Math.abs(p.getX(i)),Math.abs(p.getZ(i)))).toBeLessThan(20*.34+.001);
  });
  it('adds only crossing markings when the unified network owns the road surface',()=>{
    const group=buildRoadKitJunctions({streets:crossings,junctions,centerX:0,centerZ:0,baseY:1,water:0,ground:()=>1,paintOnly:true});
    expect(group.getObjectByName('RoadKit_junction_paint')).toBeTruthy();
    expect(group.getObjectByName('RoadKit_junction_road')).toBeUndefined();
    expect(group.getObjectByName('RoadKit_junction_walk')).toBeUndefined();
  });
  it('keeps the junction surface below the urban walking height on sloped terrain',()=>{
    const ground=(x:number,z:number)=>1+x*.002+z*.003;
    const group=buildRoadKitJunctions({streets:crossings,junctions,centerX:0,centerZ:0,baseY:0,water:0,ground});
    for(const name of ['RoadKit_junction_road','RoadKit_junction_walk']){
      const mesh=group.getObjectByName(name) as THREE.Mesh,p=mesh.geometry.getAttribute('position');
      for(let i=0;i<p.count;i++) expect(p.getY(i)-ground(p.getX(i),p.getZ(i))).toBeLessThan(.16);
    }
  });
  it('uses configurable wear on road markings and crosswalk paint',()=>{
    const group=make(crossings),paint=group.getObjectByName('RoadKit_junction_paint') as THREE.Mesh,mat=paint.material as THREE.Material;
    const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>',uniforms:{}};
    mat.onBeforeCompile(shader as never,{} as never);expect(shader.uniforms).toHaveProperty('uRoadKitCrosswalkWear',roadKitStyle.crosswalkWear);expect(shader.fragmentShader).toContain('discard');
    const ribbon=buildStreetRibbonMesh(crossings[0],0,0,0,new THREE.CanvasTexture(),()=>1),road=(ribbon.material as THREE.Material[])[0];
    const roadShader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>',uniforms:{}};
    road.onBeforeCompile(roadShader as never,{} as never);expect(roadShader.uniforms).toHaveProperty('uRoadKitLineWear',roadKitStyle.lineWear);
  });
  it('does not join a bridge to a road at a different level',()=>{
    const group=make([crossings[0],street(0,-60,0,60,true)]);
    expect(group.children).toHaveLength(0);
  });
  it('cuts participating ribbons where the junction union is generated',()=>{
    const plans=planRoadKitJunctions({streets:crossings,junctions,centerX:0,centerZ:0,water:0,ground:()=>1});
    expect(plans).toHaveLength(1);expect(plans[0].nearby).toContain(crossings[0]);expect(plans[0].nearby).toContain(crossings[1]);
    const cut:RoadKitCut={x:0,z:0,radius:plans[0].radius,step:plans[0].step};
    const ribbon=buildStreetRibbonMesh(crossings[0],0,0,0,new THREE.CanvasTexture(),()=>1,.14,-1,undefined,[cut]);
    for(const material of ribbon.material as THREE.Material[]){const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <clipping_planes_fragment>\n#include <color_fragment>',uniforms:{}};material.onBeforeCompile(shader as never,{} as never);expect(shader.fragmentShader).toContain('discard');expect(shader.uniforms).toHaveProperty('roadCut0')}
  });
  it('loads junctions near the player across the city and releases distant ones',()=>{
    const streets=[...crossings,street(940,0,1060,0),street(1000,-60,1000,60)];
    const nodes=[...junctions,{x:1000,z:0,width:20,depth:20,rotY:0,kind:'cross' as const}];
    const options={streets,junctions:nodes,centerX:0,centerZ:0,baseY:1,water:0,ground:()=>1};
    const plans=planRoadKitJunctions(options);expect(plans).toHaveLength(2);
    const stream=createRoadKitJunctionStreamer({...options,plans,radius:100});stream.update(0,0);expect(stream.group.children).toHaveLength(1);
    stream.update(1000,0);expect(stream.group.children).toHaveLength(1);
    const mesh=stream.group.children[0].getObjectByName('RoadKit_junction_road') as THREE.Mesh;
    mesh.geometry.computeBoundingBox();expect(mesh.geometry.boundingBox!.min.x).toBeGreaterThan(900);
  });
  it('discovers intersections absent from the supplied junction list',()=>{
    const nodes:typeof junctions=[];
    const plans=planRoadKitJunctions({streets:crossings,junctions:nodes,centerX:0,centerZ:0,water:0,ground:()=>1});
    expect(plans).toHaveLength(1);expect(plans[0].node.x).toBeCloseTo(0);expect(plans[0].node.z).toBeCloseTo(0);
    expect(nodes).toHaveLength(0);
  });
  it('unifies nearby junction surfaces and prevents intersecting zebra and turn markings',()=>{
    const roads=[street(-80,0,80,0),street(0,-80,0,80),street(25,-80,25,80)],nodes:typeof junctions=[];
    const opts={streets:roads,junctions:nodes,centerX:0,centerZ:0,baseY:1,water:0,ground:()=>1};
    const plans=planRoadKitJunctions(opts),cross=planRoadKitCrossings(plans);expect(plans.length).toBeGreaterThanOrEqual(2);expect(cross.length).toBeGreaterThan(0);
    const overlap=(a:{x:number;z:number}[],b:{x:number;z:number}[])=>{for(const poly of [a,b])for(let i=0;i<4;i++){const p=poly[i],q=poly[(i+1)%4],nx=q.z-p.z,nz=p.x-q.x,aa=a.map(v=>v.x*nx+v.z*nz),bb=b.map(v=>v.x*nx+v.z*nz);if(Math.max(...aa)<=Math.min(...bb)+.001||Math.max(...bb)<=Math.min(...aa)+.001)return false}return true};
    for(let i=0;i<cross.length;i++)for(let j=0;j<i;j++)expect(overlap(cross[i].corners,cross[j].corners)).toBe(false);
    const group=buildRoadKitJunctions({...opts,plans,allPlans:plans,crossings:cross});
    const cells=new Set<string>();for(const name of ['RoadKit_junction_road','RoadKit_junction_walk']){const mesh=group.getObjectByName(name) as THREE.Mesh,p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i+=4){let x=0,z=0;for(let k=0;k<4;k++){x+=p.getX(i+k)/4;z+=p.getZ(i+k)/4}const key=`${x.toFixed(3)},${z.toFixed(3)}`;expect(cells.has(key)).toBe(false);cells.add(key);if(name.endsWith('_walk'))expect(Math.min(Math.abs(z),Math.abs(x),Math.abs(x-25))).toBeGreaterThanOrEqual(20*.34375-1e-4)}}
    const marking=group.getObjectByName('RoadKit_junction_marking') as THREE.Mesh;expect(marking).toBeTruthy();const p=marking.geometry.getAttribute('position');for(let i=0;i<p.count;i+=4){const quad=Array.from({length:4},(_,k)=>({x:p.getX(i+k),z:p.getZ(i+k)}));for(const stripe of cross)expect(overlap(quad,stripe.corners)).toBe(false)}
  });
  it('keeps the street width and raises its curb over the travel surface',()=>{
    const seg=street(0,0,40,0),mesh=buildStreetRibbonMesh(seg,0,0,0,new THREE.CanvasTexture(),()=>1),p=mesh.geometry.getAttribute('position');
    expect(p.count).toBeGreaterThan(17);
    expect(p.getZ(0)).toBeCloseTo(-10);
    expect(p.getZ(16)).toBeCloseTo(10);
    expect(p.getY(6)).toBeGreaterThan(p.getY(7));
    expect(seg.width).toBe(20);
  });
});

describe('roadside drainage',()=>{
  it('places physical grates 35 units apart between the edge line and curb',()=>{
    const seg=street(0,0,140,0),joins=buildRoadContinuity([seg]);
    const g=buildRoadKitDrains({streets:[seg],joins,cuts:new Map(),centerX:0,centerZ:0,baseY:0,water:0,ground:()=>1});
    const mesh=g.getObjectByName('RoadKit_drain_bases') as THREE.Mesh,p=mesh.geometry.getAttribute('position');
    expect(p.count).toBe(8*4);const centers:number[]=[];
    for(let i=0;i<p.count;i+=4){let x=0,z=0;for(let k=0;k<4;k++){x+=p.getX(i+k)/4;z+=p.getZ(i+k)/4}centers.push(x);expect(Math.abs(z)).toBeGreaterThan(20*.3125);expect(Math.abs(z)).toBeLessThan(20*.34375)}
    expect([...new Set(centers.map(x=>Math.round(x*10)/10))]).toEqual([17.5,52.5,87.5,122.5]);
  });
  it('does not generate drains through a crossing',()=>{
    const seg=street(0,0,140,0),joins=buildRoadContinuity([seg]),cuts=new Map([[seg,[{x:17.5,z:0,radius:12,step:.65}]]]);
    const g=buildRoadKitDrains({streets:[seg],joins,cuts,centerX:0,centerZ:0,baseY:0,water:0,ground:()=>1});
    const mesh=g.getObjectByName('RoadKit_drain_bases') as THREE.Mesh;expect(mesh.geometry.getAttribute('position').count).toBe(6*4);
  });
  it('allows drainage to be turned off',()=>{const seg=street(0,0,140,0);const g=buildRoadKitDrains({streets:[seg],joins:buildRoadContinuity([seg]),cuts:new Map(),centerX:0,centerZ:0,baseY:0,water:0,ground:()=>1,spacing:0});expect(g.children).toHaveLength(0)});
});

describe('continuous road ribbons',()=>{
  it('shares edge vertices, curb heights and dash phase at a gentle bend',()=>{
    const first=street(0,0,40,0),second=street(40,0,80,4);
    const joins=buildRoadContinuity([first,second]);
    expect(joins.get(first)?.end).toBeTruthy();expect(joins.get(second)?.start).toBeTruthy();
    const texture=new THREE.CanvasTexture();
    const a=buildStreetRibbonMesh(first,0,0,0,texture,()=>1,.14,-1,joins.get(first));
    const b=buildStreetRibbonMesh(second,0,0,0,texture,()=>1,.14,-1,joins.get(second));
    const ap=a.geometry.getAttribute('position'),bp=b.geometry.getAttribute('position'),au=a.geometry.getAttribute('uv'),bu=b.geometry.getAttribute('uv');
    for(let i=0;i<17;i++){const j=ap.count-17+i;expect(ap.getX(j)).toBeCloseTo(bp.getX(i),4);expect(ap.getY(j)).toBeCloseTo(bp.getY(i),4);expect(ap.getZ(j)).toBeCloseTo(bp.getZ(i),4);expect(au.getX(j)).toBeCloseTo(bu.getX(i),4)}
  });
  it('keeps bridges and real junctions separate from ground-road welds',()=>{
    const first=street(0,0,40,0),bridge=street(40,0,80,0,true),turn=street(40,0,40,40);
    const joins=buildRoadContinuity([first,bridge,turn]);expect(joins.get(first)?.end).toBeUndefined();expect(joins.has(bridge)).toBe(false);
  });
});
