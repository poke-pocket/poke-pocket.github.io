import { describe, expect, it } from 'vitest';
import { BGM_NOTE_FREQS, getRegionalBgmPlaylist, sound, type BgmTrackId } from './sound';

describe('regional multi-track BGM playlists and transport controls', () => {
  it('provides 76 distinct regional compositions with every single note valid in BGM_NOTE_FREQS', () => {
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
    let totalSongs = 0;
    const allIds = new Set<string>();
    const allTitles = new Set<string>();

    for (const z of zones) {
      const list = getRegionalBgmPlaylist(z);
      expect(list.length).toBeGreaterThanOrEqual(6);
      totalSongs += list.length;
      for (const song of list) {
        expect(allIds.has(song.id)).toBe(false);
        expect(allTitles.has(song.title)).toBe(false);
        allIds.add(song.id);
        allTitles.add(song.title);
        expect(song.track.lead.length).toBe(64);
        expect(song.track.harmony.length).toBe(64);
        expect(song.track.bass.length).toBe(64);

        let activeLeadNotes = 0;
        for (const n of song.track.lead) {
          expect(n in BGM_NOTE_FREQS, `Invalid lead note "${n}" in ${song.id}`).toBe(true);
          if (n !== 'R') activeLeadNotes += 1;
        }
        expect(activeLeadNotes).toBeGreaterThanOrEqual(24);
        for (const n of song.track.harmony) {
          expect(n in BGM_NOTE_FREQS, `Invalid harmony note "${n}" in ${song.id}`).toBe(true);
        }
        for (const n of song.track.bass) {
          expect(n in BGM_NOTE_FREQS, `Invalid bass note "${n}" in ${song.id}`).toBe(true);
        }
      }
    }

    expect(totalSongs).toBe(76);
    expect(getRegionalBgmPlaylist('town')).toHaveLength(10);
    expect(getRegionalBgmPlaylist('town_night')).toHaveLength(10);
    expect(getRegionalBgmPlaylist('adventure')).toHaveLength(12);
    expect(getRegionalBgmPlaylist('battle')).toHaveLength(8);
  });

  it('supports next/prev track switching, pause/resume, and cycling list_loop/single_loop/shuffle', () => {
    sound.setBgmPlayMode('list_loop');
    sound.setTrack('town', 0);
    expect(sound.getBgmState().songIndex).toBe(0);
    expect(sound.getBgmState().playlistLength).toBe(10);

    const s1 = sound.nextBgmSong();
    expect(s1.songIndex).toBe(1);
    const sBack = sound.prevBgmSong();
    expect(sBack.songIndex).toBe(0);
    const sWrapBack = sound.prevBgmSong();
    expect(sWrapBack.songIndex).toBe(9);
    const sWrapFwd = sound.nextBgmSong();
    expect(sWrapFwd.songIndex).toBe(0);

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
