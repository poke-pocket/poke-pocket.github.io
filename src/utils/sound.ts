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
  | 'ko'
  | 'pokeball'
  | 'jump';

export type BgmTrackId = 'town' | 'adventure' | 'safezone' | 'battle';

// Note frequencies (Hz)
const N: Record<string, number> = {
  R: 0,
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.0, G3: 196.0, Ab3: 207.65, A3: 220.0, Bb3: 233.08, B3: 246.94,
  C4: 261.63, Cs4: 277.18, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, Ab4: 415.3, A4: 440.0, Bb4: 466.16, B4: 493.88,
  C5: 523.25, Cs5: 554.37, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.0, Bb5: 932.33, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
};

interface ChiptuneTrack {
  stepMs: number;
  lead: string[];
  harmony: string[];
  bass: string[];
  drums?: ('K' | 'S' | 'H' | '')[];
}

const TRACKS: Record<BgmTrackId, ChiptuneTrack> = {
  // 1. Cozy Nostalgic Pallet-Town-inspired 3-voice chiptune
  town: {
    stepMs: 215,
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
      'Fs4','R','A4','R','B4','R','D5','R',
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

  // 2. High-energy GBA Route / Vampire Survivors Adventure 4-channel Anthem (~155 BPM)
  adventure: {
    stepMs: 145,
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

  // 3. Cheerful Pokémon Center Safe Zone Melody
  safezone: {
    stepMs: 195,
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
      'Fs4','R','Fs4','R','B4','R','G4','R',
      'G4','R','G4','R','A4','R','Fs4','R',
      'Fs4','R','Fs4','R','B4','R','A4','R',
      'A4','R','Cs5','R','Fs4','R','R','R',
      'A4','R','D5','R','B4','R','G4','R',
      'G4','R','Cs5','R','A4','R','Fs4','R',
      'G4','R','B4','R','Cs5','R','A4','R',
      'Fs4','R','A4','R','Fs4','R','R','R',
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
  },

  // 4. Intense Gym Leader / Rival Battle Theme (168 BPM)
  battle: {
    stepMs: 130,
    lead: [
      'A5','Ab5','G5','Fs5','F5','E5','Eb5','D5',
      'E5','R','A5','R','G5','E5','D5','C5',
      'A4','C5','D5','E5','G5','E5','A5','R',
      'B5','A5','G5','E5','Fs5','G5','A5','R',
    ],
    harmony: [
      'E5','Eb5','D5','Cs5','C5','B4','Bb4','A4',
      'C5','A4','E5','C5','D5','B4','A4','E4',
      'E4','A4','B4','C5','D5','B4','E5','C5',
      'G5','E5','D5','B4','D5','E5','E5','R',
    ],
    bass: [
      'A3','A3','E3','A3','F3','F3','C3','F3',
      'G3','G3','D3','G3','A3','E3','A3','G3',
      'F3','F3','G3','G3','A3','A3','E3','A3',
      'G3','G3','E3','E3','D3','E3','A3','E3',
    ],
    drums: [
      'K','H','S','H','K','K','S','H',
      'K','H','S','H','K','S','S','H',
      'K','H','S','H','K','K','S','H',
      'K','S','K','S','K','S','S','S',
    ],
  },
};

class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  private sfxVolume = 75;
  private bgmEnabled = true;
  private bgmVolume = 42;
  private cryEnabled = true;
  private cryVolume = 80;
  private combatSfxEnabled = true;
  private masterVolume = 80;
  private muteOnBlur = true;
  private pageHidden = false;
  private currentTrack: BgmTrackId = 'town';
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private activeCry: HTMLAudioElement | null = null;
  private cryCache = new Map<number, HTMLAudioElement>();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.pageHidden = document.hidden;
        if (this.pageHidden && this.muteOnBlur && this.activeCry) {
          this.activeCry.pause();
        }
      });
    }
  }

  private isSilenceActive(): boolean {
    return this.masterVolume <= 0 || (this.muteOnBlur && this.pageHidden);
  }

  setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(100, Math.round(vol)));
  }

  setMuteOnBlur(enabled: boolean) {
    this.muteOnBlur = enabled;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(100, Math.round(vol)));
  }

  setCry(enabled: boolean, volume: number) {
    this.cryEnabled = enabled;
    this.cryVolume = Math.max(0, Math.min(100, Math.round(volume)));
  }

  setCombatSfx(enabled: boolean) {
    this.combatSfxEnabled = enabled;
  }

  setTrack(track: BgmTrackId) {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.bgmStep = 0;
    if (this.bgmEnabled && this.bgmVolume > 0 && this.bgmTimer !== null) {
      this.stopBgmLoop();
      this.startBgmLoop();
    }
  }

  setBgm(enabled: boolean, volume: number) {
    this.bgmEnabled = enabled;
    this.bgmVolume = Math.max(0, Math.min(100, Math.round(volume)));
    if (enabled && this.bgmVolume > 0) {
      this.startBgmLoop();
    } else {
      this.stopBgmLoop();
    }
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
    // Crisp 8-bit LFSR-like quantized noise
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() > 0.5 ? 0.8 : -0.8;
    }
    this.noiseBuf = buf;
    return buf;
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

  private startBgmLoop() {
    if (typeof window === 'undefined' || this.bgmTimer !== null) return;
    const track = TRACKS[this.currentTrack];
    this.bgmTimer = window.setInterval(() => {
      if (!this.bgmEnabled || this.bgmVolume <= 0) return;
      const t = TRACKS[this.currentTrack];
      const idx = this.bgmStep % t.lead.length;
      const leadFreq = N[t.lead[idx]] ?? 0;
      const harmFreq = N[t.harmony[idx]] ?? 0;
      const bassFreq = N[t.bass[idx]] ?? 0;
      const drum = t.drums?.[idx] ?? '';
      const dur = (t.stepMs / 1000) * 0.92;

      if (leadFreq > 0) this.tone(leadFreq, dur, 0, 'square', 0.036, true);
      if (harmFreq > 0) this.tone(harmFreq, dur * 0.85, 0, 'square', 0.018, true);
      if (bassFreq > 0) this.tone(bassFreq, dur * 1.05, 0, 'triangle', 0.052, true);
      if (drum === 'K') this.tone(130, 0.065, 0, 'triangle', 0.065, true, 42);
      else if (drum === 'S') this.noise(0.055, 0, 0.032, 1600, true);
      else if (drum === 'H') this.noise(0.025, 0, 0.016, 4800, true);

      this.bgmStep = (this.bgmStep + 1) % t.lead.length;
    }, track.stepMs);
  }

  private stopBgmLoop() {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  /** Unlock WebAudio on first user gesture so BGM begins immediately if enabled */
  unlock() {
    this.getCtx(true);
    if (this.bgmEnabled && this.bgmVolume > 0) {
      this.startBgmLoop();
    }
  }

  /** Play authentic official Pokémon cry (/cries/{dexId}.mp3) respecting independent cry toggle, volume & master volume */
  playCry(dexId: number) {
    if (this.isSilenceActive() || !this.cryEnabled || this.cryVolume <= 0 || typeof window === 'undefined') return;
    try {
      if (this.activeCry) {
        this.activeCry.pause();
        this.activeCry.currentTime = 0;
      }
      let audio = this.cryCache.get(dexId);
      if (!audio) {
        audio = new Audio(`/cries/${dexId}.mp3`);
        audio.preload = 'auto';
        this.cryCache.set(dexId, audio);
      }
      audio.volume = Math.max(0.03, Math.min(1, (this.cryVolume / 100) * (this.masterVolume / 100) * 0.85));
      audio.currentTime = 0;
      this.activeCry = audio;
      void audio.play().catch(() => {});
    } catch {
      // Ignore autoplay errors gracefully
    }
  }

  play(kind: SfxKind) {
    if (this.muted || this.sfxVolume <= 0) return;
    if (
      !this.combatSfxEnabled &&
      (kind === 'thunder' || kind === 'fireball' || kind === 'water' || kind === 'hit' || kind === 'ko' || kind === 'jump')
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
        // Classic 2-voice GBA Fanfare!
        this.tone(523.25, 0.075, 0, 'square', 0.065);
        this.tone(659.25, 0.075, 0.075, 'square', 0.065);
        this.tone(783.99, 0.075, 0.15, 'square', 0.065);
        this.tone(1046.5, 0.28, 0.225, 'square', 0.075);
        this.tone(523.25, 0.28, 0.225, 'triangle', 0.065);
        break;
      case 'heal_jingle':
        // Iconic 5-note Pokémon Center Healing Chime (Ding-Ding-Ding-Da-Ding!)
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
