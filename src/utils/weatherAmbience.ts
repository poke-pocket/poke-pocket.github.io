import type { WeatherIntensity, WeatherKind } from './weatherSystem';

/**
 * Procedural Continuous Web Audio Weather Ambience Synthesizer.
 *
 * Acoustic architecture (ZERO audible loops, ZERO grain pumping, ZERO "wah-wah" sweeps):
 * - Two long, mutually incommensurate (29.3s & 19.7s), equal-power crossfaded stereo noise streams
 *   (warm pink-noise Layer A + crisp white/pink rain-sheen Layer B) run continuously without interruption
 *   (combined cycle > 9.5 minutes -> completely non-repeating to human ears).
 * - Weather intensity & brightness drift ONLY via slow exponential `setTargetAtTime` arcs (tau = 3s..6s)
 *   over 8-18s spans — so rain & wind swell and ease naturally and gradually, NEVER cutting or pumping.
 * - Low-Q natural filters (Q = 0.5..0.85) eliminate artificial "呜啊呜啊" resonant filter sweeps.
 * - On top of the seamless continuous bed, Poisson-clustered micro-events provide crisp weather detail:
 *   * rain:   "滴滴" water-drop chirps + "叭叭" broadband droplet splatters in stereo
 *   * hail:   "咚咚咚" hollow hard-ice impacts + icy transient ticks + realistic ground bounces
 *   * storm:  heavy steady downpour + dense splatters + deep rolling thunder synced to 3D lightning
 *   * snow:   peaceful hushed cold breeze + whisper-soft crystalline shimmer
 *   * windy:  gradual wide air swells + gentle foliage rustle
 *   * clear:  very quiet open air + sparse daytime birds / nighttime crickets
 * - Automatic indoor roof low-pass muffling (18kHz -> 580Hz) when entering buildings.
 */
export class WeatherAmbienceEngine {
  private ctx: AudioContext | null = null;
  private busInput: GainNode | null = null;
  private indoorFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;

  // Two continuous mutually-incommensurate seamless stereo noise pools
  private pinkPoolA: AudioBuffer | null = null;
  private rainPoolB: AudioBuffer | null = null;

  // Continuous live bed graph (always steady, smoothly modulated via setTargetAtTime!)
  private bedSrcA: AudioBufferSourceNode | null = null;
  private bedSrcB: AudioBufferSourceNode | null = null;
  private bedHpA: BiquadFilterNode | null = null;
  private bedLpA: BiquadFilterNode | null = null;
  private bedGainA: GainNode | null = null;
  private bedHpB: BiquadFilterNode | null = null;
  private bedLpB: BiquadFilterNode | null = null;
  private bedGainB: GainNode | null = null;

  private activeKind: WeatherKind | null = null;
  private intensity: WeatherIntensity = 'moderate';
  private indoor = false;
  private isNight = false;
  private enabled = true;
  private volume = 68;
  private masterVolume = 80;
  private muted = false;
  private pageHidden = false;
  private muteOnBlur = true;

  private running = false;
  private driftTimer: number | null = null;
  private eventTimer: number | null = null;
  private thunderTimer: number | null = null;

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

    this.syncBusParams(0.25);
    if (this.shouldRun()) {
      if (!this.running && this.ctx && this.ctx.state === 'running') {
        this.startEngine();
      }
    } else if (this.running) {
      this.stopEngine();
    }
  }

  attachContext(ctx: AudioContext) {
    if (this.ctx !== ctx) {
      this.stopEngine();
      this.ctx = ctx;
      this.busInput = null;
      this.indoorFilter = null;
      this.masterGain = null;
      this.pinkPoolA = null;
      this.rainPoolB = null;
    }
    if (this.shouldRun() && ctx.state === 'running' && !this.running) {
      this.ensureBus(ctx);
      this.syncBusParams(0.35);
      this.startEngine();
    }
  }

  setWeather(
    kind: WeatherKind | null,
    opts?: { indoor?: boolean; isNight?: boolean; intensity?: WeatherIntensity },
    ctx?: AudioContext | null,
  ) {
    const nextIndoor = opts?.indoor ?? this.indoor;
    const nextNight = opts?.isNight ?? this.isNight;
    const nextIntensity: WeatherIntensity =
      kind === 'clear' ? 'moderate' : (opts?.intensity ?? this.intensity);
    const kindChanged = kind !== this.activeKind;
    const intensityChanged = nextIntensity !== this.intensity;
    const envChanged = nextIndoor !== this.indoor || nextNight !== this.isNight;

    this.activeKind = kind;
    this.intensity = nextIntensity;
    this.indoor = nextIndoor;
    this.isNight = nextNight;

    if (ctx) {
      this.attachContext(ctx);
    }

    if (!this.shouldRun()) {
      this.syncBusParams(0.35);
      this.stopEngine();
      return;
    }

    if (this.ctx && this.ctx.state === 'running') {
      this.ensureBus(this.ctx);
      this.syncBusParams(envChanged ? 0.45 : 0.3);
      if (!this.running) {
        this.startEngine();
      } else if (kindChanged || intensityChanged) {
        // Smoothly morph the continuous bed into the new weather/intensity profile (NO abrupt cuts!)
        this.applyWeatherBedTarget(0.85, 1.0);
        this.resetDiscreteSchedulers();
      }
    }
  }

  stop() {
    this.activeKind = null;
    this.syncBusParams(0.3);
    this.stopEngine();
  }

  /** Trigger a synchronized thunder clap right after a visual 3D lightning strike (with speed-of-sound delay) */
  triggerSyncedThunder(isNear: boolean) {
    if (!this.shouldRun() || !this.ctx || this.ctx.state !== 'running') return;
    this.ensureBus(this.ctx);
    const delayMs = isNear ? 120 + Math.random() * 180 : 320 + Math.random() * 340;
    window.setTimeout(() => {
      if (this.shouldRun() && this.activeKind === 'storm') {
        this.triggerRollingThunder(isNear);
      }
    }, delayMs);
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
    indoorLpf.Q.value = 0.55;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 18;
    comp.ratio.value = 3.0;
    comp.attack.value = 0.008;
    comp.release.value = 0.22;

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

  private syncBusParams(tauSec = 0.22) {
    if (!this.ctx || !this.masterGain || !this.indoorFilter) return;
    const now = this.ctx.currentTime;
    const targetGain = this.computeTargetGain();
    const targetFreq = this.indoor ? 580 : 18000;
    try {
      this.masterGain.gain.setTargetAtTime(targetGain, now, Math.max(0.04, tauSec * 0.45));
      this.indoorFilter.frequency.setTargetAtTime(targetFreq, now, Math.max(0.05, tauSec * 0.5));
    } catch {
      this.masterGain.gain.value = targetGain;
      this.indoorFilter.frequency.value = targetFreq;
    }
  }

  /**
   * Builds a seamlessly equal-power crossfaded stereo noise buffer of arbitrary duration.
   * pinkWeight controls warm pink vs crisp white spectral tilt.
   */
  private createSeamlessStereoNoise(
    ctx: AudioContext,
    durationSec: number,
    pinkWeight: number,
  ): AudioBuffer {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * durationSec);
    const xfade = Math.floor(sr * 1.5);
    const totalGen = len + xfade;
    const buf = ctx.createBuffer(2, len, sr);

    for (let ch = 0; ch < 2; ch++) {
      const tmp = new Float32Array(totalGen);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      const whiteWeight = 1 - pinkWeight;
      for (let i = 0; i < totalGen; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.095;
        b6 = w * 0.115926;
        tmp[i] = Math.max(-1, Math.min(1, pink * pinkWeight + w * whiteWeight));
      }
      const out = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        if (i < xfade) {
          // Equal-power splice so loop seam is mathematically undetectable
          const frac = i / xfade;
          const fadeIn = Math.sin(frac * Math.PI * 0.5);
          const fadeOut = Math.cos(frac * Math.PI * 0.5);
          out[i] = tmp[i] * fadeIn + tmp[len + i] * fadeOut;
        } else {
          out[i] = tmp[i];
        }
      }
    }
    return buf;
  }

  private ensureNoisePools(ctx: AudioContext) {
    if (!this.pinkPoolA || this.pinkPoolA.sampleRate !== ctx.sampleRate) {
      // 29.3s warm pink noise pool (body & low air rush)
      this.pinkPoolA = this.createSeamlessStereoNoise(ctx, 29.3, 0.88);
    }
    if (!this.rainPoolB || this.rainPoolB.sampleRate !== ctx.sampleRate) {
      // 19.7s crisp pink-white rain sheen pool (mutually incommensurate with 29.3s!)
      this.rainPoolB = this.createSeamlessStereoNoise(ctx, 19.7, 0.45);
    }
  }

  private startContinuousBed(ctx: AudioContext) {
    if (this.bedSrcA || !this.busInput) return;
    this.ensureNoisePools(ctx);
    const now = ctx.currentTime;

    // Layer A: Continuous warm low/mid air & rain body
    const srcA = ctx.createBufferSource();
    srcA.buffer = this.pinkPoolA;
    srcA.loop = true;
    const hpA = ctx.createBiquadFilter();
    hpA.type = 'highpass';
    hpA.frequency.value = 120;
    hpA.Q.value = 0.5;
    const lpA = ctx.createBiquadFilter();
    lpA.type = 'lowpass';
    lpA.frequency.value = 900;
    lpA.Q.value = 0.55;
    const gA = ctx.createGain();
    gA.gain.value = 0.0001;
    srcA.connect(hpA);
    hpA.connect(lpA);
    lpA.connect(gA);
    gA.connect(this.busInput);
    srcA.start(now, Math.random() * 20);

    // Layer B: Continuous airy rain sheen / high texture (completely steady, flat Q!)
    const srcB = ctx.createBufferSource();
    srcB.buffer = this.rainPoolB;
    srcB.loop = true;
    const hpB = ctx.createBiquadFilter();
    hpB.type = 'highpass';
    hpB.frequency.value = 480;
    hpB.Q.value = 0.5;
    const lpB = ctx.createBiquadFilter();
    lpB.type = 'lowpass';
    lpB.frequency.value = 3400;
    lpB.Q.value = 0.5;
    const gB = ctx.createGain();
    gB.gain.value = 0.0001;
    srcB.connect(hpB);
    hpB.connect(lpB);
    lpB.connect(gB);
    gB.connect(this.busInput);
    srcB.start(now, Math.random() * 14);

    this.bedSrcA = srcA;
    this.bedHpA = hpA;
    this.bedLpA = lpA;
    this.bedGainA = gA;
    this.bedSrcB = srcB;
    this.bedHpB = hpB;
    this.bedLpB = lpB;
    this.bedGainB = gB;
  }

  private stopContinuousBed() {
    for (const s of [this.bedSrcA, this.bedSrcB]) {
      if (s) {
        try {
          s.stop();
          s.disconnect();
        } catch {
          // ignore
        }
      }
    }
    for (const n of [this.bedHpA, this.bedLpA, this.bedGainA, this.bedHpB, this.bedLpB, this.bedGainB]) {
      if (n) {
        try {
          n.disconnect();
        } catch {
          // ignore
        }
      }
    }
    this.bedSrcA = null;
    this.bedSrcB = null;
    this.bedHpA = null;
    this.bedLpA = null;
    this.bedGainA = null;
    this.bedHpB = null;
    this.bedLpB = null;
    this.bedGainB = null;
  }

  /**
   * Smoothly guides the continuous dual-layer noise bed to the exact natural spectrum of `activeKind`
   * using exponential `setTargetAtTime` with large time constants (`tauSec`), ensuring gentle,
   * organic rain/wind swells with ZERO abrupt drops and ZERO resonant "wah-wah" sweeps.
   */
  private applyWeatherBedTarget(tauSec: number, driftFactor: number) {
    const ctx = this.ctx;
    const kind = this.activeKind;
    if (
      !ctx ||
      !kind ||
      !this.bedHpA ||
      !this.bedLpA ||
      !this.bedGainA ||
      !this.bedHpB ||
      !this.bedLpB ||
      !this.bedGainB
    ) {
      return;
    }

    const now = ctx.currentTime;
    const d = driftFactor; // Smooth subtle multiplier ~0.86..1.14 (never drops abruptly!)
    const lvl = this.intensity === 'light' ? 0 : this.intensity === 'heavy' ? 2 : 1;
    const bedGainMult = [0.46, 1.0, 1.5][lvl];
    const brightMult = [0.76, 1.0, 1.24][lvl];

    // Default calm clear open-air hush
    let hpAFreq = 120;
    let lpAFreq = 420;
    let qA = 0.55;
    let gainA = 0.022;

    let hpBFreq = 900;
    let lpBFreq = 2200;
    let gainB = 0.004;

    if (kind === 'rain') {
      // Steady, natural continuous rain curtain scaled smoothly across light / moderate / heavy rain
      hpAFreq = [210, 170, 130][lvl];
      lpAFreq = 1250 * brightMult * (0.92 + (d - 0.85) * 0.55);
      qA = 0.55;
      gainA = 0.14 * bedGainMult * d;

      hpBFreq = [760, 620, 480][lvl];
      lpBFreq = 3600 * brightMult * (0.9 + (d - 0.85) * 0.65);
      gainB = 0.095 * bedGainMult * d;
    } else if (kind === 'storm') {
      // Full, steady downpour + warm low air rush scaled by storm intensity
      hpAFreq = [140, 110, 88][lvl];
      lpAFreq = 1550 * brightMult * (0.9 + (d - 0.85) * 0.6);
      qA = 0.6;
      gainA = 0.19 * [0.64, 1.0, 1.38][lvl] * d;

      hpBFreq = [620, 520, 430][lvl];
      lpBFreq = 4600 * brightMult * (0.92 + (d - 0.85) * 0.5);
      gainB = 0.135 * [0.64, 1.0, 1.38][lvl] * d;
    } else if (kind === 'hail') {
      // Crisp cold sleet air backdrop underneath the prominent "咚咚咚" hailstone knocks
      hpAFreq = 180;
      lpAFreq = 1100 * brightMult * d;
      qA = 0.58;
      gainA = 0.095 * bedGainMult * d;

      hpBFreq = 750;
      lpBFreq = 3200 * brightMult;
      gainB = 0.055 * bedGainMult * d;
    } else if (kind === 'windy') {
      // Gradual wide open-air wind swells (gentle Q=0.88, slow 8-16s swells, scaled by breeze/strong/gale!)
      hpAFreq = [115, 95, 76][lvl];
      lpAFreq = (420 + (d - 0.85) * 720) * [0.78, 1.0, 1.32][lvl];
      qA = [0.72, 0.88, 1.02][lvl];
      gainA = 0.16 * [0.46, 1.0, 1.52][lvl] * d;

      hpBFreq = 950;
      lpBFreq = 2900 * brightMult;
      gainB = 0.042 * [0.45, 1.0, 1.6][lvl] * Math.max(0.4, d);
    } else if (kind === 'snow') {
      // Quiet, serene winter snow hush -> brisker snowstorm whisper at heavy
      hpAFreq = 110;
      lpAFreq = 520 * brightMult * d;
      qA = 0.55;
      gainA = 0.052 * [0.58, 1.0, 1.65][lvl] * d;

      hpBFreq = 1600;
      lpBFreq = 4200;
      gainB = 0.012 * [0.55, 1.0, 1.75][lvl] * d;
    } else if (kind === 'cloudy') {
      // Light multi-cloud breeze -> overcast hush -> moody heavy cloud low air pressure
      hpAFreq = [125, 110, 88][lvl];
      lpAFreq = [460, 480, 560][lvl];
      qA = 0.55;
      gainA = [0.024, 0.036, 0.068][lvl] * d;

      hpBFreq = 850;
      lpBFreq = 2100;
      gainB = [0.005, 0.009, 0.018][lvl] * d;
    }

    const tau = Math.max(0.25, tauSec);
    try {
      this.bedHpA.frequency.setTargetAtTime(hpAFreq, now, tau);
      this.bedLpA.frequency.setTargetAtTime(lpAFreq, now, tau);
      this.bedLpA.Q.setTargetAtTime(qA, now, tau);
      this.bedGainA.gain.setTargetAtTime(Math.max(0.0001, gainA), now, tau);

      this.bedHpB.frequency.setTargetAtTime(hpBFreq, now, tau);
      this.bedLpB.frequency.setTargetAtTime(lpBFreq, now, tau);
      this.bedGainB.gain.setTargetAtTime(Math.max(0.0001, gainB), now, tau);
    } catch {
      // ignore
    }
  }

  private startEngine() {
    if (this.running || !this.ctx || !this.activeKind) return;
    this.running = true;
    this.ensureBus(this.ctx);
    this.startContinuousBed(this.ctx);
    this.syncBusParams(0.4);
    // Gentle smooth initial fade-in (tau = 0.7s -> ~2s organic entry)
    this.applyWeatherBedTarget(0.7, 1.0);
    this.scheduleSlowWeatherDrift();
    this.resetDiscreteSchedulers();
  }

  private stopEngine() {
    this.running = false;
    if (this.driftTimer !== null) {
      window.clearTimeout(this.driftTimer);
      this.driftTimer = null;
    }
    this.clearDiscreteSchedulers();
    this.stopContinuousBed();
  }

  private clearDiscreteSchedulers() {
    if (this.eventTimer !== null) {
      window.clearTimeout(this.eventTimer);
      this.eventTimer = null;
    }
    if (this.thunderTimer !== null) {
      window.clearTimeout(this.thunderTimer);
      this.thunderTimer = null;
    }
  }

  private resetDiscreteSchedulers() {
    this.clearDiscreteSchedulers();
    if (!this.running || !this.activeKind) return;
    this.scheduleNextMicroEvent(120 + Math.random() * 240);
    if (this.activeKind === 'storm') {
      // Background distant rumble fallback (3D visual lightning also triggers synced thunder!)
      this.scheduleNextThunder(8500 + Math.random() * 11000);
    }
  }

  /**
   * Very slow, gradual weather swell modulation:
   * Every 6.5–14 seconds picks a new gentle target intensity (0.86..1.14) and glides toward it
   * with a slow exponential time constant (tau = 3.2s..5.5s), so rain/wind gently eases and swells
   * without EVER cutting out or feeling rhythmic!
   */
  private scheduleSlowWeatherDrift() {
    if (!this.running) return;
    const waitMs = 6500 + Math.random() * 7500;
    this.driftTimer = window.setTimeout(() => {
      if (!this.running || !this.shouldRun()) return;
      const isWindy = this.activeKind === 'windy';
      const drift = isWindy
        ? 0.78 + Math.random() * 0.44 // Wind gently breathes a bit wider over long arcs
        : 0.88 + Math.random() * 0.24; // Rain stays steady, smoothly gliding ±12%
      const tau = 3.2 + Math.random() * 2.4;
      this.applyWeatherBedTarget(tau, drift);
      this.scheduleSlowWeatherDrift();
    }, waitMs);
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

      let nextDelayMs = 450;
      const lvl = this.intensity === 'light' ? 0 : this.intensity === 'heavy' ? 2 : 1;
      const ampScale = [0.66, 1.0, 1.3][lvl];

      if (kind === 'rain') {
        const burst =
          lvl === 0
            ? 1
            : lvl === 2
              ? 2 + Math.floor(Math.random() * 3)
              : Math.random() < 0.34
                ? 2 + Math.floor(Math.random() * 2)
                : 1;
        const pipRatio = lvl === 0 ? 0.65 : lvl === 2 ? 0.34 : 0.48;
        for (let i = 0; i < burst; i++) {
          const offsetSec = i * (0.02 + Math.random() * 0.05);
          if (Math.random() < pipRatio) {
            this.triggerRaindropPip(offsetSec, 0.85 * ampScale);
          } else {
            this.triggerRainSplashPatter(offsetSec, 0.9 * ampScale);
          }
        }
        const rateMul = [2.25, 1.0, 0.5][lvl];
        nextDelayMs = (55 + Math.pow(Math.random(), 1.45) * 205) * rateMul;
      } else if (kind === 'storm') {
        const burst =
          lvl === 0
            ? Math.random() < 0.3 ? 2 : 1
            : lvl === 2
              ? 3 + Math.floor(Math.random() * 3)
              : Math.random() < 0.52
                ? 2 + Math.floor(Math.random() * 3)
                : 1;
        for (let i = 0; i < burst; i++) {
          const offsetSec = i * (0.016 + Math.random() * 0.042);
          if (Math.random() < 0.38) {
            this.triggerRaindropPip(offsetSec, 1.05 * ampScale);
          } else {
            this.triggerRainSplashPatter(offsetSec, 1.15 * ampScale);
          }
        }
        const rateMul = [1.8, 1.0, 0.58][lvl];
        nextDelayMs = (36 + Math.pow(Math.random(), 1.55) * 140) * rateMul;
      } else if (kind === 'hail') {
        const burst =
          lvl === 0
            ? 1
            : lvl === 2
              ? 2 + Math.floor(Math.random() * 3)
              : Math.random() < 0.46
                ? 2 + Math.floor(Math.random() * 3)
                : 1;
        for (let i = 0; i < burst; i++) {
          const offsetSec = i * (0.02 + Math.random() * 0.052);
          this.triggerHailImpact(offsetSec, ampScale);
        }
        const rateMul = [2.4, 1.0, 0.48][lvl];
        nextDelayMs = (40 + Math.pow(Math.random(), 1.4) * 160) * rateMul;
      } else if (kind === 'snow') {
        if (!this.indoor) {
          this.triggerFrostShimmer();
        }
        const rateMul = [1.7, 1.0, 0.6][lvl];
        nextDelayMs = (280 + Math.random() * 580) * rateMul;
      } else if (kind === 'clear') {
        if (!this.indoor) {
          if (this.isNight) {
            this.triggerNightCricket();
            nextDelayMs = 3600 + Math.random() * 5400;
          } else {
            this.triggerDayBirdChirp();
            nextDelayMs = 4500 + Math.random() * 7500;
          }
        } else {
          nextDelayMs = 2500;
        }
      } else {
        nextDelayMs = 1200 + Math.random() * 1800;
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
    const dur = 0.015 + Math.random() * 0.024;
    const startFreq = 720 + Math.random() * 1400;
    const endFreq = startFreq * (1.42 + Math.random() * 0.55);
    const peak = (0.022 + Math.random() * 0.04) * intensity;

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
    this.ensureNoisePools(ctx);
    const pool = this.rainPoolB!;

    const t0 = ctx.currentTime + offsetSec;
    const dur = 0.015 + Math.random() * 0.032;
    const offset = Math.random() * Math.max(0.1, pool.duration - 0.2);
    const peak = (0.042 + Math.random() * 0.08) * intensity;

    const src = ctx.createBufferSource();
    src.buffer = pool;
    src.playbackRate.value = 0.85 + Math.random() * 0.45;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1750 + Math.random() * 3400;
    bp.Q.value = 1.1 + Math.random() * 1.2;

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
  private triggerHailImpact(offsetSec: number, ampScale = 1.0) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;

    const panVal = (Math.random() - 0.5) * 1.75;
    const stoneSize = 0.55 + Math.random() * 0.95;
    const baseFreq = 460 / stoneSize + (Math.random() - 0.5) * 70;
    const mainPeak = (0.09 + stoneSize * 0.085) * ampScale;

    this.playSingleHailHit(ctx.currentTime + offsetSec, baseFreq, mainPeak, panVal, true);

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

    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.value = startFreq * 0.85;
    bodyFilter.Q.value = 1.5;

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

    if (withIceClick) {
      this.ensureNoisePools(ctx);
      const pool = this.rainPoolB!;
      const clickDur = 0.009 + Math.random() * 0.009;
      const offset = Math.random() * Math.max(0.1, pool.duration - 0.1);
      const src = ctx.createBufferSource();
      src.buffer = pool;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 2800 + Math.random() * 2600;
      hp.Q.value = 1.6;

      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t0);
      cg.gain.linearRampToValueAtTime(peakGain * 0.72, t0 + 0.0012);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + clickDur);

      src.connect(hp);
      hp.connect(cg);
      if (panner) cg.connect(panner);
      else cg.connect(bus);
      src.start(t0, offset, clickDur + 0.005);
    }
  }

  /** Occasional background distant storm rumble (3D lightning bolts also trigger synced claps!) */
  private scheduleNextThunder(delayMs: number) {
    if (!this.running || this.activeKind !== 'storm') return;
    this.thunderTimer = window.setTimeout(() => {
      if (!this.running || this.activeKind !== 'storm' || !this.shouldRun()) return;
      this.triggerRollingThunder(false);
      this.scheduleNextThunder(11000 + Math.random() * 14000);
    }, delayMs);
  }

  private triggerRollingThunder(forceNear?: boolean) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    this.ensureNoisePools(ctx);
    const pool = this.pinkPoolA!;

    const t0 = ctx.currentTime;
    const isNear = forceNear ?? Math.random() < 0.36;
    const totalDur = (isNear ? 3.2 : 2.6) + Math.random() * 2.2;
    const offset = Math.random() * Math.max(0.2, pool.duration - totalDur - 0.1);

    const src = ctx.createBufferSource();
    src.buffer = pool;
    src.playbackRate.value = 0.52 + Math.random() * 0.18;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(isNear ? 260 : 165, t0);
    lp.frequency.exponentialRampToValueAtTime(58 + Math.random() * 24, t0 + totalDur);
    lp.Q.value = 0.9;

    const g = ctx.createGain();
    const peak = isNear ? 0.38 : 0.24;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (isNear ? 0.08 : 0.38));
    const swellAt = t0 + totalDur * (0.36 + Math.random() * 0.14);
    g.gain.linearRampToValueAtTime(peak * 0.5, swellAt - 0.18);
    g.gain.linearRampToValueAtTime(peak * 0.72, swellAt);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + totalDur);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    src.connect(lp);
    lp.connect(g);
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.15;
      g.connect(panner);
      panner.connect(bus);
    } else {
      g.connect(bus);
    }
    src.start(t0, offset, totalDur + 0.05);

    if (isNear) {
      const crackDur = 0.16 + Math.random() * 0.12;
      const cSrc = ctx.createBufferSource();
      cSrc.buffer = this.rainPoolB!;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1350, t0);
      bp.frequency.exponentialRampToValueAtTime(260, t0 + crackDur);
      bp.Q.value = 0.85;

      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t0);
      cg.gain.linearRampToValueAtTime(0.22, t0 + 0.008);
      cg.gain.exponentialRampToValueAtTime(0.0001, t0 + crackDur);

      cSrc.connect(bp);
      bp.connect(cg);
      if (panner) cg.connect(panner);
      else cg.connect(bus);
      cSrc.start(t0, Math.random() * 10, crackDur + 0.02);
    }
  }

  private triggerFrostShimmer() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    this.ensureNoisePools(ctx);
    const pool = this.rainPoolB!;
    const t0 = ctx.currentTime;
    const dur = 0.08 + Math.random() * 0.14;
    const src = ctx.createBufferSource();
    src.buffer = pool;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400 + Math.random() * 2400;
    bp.Q.value = 3.2;
    const g = ctx.createGain();
    const peak = 0.012 + Math.random() * 0.012;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(bus);
    src.start(t0, Math.random() * 12, dur + 0.01);
  }

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
