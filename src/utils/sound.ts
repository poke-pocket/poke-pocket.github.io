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
  private activeCryNode: AudioBufferSourceNode | null = null;
  private cryCache = new Map<string, HTMLAudioElement>();
  private cryBufferCache = new Map<string, AudioBuffer>();
  private cryToneMode: 'warm' | 'cute' | 'raw' = 'warm';
  private letsGoVoices = true;
  private pikachuCryVariant: 'soft_voice' | 'letsgo' | 'classic_gba' | 'pichu_cute' | 'original_raw' = 'soft_voice';

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

  setCryToneMode(mode: 'warm' | 'cute' | 'raw') {
    this.cryToneMode = mode;
  }

  setLetsGoVoices(enabled: boolean) {
    this.letsGoVoices = enabled;
  }

  setPikachuCryVariant(
    variant: 'soft_voice' | 'letsgo' | 'classic_gba' | 'pichu_cute' | 'original_raw',
  ) {
    this.pikachuCryVariant = variant;
  }

  /** Audition a specific Pikachu cry audio file directly (bypasses cryEnabled check if previewing in settings) */
  previewPikachuCry(
    variant: 'soft_voice' | 'letsgo' | 'classic_gba' | 'pichu_cute' | 'original_raw',
  ) {
    if (typeof window === 'undefined') return;
    const forceRaw = variant === 'original_raw';
    this.playAudioUrl(`/cries/pikachu/${variant}.mp3`, true, forceRaw ? 'raw' : this.cryToneMode);
  }

  /** Audition any species cry with an optional tone mode override (great for A/B comparison in Settings!) */
  previewCry(dexId: number, modeOverride?: 'warm' | 'cute' | 'raw') {
    const mode = modeOverride ?? this.cryToneMode;
    if (mode === 'cute') {
      this.playCuteChirp(dexId, true);
      return;
    }
    const url = this.resolveCryUrl(dexId);
    this.playAudioUrl(url, true, mode);
  }

  private resolveCryUrl(dexId: number): string {
    if (dexId === 25) {
      if (this.letsGoVoices && this.pikachuCryVariant === 'soft_voice') {
        return '/cries/pikachu/letsgo.mp3';
      }
      return `/cries/pikachu/${this.pikachuCryVariant}.mp3`;
    }
    if (dexId === 133 && this.letsGoVoices) {
      return '/cries/eevee/letsgo.mp3';
    }
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

    // Derive a deterministic pleasant pentatonic 2-note chirp per dexId
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

    playSoftNote(baseHz, baseHz * 1.12, now, 0.11, 0.12);
    playSoftNote(secondHz, secondHz * 1.06, now + 0.1, 0.16, 0.13);
  }

  /**
   * Switch-Console Style Warm Cry Mastering Chain via Web Audio API:
   * - Highpass @ 120Hz (removes muddy low-end thump)
   * - Peaking Dip @ 2850Hz (-7.5dB, Q=1.0) — removes ear-piercing 2.5–4kHz Game Boy/DS synth screech!
   * - Highshelf @ 4000Hz (-8.5dB) + Lowpass @ 5000Hz — warm velvety console speaker roll-off
   * - DynamicsCompressor — smooths wild volume spikes across all 175 Pokémon
   * - 12ms attack / 30ms release soft envelope — zero clicks or pops!
   */
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
          const targetGain = Math.max(0.03, Math.min(0.95, volBase * 0.72));
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
          this.playHtmlAudioFallback(url, volBase * 0.65);
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
          this.playHtmlAudioFallback(url, volBase * 0.65);
        });
      return;
    }

    this.playHtmlAudioFallback(url, volBase * 0.8);
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

  /** Play authentic official Pokémon cry respecting Switch warm-EQ filter, cute chirp mode, or raw mode */
  playCry(dexId: number) {
    if (this.cryToneMode === 'cute') {
      // Even in cute chirp mode, Pikachu & Eevee can keep their adorable Let's Go voices if enabled!
      if (this.letsGoVoices && (dexId === 25 || dexId === 133)) {
        this.playAudioUrl(this.resolveCryUrl(dexId), false, 'warm');
        return;
      }
      this.playCuteChirp(dexId, false);
      return;
    }
    this.playAudioUrl(this.resolveCryUrl(dexId), false, this.cryToneMode);
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
