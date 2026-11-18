// Koi Out's sounds, all generated with WebAudio (DESIGN.md §2).

import { Synth, midi } from "../../../../forge/src/core/audio.ts";
import type { SongSpec } from "../../../../forge/src/core/music.ts";

/** A calm garden tune for forge's Music: koto-like plucks, a soft pad. */
export const GARDEN_SONG: SongSpec = {
  bpm: 72,
  progression: [
    [50, 57, 62, 69],
    [45, 52, 57, 64],
    [47, 54, 59, 66],
    [43, 50, 55, 62],
  ],
  melody: [69, 71, 74, 76, 78, 81],
  density: 0.32,
  volume: 0.12,
};

export class Sfx {
  readonly synth = new Synth();

  /** A koi sets off: a soft swish, longer for long koi. */
  swish(len: number): void {
    this.synth.noiseBurst({ duration: 0.18 + len * 0.04, type: "bandpass", freq: 900, q: 1.2, gain: 0.09 });
    this.synth.tone({ freq: 330, freqEnd: 520, duration: 0.15, type: "sine", gain: 0.06 });
  }

  /** It leaves the pond. */
  splash(): void {
    this.synth.noiseBurst({ duration: 0.12, type: "highpass", freq: 2500, gain: 0.1 });
    this.synth.tone({ freq: 880, freqEnd: 1320, duration: 0.08, type: "sine", gain: 0.07, delay: 0.02 });
  }

  /** Blocked: a bonk and a bubble pop. */
  bonk(): void {
    this.synth.tone({ freq: 200, freqEnd: 130, duration: 0.16, type: "sine", gain: 0.24 });
    this.synth.tone({ freq: 700, freqEnd: 1100, duration: 0.05, type: "sine", gain: 0.06, delay: 0.12 });
  }

  pling(): void {
    this.synth.tone({ freq: 1568, freqEnd: 1760, duration: 0.25, type: "sine", gain: 0.1 });
  }

  bell(): void {
    this.synth.tone({ freq: 523, duration: 1.4, type: "sine", gain: 0.12 });
    this.synth.tone({ freq: 1046, duration: 1.0, type: "sine", gain: 0.05, delay: 0.01 });
  }

  croak(): void {
    this.synth.tone({ freq: 140, freqEnd: 110, duration: 0.12, type: "square", gain: 0.06 });
    this.synth.tone({ freq: 150, freqEnd: 115, duration: 0.12, type: "square", gain: 0.05, delay: 0.16 });
  }

  swirl(): void {
    this.synth.noiseBurst({ duration: 0.3, type: "bandpass", freq: 500, q: 3, gain: 0.07 });
  }

  pick(): void {
    this.synth.tone({ freq: 760, duration: 0.05, type: "triangle", gain: 0.08 });
  }

  coin(): void {
    this.synth.tone({ freq: 1320, duration: 0.08, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 1760, duration: 0.12, type: "triangle", gain: 0.12, delay: 0.06 });
  }

  win(): void {
    this.synth.arpeggio([midi(62), midi(66), midi(69), midi(74), midi(78)], 0.09, { gain: 0.15, duration: 0.8 });
  }

  page(): void {
    this.synth.arpeggio([midi(57), midi(62), midi(66), midi(69), midi(74), midi(78), midi(81)], 0.1, { gain: 0.13, duration: 1.1 });
  }

  power(): void {
    this.synth.tone({ freq: 440, freqEnd: 880, duration: 0.25, type: "triangle", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.3, type: "highpass", freq: 3000, gain: 0.08 });
  }

  lose(): void {
    this.synth.tone({ freq: 392, freqEnd: 330, duration: 0.3, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 330, freqEnd: 262, duration: 0.4, type: "triangle", gain: 0.1, delay: 0.25 });
  }
}
