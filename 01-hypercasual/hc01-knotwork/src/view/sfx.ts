// Knotwork's sounds, all generated with WebAudio (DESIGN.md §2 "Sound").

import { Synth, midi } from "../../../../forge/src/core/audio.ts";

export class Sfx {
  readonly synth = new Synth();

  lift(): void {
    this.synth.noiseBurst({ duration: 0.09, type: "highpass", freq: 1400, freqEnd: 3200, gain: 0.18 });
  }

  drop(count = 1): void {
    this.synth.noiseBurst({ duration: 0.12, type: "lowpass", freq: 520 - count * 40, gain: 0.55 });
    this.synth.tone({ freq: 120 - count * 6, freqEnd: 70, duration: 0.12, gain: 0.14 });
    this.click(0.05);
  }

  click(delay = 0): void {
    this.synth.noiseBurst({ duration: 0.035, type: "bandpass", freq: 2600, q: 6, gain: 0.35, delay });
    this.synth.noiseBurst({ duration: 0.03, type: "bandpass", freq: 3100, q: 6, gain: 0.25, delay: delay + 0.05 });
  }

  knit(): void {
    for (let i = 0; i < 9; i++) {
      const d = 0.03 + i * (0.075 - i * 0.005);
      this.synth.noiseBurst({ duration: 0.025, type: "bandpass", freq: 2400 + i * 120, q: 7, gain: 0.22, delay: d });
    }
    this.synth.arpeggio([midi(72), midi(76), midi(79)], 0.06, { gain: 0.12, duration: 0.35 });
  }

  bonk(): void {
    this.synth.tone({ freq: 180, freqEnd: 120, duration: 0.16, type: "sine", gain: 0.22 });
  }

  coin(): void {
    this.synth.tone({ freq: 1320, duration: 0.08, type: "triangle", gain: 0.12 });
    this.synth.tone({ freq: 1760, duration: 0.12, type: "triangle", gain: 0.12, delay: 0.06 });
  }

  win(): void {
    this.synth.arpeggio([midi(60), midi(64), midi(67), midi(72), midi(76)], 0.08, { gain: 0.16, duration: 0.7 });
  }

  quilt(): void {
    this.synth.arpeggio([midi(55), midi(60), midi(64), midi(67), midi(72), midi(76), midi(79), midi(84)], 0.09, { gain: 0.15, duration: 1.1 });
  }

  power(): void {
    this.synth.tone({ freq: 440, freqEnd: 880, duration: 0.25, type: "triangle", gain: 0.14 });
    this.synth.noiseBurst({ duration: 0.3, type: "highpass", freq: 3000, gain: 0.08 });
  }

  snip(): void {
    this.synth.noiseBurst({ duration: 0.05, type: "highpass", freq: 4000, gain: 0.3 });
    this.synth.noiseBurst({ duration: 0.05, type: "highpass", freq: 4500, gain: 0.3, delay: 0.08 });
  }
}
