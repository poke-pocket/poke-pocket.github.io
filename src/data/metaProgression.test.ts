import { describe, expect, it } from 'vitest';
import { LAB_UPGRADES, getLabUpgradeCost, getLabUpgradeEffectSummary } from './metaProgression';

describe('LAB_UPGRADES balanced per-upgrade cost curves', () => {
  it('defines strictly increasing cost curves matching maxLevel for every upgrade', () => {
    for (const u of LAB_UPGRADES) {
      expect(u.costCurve.length).toBe(u.maxLevel);
      let prev = 0;
      for (let lv = 0; lv < u.maxLevel; lv++) {
        const c = getLabUpgradeCost(u, lv);
        expect(c).toBeGreaterThan(prev);
        prev = c;
      }
      expect(getLabUpgradeEffectSummary(u.id, 0).length).toBeGreaterThan(0);
      expect(getLabUpgradeEffectSummary(u.id, u.maxLevel).length).toBeGreaterThan(0);
    }
  });

  it('scales core combat & game-changing upgrades significantly steeper than utility upgrades', () => {
    const peak = (id: string) => {
      const def = LAB_UPGRADES.find((u) => u.id === id)!;
      return getLabUpgradeCost(def, def.maxLevel - 1);
    };
    expect(peak('vitality')).toBe(100000);
    expect(peak('training')).toBeGreaterThanOrEqual(100000);
    expect(peak('squad_cap')).toBeGreaterThan(peak('training'));
    expect(peak('revives')).toBeGreaterThan(peak('training'));
    expect(peak('haste')).toBeGreaterThan(peak('training'));
    expect(peak('crit_rate')).toBeGreaterThan(peak('vitality'));
    expect(peak('armor')).toBeGreaterThan(peak('vitality'));

    // Utility / QoL upgrades stay noticeably gentler than core & multiplier combat upgrades
    expect(peak('magnet')).toBeLessThan(peak('vitality'));
    expect(peak('reroll')).toBeLessThan(peak('vitality'));
    expect(peak('catch_master')).toBeLessThan(peak('vitality'));
    expect(peak('trade')).toBeLessThan(peak('vitality'));
  });
});
