// Snug Bento's sounds, all generated with WebAudio (DESIGN.md §2).

import { Synth, midi } from "../../../../forge/src/core/audio.ts";
import type { SongSpec } from "../../../../forge/src/core/music.ts";

/** A light café tune for forge's Music: marimba plucks, soft bass. */
export const CAFE_SONG: SongSpec = {
  bpm: 84,
  progression: [
    [53, 60, 64, 69],
    [50, 57, 62, 65],
    [46, 53, 58, 62],
    [48, 55, 60, 64],
  ],
  melody: [72, 74, 77, 79, 81, 84],
  density: 0.38,
  volume: 0.13,
};

export class Sfx {
  readonly synth = new Synth();

  /** Picking a piece up. */
  lift(): void {
    this.synth.tone({ freq: 660, freqEnd: 880, duration: 0.08, type: "sine", gain: 0.08 });
  }

  /** A piece seats: a soft pat, lower for bigger pieces. */
  pat(cells: number): void {
    const f = 520 - cells * 45;
    this.synth.noiseBurst({ duration: 0.05, type: "lowpass", freq: 900, gain: 0.25 });
    this.synth.tone({ freq: f, freqEnd: f * 0.7, duration: 0.12, type: "sine", gain: 0.18 });
  }

  /** Rotating: a wooden tok. */
  tok(): void {
    this.synth.tone({ freq: 880, duration: 0.05, type: "triangle", gain: 0.1 });
    this.synth.noiseBurst({ duration: 0.025, type: "bandpass", freq: 2000, q: 6, gain: 0.12 });
  }

  squish(): void {
    this.synth.tone({ freq: 300, freqEnd: 180, duration: 0.18, type: "sine", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.12, type: "lowpass", freq: 600, gain: 0.12 });
  }

  sizzle(): void {
    this.synth.noiseBurst({ duration: 0.35, type: "highpass", freq: 4000, gain: 0.07 });
  }

  chime(): void {
    this.synth.tone({ freq: 2093, duration: 0.25, type: "sine", gain: 0.06 });
  }

  /** Doesn't fit: a gentle wobble. */
  nope(): void {
    this.synth.tone({ freq: 240, freqEnd: 200, duration: 0.14, type: "triangle", gain: 0.14 });
    this.synth.tone({ freq: 200, freqEnd: 170, duration: 0.14, type: "triangle", gain: 0.1, delay: 0.1 });
  }

  /** The lid slides on and clicks shut. */
  lid(): void {
    this.synth.noiseBurst({ duration: 0.45, type: "bandpass", freq: 700, q: 2, gain: 0.08 });
    this.synth.tone({ freq: 180, freqEnd: 110, duration: 0.12, type: "sine", gain: 0.22, delay: 0.5 });
    this.synth.noiseBurst({ duration: 0.04, type: "highpass", freq: 2500, gain: 0.2, delay: 0.52 });
  }

  bell(): void {
    this.synth.tone({ freq: 1568, duration: 0.8, type: "sine", gain: 0.1 });
    this.synth.tone({ freq: 2349, duration: 0.6, type: "sine", gain: 0.05, delay: 0.02 });
  }

  bonk(): void {
    this.synth.tone({ freq: 190, freqEnd: 130, duration: 0.16, type: "sine", gain: 0.22 });
  }

  coin(): void {
    this.synth.tone({ freq: 1320, duration: 0.08, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 1760, duration: 0.12, type: "triangle", gain: 0.12, delay: 0.06 });
  }

  win(): void {
    this.synth.arpeggio([midi(65), midi(69), midi(72), midi(77), midi(81)], 0.08, { gain: 0.16, duration: 0.7 });
  }

  /** A recipe goes on the menu board. */
  recipe(): void {
    this.synth.arpeggio([midi(60), midi(64), midi(67), midi(72), midi(76), midi(79), midi(84)], 0.09, { gain: 0.14, duration: 1.0 });
  }

  power(): void {
    this.synth.tone({ freq: 440, freqEnd: 880, duration: 0.25, type: "triangle", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.3, type: "highpass", freq: 3000, gain: 0.08 });
  }

  chop(): void {
    this.synth.noiseBurst({ duration: 0.04, type: "bandpass", freq: 1800, q: 4, gain: 0.25 });
    this.synth.tone({ freq: 140, freqEnd: 90, duration: 0.1, type: "sine", gain: 0.2, delay: 0.02 });
  }
}
