import * as THREE from 'three';
import {
  BRIDGE_DECK_Y_3D,
  computeCityBridgeDeckWorldY3D,
  computeCityBridgeSurfaceWorldY3D,
  MOUNTAIN_TUNNEL_TRIGGER_Y,
  WATER_LEVEL_3D,
  WORLD_RAIL_SEGMENTS_3D,
  WORLD_ROAD_SEGMENTS_3D,
} from '../data/survivorsTactics';
import type { TownStreetSeg } from '../utils/townStreetGen';
import {
  mountGlbModel,
  STREET_LAMP_HALO_MAT,
  STREET_LAMP_POOL_MAT,
} from './townAssetLoader';
import { makePixelTex } from './townGroundTextures';
import { applyRoadKitAsphalt, applyRoadKitJunctionCuts, createRoadKitStreetlight, getRoadKitPavingMaterial, getRoadKitTactileMaterial, getRoadKitTexture, type RoadKitCut } from './roadModelStyle3D';
import type { RoadJoin } from './roadKitContinuity';
import { makeObbCollider, type TownCollider } from './townTypes';
import { createRoadDeckWalkways, type RoadDeckStation } from './roadKitElevated3D';
import { roadSidewalkOuterHalfWidth } from './roadKitDimensions';
import { mountVoxModel } from './voxLoader3D';

/**
 * Builds a sleek, modern, low-parapet architectural river bridge (`现代低护栏景观跨江大桥`):
 * - Replaces ugly 16m black pylon/cable cages completely!
 * - Clean stone/concrete river piers + sculpted low architectural parapets (`1.05u` tall) + warm avenue streetlights.
 */
export function buildModernCityBridge3D(opts: {
  seg: TownStreetSeg;
  centerX: number;
  centerZ: number;
  baseY: number;
  group: THREE.Group;
  colliders: TownCollider[];
  deckRoadTex: THREE.CanvasTexture;
  getGroundHeight: (x: number, z: number) => number;
}): void {
  const { seg, centerX, centerZ, baseY, group, colliders, deckRoadTex, getGroundHeight } = opts;
  const bLen = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const bMidX = (seg.x1 + seg.x2) * 0.5 - centerX;
  const bMidZ = (seg.z1 + seg.z2) * 0.5 - centerZ;
  const bYaw = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const deckY = computeCityBridgeDeckWorldY3D(seg, baseY, 0.5, getGroundHeight) - baseY;

  // Sleek arched concrete girder & asphalt deck ribbon flush with onshore avenues (0.0m step at ends!)
  const girderMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
  const parapetMat = new THREE.MeshLambertMaterial({
    color: seg.bridgeStyle === 'waibaidu' ? 0x64748b : 0xe2e8f0,
  });
  const capRailMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  const lampPoolGeo = new THREE.PlaneGeometry(10.8,10.8);
  lampPoolGeo.rotateX(-Math.PI/2);

  const bDirX = (seg.x2 - seg.x1) / Math.max(0.01, bLen);
  const bDirZ = (seg.z2 - seg.z1) / Math.max(0.01, bLen);
  const bNx = -bDirZ;
  const bNz = bDirX;
  const archSteps = Math.max(10, Math.ceil(bLen / 2.5));
  const deckPos: number[] = [];
  const deckUvs: number[] = [];
  const deckIdx: number[] = [];
  const deckStations: RoadDeckStation[] = [];
  const girderPos: number[] = [];
  const girderIdx: number[] = [];

  for (let s = 0; s <= archSteps; s++) {
    const t = s / archSteps;
    const wx = seg.x1 + (seg.x2 - seg.x1) * t;
    const wz = seg.z1 + (seg.z2 - seg.z1) * t;
    const halfW=THREE.MathUtils.lerp(seg.widthStart??seg.width,seg.widthEnd??seg.width,t)*.5;
    const heightAt=(x:number,z:number)=>computeCityBridgeSurfaceWorldY3D(seg,baseY,t,x,z,getGroundHeight);
    const yLocal = heightAt(wx,wz) - baseY;
    deckStations.push({x:wx,z:wz,y:yLocal+baseY,halfWidth:halfW,along:wx*bDirX+wz*bDirZ,heightAt});
    // The asphalt ends at the curb; the separate walkways own the sidewalk.
    const roadHalfW=halfW*.6875;
    const lx = wx - bNx * roadHalfW - centerX;
    const lz = wz - bNz * roadHalfW - centerZ;
    const rx = wx + bNx * roadHalfW - centerX;
    const rz = wz + bNz * roadHalfW - centerZ;
    deckPos.push(lx, heightAt(wx-bNx*roadHalfW,wz-bNz*roadHalfW)-baseY, lz, rx, heightAt(wx+bNx*roadHalfW,wz+bNz*roadHalfW)-baseY, rz);
    const u = (t * bLen) / 14;
    deckUvs.push(u, 20/128, u, 108/128);

    const girderHalfW=roadSidewalkOuterHalfWidth(halfW*2)+.22;
    const glx = wx - bNx * girderHalfW - centerX;
    const glz = wz - bNz * girderHalfW - centerZ;
    const grx = wx + bNx * girderHalfW - centerX;
    const grz = wz + bNz * girderHalfW - centerZ;
    const leftGirderY=heightAt(wx-bNx*girderHalfW,wz-bNz*girderHalfW)-baseY-.12;
    const rightGirderY=heightAt(wx+bNx*girderHalfW,wz+bNz*girderHalfW)-baseY-.12;
    girderPos.push(glx,leftGirderY-.8,glz,glx,leftGirderY,glz,grx,rightGirderY,grz,grx,rightGirderY-.8,grz);

    if (s < archSteps) {
      const d0 = s * 2;
      deckIdx.push(d0, d0 + 2, d0 + 1, d0 + 1, d0 + 2, d0 + 3);
      const g0 = s * 4;
      const gn = (s + 1) * 4;
      girderIdx.push(g0, gn, g0 + 1, g0 + 1, gn, gn + 1);
      // Close the underside only. A second coplanar top face causes
      // depth fighting and triangular holes against the visible road deck.
      girderIdx.push(g0, g0 + 3, gn, g0 + 3, gn + 3, gn);
      girderIdx.push(g0 + 2, gn + 2, g0 + 3, g0 + 3, gn + 2, gn + 3);
    }
  }

  const girderGeo = new THREE.BufferGeometry();
  girderGeo.setAttribute('position', new THREE.Float32BufferAttribute(girderPos, 3));
  girderGeo.setIndex(girderIdx);
  girderGeo.computeVertexNormals();
  const girderMesh = new THREE.Mesh(girderGeo, girderMat);
  girderMesh.name='RoadKit_bridge_girder';
  girderMesh.castShadow = true;
  girderMesh.receiveShadow = true;
  group.add(girderMesh);

  const deckTex = deckRoadTex.clone();
  deckTex.wrapS = THREE.RepeatWrapping;
  deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.needsUpdate = true;
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(deckUvs, 2));
  deckGeo.setIndex(deckIdx);
  deckGeo.computeVertexNormals();
  const deckMaterial = new THREE.MeshLambertMaterial({
      map: deckTex,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
  applyRoadKitAsphalt(deckMaterial);
  const deckMesh = new THREE.Mesh(deckGeo,deckMaterial);
  deckMesh.name='RoadKit_bridge_asphalt';
  deckMesh.receiveShadow = true;
  group.add(deckMesh);
  group.add(createRoadDeckWalkways(deckStations,centerX,centerZ,baseY));

  // Inset parapets to central 64% of span (where arch has leveled out at peakDeckY) so onshore intersections stay 100% open
  const railSpan = Math.max(6, bLen * 0.64);

  for (const side of [-1, 1]) {
    const rx = bMidX + bNx * side * (roadSidewalkOuterHalfWidth(seg.width)-.25);
    const rz = bMidZ + bNz * side * (roadSidewalkOuterHalfWidth(seg.width)-.25);
    colliders.push(makeObbCollider(centerX + rx, centerZ + rz, 0.45, railSpan * 0.5, bYaw, 2.4));

    // Low 1.05m sculpted stone/steel parapet wall + sleek dark handrail cap (completely open sky view!)
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.92, railSpan), parapetMat);
    parapet.position.set(rx, deckY + 0.46, rz);
    parapet.rotation.y = bYaw;
    parapet.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, railSpan + 0.2), capRailMat);
    cap.position.set(rx, deckY + 0.98, rz);
    cap.rotation.y = bYaw;
    group.add(parapet, cap);

    // Stepped voxel river piers underneath the bridge deck + MagicaVoxel `.vox` promenade lamp posts!
    for (const frac of [-0.28, 0, 0.28]) {
      const px = rx + bDirX * (railSpan * frac);
      const pz = rz + bDirZ * (railSpan * frac);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.35, 5.4, 1.35), pierMat);
      pier.position.set(px * 0.92 + bMidX * 0.08, deckY - 3.1, pz * 0.92 + bMidZ * 0.08);
      pier.rotation.y = bYaw;
      group.add(pier);

      const t=Math.max(0,Math.min(1,.5+railSpan*frac/Math.max(.01,bLen)));
      const wx=seg.x1+(seg.x2-seg.x1)*t,wz=seg.z1+(seg.z2-seg.z1)*t;
      const width=THREE.MathUtils.lerp(seg.widthStart??seg.width,seg.widthEnd??seg.width,t);
      const curbOffset=width*.34375+.8;
      const lampWorldX=wx+bNx*side*curbOffset,lampWorldZ=wz+bNz*side*curbOffset;
      const lampX=lampWorldX-centerX,lampZ=lampWorldZ-centerZ;
      const lampY=computeCityBridgeSurfaceWorldY3D(seg,baseY,t,lampWorldX,lampWorldZ,getGroundHeight)-baseY+.05;
      const light=createRoadKitStreetlight(8);
      const yaw=Math.atan2(-bNx*side,-bNz*side);
      light.position.set(lampX,lampY,lampZ);
      light.rotation.y=yaw;
      group.add(light);
      const halo = new THREE.Sprite(STREET_LAMP_HALO_MAT);
      halo.name='RoadKit_bridge_lamp_halo';
      halo.scale.set(3.2, 3.2, 1);
      halo.position.set(lampX+Math.sin(yaw)*2.1,lampY+7.94,lampZ+Math.cos(yaw)*2.1);
      group.add(halo);
      const pool=new THREE.Mesh(lampPoolGeo,STREET_LAMP_POOL_MAT);
      pool.name='RoadKit_bridge_lamp_pool';
      const poolX=lampWorldX+Math.sin(yaw)*1.4,poolZ=lampWorldZ+Math.cos(yaw)*1.4;
      pool.position.set(poolX-centerX,computeCityBridgeSurfaceWorldY3D(seg,baseY,t,poolX,poolZ,getGroundHeight)-baseY+.06,poolZ-centerZ);
      group.add(pool);
    }
  }
}

/**
 * Builds the Suburban High-Speed Rail Hub Terminal (`城郊高铁站枢纽`, e.g. Shanghai Hongqiao HSR Station):
 * - Sleek silver-and-glass wave canopy, elevated stone passenger platform, illuminated `高铁站` sign,
 *   suburban railway tracks, and CRH bullet express train!
 */
export function buildSuburbanHsrStation3D(opts: {
  group: THREE.Group;
  rail: { x1: number; z1: number; x2: number; z2: number }[];
  stationX: number;
  stationZ: number;
  stationRotY: number;
  centerX: number;
  centerZ: number;
  townName: string;
  localGroundY: (wx: number, wz: number) => number;
}): THREE.Group {
  const { group, rail, stationX, stationZ, stationRotY, centerX, centerZ, townName, localGroundY } = opts;

  for (const rl of rail) {
    const segLen = Math.hypot(rl.x2 - rl.x1, rl.z2 - rl.z1);
    const angle = Math.atan2(rl.z2 - rl.z1, rl.x2 - rl.x1);
    const steps = Math.max(2, Math.round(segLen / 6));
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const wx = rl.x1 + (rl.x2 - rl.x1) * t;
      const wz = rl.z1 + (rl.z2 - rl.z1) * t;
      void mountGlbModel(group, '/models/town/train/rail-straight.glb', {
        x: wx - centerX,
        y: localGroundY(wx, wz) + 0.04,
        z: wz - centerZ,
        rotY: -angle + Math.PI / 2,
        targetWidth: 6.4,
      });
    }
  }

  // Suburban HSR Passenger Platform & Modern Silver-Glass Terminal Canopy
  const stBaseY = localGroundY(stationX, stationZ);
  const hubGroup = new THREE.Group();
  hubGroup.position.set(stationX - centerX, stBaseY, stationZ - centerZ);
  hubGroup.rotation.y = stationRotY;

  const platMat = new THREE.MeshLambertMaterial({ color: 0xdbe2ec });
  const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xfcc419 });
  const silverRoofMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
  const glassCanopyMat = new THREE.MeshLambertMaterial({
    color: 0x74c0fc,
    transparent: true,
    opacity: 0.78,
  });
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x475569 });

  const platform = new THREE.Mesh(new THREE.BoxGeometry(28, 0.65, 6.2), platMat);
  platform.position.set(0, 0.32, 5.4);
  platform.receiveShadow = true;
  const safetyLine = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.04, 0.28), yellowLineMat);
  safetyLine.position.set(0, 0.66, 2.75);
  hubGroup.add(platform, safetyLine);

  for (const px of [-9.5, 0, 9.5]) {
    const colBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), pillarMat);
    colBase.position.set(px, 0.75, 6.2);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.68, 6.2, 0.68), pillarMat);
    col.position.set(px, 3.4, 6.2);
    hubGroup.add(colBase, col);
  }
  const canopyMain = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 11.5), silverRoofMat);
  canopyMain.position.set(0, 6.5, 3.8);
  canopyMain.castShadow = true;
  const skylight = new THREE.Mesh(new THREE.BoxGeometry(22, 0.62, 4.4), glassCanopyMat);
  skylight.position.set(0, 6.55, 3.8);
  hubGroup.add(canopyMain, skylight);

  const signTex = makePixelTex(128, 32, (ctx) => {
    ctx.fillStyle = '#183153';
    ctx.fillRect(0, 0, 128, 32);
    ctx.strokeStyle = '#74c0fc';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 29);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🚄 ${townName.replace(/市$/, '')}虹桥高铁站`, 64, 16);
  });
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 2.4, 0.45),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  signBoard.position.set(0, 8.0, 8.8);
  hubGroup.add(signBoard);
  group.add(hubGroup);

  // Express MagicaVoxel High-Speed Train (`veh_train.vox`) on the Suburban HSR Track!
  const trainGroup = new THREE.Group();
  trainGroup.position.set(stationX - centerX, stBaseY + 0.22, stationZ - centerZ);
  trainGroup.rotation.y = stationRotY;
  void mountVoxModel(trainGroup, '/models/vox/veh_train.vox', {
    x: 6.2,
    y: 0,
    z: 0,
    rotY: Math.PI / 2,
    targetSpan: 11.6,
    emitMode: 'vehicle',
  });
  void mountVoxModel(trainGroup, '/models/vox/veh_train.vox', {
    x: -6.2,
    y: 0,
    z: 0,
    rotY: -Math.PI / 2,
    targetSpan: 11.6,
    emitMode: 'vehicle',
  });
  group.add(trainGroup);
  return trainGroup;
}

/** Crowned street ribbon mesh that samples 7 cross-sectional points so rolling terrain never pokes through roads */
export function buildStreetRibbonMesh(
  seg: TownStreetSeg,
  baseY: number,
  originX: number,
  originZ: number,
  tex: THREE.CanvasTexture,
  getGroundHeight: (x: number, z: number) => number,
  layerLiftY = 0.14,
  polyOffsetFactor = -1,
  join?: RoadJoin,
  cuts:RoadKitCut[] = [],
): THREE.Mesh {
  const dist = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  const steps = Math.max(5, Math.ceil(dist / 2.6));
  const dirX = (seg.x2 - seg.x1) / Math.max(0.01, dist);
  const dirZ = (seg.z2 - seg.z1) / Math.max(0.01, dist);
  const wStart = seg.widthStart ?? seg.width;
  const wEnd = seg.widthEnd ?? seg.width;
  const endPad = Math.min(0.85, Math.max(wStart, wEnd) * 0.035);
  const startPad=join?.start?0:endPad,endPadding=join?.end?0:endPad;
  const sx1 = seg.x1 - dirX * startPad;
  const sz1 = seg.z1 - dirZ * startPad;
  const sx2 = seg.x2 + dirX * endPadding;
  const sz2 = seg.z2 + dirZ * endPadding;
  const paddedDist = dist + startPad + endPadding;

  const positions: number[] = [];
  const uvs: number[] = [];
  const materialIndices: number[][] = [[],[],[],[]];
  const sampleFracs = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const curHalfW = (wStart + (wEnd - wStart) * t) * 0.5;
    let nx=-dirZ,nz=dirX;
    const startBlend=join?.start?Math.max(0,1-t*paddedDist/4):0,endBlend=join?.end?Math.max(0,1-(1-t)*paddedDist/4):0;
    if(join?.start){nx+=(join.start.x+dirZ)*startBlend;nz+=(join.start.z-dirX)*startBlend}
    if(join?.end){nx+=(join.end.x+dirZ)*endBlend;nz+=(join.end.z-dirX)*endBlend}
    const perpX = nx * curHalfW;
    const perpZ = nz * curHalfW;
    const wx = sx1 + (sx2 - sx1) * t;
    const wz = sz1 + (sz2 - sz1) * t;
    const rawCenter = getGroundHeight(wx, wz);
    // Civil-engineered longitudinal vertical-curve smoothing along the interior of the block while locking exact junction endpoints!
    const endPin = Math.min(1, Math.min(t, 1 - t) * 5.0);
    const spanLook = Math.min(18.0, dist * 0.25);
    const hPrev = getGroundHeight(wx - dirX * spanLook, wz - dirZ * spanLook);
    const hNext = getGroundHeight(wx + dirX * spanLook, wz + dirZ * spanLook);
    const hSmooth = rawCenter * 0.5 + (hPrev + hNext) * 0.25;
    const hCenter = rawCenter + (hSmooth - rawCenter) * endPin;
    let maxLeftH = hCenter;
    let maxRightH = hCenter;
    for (let fi = 0; fi < sampleFracs.length; fi++) {
      const frac = sampleFracs[fi];
      const h = Math.min(hCenter + 0.08, getGroundHeight(wx + perpX * frac, wz + perpZ * frac));
      if (frac <= 0 && h > maxLeftH) maxLeftH = h;
      if (frac >= 0 && h > maxRightH) maxRightH = h;
    }
    const edgeLY = Math.max(WATER_LEVEL_3D + 0.22, maxLeftH + layerLiftY + 0.08) - baseY;
    const edgeRY = Math.max(WATER_LEVEL_3D + 0.22, maxRightH + layerLiftY + 0.08) - baseY;
    const crownY = Math.max(edgeLY, edgeRY) + 0.035;

    // Raised sidewalk and curb bands share the same terrain-adaptive ribbon.
    // Their positions stay inside the original road width and therefore do
    // not change the layout, collision rules or lane count.
    const bands = [
      [-1, edgeLY - 2.4, 0], [-1, edgeLY + .13, 0],
      [-.89, edgeLY + .13, .055], [-.89, edgeLY + .145, .055],
      [-.86, edgeLY + .145, .07], [-.86, edgeLY + .13, .07],
      [-.69, edgeLY + .13, .155], [-.6875, edgeLY, .15625],
      [0, crownY, .5], [.6875, edgeRY, .84375],
      [.69, edgeRY + .13, .845],
      [.86, edgeRY + .13, .93], [.86, edgeRY + .145, .93],
      [.89, edgeRY + .145, .945], [.89, edgeRY + .13, .945],
      [1, edgeRY + .13, 1],
      [1, edgeRY - 2.4, 1],
    ];
    const u = ((join?.phaseStart??0)+(join?.phaseSign??1)*(t*paddedDist-startPad)) / (seg.kind === 'arterial' ? 16.5 : 10.5);
    for (const [frac, y, v] of bands) { positions.push(wx + perpX * frac - originX, y, wz + perpZ * frac - originZ); uvs.push(u, v); }
    if (s < steps) {
      const i0 = s * bands.length, n0 = (s + 1) * bands.length;
      for (let k = 0; k < bands.length - 1; k++) {const mat=seg.kind==='alley'?0:([0,1,5,10,14,15].includes(k)?1:[6,9].includes(k)?2:[2,3,4,11,12,13].includes(k)?3:0);materialIndices[mat].push(i0+k,n0+k,i0+k+1,i0+k+1,n0+k,n0+k+1)}
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const indices:number[]=[];for(let i=0;i<materialIndices.length;i++){const start=indices.length;indices.push(...materialIndices[i]);if(materialIndices[i].length)geo.addGroup(start,materialIndices[i].length,i)}geo.setIndex(indices);
  geo.computeVertexNormals();
  const roadMaterial = new THREE.MeshLambertMaterial({
      map: tex,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: polyOffsetFactor,
      polygonOffsetUnits: polyOffsetFactor,
    });
  if(seg.kind!=='alley')applyRoadKitAsphalt(roadMaterial);
  const curbMaterial = new THREE.MeshLambertMaterial({color:0x9caaa6,side:THREE.DoubleSide});
  const pavementSource=getRoadKitPavingMaterial(),tactileSource=getRoadKitTactileMaterial();
  const pavement=cuts.length?pavementSource.clone():pavementSource,tactile=cuts.length?tactileSource.clone():tactileSource;
  if(cuts.length){pavement.onBeforeCompile=pavementSource.onBeforeCompile;pavement.customProgramCacheKey=pavementSource.customProgramCacheKey;for(const mat of [roadMaterial,pavement,curbMaterial,tactile])applyRoadKitJunctionCuts(mat,cuts)}
  const mesh = new THREE.Mesh(geo,[roadMaterial,pavement,curbMaterial,tactile]);
  mesh.receiveShadow = true;
  return mesh;
}

/** Terrain-adaptive Inter-Town Highway, Tunnel & High-Speed Rail Corridor Network */
export function buildInterTownRoadNetwork3D(
  getGroundHeight: (x: number, z: number) => number,
  getRawHeight?: (x: number, z: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  const roadW = 22.0;

  const railStoneMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
  const pierStoneMat = new THREE.MeshLambertMaterial({ color: 0x7c8594 });
  const tunnelStoneMat = new THREE.MeshLambertMaterial({ color: 0x565c69, side: THREE.DoubleSide });
  const tunnelPortalMat = new THREE.MeshLambertMaterial({ color: 0x7a7f8c });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });

  for (const [ax, az, bx, bz] of WORLD_ROAD_SEGMENTS_3D) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(10, Math.ceil(dist / 3.5));
    const stepLen = dist / steps;
    const dirX = (bx - ax) / dist;
    const dirZ = (bz - az) / dist;
    const headingYaw = Math.atan2(dirX, dirZ);
    const perpX = -dirZ * (roadW * 0.5);
    const perpZ = dirX * (roadW * 0.5);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const deckStations: RoadDeckStation[] = [];
    let prevWasTunnel = false;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      const lx = cx - perpX;
      const lz = cz - perpZ;
      const rx = cx + perpX;
      const rz = cz + perpZ;
      const rawCenter = (getRawHeight ?? getGroundHeight)(cx, cz);
      const groundL = getGroundHeight(lx, lz);
      const groundR = getGroundHeight(rx, rz);
      const groundC = getGroundHeight(cx, cz);

      const isBridge = groundC < WATER_LEVEL_3D + 0.18;
      const isTunnel = rawCenter > MOUNTAIN_TUNNEL_TRIGGER_Y;
      const surfaceY = isBridge ? BRIDGE_DECK_Y_3D : Math.max(WATER_LEVEL_3D + 0.25, groundC + 0.11);
      const yL = isBridge ? surfaceY : Math.max(WATER_LEVEL_3D + 0.25, groundL + 0.11);
      const yR = isBridge ? surfaceY : Math.max(WATER_LEVEL_3D + 0.25, groundR + 0.11);
      deckStations.push({x:cx,z:cz,y:(yL+yR)*.5,leftY:yL,rightY:yR,halfWidth:roadW*.5});

      positions.push(lx, yL - 1.5, lz, lx, yL, lz, rx, yR, rz, rx, yR - 1.5, rz);
      const u = (t * dist) / 10.5;
      uvs.push(u, 0, u, 0, u, 1, u, 1);

      if (s < steps) {
        const i0 = s * 4;
        const n0 = (s + 1) * 4;
        indices.push(i0, n0, i0 + 1, i0 + 1, n0, n0 + 1);
        indices.push(i0 + 1, n0 + 1, i0 + 2, i0 + 2, n0 + 1, n0 + 2);
        indices.push(i0 + 2, n0 + 2, i0 + 3, i0 + 3, n0 + 2, n0 + 3);
      }

      if (isBridge && s < steps) {
        const mx = cx + dirX * stepLen * 0.5;
        const mz = cz + dirZ * stepLen * 0.5;
        for (const side of [-1, 1]) {
          const rxOff = -dirZ * side * (roadSidewalkOuterHalfWidth(roadW) + 0.08);
          const rzOff = dirX * side * (roadSidewalkOuterHalfWidth(roadW) + 0.08);
          const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, stepLen + 0.25), railStoneMat);
          parapet.position.set(mx + rxOff, BRIDGE_DECK_Y_3D + 0.42, mz + rzOff);
          parapet.rotation.y = headingYaw;
          group.add(parapet);

          if (s % 3 === 0) {
            const pierH = Math.max(2.2, BRIDGE_DECK_Y_3D - groundC + 1.2);
            const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, pierH, 8), pierStoneMat);
            pier.position.set(cx + rxOff * 0.85, BRIDGE_DECK_Y_3D - pierH * 0.5 - 0.15, cz + rzOff * 0.85);
            const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), lampGlowMat);
            lantern.position.set(cx + rxOff, BRIDGE_DECK_Y_3D + 1.15, cz + rzOff);
            group.add(pier, lantern);
          }
        }
      }

      if (isTunnel && s < steps) {
        const mx = cx + dirX * stepLen * 0.5;
        const mz = cz + dirZ * stepLen * 0.5;
        const archRadius = roadW * 0.66;
        const archGeo = new THREE.CylinderGeometry(archRadius, archRadius, stepLen + 0.5, 10, 1, true, 0, Math.PI);
        archGeo.rotateZ(Math.PI / 2);
        archGeo.rotateY(Math.PI / 2);
        const vault = new THREE.Mesh(archGeo, tunnelStoneMat);
        vault.position.set(mx, surfaceY + 0.4, mz);
        vault.rotation.y = headingYaw;
        group.add(vault);

        if (!prevWasTunnel || s % 3 === 0) {
          const ringGeo = new THREE.TorusGeometry(archRadius + 0.18, !prevWasTunnel ? 0.65 : 0.35, 6, 12, Math.PI);
          const ring = new THREE.Mesh(ringGeo, tunnelPortalMat);
          ring.position.set(cx, surfaceY + 0.4, cz);
          ring.rotation.y = headingYaw;
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), lampGlowMat);
          lamp.position.set(mx, surfaceY + archRadius - 0.15, mz);
          group.add(ring, lamp);
        }
      }
      prevWasTunnel = isTunnel;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const material=new THREE.MeshLambertMaterial({ map: getRoadKitTexture(2), side: THREE.DoubleSide });applyRoadKitAsphalt(material);
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    group.add(mesh);
    group.add(createRoadDeckWalkways(deckStations));
  }

  // Inter-City High-Speed Rail Corridors (connecting outer suburban HSR hubs, never downtown!)
  const railTrackTex = makePixelTex(
    32,
    32,
    (ctx) => {
      ctx.fillStyle = '#737985';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#5b4b3e';
      for (let x = 2; x < 32; x += 8) ctx.fillRect(x, 4, 3, 24);
      ctx.fillStyle = '#dee2e6';
      ctx.fillRect(0, 7, 32, 2);
      ctx.fillRect(0, 14, 32, 2);
      ctx.fillRect(0, 18, 32, 2);
      ctx.fillRect(0, 25, 32, 2);
    },
    1,
    1,
  );
  const railMat = new THREE.MeshLambertMaterial({ map: railTrackTex, side: THREE.DoubleSide });
  const railW = 7.4;

  for (const [ax, az, bx, bz] of WORLD_RAIL_SEGMENTS_3D) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(12, Math.ceil(dist / 6.0));
    const dirX = (bx - ax) / dist;
    const dirZ = (bz - az) / dist;
    const perpX = -dirZ * (railW * 0.5);
    const perpZ = dirX * (railW * 0.5);
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = ax + (bx - ax) * t;
      const cz = az + (bz - az) * t;
      const gC = getGroundHeight(cx, cz);
      const isViaduct = gC < WATER_LEVEL_3D + 0.35;
      const sy = isViaduct ? BRIDGE_DECK_Y_3D + 0.45 : Math.max(WATER_LEVEL_3D + 0.3, gC + 0.16);
      positions.push(cx - perpX, sy, cz - perpZ, cx + perpX, sy, cz + perpZ);
      const u = (t * dist) / 7.0;
      uvs.push(u, 0, u, 1);
      if (s < steps) {
        const i0 = s * 2;
        indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
      if (isViaduct && s % 2 === 0) {
        const pierH = Math.max(2.6, sy - gC + 1.2);
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, pierH, 8), pierStoneMat);
        pier.position.set(cx, sy - pierH * 0.5 - 0.1, cz);
        group.add(pier);
      }
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    rGeo.setIndex(indices);
    rGeo.computeVertexNormals();
    const rMesh = new THREE.Mesh(rGeo, railMat);
    rMesh.receiveShadow = true;
    group.add(rMesh);
  }

  return group;
}
