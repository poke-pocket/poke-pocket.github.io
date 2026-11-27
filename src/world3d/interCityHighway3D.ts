import * as THREE from 'three';
import { getExactHighwayStationDeckY3D, WATER_LEVEL_3D } from '../data/survivorsTactics';
import {
  HIGHWAY_ROAD_WIDTH_3D,
  getCompiledInterCityNetwork,
  type HighwayExitPortal,
} from '../utils/interCityHighwayGraph';
import { makePixelTex } from './townGroundTextures';
import { applyRoadKitAsphalt, createRoadKitStreetlight, getRoadKitTexture, type RoadLaneCount } from './roadModelStyle3D';
import { createRoadDeckWalkways, type RoadDeckStation } from './roadKitElevated3D';
import { roadSidewalkOuterHalfWidth } from './roadKitDimensions';

const SIGN_TEX_CACHE = new Map<string, THREE.CanvasTexture>();

function getExpresswaySignTex(highwayLabel: string, destText: string): THREE.CanvasTexture {
  const key = `${highwayLabel}|${destText}`;
  let tex = SIGN_TEX_CACHE.get(key);
  if (tex) return tex;

  tex = makePixelTex(160, 56, (ctx) => {
    // Classic Chinese National Expressway Green Reflective Signboard (`国家高速绿底白字指路牌`)
    ctx.fillStyle = '#146c38';
    ctx.fillRect(0, 0, 160, 56);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(2.5, 2.5, 155, 51);

    // Top red/green national highway shield header
    ctx.fillStyle = '#c92a2a';
    ctx.fillRect(8, 7, 144, 15);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(highwayLabel, 80, 14.5);

    // Destination city & distance arrow
    ctx.fillStyle = '#fff9db';
    ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`↑ ${destText}`, 80, 38);
  });
  SIGN_TEX_CACHE.set(key, tex);
  return tex;
}

function buildExpresswayGantrySign3D(portal: HighwayExitPortal, groundY: number): THREE.Group {
  const g = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
  const boardBackMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
  const signTex = getExpresswaySignTex(portal.highwayLabel, `往 ${portal.destCityName} ${portal.distKm}km`);

  // Place roadside cantilever post right outside the right-hand shoulder of the outgoing highway!
  const nx = -portal.dirZ;
  const nz = portal.dirX;
  const px = portal.x + nx * (HIGHWAY_ROAD_WIDTH_3D * 0.5 + 1.8) + portal.dirX * 8.0;
  const pz = portal.z + nz * (HIGHWAY_ROAD_WIDTH_3D * 0.5 + 1.8) + portal.dirZ * 8.0;
  g.position.set(px, groundY, pz);
  // Face oncoming player walking out of the city toward `portal.dir`
  g.rotation.y = Math.atan2(-portal.dirX, -portal.dirZ);

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.6, 0.45), postMat);
  post.position.set(0, 2.8, 0);
  post.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 0.28), postMat);
  arm.position.set(-2.1, 5.1, 0);

  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.75, 0.18), boardBackMat);
  boardBack.position.set(-2.3, 5.05, -0.04);
  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(4.65, 1.62),
    new THREE.MeshBasicMaterial({ map: signTex }),
  );
  boardFace.position.set(-2.3, 5.05, 0.07);

  g.add(post, arm, boardBack, boardFace);
  return g;
}

/**
 * Dynamic Chunked 3D Inter-City Highway & Bridge Streamer:
 * - Connects seamlessly 1:1 to every city's outer-ring arterial street portal `(portal.x, portal.z)`.
 * - Streams `24m`-wide 4-lane asphalt highways, automatic water-crossing highway bridges, roadside `.vox` lamps,
 *   and green National Expressway direction signs within `320m` of the player at 60fps!
 */
export function createInterCityHighwayStreamer3D(opts: {
  scene: THREE.Scene;
  getGroundHeight: (x: number, z: number) => number;
  laneCount?: RoadLaneCount;
}) {
  const { scene, getGroundHeight } = opts;
  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  const roadMaterials = new Map<RoadLaneCount,THREE.MeshLambertMaterial>();
  const roadMaterial=(lanes:RoadLaneCount)=>{let mat=roadMaterials.get(lanes);if(!mat){mat=new THREE.MeshLambertMaterial({map:getRoadKitTexture(lanes),side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});applyRoadKitAsphalt(mat);roadMaterials.set(lanes,mat)}return mat};
  const railStoneMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });

  let lastSnapX = 999999;
  let lastSnapZ = 999999;
  let lastOriginKey = '';

  const clearChildren = () => {
    for (let i = rootGroup.children.length - 1; i >= 0; i--) {
      const ch = rootGroup.children[i];
      rootGroup.remove(ch);
      if (ch instanceof THREE.Mesh && ch.geometry) {
        ch.geometry.dispose();
      }
      if(ch.name==='RoadKit_deck_walkways')ch.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose()});
    }
  };

  const updateAround = (cx: number, cz: number, force = false) => {
    const net = getCompiledInterCityNetwork();
    if (!net) return;
    const snapX = Math.round(cx / 48) * 48;
    const snapZ = Math.round(cz / 48) * 48;
    if (!force && snapX === lastSnapX && snapZ === lastSnapZ && net.originKey === lastOriginKey) {
      return;
    }
    lastSnapX = snapX;
    lastSnapZ = snapZ;
    lastOriginKey = net.originKey;
    clearChildren();

    const streamR = 310;
    const halfW = HIGHWAY_ROAD_WIDTH_3D * 0.5;

    // 1. Mount Green Expressway Interchange Gantry Signs & Seamless Asphalt Merge Pads at nearby City Exit Portals!
    for (const portal of net.exitPortals) {
      if (Math.hypot(portal.x - snapX, portal.z - snapZ) > streamR) continue;
      const py = Math.max(WATER_LEVEL_3D + 0.22, getGroundHeight(portal.x, portal.z) + 0.14);
      rootGroup.add(buildExpresswayGantrySign3D(portal, py));
    }

    // 2. Build nearby 3D Highway Ribbon & Bridge Segments
    const seenSegIdx = new Set<number>();
    const minGx = Math.floor((snapX - streamR) / 128);
    const maxGx = Math.floor((snapX + streamR) / 128);
    const minGz = Math.floor((snapZ - streamR) / 128);
    const maxGz = Math.floor((snapZ + streamR) / 128);

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const bucket = net.gridBuckets.get(`${gx},${gz}`);
        if (!bucket) continue;
        for (const segIdx of bucket) {
          if (seenSegIdx.has(segIdx)) continue;
          seenSegIdx.add(segIdx);
          const seg = net.spatialSegs[segIdx];
          const midX = (seg.x1 + seg.x2) * 0.5;
          const midZ = (seg.z1 + seg.z2) * 0.5;
          if (Math.hypot(midX - snapX, midZ - snapZ) > streamR + 28) continue;

          const dist = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
          if (dist < 1.5) continue;
          const dirX = (seg.x2 - seg.x1) / dist;
          const dirZ = (seg.z2 - seg.z1) / dist;
          const yaw = Math.atan2(dirX, dirZ);
          const endPad = 0;
          const sx1 = seg.x1 - dirX * endPad;
          const sz1 = seg.z1 - dirZ * endPad;
          const sx2 = seg.x2 + dirX * endPad;
          const sz2 = seg.z2 + dirZ * endPad;
          const paddedDist = dist + endPad * 2;
          const steps = Math.max(3, Math.ceil(paddedDist / 3.5));
          const stepLen = paddedDist / steps;

          const positions: number[] = [];
          const uvs: number[] = [];
          const indices: number[] = [];
          const deckStations: RoadDeckStation[] = [];

          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const wx = sx1 + (sx2 - sx1) * t;
            const wz = sz1 + (sz2 - sz1) * t;
            const startWeight=Math.max(0,1-t*dist/4),endWeight=Math.max(0,1-(1-t)*dist/4);
            const normalX=-dirZ+((seg.startMiter?.[0]??-dirZ)+dirZ)*startWeight+((seg.endMiter?.[0]??-dirZ)+dirZ)*endWeight;
            const normalZ=dirX+((seg.startMiter?.[1]??dirX)-dirX)*startWeight+((seg.endMiter?.[1]??dirX)-dirX)*endWeight;
            const lx = wx - normalX*halfW;
            const lz = wz - normalZ*halfW;
            const rx = wx + normalX*halfW;
            const rz = wz + normalZ*halfW;

            const gC = getGroundHeight(wx, wz);
            const { deckY: edgeY, bridgeBlend } = getExactHighwayStationDeckY3D(
              wx,
              wz,
              dirX,
              dirZ,
              1.0,
              getGroundHeight,
            );
            const { deckY: crownY } = getExactHighwayStationDeckY3D(
              wx,
              wz,
              dirX,
              dirZ,
              0.0,
              getGroundHeight,
            );
            const isBridge = bridgeBlend > 0.65 && gC < WATER_LEVEL_3D + 0.25;
            const bridgeY = crownY;
            const edgeLY = edgeY;
            const edgeRY = edgeY;
            deckStations.push({x:wx,z:wz,y:crownY,leftY:edgeY,rightY:edgeY,halfWidth:halfW,nx:normalX,nz:normalZ,along:(seg.phaseStart??0)+t*paddedDist});

            positions.push(
              lx, edgeLY - 2.2, lz,
              lx, edgeLY, lz,
              wx, crownY, wz,
              rx, edgeRY, rz,
              rx, edgeRY - 2.2, rz,
            );
            const u = ((seg.phaseStart??0)+t * paddedDist) / 16.5;
            uvs.push(u, 0, u, 0, u, 0.5, u, 1, u, 1);

            if (s < steps) {
              const i0 = s * 5;
              const n0 = (s + 1) * 5;
              indices.push(i0, n0, i0 + 1, i0 + 1, n0, n0 + 1);
              indices.push(i0 + 1, n0 + 1, i0 + 2, i0 + 2, n0 + 1, n0 + 2);
              indices.push(i0 + 2, n0 + 2, i0 + 3, i0 + 3, n0 + 2, n0 + 3);
              indices.push(i0 + 3, n0 + 3, i0 + 4, i0 + 4, n0 + 3, n0 + 4);
            }

            if (isBridge && s < steps) {
              const mx = wx + dirX * stepLen * 0.5;
              const mz = wz + dirZ * stepLen * 0.5;
              for (const side of [-1, 1]) {
                const bx = mx + -dirZ * side * (roadSidewalkOuterHalfWidth(HIGHWAY_ROAD_WIDTH_3D) - 0.25);
                const bz = mz + dirX * side * (roadSidewalkOuterHalfWidth(HIGHWAY_ROAD_WIDTH_3D) - 0.25);
                const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.92, stepLen + 0.2), railStoneMat);
                parapet.position.set(bx, bridgeY + 0.46, bz);
                parapet.rotation.y = yaw;
                rootGroup.add(parapet);
              }
              if (s % 4 === 0) {
                const pierH = Math.max(2.6, bridgeY - gC + 1.2);
                const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, pierH, 1.4), pierMat);
                pier.position.set(wx, bridgeY - pierH * 0.5 - 0.1, wz);
                pier.rotation.y = yaw;
                rootGroup.add(pier);
              }
            }
          }

          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
          geo.setIndex(indices);
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, roadMaterial(seg.laneCount??opts.laneCount??4));
          mesh.receiveShadow = true;
          rootGroup.add(mesh);
          rootGroup.add(createRoadDeckWalkways(deckStations));

          // Occasional MagicaVoxel highway lamp along dry inter-city highway stretches!
          if (segIdx % 3 === 0 && getGroundHeight(midX, midZ) >= WATER_LEVEL_3D + 0.3) {
            const side = segIdx % 2 === 0 ? 1 : -1;
            const lx = midX + -dirZ * side * (HIGHWAY_ROAD_WIDTH_3D * .365);
            const lz = midZ + dirX * side * (HIGHWAY_ROAD_WIDTH_3D * .365);
            const lamp=createRoadKitStreetlight(8);
            lamp.position.set(lx,getGroundHeight(lx,lz)+.14,lz);
            lamp.rotation.y=Math.atan2(dirZ*side,-dirX*side);
            rootGroup.add(lamp);
          }
        }
      }
    }
  };

  const dispose = () => {
    clearChildren();
    for(const mat of roadMaterials.values())mat.dispose();
    scene.remove(rootGroup);
  };

  return { updateAround, dispose };
}
