import { WeatherAmbienceEngine } from './weatherAmbience';
import type { ClimateZone, WeatherIntensity, WeatherKind, WorldSeason } from './weatherSystem';
import type { DayNightPhase } from './solarDayNight3D';
import {
  BGM_PLAY_MODE_LABELS,
  EXTRA_REGIONAL_SONGS,
  type BgmDrumHit,
  type BgmPlayMode,
  type BgmPlayerState,
  type BgmSongEntry,
  type BgmTrackId,
  type BgmVoiceTimbre,
  type ChiptuneTrack,
} from './bgmPlaylists';
import { COMPOSED_REGIONAL_SONGS } from './bgmComposer';

export { BGM_PLAY_MODE_LABELS };
export type { BgmPlayMode, BgmPlayerState, BgmSongEntry, BgmTrackId };

export type SfxKind =
  | 'cursor'
  | 'confirm'
  | 'cancel'
  | 'eat'
  | 'happy'
  | 'bath'
  | 'coin'
  | 'levelup'
  | 'hatch'
  | 'error'
  | 'sleep'
  | 'heal_jingle'
  | 'thunder'
  | 'fireball'
  | 'water'
  | 'hit'
  | 'impact'
  | 'ko'
  | 'pokeball'
  | 'jump';

export const BGM_TRACK_LABELS: Record<BgmTrackId, string> = {
  hub: '晨曦序曲 · 掌上世界',
  town: '晴空微风 · 城镇漫步',
  town_night: '星夜霓虹 · 都市晚风',
  adventure: '翠绿原野 · 郊外远征',
  safezone: '乔伊治愈曲 · 宝可梦中心',
  pokemon_center: '乔伊治愈曲 · 宝可梦中心',
  poke_mart: '轻快购物曲 · 友好百货',
  restaurant: '午后波萨 · 树果料理屋',
  hotel: '八音盒小夜曲 · 驿站酒店',
  house: '温馨日常 · 居民公寓',
  battle: '热血激战 · 切磋与首领',
};

type VoiceTimbre = BgmVoiceTimbre;
type DrumHit = BgmDrumHit;

// Complete chromatic note frequencies (Hz) with sharp & flat enharmonics
export const BGM_NOTE_FREQS: Record<string, number> = {
  R: 0,
  G2: 98.0, Gs2: 103.83, Ab2: 103.83, A2: 110.0, Bb2: 116.54, B2: 123.47,
  C3: 130.81, Cs3: 138.59, Db3: 138.59, D3: 146.83, Ds3: 155.56, Eb3: 155.56, E3: 164.81,
  F3: 174.61, Fs3: 185.0, Gb3: 185.0, G3: 196.0, Gs3: 207.65, Ab3: 207.65, A3: 220.0, As3: 233.08, Bb3: 233.08, B3: 246.94,
  C4: 261.63, Cs4: 277.18, Db4: 277.18, D4: 293.66, Ds4: 311.13, Eb4: 311.13, E4: 329.63,
  F4: 349.23, Fs4: 369.99, Gb4: 369.99, G4: 392.0, Gs4: 415.3, Ab4: 415.3, A4: 440.0, As4: 466.16, Bb4: 466.16, B4: 493.88,
  C5: 523.25, Cs5: 554.37, Db5: 554.37, D5: 587.33, Ds5: 622.25, Eb5: 622.25, E5: 659.25,
  F5: 698.46, Fs5: 739.99, Gb5: 739.99, G5: 783.99, Gs5: 830.61, Ab5: 830.61, A5: 880.0, As5: 932.33, Bb5: 932.33, B5: 987.77,
  C6: 1046.5, Cs6: 1108.73, D6: 1174.66, Eb6: 1244.51, E6: 1318.51, F6: 1396.91, Fs6: 1479.98, G6: 1567.98,
};
const N = BGM_NOTE_FREQS;

const POKEMON_CENTER_TRACK: ChiptuneTrack = {
  // Iconic warm D-Major Pokémon Center healing & rest melody
  stepMs: 195,
  leadTimbre: 'bell',
  harmTimbre: 'flute',
  bassTimbre: 'bass_warm',
  leadGain: 0.052,
  harmGain: 0.028,
  bassGain: 0.055,
  gate: 0.94,
  lead: [
    'D5','A4','D5','A5','G5','Fs5','E5','Cs5',
    'E5','A4','E5','G5','Fs5','E5','D5','R',
    'D5','A4','D5','A5','G5','Fs5','E5','G5',
    'Fs5','G5','A5','Fs5','D5','R','R','R',
    'Fs5','R','A5','R','G5','Fs5','E5','R',
    'E5','R','G5','R','Fs5','E5','D5','R',
    'B4','D5','G5','B5','A5','G5','Fs5','E5',
    'D5','E5','Fs5','A5','D5','R','R','R',
  ],
  harmony: [
    'Fs4','R','A4','R','B4','R','G4','R',
    'G4','R','Cs5','R','A4','R','Fs4','R',
    'Fs4','R','A4','R','B4','R','Cs5','R',
    'A4','R','Cs5','R','Fs4','R','A4','R',
    'A4','D5','Fs4','A4','B4','D5','G4','B4',
    'G4','Cs5','E4','G4','Fs4','A4','Fs4','R',
    'G4','R','B4','R','Cs5','R','A4','R',
    'Fs4','R','A4','Cs5','Fs4','R','R','R',
  ],
  bass: [
    'D3','R','A3','R','G3','R','A3','R',
    'A3','R','E3','R','D3','R','A3','R',
    'D3','R','A3','R','G3','R','A3','R',
    'D3','R','A3','R','D3','R','A3','R',
    'D3','R','Fs3','R','G3','R','A3','R',
    'A3','R','E3','R','D3','R','Fs3','R',
    'G3','R','D3','R','A3','R','E3','R',
    'D3','R','A3','R','D3','R','R','R',
  ],
};

const TRACKS: Record<BgmTrackId, ChiptuneTrack> = {
  // 0. Hub Prelude — Airy C-Major Harp Arpeggios & Gentle Flute Overlook
  hub: {
    stepMs: 225,
    leadTimbre: 'flute',
    harmTimbre: 'harp',
    bassTimbre: 'bass_warm',
    leadGain: 0.044,
    harmGain: 0.032,
    bassGain: 0.048,
    gate: 0.96,
    lead: [
      'E5','R','G5','A5','G5','R','E5','C5',
      'D5','R','E5','G5','E5','R','R','R',
      'A5','R','G5','E5','D5','E5','G5','A5',
      'G5','R','D5','R','E5','R','R','R',
      'F5','R','A5','C6','B5','R','G5','D5',
      'E5','R','G5','C6','A5','R','E5','R',
      'F5','E5','D5','C5','G5','R','B4','D5',
      'C5','R','E5','R','C5','R','R','R',
    ],
    harmony: [
      'C4','G4','C5','G4','B3','G4','B4','G4',
      'A3','E4','A4','E4','G3','E4','G4','E4',
      'F4','A4','C5','A4','G4','B4','D5','B4',
      'E4','G4','B4','G4','A4','E4','C5','E4',
      'F4','A4','C5','A4','G4','B4','D5','B4',
      'E4','G4','C5','G4','A4','E4','C5','A4',
      'D4','F4','A4','F4','G4','B4','D5','F4',
      'E4','G4','C5','G4','E4','G4','C5','R',
    ],
    bass: [
      'C3','R','R','R','B2','R','R','R',
      'A2','R','R','R','G3','R','R','R',
      'F3','R','R','R','G3','R','R','R',
      'E3','R','G3','R','A3','R','E3','R',
      'F3','R','C3','R','G3','R','D3','R',
      'E3','R','B2','R','A2','R','E3','R',
      'D3','R','A3','R','G3','R','D3','R',
      'C3','R','G3','R','C3','R','R','R',
    ],
  },

  // 1. Town Day — Cozy Littleroot / Twinleaf G-Major Stroll
  town: {
    stepMs: 210,
    leadTimbre: 'flute',
    harmTimbre: 'woodwind',
    bassTimbre: 'bass_pluck',
    leadGain: 0.048,
    harmGain: 0.024,
    bassGain: 0.052,
    gate: 0.92,
    lead: [
      'G5','Fs5','E5','D5','B5','A5','G5','E5',
      'C5','D5','E5','G5','Fs5','R','D5','R',
      'E5','Fs5','G5','A5','B5','A5','G5','E5',
      'D5','E5','Fs5','D5','G5','R','R','R',
      'B5','A5','G5','Fs5','E5','Fs5','G5','R',
      'A5','G5','Fs5','E5','D5','R','B4','R',
      'C5','E5','G5','B5','A5','G5','Fs5','E5',
      'D5','Fs5','A5','Fs5','G5','R','R','R',
    ],
    harmony: [
      'B4','R','G4','R','D5','R','B4','R',
      'E4','R','G4','R','A4','R','Fs4','R',
      'G4','R','B4','R','D5','R','G4','R',
      'Fs4','R','A4','R','B4','D5','B4','R',
      'D5','R','B4','R','G4','R','B4','R',
      'C5','R','A4','R','Fs4','R','G4','R',
      'E4','R','C5','R','C5','R','A4','R',
      'Fs4','R','C5','R','B4','R','R','R',
    ],
    bass: [
      'G3','R','D3','R','G3','R','B3','R',
      'C3','R','G3','R','D3','R','A3','R',
      'E3','R','B3','R','G3','R','E3','R',
      'D3','R','A3','R','G3','R','D3','R',
      'G3','R','D3','R','E3','R','B3','R',
      'C3','R','G3','R','D3','R','G3','R',
      'C3','R','G3','R','A3','R','E3','R',
      'D3','R','A3','R','G3','R','D3','R',
    ],
  },

  // 2. Town Night — DS Diamond/Pearl Inspired Starry Rhodes & Celesta Nocturne (F Major7)
  town_night: {
    stepMs: 255,
    swing: 0.1,
    leadTimbre: 'bell',
    harmTimbre: 'rhodes',
    bassTimbre: 'bass_warm',
    leadGain: 0.044,
    harmGain: 0.034,
    bassGain: 0.048,
    gate: 1.08,
    lead: [
      'A5','R','G5','F5','E5','R','C5','R',
      'D5','E5','F5','A5','G5','R','R','R',
      'A5','R','C6','A5','G5','F5','E5','D5',
      'C5','R','D5','E5','F5','R','R','R',
      'Bb5','R','A5','G5','A5','R','F5','C5',
      'G5','R','F5','E5','F5','R','D5','R',
      'E5','G5','Bb5','A5','G5','F5','E5','C5',
      'D5','R','E5','R','F5','R','R','R',
    ],
    harmony: [
      'C5','A4','F4','A4','G4','E4','C4','E4',
      'Bb4','F4','D4','F4','B4','G4','D4','G4',
      'C5','A4','F4','A4','B4','G4','E4','G4',
      'Bb4','G4','E4','G4','A4','F4','C4','F4',
      'D5','Bb4','F4','Bb4','C5','A4','F4','A4',
      'B4','G4','D4','G4','A4','F4','D4','F4',
      'Bb4','G4','E4','G4','C5','A4','F4','A4',
      'Bb4','F4','G4','E4','A4','F4','C5','R',
    ],
    bass: [
      'F3','R','C3','R','A2','R','E3','R',
      'Bb2','R','F3','R','G3','R','D3','R',
      'F3','R','C3','R','E3','R','B2','R',
      'C3','R','G3','R','F3','R','C3','R',
      'Bb2','R','F3','R','F3','R','C3','R',
      'G3','R','D3','R','D3','R','A2','R',
      'G3','R','C3','R','F3','R','D3','R',
      'Bb2','R','C3','R','F3','R','R','R',
    ],
  },

  // 3. Wilderness / Route Adventure — Upbeat GBA Route 101/201 March
  adventure: {
    stepMs: 155,
    leadTimbre: 'brass_warm',
    harmTimbre: 'woodwind',
    bassTimbre: 'bass_pluck',
    leadGain: 0.044,
    harmGain: 0.025,
    bassGain: 0.056,
    gate: 0.86,
    lead: [
      'E5','R','E5','G5','A5','R','G5','E5',
      'D5','E5','Fs5','D5','E5','R','B4','R',
      'E5','R','G5','A5','B5','A5','G5','Fs5',
      'E5','D5','E5','Fs5','G5','R','R','R',
      'C6','R','B5','A5','G5','R','E5','G5',
      'A5','G5','Fs5','E5','D5','R','B4','D5',
      'E5','Fs5','G5','A5','B5','R','D6','R',
      'E6','D6','B5','G5','A5','R','B5','R',
    ],
    harmony: [
      'B4','G4','B4','E5','C5','A4','C5','E5',
      'A4','Fs4','A4','D5','B4','G4','E4','G4',
      'B4','G4','E5','C5','D5','B4','D5','A4',
      'B4','G4','B4','D5','E5','B4','G4','R',
      'E5','C5','E5','C5','B4','G4','B4','G4',
      'C5','A4','A4','Fs4','Fs4','D4','G4','D4',
      'G4','B4','B4','E5','D5','B4','Fs5','D5',
      'G5','Fs5','D5','B4','C5','A4','D5','B4',
    ],
    bass: [
      'E3','E3','G3','E3','A3','A3','C4','A3',
      'D3','D3','Fs3','D3','E3','B3','E3','G3',
      'E3','E3','G3','A3','B3','B3','G3','D3',
      'E3','B3','E3','Fs3','G3','D3','G3','B3',
      'C3','C3','G3','C3','G3','G3','D3','G3',
      'A3','A3','D3','D3','G3','D3','G3','B3',
      'E3','G3','B3','A3','G3','B3','D3','Fs3',
      'E3','G3','B3','E3','A3','E3','B3','Fs3',
    ],
    drums: [
      'K','H','S','H','K','H','S','H',
      'K','H','S','K','K','H','S','H',
      'K','H','S','H','K','K','S','H',
      'K','H','S','H','K','S','S','H',
      'K','H','S','H','K','H','S','H',
      'K','H','S','K','K','H','S','H',
      'K','H','S','H','K','K','S','H',
      'K','S','K','S','K','H','S','S',
    ],
  },

  // 4. Pokémon Center (Safe Zone & Walk-In Center)
  safezone: POKEMON_CENTER_TRACK,
  pokemon_center: POKEMON_CENTER_TRACK,

  // 5. Poké Mart — Bouncy Cheerful F-Major Staccato Swing Shop Theme
  poke_mart: {
    stepMs: 175,
    swing: 0.16,
    leadTimbre: 'woodwind',
    harmTimbre: 'bell',
    bassTimbre: 'bass_pluck',
    leadGain: 0.045,
    harmGain: 0.028,
    bassGain: 0.056,
    gate: 0.72,
    lead: [
      'C5','F5','A5','F5','G5','E5','C5','R',
      'D5','G5','Bb5','A5','G5','F5','E5','G5',
      'C5','F5','A5','C6','Bb5','A5','G5','F5',
      'E5','G5','C6','E5','F5','R','R','R',
      'A5','R','F5','A5','Bb5','A5','G5','R',
      'G5','R','E5','G5','A5','G5','F5','R',
      'D5','F5','Bb5','D6','C6','A5','G5','E5',
      'F5','A5','C6','A5','F5','R','R','R',
    ],
    harmony: [
      'R','A4','R','C5','R','Bb4','R','G4',
      'R','Bb4','R','D5','R','B4','C5','Bb4',
      'R','A4','R','Eb5','D5','C5','Bb4','A4',
      'R','Bb4','R','Bb4','A4','C5','A4','R',
      'C5','R','A4','C5','D5','C5','Bb4','R',
      'Bb4','R','G4','Bb4','C5','Bb4','A4','R',
      'Bb4','R','D5','F5','E5','C5','Bb4','G4',
      'A4','C5','F5','C5','A4','R','R','R',
    ],
    bass: [
      'F3','R','C3','R','C3','R','G3','R',
      'G3','R','D3','R','C3','R','G3','E3',
      'F3','R','Eb3','R','D3','R','Bb2','R',
      'C3','R','G3','C3','F3','C3','F3','R',
      'F3','C3','F3','A3','Gm' in N ? 'G3' : 'G3','D3','G3','Bb3',
      'C3','G3','C3','E3','F3','C3','F3','A3',
      'Bb2','F3','Bb2','D3','C3','G3','C3','Bb2',
      'F3','C3','A3','C3','F3','R','R','R',
    ],
    drums: [
      'K','B','H','B','K','B','S','B',
      'K','B','H','B','K','B','S','H',
      'K','B','H','B','K','B','S','B',
      'K','B','S','B','K','S','B','R' as DrumHit,
      'K','B','H','B','K','B','S','B',
      'K','B','H','B','K','B','S','B',
      'K','B','H','B','K','B','S','B',
      'K','S','H','B','K','R' as DrumHit,'' ,'' ,
    ].map((d) => (d === 'K' || d === 'S' || d === 'H' || d === 'B' ? d : '')),
  },

  // 6. Berry Restaurant — Warm Cozy C-Major7 Café Bossa-Nova
  restaurant: {
    stepMs: 195,
    swing: 0.08,
    leadTimbre: 'flute',
    harmTimbre: 'rhodes',
    bassTimbre: 'bass_pluck',
    leadGain: 0.046,
    harmGain: 0.034,
    bassGain: 0.054,
    gate: 0.94,
    lead: [
      'B5','R','A5','G5','E5','R','D5','E5',
      'G5','R','Fs5','G5','A5','R','R','R',
      'A5','R','G5','F5','D5','R','C5','D5',
      'F5','R','E5','F5','G5','R','E5','R',
      'C6','R','B5','A5','G5','E5','C5','E5',
      'A5','R','G5','F5','E5','D5','C5','R',
      'D5','F5','A5','C6','B5','G5','E5','D5',
      'E5','R','G5','R','C5','R','R','R',
    ],
    harmony: [
      'E5','R','B4','E5','R','B4','G4','R',
      'Cs5','R','G4','Cs5','R','G4','E4','R',
      'C5','R','A4','C5','R','A4','F4','R',
      'B4','R','F4','B4','R','A4','G4','R',
      'E5','R','B4','E5','Bb4','R','G4','Bb4',
      'C5','R','A4','C5','Ab4','R','F4','Ab4',
      'C5','R','A4','C5','B4','R','F4','B4',
      'B4','G4','E4','G4','E4','R','R','R',
    ],
    bass: [
      'C3','R','R','G3','C3','R','G3','R',
      'A2','R','R','E3','A2','R','E3','R',
      'D3','R','R','A3','D3','R','A3','R',
      'G3','R','R','D3','G3','R','D3','B2',
      'C3','R','R','G3','Gm' in N ? 'C3' : 'C3','R','Bb2','R',
      'F3','R','R','C3','F3','R','Ab3','R',
      'D3','R','R','A3','G3','R','D3','R',
      'C3','R','G3','R','C3','R','G3','R',
    ],
    drums: [
      'K','B','B','K','B','K','B','B',
      'K','B','B','K','B','K','B','B',
      'K','B','B','K','B','K','B','B',
      'K','B','B','K','B','K','B','H',
      'K','B','B','K','B','K','B','B',
      'K','B','B','K','B','K','B','B',
      'K','B','B','K','B','K','B','B',
      'K','B','K','B','K','B','','',
    ],
  },

  // 7. Station Grand Hotel — Elegant Eb-Major Music-Box & Harp Lounge Serenade
  hotel: {
    stepMs: 245,
    leadTimbre: 'bell',
    harmTimbre: 'harp',
    bassTimbre: 'bass_warm',
    leadGain: 0.048,
    harmGain: 0.032,
    bassGain: 0.046,
    gate: 1.1,
    lead: [
      'Bb5','R','G5','Eb5','F5','R','Bb4','R',
      'G5','Ab5','G5','F5','Eb5','R','R','R',
      'C6','R','Ab5','Eb5','Bb5','R','G5','Eb5',
      'F5','G5','Ab5','G5','F5','R','R','R',
      'Bb5','R','Eb6','D6','C6','R','Ab5','F5',
      'Bb5','R','G5','Eb5','F5','R','D5','Bb4',
      'Eb5','G5','Bb5','Eb6','D6','Bb5','Ab5','F5',
      'G5','R','F5','R','Eb5','R','R','R',
    ],
    harmony: [
      'Eb4','G4','Bb4','G4','D4','F4','Ab4','F4',
      'Eb4','G4','Bb4','G4','Bb3','Eb4','G4','Eb4',
      'Eb4','Ab4','C5','Ab4','Eb4','G4','Bb4','G4',
      'C4','F4','Ab4','F4','D4','F4','Bb4','Ab4',
      'Eb4','G4','Bb4','G4','F4','Ab4','C5','Ab4',
      'Eb4','G4','Bb4','G4','D4','F4','Bb4','F4',
      'C4','Eb4','Ab4','C5','D4','F4','Ab4','Bb4',
      'Eb4','G4','Ab4','D4','Eb4','G4','Bb4','R',
    ],
    bass: [
      'Eb3','R','Bb2','R','Bb2','R','F3','R',
      'Eb3','R','Bb2','R','Eb3','R','G3','R',
      'Ab2','R','Eb3','R','G3','R','Eb3','R',
      'F3','R','C3','R','Bb2','R','F3','R',
      'G3','R','Eb3','R','Ab2','R','F3','R',
      'Eb3','R','Bb2','R','Bb2','R','F3','R',
      'Ab2','R','Eb3','R','Bb2','R','F3','R',
      'Eb3','R','Bb2','R','Eb3','R','R','R',
    ],
  },

  // 8. Residential House / Pokéball Pod — Warm Homey A-Major Acoustic Chamber Melody
  house: {
    stepMs: 215,
    leadTimbre: 'flute',
    harmTimbre: 'harp',
    bassTimbre: 'bass_pluck',
    leadGain: 0.045,
    harmGain: 0.032,
    bassGain: 0.048,
    gate: 0.92,
    lead: [
      'Cs5','E5','A5','E5','Fs5','E5','D5','R',
      'B4','D5','Fs5','A5','Gs5','Fs5','E5','R',
      'Cs5','E5','A5','Cs6','B5','A5','Fs5','D5',
      'E5','Fs5','Gs5','B5','A5','R','R','R',
      'D6','Cs6','B5','A5','Gs5','E5','B5','R',
      'Cs6','B5','A5','Fs5','E5','Cs5','A5','R',
      'B4','D5','Fs5','A5','Gs5','B5','E5','Gs5',
      'A5','R','E5','Cs5','A4','R','R','R',
    ],
    harmony: [
      'A4','E4','Cs5','A4','A4','Fs4','Fs4','D4',
      'Fs4','D4','B4','Fs4','B4','Gs4','Gs4','E4',
      'A4','E4','E5','A4','D5','Fs4','A4','Fs4',
      'Gs4','E4','B4','D5','Cs5','E4','A4','R',
      'Fs4','A4','D5','Fs4','E4','Gs4','D5','Gs4',
      'E4','A4','Cs5','A4','Cs4','Fs4','Cs5','Fs4',
      'D4','Fs4','B4','D5','E4','Gs4','B4','D5',
      'Cs5','E4','A4','E4','Cs4','R','R','R',
    ],
    bass: [
      'A3','R','E3','R','D3','R','A3','R',
      'B2','R','Fs3','R','E3','R','B2','R',
      'A3','R','Gs3','R','Fs3','R','D3','R',
      'E3','R','E3','Gs3','A3','E3','A3','R',
      'D3','R','B2','R','E3','R','Gs3','R',
      'A3','R','E3','R','Fs3','R','Cs3','R',
      'B2','R','D3','R','E3','R','E3','R',
      'A3','R','E3','R','A2','R','R','R',
    ],
  },

  // 9. Street Trainer Duel & Boss Battle — Driving 156 BPM Rival/Gym Anthem
  battle: {
    stepMs: 132,
    leadTimbre: 'brass_warm',
    harmTimbre: 'woodwind',
    bassTimbre: 'bass_pluck',
    leadGain: 0.048,
    harmGain: 0.028,
    bassGain: 0.062,
    gate: 0.85,
    lead: [
      'A5','Ab5','G5','Fs5','F5','E5','Eb5','D5',
      'E5','R','A5','R','G5','E5','D5','C5',
      'A4','C5','D5','E5','G5','E5','A5','R',
      'B5','A5','G5','E5','Fs5','G5','A5','R',
      'C6','R','B5','A5','G5','A5','E5','R',
      'F5','G5','A5','C6','B5','G5','E5','R',
      'D5','F5','A5','D6','C6','B5','A5','G5',
      'A5','E5','C6','B5','A5','R','E5','R',
    ],
    harmony: [
      'E5','Eb5','D5','Cs5','C5','B4','Bb4','A4',
      'C5','A4','E5','C5','D5','B4','A4','E4',
      'E4','A4','B4','C5','D5','B4','E5','C5',
      'G5','E5','D5','B4','D5','E5','E5','R',
      'E5','C5','G5','E5','C5','E5','B4','G4',
      'A4','B4','C5','E5','D5','B4','B4','G4',
      'A4','D5','F5','A5','E5','D5','C5','B4',
      'C5','A4','E5','D5','C5','R','B4','R',
    ],
    bass: [
      'A3','A3','E3','A3','F3','F3','C3','F3',
      'G3','G3','D3','G3','A3','E3','A3','G3',
      'F3','F3','G3','G3','A3','A3','E3','A3',
      'G3','G3','E3','E3','D3','E3','A3','E3',
      'F3','F3','C3','F3','C3','C3','G3','C3',
      'D3','D3','A3','D3','E3','E3','B2','E3',
      'Bb2','Bb2','F3','Bb2','E3','E3','B2','E3',
      'A3','E3','A3','G3','A3','E3','A2','E3',
    ],
    drums: [
      'K','H','S','H','K','K','S','H',
      'K','H','S','H','K','S','S','H',
      'K','H','S','H','K','K','S','H',
      'K','S','K','S','K','S','S','S',
      'K','H','S','H','K','K','S','H',
      'K','H','S','K','K','H','S','H',
      'K','H','S','H','K','K','S','H',
      'K','S','K','S','K','H','S','S',
    ],
  },
};

const BGM_MODE_STORAGE_KEY = 'poke_pocket_bgm_play_mode_v1';

const REGIONAL_PLAYLISTS: Record<Exclude<BgmTrackId, 'safezone'>, BgmSongEntry[]> = {
  hub: [
    { id: 'hub_prelude', title: BGM_TRACK_LABELS.hub, track: TRACKS.hub },
    ...EXTRA_REGIONAL_SONGS.hub,
    ...COMPOSED_REGIONAL_SONGS.hub,
  ],
  town: [
    { id: 'town_stroll', title: BGM_TRACK_LABELS.town, track: TRACKS.town },
    ...EXTRA_REGIONAL_SONGS.town,
    ...COMPOSED_REGIONAL_SONGS.town,
  ],
  town_night: [
    { id: 'town_night_nocturne', title: BGM_TRACK_LABELS.town_night, track: TRACKS.town_night },
    ...EXTRA_REGIONAL_SONGS.town_night,
    ...COMPOSED_REGIONAL_SONGS.town_night,
  ],
  adventure: [
    { id: 'adventure_route', title: BGM_TRACK_LABELS.adventure, track: TRACKS.adventure },
    ...EXTRA_REGIONAL_SONGS.adventure,
    ...COMPOSED_REGIONAL_SONGS.adventure,
  ],
  pokemon_center: [
    { id: 'pc_classic', title: BGM_TRACK_LABELS.pokemon_center, track: TRACKS.pokemon_center },
    ...EXTRA_REGIONAL_SONGS.pokemon_center,
    ...COMPOSED_REGIONAL_SONGS.pokemon_center,
  ],
  poke_mart: [
    { id: 'mart_swing', title: BGM_TRACK_LABELS.poke_mart, track: TRACKS.poke_mart },
    ...EXTRA_REGIONAL_SONGS.poke_mart,
    ...COMPOSED_REGIONAL_SONGS.poke_mart,
  ],
  restaurant: [
    { id: 'rest_bossa', title: BGM_TRACK_LABELS.restaurant, track: TRACKS.restaurant },
    ...EXTRA_REGIONAL_SONGS.restaurant,
    ...COMPOSED_REGIONAL_SONGS.restaurant,
  ],
  hotel: [
    { id: 'hotel_serenade', title: BGM_TRACK_LABELS.hotel, track: TRACKS.hotel },
    ...EXTRA_REGIONAL_SONGS.hotel,
    ...COMPOSED_REGIONAL_SONGS.hotel,
  ],
  house: [
    { id: 'house_home', title: BGM_TRACK_LABELS.house, track: TRACKS.house },
    ...EXTRA_REGIONAL_SONGS.house,
    ...COMPOSED_REGIONAL_SONGS.house,
  ],
  battle: [
    { id: 'battle_rival', title: BGM_TRACK_LABELS.battle, track: TRACKS.battle },
    ...EXTRA_REGIONAL_SONGS.battle,
    ...COMPOSED_REGIONAL_SONGS.battle,
  ],
};

export function getRegionalBgmPlaylist(zone: BgmTrackId): BgmSongEntry[] {
  const key: Exclude<BgmTrackId, 'safezone'> = zone === 'safezone' ? 'pokemon_center' : zone;
  return REGIONAL_PLAYLISTS[key] ?? REGIONAL_PLAYLISTS.town;
}

class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  private bgmBusGain: GainNode | null = null;
  private bgmBusInput: AudioNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  private sfxVolume = 75;
  private bgmEnabled = true;
  private bgmVolume = 42;
  private bgmPaused = false;
  private bgmPlayMode: BgmPlayMode = 'list_loop';
  private cryEnabled = true;
  private cryVolume = 80;
  private combatSfxEnabled = true;
  private masterVolume = 80;
  private muteOnBlur = true;
  private pageHidden = false;
  private currentTrack: Exclude<BgmTrackId, 'safezone'> = 'hub';
  private currentSongIdx = 0;
  private songCycleCount = 0;
  private shuffleHistory: number[] = [];
  private bgmListeners = new Set<(state: BgmPlayerState) => void>();
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private nextStepTime = 0;
  private lastBgmBusGain = -1;
  private activeCry: HTMLAudioElement | null = null;
  private activeCryNode: AudioBufferSourceNode | null = null;
  private cryCache = new Map<string, HTMLAudioElement>();
  private cryBufferCache = new Map<string, AudioBuffer>();
  private cryToneMode: 'warm' | 'cute' | 'raw' = 'warm';
  private unlockListenersBound = false;
  private weatherAmbience = new WeatherAmbienceEngine();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(BGM_MODE_STORAGE_KEY);
        if (saved === 'list_loop' || saved === 'single_loop' || saved === 'shuffle') {
          this.bgmPlayMode = saved;
        }
      } catch {
        // ignore storage errors
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.pageHidden = document.hidden;
        if (this.pageHidden && this.muteOnBlur && this.activeCry) {
          this.activeCry.pause();
        }
        this.syncBgmBusGain();
        this.weatherAmbience.setAudioConfig({ pageHidden: this.pageHidden });
      });
    }
    this.bindGestureUnlockListeners();
  }

  private bindGestureUnlockListeners() {
    if (typeof window === 'undefined' || this.unlockListenersBound) return;
    this.unlockListenersBound = true;
    const onGesture = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('pointerdown', onGesture, true);
        window.removeEventListener('keydown', onGesture, true);
        window.removeEventListener('touchstart', onGesture, true);
      }
    };
    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
  }

  private isSilenceActive(): boolean {
    return this.muted || this.masterVolume <= 0 || (this.muteOnBlur && this.pageHidden);
  }

  private ensureBgmBus(ctx: AudioContext): AudioNode {
    if (this.bgmBusInput && this.bgmBusGain) {
      return this.bgmBusInput;
    }
    // Warm GBA/NDS Mastering Chain for BGM: Highpass @ 65Hz -> Warm Lowpass @ 3200Hz -> Gentle Glue Compressor -> Master BGM Gain
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 65;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 3200;
    lpf.Q.value = 0.55;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 3;
    comp.attack.value = 0.008;
    comp.release.value = 0.16;

    const masterGain = ctx.createGain();
    masterGain.gain.value = this.computeTargetBgmGain();

    hpf.connect(lpf);
    lpf.connect(comp);
    comp.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.bgmBusInput = hpf;
    this.bgmBusGain = masterGain;
    return hpf;
  }

  private computeTargetBgmGain(): number {
    if (this.isSilenceActive() || !this.bgmEnabled || this.bgmPaused || this.bgmVolume <= 0) {
      return 0.0001;
    }
    return Math.max(0.0001, (this.bgmVolume / 100) * (this.masterVolume / 100) * 1.15);
  }

  private syncBgmBusGain(fadeSec = 0.06, force = false) {
    if (!this.ctx || !this.bgmBusGain) return;
    const target = this.computeTargetBgmGain();
    if (!force && this.lastBgmBusGain >= 0 && Math.abs(target - this.lastBgmBusGain) < 0.0004) {
      return;
    }
    this.lastBgmBusGain = target;
    const now = this.ctx.currentTime;
    try {
      this.bgmBusGain.gain.cancelScheduledValues(now);
      this.bgmBusGain.gain.setValueAtTime(Math.max(0.0001, this.bgmBusGain.gain.value), now);
      this.bgmBusGain.gain.linearRampToValueAtTime(target, now + fadeSec);
    } catch {
      this.bgmBusGain.gain.value = target;
    }
  }

  private getActiveSongEntry(): BgmSongEntry {
    const list = getRegionalBgmPlaylist(this.currentTrack);
    const safeIdx = ((this.currentSongIdx % list.length) + list.length) % list.length;
    return list[safeIdx] ?? list[0];
  }

  private emitBgmState() {
    const state = this.getBgmState();
    for (const fn of this.bgmListeners) {
      try {
        fn(state);
      } catch {
        // ignore listener errors
      }
    }
  }

  private triggerTrackCrossfade() {
    if (this.ctx && this.ctx.state === 'running') {
      this.nextStepTime = this.ctx.currentTime + 0.08;
      if (this.bgmBusGain) {
        const now = this.ctx.currentTime;
        const target = this.computeTargetBgmGain();
        try {
          this.bgmBusGain.gain.cancelScheduledValues(now);
          this.bgmBusGain.gain.setValueAtTime(
            Math.max(0.0001, this.bgmBusGain.gain.value * 0.32),
            now,
          );
          this.bgmBusGain.gain.linearRampToValueAtTime(target, now + 0.2);
        } catch {
          // ignore
        }
      }
    }
  }

  private pickRandomNextIndex(len: number, excludeIdx: number): number {
    if (len <= 1) return 0;
    const pool: number[] = [];
    for (let i = 0; i < len; i++) {
      if (i !== excludeIdx) pool.push(i);
    }
    return pool[Math.floor(Math.random() * pool.length)] ?? 0;
  }

  subscribeBgmState(listener: (state: BgmPlayerState) => void): () => void {
    this.bgmListeners.add(listener);
    return () => {
      this.bgmListeners.delete(listener);
    };
  }

  getBgmState(): BgmPlayerState {
    const list = getRegionalBgmPlaylist(this.currentTrack);
    const safeIdx = ((this.currentSongIdx % list.length) + list.length) % list.length;
    const song = list[safeIdx] ?? list[0];
    return {
      zone: this.currentTrack,
      songId: song.id,
      songTitle: song.title,
      songIndex: safeIdx,
      playlistLength: list.length,
      playMode: this.bgmPlayMode,
      paused: this.bgmPaused,
      audible: this.isBgmAudible(),
    };
  }

  getTrack(): BgmTrackId {
    return this.currentTrack;
  }

  getTrackLabel(): string {
    return this.getActiveSongEntry().title;
  }

  isBgmAudible(): boolean {
    return !this.muted && this.bgmEnabled && !this.bgmPaused && this.bgmVolume > 0 && this.masterVolume > 0;
  }

  isBgmPaused(): boolean {
    return this.bgmPaused;
  }

  setBgmPaused(paused: boolean) {
    if (this.bgmPaused === paused) return;
    this.bgmPaused = paused;
    this.syncBgmBusGain(0.08);
    if (!paused && this.bgmEnabled && this.bgmVolume > 0) {
      this.unlock();
      this.startBgmLoop();
    } else if (paused) {
      this.stopBgmLoop();
    }
    this.emitBgmState();
  }

  toggleBgmPause(): boolean {
    this.setBgmPaused(!this.bgmPaused);
    return this.bgmPaused;
  }

  getBgmPlayMode(): BgmPlayMode {
    return this.bgmPlayMode;
  }

  setBgmPlayMode(mode: BgmPlayMode) {
    if (this.bgmPlayMode === mode) return;
    this.bgmPlayMode = mode;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(BGM_MODE_STORAGE_KEY, mode);
      } catch {
        // ignore
      }
    }
    this.emitBgmState();
  }

  cycleBgmPlayMode(): BgmPlayMode {
    const order: BgmPlayMode[] = ['list_loop', 'single_loop', 'shuffle'];
    const next = order[(order.indexOf(this.bgmPlayMode) + 1) % order.length];
    this.setBgmPlayMode(next);
    return next;
  }

  nextBgmSong(): BgmPlayerState {
    const list = getRegionalBgmPlaylist(this.currentTrack);
    if (list.length > 1) {
      this.shuffleHistory.push(this.currentSongIdx);
      if (this.shuffleHistory.length > 16) this.shuffleHistory.shift();
      this.currentSongIdx =
        this.bgmPlayMode === 'shuffle'
          ? this.pickRandomNextIndex(list.length, this.currentSongIdx)
          : (this.currentSongIdx + 1) % list.length;
    }
    this.bgmStep = 0;
    this.songCycleCount = 0;
    if (this.bgmPaused) {
      this.bgmPaused = false;
    }
    this.unlock();
    this.triggerTrackCrossfade();
    if (this.bgmEnabled && this.bgmVolume > 0 && this.bgmTimer === null) {
      this.startBgmLoop();
    }
    this.emitBgmState();
    return this.getBgmState();
  }

  prevBgmSong(): BgmPlayerState {
    const list = getRegionalBgmPlaylist(this.currentTrack);
    if (list.length > 1) {
      if (this.bgmPlayMode === 'shuffle' && this.shuffleHistory.length > 0) {
        const prevIdx = this.shuffleHistory.pop()!;
        this.currentSongIdx = ((prevIdx % list.length) + list.length) % list.length;
      } else {
        this.currentSongIdx = (this.currentSongIdx - 1 + list.length) % list.length;
      }
    }
    this.bgmStep = 0;
    this.songCycleCount = 0;
    if (this.bgmPaused) {
      this.bgmPaused = false;
    }
    this.unlock();
    this.triggerTrackCrossfade();
    if (this.bgmEnabled && this.bgmVolume > 0 && this.bgmTimer === null) {
      this.startBgmLoop();
    }
    this.emitBgmState();
    return this.getBgmState();
  }

  setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(100, Math.round(vol)));
    this.syncBgmBusGain();
    this.weatherAmbience.setAudioConfig({ masterVolume: this.masterVolume });
    this.emitBgmState();
  }

  setMuteOnBlur(enabled: boolean) {
    this.muteOnBlur = enabled;
    this.syncBgmBusGain();
    this.weatherAmbience.setAudioConfig({ muteOnBlur: this.muteOnBlur });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.syncBgmBusGain();
    this.weatherAmbience.setAudioConfig({ muted: this.muted });
    this.emitBgmState();
  }

  setAmbient(enabled: boolean, volume: number) {
    this.weatherAmbience.setAudioConfig({
      enabled,
      volume: Math.max(0, Math.min(100, Math.round(volume))),
    });
    if (this.ctx && this.ctx.state === 'running') {
      this.weatherAmbience.attachContext(this.ctx);
    }
  }

  setWeatherAmbience(
    kind: WeatherKind | null,
    opts?: {
      indoor?: boolean;
      isNight?: boolean;
      dayPhase?: DayNightPhase;
      intensity?: WeatherIntensity;
      season?: WorldSeason;
      climateZone?: ClimateZone;
      seasonManual?: boolean;
      tempC?: number;
    },
  ) {
    const ctx = this.ctx && this.ctx.state === 'running' ? this.ctx : null;
    this.weatherAmbience.setWeather(kind, opts, ctx);
  }

  triggerStormThunder(isNear: boolean) {
    this.weatherAmbience.triggerSyncedThunder(isNear);
  }

  setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(100, Math.round(vol)));
  }

  setCry(enabled: boolean, volume: number) {
    this.cryEnabled = enabled;
    this.cryVolume = Math.max(0, Math.min(100, Math.round(volume)));
  }

  setCryToneMode(mode: 'warm' | 'cute' | 'raw') {
    this.cryToneMode = mode;
  }

  /** Audition any species cry with an optional tone mode override */
  previewCry(dexId: number, modeOverride?: 'warm' | 'cute' | 'raw') {
    const mode = modeOverride ?? this.cryToneMode;
    if (mode === 'cute') {
      this.playCuteChirp(dexId, true);
      return;
    }
    const url = this.resolveCryUrl(dexId);
    this.playAudioUrl(url, true, mode);
  }

  private lastImpactTs = 0;

  private resolveCryUrl(dexId: number): string {
    return `/cries/${dexId}.mp3`;
  }

  private stopActiveCry() {
    if (this.activeCry) {
      try {
        this.activeCry.pause();
        this.activeCry.currentTime = 0;
      } catch {
        // ignore
      }
      this.activeCry = null;
    }
    if (this.activeCryNode) {
      try {
        this.activeCryNode.stop();
        this.activeCryNode.disconnect();
      } catch {
        // ignore
      }
      this.activeCryNode = null;
    }
  }

  /** Cozy Animal-Crossing / Tamagotchi style velvety melodic chirp (zero harsh synth frequencies!) */
  private playCuteChirp(dexId: number, forcePreview = false) {
    if (!forcePreview && (this.isSilenceActive() || !this.cryEnabled || this.cryVolume <= 0)) return;
    const ctx = this.getCtx(true);
    if (!ctx) return;
    this.stopActiveCry();
    const volScale = forcePreview
      ? Math.max(0.3, (this.cryVolume / 100) * (this.masterVolume / 100))
      : (this.cryVolume / 100) * (this.masterVolume / 100);
    if (volScale <= 0) return;

    const scale = [392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 783.99];
    const baseHz = scale[dexId % scale.length];
    const secondHz = baseHz * (dexId % 2 === 0 ? 1.25 : 1.189);
    const now = ctx.currentTime;

    const playSoftNote = (f0: number, f1: number, start: number, dur: number, peak: number) => {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      sub.type = 'sine';
      osc.frequency.setValueAtTime(f0, start);
      osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
      sub.frequency.setValueAtTime(f0 * 0.5, start);
      sub.frequency.exponentialRampToValueAtTime(f1 * 0.5, start + dur);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(1900, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak * volScale, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(lpf);
      sub.connect(lpf);
      lpf.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      sub.start(start);
      osc.stop(start + dur + 0.02);
      sub.stop(start + dur + 0.02);
    };

    playSoftNote(baseHz, baseHz * 1.12, now, 0.11, 0.075);
    playSoftNote(secondHz, secondHz * 1.06, now + 0.1, 0.16, 0.082);
  }

  private playAudioUrl(
    url: string,
    forcePreview = false,
    toneOverride?: 'warm' | 'cute' | 'raw',
  ) {
    if (!forcePreview && (this.isSilenceActive() || !this.cryEnabled || this.cryVolume <= 0)) return;
    if (typeof window === 'undefined') return;
    const tone = toneOverride ?? this.cryToneMode;
    const volBase = forcePreview
      ? Math.max(0.28, (this.cryVolume / 100) * (this.masterVolume / 100))
      : (this.cryVolume / 100) * (this.masterVolume / 100);
    if (volBase <= 0) return;

    const ctx = this.getCtx(true);
    if (ctx && tone === 'warm') {
      this.stopActiveCry();
      const playDecoded = (buf: AudioBuffer) => {
        try {
          if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
          this.stopActiveCry();
          const src = ctx.createBufferSource();
          src.buffer = buf;

          const hpf = ctx.createBiquadFilter();
          hpf.type = 'highpass';
          hpf.frequency.value = 120;

          const deHarsh = ctx.createBiquadFilter();
          deHarsh.type = 'peaking';
          deHarsh.frequency.value = 2850;
          deHarsh.Q.value = 1.0;
          deHarsh.gain.value = -7.5;

          const warmShelf = ctx.createBiquadFilter();
          warmShelf.type = 'highshelf';
          warmShelf.frequency.value = 4000;
          warmShelf.gain.value = -8.5;

          const lpf = ctx.createBiquadFilter();
          lpf.type = 'lowpass';
          lpf.frequency.value = 5000;
          lpf.Q.value = 0.65;

          const comp = ctx.createDynamicsCompressor();
          comp.threshold.value = -18;
          comp.knee.value = 12;
          comp.ratio.value = 4;
          comp.attack.value = 0.005;
          comp.release.value = 0.12;

          const gain = ctx.createGain();
          const targetGain = Math.max(0.02, Math.min(0.65, volBase * 0.42));
          const now = ctx.currentTime;
          const dur = Math.max(0.08, buf.duration);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(targetGain, now + 0.012);
          if (dur > 0.06) {
            gain.gain.setValueAtTime(targetGain, now + dur - 0.035);
            gain.gain.linearRampToValueAtTime(0.0001, now + dur);
          }

          src.connect(hpf);
          hpf.connect(deHarsh);
          deHarsh.connect(warmShelf);
          warmShelf.connect(lpf);
          lpf.connect(comp);
          comp.connect(gain);
          gain.connect(ctx.destination);

          this.activeCryNode = src;
          src.onended = () => {
            if (this.activeCryNode === src) this.activeCryNode = null;
          };
          src.start(now);
        } catch {
          this.playHtmlAudioFallback(url, volBase * 0.4);
        }
      };

      const cached = this.cryBufferCache.get(url);
      if (cached) {
        playDecoded(cached);
        return;
      }
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('cry fetch failed'))))
        .then((ab) => ctx.decodeAudioData(ab))
        .then((decoded) => {
          this.cryBufferCache.set(url, decoded);
          playDecoded(decoded);
        })
        .catch(() => {
          this.playHtmlAudioFallback(url, volBase * 0.4);
        });
      return;
    }

    this.playHtmlAudioFallback(url, volBase * 0.48);
  }

  private playHtmlAudioFallback(url: string, volume: number) {
    try {
      this.stopActiveCry();
      let audio = this.cryCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        this.cryCache.set(url, audio);
      }
      audio.volume = Math.max(0.03, Math.min(1, volume));
      audio.currentTime = 0;
      this.activeCry = audio;
      void audio.play().catch(() => {});
    } catch {
      // Ignore autoplay errors gracefully
    }
  }

  setCombatSfx(enabled: boolean) {
    this.combatSfxEnabled = enabled;
  }

  setTrack(track: BgmTrackId, preferredSongIdx?: number) {
    const normalized: Exclude<BgmTrackId, 'safezone'> =
      track === 'safezone' ? 'pokemon_center' : track;
    if (this.currentTrack === normalized) return;
    this.currentTrack = normalized;
    const list = getRegionalBgmPlaylist(normalized);
    if (typeof preferredSongIdx === 'number' && list.length > 0) {
      this.currentSongIdx = ((preferredSongIdx % list.length) + list.length) % list.length;
    } else if (this.bgmPlayMode === 'shuffle' && list.length > 1) {
      this.currentSongIdx = Math.floor(Math.random() * list.length);
    } else {
      this.currentSongIdx = 0;
    }
    this.shuffleHistory = [];
    this.bgmStep = 0;
    this.songCycleCount = 0;
    this.triggerTrackCrossfade();
    if (this.bgmEnabled && !this.bgmPaused && this.bgmVolume > 0 && this.bgmTimer === null) {
      this.startBgmLoop();
    }
    this.emitBgmState();
  }

  setBgm(enabled: boolean, volume: number) {
    this.bgmEnabled = enabled;
    this.bgmVolume = Math.max(0, Math.min(100, Math.round(volume)));
    if (enabled && this.bgmVolume > 0 && this.bgmPaused) {
      // Enabling music from settings or top HUD resumes playback cleanly
      this.bgmPaused = false;
    }
    this.syncBgmBusGain();
    if (enabled && !this.bgmPaused && this.bgmVolume > 0) {
      this.startBgmLoop();
    } else {
      this.stopBgmLoop();
    }
    this.emitBgmState();
  }

  private getCtx(createIfMissing = true): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      if (!createIfMissing) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf && this.noiseBuf.sampleRate === ctx.sampleRate) {
      return this.noiseBuf;
    }
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.65;
    }
    this.noiseBuf = buf;
    return buf;
  }

  /** Rich GBA/NDS Multi-Timbre Voice Scheduled Directly on WebAudio Hardware Clock */
  private scheduleBgmVoice(
    ctx: AudioContext,
    bus: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    timbre: VoiceTimbre,
    peakGain: number,
  ) {
    if (freq <= 0 || duration <= 0.01) return;
    const outGain = ctx.createGain();
    const osc1 = ctx.createOscillator();
    let osc2: OscillatorNode | null = null;
    let osc2Gain: GainNode | null = null;
    let filter: BiquadFilterNode | null = null;

    let attack = 0.012;
    let releasePad = 0.03;

    switch (timbre) {
      case 'flute': {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, startTime);
        osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.22, startTime);
        attack = 0.024;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        outGain.gain.setValueAtTime(peakGain * 0.82, Math.max(startTime + attack, startTime + duration * 0.72));
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.025);
        break;
      }
      case 'bell': {
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, startTime);
        osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.32, startTime);
        osc2Gain.gain.exponentialRampToValueAtTime(0.02, startTime + duration);
        attack = 0.006;
        releasePad = 0.08;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + releasePad);
        break;
      }
      case 'rhodes': {
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq, startTime);
        osc2.detune.setValueAtTime(3.5, startTime);
        osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.45, startTime);
        attack = 0.009;
        releasePad = 0.06;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + releasePad);
        break;
      }
      case 'harp': {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, startTime);
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(2600, freq * 3.8), startTime);
        filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.4), startTime + duration);
        attack = 0.006;
        releasePad = 0.07;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + releasePad);
        break;
      }
      case 'woodwind': {
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(freq, startTime);
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(2300, freq * 2.7), startTime);
        attack = 0.014;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain * 0.72, startTime + attack);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.02);
        break;
      }
      case 'brass_warm': {
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2 = ctx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(freq, startTime);
        osc2.detune.setValueAtTime(4.0, startTime);
        osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.45, startTime);
        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2450, startTime);
        attack = 0.011;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain * 0.68, startTime + attack);
        outGain.gain.setValueAtTime(peakGain * 0.52, Math.max(startTime + attack, startTime + duration * 0.7));
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.02);
        break;
      }
      case 'bass_pluck': {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq, startTime);
        osc2Gain = ctx.createGain();
        osc2Gain.gain.setValueAtTime(0.55, startTime);
        attack = 0.007;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.025);
        break;
      }
      case 'bass_warm':
      default: {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, startTime);
        attack = 0.016;
        releasePad = 0.04;
        outGain.gain.setValueAtTime(0.0001, startTime);
        outGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + releasePad);
        break;
      }
    }

    const destNode = filter ?? outGain;
    osc1.connect(destNode);
    if (osc2 && osc2Gain) {
      osc2.connect(osc2Gain);
      osc2Gain.connect(destNode);
    }
    if (filter) {
      filter.connect(outGain);
    }
    outGain.connect(bus);

    const stopAt = startTime + duration + releasePad + 0.02;
    osc1.start(startTime);
    osc1.stop(stopAt);
    if (osc2) {
      osc2.start(startTime);
      osc2.stop(stopAt);
    }
  }

  private scheduleBgmDrum(ctx: AudioContext, bus: AudioNode, hit: DrumHit, startTime: number) {
    if (!hit) return;
    if (hit === 'K') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(125, startTime);
      osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.068);
      gain.gain.setValueAtTime(0.055, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.072);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(startTime);
      osc.stop(startTime + 0.08);
      return;
    }
    const dur = hit === 'S' ? 0.055 : hit === 'B' ? 0.042 : 0.024;
    const hpHz = hit === 'S' ? 1500 : hit === 'B' ? 2800 : 4600;
    const peak = hit === 'S' ? 0.024 : hit === 'B' ? 0.011 : 0.013;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(hpHz, startTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(startTime);
    src.stop(startTime + dur + 0.01);
  }

  private tone(
    freq: number,
    duration: number,
    delay = 0,
    type: OscillatorType = 'square',
    gainPeak = 0.06,
    isBgm = false,
    endFreq?: number,
  ) {
    if (this.isSilenceActive()) return;
    const volScale = ((isBgm ? this.bgmVolume : this.sfxVolume) / 100) * (this.masterVolume / 100);
    if (volScale <= 0) return;
    const ctx = this.getCtx(!isBgm);
    if (!ctx || (isBgm && ctx.state !== 'running')) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const peak = Math.max(0.0005, gainPeak * volScale);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  private noise(duration: number, delay = 0, gainPeak = 0.05, highpassHz = 1200, isBgm = false) {
    if (this.isSilenceActive()) return;
    const volScale = ((isBgm ? this.bgmVolume : this.sfxVolume) / 100) * (this.masterVolume / 100);
    if (volScale <= 0) return;
    const ctx = this.getCtx(!isBgm);
    if (!ctx || (isBgm && ctx.state !== 'running')) return;
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpassHz, now);
    const gain = ctx.createGain();
    const peak = Math.max(0.0004, gainPeak * volScale);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.01);
  }

  /** Precision WebAudio Lookahead Scheduler — Zero Main-Thread Frame Jitter! */
  private startBgmLoop() {
    if (typeof window === 'undefined' || this.bgmTimer !== null || this.bgmPaused) return;
    if (this.ctx && this.ctx.state === 'running') {
      this.nextStepTime = Math.max(this.ctx.currentTime + 0.04, this.nextStepTime);
    }
    this.bgmTimer = window.setInterval(() => {
      if (!this.bgmEnabled || this.bgmPaused || this.bgmVolume <= 0 || this.isSilenceActive()) return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const bus = this.ensureBgmBus(ctx);

      const now = ctx.currentTime;
      if (this.nextStepTime < now - 0.25 || this.nextStepTime > now + 1.8) {
        this.nextStepTime = now + 0.04;
      }

      // Schedule notes up to 480ms ahead on WebAudio's sample-accurate audio thread clock
      // so occasional GPU/network/UI spikes NEVER starve or stutter BGM playback!
      while (this.nextStepTime < now + 0.48) {
        const song = this.getActiveSongEntry();
        const t = song.track;
        const idx = this.bgmStep % t.lead.length;
        const stepSec = t.stepMs / 1000;
        const swingOffset = t.swing && idx % 2 === 1 ? stepSec * t.swing : 0;
        const noteStart = this.nextStepTime + swingOffset;
        const dur = stepSec * (t.gate ?? 0.9);

        const leadFreq = N[t.lead[idx]] ?? 0;
        const harmFreq = N[t.harmony[idx]] ?? 0;
        const bassFreq = N[t.bass[idx]] ?? 0;
        const drum = t.drums?.[idx] ?? '';

        if (leadFreq > 0) {
          this.scheduleBgmVoice(ctx, bus, leadFreq, noteStart, dur, t.leadTimbre, t.leadGain ?? 0.045);
        }
        if (harmFreq > 0) {
          this.scheduleBgmVoice(ctx, bus, harmFreq, noteStart, dur * 0.92, t.harmTimbre, t.harmGain ?? 0.026);
        }
        if (bassFreq > 0) {
          this.scheduleBgmVoice(ctx, bus, bassFreq, noteStart, dur * 1.05, t.bassTimbre, t.bassGain ?? 0.052);
        }
        if (drum) {
          this.scheduleBgmDrum(ctx, bus, drum, noteStart);
        }

        this.nextStepTime += stepSec;
        this.bgmStep += 1;
        if (this.bgmStep >= t.lead.length) {
          this.bgmStep = 0;
          this.songCycleCount += 1;
          const list = getRegionalBgmPlaylist(this.currentTrack);
          if (this.songCycleCount >= 2 && list.length > 1 && this.bgmPlayMode !== 'single_loop') {
            this.songCycleCount = 0;
            this.shuffleHistory.push(this.currentSongIdx);
            if (this.shuffleHistory.length > 16) this.shuffleHistory.shift();
            this.currentSongIdx =
              this.bgmPlayMode === 'shuffle'
                ? this.pickRandomNextIndex(list.length, this.currentSongIdx)
                : (this.currentSongIdx + 1) % list.length;
            this.emitBgmState();
          }
        }
      }
    }, 65);
  }

  private stopBgmLoop() {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  /** Unlock WebAudio on user gesture so BGM & procedural weather ambience begin immediately if enabled */
  unlock() {
    const ctx = this.getCtx(true);
    if (ctx) {
      this.ensureBgmBus(ctx);
      this.syncBgmBusGain();
      if (ctx.state === 'running') {
        this.weatherAmbience.attachContext(ctx);
      } else {
        void ctx
          .resume()
          .then(() => this.weatherAmbience.attachContext(ctx))
          .catch(() => {});
      }
    }
    if (this.bgmEnabled && !this.bgmPaused && this.bgmVolume > 0) {
      this.startBgmLoop();
    }
  }

  /** Play authentic official Pokémon cry unified with gentle Switch-style warm de-harshing EQ */
  playCry(dexId: number) {
    this.playAudioUrl(this.resolveCryUrl(dexId), false, 'warm');
  }

  play(kind: SfxKind) {
    if (this.muted || this.sfxVolume <= 0) return;
    if (
      !this.combatSfxEnabled &&
      (kind === 'thunder' || kind === 'fireball' || kind === 'water' || kind === 'hit' || kind === 'impact' || kind === 'ko' || kind === 'jump')
    ) {
      return;
    }
    switch (kind) {
      case 'cursor':
        this.tone(740, 0.038, 0, 'square', 0.048);
        break;
      case 'confirm':
        this.tone(587.33, 0.05, 0, 'square', 0.058);
        this.tone(880, 0.085, 0.045, 'square', 0.06);
        break;
      case 'cancel':
        this.tone(440, 0.05, 0, 'square', 0.052);
        this.tone(293.66, 0.085, 0.045, 'square', 0.05);
        break;
      case 'eat':
        this.tone(360, 0.055, 0, 'square', 0.055, false, 480);
        this.tone(480, 0.055, 0.085, 'square', 0.055, false, 620);
        this.tone(660, 0.1, 0.17, 'triangle', 0.075);
        break;
      case 'happy':
        this.tone(587.33, 0.07, 0, 'square', 0.055);
        this.tone(739.99, 0.07, 0.06, 'square', 0.055);
        this.tone(880, 0.14, 0.12, 'square', 0.065);
        break;
      case 'bath':
        this.tone(520, 0.05, 0, 'triangle', 0.07, false, 700);
        this.tone(680, 0.05, 0.06, 'triangle', 0.07, false, 880);
        this.tone(860, 0.06, 0.12, 'triangle', 0.07, false, 1120);
        break;
      case 'coin':
        this.tone(987.77, 0.055, 0, 'square', 0.06);
        this.tone(1318.51, 0.16, 0.055, 'square', 0.065);
        break;
      case 'levelup':
        this.tone(523.25, 0.075, 0, 'square', 0.065);
        this.tone(659.25, 0.075, 0.075, 'square', 0.065);
        this.tone(783.99, 0.075, 0.15, 'square', 0.065);
        this.tone(1046.5, 0.28, 0.225, 'square', 0.075);
        this.tone(523.25, 0.28, 0.225, 'triangle', 0.065);
        break;
      case 'heal_jingle':
        this.tone(987.77, 0.11, 0.0, 'triangle', 0.085);
        this.tone(987.77, 0.11, 0.14, 'triangle', 0.085);
        this.tone(987.77, 0.11, 0.28, 'triangle', 0.085);
        this.tone(830.61, 0.12, 0.42, 'triangle', 0.085);
        this.tone(1318.51, 0.34, 0.56, 'triangle', 0.095);
        this.tone(659.25, 0.34, 0.56, 'square', 0.04);
        break;
      case 'thunder':
        this.noise(0.11, 0, 0.075, 1400);
        this.tone(1280, 0.09, 0, 'sawtooth', 0.06, false, 240);
        this.tone(920, 0.08, 0.04, 'square', 0.05, false, 180);
        break;
      case 'fireball':
        this.noise(0.09, 0, 0.055, 600);
        this.tone(420, 0.085, 0, 'sawtooth', 0.055, false, 150);
        break;
      case 'water':
        this.tone(320, 0.09, 0, 'triangle', 0.075, false, 780);
        this.tone(760, 0.1, 0.07, 'triangle', 0.065, false, 380);
        this.noise(0.08, 0.02, 0.035, 2200);
        break;
      case 'hit':
        this.noise(0.055, 0, 0.065, 500);
        this.tone(180, 0.06, 0, 'square', 0.06, false, 70);
        break;
      case 'impact': {
        const nowTs = performance.now();
        if (nowTs - this.lastImpactTs < 85) return;
        this.lastImpactTs = nowTs;
        this.tone(320, 0.045, 0, 'triangle', 0.05, false, 140);
        this.noise(0.03, 0, 0.025, 1100);
        break;
      }
      case 'ko':
        this.tone(480, 0.07, 0, 'square', 0.055, false, 180);
        this.tone(240, 0.12, 0.06, 'sawtooth', 0.05, false, 85);
        break;
      case 'pokeball':
        this.tone(260, 0.12, 0, 'triangle', 0.065, false, 780);
        this.tone(640, 0.06, 0.13, 'square', 0.055);
        break;
      case 'jump':
        this.tone(280, 0.11, 0, 'square', 0.055, false, 640);
        break;
      case 'hatch':
        this.tone(392, 0.08, 0, 'square', 0.06);
        this.tone(493.88, 0.08, 0.09, 'square', 0.06);
        this.tone(587.33, 0.08, 0.18, 'square', 0.06);
        this.tone(783.99, 0.1, 0.27, 'square', 0.065);
        this.tone(1046.5, 0.3, 0.38, 'triangle', 0.085);
        break;
      case 'sleep':
        this.tone(440, 0.13, 0, 'triangle', 0.055);
        this.tone(349.23, 0.18, 0.13, 'triangle', 0.05);
        break;
      case 'error':
        this.tone(200, 0.11, 0, 'sawtooth', 0.055);
        this.tone(145, 0.16, 0.1, 'sawtooth', 0.055);
        break;
    }
  }
}

export const sound = new RetroSoundEngine();
