import {
  GEO_UNITS_PER_KM,
  PROVINCIAL_AND_WORLD_CAPITALS,
  REAL_WORLD_CORRIDORS,
  geoToWorld,
  getActiveGeoTerrainOrigin,
  type GeoTerrainOrigin,
} from '../data/geoTerrain3D';
import { WORLD_CITIES, calcGeoDistanceKm } from '../data/worldTour';
import { generateTownLayout, hashCitySeed } from './townStreetGen';

export interface HighwayExitPortal {
  id: string;
  cityId: string;
  cityName: string;
  corridorId: string;
  highwayLabel: string;
  destCityName: string;
  distKm: number;
  /** Exact world coordinates where the city's outer arterial street meets the inter-city highway! */
  x: number;
  z: number;
  /** Outward unit direction along the departing highway */
  dirX: number;
  dirZ: number;
}

export interface CompiledHighwayLeg {
  id: string;
  corridorId: string;
  label: string;
  fromName: string;
  toName: string;
  /** Smoothly curved world-space polyline `[wx, wz][]` starting & ending strictly on city outer-ring arterial nodes! */
  points: [number, number][];
}

export interface CompiledCorridorChain {
  id: string;
  label: string;
  kind: 'rail' | 'ferry';
  points: [number, number][];
}

export interface CompiledInterCityNetwork {
  originKey: string;
  highwayLegs: CompiledHighwayLeg[];
  otherCorridors: CompiledCorridorChain[];
  exitPortals: HighwayExitPortal[];
  /** O(1) spatial hash bucket (cellSize = 128u) of nearby highway segments for 60fps 3D walking & streaming! */
  spatialSegs: {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    label: string;
    destHint: string;
    phaseStart?: number;
    startMiter?: [number,number];
    endMiter?: [number,number];
    laneCount?: 2 | 4 | 6 | 8;
  }[];
  gridBuckets: Map<string, number[]>;
}

interface KnownUrbanNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  wx: number;
  wz: number;
  isPlayableCity: boolean;
}

let cachedNet: CompiledInterCityNetwork | null = null;

/** Shared edge vector at a polyline joint, bounded at sharp bends. */
export function highwayJointMiter(points:[number,number][],i:number):[number,number]{
  const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
  let ax=p[0]-before[0],az=p[1]-before[1],bx=after[0]-p[0],bz=after[1]-p[1];
  if(Math.hypot(ax,az)<.001){ax=bx;az=bz}if(Math.hypot(bx,bz)<.001){bx=ax;bz=az}
  const al=Math.hypot(ax,az)||1,bl=Math.hypot(bx,bz)||1,nax=-az/al,naz=ax/al,nbx=-bz/bl,nbz=bx/bl;
  const mx=nax+nbx,mz=naz+nbz,den=mx*nbx+mz*nbz;
  if(den<.35)return [nbx,nbz];
  const scale=Math.min(1/den,1.4/(Math.hypot(mx,mz)||1));return [mx*scale,mz*scale];
}

function findMatchingUrbanNode(
  wx: number,
  wz: number,
  nodes: KnownUrbanNode[],
  maxRadiusUnits = 420,
): KnownUrbanNode | null {
  let best: KnownUrbanNode | null = null;
  let bestD = maxRadiusUnits;
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i];
    const d = Math.hypot(wx - nd.wx, wz - nd.wz);
    if (d < bestD) {
      bestD = d;
      best = nd;
    }
  }
  return best;
}

/**
 * Finds the EXACT outer-ring arterial road vertex `(vx, vz)` of `city`'s real street graph
 * facing neighbor direction `(dirX, dirZ)`, plus the street's outward unit tangent `(tx, tz)`!
 * - Within `3400` world units (`170km`) of the player's origin (or for any playable `WORLD_CITIES` within `4500u`),
 *   queries `generateTownLayout` so the highway welds 1:1 with zero gap onto a real 3D/2D street endpoint!
 * - Farther away on continental zoom, docks cleanly onto the city's outer bypass ring (`r = 215u`), NEVER stabbing `(cx, cz)`!
 */
function resolveCityOuterRoadPortal(
  city: KnownUrbanNode,
  dirX: number,
  dirZ: number,
): { x: number; z: number; tx: number; tz: number; outerR: number } {
  const distFromOrigin = Math.hypot(city.wx, city.wz);
  const useExactStreetGraph =
    distFromOrigin < 220 * GEO_UNITS_PER_KM || (city.isPlayableCity && distFromOrigin < 320 * GEO_UNITS_PER_KM);

  if (useExactStreetGraph) {
    const layout = generateTownLayout({
      id: `geo_city_${city.id}_${Math.round(city.wx)}_${Math.round(city.wz)}`,
      name: city.name,
      x: city.wx,
      z: city.wz,
      seed: hashCitySeed(city.id),
      plazaRadius: 1850,
      plateauY: 1.65,
      landmarkCityId: city.id,
    });

    let bestScore = -1e9;
    let bestPt: { x: number; z: number; tx: number; tz: number; r: number } | null = null;

    for (let i = 0; i < layout.streets.length; i++) {
      const st = layout.streets[i];
      if (st.isBridge || st.kind === 'rail') continue;
      const segLen = Math.hypot(st.x2 - st.x1, st.z2 - st.z1);
      if (segLen < 4) continue;

      const endpoints: [number, number, number, number][] = [
        [st.x1, st.z1, (st.x1 - st.x2) / segLen, (st.z1 - st.z2) / segLen],
        [st.x2, st.z2, (st.x2 - st.x1) / segLen, (st.z2 - st.z1) / segLen],
      ];

      for (const [vx, vz, outTx, outTz] of endpoints) {
        const rx = vx - city.wx;
        const rz = vz - city.wz;
        const r = Math.hypot(rx, rz);
        if (r < 380 || r > 2550) continue;
        const cosDir = (rx * dirX + rz * dirZ) / r;
        if (cosDir < 0.45) continue;

        // Prefer vertices on the outer perimeter whose street segment already points outward toward the neighbor!
        const tanAlign = Math.max(-0.2, outTx * dirX + outTz * dirZ);
        const artBonus = st.kind === 'arterial' ? 75 : 0;
        const score = r * Math.pow(cosDir, 1.45) + artBonus + tanAlign * 38;
        if (score > bestScore) {
          bestScore = score;
          // Blend street tangent with target direction so outgoing curve leaves smoothly without folding back
          const bx = outTx * 0.55 + dirX * 0.45;
          const bz = outTz * 0.55 + dirZ * 0.45;
          const bLen = Math.hypot(bx, bz) || 1;
          bestPt = { x: vx, z: vz, tx: bx / bLen, tz: bz / bLen, r };
        }
      }
    }

    if (bestPt) {
      return {
        x: bestPt.x,
        z: bestPt.z,
        tx: bestPt.tx,
        tz: bestPt.tz,
        outerR: bestPt.r,
      };
    }
  }

  const fallbackR = city.isPlayableCity ? 1350 : 920;
  return {
    x: city.wx + dirX * fallbackR,
    z: city.wz + dirZ * fallbackR,
    tx: dirX,
    tz: dirZ,
    outerR: fallbackR,
  };
}

/** Smooth Cubic Hermite + subtle organic countryside meander between two outer-ring portals */
function sampleCurvedHighwayLeg(
  x0: number,
  z0: number,
  tx0: number,
  tz0: number,
  x1: number,
  z1: number,
  tx1: number,
  tz1: number,
  seed: number,
  nearOrigin: boolean,
): [number, number][] {
  const chord = Math.hypot(x1 - x0, z1 - z0);
  if (chord < 2) return [[x0, z0], [x1, z1]];

  const stepSize = nearOrigin ? 36 : 180;
  const steps = Math.max(4, Math.min(2600, Math.ceil(chord / stepSize)));
  const handleScale = Math.min(chord * 0.36, 4800);
  const m0x = tx0 * handleScale;
  const m0z = tz0 * handleScale;
  const m1x = tx1 * handleScale;
  const m1z = tz1 * handleScale;

  const perpX = -(z1 - z0) / chord;
  const perpZ = (x1 - x0) / chord;
  const wobbleAmp = Math.min(420, chord * 0.032);

  const pts: [number, number][] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    let px = h00 * x0 + h10 * m0x + h01 * x1 + h11 * m1x;
    let pz = h00 * z0 + h10 * m0z + h01 * z1 + h11 * m1z;

    // Gentle S-curve countryside contour (tapered to 0 at both endpoints so portal welding is 100% exact!)
    const env = Math.sin(Math.PI * t);
    const wave =
      Math.sin(t * Math.PI * 2.0 + seed * 0.7) * 0.65 +
      Math.cos(t * Math.PI * 3.0 - seed * 1.1) * 0.35;
    px += perpX * wobbleAmp * env * env * wave;
    pz += perpZ * wobbleAmp * env * env * wave;

    pts.push([Math.round(px * 10) / 10, Math.round(pz * 10) / 10]);
  }
  pts[0] = [x0, z0];
  pts[pts.length - 1] = [x1, z1];
  return pts;
}

const GRID_CELL = 128;
function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

export function getCompiledInterCityNetwork(originOverride?: GeoTerrainOrigin | null): CompiledInterCityNetwork | null {
  const origin = originOverride ?? getActiveGeoTerrainOrigin();
  if (!origin) return null;
  const originKey = `${origin.originLat.toFixed(4)},${origin.originLng.toFixed(4)},${origin.startCityId ?? ''}`;
  if (cachedNet && cachedNet.originKey === originKey) {
    return cachedNet;
  }

  // 1. Gather all known cities in world coordinates
  const urbanNodes: KnownUrbanNode[] = [];
  const seenIds = new Set<string>();
  for (const wc of WORLD_CITIES) {
    const wp = geoToWorld(wc.lat, wc.lng, origin);
    if (!wp) continue;
    seenIds.add(wc.id);
    urbanNodes.push({
      id: wc.id,
      name: wc.name,
      lat: wc.lat,
      lng: wc.lng,
      wx: wp.x,
      wz: wp.z,
      isPlayableCity: true,
    });
  }
  for (const cap of PROVINCIAL_AND_WORLD_CAPITALS) {
    if (seenIds.has(cap.id)) continue;
    const wp = geoToWorld(cap.lat, cap.lng, origin);
    if (!wp) continue;
    seenIds.add(cap.id);
    urbanNodes.push({
      id: cap.id,
      name: cap.name,
      lat: cap.lat,
      lng: cap.lng,
      wx: wp.x,
      wz: wp.z,
      isPlayableCity: false,
    });
  }

  const highwayLegs: CompiledHighwayLeg[] = [];
  const otherCorridors: CompiledCorridorChain[] = [];
  const exitPortals: HighwayExitPortal[] = [];
  const spatialSegs: CompiledInterCityNetwork['spatialSegs'] = [];
  const gridBuckets = new Map<string, number[]>();

  const registerSpatialSeg = (x1: number, z1: number, x2: number, z2: number, label: string, destHint: string,phaseStart:number,startMiter:[number,number],endMiter:[number,number]) => {
    // Index segments within ~240km of active origin for fast O(1) 3D highway streaming & roadbed grading
    if (Math.hypot((x1 + x2) * 0.5, (z1 + z2) * 0.5) > 240 * GEO_UNITS_PER_KM) return;
    const idx = spatialSegs.length;
    spatialSegs.push({ x1, z1, x2, z2, label, destHint,phaseStart,startMiter,endMiter });
    const minGx = Math.floor((Math.min(x1, x2) - 40) / GRID_CELL);
    const maxGx = Math.floor((Math.max(x1, x2) + 40) / GRID_CELL);
    const minGz = Math.floor((Math.min(z1, z2) - 40) / GRID_CELL);
    const maxGz = Math.floor((Math.max(z1, z2) + 40) / GRID_CELL);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const k = cellKey(gx, gz);
        let arr = gridBuckets.get(k);
        if (!arr) {
          arr = [];
          gridBuckets.set(k, arr);
        }
        arr.push(idx);
      }
    }
  };

  for (let ci = 0; ci < REAL_WORLD_CORRIDORS.length; ci++) {
    const cor = REAL_WORLD_CORRIDORS[ci];
    const rawWorldPts = cor.points
      .map(([lat, lng]) => {
        const wp = geoToWorld(lat, lng, origin);
        return wp ? { lat, lng, x: wp.x, z: wp.z } : null;
      })
      .filter((p): p is { lat: number; lng: number; x: number; z: number } => p !== null);

    if (rawWorldPts.length < 2) continue;

    if (cor.kind === 'ferry') {
      otherCorridors.push({
        id: cor.id,
        label: cor.label,
        kind: 'ferry',
        points: rawWorldPts.map((p) => [p.x, p.z]),
      });
      continue;
    }

    if (cor.kind === 'rail') {
      // Snap railway waypoints near any known city directly to its suburban HSR station (`cx - 289, cz + 78` or `cx - 265, cz - 36`)!
      const railPts: [number, number][] = rawWorldPts.map((p) => {
        const hitCity = findMatchingUrbanNode(p.x, p.z, urbanNodes, 19 * GEO_UNITS_PER_KM);
        if (!hitCity) return [p.x, p.z];
        const offX = hitCity.id === 'shanghai' ? -289 : -265;
        const offZ = hitCity.id === 'shanghai' ? 78 : -36;
        return [hitCity.wx + offX, hitCity.wz + offZ];
      });
      otherCorridors.push({
        id: cor.id,
        label: cor.label,
        kind: 'rail',
        points: railPts,
      });
      continue;
    }

    // ==================== INTER-CITY HIGHWAY: DOCK EVERY LEG STRICTLY TO OUTER-RING ARTERIAL PORTALS! ====================
    for (let i = 0; i < rawWorldPts.length - 1; i++) {
      const a = rawWorldPts[i];
      const b = rawWorldPts[i + 1];
      const cityA = findMatchingUrbanNode(a.x, a.z, urbanNodes, 19 * GEO_UNITS_PER_KM);
      const cityB = findMatchingUrbanNode(b.x, b.z, urbanNodes, 19 * GEO_UNITS_PER_KM);

      const axCenter = cityA ? cityA.wx : a.x;
      const azCenter = cityA ? cityA.wz : a.z;
      const bxCenter = cityB ? cityB.wx : b.x;
      const bzCenter = cityB ? cityB.wz : b.z;

      const rawDx = bxCenter - axCenter;
      const rawDz = bzCenter - azCenter;
      const rawDist = Math.hypot(rawDx, rawDz);
      if (rawDist < 12) continue;
      const ux = rawDx / rawDist;
      const uz = rawDz / rawDist;

      const startPortal = cityA
        ? resolveCityOuterRoadPortal(cityA, ux, uz)
        : { x: a.x, z: a.z, tx: ux, tz: uz, outerR: 0 };
      const endPortal = cityB
        ? resolveCityOuterRoadPortal(cityB, -ux, -uz)
        : { x: b.x, z: b.z, tx: -ux, tz: -uz, outerR: 0 };

      // Guard for closely adjacent twin cities (e.g. Shenzhen <-> Hong Kong): never invert if outer rings touch!
      const portalVecX = endPortal.x - startPortal.x;
      const portalVecZ = endPortal.z - startPortal.z;
      const forwardProj = portalVecX * ux + portalVecZ * uz;

      const nearOrigin =
        Math.hypot(startPortal.x, startPortal.z) < 4200 ||
        Math.hypot(endPortal.x, endPortal.z) < 4200;

      const legPts: [number, number][] =
        forwardProj <= 16
          ? [
              [startPortal.x, startPortal.z],
              [endPortal.x, endPortal.z],
            ]
          : sampleCurvedHighwayLeg(
              startPortal.x,
              startPortal.z,
              startPortal.tx,
              startPortal.tz,
              endPortal.x,
              endPortal.z,
              -endPortal.tx,
              -endPortal.tz,
              ci * 37 + i * 13,
              nearOrigin,
            );

      const fromName = cityA?.name ?? '沿途枢纽';
      const toName = cityB?.name ?? '前方城镇';
      const distKm = Math.max(8, Math.round(calcGeoDistanceKm(a.lat, a.lng, b.lat, b.lng)));

      highwayLegs.push({
        id: `${cor.id}_leg_${i}`,
        corridorId: cor.id,
        label: cor.label,
        fromName,
        toName,
        points: legPts,
      });

      const destHint = `${toName} ${distKm}km`;
      let roadPhase=0;
      for (let s = 0; s < legPts.length - 1; s++) {
        registerSpatialSeg(
          legPts[s][0],
          legPts[s][1],
          legPts[s + 1][0],
          legPts[s + 1][1],
          cor.label,
          `${fromName} ↔ ${toName}`,
          roadPhase,highwayJointMiter(legPts,s),highwayJointMiter(legPts,s+1),
        );
        roadPhase+=Math.hypot(legPts[s+1][0]-legPts[s][0],legPts[s+1][1]-legPts[s][1]);
      }

      if (cityA && Math.hypot(startPortal.x, startPortal.z) < 220 * GEO_UNITS_PER_KM) {
        exitPortals.push({
          id: `portal_${cor.id}_${cityA.id}_to_${cityB?.id ?? i}`,
          cityId: cityA.id,
          cityName: cityA.name,
          corridorId: cor.id,
          highwayLabel: cor.label,
          destCityName: toName,
          distKm,
          x: startPortal.x,
          z: startPortal.z,
          dirX: startPortal.tx,
          dirZ: startPortal.tz,
        });
      }
      if (cityB && Math.hypot(endPortal.x, endPortal.z) < 220 * GEO_UNITS_PER_KM) {
        exitPortals.push({
          id: `portal_${cor.id}_${cityB.id}_to_${cityA?.id ?? i}`,
          cityId: cityB.id,
          cityName: cityB.name,
          corridorId: cor.id,
          highwayLabel: cor.label,
          destCityName: fromName,
          distKm,
          x: endPortal.x,
          z: endPortal.z,
          dirX: endPortal.tx,
          dirZ: endPortal.tz,
        });
      }
      void destHint;
    }
  }

  cachedNet = {
    originKey,
    highwayLegs,
    otherCorridors,
    exitPortals,
    spatialSegs,
    gridBuckets,
  };
  return cachedNet;
}

export interface HighwaySpatialProjection {
  dist: number;
  qx: number;
  qz: number;
  dirX: number;
  dirZ: number;
  segIdx: number;
  label: string;
}

/** O(1) spatial query for closest projection onto the nearest Real-Earth Inter-City Highway centerline! */
export function getNearestGeoHighwayProjection3D(wx: number, wz: number): HighwaySpatialProjection | null {
  const net = getCompiledInterCityNetwork();
  if (!net || net.spatialSegs.length === 0) return null;
  const gx = Math.floor(wx / GRID_CELL);
  const gz = Math.floor(wz / GRID_CELL);
  const bucket = net.gridBuckets.get(cellKey(gx, gz));
  if (!bucket || bucket.length === 0) return null;

  let bestDist = 9999;
  let bestQx = wx;
  let bestQz = wz;
  let bestDirX = 1;
  let bestDirZ = 0;
  let bestIdx = -1;
  let bestLabel = '';

  for (let i = 0; i < bucket.length; i++) {
    const segIdx = bucket[i];
    const seg = net.spatialSegs[segIdx];
    const vx = seg.x2 - seg.x1;
    const vz = seg.z2 - seg.z1;
    const lenSq = vx * vx + vz * vz;
    const t = lenSq > 1e-4 ? Math.max(0, Math.min(1, ((wx - seg.x1) * vx + (wz - seg.z1) * vz) / lenSq)) : 0;
    const qx = seg.x1 + vx * t;
    const qz = seg.z1 + vz * t;
    const d = Math.hypot(wx - qx, wz - qz);
    if (d < bestDist) {
      bestDist = d;
      bestQx = qx;
      bestQz = qz;
      const len = Math.sqrt(lenSq) || 1;
      bestDirX = vx / len;
      bestDirZ = vz / len;
      bestIdx = segIdx;
      bestLabel = seg.label;
    }
  }
  if (bestIdx < 0) return null;
  return {
    dist: bestDist,
    qx: bestQx,
    qz: bestQz,
    dirX: bestDirX,
    dirZ: bestDirZ,
    segIdx: bestIdx,
    label: bestLabel,
  };
}

/** O(1) spatial query for distance from `(wx, wz)` to the nearest Real-Earth Inter-City Highway centerline! */
export function getNearestGeoHighwayDist3D(wx: number, wz: number): number {
  const proj = getNearestGeoHighwayProjection3D(wx, wz);
  return proj ? proj.dist : 9999;
}

/** Authentic 4-lane highway roadbed width in meters (`24m`, independent of `GEO_UNITS_PER_KM`!) */
export const HIGHWAY_ROAD_WIDTH_3D = Math.max(22, Math.min(26, GEO_UNITS_PER_KM * 0.024));
