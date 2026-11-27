import type { WeatherKind } from './weatherSystem';

export interface WeatherAmbienceContext {
  kind: WeatherKind | null;
  indoor: boolean;
  isNight: boolean;
}

/**
 * Procedural Non-Looping Web Audio Weather Ambience Synthesizer.
 *
 * Design principles:
 * - ZERO looping audio files or short cyclic noise loops: continuous rain/wind beds are built from
 *   overlapping stochastic crossfaded slices sampled at random offsets & playback rates from a long
 *   stereo noise pool, modulated by random-walk filter & gain envelopes.
 * - Weather-authentic discrete stochastic events (Poisson-clustered):
 *   * rain:   "滴滴滴" resonant water-drop chirps + "叭叭叭" crisp broadband splash patters
 *   * hail:   "咚咚咚" hollow resonant hailstone thuds + icy transient ticks + realistic micro-bounces
 *   * storm:  heavy downpour + howling wind gusts + irregular distant/near rolling thunderclaps
 *   * snow:   hushed cold air breeze + whisper-soft crystalline shimmer
 *   * windy:  sweeping resonant wind gusts + trailing foliage rustles
 *   * clear:  gentle air bed + sparse non-repeating daytime birds / nighttime crickets
 *   * cloudy: subtle calm open-air breeze
 * - Automatic indoor acoustic muffling: stepping inside buildings smoothly sweeps a warm roof LPF
 *   (18 kHz -> 580 Hz) and ducks outdoor level so rain/hail naturally patters on the roof.
 */
export class WeatherAmbienceEngine {
  private ctx: AudioContext | null = null;
  private busInput: GainNode | null = null;
  private indoorFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private stereoNoisePool: AudioBuffer | null = null;

  private activeKind: WeatherKind | null = null;
  private indoor = false;
  private isNight = false;
  private enabled = true;
  private volume = 68;
  private masterVolume = 80;
  private muted = false;
  private pageHidden = false;
  private muteOnBlur = true;

  private running = false;
  private bedTimer: number | null = null;
  private eventTimer: number | null = null;
  private thunderTimer: number | null = null;
  private liveNodes = new Set<AudioNode>();

  setAudioConfig(cfg: {
    enabled?: boolean;
    volume?: number;
    masterVolume?: number;
    muted?: boolean;
    pageHidden?: boolean;
    muteOnBlur?: boolean;
  }) {
    if (cfg.enabled !== undefined) this.enabled = cfg.enabled;
    if (cfg.volume !== undefined) this.volume = Math.max(0, Math.min(100, Math.round(cfg.volume)));
    if (cfg.masterVolume !== undefined) {
      this.masterVolume = Math.max(0, Math.min(100, Math.round(cfg.masterVolume)));
    }
    if (cfg.muted !== undefined) this.muted = cfg.muted;
    if (cfg.pageHidden !== undefined) this.pageHidden = cfg.pageHidden;
    if (cfg.muteOnBlur !== undefined) this.muteOnBlur = cfg.muteOnBlur;

    this.syncBusParams(0.18);
    if (this.shouldRun()) {
      if (!this.running && this.ctx && this.ctx.state === 'running') {
        this.startSchedulers();
      }
    } else if (this.running) {
      this.stopSchedulers();
    }
  }

  attachContext(ctx: AudioContext) {
    if (this.ctx !== ctx) {
      this.stopSchedulers();
      this.ctx = ctx;
      this.busInput = null;
      this.indoorFilter = null;
      this.masterGain = null;
      this.stereoNoisePool = null;
    }
    if (this.shouldRun() && ctx.state === 'running' && !this.running) {
      this.ensureBus(ctx);
      this.syncBusParams(0.25);
      this.startSchedulers();
    }
  }

  setWeather(
    kind: WeatherKind | null,
    opts?: { indoor?: boolean; isNight?: boolean },
    ctx?: AudioContext | null,
  ) {
    const nextIndoor = opts?.indoor ?? this.indoor;
    const nextNight = opts?.isNight ?? this.isNight;
    const kindChanged = kind !== this.activeKind;
    const envChanged = nextIndoor !== this.indoor || nextNight !== this.isNight;

    this.activeKind = kind;
    this.indoor = nextIndoor;
    this.isNight = nextNight;

    if (ctx) {
      this.attachContext(ctx);
    }

    if (!this.shouldRun()) {
      this.syncBusParams(0.25);
      this.stopSchedulers();
      return;
    }

    if (this.ctx && this.ctx.state === 'running') {
      this.ensureBus(this.ctx);
      this.syncBusParams(envChanged ? 0.38 : 0.22);
      if (kindChanged) {
        // Softly re-seed schedulers so new weather timbre enters right away without pops
        this.restartSchedulers();
      } else if (!this.running) {
        this.startSchedulers();
      }
    }
  }

  stop() {
    this.activeKind = null;
    this.syncBusParams(0.2);
    this.stopSchedulers();
  }

  private shouldRun(): boolean {
    if (!this.activeKind) return false;
    if (!this.enabled || this.volume <= 0) return false;
    if (this.muted || this.masterVolume <= 0) return false;
    if (this.muteOnBlur && this.pageHidden) return false;
    return true;
  }

  private computeTargetGain(): number {
    if (!this.shouldRun()) return 0.0001;
    const base = (this.volume / 100) * (this.masterVolume / 100) * 0.72;
    const indoorMult = this.indoor ? 0.44 : 1.0;
    return Math.max(0.0001, base * indoorMult);
  }

  private ensureBus(ctx: AudioContext) {
    if (this.busInput && this.indoorFilter && this.masterGain) return;

    const input = ctx.createGain();
    input.gain.value = 1.0;

    // Indoor roof/wall lowpass filter (18kHz outdoor -> 580Hz warm muffled indoor)
    const indoorLpf = ctx.createBiquadFilter();
    indoorLpf.type = 'lowpass';
    indoorLpf.frequency.value = this.indoor ? 580 : 18000;
    indoorLpf.Q.value = 0.65;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 18;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.006;
    comp.release.value = 0.18;

    const outGain = ctx.createGain();
    outGain.gain.value = 0.0001;

    input.connect(indoorLpf);
    indoorLpf.connect(comp);
    comp.connect(outGain);
    outGain.connect(ctx.destination);

    this.busInput = input;
    this.indoorFilter = indoorLpf;
    this.masterGain = outGain;
  }

  private syncBusParams(fadeSec = 0.25) {
    if (!this.ctx || !this.masterGain || !this.indoorFilter) return;
    const now = this.ctx.currentTime;
    const targetGain = this.computeTargetGain();
    const targetFreq = this.indoor ? 580 : 18000;
    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, now + fadeSec);

      this.indoorFilter.frequency.cancelScheduledValues(now);
      this.indoorFilter.frequency.setValueAtTime(
        Math.max(120, this.indoorFilter.frequency.value),
        now,
      );
      this.indoorFilter.frequency.exponentialRampToValueAtTime(targetFreq, now + fadeSec);
    } catch {
      this.masterGain.gain.value = targetGain;
      this.indoorFilter.frequency.value = targetFreq;
    }
  }

  /**
   * 13-second stereo decorrelated noise pool (pink-tilted on ch0/ch1 with independent seeds)
   * sampled exclusively in randomized overlapping windows — never looped cyclically!
   */
  private getNoisePool(ctx: AudioContext): AudioBuffer {
    if (this.stereoNoisePool && this.stereoNoisePool.sampleRate === ctx.sampleRate) {
      return this.stereoNoisePool;
    }
    const seconds = 13;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const out = buf.getChannelData(ch);
      // Paul Kellet pink-white blend for natural atmospheric rain/wind spectrum
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.095;
        b6 = w * 0.115926;
        // Blend 62% warm pink + 38% crisp white so filtering can sculpt both rain hiss & low wind
        out[i] = Math.max(-1, Math.min(1, pink * 0.62 + w * 0.38));
      }
    }
    this.stereoNoisePool = buf;
    return buf;
  }

  private restartSchedulers() {
    this.stopSchedulers();
    if (this.shouldRun() && this.ctx && this.ctx.state === 'running') {
      this.startSchedulers();
    }
  }

  private startSchedulers() {
    if (this.running || !this.ctx || !this.activeKind) return;
    this.running = true;
    this.ensureBus(this.ctx);
    this.syncBusParams(0.35);

    // Kick off 2 staggered overlapping non-looping atmospheric bed grains immediately
    this.spawnAtmosphericBedGrain(true);
    this.scheduleNextBedGrain(450 + Math.random() * 650);
    this.scheduleNextMicroEvent(120 + Math.random() * 280);
    if (this.activeKind === 'storm') {
      this.scheduleNextThunder(2200 + Math.random() * 4800);
    }
  }

  private stopSchedulers() {
    this.running = false;
    if (this.bedTimer !== null) {
      window.clearTimeout(this.bedTimer);
      this.bedTimer = null;
    }
    if (this.eventTimer !== null) {
      window.clearTimeout(this.eventTimer);
      this.eventTimer = null;
    }
    if (this.thunderTimer !== null) {
      window.clearTimeout(this.thunderTimer);
      this.thunderTimer = null;
    }
    // Let active grains naturally decay cleanly via masterGain ramp instead of hard clicks
    this.liveNodes.clear();
  }

  private scheduleNextBedGrain(delayMs: number) {
    if (!this.running) return;
    this.bedTimer = window.setTimeout(() => {
      if (!this.running || !this.shouldRun()) return;
      this.spawnAtmosphericBedGrain(false);
      // Irregular overlap cadence (1.3s - 2.6s) guarantees zero periodic loop feel!
      const kind = this.activeKind;
      const nextMs =
        kind === 'windy'
          ? 1450 + Math.random() * 1400
          : kind === 'storm' || kind === 'rain' || kind === 'hail'
            ? 1250 + Math.random() * 1150
            : 1800 + Math.random() * 1500;
      this.scheduleNextBedGrain(nextMs);
    }, delayMs);
  }

  /**
   * Spawns a single non-repeating, crossfaded, randomly filtered noise slice
   * whose spectrum & drift envelope matches the active weather.
   */
  private spawnAtmosphericBedGrain(quickAttack: boolean) {
    const ctx = this.ctx;
    const bus = this.busInput;
    const kind = this.activeKind;
    if (!ctx || !bus || !kind || ctx.state !== 'running') return;

    const pool = this.getNoisePool(ctx);
    const dur = 3.2 + Math.random() * 2.6; // 3.2s .. 5.8s overlapping slices
    const maxOffset = Math.max(0.1, pool.duration - dur - 0.15);
    const offset = Math.random() * maxOffset;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = pool;
    // Slight random playback rate shift further breaks spectral repetition
    src.playbackRate.value = 0.92 + Math.random() * 0.16;

    const filter = ctx.createBiquadFilter();
    const subFilter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

    let peakGain = 0.08;
    let attack = quickAttack ? 0.35 : 0.9 + Math.random() * 0.6;
    let release = 1.0 + Math.random() * 0.8;

    if (kind === 'rain') {
      // Natural rain sheet: airy pink/white rain hiss drifting organically between showers
      filter.type = 'bandpass';
      const fStart = 1150 + Math.random() * 950;
      const fEnd = 1050 + Math.random() * 1150;
      filter.frequency.setValueAtTime(fStart, now);
      filter.frequency.linearRampToValueAtTime(fEnd, now + dur);
      filter.Q.value = 0.52 + Math.random() * 0.25;

      subFilter.type = 'highpass';
      subFilter.frequency.value = 340 + Math.random() * 180;
      peakGain = 0.16 + Math.random() * 0.07;
    } else if (kind === 'storm') {
      // Heavy downpour + sweeping gale
      const isGustLayer = Math.random() < 0.38;
      if (isGustLayer) {
        filter.type = 'bandpass';
        const f0 = 260 + Math.random() * 280;
        const fPeak = f0 + 180 + Math.random() * 340;
        filter.frequency.setValueAtTime(f0, now);
        filter.frequency.exponentialRampToValueAtTime(fPeak, now + dur * 0.45);
        filter.frequency.exponentialRampToValueAtTime(Math.max(160, f0 * 0.85), now + dur);
        filter.Q.value = 2.6 + Math.random() * 1.8;
        subFilter.type = 'lowpass';
        subFilter.frequency.value = 1800;
        peakGain = 0.14 + Math.random() * 0.08;
      } else {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1250 + Math.random() * 1200, now);
        filter.frequency.linearRampToValueAtTime(950 + Math.random() * 1450, now + dur);
        filter.Q.value = 0.45 + Math.random() * 0.2;
        subFilter.type = 'highpass';
        subFilter.frequency.value = 260;
        peakGain = 0.21 + Math.random() * 0.08;
      }
    } else if (kind === 'hail') {
      // Cold brisk wind + sleet hiss beneath the dominant "咚咚咚" hailstone impacts
      filter.type = 'bandpass';
      const f0 = 620 + Math.random() * 680;
      filter.frequency.setValueAtTime(f0, now);
      filter.frequency.linearRampToValueAtTime(480 + Math.random() * 880, now + dur);
      filter.Q.value = 1.1 + Math.random() * 0.8;
      subFilter.type = 'highpass';
      subFilter.frequency.value = 240;
      peakGain = 0.11 + Math.random() * 0.05;
    } else if (kind === 'windy') {
      // Expressive sweeping wind gusts ("呼——呜——") + rustling foliage puffs
      const isLeafRustle = Math.random() < 0.42;
      if (isLeafRustle) {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600 + Math.random() * 1400, now);
        filter.frequency.linearRampToValueAtTime(1200 + Math.random() * 1800, now + dur);
        filter.Q.value = 1.4 + Math.random() * 0.8;
        subFilter.type = 'highpass';
        subFilter.frequency.value = 900;
        peakGain = 0.08 + Math.random() * 0.05;
      } else {
        filter.type = 'bandpass';
        const fLow = 190 + Math.random() * 170;
        const fHigh = 390 + Math.random() * 380;
        filter.frequency.setValueAtTime(fLow, now);
        filter.frequency.exponentialRampToValueAtTime(fHigh, now + dur * (0.35 + Math.random() * 0.25));
        filter.frequency.exponentialRampToValueAtTime(Math.max(140, fLow * 0.85), now + dur);
        filter.Q.value = 3.2 + Math.random() * 2.2;
        subFilter.type = 'lowpass';
        subFilter.frequency.value = 1500;
        peakGain = 0.16 + Math.random() * 0.09;
      }
    } else if (kind === 'snow') {
      // Hushed tranquil cold breeze
      filter.type = 'bandpass';
      const f0 = 260 + Math.random() * 220;
      filter.frequency.setValueAtTime(f0, now);
      filter.frequency.linearRampToValueAtTime(220 + Math.random() * 260, now + dur);
      filter.Q.value = 2.1 + Math.random() * 1.1;
      subFilter.type = 'lowpass';
      subFilter.frequency.value = 1100;
      peakGain = 0.065 + Math.random() * 0.03;
      attack = quickAttack ? 0.5 : 1.3;
      release = 1.4;
    } else if (kind === 'cloudy') {
      // Gentle open-air calm breeze
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(280 + Math.random() * 180, now);
      filter.frequency.linearRampToValueAtTime(240 + Math.random() * 220, now + dur);
      filter.Q.value = 1.6;
      subFilter.type = 'lowpass';
      subFilter.frequency.value = 950;
      peakGain = 0.042 + Math.random() * 0.018;
      attack = 1.2;
      release = 1.4;
    } else {
      // clear: barely audible soft outdoor air breeze
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(340 + Math.random() * 200, now);
      filter.Q.value = 1.5;
      subFilter.type = 'lowpass';
      subFilter.frequency.value = 1100;
      peakGain = 0.028 + Math.random() * 0.014;
      attack = 1.2;
      release = 1.4;
    }

    const sustainEnd = Math.max(now + attack + 0.2, now + dur - release);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + attack);
    // Gentle organic mid-grain breath fluctuation
    env.gain.linearRampToValueAtTime(peakGain * (0.78 + Math.random() * 0.34), sustainEnd);
    env.gain.linearRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(subFilter);
    subFilter.connect(env);
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 0.7;
      env.connect(panner);
      panner.connect(bus);
    } else {
      env.connect(bus);
    }

    this.liveNodes.add(src);
    src.onended = () => {
      this.liveNodes.delete(src);
      try {
        src.disconnect();
        filter.disconnect();
        subFilter.disconnect();
        env.disconnect();
        panner?.disconnect();
      } catch {
        // ignore
      }
    };
    src.start(now, offset, dur);
  }

  /**
   * Poisson-process scheduler for discrete stochastic weather textures:
   * - Rain: "滴滴滴滴" water-drop chirps + "叭叭叭叭" crisp splash patters
   * - Hail: "咚咚咚咚咚" hollow hard hailstone impacts + bouncing micro-hits
   * - Storm: dense rain/splash flurries
   * - Snow: whisper-soft frosty shimmer grains
   * - Clear: sparse non-repeating birds (day) or crickets (night)
   */
  private scheduleNextMicroEvent(delayMs: number) {
    if (!this.running) return;
    this.eventTimer = window.setTimeout(() => {
      if (!this.running || !this.shouldRun()) return;
      const kind = this.activeKind;
      if (!kind) return;

      let nextDelayMs = 400;
      if (kind === 'rain') {
        // Organic bursty raindrops: spawn 1..3 micro events in a tiny jittered cluster
        const burst = Math.random() < 0.34 ? 2 + Math.floor(Math.random() * 2) : 1;
        for (let i = 0; i < burst; i++) {
          const offsetSec = i * (0.025 + Math.random() * 0.055);
          if (Math.random() < 0.48) {
            this.triggerRaindropPip(offsetSec, 0.85);
          } else {
            this.triggerRainSplashPatter(offsetSec, 0.9);
          }
        }
        // Exponential-like random interval (~65ms .. 240ms) -> organic non-metronomic rhythm
        nextDelayMs = 55 + Math.pow(Math.random(), 1.45) * 210;
      } else if (kind === 'storm') {
        const burst = Math.random() < 0.5 ? 2 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < burst; i++) {
          const offsetSec = i * (0.018 + Math.random() * 0.045);
          if (Math.random() < 0.38) {
            this.triggerRaindropPip(offsetSec, 1.05);
          } else {
            this.triggerRainSplashPatter(offsetSec, 1.15);
          }
        }
        nextDelayMs = 38 + Math.pow(Math.random(), 1.55) * 145;
      } else if (kind === 'hail') {
        // Hailstone flurries: dense irregular "咚咚咚咚咚" impacts with occasional clusters!
        const burst = Math.random() < 0.45 ? 2 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < burst; i++) {
          const offsetSec = i * (0.022 + Math.random() * 0.058);
          this.triggerHailImpact(offsetSec);
        }
        nextDelayMs = 42 + Math.pow(Math.random(), 1.4) * 165;
      } else if (kind === 'snow') {
        if (!this.indoor) {
          this.triggerFrostShimmer();
        }
        nextDelayMs = 260 + Math.random() * 540;
      } else if (kind === 'clear') {
        if (!this.indoor) {
          if (this.isNight) {
            this.triggerNightCricket();
            nextDelayMs = 3400 + Math.random() * 5200;
          } else {
            this.triggerDayBirdChirp();
            nextDelayMs = 4200 + Math.random() * 7200;
          }
        } else {
          nextDelayMs = 2500;
        }
      } else {
        // cloudy / windy occasional subtle leaf puff
        nextDelayMs = 800 + Math.random() * 1400;
      }

      this.scheduleNextMicroEvent(nextDelayMs);
    }, delayMs);
  }

  /** "滴" — Crisp upward-chirping water droplet hitting puddle/leaf */
  private triggerRaindropPip(offsetSec: number, intensity: number) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;

    const t0 = ctx.currentTime + offsetSec;
    const dur = 0.016 + Math.random() * 0.026;
    const startFreq = 680 + Math.random() * 1400;
    const endFreq = startFreq * (1.45 + Math.random() * 0.55);
    const peak = (0.022 + Math.random() * 0.042) * intensity;

    const osc = ctx.createOscillator();
    osc.type = Math.random() < 0.72 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.min(5200, endFreq), t0 + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    osc.connect(g);
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.65;
      g.connect(panner);
      panner.connect(bus);
    } else {
      g.connect(bus);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);
  }

  /** "叭 / 啪" — Broadband short droplet splatter on ground / canopy / umbrella */
  private triggerRainSplashPatter(offsetSec: number, intensity: number) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;

    const pool = this.getNoisePool(ctx);
    const t0 = ctx.currentTime + offsetSec;
    const dur = 0.016 + Math.random() * 0.036;
    const offset = Math.random() * Math.max(0.1, pool.duration - 0.2);
    const peak = (0.045 + Math.random() * 0.085) * intensity;

    const src = ctx.createBufferSource();
    src.buffer = pool;
    src.playbackRate.value = 0.85 + Math.random() * 0.45;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700 + Math.random() * 3400;
    bp.Q.value = 1.2 + Math.random() * 1.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.0025);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    src.connect(bp);
    bp.connect(g);
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.75;
      g.connect(panner);
      panner.connect(bus);
    } else {
      g.connect(bus);
    }
    src.start(t0, offset, dur + 0.01);
  }

  /**
   * "咚咚咚" — Hard icy hailstone impact:
   * Resonant percussive body drop ("咚") + sharp ice click + realistic secondary ground bounce!
   */
  private triggerHailImpact(offsetSec: number) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;

    const panVal = (Math.random() - 0.5) * 1.75;
    // Larger hailstones sound deeper ("咚"), smaller pellets sound crisper ("哒")
    const stoneSize = 0.55 + Math.random() * 0.95;
    const baseFreq = 460 / stoneSize + (Math.random() - 0.5) * 70; // ~230..620 Hz
    const mainPeak = 0.09 + stoneSize * 0.085;

    this.playSingleHailHit(ctx.currentTime + offsetSec, baseFreq, mainPeak, panVal, true);

    // ~58% of hailstones bounce once off hard ground/roof 38..92ms later!
    if (Math.random() < 0.58) {
      const bounceDelay = 0.038 + Math.random() * 0.056;
      this.playSingleHailHit(
        ctx.currentTime + offsetSec + bounceDelay,
        baseFreq * (1.16 + Math.random() * 0.18),
        mainPeak * (0.34 + Math.random() * 0.2),
        Math.max(-0.95, Math.min(0.95, panVal + (Math.random() - 0.5) * 0.14)),
        false,
      );
    }
  }

  private playSingleHailHit(
    t0: number,
    startFreq: number,
    peakGain: number,
    panVal: number,
    withIceClick: boolean,
  ) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus) return;

    const dur = 0.032 + Math.random() * 0.034;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(88, startFreq * 0.42), t0 + dur);

    // Subtle hollow resonance filter gives it that classic hard-ice "咚" knock
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.value = startFreq * 0.85;
    bodyFilter.Q.value = 1.6;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peakGain, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    osc.connect(bodyFilter);
    bodyFilter.connect(g);
    if (panner) {
      panner.pan.value = panVal;
      g.connect(panner);
      panner.connect(bus);
    } else {
      g.connect(bus);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);

    // Sharp icy transient crackle on primary impact
    if (withIceClick) {
      const pool = this.getNoisePool(ctx);
      const clickDur = 0.009 + Math.random() * 0.009;
      const offset = Math.random() * Math.max(0.1, pool.duration - 0.1);
      const src = ctx.createBufferSource();
      src.buffer = pool;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 2800 + Math.random() * 2600;
      hp.Q.value = 1.8;

      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t0);
      cg.gain.linearRampToValueAtTime(peakGain * 0.72, t0 + 0.0012);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + clickDur);

      src.connect(hp);
      hp.connect(cg);
      if (panner) {
        cg.connect(panner);
      } else {
        cg.connect(bus);
      }
      src.start(t0, offset, clickDur + 0.005);
    }
  }

  /** Storm rolling thunder at fully stochastic non-repeating intervals */
  private scheduleNextThunder(delayMs: number) {
    if (!this.running || this.activeKind !== 'storm') return;
    this.thunderTimer = window.setTimeout(() => {
      if (!this.running || this.activeKind !== 'storm' || !this.shouldRun()) return;
      this.triggerRollingThunder();
      this.scheduleNextThunder(7500 + Math.random() * 12500);
    }, delayMs);
  }

  private triggerRollingThunder() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;

    const pool = this.getNoisePool(ctx);
    const t0 = ctx.currentTime;
    const isNear = Math.random() < 0.36;
    const totalDur = (isNear ? 3.2 : 2.5) + Math.random() * 2.2;
    const offset = Math.random() * Math.max(0.2, pool.duration - totalDur - 0.1);

    // 1. Deep rolling sub-rumble body
    const src = ctx.createBufferSource();
    src.buffer = pool;
    src.playbackRate.value = 0.52 + Math.random() * 0.18;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(isNear ? 280 : 170, t0);
    lp.frequency.exponentialRampToValueAtTime(62 + Math.random() * 28, t0 + totalDur);
    lp.Q.value = 1.2;

    const g = ctx.createGain();
    const peak = isNear ? 0.38 : 0.24;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (isNear ? 0.08 : 0.35));
    // Secondary echo swell across clouds
    const swellAt = t0 + totalDur * (0.34 + Math.random() * 0.14);
    g.gain.linearRampToValueAtTime(peak * 0.45, swellAt - 0.18);
    g.gain.linearRampToValueAtTime(peak * 0.72, swellAt);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + totalDur);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    src.connect(lp);
    lp.connect(g);
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.2;
      g.connect(panner);
      panner.connect(bus);
    } else {
      g.connect(bus);
    }
    src.start(t0, offset, totalDur + 0.05);

    // 2. Near lightning sharp crackle transient
    if (isNear) {
      const crackDur = 0.16 + Math.random() * 0.12;
      const cSrc = ctx.createBufferSource();
      cSrc.buffer = pool;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1400, t0);
      bp.frequency.exponentialRampToValueAtTime(280, t0 + crackDur);
      bp.Q.value = 0.9;

      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t0);
      cg.gain.linearRampToValueAtTime(0.22, t0 + 0.008);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + crackDur);

      cSrc.connect(bp);
      bp.connect(cg);
      if (panner) cg.connect(panner);
      else cg.connect(bus);
      cSrc.start(t0, Math.random() * 6, crackDur + 0.02);
    }
  }

  /** Whisper-soft snow crystalline shimmer grain */
  private triggerFrostShimmer() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const pool = this.getNoisePool(ctx);
    const t0 = ctx.currentTime;
    const dur = 0.08 + Math.random() * 0.14;
    const src = ctx.createBufferSource();
    src.buffer = pool;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400 + Math.random() * 2400;
    bp.Q.value = 4.0;
    const g = ctx.createGain();
    const peak = 0.014 + Math.random() * 0.014;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(bus);
    src.start(t0, Math.random() * 8, dur + 0.01);
  }

  /** Distant soft daytime bird twitter (2–3 natural random chirps) */
  private triggerDayBirdChirp() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panVal = (Math.random() - 0.5) * 1.4;
    const notes = 2 + Math.floor(Math.random() * 2);
    const baseHz = 2500 + Math.random() * 1100;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = panVal;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    let t = ctx.currentTime;
    for (let i = 0; i < notes; i++) {
      const dur = 0.065 + Math.random() * 0.05;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const f0 = baseHz * (0.9 + Math.random() * 0.25);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * (1.22 + Math.random() * 0.22), t + dur * 0.55);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.96, t + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.018 + Math.random() * 0.012, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(g);
      g.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      t += dur + 0.045 + Math.random() * 0.06;
    }
  }

  /** Soft evening cricket pulse trill */
  private triggerNightCricket() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const baseHz = 4150 + Math.random() * 550;
    const pulses = 3 + Math.floor(Math.random() * 3);
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.5;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    let t = ctx.currentTime;
    for (let i = 0; i < pulses; i++) {
      const dur = 0.028;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseHz + (Math.random() - 0.5) * 40, t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.006, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(g);
      g.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.005);
      t += 0.046;
    }
  }
}
