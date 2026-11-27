import { CITY_STREET_PLAN_SCALE } from './geoTerrain3D';

export interface ShanghaiMasterEdge {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  laneCount?: 2 | 4 | 6 | 8;
  kind: 'arterial' | 'street';
  isBridge?: boolean;
  bridgeStyle?: 'nanpu' | 'yangpu' | 'waibaidu';
}

export interface ShanghaiDistrictLabel {
  name: string;
  lat: number;
  lng: number;
  tier: 'city' | 'district' | 'town' | 'island';
}

const SH_ORIGIN_LAT = 31.23;
const SH_ORIGIN_LNG = 121.47;
const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = 111.32 * Math.cos((SH_ORIGIN_LAT * Math.PI) / 180);

/** Project real (lat, lng) into local meters/units relative to Shanghai city anchor (31.23°N, 121.47°E) */
export function shLatLngToLocal(lat: number, lng: number): [number, number] {
  const dx = (lng - SH_ORIGIN_LNG) * KM_PER_DEG_LNG * CITY_STREET_PLAN_SCALE;
  const dz = (SH_ORIGIN_LAT - lat) * KM_PER_DEG_LAT * CITY_STREET_PLAN_SCALE;
  return [Math.round(dx * 10) / 10, Math.round(dz * 10) / 10];
}

export const SHANGHAI_DISTRICT_LABELS: ShanghaiDistrictLabel[] = [
  { name: '上海市', lat: 31.231, lng: 121.469, tier: 'city' },
  { name: '黄浦区', lat: 31.222, lng: 121.484, tier: 'district' },
  { name: '静安区', lat: 31.242, lng: 121.452, tier: 'district' },
  { name: '徐汇区', lat: 31.185, lng: 121.436, tier: 'district' },
  { name: '长宁区', lat: 31.218, lng: 121.402, tier: 'district' },
  { name: '普陀区', lat: 31.252, lng: 121.392, tier: 'district' },
  { name: '虹口区', lat: 31.268, lng: 121.488, tier: 'district' },
  { name: '杨浦区', lat: 31.282, lng: 121.528, tier: 'district' },
  { name: '宝山区', lat: 31.388, lng: 121.445, tier: 'district' },
  { name: '闵行区', lat: 31.112, lng: 121.385, tier: 'district' },
  { name: '嘉定区', lat: 31.375, lng: 121.265, tier: 'district' },
  { name: '浦东新区', lat: 31.218, lng: 121.568, tier: 'district' },
  { name: '陆家嘴', lat: 31.238, lng: 121.508, tier: 'town' },
  { name: '张江', lat: 31.198, lng: 121.608, tier: 'town' },
  { name: '川沙新镇', lat: 31.192, lng: 121.696, tier: 'town' },
  { name: '三林镇', lat: 31.142, lng: 121.518, tier: 'town' },
  { name: '周浦镇', lat: 31.108, lng: 121.576, tier: 'town' },
  { name: '祝桥镇', lat: 31.118, lng: 121.736, tier: 'town' },
  { name: '高桥镇', lat: 31.344, lng: 121.572, tier: 'town' },
  { name: '罗店镇', lat: 31.408, lng: 121.352, tier: 'town' },
  { name: '七宝镇', lat: 31.155, lng: 121.348, tier: 'town' },
  { name: '长兴岛', lat: 31.396, lng: 121.688, tier: 'island' },
  { name: '横沙岛', lat: 31.342, lng: 121.842, tier: 'island' },
  { name: '崇明岛', lat: 31.545, lng: 121.625, tier: 'island' },
  { name: '青草沙', lat: 31.452, lng: 121.615, tier: 'island' },
];

/** Chaikin corner-smoothing subdivision so ring roads & curved avenues bend naturally with zero sharp kinks! */
function smoothPolylineChaikin(pts: [number, number][], closed: boolean, iterations = 2): [number, number][] {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    const next: [number, number][] = [];
    const n = cur.length;
    if (n < 3) return cur;
    if (!closed) next.push(cur[0]);
    const limit = closed ? n : n - 1;
    for (let i = 0; i < limit; i++) {
      const a = cur[i];
      const b = cur[(i + 1) % n];
      if (!closed && i === 0) {
        next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      } else if (!closed && i === limit - 1) {
        next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      } else {
        next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
    }
    if (!closed) next.push(cur[n - 1]);
    cur = next;
  }
  return cur;
}

/**
 * Generates an authentic GPS-accurate Shanghai Metropolitan Road Network:
 * - Inner Ring (内环高架), Middle Ring (中环路), Outer Ring (S20 外环高速)
 * - Yan'an Rd -> Century Ave -> Longdong Ave -> S1 Pudong Airport (延安高架—世纪大道—龙东大道)
 * - North-South Elevated -> Lupu Bridge -> Jiyang/Puxing Hwy (南北高架—卢浦大桥—浦星公路)
 * - Bund & Lujiazui Waterfront Boulevards + Waibaidu / Nanpu / Yangpu / Xupu Bridges + G40 Yangtze Bridge to Changxing/Chongming!
 * - Dense real-proportioned Puxi & Pudong urban district grids with planar intersection splitting & zero dead-end stubs!
 */
export function buildShanghaiRealRoadNetwork(
  riverSignedDist: (lx: number, lz: number) => number,
): ShanghaiMasterEdge[] {
  const rawEdges: ShanghaiMasterEdge[] = [];

  const addLatLngChain = (
    latLngs: [number, number][],
    closed: boolean,
    kind: 'arterial' | 'street',
    width: number,
    smoothPasses = 1,
    allowWaterTunnelOrBridge = false,
    bridgeStyleHint?: 'nanpu' | 'yangpu' | 'waibaidu',
    laneCount?: ShanghaiMasterEdge['laneCount'],
  ) => {
    const localPts = latLngs.map(([lat, lng]) => shLatLngToLocal(lat, lng));
    const pts = smoothPasses > 0 ? smoothPolylineChaikin(localPts, closed, smoothPasses) : localPts;
    const count = closed ? pts.length : pts.length - 1;
    let bridgeStartPt: [number, number] | null = null;
    for (let i = 0; i < count; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) < 2.5) continue;
      const dMid = riverSignedDist((p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5);
      const crossesWater = dMid < 0.8;
      if (crossesWater) {
        if (!allowWaterTunnelOrBridge) {
          bridgeStartPt = null;
          continue;
        }
        // Merge consecutive water-crossing sub-segments into ONE clean single-span bridge!
        if (!bridgeStartPt) bridgeStartPt = p1;
        const nextIdx = (i + 1) % count;
        const p3 = pts[(nextIdx + 1) % pts.length];
        const nextCrosses =
          (closed || i + 1 < count) &&
          riverSignedDist((p2[0] + p3[0]) * 0.5, (p2[1] + p3[1]) * 0.5) < 0.8;
        if (!nextCrosses) {
          const bx1 = bridgeStartPt[0];
          const bz1 = bridgeStartPt[1];
          const bx2 = p2[0];
          const bz2 = p2[1];
          const bMidX = (bx1 + bx2) * 0.5;
          const bMidZ = (bz1 + bz2) * 0.5;
          // STRICT BRIDGE NON-OVERLAP & NON-CROSSING GUARD: Never allow two bridges to cross or sit within 135u (~1.35km) of each other!
          const conflictsExistingBridge = rawEdges.some((ex) => {
            if (!ex.isBridge) return false;
            if (Math.hypot((ex.x1 + ex.x2) * 0.5 - bMidX, (ex.z1 + ex.z2) * 0.5 - bMidZ) < 135) return true;
            const dx1 = bx2 - bx1;
            const dz1 = bz2 - bz1;
            const dx2 = ex.x2 - ex.x1;
            const dz2 = ex.z2 - ex.z1;
            const denom = dx1 * dz2 - dz1 * dx2;
            if (Math.abs(denom) > 1e-3) {
              const t = ((ex.x1 - bx1) * dz2 - (ex.z1 - bz1) * dx2) / denom;
              const u = ((ex.x1 - bx1) * dz1 - (ex.z1 - bz1) * dx1) / denom;
              if (t >= -0.05 && t <= 1.05 && u >= -0.05 && u <= 1.05) return true;
            }
            return false;
          });
          if (!conflictsExistingBridge) {
            rawEdges.push({
              x1: bx1,
              z1: bz1,
              x2: bx2,
              z2: bz2,
              width,
              kind,
              laneCount,
              isBridge: true,
              bridgeStyle: bridgeStyleHint ?? (Math.hypot(bx2 - bx1, bz2 - bz1) < 85 ? 'waibaidu' : 'nanpu'),
            });
          }
          bridgeStartPt = null;
        }
        continue;
      }
      rawEdges.push({
        x1: p1[0],
        z1: p1[1],
        x2: p2[0],
        z2: p2[1],
        width,
        kind,
        laneCount,
      });
    }
  };

  // ==================== 1. SHANGHAI THREE CONCENTRIC RING EXPRESSWAYS (Spaced >=115 units apart for rich 3D building blocks!) ====================
  // 1A. Inner Ring Elevated Road (内环高架路: generously sized ~180u loop around downtown Puxi & Lujiazui so flagship civic buildings sit comfortably inside!)
  addLatLngChain(
    [
      [31.268, 121.462],
      [31.262, 121.405],
      [31.225, 121.392],
      [31.182, 121.418],
      [31.186, 121.472],
      [31.202, 121.503], // 南浦大桥
      [31.198, 121.568], // 龙阳路
      [31.235, 121.582], // 罗山路
      [31.262, 121.556], // 杨浦大桥
      [31.276, 121.515], // 黄兴路/内环北线
    ],
    true,
    'arterial',
    20,
    2,
    true,
    'nanpu',
  );

  // 1B. Middle Ring Road (中环路: ~125 units outside Inner Ring)
  addLatLngChain(
    [
      [31.322, 121.452],
      [31.308, 121.358],
      [31.235, 121.338],
      [31.148, 121.378],
      [31.132, 121.458], // 上中路越江
      [31.138, 121.548], // 华夏西路
      [31.172, 121.628], // 金科路/申江路
      [31.252, 121.635], // 金桥中环
      [31.315, 121.568], // 翔殷路越江
      [31.325, 121.505], // 汶水东路
    ],
    true,
    'arterial',
    19,
    2,
    true,
    'yangpu',
  );

  // 1C. S20 Outer Ring Expressway (S20 外环高速: ~135 units outside Middle Ring)
  addLatLngChain(
    [
      [31.385, 121.465],
      [31.368, 121.325],
      [31.265, 121.278],
      [31.168, 121.288],
      [31.088, 121.355], // 莘庄立交
      [31.082, 121.458], // 徐浦大桥
      [31.095, 121.575],
      [31.148, 121.705], // 川沙/S1迎宾立交
      [31.258, 121.695], // 曹路/金海路
      [31.348, 121.622], // 高东立交
      [31.385, 121.518], // 外环吴淞越江
    ],
    true,
    'arterial',
    19,
    2,
    true,
    'yangpu',
  );

  // ==================== 2. ICONIC SHANGHAI CROSS & RADIAL EXPRESSWAYS (Clean, Uncluttered Spacing!) ====================
  // 2A. Yan'an Elevated Rd -> Bund -> Century Ave -> Longdong Ave (延安高架—外滩—世纪大道—龙东大道)
  addLatLngChain(
    [
      [31.196, 121.215],
      [31.205, 121.315],
      [31.218, 121.392],
      [31.226, 121.455],
      [31.235, 121.488], // 外滩延安东路
      [31.238, 121.508], // 陆家嘴
      [31.218, 121.568], // 世纪大道—龙东大道
      [31.208, 121.655],
      [31.185, 121.755],
    ],
    false,
    'arterial',
    20,
    1,
    true,
    'waibaidu',
  );

  // 2B. North-South Elevated Rd -> Connects cleanly into Inner Ring on Puxi dry land, crosses at Lupu Bridge well West of Nanpu Bridge!
  addLatLngChain(
    [
      [31.385, 121.465],
      [31.322, 121.452],
      [31.268, 121.455],
      [31.226, 121.455], // 延安东路立交
      [31.184, 121.442], // 徐汇内环立交 (陆地衔接，不与南浦大桥江心交叉!)
      [31.162, 121.448], // 龙耀路/徐汇滨江北
      [31.154, 121.482], // 前滩越江大桥 (独立跨江通道!)
      [31.138, 121.548], // 衔接浦东中环华夏西路
      [31.085, 121.508],
      [31.015, 121.512],
    ],
    false,
    'arterial',
    20,
    1,
    true,
    'nanpu',
  );

  // 2C. Radial Outer Loops (S5沪嘉 / G2-G60西环 / S4-S2南环 / 浦东东环 / G40崇明长兴大桥!)
  addLatLngChain(
    [
      [31.308, 121.358],
      [31.385, 121.255], // 嘉定
      [31.412, 121.355], // 罗店
      [31.385, 121.465],
    ],
    false,
    'arterial',
    18,
    1,
    false,
  );
  addLatLngChain(
    [
      [31.385, 121.255],
      [31.295, 121.205],
      [31.196, 121.215],
      [31.105, 121.238], // 松江
      [31.088, 121.355],
    ],
    false,
    'arterial',
    18,
    1,
    false,
  );
  addLatLngChain(
    [
      [31.088, 121.355],
      [31.022, 121.385],
      [31.015, 121.512],
      [31.028, 121.635],
      [31.095, 121.645],
      [31.148, 121.705],
    ],
    false,
    'arterial',
    18,
    1,
    true,
    'nanpu',
  );
  addLatLngChain(
    [
      [31.348, 121.622],
      [31.268, 121.695],
      [31.185, 121.755],
      [31.095, 121.758],
      [31.038, 121.722],
      [31.028, 121.635],
    ],
    false,
    'arterial',
    18,
    1,
    false,
  );
  // G40 Yangtze Tunnel-Bridge across Changxing Island to Chongming Island!
  addLatLngChain(
    [
      [31.348, 121.622],
      [31.388, 121.668], // 长兴岛
      [31.468, 121.705], // 崇明陈家镇
      [31.532, 121.625],
      [31.545, 121.535],
      [31.492, 121.555],
      [31.468, 121.705],
    ],
    false,
    'arterial',
    16,
    1,
    true,
    'yangpu',
  );
  addLatLngChain(
    [
      [31.388, 121.668],
      [31.415, 121.642],
      [31.418, 121.715],
      [31.376, 121.738],
      [31.388, 121.668],
    ],
    true,
    'street',
    13,
    1,
    false,
  );

  // ==================== 3. 1:10 METROPOLITAN SHANGHAI STREET GRIDS (Dense ~155u Inner-Ring Blocks + ~310u Suburban District Grid!) ====================
  // 3A. Inner-Ring Downtown Puxi (People's Square / Jing'an / Bund / Xuhui / Hongkou) & Lujiazui CBD Grid (~155u block spacing!)
  const innerEwLats = [31.258, 31.244, 31.214, 31.200];
  for (const lat of innerEwLats) {
    const ptsInnerPuxi: [number, number][] = [];
    for (let lng = 121.395; lng <= 121.495; lng += 0.016) {
      ptsInnerPuxi.push([lat + Math.sin((lng - 121.45) * 32) * 0.0014, lng]);
    }
    addLatLngChain(ptsInnerPuxi, false, 'street', 14, 1, false);

    const ptsInnerPudong: [number, number][] = [];
    for (let lng = 121.500; lng <= 121.582; lng += 0.016) {
      ptsInnerPudong.push([lat + Math.cos((lng - 121.53) * 30) * 0.0014, lng]);
    }
    addLatLngChain(ptsInnerPudong, false, 'street', 14, 1, false);
  }

  const innerNsLngs = [121.412, 121.432, 121.472, 121.518, 121.542, 121.564];
  for (const lng of innerNsLngs) {
    const ptsInnerNS: [number, number][] = [];
    for (let lat = 31.184; lat <= 31.272; lat += 0.015) {
      ptsInnerNS.push([lat, lng + Math.sin((lat - 31.23) * 32) * 0.0014]);
    }
    addLatLngChain(ptsInnerNS, false, 'street', 14, 1, lng < 121.485, 'waibaidu');
  }

  // 3B. Greater Metropolitan District Collector Grid (Middle Ring -> S20 Outer Ring: Minhang, Hongqiao, Jiading, Baoshan, Zhangjiang, Chuansha!)
  const ewLats = [31.362, 31.334, 31.296, 31.168, 31.138, 31.108, 31.055];
  for (const lat of ewLats) {
    const westLng = lat > 31.31 ? 121.315 : 121.258;
    const midRiverLng = lat > 31.25 ? 121.542 : 121.486;
    const ptsPuxi: [number, number][] = [];
    for (let lng = westLng; lng <= midRiverLng + 0.002; lng += 0.030) {
      ptsPuxi.push([lat + Math.sin((lng - 121.45) * 24) * 0.0025, lng]);
    }
    addLatLngChain(ptsPuxi, false, 'street', 13, 1, false);

    if (lat >= 31.05 && lat <= 31.34) {
      const eastStart = lat > 31.255 ? 121.565 : 121.505;
      const eastEnd = lat > 31.27 ? 121.685 : 121.745;
      const ptsPudong: [number, number][] = [];
      for (let lng = eastStart; lng <= eastEnd + 0.002; lng += 0.032) {
        ptsPudong.push([lat + Math.cos((lng - 121.55) * 22) * 0.0025, lng]);
      }
      addLatLngChain(ptsPudong, false, 'street', 13, 1, false);
    }
  }

  const nsLngs = [121.292, 121.335, 121.376, 121.535, 121.592, 121.648, 121.708];
  for (const lng of nsLngs) {
    const southLat = 31.035;
    const northLat = lng < 121.51 ? 31.378 : lng < 121.62 ? 31.342 : 31.272;
    const ptsNS: [number, number][] = [];
    for (let lat = southLat; lat <= northLat + 0.002; lat += 0.030) {
      ptsNS.push([lat, lng + Math.sin((lat - 31.22) * 24) * 0.0025]);
    }
    addLatLngChain(ptsNS, false, 'street', 13, 1, lng < 121.49, 'waibaidu');
  }

  // ==================== 4. PLANAR INTERSECTION SPLITTING + 2-CORE PRUNING (0 DEAD-END ROADS!) ====================
  const weldVertices = (tol = 5.5) => {
    const verts: { x: number; z: number; locked: boolean }[] = [];
    const getV = (x: number, z: number, lock: boolean) => {
      for (const v of verts) {
        if (Math.hypot(v.x - x, v.z - z) <= tol) {
          if (lock && !v.locked) {
            v.x = x;
            v.z = z;
            v.locked = true;
          }
          return v;
        }
      }
      const nv = { x, z, locked: lock };
      verts.push(nv);
      return nv;
    };
    for (const e of rawEdges) {
      if (!e.isBridge) continue;
      const v1 = getV(e.x1, e.z1, true);
      const v2 = getV(e.x2, e.z2, true);
      e.x1 = v1.x;
      e.z1 = v1.z;
      e.x2 = v2.x;
      e.z2 = v2.z;
    }
    for (let i = rawEdges.length - 1; i >= 0; i--) {
      const e = rawEdges[i];
      if (e.isBridge) continue;
      const v1 = getV(e.x1, e.z1, false);
      const v2 = getV(e.x2, e.z2, false);
      e.x1 = v1.x;
      e.z1 = v1.z;
      e.x2 = v2.x;
      e.z2 = v2.z;
      if (Math.hypot(e.x2 - e.x1, e.z2 - e.z1) < 3.0) rawEdges.splice(i, 1);
    }
  };

  weldVertices(5.5);

  // Split all crossing segments cleanly into planar graph edges
  for (let pass = 0; pass < 3; pass++) {
    const nextList: ShanghaiMasterEdge[] = [];
    for (let i = 0; i < rawEdges.length; i++) {
      const a = rawEdges[i];
      if (a.isBridge) {
        nextList.push(a);
        continue;
      }
      const dx1 = a.x2 - a.x1;
      const dz1 = a.z2 - a.z1;
      const lenA = Math.hypot(dx1, dz1);
      if (lenA < 3) continue;
      const splits: number[] = [0, 1];
      for (let j = 0; j < rawEdges.length; j++) {
        if (i === j) continue;
        const b = rawEdges[j];
        const dx2 = b.x2 - b.x1;
        const dz2 = b.z2 - b.z1;
        const denom = dx1 * dz2 - dz1 * dx2;
        if (Math.abs(denom) > 1e-3) {
          const t = ((b.x1 - a.x1) * dz2 - (b.z1 - a.z1) * dx2) / denom;
          const u = ((b.x1 - a.x1) * dz1 - (b.z1 - a.z1) * dx1) / denom;
          if (t > 0.03 && t < 0.97 && u >= -0.03 && u <= 1.03) {
            splits.push(t);
          }
        }
        // Also split if b's endpoint touches a's interior within 6m
        for (const [bx, bz] of [
          [b.x1, b.z1],
          [b.x2, b.z2],
        ]) {
          const tProj = ((bx - a.x1) * dx1 + (bz - a.z1) * dz1) / (lenA * lenA);
          if (tProj > 0.05 && tProj < 0.95) {
            const px = a.x1 + dx1 * tProj;
            const pz = a.z1 + dz1 * tProj;
            if (Math.hypot(bx - px, bz - pz) <= 6.5) splits.push(tProj);
          }
        }
      }
      splits.sort((p, q) => p - q);
      let prevT = 0;
      for (let k = 1; k < splits.length; k++) {
        const curT = splits[k];
        if ((curT - prevT) * lenA >= 3.2) {
          nextList.push({
            x1: a.x1 + dx1 * prevT,
            z1: a.z1 + dz1 * prevT,
            x2: a.x1 + dx1 * curT,
            z2: a.z1 + dz1 * curT,
            width: a.width,
            kind: a.kind,
            laneCount: a.laneCount,
          });
          prevT = curT;
        }
      }
    }
    rawEdges.length = 0;
    rawEdges.push(...nextList);
    weldVertices(5.0);
  }

  // Filter out any non-bridge segment whose midpoint dipped into river water, deduplicate, and run 2-Core Dead-End Pruning!
  const vKey = (x: number, z: number) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
  for (let i = rawEdges.length - 1; i >= 0; i--) {
    const e = rawEdges[i];
    if (!e.isBridge && riverSignedDist((e.x1 + e.x2) * 0.5, (e.z1 + e.z2) * 0.5) < 1.8) {
      rawEdges.splice(i, 1);
    }
  }
  const dedup = () => {
    const seen = new Set<string>();
    for (let i = rawEdges.length - 1; i >= 0; i--) {
      const e = rawEdges[i];
      const ka = vKey(e.x1, e.z1);
      const kb = vKey(e.x2, e.z2);
      const pk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (ka === kb || seen.has(pk)) rawEdges.splice(i, 1);
      else seen.add(pk);
    }
  };
  dedup();

  for (let iter = 0; iter < 80; iter++) {
    const deg = new Map<string, number[]>();
    for (let i = 0; i < rawEdges.length; i++) {
      const e = rawEdges[i];
      const k1 = vKey(e.x1, e.z1);
      const k2 = vKey(e.x2, e.z2);
      if (!deg.has(k1)) deg.set(k1, []);
      if (!deg.has(k2)) deg.set(k2, []);
      deg.get(k1)!.push(i);
      deg.get(k2)!.push(i);
    }
    const rem = new Set<number>();
    for (const inc of deg.values()) {
      if (inc.length === 1) rem.add(inc[0]);
    }
    if (rem.size === 0) break;
    const sorted = Array.from(rem).sort((a, b) => b - a);
    for (const idx of sorted) rawEdges.splice(idx, 1);
    dedup();
  }

  return rawEdges;
}
