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
  /** Optional real-Earth dry-land urban boundary predicate (stops roads cleanly at real ocean coastlines & suburban edge!) */
  isUrbanLand?: (x: number, z: number) => boolean;
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
  const { radius, baseGridAngle, rivers, highwayAngles, riverSignedDist, isUrbanLand, seed } = cfg;
  const insideCity = (x: number, z: number) => {
    if (Math.hypot(x, z) > radius + 16) return false;
    return isUrbanLand ? isUrbanLand(x, z) : true;
  };

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

  const edges: (TensorRoadEdge & { streamId: number })[] = [];
  const nodes: { x: number; z: number; streamIds: Set<number>; degree: number; hasArterial: boolean; rotY: number }[] = [];
  let nextStreamId = 1;

  const registerNode = (
    x: number,
    z: number,
    streamId: number,
    isArterial: boolean,
    rotY: number,
    snapRad = 12,
  ): { x: number; z: number } => {
    for (const nd of nodes) {
      if (Math.hypot(nd.x - x, nd.z - z) < snapRad) {
        nd.degree += 1;
        nd.streamIds.add(streamId);
        if (isArterial) {
          nd.hasArterial = true;
          nd.rotY = rotY;
        }
        return { x: nd.x, z: nd.z };
      }
    }
    nodes.push({ x, z, streamIds: new Set([streamId]), degree: 1, hasArterial: isArterial, rotY });
    return { x, z };
  };

  const isTooParallelNearExisting = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    minParallelDist: number,
    selfStreamId: number,
  ): boolean => {
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    const vx = x2 - x1;
    const vz = z2 - z1;
    const vLen = Math.hypot(vx, vz) || 1;
    for (const ex of edges) {
      // CRITICAL: NEVER reject a streamline against its OWN previous segments!
      if (ex.streamId === selfStreamId) continue;
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
    maxSteps = 28,
  ) => {
    const width = kind === 'arterial' ? 32 : 17;
    if (riverSignedDist(sx, sz) < 6 || !insideCity(sx, sz)) return;
    if (edges.length >= 440) return;

    const streamId = nextStreamId++;
    const initField = sampleField(sx, sz);
    const initVec = useMajor ? majorEigenvector(initField) : minorEigenvector(initField);
    const createdInStream: (TensorRoadEdge & { streamId: number })[] = [];

    for (const sign of [1, -1] as const) {
      let cx = sx;
      let cz = sz;
      let prevDx = initVec.x * sign;
      let prevDz = initVec.z * sign;

      for (let step = 0; step < maxSteps; step++) {
        if (edges.length >= 440) break;
        const next = rk2Step(cx, cz, stepLen, useMajor, prevDx, prevDz);
        const nx = next.x;
        const nz = next.z;
        if (!insideCity(nx, nz) || !insideCity((cx + nx) * 0.5, (cz + nz) * 0.5)) break;

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
            // Scan ahead along the same vector to bridge cleanly across the REAL river (snug riverbank-to-riverbank!)
            const uX = segDx / segLen;
            const uZ = segDz / segLen;
            let landDist = -1;
            for (let probe = stepLen; probe <= 104; probe += 4) {
              const px = cx + uX * probe;
              const pz = cz + uZ * probe;
              if (riverSignedDist(px, pz) > 6.5 && insideCity(px, pz)) {
                landDist = probe;
                break;
              }
            }
            if (landDist > 16) {
              const bx = cx + uX * landDist;
              const bz = cz + uZ * landDist;
              // Keep real-scale generous spacing (~88m+) between cross-river bridges!
              const dupBridge = edges.some(
                (e) =>
                  e.isBridge &&
                  Math.hypot((e.x1 + e.x2) * 0.5 - (cx + bx) * 0.5, (e.z1 + e.z2) * 0.5 - (cz + bz) * 0.5) < 88,
              );
              if (!dupBridge) {
                const style =
                  landDist < 38 ? 'waibaidu' : edges.filter((e) => e.isBridge).length % 2 === 0 ? 'nanpu' : 'yangpu';
                const brWidth = style === 'waibaidu' ? 20 : 28;
                const brEdge: TensorRoadEdge & { streamId: number } = {
                  x1: cx,
                  z1: cz,
                  x2: bx,
                  z2: bz,
                  width: brWidth,
                  kind: 'arterial',
                  isBridge: true,
                  bridgeStyle: style,
                  streamId,
                };
                edges.push(brEdge);
                createdInStream.push(brEdge);
                registerNode(cx, cz, streamId, true, rotY, 12);
                registerNode(bx, bz, streamId, true, rotY, 12);
                // Guarantee a dry-land approach avenue segment immediately on the far bank so ZERO bridges end in grass!
                const farX = bx + uX * 32;
                const farZ = bz + uZ * 32;
                if (insideCity(farX, farZ) && riverSignedDist(farX, farZ) > 6) {
                  const farEdge: TensorRoadEdge & { streamId: number } = {
                    x1: bx,
                    z1: bz,
                    x2: farX,
                    z2: farZ,
                    width,
                    kind: 'arterial',
                    streamId,
                  };
                  edges.push(farEdge);
                  createdInStream.push(farEdge);
                  registerNode(farX, farZ, streamId, true, rotY, 12);
                  cx = farX;
                  cz = farZ;
                } else {
                  cx = bx;
                  cz = bz;
                }
                prevDx = uX;
                prevDz = uZ;
                continue;
              }
            }
          }
          // Secondary streets stop cleanly before the river bank
          break;
        }

        // Check crossing with an existing edge from a DIFFERENT streamline -> SNAP cleanly to exact intersection!
        let snappedHit: { x: number; z: number; t: number; otherStreamId: number } | null = null;
        for (const ex of edges) {
          if (ex.streamId === streamId) continue;
          if (Math.hypot(ex.x1 - cx, ex.z1 - cz) < 2 || Math.hypot(ex.x2 - cx, ex.z2 - cz) < 2) continue;
          const hit = segCross(cx, cz, nx, nz, ex.x1, ex.z1, ex.x2, ex.z2);
          if (hit && (!snappedHit || hit.t < snappedHit.t)) {
            snappedHit = { ...hit, otherStreamId: ex.streamId };
          }
        }

        if (snappedHit) {
          if (Math.hypot(snappedHit.x - cx, snappedHit.z - cz) > 6) {
            const eNew = { x1: cx, z1: cz, x2: snappedHit.x, z2: snappedHit.z, width, kind, streamId };
            edges.push(eNew);
            createdInStream.push(eNew);
            registerNode(cx, cz, streamId, kind === 'arterial', rotY, 10);
            const ndSnap = registerNode(snappedHit.x, snappedHit.z, streamId, true, rotY, 14);
            registerNode(ndSnap.x, ndSnap.z, snappedHit.otherStreamId, true, rotY, 14);
          }
          if (kind === 'street') break;
          cx = snappedHit.x;
          cz = snappedHit.z;
          prevDx = segDx / segLen;
          prevDz = segDz / segLen;
          continue;
        }

        // Proximity snap to nearby existing node from ANOTHER streamline (within 15m)
        let nearNode: { x: number; z: number } | null = null;
        for (const nd of nodes) {
          if (nd.streamIds.size === 1 && nd.streamIds.has(streamId)) continue;
          if (Math.hypot(nd.x - cx, nd.z - cz) < 8) continue;
          if (Math.hypot(nd.x - nx, nd.z - nz) < 15) {
            nearNode = nd;
            break;
          }
        }
        if (nearNode) {
          if (!isTooParallelNearExisting(cx, cz, nearNode.x, nearNode.z, minParallelSep * 0.72, streamId)) {
            const eNew = { x1: cx, z1: cz, x2: nearNode.x, z2: nearNode.z, width, kind, streamId };
            edges.push(eNew);
            createdInStream.push(eNew);
            registerNode(cx, cz, streamId, kind === 'arterial', rotY, 10);
            registerNode(nearNode.x, nearNode.z, streamId, kind === 'arterial', rotY, 14);
          }
          break;
        }

        if (isTooParallelNearExisting(cx, cz, nx, nz, minParallelSep, streamId)) {
          break;
        }

        const eNew = { x1: cx, z1: cz, x2: nx, z2: nz, width, kind, streamId };
        edges.push(eNew);
        createdInStream.push(eNew);
        registerNode(cx, cz, streamId, kind === 'arterial', rotY, 10);
        registerNode(nx, nz, streamId, kind === 'arterial', rotY, 10);

        cx = nx;
        cz = nz;
        prevDx = segDx / segLen;
        prevDz = segDz / segLen;
      }
    }

    // Prune isolated single-stub micro-roads (< 42m total length) so ZERO lonely disconnected road stubs ever appear!
    const totalLen = createdInStream.reduce((acc, e) => acc + Math.hypot(e.x2 - e.x1, e.z2 - e.z1), 0);
    if (totalLen < 42) {
      for (const rem of createdInStream) {
        const idx = edges.indexOf(rem);
        if (idx >= 0) edges.splice(idx, 1);
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
  // Use finer 28m RK2 steps with generous real-city block spacing (~230m arterial blocks, ~150m neighborhood blocks)
  // so 10x-area realistic department stores, clinics, hotels, restaurants & homes (~45-56m wide!) fit cleanly inside blocks!
  const artSteps = Math.max(22, Math.ceil(radius / 26));
  traceStreamline(seedCx, seedCz, true, 'arterial', 28, 210, artSteps);
  traceStreamline(seedCx, seedCz, false, 'arterial', 28, 210, artSteps);

  // 1B. Waterfront Boulevards parallel to ALL real rivers on BOTH banks (e.g. Bund + Lujiazui Riverside + Suzhou Creek Banks!)
  for (const riv of rivers) {
    for (const frac of [0.28, 0.52, 0.76]) {
      const midIdx = Math.max(1, Math.min(riv.points.length - 1, Math.floor(riv.points.length * frac)));
      if (midIdx > 0 && midIdx < riv.points.length) {
        const [rx1, rz1] = riv.points[midIdx - 1];
        const [rx2, rz2] = riv.points[midIdx];
        const rLen = Math.hypot(rx2 - rx1, rz2 - rz1) || 1;
        const rnx = -(rz2 - rz1) / rLen;
        const rnz = (rx2 - rx1) / rLen;
        const mx = (rx1 + rx2) * 0.5;
        const mz = (rz1 + rz2) * 0.5;
        const bankOff = riv.width * 0.5 + 36;
        for (const side of [-1, 1]) {
          const bx = mx + rnx * side * bankOff;
          const bz = mz + rnz * bankOff * side;
          if (insideCity(bx, bz) && riverSignedDist(bx, bz) > 14) {
            traceStreamline(bx, bz, true, 'arterial', 28, 165, artSteps);
          }
        }
      }
    }
  }

  // 1C. Full-Metropolis Curved Arterial Grid expanding across the ENTIRE real urban coastline (Puxi, North Suzhou Creek / Hongkou, Pudong, etc.)!
  const ringStep = 185;
  for (let off = -Math.floor(radius / ringStep) * ringStep; off <= radius; off += ringStep) {
    if (Math.abs(off) < 55) continue;
    const sx1 = seedCx + Math.cos(baseGridAngle + Math.PI / 2) * off;
    const sz1 = seedCz + Math.sin(baseGridAngle + Math.PI / 2) * off;
    if (insideCity(sx1, sz1) && riverSignedDist(sx1, sz1) > 16) {
      traceStreamline(sx1, sz1, true, 'arterial', 28, 175, artSteps);
    }
    const sx2 = seedCx + Math.cos(baseGridAngle) * off;
    const sz2 = seedCz + Math.sin(baseGridAngle) * off;
    if (insideCity(sx2, sz2) && riverSignedDist(sx2, sz2) > 16) {
      traceStreamline(sx2, sz2, false, 'arterial', 28, 175, artSteps);
    }
  }
  // Seed all districts on BOTH sides of creeks/rivers (including North bank z = -140..-380 & East bank x = +120..+420)!
  for (let gx = -radius + 90; gx <= radius - 90; gx += 195) {
    for (let gz = -radius + 90; gz <= radius - 90; gz += 195) {
      if (Math.hypot(gx, gz) < 115) continue;
      if (insideCity(gx, gz) && riverSignedDist(gx, gz) > 16) {
        traceStreamline(gx, gz, true, 'arterial', 28, 175, Math.ceil(artSteps * 0.8));
        traceStreamline(gx, gz, false, 'arterial', 28, 175, Math.ceil(artSteps * 0.8));
      }
    }
  }

  // ==================== PASS 2: SECONDARY COLLECTOR STREETS (Spacious ~132m Neighborhood Blocks for Realistic Large Buildings!) ====================
  const streetSeeds: { x: number; z: number; major: boolean }[] = [];
  const sMax = Math.min(radius - 40, 620);
  for (let gx = -sMax; gx <= sMax; gx += 140) {
    for (let gz = -sMax; gz <= sMax; gz += 140) {
      if (!insideCity(gx, gz)) continue;
      if (riverSignedDist(gx, gz) > 18) {
        streetSeeds.push({ x: gx + (rng() - 0.5) * 16, z: gz + (rng() - 0.5) * 16, major: (gx + gz) % 280 === 0 });
      }
    }
  }
  streetSeeds.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));

  for (const ss of streetSeeds) {
    traceStreamline(ss.x, ss.z, ss.major, 'street', 26, 126, 26);
    traceStreamline(ss.x, ss.z, !ss.major, 'street', 26, 126, 26);
  }

  // ==================== PASS 2B: STRICT BRIDGE-TO-ROAD CONNECTIVITY GUARANTEE ====================
  // Every bridge MUST connect at BOTH ends (x1,z1) and (x2,z2) directly onto a real dry-land road segment!
  for (let bi = edges.length - 1; bi >= 0; bi--) {
    const br = edges[bi];
    if (!br.isBridge) continue;
    const ensureEndConnected = (ex: number, ez: number): boolean => {
      const connected = edges.some(
        (o) =>
          !o.isBridge &&
          (Math.hypot(o.x1 - ex, o.z1 - ez) < 6.5 || Math.hypot(o.x2 - ex, o.z2 - ez) < 6.5),
      );
      if (connected) return true;
      // Search closest point on ANY dry-land road segment within 110m on the SAME side of the river
      let bestHit: { x: number; z: number; d: number; targetIdx: number; t: number } | null = null;
      for (let oi = 0; oi < edges.length; oi++) {
        const o = edges[oi];
        if (o.isBridge) continue;
        const dx = o.x2 - o.x1;
        const dz = o.z2 - o.z1;
        const lenSq = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((ex - o.x1) * dx + (ez - o.z1) * dz) / lenSq));
        const px = o.x1 + dx * t;
        const pz = o.z1 + dz * t;
        const d = Math.hypot(px - ex, pz - ez);
        if (
          d >= 2 &&
          d < 110 &&
          riverSignedDist((ex + px) * 0.5, (ez + pz) * 0.5) > 3 &&
          riverSignedDist(ex * 0.75 + px * 0.25, ez * 0.75 + pz * 0.25) > 2.5
        ) {
          if (!bestHit || d < bestHit.d) bestHit = { x: px, z: pz, d, targetIdx: oi, t };
        }
      }
      if (bestHit) {
        const tgt = edges[bestHit.targetIdx];
        let sx = bestHit.x;
        let sz = bestHit.z;
        if (Math.hypot(sx - tgt.x1, sz - tgt.z1) < 8) {
          sx = tgt.x1;
          sz = tgt.z1;
        } else if (Math.hypot(sx - tgt.x2, sz - tgt.z2) < 8) {
          sx = tgt.x2;
          sz = tgt.z2;
        } else {
          // Split target road segment cleanly at (sx, sz) so the bridgehead forms a true planar junction!
          const origX2 = tgt.x2;
          const origZ2 = tgt.z2;
          tgt.x2 = sx;
          tgt.z2 = sz;
          edges.push({
            x1: sx,
            z1: sz,
            x2: origX2,
            z2: origZ2,
            width: tgt.width,
            kind: tgt.kind,
            streamId: tgt.streamId,
          });
        }
        if (Math.hypot(sx - ex, sz - ez) > 2) {
          edges.push({
            x1: ex,
            z1: ez,
            x2: sx,
            z2: sz,
            width: br.width,
            kind: 'arterial',
            streamId: br.streamId,
          });
        } else if (Math.hypot(br.x1 - ex, br.z1 - ez) < 1) {
          br.x1 = sx;
          br.z1 = sz;
        } else {
          br.x2 = sx;
          br.z2 = sz;
        }
        return true;
      }
      return false;
    };
    const ok1 = ensureEndConnected(br.x1, br.z1);
    const ok2 = ensureEndConnected(br.x2, br.z2);
    if (!ok1 || !ok2) {
      edges.splice(bi, 1);
    }
  }

  // ==================== PASS 2C: TRUE PLANAR TOPOLOGY & ZERO DEAD-END ROADS (消除全部断头路!) ====================
  type EdgeItem = TensorRoadEdge & { streamId: number };

  // Helper 1: Weld nearby road endpoints so crossing/touching segments share exact (x, z) vertex coordinates
  const weldGraphVertices = (weldTol = 6.5) => {
    const verts: { x: number; z: number; locked: boolean }[] = [];
    const findOrAddVert = (x: number, z: number, lockPos: boolean): { x: number; z: number } => {
      for (const v of verts) {
        if (Math.hypot(v.x - x, v.z - z) <= weldTol) {
          if (lockPos && !v.locked) {
            v.x = x;
            v.z = z;
            v.locked = true;
          }
          return v;
        }
      }
      const nv = { x, z, locked: lockPos };
      verts.push(nv);
      return nv;
    };
    // Register bridgeheads first as locked anchor vertices so bridge spans stay crisp
    for (const e of edges) {
      if (!e.isBridge) continue;
      const v1 = findOrAddVert(e.x1, e.z1, true);
      const v2 = findOrAddVert(e.x2, e.z2, true);
      e.x1 = v1.x;
      e.z1 = v1.z;
      e.x2 = v2.x;
      e.z2 = v2.z;
    }
    for (let i = edges.length - 1; i >= 0; i--) {
      const e = edges[i];
      if (e.isBridge) continue;
      const v1 = findOrAddVert(e.x1, e.z1, false);
      const v2 = findOrAddVert(e.x2, e.z2, false);
      e.x1 = v1.x;
      e.z1 = v1.z;
      e.x2 = v2.x;
      e.z2 = v2.z;
      if (Math.hypot(e.x2 - e.x1, e.z2 - e.z1) < 3.5) {
        edges.splice(i, 1);
      }
    }
  };

  // Helper 2: Planar intersection splitting + T-junction endpoint-to-segment splitting
  const splitPlanarIntersections = () => {
    for (let pass = 0; pass < 4; pass++) {
      let splitAny = false;
      outer: for (let i = 0; i < edges.length; i++) {
        const a = edges[i];
        if (a.isBridge) continue;
        for (let j = i + 1; j < edges.length; j++) {
          const b = edges[j];
          if (b.isBridge) continue;
          const shareEnd =
            Math.hypot(a.x1 - b.x1, a.z1 - b.z1) < 4.5 ||
            Math.hypot(a.x1 - b.x2, a.z1 - b.z2) < 4.5 ||
            Math.hypot(a.x2 - b.x1, a.z2 - b.z1) < 4.5 ||
            Math.hypot(a.x2 - b.x2, a.z2 - b.z2) < 4.5;
          if (shareEnd) continue;

          const dx1 = a.x2 - a.x1;
          const dz1 = a.z2 - a.z1;
          const dx2 = b.x2 - b.x1;
          const dz2 = b.z2 - b.z1;
          const denom = dx1 * dz2 - dz1 * dx2;
          if (Math.abs(denom) > 1e-3) {
            const t = ((b.x1 - a.x1) * dz2 - (b.z1 - a.z1) * dx2) / denom;
            const u = ((b.x1 - a.x1) * dz1 - (b.z1 - a.z1) * dx1) / denom;
            if (t >= -0.02 && t <= 1.02 && u >= -0.02 && u <= 1.02) {
              const ix = a.x1 + Math.max(0, Math.min(1, t)) * dx1;
              const iz = a.z1 + Math.max(0, Math.min(1, t)) * dz1;
              const splitEdgeAt = (e: EdgeItem): boolean => {
                if (Math.hypot(ix - e.x1, iz - e.z1) < 5.5) {
                  e.x1 = ix;
                  e.z1 = iz;
                  return false;
                }
                if (Math.hypot(ix - e.x2, iz - e.z2) < 5.5) {
                  e.x2 = ix;
                  e.z2 = iz;
                  return false;
                }
                const ox2 = e.x2;
                const oz2 = e.z2;
                e.x2 = ix;
                e.z2 = iz;
                edges.push({ x1: ix, z1: iz, x2: ox2, z2: oz2, width: e.width, kind: e.kind, streamId: e.streamId });
                return true;
              };
              const sa = splitEdgeAt(a);
              const sb = splitEdgeAt(b);
              if (sa || sb) {
                splitAny = true;
                break outer;
              }
            }
          }
        }
      }
      // Also snap any endpoint sitting within 7m of another segment's interior (unsplit T-junction!)
      for (let i = 0; i < edges.length && !splitAny; i++) {
        const a = edges[i];
        for (const [endIdx, ex, ez] of [
          [1, a.x1, a.z1],
          [2, a.x2, a.z2],
        ] as const) {
          for (let j = 0; j < edges.length; j++) {
            if (i === j) continue;
            const b = edges[j];
            if (b.isBridge) continue;
            if (Math.hypot(ex - b.x1, ez - b.z1) < 6.5 || Math.hypot(ex - b.x2, ez - b.z2) < 6.5) continue;
            const dx = b.x2 - b.x1;
            const dz = b.z2 - b.z1;
            const lenSq = dx * dx + dz * dz || 1;
            const t = ((ex - b.x1) * dx + (ez - b.z1) * dz) / lenSq;
            if (t > 0.08 && t < 0.92) {
              const px = b.x1 + dx * t;
              const pz = b.z1 + dz * t;
              if (Math.hypot(ex - px, ez - pz) < 7.5) {
                if (!a.isBridge) {
                  if (endIdx === 1) {
                    a.x1 = px;
                    a.z1 = pz;
                  } else {
                    a.x2 = px;
                    a.z2 = pz;
                  }
                }
                const ox2 = b.x2;
                const oz2 = b.z2;
                b.x2 = px;
                b.z2 = pz;
                edges.push({ x1: px, z1: pz, x2: ox2, z2: oz2, width: b.width, kind: b.kind, streamId: b.streamId });
                splitAny = true;
                break;
              }
            }
          }
          if (splitAny) break;
        }
      }
      weldGraphVertices(6.0);
      if (!splitAny) break;
    }
  };

  weldGraphVertices(6.5);
  splitPlanarIntersections();

  // Helper 3: Compute vertex map from current edges
  const vKey = (x: number, z: number) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
  const buildVertexMap = () => {
    const map = new Map<
      string,
      { x: number; z: number; inc: { edgeIdx: number; end: 1 | 2; otherX: number; otherZ: number }[] }
    >();
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const k1 = vKey(e.x1, e.z1);
      const k2 = vKey(e.x2, e.z2);
      if (!map.has(k1)) map.set(k1, { x: e.x1, z: e.z1, inc: [] });
      if (!map.has(k2)) map.set(k2, { x: e.x2, z: e.z2, inc: [] });
      map.get(k1)!.inc.push({ edgeIdx: i, end: 1, otherX: e.x2, otherZ: e.z2 });
      map.get(k2)!.inc.push({ edgeIdx: i, end: 2, otherX: e.x1, otherZ: e.z1 });
    }
    return map;
  };

  // Step 2C-2: Snap-extend degree-1 dangling endpoints forward/nearby onto the closest dry-land road to close city blocks!
  for (let extPass = 0; extPass < 2; extPass++) {
    const vMap = buildVertexMap();
    let addedExtension = false;
    for (const v of vMap.values()) {
      if (v.inc.length !== 1) continue;
      const ref = v.inc[0];
      const srcEdge = edges[ref.edgeIdx];
      if (!srcEdge || srcEdge.isBridge) continue;
      const vx = v.x;
      const vz = v.z;
      const dx = vx - ref.otherX;
      const dz = vz - ref.otherZ;
      const len = Math.hypot(dx, dz) || 1;
      const dirX = dx / len;
      const dirZ = dz / len;

      let bestSnap: { x: number; z: number; score: number; targetIdx: number } | null = null;
      for (let oi = 0; oi < edges.length; oi++) {
        if (oi === ref.edgeIdx) continue;
        const cand = edges[oi];
        if (cand.isBridge) continue;
        if (Math.hypot(cand.x1 - vx, cand.z1 - vz) < 4 || Math.hypot(cand.x2 - vx, cand.z2 - vz) < 4) continue;
        if (Math.hypot(cand.x1 - ref.otherX, cand.z1 - ref.otherZ) < 4 || Math.hypot(cand.x2 - ref.otherX, cand.z2 - ref.otherZ) < 4) {
          continue;
        }

        // Check both forward ray hit and closest segment projection
        const cdx = cand.x2 - cand.x1;
        const cdz = cand.z2 - cand.z1;
        const cLenSq = cdx * cdx + cdz * cdz || 1;
        const candidatesPts: { x: number; z: number; weight: number }[] = [];

        // (a) Forward ray V + s * dir intersecting cand
        const rDenom = dirX * cdz - dirZ * cdx;
        if (Math.abs(rDenom) > 1e-3) {
          const sRay = ((cand.x1 - vx) * cdz - (cand.z1 - vz) * cdx) / rDenom;
          const uSeg = ((cand.x1 - vx) * dirZ - (cand.z1 - vz) * dirX) / rDenom;
          if (sRay > 5 && sRay <= 135 && uSeg >= -0.05 && uSeg <= 1.05) {
            const uClamp = Math.max(0, Math.min(1, uSeg));
            candidatesPts.push({ x: cand.x1 + cdx * uClamp, z: cand.z1 + cdz * uClamp, weight: 0.72 });
          }
        }
        // (b) Closest projection on cand within 84m (not folding backward)
        const tProj = Math.max(0, Math.min(1, ((vx - cand.x1) * cdx + (vz - cand.z1) * cdz) / cLenSq));
        const px = cand.x1 + cdx * tProj;
        const pz = cand.z1 + cdz * tProj;
        const dProj = Math.hypot(px - vx, pz - vz);
        if (dProj > 5 && dProj <= 84) {
          const cosFwd = ((px - vx) * dirX + (pz - vz) * dirZ) / dProj;
          if (cosFwd > -0.15) {
            candidatesPts.push({ x: px, z: pz, weight: 1.0 - cosFwd * 0.2 });
          }
        }

        for (const cp of candidatesPts) {
          const dist = Math.hypot(cp.x - vx, cp.z - vz);
          if (dist < 5 || dist > 135) continue;
          // Link must stay strictly on dry urban land (NEVER crossing water!)
          const dryOk =
            insideCity(cp.x, cp.z) &&
            riverSignedDist((vx + cp.x) * 0.5, (vz + cp.z) * 0.5) > 5 &&
            riverSignedDist(vx * 0.75 + cp.x * 0.25, vz * 0.75 + cp.z * 0.25) > 5 &&
            riverSignedDist(vx * 0.25 + cp.x * 0.75, vz * 0.25 + cp.z * 0.75) > 5;
          if (!dryOk) continue;
          const score = dist * cp.weight;
          if (!bestSnap || score < bestSnap.score) {
            bestSnap = { x: cp.x, z: cp.z, score, targetIdx: oi };
          }
        }
      }

      if (bestSnap) {
        const tgt = edges[bestSnap.targetIdx];
        let sx = bestSnap.x;
        let sz = bestSnap.z;
        if (Math.hypot(sx - tgt.x1, sz - tgt.z1) < 9) {
          sx = tgt.x1;
          sz = tgt.z1;
        } else if (Math.hypot(sx - tgt.x2, sz - tgt.z2) < 9) {
          sx = tgt.x2;
          sz = tgt.z2;
        } else {
          const ox2 = tgt.x2;
          const oz2 = tgt.z2;
          tgt.x2 = sx;
          tgt.z2 = sz;
          edges.push({ x1: sx, z1: sz, x2: ox2, z2: oz2, width: tgt.width, kind: tgt.kind, streamId: tgt.streamId });
        }
        edges.push({
          x1: vx,
          z1: vz,
          x2: sx,
          z2: sz,
          width: srcEdge.width,
          kind: srcEdge.kind,
          streamId: srcEdge.streamId,
        });
        addedExtension = true;
      }
    }
    if (addedExtension) {
      weldGraphVertices(6.0);
      splitPlanarIntersections();
    } else {
      break;
    }
  }

  // Step 2C-3: Pre-filter river-encroaching ground segments + deduplicate multi-edges, THEN run Iterative 2-Core Dead-End Pruning!
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i];
    if (!e.isBridge && riverSignedDist((e.x1 + e.x2) * 0.5, (e.z1 + e.z2) * 0.5) < 2.0) {
      edges.splice(i, 1);
    }
  }
  const dedupParallelEdges = () => {
    const seenPairs = new Set<string>();
    for (let i = edges.length - 1; i >= 0; i--) {
      const e = edges[i];
      const ka = vKey(e.x1, e.z1);
      const kb = vKey(e.x2, e.z2);
      const pairKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (ka === kb || seenPairs.has(pairKey)) {
        edges.splice(i, 1);
      } else {
        seenPairs.add(pairKey);
      }
    }
  };
  dedupParallelEdges();

  // Peel ALL remaining degree-1 stubs iteratively until ZERO dead-end roads remain anywhere in the city!
  for (let pruneIter = 0; pruneIter < 80; pruneIter++) {
    if (edges.length <= 24) break;
    const vMap = buildVertexMap();
    const removeSet = new Set<number>();
    for (const v of vMap.values()) {
      if (v.inc.length === 1) {
        removeSet.add(v.inc[0].edgeIdx);
      }
    }
    if (removeSet.size === 0) break;
    const sortedRem = Array.from(removeSet).sort((a, b) => b - a);
    for (const idx of sortedRem) {
      if (edges.length <= 24) break;
      edges.splice(idx, 1);
    }
    dedupParallelEdges();
  }

  // ==================== PASS 3: EXTRACT CLEAN PLANAR JUNCTION NODES STRICTLY FROM SURVIVING GRAPH ====================
  const junctions: TensorJunction[] = [];
  for (const br of edges) {
    if (!br.isBridge) continue;
    const bRot = Math.atan2(br.x2 - br.x1, br.z2 - br.z1);
    for (const [bx, bz] of [
      [br.x1, br.z1],
      [br.x2, br.z2],
    ]) {
      if (riverSignedDist(bx, bz) >= 2 && !junctions.some((j) => Math.hypot(j.x - bx, j.z - bz) < 28)) {
        junctions.push({ x: bx, z: bz, width: br.width + 6, depth: br.width + 6, rotY: bRot, kind: 'tee' });
      }
    }
  }
  const finalVMap = buildVertexMap();
  for (const v of finalVMap.values()) {
    if (v.inc.length < 3) continue;
    if (riverSignedDist(v.x, v.z) < 8) continue;
    if (junctions.some((j) => Math.hypot(j.x - v.x, j.z - v.z) < 38)) continue;
    let hasArterial = false;
    let primaryRotY = 0;
    for (const inc of v.inc) {
      const e = edges[inc.edgeIdx];
      if (e && e.kind === 'arterial') {
        hasArterial = true;
        primaryRotY = Math.atan2(e.x2 - e.x1, e.z2 - e.z1);
        break;
      }
    }
    if (!hasArterial) {
      const e0 = edges[v.inc[0].edgeIdx];
      if (e0) primaryRotY = Math.atan2(e0.x2 - e0.x1, e0.z2 - e0.z1);
    }
    const padW = hasArterial ? 36 : 22;
    junctions.push({
      x: v.x,
      z: v.z,
      width: padW,
      depth: padW,
      rotY: primaryRotY,
      kind: v.inc.length >= 4 ? 'cross' : 'tee',
    });
  }

  return { edges, junctions };
}
