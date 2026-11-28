import { describe, expect, it } from 'vitest';
import { decodeMvtBuildings, latLngToTileZ14 } from './realBuildingsMvt';

/** Minimal protobuf encoder helpers to construct a synthetic valid MVT v2 building tile */
function encVarint(n: number): number[] {
  const out: number[] = [];
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
}

function encZigZag(n: number): number[] {
  return encVarint(((n << 1) ^ (n >> 31)) >>> 0);
}

function encFieldBytes(fnum: number, bytes: number[]): number[] {
  return [...encVarint((fnum << 3) | 2), ...encVarint(bytes.length), ...bytes];
}

function encFieldVarint(fnum: number, val: number): number[] {
  return [...encVarint((fnum << 3) | 0), ...encVarint(val)];
}

function encStr(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

describe('realBuildingsMvt', () => {
  it('maps Shenzhen Futian coordinates to Z14 tile 13382/7138', () => {
    const t = latLngToTileZ14(22.543, 114.058);
    expect(t).toEqual({ tx: 13382, ty: 7138 });
  });

  it('decodes exterior building polygon rings and render_height from MVT protobuf bytes', () => {
    // Build a 100x80 tile-unit clockwise square centered at (2000, 2000) with render_height = 180
    const geomCmds = [
      ...encVarint((1 << 3) | 1), // MoveTo(1)
      ...encZigZag(2000),
      ...encZigZag(2000),
      ...encVarint((3 << 3) | 2), // LineTo(3)
      ...encZigZag(100),
      ...encZigZag(0),
      ...encZigZag(0),
      ...encZigZag(80),
      ...encZigZag(-100),
      ...encZigZag(0),
      ...encVarint((1 << 3) | 7), // ClosePath(1)
    ];

    const featureBytes = [
      ...encFieldBytes(2, [...encVarint(0), ...encVarint(0)]), // tags: key[0]=val[0]
      ...encFieldVarint(3, 3), // type = POLYGON
      ...encFieldBytes(4, geomCmds),
    ];

    const valueHeightBytes = encFieldVarint(4, 180); // int_value = 180
    const layerBytes = [
      ...encFieldBytes(1, encStr('building')),
      ...encFieldBytes(2, featureBytes),
      ...encFieldBytes(3, encStr('render_height')),
      ...encFieldBytes(4, valueHeightBytes),
      ...encFieldVarint(5, 4096),
    ];

    const tileBytes = new Uint8Array(encFieldBytes(3, layerBytes));
    const buildings = decodeMvtBuildings(tileBytes, 13382, 7138);

    expect(buildings.length).toBe(1);
    expect(buildings[0].heightM).toBe(180);
    expect(buildings[0].ring.length).toBe(4);
    expect(buildings[0].centerLat).toBeGreaterThan(22.5);
    expect(buildings[0].centerLat).toBeLessThan(22.6);
    expect(buildings[0].centerLng).toBeGreaterThan(114.0);
    expect(buildings[0].centerLng).toBeLessThan(114.1);
  });
});
