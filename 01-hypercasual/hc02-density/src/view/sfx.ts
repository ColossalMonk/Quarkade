// Density's lab sounds, all generated with WebAudio (DESIGN.md §2).

import { Synth, midi } from "../../../../forge/src/core/audio.ts";
import type { SongSpec } from "../../../../forge/src/core/music.ts";

/** A light, bubbly lab tune for forge's Music. */
export const LAB_SONG: SongSpec = {
  bpm: 76,
  progression: [
    [50, 57, 62, 66],
    [47, 54, 59, 62],
    [43, 50, 55, 59],
    [45, 52, 57, 61],
  ],
  melody: [74, 76, 78, 81, 83, 86],
  density: 0.36,
  volume: 0.14,
};

export class Sfx {
  readonly synth = new Synth();

  pick(): void {
    this.synth.tone({ freq: 1500, duration: 0.05, type: "sine", gain: 0.1 });
    this.synth.tone({ freq: 2200, duration: 0.05, type: "sine", gain: 0.06, delay: 0.03 });
  }

  /** Glugs whose pitch rises as the target fills. */
  pour(amount: number, fill: number): void {
    for (let i = 0; i < amount * 2; i++) {
      const f = 260 + (fill + i * 0.5) * 70;
      this.synth.noiseBurst({ duration: 0.09, type: "bandpass", freq: f, q: 4, gain: 0.35, delay: 0.06 + i * 0.09 });
      this.synth.tone({ freq: f * 0.9, freqEnd: f * 1.3, duration: 0.08, type: "sine", gain: 0.06, delay: 0.06 + i * 0.09 });
    }
  }

  /** Heavy syrup landing under lighter layers. */
  plop(): void {
    this.synth.tone({ freq: 140, freqEnd: 70, duration: 0.18, type: "sine", gain: 0.25, delay: 0.25 });
  }

  /** Oil settling on top. */
  blip(): void {
    this.synth.tone({ freq: 900, freqEnd: 1300, duration: 0.08, type: "sine", gain: 0.1, delay: 0.2 });
  }

  seal(): void {
    this.synth.noiseBurst({ duration: 0.05, type: "highpass", freq: 2000, gain: 0.3 });
    this.synth.tone({ freq: 2093, duration: 0.4, type: "triangle", gain: 0.14, delay: 0.05 });
    this.synth.arpeggio([midi(79), midi(83), midi(86)], 0.05, { gain: 0.1, duration: 0.3 });
  }

  bonk(): void {
    this.synth.tone({ freq: 190, freqEnd: 130, duration: 0.16, type: "sine", gain: 0.22 });
  }

  coin(): void {
    this.synth.tone({ freq: 1320, duration: 0.08, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 1760, duration: 0.12, type: "triangle", gain: 0.12, delay: 0.06 });
  }

  win(): void {
    this.synth.arpeggio([midi(62), midi(66), midi(69), midi(74), midi(78)], 0.08, { gain: 0.16, duration: 0.7 });
  }

  tower(): void {
    for (let i = 0; i < 10; i++) this.synth.tone({ freq: 600 + Math.random() * 900, duration: 0.12, type: "sine", gain: 0.06, delay: i * 0.05 });
    this.synth.arpeggio([midi(57), midi(62), midi(66), midi(69), midi(74), midi(78), midi(81), midi(86)], 0.09, { gain: 0.14, duration: 1.1 });
  }

  power(): void {
    this.synth.tone({ freq: 440, freqEnd: 880, duration: 0.25, type: "triangle", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.3, type: "highpass", freq: 3000, gain: 0.08 });
  }

  spin(): void {
    this.synth.tone({ freq: 200, freqEnd: 900, duration: 0.6, type: "sawtooth", gain: 0.05 });
  }
}
