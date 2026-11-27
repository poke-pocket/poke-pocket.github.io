import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildVilla3D } from './villa3D';
import { buildModernCbdOfficeTower3D } from './cbdCurtainWall3D';

describe('building variety', () => {
  it('keeps the villa and its projecting porch within a normal lot', () => {
    const villa=buildVilla3D(40,34,1);
    const bounds=new THREE.Box3().setFromObject(villa.group);
    expect(bounds.min.x).toBeGreaterThan(-20);
    expect(bounds.max.x).toBeLessThan(20);
    expect(bounds.min.z).toBeGreaterThan(-17);
    expect(bounds.max.z).toBeLessThan(17);
    expect(villa.totalHeight).toBeGreaterThan(10);
    expect(villa.group.children.length).toBeGreaterThan(20);
  });
  it('scales office towers to their lot and provides a lobby canopy', () => {
    const tower=buildModernCbdOfficeTower3D({width:40,depth:34,shape:'rect',isSupertall:true,variant:0});
    const bounds=new THREE.Box3().setFromObject(tower.group);
    expect(bounds.max.x-bounds.min.x).toBeLessThanOrEqual(40);
    expect(bounds.max.z-bounds.min.z).toBeLessThanOrEqual(34);
    expect(tower.totalHeight).toBeGreaterThan(40);
    expect(tower.group.children).toHaveLength(4);
  });
});
