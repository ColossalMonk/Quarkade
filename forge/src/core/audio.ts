// Sound made in code with WebAudio: no audio files to download.
// The context starts on the first user gesture (browsers require it).

export class Synth {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false; // player setting
  private suspendedByHost = false; // ads, hidden tab, platform pause

  /** Call from a user gesture (pointerdown / keydown). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; // 1 second of white noise
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    this.applyState();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyState();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Master bus, for other sound sources (e.g. Music) to connect into. Null until unlocked. */
  get output(): AudioNode | null {
    return this.master;
  }

  /** Used by the platform layer during ads and when the tab is hidden. */
  setHostSuspended(suspended: boolean): void {
    this.suspendedByHost = suspended;
    this.applyState();
  }

  private applyState(): void {
    if (!this.ctx || !this.master) return;
    const silent = this.muted || this.suspendedByHost;
    this.master.gain.setTargetAtTime(silent ? 0 : 0.7, this.ctx.currentTime, 0.02);
    if (this.suspendedByHost) void this.ctx.suspend().catch(() => {});
    else if (this.ctx.state !== "running") void this.ctx.resume().catch(() => {});
  }

  private get ready(): boolean {
    return !!this.ctx && !!this.master && !this.muted && !this.suspendedByHost && this.ctx.state === "running";
  }

  /** Filtered noise burst: fwips, thumps, clicks, hisses. */
  noiseBurst(opts: {
    duration: number;
    type?: BiquadFilterType;
    freq: number;
    q?: number;
    gain?: number;
    attack?: number;
    freqEnd?: number;
    delay?: number;
  }): void {
    if (!this.ready || !this.noise) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? "bandpass";
    filter.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + opts.duration);
    filter.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.5;
    const attack = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + opts.duration + 0.05);
  }

  /** A simple pitched note. */
  tone(opts: {
    freq: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    attack?: number;
    freqEnd?: number;
    delay?: number;
  }): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + opts.duration);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.25;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.05);
  }

  /** Plays several notes as a short arpeggio. */
  arpeggio(freqs: number[], step = 0.07, opts: { type?: OscillatorType; gain?: number; duration?: number } = {}): void {
    freqs.forEach((f, i) =>
      this.tone({ freq: f, duration: opts.duration ?? 0.5, type: opts.type ?? "triangle", gain: opts.gain ?? 0.18, delay: i * step }),
    );
  }
}

/** Note name helper: midi(60) = middle C. */
export function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}
