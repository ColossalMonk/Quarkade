// Generated background music: soft pad chords, a bass note per bar and a gentle plucked melody
// on a pentatonic scale. No audio files, endless, and it never repeats exactly.
// It plays through the Synth's master bus, so mute / ad pauses / hidden tabs apply to it too.

import type { Synth } from "./audio.ts";
import { Rng } from "./rng.ts";

export interface SongSpec {
  bpm: number;
  /** MIDI root notes of each chord, one chord per bar. */
  progression: number[][];
  /** Scale degrees (MIDI notes) the melody may use. */
  melody: number[];
  /** Chance per eighth note that the melody plays. */
  density: number;
  volume: number;
}

/** A calm, cosy loop in C major (I - vi - IV - V). */
export const COSY_SONG: SongSpec = {
  bpm: 68,
  progression: [
    [48, 55, 60, 64],
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [43, 50, 55, 59],
  ],
  melody: [72, 74, 76, 79, 81, 84],
  density: 0.32,
  volume: 0.16,
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private synth: Synth;
  private song: SongSpec;
  private bus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0; // eighth notes since start
  private rng = new Rng(Date.now() >>> 0);
  private enabled = true;

  constructor(synth: Synth, song: SongSpec = COSY_SONG) {
    this.synth = synth;
    this.song = song;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.start();
    else this.stop();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Call after the Synth is unlocked (first user gesture). Safe to call repeatedly. */
  start(): void {
    if (!this.enabled || this.timer) return;
    const ctx = this.synth.ctx;
    const out = this.synth.output;
    if (!ctx || !out) return;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.connect(out);
    }
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.bus.gain.exponentialRampToValueAtTime(this.song.volume, ctx.currentTime + 2.5);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.synth.ctx;
    if (ctx && this.bus) {
      this.bus.gain.cancelScheduledValues(ctx.currentTime);
      this.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    }
  }

  private schedule(): void {
    const ctx = this.synth.ctx;
    if (!ctx || !this.bus || ctx.state !== "running") return;
    const eighth = 60 / this.song.bpm / 2;
    // Fill half a second ahead.
    while (this.nextTime < ctx.currentTime + 0.5) {
      this.playStep(this.nextTime, eighth);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, gain: number, attack: number): void {
    const ctx = this.synth.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.bus!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private playStep(t: number, eighth: number): void {
    const bar = Math.floor(this.step / 8) % this.song.progression.length;
    const inBar = this.step % 8;
    const chord = this.song.progression[bar];
    const barLen = eighth * 8;
    if (inBar === 0) {
      // Pad: the upper chord tones, slow swell.
      for (const m of chord.slice(1)) {
        this.note(mtof(m), t, barLen * 1.05, "triangle", 0.05, barLen * 0.35);
        this.note(mtof(m) * 1.003, t, barLen * 1.05, "sine", 0.035, barLen * 0.4);
      }
      // Bass.
      this.note(mtof(chord[0] - 12), t, barLen * 0.9, "sine", 0.12, 0.05);
    }
    if (inBar === 4) this.note(mtof(chord[0]), t, barLen * 0.45, "sine", 0.05, 0.05);
    // Melody: plucks that prefer chord tones on the beat.
    const onBeat = inBar % 2 === 0;
    if (this.rng.chance(this.song.density * (onBeat ? 1.3 : 0.6))) {
      const pool = onBeat ? this.song.melody.filter((m) => chord.some((c) => (m - c) % 12 === 0)) : this.song.melody;
      const m = this.rng.pick(pool.length ? pool : this.song.melody);
      this.note(mtof(m), t, eighth * 3, "sine", 0.07, 0.008);
      this.note(mtof(m) * 2, t, eighth * 1.5, "sine", 0.015, 0.005);
    }
  }
}
