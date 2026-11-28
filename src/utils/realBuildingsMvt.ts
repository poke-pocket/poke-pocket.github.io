/**
 * Zero-dependency OpenFreeMap / OpenStreetMap Z14 Vector Tile (MVT .pbf) Building Streamer.
 * Fetches real-world building polygon footprints + real heights (`render_height`) + colors
 * directly from free CORS-enabled OpenFreeMap CDN (`https://tiles.openfreemap.org/planet`)
 * with zero API key required, covering every city on Earth (Shenzhen, Hong Kong, Shanghai,
 * Beijing, Tokyo, and any user GPS hometown).
 */

export interface RealOsmBuilding {
  id: string;
  /** Exterior footprint polygon in real [lat, lng] coordinates */
  ring: [number, number][];
  centerLat: number;
  centerLng: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  /** Real building height in meters from OSM `render_height` (fallback ~12-18m) */
  heightM: number;
  minHeightM: number;
  colour?: string;
}

const OSM_BUILDING_ZOOM = 14;
const MAX_TILE_CACHE = 96;
const MAX_CONCURRENT_FETCHES = 6;
const FALLBACK_TILE_TEMPLATE = 'https://tiles.openfreemap.org/planet/20261122_124456_pt/{z}/{x}/{y}.pbf';

interface PersistedBuildingStore {
  tileTemplate: string;
  tileJsonRequested: boolean;
  cache: Map<string, RealOsmBuilding[]>;
  inflight: Set<string>;
  failed: Set<string>;
  queue: { tx: number; ty: number; key: string }[];
  version: number;
}

const GLOBAL_HOST = globalThis as unknown as { __POKE_OSM_BLDG_V1__?: PersistedBuildingStore };
const STORE: PersistedBuildingStore =
  GLOBAL_HOST.__POKE_OSM_BLDG_V1__ ??
  (GLOBAL_HOST.__POKE_OSM_BLDG_V1__ = {
    tileTemplate: FALLBACK_TILE_TEMPLATE,
    tileJsonRequested: false,
    cache: new Map(),
    inflight: new Set(),
    failed: new Set(),
    queue: [],
    version: 0,
  });

const listeners = new Set<() => void>();
let notifyTimer: number | null = null;

function notifyBuildingsLoaded() {
  STORE.version += 1;
  if (typeof window === 'undefined') {
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    return;
  }
  if (notifyTimer !== null) window.clearTimeout(notifyTimer);
  notifyTimer = window.setTimeout(() => {
    notifyTimer = null;
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  }, STORE.inflight.size === 0 ? 45 : 180);
}

export function subscribeRealBuildingsLoaded(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getRealBuildingsVersion(): number {
  return STORE.version;
}

export function latLngToTileZ14(lat: number, lng: number): { tx: number; ty: number } {
  const n = 1 << OSM_BUILDING_ZOOM;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clampedLat * Math.PI) / 180;
  const tx = (((Math.floor(((lng + 180) / 360) * n) % n) + n) % n);
  const ty = Math.max(
    0,
    Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)),
  );
  return { tx, ty };
}

function tilePixelToLatLng(tx: number, ty: number, px: number, py: number, extent: number): [number, number] {
  const n = 1 << OSM_BUILDING_ZOOM;
  const fx = tx + px / extent;
  const fy = ty + py / extent;
  const lng = (fx / n) * 360 - 180;
  const mercN = Math.PI - (2 * Math.PI * fy) / n;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(mercN) - Math.exp(-mercN)));
  return [lat, lng];
}

// =========================================================================
// MINIMAL ZERO-DEPENDENCY MAPBOX VECTOR TILE (MVT v2) PROTOBUF DECODER
// =========================================================================
interface PbSlice {
  buf: Uint8Array;
  pos: number;
  end: number;
}

function readVarint(s: PbSlice): number {
  let result = 0;
  let shift = 0;
  while (s.pos < s.end) {
    const b = s.buf[s.pos++];
    if (shift < 28) {
      result |= (b & 0x7f) << shift;
    } else {
      result += (b & 0x7f) * Math.pow(2, shift);
    }
    if ((b & 0x80) === 0) return result;
    shift += 7;
  }
  return result;
}

function zigzag(v: number): number {
  return (v >>> 1) ^ -(v & 1);
}

const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
function decodeUtf8(buf: Uint8Array, start: number, end: number): string {
  if (textDecoder) return textDecoder.decode(buf.subarray(start, end));
  let out = '';
  for (let i = start; i < end; i++) out += String.fromCharCode(buf[i]);
  return out;
}

function skipField(s: PbSlice, wireType: number) {
  if (wireType === 0) {
    readVarint(s);
  } else if (wireType === 1) {
    s.pos += 8;
  } else if (wireType === 2) {
    const len = readVarint(s);
    s.pos += len;
  } else if (wireType === 5) {
    s.pos += 4;
  } else {
    s.pos = s.end;
  }
}

function decodeMvtValue(buf: Uint8Array, start: number, end: number): string | number | boolean | null {
  const s: PbSlice = { buf, pos: start, end };
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  while (s.pos < s.end) {
    const tag = readVarint(s);
    const fnum = tag >>> 3;
    const wtype = tag & 7;
    if (fnum === 1 && wtype === 2) {
      const len = readVarint(s);
      const val = decodeUtf8(buf, s.pos, s.pos + len);
      s.pos += len;
      return val;
    }
    if (fnum === 2 && wtype === 5) {
      const val = dv.getFloat32(s.pos, true);
      s.pos += 4;
      return val;
    }
    if (fnum === 3 && wtype === 1) {
      const val = dv.getFloat64(s.pos, true);
      s.pos += 8;
      return val;
    }
    if ((fnum === 4 || fnum === 5) && wtype === 0) {
      return readVarint(s);
    }
    if (fnum === 6 && wtype === 0) {
      return zigzag(readVarint(s));
    }
    if (fnum === 7 && wtype === 0) {
      return readVarint(s) !== 0;
    }
    skipField(s, wtype);
  }
  return null;
}

/**
 * Decodes all Polygon building footprints from an MVT `.pbf` tile buffer.
 * Exported for unit testing and offline inspection.
 */
export function decodeMvtBuildings(rawBytes: Uint8Array, tx: number, ty: number): RealOsmBuilding[] {
  const out: RealOsmBuilding[] = [];
  const root: PbSlice = { buf: rawBytes, pos: 0, end: rawBytes.length };
  let bIdx = 0;

  while (root.pos < root.end) {
    const tag = readVarint(root);
    const fnum = tag >>> 3;
    const wtype = tag & 7;
    if (fnum !== 3 || wtype !== 2) {
      skipField(root, wtype);
      continue;
    }

    const layerLen = readVarint(root);
    const layerStart = root.pos;
    const layerEnd = Math.min(root.end, layerStart + layerLen);
    root.pos = layerEnd;

    // Pass 1 on layer: inspect name, extent, keys, values, and collect feature byte ranges
    const ls: PbSlice = { buf: rawBytes, pos: layerStart, end: layerEnd };
    let layerName = '';
    let extent = 4096;
    const keys: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    const featRanges: [number, number][] = [];

    while (ls.pos < ls.end) {
      const ltag = readVarint(ls);
      const lf = ltag >>> 3;
      const lw = ltag & 7;
      if (lf === 1 && lw === 2) {
        const len = readVarint(ls);
        layerName = decodeUtf8(rawBytes, ls.pos, ls.pos + len);
        ls.pos += len;
      } else if (lf === 5 && lw === 0) {
        extent = readVarint(ls) || 4096;
      } else if (lf === 2 && lw === 2) {
        const len = readVarint(ls);
        featRanges.push([ls.pos, ls.pos + len]);
        ls.pos += len;
      } else if (lf === 3 && lw === 2) {
        const len = readVarint(ls);
        keys.push(decodeUtf8(rawBytes, ls.pos, ls.pos + len));
        ls.pos += len;
      } else if (lf === 4 && lw === 2) {
        const len = readVarint(ls);
        values.push(decodeMvtValue(rawBytes, ls.pos, ls.pos + len));
        ls.pos += len;
      } else {
        skipField(ls, lw);
      }
    }

    if (layerName !== 'building' && layerName !== 'buildings') continue;

    const hKeyIdx = keys.indexOf('render_height');
    const altHKeyIdx = hKeyIdx >= 0 ? hKeyIdx : keys.indexOf('height');
    const minHKeyIdx = keys.indexOf('render_min_height');
    const colorKeyIdx = keys.indexOf('colour');
    const hideKeyIdx = keys.indexOf('hide_3d');

    for (let fi = 0; fi < featRanges.length; fi++) {
      const [fStart, fEnd] = featRanges[fi];
      const fs: PbSlice = { buf: rawBytes, pos: fStart, end: fEnd };
      let geomType = 0;
      let geomStart = 0;
      let geomEnd = 0;
      let heightM = 0;
      let minHeightM = 0;
      let colour: string | undefined;
      let hide3d = false;

      while (fs.pos < fs.end) {
        const ftag = readVarint(fs);
        const ff = ftag >>> 3;
        const fw = ftag & 7;
        if (ff === 3 && fw === 0) {
          geomType = readVarint(fs);
        } else if (ff === 2 && fw === 2) {
          const len = readVarint(fs);
          const ts: PbSlice = { buf: rawBytes, pos: fs.pos, end: fs.pos + len };
          fs.pos += len;
          while (ts.pos < ts.end) {
            const kIdx = readVarint(ts);
            if (ts.pos >= ts.end) break;
            const vIdx = readVarint(ts);
            const v = values[vIdx];
            if (kIdx === altHKeyIdx && typeof v === 'number' && Number.isFinite(v)) {
              heightM = v;
            } else if (kIdx === minHKeyIdx && typeof v === 'number' && Number.isFinite(v)) {
              minHeightM = v;
            } else if (kIdx === colorKeyIdx && typeof v === 'string' && v.length > 0) {
              colour = v;
            } else if (kIdx === hideKeyIdx && (v === true || v === 1 || v === 'true')) {
              hide3d = true;
            }
          }
        } else if (ff === 4 && fw === 2) {
          const len = readVarint(fs);
          geomStart = fs.pos;
          geomEnd = fs.pos + len;
          fs.pos += len;
        } else {
          skipField(fs, fw);
        }
      }

      // Only Polygon geometry (type === 3)
      if (geomType !== 3 || geomEnd <= geomStart || hide3d) continue;

      // Parse MVT geometry command stream into closed exterior rings
      const gs: PbSlice = { buf: rawBytes, pos: geomStart, end: geomEnd };
      let curX = 0;
      let curY = 0;
      let ringPx: [number, number][] = [];

      const flushRing = () => {
        if (ringPx.length < 3) {
          ringPx = [];
          return;
        }
        // Shoelace signed area in tile pixel coords (y down): > 0 is exterior ring, < 0 is interior hole!
        let area2 = 0;
        for (let i = 0; i < ringPx.length; i++) {
          const [x1, y1] = ringPx[i];
          const [x2, y2] = ringPx[(i + 1) % ringPx.length];
          area2 += x1 * y2 - x2 * y1;
        }
        if (area2 <= 18) {
          // Skip interior courtyard holes & tiny < ~6m sub-tile noise sheds
          ringPx = [];
          return;
        }

        const ring: [number, number][] = [];
        let minLat = Infinity;
        let maxLat = -Infinity;
        let minLng = Infinity;
        let maxLng = -Infinity;
        let sumLat = 0;
        let sumLng = 0;

        for (let i = 0; i < ringPx.length; i++) {
          const [lat, lng] = tilePixelToLatLng(tx, ty, ringPx[i][0], ringPx[i][1], extent);
          ring.push([lat, lng]);
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          sumLat += lat;
          sumLng += lng;
        }

        const cLat = sumLat / ring.length;
        const cLng = sumLng / ring.length;
        // Skip buildings whose centroid lies outside this tile (owned by neighboring tile, prevents duplicate overlap!)
        const tileN = 1 << OSM_BUILDING_ZOOM;
        const cTx = Math.floor(((cLng + 180) / 360) * tileN);
        const cRad = (cLat * Math.PI) / 180;
        const cTy = Math.floor(((1 - Math.log(Math.tan(cRad) + 1 / Math.cos(cRad)) / Math.PI) / 2) * tileN);
        if (cTx !== tx || cTy !== ty) {
          ringPx = [];
          return;
        }

        // Fallback realistic height if OSM building lacked height tag
        const effH = heightM > 2 ? heightM : 10 + ((bIdx * 7) % 14);
        out.push({
          id: `osm_${tx}_${ty}_${bIdx++}`,
          ring,
          centerLat: cLat,
          centerLng: cLng,
          minLat,
          maxLat,
          minLng,
          maxLng,
          heightM: effH,
          minHeightM,
          colour,
        });
        ringPx = [];
      };

      while (gs.pos < gs.end) {
        const cmdInt = readVarint(gs);
        const cmd = cmdInt & 7;
        const cnt = cmdInt >>> 3;
        if (cmd === 1) {
          if (ringPx.length >= 3) flushRing();
          for (let k = 0; k < cnt; k++) {
            curX += zigzag(readVarint(gs));
            curY += zigzag(readVarint(gs));
            ringPx.push([curX, curY]);
          }
        } else if (cmd === 2) {
          for (let k = 0; k < cnt; k++) {
            curX += zigzag(readVarint(gs));
            curY += zigzag(readVarint(gs));
            ringPx.push([curX, curY]);
          }
        } else if (cmd === 7) {
          flushRing();
        } else {
          break;
        }
      }
      if (ringPx.length >= 3) flushRing();
    }
  }

  return out;
}

async function ensureTileTemplate() {
  if (STORE.tileJsonRequested || typeof fetch === 'undefined') return;
  STORE.tileJsonRequested = true;
  try {
    const res = await fetch('https://tiles.openfreemap.org/planet');
    if (!res.ok) return;
    const j = (await res.json()) as { tiles?: string[] };
    if (Array.isArray(j.tiles) && typeof j.tiles[0] === 'string' && j.tiles[0].includes('{z}')) {
      STORE.tileTemplate = j.tiles[0];
    }
  } catch {
    // Keep fallback template silently
  }
}

async function maybeGunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const stream = new Blob([copy]).stream().pipeThrough(ds);
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }
  return bytes;
}

function pumpQueue() {
  if (typeof fetch === 'undefined') return;
  while (STORE.inflight.size < MAX_CONCURRENT_FETCHES && STORE.queue.length > 0) {
    const job = STORE.queue.shift()!;
    if (STORE.cache.has(job.key) || STORE.inflight.has(job.key) || STORE.failed.has(job.key)) continue;
    STORE.inflight.add(job.key);

    void (async () => {
      try {
        await ensureTileTemplate();
        const url = STORE.tileTemplate
          .replace('{z}', String(OSM_BUILDING_ZOOM))
          .replace('{x}', String(job.tx))
          .replace('{y}', String(job.ty));
        const res = await fetch(url);
        if (!res.ok) {
          STORE.failed.add(job.key);
          return;
        }
        const ab = await res.arrayBuffer();
        const raw = await maybeGunzip(new Uint8Array(ab));
        const buildings = decodeMvtBuildings(raw, job.tx, job.ty);
        if (STORE.cache.size >= MAX_TILE_CACHE) {
          const oldest = STORE.cache.keys().next().value;
          if (oldest) STORE.cache.delete(oldest);
        }
        STORE.cache.set(job.key, buildings);
        notifyBuildingsLoaded();
      } catch {
        STORE.failed.add(job.key);
      } finally {
        STORE.inflight.delete(job.key);
        pumpQueue();
      }
    })();
  }
}

export function requestRealBuildingTile(tx: number, ty: number) {
  const n = 1 << OSM_BUILDING_ZOOM;
  const wtx = ((tx % n) + n) % n;
  if (ty < 0 || ty >= n) return;
  const key = `${OSM_BUILDING_ZOOM}/${wtx}/${ty}`;
  if (STORE.cache.has(key) || STORE.inflight.has(key) || STORE.failed.has(key)) return;
  if (STORE.queue.some((q) => q.key === key)) return;
  if (STORE.queue.length > 36) STORE.queue.shift();
  STORE.queue.push({ tx: wtx, ty, key });
  pumpQueue();
}

export function prefetchRealBuildingsAround(lat: number, lng: number, radiusTiles = 1) {
  const { tx, ty } = latLngToTileZ14(lat, lng);
  for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
    for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
      requestRealBuildingTile(tx + dx, ty + dy);
    }
  }
}

export function getCachedRealBuildingTile(tx: number, ty: number): RealOsmBuilding[] | null {
  const n = 1 << OSM_BUILDING_ZOOM;
  const wtx = ((tx % n) + n) % n;
  const key = `${OSM_BUILDING_ZOOM}/${wtx}/${ty}`;
  return STORE.cache.get(key) ?? null;
}

/**
 * Returns all currently loaded real OSM building footprints intersecting the given lat/lng box,
 * and automatically queues any missing Z14 tiles (up to 42 tiles per viewport, gracefully clamping
 * fetch to the central 5x5 tiles when zoomed slightly wider so buildings stay visible smoothly).
 */
export function queryRealBuildingsInBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  autoFetch = true,
): RealOsmBuilding[] {
  const tl = latLngToTileZ14(maxLat, minLng);
  const br = latLngToTileZ14(minLat, maxLng);
  let minTx = tl.tx;
  let maxTx = br.tx;
  let minTy = tl.ty;
  let maxTy = br.ty;
  const spanX = maxTx - minTx;
  const spanY = maxTy - minTy;
  if (spanX < 0 || spanY < 0 || spanX > 14 || spanY > 14) return [];

  if ((spanX + 1) * (spanY + 1) > 42) {
    const midTx = Math.floor((minTx + maxTx) * 0.5);
    const midTy = Math.floor((minTy + maxTy) * 0.5);
    minTx = midTx - 2;
    maxTx = midTx + 2;
    minTy = midTy - 2;
    maxTy = midTy + 2;
  }

  const result: RealOsmBuilding[] = [];
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const hit = getCachedRealBuildingTile(tx, ty);
      if (hit) {
        for (let i = 0; i < hit.length; i++) {
          const b = hit[i];
          if (b.maxLat < minLat || b.minLat > maxLat || b.maxLng < minLng || b.minLng > maxLng) continue;
          result.push(b);
        }
      } else if (autoFetch) {
        requestRealBuildingTile(tx, ty);
      }
    }
  }
  return result;
}
