import { describe, expect, it } from 'vitest';
import { getRegionalBgmPlaylist, sound, type BgmTrackId } from './sound';

describe('regional multi-track BGM playlists and transport controls', () => {
  it('provides multiple distinct compositions per region with consistent step arrays', () => {
    const zones: BgmTrackId[] = [
      'hub',
      'town',
      'town_night',
      'adventure',
      'pokemon_center',
      'poke_mart',
      'restaurant',
      'hotel',
      'house',
      'battle',
    ];
    for (const z of zones) {
      const list = getRegionalBgmPlaylist(z);
      expect(list.length).toBeGreaterThanOrEqual(2);
      const ids = new Set(list.map((s) => s.id));
      expect(ids.size).toBe(list.length);
      for (const song of list) {
        expect(song.title.length).toBeGreaterThan(2);
        expect(song.track.lead.length).toBe(64);
        expect(song.track.harmony.length).toBe(64);
        expect(song.track.bass.length).toBe(64);
      }
    }
    expect(getRegionalBgmPlaylist('town')).toHaveLength(3);
    expect(getRegionalBgmPlaylist('town_night')).toHaveLength(3);
    expect(getRegionalBgmPlaylist('adventure')).toHaveLength(3);
  });

  it('supports next/prev track switching, pause/resume, and cycling list_loop/single_loop/shuffle', () => {
    sound.setBgmPlayMode('list_loop');
    sound.setTrack('town', 0);
    expect(sound.getBgmState().songIndex).toBe(0);
    expect(sound.getBgmState().playlistLength).toBe(3);

    const s1 = sound.nextBgmSong();
    expect(s1.songIndex).toBe(1);
    const s2 = sound.nextBgmSong();
    expect(s2.songIndex).toBe(2);
    const sWrap = sound.nextBgmSong();
    expect(sWrap.songIndex).toBe(0);

    const sBack = sound.prevBgmSong();
    expect(sBack.songIndex).toBe(2);

    sound.setBgmPaused(true);
    expect(sound.isBgmPaused()).toBe(true);
    expect(sound.getBgmState().paused).toBe(true);
    sound.toggleBgmPause();
    expect(sound.isBgmPaused()).toBe(false);

    expect(sound.cycleBgmPlayMode()).toBe('single_loop');
    expect(sound.cycleBgmPlayMode()).toBe('shuffle');
    expect(sound.cycleBgmPlayMode()).toBe('list_loop');

    // Shuffle never repeats the same track consecutively when playlist has > 1 song
    sound.setBgmPlayMode('shuffle');
    const beforeIdx = sound.getBgmState().songIndex;
    const afterShuffle = sound.nextBgmSong();
    expect(afterShuffle.songIndex).not.toBe(beforeIdx);
    sound.setBgmPlayMode('list_loop');
  });
});
