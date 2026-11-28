import type {
  BgmDrumHit,
  BgmSongEntry,
  BgmTrackId,
  BgmVoiceTimbre,
  ChiptuneTrack,
} from './bgmPlaylists';

type ScaleKind =
  | 'major'
  | 'pentatonic_major'
  | 'minor'
  | 'pentatonic_minor'
  | 'dorian'
  | 'lydian'
  | 'mixolydian'
  | 'harmonic_minor';

type ProgressionId =
  | 'royal_road'
  | 'canon'
  | 'pop_journey'
  | 'nostalgic_town'
  | 'city_pop_night'
  | 'jazz_cafe'
  | 'waltz_canal'
  | 'pentatonic_river'
  | 'lullaby_warm'
  | 'highland_march'
  | 'heroic_minor'
  | 'rival_drive'
  | 'champion_epic'
  | 'shopping_bounce';

type MotifStyle =
  | 'lyrical_arch'
  | 'bouncy_steps'
  | 'pentatonic_flow'
  | 'dreamy_float'
  | 'heroic_fanfare'
  | 'bossa_syncopated'
  | 'musicbox_arpeggio'
  | 'march_staccato'
  | 'nocturne_sigh'
  | 'battle_riff'
  | 'folk_skip'
  | 'celesta_cascade';

type HarmStyle =
  | 'arpeggio_up'
  | 'arpeggio_wave'
  | 'offbeat_chords'
  | 'sustained_thirds'
  | 'bossa_comp'
  | 'power_eighth';

type BassStyle = 'half_fifth' | 'walking' | 'bossa' | 'driving_eighth' | 'oompah' | 'pedal_warm';

type DrumStyle =
  | 'none'
  | 'light_pop'
  | 'route_march'
  | 'bossa'
  | 'swing_shop'
  | 'battle_drive'
  | 'battle_double';

interface SongBlueprint {
  id: string;
  title: string;
  rootMidi: number; // Tonic MIDI note (e.g., 60 = C4, 62 = D4, 67 = G4)
  scale: ScaleKind;
  progression: ProgressionId;
  motif: MotifStyle;
  harm: HarmStyle;
  bass: BassStyle;
  drums: DrumStyle;
  stepMs: number;
  swing?: number;
  leadTimbre: BgmVoiceTimbre;
  harmTimbre: BgmVoiceTimbre;
  bassTimbre: BgmVoiceTimbre;
  gate?: number;
  seed: number;
}

const PITCH_NAMES = ['C', 'Cs', 'D', 'Eb', 'E', 'F', 'Fs', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const SCALES: Record<ScaleKind, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic_minor: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
};

// 16 chord degrees (1 chord per 4 steps = 64 steps total), in 0-indexed diatonic degrees (wrapped to scale size)
const PROGRESSIONS: Record<ProgressionId, number[]> = {
  royal_road: [3, 4, 2, 5, 1, 4, 0, 0, 3, 4, 2, 5, 1, 4, 0, 0],
  canon: [0, 4, 5, 2, 3, 0, 3, 4, 0, 4, 5, 2, 3, 4, 0, 0],
  pop_journey: [0, 4, 5, 3, 1, 4, 0, 4, 3, 4, 2, 5, 1, 4, 0, 0],
  nostalgic_town: [0, 2, 3, 4, 5, 2, 3, 4, 3, 0, 1, 4, 5, 3, 4, 0],
  city_pop_night: [3, 4, 2, 5, 1, 4, 0, 5, 3, 4, 2, 5, 3, 4, 0, 0],
  jazz_cafe: [1, 4, 0, 5, 1, 4, 2, 5, 3, 4, 2, 5, 1, 4, 0, 0],
  waltz_canal: [0, 3, 4, 0, 5, 1, 4, 0, 3, 0, 1, 4, 5, 3, 4, 0],
  pentatonic_river: [0, 3, 4, 0, 2, 3, 4, 0, 3, 4, 2, 0, 1, 4, 0, 0],
  lullaby_warm: [0, 3, 0, 4, 5, 3, 4, 0, 3, 0, 5, 3, 1, 4, 0, 0],
  highland_march: [0, 6, 3, 0, 5, 3, 4, 4, 3, 4, 5, 2, 3, 4, 0, 0],
  heroic_minor: [0, 5, 6, 0, 3, 6, 2, 4, 5, 6, 0, 3, 5, 3, 4, 0],
  rival_drive: [0, 6, 5, 4, 3, 0, 1, 4, 5, 6, 2, 5, 3, 4, 0, 4],
  champion_epic: [0, 3, 6, 2, 5, 1, 4, 0, 5, 6, 0, 2, 3, 4, 5, 0],
  shopping_bounce: [0, 5, 1, 4, 0, 3, 4, 0, 3, 4, 0, 5, 1, 4, 0, 0],
};

/** Clamp MIDI note safely inside the synthesizer's exact `N` table (`A2 = 45` .. `G6 = 91`) */
function midiToNote(midi: number, minMidi = 45, maxMidi = 91): string {
  let m = Math.round(midi);
  while (m < minMidi) m += 12;
  while (m > maxMidi) m -= 12;
  const pc = ((m % 12) + 12) % 12;
  const oct = Math.floor(m / 12) - 1;
  return `${PITCH_NAMES[pc]}${oct}`;
}

function degreeToMidi(rootMidi: number, scale: number[], degree: number): number {
  const len = scale.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return rootMidi + oct * 12 + scale[idx];
}

function prng(seed: number, step: number): number {
  let x = (Math.imul(seed + 17, 374761393) + Math.imul(step + 31, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Motif templates over a 16-step phrase (4 chords × 4 steps):
 * Each entry is either `null` (rest) or a relative scale-degree offset from the chord root!
 */
const MOTIF_PHRASES: Record<MotifStyle, { a: (number | null)[]; b: (number | null)[] }> = {
  lyrical_arch: {
    a: [2, null, 4, 5, 4, null, 2, 0, 2, 3, 4, 2, 0, null, null, null],
    b: [4, null, 6, 7, 5, 4, 2, null, 4, 3, 2, 1, 2, null, 0, null],
  },
  bouncy_steps: {
    a: [0, 2, 4, 2, 4, 5, 4, null, 2, 4, 5, 4, 2, null, 0, null],
    b: [4, null, 2, 4, 5, 4, 2, null, 0, 2, 4, 6, 4, 2, 0, null],
  },
  pentatonic_flow: {
    a: [2, 3, 5, 3, 4, 3, 2, 0, 1, 2, 3, 2, 0, null, null, null],
    b: [5, 4, 3, 2, 3, 5, 4, null, 3, 2, 1, 0, 2, null, 0, null],
  },
  dreamy_float: {
    a: [4, null, 2, null, 6, null, 4, 2, 3, null, 4, 6, 4, null, null, null],
    b: [7, null, 6, 4, 5, null, 2, null, 4, null, 3, 2, 0, null, null, null],
  },
  heroic_fanfare: {
    a: [0, null, 0, 2, 4, null, 2, 0, 2, 3, 4, 2, 4, null, 0, null],
    b: [7, null, 6, 5, 4, null, 2, 4, 5, 4, 3, 2, 4, null, 7, null],
  },
  bossa_syncopated: {
    a: [6, null, 4, 2, null, 2, 4, null, 4, null, 3, 2, 4, null, null, null],
    b: [7, null, 6, 4, 2, 4, 6, null, 4, 3, 2, 0, 2, null, null, null],
  },
  musicbox_arpeggio: {
    a: [4, null, 2, 0, 2, null, 4, null, 6, 4, 2, 4, 2, null, null, null],
    b: [7, null, 4, 2, 6, null, 4, 2, 4, 2, 1, 2, 0, null, null, null],
  },
  march_staccato: {
    a: [0, 2, 4, 4, 5, 4, 2, null, 0, 2, 4, 6, 4, null, 2, null],
    b: [4, 4, 6, 4, 5, 4, 2, 0, 2, 4, 5, 6, 7, null, 4, null],
  },
  nocturne_sigh: {
    a: [4, null, 3, 2, 0, null, null, 2, 3, 2, 0, -1, 0, null, null, null],
    b: [6, null, 4, 3, 4, null, 2, null, 3, 2, 1, 0, 2, null, 0, null],
  },
  battle_riff: {
    a: [0, 2, 3, 4, 5, 4, 3, 2, 0, null, 4, null, 3, 2, 1, 0],
    b: [7, 6, 5, 4, 5, 4, 2, null, 4, 5, 6, 7, 5, 4, 2, null],
  },
  folk_skip: {
    a: [0, 2, 4, null, 2, 4, 5, 4, 2, 0, 2, 4, 2, null, null, null],
    b: [4, 5, 6, 4, 2, 4, 5, null, 4, 2, 1, 2, 0, null, null, null],
  },
  celesta_cascade: {
    a: [7, 4, 2, 0, 4, 2, 0, null, 6, 4, 2, 4, 2, null, null, null],
    b: [7, 6, 4, 2, 5, 4, 2, 0, 4, 2, 4, 6, 4, null, 0, null],
  },
};

function buildDrums(style: DrumStyle): BgmDrumHit[] | undefined {
  if (style === 'none') return undefined;
  const bar8: Record<Exclude<DrumStyle, 'none'>, BgmDrumHit[]> = {
    light_pop: ['K', '', 'H', '', 'K', '', 'S', ''],
    route_march: ['K', 'H', 'S', 'H', 'K', 'H', 'S', 'H'],
    bossa: ['K', 'B', 'B', 'K', 'B', 'K', 'B', 'B'],
    swing_shop: ['K', 'B', 'H', 'B', 'K', 'B', 'S', 'B'],
    battle_drive: ['K', 'H', 'S', 'H', 'K', 'K', 'S', 'H'],
    battle_double: ['K', 'S', 'K', 'H', 'K', 'K', 'S', 'S'],
  };
  const pat = bar8[style];
  const out: BgmDrumHit[] = [];
  for (let i = 0; i < 64; i++) {
    let hit = pat[i % 8];
    if (i === 30 || i === 62) hit = 'S';
    if (i === 63) hit = style === 'battle_drive' || style === 'battle_double' ? 'S' : '';
    out.push(hit);
  }
  return out;
}

/** Deterministically composes a musically cohesive 64-step 3-voice + drum GBA/NDS chiptune track */
function composeRegionalTrack(bp: SongBlueprint): BgmSongEntry {
  const scale = SCALES[bp.scale];
  const prog = PROGRESSIONS[bp.progression];
  const motif = MOTIF_PHRASES[bp.motif];
  const lead: string[] = [];
  const harmony: string[] = [];
  const bass: string[] = [];

  for (let step = 0; step < 64; step++) {
    const chordIdx = Math.floor(step / 4);
    const beatInChord = step % 4;
    const phraseIdx = Math.floor(step / 16); // 0: A, 1: A', 2: B, 3: A'' (cadence)
    const stepInPhrase = step % 16;
    const deg = prog[chordIdx] % scale.length;

    // 1. LEAD MELODY (A - A' - B - A'' with tasteful seed-based melodic ornaments & tonic cadence)
    const basePattern = phraseIdx === 2 ? motif.b : motif.a;
    const rawRel = basePattern[stepInPhrase];
    if (rawRel === null) {
      lead.push('R');
    } else {
      let rel = rawRel;
      // Phrase A' slight lift on bars 3-4; final bar resolves cleanly to tonic (degree 0 or octave)
      if (phraseIdx === 1 && stepInPhrase >= 8 && stepInPhrase <= 11) {
        rel += bp.seed % 2 === 0 ? 1 : 2;
      } else if (phraseIdx === 3 && stepInPhrase === 12) {
        rel = 0;
      } else if (phraseIdx === 3 && stepInPhrase > 12) {
        lead.push('R');
        // Still push harmony & bass below!
        rel = 999;
      } else if (beatInChord === 1 || beatInChord === 3) {
        const r = prng(bp.seed, step);
        if (r > 0.78) rel += 1;
        else if (r < 0.16) rel -= 1;
      }

      if (rel !== 999) {
        const leadMidi = degreeToMidi(bp.rootMidi + 12, scale, deg + rel);
        lead.push(midiToNote(leadMidi, 67, 89)); // G4..F6 sweet singing range
      }
    }

    // 2. HARMONY / ARPEGGIO VOICE
    const arpOrder = [0, 2, 4, 2];
    let harmNote = 'R';
    if (bp.harm === 'arpeggio_up') {
      const m = degreeToMidi(bp.rootMidi, scale, deg + [0, 2, 4, 7][beatInChord]);
      harmNote = midiToNote(m, 57, 79);
    } else if (bp.harm === 'arpeggio_wave') {
      const m = degreeToMidi(bp.rootMidi, scale, deg + arpOrder[beatInChord]);
      harmNote = midiToNote(m, 57, 79);
    } else if (bp.harm === 'offbeat_chords') {
      if (beatInChord === 1 || beatInChord === 3) {
        const m = degreeToMidi(bp.rootMidi, scale, deg + (beatInChord === 1 ? 2 : 4));
        harmNote = midiToNote(m, 60, 81);
      }
    } else if (bp.harm === 'sustained_thirds') {
      if (beatInChord === 0 || beatInChord === 2) {
        const m = degreeToMidi(bp.rootMidi, scale, deg + (beatInChord === 0 ? 2 : 4));
        harmNote = midiToNote(m, 58, 79);
      }
    } else if (bp.harm === 'bossa_comp') {
      if (beatInChord === 0 || beatInChord === 2 || beatInChord === 3) {
        const m = degreeToMidi(bp.rootMidi, scale, deg + (beatInChord === 0 ? 4 : 2));
        harmNote = midiToNote(m, 58, 78);
      }
    } else if (bp.harm === 'power_eighth') {
      const m = degreeToMidi(bp.rootMidi, scale, deg + (beatInChord % 2 === 0 ? 4 : 2));
      harmNote = midiToNote(m, 58, 81);
    }
    if (step === 63) harmNote = 'R';
    harmony.push(harmNote);

    // 3. BASS VOICE
    let bassNote = 'R';
    const rootB = degreeToMidi(bp.rootMidi - 12, scale, deg);
    const fifthB = degreeToMidi(bp.rootMidi - 12, scale, deg + 4);
    const thirdB = degreeToMidi(bp.rootMidi - 12, scale, deg + 2);
    if (bp.bass === 'half_fifth') {
      if (beatInChord === 0) bassNote = midiToNote(rootB, 45, 62);
      else if (beatInChord === 2) bassNote = midiToNote(fifthB, 45, 62);
    } else if (bp.bass === 'pedal_warm') {
      if (beatInChord === 0) bassNote = midiToNote(rootB, 45, 60);
      else if (beatInChord === 2 && chordIdx % 2 === 1) bassNote = midiToNote(fifthB, 45, 60);
    } else if (bp.bass === 'oompah') {
      if (beatInChord === 0) bassNote = midiToNote(rootB, 45, 62);
      else if (beatInChord === 2) bassNote = midiToNote(fifthB, 45, 62);
      else if (beatInChord === 3 && chordIdx % 2 === 1) bassNote = midiToNote(thirdB, 45, 62);
    } else if (bp.bass === 'bossa') {
      if (beatInChord === 0 || beatInChord === 3) bassNote = midiToNote(rootB, 45, 60);
      else if (beatInChord === 2) bassNote = midiToNote(fifthB, 45, 60);
    } else if (bp.bass === 'walking') {
      const walk = [rootB, thirdB, fifthB, degreeToMidi(bp.rootMidi - 12, scale, deg + 3)][beatInChord];
      bassNote = midiToNote(walk, 45, 62);
    } else if (bp.bass === 'driving_eighth') {
      const drv = [rootB, rootB, fifthB, rootB][beatInChord];
      bassNote = midiToNote(drv, 45, 62);
    }
    if (step >= 62 && bp.drums !== 'battle_drive' && bp.drums !== 'battle_double') {
      bassNote = 'R';
    }
    bass.push(bassNote);
  }

  const isBattle = bp.drums === 'battle_drive' || bp.drums === 'battle_double';
  const track: ChiptuneTrack = {
    stepMs: bp.stepMs,
    ...(bp.swing ? { swing: bp.swing } : {}),
    leadTimbre: bp.leadTimbre,
    harmTimbre: bp.harmTimbre,
    bassTimbre: bp.bassTimbre,
    leadGain: isBattle ? 0.048 : 0.045,
    harmGain: bp.harm === 'power_eighth' ? 0.026 : 0.03,
    bassGain: isBattle ? 0.06 : 0.05,
    gate: bp.gate ?? (isBattle ? 0.85 : 0.94),
    lead,
    harmony,
    bass,
    drums: buildDrums(bp.drums),
  };

  return {
    id: bp.id,
    title: bp.title,
    track,
  };
}

const COMPOSED_BLUEPRINTS: Record<Exclude<BgmTrackId, 'safezone'>, SongBlueprint[]> = {
  hub: [
    {
      id: 'hub_cloud_prologue',
      title: '云端微风 · 冒险序章',
      rootMidi: 65,
      scale: 'major',
      progression: 'royal_road',
      motif: 'lyrical_arch',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 222,
      leadTimbre: 'flute',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      gate: 0.98,
      seed: 11,
    },
    {
      id: 'hub_star_album',
      title: '星空相册 · 羁绊记忆',
      rootMidi: 63,
      scale: 'major',
      progression: 'lullaby_warm',
      motif: 'celesta_cascade',
      harm: 'arpeggio_up',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 235,
      leadTimbre: 'bell',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      gate: 1.04,
      seed: 12,
    },
    {
      id: 'hub_pocket_sky',
      title: '口袋晴空 · 新的旅程',
      rootMidi: 69,
      scale: 'major',
      progression: 'pop_journey',
      motif: 'folk_skip',
      harm: 'sustained_thirds',
      bass: 'half_fifth',
      drums: 'light_pop',
      stepMs: 205,
      leadTimbre: 'flute',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      gate: 0.92,
      seed: 13,
    },
    {
      id: 'hub_world_call',
      title: '世界地图 · 远方呼唤',
      rootMidi: 62,
      scale: 'lydian',
      progression: 'canon',
      motif: 'dreamy_float',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 230,
      leadTimbre: 'harp',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_warm',
      gate: 1.05,
      seed: 14,
    },
  ],

  town: [
    {
      id: 'town_fountain',
      title: '白鸽喷泉 · 晨间林荫',
      rootMidi: 65,
      scale: 'major',
      progression: 'nostalgic_town',
      motif: 'lyrical_arch',
      harm: 'arpeggio_wave',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 208,
      leadTimbre: 'flute',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      seed: 21,
    },
    {
      id: 'town_old_street',
      title: '青砖红瓦 · 老街漫游',
      rootMidi: 62,
      scale: 'pentatonic_major',
      progression: 'pentatonic_river',
      motif: 'pentatonic_flow',
      harm: 'arpeggio_up',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 215,
      leadTimbre: 'woodwind',
      harmTimbre: 'harp',
      bassTimbre: 'bass_pluck',
      seed: 22,
    },
    {
      id: 'town_harbor_pier',
      title: '海风码头 · 港口长廊',
      rootMidi: 63,
      scale: 'major',
      progression: 'pop_journey',
      motif: 'bouncy_steps',
      harm: 'offbeat_chords',
      bass: 'oompah',
      drums: 'light_pop',
      stepMs: 192,
      swing: 0.08,
      leadTimbre: 'bell',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_pluck',
      seed: 23,
    },
    {
      id: 'town_sakura_hill',
      title: '樱花坡道 · 校园钟声',
      rootMidi: 69,
      scale: 'major',
      progression: 'royal_road',
      motif: 'celesta_cascade',
      harm: 'sustained_thirds',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 204,
      leadTimbre: 'bell',
      harmTimbre: 'flute',
      bassTimbre: 'bass_warm',
      seed: 24,
    },
    {
      id: 'town_tram_ave',
      title: '电车叮当 · 站前大道',
      rootMidi: 70,
      scale: 'major',
      progression: 'shopping_bounce',
      motif: 'march_staccato',
      harm: 'offbeat_chords',
      bass: 'walking',
      drums: 'swing_shop',
      stepMs: 184,
      swing: 0.1,
      leadTimbre: 'woodwind',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      gate: 0.8,
      seed: 25,
    },
    {
      id: 'town_flower_corner',
      title: '午后花市 · 暖阳街角',
      rootMidi: 67,
      scale: 'major',
      progression: 'jazz_cafe',
      motif: 'bossa_syncopated',
      harm: 'bossa_comp',
      bass: 'bossa',
      drums: 'bossa',
      stepMs: 198,
      swing: 0.07,
      leadTimbre: 'rhodes',
      harmTimbre: 'harp',
      bassTimbre: 'bass_pluck',
      seed: 26,
    },
    {
      id: 'town_cable_car',
      title: '山城缆车 · 梯田眺望',
      rootMidi: 60,
      scale: 'pentatonic_major',
      progression: 'waltz_canal',
      motif: 'folk_skip',
      harm: 'arpeggio_wave',
      bass: 'oompah',
      drums: 'light_pop',
      stepMs: 202,
      leadTimbre: 'flute',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_warm',
      seed: 27,
    },
  ],

  town_night: [
    {
      id: 'night_rooftop_stars',
      title: '天台星河 · 午夜微光',
      rootMidi: 67,
      scale: 'lydian',
      progression: 'city_pop_night',
      motif: 'dreamy_float',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 252,
      leadTimbre: 'bell',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_warm',
      gate: 1.08,
      seed: 31,
    },
    {
      id: 'night_konbini_walk',
      title: '便利店暖灯 · 归途漫步',
      rootMidi: 60,
      scale: 'major',
      progression: 'city_pop_night',
      motif: 'bossa_syncopated',
      harm: 'bossa_comp',
      bass: 'bossa',
      drums: 'bossa',
      stepMs: 224,
      swing: 0.09,
      leadTimbre: 'rhodes',
      harmTimbre: 'flute',
      bassTimbre: 'bass_pluck',
      gate: 1.02,
      seed: 32,
    },
    {
      id: 'night_ferris_harbor',
      title: '摩天轮倒影 · 港湾夜色',
      rootMidi: 69,
      scale: 'minor',
      progression: 'nostalgic_town',
      motif: 'nocturne_sigh',
      harm: 'arpeggio_up',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 258,
      leadTimbre: 'harp',
      harmTimbre: 'bell',
      bassTimbre: 'bass_warm',
      gate: 1.1,
      seed: 33,
    },
    {
      id: 'night_last_train',
      title: '末班电车 · 轨道余晖',
      rootMidi: 62,
      scale: 'major',
      progression: 'royal_road',
      motif: 'lyrical_arch',
      harm: 'sustained_thirds',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 242,
      leadTimbre: 'rhodes',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      gate: 1.05,
      seed: 34,
    },
    {
      id: 'night_market_alley',
      title: '夜市烟火 · 暖风串巷',
      rootMidi: 64,
      scale: 'pentatonic_minor',
      progression: 'pentatonic_river',
      motif: 'pentatonic_flow',
      harm: 'offbeat_chords',
      bass: 'bossa',
      drums: 'light_pop',
      stepMs: 220,
      swing: 0.08,
      leadTimbre: 'flute',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_pluck',
      seed: 35,
    },
    {
      id: 'night_rain_neon',
      title: '雨后霓虹 · 城市倒影',
      rootMidi: 70,
      scale: 'major',
      progression: 'jazz_cafe',
      motif: 'dreamy_float',
      harm: 'bossa_comp',
      bass: 'walking',
      drums: 'bossa',
      stepMs: 236,
      swing: 0.1,
      leadTimbre: 'bell',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_warm',
      gate: 1.06,
      seed: 36,
    },
    {
      id: 'night_clocktower_zero',
      title: '钟楼零点 · 静谧星穹',
      rootMidi: 65,
      scale: 'lydian',
      progression: 'lullaby_warm',
      motif: 'musicbox_arpeggio',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 266,
      leadTimbre: 'bell',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      gate: 1.12,
      seed: 37,
    },
  ],

  adventure: [
    {
      id: 'adv_forest_creek',
      title: '林间秘径 · 晨雾溪谷',
      rootMidi: 67,
      scale: 'dorian',
      progression: 'highland_march',
      motif: 'folk_skip',
      harm: 'arpeggio_wave',
      bass: 'oompah',
      drums: 'light_pop',
      stepMs: 168,
      leadTimbre: 'flute',
      harmTimbre: 'harp',
      bassTimbre: 'bass_pluck',
      seed: 41,
    },
    {
      id: 'adv_sunny_pasture',
      title: '向阳牧场 · 草浪翻涌',
      rootMidi: 60,
      scale: 'major',
      progression: 'pop_journey',
      motif: 'march_staccato',
      harm: 'offbeat_chords',
      bass: 'walking',
      drums: 'route_march',
      stepMs: 156,
      leadTimbre: 'woodwind',
      harmTimbre: 'brass_warm',
      bassTimbre: 'bass_pluck',
      gate: 0.84,
      seed: 42,
    },
    {
      id: 'adv_bamboo_ridge',
      title: '竹海听风 · 翠峰古道',
      rootMidi: 62,
      scale: 'pentatonic_major',
      progression: 'pentatonic_river',
      motif: 'pentatonic_flow',
      harm: 'arpeggio_up',
      bass: 'half_fifth',
      drums: 'light_pop',
      stepMs: 174,
      leadTimbre: 'flute',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      seed: 43,
    },
    {
      id: 'adv_sunset_plains',
      title: '落日荒原 · 远行车辙',
      rootMidi: 69,
      scale: 'mixolydian',
      progression: 'highland_march',
      motif: 'heroic_fanfare',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'route_march',
      stepMs: 152,
      leadTimbre: 'brass_warm',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_pluck',
      gate: 0.86,
      seed: 44,
    },
    {
      id: 'adv_snow_pass',
      title: '雪岭云海 · 冰川天路',
      rootMidi: 63,
      scale: 'lydian',
      progression: 'canon',
      motif: 'dreamy_float',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 196,
      leadTimbre: 'bell',
      harmTimbre: 'flute',
      bassTimbre: 'bass_warm',
      gate: 1.04,
      seed: 45,
    },
    {
      id: 'adv_maple_canyon',
      title: '红叶峡谷 · 秋风山路',
      rootMidi: 64,
      scale: 'minor',
      progression: 'heroic_minor',
      motif: 'lyrical_arch',
      harm: 'sustained_thirds',
      bass: 'oompah',
      drums: 'route_march',
      stepMs: 164,
      leadTimbre: 'flute',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_pluck',
      seed: 46,
    },
    {
      id: 'adv_windmill_plateau',
      title: '风车高原 · 蓝天白帆',
      rootMidi: 65,
      scale: 'major',
      progression: 'royal_road',
      motif: 'bouncy_steps',
      harm: 'offbeat_chords',
      bass: 'walking',
      drums: 'route_march',
      stepMs: 154,
      leadTimbre: 'brass_warm',
      harmTimbre: 'flute',
      bassTimbre: 'bass_pluck',
      seed: 47,
    },
    {
      id: 'adv_firefly_marsh',
      title: '萤火湿地 · 暮色芦苇',
      rootMidi: 71,
      scale: 'minor',
      progression: 'waltz_canal',
      motif: 'nocturne_sigh',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 212,
      leadTimbre: 'harp',
      harmTimbre: 'flute',
      bassTimbre: 'bass_warm',
      gate: 1.02,
      seed: 48,
    },
    {
      id: 'adv_sea_bridge',
      title: '跨海大桥 · 驰骋地平线',
      rootMidi: 67,
      scale: 'mixolydian',
      progression: 'pop_journey',
      motif: 'march_staccato',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'route_march',
      stepMs: 148,
      leadTimbre: 'brass_warm',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      gate: 0.84,
      seed: 49,
    },
  ],

  pokemon_center: [
    {
      id: 'pc_smile_heal',
      title: '微笑疗愈 · 精灵恢复室',
      rootMidi: 67,
      scale: 'major',
      progression: 'lullaby_warm',
      motif: 'lyrical_arch',
      harm: 'sustained_thirds',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 204,
      leadTimbre: 'bell',
      harmTimbre: 'flute',
      bassTimbre: 'bass_warm',
      gate: 0.96,
      seed: 51,
    },
    {
      id: 'pc_gentle_lobby',
      title: '温柔守护 · 午后候诊厅',
      rootMidi: 60,
      scale: 'major',
      progression: 'canon',
      motif: 'musicbox_arpeggio',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 218,
      leadTimbre: 'harp',
      harmTimbre: 'bell',
      bassTimbre: 'bass_warm',
      gate: 1.02,
      seed: 52,
    },
    {
      id: 'pc_bond_echo',
      title: '羁绊回响 · 元气满满',
      rootMidi: 70,
      scale: 'major',
      progression: 'royal_road',
      motif: 'bouncy_steps',
      harm: 'arpeggio_up',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 198,
      leadTimbre: 'flute',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_warm',
      seed: 53,
    },
    {
      id: 'pc_star_nightshift',
      title: '星光夜班 · 守候之歌',
      rootMidi: 63,
      scale: 'major',
      progression: 'lullaby_warm',
      motif: 'nocturne_sigh',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 238,
      leadTimbre: 'bell',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      gate: 1.08,
      seed: 54,
    },
  ],

  poke_mart: [
    {
      id: 'mart_new_arrivals',
      title: '新品上架 · 精灵球专柜',
      rootMidi: 60,
      scale: 'major',
      progression: 'shopping_bounce',
      motif: 'bouncy_steps',
      harm: 'offbeat_chords',
      bass: 'oompah',
      drums: 'swing_shop',
      stepMs: 172,
      swing: 0.14,
      leadTimbre: 'woodwind',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      gate: 0.74,
      seed: 61,
    },
    {
      id: 'mart_holiday_sale',
      title: '假日特惠 · 欢乐收银台',
      rootMidi: 67,
      scale: 'major',
      progression: 'pop_journey',
      motif: 'march_staccato',
      harm: 'offbeat_chords',
      bass: 'walking',
      drums: 'swing_shop',
      stepMs: 168,
      swing: 0.12,
      leadTimbre: 'bell',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_pluck',
      gate: 0.76,
      seed: 62,
    },
    {
      id: 'mart_travel_kit',
      title: '旅人补给 · 便携百宝箱',
      rootMidi: 63,
      scale: 'major',
      progression: 'jazz_cafe',
      motif: 'bossa_syncopated',
      harm: 'bossa_comp',
      bass: 'walking',
      drums: 'swing_shop',
      stepMs: 178,
      swing: 0.15,
      leadTimbre: 'woodwind',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_pluck',
      gate: 0.8,
      seed: 63,
    },
    {
      id: 'mart_full_basket',
      title: '满载而归 · 集市轻快调',
      rootMidi: 62,
      scale: 'major',
      progression: 'shopping_bounce',
      motif: 'folk_skip',
      harm: 'arpeggio_up',
      bass: 'oompah',
      drums: 'light_pop',
      stepMs: 176,
      leadTimbre: 'flute',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      gate: 0.82,
      seed: 64,
    },
  ],

  restaurant: [
    {
      id: 'rest_salted_caramel',
      title: '海盐焦糖 · 爵士咖啡角',
      rootMidi: 65,
      scale: 'major',
      progression: 'jazz_cafe',
      motif: 'bossa_syncopated',
      harm: 'bossa_comp',
      bass: 'bossa',
      drums: 'bossa',
      stepMs: 196,
      swing: 0.1,
      leadTimbre: 'rhodes',
      harmTimbre: 'flute',
      bassTimbre: 'bass_pluck',
      gate: 0.96,
      seed: 71,
    },
    {
      id: 'rest_hearth_soup',
      title: '炉火浓汤 · 街角小酒馆',
      rootMidi: 62,
      scale: 'major',
      progression: 'waltz_canal',
      motif: 'lyrical_arch',
      harm: 'arpeggio_wave',
      bass: 'oompah',
      drums: 'bossa',
      stepMs: 208,
      leadTimbre: 'flute',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      seed: 72,
    },
    {
      id: 'rest_berry_pancake',
      title: '莓果松饼 · 晨光早午餐',
      rootMidi: 70,
      scale: 'major',
      progression: 'city_pop_night',
      motif: 'bouncy_steps',
      harm: 'bossa_comp',
      bass: 'walking',
      drums: 'bossa',
      stepMs: 188,
      swing: 0.09,
      leadTimbre: 'rhodes',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      seed: 73,
    },
    {
      id: 'rest_candle_guitar',
      title: '烛光晚餐 · 窗边吉他曲',
      rootMidi: 63,
      scale: 'major',
      progression: 'jazz_cafe',
      motif: 'dreamy_float',
      harm: 'arpeggio_wave',
      bass: 'bossa',
      drums: 'bossa',
      stepMs: 214,
      swing: 0.08,
      leadTimbre: 'harp',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_warm',
      gate: 1.02,
      seed: 74,
    },
  ],

  hotel: [
    {
      id: 'hotel_chandelier',
      title: '水晶吊灯 · 典雅大堂',
      rootMidi: 65,
      scale: 'major',
      progression: 'waltz_canal',
      motif: 'celesta_cascade',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 248,
      leadTimbre: 'bell',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      gate: 1.1,
      seed: 81,
    },
    {
      id: 'hotel_pillow_stars',
      title: '枕边星语 · 旅途好梦',
      rootMidi: 67,
      scale: 'major',
      progression: 'lullaby_warm',
      motif: 'lyrical_arch',
      harm: 'arpeggio_up',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 256,
      leadTimbre: 'harp',
      harmTimbre: 'flute',
      bassTimbre: 'bass_warm',
      gate: 1.08,
      seed: 82,
    },
    {
      id: 'hotel_balcony_dusk',
      title: '观景阳台 · 暮色琴声',
      rootMidi: 62,
      scale: 'lydian',
      progression: 'city_pop_night',
      motif: 'dreamy_float',
      harm: 'bossa_comp',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 242,
      leadTimbre: 'rhodes',
      harmTimbre: 'bell',
      bassTimbre: 'bass_warm',
      gate: 1.08,
      seed: 83,
    },
    {
      id: 'hotel_moon_corridor',
      title: '月光走廊 · 静夜摇篮',
      rootMidi: 70,
      scale: 'major',
      progression: 'lullaby_warm',
      motif: 'musicbox_arpeggio',
      harm: 'arpeggio_wave',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 264,
      leadTimbre: 'bell',
      harmTimbre: 'rhodes',
      bassTimbre: 'bass_warm',
      gate: 1.12,
      seed: 84,
    },
  ],

  house: [
    {
      id: 'house_sun_balcony',
      title: '晒暖被子 · 阳台微风',
      rootMidi: 60,
      scale: 'major',
      progression: 'nostalgic_town',
      motif: 'folk_skip',
      harm: 'arpeggio_wave',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 212,
      leadTimbre: 'flute',
      harmTimbre: 'harp',
      bassTimbre: 'bass_pluck',
      seed: 91,
    },
    {
      id: 'house_tea_neighbor',
      title: '茶香袅袅 · 邻居串门',
      rootMidi: 67,
      scale: 'pentatonic_major',
      progression: 'pentatonic_river',
      motif: 'pentatonic_flow',
      harm: 'sustained_thirds',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 218,
      leadTimbre: 'harp',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_warm',
      seed: 92,
    },
    {
      id: 'house_wood_weekend',
      title: '木地板回声 · 闲适周末',
      rootMidi: 65,
      scale: 'major',
      progression: 'canon',
      motif: 'lyrical_arch',
      harm: 'arpeggio_up',
      bass: 'pedal_warm',
      drums: 'none',
      stepMs: 222,
      leadTimbre: 'rhodes',
      harmTimbre: 'harp',
      bassTimbre: 'bass_warm',
      seed: 93,
    },
    {
      id: 'house_desk_diary',
      title: '晚风书桌 · 日记时光',
      rootMidi: 63,
      scale: 'major',
      progression: 'lullaby_warm',
      motif: 'celesta_cascade',
      harm: 'arpeggio_wave',
      bass: 'half_fifth',
      drums: 'none',
      stepMs: 234,
      leadTimbre: 'bell',
      harmTimbre: 'flute',
      bassTimbre: 'bass_warm',
      gate: 1.02,
      seed: 94,
    },
  ],

  battle: [
    {
      id: 'battle_gale_rival',
      title: '疾风突袭 · 劲敌挑战',
      rootMidi: 64,
      scale: 'minor',
      progression: 'rival_drive',
      motif: 'battle_riff',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'battle_drive',
      stepMs: 132,
      leadTimbre: 'brass_warm',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_pluck',
      seed: 101,
    },
    {
      id: 'battle_spark_street',
      title: '电光石火 · 街头快打',
      rootMidi: 67,
      scale: 'minor',
      progression: 'heroic_minor',
      motif: 'battle_riff',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'battle_double',
      stepMs: 126,
      leadTimbre: 'brass_warm',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      seed: 102,
    },
    {
      id: 'battle_flame_gym',
      title: '烈焰意志 · 馆主试炼',
      rootMidi: 60,
      scale: 'harmonic_minor',
      progression: 'champion_epic',
      motif: 'heroic_fanfare',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'battle_drive',
      stepMs: 130,
      leadTimbre: 'brass_warm',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_pluck',
      seed: 103,
    },
    {
      id: 'battle_storm_legend',
      title: '风暴降临 · 传说压迫',
      rootMidi: 66,
      scale: 'minor',
      progression: 'champion_epic',
      motif: 'battle_riff',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'battle_double',
      stepMs: 124,
      leadTimbre: 'brass_warm',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_pluck',
      seed: 104,
    },
    {
      id: 'battle_ace_turnaround',
      title: '逆转王牌 · 全力一击',
      rootMidi: 71,
      scale: 'minor',
      progression: 'rival_drive',
      motif: 'heroic_fanfare',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'battle_drive',
      stepMs: 128,
      leadTimbre: 'brass_warm',
      harmTimbre: 'bell',
      bassTimbre: 'bass_pluck',
      seed: 105,
    },
    {
      id: 'battle_destiny_crown',
      title: '冠军荣耀 · 宿命终战',
      rootMidi: 69,
      scale: 'harmonic_minor',
      progression: 'champion_epic',
      motif: 'battle_riff',
      harm: 'power_eighth',
      bass: 'driving_eighth',
      drums: 'battle_double',
      stepMs: 122,
      leadTimbre: 'brass_warm',
      harmTimbre: 'woodwind',
      bassTimbre: 'bass_pluck',
      seed: 106,
    },
  ],
};

export const COMPOSED_REGIONAL_SONGS: Record<Exclude<BgmTrackId, 'safezone'>, BgmSongEntry[]> = {
  hub: COMPOSED_BLUEPRINTS.hub.map(composeRegionalTrack),
  town: COMPOSED_BLUEPRINTS.town.map(composeRegionalTrack),
  town_night: COMPOSED_BLUEPRINTS.town_night.map(composeRegionalTrack),
  adventure: COMPOSED_BLUEPRINTS.adventure.map(composeRegionalTrack),
  pokemon_center: COMPOSED_BLUEPRINTS.pokemon_center.map(composeRegionalTrack),
  poke_mart: COMPOSED_BLUEPRINTS.poke_mart.map(composeRegionalTrack),
  restaurant: COMPOSED_BLUEPRINTS.restaurant.map(composeRegionalTrack),
  hotel: COMPOSED_BLUEPRINTS.hotel.map(composeRegionalTrack),
  house: COMPOSED_BLUEPRINTS.house.map(composeRegionalTrack),
  battle: COMPOSED_BLUEPRINTS.battle.map(composeRegionalTrack),
};
