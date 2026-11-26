/**
 * 2D Symmetric Tensor Field + RK2 Streamline Tracing + Intersection Snapping Road Generator
 * Inspired by Chen et al. (2008) "Interactive Procedural Street Modeling" & Parish & Müller (2001).
 *
 * Key properties:
 * 1. Blends a city's REAL geographic river tangent field, incoming REAL highway directions,
 *    and local urban grid orientation into a continuous C1 2D symmetric tensor field T(x, z).
 * 2. Traces major arterial streamlines & minor street streamlines using 2nd-order Runge-Kutta (RK2)
 *    along the major & minor eigenvectors of T(x, z).
 * 3. Performs proximity node snapping & segment intersection splitting to produce a clean,
 *    organic, conflict-free planar road graph with crisp 3-way/4-way junctions and river bridges!
 */

export interface TensorRiverSpline {
  id: string;
  name: string;
  width: number;
  points: [number, number][]; // local [dx, dz] around city center (0, 0)
}

export interface TensorRoadEdge {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  kind: 'arterial' | 'street' | 'alley';
  isBridge?: boolean;
  bridgeStyle?: 'nanpu' | 'yangpu' | 'waibaidu';
}

export interface TensorJunction {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotY: number;
  kind: 'cross' | 'tee';
}

interface Vec2 {
  x: number;
  z: number;
}

interface Tensor2D {
  /** Symmetric traceless tensor components: [r*cos(2θ), r*sin(2θ)] */
  a: number;
  b: number;
}

function makeGridTensor(theta: number, weight = 1): Tensor2D {
  return {
    a: Math.cos(2 * theta) * weight,
    b: Math.sin(2 * theta) * weight,
  };
}

function makeRadialTensor(dx: number, dz: number, weight = 1): Tensor2D {
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-4) return { a: 0, b: 0 };
  // Symmetric radial tensor: eigenvectors align radially & tangentially (creates authentic curved ring roads & sweeping avenues!)
  return {
    a: ((dx * dx - dz * dz) / lenSq) * weight,
    b: ((2 * dx * dz) / lenSq) * weight,
  };
}

function majorEigenvector(t: Tensor2D): Vec2 {
  const len = Math.hypot(t.a, t.b);
  if (len < 1e-6) return { x: 1, z: 0 };
  const theta = 0.5 * Math.atan2(t.b, t.a);
  return { x: Math.cos(theta), z: Math.sin(theta) };
}

function minorEigenvector(t: Tensor2D): Vec2 {
  const maj = majorEigenvector(t);
  return { x: -maj.z, z: maj.x };
}

function distToSegmentWithClosest(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): { dist: number; cx: number; cz: number; tx: number; tz: number; t: number } {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-5) {
    return { dist: Math.hypot(px - x1, pz - z1), cx: x1, cz: z1, tx: 1, tz: 0, t: 0 };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / lenSq));
  const cx = x1 + t * vx;
  const cz = z1 + t * vz;
  const len = Math.sqrt(lenSq);
  return { dist: Math.hypot(px - cx, pz - cz), cx, cz, tx: vx / len, tz: vz / len, t };
}

function segCross(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): { x: number; z: number; t: number; u: number } | null {
  const rX = bx - ax;
  const rZ = bz - az;
  const sX = dx - cx;
  const sZ = dz - cz;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-4) return null;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / denom;
  const u = ((cx - ax) * rZ - (cz - az) * rX) / denom;
  if (t >= 0.01 && t <= 1.0 && u >= 0.01 && u <= 0.99) {
    return { x: ax + t * rX, z: az + t * rZ, t, u };
  }
  return null;
}

export interface TensorCityConfig {
  cityId: string;
  seed: number;
  radius: number;
  baseGridAngle: number;
  rivers: TensorRiverSpline[];
  /** Real incoming inter-city highway unit directions (from REAL_WORLD_CORRIDORS) */
  highwayAngles: number[];
  /** Signed distance to water (negative = inside river water) */
  riverSignedDist: (x: number, z: number) => number;
}

export interface TensorRoadGraphResult {
  edges: TensorRoadEdge[];
  junctions: TensorJunction[];
}

/**
 * Generates an organic, real-river-aligned & highway-connected planar urban street graph
 * using 2D Tensor Field RK2 Streamline Integration + Node/Edge Proximity Snapping!
 */
export function generateTensorCityRoads(cfg: TensorCityConfig): TensorRoadGraphResult {
  const { radius, baseGridAngle, rivers, highwayAngles, riverSignedDist, seed } = cfg;

  // Deterministic PRNG for slight natural urban variation
  let sRng = (seed * 1664525 + 1013904223) >>> 0;
  const rng = () => {
    sRng = (sRng * 1664525 + 1013904223) >>> 0;
    return sRng / 0xffffffff;
  };

  // Place 2 organic radial/ring-road tensor attractors unique to this city (creates sweeping real-city curves like Zhongshan Ring Road & Bund bends!)
  const hub1Ang = rng() * Math.PI * 2;
  const hub1X = Math.cos(hub1Ang) * (75 + rng() * 55);
  const hub1Z = Math.sin(hub1Ang) * (75 + rng() * 55);
  const hub2X = -hub1X * 0.85 + (rng() - 0.5) * 60;
  const hub2Z = -hub1Z * 0.85 + (rng() - 0.5) * 60;

  // Sample blended 2D symmetric tensor field T(x, z):
  // - Base city orientation grid (gentle foundation)
  // - Sweeping organic sinusoidal terrain/district bend field (±28° natural curvature -> roads curve gracefully instead of ruler-straight lines!)
  // - Radial/ring-road hubs (authentic urban ring-road sweeping turns!)
  // - Real river tangent alignment (dominant near riverbanks -> waterfront boulevards hug the real river!)
  const sampleField = (x: number, z: number): Tensor2D => {
    let a = 0;
    let b = 0;
    // Beijing preserves stronger axial grid; coastal/river metropolises (Shanghai, Hangzhou, Tokyo, etc.) bend more organically!
    const gridWeight = cfg.cityId === 'beijing' ? 1.15 : 0.62;
    const baseT = makeGridTensor(baseGridAngle, gridWeight);
    a += baseT.a;
    b += baseT.b;

    // Sweeping low-frequency organic curve field (creates graceful S-curves & natural urban avenue turns!)
    const warpAng =
      baseGridAngle +
      Math.sin(x * 0.0085 + z * 0.0045 + seed * 0.7) * 0.42 +
      Math.cos(z * 0.009 - x * 0.005 - seed * 0.4) * 0.34;
    const warpT = makeGridTensor(warpAng, 0.95);
    a += warpT.a;
    b += warpT.b;

    // Localized radial/ring tensor hubs (smoothly curving ring avenues around district centers!)
    const d1 = Math.hypot(x - hub1X, z - hub1Z);
    if (d1 > 22 && d1 < 210) {
      const rw1 = Math.exp(-Math.pow((d1 - 105) / 85, 2)) * 0.78;
      const rt1 = makeRadialTensor(x - hub1X, z - hub1Z, rw1);
      a += rt1.a;
      b += rt1.b;
    }
    const d2 = Math.hypot(x - hub2X, z - hub2Z);
    if (d2 > 22 && d2 < 200) {
      const rw2 = Math.exp(-Math.pow((d2 - 95) / 80, 2)) * 0.62;
      const rt2 = makeRadialTensor(x - hub2X, z - hub2Z, rw2);
      a += rt2.a;
      b += rt2.b;
    }

    // River-hugging tensor influence (strongest near real riverbanks -> creates authentic Bund / riverside curved avenues!)
    let bestRivDist = 9999;
    let bestRivAngle = baseGridAngle;
    for (const riv of rivers) {
      for (let i = 0; i < riv.points.length - 1; i++) {
        const [x1, z1] = riv.points[i];
        const [x2, z2] = riv.points[i + 1];
        const res = distToSegmentWithClosest(x, z, x1, z1, x2, z2);
        if (res.dist < bestRivDist) {
          bestRivDist = res.dist;
          bestRivAngle = Math.atan2(res.tz, res.tx);
        }
      }
    }
    if (bestRivDist < 140) {
      const w = Math.pow(1 - bestRivDist / 140, 1.4) * 3.1;
      const rivT = makeGridTensor(bestRivAngle, w);
      a += rivT.a;
      b += rivT.b;
    }

    // Incoming real highway corridor pull in outer urban belt
    const rCenter = Math.hypot(x, z);
    if (highwayAngles.length > 0 && rCenter > 90) {
      const ptAng = Math.atan2(z, x);
      for (const hAng of highwayAngles) {
        const dAng = Math.atan2(Math.sin(ptAng - hAng), Math.cos(ptAng - hAng));
        if (Math.abs(dAng) < 0.6) {
          const hw = (1 - Math.abs(dAng) / 0.6) * Math.min(1.4, (rCenter - 90) / 80);
          const ht = makeGridTensor(hAng, hw);
          a += ht.a;
          b += ht.b;
        }
      }
    }

    return { a, b };
  };

  // Orient eigenvector consistently with previous step direction so streamlines never flip 180°
  const sampleDir = (x: number, z: number, useMajor: boolean, prevDx: number, prevDz: number): Vec2 => {
    const t = sampleField(x, z);
    const v = useMajor ? majorEigenvector(t) : minorEigenvector(t);
    return v.x * prevDx + v.z * prevDz < 0 ? { x: -v.x, z: -v.z } : v;
  };

  // RK2 midpoint integration step along the tensor field
  const rk2Step = (x: number, z: number, stepLen: number, useMajor: boolean, prevDx: number, prevDz: number): Vec2 => {
    const k1 = sampleDir(x, z, useMajor, prevDx, prevDz);
    const mx = x + k1.x * stepLen * 0.5;
    const mz = z + k1.z * stepLen * 0.5;
    const k2 = sampleDir(mx, mz, useMajor, k1.x, k1.z);
    return { x: x + k2.x * stepLen, z: z + k2.z * stepLen };
  };

  const edges: TensorRoadEdge[] = [];
  const nodes: { x: number; z: number; degree: number; hasArterial: boolean; rotY: number }[] = [];

  const registerNode = (x: number, z: number, isArterial: boolean, rotY: number, snapRad = 12): { x: number; z: number } => {
    for (const nd of nodes) {
      if (Math.hypot(nd.x - x, nd.z - z) < snapRad) {
        nd.degree += 1;
        if (isArterial) {
          nd.hasArterial = true;
          nd.rotY = rotY;
        }
        return { x: nd.x, z: nd.z };
      }
    }
    nodes.push({ x, z, degree: 1, hasArterial: isArterial, rotY });
    return { x, z };
  };

  const isTooParallelNearExisting = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    minParallelDist: number,
  ): boolean => {
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    const vx = x2 - x1;
    const vz = z2 - z1;
    const vLen = Math.hypot(vx, vz) || 1;
    for (const ex of edges) {
      const res = distToSegmentWithClosest(mx, mz, ex.x1, ex.z1, ex.x2, ex.z2);
      if (res.dist < minParallelDist) {
        const dot = Math.abs((vx * res.tx + vz * res.tz) / vLen);
        if (dot > 0.72) return true;
      }
    }
    return false;
  };

  /**
   * Trace one continuous streamline in both + and - directions from (sx, sz) with:
   * - River bridge auto-bridging for arterials (and clean bank-stop for minor streets)
   * - Proximity snapping to existing intersections & road crossings
   */
  const traceStreamline = (
    sx: number,
    sz: number,
    useMajor: boolean,
    kind: 'arterial' | 'street',
    stepLen: number,
    minParallelSep: number,
    maxSteps = 16,
  ) => {
    const width = kind === 'arterial' ? 32 : 17;
    if (riverSignedDist(sx, sz) < 6) return;

    const initField = sampleField(sx, sz);
    const initVec = useMajor ? majorEigenvector(initField) : minorEigenvector(initField);

    for (const sign of [1, -1] as const) {
      let cx = sx;
      let cz = sz;
      let prevDx = initVec.x * sign;
      let prevDz = initVec.z * sign;

      for (let step = 0; step < maxSteps; step++) {
        const next = rk2Step(cx, cz, stepLen, useMajor, prevDx, prevDz);
        const nx = next.x;
        const nz = next.z;
        if (Math.hypot(nx, nz) > radius + 14) break;

        const segDx = nx - cx;
        const segDz = nz - cz;
        const segLen = Math.hypot(segDx, segDz);
        if (segLen < 4) break;
        const rotY = Math.atan2(segDx, segDz);

        // Check water crossing
        const dMid = riverSignedDist((cx + nx) * 0.5, (cz + nz) * 0.5);
        const dEnd = riverSignedDist(nx, nz);

        if (dMid < 2 || dEnd < 2) {
          if (kind === 'arterial') {
            // Scan ahead along the same vector to bridge cleanly across the REAL river!
            const uX = segDx / segLen;
            const uZ = segDz / segLen;
            let landDist = -1;
            for (let probe = stepLen; probe <= 96; probe += 5) {
              const px = cx + uX * probe;
              const pz = cz + uZ * probe;
              if (riverSignedDist(px, pz) > 8 && Math.hypot(px, pz) <= radius + 16) {
                landDist = probe;
                break;
              }
            }
            if (landDist > 16) {
              const bx = cx + uX * landDist;
              const bz = cz + uZ * landDist;
              // Keep real-scale generous spacing (~95m+) between cross-river bridges!
              const dupBridge = edges.some(
                (e) =>
                  e.isBridge &&
                  Math.hypot((e.x1 + e.x2) * 0.5 - (cx + bx) * 0.5, (e.z1 + e.z2) * 0.5 - (cz + bz) * 0.5) < 95,
              );
              if (!dupBridge) {
                const style =
                  landDist < 42 ? 'waibaidu' : edges.filter((e) => e.isBridge).length % 2 === 0 ? 'nanpu' : 'yangpu';
                edges.push({
                  x1: cx,
                  z1: cz,
                  x2: bx,
                  z2: bz,
                  width: style === 'waibaidu' ? 18 : 22,
                  kind: 'arterial',
                  isBridge: true,
                  bridgeStyle: style,
                });
                registerNode(cx, cz, true, rotY, 10);
                registerNode(bx, bz, true, rotY, 10);
                cx = bx;
                cz = bz;
                prevDx = uX;
                prevDz = uZ;
                continue;
              }
            }
          }
          // Secondary streets stop cleanly before the river bank
          break;
        }

        // Check crossing with an existing edge -> SNAP cleanly to exact intersection!
        let snappedHit: { x: number; z: number; t: number } | null = null;
        for (const ex of edges) {
          // Ignore edges sharing our exact start point
          if (Math.hypot(ex.x1 - cx, ex.z1 - cz) < 2 || Math.hypot(ex.x2 - cx, ex.z2 - cz) < 2) continue;
          const hit = segCross(cx, cz, nx, nz, ex.x1, ex.z1, ex.x2, ex.z2);
          if (hit && (!snappedHit || hit.t < snappedHit.t)) {
            snappedHit = hit;
          }
        }

        if (snappedHit) {
          if (Math.hypot(snappedHit.x - cx, snappedHit.z - cz) > 8) {
            edges.push({ x1: cx, z1: cz, x2: snappedHit.x, z2: snappedHit.z, width, kind });
            registerNode(cx, cz, kind === 'arterial', rotY, 10);
            registerNode(snappedHit.x, snappedHit.z, true, rotY, 12);
          }
          // Major arterials continue across intersections; secondary streets terminate cleanly at T-junctions!
          if (kind === 'street') break;
          cx = snappedHit.x;
          cz = snappedHit.z;
          prevDx = segDx / segLen;
          prevDz = segDz / segLen;
          continue;
        }

        // Proximity snap to nearby existing node (within 15m)
        let nearNode: { x: number; z: number } | null = null;
        for (const nd of nodes) {
          if (Math.hypot(nd.x - cx, nd.z - cz) < 8) continue;
          if (Math.hypot(nd.x - nx, nd.z - nz) < 15) {
            nearNode = nd;
            break;
          }
        }
        if (nearNode) {
          if (!isTooParallelNearExisting(cx, cz, nearNode.x, nearNode.z, minParallelSep * 0.72)) {
            edges.push({ x1: cx, z1: cz, x2: nearNode.x, z2: nearNode.z, width, kind });
            registerNode(cx, cz, kind === 'arterial', rotY, 10);
            registerNode(nearNode.x, nearNode.z, kind === 'arterial', rotY, 12);
          }
          break;
        }

        if (isTooParallelNearExisting(cx, cz, nx, nz, minParallelSep)) {
          break;
        }

        edges.push({ x1: cx, z1: cz, x2: nx, z2: nz, width, kind });
        registerNode(cx, cz, kind === 'arterial', rotY, 10);
        registerNode(nx, nz, kind === 'arterial', rotY, 10);

        cx = nx;
        cz = nz;
        prevDx = segDx / segLen;
        prevDz = segDz / segLen;
      }
    }
  };

  // ==================== PASS 1: ARTERIAL BOULEVARDS (Major + Minor Tensor Axes + Waterfront Avenues!) ====================
  // 1A. Primary central crossroads seeded on guaranteed dry land near city center
  let seedCx = 0;
  let seedCz = 0;
  if (riverSignedDist(0, 0) < 18) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const tx = Math.cos(ang) * 34;
      const tz = Math.sin(ang) * 34;
      if (riverSignedDist(tx, tz) > 22) {
        seedCx = tx;
        seedCz = tz;
        break;
      }
    }
  }
  // Use finer 24m RK2 steps so curves bend smoothly & organically instead of long straight chords!
  traceStreamline(seedCx, seedCz, true, 'arterial', 24, 114, 20);
  traceStreamline(seedCx, seedCz, false, 'arterial', 24, 114, 20);

  // 1B. Waterfront Boulevard parallel to the real river on BOTH banks (e.g. Bund + Lujiazui Riverside!)
  for (const riv of rivers.slice(0, 1)) {
    const midIdx = Math.floor(riv.points.length * 0.5);
    if (midIdx > 0 && midIdx < riv.points.length) {
      const [rx1, rz1] = riv.points[midIdx - 1];
      const [rx2, rz2] = riv.points[midIdx];
      const rLen = Math.hypot(rx2 - rx1, rz2 - rz1) || 1;
      const rnx = -(rz2 - rz1) / rLen;
      const rnz = (rx2 - rx1) / rLen;
      const mx = (rx1 + rx2) * 0.5;
      const mz = (rz1 + rz2) * 0.5;
      const bankOff = riv.width * 0.5 + 34;
      for (const side of [-1, 1]) {
        const bx = mx + rnx * side * bankOff;
        const bz = mz + rnz * side * bankOff;
        if (Math.hypot(bx, bz) < radius * 0.85 && riverSignedDist(bx, bz) > 16) {
          traceStreamline(bx, bz, true, 'arterial', 24, 108, 18);
        }
      }
    }
  }

  // 1C. Outer Arterial Ring / Grand Real-Scale Curved Block Avenues (~165m apart — ZERO cramped back-to-back intersections!)
  const outerOffs = [-165, 165];
  for (const off of outerOffs) {
    const sx1 = seedCx + Math.cos(baseGridAngle + Math.PI / 2) * off;
    const sz1 = seedCz + Math.sin(baseGridAngle + Math.PI / 2) * off;
    if (riverSignedDist(sx1, sz1) > 18) {
      traceStreamline(sx1, sz1, true, 'arterial', 24, 114, 18);
    }
    const sx2 = seedCx + Math.cos(baseGridAngle) * off;
    const sz2 = seedCz + Math.sin(baseGridAngle) * off;
    if (riverSignedDist(sx2, sz2) > 18) {
      traceStreamline(sx2, sz2, false, 'arterial', 24, 114, 18);
    }
  }

  // ==================== PASS 2: SECONDARY COLLECTOR STREETS (Curved Spacious ~85m Neighborhood Blocks!) ====================
  const streetSeeds: { x: number; z: number; major: boolean }[] = [];
  for (let gx = -240; gx <= 240; gx += 96) {
    for (let gz = -240; gz <= 240; gz += 96) {
      if (Math.hypot(gx, gz) > radius * 0.86) continue;
      if (riverSignedDist(gx, gz) > 22) {
        streetSeeds.push({ x: gx + (rng() - 0.5) * 14, z: gz + (rng() - 0.5) * 14, major: (gx + gz) % 192 === 0 });
      }
    }
  }

  for (const ss of streetSeeds) {
    traceStreamline(ss.x, ss.z, ss.major, 'street', 22, 74, 15);
    traceStreamline(ss.x, ss.z, !ss.major, 'street', 22, 74, 15);
  }

  // ==================== PASS 3: EXTRACT CLEAN PLANAR JUNCTION NODES (Minimum 56m spacing -> ZERO colliding crosswalks!) ====================
  const junctions: TensorJunction[] = [];
  for (const nd of nodes) {
    if (nd.degree < 3) continue;
    if (riverSignedDist(nd.x, nd.z) < 16) continue;
    if (junctions.some((j) => Math.hypot(j.x - nd.x, j.z - nd.z) < 56)) continue;
    const padW = nd.hasArterial ? 36 : 22;
    junctions.push({
      x: nd.x,
      z: nd.z,
      width: padW,
      depth: padW,
      rotY: nd.rotY,
      kind: nd.degree >= 4 ? 'cross' : 'tee',
    });
  }

  return { edges, junctions };
}
