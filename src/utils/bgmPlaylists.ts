export type BgmTrackId =
  | 'hub'
  | 'town'
  | 'town_night'
  | 'adventure'
  | 'safezone'
  | 'pokemon_center'
  | 'poke_mart'
  | 'restaurant'
  | 'hotel'
  | 'house'
  | 'battle';

export type BgmPlayMode = 'list_loop' | 'single_loop' | 'shuffle';

export type BgmVoiceTimbre =
  | 'flute'
  | 'bell'
  | 'rhodes'
  | 'harp'
  | 'woodwind'
  | 'brass_warm'
  | 'bass_warm'
  | 'bass_pluck';

export type BgmDrumHit = 'K' | 'S' | 'H' | 'B' | '';

export interface ChiptuneTrack {
  stepMs: number;
  swing?: number;
  leadTimbre: BgmVoiceTimbre;
  harmTimbre: BgmVoiceTimbre;
  bassTimbre: BgmVoiceTimbre;
  leadGain?: number;
  harmGain?: number;
  bassGain?: number;
  gate?: number;
  lead: string[];
  harmony: string[];
  bass: string[];
  drums?: BgmDrumHit[];
}

export interface BgmSongEntry {
  id: string;
  title: string;
  track: ChiptuneTrack;
}

export interface BgmPlayerState {
  zone: BgmTrackId;
  songId: string;
  songTitle: string;
  songIndex: number;
  playlistLength: number;
  playMode: BgmPlayMode;
  paused: boolean;
  audible: boolean;
}

export const BGM_PLAY_MODE_LABELS: Record<BgmPlayMode, string> = {
  list_loop: '列表循环',
  single_loop: '单曲循环',
  shuffle: '随机播放',
};

/**
 * Additional regional compositions paired with the core tracks in `sound.ts` so every
 * region/zone features 2–3 distinct, cohesive GBA/NDS-style melodies for playlist cycling & shuffle!
 */
export const EXTRA_REGIONAL_SONGS: Record<Exclude<BgmTrackId, 'safezone'>, BgmSongEntry[]> = {
  hub: [
    {
      id: 'hub_journey',
      title: '启程之风 · 旅伴晴歌',
      track: {
        stepMs: 215,
        leadTimbre: 'bell',
        harmTimbre: 'harp',
        bassTimbre: 'bass_warm',
        leadGain: 0.044,
        harmGain: 0.03,
        bassGain: 0.046,
        gate: 0.98,
        lead: [
          'D5','R','G5','A5','B5','R','A5','G5',
          'Fs5','R','E5','D5','E5','R','R','R',
          'G5','R','B5','D6','C6','R','B5','A5',
          'G5','Fs5','E5','Fs5','G5','R','R','R',
          'E5','R','G5','B5','A5','R','Fs5','D5',
          'C5','E5','G5','B5','A5','R','R','R',
          'B5','A5','G5','Fs5','E5','G5','A5','B5',
          'A5','R','Fs5','R','G5','R','R','R',
        ],
        harmony: [
          'B3','D4','G4','D4','B3','D4','G4','D4',
          'A3','D4','Fs4','D4','G3','B3','E4','B3',
          'G3','B3','D4','B3','C4','E4','G4','E4',
          'A3','C4','E4','C4','B3','D4','G4','D4',
          'G3','B3','E4','B3','A3','D4','Fs4','D4',
          'G3','C4','E4','C4','A3','D4','Fs4','D4',
          'B3','D4','G4','D4','C4','E4','G4','E4',
          'A3','D4','Fs4','D4','B3','D4','G4','R',
        ],
        bass: [
          'G3','R','D3','R','G3','R','D3','R',
          'D3','R','A2','R','E3','R','B2','R',
          'G3','R','D3','R','C3','R','G3','R',
          'A2','R','D3','R','G3','R','D3','R',
          'E3','R','B2','R','D3','R','A2','R',
          'C3','R','G3','R','D3','R','A2','R',
          'G3','R','D3','R','C3','R','G3','R',
          'D3','R','A2','R','G3','R','R','R',
        ],
      },
    },
  ],

  town: [
    {
      id: 'town_canal',
      title: '石桥流水 · 水巷晨歌',
      track: {
        stepMs: 220,
        leadTimbre: 'harp',
        harmTimbre: 'flute',
        bassTimbre: 'bass_warm',
        leadGain: 0.048,
        harmGain: 0.028,
        bassGain: 0.048,
        gate: 0.96,
        lead: [
          'E5','G5','C6','G5','A5','G5','E5','D5',
          'C5','D5','E5','G5','D5','R','R','R',
          'F5','A5','C6','A5','G5','E5','C5','E5',
          'D5','E5','G5','B4','C5','R','R','R',
          'A5','G5','E5','C5','D5','E5','G5','R',
          'F5','E5','D5','C5','G4','B4','D5','R',
          'E5','G5','A5','C6','B5','A5','G5','E5',
          'D5','E5','G5','D5','C5','R','R','R',
        ],
        harmony: [
          'C4','R','E4','R','F4','R','C4','R',
          'A3','R','C4','R','B3','R','G4','R',
          'C4','R','F4','R','E4','R','G4','R',
          'F4','R','G4','R','E4','G4','E4','R',
          'C5','R','G4','R','B4','R','D5','R',
          'A4','R','F4','R','G4','R','B4','R',
          'C5','R','E5','R','D5','R','B4','R',
          'A4','R','B4','R','G4','R','R','R',
        ],
        bass: [
          'C3','R','G3','R','F3','R','C3','R',
          'A2','R','E3','R','G3','R','D3','R',
          'F3','R','C3','R','C3','R','G3','R',
          'D3','R','G3','R','C3','R','G3','R',
          'A2','R','E3','R','G3','R','D3','R',
          'F3','R','C3','R','G3','R','D3','R',
          'C3','R','A2','R','G3','R','E3','R',
          'F3','R','G3','R','C3','R','R','R',
        ],
      },
    },
    {
      id: 'town_plaza',
      title: '阳光广场 · 钟楼集市',
      track: {
        stepMs: 185,
        swing: 0.1,
        leadTimbre: 'bell',
        harmTimbre: 'woodwind',
        bassTimbre: 'bass_pluck',
        leadGain: 0.046,
        harmGain: 0.025,
        bassGain: 0.054,
        gate: 0.82,
        lead: [
          'Fs5','G5','A5','D5','B5','A5','G5','Fs5',
          'E5','Fs5','G5','B5','A5','R','Fs5','R',
          'D5','Fs5','A5','D6','Cs6','B5','A5','G5',
          'Fs5','E5','D5','E5','Fs5','R','R','R',
          'B5','R','G5','B5','A5','R','Fs5','D5',
          'G5','Fs5','E5','D5','E5','Fs5','A5','R',
          'D5','Fs5','G5','B5','A5','G5','Fs5','E5',
          'D5','Fs5','A5','Cs6','D6','R','R','R',
        ],
        harmony: [
          'D4','R','Fs4','R','G4','R','D4','R',
          'Cs4','R','E4','R','Fs4','R','D4','R',
          'Fs4','R','A4','R','G4','R','E4','R',
          'D4','R','Cs4','R','D4','Fs4','A4','R',
          'G4','R','B4','R','Fs4','R','A4','R',
          'E4','R','G4','R','Cs4','R','E4','R',
          'Fs4','R','B4','R','A4','R','G4','R',
          'Fs4','R','A4','R','Fs4','R','R','R',
        ],
        bass: [
          'D3','R','A3','R','G3','R','D3','R',
          'A3','R','E3','R','D3','R','A3','R',
          'D3','R','Fs3','R','G3','R','A3','R',
          'D3','R','A3','R','D3','A3','D3','R',
          'G3','R','D3','R','D3','R','A3','R',
          'E3','R','B3','R','A3','R','E3','R',
          'D3','R','G3','R','A3','R','E3','R',
          'D3','R','A3','R','D3','R','R','R',
        ],
        drums: [
          'K','','H','','K','','S','',
          'K','','H','','K','','S','H',
          'K','','H','','K','','S','',
          'K','','S','','K','S','H','',
          'K','','H','','K','','S','',
          'K','','H','','K','','S','',
          'K','','H','','K','','S','',
          'K','','S','','K','','','',
        ],
      },
    },
  ],

  town_night: [
    {
      id: 'town_night_harbor',
      title: '月映江畔 · 霓虹夜曲',
      track: {
        stepMs: 245,
        swing: 0.08,
        leadTimbre: 'flute',
        harmTimbre: 'rhodes',
        bassTimbre: 'bass_warm',
        leadGain: 0.044,
        harmGain: 0.034,
        bassGain: 0.048,
        gate: 1.05,
        lead: [
          'A5','R','F5','D5','E5','R','C5','R',
          'D5','F5','A5','G5','E5','R','R','R',
          'Bb5','R','A5','G5','F5','R','D5','F5',
          'E5','D5','C5','E5','D5','R','R','R',
          'C6','R','A5','F5','G5','R','E5','C5',
          'A5','G5','F5','E5','D5','R','A4','R',
          'Bb4','D5','F5','A5','G5','E5','C5','E5',
          'F5','R','E5','R','D5','R','R','R',
        ],
        harmony: [
          'F4','A4','D5','A4','E4','G4','C5','G4',
          'D4','F4','Bb4','F4','E4','G4','C5','G4',
          'F4','Bb4','D5','Bb4','F4','A4','D5','A4',
          'E4','G4','Bb4','G4','F4','A4','D5','R',
          'F4','A4','C5','A4','E4','G4','C5','G4',
          'D4','F4','Bb4','F4','F4','A4','D5','A4',
          'D4','F4','Bb4','F4','E4','G4','C5','G4',
          'F4','A4','E4','G4','F4','A4','D5','R',
        ],
        bass: [
          'D3','R','A2','R','C3','R','G3','R',
          'Bb2','R','F3','R','C3','R','G3','R',
          'Bb2','R','F3','R','D3','R','A2','R',
          'A2','R','E3','R','D3','R','A2','R',
          'F3','R','C3','R','C3','R','G3','R',
          'Bb2','R','F3','R','D3','R','A2','R',
          'Bb2','R','F3','R','C3','R','G3','R',
          'A2','R','E3','R','D3','R','R','R',
        ],
      },
    },
    {
      id: 'town_night_lantern',
      title: '灯火阑珊 · 夜巷小调',
      track: {
        stepMs: 260,
        leadTimbre: 'bell',
        harmTimbre: 'harp',
        bassTimbre: 'bass_warm',
        leadGain: 0.044,
        harmGain: 0.032,
        bassGain: 0.046,
        gate: 1.1,
        lead: [
          'G5','R','Eb5','C5','D5','R','G4','R',
          'Eb5','F5','G5','Bb5','Ab5','R','R','R',
          'F5','R','D5','Bb4','Eb5','R','C5','G4',
          'Ab4','Bb4','C5','D5','Eb5','R','R','R',
          'Bb5','R','Ab5','G5','F5','R','Eb5','D5',
          'Eb5','R','C5','G4','Ab4','R','R','R',
          'G5','F5','Eb5','D5','C5','Eb5','G5','F5',
          'Eb5','R','D5','R','C5','R','R','R',
        ],
        harmony: [
          'C4','Eb4','G4','Eb4','B3','D4','G4','D4',
          'C4','Eb4','G4','Eb4','C4','Eb4','Ab4','Eb4',
          'Bb3','D4','F4','D4','C4','Eb4','G4','Eb4',
          'C4','Eb4','Ab4','Eb4','Bb3','Eb4','G4','R',
          'Eb4','G4','Bb4','G4','D4','F4','Bb4','F4',
          'C4','Eb4','G4','Eb4','C4','Eb4','Ab4','Eb4',
          'C4','Eb4','G4','Eb4','B3','D4','G4','D4',
          'C4','Eb4','B3','D4','C4','Eb4','G4','R',
        ],
        bass: [
          'C3','R','G3','R','G3','R','D3','R',
          'C3','R','G3','R','Ab2','R','Eb3','R',
          'Bb2','R','F3','R','C3','R','G3','R',
          'Ab2','R','Eb3','R','Eb3','R','Bb2','R',
          'Eb3','R','Bb2','R','Bb2','R','F3','R',
          'C3','R','G3','R','Ab2','R','Eb3','R',
          'C3','R','G3','R','G3','R','D3','R',
          'C3','R','G3','R','C3','R','R','R',
        ],
      },
    },
  ],

  adventure: [
    {
      id: 'adventure_horizon',
      title: '风过山岗 · 旷野巡游',
      track: {
        stepMs: 158,
        leadTimbre: 'flute',
        harmTimbre: 'brass_warm',
        bassTimbre: 'bass_pluck',
        leadGain: 0.048,
        harmGain: 0.026,
        bassGain: 0.056,
        gate: 0.88,
        lead: [
          'D5','R','Fs5','A5','D6','R','Cs6','A5',
          'B5','A5','G5','Fs5','E5','R','A4','R',
          'D5','R','Fs5','A5','B5','R','A5','G5',
          'Fs5','E5','D5','E5','Fs5','R','R','R',
          'G5','R','B5','D6','Cs6','R','A5','E5',
          'Fs5','A5','B5','A5','G5','R','E5','R',
          'D5','Fs5','A5','B5','Cs6','R','E6','R',
          'D6','Cs6','B5','A5','D6','R','R','R',
        ],
        harmony: [
          'A4','Fs4','A4','D5','Fs5','D5','E5','Cs5',
          'D5','B4','B4','G4','Cs5','A4','E4','A4',
          'A4','Fs4','D5','A4','D5','B4','Cs5','A4',
          'A4','G4','Fs4','A4','A4','Fs4','D4','R',
          'B4','G4','D5','B4','E5','Cs5','Cs5','A4',
          'A4','D5','D5','B4','B4','G4','A4','E4',
          'Fs4','A4','D5','G5','E5','Cs5','G5','E5',
          'Fs5','E5','D5','Cs5','Fs5','D5','A4','R',
        ],
        bass: [
          'D3','D3','A3','D3','Fs3','Fs3','A3','Fs3',
          'G3','G3','D3','G3','A3','E3','A3','Cs3',
          'D3','D3','Fs3','A3','G3','G3','A3','E3',
          'D3','A3','D3','E3','Fs3','D3','A3','Fs3',
          'G3','G3','D3','G3','A3','A3','E3','A3',
          'D3','Fs3','G3','D3','E3','B3','A3','E3',
          'D3','Fs3','A3','G3','A3','E3','A3','Cs3',
          'D3','A3','G3','A3','D3','A3','D3','R',
        ],
        drums: [
          'K','H','S','H','K','H','S','H',
          'K','H','S','K','K','H','S','H',
          'K','H','S','H','K','K','S','H',
          'K','H','S','H','K','S','H','H',
          'K','H','S','H','K','H','S','H',
          'K','H','S','K','K','H','S','H',
          'K','H','S','H','K','K','S','H',
          'K','S','K','S','K','H','S','H',
        ],
      },
    },
    {
      id: 'adventure_coast',
      title: '碧海晴岚 · 环海公路',
      track: {
        stepMs: 152,
        swing: 0.08,
        leadTimbre: 'woodwind',
        harmTimbre: 'bell',
        bassTimbre: 'bass_pluck',
        leadGain: 0.046,
        harmGain: 0.028,
        bassGain: 0.056,
        gate: 0.84,
        lead: [
          'E5','R','A5','B5','Cs6','R','B5','A5',
          'Fs5','A5','B5','Cs6','B5','R','E5','R',
          'A5','R','Cs6','E6','D6','Cs6','B5','A5',
          'Gs5','A5','B5','Gs5','A5','R','R','R',
          'D6','R','Cs6','B5','Cs6','R','A5','E5',
          'Fs5','Gs5','A5','B5','Gs5','R','E5','R',
          'A5','B5','Cs6','D6','E6','R','Cs6','B5',
          'A5','Gs5','Fs5','Gs5','A5','R','R','R',
        ],
        harmony: [
          'Cs5','A4','Cs5','E5','E5','Cs5','E5','Cs5',
          'D5','A4','D5','Fs5','E5','B4','Gs4','B4',
          'Cs5','A4','E5','Cs5','Fs5','D5','D5','B4',
          'B4','E5','E5','B4','Cs5','A4','E4','R',
          'Fs5','D5','Fs5','D5','E5','Cs5','Cs5','A4',
          'D5','B4','D5','Fs5','E5','B4','Gs4','B4',
          'Cs5','E5','A5','Fs5','Gs5','E5','E5','D5',
          'Cs5','B4','A4','B4','Cs5','E5','A4','R',
        ],
        bass: [
          'A3','A3','E3','A3','A3','E3','Cs3','E3',
          'D3','D3','A3','D3','E3','B2','E3','Gs3',
          'A3','A3','Cs3','E3','D3','D3','Fs3','D3',
          'E3','B2','E3','Gs3','A3','E3','A3','E3',
          'D3','D3','A3','D3','A3','A3','E3','A3',
          'B2','B2','Fs3','B2','E3','B2','E3','Gs3',
          'A3','E3','A3','D3','E3','B2','E3','Gs3',
          'A3','E3','D3','E3','A3','E3','A3','R',
        ],
        drums: [
          'K','H','S','H','K','H','S','H',
          'K','H','S','H','K','K','S','H',
          'K','H','S','H','K','H','S','H',
          'K','H','S','S','K','H','S','H',
          'K','H','S','H','K','K','S','H',
          'K','H','S','H','K','H','S','H',
          'K','H','S','H','K','K','S','H',
          'K','S','K','S','K','H','S','',
        ],
      },
    },
  ],

  pokemon_center: [
    {
      id: 'pc_lullaby',
      title: '暖灯安眠曲 · 休整大厅',
      track: {
        stepMs: 210,
        leadTimbre: 'flute',
        harmTimbre: 'bell',
        bassTimbre: 'bass_warm',
        leadGain: 0.048,
        harmGain: 0.028,
        bassGain: 0.052,
        gate: 0.96,
        lead: [
          'C5','F5','A5','G5','F5','E5','D5','C5',
          'D5','F5','A5','G5','E5','R','C5','R',
          'F5','A5','C6','Bb5','A5','G5','F5','D5',
          'C5','E5','G5','E5','F5','R','R','R',
          'A5','R','C6','R','Bb5','A5','G5','R',
          'G5','R','Bb5','R','A5','G5','F5','R',
          'D5','F5','Bb5','D6','C6','A5','G5','E5',
          'F5','G5','A5','G5','F5','R','R','R',
        ],
        harmony: [
          'A4','R','C5','R','A4','R','G4','R',
          'F4','R','Bb4','R','G4','R','E4','R',
          'A4','R','C5','R','D5','R','Bb4','R',
          'G4','R','Bb4','R','A4','C5','A4','R',
          'C5','F5','A4','C5','D5','F5','Bb4','D5',
          'Bb4','E5','G4','Bb4','A4','C5','A4','R',
          'Bb4','R','D5','R','C5','R','Bb4','R',
          'A4','R','C5','R','A4','R','R','R',
        ],
        bass: [
          'F3','R','C3','R','F3','R','C3','R',
          'Bb2','R','F3','R','C3','R','G3','R',
          'F3','R','C3','R','Bb2','R','F3','R',
          'C3','R','G3','R','F3','R','C3','R',
          'F3','R','A3','R','Bb2','R','F3','R',
          'C3','R','G3','R','F3','R','C3','R',
          'Bb2','R','F3','R','C3','R','G3','R',
          'F3','R','C3','R','F3','R','R','R',
        ],
      },
    },
  ],

  poke_mart: [
    {
      id: 'mart_berry',
      title: '树果货架 · 商店街晨曲',
      track: {
        stepMs: 170,
        swing: 0.14,
        leadTimbre: 'bell',
        harmTimbre: 'woodwind',
        bassTimbre: 'bass_pluck',
        leadGain: 0.046,
        harmGain: 0.026,
        bassGain: 0.056,
        gate: 0.74,
        lead: [
          'F5','Bb5','D6','Bb5','C6','A5','F5','R',
          'G5','C6','Eb6','D6','C6','Bb5','A5','C6',
          'Bb5','F5','D5','F5','G5','Bb5','Eb6','D6',
          'C6','A5','F5','A5','Bb5','R','R','R',
          'D6','R','Bb5','D6','Eb6','D6','C6','R',
          'C6','R','A5','C6','D6','C6','Bb5','R',
          'G5','Bb5','Eb6','G6','F6','D6','C6','A5',
          'Bb5','D6','F6','D6','Bb5','R','R','R',
        ],
        harmony: [
          'R','D5','R','F5','R','Eb5','R','C5',
          'R','Eb5','R','G5','R','E5','F5','Eb5',
          'R','D5','R','Bb4','R','Eb5','G5','F5',
          'R','Eb5','R','Eb5','D5','F5','D5','R',
          'F5','R','D5','F5','G5','F5','Eb5','R',
          'Eb5','R','C5','Eb5','F5','Eb5','D5','R',
          'Eb5','R','G5','Bb5','A5','F5','Eb5','C5',
          'D5','F5','Bb5','F5','D5','R','R','R',
        ],
        bass: [
          'Bb2','R','F3','R','F3','R','C3','R',
          'C3','R','G3','R','F3','R','C3','A2',
          'Bb2','R','D3','R','Eb3','R','G3','R',
          'F3','R','C3','F3','Bb2','F3','Bb2','R',
          'Bb2','F3','Bb2','D3','Eb3','Bb2','Eb3','G3',
          'F3','C3','F3','A3','Bb2','F3','Bb2','D3',
          'Eb3','Bb2','Eb3','G3','F3','C3','F3','Eb3',
          'Bb2','F3','D3','F3','Bb2','R','R','R',
        ],
        drums: [
          'K','B','H','B','K','B','S','B',
          'K','B','H','B','K','B','S','H',
          'K','B','H','B','K','B','S','B',
          'K','B','S','B','K','S','B','',
          'K','B','H','B','K','B','S','B',
          'K','B','H','B','K','B','S','B',
          'K','B','H','B','K','B','S','B',
          'K','S','H','B','K','','','',
        ],
      },
    },
  ],

  restaurant: [
    {
      id: 'rest_teatime',
      title: '甜香下午茶 · 烘焙小馆',
      track: {
        stepMs: 200,
        swing: 0.12,
        leadTimbre: 'rhodes',
        harmTimbre: 'flute',
        bassTimbre: 'bass_pluck',
        leadGain: 0.048,
        harmGain: 0.03,
        bassGain: 0.052,
        gate: 0.96,
        lead: [
          'Fs5','R','E5','D5','B4','R','A4','B4',
          'D5','R','Cs5','D5','E5','R','R','R',
          'E5','R','D5','C5','A4','R','G4','A4',
          'C5','R','B4','C5','D5','R','B4','R',
          'G5','R','Fs5','E5','D5','B4','G4','B4',
          'E5','R','D5','C5','B4','A4','G4','R',
          'A4','C5','E5','G5','Fs5','D5','B4','A4',
          'B4','R','D5','R','G4','R','R','R',
        ],
        harmony: [
          'B4','R','Fs4','B4','R','Fs4','D4','R',
          'G4','R','Cs4','G4','R','Cs4','B3','R',
          'G4','R','E4','G4','R','E4','C4','R',
          'Fs4','R','C4','Fs4','R','E4','D4','R',
          'B4','R','Fs4','B4','F4','R','D4','F4',
          'G4','R','E4','G4','Eb4','R','C4','Eb4',
          'G4','R','E4','G4','Fs4','R','C4','Fs4',
          'Fs4','D4','B3','D4','B3','R','R','R',
        ],
        bass: [
          'G3','R','R','D3','G3','R','D3','R',
          'E3','R','R','B2','E3','R','B2','R',
          'A2','R','R','E3','A2','R','E3','R',
          'D3','R','R','A2','D3','R','A2','Fs3',
          'G3','R','R','D3','G3','R','F3','R',
          'C3','R','R','G3','C3','R','Eb3','R',
          'A2','R','R','E3','D3','R','A2','R',
          'G3','R','D3','R','G3','R','D3','R',
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
    },
  ],

  hotel: [
    {
      id: 'hotel_velvet',
      title: '晚安大堂 · 丝绒钢琴',
      track: {
        stepMs: 255,
        leadTimbre: 'rhodes',
        harmTimbre: 'harp',
        bassTimbre: 'bass_warm',
        leadGain: 0.046,
        harmGain: 0.032,
        bassGain: 0.046,
        gate: 1.12,
        lead: [
          'G5','R','E5','C5','D5','R','G4','R',
          'E5','F5','E5','D5','C5','R','R','R',
          'A5','R','F5','C5','G5','R','E5','C5',
          'D5','E5','F5','E5','D5','R','R','R',
          'G5','R','C6','B5','A5','R','F5','D5',
          'G5','R','E5','C5','D5','R','B4','G4',
          'C5','E5','G5','C6','B5','G5','F5','D5',
          'E5','R','D5','R','C5','R','R','R',
        ],
        harmony: [
          'C4','E4','G4','E4','B3','D4','F4','D4',
          'C4','E4','G4','E4','G3','C4','E4','C4',
          'C4','F4','A4','F4','C4','E4','G4','E4',
          'A3','D4','F4','D4','B3','D4','G4','F4',
          'C4','E4','G4','E4','D4','F4','A4','F4',
          'C4','E4','G4','E4','B3','D4','G4','D4',
          'A3','C4','F4','A4','B3','D4','F4','G4',
          'C4','E4','F4','B3','C4','E4','G4','R',
        ],
        bass: [
          'C3','R','G3','R','G3','R','D3','R',
          'C3','R','G3','R','C3','R','E3','R',
          'F3','R','C3','R','E3','R','C3','R',
          'D3','R','A2','R','G3','R','D3','R',
          'E3','R','C3','R','F3','R','D3','R',
          'C3','R','G3','R','G3','R','D3','R',
          'F3','R','C3','R','G3','R','D3','R',
          'C3','R','G3','R','C3','R','R','R',
        ],
      },
    },
  ],

  house: [
    {
      id: 'house_window',
      title: '窗边午睡 · 晴日书房',
      track: {
        stepMs: 225,
        leadTimbre: 'harp',
        harmTimbre: 'flute',
        bassTimbre: 'bass_warm',
        leadGain: 0.046,
        harmGain: 0.03,
        bassGain: 0.048,
        gate: 0.96,
        lead: [
          'Fs5','A5','D6','A5','B5','A5','G5','R',
          'E5','G5','B5','D6','Cs6','B5','A5','R',
          'Fs5','A5','D6','Fs6','E6','D6','B5','G5',
          'A5','B5','Cs6','E6','D6','R','R','R',
          'G5','Fs5','E5','D5','Cs5','A4','E5','R',
          'Fs5','E5','D5','B4','A4','Fs4','D5','R',
          'E5','G5','B5','D6','Cs6','E6','A5','Cs6',
          'D6','R','A5','Fs5','D5','R','R','R',
        ],
        harmony: [
          'D4','A3','Fs4','D4','D4','B3','B3','G3',
          'B3','G3','E4','B3','E4','Cs4','Cs4','A3',
          'D4','A3','A4','D4','G4','B3','D4','B3',
          'Cs4','A3','E4','G4','Fs4','A3','D4','R',
          'B3','D4','G4','B3','A3','Cs4','G4','Cs4',
          'A3','D4','Fs4','D4','Fs3','B3','Fs4','B3',
          'G3','B3','E4','G4','A3','Cs4','E4','G4',
          'Fs4','A3','D4','A3','Fs3','R','R','R',
        ],
        bass: [
          'D3','R','A2','R','G3','R','D3','R',
          'E3','R','B2','R','A2','R','E3','R',
          'D3','R','Cs3','R','B2','R','G3','R',
          'A2','R','A2','Cs3','D3','A2','D3','R',
          'G3','R','E3','R','A2','R','Cs3','R',
          'D3','R','A2','R','B2','R','Fs3','R',
          'E3','R','G3','R','A2','R','A2','R',
          'D3','R','A2','R','D3','R','R','R',
        ],
      },
    },
  ],

  battle: [
    {
      id: 'battle_champion',
      title: '巅峰对决 · 道馆与冠军',
      track: {
        stepMs: 128,
        leadTimbre: 'brass_warm',
        harmTimbre: 'woodwind',
        bassTimbre: 'bass_pluck',
        leadGain: 0.048,
        harmGain: 0.028,
        bassGain: 0.062,
        gate: 0.85,
        lead: [
          'D5','R','D5','F5','A5','R','G5','F5',
          'E5','F5','G5','E5','A5','R','E5','R',
          'D5','F5','A5','D6','C6','Bb5','A5','G5',
          'A5','G5','F5','E5','D5','R','R','R',
          'Bb5','R','A5','G5','F5','G5','A5','R',
          'G5','A5','Bb5','D6','C6','A5','G5','R',
          'F5','A5','C6','F6','E6','D6','C6','Bb5',
          'A5','G5','A5','Cs6','D6','R','A5','R',
        ],
        harmony: [
          'A4','F4','A4','D5','F5','D5','E5','D5',
          'Cs5','D5','E5','Cs5','E5','Cs5','A4','Cs5',
          'A4','D5','F5','A5','G5','G5','F5','E5',
          'F5','E5','D5','Cs5','A4','F4','D4','R',
          'F5','D5','F5','D5','D5','E5','F5','C5',
          'E5','F5','G5','Bb5','A5','F5','E5','C5',
          'C5','F5','A5','C6','C6','Bb5','A5','G5',
          'F5','E5','E5','G5','F5','D5','E5','R',
        ],
        bass: [
          'D3','D3','A2','D3','D3','D3','F3','D3',
          'A2','A2','E3','A2','A2','Cs3','E3','A2',
          'D3','D3','F3','D3','G3','G3','Bb2','G3',
          'A2','A2','E3','A2','D3','A2','D3','A2',
          'Bb2','Bb2','F3','Bb2','F3','F3','C3','F3',
          'G3','G3','D3','G3','C3','C3','G3','C3',
          'F3','F3','C3','F3','Bb2','Bb2','F3','Bb2',
          'A2','E3','A2','Cs3','D3','A2','D3','A2',
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
    },
  ],
};
