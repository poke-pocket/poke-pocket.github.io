import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_CATALOG,
  FOOD_CATALOG,
  ROOM_CATALOG,
  SPECIES_CATALOG,
} from './catalog';
import { PIXEL_ICONS } from './pixelIcons';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

describe('Pokemon sprite assets and pixel icons integrity', () => {
  it('ensures every Pokemon stage sprite file exists on disk under public/', () => {
    for (const meta of Object.values(SPECIES_CATALOG)) {
      for (const stage of ['baby', 'teen', 'adult'] as const) {
        const animPath = path.join(PUBLIC_DIR, meta.stageSprites[stage].animated);
        const staticPath = path.join(PUBLIC_DIR, meta.stageSprites[stage].static);
        const iconPath = path.join(PUBLIC_DIR, meta.stageSprites[stage].icon);
        const portraitPath = path.join(PUBLIC_DIR, meta.stageSprites[stage].portrait);
        const sleepPath = path.join(PUBLIC_DIR, meta.stageSprites[stage].sleep);
        const cryId = Number.parseInt(meta.stageDexNos[stage].replace('#', ''), 10);
        const cryPath = path.join(PUBLIC_DIR, `/cries/${cryId}.mp3`);
        expect(fs.existsSync(animPath)).toBe(true);
        expect(fs.existsSync(staticPath)).toBe(true);
        expect(fs.existsSync(iconPath)).toBe(true);
        expect(fs.existsSync(portraitPath)).toBe(true);
        expect(fs.existsSync(sleepPath)).toBe(true);
        expect(fs.existsSync(cryPath)).toBe(true);
      }
    }
  });

  it('ensures every food, accessory, Pokeball room, and dock item sprite exists under public/', () => {
    for (const food of FOOD_CATALOG) {
      expect(fs.existsSync(path.join(PUBLIC_DIR, food.itemSprite))).toBe(true);
    }
    for (const acc of ACCESSORY_CATALOG) {
      expect(fs.existsSync(path.join(PUBLIC_DIR, acc.itemSprite))).toBe(true);
    }
    for (const room of ROOM_CATALOG) {
      expect(fs.existsSync(path.join(PUBLIC_DIR, room.ballSprite))).toBe(true);
    }
    for (const extra of [
      '/sprites/items/fresh-water.png',
      '/sprites/items/light-ball.png',
      '/sprites/items/vs-seeker.png',
      '/sprites/items/poke-radar.png',
      '/sprites/items/amulet-coin.png',
      '/sprites/items/potion.png',
      '/sprites/items/berry-pouch.png',
      '/sprites/items/town-map.png',
      '/sprites/trainers/red.png',
      '/sprites/trainers/blue.png',
      '/sprites/trainers/brock.png',
      '/sprites/trainers/misty.png',
      '/sprites/trainers/ltsurge.png',
      '/sprites/trainers/erika.png',
      '/sprites/trainers/youngster.png',
      '/sprites/trainers/lass.png',
      '/sprites/trainers/nurse.png',
    ]) {
      expect(fs.existsSync(path.join(PUBLIC_DIR, extra))).toBe(true);
    }
  });

  it('validates all custom pixel UI icons are exact 10x10 matrices with valid palette tokens', () => {
    for (const icon of Object.values(PIXEL_ICONS)) {
      expect(icon.grid).toHaveLength(10);
      for (const row of icon.grid) {
        expect(row).toHaveLength(10);
        for (const ch of row) {
          if (ch !== '.') {
            expect(icon.palette[ch]).toBeDefined();
          }
        }
      }
    }
  });
});
