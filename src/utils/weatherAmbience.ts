import type { ClimateZone, WeatherIntensity, WeatherKind, WorldSeason } from './weatherSystem';
import type { DayNightPhase } from './solarDayNight3D';

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
  private dayPhase: DayNightPhase = 'day';
  private season: WorldSeason = 'spring';
  private climateZone: ClimateZone = 'temperate';
  private seasonManual = false;
  private tempC = 22;
  private enabled = true;
  private volume = 68;
  private masterVolume = 80;
  private muted = false;
  private pageHidden = false;
  private muteOnBlur = true;

  private running = false;
  private driftTimer: number | null = null;
  private eventTimer: number | null = null;
  private bioTimer: number | null = null;
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
    ctx?: AudioContext | null,
  ) {
    const nextIndoor = opts?.indoor ?? this.indoor;
    const nextPhase: DayNightPhase =
      opts?.dayPhase ??
      (opts?.isNight !== undefined ? (opts.isNight ? 'night' : 'day') : this.dayPhase);
    const nextNight = opts?.isNight ?? (nextPhase === 'night' || nextPhase === 'dusk');
    const nextIntensity: WeatherIntensity =
      kind === 'clear' ? 'moderate' : (opts?.intensity ?? this.intensity);
    const nextSeason = opts?.season ?? this.season;
    const nextClimate = opts?.climateZone ?? this.climateZone;
    const nextSeasonManual = opts?.seasonManual ?? this.seasonManual;
    const nextTemp = opts?.tempC ?? this.tempC;

    const kindChanged = kind !== this.activeKind;
    const intensityChanged = nextIntensity !== this.intensity;
    const bioChanged =
      nextSeason !== this.season ||
      nextClimate !== this.climateZone ||
      nextSeasonManual !== this.seasonManual ||
      nextPhase !== this.dayPhase ||
      Math.abs(nextTemp - this.tempC) >= 4;
    const envChanged = nextIndoor !== this.indoor || nextNight !== this.isNight;

    this.activeKind = kind;
    this.intensity = nextIntensity;
    this.indoor = nextIndoor;
    this.dayPhase = nextPhase;
    this.isNight = nextNight;
    this.season = nextSeason;
    this.climateZone = nextClimate;
    this.seasonManual = nextSeasonManual;
    this.tempC = nextTemp;

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
      } else if (bioChanged || envChanged) {
        this.resetBioScheduler(500 + Math.random() * 850);
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
    if (this.bioTimer !== null) {
      window.clearTimeout(this.bioTimer);
      this.bioTimer = null;
    }
    if (this.thunderTimer !== null) {
      window.clearTimeout(this.thunderTimer);
      this.thunderTimer = null;
    }
  }

  private resetBioScheduler(initialDelayMs: number) {
    if (this.bioTimer !== null) {
      window.clearTimeout(this.bioTimer);
      this.bioTimer = null;
    }
    if (!this.running || !this.activeKind) return;
    this.scheduleNextSeasonalBioEvent(initialDelayMs);
  }

  private resetDiscreteSchedulers() {
    this.clearDiscreteSchedulers();
    if (!this.running || !this.activeKind) return;
    this.scheduleNextMicroEvent(120 + Math.random() * 240);
    this.scheduleNextSeasonalBioEvent(750 + Math.random() * 1400);
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
      } else {
        // Clear/cloudy/windy wildlife & seasonal calls run on the dedicated `bioTimer`!
        nextDelayMs = 2200 + Math.random() * 2000;
      }

      this.scheduleNextMicroEvent(nextDelayMs);
    }, delayMs);
  }

  /**
   * Dedicated Latitude-, Season-, Time-of-Day-, and Weather-Aware Wildlife Soundscape Scheduler:
   * - Spring: lively dawn/day songbird chorus + warm 2-note cuckoo ("布谷") + spring night/rain pond frogs
   * - Summer: unmistakable midday cicadas ("嘶—知了知了—") + birds + dusk higurashi ("暮蝉") + night frogs & crickets
   * - Autumn: crisp birds + dry leaf rustle + dusk evening cicadas + rich autumn crickets & bell insects ("铃虫")
   * - Winter: serene stillness + sparse snow finch / distant crow (day) + rare peaceful owl hoot (night)
   * - Tropical: vibrant tropical birds, warm cicadas & evening/night tree frogs year-round
   * - Polar: hushed tundra wind with sparse high-latitude birds & distant winter crows/owls
   */
  private scheduleNextSeasonalBioEvent(delayMs: number) {
    if (!this.running) return;
    this.bioTimer = window.setTimeout(() => {
      if (!this.running || !this.shouldRun()) return;
      const kind = this.activeKind;
      if (!kind) return;

      if (this.indoor) {
        this.scheduleNextSeasonalBioEvent(3200 + Math.random() * 2400);
        return;
      }

      const harshWeather =
        kind === 'storm' ||
        kind === 'hail' ||
        (kind === 'rain' && this.intensity === 'heavy') ||
        (kind === 'snow' && this.intensity !== 'light') ||
        (kind === 'windy' && this.intensity === 'heavy');
      if (harshWeather) {
        this.scheduleNextSeasonalBioEvent(4200 + Math.random() * 3000);
        return;
      }

      const phase = this.dayPhase;
      const season = this.season;
      const climate = this.seasonManual ? 'temperate' : this.climateZone;
      const isWarmEnoughForInsects = this.seasonManual ? this.tempC > 0 : this.tempC >= 8;
      const isLightOrModRain = kind === 'rain';

      let nextDelayMs = 4500 + Math.random() * 4500;

      // Rainy day/night: birds shelter, but pond frogs LOVE warm spring/summer/tropical rain!
      if (isLightOrModRain) {
        if ((season === 'spring' || season === 'summer' || climate === 'tropical') && this.tempC >= 10) {
          this.triggerFrogCroak(climate === 'tropical');
          nextDelayMs = 2400 + Math.random() * 4200;
        } else {
          nextDelayMs = 5000 + Math.random() * 3500;
        }
        this.scheduleNextSeasonalBioEvent(nextDelayMs);
        return;
      }

      // 1. TROPICAL BELT (|lat| < 23.5°): lush tropical birds, warm cicadas & tree frogs!
      if (climate === 'tropical' && season !== 'winter') {
        if (phase === 'night') {
          if (Math.random() < 0.62) {
            this.triggerFrogCroak(true);
          } else {
            this.triggerCricketPhrase(false);
          }
          nextDelayMs = 1900 + Math.random() * 3200;
        } else if (phase === 'dusk') {
          if (Math.random() < 0.52 && isWarmEnoughForInsects) {
            this.triggerEveningCicada();
          } else {
            this.triggerTropicalBirdCall();
          }
          nextDelayMs = 2400 + Math.random() * 3400;
        } else {
          const r = Math.random();
          if (r < 0.44 && isWarmEnoughForInsects) {
            this.triggerSummerCicada();
            nextDelayMs = 2600 + Math.random() * 3400;
          } else if (r < 0.78) {
            this.triggerTropicalBirdCall();
            nextDelayMs = 2200 + Math.random() * 3600;
          } else {
            this.triggerDayBirdChirp(1.1);
            nextDelayMs = 2500 + Math.random() * 3800;
          }
        }
        this.scheduleNextSeasonalBioEvent(nextDelayMs);
        return;
      }

      // 2. POLAR / SUB-ARCTIC BELT (|lat| >= 58°): sparse serene northern wildlife
      if (climate === 'polar') {
        if (phase === 'night') {
          if (Math.random() < 0.55) {
            this.triggerDistantOwl();
          }
          nextDelayMs = 8500 + Math.random() * 9000;
        } else if (season === 'summer') {
          if (Math.random() < 0.55) {
            this.triggerDayBirdChirp(0.82);
          } else {
            this.triggerWinterFinch();
          }
          nextDelayMs = 4200 + Math.random() * 5800;
        } else {
          if (Math.random() < 0.55) {
            this.triggerWinterFinch();
          } else {
            this.triggerDistantCrow();
          }
          nextDelayMs = 6800 + Math.random() * 8200;
        }
        this.scheduleNextSeasonalBioEvent(nextDelayMs);
        return;
      }

      // 3. TEMPERATE 4-SEASON SOUNDSCAPES (Spring / Summer / Autumn / Winter)
      if (season === 'spring') {
        if (phase === 'dawn') {
          if (Math.random() < 0.72) {
            this.triggerDayBirdChirp(1.15);
          } else {
            this.triggerCuckooCall();
          }
          nextDelayMs = 1700 + Math.random() * 2600;
        } else if (phase === 'day') {
          if (Math.random() < 0.68) {
            this.triggerDayBirdChirp(1.05);
          } else {
            this.triggerCuckooCall();
          }
          nextDelayMs = 2600 + Math.random() * 4400;
        } else if (phase === 'dusk') {
          if (Math.random() < 0.55) {
            this.triggerDayBirdChirp(0.85);
          } else if (isWarmEnoughForInsects) {
            this.triggerFrogCroak(false);
          }
          nextDelayMs = 3000 + Math.random() * 4200;
        } else {
          if (isWarmEnoughForInsects && Math.random() < 0.7) {
            this.triggerFrogCroak(false);
            nextDelayMs = 2400 + Math.random() * 4000;
          } else {
            this.triggerCricketPhrase(false);
            nextDelayMs = 3600 + Math.random() * 4800;
          }
        }
      } else if (season === 'summer') {
        if (phase === 'dawn') {
          if (Math.random() < 0.65) {
            this.triggerDayBirdChirp(1.05);
          } else if (isWarmEnoughForInsects) {
            this.triggerSummerCicada();
          }
          nextDelayMs = 2200 + Math.random() * 3400;
        } else if (phase === 'day') {
          if (isWarmEnoughForInsects && Math.random() < 0.7) {
            this.triggerSummerCicada();
            nextDelayMs = 2400 + Math.random() * 3400;
          } else {
            this.triggerDayBirdChirp(0.95);
            nextDelayMs = 3200 + Math.random() * 4400;
          }
        } else if (phase === 'dusk') {
          if (isWarmEnoughForInsects && Math.random() < 0.68) {
            this.triggerEveningCicada();
            nextDelayMs = 2600 + Math.random() * 3800;
          } else {
            this.triggerDayBirdChirp(0.8);
            nextDelayMs = 3600 + Math.random() * 4600;
          }
        } else {
          if (isWarmEnoughForInsects) {
            if (Math.random() < 0.52) {
              this.triggerCricketPhrase(false);
            } else {
              this.triggerFrogCroak(false);
            }
            nextDelayMs = 2100 + Math.random() * 3400;
          } else {
            this.triggerDistantOwl();
            nextDelayMs = 7500 + Math.random() * 7500;
          }
        }
      } else if (season === 'autumn') {
        if (phase === 'dawn' || phase === 'day') {
          const r = Math.random();
          if (r < 0.44) {
            this.triggerDayBirdChirp(0.9);
          } else if (r < 0.78) {
            this.triggerLeafRustle();
          } else if (isWarmEnoughForInsects) {
            this.triggerEveningCicada();
          } else {
            this.triggerDistantCrow();
          }
          nextDelayMs = 3000 + Math.random() * 4600;
        } else if (phase === 'dusk') {
          const r = Math.random();
          if (r < 0.44 && isWarmEnoughForInsects) {
            this.triggerEveningCicada();
          } else if (r < 0.78 && isWarmEnoughForInsects) {
            this.triggerCricketPhrase(true);
          } else {
            this.triggerLeafRustle();
          }
          nextDelayMs = 2600 + Math.random() * 3800;
        } else {
          const r = Math.random();
          if (isWarmEnoughForInsects && r < 0.48) {
            this.triggerCricketPhrase(true); // Crisp autumn bell cricket ("铃虫")
            nextDelayMs = 2000 + Math.random() * 3200;
          } else if (isWarmEnoughForInsects && r < 0.88) {
            this.triggerCricketPhrase(false); // Field cricket ("蛐蛐")
            nextDelayMs = 2200 + Math.random() * 3400;
          } else {
            this.triggerDistantOwl();
            nextDelayMs = 5200 + Math.random() * 5800;
          }
        }
      } else {
        // Winter: serene quiet crisp atmosphere
        if (phase === 'night') {
          this.triggerDistantOwl();
          nextDelayMs = 8200 + Math.random() * 9800;
        } else if (phase === 'dusk') {
          this.triggerDistantCrow();
          nextDelayMs = 6800 + Math.random() * 7800;
        } else {
          if (Math.random() < 0.64) {
            this.triggerWinterFinch();
          } else {
            this.triggerDistantCrow();
          }
          nextDelayMs = 5600 + Math.random() * 7800;
        }
      }

      // Slightly thin wildlife density under heavy overcast or moderate wind
      if (kind === 'cloudy' && this.intensity === 'heavy') {
        nextDelayMs *= 1.45;
      } else if (kind === 'windy') {
        nextDelayMs *= 1.35;
      }

      this.scheduleNextSeasonalBioEvent(nextDelayMs);
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

  /** Bright woodland songbird phrase (sparrow / robin / warbler trills) */
  private triggerDayBirdChirp(liveliness = 1.0) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panVal = (Math.random() - 0.5) * 1.5;
    const notes = 2 + Math.floor(Math.random() * (liveliness > 1 ? 4 : 3));
    const baseHz = 2400 + Math.random() * 1450;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = panVal;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    let t = ctx.currentTime;
    for (let i = 0; i < notes; i++) {
      const dur = 0.055 + Math.random() * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const f0 = baseHz * (0.88 + Math.random() * 0.28);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(
        Math.min(5400, f0 * (1.18 + Math.random() * 0.26)),
        t + dur * 0.52,
      );
      osc.frequency.exponentialRampToValueAtTime(f0 * (0.9 + Math.random() * 0.12), t + dur);

      const g = ctx.createGain();
      const peak = (0.017 + Math.random() * 0.012) * Math.min(1.25, liveliness);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.011);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(g);
      g.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      t += dur + 0.038 + Math.random() * 0.065;
    }
  }

  /** Spring Cuckoo ("布谷—布谷"): iconic warm pure descending minor-third flute call */
  private triggerCuckooCall() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.4;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    const hiHz = 735 + Math.random() * 65;
    const loHz = hiHz * 0.81; // Classic cuckoo descending third
    const repeats = Math.random() < 0.6 ? 2 : 1;
    let t = ctx.currentTime;
    for (let r = 0; r < repeats; r++) {
      for (const [freq, dur, gap] of [
        [hiHz, 0.14, 0.13],
        [loHz, 0.22, 0.42],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 1.015, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + dur);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.022, t + 0.024);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(g);
        g.connect(target);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur + gap;
      }
    }
  }

  /** Tropical Rainforest Bird: vibrant soaring whistle + rapid exotic upward trill */
  private triggerTropicalBirdCall() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.6;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    const t0 = ctx.currentTime;
    const fStart = 1650 + Math.random() * 650;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fStart, t0);
    osc.frequency.exponentialRampToValueAtTime(fStart * 1.75, t0 + 0.16);
    osc.frequency.exponentialRampToValueAtTime(fStart * 1.25, t0 + 0.26);
    osc.frequency.exponentialRampToValueAtTime(fStart * 1.95, t0 + 0.38);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.022, t0 + 0.03);
    g.gain.setValueAtTime(0.018, t0 + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);

    osc.connect(g);
    g.connect(target);
    osc.start(t0);
    osc.stop(t0 + 0.44);
  }

  /**
   * Summer Midday Cicada ("嘶——知了知了——"):
   * Bandpass-sculpted crisp treetop noise + gentle high-frequency tymbal AM pulse swell
   * that rises smoothly, pulses rhythmically, and trails off cleanly in stereo!
   */
  private triggerSummerCicada() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    this.ensureNoisePools(ctx);
    const pool = this.rainPoolB!;

    const t0 = ctx.currentTime;
    const dur = 2.6 + Math.random() * 2.1;
    const offset = Math.random() * Math.max(0.2, pool.duration - dur - 0.1);
    const centerHz = 4450 + Math.random() * 1450;

    const src = ctx.createBufferSource();
    src.buffer = pool;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(centerHz * 0.92, t0);
    bp.frequency.linearRampToValueAtTime(centerHz * 1.06, t0 + dur * 0.45);
    bp.frequency.linearRampToValueAtTime(centerHz * 0.88, t0 + dur);
    bp.Q.value = 3.4;

    // Rhythmic cicada wing/tymbal AM modulation ("知—了—知—了" slow wave + fine buzz)
    const amGain = ctx.createGain();
    amGain.gain.value = 0.65;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5.2 + Math.random() * 4.4;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.32;
    lfo.connect(lfoDepth);
    lfoDepth.connect(amGain.gain);

    // Subtle tonal harmonic shimmer characteristic of summer cicadas
    const carrier = ctx.createOscillator();
    carrier.type = 'triangle';
    carrier.frequency.value = centerHz * 0.96;
    const carGain = ctx.createGain();
    carGain.gain.value = 0.08;

    const env = ctx.createGain();
    const peak = 0.026 + Math.random() * 0.015;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + dur * 0.26);
    env.gain.setValueAtTime(peak * 0.94, t0 + dur * 0.68);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    src.connect(bp);
    carrier.connect(carGain);
    carGain.connect(bp);
    bp.connect(amGain);
    amGain.connect(env);
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.65;
      env.connect(panner);
      panner.connect(bus);
    } else {
      env.connect(bus);
    }

    lfo.start(t0);
    carrier.start(t0);
    src.start(t0, offset, dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
    carrier.stop(t0 + dur + 0.05);
  }

  /** Evening Cicada / Higurashi ("暮蝉 / 寒蝉 カナカナカナ…"): bittersweet descending dusk bell-pulse trill */
  private triggerEveningCicada() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.6;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    const pulses = 7 + Math.floor(Math.random() * 5);
    const startHz = 3850 + Math.random() * 420;
    let t = ctx.currentTime;
    for (let i = 0; i < pulses; i++) {
      const frac = i / Math.max(1, pulses - 1);
      const dur = 0.075 + frac * 0.025;
      const f = startHz * (1 - frac * 0.16);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 1.04, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.94, t + dur);

      const env = ctx.createGain();
      const peak = (0.015 + (1 - Math.abs(frac - 0.35)) * 0.008) * (1 - frac * 0.35);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(env);
      env.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      t += dur + 0.048 + frac * 0.022;
    }
  }

  /** Pond Frog / Tree Frog ("呱—呱—"): warm resonant croaking formant bursts */
  private triggerFrogCroak(isTropicalTreeFrog: boolean) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.55;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    const croaks = 2 + Math.floor(Math.random() * 2);
    let t = ctx.currentTime;
    for (let i = 0; i < croaks; i++) {
      const dur = isTropicalTreeFrog ? 0.11 + Math.random() * 0.05 : 0.18 + Math.random() * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const baseF = isTropicalTreeFrog ? 420 + Math.random() * 140 : 185 + Math.random() * 65;
      osc.frequency.setValueAtTime(baseF * 0.88, t);
      osc.frequency.exponentialRampToValueAtTime(baseF * 1.24, t + dur * 0.55);
      osc.frequency.exponentialRampToValueAtTime(baseF * 0.95, t + dur);

      // Resonant frog throat formant
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(isTropicalTreeFrog ? 1450 : 720, t);
      bp.frequency.exponentialRampToValueAtTime(isTropicalTreeFrog ? 1950 : 980, t + dur * 0.6);
      bp.Q.value = 3.6;

      // Subtle croak throat flutter
      const flutter = ctx.createOscillator();
      flutter.type = 'sine';
      flutter.frequency.value = isTropicalTreeFrog ? 36 : 26;
      const fDepth = ctx.createGain();
      fDepth.gain.value = 0.008;

      const g = ctx.createGain();
      const peak = isTropicalTreeFrog ? 0.02 : 0.026;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      flutter.connect(fDepth);
      fDepth.connect(g.gain);
      osc.connect(bp);
      bp.connect(g);
      g.connect(target);

      osc.start(t);
      flutter.start(t);
      osc.stop(t + dur + 0.015);
      flutter.stop(t + dur + 0.015);
      t += dur + (isTropicalTreeFrog ? 0.14 : 0.24) + Math.random() * 0.12;
    }
  }

  /** Field Cricket ("蛐蛐 唧唧唧") & Autumn Bell Cricket ("铃虫 叮铃铃…") */
  private triggerCricketPhrase(isBellCricket: boolean) {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const baseHz = isBellCricket ? 4550 + Math.random() * 480 : 3950 + Math.random() * 550;
    const pulses = isBellCricket ? 7 + Math.floor(Math.random() * 5) : 3 + Math.floor(Math.random() * 3);
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.6;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    let t = ctx.currentTime;
    for (let i = 0; i < pulses; i++) {
      const dur = isBellCricket ? 0.042 : 0.028;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseHz + (Math.random() - 0.5) * 35, t);

      const g = ctx.createGain();
      const peak = isBellCricket ? 0.013 + Math.random() * 0.006 : 0.012 + Math.random() * 0.006;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(g);
      g.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.005);
      t += isBellCricket ? 0.056 : 0.046;
    }
  }

  /** Dry Autumn Leaf Rustle: papery breeze brushing fallen leaves along paths */
  private triggerLeafRustle() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    this.ensureNoisePools(ctx);
    const pool = this.rainPoolB!;
    const t0 = ctx.currentTime;
    const dur = 0.45 + Math.random() * 0.55;
    const src = ctx.createBufferSource();
    src.buffer = pool;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850 + Math.random() * 900, t0);
    bp.frequency.linearRampToValueAtTime(2700 + Math.random() * 800, t0 + dur);
    bp.Q.value = 1.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.012, t0 + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    src.connect(bp);
    bp.connect(g);
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.5;
      g.connect(panner);
      panner.connect(bus);
    } else {
      g.connect(bus);
    }
    src.start(t0, Math.random() * 12, dur + 0.05);
  }

  /** Winter Snow Finch: delicate short high crystalline "唧—唧" chirp in quiet cold air */
  private triggerWinterFinch() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.45;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    let t = ctx.currentTime;
    const f0 = 3300 + Math.random() * 650;
    for (let i = 0; i < 2; i++) {
      const dur = 0.048;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.86, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.014, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      t += 0.12 + Math.random() * 0.06;
    }
  }

  /** Distant Winter/Autumn Crow: soft far-off atmospheric caw (never loud or harsh) */
  private triggerDistantCrow() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.6;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    let t = ctx.currentTime;
    const caws = Math.random() < 0.55 ? 2 : 1;
    for (let i = 0; i < caws; i++) {
      const dur = 0.24 + Math.random() * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const base = 440 + Math.random() * 55;
      osc.frequency.setValueAtTime(base * 1.08, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.84, t + dur);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 980;
      bp.Q.value = 2.4;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.014, t + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(bp);
      bp.connect(g);
      g.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.22 + Math.random() * 0.1;
    }
  }

  /** Peaceful Distant Night Owl ("呜——呜呜"): soft hollow woodland owl hoot */
  private triggerDistantOwl() {
    const ctx = this.ctx;
    const bus = this.busInput;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = (Math.random() - 0.5) * 1.5;
      panner.connect(bus);
    }
    const target = panner ?? bus;
    const baseHz = 385 + Math.random() * 55;
    let t = ctx.currentTime;
    for (const [mult, dur, gap] of [
      [1.0, 0.34, 0.28],
      [0.92, 0.16, 0.1],
      [0.86, 0.38, 0],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseHz * mult * 1.02, t);
      osc.frequency.exponentialRampToValueAtTime(baseHz * mult * 0.96, t + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(g);
      g.connect(target);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + gap;
    }
  }
}
