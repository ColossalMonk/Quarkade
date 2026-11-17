// Unbolted's workshop sounds, all generated with WebAudio (DESIGN.md §2).

import { Synth, midi } from "../../../../forge/src/core/audio.ts";
import type { SongSpec } from "../../../../forge/src/core/music.ts";

/** A light "workshop" tune for forge's Music: plucked bass, woodblock feel, whistled lead. */
export const WORKSHOP_SONG: SongSpec = {
  bpm: 92,
  progression: [
    [48, 55, 60, 64],
    [45, 52, 57, 60],
    [41, 48, 53, 57],
    [43, 50, 55, 59],
  ],
  melody: [72, 74, 76, 79, 81, 84],
  density: 0.4,
  volume: 0.13,
};

export class Sfx {
  readonly synth = new Synth();

  /** Ratchet clicks while unscrewing (3-4 fast ticks, rising). */
  ratchet(fast = false): void {
    const n = fast ? 2 : 4;
    for (let i = 0; i < n; i++) {
      this.synth.noiseBurst({ duration: 0.025, type: "bandpass", freq: 2600 + i * 400, q: 6, gain: 0.32, delay: i * 0.06 });
      this.synth.tone({ freq: 900 + i * 140, duration: 0.02, type: "square", gain: 0.03, delay: i * 0.06 });
    }
  }

  /** A bolt lands in a toolbox. */
  tink(fill: number): void {
    this.synth.tone({ freq: 1760 + fill * 220, duration: 0.18, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 2640 + fill * 330, duration: 0.1, type: "sine", gain: 0.05, delay: 0.01 });
  }

  /** A bolt lands in the tray. */
  clunk(): void {
    this.synth.tone({ freq: 420, freqEnd: 300, duration: 0.12, type: "triangle", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.05, type: "lowpass", freq: 900, gain: 0.15 });
  }

  /** A plate starts to swing. */
  creak(): void {
    this.synth.tone({ freq: 180, freqEnd: 120, duration: 0.35, type: "sawtooth", gain: 0.03 });
    this.synth.noiseBurst({ duration: 0.25, type: "bandpass", freq: 700, q: 8, gain: 0.08 });
  }

  /** A plate drops away. */
  clang(): void {
    this.synth.tone({ freq: 523, duration: 0.5, type: "triangle", gain: 0.1 });
    this.synth.tone({ freq: 1244, duration: 0.35, type: "sine", gain: 0.05 });
    this.synth.noiseBurst({ duration: 0.4, type: "highpass", freq: 3000, gain: 0.06, delay: 0.02 });
    this.synth.tone({ freq: 200, freqEnd: 60, duration: 0.3, type: "sine", gain: 0.1, delay: 0.25 });
  }

  /** A toolbox closes. */
  lid(): void {
    this.synth.noiseBurst({ duration: 0.06, type: "lowpass", freq: 1200, gain: 0.3 });
    this.synth.tone({ freq: 160, freqEnd: 90, duration: 0.12, type: "sine", gain: 0.2 });
    setTimeout(() => this.synth.arpeggio([midi(76), midi(79), midi(84)], 0.05, { gain: 0.08, duration: 0.25 }), 60);
  }

  unlock(): void {
    this.synth.tone({ freq: 1800, duration: 0.04, type: "square", gain: 0.06 });
    this.synth.tone({ freq: 2400, duration: 0.1, type: "triangle", gain: 0.08, delay: 0.05 });
  }

  bonk(): void {
    this.synth.tone({ freq: 190, freqEnd: 130, duration: 0.16, type: "sine", gain: 0.22 });
  }

  coin(): void {
    this.synth.tone({ freq: 1320, duration: 0.08, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 1760, duration: 0.12, type: "triangle", gain: 0.12, delay: 0.06 });
  }

  win(): void {
    this.synth.arpeggio([midi(60), midi(64), midi(67), midi(72), midi(76)], 0.08, { gain: 0.16, duration: 0.7 });
  }

  /** A gadget comes to life. */
  gadget(): void {
    for (let i = 0; i < 6; i++) this.synth.noiseBurst({ duration: 0.03, type: "bandpass", freq: 3000, q: 5, gain: 0.15, delay: i * 0.07 });
    setTimeout(() => this.synth.arpeggio([midi(60), midi(64), midi(67), midi(72), midi(76), midi(79), midi(84)], 0.09, { gain: 0.14, duration: 1.0 }), 300);
  }

  power(): void {
    this.synth.tone({ freq: 440, freqEnd: 880, duration: 0.25, type: "triangle", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.3, type: "highpass", freq: 3000, gain: 0.08 });
  }

  drill(): void {
    this.synth.tone({ freq: 160, freqEnd: 220, duration: 0.5, type: "sawtooth", gain: 0.06 });
    this.synth.noiseBurst({ duration: 0.5, type: "bandpass", freq: 1500, q: 2, gain: 0.12 });
  }

  magnet(): void {
    this.synth.tone({ freq: 120, freqEnd: 520, duration: 0.6, type: "sine", gain: 0.12 });
  }
}
