// Aisle Nine's sounds, all generated with WebAudio (DESIGN.md §2).

import { Synth, midi } from "../../../../forge/src/core/audio.ts";
import type { SongSpec } from "../../../../forge/src/core/music.ts";

/** A light corner-shop tune for forge's Music: ukulele-ish plucks, glockenspiel melody. */
export const SHOP_SONG: SongSpec = {
  bpm: 96,
  progression: [
    [48, 55, 60, 64],
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [43, 50, 55, 59],
  ],
  melody: [72, 74, 76, 79, 81, 84],
  density: 0.42,
  volume: 0.12,
};

export class Sfx {
  readonly synth = new Synth();

  /** Picking a good up: a soft tock, pitched by its size. */
  pick(): void {
    this.synth.tone({ freq: 700, freqEnd: 900, duration: 0.06, type: "triangle", gain: 0.09 });
  }

  /** Setting it down. */
  place(): void {
    this.synth.noiseBurst({ duration: 0.04, type: "lowpass", freq: 1200, gain: 0.2 });
    this.synth.tone({ freq: 420, freqEnd: 300, duration: 0.09, type: "sine", gain: 0.16 });
  }

  /** Three alike sold: a till "ka-ching", rising with a combo. */
  sell(combo = 0): void {
    const up = Math.min(5, combo) * 2;
    this.synth.noiseBurst({ duration: 0.05, type: "bandpass", freq: 3000, q: 3, gain: 0.12 });
    this.synth.tone({ freq: midi(84 + up), duration: 0.12, type: "triangle", gain: 0.12, delay: 0.04 });
    this.synth.tone({ freq: midi(88 + up), duration: 0.3, type: "sine", gain: 0.12, delay: 0.1 });
  }

  /** The stand turns a step. */
  turn(): void {
    this.synth.noiseBurst({ duration: 0.03, type: "bandpass", freq: 1500, q: 5, gain: 0.12 });
    this.synth.tone({ freq: 220, freqEnd: 180, duration: 0.08, type: "triangle", gain: 0.08, delay: 0.02 });
  }

  restock(): void {
    this.synth.noiseBurst({ duration: 0.12, type: "lowpass", freq: 700, gain: 0.1 });
  }

  tear(): void {
    this.synth.noiseBurst({ duration: 0.25, type: "highpass", freq: 1800, gain: 0.14 });
  }

  thaw(): void {
    this.synth.tone({ freq: 2093, freqEnd: 1568, duration: 0.3, type: "sine", gain: 0.07 });
    this.synth.noiseBurst({ duration: 0.15, type: "highpass", freq: 5000, gain: 0.06 });
  }

  unlock(): void {
    this.synth.tone({ freq: 1200, duration: 0.04, type: "square", gain: 0.06 });
    this.synth.tone({ freq: 1600, duration: 0.06, type: "square", gain: 0.06, delay: 0.06 });
  }

  serve(): void {
    this.synth.arpeggio([midi(76), midi(79), midi(84)], 0.06, { gain: 0.12, duration: 0.3 });
  }

  /** Can't go there: a gentle wobble. */
  nope(): void {
    this.synth.tone({ freq: 240, freqEnd: 200, duration: 0.14, type: "triangle", gain: 0.14 });
    this.synth.tone({ freq: 200, freqEnd: 170, duration: 0.14, type: "triangle", gain: 0.1, delay: 0.1 });
  }

  bonk(): void {
    this.synth.tone({ freq: 190, freqEnd: 130, duration: 0.16, type: "sine", gain: 0.22 });
  }

  coin(): void {
    this.synth.tone({ freq: 1320, duration: 0.08, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 1760, duration: 0.12, type: "triangle", gain: 0.12, delay: 0.06 });
  }

  win(): void {
    this.synth.arpeggio([midi(67), midi(71), midi(74), midi(79), midi(83)], 0.08, { gain: 0.16, duration: 0.7 });
  }

  bell(): void {
    this.synth.tone({ freq: 1568, duration: 0.8, type: "sine", gain: 0.1 });
    this.synth.tone({ freq: 2349, duration: 0.6, type: "sine", gain: 0.05, delay: 0.02 });
  }

  /** A display is finished. */
  display(): void {
    this.synth.arpeggio([midi(60), midi(64), midi(67), midi(72), midi(76), midi(79), midi(84)], 0.09, { gain: 0.14, duration: 1.0 });
  }

  power(): void {
    this.synth.tone({ freq: 440, freqEnd: 880, duration: 0.25, type: "triangle", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.3, type: "highpass", freq: 3000, gain: 0.08 });
  }
}
